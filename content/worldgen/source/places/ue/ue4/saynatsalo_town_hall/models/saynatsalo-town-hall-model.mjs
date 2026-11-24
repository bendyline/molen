import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
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
const elevation = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const hall = outwardRing(frame.geometry.outline);
const library = outwardRing(frame.features[1].points);
const { foundation, court, eaveLow, libraryEave, towerLow, towerHigh } = plan.dimensions;
const { heightsMeters, modelDatumElevationMeters, origin, stepMeters } = elevation;
const brick = rgb('a25b45');
const darkBrick = rgb('8e5142');
const paving = rgb('9d9b8c');
const green = rgb('758154');
const olive = rgb('657346');
const roof = rgb('484740');
const copper = rgb('53574d');
const wood = rgb('4b392f');
const glass = rgb('50554c');
const water = rgb('607c72');
const shade = rgb('353932');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.97 },
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
  water: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.41 },
};

function ground(x, z) {
  const col = Math.round((x - origin[0]) / stepMeters);
  const row = Math.round((z - origin[1]) / stepMeters);
  return heightsMeters[row][col] - modelDatumElevationMeters;
}

function skin(out, ring, base, heightAt, slot, color) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    quad4(
      out,
      slot,
      [a[0], base, a[1]],
      [b[0], base, b[1]],
      [b[0], heightAt(b), b[1]],
      [a[0], heightAt(a), a[1]],
      color,
    );
  }
}

function top(out, slot, ring, heightAt, color) {
  const corners = earcut(ring.flat(), [], 2);
  const at = (i) => {
    const p = ring[i];
    return [p[0], heightAt(p), p[1]];
  };
  for (let i = 0; i < corners.length; i += 3) {
    tri(out, slot, at(corners[i]), at(corners[i + 2]), at(corners[i + 1]), color);
  }
}

function window(out, face, u, y, width, height, lod, spans = 1, tint = glass) {
  opening(out, face, u, y, width, height, {
    glassSlot: 'glass',
    frameSlot: 'timber',
    glass: tint,
    frame: wood,
    frameWidth: lod > 1 ? 0.088 : 0,
    frameDepth: 0.112,
    sill: false,
    d: 0.035,
    mullions: lod > 0 ? spans - 1 : 0,
    transoms: lod === 3 && height > 1.42 ? 1 : 0,
  });
}

function lowWings(out, lod, ring, isLibrary) {
  const roofAt = isLibrary
    ? ([, z]) => libraryEave + (26.1 - z) * 0.071
    : ([, z]) => eaveLow + (z + 1) * 0.026;
  skin(out, ring, foundation, roofAt, 'brick', isLibrary ? darkBrick : brick);
  top(out, 'roof', ring, roofAt, roof);
  if (lod === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (face.length < 2.35) continue;
    const middle = face.length / 2;
    const [x, , z] = face.P(middle, 0);
    const insideCourt = -x * face.normal[0] + (7 - z) * face.normal[1] > 0;
    const roofLine = roofAt([x, z]);
    fbox(
      out,
      'metal',
      face,
      0.06,
      face.length - 0.06,
      roofLine - 0.19,
      roofLine - 0.06,
      0.027,
      0.12,
      copper,
    );
    const count = Math.ceil(face.length / (insideCourt ? 7 : 5.6));
    const bay = face.length / count;
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) * bay;
      const [px, , pz] = face.P(u, 0, 0.67);
      const g = ground(px, pz);
      const h = roofAt([px, pz]);
      const y = Math.max(court + (insideCourt ? 0.33 : 0.46), g + 0.98);
      const w = bay * (insideCourt ? 0.9 : isLibrary ? 0.78 : 0.64);
      const clear = Math.min(h - y - 0.43, insideCourt ? 2.25 : 1.6);
      if (clear > 0.4) {
        window(out, face, u, y, w, clear, lod, Math.ceil(w / (insideCourt ? 0.92 : 1.43)));
      }
      if (!insideCourt && g < court - 1.63 && (isLibrary || (z > 7 && j % 2 === 0))) {
        const groundWindow = g + 0.43;
        window(
          out,
          face,
          u,
          groundWindow,
          w * 0.9,
          Math.min(2.22, court - groundWindow - 0.26),
          lod,
          3,
        );
      }
    }
  }
}

function councilChamber(out, lod) {
  const chamber = outwardRing([
    [8.86, 5.4],
    [17.2, 5.4],
    [19.25, 7.6],
    [19.25, 13.7],
    [8.86, 13.7],
  ]);
  const roofAt = ([x, z]) =>
    towerLow + ((x - 8.86) / 10.39) * (towerHigh - towerLow - 0.27) + (z - 5.4) * 0.0325;
  skin(out, chamber, eaveLow - 0.36, roofAt, 'brick', brick);
  top(out, 'roof', chamber, roofAt, roof);
  const base = outwardRing([
    [7.5, 6.15],
    [10.2, 6.15],
    [10.2, 12.6],
    [7.5, 12.6],
  ]);
  skin(out, base, eaveLow - 0.5, () => 9.66, 'brick', darkBrick);
  top(out, 'roof', base, () => 9.66, roof);
  if (lod === 0) return;
  for (let i = 0; i < chamber.length; i++) {
    const face = wallFace(chamber[i], chamber[(i + 1) % chamber.length]);
    if (face.normal[1] > 0.6) {
      window(out, face, face.length * 0.19, 8.75, 0.83, 4.08, lod, 1, shade);
    } else if (face.normal[0] > 0.75) {
      window(out, face, face.length * 0.66, 9.2, 1.55, 4.22, lod, 2, shade);
    } else if (face.normal[0] < -0.85) {
      window(out, face, face.length * 0.8, 8.43, 0.87, 1.31, lod, 1, shade);
    }
  }
  const clerestory = facade([7.49, 9.35], [0, 1]);
  window(out, clerestory, 0, 9.08, 5.91, 0.45, lod, 5, shade);
  fbox(out, 'metal', clerestory, -3.32, 3.32, 9.57, 9.7, -0.03, 0.34, copper);
}

const lawn = outwardRing([
  [-8.987, -4.76],
  [10.83, -4.76],
  [10.83, 5.255],
  [5.38, 5.255],
  [5.38, 15.27],
  [7.9, 17.78],
  [-13.1, 17.65],
  [-10.2, 12.44],
  [-8.987, 10.83],
]);
function courtyard(out, lod) {
  extrude(out, 'brick', lawn, 1.86, court - 0.02, darkBrick, { top: false });
  top(out, 'grass', lawn, () => court, green);
  abox(out, 'stone', [-8.65, court, -4.5], [-7.25, court + 0.048, 10.92], paving, {
    bottom: false,
  });
  abox(out, 'stone', [-7.25, court, 14.82], [6.37, court + 0.044, 16.51], paving, {
    bottom: false,
  });
  const stair = facade([7.92, 16.64], [0, -1]);
  const lower = 0.96;
  const length = 11.2;
  const steps = lod === 0 ? 5 : 22;
  fbox(out, 'stone', stair, -1.08, 1.08, court - 0.22, court + 0.027, -2.05, 0.018, paving);
  for (let j = 0; j < steps; j++) {
    const t = j / steps;
    const half = 1.08 + t * 0.73;
    fbox(
      out,
      'stone',
      stair,
      -half,
      half,
      lower - 0.8,
      court - ((j + 1) / steps) * (court - lower),
      t * length,
      ((j + 1) / steps) * length,
      paving,
    );
  }
  const grassStair = facade([-10.15, 14.09], [0, 1]);
  const terraces = lod === 0 ? 3 : 7;
  for (let i = 0; i < terraces; i++) {
    const t = i / terraces;
    const y = court - ((i + 1) / terraces) * 1.82;
    fbox(
      out,
      'grass',
      grassStair,
      -2.03 - 0.75 * t,
      2.03 + 0.75 * t,
      2.7,
      y,
      t * 12.1,
      ((i + 1) / terraces) * 12.1,
      i % 2 ? green : olive,
    );
  }
  if (lod === 0) return;
  abox(out, 'water', [-6.25, court, 9.35], [-1.08, court + 0.045, 12.48], water, { bottom: false });
  for (const x of [-6.37, -1.08]) {
    abox(out, 'stone', [x, court, 9.23], [x + 0.12, court + 0.11, 12.59], paving, {
      bottom: false,
    });
  }
  for (const z of [9.23, 12.48]) {
    abox(out, 'stone', [-6.25, court, z], [-1.08, court + 0.11, z + 0.11], paving, {
      bottom: false,
    });
  }
  abox(out, 'timber', [3.45, court + 2.64, 6.44], [5.45, court + 2.82, 13.52], wood, {
    bottom: true,
  });
  for (const z of [6.58, 9.75, 13.35]) {
    abox(out, 'timber', [3.49, court, z - 0.084], [3.64, court + 2.66, z + 0.084], wood);
  }
}

function build(out, lod) {
  lowWings(out, lod, hall, false);
  lowWings(out, lod, library, true);
  councilChamber(out, lod);
  courtyard(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'saynatsalo-town-hall-model.mjs';
const camera = [50, 27, 44];
const lookAt = [0, 6, 8];
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
    'Säynätsalo Town Hall with its tall red-brick council chamber, raised courtyard, granite stair and original library wing.',
  camera,
  lookAt,
  sunDirection: [34, 61, 32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    outlines: [hall, library],
    minimumCoverage: 0.92,
    basis: 'The mapped Town Hall footprint and its separate original library wing.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'council-chamber-and-library', position: camera, lookAt },
    {
      name: 'brick-chamber-from-courtyard',
      position: [-4, 7.45, 12.6],
      lookAt: [12.3, 9.43, 9.14],
    },
    { name: 'library-and-granite-approach', position: [28, 6, 27], lookAt: [10, 5.65, 15.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'saynatsalo-town-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
