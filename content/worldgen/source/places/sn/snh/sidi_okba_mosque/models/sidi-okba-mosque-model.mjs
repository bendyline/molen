/** The standing historic Sidi Okba prayer hall, tomb and minaret. */
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import {
  box as meshBox,
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const d = plan.dimensions;
const palette = 'palette:#ffffff';
const c = Object.fromEntries(
  Object.entries({
    lime: 'd6c5a9',
    fresh: 'dbcdb2',
    warm: 'c8b395',
    tan: 'b69f82',
    light: 'e5d7bb',
    mortar: 'd1bfa0',
    reveal: 'a48e73',
    muted: '8d785f',
    shadow: '635a4c',
    cedar: '83694f',
    parapet: 'ceb89a',
    roof: 'bfae92',
    floor: 'bdab8f',
    metal: '7d7564',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  lime: { slot: 'wall', graph: 'stucco', roughness: 0.98 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
  trim: { slot: 'trim', localRef: palette, roughness: 0.89 },
  roof: { slot: 'roof', localRef: palette, roughness: 0.96 },
  opening: { slot: 'window', localRef: palette, roughness: 0.89 },
};
const box = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
const flat = (out, slot, locate, normal, u0, u1, y0, y1, projection, tint) => {
  const coordinates = [
    [u0, y0, projection],
    [u1, y0, projection],
    [u1, y1, projection],
    [u0, y1, projection],
  ];
  quad(
    out,
    slot,
    coordinates.map((p) => locate(...p)),
    normal,
    tint,
  );
};

function archedPanel(out, locate, normal, u, y, half, spring, rise, steps, offset, slot, tint) {
  flat(out, slot, locate, normal, u - half, u + half, y, spring, offset, tint);
  for (let i = 0; i < steps; i++) {
    const p = (i * Math.PI) / steps;
    const q = ((i + 1) * Math.PI) / steps;
    const point = (a) => locate(u + Math.cos(a) * half, spring + Math.sin(a) * rise, offset);
    out.addTriangle(
      slot,
      palette,
      [locate(u, spring, offset), point(p), point(q)],
      normal,
      [
        [0.5, 0],
        [0, 1],
        [1, 1],
      ],
      tint,
    );
  }
}

function dome(out, x, z, radius, rise, level) {
  const stack = [3, 6, 9, 12][level];
  const sides = [8, 14, 22, 28][level];
  const base = d.roofY + 0.12;
  const layers = [
    [d.roofY - 0.08, radius, radius],
    [base, radius, radius, 'lime', c.warm],
  ];
  for (let i = 1; i <= stack; i++) {
    const theta = (i / stack) * Math.PI * 0.496;
    const r = radius * Math.cos(theta);
    layers.push([base + rise * Math.sin(theta), r, r, 'lime', i === 1 ? c.mortar : c.fresh]);
  }
  layers.push([base + rise + 0.005, 0.018, 0.018, 'lime', c.fresh]);
  profile(out, layers, sides, [x, z]);
  if (level >= 2) {
    profile(
      out,
      [
        [base + rise, 0.18, 0.18],
        [base + rise + 0.13, 0.14, 0.14, 'trim', c.tan],
        [base + rise + 0.22, 0.06, 0.06, 'trim', c.metal],
      ],
      8,
      [x, z],
    );
  }
}

function courtyardArcade(out, level) {
  const left = -11.9;
  const right = 11.9;
  const wallZ = -14.5;
  const backZ = -13.68;
  const outerY = 3.71;
  const y = 0.36;
  const count = 5;
  const span = (right - left) / count;
  const half = 1.91;
  const spring = 1.91;
  const rise = 1.22;
  const steps = [5, 7, 11, 16][level];
  box(out, 'stone', left, right, -1.35, y, wallZ - 0.66, -10.64, c.floor);
  box(
    out,
    'roof',
    left - 0.02,
    right + 0.02,
    outerY - 0.08,
    outerY + 0.19,
    wallZ - 0.11,
    -10.63,
    c.roof,
  );
  for (let i = 0; i <= count; i++) {
    const x = left + i * span;
    const w = span / 2 - half;
    const min = i === 0 ? left : x - w;
    const max = i === count ? right : x + w;
    box(out, 'lime', min, max, y, outerY, wallZ, backZ, c.warm);
    if (level >= 2) {
      box(
        out,
        'stone',
        min - 0.035,
        max + 0.035,
        y,
        y + 0.29,
        wallZ - 0.085,
        backZ + 0.065,
        c.reveal,
      );
      box(
        out,
        'trim',
        min - 0.05,
        max + 0.05,
        spring - 0.14,
        spring,
        wallZ - 0.085,
        backZ + 0.065,
        c.mortar,
      );
    }
    if (i === count) break;
    const u = x + span / 2;
    for (let j = 0; j < steps; j++) {
      const a = (Math.PI * j) / steps;
      const b = (Math.PI * (j + 1)) / steps;
      const point = (theta, z) => [u + half * Math.cos(theta), spring + rise * Math.sin(theta), z];
      const p = point(a, wallZ);
      const q = point(b, wallZ);
      for (const [z, sign, tint] of [
        [wallZ, -1, c.lime],
        [backZ, 1, c.warm],
      ]) {
        quad(
          out,
          'lime',
          [point(a, z), point(b, z), [q[0], outerY, z], [p[0], outerY, z]],
          [0, 0, sign],
          tint,
        );
      }
      const n = [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0];
      quad(out, 'stone', [p, q, point(b, backZ), point(a, backZ)], n, c.reveal);
    }
  }
}

function hall(out, level) {
  box(out, 'lime', -11.9, 11.9, d.foundationY, d.roofY, -10.7, 10.7, c.lime);
  box(out, 'stone', -11.97, 11.97, d.foundationY, 0.59, -10.77, 10.77, c.tan);
  box(out, 'roof', -12.03, 12.03, d.roofY - 0.19, d.roofY + 0.12, -10.82, 10.82, c.roof);
  box(out, 'lime', -11.97, 11.97, d.roofY + 0.11, d.parapetY, 10.38, 10.78, c.parapet);
  box(out, 'lime', -11.97, 11.97, d.roofY + 0.11, d.parapetY, -10.78, -10.38, c.parapet);
  box(out, 'lime', -11.97, -11.58, d.roofY + 0.11, d.parapetY, -10.39, 10.39, c.warm);
  box(out, 'lime', 11.58, 11.97, d.roofY + 0.11, d.parapetY, -10.39, 10.39, c.warm);
  const door = [-7.3, 0, 7.3];
  const front = (u, y, offset) => [u, y, -10.83 - offset];
  for (const [i, x] of door.entries()) {
    const tint = i === 0 ? c.cedar : c.shadow;
    archedPanel(
      out,
      front,
      [0, 0, -1],
      x,
      0.54,
      0.98,
      2.25,
      0.56,
      level >= 2 ? 10 : 5,
      0.02,
      'opening',
      tint,
    );
    if (i === 0 && level >= 2) {
      for (const v of [-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66]) {
        flat(
          out,
          'trim',
          front,
          [0, 0, -1],
          x + v - 0.024,
          x + v + 0.024,
          0.57,
          2.2,
          0.035,
          c.muted,
        );
      }
    }
  }
  for (const side of [-1, 1]) {
    const loc = (u, y, off) => [side * (11.91 + off), y, u];
    for (const z of [-5.8, 0.95, 6.6]) {
      archedPanel(
        out,
        loc,
        [side, 0, 0],
        z,
        2.41,
        0.33,
        3.37,
        0.29,
        level >= 2 ? 8 : 4,
        0.035,
        'opening',
        c.shadow,
      );
    }
  }
  for (const shape of [d.tombDome, d.mihrabDome]) dome(out, ...shape, level);
  courtyardArcade(out, level);
}

function tower(out, level) {
  const [x, z] = d.minaretCenter;
  const h = d.minaretWidth / 2;
  const lowerTop = d.minaretReliefTopY;
  const cap = d.belfryTopY;
  box(out, 'lime', x - h, x + h, d.foundationY, lowerTop, z - h, z + h, c.lime);
  box(
    out,
    'lime',
    x - h + 0.13,
    x + h - 0.13,
    lowerTop - 0.05,
    cap,
    z - h + 0.13,
    z + h - 0.13,
    c.fresh,
  );
  box(out, 'stone', x - h - 0.11, x + h + 0.11, 4.38, 4.67, z - h - 0.11, z + h + 0.11, c.warm);
  box(
    out,
    'trim',
    x - h - 0.04,
    x + h + 0.04,
    lowerTop - 0.18,
    lowerTop + 0.2,
    z - h - 0.04,
    z + h + 0.04,
    c.mortar,
  );
  box(
    out,
    'stone',
    x - h - 0.24,
    x + h + 0.24,
    cap - 0.46,
    cap - 0.13,
    z - h - 0.24,
    z + h + 0.24,
    c.warm,
  );
  box(
    out,
    'lime',
    x - h - 0.34,
    x + h + 0.34,
    cap - 0.13,
    cap + 0.18,
    z - h - 0.34,
    z + h + 0.34,
    c.light,
  );
  box(
    out,
    'roof',
    x - h - 0.06,
    x + h + 0.06,
    cap + 0.14,
    cap + 0.37,
    z - h - 0.06,
    z + h + 0.06,
    c.roof,
  );
  for (const [axis, sign] of [
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 1],
  ]) {
    const locate = (u, y, v) =>
      axis === 0 ? [x + u, y, z + sign * (h + v)] : [x + sign * (h + v), y, z + u];
    const normal = axis === 0 ? [0, 0, sign] : [sign, 0, 0];
    const useSteps = level >= 2 ? 11 : 5;
    for (const u of [-0.73, 0.73]) {
      archedPanel(
        out,
        locate,
        normal,
        u,
        11.12,
        0.43,
        12.72,
        0.57,
        useSteps,
        -0.105,
        'opening',
        c.shadow,
      );
      if (level >= 2) {
        const uv = ([a, b]) => locate(a, b, -0.077);
        const a = uv([u - 0.33, 11.18]),
          b = uv([u + 0.33, 11.18]),
          p = uv([u + 0.33, 11.33]),
          q = uv([u - 0.33, 11.33]);
        quad(out, 'trim', [a, b, p, q], normal, c.reveal);
        for (const delta of [-0.2, 0, 0.2])
          flat(
            out,
            'trim',
            locate,
            normal,
            u + delta - 0.014,
            u + delta + 0.014,
            11.34,
            12.32,
            -0.072,
            c.muted,
          );
      }
      if (sign === 1) {
        archedPanel(
          out,
          locate,
          normal,
          u,
          5.13,
          0.56,
          8.32,
          1.22,
          useSteps,
          0.015,
          'stone',
          c.reveal,
        );
        archedPanel(
          out,
          locate,
          normal,
          u,
          5.31,
          0.46,
          8.32,
          1.04,
          useSteps,
          0.034,
          'lime',
          c.warm,
        );
        if (level >= 2)
          flat(out, 'opening', locate, normal, u - 0.064, u + 0.064, 6.21, 6.87, 0.041, c.shadow);
      }
    }
    if (axis === 0)
      box(
        out,
        'lime',
        x - h - 0.03,
        x + h + 0.03,
        cap + 0.16,
        cap + 0.72,
        z + sign * (h - 0.095) - 0.13,
        z + sign * (h - 0.095) + 0.13,
        c.parapet,
      );
    else
      box(
        out,
        'lime',
        x + sign * (h - 0.095) - 0.13,
        x + sign * (h - 0.095) + 0.13,
        cap + 0.16,
        cap + 0.72,
        z - h + 0.04,
        z + h - 0.04,
        c.parapet,
      );
    const stations = level === 0 ? [-1.38, 1.38] : [-1.37, 0, 1.37];
    for (const u of stations) {
      const [px, , pz] = locate(u, 0, -0.1);
      box(
        out,
        'lime',
        px - 0.17,
        px + 0.17,
        cap + 0.61,
        d.towerParapetY,
        pz - 0.17,
        pz + 0.17,
        c.fresh,
      );
      if (level >= 2)
        box(
          out,
          'trim',
          px - 0.09,
          px + 0.09,
          d.towerParapetY - 0.055,
          d.towerParapetY + 0.11,
          pz - 0.09,
          pz + 0.09,
          c.light,
        );
    }
  }
  profile(
    out,
    [
      [cap + 0.3, 0.48, 0.48],
      [cap + 0.54, 0.48, 0.48, 'lime', c.warm],
      [d.towerTopY - 0.6, 0.21, 0.21, 'lime', c.fresh],
      [d.towerTopY - 0.18, 0.05, 0.05, 'trim', c.tan],
      [d.towerTopY, 0.028, 0.028, 'trim', c.metal],
    ],
    level >= 2 ? 12 : 7,
    [x, z],
  );
}

function draw(out, level) {
  hall(out, level);
  tower(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-36, 23, -41];
const lookAt = [-1, 5, -0.8];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Historic Sidi Okba mosque with its low plastered prayer hall, paired shallow domes, open entry arcade and square two-tier minaret.',
  camera,
  lookAt,
  sunDirection: [67, 119, -126],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stucco', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.45,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'historic-hall-and-court', position: [-29, 23, -37], lookAt: [-1, 5, -1] },
    { name: 'tower-relief-and-domes', position: [-25, 10, 31], lookAt: [-5, 9, 7] },
    { name: 'arched-entry-walk', position: [-16, 4, -28], lookAt: [0, 2.7, -13.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.18,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.57, surfaces },
      street: { export: 'street', errorMeters: 0.24, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original modeled historic exterior based on exact published public-domain Qualla originals, historical hall measurements, and modern site and elevation controls.',
};
