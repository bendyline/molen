import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tower,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  face,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outline = frame.geometry.outline;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  detail: { slot: 'trim', graph: 'brick', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.9, metallic: 0.1 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.86, metallic: 0.2 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
};
const brick = rgb('a47b65');
const deeper = rgb('94715e');
const brickWarm = rgb('aa7e67');
const paleBrick = rgb('be997e');
const bull = rgb('a38976');
const stone = rgb('a0927e');
const copper = rgb('85816e');
const fresh = rgb('9a866f');
const roof = rgb('738c7d');
const roofLight = rgb('81998a');
const shadow = rgb('53504c');
const glazing = rgb('5e6867');
const lead = rgb('797b72');
const gold = rgb('baab67');
const xCenter = 6.87;
const naveRidge = 44.18;
const main = [
  [-8.7, 35.68],
  [-8.7, 25.34],
  [-13.66, 24.1],
  [-15.2, 16],
  [-15.2, -9.25],
  [-18.59, -11.18],
  [-18.6, -28.34],
  [-8.43, -28.93],
  [-6.79, -33.72],
  [-4.69, -38.22],
  [-0.99, -41.12],
  [3.12, -43.78],
  [12.94, -43.45],
  [16.9, -40.51],
  [20.38, -37.22],
  [21.69, -32.76],
  [22.67, -27.99],
  [22.69, -10.15],
  [24.8, -7.04],
  [24.55, 23.98],
  [22.92, 25.96],
  [22.9, 35.66],
];
const choir = main.slice(7, 17);
const towerFrame = [
  [-4.64, 18.78],
  [-4.64, 35.65],
  [18.46, 35.65],
  [18.46, 18.78],
];

function panel(out, slot, f, l, r, b, t, c, d = 0) {
  if (r - l < 0.005 || t - b < 0.005) return;
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), c);
}
function box(out, slot, x0, x1, z0, z1, y0, y1, c) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], c, { bottom: false });
}
function course(out, f, l, r, y0, y1, d, tint = paleBrick) {
  fbox(out, 'detail', f, l, r, y0, y1, -0.015, d, tint);
}

function lancet(out, f, u, y, w, height, lod, options = {}) {
  const { round = false, fill = glazing, depth = 0.045, surround = true, grid = true } = options;
  const count = [2, 3, 4, 6][lod];
  const half = w / 2;
  const rise = round ? half : Math.max(half * 1.15, w * 0.78);
  const spring = y + height - rise;
  const inner = round ? roundArch(half, count * 2) : pointedArch(half, rise, count);
  const r = (du, py, d) => f.P(u + du, py, d);
  fan(
    out,
    'glass',
    [
      r(-half, y, depth),
      r(half, y, depth),
      ...inner
        .slice()
        .reverse()
        .map(([x, dy]) => r(x, spring + dy, depth)),
    ],
    fill,
  );
  if (lod === 0 || !surround) return;
  const ext = half + 0.17;
  const outer = round ? roundArch(ext, count * 2) : pointedArch(ext, rise + 0.17, count);
  panel(out, 'detail', f, u - ext, u - half, y, spring, paleBrick, depth + 0.026);
  panel(out, 'detail', f, u + half, u + ext, y, spring, paleBrick, depth + 0.026);
  for (let i = 0; i < inner.length - 1; i++) {
    const [a, h] = inner[i],
      [b, j] = inner[i + 1],
      [c, k] = outer[i],
      [d, l] = outer[i + 1];
    quad4(
      out,
      'detail',
      r(a, spring + h, depth + 0.03),
      r(b, spring + j, depth + 0.03),
      r(d, spring + l, depth + 0.03),
      r(c, spring + k, depth + 0.03),
      i % 5 === 2 ? bull : paleBrick,
    );
  }
  if (lod >= 2 && grid) {
    const bars = lod === 3 ? 3 : 1;
    for (let i = 1; i <= bars; i++) {
      const x = (i / (bars + 1) - 0.5) * w;
      panel(
        out,
        'detail',
        f,
        u + x - 0.041,
        u + x + 0.041,
        y + 0.025,
        spring + 0.15,
        lead,
        depth + 0.061,
      );
    }
    if (lod === 3)
      for (let i = 1; i <= 4; i++) {
        const h = y + ((spring - y) * i) / 5;
        panel(
          out,
          'detail',
          f,
          u - half + 0.045,
          u + half - 0.045,
          h - 0.035,
          h + 0.035,
          lead,
          depth + 0.062,
        );
      }
    course(out, f, u - ext, u + ext, y - 0.11, y + 0.04, depth + 0.2, bull);
  }
}

function nave(out, lod) {
  const foundation = lod === 0 ? main : outline;
  extrude(out, 'stone', foundation, -3.05, 0.88, stone, { top: false });
  extrude(out, 'brick', main, 0.88, 23.18, brick, { top: false });
  // The stepped broad south chapels and narrow west-side range belong to the native building.
  box(out, 'brick', 22.3, 26.0, -9.28, 10.65, 0.28, 17.42, brickWarm);
  box(out, 'brick', -16.59, -14.86, -6.82, 7.88, 0.41, 17.18, deeper);
  box(out, 'brick', -7.64, 1.23, 26.12, 35.57, 0.47, 21.73, deeper);
  box(out, 'brick', 12.01, 22.85, 25.92, 35.71, 0.45, 21.73, brickWarm);
  const sectors = [
    {
      f: facade([-15.23, 0], [0, 1]),
      starts: [-6.97, 0.22, 7.28, 14.34, 20.96],
      paneBase: 3.66,
      rest: 22.38,
    },
    { f: facade([-18.6, -18], [0, 1]), starts: [-7.05, 0.32, 6.63], paneBase: 3.48, rest: 22.31 },
    { f: facade([22.72, -18], [0, -1]), starts: [-6.13, 0.36, 7.03], paneBase: 2.77, rest: 22.19 },
    {
      f: facade([24.77, 9.9], [0, -1]),
      starts: [-11.23, -4.87, 2.1, 8.86, 15.59],
      paneBase: 3.48,
      rest: 22.35,
    },
  ];
  for (const [sector, v] of sectors.entries()) {
    for (const [i, x] of v.starts.entries()) {
      lancet(out, v.f, x, v.paneBase, 2.52, 16.85, lod);
      const r = x + 2.59;
      if (lod > 0) {
        fbox(out, 'brick', v.f, r - 0.42, r + 0.42, 0.53, v.rest - 1.06, -0.07, 1.02, deeper);
        fbox(
          out,
          'detail',
          v.f,
          r - 0.51,
          r + 0.51,
          v.rest - 1.22,
          v.rest - 0.84,
          -0.016,
          1.14,
          paleBrick,
        );
      }
      if (lod >= 2 && i % 2 === 0) course(out, v.f, x - 2.61, x + 2.24, 22.12, 22.48, 0.24);
      if (lod >= 2 && sector % 2 === 1)
        course(out, v.f, x - 0.42, x + 0.42, 0.75, 1.12, 0.29, bull);
    }
  }
  const choirRing = outwardRing(choir);
  // Keep the traced eastern apse’s exterior edges in the same order as the wall below.
  for (let i = 0; i < choirRing.length; i++) {
    const a = choirRing[i],
      b = choirRing[(i + 1) % choirRing.length];
    const f = wallFace(a, b);
    if (f.normal[1] > -0.16 && Math.abs(f.normal[0]) < 0.52) continue;
    if (f.length < 3.68 || f.length > 11.8) continue;
    lancet(out, f, f.length / 2, 3.02, Math.min(2.82, f.length - 1.15), 17.51, lod);
    if (lod > 0) {
      fbox(out, 'brick', f, 0.12, 0.88, 0.51, 22.48, -0.1, 0.79, deeper);
      course(out, f, 0.02, 0.94, 21.96, 22.49, 0.89, paleBrick);
    }
  }
}

function roofs(out, lod) {
  const frontZ = 19.4,
    eastZ = -27.92;
  const left = [-18.91, 22.9, eastZ],
    right = [22.98, 22.9, eastZ];
  const ridgeNear = [xCenter, naveRidge, frontZ],
    ridgeFar = [xCenter, naveRidge, eastZ];
  face(out, 'roof', [left, [-15.24, 22.9, frontZ], ridgeNear, ridgeFar], up, roof);
  face(out, 'roof', [ridgeFar, ridgeNear, [24.58, 22.9, frontZ], right], up, roofLight);
  for (let i = 0; i < choir.length - 1; i++) {
    const [x, z] = choir[i],
      [xx, zz] = choir[i + 1];
    face(out, 'roof', [[x, 22.92, z], [xx, 22.92, zz], ridgeFar], up, i % 2 ? roof : roofLight);
  }
  const [choirX, choirZ] = choir[0];
  const [returnX, returnZ] = choir.at(-1);
  face(out, 'roof', [left, [choirX, 22.92, choirZ], ridgeFar], up, roof);
  face(out, 'roof', [[returnX, 22.92, returnZ], right, ridgeFar], up, roofLight);
  face(out, 'brick', [[-15.2, 23.04, frontZ], [24.51, 23.04, frontZ], ridgeNear], [0, 0, 1], brick);
  const patches = [
    [
      [-16.64, 17.27, -6.99],
      [-16.64, 17.27, 8.03],
      [-14.91, 19.46, 8.03],
      [-14.91, 19.46, -6.99],
    ],
    [
      [22.34, 19.55, -9.47],
      [22.34, 19.55, 10.77],
      [26.1, 17.49, 10.77],
      [26.1, 17.49, -9.47],
    ],
    [
      [-8.15, 21.76, 26.04],
      [-8.15, 21.76, 35.89],
      [0.95, 23.09, 35.89],
      [0.95, 23.09, 26.04],
    ],
    [
      [12.19, 23.09, 25.78],
      [12.19, 23.09, 35.89],
      [23.09, 21.76, 35.89],
      [23.09, 21.76, 25.78],
    ],
  ];
  for (const roofPatch of patches) face(out, 'roof', roofPatch, up, roof);
  if (lod >= 2) {
    for (const [x, z, y] of [
      [-11.88, -19.56, 29.62],
      [-11.02, -6.91, 30.57],
      [-9.37, 8.82, 32.18],
      [20.14, -21.5, 26.42],
      [19.89, -8.75, 26.72],
      [21.39, 7.96, 25.49],
    ]) {
      box(out, 'roof', x - 0.55, x + 0.55, z - 0.52, z + 0.52, y - 0.26, y + 0.4, roofLight);
    }
  }
}

function clockDial(out, f, lod) {
  const c = f.length / 2,
    y = 56.26,
    r = 1.6;
  const points = Array.from({ length: lod >= 2 ? 24 : 12 }, (_, i) => {
    const a = (Math.PI * 2 * i) / (lod >= 2 ? 24 : 12);
    return f.P(c + Math.cos(a) * r, y + Math.sin(a) * r, 0.102);
  });
  fan(out, 'glass', points, shadow);
  if (lod === 0) return;
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI * 2 * i) / 12;
    const p = f.P(c + Math.sin(a) * 1.36, y + Math.cos(a) * 1.36, 0.139);
    const q = f.P(c + Math.sin(a) * 1.11, y + Math.cos(a) * 1.11, 0.139);
    beam(out, 'detail', p, q, 0.103, 0.065, gold);
  }
  beam(out, 'detail', f.P(c, y, 0.15), f.P(c - 0.32, y + 0.63, 0.15), 0.115, 0.068, gold);
  beam(out, 'detail', f.P(c, y, 0.15), f.P(c + 0.58, y + 0.41, 0.15), 0.08, 0.07, gold);
}

function lowerTower(out, lod) {
  const ring = outwardRing(towerFrame);
  extrude(out, 'brick', ring, 0.45, 61.58, brick, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]),
      L = f.length,
      c = L / 2;
    const west = f.normal[1] > 0.95;
    for (const band of [
      [22.94, 23.49, 0.21],
      [46.22, 46.77, 0.41],
      [60.85, 61.43, 0.43],
    ]) {
      course(out, f, 0.04, L - 0.04, band[0], band[1], band[2]);
    }
    if (west || lod > 0) {
      for (const u of [c - 4.79, c, c + 4.79])
        lancet(out, f, u, 27.86, 2.15, 16.72, lod, { round: true, fill: deeper, grid: false });
    }
    for (const u of [c - 5.3, c - 2.82, c + 2.82, c + 5.3]) {
      lancet(out, f, u, 51.55, 1.53, 6.72, lod, { round: true, fill: bull, grid: false });
      if (lod > 0) panel(out, 'detail', f, u - 0.05, u + 0.05, 51.68, 56.78, deeper, 0.119);
    }
    clockDial(out, f, lod);
    if (lod >= 2) {
      fbox(out, 'detail', f, 0.035, 0.56, 22.91, 60.82, -0.07, 0.55, paleBrick);
      fbox(out, 'detail', f, L - 0.56, L - 0.035, 22.91, 60.82, -0.07, 0.56, paleBrick);
    }
    if (west) {
      lancet(out, f, c, 0.85, 4.65, 8.56, lod, { fill: shadow, grid: false });
      lancet(out, f, c, 11.0, 3.54, 9.33, lod, { fill: glazing });
      for (const u of [c - 6.98, c + 6.87])
        lancet(out, f, u, 3.1, 1.56, 8.35, lod, { round: true, fill: deeper, grid: false });
    }
  }
}

function spireRings(out, cx, cz, profiles, lod, material, windows) {
  const ring = (radius, cy) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = Math.PI / 8 + (Math.PI * i) / 4;
      return [cx + radius * Math.cos(a), cy, cz + radius * Math.sin(a)];
    });
  for (let j = 0; j < profiles.length - 1; j++) {
    const [low, y] = profiles[j],
      [hi, yy] = profiles[j + 1];
    const a = ring(low, y),
      b = ring(hi, yy);
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8,
        n = [a[i][0] - cx + a[k][0] - cx, 0, a[i][2] - cz + a[k][2] - cz];
      face(out, material, [a[i], a[k], b[k], b[i]], n, i % 2 ? copper : fresh);
      if (windows && lod > 0 && j < profiles.length - 2 && i % 2 === 1) {
        const x = (a[i][0] + a[k][0]) / 2 - cx,
          z = (a[i][2] + a[k][2]) / 2 - cz;
        const length = Math.hypot(x, z);
        const nx = x / length,
          nz = z / length;
        const glass = (p, q, amount, shift) => {
          const middle = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
          return [
            middle[0] + (p[0] - middle[0]) * amount + nx * shift,
            middle[1],
            middle[2] + (p[2] - middle[2]) * amount + nz * shift,
          ];
        };
        const wd = j === 0 ? 0.66 : 0.42;
        face(
          out,
          'glass',
          [
            glass(a[i], a[k], wd, 0.029),
            glass(a[k], a[i], wd, 0.029),
            glass(b[k], b[i], wd * 0.86, 0.029),
            glass(b[i], b[k], wd * 0.86, 0.029),
          ],
          n,
          glazing,
        );
        if (lod === 3 && j === 1) {
          for (let k = 1; k <= 7; k++) {
            const t = k / 8;
            const sec = (p, q) => p.map((n, i) => n + (q[i] - n) * t);
            const L = sec(a[i], b[i]),
              R = sec(a[(i + 1) % 8], b[(i + 1) % 8]);
            beam(
              out,
              'detail',
              glass(L, R, wd * 0.91, 0.055),
              glass(R, L, wd * 0.91, 0.055),
              0.043,
              0.035,
              lead,
            );
          }
        }
      }
    }
  }
}

function crown(out, lod) {
  const cx = xCenter,
    cz = 27.35;
  const profile = [
    [9.08, 61.54],
    [6.27, 69.96],
    [3.2, 87.1],
    [1.5, 101.5],
    [0.22, 107.14],
  ];
  cap(out, 'roof', towerFrame, 61.55, roof);
  spireRings(out, cx, cz, profile, lod, 'copper', true);
  const corners = [
    [-1.14, 21.0],
    [-1.14, 33.78],
    [14.84, 21.0],
    [14.84, 33.78],
  ];
  for (const [x, z] of corners) {
    tower(out, 'brick', [x, z], 1.65, lod === 0 ? 6 : 8, 60.8, 66.12, deeper, { top: false });
    spireRings(
      out,
      x,
      z,
      [
        [1.55, 65.97],
        [1.3, 67.25],
        [0.071, 72.55],
      ],
      lod,
      'roof',
      false,
    );
    if (lod >= 2) {
      for (const direction of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ]) {
        const f = facade([x - direction[1] * 1.52, z + direction[0] * 1.52], direction);
        lancet(out, f, 0, 62.86, 0.39, 2.62, lod, { round: true, grid: false, fill: shadow });
      }
    }
  }
  beam(out, 'copper', [cx, 106.9, cz], [cx, 110.18, cz], 0.165, 0.165, gold);
  beam(out, 'copper', [cx - 0.85, 109.27, cz], [cx + 0.85, 109.27, cz], 0.124, 0.127, gold);
  if (lod >= 2) tower(out, 'copper', [cx, cz], 0.34, 10, 107.26, 107.67, gold, { top: false });
}

function build(out, lod) {
  nave(out, lod);
  roofs(out, lod);
  lowerTower(out, lod);
  crown(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'szczecin-cathedral-model.mjs';
const camera = [99, 68, 124],
  lookAt = [6, 41, -1.5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Szczecin’s great Brick Gothic cathedral, with a polygonal east choir, broad copper-green roof and the restored copper spire above the west tower.',
  camera,
  lookAt,
  sunDirection: [-53, 72, 58],
  mediumFiContext: {
    scale: 1.56,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The mapped cathedral and its connected Gothic chapels.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'brick',
    'stone_ashlar',
    'metal_standing_seam',
    'metal_copper',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-tower-and-restored-spire', position: camera, lookAt },
    {
      name: 'clock-window-pinnacles-and-restored-spire',
      position: [41, 72, 116],
      lookAt: [6.7, 74, 26],
    },
    {
      name: 'polygonal-brick-choir-and-copper-green-roof',
      position: [91, 31, -104],
      lookAt: [6, 28, -20],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'szczecin-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.78,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model with photographer-released public-domain reference images, OpenStreetMap ODbL building geometry, and open Mapzen terrain.',
};
