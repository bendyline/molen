/** montelbaanstoren source-local browser derivatives. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere as sourceSphere } from './authored-structure-mesh.mjs';
import { face, transform } from './heritage-tower-detail-mesh.mjs';
import { box, tube as sourceTube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export {
  buildMontelbaanCloseup,
  buildMontelbaanDistrict,
  buildMontelbaanStreet,
} from './montelbaanstoren-detail-model.mjs';

const footprint = JSON.parse(
    readFileSync(structureSourcePath('montelbaanstoren', 'map-frame.json')),
  ).geometry.outline,
  means = {
    brick: [0.620345, 0.549823, 0.504963],
    round_brick: [0.620345, 0.549823, 0.504963],
    limestone: [0.7539, 0.710243, 0.616244],
    wood: [0.825128, 0.825128, 0.825128],
    metal: [0.908889, 0.908889, 0.908889],
  };
export function buildMontelbaanSkyline(destination) {
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        destination[k](
          s,
          r,
          p,
          n,
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  const brick = [0.49, 0.4, 0.31],
    pale = [0.88, 0.85, 0.76],
    black = [0.035, 0.048, 0.045],
    gold = [0.83, 0.64, 0.25],
    tau = Math.PI * 2;
  const oct = (y, r) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8);
  const pts = footprint.filter((_, i) => [0, 7, 14, 21, 22, 24, 30, 36].includes(i));
  loft(
    out,
    'brick',
    [
      pts.map(([x, z]) => [x, 0, z]),
      pts.map(([x, z]) => [x, 0.68, z]),
      pts.map(([x, z]) => {
        const r = Math.hypot(x, z);
        return [(x * 4.6) / r, 1.24, (z * 4.6) / r];
      }),
    ],
    brick,
  );
  loft(
    out,
    'round_brick',
    [radialRing(1.2, 4.36, 4.36, 16), radialRing(14.1, 4.29, 4.29, 16)],
    brick,
  );
  loft(out, 'brick', [oct(14.1, 4.45), oct(19, 4.45)], brick);
  loft(
    out,
    'metal',
    [
      [18.75, 4.5],
      [19, 4.58],
      [19.25, 4.5],
      [20.25, 2.81],
      [23.35, 2.81],
      [23.57, 3.17],
    ].map(([y, r]) => oct(y, r)),
    pale,
  );
  for (let i = 0; i < 4; i++) {
    const wall = transform(out, (i * Math.PI) / 2),
      z = 2.81 * Math.cos(Math.PI / 8) + 0.08,
      y = 21.92;
    face(
      wall,
      'metal',
      [
        [-1.19, y - 1.19, z],
        [1.19, y - 1.19, z],
        [1.19, y + 1.19, z],
        [-1.19, y + 1.19, z],
      ],
      black,
    );
    for (let j = 0; j < 12; j++) {
      const a = (j * tau) / 12,
        b = ((j + 1) * tau) / 12;
      face(
        wall,
        'metal',
        [
          [Math.sin(a) * 1.06, y + Math.cos(a) * 1.06, z + 0.015],
          [Math.sin(b) * 1.06, y + Math.cos(b) * 1.06, z + 0.015],
          [Math.sin(b) * 1.015, y + Math.cos(b) * 1.015, z + 0.015],
          [Math.sin(a) * 1.015, y + Math.cos(a) * 1.015, z + 0.015],
        ],
        gold,
      );
    }
    for (const [a, l] of [
      [-Math.PI / 3, 0.62],
      [Math.PI / 3, 0.86],
    ])
      face(
        wall,
        'metal',
        [
          [-0.03, y, z + 0.03],
          [0.03, y, z + 0.03],
          [Math.sin(a) * l + 0.025, y + Math.cos(a) * l, z + 0.03],
          [Math.sin(a) * l - 0.025, y + Math.cos(a) * l, z + 0.03],
        ],
        gold,
      );
  }
  for (const [y0, spring, rise, top, r, width] of [
    [23.57, 27.15, 0.67, 28.56, 2.55, 1.22],
    [30.98, 34.12, 0.41, 35.3, 1.52, 0.63],
  ]) {
    const z = r * Math.cos(Math.PI / 8),
      half = r * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const wall = transform(out, (i * tau) / 8);
      box(wall, 'metal', [-half - 0.065, y0, z - 0.13], [-half + 0.065, top, z + 0.03], pale);
      for (let j = 0; j < 2; j++) {
        const x0 = -width / 2 + (width * j) / 2,
          x1 = x0 + width / 2,
          a = spring + Math.sqrt(Math.max(0, 1 - Math.pow(x0 / (width / 2), 2))) * rise,
          b = spring + Math.sqrt(Math.max(0, 1 - Math.pow(x1 / (width / 2), 2))) * rise;
        face(
          wall,
          'metal',
          [
            [x0, a, z],
            [x1, b, z],
            [x1, top, z],
            [x0, top, z],
          ],
          pale,
        );
        face(
          wall,
          'metal',
          [
            [x1, b, z - 0.2],
            [x0, a, z - 0.2],
            [x0, top, z - 0.2],
            [x1, top, z - 0.2],
          ],
          pale,
        );
      }
    }
    loft(out, 'metal', [oct(y0 + 0.72, r + 0.04), oct(y0 + 0.8, r + 0.04)], pale);
  }
  loft(
    out,
    'metal',
    [
      [28.56, 2.8],
      [28.8, 2.76],
      [29.55, 1.96],
      [30.8, 1.59],
      [30.98, 1.9],
    ].map(([y, r]) => oct(y, r)),
    pale,
  );
  loft(
    out,
    'metal',
    [
      [35.3, 1.67],
      [35.9, 1.12],
      [36.72, 0.46],
      [37.13, 0.45],
      [37.73, 0.55],
      [38.6, 0.095],
    ].map(([y, r]) => oct(y, r)),
    pale,
  );
  sourceTube(out, 'metal', [0, 38.48, 0], [0, 42.05, 0], 0.032, black, 4);
  sourceSphere(out, 'metal', [0, 40.17, 0], [0.37, 0.37, 0.37], gold, 8, 4);
  beam(out, 'metal', [-0.89, 41.12, 0], [0.89, 41.12, 0], 0.052, 0.052, black);
  beam(out, 'metal', [0, 41.12, -0.55], [0, 41.12, 0.55], 0.046, 0.046, black);
  // Landmark-scale marks retain the asymmetric paired canal windows and opposite entry.
  for (const [a, y, h, w] of [
    [-0.28, 4, 1.86, 1.07],
    [0.28, 4, 1.86, 1.07],
    [Math.PI / 2, 4, 1.86, 1.07],
    [-Math.PI / 2, 4, 1.86, 1.07],
  ])
    face(
      transform(out, a),
      'shadow',
      [
        [-w / 2, y, 4.38],
        [w / 2, y, 4.38],
        [w / 2, y + h, 4.38],
        [-w / 2, y + h, 4.38],
      ],
      black,
    );
  box(out, 'brick', [-3.736, 0, -5.6], [-0.336, 7.6, -2.8], brick);
  const land = transform(out, Math.PI, [-2.036, 0, 0]);
  for (const [w, y, h, slot] of [
    [1.04, 0.12, 2.2, 'wood'],
    [1.9, 3.4, 2.15, 'shadow'],
  ])
    face(
      land,
      slot,
      [
        [-w / 2, y, 5.615],
        [w / 2, y, 5.615],
        [w / 2, y + h, 5.615],
        [-w / 2, y + h, 5.615],
      ],
      black,
    );
}
