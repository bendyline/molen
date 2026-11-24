import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/kruger-house-pretoria-shape-controls');
const [[west, rear], [, front], [east], , [returnEast, junction], [, returnRear], [returnWest]] =
  shape.outline;
const { porchEave, mainEave, mainRidge } = shape.estimatedHeights;
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.83 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76 },
  iron: { slot: 'trim', localRef: 'palette:#fdfdfd', roughness: 0.72 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
};
const plaster = rgb('e5dfca');
const chalk = rgb('efe9d5');
const stone = rgb('b5ad93');
const stoneShade = rgb('a79d82');
const iron = rgb('444941');
const timber = rgb('5b5c4a');
const glass = rgb('474b44');
const roof = rgb('6c665b');
const ridge = rgb('71695b');
const deck = 0.93;
const bodyFront = 4.04;
const posts = [-12.39, -8.9, -5.1, -1.73, 1.73, 4.98, 8.72, 11.34];
const entry = 0;
const stoep = wallFace([west, front - 0.16], [east, front - 0.16]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function hip(out, x0, x1, z0, z1, eave, peak, level, ends) {
  const middle = (z0 + z1) / 2;
  const r0 = [x0 + ends, peak, middle],
    r1 = [x1 - ends, peak, middle];
  const A = [x0, eave, z1],
    B = [x1, eave, z1],
    C = [x1, eave, z0],
    D = [x0, eave, z0];
  quad4(out, 'roof', A, B, r1, r0, roof);
  quad4(out, 'roof', C, D, r0, r1, roof);
  tri(out, 'roof', B, C, r1, roof);
  tri(out, 'roof', D, A, r0, roof);
  if (level < 2) return;
  box(
    out,
    'roof',
    r0[0] - 0.035,
    r1[0] + 0.035,
    middle - 0.085,
    middle + 0.085,
    peak - 0.035,
    peak + 0.052,
    ridge,
  );
  const count = level === 3 ? 40 : 19;
  for (let i = 1; i < count; i++) {
    const u = i / count;
    const x = x0 + u * (x1 - x0);
    const head = Math.max(r0[0], Math.min(r1[0], x));
    const ratio = Math.min(1, (x - x0) / ends, (x1 - x) / ends);
    const height = eave + ratio * (peak - eave) + 0.028;
    const w = 0.019;
    const from = z1 + ratio * (middle - z1);
    const al = head === x ? x : x + (head - x) * 0.045;
    quad4(
      out,
      'roof',
      [x - w, eave + 0.022, z1 - 0.025],
      [x + w, eave + 0.022, z1 - 0.025],
      [al + w, height, from],
      [al - w, height, from],
      ridge,
    );
  }
}

function shell(out, level) {
  box(out, 'plaster', west, east, rear, bodyFront, -0.85, mainEave, plaster);
  hip(
    out,
    west - 0.39,
    east + 0.39,
    rear - 0.38,
    bodyFront + 0.29,
    mainEave - 0.06,
    mainRidge,
    level,
    3.1,
  );
  box(out, 'plaster', returnWest, returnEast, returnRear, junction + 0.11, -0.92, 3.86, plaster);
  hip(
    out,
    returnWest - 0.19,
    returnEast + 0.24,
    returnRear - 0.29,
    junction + 0.24,
    3.82,
    4.85,
    level,
    2.05,
  );
  const frontFace = wallFace([west, bodyFront], [east, bodyFront]);
  fbox(out, 'stone', frontFace, 0, frontFace.length, 0.54, 0.69, -0.07, 0.14, stoneShade);
  for (const [x, z] of [
    [-6.15, -4.65],
    [5.31, -3.95],
  ]) {
    box(out, 'plaster', x - 0.33, x + 0.33, z - 0.31, z + 0.31, 5.42, 6.72, chalk);
    box(out, 'stone', x - 0.39, x + 0.39, z - 0.37, z + 0.37, 6.66, 6.83, stoneShade);
  }
  if (level === 0) return;
  for (const x of [-10.71, -7.12, -3.67, 3.64, 7.1, 10.66]) {
    opening(out, frontFace, x - west, 1.4, 1.44, 1.69, {
      glassSlot: 'dark',
      frameSlot: 'timber',
      glass,
      frame: timber,
      frameWidth: 0.102,
      mullions: level >= 2 ? 2 : 1,
      transoms: level >= 2 ? 2 : 1,
    });
  }
  opening(out, frontFace, entry - west, deck + 0.03, 1.6, 2.79, {
    glassSlot: 'dark',
    frameSlot: 'timber',
    glass,
    frame: timber,
    frameWidth: 0.17,
    mullions: 1,
    transoms: 2,
  });
  if (level < 2) return;
  const sides = [
    wallFace([west, rear], [west, bodyFront]),
    wallFace([east, bodyFront], [east, junction]),
  ];
  for (const side of sides) {
    const bays = side.length > 10 ? 3 : 2;
    for (let i = 0; i < bays; i++) {
      opening(out, side, (side.length * (i + 0.56)) / bays, 1.36, 1.19, 1.65, {
        glassSlot: 'dark',
        frameSlot: 'timber',
        glass,
        frame: timber,
        frameWidth: 0.1,
        mullions: 1,
        transoms: 2,
      });
    }
  }
}

function diagonal(out, f, a, b, width, depth, shade) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const n = Math.hypot(dx, dy);
  const h = width * 0.5;
  const vx = (-dy * h) / n,
    vy = (dx * h) / n;
  quad4(
    out,
    'iron',
    f.P(a[0] + vx, a[1] + vy, depth),
    f.P(a[0] - vx, a[1] - vy, depth),
    f.P(b[0] - vx, b[1] - vy, depth),
    f.P(b[0] + vx, b[1] + vy, depth),
    shade,
  );
}

function veranda(out, level) {
  box(out, 'stone', west - 0.09, east + 0.04, bodyFront - 0.03, front + 0.03, -0.63, deck, stone);
  box(
    out,
    'stone',
    west - 0.13,
    east + 0.08,
    bodyFront - 0.03,
    front + 0.11,
    deck - 0.1,
    deck + 0.028,
    chalk,
  );
  const lip = front + 0.32;
  quad4(
    out,
    'roof',
    [west - 0.29, porchEave, lip],
    [east + 0.36, porchEave, lip],
    [east + 0.36, 4.45, bodyFront - 0.18],
    [west - 0.29, 4.45, bodyFront - 0.18],
    roof,
  );
  quad4(
    out,
    'timber',
    [east + 0.36, porchEave - 0.025, lip],
    [west - 0.29, porchEave - 0.025, lip],
    [west - 0.29, 4.42, bodyFront - 0.18],
    [east + 0.36, 4.42, bodyFront - 0.18],
    plaster,
  );
  fbox(
    out,
    'timber',
    stoep,
    -0.32,
    stoep.length + 0.36,
    porchEave - 0.18,
    porchEave - 0.01,
    -0.06,
    0.28,
    chalk,
    { bottom: true },
  );
  for (let i = 0; i < posts.length; i++) {
    const u = posts[i] - west;
    fbox(out, 'iron', stoep, u - 0.064, u + 0.064, deck, porchEave - 0.11, -0.095, 0.095, iron);
    if (level < 1) continue;
    fbox(
      out,
      'timber',
      stoep,
      u - 0.128,
      u + 0.128,
      deck - 0.006,
      deck + 0.14,
      -0.16,
      0.142,
      timber,
    );
    fbox(
      out,
      'timber',
      stoep,
      u - 0.118,
      u + 0.118,
      porchEave - 0.3,
      porchEave - 0.15,
      -0.13,
      0.132,
      timber,
    );
    for (const direction of [-1, 1]) {
      if ((i === 0 && direction < 0) || (i === posts.length - 1 && direction > 0)) continue;
      const divisions = level >= 2 ? 7 : 3;
      let a = [u, porchEave - 0.64];
      for (let j = 1; j <= divisions; j++) {
        const t = j / divisions;
        const b = [u + direction * 1.12 * t, porchEave - 0.64 + 0.45 * Math.sin((t * Math.PI) / 2)];
        diagonal(out, stoep, a, b, level === 3 ? 0.05 : 0.078, 0.025, iron);
        a = b;
      }
    }
  }
  for (let i = 1; i < posts.length; i++) {
    if (i === 4) continue;
    const a = posts[i - 1] - west + 0.09,
      b = posts[i] - west - 0.09;
    fbox(out, 'timber', stoep, a, b, deck + 0.035, deck + 0.095, -0.065, 0.082, chalk);
    fbox(out, 'timber', stoep, a, b, deck + 0.72, deck + 0.795, -0.105, 0.105, chalk);
    if (level < 1) continue;
    const c = (a + b) * 0.5;
    for (const [left, right] of [
      [a, c],
      [c, b],
    ]) {
      diagonal(out, stoep, [left, deck + 0.075], [right, deck + 0.75], 0.067, 0.043, iron);
      diagonal(out, stoep, [right, deck + 0.075], [left, deck + 0.75], 0.067, 0.045, iron);
    }
  }
  for (let step = 0; step < 4; step++) {
    const top = 0.17 + (step + 1) * 0.19;
    box(
      out,
      'stone',
      -1.62,
      1.62,
      front - 0.03,
      front + 1.72 - step * 0.405,
      0.11,
      top,
      step % 2 === 0 ? stone : stoneShade,
    );
  }
}

function lions(out, level) {
  if (level < 1) return;
  for (const [i, x] of [-2.62, 2.62].entries()) {
    const z = front + 0.68;
    box(out, 'stone', x - 0.47, x + 0.47, z - 0.68, z + 0.72, 0.46, 0.88, stoneShade);
    box(out, 'stone', x - 0.52, x + 0.52, z - 0.74, z + 0.78, 0.86, 0.99, chalk);
    const sides = level === 3 ? 8 : 5;
    lathe(
      out,
      'stone',
      [x, z - 0.15],
      [
        [0.97, 0.26, 0.58],
        [1.2, 0.32, 0.62],
        [1.34, 0.28, 0.44],
        [1.4, 0.13, 0.32],
        [1.44, 0, 0],
      ],
      sides,
      chalk,
      { capTop: false },
    );
    const headZ = z + 0.31,
      raise = i === 0 ? 0.05 : 0.18;
    lathe(
      out,
      'stone',
      [x, headZ],
      [
        [1.17, 0.2, 0.18],
        [1.29 + raise, 0.23, 0.22],
        [1.52 + raise, 0.16, 0.165],
        [1.57 + raise, 0, 0],
      ],
      sides,
      chalk,
      { capTop: false },
    );
    if (level < 2) continue;
    for (const sign of [-1, 1]) {
      box(
        out,
        'stone',
        x + sign * 0.16 - 0.09,
        x + sign * 0.16 + 0.09,
        z + 0.29,
        z + 0.62,
        1.02,
        1.18,
        chalk,
      );
      box(
        out,
        'stone',
        x + sign * 0.1 - 0.031,
        x + sign * 0.1 + 0.031,
        headZ - 0.12,
        headZ - 0.01,
        1.47 + raise,
        1.55 + raise,
        chalk,
      );
    }
  }
}

function build(out, level) {
  shell(out, level);
  veranda(out, level);
  lions(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kruger-house-pretoria-model.mjs';
const camera = [23, 13, 30],
  lookAt = [0, 2.55, -0.64];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Pretoria house museum with its broad one-storey street front, iron-bracketed stoep and pair of stone lions.',
  camera,
  lookAt,
  sunDirection: [-15, 30, 42],
  mediumFiContext: {
    scale: 0.96,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis:
      'The southern street-facing house and its attached return are replaced within the museum property.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'street-facing-stoep', position: [0, 5.4, 27], lookAt: [-0.2, 2.45, 5.1] },
    { name: 'iron-brackets-and-lions', position: [5.2, 3.23, 13.4], lookAt: [0, 2.06, 6.25] },
    { name: 'roof-and-attached-return', position: [19, 18, -24], lookAt: [0, 3, -1.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kruger-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.63, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
};
