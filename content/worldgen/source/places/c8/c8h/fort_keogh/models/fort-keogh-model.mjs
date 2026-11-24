import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const controls = read('native-map/fort-keogh-water-wagon-geometry-controls');
const { halfWidth: x, halfDepth: z, eave, ridge } = controls.buildingDimensionsM;

const wall = rgb('ab795f');
const band = rgb('956750');
const foundation = rgb('a29b85');
const sill = rgb('b6a691');
const tile = rgb('7e7a6e');
const ridgeCap = rgb('827e72');
const wood = rgb('635e52');
const dark = rgb('4f4c43');
const glass = rgb('5d635e');
const hardware = rgb('504e46');

const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.89 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.35 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55 },
};

function hippedRoof(out, level) {
  const projection = 0.19;
  const westRidge = [-x + z * 0.92, ridge, 0];
  const eastRidge = [x - z * 0.92, ridge, 0];
  const sw = [-x - projection, eave, z + projection];
  const se = [x + projection, eave, z + projection];
  const ne = [x + projection, eave, -z - projection];
  const nw = [-x - projection, eave, -z - projection];
  quad4(out, 'roof', sw, se, eastRidge, westRidge, tile);
  quad4(out, 'roof', ne, nw, westRidge, eastRidge, tile);
  tri(out, 'roof', se, ne, eastRidge, tile);
  tri(out, 'roof', nw, sw, westRidge, tile);
  abox(
    out,
    'wood',
    [-x - projection, eave - 0.125, -z - projection],
    [x + projection, eave, z + projection],
    dark,
  );
  if (level < 2) return;
  abox(
    out,
    'roof',
    [westRidge[0], ridge - 0.045, -0.06],
    [eastRidge[0], ridge + 0.035, 0.06],
    ridgeCap,
  );
}

function wagonDoor(out, level) {
  const front = facade([x, 0], [0, -1]);
  fbox(out, 'wood', front, -1.46, 1.46, 0.13, 2.74, -0.026, 0.043, wood);
  if (level === 0) return;
  fbox(out, 'stone', front, -1.56, 1.56, 0.02, 0.13, -0.08, 0.42, foundation);
  for (const u of [-1.5, 1.5]) {
    fbox(out, 'wood', front, u - 0.06, u + 0.06, 0.12, 2.81, 0, 0.09, dark);
  }
  fbox(out, 'brick', front, -1.61, 1.61, 2.74, 2.95, -0.025, 0.047, band);
  if (level < 2) return;
  fbox(out, 'wood', front, -0.027, 0.027, 0.14, 2.73, 0.044, 0.056, dark);
  for (const u of [-1.48, 1.48]) {
    for (const y of [0.56, 2.25]) {
      const edge = u - Math.sign(u) * 0.3;
      fbox(
        out,
        'iron',
        front,
        Math.min(u, edge),
        Math.max(u, edge),
        y,
        y + 0.065,
        0.048,
        0.076,
        hardware,
      );
    }
  }
  if (level !== 3) return;
  for (const u of [-1.15, -0.86, -0.57, -0.29, 0.29, 0.57, 0.86, 1.15]) {
    fbox(out, 'wood', front, u - 0.008, u + 0.008, 0.17, 2.69, 0.045, 0.051, dark);
  }
}

function sideWindows(out, level) {
  const sides = [facade([0, z], [1, 0]), facade([0, -z], [-1, 0])];
  for (const side of sides) {
    for (const u of [-2.83, 2.58]) {
      opening(out, side, u, 1.15, 0.92, 1.43, {
        head: 'round',
        glass,
        d: 0.021,
        frameSlot: 'brick',
        frame: band,
        frameWidth: level ? 0.108 : 0,
        frameDepth: 0.065,
        sill: false,
        mullions: level > 1 ? 1 : 0,
        transoms: level === 3 ? 1 : 0,
        mullionColor: dark,
      });
      if (level > 0) {
        fbox(out, 'stone', side, u - 0.56, u + 0.56, 1.09, 1.16, 0, 0.11, sill);
      }
    }
  }
}

function build(out, level) {
  abox(out, 'stone', [-x, -0.21, -z], [x, 0.16, z], foundation);
  abox(out, 'brick', [-x, 0.16, -z], [x, eave, z], wall);
  hippedRoof(out, level);
  wagonDoor(out, level);
  sideWindows(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-keogh-model.mjs';
const camera = [15, 7.8, -13.8];
const lookAt = [0, 2.24, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Fort Keogh Water Wagon Shed',
  wikidataId: plan.wikidataId,
  category: 'historic-building',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The restored 1883 water wagon shed, a modest brick building with round-headed openings and a low hipped roof.',
  camera,
  lookAt,
  sunDirection: [18, 21, -17],
  mediumFiContext: {
    scale: 0.91,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis:
      'Replaces a generic building only within the roof outline interpreted from the exact aerial.',
  },
  embeddedCanonicalGraphs: ['brick', 'stone_ashlar', 'tile_flat', 'wood_plain', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'wagon-entry-and-long-wall', position: camera, lookAt },
    { name: 'hip-roof-and-rear-brickwork', position: [-15, 10, 10], lookAt },
    { name: 'arched-brick-openings', position: [1, 2.8, -8], lookAt: [0, 2.03, -z] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-keogh-water-wagon-shed-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.28,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.41, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on exact public-domain USDA aerial imagery, U.S. Geological Survey terrain and published state historic-register descriptions.',
};
