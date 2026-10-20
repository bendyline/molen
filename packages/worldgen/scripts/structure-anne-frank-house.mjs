/** Original exterior for Prinsengracht 263. Plan partition is photographic, not surveyed. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, c } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const cx = 2.69,
  width = 5.88,
  front = 16.7;
function glazing(o, x, y, z, w, h, facing = 1, detail = true, columns = 2, rows = 3) {
  B(o, 'metal', x, y - 0.09, z, w + 0.22, h + 0.18, 0.14, 'cream');
  B(o, 'glass', x, y, z + facing * 0.09, w, h, 0.035, 'glass');
  if (detail) {
    for (let i = 1; i < columns; i++)
      B(o, 'metal', x + w * (i / columns - 0.5), y, z + facing * 0.12, 0.045, h, 0.035, 'cream');
    for (let i = 1; i < rows; i++)
      B(o, 'metal', x, y + (h * i) / rows, z + facing * 0.12, w, 0.045, 0.035, 'cream');
    B(o, 'metal', x, y - 0.13, z + facing * 0.07, w + 0.3, 0.12, 0.25, 'cream');
  }
}
function transverseRoof(o) {
  // The annex ridge runs across the parcel, perpendicular to the front-house ridge.
  for (const sign of [-1, 1]) {
    const pts = [
      [cx - width / 2, 13.3, -3.75 + sign * 3.65],
      [cx + width / 2, 13.3, -3.75 + sign * 3.65],
      [cx + width / 2, 16.9, -3.75],
      [cx - width / 2, 16.9, -3.75],
    ];
    if (sign < 0) pts.reverse();
    quad(o, 'roof', pts, normalFor(...pts), c.tile);
  }
  for (const sign of [-1, 1]) {
    const x = cx + (sign * width) / 2;
    o.addConvexPolygon(
      'brick',
      'palette:#ffffff',
      [
        [x, 13.3, -7.4],
        [x, 13.3, -0.1],
        [x, 16.9, -3.75],
      ],
      [sign, 0, 0],
      (p) => [p[2], p[1]],
      c.brick,
    );
    for (const z of [-7.4, -0.1])
      beam(o, 'metal', [x, 13.3, z], [x, 16.9, -3.75], 0.16, 0.16, c.cream);
  }
  // The archive's CC0 rear exterior shows a central flat-topped dormer.
  B(o, 'brick', cx, 13.4, -6.25, 1.65, 1.85, 1.9, 'brick');
  B(o, 'roof', cx, 15.25, -6.25, 1.9, 0.16, 2.05, 'roof');
  glazing(o, cx, 13.55, -7.23, 1.25, 1.5, -1, false);
}
function court(o, detail) {
  // Photographed through the front house: a low glazed roof and narrow side link.
  const mid = cx + 0.8;
  for (const sign of [-1, 1]) {
    const points = [
      [mid + sign * 1.4, 3.3, 0.2],
      [mid + sign * 1.4, 3.3, 3],
      [mid, 3.85, 3],
      [mid, 3.85, 0.2],
    ];
    if (sign > 0) points.reverse();
    quad(o, 'glass', points, normalFor(...points), c.glass);
  }
  if (!detail) return;
  beam(o, 'metal', [mid, 3.85, 0.2], [mid, 3.85, 3], 0.08, 0.08, c.cream);
  for (const z of [0.2, 1.6, 3])
    for (const sign of [-1, 1])
      beam(o, 'metal', [mid, 3.85, z], [mid + sign * 1.4, 3.3, z], 0.07, 0.07, c.cream);
  // One lower and two upper windows on the annex face toward the light court.
  glazing(o, cx + 0.65, 3.65, -0.04, 1.2, 2.5, 1, true);
  for (const dx of [-0.5, 1.6]) glazing(o, cx + dx, 7.4, -0.04, 1.35, 2.4, 1, true);
  for (let i = 0; i < 10; i++)
    B(o, 'metal', cx + 0.45, 10.45 + i * 0.27, 0.05, 4.25, 0.1, 0.42, 'dark');
  const x = cx - width / 2 + 1.63;
  for (const y of [3.65, 7.3])
    for (const z of [0.65, 2.25]) {
      B(o, 'metal', x, y - 0.08, z, 0.12, 2.65, 1.35, 'cream');
      B(o, 'glass', x + 0.08, y, z, 0.035, 2.45, 1.1, 'glass');
      B(o, 'metal', x + 0.11, y, z, 0.035, 2.45, 0.045, 'cream');
      for (const dy of [0.82, 1.64]) B(o, 'metal', x + 0.11, y + dy, z, 0.035, 0.045, 1.1, 'cream');
    }
}
function massing(o) {
  B(o, 'brick', cx, -1, 10, width, 15.6, 13.4, 'brick');
  // The canal end is hipped behind the straight cornice, not an exposed brick gable.
  for (const sign of [-1, 1]) {
    const p = [
      [cx + (sign * width) / 2, 14.6, 3.3],
      [cx + (sign * width) / 2, 14.6, front],
      [cx, 17, 12.5],
      [cx, 17, 3.3],
    ];
    if (sign > 0) p.reverse();
    quad(o, 'roof', p, normalFor(...p), c.roof);
  }
  const hip = [
    [cx - width / 2, 14.6, front],
    [cx + width / 2, 14.6, front],
    [cx, 17, 12.5],
  ];
  o.addConvexPolygon(
    'roof',
    'palette:#ffffff',
    hip,
    normalFor(...hip),
    (p) => [p[0], p[2]],
    c.roof,
  );
  o.addConvexPolygon(
    'brick',
    'palette:#ffffff',
    [
      [cx - width / 2, 14.6, 3.3],
      [cx + width / 2, 14.6, 3.3],
      [cx, 17, 3.3],
    ],
    [0, 0, -1],
    (p) => [p[0], p[1]],
    c.brick,
  );
  // Narrow link and low warehouse roof leave the light court open above the ground floor.
  B(o, 'brick', cx, -1, 1.6, width, 4.15, 3.4, 'brick');
  B(o, 'roof', cx, 3.15, 1.6, width, 0.12, 3.4, 'roof');
  B(o, 'brick', cx - width / 2 + 0.8, 3.2, 1.6, 1.6, 6.3, 3.4, 'brick');
  B(o, 'roof', cx - width / 2 + 0.8, 9.5, 1.6, 1.8, 0.14, 3.55, 'roof');
  B(o, 'brick', cx, -1, -3.75, width, 14.3, 7.3, 'brick');
  transverseRoof(o);
  B(o, 'brick', cx, 14.6, front - 0.12, width, 0.65, 0.3, 'brick');
  B(o, 'metal', cx, 15.05, front + 0.05, width + 0.15, 0.55, 0.24, 'white');
  B(o, 'metal', cx, 15.58, front + 0.17, width + 0.36, 0.18, 0.55, 'white');
  B(o, 'metal', cx, 15.76, front + 0.17, width + 0.42, 0.13, 0.63, 'white');
  B(o, 'metal', cx, 0, front + 0.04, width, 3.12, 0.18, 'dark');
  for (const [x, z, y] of [
    [cx - 2.45, 6, 14.6],
    [cx - 2.45, -3.75, 15.5],
    [cx + 2.45, -3.75, 15.5],
  ]) {
    B(o, 'brick', x, y, z, 0.55, 2.1, 0.65, 'brick');
    B(o, 'metal', x, y + 2.1, z, 0.75, 0.16, 0.85, 'cream');
  }
}
function facade(o, detail) {
  for (let i = 0; i < 3; i++) {
    const x = cx + (i - 1) * 1.85;
    for (const [y, h] of [
      [3.65, 2.85],
      [7.4, 2.85],
      [11.45, 2.55],
    ])
      glazing(o, x, y, front + 0.06, 1.26, h, 1, detail);
    if (detail) {
      if (i === 1) {
        B(o, 'metal', x, 11.05, front + 0.08, 1.48, 0.43, 0.16, 'cream');
        B(o, 'metal', x, 11.16, front + 0.18, 1.2, 0.16, 0.04, 'dark');
      }
      B(o, 'metal', x, 3.16, front + 0.13, 1.55, 0.16, 0.33, 'dark');
      B(o, 'metal', x, 0.18, front + 0.17, 1.45, 2.72, 0.08, 'dark');
      if (i === 0) {
        // The inspected creator-CC0 close-up shows two solid doors, not glazing.
        for (const dx of [-0.29, 0.29]) {
          B(o, 'metal', x + dx, 0.45, front + 0.27, 0.49, 1.55, 0.06, 'dark');
          B(o, 'metal', x + dx, 0.12, front + 0.27, 0.49, 0.25, 0.06, 'dark');
          B(o, 'metal', x + dx * 0.2, 0.92, front + 0.32, 0.055, 0.07, 0.035, 'cream');
        }
        B(o, 'metal', x, 0.15, front + 0.3, 0.04, 2.1, 0.035, 'dark');
        B(o, 'glass', x, 2.28, front + 0.23, 1.16, 0.53, 0.03, 'glass');
        for (const dx of [-0.29, 0, 0.29])
          B(o, 'metal', x + dx, 2.28, front + 0.27, 0.035, 0.53, 0.03, 'dark');
      } else B(o, 'glass', x, 0.68, front + 0.23, 1.16, 2.12, 0.03, 'glass');
      for (const dx of [-0.63, 0.63])
        B(o, 'metal', x + dx, 0.2, front + 0.26, 0.09, 2.7, 0.07, 'dark');
      B(o, 'metal', x, 2.15, front + 0.27, 1.2, 0.065, 0.06, 'dark');
      B(o, 'metal', x, 0.35, front + 0.27, 1.15, 0.62, 0.05, 'dark');
    } else
      B(
        o,
        'glass',
        x,
        i === 0 ? 2.28 : 0.65,
        front + 0.16,
        1.2,
        i === 0 ? 0.53 : 1.9,
        0.02,
        'glass',
      );
  }
  if (detail) {
    for (let i = 0; i < 15; i++)
      B(o, 'metal', cx - 2.65 + i * 0.38, 15.4, front + 0.23, 0.1, 0.16, 0.22, 'white');
    for (const dx of [-2.77, -0.92, 0.92, 2.77])
      for (const y of [6.65, 10.7, 14.15])
        B(o, 'metal', cx + dx, y, front + 0.08, 0.055, 0.48, 0.05, 'dark');
    B(o, 'metal', cx, 15.89, front - 0.25, 0.48, 0.55, 0.85, 'cream');
    beam(o, 'metal', [cx, 16.25, front - 0.4], [cx, 16.25, front + 1.1], 0.16, 0.18, c.dark);
    B(o, 'metal', cx, 15.98, front + 1.04, 0.055, 0.25, 0.055, 'dark');
    for (let step = 0; step < 2; step++)
      B(
        o,
        'stone',
        cx,
        step * 0.13,
        front + 0.55 - step * 0.16,
        width,
        0.13,
        0.75 - step * 0.32,
        'dark',
      );
    for (const [y, h, columns, rows] of [
      [3.3, 2.55, 3, 4],
      [7, 2.1, 2, 1],
      [10.35, 1.8, 2, 1],
    ])
      for (const dx of [-1.45, 1.45])
        glazing(o, cx + dx, y, -7.43, 1.2, h, -1, true, columns, rows);
    for (const y of [3.6, 7.4, 11.2])
      for (const dx of [-1.45, 1.45]) glazing(o, cx + dx, y, 3.27, 1.1, 2.1, -1, true);
    B(o, 'metal', cx, 13.27, -7.48, width + 0.2, 0.16, 0.26, 'cream');
  }
}
export function anne(o) {
  massing(o);
  court(o, true);
  facade(o, true);
}
export function anneSkyline(o) {
  massing(o);
  court(o, false);
  facade(o, false);
}
export const anneModel = {
  id: 'anne_frank_house',
  recipe: 'structure-anne-frank-house.mjs',
  key: 'anne_frank_house',
  cell: 'u1/u17',
  title: 'Anne Frank House',
  brief:
    'Prinsengracht 263 only: three-bay black storefront and brick upper facade, white cornice and hoist, slate front-house roof, narrow connecting section and transverse red-tiled annex roof.',
  camera: [26, 25, 40],
  build: anne,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'reviewed-source-frame',
  groundContactBasis:
    'Front threshold at signed local [2.69,17.25] on independently sampled host terrain; foundation extends to -1 m.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-anne-frank-house.mjs',
    level: 'skyline',
    export: 'anneSkyline',
    errorMeters: 0.5,
  },
  limitations: [
    'Original medium-fi exterior, not a measured reconstruction. Started with the cleared public-domain Qualla streetscape; independently verified CC0 archive exteriors and creator-released courtyard/door photos supply the missing views. Earlier CC photos, museum cutaway and model photograph are excluded from current imagery approval.',
    'The zoom-15 map supplies a generalized 5.88 by 24.1 m envelope. Front/connector/annex partition and window/roof dimensions are estimates; small modern alterations and interiors are omitted.',
    'Adjacent 261, 265 and the modern museum block are excluded. The former draft rear polygon was a neighboring property and has been removed.',
    'Ground contact is reviewed against independently preserved coarse host-terrain samples; this is not elevation survey data. Photographs remain local comparison inputs and are not embedded. The archival rear, courtyard partitions, louver spacing, dormer depth and fine trim are generalized; small modern changes are omitted.',
  ],
};
