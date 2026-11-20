import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  brick: 'aa6657',
  darkBrick: '8e5a4c',
  brickRed: 'a15b4d',
  trim: 'e1cdb1',
  shadedTrim: 'c9b499',
  base: 'a59a87',
  tile: '605952',
  glazed: '4d5248',
  post: '887b64',
  dark: '634c3e',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.95),
  trim: surface('trim', 'stucco', 0.91),
  stone: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'tile_flat', 0.89),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.02 },
  solid: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
};

function floorMass(out, outline, bottom, top, material, color) {
  shell(out, outline, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: material,
    roof: material,
    color,
  });
}

function opening(out, level, w, a, b, base, top) {
  const width = b - a;
  const center = (a + b) / 2;
  const radius = width * 0.38;
  const spring = top - 1.13;
  const rise = Math.min(0.82, radius * 0.76);
  const lo = center - radius;
  const hi = center + radius;
  panel(out, 'brick', w, a, lo, base, top, 0.015, colors.brick);
  panel(out, 'brick', w, hi, b, base, top, 0.015, colors.brick);
  const n = [2, 5, 9, 14][level];
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / n);
    return [center + radius * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
  for (const [[u, y], [v, h]] of pairs(arch)) {
    face(
      out,
      'brick',
      [w.p(u, y, 0.018), w.p(v, h, 0.018), w.p(v, top, 0.018), w.p(u, top, 0.018)],
      w.normal,
      colors.brickRed,
    );
    if (level === 0) continue;
    const trim = 0.13 + Math.min(0.045, 0.012 * width);
    const ou = center + ((u - center) * (radius + trim)) / radius;
    const ov = center + ((v - center) * (radius + trim)) / radius;
    const oy = spring + ((y - spring) * (rise + trim)) / rise;
    const oh = spring + ((h - spring) * (rise + trim)) / rise;
    face(
      out,
      'trim',
      [w.p(u, y, 0.06), w.p(v, h, 0.06), w.p(ov, oh, 0.07), w.p(ou, oy, 0.07)],
      w.normal,
      colors.trim,
    );
    if (level === 1) continue;
    face(
      out,
      'brick',
      [w.p(u, y, -0.31), w.p(v, h, -0.31), w.p(v, h, 0.045), w.p(u, y, 0.045)],
      [0, -1, 0],
      colors.darkBrick,
    );
  }
  if (level >= 2) {
    for (const [u, size] of [
      [lo, -1],
      [hi, 1],
    ]) {
      const f = w.p(u, base, 0.02);
      const a = w.p(u + size, base, 0.02);
      const turn = [f[0] - a[0], 0, f[2] - a[2]];
      face(
        out,
        'brick',
        [w.p(u, base, -0.31), w.p(u, spring, -0.31), w.p(u, spring, 0.045), f],
        turn,
        colors.darkBrick,
      );
      const [left, right] = size < 0 ? [u - 0.14, u] : [u, u + 0.14];
      panel(out, 'trim', w, left, right, base + 0.08, spring, 0.058, colors.shadedTrim);
    }
    panel(out, 'trim', w, lo - 0.15, lo + 0.02, spring - 0.055, spring + 0.055, 0.094, colors.trim);
    panel(out, 'trim', w, hi - 0.02, hi + 0.15, spring - 0.055, spring + 0.055, 0.094, colors.trim);
  }
  return [lo, hi];
}

function railing(out, level, w, lo, hi, bottom) {
  const y = bottom + 0.78;
  beam(out, 'trim', w.p(lo - 0.02, y, -0.19), w.p(hi + 0.02, y, -0.19), 0.12, 0.15, colors.trim);
  if (level === 0 || (level === 1 && w.normal[2] < 0.45)) return;
  const count = level === 1 ? 2 : Math.max(2, Math.round((hi - lo) / 0.38));
  for (let i = 1; i <= count; i++) {
    const u = mix(lo, hi, i / (count + 1));
    const b = w.p(u, bottom, -0.19);
    if (level === 3) {
      loft(
        out,
        'trim',
        [
          [bottom, 0.065],
          [bottom + 0.19, 0.062],
          [bottom + 0.37, 0.091],
          [bottom + 0.58, 0.053],
          [y, 0.064],
        ].map(([h, r]) => radialRing(h, r, r, 6, [b[0], b[2]])),
        colors.trim,
      );
    } else {
      beam(out, 'trim', b, w.p(u, y, -0.19), 0.088, 0.087, colors.trim);
    }
  }
}

function arcades(out, level) {
  const [ground, deck, eave] = d.levels;
  const walls = pairs(closed(d.outline)).map(([a, b]) => edge(a, b, areaSign(d.outline)));
  floorMass(
    out,
    d.outline,
    (p) => Math.min(ground - 0.45, grade(p) - 0.21),
    ground,
    'stone',
    colors.base,
  );
  floorMass(out, d.outline, deck - 0.18, deck, 'trim', colors.shadedTrim);
  floorMass(out, d.outline, eave - 0.17, eave + 0.2, 'trim', colors.trim);
  for (const [side, w] of walls.entries()) {
    const n = Math.max(1, Math.round(w.length / (level === 0 ? 5.4 : 3.8)));
    for (const [story, base, top] of [
      [0, ground, deck - 0.17],
      [1, deck, eave - 0.16],
    ]) {
      for (let i = 0; i < n; i++) {
        const a = (i * w.length) / n;
        const b = ((i + 1) * w.length) / n;
        const [lo, hi] = opening(out, level, w, a, b, base, top);
        if (story === 1 && (level > 0 || w.normal[2] > 0.56)) railing(out, level, w, lo, hi, base);
      }
    }
    if (level >= 1) {
      panel(out, 'trim', w, 0, w.length, deck - 0.31, deck - 0.18, 0.12, colors.shadedTrim);
      panel(out, 'trim', w, 0, w.length, eave - 0.29, eave - 0.09, 0.16, colors.trim);
    }
    if (level === 3) {
      panel(out, 'trim', w, 0, w.length, eave - 0.47, eave - 0.41, 0.12, colors.trim);
      if (d.frontProjectionIndices.includes(side)) {
        const vents = Math.ceil(w.length / 0.38);
        for (let i = 0; i < vents; i++) {
          const u = ((i + 0.5) * w.length) / vents;
          panel(out, 'solid', w, u - 0.052, u + 0.052, eave - 0.4, eave - 0.29, 0.12, colors.post);
        }
      }
    }
  }
}

function rooms(out, level) {
  const [x0, z0, x1, z1] = d.core;
  const [ground, deck, eave] = d.levels;
  const core = rect(x0, z0, x1, z1);
  floorMass(out, core, ground, eave, 'brick', colors.darkBrick);
  for (const outline of [rect(-15.45, -11.53, -9.35, -2.18), rect(11.74, -8.91, 16.74, -3.63)])
    floorMass(out, outline, ground, eave, 'brick', colors.darkBrick);
  if (level === 0) return;
  for (const [a, b] of pairs(closed(core))) {
    const w = edge(a, b);
    const n = Math.max(1, Math.round(w.length / 3.5));
    for (const y of [ground + 0.36, deck + 0.36]) {
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * w.length) / n;
        panel(out, 'trim', w, u - 0.7, u + 0.7, y - 0.12, y + 2.19, 0.06, colors.shadedTrim);
        panel(out, 'glass', w, u - 0.57, u + 0.57, y, y + 2.07, 0.09, colors.glazed);
        if (level >= 2) {
          panel(out, 'solid', w, u - 0.035, u + 0.035, y, y + 2.07, 0.12, colors.post);
          panel(out, 'solid', w, u - 0.57, u + 0.57, y + 1.23, y + 1.29, 0.12, colors.post);
        }
      }
    }
  }
}

function hip(out, x0, z0, x1, z1, low, high) {
  const z = (z0 + z1) / 2;
  const inset = Math.min((x1 - x0) * 0.32, (z1 - z0) * 0.47);
  const ridge = [
    [x0 + inset, high, z],
    [x1 - inset, high, z],
  ];
  const a = [x0, low, z0],
    b = [x1, low, z0],
    c = [x1, low, z1],
    d = [x0, low, z1];
  face(out, 'roof', [a, b, ridge[1], ridge[0]], [0, 1, 0], colors.tile);
  face(out, 'roof', [d, c, ridge[1], ridge[0]], [0, 1, 0], colors.tile);
  face(out, 'roof', [a, d, ridge[0]], [0, 1, 0], colors.tile);
  face(out, 'roof', [b, c, ridge[1]], [0, 1, 0], colors.tile);
}

function roof(out, level) {
  const eave = d.levels[2];
  hip(out, -11.3, -6.25, 10.86, 7.56, eave + 0.17, d.ridge);
  hip(out, -16.18, -12.01, -8.29, -2.7, eave + 0.12, 10.61);
  hip(out, 7.03, -9.7, 17.98, -2.88, eave + 0.14, 10.16);
  const [a, b] = [d.outline[20], d.outline[21]];
  const w = edge(a, b, areaSign(d.outline));
  const l = w.length;
  const low = eave + 0.48;
  const top = d.pediment;
  floorMass(
    out,
    [d.outline[19], a, b, d.outline[22]],
    eave - 0.02,
    low + 0.08,
    'brick',
    colors.brick,
  );
  face(
    out,
    'brick',
    [w.p(-0.32, low, 0.18), w.p(l + 0.32, low, 0.18), w.p(l * 0.5, top, 0.18)],
    w.normal,
    colors.brickRed,
  );
  face(
    out,
    'roof',
    [
      w.p(-0.32, low, 0.18),
      w.p(l * 0.5, top, 0.18),
      w.p(l * 0.5, top - 0.28, -1.81),
      w.p(-0.32, low, -1.7),
    ],
    [0, 1, 0],
    colors.tile,
  );
  face(
    out,
    'roof',
    [
      w.p(l + 0.32, low, 0.18),
      w.p(l * 0.5, top, 0.18),
      w.p(l * 0.5, top - 0.28, -1.81),
      w.p(l + 0.32, low, -1.7),
    ],
    [0, 1, 0],
    colors.tile,
  );
  beam(out, 'trim', w.p(-0.35, low, 0.21), w.p(l + 0.35, low, 0.21), 0.13, 0.18, colors.trim);
  for (const u of [-0.34, l + 0.34])
    beam(out, 'trim', w.p(u, low, 0.22), w.p(l * 0.5, top + 0.05, 0.22), 0.16, 0.17, colors.trim);
  if (level >= 1) {
    const crest = Array.from({ length: level === 3 ? 20 : 12 }, (_, i) => {
      const a = (2 * Math.PI * i) / (level === 3 ? 20 : 12);
      return w.p(l * 0.5 + Math.cos(a) * 0.35, low + 0.67 + Math.sin(a) * 0.29, 0.192);
    });
    face(out, 'trim', crest, w.normal, colors.shadedTrim);
  }
}

function entrance(out, level) {
  const [x, z] = d.stairAt;
  const count = level === 0 ? 2 : 4;
  const top = d.levels[0] - 0.022;
  const floor = Math.min(-0.2, grade([x, z + 2.5]) - 0.14);
  for (let i = 0; i < count; i++) {
    const width = 4.13 + i * 0.095;
    const y = mix(top, floor + 0.1, i / count);
    const depth = 0.76 / count;
    block(
      out,
      'stone',
      x - width / 2,
      floor,
      z + i * depth,
      width,
      y - floor,
      depth + 0.018,
      colors.base,
    );
  }
  cap(out, 'stone', rect(x - 2.04, z - 0.6, x + 2.04, z + 0.02), top, colors.base);
}

function build(out, level) {
  arcades(out, level);
  rooms(out, level);
  roof(out, level);
  entrance(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'old-tainan-magistrate-residence-model.mjs';
const camera = [37, 20, 48];
const lookAt = [0, 4.25, 0];
const errors = { district: 0.43, street: 0.15, closeup: 0.055 };
export const tainanResidenceAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  title: plan.title,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Mapped public plaza and the original Tainan ground field set the restored mansion’s front access.',
  brief:
    'Restored west-facing Tainan governor’s residence with two levels of open red-brick arcades, three chamfered bays and a low triangular pediment.',
  camera,
  lookAt,
  sunDirection: [37, 74, 54],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.93,
    basis:
      'Named two-storey building perimeter with the native forward projections and back wings.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stucco', 'tile_flat', 'stone_ashlar'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'two-storey-west-arcades', position: [-1, 7.2, 39], lookAt: [-0.55, 4.65, 7.2] },
    { name: 'front-steps-and-pediment', position: [12, 5.72, 24.6], lookAt: [-0.55, 5.3, 8.38] },
    { name: 'rear-wings-and-side-verandas', position: [-32, 18, -38], lookAt: [0, 4.3, -4.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tainan-residence-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.03,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
};
