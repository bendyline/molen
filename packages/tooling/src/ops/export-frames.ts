import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type CameraTrackDoc, evaluateCameraTrack } from '@bendyline/molen-client/camera-track';
import { type ResolvedTypes, takeKeyframe, type WorldSetup } from '@bendyline/molen-kernel';
import type { SceneManifest, Vec3 } from '@bendyline/molen-schema';
import { validate, validateByKind } from '@bendyline/molen-schema';
import { startCaptureResources } from '../capture-server';
import {
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

export interface ExportFramesInput {
  scene?: SceneManifest | Record<string, unknown>;
  /** Scene file path, or a scene NAME from the surrounding project.json. */
  scenePath?: string;
  /** Explicit project.json (default: discovered by walking up from the scene). */
  projectPath?: string;
  setup?: WorldSetup;
  setupModule?: string;
  /** Render packed asset variants (e.g. "ktx2" from `molen asset pack`) where present. */
  assetVariant?: string;
  /** Inclusive tick range and stride. */
  from: number;
  to: number;
  step?: number;
  /** A camera track (inline or path) followed over the range; else a fixed camera. */
  track?: CameraTrackDoc;
  trackPath?: string;
  camera?: CameraSpec;
  size?: [number, number];
  clearColor?: string;
  /** Directory frames are written to (frame_0000.png, …). */
  outDir: string;
}

export interface ExportFramesOutput {
  ok: boolean;
  dir?: string;
  frameCount?: number;
  frames?: string[];
  error?: string;
}

function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

/**
 * Render a sequence of frames over a tick range, optionally following a camera track (machinima).
 * Builds the world once and steps incrementally so every frame is from the same timeline.
 */
export function exportFrames(input: ExportFramesInput): Promise<ExportFramesOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => exportFramesImpl(input),
  );
}

async function exportFramesImpl(input: ExportFramesInput): Promise<ExportFramesOutput> {
  let manifest: SceneManifest;
  let types: ResolvedTypes | undefined;
  let project: ProjectContext | undefined;
  let filesRoot: string | undefined;
  let assetsIndex: Record<string, string> | undefined;
  let buildOpts: SceneBuildOptions = {};
  if (input.scene !== undefined) {
    const sceneResult = validate('scene', input.scene);
    if (!sceneResult.ok) return { ok: false, error: sceneResult.formatted };
    manifest = sceneResult.value;
  } else {
    if (input.scenePath === undefined) return { ok: false, error: 'provide scene or scenePath' };
    try {
      const loaded = await loadSceneDocument(input.scenePath, {
        ...(input.projectPath !== undefined ? { projectPath: input.projectPath } : {}),
      });
      manifest = loaded.manifest;
      types = loaded.project?.resolvedTypes;
      project = loaded.project;
      buildOpts = await sceneBuildOptionsFor(loaded);
      if (project !== undefined) {
        filesRoot = project.dir;
        assetsIndex = await assetFileIndex(project, {
          ...(input.assetVariant !== undefined ? { variant: input.assetVariant } : {}),
        });
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  let track = input.track;
  if (track === undefined && input.trackPath !== undefined) {
    const tv = validateByKind('cameratrack', parseJson(await readFile(input.trackPath, 'utf8')));
    if (!tv.ok) return { ok: false, error: tv.formatted };
    track = tv.value as CameraTrackDoc;
  }

  let setup = input.setup;
  const setupModule = resolveSetupModule(input.setupModule, project);
  if (setup === undefined && setupModule !== undefined) setup = await loadSetupLike(setupModule);
  const sceneCapture = cameraFromManifest(manifest, input.camera);

  const step = Math.max(1, input.step ?? 1);
  const size = input.size ?? [1280, 720];
  const clearColor = input.clearColor ?? '#11131a';
  const terrainPayload =
    buildOpts.terrain !== undefined
      ? {
          descriptor: buildOpts.terrain.descriptor,
          heightmapB64: Buffer.from(buildOpts.terrain.png).toString('base64'),
        }
      : null;
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
  await mkdir(input.outDir, { recursive: true });

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
  const frames: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    await page.goto(`${server.url}/capture.html`);

    let frameIdx = 0;
    for (let tick = input.from; tick <= input.to; tick += step) {
      if (world.tick < tick) world.stepN(tick - world.tick);
      const keyframe = takeKeyframe(world);
      const trackPose = track !== undefined ? evaluateCameraTrack(track, tick) : undefined;
      const camera =
        trackPose !== undefined
          ? {
              position: trackPose.position as Vec3,
              lookAt: (trackPose as { lookAt?: Vec3 }).lookAt ?? null,
            }
          : sceneCapture.camera;
      const req: {
        keyframe: unknown;
        sceneCamera?: SceneManifest['camera'];
        camera: unknown;
        ortho: unknown;
        size: [number, number];
        terrain: unknown;
        clearColor: string;
        assetsBaseUrl: string | null;
        assetsIndex: Record<string, string> | null;
      } = {
        keyframe,
        sceneCamera: manifest.camera,
        camera,
        ortho: trackPose === undefined ? sceneCapture.ortho : null,
        size,
        terrain: terrainPayload,
        clearColor,
        assetsBaseUrl: filesRoot !== undefined ? `${server.url}/files/` : null,
        assetsIndex: assetsIndex ?? null,
      };
      await page.evaluate(
        (r: {
          keyframe: unknown;
          sceneCamera?: SceneManifest['camera'];
          camera: unknown;
          ortho: unknown;
          size: [number, number];
          terrain: unknown;
          clearColor: string;
          assetsBaseUrl: string | null;
          assetsIndex: Record<string, string> | null;
        }) =>
          (globalThis as unknown as { __molenCapture: (x: unknown) => unknown }).__molenCapture(r),
        req,
      );
      const out = join(input.outDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
      const buffer = await page.screenshot({
        clip: { x: 0, y: 0, width: size[0], height: size[1] },
      });
      await writeFile(out, buffer);
      frames.push(out);
      frameIdx++;
    }
  } finally {
    await Promise.allSettled([browser.close(), server.close()]);
  }
  return { ok: true, dir: input.outDir, frameCount: frames.length, frames };
}
