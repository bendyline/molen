/** The April 2011 broadcast-era Nagoya TV Tower in Hisaya-odori Park. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const { section } = plan;
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.25 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.12 },
};
const colors = {
  steel: [0.65, 0.7, 0.72],
  pale: [0.87, 0.9, 0.89],
  darkSteel: [0.42, 0.47, 0.49],
  concrete: [0.71, 0.69, 0.64],
  shadedConcrete: [0.58, 0.57, 0.53],
  glass: [0.33, 0.46, 0.49],
  darkGlass: [0.24, 0.34, 0.36],
};
const cornerSigns = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const square = (y, half) => cornerSigns.map(([x, z]) => [half * x, y, half * z]);
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const wrap = (i, ring) => (i + 1) % ring.length;
const deckRing = (y, width, chamfer) => chamferedRectangle(0, y, 0, width, width, chamfer);
const ringRails = (out, ring, radius, color, level) => {
  for (let i = 0; i < ring.length; i++) {
    tube(out, 'steel', ring[i], ring[wrap(i, ring)], radius, color, level >= 2 ? 4 : 3);
  }
};

function bracedBays(out, profile, level, bracing) {
  const rings = profile.map(([y, half]) => square(y, half));
  for (let j = 0; j < 4; j++) {
    loft(out, 'steel', rings.map((ring, i) => {
      const [x, y, z] = ring[j];
      const half = profile[i][2] / 2;
      return cornerSigns.toReversed().map(([dx, dz]) => [x + dx * half, y, z + dz * half]);
    }), colors.steel);
  }
  for (let i = 1; i < rings.length; i++) {
    const lower = rings[i - 1], upper = rings[i];
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      if (level > 0) tube(out, 'steel', upper[j], upper[k], bracing * 0.72, colors.darkSteel, 3);
      tube(out, 'steel', lower[j], upper[k], bracing, colors.steel, level >= 2 ? 4 : 3);
      if (level > 0) tube(out, 'steel', lower[k], upper[j], bracing, colors.steel, level >= 2 ? 4 : 3);
    }
  }
}

function groundAndLegs(out, level) {
  for (const { xz: [x, z], sourceGroundY } of plan.footings) {
    box(out, 'concrete', [x - 1.37, sourceGroundY - 0.38, z - 1.37],
      [x + 1.37, 0.72, z + 1.37], colors.concrete);
    if (level >= 2) {
      box(out, 'steel', [x - 0.56, 0.71, z - 0.56], [x + 0.56, 0.87, z + 0.56], colors.darkSteel);
    }
  }
  const archNodes = level === 0 ? 4 : level === 1 ? 8 : 16;
  for (const sign of [-1, 1]) {
    const points = Array.from({ length: archNodes + 1 }, (_, i) => {
      const t = i / archNodes;
      const x = 35 * (t - 0.5);
      return [x, 0.6 + 60 * t * (1 - t), sign * x];
    });
    beamPath(out, 'concrete', points, 1.38, 1.08, colors.shadedConcrete);
  }
  const profile = [
    [0.71, 17.5, 0.7], [15, 15.35, 0.68], [26, 13.54, 0.65],
    [39, 11.74, 0.57], [53, 10.1, 0.53], [68, 8.56, 0.49],
    [79, 7.57, 0.46], [90, 6.64, 0.45],
  ];
  const controlBays = level === 0 ? [profile[0], profile[2], profile[4], profile[5], profile[7]] : profile;
  bracedBays(out, controlBays, level, 0.22);
}

function glazedFacets(out, ring, top, level, options) {
  const { spacing, rail, glass } = options;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[wrap(i, ring)];
    const [at, bt] = top === null ? [a, b].map(([x, y, z]) => [x, y + options.height, z])
      : [top[i], top[wrap(i, ring)]];
    face(out, 'glass', [a, b, bt, at], i % 3 === 0 ? colors.darkGlass : glass);
    if (level === 0) continue;
    const divisions = level === 1 ? 2 : Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / spacing));
    for (let j = 0; j < divisions; j++) {
      const t = j / divisions;
      beam(out, 'steel', blend(a, b, t), blend(at, bt, t), rail, rail, colors.pale);
    }
    if (level >= 2) {
      beam(out, 'steel', blend(a, at, 0.72), blend(b, bt, 0.72), rail * 0.7, rail * 0.7, colors.pale);
    }
  }
}

function lowerBuilding(out, level) {
  const floor = (y) => deckRing(y, 25.2, 1.4);
  loft(out, 'concrete', [floor(section.lowerFloor - 0.55), floor(section.lowerFloor + 0.12)], colors.concrete);
  glazedFacets(out, floor(15.12), null, level, { height: 10.88, spacing: 2.2, rail: 0.17, glass: colors.darkGlass });
  for (const y of level === 0 ? [25.8] : [18.5, 22.2, 25.8]) {
    loft(out, 'concrete', [floor(y), floor(y + 0.44)], colors.concrete);
  }
  box(out, 'concrete', [-2.05, -0.42, -2.05], [2.05, 15.22, 2.05], colors.shadedConcrete);
  box(out, 'glass', [-1.68, 0.1, 2.03], [1.68, 3.55, 2.13], colors.darkGlass);
  if (level === 0) return;
  const shaft = [[26, 1.85, 0.18], [39, 1.85, 0.18], [53, 1.85, 0.17],
    [68, 1.85, 0.17], [79, 1.85, 0.17], [89.2, 1.85, 0.17]];
  bracedBays(out, shaft, level, 0.075);
}

function observationDecks(out, level) {
  const lower = (y, width) => deckRing(y, width, 3.15);
  loft(out, 'steel', [lower(87.4, 14.8), lower(89.73, 18.1)], colors.darkSteel);
  loft(out, 'steel', [lower(89.73, 18.1), lower(90.15, 18.1)], colors.pale);
  glazedFacets(out, lower(90.15, 18.02), lower(95.25, 17.3), level,
    { spacing: 1.24, rail: 0.16, glass: colors.glass });
  loft(out, 'steel', [lower(95.25, 17.35), lower(95.68, 17.35), lower(97.5, 13.3)], colors.pale);
  if (level >= 2) {
    const rim = lower(88.98, 17.15);
    for (let i = 0; i < rim.length; i++) {
      const edge = rim[wrap(i, rim)];
      for (const t of [0, 0.33, 0.66]) {
        beam(out, 'steel', [0, 87.4, 0], blend(rim[i], edge, t), 0.15, 0.23, colors.steel);
      }
    }
  }
  const balcony = (y, w) => deckRing(y, w, 2.8);
  loft(out, 'steel', [balcony(97.5, 10.8), balcony(section.outdoorBalcony, 13.15)], colors.darkSteel);
  const sill = balcony(100.03, 13.04), rim = balcony(102.68, 11.75);
  if (level >= 2) ringRails(out, sill, 0.085, colors.pale, level);
  ringRails(out, rim, 0.09, colors.pale, level);
  for (let i = 0; i < sill.length; i++) {
    const j = wrap(i, sill);
    const divisions = [1, 2, 7, 13][level];
    for (let n = 0; n < divisions; n++) {
      const t = n / divisions;
      tube(out, 'steel', blend(sill[i], sill[j], t), blend(rim[i], rim[j], t),
        level >= 2 ? 0.036 : 0.08, colors.pale, 3);
    }
  }
}

function antennaArrays(out, level) {
  const towerHead = [[97.5, 4.9, 0.43], [108, 3.55, 0.36], [121.5, 2.28, 0.29], [section.antennaBase, 1.68, 0.24]];
  bracedBays(out, level === 0 ? [towerHead[0], towerHead[1], towerHead[3]] : towerHead, level, 0.15);
  if (level > 0) box(out, 'steel', [-1.45, 109.1, -1.45], [1.45, 112.3, 1.45], colors.darkSteel);
  const mast = [[section.antennaBase, 1.1, 0.19], [145, 0.91, 0.18], [156.8, 0.7, 0.16], [164.4, 0.37, 0.13]];
  if (level === 0) {
    tube(out, 'steel', [0, 135, 0], [0, 164.4, 0], 0.68, colors.steel, 3);
  } else {
    bracedBays(out, mast, level, 0.085);
  }
  tube(out, 'steel', [0, 164.4, 0], [0, 173.2, 0], 0.185, colors.pale, 4);
  tube(out, 'steel', [0, 173.2, 0], [0, section.tip, 0], 0.09, colors.pale, 3);
  const mount = (side, distance, y, width) =>
    side % 2 === 0 ? [width, y, side === 0 ? distance : -distance]
      : [side === 1 ? distance : -distance, y, width];
  for (let side = 0; side < 4; side++) {
    const y0 = side % 2 === 0 ? 137.3 : 134.65;
    const y1 = side % 2 === 0 ? 153.2 : 149.1;
    const distance = side % 2 === 0 ? 2.54 : 2.2;
    if (level === 0) {
      const [x, , z] = mount(side, distance, y0, 0);
      const rx = side % 2 === 0 ? 0.64 : 0.09, rz = side % 2 === 0 ? 0.09 : 0.64;
      box(out, 'steel', [x - rx, y0, z - rz], [x + rx, y1, z + rz], colors.pale);
      continue;
    }
    for (const w of [-0.71, 0.71]) {
      beam(out, 'steel', mount(side, distance, y0, w), mount(side, distance, y1, w), 0.11, 0.15, colors.pale);
    }
    const rows = [0, 4, 8, 12][level];
    for (let i = 0; i <= rows; i++) {
      const y = y0 + ((y1 - y0) * i) / rows;
      tube(out, 'steel', mount(side, distance, y, -0.72), mount(side, distance, y, 0.72), 0.08, colors.pale, 3);
      if (level >= 2 && i % 2 === 0) {
        tube(out, 'steel', mount(side, distance * 0.45, y, 0), mount(side, distance, y, 0), 0.08, colors.darkSteel, 3);
      }
    }
  }
  if (level < 2) return;
  for (let side = 0; side < 4; side++) {
    const y = side % 2 === 0 ? 109.4 : 116.8;
    const at = mount(side, 5.05, y, 0);
    beam(out, 'steel', mount(side, 2.7, y - 0.32, 0), at, 0.33, 0.36, colors.darkSteel);
    tube(out, 'steel', at, mount(side, 5.28, y, 0), 0.7, colors.pale, level === 3 ? 10 : 6);
  }
}

function build(out, level) {
  groundAndLegs(out, level);
  lowerBuilding(out, level);
  observationDecks(out, level);
  antennaArrays(out, level);
}

export const towerSkyline = (out) => build(out, 0);
export const towerDistrict = (out) => build(out, 1);
export const towerStreet = (out) => build(out, 2);
export const towerCloseup = (out) => build(out, 3);
const recipe = 'nagoya-tv-tower-model.mjs';
const camera = [110, 74, 220], lookAt = [0, 86, 0];
const authoredLevels = Object.fromEntries([
  ['district', 'towerDistrict', 0.75],
  ['street', 'towerStreet', 0.28],
  ['closeup', 'towerCloseup', 0.07],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const towerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: towerCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Silver lattice broadcast tower with four splayed legs, suspended glazed floors and paired observation decks in central Nagoya.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.92,
    basis: 'Named OpenStreetMap Nagoya TV Tower outline, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 1.6,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    { name: 'plaza-and-suspended-floors', position: [38, 8, 56], lookAt: [0, 19, 0] },
    { name: 'observation-deck-and-balcony', position: [32, 88, 44], lookAt: [0, 96, 0] },
    { name: 'lattice-mast-and-antenna-arrays', position: [35, 135, 60], lookAt: [0, 147, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-nagoya-tv-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'towerSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Two exact CC0 Qualla exterior photographs. Ground elevations from Geospatial Information Authority of Japan.',
};
