import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Keyframe } from '@bendyline/molen-schema';
import { startCaptureResources } from '../capture-server';
import { findProjectFile, loadProject } from '../project';
import { inspectAsset } from './asset-inspect';
import { guardOp } from './errors';
import type { RenderStats } from './screenshot';

// Model QA for agents: render an imported asset from N turntable angles (framed from its
// sidecar bounds) in one browser session. MCP returns the frames as images, so an agent can
// LOOK at what it imported/generated without a human in the loop.

export interface AssetShotInput {
  /** Project asset id, or a sidecar path. */
  ref: string;
  projectPath?: string;
  /** Render this packed variant (e.g. "ktx2") instead of the canonical main GLB. */
  assetVariant?: string;
  /** Number of turntable angles (default 4: front/right/back/left, slightly elevated). */
  angles?: number;
  /** Play this clip and pose it at `clipTime` seconds (default: bind pose). */
  clip?: string;
  clipTime?: number;
  size?: [number, number];
  clearColor?: string;
  outDir: string;
}

export interface AssetShotOutput {
  ok: boolean;
  frames?: { name: string; path: string; renderStats?: RenderStats }[];
  triangles?: number;
  error?: string;
}

function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

/** Render turntable views of an imported asset. */
export function screenshotAsset(input: AssetShotInput): Promise<AssetShotOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => screenshotAssetImpl(input),
  );
}

async function screenshotAssetImpl(input: AssetShotInput): Promise<AssetShotOutput> {
  const projectPath = input.projectPath ?? (await findProjectFile(process.cwd()));
  const inspected = await inspectAsset({
    ref: input.ref,
    ...(projectPath !== undefined ? { projectPath } : {}),
  });
  if (!inspected.ok || inspected.sidecar === undefined || inspected.sidecarPath === undefined) {
    return { ok: false, error: inspected.error ?? `asset "${input.ref}" not found` };
  }
  const sidecar = inspected.sidecar;
  if (sidecar.kind !== 'model') {
    return { ok: false, error: `asset "${sidecar.id}" is kind "${sidecar.kind}", not a model` };
  }

  // Serve the asset's own directory; the ref becomes a direct model URL.
  const assetDir = dirname(inspected.sidecarPath);
  const project = projectPath !== undefined ? await loadProject(projectPath) : undefined;
  const filesRoot = project?.dir ?? assetDir;
  const rel = inspected.sidecarPath
    .slice(filesRoot.length + 1)
    .replaceAll('\\', '/')
    .replace(/\/[^/]*$/, '');
  const variantFile =
    input.assetVariant !== undefined ? sidecar.files.variants[input.assetVariant] : undefined;
  if (input.assetVariant !== undefined && variantFile === undefined) {
    return {
      ok: false,
      error: `asset "${sidecar.id}" has no "${input.assetVariant}" variant (run molen asset pack)`,
    };
  }
  const modelUrlRel = `${rel}/${variantFile ?? sidecar.files.main}`;

  const { center, radius } = sidecar.bounds.sphere;
  const distance = Math.max(radius * 2.6, 0.5);
  const anglesCount = Math.max(1, input.angles ?? 4);
  const size = input.size ?? [400, 300];
  const tickRate = 30;
  const clipTick = input.clip !== undefined ? Math.round((input.clipTime ?? 0) * tickRate) : 0;

  const keyframe: Keyframe = {
    kind: 'keyframe',
    v: 1,
    engine: '',
    tick: clipTick,
    tickRate,
    seed: '',
    nextEntitySeq: 1,
    rng: { algo: 'sfc32', state: [0, 0, 0, 0] },
    entities: {
      subject: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'gltf',
          ref: sidecar.id,
          ...(input.clip !== undefined ? { animation: { clip: input.clip, startTick: 0 } } : {}),
        },
      },
    },
    plugins: {},
  };

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
    await mkdir(input.outDir, { recursive: true });

    const frames: AssetShotOutput['frames'] = [];
    let triangles = 0;
    for (let i = 0; i < anglesCount; i++) {
      const theta = (i / anglesCount) * Math.PI * 2;
      const camera = {
        position: [
          center[0] + Math.sin(theta) * distance,
          center[1] + radius * 0.9,
          center[2] + Math.cos(theta) * distance,
        ] as [number, number, number],
        lookAt: center,
      };
      const req = {
        keyframe,
        camera,
        size,
        terrain: null,
        clearColor: input.clearColor ?? '#181d24',
        assetsBaseUrl: `${server.url}/files/`,
        assetsIndex: { [sidecar.id]: modelUrlRel },
      };
      const stats = (await page.evaluate(
        (r: unknown) =>
          (
            globalThis as unknown as { __molenCapture: (x: unknown) => Promise<unknown> }
          ).__molenCapture(r),
        req as unknown,
      )) as RenderStats;
      triangles = stats.triangles;
      const name = `angle_${i}`;
      const path = join(input.outDir, `${name}.png`);
      await writeFile(
        path,
        await page.screenshot({ clip: { x: 0, y: 0, width: size[0], height: size[1] } }),
      );
      frames.push({ name, path, renderStats: stats });
    }
    return { ok: true, frames, triangles };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    await Promise.allSettled([browser.close(), server.close()]);
  }
}
