/** Hong Kong Stadium: original physical bowl/roof polygons and intrinsic north entrance. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/we/wec/hong_kong_stadium/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    shell: rgb('c6c7bd'),
    roof: rgb('dfdfce'),
    steel: rgb('a5b7b4'),
    seat: rgb('285a53'),
    grass: rgb('668b41'),
    glass: rgb('415b5b'),
  },
  surfaces = {
    shell: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    roof: { slot: 'roof', localRef: 'palette:#fffffe', roughness: 0.94, metallic: 0 },
    steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.18 },
    seat: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.83, metallic: 0 },
    grass: { slot: 'foundation', localRef: 'palette:#fffeff', roughness: 1, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.35, metallic: 0.07 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) => (Math.abs(N[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
const area = (r) =>
    r.reduce((v, a, i) => v + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  sign = Math.sign(area(p.outline)),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
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
function prism(o, s, r, y0, y1, col = C[s]) {
  cap(o, s, r, y0, false, col);
  cap(o, s, r, y1, true, col);
  const sg = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
      col,
    );
  }
}
function inner(a) {
  const x = Math.abs(Math.cos(a)),
    z = Math.abs(Math.sin(a)),
    w = 42.5,
    l = 70.5,
    r = 7,
    rect = Math.min(w / (x || 1e-9), l / (z || 1e-9));
  if (x * rect <= w - r || z * rect <= l - r) return [Math.cos(a) * rect, Math.sin(a) * rect];
  const dot = x * (w - r) + z * (l - r),
    R = dot + Math.sqrt(Math.max(0, dot * dot - (w - r) * (w - r) - (l - r) * (l - r) + r * r));
  return [Math.cos(a) * R, Math.sin(a) * R];
}
function boundary(d) {
  const count = [1, 1, 1, 2][d],
    out = [];
  for (let i = 0; i < p.outline.length; i++)
    for (let k = 0; k < count; k++)
      out.push(mix(p.outline[i], p.outline[(i + 1) % p.outline.length], k / count));
  return out;
}
function section(q) {
  const a = Math.atan2(q[1], q[0]),
    inside = inner(a),
    dep = Math.hypot(q[0] - inside[0], q[1] - inside[1]),
    side = clamp((Math.abs(Math.cos(a)) - 0.45) / 0.28),
    f = 0.94 - 0.44 * side,
    low = Math.min(12.5, dep * f * 0.5),
    top = low + (32.5 - low) * side;
  return {
    q,
    inside,
    side,
    f,
    low,
    top,
    P: (u, y) => [inside[0] + (q[0] - inside[0]) * u, y, inside[1] + (q[1] - inside[1]) * u],
  };
}
function seating(o, A, Bb, d, upper = false, aisle = false) {
  const rows = upper ? [0, 4, 12, 28][d] : [1, 4, 12, 28][d];
  if (d === 0) {
    const from = upper ? (s) => Math.min(0.79, s.f + 0.11) : () => 0,
      to = upper ? () => 0.99 : (s) => s.f,
      y0 = upper ? (s) => s.low + 4.3 * s.side : () => 0,
      y1 = upper ? (s) => s.top : (s) => s.low;
    Q(
      o,
      'seat',
      [A.P(from(A), y0(A)), Bb.P(from(Bb), y0(Bb)), Bb.P(to(Bb), y1(Bb)), A.P(to(A), y1(A))],
      [0, 1, 0],
    );
    return;
  }
  if (!rows) return;
  const from = (s) => (upper ? Math.min(0.79, s.f + 0.11) : 0),
    to = (s) => (upper ? 0.99 : s.f),
    y0 = (s) => (upper ? s.low + 4.3 * s.side : 0),
    y1 = (s) => (upper ? s.top : s.low),
    normal = [-(A.q[0] + Bb.q[0]) / 2, 0, -(A.q[1] + Bb.q[1]) / 2];
  for (let j = 0; j < rows; j++) {
    const t0 = j / rows,
      t1 = (j + 1) / rows,
      ua = from(A) + (to(A) - from(A)) * t0,
      ub = from(Bb) + (to(Bb) - from(Bb)) * t0,
      va = from(A) + (to(A) - from(A)) * t1,
      vb = from(Bb) + (to(Bb) - from(Bb)) * t1,
      ya = y0(A) + (y1(A) - y0(A)) * t0,
      yb = y0(Bb) + (y1(Bb) - y0(Bb)) * t0,
      Y = y0(A) + (y1(A) - y0(A)) * t1,
      Z = y0(Bb) + (y1(Bb) - y0(Bb)) * t1;
    Q(o, 'shell', [A.P(ua, ya), Bb.P(ub, yb), Bb.P(ub, Z), A.P(ua, Y)], normal);
    Q(o, aisle ? 'shell' : 'seat', [A.P(ua, Y), Bb.P(ub, Z), Bb.P(vb, Z), A.P(va, Y)], [0, 1, 0]);
    if (d > 2 && !aisle) {
      const h = 0.38,
        back = 0.018;
      Q(
        o,
        'seat',
        [
          A.P(va - back, Y + 0.02),
          Bb.P(vb - back, Z + 0.02),
          Bb.P(vb - back, Z + h),
          A.P(va - back, Y + h),
        ],
        normal,
      );
      Q(
        o,
        'seat',
        [A.P(va, Y + 0.02), A.P(va, Y + h), Bb.P(vb, Z + h), Bb.P(vb, Z + 0.02)],
        normal.map((v) => -v),
      );
      if (d > 2)
        Q(
          o,
          'seat',
          [A.P(va - back, Y + h), Bb.P(vb - back, Z + h), Bb.P(vb, Z + h), A.P(va, Y + h)],
          [0, 1, 0],
        );
    }
  }
}
function bowl(o, d) {
  const ring = boundary(d),
    ss = ring.map(section);
  cap(o, 'shell', p.outline, -0.25, false);
  for (let i = 0; i < ss.length; i++) {
    const A = ss[i],
      Bb = ss[(i + 1) % ss.length],
      n = [sign * (Bb.q[1] - A.q[1]), 0, sign * (A.q[0] - Bb.q[0])],
      side = (A.side + Bb.side) / 2,
      aisle = d > 0 && i % [99, 5, 7, 9][d] === 0;
    // A white outer shell encloses the physical building, never the leisure-site parcel.
    Q(
      o,
      'shell',
      [
        [A.q[0], -0.25, A.q[1]],
        [Bb.q[0], -0.25, Bb.q[1]],
        [Bb.q[0], Bb.top, Bb.q[1]],
        [A.q[0], A.top, A.q[1]],
      ],
      n,
    );
    seating(o, A, Bb, d, false, aisle);
    if (side > 0.08) {
      const a = A.P(A.f, A.low),
        b = Bb.P(Bb.f, Bb.low),
        c = Bb.P(Math.min(0.79, Bb.f + 0.11), Bb.low),
        e = A.P(Math.min(0.79, A.f + 0.11), A.low);
      Q(o, 'shell', [a, b, c, e], [0, 1, 0]);
      Q(
        o,
        'glass',
        [
          A.P(A.f + 0.09, A.low + 0.25),
          Bb.P(Bb.f + 0.09, Bb.low + 0.25),
          Bb.P(Bb.f + 0.09, Bb.low + 3.7 * Bb.side),
          A.P(A.f + 0.09, A.low + 3.7 * A.side),
        ],
        [-n[0], 0, -n[2]],
      );
      Q(
        o,
        'shell',
        [
          A.P(A.f, A.low + 4.3 * A.side),
          Bb.P(Bb.f, Bb.low + 4.3 * Bb.side),
          Bb.P(0.99, Bb.low + 4.3 * Bb.side),
          A.P(0.99, A.low + 4.3 * A.side),
        ],
        [0, -1, 0],
      );
      if (d && !(d === 1 && i % 2))
        for (const t of d === 1 ? [0] : [0, 0.5]) {
          const lo = mix(A.P(A.f, A.low), Bb.P(Bb.f, Bb.low), t),
            hi = mix(A.P(A.f, A.low + 4.3 * A.side), Bb.P(Bb.f, Bb.low + 4.3 * Bb.side), t);
          if (Math.hypot(...hi.map((v, k) => v - lo[k])) > 0.1)
            beam(o, 'shell', lo, hi, 0.24, 0.24, C.shell);
        }
      seating(o, A, Bb, d, true, aisle);
      if (d > 1 && aisle && side > 0.5) {
        const a = A.P(0.8, A.low + 4.3 * A.side + 0.85),
          b = A.P(0.99, A.top + 0.85);
        beam(o, 'steel', a, b, 0.045, 0.045, C.steel);
      }
    }
  }
  // Field/apron are intrinsic parts of the stadium. The roof and stands leave the central air volume open.
  const rr = Array.from({ length: 32 }, (_, i) => inner((i * Math.PI) / 16));
  cap(o, 'shell', rr, -0.02, true, rgb('787e72'));
  const bands = d ? 13 : 1;
  for (let i = 0; i < bands; i++) {
    const a = -65 + (i * 130) / bands,
      b = -65 + ((i + 1) * 130) / bands;
    Q(
      o,
      'grass',
      [
        [-37, 0.12, a],
        [37, 0.12, a],
        [37, 0.12, b],
        [-37, 0.12, b],
      ],
      [0, 1, 0],
      C.grass.map((v) => v * (i % 2 ? 0.95 : 1.02)),
    );
  }
  const line = (a, b, width = 0.12) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      n = Math.hypot(dx, dz),
      u = [((-dz / n) * width) / 2, ((dx / n) * width) / 2];
    Q(
      o,
      'roof',
      [
        [a[0] + u[0], 0.16, a[1] + u[1]],
        [b[0] + u[0], 0.16, b[1] + u[1]],
        [b[0] - u[0], 0.16, b[1] - u[1]],
        [a[0] - u[0], 0.16, a[1] - u[1]],
      ],
      [0, 1, 0],
      rgb('eeeecc'),
    );
  };
  for (const z of [-52.5, 52.5]) {
    line([-34, z], [34, z]);
    if (d) for (const x of [-20.16, 20.16]) line([x, z], [x, z - Math.sign(z) * 16.5]);
    if (d) line([-20.16, z - Math.sign(z) * 16.5], [20.16, z - Math.sign(z) * 16.5]);
  }
  for (const x of [-34, 34]) line([x, -52.5], [x, 52.5]);
  line([-34, 0], [34, 0]);
  if (d) {
    const n = [0, 16, 24, 32][d];
    for (let i = 0; i < n; i++)
      line(
        [Math.cos((i * Math.PI * 2) / n) * 9.15, Math.sin((i * Math.PI * 2) / n) * 9.15],
        [
          Math.cos(((i + 1) * Math.PI * 2) / n) * 9.15,
          Math.sin(((i + 1) * Math.PI * 2) / n) * 9.15,
        ],
      );
  }
  if (d)
    for (const z of [-52.5, 52.5]) {
      for (const x of [-3.66, 3.66]) beam(o, 'steel', [x, 0.05, z], [x, 2.49, z], 0.1, 0.1, C.roof);
      beam(o, 'steel', [-3.66, 2.49, z], [3.66, 2.49, z], 0.1, 0.1, C.roof);
      if (d > 1) {
        const back = z + Math.sign(z) * 1.9;
        for (let k = 0; k <= 12; k++) {
          const x = -3.66 + (k * 7.32) / 12;
          beam(o, 'steel', [x, 0.05, back], [x, 2.4, z], 0.012, 0.012, C.roof);
        }
        for (let k = 1; k < 5; k++) {
          const y = (k * 2.4) / 5;
          beam(
            o,
            'steel',
            [-3.66, y, z + (1 - y / 2.4) * Math.sign(z) * 1.9],
            [3.66, y, z + (1 - y / 2.4) * Math.sign(z) * 1.9],
            0.012,
            0.012,
            C.roof,
          );
        }
      }
    }
}
function roofData(r, west) {
  const min = Math.min(...r.map((a) => a[1])),
    max = Math.max(...r.map((a) => a[1])),
    mid = (min + max) / 2,
    half = (max - min) / 2;
  const interval = (z) => {
      const xx = [];
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        if (Math.abs(a[1] - z) < 1e-6) xx.push(a[0]);
        if ((a[1] < z && b[1] > z) || (a[1] > z && b[1] < z))
          xx.push(a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]));
      }
      return [Math.min(...xx), Math.max(...xx)];
    },
    P = (z, t) => {
      const [lo, hi] = interval(z),
        x = west ? hi + (lo - hi) * t : lo + (hi - lo) * t,
        u = clamp(1 - ((z - mid) * (z - mid)) / (half * half)),
        y = 13.5 + (31.5 - 7 * t) * u;
      return [x, y, z];
    };
  return { r, west, min, max, mid, half, interval, P };
}
function roofs(o, d) {
  for (const rr of [p.west, p.east]) {
    const west = rr === p.west,
      R = roofData(rr, west),
      z = [
        ...new Set([
          ...rr.map((a) => a[1]),
          ...Array.from(
            { length: [2, 9, 25, 49][d] },
            (_, i) => R.min + ((R.max - R.min) * i) / ([2, 9, 25, 49][d] - 1),
          ),
        ]),
      ].sort((a, b) => a - b),
      across = [1, 2, 4, 6][d];
    for (let i = 1; i < z.length; i++)
      for (let k = 0; k < across; k++) {
        const a = R.P(z[i - 1], k / across),
          b = R.P(z[i - 1], (k + 1) / across),
          c = R.P(z[i], (k + 1) / across),
          e = R.P(z[i], k / across);
        Q(o, 'roof', [a, b, c, e], [0, 1, 0]);
        Q(
          o,
          'roof',
          [a, b, c, e].map((q) => [q[0], q[1] - 0.22, q[2]]),
          [0, -1, 0],
        );
      }
    for (const t of [0, 1])
      for (let i = 1; i < z.length; i++) {
        const a = R.P(z[i - 1], t),
          b = R.P(z[i], t);
        Q(o, 'roof', [a, b, [b[0], b[1] - 0.22, b[2]], [a[0], a[1] - 0.22, a[2]]]);
      }
    // The native roof perimeter is sampled at every original vertex; the long arch remains genuinely open steel.
    const n = [4, 6, 16, 32][d],
      A = (z, k) => {
        const q = R.P(z, 0);
        return [q[0] + (k === 0 ? -0.8 : k === 1 ? 0.8 : 0), q[1] + (k === 2 ? -0.55 : 0.75), q[2]];
      };
    for (let j = 0; j < n; j++) {
      const a = R.min + ((R.max - R.min) * j) / n,
        b = R.min + ((R.max - R.min) * (j + 1)) / n;
      if (d === 0) beam(o, 'steel', R.P(a, 0), R.P(b, 0), 0.8, 0.8, C.steel);
      else {
        for (let k = 0; k < 3; k++) beam(o, 'steel', A(a, k), A(b, k), 0.16, 0.16, C.steel);
        for (let k = 0; k < 3; k++) {
          beam(o, 'steel', A(a, k), A(b, (k + 1) % 3), 0.09, 0.09, C.steel);
          if (d > 1) beam(o, 'steel', A(a, k), A(a, (k + 1) % 3), 0.1, 0.1, C.steel);
        }
      }
    }
    if (d) {
      const n = [0, 4, 10, 22][d];
      for (let j = 1; j < n; j++) {
        const zz = R.min + ((R.max - R.min) * j) / n;
        for (let k = 0; k < [1, 1, 3, 8][d]; k++) {
          const a = R.P(zz, k / [1, 1, 3, 8][d]),
            b = R.P(zz, (k + 1) / [1, 1, 3, 8][d]);
          a[1] -= 0.6;
          b[1] -= 0.6;
          beam(o, 'steel', a, b, 0.12, 0.12, C.steel);
          if (d > 1) {
            const aa = R.P(zz, (k + 0.5) / [1, 1, 3, 8][d]);
            aa[1] -= 1.3;
            beam(o, 'steel', a, aa, 0.075, 0.075, C.steel);
            beam(o, 'steel', aa, b, 0.075, 0.075, C.steel);
          }
        }
        if (d > 2) {
          const a = R.P(zz, 0);
          B(o, 'steel', a[0], a[1] - 0.55, a[2], 0.85, 0.28, 0.45, rgb('313d3c'));
        }
      }
    }
  }
}
function entrance(o, d) {
  const r = p.gateHall,
    red = rgb('954a36'),
    center = r.reduce((a, v) => [a[0] + v[0] / r.length, a[1] + v[1] / r.length], [0, 0]);
  prism(o, 'shell', r, 0, 4.8);
  prism(o, 'steel', r, 4.8, 8.7, red);
  prism(o, 'glass', r, 8.7, 10.75);
  prism(o, 'steel', r, 10.75, 11.3, rgb('5e5b48'));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d) {
      for (let t = 0; t <= 1; t += 1 / Math.max(1, Math.round(len / (d === 1 ? 4 : 1.9)))) {
        const q = mix(a, b, t);
        beam(o, 'shell', [q[0], 4.8, q[1]], [q[0], 10.75, q[1]], 0.16, 0.16, C.shell);
      }
      for (const y of [9.2, 9.8, 10.4])
        beam(o, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.055, 0.055, C.steel);
    }
  }
  for (const [dx, h, col] of [
    [-2, 34, rgb('9dbcc3')],
    [2, 31, rgb('d7d3ad')],
  ]) {
    const x = center[0] + dx,
      z = center[1],
      a = [x - 1.05, 11.3, z - 0.28],
      b = [x + 1.05, 11.3, z - 0.28],
      c = [x + 0.25, h, z];
    Q(o, 'steel', [a, b, c, c], null, col);
    const back = [a, b, c].map((q) => [q[0], q[1], q[2] + 0.55]);
    T(o, 'steel', back.reverse(), null, col);
    for (let k = 0; k < 3; k++) {
      const q = [a, b, c],
        j = (k + 1) % 3;
      Q(
        o,
        'steel',
        [q[k], q[j], [q[j][0], q[j][1], q[j][2] + 0.55], [q[k][0], q[k][1], q[k][2] + 0.55]],
        null,
        col,
      );
    }
  }
  // Complete mapped approach, with an open low pedestrian portal beneath the intrinsic platform.
  const ar = p.gateApproach;
  cap(o, 'shell', ar, 4.8);
  cap(o, 'shell', ar, 4.35, false);
  const sg = Math.sign(area(ar));
  for (let i = 0; i < ar.length; i++) {
    const a = ar[i],
      b = ar[(i + 1) % ar.length];
    Q(
      o,
      'shell',
      [
        [a[0], 4.35, a[1]],
        [b[0], 4.35, b[1]],
        [b[0], 4.8, b[1]],
        [a[0], 4.8, a[1]],
      ],
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
    );
    if (d) beam(o, 'steel', [a[0], 5.7, a[1]], [b[0], 5.7, b[1]], 0.17, 0.17, red);
  }
  const lo = Math.min(...ar.map((a) => a[0])),
    hi = Math.max(...ar.map((a) => a[0])),
    front = Math.min(...ar.map((a) => a[1])),
    steps = [2, 6, 14, 24][d],
    width = hi - lo;
  for (let j = 0; j < steps; j++) {
    const t = (j + 1) / steps,
      y = 4.8 * t,
      z = front + 8 * (1 - t);
    B(o, 'shell', (lo + hi) / 2, 0, z, width, y, 8 / steps + 0.05);
  }
  if (d) {
    for (const x of [lo, hi])
      beam(o, 'steel', [x, 0.4, front + 8], [x, 5.7, front], 0.12, 0.12, red);
  }
  // Paired framed end scoreboards, blank faces deliberately omit event/brand content.
  const zz = Math.max(...p.outline.map((a) => a[1])) - 4;
  for (const [x, w, h] of [
    [-8, 12.8, 7.68],
    [8, 9.6, 6.72],
  ]) {
    B(o, 'shell', x, 12.5, zz, w + 1.2, 3.0, 2.4);
    B(o, 'steel', x, 15.5, zz, w + 1.1, h + 1.1, 1.4, C.steel);
    B(o, 'glass', x, 16.05, zz - 0.76, w, h, 0.18, rgb('263939'));
  }
}
function build(o, _f, d = 3) {
  bowl(o, d);
  roofs(o, d);
  entrance(o, d);
}
export const hongKongStadiumSkyline = (o, f) => build(o, f, 0),
  hongKongStadiumDistrict = (o, f) => build(o, f, 1),
  hongKongStadiumStreet = (o, f) => build(o, f, 2),
  hongKongStadiumCloseup = (o, f) => build(o, f, 3);
export const hongKongStadiumModel = {
  id: 'hong_kong_stadium',
  key: 'hong_kong_stadium',
  cell: 'we/wec',
  recipe: 'structure-hong-kong-stadium.mjs',
  title: 'Hong Kong Stadium',
  category: 'stadium',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-240, 155, -285],
  lookAt: [0, 20, 0],
  portableGroundY: -0.27,
  mediumFiContext: { scale: 2, groundY: -0.27 },
  qaCameras: [
    {
      name: 'whole-open-bowl-twin-roofs-and-north-entrance',
      position: [-210, 150, -250],
      lookAt: [0, 20, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'interior-green-tiers-open-central-sky-and-underside-roof-lattice',
      position: [-12, 18, 63],
      lookAt: [15, 20, -15],
    },
    {
      name: 'red-north-hall-twin-blade-fins-and-intrinsic-stair-approach',
      position: [-100, 22, -135],
      lookAt: [-43, 13, -90],
    },
    {
      name: 'whole-east-curved-membrane-native-roof-outline-and-upper-stand',
      position: [150, 55, 55],
      lookAt: [55, 25, 3],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent512mrawfield frozen before geometry; urban DEM may include roof/canopy interpolation, not surveyed pitch/forecourt grade. Actual terrain attachment remains unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hong-kong-stadium.mjs',
    level: 'skyline',
    export: 'hongKongStadiumSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'hongKongStadiumDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'hongKongStadiumStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'hongKongStadiumCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole original32-point physical stadium/18west+17east roofs/5approach+8hall retained.44-vertex leisure-site boundary is identity only, no parcel slab. Native8pitch polygon fixes centre/heading but is approximate and differs from operator130x74m total turf, which independently controls original field rectangle. The turf surface is0.12m above model datum and markings0.16m to avoid coplanar depth artifacts, while apron is−0.02m; these are bounded architectural finish offsets, not terrain fitting. Playing markings/105x68m soccer layout/goals/seat and aisle rhythms/scoreboard orientation/current finish are representative photo-based estimates, not current sporting/seat census.',
    'Roof45m maximum/13.5mend supports/7m rear slope/32.5m upper seating/12.5m nominal lower maximum/4.8m entrance platform/11.3m hall and34/31m blade fins are bounded original photo proportions, not native or engineering measured heights. Full roofs retain original polygons, open central sky, white upper/underside membranes/open triangular steel arches/transverse supports. Representative seating row ribbons preserve steep split tiers/concourse/aisle gaps while density coarsens at distance.',
    'Two exact already-published Waka77self-CC0wholebowl2012andChongFatself-photographedPD-user-w eastroof/exterior/entry2006originals individually inspected/nativeSHA1matched/unchanged Qualla policy passes. Native Waka77sourcefield literallyOow; named-author self-CC0 grant explicit, no other source invented. Close gate original inspected but unused due missing PD category in original local media record; accepted east exterior already shows same entrance. Rama-retouchedRoofSupport/plaque/unrelated city sources unused. No sourcebitmap textures/generated raster/downloaded mesh/policy or media-metadata repairs.',
    'Red entrance hall/glazed upper band/dark fascia/twin blue-ivory blades/raised approach/open lower platform gap and representative stair geometry; Precise entry partitions, slopes, bearings, turnstiles, rooms and side facade openings are bounded estimates. Official pitch-access tunnel dimensions are recorded as reference facts; their positions and interiors are not modeled. Blank scoreboard faces omit brand/event text. No OlympicHouse/apartments/hospital/nearby separate recreation pitch/tennis/cityroads/whole forecourt/natural hills/trees/people/vehicles/letters/plaque/flags.',
    'Independent512m129x129field/all16641values/one raw Terrarium tile frozen before geometry and unchanged without fit/flatten/reacquisition.27.1763m provider-relative north approach datum and6.3693..115.9634m absolute field are not a surveyed structural datum; urban composite may contain/interpolate roof/canopy heights. Model pitch/stand/street relationships and true live-host contact unverified. Portable/shared/context flat fixtures separate; native preview/replaceFootprint=false.',
  ],
};
