import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const load = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const map = load('map-frame');
const plan = load('plan-controls');
const base = map.geometry.outline;
const yEave = plan.dimensions.plazaEaveM;
const color = {
  stucco: rgb('c78f70'),
  travertine: rgb('c4b79d'),
  carved: rgb('d6c9ae'),
  line: rgb('a79a80'),
  roof: rgb('735345'),
  dark: rgb('47443a'),
  wood: rgb('4f5449'),
  slat: rgb('625f50'),
  glass: rgb('4b5251'),
  plaque: rgb('a9a6a0'),
};
const surfaces = {
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_travertine', roughness: 0.92 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
};

function panel(out, slot, face, u0, u1, y0, y1, depth, tint) {
  quad4(
    out,
    slot,
    face.P(u0, y0, depth),
    face.P(u1, y0, depth),
    face.P(u1, y1, depth),
    face.P(u0, y1, depth),
    tint,
  );
}

function shoulder(out, face, u, y, level) {
  const count = [4, 6, 9, 13][level];
  const points = Array.from({ length: count + 1 }, (_, i) => {
    const t = (2 * i) / count - 1;
    const v = 1 - t * t;
    return [t * 0.98, 0.09 + 0.41 * v * v];
  });
  for (let i = 0; i < count; i++) {
    const [a, b] = points[i];
    const [c, d] = points[i + 1];
    quad4(
      out,
      'trim',
      face.P(u + a, y + b, 0.19),
      face.P(u + c, y + d, 0.19),
      face.P(u + c, y + d + 0.13, 0.21),
      face.P(u + a, y + b + 0.13, 0.21),
      color.carved,
    );
    if (level > 1) {
      beam(
        out,
        'trim',
        face.P(u + a, y + b + 0.13, 0.215),
        face.P(u + c, y + d + 0.13, 0.215),
        0.049,
        0.068,
        color.carved,
      );
    }
  }
  if (level > 0) {
    const p = face.P(u, y + 0.23, 0.32);
    const scale = 0.21;
    const ring = Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return face.P(u + scale * Math.cos(a), y + 0.23 + scale * Math.sin(a), 0.202);
    });
    for (let i = 0; i < ring.length; i++) {
      tri(out, 'trim', ring[i], ring[(i + 1) % ring.length], p, color.carved);
    }
  }
}

function window(out, face, u, level, bottom, height, ornate = false, open = false) {
  const half = 0.57;
  const left = u - half;
  const right = u + half;
  const top = bottom + height;
  fbox(
    out,
    'trim',
    face,
    left - 0.145,
    right + 0.145,
    bottom - 0.17,
    top + 0.15,
    0.006,
    0.137,
    color.travertine,
  );
  panel(
    out,
    open ? 'detail' : 'wood',
    face,
    left,
    right,
    bottom,
    top,
    0.158,
    open ? color.glass : color.wood,
  );
  if (ornate) shoulder(out, face, u, top + 0.085, level);
  if (level === 0) return;
  const stiles = open ? [-0.34, 0, 0.34] : [0];
  for (const x of stiles)
    panel(out, 'wood', face, u + x - 0.031, u + x + 0.031, bottom, top, 0.178, color.dark);
  fbox(
    out,
    'trim',
    face,
    left - 0.177,
    right + 0.177,
    bottom - 0.14,
    bottom - 0.025,
    0.023,
    0.2,
    color.carved,
  );
  if (level < 2) return;
  if (open) {
    for (const h of [0.29, 0.6]) {
      panel(
        out,
        'wood',
        face,
        left,
        right,
        bottom + h * height - 0.019,
        bottom + h * height + 0.019,
        0.186,
        color.dark,
      );
    }
  } else {
    const rows = level === 2 ? 8 : 14;
    for (let i = 1; i < rows; i++) {
      const y = bottom + (height * i) / rows;
      panel(out, 'wood', face, left + 0.043, right - 0.043, y, y + 0.023, 0.173, color.slat);
    }
  }
}

const returnX = -0.28;
const frontZ = base[1][1];
const joint = [
  [returnX, frontZ],
  [returnX, frontZ - 0.43],
];
const uphill = [base[2][0], frontZ - 0.43];
const envelope = [base[0], base[1], ...joint, uphill, base[3]];
const wallFaces = envelope.map((p, i) => wallFace(envelope[(i + 1) % envelope.length], p));

function wallDetails(out, face, level) {
  const n = face.length;
  for (const y of [5.33, 6.07, 10.21, 14.38, 14.97]) {
    fbox(out, 'trim', face, 0, n, y - 0.082, y + 0.083, 0, 0.185, color.travertine);
  }
  if (level === 0) return;
  for (const d of [0.08, n - 0.68]) {
    panel(out, 'trim', face, d, d + 0.6, -0.11, 15.0, 0.099, color.travertine);
    if (level > 1) {
      fbox(out, 'trim', face, d - 0.043, d + 0.64, 13.92, 14.18, 0.084, 0.196, color.carved);
    }
  }
  if (level > 1) {
    for (let y = 0.66; y < 5.29; y += 0.43) {
      panel(out, 'detail', face, 0.68, n - 0.68, y, y + 0.014, 0.024, color.line);
    }
  }
}

function principalFacade(out, face, level, east) {
  wallDetails(out, face, level);
  const distance = east ? [2.32, face.length - 2.22] : [2.25, face.length - 2.13];
  for (const [i, u] of distance.entries()) {
    window(out, face, u, level, 3.03, 1.83);
    window(out, face, u, level, 6.27, 2.34, true, east && i === 0);
    window(out, face, u, level, 10.54, 2.19, false, east && i === 0);
    if (level > 0) {
      panel(out, 'trim', face, u - 0.27, u + 0.27, 13.24, 13.46, 0.025, color.travertine);
    }
  }
  if (!east) {
    const mid = (distance[0] + distance[1]) / 2;
    fbox(out, 'detail', face, mid - 0.735, mid + 0.735, 6.72, 8.18, 0.031, 0.118, color.plaque);
    panel(out, 'trim', face, mid - 0.58, mid + 0.58, 6.86, 8.05, 0.128, color.travertine);
    fbox(out, 'trim', face, 1.48, 2.72, -0.07, 1.91, -0.01, 0.068, color.travertine);
  }
}

function roofBlock(out, x0, x1, zFront, zBack, yTop) {
  const insetX = (x1 - x0) * 0.3;
  const edge = (y, grow) => [
    [x0 - grow, y, zFront - grow],
    [x0 - grow, y, zBack + grow],
    [x1 + grow, y, zBack + grow],
    [x1 + grow, y, zFront - grow],
  ];
  const lower = edge(yEave - 0.04, 0.19);
  const skirt = edge(yEave + 0.24, 0.54);
  const peakZ = (zFront + zBack) / 2;
  const peak = [
    [x0 + insetX, yTop, peakZ - 0.12],
    [x0 + insetX, yTop, peakZ + 0.12],
    [x1 - insetX, yTop, peakZ + 0.12],
    [x1 - insetX, yTop, peakZ - 0.12],
  ];
  const soffit = edge(yEave - 0.045, -0.55);
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    quad4(out, 'wood', lower[j], lower[i], soffit[i], soffit[j], color.dark);
  }
  loft(out, 'trim', [lower, edge(yEave + 0.03, 0.38)], color.travertine, { cap: false });
  loft(out, 'wood', [edge(yEave + 0.03, 0.38), skirt], color.dark, { cap: false });
  loft(out, 'tile', [skirt, peak], color.roof, { cap: false });
  quad4(out, 'tile', ...peak, color.roof);
}

function roof(out, level) {
  roofBlock(out, base[0][0], 0.06, frontZ, base[0][1], 16.4);
  roofBlock(out, -0.26, base[2][0], frontZ - 0.43, base[3][1], plan.dimensions.upperRoofRidgeM);
  const top = plan.dimensions.roofRoomCorniceM;
  abox(out, 'stucco', [-2.25, 15.75, -1.11], [5.32, top - 0.23, 2.48], color.stucco);
  abox(out, 'detail', [-2.03, 17.5, -1.145], [5.1, top - 0.41, -1.11], color.glass);
  abox(out, 'tile', [-2.54, top - 0.23, -1.41], [5.6, top, 2.73], color.roof);
  if (level > 0) {
    for (let x = -1.86; x < 5.09; x += level === 1 ? 1.72 : 0.82) {
      abox(out, 'wood', [x, 17.51, -1.168], [x + 0.048, top - 0.43, -1.144], color.dark);
    }
  }
  for (const [x, z, top] of [
    [-6.4, 1.41, 17.34],
    [-3.24, 2.13, 17.78],
    [6.77, 1.32, 18.83],
  ]) {
    abox(out, 'stucco', [x, 15.82, z], [x + 0.48, top, z + 0.36], color.travertine);
    if (level === 3)
      abox(
        out,
        'trim',
        [x - 0.055, top - 0.099, z - 0.045],
        [x + 0.545, top + 0.048, z + 0.405],
        color.carved,
      );
  }
}

function build(out, level) {
  extrude(out, 'trim', envelope, -0.53, 5.39, color.travertine, { top: false });
  extrude(out, 'stucco', envelope, 5.39, yEave, color.stucco, { top: false });
  principalFacade(out, wallFaces[1], level, false);
  principalFacade(out, wallFaces[3], level, true);
  const plaza = wallFaces[0];
  wallDetails(out, plaza, level);
  for (const u of [2.22, plaza.length - 2.21]) {
    window(out, plaza, u, level, 3.03, 1.83);
    window(out, plaza, u, level, 6.27, 2.34, true);
    window(out, plaza, u, level, 10.54, 2.19);
  }
  const u = plaza.length * 0.48;
  fbox(out, 'trim', plaza, u - 0.91, u + 0.91, -0.06, 2.83, 0.01, 0.14, color.carved);
  panel(out, 'wood', plaza, u - 0.67, u + 0.67, 0.055, 2.61, 0.17, color.dark);
  if (level > 1) {
    panel(out, 'wood', plaza, u - 0.032, u + 0.032, 0.1, 2.35, 0.182, color.slat);
    panel(out, 'trim', plaza, u + 0.93, u + 1.29, 1.82, 2.17, 0.16, color.plaque);
  }
  roof(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'keats-shelley-memorial-house-model.mjs';
const camera = [-38, 19, -37];
const lookAt = [0, 9.1, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Keats–Shelley Memorial House',
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The ochre palazzetto at Piazza di Spagna 26 with paired Baroque bays, travertine trim, dark shutters and a rooftop room.',
  camera,
  lookAt,
  sunDirection: [-56, 80, -52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: map.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named OpenStreetMap building polygon at Piazza di Spagna 26.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_travertine', 'wood_plain', 'tile_ceramic'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'spanish-steps-elevation', position: [8, 8.1, -33.5], lookAt: [-0.4, 8.4, 0] },
    { name: 'piazza-di-spagna-entry', position: [-30, 5.3, -16], lookAt: [-2.8, 7.3, 0.6] },
    { name: 'roof-and-terrace', position: [13, 26, -26], lookAt: [0, 11.5, 0.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'keats-shelley-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.42,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.19, surfaces },
      street: { export: 'street', errorMeters: 0.071, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.028, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Native building geometry under ODbL and the INGV TINITALY ground survey under its published license.',
};
