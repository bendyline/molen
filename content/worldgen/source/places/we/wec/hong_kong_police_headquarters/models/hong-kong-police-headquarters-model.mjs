import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  closed,
  edge,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const dimensions = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  stone: 'b4b5af',
  lightStone: 'c2c7c0',
  framing: 'bcc4c3',
  shadow: '617174',
  glass: '587884',
  glassPale: '77939a',
  glassDark: '466471',
  glassCool: '67858e',
  roof: '737e7e',
  trim: '929d9c',
  screen: '4d6266',
});
const surfaces = {
  stone: surface('foundation', 'stone_granite', 0.89),
  cladding: surface('trim', 'metal_painted', 0.75, 0.24),
  roof: surface('roof', 'membrane', 0.92),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.28, metallic: 0.15 },
};
const [high, low] = dimensions.polygons;
const walled = (out, path, base, top, slot, color) =>
  shell(out, path, base, top, { wall: slot, roof: 'roof', color, roofColor: colors.roof });

function elevations(out, path, base, highest, level, floors, shortBlock) {
  const sign = areaSign(path);
  for (const [a, b] of pairs(closed(path))) {
    const wall = edge(a, b, sign);
    const width = wall.length;
    const harbor = wall.normal[2] < -0.55;
    const sideGlass = Math.abs(wall.normal[0]) > 0.6;
    if (width < 1.45) continue;
    const glassFacade = harbor || sideGlass || shortBlock;
    const top = highest - (shortBlock ? 1.43 : 2.75);
    const first = base + 0.7;
    const end = width - 0.12;
    if (glassFacade) {
      const narrow = width > 9 ? [0.4, end - 0.35] : [0.11, end];
      panel(
        out,
        'glass',
        wall,
        ...narrow,
        first,
        top,
        0.028,
        harbor ? colors.glass : colors.glassPale,
      );
      if (width > 9) {
        panel(out, 'cladding', wall, narrow[0], narrow[0] + 0.18, first, top, 0.12, colors.framing);
        panel(out, 'cladding', wall, narrow[1] - 0.18, narrow[1], first, top, 0.12, colors.framing);
      }
      const mullions = Math.max(1, Math.floor(width / [8.5, 4.5, 2.4, 1.6][level]));
      for (let i = 1; i < mullions; i++) {
        const u = (width * i) / mullions;
        if (harbor && level > 1) {
          trimBlock(
            out,
            'cladding',
            wall,
            u - 0.046,
            u + 0.046,
            first,
            top,
            0.031,
            0.28,
            colors.trim,
          );
        } else {
          panel(out, 'cladding', wall, u - 0.038, u + 0.038, first, top, 0.078, colors.trim);
        }
      }
    }
    const rowCount = [Math.ceil(floors / 4), Math.ceil(floors / 2), floors, floors][level];
    const rowHeight = (top - first) / rowCount;
    for (let row = 0; row < rowCount; row++) {
      const y = first + rowHeight * row;
      if (glassFacade) {
        const dark = row > 0 && row % (shortBlock ? 5 : 7) === 0;
        const height = dark ? Math.min(0.78, rowHeight * 0.26) : 0.13;
        panel(
          out,
          dark ? 'glass' : 'cladding',
          wall,
          0.11,
          end,
          y,
          y + height,
          0.093,
          dark ? colors.glassDark : colors.trim,
        );
      } else {
        const half = level === 3 && width > 10 ? 2 : 1;
        for (let i = 0; i < half; i++) {
          const start = (width * i) / half + 0.22;
          const finish = (width * (i + 1)) / half - 0.2;
          panel(
            out,
            'glass',
            wall,
            start,
            finish,
            y + rowHeight * 0.17,
            y + rowHeight * 0.59,
            0.035,
            row % 5 === 3 ? colors.glassCool : colors.glassDark,
          );
        }
      }
    }
  }
}

function stonePedestal(out, path, top, level) {
  const foundation = (point) => Math.min(top - 0.6, grade(point) - 0.42);
  walled(out, path, foundation, top, 'stone', colors.stone);
  const sign = areaSign(path);
  for (const [a, b] of pairs(closed(path))) {
    const wall = edge(a, b, sign);
    if (wall.length < 3.2) continue;
    const bottom = Math.max(grade(a), grade(b)) + 0.7;
    if (bottom >= top - 1.2) continue;
    const n = Math.max(1, Math.floor(wall.length / [12, 5, 4.1, 3.55][level]));
    const bay = wall.length / n;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.17) * bay,
        v = (i + 0.83) * bay;
      panel(out, 'glass', wall, u, v, bottom, top - 1.1, 0.067, colors.shadow);
      if (level > 1) panel(out, 'cladding', wall, u, v, top - 1.46, top - 1.19, 0.11, colors.trim);
    }
    panel(
      out,
      'stone',
      wall,
      0.06,
      wall.length - 0.06,
      top - 0.38,
      top - 0.08,
      0.12,
      colors.lightStone,
    );
  }
}

function roofCaps(out, level) {
  const shoulder = dimensions.upperShoulderHeight;
  const roof = dimensions.highBlockHeight;
  // The upper enclosure follows the office block. Its dimensions are estimated.
  const crown = rect(-19, -17, 13, 16);
  walled(out, crown, () => shoulder - 0.04, roof - 1.1, 'cladding', colors.framing);
  walled(out, rect(-19.35, -17.35, 13.35, 16.35), () => roof - 1.1, roof, 'cladding', colors.trim);
  const sign = areaSign(crown);
  for (const [a, b] of pairs(closed(crown))) {
    const wall = edge(a, b, sign);
    for (const centre of [0.27, 0.54, 0.75]) {
      const left = wall.length * centre - 1.7,
        right = left + 3.4;
      panel(out, 'glass', wall, left, right, shoulder + 3.2, roof - 4.0, 0.04, colors.screen);
      if (level < 2) continue;
      for (let j = 1; j <= 4; j++) {
        const y = mix(shoulder + 3.2, roof - 4.0, j / 5);
        panel(out, 'cladding', wall, left, right, y - 0.035, y + 0.035, 0.084, colors.trim);
      }
    }
  }
  const lowRoof = dimensions.lowBlockHeight;
  block(out, 'cladding', 42.5, lowRoof - 0.05, -10.0, 13, 2.35, 18, colors.framing);
}

function build(out, level) {
  const highBase = dimensions.mainPedestalHeight;
  const lowBase = dimensions.lowPedestalHeight;
  const shoulder = dimensions.upperShoulderHeight;
  const lowRoof = dimensions.lowBlockHeight;
  stonePedestal(out, high, highBase, level);
  stonePedestal(out, low, lowBase, level);
  walled(out, high, () => highBase - 0.03, shoulder, 'cladding', colors.framing);
  walled(out, low, () => lowBase - 0.03, lowRoof, 'cladding', colors.trim);
  elevations(out, high, highBase, shoulder, level, dimensions.highBlockFloors, false);
  elevations(out, low, lowBase, lowRoof, level, 9, true);
  roofCaps(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hong-kong-police-headquarters-model.mjs';
const camera = [294, 228, -330],
  lookAt = [20, 95, 0];
const errors = { district: 1.2, street: 0.46, closeup: 0.12 };
export const hongKongPoliceHeadquartersAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original Hong Kong Lands Department 5 m bare-earth elevation near the mapped north footprint.',
  brief:
    'Arsenal House in Wan Chai with its 206-metre High Block, stone base, alternating metal and glass elevations and attached Low Block.',
  camera,
  lookAt,
  sunDirection: [20, 82, -55],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: high,
    outlines: dimensions.polygons,
    minimumCoverage: 0.92,
    basis: 'Two named adjoining OSM building envelopes.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'harbour-curtain-wall', position: [-76, 159, -155], lookAt: [0, 120, -9] },
    { name: 'street-facing-strip-windows', position: [-52, 88, 146], lookAt: [0, 102, 12] },
    { name: 'stone-pedestal-and-low-block', position: [104, 53, -110], lookAt: [37, 21, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hong-kong-police-headquarters-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.3,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Elevation by Hong Kong Lands Department.',
};
