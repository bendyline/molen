import fs from 'node:fs';
import {
  cap,
  face,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outline = outwardRing(frame.geometry.outline);
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.9 },
  soffit: { slot: 'trim', graph: 'wood_plain', roughness: 0.87 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.7 },
};
const wall = rgb('d2c8b3');
const westWall = rgb('c9bfac');
const cream = rgb('dbd3c3');
const pierTone = rgb('c0b7a6');
const pale = rgb('d0c6b4');
const stone = rgb('a39b88');
const recess = rgb('615d51');
const frameTone = rgb('797c72');
const pane = rgb('565e58');
const tile = rgb('82977c');
const tileLight = rgb('92a28b');
const tileShadow = rgb('748b73');
const eaveWood = rgb('72756a');
const bole = rgb('8e8878');
const cx = 2.035;
const baseY = 0.79;
const floorEave = 10.68;

function panel(out, slot, f, l, r, b, t, color, d = 0) {
  if (r - l < 0.002 || t - b < 0.002) return;
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), color);
}

function course(out, f, l, r, b, t, d, color = cream) {
  fbox(out, 'trim', f, l, r, b, t, -0.023, d, color);
}

function glazed(out, f, u, y, w, h, lod, options = {}) {
  const { head = 'flat', d = 0.046, mullions = 1, transoms = 1, wide = false } = options;
  opening(out, f, u, y, w, h, {
    glassSlot: 'dark',
    frameSlot: 'trim',
    glass: pane,
    frame: wide ? cream : pierTone,
    head,
    d,
    frameWidth: lod >= 2 ? (wide ? 0.17 : 0.088) : 0,
    frameDepth: wide ? 0.13 : 0.1,
    sill: lod >= 2,
    mullions: lod === 3 ? mullions : lod === 2 && w > 1.7 ? 1 : 0,
    transoms: lod === 3 ? transoms : 0,
    mullionColor: frameTone,
  });
}

function exterior(out, lod) {
  extrude(out, 'base', outline, -0.91, baseY, stone, { top: false });
  for (let i = 0; i < outline.length; i++) {
    const p = outline[i],
      q = outline[(i + 1) % outline.length],
      f = wallFace(p, q);
    const shortPortico =
      Math.min(p[1], q[1]) > 16.79 &&
      Math.max(p[1], q[1]) > 24.8 &&
      Math.min(p[0], q[0]) > -4.9 &&
      Math.max(p[0], q[0]) < 8.97;
    if (shortPortico) continue;
    const onFront = f.normal[1] > 0.98 && Math.min(p[1], q[1]) > 16;
    const mainWallY = onFront ? 10.78 : floorEave;
    panel(out, 'wall', f, 0, f.length, baseY, mainWallY, onFront ? wall : westWall);
    if (onFront) continue;
    const columns = Math.max(1, Math.round(f.length / (lod === 0 ? 6.5 : 4.05)));
    for (let j = 0; j < columns; j++) {
      const u = ((j + 0.5) * f.length) / columns;
      glazed(out, f, u, 6.07, Math.min(1.36, f.length * 0.5), 2.18, lod);
      if (lod >= 1 || j % 2 === 0)
        glazed(out, f, u + 0.04, 2.34, Math.min(1.36, f.length * 0.5), 1.96, lod);
    }
    if (lod > 0 && f.length > 7) {
      course(out, f, 0.04, f.length - 0.04, 9.9, 10.27, 0.12, pale);
      course(out, f, 0.04, f.length - 0.04, 5.03, 5.18, 0.08, pale);
    }
  }
  // The archive shows the side office returns as shallow slab-roofed ranges.
  const cover = outline.map(([x, z]) => [x, Math.min(z, 17.03)]);
  cap(out, 'base', cover, floorEave + 0.025, bole);
}

function facadeWing(out, bounds, lod) {
  const { min, max, z, bays } = bounds;
  const f = facade([0, z], [1, 0]);
  const top = 10.77;
  course(out, f, min + 0.02, max - 0.03, 9.92, 10.14, 0.22);
  if (lod > 0) {
    course(out, f, min, max, 5.11, 5.32, 0.18, pale);
    course(out, f, min, max, 10.42, 10.64, 0.24);
  }
  const pitch = (max - min) / bays;
  for (let i = 0; i < bays; i++) {
    const u = min + (i + 0.5) * pitch;
    const offset = i === 0 || i === bays - 1 ? 0.36 : 0.25;
    if (lod > 0)
      fbox(
        out,
        'trim',
        f,
        u - pitch * 0.5 - 0.13,
        u - pitch * 0.5 + 0.14,
        5.44,
        9.83,
        0.0,
        offset,
        pale,
      );
    glazed(out, f, u, 6.2, 1.9, 2.48, lod, { wide: true, mullions: 2, transoms: 2 });
    glazed(out, f, u, 2.12, 1.58, 2.01, lod, { transoms: 1 });
    if (lod >= 2) course(out, f, u - 1.13, u + 1.13, 8.81, 9.12, 0.31, cream);
  }
  if (lod >= 2) {
    course(out, f, min + 0.02, max - 0.03, 0.77, 0.93, 0.12, stone);
    course(out, f, max - 0.29, max - 0.04, 5.39, top - 0.95, 0.24, pale);
  }
}

function flatBand(out, x0, x1, z0, z1, y0, y1, tint = cream, slot = 'trim') {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}

function hippedRoof(out, x, z, halfX, halfZ, y, height, lod, options = {}) {
  const { hips = 0.45, faded = false } = options;
  const short = Math.min(halfX, halfZ);
  const make = (hw, hd, y) => [
    [x - hw, y, z - hd],
    [x - hw, y, z + hd],
    [x + hw, y, z + hd],
    [x + hw, y, z - hd],
  ];
  const lower = make(halfX, halfZ, y);
  const breakRing = make(halfX * 0.82, halfZ * 0.82, y + height * 0.29);
  const upper = make(halfX * hips, halfZ * 0.21, y + height * 0.96);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'roof',
      [lower[i], lower[j], breakRing[j], breakRing[i]],
      up,
      i % 2 ? tile : tileLight,
    );
    face(
      out,
      'roof',
      [breakRing[i], breakRing[j], upper[j], upper[i]],
      up,
      faded ? tileShadow : tile,
    );
    face(
      out,
      'soffit',
      [
        lower[j],
        lower[i],
        [x + (lower[i][0] - x) * 0.86, y - 0.19, z + (lower[i][2] - z) * 0.86],
        [x + (lower[j][0] - x) * 0.86, y - 0.19, z + (lower[j][2] - z) * 0.86],
      ],
      [0, -1, 0],
      eaveWood,
    );
  }
  face(out, 'roof', upper, up, tileShadow);
  if (lod >= 2) {
    const ridgeLength = Math.max(short * 0.38, halfX * hips);
    flatBand(
      out,
      x - ridgeLength,
      x + ridgeLength,
      z - 0.095,
      z + 0.095,
      y + height * 0.947,
      y + height + 0.095,
      tileShadow,
      'roof',
    );
    const corners = [
      [-halfX, -halfZ],
      [-halfX, halfZ],
      [halfX, halfZ],
      [halfX, -halfZ],
    ];
    for (const [u, v] of corners) {
      const edgeX = x + u,
        edgeZ = z + v;
      face(
        out,
        'roof',
        [
          [edgeX, y + 0.13, edgeZ],
          [edgeX - Math.sign(u) * 0.36, y + 0.093, edgeZ],
          [edgeX, y + 0.093, edgeZ - Math.sign(v) * 0.36],
        ],
        up,
        tileShadow,
      );
    }
  }
}

function portico(out, lod) {
  const p = facade([cx, 24.941], [1, 0]);
  const half = 6.82;
  const height = 4.78;
  const centers = [-3.53, 0, 3.53];
  const left = centers[0];
  const right = centers.at(-1);
  const width = 2.25;
  const radius = width / 2;
  const spring = 2.22;
  let previous = -half;
  for (const u of centers) {
    panel(out, 'wall', p, previous, u - radius, baseY, height, wall);
    const arc = roundArch(radius, lod === 0 ? 4 : lod === 1 ? 6 : 10);
    for (let i = 0; i < arc.length - 1; i++) {
      const [ax, ay] = arc[i],
        [bx, by] = arc[i + 1];
      const A = p.P(u + ax, spring + ay),
        B = p.P(u + bx, spring + by);
      quad4(out, 'wall', A, B, p.P(u + bx, height), p.P(u + ax, height), wall);
      quad4(
        out,
        'soffit',
        B,
        A,
        p.P(u + ax, spring + ay, -1.54),
        p.P(u + bx, spring + by, -1.54),
        eaveWood,
      );
    }
    panel(out, 'dark', p, u - radius, u + radius, baseY, 3.43, recess, -1.56);
    for (const [x, side] of [
      [u - radius, 1],
      [u + radius, -1],
    ]) {
      const f0 = p.P(x, baseY),
        f1 = p.P(x, spring),
        i0 = p.P(x, baseY, -1.54),
        i1 = p.P(x, spring, -1.54);
      face(out, 'trim', [f0, f1, i1, i0], [side, 0, 0], pierTone);
    }
    previous = u + radius;
  }
  panel(out, 'wall', p, previous, half, baseY, height, wall);
  course(out, p, -half, half, 3.69, 3.86, 0.17, pale);
  course(out, p, -half, half, 4.62, 4.91, 0.25);
  for (const x of [left - 1.36, right + 1.36]) {
    fbox(out, 'trim', p, x - 0.19, x + 0.19, 0.81, 3.77, -0.03, 0.13, pale);
  }
  for (const [x, dir] of [
    [-4.787, 1],
    [8.86, -1],
  ]) {
    const edge = facade([x, 21.55], [0, dir]);
    panel(out, 'wall', edge, -3.4, 3.4, baseY, height, westWall);
  }
  flatBand(out, -4.84, 8.91, 17.0, 24.92, 4.71, 4.86, stone, 'base');
  const steps = lod === 0 ? 2 : 5;
  const h = baseY / steps;
  for (let i = 0; i < steps; i++) {
    const front = 26.58 - (i * 1.47) / steps,
      back = front - 1.49 / steps;
    flatBand(out, -4.33, 8.4, back, front, -0.03, (i + 1) * h, stone, 'base');
  }
}

function mainTower(out, lod) {
  const x0 = -4.81,
    x1 = 8.86,
    z0 = 7.3,
    z1 = 19.23;
  const height = 15.76;
  flatBand(out, x0, x1, z0, z1, 4.9, height, wall, 'wall');
  const f = facade([cx, z1], [1, 0]);
  const v = [-4.12, -1.8, 1.77, 4.02];
  course(out, f, -6.82, 6.82, 11.38, 11.59, 0.22, pale);
  course(out, f, -6.82, 6.82, 15.14, 15.45, 0.28);
  for (const x of v) {
    glazed(out, f, x, 6.6, 0.9, 2.74, lod, { mullions: 1, transoms: 2 });
    glazed(out, f, x, 12.13, 1.0, 2.19, lod, { mullions: 1, transoms: 1 });
  }
  if (lod > 0) {
    const rosette = Array.from({ length: lod === 3 ? 16 : 10 }, (_, i) => {
      const t = (i * Math.PI * 2) / (lod === 3 ? 16 : 10);
      return f.P(Math.cos(t) * 0.58, 13.46 + Math.sin(t) * 0.58, 0.063);
    });
    fan(out, 'dark', rosette, pane);
  }
  const platform = [
    [-4.24, 7.92],
    [-4.24, 18.45],
    [8.22, 18.45],
    [8.22, 7.92],
  ];
  flatBand(out, -4.41, 8.49, 7.8, 18.68, 15.68, 16.01, pale);
  for (let i = 0; i < platform.length; i++) {
    const f = wallFace(platform[i], platform[(i + 1) % 4]);
    const spacing = f.length / 6;
    for (let j = 0; j <= 6; j++) {
      const u = j * spacing;
      fbox(
        out,
        'trim',
        f,
        Math.max(u - 0.138, 0),
        Math.min(u + 0.138, f.length),
        15.9,
        17.64,
        -0.13,
        0.1,
        cream,
      );
    }
    panel(out, 'soffit', f, 0.02, f.length - 0.02, 17.13, 17.56, eaveWood, -0.065);
    if (lod > 0) panel(out, 'dark', f, 0.04, f.length - 0.03, 16.21, 17.12, recess, -0.59);
  }
  hippedRoof(out, cx, 13.21, 7.04, 6.12, 17.42, 3.0, lod);
}

function pavilions(out, lod) {
  const ends = [
    [-29.79, -22.24, 3.05, 16.79],
    [25.97, 33.46, 3.12, 17.07],
  ];
  for (const [x0, x1, z0, z1] of ends) {
    const x = (x0 + x1) / 2,
      z = (z0 + z1) / 2;
    const high = 12.13;
    flatBand(out, x0, x1, z0, z1, floorEave - 0.04, high, wall, 'wall');
    const f = facade([x, z1], [1, 0]);
    course(out, f, x0 - x - 0.04, x1 - x + 0.04, 11.42, 11.64, 0.22);
    for (const p of [-1.97, 0, 1.97]) glazed(out, f, p, 10.98, 0.87, 0.57, lod, { transoms: 0 });
    hippedRoof(out, x, z, (x1 - x0) / 2 + 0.65, (z1 - z0) / 2 + 0.48, high + 0.01, 2.51, lod, {
      hips: 0.27,
    });
  }
  hippedRoof(out, -13.34, 5.59, 10.04, 11.82, 10.74, 2.52, lod, { hips: 0.57, faded: true });
  hippedRoof(out, 17.77, 5.72, 9.32, 11.77, 10.74, 2.41, lod, { hips: 0.57, faded: true });
}

function build(out, lod) {
  exterior(out, lod);
  facadeWing(out, { min: -29.73, max: -4.79, z: 16.802, bays: 5 }, lod);
  facadeWing(out, { min: 8.88, max: 33.41, z: 17.075, bays: 5 }, lod);
  portico(out, lod);
  mainTower(out, lod);
  pavilions(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kaohsiung-museum-of-history-model.mjs';
const camera = [64, 24, 101];
const lookAt = [cx, 7.84, 6];
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
    'The former 1939 Kaohsiung City Hall with cream elevations and three green-tiled pavilions over a symmetrical civic front.',
  camera,
  lookAt,
  sunDirection: [43, 65, 54],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The heritage building’s contemporary mapped perimeter.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_weathered',
    'stone_ashlar',
    'tile_glazed',
    'wood_plain',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'central-pavilion-and-civic-front', position: [3, 12.7, 88], lookAt: [2.04, 8.58, 17] },
    {
      name: 'portico-stairs-and-plastered-pilasters',
      position: [23, 8.8, 48],
      lookAt: [2.05, 5.0, 21.2],
    },
    { name: 'side-pavilion-and-the-rear-offices', position: [67, 36, -60], lookAt: [6, 8.7, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kaohsiung-former-city-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.043, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model. Public-domain postcards from the National Museum of Taiwan History, native OpenStreetMap ODbL footprint, and attributed Taiwan Ministry of the Interior elevation data.',
};
