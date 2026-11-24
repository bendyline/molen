import { readFileSync } from 'node:fs';
import {
  facade,
  fan,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const controls = read('native-map/babylon-fortress-shape-controls');
const [southern, northern] = controls.towers;
const { excavation, historicStoneBands } = controls;

const palette = {
  stone: rgb('bda579'),
  warmStone: rgb('ad956f'),
  paleStone: rgb('c6ad85'),
  crown: rgb('ac966f'),
  brick: rgb('936050'),
  dark: rgb('5a4739'),
  ground: rgb('9e8462'),
  paving: rgb('ac987b'),
  iron: rgb('4b443f'),
};
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.96 },
  brick: { slot: 'trim', graph: 'brick_longformat', roughness: 0.95 },
  broken: { slot: 'roof', graph: 'stone_limestone', roughness: 0.98 },
  ground: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.99 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.92 },
};

const circle = 2 * Math.PI;
const pointAt = ([x, z], radius, angle, h) => [
  x + radius * Math.cos(angle),
  h,
  z + radius * Math.sin(angle),
];
const blend = (a, b, i) => a + (b - a) * i;
const bandHeight = historicStoneBands.ashlarM + historicStoneBands.brickM;
const tint = (color, seed) => {
  const shade = 0.945 + 0.012 * ((((seed * 73 + 47) % 9) + 9) % 9);
  return color.map((channel) => channel * shade);
};

function drum(out, center, radius, inner, n, bottom, high, level, from = 0, to = circle) {
  const brokenTop = Array.from({ length: n + 1 }, (_, i) =>
    high(blend(from, to, i / n), i === n && to - from > circle - 0.01 ? 0 : i),
  );
  for (let i = 0; i < n; i++) {
    const a = blend(from, to, i / n);
    const b = blend(from, to, (i + 1) / n);
    const topA = brokenTop[i];
    const topB = brokenTop[i + 1];
    const p = (r, t, h) => pointAt(center, r, t, h);
    const v = (slot, y0, y1, shade, row) => {
      if (y0 >= Math.max(topA, topB) - 0.028) return;
      const aa = Math.min(y0, topA);
      const ab = Math.min(y0, topB);
      const ba = Math.min(y1, topA);
      const bb = Math.min(y1, topB);
      if (ba - aa < 0.015) {
        tri(out, slot, p(radius, b, ab), p(radius, a, aa), p(radius, b, bb), tint(shade, row + i));
      } else if (bb - ab < 0.015) {
        tri(out, slot, p(radius, b, ab), p(radius, a, aa), p(radius, a, ba), tint(shade, row + i));
      } else {
        quad4(
          out,
          slot,
          p(radius, b, ab),
          p(radius, a, aa),
          p(radius, a, ba),
          p(radius, b, bb),
          tint(shade, row + i),
        );
      }
    };
    const highest = Math.max(topA, topB);
    let row = 0;
    const spacing = level === 0 ? 3 * bandHeight : bandHeight;
    for (let y = bottom; y < highest - 0.025; y += spacing) {
      const stoneHeight = spacing - historicStoneBands.brickM;
      const courses = level >= 2 ? historicStoneBands.stoneCourses : 1;
      for (let course = 0; course < courses; course++) {
        const h = stoneHeight / courses;
        const shade = (row + course) % 4 ? palette.stone : palette.warmStone;
        v('ashlar', y + h * course, y + h * (course + 1), shade, row * 5 + course * 23);
      }
      v('brick', y + stoneHeight, y + spacing, palette.brick, row * 3 + 1);
      row++;
    }
    if (inner) {
      quad4(
        out,
        'ashlar',
        p(inner, a, bottom),
        p(inner, b, bottom),
        p(inner, b, topB),
        p(inner, a, topA),
        tint(palette.warmStone, i),
      );
      quad4(
        out,
        'broken',
        p(inner, a, topA),
        p(inner, b, topB),
        p(radius, b, topB),
        p(radius, a, topA),
        tint(palette.crown, i),
      );
    } else {
      tri(
        out,
        'broken',
        [center[0], topA, center[1]],
        p(radius, b, topB),
        p(radius, a, topA),
        palette.crown,
      );
    }
  }
  if (inner && to - from < circle - 0.01) {
    for (const [angle, i, reverse] of [
      [from, 0, true],
      [to, n, false],
    ]) {
      const end = [
        pointAt(center, inner, angle, bottom),
        pointAt(center, radius, angle, bottom),
        pointAt(center, radius, angle, brokenTop[i]),
        pointAt(center, inner, angle, brokenTop[i]),
      ];
      if (reverse) end.reverse();
      quad4(out, 'broken', ...end, palette.warmStone);
    }
  }
}

function brokenSouthTower(out, level) {
  const { center, radius } = southern;
  const base = excavation.base - 0.28;
  const crown = (angle, index) =>
    3.87 +
    3.75 * Math.max(0, -Math.cos(angle + 0.3)) +
    [0.12, -0.08, 0.06, 0.11, -0.29, 0.025, 0.2][(index * 11) % 7];
  const segments = [8, 18, 28, 42][level];
  drum(out, center, radius, radius - 2.1, segments, base, crown, level, 0.48, 5.35);
  const floor = level >= 2 ? 24 : 10;
  lathe(
    out,
    'ground',
    center,
    [
      [0.72, radius - 1.7, radius - 1.7],
      [0.84, radius - 1.7, radius - 1.7],
    ],
    floor,
    palette.ground,
    { capTop: true },
  );
  const pier = radius * 0.32;
  drum(out, center, pier + 1.5, pier, [8, 12, 18, 24][level], 0.82, () => 3.5, 0);
  const number = level ? 8 : 4;
  for (let i = 0; i < number; i++) {
    const angle = 0.18 + (circle * i) / number;
    const F = facade(center, [Math.cos(angle), Math.sin(angle)]);
    const outer = crown(angle, 0);
    fbox(
      out,
      'broken',
      F,
      pier + 1.25,
      radius - 1.72,
      0.8,
      Math.min(outer - 0.5, 3.9),
      -0.63,
      0.63,
      tint(palette.crown, i),
    );
  }
  if (level >= 2) {
    for (const [angle, height] of [
      [2.31, 4.3],
      [2.95, 5.15],
      [3.6, 4.1],
      [4.01, 5.27],
    ]) {
      const p = pointAt(center, radius + 0.035, angle, height);
      const F = facade([p[0], p[2]], [Math.sin(angle), -Math.cos(angle)]);
      fbox(out, 'broken', F, -0.45, 0.45, height - 0.32, height + 0.75, -0.012, 0.03, palette.dark);
      fbox(out, 'ashlar', F, -0.58, 0.58, height - 0.39, height - 0.24, 0, 0.17, palette.paleStone);
    }
  }
}

function towerUnderSaintGeorge(out, level) {
  const { center, radius, ground } = northern;
  drum(
    out,
    center,
    radius + 0.35,
    0,
    [8, 19, 28, 42][level],
    ground - 3.3,
    () => ground + 8.1,
    level,
  );
  const n = [8, 20, 28, 40][level];
  lathe(
    out,
    'ashlar',
    center,
    [
      [ground + 7.95, radius + 0.38, radius + 0.38],
      [ground + 8.18, radius + 0.48, radius + 0.48],
      [ground + 8.41, radius + 0.29, radius + 0.29],
    ],
    n,
    palette.paleStone,
    { capTop: true },
  );
}

function gate(out, level) {
  const { wallLine, portal, ground } = controls.southGate;
  const [west, east] = wallLine;
  const F = facade(portal, [east[0] - west[0], east[1] - west[1]]);
  const half = 3.05;
  const low = ground - 3.05;
  const spring = ground + 1.25;
  const peak = ground + 9.7;
  const topSide = (u, h, d = 0) => F.P(u, h, d);
  const wings = [-13.8, 14.4];
  for (const u of wings) {
    const p = F.P(u, 0, 2.2);
    const r = u < 0 ? 5.35 : 5.8;
    drum(
      out,
      [p[0], p[2]],
      r,
      0,
      [6, 13, 20, 28][level],
      low,
      () => peak + (u < 0 ? 1.1 : 0.15),
      level,
    );
    fbox(out, 'ashlar', F, u - r + 0.1, u + r - 0.1, low, peak - 0.07, -5.1, 1.7, palette.stone);
  }
  const wingGap = 13.8 + 2.1;
  const cadence = level === 0 ? 3 * bandHeight : bandHeight;
  const isVaultLevel = (height) => height < spring + half;
  for (let y = low; y < peak - 0.02; y += cadence) {
    const upper = Math.min(peak, y + cadence);
    const end = Math.min(upper, y + (cadence - bandHeight + historicStoneBands.ashlarM));
    const panels = isVaultLevel(y)
      ? [
          [-wingGap, -half],
          [half, wingGap],
        ]
      : [[-wingGap, wingGap]];
    for (const [a, b] of panels) {
      fbox(out, 'ashlar', F, a, b, y, end, -2.0, 0, palette.stone);
      if (upper - end > 0.025) fbox(out, 'brick', F, a, b, end, upper, -2, 0.035, palette.brick);
    }
  }
  // Shape the opening and its radial voussoirs against the stonework between the bastions.
  const n = [6, 8, 12, 16][level];
  const arch = (j, r, d) => {
    const angle = Math.PI * (1 - j / n);
    return topSide(r * Math.cos(angle), spring + r * Math.sin(angle), d);
  };
  for (let j = 0; j < n; j++) {
    const a = arch(j, half, 0.22);
    const b = arch(j + 1, half, 0.22);
    const va = arch(j, half + 0.44, 0.28);
    const vb = arch(j + 1, half + 0.44, 0.28);
    const column = (step) => half * Math.cos(Math.PI * (1 - step / n));
    const span = spring + half + 0.7;
    quad4(
      out,
      'ashlar',
      arch(j, half, 0.022),
      arch(j + 1, half, 0.022),
      topSide(column(j + 1), span, 0.022),
      topSide(column(j), span, 0.022),
      palette.stone,
    );
    quad4(out, 'broken', a, b, vb, va, tint(palette.paleStone, j));
    quad4(out, 'ashlar', b, a, arch(j, half, -1.96), arch(j + 1, half, -1.96), palette.warmStone);
  }
  fbox(
    out,
    'ashlar',
    F,
    -wingGap + 1.6,
    wingGap - 1.6,
    peak - 0.28,
    peak + 0.06,
    -2.2,
    0.3,
    palette.paleStone,
  );
  for (const sign of [-1, 1]) {
    fbox(
      out,
      'broken',
      F,
      sign * half - 0.24,
      sign * half + 0.24,
      low,
      spring + 0.02,
      -0.03,
      0.25,
      palette.crown,
    );
  }
  if (level >= 1) {
    const mask = [
      F.P(-half + 0.12, low + 0.01, -1.83),
      F.P(half - 0.12, low + 0.01, -1.83),
      ...Array.from({ length: n + 1 }, (_, i) => arch(n - i, half - 0.12, -1.83)),
    ];
    fan(out, 'iron', mask, tint(palette.dark, 1));
    if (level >= 2) {
      for (let i = -7; i <= 7; i++) {
        const x = 0.37 * i;
        const top = spring + Math.sqrt(half * half - x * x) - 0.12;
        fbox(out, 'iron', F, x - 0.034, x + 0.034, low + 0.05, top, -1.64, -1.55, palette.iron);
      }
      fbox(
        out,
        'iron',
        F,
        -half + 0.14,
        half - 0.14,
        ground + 1.02,
        ground + 1.1,
        -1.64,
        -1.54,
        palette.iron,
      );
    }
  }
}

function exposedCourt(out, level) {
  const { outline, rimHeights, base } = excavation;
  const center = [-19, 3.4];
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const a = outline[i];
    const b = outline[j];
    const inner = (p) => p.map((v, axis) => blend(v, center[axis], 0.168));
    const aa = inner(a),
      bb = inner(b);
    const pa = [aa[0], base, aa[1]],
      pb = [bb[0], base, bb[1]];
    tri(out, 'ground', [center[0], base - 0.015, center[1]], pb, pa, tint(palette.ground, i));
    const highA = [a[0], rimHeights[i] + 0.045, a[1]];
    const highB = [b[0], rimHeights[j] + 0.045, b[1]];
    tri(out, 'ground', pa, highB, highA, tint(palette.ground, i + 2));
    tri(out, 'ground', pa, pb, highB, tint(palette.ground, i + 1));
    if (level >= 2 && i >= 7) {
      const F = wallFace(aa, bb);
      fbox(out, 'ashlar', F, 0, F.length, base, base + 0.54, -0.4, 0.08, tint(palette.crown, i));
    }
  }
  if (level >= 2) {
    const fragments = [
      [-22.1, 11.4],
      [-18.3, -7.9],
      [-21.9, -9.5],
      [-20.7, -12.4],
      [-16.8, 10.9],
      [-15.2, 12.4],
      [-22.4, 14.1],
      [-23.0, -5.8],
    ];
    for (const [i, point] of fragments.entries()) {
      const size = 0.27 + (i % 3) * 0.15;
      const rotation = 0.14 + 0.6 * i;
      const F = facade(point, [Math.cos(rotation), Math.sin(rotation)]);
      fbox(
        out,
        'broken',
        F,
        -size,
        size * 0.75,
        base,
        base + 0.14 + (i % 4) * 0.06,
        -size * 0.58,
        size * 0.6,
        tint(palette.crown, i * 4),
      );
    }
  }
  const step = level === 0 ? 4 : level === 1 ? 2 : 1;
  for (let i = 0; i < 13; i += step) {
    const grade = base + 0.275 * i;
    const F = facade([-19.25, 15.7 + i * 0.39], [1, 0]);
    fbox(
      out,
      'broken',
      F,
      -1.37,
      1.37,
      grade - 0.25 * step,
      grade + 0.045,
      -0.25,
      0.14 + 0.39 * step,
      tint(palette.paving, i),
    );
  }
}

function build(out, level) {
  exposedCourt(out, level);
  brokenSouthTower(out, level);
  towerUnderSaintGeorge(out, level);
  gate(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'babylon-fortress-model.mjs';
const camera = [-147, 84, 68];
const lookAt = [1, 4, 18];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-fortress',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The two round towers, sunken canal-side court and south gate of Babylon Fortress in Coptic Cairo.',
  camera,
  lookAt,
  sunDirection: [-63, 64, 14],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The named ruin footprint identifies the southern Roman tower.',
  },
  groundCutout: {
    outline: excavation.outline,
    minHeight: -4.5,
    basis:
      'The southern tower has a narrow excavated court beside the surviving wall. The original height field continues at the cutout rim.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'canal-tower-and-excavated-court', position: [-38, 4, 20], lookAt: [-3, 1.9, 1] },
    { name: 'radial-rooms-and-northern-base', position: [36, 27, -14], lookAt: [1, 4, -14] },
    { name: 'south-gate-and-banded-bastions', position: [-46, 10, 100], lookAt: [-7, 5, 74] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'babylon-fortress-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.035, surfaces },
    },
  },
};
