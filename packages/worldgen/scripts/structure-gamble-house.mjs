/** Gamble House: individual overlapping gables and three open sleeping porches. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  floor = 1.5,
  upper = 4.8;
const shake = rgb('77796a'),
  timber = rgb('4d5145'),
  warm = rgb('88533b'),
  roofColor = rgb('77796e'),
  glass = rgb('64716a'),
  stone = rgb('b9b18e'),
  brick = rgb('916047');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function planks(o, w, lo, hi, d) {
  if (d < 2) return;
  const step = d === 2 ? 0.82 : 0.41,
    n = Math.ceil(w / (d === 2 ? 1 : 0.32));
  for (let j = 0, y = lo; y < hi - 0.03; j++, y += step) {
    const h = Math.min(step - 0.022, hi - y);
    for (let i = 0; i < n; i++) {
      const l = -w / 2 + (i * w) / n,
        r = l + w / n - 0.015;
      face(
        o,
        'wall',
        (l + r) / 2,
        y,
        0.018,
        r - l,
        h,
        shake.map((v) => v * (0.91 + ((i * 7 + j * 3) % 9) * 0.02)),
      );
    }
  }
}
function side(o, a, x, z, w, lo, hi, d) {
  const f = facing(o, a, x, z);
  planks(f, w, lo, hi, d);
  return f;
}
function mass(o, x, z, w, dep, hi, d, lo = -1) {
  B(o, 'wall', x, lo, z, w, hi - lo, dep, shake);
  if (d) {
    if (lo < floor) B(o, 'stone', x, lo, z, w + 0.06, floor - lo, dep + 0.06, stone);
    for (const [a, xx, zz, span] of [
      [0, x, z + dep / 2, w],
      [Math.PI, x, z - dep / 2, w],
      [Math.PI / 2, x + w / 2, z, dep],
      [-Math.PI / 2, x - w / 2, z, dep],
    ])
      side(o, a, xx, zz, span, Math.max(floor, lo), hi, d);
  }
}
function win(o, x, y, w, h, d, { panes = 3, art = false } = {}) {
  if (!d) return;
  face(o, 'glass', x, y, 0.07, w, h, glass);
  if (d < 2) return;
  for (const xx of [x - w / 2, x + w / 2])
    B(o, 'wood', xx, y - 0.05, 0.11, 0.085, h + 0.1, 0.11, warm);
  for (const yy of [y - 0.08, y + h]) B(o, 'wood', x, yy, 0.11, w + 0.22, 0.09, 0.14, warm);
  for (let k = 1; k < panes; k++)
    B(o, 'wood', x - w / 2 + (w * k) / panes, y, 0.13, 0.07, h, 0.1, warm);
  if (art && d > 2) {
    for (let j = 1; j < 4; j++) face(o, 'wood', x, y + (h * j) / 4, 0.2, w, 0.019, timber);
    for (const s of [-1, 1]) {
      const p = [
        [x + s * w * 0.06, y + 0.15, 0.21],
        [x + s * w * 0.12, y + h * 0.7, 0.21],
        [x + s * w * 0.36, y + h * 0.94, 0.21],
      ];
      for (let i = 1; i < p.length; i++) beam(o, 'wood', p[i - 1], p[i], 0.022, 0.022, timber);
    }
  }
}
function windows(o, a, x, z, w, y, h, panes, d, art = false) {
  win(facing(o, a, x, z), 0, y, w, h, d, { panes, art });
}
function gable(o, x, z, w, dep, eave, rise, d, { axis = 0, closed = false } = {}) {
  const f = facing(o, axis, x, z);
  for (const sign of [-1, 1]) {
    const p = [
      [(sign * w) / 2, eave, -dep / 2],
      [(sign * w) / 2, eave, dep / 2],
      [0, eave + rise, dep / 2],
      [0, eave + rise, -dep / 2],
    ];
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    quad(f, 'roof', p, n, roofColor);
    quad(
      f,
      'wood',
      p.map((p) => [p[0], p[1] - 0.16, p[2]]).reverse(),
      n.map((v) => -v),
      timber,
    );
    for (const zz of d ? [-dep / 2, dep / 2] : [])
      beam(
        f,
        'wood',
        [(sign * w) / 2, eave - 0.09, zz],
        [0, eave + rise - 0.09, zz],
        0.2,
        0.18,
        timber,
      );
    B(f, 'wood', (sign * w) / 2, eave - 0.17, 0, 0.16, 0.19, dep, timber);
  }
  if (closed)
    for (const sign of [-1, 1]) {
      const p = [
        [-w / 2, eave, z],
        [w / 2, eave, z],
        [0, eave + rise, z],
      ].map((v) => [v[0], v[1], (sign * dep) / 2]);
      f.addTriangle(
        'wall',
        ref,
        p,
        [0, 0, sign],
        [
          [0, 0],
          [w, 0],
          [w / 2, rise],
        ],
        shake,
      );
    }
  if (d) {
    const count = d === 1 ? Math.ceil(dep / 2.4) : Math.ceil(dep / 0.62);
    for (let j = 0; j <= count; j++) {
      const zz = -dep / 2 + (j * dep) / count;
      for (const sign of [-1, 1]) {
        const len = d === 1 ? 1.1 : 1.65;
        beam(
          f,
          'wood',
          [(sign * w) / 2, eave - 0.3, zz],
          [sign * (w / 2 - len), eave + (rise * len) / (w / 2) - 0.3, zz],
          0.12,
          0.19,
          timber,
        );
      }
    }
  }
}
function rail(o, w, y, d) {
  if (!d) return;
  for (const yy of [y + 0.25, y + 0.52, y + 0.79, y + 1.06])
    B(o, 'wood', 0, yy, 0, w, 0.17, 0.13, timber);
  if (d > 1)
    for (let x = -w / 2; x <= w / 2 + 0.01; x += w / Math.ceil(w / 2))
      B(o, 'wood', x, y, 0, 0.13, 1.3, 0.16, timber);
}
function bracket(o, x, z, y, d) {
  if (d < 2) return;
  for (const s of [-1, 1]) {
    beam(o, 'wood', [x, y - 0.55, z], [x + s * 0.7, y - 0.13, z], 0.13, 0.16, timber);
    if (d > 2) B(o, 'wood', x + s * 0.25, y - 0.17, z, 0.55, 0.17, 0.24, timber);
  }
}
function porch(o, x, z, w, dep, d, { back = false, axis = Math.PI / 2 } = {}) {
  B(o, 'wood', x, upper - 0.24, z, w, 0.25, dep, timber);
  if (!d) {
    for (const xx of [x - w / 2 + 0.4, x + w / 2 - 0.4])
      B(o, 'wood', xx, floor, z + dep / 2 - 0.5, 0.22, 6.0, 0.22, timber);
    gable(o, x, z, axis ? dep + 2 : w + 2, axis ? w + 2 : dep + 2, 7.55, 1.25, d, { axis });
    return;
  }
  // Real open volumes: no solid upper wall placed inside these porch footprints.
  for (const xx of [x - w / 2 + 0.45, x + w / 2 - 0.45])
    for (const zz of [z - dep / 2 + 0.45, z + dep / 2 - 0.45]) {
      B(o, 'wood', xx, floor, zz, 0.24, 6.2, 0.24, timber);
      bracket(o, xx, zz, 7.2, d);
      bracket(o, xx, zz, upper - 0.15, d);
    }
  for (const zz of [z - dep / 2 + 0.25, z + dep / 2 - 0.25]) {
    B(o, 'wood', x, 7.15, zz, w + 0.45, 0.24, 0.25, timber);
    rail(facing(o, 0, x, zz), w - 0.65, upper, d);
  }
  for (const xx of [x - w / 2 + 0.25, x + w / 2 - 0.25]) {
    B(o, 'wood', xx, 7.15, z, 0.25, 0.24, dep + 0.45, timber);
    rail(facing(o, Math.PI / 2, xx, z), dep - 0.65, upper, d);
  }
  if (d > 1) {
    for (let i = 0; i < Math.ceil(w / 0.66); i++)
      B(o, 'wood', x - w / 2 + 0.2 + i * 0.66, upper - 0.48, z, 0.17, 0.23, dep + 0.65, timber);
    for (const xx of [x - w / 2 + 0.38, x + w / 2 - 0.38])
      B(o, 'wood', xx, floor, z, 0.19, 0.2, dep + 0.5, timber);
  }
  // Rotation swaps roof dimensions to put ridge across the front and north porches.
  gable(o, x, z, axis ? dep + 2 : w + 2, axis ? w + 2 : dep + 2, 7.55, 1.25, d, { axis });
  if (d > 1)
    for (const [xx, zz] of [
      [x + w / 2 - 0.38, z + dep / 2 - 0.35],
      [x - w / 2 + 0.38, z - dep / 2 + 0.35],
    ])
      B(o, 'wood', xx, floor, zz, 0.09, 6.3, 0.09, rgb('547d6b'));
  if (back && d > 2) {
    for (const zz of [z - dep / 2 + 0.5, z + dep / 2 - 0.5])
      beam(
        o,
        'wood',
        [x - w / 2 + 0.5, upper - 0.65, zz],
        [x + w / 2 - 0.5, upper - 0.1, zz],
        0.12,
        0.18,
        timber,
      );
  }
}
function chimney(o, x, z, base, top, w, dep, d) {
  B(o, 'stone', x, base, z, w, top - base, dep, stone);
  B(o, 'stone', x, top, z, w + 0.48, 0.2, dep + 0.48, stone);
  if (!d) return;
  B(o, 'brick', x, top - 1.05, z, w + 0.08, 0.85, dep + 0.08, brick);
  B(o, 'stone', x, top - 0.15, z, w + 0.22, 0.16, dep + 0.22, stone);
  if (d > 1)
    for (const [a, xx, zz, span] of [
      [0, x, z + dep / 2 + 0.05, w],
      [Math.PI, x, z - dep / 2 - 0.05, w],
      [Math.PI / 2, x + w / 2 + 0.05, z, dep],
      [-Math.PI / 2, x - w / 2 - 0.05, z, dep],
    ]) {
      const f = facing(o, a, xx, zz),
        n = Math.ceil(span / 0.34);
      for (let i = 0; i < n; i++)
        B(f, 'wood', -span / 2 + ((i + 0.5) * span) / n, top - 0.91, 0.04, 0.1, 0.68, 0.12, timber);
    }
}
function steps(o, x, z, w, n, total, run, d, base = 0) {
  const count = d === 0 ? 2 : d === 1 ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++)
    B(
      o,
      'brick',
      x,
      base - 0.2,
      z - (i * run * n) / count,
      w,
      0.2 + (total * (i + 1)) / count,
      (run * n) / count + 0.02,
      brick,
    );
}
function terrace(o, x, z, w, dep, top, d) {
  B(o, 'stone', x, -1, z, w, top + 1, dep, stone);
  if (d) B(o, 'brick', x, top, z, w, 0.05, dep, brick);
}
function planter(o, x, z, y, d) {
  B(o, 'stone', x, y, z, 0.82, 0.75, 0.82, stone);
  if (d) {
    B(o, 'stone', x, y + 0.75, z, 1.03, 0.1, 1.03, stone);
    B(o, 'stone', x, y + 0.86, z, 0.74, 0.42, 0.74, stone);
    B(o, 'wood', x, y + 1.29, z, 0.58, 0.02, 0.58, timber);
    for (const zz of [z - 0.4, z + 0.4]) B(o, 'stone', x, y + 1.23, zz, 0.84, 0.12, 0.1, stone);
    for (const xx of [x - 0.4, x + 0.4]) B(o, 'stone', xx, y + 1.23, z, 0.1, 0.12, 0.84, stone);
  }
}
function gamble(o, _frame, d = 3) {
  // Main first/second-floor body; front south and rear south gables project beyond it.
  mass(o, -1.5, 0, 23.6, 12.6, upper, d);
  mass(o, -3.35, 0, 19.9, 12.6, 7.75, d, upper);
  mass(o, -6.8, 8.5, 8.6, 6.2, 7.75, d);
  mass(o, -7, -7.8, 8.6, 3.3, 7.75, d);
  mass(o, -13.25, 4.6, 2.1, 6.4, 4.65, d);
  mass(o, 2.65, 7.2, 8.7, 3.0, 7.5, d);
  // Attic sits above the overlapping lower roofs, with glazed long faces.
  mass(o, -1.5, 0.05, 18.0, 5.4, 9.75, d, 8.3);
  gable(o, -1.5, 0.05, 8.4, 22.1, 9.65, 1.25, d, { axis: Math.PI / 2, closed: true });
  // Main lower eaves intersect these distinct projecting gables.
  gable(o, -2.8, 0, 19.8, 25.0, 7.6, 1.15, d, { axis: Math.PI / 2, closed: true });
  gable(o, -6.8, 8.0, 11.0, 11.1, 7.5, 1.65, d, { closed: true });
  gable(o, -7, -7.2, 11.0, 7.4, 7.5, 1.65, d, { closed: true });
  gable(o, -13.3, 4.5, 4.8, 9.4, 4.65, 0.8, d, { closed: true });
  // Three sleeping porches: northeast front, north-rear and central west-rear.
  porch(o, 11.6, 8.3, 7.6, 8.3, d);
  porch(o, 9.2, -3.2, 5.8, 5.0, d, { back: true });
  porch(o, 1.5, -8.5, 5.6, 4.2, d, { back: true, axis: 0 });
  // Front entry and low projecting wood canopy.
  windows(o, 0, -6.8, 11.61, 4.2, 2.0, 1.75, 3, d);
  windows(o, 0, -6.8, 11.61, 4.4, 5.15, 1.75, 5, d);
  windows(o, 0, -3.6, 11.61, 1.2, 3.05, 0.85, 2, d);
  windows(o, 0, 1.2, 8.71, 3.9, 5.05, 1.8, 4, d);
  windows(o, 0, 5.8, 8.71, 2.2, 5.05, 1.8, 3, d);
  windows(o, 0, 5.7, 8.71, 2.2, 1.95, 2.0, 3, d);
  windows(o, 0, 1.0, 8.71, 3.9, floor, 2.6, 3, d, true);
  if (d) {
    B(o, 'wood', 1.0, 4.11, 9.2, 5.2, 0.22, 1.3, timber);
    for (const x of [-1.35, 3.35]) B(o, 'wood', x, floor, 9.3, 0.18, 2.7, 0.19, warm);
    if (d > 1) {
      for (const x of [-0.35, 2.35]) B(o, 'wood', x, floor, 8.9, 0.12, 2.65, 0.18, warm);
      for (const x of [-1, 0, 1, 2, 3]) B(o, 'wood', x, 4.05, 9.1, 0.12, 0.18, 1.65, timber);
    }
  }
  // North den windows remain visible beneath and beside the open porches.
  windows(o, Math.PI / 2, 10.31, 3.4, 4.8, 2.0, 2.0, 5, d);
  windows(o, Math.PI / 2, 6.61, 0, 3.2, 5.05, 1.8, 3, d);
  windows(o, -Math.PI / 2, -13.31, -2.4, 4.2, 2.1, 1.7, 4, d);
  windows(o, -Math.PI / 2, -13.31, -2.4, 4.2, 5.05, 1.8, 4, d);
  windows(o, -Math.PI / 2, -14.31, 4.6, 4.0, 1.9, 1.8, 4, d);
  windows(o, -Math.PI / 2, -11.11, 8.6, 4.2, 5.05, 1.8, 4, d);
  // Rear dining/living glazing follows the first-floor plan and rear photographs.
  windows(o, Math.PI, -7, -9.46, 4.7, 2.0, 1.8, 4, d);
  windows(o, Math.PI, -7, -9.46, 4.3, 5.05, 1.8, 4, d);
  windows(o, Math.PI, -2.0, -6.31, 3.6, floor, 2.6, 3, d, true);
  windows(o, Math.PI, 4.6, -6.31, 3.4, floor, 2.6, 3, d, true);
  windows(o, Math.PI, -2.0, -6.31, 3.4, 5.1, 1.75, 4, d);
  for (const sign of [-1, 1])
    windows(o, sign > 0 ? 0 : Math.PI, -1.0, sign * 2.76 + 0.05, 13.0, 8.6, 1.0, 12, d);
  // Main roof's apparent clerestory uses the taller attic face above lower roof junctions.
  for (const [x, z, base, top, w, dep] of [
    [-7.8, 4.1, 8.2, 10.8, 1.5, 1.1],
    [5.0, 0.2, 8.8, 11.45, 1.3, 1.1],
    [-6.2, -4.8, 8.1, 10.45, 1.5, 1.1],
  ])
    chimney(o, x, z, base, top, w, dep, d);
  // Broad front terrace and two-tier gunite planter wall, mission tile stair.
  terrace(o, 8.8, 11.0, 15.2, 4.3, 1.45, d);
  terrace(o, 1.0, 11.4, 6.2, 5.3, 1.45, d);
  steps(o, 1, 16.0, 5.4, 8, 1.5, 0.31, d);
  if (d) {
    for (const x of [-2.0, 4.0]) {
      B(o, 'stone', x, -0.2, 14.4, 0.55, 1.1, 2.8, stone);
      planter(o, x, 13.1, 0.65, d);
    }
    for (const x of [5.5, 10.7, 15.8]) planter(o, x, 13.0, 1.5, d);
    B(o, 'stone', 10.6, 0.7, 13, 10.8, 0.8, 0.5, stone);
    B(o, 'stone', 16.0, 0.5, 10.9, 0.5, 1.15, 4.6, stone);
    if (d > 1) {
      for (const s of [-1, 1])
        beam(o, 'wood', [1 + s * 2.5, 0.8, 16.2], [1 + s * 2.5, 2.3, 13.7], 0.04, 0.04, timber);
    }
  }
  // Rear raised garden terrace with irregular fieldstone facing and two small stair flights.
  terrace(o, -1.0, -12.3, 22.0, 4.2, 1.45, d);
  for (const x of [-4.7, 6.1])
    steps(facing(o, Math.PI, x, -15.7), 0, 0, 2.4, 4, 0.6, 0.33, d, 0.85);
  if (d) {
    for (const x of [-12.0, 10.0]) B(o, 'stone', x, 0.3, -12.1, 0.45, 1.5, 4.8, stone);
    for (const [a, b] of [
      [-12, -5.9],
      [-3.5, 4.9],
      [7.3, 10],
    ])
      B(o, 'stone', (a + b) / 2, 0.4, -14.5, b - a, 0.85, 0.4, stone);
    if (d > 2) {
      const f = facing(o, Math.PI, -1, -14.72);
      for (let j = 0; j < 3; j++)
        for (let i = 0; i < 36; i++) {
          const x = -10.7 + i * 0.61 + (j % 2) * 0.24,
            y = 0.45 + j * 0.26;
          if (Math.abs(x - 3.7) < 1.45 || Math.abs(x + 7.1) < 1.45) continue;
          face(
            f,
            'stone',
            x,
            y,
            0.016,
            0.39 + (i % 3) * 0.06,
            0.21,
            stone.map((v) => v * (0.5 + ((i * 7 + j) % 7) * 0.085)),
          );
        }
    }
  }
}
export function gambleSkyline(o) {
  gamble(o, undefined, 0);
}
export function gambleDistrict(o) {
  gamble(o, undefined, 1);
}
export function gambleStreet(o) {
  gamble(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_painted_shingle', roughness: 0.9, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.93, metallic: 0 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const gambleModel = {
  id: 'gamble_house',
  recipe: 'structure-gamble-house.mjs',
  key: 'gamble_house',
  cell: '9q/9q5',
  title: 'Gamble House',
  brief:
    'Craftsman house with olive cedar-shake walls, overlapping broad gables and deep exposed timber eaves, raised attic, three open sleeping porches, warm timber casements and entry glass, three bracket-capped chimneys, gunite front terrace and fieldstone rear terrace.',
  camera: [44, 29, 51],
  lookAt: [0, 4, 1],
  qaCameras: [
    { name: 'front', position: [22, 14, 57], lookAt: [0, 4, 2] },
    { name: 'back', position: [-30, 17, -49], lookAt: [0, 4, -1] },
  ],
  build: gamble,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Front garden at local [2,17], Y=0; main floor Y=1.5, upper sleeping porches Y=4.8. Independent USGS bare-earth datum.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-gamble-house.mjs',
    level: 'skyline',
    export: 'gambleSkyline',
    errorMeters: 0.3,
    surfaces,
    authoredLevels: {
      district: { export: 'gambleDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'gambleStreet', errorMeters: 0.045, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from inspected local Qualla front/rear photographs, porch and entry details, local HABS construction section, online first-floor plan and aerial roof context. Dimensions, upper room boundaries and hidden roof joins are estimates, not survey data.',
    'Main house and attached terraces only. Detached garage, interiors, furniture, vegetation, visitors and photographic pixels excluded.',
    'Independent unmodified USGS CA_LosAngeles_B23 bare-earth tile retained. Ground under structures is interpolated by the source product; host terrain can differ. Footprint replacement remains disabled.',
    'Cedar shakes, art-glass branches, beam-end profiles, terrace fieldstones and chimney brackets are simplified at medium-fi scale and omitted progressively at distance. No physical-device frame-rate measurement claimed.',
  ],
};
