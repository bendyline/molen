/** Timber weather observatory: enclosed return verandas, three gablets and instruments. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r7/r7h/crohamhurst_observatory/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  W = A.width,
  D = A.depth,
  f = A.floorY,
  ref = 'palette:#ffffff';
const C = {
    wall: rgb('d2d0bd'),
    roof: rgb('9a9d94'),
    trim: rgb('e0dbc4'),
    wood: rgb('706452'),
    base: rgb('9a9885'),
    glass: rgb('40574e'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_panel', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.93, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.98, metallic: 0 },
    base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.38, metallic: 0 },
  };
export function crohamhurstObservatoryGround(x, z) {
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
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  if (h <= 0) return;
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, a.toReversed(), [0, -1, 0], col);
  Q(o, s, b, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], col);
  }
}
function cylinder(o, s, x, y, z, r, h, N, col = C[s]) {
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N,
      P = (t) => [x + r * Math.cos(t), y, z + r * Math.sin(t)],
      U = (t) => [x + r * Math.cos(t), y + h, z + r * Math.sin(t)];
    Q(o, s, [P(a), P(b), U(b), U(a)], [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)], col);
    T(o, s, [[x, y + h, z], U(a), U(b)], [0, 1, 0], col);
  }
}
const face = (P, n) => ({ P, n }),
  north = () => face((u, y, v = 0) => [-W / 2 + u, f + y, -D / 2 - v], [0, 0, -1]),
  east = () => face((u, y, v = 0) => [W / 2 + v, f + y, -D / 2 + u], [1, 0, 0]),
  south = () => face((u, y, v = 0) => [W / 2 - u, f + y, D / 2 + v], [0, 0, 1]),
  west = () => face((u, y, v = 0) => [-W / 2 - v, f + y, D / 2 - u], [-1, 0, 0]);
function patch(o, s, F, l, r, lo, hi, v = 0, col = C[s]) {
  if (r <= l || hi <= lo) return;
  Q(o, s, [F.P(l, lo, v), F.P(r, lo, v), F.P(r, hi, v), F.P(l, hi, v)], F.n, col);
}
function wall(o, F, L, H, openings, d) {
  const P = F.P;
  openings = openings.toSorted((a, b) => a.c - b.c);
  if (d === 0) patch(o, 'wall', F, 0, L, 0, H);
  let prev = 0;
  const board = (l, r, lo, hi) => {
    patch(o, 'wall', F, l, r, lo, hi);
    if (d > 1)
      for (let y = Math.ceil(lo / 0.22) * 0.22; y < hi - 0.035; y += 0.22)
        patch(o, 'trim', F, l, r, y, y + 0.025, 0.018, rgb('b7b7a3'));
  };
  for (const e of openings) {
    const l = e.c - e.w / 2,
      r = e.c + e.w / 2,
      b = e.b ?? 0.9,
      h = e.h ?? 1.45;
    if (d > 0) {
      board(prev, l, 0, H);
      board(l, r, 0, b);
      board(l, r, b + h, H);
    }
    const v = d === 0 ? 0.012 : -0.13;
    patch(o, e.door ? 'wood' : 'glass', F, l, r, b, b + h, v);
    if (d > 0) {
      for (const u of [l, r])
        Q(o, 'trim', [P(u, b), P(u, b + h), P(u, b + h, -0.14), P(u, b, -0.14)], null);
      for (const y of [b, b + h])
        Q(o, 'trim', [P(l, y), P(r, y), P(r, y, -0.14), P(l, y, -0.14)], null);
      for (const u of [l - 0.035, r - 0.035])
        patch(o, 'trim', F, u, u + 0.07, b - 0.05, b + h + 0.05, 0.025);
      for (const y of [b - 0.05, b + h])
        patch(o, 'trim', F, l - 0.05, r + 0.05, y, y + 0.075, 0.03);
      if (!e.door) {
        patch(o, 'trim', F, e.c - 0.03, e.c + 0.03, b, b + h, -0.08);
        patch(o, 'trim', F, l, r, b + h * 0.48, b + h * 0.48 + 0.05, -0.07);
        if (d > 1)
          for (const u of [e.c - e.w / 4, e.c + e.w / 4])
            patch(o, 'trim', F, u - 0.02, u + 0.02, b, b + h, -0.07);
      } else if (d > 1) {
        for (const u of [e.c - e.w * 0.24, e.c + e.w * 0.24])
          for (const y of [b + 0.2, b + 1.1])
            patch(o, 'wood', F, u - 0.2, u + 0.2, y, y + 0.65, -0.1, rgb('86765a'));
      }
    }
    prev = r;
  }
  if (d > 0) board(prev, L, 0, H);
}
function roofQuad(o, Qp, d) {
  Q(o, 'roof', Qp, [0, 1, 0]);
  if (d < 2) return;
  const N = Math.ceil(
    Math.hypot(Qp[1][0] - Qp[0][0], Qp[1][2] - Qp[0][2]) / (d === 2 ? 0.32 : 0.2),
  );
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N,
      w = 0.025,
      Nrm = [0, 0.018, 0],
      P = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t + Nrm[k]),
      a = P(Qp[0], Qp[1], t - w / N),
      b = P(Qp[0], Qp[1], t + w / N),
      c = P(Qp[3], Qp[2], t + w / N),
      e = P(Qp[3], Qp[2], t - w / N);
    Q(o, 'roof', [a, b, c, e], [0, 1, 0], rgb('a8aba1'));
  }
}
function vent(o, F, w, h, d) {
  const P = F.P;
  T(o, 'wood', [P(-w / 2, 0, -0.04), P(w / 2, 0, -0.04), P(0, h, -0.04)], F.n, rgb('3d443b'));
  const e = 0.08;
  for (const side of [-1, 1])
    Q(
      o,
      'trim',
      [P((side * w) / 2, 0), P(side * (w / 2 + e), 0), P(side * e, h + 0.12), P(0, h)],
      F.n,
    );
  patch(o, 'trim', F, -w / 2 - 0.08, w / 2 + 0.08, -0.08, 0, 0.015);
  if (d > 0) {
    const count = [0, 5, 9, 13][d];
    for (let i = 0; i < count; i++) {
      const y = (h * (i + 0.35)) / (count + 1),
        r = (w / 2) * (1 - (y + 0.06) / h);
      Q(
        o,
        'trim',
        [P(-r, y, 0.05), P(r, y, 0.05), P(r, y + 0.07, 0.13), P(-r, y + 0.07, 0.13)],
        F.n,
        rgb('b6b7a3'),
      );
    }
  }
}
function roofs(o, d) {
  const x = W / 2 + 0.25,
    z = D / 2 + 0.25,
    lo = f + A.wallHeight,
    hi = lo + A.roofRise,
    r = x - 1.9;
  roofQuad(
    o,
    [
      [-x, lo, -z],
      [x, lo, -z],
      [r, hi, 0],
      [-r, hi, 0],
    ],
    d,
  );
  roofQuad(
    o,
    [
      [x, lo, z],
      [-x, lo, z],
      [-r, hi, 0],
      [r, hi, 0],
    ],
    d,
  );
  T(
    o,
    'roof',
    [
      [x, lo, -z],
      [x, lo, z],
      [r, hi, 0],
    ],
    [1, 1, 0],
  );
  T(
    o,
    'roof',
    [
      [-x, lo, z],
      [-x, lo, -z],
      [-r, hi, 0],
    ],
    [-1, 1, 0],
  );
  // Attic ventilation gablets face west, east and north; the building has no telescope dome.
  for (const side of [-1, 1]) {
    const xx = side * (r + 0.2),
      y = hi - 1.3,
      F = face((u, h, v = 0) => [xx + side * v, y + h, u], [side, 0, 0]);
    vent(o, F, 3.4, 1.45, d);
    roofQuad(
      o,
      [
        [xx, y, -1.8],
        [xx, y + 1.5, 0],
        [xx - side * 1.7, hi + 0.08, 0],
        [xx - side * 1.7, hi - 0.6, -1.8],
      ],
      d,
    );
    roofQuad(
      o,
      [
        [xx, y + 1.5, 0],
        [xx, y, 1.8],
        [xx - side * 1.7, hi - 0.6, 1.8],
        [xx - side * 1.7, hi + 0.08, 0],
      ],
      d,
    );
  }
  const nz = -z + 2.15,
    ny = lo + 0.65,
    NF = face((u, y, v = 0) => [u, ny + y, nz - v], [0, 0, -1]);
  vent(o, NF, 3.5, 1.75, d);
  roofQuad(
    o,
    [
      [-1.85, ny, nz],
      [0, ny + 1.85, nz],
      [0, hi + 0.1, -0.25],
      [-1.85, hi - 0.55, -0.25],
    ],
    d,
  );
  roofQuad(
    o,
    [
      [0, ny + 1.85, nz],
      [1.85, ny, nz],
      [1.85, hi - 0.55, -0.25],
      [0, hi + 0.1, -0.25],
    ],
    d,
  );
  const ex = A.entryX,
    ez = -D / 2 - 0.65,
    ey = lo - 0.12,
    EF = face((u, y, v = 0) => [ex + u, ey + y, ez - v], [0, 0, -1]);
  T(o, 'wall', [EF.P(-1.05, 0), EF.P(1.05, 0), EF.P(0, 0.8)], [0, 0, -1]);
  for (const side of [-1, 1])
    roofQuad(
      o,
      [
        [ex, ey + 0.85, ez - 0.05],
        [ex + side * 1.15, ey - 0.03, ez - 0.05],
        [ex + side * 1.15, ey - 0.03, ez + 1.8],
        [ex, ey + 0.85, ez + 1.8],
      ],
      d,
    );
  if (d > 0) {
    for (const zz of [-z, z]) box(o, 'trim', 0, lo - 0.14, zz, W + 0.6, 0.14, 0.12);
    for (const xx of [-x, x]) box(o, 'trim', xx, lo - 0.14, 0, 0.12, 0.14, D + 0.6);
    box(o, 'roof', 0, hi, 0, r * 2, 0.1, 0.1);
  }
}
function supports(o, d) {
  box(o, 'wood', 0, f - 0.2, 0, W, 0.2, D);
  const nx = [5, 8, 8, 8][d],
    nz = [3, 5, 5, 5][d];
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = -W / 2 + 0.25 + ((W - 0.5) * i) / (nx - 1),
        z = -D / 2 + 0.25 + ((D - 0.5) * j) / (nz - 1),
        y = crohamhurstObservatoryGround(x, z) - 0.15;
      box(o, 'wood', x, y, z, 0.24, f - 0.2 - y, 0.24);
    }
  if (d > 0) {
    for (const z of [-D / 2 + 0.15, 0, D / 2 - 0.15]) box(o, 'wood', 0, f - 0.44, z, W, 0.25, 0.18);
    if (d > 1)
      for (let x = -W / 2 + 0.6; x < W / 2; x += 1.4) box(o, 'wood', x, f - 0.34, 0, 0.09, 0.12, D);
  }
  const n = d === 0 ? 3 : 7,
    x = A.entryX,
    z0 = -D / 2 - 0.05,
    z1 = -D / 2 - 3.25,
    g0 = crohamhurstObservatoryGround(x, z1),
    floor = f;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n,
      y = g0 + (floor - g0) * t,
      z = z1 + ((z0 - z1) * (i + 0.5)) / n;
    box(o, 'wood', x, y - 0.14, z, 1.65, 0.14, (z0 - z1) / n + 0.02);
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      for (const z of [z0, z1])
        box(
          o,
          'trim',
          x + side * 0.9,
          crohamhurstObservatoryGround(x, z),
          z,
          0.09,
          (z === z0 ? f : g0) + 0.9 - crohamhurstObservatoryGround(x, z),
          0.09,
        );
      const xx = x + side * 0.9,
        upper = [
          [xx - 0.035, f + 0.9, z0],
          [xx + 0.035, f + 0.9, z0],
          [xx + 0.035, g0 + 0.9, z1],
          [xx - 0.035, g0 + 0.9, z1],
        ],
        lower = upper.map(([x, y, z]) => [x, y - 0.08, z]);
      Q(o, 'trim', upper, [0, 1, 0]);
      Q(o, 'trim', lower.toReversed(), [0, -1, 0]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        Q(o, 'trim', [upper[i], upper[j], lower[j], lower[i]], null);
      }
    }
}
function building(o, d) {
  supports(o, d);
  const front = Array.from({ length: A.frontBays }, (_, i) => ({
    c: (W * (i + 0.5)) / A.frontBays,
    w: 1.62,
  })).filter((e) => Math.abs(e.c - W / 2 - A.entryX) > 1.8);
  front.push({ c: W / 2 + A.entryX, w: 1.15, b: 0, h: 2.2, door: true });
  wall(o, north(), W, A.wallHeight, front, d);
  wall(
    o,
    east(),
    D,
    A.wallHeight,
    Array.from({ length: A.eastBays }, (_, i) => ({ c: (D * (i + 0.5)) / A.eastBays, w: 1.75 })),
    d,
  );
  wall(
    o,
    south(),
    W,
    A.wallHeight,
    [3, 8, 13].map((c) => ({ c, w: 1.3, b: 1.05, h: 1.25 })),
    d,
  );
  wall(
    o,
    west(),
    D,
    A.wallHeight,
    [3, 8, 12.7].map((c) => ({ c, w: 1.3, b: 1.05, h: 1.25 })),
    d,
  );
  roofs(o, d);
  const B = A.shed,
    x = (B.x0 + B.x1) / 2,
    z = (B.z0 + B.z1) / 2,
    w = B.x1 - B.x0,
    l = B.z1 - B.z0;
  box(o, 'wall', x, f, z, w, B.height, l, rgb('b3b2a1'));
  roofQuad(
    o,
    [
      [B.x0 - 0.12, f + B.height + 0.12, B.z0 - 0.1],
      [B.x1 + 0.12, f + B.height + 0.12, B.z0 - 0.1],
      [B.x1 + 0.12, f + B.height - 0.2, B.z1 + 0.15],
      [B.x0 - 0.12, f + B.height - 0.2, B.z1 + 0.15],
    ],
    d,
  );
  const gy = crohamhurstObservatoryGround(x, z) - 0.1;
  for (const xx of [B.x0 + 0.15, B.x1 - 0.15])
    for (const zz of [B.z0 + 0.15, B.z1 - 0.15]) box(o, 'wood', xx, gy, zz, 0.2, f - gy, 0.2);
  Q(
    o,
    'wood',
    [
      [B.x0 - 0.014, f, B.z0 + 0.7],
      [B.x0 - 0.014, f, B.z0 + 1.9],
      [B.x0 - 0.014, f + 1.9, B.z0 + 1.9],
      [B.x0 - 0.014, f + 1.9, B.z0 + 0.7],
    ],
    [-1, 0, 0],
  );
}
function screen(o, d) {
  const { x, z } = A.screen,
    y = crohamhurstObservatoryGround(x, z),
    H = 1.2,
    w = 0.85,
    l = 0.7;
  for (const xx of [-0.32, 0.32])
    for (const zz of [-0.25, 0.25])
      box(o, 'trim', x + xx, y, z + zz, 0.045, H, 0.045, rgb('747c73'));
  if (d > 0) {
    box(o, 'trim', x, y + 1.02, z, 0.75, 0.05, 0.05);
    box(o, 'trim', x, y + 0.4, z, 0.05, 0.05, 0.6);
  }
  box(o, 'wood', x, y + H, z, w, 0.62, l, rgb('3d453e'));
  const count = [3, 6, 9, 12][d];
  for (const side of [-1, 1])
    for (let i = 0; i < count; i++) {
      const h = y + H + ((i + 0.25) * 0.62) / count;
      Q(
        o,
        'trim',
        [
          [x - w / 2, h, z + side * (l / 2 + 0.03)],
          [x + w / 2, h, z + side * (l / 2 + 0.03)],
          [x + w / 2, h + 0.06, z + side * (l / 2 + 0.08)],
          [x - w / 2, h + 0.06, z + side * (l / 2 + 0.08)],
        ],
        [0, 0, side],
      );
      Q(
        o,
        'trim',
        [
          [x + side * (w / 2 + 0.03), h, z - l / 2],
          [x + side * (w / 2 + 0.03), h, z + l / 2],
          [x + side * (w / 2 + 0.08), h + 0.06, z + l / 2],
          [x + side * (w / 2 + 0.08), h + 0.06, z - l / 2],
        ],
        [side, 0, 0],
      );
    }
  for (const h of [y + H + 0.64, y + H + 0.76]) box(o, 'trim', x, h, z, 1.02, 0.06, 0.88);
}
function instruments(o, d) {
  screen(o, d);
  const N = [6, 8, 12, 20][d];
  for (let i = 0; i < 4; i++) {
    const x = A.temperaturePits.x + (i % 2) * 0.65,
      z = A.temperaturePits.z + Math.floor(i / 2) * 0.8,
      y = crohamhurstObservatoryGround(x, z);
    cylinder(o, 'base', x, y - 0.04, z, 0.13, 0.3, N, rgb('9d7451'));
    cylinder(o, 'roof', x, y + 0.26, z, 0.17, 0.045, N, rgb('8e958b'));
  }
  const sx = A.screen.x,
    sz = A.screen.z - 2.1,
    sy = crohamhurstObservatoryGround(sx, sz);
  box(o, 'base', sx, sy, sz, 1.8, 0.09, 0.38);
  for (let i = 0; i < (d === 0 ? 2 : 4); i++)
    cylinder(o, 'base', sx - 0.65 + i * 0.4, sy + 0.09, sz, 0.055, 0.08, N, rgb('777f74'));
  const U = A.sundial,
    uy = crohamhurstObservatoryGround(U.x, U.z);
  box(o, 'base', U.x, uy, U.z, 0.35, 0.85, 0.35);
  box(o, 'base', U.x, uy + 0.85, U.z, 0.55, 0.08, 0.5);
  const M = A.telescopeMarker,
    my = crohamhurstObservatoryGround(M.x, M.z);
  box(o, 'base', M.x, my, M.z, 0.75, 0.22, 0.5);
  Q(
    o,
    'wood',
    [
      [M.x - 0.28, my + 0.225, M.z - 0.16],
      [M.x + 0.28, my + 0.225, M.z - 0.16],
      [M.x + 0.28, my + 0.225, M.z + 0.16],
      [M.x - 0.28, my + 0.225, M.z + 0.16],
    ],
    [0, 1, 0],
    rgb('5d6559'),
  );
}
function build(o, _f, d = 3) {
  building(o, d);
  instruments(o, d);
}
export const crohamhurstObservatorySkyline = (o, f) => build(o, f, 0),
  crohamhurstObservatoryDistrict = (o, f) => build(o, f, 1),
  crohamhurstObservatoryStreet = (o, f) => build(o, f, 2),
  crohamhurstObservatoryCloseup = (o, f) => build(o, f, 3);
export const crohamhurstObservatoryModel = {
  id: 'crohamhurst_observatory',
  key: 'crohamhurst_observatory',
  cell: 'r7/r7h',
  recipe: 'structure-crohamhurst-observatory.mjs',
  title: 'Crohamhurst Observatory',
  category: 'museum-library',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-36, 25, -42],
  lookAt: [1, 2, 0],
  mediumFiContext: { scale: 1.3 },
  qaCameras: [
    {
      name: 'whole-observatory-three-gablets-enclosed-verandas-and-instruments',
      position: [-36, 25, -42],
      lookAt: [1, 2, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'north-casements-weatherboards-entry-gable-and-open-stumps',
      position: [-6, 6, -19],
      lookAt: [1, 3, -6],
    },
    {
      name: 'north-east-louvred-gablets-roof-and-enclosed-return',
      position: [27, 15, -21],
      lookAt: [5, 4, -1],
    },
    {
      name: 'south-west-attached-shed-hip-roof-and-timber-subfloor',
      position: [-24, 10, 20],
      lookAt: [-7, 2, 7],
    },
    {
      name: 'stevenson-screen-pit-caps-and-surviving-instrument-stands',
      position: [21, 5, -14],
      lookAt: [14, 2, -7],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-crohamhurst-observatory.mjs',
    level: 'skyline',
    export: 'crohamhurstObservatorySkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'crohamhurstObservatoryDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'crohamhurstObservatoryStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'crohamhurstObservatoryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole surviving single-storey timber observatory and intrinsic weather instruments, with current enclosed north/east weatherboard/casement verandas, hipped fibre-cement roof/three louvred gablets/entry gable, genuine open timber-stump underfloor, attached southwest lean-to and meteorological devices. No telescope dome, removed telescope, independent house/workshop, private garden/trees/people/vehicles/bunting or copied memorial text.',
    'One exact1432x1003 expired1935 Courier-Mail opening photograph controls original roof/post/veranda proportions; it depicts the formerly open verandas, not current enclosures or all sides. Current enclosure/shed/instruments derive from official QHR602682 text, itself based on boundary observations/heritage photos rather than a complete site survey. Fine bay/door/vent census, sections, shed dimensions and instrument locations remain bounded estimates. Neutral light weatherboards/gray fibre-cement/painted frames inferred from grayscale/type, not copyrighted modern colour images.',
    'Actual QRA public333.265m² front roof rectangle fixes21.235m by15.757m metric extent and bearing; its identification as observatory is a supported geometric/context inference, not an official named building label. Automated TWOSTOREY/slab/floor/height attributes are not accepted as literal construction facts. Eastern210.90m² and southern201.13m² independent roofs excluded. Shed projection and instrument layout are not separately mapped parts. Compatible independent ground required; provider DEM may include vegetation/surface effects, exact contact unsurveyed/replacement disabled.',
    'Four LODs retain complete roof/three vent gablets/entry/current enclosures/open supports/attached shed and instruments. Near details restore recessed divided casements/weatherboard edges, attic and Stevenson slats, corrugation geometry, joists and entry rails. Six actual canonical surface slots, five shared graphs and local glazing. Fibre-cement roof uses rough concrete-panel binding with original corrugated geometry; small painted instrument supports use neutral trim approximation.',
  ],
};
