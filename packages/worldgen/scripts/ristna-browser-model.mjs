/** Budgeted derivatives retain Ristna's jacketed eight-rib structure and white lantern cap. */
import { normalFor } from './authored-structure-mesh.mjs';
import { ring } from './lighthouse-expansion-models.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { buildRistnaDetail, radialPlate } from './ristna-detail-model.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  c = [0.63, 0.062, 0.033],
  steel = [0.56, 0.055, 0.028],
  white = [0.89, 0.88, 0.8];
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  metal: [0.908889, 0.908889, 0.908889],
  granite: [0.701109, 0.701109, 0.701109],
};
function tinted(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, p, n, uv, color) =>
        out[name](
          slot,
          ref,
          p,
          n,
          uv,
          color.map((v, i) => v * (means[slot]?.[i] ?? 1)),
        ),
    ]),
  );
}
function flatRing(out, slot, y, r, h, color, n) {
  lathe(
    out,
    slot,
    [
      [y, r],
      [y + h, r],
    ],
    color,
    n,
  );
}
function port(out, angle, y, w, h, r, district) {
  const o = transformed(out, angle);
  if (district)
    quad(
      o,
      'metal',
      [
        [-w / 2 - 0.018, y - 0.018, r - 0.004],
        [w / 2 + 0.018, y - 0.018, r - 0.004],
        [w / 2 + 0.018, y + h + 0.018, r - 0.004],
        [-w / 2 - 0.018, y + h + 0.018, r - 0.004],
      ],
      [0, 0, 1],
      steel,
    );
  quad(
    o,
    'glass',
    [
      [-w / 2, y, r],
      [w / 2, y, r],
      [w / 2, y + h, r],
      [-w / 2, y + h, r],
    ],
    [0, 0, 1],
    [0.06, 0.075, 0.064],
  );
}
function build(out, district) {
  const n = district ? 16 : 8;
  lathe(
    out,
    'granite',
    [
      [0, 2.77],
      [0.6, 2.77],
    ],
    [0.5, 0.48, 0.42],
    n,
  );
  lathe(
    out,
    'plaster',
    [
      [0.6, 1.16],
      [19.48, 1.16],
    ],
    c,
    n,
  );
  const edge = district
    ? [
        [0.61, 2.47],
        [1, 2.32],
        [1.6, 2.14],
        [2.4, 1.96],
        [3.5, 1.8],
        [5.1, 1.72],
        [18.4, 1.72],
        [18.74, 1.77],
        [19.03, 1.9],
        [19.25, 2.14],
        [19.36, 2.52],
      ]
    : [
        [0.61, 2.47],
        [3.5, 1.8],
        [5.1, 1.72],
        [18.4, 1.72],
        [19.36, 2.52],
      ];
  for (let i = 0; i < 8; i++)
    radialPlate(
      out,
      ((i + 0.5) * TAU) / 8,
      [[0.61, 1.06], ...edge, [19.48, 2.52], [19.48, 1.06]],
      0.22,
      'plaster',
      c,
    );
  for (const y of [5.65, 10.95, 16.23]) {
    if (district) ring(out, 'plaster', y, 1.15, 1.735, 0.18, c, n);
    else flatRing(out, 'plaster', y, 1.735, 0.18, c, n);
  }
  lathe(
    out,
    'metal',
    [
      [19.4, 1.16],
      [19.65, 2.49],
      [22.03, 2.49],
    ],
    steel,
    n,
  );
  for (let i = 0; i < 16; i++) port(out, (i * TAU) / 16, 21.14, 0.21, 0.43, 2.494, district);
  port(out, 0, 0.61, 0.78, 1.91, 1.164, false);
  for (let i = 0; i < 4; i++) port(out, 0, 3.74 + i * 4.55, 0.27, 0.53, 1.164, false);
  for (const [y, r, h] of [
    [22.02, 2.96, 0.11],
    [22.14, 3.01, 0.08],
  ]) {
    if (district) ring(out, 'metal', y, 1.12, r, h, steel, n);
    else flatRing(out, 'metal', y, r, h, steel, n);
  }
  const brackets = district ? 12 : 4;
  for (let i = 0; i < brackets; i++)
    radialPlate(
      out,
      ((i + 0.5) * TAU) / brackets,
      [
        [21.53, 2.46],
        [21.7, 2.68],
        [22.04, 2.95],
        [22.13, 2.95],
        [22.13, 2.46],
      ],
      0.075,
      'metal',
      steel,
    );
  lathe(
    out,
    'metal',
    [
      [22.22, 1.46],
      [23.7, 1.46],
    ],
    c,
    n,
  );
  for (const [y, r, h, posts] of [
    [22.22, 2.95, 0.96, district ? 16 : 8],
    [23.8, 1.79, 0.92, district ? 16 : 8],
  ]) {
    for (const yy of [y + 0.1, y + h]) {
      if (district) ring(out, 'metal', yy, r - 0.025, r + 0.026, 0.035, steel, n);
      else flatRing(out, 'metal', yy, r + 0.026, 0.035, steel, n);
    }
    for (let i = 0; i < posts; i++) {
      const a = (i * TAU) / posts;
      if (district) tube(out, 'metal', P(r, y, a), P(r, y + h, a), 0.021, steel, 4);
      else {
        const o = transformed(out, a);
        quad(
          o,
          'metal',
          [
            [-0.025, y, r],
            [0.025, y, r],
            [0.025, y + h, r],
            [-0.025, y + h, r],
          ],
          [0, 0, 1],
          steel,
        );
      }
    }
  }
  lathe(
    out,
    'glass',
    [
      [23.81, 1.43],
      [25.44, 1.43],
    ],
    [0.36, 0.49, 0.5],
    12,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12,
      o = transformed(out, a);
    quad(
      o,
      'metal',
      [
        [-0.021, 23.81, 1.434],
        [0.021, 23.81, 1.434],
        [0.021, 25.44, 1.434],
        [-0.021, 25.44, 1.434],
      ],
      [0, 0, 1],
      steel,
    );
    if (district)
      for (const side of [a, ((i + 1) * TAU) / 12])
        for (const [y0, y1] of [
          [24.31, 24.625],
          [24.625, 25.04],
        ])
          tube(
            out,
            'metal',
            P(1.44, y0, y0 === 24.625 ? a + TAU / 24 : side),
            P(1.44, y1, y1 === 24.625 ? a + TAU / 24 : side),
            0.012,
            steel,
            3,
          );
  }
  lathe(
    out,
    'metal',
    [
      [25.44, 1.59],
      [25.6, 1.53],
    ],
    white,
    n,
  );
  const steps = district ? 8 : 4,
    profile = Array.from({ length: steps + 1 }, (_, i) => [
      25.6 + 0.77 * Math.sin((i * Math.PI) / (2 * steps)),
      Math.max(0.028, 1.53 * Math.cos((i * Math.PI) / (2 * steps))),
    ]);
  lathe(out, 'metal', profile, white, n);
  lathe(
    out,
    'metal',
    [
      [26.34, 0.12],
      [26.57, 0.11],
      [26.85, 0.055],
      [27.2, 0.004],
    ],
    white,
    8,
  );
  box(out, 'metal', [-0.38, 26.99, -0.012], [-0.18, 27.13, 0.012], white);
  if (district) {
    tube(out, 'metal', [-0.39, 27.04, 0], [0.4, 27.04, 0], 0.012, white, 4);
    for (let i = 0; i < 4; i++)
      box(
        out,
        'granite',
        [-0.74, 0, 1.04],
        [0.74, 0.6 - i * 0.15, 2.15 + i * 0.27],
        [0.49, 0.48, 0.41],
      );
    for (const x of [-0.85, 0.85])
      box(out, 'granite', [x - 0.14, 0, 1.8], [x + 0.14, 0.83, 3.04], [0.53, 0.51, 0.44]);
  } else box(out, 'granite', [-0.99, 0, 1.04], [0.99, 0.6, 3.04], [0.49, 0.48, 0.41]);
}
export function buildRistnaSkyline(out) {
  build(tinted(out), false);
}
export function buildRistnaDistrict(out) {
  build(out, true);
}
export function buildRistnaStreet(out) {
  buildRistnaDetail(out, 0.2);
}
export function buildRistnaCloseup(out) {
  buildRistnaDetail(out, 0.7);
}
