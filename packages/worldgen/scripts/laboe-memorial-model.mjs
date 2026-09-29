/** Original Laboe exterior from the owner's photographs and the published 1929 section. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft } from './authored-structure-mesh.mjs';
import { facade, face, transform } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0600_laboe_naval_memorial', 'map-frame.json'));
const map = JSON.parse(mapBytes);
const brick = [0.31, 0.18, 0.12],
  granite = [0.24, 0.235, 0.205],
  iron = [0.37, 0.4, 0.38];
const baseRoof = 6.5,
  terrace = 62.4,
  crown = 70.85;
// Stations trace the exterior section. Interior stair landings are deliberately not modeled.
const curve = [
  [0, 13.68],
  [baseRoof, 13.68],
  [8, 11.48],
  [10, 8.43],
  [12, 6.02],
  [15, 3.2],
  [18, 1.49],
  [22, 0.14],
  [27, -0.64],
  [34, -1.08],
  [43, -1.16],
  [52, -1.16],
  [terrace, -1.16],
];
function interp(points, y) {
  for (let i = 1; i < points.length; i++)
    if (y <= points[i][0]) {
      const a = points[i - 1],
        b = points[i],
        t = (y - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  return points.at(-1)[1];
}
function front(y) {
  if (y <= baseRoof) return curve[0][1];
  for (let i = 2; i < curve.length; i++)
    if (y <= curve[i][0]) {
      const a = curve[i - 1],
        b = curve[i],
        h = b[0] - a[0],
        t = (y - a[0]) / h;
      const slope = (j) => (curve[j][1] - curve[j - 1][1]) / (curve[j][0] - curve[j - 1][0]);
      const tangent = (j) => {
        if (j === 1) return slope(2);
        if (j === curve.length - 1) return slope(j);
        const left = slope(j),
          right = slope(j + 1);
        return left * right > 0 ? (2 * left * right) / (left + right) : 0;
      };
      return (
        (2 * Math.pow(t, 3) - 3 * t ** 2 + 1) * a[1] +
        (Math.pow(t, 3) - 2 * t ** 2 + t) * h * tangent(i - 1) +
        (-2 * Math.pow(t, 3) + 3 * t ** 2) * b[1] +
        (Math.pow(t, 3) - t ** 2) * h * tangent(i)
      );
    }
  return curve.at(-1)[1];
}
const half = (y) =>
  interp(
    [
      [0, 6.68],
      [baseRoof, 6.68],
      [10.2, 4.45],
      [terrace, 4.45],
    ],
    y,
  );
const back = (y) =>
  interp(
    [
      [0, -15.0],
      [baseRoof, -15.0],
      [10.2, -10.7],
      [terrace, -10.7],
    ],
    y,
  );
const frontHalf = (y) =>
  half(y) - 0.78 * Math.max(0, 1 - Math.max(0, y - baseRoof) / (10.2 - baseRoof));
const sideZ = (x, y) =>
  half(y) - (half(y) - frontHalf(y)) * Math.max(0, (x - front(y) + 2.07) / 2.07);
const smoothHeights = Array.from(
  { length: 113 },
  (_, i) => baseRoof + ((terrace - baseRoof) * i) / 112,
);
const holes = [];
for (let row = 0; row < 10; row++) {
  const y = 11.0 + row * 4.83,
    count = row === 0 ? 5 : row === 1 ? 4 : 3;
  for (let col = 0; col < count; col++) holes.push({ x: -8.25 + col * 1.38, y, w: 0.43, h: 1.48 });
}
for (let i = 0; i < 10; i++) holes.push({ x: -8.25 + i * 1.33, y: 2.7, w: 0.39, h: 1.46 });

function sides(out, sign) {
  const ys = [
    ...new Set([
      0,
      baseRoof,
      10.2,
      terrace,
      ...curve.map((v) => v[0]),
      ...smoothHeights,
      ...holes.flatMap((q) => [q.y, q.y + q.h]),
    ]),
  ].sort((a, b) => a - b);
  function panel(points, slot = 'brick', color = brick) {
    face(out, slot, sign === 1 ? points : [...points].reverse(), color);
  }
  for (let i = 1; i < ys.length; i++) {
    const y0 = ys[i - 1],
      y1 = ys[i],
      mid = (y0 + y1) / 2;
    const windows = holes.filter((q) => mid > q.y && mid < q.y + q.h);
    const spans = [[back(y0), back(y1)]];
    for (const q of windows)
      spans.push([q.x - q.w / 2, q.x - q.w / 2], [q.x + q.w / 2, q.x + q.w / 2]);
    spans.push([front(y0), front(y1)]);
    for (let j = 1; j < spans.length; j += 2) {
      const left = spans[j - 1],
        right = spans[j];
      const cut = [front(y0) - 2.07, front(y1) - 2.07];
      const pieces =
        left[0] < cut[0] && right[0] > cut[0]
          ? [
              [left, cut],
              [cut, right],
            ]
          : [[left, right]];
      for (const [a, b] of pieces)
        panel([
          [a[0], y0, sign * sideZ(a[0], y0)],
          [b[0], y0, sign * sideZ(b[0], y0)],
          [b[1], y1, sign * sideZ(b[1], y1)],
          [a[1], y1, sign * sideZ(a[1], y1)],
        ]);
    }
  }
  for (const q of holes) {
    const x0 = q.x - q.w / 2,
      x1 = q.x + q.w / 2,
      y0 = q.y,
      y1 = q.y + q.h,
      z0 = sign * half(y0),
      z1 = sign * half(y1),
      inset = sign * 0.34;
    const corners = [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ];
    const inner = corners.map(([x, y, z]) => [x, y, z - inset]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      panel([corners[j], corners[k], inner[k], inner[j]]);
    }
    panel(inner, 'glass', [0.055, 0.068, 0.07]);
    // Narrow pale frames and intermediate horizontal bars are visible in the slit openings.
    const z = sign * (half((y0 + y1) / 2) - 0.28);
    for (const x of [x0 + 0.023, x1 - 0.023])
      beam(out, 'metal', [x, y0 + 0.02, z], [x, y1 - 0.02, z], 0.036, 0.035, iron);
    beam(out, 'metal', [x0 + 0.03, y0 + 0.62, z], [x1 - 0.03, y0 + 0.62, z], 0.035, 0.035, iron);
    box(
      out,
      'darkstone',
      [x0 - 0.045, y0 - 0.055, Math.min(z0, z0 + sign * 0.12)],
      [x1 + 0.045, y0, Math.max(z0, z0 + sign * 0.12)],
      [0.36, 0.35, 0.31],
    );
  }
}
function body(out) {
  sides(out, 1);
  sides(out, -1);
  face(
    out,
    'brick',
    [
      [back(0), 0, -half(0)],
      [back(0), 0, half(0)],
      [back(baseRoof), baseRoof, half(baseRoof)],
      [back(baseRoof), baseRoof, -half(baseRoof)],
    ],
    brick,
  );
  // Inland wall is blank above its two ground-level doors; its genuine curved profile dominates.
  const f = transform(out, Math.PI / 2);
  facade(
    f,
    'brick',
    frontHalf(0) * 2,
    0,
    baseRoof,
    front(0),
    [-4.1, 4.1].map((x) => ({
      x,
      y: 0,
      w: 1.18,
      spring: 2.93,
      rise: 0,
      top: 2.93,
      depth: 0.42,
      trim: 0.12,
    })),
    brick,
  );
  for (const z of [-4.1, 4.1]) {
    box(
      out,
      'wood',
      [front(0) - 0.42, 0.05, z - 0.54],
      [front(0) - 0.34, 2.84, z + 0.54],
      [0.13, 0.16, 0.15],
    );
    for (let j = 0; j < 7; j++)
      box(
        out,
        'metal',
        [front(0) - 0.32, 0.1, z - 0.52 + j * 0.15],
        [front(0) - 0.3, 2.8, z - 0.505 + j * 0.15],
        iron,
      );
    box(out, 'darkstone', [front(0) - 0.2, 0, z - 0.72], [front(0) + 0.2, 0.12, z + 0.72], granite);
  }
  const samples = [
    baseRoof,
    ...Array.from({ length: 112 }, (_, i) => baseRoof + ((terrace - baseRoof) * (i + 1)) / 112),
  ];
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i];
    face(
      out,
      'brick',
      [
        [front(a), a, frontHalf(a)],
        [front(a), a, -frontHalf(a)],
        [front(b), b, -frontHalf(b)],
        [front(b), b, frontHalf(b)],
      ],
      brick,
    );
    face(
      out,
      'brick',
      [
        [back(a), a, -half(a)],
        [back(a), a, half(a)],
        [back(b), b, half(b)],
        [back(b), b, -half(b)],
      ],
      brick,
    );
  }
  // The step at the low entrance roof and the continuous dark flashing are external details.
  box(
    out,
    'metal',
    [front(0) - 0.15, baseRoof - 0.08, -frontHalf(0) - 0.08],
    [front(0) + 0.15, baseRoof + 0.08, frontHalf(0) + 0.08],
    iron,
  );
  for (const sign of [-1, 1])
    box(
      out,
      'metal',
      [back(0), baseRoof - 0.06, sign > 0 ? half(0) - 0.03 : -half(0) - 0.11],
      [front(0) - 2.07, baseRoof + 0.09, sign > 0 ? half(0) + 0.11 : -half(0) + 0.03],
      iron,
    );
  for (const sign of [-1, 1])
    beam(
      out,
      'metal',
      [front(0) - 2.07, baseRoof, sign * (half(0) + 0.04)],
      [front(0), baseRoof, sign * (frontHalf(0) + 0.04)],
      0.16,
      0.15,
      iron,
    );
  box(
    out,
    'concrete',
    [back(terrace), terrace - 0.18, -half(terrace)],
    [front(terrace), terrace, half(terrace)],
    [0.48, 0.5, 0.48],
  );
  // Short splayed entrance walls are part of the exact mapped footprint.
  for (const sign of [-1, 1])
    loft(
      out,
      'brick',
      [
        [
          [11.61, 0, sign * 6.84],
          [17.44, 0, sign * 9.75],
          [18.08, 0, sign * 8.72],
          [13.61, 0, sign * 5.9],
        ],
        [
          [11.61, 2.94, sign * 6.84],
          [17.44, 2.94, sign * 9.75],
          [18.08, 2.94, sign * 8.72],
          [13.61, 2.94, sign * 5.9],
        ],
      ].map((r) => (sign === 1 ? r : [...r].reverse())),
      brick,
    );
  // The bronze naval anchor emblem is reconstructed as relief, without invented text.
  const em = transform(out, Math.PI / 2, [front(0) + 0.035, 0, 0]);
  beam(em, 'metal', [0, 2.27, 0], [0, 3.02, 0], 0.055, 0.07, [0.52, 0.43, 0.23]);
  beam(em, 'metal', [-0.34, 2.73, 0], [0.34, 2.73, 0], 0.046, 0.07, [0.52, 0.43, 0.23]);
  for (const sign of [-1, 1]) {
    beam(em, 'metal', [0, 2.27, 0], [sign * 0.3, 2.42, 0], 0.06, 0.07, [0.52, 0.43, 0.23]);
    beam(
      em,
      'metal',
      [sign * 0.3, 2.42, 0],
      [sign * 0.33, 2.57, 0],
      0.06,
      0.07,
      [0.52, 0.43, 0.23],
    );
  }
}

function stoneWall(out, a, b, y0, y1, seed) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = -dz / len,
    nz = dx / len;
  const point = (u, y, d = 0) => [
    a[0] + (dx * u) / len + nx * d,
    y,
    a[1] + (dz * u) / len + nz * d,
  ];
  face(
    out,
    'laboe_granite',
    [point(0, y0), point(len, y0), point(len, y1), point(0, y1)],
    granite.map((v) => v * 0.8),
  );
  const rows = Math.ceil((y1 - y0) / 0.52);
  for (let r = 0; r < rows; r++) {
    const lo = y0 + ((y1 - y0) * r) / rows + 0.009,
      hi = y0 + ((y1 - y0) * (r + 1)) / rows - 0.009;
    let u = 0,
      j = 0;
    while (u < len - 0.02) {
      // Integer avalanche avoids repeating diagonal bands across the facade.
      const h = Math.imul((r + 1) ^ Math.imul(j + 1, 374761393) ^ seed, 668265263),
        mixed = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      const w = 0.52 + (mixed % 11) * 0.09,
        end = Math.min(len, u + w),
        tint = (((mixed >>> 8) % 19) - 9) * 0.005;
      const color = granite.map((v, i) => v + tint + (i === 0 ? ((mixed >>> 16) % 5) * 0.004 : 0));
      const p = [
        point(u + 0.008, lo, 0.025),
        point(end - 0.008, lo, 0.025),
        point(end - 0.008, hi, 0.025),
        point(u + 0.008, hi, 0.025),
      ];
      face(out, 'laboe_granite', p, color);
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4;
        face(
          out,
          'laboe_granite',
          [
            p[k],
            p[next],
            [p[next][0] - nx * 0.025, p[next][1], p[next][2] - nz * 0.025],
            [p[k][0] - nx * 0.025, p[k][1], p[k][2] - nz * 0.025],
          ],
          color,
        );
      }
      u = end;
      j++;
    }
  }
}
function spine(out) {
  const low = [
    [-18.03, -0.2],
    [-15.1, 2.96],
    [-10.57, 2.96],
    [-10.57, -2.96],
    [-15.1, -2.96],
  ];
  const upper = [
    [-18.03, -0.2],
    [-15.1, 2.96],
    [-4.65, 2.96],
    [-4.65, -2.96],
    [-15.1, -2.96],
  ];
  for (const [poly, y0, y1] of [
    [low, 0, terrace],
    [upper, terrace, crown],
  ]) {
    for (let i = 0; i < poly.length; i++)
      stoneWall(out, poly[i], poly[(i + 1) % poly.length], y0, y1, i * 7);
    const ring = poly.map(([x, z]) => [x, y1, z]);
    out.addConvexPolygon(
      'darkstone',
      'palette:#ffffff',
      ring,
      [0, 1, 0],
      (p) => [p[0], p[2]],
      [0.36, 0.37, 0.34],
    );
  }
  // Entry from the brick observation terrace to the upper stair chamber.
  box(
    out,
    'metal',
    [-4.69, terrace + 0.06, -0.57],
    [-4.62, terrace + 2.21, 0.57],
    [0.17, 0.19, 0.17],
  );
  box(
    out,
    'metal',
    [-4.614, terrace + 1.05, 0.39],
    [-4.59, terrace + 1.28, 0.44],
    [0.55, 0.56, 0.51],
  );
  const rail = (a, b, y) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = Math.ceil(len / 0.84);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(out, 'metal', [x, y, z], [x, y + 1.02, z], 0.043, 0.043, iron);
    }
    for (const h of [0.5, 1.02])
      beam(out, 'metal', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.038, 0.038, iron);
  };
  for (let i = 0; i < upper.length; i++)
    rail(upper[i], upper[(i + 1) % upper.length], crown + 0.03);
  rail([front(terrace), -4.39], [front(terrace), 4.39], terrace + 0.03);
  for (const sign of [-1, 1]) {
    rail([back(terrace), sign * 4.39], [front(terrace), sign * 4.39], terrace + 0.03);
    rail([back(terrace), sign * 2.99], [back(terrace), sign * 4.39], terrace + 0.03);
  }
  // Thin roof conductor, constrained within the published 72 m complete height.
  beam(out, 'metal', [-11.8, crown, 0], [-11.8, 72, 0], 0.033, 0.033, [0.48, 0.49, 0.46]);
}
function build(out) {
  body(out);
  spine(out);
}

export const laboeMemorial = {
  id: 'n0600_laboe_naval_memorial',
  planId: 'N0600',
  title: 'Laboe Naval Memorial',
  wikidata: 'Q538382',
  authoringFile: 'laboe-memorial-model.mjs',
  build,
  size: [36.2, 72, 19.6],
  front: 'Native +X inland southeast; -X seaward northwest; +Z southwest',
  origin: 'Exact mapped tower footprint frame; Y=0 is the tower foot, not mean sea level',
  brief:
    'Distinctive curved red-clinker naval memorial tower with the seaward pointed granite spine, two observation terraces, recessed slit windows, separate inland entrance doors, short splayed entrance walls and fine metal roof guards.',
  refs: [
    'https://deutscher-marinebund.de/service/haeufige-fragen-faq/',
    'https://deutscher-marinebund.de/aktuelles/presseservice/',
    'https://deutscher-marinebund.de/berichtedmb/rettungscrew-gesucht-mission-marine-ehrenmal-erhalten/',
    'https://commons.wikimedia.org/wiki/File:Marinehrenmal-laboe-schnittzeichnungen-turm.gif',
    'https://www.openstreetmap.org/way/23039799',
  ],
  facts: {
    heightFromFootMeters: 72,
    topAboveSeaLevelMeters: 85,
    architect: 'Gustav August Munzer',
    openingYear: 1936,
    mappedPlanMeters: [36.166, 19.507],
    mainMaterials: ['red clinker brick', 'granite', 'metal guards'],
    reconstructedTerraceMeters: terrace,
    reconstructedCrownCopingMeters: crown,
    sectionSource:
      'Published 1929 Max Giese Eisenbetonbau section, checked against current owner photographs',
  },
  scaleBasis:
    'The owner distinguishes 72 m above the tower foot from 85 m above sea level. The exact-Q538382 OSM outline fixes the ground plan and small splayed wings. The published 1929 contractor section establishes the curved profile and vertically grouped slit windows; owner shore and courtyard photographs establish present granite cladding, terraces, railings and the directed seaward spine. Intermediate heights and small opening widths are proportional exterior reconstructions tied to the published overall height.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence:
      'Exact mapped tower footprint with Q538382. Its pointed granite bow faces northwest toward the Kiel Fjord; the curved blank entrance wall faces the inland memorial courtyard southeast, as corroborated by the owner photographs.',
    limitations:
      'Ground contact uses host terrain. The neighboring memorial hall, colonnaded courtyard and U-995 submarine are separate site structures.',
  },
  limits: [
    'Exterior terrace elevations, rail spacing, mortar joints and slit widths are proportioned from the section and owner photographs; individual blocks are original reconstructions.',
    'Temporary scaffolding, staining and repair marks vary by maintenance campaign. Interior memorial rooms and stairs are outside this exterior asset.',
    'The adjoining courtyard galleries, memorial hall and submarine are separate assets, not part of this tower footprint.',
  ],
  cameras: [
    { name: 'curved-inland-face', position: [92, 45, 83], lookAt: [-3, 35, 0] },
    { name: 'seaward-granite-spine', position: [-110, 51, -106], lookAt: [-7, 35, 0] },
    { name: 'slit-windows-and-curve', position: [25, 37, 83], lookAt: [-3, 32, 0] },
    { name: 'roof-terraces', position: [20, 90, 47], lookAt: [-8, 64, 0] },
    { name: 'inland-entry', position: [34, 10, 20], lookAt: [11, 3.3, 0] },
    { name: 'far-silhouette', position: [145, 80, -148], lookAt: [-4, 34, 0] },
  ],
};
