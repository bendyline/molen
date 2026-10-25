/** Complete iron pier, twin-domed entry, theatre, RNLI boathouse and full launch ramp. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u1/u12/cromer_pier/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    deck: rgb('9b9689'),
    wall: rgb('d9d7c9'),
    roof: rgb('9aa19f'),
    iron: rgb('796d5b'),
    concrete: rgb('989b92'),
    glass: rgb('435b63'),
  },
  surfaces = {
    deck: { slot: 'foundation', graph: 'wood_plain', roughness: 0.96, metallic: 0 },
    wall: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.87, metallic: 0.18 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.91, metallic: 0.22 },
    concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.03 },
  };
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
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      s,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
}
function rod(o, s, a, b, w, d = 1, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    len = Math.hypot(...v),
    axis = v.map((x) => x / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u);
  if (d === 0) {
    for (const n of [u, v2])
      Q(
        o,
        s,
        [
          a.map((x, k) => x - (n[k] * w) / 2),
          a.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x - (n[k] * w) / 2),
        ],
        cross(n, axis),
        col,
      );
    return;
  }
  const ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((x, k) => x - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    axis.map((x) => -x),
    col,
  );
  Q(o, s, B, axis, col);
}
function face(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sg = Math.sign(
      r.reduce(
        (s, v, k) => s + v[0] * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * v[1],
        0,
      ),
    ),
    n = [sg * u[1], 0, -sg * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 > 1e-5 && y1 - y0 > 1e-5)
    Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function flat(o, s, f, r, depth = 0, col = C[s], holes = []) {
  const coords = r.flat(),
    starts = [];
  for (const h of holes) {
    starts.push(coords.length / 2);
    coords.push(...h.flat());
  }
  const ix = earcut(coords, starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(coords[k * 2], coords[k * 2 + 1], depth)),
      f.n,
      col,
    );
}
const rectangle = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

function reveal(o, s, f, r, depth, col = C[s]) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = -(b[1] - a[1]),
      v = b[0] - a[0],
      A = f.P(0, 0),
      B = f.P(u, v);
    Q(
      o,
      s,
      [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)],
      [B[0] - A[0], v, B[2] - A[2]],
      col,
    );
  }
}

const D = p.parameters.deck,
  R = p.outline,
  E = p.entry,
  THEATRE = p.theatre,
  RNLI = p.boathouse,
  cream = rgb('e0dcc5'),
  gold = rgb('b8a27a'),
  blue = rgb('355777'),
  vary = (c, t) => c.map((v) => Math.min(1, v * t));
function prism(o, s, r, y0, y1, d = 3, col = C[s]) {
  if (d) cap(o, s, r, y0, false, col);
  cap(o, s, r, y1, true, col);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i);
    rect(o, s, f, 0, y0, f.len, y1, 0, col);
  }
}
function thin(o, s, a, b, w, d, col = C[s]) {
  if (d === 0) {
    const v = b.map((x, k) => x - a[k]);
    const u = cross(v, Math.abs(v[1]) > Math.hypot(v[0], v[2]) ? [1, 0, 0] : [0, 1, 0]);
    const n = u.map((x) => (x * w) / (2 * Math.hypot(...u)));
    Q(
      o,
      s,
      [
        a.map((x, k) => x - n[k]),
        a.map((x, k) => x + n[k]),
        b.map((x, k) => x + n[k]),
        b.map((x, k) => x - n[k]),
      ],
      cross(u, v),
      col,
    );
    return;
  }
  rod(o, s, a, b, w, d === 0 ? 0 : d === 1 ? 0 : 1, col);
}
function wire(o, s, a, b, w, col = C[s]) {
  rod(o, s, a, b, w, 0, col);
}
function rectRing(x0, z0, x1, z1) {
  return [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
}
function circle(x, z, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + Math.cos((i * 2 * Math.PI) / n) * r,
    z + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
}
function cylinder(o, s, x, z, r, y0, y1, d, col = C[s]) {
  const n = d < 2 ? 4 : 10,
    ring = circle(x, z, r, n);
  if (d) {
    cap(o, s, ring, y0, false, col);
    cap(o, s, ring, y1, true, col);
  }
  for (let i = 0; i < n; i++) {
    const f = face(ring, i);
    rect(o, s, f, 0, y0, f.len, y1, 0, col);
  }
}
function roofMesh(o, r, height, d, s = 'roof', col = C[s]) {
  const ix = earcut(r.flat()),
    depth = d > 1 ? 3 : 1;
  function tri(q, n) {
    if (n) {
      const mid = (a, b) => a.map((v, k) => (v + b[k]) / 2),
        a = mid(q[0], q[1]),
        b = mid(q[1], q[2]),
        c = mid(q[2], q[0]);
      for (const pp of [
        [q[0], a, c],
        [a, q[1], b],
        [c, b, q[2]],
        [a, b, c],
      ])
        tri(pp, n - 1);
    } else
      T(
        o,
        s,
        q.map(([x, z]) => [x, height(x, z), z]),
        [0, 1, 0],
        col,
      );
  }
  for (let k = 0; k < ix.length; k += 3)
    tri(
      ix.slice(k, k + 3).map((i) => r[i]),
      depth,
    );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = d > 1 ? 8 : d ? 4 : 1;
    for (let j = 0; j < n; j++) {
      const t = j / n,
        u = (j + 1) / n,
        A = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        B = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
        low = s === 'roof' ? (r === RNLI ? 14.7 : 12.7) : 12.7;
      Q(
        o,
        s,
        [
          [A[0], low, A[1]],
          [B[0], low, B[1]],
          [B[0], height(...B), B[1]],
          [A[0], height(...A), A[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        col,
      );
    }
  }
}
function window(o, f, x, y, w, h, d, col = C.wall) {
  const sh = rectangle(x - w / 2, y, x + w / 2, y + h);
  if (d > 1) {
    reveal(o, 'wall', f, sh, 0.13, col);
    flat(o, 'glass', f, sh, -0.14);
  } else flat(o, 'glass', f, sh, 0.018);
  if (d > 1) {
    for (const xx of [x - w / 2, x + w / 2])
      rect(o, 'wall', f, xx - 0.035, y - 0.04, xx + 0.035, y + h + 0.05, 0.04, col);
    rect(o, 'wall', f, x - w / 2 - 0.04, y + h - 0.015, x + w / 2 + 0.04, y + h + 0.065, 0.04, col);
  }
  return sh;
}
function body(o, r, lo, hi, d, kind = 'wing') {
  if (d > 1) cap(o, 'wall', r, lo, false);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i),
      holes = [];
    let count = 0,
      y = D + 0.65,
      w = 0.8,
      h = 1.7;
    if (kind === 'booth') {
      count = f.len > 0.5 ? Math.max(1, Math.round(f.len / 1.35)) : 0;
      h = 2.15;
      w = Math.min(1.1, (f.len * 0.78) / Math.max(1, count));
    } else if (kind === 'theatre') {
      count = i >= 2 && i <= 12 && f.len > 0.55 ? 1 : f.len > 20 ? 3 : 0;
      y = i >= 2 && i <= 12 ? D + 0.6 : D + 1.65;
      h = i >= 2 && i <= 12 ? 2.15 : 0.72;
      w = Math.min(1.1, f.len * 0.72);
    } else if (kind === 'rnli') {
      count = f.len > 4 ? Math.max(1, Math.round(f.len / 4.5)) : 0;
      y = 13.25;
      h = 0.86;
      w = 1.05;
    } else count = f.len > 4 ? Math.max(1, Math.floor(f.len / 3.4)) : 0;
    if (d === 0 && kind !== 'booth') count = 0;
    if (d === 1 && kind !== 'booth') count = Math.ceil(count / 2);
    if (kind === 'rnli' && i === 12) {
      const x = f.len / 2,
        door = rectangle(x - 1.3, D, x + 1.3, D + 2.65),
        circles = [-0.65, 0.65].map((off) =>
          Array.from({ length: d > 1 ? 16 : 6 }, (_, k) => [
            x + off + Math.cos((k * 2 * Math.PI) / (d > 1 ? 16 : 6)) * 0.28,
            D + 1.32 + Math.sin((k * 2 * Math.PI) / (d > 1 ? 16 : 6)) * 0.28,
          ]),
        );
      if (d) {
        holes.push(door);
        reveal(o, 'wall', f, door, 0.18, blue);
        flat(o, 'wall', f, door, -0.18, blue, circles);
        for (const sh of circles) flat(o, 'glass', f, sh, -0.195);
      } else flat(o, 'wall', f, door, 0.02, blue);
      if (d > 1) rect(o, 'wall', f, x - 0.045, D, x + 0.045, D + 2.65, -0.16, blue);
    }
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * f.len) / count,
        sh = window(o, f, x, y, w, h, d, kind === 'rnli' ? blue : C.wall);
      if (d > 1) holes.push(sh);
    }
    flat(o, 'wall', f, rectangle(0, lo, f.len, hi), 0, C.wall, holes);
    if (kind === 'rnli' && d > 0) {
      const n = Math.max(1, Math.round(f.len / 3.3));
      for (let j = 0; j <= n; j++)
        rect(o, 'wall', f, (f.len * j) / n - 0.06, D, (f.len * j) / n + 0.06, hi, 0.06, blue);
    }
    if (d > 1) rect(o, 'wall', f, 0, hi - 0.15, f.len, hi, 0.06, cream);
  }
  if (d > 1) cap(o, 'wall', r, hi);
}
function dome(o, r, eave, rise, d, col = gold) {
  const c = [0, 1].map((k) => r.reduce((s, v) => s + v[k] / r.length, 0)),
    rings = d > 1 ? 4 : 1;
  for (let k = 0; k < rings; k++) {
    const a = (k * Math.PI) / 2 / rings,
      b = ((k + 1) * Math.PI) / 2 / rings;
    for (let j = 0; j < r.length; j++) {
      const A = r[j],
        B = r[(j + 1) % r.length],
        P = (v, t) => [
          c[0] + (v[0] - c[0]) * Math.cos(t),
          eave + Math.sin(t) * rise,
          c[1] + (v[1] - c[1]) * Math.cos(t),
        ];
      Q(o, 'roof', [P(A, a), P(B, a), P(B, b), P(A, b)], [0, 1, 0], col);
    }
  }
  if (d > 1)
    for (const v of r) {
      const a = [v[0], eave + 0.015, v[1]],
        b = [c[0] + (v[0] - c[0]) * 0.72, eave + rise * 0.72, c[1] + (v[1] - c[1]) * 0.72];
      wire(o, 'roof', a, b, 0.045, vary(col, 0.76));
    }
  return c;
}
function cupola(o, x, z, y, d) {
  const n = d ? 8 : 4,
    r = 0.72,
    ring = circle(x, z, r, n);
  prism(o, 'wall', ring, y, y + 0.65, d, cream);
  if (d)
    for (let i = 0; i < n; i++) {
      const f = face(ring, i);
      rect(o, 'glass', f, 0.12, y + 0.12, f.len - 0.12, y + 0.5, 0.016);
    }
  for (let i = 0; i < n; i++)
    T(
      o,
      'roof',
      [
        [ring[i][0], y + 0.65, ring[i][1]],
        [ring[(i + 1) % n][0], y + 0.65, ring[(i + 1) % n][1]],
        [x, y + 1.22, z],
      ],
      [0, 1, 0],
    );
  if (d > 1) thin(o, 'iron', [x, y + 1.2, z], [x, y + 1.8, z], 0.045, d);
}
function hipRoof(o, r, eave, rise, d) {
  const x0 = Math.min(...r.map((v) => v[0])),
    x1 = Math.max(...r.map((v) => v[0])),
    z0 = Math.min(...r.map((v) => v[1])),
    z1 = Math.max(...r.map((v) => v[1])),
    cz = (z0 + z1) / 2;
  const h = (x, z) =>
    eave +
    rise *
      Math.max(0, Math.min(1 - Math.abs(z - cz) / ((z1 - z0) / 2), (x - x0) / 2, (x1 - x) / 2));
  const ix = earcut(r.flat());
  function tr(q, n) {
    if (n) {
      const M = (a, b) => a.map((v, k) => (v + b[k]) / 2),
        a = M(q[0], q[1]),
        b = M(q[1], q[2]),
        c = M(q[2], q[0]);
      for (const v of [
        [q[0], a, c],
        [a, q[1], b],
        [c, b, q[2]],
        [a, b, c],
      ])
        tr(v, n - 1);
    } else
      T(
        o,
        'roof',
        q.map(([x, z]) => [x, h(x, z), z]),
        [0, 1, 0],
      );
  }
  for (let i = 0; i < ix.length; i += 3)
    tr(
      ix.slice(i, i + 3).map((k) => r[k]),
      d > 1 ? 2 : d ? 1 : 0,
    );
}
function entry(o, d) {
  const northBooth = [...E.slice(1, 12), [-108.79, -5.23]],
    southBooth = [...E.slice(12, 24), [-108.6, 4.6]],
    northWing = [...E.slice(39), E[0], [-108.79, -1.54]],
    southWing = [...E.slice(23, 39), [-108.6, 1.82]];
  for (const r of [northWing, southWing]) {
    body(o, r, D, 12.65, d);
    hipRoof(o, r, 12.65, 1.55, d);
  }
  for (const r of [northBooth, southBooth]) {
    body(o, r, D, 12.65, d, 'booth');
    const c = dome(o, r, 12.65, 2.6, d);
    cupola(o, c[0], c[1], 15.25, d);
  }
  const canopy = rectRing(-113.42, -5.23, -108.6, 4.6);
  prism(o, 'wall', canopy, 12.65, 13.05, d, cream);
  for (const z of [-4.9, -1.65, 1.65, 4.45]) {
    if (d) cylinder(o, 'wall', -113.1, z, 0.2, D, 12.65, d, cream);
    else
      Q(
        o,
        'wall',
        [
          [-113.1, D, z - 0.2],
          [-113.1, D, z + 0.2],
          [-113.1, 12.65, z + 0.2],
          [-113.1, 12.65, z - 0.2],
        ],
        [-1, 0, 0],
        cream,
      );
  }
  if (d > 1) {
    const f = { len: 10, n: [-1, 0, 0], P: (x, y, z = 0) => [-113.45 - z, y, x - 5.23] };
    rect(o, 'roof', f, 0.1, 13.05, 9.7, 13.45, 0.02, cream);
  }
}
function pavilion(o, d) {
  body(o, THEATRE, D, 12.7, d, 'theatre');
  const height = (x, z) =>
    12.7 + 2 * Math.max(0, Math.min(Math.sqrt(Math.max(0, 1 - (z / 12.6) ** 2)), (x - 3) / 8, 1));
  roofMesh(o, THEATRE, height, d);
  const front = THEATRE.slice(2, 14);
  const c = dome(o, front, 12.7, 2.2, d, rgb('a7adab'));
  cupola(o, c[0], c[1], 14.9, d);
  box(o, 'wall', 25, 14.5, 0, 26, 1.05, 5.0, rgb('8e5145'));
  if (d) for (const x of [15, 20, 25, 30, 35]) box(o, 'roof', x, 15.55, 0, 1.2, 0.4, 1.5);
  if (d > 1)
    for (const sign of [-1, 1])
      for (let j = 0; j < 13; j++) {
        const x = 12.5 + j * 2;
        wire(o, 'roof', [x, 13.3, sign * 11.5], [x, 14.69, sign * 0.6], 0.035, vary(C.roof, 0.76));
      }
}
function rnli(o, d) {
  body(o, RNLI, D, 14.7, d, 'rnli');
  const h = (x, z) => {
    const a = Math.abs(z - 0.1) <= 6.75 ? Math.sqrt(Math.max(0, 1 - ((z - 0.1) / 6.75) ** 2)) : 0,
      b = x >= 55.6 && x <= 66 ? Math.sqrt(Math.max(0, 1 - ((x - 60.8) / 5.2) ** 2)) : 0;
    return 14.7 + 2.8 * Math.max(a, b);
  };
  roofMesh(o, RNLI, h, d);
  if (d > 1) {
    for (const z of [-6.0, -3, 0, 3, 6])
      wire(
        o,
        'roof',
        [50.5, h(50.5, z) + 0.02, z],
        [79.5, h(79.5, z) + 0.02, z],
        0.045,
        vary(C.roof, 0.73),
      );
    for (const z of [-9, -5, 0, 5, 9]) {
      wire(
        o,
        'roof',
        [55.8, h(55.8, z) + 0.02, z],
        [65.8, h(65.8, z) + 0.02, z],
        0.035,
        vary(C.roof, 0.75),
      );
    }
  }
}
function shelters(o, d) {
  for (const r of p.shelters) {
    const xs = r.map((v) => v[0]),
      zs = r.map((v) => v[1]),
      x = (Math.min(...xs) + Math.max(...xs)) / 2,
      z = (Math.min(...zs) + Math.max(...zs)) / 2;
    prism(o, 'wall', r, D, D + 0.8, d, cream);
    for (const a of r) {
      if (d) thin(o, 'wall', [a[0], D + 0.8, a[1]], [a[0], D + 3, a[1]], 0.09, d, cream);
    }
    if (d)
      for (let i = 0; i < 4; i++) {
        const f = face(r, i);
        rect(o, 'glass', f, 0.12, D + 0.87, f.len - 0.12, D + 2.85, -0.025);
      }
    for (let i = 0; i < 4; i++)
      T(
        o,
        'roof',
        [
          [r[i][0], D + 3, r[i][1]],
          [r[(i + 1) % 4][0], D + 3, r[(i + 1) % 4][1]],
          [x, D + 4.5, z],
        ],
        [0, 1, 0],
        cream,
      );
  }
}
function crossSection(x) {
  const zz = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
      zz.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  zz.sort((a, b) => a - b);
  return [zz[0] + 0.55, zz.at(-1) - 0.55];
}
function structure(o, d) {
  // The native pier polygon includes the descending launch branch. Keep that
  // branch out of the level walking deck so it cannot bury the launch ramp.
  const cutX = p.slipway[0][0];
  const cut = (a, b) => [cutX, a[1] + ((b[1] - a[1]) * (cutX - a[0])) / (b[0] - a[0])];
  const deck = [...R.slice(0, 25), cut(R[24], R[25]), cut(R[27], R[26]), ...R.slice(27)];
  prism(o, 'deck', deck, D - 0.4, D, d);
  const a = p.slipway[0],
    b = p.slipway[1],
    v = b.map((x, k) => x - a[k]),
    length = Math.hypot(...v);
  const branch = R.slice(24, 28);
  const height = (q) =>
    D - (((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / (length * length)) * (D - 0.3) - 0.12;
  for (const ix of [
    [0, 1, 2],
    [0, 2, 3],
  ])
    T(
      o,
      'concrete',
      ix.map((i) => [branch[i][0], height(branch[i]), branch[i][1]]),
      [0, 1, 0],
    );
  for (let i = 0; i < branch.length; i++) {
    const a = branch[i],
      b = branch[(i + 1) % branch.length];
    Q(
      o,
      'concrete',
      [
        [a[0], height(a) - 0.3, a[1]],
        [b[0], height(b) - 0.3, b[1]],
        [b[0], height(b), b[1]],
        [a[0], height(a), a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  const bent = p.parameters.mainBentX;
  for (const x of bent) {
    const [z0, z1] = crossSection(x),
      zs = d ? [z0, z0 + (z1 - z0) / 3, z0 + (2 * (z1 - z0)) / 3, z1] : [z0, z1];
    for (const z of zs) thin(o, 'iron', [x, 0, z], [x, D - 0.4, z], d ? 0.22 : 0.34, d);
    thin(o, 'iron', [x, D - 0.8, z0], [x, D - 0.8, z1], 0.25, d);
    if (d)
      for (const [zA, zB] of [[z0, z1]])
        for (const side of [0, 1])
          thin(o, 'iron', [x, 1.4, side ? zA : zB], [x, D - 1.2, side ? zB : zA], 0.1, d);
  }
  for (let k = 0; k < bent.length - 1; k++) {
    const a = bent[k],
      b = bent[k + 1],
      A = crossSection(a),
      B = crossSection(b);
    for (let s = 0; s < 2; s++) {
      thin(o, 'iron', [a, D - 0.7, A[s]], [b, D - 0.7, B[s]], 0.26, d);
      if (d)
        for (const flip of [0, 1])
          thin(
            o,
            'iron',
            [a, flip ? 1.3 : D - 1.3, A[s]],
            [b, flip ? D - 1.3 : 1.3, B[s]],
            0.12,
            d,
          );
    }
  }
  for (const x of p.parameters.rnliBentX) {
    const zs = d ? [-5.7, -1.9, 1.9, 5.7] : [-5.7, 5.7];
    for (const z of zs)
      if (d) cylinder(o, 'concrete', x, z, 0.44, 0, D - 0.4, d);
      else wire(o, 'concrete', [x, 0, z], [x, D - 0.4, z], 0.65);
    thin(o, 'concrete', [x, D - 0.8, -6.1], [x, D - 0.8, 6.1], 0.6, d);
  }
  if (d)
    for (const x of [56, 64])
      for (const z of [-10, 10]) cylinder(o, 'concrete', x, z, 0.44, 0, D - 0.4, d);
}
function railings(o, d) {
  for (let i = 0; i < R.length; i++) {
    const f = face(R, i),
      a = R[i];
    if (i >= 24 && i <= 26) continue;
    if (i >= 52) continue;
    const rnli = a[0] > 43 && a[0] < 82,
      levels = d > 1 ? [D + 0.28, D + 0.68, D + 1.15] : d ? [D + 0.28, D + 1.15] : [D + 1.15],
      col = rnli ? blue : cream;
    for (const y of levels) {
      if (d) wire(o, 'wall', f.P(0, y, -0.08), f.P(f.len, y, -0.08), 0.065, col);
      else
        Q(
          o,
          'wall',
          [f.P(0, y - 0.06), f.P(f.len, y - 0.06), f.P(f.len, y + 0.06), f.P(0, y + 0.06)],
          f.n,
          col,
        );
    }
    if (d) {
      const n = Math.max(1, Math.ceil(f.len / (d === 1 ? 5.0 : 2.3)));
      for (let j = 0; j <= n; j++)
        thin(
          o,
          'wall',
          f.P((f.len * j) / n, D),
          f.P((f.len * j) / n, D + 1.2),
          0.085,
          d === 1 ? 0 : 1,
          col,
        );
      if (rnli && d > 1)
        for (let j = 0; j < n; j++)
          for (const flip of [0, 1])
            wire(
              o,
              'wall',
              f.P((f.len * j) / n, flip ? D + 0.18 : D + 0.94),
              f.P((f.len * (j + 1)) / n, flip ? D + 0.94 : D + 0.18),
              0.035,
              col,
            );
    }
  }
  if (d)
    for (const x of [-86, -66, -48, -28, -8, 8, 28, 40]) {
      const zs = crossSection(x);
      for (const z of zs) {
        thin(o, 'iron', [x, D, z], [x, D + 3.4, z], 0.075, d, rgb('4e5752'));
        box(o, 'wall', x, D + 3.1, z, 0.32, 0.48, 0.32, cream);
        if (d > 1)
          for (const sign of [-1, 1])
            T(
              o,
              'iron',
              [
                [x - 0.28, D + 3.58, z + sign * 0.28],
                [x + 0.28, D + 3.58, z + sign * 0.28],
                [x, D + 3.88, z],
              ],
              [0, 1, 0],
            );
      }
    }
}
function launchRamp(o, d) {
  const a = p.slipway[0],
    b = p.slipway[1],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    P = (t, y, z) => [a[0] + u[0] * t + n[0] * z, y, a[1] + u[1] * t + n[1] * z],
    top = 9.5,
    low = 0.3;
  Q(
    o,
    'concrete',
    [P(0, top, -2.7), P(len, low, -2.7), P(len, low, 2.7), P(0, top, 2.7)],
    [0, 1, 0],
  );
  for (const sign of [-1, 1]) {
    Q(
      o,
      'concrete',
      [
        P(0, top - 0.5, sign * 2.7),
        P(len, low - 0.3, sign * 2.7),
        P(len, low, sign * 2.7),
        P(0, top, sign * 2.7),
      ],
      [sign * n[0], 0, sign * n[1]],
    );
    thin(o, 'iron', P(0, top + 0.06, sign * 1.1), P(len, low + 0.06, sign * 1.1), 0.085, d, blue);
  }
  if (d) {
    for (const t of [0.2, 0.45, 0.7, 0.92]) {
      const y = top + (low - top) * t;
      for (const z of [-2, 2]) {
        const q = P(len * t, 0, z);
        cylinder(o, 'concrete', q[0], q[2], 0.38, 0, y - 0.1, d);
      }
    }
    if (d > 1)
      for (let j = 1; j < 32; j++) {
        const t = j / 32,
          y = top + (low - top) * t;
        wire(o, 'iron', P(len * t, y + 0.035, -1.0), P(len * t, y + 0.035, 1.0), 0.055, blue);
      }
  }
}
function build(o, _f, d = 3) {
  structure(o, d);
  entry(o, d);
  pavilion(o, d);
  rnli(o, d);
  shelters(o, d);
  railings(o, d);
  launchRamp(o, d);
}
export const cromerPierSkyline = (o, f) => build(o, f, 0),
  cromerPierDistrict = (o, f) => build(o, f, 1),
  cromerPierStreet = (o, f) => build(o, f, 2),
  cromerPierCloseup = (o, f) => build(o, f, 3);
export const cromerPierModel = {
  id: 'cromer_pier',
  key: 'cromer_pier',
  cell: 'u1/u12',
  recipe: 'structure-cromer-pier.mjs',
  title: 'Cromer Pier',
  category: 'transport',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-145, 105, 210],
  lookAt: [0, 9, 0],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.15, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-pier-entry-theatre-rnli-and-complete-launch-ramp',
      position: [-135, 100, 205],
      lookAt: [0, 10, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'twin-domed-entry-open-portico-and-hipped-shop-wings',
      position: [-139, 23, 31],
      lookAt: [-106, 12.6, 0],
    },
    {
      name: 'steel-pile-bents-cross-bracing-and-open-railed-boardwalk',
      position: [-38, 12, 36],
      lookAt: [-35, 7, 0],
    },
    {
      name: 'pavilion-theatre-shaped-roof-front-rotunda-and-ridge-crown',
      position: [16, 30, 61],
      lookAt: [18, 12.8, 0],
    },
    {
      name: 'rnli-blue-framed-boathouse-curved-roof-and-full-launch-slipway',
      position: [130, 40, 65],
      lookAt: [78, 11, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} Independent256m129square2m field frozenbeforegeometry; seawardproviderdatum-1.6723m/architecturalpiletoe0/deck9.5m are notsurveyedchart/tidal/seabeddatum. Actualhostcontact unverified.`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cromer-pier.mjs',
    level: 'skyline',
    export: 'cromerPierSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'cromerPierDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'cromerPierStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'cromerPierCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Complete55pointdeck/54pointentry/16pointtheatre/13pointRNLI/2shelters4pointseach/launchline2endpoints retained. Entryroofsubdivision/domedboothshapes/hipwings/openportico/theatreshapedroof/RNLIcrossbarrel/pilecensus/railspacing/launchgrade and hiddenminordetail estimated from4clearphotos/nativeplan. No town/promenade/coastbeach/sea/groynes/temporarybunting/scaffold/adverts/people/vehicles/boats/interiors.',
    'OneexactpublishedNorthmetpitPD2008RNLIfront andthree supplementalnativeownPD/CC0originals individuallyinspected/nativeSHA1bound. Mainnativecategory284files/no continuation; existingnativehelperpassedall3. PublishedStavros2007metadata-disagreement image notused, no source-record/category/policychanges. Primaryoperator/heritage/RNLItextonly, protectedofficialplans/photos notused; no phototexture/generatedbitmap/downloadedmesh.',
    'ArchitecturalY0piletoe/deck9.5m/entryeave12.65m/domerise2.6m/theatreeave12.7m/roof+2m/raisedcrown15.55m/RNLIeave14.7m/curvedroof+2.8m/slipwayfoot.3m independentlyestimated beforeterrain. Coarse nativeele10/theatreheight5 are notsurveycontrol. Actualpileembedment/submergedtoe/tide/thresholdregistration unverified.',
    'Independent256m129square2m all16641values/PNG/oneTerrariumtile frozenbeforegeometryunchanged. Providerdatum-1.6723m/sourcepixel2.879468954051165m/absolute-1.7182..7.6034m notsurveyaccuracy. No terrainfitting/flattening/reacquisition, ordinarygeographicpreview/replacementdisabled; flatreviewfixturesseparateactualcoastalground.',
    'Nominalmainpier151m fromoperator reachesTheatrehead; physicallyintrinsicRNLIboathouse/fullseawardramp extend wholeenvelope to~232m. Whole-geometrymodelthereforedoesnottruncateat151m. Current2026permanentpaint/conditionnotcertified; selected2019weatheredgoldentrydomes andgraymetalroof palette.',
  ],
};
