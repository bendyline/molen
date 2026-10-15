/** Fallingwater: crossed cantilevers and stone core above Bear Run, with uphill guest wing. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, c, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const framePath = new URL(
  '../../../content/worldgen/source/places/dp/dpp/fallingwater/map-frame.json',
  import.meta.url,
);
const buff = rgb('e1d2a4'),
  masonry = rgb('a8a795'),
  red = rgb('713e32'),
  water = rgb('566560'),
  rock = rgb('858676');
function polygon(o, r, y0, y1, color, slot = 'concrete', top = color) {
  r = cleanRing(r);
  if (
    r.reduce(
      (s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      color,
    );
  }
  const ii = earcut(r.flat());
  for (const [y, n, col] of [
    [y0, [0, -1, 0], color],
    [y1, [0, 1, 0], top],
  ])
    for (let i = 0; i < ii.length; i += 3) {
      const p = ii.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      o.addTriangle(
        slot,
        'palette:#ffffff',
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function rounded(x, z, w, d, r, detail) {
  if (!detail)
    return [
      [x - w / 2, z - d / 2],
      [x + w / 2, z - d / 2],
      [x + w / 2, z + d / 2],
      [x - w / 2, z + d / 2],
    ];
  const pts = [];
  for (const [cx, cz, start] of [
    [x + w / 2 - r, z + d / 2 - r, 0],
    [x - w / 2 + r, z + d / 2 - r, Math.PI / 2],
    [x - w / 2 + r, z - d / 2 + r, Math.PI],
    [x + w / 2 - r, z - d / 2 + r, Math.PI * 1.5],
  ])
    for (let i = 0; i <= 3; i++) {
      const a = start + (i * Math.PI) / 6;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  return pts;
}
function slab(o, x, z, w, d, y, h, detail, top = c.roof) {
  polygon(o, rounded(x, z, w, d, 0.16, detail > 1), y, y + h, buff, 'concrete', top);
}
function terrace(o, x, z, w, d, y, detail, { left = true, right = true, front = true } = {}) {
  slab(o, x, z, w, d, y - 0.28, 0.36, detail, c.cream);
  if (front) slab(o, x, z + d / 2 - 0.19, w, 0.42, y, 1.1, detail, buff);
  if (left) slab(o, x - w / 2 + 0.19, z, 0.42, d, y, 1.1, detail, buff);
  if (right) slab(o, x + w / 2 - 0.19, z, 0.42, d, y, 1.1, detail, buff);
}
function stoneBlock(o, x, y, z, w, h, d, detail) {
  B(o, 'stone', x, y, z, w, h, d, masonry);
  if (detail < 2) return;
  const rows = Math.floor(h / 0.22);
  for (let i = 0; i < rows; i++) {
    const yy = y + i * 0.22 + 0.045,
      shade = masonry.map((v) => v * (0.77 + ((i * 7) % 5) * 0.045)),
      protrusion = 0.04 + (i % 3) * 0.025;
    for (const sign of [-1, 1]) {
      quad(
        o,
        'concrete',
        [
          [x - w / 2, yy, z + sign * (d / 2 + protrusion)],
          [x + w / 2, yy, z + sign * (d / 2 + protrusion)],
          [x + w / 2, yy + 0.075, z + sign * (d / 2 + protrusion)],
          [x - w / 2, yy + 0.075, z + sign * (d / 2 + protrusion)],
        ],
        [0, 0, sign],
        shade,
      );
      quad(
        o,
        'concrete',
        [
          [x + sign * (w / 2 + protrusion), yy, z - d / 2],
          [x + sign * (w / 2 + protrusion), yy, z + d / 2],
          [x + sign * (w / 2 + protrusion), yy + 0.075, z + d / 2],
          [x + sign * (w / 2 + protrusion), yy + 0.075, z - d / 2],
        ],
        [sign, 0, 0],
        shade,
      );
    }
  }
}
function glazing(o, a, b, y, h, detail) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [dz / len, 0, -dx / len];
  const pp = (t, v, d = 0.025) => [a[0] + dx * t + n[0] * d, y + v, a[1] + dz * t + n[2] * d];
  quad(o, 'glass', [pp(0, 0), pp(1, 0), pp(1, h), pp(0, h)], n, c.glass);
  if (!detail) return;
  const count = Math.max(1, Math.round(len / (detail > 1 ? 1.25 : 2.5)));
  for (let i = 0; i <= count; i++)
    beam(o, 'metal', pp(i / count, 0, 0.035), pp(i / count, h, 0.035), 0.065, 0.075, red);
  for (const t of detail > 1 ? [0, 0.3, 0.75, 1] : [0, 1])
    beam(o, 'metal', pp(0, h * t, 0.045), pp(1, h * t, 0.045), 0.055, 0.065, red);
}
function glassRoom(o, x, z, w, d, y, h, detail) {
  // Clockwise perimeter produces outward normals on all four glazed sides.
  const r = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  for (let i = 0; i < 4; i++) glazing(o, r[i], r[(i + 1) % 4], y, h, detail);
}
function mainHouse(o, detail) {
  // Two broad first-floor terraces and the narrower upper master-bedroom terrace cross at right angles.
  slab(o, 2.4, 2.9, 18.9, 18.7, -0.35, 0.4, detail, c.cream);
  terrace(o, 2.4, 9.2, 18.9, 7.0, 0, detail);
  terrace(o, 13, 0.5, 10.1, 5.1, 0, detail, { left: false });
  glassRoom(o, 2.6, 1.6, 15.9, 8.0, 0.15, 2.85, detail);
  terrace(o, -12, -4.2, 9.8, 5.1, 3.3, detail, { right: false });
  terrace(o, 2.3, 6.3, 7.8, 13.0, 3.3, detail);
  terrace(o, 13, -0.1, 10.4, 5.5, 3.3, detail, { left: false });
  glassRoom(o, 4.5, 0.35, 12.0, 9.7, 3.45, 2.7, detail);
  slab(o, 7.5, 0.2, 22.5, 10.8, 6.2, 0.3, detail);
  // The narrow open pergola lines the upper terrace, leaving sky visible between its beams.
  if (detail)
    for (let j = 0; j < 9; j++) B(o, 'concrete', 7.3, 3.5, 1.2 + j * 1.3, 2.4, 0.22, 0.22, buff);
  terrace(o, 3.7, -2.7, 12.3, 5.9, 6.55, detail, { left: false });
  glassRoom(o, 3.5, -4.4, 10.9, 3.7, 6.68, 2.45, detail);
  slab(o, 3.3, -4.4, 12.7, 5.2, 9.15, 0.27, detail);
  // Offset layered-sandstone chimney/core and glazed stair slot remain exposed through the terraces.
  stoneBlock(o, -3.6, -5.1, 0.1, 2.8, 16.8, 4.2, detail);
  stoneBlock(o, -6.5, -3.9, -4.3, 3.0, 14.9, 3.2, detail);
  stoneBlock(o, -0.4, -5.5, 0, 1.35, 13.2, 3.4, detail);
  glazing(o, [-5.45, -2.6], [-5.45, 2.2], 0.2, 9.8, detail);
  stoneBlock(o, 10.3, -5.7, 3.3, 2.1, 5.7, 4.4, detail);
  stoneBlock(o, -4.1, -5.7, 5.7, 3.4, 5.7, 3.3, detail);
  stoneBlock(o, 12.0, -3.6, -2.4, 3.2, 3.6, 3.2, detail);
  if (detail) {
    // Three underside beams terminate before the free terrace edge.
    for (const x of [0, 3.3, 6.6])
      beam(o, 'concrete', [x, -0.6, 10.1], [x, -3.6, 4.7], 0.55, 0.65, buff);
    // Hanging living-room stair reaches the stream without enclosing the space under the house.
    for (let i = 0; i < 13; i++)
      B(o, 'concrete', 10.6, 0.05 - i * 0.25, 5.4 + i * 0.32, 2.2, 0.12, 0.38, buff);
    for (const x of [9.4, 11.8]) {
      beam(o, 'metal', [x, 1.05, 5.4], [x, -2.2, 9.55], 0.045, 0.045, red);
      for (let i = 0; i < 13; i++)
        beam(
          o,
          'metal',
          [x, 0.05 - i * 0.25, 5.4 + i * 0.32],
          [x, 1.05 - i * 0.25, 5.4 + i * 0.32],
          0.035,
          0.035,
          red,
        );
    }
    B(o, 'concrete', 10.6, -3.2, 9.6, 2.7, 0.18, 1.1, buff);
    for (let i = 0; i < 12; i++)
      B(o, 'concrete', -5.6, 3.25 + i * 0.27, -2.7 - i * 0.25, 1.25, 0.15, 0.32, buff);
  }
}
function guestWing(o, frame, detail) {
  const r = frame.features[2].rings[0];
  polygon(o, r, 6.0, 10.1, masonry, 'stone', c.cream);
  polygon(o, r, 10.1, 12.8, buff, 'concrete', c.roof);
  polygon(o, r, 12.8, 13.05, buff);
  if (detail) {
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1];
      if (Math.hypot(dx, dz) < 5) continue;
      const aa = [a[0] + dx * 0.08, a[1] + dz * 0.08],
        bb = [a[0] + dx * 0.92, a[1] + dz * 0.92];
      glazing(o, aa, bb, 10.6, 1.8, detail);
    }
    // Carport openings are shallow dark bays in the long guest-wing arm, with three cream piers.
    for (const x of [3, 8.5, 14]) {
      B(o, 'glass', x, 10.15, -25.24, 4.7, 2.5, 0.09, 'dark');
      B(o, 'concrete', x + 2.55, 10.1, -25.25, 0.32, 2.8, 0.5, buff);
    }
  }
  const points = [
    [3.6, -7.4],
    [5.2, -11.8],
    [0.2, -12.8],
    [-4.6, -16],
    [-6.1, -21],
    [-4.2, -25.3],
    [-2.8, -27],
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1],
      y0 = (i / (points.length - 1)) * 10.1,
      y1 = ((i + 1) / (points.length - 1)) * 10.1;
    beam(o, 'concrete', [a[0], y0, a[1]], [b[0], y1, b[1]], 2.25, 0.25, buff);
    beam(o, 'concrete', [a[0], y0 + 2.8, a[1]], [b[0], y1 + 2.8, b[1]], 2.6, 0.18, buff);
    if (detail) {
      B(o, 'stone', a[0], y0 - 0.5, a[1], 0.35, 3.35, 0.35, masonry);
      const steps = 5;
      for (let j = 0; j < steps; j++) {
        const t = (j + 0.5) / steps;
        B(
          o,
          'concrete',
          a[0] + (b[0] - a[0]) * t,
          y0 + (y1 - y0) * t + 0.08,
          a[1] + (b[1] - a[1]) * t,
          1.8,
          0.1,
          0.35,
          buff,
        );
      }
    }
  }
}
function streamAndLedges(o, detail) {
  // Connected strata, rather than freestanding boulders, carry the house above the falls.
  // Their landward ends overlap the preserved host terrain; the far banks are not reconstructed.
  const upper = [
    [-19, -2],
    [-10, -3],
    [-2, -1],
    [13, 1],
    [20, 6],
    [19, 10],
    [12, 12],
    [5, 13.5],
    [1, 15],
    [-5, 16],
    [-10, 14.5],
    [-15, 10],
    [-19, 6],
  ];
  const neck = [
    [-18, -2],
    [-9, -2],
    [-2, 0],
    [12, 2],
    [18, 6],
    [17, 9],
    [10, 11],
    [3, 12.2],
    [-1, 13.4],
    [-5, 14.3],
    [-9, 13],
    [-13, 9],
    [-18, 5],
  ];
  const lower = [
    [-23, 13],
    [-15, 11],
    [-7, 14],
    [-3, 17],
    [5, 19],
    [7, 23],
    [1, 27],
    [-9, 30],
    [-19, 30],
    [-25, 24],
    [-26, 18],
  ];
  polygon(
    o,
    neck,
    -11.8,
    -5.2,
    rock.map((v) => v * 0.68),
    'concrete',
  );
  polygon(o, upper, -5.2, -4.15, rock, 'concrete', masonry);
  polygon(
    o,
    lower,
    -13.3,
    -10.6,
    rock,
    'concrete',
    rock.map((v) => v * 1.1),
  );
  if (detail) {
    for (let i = 0; i < (detail > 1 ? 7 : 2); i++) {
      const y = -4.32 - i * (detail > 1 ? 0.15 : 0.52);
      polygon(
        o,
        upper.map(([x, z], j) => [x + ((j % 3) - 1) * 0.07, z + (j % 2 ? 0.08 : -0.06)]),
        y - 0.07,
        y,
        rock.map((v) => v * (0.7 + (i % 3) * 0.08)),
        'concrete',
      );
    }
    // A second low ledge catches the falling water before the downstream pool.
    polygon(
      o,
      [
        [-18, 22],
        [-12, 20],
        [-7, 21],
        [-4, 24],
        [-8, 27],
        [-16, 28],
        [-20, 25],
      ],
      -12.9,
      -11.15,
      rock.map((v) => v * 0.9),
      'concrete',
    );
  }
  // Width measured across the mapped flow direction. The cascade drops at the cliff lip.
  const stations = [
    [19, 8, -4.05, 2.2],
    [12, 10, -4.06, 2.6],
    [5, 11.8, -4.08, 2.8],
    [0, 13.4, -4.1, 2.9],
    [-3.5, 15.5, -4.2, 3],
    [-5.1, 17.9, -10.5, 3.2],
    [-10.5, 22, -10.52, 3.2],
    [-18, 26, -10.56, 2.3],
  ];
  const edges = stations.map((s, i) => {
    const a = stations[Math.max(0, i - 1)],
      b = stations[Math.min(stations.length - 1, i + 1)],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len;
    return [
      [s[0] + nx * s[3], s[2], s[1] + nz * s[3]],
      [s[0] - nx * s[3], s[2], s[1] - nz * s[3]],
    ];
  });
  for (let i = 0; i < edges.length - 1; i++) {
    const p = [edges[i][0], edges[i][1], edges[i + 1][1], edges[i + 1][0]];
    let n = normalFor(...p);
    if (n[1] < 0) {
      p.reverse();
      n = normalFor(...p);
    }
    // Opaque muted water avoids turquoise window-glass reflections on a mountain stream.
    quad(o, 'concrete', p, n, water);
  }
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  for (let j = 0; j < (detail ? 17 : 3); j++) {
    const count = detail ? 17 : 3,
      t = (j + 0.2) / count,
      w = (j % 4 === 0 ? 0.75 : 0.38) / count,
      topA = mix(edges[4][0], edges[4][1], t),
      topB = mix(edges[4][0], edges[4][1], t + w),
      endA = mix(edges[5][0], edges[5][1], t + 0.015),
      endB = mix(edges[5][0], edges[5][1], t + w + 0.015);
    const p = [topA, topB, endB, endA].map((v) => [v[0] - 0.025, v[1] + 0.03, v[2] + 0.025]);
    let n = normalFor(...p);
    if (n[1] < 0) {
      p.reverse();
      n = normalFor(...p);
    }
    quad(
      o,
      'concrete',
      p,
      n,
      c.white.map((v) => v * (0.68 + (j % 4) * 0.06)),
    );
  }
}
function build(o, frame, detail) {
  mainHouse(o, detail);
  guestWing(o, frame, detail);
  streamAndLedges(o, detail);
}
export function fallingwater(o, frame) {
  build(o, frame, 3);
}
export function fallingwaterSkyline(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 0);
}
export function fallingwaterDistrict(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 1);
}
export function fallingwaterStreet(o) {
  build(o, JSON.parse(fs.readFileSync(framePath)), 2);
}
const surfaces = {
  ...landmarkSurfaces,
  glass: { ...landmarkSurfaces.glass, localRef: 'palette:#ffffff' },
};
export const fallingwaterModel = {
  id: 'fallingwater',
  recipe: 'structure-fallingwater.mjs',
  key: 'fallingwater',
  cell: 'dp/dpp',
  title: 'Fallingwater',
  brief:
    'Crossed buff concrete cantilevers, stratified sandstone core, red window frames and hanging stream stair above Bear Run, with an uphill guest wing and covered curved connection.',
  camera: [-31, 11, 43],
  lookAt: [1, 1, 2],
  qaCameras: [
    { name: 'front', position: [0, 7, 55], lookAt: [1, 0, 3] },
    { name: 'back', position: [-32, 26, -66], lookAt: [1, 5, -15] },
  ],
  mediumFiContext: { scale: 0.7 },
  build: fallingwater,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Landward main-house junction [4,-8.2] defines the 406.5873 m host datum. Unmodified terrain spans -10.645391..9.725998 m across the three envelopes. Guest floor 10.1 m and authored rock ledges are visual interpretations checked separately against coarse host relief.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-fallingwater.mjs',
    level: 'skyline',
    export: 'fallingwaterSkyline',
    errorMeters: 1.1,
    authoredLevels: {
      district: { export: 'fallingwaterDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'fallingwaterStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior based on two inspected Qualla originals, supplementary local layout images and generalized main-house/covered-walk/guest-wing map controls; not a measured architectural survey.',
    'Crossing terrace axes, stone core, red glazing, hanging stair and clear underside are modeled. Exact room plans, hidden facades, guest-wing openings, structural repairs and roof drains are simplified interpretations.',
    'The short static stream, cascade and rock ledges illustrate the house-waterfall relationship. They are not a hydrologic simulation, exact geological reconstruction or current water-level claim. Surrounding terrain is preserved rather than flattened.',
    'Covered connection and guest wing follow mapped outlines at approximate relative elevations. Coarse terrain is not a surveyed floor datum; other host elevation datasets may require new placement review.',
    'No interior furnishings, sculpture replica, surrounding forest or external image textures are included. Local reference photography remains outside runtime packs.',
  ],
};
