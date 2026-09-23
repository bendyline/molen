import type { PixelGridDoc } from './pixelgrid-types';
import { type BakedMaterial, createImage, type MaterialSlot, type RGBAImage } from './types';

function parseColor(value: string): [number, number, number, number] {
  if (value === 'transparent') return [0, 0, 0, 0];
  const h = value.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
    h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) : 255,
  ];
}

/**
 * Rasterize a pixel-grid document into every slot its `slots` block enables (rung 2). One char =
 * one texel; nearest filter; transparent palette entries become an alphaTest cutout. Validation
 * errors quote row/column.
 *
 * The enabled slots share one image: nothing in the pipeline mutates a baked slot (the client
 * copies the buffer into a DataTexture, the bake worker de-duplicates buffers before transfer,
 * the PNG writer only reads), so one grid is rasterized once however many slots point at it.
 */
export function bakePixelGrid(doc: PixelGridDoc): BakedMaterial {
  const enabled = doc.slots;
  if (enabled === undefined) {
    throw new Error(
      'pixelgrid document has no slots block — validate it first (molen/pixelgrid@1 defaults to { baseColor: true, emissive: false })',
    );
  }
  if (enabled.baseColor !== true && enabled.emissive !== true) {
    throw new Error('pixelgrid has every slot disabled — enable slots.baseColor or slots.emissive');
  }
  const [w, h] = doc.size;
  if (doc.rows.length !== h) {
    throw new Error(`pixelgrid has ${doc.rows.length} rows, expected ${h} (size height)`);
  }
  const colors = new Map<string, [number, number, number, number]>();
  for (const [key, value] of Object.entries(doc.palette)) {
    if (value !== 'transparent' && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
      throw new Error(
        `palette entry "${key}" has invalid color "${value}" (expected transparent or #rrggbb[aa])`,
      );
    }
    colors.set(key, parseColor(value));
  }

  const img = createImage(w, h);
  let hasTransparent = false;
  for (let y = 0; y < h; y++) {
    const row = doc.rows[y] as string;
    const chars = [...row];
    if (chars.length !== w) {
      throw new Error(`row ${y} has ${chars.length} chars, expected ${w}; row: "${row}"`);
    }
    for (let x = 0; x < w; x++) {
      const ch = chars[x] as string;
      const c = colors.get(ch);
      if (c === undefined) {
        throw new Error(
          `char "${ch}" at row ${y} col ${x} is not in the palette — keys are: ${[...colors.keys()].join(' ')}`,
        );
      }
      if (c[3] === 0) hasTransparent = true;
      const p = (y * w + x) * 4;
      img.data[p] = c[0];
      img.data[p + 1] = c[1];
      img.data[p + 2] = c[2];
      img.data[p + 3] = c[3];
    }
  }

  const slots: Partial<Record<MaterialSlot, RGBAImage>> = {};
  if (enabled.baseColor) slots.baseColor = img;
  if (enabled.emissive) slots.emissive = img;

  return {
    slots,
    meta: { filter: doc.filter, ...(hasTransparent ? { alphaTest: 0.5 } : {}) },
  };
}
