/** Monnow's current widened bridge and asymmetric medieval gate, from Cadw and primary photos. */

import { readFileSync } from 'node:fs';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0015_monnow_bridge', 'map-frame.json')),
);
const red = [0.235, 0.158, 0.112],
  buff = [0.31, 0.286, 0.212],
  mortar = [0.24, 0.217, 0.17],
  dark = [0.085, 0.087, 0.076];
const rand = (s) => {
  const v = Math.sin(s * 74.53 + 21.8) * 17385.51;
  return v - Math.floor(v);
};
const tint = (s) => {
  const t = rand(s * 3);
  return (t < 0.72 ? red : buff).map((v) => v + (rand(s * 7) - 0.5) * 0.055);
};
const deck = (x) => 5.15 + 0.5 * Math.exp(-(((x + 1) / 12) ** 2));
const gateX = 5.0,
  gateZ = 0.16,
  base = deck(gateX),
  eave = base + 8.4;
function extrude(out, poly, d0, d1, color = red, slot = 'sandstone', gate = false, rubble = false) {
  if (rubble && poly.length === 4) {
    const center = poly[0].map((_, k) => poly.reduce((s, p) => s + p[k], 0) / poly.length);
    const seed = center[0] * 71 + center[1] * 29;
    // Chipped, unequal corner facets turn each bedded block into rubble instead of a brick.
    poly = poly.flatMap((p, i) => {
      const previous = poly[(i + poly.length - 1) % poly.length],
        next = poly[(i + 1) % poly.length];
      return [
        p.map((v, k) => v + (previous[k] - v) * (0.055 + rand(seed + i) * 0.11)),
        p.map((v, k) => v + (next[k] - v) * (0.055 + rand(seed + i * 7) * 0.11)),
      ];
    });
  }
  poly = poly
    .map((p) => p.map(Math.fround))
    .filter(
      (p, i, all) =>
        Math.hypot(
          p[0] - all[(i + all.length - 1) % all.length][0],
          p[1] - all[(i + all.length - 1) % all.length][1],
        ) > 1e-5,
    );
  for (let i = poly.length - 1; i >= 0 && poly.length >= 3; i--) {
    const a = poly[(i + poly.length - 1) % poly.length],
      b = poly[i],
      c = poly[(i + 1) % poly.length];
    if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-7)
      poly.splice(i, 1);
  }
  if (poly.length < 3) return;
  const area = poly.reduce(
    (s, p, i) => s + p[0] * poly[(i + 1) % poly.length][1] - poly[(i + 1) % poly.length][0] * p[1],
    0,
  );
  if (Math.abs(area) < 1e-8) return;
  const ps = area > 0 ? poly : poly.toReversed();
  const point = ([u, y], d) => (gate ? [d, y, -u] : [u, y, d]);
  const a = ps.map((p) => point(p, typeof d0 === 'function' ? d0(p[0]) : d0)),
    b = ps.map((p) => point(p, typeof d1 === 'function' ? d1(p[0]) : d1));
  for (const face of [a.toReversed(), b]) {
    const n = normalFor(...face);
    if (!rubble) {
      out.addConvexPolygon(slot, 'palette:#ffffff', face, n, (p) => [p[0], p[1]], color);
      continue;
    }
    const center = face[0].map((_, k) => face.reduce((s, p) => s + p[k], 0) / face.length);
    const seed = center[0] * 29 + center[1] * 47 + center[2] * 19;
    const inner = face.map((p) =>
      p.map(
        (v, k) =>
          center[k] +
          (v - center[k]) * (0.86 + rand(seed) * 0.06) +
          n[k] * (0.022 + 0.025 * rand(seed)),
      ),
    );
    out.addConvexPolygon(slot, 'palette:#ffffff', inner, n, (p) => [p[0], p[1]], color);
    for (let i = 0; i < face.length; i++) {
      const j = (i + 1) % face.length,
        q = [face[i], face[j], inner[j], inner[i]];
      quad(
        out,
        slot,
        q,
        normalFor(...q),
        color.map((v) => v * 0.94),
      );
    }
  }
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length,
      q = [a[i], a[j], b[j], b[i]];
    quad(out, slot, q, normalFor(...q), color);
  }
}
function archPoint(c, rx, ry, sy, t, extra = 0, pointed = 0) {
  const a = Math.PI * t;
  return [
    c - (rx + extra) * Math.cos(a),
    sy + (ry + extra) * Math.sin(a) - pointed * Math.sin(2 * a) ** 2,
  ];
}
function band(out, c, rx, ry, sy, d0, d1, thick, color = red, gate = false, pointed = 0, n = 64) {
  for (let i = 0; i < n; i++) {
    const a = (i + 0.017) / n,
      b = (i + 0.983) / n;
    extrude(
      out,
      [
        archPoint(c, rx, ry, sy, a, 0, pointed),
        archPoint(c, rx, ry, sy, b, 0, pointed),
        archPoint(c, rx, ry, sy, b, thick, pointed),
        archPoint(c, rx, ry, sy, a, thick, pointed),
      ],
      d0,
      d1,
      color.map((v) => v + (rand(i * 31 + c) - 0.5) * 0.095),
      'sandstone',
      gate,
    );
  }
}
const spans = [
  { c: -12, rx: 4.6, sy: 0.85, ry: 3.42 },
  { c: -0.55, rx: 4.9, sy: 0.85, ry: 3.78 },
  { c: 10.75, rx: 3.8, sy: 0.85, ry: 3.4 },
];
function archBottom(x) {
  for (const a of spans)
    if (Math.abs(x - a.c) < a.rx) return a.sy + a.ry * Math.sqrt(1 - ((x - a.c) / a.rx) ** 2);
  return 0;
}
function cut(poly, axis, edge, sign) {
  const next = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = (a[axis] - edge) * sign,
      db = (b[axis] - edge) * sign;
    if (da >= 0) next.push(a);
    if (da < 0 !== db < 0) next.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return next;
}
function courseFace(
  out,
  left,
  right,
  bottom,
  top,
  d0,
  d1,
  { gate = false, seed = 0, step = 0.31, block = 0.66 } = {},
) {
  for (let row = 0, y = bottom; y < top; row++, y += step) {
    for (let x = left - (row % 2) * block * 0.5; x < right; ) {
      const width = block * (0.72 + rand(seed + row * 71 + x * 3) * 0.61),
        a = Math.max(left, x + 0.013),
        b = Math.min(right, x + width - 0.013);
      x += width;
      if (b <= a) continue;
      const yy = Math.min(top, y + step - 0.019);
      const p = [
        [a, y + 0.01],
        [b, y + 0.01],
        [b, yy],
        [a, yy],
      ];
      extrude(out, p, d0, d1, tint(seed + x * 11 + row * 43), 'sandstone', gate, true);
    }
  }
}
function bridgeWidth(x) {
  const hits = [],
    p = frame.geometry.outline;
  for (let i = 1; i < p.length; i++)
    if (
      x >= Math.min(p[i - 1][0], p[i][0]) &&
      x <= Math.max(p[i - 1][0], p[i][0]) &&
      Math.abs(p[i][0] - p[i - 1][0]) > 1e-7
    ) {
      const t = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
      hits.push(p[i - 1][1] + t * (p[i][1] - p[i - 1][1]));
    }
  return hits.length >= 2 ? [Math.min(...hits), Math.max(...hits)] : [-4, 4.3];
}
function bridge(out) {
  for (const a of spans) {
    band(out, a.c, a.rx, a.ry, a.sy, -3.45, 3.6, 0.43, red, false, 0.1, 84);
    // Original medieval ribs survive between the later segmental outer faces.
    for (const z of [-2.55, -1.05, 0.45, 1.95])
      band(
        out,
        a.c,
        a.rx - 0.055,
        a.ry - 0.085,
        a.sy,
        z - 0.16,
        z + 0.16,
        0.28,
        buff,
        false,
        0.24,
        72,
      );
    for (const z of [-3.89, 4.12])
      band(out, a.c, a.rx, a.ry, a.sy, z - 0.22, z + 0.22, 0.48, red, false, 0, 78);
  }
  for (let x = -18.35; x < 15.12; x += 0.1) {
    const b = Math.min(15.12, x + 0.1),
      a0 = archBottom(x + 1e-6),
      a1 = archBottom(b - 1e-6);
    extrude(
      out,
      [
        [x, a0],
        [b, a1],
        [b, deck(b)],
        [x, deck(x)],
      ],
      -3.84,
      4.06,
      mortar,
    );
  }
  // Separate masonry blocks retain true bed joints; cut each against the arch envelope.
  for (let row = 0, y = 0; y < 5.65; row++, y += 0.34)
    for (let x = -18.35 - (row % 2) * 0.43; x < 15.12; x += 0.86) {
      const aa = Math.max(-18.35, x + 0.013),
        bb = Math.min(15.12, x + 0.846);
      if (bb <= aa) continue;
      for (let a = aa; a < bb - 0.001; a += 0.86) {
        const b = bb,
          lo0 = Math.max(y + 0.012, archBottom(a + 1e-6)),
          lo1 = Math.max(y + 0.012, archBottom(b - 1e-6));
        let p = [
          [a, lo0],
          [b, lo1],
          [b, Math.min(deck(b) - 0.04, y + 0.319)],
          [a, Math.min(deck(a) - 0.04, y + 0.319)],
        ];
        if (Math.min(lo0, lo1) > Math.min(deck(a) - 0.04, y + 0.319)) continue;
        const top = Math.min(deck(a), deck(b), y + 0.319);
        p = cut(p, 1, top, -1);
        if (p.length < 3) continue;
        for (const z of [-3.87, 4.09])
          extrude(out, p, z - 0.026, z + 0.026, tint(row * 51 + x * 13), 'sandstone', false, true);
      }
    }
  for (const x of [-6.3, 5.1])
    for (const side of [-1, 1]) {
      const z = side < 0 ? -3.6 : 3.83,
        tip = z + side * 1.17;
      const plan = [
        [x - 1.03, z],
        [x + 1.03, z],
        [x + 0.6, tip],
        [x - 0.6, tip],
      ];
      if (side > 0) plan.reverse();
      loft(
        out,
        'sandstone',
        [plan.map((p) => [p[0], 0, p[1]]), plan.map((p) => [p[0], 3.62, p[1]])],
        buff,
      );
      loft(
        out,
        'sandstone',
        [
          plan.map((p) => [p[0], 3.62, p[1]]),
          plan.map((p) => [x + (p[0] - x) * 0.08, 4.74, z + (p[1] - z) * 0.08]),
        ],
        tint(x),
      );
      for (let y = 0.12; y < 3.5; y += 0.35)
        for (let i = 0; i < 3; i++) {
          const a = plan[i],
            b = plan[i + 1],
            q = [
              [a[0], y, a[1] + side * 0.019],
              [b[0], y, b[1] + side * 0.019],
              [b[0], y + 0.018, b[1] + side * 0.019],
              [a[0], y + 0.018, a[1] + side * 0.019],
            ];
          quad(out, 'sandstone', q, normalFor(...q), mortar);
        }
    }
  // Walkways follow the entire mapped widened perimeter, including skewed ends.
  const poly = frame.geometry.outline.slice(0, -1);
  out.addCap(
    'road',
    'palette:#ffffff',
    poly,
    [],
    (p) => deck(p[0]) + 0.045,
    [0, 1, 0],
    (p) => p,
    [0.235, 0.22, 0.183],
  );
  for (let x = -18.0; x < 14.9; x += 0.38) {
    const b = Math.min(15.03, x + 0.36),
      w = bridgeWidth((x + b) / 2),
      y = deck(x);
    for (const side of [-1, 1]) {
      const z = w[side < 0 ? 0 : 1];
      if (!(x > 2.55 && x < 7.4)) {
        courseFace(out, x, b, y + 0.12, y + 1.2, side < 0 ? z : z - 0.54, side < 0 ? z + 0.54 : z, {
          seed: x * 17 + side,
          step: 0.24,
          block: 0.41,
        });
        box(
          out,
          'sandstone',
          [x - 0.005, y + 1.2, side < 0 ? z - 0.02 : z - 0.58],
          [b + 0.005, y + 1.36, side < 0 ? z + 0.58 : z + 0.02],
          buff.map((v) => v - 0.055),
        );
      }
      box(
        out,
        'sandstone',
        [x, y + 0.045, side < 0 ? z + 0.53 : z - 1.66],
        [b, y + 0.18, side < 0 ? z + 1.66 : z - 0.53],
        tint(x * 3),
      );
      if (Math.round((x + 18) / 0.38) % 2 === 0)
        box(
          out,
          'sandstone',
          [x, y - 0.31, side < 0 ? z + 0.07 : z - 0.49],
          [x + 0.21, y + 0.02, side < 0 ? z + 0.49 : z - 0.07],
          buff,
        );
    }
  }
}
function opening(u) {
  const z = -u - gateZ;
  if (Math.abs(z) < 1.92)
    return (
      base +
      3.1 +
      2.12 * Math.sqrt(1 - (z / 1.92) ** 2) -
      0.1 * Math.sin(2 * Math.acos(z / 1.92)) ** 2
    );
  if (Math.abs(z + 3.42) < 0.47) {
    const a = Math.acos((z + 3.42) / 0.47);
    return base + 1.56 + 0.91 * Math.sin(a) - 0.27 * Math.sin(2 * a) ** 2;
  }
  if (Math.abs(z - 3.57) < 0.44)
    return (
      base + 2.08 + (Math.abs(z - 3.57) < 0.29 ? 0.14 : (0.14 * (0.44 - Math.abs(z - 3.57))) / 0.15)
    );
  return base;
}
function capsule(t, extra = 0) {
  const a = t * Math.PI * 2;
  return [
    gateX + (2.06 + extra) * Math.cos(a),
    gateZ + (Math.sin(a) >= 0 ? 2.95 : -2.95) + (1.93 + extra) * Math.sin(a),
  ];
}
function gateEdges(u) {
  const dz = Math.max(0, Math.abs(-u - gateZ) - 2.95);
  const dx = 2.06 * Math.sqrt(Math.max(0.01, 1 - (dz / 1.93) ** 2));
  return [gateX - dx, gateX + dx];
}
function upperWindowTop(u) {
  return base + 7.91 + 0.29 * Math.sqrt(Math.max(0, 1 - ((u + gateZ) / 0.2) ** 2));
}
function windowWallPieces(poly) {
  // The upper aperture is subtracted from both the wall core and its facing stones.
  // Keeping the jamb/reveal surfaces in the extrusions avoids a painted-on window.
  const left = -gateZ - 0.2,
    right = -gateZ + 0.2,
    pieces = [cut(poly, 0, left, -1), cut(poly, 0, right, 1)];
  const middle = cut(cut(poly, 0, left, 1), 0, right, -1);
  if (middle.length >= 3) {
    pieces.push(cut(middle, 1, base + 7.56, -1));
    const lo = Math.min(...middle.map((p) => p[0])),
      hi = Math.max(...middle.map((p) => p[0]));
    for (let u = lo; u < hi - 1e-6; u += 0.05) {
      const end = Math.min(hi, u + 0.05),
        y0 = upperWindowTop(u),
        y1 = upperWindowTop(end),
        slope = (y1 - y0) / (end - u);
      const slice = cut(cut(middle, 0, u, 1), 0, end, -1);
      const transformed = slice.map(([x, y]) => [x, y - y0 - (x - u) * slope]);
      pieces.push(cut(transformed, 1, 0, 1).map(([x, y]) => [x, y + y0 + (x - u) * slope]));
    }
  }
  return pieces.filter((p) => p.length >= 3);
}
function gatehouse(out) {
  // Front and back walls have three genuine through-passages and different window arrangements.
  const left = -gateZ - 4.08,
    right = -gateZ + 4.08;
  for (let u = left; u < right; u += 0.06) {
    const b = Math.min(right, u + 0.06),
      y0 = opening(u + 1e-7),
      y1 = opening(b - 1e-7);
    for (const [d0, d1] of [
      [(u) => gateEdges(u)[0], (u) => gateEdges(u)[0] + 0.68],
      [(u) => gateEdges(u)[1] - 0.68, (u) => gateEdges(u)[1]],
    ])
      for (const polygon of windowWallPieces([
        [u, y0],
        [b, y1],
        [b, eave],
        [u, eave],
      ]))
        extrude(out, polygon, d0, d1, mortar, 'sandstone', true);
  }
  for (const side of [-1, 1]) {
    const centerZ = gateZ + side * 2.95;
    for (let i = 0; i < 90; i++) {
      const a = (Math.PI * i) / 90,
        b = (Math.PI * (i + 1)) / 90;
      if (1.93 * Math.sin((a + b) / 2) < 1.13) continue;
      const p = (t) => [gateX + 2.06 * Math.cos(t), base, centerZ + side * 1.93 * Math.sin(t)];
      const a0 = p(a),
        b0 = p(b),
        a1 = [a0[0], eave, a0[2]],
        b1 = [b0[0], eave, b0[2]];
      a0[1] = opening(-a0[2]);
      b0[1] = opening(-b0[2]);
      const q = side > 0 ? [b0, a0, a1, b1] : [a0, b0, b1, a1];
      quad(out, 'sandstone', q, normalFor(...q), mortar);
    }
  }
  for (const d of [2.91, 7.09])
    for (let row = 0, y = base; y < eave - 0.02; row++, y += 0.245) {
      for (let u = left - (row % 2) * 0.21; u < right; ) {
        const width = 0.27 + rand(row * 71 + u * 15) * 0.36,
          a = Math.max(left, u + 0.009),
          b = Math.min(right, u + width - 0.009);
        u += width;
        if (b <= a) continue;
        const cuts = [
          a,
          b,
          ...[-1.92, 1.92, -3.42 - 0.47, -3.42 + 0.47, 3.57 - 0.44, 3.57 + 0.44]
            .map((z) => -z - gateZ)
            .filter((u) => u > a && u < b),
        ].sort((a, b) => a - b);
        for (let part = 1; part < cuts.length; part++) {
          const x = cuts[part - 1],
            end = cuts[part],
            lo0 = Math.max(y + 0.007, opening(x + 1e-7)),
            lo1 = Math.max(y + 0.007, opening(end - 1e-7)),
            top = Math.min(eave, y + 0.231);
          if (Math.min(lo0, lo1) >= top) continue;
          let p = [
            [x, lo0],
            [end, lo1],
            [end, top],
            [x, top],
          ];
          p = cut(p, 1, top, -1);
          for (const polygon of windowWallPieces(p))
            extrude(
              out,
              polygon,
              (v) => gateEdges(v)[d < 5 ? 0 : 1] - 0.04,
              (v) => gateEdges(v)[d < 5 ? 0 : 1] + 0.04,
              tint(row * 73 + u * 31),
              'sandstone',
              true,
              true,
            );
        }
      }
    }
  // Individually varying rubble wraps the rounded gatehouse ends.
  for (const side of [-1, 1])
    for (let row = 0, y = base; y < eave - 0.05; row++, y += 0.255)
      for (let j = -1; j < 22; j++) {
        const a = (Math.PI * Math.max(0, j + (row % 2) * 0.48 + 0.022)) / 22,
          b = (Math.PI * Math.min(22, j + (row % 2) * 0.48 + 0.978)) / 22;
        if (b <= a) continue;
        if (1.93 * Math.sin((a + b) / 2) < 1.13) continue;
        const p = (t, Y, r) => [
          gateX + r * Math.cos(t),
          Y,
          gateZ + side * (2.95 + (r / 2.06) * 1.93 * Math.sin(t)),
        ];
        const top = Math.min(eave, y + 0.232);
        const a0 = p(a, y, 2.07),
          b0 = p(b, y, 2.07);
        a0[1] = Math.max(y, opening(-a0[2]));
        b0[1] = Math.max(y, opening(-b0[2]));
        if (Math.min(a0[1], b0[1]) >= top) continue;
        let q = cut([a0, b0, p(b, top, 2.07), p(a, top, 2.07)], 1, top, -1);
        q = q.filter((p, i) =>
          p.some((v, k) => Math.abs(v - q[(i + q.length - 1) % q.length][k]) > 1e-7),
        );
        if (q.length < 3) continue;
        if (side > 0) q.reverse();
        const n = normalFor(...q),
          center = q[0].map((_, k) => q.reduce((sum, p) => sum + p[k], 0) / q.length),
          inset = q.map((p) => p.map((v, k) => center[k] + (v - center[k]) * 0.88 + n[k] * 0.04)),
          color = tint(row * 83 + j * 27);
        out.addConvexPolygon('sandstone', 'palette:#ffffff', inset, n, (p) => [p[0], p[1]], color);
        for (let k = 0; k < q.length; k++) {
          const next = (k + 1) % q.length,
            edge = [q[k], q[next], inset[next], inset[k]];
          quad(
            out,
            'sandstone',
            edge,
            normalFor(...edge),
            color.map((v) => v * 0.94),
          );
        }
      }
  for (const [d0, d1] of [
    [2.68, 3.58],
    [6.38, 7.28],
  ]) {
    band(out, -gateZ, 1.92, 2.12, base + 3.1, d0, d1, 0.32, red, true, 0.1, 62);
    for (const side of [-1, 1])
      courseFace(
        out,
        -gateZ + side * 2.13 - 0.2,
        -gateZ + side * 2.13 + 0.2,
        base,
        base + 6.75,
        d0,
        d1,
        { gate: true, step: 0.38, block: 0.55, seed: side * 11 },
      );
    band(out, 3.42 - gateZ, 0.47, 0.91, base + 1.56, d0, d1, 0.2, buff, true, 0.27, 38);
    for (const u of [-3.57 - gateZ - 0.53, -3.57 - gateZ + 0.53])
      courseFace(out, u - 0.1, u + 0.1, base, base + 2.22, d0, d1, {
        gate: true,
        step: 0.31,
        block: 0.32,
        seed: u,
      });
    const header = [
      [-4.12, 2.08],
      [-4.0, 2.08],
      [-3.87, 2.22],
      [-3.27, 2.22],
      [-3.14, 2.08],
      [-3.02, 2.08],
    ];
    for (let i = 1; i < header.length; i++) {
      const a = header[i - 1],
        b = header[i];
      extrude(
        out,
        [
          [a[0] - gateZ, base + a[1]],
          [b[0] - gateZ, base + b[1]],
          [b[0] - gateZ, base + 2.43],
          [a[0] - gateZ, base + 2.43],
        ],
        d0,
        d1,
        buff,
        'sandstone',
        true,
      );
    }
  }
  // Portcullis grooves and visible oak ceiling remain recessed in the roadway passage.
  for (const z of [-1.79 + gateZ, 1.79 + gateZ])
    box(out, 'iron', [3.53, base + 0.02, z - 0.032], [3.58, base + 4.2, z + 0.032], dark);
  for (let x = 3.52; x < 6.7; x += 0.34)
    box(
      out,
      'timber',
      [x, base + 4.99, -1.8 + gateZ],
      [x + 0.15, base + 5.17, 1.8 + gateZ],
      [0.16, 0.106, 0.06],
    );
  // Three actual projecting machicolation arches with open undersides on the west face only.
  for (const u of [-1.22 - gateZ, -gateZ, 1.22 - gateZ])
    band(out, u, 0.51, 0.58, base + 6.01, 2.2, 2.97, 0.23, buff, true, 0, 34);
  for (const u of [-1.85 - gateZ, -0.61 - gateZ, 0.61 - gateZ, 1.85 - gateZ])
    for (let i = 0; i < 4; i++)
      box(
        out,
        'sandstone',
        [2.21 + i * 0.1, base + 5.83 - i * 0.2, -u - 0.18],
        [3.0, base + 6.01 - i * 0.2, -u + 0.18],
        buff,
      );
  band(out, -gateZ, 2.28, 0.66, base + 6.72, 2.81, 3.04, 0.18, red, true, 0, 68);
  // Dark recessed slit and round-headed upper openings, with their own stone dressings.
  for (const [x, dir] of [
    [2.887, -1],
    [7.115, 1],
  ]) {
    const z = gateZ,
      sy = base + 7.91;
    const pane = [
      [-z - 0.2, base + 7.56],
      [-z + 0.2, base + 7.56],
    ];
    for (let i = 0; i <= 30; i++) {
      const a = (Math.PI * i) / 30;
      pane.push([-z + 0.2 * Math.cos(a), sy + 0.29 * Math.sin(a)]);
    }
    const recessed = x - dir * 0.3;
    extrude(out, pane, recessed - 0.01, recessed + 0.01, [0.028, 0.03, 0.026], 'iron', true);
    band(out, -z, 0.2, 0.29, sy, x - 0.05, x + 0.05, 0.17, buff, true, 0, 30);
    for (const zz of [z - 0.27, z + 0.27])
      box(out, 'sandstone', [x - 0.05, base + 7.56, zz - 0.07], [x + 0.05, sy, zz + 0.07], buff);
    for (const zz of [z - 0.11, z + 0.11])
      box(
        out,
        'iron',
        [x + dir * 0.034 - 0.012, base + 7.58, zz - 0.012],
        [x + dir * 0.034 + 0.012, sy + 0.1, zz + 0.012],
        dark,
      );
  }
  for (const z of [gateZ - 2.39, gateZ + 2.39]) {
    box(out, 'iron', [2.805, base + 5.36, z - 0.026], [2.828, base + 5.97, z + 0.026], dark);
    box(out, 'sandstone', [2.77, base + 5.25, z - 0.13], [2.94, base + 5.36, z + 0.13], buff);
  }
  // Original northwest garderobe, bracketed below its slit.
  box(
    out,
    'sandstone',
    [2.24, base + 3.9, gateZ - 3.85],
    [3.05, base + 6.35, gateZ - 2.92],
    mortar,
  );
  for (let y = base + 3.9; y < base + 6.3; y += 0.27)
    box(out, 'sandstone', [2.18, y, gateZ - 3.88], [2.29, y + 0.245, gateZ - 2.9], tint(y * 31));
  box(out, 'sandstone', [2.09, base + 6.3, gateZ - 3.96], [3.1, base + 6.52, gateZ - 2.84], buff);
  for (const z of [gateZ - 3.73, gateZ - 3.12])
    box(out, 'sandstone', [2.39, base + 3.64, z - 0.15], [3.12, base + 3.92, z + 0.15], buff);
  box(out, 'iron', [2.15, base + 5.13, gateZ - 3.46], [2.19, base + 5.67, gateZ - 3.38], dark);
  // Wall tie plates and diagonal tail detail visible in the western reference.
  for (const z of [-2.46 + gateZ, 2.46 + gateZ])
    tube(out, 'iron', [2.77, base + 4.81, z], [2.73, base + 4.81, z], 0.12, dark, 32);
  box(out, 'iron', [2.67, base + 2.0, gateZ - 2.48], [2.72, base + 3.38, gateZ - 2.44], dark);
  box(out, 'iron', [2.66, base + 2.67, gateZ - 2.82], [2.72, base + 2.71, gateZ - 2.08], dark);
  roof(out);
}
function roof(out) {
  const top = eave + 2.6,
    roofColor = [0.245, 0.258, 0.204];
  const tile = (q, seed) => {
    if (normalFor(...q)[1] < 0) q.reverse();
    const color = roofColor.map((v) => v + (rand(seed) - 0.5) * 0.065);
    quad(out, 'sandstone', q, normalFor(...q), color);
    const lip = [
      q[0],
      [q[0][0], q[0][1] - 0.028, q[0][2]],
      [q[1][0], q[1][1] - 0.028, q[1][2]],
      q[1],
    ];
    quad(
      out,
      'sandstone',
      lip,
      normalFor(...lip),
      color.map((v) => v * 0.78),
    );
  };
  // Separate conical ends and the two planar slopes keep the capsule parameter seam
  // outside every shingle. Adjacent rows overlap as real thin stone roof courses.
  for (const side of [-1, 1]) {
    const p = (t, z) => [gateX + side * 2.29 * (1 - t), eave + 2.6 * t, z];
    let q = [p(0, gateZ - 2.95), p(0, gateZ + 2.95), p(1, gateZ + 2.95), p(1, gateZ - 2.95)];
    if (normalFor(...q)[1] < 0) q.reverse();
    quad(out, 'sandstone', q, normalFor(...q), roofColor);
    for (let row = 0; row < 18; row++)
      for (let i = -1; i < 20; i++) {
        const z0 = Math.max(gateZ - 2.95, gateZ - 2.95 + (i + (row % 2) * 0.5) * 0.32 + 0.007),
          z1 = Math.min(gateZ + 2.95, z0 + 0.301);
        if (z1 <= z0) continue;
        const t0 = row / 18,
          t1 = Math.min(0.999, (row + 1.13) / 18);
        q = [p(t0, z0), p(t0, z1), p(t1, z1), p(t1, z0)].map((a) => [a[0], a[1] + 0.033, a[2]]);
        tile(q, row * 91 + i * 13 + side);
      }
    const cone = (a, t) => [
      gateX + 2.29 * (1 - t) * Math.cos(a),
      eave + 2.6 * t,
      gateZ + side * (2.95 + 2.14 * (1 - t) * Math.sin(a)),
    ];
    for (let i = 0; i < 80; i++) {
      q = [
        cone((Math.PI * i) / 80, 0),
        cone((Math.PI * (i + 1)) / 80, 0),
        cone((Math.PI * (i + 1)) / 80, 0.995),
        cone((Math.PI * i) / 80, 0.995),
      ];
      if (normalFor(...q)[1] < 0) q.reverse();
      quad(out, 'sandstone', q, normalFor(...q), roofColor);
    }
    for (let row = 0; row < 18; row++) {
      const count = Math.max(5, Math.round(25 * (1 - row / 18))),
        t0 = row / 18,
        t1 = Math.min(0.995, (row + 1.13) / 18);
      for (let i = 0; i < count; i++) {
        const a = (Math.PI * (i + 0.01)) / count,
          b = (Math.PI * (i + 0.99)) / count;
        q = [cone(a, t0), cone(b, t0), cone(b, t1), cone(a, t1)].map((p) => [
          p[0],
          p[1] + 0.035,
          p[2],
        ]);
        tile(q, row * 71 + i * 23 + side);
      }
    }
  }
  for (let z = gateZ - 2.96; z < gateZ + 2.96; z += 0.34)
    box(
      out,
      'sandstone',
      [gateX - 0.105, top, z],
      [gateX + 0.105, top + 0.09, Math.min(gateZ + 2.99, z + 0.323)],
      [0.27, 0.29, 0.235],
    );
  // Elliptical eaves gutter, plus straight segments alongside the central ridge.
  const perimeter = [];
  for (let i = 0; i <= 48; i++) {
    const a = (Math.PI * i) / 48;
    perimeter.push([gateX + 2.32 * Math.cos(a), gateZ + 2.95 + 2.17 * Math.sin(a)]);
  }
  for (let i = 0; i <= 48; i++) {
    const a = Math.PI + (Math.PI * i) / 48;
    perimeter.push([gateX + 2.32 * Math.cos(a), gateZ - 2.95 + 2.17 * Math.sin(a)]);
  }
  for (let i = 0; i < perimeter.length; i++) {
    const p = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length];
    tube(
      out,
      'iron',
      [p[0], eave - 0.01, p[1]],
      [b[0], eave - 0.01, b[1]],
      0.052,
      [0.16, 0.17, 0.15],
      12,
    );
    if (i % 4 === 0)
      box(
        out,
        'sandstone',
        [p[0] - 0.09, eave - 0.32, p[1] - 0.1],
        [p[0] + 0.09, eave - 0.025, p[1] + 0.1],
        buff,
      );
  }
  for (const side of [-1, 1])
    for (let z = gateZ - 2.5; z < gateZ + 2.8; z += 0.75)
      box(
        out,
        'sandstone',
        [gateX + side * 2.1 - 0.1, eave - 0.32, z - 0.1],
        [gateX + side * 2.1 + 0.1, eave - 0.025, z + 0.1],
        buff,
      );
  const p = capsule(0.25, 0.19);
  tube(out, 'iron', [p[0], base + 0.1, p[1]], [p[0], eave, p[1]], 0.044, [0.3, 0.31, 0.28], 18);
}
export function buildMonnow(out) {
  bridge(out);
  gatehouse(out);
}
export const monnowStudy = {
  id: 'N0015',
  key: 'monnow_bridge',
  title: 'Monnow Bridge and Gatehouse',
  wikidataId: 'Q250115',
  build: buildMonnow,
  mapFrameDocument: 'map-frame.json',
  brief:
    'Current three-span pedestrian bridge and unique surviving gatehouse: ribbed medieval vaults, widened segmental outer arches, cutwaters, corbelled footways, individually coursed mixed sandstone, three unlike gate passages, western machicolations and garderobe, roof of two half cones joined by a ridge, separate stone roof courses and exposed oak passage timbers.',
  refs: [
    'https://cadwpublic-api.azurewebsites.net/reports/listedbuilding/FullReport?lang=en&id=2218',
    'https://commons.wikimedia.org/wiki/File:20200308_Monmouth_bridge_gate.jpg',
    'https://commons.wikimedia.org/wiki/File:20200308_Monmouth_east_bridge.jpg',
    'https://commons.wikimedia.org/wiki/File:Monmouth_-_Monnow_Bridge_-_geograph.org.uk_-_6006131.jpg',
    'https://commons.wikimedia.org/wiki/File:Gate_Tower,_Monnow_Bridge_-_geograph.org.uk_-_7725437.jpg',
    'https://www.openstreetmap.org/way/855452311',
    'https://www.openstreetmap.org/way/855457354',
  ],
  sourceFacts: {
    heritageRecord: 'Cadw listed building 2218, Grade I',
    material: 'Red sandstone rubble with buff sandstone patches and stone slate roof',
    gatePlan:
      'Two distinct front elevations, rounded ends, two half-cone roof ends and a central ridge',
    mappedBridgeExtentMeters: [34.544, 8.989],
    mappedGateExtentMeters: [4.133, 9.774],
  },
  reconstruction: {
    bridgeArchClearSpansMeters: [9.2, 9.8, 7.6],
    gateHeightAboveDeckMeters: 11,
    gateRoadwayOpeningMeters: 3.84,
    heightBasis:
      'Photo-scaled elevations and secondary published 11 m gate height; no measured engineering survey is asserted.',
    planBasis:
      'Complete named perimeter and exact-identity gate plan, with signed northeast town-facing axis. Earlier global record contained only one split14.59 m path segment.',
  },
  nativeAxes: {
    x: 'northeast along bridge into Monmouth',
    y: 'up from low water/pier footing reconstruction',
    z: 'southeast across bridge toward downstream river',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/855452311', 'way/855457354', 'way/60781949', 'way/855457353'],
    source: 'https://www.openstreetmap.org/way/855452311',
    elevationMode: 'terrain-contact',
    notes:
      'The decorated gate face looks southwest toward Overmonnow; plain face looks northeast into town. Lowest supports use a reconstructed low-water datum, requiring real river/bank fit review.',
  }),
  limitations: [
    'Arch stations, pier elevations, stone arrangements and minor roof details are reconstructed from primary photographs, not survey geometry.',
    'Upper gatehouse interior rooms and unseen structure are outside this exterior asset; the three public passages remain open.',
    'The older reported 7.3 m bridge width differs from the current mapped widened footways; the model retains the complete mapped deck.',
    'Real riverbed and bank elevations must be reviewed before geographic approval.',
  ],
  camera: { position: [-31, 22, 33], lookAt: [0, 7, 0], fov: 46 },
  qaCameras: [
    { name: 'west-gate', position: [-14, 11, 0.16], lookAt: [3, 10, 0.16], fov: 45 },
    { name: 'east-gate', position: [22, 11, 0.16], lookAt: [6, 10, 0.16], fov: 45 },
    { name: 'river-arches', position: [-2, 6, 33], lookAt: [-1, 4, 0], fov: 48 },
    { name: 'ribbed-vault', position: [-1, 1.9, 8], lookAt: [-1, 4, -2], fov: 55 },
    { name: 'machicolations', position: [-3, 12.8, 3], lookAt: [2.5, 11.7, 0.16], fov: 42 },
    { name: 'north-garderobe', position: [-2, 11, -9], lookAt: [3, 10, -3.2], fov: 48 },
    { name: 'stone-roof', position: [14, 22, 13], lookAt: [5, 15.3, 0], fov: 43 },
    { name: 'roadway-passage', position: [-1, 7, 0.1], lookAt: [8, 7.8, 0.1], fov: 53 },
  ],
};
