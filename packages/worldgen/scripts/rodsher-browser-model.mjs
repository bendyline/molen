/** Compact Rodsher skyline retains the full tower, panels, gallery gaps and vane. */
import earcut from 'earcut';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { ring } from './lighthouse-expansion-models.mjs';
import { lathe, panel, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

export { buildRodsherDistrict, buildRodsherStreet } from './rodsher-detail-model.mjs';

const red = [0.46, 0.11, 0.085],
  iron = [0.24, 0.07, 0.055],
  grey = [0.41, 0.42, 0.38];
const means = {
  plaster: [0.856015, 0.827728, 0.727643],
  metal: [0.908889, 0.908889, 0.908889],
  wood: [0.825128, 0.825128, 0.825128],
  concrete: [0.710816, 0.710816, 0.681928],
};
const point = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
export function buildRodsherSkyline(destination) {
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
  const oct = (r, y) => Array.from({ length: 8 }, (_, i) => point(r, y, ((i + 0.5) * Math.PI) / 4));
  loft(
    out,
    'concrete',
    [
      [0, 3.19],
      [0.21, 3.19],
      [0.36, 3.1],
    ].map(([y, r]) => oct(r, y)),
    [0.44, 0.43, 0.38],
  );
  // A genuinely recessed east-facing doorway stays present even at the far level.
  const wall = (y0, y1, r, door = false) => {
    const z = r * Math.cos(Math.PI / 8),
      w = r * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const o = transformed(out, (i * Math.PI) / 4),
        ps = [
          [-w, y0],
          [w, y0],
          [w, y1],
          [-w, y1],
        ],
        holes = [];
      if (door && i === 4) {
        holes.push(4);
        ps.push([-0.54, 0.48], [0.54, 0.48], [0.54, 2.21], [0, 2.75], [-0.54, 2.21]);
      }
      const ix = earcut(ps.flat(), holes, 2);
      for (let j = 0; j < ix.length; j += 3) {
        const p = ix.slice(j, j + 3).map((k) => [...ps[k], z]);
        if (normalFor(...p)[2] < 0) p.reverse();
        o.addTriangle(
          'plaster',
          'palette:#fff',
          p,
          [0, 0, 1],
          p.map((v) => [v[0], v[1]]),
          red,
        );
      }
      if (holes.length) {
        const shape = ps.slice(4);
        for (let j = 0; j < shape.length; j++) {
          const a = shape[j],
            b = shape[(j + 1) % shape.length],
            p = [
              [...a, z],
              [...a, z - 0.3],
              [...b, z - 0.3],
              [...b, z],
            ];
          quad(o, 'plaster', p, normalFor(...p.slice(0, 3)), red);
        }
        const idx = earcut(shape.flat());
        for (let j = 0; j < idx.length; j += 3) {
          const p = idx.slice(j, j + 3).map((k) => [...shape[k], z - 0.3]);
          o.addTriangle(
            'wood',
            'palette:#fff',
            p,
            [0, 0, 1],
            p.map((v) => [v[0], v[1]]),
            [0.12, 0.13, 0.1],
          );
        }
      }
    }
  };
  wall(0.36, 4.76, 3.1, true);
  loft(
    out,
    'plaster',
    [
      [4.76, 3.1],
      [4.99, 2.69],
      [5.08, 2.58],
    ].map(([y, r]) => oct(r, y)),
    red,
  );
  wall(5.08, 12.05, 2.58);
  for (const a of [0, Math.PI])
    for (const y of [5.77, 8.74])
      panel(
        transformed(out, a),
        'glass',
        -0.35,
        0.35,
        y,
        y + 1.46,
        2.58 * Math.cos(Math.PI / 8) + 0.003,
        [0.11, 0.2, 0.19],
      );
  loft(
    out,
    'plaster',
    [
      [12.05, 2.58],
      [12.79, 3.13],
      [13.18, 3.19],
    ].map(([y, r]) => oct(r, y)),
    red,
  );
  const rails = (y, r, h) => {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        b = ((i + 1) * Math.PI) / 4;
      tube(out, 'metal', point(r, y, a), point(r, y + h, a), 0.024, iron, 3);
      tube(out, 'metal', point(r, y + h, a), point(r, y + h, b), 0.024, iron, 3);
    }
  };
  ring(out, 'metal', 13.18, 1.25, 2.83, 0.04, iron, 8);
  rails(13.22, 2.78, 1.06);
  lathe(
    out,
    'metal',
    [
      [13.18, 1.39],
      [15.37, 1.39],
    ],
    red,
    8,
  );
  ring(out, 'metal', 15.37, 1.15, 2.06, 0.11, iron, 8);
  rails(15.48, 2.02, 1.14);
  lathe(
    out,
    'glass',
    [
      [15.5, 1.34],
      [17.49, 1.34],
    ],
    [0.2, 0.3, 0.32],
    8,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    tube(out, 'metal', point(1.36, 15.49, a), point(1.36, 17.53, a), 0.03, grey, 3);
  }
  lathe(
    out,
    'metal',
    [
      [17.52, 1.46],
      [17.63, 1.46],
      [18.3, 1.05],
      [18.59, 0.13],
    ],
    red,
    8,
  );
  lathe(
    out,
    'metal',
    [
      [18.59, 0.13],
      [18.65, 0.12],
      [18.85, 0.2],
      [19.11, 0.06],
    ],
    red,
    8,
  );
  tube(out, 'metal', [0, 19.06, 0], [0, 20.45, 0], 0.018, iron, 3);
  for (const a of [0, Math.PI / 2])
    tube(transformed(out, a), 'metal', [-0.46, 19.73, 0], [0.46, 19.73, 0], 0.018, iron, 3);
  box(out, 'metal', [-0.31, 20.02, -0.015], [-0.075, 20.14, 0.015], iron);
  for (const y of [3, 5.49])
    for (const x of [-0.66, 0.66]) {
      box(out, 'metal', [x - 0.58, y, 2.83], [x + 0.58, y + 1.44, 2.92], grey);
      panel(out, 'glass', x - 0.54, x + 0.54, y + 0.04, y + 1.4, 2.926, [0.038, 0.12, 0.21]);
    }
  const entry = transformed(out, Math.PI);
  for (let i = 0; i < 3; i++)
    box(
      entry,
      'concrete',
      [-0.82, 0, 2.64],
      [0.82, (3 - i) * 0.16, 3.25 + i * 0.35],
      [0.51, 0.51, 0.43],
    );
}
