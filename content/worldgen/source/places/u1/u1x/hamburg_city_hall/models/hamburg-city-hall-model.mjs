/** The neo-Renaissance Rathaus with its sandstone elevations and copper clock tower. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, beamPath, chamferedRectangle, loft, normalFor, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, cleanRing, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), frame = read('map-frame'), terrain = read('terrain-grid');
const [outline, basin] = frame.geometry.polygons;
const { eave, floor, roofs, towerHeight } = plan.section;
const white = 'palette:#ffffff', up = [0, 1, 0];
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.90, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.81, metallic: 0.19 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.18 },
  glazing: { slot: 'window', localRef: white, roughness: 0.51, metallic: 0 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'c1ae91', base: 'a5957e', stone: 'c7b79e', stoneShade: 'a89985', slate: '497c74', copper: '5d9c8a',
  copperLight: '77a492', glass: '4a5150', recess: '444840', gold: 'bd9a58', burgundy: '764f49',
  bronze: '6a8272', water: '748c8a', dark: '66645b',
}).map(([name, hex]) => [name, rgb(hex)]));
const lerp = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters;
}

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], color);
}

function wall(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const ux = dx / length, uz = dz / length;
  return {
    length, normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}

function rect(out, w, slot, l, r, lo, hi, color, offset = 0) {
  const { at, normal } = w;
  face(out, slot, [at(l, lo, offset), at(r, lo, offset), at(r, hi, offset), at(l, hi, offset)], normal, color);
}
function triangle(out, w, slot, l, r, bottom, top, color, offset = 0) {
  face(out, slot, [w.at(l, bottom, offset), w.at(r, bottom, offset), w.at((l + r) / 2, top, offset)], w.normal, color);
}
function segment(out, w, slot, left, bottom, right, top, offset, width, depth, color) {
  beam(out, slot, w.at(left, bottom, offset), w.at(right, top, offset), width, depth, color);
}
function arch(out, w, center, bottom, width, height, lod, offset, trim = true) {
  const radius = width / 2, spring = bottom + height - radius;
  rect(out, w, 'glazing', center - radius, center + radius, bottom, spring, c.recess, offset);
  const steps = lod < 2 ? 3 : lod === 2 ? 6 : 8;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = i * Math.PI / steps;
    return [center + Math.cos(angle) * radius, spring + Math.sin(angle) * radius];
  });
  for (let i = 1; i < arc.length - 1; i++) {
    face(out, 'glazing', [arc[0], arc[i], arc[i + 1]].map((p) => w.at(...p, offset)), w.normal, c.recess);
  }
  if (trim && lod > 1) {
    const profile = [[center + radius, bottom], ...arc, [center - radius, bottom]];
    beamPath(out, 'stone', profile.map((p) => w.at(...p, offset + 0.05)), 0.14, 0.15, c.stone);
  }
}

function facade(out, ring, lod) {
  const foundation = -1.20;
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((index) => ring[index]);
    face(out, 'wall', points.map(([x, z]) => [x, eave, z]), up, c.wall);
    face(out, 'wall', points.map(([x, z]) => [x, foundation, z]), [0, -1, 0], c.base);
  }
  for (let j = 0; j < ring.length; j++) {
    const a = ring[j], b = ring[(j + 1) % ring.length], w = wall(a, b), length = w.length;
    rect(out, w, 'wall', 0, length, foundation, eave, c.wall);
    if (length < 1.7) continue;
    const front = Math.max(a[1], b[1]) < 0.4 && length >= 7.4;
    if (lod === 0 && length < 9.0) continue;
    if (lod > 0) rect(out, w, 'stone', 0, length, floor - 0.46, 1.01, c.base, 0.075);
    rect(out, w, 'stone', 0, length, 22.85, eave, c.stone, 0.17);
    const count = Math.max(1, Math.round(length / [8.6, 5.35, 4.67, 4.67][lod]));
    if (lod > 0) {
      for (const y of [5.78, 13.95, 19.03]) {
        rect(out, w, 'stone', 0, length, y, y + 0.32, c.stoneShade, 0.14);
      }
    }
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * length / count, width = Math.min(2.12, length / count * 0.57);
      if (length > 4.2 && lod > 0) arch(out, w, u, 1.33, width * 0.83, 3.43, lod, 0.028, false);
      for (const [y, height] of (lod === 0 ? [[7.07, 5.62]] : [[7.07, 5.62], [15.03, 3.17], [19.78, 2.11]])) {
        const span = y === 7.07 ? width : width * 0.82;
        rect(out, w, 'glazing', u - span / 2, u + span / 2, y, y + height, c.glass, 0.036);
        if (lod > 1) {
          const side = y === 7.07 ? 0.18 : 0.13;
          for (const sign of [-1, 1]) {
            const offset = u + sign * (span / 2 + side / 2);
            rect(out, w, 'stone', offset - side / 2, offset + side / 2, y - 0.07, y + height + 0.12, c.stone, 0.09);
          }
          rect(out, w, 'stone', u - span / 2 - 0.21, u + span / 2 + 0.21, y - 0.18, y - 0.02, c.stone, 0.12);
          rect(out, w, 'metal', u - 0.035, u + 0.035, y, y + height, c.dark, 0.07);
        }
      }
      if (front && lod > 0) {
        triangle(out, w, 'stone', u - width * 0.64, u + width * 0.64, 12.88, 13.90, c.stone, 0.14);
        if (lod > 1 && i + 1 < count) {
          const x = u + length / count * 0.49;
          const pos = w.at(x, 8.38, 0.31);
          loft(out, 'metal', [
            radialRing(pos[1], 0.27, 0.25, 5, [pos[0], pos[2]]),
            radialRing(pos[1] + 1.35, 0.36, 0.28, 5, [pos[0], pos[2]]),
            radialRing(pos[1] + 1.87, 0.18, 0.17, 5, [pos[0], pos[2]]),
          ], c.bronze);
        }
      }
    }
  }
}

function mansard(out, roof, lod) {
  const [x0, x1, z0, z1] = roof.bounds;
  const [start, end, low, high] = roof.axis === 'x' ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const rise = roof.ridge - roof.eave, hip = roof.hip ?? 0;
  const place = (along, fraction, h) => {
    const across = lerp(low, high, fraction);
    return roof.axis === 'x' ? [along, h, across] : [across, h, along];
  };
  const profile = [[0, 0], [0.21, 0.72], [0.50, 1], [0.79, 0.72], [1, 0]];
  const endSection = (p, side) => place(side < 0 ? start + hip * p[1] : end - hip * p[1], p[0], roof.eave + rise * p[1]);
  for (let i = 1; i < profile.length; i++) {
    const p = profile[i - 1], q = profile[i];
    face(out, 'copper', [endSection(p, -1), endSection(p, 1), endSection(q, 1), endSection(q, -1)], up, i === 1 || i === 4 ? c.copper : c.copperLight);
  }
  for (const side of [-1, 1]) {
    const pts = profile.map((p) => endSection(p, side));
    const expected = roof.axis === 'x' ? [side, 0, 0] : [0, 0, side];
    const bottom = place(side < 0 ? start : end, 0.50, roof.eave);
    for (let i = 1; i < pts.length; i++) face(out, hip ? 'copper' : 'wall', [bottom, pts[i - 1], pts[i]], expected, hip ? c.copper : c.stone);
  }
  if (lod > 0) {
    beam(out, 'copper', endSection(profile[2], -1), endSection(profile[2], 1), 0.18, 0.20, c.slate);
  }
}

function frontDormers(out, lod) {
  const slots = lod === 0 ? [-39, -27, -15, 15, 27, 39] : [-41.7, -37, -32.4, -27.8, -23.1, -18.4, -13.7, 13.5, 18.2, 22.8, 27.5, 32.2, 36.9, 41.7];
  const front = wall([-58, -1.32], [58, -1.32]);
  for (const x of slots) {
    const u = x + 58, base = 24.10, width = lod ? 1.82 : 2.08;
    box(out, 'stone', x, base, -0.09, width, 3.21, 2.17, c.stone);
    triangle(out, front, 'stone', u - 1.03, u + 1.03, base + 3.20, base + 4.79, c.stone, -0.07);
    rect(out, front, 'glazing', u - 0.48, u + 0.48, base + 0.75, base + 2.52, c.recess, -0.10);
    if (lod > 1) {
      segment(out, front, 'stone', u - 1.11, base + 3.23, u, base + 4.94, -0.02, 0.18, 0.20, c.stoneShade);
      segment(out, front, 'stone', u, base + 4.94, u + 1.11, base + 3.23, -0.02, 0.18, 0.20, c.stoneShade);
      box(out, 'copper', x, base + 4.66, -0.64, 0.21, 0.71, 0.21, c.copper);
    }
  }
  for (const x of [-49.5, 49.4]) {
    const u = x + 58;
    triangle(out, front, 'stone', u - 5.2, u + 5.2, 24.12, 39.25, c.stone, 2.1);
    triangle(out, front, 'wall', u - 3.1, u + 3.1, 29.51, 40.5, c.stoneShade, 2.23);
    if (lod > 0) {
      for (const [y, width] of [[26.4, 1.05], [30.3, 0.82], [34.65, 0.61]]) {
        arch(out, front, u, y, width, 2.45, lod, 2.27);
      }
      segment(out, front, 'stone', u - 3.30, 29.1, u, 40.55, 2.26, 0.20, 0.26, c.stone);
      segment(out, front, 'stone', u, 40.55, u + 3.30, 29.1, 2.26, 0.20, 0.26, c.stone);
    }
  }
}

function towerRing(y, width, lod) {
  if (lod > 0) return chamferedRectangle(-0.20, y, 0, width, width, 0.29);
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([x, z]) => [-0.20 + x * width / 2, y, z * width / 2]);
}
function towerBody(out, lod) {
  const tiers = [[-1.1, 15.18], [23.05, 15.18], [24.05, 14.48], [51.98, 14.48],
    [52.55, 15.12], [54.24, 15.12], [63.96, 15.12], [64.42, 16.65], [65.90, 16.65]];
  loft(out, 'wall', tiers.map(([y, width]) => towerRing(y, width, lod)), c.wall);
  const walls = [
    wall([-7.76, -7.57], [7.36, -7.57]), wall([7.37, -7.56], [7.37, 7.56]),
    wall([7.36, 7.57], [-7.76, 7.57]), wall([-7.77, 7.56], [-7.77, -7.56]),
  ];
  for (const [index, w] of walls.entries()) {
    const center = w.length / 2;
    if (index === 0) {
      arch(out, w, center, 0.26, 5.40, 11.77, lod, 0.11);
      arch(out, w, center, 13.2, 2.72, 4.75, lod, 0.10);
      for (const x of [center - 3.76, center + 3.76]) {
        rect(out, w, 'stone', x - 0.40, x + 0.40, 1.1, 12.86, c.stone, 0.16);
      }
      rect(out, w, 'stone', center - 4.4, center + 4.4, 12.50, 13.03, c.stoneShade, 0.26);
    }
    for (const x of [center - 3.74, center, center + 3.74]) arch(out, w, x, 55.6, 1.65, 5.95, lod, 0.12);
    for (const [y, extent] of [[23.5, 0.22], [52.36, 0.40], [63.12, 0.34]]) {
      rect(out, w, 'stone', 0.03, w.length - 0.03, y, y + 0.52, c.stone, extent);
    }
    clock(out, w, center, 44.56, lod);
    triangle(out, w, 'stone', center - 5.98, center + 5.98, 64.78, 77.85, c.stone, 0.15);
    triangle(out, w, 'wall', center - 3.99, center + 3.99, 67.31, 75.75, c.stoneShade, 0.29);
    if (lod > 0) {
      arch(out, w, center, 67.81, 1.50, 3.92, lod, 0.35);
      for (const [y, w2] of [[66.01, 8.7], [69.31, 6.0], [72.31, 3.9]]) {
        rect(out, w, 'stone', center - w2 / 2, center + w2 / 2, y, y + 0.35, c.stone, 0.42);
      }
    }
    if (lod > 1) {
      for (let y = 25.7; y < 51.5; y += 1.25) {
        rect(out, w, 'stone', 0.06, 0.79, y, y + 0.28, c.stoneShade, -0.30);
        rect(out, w, 'stone', w.length - 0.79, w.length - 0.06, y, y + 0.28, c.stoneShade, -0.30);
      }
    }
  }
}

function clock(out, w, u, y, lod) {
  const offset = -0.28, radius = 2.16;
  rect(out, w, 'metal', u - 2.69, u + 2.69, y - 2.69, y + 2.69, c.gold, offset);
  const sides = lod === 0 ? 8 : lod === 1 ? 12 : 24;
  const ring = Array.from({ length: sides }, (_, i) => {
    const angle = 2 * Math.PI * i / sides;
    return w.at(u + radius * Math.cos(angle), y + radius * Math.sin(angle), offset + 0.032);
  });
  for (let i = 1; i < sides - 1; i++) face(out, 'metal', [ring[0], ring[i], ring[i + 1]], w.normal, c.burgundy);
  if (lod === 0) return;
  const ticks = 12;
  for (let i = 0; i < ticks; i++) {
    const a = 2 * Math.PI * i / ticks, x = Math.cos(a), z = Math.sin(a);
    if (lod > 1) segment(out, w, 'metal', u + x * 1.53, y + z * 1.53, u + x * 1.91, y + z * 1.91, offset + 0.065, 0.105, 0.071, c.gold);
    else rect(out, w, 'metal', u + x * 1.73 - 0.10, u + x * 1.73 + 0.10, y + z * 1.73 - 0.13, y + z * 1.73 + 0.13, c.gold, offset + 0.067);
  }
  segment(out, w, 'metal', u, y, u + 0.67, y + 1.43, offset + 0.08, 0.16, 0.085, c.gold);
  segment(out, w, 'metal', u, y, u - 0.88, y + 0.27, offset + 0.092, 0.16, 0.085, c.gold);
}

function copperTower(out, lod) {
  loft(out, 'copper', [[65.90, 14.8], [70.13, 11.31], [79.98, 6.33], [83.72, 5.28], [84.03, 6.15]]
    .map(([y, w]) => towerRing(y, w, lod)), c.copper);
  const rings = [[83.86, 3.63], [85.33, 3.66], [85.62, 3.15], [88.90, 3.15], [89.32, 3.38],
    [90.05, 2.40], [92.39, 1.95], [93.10, 2.09], [94.83, 1.36], [97.27, 1.19], [97.82, 1.02],
    [100.93, 0.60], [105.86, 0.32], [109.20, 0.12]];
  const sides = lod === 0 ? 4 : 10;
  loft(out, 'copper', rings.map(([y, r]) => radialRing(y, r, r, sides, [-0.20, 0])), c.copperLight);
  beam(out, 'metal', [-0.20, 108.7, 0], [-0.20, towerHeight, 0], 0.09, 0.085, c.gold);
  if (lod > 0) {
    for (const x of [-3.11, 2.71]) for (const z of [-2.91, 2.91]) {
      loft(out, 'copper', [[83.82, 0.72], [88.42, 0.66], [89.0, 0.88], [90.44, 0.58], [95.33, 0.06]]
        .map(([y, r]) => radialRing(y, r, r, 6, [x, z])), c.copper);
    }
  }
  if (lod > 1) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const x = -0.20 + Math.cos(a) * 3.08, z = Math.sin(a) * 3.08;
      beam(out, 'metal', [x, 85.6, z], [x, 88.89, z], 0.19, 0.18, c.slate);
    }
  }
}

function courtyardFountain(out, lod) {
  const center = basin.reduce(([x, z], p) => [x + p[0] / basin.length, z + p[1] / basin.length], [0, 0]);
  const y = ground(...center), [x, z] = center, sides = lod < 2 ? 8 : 24;
  loft(out, 'stone', [[y - 0.25, 4.20], [y + 0.27, 4.34], [y + 0.52, 4.31], [y + 0.54, 3.95], [y + 0.34, 3.87]]
    .map(([y, r]) => radialRing(y, r, r, sides, center)), c.stoneShade, { cap: false });
  const water = radialRing(y + 0.28, 3.88, 3.88, sides, center);
  out.addConvexPolygon('glazing', white, water, up, (p) => [p[0], p[2]], c.water);
  loft(out, 'stone', [[y + 0.23, 1.46], [y + 0.75, 1.45], [y + 0.93, 0.91], [y + 2.21, 0.77], [y + 2.32, 1.09]]
    .map(([y, r]) => radialRing(y, r, r, sides, center)), c.stone);
  loft(out, 'metal', [[y + 2.30, 0.36], [y + 3.43, 0.37], [y + 4.17, 0.30], [y + 4.63, 0.17]]
    .map(([y, r]) => radialRing(y, r, r, 6, center)), c.bronze);
  if (lod > 1) beam(out, 'metal', [x - 0.18, y + 4.02, z], [x - 0.87, y + 4.46, z + 0.22], 0.14, 0.13, c.bronze);
}

const ring = cleanRing(outline);
if (ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length];
  return sum + p[0] * q[1] - q[0] * p[1];
}, 0) < 0) ring.reverse();

function build(out, lod) {
  facade(out, ring, lod);
  for (const roof of roofs) mansard(out, roof, lod);
  frontDormers(out, lod);
  towerBody(out, lod);
  copperTower(out, lod);
  courtyardFountain(out, lod);
}
export const rathausSkyline = (out) => build(out, 0);
export const rathausDistrict = (out) => build(out, 1);
export const rathausStreet = (out) => build(out, 2);
export const rathausCloseup = (out) => build(out, 3);
const recipe = 'hamburg-city-hall-model.mjs';
const camera = [140, 114, -188], lookAt = [0, 47, 13];
const authoredLevels = Object.fromEntries([
  ['district', 'rathausDistrict', 0.40], ['street', 'rathausStreet', 0.16], ['closeup', 'rathausCloseup', 0.040],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const rathausModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: rathausCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Hamburg’s Rathausmarkt frontage with its sandstone window bays, green copper mansards, central gilded clocks and open Hygieia courtyard.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.94, basis: 'Named native OpenStreetMap city hall perimeter, ODbL 1.0.' },
  mediumFiContext: { scale: 2.05, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_sandstone', 'stone_sandstone_raw', 'metal_copper', 'metal_painted'],
  qaCameras: [
    { name: 'rathausmarkt-and-clock-tower', position: [61, 47, -143], lookAt: [0, 45, 3] },
    { name: 'sandstone-portal-and-copper-dormers', position: [27, 16, -50], lookAt: [0, 20, -6.3] },
    { name: 'hygieia-courtyard-and-rear-roofs', position: [67, 38, 111], lookAt: [1.6, 13.6, 33] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hamburg-rathaus-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'rathausSkyline', errorMeters: 0.94, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Mapped parts © OpenStreetMap contributors, ODbL 1.0. Three exact Qualla exterior photos dedicated to CC0 by their creators.',
};
