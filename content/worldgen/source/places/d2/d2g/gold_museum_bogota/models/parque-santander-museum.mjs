import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_travertine', roughness: 0.91 },
  soffit: { slot: 'trim', graph: 'concrete_panel', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.71 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  floor: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
};
const frame = facade(site.frame.origin, site.frame.along);
const plaza = facade([0, 0], [1, 0]);
const { width } = site.frame;
const { canopy, roofHeight, sign } = site;
const stone = rgb('d6d1c4'),
  ecru = rgb('c2bdb0'),
  concrete = rgb('a7a197');
const glass = rgb('676f64'),
  darkGlass = rgb('4c5851'),
  brass = rgb('b7a276');
const blackMetal = rgb('626760'),
  capstone = rgb('a8a8a0'),
  paving = rgb('a29488');
const shell = outwardRing(site.plan);

function face(out, slot, f, a, b, low, high, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, low, d), p(b, low, d), p(b, high, d), p(a, high, d), color);
}

function wallBands(out, detail, f, a, b, y0, y1) {
  face(out, 'stone', f, a, b, y0, y1, 0, stone);
  if (detail < 2 || b - a < 3) return;
  const rows = Math.ceil((y1 - y0) / 2.05);
  const cols = Math.ceil((b - a) / 1.86);
  const span = (b - a) / cols;
  for (let row = 1; row < rows; row++) {
    const y = y0 + ((y1 - y0) * row) / rows;
    face(out, 'soffit', f, a, b, y, y + 0.018, 0.018, ecru);
    if (detail === 2) continue;
    for (let j = 0; j < cols; j++) {
      const u = a + span * (j + (row % 2 ? 0.52 : 0.01));
      face(out, 'soffit', f, u, u + 0.012, y, y + (y1 - y0) / rows, 0.019, ecru);
    }
  }
}

const oval = Array.from({ length: 13 }, (_, i) => {
  const t = (i * Math.PI) / 6;
  return [0.44 + 0.43 * Math.cos(t), 0.51 + 0.48 * Math.sin(t)];
});
const letters = {
  m: [
    [
      [0.03, 0],
      [0.03, 0.95],
    ],
    [
      [0.03, 0.64],
      [0.25, 0.95],
      [0.48, 0.94],
      [0.6, 0.74],
      [0.6, 0],
    ],
    [
      [0.6, 0.64],
      [0.81, 0.95],
      [1.03, 0.93],
      [1.16, 0.72],
      [1.16, 0],
    ],
  ],
  u: [
    [
      [0.05, 0.96],
      [0.05, 0.28],
      [0.17, 0.09],
      [0.36, 0.025],
      [0.61, 0.08],
      [0.8, 0.3],
      [0.8, 0.96],
    ],
    [
      [0.8, 0.25],
      [0.8, 0.03],
    ],
  ],
  s: [
    [
      [0.78, 0.81],
      [0.63, 0.96],
      [0.37, 0.97],
      [0.17, 0.88],
      [0.11, 0.73],
      [0.27, 0.57],
      [0.59, 0.48],
      [0.74, 0.33],
      [0.74, 0.17],
      [0.56, 0.052],
      [0.32, 0.039],
      [0.09, 0.18],
    ],
  ],
  e: [
    [
      [0.12, 0.52],
      [0.8, 0.52],
      [0.77, 0.72],
      [0.61, 0.9],
      [0.4, 0.97],
      [0.18, 0.84],
      [0.06, 0.58],
      [0.08, 0.33],
      [0.18, 0.15],
      [0.37, 0.04],
      [0.63, 0.06],
      [0.8, 0.21],
    ],
  ],
  o: [oval],
  d: [
    oval,
    [
      [0.86, 0.03],
      [0.86, 1.37],
    ],
  ],
  l: [
    [
      [0.15, 0.03],
      [0.15, 1.35],
    ],
  ],
  r: [
    [
      [0.11, 0.02],
      [0.11, 0.94],
    ],
    [
      [0.11, 0.6],
      [0.27, 0.84],
      [0.49, 0.91],
      [0.61, 0.89],
    ],
  ],
};

function lettering(out, detail) {
  if (detail === 0) return;
  const text = 'museo del oro';
  const size = { m: 1.4, l: 0.38, r: 0.74, ' ': 0.56 };
  const total = [...text].reduce((sum, char) => sum + (size[char] ?? 1.03), 0);
  const du = (width - 4.25) / total;
  let start = 2.12;
  for (const char of text) {
    for (const path of letters[char] ?? []) {
      for (let j = 1; j < path.length; j++) {
        const point = ([x, y]) => plaza.P(start + x * du, sign[0] + 0.17 + y * 1.23, -0.074);
        beam(
          out,
          'bronze',
          point(path[j - 1]),
          point(path[j]),
          detail < 2 ? 0.133 : 0.104,
          0.081,
          brass,
        );
      }
    }
    start += du * (size[char] ?? 1.03);
  }
}

function hall(out, detail) {
  for (const [i, a] of shell.entries()) {
    const b = shell[(i + 1) % shell.length],
      f = wallFace(a, b);
    const l = f.length;
    if (l < 0.022 || Math.max(Math.abs(a[1]), Math.abs(b[1])) < 0.041) continue;
    wallBands(out, detail, f, 0, l, canopy, roofHeight);
    if (detail > 0 && l > 30 && f.normal[0] < -0.32)
      face(out, 'glass', f, l * 0.43, l * 0.57, 7.45, 8.15, 0.037, darkGlass);
  }
  wallBands(out, detail, plaza, 0, width, canopy, sign[0]);
  wallBands(out, detail, plaza, 0, width, sign[1], roofHeight);
  face(out, 'glass', plaza, 0, width, sign[0], sign[1], -0.49, darkGlass);
  for (const y of [sign[0], sign[1] - 0.094])
    fbox(out, 'stone', plaza, 0, width, y, y + 0.094, -0.5, 0.04, ecru);
  cap(out, 'soffit', shell, canopy, concrete);
  cap(
    deform(out, ([x, , z]) => [-x, canopy - 0.019, z]),
    'soffit',
    shell.map(([x, z]) => [-x, z]),
    0,
    concrete,
  );
  cap(out, 'roof', shell, roofHeight, capstone);
  lettering(out, detail);
  if (detail > 0) {
    for (const [a, b, d] of [
      [6.1, 11.8, -34.4],
      [15.1, 20.8, -42.2],
    ]) {
      fbox(
        out,
        'roof',
        plaza,
        a,
        b,
        roofHeight - 0.02,
        roofHeight + 0.68,
        d - 1.15,
        d + 1.15,
        capstone,
      );
      for (let i = 1; i < 5; i++) {
        const u = a + ((b - a) * i) / 5;
        fbox(
          out,
          'frame',
          plaza,
          u - 0.19,
          u + 0.19,
          roofHeight + 0.14,
          roofHeight + 0.54,
          d + 1.15,
          d + 1.19,
          blackMetal,
        );
      }
    }
  }
}

function foyer(out, detail) {
  const endDepth = Math.min(...shell.map(([, z]) => z)) + 0.51;
  const walls = outwardRing([
    [0.68, -3.96],
    [width - 0.64, -3.96],
    [width - 0.65, endDepth],
    [0.68, endDepth],
  ]);
  for (const [i, a] of walls.entries()) {
    const b = walls[(i + 1) % walls.length],
      f = wallFace(a, b),
      l = f.length;
    const slot = f.normal[1] > 0.8 || f.normal[0] < -0.9 ? 'glass' : 'stone';
    face(out, 'floor', f, 0, l, site.foundationBottom, 0.28, 0, paving);
    face(out, slot, f, 0, l, 0.28, canopy, 0, slot === 'glass' ? glass : stone);
    if (slot !== 'glass' || detail === 0) continue;
    const n = Math.ceil(l / 2.28);
    for (let j = 1; j < n; j++) {
      const u = (l * j) / n;
      fbox(out, 'frame', f, u - 0.033, u + 0.033, 0.28, canopy, 0.01, 0.075, blackMetal);
    }
  }
  fbox(out, 'floor', plaza, 0.02, width - 0.01, -0.36, 0.27, -4.22, 0.35, paving);
  for (const ratio of [0.15, 0.42, 0.71, 0.91]) {
    const u = width * ratio;
    fbox(out, 'soffit', plaza, u - 0.22, u + 0.22, -0.05, canopy, -2.25, -1.76, concrete);
  }
  if (detail > 1)
    for (let i = 0; i < 11; i++) {
      const u = ((i + 0.53) * width) / 11;
      fbox(
        out,
        'bronze',
        plaza,
        u - 0.13,
        u + 0.13,
        canopy - 0.082,
        canopy + 0.012,
        -0.94,
        -0.72,
        brass,
      );
    }
}

function build(out, detail) {
  const local = deform(out, ([x, y, z]) => frame.P(x, y, z));
  hall(local, detail);
  foyer(local, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
