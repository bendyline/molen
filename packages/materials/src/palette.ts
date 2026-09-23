import { type BakedMaterial, createImage } from './types';

function parseHex(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
    h.length >= 8 ? Number.parseInt(h.slice(6, 8), 16) : 255,
  ];
}

/** Rung 1: a flat palette color → a solid baseColor texture. Accepts "palette:#rrggbb" or "#rrggbb". */
export function bakePalette(ref: string, size = 4): BakedMaterial | undefined {
  const hex = ref.startsWith('palette:') ? ref.slice('palette:'.length) : ref;
  if (!/^#?[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return undefined;
  const [r, g, b, a] = parseHex(hex.startsWith('#') ? hex : `#${hex}`);
  const img = createImage(size, size);
  for (let i = 0; i < size * size; i++) {
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = a;
  }
  return { slots: { baseColor: img }, meta: { filter: 'nearest' } };
}
