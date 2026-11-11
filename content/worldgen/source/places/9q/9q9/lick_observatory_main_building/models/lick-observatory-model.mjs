/** Lick Observatory's two connected dome towers and main building. */
import fs from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  steel: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.60, metallic: 0.32 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.28 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.44, metallic: 0.03 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'e3dfcf', warm: 'd3cbb4', cold: 'e7e6df', foundation: 'c1b9a7',
  trim: 'cec3a5', trimShade: 'ab9c80', glass: '535957', dark: '494b42',
  entry: '746b57', steel: 'c7cccb', ridge: 'a7b0b1', steelSeam: 'aeb7b7', rail: '858e89',
}).map(([name, hex]) => [name, rgb(hex)]));
const up = [0, 1, 0], down = [0, -1, 0], tau = 2 * Math.PI;
const white = 'palette:#ffffff';
function face(out, slot, points, expected, color) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, color);
  else out.addTriangle(slot, white, points, n, [[0, 0], [1, 0], [0.5, 1]], color);
}

function localGround(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}
const foot = ([x, , z]) => Math.min(-0.39, localGround(x, z) - 0.29);
const facade = (axis, line, sign) => axis === 'z' ?
  { at: (x, y, d = 0) => [x, y, line + sign * d], n: [0, 0, sign], t: [1, 0, 0] } :
  { at: (z, y, d = 0) => [line + sign * d, y, z], n: [sign, 0, 0], t: [0, 0, 1] };
function panel(out, slot, f, a, b, lo, hi, color, depth = 0) {
  if (b - a < 1e-6 || hi - lo < 1e-6) return;
  face(out, slot, [f.at(a, lo, depth), f.at(b, lo, depth), f.at(b, hi, depth), f.at(a, hi, depth)], f.n, color);
}
function horizontalTrim(out, slot, f, a, b, y, height, depth, color) {
  beam(out, slot, f.at(a, y, depth * 0.31), f.at(b, y, depth * 0.31), depth, height, color);
}

function opening(out, f, shape, lod, wallTop, shallow = false) {
  const { x, width, low, spring, rise, entrance } = shape;
  const left = x - width / 2, right = x + width / 2, count = [3, 4, 7, 10][lod];
  const depth = lod && !shallow ? entrance ? -1.43 : -0.14 : 0.012;
  const reveal = entrance ? 0.18 : 0.09, inner = entrance ? c.entry : c.glass;
  const vertex = (i, rim, d) => {
    const t = Math.PI * i / count;
    return f.at(x - (width / 2 + rim) * Math.cos(t), spring + (rise + rim) * Math.sin(t), d);
  };
  panel(out, 'glass', f, left, right, low, spring, inner, depth);
  for (let i = 0; i < count; i++) {
    const a = vertex(i, 0, 0), b = vertex(i + 1, 0, 0);
    face(out, 'glass', [f.at(x, spring - 0.005, depth), vertex(i, 0, depth), vertex(i + 1, 0, depth)], f.n, inner);
    if (!lod) continue;
    const u = x - width * Math.cos(i * Math.PI / count) / 2;
    const v = x - width * Math.cos((i + 1) * Math.PI / count) / 2;
    if (!shallow) {
      face(out, 'wall', [a, b, f.at(v, wallTop), f.at(u, wallTop)], f.n, c.wall);
      face(out, 'trim', [a, b, vertex(i + 1, 0, depth), vertex(i, 0, depth)], down, c.trimShade);
    }
    face(out, 'trim', [vertex(i, 0, 0.023), vertex(i + 1, 0, 0.023),
      vertex(i + 1, reveal, 0.023), vertex(i, reveal, 0.023)], f.n, c.trim);
  }
  if (!lod) return;
  for (const [u, sign] of [[left, 1], [right, -1]]) {
    if (!shallow) {
      face(out, 'trim', [f.at(u, low), f.at(u, spring), f.at(u, spring, depth), f.at(u, low, depth)],
        f.t.map((v) => v * sign), c.trimShade);
    }
    panel(out, 'trim', f, Math.min(u, u - sign * reveal), Math.max(u, u - sign * reveal), low, spring, c.trim, 0.023);
  }
  if (entrance) {
    face(out, 'stone', [f.at(left, low, 0.03), f.at(right, low, 0.03),
      f.at(right, low, depth), f.at(left, low, depth)], up, c.foundation);
    if (lod >= 2) {
      const f2 = (u, y) => f.at(u, y, depth + 0.019);
      for (const u of [-0.98, 0, 0.98]) {
        beam(out, 'metal', f2(x + u, low + 0.09), f2(x + u, spring + 0.33), 0.09, 0.08, c.dark);
      }
      for (const y of [low + 1.39, low + 2.77, spring - 0.19]) {
        beam(out, 'metal', f2(left + 0.12, y), f2(right - 0.12, y), 0.072, 0.084, c.dark);
      }
    }
  } else {
    horizontalTrim(out, 'trim', f, left - 0.08, right + 0.08, low - 0.045, 0.08, 0.10, c.trimShade);
    if (lod >= 2) {
      for (const y of [low + (spring - low) * 0.45, low + (spring - low) * 0.76]) {
        beam(out, 'trim', f.at(left + 0.025, y, depth + 0.020),
          f.at(right - 0.025, y, depth + 0.020), 0.039, 0.041, c.trim);
      }
    }
  }
}

function wall(out, f, a, b, height, positions, lod) {
  const pa = f.at(a, 0, 0.004), pb = f.at(b, 0, 0.004);
  face(out, 'stone', [[pa[0], foot(pa), pa[2]], [pb[0], foot(pb), pb[2]], f.at(b, s.plinthTop, 0.004),
    f.at(a, s.plinthTop, 0.004)], f.n, c.foundation);
  if (!lod) panel(out, 'wall', f, a, b, s.plinthTop, height, c.wall);
  let current = a;
  for (const shape of positions) {
    const left = shape.x - shape.width / 2, right = shape.x + shape.width / 2;
    if (lod) {
      panel(out, 'wall', f, current, left, s.plinthTop, height, c.wall);
      panel(out, 'wall', f, left, right, s.plinthTop, shape.low, c.wall);
    }
    opening(out, f, shape, lod, height);
    current = right;
  }
  if (lod) panel(out, 'wall', f, current, b, s.plinthTop, height, c.wall);
}

const window = (x, width = 0.87) => ({ x, width, low: 1.16, spring: 3.62, rise: 0.27 });
function hall(out, bounds, along, eave, ridge, lod, main) {
  const [l, r, rear, front] = bounds;
  const faces = [
    [facade('z', front, 1), l, r, main ? [-28.5,-24.9,-21.3,-17.6,-14.0,-10.5,3.15,6.7,10.2,13.8,17.4,21.0,24.3] : []],
    [facade('z', rear, -1), l, r, main ? [-22,-17,-12,-6,0,6,12,18,24] : [(l+r)/2-2.2,(l+r)/2+2.2]],
    [facade('x', l, -1), rear, front, main ? [] : [-39,-34,-29,-24,-19,-14]],
    [facade('x', r, 1), rear, front, main ? [] : [-39,-34,-29,-24,-19,-14]],
  ];
  for (const [f, a, b, positions] of faces) {
    wall(out, f, a, b, eave - 0.025, positions.map((x) => window(x)), lod && positions.length ? lod : 0);
    if (lod) {
      horizontalTrim(out, 'trim', f, a, b, eave - 0.18, 0.17, 0.16, c.trim);
      horizontalTrim(out, 'trim', f, a, b, eave - 0.46, 0.11, 0.085, c.warm);
      horizontalTrim(out, 'trim', f, a, b, 3.46, 0.095, 0.07, c.warm);
    }
  }
  const [a, b, lo, hi] = along === 'x' ? [l, r, rear, front] : [rear, front, l, r];
  const middle = (lo + hi) / 2, at = (u, y, v) => along === 'x' ? [u, y, v] : [v, y, u];
  for (const side of [lo - 0.14, hi + 0.14]) {
    face(out, 'steel', [at(a - 0.12, eave, side), at(b + 0.12, eave, side),
      at(b + 0.12, ridge, middle), at(a - 0.12, ridge, middle)], up, c.steel);
  }
  for (const [u, sign] of [[a, -1], [b, 1]]) {
    const n = along === 'x' ? [sign, 0, 0] : [0, 0, sign];
    face(out, 'wall', [at(u, eave - 0.055, lo), at(u, eave - 0.055, hi), at(u, ridge, middle)], n, c.warm);
  }
  if (lod) beam(out, 'steel', at(a - 0.12, ridge + 0.055, middle), at(b + 0.12, ridge + 0.055, middle),
    0.14, 0.10, c.ridge);
}

function entry(out, lod) {
  const [l, r, back, front] = s.entrance, e = s.entryHeight, mid = (l + r) / 2;
  const f = facade('z', front, 1);
  wall(out, f, l, r, e, [{ x: mid, width: 3.70, low: s.threshold, spring: 5.59, rise: 0.98, entrance: true }], lod);
  for (const [x, sign] of [[l, -1], [r, 1]]) wall(out, facade('x', x, sign), back, front, e, [], lod);
  panel(out, 'wall', facade('z', back, -1), l, r, s.hallEave, e, c.wall);
  box(out, 'steel', mid, e - 0.12, (front + back) / 2, r - l + 0.20, 0.16, front - back + 0.21, c.steel);
  horizontalTrim(out, 'trim', f, l - 0.10, r + 0.10, e - 0.07, 0.16, 0.22, c.warm);
  horizontalTrim(out, 'trim', f, l, r, e - 0.88, 0.22, 0.13, c.trim);
  panel(out, 'trim', f, mid - 2.05, mid + 2.05, 7.16, 7.78, c.cold, 0.017);
  if (lod) {
    for (let i = 0; i < 13; i++) {
      const x = l + 0.24 + i * (r - l - 0.48) / 12;
      box(out, 'trim', x, e - 1.07, front + 0.07, 0.15, 0.15, 0.18, c.trimShade);
    }
  }
  const landing = front + 1.54;
  for (let i = 0; i < 4; i++) {
    box(out, 'stone', mid, -0.20 + 0.145 * i, landing - i * 0.35, 4.02, 0.345, 0.71, c.trimShade);
  }
  if (lod >= 2) {
    for (const dx of [-2.07, 2.07]) {
      const x = mid + dx;
      for (const [z, y] of [[front + 1.55, 0.0], [front + 0.36, 0.46]]) {
        beam(out, 'metal', [x, y, z], [x, y + 0.86, z], 0.052, 0.055, c.rail);
      }
      beam(out, 'metal', [x, 0.86, front + 1.55], [x, 1.32, front + 0.36], 0.054, 0.055, c.rail);
    }
  }
}

function dome(out, [x, z, wallRadius, y, capRadius, rise], lod, large) {
  const count = [12, 20, 32, 48][lod], levels = [5, 8, 12, 16][lod];
  const round = (a, r, h) => [x + Math.cos(a) * r, h, z + Math.sin(a) * r];
  const belt = [[s.plinthTop, wallRadius], [y - 0.41, wallRadius], [y - 0.28, capRadius + 0.24],
    [y - 0.12, capRadius + 0.27], [y, capRadius]];
  const colors = [c.wall, c.warm, c.trim, c.trim];
  for (let i = 0; i < count; i++) {
    const a = i * tau / count, b = (i + 1) * tau / count, mid = (a + b) / 2, n = [Math.cos(mid), 0, Math.sin(mid)];
    const p = round(a, wallRadius, 0), q = round(b, wallRadius, 0);
    face(out, 'stone', [round(a, wallRadius, foot(p)), round(b, wallRadius, foot(q)),
      round(b, wallRadius, s.plinthTop), round(a, wallRadius, s.plinthTop)], n, c.foundation);
    for (let j = 1; j < belt.length; j++) {
      const [lo, lr] = belt[j - 1], [hi, hr] = belt[j];
      face(out, j > 1 ? 'trim' : 'wall', [round(a, lr, lo), round(b, lr, lo), round(b, hr, hi), round(a, hr, hi)],
        n, colors[j - 1]);
    }
  }

  const shell = (angle, f, outward = 0) => {
    const t = f * Math.PI / 2;
    return round(angle, (capRadius + outward) * Math.cos(t), y + (rise + outward) * Math.sin(t));
  };
  for (let i = 0; i < count; i++) {
    const a = i * tau / count, b = (i + 1) * tau / count;
    for (let j = 0; j < levels; j++) {
      const low = j / levels, high = (j + 1) / levels, mid = (a + b) / 2;
      const tint = c.steel.map((v) => v * (0.96 + (i * 7 % 12) / 135));
      const points = [shell(a, low), shell(b, low), shell(b, high)];
      if (j + 1 < levels) points.push(shell(a, high));
      face(out, 'steel', points, [Math.cos(mid), (low + high) / 2, Math.sin(mid)], tint);
    }
  }
  const shutter = large ? 1.81 : 1.15;
  const width = large ? 0.075 : 0.104, shutterSteps = [4, 6, 9, 13][lod];
  for (let j = 0; j < shutterSteps; j++) {
    const a = shutter - width, b = shutter + width;
    const lo = j * 0.94 / shutterSteps, hi = (j + 1) * 0.94 / shutterSteps;
    face(out, 'steel', [shell(a, lo, 0.068), shell(b, lo, 0.068), shell(b, hi, 0.068), shell(a, hi, 0.068)],
      [Math.cos(shutter), hi, Math.sin(shutter)], c.ridge);
    if (lod >= 2) {
      for (const angle of [a, b]) {
        beam(out, 'steel', shell(angle, lo, 0.087), shell(angle, hi, 0.087), 0.043, 0.035, c.steelSeam);
      }
    }
  }
  if (lod) {
    const a = large ? 0.52 : 1.47;
    for (const azimuth of [a, a + Math.PI * 0.89]) {
      const n = [Math.cos(azimuth), 0, Math.sin(azimuth)], t = [-n[2], 0, n[0]];
      const side = wallRadius + 0.015;
      const at = (u, h, d = 0) => [x + n[0] * (side + d) + t[0] * u, h, z + n[2] * (side + d) + t[2] * u];
      opening(out, { n, t, at }, { x: 0, width: large ? 0.67 : 0.78,
        low: y - 2.54, spring: y - 1.57, rise: 0.25 }, lod, y, true);
    }
  }
  if (lod >= 2 && !large) {
    for (let i = 0; i < 12; i++) {
      const a = i * tau / 12, b = (i + 1) * tau / 12;
      beam(out, 'metal', round(a, capRadius + 0.26, y + 0.31), round(b, capRadius + 0.26, y + 0.31), 0.038, 0.038, c.rail);
      beam(out, 'metal', round(a, capRadius + 0.23, y - 0.12), round(a, capRadius + 0.26, y + 0.31), 0.035, 0.035, c.rail);
    }
  }
}

function build(out, lod) {
  hall(out, s.linkingHall, 'x', s.hallEave, s.hallRidge, lod, true);
  hall(out, s.eastRange, 'z', s.hallEave - 0.22, s.hallRidge - 0.18, lod, false);
  entry(out, lod);
  dome(out, s.southDome, lod, true);
  dome(out, s.northDome, lod, false);
}

export const lickSkyline = (out) => build(out, 0);
export const lickDistrict = (out) => build(out, 1);
export const lickStreet = (out) => build(out, 2);
export const lickCloseup = (out) => build(out, 3);

const recipe = 'lick-observatory-model.mjs', camera = [42, 36, 94], lookAt = [2, 6.0, -5.0];
const authoredLevels = Object.fromEntries([
  ['district', 'lickDistrict', 0.31], ['street', 'lickStreet', 0.15], ['closeup', 'lickCloseup', 0.06],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const lickModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: lickCloseup, category: 'observatory', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Lick Observatory’s main building with the large silver southern dome, smaller northern dome, connecting hall and west visitor entrance.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.90, basis: 'Named Main Building footprint from OpenStreetMap way 39869731.' },
  mediumFiContext: { scale: 0.89, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone_raw', 'stone_limestone', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'west-entrance-and-great-refractor-dome', position: [17, 10.5, 64], lookAt: [13.4, 7.0, 0.9] },
    { name: 'north-dome-and-linking-hall', position: [-64, 26, 35], lookAt: [-20, 5.1, -3.5] },
    { name: 'east-range-and-two-domes', position: [-51, 32, -86], lookAt: [-6.1, 6.1, -9.0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-lick-observatory-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'lickSkyline', errorMeters: 0.76, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and two exact first-party public-domain or CC0 Qualla photos.',
};
