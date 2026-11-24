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
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const tone = {
  wall: rgb('d5cdb9'),
  warm: rgb('c7b99e'),
  trim: rgb('e4d9bf'),
  stone: rgb('a99d89'),
  shade: rgb('a99c85'),
  glass: rgb('454f4e'),
  timber: rgb('635342'),
  tile: rgb('73766a'),
  metal: rgb('686f65'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.83 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.81, metallic: 0.12 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48 },
};
const outline = frame.geometry.outline;
const front = outline[2][1];
const center = 0.37;
const eaves = plan.dimensions.majorPavilionEavesM;
const plinth = 1.18;
const niche = 2.53;
const recess = [
  ...outline.slice(0, 3),
  [center + niche, front],
  [center + niche, front - 2.63],
  [center - niche, front - 2.63],
  [center - niche, front],
  ...outline.slice(3),
];
const wallRing = outwardRing(outline);
const north = facade([0, front], [1, 0]);

function strip(out, f, x0, x1, y0, y1, d, color = tone.trim) {
  fbox(out, 'trim', f, x0, x1, y0, y1, -0.014, d, color);
}

function sash(out, f, x, y, w, h, level, arch = false) {
  if (level > 1) {
    opening(out, f, x, y, w, h, {
      head: arch ? 'round' : 'flat',
      glass: tone.glass,
      frame: tone.trim,
      frameSlot: 'trim',
      frameWidth: 0.11,
      frameDepth: 0.16,
      d: 0.06,
      mullions: 1,
      transoms: level === 3 ? 2 : 1,
      mullionColor: tone.timber,
    });
    return;
  }
  const half = w / 2;
  if (arch) {
    const archPoints = roundArch(half, level === 0 ? 4 : 6).reverse();
    fan(
      out,
      'glass',
      [
        f.P(x - half, y, 0.048),
        f.P(x + half, y, 0.048),
        ...archPoints.map(([a, b]) => f.P(x + a, y + h - half + b, 0.048)),
      ],
      tone.glass,
    );
  } else {
    quad4(
      out,
      'glass',
      f.P(x - half, y, 0.046),
      f.P(x + half, y, 0.046),
      f.P(x + half, y + h, 0.046),
      f.P(x - half, y + h, 0.046),
      tone.glass,
    );
  }
  if (level > 0) strip(out, f, x - half - 0.07, x + half + 0.07, y - 0.095, y - 0.003, 0.16);
}

function walls(out, level) {
  extrude(out, 'base', recess, -1.9, plinth, tone.stone, { top: false });
  extrude(out, 'wall', recess, plinth, 6.54, tone.warm, { top: false });
  extrude(out, 'wall', outline, 6.54, eaves, tone.wall, { top: false });
  for (const [i, a] of wallRing.entries()) {
    const b = wallRing[(i + 1) % wallRing.length],
      f = wallFace(a, b);
    const z = (a[1] + b[1]) / 2;
    if (f.length < 3.1 || (z > 15 && f.normal[1] > 0.82)) continue;
    const length = f.length;
    const centerY = z < -9 ? 7.4 : 8.1;
    const count = Math.max(1, Math.round(length / (level === 0 ? 7.9 : 5.8)));
    for (let k = 0; k < count; k++) {
      const x = ((k + 0.5) * length) / count;
      sash(out, f, x, centerY, Math.min(1.96, (length / count) * 0.42), 4.1, level, true);
      if (level > 0) sash(out, f, x, 2.05, Math.min(1.54, (length / count) * 0.38), 2.97, level);
      if (level > 1 && k > 0) strip(out, f, x - 2.43, x - 2.16, 6.85, 14.69, 0.17, tone.warm);
    }
    if (level > 0) strip(out, f, 0, length, 6.04, 6.42, 0.185);
    if (level > 0) strip(out, f, 0, length, 15.22, eaves + 0.13, 0.265);
  }
}

function ionic(out, f, x, ground, height, level, width) {
  if (level === 0) {
    quad4(
      out,
      'trim',
      f.P(x - width * 0.51, ground, 0.07),
      f.P(x + width * 0.51, ground, 0.07),
      f.P(x + width * 0.51, height, 0.07),
      f.P(x - width * 0.51, height, 0.07),
      tone.trim,
    );
    return;
  }
  strip(out, f, x - width * 0.63, x + width * 0.63, ground, ground + 0.43, 0.38);
  strip(out, f, x - width * 0.44, x + width * 0.44, ground + 0.42, height - 0.61, 0.22, tone.trim);
  strip(out, f, x - width * 0.61, x + width * 0.61, height - 0.62, height - 0.43, 0.32, tone.warm);
  strip(out, f, x - width * 0.68, x + width * 0.68, height - 0.43, height - 0.16, 0.45);
  if (level < 2) return;
  for (const side of [-1, 1]) {
    const u = x + side * width * 0.4;
    strip(out, f, u - 0.099, u + 0.099, ground + 0.84, height - 0.66, 0.271, tone.warm);
    const c = f.P(u, height - 0.43, 0.435);
    tower(
      out,
      'trim',
      [c[0], c[2]],
      width * 0.16,
      level === 3 ? 8 : 5,
      height - 0.52,
      height - 0.18,
      tone.trim,
      { top: false },
    );
  }
}

function cornice(out, f, l, r, level, y = 15.26) {
  if (level > 0) strip(out, f, l - 0.12, r + 0.12, y - 0.2, y + 0.12, 0.37, tone.warm);
  strip(out, f, l - 0.22, r + 0.22, y + 0.12, y + 0.64, 0.72, tone.trim);
  if (level < 2) return;
  const count = Math.ceil((r - l) / (level === 2 ? 0.83 : 0.52));
  for (let i = 0; i < count; i++) {
    const p = l + ((r - l) * (i + 0.5)) / count;
    strip(out, f, p - 0.084, p + 0.084, y - 0.145, y + 0.13, 0.52);
  }
}

function northFaces(out, level) {
  const fields = [
    [north, -17.25, 17.99, [-14.78, -10.37, -4.11, 0.37, 4.85, 10.98, 15.57], [-8.15, 8.89]],
    [facade([0, 21.916], [1, 0]), -30.287, -17.25, [-26.96, -22.13], [-29.9, -18.16]],
    [facade([0, 20.581], [1, 0]), 17.995, 32.04, [21.9, 26.7, 30.35], [19.02, 31.71]],
    [facade([0, 23.319], [1, 0]), -33.826, -30.29, [-32.08], [-33.61, -30.54]],
  ];
  for (const [f, l, r, windows, piers] of fields) {
    cornice(out, f, l, r, level);
    if (level > 0) strip(out, f, l, r, 6.17, 6.54, 0.25);
    for (const x of piers) ionic(out, f, x, 6.59, 15.18, level, 0.91);
    for (const x of windows) {
      const arch = x < -31 || x > 29;
      sash(out, f, x, 7.55, 1.94, 5.3, level, arch);
      if (Math.abs(x - center) > 3.01) sash(out, f, x, 2.05, 1.67, 3.38, level);
      if (level > 0) {
        strip(out, f, x - 1.23, x + 1.23, 13.12, 13.47, 0.28);
        strip(out, f, x - 1.08, x + 1.08, 7.33, 7.57, 0.255, tone.warm);
      }
      if (level > 1) strip(out, f, x - 0.43, x + 0.43, 13.57, 14.06, 0.13, tone.warm);
    }
  }
  const l = center - 8.22,
    r = center + 8.22,
    y = eaves + 0.09,
    top = plan.dimensions.centerPedimentM;
  tri(out, 'wall', north.P(l, y, 0.72), north.P(r, y, 0.72), north.P(center, top, 0.72), tone.warm);
  for (const x of [l, r]) {
    beam(out, 'trim', north.P(x, y, 0.81), north.P(center, top, 0.81), 0.29, 0.31, tone.trim);
    if (level > 0)
      beam(
        out,
        'trim',
        north.P(x + 0.63 * Math.sign(center - x), y + 0.07, 0.78),
        north.P(center, top - 0.521, 0.78),
        0.144,
        0.16,
        tone.shade,
      );
  }
  if (level > 1) sash(out, north, center, y + 0.67, 1.28, 1.26, level, true);
}

function openPortal(out, level) {
  const f = facade([0, front + 0.08], [1, 0]);
  const spring = 4.07,
    r = 2.35,
    crown = plan.dimensions.centralCoveredEntranceM - 1.13;
  const profile = roundArch(r, level === 0 ? 6 : level === 1 ? 9 : 14);
  const degree = profile.length - 1;
  const deep = 2.7;
  for (let j = 0; j < degree; j++) {
    const [u, y] = profile[j],
      [v, h] = profile[j + 1];
    const a = center + u,
      b = center + v;
    upWall(out, f, a, b, spring + y, spring + h, crown);
    quad4(
      out,
      'trim',
      f.P(a, spring + y, 0.16),
      f.P(b, spring + h, 0.16),
      f.P(b, spring + h, -deep),
      f.P(a, spring + y, -deep),
      tone.warm,
    );
    if (level > 1)
      beam(
        out,
        'trim',
        f.P(a, spring + y + 0.09, 0.245),
        f.P(b, spring + h + 0.09, 0.245),
        0.2,
        0.22,
        tone.trim,
      );
  }
  for (const side of [-1, 1]) {
    const x = center + side * (r + 0.21);
    ionic(out, f, x, 0.69, spring + 0.22, level, 0.62);
  }
  strip(out, f, center - niche - 0.49, center + niche + 0.49, crown - 0.19, crown + 0.1, 0.32);
  const back = facade([0, front - 2.62], [1, 0]);
  fbox(out, 'wood', back, center - 1.19, center + 1.19, 0.75, 4.61, 0, 0.046, tone.timber);
  if (level > 0) sash(out, back, center, 3.44, 1.85, 1.04, level, true);
  for (let i = 0; i < 4; i++) {
    const z = front + 2.35 - 0.43 * i;
    abox(
      out,
      'base',
      [center - 3.22, -0.06, front - 0.18],
      [center + 3.22, 0.18 * (i + 1), z],
      tone.stone,
    );
  }
}

function upWall(out, f, x0, x1, y0, y1, top) {
  quad4(
    out,
    'wall',
    f.P(x0, y0, 0.153),
    f.P(x1, y1, 0.153),
    f.P(x1, top, 0.153),
    f.P(x0, top, 0.153),
    tone.wall,
  );
}

function hip(out, x0, x1, z0, z1, low, high) {
  const m = (z1 + z0) / 2;
  const inset = Math.min(0.35 * (z1 - z0), 0.31 * (x1 - x0));
  const a = [x0, low, z1],
    b = [x1, low, z1],
    c = [x1, low, z0],
    d = [x0, low, z0];
  const p = [x0 + inset, high, m],
    q = [x1 - inset, high, m];
  quad4(out, 'roof', a, b, q, p, tone.tile);
  tri(out, 'roof', b, c, q, tone.tile);
  quad4(out, 'roof', c, d, p, q, tone.tile);
  tri(out, 'roof', d, a, p, tone.tile);
  beam(out, 'roof', p, q, 0.16, 0.22, tone.metal);
}

function roofSet(out, level) {
  for (const rect of [
    [-17.75, 18.54, -1.95, 27.97, eaves, 18.95],
    [-34.06, -16.16, 1.74, 22.27, eaves, 17.38],
    [-34.25, -29.99, 10.12, 23.58, eaves, 17.65],
    [17.36, 32.44, 11.16, 21.0, eaves, 17.56],
    [6.0, 23.88, -0.16, 12.15, eaves, 17.44],
    [-16.64, 6.33, -26.26, 2.88, eaves, 18.14],
    [-32.95, -15.94, -23.76, -10.79, eaves, 17.37],
    [-22.81, 4.59, -32.68, -23.65, eaves, 17.89],
  ])
    hip(out, ...rect);
  const tip = plan.dimensions.cupolaM;
  const z = 14.92;
  abox(out, 'trim', [center - 1.85, 18.54, z - 1.49], [center + 1.85, 19.48, z + 1.49], tone.warm);
  abox(out, 'wall', [center - 1.39, 19.47, z - 1.14], [center + 1.39, 22.91, z + 1.14], tone.wall);
  abox(out, 'trim', [center - 1.62, 22.71, z - 1.32], [center + 1.62, 23.01, z + 1.32], tone.trim);
  lathe(
    out,
    'metal',
    [center, z],
    [
      [22.99, 1.88, 1.54],
      [23.33, 1.51, 1.27],
      [23.88, 0.92, 0.78],
      [tip, 0, 0],
    ],
    level < 2 ? 8 : 12,
    tone.metal,
    { capTop: false },
  );
  const faces = [
    facade([center, z + 1.14], [1, 0]),
    facade([center, z - 1.14], [-1, 0]),
    facade([center - 1.4, z], [0, 1]),
    facade([center + 1.4, z], [0, -1]),
  ];
  for (const f of faces) sash(out, f, 0, 20.31, 0.88, 2.03, level, true);
  for (const x of level === 0 ? [] : [-16.03, 16.22]) {
    const f = facade([x, front - 0.92], [1, 0]);
    strip(out, f, -0.83, 0.83, eaves, 17.29, 0.55, tone.warm);
    strip(out, f, -0.94, 0.94, 17.24, 17.47, 0.66);
    if (level > 0)
      for (const dx of [-0.46, 0, 0.46]) strip(out, f, dx - 0.071, dx + 0.071, 16.37, 17.22, 0.64);
  }
}

function build(out, level) {
  walls(out, level);
  northFaces(out, level);
  openPortal(out, level);
  roofSet(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'lushun-museum-main-building-model.mjs';
const camera = [51, 28, 88];
const lookAt = [0.4, 8.4, 12];
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
    'The historic Lüshun museum building with a tall classical north façade, an arched entrance and a small central cupola.',
  camera,
  lookAt,
  sunDirection: [24, 56, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis:
      'Named native heritage building footprint, including the irregular attached rear ranges.',
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
    { name: 'north-elevation-and-pediment', position: [1, 11, 88], lookAt: [0.36, 9.7, 25.5] },
    { name: 'entry-arch-and-window-orders', position: [12, 7, 51], lookAt: [0.37, 7.6, 26.5] },
    { name: 'cupola-and-rear-side-wings', position: [61, 30, -48], lookAt: [0, 10.5, -2.0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lushun-museum-main-building-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap footprint under ODbL, and Mapzen terrain under source attribution.',
};
