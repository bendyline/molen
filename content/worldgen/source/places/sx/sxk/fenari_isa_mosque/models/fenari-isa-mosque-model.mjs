/** The two Byzantine churches and Ottoman minaret from the Vatan Boulevard frontage. */
import fs from 'node:fs';
import {
  beam, beamPath, loft, normalFor, radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.90, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.90, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.76, metallic: 0.22 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.18 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.67, metallic: 0 },
};
const c = Object.fromEntries(Object.entries({
  brick: 'ad7867', band: 'ad8b77', red: 'a4715b', drum: 'c08e7d',
  stone: 'ae9680', light: 'bcab93', darkStone: '877663', shaft: 'bc9a83',
  lattice: 'e2ded0', reveal: '8c6f60', glass: '413b38', roof: '66666a',
  seam: '78777a', spire: '606061', rail: 'cebaa5', shadow: '69625e',
}).map(([name, hex]) => [name, rgb(hex)]));
const up = [0, 1, 0], white = 'palette:#ffffff';
const vertical = (x, y, z) => [x, y, z];

function face(out, slot, points, expected, tint) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else out.addTriangle(slot, white, points, n, [[0, 0], [1, 0], [0, 1]], tint);
}

function ground(x, z) {
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
  return {
    length, normal,
    at: (u, y, inset = 0) => [
      a[0] + tangent[0] * u + normal[0] * inset, y,
      a[1] + tangent[1] * u + normal[2] * inset,
    ],
  };
}

function rectangle(out, wall, slot, u, v, low, high, color, inset = 0) {
  if (v - u <= 0.001 || high - low <= 0.001) return;
  const { at, normal } = wall;
  face(out, slot, [at(u, low, inset), at(v, low, inset), at(v, high, inset), at(u, high, inset)], normal, color);
}

function course(out, wall, u, v, bottom, top, lod) {
  if (v - u <= 0.001 || top - bottom <= 0.001) return;
  if (lod < 2) return rectangle(out, wall, 'brick', u, v, bottom, top, c.band);
  const height = 0.36;
  const count = Math.ceil((top - bottom) / height);
  for (let i = 0; i < count; i++) {
    const y = bottom + i * height;
    rectangle(out, wall, i % 2 ? 'stone' : 'brick', u, v, y, Math.min(y + height, top),
      i % 2 ? c.stone : c.band);
  }
}

function arch(out, wall, window, top, lod) {
  const { at, normal } = wall;
  const { u, width, bottom, spring, rise, grille = false } = window;
  const left = u - width / 2, right = u + width / 2;
  const recess = -0.31;
  const segments = [4, 6, 8, 13][lod];
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = Math.PI * i / segments;
    return [u - width / 2 * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
  course(out, wall, left, right, s.floor, bottom, lod);
  rectangle(out, wall, 'opening', left, right, bottom, spring, c.glass, recess);
  for (let i = 1; i < arc.length; i++) {
    const [a, y] = arc[i - 1], [b, h] = arc[i];
    face(out, 'brick', [at(a, y), at(b, h), at(b, top), at(a, top)], normal, c.band);
    face(out, 'stone', [at(a, y), at(b, h), at(b, h, recess), at(a, y, recess)], [0, -1, 0], c.reveal);
    face(out, 'opening', [at(u, spring - 0.025, recess), at(a, y, recess), at(b, h, recess)], normal, c.glass);
    if (!lod) continue;
    const [a0, y0] = arc[i - 1], [b0, h0] = arc[i];
    const surround = ([x, y]) => at(u + (x - u) * (1 + 0.27 / width), y + (y - spring) * 0.16 + 0.07, 0.045);
    face(out, 'brick', [at(a0, y0, 0.045), at(b0, h0, 0.045), surround(arc[i]), surround(arc[i - 1])],
      normal, i % 2 ? c.red : c.brick);
  }
  for (const [x, sign] of [[left, 1], [right, -1]]) {
    const side = [normal[2] * sign, 0, -normal[0] * sign];
    face(out, 'stone', [at(x, bottom), at(x, spring), at(x, spring, recess), at(x, bottom, recess)], side, c.reveal);
    if (lod) rectangle(out, wall, 'brick', x - (sign > 0 ? 0.13 : 0), x + (sign < 0 ? 0.13 : 0),
      bottom, spring, c.red, 0.043);
  }
  face(out, 'trim', [at(left, bottom), at(right, bottom), at(right, bottom, recess), at(left, bottom, recess)], up, c.light);
  if (!grille || lod < 2) return;
  const depth = -0.16;
  beamPath(out, 'trim', [at(left + 0.035, bottom, depth),
    ...arc.map(([x, y]) => at(u + (x - u) * 0.95, y - 0.035, depth)),
    at(right - 0.035, bottom, depth)], 0.065, 0.053, c.lattice);
  const bars = lod === 3 ? Math.ceil(width / 0.18) : lod === 2 ? Math.ceil(width / 0.27) : 4;
  for (let i = 1; i < bars; i++) {
    const ratio = (2 * i) / bars - 1;
    const x = u + ratio * width / 2;
    const y = spring + rise * Math.sqrt(1 - ratio * ratio) - 0.052;
    beam(out, 'trim', at(x, bottom + 0.028, depth), at(x, y, depth), 0.055, 0.048, c.lattice);
  }
  const rails = lod === 3 ? 7 : lod === 2 ? 5 : 2;
  for (let i = 1; i <= rails; i++) {
    const y = bottom + (spring + rise - bottom) * i / (rails + 1);
    const ratio = Math.max(0, (y - spring) / rise);
    const dx = width * 0.48 * Math.sqrt(1 - ratio * ratio);
    beam(out, 'trim', at(u - dx, y, depth + 0.024), at(u + dx, y, depth + 0.024), 0.051, 0.045, c.lattice);
  }
}

function masonry(out, a, b, top, lod, windows = [], grade = true) {
  const wall = plane(a, b);
  const { at, length, normal } = wall;
  const end = lod >= 2 ? 0.075 : 0;
  const low = (p) => grade ? Math.min(s.floor - 0.30, ground(...p) - 0.33) : s.floor - 0.52;
  face(out, 'stone', [at(0, low(a)), at(length, low(b)), at(length, s.floor), at(0, s.floor)], normal, c.darkStone);
  let cursor = 0;
  for (const window of windows) {
    course(out, wall, cursor, window.u - window.width / 2, s.floor, top, lod);
    arch(out, wall, window, top, lod);
    cursor = window.u + window.width / 2;
  }
  course(out, wall, cursor, length, s.floor, top, lod);
  if (lod >= 2) {
    beam(out, 'trim', at(end, top - 0.09, 0.047), at(length - end, top - 0.09, 0.047), 0.16, 0.14, c.light);
    beam(out, 'stone', at(end, s.floor + 0.09, 0.069), at(length - end, s.floor + 0.09, 0.069), 0.20, 0.18, c.stone);
  }
}

function walls(out, bounds, top, lod, windows) {
  const [x, u, z, v] = bounds;
  const corners = [[x, z], [x, v], [u, v], [u, z]];
  for (let i = 0; i < corners.length; i++) {
    masonry(out, corners[i], corners[(i + 1) % corners.length], top, lod, windows[i] ?? []);
  }
}

function vault(out, bounds, eave, rise, lod, acrossZ = false) {
  const [x, u, z, v] = bounds;
  const at = acrossZ ? (a, y, b) => vertical(b, y, a) : vertical;
  const [a, b, d, e] = acrossZ ? [z, v, x, u] : [x, u, z, v];
  const count = [4, 6, 9, 14][lod];
  const arc = Array.from({ length: count + 1 }, (_, i) => {
    const t = Math.PI * i / count;
    return [(a + b) / 2 - (b - a) / 2 * Math.cos(t), eave + rise * Math.sin(t)];
  });
  const center = (a + b) / 2;
  for (let i = 1; i < arc.length; i++) {
    const [p, y] = arc[i - 1], [q, h] = arc[i];
    face(out, 'roof', [at(p, y, d - 0.13), at(q, h, d - 0.13), at(q, h, e + 0.13), at(p, y, e + 0.13)], up, c.roof);
    const [lo, hi] = acrossZ ? [[-1, 0, 0], [1, 0, 0]] : [[0, 0, -1], [0, 0, 1]];
    face(out, 'brick', [at(center, eave - 0.06, d), at(p, y, d), at(q, h, d)], lo, c.brick);
    face(out, 'brick', [at(center, eave - 0.06, e), at(p, y, e), at(q, h, e)], hi, c.brick);
    if (lod >= 2 && i < arc.length - 1) beam(out, 'roof', at(q, h + 0.02, d), at(q, h + 0.02, e), 0.036, 0.038, c.seam);
  }
}

function profile(out, slot, center, sides, sections, tint, offset = 0) {
  loft(out, slot, sections.map(([y, r, rz = r]) => radialRing(y, r, rz, sides, center, offset)), tint);
}

function cap(out, center, spring, top, radius, lod, rz = radius) {
  const sides = [8, 12, 20, 32][lod], layers = [2, 3, 5, 8][lod];
  const sections = Array.from({ length: layers + 1 }, (_, i) => {
    const t = Math.PI / 2 * i / layers;
    const factor = Math.max(0.038, Math.cos(t));
    return [spring + (top - spring) * Math.sin(t), radius * factor, rz * factor];
  });
  profile(out, 'roof', center, sides, sections, c.roof);
  if (lod < 2) return;
  for (let i = 0; i < sides; i += 2) {
    beamPath(out, 'roof', sections.map(([y, r, rr]) => [
      center[0] + (r + 0.015) * Math.cos(i * Math.PI * 2 / sides), y + 0.018,
      center[1] + (rr + 0.015) * Math.sin(i * Math.PI * 2 / sides),
    ]), 0.022, 0.024, c.seam);
  }
}

function drum(out, data, base, lod) {
  const { center, radius, spring, top } = data;
  const count = 8;
  const corners = radialRing(0, radius, radius, count, center, Math.PI / 8);
  for (let i = 0; i < corners.length; i++) {
    const [x, , z] = corners[i], [u, , v] = corners[(i + 1) % corners.length];
    const wall = plane([x, z], [u, v]);
    const width = wall.length * 0.50, mid = wall.length / 2;
    const bottom = base + 0.38, head = spring - 0.12;
    if (lod) {
      rectangle(out, wall, 'brick', 0, mid - width / 2, base, head, c.drum);
      rectangle(out, wall, 'brick', mid + width / 2, wall.length, base, head, c.drum);
      rectangle(out, wall, 'brick', mid - width / 2, mid + width / 2, base, bottom, c.drum);
      rectangle(out, wall, 'brick', mid - width / 2, mid + width / 2, head - 0.42, head, c.drum);
      rectangle(out, wall, 'opening', mid - width / 2, mid + width / 2, bottom, head - 0.42, c.glass, -0.11);
      const { at } = wall;
      for (const x0 of [mid - width / 2, mid + width / 2]) {
        rectangle(out, wall, 'trim', x0 - 0.045, x0 + 0.045, bottom, head - 0.42, c.light, 0.023);
      }
      for (const y of [bottom, head - 0.42]) {
        rectangle(out, wall, 'trim', mid - width / 2, mid + width / 2, y - 0.05, y + 0.05, c.lattice, 0.027);
      }
      if (lod >= 2) {
        for (let j = 1; j < 5; j++) {
          const x0 = mid + width * (j / 5 - 0.5);
          beam(out, 'trim', at(x0, bottom, -0.027), at(x0, head - 0.42, -0.027), 0.050, 0.049, c.lattice);
        }
        for (let j = 1; j < 6; j++) {
          const y = bottom + (head - 0.42 - bottom) * j / 6;
          beam(out, 'trim', at(mid - width / 2, y, 0.004), at(mid + width / 2, y, 0.004), 0.048, 0.046, c.lattice);
        }
      }
    } else {
      rectangle(out, wall, 'brick', 0, wall.length, base, head, c.drum);
    }
  }
  profile(out, 'trim', center, count, [[spring - 0.19, radius * 1.018], [spring - 0.04, radius * 1.058],
    [spring + 0.015, radius * 1.058]], c.light, Math.PI / 8);
  cap(out, center, spring, top, radius * 0.94, lod);
}

function apses(out, lod) {
  for (const [x, z, radius, depth, eave] of [
    [9.09, -7.72, 2.81, 3.30, 6.53], [9.13, -12.30, 1.23, 1.54, 5.34],
    [9.13, -3.47, 1.29, 1.70, 5.52], [9.26, 4.48, 2.87, 3.05, 6.75],
    [9.26, 0.68, 0.95, 1.29, 5.38], [9.28, 8.57, 1.07, 1.62, 5.42],
  ]) {
    const sides = lod >= 2 ? 7 : 5;
    const points = Array.from({ length: sides + 1 }, (_, i) => {
      const t = Math.PI * i / sides - Math.PI / 2;
      return [x + depth * Math.cos(t), z + radius * Math.sin(t)];
    });
    for (let i = 1; i < points.length; i++) {
      const a = points[i], b = points[i - 1];
      const width = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const windows = lod && (i === (sides + 1) / 2 || (lod >= 2 && radius > 2 && i % 2 === 0)) ?
        [{ u: width / 2, width: Math.min(0.60, width * 0.52), bottom: 2.42, spring: 4.28, rise: 0.34 }] : [];
      masonry(out, a, b, eave, lod, windows);
      const high = [x - 0.42, eave + radius * 0.43, z];
      face(out, 'roof', [[a[0], eave, a[1]], [b[0], eave, b[1]], high], up, c.roof);
    }
  }
}

function minaret(out, lod) {
  const { center, balcony, spireBase, top } = s.minaret;
  const [x, z] = center, sides = [8, 12, 16, 24][lod];
  const r = (slot, rings, tint) => profile(out, slot, center, sides, rings, tint);
  box(out, 'stone', x, Math.min(s.floor, ground(x, z) - 0.35), z, 2.64, 6.2, 2.60, c.stone);
  r('trim', [[5.42, 1.33], [6.02, 1.33], [6.72, 1.02], [7.19, 0.98]], c.light);
  r('brick', [[6.89, 0.98], [7.43, 0.94], [17.34, 0.75]], c.shaft);
  r('trim', [[7.12, 0.99], [7.26, 0.99], [7.38, 0.95]], c.light);
  r('trim', [[balcony - 1.24, 0.77], [balcony - 0.77, 0.93],
    [balcony - 0.33, 1.17], [balcony - 0.11, 1.31], [balcony + 0.08, 1.31]], c.light);
  r('brick', [[balcony - 0.03, 0.64], [spireBase - 0.18, 0.57]], c.shaft);
  r('trim', [[spireBase - 0.23, 0.60], [spireBase, 0.63], [spireBase + 0.06, 0.63]], c.light);
  r('roof', [[spireBase, 0.60], [spireBase + 1.32, 0.42], [top - 0.49, 0.069], [top - 0.20, 0.025]], c.spire);
  r('rail', [[top - 0.45, 0.036], [top, 0.032]], c.rail);
  if (!lod) return;
  const rail = radialRing(balcony + 1.02, 1.21, 1.21, lod === 1 ? 8 : sides, center);
  beamPath(out, 'rail', rail, 0.068, 0.066, c.rail, true);
  for (const [a, y, b] of rail) beam(out, 'rail', [a, balcony + 0.02, b], [a, y, b], 0.071, 0.064, c.rail);
  box(out, 'opening', x, balcony + 0.09, z + 0.62, 0.31, 1.61, 0.06, c.glass);
}

const galleryBounds = [-12.44, s.southOuterGallery[1], s.southOuterGallery[2], s.streetFaceZ];
const window = (u, width, bottom, spring, rise, grille = false) => ({ u, width, bottom, spring, rise, grille });

function build(out, lod) {
  const front = lod ? s.frontWindows.map(([x, width], i) =>
    window(x - galleryBounds[0], width, 2.52, i < 2 ? 3.89 : 3.72, width * 0.48, true)) : [];
  walls(out, galleryBounds, s.streetEave, lod, [[], front,
    lod >= 2 ? [window(2.54, 0.83, 2.16, 3.41, 0.42)] : [], []]);
  const [x, u, z, v] = galleryBounds;
  box(out, 'roof', (x + u) / 2, s.streetEave - 0.038, (z + v) / 2, u - x + 0.17, 0.16, v - z + 0.18, c.roof);
  const west = lod >= 2 ? [window(4.37, 1.13, 2.1, 3.61, 0.53),
    window(11.20, 1.44, 0.52, 3.28, 0.69, true), window(18.85, 1.29, 2.13, 3.66, 0.59)] : [];
  walls(out, s.sharedNarthex, 6.69, lod, [west, [], [], []]);
  vault(out, s.sharedNarthex, 6.68, 0.68, lod);
  walls(out, s.northChurch, 7.76, lod, [[], [], [],
    lod >= 2 ? [window(2.5, 0.94, 2.65, 4.87, 0.48), window(8.4, 1.53, 2.55, 4.62, 0.68, true),
      window(14.10, 0.95, 2.65, 4.87, 0.48)] : []]);
  vault(out, s.northChurch, 7.75, 1.61, lod);
  walls(out, s.southChurch, 7.91, lod, [[], [], [], []]);
  vault(out, s.southChurch, 7.90, 1.16, lod, true);
  vault(out, [-1.53, 7.38, 6.61, 10.75], 7.70, 1.55, lod);
  cap(out, [-6.55, 9.14], 6.53, 7.84, 2.22, lod, 1.96);
  if (lod) cap(out, [-5.07, -9.64], 7.62, 8.81, 1.82, lod);
  drum(out, s.northDrum, 8.67, lod);
  drum(out, s.southDrum, 8.95, lod);
  apses(out, lod);
  minaret(out, lod);
}

export const fenariSkyline = (out) => build(out, 0);
export const fenariDistrict = (out) => build(out, 1);
export const fenariStreet = (out) => build(out, 2);
export const fenariCloseup = (out) => build(out, 3);

const recipe = 'fenari-isa-mosque-model.mjs';
const camera = [-33, 18, 57], lookAt = [0.5, 8.7, 1.4];
const authoredLevels = Object.fromEntries([
  ['district', 'fenariDistrict', 0.33], ['street', 'fenariStreet', 0.14], ['closeup', 'fenariCloseup', 0.05],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const fenariModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: fenariCloseup, category: 'mosque', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Fenari İsa Mosque in Fatih with two Byzantine church volumes, banded masonry, six grilled boulevard windows, lead domes and a slender Ottoman minaret.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.92, basis: 'Named mosque envelope from OpenStreetMap way 329095050.' },
  mediumFiContext: { scale: 0.80, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_limestone_raw', 'stone_limestone', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'vatan-boulevard-gallery-and-minaret', position: [-7.5, 5.5, 61], lookAt: [-1.2, 8.3, 4.3] },
    { name: 'eastern-apses-and-joined-churches', position: [43, 21, -30], lookAt: [0.3, 7, -1.4] },
    { name: 'paired-lead-domes-and-window-lattice', position: [19, 16, 39], lookAt: [0.5, 8.3, 4.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-fenari-isa-mosque-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'fenariSkyline', errorMeters: 0.78, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and the exact first-party CC0 story exterior.',
};
