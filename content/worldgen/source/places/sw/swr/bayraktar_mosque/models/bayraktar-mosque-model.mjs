/** Bayraktar Mosque on the Constanza Bastion, April 1999. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const grid = read('terrain-grid');
const q = plan.section;
const [a, b] = q.roofAxisEdge.map((i) => outline[i]);
const d = b.map((x, i) => x - a[i]);
const [u, v] = d.map((x) => x / Math.hypot(...d));
const at = (x, y, z) => [x * u - z * v, y, x * v + z * u];
const from = ([x, z]) => [x * u + z * v, -x * v + z * u];
const up = [0, 1, 0];
const north = [v, 0, -u];
const south = [-v, 0, u];
const east = [u, 0, v];
const west = [-u, 0, -v];
const mix = (a, b, t) => a + (b - a) * t;
const surfaces = {
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  limestone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  dressed: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.88, metallic: 0 },
  cap: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.83, metallic: 0.12 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68, metallic: 0.04 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'beb29a',
    shadow: 'aa9b84',
    flank: 'b3a68d',
    apron: 'a89b80',
    stone: 'b3a080',
    stoneLight: 'c5b495',
    trim: 'cfc0a2',
    tile: 'b56542',
    edge: 'a55738',
    warm: 'bb6d44',
    dark: '4a514a',
    door: '695c47',
    glass: '5d6964',
    gray: '6d6d6e',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function height([x, z]) {
  const u = (x - grid.origin[0]) / grid.stepMeters,
    v = (z - grid.origin[1]) / grid.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = grid.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    grid.modelDatumElevationMeters
  );
}

function panel(out, slot, points, desired, color) {
  const n = normalFor(...points);
  const ordered =
    n.reduce((sum, x, i) => sum + x * desired[i], 0) > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, color);
  else triangle(out, slot, ordered, color);
}

function area(out, slot, toWorld, outline, depth, normal, color, holes = []) {
  const vertices = outline.slice(),
    offsets = [];
  for (const hole of holes) {
    offsets.push(vertices.length);
    vertices.push(...hole);
  }
  const ids = earcut(vertices.flat(), offsets);
  for (let i = 0; i < ids.length; i += 3)
    panel(
      out,
      slot,
      ids.slice(i, i + 3).map((j) => toWorld(...vertices[j], depth)),
      normal,
      color,
    );
}
const rect = (x0, x1, y0, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
function reveal(out, point, hole, depth) {
  const winding = Math.sign(
    hole.reduce((sum, a, i) => {
      const b = hole[(i + 1) % hole.length];
      return sum + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < hole.length; i++) {
    const a = hole[i],
      b = hole[(i + 1) % hole.length];
    const points = [point(...a, 0), point(...b, 0), point(...b, -depth), point(...a, -depth)];
    panel(
      out,
      'dressed',
      points,
      normalFor(points[1], points[0], points[3]).map((x) => x * winding),
      tone.stoneLight,
    );
  }
}
function framed(out, point, x, y, w, h, normal, lod) {
  const w0 = w / 2;
  const hole = rect(x - w0, x + w0, y, y + h);
  reveal(out, point, hole, 0.2);
  area(out, 'inset', point, hole, -0.2, normal, tone.glass);
  const band = (x0, x1, y0, y1, depth = 0.057) =>
    area(out, 'dressed', point, rect(x0, x1, y0, y1), depth, normal, tone.trim);
  band(x - w0 - 0.14, x + w0 + 0.14, y - 0.16, y);
  band(x - w0 - 0.12, x + w0 + 0.12, y + h, y + h + 0.15);
  for (const side of [-1, 1]) band(x + side * w0 - 0.055, x + side * w0 + 0.055, y, y + h);
  if (lod > 0) {
    band(x - 0.021, x + 0.021, y + 0.035, y + h - 0.038, -0.145);
    if (lod > 1) band(x - w0 + 0.055, x + w0 - 0.055, y + h * 0.54, y + h * 0.54 + 0.04, -0.14);
  }
  return hole;
}

function hall(out, lod) {
  const x0 = -6.45,
    x1 = 7.22,
    z0 = -6.62,
    z1 = 8.63,
    y = q.hallEave;
  const corners = [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
  const walls = [
    { vector: north, windows: [-4.05, 5.25] },
    { vector: east, windows: [-1.9, 4.0] },
    { vector: south, windows: [-4.18, 2.2] },
    { vector: west, windows: [-3.6, 2.75] },
  ];
  walls.forEach(({ vector: normal, windows }, i) => {
    const left = corners[i],
      right = corners[(i + 1) % 4];
    const fixed = i % 2 === 0 ? left[1] : left[0];
    const [l, r] = [left[i % 2], right[i % 2]].sort((a, b) => a - b);
    const wall = (s, y, d) =>
      i % 2 === 0 ? at(s, y, fixed + (i === 0 ? -d : d)) : at(fixed + (i === 1 ? d : -d), y, s);
    const base = -0.84;
    const course = rect(l, r, base, 0.83);
    area(out, 'limestone', wall, course, 0.025, normal, tone.apron);
    const holes = windows.map((s) => framed(out, wall, s, 4.23, 1.0, 2.08, normal, lod));
    area(
      out,
      'stucco',
      wall,
      rect(l, r, 0.83, y),
      0,
      normal,
      i % 2 ? tone.flank : tone.plaster,
      holes,
    );
    area(out, 'dressed', wall, rect(l, r, y - 0.2, y + 0.075), 0.06, normal, tone.stoneLight);
    if (i !== 2 && i !== 3) return;
    for (const s of [l + 0.56, l + (r - l) * 0.46, r - 0.56]) {
      const width = 0.59;
      const pier = (low, high, projection) => {
        const a = s - width / 2,
          b = s + width / 2;
        area(out, 'dressed', wall, rect(a, b, low, high), projection, normal, tone.trim);
        for (const edge of [a, b]) {
          const p = [
            wall(edge, low, 0),
            wall(edge, low, projection),
            wall(edge, high, projection),
            wall(edge, high, 0),
          ];
          const n = normalFor(...p).map((x) => (edge === a ? x : -x));
          panel(out, 'dressed', p, n, tone.stoneLight);
        }
      };
      pier(-0.2, y - 0.6, 0.41);
      if (lod > 0) pier(y - 0.82, y - 0.51, 0.52);
    }
  });
  const center = (z0 + z1) / 2;
  for (const z of [z0 - 0.39, z1 + 0.39]) {
    const eave = y + 0.12;
    panel(
      out,
      'tile',
      [
        at(x0 - 0.34, eave, z),
        at(x1 + 0.33, eave, z),
        at(x1 + 0.33, q.hallRidge, center),
        at(x0 - 0.34, q.hallRidge, center),
      ],
      up,
      tone.tile,
    );
    if (lod >= 1)
      panel(
        out,
        'tile',
        [
          at(x0 - 0.34, eave + 0.045, z),
          at(x1 + 0.33, eave + 0.045, z),
          at(x1 + 0.33, eave + 0.09, mix(z, center, 0.027)),
          at(x0 - 0.34, eave + 0.09, mix(z, center, 0.027)),
        ],
        up,
        tone.edge,
      );
  }
  for (const [x, n] of [
    [x0, west],
    [x1, east],
  ])
    panel(
      out,
      'stucco',
      [at(x, y, z0), at(x, q.hallRidge - 0.05, center), at(x, y, z1)],
      n,
      tone.plaster,
    );
}

function sideEntry(out, lod) {
  const x0 = -6.55,
    x1 = -2.25,
    z0 = -9.05,
    z1 = -6.47;
  const floor = Math.min(-0.55, height(outline[0]) - 0.3);
  const n = lod >= 2 ? 12 : 7;
  const arc = (center, rise, width) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const theta = Math.PI * (1 - i / n);
      return [center + (Math.cos(theta) * width) / 2, 3.1 + Math.pow(Math.sin(theta), 1.1) * rise];
    });
  const c = (x0 + x1) / 2;
  const door = [[c - 1.3, 0.47], ...arc(c, 1.35, 2.6), [c + 1.3, 0.47]];
  const porch = (x, y, d) => at(x, y, z0 - d);
  area(out, 'stucco', porch, rect(x0, x1, floor, 5.52), 0, north, tone.flank, [door]);
  reveal(out, porch, door, 0.51);
  area(out, 'inset', porch, door, -0.51, north, tone.door);
  const outer = [[c - 1.56, 0.47], ...arc(c, 1.61, 3.12), [c + 1.56, 0.47]];
  for (let i = 0; i < door.length - 1; i++)
    panel(
      out,
      'dressed',
      [
        porch(...door[i], 0.045),
        porch(...door[i + 1], 0.045),
        porch(...outer[i + 1], 0.045),
        porch(...outer[i], 0.045),
      ],
      north,
      tone.trim,
    );
  for (const [x, normal] of [
    [x0, west],
    [x1, east],
  ])
    panel(
      out,
      'stucco',
      [at(x, floor, z0), at(x, floor, z1), at(x, 6.32, z1), at(x, 5.52, z0)],
      normal,
      tone.shadow,
    );
  panel(
    out,
    'tile',
    [
      at(x0 - 0.19, 5.62, z0 - 0.29),
      at(x1 + 0.19, 5.62, z0 - 0.29),
      at(x1 + 0.19, 6.42, z1),
      at(x0 - 0.19, 6.42, z1),
    ],
    up,
    tone.edge,
  );
}

function tower(out, lod) {
  const [x, , z] = at(q.towerCenter[0], 0, q.towerCenter[1]);
  const n = [10, 15, 20, 28][lod];
  const ring = (y, r) => radialRing(y, r, r, n, [x, z]);
  const column = (slot, profile, tint) =>
    loft(
      out,
      slot,
      profile.map(([y, r]) => ring(y, r)),
      tint,
    );
  const balcony = q.balconyHeight;
  column(
    'limestone',
    [
      [-0.66, 1.77],
      [7.8, 1.56],
      [balcony - 2.65, 1.45],
      [balcony - 1.9, 1.49],
      [balcony - 1.22, 1.68],
      [balcony - 0.22, 2.12],
    ],
    tone.stone,
  );
  column(
    'dressed',
    [
      [balcony - 0.22, 2.12],
      [balcony - 0.03, 2.25],
      [balcony + 1.15, 2.25],
      [balcony + 1.27, 2.08],
    ],
    tone.trim,
  );
  column(
    'limestone',
    [
      [balcony + 1.27, 1.44],
      [19.35, 1.41],
    ],
    tone.stoneLight,
  );
  column(
    'cap',
    [
      [19.32, 1.5],
      [19.51, 1.48],
      [q.spireHeight - 0.08, 0.11],
    ],
    tone.gray,
  );
  if (lod >= 1) {
    for (const [y, r] of [
      [balcony - 1.46, 1.61],
      [balcony - 0.83, 1.91],
    ])
      column(
        'dressed',
        [
          [y - 0.052, r],
          [y + 0.052, r + 0.018],
        ],
        tone.trim,
      );
    const p = at(q.towerCenter[0] - 1.48, 0, q.towerCenter[1]);
    panel(
      out,
      'inset',
      [
        [p[0] - v * 0.27, 9.15, p[2] + u * 0.27],
        [p[0] + v * 0.27, 9.15, p[2] - u * 0.27],
        [p[0] + v * 0.27, 9.75, p[2] - u * 0.27],
        [p[0] - v * 0.27, 9.75, p[2] + u * 0.27],
      ],
      west,
      tone.dark,
    );
  }
  tube(
    out,
    'cap',
    [x, q.spireHeight - 0.15, z],
    [x, q.spireHeight + 0.76, z],
    0.042,
    tone.gray,
    lod === 0 ? 5 : 8,
  );
}

function build(out, lod) {
  hall(out, lod);
  sideEntry(out, lod);
  tower(out, lod);
}
export const mosqueSkyline = (out) => build(out, 0);
export const mosqueDistrict = (out) => build(out, 1);
export const mosqueStreet = (out) => build(out, 2);
export const mosqueCloseup = (out) => build(out, 3);
const camera = at(-32, 16, 37),
  lookAt = at(0, 9.1, -1);
const recipe = 'bayraktar-mosque-model.mjs';
export const mosqueModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: mosqueCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Bayraktar Mosque on Constanza Bastion in Nicosia, with its compact tiled stone hall and tall limestone minaret crowned by a corbelled balcony and tapered roof.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -0.58,
  sunDirection: at(-19, 25, 23),
  mediumFiContext: {
    scale: 0.92,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: { outline, minimumCoverage: 0.86, basis: 'Named mapped mosque building.' },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'stone_limestone_raw',
    'tile_flat',
    'metal_standing_seam',
  ],
  qaCameras: [
    {
      name: 'bastion-side-mosque-and-minaret',
      position: at(-20, 5.0, -36),
      lookAt: at(-0.2, 10.9, -1.4),
    },
    {
      name: 'stone-minaret-balcony-and-roof',
      position: at(15, 16.8, -23),
      lookAt: at(q.towerCenter[0], 15.6, q.towerCenter[1]),
    },
    {
      name: 'arched-entry-and-tiled-hall',
      position: at(-14, 7.0, -21),
      lookAt: at(-3.3, 5.1, -4.2),
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `mosque-and-minaret-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mosqueSkyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mosqueDistrict', 0.27],
        ['street', 'mosqueStreet', 0.11],
        ['closeup', 'mosqueCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The mapped outline is ODbL. The selected Qualla photo is CC0 by Bayreuth2009.',
};
