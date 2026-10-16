/** Preserved Lorraine Motel exterior; separate from the modern museum's full envelope. */
import './install-deterministic-math.mjs';
import { beam } from './authored-structure-mesh.mjs';
import { B, c, lettering, poly } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const main = [
    [-21.2835, 5.5],
    [21.2835, 5.5],
  ],
  jog = [
    [-31.012, 2.805],
    [-21.2835, 5.5],
  ],
  left = [
    [-33.871, 12.837],
    [-31.012, 2.805],
  ];
function segment(o, a, b, count, detail) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    n = [-u[1], u[0]],
    pt = (x, z) => [a[0] + u[0] * x + n[0] * z, a[1] + u[1] * x + n[1] * z];
  const box = (slot, x, y, z, w, h, d, col) => {
    const ring = [
      pt(x - w / 2, z - d / 2),
      pt(x + w / 2, z - d / 2),
      pt(x + w / 2, z + d / 2),
      pt(x - w / 2, z + d / 2),
    ];
    for (let i = 0; i < 4; i++) {
      const a = ring[i],
        b = ring[(i + 1) % 4];
      quad(
        o,
        slot,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + h, b[1]],
          [a[0], y + h, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        c[col],
      );
    }
    for (const [yy, normal] of [
      [y, [0, -1, 0]],
      [y + h, [0, 1, 0]],
    ])
      o.addConvexPolygon(
        slot,
        'palette:#ffffff',
        ring.map((p) => [p[0], yy, p[1]]),
        normal,
        (p) => [p[0], p[2]],
        c[col],
      );
  };
  // Room mass extends inward from the generalized map balcony edge; hidden back meets museum.
  box('concrete', len / 2, -3.8, -4.5, len, 11, 9, 'sand');
  box('roof', len / 2, 7.2, -4.5, len, 0.14, 9, 'roof');
  for (const [y, h] of [
    [0.2, 0.2],
    [3.15, 0.2],
    [6.2, 0.18],
  ])
    box('concrete', len / 2, y, 0.75, len + 0.15, h, 1.8, 'cream');
  box('metal', len / 2, 6.16, 1.62, len + 0.1, 0.23, 0.13, 'white');
  for (let i = 0; i < count; i++)
    for (const floor of [0, 1]) {
      const x = ((i + 0.5) * len) / count,
        y = 0.4 + floor * 3.05;
      const door = x + (i % 2 === 0 ? -1.55 : 1.55),
        win = x + (i % 2 === 0 ? 0.6 : -0.6);
      if (!detail) {
        for (const [xx, yy, w, h, color] of [
          [door, y, 1, 2.4, 'mint'],
          [win, y + 0.3, 2.5, 1.92, 'curtain'],
        ]) {
          const a = pt(xx - w / 2, 0.15),
            b = pt(xx + w / 2, 0.15);
          quad(
            o,
            'metal',
            [
              [a[0], yy, a[1]],
              [b[0], yy, b[1]],
              [b[0], yy + h, b[1]],
              [a[0], yy + h, a[1]],
            ],
            [n[0], 0, n[1]],
            c[color],
          );
        }
        continue;
      }
      box('metal', door, y, 0.035, 1.0, 2.4, 0.11, 'mint');
      box('metal', win, y + 0.2, 0.06, 2.72, 2.13, 0.13, 'white');
      box('glass', win, y + 0.3, 0.15, 2.5, 1.92, 0.045, 'curtain');
      if (detail) {
        box('metal', win, y + 0.3, 0.2, 0.055, 1.92, 0.045, 'white');
        box('metal', door, y + 2.07, 0.12, 0.9, 0.2, 0.035, 'glass');
        box('metal', door + 0.32, y + 1.05, 0.14, 0.045, 0.2, 0.035, 'dark');
        box('metal', win, y - 0.03, 0.31, 1.05, 0.35, 0.4, 'cream');
        for (const yy of [0.06, 0.15, 0.24])
          box('metal', win, y - 0.03 + yy, 0.53, 0.95, 0.024, 0.025, 'dark');
        const v = pt(x, 1.52);
        B(o, 'metal', v[0], 0.35, v[1], 0.07, 5.85, 0.07, 'mint');
        // Broad rectangular balcony-rail panels are legible without tiny pickets.
        for (const yy of [3.55, 4.23]) box('metal', x, yy, 1.55, len / count, 0.055, 0.055, 'dark');
        for (const xx of [x - len / count / 2, x + len / count / 2])
          box('metal', xx, 3.4, 1.55, 0.055, 0.9, 0.055, 'dark');
        box('metal', x, 3.8, 1.55, (len / count) * 0.77, 0.045, 0.055, 'dark');
        for (const xx of [x - (len / count) * 0.385, x + (len / count) * 0.385])
          box('metal', xx, 3.55, 1.55, 0.045, 0.3, 0.055, 'dark');
      }
    }
  if (!detail) for (const y of [3.6, 4.23]) box('metal', len / 2, y, 1.55, len, 0.07, 0.07, 'dark');
}
function disk(o, x, y, z, rx, ry, color, segments = 20) {
  const points = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push([x + Math.cos(t) * rx, y + Math.sin(t) * ry, z]);
  }
  o.addConvexPolygon('metal', 'palette:#ffffff', points, [0, 0, 1], (p) => [p[0], p[1]], c[color]);
  const back = points.map((p) => [p[0], p[1], p[2] - 0.18]);
  o.addConvexPolygon('metal', 'palette:#ffffff', back, [0, 0, -1], (p) => [p[0], p[1]], c[color]);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments,
      a = points[i],
      b = points[j];
    quad(o, 'metal', [back[i], back[j], b, a], [b[1] - a[1], a[0] - b[0], 0], c.dark);
  }
}
function sign(o, detail) {
  for (const x of [9.9, 12.1]) B(o, 'metal', x, -1.2, 23, 0.38, 10.7, 0.38, 'mint');
  B(o, 'metal', 11, 9.3, 23, 2.5, 0.35, 0.35, 'mint');
  B(o, 'metal', 11, 4.55, 23, 3.5, 1.4, 0.32, 'dark');
  B(o, 'metal', 11, 4.65, 23.2, 3.25, 1.2, 0.035, 'white');
  disk(o, 11, 8.25, 23.21, 2.45, 0.76, 'dark', detail ? 20 : 10);
  disk(o, 11, 8.25, 23.25, 2.35, 0.65, 'yellow', detail ? 20 : 10);
  for (let i = 0; i < 5; i++) {
    disk(o, 8.7 + i * 1.15, 6.85, 23.21, 0.65, 0.67, 'dark', detail ? 12 : 6);
    disk(o, 8.7 + i * 1.15, 6.85, 23.25, 0.6, 0.61, 'white', detail ? 12 : 6);
    if (detail) lettering(o, 'MOTEL'[i], 8.37 + i * 1.15, 6.44, 23.29, 0.88, 0.8, 'red');
  }
  if (detail) {
    lettering(o, 'LORRAINE', 8.95, 8.02, 23.29, 4.1, 0.47, 'dark');
    for (let i = 0; i < 6; i++) B(o, 'metal', 11, 4.76 + i * 0.17, 23.24, 3.1, 0.022, 0.02, 'dark');
  }
  const pts = [
    [10.25, 11.6, 23.25],
    [11.8, 9.9, 23.25],
    [10.55, 9.0, 23.25],
    [11, 9.7, 23.25],
  ];
  for (const [a, b, d] of [
    [0, 1, 3],
    [1, 2, 3],
  ])
    o.addTriangle(
      'metal',
      'palette:#ffffff',
      [pts[a], pts[b], pts[d]],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c.red,
    );
}
function stairs(o, x, z) {
  for (let i = 0; i < 12; i++)
    B(o, 'concrete', x, 0.35 + i * 0.255, z - i * 0.3, 1.8, 0.16, 0.34, 'cream');
  for (const xx of [x - 0.9, x + 0.9]) {
    beam(o, 'metal', [xx, 1.25, z + 0.1], [xx, 4.1, z - 3.5], 0.065, 0.065, c.mint);
    beam(o, 'metal', [xx, 0.55, z + 0.1], [xx, 3.4, z - 3.5], 0.06, 0.06, c.mint);
  }
}
function model(o, detail) {
  segment(o, ...main, 9, detail);
  segment(o, ...jog, 2, detail);
  segment(o, ...left, 2, detail);
  // Court platform is part of the preserved frontage; wider museum blocks are outside this model.
  if (detail)
    poly(
      o,
      'brick',
      [
        [-34, 14],
        [-29.5, 4.7],
        [-21.3, 7.2],
        [21.5, 7.2],
        [21.5, 11.5],
        [-20.5, 11.5],
        [-20.5, 14],
      ],
      -1.2,
      0.2,
      'sand',
    );
  else B(o, 'brick', 0, -1.2, 9.35, 43, 1.4, 4.3, 'sand');
  sign(o, detail);
  if (detail) {
    stairs(o, 19.3, 10.5);
    stairs(o, -20, 10.5);
    // Memorial wreath marks the room 306 balcony; faceted geometry, no photograph texture.
    const x = -13.8,
      y = 4.08,
      z = 7.12;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        b = ((i + 1) / 24) * Math.PI * 2;
      quad(
        o,
        'metal',
        [
          [x + Math.cos(a) * 0.58, y + Math.sin(a) * 0.75, z],
          [x + Math.cos(b) * 0.58, y + Math.sin(b) * 0.75, z],
          [x + Math.cos(b) * 0.35, y + Math.sin(b) * 0.49, z],
          [x + Math.cos(a) * 0.35, y + Math.sin(a) * 0.49, z],
        ],
        [0, 0, 1],
        c.white,
      );
    }
    B(o, 'metal', x, 4.55, z + 0.03, 0.3, 0.28, 0.06, 'red');
    B(o, 'metal', x + 0.13, 3.7, z + 0.03, 0.1, 0.65, 0.05, 'red');
  }
}
export function lorraine(o) {
  model(o, true);
}
export function lorraineSkyline(o) {
  model(o, false);
}
export const lorraineModel = {
  id: 'lorraine_motel',
  recipe: 'structure-lorraine-motel.mjs',
  key: 'lorraine_motel',
  cell: '9y/9yp',
  title: 'Lorraine Motel',
  brief:
    'Preserved courtyard-facing motel frontage, angled connecting bays and short return, mint doors, cream curtains, balcony panels, room 306 wreath, exterior stairs and freestanding Googie sign.',
  camera: [42, 23, 58],
  build: lorraine,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Signed front platform reference [0,8], source terrain retained independently; rear closure foundations extend to -3.8 m for coarse host-terrain relief and frontage platforms to -1.2 m.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-lorraine-motel.mjs',
    level: 'skyline',
    export: 'lorraineSkyline',
    errorMeters: 0.5,
    caps: { district: { triangles: 4000, errorMeters: 0.25, prune: true } },
  },
  limitations: [
    'Original medium-fi preserved motel exterior and sign; modern museum envelope, interiors, historic cars and neighboring buildings are outside scope.',
    'Protomaps frontage and separate balcony polygon control location and alignment. Room widths, wall depths, roof heights and sign position are photographic estimates. The museum donor map is schematic and is not used as geodetic coordinates.',
    'Hidden rear is a simplified attachment surface. Fine sign typography, room numbers, flowers and hardware are simplified. Photos remain local Qualla references and are not embedded.',
    'Independent coarse host terrain is retained for contact review; it is not a survey. No footprint suppression is requested for the combined museum polygon.',
  ],
};
