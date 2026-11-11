/** The restored Hull mansion as photographed from Halsted Street in March 2010. */
import fs from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  door: { slot: 'door', graph: 'wood_vertical', roughness: 0.82, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.06 },
};
const colors = Object.fromEntries(Object.entries({
  brick: '996c61', brickShade: '805950', brickEdge: 'a57665', foundation: '78635d',
  trim: 'e1d9c1', light: 'eae2ca', trimShadow: 'c2b59a', stone: '9b9488',
  roof: '797e77', porchRoof: '858176', glass: '515d62', brightGlass: '687979',
  shadow: '363d3e', door: '45433b', innerTrim: '827970',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0], down = [0, -1, 0];

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0.5, 1]], color);
}
const facade = (axis, line, sign) => axis === 'z'
  ? { at: (u, y, depth = 0) => [u, y, line + sign * depth], n: [0, 0, sign], t: [1, 0, 0] }
  : { at: (u, y, depth = 0) => [line + sign * depth, y, u], n: [sign, 0, 0], t: [0, 0, 1] };
function panel(out, slot, f, a, b, low, high, color, d = 0) {
  face(out, slot, [f.at(a, low, d), f.at(b, low, d), f.at(b, high, d), f.at(a, high, d)], f.n, color);
}

function archedOpening(out, f, u, window, lod, wallTop) {
  const [low, crown, width, rise] = window;
  const a = u - width / 2, b = u + width / 2, spring = crown - rise;
  const depth = lod ? -0.105 : 0.008, count = [4, 3, 8, 12][lod];
  const arch = (i, extra = 0, d = 0) => {
    const angle = Math.PI * i / count;
    return f.at(u - (width / 2 + extra) * Math.cos(angle), spring + (rise + extra) * Math.sin(angle), d);
  };
  panel(out, 'glass', f, a, b, low, spring, colors.glass, depth);
  for (let i = 0; i < count; i++) {
    const left = arch(i), right = arch(i + 1);
    face(out, 'glass', [f.at(u, spring - 0.012, depth), arch(i, 0, depth), arch(i + 1, 0, depth)], f.n, colors.glass);
    if (!lod) continue;
    const a1 = u - width / 2 * Math.cos(Math.PI * i / count);
    const b1 = u - width / 2 * Math.cos(Math.PI * (i + 1) / count);
    face(out, 'brick', [left, right, f.at(b1, wallTop), f.at(a1, wallTop)], f.n, colors.brick);
    face(out, 'trim', [arch(i, 0, depth), arch(i + 1, 0, depth), right, left],
      [0, -1, 0], colors.trimShadow);
    face(out, 'trim', [arch(i, 0, 0.013), arch(i + 1, 0, 0.013),
      arch(i + 1, 0.060, 0.013), arch(i, 0.060, 0.013)], f.n, colors.trim);
  }
  if (!lod) return;
  for (const [x, sign] of [[a, 1], [b, -1]]) {
    face(out, 'trim', [f.at(x, low), f.at(x, spring), f.at(x, spring, depth), f.at(x, low, depth)],
      f.t.map((n) => n * sign), colors.trimShadow);
    panel(out, 'trim', f, Math.min(x, x - sign * 0.06), Math.max(x, x - sign * 0.06), low, spring, colors.trim, 0.013);
  }
  face(out, 'stone', [f.at(a - 0.07, low, 0.10), f.at(b + 0.07, low, 0.10), f.at(b + 0.07, low, depth), f.at(a - 0.07, low, depth)], up, colors.stone);
  beam(out, 'stone', f.at(a - 0.07, low - 0.045, 0.03), f.at(b + 0.07, low - 0.045, 0.03), 0.13, 0.09, colors.stone);
  if (lod >= 2) {
    beam(out, 'trim', f.at(u, low + 0.015, depth + 0.018), f.at(u, crown - 0.025, depth + 0.018), 0.028, 0.037, colors.trim);
    for (const y of [low + (spring - low) * 0.32, low + (spring - low) * 0.67, spring]) {
      beam(out, 'trim', f.at(a + 0.02, y, depth + 0.018), f.at(b - 0.02, y, depth + 0.018), 0.027, 0.034, colors.trim);
    }
  }
}

function entry(out, f, u, window, lod, wallTop) {
  const [low, high, width] = window;
  const a = u - width / 2, b = u + width / 2, depth = lod ? -0.14 : 0.008;
  panel(out, 'door', f, a, b, low, high, colors.door, depth);
  if (!lod) return;
  panel(out, 'brick', f, a, b, high, wallTop, colors.brick);
  for (const [x, sign] of [[a, 1], [b, -1]]) {
    face(out, 'trim', [f.at(x, low), f.at(x, high), f.at(x, high, depth), f.at(x, low, depth)],
      f.t.map((n) => n * sign), colors.trimShadow);
    beam(out, 'trim', f.at(x, low, 0.022), f.at(x, high, 0.022), 0.11, 0.11, colors.trim);
  }
  face(out, 'trim', [f.at(a, high), f.at(b, high), f.at(b, high, depth), f.at(a, high, depth)], down, colors.trimShadow);
  beam(out, 'trim', f.at(a - 0.14, high + 0.04, 0.041), f.at(b + 0.14, high + 0.04, 0.041), 0.16, 0.15, colors.trim);
  for (const x of [u - width * 0.25, u + width * 0.25]) {
    panel(out, 'glass', f, x - 0.18, x + 0.18, low + 0.86, low + 1.58, colors.brightGlass, depth + 0.012);
    panel(out, 'glass', f, x - 0.18, x + 0.18, low + 1.75, high - 0.20, colors.shadow, depth + 0.012);
  }
  if (lod >= 2) beam(out, 'door', f.at(u, low, depth + 0.015), f.at(u, high, depth + 0.015), 0.07, 0.065, colors.innerTrim);
}

function course(out, f, a, b, low, high, positions, window, lod) {
  if (!lod) panel(out, 'brick', f, a, b, low, high, colors.brick);
  let left = a;
  for (const [u, doorWidth] of positions) {
    const opening = doorWidth ? [s.threshold, 3.91, doorWidth] : window;
    const [sill, , width] = opening, start = u - width / 2, end = u + width / 2;
    if (lod) {
      panel(out, 'brick', f, left, start, low, high, colors.brick);
      if (sill > low) panel(out, 'brick', f, start, end, low, sill, colors.brick);
    }
    if (doorWidth) entry(out, f, u, opening, lod, high);
    else archedOpening(out, f, u, opening, lod, high);
    left = end;
  }
  if (lod) panel(out, 'brick', f, left, b, low, high, colors.brick);
}

function houseWalls(out, lod) {
  const [l, r, rear, front] = s.wallBounds;
  const wallTop = s.mainEave - 0.40;
  const sides = [
    { f: facade('z', front, 1), a: l, b: r, lower: [[-3.47], [-1.55], [1.48, 1.83], [4.51], [6.55]], upper: [[-3.84], [-2.32], [0.73], [2.24], [5.3], [6.83]] },
    { f: facade('z', rear, -1), a: l, b: r, lower: [[-3.34], [-1.58], [1.48, 1.02], [4.65], [6.61]], upper: [[-3.37], [-1.42], [1.48], [4.38], [6.61]] },
    { f: facade('x', l, -1), a: rear, b: front, lower: [[-5.34], [4.48]], upper: [[-4.76], [-2.15], [0.64], [3.50]] },
    { f: facade('x', r, 1), a: rear, b: front, lower: [[-4.84], [-2.05], [0.71], [3.52]], upper: [[-4.84], [-2.05], [0.71], [3.52]] },
  ];
  for (const { f, a, b, lower, upper } of sides) {
    panel(out, 'brick', f, a, b, s.foundation, s.threshold - 0.05, colors.foundation);
    course(out, f, a, b, s.threshold - 0.05, 4.14, lower, s.lowerWindow, lod);
    course(out, f, a, b, 4.14, wallTop, upper, s.upperWindow, lod);
  }
  const mappedBay = [8, 9, 10, 11, 12, 13, 14].map((index) => outline[index]);
  const sourceRing = [[l + 0.01, mappedBay[0][1]], ...mappedBay, [l + 0.01, mappedBay.at(-1)[1]]];
  for (let i = 0; i + 1 < sourceRing.length; i++) {
    const [ax, az] = sourceRing[i], [bx, bz] = sourceRing[i + 1];
    const length = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / length, dz = (bz - az) / length;
    const n = [dz, 0, -dx];
    const f = { n, t: [dx, 0, dz], at: (u, y, d = 0) => [ax + dx * u + n[0] * d, y, az + dz * u + n[2] * d] };
    panel(out, 'brick', f, 0, length, s.foundation, s.threshold - 0.05, colors.foundation);
    course(out, f, 0, length, s.threshold - 0.05, s.southBayHeight,
      length > 1.69 ? [[length / 2]] : [], [0.61, 3.42, 0.74, 0.20], lod);
  }
  const bayCover = sourceRing;
  for (let i = 1; i < bayCover.length - 1; i++) {
    face(out, 'roof', [bayCover[0], bayCover[i], bayCover[i + 1]].map(([x, z]) => [x, s.southBayHeight, z]), up, colors.porchRoof);
  }
}

function cap(out, bounds, eave, ridge, lod, brackets) {
  const [l, r, rear, front] = bounds, mid = (rear + front) / 2;
  const projection = brackets ? 0.45 : 0.19;
  box(out, 'trim', (l + r) / 2, eave - 0.44, mid, r - l + projection * 1.54, 0.34, front - rear + projection * 1.54, colors.trim);
  box(out, 'trim', (l + r) / 2, eave - 0.10, mid, r - l + projection * 2, 0.11, front - rear + projection * 2, colors.light);
  for (const z of [rear - projection, front + projection]) {
    face(out, 'roof', [[l - projection, eave + 0.01, z], [r + projection, eave + 0.01, z],
      [r + projection, ridge, mid], [l - projection, ridge, mid]], up, colors.roof);
  }
  for (const [x, sign] of [[l - projection, -1], [r + projection, 1]]) {
    face(out, 'trim', [[x, eave, rear - projection], [x, eave, front + projection], [x, ridge, mid]], [sign, 0, 0], colors.trimShadow);
  }
  if (!lod) return;
  for (const [axis, line, sign, a, b] of [
    ['z', rear, -1, l, r], ['z', front, 1, l, r], ['x', l, -1, rear, front], ['x', r, 1, rear, front],
  ]) {
    const f = facade(axis, line, sign), span = b - a, count = Math.round(span / (brackets ? 0.96 : 0.71));
    for (let i = 0; i < count; i++) {
      if (lod === 1 && i % 2) continue;
      const u = a + (i + 0.5) / count * span;
      beam(out, 'trim', f.at(u, eave - 0.54, 0.015), f.at(u, eave - 0.17, projection * 0.93), 0.12, 0.13, colors.light);
    }
  }
}

function column(out, x, z, lod) {
  const y = s.threshold, top = s.verandaCornice - 0.31;
  if (!lod) {
    box(out, 'trim', x, y, z, 0.23, top - y, 0.23, colors.trim);
    return;
  }
  const count = [4, 5, 9, 12][lod];
  const profile = lod === 1 ? [[y, 0.149], [y + 0.11, 0.109], [top - 0.17, 0.096], [top, 0.14]] :
    [[y, 0.153], [y + 0.06, 0.153], [y + 0.10, 0.122], [y + 0.20, 0.112],
      [top - 0.20, 0.092], [top - 0.09, 0.135], [top, 0.140]];
  const p = (a, y, r) => [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
  for (let i = 0; i < count; i++) {
    const a = Math.PI * 2 * i / count, b = Math.PI * 2 * (i + 1) / count;
    for (let j = 1; j < profile.length; j++) {
      const [y1, r1] = profile[j - 1], [y2, r2] = profile[j];
      face(out, 'trim', [p(a, y1, r1), p(b, y1, r1), p(b, y2, r2), p(a, y2, r2)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)], colors.trim);
    }
  }
  if (lod >= 2) box(out, 'trim', x, top - 0.037, z, 0.32, 0.06, 0.32, colors.light);
}

function veranda(out, lod) {
  const [l, r, rear, front] = s.wallBounds;
  const e = s.verandaWidth, y = s.verandaCornice, landing = s.threshold;
  const north = r + e, south = -11.28, west = rear - e, east = front + e;
  const corners = [[south, west], [north, west], [north, east], [south, east]];
  const roofIn = [[l, rear], [r, rear], [r, front], [l, front]];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const [a, b] = [corners[i], corners[j]];
    const outward = [b[1] - a[1], 0, a[0] - b[0]];
    const at = ([x, z], level) => [x, level, z];
    face(out, 'roof', [at(a, y), at(b, y), at(roofIn[j], y + 0.24), at(roofIn[i], y + 0.24)], up, colors.porchRoof);
    face(out, 'trim', [at(a, y - 0.34), at(b, y - 0.34), at(b, y), at(a, y)], outward, colors.trim);
    face(out, 'trim', [at(roofIn[i], y - 0.34), at(roofIn[j], y - 0.34), at(b, y - 0.34), at(a, y - 0.34)], down, colors.trimShadow);
    face(out, 'stone', [at(a, landing), at(b, landing), at(roofIn[j], landing), at(roofIn[i], landing)], up, colors.stone);
    face(out, 'brick', [at(a, s.foundation), at(b, s.foundation), at(b, landing), at(a, landing)], outward, colors.foundation);
    if (lod) beam(out, 'trim', at(a, y - 0.07), at(b, y - 0.07), 0.11, 0.08, colors.light);
  }
  for (const z of [east - 0.24, west + 0.24]) {
    for (const x of [south + 0.28, -7.95, -4.28, -2.33, 0.16, 0.54, 2.39, 2.77, 5.41, 8.10, north - 0.28]) column(out, x, z, lod);
  }
  for (const x of [south + 0.25, north - 0.25]) {
    for (const z of [west + 3.05, west + 6.12, west + 9.22, east - 3.39]) column(out, x, z, lod);
  }
  for (const [j, z, d] of [[0, east + 0.56, 0.90], [1, east + 0.44, 0.66], [2, east + 0.31, 0.44]]) {
    box(out, 'stone', 1.47, -0.06 + j * 0.16, z, 2.60 - j * 0.13, 0.22, d, colors.stone);
  }
}

function cupolaAndChimneys(out, lod) {
  const [l, r, rear, front] = s.cupolaBounds, start = s.mainRidge - 0.45, top = s.cupolaEave - 0.41;
  for (const [axis, line, sign, a, b] of [
    ['z', rear, -1, l, r], ['z', front, 1, l, r], ['x', l, -1, rear, front], ['x', r, 1, rear, front],
  ]) {
    const f = facade(axis, line, sign);
    panel(out, 'trim', f, a, b, start, top, colors.trim);
    for (const u of [a + (b - a) * 0.32, a + (b - a) * 0.68]) {
      const low = start + 0.23, spring = top - 0.49, w = 0.56, d = 0.012;
      panel(out, 'glass', f, u - w / 2, u + w / 2, low, spring, colors.glass, d);
      const count = lod > 1 ? 7 : 4;
      for (let i = 0; i < count; i++) {
        const at = (i) => f.at(u - Math.cos(Math.PI * i / count) * w / 2, spring + Math.sin(Math.PI * i / count) * 0.23, d);
        face(out, 'glass', [f.at(u, spring - 0.001, d), at(i), at(i + 1)], f.n, colors.glass);
      }
      if (lod >= 2) beam(out, 'trim', f.at(u, low, d + 0.015), f.at(u, top - 0.29, d + 0.015), 0.035, 0.04, colors.trim);
    }
  }
  cap(out, s.cupolaBounds, s.cupolaEave, s.cupolaRidge, lod, false);
  for (const [x, z, y] of [[6.8, -3.10, 8.48], [6.3, 2.72, 8.57], [-4.2, -2.74, 8.62]]) {
    box(out, 'brick', x, y - 0.18, z, 0.74, 1.53, 0.63, colors.brick);
    if (lod) box(out, 'stone', x, y + 1.31, z, 0.85, 0.13, 0.75, colors.stone);
  }
}

function build(out, lod) {
  houseWalls(out, lod);
  veranda(out, lod);
  cap(out, s.wallBounds, s.mainEave, s.mainRidge, lod, true);
  cupolaAndChimneys(out, lod);
}

export const hullSkyline = (out) => build(out, 0);
export const hullDistrict = (out) => build(out, 1);
export const hullStreet = (out) => build(out, 2);
export const hullCloseup = (out) => build(out, 3);

const recipe = 'hull-house-model.mjs', camera = [20, 13, 33], lookAt = [0, 4.2, 0.3];
const authoredLevels = Object.fromEntries([
  ['district', 'hullDistrict', 0.15], ['street', 'hullStreet', 0.07], ['closeup', 'hullCloseup', 0.025],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const hullModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: hullCloseup, category: 'house', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The restored brick Italianate mansion with a pale wraparound veranda, arched windows, ornate eaves and rooftop cupola.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.88, basis: 'Named original Hull mansion outline, OpenStreetMap way 148902944.' },
  mediumFiContext: { scale: 0.76, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_limestone_raw', 'wood_plain', 'wood_vertical', 'metal_standing_seam'],
  qaCameras: [
    { name: 'halsted-entrance-and-paired-arches', position: [8.5, 4.3, 29.0], lookAt: [0.9, 4.24, 3.3] },
    { name: 'south-bay-and-wraparound-veranda', position: [-29, 6.8, 11.6], lookAt: [-2.8, 4.35, 1.2] },
    { name: 'north-roof-chimneys-and-cupola', position: [22, 15, -21.9], lookAt: [1.0, 4.8, -0.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hull-house-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'hullSkyline', errorMeters: 0.36, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two exact first-party public-domain Qualla photographs.',
};
