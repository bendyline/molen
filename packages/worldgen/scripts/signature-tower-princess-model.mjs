/** Princess Tower: individual balconies, keyhole crown and two pointed ornamental rings. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  commonLimit,
  face,
  grid,
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
function panelJoints(out, f, x0, x1, y0, y1) {
  for (let y = y0 + 1.05; y < y1 - 0.1; y += 1.05)
    beam(
      out,
      'metal',
      point(f, x0, y, 0.02),
      point(f, x1, y, 0.02),
      0.022,
      0.022,
      [0.53, 0.53, 0.51],
    );
  const count = Math.ceil((x1 - x0) / 1.65);
  for (let i = 1; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    beam(
      out,
      'metal',
      point(f, x, y0, 0.02),
      point(f, x, y1, 0.02),
      0.022,
      0.024,
      [0.53, 0.53, 0.51],
    );
  }
}
function window(out, f, x0, x1, y0, y1, wide = false) {
  const w = x1 - x0,
    h = y1 - y0,
    inset = wide ? 0.28 : 0.55,
    lo = y0 + 0.72,
    hi = y1 - 0.4;
  patch(out, f, x0, x1, y0, lo);
  patch(out, f, x0, x1, hi, y1);
  patch(out, f, x0, x0 + inset, lo, hi);
  patch(out, f, x1 - inset, x1, lo, hi);
  panelJoints(out, f, x0, x0 + inset, y0, y1);
  panelJoints(out, f, x1 - inset, x1, y0, y1);
  const p = [
    point(f, x0 + inset, lo),
    point(f, x1 - inset, lo),
    point(f, x1 - inset, hi),
    point(f, x0 + inset, hi),
  ];
  const q = [
    point(f, x0 + inset, lo, -0.16),
    point(f, x1 - inset, lo, -0.16),
    point(f, x1 - inset, hi, -0.16),
    point(f, x0 + inset, hi, -0.16),
  ];
  for (let i = 0; i < 4; i++)
    face(out, 'concrete', [p[i], p[(i + 1) % 4], q[(i + 1) % 4], q[i]], cream);
  grid(out, q, blue, w > 3.5 ? 2.1 : 4, h, 0.047, trim, 'metal');
  beam(
    out,
    'metal',
    point(f, x0 + inset, lo, 0.08),
    point(f, x1 - inset, lo, 0.08),
    0.12,
    0.18,
    trim,
  );
}
function balcony(out, f, y0, y1, width) {
  const steps = 24,
    front = (t) => -0.95 + 0.82 * (1 - (2 * t - 1) ** 2);
  const plan = [
    point(f, -width / 2, y0, -2.35),
    ...Array.from({ length: steps + 1 }, (_, i) =>
      point(f, -width / 2 + (width * i) / steps, y0, front(i / steps)),
    ),
    point(f, width / 2, y0, -2.35),
  ].map(([x, _y, z]) => [x, z]);
  mappedSolid(out, 'concrete', plan, y0, y0 + 0.25, cream);
  patch(out, f, -width / 2, width / 2, y0 + 0.25, y1, 'glass', dark, -2.35);
  grid(
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
  for (const sign of [-1, 1]) {
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
    tube(out, 'metal', hi[0], hi[1], 0.035, trim, 6);
    if (i % 3 === 0) tube(out, 'metal', lo[0], hi[0], 0.028, trim, 6);
  }
  // The projecting white fascia gives each bowed balcony its horizontal rhythm.
  for (let i = 0; i < steps; i++)
    beam(
      out,
      'concrete',
      point(f, -width / 2 + (width * i) / steps, y0 + 0.17, front(i / steps)),
      point(f, -width / 2 + (width * (i + 1)) / steps, y0 + 0.17, front((i + 1) / steps)),
      0.2,
      0.26,
      cream,
    );
}
function ribbonBelt(out, y) {
  const p = [
    [-halfX, -halfZ],
    [-halfX, halfZ],
    [halfX, halfZ],
    [halfX, -halfZ],
  ];
  for (const [lo, hi, d, color] of [
    [y - 0.65, y - 0.35, 0.48, cream],
    [y - 0.35, y, 0.62, trim],
    [y, y + 0.45, 0.72, cream],
  ]) {
    const ring = p.map(([x, z]) => [x + Math.sign(x) * d, z + Math.sign(z) * d]);
    mappedSolid(out, 'concrete', ring, lo, hi, color);
  }
}
function keyhole(out, f) {
  const cy = 342,
    r = 3.15;
  for (let i = 0; i < 54; i++) {
    const a = ((-45 + i * 5) * Math.PI) / 180,
      b = ((-45 + (i + 1) * 5) * Math.PI) / 180;
    beam(
      out,
      'concrete',
      point(f, r * Math.cos(a), cy + r * Math.sin(a), 0.33),
      point(f, r * Math.cos(b), cy + r * Math.sin(b), 0.33),
      0.58,
      0.75,
      cream,
    );
  }
  for (const sign of [-1, 1])
    beam(
      out,
      'concrete',
      point(f, (sign * r) / Math.sqrt(2), 326, 0.33),
      point(f, (sign * r) / Math.sqrt(2), cy - r / Math.sqrt(2), 0.33),
      0.58,
      0.75,
      cream,
    );
  for (const sign of [-1, 1]) {
    beam(
      out,
      'concrete',
      point(f, 0, 348.5, 0.35),
      point(f, sign * 7.3, 345.3, 0.35),
      0.82,
      0.92,
      cream,
    );
    beam(
      out,
      'metal',
      point(f, 0, 349.06, 0.49),
      point(f, sign * 7.4, 345.74, 0.49),
      0.14,
      0.18,
      trim,
    );
    for (let j = 0; j < 4; j++)
      boxAt(out, f, sign * (3 + j * 0.86), 339.7, 0.32, 0.48, 1.1, 0.5, cream);
  }
  boxAt(out, f, 0, 348.7, 0.36, 0.82, 1.65, 0.9, cream);
  for (const sign of [-1, 1]) {
    const x = sign * (f.width / 2 - 5.1),
      y = 346.2,
      n = 40;
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
      beam(
        out,
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
  loft(out, slot, [radialRing(y0, r0, r0, 128), radialRing(y1, r1, r1, 128)], color);
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
  const rows = [
    ...new Set([0, 0.63, 0.88, 1, ...Array.from({ length: 15 }, (_, j) => (j + 1) / 16)]),
  ].sort((a, b) => a - b);
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
    sphere(out, 'metal', p(0, 1.02, 0.1), [0.115, 0.115, 0.115], cream, 10, 6);
  }
}
function crown(out) {
  const r = 17.8;
  circularBand(out, 349.7, 350.35, 19.4, 19.4);
  cylinderGlazing(out, r, 350.35, 356.9, 80, 2);
  circularBand(out, 356.9, 357.3, 18.0, 18.65);
  circularBand(out, 357.3, 357.6, 18.65, 18.65);
  slitDrum(out, 18.25, 357.6, 361.8, 64);
  circularBand(out, 361.8, 362.25, 18.4, 18.75);
  cylinderGlazing(out, 17.5, 362.25, 365.15, 64);
  crownPetals(out, 18.3, 362.25, 2.9, 48, 1.45);
  circularBand(out, 365.15, 366.1, 19.4, 19.4);
  cylinderGlazing(out, 15.6, 366.1, 372.0, 72, 2);
  slitDrum(out, 15.75, 372.0, 374.7, 64);
  circularBand(out, 374.7, 375.05, 16, 16.4);
  crownPetals(out, 15.8, 375.05, 1.9, 48, 1.2);
  // A closed striped ellipsoidal dome: completed skin, not the photographed construction gaps.
  const segments = 128,
    rows = 28;
  const at = (i, j) => {
    const a = (-i * Math.PI * 2) / segments,
      t = ((j / rows) * Math.PI) / 2,
      rr = 3.3 + (16.2 - 3.3) * Math.cos(t);
    return [rr * Math.cos(a), 377 + 15 * Math.sin(t), rr * Math.sin(a)];
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < segments; i++) {
      const reflective = Math.floor(i / 4) % 2 === 0;
      face(
        out,
        reflective ? 'metal' : 'glass',
        [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)],
        reflective ? [0.77, 0.77, 0.73] : [0.11, 0.19, 0.22],
      );
      if (i % 4 === 0) tube(out, 'metal', at(i, j), at(i, j + 1), 0.035, trim, 6);
      if (j % 4 === 0) tube(out, 'metal', at(i, j), at(i + 1, j), 0.025, trim, 6);
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
    ].map(([y, rr]) => radialRing(y, rr, rr, 64)),
    cream,
  );
  circularBand(out, 400.5, 401.05, 0.82, 0.86, trim);
  loft(out, 'metal', [radialRing(401, 0.46, 0.46, 48), radialRing(413.4, 0.21, 0.21, 48)], cream);
  circularBand(out, 412.85, 413.2, 0.44, 0.44, trim);
  sphere(out, 'metal', [0, 413.62, 0], [0.18, 0.22, 0.18], cream, 20, 10);
  tube(out, 'metal', [0, 413.8, 0], [0, 414, 0], 0.055, trim, 8);
}
function base(out) {
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
          for (let h = y + 1.04; h < y + 3.75; h += 0.2)
            beam(
              out,
              'metal',
              point(f, a + 0.24, h, -0.05),
              point(f, b - 0.24, h, -0.05),
              0.075,
              0.12,
              trim,
            );
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
export function buildPrincess(out) {
  base(out);
  for (const f of directions) {
    const width = 16.4,
      pitch = (290 - 27.75) / 74;
    for (let j = 0; j < 74; j++) {
      const y0 = 27.75 + j * pitch,
        y1 = 27.75 + (j + 1) * pitch;
      balcony(out, f, y0, y1, width);
      for (const sign of [-1, 1]) {
        const start = sign < 0 ? -f.width / 2 : width / 2,
          end = sign < 0 ? -width / 2 : f.width / 2;
        const count = 3;
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
    for (let j = 0; j < 16; j++) {
      const y0 = 290 + j * 3.75,
        y1 = y0 + 3.75,
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
    keyhole(out, f);
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
export const princessStudy = {
  id: 'N0196',
  key: 'princess_tower',
  wikidataId: 'Q19492',
  title: 'Princess Tower',
  height: 414,
  build: buildPrincess,
  brief:
    'Individually modeled Dubai residential tower with inset bowed balconies, cream window piers, checkerboard upper glazing, raised keyhole-and-pediment crowns, two pointed ornamental rings and a striped dome with flared spire.',
  sourceFacts: {
    architect: 'Eng. Adnan Saffarini Office',
    completed: 2012,
    architecturalHeightMeters: 413.4,
    tipHeightMeters: 414,
    highestOccupiedFloorMeters: 356.9,
    floorsAboveGround: 101,
    basements: 6,
    apartments: 763,
    crownSupplier: 'Techno Steel:1,100+ tonnes of structural/architectural steel and floor decking',
    domeRoofMeters: 392,
    domeDatumSource: 'The Skyscraper Museum, original TEN TOPS exhibition research',
  },
  reconstruction: {
    shaft:
      'Mapped40.003×37.743m signed shaft envelope, four bowed balcony stacks with individual closed slabs and open guards, recessed windows and continuous cream piers. Seventy-four lower balcony courses and sixteen upper crosscut courses reconstruct the photographed floor rhythm.',
    crown:
      'Keyhole-shaped window surrounds, sloped pediments and round medallions are modeled on all four upper facades. Two unequal circular glazed/slit-window stages carry separate outward-curving pointed petals; the completed dome has alternating reflective/dark strips, raised meridians and a flared mast collar.',
    base: 'Six reconstructed podium courses retain broad parking louvers and a distinct southwest glazed entrance with doors, shallow pediment and individual panel joints. The signed entrance side is inferred from the KONE street photograph and identifiable neighboring buildings; no independent podium parcel was substituted for the shaft.',
  },
  refs: [
    'https://accgroup.com/our_projects/princess-tower-dubai/',
    'https://www.kone.ie/Images/factsheet-kone-princess-tower-references_tcm258-9016.pdf',
    'https://www.technosteel-uae.com/wp-content/uploads/2021/05/Structural-Steel-_PQ.pdf',
    'https://technosteelconstruction-uae.com/princess-tower',
    'https://www.skyscrapercenter.com/building/id/206',
    'https://old.skyscraper.org/EXHIBITIONS/TEN_TOPS/date.php',
    'https://www.openstreetmap.org/way/186351092',
  ],
  nativeAxes: { up: '+Y', longAxis: '+X northeast', shortAxis: '+Z southeast' },
  geographic: (m) => ({
    heading: m.heading,
    notes:
      'Exact-QID shaft way186351092 and independent centered circular crown/mast parts preserve the rectangular axes and tower center. Native+X points northeast and+Z southeast. Fourfold balcony/crown geometry follows these axes. The map357m shaft tag is distinguished from413.4m architectural/414m tip height; groundY0 is the entry datum. Southwest/native-X entrance is a KONE photo-context inference using Elite Residence and Le Reve neighbors; precise door offsets remain reconstructed.',
  }),
  limitations: [
    commonLimit,
    'Intermediate floor/course datums, balcony bow and guard dimensions, panel/window cadence, upper keyhole relief, pointed crown petal count and section, dome gore spacing and small entry hardware are reconstructed from KONE completed/construction photographs and the crown fabricator records. The final dome is closed; temporary construction gaps and hoists are excluded. Small entrance facade phase remains approximate; surrounding streets, neighboring buildings, interior fit-out and changing signage are excluded.',
  ],
  camera: { position: [335, 232, 285], lookAt: [0, 207, 0], fov: 40 },
  qaCameras: [
    { name: 'bowed-balcony-stack', position: [67, 139, 33], lookAt: [18, 132, 0] },
    { name: 'open-balcony-detail', position: [35, 113, 10], lookAt: [19, 110, 0] },
    { name: 'recessed-window-piers', position: [38, 131, -13], lookAt: [20, 128, -12] },
    { name: 'upper-crosscut-glazing', position: [71, 323, 52], lookAt: [0, 321, 0] },
    { name: 'keyhole-and-pediment', position: [44, 347, 17], lookAt: [20, 343, 0] },
    { name: 'two-circular-crowns', position: [53, 375, 38], lookAt: [0, 366, 0] },
    { name: 'pointed-crown-petals', position: [27, 365, 15], lookAt: [14, 364, 8] },
    { name: 'striped-dome', position: [43, 397, 29], lookAt: [0, 385, 0] },
    { name: 'flared-neck-and-spire', position: [19, 411, 14], lookAt: [0, 401, 0] },
    { name: 'podium-entrances', position: [-57, 17, 45], lookAt: [0, 13, 0] },
    { name: 'ground-door-detail', position: [-34, 5, -9], lookAt: [-20, 4, 0] },
    { name: 'far-marina-profile', position: [410, 112, 235], lookAt: [0, 207, 0] },
  ],
};
