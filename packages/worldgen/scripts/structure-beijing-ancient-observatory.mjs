/** Native historic platform, all eight defining instruments, and estimated courtyard halls. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/wx/wx4/beijing_ancient_observatory/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  outline = plan.outline,
  ref = 'palette:#ffffff';
const C = {
  brick: rgb('b6bcb9'),
  stone: rgb('c0b9a7'),
  roof: rgb('747970'),
  red: rgb('a64b3e'),
  blue: rgb('507b88'),
  green: rgb('6d9481'),
  bronze: rgb('53625b'),
  glass: rgb('42545d'),
  dark: rgb('5c5d54'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.99, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.99, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.97, metallic: 0 },
  red: { slot: 'trim', localRef: ref, roughness: 0.92, metallic: 0 },
  blue: { slot: 'trim', localRef: ref, roughness: 0.92, metallic: 0 },
  bronze: { slot: 'trim', localRef: ref, roughness: 0.73, metallic: 0.48 },
  glass: { slot: 'window', localRef: ref, roughness: 0.58, metallic: 0 },
  dark: { slot: 'door', localRef: ref, roughness: 0.97, metallic: 0 },
};
function tri(o, s, p, h, col = C[s]) {
  const fp = p.map((p) => p.map(Math.fround)),
    n = cross(
      fp[1].map((v, i) => v - fp[0][i]),
      fp[2].map((v, i) => v - fp[0][i]),
    );
  if (Math.hypot(...n) < 1e-9) return;
  if (n.reduce((v, x, i) => v + x * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
const B = (o, s, x, y, z, w, h, d) =>
  box(o, s, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], C[s]);
function plate(o, s, poly, y) {
  const ix = earcut(poly.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [poly[j][0], y, poly[j][1]]),
      [0, 1, 0],
    );
}
function clip(poly, z, less) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      a = less ? p[1] <= z : p[1] >= z,
      b = less ? q[1] <= z : q[1] >= z;
    if (a) out.push(p);
    if (a !== b) {
      const t = (z - p[1]) / (q[1] - p[1]);
      out.push([p[0] + t * (q[0] - p[0]), z]);
    }
  }
  return out.filter(
    (p, i) => Math.hypot(...p.map((v, k) => v - out[(i + out.length - 1) % out.length][k])) > 1e-6,
  );
}
const north = outline[0][1],
  south = outline[7][1],
  high = clip(clip(outline, north, false), south, true),
  nlow = clip(outline, north, true),
  slow = clip(outline, south, false);
function arch(x, width, spring, n) {
  const r = width / 2,
    p = [
      [x - r, 0],
      [x + r, 0],
      [x + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + Math.cos(a) * r, spring + Math.sin(a) * r]);
  }
  return p;
}
function panel(o, a, b, y0, y1, holes = [], slot = 'brick', depth = 0.28) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    point = ([x, y], d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[1] * d],
    polys = [
      [
        [0, y0],
        [len, y0],
        [len, y1],
        [0, y1],
      ],
      ...holes,
    ],
    ps = polys.flat(),
    ix = earcut(
      ps.flat(),
      holes.map((_, i) => 4 + holes.slice(0, i).reduce((s, p) => s + p.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      slot,
      ix.slice(i, i + 3).map((j) => point(ps[j])),
      [n[0], 0, n[1]],
    );
  for (const h of holes)
    for (let j = 0; j < h.length; j++) {
      const a = h[j],
        b = h[(j + 1) % h.length];
      Q(o, 'stone', [point(a), point(b), point(b, -depth), point(a, -depth)], [0, 1, 0]);
    }
  return { u, n, len, point };
}
function ring(o, center, r, tube, p, q, d, arc = [0, Math.PI * 2]) {
  const n = Math.max(3, Math.ceil(([6, 10, 20, 36][d] * (arc[1] - arc[0])) / (2 * Math.PI))),
    sides = [3, 3, 4, 6][d],
    normal = cross(p, q),
    rings = Array.from({ length: n + 1 }, (_, i) => {
      const a = arc[0] + ((arc[1] - arc[0]) * i) / n,
        rad = p.map((v, k) => v * Math.cos(a) + q[k] * Math.sin(a));
      return Array.from({ length: sides }, (_, j) => {
        const b = (-j / sides) * Math.PI * 2;
        return center.map(
          (v, k) => v + rad[k] * (r + tube * Math.cos(b)) + normal[k] * tube * Math.sin(b),
        );
      });
    });
  loft(o, 'bronze', rings, C.bronze, { cap: arc[1] - arc[0] < Math.PI * 2 - 0.001 });
}
function platform(o, d) {
  plate(o, 'stone', high, 14);
  for (const p of [nlow, slow]) plate(o, 'stone', p, 9.2);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      cuts = [0, 1];
    for (const z of [north, south]) {
      const t = (z - a[1]) / (b[1] - a[1]);
      if (t > 1e-7 && t < 1 - 1e-7) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const aa = a.map((v, k) => v + (b[k] - v) * cuts[j - 1]),
        bb = a.map((v, k) => v + (b[k] - v) * cuts[j]),
        mid = (aa[1] + bb[1]) / 2,
        y = mid >= north - 1e-5 && mid <= south + 1e-5 ? 14 : 9.2,
        len = Math.hypot(bb[0] - aa[0], bb[1] - aa[1]),
        holes = [];
      if (i === 7) holes.push(arch(len * 0.5, 3.4, 3, [6, 10, 18, 28][d]));
      if (i === 2) holes.push(arch(len * 0.55, 2.9, 2.55, [6, 10, 18, 28][d]));
      const f = panel(o, aa, bb, 0, y, holes);
      beam(o, 'stone', [aa[0], y - 0.35, aa[1]], [bb[0], y - 0.35, bb[1]], 0.17, 0.18, C.stone);
      if (d >= 1 && y === 14)
        for (let k = 1; k < len / 2.7; k++) {
          const p = f.point([k * 2.7, 12.9], 0.035);
          B(o, 'dark', p[0], p[1], p[2], 0.18, 0.16, 0.18);
        }
      for (const h of holes) {
        if (i === 2) {
          const ps = h.map((p) => f.point(p, -0.3));
          for (let k = 1; k < ps.length - 1; k++)
            tri(o, 'red', [ps[0], ps[k], ps[k + 1]], [f.n[0], 0, f.n[1]]);
          if (d >= 2) {
            const p = f.point([len * 0.55, 0], -0.27);
            B(o, 'dark', p[0], 0.15, p[2], 0.05, 3.78, 0.05);
          }
        } else {
          const backa = f.point([len * 0.5 - 1.7, 0], -3),
            backb = f.point([len * 0.5 + 1.7, 0], -3);
          beam(o, 'dark', [backa[0], 3, backa[2]], [backb[0], 3, backb[2]], 0.16, 0.16, C.dark);
          for (const side of [-1, 1]) {
            const front = f.point([len * 0.5 + side * 1.7, 0]),
              back = f.point([len * 0.5 + side * 1.7, 0], -3);
            Q(
              o,
              'brick',
              [front, [front[0], 3, front[2]], [back[0], 3, back[2]], back],
              [side * f.u[0], 0, side * f.u[1]],
            );
          }
        }
        if (d >= 1) {
          const xx = (h[0][0] + h[1][0]) / 2,
            p = f.point([xx, 5.25], 0.08);
          beam(
            o,
            'stone',
            [p[0] - f.u[0] * 1.05, p[1], p[2] - f.u[1] * 1.05],
            [p[0] + f.u[0] * 1.05, p[1], p[2] + f.u[1] * 1.05],
            0.14,
            0.55,
            C.stone,
          );
        }
      }
    }
  }
  // Masonry cheeks between the lower retained-wall ends and high observing deck.
  for (const [z, sign] of [
    [north, -1],
    [south, 1],
  ]) {
    const x0 = 1.48,
      x1 = 16.135;
    Q(
      o,
      'brick',
      [
        [x0, 9.2, z],
        [x1, 9.2, z],
        [x1, 14, z],
        [x0, 14, z],
      ],
      [0, 0, sign],
    );
  }
  for (let i = 0; i < high.length; i++) {
    const a = high[i],
      b = high[(i + 1) % high.length];
    beam(o, 'brick', [a[0], 14.38, a[1]], [b[0], 14.38, b[1]], 0.4, 0.75, C.brick);
    if (d >= 1) beam(o, 'stone', [a[0], 14.8, a[1]], [b[0], 14.8, b[1]], 0.46, 0.12, C.stone);
  }
  for (const p of [nlow, slow]) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (
        (Math.abs(a[1] - north) < 1e-4 && Math.abs(b[1] - north) < 1e-4) ||
        (Math.abs(a[1] - south) < 1e-4 && Math.abs(b[1] - south) < 1e-4)
      )
        continue;
      beam(o, 'brick', [a[0], 9.48, a[1]], [b[0], 9.48, b[1]], 0.42, 0.55, C.brick);
    }
    const z = p === nlow ? Math.min(...p.map((p) => p[1])) : Math.max(...p.map((p) => p[1]));
    for (let i = 0; i < (d === 0 ? 2 : 4); i++)
      B(o, 'brick', 3.3 + i * (d === 0 ? 7 : 3.5), 9.75, z, 1.65, 0.95, 0.55);
  }
  if (d >= 1) {
    for (let i = 0; i < 24; i++)
      B(o, 'stone', 13.5, 9.2 + 0.2 * i, -18.1 + 0.23 * i, 1.7, 0.2, 0.23);
    B(o, 'stone', 13.5, 13.8, -12, 1.8, 0.2, 1.7);
    for (const x of [12.5, 14.5])
      beam(o, 'bronze', [x, 10.1, -18.2], [x, 14.9, -12.6], 0.065, 0.065, C.bronze);
  }
  if (d >= 2) {
    B(o, 'red', 12.9, 14, -10.5, 3.4, 1.1, 3);
    gable(o, 3.9, 3.6, 15.1, 16.1, (x, y, z) => [12.9 + x, y, -10.5 + z], d);
  }
  // The original west approach is fixed; these steps are intrinsic, not a courtyard slab.
  for (let i = 0; i < (d === 0 ? 2 : 3); i++)
    B(o, 'stone', -17.1 - 0.38 * (2 - i), 0.15 * i, -0.5, 1.4 - 0.2 * i, 0.15, 3.8);
}
const instrumentPositions = [
  [-11.5, 7.2, 0],
  [-12, -6.8, 1],
  [-2.5, -7.6, 2],
  [0.3, 7.3, 3],
  [-11.5, -0.3, 4],
  [6.2, 7.2, 5],
  [6.7, -7.4, 6],
  [11.2, -0.6, 7],
];
function instrument(o, x, z, type, d) {
  const y = 14.08,
    h = plan.instrumentHeights[type],
    center = [x, y + h * 0.62, z],
    r = h * 0.33,
    thick = d === 0 ? 0.11 : d === 1 ? 0.075 : 0.048;
  if (d >= 1) B(o, 'stone', x, 14, z, 2.2, 0.12, 2.2);
  if (d === 0) beam(o, 'bronze', [x, y, z], [x, y + h * 0.36, z], 0.25, 0.25, C.bronze);
  for (const side of d === 0 ? [] : [-1, 1]) {
    const a = [x + side * r * 0.72, y, z],
      b = [x + side * r * 0.58, y + h * 0.36, z];
    beam(o, 'bronze', a, b, d === 0 ? 0.2 : 0.13, d === 0 ? 0.2 : 0.13, C.bronze);
    if (d >= 2) {
      beam(o, 'bronze', [a[0], a[1], z - 0.5], [b[0], b[1], z], 0.11, 0.11, C.bronze);
      beam(o, 'bronze', [a[0], a[1], z + 0.5], [b[0], b[1], z], 0.11, 0.11, C.bronze);
    }
  }
  if (type === 2) {
    sphere(o, 'bronze', center, [r, r, r], C.bronze, [6, 10, 16, 24][d], [3, 5, 8, 12][d]);
    if (d >= 1) ring(o, center, r * 1.2, thick, [1, 0, 0], [0, 1, 0], d);
  } else if (type === 4) {
    ring(o, [x, y + h * 0.44, z], r * 1.12, thick, [1, 0, 0], [0, 0, 1], d);
    beam(o, 'bronze', [x, y + 0.2, z], [x, y + h, z], 0.11, 0.11, C.bronze);
    if (d >= 1) {
      ring(o, [x, y + h * 0.5, z], r * 0.65, thick, [1, 0, 0], [0, 1, 0], d, [0, Math.PI]);
      beam(o, 'bronze', [x - r, y + h * 0.44, z], [x + r, y + h * 0.44, z], 0.08, 0.08, C.bronze);
    }
  } else if (type === 3 || type === 5) {
    const arc = type === 3 ? [Math.PI / 6, (Math.PI * 5) / 6] : [0, Math.PI / 2],
      c = [x - r * 0.4, y + h * 0.3, z];
    ring(o, c, r * 1.5, thick, [1, 0, 0], [0, 1, 0], d, arc);
    for (const a of d >= 2 ? [(arc[0] + arc[1]) / 2, arc[0], arc[1]] : [arc[0], arc[1]])
      beam(
        o,
        'bronze',
        c,
        [c[0] + Math.cos(a) * r * 1.5, c[1] + Math.sin(a) * r * 1.5, z],
        0.1,
        0.12,
        C.bronze,
      );
    if (d >= 1) {
      for (const xx of [x - r, x + r])
        beam(o, 'bronze', [xx, y, z], [xx, y + h, z], 0.11, 0.11, C.bronze);
      beam(o, 'bronze', [x - r, y + h, z], [x + r, y + h, z], 0.12, 0.1, C.bronze);
    }
  } else {
    ring(o, center, r, thick, [1, 0, 0], [0, 1, 0], d);
    if (d >= 1) {
      ring(o, center, r * 1.06, thick, [1, 0, 0], [0, 0, 1], d);
      const tilt = type === 1 ? 0.41 : 0.66;
      ring(o, center, r * 0.9, thick, [1, 0, 0], [0, Math.cos(tilt), Math.sin(tilt)], d);
      beam(o, 'bronze', [x, y + h * 0.12, z], [x, y + h, z], 0.09, 0.09, C.bronze);
    }
    if (type === 6 && d >= 1) {
      for (const xx of [-r, r]) {
        beam(o, 'bronze', [x + xx, y, z], [x + xx, y + h, z], 0.16, 0.16, C.bronze);
        beam(
          o,
          'bronze',
          [x + xx, y + h, z],
          [x + xx * 0.7, y + h * 1.03, z],
          0.13,
          0.13,
          C.bronze,
        );
      }
      beam(o, 'bronze', [x - r, y + h, z], [x + r, y + h, z], 0.1, 0.1, C.bronze);
    }
    if (type === 7 && d >= 2) {
      ring(o, center, r * 1.16, thick, [0, 0, 1], [0, 1, 0], d);
    }
  }
  // Bounded curved dragon/frame legs; no exact sculptural anatomy or scale engravings.
  if (d >= 2)
    for (const s of [-1, 1]) {
      const points = [
        [x + s * r * 0.9, y, z],
        [x + s * r * 0.95, y + h * 0.18, z],
        [x + s * r * 0.5, y + h * 0.34, z],
        [x + s * r * 0.65, y + h * 0.48, z],
      ];
      for (let i = 1; i < points.length; i++)
        beam(o, 'bronze', points[i - 1], points[i], 0.14, 0.12, C.bronze);
      if (d === 3)
        for (let i = 0; i < 4; i++)
          B(
            o,
            'bronze',
            x + s * (r * 0.88 - i * 0.08),
            y + h * (0.18 + i * 0.06),
            z + 0.08,
            0.09,
            0.09,
            0.13,
          );
    }
}
function gable(o, w, dep, eave, ridge, T, d) {
  const n = [1, 2, 4, 6][d],
    roofY = (t) => eave + (ridge - eave) * (1 - 1.3 * t + 0.3 * t * t);
  for (const side of [-1, 1])
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n;
      Q(
        o,
        'roof',
        [
          T(-w / 2, roofY(a), ((side * dep) / 2) * a),
          T(w / 2, roofY(a), ((side * dep) / 2) * a),
          T(w / 2, roofY(b), ((side * dep) / 2) * b),
          T(-w / 2, roofY(b), ((side * dep) / 2) * b),
        ],
        [0, 1, 0],
      );
    }
  for (const x of [-w / 2, w / 2]) {
    const origin = T(0, 0, 0),
      outward = T(x, 0, 0).map((v, i) => v - origin[i]);
    tri(o, 'brick', [T(x, eave, -dep / 2), T(x, eave, dep / 2), T(x, ridge, 0)], outward);
    if (d >= 1)
      for (const s of [-1, 1])
        beam(o, 'stone', T(x, eave, (s * dep) / 2), T(x, ridge + 0.15, 0), 0.16, 0.16, C.stone);
  }
  beam(o, 'stone', T(-w / 2, ridge + 0.13, 0), T(w / 2, ridge + 0.13, 0), 0.18, 0.25, C.stone);
  if (d >= 1)
    for (const x of [-w / 2, w / 2])
      beam(o, 'stone', T(x, ridge, 0), T(x, ridge + 0.42, 0), 0.22, 0.22, C.stone);
  if (d >= 2) {
    const step = d === 2 ? 1.3 : 0.42;
    for (let x = -w / 2 + 0.15; x < w / 2; x += step)
      for (const s of [-1, 1])
        for (let i = 0; i < n; i++) {
          const a = i / n,
            b = (i + 1) / n;
          beam(
            o,
            'roof',
            T(x, roofY(a) + 0.035, ((s * dep) / 2) * a),
            T(x, roofY(b) + 0.035, ((s * dep) / 2) * b),
            0.095,
            0.085,
            C.roof,
          );
        }
  }
}
function hall(o, p, d) {
  const rotate = p.axis === 'z',
    w = rotate ? p.depth : p.width,
    dep = rotate ? p.width : p.depth,
    T = (x, y, z) =>
      rotate
        ? p.facing === 'west'
          ? [p.x - z, y, p.z + x]
          : [p.x + z, y, p.z - x]
        : [p.x + x, y, p.z + z],
    A = (s, x, y, z, ww, hh, dd) => {
      const a = T(x - ww / 2, y, z - dd / 2),
        b = T(x + ww / 2, y + hh, z + dd / 2);
      box(
        o,
        s,
        a.map((v, i) => Math.min(v, b[i])),
        a.map((v, i) => Math.max(v, b[i])),
        C[s],
      );
    };
  A('stone', 0, 0, 0, w + 0.35, 0.3, dep + 0.35);
  A('brick', 0, 0.3, 0, w, 3.4, dep);
  gable(o, w + 0.7, dep + 0.7, 3.7, 5.6, T, d);
  if (d === 0) return;
  const count = Math.max(3, Math.floor(w / 3.5)),
    step = w / count;
  for (let i = 0; i <= count; i++)
    A('red', -w / 2 + step * i, 0.3, dep / 2 + 0.12, 0.16, 3.4, 0.18);
  for (const y of [1.0, 3.05, 3.45]) A('red', 0, y, dep / 2 + 0.14, w, 0.14, 0.2);
  A('blue', 0, 3.5, dep / 2 + 0.11, w, 0.18, 0.22);
  for (let i = 0; i < count; i++) {
    const x = -w / 2 + step * (i + 0.5),
      door = i === Math.floor(count / 2);
    A(
      door ? 'red' : 'glass',
      x,
      door ? 0.35 : 1.15,
      dep / 2 + 0.15,
      step - 0.25,
      door ? 2.8 : 1.75,
      0.08,
    );
    if (d >= 2) {
      for (let j = 1; j < 4; j++)
        A('red', x - step / 2 + (step * j) / 4, 1.15, dep / 2 + 0.21, 0.045, 1.75, 0.035);
      for (const y of [1.75, 2.35]) A('red', x, y, dep / 2 + 0.21, step - 0.24, 0.045, 0.035);
      for (let j = 0; j < 3; j++) {
        const a = T(x - step * 0.35 + step * j * 0.3, 3.36, dep / 2 + 0.24),
          b = T(x - step * 0.2 + step * j * 0.3, 3.61, dep / 2 + 0.24);
        beam(o, 'blue', a, b, 0.055, 0.045, C.green);
      }
    }
  }
  if (d >= 2) {
    A('blue', 0, 2.65, dep / 2 + 0.25, 0.85, 0.9, 0.1);
    for (const x of [-w * 0.3, w * 0.3]) A('stone', x, 0.15, dep / 2 + 0.7, 2.1, 0.15, 1.4);
  }
}
function build(o, _frame, d = 3) {
  platform(o, d);
  for (const [x, z, t] of instrumentPositions) instrument(o, x, z, t, d);
  for (const p of plan.estimatedCourtyardHalls) hall(o, p, d);
}
export const beijingObservatorySkyline = (o, f) => build(o, f, 0);
export const beijingObservatoryDistrict = (o, f) => build(o, f, 1);
export const beijingObservatoryStreet = (o, f) => build(o, f, 2);
export const beijingAncientObservatoryModel = {
  id: 'beijing_ancient_observatory',
  key: 'beijing_ancient_observatory',
  recipe: 'structure-beijing-ancient-observatory.mjs',
  cell: 'wx/wx4',
  title: 'Beijing Ancient Observatory',
  category: 'observatory',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete historic observatory architecture: native8vertexTplatform/wall/stair envelope with14mcentraldeck/lowerattachedcrenellatedwalls, real arched entry and closed red arched door, cornice/scuppers/lowplainparapet/boundedsteps/stairhead;8distinct bronze Qinginstrument silhouettes, plus3explicitly estimated lowwestcourtyard grey-tiled red timber halls/blue-green eaves/doors/lattice. Native plan only controls platform; courtyard footprints and concealed details remain estimates, no surveyed low-hall positioning claim.',
  camera: [-88, 59, 88],
  lookAt: [-19, 7, -3],
  portableGroundY: -0.25,
  mediumFiContext: { scale: 1.2, groundY: -0.25 },
  qaCameras: [
    {
      name: 'eight-distinct-rooftop-bronze-instruments-and-platform-parapet',
      position: [-21, 31, 31],
      lookAt: [-1, 15.5, 0],
    },
    {
      name: 'native-masonry-arch-cornice-scupper-and-attached-stair-envelope',
      position: [-38, 11, 8],
      lookAt: [-12, 6, 0],
    },
    {
      name: 'estimated-courtyard-halls-grey-tiles-red-timber-and-blue-green-eaves',
      position: [-63, 17, 18],
      lookAt: [-35, 2, -12],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed west approach before terrain; native parent base and bounded intrinsic entrances/stairs only. No park/yard slab.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-beijing-ancient-observatory.mjs',
    level: 'skyline',
    export: 'beijingObservatorySkyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'beijingObservatoryDistrict', errorMeters: 0.18, surfaces },
      street: { export: 'beijingObservatoryStreet', errorMeters: 0.05, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.estimatedCourtyardBasis,
    'Operator/governmenttextabout14mplatformheightand23.9x20.4minstrumentdeckdescribe the observing structure, not the full nativeTwall/stair envelope. Native parent corners are unchanged;14mcentralmass/9.2mattachedends/stairhead division, exact parapet/cornice/arch/stair sections and auxiliary hall elevations are photographic estimates. No surveyed low-hall positions, hidden roof/room layout or precise grade/threshold/host contact claim. Unassigned northwestLbuilding and neighboring ChineseCustomsMuseum excluded.',
    'All8intrinsic Qingrooftop instruments represented distinctly: equatorial/ecliptic/elaboratearmillary rings, celestialglobe, sextant, horizoninstrument, quadrant andaltazimuthframe. Operatorheights set scale. Exact orientations/positions, ring thickness/counts, engraved scales and old dragon/cloud/frame sculpture anatomy are medium-fi estimates from small cleared tower photos and text; no precision operational optics/astronomical simulation. Detached garden replica/instrument collections and interior exhibits are not included.',
    'Qualla-first3publishedPD-selforiginals and4explicit samecreator2006PD-selftower/courtyard originals inspected; nativeSHA1andprimaryauthorrelease agree. ConflictingheroEarthMoon/statuealias, otherlicensedimages, photographedlayoutwithunknownunderlyingrights, SanFranciscoreplica, unrelatedTempleofHeaven/nebula/embassy images unused. Officialoperator/governmenttextfacts only, no pageimages; no photographic texture. Older paint/fine roof/door details may differ from current restoration.',
    'Grey brick/stone shared surfaces, grey cylindrical tiles/pale copings, red timber lattice and blue-green courtyard eaves/closed red arch doors carry identity. Exact plaque lettering/carved roof ornaments and small fixture counts simplified; no reproduced indoorart, garden sculpture, ACunits/utilitywires/flags, landscape/trees/roads/bridges/subway/vehicles/visitors. Raw terrain retained without flattened/fitted entire-site ground.',
  ],
};
