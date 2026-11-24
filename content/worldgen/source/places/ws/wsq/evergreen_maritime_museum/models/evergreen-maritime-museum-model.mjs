import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/evergreen-building-parts.json', import.meta.url)),
);
const part = new Map(parts.map(({ way, local }) => [way.id, local]));
const outline = frame.geometry.outline;
const wall = rgb('b4a68c');
const lower = rgb('9e9482');
const bronze = rgb('969387');
const limestone = rgb('c1b294');
const reveal = rgb('766f60');
const tinted = rgb('50817f');
const blueSlate = rgb('49727a');
const recess = rgb('465553');
const roof = rgb('938b7f');
const granite = rgb('555951');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.9 },
  cornice: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.88 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  tinted: { slot: 'window', graph: 'glass_frit_triangular', roughness: 0.58 },
  distantGlazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.68 },
};
const lowerEave = 22.4;

function section(out, ring, low, high, color, slot = 'stone') {
  extrude(out, slot, ring, low, high, color, { top: false });
  const indices = earcut(ring.flat(), [], 2);
  const vertex = (i) => [ring[i][0], high, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    tri(out, 'roof', vertex(a), vertex(c), vertex(b), roof);
  }
}

function elevations(out, footprint, floors, lod, color, isLower = false) {
  const ring = outwardRing(footprint);
  for (let i = 0; i < ring.length; i++) {
    const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (face.length < 3.25) continue;
    if (lod === 0) {
      if (face.length > 8) {
        for (const y of floors) {
          quad4(
            out,
            'distantGlazing',
            face.P(0.68, y + 0.3, 0.027),
            face.P(face.length - 0.68, y + 0.3, 0.027),
            face.P(face.length - 0.68, y + 1.73, 0.027),
            face.P(0.68, y + 1.73, 0.027),
            color,
          );
        }
      }
      continue;
    }
    const spacing = face.length / Math.max(1, Math.round(face.length / (isLower ? 3.65 : 2.7)));
    const width = Math.min(spacing * (isLower ? 0.73 : 0.64), isLower ? 3.25 : 2.08);
    for (let u = spacing / 2; u < face.length; u += spacing) {
      for (let floor = 0; floor < floors.length; floor++) {
        const y = floors[floor];
        const large = isLower && floor < 2;
        const height = large ? 2.87 : 2.03;
        if (isLower && lod === 3)
          fbox(
            out,
            'cornice',
            face,
            u - width / 2 - 0.18,
            u + width / 2 + 0.18,
            y - 0.12,
            y + height + 0.19,
            0.015,
            0.16,
            reveal,
          );
        opening(out, face, u, y, width, height, {
          glassSlot: 'tinted',
          frameSlot: 'metal',
          glass: floor % 3 === 1 ? color.map((c) => c * 0.91) : color,
          frame: bronze,
          d: isLower && lod === 3 ? 0.178 : 0.04,
          frameWidth: lod === 3 ? 0.052 : 0,
          frameDepth: isLower ? 0.2 : 0.075,
          mullions: lod === 3 && width > 1.85 ? 1 : 0,
          transoms: lod === 3 && large ? 1 : 0,
          sill: false,
        });
      }
    }
    if (lod > 1 && isLower)
      fbox(
        out,
        'cornice',
        face,
        0.06,
        face.length - 0.06,
        lowerEave - 0.67,
        lowerEave + 0.02,
        0,
        0.61,
        limestone,
      );
  }
}

function tower(out, id, height, lowerHeight, floors, lod, stoneColor, glassColor) {
  const ring = part.get(id);
  section(out, ring, lowerHeight, height, stoneColor);
  elevations(out, ring, floors, lod, glassColor);
  if (lod === 0) return;
  const rim = outwardRing(ring);
  for (let i = 0; i < rim.length; i++) {
    const face = wallFace(rim[i], rim[(i + 1) % rim.length]);
    if (face.length < 1.02) continue;
    fbox(
      out,
      'cornice',
      face,
      0.025,
      face.length - 0.025,
      height - 0.63,
      height + 0.19,
      0,
      0.48,
      limestone,
    );
  }
}

function entrance(out, lod) {
  const x = 29.97;
  abox(out, 'cornice', [x - 1, 4.54, -12.8], [x + 1.26, 5.09, 10.7], limestone, { bottom: true });
  if (lod === 0) return;
  for (const z of [-11.85, -4.55, 3.06, 9.98]) {
    abox(out, 'base', [x + 0.28, 0.18, z - 0.28], [x + 0.92, 4.57, z + 0.28], granite);
  }
  const gateX = 5.3;
  for (const x of [gateX - 3.9, gateX + 3.9])
    abox(out, 'base', [x - 0.36, -0.42, -30.27], [x + 0.36, 3.86, -29.55], granite);
  abox(out, 'base', [gateX - 4.37, 3.37, -30.25], [gateX + 4.37, 3.88, -29.56], granite);
}

function build(out, lod) {
  const { foundation, floor, mainRoof, sideWingRoof } = plan.dimensions;
  extrude(out, 'base', outline, foundation, floor, granite, { top: false });
  section(out, outline, floor, lowerEave, lower);
  elevations(out, outline, [1.15, 5.39, 9.86, 14.01, 18.29], lod, recess, true);
  tower(
    out,
    '610543917',
    mainRoof,
    lowerEave - 0.05,
    [23.48, 27.57, 31.71, 35.8, 39.91, 44.04, 47.53],
    lod,
    wall,
    tinted,
  );
  tower(
    out,
    '610543916',
    mainRoof + 0.72,
    lowerEave - 0.13,
    [24.01, 28.14, 32.3, 36.42, 40.57, 44.68, 48.21],
    lod,
    wall,
    blueSlate,
  );
  if (lod > 0) {
    section(out, part.get('610543914'), mainRoof - 0.05, mainRoof + 0.93, lower);
  }
  for (const id of ['610543911', '610543912', '610543920']) {
    tower(
      out,
      id,
      sideWingRoof,
      lowerEave - 0.16,
      [23.55, 27.63, 31.75, 35.85],
      lod,
      lower,
      blueSlate,
    );
  }
  entrance(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'evergreen-maritime-museum-model.mjs';
const camera = [88, 63, -108];
const lookAt = [-1, 21, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Evergreen Maritime Museum’s Taipei foundation building, with blue-green glazing, deep stone window bays and projecting cornices.',
  camera,
  lookAt,
  sunDirection: [38, 50, -63],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The mapped Chang Yung-Fa Foundation building at 11 Zhongshan South Road.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'renai-road-facade', position: camera, lookAt },
    { name: 'north-gate-and-stone-window-bays', position: [36, 10, -60], lookAt: [6, 13, -20] },
    { name: 'west-wing-and-roof-setbacks', position: [-93, 57, -62], lookAt: [-5, 25, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'evergreen-maritime-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.062, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Taiwan MOI 20 m DTM derivative under Taiwan Open Government Data License 1.0.',
};
