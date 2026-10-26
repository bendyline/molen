/** Bodie Island's surviving striped lighthouse and intrinsic attached oil house. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, beamPath, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dq/dq6/bodie_island_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  p = plan.parameters,
  ref = 'palette:#ffffff';
const C = {
  white: rgb('deded0'),
  black: rgb('41494a'),
  stone: rgb('a4aaa2'),
  metal: rgb('465153'),
  glass: rgb('70878a'),
  roof: rgb('6d746c'),
  brick: rgb('a07f68'),
  trim: rgb('d6d7c9'),
};
const surfaces = {
  white: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  black: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.34, metallic: 0.07 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.97, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
};
function tri(o, s, ps, n, col = C[s]) {
  const a = ps.map((p) => p.map(Math.fround)),
    cr = cross(
      a[1].map((v, i) => v - a[0][i]),
      a[2].map((v, i) => v - a[0][i]),
    );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((v, p, i) => v + p * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    abs = normal.map(Math.abs),
    uv =
      abs[1] > 0.65
        ? (p) => [p[0], p[2]]
        : abs[0] > abs[2]
          ? (p) => [p[2], p[1]]
          : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, ps, n, col = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], n, col);
  tri(o, s, [ps[0], ps[2], ps[3]], n, col);
}
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
function panel(o, s, outer, holes, F, n, col = C[s]) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => F(...pts[k])),
      n,
      col,
    );
}
function cyl(o, s, y0, y1, r0, r1, n, col = C[s]) {
  loft(o, s, [radialRing(y0, r0, r0, n), radialRing(y1, r1, r1, n)], col);
}
function surface(y) {
  return (y >= p.graniteTop + p.paintBandHeight && y < p.graniteTop + 2 * p.paintBandHeight) ||
    (y >= p.graniteTop + 3 * p.paintBandHeight && y < p.graniteTop + 4 * p.paintBandHeight)
    ? 'black'
    : 'white';
}
const radius = (y) =>
    p.shaftBaseRadius +
    ((p.shaftTopRadius - p.shaftBaseRadius) * (y - p.graniteTop)) / (p.shaftTop - p.graniteTop),
  at = (a, y, off = 0) => [(radius(y) + off) * Math.cos(a), y, (radius(y) + off) * Math.sin(a)];
const shaftWindows = [
  ...[
    [Math.PI / 2, 12.65],
    [Math.PI / 2, 26.05],
  ],
  ...[-Math.PI / 2].flatMap((a) => [5.9, 19.35, 32.8].map((y) => [a, y])),
].map(([a, y]) => ({ a, y, w: 0.67, h: 1.7, da: 0.67 / radius(y + 0.85) / 2 }));
function windowTrim(o, a, y, w, h, d, dark) {
  if (!d) return;
  const s = dark ? 'metal' : 'trim',
    rr = radius(y + h / 2),
    F = (x, z, off = 0) => at(a + x / rr, z, off),
    n = [Math.cos(a), 0, Math.sin(a)];
  for (const x of [-w / 2 - 0.065, w / 2 + 0.065])
    panel(o, s, rect(x, y - 0.11, 0.13, h + 0.22), [], (x, z) => F(x, z, 0.1), n);
  for (const z of [y - 0.08, y + h + 0.08])
    panel(o, s, rect(0, z, w + 0.25, 0.14), [], (x, z) => F(x, z, 0.1), n);
  if (d > 1) {
    panel(o, s, rect(0, y, 0.065, h), [], (x, z) => F(x, z, -0.11), n);
    for (let j = 1; j < 4; j++)
      panel(o, s, rect(0, y + (j * h) / 4 - 0.03, w, 0.06), [], (x, z) => F(x, z, -0.1), n);
    const outW = w / 2 + 0.19;
    for (let i = 0; i < 8; i++) {
      const aa = (i / 8) * Math.PI,
        bb = ((i + 1) / 8) * Math.PI;
      beam(
        o,
        s,
        F(Math.cos(aa) * outW, y + h + 0.04 + Math.sin(aa) * 0.16, 0.12),
        F(Math.cos(bb) * outW, y + h + 0.04 + Math.sin(bb) * 0.16, 0.12),
        0.08,
        0.08,
        C[s],
      );
    }
  }
}
function body(o, d) {
  const n = [12, 32, 64, 96][d],
    angles = new Set(Array.from({ length: n + 1 }, (_, i) => -Math.PI + (i / n) * Math.PI * 2)),
    ys = new Set([p.graniteTop, p.shaftTop]);
  for (let i = 1; i <= 5; i++) ys.add(p.graniteTop + i * p.paintBandHeight);
  if (d > 0)
    for (const h of shaftWindows) {
      angles.add(h.a - h.da);
      angles.add(h.a + h.da);
      ys.add(h.y);
      ys.add(h.y + h.h);
    }
  const aa = [...angles].sort((a, b) => a - b),
    yy = [...ys].sort((a, b) => a - b);
  for (let j = 1; j < yy.length; j++)
    for (let i = 1; i < aa.length; i++) {
      const a = aa[i - 1],
        b = aa[i],
        y = yy[j - 1],
        v = yy[j],
        mid = (a + b) / 2,
        ym = (y + v) / 2;
      if (
        d > 0 &&
        shaftWindows.some((h) => mid > h.a - h.da && mid < h.a + h.da && ym > h.y && ym < h.y + h.h)
      )
        continue;
      Q(
        o,
        surface(ym),
        [at(a, y), at(b, y), at(b, v), at(a, v)],
        [Math.cos(mid), 0.05, Math.sin(mid)],
      );
    }
  if (d > 0)
    for (const h of shaftWindows) {
      const F = (a, y, dep = 0) => at(a, y, dep),
        n = [Math.cos(h.a), 0, Math.sin(h.a)],
        l = h.a - h.da,
        r = h.a + h.da;
      Q(
        o,
        'glass',
        [F(l, h.y, -0.19), F(r, h.y, -0.19), F(r, h.y + h.h, -0.19), F(l, h.y + h.h, -0.19)],
        n,
      );
      for (const [a, b] of [
        [
          [l, h.y],
          [r, h.y],
        ],
        [
          [r, h.y],
          [r, h.y + h.h],
        ],
        [
          [r, h.y + h.h],
          [l, h.y + h.h],
        ],
        [
          [l, h.y + h.h],
          [l, h.y],
        ],
      ])
        Q(
          o,
          surface(h.y + 0.5),
          [F(...a), F(...b), F(...b, -0.19), F(...a, -0.19)],
          normalFor(F(...a), F(...b), F(...b, -0.19)),
        );
      windowTrim(o, h.a, h.y, h.w, h.h, d, surface(h.y + 0.5) === 'black');
    }
  // Dressed octagonal base has five granite courses and a smooth upper belt.
  for (let j = 0; j < 5; j++) {
    const y0 = (j * p.graniteTop) / 5,
      y1 = ((j + 1) * p.graniteTop) / 5,
      gap = d > 0 ? 0.025 : 0;
    cyl(
      o,
      'stone',
      y0 - gap,
      y1,
      p.baseRadius - j * 0.025,
      p.baseRadius - (j + 1) * 0.025,
      8,
      j < 3 ? C.stone : rgb('b3b6aa'),
    );
    if (d > 1) {
      const ring = radialRing(y0, p.baseRadius - j * 0.025, p.baseRadius - j * 0.025, 8);
      for (let k = 0; k < 8; k++) {
        const a = ring[k],
          b = ring[(k + 1) % 8],
          mid = a.map((v, i) => (v + b[i]) / 2);
        beam(o, 'stone', mid, [mid[0], y1, mid[2]], 0.035, 0.035, rgb('969f97'));
      }
    }
  }
  cyl(o, 'stone', -0.35, 0, p.baseRadius, p.baseRadius, 8);
}
function galleryRail(o, y, r, n, d) {
  const ring = (yy) => radialRing(yy, r, r, n);
  for (const yy of [y + 0.48, y + 1.02]) {
    const a = ring(yy);
    for (let i = 0; i < n; i++) {
      const b = a[(i + 1) % n];
      if (d < 2)
        Q(
          o,
          'metal',
          [
            [a[i][0], yy - 0.04, a[i][2]],
            [b[0], yy - 0.04, b[2]],
            [b[0], yy + 0.04, b[2]],
            [a[i][0], yy + 0.04, a[i][2]],
          ],
          [a[i][0] + b[0], 0, a[i][2] + b[2]],
        );
      else beam(o, 'metal', a[i], b, 0.07, 0.07, C.metal);
    }
  }
  if (d === 0) return;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    beam(
      o,
      'metal',
      [r * Math.cos(a), y, r * Math.sin(a)],
      [r * Math.cos(a), y + 1.02, r * Math.sin(a)],
      d === 0 ? 0.09 : 0.065,
      0.065,
      C.metal,
    );
  }
}
function upper(o, d) {
  const n = [8, 12, 16, 32][d];
  cyl(o, 'metal', 40.65, 40.88, 2.22, 2.31, n);
  cyl(o, 'metal', 40.88, 43.03, 2.23, 2.34, n);
  for (let i = 0; i < (d === 0 ? 8 : 16); i++) {
    const a = (i / (d === 0 ? 8 : 16)) * Math.PI * 2,
      A = [2.29 * Math.cos(a), 40.85, 2.29 * Math.sin(a)],
      B = [3.16 * Math.cos(a), 42.85, 3.16 * Math.sin(a)];
    beam(o, 'metal', A, B, d === 0 ? 0.15 : 0.12, 0.14, C.metal);
    if (d > 1)
      beam(o, 'metal', [2.3 * Math.cos(a), 41.85, 2.3 * Math.sin(a)], B, 0.08, 0.1, C.metal);
  }
  cyl(o, 'metal', 42.92, 43.13, 3.25, 3.25, n);
  cyl(o, 'metal', 43.13, 44.35, 2.35, 2.35, n);
  galleryRail(o, 43.13, 3.18, d === 0 ? 8 : 16, d);
  cyl(o, 'metal', 44.35, 44.55, 2.75, 2.75, n);
  galleryRail(o, 44.55, 2.69, d === 0 ? 8 : 16, d);
  if (d > 0)
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const F = (x, y, z = 0.03) => [
        Math.cos(a) * (2.25 + z) - Math.sin(a) * x,
        y,
        Math.sin(a) * (2.25 + z) + Math.cos(a) * x,
      ];
      panel(o, 'glass', rect(0, 41.4, 0.4, 0.7), [], F, [Math.cos(a), 0, Math.sin(a)]);
    }
  cyl(o, 'glass', 44.55, 48.1, 2.16, 2.16, 16);
  if (d > 0)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      beam(
        o,
        'metal',
        [2.18 * Math.cos(a), 44.55, 2.18 * Math.sin(a)],
        [2.18 * Math.cos(a), 48.1, 2.18 * Math.sin(a)],
        d === 0 ? 0.12 : 0.09,
        0.09,
        C.metal,
      );
    }
  if (d > 0)
    for (const yy of [45.74, 46.92]) {
      const r = radialRing(yy, 2.18, 2.18, 16);
      beamPath(o, 'metal', r.slice(0, 16), 0.065, 0.065, C.metal, true);
    }
  cyl(o, 'metal', 48.1, 48.25, 2.42, 2.42, n);
  cyl(o, 'metal', 48.25, 49.22, 2.42, 0.25, n);
  cyl(o, 'metal', 49.22, 49.5, 0.21, 0.21, n);
  cyl(o, 'metal', 49.5, 49.82, 0.21, 0.34, n);
  cyl(o, 'metal', 49.82, 50.10912, 0.34, 0.035, n);
}
function glazing(o, h, F, n, d) {
  const r = rect(...h),
    back = (x, y) => F(x, y, -0.16);
  panel(o, 'glass', r, [], back, n);
  if (!d) return;
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      'trim',
      [F(...a), F(...b), back(...b), back(...a)],
      normalFor(F(...a), F(...b), back(...b)),
    );
  }
  const [x, y, w, height] = h;
  for (const dx of [-w / 2 - 0.06, w / 2 + 0.06])
    panel(o, 'trim', rect(x + dx, y - 0.09, 0.12, height + 0.18), [], (x, y) => F(x, y, 0.07), n);
  for (const yy of [y - 0.07, y + height + 0.07])
    panel(o, 'trim', rect(x, yy, w + 0.24, 0.14), [], (x, y) => F(x, y, 0.07), n);
  if (d > 1) {
    for (let i = 1; i < 4; i++)
      panel(
        o,
        'trim',
        rect(x, y + (height * i) / 4 - 0.025, w, 0.05),
        [],
        (x, y) => F(x, y, -0.08),
        n,
      );
    panel(o, 'trim', rect(x, y, 0.05, height), [], (x, y) => F(x, y, -0.08), n);
  }
}
function oilhouse(o, d) {
  const x = p.oilCenterX,
    w = p.oilWidth / 2,
    z1 = p.oilFront,
    z0 = z1 - p.oilDepth,
    e = p.oilEaves,
    r = p.oilRidge,
    ring = [
      [x - w, z1],
      [x + w, z1],
      [x + w, z0],
      [x - w, z0],
    ];
  for (let i = 0; i < 4; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [-u[1], 0, u[0]],
      F = (s, y, dep = 0) => [a[0] + u[0] * s + n[0] * dep, y, a[1] + u[1] * s + n[2] * dep];
    const holes =
      i === 0
        ? [[len / 2, p.oilEntranceY, 1.1, 2.35]]
        : i % 2 === 1
          ? [
              [len * 0.28, 1.35, 0.58, 1.95],
              [len * 0.72, 1.35, 0.58, 1.95],
            ]
          : [];
    panel(
      o,
      'white',
      [
        [0, 0],
        [len, 0],
        [len, e],
        [0, e],
      ],
      d ? holes.map((h) => rect(...h)) : [],
      F,
      n,
    );
    if (d) for (const h of holes) glazing(o, h, F, n, d);
    if (i === 0 && d > 0) {
      panel(o, 'trim', rect(len / 2, p.oilEntranceY, 1.04, 1.89), [], (x, y) => F(x, y, -0.14), n);
      if (d > 1)
        for (const yy of [p.oilEntranceY + 0.18, p.oilEntranceY + 1.05]) {
          panel(o, 'trim', rect(len / 2, yy, 0.76, 0.64), [], (x, y) => F(x, y, -0.12), n, C.white);
        }
    }

    panel(o, 'stone', rect(len / 2, 0, len, 0.38), [], (s, y) => F(s, y, 0.05), n);
    panel(o, 'trim', rect(len / 2, 0.7, len, 0.14), [], (s, y) => F(s, y, 0.06), n);
  }
  // Main ridge runs north/south across the attached oilhouse, with gabled end walls.
  for (const side of [-1, 1]) {
    const z = side < 0 ? z0 - 0.25 : z1 + 0.25;
    Q(
      o,
      'roof',
      [
        [x - w - 0.28, e, z],
        [x + w + 0.28, e, z],
        [x + w + 0.28, r, (z0 + z1) / 2],
        [x - w - 0.28, r, (z0 + z1) / 2],
      ],
      [0, 1, side],
    );
  }
  for (const xx of [x - w, x + w])
    tri(
      o,
      'white',
      [
        [xx, e, z0],
        [xx, e, z1],
        [xx, r, (z0 + z1) / 2],
      ],
      [xx < x ? -1 : 1, 0, 0],
    );
  const cx = x,
    zf = z1 + 1.0,
    ce = 4.05,
    cr = 5.3;
  for (const side of [-1, 1]) {
    const xx = cx + side * 0.95;
    Q(
      o,
      'roof',
      [
        [xx, ce, z1 - 0.35],
        [xx, ce, zf],
        [cx, cr, zf],
        [cx, cr, z1 - 0.35],
      ],
      [side, 1, 0],
    );
  }
  if (d > 0) {
    beam(o, 'trim', [cx - 0.95, ce, zf], [cx, cr, zf], 0.12, 0.12, C.trim);
    beam(o, 'trim', [cx + 0.95, ce, zf], [cx, cr, zf], 0.12, 0.12, C.trim);
    beam(o, 'trim', [cx, ce, zf], [cx, cr, zf], 0.12, 0.12, C.trim);
    for (const xx of [cx - 0.75, cx, cx + 0.75])
      beam(o, 'trim', [xx, 2.8, z1 + 0.03], [xx, 4.03, zf - 0.15], 0.12, 0.12, C.trim);
  }
  // Short intrinsic passage connects the body to the rear of the oilhouse.
  box(o, 'white', [x - 1.0668, 0, 3.1], [x + 1.0668, 3.5, z0 + 0.15], C.white);
  for (const side of [-1, 1])
    Q(
      o,
      'roof',
      [
        [x + side * 1.2, 3.5, 3.1],
        [x + side * 1.2, 3.5, z0 + 0.1],
        [x, 4.1, z0 + 0.1],
        [x, 4.1, 3.1],
      ],
      [side, 1, 0],
    );
  for (const xx of [x - w + 0.7, x + w - 0.7]) {
    const cz = (z0 + z1) / 2;
    box(o, 'brick', [xx - 0.28, e - 0.25, cz - 0.3], [xx + 0.28, r + 1.35, cz + 0.3], C.brick);
    box(o, 'stone', [xx - 0.36, r + 0.25, cz - 0.37], [xx + 0.36, r + 0.43, cz + 0.37], C.stone);
    box(o, 'stone', [xx - 0.4, r + 1.35, cz - 0.4], [xx + 0.4, r + 1.52, cz + 0.4], C.trim);
    if (d > 1)
      for (const zz of [cz - 0.305, cz + 0.305])
        Q(
          o,
          'metal',
          [
            [xx - 0.13, r + 0.7, zz],
            [xx + 0.13, r + 0.7, zz],
            [xx + 0.13, r + 1.15, zz],
            [xx - 0.13, r + 1.15, zz],
          ],
          [0, 0, zz < cz ? -1 : 1],
        );
  }
  for (let i = 0; i < 4; i++) {
    const z = z1 + (4 - i) * 0.28;
    box(
      o,
      'stone',
      [x - 0.85, 0, z - 0.28],
      [x + 0.85, ((i + 1) * p.oilEntranceY) / 4, z],
      C.stone,
    );
  }
  if (d > 0)
    for (const xx of [x - 0.86, x + 0.86]) {
      beam(
        o,
        'metal',
        [xx, 0.95, z1 + 1.1],
        [xx, p.oilEntranceY + 1.0, z1 + 0.1],
        0.055,
        0.055,
        C.metal,
      );
      for (const zz of [z1 + 0.15, z1 + 1.03])
        beam(
          o,
          'metal',
          [xx, 0, zz],
          [xx, zz > z1 + 0.5 ? 0.95 : p.oilEntranceY + 1.0, zz],
          0.055,
          0.055,
          C.metal,
        );
    }
  if (d > 1)
    for (const z of [z0 + 0.5, z1 - 0.5])
      for (const xx of [x - w - 0.2, x + w + 0.2])
        beam(
          o,
          'trim',
          [xx, e - 0.4, z],
          [xx + (xx < x ? 0.12 : -0.12), e + 0.1, z],
          0.1,
          0.1,
          C.trim,
        );
}
function build(o, _f, d = 3) {
  body(o, d);
  upper(o, d);
  oilhouse(o, d);
}
export const bodieIslandSkyline = (o, f) => build(o, f, 0);
export const bodieIslandDistrict = (o, f) => build(o, f, 1);
export const bodieIslandStreet = (o, f) => build(o, f, 2);
export const bodieIslandModel = {
  id: 'bodie_island_lighthouse',
  key: 'bodie_island_lighthouse',
  recipe: 'structure-bodie-island-lighthouse.mjs',
  cell: 'dq/dq6',
  title: 'Bodie Island Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Surviving1872Bodie Island Lighthouse exterior with five horizontal daymark bands, octagonal granite base, recessed5shaftwindows/four servicewindows,16bracket flared black lowergallery/uppergallery/openrails,16-sidedglazedlantern/threepanerows/darkroofball, intrinsic attached white gabled oilhouse/workroom/passage, four sashwindows/twobrickchimneys and bracketed westentry/foursteps. Native center/axis plus official physical dimensions and exactNPS2021PDexteriors; no detachedquarters/sitefence/grounds/interior.',
  camera: [56, 36, 69],
  lookAt: [0, 25, 2],
  portableGroundY: -0.4,
  mediumFiContext: { scale: 1.45, groundY: -0.4 },
  qaCameras: [
    {
      name: 'five-bands-oilhouse-and-west-casement-windows',
      position: [24, 21, 40],
      lookAt: [0, 22, 4],
    },
    {
      name: 'corbel-brackets-two-open-galleries-and-glazed-lantern',
      position: [15, 46, 19],
      lookAt: [0, 44, 0],
    },
    {
      name: 'oilhouse-four-steps-cantilevered-canopy-and-chimneys',
      position: [14, 7.8, 24],
      lookAt: [0, 3.6, 8],
    },
    {
      name: 'opposite-three-white-band-windows-and-granite-base',
      position: [-22, 23, -38],
      lookAt: [0, 22, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent coastal relief frozen at fixed southwest oilhouse entry approach before geometry. Exact granite/sill/host ground contact remains approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-bodie-island-lighthouse.mjs',
    level: 'skyline',
    export: 'bodieIslandSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'bodieIslandDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'bodieIslandStreet', errorMeters: 0.12, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Three exact primaryNPSgovernment originals dated2021-12-12were inspected after publishedQuallainventory. ExplicitsoleCapeHatterasNationalSeashorecredit/FullGrantingRightsand originalbytes are bound. Unspecified-authorQualla1871drawing/1928aerial, attributionphotos, unrelatedOuterBanks views and exteriorartwork unused as modelcontrols. No copied pixels/generatedtextures; permanent surviving exterior only, currentcosmeticconditionunverified.',
    'Official50.10912mground-to-ventilator-ball governs totalheight;156ftis sea-to-focalplane,150ftground-to-focalplane. Granitebase8.5344mdiameter/3.3528mhigh, nominal6.7056mpaintbands, oilhouse8.3566x5.588m and2.1336mpassagewidth are physical textcontrols. Nativeenvelopes are larger/approximate, retained unchanged, not forced to model footprint or terrain. Heights of small sections, window/casing placement, roof/chimney/canopy/railing details and concealed rear joints remain bounded estimates.',
    'Whole individual tower and intrinsic connected oilhouse/passage exterior only. Fivebodywindows+fourservicewindows, twoopen galleries/corbel brackets/closed16-sidedlantern, octagonalgranitebase and oilhouseentry/foursteps/twochimneys retained. Separate doublekeepersquarters/visitorcenter/storehouse/cisterns/sitefence/paths/boardwalk/marsh/landscape, interiors/lensreplica/signage/people/vehicles and temporaryworks excluded.',
    'Independent160mTerrariumfield stays unchanged at fixed southwestentry. Grid samples/source pixels are not survey accuracy; sandy grass/pavement/base/threshold and host contact remain approximate. No fullsite slab or authored landscape.',
  ],
};
