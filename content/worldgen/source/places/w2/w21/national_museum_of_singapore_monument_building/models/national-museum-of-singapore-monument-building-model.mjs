import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  ribbon,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const colors = {
  plaster: rgb('d7cfbb'),
  white: rgb('e9e1d0'),
  shadow: rgb('c5bca6'),
  stone: rgb('aaa397'),
  glazing: rgb('566260'),
  door: rgb('575a50'),
  roof: rgb('776857'),
  zinc: rgb('7e857f'),
  zincEdge: rgb('858b84'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  rustication: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.84 },
  basement: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.87 },
  zinc: { slot: 'roof', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.83 },
};
const ring = frame.geometry.outline;
const front = 21.73;
const core = [...ring.slice(0, 13), ...ring.slice(16)];
const stageRoof = 13.2;

function band(out, f, a, b, low, high, depth, tint = colors.white) {
  fbox(out, 'trim', f, a, b, low, high, -0.037, depth, tint);
}

function sash(out, f, x, base, width, height, level, arched = false) {
  if (level >= 2) {
    opening(out, f, x, base, width, height, {
      head: arched ? 'round' : 'flat',
      glass: colors.glazing,
      frameSlot: 'trim',
      frame: colors.white,
      frameDepth: 0.15,
      frameWidth: 0.145,
      mullions: level === 3 ? 2 : 1,
      transoms: level === 3 ? 2 : 0,
      mullionColor: colors.door,
    });
    return;
  }
  const half = width / 2;
  const p = (u, y) => f.P(x + u, base + y, 0.047);
  if (arched) {
    const crown = roundArch(half, level === 0 ? 4 : 6).reverse();
    fan(
      out,
      'glass',
      [p(-half, 0), p(half, 0), ...crown.map(([u, y]) => p(u, height - half + y))],
      colors.glazing,
    );
  } else {
    quad4(out, 'glass', p(-half, 0), p(half, 0), p(half, height), p(-half, height), colors.glazing);
  }
  if (level > 0) band(out, f, x - half - 0.06, x + half + 0.06, base - 0.06, base + 0.045, 0.16);
}

function pediment(out, f, a, b, y, rise, level) {
  const m = (a + b) / 2;
  tri(out, 'wall', f.P(a, y, 0.06), f.P(b, y, 0.06), f.P(m, y + rise, 0.06), colors.plaster);
  band(out, f, a - 0.09, b + 0.09, y - 0.29, y, 0.42);
  for (const u of [a, b]) {
    beam(out, 'trim', f.P(u, y, 0.31), f.P(m, y + rise, 0.31), 0.2, 0.28, colors.white);
    if (level > 1)
      beam(
        out,
        'trim',
        f.P(u, y + 0.22, 0.41),
        f.P(m, y + rise + 0.21, 0.41),
        0.12,
        0.16,
        colors.shadow,
      );
  }
}

function wingRoof(out, left, right, back, near, eaves, ridge) {
  const mid = (near + back) / 2,
    inset = 2.0;
  const a = [left, eaves, near],
    b = [right, eaves, near],
    c = [right, eaves, back],
    d = [left, eaves, back];
  const m = [left + inset, ridge, mid],
    n = [right - inset, ridge, mid];
  quad4(out, 'roof', a, b, n, m, colors.roof);
  tri(out, 'roof', b, c, n, colors.roof);
  quad4(out, 'roof', c, d, m, n, colors.roof);
  tri(out, 'roof', d, a, m, colors.roof);
  beam(out, 'roof', m, n, 0.14, 0.18, colors.shadow);
}

function facadeBays(out, f, positions, length, level, pedimented) {
  const height = 13.04;
  band(out, f, -0.06, length + 0.06, 6.13, 6.48, 0.2);
  if (level > 0) {
    band(out, f, -0.08, length + 0.08, 11.92, 12.18, 0.18);
    band(out, f, -0.14, length + 0.14, 12.78, height, 0.31);
  }
  if (pedimented) pediment(out, f, 0.37, length - 0.37, 13.02, 1.83, level);
  for (const [i, x] of positions.entries()) {
    sash(out, f, x, 1.48, 1.82, 3.79, level, true);
    sash(out, f, x, 7.43, 1.57, 2.95, level);
    if (level >= 1) {
      band(out, f, x - 1.015, x + 1.015, 10.48, 10.63, 0.18);
      const pier = i === 0 ? x - (positions[1] - x) / 2 : (x + positions[i - 1]) / 2;
      band(out, f, pier - 0.16, pier + 0.16, 6.65, 11.83, 0.153, colors.plaster);
      band(out, f, pier - 0.25, pier + 0.25, 11.48, 11.81, 0.205);
      if (level > 2) band(out, f, x - 0.4, x + 0.4, 11.02, 11.32, 0.154, colors.shadow);
    }
  }
  if (level > 1) {
    const blocks = Math.round(length / (level === 3 ? 0.41 : 0.74));
    for (let i = 0; i < blocks; i++) {
      const x = ((i + 0.5) * length) / blocks;
      band(out, f, x - 0.06, x + 0.06, 12.55, 12.75, 0.277, colors.white);
    }
  }
}

function galleries(out, level) {
  extrude(out, 'basement', ring, -6.25, 0.58, colors.stone, { top: false });
  extrude(out, 'rustication', core, 0.58, 6.37, colors.plaster, { top: false });
  extrude(out, 'wall', core, 6.37, stageRoof, colors.plaster, { top: false });
  ribbon(out, 'trim', core, 12.93, 13.24, colors.white, { offset: 0.09, inset: 0.025 });
  wingRoof(out, -37.01, -11.02, -3.3, 11.7, 13.21, 15.22);
  wingRoof(out, 10.93, 36.78, -3.32, 11.68, 13.21, 15.22);
  wingRoof(out, -11.16, 11.17, -6.93, 15.04, 13.21, 15.7);
  abox(out, 'roof', [-4.58, 13.16, -17.68], [4.48, 13.39, -6.82], colors.roof);
  for (const [a, b, bays, end] of [
    [7, 8, [2.34, 6.33, 10.24], true],
    [9, 10, [2.13, 5.42, 8.68, 11.62], false],
    [18, 19, [1.89, 5.39, 8.72, 12.27], false],
    [20, 21, [2.12, 5.89, 9.47], true],
    [6, 7, [2.56, 6.68, 11.02], false],
    [21, 22, [3.4, 7.71, 12.05], false],
  ]) {
    if (level === 0 && (a === 6 || a === 21)) continue;
    const f = wallFace(ring[a], ring[b]);
    facadeBays(out, f, bays, f.length, level, end);
  }
  if (level > 0) {
    for (const [x, z, sign] of [
      [0, -1.83, -1],
      [0, -3.2, -1],
    ]) {
      const back = facade([x, z], [sign, 0]);
      const offsets = z < -3 ? [-34, -29, 29, 34] : [-23, -19, -15, 15, 19, 23];
      for (const u of offsets) {
        sash(out, back, u, 2.3, 1.48, 3.07, level, true);
        sash(out, back, u, 8.2, 1.36, 2.67, level);
      }
    }
  }
}

function porch(out, level) {
  const f = facade([0, front], [1, 0]),
    r = 1.66,
    spring = 3.44,
    top = 6.41;
  abox(out, 'wall', [-7.4, top, 15.04], [7.4, 13.24, front], colors.plaster);
  abox(out, 'roof', [-7.63, 13.14, 14.99], [7.63, 13.56, front + 0.18], colors.roof);
  for (const x of [-4.41, 0, 4.41]) {
    const arch = roundArch(r, level === 0 ? 5 : level === 1 ? 7 : 12);
    for (let i = 0; i + 1 < arch.length; i++) {
      const [a, y] = arch[i],
        [b, h] = arch[i + 1];
      quad4(
        out,
        'rustication',
        f.P(x + a, spring + y),
        f.P(x + b, spring + h),
        f.P(x + b, top),
        f.P(x + a, top),
        colors.plaster,
      );
      quad4(
        out,
        'trim',
        f.P(x + a, spring + y, -0.47),
        f.P(x + b, spring + h, -0.47),
        f.P(x + b, spring + h),
        f.P(x + a, spring + y),
        colors.shadow,
      );
      if (level > 0)
        beam(
          out,
          'trim',
          f.P(x + a, spring + y, 0.12),
          f.P(x + b, spring + h, 0.12),
          0.14,
          0.22,
          colors.white,
        );
    }
    const back = facade([0, 15.104], [1, 0]);
    fbox(out, 'door', back, x - 1.34, x + 1.34, 0.89, 4.52, -0.01, 0.07, colors.door);
    sash(out, f, x, 7.68, 1.94, 3.21, level);
    if (level > 1) pediment(out, f, x - 1.17, x + 1.17, 11.16, 0.48, level);
  }
  for (const [a, b] of [
    [-7.4, -6.07],
    [-2.75, -1.66],
    [1.66, 2.75],
    [6.07, 7.4],
  ]) {
    fbox(out, 'rustication', f, a, b, 0.63, 6.43, -0.53, 0.02, colors.plaster);
    band(out, f, a - 0.07, b + 0.07, 3.29, 3.56, 0.18);
    band(out, f, a + 0.11, b - 0.11, 6.61, 11.95, 0.17, colors.plaster);
  }
  for (const side of [-1, 1]) {
    const x = side * 7.397;
    const face = facade([x, 0], [0, -side]);
    const u = (-side * (front + 15.08)) / 2;
    sash(out, face, u, 7.54, 1.82, 3.19, level);
    const pillars = [15.12, 21.1];
    for (const z of pillars)
      abox(out, 'trim', [x - 0.25, 0.66, z - 0.3], [x + 0.25, 6.6, z + 0.3], colors.plaster);
    band(
      out,
      face,
      Math.min(-side * 15.02, -side * front),
      Math.max(-side * 15.02, -side * front),
      12.88,
      13.2,
      0.2,
    );
  }
  band(out, f, -7.52, 7.52, 6.19, 6.53, 0.24);
  band(out, f, -7.51, 7.51, 12.81, 13.07, 0.3);
  const steps = level === 0 ? 3 : 6;
  for (let i = 0; i < steps; i++)
    abox(
      out,
      'basement',
      [-7.02, -1.2, front - 0.36],
      [7.02, (0.86 * (i + 1)) / steps, front + 2.02 - i * 0.24],
      colors.stone,
    );
}

function rotunda(out, level) {
  const z = 6.78;
  const sides = [12, 20, 32, 48][level];
  const layers = [
    [18.47, 8.42, 8.42],
    [18.62, 8.46, 8.46],
    [19.1, 8.42, 8.42],
    [20.2, 8.05, 8.05],
    [21.64, 7.45, 7.45],
    [23.06, 6.41, 6.41],
    [24.31, 5.1, 5.1],
    [25.36, 3.51, 3.51],
    [25.97, 2.04, 2.04],
    [26.36, 0.81, 0.81],
  ];
  if (level === 0) {
    tower(out, 'wall', [0, z], 8.39, 10, 12.91, 18.48, colors.plaster, { top: false });
    lathe(
      out,
      'zinc',
      [0, z],
      [layers[0], layers[3], layers[5], layers[7], layers[9], [27, 0, 0]],
      10,
      colors.zinc,
      { capTop: false },
    );
    return;
  }
  tower(out, 'wall', [0, z], 8.39, sides, 12.91, 18.45, colors.plaster, { top: false });
  lathe(
    out,
    'trim',
    [0, z],
    [
      [14.42, 8.39, 8.39],
      [14.64, 8.63, 8.63],
      [14.97, 8.63, 8.63],
      [15.18, 8.39, 8.39],
    ],
    sides,
    colors.white,
    { capTop: false },
  );
  lathe(
    out,
    'trim',
    [0, z],
    [
      [17.98, 8.37, 8.37],
      [18.12, 8.64, 8.64],
      [18.52, 8.64, 8.64],
      [18.62, 8.43, 8.43],
    ],
    sides,
    colors.white,
    { capTop: false },
  );
  lathe(out, 'zinc', [0, z], layers, sides, colors.zinc);
  lathe(
    out,
    'zinc',
    [0, z],
    [
      [26.32, 0.81, 0.81],
      [26.62, 0.54, 0.54],
      [26.88, 0.22, 0.22],
      [27, 0, 0],
    ],
    level === 0 ? 8 : 12,
    colors.zincEdge,
    { capTop: false },
  );
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.15) * Math.PI) / 4,
      b = ((i + 0.64) * Math.PI) / 4;
    const wall = (angle) => [8.31 * Math.cos(angle), z + 8.31 * Math.sin(angle)];
    const f = wallFace(wall(b + 0.08), wall(b - 0.08));
    sash(out, f, f.length / 2, 15.28, 0.86, 2.12, level, true);
    const column = wall(a);
    tower(out, 'trim', column, 0.23, level === 3 ? 10 : 6, 14.96, 18.11, colors.white, {
      top: false,
    });
    if (level > 1) tower(out, 'trim', column, 0.31, 8, 17.92, 18.09, colors.white, { top: false });
    if (level >= 2) {
      for (let j = 0; j + 1 < layers.length; j++) {
        const point = ([y, r]) => [
          (r + 0.026) * Math.cos(a),
          y + 0.015,
          z + (r + 0.026) * Math.sin(a),
        ];
        beam(out, 'zinc', point(layers[j]), point(layers[j + 1]), 0.036, 0.039, colors.zincEdge);
      }
    }
  }
}

function build(out, level) {
  galleries(out, level);
  porch(out, level);
  rotunda(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-museum-of-singapore-monument-building-model.mjs';
const camera = [65, 26, 75],
  lookAt = [0, 10.3, 8];
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
    'The original Stamford Road museum with Neo-Palladian wings, an arcaded entrance and its zinc rotunda dome.',
  camera,
  lookAt,
  sunDirection: [30, 61, 52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native footprint of the monument frontage and the central vestibule.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_ashlar',
    'stone_limestone',
    'tile_flat',
    'metal_painted',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'historic-stamford-road-front', position: [51, 13, 72], lookAt: [0, 10.8, 11.5] },
    { name: 'portico-arches-and-window-bays', position: [15, 8, 43], lookAt: [6.2, 7.7, 17.4] },
    { name: 'zinc-dome-and-drum', position: [35, 31, 33], lookAt: [0, 19.9, 6.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-museum-singapore-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.83,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap footprint under ODbL, and Mapzen terrain under source attribution.',
};
