import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const control = read('native-map/bulls-head-native-geometry');
const {
  mainHalfWidth: x,
  mainRear: rear,
  mainWallFront: front,
  verandahFront: porch,
  rearAnnex: annex,
  wallEaveM: eave,
  roofRidgeM: ridge,
  frontRoofColumns,
} = control;

const surface = (slot, graph, roughness = 0.92) => ({ slot, graph, roughness });
const surfaces = {
  siding: surface('wall', 'wood_painted_lap'),
  iron: surface('roof', 'metal_corrugated', 0.85),
  trim: surface('trim', 'wood_plain', 0.84),
  masonry: surface('foundation', 'plaster_lime'),
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};
const clapboard = rgb('d2c4a4');
const eaveBoard = rgb('ddd1b1');
const framePaint = rgb('918469');
const roofIron = rgb('7c817c');
const shadedIron = rgb('686d69');
const verandaFloor = rgb('77634c');
const darkGlass = rgb('48504b');
const glassInShade = rgb('434640');
const gableZ = (front + rear) / 2;
const slabY = 0.56;

function dormer(out, offset, direction, level) {
  const z = gableZ + direction * 2.89;
  const tail = gableZ + direction * 0.55;
  const low = 5.08,
    top = 7.19;
  const half = direction > 0 ? 0.72 : 0.64;
  abox(
    out,
    'siding',
    [offset - half, low, Math.min(z, tail)],
    [offset + half, top, Math.max(z, tail)],
    clapboard,
    { bottom: false },
  );
  gableRoof(out, 'iron', [offset, tail], [offset, z], half * 2, top, top + 0.59, shadedIron, {
    overhang: 0.1,
    endSlot: 'siding',
    endColor: eaveBoard,
  });
  const f = facade([offset, z], [direction, 0]);
  opening(out, f, 0, 5.97, 0.85, 1.06, {
    glassSlot: 'glazing',
    glass: darkGlass,
    frameSlot: 'trim',
    frame: eaveBoard,
    frameWidth: level >= 1 ? 0.11 : 0,
    frameDepth: 0.07,
    sill: level >= 1,
    transoms: level >= 2 ? 1 : 0,
    mullions: level >= 3 ? 1 : 0,
    mullionColor: eaveBoard,
  });
  if (level >= 2)
    for (const side of [-1, 1]) {
      const u = side * (half - 0.046);
      fbox(out, 'trim', f, u - 0.042, u + 0.042, 5.68, top, -0.035, 0.062, eaveBoard);
    }
}

function sash(out, f, at, level, door = false) {
  opening(out, f, at, door ? slabY + 0.025 : 1.38, door ? 1.23 : 0.91, door ? 2.31 : 1.44, {
    glassSlot: door ? 'trim' : 'glazing',
    glass: door ? framePaint : glassInShade,
    frameSlot: 'trim',
    frame: eaveBoard,
    frameWidth: level >= 1 ? 0.11 : 0,
    frameDepth: 0.068,
    d: 0.024,
    sill: !door && level >= 1,
    mullions: level >= 2 ? 1 : 0,
    transoms: level >= 2 ? 1 : 0,
    mullionColor: eaveBoard,
  });
  if (door && level >= 2) {
    for (const u of [at - 0.33, at + 0.33]) {
      fbox(out, 'glazing', f, u - 0.18, u + 0.18, 1.58, 2.49, 0.026, 0.042, glassInShade);
      fbox(out, 'trim', f, u - 0.17, u + 0.17, 0.8, 1.24, 0.029, 0.046, clapboard);
    }
  }
}

function verandah(out, level) {
  const roofInner = eave - 0.14,
    roofOuter = 2.84;
  abox(out, 'trim', [-x, 0.44, front], [x, slabY, porch + 0.08], verandaFloor);
  const end = porch + 0.24;
  quad4(
    out,
    'iron',
    [-x - 0.2, roofOuter, end],
    [x + 0.2, roofOuter, end],
    [x + 0.2, roofInner, front - 0.19],
    [-x - 0.2, roofInner, front - 0.19],
    roofIron,
  );
  quad4(
    out,
    'iron',
    [x + 0.2, roofOuter - 0.044, end],
    [-x - 0.2, roofOuter - 0.044, end],
    [-x - 0.2, roofInner - 0.044, front - 0.19],
    [x + 0.2, roofInner - 0.044, front - 0.19],
    shadedIron,
  );
  abox(
    out,
    'trim',
    [-x - 0.2, roofOuter - 0.16, end - 0.115],
    [x + 0.2, roofOuter, end],
    eaveBoard,
  );
  const extent = x - 0.31;
  const columns = Array.from(
    { length: frontRoofColumns },
    (_, i) => -extent + (i * (2 * extent)) / (frontRoofColumns - 1),
  );
  const porchFace = facade([0, porch - 0.19], [1, 0]);
  for (const u of columns) {
    fbox(
      out,
      'trim',
      porchFace,
      u - 0.078,
      u + 0.078,
      slabY,
      roofOuter - 0.075,
      -0.091,
      0.045,
      framePaint,
    );
    if (level >= 2)
      fbox(
        out,
        'trim',
        porchFace,
        u - 0.105,
        u + 0.105,
        roofOuter - 0.21,
        roofOuter - 0.08,
        -0.105,
        0.075,
        eaveBoard,
      );
  }
  const enclosureStart = columns.at(-2) + 0.07;
  abox(
    out,
    'siding',
    [enclosureStart, slabY, front + 0.01],
    [x - 0.08, roofOuter - 0.04, porch - 0.12],
    clapboard,
  );
  const enclosingFace = facade([0, porch - 0.12], [1, 0]);
  sash(out, enclosingFace, (enclosureStart + x) / 2, level);
  for (const sign of [-1, 1]) {
    const width = level === 0 ? 2.22 : 1.92;
    const cx = sign * 3.1;
    for (let i = 0; i < 3; i++)
      abox(
        out,
        'masonry',
        [cx - width / 2, -0.14, porch + 0.2 + i * 0.24],
        [cx + width / 2, slabY - 0.17 * i, porch + 0.45 + i * 0.24],
        eaveBoard,
      );
  }
  if (level >= 2)
    for (let i = 0; i < 28; i++) {
      const u = -x + (i * (2 * x)) / 28;
      quad4(
        out,
        'trim',
        [u, slabY + 0.001, front + 0.02],
        [u + 0.022, slabY + 0.001, front + 0.02],
        [u + 0.022, slabY + 0.001, porch - 0.04],
        [u, slabY + 0.001, porch - 0.04],
        framePaint,
      );
    }
}

function returnWing(out, level) {
  const left = annex.left + 0.06,
    right = annex.right - 0.03,
    back = annex.back + 0.09;
  const centre = (left + right) / 2;
  abox(out, 'masonry', [left, -0.72, back], [right, 0.57, rear + 0.09], framePaint);
  abox(out, 'siding', [left, slabY, back], [right, 3.08, rear + 0.11], clapboard);
  gableRoof(
    out,
    'iron',
    [centre, rear + 0.23],
    [centre, back],
    right - left,
    3.08,
    4.47,
    shadedIron,
    { overhang: 0.19, endSlot: 'siding', endColor: clapboard },
  );
  if (level >= 1) {
    sash(out, facade([centre, back], [-1, 0]), 0, level);
    sash(out, facade([left, (rear + back) / 2], [0, 1]), 0, level, true);
  }
}

function build(out, level) {
  abox(out, 'masonry', [-x, -0.63, rear], [x, slabY, porch], eaveBoard);
  abox(out, 'siding', [-x, slabY, rear], [x, eave, front], clapboard);
  gableRoof(out, 'iron', [-x, gableZ], [x, gableZ], front - rear, eave, ridge, roofIron, {
    overhang: 0.27,
    endSlot: 'siding',
    endColor: clapboard,
  });
  for (const u of [-5.68, 0, 5.68]) dormer(out, u, 1, level);
  dormer(out, -0.9, -1, level);
  returnWing(out, level);
  verandah(out, level);
  const street = facade([0, front], [1, 0]);
  for (const u of [-8.15, -5.1, -0.02, 5.1, 7.96]) sash(out, street, u, level);
  for (const u of [-2.65, 2.6]) sash(out, street, u, level, true);
  const back = facade([0, rear], [-1, 0]);
  if (level >= 1) {
    for (const u of [-8.15, -4.8, 0.03, 3.02]) sash(out, back, u, level);
    for (const sign of [-1, 1]) {
      const f = facade([sign * x, gableZ], [0, -sign]);
      sash(out, f, -1.45, level);
      sash(out, f, 1.34, level);
      opening(out, f, 0, 5.22, 0.91, 1.35, {
        glassSlot: 'glazing',
        frameSlot: 'trim',
        glass: darkGlass,
        frame: eaveBoard,
        frameWidth: 0.095,
        frameDepth: 0.065,
        sill: true,
        transoms: level >= 2 ? 1 : 0,
      });
    }
  }
  if (level >= 2) {
    for (const sign of [-1, 1]) {
      const f = facade([sign * x, gableZ], [0, -sign]);
      for (const side of [-1, 1]) {
        const u = (side * (front - rear)) / 2 - 0.075;
        fbox(out, 'trim', f, u - 0.071, u + 0.071, slabY, eave, -0.116, 0.055, eaveBoard);
      }
    }
    const count = level === 2 ? 15 : 37;
    for (let i = 1; i <= count; i++) {
      const pos = -x + (i * (2 * x)) / (count + 1);
      abox(
        out,
        'trim',
        [pos - 0.014, 2.73, porch - 0.06],
        [pos + 0.014, 2.79, porch + 0.15],
        framePaint,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'royal-bull-s-head-inn-model.mjs';
const camera = [-19, 9.1, 26],
  lookAt = [0, 3.75, -1.15];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-inn',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The timber Royal Bull’s Head Inn on Brisbane Street in Drayton, with steep corrugated iron roofs, four dormers and a long street verandah.',
  camera,
  lookAt,
  sunDirection: [-34, 52, 51],
  mediumFiContext: {
    scale: 0.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Use the named outline of OSM way 249200591 to replace the generic building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'street-verandah-and-dormers', position: camera, lookAt },
    { name: 'rear-kitchen-return', position: [-18, 7.3, -23], lookAt: [-1, 2.9, -2.5] },
    { name: 'dormer-roofs-and-chamferboards', position: [18, 12, 16], lookAt: [2.0, 5.05, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'royal-bull-s-head-inn-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.61,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.112, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.043, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model informed by the National Trust’s public-domain Lynch family scan, State Library architectural history, native OpenStreetMap footprint and official Queensland elevation.',
};
