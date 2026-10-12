/** Whole Grunewald tower at distance: terrain terrace, three east stair flights,
 * Gothic open halls, four lower turrets, tapered shaft and steep conical crown.
 * Shared graph means are applied only to the untextured skyline level.
 */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { lathe, panel } from './lighthouse-models.mjs';
import { box, tube } from './structure-mesh.mjs';

export { buildGrunewaldCloseup } from './grunewald-detail-model.mjs';

const brick = [0.66, 0.33, 0.23],
  trim = [0.61, 0.29, 0.2],
  porphyry = [0.55, 0.42, 0.37],
  pale = [0.87, 0.84, 0.72],
  iron = [0.095, 0.105, 0.095];
const rect = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];
const means = {
  stone: [0.790898, 0.790898, 0.790898],
  brick: [0.620345, 0.549823, 0.504963],
  brickroof: [0.620345, 0.549823, 0.504963],
  metal: [0.908889, 0.908889, 0.908889],
  plaster: [0.856015, 0.827728, 0.727643],
  marble: [0.916083, 0.916083, 0.916083],
  mosaic: [0.733066, 0.763993, 0.714847],
};
export function buildGrunewaldSkyline(out) {
  build(out, 'skyline');
}
export function buildGrunewaldDistrict(out) {
  build(out, 'district');
}
export function buildGrunewaldStreet(out) {
  build(out, 'street');
}

function build(destination, mode) {
  const street = mode === 'street',
    sky = mode === 'skyline',
    n = sky ? 8 : street ? 24 : 12;
  const out = sky
    ? Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
          k,
          (s, r, p, normal, u, c) =>
            destination[k](
              s,
              r,
              p,
              normal,
              u,
              c.map((v, i) => v * (means[s]?.[i] ?? 1)),
            ),
        ]),
      )
    : destination;
  function rail(o, w, y, z) {
    if (sky) {
      box(o, 'brick', [-w / 2, y, z - 0.17], [w / 2, y + 0.65, z + 0.08], trim);
      return;
    }
    box(o, 'brick', [-w / 2, y, z - 0.17], [w / 2, y + 0.16, z + 0.08], trim);
    box(o, 'brick', [-w / 2, y + 0.91, z - 0.17], [w / 2, y + 1.09, z + 0.08], trim);
    const count = Math.floor(w / 0.85),
      step = w / count;
    for (let j = 0; j < count; j++) {
      const x = -w / 2 + (j + 0.5) * step;
      if (street) {
        box(
          o,
          'brick',
          [x - step / 2, y + 0.16, z - 0.17],
          [x - step / 2 + 0.11, y + 0.92, z + 0.08],
          trim,
        );
        for (const [dx, dy] of [
          [0, -0.19],
          [0, 0.19],
          [-0.19, 0],
          [0.19, 0],
        ]) {
          const p = radialRing(0, 0.19, 0.19, 8);
          for (let i = 0; i < 8; i++) {
            const a = p[i],
              b = p[(i + 1) % 8];
            triangle(
              o,
              'plaster',
              [
                [x + dx, y + 0.55 + dy, z - 0.155],
                [x + dx + a[0], y + 0.55 + dy + a[2], z - 0.155],
                [x + dx + b[0], y + 0.55 + dy + b[2], z - 0.155],
              ],
              pale,
            );
          }
        }
      } else
        panel(o, 'plaster', x - step * 0.32, x + step * 0.32, y + 0.28, y + 0.77, z + 0.085, pale);
    }
  }
  function arch(
    o,
    w,
    y0,
    spring,
    rise,
    top,
    z,
    depth,
    slot = 'brick',
    color = brick,
    totalWidth = w + 1.44,
  ) {
    const r = w / 2,
      segments = sky ? 2 : street ? 12 : 4,
      Y = (x) =>
        spring +
        (rise * Math.sqrt(Math.max(0, 4 - Math.pow(Math.abs(x) / r + 1, 2)))) / Math.sqrt(3);
    for (let i = 0; i < segments; i++) {
      const a = -r + (w * i) / segments,
        b = -r + (w * (i + 1)) / segments,
        ya = Y(a),
        yb = Y(b);
      face(
        o,
        slot,
        [
          [a, ya, z],
          [b, yb, z],
          [b, top, z],
          [a, top, z],
        ],
        color,
      );
      if (!sky)
        face(
          o,
          slot,
          [
            [a, ya, z - depth],
            [b, yb, z - depth],
            [b, yb, z],
            [a, ya, z],
          ],
          color,
        );
    }
    for (const s of [-1, 1]) {
      box(
        o,
        slot,
        [s < 0 ? -totalWidth / 2 : r, y0, z - depth],
        [s < 0 ? -r : totalWidth / 2, top, z],
        color,
      );
    }
  }
  function cone(o, x, z, y0, y1, r) {
    loft(
      o,
      'brickroof',
      [radialRing(y0, r, r, n, [x, z]), radialRing(y1, 0.05, 0.05, n, [x, z])],
      [0.62, 0.31, 0.215],
    );
  }
  function smallFigure(o) {
    box(o, 'marble', [-0.72, 4.35, -0.72], [0.72, 6.4, 0.72], [0.8, 0.79, 0.73]);
    for (const x of [-0.2, 0.2])
      box(o, 'marble', [x - 0.11, 6.4, -0.1], [x + 0.11, 7.31, 0.1], [0.84, 0.82, 0.75]);
    loft(
      o,
      'marble',
      [radialRing(7.22, 0.43, 0.24, 8), radialRing(8.34, 0.43, 0.22, 8)],
      [0.84, 0.82, 0.75],
    );
    sphere(o, 'marble', [0, 8.61, 0.02], [0.18, 0.25, 0.17], [0.84, 0.82, 0.75], 8, 4);
    beam(o, 'marble', [-0.38, 8.25, 0], [-0.49, 7.81, 0.14], 0.2, 0.2, [0.84, 0.82, 0.75]);
    beam(o, 'marble', [-0.49, 7.81, 0.14], [-0.13, 7.81, 0.3], 0.18, 0.18, [0.84, 0.82, 0.75]);
    beam(o, 'marble', [0.38, 8.25, 0], [0.52, 7.53, 0.04], 0.19, 0.18, [0.84, 0.82, 0.75]);
  }
  // Shared terrain datum, exact four-metre podium, stairs only on the entrance facade.
  box(out, 'stone', [-12.05, 0, -12.05], [12.05, 3.85, 12.05], porphyry);
  box(out, 'stone', [-12.3, 3.85, -12.3], [12.3, 4, 12.3], porphyry);
  const steps = sky ? 4 : street ? 24 : 8;
  for (let j = 0; j < steps; j++) {
    const z = 19.6 - (7.6 * j) / steps,
      y = (4 * (j + 1)) / steps;
    box(out, 'stone', [-2.75, 0, z - 7.6 / steps - 0.02], [2.75, y, z], porphyry);
  }
  for (const s of [-1, 1]) {
    beam(out, 'stone', [s * 3.03, 0.9, 19.6], [s * 3.03, 4.9, 12], 0.24, 0.34, porphyry);
    for (let j = 0; j < steps; j++) {
      const x0 = 3.1 + (7.44 * j) / steps,
        x1 = x0 + 7.44 / steps + 0.01;
      box(
        out,
        'stone',
        [s < 0 ? -x1 : x0, 0, 12.22],
        [s < 0 ? -x0 : x1, 4 - (4 * j) / steps, 14.7],
        porphyry,
      );
    }
    beam(out, 'stone', [s * 3.1, 4.9, 14.8], [s * 10.5, 0.9, 14.8], 0.3, 0.28, porphyry);
  }
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    if (sky) {
      box(t, 'stone', [-12, 4, 11.95], [12, 5, 12.25], porphyry);
    } else
      for (const [x0, x1] of side === 0
        ? [
            [-12, -3.1],
            [3.1, 12],
          ]
        : [[-12, 12]]) {
        box(t, 'stone', [x0, 4, 11.95], [x1, 4.16, 12.25], porphyry);
        box(t, 'stone', [x0, 4.92, 11.95], [x1, 5.12, 12.25], porphyry);
        const count = Math.floor((x1 - x0) / 0.9);
        for (let j = 0; j <= count; j++) {
          const x = x0 + ((x1 - x0) * j) / count;
          box(t, 'stone', [x - 0.065, 4.1, 11.98], [x + 0.065, 4.98, 12.2], porphyry);
        }
      }
  }
  for (const x of [-12, 12])
    for (const z of [-12, 12]) {
      if (sky) box(out, 'stone', [x - 0.75, 0, z - 0.75], [x + 0.75, 6.22, z + 0.75], porphyry);
      else
        loft(
          out,
          'stone',
          [
            [0, 1],
            [4, 0.73],
            [6, 0.74],
            [6.22, 0.81],
          ].map(([y, r]) => rect(y, r).map((p) => [p[0] + x, p[1], p[2] + z])),
          porphyry,
        );
    }
  box(out, 'brick', [-5.25, 4, -5.25], [5.25, 4.35, 5.25], trim);
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    arch(t, 4.3, 4.35, 8.1, 2.32, 11.5, 5, 1, 'brick', brick, 10);
    rail(t, 8.7, 11.68, 5.38);
    if (!sky)
      for (const x of [-0.85, 0, 0.85])
        panel(t, 'shadow', x - 0.26, x + 0.26, 14.7, 16.6, 3.62, [0.12, 0.15, 0.16]);
  }
  box(out, 'brick', [-4.8, 11.45, -4.8], [4.8, 11.68, 4.8], trim);
  // Narrow lower shaft and four distinct corner stair towers.
  loft(out, 'brick', [rect(11.7, 3.6), rect(18.08, 3.6), rect(35.45, 3.409)], brick);
  for (const x of [-4.35, 4.35])
    for (const z of [-4.35, 4.35]) {
      const t = transform(out, 0, [x, 0, z]);
      lathe(
        t,
        'brick',
        sky
          ? [
              [11.35, 1.14],
              [16.04, 1.14],
            ]
          : [
              [11.35, 1.08],
              [12.05, 1.14],
              [15.75, 1.14],
              [16.04, 1.23],
            ],
        brick,
        8,
      );
      if (!sky)
        for (let f = 0; f < 8; f++) {
          const wall = transform(t, (f * Math.PI) / 4);
          panel(wall, 'shadow', -0.22, 0.22, 12.5, 15, 1.06, [0.13, 0.16, 0.17]);
        }
      cone(t, 0, 0, 16.04, 19.2, 1.19);
      if (!sky) tube(t, 'metal', [0, 19.2, 0], [0, 19.7, 0], 0.035, iron, 4);
    }
  for (let side = 0; side < 4; side++) {
    const t = transform(out, (side * Math.PI) / 2);
    if (!sky) {
      panel(t, 'shadow', -0.12, 0.12, 24.2, 25.5, 3.57, [0.1, 0.12, 0.13]);
      if (side % 2 === 0) {
        box(t, 'brick', [-3.5, 18.08, 3.55], [3.5, 19.65, 3.74], trim);
        panel(t, 'metal', -3.3, 3.3, 18.32, 19.35, 3.745, iron);
        const shield = [
          [-1.15, 33.92, 3.5],
          [1.15, 33.92, 3.5],
          [0.96, 31.85, 3.5],
          [0, 31.12, 3.5],
          [-0.96, 31.85, 3.5],
        ];
        for (let i = 1; i < shield.length - 1; i++)
          triangle(t, 'plaster', [shield[0], shield[i + 1], shield[i]], pale);
        const c = side === 0 ? iron : [0.54, 0.15, 0.085];
        for (const s of [-1, 1]) {
          const wing = [
            [0, 33.2, 3.515],
            [s * 0.94, 33.58, 3.515],
            [s * 0.54, 32, 3.515],
          ];
          triangle(t, 'metal', s > 0 ? wing.toReversed() : wing, c);
        }
        triangle(
          t,
          'metal',
          [
            [-0.18, 33.25, 3.518],
            [0.18, 33.25, 3.518],
            [0, 31.54, 3.518],
          ].toReversed(),
          c,
        );
      }
      for (let j = 0; j < (street ? 7 : 4); j++) {
        const x = -3.35 + j * (street ? 1.12 : 2.23);
        box(t, 'brick', [x - 0.22, 34.7, 3.27], [x + 0.22, 35.8, 4.15], trim);
      }
    }
    rail(t, 7.8, 36.05, 4.11);
    arch(t, 5.05, 36.05, 39.25, 2.26, 42.55, 3.675, 0.65, 'brick', brick, 7.35);
    const front = [
        [-3.25, 42.55, 3.51],
        [3.25, 42.55, 3.51],
        [0, 47.6, 3.51],
      ],
      back = front.map(([x, y]) => [x, y, 3.21]);
    triangle(t, 'brick', front, brick);
    triangle(t, 'brick', back.toReversed(), brick);
    for (let j = 0; j < 3; j++)
      face(t, 'brick', [front[j], back[j], back[(j + 1) % 3], front[(j + 1) % 3]], brick);
    if (!sky)
      for (const x of [-0.82, 0, 0.82])
        panel(t, 'plaster', x - 0.23, x + 0.23, 42.88, x === 0 ? 46.78 : 45.13, 3.62, pale);
    if (!sky) {
      lathe(
        transform(t, 0, [3.42, 0, 3.42]),
        'brick',
        [
          [36.05, 0.3],
          [42.1, 0.44],
          [44.5, 0.24],
        ],
        trim,
        8,
      );
      cone(t, 3.42, 3.42, 44.5, 46, 0.32);
    }
  }
  box(out, 'brick', [-4.23, 35.9, -4.23], [4.23, 36.05, 4.23], trim);
  box(out, 'brick', [-3.1, 42.45, -3.1], [3.1, 42.58, 3.1], brick);
  cone(out, 0, 0, 42.55, 54.72, 3.53);
  tube(out, 'metal', [0, 54.7, 0], [0, 55, 0], 0.032, iron, 4);
  if (street) {
    smallFigure(out);
    const gold = [0.65, 0.46, 0.115];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        b = ((i + 1) * Math.PI) / 8;
      triangle(
        out,
        'mosaic',
        [
          [0, 11.08, 0],
          [Math.cos(a) * 4.5, 8.2, Math.sin(a) * 4.5],
          [Math.cos(b) * 4.5, 8.2, Math.sin(b) * 4.5],
        ],
        gold,
      );
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        t = transform(out, a + Math.PI, [
          Math.sign(Math.sin(a)) * 3.65,
          0,
          Math.sign(Math.cos(a)) * 3.65,
        ]);
      box(t, 'brick', [-0.75, 4.35, -0.26], [0.75, 8.45, 0], brick);
      box(t, 'metal', [-0.5, 4.95, -0.04], [0.5, 8.1, 0.045], [0.16, 0.18, 0.16]);
      sphere(t, 'metal', [0, 7.66, 0.11], [0.15, 0.2, 0.055], [0.19, 0.21, 0.185], 8, 4);
      loft(
        t,
        'metal',
        [radialRing(5.8, 0.34, 0.055, 8, [0, 0.09]), radialRing(7.42, 0.32, 0.055, 8, [0, 0.09])],
        [0.19, 0.21, 0.185],
      );
      for (const x of [-0.16, 0.16])
        box(t, 'metal', [x - 0.065, 5.18, 0.05], [x + 0.065, 5.93, 0.14], [0.19, 0.21, 0.185]);
    }
    for (const s of [-1, 1]) {
      const t = transform(out, (s * Math.PI) / 2);
      sphere(t, 'metal', [3.42, 37.4, 4.02], [0.6, 0.6, 0.12], [0.43, 0.44, 0.42], 8, 4);
      beam(t, 'metal', [3.42, 37.4, 3.67], [3.42, 37.4, 4.02], 0.09, 0.09, [0.42, 0.44, 0.42]);
    }
  }
}
