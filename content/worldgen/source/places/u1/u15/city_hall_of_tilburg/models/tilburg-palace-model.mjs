/** The crenellated Palace-Council House at Willemsplein, Tilburg, in 2010. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { body, westBay, eastBay, turrets } = plan;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.81, metallic: 0.1 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.16 },
};
const colors = Object.fromEntries(Object.entries({
  wall: 'e1ddd4', reveal: 'c4bcad', trim: 'c7c1b7', roof: '656869', terrace: '837f76',
  plinth: 'a6a098', step: '828288', dark: '353636', glass: '434949',
  arch: 'ae9d85', mullion: '53524f', canopy: '45605e', pole: 'c5c2b5', gilt: 'aa8250',
}).map(([name, color]) => [name, rgb(color)]));
const up = [0, 1, 0];
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const point = ([x, z], y) => [x, y, z];

function directed(out, slot, points, normal, color) {
  const wound = dot(normalFor(...points), normal) >= 0 ? points : points.toReversed();
  if (points.length === 3) triangle(out, slot, wound, color);
  else face(out, slot, wound, color);
}

function surface(out, slot, ring, coordinates, outward, color, holes = []) {
  const points = [...ring];
  const holeIndices = holes.map((hole) => {
    const index = points.length;
    points.push(...hole);
    return index;
  });
  const indices = earcut(points.flat(), holeIndices);
  for (let i = 0; i < indices.length; i += 3) {
    directed(out, slot, indices.slice(i, i + 3).map((k) => coordinates(...points[k])), outward, color);
  }
}

function edge(a, b, outward) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const point = (u, y, depth = 0) => [
    a[0] + (b[0] - a[0]) * (u / length) - outward[0] * depth,
    y,
    a[1] + (b[1] - a[1]) * (u / length) - outward[2] * depth,
  ];
  return { length, point, outward };
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j;
  const [row, next] = terrain.heightsMeters.slice(j, j + 2);
  return (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) - terrain.modelDatumElevationMeters;
}

const front = (left, right, z = body.frontZ) => edge([left, z], [right, z], [0, 0, 1]);
const back = (left, right) => edge([left, body.backZ], [right, body.backZ], [0, 0, -1]);

function windowShape({ center, y, width, height, arch }, lod) {
  const half = width / 2, left = center - half, right = center + half;
  if (!arch) return [[left, y], [right, y], [right, y + height], [left, y + height]];
  const segments = [2, 3, 5, 7][lod];
  const spring = y + height - half * 1.2;
  const profile = [[left, y], [right, y]];
  for (let i = 0; i <= 2 * segments; i++) {
    const t = i / segments - 1;
    profile.push([center - half * t, spring + half * 1.2 * (1 - Math.pow(Math.abs(t), 1.65))]);
  }
  return profile;
}

function wall(out, section, low, high, windows, lod) {
  const { length, point: p, outward } = section;
  const border = [[0, low], [length, low], [length, high], [0, high]];
  const holes = windows.map((window) => windowShape(window, lod));
  surface(out, 'wall', border, p, outward, colors.wall, lod ? holes : []);
  for (const [i, window] of windows.entries()) {
    const ring = holes[i], depth = lod ? (window.depth ?? 0.24) : -0.018;
    const tint = window.tint ?? colors.glass;
    surface(out, 'dark', ring, (u, y) => p(u, y, depth), outward, tint);
    if (!lod) continue;
    const center = p(window.center, window.y + window.height * 0.45);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j], b = ring[(j + 1) % ring.length];
      const mid = p((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      directed(out, 'wall', [p(...a), p(...b), p(...b, depth), p(...a, depth)],
        center.map((n, k) => n - mid[k]), colors.reveal);
    }
    if (lod >= 2 && !window.tint) {
      const inset = depth - 0.022;
      beam(out, 'dark', p(window.center, window.y + 0.02, inset),
        p(window.center, window.y + window.height - 0.16, inset), 0.048, 0.06, colors.mullion);
      for (const f of [0.48, 0.76]) {
        beam(out, 'dark', p(window.center - window.width * 0.49, window.y + window.height * f, inset),
          p(window.center + window.width * 0.49, window.y + window.height * f, inset),
          0.046, 0.06, colors.mullion);
      }
      beam(out, 'stone', p(window.center - window.width * 0.58, window.y, -0.105),
        p(window.center + window.width * 0.58, window.y, -0.105), 0.12, 0.23, colors.trim);
    }
  }
}

function foundation(out, lod) {
  const skip = lod <= 1 ? 5 : 2;
  const ring = outline.filter((_, i) => i % skip === 0 || [17, 18, 19, 20, 53, 73, 136, 138, 139, 142, 143, 144].includes(i));
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    directed(out, 'stone', [point(a, grade(...a) - 0.28), point(b, grade(...b) - 0.28),
      point(b, body.plinthTop), point(a, body.plinthTop)],
    [b[1] - a[1], 0, a[0] - b[0]], colors.plinth);
  }
}

function parapet(out, section, roofY, base, count, lod) {
  const { length, point: p, outward } = section;
  const walk = 0.37, height = 0.92;
  const inward = outward.map((n) => -n);
  const strip = [[0, roofY - 0.1], [length, roofY - 0.1], [length, base], [0, base]];
  directed(out, 'wall', strip.map((q) => p(...q)), outward, colors.wall);
  if (!lod) {
    const skylineCount = Math.max(1, Math.round(count * 0.57));
    const spacing = length / skylineCount;
    for (let i = 0; i < skylineCount; i++) {
      const left = i * spacing + spacing * 0.12, right = left + spacing * 0.51;
      directed(out, 'wall', [p(left, base), p(right, base), p(right, base + height), p(left, base + height)],
        outward, colors.wall);
    }
    return;
  }
  directed(out, 'wall', strip.map((q) => p(...q, walk)), inward, colors.reveal);
  directed(out, 'stone', [p(0, base), p(length, base), p(length, base, walk), p(0, base, walk)], up, colors.trim);
  const spacing = length / count;
  for (let i = 0; i < count; i++) {
    const u0 = i * spacing + spacing * 0.12, u1 = u0 + spacing * 0.51;
    const top = base + height;
    const quad = [[u0, base], [u1, base], [u1, top], [u0, top]];
    directed(out, 'wall', quad.map((q) => p(...q)), outward, colors.wall);
    directed(out, 'wall', quad.map((q) => p(...q, walk)), inward, colors.reveal);
    directed(out, 'stone', [p(u0, top), p(u1, top), p(u1, top, walk), p(u0, top, walk)], up, colors.trim);
    const left = p(0, 0), right = p(length, 0);
    const side = right.map((n, k) => n - left[k]);
    directed(out, 'wall', [p(u0, base), p(u0, top), p(u0, top, walk), p(u0, base, walk)],
      side.map((n) => -n), colors.reveal);
    directed(out, 'wall', [p(u1, base), p(u1, top), p(u1, top, walk), p(u1, base, walk)],
      side, colors.reveal);
    if (lod >= 2) {
      beam(out, 'stone', p(u0 - 0.025, top - 0.055, -0.032), p(u1 + 0.025, top - 0.055, -0.032),
        0.075, 0.085, colors.trim);
    }
  }
}

function roof(out, bounds, y, color) {
  surface(out, 'roof', bounds, (x, z) => [x, y, z], up, color);
}

function entrance(out, lod) {
  const stepCount = lod ? 8 : 4;
  const base = Math.max(-0.03, grade(0, 12.7));
  for (let i = 0; i < stepCount; i++) {
    const height = (body.plinthTop - base) * (i + 1) / stepCount;
    const run = (stepCount - i) * 2.73 / stepCount;
    box(out, 'stone', 0, base + height / 2, westBay.faceZ + run / 2, 7.25, height, run, colors.step);
  }
  const canopyY = 4.72, z = westBay.faceZ + 1.11;
  box(out, 'metal', 0, canopyY, z, 7.44, 0.31, 2.18, colors.canopy);
  box(out, 'metal', 0, canopyY + 0.19, z + 0.99, 7.29, 0.23, 0.16, colors.canopy);
  for (const x of [-3.34, -1.14, 1.14, 3.34]) {
    box(out, 'stone', x, 1.96, z + 0.76, 0.36, 0.57, 0.38, colors.plinth);
    box(out, 'metal', x, 3.44, z + 0.76, 0.15, 2.75, 0.15, colors.canopy);
    if (lod >= 1) {
      box(out, 'metal', x, canopyY + 0.37, z + 0.90, 0.22, 0.43, 0.21, colors.canopy);
      box(out, 'dark', x, canopyY + 0.63, z + 0.90, 0.22, 0.27, 0.18, colors.gilt);
    }
  }
}

function palaceBody(out, lod) {
  const cap = body.parapetBase;
  const lower = (center) => ({ center, y: 1.97, width: 1.47, height: 3.60 });
  const upper = (center) => ({ center, y: 7.17, width: 1.50, height: 4.43, arch: true });
  const sides = [[-16.54, -westBay.halfWidth], [westBay.halfWidth, 16.54]];
  for (const [left, right] of sides) {
    const bays = plan.wingBays.filter((x) => x > left && x < right).map((x) => x - left);
    const windows = bays.flatMap((x) => [lower(x), upper(x)]);
    const rearLeft = left < 0 ? left : eastBay.radiusX - 0.035;
    const rearRight = right > 0 ? right : -eastBay.radiusX + 0.035;
    const rearWindows = bays.map((x) => x + left - rearLeft).flatMap((x) => [lower(x), upper(x)]);
    const facade = front(left, right), rear = back(rearLeft, rearRight);
    wall(out, facade, body.plinthTop, body.roof - 0.1, windows, lod);
    wall(out, rear, body.plinthTop, body.roof - 0.1, rearWindows, lod === 1 ? 0 : lod);
    parapet(out, facade, body.roof, cap, 12, lod);
    parapet(out, rear, body.roof, cap, 12, lod);
    box(out, 'stone', (left + right) / 2, 12.66, body.frontZ - 0.045,
      right - left, 0.16, 0.28, colors.trim);
    if (lod) {
      const basement = bays.map((x) => ({ center: x, y: 0.34, width: 1.21, height: 0.78, tint: colors.dark }));
      for (const pane of basement) {
        surface(out, 'dark', windowShape(pane, 0),
          (u, y) => facade.point(u, y, -0.023), facade.outward, colors.dark);
      }
    }
  }
  const { halfWidth: x, faceZ } = westBay;
  const middle = front(-x, x, faceZ);
  const centerOpenings = [-2.12, 0, 2.12].flatMap((u) => [
    { center: u + x, y: 1.72, width: 1.83, height: 2.80, tint: colors.dark },
    { center: u + x, y: 5.20, width: 1.52, height: 1.28, tint: colors.glass },
    { center: u + x, y: 7.21, width: 0.84, height: 4.50, arch: true },
  ]);
  if (lod >= 2) {
    for (let i = 0; i < 7; i++) {
      centerOpenings.push({ center: 0.58 + i * 0.98, y: 12.30, width: 0.83, height: 0.90,
        arch: true, depth: 0.105, tint: colors.reveal });
    }
  }
  wall(out, middle, body.plinthTop, westBay.deck - 0.1, centerOpenings, lod);
  parapet(out, middle, westBay.deck, westBay.parapetBase, 7, lod);
  const backOfWestBay = body.frontZ - 1.04;
  const innerBay = edge([-x, backOfWestBay], [x, backOfWestBay], [0, 0, -1]);
  wall(out, innerBay, body.roof, westBay.deck, [], lod);
  for (const direction of [-1, 1]) {
    const side = edge([direction * x, body.frontZ], [direction * x, faceZ], [direction, 0, 0]);
    const returnWall = edge([direction * x, backOfWestBay], [direction * x, body.frontZ], [direction, 0, 0]);
    wall(out, side, body.plinthTop, westBay.deck - 0.1, [], lod);
    wall(out, returnWall, body.roof, westBay.deck, [], lod);
    parapet(out, side, westBay.deck, westBay.parapetBase, 1, lod);
    const end = edge([direction * body.halfWidth, -6.1], [direction * body.halfWidth, 6.3], [direction, 0, 0]);
    const windows = [2.65, 5.92, 9.18].flatMap((u) => [lower(u), upper(u)]);
    wall(out, end, body.plinthTop, body.roof - 0.1, windows, lod === 1 ? 0 : lod);
    parapet(out, end, body.roof, cap, 10, lod);
  }
  roof(out, [[-body.halfWidth, body.backZ], [body.halfWidth, body.backZ],
    [body.halfWidth, body.frontZ], [-body.halfWidth, body.frontZ]], body.roof, colors.roof);
  roof(out, [[-x, backOfWestBay], [x, backOfWestBay], [x, faceZ], [-x, faceZ]],
    westBay.deck, colors.terrace);
  if (lod >= 1) {
    for (const x of [-10.5, 9.4]) {
      box(out, 'roof', x, body.roof + 0.36, -0.55, 2.45, 0.73, 1.78, colors.roof);
    }
  }
  box(out, 'wall', -19.05, 6.78, 0.25, 3.44, 10.25, 10.98, colors.reveal);
  box(out, 'roof', -19.03, 12.02, 0.25, 3.49, 0.24, 10.99, colors.roof);
  entrance(out, lod);
}

function projectingBay(out, lod) {
  const segments = lod ? 12 : 6;
  const arc = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = i * Math.PI / segments;
    return [eastBay.radiusX * Math.cos(angle), body.backZ - eastBay.radiusZ * Math.sin(angle)];
  });
  for (let i = 0; i < segments; i++) {
    const a = arc[i], b = arc[i + 1];
    const outward = [a[0] + b[0], 0, a[1] + b[1] - 2 * body.backZ];
    const magnitude = Math.hypot(outward[0], outward[2]);
    const section = edge(a, b, outward.map((v) => v / magnitude));
    const u = section.length / 2;
    const windows = (i % 2 ? [] : [
      { center: u, y: 2.55, width: section.length * 0.55, height: 3.03 },
      { center: u, y: 7.35, width: section.length * 0.58, height: 4.19, arch: true },
    ]);
    wall(out, section, body.plinthTop, eastBay.deck - 0.1, windows, lod === 1 ? 0 : lod);
    parapet(out, section, eastBay.deck, eastBay.parapetBase, 1, lod);
  }
  roof(out, arc, eastBay.deck, colors.terrace);
}

function turret(out, { center: [x, z], radius, deck }, lod) {
  const segments = [12, 24, 32, 40][lod];
  const ring = (offset = 0) => Array.from({ length: segments }, (_, i) => {
    const angle = 2 * Math.PI * i / segments;
    return [x + (radius - offset) * Math.cos(angle), z + (radius - offset) * Math.sin(angle)];
  });
  const shell = ring();
  roof(out, shell, deck - 0.09, colors.terrace);
  for (let i = 0; i < segments; i++) {
    const a = shell[i], b = shell[(i + 1) % segments];
    const angle = 2 * Math.PI * (i + 0.5) / segments;
    const normal = [Math.cos(angle), 0, Math.sin(angle)];
    const section = edge(a, b, normal);
    const openingFace = z > 0 ? i === Math.floor(segments / 4) : i === Math.floor(segments * 0.75);
    const windows = openingFace ? [5.6, 10.0].map((y) => ({
      center: section.length / 2, y, width: section.length * 0.47, height: 1.06, tint: colors.dark,
    })) : [];
    wall(out, section, body.plinthTop, deck, windows, lod);
  }
  const crenels = lod ? 10 : 8;
  for (let i = 0; i < crenels; i++) {
    const angle = 2 * Math.PI * i / crenels;
    const a = [x + radius * Math.cos(angle), z + radius * Math.sin(angle)];
    const next = angle + 2 * Math.PI / crenels;
    const b = [x + radius * Math.cos(next), z + radius * Math.sin(next)];
    const mid = (angle + next) / 2;
    parapet(out, edge(a, b, [Math.cos(mid), 0, Math.sin(mid)]), deck - 0.14, deck + 0.20, 1, lod);
  }
  if (lod >= 1 && z > 0) {
    const base = deck + 0.05, mast = base + 4.55;
    beam(out, 'metal', [x, base, z], [x, mast, z], 0.052, 0.052, colors.pole);
    const rails = lod >= 2 ? 8 : 4;
    for (let i = 0; i < rails; i++) {
      const angle = i * 2 * Math.PI / rails;
      const next = (i + 1) * 2 * Math.PI / rails;
      const p = (a, r, h) => [x + r * Math.cos(a), base + h, z + r * Math.sin(a)];
      beam(out, 'metal', p(angle, 0.47, 0.15), p(angle, 0.36, 1.95), 0.052, 0.052, colors.pole);
      beam(out, 'metal', p(angle, 0.36, 1.95), p(angle, 0.1, 2.22), 0.052, 0.052, colors.pole);
      if (lod >= 2) {
        for (const h of [0.55, 1.16, 1.83]) {
          beam(out, 'metal', p(angle, 0.43, h), p(next, 0.43, h), 0.044, 0.045, colors.pole);
        }
      }
    }
  }
}

function build(out, lod) {
  foundation(out, lod);
  palaceBody(out, lod);
  projectingBay(out, lod);
  for (const corner of turrets) turret(out, corner, lod);
}

export const palaceSkyline = (out) => build(out, 0);
export const palaceDistrict = (out) => build(out, 1);
export const palaceStreet = (out) => build(out, 2);
export const palaceCloseup = (out) => build(out, 3);

const recipe = 'tilburg-palace-model.mjs', camera = [32, 21, 61], lookAt = [0, 8.6, 0];
const authoredLevels = Object.fromEntries([
  ['district', 'palaceDistrict', 0.48],
  ['street', 'palaceStreet', 0.16],
  ['closeup', 'palaceCloseup', 0.045],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const palaceModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: palaceCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'White crenellated former palace with round turrets, tall pointed windows and an Art Deco entrance canopy on Willemsplein.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.94, basis: 'The named BAG palace polygon from OpenStreetMap way 280907288.' },
  mediumFiContext: { scale: 2.25, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'willemsplein-west-front', position: [0, 8.8, 53], lookAt: [0, 8.5, 5.6] },
    { name: 'canopy-and-pointed-windows', position: [10, 9, 24], lookAt: [0, 6.7, 8.4] },
    { name: 'east-bay-and-north-connection', position: [-38, 22, -41], lookAt: [0, 8.6, -3.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-palace-' + reviewLod, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline', export: 'palaceSkyline', errorMeters: 0.86, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. The OpenStreetMap footprint is ODbL. Wobuzowatsj dedicated both exact Qualla exterior photos to the public domain under CC0.',
};
