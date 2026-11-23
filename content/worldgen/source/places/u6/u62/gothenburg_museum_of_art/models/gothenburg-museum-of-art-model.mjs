import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const tone = {
  brick: rgb('baa47a'),
  soffit: rgb('877555'),
  window: rgb('434d4b'),
  frame: rgb('77796b'),
  stone: rgb('a6a19a'),
  edge: rgb('b2aba0'),
  darkerStone: rgb('85817a'),
  metal: rgb('655f54'),
  relief: rgb('726854'),
  roof: rgb('646762'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.14 },
  relief: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.5 },
};
const x0 = -16.76;
const x1 = 42.54;
const center = 13.65;
const near = 18.5;
const court = 5.76;
const top = court + plan.dimensions.wallHeightAboveUpperTerraceM;
const roofZ = [-10.18, near + 0.71];
const outline = frame.geometry.outline;
const facadeFace = facade([0, near], [1, 0]);
const windows = Array.from({ length: 7 }, (_, i) => center + (i - 3) * 6.87);

function panel(out, slot, f, l, r, low, high, depth, color) {
  quad4(
    out,
    slot,
    f.P(l, low, depth),
    f.P(r, low, depth),
    f.P(r, high, depth),
    f.P(l, high, depth),
    color,
  );
}

function stoneLip(out, f, l, r, low, high, d, tint = tone.edge) {
  fbox(out, 'trim', f, l, r, low, high, -0.015, d, tint);
}

function plainDoor(out, f, x, low, width, height, level) {
  if (level < 2) {
    panel(out, 'glass', f, x - width / 2, x + width / 2, low, low + height, 0.053, tone.window);
    return;
  }
  opening(out, f, x, low, width, height, {
    glass: tone.window,
    frame: tone.frame,
    frameSlot: 'trim',
    frameWidth: 0.086,
    frameDepth: 0.118,
    d: 0.061,
    mullions: level === 3 ? 3 : 1,
    transoms: level === 3 ? 2 : 1,
    mullionColor: tone.frame,
  });
}

function gallery(out, level) {
  extrude(out, 'stone', outline, -1.45, court, tone.stone, { top: false });
  const wallEnd = near - 2.23;
  const upper = [
    [x0, wallEnd],
    [-14.5, wallEnd],
    [-14.5, -9.8],
    [39.2, -9.8],
    [39.2, 3.24],
    [x1, 3.24],
    [x1, wallEnd],
  ];
  extrude(out, 'brick', upper, court, top, tone.brick, { top: false });
  abox(out, 'brick', [x0, court, wallEnd], [x0 + 3.07, top, near], tone.brick);
  abox(out, 'brick', [x1 - 3.07, court, wallEnd], [x1, top, near], tone.brick);
  const edges = [
    facade([x0, 0], [0, 1]),
    facade([x1, 0], [0, -1]),
    facade([center, -9.8], [-1, 0]),
  ];
  for (const [i, f] of edges.entries()) {
    const positions =
      i === 2
        ? [-19, -11, -4, 5, 12, 19]
        : [(i === 0 ? 1 : -1) * 3.9, (i === 0 ? 1 : -1) * 8.1, (i === 0 ? 1 : -1) * 12.2];
    for (const x of positions) {
      plainDoor(out, f, x, court + 3.72, 0.96, 1.35, level);
      if (level > 0) plainDoor(out, f, x, court + 11.86, 0.96, 1.41, level);
    }
  }
}

function arcade(out, level) {
  const f = facadeFace;
  const width = plan.dimensions.archWidthM;
  const r = width / 2;
  const archTop = court + plan.dimensions.archHeightM;
  const spring = archTop - r;
  const recess = 2.23;
  const curve = roundArch(r, level === 0 ? 6 : level === 1 ? 9 : 16);
  const back = facade([0, near - recess + 0.021], [1, 0]);
  let edge = x0;
  for (const x of windows) {
    const left = x - r,
      right = x + r;
    const bottom = court + 0.55;
    panel(out, 'brick', f, edge, left, court, top, 0.003, tone.brick);
    panel(out, 'brick', f, left, right, court, bottom, 0.003, tone.brick);
    const infillTop = archTop + 0.008;
    for (let j = 1; j < curve.length; j++) {
      const [p0, h0] = curve[j - 1],
        [p1, h1] = curve[j];
      const a = x + p0,
        b = x + p1,
        y = spring + h0,
        h = spring + h1;
      quad4(
        out,
        'brick',
        f.P(a, y, 0.004),
        f.P(b, h, 0.004),
        f.P(b, top, 0.004),
        f.P(a, top, 0.004),
        tone.brick,
      );
      quad4(
        out,
        'brick',
        f.P(a, y, -recess),
        f.P(b, h, -recess),
        f.P(b, h),
        f.P(a, y),
        tone.soffit,
      );
      if (level > 1 && Math.min(y, h) < infillTop) {
        beam(
          out,
          'brick',
          f.P(a, y + 0.077, 0.031),
          f.P(b, h + 0.077, 0.031),
          0.1,
          0.148,
          tone.brick,
        );
      }
    }
    quad4(
      out,
      'brick',
      f.P(left, bottom),
      f.P(left, bottom, -recess),
      f.P(left, spring, -recess),
      f.P(left, spring),
      tone.soffit,
    );
    quad4(
      out,
      'brick',
      f.P(right, bottom, -recess),
      f.P(right, bottom),
      f.P(right, spring),
      f.P(right, spring, -recess),
      tone.soffit,
    );
    const faceDepth = 0.037;
    panel(out, 'brick', back, left, right, bottom, archTop, faceDepth, tone.soffit);
    plainDoor(out, back, x, bottom + 0.08, 1.41, 3.27, level);
    plainDoor(out, back, x, spring - 0.76, 1.63, 1.7, level);
    if (level > 0) {
      stoneLip(out, f, left - 0.12, right + 0.12, court + 0.02, bottom + 0.12, 0.262);
      medal(out, f, x, archTop + 1.765, level);
    }
    edge = right;
  }
  panel(out, 'brick', f, edge, x1, court, top, 0.003, tone.brick);
  panel(out, 'brick', f, x0, x1, top - 0.78, top + 0.02, 0.039, tone.brick);
  stoneLip(out, f, x0 - 0.14, x1 + 0.14, top - 0.43, top - 0.28, 0.24, tone.darkerStone);
  stoneLip(out, f, x0 - 0.24, x1 + 0.25, top - 0.28, top + 0.06, 0.46);
  if (level > 0)
    for (const x of [x0 + 4.74, x1 - 4.73]) {
      plainDoor(out, f, x, court + 2.49, 0.62, 0.76, level);
      plainDoor(out, f, x, court + 6.46, 0.94, 1.16, level);
      plainDoor(out, f, x, court + 11.38, 0.82, 1.14, level);
    }
}

function medal(out, f, x, y, level) {
  const ring = (r, d) =>
    Array.from({ length: level === 1 ? 8 : 14 }, (_, i) => {
      const a = (i * 2 * Math.PI) / (level === 1 ? 8 : 14);
      return f.P(x + r * Math.cos(a), y + r * Math.sin(a), d);
    });
  fan(out, 'trim', ring(0.93, 0.084), tone.darkerStone);
  fan(out, 'relief', ring(0.78, 0.101), tone.relief);
  if (level > 1) {
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * Math.PI) / 5;
      const edge = f.P(x + 0.47 * Math.cos(a), y + 0.47 * Math.sin(a), 0.109);
      beam(out, 'trim', f.P(x, y, 0.108), edge, 0.057, 0.079, tone.edge);
    }
  }
}

function stairs(out, level) {
  const l = x0 + 1.13,
    r = x1 - 1.07;
  abox(out, 'stone', [l, 0.05, 18.26], [r, court, 21.78], tone.stone);
  abox(out, 'trim', [l - 0.18, court - 0.24, 17.98], [r + 0.18, court + 0.041, 22.35], tone.edge);
  for (const [a, b] of [
    [l, center - 11.32],
    [center + 11.32, r],
  ]) {
    abox(out, 'stone', [a, 0.05, 20.81], [b, 2.28, 27.31], tone.stone);
    abox(out, 'trim', [a - 0.12, 2.15, 22.35], [b + 0.12, 2.4, 27.51], tone.edge);
    abox(out, 'stone', [a, 0.06, 21.02], [b, 4.18, 24.71], tone.stone);
    abox(out, 'trim', [a - 0.14, 4.1, 21.58], [b + 0.14, 4.31, 24.89], tone.edge);
  }
  const count = [7, 12, 18, 24][level];
  for (let i = 0; i < count; i++) {
    const z = 34.2 - ((i + 1) * 12.45) / count;
    const y = 0.46 + ((i + 1) * 5.3) / count;
    abox(out, 'stone', [center - 11.32, 0.18, 18.82], [center + 11.32, y, z], tone.darkerStone);
  }
  if (level > 0)
    for (const x of [center - 11.6, center + 11.6]) {
      beam(out, 'trim', [x, 0.83, 33.5], [x, 6.23, 22.33], 0.32, 0.42, tone.edge);
      for (const [z, y] of [
        [33.53, 0.68],
        [27.87, 3.27],
        [22.32, 5.82],
      ]) {
        abox(
          out,
          'stone',
          [x - 0.46, y - 0.65, z - 0.31],
          [x + 0.46, y + 0.56, z + 0.31],
          tone.stone,
        );
      }
    }
}

function roof(out, level) {
  const [z0, z1] = roofZ;
  const base = top - 0.03;
  const peak = base + plan.dimensions.roofRiseM;
  const ridgeZ = (z0 + z1) / 2 - 0.15;
  const p = [x0 - 0.54, peak, ridgeZ],
    q = [x1 + 0.56, peak, ridgeZ];
  const a = [x0 - 0.54, base, z1],
    b = [x1 + 0.56, base, z1],
    c = [x1 + 0.56, base, z0],
    d = [x0 - 0.54, base, z0];
  quad4(out, 'roof', a, b, q, p, tone.roof);
  quad4(out, 'roof', c, d, p, q, tone.roof);
  tri(out, 'brick', d, a, p, tone.brick);
  tri(out, 'brick', b, c, q, tone.brick);
  beam(out, 'roof', p, q, 0.17, 0.26, tone.metal);
  const skylightZ = 0.28;
  if (level > 0)
    for (const x of [-3.18, 9.4, 21.98, 34.58]) {
      const y = peak - 0.85;
      abox(
        out,
        'roof',
        [x - 2.79, y, skylightZ - 4.5],
        [x + 2.79, y + 0.33, skylightZ + 3.9],
        tone.roof,
      );
      const ridgePane = [x - 2.79, y + 1.32, skylightZ - 0.23];
      const ridgeMate = [x + 2.79, y + 1.32, skylightZ - 0.23];
      quad4(
        out,
        'glass',
        [x - 2.79, y + 0.3, skylightZ + 3.9],
        [x + 2.79, y + 0.3, skylightZ + 3.9],
        ridgeMate,
        ridgePane,
        tone.frame,
      );
      quad4(
        out,
        'glass',
        [x + 2.79, y + 0.3, skylightZ - 4.5],
        [x - 2.79, y + 0.3, skylightZ - 4.5],
        ridgePane,
        ridgeMate,
        tone.frame,
      );
      if (level > 1) beam(out, 'roof', ridgePane, ridgeMate, 0.1, 0.11, tone.metal);
    }
}

function build(out, level) {
  gallery(out, level);
  arcade(out, level);
  stairs(out, level);
  roof(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'gothenburg-museum-of-art-model.mjs';
const camera = [57, 27, 105],
  lookAt = [center, 10.6, 14];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Gothenburg’s original yellow-brick art museum, with seven monumental arches above its cut-stone terraces.',
  camera,
  lookAt,
  sunDirection: [27, 61, 52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis:
      'Historic gallery footprint fitted to the historic building line in the mapped complex.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'stone_granite', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'gotaplatsen-seven-arched-elevation',
      position: [center, 10.5, 83],
      lookAt: [center, 11.5, 20.6],
    },
    { name: 'stair-terraces-and-arch-depth', position: [37, 10.3, 51], lookAt: [19, 9.1, 19.52] },
    { name: 'shallow-gallery-and-roof', position: [60, 34, -25], lookAt: [center, 14.0, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gothenburg-museum-art-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.3, surfaces },
      street: { export: 'street', errorMeters: 0.125, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.048, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap outline under ODbL and City of Gothenburg CC0 ground elevation.',
};
