import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ResolvedTypes,
  stateHash,
  takeKeyframe,
  type WorldSetup,
} from '@bendyline/molen-kernel';
import {
  type AssertionResult,
  formatAssertionResults,
  runAssertions,
} from '@bendyline/molen-kernel/testing';
import type { AssertionDoc, EngineEvent, JsonValue, SceneManifest } from '@bendyline/molen-schema';
import { validate } from '@bendyline/molen-schema';
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
import type { RenderStats } from './screenshot';

// The agent PLAY harness: run a scene like a player would — inject commands at chosen ticks,
// capture screenshots at chosen ticks — in one deterministic pass. Same seed + same actions =
// identical frames and hashes, so a drive session doubles as a scenario regression test.
// Exposed over MCP as drive_scene, returning the frames as IMAGE content an agent can look at.

export interface DriveAction {
  /** Tick this action applies at (actions are processed in ascending order). */
  at: number;
  /** Submit a command (envelope is filled: source "drive", auto seq, tick = at). */
  command?: { type: string; payload?: JsonValue };
  /** Capture a named frame once the world reaches this tick. */
  screenshot?: string;
  /** Camera for this and subsequent frames (default: the scene's camera block). */
  camera?: CameraSpec;
}

export interface DriveInput {
  scenePath?: string;
  scene?: SceneManifest | Record<string, unknown>;
  projectPath?: string;
  setupModule?: string;
  setup?: WorldSetup;
  /** Render packed asset variants (e.g. "ktx2" from `molen asset pack`) where present. */
  assetVariant?: string;
  actions: DriveAction[];
  /** Step to this tick after the last action (default: the last action's tick). */
  until?: number;
  assertPath?: string;
  assertDoc?: AssertionDoc;
  size?: [number, number];
  clearColor?: string;
  /** Directory frames are written to (<name>.png). */
  outDir: string;
}

export interface DriveFrame {
  tick: number;
  name: string;
  path: string;
  renderStats?: RenderStats;
}

export interface DriveOutput {
  ok: boolean;
  tick?: number;
  stateHash?: string;
  frames?: DriveFrame[];
  events?: { tick: number; type: string; payload: JsonValue }[];
  assertionResults?: AssertionResult[];
  assertionsFormatted?: string;
  error?: string;
}

function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

/** Drive a scene: commands in, frames out, deterministically. */
export function driveScene(input: DriveInput): Promise<DriveOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => driveSceneImpl(input),
  );
}

async function driveSceneImpl(input: DriveInput): Promise<DriveOutput> {
  // Resolve the scene exactly like sim run does (project names, registry types, physics).
  let manifest: SceneManifest;
  let types: ResolvedTypes | undefined;
  let filesRoot: string | undefined;
  let assetsIndex: Record<string, string> | undefined;
  let project: ProjectContext | undefined;
  let buildOpts: SceneBuildOptions = {};
  if (input.scene !== undefined) {
    const parsed = validate('scene', input.scene);
    if (!parsed.ok) return { ok: false, error: parsed.formatted };
    manifest = parsed.value;
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
      if (loaded.project !== undefined) {
        filesRoot = loaded.project.dir;
        assetsIndex = await assetFileIndex(loaded.project, {
          ...(input.assetVariant !== undefined ? { variant: input.assetVariant } : {}),
        });
      }
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  let setup = input.setup;
  const setupModule = resolveSetupModule(input.setupModule, project);
  if (setup === undefined && setupModule !== undefined) setup = await loadSetupLike(setupModule);

  let assertDoc = input.assertDoc;
  if (input.assertPath !== undefined) {
    const { readFile } = await import('node:fs/promises');
    const v = validate('assert', parseJson(await readFile(input.assertPath, 'utf8')));
    if (!v.ok) return { ok: false, error: v.formatted };
    assertDoc = v.value;
  }

  let build: () => ReturnType<Awaited<ReturnType<typeof prepareSceneBuilder>>>;
  try {
    build = await prepareSceneBuilder(manifest, setup, {
      ...buildOpts,
      ...(types !== undefined ? { types } : {}),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const world = build();

  // Record every event with the tick it fired on (the agent's causality trail).
  const events: { tick: number; type: string; payload: JsonValue }[] = [];
  world.on('*', (e: EngineEvent) =>
    events.push({ tick: world.tick, type: e.type, payload: e.payload }),
  );

  const actions = [...input.actions].sort((a, b) => a.at - b.at);
  const screenshotNames = new Set<string>();
  for (const action of actions) {
    if (!Number.isSafeInteger(action.at) || action.at < 0) {
      return { ok: false, error: `action tick must be a nonnegative safe integer: ${action.at}` };
    }
    if (action.screenshot === undefined) continue;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(action.screenshot)) {
      return {
        ok: false,
        error: `unsafe screenshot name "${action.screenshot}" (use letters, digits, "-", or "_")`,
      };
    }
    if (screenshotNames.has(action.screenshot)) {
      return { ok: false, error: `duplicate screenshot name "${action.screenshot}"` };
    }
    screenshotNames.add(action.screenshot);
  }
  const sceneCapture = cameraFromManifest(manifest);
  let camera: CameraSpec | undefined = sceneCapture.camera ?? undefined;
  const size = input.size ?? [640, 400];
  const clearColor = input.clearColor ?? (buildOpts.terrain !== undefined ? '#adc8e6' : '#11131a');
  const frames: DriveFrame[] = [];
  const terrainPayload =
    buildOpts.terrain !== undefined
      ? {
          descriptor: buildOpts.terrain.descriptor,
          heightmapB64: Buffer.from(buildOpts.terrain.png).toString('base64'),
        }
      : null;

  const needsBrowser = actions.some((a) => a.screenshot !== undefined);
  const { chromium } = await import('playwright');
  const resources = needsBrowser
    ? await startCaptureResources(
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
      )
    : undefined;
  const browser = resources?.browser;
  const server = resources?.server;

  try {
    const page =
      browser !== undefined
        ? await browser.newPage({ viewport: { width: size[0], height: size[1] } })
        : undefined;
    if (page !== undefined && server !== undefined) {
      await page.goto(`${server.url}/capture.html`);
    }
    if (needsBrowser) await mkdir(input.outDir, { recursive: true });

    let seq = 0;
    for (const action of actions) {
      if (action.command !== undefined) {
        // Submit before stepping past the tick; the kernel adjudicates (late -> next tick).
        const result = world.submitCommand({
          kind: 'command',
          seq: seq++,
          source: 'drive',
          tick: Math.max(action.at, world.tick),
          type: action.command.type,
          payload: action.command.payload ?? {},
        });
        if (!result.accepted) {
          return {
            ok: false,
            error: `command "${action.command.type}" at tick ${action.at}: ${result.reason}`,
          };
        }
      }
      if (action.camera !== undefined) camera = action.camera;
      if (action.screenshot !== undefined && page !== undefined && server !== undefined) {
        if (world.tick < action.at) world.stepN(action.at - world.tick);
        const keyframe = takeKeyframe(world);
        const req = {
          keyframe,
          sceneCamera: manifest.camera,
          camera: camera ?? null,
          // An action camera replaces the scene's framing; otherwise ortho scenes stay ortho.
          ortho: camera === undefined ? sceneCapture.ortho : null,
          size,
          terrain: terrainPayload,
          clearColor,
          assetsBaseUrl: filesRoot !== undefined ? `${server.url}/files/` : null,
          assetsIndex: assetsIndex ?? null,
        };
        const stats = (await page.evaluate(
          (r: unknown) =>
            (
              globalThis as unknown as { __molenCapture: (x: unknown) => Promise<unknown> }
            ).__molenCapture(r),
          req as unknown,
        )) as RenderStats;
        const path = join(input.outDir, `${action.screenshot}.png`);
        const shot = await page.screenshot({
          clip: { x: 0, y: 0, width: size[0], height: size[1] },
        });
        await writeFile(path, shot);
        frames.push({ tick: world.tick, name: action.screenshot, path, renderStats: stats });
      }
    }
    const lastAt = actions.at(-1)?.at ?? 0;
    const target = Math.max(input.until ?? lastAt, lastAt);
    if (world.tick < target) world.stepN(target - world.tick);

    const assertionResults = assertDoc
      ? runAssertions(world, assertDoc, {
          events: events.map((e) => ({
            tick: e.tick,
            event: { type: e.type, payload: e.payload },
          })),
        })
      : [];
    const allPass = assertionResults.every((r) => r.pass);
    return {
      ok: allPass,
      tick: world.tick,
      stateHash: stateHash(world),
      frames,
      events,
      assertionResults,
      ...(assertionResults.length > 0
        ? { assertionsFormatted: formatAssertionResults(assertionResults) }
        : {}),
    };
  } finally {
    await Promise.allSettled([
      ...(browser !== undefined ? [browser.close()] : []),
      ...(server !== undefined ? [server.close()] : []),
    ]);
  }
}
