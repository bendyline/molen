import fs from 'node:fs';
import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  foundation,
  terrace,
  mainFloor,
  centerEave,
  centralRidge,
  linkEave,
  pavilionEave,
  pavilionTop,
} = plan.dimensions;
const ashlar = rgb('bbb096');
const cream = rgb('c7bca0');
const mild = rgb('b0a38a');
const dark = rgb('9a8b72');
const basement = rgb('a49880');
const slate = rgb('697167');
const glass = rgb('68716a');
const darkGlass = rgb('4b5048');
const timber = rgb('52493b');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
};
const centerWidth = 18.44;
const links = [18.44, 30.3];
const north = facade([0, -13.045], [-1, 0]);
const south = facade([0, 13.36], [1, 0]);

function volume(out, x0, x1, z0, z1, y, roofHeight, roofInset) {
  abox(out, 'base', [x0, foundation, z0], [x1, mainFloor - 0.05, z1], basement, { bottom: false });
  abox(out, 'wall', [x0, mainFloor - 0.09, z0], [x1, y, z1], ashlar, { bottom: false });
  const ring = (a, b, c, d, h) => [
    [a, h, c],
    [a, h, d],
    [b, h, d],
    [b, h, c],
  ];
  const [ix, iz] = roofInset;
  loft(
    out,
    'roof',
    [
      ring(x0 + 0.21, x1 - 0.21, z0 + 0.18, z1 - 0.18, y - 0.08),
      ring(x0 + ix, x1 - ix, z0 + iz, z1 - iz, roofHeight),
    ],
    slate,
    { cap: true },
  );
}

function pane(out, f, u, y, w, h, lod, opts = {}) {
  opening(out, f, u, y, w, h, {
    glassSlot: opts.door ? 'door' : 'glass',
    frameSlot: 'trim',
    glass: opts.door ? timber : (opts.tint ?? glass),
    frame: cream,
    d: opts.depth ?? 0.037,
    head: opts.arc ? 'round' : 'flat',
    frameWidth: lod === 3 && opts.edge !== false ? 0.093 : 0,
    frameDepth: 0.12,
    sill: lod === 3 && opts.edge !== false && !opts.door,
    mullions: lod > 1 ? (opts.mullions ?? 1) : 0,
    transoms: lod > 1 ? (opts.transoms ?? 1) : 0,
  });
}

function pediment(out, f, u, y, half, rise, d, lod) {
  const a = f.P(u - half, y, d),
    b = f.P(u + half, y, d),
    c = f.P(u, y + rise, d);
  tri(out, 'trim', a, b, c, mild);
  fbox(
    out,
    'trim',
    f,
    u - half - 0.1,
    u + half + 0.1,
    y - 0.13,
    y + 0.039,
    d - 0.17,
    d + 0.07,
    cream,
  );
  const lift = ([x, y, z]) => [x, y + (half > 6 ? 0.29 : 0.1), z];
  quad4(out, 'trim', a, c, lift(c), lift(a), cream);
  quad4(out, 'trim', c, b, lift(b), lift(c), cream);
  if (lod > 1 && half > 6) {
    const t = (x, y) => f.P(u + x, y, d + 0.044);
    quad4(
      out,
      'trim',
      t(-0.65, y + 0.44),
      t(0, y + 0.24),
      t(0.65, y + 0.44),
      t(0, y + 1.19),
      cream,
    );
  }
}

function parapet(out, f, u0, u1, y, h, lod, d = 0.13, decorated = false) {
  if (lod === 0) {
    fbox(out, 'trim', f, u0, u1, y, y + h, -0.1, d, cream);
    return;
  }
  fbox(out, 'trim', f, u0, u1, y, y + 0.16, -0.09, d, cream);
  fbox(out, 'trim', f, u0, u1, y + h - 0.15, y + h, -0.14, d + 0.053, cream);
  const sep = lod === 3 ? 0.4 : lod === 2 ? 0.6 : 1.8;
  const count = Math.max(1, Math.ceil((u1 - u0) / sep));
  for (let i = 0; i <= count; i++) {
    const u = u0 + ((u1 - u0) * i) / count;
    const w = i % 5 === 0 ? 0.107 : 0.04;
    fbox(out, 'trim', f, u - w, u + w, y + 0.11, y + h - 0.11, -0.056, d - 0.026, cream);
  }
  if (!decorated || lod < 2) return;
  for (const u of [u0 + 0.45, (u0 + u1) / 2, u1 - 0.45]) {
    fbox(out, 'trim', f, u - 0.31, u + 0.31, y + h - 0.08, y + h + 0.36, -0.2, d + 0.05, mild);
    fbox(out, 'trim', f, u - 0.16, u + 0.16, y + h + 0.31, y + h + 0.65, -0.14, d - 0.04, cream);
  }
}

function entablature(out, f, u0, u1, y, lod, projection = 0.24) {
  if (lod === 0 || lod === 1) {
    fbox(out, 'trim', f, u0, u1, y - 0.63, y + 0.16, -0.11, projection + 0.23, cream);
    return;
  }
  for (const [d, h, lip] of [
    [-0.62, 0.27, 0.1],
    [-0.34, 0.34, 0.2],
    [-0.01, 0.17, 0.27],
  ]) {
    fbox(out, 'trim', f, u0, u1, y + d, y + d + h, -0.12, projection + lip, cream);
  }
  if (lod > 1) {
    const n = Math.max(1, Math.round((u1 - u0) / 0.8));
    for (let i = 0; i < n; i++) {
      const u = u0 + ((i + 0.5) * (u1 - u0)) / n;
      fbox(out, 'trim', f, u - 0.098, u + 0.098, y - 0.6, y - 0.35, 0.018, projection + 0.16, mild);
    }
  }
}

function column(out, f, u, y0, y1, lod) {
  if (lod === 0) {
    fbox(out, 'trim', f, u - 0.33, u + 0.33, y0, y1, 0.05, 0.83, cream);
    return;
  }
  const depth = 0.53,
    r = 0.34;
  fbox(out, 'trim', f, u - 0.52, u + 0.52, y0, y0 + 0.41, 0.01, 1.06, cream);
  const sides = [5, 6, 9, 13][lod];
  const profile = [
    [y0 + 0.39, 0.46],
    [y0 + 0.58, r],
    [y1 - 0.49, r * 0.83],
    [y1 - 0.26, 0.39],
    [y1 - 0.13, 0.46],
  ];
  loft(
    out,
    'trim',
    profile.map(([y, r]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (-Math.PI * 2 * i) / sides;
        return f.P(u + r * Math.cos(a), y, depth + r * Math.sin(a));
      }),
    ),
    cream,
    { cap: false },
  );
  fbox(out, 'trim', f, u - 0.52, u + 0.52, y1 - 0.18, y1 + 0.11, 0.06, 1.06, cream);
}

function venetian(out, f, u, y, lod, depth = 0.037) {
  pane(out, f, u, y, 1.99, 5.09, lod, {
    arc: true,
    depth,
    mullions: 2,
    transoms: 3,
    tint: darkGlass,
  });
  for (const j of [-1, 1]) {
    pane(out, f, u + j * 1.42, y, 0.68, 3.94, lod, { depth, mullions: 0, transoms: 3 });
    fbox(
      out,
      'trim',
      f,
      u + j * 1.02 - 0.087,
      u + j * 1.02 + 0.087,
      y - 0.09,
      y + 3.92,
      0.016,
      0.17,
      cream,
    );
  }
  fbox(out, 'trim', f, u - 2.03, u + 2.03, y - 0.22, y - 0.08, -0.034, 0.23, cream);
}

function northApproach(out, lod) {
  const n = lod === 0 ? 2 : 6;
  for (let i = 0; i < n; i++) {
    const y = mainFloor - ((i + 1) * (mainFloor - 0.04)) / n;
    fbox(
      out,
      'trim',
      north,
      -4.25 - i * 0.06,
      4.25 + i * 0.06,
      -1.22,
      y,
      0.69 + i * 0.28,
      0.97 + i * 0.28,
      cream,
    );
  }
  fbox(out, 'trim', north, -4.21, 4.21, terrace, mainFloor, -0.12, 0.71, cream);
}

function gardenStair(out, lod) {
  fbox(out, 'base', south, -5.23, 5.23, foundation, mainFloor, -0.08, 4.51, ashlar);
  fbox(out, 'trim', south, -5.28, 5.28, mainFloor - 0.17, mainFloor, 0, 4.62, cream);
  const n = lod === 0 ? 2 : lod === 1 ? 9 : 18;
  for (const side of [-1, 1]) {
    const f = facade([side * 5.19, 16.25], [0, -side]);
    for (let i = 0; i < n; i++) {
      const y = mainFloor - ((i + 1) * (mainFloor + 0.79)) / n;
      fbox(
        out,
        'trim',
        f,
        -1.07,
        1.07,
        terrace - 0.64,
        y,
        (i * 7.2) / n,
        ((i + 1) * 7.2) / n,
        cream,
      );
    }
  }
  if (lod === 0) return;
  const f = facade([0, 17.885], [1, 0]);
  parapet(out, f, -5.22, 5.22, mainFloor, 0.74, lod);
  for (const u of [-3.3, 0, 3.3])
    pane(out, f, u, -0.55, 1.22, 1.36, lod, { depth: 0.058, tint: darkGlass });
}

function central(out, lod) {
  volume(out, -centerWidth, centerWidth, -13.04, 13.36, centerEave, centralRidge, [2.8, 5.25]);
  for (const f of [north, south]) {
    entablature(out, f, -centerWidth, centerWidth, centerEave, lod, 0.3);
    parapet(out, f, -centerWidth, centerWidth, centerEave + 0.17, 0.98, lod, 0.14, true);
  }
  pediment(out, north, 0, centerEave + 0.29, 10.25, 3.09, 0.62, lod);
  for (const u of [-9.48, -5.73, -1.91, 1.91, 5.73, 9.48])
    column(out, north, u, mainFloor - 0.01, centerEave - 0.46, lod);
  for (const x of [-17.15, -12.68, 12.68, 17.15]) {
    fbox(
      out,
      'trim',
      north,
      x - 0.21,
      x + 0.21,
      mainFloor - 0.05,
      centerEave - 0.42,
      -0.02,
      0.18,
      cream,
    );
  }
  for (const f of [north, south]) {
    for (let j = -4; j <= 4; j++) {
      const u = j * 4.08;
      pane(out, f, u, j === 0 ? mainFloor : 2.12, 1.72, j === 0 ? 4.18 : 3.66, lod, {
        door: j === 0,
        arc: j === 0,
        tint: glass,
        transoms: 2,
      });
      if (lod === 0) continue;
      pane(out, f, u, 8.46, 1.49, 2.16, lod, { mullions: 1 });
      if (j !== 0) pediment(out, f, u, 6.12, 1.11, Math.abs(j) > 2 ? 0.32 : 0.24, 0.19, lod);
      if (f === south && j < 4)
        fbox(out, 'trim', f, u + 1.89, u + 2.22, mainFloor, centerEave - 0.48, 0.006, 0.24, cream);
      if (f === south && lod > 1 && Math.abs(j) > 1)
        for (const z of [-0.92, 0.92])
          pane(out, f, u + z, -0.72, 0.79, 1.49, lod, { edge: false, tint: darkGlass });
    }
  }
  for (const x of [-16.85, 16.82]) {
    for (const z of [-6.1, 6.25]) {
      abox(
        out,
        'wall',
        [x - 0.87, centerEave - 0.1, z - 0.83],
        [x + 0.87, centralRidge + 0.25, z + 0.83],
        mild,
        { bottom: false },
      );
      abox(
        out,
        'trim',
        [x - 1.0, centralRidge + 0.12, z - 0.94],
        [x + 1.0, centralRidge + 0.35, z + 0.94],
        cream,
        { bottom: false },
      );
    }
  }
  northApproach(out, lod);
  gardenStair(out, lod);
}

function wings(out, lod) {
  for (const side of [-1, 1]) {
    const interval = (a, b) => [Math.min(a * side, b * side), Math.max(a * side, b * side)];
    const [a, b] = interval(...links);
    const [c, d] = interval(30.3, 39.16);
    const zNorth = -13.065;
    volume(out, a, b, zNorth, 12.42, linkEave, linkEave + 1.03, [2.11, 4.82]);
    volume(out, c, d, zNorth - 0.12, 13.36, pavilionEave, pavilionTop - 1.2, [1.7, 3.0]);
    const mid = (c + d) / 2;
    for (const f of [facade([0, zNorth], [-1, 0]), facade([0, 12.42], [1, 0])]) {
      entablature(out, f, a, b, linkEave, lod);
      parapet(out, f, a, b, linkEave + 0.17, 0.69, lod);
      if (lod === 0) continue;
      for (let j = 0; j < 3; j++) {
        const u = a + ((j + 0.5) * (b - a)) / 3;
        pane(out, f, u, 2.38, 1.68, 3.44, lod, { arc: f.normal[1] > 0, mullions: 1, transoms: 2 });
        if (lod > 0) pediment(out, f, u, 6.05, 0.96, 0.31, 0.18, lod);
      }
    }
    for (const f of [facade([0, zNorth - 0.12], [-1, 0]), south]) {
      entablature(out, f, c, d, pavilionEave, lod, 0.17);
      entablature(out, f, c, d, pavilionEave - 4.57, lod, 0.07);
      parapet(out, f, c, d, pavilionEave + 0.13, 0.9, lod, 0.16, true);
      if (lod === 0) pane(out, f, mid, 2.75, 2.0, 5.09, lod, { arc: true });
      else venetian(out, f, mid, 2.75, lod);
      for (const u of [mid - 1.01, mid + 1.01])
        pane(out, f, u, 12.08, 1.47, 1.85, lod, { transoms: 1 });
    }
    const outerX = Math.max(Math.abs(c), Math.abs(d)) * side;
    const end = facade([outerX, 0.12], [0, -side]);
    entablature(out, end, -13.0, 13.05, pavilionEave, lod);
    parapet(out, end, -13.0, 13.05, pavilionEave + 0.14, 0.8, lod, 0.14, true);
    if (lod > 0) {
      venetian(out, end, 0, 2.72, lod);
      for (const u of [-9.1, -4.7, 4.7, 9.1]) {
        pane(out, end, u, 2.79, 1.48, 3.51, lod, { transoms: 2 });
        pane(out, end, u, 11.85, 1.43, 1.65, lod);
      }
    }
    for (const z of [-7.67, 7.7]) {
      abox(
        out,
        'wall',
        [mid - 1.33, pavilionEave - 0.23, z - 0.58],
        [mid + 1.33, pavilionTop - 0.1, z + 0.58],
        ashlar,
        { bottom: false },
      );
      abox(
        out,
        'trim',
        [mid - 1.41, pavilionTop - 0.24, z - 0.69],
        [mid + 1.41, pavilionTop - 0.03, z + 0.69],
        cream,
        { bottom: false },
      );
    }
  }
}

function build(out, lod) {
  central(out, lod);
  wings(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'harewood-house-model.mjs';
const camera = [53, 24, -76];
const lookAt = [0, 7, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Harewood House with its nine-bay Palladian center, columned pediment, Venetian-window pavilions, and attached double garden stair.',
  camera,
  lookAt,
  sunDirection: [-30, 71, -54],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outwardRing(frame.geometry.outline),
    minimumCoverage: 0.92,
    basis: 'The individually named Harewood House outline.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-pediment-and-pavilions', position: camera, lookAt },
    { name: 'south-terrace-and-double-stair', position: [-48, 15, 62], lookAt: [0, 6, 6] },
    { name: 'venetian-window-and-balustrade', position: [43, 5.4, -34], lookAt: [34, 7, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'harewood-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
