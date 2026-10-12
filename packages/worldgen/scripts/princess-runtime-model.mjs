/** Reviewed Princess Tower browser derivatives; original recipe is preserved. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid as originalGrid,
  mappedCap,
  mappedSolid,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';

const cream = [0.76, 0.74, 0.69],
  trim = [0.6, 0.61, 0.59],
  blue = [0.16, 0.33, 0.39],
  dark = [0.065, 0.12, 0.145];
const halfX = 20.001,
  halfZ = 18.872;
const directions = [
  { n: [1, 0, 0], r: [0, 0, -1], distance: halfX, width: halfZ * 2 },
  { n: [0, 0, 1], r: [1, 0, 0], distance: halfZ, width: halfX * 2 },
  { n: [-1, 0, 0], r: [0, 0, 1], distance: halfX, width: halfZ * 2 },
  { n: [0, 0, -1], r: [-1, 0, 0], distance: halfZ, width: halfX * 2 },
];
function point(f, x, y, d = 0) {
  return [f.n[0] * (f.distance + d) + f.r[0] * x, y, f.n[2] * (f.distance + d) + f.r[2] * x];
}
function patch(out, f, x0, x1, y0, y1, slot = 'concrete', color = cream, d = 0) {
  if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
  face(
    out,
    slot,
    [point(f, x0, y0, d), point(f, x1, y0, d), point(f, x1, y1, d), point(f, x0, y1, d)],
    color,
  );
}
function grid(out, p, c, dx, dy, frame, fc, slot) {
  face(out, 'glass', p, c);
  if (!out.detail.frames) return;
  const width = Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
    count = Math.max(1, Math.round(width / dx));
  for (let i = 1; i < count; i++) {
    const u = i / count,
      du = frame / width;
    const at = (u, j) => p[j].map((v, k) => v + (p[j + 1][k] - v) * u);
    face(out, slot, [at(u - du, 0), at(u + du, 0), at(1 - u - du, 2), at(1 - u + du, 2)], fc);
  }
}
function window(out, f, x0, x1, y0, y1, wide = false) {
  const inset = wide ? 0.28 : 0.55,
    lo = y0 + 0.72,
    hi = y1 - 0.4;
  patch(out, f, x0, x1, y0, lo);
  patch(out, f, x0, x1, hi, y1);
  patch(out, f, x0, x0 + inset, lo, hi);
  patch(out, f, x1 - inset, x1, lo, hi);
  patch(out, f, x0 + inset, x1 - inset, lo, hi, 'glass', blue, -0.16);
  if (out.detail.frames && x1 - x0 > 3.5) {
    const mid = (x0 + x1) / 2;
    patch(out, f, mid - 0.024, mid + 0.024, lo, hi, 'metal', trim, -0.12);
  }
  if (out.detail.sills)
    patch(out, f, x0 + inset, x1 - inset, lo - 0.06, lo + 0.06, 'metal', trim, 0.08);
}
function balcony(out, f, y0, y1, width) {
  const steps = out.detail.balconySides,
    front = (t) => -0.95 + 0.82 * (1 - (2 * t - 1) ** 2);
  const plan = [
    point(f, -width / 2, y0, -2.35),
    ...Array.from({ length: steps + 1 }, (_, i) =>
      point(f, -width / 2 + (width * i) / steps, y0, front(i / steps)),
    ),
    point(f, width / 2, y0, -2.35),
  ].map(([x, _y, z]) => [x, z]);
  mappedSolid(out, 'concrete', plan, y0, y0 + 0.25, cream);
  if (!out.detail.continuousShaft) grid(
    out,
    [
      point(f, -width / 2, y0 + 0.25, -2.3),
      point(f, width / 2, y0 + 0.25, -2.3),
      point(f, width / 2, y1, -2.3),
      point(f, -width / 2, y1, -2.3),
    ],
    blue,
    2.15,
    y1 - y0,
    0.05,
    trim,
    'metal',
  );
  if (!out.detail.continuousShaft) for (const sign of [-1, 1]) {
    const returnFace = [
      point(f, (sign * width) / 2, y0, -2.35),
      point(f, (sign * width) / 2, y0, 0),
      point(f, (sign * width) / 2, y1, 0),
      point(f, (sign * width) / 2, y1, -2.35),
    ];
    face(out, 'concrete', sign < 0 ? returnFace.toReversed() : returnFace, cream);
  }
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps;
    const lo = [
      point(f, -width / 2 + width * a, y0 + 0.25, front(a)),
      point(f, -width / 2 + width * b, y0 + 0.25, front(b)),
    ];
    const hi = lo.map((p) => [p[0], y0 + 1.25, p[2]]);
    const pane = [lo[0], lo[1], hi[1], hi[0]];
    face(out, 'clear_glass', pane, [0.4, 0.58, 0.61]);
    if (out.detail.rails) {
      const rail = [
        hi[0].map((v, k) => (k === 1 ? v - 0.035 : v)),
        hi[1].map((v, k) => (k === 1 ? v - 0.035 : v)),
        hi[1].map((v, k) => (k === 1 ? v + 0.035 : v)),
        hi[0].map((v, k) => (k === 1 ? v + 0.035 : v)),
      ];
      face(out, 'metal', rail, trim);
    }
    if (out.detail.guardPosts && i % out.detail.guardPosts === 0)
      tube(out, 'metal', lo[0], hi[0], 0.028, trim, 6);
  }
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps;
    face(
      out,
      'concrete',
      [
        point(f, -width / 2 + width * a, y0 + 0.04, front(a)),
        point(f, -width / 2 + width * b, y0 + 0.04, front(b)),
        point(f, -width / 2 + width * b, y0 + 0.3, front(b)),
        point(f, -width / 2 + width * a, y0 + 0.3, front(a)),
      ],
      cream,
    );
  }
}
function ribbonBelt(out, y) {
  const p = [
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, halfZ],
    [halfX, -halfZ],
  ];
  if (out.detail.skyline) {
    const ring = p.map(([x, z]) => [x + Math.sign(x) * 0.72, z + Math.sign(z) * 0.72]);
    mappedSolid(out, 'concrete', ring, y - 0.35, y + 0.45, cream);
    return;
  }
  for (const [lo, hi, d, color] of [
    [y - 0.65, y - 0.35, 0.48, cream],
    [y - 0.35, y, 0.62, trim],
    [y, y + 0.45, 0.72, cream],
  ]) {
    const ring = p.map(([x, z]) => [x + Math.sign(x) * d, z + Math.sign(z) * d]);
    mappedSolid(out, 'concrete', ring, lo, hi, color);
  }
}
function decorBeam(out, f, slot, a, b, w, depth, c) {
  const dx = (b[0] - a[0]) * f.r[0] + (b[2] - a[2]) * f.r[2],
    dy = b[1] - a[1],
    length = Math.hypot(dx, dy);
  const off = [
    ((-dy / length) * f.r[0] * w) / 2,
    ((dx / length) * w) / 2,
    ((-dy / length) * f.r[2] * w) / 2,
  ];
  const p = [
    a.map((v, k) => v + off[k] + (f.n[k] * depth) / 2),
    b.map((v, k) => v + off[k] + (f.n[k] * depth) / 2),
    b.map((v, k) => v - off[k] + (f.n[k] * depth) / 2),
    a.map((v, k) => v - off[k] + (f.n[k] * depth) / 2),
  ];
  face(out, slot, p, c);
  face(out, slot, p.toReversed(), c);
}
function keyhole(out, f) {
  const cy = 342,
    r = 3.15;
  for (let i = 0; i < out.detail.keyholeSides; i++) {
    const a = ((-45 + (i * 270) / out.detail.keyholeSides) * Math.PI) / 180,
      b = ((-45 + ((i + 1) * 270) / out.detail.keyholeSides) * Math.PI) / 180;
    decorBeam(
      out,
      f,
      'concrete',
      point(f, r * Math.cos(a), cy + r * Math.sin(a), 0.33),
      point(f, r * Math.cos(b), cy + r * Math.sin(b), 0.33),
      0.58,
      0.75,
      cream,
    );
  }
  for (const sign of [-1, 1])
    decorBeam(
      out,
      f,
      'concrete',
      point(f, (sign * r) / Math.sqrt(2), 326, 0.33),
      point(f, (sign * r) / Math.sqrt(2), cy - r / Math.sqrt(2), 0.33),
      0.58,
      0.75,
      cream,
    );
  for (const sign of [-1, 1]) {
    decorBeam(
      out,
      f,
      'concrete',
      point(f, 0, 348.5, 0.35),
      point(f, sign * 7.3, 345.3, 0.35),
      0.82,
      0.92,
      cream,
    );
    decorBeam(
      out,
      f,
      'metal',
      point(f, 0, 349.06, 0.49),
      point(f, sign * 7.4, 345.74, 0.49),
      0.14,
      0.18,
      trim,
    );
    if (out.detail.smallRelief)
      for (let j = 0; j < 4; j++)
        boxAt(out, f, sign * (3 + j * 0.86), 339.7, 0.32, 0.48, 1.1, 0.5, cream);
  }
  if (out.detail.smallRelief) boxAt(out, f, 0, 348.7, 0.36, 0.82, 1.65, 0.9, cream);
  if (out.detail.medallions)
    for (const sign of [-1, 1]) {
      const x = sign * (f.width / 2 - 5.1),
        y = 346.2,
        n = out.detail.medallionSides;
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n,
          b = (2 * Math.PI * (i + 1)) / n;
        tri(
          out,
          'glass',
          [
            point(f, x, y, 0.07),
            point(f, x + 0.68 * Math.cos(a), y + 0.68 * Math.sin(a), 0.07),
            point(f, x + 0.68 * Math.cos(b), y + 0.68 * Math.sin(b), 0.07),
          ],
          blue,
        );
        decorBeam(
          out,
          f,
          'concrete',
          point(f, x + 0.8 * Math.cos(a), y + 0.8 * Math.sin(a), 0.1),
          point(f, x + 0.8 * Math.cos(b), y + 0.8 * Math.sin(b), 0.1),
          0.13,
          0.16,
          cream,
        );
      }
    }
}
function boxAt(out, f, x, y, d, w, h, depth, color, slot = 'concrete') {
  const ring = (v) =>
    [
      point(f, x - w / 2, v, d - depth / 2),
      point(f, x + w / 2, v, d - depth / 2),
      point(f, x + w / 2, v, d + depth / 2),
      point(f, x - w / 2, v, d + depth / 2),
    ].toReversed();
  loft(out, slot, [ring(y - h / 2), ring(y + h / 2)], color);
}
function circularBand(out, y0, y1, r0, r1, color = cream, slot = 'metal') {
  loft(
    out,
    slot,
    [radialRing(y0, r0, r0, out.detail.bandSides), radialRing(y1, r1, r1, out.detail.bandSides)],
    color,
  );
}
function cylinderGlazing(out, r, y0, y1, count, rows = 1) {
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < count; i++) {
      const a = (-i * Math.PI * 2) / count,
        b = (-(i + 1) * Math.PI * 2) / count,
        lo = y0 + ((y1 - y0) * j) / rows,
        hi = y0 + ((y1 - y0) * (j + 1)) / rows;
      grid(
        out,
        [
          [r * Math.cos(a), lo, r * Math.sin(a)],
          [r * Math.cos(b), lo, r * Math.sin(b)],
          [r * Math.cos(b), hi, r * Math.sin(b)],
          [r * Math.cos(a), hi, r * Math.sin(a)],
        ],
        blue,
        3,
        hi - lo,
        0.065,
        trim,
        'metal',
      );
    }
}
function slitDrum(out, r, y0, y1, count) {
  if (out.detail.skyline) {
    loft(out, 'metal', [radialRing(y0, r, r, 8), radialRing(y1, r, r, 8)], cream, { cap: false });
    return;
  }
  const at = (t, y, rr = r) => [rr * Math.cos(t), y, rr * Math.sin(t)];
  for (let i = 0; i < count; i++) {
    const a = (-i * Math.PI * 2) / count,
      b = (-(i + 1) * Math.PI * 2) / count,
      l = a + (b - a) * 0.24,
      rr = a + (b - a) * 0.76;
    for (const [u, v, lo, hi] of [
      [a, b, y0, y0 + 0.55],
      [a, b, y1 - 0.55, y1],
      [a, l, y0 + 0.55, y1 - 0.55],
      [rr, b, y0 + 0.55, y1 - 0.55],
    ])
      face(out, 'metal', [at(u, lo), at(v, lo), at(v, hi), at(u, hi)], cream);
    grid(
      out,
      [
        at(l, y0 + 0.55, r - 0.15),
        at(rr, y0 + 0.55, r - 0.15),
        at(rr, y1 - 0.55, r - 0.15),
        at(l, y1 - 0.55, r - 0.15),
      ],
      blue,
      3,
      y1 - y0,
      0.05,
      trim,
      'metal',
    );
    for (const t of [l, rr]) {
      const side = [
        at(t, y0 + 0.55),
        at(t, y0 + 0.55, r - 0.15),
        at(t, y1 - 0.55, r - 0.15),
        at(t, y1 - 0.55),
      ];
      face(out, 'metal', t === l ? side : side.toReversed(), cream);
    }
  }
}
function crownPetals(out, r, y, h, count, width) {
  const rows = out.detail.petalRows;
  const half = (v) =>
    v <= 0.63 ? 0.5 : v <= 0.88 ? 0.5 - ((v - 0.63) / 0.25) * 0.21 : ((1 - v) / 0.12) * 0.29;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count,
      n = [Math.cos(a), 0, Math.sin(a)],
      t = [Math.sin(a), 0, -Math.cos(a)];
    const p = (u, v, d) => [
      n[0] * (r + d + 0.75 * v * v) + t[0] * u * width,
      y + v * h,
      n[2] * (r + d + 0.75 * v * v) + t[2] * u * width,
    ];
    for (let j = 1; j < rows.length; j++) {
      const lo = rows[j - 1],
        hi = rows[j],
        a = half(lo),
        b = half(hi);
      for (const depth of [-0.18, 0.18]) {
        let panel =
          b > 1e-5
            ? [p(-a, lo, depth), p(a, lo, depth), p(b, hi, depth), p(-b, hi, depth)]
            : [p(-a, lo, depth), p(a, lo, depth), p(0, hi, depth)];
        if (depth < 0) panel = panel.toReversed();
        if (panel.length === 3) tri(out, 'metal', panel, cream);
        else face(out, 'metal', panel, cream);
      }
      for (const sign of [-1, 1]) {
        const side = [
          p(sign * a, lo, 0.18),
          p(sign * a, lo, -0.18),
          p(sign * b, hi, -0.18),
          p(sign * b, hi, 0.18),
        ];
        face(out, 'metal', sign < 0 ? side.toReversed() : side, cream);
      }
    }
    face(
      out,
      'metal',
      [p(-0.5, 0, -0.18), p(0.5, 0, -0.18), p(0.5, 0, 0.18), p(-0.5, 0, 0.18)],
      cream,
    );
    if (out.detail.petalBalls)
      sphere(out, 'metal', p(0, 1.02, 0.1), [0.115, 0.115, 0.115], cream, 6, 3);
  }
}
function crown(out) {
  const r = 17.8;
  circularBand(out, 349.7, 350.35, 19.4, 19.4);
  cylinderGlazing(out, r, 350.35, 356.9, out.detail.cylinderSides, out.detail.cylinderRows);
  circularBand(out, 356.9, 357.3, 18.0, 18.65);
  circularBand(out, 357.3, 357.6, 18.65, 18.65);
  slitDrum(out, 18.25, 357.6, 361.8, out.detail.slitCount);
  circularBand(out, 361.8, 362.25, 18.4, 18.75);
  cylinderGlazing(out, 17.5, 362.25, 365.15, out.detail.cylinderSides);
  crownPetals(out, 18.3, 362.25, 2.9, out.detail.petalCount, 1.45);
  circularBand(out, 365.15, 366.1, 19.4, 19.4);
  cylinderGlazing(out, 15.6, 366.1, 372.0, out.detail.cylinderSides, out.detail.cylinderRows);
  slitDrum(out, 15.75, 372.0, 374.7, out.detail.slitCount);
  circularBand(out, 374.7, 375.05, 16, 16.4);
  crownPetals(out, 15.8, 375.05, 1.9, out.detail.petalCount, 1.2);
  // A closed striped ellipsoidal dome: completed skin, not the photographed construction gaps.
  const segments = out.detail.domeSides,
    rows = out.detail.domeRows;
  const at = (i, j) => {
    const a = (-i * Math.PI * 2) / segments,
      t = ((j / rows) * Math.PI) / 2,
      rr = 3.3 + (16.2 - 3.3) * Math.cos(t);
    return [rr * Math.cos(a), 377 + 15 * Math.sin(t), rr * Math.sin(a)];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const reflective = Math.floor(i / Math.max(1, segments / 32)) % 2 === 0;
      face(
        out,
        reflective ? 'metal' : 'glass',
        [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)],
        reflective ? [0.77, 0.77, 0.73] : [0.11, 0.19, 0.22],
      );
    }
  loft(
    out,
    'metal',
    [
      [392, 3.3],
      [394, 2.15],
      [397, 0.95],
      [400, 0.54],
      [401, 0.48],
    ].map(([y, rr]) => radialRing(y, rr, rr, out.detail.mastSides)),
    cream,
  );
  circularBand(out, 400.5, 401.05, 0.82, 0.86, trim);
  loft(
    out,
    'metal',
    [
      radialRing(401, 0.46, 0.46, out.detail.mastSides),
      radialRing(413.4, 0.21, 0.21, out.detail.mastSides),
    ],
    cream,
  );
  circularBand(out, 412.85, 413.2, 0.44, 0.44, trim);
  sphere(out, 'metal', [0, 413.62, 0], [0.18, 0.22, 0.18], cream, 8, 4);
  tube(out, 'metal', [0, 413.8, 0], [0, 414, 0], 0.055, trim, 8);
}
function base(out) {
  if (out.detail.simpleBase) {
    const ring = [
      [-halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, halfZ],
      [halfX, -halfZ],
    ];
    mappedCap(out, 'foundation', ring, 0, [0.44, 0.45, 0.43], [], true);
    for (const f of directions) {
      patch(out, f, -f.width / 2, f.width / 2, 0, 27.48, 'glass', dark, -0.2);
      for (let y = 0; y < 27; y += 4.58) {
        patch(out, f, -f.width / 2, f.width / 2, y, y + 0.95);
        patch(out, f, -f.width / 2, f.width / 2, y + 3.78, y + 4.58);
      }
      for (const x of [-f.width / 2, 0, f.width / 2]) patch(out, f, x - 0.24, x + 0.24, 0, 27.48);
      if (f.n[0] === -1) {
        patch(out, f, -5, 5, 0, 6.8, 'glass', blue, 0.035);
        for (const x of [-5, -2.5, 0, 2.5, 5])
          patch(out, f, x - 0.04, x + 0.04, 0, 6.8, 'metal', trim, 0.08);
      }
    }
    ribbonBelt(out, 27.3);
    return;
  }
  const ring = [
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, halfZ],
    [halfX, -halfZ],
  ];
  mappedCap(out, 'foundation', ring, 0, [0.44, 0.45, 0.43], [], true);
  for (const f of directions) {
    const entrance = f.n[0] === -1;
    for (let j = 0; j < 6; j++) {
      const y = j * 4.58,
        step = f.width / 10;
      for (let i = 0; i < 10; i++) {
        const a = -f.width / 2 + i * step,
          b = a + step;
        if (entrance) {
          // Reserve the central two-storey lobby rather than overlapping opaque windows with it.
          if (j < 2 && a < 5.8 && b > -5.8) {
            if (a < -5.8) patch(out, f, a, -5.8, y, y + 4.58);
            if (b > 5.8) patch(out, f, 5.8, b, y, y + 4.58);
          } else window(out, f, a, b, y, y + 4.58, true);
        } else {
          patch(out, f, a, b, y, y + 0.95);
          patch(out, f, a, b, y + 3.78, y + 4.58);
          patch(out, f, a, a + 0.24, y + 0.95, y + 3.78);
          patch(out, f, b - 0.24, b, y + 0.95, y + 3.78);
          patch(out, f, a + 0.24, b - 0.24, y + 0.95, y + 3.78, 'metal', dark, -0.2);
          for (let h = y + 1.04; h < y + 3.75; h += out.detail.baseLouverStep)
            patch(out, f, a + 0.24, b - 0.24, h - 0.038, h + 0.038, 'metal', trim, -0.05);
        }
      }
    }
    ribbonBeltFace(out, f, 26.0);
    if (!entrance) continue;
    // KONE's completed street photograph supports the southwest glazed arrival frontage.
    patch(out, f, -5.8, 5.8, 6.8, 9.16);
    patch(out, f, -5.8, -5, 0, 6.8);
    patch(out, f, 5, 5.8, 0, 6.8);
    grid(
      out,
      [
        point(f, -5, 0, 0.035),
        point(f, 5, 0, 0.035),
        point(f, 5, 6.8, 0.035),
        point(f, -5, 6.8, 0.035),
      ],
      blue,
      2,
      3.4,
      0.08,
      trim,
      'metal',
    );
    for (const x of [-5.65, 5.65]) {
      boxAt(out, f, x, 3.1, 0.18, 0.85, 6.2, 0.66, cream);
      for (let j = 0; j < 12; j++) boxAt(out, f, x, 0.18 + j * 0.52, 0.58, 0.95, 0.1, 0.16, trim);
    }
    for (const sign of [-1, 1])
      beam(
        out,
        'concrete',
        point(f, sign * 6.5, 7.1, 0.24),
        point(f, 0, 9.1, 0.24),
        0.48,
        0.62,
        cream,
      );
    boxAt(out, f, 0, 9.1, 0.24, 0.6, 0.9, 0.72, cream);
    for (const x of [-2.45, 0, 2.45]) {
      grid(
        out,
        [
          point(f, x - 0.98, 0, 0.1),
          point(f, x + 0.98, 0, 0.1),
          point(f, x + 0.98, 3.1, 0.1),
          point(f, x - 0.98, 3.1, 0.1),
        ],
        blue,
        1,
        4,
        0.06,
        trim,
        'metal',
      );
      tube(
        out,
        'metal',
        point(f, x + 0.67, 1.1, 0.2),
        point(f, x + 0.67, 1.95, 0.2),
        0.027,
        trim,
        8,
      );
    }
  }
  ribbonBelt(out, 27.3);
}
function ribbonBeltFace(out, f, y) {
  beam(
    out,
    'concrete',
    point(f, -f.width / 2, y, 0.22),
    point(f, f.width / 2, y, 0.22),
    0.38,
    0.5,
    cream,
  );
  beam(
    out,
    'metal',
    point(f, -f.width / 2, y + 0.38, 0.3),
    point(f, f.width / 2, y + 0.38, 0.3),
    0.14,
    0.23,
    trim,
  );
}
function buildNative(out) {
  base(out);
  for (const f of directions) {
    const width = 16.4,
      pitch = (290 - 27.75) / 74;
    if (out.detail.continuousShaft) {
      // Shared side walls and window banks avoid repeated per-course boxes.
      for (const sign of [-1, 1]) {
        const start = sign < 0 ? -f.width / 2 : width / 2,
          end = sign < 0 ? -width / 2 : f.width / 2,
          cell = (end - start) / 3;
        patch(out, f, start, end, 27.75, 290, 'glass', blue, -0.16);
        for (let i = 0; i <= 3; i++) {
          const x = start + i * cell;
          patch(out, f, Math.max(start, x - 0.55), Math.min(end, x + 0.55), 27.75, 290);
        }
        for (let j = 0; j < 74; j += out.detail.floorStep) {
          const y = 27.75 + j * pitch;
          patch(out, f, start, end, y - 0.4, y + 0.72);
        }
      }
      if (out.detail.districtSkin) {
        // The midpoint of front guards and inset windows bounds their depth
        // approximation; preserve the bowed envelope rather than tall empty bays.
        for (let i = 0; i < 4; i++) {
          const a = i / 4, b = (i + 1) / 4,
            depth = t => -2.035 + 0.82 * (1 - (2 * t - 1) ** 2);
          face(out, 'glass', [point(f, -8.2 + 16.4 * a, 27.75, depth(a)), point(f, -8.2 + 16.4 * b, 27.75, depth(b)), point(f, -8.2 + 16.4 * b, 290, depth(b)), point(f, -8.2 + 16.4 * a, 290, depth(a))], blue);
        }
      } else {
        patch(out, f, -8.2, 8.2, 27.75, 290, 'glass', blue, -2.3);
      }
      for (const sign of [-1, 1]) {
        const p = [point(f, sign * 8.2, 27.75, -2.35), point(f, sign * 8.2, 27.75, 0), point(f, sign * 8.2, 290, 0), point(f, sign * 8.2, 290, -2.35)];
        face(out, 'concrete', sign < 0 ? p.toReversed() : p, cream);
      }
    }
    for (let j = 0; j < 74; j += out.detail.floorStep) {
      const y0 = 27.75 + j * pitch,
        y1 = 27.75 + Math.min(74, j + out.detail.floorStep) * pitch;
      if (out.detail.districtSkin) patch(out, f, -8.2, 8.2, y0, y0 + 0.3, 'concrete', cream, -1.15);
      else balcony(out, f, y0, y1, width);
      if (!out.detail.continuousShaft) for (const sign of [-1, 1]) {
        const start = sign < 0 ? -f.width / 2 : width / 2,
          end = sign < 0 ? -width / 2 : f.width / 2;
        const count = out.detail.groupedWindows ? 1 : 3;
        for (let i = 0; i < count; i++)
          window(
            out,
            f,
            start + ((end - start) * i) / count,
            start + ((end - start) * (i + 1)) / count,
            y0,
            y1,
          );
      }
    }
    for (let j = 0; j < 16; j += out.detail.upperStep) {
      const y0 = 290 + j * 3.75,
        y1 = y0 + Math.min(out.detail.upperStep, 16 - j) * 3.75,
        span = f.width / 10;
      for (let i = 0; i < 10; i++) {
        const a = -f.width / 2 + i * span,
          b = a + span;
        if (i >= 3 && i <= 6) {
          grid(
            out,
            [
              point(f, a, y0, -0.1),
              point(f, b, y0, -0.1),
              point(f, b, y1, -0.1),
              point(f, a, y1, -0.1),
            ],
            blue,
            2,
            y1 - y0,
            0.06,
            trim,
            'metal',
          );
          if (i !== 4 && i !== 5 && j % 3 !== 2)
            patch(out, f, a, b, y0 + 0.8, y0 + 2.1, 'concrete', cream, 0.03);
        } else window(out, f, a, b, y0, y1, j % 3 === 2);
      }
    }
    if (out.detail.keyholes) keyhole(out, f);
  }
  for (const y of [124.5, 210.0, 290.0, 349.3]) ribbonBelt(out, y);
  mappedCap(
    out,
    'metal',
    [
      [-halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, halfZ],
      [halfX, -halfZ],
    ],
    350,
    [0.48, 0.49, 0.48],
  );
  crown(out);
}

const settings = {
  district: {
    floorStep: 4,
    continuousShaft: true,
    districtSkin: true,
    groupedWindows: true,
    simpleBase: true,
    upperStep: 8,
    balconySides: 2,
    frames: false,
    sills: false,
    rails: false,
    guardPosts: 0,
    keyholes: true,
    smallRelief: false,
    medallions: false,
    keyholeSides: 8,
    medallionSides: 8,
    bandSides: 12,
    cylinderSides: 16,
    cylinderRows: 1,
    slitCount: 12,
    petalRows: [0, 0.63, 1],
    petalCount: 12,
    petalBalls: false,
    domeSides: 32,
    domeRows: 6,
    mastSides: 8,
    baseLouverStep: 1.2,
  },
  street: {
    floorStep: 1,
    continuousShaft: true,
    groupedWindows: true,
    simpleBase: true,
    upperStep: 4,
    balconySides: 2,
    frames: true,
    sills: false,
    rails: false,
    guardPosts: 0,
    keyholes: true,
    smallRelief: true,
    medallions: true,
    keyholeSides: 16,
    medallionSides: 12,
    bandSides: 24,
    cylinderSides: 32,
    cylinderRows: 1,
    slitCount: 32,
    petalRows: [0, 0.63, 0.88, 1],
    petalCount: 24,
    petalBalls: false,
    domeSides: 64,
    domeRows: 10,
    mastSides: 16,
    baseLouverStep: 0.6,
  },
  closeup: {
    floorStep: 1,
    upperStep: 1,
    balconySides: 4,
    frames: true,
    sills: false,
    rails: false,
    guardPosts: 0,
    keyholes: true,
    smallRelief: true,
    medallions: true,
    keyholeSides: 32,
    medallionSides: 24,
    bandSides: 48,
    cylinderSides: 64,
    cylinderRows: 2,
    slitCount: 64,
    petalRows: [0, 0.63, 0.88, 1],
    petalCount: 48,
    petalBalls: false,
    domeSides: 64,
    domeRows: 12,
    mastSides: 32,
    baseLouverStep: 0.2,
  },
};
function buildSkyline(out) {
  out.detail = {
    ...settings.district,
    skyline: true,
    frames: false,
    bandSides: 8,
    cylinderSides: 8,
    cylinderRows: 1,
    slitCount: 8,
    petalCount: 8,
    petalRows: [0, 0.63, 1],
    petalBalls: false,
    domeSides: 16,
    domeRows: 4,
    mastSides: 8,
  };
  const ring = [
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, halfZ],
    [halfX, -halfZ],
  ];
  mappedCap(out, 'foundation', ring, 0, [0.44, 0.45, 0.43], [], true);
  for (const f of directions) {
    patch(out, f, -f.width / 2, -8.2, 0, 290);
    patch(out, f, 8.2, f.width / 2, 0, 290);
    patch(out, f, -8.2, 8.2, 0, 290, 'glass', blue, -0.5);
    patch(out, f, -f.width / 2, f.width / 2, 290, 350, 'glass', blue, -0.1);
    patch(out, f, -f.width / 2, -8, 290, 350);
    patch(out, f, 8, f.width / 2, 290, 350);
  }
  for (const y of [27.3, 124.5, 210, 290, 349.3]) ribbonBelt(out, y);
  mappedCap(out, 'metal', ring, 350, [0.48, 0.49, 0.48]);
  crown(out);
}
function build(out, name) {
  const means = {
    concrete: [0.710816, 0.710816, 0.681928],
    foundation: [0.710816, 0.710816, 0.681928],
    metal: [0.908889, 0.908889, 0.908889],
  };
  const target = {
    detail: settings[name],
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) => {
          if (name === 'skyline') out[k]('silhouette', 'palette:#ffffff', p, n, uv, c);
          else out[k](slot, r, p, n, uv, means[slot] ? c.map((v, i) => v / means[slot][i]) : c);
        },
      ]),
    ),
  };
  if (name === 'skyline') buildSkyline(target);
  else buildNative(target);
}
export const buildPrincessReviewedMaster = (out) => build(out, 'closeup');
export const buildPrincessSkyline = (out) => build(out, 'skyline');
export const buildPrincessDistrict = (out) => build(out, 'district');
export const buildPrincessStreet = (out) => build(out, 'street');
export const buildPrincessCloseup = (out) => build(out, 'closeup');
