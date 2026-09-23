import type { InteriorFurniture } from './interior-types';

export type InteriorFixtureBox = (
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
  material?: string,
) => void;

/** Reusable metric assemblies. Colors vary by household; silhouettes carry their purpose. */
export function buildDomesticFixture(
  kind: InteriorFurniture,
  variant: number,
  w: number,
  d: number,
  wood: string,
  accent: string,
  put: InteriorFixtureBox,
): boolean {
  const white = '#e9e7dc',
    metal = '#60696c';
  const box: InteriorFixtureBox = (x, y, z, sx, sy, sz, color, material = 'plain') =>
    put(x, y, z, sx, sy, sz, color, `interior:${material}`);
  if (kind === 'kitchen') {
    const count = Math.max(2, Math.floor(w / 0.6)),
      unit = w / count;
    for (let i = 0; i < count; i++) {
      const x = -w / 2 + (i + 0.5) * unit;
      box(x, 0.47, 0, unit - 0.025, 0.85, d, wood, 'wood');
      box(x, 0.67, -d / 2 - 0.015, unit * 0.25, 0.025, 0.035, metal);
      if (i < count - 1) {
        box(x, 1.75, d * 0.24, unit - 0.025, 0.65, d * 0.48, white, 'wood');
        box(x + unit * 0.3, 1.7, -0.01, 0.02, 0.14, 0.035, metal);
      }
    }
    box(0, 0.94, 0, w + 0.025, 0.07, d + 0.04, '#babbb4', 'ceramic');
    // Recessed-looking basin and faucet, dark hob, four burners, oven door and towel.
    box(-w * 0.25, 0.983, 0, 0.46, 0.016, d * 0.66, metal);
    box(-w * 0.25, 0.995, 0, 0.34, 0.016, d * 0.5, '#879a9c');
    box(-w * 0.25, 1.1, d * 0.35, 0.035, 0.25, 0.035, metal);
    box(-w * 0.25, 1.21, d * 0.24, 0.035, 0.035, 0.19, metal);
    box(w * 0.26, 0.985, 0, 0.52, 0.02, d * 0.78, '#30393d');
    for (const x of [-0.13, 0.13])
      for (const z of [-0.15, 0.15]) box(w * 0.26 + x, 1, z, 0.12, 0.012, 0.12, metal);
    box(w * 0.26, 0.48, -d / 2 - 0.016, 0.45, 0.44, 0.025, '#39464a');
    box(w * 0.26, 0.73, -d / 2 - 0.04, 0.4, 0.025, 0.04, metal);
    box(w * 0.26, 0.62, -d / 2 - 0.06, 0.22, 0.22, 0.02, accent, 'fabric');
  } else if (kind === 'toilet') {
    box(0, 0.17, -0.04, w * 0.5, 0.32, d * 0.5, white);
    box(0, 0.37, -d * 0.15, w * 0.87, 0.2, d * 0.7, white);
    box(0, 0.478, -d * 0.16, w * 0.65, 0.018, d * 0.5, '#707f80');
    box(0, 0.489, -d * 0.16, w * 0.46, 0.02, d * 0.34, '#c3d3d0');
    box(0, 0.64, d * 0.32, w * 0.85, 0.46, d * 0.22, white);
    box(w * 0.24, 0.78, d * 0.18, 0.065, 0.03, 0.025, metal);
  } else if (kind === 'vanity') {
    box(0, 0.43, 0, w, 0.82, d, wood, 'wood');
    box(0, 0.86, 0, w + 0.035, 0.06, d + 0.035, white);
    box(0, 0.897, -0.02, w * 0.58, 0.014, d * 0.6, '#899fa0');
    box(0, 1.01, d * 0.33, 0.035, 0.22, 0.045, metal);
    box(0, 1.49, d * 0.46, w * 0.88, 0.71, 0.055, wood);
    box(0, 1.49, d * 0.42, w * 0.77, 0.6, 0.025, '#b7cfce');
    box(w * 0.35, 0.97, -d * 0.12, 0.08, 0.14, 0.08, accent);
  } else if (kind === 'shower') {
    box(0, 0.06, 0, w, 0.1, d, white, 'ceramic');
    box(0, 1.08, d / 2 - 0.035, w, 2.05, 0.07, '#c6d3cc', 'ceramic');
    box(-w / 2 + 0.035, 1.08, 0, 0.07, 2.05, d, '#c6d3cc', 'ceramic');
    box(0, 1.37, d / 2 - 0.09, 0.035, 1.13, 0.035, metal);
    box(0, 1.94, d / 2 - 0.2, 0.22, 0.04, 0.3, metal);
    box(0, 1.05, d / 2 - 0.12, 0.17, 0.08, 0.09, metal);
    box(w * 0.32, 0.97, -d / 2 + 0.035, w * 0.35, 1.78, 0.04, accent, 'fabric');
  } else if (kind === 'wardrobe' || kind === 'dresser') {
    const h = kind === 'wardrobe' ? 2 : 0.92;
    box(0, h / 2 + 0.05, 0, w, h, d, wood, 'wood');
    const rows = kind === 'wardrobe' ? 1 : 3;
    for (let r = 0; r < rows; r++)
      for (const side of [-1, 1]) {
        box(
          (side * w) / 4,
          0.06 + ((r + 0.5) * h) / rows,
          -d / 2 - 0.013,
          w / 2 - 0.025,
          h / rows - 0.025,
          0.025,
          wood,
          'wood',
        );
        box(side * 0.055, 0.06 + ((r + 0.5) * h) / rows, -d / 2 - 0.04, 0.025, 0.12, 0.035, metal);
      }
    if (kind === 'dresser') box(0, h + 0.13, 0, w * 0.6, 0.15, d * 0.58, accent, 'fabric');
  } else if (kind === 'coffee-table') {
    box(0, 0.41, 0, w, 0.07, d, wood, 'wood');
    for (const x of [-w * 0.4, w * 0.4])
      for (const z of [-d * 0.35, d * 0.35]) box(x, 0.2, z, 0.065, 0.4, 0.065, wood);
    box(-w * 0.2, 0.47, 0, 0.24, 0.055, 0.3, accent);
    box(w * 0.25, 0.51, 0, 0.1, 0.14, 0.1, white);
  } else if (kind === 'bookcase') {
    box(0, 0.85, d / 2 - 0.03, w, 1.7, 0.06, wood, 'wood');
    for (const x of [-w / 2 + 0.03, w / 2 - 0.03]) box(x, 0.85, 0, 0.06, 1.7, d, wood, 'wood');
    for (let row = 0; row < 4; row++) {
      box(0, 0.08 + row * 0.42, 0, w, 0.06, d, wood, 'wood');
      for (let i = 0; i < 5; i++)
        box(
          -w * 0.35 + i * w * 0.145,
          0.25 + row * 0.42,
          0,
          w * 0.1,
          0.22 + ((i + row + variant) % 3) * 0.035,
          d * 0.65,
          ['#956448', '#687e72', '#c5b48c', '#597284'][(i + row + variant) % 4] as string,
        );
    }
  } else if (kind === 'plant') {
    box(0, 0.15, 0, w * 0.65, 0.3, d * 0.65, '#a37557');
    box(0, 0.39, 0, 0.055, 0.45, 0.055, '#6c6344');
    for (let i = 0; i < 3; i++)
      box(
        (i - 1) * w * 0.14,
        0.4 + i * 0.12,
        ((i % 2) - 0.5) * d * 0.3,
        w * 0.55,
        0.12,
        d * 0.55,
        ['#54735a', '#6d875e', '#758d65'][i] as string,
      );
  } else if (kind === 'rug') {
    box(0, 0.006, 0, w, 0.008, d, accent, 'fabric');
    for (const z of [-d / 2 + 0.1, d / 2 - 0.1])
      box(0, 0.011, z, w * 0.95, 0.003, 0.08, '#bfae88', 'fabric');
  } else return false;
  return true;
}
