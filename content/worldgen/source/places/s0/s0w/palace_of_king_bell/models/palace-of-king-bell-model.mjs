import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  walls: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const plaster = rgb('d4cab3');
const ivory = rgb('e0d9c4');
const ash = rgb('af9e88');
const plinth = rgb('9a8670');
const stepStone = rgb('b6a58e');
const timber = rgb('baaa90');
const soot = rgb('46473e');
const roof = rgb('686b63');
const roofDark = rgb('51574f');
const metal = rgb('717366');
const center = 0.63;

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function cap(out, ring, y) {
  const base = new MeshBufferBuilder();
  if (
    !base.addCap(
      'masonry',
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, 1, 0],
      (p) => p,
      plinth,
    )
  )
    throw new Error('Cannot close the palace base');
  const mesh = base.finalize();
  const at = (i) => Array.from(mesh.positions.subarray(i * 3, i * 3 + 3));
  for (let i = 0; i < mesh.indices.length; i += 3)
    tri(
      out,
      'masonry',
      at(mesh.indices[i]),
      at(mesh.indices[i + 1]),
      at(mesh.indices[i + 2]),
      plinth,
    );
}

function hip(out, x0, x1, z0, z1, y, h, corner = 0.24) {
  const a = [x0, y, z1],
    b = [x1, y, z1],
    c = [x1, y, z0],
    d = [x0, y, z0];
  const m = (z0 + z1) / 2;
  const u = [x0 + (x1 - x0) * corner, y + h, m],
    v = [x1 - (x1 - x0) * corner, y + h, m];
  quad4(out, 'roof', a, b, v, u, roof);
  quad4(out, 'roof', c, d, u, v, roofDark);
  tri(out, 'roof', b, c, v, roof);
  tri(out, 'roof', d, a, u, roofDark);
  abox(out, 'roof', [x0, y - 0.17, z0], [x1, y - 0.014, z1], roofDark, { bottom: true });
}

function lattice(out, F, left, right, y, height, level) {
  if (level === 0) {
    quad4(
      out,
      'wood',
      F.P(left, y, 0.032),
      F.P(right, y, 0.032),
      F.P(right, y + height, 0.032),
      F.P(left, y + height, 0.032),
      ivory,
    );
    return;
  }
  fbox(out, 'wood', F, left, right, y, y + 0.065, -0.035, 0.045, ivory);
  fbox(out, 'wood', F, left, right, y + height - 0.075, y + height, -0.041, 0.06, ivory);
  const count = level === 1 ? 1 : 3;
  for (let i = 0; i < count; i++) {
    const a = left + ((right - left) * i) / count;
    const b = left + ((right - left) * (i + 1)) / count;
    const mid = (a + b) / 2;
    if (level >= 2)
      fbox(out, 'wood', F, a - 0.025, a + 0.025, y + 0.055, y + height - 0.052, -0.03, 0.05, ivory);
    const low = y + 0.075,
      high = y + height - 0.09;
    quad4(
      out,
      'wood',
      F.P(a, low, 0.053),
      F.P(b, high, 0.053),
      F.P(b, high + 0.047, 0.053),
      F.P(a, low + 0.047, 0.053),
      ivory,
    );
    quad4(
      out,
      'wood',
      F.P(a, high, 0.055),
      F.P(a, high - 0.046, 0.055),
      F.P(b, low - 0.046, 0.055),
      F.P(b, low, 0.055),
      ivory,
    );
    if (level === 3) {
      fbox(out, 'wood', F, mid - 0.017, mid + 0.017, low, high, -0.021, 0.063, ivory);
      fbox(
        out,
        'wood',
        F,
        a,
        b,
        (low + high) * 0.5 - 0.02,
        (low + high) * 0.5 + 0.022,
        -0.024,
        0.061,
        ivory,
      );
    }
  }
}

function archRun(out, F, bays, y, top, level) {
  for (const [a, b, open] of bays) {
    const mid = (a + b) * 0.5;
    const half = (b - a) * 0.426;
    const story = top - y;
    const spring = top - story * 0.4;
    const rise = Math.min(half * 0.82, story * 0.36);
    const left = mid - half,
      right = mid + half;
    for (const [x0, x1] of [
      [a, left],
      [right, b],
    ]) {
      if (level <= 1)
        quad4(out, 'walls', F.P(x0, y), F.P(x1, y), F.P(x1, top), F.P(x0, top), plaster);
      else fbox(out, 'walls', F, x0, x1, y, top, -0.36, 0, plaster);
    }
    const curve = roundArch(half, [3, 5, 8, 12][level]);
    for (let i = 1; i < curve.length; i++) {
      const [ax, ay] = curve[i - 1],
        [bx, by] = curve[i];
      const u = mid + ax,
        v = mid + bx;
      const ya = spring + (ay * rise) / half,
        yb = spring + (by * rise) / half;
      quad4(out, 'walls', F.P(u, ya), F.P(v, yb), F.P(v, top), F.P(u, top), plaster);
      if (level >= 2) {
        quad4(out, 'walls', F.P(v, yb, -0.35), F.P(u, ya, -0.35), F.P(u, ya), F.P(v, yb), ash);
        const au = u + ax * 0.11,
          bu = v + bx * 0.11;
        quad4(
          out,
          'wood',
          F.P(u, ya, 0.025),
          F.P(v, yb, 0.025),
          F.P(bu, yb + by * 0.11 + 0.027, 0.025),
          F.P(au, ya + ay * 0.11 + 0.027, 0.025),
          ivory,
        );
      }
    }
    if (!open) lattice(out, F, left + 0.04, right - 0.04, y + 0.024, story * 0.28, level);
    if (level >= 2) {
      for (const u of [a + 0.02, b - 0.035])
        fbox(out, 'wood', F, u - 0.06, u + 0.1, top - 0.32, top, -0.013, 0.125, ivory);
    }
  }
}

function evenBays(start, end, count, entrance = []) {
  return Array.from({ length: count }, (_, i) => [
    start + (i * (end - start)) / count,
    start + ((i + 1) * (end - start)) / count,
    entrance.includes(i),
  ]);
}

function upperWindow(out, F, u, y, w, h, level) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'dark',
    frameSlot: 'wood',
    glass: soot,
    frame: ivory,
    frameWidth: 0.085,
    frameDepth: 0.13,
    sill: level >= 1,
    mullions: level >= 2 ? 1 : 0,
    transoms: level === 3 ? 1 : 0,
    d: 0.047,
  });
}

function steps(out, level) {
  const count = level <= 1 ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const height = ((i + 1) * 1.48) / count;
    const half = 4.57 - i * 0.1;
    box(
      out,
      'masonry',
      center - half,
      center + half,
      9.39,
      13.14 - i * 0.422,
      -0.24,
      height,
      i % 2 === 0 ? stepStone : plinth,
    );
  }
}

function groundFloor(out, level) {
  const ring = frame.geometry.outline;
  extrude(out, 'masonry', ring, -1.37, 1.45, plinth, { top: false });
  cap(out, ring, 1.45);
  box(out, 'walls', -9.36, 10.28, -5.82, 4.5, 1.44, 4.57, plaster);
  const wingL = -12.2,
    wingR = 12.94;
  const z0 = -6.95,
    z1 = 7.035;
  const lower = 1.44,
    top = 4.72;
  const F = facade([0, z1], [1, 0]);
  archRun(out, F, [...evenBays(wingL, -4.17, 3), ...evenBays(5.69, wingR, 3)], lower, top, level);
  const porch = facade([0, 9.785], [1, 0]);
  archRun(out, porch, evenBays(-4.18, 5.74, 4, [1, 2]), lower, top, level);
  const back = facade([0, -7.08], [-1, 0]);
  archRun(
    out,
    back,
    [...evenBays(-12.2, -3.83, 3), ...evenBays(5.02, 12.41, 3)],
    lower,
    top,
    level,
  );
  archRun(out, facade([0, -9.455], [-1, 0]), evenBays(-3.83, 5.02, 3, [1]), lower, top, level);
  for (const side of [-1, 1]) {
    const F = facade([side < 0 ? wingL : wingR, 0], [0, -side]);
    archRun(out, F, evenBays(-6.93, 7.12, 4), lower, top, level);
  }
  for (const x of [-4.17, 5.73]) {
    const side = x < 0 ? -1 : 1;
    const F = facade([x, 0], [0, -side]);
    archRun(
      out,
      F,
      evenBays(...(side < 0 ? [7.03, 9.785] : [-9.785, -7.03]), 1),
      lower,
      top,
      level,
    );
  }
  const roofY = 4.86;
  hip(out, -12.65, -4.2, -7.21, 7.3, roofY, 0.78);
  hip(out, 5.8, 13.36, -7.21, 7.34, roofY, 0.78);
  box(out, 'roof', -4.34, 5.83, -7.08, 9.94, 4.6, 4.97, roof);
  steps(out, level);
}

function upperVeranda(out, level) {
  box(out, 'walls', -8.92, 9.72, -5.77, 5.31, 4.55, 7.98, plaster);
  const left = -3.63,
    right = 4.96,
    front = 9.51,
    back = 4.78;
  box(out, 'wood', left, right, back, front, 4.79, 5.12, timber);
  const entrance = facade([0, front], [1, 0]);
  archRun(out, entrance, evenBays(left, right, 4), 5.12, 7.73, level);
  for (const side of [-1, 1]) {
    const F = facade([side < 0 ? left : right, 0], [0, -side]);
    const [a, b] = side < 0 ? [back, front] : [-front, -back];
    archRun(out, F, evenBays(a, b, 2), 5.12, 7.73, level);
    if (level >= 2)
      for (let u = a + 0.13; u < b - 0.09; u += 0.17)
        fbox(out, 'wood', F, u - 0.014, u + 0.014, 4.97, 5.23, -0.032, 0.047, ivory);
  }
  if (level >= 2)
    for (let x = left + 0.14; x < right - 0.095; x += 0.17)
      fbox(out, 'wood', entrance, x - 0.015, x + 0.016, 4.966, 5.24, -0.04, 0.052, ivory);
  hip(out, -9.6, 10.1, -6.43, 5.82, 8.05, 1.02);
  hip(out, left - 0.45, right + 0.43, 4.53, 9.93, 7.89, 0.73, 0.29);
  const F = facade([0, 5.34], [1, 0]);
  upperWindow(out, F, -6.84, 5.25, 1.23, 2.04, level);
  upperWindow(out, F, 7.29, 5.25, 1.17, 2.02, level);
  if (level >= 1) {
    for (const side of [-1, 1]) {
      const sideF = facade([side < 0 ? -8.92 : 9.72, 0], [0, -side]);
      for (const u of [-3.41, 0.08, 3.57]) upperWindow(out, sideF, u, 5.17, 1.02, 2.0, level);
    }
    const rear = facade([0, -5.77], [-1, 0]);
    for (const u of [-6.85, -2.44, 2.96, 6.82]) upperWindow(out, rear, u, 5.22, 1.11, 1.96, level);
  }
}

function pavilion(out, level) {
  const x = center,
    z = -0.18,
    r = 3.57;
  box(out, 'walls', x - 3.93, x + 3.93, z - 2.91, z + 2.91, 8.7, 10.15, timber);
  hip(out, x - 4.31, x + 4.31, z - 3.32, z + 3.32, 10.18, 0.68);
  box(out, 'wood', x - r, x + r, z - 2.63, z + 2.63, 10.67, 10.89, timber);
  archRun(out, facade([x, z + 2.61], [1, 0]), evenBays(-r, r, 4), 10.88, 12.91, level);
  archRun(out, facade([x, z - 2.61], [-1, 0]), evenBays(-r, r, 4), 10.88, 12.91, level);
  for (const sign of [-1, 1])
    archRun(
      out,
      facade([x + sign * r, z], [0, -sign]),
      evenBays(-2.63, 2.63, 3),
      10.88,
      12.91,
      level,
    );
  hip(out, x - 4.12, x + 4.12, z - 3.1, z + 3.1, 13.04, 0.56);
  const n = level < 2 ? 8 : 16;
  lathe(
    out,
    'wood',
    [x, z],
    [
      [13.31, 0.53, 0.53],
      [13.63, 0.77, 0.77],
      [14.51, 0.74, 0.74],
    ],
    n,
    timber,
  );
  lathe(
    out,
    'metal',
    [x, z],
    [
      [14.48, 0.81, 0.81],
      [14.67, 0.77, 0.77],
      [15.18, 0.49, 0.49],
      [15.47, 0.17, 0.17],
    ],
    n,
    metal,
  );
  box(out, 'metal', x - 0.055, x + 0.055, z - 0.055, z + 0.055, 15.4, 15.88, soot);
}

function build(out, level) {
  groundFloor(out, level);
  upperVeranda(out, level);
  pavilion(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'palace-of-king-bell-model.mjs';
const camera = [28, 20, 42],
  lookAt = [0, 6.7, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'La Pagode, the Palace of King Bell in Douala, with repeated veranda arches, a central porch and a tiered cupola.',
  camera,
  lookAt,
  sunDirection: [-40, 65, 70],
  mediumFiContext: {
    scale: 1.18,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis: 'The named mapped palace perimeter retains both central porch projections.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'bonanjo-south-approach', position: camera, lookAt },
    { name: 'veranda-arches-and-stairs', position: [7, 6.1, 27], lookAt: [0.65, 4.8, 6.3] },
    { name: 'pagode-pavilion-and-cupola', position: [-18, 19, 22], lookAt: [0.63, 11.2, 0.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-of-king-bell-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.51,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.21, surfaces },
      street: { export: 'street', errorMeters: 0.071, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.022, surfaces },
    },
  },
};
