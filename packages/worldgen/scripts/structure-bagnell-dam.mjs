/** Complete four-section Bagnell dam, twelve radial gates and integral eight-unit powerhouse. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9y/9yy/bagnell_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters,
  C = {
    concrete: rgb('c4c3b8'),
    brick: rgb('947e66'),
    road: rgb('555951'),
    glass: rgb('4b6265'),
    metal: rgb('747b74'),
    paint: rgb('adbfc4'),
  },
  surfaces = {
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    brick: { slot: 'trim', graph: 'brick', roughness: 0.97, metallic: 0 },
    road: { slot: 'roof', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.06 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.2 },
    paint: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
  },
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  vary = (s, k) => C[s].map((v) => v * (0.94 + ((k * 13) % 17) / 180));
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
    'palette:#ffffff',
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
function solid(o, s, r, y, h, col = C[s]) {
  if (
    r.reduce(
      (a, v, k) => a + v[0] * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * v[1],
      0,
    ) < 0
  )
    r = r.toReversed();
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
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
function box(o, s, x, y, z, w, h, l, u = [1, 0], col = C[s]) {
  solid(
    o,
    s,
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [
      x + (u[0] * i * w) / 2 - (u[1] * j * l) / 2,
      z + (u[1] * i * w) / 2 + (u[0] * j * l) / 2,
    ]),
    y,
    h,
    col,
  );
}
function rod(o, s, a, b, w, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    n = v.map((v) => v / l),
    u0 = cross(n, Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(n, u),
    R = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((v, k) => v + ((u[k] * i + vv[k] * j) * w) / 2)),
    B = R(a),
    D = R(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...B].reverse(),
    n.map((v) => -v),
    col,
  );
  Q(o, s, D, n, col);
}
export function bagnellCrest(s) {
  const rr = p.crest;
  let i = rr.findIndex(
    (a, i) => i < rr.length - 1 && a.station <= s + 1e-7 && rr[i + 1].station >= s - 1e-7,
  );
  if (i < 0) i = s < rr[0].station ? 0 : rr.length - 2;
  const a = rr[i],
    b = rr[i + 1],
    t = (s - a.station) / (b.station - a.station),
    c = mix(a.position, b.position, t),
    v = b.position.map((x, k) => x - a.position[k]),
    l = Math.hypot(...v);
  return { c, u: v.map((x) => x / l), n: [-v[1] / l, v[0] / l] };
}
const P = (s, y, z = 0) => {
    const { c, n } = bagnellCrest(s);
    return [c[0] + n[0] * z, y, c[1] + n[1] * z];
  },
  marks = (a, b, step) =>
    [
      a,
      ...p.crest.map((v) => v.station).filter((s) => s > a + 0.001 && s < b - 0.001),
      ...Array.from(
        { length: Math.max(0, Math.ceil((b - a) / step) - 1) },
        (_, i) => a + ((i + 1) * (b - a)) / Math.ceil((b - a) / step),
      ),
      b,
    ]
      .sort((a, b) => a - b)
      .filter((v, i, r) => !i || v - r[i - 1] > 0.001);
function sweep(o, s, a, b, profile, col = C[s]) {
  if (
    profile.reduce(
      (a, v, k) =>
        a +
        v[0] * profile[(k + 1) % profile.length][1] -
        profile[(k + 1) % profile.length][0] * v[1],
      0,
    ) < 0
  )
    profile = profile.toReversed();
  const I = earcut(profile.flat()),
    point = (st, q) => P(st, q[0], q[1]);
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length,
      q = [point(a, profile[i]), point(a, profile[j]), point(b, profile[j]), point(b, profile[i])];
    Q(o, s, q, undefined, col);
  }
  for (const [st, sg] of [
    [a, -1],
    [b, 1],
  ]) {
    const { u } = bagnellCrest(st);
    for (let i = 0; i < I.length; i += 3)
      T(
        o,
        s,
        I.slice(i, i + 3).map((k) => point(st, profile[k])),
        [u[0] * sg, 0, u[1] * sg],
        col,
      );
  }
}
function section(o, s, a, b, pa, pb, col = C[s], ends = [true, true]) {
  const point = (st, q) => P(st, q[0], q[1]);
  for (let i = 0; i < pa.length; i++) {
    const j = (i + 1) % pa.length;
    Q(o, s, [point(a, pa[i]), point(a, pa[j]), point(b, pb[j]), point(b, pb[i])], undefined, col);
  }
  for (const [st, sg, pr] of [
    [a, -1, pa],
    [b, 1, pb],
  ]) {
    if (!(sg < 0 ? ends[0] : ends[1])) continue;
    const I = earcut(pr.flat()),
      { u } = bagnellCrest(st);
    for (let i = 0; i < I.length; i += 3)
      T(
        o,
        s,
        I.slice(i, i + 3).map((k) => point(st, pr[k])),
        [u[0] * sg, 0, u[1] * sg],
        col,
      );
  }
}
function nativeToe(s) {
  const { c, n } = bagnellCrest(s),
    r = p.outline.slice(0, 10);
  const i = r.findIndex((q, i) => i < r.length - 1 && q[0] <= c[0] && r[i + 1][0] >= c[0]);
  if (i < 0) return s < 0 ? 8 : 16;
  const a = r[i],
    b = r[i + 1],
    t = (c[0] - a[0]) / (b[0] - a[0]),
    q = mix(a, b, t);
  return Math.max(6, (q[0] - c[0]) * n[0] + (q[1] - c[1]) * n[1]);
}
function retaining(o, d, east = false) {
  const lo = east ? p.sectionMarks[3] : p.sectionMarks[0],
    hi = east ? p.sectionMarks[4] : 0,
    rr = marks(lo, hi, [95, 45, 18, 8][d]),
    profile = (s) => {
      const t = east ? (s - lo) / (hi - lo) : -s / -lo,
        toe = (east ? A.eastToeAtBank : A.westToeAtBank) * Math.pow(t, 1.4),
        z = east ? 5.4 : nativeToe(s);
      if (d === 0)
        return [
          [0, -4.5],
          [31.05, -4.5],
          [31.05, 4.5],
          [0, z],
        ];
      return [
        [0, -4.5],
        [31.05, -4.5],
        [31.05, 4.5],
        [Math.max(toe + 0.3, 23.1), 5.2],
        [toe, z],
        [0, z],
      ];
    };
  for (let i = 0; i < rr.length - 1; i++)
    section(
      o,
      'concrete',
      rr[i],
      rr[i + 1],
      profile(rr[i]),
      profile(rr[i + 1]),
      vary('concrete', i),
      [i === 0, i === rr.length - 2],
    );
  if (d > 1)
    for (let s = lo + 6; s < hi; s += 9) {
      const pr = profile(s),
        toe = pr.at(-2);
      rod(
        o,
        'concrete',
        P(s, toe[0] + 0.15, toe[1] + 0.015),
        P(s, Math.max(toe[0] + 0.3, 23.1), 5.22),
        0.055,
        rgb('96998e'),
      );
    }
}
function spillProfile(s) {
  const z = nativeToe(s),
    top = A.gateTop - A.gateHeight;
  return [
    [0, -6],
    [top, -6],
    [top, 1],
    [top - 3, (z - 1) * 0.18 + 1],
    [14.3, (z - 1) * 0.43 + 1],
    [6.6, (z - 1) * 0.72 + 1],
    [1.5, (z - 1) * 0.92 + 1],
    [0.35, z],
    [0, z],
  ];
}
function spillway(o, d) {
  const N = 12,
    pitch = A.spillwayLength / N;
  if (d === 0) {
    const pr = spillProfile(A.spillwayLength / 2);
    sweep(o, 'concrete', 0, A.spillwayLength, [pr[0], pr[1], pr[2], pr.at(-2), pr.at(-1)]);
  }
  for (let k = 0; k < N; k++) {
    const a = k * pitch,
      b = (k + 1) * pitch,
      c = (a + b) / 2,
      pr = spillProfile(c);
    if (d > 0) sweep(o, 'concrete', a, b, pr, vary('concrete', k));
    const width = A.gateWidth,
      segments = [1, 3, 7, 14][d],
      gpoint = (s, t, back = 0) => {
        const th = t * 0.77;
        return P(
          s,
          A.gateTop - A.gateHeight + (Math.sin(th) / Math.sin(0.77)) * A.gateHeight,
          1 - (1 - Math.cos(th)) * 5 + back,
        );
      };
    for (let j = 0; j < segments; j++) {
      const t = j / segments,
        v = (j + 1) / segments;
      Q(
        o,
        'metal',
        [
          gpoint(c - width / 2, t),
          gpoint(c + width / 2, t),
          gpoint(c + width / 2, v),
          gpoint(c - width / 2, v),
        ],
        [0, 0, 1],
      );
      if (d > 0)
        Q(
          o,
          'metal',
          [
            gpoint(c + width / 2, t, -0.13),
            gpoint(c - width / 2, t, -0.13),
            gpoint(c - width / 2, v, -0.13),
            gpoint(c + width / 2, v, -0.13),
          ],
          [0, 0, -1],
        );
    }
    if (d > 1) {
      for (const off of [-width * 0.4, 0, width * 0.4])
        rod(o, 'metal', gpoint(c + off, 0.03, 0.08), gpoint(c + off, 0.98, 0.08), 0.1);
      for (const off of [-width / 2, width / 2]) {
        rod(o, 'metal', P(c + off, 22, -3.1), P(c + off, 27, -0.1), 0.18);
        rod(o, 'metal', P(c + off, 22, -3.1), P(c + off, 24.1, 0.8), 0.18);
      }
      const { c: cc, u } = bagnellCrest(a);
      box(o, 'metal', cc[0], 30.5, cc[1], 1.0, 0.48, 1.15, u);
    }
  }
  for (let k = 0; k <= N; k++) {
    const s = k * pitch,
      w = (pitch - A.gateWidth) * (k === 0 || k === N ? 0.5 : 1),
      a = Math.max(0, s - w / 2),
      b = Math.min(A.spillwayLength, s + w / 2),
      z = nativeToe(s),
      pr = [
        [0, -6],
        [31.0, -6],
        [31.0, 4.5],
        [25.2, 5.0],
        [0.3, z],
        [0, z],
      ];
    sweep(
      o,
      'concrete',
      a,
      b,
      d === 0
        ? [
            [0, -6],
            [31.0, 4.5],
            [0, z],
          ]
        : pr,
    );
  }
}
function radial(o, s, x, z, y, r0, r1, h, n, col = C[s]) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      A = [x + Math.cos(a) * r0, y, z + Math.sin(a) * r0],
      B = [x + Math.cos(b) * r0, y, z + Math.sin(b) * r0],
      D = [x + Math.cos(a) * r1, y + h, z + Math.sin(a) * r1],
      E = [x + Math.cos(b) * r1, y + h, z + Math.sin(b) * r1];
    Q(o, s, [A, B, E, D], [Math.cos(a), 0, Math.sin(a)], col);
    T(o, s, [[x, y + h, z], D, E], [0, 1, 0], col);
    T(o, s, [[x, y, z], B, A], [0, -1, 0], col);
  }
}
function projection(q) {
  let best = { distance: Infinity };
  for (let i = 0; i < p.crest.length - 1; i++) {
    const a = p.crest[i],
      b = p.crest[i + 1],
      v = b.position.map((x, k) => x - a.position[k]),
      l = v[0] * v[0] + v[1] * v[1],
      t = Math.max(0, Math.min(1, q.reduce((s, x, k) => s + (x - a.position[k]) * v[k], 0) / l)),
      c = mix(a.position, b.position, t),
      dist = Math.hypot(q[0] - c[0], q[1] - c[1]);
    if (dist < best.distance)
      best = { distance: dist, station: a.station + t * (b.station - a.station) };
  }
  return best.station;
}
const units = p.generators
    .map((g) => ({ ...g, station: projection(g.position) }))
    .sort((a, b) => a.station - b.station),
  powerStart = A.spillwayLength,
  powerEnd = p.sectionMarks[3],
  front = (s) => {
    const { c, n } = bagnellCrest(s),
      a = p.outline[10],
      b = p.outline[11],
      t = (c[0] - a[0]) / (b[0] - a[0]),
      q = mix(a, b, t);
    return (q[0] - c[0]) * n[0] + (q[1] - c[1]) * n[1];
  };
function tailrace(o, d) {
  const bounds = [
      powerStart,
      ...units.slice(0, -1).map((u, i) => (u.station + units[i + 1].station) / 2),
      powerEnd,
    ],
    holes = [];
  for (let i = 0; i < units.length; i++) {
    const a = bounds[i],
      b = bounds[i + 1],
      count = d === 0 ? 1 : 2;
    for (let k = 0; k < count; k++) {
      const c = a + ((b - a) * (k + 0.5)) / count,
        w = (b - a) / count - 1.2,
        steps = [2, 3, 7, 14][d],
        r = [
          [c - w / 2, 0.38],
          [c + w / 2, 0.38],
          [c + w / 2, 3.3],
        ];
      for (let j = 1; j <= steps; j++) {
        const t = (j * Math.PI) / steps;
        r.push([c + (Math.cos(t) * w) / 2, 3.3 + Math.sin(t) * 2.0]);
      }
      holes.push(r);
    }
  }
  const outer = [
      [powerStart, 0.35],
      [powerEnd, 0.35],
      [powerEnd, A.powerhouseRoof],
      [powerStart, A.powerhouseRoof],
    ],
    coords = outer.flat(),
    starts = [];
  for (const h of holes) {
    starts.push(coords.length / 2);
    coords.push(...h.flat());
  }
  const ix = earcut(coords, starts),
    F = (s, y, dep = 0) => P(s, y, front(s) - dep);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'concrete',
      ix.slice(i, i + 3).map((k) => F(coords[k * 2], coords[k * 2 + 1])),
      [0, 0, 1],
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      Q(o, 'concrete', [F(...a), F(...b), F(...b, 5), F(...a, 5)], undefined);
    }
    const idx = earcut(h.flat());
    for (let i = 0; i < idx.length; i += 3)
      T(
        o,
        'glass',
        idx.slice(i, i + 3).map((k) => F(...h[k], 5)),
        [0, 0, 1],
        rgb('263431'),
      );
  }
  const rr = [
    ...p.outline.slice(10, 13),
    mix(
      p.outline[13],
      p.outline[12],
      (p.outline[10][0] - p.outline[13][0]) / (p.outline[12][0] - p.outline[13][0]),
    ),
  ];
  solid(o, 'concrete', rr, A.powerhouseRoof, 0.32);
  for (const s of [powerStart, powerEnd]) {
    const z = front(s);
    sweep(o, 'concrete', s - 0.14, s + 0.14, [
      [0.35, -13],
      [A.powerhouseRoof, -13],
      [A.powerhouseRoof, z],
      [0.35, z],
    ]);
  }
  return holes;
}
function powerhouse(o, d) {
  const rr = marks(powerStart, powerEnd, d === 0 ? 80 : d === 1 ? 45 : 16);
  for (let i = 0; i < rr.length - 1; i++) {
    sweep(o, 'concrete', rr[i], rr[i + 1], [
      [0, -13],
      [30.7, -13],
      [30.7, 3.6],
      [A.powerhouseRoof, 3.6],
      [0, 3.6],
    ]);
    sweep(o, 'concrete', rr[i], rr[i + 1], [
      [A.powerhouseRoof, 3.6],
      [28.1, 3.6],
      [28.1, 9.6],
      [A.powerhouseRoof, 9.6],
    ]);
  }
  tailrace(o, d);
  for (const g of units) {
    const [x, z] = g.position;
    radial(o, 'concrete', x, z, 12.12, 3.9, 3.65, 0.7, [3, 6, 12, 24][d]);
    if (d > 0) radial(o, 'paint', x, z, 12.82, 1.2, 1.0, 0.4, [4, 6, 10, 16][d]);
    if (d > 1) {
      radial(o, 'metal', x, z, 12.13, 4.05, 4.05, 0.12, d === 3 ? 24 : 12);
      box(o, 'metal', x, 13.15, z, 0.6, 0.4, 0.6);
      for (const side of [-1, 1]) {
        const st = g.station + side * 3.4;
        Q(
          o,
          'glass',
          [P(st - 1, 15, 9.62), P(st + 1, 15, 9.62), P(st + 1, 24.8, 9.62), P(st - 1, 24.8, 9.62)],
          [0, 0, 1],
        );
        if (d === 3) {
          for (const y of [17.5, 20, 22.5])
            rod(o, 'concrete', P(st - 1, y, 9.7), P(st + 1, y, 9.7), 0.12);
          for (const off of [-1.1, 1.1])
            rod(o, 'concrete', P(st + off, 14.8, 9.7), P(st + off, 25, 9.7), 0.16);
        }
      }
    } else {
      Q(
        o,
        'glass',
        [
          P(g.station - 2.4, 15, 9.62),
          P(g.station + 2.4, 15, 9.62),
          P(g.station + 2.4, 24.8, 9.62),
          P(g.station - 2.4, 24.8, 9.62),
        ],
        [0, 0, 1],
      );
    }
    if (d > 0) {
      const st = g.station;
      Q(
        o,
        'brick',
        [
          P(st - 4, 13, 9.64),
          P(st - 2.9, 13, 9.64),
          P(st - 2.9, 26.1, 9.64),
          P(st - 4, 26.1, 9.64),
        ],
        [0, 0, 1],
      );
    }
  }
  for (const s of [powerStart + 26, powerEnd - 30]) {
    const { c, u, n } = bagnellCrest(s),
      B = (x, y, z) => [c[0] + u[0] * x + n[0] * z, y, c[1] + u[1] * x + n[1] * z];
    if (d === 0) {
      box(o, 'concrete', ...B(0, 32, -8), 6.5, 2.7, 2.8, u);
      continue;
    }
    for (const x of [-2.8, 2.8])
      for (const z of [-10, -6]) rod(o, 'metal', B(x, 29.8, z), B(x, 36, z), 0.28);
    box(o, 'concrete', ...B(0, 35.7, -8), 6.7, 1.2, 4.4, u);
    box(o, 'paint', ...B(-1, 33, -8), 2.2, 2.4, 2.1, u);
    Q(
      o,
      'glass',
      [B(-2.08, 33.6, -6.92), B(0.08, 33.6, -6.92), B(0.08, 34.8, -6.92), B(-2.08, 34.8, -6.92)],
      [n[0], 0, n[1]],
    );
    if (d > 1) {
      rod(o, 'metal', B(-1.1, 33, -8), B(-1.1, 31, -8), 0.07);
      for (const z of [-10.2, -5.8]) rod(o, 'metal', B(-3.3, 36.9, z), B(3.3, 36.9, z), 0.08);
    }
  }
}
function road(o, d) {
  const rr = p.crest.map((v) => v.station);
  for (let i = 0; i < rr.length - 1; i++) {
    const a = rr[i],
      b = rr[i + 1];
    Q(
      o,
      'road',
      [P(a, 31.25, -3.4), P(b, 31.25, -3.4), P(b, 31.25, 3.4), P(a, 31.25, 3.4)],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      Q(
        o,
        'concrete',
        [
          P(a, 31.43, side * 3.4),
          P(b, 31.43, side * 3.4),
          P(b, 31.43, side * 4.6),
          P(a, 31.43, side * 4.6),
        ],
        [0, 1, 0],
      );
      if (d === 0)
        Q(
          o,
          'concrete',
          [
            P(a, 31.4, side * 4.6),
            P(b, 31.4, side * 4.6),
            P(b, 32.2, side * 4.6),
            P(a, 32.2, side * 4.6),
          ],
          [0, 0, side],
        );
      else
        sweep(o, 'concrete', a, b, [
          [30.9, side * 4.6],
          [31.8, side * 4.6],
          [31.8, side * 4.4],
          [30.9, side * 4.4],
        ]);
    }
  }
  if (d > 0) {
    const span = p.sectionMarks[4] - p.sectionMarks[0],
      N = Math.ceil(span / [100, 40, 8, 4][d]);
    for (let i = 0; i <= N; i++) {
      const s = p.sectionMarks[0] + (span * i) / N;
      for (const side of [-1, 1])
        rod(o, 'metal', P(s, 31.72, side * 4.5), P(s, 32.65, side * 4.5), d === 1 ? 0.1 : 0.075);
    }
    for (let i = 0; i < N; i++) {
      const a = p.sectionMarks[0] + (span * i) / N,
        b = p.sectionMarks[0] + (span * (i + 1)) / N;
      for (const side of [-1, 1])
        for (const y of d === 1 ? [32.6] : [32.15, 32.6])
          rod(o, 'metal', P(a, y, side * 4.5), P(b, y, side * 4.5), 0.045);
    }
  }
  if (d > 1)
    for (let s = p.sectionMarks[0] + 1; s < p.sectionMarks[4] - 4; s += 8)
      for (const z of [-0.12, 0.12])
        Q(
          o,
          'road',
          [
            P(s, 31.26, z - 0.04),
            P(s + 4, 31.26, z - 0.04),
            P(s + 4, 31.26, z + 0.04),
            P(s, 31.26, z + 0.04),
          ],
          [0, 1, 0],
          rgb('d1cfae'),
        );
}
function build(o, _f, d = 3) {
  if (d === 0) {
    cap(o, 'concrete', p.outline, 0.3);
    cap(o, 'concrete', p.westExtension, 26.6);
    cap(o, 'concrete', p.eastExtension, 26.6);
  } else {
    solid(o, 'concrete', p.outline, -0.5, 0.8);
    solid(o, 'concrete', p.westExtension, 26.3, 0.3);
    solid(o, 'concrete', p.eastExtension, 26.3, 0.3);
  }
  retaining(o, d);
  retaining(o, d, true);
  spillway(o, d);
  powerhouse(o, d);
  road(o, d);
}
export const bagnellDamSkyline = (o, f) => build(o, f, 0),
  bagnellDamDistrict = (o, f) => build(o, f, 1),
  bagnellDamStreet = (o, f) => build(o, f, 2),
  bagnellDamCloseup = (o, f) => build(o, f, 3);
export const bagnellDamModel = {
  id: 'bagnell_dam',
  key: 'bagnell_dam',
  cell: '9y/9yy',
  recipe: 'structure-bagnell-dam.mjs',
  title: 'Bagnell Dam',
  category: 'infrastructure',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-475, 420, 700],
  lookAt: [8, 17, -13],
  portableGroundY: -0.66,
  mediumFiContext: {
    scale: 8,
    groundY: -0.66,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'whole-four-section-dam-full-crest-and-integral-powerhouse',
      position: [-475, 420, 700],
      lookAt: [8, 17, -13],
      reviewLod: 'skyline',
    },
    {
      name: 'twelve-closed-radialgates-ribbed-chutes-and-road-viaduct',
      position: [69, 72, 118],
      lookAt: [80, 16, 5],
    },
    {
      name: 'eight-native-turbine-bays-open-tailraces-and-intake-gallery',
      position: [220, 51, 116],
      lookAt: [231, 14, 4],
    },
    {
      name: 'west-retaining-face-with-post2018-infilled-upper-piers',
      position: [-177, 74, 144],
      lookAt: [-171, 23, 11],
    },
    {
      name: 'curved-east-retaining-crest-road-and-two-service-gantries',
      position: [365, 77, -135],
      lookAt: [324, 28, -13],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundCutout: {
    outline: p.outline,
    additionalOutlines: [p.westExtension, p.eastExtension],
    basis:
      'Duplicate composite DEM is hidden only under the native17vertex physical concrete dam/powerhouse footprint and two narrow actual retaining-crest extensions. Their authored concrete foundations/mass cover these cuts. No river, reservoir, valley, adjacentbanks or officeyard is removed; source16641heights remain unchanged.',
  },
  groundContactBasis:
    p.geometryBasis +
    ' Independent1024mfield frozen before geometry; downstream provider-relative toe is architectural zero, not surveyed riverbed/bedrock. Actual host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bagnell-dam.mjs',
    level: 'skyline',
    export: 'bagnellDamSkyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'bagnellDamDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'bagnellDamStreet', errorMeters: 0.22, surfaces },
      closeup: { export: 'bagnellDamCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Fullfour-section775.106mcrest/12closedradialgates/eightnativegeneratorbaycrowns andintegralpowerhouse represented. Tailraceoutlets use16deepphysicalarchedrecesses(two perunit) atdetailedlevels/eightmergedrecessesatskyline, simplifieddarkengine-roomclosures; actualhiddenoutletinternalcensus approximate. Publishedwhole2011ownCC0aerial suppliesarchitecture; primaryowner2018text supplies newretainingupperinfills/overlay. Gatesclosed/nonoperable; no hydrologic simulation or plantinterior.',
    'FERC148ft/45.1104m maximum is abovebedrock, not45mabovevisible tailwater. Exteriorcrest31.2m/normalpoolabout28m/0mtoe/powerhouseroof11.8m/retainingbanktoe27m/uppergallery28m/gantry36.9m are architecturalestimates independent of frozenDEM. Buriedfoundation/riverbed notinvented as measured. Upperinfills are solidconcrete basedonownertext; exactpost2018surfacejointlocations/crownhardware/windows/railcensus/roofmachinery approximate.',
    'One exactpublishedKTrimble2011ownCC0wholeaerial individuallyinspected/nativeSHA1bound, originalnamedfirst-person selfrelease preserved; unchangedpublishedpolicy passes. No supplementalphoto needed; uncertain/attribution/historicNARAphoto pixels notused. FERC/ownerprotectedPDFimages/plans notviewed/adopted; textfacts only. No media/body/category/imagerypolicy edits, photo textures/downloaded mesh/generated bitmap.',
    'Independent1024m129square8m16641samplefield/fourrawTerrariumtiles frozenbeforegeometry; sourcegrid/PNG/tiles unchanged, providerdownstreamdatum172.378m not actualchart/survey. Sourcegroundcuts onlyunderphysicalnativeconcrete/retainingextensions, sourcevaluesneverflattened/fitted/reacquired. Portableflatstage is for isolatedgeometry; contextretainsindependentDEM. Ordinarygeographicpreview/replacementdisabled; actualhost/footing contact unverified.',
    'Independentoffice/switchyard/transmissiontowers/WillmoreLodge/town/banks/river/lake/water/vehicles/boats/people/interiorhydraulicmachinery excluded. Twoauxiliary internalunits inFERCtext do not become tenmainrooftopgeneratorbays.',
  ],
};
