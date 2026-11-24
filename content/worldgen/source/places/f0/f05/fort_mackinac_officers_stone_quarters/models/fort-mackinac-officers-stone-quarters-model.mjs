import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  pointedArch,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const stone = rgb('bdb5a2');
const foundation = rgb('9e9683');
const trim = rgb('e0d9c7');
const door = rgb('867b66');
const shutters = rgb('656659');
const glass = rgb('424c4a');
const roof = rgb('625e54');
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  roofing: { slot: 'roof', graph: 'tile_flat', roughness: 0.93 },
  gallery: { slot: 'wall', graph: 'siding_lap', roughness: 0.89 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};
const half = plan.dimensions.mainLengthM / 2;
const north = -5.76;
const south = north + plan.dimensions.stoneBodyDepthM;
const edge = south + plan.dimensions.southGalleryDepthM;
const slab = 0.28;
const eave = plan.dimensions.paradeEavesM;
const ridge = plan.dimensions.mainRidgeM;
const northFace = facade([0, north], [-1, 0]);
const southFace = facade([0, south], [1, 0]);

function windowUnit(out, face, x, base, width, height, level, hasShutters) {
  if (level > 0) {
    opening(out, face, x, base, width, height, {
      glass,
      frame: trim,
      frameSlot: 'wood',
      frameWidth: 0.063,
      frameDepth: 0.073,
      mullions: level > 1 ? 2 : 1,
      transoms: level > 2 ? 5 : 1,
      mullionColor: trim,
    });
    fbox(
      out,
      'masonry',
      face,
      x - width / 2 - 0.09,
      x + width / 2 + 0.09,
      base - 0.07,
      base,
      0.01,
      0.15,
      stone,
    );
  } else {
    const p = (u, y) => face.P(x + u, base + y, 0.04);
    const w = width / 2;
    quad4(out, 'glass', p(-w, 0), p(w, 0), p(w, height), p(-w, height), glass);
  }
  if (!hasShutters || level === 0) return;
  for (const side of [-1, 1]) {
    const a = x + side * (width / 2 + 0.07);
    const b = a + side * 0.32;
    fbox(
      out,
      'wood',
      face,
      Math.min(a, b),
      Math.max(a, b),
      base + 0.035,
      base + height - 0.015,
      0.016,
      0.059,
      shutters,
    );
  }
}

function doorway(out, face, x, base, level, glazed) {
  fbox(out, 'wood', face, x - 0.48, x + 0.48, base, base + 2.14, 0.012, 0.051, door);
  if (level === 0) return;
  for (const u of [x - 0.49, x + 0.49]) {
    fbox(out, 'wood', face, u - 0.07, u + 0.07, base, base + 2.22, 0, 0.1, trim);
  }
  fbox(out, 'wood', face, x - 0.56, x + 0.56, base + 2.13, base + 2.23, 0, 0.1, trim);
  if (glazed && level > 1)
    opening(out, face, x, base + 1.11, 0.65, 0.85, {
      glass,
      frame: trim,
      frameSlot: 'wood',
      frameWidth: 0.038,
      frameDepth: 0.07,
      mullions: 2,
      transoms: 2,
      mullionColor: trim,
    });
}

function walls(out, level) {
  abox(out, 'masonry', [-half, slab, north], [half, eave, south], stone);
  abox(out, 'foundation', [-half, -3.1, north], [half, slab, south], foundation);
  abox(
    out,
    'foundation',
    [-half + 0.24, -4.2, north + 0.19],
    [half - 0.08, -2.9, south - 0.1],
    foundation,
  );
  for (const face of [northFace, southFace]) {
    for (const x of [-12.8, -9.32, -5.02, -1.91, 1.98, 5.16, 9.58, 13.04]) {
      windowUnit(out, face, x, 1.37, 1.02, 1.85, level, true);
    }
    for (const x of [-7.16, 7.41]) doorway(out, face, x, slab, level, face === southFace);
  }
  if (level > 0) {
    for (const x of [-10.14, -4.87, 5.58, 8.37]) {
      windowUnit(out, southFace, x, -2.25, 0.86, 1.59, level, false);
    }
    for (const x of [-13.09, -1.67, 2.51, 12.41]) doorway(out, southFace, x, -2.35, level, true);
  }
  for (const x of [-7.41, 7.16]) {
    const width = x > 0 ? 0.72 : 0.68;
    for (let i = 0; i < 2; i++) {
      const rear = north - 0.37 + 0.23 * i;
      abox(
        out,
        'foundation',
        [x - width, 0.01, rear - 0.24],
        [x + width, 0.14 * (i + 1), north],
        foundation,
      );
    }
  }
}

function mainRoof(out) {
  const left = -half - 0.24;
  const right = half + 0.24;
  const z0 = north - 0.28;
  const z1 = south + 0.16;
  const middle = (north + south) / 2;
  const west = [left + 4.8, ridge, middle];
  const east = [right - 4.8, ridge, middle];
  const nw = [left, eave, z0];
  const ne = [right, eave, z0];
  const se = [right, eave, z1];
  const sw = [left, eave, z1];
  quad4(out, 'roofing', sw, se, east, west, roof);
  tri(out, 'roofing', se, ne, east, roof);
  quad4(out, 'roofing', ne, nw, west, east, roof);
  tri(out, 'roofing', nw, sw, west, roof);
  abox(out, 'wood', [left, eave - 0.15, z0 + 0.018], [right, eave + 0.022, z0 + 0.175], trim);
  beam(out, 'roofing', west, east, 0.11, 0.1, roof);
}

function chimneys(out, level) {
  const z = (north + south) / 2;
  for (const [x, bottom, height, width, depth] of [
    [-15.04, 3.79, 9.98, 1.2, 2.38],
    [0.16, 6.42, 9.05, 1.55, 1.61],
    [15.04, 3.79, 9.85, 1.2, 2.38],
  ]) {
    abox(
      out,
      'masonry',
      [x - width / 2, bottom, z - depth / 2],
      [x + width / 2, height, z + depth / 2],
      stone,
    );
    for (const y of [height - 0.34, height - 1.86]) {
      abox(
        out,
        'masonry',
        [x - width / 2 - 0.08, y, z - depth / 2 - 0.08],
        [x + width / 2 + 0.08, y + 0.11, z + depth / 2 + 0.08],
        trim,
      );
    }
    const pots = x === 0.16 ? 2 : 3;
    for (let i = 0; i < pots; i++) {
      const pz = z + ((i + 0.5) / pots - 0.5) * depth;
      if (level < 2) {
        abox(
          out,
          'masonry',
          [x - 0.27, height, pz - 0.2],
          [x + 0.27, height + 0.76, pz + 0.2],
          foundation,
        );
        continue;
      }
      const arch = pointedArch(0.24, 0.35, level === 3 ? 5 : 3);
      for (const side of [-1, 1]) {
        abox(
          out,
          'masonry',
          [x - 0.31, height, pz + side * 0.24 - 0.045],
          [x + 0.31, height + 0.41, pz + side * 0.24 + 0.045],
          foundation,
        );
      }
      for (let j = 1; j < arch.length; j++) {
        const [a, y] = arch[j - 1];
        const [b, yy] = arch[j];
        beam(
          out,
          'masonry',
          [x, height + 0.4 + y, pz + a],
          [x, height + 0.4 + yy, pz + b],
          0.62,
          0.085,
          foundation,
        );
      }
    }
  }
}

function gallery(out, level) {
  const left = -half - 0.07;
  const right = half + 0.07;
  const roofEdge = edge + 0.22;
  const shedEaves = plan.dimensions.shedEavesM;
  quad4(
    out,
    'roofing',
    [left, shedEaves, roofEdge],
    [right, shedEaves, roofEdge],
    [right, eave, south],
    [left, eave, south],
    roof,
  );
  abox(
    out,
    'wood',
    [left, shedEaves - 0.17, roofEdge - 0.15],
    [right, shedEaves + 0.018, roofEdge + 0.02],
    trim,
  );
  abox(out, 'wood', [left, slab - 0.19, south - 0.05], [right, slab, edge + 0.11], trim);
  for (const x of [left + 0.48, right - 0.48]) {
    abox(out, 'gallery', [x - 0.48, slab, south], [x + 0.48, shedEaves - 0.075, edge - 0.05], trim);
  }
  const z = edge - 0.09;
  const columns = Array.from({ length: 10 }, (_, i) => -14.61 + i * 3.23);
  for (const x of columns) {
    abox(out, 'wood', [x - 0.079, slab, z - 0.079], [x + 0.079, shedEaves - 0.08, z + 0.079], trim);
    if (level > 0) {
      abox(out, 'wood', [x - 0.094, -2.37, z - 0.093], [x + 0.094, slab - 0.19, z + 0.093], trim);
    }
  }
  for (const y of [slab + 0.18, slab + 0.98]) {
    abox(out, 'wood', [left + 0.85, y, z - 0.061], [right - 0.85, y + 0.079, z + 0.061], trim);
  }
  const railSpacing = [1.08, 0.62, 0.31, 0.19][level];
  const railing = facade([0, z], [1, 0]);
  for (let x = left + 0.91; x < right - 0.91; x += railSpacing) {
    fbox(out, 'wood', railing, x - 0.026, x + 0.026, slab + 0.22, slab + 0.98, -0.03, 0.03, trim);
  }
  const stairs = level === 0 ? 3 : 9;
  for (let i = 0; i < stairs; i++) {
    const x = left - 2.45 + i * (2.5 / stairs);
    abox(
      out,
      'wood',
      [x, -1.25, z - 1.05],
      [x + 2.52 / stairs, -1.08 + (1.36 * i) / (stairs - 1), z],
      trim,
    );
  }
  for (const stairZ of [z - 1.04, z]) {
    beam(
      out,
      'wood',
      [left - 2.43, -0.28, stairZ],
      [left + 0.01, 1.21, stairZ],
      0.068,
      0.069,
      trim,
    );
    for (const [x, y] of [
      [left - 2.42, -1.08],
      [left - 1.25, -0.39],
      [left + 0.015, slab],
    ]) {
      abox(
        out,
        'wood',
        [x - 0.045, y, stairZ - 0.045],
        [x + 0.045, y + 0.89, stairZ + 0.045],
        trim,
      );
    }
  }
}

function build(out, level) {
  walls(out, level);
  mainRoof(out);
  chimneys(out, level);
  gallery(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-mackinac-officers-stone-quarters-model.mjs';
const camera = [31, 15, 43];
const lookAt = [0, 2.3, 1.0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The original Officers’ Stone Quarters with its three chimney stacks and timber gallery above Mackinac Harbor.',
  camera,
  lookAt,
  sunDirection: [30, 58, 50],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native outline enclosing the limestone block and its south gallery.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'tile_flat', 'siding_lap', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'parade-ground-elevation', position: [-12, 6.5, -31], lookAt: [0, 3.1, -5.1] },
    { name: 'harbor-side-gallery-and-sash', position: [10, 3.75, 22], lookAt: [2.1, 2.3, 5.7] },
    { name: 'hip-roof-and-limestone-stacks', position: [15, 15.5, 21], lookAt: [4, 6.8, -0.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'officers-stone-quarters-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.1, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.038, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap footprint under ODbL, and Mapzen terrain under source attribution.',
};
