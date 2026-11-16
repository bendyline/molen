/** Terrain-fitted Ruhnu footplates and the two distant views of its open iron frame. */
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildRuhnu } from './lighthouse-baltic-next-models.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const { footings } = JSON.parse(
  readFileSync(structureSourcePath('ruhnu_lighthouse', 'fit-controls.json')),
);
const red = [0.43, 0.075, 0.049];
const granite = [0.46, 0.43, 0.35];
const bronze = [0.31, 0.23, 0.115];
const glassTint = [0.65, 0.73, 0.71];
const dark = [0.075, 0.083, 0.075];
const braceHeights = [9.1, 18.25];
const p = (radius, y, angle) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];

function fitPoint(component, point) {
  const [x, y, z] = point;
  if (y >= braceHeights[0] || Math.hypot(x, z) < 2.2) return point;
  const foot = footings.find(({ position }) => x * position[0] > 0 && z * position[1] > 0);
  if (!foot) return point;
  if (component === 'granite') return [x, y === 0 ? foot.minimum : foot.top, z];
  const weight = Math.min(1, (braceHeights[0] - y) / (braceHeights[0] - 0.49));
  return [x, y + weight * (foot.top - 0.14), z];
}

function shaftFoundation(out, sides) {
  lathe(
    out,
    'granite',
    [
      [-0.18, 1.61],
      [0.012, 1.61],
    ],
    granite,
    sides,
  );
}

export function buildRuhnuFittedMaster(out) {
  const fitGeometry = (method) => (slot, ref, points, normal, uv, color) => {
    const fitted = points.map((point) => fitPoint(slot, point));
    const adjusted = fitted.some((point, i) => point !== points[i]);
    out[method](slot, ref, fitted, adjusted ? normalFor(...fitted) : normal, uv, color);
  };
  buildRuhnu({
    addTriangle: fitGeometry('addTriangle'),
    addQuad: fitGeometry('addQuad'),
    addConvexPolygon: fitGeometry('addConvexPolygon'),
  });
  shaftFoundation(out, 48);
}

function railing(out, y, radius, height, posts) {
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts;
    const b = ((i + 1) * Math.PI * 2) / posts;
    tube(out, 'metal', p(radius, y + height, a), p(radius, y + height, b), 0.027, red, 4);
    tube(out, 'metal', p(radius, y, a), p(radius, y + height, a), 0.035, red, 4);
  }
}

function openFrame(out, district) {
  for (const foot of footings) {
    const {
      angle,
      position: [x, z],
    } = foot;
    const mount = transformed(out, angle, [x, 0, z]);
    box(mount, 'granite', [-0.67, foot.minimum, -0.67], [0.67, foot.top, 0.67], granite);
    const tubeSides = district ? 12 : 6;
    lathe(
      mount,
      'metal',
      [
        [foot.top, 0.55],
        [foot.top + 0.28, 0.4],
      ],
      red,
      tubeSides,
    );
    const base = p(6.04, foot.top + 0.09, angle);
    const cap = p(1.79, 28.35, angle);
    tube(out, 'metal', base, cap, 0.38, red, tubeSides);
    for (const y of braceHeights) {
      const t = (y - base[1]) / (cap[1] - base[1]);
      const end = base.map((value, i) => value + (cap[i] - value) * t);
      tube(out, 'metal', p(1.19, y, angle), end, 0.25, red, district ? 8 : 4);
    }
  }
}

function lantern(out, district) {
  if (!district) {
    lathe(
      out,
      'glass',
      [
        [33.86, 1.72],
        [36.2, 1.72],
      ],
      glassTint,
      8,
    );
    return;
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6;
    const pane = [p(1.72, 33.86, a), p(1.72, 33.86, b), p(1.72, 36.2, b), p(1.72, 36.2, a)];
    quad(out, 'glassClear', pane, normalFor(...pane), glassTint);
    tube(out, 'metal', p(1.73, 33.86, a), p(1.73, 36.2, a), 0.027, [0.58, 0.62, 0.55], 4);
  }
  lathe(
    out,
    'metal',
    [
      [33.82, 0.24],
      [34.98, 0.3],
    ],
    [0.78, 0.79, 0.72],
    8,
  );
}

function distantTower(out, district) {
  const sides = district ? 20 : 8;
  shaftFoundation(out, sides);
  const form = (profile, color = red) => lathe(out, 'metal', profile, color, sides);
  form([
    [0, 1.61],
    [0.17, 1.61],
    [0.47, 1.29],
    [28.45, 1.29],
  ]);
  openFrame(out, district);
  form([
    [28.2, 1.5],
    [28.45, 2.6],
    [31.11, 2.6],
    [31.21, 3.24],
    [31.32, 3.24],
  ]);
  form([
    [31.32, 1.7],
    [33.7, 1.7],
    [33.71, 2.13],
    [33.83, 2.13],
  ]);
  lantern(out, district);
  form(
    [
      [36.2, 1.81],
      [36.34, 1.75],
      [36.72, 1.62],
      [37.08, 1.25],
      [37.38, 0.14],
    ],
    bronze,
  );
  tube(out, 'metal', [0, 37.35, 0], [0, 38.34, 0], 0.041, dark, 4);
  if (district) {
    railing(out, 31.33, 3.15, 1.18, 12);
    railing(out, 33.84, 2.08, 0.86, 10);
    box(out, 'metal', [-0.49, 0.32, 1.24], [0.49, 2.38, 1.31], [0.33, 0.06, 0.04]);
    box(out, 'metal', [-0.54, 2.45, 1.18], [0.54, 2.49, 1.57], red);
  }
}

export function buildRuhnuSkyline(out) {
  distantTower(out, false);
}

export function buildRuhnuDistrict(out) {
  distantTower(out, true);
}
