import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  cap,
  face,
  floorSampler,
  pairs,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const grade = floorSampler(read('terrain-grid'));
const granite = rgb('c4bbaa');
const lightGranite = rgb('c6bda9');
const terraceGranite = rgb('9d978b');
const terraceTop = rgb('c1b8a5');
const roof = rgb('765b50');
const fascia = rgb('8b6f61');
const concrete = rgb('cfc9b9');
const dark = rgb('514d45');
const shade = rgb('596064');
const crossColor = rgb('d1c1a1');
const earth = rgb('858467');
const bronze = rgb('655849');
const glass = rgb('5e6770');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  concrete: { slot: 'trim', graph: 'concrete_plain', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.24 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
  planting: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
};
const podium = 4.21;
const nave = { left: -3.9, right: 12.7, north: -8.55, south: 14.55, eave: 13.88, ridge: 16.7 };
const xMid = (nave.left + nave.right) / 2;
const t = { left: -13.72, right: -8.72, north: -9.2, south: -3.65 };
const towerTop = 16.46;

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function roofBand(out, x, z0, z1, width, low, high, overhang, level) {
  gableRoof(out, 'roof', [x, z0], [x, z1], width, low, high, roof, {
    overhang,
    endSlot: 'stone',
    endColor: granite,
  });
  const edgeX = width * 0.5 + overhang;
  for (const z of [z0 - overhang, z1 + overhang])
    for (const side of [-1, 1])
      beam(
        out,
        'concrete',
        [x + side * edgeX, low - 0.17, z],
        [x, high - 0.042, z],
        0.24,
        level === 0 ? 0.19 : 0.25,
        fascia,
      );
  for (const side of [-1, 1])
    beam(
      out,
      'roof',
      [x + side * edgeX, low - 0.21, z0 - overhang],
      [x + side * edgeX, low - 0.21, z1 + overhang],
      0.19,
      0.26,
      fascia,
    );
}

function sanctuary(out, level) {
  const { left, right, north, south, eave, ridge } = nave;
  box(out, 'base', left, right, north, south, podium - 0.48, podium + 0.48, terraceGranite);
  const y0 = podium + 0.29;
  for (const [z, sign] of [
    [north, -1],
    [south, 1],
  ]) {
    box(out, 'stone', left, right, z - 0.39, z + 0.39, y0, eave, granite);
    if (level >= 1) {
      const F = facade([xMid, z + sign * 0.391], [sign, 0]);
      fbox(out, 'concrete', F, -0.085, 0.085, 10.18, 13.42, 0, 0.071, crossColor);
      fbox(out, 'concrete', F, -0.64, 0.64, 11.79, 11.95, 0, 0.073, crossColor);
      if (sign === 1)
        for (const x of [-2.3, 2.3])
          opening(out, F, x, 8.4, 2.23, 3.11, {
            glassSlot: 'glass',
            frameSlot: 'concrete',
            glass,
            frame: concrete,
            frameWidth: 0.078,
            frameDepth: 0.074,
            mullions: 1,
            transoms: 2,
            d: 0.028,
          });
    }
  }
  for (const [x, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    const F = facade([x, 0], [0, -sign]);
    const u0 = sign === 1 ? -south : north,
      u1 = sign === 1 ? -north : south;
    fbox(out, 'stone', F, u0, u1, y0, 8.62, -0.46, 0, granite);
    fbox(out, 'stone', F, u0, u1, 12.99, eave, -0.46, 0, granite);
    const cuts = level < 2 ? 3 : 6;
    const span = (u1 - u0) / cuts;
    for (let i = 0; i < cuts; i++) {
      const u = u0 + span * (i + 0.5);
      const width = span * 0.69;
      fbox(out, 'stone', F, u - span * 0.5, u - width * 0.5, 8.62, 12.99, -0.43, 0, granite);
      fbox(out, 'stone', F, u + width * 0.5, u + span * 0.5, 8.62, 12.99, -0.43, 0, granite);
      if (level === 0)
        fbox(out, 'glass', F, u - width * 0.5, u + width * 0.5, 8.62, 12.99, -0.17, -0.12, glass);
      else
        opening(out, F, u, 8.62, width, 4.37, {
          glassSlot: 'glass',
          frameSlot: 'concrete',
          glass,
          frame: lightGranite,
          frameDepth: 0.12,
          frameWidth: 0.105,
          sill: false,
          mullions: 1,
          transoms: level === 1 ? 2 : 3,
          d: -0.08,
        });
      if (level >= 2) {
        const thin = width / (level === 3 ? 6 : 4);
        for (let j = 0; j < 4; j++) {
          const y = 9.12 + j * 0.718;
          fbox(
            out,
            'iron',
            F,
            u - width * 0.5 + thin * 0.45,
            u + width * 0.5 - thin * 0.45,
            y,
            y + 0.045,
            -0.016,
            0.026,
            shade,
          );
        }
      }
    }
    if (level >= 1)
      fbox(out, 'concrete', F, u0 - 0.32, u1 + 0.32, 8.45, 8.64, -0.34, 0.25, terraceTop);
  }
  roofBand(out, xMid, north - 0.39, south + 0.39, right - left, eave, ridge, 0.52, level);
}

function bellTower(out, level) {
  const { left, right, north, south } = t,
    mid = (left + right) / 2;
  box(out, 'base', left - 0.12, right + 0.12, north - 0.1, south + 0.1, 3.75, 4.86, terraceGranite);
  box(out, 'stone', left, right, north, south, 4.66, 11.72, granite);
  box(out, 'stone', left, left + 0.62, north, south, 11.68, towerTop, granite);
  const zMid = (north + south) / 2;
  for (const [z0, z1] of [
    [north, zMid - 0.69],
    [zMid + 0.69, south],
  ])
    box(out, 'stone', right - 0.62, right, z0, z1, 11.68, towerTop, granite);
  box(out, 'stone', right - 0.62, right, zMid - 0.69, zMid + 0.69, 15.73, towerTop, granite);
  const slotWidth = level === 0 ? 1.1 : 1.35;
  for (const z of [north, south - 0.65]) {
    for (const [lo, hi] of [
      [left, mid - slotWidth / 2],
      [mid + slotWidth / 2, right],
    ])
      box(out, 'stone', lo, hi, z, z + 0.65, 11.68, towerTop, granite);
    box(
      out,
      'stone',
      mid - slotWidth / 2,
      mid + slotWidth / 2,
      z,
      z + 0.65,
      15.75,
      towerTop,
      granite,
    );
    if (level >= 2) {
      box(
        out,
        'concrete',
        mid - slotWidth * 0.56,
        mid + slotWidth * 0.56,
        z - 0.04,
        z + 0.69,
        11.56,
        11.74,
        terraceTop,
      );
      box(
        out,
        'concrete',
        mid - slotWidth * 0.57,
        mid + slotWidth * 0.57,
        z - 0.04,
        z + 0.68,
        15.65,
        15.82,
        lightGranite,
      );
    }
  }
  if (level >= 1) {
    const center = [mid, (north + south) * 0.5];
    const circle = level === 1 ? 8 : level === 2 ? 12 : 20;
    const profile = [
      [12.86, 0.51],
      [12.99, 0.5],
      [13.24, 0.39],
      [13.5, 0.31],
      [13.75, 0.23],
      [13.88, 0.13],
    ];
    loft(
      out,
      'iron',
      profile.map(([y, r]) => radialRing(y, r, r, circle, center)),
      bronze,
    );
    beam(out, 'iron', [mid, 13.88, center[1]], [mid, 14.62, center[1]], 0.088, 0.095, bronze);
  }
  roofBand(out, mid, north, south, right - left, towerTop, 17.29, 0.22, level);
}

const retaining = [
  [-19.2, -13.3],
  [-9.8, -13.3],
  [-2.7, -13.38],
  [7.3, -14.47],
  [17.2, -15.84],
];
const lawn = [
  [-18.8, -12.94],
  [17.45, -15.47],
  [21.87, -7.92],
  [15.42, 8.6],
  [-19.64, 6.42],
];
function site(out, level) {
  for (const [i, [a, b]] of pairs(retaining).entries()) {
    const F = facade(b, [a[0] - b[0], a[1] - b[1]]);
    const l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const y = i === 0 ? 2.63 : podium - 0.18;
    const base = Math.min(grade(a), grade(b)) - 1.65;
    fbox(out, 'base', F, 0, l, base, y, -0.45, 0.12, terraceGranite);
    fbox(out, 'concrete', F, -0.035, l + 0.035, y, y + 0.19, -0.51, 0.19, terraceTop);
    if (level >= 2)
      for (let s = 0.65; s < l; s += 1.58) {
        const hh = base + (y - base) * 0.43;
        fbox(out, 'iron', F, s - 0.023, s + 0.023, hh, hh + 0.07, 0.12, 0.135, dark);
      }
  }
  cap(out, 'planting', lawn, podium - 0.072, earth);
  const landing = 4.25;
  box(out, 'concrete', -19.2, -11.1, -12.85, -8.52, 3.77, landing, terraceTop);
  const count = [3, 8, 15, 18][level];
  const stairs = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    const z = -16.92 + 7.64 * t;
    const y = Math.max(0.67 + 3.58 * t, grade([-16.28, z]) + 0.13);
    return [z, y];
  });
  for (const [i, [[z0, y0], [z1, y1]]] of pairs(stairs).entries())
    box(
      out,
      'base',
      -17.9,
      -14.7,
      z0,
      z1,
      Math.min(y0, y1) - 0.38,
      Math.max(y0 + 0.013, y1),
      i % 2 ? lightGranite : terraceTop,
    );
  if (level >= 1) {
    for (const x of [-17.72, -14.91]) {
      for (const [[z0, y0], [z1, y1]] of pairs(stairs))
        beam(out, 'iron', [x, y0 + 0.84, z0], [x, y1 + 0.84, z1], 0.065, 0.061, dark);
      for (let i = 0; i < stairs.length; i += Math.max(1, Math.floor(count / 4))) {
        const [z, y] = stairs[i];
        beam(out, 'iron', [x, y, z], [x, y + 0.84, z], 0.051, 0.054, dark);
      }
    }
  }
  box(out, 'stone', -7.8, -2.15, -10.72, -5.53, 4.07, 8.17, granite);
  box(out, 'concrete', -16.5, -2.04, -11.11, -4.94, 8.1, 8.49, concrete);
  box(out, 'stone', -15.76, -14.98, -10.75, -4.86, 4.12, 8.15, granite);
  box(out, 'glass', -14.8, -8.0, -5.38, -5.23, 4.25, 7.91, dark);
  if (level >= 1) {
    box(out, 'base', -15.0, -12.73, -12.88, -10.18, 3.78, 4.8, terraceGranite);
    box(out, 'stone', -14.77, -13.05, -12.962, -12.86, 4.16, 4.63, lightGranite);
  }
  if (level >= 2) {
    const F = facade([-11.36, -10.58], [-1, 0]);
    for (const u of [-1.77, -0.87, 0.05, 0.95, 1.85])
      fbox(out, 'iron', F, u - 0.027, u + 0.027, 4.24, 5.22, -0.02, 0.041, dark);
    fbox(out, 'iron', F, -1.82, 1.9, 5.2, 5.28, -0.042, 0.062, dark);
  }
}
function build(out, level) {
  site(out, level);
  sanctuary(out, level);
  bellTower(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'union-church-hong-kong-model.mjs';
const date = '2007-10-01';
const camera = [35, 23, -44],
  lookAt = [-1.0, 8.9, 0.4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: date,
    validFrom: date,
    validUntil: '2017-09-01',
  },
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1955 granite Union Church sanctuary, detached bell tower and Kennedy Road entrance as photographed in 2007.',
  camera,
  lookAt,
  sunDirection: [34, 67, -49],
  mediumFiContext: {
    scale: 1.43,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'former-granite-sanctuary-and-detached-tower', position: camera, lookAt },
    {
      name: 'kennedy-road-granite-front-and-service-stair',
      position: [16, 7, -31],
      lookAt: [-1, 8.6, -8.2],
    },
    { name: 'gable-and-side-window-wall', position: [26, 13, 22], lookAt: [6, 9.4, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'union-church-hong-kong-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.048, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction from the author-dedicated public-domain 2007 photographs, native ODbL site records and the Lands Department open ground survey.',
};
