/** Whole Emley Moor far silhouette; native +X east and +Z south. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { face, transform } from './heritage-tower-detail-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';

export {
  buildEmleyCloseup,
  buildEmleyDistrict,
  buildEmleyStreet,
} from './emley-moor-detail-model.mjs';

export function buildEmleySkyline(destination) {
  const means = { concrete: [0.710816, 0.710816, 0.681928], metal: [0.908889, 0.908889, 0.908889] };
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        destination[k](
          s,
          r,
          p,
          n.map((v) => v / Math.hypot(...n)),
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  const concrete = [0.64, 0.62, 0.56],
    metal = [0.71, 0.73, 0.72],
    white = [0.87, 0.88, 0.85],
    dark = [0.16, 0.19, 0.19];
  const radius = (y) => 12.19 * Math.pow(3.2 / 12.19, y / 274.32);
  const cylinder = (s, profile, c, count = 8) =>
    loft(
      out,
      s,
      profile.map(([y, r]) => radialRing(y, r, r, count)),
      c,
    );
  cylinder(
    'concrete',
    [0, 45.7, 91.44, 137.16, 182.88, 228.6, 262.4, 274.32].map((y) => [y, radius(y)]),
    concrete,
    12,
  );
  cylinder(
    'metal',
    [
      [262.4, 7.05],
      [264.7, 7.05],
    ],
    metal,
    20,
  );
  cylinder(
    'glass',
    [
      [264.7, 7.05],
      [266.5, 7.05],
    ],
    [0.24, 0.3, 0.31],
    20,
  );
  cylinder(
    'metal',
    [
      [266.5, 7.05],
      [268.12, 7.05],
    ],
    metal,
    20,
  );
  cylinder(
    'metal',
    [
      [251.8, 4.9],
      [252, 4.9],
    ],
    metal,
    8,
  );
  cylinder(
    'metal',
    [
      [45.54, radius(45.7) + 0.95],
      [45.7, radius(45.7) + 0.95],
    ],
    metal,
    12,
  );
  cylinder(
    'metal',
    [
      [274.32, 1.83],
      [296.5, 1.83],
    ],
    white,
  );
  cylinder(
    'metal',
    [
      [296.5, 1.87],
      [300.45, 1.87],
    ],
    [0.53, 0.55, 0.54],
  );
  cylinder(
    'metal',
    [
      [300.45, 0.76],
      [317.7, 0.76],
    ],
    white,
  );
  for (const x of [-0.53, 0.53]) tube(out, 'metal', [x, 317.7, 0], [x, 319, 0], 0.025, metal, 3);
  for (const y of [27.4, 33.5, 39.6, 45.7]) {
    const g = transform(out, Math.PI),
      r = radius(y);
    const p = [
      [-2.5, y, r - 0.8],
      [2.5, y, r - 0.8],
      [3.2, y, r + 3.1],
      [-3.2, y, r + 3.1],
    ].reverse();
    loft(g, 'concrete', [p.map(([x, y, z]) => [x, y - 0.22, z]), p], concrete);
    for (const x of [-3.2, 3.2])
      tube(g, 'metal', [x, y, r + 3.1], [x, y + 1.08, r + 3.1], 0.03, metal, 3);
    tube(g, 'metal', [-3.2, y + 1.06, r + 3.1], [3.2, y + 1.06, r + 3.1], 0.03, metal, 3);
  }
  const north = transform(out, Math.PI);
  for (const y of [256.4, 258.44, 260.48])
    for (const side of [-1, 1])
      beam(north, 'metal', [0, y, 4.1], [side * 1.68, y + 0.35, 6.85], 0.15, 0.13, white);
  const west = transform(out, -Math.PI / 2);
  for (const y of [269.5, 272]) box(west, 'metal', [-0.9, y, 3.3], [0.9, y + 0.65, 3.48], white);
  const entrance = transform(out, Math.PI / 2);
  face(
    entrance,
    'glass',
    [
      [-1.5, 0, 12.21],
      [1.5, 0, 12.21],
      [1.5, 3.6, 12.21],
      [-1.5, 3.6, 12.21],
    ],
    dark,
  );
  for (const x of [-1.8, 1.8])
    beam(entrance, 'metal', [x, 0, 13.6], [x, 4.4, 13.6], 0.1, 0.1, metal);
  beam(entrance, 'metal', [-1.85, 4.4, 13.6], [1.85, 4.4, 13.6], 0.15, 0.15, metal);
}
