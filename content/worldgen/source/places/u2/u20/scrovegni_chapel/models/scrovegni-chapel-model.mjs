import { readFileSync } from 'node:fs';
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

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const controls = read('native-map/scrovegni-standing-chapel-controls');
const { west, east, north, south } = controls.naveBounds;
const { eave, ridge, apseEave, sacristyEave, belfryEave, belfryRidge, belfryCross } =
  controls.designHeightsM;
const center = (north + south) / 2;
const width = south - north;
const foundationDepth = -1.74;

const brick = rgb('ad765b');
const shadedBrick = rgb('9e634e');
const brickRelief = rgb('9c604a');
const lintel = rgb('a36650');
const mortar = rgb('9e917f');
const tufa = rgb('d2c1a1');
const roofTile = rgb('986451');
const ridgeTile = rgb('ad7258');
const darkOak = rgb('564a3d');
const glazing = rgb('494841');
const shadow = rgb('665442');
const iron = rgb('4d473e');

const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.92 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.42 },
};

function archBand(out, f, u, spring, r, thickness, depth, count, material, color, accent) {
  function point(radius, i) {
    const a = (i / count) * Math.PI;
    return f.P(u + radius * Math.cos(a), spring + radius * Math.sin(a), depth);
  }
  for (let i = 0; i < count; i++) {
    quad4(
      out,
      material,
      point(r, i),
      point(r + thickness, i),
      point(r + thickness, i + 1),
      point(r, i + 1),
      accent && i % 2 ? accent : color,
    );
  }
}

function westElevation(out, level) {
  const f = facade([west, center], [0, 1]);
  const portal = facade([west - 0.24, center], [0, 1]);
  fbox(out, 'brick', f, -1.53, 1.53, 0.02, 4.12, -0.01, 0.24, brickRelief);
  fbox(out, 'wood', portal, -1.06, 1.06, 0.14, 2.61, -0.01, 0.021, darkOak);
  fbox(out, 'stone', f, -1.48, 1.48, 0.01, 0.14, 0, 0.51, tufa);
  fbox(out, 'stone', f, -1.31, 1.31, 0.14, 0.24, 0, 0.42, tufa);
  archBand(
    out,
    portal,
    0,
    2.57,
    1.06,
    0.23,
    0.029,
    level > 1 ? 20 : 10,
    'brick',
    tufa,
    brickRelief,
  );
  for (const sign of [-1, 1]) {
    const u = 1.13 * sign;
    fbox(out, 'stone', portal, u - 0.065, u + 0.065, 0.22, 2.62, 0, 0.055, tufa);
  }

  const tracery = {
    head: 'round',
    glass: brickRelief,
    glassSlot: 'brick',
    frameSlot: 'stone',
    frame: tufa,
    frameWidth: 0.17,
    frameDepth: 0.098,
    d: 0.027,
    sill: false,
  };
  opening(out, f, 0, 7.15, 3.54, 4.48, tracery);
  for (const i of [-1, 0, 1]) {
    opening(out, f, i * 0.91, 7.43, i ? 0.7 : 0.83, i ? 2.55 : 3.28, {
      head: 'pointed',
      rise: i ? 0.57 : 0.67,
      glass: glazing,
      frame: tufa,
      frameSlot: 'stone',
      frameWidth: 0.088,
      frameDepth: 0.132,
      d: 0.052,
      sill: false,
    });
  }
  fbox(out, 'stone', f, -1.96, 1.96, 7.12, 7.28, 0, 0.18, tufa);
  if (level > 1) {
    for (const u of [-0.83, -0.63, -0.43, -0.23, 0, 0.23, 0.43, 0.63, 0.83]) {
      fbox(out, 'wood', portal, u - 0.014, u + 0.014, 0.22, 2.53, 0.021, 0.032, shadow);
    }
    archBand(out, portal, 0, 2.57, 1.33, 0.052, 0.036, 24, 'stone', tufa);
  }
  if (level !== 3) return;
  for (let i = 1; i < 15; i++) {
    const angle = (i / 15) * Math.PI;
    const u = Math.cos(angle) * 1.36;
    const y = 2.57 + Math.sin(angle) * 1.36;
    quad4(
      out,
      'stone',
      portal.P(u - 0.028, y, 0.043),
      portal.P(u, y - 0.028, 0.043),
      portal.P(u + 0.028, y, 0.043),
      portal.P(u, y + 0.028, 0.043),
      tufa,
    );
  }
}

function brickCornice(out, f, span, height, level) {
  fbox(out, 'brick', f, 0, span, height - 0.25, height, 0, 0.104, brickRelief);
  if (level === 0) return;
  const count = Math.round(span / (level > 1 ? 0.45 : 0.86));
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) / count) * span;
    const y = height - 0.4;
    const d = 0.107;
    quad4(
      out,
      'brick',
      f.P(u - 0.11, y, d),
      f.P(u, y - 0.12, d),
      f.P(u + 0.11, y, d),
      f.P(u, y + 0.12, d),
      lintel,
    );
  }
}

function longWalls(out, level) {
  const span = east - west;
  const sunny = facade([west, south], [1, 0]);
  const shady = facade([east, north], [-1, 0]);
  for (const f of [sunny, shady]) {
    brickCornice(out, f, span, eave - 0.17, level);
    if (level === 0) continue;
    for (let i = 0; i <= 6; i++) {
      const u = 0.13 + (i / 6) * (span - 0.26);
      fbox(out, 'brick', f, u - 0.12, u + 0.12, 0.09, eave - 0.48, -0.027, 0.093, shadedBrick);
    }
  }
  for (let i = 0; i < 6; i++) {
    const u = 2.1 + i * 3.29;
    opening(out, sunny, u, 3.64, 0.86, 5.37, {
      head: 'round',
      glass: glazing,
      frame: shadedBrick,
      frameSlot: 'brick',
      frameWidth: level ? 0.143 : 0,
      frameDepth: 0.13,
      sill: level > 0,
      d: 0.029,
    });
    if (level < 2) continue;
    for (const offset of [-0.18, 0.18]) {
      const x = u + offset;
      fbox(out, 'stone', sunny, x - 0.022, x + 0.022, 3.66, 8.55, 0.041, 0.071, tufa);
    }
    archBand(out, sunny, u, 8.57, 0.43, 0.105, 0.141, 12, 'brick', lintel);
    if (level === 3) {
      for (const y of [4.81, 6.17, 7.55])
        fbox(out, 'iron', sunny, u - 0.39, u + 0.39, y, y + 0.025, 0.041, 0.075, iron);
    }
  }
}

function polygonBlock(out, outline, height, crown, color, level) {
  extrude(out, 'footing', outline, foundationDepth, 0.11, mortar, { top: false });
  extrude(out, 'brick', outline, 0.11, height, color, { top: false });
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    tri(out, 'roof', [p[0], height, p[1]], [q[0], height, q[1]], crown, roofTile);
    if (level === 0) continue;
    const f = wallFace(p, q);
    brickCornice(out, f, f.length, height - 0.035, level);
  }
}

function apseAndBelfry(out, level) {
  polygonBlock(out, controls.apseOutline, apseEave, [4.5, 11.17, 1.9], shadedBrick, level);
  polygonBlock(out, controls.sacristyOutline, sacristyEave, [2.95, 5.64, -3.59], brick, level);
  const faces = [
    { f: facade([7.14, 1.96], [0, -1]), half: 1.42 },
    { f: facade([5.06, 3.38], [1, 0]), half: 2.08 },
    { f: facade([5.06, 0.54], [-1, 0]), half: 2.08 },
    { f: facade([2.98, 1.96], [0, 1]), half: 1.42 },
  ];
  abox(out, 'brick', [2.98, 10.1, 0.54], [7.14, belfryEave, 3.38], shadedBrick);
  gableRoof(out, 'roof', [2.98, 1.96], [7.14, 1.96], 2.84, belfryEave, belfryRidge, roofTile, {
    overhang: 0.19,
    endSlot: 'brick',
    endColor: shadedBrick,
  });
  for (const { f, half } of faces) {
    opening(out, f, 0, 12.05, half < 2 ? 1.28 : 1.51, 2.53, {
      head: 'round',
      glass: shadow,
      frame: brickRelief,
      frameSlot: 'brick',
      frameWidth: level ? 0.14 : 0,
      frameDepth: 0.11,
      d: 0.032,
      sill: false,
    });
    if (level === 0) continue;
    for (const sign of [-1, 1]) {
      const u = sign * (half - 0.26);
      fbox(
        out,
        'brick',
        f,
        u - 0.09,
        u + 0.09,
        11.92,
        belfryEave - 0.28,
        0.018,
        0.105,
        brickRelief,
      );
    }
    fbox(out, 'brick', f, -half, half, belfryEave - 0.32, belfryEave - 0.12, 0, 0.116, brickRelief);
  }
  abox(out, 'iron', [6.67, belfryRidge - 0.08, 1.928], [6.733, belfryCross, 1.992], iron);
  abox(out, 'iron', [6.67, belfryCross - 0.29, 1.74], [6.733, belfryCross - 0.24, 2.18], iron);
  if (level < 2) return;
  const sacristyWall = wallFace(controls.sacristyOutline[2], controls.sacristyOutline[1]);
  opening(out, sacristyWall, 2.77, 1.63, 0.71, 1.07, {
    head: 'round',
    glass: glazing,
    frame: shadedBrick,
    frameSlot: 'brick',
    frameWidth: 0.085,
    d: 0.03,
  });
}

function naveRoof(out, level) {
  gableRoof(out, 'roof', [west, center], [east, center], width, eave, ridge, roofTile, {
    overhang: 0.2,
    endSlot: 'brick',
    endColor: brick,
  });
  if (level === 0) return;
  abox(
    out,
    'roof',
    [west - 0.19, ridge - 0.048, center - 0.103],
    [east + 0.19, ridge + 0.057, center + 0.103],
    ridgeTile,
  );
  if (level < 2) return;
  const strip = 0.061;
  const repeat = level === 3 ? 0.31 : 0.75;
  for (let x = west + 0.13; x < east; x += repeat) {
    for (const sign of [-1, 1]) {
      const edgeZ = center + sign * (width / 2 + 0.17);
      const edgeY = eave - (0.17 * (ridge - eave)) / (width / 2) + 0.035;
      const lower = sign > 0 ? x : x + strip;
      const upper = sign > 0 ? x + strip : x;
      quad4(
        out,
        'roof',
        [lower, edgeY, edgeZ],
        [upper, edgeY, edgeZ],
        [upper, ridge + 0.03, center],
        [lower, ridge + 0.03, center],
        ridgeTile,
      );
    }
  }
}

function build(out, level) {
  abox(out, 'footing', [west, foundationDepth, north], [east, 0.11, south], mortar);
  abox(out, 'brick', [west, 0.11, north], [east, eave, south], brick);
  naveRoof(out, level);
  apseAndBelfry(out, level);
  westElevation(out, level);
  longWalls(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'scrovegni-chapel-model.mjs';
const camera = [-39, 14, 37];
const lookAt = [-6, 6.8, 0.7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'chapel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The standing medieval brick chapel and its west trifora, six-window south wall, polygonal apse, belfry and north sacristy.',
  camera,
  lookAt,
  sunDirection: [-30, 44, 38],
  mediumFiContext: {
    scale: 0.95,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native way 131997214 covers the chapel envelope and attached sacristy.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'arena-west-trifora-and-south-lancets', position: camera, lookAt },
    { name: 'polygonal-apse-and-belfry', position: [25, 12, 25], lookAt: [1, 7.3, 2.5] },
    { name: 'north-sacristy-and-plain-flank', position: [15, 12, -30], lookAt: [-2, 6.1, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'scrovegni-chapel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.35,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.49, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on a public-domain 1904 archival print, published architectural measurements, mapped footprint and open bare-earth elevation data.',
};
