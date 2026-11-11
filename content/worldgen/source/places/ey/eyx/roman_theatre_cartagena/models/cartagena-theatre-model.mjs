/** The partially restored Roman Theatre of Cartagena, around 2017. */
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [, theatreOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  seat: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  setts: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.71, metallic: 0 },
  wood: { slot: 'foundation', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
};
const tint = Object.fromEntries(Object.entries({
  sand: 'b9a38a', rock: 'a28d76', darkRock: '8c7966', seat: 'c2b398', chips: 'a38c74',
  walk: 'c1af92', orchestra: 'c0a88a', grey: '7d7771', marble: 'dbd3c5', column: 'b88f73', wood: '8a7761',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0], pi = Math.PI;
const tone = (color, key, range = 0.11) => color.map((n) => n * (1 + ((key * 17 % 31) / 30 - 0.5) * range));

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0.5, 1]], color);
}

const polar = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
function band(out, slot, a, b, r1, r2, y, color) {
  face(out, slot, [polar(a, r1, y), polar(a, r2, y), polar(b, r2, y), polar(b, r1, y)], up, color);
}
function riser(out, slot, a, b, r, y1, y2, color, outwards = false) {
  const mid = (a + b) / 2, dir = outwards ? 1 : -1;
  face(out, slot, [polar(a, r, y1), polar(b, r, y1), polar(b, r, y2), polar(a, r, y2)],
    [Math.cos(mid) * dir, 0, Math.sin(mid) * dir], color);
}
function edge(out, slot, a, r1, r2, y, color, side) {
  const normal = [-Math.sin(a) * side, 0, Math.cos(a) * side];
  face(out, slot, [polar(a, r1, s.foundation), polar(a, r2, s.foundation), polar(a, r2, y), polar(a, r1, y)], normal, color);
}
function arc(out, slot, r1, r2, y, a, b, samples, color) {
  const width = (b - a) / samples;
  for (let i = 0; i < samples; i++) {
    band(out, slot, a + i * width, a + (i + 1) * width, r1, r2, y, tone(color, i));
  }
}

function orchestra(out, lod) {
  const n = [9, 24, 44, 68][lod];
  for (let i = 0; i < n; i++) {
    const a = pi * i / n, b = pi * (i + 1) / n;
    face(out, 'setts', [[0, s.floor, 0], polar(a, s.orchestraRadius, s.floor), polar(b, s.orchestraRadius, s.floor)],
      up, tone(tint.orchestra, i, 0.035));
    band(out, 'marble', a, b, 6.43, 6.63, s.floor + 0.025, tint.marble);
    band(out, 'setts', a, b, 10.07, s.lowerRadius, 1.13, tone(tint.grey, i));
    band(out, 'marble', a, b, 10.07, 10.22, 1.15, tint.marble);
    const seats = lod ? 3 : 1;
    let prev = s.floor;
    for (let j = 0; j < seats; j++) {
      const width = (s.honourRadius - 6.63) / seats;
      const r = 6.63 + j * width, y = s.floor + (j + 1) * 0.36 / seats;
      band(out, 'seat', a, b, r, r + width, y, tone(tint.seat, i + j * 5));
      riser(out, 'seat', a, b, r, prev, y, tint.seat);
      prev = y;
    }
  }
}

function lowerCavea(out, lod) {
  const divisions = [1, 4, 7, 12][lod];
  const stairs = [0.36, 0.84, 1.57, 2.29, 2.78];
  const angles = [0.065, ...stairs, pi - 0.04];
  const stride = [8, 4, 2, 1][lod];
  const top = s.lowerFirstY + s.lowerRows * s.lowerRise;
  for (let j = 0; j < s.lowerRows; j += stride) {
    const r = s.lowerRadius + j * s.lowerTread;
    const r2 = r + stride * s.lowerTread;
    const y = s.lowerFirstY + (j + stride) * s.lowerRise;
    const prev = s.lowerFirstY + j * s.lowerRise;
    const gap = lod === 0 ? 0 : 0.48 / ((r + r2) / 2);
    for (let k = 0; k < angles.length - 1; k++) {
      const a = angles[k] + (k ? gap : 0), b = angles[k + 1] - (k < stairs.length ? gap : 0);
      arc(out, 'seat', r, r2, y, a, b, divisions, tone(tint.seat, j + k * 13));
      for (let i = 0; i < divisions; i++) {
        const from = a + (b - a) * i / divisions, to = a + (b - a) * (i + 1) / divisions;
        riser(out, 'rock', from, to, r, prev, y, tone(tint.rock, j + k * 7 + i));
      }
    }
    if (lod) {
      for (const a of stairs) {
        const mid = (r + r2) / 2, half = (y + prev) / 2;
        band(out, 'setts', a - gap, a + gap, r, mid, half, tint.walk);
        band(out, 'setts', a - gap, a + gap, mid, r2, y, tint.walk);
        riser(out, 'rock', a - gap, a + gap, r, prev, half, tint.chips);
        riser(out, 'rock', a - gap, a + gap, mid, half, y, tint.chips);
      }
    }
    edge(out, 'rock', angles[0], r, r2, y, tint.rock, -1);
    edge(out, 'rock', angles.at(-1), r, r2, y, tint.rock, 1);
  }
  arc(out, 'setts', s.lowerRadius + s.lowerRows * s.lowerTread, s.lowerWalkEdge, top + 0.025,
    angles[0], angles.at(-1), [14, 24, 42, 64][lod], tint.walk);
}

function upperCavea(out, lod) {
  const n = [10, 26, 44, 72][lod];
  const rimStart = 0.46, rimEnd = 2.684;
  const layers = [
    { from: 27.73, to: 34.45, low: 7.60, top: 10.32, start: 0.23, end: 2.91, rows: [2, 3, 6, 8][lod] },
    { from: 34.45, to: s.upperWallInner, low: 10.32, top: 14.67, start: rimStart, end: rimEnd, rows: [2, 3, 6, 9][lod] },
  ];
  for (const [k, { from, to, low, top, start, end, rows }] of layers.entries()) {
    const dr = (to - from) / rows, dy = (top - low) / rows, da = (end - start) / n;
    const wear = (row, angle) => {
      if (lod < 2 || row < 0 || row === rows - 1) return 0;
      const wave = Math.sin(angle * 8.4 + k * 2.1) * 0.66 + Math.cos(angle * 13.2 - row * 0.55) * 0.34;
      return Math.min(0.15, wave * dy * (k ? 0.71 : 0.52));
    };
    for (let j = 0; j < rows; j++) {
      const y = low + dy * (j + 1), r = from + dr * j;
      for (let i = 0; i < n; i++) {
        const a = start + i * da, b = a + da;
        const ay = y + wear(j, a), by = y + wear(j, b);
        const worn = (i * 13 + j * 23 + k * 11) % 17;
        const restored = k === 0 && Math.sin((a + b) * 5.8 + j * 0.44) > 0.30;
        const color = restored ? tint.seat : tint.rock;
        face(out, restored ? 'seat' : 'rock', [polar(a, r, ay), polar(a, r + dr, ay),
          polar(b, r + dr, by), polar(b, r, by)], up, tone(color, worn, 0.12));
        face(out, 'rock', [polar(a, r, y - dy + wear(j - 1, a)), polar(b, r, y - dy + wear(j - 1, b)),
          polar(b, r, by), polar(a, r, ay)], [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)], tone(tint.darkRock, worn, 0.14));
        if (lod === 3 && !restored && worn > 11) {
          const x = (a + b) / 2, p = polar(x, r + dr * 0.54, y);
          box(out, 'rock', p[0], (ay + by) / 2 - 0.06, p[2], 0.48 + worn * 0.019, 0.14 + worn * 0.011,
            0.45 + worn * 0.017, tone(tint.chips, worn, 0.07));
        }
      }
      edge(out, 'rock', start, r, r + dr, y + wear(j, start), tint.rock, -1);
      edge(out, 'rock', end, r, r + dr, y + wear(j, end), tint.rock, 1);
    }
  }
  const a0 = rimStart, a1 = rimEnd;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n;
    riser(out, 'rock', a, b, s.upperWallOuter, s.foundation, s.upperWallHeight, tone(tint.rock, i, 0.18), true);
    riser(out, 'rock', a, b, s.upperWallInner, 14.55, s.upperWallHeight, tone(tint.sand, i));
    band(out, 'seat', a, b, s.upperWallInner, s.upperWallOuter, s.upperWallHeight, tone(tint.walk, i));
  }
  edge(out, 'rock', a0, s.upperWallInner, s.upperWallOuter, s.upperWallHeight, tint.rock, -1);
  edge(out, 'rock', a1, s.upperWallInner, s.upperWallOuter, s.upperWallHeight, tint.rock, 1);
}

function shaft(out, x, z, low, top, r, sides, complete) {
  const ring = (a, y, radius) => [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
  const h = top - low;
  const stages = sides <= 5 ? [[low, r, 'seat'], [top, r * 0.85, 'seat']] :
    [[low, r * 1.26, 'marble'], [low + 0.16, r * 1.14, 'marble'],
    [low + 0.33, r, 'seat'], [top - (complete ? 0.34 : 0.08), r * 0.82, 'seat'],
    [top, r * (complete ? 1.22 : 0.78), complete ? 'marble' : 'seat']];
  if (h < 0.6) return;
  for (let i = 0; i < sides; i++) {
    const a = 2 * pi * i / sides, b = 2 * pi * (i + 1) / sides;
    const n = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    for (let j = 1; j < stages.length; j++) {
      const [y1, r1] = stages[j - 1], [y2, r2, slot] = stages[j];
      face(out, slot, [ring(a, y1, r1), ring(b, y1, r1), ring(b, y2, r2), ring(a, y2, r2)],
        n, slot === 'marble' ? tint.marble : tone(tint.column, i, 0.09));
    }
    face(out, complete ? 'marble' : 'seat', [[x, top, z], ring(a, top, stages.at(-1)[1]), ring(b, top, stages.at(-1)[1])],
      up, complete ? tint.marble : tint.column);
  }
}

function stage(out, lod) {
  const w = s.stageWidth;
  const deckDepth = s.stageFront - s.stageBack;
  box(out, 'rock', 0, s.foundation, (s.stageBack + s.stageFront) / 2, w + 0.35,
    s.stageDeck - s.foundation - 0.10, deckDepth, tint.rock);
  box(out, 'wood', 0, s.stageDeck - 0.10, (s.stageBack + s.stageFront) / 2, w - 0.18, 0.10, deckDepth - 0.16, tint.wood);
  const count = [5, 10, 15, 21][lod];
  for (let i = 0; i < count; i++) {
    const x = w * ((i + 0.5) / count - 0.5);
    box(out, i % 3 ? 'rock' : 'seat', x, 0.65, s.stageFront + 0.1 + (i % 4) * 0.11,
      w / count * 0.83, 0.62 + (i * 7 % 9) * 0.092, 0.95 + (i % 3) * 0.18, tone(tint.rock, i, 0.20));
  }
  for (const [x, w, height] of [[-20.3, 2.9, 2.8], [-14.9, 3.4, 3.5], [-9.1, 2.45, 2.65],
    [-4.9, 2.3, 2.24], [2.6, 3.2, 2.77], [11.6, 2.6, 5.5], [15.0, 3.3, 10.15], [18.4, 2.9, 12.5], [21.3, 2.75, 6.85]]) {
    box(out, 'rock', x, 0.82, -11.1 + (Math.round(x) % 3) * 0.21, w, height, 2.07, tone(tint.darkRock, Math.round(x + 25)));
  }
  box(out, 'marble', 16.8, 6.35, -9.04, 8.08, 0.68, 2.08, tint.marble);
  box(out, 'marble', 16.8, 6.24, -9.04, 8.30, 0.17, 2.26, tint.marble);
  box(out, 'marble', 18.21, 11.90, -9.44, 3.31, 0.62, 1.64, tint.marble);
  const sides = [5, 8, 11, 16][lod];
  for (const [x, z, low, top, r, cap] of [
    [-18.6, -9.4, 1.8, 4.96, 0.38, false], [-15.5, -9.66, 1.8, 5.38, 0.40, false],
    [-11.8, -9.53, 1.8, 4.29, 0.37, false], [-8.6, -9.61, 1.8, 3.68, 0.36, false],
    [-0.4, -9.69, 1.8, 4.01, 0.41, false], [7.6, -9.68, 1.8, 4.16, 0.40, false],
    [13.56, -8.53, 1.81, 6.33, 0.44, true], [16.65, -8.53, 1.81, 6.33, 0.45, true],
    [19.85, -8.53, 1.81, 6.33, 0.43, true], [16.96, -8.96, 6.99, 11.87, 0.37, true],
    [19.61, -8.96, 6.99, 11.87, 0.37, true], [14.02, -9.06, 6.99, 9.67, 0.31, false],
    [22.29, -8.66, 0.65, 6.30, 0.37, false],
  ]) shaft(out, x, z, low, top, r, sides, cap);
  for (const dir of [-1, 1]) {
    const x = dir * 23.65;
    box(out, 'rock', x, s.foundation, -5.4, 2.3, 4.28, 11.9, tint.rock);
    box(out, 'setts', dir * 25.15, 0.62, 1.45, 4.5, 0.16, 5.4, tint.walk);
    box(out, 'rock', dir * 29.8, s.foundation, 3.8, 2.33, 7.20, 11.1, tint.darkRock);
  }
  for (const x of [20.70, 26.07]) {
    box(out, 'seat', x, 0.58, -4.15, 1.08, 3.98, 0.92, tint.seat);
  }
  box(out, 'marble', 23.4, 4.55, -4.15, 6.44, 0.49, 0.73, tint.marble);
}

function build(out, lod) {
  orchestra(out, lod);
  lowerCavea(out, lod);
  upperCavea(out, lod);
  stage(out, lod);
}

export const cartagenaSkyline = (out) => build(out, 0);
export const cartagenaDistrict = (out) => build(out, 1);
export const cartagenaStreet = (out) => build(out, 2);
export const cartagenaCloseup = (out) => build(out, 3);

const recipe = 'cartagena-theatre-model.mjs';
const camera = [42, 62, 72], lookAt = [0, 5, 13];
const authoredLevels = Object.fromEntries([
  ['district', 'cartagenaDistrict', 0.55], ['street', 'cartagenaStreet', 0.29], ['closeup', 'cartagenaCloseup', 0.12],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const cartagenaModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: cartagenaCloseup, category: 'theatre', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The excavated Roman theatre with a steep limestone cavea, grey orchestra ring, low stage deck and uneven stacks of restored stage columns.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline: theatreOutline, minimumCoverage: 0.82, basis: 'Mapped outer retaining arc and approximate stage and flank perimeter, excluding the separate cathedral and museum.' },
  mediumFiContext: { scale: 0.95, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_sandstone_raw', 'stone_limestone_raw', 'stone_sandstone', 'stone_marble', 'wood_plain'],
  qaCameras: [
    { name: 'whole-cavea-from-stage', position: [12, 21, -64], lookAt: [0, 6, 15] },
    { name: 'stage-columns-and-orchestra', position: [22, 19, 29], lookAt: [3, 4, -6] },
    { name: 'seat-rows-and-radial-stairs', position: [3, 10, -9], lookAt: [1, 6, 21] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cartagena-theatre-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'cartagenaSkyline', errorMeters: 1.1, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, native OpenStreetMap ODbL 1.0 and five checked first-party public-domain or CC0 photographs.',
};
