/** Colman Dock, dated1911: whole timber pier, long sheds, domed waiting room and northwest clock tower. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL('../../../content/worldgen/source/places/c2/c23/colman_dock/', import.meta.url),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    wood: rgb('79634c'),
    timber: rgb('71634b'),
    trim: rgb('cbb99a'),
    roof: rgb('6c7165'),
    glass: rgb('47615d'),
    clock: rgb('e6dfca'),
  },
  surfaces = {
    wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.93, metallic: 0 },
    timber: { slot: 'foundation', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.9, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.25 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.05 },
    clock: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.82, metallic: 0 },
  };
export function colmanDockGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const Y = (y) => A.floorY + y;
function roofGable(o, x, z0, z1, w, eave, ridge, s = 'roof') {
  const a = [
      [x - w, Y(eave), z0],
      [x + w, Y(eave), z0],
      [x, Y(ridge), z0],
    ],
    b = a.map((q) => [q[0], q[1], z1]);
  T(o, 'wood', a, [0, 0, -1]);
  T(o, 'wood', b, [0, 0, 1]);
  Q(o, s, [a[0], b[0], b[2], a[2]], [-1, 1, 0]);
  Q(o, s, [a[2], b[2], b[1], a[1]], [1, 1, 0]);
}
function wall(o, a, b, h, d, office = false) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    n = [u[1], -u[0]],
    V = (x, y, dep = 0) => [a[0] + u[0] * x + n[0] * dep, Y(y), a[1] + u[1] * x + n[1] * dep],
    quad = (s, x0, x1, y0, y1, dep = 0) =>
      Q(o, s, [V(x0, y0, dep), V(x1, y0, dep), V(x1, y1, dep), V(x0, y1, dep)], [n[0], 0, n[1]]);
  if (d === 0) {
    quad('wood', 0, L, 0, h);
    return;
  }
  const count = Math.max(1, Math.round(L / (office ? 4.5 : d === 1 ? 14 : 7.5)));
  if (d === 1) quad('wood', 0, L, 0, h);
  for (let k = 0; k < count; k++) {
    const c = (L * (k + 0.5)) / count,
      cargo = !office && k % 4 === 0,
      w = cargo ? 2.5 : 1.25,
      l = c - w / 2,
      r = c + w / 2,
      rows = office
        ? [
            [1.1, 3.4],
            [5.0, 7.0],
          ]
        : cargo
          ? [[0.12, 3.9]]
          : [[3.0, 4.4]];
    if (d > 1) {
      quad('wood', (k * L) / count, l, 0, h);
      quad('wood', r, ((k + 1) * L) / count, 0, h);
      let last = 0;
      for (const [lo, hi] of rows) {
        quad('wood', l, r, last, lo);
        last = hi;
      }
      quad('wood', l, r, last, h);
    }
    for (const [lo, hi] of rows) {
      const dep = d === 1 ? 0.025 : -0.18;
      quad('glass', l, r, lo, hi, dep);
      if (d > 1) {
        for (const x of [l, r])
          Q(o, 'trim', [V(x, lo), V(x, lo, -0.18), V(x, hi, -0.18), V(x, hi)], [n[0], 0, n[1]]);
        Q(o, 'trim', [V(l, lo), V(r, lo), V(r, lo, -0.18), V(l, lo, -0.18)], [0, 1, 0]);
        quad('trim', c - 0.035, c + 0.035, lo, hi, -0.14);
        for (let j = 1; j < 3; j++) {
          const y = lo + ((hi - lo) * j) / 3;
          quad('trim', l, r, y - 0.025, y + 0.025, -0.14);
        }
      }
      if (d > 1 || office)
        for (const [x0, x1, y0, y1] of [
          [l - 0.12, l, lo - 0.12, hi + 0.12],
          [r, r + 0.12, lo - 0.12, hi + 0.12],
          [l, r, lo - 0.12, lo],
          [l, r, hi, hi + 0.12],
        ])
          quad('trim', x0, x1, y0, y1, 0.05);
    }
  }
  if (d > 1) {
    quad('trim', 0, L, h - 0.35, h - 0.15, 0.08);
    quad('timber', 0, L, 0, 0.15, 0.08);
  }
}
function rectWalls(o, x, z0, z1, w, h, d, office = false) {
  const P = [
    [x - w, z0],
    [x + w, z0],
    [x + w, z1],
    [x - w, z1],
  ];
  for (let k = 0; k < 4; k++) wall(o, P[k], P[(k + 1) % 4], h, d, office);
}
function pier(o, d) {
  const L = A.pierLength / 2,
    W = A.pierWidth / 2;
  box(o, 'timber', 0, Y(-0.5), 0, A.pierWidth, 0.5, A.pierLength);
  const count = [13, 22, 29, 43][d],
    xs = d === 0 ? [-15.8, 15.8] : [-15.8, 0, 15.8];
  for (let j = 0; j <= count; j++) {
    const z = -L + 0.8 + ((A.pierLength - 1.6) * j) / count;
    for (const x of xs) {
      axial(o, 'timber', [x, A.pileBottom, z], [x, Y(-0.2), z], 0.28, [3, 4, 6, 8][d], 0.23);
      if (d > 2) box(o, 'timber', x, Y(-0.8), z, 0.7, 0.3, 1.1);
    }
    if (d > 0) {
      box(o, 'timber', 0, Y(-0.9), z, 33.0, 0.4, 0.45);
      if (d > 1)
        for (const sign of [-1, 1])
          axial(o, 'timber', [sign * 15.8, Y(-1), z], [0, Y(-4), z], 0.14, d === 2 ? 4 : 6);
    }
  }
  if (d > 0) {
    for (const sign of [-1, 1]) {
      box(o, 'timber', sign * (W + 0.08), Y(-0.6), 0, 0.35, 0.3, A.pierLength);
      for (let j = 0; j <= [10, 18, 26][d - 1]; j++) {
        const z = -L + 4 + (j * (A.pierLength - 8)) / [10, 18, 26][d - 1];
        axial(
          o,
          'timber',
          [sign * (W - 0.1), -4, z],
          [sign * (W - 0.1), Y(0.9), z],
          0.22,
          [4, 6, 8][d - 1],
        );
      }
    }
    if (d > 1)
      for (let j = 0; j <= 26; j++) {
        const z = -L + 4 + (j * (A.pierLength - 8)) / 26;
        for (const sign of [-1, 1]) {
          box(o, 'timber', sign * (W - 1.0), Y(0.05), z, 0.4, 0.3, 0.6);
          axial(
            o,
            'timber',
            [sign * (W - 1), Y(0.35), z],
            [sign * (W - 1), Y(0.65), z],
            0.1,
            d === 2 ? 4 : 8,
          );
        }
      }
  }
}
function sheds(o, d) {
  for (const x of [-A.warehouseCentreX, A.warehouseCentreX]) {
    const z0 = A.warehouseStart,
      z1 = A.warehouseEnd,
      w = A.warehouseHalfWidth;
    rectWalls(o, x, z0, z1, w, A.warehouseWall, d);
    roofGable(o, x, z0, z1, w + 0.25, 6.8, 9.6);
    if (d > 0) {
      box(o, 'wood', x, Y(9.0), (z0 + z1) / 2, 3.8, 1.35, z1 - z0 - 8);
      roofGable(o, x, z0 + 4, z1 - 4, 2.1, 10.35, 11.25);
      const n = d === 1 ? 9 : 25;
      for (const sign of [-1, 1])
        for (let k = 0; k < n; k++) {
          const z = z0 + 6 + ((z1 - z0 - 12) * (k + 0.5)) / n;
          Q(
            o,
            'glass',
            [
              [x + sign * 1.925, Y(9.25), z - 0.9],
              [x + sign * 1.925, Y(9.25), z + 0.9],
              [x + sign * 1.925, Y(10.1), z + 0.9],
              [x + sign * 1.925, Y(10.1), z - 0.9],
            ],
            [sign, 0, 0],
          );
          if (d > 1) box(o, 'trim', x + sign * 1.94, Y(9.25), z, 0.06, 0.85, 0.06);
        }
    }
  }
  // Covered cargo-apron walks and real slender supporting posts run along both outer shed faces.
  for (const sign of [-1, 1]) {
    const x = sign * 14.0,
      z0 = A.warehouseStart,
      z1 = A.warehouseEnd;
    Q(
      o,
      'roof',
      [
        [x, Y(5.7), z0],
        [sign * 16.3, Y(4.5), z0],
        [sign * 16.3, Y(4.5), z1],
        [x, Y(5.7), z1],
      ],
      [0, 1, 0],
    );
    const n = d === 0 ? 4 : d === 1 ? 10 : 23;
    for (let k = 0; k <= n; k++) {
      const z = z0 + ((z1 - z0) * k) / n;
      box(o, 'timber', sign * 16.1, Y(0), z, 0.22, 4.5, 0.22);
      if (d > 1)
        axial(
          o,
          'timber',
          [sign * 16.1, Y(3.6), z],
          [sign * 14, Y(5.6), z],
          0.065,
          d === 2 ? 3 : 4,
        );
    }
  }
  // Intrinsic two-storey office/shopfront on the landward end; not independent Colman Building.
  rectWalls(o, 0, -105, -89, 16, 8.2, d, true);
  box(o, 'roof', 0, Y(8.2), -97, 32.6, 0.3, 16.6);
  box(o, 'trim', 0, Y(8.5), -104.6, 32.4, 0.55, 0.6);
  if (d > 0)
    for (let k = 0; k < 6; k++) {
      const x = -13 + k * 5.2;
      box(o, 'glass', x, Y(0.15), -105.04, 2.6, 3.5, 0.05);
      box(o, 'trim', x, Y(3.7), -105.15, 3.9, 0.5, 0.14);
    }
}
function waitingRoom(o, d) {
  const z0 = A.waitingStart,
    z1 = A.waitingEnd,
    w = A.waitingHalfWidth;
  rectWalls(o, 0, z0, z1, w, A.waitingWall, d);
  const n = [4, 8, 16, 24][d],
    P = (t, z) => [
      w * Math.cos(t),
      Y(A.waitingWall + (A.waitingRoof - A.waitingWall) * Math.sin(t)),
      z,
    ];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI,
      b = ((k + 1) / n) * Math.PI;
    Q(o, 'roof', [P(a, z0), P(a, z1), P(b, z1), P(b, z0)], [Math.cos((a + b) / 2), 1, 0]);
    T(o, 'wood', [[0, Y(A.waitingWall), z1], P(a, z1), P(b, z1)], [0, 0, 1]);
    T(o, 'wood', [[0, Y(A.waitingWall), z0], P(b, z0), P(a, z0)], [0, 0, -1]);
    if (d > 1) {
      axial(o, 'roof', P(a, z0), P(a, z1), 0.03, d === 2 ? 2 : 4);
    }
  }
  if (d > 0) {
    for (const x of [-8, -4, 0, 4, 8]) {
      box(o, 'glass', x, Y(0.15), z1 + 0.04, 2.4, 5.5, 0.08);
      for (const sign of [-1, 1]) box(o, 'trim', x + sign * 1.3, Y(0.1), z1 + 0.12, 0.2, 5.75, 0.2);
      box(o, 'trim', x, Y(5.75), z1 + 0.12, 2.9, 0.25, 0.2);
    }
    box(o, 'trim', 0, Y(8.15), z1 + 0.12, 25.6, 0.4, 0.28);
    const r = 4.0,
      base = 9.4,
      N = d === 1 ? 6 : 16;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI,
        b = ((k + 1) / N) * Math.PI,
        V = (t) => [r * Math.cos(t), Y(base + 2.4 * Math.sin(t)), z1 + 0.06];
      T(o, 'glass', [[0, Y(base), z1 + 0.06], V(a), V(b)], [0, 0, 1]);
      if (d > 1) axial(o, 'trim', V(a), V(b), 0.07, d === 2 ? 3 : 4);
    }
  }
}
function clockFace(o, F, d) {
  const c = 14.1,
    r = 1.55,
    n = [8, 16, 32, 48][d],
    V = (x, y, dep = 0) => [F.x + F.u[0] * x + F.n[0] * dep, Y(y), F.z + F.u[1] * x + F.n[1] * dep];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2,
      b = ((k + 1) / n) * Math.PI * 2;
    T(
      o,
      'clock',
      [
        V(0, c, 0.04),
        V(r * Math.cos(a), c + r * Math.sin(a), 0.04),
        V(r * Math.cos(b), c + r * Math.sin(b), 0.04),
      ],
      [F.n[0], 0, F.n[1]],
    );
  }
  if (d > 0) {
    for (let k = 0; k < 12; k++) {
      const t = (k * Math.PI) / 6;
      axial(
        o,
        'timber',
        V(Math.sin(t) * 1.28, c + Math.cos(t) * 1.28, 0.06),
        V(Math.sin(t) * 1.43, c + Math.cos(t) * 1.43, 0.06),
        0.035,
        d === 1 ? 2 : 4,
      );
    }
  }
  for (const [angle, l] of [
    [-0.7, 1.12],
    [2.5, 0.83],
  ])
    axial(
      o,
      'timber',
      V(0, c, 0.08),
      V(Math.sin(angle) * l, c + Math.cos(angle) * l, 0.08),
      d === 0 ? 0.07 : 0.055,
      d === 0 ? 2 : 4,
    );
}
function tower(o, d) {
  const x = A.towerX,
    z = A.towerZ,
    w = A.towerWidth / 2;
  box(o, 'trim', x, Y(0), z, A.towerWidth, 17.8, A.towerWidth);
  for (const y of [3.0, 7.5, 17.65])
    box(o, 'trim', x, Y(y), z, A.towerWidth + 0.45, 0.3, A.towerWidth + 0.45);
  const F = [
    { x: x + w + 0.015, z, u: [0, -1], n: [1, 0] },
    { x: x - w - 0.015, z, u: [0, 1], n: [-1, 0] },
    { x, z: z + w + 0.015, u: [1, 0], n: [0, 1] },
    { x, z: z - w - 0.015, u: [-1, 0], n: [0, -1] },
  ];
  for (const f of F) {
    clockFace(o, f, d);
    if (d > 0) {
      const P = (a, y) => [
        f.x + f.u[0] * a + f.n[0] * 0.035,
        Y(y),
        f.z + f.u[1] * a + f.n[1] * 0.035,
      ];
      for (const [lo, hi] of [
        [1.2, 2.7],
        [8.5, 10.7],
      ])
        Q(o, 'glass', [P(-0.65, lo), P(0.65, lo), P(0.65, hi), P(-0.65, hi)], [f.n[0], 0, f.n[1]]);
      if (d > 1)
        for (const q of [-1, 0, 1]) {
          const a = q * 0.55;
          axial(o, 'trim', P(a, 8.5), P(a, 10.7), 0.04, d === 2 ? 3 : 4);
        }
    }
  }
  for (const i of [-1, 1])
    for (const j of [-1, 1])
      box(o, 'trim', x + i * (w - 0.25), Y(17.8), z + j * (w - 0.25), 0.5, 2.8, 0.5);
  box(o, 'trim', x, Y(20.55), z, 7.5, 0.25, 7.5);
  const P = [
      [x - 4, Y(20.85), z - 4],
      [x + 4, Y(20.85), z - 4],
      [x + 4, Y(20.85), z + 4],
      [x - 4, Y(20.85), z + 4],
    ],
    C0 = [x, Y(22.2), z];
  for (let k = 0; k < 4; k++) T(o, 'roof', [P[k], P[(k + 1) % 4], C0], [0, 1, 0]);
  if (d > 0)
    for (const f of F) {
      const P = (a, y) => [
        f.x + f.u[0] * a + f.n[0] * 0.06,
        Y(y),
        f.z + f.u[1] * a + f.n[1] * 0.06,
      ];
      axial(o, 'timber', P(-w + 0.3, 18.8), P(w - 0.3, 18.8), 0.06, d === 1 ? 3 : 4);
      const n = d === 1 ? 3 : 8;
      for (let k = 0; k <= n; k++) {
        const a = -w + 0.35 + ((2 * w - 0.7) * k) / n;
        axial(o, 'trim', P(a, 17.95), P(a, 18.8), 0.035, d === 1 ? 3 : 4);
      }
    }
  axial(o, 'timber', [x, Y(22.2), z], [x, Y(27), z], 0.055, d === 0 ? 3 : 6, 0.025);
}
function build(o, _f, d = 3) {
  pier(o, d);
  sheds(o, d);
  waitingRoom(o, d);
  tower(o, d);
}
export const colmanDockSkyline = (o, f) => build(o, f, 0),
  colmanDockDistrict = (o, f) => build(o, f, 1),
  colmanDockStreet = (o, f) => build(o, f, 2),
  colmanDockCloseup = (o, f) => build(o, f, 3);
export const colmanDockModel = {
  id: 'colman_dock',
  key: 'colman_dock',
  cell: 'c2/c23',
  recipe: 'structure-colman-dock.mjs',
  title: 'Colman Dock (1911)',
  category: 'transport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [130, 100, 225],
  lookAt: [0, 10, 0],
  mediumFiContext: { scale: 1.6 },
  qaCameras: [
    {
      name: 'whole-705ft-historic-pier-sheds-waiting-room-and-northwest-clocktower',
      position: [130, 100, 225],
      lookAt: [0, 10, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'four-clockfaces-open-lookout-overhanging-hiproof-and-flagstaff',
      position: [-36, 27, 128],
      lookAt: [-14, 22, 100],
    },
    {
      name: 'domed-waiting-room-entrances-clerestory-sheds-and-cargo-apron',
      position: [40, 24, 120],
      lookAt: [1, 13, 80],
    },
    {
      name: 'timber-pilebents-fenders-covered-cargo-walk-and-whole-long-sheds',
      position: [-40, 10, -30],
      lookAt: [0, 6, 15],
    },
  ],
  appearance: p.appearance,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-colman-dock.mjs',
    level: 'skyline',
    export: 'colmanDockSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'colmanDockDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'colmanDockStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'colmanDockCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole dated1911 terminal/pier, not just clocktower and notcurrent2023terminal. Pierwidth/shoreposition/duewestbearing/longshed layout, room/dome sections, office/shopfront, openingcensus/clerestories, pilings/bents/fenders and roof/clock/rail hardware are medium-fi inferences from publishedpostcards/text, not architecturalsurvey. Hiddenrearandconnectiondetails approximate; ships/GrandTrunkDock/Pier50/independentColmanBuilding/cardart excluded.',
    'Two individually inspected exact published ca1910LowmanHanford and1911MitchellUS-expiredpostcards/nativePD-US/grants/SHA1/revisions bound. Same underlyingfacade view/negativefamily, no claim of independentfullcoverage. ModernCCviews andunknowncreator/damaged-terminal images unused; no supplementalphotos/photographictextures/generatedbitmaps/borrowedmeshes.',
    'Independent256m129square16641-sample moderncoastalfield andoriginalrawtile frozenbeforegeometry, with fixed offshoreprovider reference. Deck6m/piletoe-10m are intrinsic structural estimates; sourcegroundnotflattened/fitted/reacquired and not1911tidal/grade/seabedsurvey. Dated1911placement only, currentworldexcluded and hostground/watercontactunverified.',
    'FourLODs preservewholepier/twosheds/shoreoffice/domedwaitingroom/NWclocktower/fourclockfaces/openlookout/hiproof/flagstaff. Nearcargo openings/windowreveals/mullions/clerestories/coveredwalk posts/piles/bents/fenders/clockticks/lookoutrails restored progressively.',
  ],
};
