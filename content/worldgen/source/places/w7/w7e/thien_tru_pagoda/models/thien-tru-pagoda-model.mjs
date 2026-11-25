import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tower,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/thien-tru-pagoda-site-controls');
const ring = shape.locallyProjectedRoofOutline;
const [a, b] = shape.frontEdge.map((i) => ring[i]);
const centerX = (a[0] + b[0]) / 2;
const frontZ = a[1];
const floor = 2.18;
const facadeBeam = 5.37;
const hallFace = facade([centerX, 8.55], [1, 0]);
const rearFootprint = [ring[0], ring[1], ring[2], ring[7]];
const frontFootprint = [ring[6], ring[5], ring[4], ring[3]];
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.93 },
  stairs: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.86 },
  bronze: { slot: 'trim', localRef: 'palette:#716656', roughness: 0.76, metallic: 0.26 },
};
const color = {
  tile: rgb('7b5d51'),
  tileLight: rgb('876759'),
  ridge: rgb('625247'),
  tileShadow: rgb('674f47'),
  plaster: rgb('bfaf91'),
  platform: rgb('978874'),
  trim: rgb('ad8052'),
  red: rgb('873d34'),
  beam: rgb('634039'),
  door: rgb('54332a'),
  shadow: rgb('4d3730'),
  plaque: rgb('ab9562'),
  iron: rgb('675d50'),
};

function curvedRoof(out, [x0, x1, z0, z1], y, rise, lod, upsweep, rotated = false) {
  const midX = (x0 + x1) / 2;
  const ridgeZ = (z0 + z1) / 2;
  const wide = (rotated ? z1 - z0 : x1 - x0) / 2;
  const deep = (rotated ? x1 - x0 : z1 - z0) / 2;
  const extent = (length, cross, height) =>
    rotated ? [midX + cross, height, ridgeZ - length] : [midX + length, height, ridgeZ + cross];
  const count = [5, 8, 12, 20][lod];
  const levels = [0, 0.23, 0.53, 0.78, 1];
  const sample = (t, u, side, lower = 0) => {
    const tip = Math.pow(Math.max(0, (Math.abs(t) - 0.6) / 0.4), 3);
    const length = t * wide * (1 - 0.145 * u);
    const cross = (1 - u) * side * deep;
    const elevation = y + rise * (0.32 * u + 0.68 * u * u) + upsweep * tip * (1 - 0.58 * u);
    return extent(length, cross, elevation - lower);
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const from = -1 + (2 * i) / count,
        to = -1 + (2 * (i + 1)) / count;
      for (let layer = 1; layer < levels.length; layer++) {
        const u0 = levels[layer - 1],
          u1 = levels[layer];
        const A = sample(from, u0, side),
          B = sample(to, u0, side);
        const C = sample(to, u1, side),
          D = sample(from, u1, side);
        const tint = side === 1 ? color.tileLight : color.tile;
        if (side === 1) {
          tri(out, 'tile', A, B, C, tint);
          tri(out, 'tile', A, C, D, tint);
        } else {
          tri(out, 'tile', C, B, A, tint);
          tri(out, 'tile', D, C, A, tint);
        }
      }
      const A = sample(from, 0, side),
        B = sample(to, 0, side);
      const C = sample(to, 0, side, 0.16),
        D = sample(from, 0, side, 0.16);
      if (side === 1) quad4(out, 'timber', D, C, B, A, color.ridge);
      else quad4(out, 'timber', A, B, C, D, color.ridge);
    }
  }
  for (const end of [-1, 1]) {
    const eave = sample(end, 0, 1, 0.14),
      opposite = sample(end, 0, -1, 0.14);
    const peak = sample(end, 1, 1, 0.07);
    const wallEave = [eave[0], y - 0.06, eave[2]];
    const wallOpposite = [opposite[0], y - 0.06, opposite[2]];
    if (end === 1) {
      tri(out, 'wall', wallEave, wallOpposite, peak, color.plaster);
    } else {
      tri(out, 'wall', peak, wallOpposite, wallEave, color.plaster);
    }
    if (lod) {
      const edge = sample(end, 1, 1);
      const foot = edge[1] - 0.085;
      const coords = [edge[0], edge[2]];
      lathe(
        out,
        'bronze',
        coords,
        [
          [foot, 0.15, 0.14],
          [foot + 0.24, 0.14, 0.13],
          [foot + 0.42, 0.045, 0.045],
        ],
        [5, 7, 9, 12][lod],
        color.trim,
      );
    }
  }
}

function platformAndSteps(out, lod) {
  const whole = ring.map(([x, z]) => [
    x + (x > centerX ? 0.28 : -0.28),
    z + (z > 0 ? 0.35 : -0.06),
  ]);
  extrude(out, 'stairs', whole, -1.8, floor, color.platform);
  extrude(out, 'stairs', rearFootprint, 2.12, 4.92, color.platform);
  const count = lod ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const z = frontZ + 0.2 + (2.79 * i) / count;
    const top = floor - (floor - 0.34) * (i / count);
    abox(
      out,
      'stairs',
      [centerX - 8.03, -0.9, z],
      [centerX + 8.03, top, z + 2.79 / count + 0.009],
      i % 2 ? color.platform : color.plaster,
      { bottom: false },
    );
  }
}

function rearShrine(out, lod) {
  const [l, r] = [ring[0][0], ring[1][0]];
  const zBack = Math.min(ring[0][1], ring[1][1]);
  abox(out, 'wall', [l + 0.49, 4.7, zBack + 0.62], [r - 0.45, 7.92, -0.18], color.plaster);
  curvedRoof(out, [l - 0.13, r + 0.13, zBack - 0.16, 0.41], 7.94, 2.1, lod, 0.59, true);
  if (lod) {
    const edge = facade([0, zBack + 0.61], [-1, 0]);
    for (const x of [-3.9, 0, 3.9]) {
      fbox(out, 'door', edge, x - 0.89, x + 0.89, 5.28, 7.3, 0.028, 0.08, color.door);
      if (lod >= 2)
        fbox(out, 'timber', edge, x - 1.04, x + 1.04, 7.24, 7.48, 0.018, 0.135, color.red);
    }
  }
}

function coveredHall(out, lod) {
  const x0 = b[0],
    x1 = a[0],
    z0 = -0.58,
    z1 = frontZ;
  const walls = frontFootprint.map(([x, z]) => [
    x + (x > centerX ? -0.53 : 0.53),
    z + (z > 2 ? -3.21 : 0.48),
  ]);
  extrude(out, 'wall', walls, floor, facadeBeam + 0.104, color.plaster, { top: false });
  curvedRoof(out, [x0, x1, z0, z1], facadeBeam, 2.22, lod, 0.93);
  const upper = [centerX - 8.01, centerX + 8.01, 1.23, 8.19];
  abox(
    out,
    'timber',
    [upper[0] + 0.18, 6.55, upper[2] + 0.49],
    [upper[1] - 0.18, 8.62, upper[3] - 0.49],
    color.red,
  );
  curvedRoof(out, upper, 8.58, 1.91, lod, 0.96);
  const upperFace = facade([centerX, upper[3] - 0.48], [1, 0]);
  fbox(out, 'timber', upperFace, -7.69, 7.69, 7.06, 7.21, 0.015, 0.25, color.beam);
  fbox(out, 'timber', upperFace, -7.69, 7.69, 8.35, 8.52, 0.015, 0.25, color.beam);
  fbox(out, 'door', upperFace, -2.39, 2.39, 7.31, 8.2, 0.026, 0.16, color.plaque);
  if (lod) {
    for (const x of [-5.98, -3.69, 3.69, 5.98]) {
      fbox(out, 'door', upperFace, x - 0.93, x + 0.93, 7.26, 8.29, 0.034, 0.119, color.shadow);
      fbox(out, 'timber', upperFace, x - 0.082, x + 0.082, 7.23, 8.32, 0.115, 0.195, color.trim);
    }
  }
  const bays = 7,
    pitch = 21.86 / bays;
  const beamZ = 9.56;
  abox(
    out,
    'timber',
    [centerX - 11.58, facadeBeam - 0.59, beamZ - 0.26],
    [centerX + 11.58, facadeBeam - 0.16, beamZ + 0.12],
    color.beam,
  );
  for (let n = 0; n <= bays; n++) {
    const x = centerX - 10.93 + n * pitch;
    tower(
      out,
      'timber',
      [x, beamZ],
      lod > 1 ? 0.225 : 0.239,
      [5, 7, 10, 14][lod],
      floor + 0.193,
      facadeBeam - 0.49,
      color.red,
      { top: false },
    );
    abox(
      out,
      'stairs',
      [x - 0.34, floor, beamZ - 0.34],
      [x + 0.34, floor + 0.2, beamZ + 0.34],
      color.plaster,
    );
    if (lod)
      abox(
        out,
        'timber',
        [x - 0.39, facadeBeam - 0.76, beamZ - 0.44],
        [x + 0.39, facadeBeam - 0.5, beamZ + 0.35],
        color.beam,
      );
  }
  for (let i = 0; i < bays; i++) {
    const x = (-bays / 2 + i + 0.5) * pitch;
    fbox(
      out,
      'door',
      hallFace,
      x - 1.28,
      x + 1.28,
      floor + 0.05,
      facadeBeam - 0.48,
      -0.56,
      0.027,
      color.door,
    );
    if (lod > 1)
      for (const side of [-1, 1]) {
        const post = x + side * 0.83;
        fbox(
          out,
          'timber',
          hallFace,
          post - 0.092,
          post + 0.092,
          floor + 0.12,
          facadeBeam - 0.49,
          0.031,
          0.097,
          color.trim,
        );
        fbox(
          out,
          'timber',
          hallFace,
          post - 0.045,
          post + 0.045,
          floor + 0.46,
          floor + 2.05,
          0.1,
          0.122,
          color.beam,
        );
      }
  }
}

function burner(out, lod) {
  if (!lod) return;
  const location = [centerX, frontZ + 4.1];
  const sides = [0, 9, 14, 22][lod];
  lathe(
    out,
    'bronze',
    location,
    [
      [0.34, 0.48, 0.48],
      [0.55, 0.55, 0.55],
      [0.71, 0.41, 0.41],
      [1.18, 0.38, 0.38],
      [1.42, 0.79, 0.79],
      [1.76, 1.06, 1.06],
      [1.93, 1.07, 1.07],
      [1.95, 0.93, 0.93],
      [1.62, 0.78, 0.78],
    ],
    sides,
    color.iron,
  );
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  platformAndSteps(out, lod);
  rearShrine(out, lod);
  coveredHall(out, lod);
  burner(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'thien-tru-pagoda-model.mjs';
const camera = [-28, 16, 41];
const lookAt = [0, 5.55, 0.5];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'heritage-pagoda',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The Tam Bảo main sanctuary of Thiên Trù Pagoda with two upturned tile roofs, a red timber colonnade, raised plaque and bronze incense bowl.',
  camera,
  lookAt,
  sunDirection: [-34, 48, 59],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.83,
    basis:
      'The named temple point and Google Open Buildings outline identify the mapped main sanctuary roof.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'main-shrine-from-the-courtyard', position: [0.4, 4.1, 36], lookAt: [0.6, 6.45, 9.1] },
    { name: 'doubled-roof-and-plaque', position: [14.5, 12.2, 27], lookAt: [0.5, 8.4, 5] },
    { name: 'entry-bay-and-incense', position: [-11, 5.4, 20.5], lookAt: [-1.1, 4.2, 11] },
    { name: 'sanctuary-on-the-hill', position: [-27, 24, -34], lookAt: [0.7, 6.3, 1.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thien-tru-pagoda-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.087, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces },
    },
  },
};
