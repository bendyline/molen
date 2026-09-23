import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ResolvedTypes,
  stateHash,
  takeKeyframe,
  type WorldSetup,
} from '@bendyline/molen-kernel';
import type { Keyframe, SceneManifest } from '@bendyline/molen-schema';
import { validate, validateByKind } from '@bendyline/molen-schema';
import { startCaptureResources } from '../capture-server';
import {
  loadProject,
  loadSceneDocument,
  loadSetupLike,
  type ProjectContext,
  resolveSetupModule,
} from '../project';
import {
  assetFileIndex,
  parseJson,
  prepareSceneBuilder,
  type SceneBuildOptions,
  sceneBuildOptionsFor,
} from './build';
import { type CameraSpec, cameraFromManifest } from './camera';
import { guardOp } from './errors';

export type { CameraSpec } from './camera';

export interface TerrainShot {
  /** Validated terrain descriptor, or a path to one. */
  descriptor?: unknown;
  descriptorPath?: string;
  /** Path to a 16-bit grayscale heightmap PNG. */
  heightmapPath?: string;
  /** Raw heightmap PNG bytes (alternative to heightmapPath). */
  heightmapPng?: Uint8Array;
}

export interface ScreenshotInput {
  /** A full manifest or any raw scene doc (it is validated and defaulted internally). */
  scene?: SceneManifest | Record<string, unknown>;
  /** Scene file path, or a scene NAME from the surrounding project.json. */
  scenePath?: string;
  /** Explicit project.json (default: discovered by walking up from the scene). */
  projectPath?: string;
  setup?: WorldSetup;
  setupModule?: string;
  /** Render packed asset variants (e.g. "ktx2" from `molen asset pack`) where present. */
  assetVariant?: string;
  ticks: number;
  camera?: CameraSpec;
  size?: [number, number];
  outPath: string;
  terrain?: TerrainShot;
  /** Background clear color; defaults to sky-blue with terrain, else dark. */
  clearColor?: string;
}

export interface RenderStats {
  entitiesRendered: number;
  drawCalls: number;
  triangles: number;
}

export interface ScreenshotOutput {
  ok: boolean;
  imagePath?: string;
  tick?: number;
  stateHash?: string;
  renderStats?: RenderStats;
  error?: string;
}

/** The bundled capture page dir (dist/capture) relative to this module. */
function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

/**
 * Simulate a scene to tick N in Node, serialize a keyframe, then render exactly one
 * deterministic frame in headless Chromium (SwiftShader) and save a PNG with a stats block
 * (docs-src/guide/agent-loop.md, "Screenshot"). The capture page boots a snapshot viewer — no
 * live kernel. gltf renderables are served to the page over an ephemeral localhost HTTP server.
 */
export function screenshotScene(input: ScreenshotInput): Promise<ScreenshotOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => screenshotSceneImpl(input),
  );
}

async function screenshotSceneImpl(input: ScreenshotInput): Promise<ScreenshotOutput> {
  // Resolve + validate scene (project scene names allowed; registry types resolved).
  let manifest: SceneManifest;
  let types: ResolvedTypes | undefined;
  let filesRoot: string | undefined;
  let assetsIndex: Record<string, string> | undefined;
  let project: ProjectContext | undefined;
  let buildOpts: SceneBuildOptions = {};
  if (input.scene !== undefined) {
    const sceneResult = validate('scene', input.scene);
    if (!sceneResult.ok) return { ok: false, error: sceneResult.formatted };
    manifest = sceneResult.value;
    // Inline scenes still need the explicitly supplied project's type registry,
    // asset URL index and file root. Otherwise GLBs silently disappear while
    // the capture succeeds with only its primitive ground and scale marker.
    if (input.projectPath !== undefined) {
      project = await loadProject(input.projectPath);
      types = project.resolvedTypes;
      filesRoot = project.dir;
      buildOpts = await sceneBuildOptionsFor({
        manifest,
        project,
        scenePath: join(project.dir, 'inline.scene.json'),
        notices: [],
      });
      assetsIndex = await assetFileIndex(project, {
        ...(input.assetVariant !== undefined ? { variant: input.assetVariant } : {}),
      });
    }
  } else {
    if (input.scenePath === undefined) return { ok: false, error: 'provide scene or scenePath' };
    try {
      const loaded = await loadSceneDocument(input.scenePath, {
        ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
      });
      manifest = loaded.manifest;
      types = loaded.project?.resolvedTypes;
      buildOpts = await sceneBuildOptionsFor(loaded);
      if (loaded.project !== undefined) {
        project = loaded.project;
        filesRoot = loaded.project.dir;
        assetsIndex = await assetFileIndex(loaded.project, {
          ...(input.assetVariant !== undefined ? { variant: input.assetVariant } : {}),
        });
      } else {
        filesRoot = dirname(loaded.scenePath);
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  let setup = input.setup;
  const setupModule = resolveSetupModule(input.setupModule, project);
  if (setup === undefined && setupModule !== undefined) setup = await loadSetupLike(setupModule);

  // Camera: explicit input wins; else the scene's own camera block (perspective or ortho).
  const capture = cameraFromManifest(manifest, input.camera);
  const camera = capture.camera ?? undefined;

  // Simulate to tick N and snapshot.
  let build: Awaited<ReturnType<typeof prepareSceneBuilder>>;
  try {
    build = await prepareSceneBuilder(manifest, setup, {
      ...buildOpts,
      ...(types !== undefined ? { types } : {}),
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const world = build();
  world.stepN(input.ticks);
  const keyframe: Keyframe = takeKeyframe(world);
  const hash = stateHash(world);
  const size = input.size ?? [1280, 720];

  // Optional terrain: validate the descriptor and read the heightmap as base64.
  let terrainPayload:
    | { descriptor: unknown; heightmapB64: string; cameraPos?: [number, number, number] }
    | undefined;
  if (input.terrain !== undefined) {
    let descRaw: unknown = input.terrain.descriptor;
    if (descRaw === undefined && input.terrain.descriptorPath !== undefined) {
      descRaw = parseJson(await readFile(input.terrain.descriptorPath, 'utf8'));
    }
    const dv = validateByKind('terrain', descRaw);
    if (!dv.ok) return { ok: false, error: dv.formatted };
    let pngBytes = input.terrain.heightmapPng;
    if (pngBytes === undefined && input.terrain.heightmapPath !== undefined) {
      pngBytes = await readFile(input.terrain.heightmapPath);
    }
    if (pngBytes === undefined) return { ok: false, error: 'terrain requires a heightmap' };
    terrainPayload = {
      descriptor: dv.value,
      heightmapB64: Buffer.from(pngBytes).toString('base64'),
      ...(camera !== undefined ? { cameraPos: camera.position } : {}),
    };
  } else if (buildOpts.terrain !== undefined) {
    // The scene's own terrain block: the same heightmap the simulation stood on.
    terrainPayload = {
      descriptor: buildOpts.terrain.descriptor,
      heightmapB64: Buffer.from(buildOpts.terrain.png).toString('base64'),
      ...(camera !== undefined ? { cameraPos: camera.position } : {}),
    };
  }

  // Render in headless Chromium, served over localhost HTTP (file:// blocks asset fetches).
  const { chromium } = await import('playwright');
  const { browser, server } = await startCaptureResources(
    () =>
      chromium.launch({
        args: [
          '--use-gl=angle',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
          '--disable-gpu-sandbox',
        ],
      }),
    captureRootDir(),
    filesRoot,
  );
  try {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    await page.goto(`${server.url}/capture.html`);
    // The callback runs in the browser; access the harness via globalThis to avoid pulling
    // DOM lib types here. The arg is typed shallowly so Playwright's evaluate generics don't
    // recurse into the deep Keyframe type.
    const clearColor = input.clearColor ?? (terrainPayload !== undefined ? '#adc8e6' : '#11131a');
    const req: {
      keyframe: unknown;
      camera: unknown;
      ortho: unknown;
      sceneCamera?: SceneManifest['camera'];
      size: [number, number];
      terrain: unknown;
      clearColor: string;
      assetsBaseUrl: string | null;
      assetsIndex: Record<string, string> | null;
    } = {
      keyframe,
      sceneCamera: manifest.camera,
      camera: capture.camera,
      ortho: capture.ortho,
      size,
      terrain: terrainPayload ?? null,
      clearColor,
      assetsBaseUrl: filesRoot !== undefined ? `${server.url}/files/` : null,
      assetsIndex: assetsIndex ?? null,
    };
    const stats = (await page.evaluate(
      (r: {
        keyframe: unknown;
        camera: unknown;
        ortho: unknown;
        sceneCamera?: SceneManifest['camera'];
        size: [number, number];
        terrain: unknown;
        clearColor: string;
        assetsBaseUrl: string | null;
        assetsIndex: Record<string, string> | null;
      }) =>
        (
          globalThis as unknown as { __molenCapture: (x: unknown) => Promise<unknown> }
        ).__molenCapture(r),
      req,
    )) as RenderStats;

    await mkdir(dirname(input.outPath), { recursive: true });
    const buffer = await page.screenshot({
      clip: { x: 0, y: 0, width: size[0], height: size[1] },
    });
    await writeFile(input.outPath, buffer);

    return {
      ok: true,
      imagePath: input.outPath,
      tick: world.tick,
      stateHash: hash,
      renderStats: stats,
    };
  } finally {
    await Promise.allSettled([browser.close(), server.close()]);
  }
}
