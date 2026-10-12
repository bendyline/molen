/** Whole Rumeli skyline with open antenna cage and mapped masonry-stage silhouette. */
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { lathe, panel, piercedFacade, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export { buildRumeliDistrict, buildRumeliStreet } from './rumeli-detail-model.mjs';

const outline = [
  [-4.45, 0.34],
  [-3.52, -2.67],
  [-0.99, -4.27],
  [2.66, -3.32],
  [4.45, -0.2],
  [3.61, 2.83],
  [0.38, 4.27],
  [-3.41, 3.14],
];
const white = [0.87, 0.87, 0.82],
  silver = [0.61, 0.64, 0.62],
  dark = [0.17, 0.2, 0.19];
const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  limestone: [0.7539, 0.710243, 0.616244],
  metal: [0.908889, 0.908889, 0.908889],
  granite: [0.701109, 0.701109, 0.701109],
  wood: [0.825128, 0.825128, 0.825128],
};
export function buildRumeliSkyline(destination) {
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
  const floors = (profiles, slot = 'plaster', color = white) =>
    loft(
      out,
      slot,
      profiles.map(([y, s]) => [...outline].reverse().map(([x, z]) => [x * s, y, z * s])),
      color,
    );
  const face = (i, s) => {
    const a = outline[i].map((v) => v * s),
      b = outline[(i + 1) % 8].map((v) => v * s);
    return {
      out: transformed(out, Math.atan2(b[1] - a[1], a[0] - b[0]), [
        (a[0] + b[0]) / 2,
        0,
        (a[1] + b[1]) / 2,
      ]),
      half: Math.hypot(b[0] - a[0], b[1] - a[1]) / 2,
    };
  };
  const stage = (y0, y1, s, door = false) => {
    for (let i = 0; i < 8; i++) {
      const f = face(i, s);
      piercedFacade(f.out, {
        half: f.half,
        y0,
        y1,
        z: 0,
        holes: door && i === 7 ? [{ x: 0, y: 0.24, w: 1.02, h: 2.13, depth: 0.24, trim: 0 }] : [],
        slot: 'plaster',
        color: white,
      });
    }
  };
  floors(
    [
      [0, 1.025],
      [0.22, 1.025],
    ],
    'limestone',
    [0.69, 0.68, 0.6],
  );
  stage(0.22, 10.44, 1, true);
  const entry = face(7, 1).out;
  panel(entry, 'wood', -0.51, 0.51, 0.24, 2.37, -0.22, [0.21, 0.23, 0.19]);
  box(entry, 'granite', [-0.76, 0, -0.4], [0.76, 0.12, 0.85], [0.55, 0.55, 0.48]);
  floors([
    [10.44, 1],
    [10.66, 1.045],
    [10.77, 1.045],
  ]);
  stage(10.77, 13.24, 0.8);
  floors([
    [13.24, 0.8],
    [13.42, 0.843],
    [13.5, 0.843],
  ]);
  stage(13.5, 24.8, 0.66);
  for (const [i, y] of [
    [5, 15.46],
    [6, 17.02],
    [5, 18.61],
    [6, 20.18],
    [5, 21.91],
    [6, 23.06],
    [2, 16.8],
    [1, 20.2],
  ])
    panel(face(i, 0.66).out, 'glass', -0.205, 0.205, y, y + 0.89, 0.002, [0.17, 0.24, 0.23]);
  for (const [i, y] of [
    [6, 4.3],
    [5, 6.6],
    [6, 8.05],
    [2, 5.4],
  ])
    panel(face(i, 1).out, 'glass', -0.16, 0.16, y, y + 0.74, 0.002, [0.17, 0.24, 0.23]);
  panel(face(7, 0.8).out, 'glass', -0.205, 0.205, 11.55, 12.37, 0.002, [0.17, 0.24, 0.23]);
  floors(
    [
      [24.8, 0.66],
      [24.95, 0.78],
      [25.045, 0.78],
    ],
    'metal',
    silver,
  );
  const poly = outline.map(([x, z]) => [x * 0.78, z * 0.78]);
  for (let i = 0; i < 8; i++) {
    const a = poly[i],
      b = poly[(i + 1) % 8];
    tube(out, 'metal', [a[0], 25.96, a[1]], [b[0], 25.96, b[1]], 0.021, silver, 3);
    if (i % 2 === 0) tube(out, 'metal', [a[0], 25.02, a[1]], [a[0], 26.02, a[1]], 0.023, silver, 3);
  }
  lathe(
    out,
    'metal',
    [
      [25.05, 1.04],
      [25.19, 1.07],
      [26.52, 0.89],
      [26.63, 0.89],
    ],
    white,
    8,
  );
  lathe(
    out,
    'glass',
    [
      [26.63, 0.86],
      [28.87, 0.86],
    ],
    [0.24, 0.32, 0.34],
    8,
  );
  lathe(
    out,
    'metal',
    [
      [28.91, 0.98],
      [29.05, 0.98],
      [29.64, 0.28],
      [29.89, 0.11],
      [30.025, 0.075],
    ],
    white,
    8,
  );
  for (const x of [-1.71, 1.71])
    for (const z of [-1.71, 1.71]) {
      tube(out, 'metal', [x, 25.04, z], [x, 30.18, z], 0.035, dark, 3);
      tube(out, 'metal', [x, 30.18, z], [0, 30.62, 0], 0.034, dark, 3);
    }
  for (const y of [25.2, 30.17])
    for (const x of [-1.71, 1.71]) {
      tube(out, 'metal', [x, y, -1.71], [x, y, 1.71], 0.032, dark, 3);
      tube(out, 'metal', [-1.71, y, x], [1.71, y, x], 0.032, dark, 3);
    }
  tube(out, 'metal', [0, 29.95, 0], [0, 33.8, 0], 0.065, silver, 3);
  box(
    transformed(out, 0.2),
    'metal',
    [-1.3, 33.09, -0.11],
    [1.3, 33.27, 0.11],
    [0.61, 0.055, 0.07],
  );
  const ladder = transformed(out, -Math.PI / 2);
  for (const x of [-0.24, 0.24])
    tube(ladder, 'metal', [x, 25.03, 1.23], [x, 32.37, 1.23], 0.025, silver, 3);
  for (const y of [27, 29, 31])
    tube(ladder, 'metal', [-0.24, y, 1.23], [0.24, y, 1.23], 0.017, silver, 3);
  // No solid box spans the four-legged radar cage or the gallery air gaps.
  const p = [
    [0, 33.09, -0.34],
    [0, 33.09, 0.34],
    [0, 33.51, 0.34],
    [0, 33.51, -0.34],
  ];
  quad(out, 'metal', p, normalFor(...p.slice(0, 3)), [0.55, 0.06, 0.08]);
}
