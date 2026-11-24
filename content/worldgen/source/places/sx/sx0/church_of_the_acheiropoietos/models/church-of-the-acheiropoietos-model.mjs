import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, floor, eave, ridge } = plan.dimensions;
const walls = rgb('a0927e');
const softBrick = rgb('a37765');
const archBrick = rgb('b58f79');
const terraCotta = rgb('a5715b');
const marble = rgb('c9c3b0');
const iron = rgb('5f594f');
const windowShadow = rgb('4f4d45');
const door = rgb('534339');
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93 },
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.95 },
  surround: { slot: 'trim', graph: 'brick_longformat', roughness: 0.9 },
  marble: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.91 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
};
const south = facade([-23.02, 15.79], [1, 0]);
const north = facade([23.02, -15.701], [-1, 0]);
const west = facade([-23.021, -15.7], [0, 1]);
const east = facade([23.021, 15.701], [0, -1]);

function arches(out, F, center, y, count, width, height, lod) {
  const spacing = width + 0.27;
  for (let k = 0; k < count; k++) {
    const u = center + (k - (count - 1) / 2) * spacing;
    opening(out, F, u, y, width, height, {
      head: 'round',
      glassSlot: 'dark',
      frameSlot: 'surround',
      glass: windowShadow,
      frame: archBrick,
      d: 0.026,
      frameWidth: lod === 3 ? 0.12 : 0,
      frameDepth: 0.14,
      sill: false,
    });
    if (lod < 2) continue;
    const rodHeight = y + height - width * 0.48;
    const n = lod === 3 ? 3 : 1;
    for (let j = 0; j < n; j++) {
      const x = u + ((j + 1) / (n + 1) - 0.5) * width;
      fbox(out, 'iron', F, x - 0.024, x + 0.024, y + 0.04, rodHeight, 0.028, 0.052, iron);
    }
  }
  if (lod > 0) {
    const span = count * spacing;
    fbox(out, 'marble', F, center - span / 2, center + span / 2, y - 0.18, y, 0.004, 0.2, marble);
  }
}

function basilica(out, lod) {
  const body = [
    [-23.019, -15.701],
    [23.017, -15.701],
    [23.019, 15.78],
    [-23.017, 15.78],
  ];
  extrude(out, 'masonry', body, foundation, eave, walls, { top: false });
  gableRoof(out, 'tile', [-23.22, 0.05], [23.22, 0.05], 31.48, eave, ridge, terraCotta, {
    overhang: 0.25,
    endSlot: 'brick',
    endColor: softBrick,
  });
  if (lod === 0) {
    for (const F of [south, west]) arches(out, F, F === south ? 31 : 15.8, 8.7, 5, 1.41, 2.8, lod);
    return;
  }
  for (const F of [south, north]) {
    fbox(out, 'brick', F, 0.06, 45.98, 6.91, 7.13, -0.06, 0.12, softBrick);
    fbox(out, 'surround', F, 0.06, 45.98, eave - 0.54, eave - 0.29, -0.04, 0.15, archBrick);
    for (const u of [6.07, 16.94, 28.07, 39.1]) {
      arches(out, F, u, 8.46, 3, 1.64, 3.11, lod);
      arches(out, F, u + 0.11, 3.11, 3, 1.69, 3.23, lod);
    }
    if (lod < 2) continue;
    for (const u of [1.07, 11.36, 22.36, 33.45, 44.06]) {
      fbox(out, 'masonry', F, u - 0.17, u + 0.17, 7.08, eave - 0.4, 0.02, 0.19, walls);
    }
  }
  arches(out, west, 15.75, 8.18, 5, 1.79, 3.72, lod);
  arches(out, west, 6.34, 8.0, 1, 1.62, 2.55, lod);
  arches(out, west, 24.93, 8.0, 1, 1.62, 2.55, lod);
  arches(out, east, 5.33, 8.25, 3, 1.37, 2.51, lod);
  arches(out, east, 26.16, 8.25, 3, 1.37, 2.51, lod);
}
function apse(out, lod) {
  const mapped = outline.slice(6, 15);
  const shell = outwardRing(lod === 0 ? mapped.filter((_p, i) => i % 2 === 0) : mapped);
  const spring = 7.76;
  extrude(out, 'brick', shell, floor - 2.4, spring, softBrick, { top: false });
  for (let i = 0; i < shell.length; i++) {
    const F = wallFace(shell[i], shell[(i + 1) % shell.length]);
    tri(
      out,
      'tile',
      F.P(-0.07, spring, 0.15),
      F.P(F.length + 0.06, spring, 0.15),
      [21.59, 10.14, 0.76],
      terraCotta,
    );
    if (F.normal[0] > 0.14 && lod > 0 && i % 2 === 0)
      arches(out, F, F.length / 2, 3.95, 1, Math.min(1.05, F.length * 0.38), 2.38, lod);
  }
}
function propylon(out, lod) {
  const front = facade([-12.15, 21.13], [1, 0]);
  const u0 = -3.9;
  const u1 = 3.9;
  const cap = 5.35;
  const archY = 2.17;
  const radius = 1.76;
  abox(out, 'brick', [-16.05, floor, 15.84], [-15.08, cap, 21.13], softBrick);
  abox(out, 'brick', [-9.15, floor, 15.84], [-8.25, cap, 21.13], softBrick);
  const arch = roundArch(radius, [4, 6, 8, 12][lod]);
  for (let i = 0; i < arch.length - 1; i++) {
    const [a, ay] = arch[i];
    const [b, by] = arch[i + 1];
    quad4(
      out,
      'brick',
      front.P(a, archY + ay),
      front.P(b, archY + by),
      front.P(b, cap),
      front.P(a, cap),
      softBrick,
    );
    quad4(
      out,
      'surround',
      front.P(b, archY + by),
      front.P(a, archY + ay),
      front.P(a, archY + ay, -1.28),
      front.P(b, archY + by, -1.28),
      archBrick,
    );
  }
  fbox(out, 'brick', front, u0, -radius, floor, cap, -0.57, 0, softBrick);
  fbox(out, 'brick', front, radius, u1, floor, cap, -0.57, 0, softBrick);
  opening(out, front, 0, floor + 0.18, 2.63, 4.0, {
    glassSlot: 'timber',
    frameSlot: 'surround',
    glass: door,
    frame: archBrick,
    d: -5.22,
    frameWidth: 0,
    sill: false,
  });
  gableRoof(out, 'tile', [-12.15, 15.6], [-12.15, 21.48], 8.08, cap, 7.18, terraCotta, {
    overhang: 0.11,
    endSlot: 'brick',
    endColor: softBrick,
  });
  const wing = [
    [-8.27, 15.71],
    [4.6, 15.71],
    [4.6, 19.54],
    [-8.27, 19.54],
  ];
  extrude(out, 'masonry', wing, floor - 1, 3.1, walls, { top: false });
  gableRoof(out, 'tile', [-8.62, 17.58], [4.77, 17.58], 4.29, 3.08, 4.82, terraCotta, {
    overhang: 0.18,
    endSlot: 'brick',
    endColor: softBrick,
  });
  if (lod > 0) arches(out, facade([-1.9, 19.55], [1, 0]), 0.41, 0.14, 1, 1.48, 2.71, lod);
}

function build(out, lod) {
  basilica(out, lod);
  apse(out, lod);
  propylon(out, lod);
  abox(out, 'brick', [-25.23, floor - 1.2, -6.46], [-23.05, 5.52, 6.03], softBrick);
  if (lod > 0) {
    arches(out, facade([-25.24, 0], [0, 1]), 0, -0.68, 3, 1.86, 4.19, lod);
    abox(out, 'iron', [0.07, ridge - 0.04, 0.01], [0.16, ridge + 0.96, 0.095], iron);
    abox(out, 'iron', [-0.15, ridge + 0.57, 0.01], [0.37, ridge + 0.66, 0.09], iron);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'church-of-the-acheiropoietos-model.mjs';
const camera = [-64, 29, 58];
const lookAt = [-1, 6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The early Byzantine basilica at Thessaloniki, with paired levels of round-headed windows, south propylon and eastern apse.',
  camera,
  lookAt,
  sunDirection: [-48, 54, 46],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The mapped rectangular walls and rounded east apse of the basilica.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-arcades-and-propylon', position: camera, lookAt },
    { name: 'west-narthex-and-round-headed-windows', position: [-50, 8, 22], lookAt: [-15, 7, 0] },
    { name: 'eastern-apse', position: [61, 24, 41], lookAt: [13, 7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'church-of-the-acheiropoietos-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
