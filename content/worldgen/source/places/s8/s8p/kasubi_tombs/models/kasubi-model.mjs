/** Original picture-proportioned Muzibu Azaala Mpanga exterior, not a surveyed reconstruction. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const grid = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const R = 15.15,
  F = 0.6,
  B = -5,
  TOP = 12.1,
  W = 6,
  BACK = 9.2;
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  roof: lin('d8c39c'),
  edge: lin('c4ac7c'),
  reed: lin('bca678'),
  wood: lin('65543c'),
  back: lin('3b3225'),
  earth: lin('9c865f'),
};
export const kasubiSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.99 },
  roof: { slot: 'roof', graph: 'thatch', roughness: 0.99 },
  reed: { slot: 'trim', graph: 'bamboo', roughness: 0.95 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.95 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 1 },
};
const configs = {
  skyline: { n: 16, r: 8, arch: 8, z: 4 },
  district: { n: 28, r: 10, arch: 16, z: 6, detail: true },
  street: { n: 56, r: 20, arch: 24, z: 10, detail: true, bundles: 64 },
  closeup: { n: 96, r: 32, arch: 40, z: 16, detail: true, bundles: 160, fine: true },
  master: { n: 256, r: 72, arch: 64, z: 24, detail: true, bundles: 360, fine: true, master: true },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function T(o, c, p, s = 'roof', col = C.roof, N) {
  p = p.map((p) => p.map(Math.fround));
  if (Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) < 1e-8) return;
  if (N && dot(normalFor(...p), N) < 0) p.reverse();
  const normal = normalFor(...p);
  if (s === 'roof' && c !== configs.skyline) {
    // Quads honor metric UVs in both the master and derivative authoring paths.
    // Split a clipped triangle into three real quads so radial straw orientation
    // survives the portal clipping without degenerate faces or private textures.
    let angles = p.map((q) => Math.atan2(q[0], q[2]));
    for (let i = 1; i < 3; i++) {
      while (angles[i] - angles[0] > Math.PI) angles[i] -= 2 * Math.PI;
      while (angles[i] - angles[0] < -Math.PI) angles[i] += 2 * Math.PI;
    }
    const uv = p.map((q, i) => [
        Math.abs(normal[1]) < 0.08 ? q[1] : Math.hypot(q[0], q[2]) * 1.3,
        (angles[i] * 96) / (2 * Math.PI),
      ]),
      mid = (a, b) => a.map((v, i) => (v + b[i]) / 2),
      pc = p[0].map((v, i) => (v + p[1][i] + p[2][i]) / 3),
      uc = uv[0].map((v, i) => (v + uv[1][i] + uv[2][i]) / 3);
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3,
        k = (i + 2) % 3;
      o.addQuad(
        'roof',
        'metric:uv',
        [p[i], mid(p[i], p[j]), pc, mid(p[k], p[i])],
        normal,
        [uv[i], mid(uv[i], uv[j]), uc, mid(uv[k], uv[i])],
        col,
      );
    }
    return;
  }
  o.addTriangle(
    c === configs.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    normal,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s = 'roof', col = C.roof, N) {
  if (
    s === 'roof' &&
    c !== configs.skyline &&
    [p.slice(0, 3), [p[0], p[2], p[3]]].every((t) => {
      const q = t.map((v) => v.map(Math.fround));
      return Math.hypot(...cross(sub(q[1], q[0]), sub(q[2], q[0]))) > 1e-8;
    })
  ) {
    p = p.map((q) => q.map(Math.fround));
    if (N && dot(normalFor(...p.slice(0, 3)), N) < 0) p.reverse();
    const normal = normalFor(...p.slice(0, 3)),
      angles = p.map((q) => Math.atan2(q[0], q[2]));
    for (let i = 1; i < 4; i++) {
      while (angles[i] - angles[0] > Math.PI) angles[i] -= 2 * Math.PI;
      while (angles[i] - angles[0] < -Math.PI) angles[i] += 2 * Math.PI;
    }
    o.addQuad(
      'roof',
      'metric:uv',
      p,
      normal,
      p.map((q, i) => [
        Math.abs(normal[1]) < 0.08 ? q[1] : Math.hypot(q[0], q[2]) * 1.3,
        (angles[i] * 96) / (2 * Math.PI),
      ]),
      col,
    );
    return;
  }
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
function H(x, z) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    n = grid.size[0],
    h = (x, z) => grid.elevationsMeters[z * n + x] - grid.modelDatumElevationMeters;
  return (
    (1 - a) * (1 - b) * h(i, j) +
    a * (1 - b) * h(i + 1, j) +
    (1 - a) * b * h(i, j + 1) +
    a * b * h(i + 1, j + 1)
  );
}
function roof(x, z) {
  const r = Math.min(1, Math.hypot(x, z) / R),
    hem = H(x, z) + 0.18;
  return TOP * (1 - Math.pow(r, 1.28)) + hem * Math.pow(r, 5);
}
function arch(x) {
  return F + 1.65 + 1.3 * Math.sqrt(Math.max(0, 1 - (x / W) ** 2));
}
function clip(poly, n, k, inside) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = dot(n, a) - k,
      db = dot(n, b) - k,
      ia = inside ? da <= 1e-9 : da >= -1e-9,
      ib = inside ? db <= 1e-9 : db >= -1e-9;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = da / (da - db);
      out.push(a.map((v, j) => v + t * (b[j] - v)));
    }
  }
  return out;
}
function planes(c) {
  const p = [
    { n: [1, 0, 0], k: W },
    { n: [-1, 0, 0], k: W },
    { n: [0, 0, -1], k: -BACK },
  ];
  for (let i = 0; i < c.arch; i++) {
    const x = -W + (2 * W * i) / c.arch,
      X = -W + (2 * W * (i + 1)) / c.arch,
      y = arch(x),
      Y = arch(X),
      s = (Y - y) / (X - x);
    p.push({ n: [-s, 1, 0], k: y - s * x });
  }
  return p;
}
function cut(o, c, ps, p, N, s = 'roof', col = C.roof) {
  let remaining = p;
  for (const { n, k } of ps) {
    if (remaining.length < 3) return;
    const outside = clip(remaining, n, k, false);
    for (let j = 1; j < outside.length - 1; j++)
      T(o, c, [outside[0], outside[j], outside[j + 1]], s, col, N);
    remaining = clip(remaining, n, k, true);
  }
}
function dome(o, c) {
  const ps = planes(c),
    point = (j, i) => {
      const r = (R * j) / c.r,
        t = (2 * Math.PI * i) / c.n,
        x = r * Math.cos(t),
        z = r * Math.sin(t);
      return [x, roof(x, z), z];
    },
    surface = (p, N) => {
      if (ps.some(({ n, k }) => p.every((q) => dot(n, q) > k + 1e-8)))
        Q(o, c, p, 'roof', C.roof, N);
      else for (const q of [p.slice(0, 3), [p[0], p[2], p[3]]]) cut(o, c, ps, q, N);
    };
  for (let j = 1; j <= c.r; j++)
    for (let i = 0; i < c.n; i++) {
      const p = [point(j - 1, i), point(j, i), point(j, i + 1), point(j - 1, i + 1)];
      surface(p, [p.reduce((s, p) => s + p[0], 0) / 4, 15, p.reduce((s, p) => s + p[2], 0) / 4]);
    }
  for (let i = 0; i < c.n; i++) {
    const a = point(c.r, i),
      b = point(c.r, i + 1),
      A = [a[0], B, a[2]],
      D = [b[0], B, b[2]],
      N = [a[0] + b[0], 0, a[2] + b[2]];
    surface([a, A, D, b], N);
    cut(o, c, ps, [[0, B, 0], D, A], [0, -1, 0], 'earth', C.earth);
  }
}
function zcut(x, y) {
  let lo = BACK,
    hi = Math.sqrt(R * R - x * x);
  for (let i = 0; i < 35; i++) {
    const z = (lo + hi) / 2;
    if (roof(x, z) > y) lo = z;
    else hi = z;
  }
  return (lo + hi) / 2;
}
function mouth(o, c) {
  const xs = Array.from({ length: c.arch + 1 }, (_, i) => -W + (2 * W * i) / c.arch);
  for (let i = 0; i < c.arch; i++) {
    const x = xs[i],
      X = xs[i + 1],
      y = arch(x),
      Y = arch(X);
    Q(
      o,
      c,
      [
        [x, F, BACK],
        [X, F, BACK],
        [X, Y + 0.08, BACK],
        [x, y + 0.08, BACK],
      ],
      'wood',
      C.back,
      [0, 0, 1],
    );
    for (let j = 0; j < c.z; j++) {
      const t = j / c.z,
        u = (j + 1) / c.z,
        a = BACK + (zcut(x, y) - BACK) * t,
        b = BACK + (zcut(X, Y) - BACK) * t,
        A = BACK + (zcut(x, y) - BACK) * u,
        D = BACK + (zcut(X, Y) - BACK) * u;
      Q(
        o,
        c,
        [
          [x, y + 0.035, a],
          [X, Y + 0.035, b],
          [X, Y + 0.035, D],
          [x, y + 0.035, A],
        ],
        'reed',
        C.reed,
        [0, -1, 0],
      );
    }
  }
  // Closed jambs run out to the naturally hanging roof edge. No navigable interior.
  for (const s of [-1, 1]) {
    const x = s * W,
      end = Math.sqrt(R * R - x * x);
    for (let j = 0; j < c.z; j++) {
      const z = BACK + ((end - BACK) * j) / c.z,
        Z = BACK + ((end - BACK) * (j + 1)) / c.z,
        y = Math.max(F, Math.min(arch(x), roof(x, z)) + 0.06),
        Y = Math.max(F, Math.min(arch(x), roof(x, Z)) + 0.06);
      Q(
        o,
        c,
        [
          [x, F, z],
          [x, y, z],
          [x, Y, Z],
          [x, F, Z],
        ],
        'reed',
        C.reed,
        [-s, 0, 0],
      );
    }
  }
  const p = [
      [-W, BACK],
      [W, BACK],
      [W, 15.3],
      [-W, 15.3],
    ],
    rs = [B, F].map((y) => p.map(([x, z]) => [x, y, z]));
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    Q(o, c, [rs[0][i], rs[0][k], rs[1][k], rs[1][i]], 'earth', C.earth, [
      p[i][0] + p[k][0],
      0,
      p[i][1] + p[k][1] - 24,
    ]);
  }
  Q(o, c, rs[1], 'earth', C.earth, [0, 1, 0]);
  Q(o, c, rs[0], 'earth', C.earth, [0, -1, 0]);
  const out = {
    addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
    addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      for (let j = 1; j < p.length - 1; j++) T(o, c, [p[0], p[j], p[j + 1]], s, col, n);
    },
  };
  // Sparse structural reed/timber framing, original arrangement inferred from the ordinary photo.
  for (const x of [-5.7, 5.7])
    beam(out, 'reed', [x, F, 12.3], [x, arch(x) - 0.1, 12.3], 0.23, 0.23, C.reed);
  if (c.detail) {
    for (const x of [-3.75, 0, 3.75])
      beam(out, 'wood', [x, F, BACK + 0.1], [x, arch(x) - 0.08, BACK + 0.1], 0.15, 0.17, C.wood);
    for (let i = 0; i < c.arch; i++) {
      const x = xs[i],
        X = xs[i + 1];
      beam(out, 'reed', [x, arch(x) - 0.06, 10.1], [X, arch(X) - 0.06, 10.1], 0.12, 0.16, C.reed);
    }
    for (const y of [F + 0.8, F + 1.7])
      beam(out, 'wood', [-5.9, y, BACK + 0.11], [5.9, y, BACK + 0.11], 0.1, 0.1, C.wood);
  }
}
function details(o, c) {
  const out = {
    addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
    addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      for (let j = 1; j < p.length - 1; j++) T(o, c, [p[0], p[j], p[j + 1]], s, col, n);
    },
  };
  // Plain small apex binding and finial, never copied heraldry or inscription.
  const n = c === configs.skyline ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    Q(
      o,
      c,
      [
        [0.37 * Math.cos(a), TOP - 0.12, 0.37 * Math.sin(a)],
        [0.37 * Math.cos(b), TOP - 0.12, 0.37 * Math.sin(b)],
        [0.12 * Math.cos(b), TOP + 0.28, 0.12 * Math.sin(b)],
        [0.12 * Math.cos(a), TOP + 0.28, 0.12 * Math.sin(a)],
      ],
      'reed',
      C.edge,
      [Math.cos(a), 0.3, Math.sin(a)],
    );
    T(
      o,
      c,
      [
        [0, TOP + 0.28, 0],
        [0.12 * Math.cos(a), TOP + 0.28, 0.12 * Math.sin(a)],
        [0.12 * Math.cos(b), TOP + 0.28, 0.12 * Math.sin(b)],
      ],
      'reed',
      C.edge,
      [0, 1, 0],
    );
  }
  beam(out, 'wood', [0, TOP + 0.2, 0], [0, TOP + 0.88, 0], 0.13, 0.13, C.wood);
  if (!c.bundles) return;
  for (let i = 0; i < c.bundles; i++) {
    const a = (2 * Math.PI * (i + 0.33)) / c.bundles,
      x = R * Math.cos(a),
      z = R * Math.sin(a);
    if (Math.abs(x) < 6.2 && z > BACK) continue;
    const r0 = R - (c.fine ? 1.8 : 1.3),
      X = r0 * Math.cos(a),
      Z = r0 * Math.sin(a),
      col = i % 5 === 0 ? C.edge : C.roof;
    beam(
      out,
      'roof',
      [X, roof(X, Z) + 0.018, Z],
      [x, roof(x, z) - 0.05, z],
      c.master ? 0.09 : 0.12,
      0.065,
      col,
    );
  }
}
export function buildKasubiLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Kasubi tier ' + level);
  dome(o, c);
  mouth(o, c);
  details(o, c);
}
export const buildKasubiSkyline = (o) => buildKasubiLevel(o, 'skyline');
export const buildKasubiDistrict = (o) => buildKasubiLevel(o, 'district');
export const buildKasubiStreet = (o) => buildKasubiLevel(o, 'street');
export const buildKasubiCloseup = (o) => buildKasubiLevel(o, 'closeup');
