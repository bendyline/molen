import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { applyUvPaint, type RGBAImage } from '@bendyline/molen-materials';
import { PNG } from 'pngjs';

function pngToImage(buf: Uint8Array): RGBAImage {
  const png = PNG.sync.read(Buffer.from(buf));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

function imageToPng(img: RGBAImage): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}

export interface ApplyUvPaintInput {
  /** Painted texture (from an image model). */
  paintedPath: string;
  /** Island map (flat-filled islands on a transparent/black background). */
  islandMapPath: string;
  outPath: string;
  maskToIslands?: boolean;
  dilationPx?: number;
}

export interface ApplyUvPaintOutput {
  ok: boolean;
  imagePath?: string;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Import a painted UV template: mask it to the island map and dilate the gutters
 * (docs-src/guide/materials.md, "Rung 5 — UV paint-by-numbers"). The MCP `apply_uv_paint` tool.
 * (Template/sidecar generation from a mesh via xatlas is a separate, heavier Node toolchain
 * step.)
 */
export async function applyUvPaintOp(input: ApplyUvPaintInput): Promise<ApplyUvPaintOutput> {
  let painted: RGBAImage;
  let islandMap: RGBAImage;
  try {
    painted = pngToImage(await readFile(input.paintedPath));
    islandMap = pngToImage(await readFile(input.islandMapPath));
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  let result: RGBAImage;
  try {
    result = applyUvPaint(painted, islandMap, {
      ...(input.maskToIslands !== undefined ? { maskToIslands: input.maskToIslands } : {}),
      ...(input.dilationPx !== undefined ? { dilationPx: input.dilationPx } : {}),
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await mkdir(dirname(input.outPath), { recursive: true });
  await writeFile(input.outPath, imageToPng(result));
  return { ok: true, imagePath: input.outPath, width: result.width, height: result.height };
}
