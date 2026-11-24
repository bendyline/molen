import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, domeTop } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.72 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
};
const limestone = rgb('c2b6a1');
const pale = rgb('d0c4ad');
const shaded = rgb('ab9f8d');
const granite = rgb('a39787');
const copper = rgb('626b6a');
const line = rgb('787f79');
const bronze = rgb('62695a');
const glass = rgb('556467');
const dark = rgb('555650');
const cx = -7.37,
  cz = 0.34;
const north = (x, z) => facade([x, z], [-1, 0]);
const south = (x, z) => facade([x, z], [1, 0]);
const east = (x, z) => facade([x, z], [0, -1]);
const west = (x, z) => facade([x, z], [0, 1]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function band(out, F, span, y, h, d = 0.24) {
  fbox(out, 'trim', F, -span / 2, span / 2, y - h, y, 0, d, pale);
}
function light(out, F, u, y, w, h, lod, { head = 'flat', color = glass } = {}) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: pale,
    head,
    frameWidth: lod === 3 || (lod === 2 && head === 'flat') ? 0.13 : 0,
    d: 0.047,
    sill: lod > 1,
    frameDepth: 0.15,
    mullions: lod > 1 ? 1 : 0,
    transoms: lod === 3 ? 1 : 0,
  });
}
function shaft(out, x, z, bottom, top, r, lod) {
  const sides = lod === 0 ? 4 : lod === 1 ? 8 : 12;
  const section = (y, s) => radialRing(y, r * s, r * s, sides, [x, z], Math.PI / 4);
  loft(out, 'trim', [section(bottom, 1), section(top, 0.83)], pale, { cap: false });
  if (lod > 0) {
    const half = r * 1.25;
    if (lod > 1)
      box(out, 'trim', x - half, x + half, z - half, z + half, bottom - 0.28, bottom + 0.26, pale);
    box(out, 'trim', x - half, x + half, z - half, z + half, top - 0.26, top + 0.22, pale);
    if (lod === 3) {
      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        const nx = Math.cos(theta),
          nz = Math.sin(theta);
        beam(
          out,
          'trim',
          [x + nx * r * 0.98, bottom + 0.46, z + nz * r * 0.98],
          [x + nx * r * 0.82, top - 0.48, z + nz * r * 0.82],
          0.072,
          0.064,
          limestone,
        );
      }
    }
  }
}
function colonnade(out, F, width, depth, y0, y1, peak, count, lod) {
  for (let i = 0; i < count; i++) {
    const p = F.P(width * 0.88 * (i / (count - 1) - 0.5), 0, -0.48);
    shaft(out, p[0], p[2], y0, y1, 1.02, lod);
  }
  const half = width / 2,
    eave = y1 + 1.32;
  fbox(out, 'trim', F, -half - 0.3, half + 0.3, y1 - 0.3, eave, -depth, 0.33, pale);
  const a = F.P(-half, eave, 0.16),
    b = F.P(half, eave, 0.16),
    p = F.P(0, peak, 0.16);
  tri(out, 'wall', a, b, p, limestone);
  quad4(out, 'copper', a, p, F.P(0, peak, -depth), F.P(-half, eave, -depth), copper);
  quad4(out, 'copper', p, b, F.P(half, eave, -depth), F.P(0, peak, -depth), copper);
  if (lod > 0) {
    beam(out, 'trim', a, p, 0.27, 0.28, pale);
    beam(out, 'trim', p, b, 0.27, 0.28, pale);
    band(out, F, width + 0.85, eave, 0.37, 0.42);
  }
}
function rank(out, F, width, levels, lod) {
  const n = Math.max(1, Math.round(width / 5.85));
  for (let i = 0; i < n; i++) {
    if (lod === 0 && i % 3 !== 0) continue;
    const u = width * ((i + 0.5) / n - 0.5);
    for (const [y, w, h, head] of levels)
      light(out, F, u, y, w, h, lod, { head: lod === 0 ? 'flat' : head });
    if (lod > 0 && i < n - 1) {
      const p = u + width / (2 * n);
      fbox(out, 'trim', F, p - 0.16, p + 0.16, 9.01, 24.31, 0.025, 0.15, pale);
    }
  }
}

function wings(out, lod) {
  extrude(out, 'base', frame.geometry.outline, foundation, floor, granite, { top: false });
  box(out, 'wall', -31.54, 17.62, -21.71, 22.91, floor, 32.08, limestone);
  box(out, 'trim', -31.79, 17.82, -21.94, 23.08, 31.52, 32.22, pale);
  const ordinary = [
    [3.06, 1.68, 3.75, 'flat'],
    [9.05, 2.12, 5.28, 'round'],
    [17.18, 1.91, 4.59, 'flat'],
  ];
  for (const [a, b] of [
    [-66.02, -31.48],
    [17.55, 50.99],
  ]) {
    box(out, 'wall', a, b, -12.88, 13.07, floor, 25.1, limestone);
    gableRoof(out, 'copper', [a, -0.05], [b, -0.05], 25.96, 25.07, 28.87, copper, {
      overhang: 0.31,
      endSlot: 'wall',
      endColor: limestone,
    });
    for (const F of [north((a + b) / 2, -12.88), south((a + b) / 2, 13.07)]) {
      rank(out, F, b - a - 0.7, ordinary, lod);
      for (const y of lod === 0 ? [] : [7.45, 15.41, 24.88])
        band(out, F, b - a + 0.22, y, 0.37, 0.4);
    }
  }
  for (const [z0, z1] of [
    [-42.65, -21.64],
    [22.87, 42.6],
  ]) {
    box(out, 'wall', -26.79, 12.38, z0, z1, floor, 27.54, limestone);
    box(out, 'trim', -26.97, 12.59, z0 - 0.18, z1 + 0.19, 26.96, 27.63, pale);
    const center = (z0 + z1) / 2;
    rank(out, west(-26.79, center), z1 - z0, ordinary, lod);
    rank(out, east(12.38, center), z1 - z0, ordinary, lod);
  }
  for (const F of [north(cx, -42.65), south(cx, 42.6)]) {
    rank(
      out,
      F,
      37.7,
      [
        [4.28, 1.55, 3.5, 'flat'],
        [10.18, 2.12, 6.92, 'round'],
        [20.42, 1.86, 4.12, 'flat'],
      ],
      lod,
    );
    band(out, F, 39.0, 27.46, 0.42, 0.38);
  }
  colonnade(out, north(cx, -46.52), 28.8, 3.86, 7.34, 24.8, 31.93, 8, lod);
  colonnade(out, south(cx, 46.12), 28.75, 3.8, 7.39, 24.82, 31.87, 8, lod);
  colonnade(out, east(55.33, 0.12), 22.45, 4.18, 5.84, 23.44, 29.08, lod === 0 ? 4 : 6, lod);
  colonnade(out, west(-70.48, -0.19), 22.25, 4.43, 5.81, 23.49, 29.06, lod === 0 ? 4 : 6, lod);
}
function steps(out, F, sides, depth, baseY, rise, lod) {
  const n = lod === 0 ? 2 : lod === 1 ? 5 : 10;
  for (let i = 0; i < n; i++) {
    const t = i / n,
      end = depth * (1 - t);
    for (const [a, b] of sides)
      fbox(out, 'base', F, a, b, -0.68, baseY + (rise * (i + 1)) / n, -0.12, end, granite);
  }
}
function entrances(out, lod) {
  const f = north(cx, -46.52),
    s = south(cx, 46.12);
  fbox(out, 'base', f, -21.06, 21.06, floor, 7.27, -7.8, 0.19, granite);
  for (const offset of lod === 0 ? [0] : [-13.9, -7.02, 0, 7.02, 13.9]) {
    const front = north(cx, -46.73);
    light(out, front, offset, 0.89, 2.68, 4.25, lod, { head: 'round', color: dark });
  }
  steps(
    out,
    f,
    [
      [-21.1, -15.17],
      [15.17, 21.1],
    ],
    5.78,
    0.34,
    7.03,
    lod,
  );
  steps(out, s, [[-15.14, 15.14]], 5.35, 0.36, 7.01, lod);
  if (lod > 0) {
    steps(out, east(55.33, 0.12), [[-11.25, 11.25]], 4.3, 0.53, 5.31, lod);
    steps(out, west(-70.48, -0.19), [[-11.18, 11.18]], 4.3, 0.45, 5.36, lod);
  }
}

function rotunda(out, lod) {
  const round = lod === 0 ? 8 : lod === 1 ? 16 : lod === 2 ? 24 : 32;
  const r = (y, rx, n = round) => radialRing(y, rx, rx, n, [cx, cz]);
  const profile = (slot, points, color, n = round) =>
    loft(
      out,
      slot,
      points.map(([y, width]) => r(y, width, n)),
      color,
      { cap: false },
    );
  profile(
    'wall',
    [
      [30.95, 20.3],
      [35.77, 20.3],
      [37.75, 18.8],
      [49.8, 17.9],
      [60.44, 16.24],
      [64.35, 15.56],
    ],
    limestone,
  );
  for (const [y, radius] of lod === 0
    ? [[63.16, 16.03]]
    : [
        [36.16, 20.38],
        [49.97, 18.68],
        [58.43, 17.02],
        [63.48, 16.4],
      ]) {
    profile(
      'trim',
      [
        [y - 0.46, radius - 0.39],
        [y - 0.27, radius],
        [y + 0.3, radius],
        [y + 0.47, radius - 0.32],
      ],
      pale,
    );
  }
  if (lod > 0) {
    const bands = [
      { y: 38.17, top: 49.34, radius: 18.81, slope: 0.075, window: 7.22, width: 2.62 },
      { y: 51.65, top: 58.25, radius: 17.63, slope: 0.156, window: 4.3, width: 2.21 },
    ];
    for (const b of bands) {
      const count = lod === 1 ? 12 : 16,
        ring = r(b.y, b.radius, count).map(([x, , z]) => [x, z]);
      for (let i = 0; i < ring.length; i++) {
        const left = ring[i],
          right = ring[(i + 1) % ring.length],
          F = wallFace(left, right);
        const pad = b.radius * (1 - Math.cos(Math.PI / count)) + 0.09;
        const plane = {
          P: (u, y, d = 0) => F.P(F.length / 2 + u, y, pad + d - b.slope * (y - b.y)),
        };
        light(out, plane, 0, b.y + 0.55, b.width, b.window, lod, { head: 'round' });
        if (lod > 1) {
          const side = F.length * 0.37;
          fbox(
            out,
            'trim',
            plane,
            side - 0.36,
            side + 0.36,
            b.y - 0.13,
            b.top - 0.33,
            0.02,
            0.24,
            pale,
          );
        }
      }
    }
  }
  const dome = [
    [63.85, 15.54],
    [65.46, 15.53],
    [69.41, 14.84],
    [73.28, 13.68],
    [76.98, 11.87],
    [80.54, 9.37],
    [83.32, 6.88],
    [85.08, 4.59],
    [85.78, 3.36],
  ];
  profile('copper', lod === 0 ? dome.filter((_, i) => i % 2 === 0) : dome, copper);
  if (lod > 1) {
    for (let i = 0; i < (lod === 2 ? 12 : 20); i++) {
      const a = (i * Math.PI * 2) / (lod === 2 ? 12 : 20);
      for (let j = 1; j < dome.length - 1; j++) {
        const p = ([y, r]) => [cx + (r + 0.044) * Math.cos(a), y, cz + (r + 0.044) * Math.sin(a)];
        beam(out, 'copper', p(dome[j]), p(dome[j + 1]), 0.104, 0.09, line);
      }
    }
  }
  profile(
    'wall',
    [
      [85.3, 3.67],
      [88.32, 3.15],
    ],
    limestone,
    lod === 0 ? 8 : 12,
  );
  if (lod > 0)
    profile(
      'trim',
      [
        [87.99, 3.15],
        [88.29, 3.32],
        [88.58, 3.11],
      ],
      pale,
      lod === 0 ? 8 : 12,
    );
  profile(
    'copper',
    [
      [88.6, 3.1],
      [89.79, 1.89],
      [90.16, 0.9],
      [90.49, 0.52],
    ],
    copper,
    lod === 0 ? 8 : 12,
  );
  const y = domeTop - 2.99;
  profile(
    'bronze',
    [
      [y - 0.16, 0.74],
      [y + 0.25, 0.65],
      [y + 0.38, 0.42],
    ],
    bronze,
    8,
  );
  beam(out, 'bronze', [cx, y + 0.27, cz], [cx, y + 2.27, cz], 0.38, 0.29, bronze);
  if (lod > 0) {
    beam(out, 'bronze', [cx, y + 1.66, cz], [cx + 0.66, y + 2.69, cz], 0.14, 0.16, bronze);
    beam(out, 'bronze', [cx + 0.66, y + 2.69, cz], [cx + 1.05, domeTop, cz], 0.09, 0.09, bronze);
  }
}
function build(out, lod) {
  wings(out, lod);
  entrances(out, lod);
  rotunda(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kansas-state-capitol-model.mjs';
const camera = [138, 67, -175];
const lookAt = [-7, 32, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Kansas State Capitol in Topeka, with its limestone wings, classical colonnades and copper dome.',
  camera,
  lookAt,
  sunDirection: [42, 55, -37],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The named mapped footprint of the Capitol building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-front-and-copper-dome', position: camera, lookAt },
    { name: 'restored-north-entry-and-portico', position: [-18, 23, -110], lookAt: [-7, 32, -24] },
    { name: 'west-wing-south-portico-and-dome', position: [-151, 71, 155], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kansas-state-capitol-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
