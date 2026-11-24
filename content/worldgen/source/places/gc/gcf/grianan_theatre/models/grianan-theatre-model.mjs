import fs from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
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
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const nativeOutline = frame.geometry.outline;
const outline = outwardRing(nativeOutline);
const porch = nativeOutline.slice(9, 20);
const body = nativeOutline.filter((_, index) => index < 10 || index >= 19);
const { foundation, plinth, foyerEave, foyerRidge, auditoriumEave, auditoriumRidge, flyTower } =
  plan.dimensions;
const cream = rgb('bdb7a1');
const pale = rgb('d6d0bb');
const zinc = rgb('8f938a');
const brownRed = rgb('855354');
const redSteel = rgb('8a5045');
const glass = rgb('5d6d70');
const darkGlass = rgb('465450');
const concrete = rgb('9e9786');
const stepStone = rgb('adaa94');

const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.76 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.81 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};

const front = facade([0, 25.74], [1, 0]);
const jamb = 9.62;
const glassWidth = 9.08;

function croppedBody(profile, east, west, north, south) {
  const limits = [
    [0, east, -1],
    [0, west, 1],
    [1, north, -1],
    [1, south, 1],
  ];
  let ring = profile;
  for (const [axis, level, sign] of limits) {
    ring = ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length];
      const aIn = (a[axis] - level) * sign >= 0;
      const bIn = (b[axis] - level) * sign >= 0;
      if (aIn === bIn) return aIn ? [a] : [];
      const t = (level - a[axis]) / (b[axis] - a[axis]);
      const crossing = a.map((coordinate, j) => coordinate + (b[j] - coordinate) * t);
      return aIn ? [a, crossing] : [crossing];
    });
  }
  return ring;
}

const auditorium = croppedBody(body, 13.6, -13.9, 9.5, -12);
const stage = croppedBody(body, 13.65, -13.6, -10.9, -30);
const foyerBody = croppedBody(body, jamb, -jamb, 25.6, 7.65);

function volume(out, slot, profile, base, top, tint, roofTint) {
  extrude(out, slot, profile, base, top, tint, { top: false });
  const indices = earcut(profile.flat(), [], 2);
  const point = (index) => [profile[index][0], top, profile[index][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, 'roof', point(indices[i]), point(indices[i + 2]), point(indices[i + 1]), roofTint);
}

function shell(out, lod) {
  volume(out, 'base', outline, foundation, plinth, concrete, concrete);
  volume(out, 'wall', body, plinth - 0.01, 6.5, cream, zinc);
  volume(out, 'wall', auditorium, 6.36, auditoriumEave, cream, zinc);
  volume(out, 'wall', stage, 6.42, flyTower, pale, zinc);
  extrude(out, 'wall', foyerBody, 6.41, foyerEave, cream, { top: false });
  gableRoof(out, 'roof', [0, -10.55], [0, 9.72], 26.8, auditoriumEave, auditoriumRidge, zinc, {
    overhang: 0.18,
    endSlot: 'wall',
    endColor: cream,
    ends: [false, true],
  });
  abox(out, 'roof', [-13.82, flyTower - 0.1, -20.1], [13.85, flyTower + 0.23, -10.72], zinc);
  gableRoof(out, 'roof', [0, 7.76], [0, 26.48], 2 * jamb, foyerEave, foyerRidge, zinc, {
    overhang: 0.72,
  });
  if (lod === 0) return;
  const wing = facade([13.85, 25.41], [1, -0.25]);
  fbox(out, 'steel', wing, -1.9, 1.15, 0.82, 6.32, 0, 0.1, brownRed);
  const backstage = facade([0, -20.75], [-1, -0.06]);
  for (const [x, width, height] of [
    [-6.4, 2, 2.5],
    [2.4, 4.5, 4],
    [7.1, 1.25, 2.4],
  ]) {
    const door = wallFace(nativeOutline[32], nativeOutline[31]);
    opening(out, door, door.length / 2 + x, 4.75, width, height, {
      glassSlot: 'door',
      frameSlot: 'steel',
      glass: x === 2.4 ? zinc : darkGlass,
      frame: pale,
      sill: false,
      mullions: lod > 1 && x === 2.4 ? 1 : 0,
    });
    if (lod > 1)
      fbox(out, 'steel', backstage, x - width * 0.36, x + width * 0.36, 10.18, 10.45, 0, 0.1, zinc);
  }
}

function curtainWall(out, lod) {
  const ceiling = (x) => foyerRidge - 0.24 - ((foyerRidge - foyerEave) * Math.abs(x)) / jamb;
  const pane = (x, y) => front.P(x, y, 0.12);
  quad4(
    out,
    'glass',
    pane(-glassWidth, plinth),
    pane(glassWidth, plinth),
    pane(glassWidth, foyerEave),
    pane(-glassWidth, foyerEave),
    glass,
  );
  tri(
    out,
    'glass',
    pane(-glassWidth, foyerEave),
    pane(glassWidth, foyerEave),
    pane(0, ceiling(0)),
    darkGlass,
  );
  for (const sign of [-1, 1]) {
    const end = sign * 10.31;
    const fasciapath = [front.P(end, foyerEave - 0.23, 1.45), front.P(0, foyerRidge - 0.03, 1.45)];
    beamPath(out, 'steel', fasciapath, 0.48, 0.22, pale);
    const fascia = [front.P(end, foyerEave - 0.46, 1.42), front.P(0, foyerRidge - 0.25, 1.42)];
    beamPath(out, 'steel', fascia, 0.12, 0.15, redSteel);
    const left = sign * 9.39 - 0.35;
    fbox(out, 'wall', front, left, left + 0.69, plinth, foyerEave - 0.18, -0.48, 1.36, pale);
  }
  const columns = [3, 6, 9, 12][lod];
  for (let column = 1; column < columns; column++) {
    const x = -glassWidth + (2 * glassWidth * column) / columns;
    const width = lod < 2 ? 0.085 : 0.057;
    fbox(out, 'steel', front, x - width, x + width, plinth, ceiling(x) - 0.1, 0.13, 0.24, pale);
  }
  for (const y of lod < 2 ? [3.3, 7.4] : [2.22, 3.45, 4.71, 5.98, 7.24, 8.49, 9.73, 10.96]) {
    const extent = Math.min(
      glassWidth,
      (jamb * (ceiling(0) - y)) / (foyerRidge - foyerEave) - 0.045,
    );
    fbox(out, 'steel', front, -extent, extent, y - 0.042, y + 0.042, 0.13, 0.21, pale);
  }
  if (lod === 0) return;
  const truss = (x, y) => front.P(x, y, 1.13);
  const centre = truss(0, 8.05);
  beamPath(out, 'steel', [truss(-9.65, 8.05), truss(9.65, 8.05)], 0.175, 0.18, redSteel);
  for (const [x, y] of [
    [0, 11.91],
    [-4.96, 10.3],
    [4.96, 10.3],
  ])
    beamPath(out, 'steel', [centre, truss(x, y)], 0.137, 0.15, redSteel);
}

function entrance(out, lod) {
  volume(out, 'door', porch, plinth - 0.025, 3.84, brownRed, zinc);
  const roundedFront = outwardRing(porch);
  if (lod > 0) {
    for (const [i, a] of roundedFront.entries()) {
      const b = roundedFront[(i + 1) % roundedFront.length];
      const f = wallFace(a, b);
      if (f.normal[1] < 0.32 || Math.abs((a[0] + b[0]) * 0.5) > 2.22) continue;
      opening(out, f, f.length / 2, plinth + 0.03, f.length * 0.91, 2.58, {
        glassSlot: 'glass',
        frameSlot: 'steel',
        glass: darkGlass,
        frame: pale,
        frameWidth: 0.045,
        frameDepth: 0.085,
        mullions: lod > 1 && f.length > 0.9 ? 1 : 0,
        transoms: lod > 1 ? 1 : 0,
        sill: false,
      });
    }
    const cap = outwardRing(porch).map(([x, z]) => [x * 1.018, 25.74 + (z - 25.74) * 1.047]);
    volume(out, 'steel', cap, 3.82, 3.95, pale, zinc);
  }
  for (let i = 0; i < 4; i++) {
    const z = 30.36 - i * 0.53;
    abox(out, 'base', [-4.65, -0.18, 27.04], [4.65, (i + 1) * 0.165, z], stepStone);
    if (lod < 2) continue;
    for (let tile = -9; tile <= 9; tile++) {
      const x = tile * 0.47;
      abox(
        out,
        'base',
        [x - 0.23, i * 0.165 + 0.047, z],
        [x + 0.22, i * 0.165 + 0.119, z + 0.018],
        (tile + i) % 2 === 0 ? pale : concrete,
        { bottom: false },
      );
    }
  }
  if (lod < 2) return;
  for (const x of [-4.32, 4.32]) {
    const rails = [
      [x, 0.93, 30.15],
      [x, 1.56, 28.06],
      [x, 1.56, 26.0],
    ];
    beamPath(out, 'steel', rails, 0.056, 0.058, zinc);
    for (const [px, y, z] of rails)
      abox(out, 'steel', [px - 0.024, y - 0.88, z - 0.026], [px + 0.024, y, z + 0.026], zinc);
  }
}

function build(out, lod) {
  shell(out, lod);
  curtainWall(out, lod);
  entrance(out, lod);
  if (lod < 3) return;
  for (const x of [-7.9, 7.95])
    abox(out, 'steel', [x - 0.31, 3.25, 25.82], [x + 0.31, 3.62, 26.02], zinc);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'grianan-theatre-model.mjs';
const camera = [-43, 23, 82];
const lookAt = [0, 7.4, 5];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'An Grianán Theatre',
  wikidataId: plan.wikidataId,
  category: 'performance-sport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'The Letterkenny theatre with a glazed gable, exposed roof braces and a curved entrance.',
  camera,
  lookAt,
  sunDirection: [-34, 64, 59],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named native An Grianán Theatre outline including the main curved entrance.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'port-road-theatre', position: camera, lookAt },
    { name: 'glass-gable-and-braces', position: [-3, 9.3, 59], lookAt: [0, 6.4, 25.8] },
    { name: 'curved-entrance-and-steps', position: [8, 4.7, 42.5], lookAt: [0, 2.3, 27.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'grianan-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.048, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
