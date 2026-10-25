/** Arlington Memorial Amphitheater: open elliptical arcade, seating bowl and reception hall. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dq/dqc/arlington_memorial_amphitheater/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  marble: rgb('dddcd2'),
  trim: rgb('ebe8dc'),
  floor: rgb('bdb8a3'),
  roof: rgb('697978'),
  glass: rgb('8aafac'),
  dark: rgb('65716c'),
};
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.9, metallic: 0 },
  floor: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.14 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.35, metallic: 0.08 },
  dark: { slot: 'trim', localRef: ref, roughness: 0.94, metallic: 0 },
};
function tri(o, s, ps, n, col = C[s]) {
  const p = ps.map((p) => p.map(Math.fround)),
    cr = cross(
      p[1].map((v, i) => v - p[0][i]),
      p[2].map((v, i) => v - p[0][i]),
    );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
const area = (r) =>
    r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  cw = (r) => (area(r) < 0 ? r : [...r].reverse()),
  ccw = (r) => (area(r) > 0 ? r : [...r].reverse()),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, outer, holes, f, depth = 0) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => f.P(...pts[k], depth)),
      f.n,
    );
}
function strip(o, s, f, x, y, w, h, depth = 0.02) {
  panel(o, s, rect(x, y, w, h), [], f, depth);
}
function block(o, s, f, x, y, w, h, front, back = 0) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      p = [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)];
    Q(o, s, p, normalFor(...p));
  }
}
function cap(o, s, rings, y, up = true) {
  const pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ix = earcut(pts.flat(), holes);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [pts[k][0], y, pts[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function sides(o, s, rings, low, high) {
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]);
      strip(o, s, f, f.len / 2, low, f.len, high - low, 0);
    }
}
function prism(o, s, r, lo, hi) {
  r = cw(r);
  sides(o, s, [r], lo, hi);
  cap(o, s, [r], hi);
  cap(o, s, [r], lo, false);
}
function perforated(o, s, rings, lo, hi) {
  sides(o, s, rings, lo, hi);
  cap(o, s, rings, hi);
  cap(o, s, rings, lo, false);
}
const arch = (x, bottom, w, spring, rise, n) => [
  [x - w / 2, bottom],
  [x + w / 2, bottom],
  ...Array.from({ length: n + 1 }, (_, i) => [
    x + (w / 2) * Math.cos((i / n) * Math.PI),
    spring + rise * Math.sin((i / n) * Math.PI),
  ]),
];
function reveal(o, s, f, r, depth) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      p = [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)];
    Q(o, s, p, normalFor(...p));
  }
}
function light(o, f, h, d) {
  const r = rect(h.x, h.y, h.w, h.h);
  panel(o, 'glass', r, [], f, d === 0 ? 0.015 : -0.22);
  if (!d) return;
  reveal(o, 'trim', f, r, 0.22);
  if (d > 1) {
    for (const sg of [-1, 1])
      strip(o, 'trim', f, h.x + sg * (h.w / 2 + 0.06), h.y - 0.08, 0.13, h.h + 0.16, 0.06);
    block(o, 'trim', f, h.x, h.y + h.h, h.w + 0.3, 0.2, 0.12, 0);
    block(o, 'trim', f, h.x, h.y - 0.15, h.w + 0.34, 0.16, 0.18, 0);
    strip(o, 'trim', f, h.x, h.y + h.h * 0.53, h.w, 0.075, -0.15);
    strip(o, 'trim', f, h.x, h.y, 0.065, h.h, -0.15);
  }
}
function column(o, p, bottom, top, r, d) {
  const n = [4, 6, 8, 16][d],
    layers =
      d < 2
        ? [
            [bottom, r],
            [top, r * 0.87],
          ]
        : d === 2
          ? [
              [bottom, r * 1.15],
              [bottom + 0.24, r],
              [top - 0.32, r * 0.83],
              [top, r * 1.17],
            ]
          : [
              [bottom, r * 1.2],
              [bottom + 0.18, r * 1.2],
              [bottom + 0.3, r],
              [top - 0.43, r * 0.83],
              [top - 0.28, r * 1.12],
              [top - 0.1, r * 1.2],
              [top, r * 1.2],
            ],
    rings = layers.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i / n) * Math.PI * 2,
          flute = d === 3 && i % 2 === 0 ? 0.94 : 1;
        return [p[0] + Math.cos(a) * r * flute, y, p[2] + Math.sin(a) * r * flute];
      }),
    );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        q = [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        normal = [(q[0][0] + q[1][0]) / 2 - p[0], 0, (q[0][2] + q[1][2]) / 2 - p[2]];
      Q(o, 'marble', q, normal);
    }
  for (const [ring, up] of [
    [rings[0], false],
    [rings.at(-1), true],
  ])
    for (let i = 1; i < ring.length - 1; i++)
      tri(o, 'marble', [ring[0], ring[i], ring[i + 1]], [0, up ? 1 : -1, 0]);
}
function rail(o, a, b, y, d) {
  const f = frame(a, b);
  for (const h of [0, 1.0]) {
    if (d < 2) strip(o, 'trim', f, f.len / 2, y + h, f.len, 0.12, 0);
    else beam(o, 'trim', f.P(0, y + h), f.P(f.len, y + h), 0.16, 0.16, C.trim);
  }
  if (d < 2) return;
  const n = Math.max(1, Math.floor(f.len / (d === 3 ? 0.65 : 2.2)));
  for (let i = 0; i <= n; i++) {
    const x = (f.len * i) / n;
    beam(
      o,
      'trim',
      f.P(x, y),
      f.P(x, y + 1),
      d === 3 ? 0.095 : 0.075,
      d === 3 ? 0.095 : 0.075,
      C.trim,
    );
  }
}
function resample(r, n) {
  const lens = r.map((p, i) =>
      Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]),
    ),
    total = lens.reduce((a, b) => a + b, 0),
    out = [];
  for (let j = 0; j < n; j++) {
    let d = (j / n) * total,
      i = 0;
    while (d > lens[i] && i < r.length - 1) d -= lens[i++];
    const t = d / lens[i],
      a = r[i],
      b = r[(i + 1) % r.length];
    out.push(a.map((v, k) => v + (b[k] - v) * t));
  }
  return out;
}
const nativeOuter = plan.outline,
  nativeArena = plan.openArena,
  outer = cw(nativeOuter),
  arena = ccw(nativeArena),
  walk = cw(nativeOuter.filter((_, i) => i < 27 || i > 34)),
  curve = cw(
    nativeOuter.filter(
      (_, i) => ![6, 7, 17, 18, 27, 28, 29, 30, 31, 32, 33, 34, 43, 44].includes(i),
    ),
  ),
  hallNative = cw(nativeOuter.slice(26, 36)),
  frontZ = plan.frontReference.endpoints[0][1];
function majorRoofArc(r) {
  const inside = (p) => p[1] > 17.5 && Math.abs(p[0]) < 14.8;
  r = r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      mid = a.map((v, k) => (v + b[k]) / 2);
    return !inside(a) && !inside(b) && inside(mid) ? [a, mid] : [a];
  });
  const edge = (a, b) => {
    const x = Math.sign(inside(a) ? b[0] : a[0]) * 14.8;
    const t = (x - a[0]) / (b[0] - a[0]);
    return [x, a[1] + t * (b[1] - a[1])];
  };
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (!inside(a) || inside(b)) continue;
    const out = [edge(a, b)];
    for (let k = 1; k <= r.length; k++) {
      const p = r[(i + k) % r.length],
        q = r[(i + k + 1) % r.length];
      out.push(p);
      if (inside(q)) {
        out.push(edge(p, q));
        return out;
      }
    }
  }
  throw Error('Native stage opening could not be located in roof ring');
}
const outerRoofArc = majorRoofArc(walk),
  innerRoofArc = majorRoofArc(arena);
if (Math.abs(outerRoofArc.at(-1)[0] - innerRoofArc[0][0]) > 1) innerRoofArc.reverse();
const roofC = cw([...outerRoofArc, ...innerRoofArc]);
function foundations(o, d) {
  perforated(o, 'marble', [outer, arena], -0.3, 2.5);
  cap(o, 'floor', [arena], 1.4);
  if (d > 1)
    for (const r of [outer, arena])
      for (let i = 0; i < r.length; i++) {
        const f = frame(r[i], r[(i + 1) % r.length]);
        for (const y of d === 3 ? [0.12, 0.58, 1.28, 2.2] : [0.58, 2.2])
          strip(o, 'trim', f, f.len / 2, y, f.len, 0.07, 0.025);
      }
}
function arcades(o, d) {
  const bays = resample(curve, 56);
  for (let i = 0; i < bays.length; i++) {
    const f = frame(bays[i], bays[(i + 1) % bays.length]),
      mid = f.P(f.len / 2, 0);
    if (mid[2] > 24 && Math.abs(mid[0]) < 17) continue;
    if (d === 1) {
      block(o, 'marble', f, 0, 2.5, 1.0, 8.8, 0.34, -0.34);
      continue;
    }
    const width = Math.max(0.7, f.len - 1.18),
      r = arch(f.len / 2, 2.5, width, 9.0, width / 2, d === 2 ? 6 : 12),
      face = rect(f.len / 2, 2.3, f.len, 9.0);
    panel(o, 'marble', face, [r], f);
    panel(o, 'marble', face, [r], { ...f, n: f.n.map((v) => -v) }, -0.65);
    reveal(o, 'marble', f, r, 0.65);
    column(o, f.P(0, 0, 0.25), 2.5, 11.25, 0.51, d === 2 ? 1 : d);
    if (d === 3) {
      block(o, 'trim', f, f.len / 2, 10.9, f.len, 0.18, 0.11, -0.03);
      block(o, 'trim', f, 0, 2.5, 1.18, 0.25, 0.19, -0.02);
    }
  }
  const inner = resample(cw(nativeArena), 56);
  for (const p of inner) {
    if (p[1] > 17.5 && Math.abs(p[0]) < 15) continue;
    const len = Math.hypot(p[0], p[1]),
      q = [p[0] + (p[0] / len) * 0.62, 0, p[1] + (p[1] / len) * 0.62];
    column(o, q, 2.5, 11.3, 0.56, d);
  }
  perforated(o, 'marble', [roofC], 11.3, 12.5);
  for (const r of [roofC])
    for (let i = 0; i < r.length; i++) {
      const f = frame(r[i], r[(i + 1) % r.length]);
      if (d === 3) block(o, 'trim', f, f.len / 2, 12.27, f.len, 0.23, 0.14, -0.01);
      else strip(o, 'trim', f, f.len / 2, 12.25, f.len, 0.2, 0.04);
    }
  const r = d === 3 ? nativeArena : resample(cw(nativeArena), 32);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if ((a[1] + b[1]) / 2 > 17.5 && Math.abs((a[0] + b[0]) / 2) < 15) continue;
    rail(o, a, b, 2.6, d);
  }
}
function steps(o, f, width, n, top, run) {
  for (let i = 0; i < n; i++) {
    const near = (run * (n - i - 1)) / n,
      far = (run * (n - i)) / n,
      hi = (top * (i + 1)) / n,
      lo = -0.05,
      r = [
        f.P(-width / 2, 0, near),
        f.P(width / 2, 0, near),
        f.P(width / 2, 0, far),
        f.P(-width / 2, 0, far),
      ].map((p) => [p[0], p[2]]);
    prism(o, 'marble', r, lo, hi);
  }
}
function porticos(o, d) {
  const configs = [
    { a: [-8.9, -36.13], b: [8.3, -36.11], back: -27.2 },
    { a: [37.61, 5.25], b: [37.64, -2.87], back: 35.45 },
    { a: [-40.9, -3.41], b: [-40.92, 4.71], back: -37.5 },
  ];
  for (let k = 0; k < 3; k++) {
    const p = configs[k],
      f = k === 0 ? frame(p.b, p.a) : frame(p.a, p.b),
      n = k === 0 ? 6 : 4;
    for (let j = 0; j < n; j++)
      column(o, f.P((f.len * (j + 0.5)) / n, 0), 2.5, 11.3, k === 0 ? 0.6 : 0.48, d === 1 ? 0 : d);
    if (d > 1) block(o, 'trim', f, f.len / 2, 11.1, f.len + 0.4, 1.25, 0.4, -1.0);
    const center = f.P(f.len / 2, 0);
    steps(
      o,
      { ...f, P: (x, y, z = 0) => f.P(x + f.len / 2, y, z) },
      f.len + 1.2,
      d === 1 ? 3 : 8,
      2.5,
      3.2,
    );
    if (d > 1)
      for (const side of [-1, 1]) {
        const a = f.P(f.len / 2 + side * (f.len / 2 + 0.4), 0.2, 3.2),
          b = f.P(f.len / 2 + side * (f.len / 2 + 0.4), 2.5, 0);
        beam(
          o,
          'dark',
          a.map((v, i) => v + (i === 1 ? 0.9 : 0)),
          b.map((v, i) => v + (i === 1 ? 0.9 : 0)),
          0.055,
          0.055,
          C.dark,
        );
      }
    if (k === 0 && d > 1)
      for (const side of [-1, 1])
        box(
          o,
          'marble',
          [center[0] + side * 7 - 0.4, 12.5, center[2] - 1.2],
          [center[0] + side * 7 + 0.4, 13.1, center[2] + 0.5],
          C.marble,
        );
  }
}
function curvedBand(o, rx, rz, width, y, h, start, end, n) {
  const r = [];
  for (let i = 0; i <= n; i++) {
    const a = start + ((end - start) * i) / n;
    r.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  for (let i = n; i >= 0; i--) {
    const a = start + ((end - start) * i) / n;
    r.push([Math.cos(a) * (rx - width), Math.sin(a) * (rz - width)]);
  }
  prism(o, 'trim', r, y, y + h);
}
function benches(o, d) {
  const rows = d === 1 ? 4 : d === 2 ? 14 : 24;
  for (let j = 0; j < rows; j++) {
    const z = -12.4 + (j / Math.max(1, rows - 1)) * 23.4,
      width = Math.sqrt(Math.max(0, 1 - Math.pow(z / 23.4, 2))) * 27 - 5.4;
    if (z > 8) continue;
    for (const side of [-1, 1]) {
      const x0 = side > 0 ? 1.1 : -width,
        x1 = side > 0 ? width : -1.1;
      box(o, 'trim', [x0, 1.65, z], [x1, 1.88, z + 0.25], C.trim);
      if (d === 3)
        for (let x = x0 + 0.6; x < x1; x += 3.4)
          box(o, 'marble', [x, 1.4, z + 0.06], [x + 0.11, 1.65, z + 0.18], C.marble);
    }
  }
  const nr = d === 1 ? 2 : d === 2 ? 5 : 8,
    n = d === 1 ? 3 : d === 2 ? 7 : 20;
  for (let j = 0; j < nr; j++) {
    const rx = 27.9 - j * 0.68,
      rz = 21.0 - j * 0.68,
      y = 2.38 - j * 0.1;
    for (const [start, end] of [
      [0.18, 0.72],
      [2.42, 2.96],
      [3.3, 3.95],
      [5.48, 6.1],
    ])
      curvedBand(o, rx, rz, 0.24, y, 0.22, start, end, n);
  }
}
function stage(o, d) {
  const semi = (rx, rz, z) => [
      [-rx, z],
      [rx, z],
      ...Array.from({ length: (d === 1 ? 10 : 24) + 1 }, (_, i) => {
        const a = (i / (d === 1 ? 10 : 24)) * Math.PI;
        return [rx * Math.cos(a), z - rz * Math.sin(a)];
      }),
    ],
    low = semi(14.4, 10.7, 26.4),
    high = semi(12.8, 9.3, 26.4);
  prism(o, 'marble', low, 1.4, 3.05);
  prism(o, 'trim', high, 3.05, 3.6);
  const f = frame([14.3, 27.5], [-14.3, 27.5]),
    r = arch(f.len / 2, 3.6, 13.6, 8.15, 6.8, d === 1 ? 6 : d === 2 ? 12 : 20);
  panel(o, 'marble', rect(f.len / 2, 3.3, f.len, 13.0), [r], f);
  reveal(o, 'marble', f, r, 2.3);
  panel(o, 'marble', rect(f.len / 2, 3.3, f.len, 13.0), [], { ...f, n: f.n.map((v) => -v) }, -2.3);
  if (d > 1) {
    const outer = arch(f.len / 2, 3.6, 14.25, 8.15, 7.125, d === 2 ? 12 : 20);
    for (let i = 1; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        o,
        'trim',
        [f.P(...r[i], 0.13), f.P(...r[j], 0.13), f.P(...outer[j], 0.13), f.P(...outer[i], 0.13)],
        f.n,
      );
    }
    for (const x of [1.7, f.len - 1.7]) block(o, 'trim', f, x, 3.6, 1.0, 11.2, 0.18, -0.02);
    block(o, 'trim', f, f.len / 2, 15.75, f.len + 0.5, 0.55, 0.23, 0);
  }
  const door = rect(f.len / 2, 3.6, 2.3, 3.8);
  panel(o, 'glass', door, [], f, -2.275);
  if (d > 1)
    for (const side of [-1, 1])
      block(o, 'trim', f, f.len / 2 + side * 1.23, 3.6, 0.15, 4.0, -2.18, -2.3);
  for (const side of [-1, 1]) {
    const rf = frame([side * 14.2, 25.0], [side * 14.2, 18.0]);
    rail(
      o,
      rf.P(0, 0).filter((_, i) => i !== 1),
      rf.P(7, 0).filter((_, i) => i !== 1),
      3.1,
      d,
    );
  }
}
const hallBody = cw([
  ...nativeOuter.slice(26, 30),
  [10.5, frontZ],
  [10.5, frontZ - 3.55],
  [-10.5, frontZ - 3.55],
  [-10.5, frontZ],
  ...nativeOuter.slice(31, 36),
]);
function hallWalls(o, d) {
  for (let i = 0; i < hallBody.length; i++) {
    const a = hallBody[i],
      b = hallBody[(i + 1) % hallBody.length],
      f = frame(a, b),
      back = f.n[2] < -0.8 && f.len > 20,
      front = f.n[2] > 0.8,
      hs = [];
    if (f.len > 4 && !back) {
      const count = f.len > 20 ? 3 : Math.max(1, Math.floor(f.len / 6.8));
      for (let j = 0; j < count; j++) {
        const x = (f.len * (j + 0.5)) / count;
        hs.push({
          x,
          y: front && f.len > 18 && Math.abs(f.P(x, 0)[0]) < 5 ? 2.5 : 4.1,
          w: front && f.len > 18 ? 2.2 : 1.65,
          h: front && f.len > 18 ? 6.1 : 5.4,
        });
      }
    }
    panel(
      o,
      'marble',
      rect(f.len / 2, 2.5, f.len, 13.3),
      d ? hs.map((h) => rect(h.x, h.y, h.w, h.h)) : [],
      f,
    );
    for (const h of hs) light(o, f, h, d);
    if (d > 1) {
      block(o, 'trim', f, f.len / 2, 13.8, f.len, 0.24, 0.14, -0.03);
      block(o, 'trim', f, f.len / 2, 15.3, f.len, 0.5, 0.3, -0.02);
      for (const y of [3.1, 10.5, 12.8]) strip(o, 'trim', f, f.len / 2, y, f.len, 0.1, 0.025);
    }
  }
  cap(o, 'marble', [hallNative], 15.8);
}
function gabled(o, x0, x1, z0, z1, base, rise) {
  const mid = (x0 + x1) / 2;
  Q(
    o,
    'roof',
    [
      [x0, base, z0],
      [mid, base + rise, z0],
      [mid, base + rise, z1],
      [x0, base, z1],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [mid, base + rise, z0],
      [x1, base, z0],
      [x1, base, z1],
      [mid, base + rise, z1],
    ],
    [0, 1, 0],
  );
  for (const [z, n] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ])
    tri(
      o,
      'marble',
      [
        [x0, base, z],
        [x1, base, z],
        [mid, base + rise, z],
      ],
      n,
    );
}
function pyramid(o, c, w, dep, y, rise, d) {
  const r = [
      [c[0] - w / 2, y, c[1] - dep / 2],
      [c[0] + w / 2, y, c[1] - dep / 2],
      [c[0] + w / 2, y, c[1] + dep / 2],
      [c[0] - w / 2, y, c[1] + dep / 2],
    ],
    tip = [c[0], y + rise, c[1]];
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    tri(o, 'glass', [r[i], r[k], tip], [0, 1, 0]);
    if (d > 1) {
      beam(o, 'trim', r[i], r[k], 0.1, 0.1, C.trim);
      beam(o, 'trim', r[i], tip, 0.1, 0.1, C.trim);
      if (d === 3)
        for (const t of [0.33, 0.66]) {
          const a = r[i].map((v, k) => v + (tip[k] - v) * t),
            b = r[k].map((v, k) => v + (tip[k] - v) * t);
          beam(o, 'trim', a, b, 0.055, 0.055, C.trim);
        }
    }
  }
}
function hallRoof(o, d) {
  gabled(o, -10.5, 10.5, 29.85, frontZ, 15.8, 2.4);
  gabled(o, -14.8, 15.0, 29.8, 37.0, 15.8, 1.75);
  for (const side of [-1, 1]) {
    const x = side * 16.1,
      r = [
        [x - 4.5, 38.3],
        [x + 4.5, 38.3],
        [x + 4.5, frontZ - 0.6],
        [x - 4.5, frontZ - 0.6],
      ];
    prism(o, 'roof', r, 15.8, 15.94);
    pyramid(o, [x, 46.4], 6.3, 5.2, 16.03, 1.7, d);
    for (let i = 0; i < r.length; i++) rail(o, r[i], r[(i + 1) % r.length], 15.94, d);
  }
  if (d > 1) {
    for (let z = 31; z < frontZ; z += 1.2)
      for (const side of [-1, 1])
        if (d === 3) beam(o, 'roof', [0, 18.21, z], [side * 10.5, 15.83, z], 0.045, 0.045, C.roof);
        else
          Q(
            o,
            'roof',
            [
              [0, 18.21, z - 0.0225],
              [0, 18.21, z + 0.0225],
              [side * 10.5, 15.83, z + 0.0225],
              [side * 10.5, 15.83, z - 0.0225],
            ],
            [0, 1, 0],
          );
    for (const [x, z] of [
      [-3.4, 34],
      [4.0, 36.5],
    ])
      box(o, 'dark', [x - 0.65, 18.2, z - 0.6], [x + 0.65, 18.6, z + 0.6], C.dark);
  }
}
function hallFront(o, d) {
  const f = frame([0, frontZ], [1, frontZ]);
  for (const x of [-9.3, -5.58, -1.86, 1.86, 5.58, 9.3]) column(o, f.P(x, 0), 2.5, 14.05, 0.72, d);
  block(o, 'trim', f, 0, 14.05, 22.5, 1.2, 0.4, -3.55);
  const ped = [
    [-11.45, 15.25],
    [11.45, 15.25],
    [0, 18.6],
  ];
  panel(o, 'marble', ped, [], f, 0.42);
  panel(o, 'marble', ped, [], { ...f, n: [0, 0, -1] }, 0.1);
  for (let i = 0; i < 3; i++) {
    const a = ped[i],
      b = ped[(i + 1) % 3],
      p = [f.P(...a, 0.42), f.P(...b, 0.42), f.P(...b, 0.1), f.P(...a, 0.1)];
    Q(o, 'trim', p, normalFor(...p));
    if (d > 1) beam(o, 'trim', f.P(...a, 0.45), f.P(...b, 0.45), 0.2, 0.2, C.trim);
  }
  steps(o, f, 34, d === 1 ? 5 : 10, 2.5, 3.65);
  for (const side of [-1, 1]) {
    const x0 = side > 0 ? 21.2 : -24.0,
      x1 = side > 0 ? 24.0 : -20.8,
      r = [
        [x0, 37.0],
        [x1, 37.0],
        [x1, frontZ],
        [x0, frontZ],
      ];
    prism(o, 'marble', r, 0.1, 2.5);
    for (let i = 0; i < r.length; i++) rail(o, r[i], r[(i + 1) % r.length], 2.6, d);
  }
}
function skyline(o) {
  const sparse = (r) => r.filter((_, i) => i % 3 === 0),
    out = cw(sparse(nativeOuter)),
    inside = ccw(sparse(nativeArena)),
    w = cw([
      ...outerRoofArc.filter((_, i) => i % 3 === 0 || i === outerRoofArc.length - 1),
      ...innerRoofArc.filter((_, i) => i % 3 === 0 || i === innerRoofArc.length - 1),
    ]);
  perforated(o, 'marble', [out, inside], -0.3, 2.5);
  cap(o, 'floor', [inside], 1.4);
  perforated(o, 'marble', [w], 11.3, 12.5);
  for (const [x0, x1, z0, z1] of [
    [-8.92, 8.3, -36.14, -27.2],
    [35.42, 37.65, -2.89, 5.26],
    [-40.94, -37.37, -3.43, 4.74],
  ]) {
    box(o, 'marble', [x0, 11.3, z0], [x1, 12.5, z1], C.marble);
    box(o, 'marble', [x0, 2.3, z0], [x1, 2.5, z1], C.marble);
    for (const p of [
      [x0 + 0.5, 0, z0 + 0.5],
      [x1 - 0.5, 0, z1 - 0.5],
    ])
      column(o, p, 2.5, 11.3, 0.55, 0);
  }
  for (const r of [curve, cw(nativeArena)])
    for (const p of resample(r, 16)) {
      if (p[1] > 18 && Math.abs(p[0]) < 16) continue;
      column(o, [p[0], 0, p[1]], 2.5, 11.3, 0.6, 0);
    }
  prism(o, 'marble', hallNative, 2.5, 15.8);
  gabled(o, -10.5, 10.5, 29.85, frontZ, 15.8, 2.4);
  for (const side of [-1, 1]) pyramid(o, [side * 16.1, 46.4], 6.3, 5.2, 16.0, 1.7, 0);
  const f = frame([14.3, 27.5], [-14.3, 27.5]);
  for (const x of [2.5, 26.1]) block(o, 'marble', f, x, 3.6, 5, 12.7, 0.12, -2.3);
  const r = arch(14.3, 3.6, 13.6, 8.15, 6.8, 4),
    outer = arch(14.3, 3.6, 16.2, 8.15, 8.1, 4);
  for (let i = 2; i < r.length - 1; i++)
    Q(o, 'marble', [f.P(...r[i]), f.P(...r[i + 1]), f.P(...outer[i + 1]), f.P(...outer[i])], f.n);
  const st = [
    [-14.4, 26.4],
    [14.4, 26.4],
    [10, 18.5],
    [0, 15.7],
    [-10, 18.5],
  ];
  prism(o, 'marble', st, 1.4, 3.6);
  for (const side of [-1, 1])
    for (let j = 0; j < 3; j++)
      box(
        o,
        'trim',
        [side > 0 ? 1.1 : -22, 1.65, -9 + j * 6],
        [side > 0 ? 22 : -1.1, 1.9, -8.6 + j * 6],
        C.trim,
      );
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  foundations(o, d);
  arcades(o, d);
  porticos(o, d);
  benches(o, d);
  stage(o, d);
  hallWalls(o, d);
  hallRoof(o, d);
  hallFront(o, d);
}
export const arlingtonSkyline = (o, f) => build(o, f, 0);
export const arlingtonDistrict = (o, f) => build(o, f, 1);
export const arlingtonStreet = (o, f) => build(o, f, 2);
export const arlingtonModel = {
  id: 'arlington_memorial_amphitheater',
  key: 'arlington_memorial_amphitheater',
  recipe: 'structure-arlington-memorial-amphitheater.mjs',
  cell: 'dq/dqc',
  title: 'Arlington Memorial Amphitheater',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Whole Arlington Memorial Amphitheater and attached ReceptionHall: original47vertexouter/70vertexopenarena controls, elliptical covered outerround-arch/engagedDoric arcade and separateinnerDoric colonnade/openbalustrades, three axisporticos/steps, intrinsic openairbowl with straightcentralbenchblocks/curvedperimeterrows/aisles, raisedsemiovaltwolevelstage/deeprecessedprosceniumarch, T-shaped hall/eastpedimentedprostyle/sidepavilions/balustradedterraces/darkmetalroofs/twoglazedpyramids. No separateTomb/cemeteryforecourt/site mesh.',
  camera: [-95, 73, 128],
  lookAt: [0, 6, 9],
  portableGroundY: -0.35,
  mediumFiContext: { scale: 1.65, groundY: -0.35 },
  qaCameras: [
    {
      name: 'open-elliptical-bowl-inner-colonnade-benches-and-stage',
      position: [-57, 42, -49],
      lookAt: [0, 6, 4],
    },
    {
      name: 'outer-round-arches-engaged-doric-and-west-portico',
      position: [-57, 13, -25],
      lookAt: [-25, 6, -6],
    },
    {
      name: 'recessed-stage-proscenium-from-arena-eye-level',
      position: [0, 3, -8],
      lookAt: [0, 9, 28],
    },
    {
      name: 'east-reception-hall-prostyle-pediment-roofs-and-skylights',
      position: [48, 32, 87],
      lookAt: [0, 10, 43],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Original independent160mfield frozen at fixedsouthfront[-19,61.5]before geometry. Intrinsic arena/stage/terrace/ownstairs levels and hostgroundcontact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-arlington-memorial-amphitheater.mjs',
    level: 'skyline',
    export: 'arlingtonSkyline',
    errorMeters: 3.8,
    surfaces,
    authoredLevels: {
      district: { export: 'arlingtonDistrict', errorMeters: 1.8, surfaces },
      street: { export: 'arlingtonStreet', errorMeters: 0.65, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete surviving Amphitheater/ReceptionHall exterior and intrinsic arena architecture. Original whole47/70vertexnativeperimeter/arenaopening retained in main plinth. Coveredwalkroof follows these controls with a photo-supported east interruption for the tall stage proscenium; no low roof bar crosses its opening. Individual outerarch bays/innercolumns resampled within original curves;56nominalbays with stage interruption, exactcensus/fineprofiles/fluting/benchcounts and all vertical sections are bounded interpretations of three cleared aerials and primarytext, not surveyed replicas. Skyline coarsens original rings/column cadence and seating; district simplifies roundarches to open pier bays; near levels add archvaults/engaged columns/shaft and trim detail.',
    'Real openairarena roofopening with own floor, straightcentralbenchblocks/curvedperimeterrows/aisles; stage has two raisedsemioval levels and genuinelyrecessedprosceniumarch againstclosedhallbackwall/door. Hallincludes eastprostylepediment/sidepavilions, darkmetalhip/gableroofs and twoglazedpyramids/openbalustrades. Hidden hallroofpartitions, sash/roofgear, terrace/stair projections and modern cosmetics remain estimates. No interiorrooms/displays/sculpture/lettering.',
    'Only three exact already-cleared QuallaDuaneLempkeCC0aerial originals2013/2022; primaryCommonsnativeSHA1/source-author/cc-zero records bound. No supplemental images, copied pixels or generatedbitmap. PrimaryHABS2020indexed architecturaltext facts only; document photographs/drawings unused. Shared proceduralmarble/concrete/paintedmetal with mutedglazing only.',
    'SeparateTombofUnknownSoldier/Q3531107atlocal[-1.028,65.352], itsforecourt/graveplatform and all cemeteryroads/plazas/grounds/trees/graves/statues/flagpoles/flags/people excluded. Ownhallfrontsteps endaboutZ60.4, before Tomb. Original160mterrain/rawtile/grid/PNG frozenunchanged at fixedsouthendfront[-19,61.5]; exactfloor/threshold/hostcontactunverified; replaceFootprint=false.',
  ],
};
