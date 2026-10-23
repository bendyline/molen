/** Hotel Corones: open two-storey verandas, shaped parapets and the intrinsic ballroom/Hall. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { lettering } from './stadium-lettering.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r5/r5r/hotel_corones/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('cfcebb'),
    trim: rgb('c4c3ae'),
    roof: rgb('8e9690'),
    brick: rgb('8e6250'),
    tile: rgb('4b5550'),
    glass: rgb('435551'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.91, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.82, metallic: 0.2 },
    brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
    tile: { slot: 'foundation', graph: 'tile_mosaic', roughness: 0.78, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.05 },
  };
export function hotelCoronesGround(x, z) {
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
const Y = (y) => A.floorY + y;
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
function polyXY(o, s, P, depth, F, col = C[s]) {
  const ids = earcut(P.flat()),
    V = (q, d) => F(q[0], q[1], d);
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => P[k]);
    T(
      o,
      s,
      q.map((p) => V(p, 0)),
      null,
      col,
    );
    T(
      o,
      s,
      q.toReversed().map((p) => V(p, -depth)),
      null,
      col,
    );
  }
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    Q(o, s, [V(P[i], 0), V(P[j], 0), V(P[j], -depth), V(P[i], -depth)], null, col);
  }
}
const front = (x0, z) => ({ P: (u, y, d = 0) => [x0 + u, Y(y), z + d], n: [0, 0, 1] }),
  north = (x, z0) => ({ P: (u, y, d = 0) => [x - d, Y(y), z0 + u], n: [-1, 0, 0] });
function patch(o, s, f, l, r, lo, hi, dep = 0, col = C[s]) {
  Q(o, s, [f.P(l, lo, dep), f.P(r, lo, dep), f.P(r, hi, dep), f.P(l, hi, dep)], f.n, col);
}
function facade(o, f, L, H, count, d, rooms = false) {
  const rows = rooms
      ? [
          [0.3, 3.5],
          [4.65, 7.55],
        ]
      : [[0.9, 2.9]],
    w = rooms ? 1.38 : 1.2;
  if (d < 2) patch(o, 'wall', f, 0, L, 0, H);
  for (let i = 0; i < count; i++) {
    const c = ((i + 0.5) * L) / count,
      l = c - w / 2,
      r = c + w / 2;
    if (d > 1) {
      patch(o, 'wall', f, (i * L) / count, l, 0, H);
      patch(o, 'wall', f, r, ((i + 1) * L) / count, 0, H);
      let last = 0;
      for (const [lo, hi] of rows) {
        patch(o, 'wall', f, l, r, last, lo);
        last = hi;
      }
      patch(o, 'wall', f, l, r, last, H);
    }
    if (d === 0 && i % 3 !== 0) continue;
    for (const [lo, hi] of rows) {
      const dep = d < 2 ? 0.025 : -0.2;
      patch(o, 'glass', f, l, r, lo, hi, dep);
      if (d > 1) {
        for (const x of [l, r])
          Q(o, 'trim', [f.P(x, lo), f.P(x, lo, -0.2), f.P(x, hi, -0.2), f.P(x, hi)], f.n);
        for (const y of [lo, hi])
          Q(
            o,
            'trim',
            [f.P(l, y), f.P(r, y), f.P(r, y, -0.2), f.P(l, y, -0.2)],
            [0, y === lo ? 1 : -1, 0],
          );
        patch(o, 'trim', f, c - 0.045, c + 0.045, lo, hi, -0.15);
        for (let j = 1; j < (d === 3 ? 5 : 3); j++) {
          const y = lo + ((hi - lo) * j) / (d === 3 ? 5 : 3);
          patch(o, 'trim', f, l, r, y - 0.025, y + 0.025, -0.15);
        }
      }
      if (d > 0)
        for (const [a, b, y0, y1] of [
          [l - 0.1, l, lo - 0.1, hi + 0.1],
          [r, r + 0.1, lo - 0.1, hi + 0.1],
          [l, r, lo - 0.1, lo],
          [l, r, hi, hi + 0.1],
        ])
          patch(o, 'trim', f, a, b, y0, y1, 0.04);
    }
  }
  if (rooms) {
    if (d < 2) patch(o, 'tile', f, 0, L, 0, 1.25, 0.02);
    else {
      for (let i = 0; i < count; i++) {
        const c = ((i + 0.5) * L) / count;
        patch(o, 'tile', f, (i * L) / count, c - w / 2, 0, 1.25, 0.02);
        patch(o, 'tile', f, c + w / 2, ((i + 1) * L) / count, 0, 1.25, 0.02);
      }
      patch(o, 'tile', f, 0, L, 0, 0.3, 0.02);
    }
    patch(o, 'wall', f, 0, L, 4.05, 4.4, 0.035);
  }
}
function name(o, text, f, c, y, w, h, d) {
  if (d < 2) return;
  const proxy = {
    addQuad(s, r, vs, n, uv, col) {
      this.addTriangle(s, r, vs.slice(0, 3), n, uv, col);
      this.addTriangle(s, r, [vs[0], vs[2], vs[3]], n, uv, col);
    },
    addTriangle(s, _r, vs, _n, _uv, col) {
      const q = vs.map((v) => f.P(c + v[0], y + v[1], 0.06 + v[2]));
      T(o, s, q, null, col);
    },
    addConvexPolygon(s, r, vs, n, _uv, col) {
      for (let i = 1; i < vs.length - 1; i++)
        this.addTriangle(s, r, [vs[0], vs[i], vs[i + 1]], n, null, col);
    },
  };
  lettering(proxy, text.replaceAll('O', '0'), {
    width: w,
    height: h,
    slot: 'brick',
    stroke: d === 2 ? 0.065 : 0.045,
    color: rgb('666b5e'),
  });
}
function dates(o, f, c, text, d) {
  if (d < 2) return;
  const nums = {
    1: [
      [
        [0.5, 0],
        [0.5, 1],
        [0.25, 0.8],
      ],
    ],
    2: [
      [
        [0, 0.85],
        [0.2, 1],
        [0.8, 1],
        [1, 0.8],
        [0, 0],
        [1, 0],
      ],
    ],
    4: [
      [
        [0.8, 0],
        [0.8, 1],
        [0, 0.3],
        [1, 0.3],
      ],
    ],
    9: [
      [
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0.5],
        [1, 0.5],
      ],
    ],
  };
  for (let k = 0; k < text.length; k++)
    for (const line of nums[text[k]] ?? [])
      for (let j = 1; j < line.length; j++) {
        const a = line[j - 1],
          b = line[j],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          L = Math.hypot(dx, dy),
          ux = (-dy / L) * 0.025,
          uy = (dx / L) * 0.025,
          V = (q) => [c + (k - text.length / 2) * 0.42 + q[0] * 0.32, 9.05 + q[1] * 0.3];
        const P = [V(a), V(b)];
        polyXY(
          o,
          'brick',
          [
            [P[0][0] + ux, P[0][1] + uy],
            [P[1][0] + ux, P[1][1] + uy],
            [P[1][0] - ux, P[1][1] - uy],
            [P[0][0] - ux, P[0][1] - uy],
          ],
          0.025,
          (x, y, z) => f.P(x, y, z + 0.08),
        );
      }
}
function shapedGable(o, f, c, w, d, label = 'HOTEL CORONES') {
  const n = [4, 6, 12, 20][d],
    P = [
      [c - w / 2, 9.5],
      [c + w / 2, 9.5],
      [c + w / 2, 10.05],
      [c + 1.65, 10.05],
    ];
  for (let i = 0; i <= n; i++) {
    const t = (Math.PI * i) / n;
    P.push([c + 1.5 * Math.cos(t), 10.1 + 0.95 * Math.sin(t)]);
  }
  P.push([c - 1.65, 10.05], [c - w / 2, 10.05]);
  polyXY(o, 'wall', P, 0.25, f.P);
  if (d > 0)
    for (let i = 0; i < P.length; i++) {
      const j = (i + 1) % P.length;
      if (i === 0) continue;
      const a = P[i],
        b = P[j],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 0.01) continue;
      const dy = 0.09;
      polyXY(
        o,
        'wall',
        [
          [a[0], a[1]],
          [b[0], b[1]],
          [b[0], b[1] + dy],
          [a[0], a[1] + dy],
        ],
        0.33,
        (x, y, z) => f.P(x, y, z + 0.035),
      );
    }
  name(o, label, f, c, 9.68, w - 1.0, 0.48, d);
}
function parapets(o, d) {
  const f = front(0, 0.12),
    n = north(-32.35, -19.7);
  box(o, 'wall', 0, Y(8.32), -0.05, 64.7, 1.35, 0.28);
  box(o, 'wall', -32.31, Y(8.32), -9.8, 0.28, 1.35, 19.8);
  box(o, 'wall', 32.12, Y(8.32), -8.6, 0.28, 1.25, 17.2);
  for (const y of [8.35, 8.65, 9.68]) {
    box(o, 'wall', 0, Y(y), 0.03, 64.9, 0.15, 0.48);
    box(o, 'wall', -32.4, Y(y), -9.8, 0.48, 0.15, 19.9);
  }
  for (const c of [-28.5, 0, 28.5]) shapedGable(o, f, c, d === 0 ? 5.6 : 6.0, d);
  shapedGable(o, n, 9.8, 6, d);
  dates(o, f, 28.5, '1924', d);
  dates(o, f, -28.5, '1929', d);
  const k = d === 0 ? 4 : d === 1 ? 10 : 22;
  for (let i = 0; i <= k; i++) {
    const x = -32.3 + (64.6 * i) / k;
    box(o, 'wall', x, Y(8.65), 0.12, 0.28, 1.15, 0.4);
  }
  if (d > 1) {
    const N = d === 2 ? 76 : 130;
    for (let i = 0; i <= N; i++)
      box(o, 'wall', -32.2 + (64.4 * i) / N, Y(8.17), 0.14, 0.18, 0.18, 0.3);
    for (let i = 0; i < 28; i++) box(o, 'wall', -32.4, Y(8.17), -19.5 + i * 0.7, 0.3, 0.18, 0.18);
  }
}
function verandaRun(o, f, L, count, d) {
  const n = d === 0 ? Math.ceil(count / 4) : count;
  for (let i = 0; i <= n; i++) {
    const u = (L * i) / n,
      v = f.P(u, 0);
    box(o, 'trim', v[0], Y(0), v[2], 0.16, 8.3, 0.16);
    if (d > 0 && (d > 1 || i % 2 === 0))
      for (const y of [3.9, 7.85]) {
        const P = [
          [u - 0.55, y + 0.4],
          [u + 0.55, y + 0.4],
          [u + 0.48, y + 0.05],
          [u + 0.16, y - 0.15],
          [u - 0.16, y - 0.15],
          [u - 0.48, y + 0.05],
        ];
        polyXY(o, 'trim', P, 0.16, (x, y, z) => f.P(x, y, z + 0.08));
      }
  }
  for (const [lo, hi] of [
    [4.45, 4.61],
    [5.5, 5.64],
    [8.13, 8.3],
  ])
    patch(o, 'trim', f, 0, L, lo, hi, 0.09);
  if (d > 0) {
    const N = Math.ceil(L / [5, 1.4, 0.5][d - 1]);
    for (let i = 0; i <= N; i++) {
      const u = (L * i) / N;
      polyXY(
        o,
        'trim',
        [
          [u - 0.035, 4.61],
          [u + 0.035, 4.61],
          [u + 0.035, 5.5],
          [u - 0.035, 5.5],
        ],
        0.09,
        (x, y, z) => f.P(x, y, z + 0.07),
      );
    }
  }
}
function mainHotel(o, d) {
  const x0 = A.wallNorth,
    x1 = A.wallSouth,
    z0 = A.wallRear,
    z1 = A.wallFront;
  box(o, 'wall', (x0 + x1) / 2, Y(-0.2), (z0 + z1) / 2, x1 - x0, 0.2, z1 - z0);
  facade(o, front(x0, z1), x1 - x0, 8.5, 21, d, true);
  facade(o, north(x0, z0), z1 - z0, 8.5, 5, d, true);
  const back = { P: (u, y, dep = 0) => [x1 - u, Y(y), z0 - dep], n: [0, 0, -1] },
    end = { P: (u, y, dep = 0) => [x1 + dep, Y(y), z1 - u], n: [1, 0, 0] };
  facade(o, back, x1 - x0, 8.5, d === 0 ? 6 : 17, d, true);
  facade(o, end, z1 - z0, 8.5, 4, d, true);
  // The skillion is geometry behind the parapets, without an invented gabled hotel roof.
  Q(
    o,
    'roof',
    [
      [x0, Y(8.5), z1],
      [x1, Y(8.5), z1],
      [x1, Y(7.95), z0],
      [x0, Y(7.95), z0],
    ],
    [0, 1, 0],
  );
  for (const y of [0, 4.3]) {
    box(o, 'wall', 0, Y(y), -1.55, 64.57, 0.2, 3.35);
    box(o, 'wall', -30.5, Y(y), -11, 3.6, 0.2, 15.8);
  }
  Q(
    o,
    'roof',
    [
      [-32.3, Y(8.3), 0],
      [32.3, Y(8.3), 0],
      [32.3, Y(8.52), -3.2],
      [-32.3, Y(8.52), -3.2],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [-32.3, Y(8.3), -19.7],
      [-28.7, Y(8.52), -19.7],
      [-28.7, Y(8.52), -3.2],
      [-32.3, Y(8.3), -3.2],
    ],
    [0, 1, 0],
  );
  verandaRun(o, front(-32.2, -0.03), 64.4, 22, d);
  verandaRun(o, north(-32.2, -19.65), 16.45, 6, d);
  parapets(o, d);
  // Native rear kitchen projection, two prominent fireplaces and the southern rear veranda.
  box(o, 'wall', 10, Y(0), -20.25, 16, 4.45, 5.0);
  box(o, 'roof', 10, Y(4.45), -20.25, 16.2, 0.18, 5.2);
  for (const x of [4, 15.5]) {
    box(o, 'brick', x, Y(0), -22.7, 1.0, 6.0, 0.8);
    box(o, 'wall', x, Y(5.9), -22.7, 1.18, 0.25, 1.0);
  }
  box(o, 'wall', 33.6, Y(0), -11.8, 3.8, 7.7, 5.2);
  box(o, 'roof', 33.6, Y(7.7), -11.8, 4, 0.16, 5.4);
  box(o, 'trim', 25, Y(4.3), -18.1, 13, 0.2, 2.8);
  if (d > 0) for (const x of [19, 22, 25, 28, 31]) box(o, 'trim', x, Y(0), -19.4, 0.15, 7.8, 0.15);
}
function roundWindow(o, f, c, b, r, d) {
  const n = [4, 6, 12, 20][d];
  patch(o, 'glass', f, c - r, c + r, b, b + 1.4, d < 2 ? 0.05 : -0.12);
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      t = (Math.PI * (i + 1)) / n;
    T(
      o,
      'glass',
      [
        f.P(c, b + 1.4, d < 2 ? 0.05 : -0.12),
        f.P(c + r * Math.cos(a), b + 1.4 + r * Math.sin(a), d < 2 ? 0.05 : -0.12),
        f.P(c + r * Math.cos(t), b + 1.4 + r * Math.sin(t), d < 2 ? 0.05 : -0.12),
      ],
      f.n,
    );
  }
  if (d > 1) {
    patch(o, 'trim', f, c - 0.035, c + 0.035, b, b + 1.4 + r, -0.08);
    patch(o, 'trim', f, c - r, c + r, b + 1.3, b + 1.4, -0.08);
  }
}
function archedFacade(o, f, L, H, openings, d) {
  let last = 0;
  for (const a of openings) {
    const l = a.c - a.r,
      r = a.c + a.r;
    patch(o, 'wall', f, last, l, 0, H);
    patch(o, 'wall', f, l, r, 0, a.lo);
    if (a.stem > 3) {
      patch(o, 'wall', f, l, r, a.lo + a.stem, H);
    } else {
      const n = d === 2 ? 12 : 20;
      for (let i = 0; i < n; i++) {
        const t = Math.PI - (Math.PI * i) / n,
          u = Math.PI - (Math.PI * (i + 1)) / n,
          x0 = a.c + a.r * Math.cos(t),
          x1 = a.c + a.r * Math.cos(u),
          y0 = a.lo + a.stem + a.r * Math.sin(t),
          y1 = a.lo + a.stem + a.r * Math.sin(u);
        Q(o, 'wall', [f.P(x0, y0), f.P(x1, y1), f.P(x1, H), f.P(x0, H)], f.n);
        Q(o, 'wall', [f.P(x0, y0), f.P(x0, y0, -0.22), f.P(x1, y1, -0.22), f.P(x1, y1)], f.n);
      }
    }
    for (const x of [l, r])
      Q(
        o,
        'wall',
        [f.P(x, a.lo), f.P(x, a.lo, -0.22), f.P(x, a.lo + a.stem, -0.22), f.P(x, a.lo + a.stem)],
        f.n,
      );
    last = r;
  }
  patch(o, 'wall', f, last, L, 0, H);
}
function wings(o, d) {
  const B = A.ballroom,
    H = A.hall;
  for (const [W, s] of [
    [B, 'wall'],
    [H, 'brick'],
  ]) {
    const x = (W.x0 + W.x1) / 2,
      z = (W.z0 + W.z1) / 2;
    if (d < 2) box(o, s, x, Y(0), z, W.x1 - W.x0, W.height, W.z1 - W.z0);
    else {
      box(o, s, W.x1 - 0.12, Y(0), z, 0.24, W.height, W.z1 - W.z0);
      for (const zz of [W.z0 + 0.12, W.z1 - 0.12])
        box(o, s, x, Y(0), zz, W.x1 - W.x0, W.height, 0.24);
      box(o, s, x, Y(-0.15), z, W.x1 - W.x0, 0.15, W.z1 - W.z0);
    }
  }
  box(o, 'roof', (B.x0 + B.x1) / 2, Y(B.height), (B.z0 + B.z1) / 2, B.x1 - B.x0, 0.15, B.z1 - B.z0);
  const bf = north(B.x0 - 0.03, B.z0),
    hf = north(H.x0 - 0.04, H.z0),
    bw = B.z1 - B.z0,
    hw = H.z1 - H.z0;
  if (d < 2) {
    patch(o, 'wall', bf, 0, bw, 0, 5.1, 0.02);
    patch(o, 'wall', hf, 0, hw, 0, 4.9, 0.02);
  } else {
    archedFacade(
      o,
      bf,
      bw,
      5.1,
      [
        { c: 1.9, r: 0.85, lo: 1.1, stem: 1.4 },
        { c: bw / 2, r: 0.8, lo: 0.1, stem: 3.1 },
        { c: bw - 1.9, r: 0.85, lo: 1.1, stem: 1.4 },
      ],
      d,
    );
    archedFacade(o, hf, hw, 4.9, [{ c: hw / 2, r: 1.3, lo: 0.1, stem: 3.6 }], d);
  }
  for (const f of [bf, hf]) patch(o, 'tile', f, 0, f === bf ? bw : hw, 0, 0.35, 0.04);
  patch(o, 'glass', bf, bw / 2 - 0.8, bw / 2 + 0.8, 0.1, 3.2, d < 2 ? 0.04 : -0.12);
  patch(o, 'glass', hf, hw / 2 - 1.3, hw / 2 + 1.3, 0.1, 3.7, d < 2 ? 0.04 : -0.12);
  for (const c of [1.9, bw - 1.9]) roundWindow(o, bf, c, 1.1, 0.85, d);
  for (const z of [H.z0 + 0.5, H.z1 - 0.5]) box(o, 'wall', H.x0 - 0.12, Y(0), z, 0.35, 6.7, 0.45);
  box(o, 'wall', B.x0 - 0.07, Y(4.92), (B.z0 + B.z1) / 2, 0.35, 0.18, bw + 0.2);
  // Hall's actual described step-gable and separate round entrance pediment remain physically distinct.
  const G = [
    [0, 5.0],
    [hw, 5.0],
    [hw, 6.1],
    [hw - 1.8, 6.1],
    [hw - 1.8, 6.65],
    [hw - 3.3, 6.65],
    [hw - 3.3, 7.2],
    [hw / 2 + 1.3, 7.2],
    [hw / 2 + 1.3, 7.8],
    [hw / 2 - 1.3, 7.8],
    [hw / 2 - 1.3, 7.2],
    [3.3, 7.2],
    [3.3, 6.65],
    [1.8, 6.65],
    [1.8, 6.1],
    [0, 6.1],
  ];
  polyXY(o, 'brick', G, 0.25, (x, y, z) => hf.P(x, y, z + 0.02));
  for (let i = 0; i < G.length; i++) {
    const j = (i + 1) % G.length,
      a = G[i],
      b = G[j];
    if (a[1] === b[1])
      polyXY(
        o,
        'wall',
        [
          [a[0], a[1]],
          [b[0], b[1]],
          [b[0], b[1] + 0.1],
          [a[0], a[1] + 0.1],
        ],
        0.35,
        (x, y, z) => hf.P(x, y, z + 0.07),
      );
  }
  const n = [4, 6, 12, 20][d];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      R = (t) => [hw / 2 + 2.0 * Math.cos(t), 4.85 + 1.15 * Math.sin(t)];
    polyXY(o, 'wall', [[hw / 2, 4.85], R(a), R(b)], 0.3, (x, y, z) => hf.P(x, y, z + 0.08));
  }
  patch(o, 'wall', hf, hw / 2 - 3.8, hw / 2 + 3.8, 6.05, 6.9, 0.05);
  name(o, 'CORONES HALL', hf, hw / 2, 6.2, 6.8, 0.46, d);
  if (d > 1)
    for (const [c, y] of [
      [hw / 2, 7.4],
      [2, 6.1],
      [hw - 2, 6.1],
    ])
      polyXY(
        o,
        'wall',
        [
          [c - 0.25, y],
          [c, y + 0.25],
          [c + 0.25, y],
          [c, y - 0.25],
        ],
        0.045,
        (x, y, z) => hf.P(x, y, z + 0.1),
      );
  const zc = (H.z0 + H.z1) / 2;
  Q(
    o,
    'roof',
    [
      [H.x0, Y(5.9), H.z0],
      [H.x1, Y(5.9), H.z0],
      [H.x1, Y(7.9), zc],
      [H.x0, Y(7.9), zc],
    ],
    [0, 1, -1],
  );
  Q(
    o,
    'roof',
    [
      [H.x0, Y(7.9), zc],
      [H.x1, Y(7.9), zc],
      [H.x1, Y(5.9), H.z1],
      [H.x0, Y(5.9), H.z1],
    ],
    [0, 1, 1],
  );
}
function build(o, _f, d = 3) {
  mainHotel(o, d);
  wings(o, d);
}
export const hotelCoronesSkyline = (o, f) => build(o, f, 0),
  hotelCoronesDistrict = (o, f) => build(o, f, 1),
  hotelCoronesStreet = (o, f) => build(o, f, 2),
  hotelCoronesCloseup = (o, f) => build(o, f, 3);
export const hotelCoronesModel = {
  id: 'hotel_corones',
  key: 'hotel_corones',
  cell: 'r5/r5r',
  recipe: 'structure-hotel-corones.mjs',
  recipeDependencies: ['stadium-lettering.mjs'],
  title: 'Hotel Corones',
  category: 'hotel',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-70, 40, 83],
  lookAt: [0, 4, -16],
  mediumFiContext: { scale: 1.25 },
  qaCameras: [
    {
      name: 'whole-hotel-wills-galatea-verandas-and-intrinsic-ballroom-hall',
      position: [-70, 40, 83],
      lookAt: [0, 4, -16],
      reviewLod: 'skyline',
    },
    {
      name: 'genuinely-open-two-storey-verandah-battens-brackets-and-french-doors',
      position: [14, 7.3, 11],
      lookAt: [-1, 4.7, -2],
    },
    {
      name: 'high-shaped-parapets-relief-name-panels-dentils-and-skillion-roof',
      position: [8, 16, 13],
      lookAt: [0, 10, -1],
    },
    {
      name: 'galatea-return-ballroom-round-windows-and-stepped-corones-hall',
      position: [-51, 13, -28],
      lookAt: [-25, 4, -29],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-corones.mjs',
    level: 'skyline',
    export: 'hotelCoronesSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'hotelCoronesDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'hotelCoronesStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'hotelCoronesCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Wholeheritagehotel exterior includeslongmainblock/verandas/parapets/roof/doors/deepwindows/tileddado/rearkitchen/twofireplaces andintrinsicone-storeyballroom/steppedbrickHall. Actualmainroofpolygon andactualQHRlot controlwholemetricextent; ballroom/Hallroofparts areexplicitinferredsectionsinsideQHRboundary basedprimarydescription, notindividuallymappedfootprints or photogrammetry. Hiddenrear/floor/roofdivisions/openingcensus/name/datelettering andsectiondetails medium-fiestimates.',
    'One exactpublished1000x5521934CharlevilleTimes/SLQNeg82855PD-Australiaphotograph controls longfacade/openverandas/posts/brackets/battens/parapet/dentils. No claimofindependentallsidephotographiccoverage orcurrent2026finishes. Neutralivory/graygreen/darktile paletteinferred fromgrayscale/type; no modernCC/galleryphotos or1990PDM-ownerarchiveimage used. Oppositestreetview,1930interiors,1919differentHotelCharleville andQuilpiehotel notadopted. No floodwater/trees/poles/people/logos/unrelatedbuildings/borrowedmeshes/photographictextures/generatedbitmaps.',
    'Main64.57mnativestreetroofedge corroboratesprimarySLQ210ftfrontage. SeparatecontemporaryCoronesMotel546158498,OldFireStation546158497,modernstaffquarters/garages andstreetcontext excluded. Surviving1924-29heritageform, exactcurrentalterations/repairdetailsunsurveyed. Independentground/rawtiles neverflattened/fitted/reacquired; actualfooting/step/floodlevelcontactunverified andgeographicreplacementdisabled.',
    'FourLODs preservewholemainhotel/realopenverandas/twolevels/return/shapedparapets/attachedballroomandsteppedHall/twinchimneys. Nearwindowreveals/Frenchdoormullions/closelyspacedtimberbattens/chamferedpostbrackets/dentils/relieflettering/Halldiamonds returnprogressively. Sixactualsurface slots withfivecanonicalsharedgraphs/localglazing.',
  ],
};
