/** Individually reviewed Landmark 81: stepped bamboo modules, podium atrium and mapped spire. */
import { readFileSync } from 'node:fs';
import { beam, loft } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0163_landmark_81',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  parts = partsEvidence(key),
  white = [0.74, 0.78, 0.77],
  blue = [0.3, 0.42, 0.46];
export const landmark81Grid = map.orientationControl;
export const landmark81Heights = [
  [60, 120, 170, 140, 89, 65],
  [105, 265, 300, 257, 192, 102],
  [183, 400.2, 400.2, 310, 223, 134],
  [210, 400.2, 400.2, 320, 238, 148],
  [170, 280, 305, 269, 185, 90],
  [18, 18, 86, 130, 93, 62],
];
export const landmark81At = (x, z) => [
  landmark81Grid.towerCenter[0] + landmark81Grid.gridU[0] * x + landmark81Grid.gridV[0] * z,
  landmark81Grid.towerCenter[1] + landmark81Grid.gridU[1] * x + landmark81Grid.gridV[1] * z,
];
const settings = {
  source: {
    floors: 4.05,
    columns: 1.8,
    edges: true,
    rails: true,
    trees: 12,
    atrium: 24,
    spireRows: 16,
  },
  closeup: {
    floors: 4.05,
    columns: 1.8,
    edges: true,
    rails: true,
    trees: 12,
    atrium: 24,
    spireRows: 16,
  },
  street: {
    floors: 8.1,
    columns: 4.5,
    edges: true,
    rails: false,
    trees: 6,
    atrium: 16,
    spireRows: 8,
  },
  district: {
    floors: 64,
    columns: 0,
    edges: true,
    rails: false,
    trees: 4,
    atrium: 12,
    spireRows: 4,
  },
  skyline: { floors: 0, columns: 0, edges: false, rails: false, trees: 0, atrium: 8, spireRows: 0 },
};
const edges = (plan) =>
  plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
  });
const square = (x, z, r = 4.5) =>
  clockwise([
    landmark81At(x - r, z - r),
    landmark81At(x + r, z - r),
    landmark81At(x + r, z + r),
    landmark81At(x - r, z + r),
  ]);
function wall(out, a, b, lo, hi, c, level) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len],
    at = (t, y, lift = 0) =>
      shift([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], n, lift);
  face(
    out,
    'glass',
    [at(0, lo), at(1, lo), at(1, hi), at(0, hi)],
    level === 'skyline' ? [0.4, 0.5, 0.53] : blue,
  );
  if (c.floors) {
    const first = Math.ceil((lo - 14.4) / c.floors);
    for (let i = first; 14.4 + i * c.floors < hi; i++) {
      const y = 14.4 + i * c.floors;
      if (y <= lo + 0.1) continue;
      face(
        out,
        'metal',
        [
          at(0, Math.max(lo, y - 0.45), 0.035),
          at(1, Math.max(lo, y - 0.45), 0.035),
          at(1, y, 0.035),
          at(0, y, 0.035),
        ],
        white,
      );
    }
  }
  if (c.columns) {
    const count = Math.max(1, Math.ceil(len / c.columns)),
      half = 0.18 / len;
    for (let i = 1; i < count; i++)
      face(
        out,
        'metal',
        [
          at(i / count - half, lo, 0.05),
          at(i / count + half, lo, 0.05),
          at(i / count + half, hi, 0.05),
          at(i / count - half, hi, 0.05),
        ],
        white,
      );
  }
  // Full-height facade strips preserve the module edge rhythm without tiny closed parts.
  if (c.edges)
    for (const t of [0, 1]) {
      const a = Math.max(0, t - 0.045),
        b = Math.min(1, t + 0.045);
      face(
        out,
        'metal',
        [at(a, lo, 0.09), at(b, lo, 0.09), at(b, hi, 0.09), at(a, hi, 0.09)],
        white,
      );
    }
}
function tree(out, p, y, height, sides) {
  if (!sides) return;
  const ring = (h, r) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-i * 2 * Math.PI) / sides;
      return [p[0] + Math.cos(a) * r, y + h, p[1] + Math.sin(a) * r * 0.9];
    });
  loft(
    out,
    'recess',
    [ring(height * 0.25, height * 0.22), ring(height * 0.65, height * 0.35), ring(height, 0.1)],
    [0.2, 0.29, 0.13],
  );
  if (sides >= 6)
    beam(
      out,
      'metal',
      [p[0], y, p[1]],
      [p[0], y + height * 0.6, p[1]],
      0.22,
      0.22,
      [0.28, 0.23, 0.17],
    );
}
function planter(out, x, z, y, c) {
  const p = square(x, z, 1.3);
  mappedSolid(out, 'concrete', p, y, y + 0.5, [0.57, 0.62, 0.54]);
  const center = landmark81At(x, z);
  tree(out, center, y + 0.5, 2.5, c.trees);
}
function modules(out, c, level) {
  const _neighbors = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 9,
        z = (row - 2.5) * 9,
        hi = landmark81Heights[row][col],
        p = square(x, z);
      // Touching modules make one coherent bundle. Omit walls hidden behind taller
      // neighbors; the exposed portion begins at that neighbor's roof.
      for (let j = 0; j < p.length; j++) {
        const a = p[j],
          b = p[(j + 1) % p.length],
          mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
          center = landmark81At(x, z),
          dx = mid[0] - center[0],
          dz = mid[1] - center[1],
          gx = dx * landmark81Grid.gridU[0] + dz * landmark81Grid.gridU[1],
          gz = dx * landmark81Grid.gridV[0] + dz * landmark81Grid.gridV[1];
        const dc = Math.abs(gx) > Math.abs(gz) ? Math.sign(gx) : 0,
          dr = dc ? 0 : Math.sign(gz),
          neighbor = landmark81Heights[row + dr]?.[col + dc],
          lo = Math.max(14.4, neighbor ?? 14.4);
        if (lo < hi - 0.001) wall(out, a, b, lo, hi, c, level);
      }
      mappedCap(out, 'concrete', p, hi, [0.67, 0.72, 0.66]);
      if (level === 'skyline') continue;
      for (const { a, b } of edges(p)) {
        const y = hi + 0.18;
        face(
          out,
          'metal',
          [
            [a[0], hi, a[1]],
            [b[0], hi, b[1]],
            [b[0], y, b[1]],
            [a[0], y, a[1]],
          ],
          white,
        );
        if (hi < 250 && c.rails) {
          beam(
            out,
            'metal',
            [a[0], hi + 1.1, a[1]],
            [b[0], hi + 1.1, b[1]],
            0.12,
            0.12,
            [0.58, 0.66, 0.66],
          );
          for (const t of [0, 0.5]) {
            const q = lerp(a, b, t);
            beam(
              out,
              'metal',
              [q[0], hi, q[1]],
              [q[0], hi + 1.1, q[1]],
              0.1,
              0.1,
              [0.58, 0.66, 0.66],
            );
          }
        }
      }
      if (hi < 250) planter(out, x, z, hi, c);
    }
}
function spire(out, c, level) {
  const raw = partPlan(
      map,
      parts.find((p) => p.id === 622296618),
    ),
    center = landmark81Grid.mastCenter,
    plan = raw.map((p) => lerp(p, center, 0.12));
  for (const { a, b, n, len } of edges(plan)) {
    const at = (t, y, lift = 0) =>
      shift([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], n, lift);
    face(out, 'metal', [at(0, 400.2), at(1, 400.2), at(1, 461.2), at(0, 461.2)], [0.52, 0.6, 0.61]);
    for (let i = 0; i <= c.spireRows && c.spireRows; i++) {
      const y = 400.2 + (61 * i) / c.spireRows,
        h = level === 'district' ? 0.45 : 0.18;
      face(
        out,
        'metal',
        [
          at(0, Math.max(400.2, y - h), 0.035),
          at(1, Math.max(400.2, y - h), 0.035),
          at(1, Math.min(461.2, y + h), 0.035),
          at(0, Math.min(461.2, y + h), 0.035),
        ],
        [0.81, 0.84, 0.83],
      );
    }
    if (level !== 'skyline')
      for (const t of [0, 1]) {
        const l = Math.max(0, t - 0.1 / len),
          r = Math.min(1, t + 0.1 / len);
        face(
          out,
          'metal',
          [at(l, 400.2, 0.07), at(r, 400.2, 0.07), at(r, 461.2, 0.07), at(l, 461.2, 0.07)],
          [0.84, 0.87, 0.86],
        );
      }
    if (level === 'source' || level === 'closeup')
      for (let t = 1; t < 4; t++) {
        const l = t / 4 - 0.045 / len,
          r = t / 4 + 0.045 / len;
        face(
          out,
          'metal',
          [at(l, 400.2, 0.045), at(r, 400.2, 0.045), at(r, 461.2, 0.045), at(l, 461.2, 0.045)],
          [0.74, 0.78, 0.78],
        );
      }
  }
  mappedCap(out, 'metal', plan, 461.2, [0.77, 0.82, 0.83]);
}
function atrium(out, c, level) {
  const at = (angle, y, scale) => {
      const p = landmark81At(
        -32 + 5.5 * Math.cos(angle) * scale,
        6 + 13.5 * Math.sin(angle) * scale,
      );
      return [p[0], y, p[1]];
    },
    profile = [
      [14.4, 1],
      [16.7, 0.82],
      [18.2, 0.42],
      [18.6, 0.03],
    ],
    rings = profile.map(([y, r]) =>
      Array.from({ length: c.atrium }, (_, i) => at((-i * 2 * Math.PI) / c.atrium, y, r)),
    );
  loft(out, 'clear_glass', rings, [0.61, 0.77, 0.8], { cap: false });
  const top = rings.at(-1);
  mappedCap(
    out,
    'metal',
    top.map((p) => [p[0], p[2]]),
    18.6,
    [0.61, 0.69, 0.7],
  );
  if (level !== 'skyline')
    for (let i = 0; i < c.atrium; i += level === 'district' ? 2 : 1)
      for (let j = 1; j < rings.length; j++)
        beam(out, 'metal', rings[j - 1][i], rings[j][i], 0.14, 0.18, [0.67, 0.72, 0.75]);
}
function build(out, level) {
  const c = settings[level],
    podium = localOutline(map);
  mappedSolid(out, 'stone', podium, 0, 0.3, [0.54, 0.55, 0.51]);
  for (const { a, b } of edges(podium))
    wall(
      out,
      a,
      b,
      0.3,
      14.4,
      {
        ...c,
        floors: level === 'skyline' ? 0 : 4.7,
        columns: level === 'skyline' || level === 'district' ? 0 : 4.5,
      },
      level,
    );
  mappedCap(out, 'concrete', podium, 14.4, [0.67, 0.68, 0.61]);
  modules(out, c, level);
  spire(out, c, level);
  atrium(out, c, level);
  if (level !== 'skyline')
    for (const [x, z] of [
      [-37, -5],
      [-35, 24],
      [-25, 33],
      [0, 35],
      [25, 33],
      [34, 12],
    ]) {
      const p = square(x, z, 2);
      mappedSolid(out, 'concrete', p, 14.4, 15, [0.57, 0.62, 0.53]);
      const q = landmark81At(x, z);
      tree(out, q, 15, 2.8, c.trees);
    }
}
export function buildLandmark81ReviewedMaster(out) {
  build(out, 'source');
}
export function buildLandmark81Closeup(out) {
  build(out, 'closeup');
}
export function buildLandmark81Street(out) {
  build(out, 'street');
}
export function buildLandmark81District(out) {
  build(out, 'district');
}
export function buildLandmark81Skyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = { stone: 'stone_granite', metal: 'metal_painted', concrete: 'concrete_plain' }[
          component
        ],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}
