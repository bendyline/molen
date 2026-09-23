/**
 * Render generated buildings headlessly: run the worldgen batch generator in Node on a batch
 * document (default: one building of every footprint class), then draw exactly those buffers,
 * props, and scatter placements in headless Chromium (SwiftShader) from one or more turntable
 * angles. The pack's materials and prop models are served to the page over localhost.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ArchStyleDoc,
  generateLandmarkModel,
  generateWorldgenBatch,
  type MeshBuffers,
  type PlacementSet,
  type ResolvedStylePack,
  stylePackAssetIndex,
  stylePackMaterialRefs,
  type WorldgenBatchDoc,
  type WorldgenBatchOutput,
  type WorldgenStats,
} from '@bendyline/molen-worldgen/kernel';
import { startCaptureResources } from '../capture-server';
import { guardOp } from './errors';
import {
  batchInputFromDoc,
  lineupBatchDoc,
  loadArchStyleFromDisk,
  loadBatchDoc,
  loadStylePackFromDisk,
  withArchStyle,
} from './worldgen-pack';

export interface WorldgenPreviewInput {
  /** A standalone `molen/archstyle@1` document to preview (injected into the pack). */
  stylePath?: string;
  /** Style pack manifest or directory (default: the shipped default pack). */
  packPath?: string;
  /** Force every building onto this style id (default: the pack's own rules). */
  styleId?: string;
  /** A `molen/worldgen-batch@1` document (default: the built-in lineup of every shape class). */
  batchPath?: string;
  scatterId?: string;
  ground?: 'flat' | 'slope';
  /** Turntable angles (default 1). */
  angles?: number;
  size?: [number, number];
  /** PNG path; with several angles the index is appended before the extension. */
  outPath: string;
  clearColor?: string;
}

export interface WorldgenPreviewFrame {
  path: string;
  yawDeg: number;
}

export interface WorldgenPreviewRenderStats {
  drawCalls: number;
  triangles: number;
  instances: number;
}

export interface WorldgenPreviewOutput {
  ok: boolean;
  frames?: WorldgenPreviewFrame[];
  stats?: WorldgenStats;
  renderStats?: WorldgenPreviewRenderStats;
  hash?: string;
  /** Material references the page could not bake (rendered flat). */
  materialFailures?: string[];
  error?: string;
}

/** Bundled capture pages (dist/capture) relative to this module. */
function captureRootDir(): string {
  return fileURLToPath(new URL('./capture/', import.meta.url));
}

function base64Of(array: ArrayBufferView): string {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64');
}

interface PreviewScenePayload {
  buffers?: {
    positions: string;
    normals: string;
    uvs: string;
    colors: string;
    indices: string;
    groups: MeshBuffers['groups'];
  };
  placements: Array<Omit<PlacementSet, 'data'> & { data: string }>;
  filesBaseUrl: string;
  assetIndex: Record<string, string>;
  materialRefs: string[];
  ground: { y: number; minX: number; minZ: number; maxX: number; maxZ: number };
  clearColor: string;
}

interface PreviewRequest {
  scene?: PreviewScenePayload;
  camera: { position: [number, number, number]; lookAt: [number, number, number] };
  size: [number, number];
}

interface PreviewResponse extends WorldgenPreviewRenderStats {
  materialFailures: string[];
}

/** World-space bounds of everything generated (buildings, props, scatter). */
export function worldgenPreviewBounds(output: WorldgenBatchOutput): {
  min: [number, number, number];
  max: [number, number, number];
} {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  const include = (x: number, y: number, z: number): void => {
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  };
  const positions = output.buildings?.positions;
  if (positions !== undefined) {
    for (let index = 0; index + 2 < positions.length; index += 3) {
      include(
        positions[index] as number,
        positions[index + 1] as number,
        positions[index + 2] as number,
      );
    }
  }
  for (const set of output.placements) {
    // Mapped trees have a normalized unit envelope; identity/furniture generators expose
    // their actual geometry. Including these extents keeps prop-only previews in frame.
    const model = set.modelRef.startsWith('builtin:')
      ? generateLandmarkModel(set.modelRef.slice(8))
      : undefined;
    const points =
      set.modelRef === 'builtin:box' || set.modelRef.startsWith('builtin:tree.mapped.')
        ? [-0.5, 0, -0.5, 0.5, 1, 0.5, -0.5, 1, 0.5, 0.5, 0, -0.5]
        : model?.positions;
    for (let index = 0; index < set.count; index++) {
      const offset = index * 10;
      const x = set.data[offset] as number,
        y = set.data[offset + 1] as number,
        z = set.data[offset + 2] as number;
      include(x, y, z);
      if (points) {
        const yaw = set.data[offset + 3] as number,
          c = Math.cos(yaw),
          s = Math.sin(yaw);
        for (let p = 0; p < points.length; p += 3) {
          const px = (points[p] as number) * (set.data[offset + 4] as number);
          const py = (points[p + 1] as number) * (set.data[offset + 5] as number);
          const pz = (points[p + 2] as number) * (set.data[offset + 6] as number);
          include(x + px * c + pz * s, y + py, z - px * s + pz * c);
        }
      }
    }
  }
  if (!Number.isFinite(min[0])) return { min: [-10, 0, -10], max: [10, 5, 10] };
  return { min, max };
}

function framePath(outPath: string, index: number, count: number): string {
  if (count <= 1) return outPath;
  const extension = extname(outPath) || '.png';
  return `${outPath.slice(0, outPath.length - extension.length)}-${String(index + 1).padStart(2, '0')}${extension}`;
}

export function previewWorldgen(input: WorldgenPreviewInput): Promise<WorldgenPreviewOutput> {
  return guardOp(
    (error) => ({ ok: false, error }),
    () => previewWorldgenImpl(input),
  );
}

async function previewWorldgenImpl(input: WorldgenPreviewInput): Promise<WorldgenPreviewOutput> {
  const loaded = await loadStylePackFromDisk(input.packPath);
  let pack: ResolvedStylePack = loaded.pack;
  let styleId = input.styleId;
  if (input.stylePath !== undefined) {
    const style: ArchStyleDoc = await loadArchStyleFromDisk(input.stylePath);
    pack = withArchStyle(pack, style);
    styleId ??= style.id;
  }
  const doc: WorldgenBatchDoc =
    input.batchPath !== undefined ? await loadBatchDoc(input.batchPath) : lineupBatchDoc();
  const batch = batchInputFromDoc(doc, pack, {
    ...(styleId !== undefined ? { styleId } : {}),
    ...(input.scatterId !== undefined ? { scatterId: input.scatterId } : {}),
    ...(input.ground !== undefined ? { ground: input.ground } : {}),
  });
  const output = generateWorldgenBatch(batch);
  if (output.buildings === undefined && output.placements.length === 0) {
    return { ok: false, error: 'nothing was generated', stats: output.stats };
  }

  const size = input.size ?? [1280, 720];
  const angles = Math.max(1, Math.floor(input.angles ?? 1));
  const bounds = worldgenPreviewBounds(output);
  const centre: [number, number, number] = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
  const extent = Math.max(
    bounds.max[0] - bounds.min[0],
    bounds.max[2] - bounds.min[2],
    bounds.max[1] - bounds.min[1],
    4,
  );
  const aspect = size[0] / size[1];
  const halfFov = (60 * Math.PI) / 360;
  const halfFovH = Math.atan(Math.tan(halfFov) * aspect);
  const elevation = 0.5;
  /** Distance that fits the bounds from a yaw, given the horizontal and vertical fields of view. */
  const distanceFor = (yaw: number): number => {
    const dx = bounds.max[0] - bounds.min[0];
    const dz = bounds.max[2] - bounds.min[2];
    const dy = bounds.max[1] - bounds.min[1];
    const across = Math.abs(dx * Math.sin(yaw)) + Math.abs(dz * Math.cos(yaw));
    const along = Math.abs(dx * Math.cos(yaw)) + Math.abs(dz * Math.sin(yaw));
    const vertical = dy * Math.cos(elevation) + along * Math.sin(elevation);
    return (
      Math.max(across / 2 / Math.tan(halfFovH), vertical / 2 / Math.tan(halfFov), 6) * 1.15 +
      along / 2
    );
  };
  const groundY = Math.min(bounds.min[1], batch.ground?.sampleHeight(centre[0], centre[2]) ?? 0);

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
    loaded.dir,
  );
  try {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`${server.url}/worldgen-preview.html`);
    const filesBaseUrl = `${server.url}/files/`;
    const scene: PreviewScenePayload = {
      ...(output.buildings !== undefined
        ? {
            buffers: {
              positions: base64Of(output.buildings.positions),
              normals: base64Of(output.buildings.normals),
              uvs: base64Of(output.buildings.uvs),
              colors: base64Of(output.buildings.colors),
              indices: base64Of(output.buildings.indices),
              groups: output.buildings.groups,
            },
          }
        : {}),
      placements: output.placements.map((set) => ({
        setId: set.setId,
        modelRef: set.modelRef,
        count: set.count,
        data: base64Of(set.data),
      })),
      filesBaseUrl,
      assetIndex: stylePackAssetIndex(pack, filesBaseUrl),
      materialRefs: stylePackMaterialRefs(pack),
      ground: {
        y: groundY,
        minX: bounds.min[0] - extent,
        minZ: bounds.min[2] - extent,
        maxX: bounds.max[0] + extent,
        maxZ: bounds.max[2] + extent,
      },
      clearColor: input.clearColor ?? '#a9c4dc',
    };
    await mkdir(dirname(input.outPath), { recursive: true });
    const frames: WorldgenPreviewFrame[] = [];
    let renderStats: WorldgenPreviewRenderStats | undefined;
    let materialFailures: string[] = [];
    for (let index = 0; index < angles; index++) {
      const yaw = (index / angles) * Math.PI * 2 + Math.PI / 2;
      const distance = distanceFor(yaw);
      const request: PreviewRequest = {
        ...(index === 0 ? { scene } : {}),
        camera: {
          position: [
            centre[0] + Math.cos(yaw) * Math.cos(elevation) * distance,
            centre[1] + Math.sin(elevation) * distance,
            centre[2] + Math.sin(yaw) * Math.cos(elevation) * distance,
          ],
          lookAt: centre,
        },
        size,
      };
      const response = (await page.evaluate(
        (r: PreviewRequest) =>
          (
            globalThis as unknown as {
              __molenWorldgenPreview: (x: unknown) => Promise<unknown>;
            }
          ).__molenWorldgenPreview(r),
        request,
      )) as PreviewResponse;
      renderStats = {
        drawCalls: response.drawCalls,
        triangles: response.triangles,
        instances: response.instances,
      };
      materialFailures = response.materialFailures;
      const path = framePath(input.outPath, index, angles);
      const buffer = await page.screenshot({
        clip: { x: 0, y: 0, width: size[0], height: size[1] },
      });
      await writeFile(path, buffer);
      frames.push({ path, yawDeg: Math.round(((yaw * 180) / Math.PI) % 360) });
    }
    if (pageErrors.length > 0) {
      return { ok: false, error: `page error: ${pageErrors.join('; ')}`, frames };
    }
    return {
      ok: true,
      frames,
      stats: output.stats,
      ...(renderStats !== undefined ? { renderStats } : {}),
      hash: output.hash,
      materialFailures,
    };
  } finally {
    await Promise.allSettled([browser.close(), server.close()]);
  }
}

/** Where a preview of the default lineup would put its frames, for callers that want a dir. */
export function previewFramePaths(outPath: string, angles: number): string[] {
  return Array.from({ length: Math.max(1, angles) }, (_, index) =>
    framePath(outPath, index, angles),
  );
}

export const WORLDGEN_PREVIEW_PAGE: string = join('capture', 'worldgen-preview.html');
