import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
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
  buffBrick: 'b39374',
  sideBrick: '9c8168',
  clay: 'ccaf8d',
  cream: 'e1c7a5',
  stone: 'b9a990',
  paleMortar: 'c6b298',
  glass: '596266',
  blueGlass: '626e72',
  darkMetal: '48454b',
  iron: '574f46',
  brass: 'caa368',
  gold: 'dfbc79',
  roof: '6c6661',
  modern: '8f7869',
  redTrim: '7a4c49',
});
const surfaces = {
  brick: surface('wall', 'brick_flemish', 0.92),
  stone: surface('foundation', 'stone_ashlar', 0.92),
  roof: surface('roof', 'membrane', 0.91),
  metal: surface('trim', 'metal_painted', 0.65, 0.24),
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.04 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.81 },
};

function sliceAt(outline, x, south) {
  const result = [];
  const inside = (p) => (south ? p[0] >= x : p[0] <= x);
  for (const [a, b] of pairs(closed(outline))) {
    if (inside(a)) result.push(a);
    if (inside(a) !== inside(b)) result.push([x, mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]))]);
  }
  return result;
}
const footprint = d.outline.map(([x, z]) => [x, Math.min(z, d.wallFront)]);
const historic = sliceAt(footprint, d.sectionBreakX, false);
const wing = sliceAt(footprint, d.sectionBreakX, true);
const sunk = (p) => Math.min(-0.25, grade(p) - 0.31);

function mass(out, outline, bottom, top, slot, tint) {
  shell(out, outline, typeof bottom === 'number' ? () => bottom : bottom, top, {
    wall: slot,
    roof: 'roof',
    color: tint,
    roofColor: colors.roof,
  });
}
const elevation = (a, b, z) => edge([b, z], [a, z]);
const front = elevation(d.facadeBounds[0], d.facadeBounds[1], d.wallFront);

function fanlightWindow(out, level, w, u, bottom, spring, r) {
  const rise = r * 0.71;
  arch(
    out,
    w,
    u,
    bottom,
    spring,
    r,
    rise,
    0.21,
    level,
    {
      inner: colors.glass,
      trim: colors.cream,
      width: 0.19,
    },
    { inner: 'glass', trim: 'trim' },
  );
  if (level >= 1) {
    const subdiv = level === 3 ? 5 : 3;
    for (let i = 1; i < subdiv; i++) {
      const x = mix(u - r, u + r, i / subdiv);
      panel(out, 'trim', w, x - 0.034, x + 0.034, bottom, spring - 0.015, 0.272, colors.cream);
    }
    panel(out, 'trim', w, u - r, u + r, spring - 0.051, spring + 0.061, 0.279, colors.cream);
    panel(
      out,
      'trim',
      w,
      u - r - 0.11,
      u + r + 0.11,
      bottom - 0.12,
      bottom + 0.03,
      0.288,
      colors.clay,
    );
  }
  if (level >= 2) {
    for (const y of [bottom + 0.82, bottom + 1.62, bottom + 2.54])
      panel(out, 'trim', w, u - r, u + r, y - 0.027, y + 0.027, 0.279, colors.cream);
    const n = level === 3 ? 7 : 4;
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * i) / (n + 1);
      const x = u + r * Math.cos(a) * 0.95,
        y = spring + rise * Math.sin(a) * 0.95;
      beam(out, 'trim', w.p(u, spring + 0.07, 0.267), w.p(x, y, 0.267), 0.051, 0.039, colors.cream);
    }
  }
}

function fauxBalcony(out, level, w, u, width, y) {
  const left = u - width / 2,
    right = u + width / 2;
  beam(out, 'trim', w.p(left, y, 0.31), w.p(right, y, 0.31), 0.36, 0.19, colors.clay);
  if (level === 0) return;
  const start = w.p(left, y + 0.72, 0.53),
    end = w.p(right, y + 0.72, 0.53);
  beam(out, 'metal', start, end, 0.071, 0.076, colors.iron);
  beam(
    out,
    'metal',
    w.p(left, y + 0.18, 0.51),
    w.p(right, y + 0.18, 0.51),
    0.06,
    0.055,
    colors.iron,
  );
  const n = [0, 5, 9, 13][level];
  for (let i = 0; i <= n; i++) {
    const x = mix(left, right, i / n);
    beam(out, 'metal', w.p(x, y + 0.13, 0.52), w.p(x, y + 0.71, 0.52), 0.042, 0.043, colors.iron);
  }
  if (level >= 2) {
    for (const x of [left, right])
      beam(out, 'trim', w.p(x, y - 0.53, 0.12), w.p(x, y + 0.01, 0.49), 0.155, 0.21, colors.clay);
  }
}

function swag(out, level, w, u, y) {
  const n = level === 3 ? 8 : 5;
  for (const direction of [-1, 1]) {
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return w.p(u + direction * 1.24 * t, y - 0.18 * Math.sin(Math.PI * t), 0.24);
    });
    for (const [a, b] of pairs(points)) beam(out, 'trim', a, b, 0.1, 0.1, colors.clay);
  }
  if (level === 3) {
    for (const x of [u - 1.24, u, u + 1.24])
      panel(out, 'trim', w, x - 0.084, x + 0.084, y - 0.18, y + 0.13, 0.27, colors.cream);
  }
}
function streetFront(out, level) {
  const wall = front,
    length = wall.length;
  const width = length / d.bays;
  panel(out, 'brick', wall, 0, length, -0.05, d.facadeParapet - 0.02, 0.1, colors.buffBrick);
  panel(out, 'stone', wall, 0, length, 0.03, 0.73, 0.13, colors.stone);
  for (const [lo, hi, depth, tint] of [
    [3.98, 4.44, 0.3, colors.clay],
    [4.37, 4.61, 0.38, colors.cream],
    [11.9, 12.21, 0.25, colors.clay],
    [12.21, 12.96, 0.21, colors.cream],
    [12.96, 13.31, 0.41, colors.clay],
    [13.28, 13.47, 0.52, colors.cream],
    [14.64, 14.83, 0.27, colors.clay],
  ])
    panel(out, 'trim', wall, 0, length, lo, hi, depth, tint);
  for (let i = 0; i < d.bays; i++) {
    const u = (i + 0.5) * width;
    fanlightWindow(out, level, wall, u, d.upperWindowBase, d.upperWindowSpring, 1.3);
    fauxBalcony(out, level, wall, u, 2.59, 4.63);
    if (level >= 1) swag(out, level, wall, u, 11.04);
    if (level >= 2) panel(out, 'trim', wall, u - 0.14, u + 0.14, 12.48, 12.88, 0.254, colors.clay);
  }
  for (let i = 0; i <= d.bays; i++) {
    const u = i * width;
    const w = i === 0 || i === d.bays ? 0.61 : 0.46;
    panel(out, 'trim', wall, u - w / 2, u + w / 2, 4.53, 11.86, 0.273, colors.clay);
    panel(out, 'trim', wall, u - w * 0.65, u + w * 0.65, 11.72, 12.13, 0.32, colors.cream);
    if (level >= 2) {
      for (const f of [-0.24, -0.08, 0.08, 0.24]) {
        const x = u + w * f;
        panel(out, 'trim', wall, x - 0.026, x + 0.026, 4.65, 11.65, 0.28, colors.cream);
      }
    }
  }
  if (level >= 2) {
    for (let i = 0; i < 72; i++) {
      const u = ((i + 0.5) * length) / 72;
      panel(out, 'trim', wall, u - 0.037, u + 0.037, 13.05, 13.21, 0.53, colors.cream);
    }
  }
}

const letters = {
  T: ['111', '010', '010', '010', '010'],
  H: ['101', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  ' ': ['00', '00', '00', '00', '00'],
};
function lettering(out, w, position, height, vertical = false) {
  const pitch = vertical ? 0.112 : 0.078;
  let cursor = position;
  for (const [i, letter] of [...'THE MET'].entries()) {
    const glyph = letters[letter];
    const x0 = vertical ? position + ((glyph[0].length - 1) * pitch) / 2 : cursor;
    const baseline = vertical ? height - i * 0.68 : height;
    for (const [r, row] of glyph.entries()) {
      for (const [j, filled] of [...row].entries()) {
        if (filled !== '1') continue;
        const x = x0 - j * pitch;
        const y = baseline + (4 - r) * pitch;
        panel(out, 'trim', w, x - pitch * 0.93, x, y, y + pitch * 0.94, 0.045, colors.gold);
      }
    }
    cursor -= (glyph[0].length + 0.9) * pitch;
  }
}

function entryAndCanopy(out, level) {
  const w = front,
    center = w.length * 0.526;
  const left = center - 7.7,
    right = center + 7.7;
  panel(out, 'metal', w, left - 0.16, right + 0.16, 0.21, 3.53, 0.19, colors.darkMetal);
  panel(out, 'glass', w, left, right, 0.27, 3.38, 0.24, colors.blueGlass);
  const glazing = level === 0 ? 6 : 10;
  for (let i = 0; i <= glazing; i++) {
    const u = mix(left, right, i / glazing);
    panel(out, 'metal', w, u - 0.042, u + 0.042, 0.23, 3.44, 0.282, colors.iron);
    if (level >= 2 && i > 0 && i < glazing && i % 2 === 0)
      panel(out, 'trim', w, u + 0.34, u + 0.52, 1.4, 1.47, 0.31, colors.brass);
  }
  for (const y of [0.34, 2.48, 3.29])
    panel(out, 'metal', w, left, right, y - 0.065, y + 0.065, 0.281, colors.darkMetal);
  for (const u of [3.5, w.length - 3.7]) {
    panel(out, 'trim', w, u - 2.45, u + 2.45, 0.48, 3.46, 0.18, colors.clay);
    panel(out, 'glass', w, u - 2.3, u + 2.3, 0.76, 3.23, 0.23, colors.glass);
    for (const x of [-1.18, 0, 1.18])
      panel(out, 'metal', w, u + x - 0.063, u + x + 0.063, 0.74, 3.28, 0.27, colors.darkMetal);
  }
  const [cx, , z] = w.p(center, 0);
  const length = 19.1,
    faceZ = d.marqueeFront;
  block(
    out,
    'metal',
    cx - length / 2,
    3.44,
    z - 0.1,
    length,
    0.55,
    faceZ - z + 0.11,
    colors.darkMetal,
  );
  block(
    out,
    'trim',
    cx - length / 2 - 0.08,
    3.91,
    faceZ - 0.16,
    length + 0.16,
    0.17,
    0.19,
    colors.brass,
  );
  block(
    out,
    'trim',
    cx - length / 2 - 0.08,
    3.43,
    faceZ - 0.16,
    length + 0.16,
    0.065,
    0.19,
    colors.clay,
  );
  if (level >= 1) {
    const face = elevation(cx - length / 2, cx + length / 2, faceZ);
    lettering(out, face, length / 2 + 0.98, 3.51);
    const n = [0, 10, 20, 30][level];
    for (let i = 0; i < n; i++) {
      const x = mix(cx - length / 2 + 0.25, cx + length / 2 - 0.25, (i + 0.5) / n);
      block(out, 'trim', x - 0.04, 3.406, faceZ - 0.31, 0.08, 0.048, 0.08, colors.gold);
    }
    const blade = elevation(cx - 0.45, cx + 0.45, d.wallFront + 0.84);
    block(out, 'metal', cx - 0.45, 6.3, d.wallFront + 0.15, 0.9, 5.54, 0.69, colors.darkMetal);
    for (const x of [cx - 0.48, cx + 0.4])
      block(out, 'trim', x, 6.3, d.wallFront + 0.82, 0.078, 5.52, 0.078, colors.brass);
    lettering(out, blade, 0.45, 11.02, true);
  }
}

function auditoriumAndWing(out, level) {
  mass(out, historic, sunk, d.bodyRoof, 'brick', colors.sideBrick);
  mass(out, wing, sunk, d.wingRoof, 'brick', colors.modern);
  const side = rect(-16.4, -18.4, 15.4, 0.42);
  mass(out, side, d.bodyRoof - 0.015, d.bodyRoof + 1.36, 'brick', colors.sideBrick);
  block(out, 'brick', -13.25, d.bodyRoof - 0.025, 6.12, 3.4, 1.3, 3.6, colors.sideBrick);
  block(out, 'brick', 10.95, d.bodyRoof - 0.025, 7.52, 4.45, 1.57, 3.9, colors.sideBrick);
  for (const [a, b] of pairs(closed(historic))) {
    const w = edge(a, b, areaSign(historic));
    if (w.normal[2] > 0.62 || w.length < 3.4) continue;
    panel(out, 'trim', w, 0, w.length, d.bodyRoof - 0.38, d.bodyRoof - 0.07, 0.12, colors.clay);
    if (level >= 1) {
      const n = Math.max(1, Math.floor(w.length / 5.45));
      for (let j = 0; j < n; j++) {
        const u = ((j + 0.5) * w.length) / n;
        const y = grade(w.p(u, 0).filter((_, i) => i !== 1));
        panel(out, 'metal', w, u - 0.68, u + 0.68, y + 0.15, y + 2.28, 0.075, colors.iron);
        panel(out, 'glass', w, u - 0.48, u + 0.48, 6.54, 7.57, 0.092, colors.glass);
        if (level === 3) panel(out, 'trim', w, u - 0.64, u + 0.64, 7.62, 7.72, 0.088, colors.clay);
      }
    }
  }
  const w = elevation(d.sectionBreakX + 0.13, 28.02, d.wallFront + 0.09);
  const l = w.length;
  panel(out, 'trim', w, 0, l, 0.16, 0.52, 0.1, colors.stone);
  panel(out, 'metal', w, 0, l, 7.93, 8.24, 0.11, colors.iron);
  panel(out, 'glass', w, 0.9, l - 0.77, 8.24, 10.45, 0.118, colors.glass);
  if (level >= 1) {
    for (let i = 0; i <= 7; i++) {
      const u = mix(0.75, l - 0.69, i / 7);
      panel(out, 'metal', w, u - 0.049, u + 0.049, 8.2, 10.59, 0.145, colors.darkMetal);
    }
    const count = level >= 2 ? 15 : 6;
    for (let i = 0; i <= count; i++) {
      const u = (l * i) / count;
      beam(out, 'metal', w.p(u, 11.46, 0.14), w.p(u, 12.55, 0.14), 0.061, 0.064, colors.iron);
    }
    beam(out, 'metal', w.p(0, 12.55, 0.14), w.p(l, 12.55, 0.14), 0.064, 0.06, colors.iron);
  }
}
function build(out, level) {
  auditoriumAndWing(out, level);
  entryAndCanopy(out, level);
  streetFront(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'metropolitan-theatre-winnipeg-model.mjs';
const camera = [68, 30, 67],
  lookAt = [1.5, 6.75, 1];
const errors = { district: 0.47, street: 0.15, closeup: 0.06 };
export const metropolitanTheatreAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'performance-sport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Native mapped Donald Street footprint and the original public sidewalk elevation below the marquee.',
  brief:
    'Winnipeg’s Metropolitan Theatre, with seven Palladian windows, terra cotta swags, a projecting marquee and the restored south addition.',
  camera,
  lookAt,
  sunDirection: [72, 107, 75],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named native Donald Street outline of the standing theatre and addition.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'membrane', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'seven-bays-on-donald-street', position: [-12, 13, 61], lookAt: [0, 7, 16] },
    {
      name: 'restored-marquee-and-upper-terracotta',
      position: [13, 8.4, 36.2],
      lookAt: [0, 6.75, 16.8],
    },
    { name: 'auditorium-roof-and-south-addition', position: [58, 30, -46], lookAt: [5, 8.4, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'metropolitan-theatre-winnipeg-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Building vectors © 2001 Her Majesty the Queen in Right of Manitoba, as represented by the Minister of Conservation. All rights reserved.',
};
