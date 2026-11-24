import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.84 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.58 },
};
const wall = rgb('9b8d74');
const darkWall = rgb('817863');
const ashlar = rgb('b8a58a');
const granite = rgb('827e77');
const red = rgb('82524f');
const ridgeColor = rgb('633c3c');
const frameRed = rgb('764b40');
const glass = rgb('464841');
const iron = rgb('403d37');

function box(out, slot, u0, u1, z0, z1, y0, y1, color) {
  abox(out, slot, [u0, y0, z0], [u1, y1, z1], color, { bottom: false });
}

function hippedRoof(out, rectangle, eave, peak, inset, color = red) {
  const [x0, x1, z0, z1] = rectangle;
  let base = [
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
    [x0, eave, z0],
  ];
  if (z1 - z0 > x1 - x0) base = [...base.slice(1), base[0]];
  const [a, b, c, d] = base;
  const ridge = (p, q, inward) => [
    (p[0] + q[0]) / 2 + inward * (b[0] - a[0]),
    peak,
    (p[2] + q[2]) / 2 + inward * (b[2] - a[2]),
  ];
  const l = ridge(a, d, inset);
  const r = ridge(b, c, -inset);
  quad4(out, 'slate', a, b, r, l, color);
  quad4(out, 'slate', c, d, l, r, color);
  tri(out, 'slate', b, c, r, color);
  tri(out, 'slate', d, a, l, color);
  for (let i = 0; i < 4; i++) {
    const p = base[i];
    const q = base[(i + 1) % 4];
    quad4(out, 'trim', [p[0], eave - 0.22, p[2]], [q[0], eave - 0.22, q[2]], q, p, ashlar);
  }
  const edge = wallFace([l[0], l[2]], [r[0], r[2]]);
  fbox(
    out,
    'slate',
    edge,
    -0.045,
    edge.length + 0.045,
    peak - 0.055,
    peak + 0.135,
    -0.105,
    0.105,
    ridgeColor,
  );
}

function sash(out, F, u, y, w, h, level, head) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    glass,
    frameSlot: 'timber',
    frame: frameRed,
    frameWidth: level >= 2 ? 0.105 : 0.07,
    frameDepth: 0.082,
    sill: level >= 2,
    d: 0.026,
    mullions: level >= 2 && w > 1.48 ? 1 : 0,
    transoms: level >= 2 ? 1 : 0,
    mullionColor: ashlar,
    ...(head ? { head } : {}),
  });
  if (level >= 2) {
    fbox(
      out,
      'trim',
      F,
      u - w / 2 - 0.13,
      u + w / 2 + 0.13,
      y - 0.11,
      y + 0.015,
      -0.01,
      0.19,
      ashlar,
    );
    for (const dx of [-w / 2 - 0.073, w / 2 + 0.073])
      fbox(out, 'trim', F, u + dx - 0.05, u + dx + 0.05, y + 0.03, y + h - 0.16, 0, 0.064, ashlar);
  }
}

function facadeDetails(out, shell, level) {
  const ring = outwardRing(shell);
  for (const [i, p] of ring.entries()) {
    const F = wallFace(p, ring[(i + 1) % ring.length]);
    if (F.length < 1.67) continue;
    const isMain = F.normal[1] < -0.53;
    const spacing = level === 1 ? 4.75 : isMain ? 3.01 : 2.69;
    const count = Math.max(1, Math.round(F.length / spacing));
    for (let j = 0; j < count; j++) {
      const u = (F.length * (j + 0.5)) / count;
      const [x, , z] = F.P(u, 0);
      if (z < -8 && x > -4.75 && x < 2.85) continue;
      const width = F.length < 2.35 ? 1.0 : 1.28;
      sash(out, F, u, 0.93, width, 2.25, level);
      sash(out, F, u, 4.63, width, 2.38, level);
      sash(out, F, u, 8.31, width, 2.21, level);
    }
    if (level >= 2) fbox(out, 'trim', F, 0, F.length, 3.65, 3.76, 0, 0.072, ashlar);
  }
}

function gabledDormer(out, x, z, dir, width, y, height, level) {
  const face = facade([x, z], [dir, 0]);
  const half = width / 2;
  const ridge = y + height;
  const top = ridge - 0.63;
  fbox(out, 'sandstone', face, -half, half, y - 0.16, top, -1.46, 0.042, wall);
  const [a, b, c] = [face.P(-half, top, 0.052), face.P(half, top, 0.052), face.P(0, ridge, 0.052)];
  tri(out, 'sandstone', a, b, c, wall);
  const peakAt = (d) => [x, z + dir * d];
  gableRoof(out, 'slate', peakAt(0.16), peakAt(-1.52), width, top + 0.04, ridge + 0.08, red, {
    overhang: 0.1,
  });
  for (const sign of [-1, 1]) {
    quad4(
      out,
      'trim',
      face.P(0, ridge - 0.14, 0.071),
      face.P(sign * half, top - 0.09, 0.071),
      face.P(sign * half, top + 0.04, 0.071),
      face.P(0, ridge + 0.045, 0.071),
      ashlar,
    );
  }
  if (level >= 1) sash(out, face, 0, y + 0.26, width * 0.51, height * 0.54, level, 'round');
  if (level >= 2) {
    for (const sign of [-1, 1])
      fbox(
        out,
        'trim',
        face,
        sign * half - 0.09,
        sign * half + 0.09,
        top - 0.42,
        top + 0.15,
        -0.045,
        0.122,
        ashlar,
      );
  }
}

function circularTower(out, level) {
  const X = -0.14,
    Z = -8.88;
  const sides = [10, 12, 18, 24][level];
  lathe(
    out,
    'sandstone',
    [X, Z],
    [
      [-0.91, 2.43, 2.41],
      [0.5, 2.37, 2.39],
      [12.0, 2.37, 2.39],
      [13.71, 2.53, 2.57],
      [15.05, 2.53, 2.57],
      [20.1, 2.23, 2.28],
    ],
    sides,
    wall,
  );
  lathe(
    out,
    'trim',
    [X, Z],
    [
      [13.08, 2.45, 2.48],
      [13.82, 2.92, 2.96],
      [14.1, 2.92, 2.96],
      [14.2, 2.79, 2.83],
    ],
    sides,
    ashlar,
  );
  lathe(
    out,
    'slate',
    [X, Z],
    [
      [19.45, 2.56, 2.6],
      [20.24, 2.29, 2.31],
      [23.03, 1.41, 1.42],
      [25.36, 0.61, 0.61],
      [26.29, 0.25, 0.25],
      [27.18, 0, 0],
    ],
    sides,
    red,
  );
  if (level === 0) return;
  lathe(
    out,
    'trim',
    [X, Z],
    [
      [10.62, 2.36, 2.38],
      [10.64, 2.45, 2.48],
      [10.84, 2.45, 2.48],
      [10.86, 2.36, 2.38],
    ],
    sides,
    ashlar,
  );
  const radial = (a, r, y) => [X + Math.cos(a) * r, y, Z + Math.sin(a) * r];
  for (const a of [
    -Math.PI * 0.92,
    -Math.PI * 0.66,
    -Math.PI * 0.42,
    -Math.PI * 0.18,
    0.095 * Math.PI,
  ]) {
    const [x, , z] = radial(a, 2.365, 0);
    const [bx, , bz] = radial(a, 2.32, 0);
    const span = [Math.sin(a), -Math.cos(a)];
    const lower = facade([x, z], span);
    const upper = facade([bx, bz], span);
    sash(out, lower, 0, 7.97, 0.89, 2.14, level, 'round');
    sash(out, upper, 0, 14.65, 1.13, 3.48, level, 'round');
    if (level >= 2) fbox(out, 'trim', upper, 0.6, 0.79, 14.36, 20.13, -0.26, 0.054, ashlar);
  }
  const railN = level === 1 ? 10 : level === 2 ? 18 : 30;
  for (let i = 0; i < railN; i++) {
    const a = (2 * Math.PI * i) / railN;
    const b = (2 * Math.PI * (i + 1)) / railN;
    const p = radial(a, 2.78, 0);
    const q = radial(b, 2.78, 0);
    const F = wallFace([p[0], p[2]], [q[0], q[2]]);
    fbox(out, 'iron', F, 0, F.length, 14.92, 14.98, -0.035, 0.054, iron);
    if (level >= 2) fbox(out, 'iron', F, 0, 0.042, 14.18, 14.96, -0.026, 0.066, iron);
    const bracket = i % (level === 3 ? 3 : 2) === 0;
    if (bracket) fbox(out, 'trim', F, 0, 0.14, 13.24, 13.85, -0.25, 0.021, ashlar);
  }
}

function voussoirArch(out, F, u, width, spring, rise, deep, level) {
  const outerR = width / 2 + 0.44;
  const steps = level <= 1 ? 8 : 14;
  const center = (a, r, h, d) => F.P(u + r * Math.cos(a), spring + h * Math.sin(a), d);
  for (let i = 0; i < steps; i++) {
    const a = Math.PI * (1 - (i + 0.014) / steps);
    const b = Math.PI * (1 - (i + 1 - 0.014) / steps);
    const part = (d) => [
      center(a, width / 2, rise, d),
      center(b, width / 2, rise, d),
      center(b, outerR, rise + 0.35, d),
      center(a, outerR, rise + 0.35, d),
    ];
    const [v, w, x, y] = part(0);
    const [p, q, r, s] = part(-deep);
    const color = i % 3 === 1 ? ashlar : wall;
    quad4(out, 'trim', v, w, x, y, color);
    quad4(out, 'sandstone', s, r, q, p, darkWall);
    quad4(out, 'trim', w, v, p, q, ashlar);
    quad4(out, 'sandstone', y, x, r, s, wall);
  }
}

function carriagePorch(out, level) {
  const y = 0.04;
  const deep = 1.16;
  const front = facade([-1.17, -15.69], [-1, 0]);
  const side = facade([2.06, -13.14], [0, -1]);
  for (const F of [front, side]) {
    const sideWidth = F === front ? 3.71 : 3.24;
    for (const sign of [-1, 1]) {
      const a = sign * (sideWidth * 0.5 + 0.47);
      fbox(out, 'granite', F, a - 0.45, a + 0.45, y - 0.48, y + 0.48, -deep, 0.18, granite);
      fbox(out, 'sandstone', F, a - 0.47, a + 0.47, y + 0.47, 3.39, -deep, 0.044, wall);
      fbox(out, 'trim', F, a - 0.51, a + 0.51, 2.54, 2.78, -deep - 0.09, 0.105, ashlar);
    }
    voussoirArch(out, F, 0, sideWidth, 2.72, 1.55, deep, level);
    tri(
      out,
      'sandstone',
      F.P(-2.22, 4.06, 0.012),
      F.P(2.22, 4.06, 0.012),
      F.P(0, 6.86, 0.012),
      wall,
    );
    for (const sign of [-1, 1])
      quad4(
        out,
        'trim',
        F.P(0, 6.72, 0.048),
        F.P(sign * 2.33, 4.18, 0.048),
        F.P(sign * 2.34, 4.34, 0.048),
        F.P(0, 6.95, 0.048),
        ashlar,
      );
  }
  hippedRoof(out, [-4.65, 2.49, -15.98, -10.28], 4.5, 7.05, 0.27, rgb('73736f'));
  box(out, 'sandstone', -4.55, -3.74, -13.65, -11.04, -0.45, 4.56, darkWall);
  box(out, 'granite', -4.47, 2.14, -15.6, -10.31, -0.6, 0.02, granite);
  if (level >= 1) box(out, 'trim', -1.36, -1.02, -15.77, -15.54, 6.47, 7.18, ashlar);
}

function chimney(out, x, z, top, bottom, level, size = 0.75) {
  box(
    out,
    'sandstone',
    x - size,
    x + size,
    z - size * 0.67,
    z + size * 0.67,
    bottom,
    top - 0.12,
    darkWall,
  );
  box(
    out,
    'trim',
    x - size - 0.13,
    x + size + 0.13,
    z - size * 0.67 - 0.115,
    z + size * 0.67 + 0.115,
    top - 0.14,
    top + 0.16,
    ashlar,
  );
  if (level >= 2) {
    for (const dx of [-0.26, 0.26])
      lathe(
        out,
        'slate',
        [x + dx, z],
        [
          [top + 0.14, 0.196, 0.196],
          [top + 0.47, 0.157, 0.155],
        ],
        8,
        ridgeColor,
      );
  }
}

function build(out, level) {
  const shell = frame.geometry.outline.slice(2);
  extrude(out, 'granite', shell, -1.45, 1.08, granite, { top: false });
  extrude(out, 'sandstone', shell, 1.06, 10.26, wall, { top: false });
  const main = [
    [[-13.36, -4.63, -8.28, 9.71], 10.78, 17.27, 0.21],
    [[-6.17, 7.04, -9.02, 10.32], 13.25, 22.89, 0.25],
    [[5.58, 12.16, -4.51, 10.31], 11.84, 18.68, 0.26],
    [[11.2, 19.26, -2.65, 10.25], 9.92, 16.41, 0.25],
  ];
  for (const [rect, eave, ridge, inset] of main) {
    const [x0, x1, z0, z1] = rect;
    box(out, 'sandstone', x0 + 0.36, x1 - 0.36, z0 + 0.35, z1 - 0.35, 9.75, eave - 0.015, wall);
    hippedRoof(out, rect, eave, ridge, inset);
  }
  lathe(
    out,
    'sandstone',
    [-5.06, 8.99],
    [
      [0.86, 1.85, 1.75],
      [9.5, 1.76, 1.59],
      [10.77, 1.72, 1.49],
    ],
    level === 0 ? 8 : 12,
    wall,
  );
  lathe(
    out,
    'slate',
    [-5.06, 8.99],
    [
      [10.58, 1.87, 1.54],
      [14.29, 0.04, 0.04],
    ],
    level === 0 ? 8 : 12,
    red,
  );
  carriagePorch(out, level);
  circularTower(out, level);
  for (const [x, z, top, base] of [
    [-6.53, -7.16, 18.88, 1.03],
    [4.81, -7.73, 21.07, 1.03],
    [-10.39, 2.05, 17.37, 10.64],
    [9.5, 5.44, 17.6, 11.2],
    [15.64, 3.02, 16.98, 13.33],
  ])
    chimney(out, x, z, top, base, level);
  if (level === 0) return;
  facadeDetails(out, shell, level);
  const dormers = [
    [-9.2, -6.67, -1, 2.09, 10.53, 3.54],
    [-6.88, -7.89, -1, 1.82, 11.11, 3.43],
    [4.7, -6.14, -1, 2.1, 13.18, 3.66],
    [10.06, -3.74, -1, 2.05, 11.65, 3.33],
    [-1.86, 9.39, 1, 2.14, 12.72, 3.8],
    [8.98, 10.5, 1, 2.18, 11.19, 3.36],
    [16.03, 9.34, 1, 1.83, 9.63, 3.24],
  ];
  for (const [x, z, d, w, y, h] of dormers) gabledDormer(out, x, z, d, w, y, h, level);
  if (level >= 2) {
    const rear = facade([-5.06, 10.35], [1, 0]);
    sash(out, rear, 0, 1.12, 1.16, 2.31, level, 'round');
    sash(out, rear, 0, 4.71, 1.34, 2.21, level, 'round');
    for (let i = 0; i < 11; i++)
      box(out, 'trim', -3.56 + i * 0.395, -3.45 + i * 0.395, -15.92, -15.75, 4.1, 4.23, ashlar);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'craigdarroch-castle-model.mjs';
const camera = [-42, 23, -60];
const lookAt = [1.1, 9, -1.7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-mansion',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Craigdarroch stone mansion and round tower, steep red slate roofs, open arched carriage entrance, and flanking chimneys.',
  camera,
  lookAt,
  sunDirection: [-45, 64, -42],
  mediumFiContext: {
    scale: 1.08,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Named OpenStreetMap mansion outline places the authored structure.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'joan-crescent-approach', position: camera, lookAt },
    { name: 'tower-balcony-and-carriage-arches', position: [-13, 11, -30], lookAt: [-1, 12.2, -9] },
    { name: 'rear-bays-and-chimneys', position: [26, 16, 36], lookAt: [3, 8.5, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'craigdarroch-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.092, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.041, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by Guerinf’s exact CC0 exterior photograph, the named OpenStreetMap footprint, national heritage records and open LidarBC elevation data.',
};
