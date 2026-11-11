/** The former St Joseph's Institution during its use as the Singapore Art Museum. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam, beamPath, loft, normalFor, radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.90, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  tile: { slot: 'roof', graph: 'clay_fired', roughness: 0.92, metallic: 0 },
  zinc: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.71, metallic: 0.19 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57, metallic: 0.04 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'ded8c7', shade: 'c8c2b0', light: 'e4decb', plinth: 'a79f8d',
  opening: '323f3a', gallery: '4f5149', pane: '52665c', sash: '3e574b',
  tile: 'b9694b', ridge: 'aa5b43', zinc: '777d83', seam: '84878d',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0], tau = Math.PI * 2;

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], color);
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const a = terrain.heightsMeters[j], b = terrain.heightsMeters[j + 1];
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

function plane(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const tangent = [dx / length, dz / length], normal = [-tangent[1], 0, tangent[0]];
  const at = (u, y, offset = 0) => [
    a[0] + tangent[0] * u + normal[0] * offset, y,
    a[1] + tangent[1] * u + normal[2] * offset,
  ];
  return { a, b, length, tangent, normal, at };
}

function rect(out, wall, slot, u, v, bottom, top, tint, offset = 0) {
  if (v - u < 0.001 || top - bottom < 0.001) return;
  const { normal, at } = wall;
  face(out, slot, [at(u, bottom, offset), at(v, bottom, offset), at(v, top, offset), at(u, top, offset)], normal, tint);
}

function bay(out, wall, u, width, section, lod) {
  const { low, top, bottom, spring, rise, depth = 0.43, arcade = false } = section;
  const radius = width / 2, left = u - radius, right = u + radius;
  const segments = [4, 5, 6, 12][lod];
  const { at, normal, tangent } = wall;
  const fill = (a, b, y, h) => rect(out, wall, 'plaster', a, b, y, h, c.wall);
  const back = arcade ? c.gallery : c.opening;
  const d = -depth;
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const t = Math.PI * i / segments;
    return [u - radius * Math.cos(t), spring + rise * Math.sin(t)];
  });
  fill(left, right, low, bottom);
  rect(out, wall, 'glazing', left, right, bottom, spring, back, d);
  for (let i = 1; i < arc.length; i++) {
    const [x, y] = arc[i - 1], [v, h] = arc[i];
    face(out, 'plaster', [at(x, y), at(v, h), at(v, top), at(x, top)], normal, c.wall);
    face(out, 'glazing', [at(u, spring - 0.02, d), at(x, y, d), at(v, h, d)], normal, back);
    if (lod < 2) continue;
    face(out, 'trim', [at(x, y), at(v, h), at(v, h, d), at(x, y, d)], [0, -1, 0], c.shade);
    const rim = ([p, q]) => at(u + (p - u) * (1 + 0.30 / width), q + (q - spring) * 0.16 + 0.067, 0.031);
    face(out, 'trim', [at(x, y, 0.031), at(v, h, 0.031), rim(arc[i]), rim(arc[i - 1])], normal, c.light);
  }
  for (const [x, sign] of [[left, 1], [right, -1]]) {
    face(out, 'plaster', [at(x, bottom), at(x, spring), at(x, spring, d), at(x, bottom, d)],
      [tangent[0] * sign, 0, tangent[1] * sign], c.shade);
  }
  if (lod < 2) return;
  if (lod === 2) return;
  const frameBottom = arcade ? bottom + 0.22 : bottom;
  const frameDepth = d + 0.09;
  beam(out, 'trim', at(left - 0.09, bottom - 0.02, 0.038), at(right + 0.09, bottom - 0.02, 0.038), 0.11, 0.14, c.light);
  beam(out, 'glazing', at(u, frameBottom, frameDepth), at(u, spring + rise * 0.82, frameDepth), 0.065, 0.060, c.sash);
  beam(out, 'glazing', at(left, spring - 0.09, frameDepth), at(right, spring - 0.09, frameDepth), 0.074, 0.060, c.sash);
  if (!arcade) {
    for (const x of [u - width * 0.28, u + width * 0.28]) {
      beam(out, 'glazing', at(x, bottom, frameDepth), at(x, spring - 0.09, frameDepth), 0.037, 0.053, c.sash);
    }
  }
}

function row(out, wall, section, count, ratio, lod) {
  const size = wall.length / count, width = size * ratio;
  let previous = 0;
  for (let i = 0; i < count; i++) {
    const u = size * (i + 0.5);
    rect(out, wall, 'plaster', previous, u - width / 2, section.low, section.top, c.wall);
    bay(out, wall, u, width, section, lod);
    previous = u + width / 2;
  }
  rect(out, wall, 'plaster', previous, wall.length, section.low, section.top, c.wall);
}

function facade(out, wall, lod, fronts, chapel) {
  const { length, a, b, normal, at } = wall;
  const eave = chapel ? s.chapelEave : s.eave;
  const base = (p) => Math.min(s.floor - 0.46, ground(p) - 0.25);
  face(out, 'trim', [at(0, base(a)), at(length, base(b)), at(length, s.floor), at(0, s.floor)], normal, c.plinth);
  if (!lod || length < 3.3 || (!fronts && lod === 1)) {
    rect(out, wall, 'plaster', 0, length, s.floor, eave, fronts ? c.wall : c.shade);
  } else {
    const n = Math.max(1, Math.round(length / (chapel ? 4.55 : fronts ? 3.82 : 4.45)));
    row(out, wall, {
      low: s.floor, top: s.upperFloor, bottom: fronts ? 0.68 : 2.15,
      spring: fronts ? 4.39 : 4.55, rise: fronts ? 0.87 : 0.54,
      arcade: fronts, depth: fronts ? 0.69 : 0.34,
    }, n, fronts ? 0.64 : 0.43, lod);
    row(out, wall, {
      low: s.upperFloor, top: eave, bottom: 7.45, spring: 10.18, rise: 0.52,
    }, fronts && lod === 3 ? n * 2 : n, fronts && lod === 3 ? 0.50 : 0.43, lod);
  }
  if (!lod) return;
  rect(out, wall, 'trim', 0, length, eave - 0.34, eave, c.light, 0.080);
  rect(out, wall, 'trim', 0, length, s.upperFloor - 0.13, s.upperFloor + 0.11, c.light, 0.085);
  if (lod < 2 || !fronts) return;
  const columns = Math.max(1, Math.round(length / 3.82));
  for (let i = 1; i < columns; i++) {
    const u = length * i / columns;
    beam(out, 'trim', at(u, 0.58, 0.073), at(u, s.upperFloor - 0.22, 0.073), 0.24, 0.34, c.light);
    beam(out, 'trim', at(u, s.upperFloor + 0.07, 0.065), at(u, eave - 0.28, 0.065), 0.16, 0.21, c.light);
  }
}

const middle = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const roofPoint = ([x, z], y) => [x, y, z];
const tile = (out, points, tint = c.tile) => face(out, 'tile', points, up, tint);

function wingRoof(out, paths, eave, lod) {
  const bands = paths.map(([a, b], i) => {
    const ridge = middle(outline[a], outline[b]);
    const width = Math.hypot(outline[a][0] - outline[b][0], outline[a][1] - outline[b][1]);
    const height = eave + (i === paths.length - 1 ? 0.10 : Math.min(4.28, width * 0.25));
    return [roofPoint(outline[a], eave), roofPoint(ridge, height), roofPoint(outline[b], eave)];
  });
  for (let i = 1; i < bands.length; i++) {
    const [a, r, b] = bands[i - 1], [d, t, e] = bands[i];
    tile(out, [a, d, t]); tile(out, [a, t, r]);
    tile(out, [b, r, t]); tile(out, [b, t, e]);
    if (lod >= 2) beam(out, 'tile', r, t, 0.13, 0.15, c.ridge);
  }
}

function baseRoof(out, points, eave) {
  const indices = earcut(points.flat());
  for (let i = 0; i < indices.length; i += 3) {
    tile(out, indices.slice(i, i + 3).map((index) => roofPoint(points[index], eave)), c.ridge);
  }
}

function hip(out, [x0, x1, z0, z1], eave, rise, lod) {
  const [a, b, d, e] = [[x0, eave, z0], [x0, eave, z1], [x1, eave, z1], [x1, eave, z0]];
  const depth = z1 - z0, width = x1 - x0;
  const [r, t] = width > depth ?
    [[x0 + depth * 0.35, eave + rise, (z0 + z1) / 2], [x1 - depth * 0.35, eave + rise, (z0 + z1) / 2]] :
    [[(x0 + x1) / 2, eave + rise, z1 - width * 0.35], [(x0 + x1) / 2, eave + rise, z0 + width * 0.35]];
  if (width > depth) {
    tile(out, [a, b, r]); tile(out, [b, d, t, r]);
    tile(out, [d, e, t]); tile(out, [e, a, r, t]);
  } else {
    tile(out, [a, b, r, t]); tile(out, [b, d, r]);
    tile(out, [d, e, t, r]); tile(out, [e, a, t]);
  }
  if (lod >= 2) beam(out, 'tile', r, t, 0.17, 0.17, c.ridge);
}

function historicRanges(out, lod) {
  const area = outline.reduce((sum, [x, z], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - z * u;
  }, 0);
  for (let i = 0; i < outline.length; i++) {
    if (i < 3) continue;
    const a = outline[i], b = outline[(i + 1) % outline.length];
    const fronts = (i >= 4 && i <= 10) || (i >= 28 && i <= 37);
    const chapel = i >= 18 && i <= 20;
    facade(out, area < 0 ? plane(a, b) : plane(b, a), lod, fronts, chapel);
  }
  baseRoof(out, outline, s.eave - 0.05);
  wingRoof(out, s.wingPaths[0], s.eave, lod);
  wingRoof(out, s.wingPaths[1], s.eave, lod);
  hip(out, [-29.74, 23.12, -30.64, -4.63], s.eave - 0.01, 5.0, lod);
  hip(out, [-10.90, 2.86, -55.20, -29.97], s.chapelEave, s.chapelRise, lod);
  hip(out, [-13.96, 10.99, -9.46, 1.78], s.eave + 0.04, 3.01, lod);
}

function portico(out, lod) {
  const { centerX: x, frontZ: z, rearZ, width, pedimentSpring: spring, pedimentRise: rise } = s.portico;
  const left = x - width / 2, right = x + width / 2;
  const wall = plane([left, z], [right, z]);
  const center = width / 2, { at } = wall;
  row(out, wall, { low: s.floor, top: s.upperFloor, bottom: s.floor + 0.04,
    spring: 4.47, rise: 1.31, depth: 2.4, arcade: true }, 1, 0.66, lod);
  row(out, wall, { low: s.upperFloor, top: spring, bottom: s.upperFloor + 0.57,
    spring: 10.27, rise: 1.64, depth: 1.48, arcade: true }, 1, 0.73, lod);
  const segmentCount = [5, 7, 12, 18][lod];
  const arc = Array.from({ length: segmentCount + 1 }, (_, i) => {
    const t = Math.PI * i / segmentCount;
    return [center - (center + 0.23) * Math.cos(t), spring + rise * Math.sin(t)];
  });
  for (let i = 1; i < arc.length; i++) {
    const [a, y] = arc[i - 1], [b, h] = arc[i];
    face(out, 'plaster', [at(center, spring - 0.09), at(a, y), at(b, h)], wall.normal, c.light);
    tile(out, [at(a, y), at(b, h), at(b, h, rearZ - z), at(a, y, rearZ - z)]);
  }
  for (const [a, b] of [
    [plane([left, rearZ], [left, z]), 1],
    [plane([right, z], [right, rearZ]), -1],
  ]) {
    row(out, a, { low: s.floor, top: s.upperFloor, bottom: s.floor + 0.10,
      spring: 4.18, rise: 0.95, depth: 0.66, arcade: true }, 1, 0.50, lod);
    row(out, a, { low: s.upperFloor, top: spring, bottom: s.upperFloor + 0.63,
      spring: 9.88, rise: 1.35, depth: 0.69, arcade: true }, 1, b > 0 ? 0.51 : 0.54, lod);
  }
  box(out, 'trim', x, s.floor - 0.41, z + 0.22, width + 0.32, 0.41, 0.94, c.plinth);
  box(out, 'trim', x, spring - 0.18, z + 0.08, width + 0.40, 0.34, 0.25, c.light);
  box(out, 'trim', x, s.upperFloor - 0.24, z + 0.08, width + 0.31, 0.26, 0.32, c.light);
  if (!lod) return;
  beamPath(out, 'trim', arc.map(([u, y]) => at(u, y, 0.061)), 0.14, 0.19, c.light);
  for (const edge of [left + 0.43, right - 0.43]) {
    box(out, 'trim', edge, 0.62, z + 0.07, 0.62, 5.54, 0.23, c.light);
    box(out, 'trim', edge, 6.50, z + 0.07, 0.55, 5.82, 0.22, c.light);
    for (const h of [0.59, 5.88, 6.54, 11.91]) {
      box(out, 'trim', edge, h, z + 0.12, 0.82, 0.24, 0.34, c.light);
    }
  }
  box(out, 'trim', x, s.upperFloor + 0.82, z - 0.24, 0.94, 0.62, 0.42, c.light);
  box(out, 'trim', x, spring + 0.89, z + 0.035, 0.67, 0.47, 0.15, c.wall);
  const cross = spring + rise;
  box(out, 'trim', x, cross + 0.03, z - 0.14, 0.115, 0.93, 0.12, c.light);
  box(out, 'trim', x, cross + 0.56, z - 0.14, 0.62, 0.115, 0.13, c.light);
  if (lod < 2) return;
  for (const sign of [-1, 1]) {
    for (let i = 1; i <= 6; i++) {
      box(out, 'trim', x + sign * (0.52 + i * 0.20), s.upperFloor + 0.52, z - 0.21, 0.085, 0.42, 0.093, c.light);
    }
    beam(out, 'trim', [x + sign * 0.45, s.upperFloor + 0.95, z - 0.21],
      [x + sign * 1.88, s.upperFloor + 0.95, z - 0.21], 0.11, 0.11, c.light);
  }
}

function tower(out, lod) {
  const { center, radius, base, arcadeFloor, cornice, top } = s.tower;
  const sides = [10, 12, 16, 24][lod];
  const drum = (slot, sections, tint) => loft(out, slot,
    sections.map(([y, r]) => radialRing(y, r, r, sides, center)), tint);
  drum('plaster', [[base, radius], [arcadeFloor + 0.32, radius]], c.wall);
  const sidesWithArches = lod < 2 ? 10 : 12;
  const edges = radialRing(0, radius, radius, sidesWithArches, center, Math.PI / sidesWithArches);
  for (let i = 0; i < edges.length; i++) {
    const [x, , z] = edges[i], [u, , v] = edges[(i + 1) % edges.length];
    const wall = plane([x, z], [u, v]);
    if (!lod) rect(out, wall, 'plaster', 0, wall.length, arcadeFloor, cornice, c.wall);
    else row(out, wall, { low: arcadeFloor, top: cornice, bottom: arcadeFloor + 0.61,
      spring: cornice - 1.26, rise: 0.62, depth: 0.60, arcade: true }, 1, 0.68, lod);
  }
  drum('trim', [[arcadeFloor - 0.28, radius * 1.012], [arcadeFloor - 0.12, radius * 1.041],
    [arcadeFloor + 0.05, radius * 1.032]], c.light);
  drum('trim', [[cornice - 0.19, radius * 1.014], [cornice - 0.01, radius * 1.066],
    [cornice + 0.19, radius * 1.067], [cornice + 0.28, radius * 1.008]], c.light);
  const layers = [4, 5, 7, 10][lod];
  const sections = Array.from({ length: layers + 1 }, (_, i) => {
    const t = (Math.PI / 2) * i / layers;
    return [cornice + 0.21 + (top - cornice - 0.21) * Math.sin(t), radius * Math.max(0.024, Math.cos(t))];
  });
  drum('zinc', sections, c.zinc);
  if (lod < 2) return;
  for (let i = 0; i < sides; i += 2) {
    const angle = (i * tau) / sides;
    beamPath(out, 'zinc', sections.map(([y, r]) => [
      center[0] + (r + 0.014) * Math.cos(angle), y + 0.013, center[1] + (r + 0.014) * Math.sin(angle),
    ]), 0.026, 0.026, c.seam);
  }
}

function dormer(out, x, z, y, width, lod) {
  const front = z + 0.65, top = y + 1.38;
  const wall = plane([x - width / 2, front], [x + width / 2, front]);
  rect(out, wall, 'plaster', 0, width, y, top, c.light);
  rect(out, wall, 'glazing', width * 0.27, width * 0.73, y + 0.25, top - 0.17, c.opening, 0.028);
  if (lod >= 2) rect(out, wall, 'trim', width / 2 - 0.034, width / 2 + 0.034, y + 0.24, top - 0.16, c.light, 0.042);
  const peak = [x, top + 0.58, front];
  face(out, 'plaster', [[x - width / 2, top, front], [x + width / 2, top, front], peak], [0, 0, 1], c.light);
  for (const sign of [-1, 1]) {
    const edge = x + sign * (width / 2 + 0.09);
    tile(out, [[edge, top - 0.07, front + 0.10], peak, [x, top + 0.47, z - 0.70], [edge, top - 0.13, z - 0.70]]);
  }
}

function build(out, lod) {
  historicRanges(out, lod);
  portico(out, lod);
  tower(out, lod);
  if (lod) {
    dormer(out, 7.65, -1.61, 13.77, 1.49, lod);
    dormer(out, -9.67, -2.83, 14.02, 1.40, lod);
  }
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'singapore-art-museum-model.mjs';
const camera = [-49, 44, 118], lookAt = [0, 9.2, -8.0];
const authoredLevels = Object.fromEntries([
  ['district', 'museumDistrict', 0.39], ['street', 'museumStreet', 0.19], ['closeup', 'museumCloseup', 0.055],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const museumModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: museumCloseup, category: 'museum', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The Singapore Art Museum’s former Bras Basah Road home with white arcades, two curving school wings, terracotta roofs and a gray domed tower behind the central portico.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.92, basis: 'Named Old St Joseph’s Institution footprint from OpenStreetMap way 172596735.' },
  mediumFiContext: { scale: 0.82, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'clay_fired', 'metal_standing_seam'],
  qaCameras: [
    { name: 'bras-basah-portico-and-dome', position: [-1.2, 6.4, 45], lookAt: [-2.3, 10.7, -2.4] },
    { name: 'curved-wings-and-terracotta-roofs', position: [-43, 28, 95], lookAt: [-1.3, 8.2, -5.2] },
    { name: 'rear-chapel-and-roof-enclosure', position: [72, 45, -96], lookAt: [-4.4, 8.3, -17.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-singapore-art-museum-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'museumSkyline', errorMeters: 1.04, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact Qualla CC0 photo.',
};
