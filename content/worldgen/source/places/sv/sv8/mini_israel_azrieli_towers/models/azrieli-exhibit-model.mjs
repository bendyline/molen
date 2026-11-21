import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  panes: { slot: 'window', graph: 'window_grid', roughness: 0.58, metallic: 0.08 },
  podium: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.16 },
  canopy: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.08 },
  beds: { slot: 'foundation', graph: 'gravel', roughness: 0.99, metallic: 0 },
};

const ref = 'palette:#ffffff';
const glass = [0.48, 0.57, 0.62];
const zinc = [0.65, 0.65, 0.59];
const plaster = [0.64, 0.612, 0.414];
const sill = [0.43, 0.43, 0.32];
const gold = [0.68, 0.47, 0.143];
const blue = [0.17, 0.34, 0.49];
const ballast = [0.37, 0.312, 0.225];
const baseY = 0.17;

const lift = (ring, y) => ring.map(([x, , z]) => [x, y, z]);
const addBox = (out, slot, x0, y0, z0, x1, y1, z1, color) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], color);

function rectangle(cx, cz, width, depth) {
  return [
    [cx + width / 2, 0, cz + depth / 2],
    [cx + width / 2, 0, cz - depth / 2],
    [cx - width / 2, 0, cz - depth / 2],
    [cx - width / 2, 0, cz + depth / 2],
  ];
}

function windowWall(out, outline, top, rowCount, halfPane) {
  const lower = lift(outline, baseY);
  const upper = lift(outline, top);
  let travel = 0;
  for (let i = 0; i < outline.length; i++) {
    const k = (i + 1) % outline.length;
    const p = [lower[i], lower[k], upper[k], upper[i]];
    const width = Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]);
    const next = travel + width / halfPane;
    out.addQuad(
      'panes',
      'metric:uv',
      p,
      normalFor(...p),
      [
        [travel, 0],
        [next, 0],
        [next, rowCount],
        [travel, rowCount],
      ],
      glass,
    );
    travel = next;
  }
}

function tower(out, outline, height, rows, level) {
  const top = baseY + height;
  windowWall(out, outline, top, rows, 0.17);
  loft(out, 'metal', [lift(outline, top), lift(outline, top + 0.046)], zinc);
  if (level < 2) return;
  const center = outline.reduce(
    ([x, z], [a, , b]) => [x + a / outline.length, z + b / outline.length],
    [0, 0],
  );
  const [x, z] = center;
  addBox(out, 'canopy', x - 0.27, top + 0.04, z - 0.21, x + 0.29, top + 0.152, z + 0.22, sill);
  addBox(out, 'metal', x - 0.14, top + 0.152, z - 0.12, x + 0.14, top + 0.186, z + 0.13, zinc);
}

function towers(out, level) {
  const points = [level >= 3 ? 48 : level >= 1 ? 32 : 18, 3];
  const round = radialRing(0, 0.88, 0.88, points[0], [-0.22, -0.95]);
  const triangle = radialRing(0, 1.09, 1.09, points[1], [-2.02, 0.38], -Math.PI / 2);
  const square = rectangle(2.0, 0.44, 1.32, 1.32);
  tower(out, round, 7.48, 50, level);
  tower(out, triangle, 6.76, 47, level);
  tower(out, square, 6.16, 43, level);
}

function exhibitionBase(out, level) {
  addBox(out, 'deck', -3.72, -0.31, -2.28, 3.8, 0.145, 2.94, [0.65, 0.64, 0.552]);
  addBox(out, 'podium', -3.69, 0.134, -2.26, 3.77, 0.17, 1.89, [0.72, 0.687, 0.58]);
  const foot = 0.51;
  const cap = 1.37;
  const ranges = [
    [-3.56, -2.78, -1.69, 1.33],
    [0.59, 2.98, -1.96, 0.1],
  ];
  for (const [x0, x1, z0, z1] of ranges) {
    addBox(out, 'panes', x0 + 0.055, baseY, z0 + 0.045, x1 - 0.055, foot + 0.05, z1 - 0.045, glass);
    addBox(out, 'podium', x0, foot, z0, x1, cap, z1, plaster);
    addBox(out, 'canopy', x0 - 0.022, cap, z0 - 0.02, x1 + 0.022, cap + 0.035, z1 + 0.02, zinc);
    if (level < 1) continue;
    for (let y = foot + 0.12; y < cap - 0.1; y += 0.157)
      addBox(out, 'metal', x0 - 0.004, y, z0 - 0.004, x1 + 0.004, y + 0.008, z1 + 0.004, sill);
  }
  const center = [0.94, -0.82];
  const sides = level >= 2 ? 24 : 10;
  loft(
    out,
    'canopy',
    [
      radialRing(cap + 0.018, 0.47, 0.42, sides, center),
      radialRing(cap + 0.14, 0.42, 0.37, sides, center),
      radialRing(cap + 0.245, 0.28, 0.26, sides, center),
      radialRing(cap + 0.276, 0.085, 0.08, sides, center),
    ],
    gold,
  );
}

function railway(out, level) {
  addBox(out, 'beds', -3.7, baseY, 2.31, 3.78, 0.195, 2.78, ballast);
  for (const mid of [2.435, 2.654]) {
    for (const dz of [-0.035, 0.035])
      addBox(out, 'metal', -3.68, 0.194, mid + dz - 0.004, 3.77, 0.216, mid + dz + 0.004, zinc);
    if (level >= 3)
      for (let x = -3.63; x < 3.75; x += 0.13)
        addBox(out, 'beds', x - 0.006, 0.195, mid - 0.055, x + 0.006, 0.204, mid + 0.055, ballast);
  }
  addBox(out, 'deck', -0.22, baseY, 2.195, 2.9, 0.24, 2.31, plaster);
  addBox(out, 'deck', -0.22, baseY, 2.783, 2.9, 0.24, 2.904, plaster);
  const y = 0.71,
    end = 2.85,
    start = 0.58;
  const roof = (x, z) => [x, y + 0.125 * Math.sin(((x - start) / (end - start)) * Math.PI), z];
  const spans = level >= 2 ? 12 : 4;
  for (let i = 0; i < spans; i++) {
    const a = start + ((end - start) * i) / spans,
      b = start + ((end - start) * (i + 1)) / spans;
    const p = [roof(a, 2.26), roof(a, 2.87), roof(b, 2.87), roof(b, 2.26)];
    out.addQuad('canopy', ref, p, normalFor(...p), [], gold);
  }
  for (const x of [start, 1.34, 2.1, end])
    for (const z of [2.28, 2.855]) beam(out, 'metal', [x, 0.24, z], roof(x, z), 0.026, 0.026, sill);
  if (level === 0) return;
  for (const x of [1.22, 1.68]) {
    beam(out, 'metal', [x, 0.45, 2.008], [x, 0.45, 2.92], 0.038, 0.04, blue);
    beam(out, 'metal', [x, 0.708, 2.008], [x, 0.708, 2.92], 0.019, 0.023, blue);
    for (let i = 0; i < 5; i++) {
      const z = 2.008 + (0.912 * i) / 5;
      beam(
        out,
        'metal',
        [x, 0.45 + (i % 2) * 0.258, z],
        [x, 0.45 + ((i + 1) % 2) * 0.258, z + 0.912 / 5],
        0.021,
        0.02,
        blue,
      );
    }
  }
}

function planting(out, level) {
  if (level < 1) return;
  const lawn = [0.325, 0.402, 0.177];
  for (const [x, z] of [
    [-3.33, 1.25],
    [-1.47, 1.6],
    [-0.77, 1.33],
    [0.46, 1.01],
    [2.56, 1.57],
    [3.2, 0.2],
  ]) {
    addBox(out, 'beds', x - 0.158, baseY, z - 0.122, x + 0.158, baseY + 0.047, z + 0.12, lawn);
    if (level >= 2) sphere(out, 'beds', [x, baseY + 0.132, z], [0.105, 0.112, 0.093], lawn, 8, 5);
  }
}

function build(out, level) {
  exhibitionBase(out, level);
  towers(out, level);
  railway(out, level);
  planting(out, level);
}

export const buildAzrieliExhibit = (out) => build(out, 4);
export const buildCloseup = (out) => build(out, 3);
export const buildStreet = (out) => build(out, 2);
export const buildDistrict = (out) => build(out, 1);
export const buildSkyline = (out) => build(out, 0);
