import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, tall, wing, porch } = plan.dimensions;
const plaster = rgb('b2a28a');
const timber = rgb('a08767');
const batten = rgb('635749');
const cladding = rgb('80766a');
const base = rgb('9d9b90');
const panel = rgb('605343');
const slate = rgb('52615e');
const glass = rgb('4a5c61');
const door = rgb('373334');
const surfaces = {
  walls: { slot: 'wall', graph: 'stucco', roughness: 0.93 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  portal: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.82 },
};
const block = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
const north = (x, z) => facade([x, z], [-1, 0]);
function hip(out, rect, ridge, low, top) {
  const [a, b, c, d] = rect.map(([x, z]) => [x, low, z]);
  const [p, q] = ridge.map(([x, z]) => [x, top, z]);
  for (const f of [
    [b, a, p],
    [b, p, q],
    [c, b, q],
    [d, c, q],
    [d, q, p],
    [a, d, p],
  ])
    tri(out, 'roof', ...f, slate);
}
function sash(out, F, u, y, w, h, lod, { portal = false } = {}) {
  opening(out, F, u, y, w, h, {
    glassSlot: portal ? 'portal' : 'glass',
    frameSlot: 'timber',
    glass: portal ? door : glass,
    frame: batten,
    d: 0.037,
    frameWidth: lod > 1 ? 0.078 : 0,
    sill: lod > 1 && !portal,
    mullions: lod > 1 && w > 1.45 ? 1 : 0,
    transoms: lod === 3 ? 1 : 0,
    frameDepth: 0.1,
  });
}
function entrance(out, lod) {
  const center = (tall.west + tall.east) / 2;
  const F = north(center, tall.front);
  const eave = tall.eave;
  sash(out, F, 0, 0.66, 1.62, 2.58, lod, { portal: true });
  for (const u of [-2.27, 2.27]) {
    sash(out, F, u, 1.38, 1.46, 1.37, lod);
    fbox(out, 'timber', F, u - 0.22, u + 0.22, floor, eave, 0.03, 0.18, cladding);
  }
  fbox(out, 'timber', F, -4.62, 4.62, 3.25, 3.58, 0.03, 0.18, timber);
  const windows = lod === 0 ? 3 : 5;
  for (let i = 0; i < windows; i++) {
    const count = windows / 2;
    const u = (i + 0.5 - count) * 1.14;
    const ceiling = tall.ridge - (tall.ridge - eave) * Math.abs(u / 4.7) - 0.45;
    const low = 7.08 + (1 - Math.abs(u) / 4.7) * 0.32;
    const height = Math.min(1.62, ceiling - low);
    sash(out, F, u, low, 1.0, height, lod);
  }
  const canopy = (u, v) => {
    const up = u + v - 1;
    return [center + (u - v) * 2.47, 6.1 + up * 2.46, tall.front - 1.39 - up * 0.82];
  };
  const bracket = lod === 0 ? 2 : lod === 1 ? 4 : lod === 2 ? 7 : 12;
  for (let i = 0; i <= bracket; i++) {
    const t = i / bracket;
    const width = i === 0 || i === bracket ? 0.19 : i % 3 === 0 ? 0.103 : 0.049;
    for (const [a, b] of [
      [
        [0, t],
        [1, t],
      ],
      [
        [t, 0],
        [t, 1],
      ],
    ])
      beam(out, 'timber', canopy(...a), canopy(...b), width, width * 0.91, timber);
  }
  for (const sign of [-1, 1]) {
    const x = center + sign * 1.78,
      z = tall.front - 1.38;
    block(out, 'timber', x - 0.145, x + 0.145, z - 0.13, z + 0.13, 0.49, 6.12, timber);
    beam(
      out,
      'timber',
      [x, 3.17, z],
      [center + sign * 0.19, 4.12, tall.front - 0.65],
      0.12,
      0.11,
      batten,
    );
    if (lod > 0)
      beam(
        out,
        'timber',
        [x, 4.78, z],
        [center + sign * 3.03, 6.6, tall.front - 0.28],
        0.12,
        0.095,
        timber,
      );
  }
  block(
    out,
    'stone',
    center - 3.38,
    center + 3.38,
    tall.front - 2.48,
    tall.front + 0.07,
    -0.16,
    0.14,
    base,
  );
  block(
    out,
    'stone',
    center - 3.05,
    center + 3.05,
    tall.front - 2.04,
    tall.front + 0.09,
    -0.08,
    0.34,
    base,
  );
  block(
    out,
    'stone',
    center - 2.74,
    center + 2.74,
    tall.front - 1.71,
    tall.front + 0.13,
    -0.02,
    porch.bottom,
    base,
  );
}
function tallHall(out, lod) {
  const h = tall;
  const width = h.east - h.west,
    x = (h.west + h.east) / 2;
  block(out, 'walls', h.west, h.east, h.front, h.back, floor, h.eave, plaster);
  gableRoof(out, 'roof', [x, h.front], [x, h.back], width, h.eave, h.ridge, slate, {
    endSlot: 'walls',
    endColor: plaster,
    overhang: 0.56,
  });
  const e = facade([h.east, 0], [0, -1]);
  const w = facade([h.west, 0], [0, 1]);
  for (const [F, a, b] of [
    [e, -h.back, -h.front],
    [w, h.front, h.back],
  ]) {
    for (const y of [3.01, 6.45]) fbox(out, 'timber', F, a, b, y, y + 0.29, -0.08, 0.16, timber);
    const n = lod === 0 ? 5 : 8,
      step = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const u = a + (i + 0.5) * step;
      sash(out, F, u, 3.71, 1.01, 2.32, lod);
      if (lod > 0) {
        sash(out, F, u, 1.35, 0.78, 1.29, lod);
        fbox(
          out,
          'timber',
          F,
          u - step * 0.5 - 0.065,
          u - step * 0.5 + 0.065,
          floor,
          6.73,
          -0.015,
          0.13,
          batten,
        );
        if (lod > 1 && i % 2 === 0)
          fbox(out, 'timber', F, u - 0.84, u + 0.84, 3.4, 3.61, 0, 0.22, cladding);
      }
    }
  }
  if (lod > 1) {
    for (let i = 0; i < 24; i++) {
      const u = -h.back + ((i + 0.5) * (h.back - h.front)) / 24;
      fbox(out, 'timber', e, u - 0.023, u + 0.023, 3.18, 4.08, 0.21, 0.25, batten);
    }
  }
  entrance(out, lod);
}
function lowWing(out, lod) {
  const p = wing;
  block(out, 'timber', p.west, p.east, p.front, p.back, floor - 0.02, p.eave, panel);
  block(out, 'timber', p.west, -1.86, -10.83, p.front + 0.08, floor - 0.02, p.eave - 0.02, panel);
  hip(
    out,
    [
      [p.west - 0.3, p.front - 0.22],
      [p.east + 0.19, p.front - 0.22],
      [p.east + 0.19, p.back + 0.28],
      [p.west - 0.3, p.back + 0.28],
    ],
    [
      [p.west + 3, -1.78],
      [p.east - 3, -1.78],
    ],
    p.eave,
    p.ridge,
  );
  hip(
    out,
    [
      [p.west - 0.22, -11.06],
      [-1.67, -11.06],
      [-1.67, 0.5],
      [p.west - 0.22, 0.5],
    ],
    [
      [p.west + 3.1, -5.04],
      [-4.1, -5.04],
    ],
    p.eave - 0.06,
    p.ridge + 0.22,
  );
  const F = north(0, p.front);
  for (const u of [-2.77, -0.35, 2.18, 4.83, 7.4, 9.72, 12.19, 14.54]) {
    if (u > 2) continue;
    sash(out, F, u, 0.83, 1.6, 2.14, lod, { portal: true });
    if (lod > 0) fbox(out, 'timber', F, u - 0.88, u - 0.76, floor, 3.38, 0.03, 0.14, timber);
  }
  if (lod > 1) {
    const south = facade([0, p.back], [1, 0]);
    for (const u of [-13.86, -10.46, -7.04, -3.59, -0.51, 2.72])
      sash(out, south, u, 1.22, 1.38, 1.64, lod);
  }
}
function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor + 0.02, base, { top: false });
  lowWing(out, lod);
  tallHall(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'chiune-sugihara-memorial-hall-model.mjs';
const camera = [39, 17, -45];
const lookAt = [0, 4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The hinoki memorial hall in Yaotsu, with the diamond-shaped timber lattice, projecting high gable, and attached lower gallery.',
  camera,
  lookAt,
  sunDirection: [24, 39, -15],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Only the mapped memorial building and its attached wing.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'timber-gable-and-lattice-porch', position: camera, lookAt },
    { name: 'diagonal-lattice-and-glazed-gable', position: [20, 8, -28], lookAt: [7, 4.4, -3] },
    { name: 'main-hall-and-lower-wing', position: [-37, 22, 35], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sugihara-hall-' + reviewLod,
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
