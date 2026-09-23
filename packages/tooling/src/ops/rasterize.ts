import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import {
  type BakedMaterial,
  bakeMatGraph,
  bakePalette,
  bakePixelGrid,
  bakeSvg,
  type MatGraphDoc,
  type PixelGridDoc,
  type RGBAImage,
} from '@bendyline/molen-materials';
import { detectKind, validateByKind } from '@bendyline/molen-schema';
import { PNG } from 'pngjs';

export interface RasterizeInput {
  /** Path to a material doc (*.matgraph.json, *.pixelgrid.json, or *.svg) or inline doc. */
  path?: string;
  inline?: unknown;
  /** Or a "palette:#rrggbb" / "#rrggbb" inline material ref. */
  ref?: string;
  /** Output PNG path for the baseColor slot. */
  outPath: string;
  /** Optional override size for palette refs / SVG raster width. */
  size?: number;
}

export interface RasterizeOutput {
  ok: boolean;
  imagePath?: string;
  width?: number;
  height?: number;
  slots?: string[];
  error?: string;
}

function toPng(img: RGBAImage): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength);
  return PNG.sync.write(png);
}

/** Bake a material (graph or palette) to a PNG. The MCP `rasterize_material` tool. */
export async function rasterizeMaterial(input: RasterizeInput): Promise<RasterizeOutput> {
  let baked: BakedMaterial | undefined;

  if (input.ref !== undefined) {
    baked = bakePalette(input.ref, input.size ?? 4);
    if (baked === undefined) return { ok: false, error: `not a palette ref: "${input.ref}"` };
  } else if (input.path?.endsWith('.svg') === true) {
    try {
      const svgText = await readFile(input.path, 'utf8');
      baked = await bakeSvg(
        svgText,
        input.size !== undefined ? { rasterSize: [input.size, input.size] } : {},
      );
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  } else {
    let data: unknown = input.inline;
    if (input.path !== undefined) {
      try {
        data = JSON.parse(await readFile(input.path, 'utf8'));
      } catch (e) {
        return { ok: false, error: `${input.path}: ${(e as Error).message}` };
      }
    }
    const kind = detectKind(data);
    if (kind !== 'matgraph' && kind !== 'pixelgrid') {
      return {
        ok: false,
        error: `expected a matgraph or pixelgrid document (got kind "${kind ?? 'unknown'}")`,
      };
    }
    const v = validateByKind(kind, data);
    if (!v.ok) return { ok: false, error: v.formatted };
    try {
      baked =
        kind === 'matgraph'
          ? bakeMatGraph(v.value as MatGraphDoc)
          : bakePixelGrid(v.value as PixelGridDoc);
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  const base = baked.slots.baseColor;
  if (base === undefined) return { ok: false, error: 'material produced no baseColor slot' };

  await mkdir(dirname(input.outPath), { recursive: true });
  await writeFile(input.outPath, toPng(base));
  return {
    ok: true,
    imagePath: input.outPath,
    width: base.width,
    height: base.height,
    slots: Object.keys(baked.slots),
  };
}
