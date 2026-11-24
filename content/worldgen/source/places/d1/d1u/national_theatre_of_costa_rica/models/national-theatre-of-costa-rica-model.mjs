import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { mappedWidthM, eavesApproxM: eave, stageDomeCrownApproxM } = plan.dimensions;
const wallWidth = mappedWidthM / 2;
const front = facade([0, 35.5], [1, 0]);
const entrance = facade([0, 36.36], [1, 0]);
const back = facade([0, -35.15], [-1, 0]);

const base = rgb('77766d');
const lowerStone = rgb('a19b8a');
const mainStone = rgb('b6aa91');
const limestone = rgb('c2b498');
const lightStone = rgb('cfc3a5');
const marble = rgb('cdc9b5');
const darkMetal = rgb('3c4442');
const brass = rgb('56564b');
const windowShade = rgb('34383a');
const door = rgb('403a35');
const zinc = rgb('656b69');
const roofDark = rgb('545c59');

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.24 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.2 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.85 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
};

function bay(out, f, u, y, w, h, level, { arch = 0, d = 0, entranceDoor = false } = {}) {
  const r = w / 2;
  const spring = y + h - arch;
  const n = level === 3 ? 12 : level === 2 ? 8 : 4;
  const head =
    arch > 0
      ? Array.from({ length: n + 1 }, (_, i) => {
          const angle = (i * Math.PI) / n;
          return [u + r * Math.cos(angle), spring + arch * Math.sin(angle)];
        })
      : [
          [u + r, y + h],
          [u - r, y + h],
        ];
  const outline = [[u - r, y], [u + r, y], ...head];
  fan(
    out,
    entranceDoor ? 'wood' : 'glass',
    outline.map(([x, h]) => f.P(x, h, d + 0.012)),
    entranceDoor ? door : windowShade,
  );
  const casing = 0.19;
  if (level === 0) return;
  const border = [
    [u - r - casing, y],
    [u + r + casing, y],
    ...head.map(([x, h]) => [u + (x - u) * ((r + casing) / r), h + casing]),
  ];
  for (let i = 1; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const p = ([x, h], offset) => f.P(x, h, d + offset);
    quad4(
      out,
      'trim',
      p(outline[i], 0.13),
      p(border[i], 0.13),
      p(border[j], 0.13),
      p(outline[j], 0.13),
      limestone,
    );
    if (level > 1)
      quad4(
        out,
        'trim',
        p(outline[i], 0.013),
        p(outline[i], 0.13),
        p(outline[j], 0.13),
        p(outline[j], 0.013),
        mainStone,
      );
  }
  if (!entranceDoor)
    fbox(out, 'trim', f, u - r - 0.24, u + r + 0.24, y - 0.19, y - 0.03, d, d + 0.24, lightStone);
  if (level > 1) {
    for (const x of entranceDoor ? [u] : [u - w * 0.22, u, u + w * 0.22]) {
      fbox(
        out,
        'iron',
        f,
        x - 0.031,
        x + 0.031,
        y + 0.025,
        spring + arch * 0.33,
        d + 0.016,
        d + 0.065,
        brass,
      );
    }
    fbox(out, 'iron', f, u - r, u + r, spring - 0.22, spring - 0.15, d + 0.019, d + 0.067, brass);
    if (level === 3 && entranceDoor)
      for (const x of [u - w * 0.23, u + w * 0.23])
        fbox(out, 'trim', f, x - 0.045, x + 0.045, y + 1.02, y + 1.22, d + 0.024, d + 0.087, brass);
  }
}

function column(out, f, u, low, high, width, level) {
  fbox(
    out,
    'trim',
    f,
    u - width * 0.72,
    u + width * 0.72,
    low,
    low + 0.25,
    -0.015,
    0.47,
    lightStone,
  );
  fbox(
    out,
    'trim',
    f,
    u - width * 0.72,
    u + width * 0.72,
    high - 0.28,
    high,
    -0.015,
    0.5,
    lightStone,
  );
  if (level === 0) {
    fbox(
      out,
      'trim',
      f,
      u - width / 2,
      u + width / 2,
      low + 0.24,
      high - 0.27,
      -0.015,
      0.28,
      marble,
    );
    return;
  }
  const [x, , z] = f.P(u, low, 0.065);
  lathe(
    out,
    'trim',
    [x, z],
    [
      [low + 0.25, width * 0.49, width * 0.49],
      [low + 0.58, width * 0.48, width * 0.48],
      [high - 0.29, width * 0.43, width * 0.43],
    ],
    level === 3 ? 12 : 6,
    marble,
    { capTop: false },
  );
  if (level > 1)
    for (const offset of [-0.32, 0.32])
      fbox(
        out,
        'trim',
        f,
        u + width * offset - 0.08,
        u + width * offset + 0.08,
        high - 0.45,
        high - 0.27,
        0.005,
        0.48,
        lightStone,
      );
}

function pediment(out, f, u, y, width, rise, level, depth = 0.34) {
  const r = width / 2;
  tri(out, 'trim', f.P(u - r, y, depth), f.P(u + r, y, depth), f.P(u, y + rise, depth), mainStone);
  fbox(
    out,
    'trim',
    f,
    u - r - 0.17,
    u + r + 0.17,
    y - 0.23,
    y + 0.11,
    0.012,
    depth + 0.16,
    lightStone,
  );
  if (level === 0) return;
  for (const side of [-1, 1]) {
    const a = f.P(u + side * r, y, depth + 0.09);
    const b = f.P(u, y + rise, depth + 0.09);
    const c = f.P(u, y + rise + 0.21, depth + 0.09);
    const d = f.P(u + side * (r + 0.18), y + 0.17, depth + 0.09);
    quad4(out, 'trim', ...(side === 1 ? [b, a, d, c] : [a, b, c, d]), lightStone);
  }
}

function block(out, half, from, to, lower, upper) {
  abox(out, 'foundation', [-half, -4.6, from], [half, lower, to], lowerStone);
  abox(out, 'stone', [-half, lower, from], [half, upper, to], mainStone);
  abox(
    out,
    'trim',
    [-half - 0.15, lower - 0.14, from - 0.1],
    [half + 0.15, lower + 0.12, to + 0.1],
    limestone,
  );
  abox(
    out,
    'trim',
    [-half - 0.34, upper - 0.46, from - 0.22],
    [half + 0.34, upper, to + 0.22],
    lightStone,
  );
}

function rustication(out, f, left, right, bottom, top, level) {
  const step = level === 3 ? 0.68 : 1.19;
  for (let y = bottom + step; y < top - 0.14; y += step)
    fbox(out, 'foundation', f, left, right, y, y + 0.047, 0.001, 0.027, base);
}

function frontElevation(out, level) {
  const positions = [-11.6, -8.9, -6.3, -3.75, 0, 3.75, 6.3, 8.9, 11.6];
  abox(out, 'foundation', [-7.35, -0.35, 33.6], [7.35, 5.15, 36.36], lowerStone);
  abox(out, 'stone', [-7.35, 5.15, 33.6], [7.35, 12.67, 36.36], limestone);
  for (const [i, u] of positions.entries()) {
    const center = i >= 3 && i <= 5;
    const f = center ? entrance : front;
    const niche = i === 1 || i === 7;
    bay(
      out,
      f,
      u,
      center ? 0.75 : 1.55,
      center ? 2.32 : 1.31,
      center ? 3.3 : niche ? 2.55 : 2.17,
      level,
      { d: 0.038, entranceDoor: center, arch: niche ? 0.5 : 0 },
    );
    bay(out, f, u, center ? 6.07 : 6.24, center ? 2.32 : 1.54, center ? 4.8 : 4.28, level, {
      arch: center ? 0.8 : 0.57,
    });
    if (level > 1) {
      fbox(out, 'trim', f, u - 0.92, u + 0.92, 5.92, 6.11, 0.03, 0.43, lightStone);
      for (const x of [-0.63, -0.32, 0, 0.32, 0.63])
        fbox(out, 'trim', f, u + x - 0.055, u + x + 0.055, 6.11, 6.77, 0.17, 0.29, limestone);
      fbox(out, 'trim', f, u - 0.91, u + 0.91, 6.77, 6.91, 0.07, 0.38, lightStone);
    }
  }
  for (const u of [-7.05, -1.92, 1.92, 7.05]) column(out, entrance, u, 5.96, 11.75, 0.58, level);
  if (level > 0) {
    for (const u of [-12.78, -10.25, -7.67, 7.67, 10.25, 12.78])
      column(out, front, u, 5.94, 11.77, 0.37, level);
    for (const side of [-1, 1]) {
      rustication(
        out,
        front,
        side < 0 ? -13.25 : 7.38,
        side < 0 ? -7.38 : 13.25,
        0.43,
        4.98,
        level,
      );
      const cheek = facade([side * 13.4, 31.33], [0, -side]);
      for (const u of [-2.65, 0, 2.65]) {
        bay(out, cheek, u, 1.58, 1.15, 2.18, level);
        bay(out, cheek, u, 6.13, 1.54, 4.35, level, { arch: 0.57 });
      }
    }
    rustication(out, entrance, -7.34, 7.34, 0.42, 4.87, level);
  }
  for (const [low, high, depth] of [
    [5.02, 5.29, 0.22],
    [11.69, 12.14, 0.25],
    [12.18, 12.58, 0.45],
  ]) {
    fbox(out, 'trim', entrance, -7.51, 7.51, low, high, -0.04, depth, lightStone);
  }
  pediment(out, entrance, 0, 12.49, 15.36, 3.16, level);
  const steps = level > 0 ? [0, 1, 2, 3] : [0];
  for (const step of steps)
    abox(
      out,
      'foundation',
      [-7.45, -0.28, 36.26],
      [7.45, 0.18 + step * 0.17, 39.15 - step * 0.61],
      limestone,
    );
  abox(out, 'iron', [-6.77, 4.23, 36.41], [6.77, 4.49, 38.24], darkMetal);
  if (level > 1) {
    for (const x of [-6.19, -2.05, 2.05, 6.19])
      abox(out, 'iron', [x - 0.077, 3.4, 36.55], [x + 0.077, 4.24, 37.31], darkMetal);
    for (const z of [37.29, 38.21])
      abox(out, 'iron', [-6.87, 4.38, z], [6.87, 4.62, z + 0.055], brass);
  }
  for (const [u, y] of [
    [-7.12, 12.95],
    [0, 15.7],
    [7.12, 12.95],
  ]) {
    const [x, , z] = entrance.P(u, y, 0.03);
    abox(out, 'trim', [x - 0.36, y - 0.18, z - 0.35], [x + 0.36, y + 0.24, z + 0.35], limestone);
    if (y < 14)
      abox(out, 'trim', [x - 0.34, 12.57, z - 0.32], [x + 0.34, y - 0.18, z + 0.32], limestone);
    lathe(
      out,
      'trim',
      [x, z],
      [
        [y + 0.24, 0.24, 0.22],
        [y + 0.95, 0.19, 0.15],
        [y + 1.22, 0.24, 0.19],
        [y + 1.5, 0.078, 0.085],
        [y + 1.74, 0.091, 0.091],
        [y + 1.82, 0.025, 0.025],
      ],
      level > 1 ? 8 : 5,
      marble,
    );
    if (level > 0 && u === 0) {
      for (const side of [-1, 1])
        tri(
          out,
          'trim',
          entrance.P(side * 0.11, y + 1.0, 0.24),
          entrance.P(side * 0.58, y + 1.97, 0.01),
          entrance.P(side * 0.42, y + 1.32, -0.17),
          marble,
        );
    }
  }
}

function sideElevations(out, level) {
  const position = [-18.65, -14.01, -9.35, -4.68, 0, 4.68, 9.35, 14.01, 18.65];
  for (const side of [-1, 1]) {
    const f = facade([side * wallWidth, 1.3], [0, -side]);
    for (const [i, u] of position.entries()) {
      const curving = i === 1 || i === 7;
      const center = i >= 3 && i <= 5;
      const streetEntrance = i === 1 || center;
      const low = side > 0 && u > 1 ? 4.1 - (18.65 - u) * 0.035 : streetEntrance ? 1.0 : 2.2;
      bay(out, f, u, low, streetEntrance ? 1.72 : 1.43, Math.min(3, 5.93 - low), level, {
        arch: center ? 0.66 : 0,
        d: 0.032,
        entranceDoor: streetEntrance,
      });
      bay(out, f, u, 7.54, curving ? 1.62 : 1.35, curving ? 3.71 : 3.23, level, {
        arch: curving ? 0.64 : 0,
      });
      if (level > 0 && !curving) pediment(out, f, u, 10.97, 1.86, 0.49, level, 0.17);
      if (level > 1 && curving)
        for (const delta of [-1.14, 1.14]) column(out, f, u + delta, 7.42, 11.12, 0.37, level);
    }
    if (level > 1) {
      rustication(out, f, -21.3, 21.3, -2, 5.85, level);
      fbox(out, 'iron', f, -1.42, 1.42, 6.07, 6.25, 0.04, 1.34, darkMetal);
    }
  }
}

function stageElevation(out, level) {
  abox(out, 'foundation', [-4.33, -0.16, -36.37], [4.33, 5.87, -34.9], lowerStone);
  abox(out, 'stone', [-4.22, 5.87, -36.17], [4.22, 11.37, -34.9], limestone);
  const f = facade([0, -36.171], [-1, 0]);
  bay(out, f, 0, 3.91, 2.85, 1.74, level, { d: 0.201, entranceDoor: true });
  bay(out, f, 0, 6.77, 3.42, 3.66, level, { arch: 0.81 });
  for (const u of [-9.98, -7.81, -5.68, 5.68, 7.81, 9.98]) {
    bay(out, back, u, 3.18, 1.26, 2.39, level, { arch: 0.46 });
    bay(out, back, u, 7.52, 1.24, 2.51, level);
  }
  pediment(out, f, 0, 11.42, 8.2, 1.42, level);
  if (level > 1) {
    for (const u of [-2.48, 2.48]) column(out, f, u, 6.59, 11.3, 0.45, level);
    for (const side of [-1, 1]) {
      const start = [side * 3.78, 4.08, -36.31];
      const end = [side * 11.69, 3.23, -36.82];
      const outer = ([x, y, z]) => [x, y, z - 1.16];
      const ramp = [start, end, outer(end), outer(start)];
      quad4(out, 'foundation', ...(side > 0 ? ramp : ramp.slice().reverse()), lightStone);
    }
  }
}

function dome(out, level) {
  const midZ = -22.6;
  const crown = stageDomeCrownApproxM;
  const tiers = [
    [16.1, 11.26, 9.2],
    [20.7, 10.52, 8.51],
    [23.4, 8.73, 6.9],
    [24.96, 5.9, 4.59],
    [crown, 3.72, 3.02],
  ];
  const ring = ([y, x, z]) => [
    [x, y, midZ + z],
    [-x, y, midZ + z],
    [-x, y, midZ - z],
    [x, y, midZ - z],
  ];
  const bands = level === 0 ? [tiers[0], tiers[2], tiers[4]] : tiers;
  for (let i = 1; i < bands.length; i++) {
    const lower = ring(bands[i - 1]);
    const upper = ring(bands[i]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      quad4(out, 'roof', lower[k], lower[j], upper[j], upper[k], i % 2 ? zinc : roofDark);
    }
  }
  fan(out, 'roof', ring(tiers.at(-1)).reverse(), zinc);
  if (level === 0) return;
  const frontRoof = facade([0, midZ + 9.05], [1, 0]);
  const backRoof = facade([0, midZ - 9.05], [-1, 0]);
  const openings = [
    [frontRoof, [-5.15, 0, 5.15]],
    [backRoof, [-5.15, 0, 5.15]],
    [facade([11.16, midZ], [0, -1]), [0]],
    [facade([-11.16, midZ], [0, 1]), [0]],
  ];
  for (const [f, sites] of openings)
    for (const u of sites) {
      const n = level === 3 ? 16 : 8;
      const ringPoint = (i, r, d) => {
        const a = (i * 2 * Math.PI) / n;
        return f.P(u + Math.cos(a) * r, 19.82 + Math.sin(a) * r * 1.28, d);
      };
      for (let i = 0; i < n; i++) {
        tri(
          out,
          'glass',
          f.P(u, 19.82, 0.024),
          ringPoint(i, 0.46, 0.024),
          ringPoint(i + 1, 0.46, 0.024),
          windowShade,
        );
        quad4(
          out,
          'roof',
          ringPoint(i + 1, 0.46, 0.055),
          ringPoint(i, 0.46, 0.055),
          ringPoint(i, 0.57, 0.088),
          ringPoint(i + 1, 0.57, 0.088),
          zinc,
        );
      }
    }
}

function roofs(out, level) {
  const options = { overhang: 0.29, endSlot: 'stone', endColor: mainStone };
  gableRoof(out, 'roof', [0, 23.6], [0, 35.43], 26.8, 12.03, 15.1, zinc, options);
  gableRoof(out, 'roof', [0, -20.9], [0, 24.15], wallWidth * 2, eave - 0.06, 18.3, zinc, options);
  gableRoof(out, 'roof', [0, -35.14], [0, -21.5], 24.87, 12.03, 17.4, zinc, options);
  dome(out, level);
  for (const x of [-1, 1]) {
    for (const z of [-6.9, 6.95]) {
      const near = x * 12.42;
      const far = x * 5.8;
      abox(out, 'roof', [near - 0.17, 13.21, z - 1.7], [near + 0.17, 15.07, z + 1.7], roofDark);
      gableRoof(out, 'roof', [far, z], [near, z], 3.36, 15.11, 16.41, roofDark, {
        ...options,
        endSlot: 'roof',
        endColor: roofDark,
      });
      if (level > 0)
        bay(out, facade([x * 12.6, z], [0, -x]), 0, 13.82, 1.2, 1.38, level, { arch: 0.49 });
    }
  }
}

function build(out, level) {
  block(out, 13.4, 23.8, 35.5, 5.14, 12.08);
  block(out, wallWidth, -20.9, 24.03, 6.38, eave);
  block(out, 12.43, -35.15, -20.86, 5.87, 12.06);
  abox(out, 'stone', [-11.2, 12.02, -31.82], [11.2, 16.11, -13.42], mainStone);
  roofs(out, level);
  frontElevation(out, level);
  sideElevations(out, level);
  stageElevation(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-theatre-of-costa-rica-model.mjs';
const camera = [66, 34, 87];
const lookAt = [0, 10.5, 2];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The historic San José theatre with its Palladian entrance, broad auditorium and square curved stage dome.',
  camera,
  lookAt,
  sunDirection: [45, 61, 60],
  mediumFiContext: {
    scale: 0.85,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Native footprint envelope for the same main theatre building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-front-and-south-street', position: camera, lookAt },
    { name: 'west-foyer-and-central-pediment', position: [7, 12, 69], lookAt: [0, 8, 34] },
    { name: 'rear-stage-dome-and-roof', position: [-63, 43, -69], lookAt: [0, 15, -14] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-theatre-of-costa-rica-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.74, surfaces },
      street: { export: 'street', errorMeters: 0.25, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model using the public-domain Pan American Union plate of June 1911, published archaeological and architectural measurements, open elevations and the native mapped footprint.',
};
