import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const controls = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/grenada-national-museum-shape-controls');
const outline = outwardRing(shape.outline);
const monckton = wallFace(...shape.cornerMoncktonFacade);
const young = wallFace(...shape.youngStreetFacade);
const west = wallFace(...shape.balconyMoncktonFacade);
const eave = shape.cornerEaveHeight;
const balconyDeck = shape.balconyDeckHeight;
const wingEave = shape.balconyWingEaveHeight;
const surfaces = {
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.93 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  plinth: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.12 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};
const warmLime = rgb('d4b27c');
const ochre = rgb('b99164');
const ivory = rgb('ddd0af');
const finePlaster = rgb('d9c29b');
const brick = rgb('946b55');
const zinc = rgb('75534f');
const awning = rgb('655751');
const wood = rgb('53483b');
const shutter = rgb('69654c');
const glass = rgb('52524b');
const iron = rgb('534e3c');
const foundation = rgb('9d8b73');

function strip(out, f, y, h, d, color = ivory, from = 0, to = f.length, slot = 'trim') {
  fbox(out, slot, f, from, to, y, y + h, -0.06, d, color);
}

function glazed(out, f, u, y, w, h, level, kind = 'window') {
  const doorway = kind === 'door';
  const vent = kind === 'vent';
  const mullioned = kind === 'window';
  const material = doorway || vent ? 'timber' : 'glass';
  const color = doorway ? wood : vent ? shutter : glass;
  if (level === 1) {
    quad4(
      out,
      material,
      f.P(u - w / 2, y, 0.037),
      f.P(u + w / 2, y, 0.037),
      f.P(u + w / 2, y + h, 0.037),
      f.P(u - w / 2, y + h, 0.037),
      color,
    );
    return;
  }
  opening(out, f, u, y, w, h, {
    head: vent ? 'round' : 'flat',
    glassSlot: material,
    frameSlot: 'trim',
    glass: color,
    frame: ivory,
    frameWidth: vent ? 0.075 : 0.112,
    frameDepth: 0.13,
    d: 0.031,
    sill: !doorway,
    mullions: mullioned && level === 3 ? 1 : 0,
    transoms: mullioned ? 1 : 0,
    mullionColor: finePlaster,
  });
  if (level >= 3 && (vent || mullioned)) {
    const bandHeight = vent ? h * 0.67 : h * 0.4;
    const bandCount = vent ? 6 : 5;
    fbox(
      out,
      'timber',
      f,
      u - w * 0.4,
      u + w * 0.4,
      y + 0.09,
      y + bandHeight,
      0.066,
      0.085,
      shutter,
    );
    for (let i = 1; i < bandCount; i++) {
      const h0 = y + (i * bandHeight) / bandCount;
      fbox(out, 'timber', f, u - w * 0.39, u + w * 0.39, h0, h0 + 0.023, 0.08, 0.103, wood);
    }
  }
}

function foundationWall(out, f, a, b) {
  const h0 = a + 0.37;
  const h1 = b + 0.37;
  quad4(
    out,
    'plinth',
    f.P(0, -3.19, 0.023),
    f.P(f.length, -3.19, 0.023),
    f.P(f.length, h1, 0.023),
    f.P(0, h0, 0.023),
    foundation,
  );
  quad4(
    out,
    'plinth',
    f.P(0, h0, 0.023),
    f.P(f.length, h1, 0.023),
    f.P(f.length, h1, -0.05),
    f.P(0, h0, -0.05),
    foundation,
  );
}

function cornerWalls(out, level) {
  foundationWall(out, monckton, -1.52, 0.01);
  foundationWall(out, young, 0.05, 0.68);
  for (const f of [monckton, young]) {
    strip(out, f, eave - 0.22, 0.16, 0.22, finePlaster);
    strip(out, f, eave - 0.064, 0.106, 0.27, ivory);
  }
  if (level === 0) return;
  for (const [u, base, w] of [
    [2.41, -1.39, 1.01],
    [7.06, -0.92, 1.0],
    [12.68, -0.29, 1.22],
    [17.22, 0.24, 1.1],
  ]) {
    glazed(out, monckton, u, 3.68, 1.01, 1.89, level);
    if (level >= 2)
      glazed(out, monckton, u, base + 0.15, w, 2.37, level, u === 12.68 ? 'door' : 'window');
  }
  for (let i = 0; i < 6; i++) {
    const u = 1.13 + i * 2.21;
    const base = 0.03 + (u / young.length) * 0.65;
    glazed(out, young, u, 3.67, 1.01, 1.86, level);
    if (level >= 2)
      glazed(out, young, u, base + 0.31, 0.99, 2.3, level, i === 1 || i === 4 ? 'door' : 'window');
  }
  if (level >= 2) {
    strip(out, monckton, 2.53, 0.27, 0.17, ochre, 11.76, 13.6);
    for (const [f, u, height] of [
      [monckton, 12.68, -0.14],
      [young, 3.34, 0.4],
      [young, 9.97, 0.72],
    ])
      fbox(out, 'plinth', f, u - 0.74, u + 0.74, height - 0.21, height, 0.009, 0.46, foundation, {
        bottom: true,
      });
  }
}

function gabledCorner(out, level) {
  const ranges = [
    [-16.744, -7.3, eave + 1.98],
    [-7.3, 3.325, shape.cornerGablePeak],
  ];
  for (const [a, b, ridge] of ranges) {
    const c = (a + b) / 2;
    gableRoof(out, 'roof', [c, -12.399], [c, -1.05], b - a, eave, ridge, zinc, {
      overhang: 0.19,
      endSlot: 'stucco',
      endColor: warmLime,
    });
    const f = wallFace([a, -1.042], [b, -1.042]);
    if (level >= 1) {
      for (const [dx, sy, h] of [
        [-0.73, eave + 0.17, 0.8],
        [0, eave + 0.19, 1.28],
        [0.73, eave + 0.17, 0.8],
      ])
        glazed(out, f, f.length / 2 + dx, sy, 0.43, h, Math.max(level, 2), 'vent');
      strip(out, f, eave + 0.07, 0.16, 0.17, ivory, f.length / 2 - 1.15, f.length / 2 + 1.15);
    }
    if (level >= 2) {
      for (const [aU, bU, aY, bY] of [
        [-0.21, f.length / 2, eave, ridge],
        [f.length / 2, f.length + 0.21, ridge, eave],
      ]) {
        quad4(
          out,
          'trim',
          f.P(aU, aY - 0.07, 0.21),
          f.P(bU, bY - 0.07, 0.21),
          f.P(bU, bY + 0.1, 0.21),
          f.P(aU, aY + 0.1, 0.21),
          ivory,
        );
      }
    }
  }
  quad4(
    out,
    'roof',
    [-4.54, eave + 0.12, -14.94],
    [-4.54, eave + 0.39, -12.35],
    [3.46, eave + 0.39, -12.35],
    [3.46, eave + 0.12, -14.94],
    zinc,
  );
}

function wingRoof(out) {
  const front = [-25.88, wingEave, -1.11];
  const rear = [-25.74, wingEave, -12.55];
  const inner = [-16.58, wingEave, -12.53];
  const innerFront = [-16.56, wingEave, -0.86];
  const highA = [-23.7, wingEave + 2.02, -6.6];
  const highB = [-18.36, wingEave + 2.02, -6.6];
  quad4(out, 'roof', front, innerFront, highB, highA, zinc);
  quad4(out, 'roof', inner, rear, highA, highB, zinc);
  tri(out, 'roof', rear, front, highA, zinc);
  tri(out, 'roof', innerFront, inner, highB, zinc);
}

function bars(out, f, u, v, y, h, d, w, color = iron) {
  const len = Math.hypot(v - u, h - y);
  const ux = (((y - h) / len) * w) / 2,
    uy = (((v - u) / len) * w) / 2;
  const p = [
    f.P(u - ux, y - uy, d),
    f.P(v - ux, h - uy, d),
    f.P(v + ux, h + uy, d),
    f.P(u + ux, y + uy, d),
  ];
  quad4(out, 'iron', ...p, color);
  quad4(out, 'iron', ...p.reverse(), color);
}

function balconyRail(out, f, level) {
  const n = level === 1 ? 11 : Math.ceil(f.length / 0.235);
  strip(out, f, balconyDeck + 0.91, 0.061, 0.12, iron, 0, f.length, 'iron');
  strip(out, f, balconyDeck + 0.12, 0.054, 0.1, iron, 0, f.length, 'iron');
  if (level === 0) {
    strip(out, f, balconyDeck + 0.17, 0.69, 0.081, iron, 0, f.length, 'iron');
    return;
  }
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * f.length) / n;
    bars(out, f, u, u, balconyDeck + 0.16, balconyDeck + 0.92, 0.086, 0.059);
    if (level === 3) {
      bars(out, f, u - 0.108, u + 0.1, balconyDeck + 0.32, balconyDeck + 0.64, 0.092, 0.027);
      bars(out, f, u + 0.1, u - 0.108, balconyDeck + 0.32, balconyDeck + 0.64, 0.093, 0.027);
    }
  }
}

function balconyWing(out, level) {
  extrude(out, 'brick', shape.balconyWing, -3.19, wingEave, brick, { top: false });
  fbox(out, 'stucco', west, 0, west.length, -3.19, wingEave, -0.09, 0.012, warmLime);
  wingRoof(out);
  foundationWall(out, west, -2.7, -1.47);
  strip(out, west, wingEave - 0.19, 0.19, 0.24, ivory);
  strip(out, west, 6.64, 0.11, 0.14, finePlaster);
  const depth = 1.51;
  const roofY = balconyDeck + 2.65;
  fbox(
    out,
    'trim',
    west,
    -0.11,
    west.length + 0.07,
    balconyDeck - 0.24,
    balconyDeck + 0.045,
    -0.17,
    depth + 0.18,
    ochre,
    { bottom: true },
  );
  strip(out, west, balconyDeck - 0.13, 0.12, depth + 0.26, ivory, -0.13, west.length + 0.08);
  quad4(
    out,
    'roof',
    west.P(-0.19, roofY, depth + 0.21),
    west.P(west.length + 0.1, roofY, depth + 0.21),
    west.P(west.length + 0.1, roofY + 0.49, -0.07),
    west.P(-0.19, roofY + 0.49, -0.07),
    awning,
  );
  fbox(
    out,
    'iron',
    west,
    -0.14,
    west.length + 0.08,
    roofY - 0.15,
    roofY,
    depth + 0.08,
    depth + 0.23,
    iron,
  );
  const point = (u, d) => {
    const [x, , z] = west.P(u, 0, d);
    return [x, z];
  };
  const inFront = wallFace(point(0, depth), point(west.length, depth));
  balconyRail(out, inFront, level);
  balconyRail(out, wallFace(point(0, 0), point(0, depth)), level);
  balconyRail(out, wallFace(point(west.length, depth), point(west.length, 0)), level);
  for (let j = 0; j <= 4; j++) {
    const u = (west.length * j) / 4;
    fbox(
      out,
      'iron',
      west,
      u - 0.064,
      u + 0.064,
      balconyDeck + 0.044,
      roofY - 0.11,
      depth - 0.069,
      depth + 0.065,
      iron,
    );
    if (level >= 2) {
      fbox(
        out,
        'iron',
        west,
        u - 0.104,
        u + 0.104,
        balconyDeck + 0.056,
        balconyDeck + 0.223,
        depth - 0.105,
        depth + 0.112,
        iron,
      );
      fbox(
        out,
        'iron',
        west,
        u - 0.113,
        u + 0.113,
        roofY - 0.31,
        roofY - 0.14,
        depth - 0.105,
        depth + 0.112,
        iron,
      );
      if (j < 4) bars(out, inFront, u, u + 0.39, roofY - 0.57, roofY - 0.16, 0.091, 0.065);
      if (j > 0) bars(out, inFront, u - 0.39, u, roofY - 0.16, roofY - 0.57, 0.091, 0.065);
    }
  }
  if (level >= 1)
    for (let i = 0; i < 4; i++) {
      const u = ((i + 0.5) * west.length) / 4;
      glazed(out, west, u, 7.02, 1.0, 1.62, level);
      if (level >= 2) {
        glazed(
          out,
          west,
          u,
          balconyDeck + 0.21,
          1.12,
          2.13,
          level,
          i === 1 || i === 2 ? 'door' : 'window',
        );
        glazed(out, west, u, -1.99 + i * 0.22, 1.21, 2.3, level, i === 1 ? 'door' : 'window');
      }
    }
}

function build(out, level) {
  extrude(out, 'stucco', shape.corner, -3.19, eave + 0.005, warmLime, { top: false });
  abox(out, 'stucco', [-4.54, eave, -14.81], [3.324, eave + 0.12, -12.42], warmLime);
  gabledCorner(out, level);
  cornerWalls(out, level);
  balconyWing(out, level);
  if (level >= 2) {
    const rear = wallFace([-4.536, -14.812], [-4.532, -12.394]);
    glazed(out, rear, rear.length * 0.53, 3.45, 0.71, 1.36, level);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'grenada-national-museum-model.mjs';
const camera = [38, 19, 42];
const lookAt = [-10, 4.5, -4];
export const model = {
  id: controls.model,
  key: controls.model,
  title: controls.title,
  cell: controls.cell,
  recipe,
  wikidataId: controls.wikidataId,
  category: 'historic-museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The former Home Hotel corner with twin gables, timber shutters and an adjoining iron-balcony wing on Grenada’s Monckton and Young Streets.',
  camera,
  lookAt,
  sunDirection: [28, 41, 24],
  mediumFiContext: {
    scale: 1.07,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis:
      'Mapped corner museum and immediately attached balcony wing at the Young Street junction.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: controls.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'young-and-monckton-corner', position: [19, 8.8, 20], lookAt: [-4, 4.3, -3] },
    { name: 'twin-gables-and-iron-balcony', position: [-17, 8.5, 25], lookAt: [-13, 4.6, -1] },
    { name: 'young-street-return-and-grade', position: [28, 11, -15], lookAt: [1, 4.7, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'grenada-national-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' +
      controls.cell +
      '/' +
      controls.model +
      '/models/' +
      recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.34,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.066, surfaces },
    },
  },
};
