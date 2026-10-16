/** N0574 complete medium-fi reconstruction; the original detailed heritage recipe is preserved. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  cornice,
  deform,
  frame,
  column as profiledColumn,
  face as rawFace,
  transform,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  red = [0.64, 0.36, 0.23],
  trim = [0.68, 0.4, 0.27],
  green = [0.18, 0.35, 0.26],
  dark = [0.075, 0.085, 0.085],
  gold = [0.85, 0.66, 0.25],
  tau = Math.PI * 2;
function face(out, slot, points, color) {
  const triangles = [points.slice(0, 3), [points[0], points[2], points[3]]];
  const valid = triangles.map(([a, b, c]) => {
    const u = b.map((v, i) => v - a[i]),
      v = c.map((v, i) => v - a[i]);
    return (
      Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) >
      0.000001
    );
  });
  if (valid.every(Boolean)) rawFace(out, slot, points, color);
  else
    for (let i = 0; i < 2; i++)
      if (valid[i])
        out.addTriangle(
          slot,
          ref,
          triangles[i],
          normalFor(...triangles[i]),
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          color,
        );
}
export const soyembikaHeading = -1.335984319155;
const e = 1.98 / Math.sqrt(2) / 58;
export const soyembikaLean = [
  Math.cos(soyembikaHeading) * e + Math.sin(soyembikaHeading) * e,
  Math.sin(soyembikaHeading) * e - Math.cos(soyembikaHeading) * e,
];
// Full wall with closed recessed apertures; no black planes laid over uncut masonry.
function wall(out, w, y0, y1, z, holes, n) {
  const xs = [
      ...new Set([-w / 2, w / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2])]),
    ].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y, h.top])])].sort((a, b) => a - b);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < xs.length - 1; i++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (holes.some((h) => x > h.x - h.w / 2 && x < h.x + h.w / 2 && y > h.y && y < h.top))
        continue;
      face(
        out,
        'brick',
        [
          [xs[i], ys[j], z],
          [xs[i + 1], ys[j], z],
          [xs[i + 1], ys[j + 1], z],
          [xs[i], ys[j + 1], z],
        ],
        red,
      );
    }
  for (const h of holes) {
    const r = h.w / 2,
      depth = h.depth ?? 0.45,
      back = z - depth,
      spring = h.spring ?? h.top,
      rise = h.rise ?? 0;
    if (h.back !== false)
      face(
        out,
        h.slot ?? 'shadow',
        [
          [h.x - r, h.y, back],
          [h.x + r, h.y, back],
          [h.x + r, h.top, back],
          [h.x - r, h.top, back],
        ],
        h.color ?? dark,
      );
    for (const sign of h.circle ? [] : [-1, 1])
      face(
        out,
        'brick',
        sign > 0
          ? [
              [h.x + sign * r, h.y, z],
              [h.x + sign * r, h.y, back],
              [h.x + sign * r, spring, back],
              [h.x + sign * r, spring, z],
            ].reverse()
          : [
              [h.x + sign * r, h.y, z],
              [h.x + sign * r, h.y, back],
              [h.x + sign * r, spring, back],
              [h.x + sign * r, spring, z],
            ],
        red,
      );
    // Both jambs face the passage.
    // Explicit curve segments also close the spandrel above every recess.
    for (let k = 0; k < n; k++) {
      const a = -r + (h.w * k) / n,
        b = -r + (h.w * (k + 1)) / n,
        ya = spring + rise * Math.sqrt(Math.max(0, 1 - (a / r) ** 2)),
        yb = spring + rise * Math.sqrt(Math.max(0, 1 - (b / r) ** 2));
      if (h.top > Math.max(ya, yb))
        face(
          out,
          'brick',
          [
            [h.x + a, ya, z],
            [h.x + b, yb, z],
            [h.x + b, h.top, z],
            [h.x + a, h.top, z],
          ],
          red,
        );
      face(
        out,
        'brick',
        [
          [h.x + a, ya, back],
          [h.x + b, yb, back],
          [h.x + b, yb, z],
          [h.x + a, ya, z],
        ],
        trim,
      );
      if (h.circle) {
        const lowA = 2 * spring - ya,
          lowB = 2 * spring - yb;
        face(
          out,
          'brick',
          [
            [h.x + a, h.y, z],
            [h.x + b, h.y, z],
            [h.x + b, lowB, z],
            [h.x + a, lowA, z],
          ],
          red,
        );
        face(
          out,
          'brick',
          [
            [h.x + a, lowA, z],
            [h.x + b, lowB, z],
            [h.x + b, lowB, back],
            [h.x + a, lowA, back],
          ],
          trim,
        );
      }
    }
    face(
      out,
      'brick',
      [
        [h.x - r, h.y, z],
        [h.x + r, h.y, z],
        [h.x + r, h.y, back],
        [h.x - r, h.y, back],
      ],
      trim,
    );
  }
}
function ring(out, slot, x, y, z, r, n, color) {
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n;
    beam(
      out,
      slot,
      [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
      [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
      0.09,
      0.09,
      color,
    );
  }
}
function detail(destination, mode) {
  const far = mode === 'skyline',
    district = mode === 'district',
    near = !far && !district,
    n = { skyline: 4, district: 6, street: 12, closeup: 24, master: 40 }[mode];
  const out = deform(destination, ([x, y, z]) => [
    x + y * soyembikaLean[0],
    y,
    z + y * soyembikaLean[1],
  ]);
  function col(o, x, z, y0, y1, r) {
    if (far || district) box(o, 'brick', [x - r, y0, z - r], [x + r, y1, z + r], trim);
    else
      profiledColumn(
        o,
        'brick',
        x,
        z,
        y0,
        y1,
        r,
        trim,
        mode === 'master' ? 24 : mode === 'closeup' ? 12 : 6,
      );
  }
  const halfW = 8.72,
    halfD = 6.13;
  // Mapped rectangular lower envelope; the previously assumed sqrt(140) square does not fit.
  // Two closed pylons share a true 6.9m vaulted passage, not a solid box across the opening.
  for (const s of [-1, 1])
    box(
      out,
      'brick',
      [s < 0 ? -halfW + 0.6 : 3.45, 0, -halfD + 0.4],
      [s < 0 ? -3.45 : halfW - 0.6, 11.6, halfD - 0.4],
      red,
    );
  for (let side = 0; side < 2; side++) {
    const o = transform(out, side * Math.PI);
    wall(
      o,
      halfW * 2,
      0,
      11.6,
      halfD,
      [{ x: 0, w: 6.9, y: 0, spring: 6, rise: 3.45, top: 11.6, depth: halfD, back: false }],
      n,
    );
    for (const x of [-7.3, -4.5, 4.5, 7.3]) col(o, x, halfD + 0.18, 0.15, 10.5, 0.24);
    if (!far) {
      for (let k = -6; k <= 6; k++)
        box(
          o,
          'metal',
          [k * 0.5 - 0.02, 0.2, halfD - 0.22],
          [k * 0.5 + 0.02, 6, halfD - 0.18],
          [0.16, 0.17, 0.14],
        );
      for (const y of [1.1, 3.3, 5.8])
        box(
          o,
          'metal',
          [-3.2, y, halfD - 0.24],
          [3.2, y + 0.055, halfD - 0.14],
          [0.16, 0.17, 0.14],
        );
      ring(o, 'metal', -1.35, 4.2, halfD - 0.12, 0.62, n * 2, gold);
      for (let k = 0; k < n * 2; k++) {
        const a = (-0.35 + (k / (n * 2)) * 1.7) * Math.PI,
          b = (-0.35 + ((k + 1) / (n * 2)) * 1.7) * Math.PI;
        beam(
          o,
          'metal',
          [1.3 + 0.62 * Math.cos(a), 4.2 + 0.62 * Math.sin(a), halfD - 0.12],
          [1.3 + 0.62 * Math.cos(b), 4.2 + 0.62 * Math.sin(b), halfD - 0.12],
          0.07,
          0.07,
          gold,
        );
      }
    }
  }
  for (let side = 0; side < 2; side++) {
    const o = transform(out, side === 0 ? Math.PI / 2 : -Math.PI / 2),
      vent = {
        x: 0,
        w: 0.8,
        y: 9.55,
        spring: 9.95,
        rise: 0.4,
        top: 10.35,
        depth: 0.4,
        circle: true,
      };
    wall(
      o,
      halfD * 2,
      0,
      11.6,
      halfW,
      [
        {
          x: 0,
          w: 0.9,
          y: 0.15,
          spring: 2.1,
          rise: 0.25,
          top: 2.5,
          depth: 0.45,
          slot: 'metal',
          color: [0.15, 0.18, 0.17],
        },
        ...(far ? [] : [vent]),
      ],
      n,
    );
    if (near) frame(o, 'brick', 0, 0.15, 0.9, 2.35, halfW + 0.02, 0.12, trim);
  }
  // Northern structural reinforcement is retained, proportionally interpreted, not surveyed.
  // +X maps north/slightly east; keep its center clear of the small stair entrance.
  loft(
    out,
    'brick',
    [
      [
        [8.71, 0, -4.8],
        [9.03, 0, -4.8],
        [9.03, 0, -2.6],
        [8.71, 0, -2.6],
      ].reverse(),
      [
        [8.71, 8.3, -4.8],
        [8.77, 8.3, -4.8],
        [8.77, 8.3, -2.6],
        [8.71, 8.3, -2.6],
      ].reverse(),
    ],
    red,
  );
  cornice(out, 'brick', 17.44, 12.26, 11.6, 0.4, trim);
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      h = side % 2 ? halfD : halfW,
      z = side % 2 ? halfW : halfD;
    box(o, 'brick', [-h, 12, z - 0.25], [h, 13.05, z], red);
    if (near)
      for (let k = 0; k < Math.floor((h * 2) / 0.95); k++)
        frame(o, 'brick', -h + 0.6 + k * 0.95, 12.24, 0.62, 0.5, z + 0.02, 0.09, trim);
  }
  for (const [w, y0, y1] of [
    [13.05, 12, 17.6],
    [9.8, 18, 23.6],
  ]) {
    const r = w / 2;
    const inset = far ? 0 : 0.5;
    box(out, 'brick', [-r + inset, y0, -r + inset], [r - inset, y1, r - inset], red);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        holes = [
          { x: 0, w: 1.6, y: y0 + 0.75, spring: y0 + 3, rise: 0.36, top: y0 + 3.6, depth: 0.4 },
        ];
      if (far)
        face(
          o,
          'shadow',
          [
            [-0.8, y0 + 0.75, r + 0.012],
            [0.8, y0 + 0.75, r + 0.012],
            [0.8, y0 + 3.6, r + 0.012],
            [-0.8, y0 + 3.6, r + 0.012],
          ],
          dark,
        );
      else wall(o, w, y0, y1, r, holes, n);
      if (near) {
        frame(o, 'brick', 0, y0 + 0.65, 1.8, 3.12, r + 0.02, 0.13, trim);
        for (const x of [-w * 0.31, w * 0.31])
          frame(o, 'brick', x, y0 + 0.8, 1.45, 3.2, r + 0.025, 0.17, trim);
      }
    }
    cornice(out, 'brick', w + 0.12, w + 0.12, y1, 0.4, trim);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2);
      box(o, 'brick', [-r - 0.13, y1 + 0.4, r - 0.18], [r + 0.13, y1 + 0.96, r + 0.13], red);
      const pitch = mode === 'street' ? 0.7 : 0.35;
      if (near)
        for (let k = 0; k < Math.floor(w / pitch); k++)
          box(
            o,
            'brick',
            [-r + k * pitch, y1 + 0.4, r + 0.14],
            [-r + k * pitch + 0.09, y1 + 0.96, r + 0.23],
            trim,
          );
    }
  }
  for (const [y0, y1, radius, arched] of [
    [24, 29.6, 4.15, false],
    [30, 35.6, 3.65, true],
    [45, 49, 1.53, true],
  ]) {
    const apothem = radius * Math.cos(Math.PI / 8),
      w = 2 * radius * Math.sin(Math.PI / 8),
      small = radius < 2;
    if (!far)
      loft(
        out,
        'brick',
        [
          radialRing(y0, radius - 0.45, radius - 0.45, 8, [0, 0], Math.PI / 8),
          radialRing(y1, radius - 0.45, radius - 0.45, 8, [0, 0], Math.PI / 8),
        ],
        red,
      );
    for (let side = 0; side < 8; side++) {
      const o = transform(out, (side * Math.PI) / 4),
        opening = {
          x: 0,
          w: small ? 0.62 : arched ? 1.25 : 1.02,
          y: y0 + 0.6,
          spring: y1 - 1.2,
          rise: arched ? (small ? 0.28 : 0.6) : 0.08,
          top: y1 - 0.5,
          depth: 0.4,
        };
      if (far) {
        face(
          o,
          'shadow',
          [
            [-opening.w / 2, opening.y, apothem + 0.012],
            [opening.w / 2, opening.y, apothem + 0.012],
            [opening.w / 2, opening.top, apothem + 0.012],
            [-opening.w / 2, opening.top, apothem + 0.012],
          ],
          dark,
        );
      } else wall(o, w, y0, y1, apothem, [opening], n);
      if (near)
        for (const x of [-w / 2 + 0.13, w / 2 - 0.13])
          col(o, x, apothem + 0.08, y0 + 0.1, y1 - 0.2, small ? 0.07 : 0.13);
    }
    if (far)
      loft(
        out,
        'brick',
        [
          radialRing(y0, radius, radius, 8, [0, 0], Math.PI / 8),
          radialRing(y1, radius, radius, 8, [0, 0], Math.PI / 8),
        ],
        red,
      );
    loft(
      out,
      'brick',
      [
        radialRing(y1, radius + 0.12, radius + 0.12, 8, [0, 0], Math.PI / 8),
        radialRing(y1 + 0.3, radius + 0.24, radius + 0.24, 8, [0, 0], Math.PI / 8),
      ],
      trim,
    );
    if (!small)
      loft(
        out,
        'metal',
        [
          radialRing(y1 + 0.3, radius + 0.29, radius + 0.29, 8, [0, 0], Math.PI / 8),
          radialRing(y1 + 0.4, radius + 0.29, radius + 0.29, 8, [0, 0], Math.PI / 8),
        ],
        green,
      );
  }
  loft(
    out,
    'brick',
    [
      radialRing(36, 3.31, 3.31, 8, [0, 0], Math.PI / 8),
      radialRing(45, 1.53, 1.53, 8, [0, 0], Math.PI / 8),
    ],
    red,
  );
  if (!far)
    for (let k = 0; k < 8; k++) {
      const a = (k * tau) / 8 + Math.PI / 8;
      beam(
        out,
        'brick',
        [3.34 * Math.cos(a), 36, 3.34 * Math.sin(a)],
        [1.56 * Math.cos(a), 45, 1.56 * Math.sin(a)],
        0.13,
        0.13,
        trim,
      );
    }
  // Four closed round tent vents. Small silhouette openings average to dark circles at far LOD.
  for (let side = 0; side < 4; side++) {
    const o = transform(out, (side * Math.PI) / 2),
      y = 39.7,
      z = (3.31 - ((y - 36) / 9) * (3.31 - 1.53)) * Math.cos(Math.PI / 8) + 0.02;
    const p = (a) => [
      Math.cos(a) * 0.19,
      y + Math.sin(a) * 0.19,
      z - ((Math.sin(a) * 0.19 * (3.31 - 1.53)) / 9) * Math.cos(Math.PI / 8),
    ];
    for (let k = 0; k < (far ? 4 : n); k++) {
      const a = (k * tau) / (far ? 4 : n),
        b = ((k + 1) * tau) / (far ? 4 : n),
        points = [[0, y, z], p(a), p(b)];
      o.addTriangle(
        'shadow',
        ref,
        points,
        normalFor(...points),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        dark,
      );
    }
  }
  loft(
    out,
    'metal',
    [
      radialRing(49, 1.89, 1.89, 8, [0, 0], Math.PI / 8),
      radialRing(56.95, 0.07, 0.07, 8, [0, 0], Math.PI / 8),
    ],
    green,
  );
  if (far) box(out, 'metal', [-0.13, 57.04, -0.13], [0.13, 57.28, 0.13], gold);
  else sphere(out, 'metal', [0, 57.16, 0], [0.19, 0.22, 0.19], gold, n * 2, Math.max(4, n));
  box(out, 'metal', [-0.035, 57.2, -0.035], [0.035, 57.55, 0.035], gold);
  for (let k = 0; k < (far ? 6 : n * 2); k++) {
    const count = far ? 6 : n * 2,
      a = (-0.33 + (k / count) * 1.66) * Math.PI,
      b = (-0.33 + ((k + 1) / count) * 1.66) * Math.PI;
    beam(
      out,
      'metal',
      [0.34 * Math.cos(a), 57.66 + 0.34 * Math.sin(a), 0],
      [0.34 * Math.cos(b), 57.66 + 0.34 * Math.sin(b), 0],
      0.045,
      0.04,
      gold,
    );
  }
}
export function buildSoyembikaReviewed(out) {
  detail(out, 'master');
}
export function buildSoyembikaCloseup(out) {
  detail(out, 'closeup');
}
export function buildSoyembikaStreet(out) {
  detail(out, 'street');
}
export function buildSoyembikaDistrict(out) {
  detail(out, 'district');
}
// Baked canonical linear graph means, supplied by the shared library rather than private textures.
const means = {
  brick: [0.620345, 0.549823, 0.504963],
  metal: [0.908889, 0.908889, 0.908889],
  shadow: [1, 1, 1],
};
export function buildSoyembikaSkyline(destination) {
  detail(
    {
      addQuad: (s, _r, p, n, u, c) =>
        destination.addQuad(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addTriangle: (s, _r, p, n, u, c) =>
        destination.addTriangle(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
      addConvexPolygon: (s, _r, p, n, u, c) =>
        destination.addConvexPolygon(
          'body',
          ref,
          p,
          n,
          u,
          c.map((v, i) => v * means[s][i]),
        ),
    },
    'skyline',
  );
}
