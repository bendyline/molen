import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fan,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const measured = read('native-map/temple-of-the-feathered-serpent-teotihuacan-shape-controls');
const outline = outwardRing(measured.outline);
const cutout = outwardRing(measured.joinedPerimeter);
const color = Object.fromEntries(
  Object.entries({
    court: 'a89a7d',
    stone: '777269',
    cap: 'a69a83',
    shade: '726759',
    bright: 'ac9b82',
    spandrel: '8b7c67',
    detail: '95836d',
    shadow: '4e473d',
    collapsed: '776b57',
    upper: '968877',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  rubble: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95 },
  cap: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92 },
  carving: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96 },
  shadow: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 1 },
};
const corners = ([left, right, rear, front], y) => [
  [left, y, front],
  [right, y, front],
  [right, y, rear],
  [left, y, rear],
];
const inset = ([left, right, rear, front], n) => [left + n, right - n, rear + n, front - n];
const tint = (col, factor) => col.map((v) => v * factor);
const between = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

function shell(out, slot, lower, upper, palette) {
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    quad4(
      out,
      slot,
      lower[side],
      lower[next],
      upper[next],
      upper[side],
      palette[side] ?? palette[0],
    );
  }
}

function top(out, slot, ring, col) {
  quad4(out, slot, ring[0], ring[1], ring[2], ring[3], col);
}

function belt(out, footprint, bottom, high, retreat, ornamental) {
  const toe = corners(footprint, bottom);
  const talud = corners(inset(footprint, retreat), high - 1.15);
  const dado = corners(inset(footprint, retreat - 0.14), high - 1);
  const cornice = corners(inset(footprint, retreat - 0.28), high - 0.2);
  const roof = corners(inset(footprint, retreat - 0.17), high);
  const limestone = ornamental ? color.spandrel : color.stone;
  shell(out, 'rubble', toe, talud, [limestone, color.collapsed, color.collapsed, color.stone]);
  shell(out, 'cap', talud, dado, [tint(color.cap, 0.9)]);
  shell(out, 'stone', dado, cornice, [color.shade, color.collapsed, color.collapsed, color.stone]);
  shell(out, 'cap', cornice, roof, [color.cap]);
  top(out, 'cap', roof, color.cap);
  return footprint[3] - retreat + 0.14;
}

function rubbleFaces(out, lower, upper, tier, level) {
  if (level < 2) return;
  const outward = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 0, -1],
    [-1, 0, 0],
  ];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    const count = level === 2 ? 15 : 26;
    const onFace = (u, v) =>
      between(between(lower[side], lower[next], u), between(upper[side], upper[next], u), v).map(
        (n, i) => n + outward[side][i] * 0.028,
      );
    for (let i = 0; i < count; i++) {
      const a = (i + 0.12) / count;
      const b = a + (0.48 + (i % 4) * 0.06) / count;
      const h = 0.08 + ((i * 13 + tier * 7 + side * 3) % 56) / 100;
      const high = h + 0.13 + ((i + side) % 4) * 0.035;
      const tone = tint(tier >= 3 ? color.upper : color.stone, 0.92 + ((i * 13) % 18) / 100);
      quad4(
        out,
        'rubble',
        onFace(a, h + 0.024),
        onFace(b, h),
        onFace(b - 0.003, high),
        onFace(a + 0.003, high - 0.008),
        tone,
      );
    }
  }
}

const neck = [
  [-0.65, -0.22],
  [-0.49, -0.53],
  [0.49, -0.53],
  [0.65, -0.22],
  [0.52, 0.35],
  [0.23, 0.61],
  [-0.23, 0.61],
  [-0.52, 0.35],
];
const muzzle = [
  [-0.68, -0.31],
  [-0.5, -0.47],
  [0.48, -0.47],
  [0.7, -0.25],
  [0.61, 0.17],
  [0.39, 0.34],
  [-0.35, 0.41],
  [-0.61, 0.22],
];
const mask = [
  [-0.54, -0.26],
  [-0.4, -0.55],
  [0.42, -0.55],
  [0.55, -0.24],
  [0.6, 0.38],
  [0.37, 0.56],
  [-0.35, 0.56],
  [-0.6, 0.4],
];
const disc = [
  [-0.26, -0.11],
  [-0.11, -0.26],
  [0.11, -0.26],
  [0.26, -0.11],
  [0.26, 0.11],
  [0.11, 0.26],
  [-0.11, 0.26],
  [-0.26, 0.11],
];

function carving(out, f, polygon, u, y, scale, back, front, col, bevel = 0.86) {
  const core = polygon.map(([x, h]) => f.P(u + x * scale, y + h * scale, back));
  const edge = polygon.map(([x, h]) => f.P(u + x * scale * bevel, y + h * scale * bevel, front));
  for (let i = 0; i < core.length; i++) {
    const j = (i + 1) % core.length;
    quad4(out, 'carving', core[i], core[j], edge[j], edge[i], col);
  }
  fan(out, 'carving', edge, col);
}

function eye(out, f, u, y, scale, depth) {
  fan(
    out,
    'shadow',
    disc.map(([dx, dy]) => f.P(u + dx * scale, y + dy * scale, depth)),
    color.shadow,
  );
}

function serpent(out, f, u, y, scale, level) {
  if (level === 0) {
    fbox(
      out,
      'cap',
      f,
      u - 0.65 * scale,
      u + 0.65 * scale,
      y - 0.4 * scale,
      y + 0.53 * scale,
      -0.08,
      0.62 * scale,
      color.detail,
    );
    return;
  }
  carving(out, f, neck, u, y + 0.06 * scale, scale, -0.1, 0.42 * scale, color.detail);
  carving(out, f, muzzle, u, y - 0.085 * scale, scale, 0.26 * scale, 1.08 * scale, color.bright);
  if (level < 2) return;
  fbox(
    out,
    'shadow',
    f,
    u - 0.5 * scale,
    u + 0.5 * scale,
    y - 0.33 * scale,
    y - 0.16 * scale,
    1.059 * scale,
    1.094 * scale,
    color.shadow,
  );
  for (const side of [-1, 1]) {
    carving(
      out,
      f,
      disc,
      u + side * 0.29 * scale,
      y + 0.17 * scale,
      0.73 * scale,
      1.05 * scale,
      1.12 * scale,
      color.cap,
    );
    eye(out, f, u + side * 0.29 * scale, y + 0.17 * scale, 0.29 * scale, 1.123 * scale);
  }
  if (level === 3) {
    for (let tooth = -2; tooth <= 2; tooth++) {
      const x = u + tooth * 0.149 * scale;
      tri(
        out,
        'carving',
        f.P(x - 0.046 * scale, y - 0.174 * scale, 1.108 * scale),
        f.P(x + 0.007 * scale, y - 0.277 * scale, 1.109 * scale),
        f.P(x + 0.057 * scale, y - 0.174 * scale, 1.108 * scale),
        color.bright,
      );
    }
    for (let i = -2; i <= 2; i++) {
      const start = u + i * 0.223 * scale;
      tri(
        out,
        'carving',
        f.P(start - 0.112 * scale, y + 0.448 * scale, 0.389 * scale),
        f.P(start + 0.117 * scale, y + 0.448 * scale, 0.389 * scale),
        f.P(start + i * 0.077 * scale, y + (0.765 - Math.abs(i) * 0.074) * scale, 0.19 * scale),
        color.cap,
      );
    }
  }
}

function squaredHead(out, f, u, y, scale, level) {
  if (level === 0) {
    fbox(
      out,
      'stone',
      f,
      u - 0.58 * scale,
      u + 0.58 * scale,
      y - 0.49 * scale,
      y + 0.53 * scale,
      -0.05,
      0.51 * scale,
      color.stone,
    );
    return;
  }
  carving(out, f, mask, u, y, scale, -0.06, 0.76 * scale, color.cap, 0.94);
  fbox(
    out,
    'cap',
    f,
    u - 0.64 * scale,
    u + 0.64 * scale,
    y + 0.33 * scale,
    y + 0.48 * scale,
    0.49 * scale,
    0.79 * scale,
    color.bright,
  );
  if (level < 2) return;
  for (const side of [-1, 1]) {
    carving(
      out,
      f,
      disc,
      u + side * 0.286 * scale,
      y + 0.075 * scale,
      0.73 * scale,
      0.728 * scale,
      0.84 * scale,
      color.bright,
      0.94,
    );
    fbox(
      out,
      'shadow',
      f,
      u + (side * 0.286 - 0.077) * scale,
      u + (side * 0.286 + 0.077) * scale,
      y - 0.006 * scale,
      y + 0.153 * scale,
      0.833 * scale,
      0.851 * scale,
      color.shadow,
    );
    fbox(
      out,
      'stone',
      f,
      u + (side * 0.31 - 0.093) * scale,
      u + (side * 0.31 + 0.093) * scale,
      y - 0.43 * scale,
      y - 0.16 * scale,
      0.72 * scale,
      0.9 * scale,
      color.stone,
    );
  }
  for (const dy of [-0.29, -0.39])
    fbox(
      out,
      'shadow',
      f,
      u - 0.2 * scale,
      u + 0.2 * scale,
      y + dy * scale,
      y + (dy + 0.052) * scale,
      0.754 * scale,
      0.782 * scale,
      color.shadow,
    );
}

function westRelief(out, box, z, y, tier, level) {
  const f = facade([0, z + 0.11], [1, 0]);
  const count = 7 - tier;
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const u = side * (8.8 + i * 2.53);
      if (u < box[0] + 1.25 || u > box[1] - 1.25) continue;
      const scale = 1.04 + ((i + 2 * tier) % 4) * 0.048;
      const sculpt = (i + (side > 0 ? 1 : 0)) % 2 === 0 ? serpent : squaredHead;
      sculpt(out, f, u, y, scale, level);
      if (level >= 2) {
        const offset = side * 1.26;
        for (const band of [-0.33, -0.14, 0.05]) {
          const a = f.P(u + offset - 0.66, y + band, 0.025);
          const b = f.P(u + offset + 0.58, y + band + 0.12, 0.026);
          const c = f.P(u + offset + 0.62, y + band + 0.232, 0.085);
          const d = f.P(u + offset - 0.64, y + band + 0.126, 0.084);
          quad4(out, 'cap', a, b, c, d, tint(color.detail, 0.9 + (i % 3) * 0.065));
        }
        if (level === 3) {
          const x = u + offset;
          carving(out, f, disc, x, y - 0.53, 0.61, -0.025, 0.11, color.bright);
        }
      }
    }
  }
}

function temple(out, level) {
  const base = [-32.58, 32.56, -32.78, 32.78];
  shell(out, 'rubble', corners(base, -1.35), corners(base, 0.58), [color.stone]);
  for (let i = 0; i < 3; i++) {
    const footprint = inset(base, i * 3.6);
    const high = 0.58 + (i + 1) * 2.9;
    const z = belt(out, footprint, high - 2.9, high, 1.475, true);
    westRelief(out, footprint, z, high - 0.68, i, level);
    rubbleFaces(
      out,
      corners(footprint, high - 2.86),
      corners(inset(footprint, 1.43), high - 1.2),
      i,
      level,
    );
  }
  const hill = [
    [[-21.71, 21.59, -22.03, 21.84], 9.28],
    [[-19.62, 19.23, -20.27, 20.1], 10.85],
    [[-17.63, 16.61, -18.52, 17.05], 12.05],
    [[-15.14, 14.3, -17.37, 15.01], 13.72],
    [[-12.26, 11.66, -15.53, 12.27], 15.41],
    [[-10.34, 9.86, -12.99, 9.96], 17.38],
    [[-8.49, 8.46, -10.59, 7.77], 18.47],
    [[-6.98, 6.23, -8.6, 6.28], 19.03],
  ];
  let previous = corners(hill[0][0], hill[0][1]);
  for (let i = 1; i < hill.length; i++) {
    const ring = corners(hill[i][0], hill[i][1]).map(([x, y, z], side) => [
      x,
      y + ((i + side * 2) % 5) * 0.091,
      z,
    ]);
    for (let side = 0; side < 4; side++) {
      const j = (side + 1) % 4;
      const tone = tint(color.upper, 0.91 + ((i * 2 + side * 7) % 12) / 100);
      tri(out, 'rubble', previous[side], previous[j], ring[j], tone);
      tri(out, 'rubble', previous[side], ring[j], ring[side], tone);
    }
    rubbleFaces(out, previous, ring, i + 3, level);
    previous = ring;
  }
  const crown = [-0.45, 19.4, -1.25];
  for (let side = 0; side < 4; side++)
    tri(out, 'rubble', previous[side], previous[(side + 1) % 4], crown, color.upper);
}

function steps(out, { axis, width, foot, crest, low, high, guards }, level, templeStair = false) {
  const n = level === 0 ? 7 : level === 1 ? 20 : templeStair ? 51 : 37;
  const left = axis - width / 2;
  const right = axis + width / 2;
  const depth = (foot - crest) / n;
  const rise = (high - low) / n;
  quad4(
    out,
    'stone',
    [left, low - 1, foot],
    [right, low - 1, foot],
    [right, low, foot],
    [left, low, foot],
    color.stone,
  );
  quad4(
    out,
    'stone',
    [right, high - 1, crest],
    [left, high - 1, crest],
    [left, high, crest],
    [right, high, crest],
    color.stone,
  );
  for (let i = 0; i < n; i++) {
    const z = foot - i * depth,
      y = low + i * rise;
    const tone = tint(color.cap, 0.91 + ((i * 13) % 11) / 100);
    quad4(
      out,
      'stone',
      [left, y, z],
      [right, y, z],
      [right, y + rise, z],
      [left, y + rise, z],
      tone,
    );
    quad4(
      out,
      'cap',
      [left, y + rise, z],
      [right, y + rise, z],
      [right, y + rise, z - depth],
      [left, y + rise, z - depth],
      tone,
    );
  }
  for (const side of [-1, 1]) {
    const x = axis + side * (width / 2 + guards / 2);
    const a = x - guards / 2;
    const b = x + guards / 2;
    const bottomY = low - 0.6,
      bottomZ = foot + 0.64;
    quad4(
      out,
      'stone',
      [a, bottomY, bottomZ],
      [b, bottomY, bottomZ],
      [b, low + 0.55, bottomZ],
      [a, low + 0.55, bottomZ],
      color.stone,
    );
    quad4(
      out,
      'stone',
      [a, bottomY, bottomZ],
      [a, low + 0.55, bottomZ],
      [a, high + 0.65, crest],
      [a, high - 1.32, crest],
      color.stone,
    );
    quad4(
      out,
      'stone',
      [b, bottomY, bottomZ],
      [b, high - 1.32, crest],
      [b, high + 0.65, crest],
      [b, low + 0.55, bottomZ],
      color.stone,
    );
    quad4(
      out,
      'cap',
      [a, low + 0.55, bottomZ],
      [b, low + 0.55, bottomZ],
      [b, high + 0.65, crest],
      [a, high + 0.65, crest],
      color.cap,
    );
    if (templeStair && level >= 1) {
      for (const t of [0.14, 0.38, 0.63]) {
        const f = facade([x, bottomZ + (crest - bottomZ) * t + 0.3], [1, 0]);
        serpent(out, f, 0, low + 0.16 + (high - low) * t, 0.85, level);
      }
    }
  }
}

function adosada(out, level) {
  const base = [-26.36, 24.36, 33.1, 66.49];
  shell(out, 'rubble', corners(base, -1.4), corners(base, 0.41), [color.stone]);
  for (let i = 0; i < 4; i++) {
    const box = inset(base, i * 2.66);
    const high = 0.4 + (i + 1) * 2.3;
    belt(out, box, high - 2.3, high, 1.42, false);
    rubbleFaces(out, corners(box, high - 2.26), corners(inset(box, 1.38), high - 1.18), i, level);
  }
  steps(
    out,
    { axis: -0.47, width: 8.15, foot: 70.91, crest: 57.07, low: 0.16, high: 9.6, guards: 0.84 },
    level,
  );
}

function build(out, level) {
  temple(out, level);
  adosada(out, level);
  steps(
    out,
    { axis: -0.21, width: 10.39, foot: 34.11, crest: 10.72, low: 0.58, high: 17.38, guards: 1.07 },
    level,
    true,
  );
  abox(out, 'rubble', [-26.42, 0.11, 32.48], [24.4, 0.42, 33.19], color.court, { bottom: false });
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'temple-of-the-feathered-serpent-teotihuacan-model.mjs';
const camera = [80, 55, 125];
const lookAt = [0, 5, 21];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'archaeological-temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Teotihuacan’s excavated pyramid with a relief-covered western façade and the adjoining four-tier Plataforma Adosada.',
  camera,
  lookAt,
  sunDirection: [42, 84, 67],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The main pyramid follows the named and independently measured rectangular footprint.',
  },
  groundCutout: {
    outline: cutout,
    basis:
      'Inside the joined footprints the ancient masonry and narrow excavated gap supply the visible surface, preserving the original terrain outside.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'western-court-and-adosada-stairs', position: [-25, 14, 111], lookAt: [0, 7, 25] },
    {
      name: 'three-carved-courses-and-central-stair',
      position: [-36, 12, 51],
      lookAt: [-9, 5, 22],
    },
    {
      name: 'projecting-serpents-and-mask-carvings',
      position: [19, 5.3, 36.7],
      lookAt: [13, 4.75, 27],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'temple-of-the-feathered-serpent-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.65, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.08, surfaces },
    },
  },
};
