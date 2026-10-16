/** Zhendong Gate, Shanhaiguan. Medium-fi exterior; meters, Y up, linear colors. */
import './install-deterministic-math.mjs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

// Palette swatches are sRGB; glTF COLOR_0 is linear. No baked lighting or AO.
export const shanhaiPalette = {
  masonry: '#a3a093',
  roof: '#646961',
  red: '#b34837',
  trim: '#436d66',
  cream: '#e8dfbe',
  recess: '#3e444a',
  ridge: '#a99a70',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
const c = Object.fromEntries(Object.entries(shanhaiPalette).map(([k, v]) => [k, linear(v)]));
const rect = (o, slot, x, y, z, w, h, d, col) =>
  box(o, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c[col]);
function face(o, slot, points, col) {
  // A folded roof quad is split into planes with independent hard normals.
  for (let i = 1; i + 1 < points.length; i++) {
    const p = [points[0], points[i], points[i + 1]];
    o.addTriangle(
      slot,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      c[col],
    );
  }
}
function frame(o, a) {
  const cs = Math.cos(a),
    sn = Math.sin(a),
    rot = ([x, y, z]) => [x * cs + z * sn, y, -x * sn + z * cs];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) => o[k](s, r, p.map(rot), rot(n), uv, col),
    ]),
  );
}
function platform(o, detail) {
  const n = detail === 0 ? 6 : detail === 1 ? 10 : 16,
    r = 2.4,
    spring = 4.3,
    front = 13,
    back = -14;
  for (const side of [-1, 1])
    rect(
      o,
      'brick',
      (side * (22 + r)) / 2,
      0,
      (front + back) / 2,
      22 - r,
      12,
      front - back,
      'masonry',
    );
  // Real, open barrel passage: no dark disc covering an otherwise solid block.
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const x0 = r * Math.cos(a),
      y0 = spring + r * Math.sin(a),
      x1 = r * Math.cos(b),
      y1 = spring + r * Math.sin(b);
    face(
      o,
      'brick',
      [
        [x1, y1, front],
        [x0, y0, front],
        [x0, 12, front],
        [x1, 12, front],
      ],
      'masonry',
    );
    face(
      o,
      'brick',
      [
        [x0, y0, back],
        [x1, y1, back],
        [x1, 12, back],
        [x0, 12, back],
      ],
      'masonry',
    );
    face(
      o,
      'brick',
      [
        [x0, y0, front],
        [x1, y1, front],
        [x1, y1, back],
        [x0, y0, back],
      ],
      'masonry',
    );
    face(
      o,
      'brick',
      [
        [x0, 12, front],
        [x0, 12, back],
        [x1, 12, back],
        [x1, 12, front],
      ],
      'masonry',
    );
  }
  rect(o, 'brick', 0, 12, 0, 44.7, 0.45, 27.7, 'masonry');
  for (const side of [-1, 1]) {
    rect(o, 'brick', side * 30, 0, 9, 16, 11.7, 8, 'masonry');
    rect(o, 'brick', side * 30, 11.7, 12.6, 16, 1.3, 0.8, 'masonry');
    rect(o, 'brick', side * 30, 11.7, 5.4, 16, 0.8, 0.8, 'masonry');
    if (detail > 0)
      for (let x = 23; x < 38; x += 2.7)
        rect(o, 'brick', side * x, 13, 12.6, 1.5, 1, 0.8, 'masonry');
  }
  // Platform rim is low: retain the tower's visible lower-storey masonry.
  for (const z of [-13.6, 13.4]) rect(o, 'brick', 0, 12.45, z, 44.7, 0.65, 0.5, 'masonry');
  if (detail >= 2) {
    // Selected portal moulding, not individual stone blocks or mortar geometry.
    const rr = r + 0.35;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n;
      face(
        o,
        'brick',
        [
          [r * Math.cos(a), spring + r * Math.sin(a), 13.06],
          [rr * Math.cos(a), spring + rr * Math.sin(a), 13.06],
          [rr * Math.cos(b), spring + rr * Math.sin(b), 13.06],
          [r * Math.cos(b), spring + r * Math.sin(b), 13.06],
        ],
        'ridge',
      );
    }
    for (const s of [-1, 1])
      rect(o, 'brick', s * (r + 0.175), 0, 13.08, 0.35, spring, 0.16, 'ridge');
    const count = detail === 3 ? 32 : 16;
    for (let i = 0; i < count; i++)
      rect(
        o,
        'brick',
        -37 + ((i + 0.5) * 15) / count,
        0,
        0,
        15 / count,
        (12 * (i + 1)) / count,
        4.2,
        'masonry',
      );
  }
}
// Eight-point rectangle makes the corners sweep up while the long eaves stay low.
function ring(x, z, y, lift) {
  return [
    [-x, y + lift, -z],
    [0, y, -z],
    [x, y + lift, -z],
    [x, y, 0],
    [x, y + lift, z],
    [0, y, z],
    [-x, y + lift, z],
    [-x, y, 0],
  ];
}
function roof(o, upper, detail) {
  const rings = upper
    ? [ring(12.1, 7.05, 21.8, 0.65), ring(10.8, 5.25, 22.3, 0.25), ring(8.4, 3, 23.5, 0)]
    : [ring(11.6, 6.8, 16.6, 0.55), ring(10.55, 5.35, 17.15, 0.2), ring(9.7, 4.8, 18.1, 0)];
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8;
      face(o, 'slate', [rings[k - 1][j], rings[k - 1][i], rings[k][i], rings[k][j]], 'roof');
    }
  // Deep, painted eave fascia remains visible even in Economy without shadows.
  for (let i = 0; i < 8; i++) {
    const a = rings[0][i],
      b = rings[0][(i + 1) % 8];
    face(o, 'wood', [a, b, [b[0], b[1] - 0.35, b[2]], [a[0], a[1] - 0.35, a[2]]], 'trim');
  }
  if (upper) {
    for (const z of [-3, 3]) {
      const p = [
        [-8.4, 23.5, z],
        [8.4, 23.5, z],
        [8.4, 25.35, 0],
        [-8.4, 25.35, 0],
      ];
      if (z < 0) p.reverse();
      face(o, 'slate', p, 'roof');
    }
    for (const x of [-8.4, 8.4]) {
      const p = [
        [x, 23.5, -3],
        [x, 25.35, 0],
        [x, 23.5, 3],
      ];
      if (x < 0) p.reverse();
      face(o, 'wood', p, 'trim');
    }
    rect(o, 'slate', 0, 25.35, 0, 17.5, 0.35, 0.42, 'ridge');
    if (detail > 0)
      for (const s of [-1, 1]) {
        beam(o, 'slate', [s * 8.45, 25.5, 0], [s * 9.2, 26, 0], 0.35, 0.4, c.ridge);
        beam(o, 'slate', [s * 9.2, 26, 0], [s * 9, 26.45, 0], 0.28, 0.3, c.ridge);
      }
  }
  if (detail >= 2) {
    // Sparse bracket blocks and prominent hip ribs; omit individual roof tiles.
    for (const z of [-1, 1])
      for (let x = -9.6; x <= 9.7; x += 1.6)
        rect(o, 'wood', x, upper ? 21.3 : 16.1, z * (upper ? 6.2 : 6.0), 0.38, 0.4, 0.7, 'ridge');
    for (const s of [-1, 1])
      for (const t of [-1, 1]) {
        const start = upper ? [s * 8.4, 23.55, t * 3] : [s * 9.7, 18.15, t * 4.8],
          end = upper ? [s * 12.1, 22.48, t * 7.05] : [s * 11.6, 17.18, t * 6.8];
        beam(o, 'slate', start, end, 0.24, 0.2, c.ridge);
      }
  }
}
// Five simplified stroke glyphs, displayed right to left. Original geometry, no font or image.
const glyphs = [
  [
    [
      [0.1, 0.9],
      [0.9, 0.9],
    ],
    [
      [0, 0.62],
      [1, 0.62],
    ],
    [
      [0.5, 0.9],
      [0.45, 0.4],
      [0, 0],
    ],
    [
      [0.48, 0.42],
      [1, 0],
    ],
  ],
  [
    [
      [0, 0.9],
      [1, 0.9],
    ],
    [
      [0.48, 0.9],
      [0.48, 0],
    ],
    [
      [0.52, 0.55],
      [0.9, 0.32],
    ],
  ],
  [
    [
      [0.08, 1],
      [0, 0.8],
    ],
    [
      [0.1, 0.92],
      [0.43, 0.92],
    ],
    [
      [0.55, 1],
      [0.48, 0.8],
    ],
    [
      [0.57, 0.92],
      [1, 0.92],
    ],
    [
      [0.2, 0.79],
      [0.28, 0.69],
    ],
    [
      [0.71, 0.79],
      [0.77, 0.69],
    ],
    [
      [0.1, 0.61],
      [0.9, 0.61],
      [0.9, 0.4],
      [0.15, 0.4],
      [0.1, 0.2],
      [0.93, 0.2],
      [0.9, 0],
    ],
    [
      [0.5, 0.65],
      [0.5, 0],
    ],
    [
      [0.45, 0.22],
      [0, 0],
    ],
  ],
  [
    [
      [0.05, 0.47],
      [0.95, 0.53],
    ],
  ],
  [
    [
      [0, 0],
      [0, 1],
      [0.4, 1],
      [0.4, 0.65],
      [0, 0.65],
    ],
    [
      [0.6, 0.65],
      [1, 0.65],
      [1, 1],
      [0.6, 1],
      [0.6, 0.65],
    ],
    [
      [1, 0.65],
      [1, 0],
      [0.87, 0],
    ],
    [
      [0.02, 0.83],
      [0.4, 0.83],
    ],
    [
      [0.6, 0.83],
      [0.98, 0.83],
    ],
    [
      [0.25, 0.56],
      [0.39, 0.4],
      [0.2, 0.4],
    ],
    [
      [0.65, 0.56],
      [0.8, 0.4],
      [0.57, 0.4],
    ],
    [
      [0.2, 0.28],
      [0.8, 0.28],
    ],
    [
      [0.3, 0.38],
      [0.3, 0.17],
      [0.2, 0.04],
    ],
    [
      [0.7, 0.38],
      [0.7, 0.05],
    ],
  ],
];
function plaque(o, detail, z) {
  rect(o, 'wood', 0, 19.65, z, 6.5, 1.85, 0.28, 'cream');
  if (detail < 2) return;
  for (let i = 0; i < 5; i++)
    for (const stroke of glyphs[i])
      for (let j = 1; j < stroke.length; j++) {
        const point = ([x, y]) => [
          2.48 - i * 1.23 + (x - 0.5) * 1.05,
          19.8 + y * 1.5,
          z + (z > 0 ? 0.16 : -0.16),
        ];
        beam(o, 'recess', point(stroke[j - 1]), point(stroke[j]), 0.085, 0.06, c.recess);
      }
}
function tower(o, detail) {
  rect(o, 'brick', 0, 12.45, 0, 20, 4.5, 10.1, 'masonry');
  rect(o, 'wood', 0, 17.65, 0, 19.4, 4.35, 9.6, 'red');
  roof(o, false, detail);
  roof(o, true, detail);
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const g = frame(o, a),
      long = a % Math.PI === 0,
      w = long ? 20 : 10.1,
      z = long ? 5.08 : 10.03;
    if (detail > 0) {
      // Lower-storey paired arrow windows across three outward elevations.
      if (a !== Math.PI)
        for (const y of [13.15, 15])
          for (let i = 0; i < (long ? 9 : 4); i++) {
            const x = (i - ((long ? 9 : 4) - 1) / 2) * (long ? 2 : 2.1);
            rect(g, 'recess', x, y, z, 0.72, 1, 0.06, 'recess');
            if (detail >= 2) rect(g, 'wood', x, y + 1, z + 0.04, 0.95, 0.16, 0.18, 'red');
          }
      else rect(g, 'wood', 0, 12.46, z, 1.85, 3.4, 0.08, 'red');
      const count = long ? 9 : 4,
        uz = long ? 4.83 : 9.73;
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * (long ? 2.05 : 2);
        rect(g, 'recess', x, 18.25, uz, long ? 1.45 : 1.35, 2.5, 0.06, 'recess');
        if (detail >= 2) {
          rect(g, 'wood', x, 19.3, uz + 0.04, long ? 1.52 : 1.42, 0.16, 0.1, 'red');
          if (detail === 3)
            for (const s of [-1, 1])
              rect(g, 'wood', x + s * 0.3, 18.25, uz + 0.065, 0.14, 2.5, 0.12, 'red');
        }
      }
      if (detail >= 2)
        for (let i = 0; i <= count; i++)
          rect(
            g,
            'wood',
            (i - count / 2) * (long ? 2.05 : 2),
            17.8,
            uz + 0.1,
            0.24,
            3.7,
            0.2,
            'red',
          );
      for (const y of [17.85, 21.25])
        rect(g, 'wood', 0, y, uz + 0.11, w - 0.6, 0.28, 0.22, 'ridge');
    }
  }
  // West gallery carries the inscription; front sign is smaller and reads at block distance.
  plaque(frame(o, Math.PI), detail, 4.97);
  plaque(o, detail, 4.97);
}
export function buildShanhaiRuntime(out, level) {
  const detail = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  platform(out, detail);
  tower(out, detail);
}
export const buildShanhaiSkyline = (o) =>
  buildShanhaiRuntime(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, color) =>
          o[k](
            slot,
            ref,
            p,
            n,
            uv,
            color.map((v) => v * (slot === 'recess' ? 1 : 0.65)),
          ),
      ]),
    ),
    'skyline',
  );
export const shanhaiStudy = {
  id: 'N0259',
  key: 'shanhai_pass',
  title: 'Shanhai Pass',
  category: 'castle',
  wikidataId: 'Q1048381',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildShanhaiRuntime(o),
  brief:
    'Zhendong Gate: deep arched masonry platform, two upturned roof tiers, hip-and-gable crown and red upper gallery with a pale five-character plaque. Short city-wall attachments; no wider pass or coastal fortress.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: shanhaiPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    identityFeatures: [
      'Open arched platform',
      'Double-eaved hip-and-gable silhouette',
      'Red gallery and cream plaque',
    ],
    materialBudget: 4,
  },
  sourceFacts: {
    platformApproximateHeightMeters: 12,
    towerPublishedHeightMeters: 13.7,
    towerPublishedPlanMeters: [20, 10.1],
    mapIdentity: 'Named way/414001373; no Wikidata tag on the map feature',
    surveyedVerticalDatum: false,
  },
  reconstruction: {
    basis: 'Official scenic-area dimensions and photographs; named OSM gate footprint',
    scope: 'Zhendong Gate exterior with short adjoining wall stubs',
    referenceState: 'Conserved present-day gate; temporary flags and floral displays omitted',
  },
  scaleBasis:
    'Published tower plan and height, mapped platform envelope; reconstructed eaves and ornament proportions.',
  refs: [
    'https://www.shgjq.com/xwzx/283.jhtml',
    'https://artsandculture.google.com/story/MwWhBZEOAqWBCQ?hl=zh-CN',
    'https://www.openstreetmap.org/way/414001373',
  ],
  sourceDocuments: ['map-frame.json', 'reference-metadata.json'],
  dataAttribution:
    'Map data © OpenStreetMap contributors, ODbL-1.0. Reference photographs are linked evidence, not textures or redistributed files.',
  nativeAxes: {
    up: '+Y',
    longitudinal: '+X northwest along mapped gate face',
    front: '+Z outward northeast',
    origin: 'Mapped gate platform center; ground Y=0',
  },
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    reviewStatus: 'Draft: named-feature orientation; real-terrain fit pending',
  }),
  geographicNote:
    'Named East Gate footprint fixes the draft anchor and signed orientation. This feature has no exact Wikidata tag; identity is matched by name and documented location. Real-site fit remains pending and the wider city wall must not be replaced.',
  limitations: [
    'Platform and wall ends simplify the mapped outline. Stair location and vertical proportions are reconstructed, not surveyed.',
    'The 68 published arrow windows are represented by a visible rhythm, not an archaeological count. Painted patterns, calligraphy and roof beasts are deliberately simplified under the medium-fi standard.',
    'Context review uses procedural neighbors and canonical Earth lighting; actual terrain placement remains a separate pending review. Enclosed upper interiors are not modeled.',
  ],
  importReason:
    'Preserve authored medium-fi silhouette; four levels remove selected details explicitly and share central materials.',
  camera: { position: [60, 39, 79], lookAt: [0, 11, 0], fov: 43 },
  qaCameras: [
    { name: 'gate-arch-and-roof-tiers', position: [4, 15, 79], lookAt: [0, 14, 0] },
    { name: 'west-gallery-and-plaque', position: [-12, 24, -54], lookAt: [0, 19, 0] },
    { name: 'hip-and-gable-profile', position: [48, 29, 6], lookAt: [0, 20, 0] },
    { name: 'roof-plan-and-wall-contact', position: [18, 79, 35], lookAt: [0, 10, 0] },
    { name: 'through-passage', position: [0, 3, 25], lookAt: [0, 4, -15] },
    { name: 'upper-gallery-rhythm', position: [20, 22, 31], lookAt: [0, 19, 0] },
  ],
};
