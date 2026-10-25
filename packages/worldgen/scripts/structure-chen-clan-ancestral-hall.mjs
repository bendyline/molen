/** Native Lingnan hall ranges, open courts and sculptural ceramic crests. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ws/ws0/chen_clan_ancestral_hall/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('969b91'),
    stone: rgb('ccc9b8'),
    roof: rgb('969e94'),
    wood: rgb('514d42'),
    ceramic: rgb('ac6c52'),
    dark: rgb('3a443d'),
  },
  red = rgb('a75d4c'),
  blue = rgb('426f86'),
  green = rgb('6b8c70'),
  cream = rgb('d6c8a4'),
  gold = rgb('bba260'),
  clay = rgb('bb9572');
const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.99, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
  ceramic: { slot: 'trim', localRef: ref, roughness: 0.76, metallic: 0 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.96, metallic: 0.08 },
};
function tri(o, s, p, hint, col = C[s]) {
  const q = p.map((p) => p.map(Math.fround)),
    n = cross(
      q[1].map((v, i) => v - q[0][i]),
      q[2].map((v, i) => v - q[0][i]),
    );
  if (Math.hypot(...n) < 1e-10) return;
  if (normalFor(...p).reduce((v, x, i) => v + x * hint[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    col,
  );
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
function B(o, s, x, y, z, w, h, depth, col = C[s]) {
  box(o, s, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], col);
}
function canonical(r) {
  const sorted = [...r].sort((a, b) => a[1] - b[1]),
    n = sorted.slice(0, 2).sort((a, b) => a[0] - b[0]),
    s = sorted.slice(2).sort((a, b) => a[0] - b[0]);
  return [n[0], n[1], s[1], s[0]];
}
function lerp(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}
function at(q, u, v) {
  return lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);
}
function part(q, axis, lo, hi) {
  return axis === 'U'
    ? [at(q, lo, 0), at(q, hi, 0), at(q, hi, 1), at(q, lo, 1)]
    : [at(q, 0, lo), at(q, 1, lo), at(q, 1, hi), at(q, 0, hi)];
}
function face(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  return {
    len,
    u,
    n,
    p: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
function panel(o, f, s, r, holes = [], z = 0, col = C[s]) {
  const p = [r, ...holes].flat(),
    starts = holes.map((_, i) => r.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0)),
    ix = earcut(p.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => f.p(...p[j], z)),
      [f.n[0], 0, f.n[1]],
      col,
    );
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function localBox(o, f, s, x, y, z, w, h, depth, col = C[s]) {
  const q = new Proxy(o, {
    get(t, k) {
      if (k === 'addQuad')
        return (s, _m, p, n, _uv, c) => {
          const pp = p.map((p) => f.p(...p));
          Q(t, s, pp, [f.u[0] * n[0] + f.n[0] * n[2], n[1], f.u[1] * n[0] + f.n[1] * n[2]], c);
        };
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
  box(q, s, [x - w / 2, y, z - depth / 2], [x + w / 2, y + h, z + depth / 2], col);
}
function cap(o, q, y, s = 'stone', col = C[s], up = true) {
  const ix = earcut(q.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [q[j][0], y, q[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function plinth(o, q, y0, y1, d) {
  for (let i = 0; i < q.length; i++) {
    const a = q[i],
      b = q[(i + 1) % q.length],
      p = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ];
    Q(o, 'stone', p, normalFor(...p));
  }
  cap(o, q, y1);
  if (d > 1) cap(o, q, y0, 'stone', C.stone, false);
}
function stroke(o, f, ps, w, z, d, s = 'stone', col = C[s]) {
  for (let i = 1; i < ps.length; i++) {
    const a = ps[i - 1],
      b = ps[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-5) continue;
    if (d < 3 || w <= 0.12) {
      const nx = (-(b[1] - a[1]) * w) / (2 * len),
        ny = ((b[0] - a[0]) * w) / (2 * len);
      Q(
        o,
        s,
        [
          f.p(a[0] + nx, a[1] + ny, z),
          f.p(a[0] - nx, a[1] - ny, z),
          f.p(b[0] - nx, b[1] - ny, z),
          f.p(b[0] + nx, b[1] + ny, z),
        ],
        [f.n[0], 0, f.n[1]],
        col,
      );
    } else beam(o, s, f.p(...a, z), f.p(...b, z), w, w, col);
  }
}
function coil(o, f, x, y, r, d, z = 0.07, col = C.stone) {
  if (d < 3) return;
  const n = 8;
  stroke(
    o,
    f,
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        a = t * Math.PI * 3.1,
        rr = r * (1 - 0.8 * t);
      return [x + rr * Math.cos(a), y + rr * Math.sin(a)];
    }),
    0.027,
    z,
    d,
    'stone',
    col,
  );
}
function column(o, p, height, d, r = 0.2) {
  if (d === 0) {
    Q(
      o,
      'stone',
      [
        [p[0] - r, p[1], p[2]],
        [p[0] + r, p[1], p[2]],
        [p[0] + r, p[1] + height, p[2]],
        [p[0] - r, p[1] + height, p[2]],
      ],
      [0, 0, 1],
    );
    return;
  }
  const n = d < 3 ? 4 : 6,
    levels =
      d === 1
        ? [
            [0, r * 1.2],
            [height, r * 0.9],
          ]
        : d === 2
          ? [
              [0, r * 1.25],
              [height - 0.2, r * 0.9],
              [height, r * 1.4],
            ]
          : [
              [0, r * 1.4],
              [0.18, r * 1.4],
              [0.29, r],
              [height - 0.22, r * 0.88],
              [height, r * 1.5],
            ];
  loft(
    o,
    'stone',
    levels.map(([yy, rr]) => radialRing(p[1] + yy, rr, rr, n, [p[0], p[2]], Math.PI / 4)),
    C.stone,
    { cap: d > 1 },
  );
}
function bracket(o, f, x, y, d) {
  if (d < 2) return;
  panel(
    o,
    f,
    'stone',
    [
      [x - 0.48, y],
      [x + 0.48, y],
      [x + 0.3, y - 0.2],
      [x + 0.19, y - 0.45],
      [x + 0.1, y - 0.59],
      [x - 0.1, y - 0.59],
      [x - 0.19, y - 0.45],
      [x - 0.3, y - 0.2],
    ],
    [],
    0.12,
  );
  if (d === 3) {
    coil(o, f, x - 0.22, y - 0.22, 0.13, d, 0.15);
    coil(o, f, x + 0.22, y - 0.22, 0.13, d, 0.15);
  }
}
function facade(o, f, eave, d, { porch = true, entry = false, closed = false } = {}) {
  const base = 0.65,
    wallY = eave - 0.45,
    n =
      d === 0
        ? Math.max(2, Math.ceil(f.len / 16))
        : Math.max(2, Math.ceil(f.len / (closed || d === 1 ? 8 : d === 2 ? 6 : 4.8))),
    depth = porch ? 2.1 : 0,
    doors = [];
  if (!closed)
    for (const t of [1 / 6, 0.5, 5 / 6])
      doors.push({ x: t * f.len, w: entry && t === 0.5 ? 4.4 : 2.6, h: 3.35 });
  const holes = d === 3 ? doors.map((q) => rect(q.x, base, q.w, q.h)) : [];
  panel(o, f, 'wall', rect(f.len / 2, base, f.len, wallY - base), holes, -depth);
  for (const q of doors) {
    if (d === 3) {
      for (const sign of [-1, 1]) {
        localBox(
          o,
          f,
          'wood',
          q.x + sign * (q.w / 2 + 0.1),
          base,
          -depth + 0.08,
          0.16,
          q.h + 0.12,
          0.22,
        );
      }
      localBox(o, f, 'wood', q.x, base + q.h, -depth + 0.08, q.w + 0.3, 0.16, 0.22);
      panel(o, f, 'dark', rect(q.x, base + 0.04, q.w - 0.2, q.h - 0.1), [], -depth - 0.28);
    } else panel(o, f, 'wood', rect(q.x, base + 0.03, q.w, q.h), [], -depth + 0.025);
  }
  if (porch) {
    for (let i = 0; i <= n; i++) {
      const x = (i * f.len) / n,
        p = f.p(x, base, 0.1);
      column(o, p, eave - base - 0.18, d, entry ? 0.25 : 0.21);
      bracket(o, f, x, eave - 0.24, d);
    }
    if (d === 0) panel(o, f, 'stone', rect(f.len / 2, eave - 0.44, f.len, 0.38), [], 0.12);
    else {
      localBox(o, f, 'stone', f.len / 2, eave - 0.45, 0.08, f.len + 0.1, 0.3, 0.4);
      localBox(o, f, 'wood', f.len / 2, eave - 0.15, -0.1, f.len + 0.1, 0.17, 0.4);
    }
    if (d > 1)
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) * f.len) / n;
        coil(o, f, x, eave - 0.32, 0.09, d, 0.31);
      }
  }
  if (d > 0 && !closed) {
    const bays = Math.max(2, Math.floor(f.len / 5.0));
    for (let j = 0; j < bays; j++) {
      const x = ((j + 0.5) * f.len) / bays;
      if (doors.some((q) => Math.abs(q.x - x) < q.w * 0.7)) continue;
      panel(o, f, 'wood', rect(x, 1.35, 2.25, 2.5), [], -depth + 0.025);
      if (d > 1) {
        for (let k = 0; k < 5; k++)
          panel(
            o,
            f,
            'wood',
            rect(x - 0.9 + k * 0.45, 1.4, 0.035, 2.35),
            [],
            -depth + 0.08,
            C.stone,
          );
        for (const y of [1.8, 2.6, 3.4])
          panel(o, f, 'wood', rect(x, y, 2.1, 0.035), [], -depth + 0.085, C.stone);
      }
    }
  }
}
function componentShell(o, quad, kind, d) {
  const q = canonical(quad),
    e = kind === 'hall' ? 5.4 : 4.6;
  plinth(o, q, -0.22, 0.65, d);
  if (kind === 'hall') {
    facade(o, face(q[3], q[2]), e, d, { entry: true });
    facade(o, face(q[1], q[0]), e, d, { porch: true });
    for (const [a, b] of [
      [q[0], q[3]],
      [q[2], q[1]],
    ])
      facade(o, face(a, b), e, d, { porch: false, closed: true });
  } else {
    const west = (q[0][0] + q[2][0]) / 2 < 0,
      inner = west ? face(q[2], q[1]) : face(q[0], q[3]),
      outer = west ? face(q[0], q[3]) : face(q[2], q[1]);
    facade(o, inner, e, d, { porch: true });
    facade(o, outer, e, d, { porch: false, closed: true });
    facade(o, face(q[3], q[2]), e, d, { porch: false, closed: true });
    facade(o, face(q[1], q[0]), e, d, { porch: false, closed: true });
  }
}
function cellFrame(quad, axis) {
  const q = canonical(quad),
    uw = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]),
    vd = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]),
    w = axis === 'U' ? uw : vd,
    depth = axis === 'U' ? vd : uw;
  return {
    w,
    depth,
    p: (x, y, z) => {
      const p =
        axis === 'U' ? at(q, 0.5 + x / w, 0.5 + z / depth) : at(q, 0.5 - z / depth, 0.5 + x / w);
      return [p[0], y, p[1]];
    },
  };
}
function roofY(t, eave, ridge) {
  return eave + (ridge - eave) * Math.pow(1 - t, 1.18) + 0.1 * Math.pow(t, 8);
}
function roofSheet(o, f, eave, ridge, d) {
  const half = f.depth / 2,
    n = [1, 2, 3, 6][d];
  for (const side of [-1, 1])
    for (let j = 0; j < n; j++) {
      const t0 = j / n,
        t1 = (j + 1) / n,
        z0 = side * half * t0,
        z1 = side * half * t1,
        y0 = roofY(t0, eave, ridge),
        y1 = roofY(t1, eave, ridge),
        p = [
          f.p(-f.w / 2, y0, z0),
          f.p(f.w / 2, y0, z0),
          f.p(f.w / 2, y1, z1),
          f.p(-f.w / 2, y1, z1),
        ];
      Q(o, 'roof', p, [0, 1, 0]);
      if (d > 0) Q(o, 'wood', p.map((p) => [p[0], p[1] - 0.16, p[2]]).reverse(), [0, -1, 0]);
    }
  if (d < 2) return;
  const pitch = d === 3 ? 0.65 : 1.1,
    count = Math.floor(f.w / pitch),
    zSteps = d === 3 ? 2 : 1;
  for (let i = 0; i <= count; i++) {
    const x = -f.w / 2 + ((i + 0.5) * f.w) / (count + 1);
    for (const side of [-1, 1])
      for (let j = 0; j < zSteps; j++) {
        const t0 = j / zSteps,
          t1 = (j + 1) / zSteps,
          z0 = side * half * t0,
          z1 = side * half * t1,
          y0 = roofY(t0, eave, ridge),
          y1 = roofY(t1, eave, ridge),
          rad = d === 3 ? 0.057 : 0.045;
        if (d === 2)
          Q(
            o,
            'roof',
            [
              f.p(x - rad, y0 + 0.04, z0),
              f.p(x + rad, y0 + 0.04, z0),
              f.p(x + rad, y1 + 0.04, z1),
              f.p(x - rad, y1 + 0.04, z1),
            ],
            [0, 1, 0],
            C.stone,
          );
        else
          for (const [l, r] of [
            [-1, 0],
            [0, 1],
          ]) {
            const yy = (k) => (k === 0 ? 0.078 : 0.018);
            Q(
              o,
              'roof',
              [
                f.p(x + l * rad, y0 + yy(l), z0),
                f.p(x + r * rad, y0 + yy(r), z0),
                f.p(x + r * rad, y1 + yy(r), z1),
                f.p(x + l * rad, y1 + yy(l), z1),
              ],
              [0, 1, 0],
              C.roof,
            );
          }
      }
    if (d === 3)
      for (const side of [-1, 1]) {
        const z = side * (half + 0.005),
          y = roofY(1, eave, ridge) + 0.035,
          ps = Array.from({ length: 7 }, (_, j) => {
            const a = (j * Math.PI) / 6;
            return f.p(x + Math.cos(a) * 0.06, y + Math.sin(a) * 0.06, z);
          }),
          origin = f.p(0, 0, 0),
          end = f.p(0, 0, side * half),
          hint = [end[0] - origin[0], 0, end[2] - origin[2]];
        for (let j = 1; j < ps.length - 1; j++)
          tri(o, 'roof', [ps[0], ps[j], ps[j + 1]], hint, C.stone);
      }
  }
}
function cellFace(f, x0) {
  const p = f.p(x0, 0, -f.depth / 2),
    q = f.p(x0, 0, f.depth / 2);
  return face([p[0], p[2]], [q[0], q[2]]);
}
function firewalls(o, f, eave, ridge, d) {
  for (const sign of [-1, 1]) {
    const ff = cellFace(f, (sign * f.w) / 2),
      half = f.depth / 2,
      n = d < 2 ? 1 : 4,
      top = [];
    for (let i = 0; i <= 2 * n; i++) {
      const t = (i - n) / n;
      top.push([half + t * half, roofY(Math.abs(t), eave, ridge) + 0.45]);
    }
    const outline = [[0, eave - 0.18], [f.depth, eave - 0.18], ...top.toReversed()];
    panel(o, ff, 'ceramic', outline, [], 0.02, red);
    panel(o, { ...ff, n: ff.n.map((v) => -v) }, 'ceramic', outline, [], -0.16, red);
    if (d === 3)
      for (let i = 0; i < outline.length; i++) {
        const a = outline[i],
          b = outline[(i + 1) % outline.length];
        const points = [ff.p(...a, 0.02), ff.p(...b, 0.02), ff.p(...b, 0.16), ff.p(...a, 0.16)];
        Q(o, 'ceramic', points, normalFor(...points), red);
      }
    if (d > 0) stroke(o, ff, [...top], 0.12, 0.12, d, 'stone', cream);
    if (d > 1) {
      coil(o, ff, half, ridge - 0.45, 0.38, d, 0.14, cream);
      for (const side of [-1, 1]) coil(o, ff, half + side * 1.2, ridge - 1.1, 0.3, d, 0.13, cream);
    }
  }
}
function cellWriter(o, f) {
  return {
    addTriangle: (s, _m, p, _n, _uv, col) => {
      const q = p.map((p) => f.p(...p));
      tri(o, s, q, normalFor(...q), col);
    },
    addQuad: (s, _m, p, _n, _uv, col) => {
      const q = p.map((p) => f.p(...p));
      Q(o, s, q, normalFor(...q), col);
    },
    addConvexPolygon: (s, _m, p, _n, _uv, col) => {
      const q = p.map((p) => f.p(...p));
      for (let i = 1; i < q.length - 1; i++)
        tri(o, s, [q[0], q[i], q[i + 1]], normalFor(q[0], q[i], q[i + 1]), col);
    },
  };
}
function cellBox(o, f, s, x, y, z, w, h, dep, col = C[s]) {
  box(cellWriter(o, f), s, [x - w / 2, y, z - dep / 2], [x + w / 2, y + h, z + dep / 2], col);
}
function figure(o, f, x, y, z, h, d, variant = 0) {
  const col = [cream, blue, green, red, gold][variant % 5];
  if (d < 3) {
    const p = [
      [x - 0.13 * h, y, z],
      [x + 0.13 * h, y, z],
      [x + 0.08 * h, y + h * 0.66, z],
      [x + 0.18 * h, y + h * 0.75, z],
      [x, y + h, z],
      [x - 0.18 * h, y + h * 0.75, z],
      [x - 0.08 * h, y + h * 0.66, z],
    ];
    const q = p.map((p) => f.p(...p));
    for (let i = 1; i < q.length - 1; i++)
      tri(o, 'ceramic', [q[0], q[i], q[i + 1]], normalFor(q[0], q[i], q[i + 1]), col);
    return;
  }
  const q = cellWriter(o, f),
    seated = variant % 4 === 0,
    k = seated ? 0.78 : 1;
  loft(
    q,
    'ceramic',
    [
      [0, 0.19],
      [0.12, 0.17],
      [0.63 * k, 0.095],
    ].map(([yy, r]) => radialRing(y + yy * h, r * h, r * 0.65 * h, 4, [x, z])),
    col,
  );
  sphere(q, 'ceramic', [x, y + h * (0.78 * k), z], [0.085 * h, 0.115 * h, 0.075 * h], clay, 6, 3);
  for (const s of [-1, 1]) {
    const shoulder = [x + s * 0.09 * h, y + h * 0.57 * k, z],
      hand = [
        x + s * (variant % 3 === 0 ? 0.24 : 0.13) * h,
        y + h * (variant % 3 === 0 ? 0.65 : 0.39) * k,
        z + 0.08 * h,
      ];
    beam(q, 'ceramic', shoulder, hand, 0.065 * h, 0.065 * h, col);
  }
  if (variant % 3 === 1)
    beam(q, 'ceramic', [x + 0.2 * h, y, z], [x + 0.2 * h, y + h * 0.94, z], 0.026, 0.026, gold);
  if (seated) cellBox(o, f, 'ceramic', x, y - 0.05, z, 0.4 * h, 0.17 * h, 0.35 * h, red);
}
function pavilion(o, f, x, y, w, h, d, col = green) {
  if (d === 0) return;
  const q = cellWriter(o, f),
    post = d === 1 ? 0.1 : 0.08;
  for (const s of [-1, 1])
    cellBox(o, f, 'ceramic', x + s * w * 0.42, y, 0, post, h * 0.73, 0.18, col);
  cellBox(o, f, 'ceramic', x, y + h * 0.7, 0, w, 0.12, 0.35, col);
  for (const s of [-1, 1]) {
    const p = [
      f.p(x - w * 0.58, y + h * 0.74, s * 0.16),
      f.p(x + w * 0.58, y + h * 0.74, s * 0.16),
      f.p(x + w * 0.36, y + h * 0.9, s * 0.16),
      f.p(x - w * 0.36, y + h * 0.9, s * 0.16),
    ];
    Q(o, 'ceramic', p, normalFor(...p), col);
  }
  if (d === 3) {
    beam(
      q,
      'ceramic',
      [x - w * 0.4, y + h * 0.75, -0.18],
      [x + w * 0.4, y + h * 0.75, -0.18],
      0.07,
      0.07,
      gold,
    );
  }
}
function fish(o, f, x, y, sign, d, h = 1.35) {
  const q = cellWriter(o, f),
    points = [
      [x, y, 0],
      [x + sign * 0.13 * h, y + 0.3 * h, 0],
      [x + sign * 0.28 * h, y + 0.69 * h, 0],
      [x + sign * 0.22 * h, y + 0.98 * h, 0],
    ];
  if (d < 2) {
    for (const z of [-0.08, 0.08]) {
      const p = [
        [x - 0.17 * h, y, z],
        [x + 0.17 * h, y, z],
        [x + sign * 0.34 * h, y + 0.73 * h, z],
        [x + sign * 0.13 * h, y + h, z],
      ].map((p) => f.p(...p));
      Q(o, 'ceramic', p, normalFor(...p), green);
    }
    return;
  }
  const rings = points.map((p, i) =>
    radialRing(p[1], [0.15, 0.19, 0.14, 0.09][i] * h, 0.11 * h, d === 3 ? 6 : 4, [p[0], p[2]]),
  );
  loft(q, 'ceramic', rings, green);
  const head = points.at(-1);
  sphere(
    q,
    'ceramic',
    [head[0] + sign * 0.05 * h, head[1], 0],
    [0.17 * h, 0.12 * h, 0.12 * h],
    green,
    d === 3 ? 8 : 4,
    d === 3 ? 4 : 3,
  );
  for (const z of [-0.06, 0.06]) {
    const p = [
      [x, y + 0.22 * h, z],
      [x - sign * 0.25 * h, y + 0.65 * h, z],
      [x + sign * 0.15 * h, y + 0.57 * h, z],
    ].map((p) => f.p(...p));
    tri(o, 'ceramic', p, normalFor(...p), red);
  }
  if (d === 3) {
    for (const s of [-1, 1]) {
      const p = [
        [x + sign * 0.24 * h, y + 0.94 * h, s * 0.08],
        [x + sign * 0.48 * h, y + 1.12 * h, s * 0.08],
        [x + sign * 0.29 * h, y + 1.05 * h, s * 0.08],
      ].map((p) => f.p(...p));
      tri(o, 'ceramic', p, normalFor(...p), gold);
    }
    for (let i = 1; i < 4; i++) {
      const p = points[i];
      beam(
        q,
        'ceramic',
        [p[0] - sign * 0.04 * h, p[1], -0.11 * h],
        [p[0] - sign * 0.15 * h, p[1] + 0.08 * h, -0.11 * h],
        0.027,
        0.027,
        gold,
      );
    }
  }
}
function ridge(o, f, y, d, kind, variant) {
  const w = f.w - 0.35,
    high = kind === 'hall' ? 1.15 : kind === 'walk' ? 0.66 : 0.58;
  if (d === 0) {
    for (const z of [-0.14, 0.14])
      Q(
        o,
        'ceramic',
        [f.p(-w / 2, y, z), f.p(w / 2, y, z), f.p(w / 2, y + high, z), f.p(-w / 2, y + high, z)],
        [0, 0, z < 0 ? -1 : 1],
        red,
      );
    if (kind === 'hall') for (const s of [-1, 1]) fish(o, f, s * (w * 0.45), y + high, s, d, 1.0);
    return;
  }
  if (d === 1) {
    cellBox(o, f, 'ceramic', 0, y, 0, w, 0.12, 0.45, red);
    const n = kind === 'hall' ? 2 : 1;
    for (let j = 0; j < n; j++) {
      const x = -w / 2 + ((j + 0.5) * w) / n,
        width = Math.min(3, (w / n) * 0.7);
      for (const z of [-0.14, 0.14]) {
        const nf = normalFor(f.p(0, 0, z), f.p(1, 0, z), f.p(1, 1, z));
        for (const side of [-1, 1])
          Q(
            o,
            'ceramic',
            [
              f.p(x + (side * width) / 2 - 0.1, y, z),
              f.p(x + (side * width) / 2 + 0.1, y, z),
              f.p(x + (side * width) / 2 + 0.1, y + high, z),
              f.p(x + (side * width) / 2 - 0.1, y + high, z),
            ],
            nf,
            green,
          );
        Q(
          o,
          'ceramic',
          [
            f.p(x - width * 0.6, y + high, z),
            f.p(x + width * 0.6, y + high, z),
            f.p(x + width * 0.45, y + high + 0.2, z),
            f.p(x - width * 0.45, y + high + 0.2, z),
          ],
          nf,
          red,
        );
      }
    }
    if (kind === 'hall')
      for (const side of [-1, 1]) fish(o, f, side * w * 0.43, y + high * 0.6, side, d, 1.2);
    return;
  }
  cellBox(o, f, 'ceramic', 0, y, 0, w, 0.12, 0.45, red);
  const scenes = kind === 'hall' ? (d === 2 ? 2 : 3) : 2,
    pitch = w / scenes;
  for (let j = 0; j < scenes; j++) {
    const x = -w / 2 + (j + 0.5) * pitch,
      bluePanel = (j + variant) % 3 === 1,
      color = bluePanel ? blue : red;
    cellBox(o, f, 'ceramic', x, y + 0.13, 0, pitch - 0.09, high * 0.63, 0.28, color);
    // Frames and drama relief are volumetric; no image plane or baked photo is used.
    if (d > 1) {
      for (const z of [-0.16, 0.16]) {
        const p = [
          f.p(x - pitch * 0.43, y + 0.18, z),
          f.p(x + pitch * 0.43, y + 0.18, z),
          f.p(x + pitch * 0.43, y + high * 0.7, z),
          f.p(x - pitch * 0.43, y + high * 0.7, z),
        ];
        for (let k = 0; k < 4; k++) {
          const a = p[k],
            b = p[(k + 1) % 4],
            n = normalFor(p[0], p[1], p[2]);
          const len = Math.hypot(...b.map((v, i) => v - a[i]));
          const across = cross(
            n,
            b.map((v, i) => (v - a[i]) / len),
          );
          Q(
            o,
            'ceramic',
            [
              a.map((v, i) => v - across[i] * 0.018),
              a.map((v, i) => v + across[i] * 0.018),
              b.map((v, i) => v + across[i] * 0.018),
              b.map((v, i) => v - across[i] * 0.018),
            ],
            n,
            cream,
          );
        }
      }
      if (!bluePanel)
        for (const s of [-1, 1])
          figure(
            o,
            f,
            x + s * pitch * 0.18,
            y + 0.2,
            s * 0.2,
            high * 0.54,
            d,
            variant + j + (s > 0 ? 1 : 0),
          );
      else
        for (const z of [-0.17, 0.17]) {
          for (const dx of [-0.18, 0.18])
            cellBox(o, f, 'ceramic', x + dx, y + 0.27, z, 0.07, high * 0.33, 0.045, cream);
        }
    }
    if (kind === 'hall') {
      const ph = d === 1 ? 0.58 : d === 2 ? 0.85 : 1.15,
        py = y + high * 0.76;
      if (j % 2 === 0) {
        pavilion(o, f, x, py, pitch * 0.66, ph, d, green);
        if (d > 1)
          for (const s of [-1, 1])
            figure(o, f, x + s * 0.32, py + 0.05, 0, ph * 0.72, d, j + variant + (s > 0 ? 1 : 0));
      } else {
        for (const s of [-1, 1])
          cellBox(o, f, 'ceramic', x + s * pitch * 0.34, py, 0, 0.14, ph * 0.75, 0.25, green);
        cellBox(o, f, 'ceramic', x, py + ph * 0.72, 0, pitch * 0.72, 0.12, 0.35, green);
      }
    } else if (d > 1) {
      const sz = Math.min(0.25, high * 0.42);
      for (const z of [-0.18, 0.18]) {
        const mid = f.p(x, y + high + 0.12, z);
        sphere(o, 'ceramic', mid, [sz, sz * 0.75, 0.08], green, d === 3 ? 8 : 4, 3);
      }
    }
  }
  if (kind === 'hall')
    for (const s of [-1, 1]) fish(o, f, s * (w * 0.43), y + high * 0.8, s, d, d === 3 ? 1.6 : 1.2);
  else if (d > 1) for (const s of [-1, 1]) fish(o, f, s * (w * 0.44), y + high * 0.55, s, d, 0.75);
}
function steps(o, f, x, w, d) {
  const n = d === 0 ? 1 : 4;
  for (let j = 0; j < n; j++)
    localBox(
      o,
      f,
      'stone',
      x,
      0,
      1.6 - j * 0.34,
      w,
      d === 0 ? 0.65 : 0.16 * (j + 1),
      d === 0 ? 1.8 : 0.37,
    );
}
function piercedRail(o, f, x, y, w, d) {
  if (d === 0) return;
  const count = d === 1 ? 2 : Math.max(2, Math.floor(w / 2.4));
  for (const yy of [y, y + 0.77]) localBox(o, f, 'stone', x, yy, 0.04, w, 0.12, 0.25);
  for (let j = 0; j <= count; j++) {
    const xx = x - w / 2 + (w * j) / count;
    localBox(o, f, 'stone', xx, y, 0.04, 0.2, 0.95, 0.25);
    if (d === 3) sphere(o, 'stone', f.p(xx, y + 0.98, 0.04), [0.14, 0.13, 0.14], C.stone, 6, 3);
  }
  if (d === 1) return;
  for (let j = 0; j < count; j++) {
    const xx = x - w / 2 + (w * (j + 0.5)) / count,
      ww = w / count - 0.23;
    stroke(
      o,
      f,
      [
        [xx - ww * 0.38, y + 0.24],
        [xx, y + 0.68],
        [xx + ww * 0.38, y + 0.24],
      ],
      0.055,
      0.07,
      d,
      'dark',
      C.dark,
    );
    if (d === 3) {
      coil(o, f, xx, y + 0.43, 0.17, d, 0.06);
    }
  }
}
function glyphs(o, f, x, y, w, h, d) {
  if (d !== 3) return;
  const chars = [
    [
      [
        [0.05, 0.05],
        [0.05, 0.95],
        [0.27, 0.95],
        [0.2, 0.67],
        [0.3, 0.53],
        [0.22, 0.32],
        [0.08, 0.32],
      ],
      [
        [0.38, 0.75],
        [0.38, 0.86],
        [0.9, 0.86],
        [0.9, 0.75],
      ],
      [
        [0.5, 0.72],
        [0.82, 0.72],
      ],
      [
        [0.4, 0.53],
        [0.92, 0.53],
      ],
      [
        [0.55, 0.5],
        [0.55, 0.28],
        [0.36, 0.09],
      ],
      [
        [0.74, 0.51],
        [0.74, 0.13],
        [0.93, 0.13],
      ],
    ],
    [
      [
        [0.2, 0.88],
        [0.78, 0.88],
        [0.78, 0.63],
        [0.24, 0.63],
      ],
      [
        [0.1, 0.76],
        [0.91, 0.76],
      ],
      [
        [0.13, 0.53],
        [0.89, 0.53],
      ],
      [
        [0.18, 0.42],
        [0.83, 0.42],
      ],
      [
        [0.52, 0.98],
        [0.52, 0.47],
      ],
      [
        [0.24, 0.08],
        [0.24, 0.36],
        [0.79, 0.36],
        [0.79, 0.08],
        [0.24, 0.08],
      ],
      [
        [0.25, 0.22],
        [0.78, 0.22],
      ],
    ],
    [
      [
        [0.17, 0.2],
        [0.17, 0.81],
        [0.8, 0.94],
      ],
      [
        [0.18, 0.56],
        [0.85, 0.62],
      ],
      [
        [0.55, 0.88],
        [0.58, 0.53],
        [0.75, 0.21],
        [0.92, 0.1],
      ],
      [
        [0.17, 0.2],
        [0.5, 0.29],
      ],
    ],
    [
      [
        [0.06, 0.06],
        [0.06, 0.96],
        [0.25, 0.96],
        [0.18, 0.68],
        [0.29, 0.53],
        [0.22, 0.34],
        [0.08, 0.34],
      ],
      [
        [0.4, 0.8],
        [0.91, 0.8],
      ],
      [
        [0.64, 0.97],
        [0.64, 0.11],
      ],
      [
        [0.38, 0.39],
        [0.38, 0.68],
        [0.9, 0.68],
        [0.9, 0.39],
        [0.38, 0.39],
      ],
      [
        [0.4, 0.54],
        [0.88, 0.54],
      ],
      [
        [0.64, 0.38],
        [0.36, 0.12],
      ],
      [
        [0.65, 0.38],
        [0.94, 0.12],
      ],
    ],
  ];
  const pitch = w / 4;
  for (let j = 0; j < 4; j++)
    for (const line of chars[j])
      stroke(
        o,
        f,
        line.map((p) => [x - w / 2 + j * pitch + p[0] * pitch * 0.85, y + p[1] * h]),
        0.045,
        0.035,
        2,
        'dark',
      );
}
function guardian(o, p, d, sign) {
  B(o, 'stone', p[0], 0.65, p[2], 1.25, 0.55, 1.35);
  if (d === 0) return;
  const n = d === 1 ? 4 : d === 2 ? 6 : 10,
    l = d === 3 ? 5 : 3,
    y = 1.2;
  sphere(o, 'stone', [p[0], y + 0.48, p[2]], [0.37, 0.53, 0.4], C.stone, n, l);
  sphere(o, 'stone', [p[0], y + 1.04, p[2] + 0.06], [0.4, 0.38, 0.33], C.stone, n, l);
  for (const s of [-1, 1]) {
    B(o, 'stone', p[0] + s * 0.26, y, p[2] + 0.24, 0.18, 0.66, 0.2);
    sphere(
      o,
      'stone',
      [p[0] + s * 0.23, y + 1.3, p[2] + 0.05],
      [0.12, 0.16, 0.12],
      C.stone,
      d === 3 ? 6 : 4,
      3,
    );
  }
  if (d === 3) {
    sphere(o, 'stone', [p[0] + sign * 0.32, y + 0.08, p[2] + 0.4], [0.2, 0.2, 0.2], C.stone, 8, 4);
    for (let j = 0; j < 6; j++) {
      const a = (j * Math.PI * 2) / 6;
      sphere(
        o,
        'stone',
        [p[0] + 0.35 * Math.cos(a), y + 1.0 + 0.3 * Math.sin(a), p[2] - 0.14],
        [0.15, 0.15, 0.12],
        C.stone,
        6,
        3,
      );
    }
    for (const s of [-1, 1])
      sphere(
        o,
        'dark',
        [p[0] + s * 0.15, y + 1.12, p[2] + 0.35],
        [0.03, 0.035, 0.025],
        C.dark,
        4,
        3,
      );
  }
}
function architecturalRelief(o, f, x, y, w, h, d) {
  if (d < 2) return;
  panel(o, f, 'wall', rect(x, y, w, h), [], 0.03, C.wall);
  const levels = d === 3 ? 3 : 2;
  for (let j = 0; j < levels; j++) {
    localBox(o, f, 'stone', x, y + (h * j) / levels, 0.08, w, 0.07, 0.1, C.wall);
    const count = d === 3 ? 5 : 3;
    for (let k = 0; k < count; k++) {
      const xx = x - w / 2 + ((k + 0.5) * w) / count,
        yy = y + (h * j) / levels + 0.08,
        hh = (h / levels) * 0.8;
      panel(
        o,
        f,
        'stone',
        [
          [xx - 0.18, yy],
          [xx + 0.18, yy],
          [xx + 0.1, yy + hh * 0.65],
          [xx + 0.24, yy + hh * 0.73],
          [xx, yy + hh],
          [xx - 0.24, yy + hh * 0.73],
          [xx - 0.1, yy + hh * 0.65],
        ],
        [],
        0.12,
        C.wall,
      );
      if (d === 3) {
        coil(o, f, xx, yy + hh * 0.35, 0.1, d, 0.15, C.wall);
        stroke(
          o,
          f,
          [
            [xx - 0.26, yy + hh],
            [xx, yy + hh + 0.13],
            [xx + 0.26, yy + hh],
          ],
          0.045,
          0.16,
          d,
          'stone',
          C.wall,
        );
      }
    }
  }
}
const components = plan.components.map((c) => ({ ...c, quad: canonical(c.outline) }));
function walk(o, info, d) {
  const [z0, z1] = info.zRange,
    q = [
      [info.x - info.width / 2, z0],
      [info.x + info.width / 2, z0],
      [info.x + info.width / 2, z1],
      [info.x - info.width / 2, z1],
    ];
  plinth(o, q, -0.1, 0.65, d);
  for (const side of [-1, 1]) {
    const x = info.x + (side * info.width) / 2,
      f = side < 0 ? face([x, z0], [x, z1]) : face([x, z1], [x, z0]),
      n = d === 0 ? 1 : d === 1 ? 3 : Math.max(2, Math.ceil(f.len / 4.5));
    for (let j = 0; j <= n; j++) {
      const p = f.p((f.len * j) / n, 0.65);
      column(o, p, 2.75, d, 0.16);
      bracket(o, f, (f.len * j) / n, 3.4, d);
    }
    if (d === 0) panel(o, f, 'wood', rect(f.len / 2, 3.3, f.len, 0.3));
    else localBox(o, f, 'wood', f.len / 2, 3.3, 0, f.len, 0.28, 0.3);
  }
  const f = cellFrame(q, 'V');
  roofSheet(o, f, 3.6, 4.7, d);
  firewalls(o, f, 3.6, 4.7, d);
  ridge(o, f, 4.76, d, 'walk', Math.round(info.x));
}
function build(o, _frame, d = 3) {
  const mainIds = plan.estimatedTopology.transverseRanges.map((r) => r.id);
  for (const c of components) {
    const hall = mainIds.includes(c.id);
    componentShell(o, c.quad, hall ? 'hall' : 'wing', d);
    for (let k = 0; k < 3; k++) {
      const sub = part(c.quad, hall ? 'U' : 'V', k / 3, (k + 1) / 3),
        f = cellFrame(sub, hall ? 'U' : 'V'),
        central = hall && k === 1,
        rangeIndex = mainIds.indexOf(c.id),
        e = hall ? 5.4 : 4.6,
        r = hall ? 8.65 + (central ? 0.55 : 0) + (rangeIndex === 1 ? 0.35 : 0) : 6.8;
      roofSheet(o, f, e, r, d);
      firewalls(o, f, e, r, d);
      ridge(o, f, r + 0.06, d, hall ? 'hall' : 'wing', k + (rangeIndex + 2) * 3);
    }
  }
  for (const info of plan.estimatedTopology.innerWalks) walk(o, info, d);
  const entrance = components.find((c) => c.id === 'way/682114505'),
    front = face(entrance.quad[3], entrance.quad[2]),
    center = front.len / 2;
  for (const x of [front.len / 6, center, (front.len * 5) / 6])
    steps(o, front, x, x === center ? 5.2 : 3.5, d);
  if (d > 0) {
    localBox(o, front, 'wood', center, 4.0, -1.92, 5.7, 0.92, 0.18, red);
    glyphs(o, front, center, 4.05, 5.2, 0.78, d);
    for (const s of [-1, 1]) guardian(o, front.p(center + s * 5.4, 0, 1.1), d, s);
  }
  for (const c of components.filter((c) => mainIds.includes(c.id))) {
    const f = face(c.quad[3], c.quad[2]);
    for (const s of [-1, 1]) piercedRail(o, f, f.len / 2 + s * 11, 0.68, 12, d);
  }
  if (d > 1) {
    const mid = components.find((c) => c.id === 'way/682114504'),
      f = face(mid.quad[2], mid.quad[1]);
    architecturalRelief(o, f, f.len * 0.5, 1.0, 9.0, 2.8, d);
  }
}
export const chenClanSkyline = (o, f) => build(o, f, 0);
export const chenClanDistrict = (o, f) => build(o, f, 1);
export const chenClanStreet = (o, f) => build(o, f, 2);
export const chenClanHallModel = {
  id: 'chen_clan_ancestral_hall',
  key: 'chen_clan_ancestral_hall',
  recipe: 'structure-chen-clan-ancestral-hall.mjs',
  cell: 'ws/ws0',
  title: 'Chen Clan Ancestral Hall',
  category: 'civic-institutional',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native museum/5roofed-range compound: three successive transverse hall ranges/long side wings, open courts and inferred low covered links, nineteen articulated Lingnan gable/roof volumes, grey rolled tile courses, red raised firewalls, genuinely pierced multi-tier ceramic ridge/pavilion/robed-figure/fish ornament, stone colonnades/carved brackets, dark timber screens/plaque, intrinsic platforms/steps/pierced rails and entrance guardians. No metro station, modern museum collections, square/streets or landscape. Native parent outlines retained; roof subdivisions, concealed elevations/layout and fine sculpture are bounded photographic estimates.',
  camera: [112, 68, 132],
  lookAt: [0, 4, 2],
  portableGroundY: 0,
  mediumFiContext: { scale: 3 },
  qaCameras: [
    {
      name: 'south-entrance-colonnade-plaque-and-guardian-lions',
      position: [1, 9, 73],
      lookAt: [0, 5, 43],
    },
    {
      name: 'pierced-ceramic-tableaux-fish-ridges-and-rolled-tiles',
      position: [12, 15, 59],
      lookAt: [0, 9, 37],
    },
    {
      name: 'six-open-courts-low-covered-links-and-gathering-hall',
      position: [24, 19, 24],
      lookAt: [0, 5, 0],
    },
    {
      name: 'complete-native-three-range-side-wing-compound',
      position: [-105, 65, -122],
      lookAt: [0, 4, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed south approach[0,53]was selected before terrain acquisition; bounded native platforms/steps only, no courtyard/site flattening.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-chen-clan-ancestral-hall.mjs',
    level: 'skyline',
    export: 'chenClanSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'chenClanDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'chenClanStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'All5original roofed-range outlines are preserved independently inside the named museum enclosure. Nine transverse-range gables, six long-wing roof segments and four low covered links are a bounded photo/text-inferred topology for the nine halls/six courts; they are not separately surveyed19historic building footprints. No enclosure-sized solid block or filled courts, and no similarly named underground metrostation.',
    'Main eaves5.4m/ridges8.65–9.55m/ceramic crowns roughly11.6m, wing eaves4.6m/ridges6.8m, low-walk eaves3.6m/ridges4.7m and intrinsic.65mplatforms are photographic estimates. Exact internal room divisions, hidden roofs/rear elevations, individual roof extents and grade/contact remain unverified.',
    'Four exact QuallaZyng1PublicDomainarchitectural originals were inspected first, then same-creatorPD-self450x260overall front for broad composition and four explicit self|cc-zero2019courtyard/hall/corridor originals by神樂坂秀吉. Native hashes/revision/dedications are saved; all9selected originals inspected. No other image, museum screen-door/collection material, modern exhibit or photographic texture.',
    'Grey paired cylindrical tile rolls/rounded eave ends, raised red hard-gable walls, open stone/timber colonnades and pierced ceramic tableaux/pavilion/robed-figure/fish crests are genuine geometry. Fine portraits/drama identities, particular relief scenes, complete ridge sculptural census, calligraphy fonts, erosion/individual tile joints and detailed interior objects are bounded original medium-fi approximations. Entrance plaque uses original geometric strokes for the observed right-to-left陳氏書院; no image glyph texture.',
    'Roof tile cover rolls are grouped at roughly.65mclose-detail pitch rather than every ancient tile; paired roll/gutter rhythm and rounded eave silhouettes are retained. Fine rolled tiles/robed figures/lattice, capital and brick relief, pierced rail inserts and lettering retire progressively at distance.',
    'Only intrinsic native floors/platforms, low walk floors, three short entrance flights, rails and guardians are included. Trees/planting/visitors/lantern decor, museum exhibits/furnishings, utility wires/flags/cameras/bins, modern neighboring buildings and adjacent square/roads excluded. Fixed front point[0,53]precedes terrain sampling; source relief is retained without a whole-site slab, and exact footing/threshold/host-terrain contact remains unverified.',
  ],
};
