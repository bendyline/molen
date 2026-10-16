/** Reviewed Montsoreau plan; original detailed recipe remains separately reproducible. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { montsoreauMeshHelpers } from './montsoreau-castle-model.mjs';
import { box } from './structure-mesh.mjs';

const {
  rectangle,
  roof,
  face,
  triangle,
  frame,
  cornice,
  dormer,
  squareTower,
  polygonStair,
  near,
  stone,
  trim,
  slate,
  glass,
} = montsoreauMeshHelpers;
const court = [
    [-16.3, -14],
    [12.2, -14],
    [12.2, -5.7],
    [23.9, -5.7],
    [23.91, 3.43],
    [31.94, 3],
    [31.88, 20.76],
    [21.53, 21.64],
    [21.57, 20.87],
    [21.13, 26.56],
    [20.49, 26.66],
    [8.07, 24.94],
    [-0.78, 26.42],
    [-25.87, 17.53],
    [-25.04, 11.05],
    [-28.16, 11.08],
    [-26.29, 2.89],
    [-24, -5.7],
    [-16.3, -5.7],
  ],
  means = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    carved: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  };
function buildings(o) {
  const north = [-7.6, -2.5, 2.6, 7.7];
  const south = [-7.7, -0.9, 6.0];
  rectangle(o, -25.1, 17.0, -24.05, -14.0, 0, 20.8, {
    north: [8.8, 14.4].flatMap((y) => north.map((x) => ({ x, y, width: 1.6, height: 2.7 }))),
    south: [5.2, 11.3].flatMap((y) => south.map((x) => ({ x, y, width: 1.8, height: 2.7 }))),
  });
  roof(o, -15.1, 5.2, -24.1, -13.75, 21.0, 30.8);
  // Rear slate skirts meet the back walls below the two open terrace parapets.
  for (const [x0, x1] of [
    [-24.9, -15.1],
    [5.2, 16.8],
  ])
    face(
      o,
      'slate',
      [
        [x0, 21, -13.75],
        [x1, 21, -13.75],
        [x1, 28.2, -15.7],
        [x0, 28.2, -15.7],
      ],
      slate,
    );
  for (const [z, a, xs] of [
    [-24.12, Math.PI, [-7.6, -2.5, 2.6, 7.7]],
    [-13.85, 0, south],
  ]) {
    const f = frame(o, -4.05, z, a);
    cornice(f, 42.1, 20.6, xs);
    for (const x of xs) dormer(f, x);
  }
  squareTower(o, -25.3, -15.1, -26.4, -15.7);
  squareTower(o, 5.2, 17.1, -26.35, -15.7);
  // The battered river plinth differs from the sheer upper walls.
  for (const [x0, x1, z] of [
    [-25.3, -15.1, -26.4],
    [-15.1, 5.2, -24.05],
    [5.2, 17.1, -26.35],
  ]) {
    face(
      o,
      'limestone',
      [
        [x1, 0, z - 0.75],
        [x0, 0, z - 0.75],
        [x0, 3.8, z],
        [x1, 3.8, z],
      ],
      [0.6, 0.58, 0.5],
    );
    triangle(
      o,
      'limestone',
      [
        [x0, 0, z],
        [x0, 3.8, z],
        [x0, 0, z - 0.75],
      ],
      stone,
    );
    triangle(
      o,
      'limestone',
      [
        [x1, 0, z - 0.75],
        [x1, 3.8, z],
        [x1, 0, z],
      ],
      stone,
    );
  }
  // Lower west return and its distinctly lower lean-to roof.
  rectangle(o, -24, -16.3, -15.5, -5.7, 0, 13.8, {
    south: [{ x: 0, y: 7.2, width: 1.5, height: 2.2 }],
    west: [
      { x: -2, y: 7 },
      { x: 2, y: 7 },
    ],
  });
  face(
    o,
    'slate',
    [
      [-24.2, 14, -5.5],
      [-16.1, 14, -5.5],
      [-16.1, 20.6, -15.5],
      [-24.2, 20.6, -15.5],
    ],
    slate,
  );
  triangle(
    o,
    'limestone',
    [
      [-24, 13.8, -15.5],
      [-24, 13.8, -5.7],
      [-24, 20.45, -15.5],
    ],
    stone,
  );
  triangle(
    o,
    'limestone',
    [
      [-16.3, 13.8, -5.7],
      [-16.3, 13.8, -15.5],
      [-16.3, 20.45, -15.5],
    ],
    stone,
  );
  rectangle(o, -31.45, -25.3, -21.7, -11.5, 0, 13.8);
  roof(o, -31.6, -25.15, -21.8, -11.3, 14, 18.4);
  // Eastern return has its own floor levels and ridge at right angles to the main range.
  rectangle(o, 12.2, 24.0, -14.4, -5.7, 0, 21.2, {
    west: [-2.5, 2.5].flatMap((x) =>
      [7, 13.1, 18.2].map((y) => ({ x, y, width: 1.5, height: 2.2 })),
    ),
    east: [-2.5, 2.5].flatMap((x) => [7, 13.1].map((y) => ({ x, y, width: 1.5, height: 2.2 }))),
    south: [
      { x: 0, y: 6, width: 1.5, height: 2.2 },
      { x: 0, y: 13, width: 1.3, height: 2.1 },
      { x: 0, y: 18.4, width: 1.1, height: 1.7 },
    ],
  });
  roof(frame(o, 18.1, -10.05, Math.PI / 2), -4.55, 4.55, -6.05, 6.05, 21.3, 29.9);
  for (const x of [12.2, 24.0])
    cornice(frame(o, x, -10.05, x < 18.1 ? -Math.PI / 2 : Math.PI / 2), 8.7, 20.95);
  polygonStair(o, -14.0, -12.3, 1.6, 0, 29.8, false);
  renaissanceStair(o);
  for (const [x, z, bottom, top] of [
    [-21.5, -16.8, 27, 33.5],
    [-12, -17.4, 30.6, 34.7],
    [-2, -17.4, 30.6, 34.2],
    [8, -17.4, 29, 34.4],
    [18.1, -10, 29.8, 33.5],
  ]) {
    box(o, 'limestone', [x - 0.58, bottom, z - 0.72], [x + 0.58, top, z + 0.72], stone);
    if (near(o)) {
      box(o, 'carved', [x - 0.7, top - 0.25, z - 0.85], [x + 0.7, top, z + 0.85], trim);
      box(o, 'recess', [x - 0.36, top, z - 0.5], [x + 0.36, top + 0.03, z + 0.5], glass);
    }
  }
}

function precinct(o) {
  const ids = earcut(court.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((j) => [court[j][0], 4.5, court[j][1]]);
    if ((p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) < 0)
      p.reverse();
    triangle(o, 'limestone', p, [0.75, 0.72, 0.63]);
    triangle(o, 'limestone', p.map((v) => [v[0], 0, v[2]]).reverse(), [0.66, 0.63, 0.53]);
  }
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length];
    face(
      o,
      'limestone',
      [
        [a[0], 0, a[1]],
        [a[0], 4.5, a[1]],
        [b[0], 4.5, b[1]],
        [b[0], 0, b[1]],
      ],
      [0.66, 0.63, 0.53],
    );
  }
  // Keep parapets on the southern retaining boundary; occupied returns remain separate masses.
  for (let i = 4; i < 17; i++) {
    const a = court[i],
      b = court[i + 1];
    if (o.detail === 'skyline' && Math.hypot(b[0] - a[0], b[1] - a[1]) < 6) continue;
    beam(o, 'limestone', [a[0], 5.05, a[1]], [b[0], 5.05, b[1]], 1.1, 0.65, stone);
    if (near(o)) beam(o, 'carved', [a[0], 5.66, a[1]], [b[0], 5.66, b[1]], 0.15, 0.78, trim);
  }
}
function renaissanceStair(o) {
  if (o.detail === 'skyline') {
    polygonStair(o, 9.9, -12.5, 2.05, 4.5, 27, true);
    return;
  }
  // The upper balustrade is a ring, not a full cap covering its slate-disc panels.
  const proxy = {
    ...o,
    addConvexPolygon: (slot, ref, p, n, uv, c) => {
      if (p.every((v) => v[1] >= 27 && v[1] <= 27.18)) return;
      o.addConvexPolygon(slot, ref, p, n, uv, c);
    },
  };
  polygonStair(proxy, 9.9, -12.5, 2.05, 4.5, 27, true);
  const ring = (r, y) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (-i * Math.PI) / 4 + Math.PI / 8;
      return [9.9 + Math.cos(a) * r, y, -12.5 + Math.sin(a) * r];
    });
  const a = ring(2.17, 27.18),
    b = ring(1.95, 27.18),
    c = ring(2.17, 27),
    d = ring(1.95, 27);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    face(o, 'carved', [a[i], a[j], b[j], b[i]], trim);
    face(o, 'carved', [c[j], c[i], d[i], d[j]], trim);
    face(o, 'carved', [d[j], d[i], b[i], b[j]], trim);
  }
}
function build(out, detail) {
  const o = { ...out, detail };
  precinct(o);
  buildings(o);
}
export const buildMontsoreauReviewedMaster = (out) => build(out);
export const buildMontsoreauReviewedDistrict = (out) => build(out, 'district');
export const buildMontsoreauReviewedStreet = (out) => build(out, 'street');
export const buildMontsoreauReviewedCloseup = (out) => build(out, 'closeup');
export function buildMontsoreauReviewedSkyline(out) {
  const mapped = Object.fromEntries(
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
  build(mapped, 'skyline');
}
