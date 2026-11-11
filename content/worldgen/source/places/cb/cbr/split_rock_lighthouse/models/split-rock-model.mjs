/** Split Rock Lighthouse’s octagonal tower and cleaning room in June 2012. */
import fs from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const section = plan.section;
const [mappedTower] = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))).geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  concrete: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.69, metallic: 0.18 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.12 },
};
const color = Object.fromEntries(Object.entries({
  brick: 'dbb67e', stone: 'd4ccb7', foundation: 'a49d8e', iron: '454745', darkIron: '303332',
  glass: '6b8388', shadowGlass: '53696e', darkWindow: '495651', frame: 'c2b49b',
}).map(([key, tint]) => [key, rgb(tint)]));
const white = 'palette:#ffffff';
const up = [0, 1, 0];

function face(out, slot, points, direction, tint) {
  let n = normalFor(...points);
  if (n.reduce((dot, v, i) => dot + v * direction[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else out.addTriangle(slot, white, points, n, [[0, 0], [1, 0], [0, 1]], tint);
}

function edge([x, z], end) {
  const width = Math.hypot(end[0] - x, end[1] - z);
  const dx = (end[0] - x) / width, dz = (end[1] - z) / width;
  const normal = [dz, 0, -dx];
  return {
    width, normal,
    at: (u, y, p = 0) => [x + u * dx + p * dz, y, z + u * dz - p * dx],
  };
}

const sides = (ring) => ring.map((p, i) => edge(p, ring[(i + 1) % ring.length]));
const position = ([x, z], y) => [x, y, z];
const rectangle = ([x0, x1, z0, z1]) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
function octagon(radius) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = section.towerRotation + (Math.PI * i) / 4;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
}

function panel(out, slot, e, a, b, low, high, depth, tint) {
  face(out, slot, [e.at(a, low, depth), e.at(b, low, depth), e.at(b, high, depth),
    e.at(a, high, depth)], e.normal, tint);
}

function slab(out, slot, ring, y, tint) {
  for (let i = 1; i < ring.length - 1; i++) {
    face(out, slot, [position(ring[0], y), position(ring[i], y), position(ring[i + 1], y)], up, tint);
  }
}

function profile(out, slot, levels, tint) {
  for (let i = 1; i < levels.length; i++) {
    const [base, r0] = levels[i - 1], [top, r1] = levels[i];
    const lower = octagon(r0), upper = octagon(r1), edges = sides(lower);
    for (let j = 0; j < lower.length; j++) {
      const k = (j + 1) % lower.length;
      const direction = top === base ? up : edges[j].normal;
      face(out, slot, [position(lower[j], base), position(lower[k], base), position(upper[k], top),
        position(upper[j], top)], direction, tint);
    }
  }
}

function opening(out, e, center, y, w, h, lod, door = false, depth = 0.026) {
  const tint = door ? color.darkIron : color.darkWindow;
  const a = center - w / 2, b = center + w / 2;
  if (lod) {
    panel(out, 'concrete', e, a - 0.095, b + 0.095, y - 0.075, y + h + 0.10, depth, color.frame);
    panel(out, 'concrete', e, a - 0.12, b + 0.12, y - 0.07, y + 0.035, depth + 0.055, color.stone);
  }
  panel(out, 'window', e, a, b, y, y + h, depth + 0.019, tint);
  if (lod >= 2 && !door) {
    const rail = y + h * 0.54;
    panel(out, 'window', e, a, b, rail - 0.025, rail + 0.025, depth + 0.041, color.frame);
    panel(out, 'window', e, center - 0.024, center + 0.024, y, y + h, depth + 0.041, color.frame);
  }
}

function shaft(out, lod) {
  profile(out, 'concrete', [[section.towerFoundation, 3.22], [2.25, 3.22], [2.45, 3.2]], color.foundation);
  profile(out, 'concrete', [[2.45, 3.2], [2.5, 3.29], [2.72, 3.29], [2.84, 3.15], [2.94, 3.05]], color.stone);
  profile(out, 'brick', [[2.94, 3.05], [8.78, 2.45]], color.brick);
  profile(out, 'concrete', [[8.78, 2.45], [8.92, 2.69], [9.16, 2.69], [9.37, 2.38]], color.stone);
  profile(out, 'brick', [[9.37, 2.38], [11.91, 2.38]], color.brick);
  profile(out, 'concrete', [[11.91, 2.38], [12.1, 2.59], [12.3, 2.59]], color.stone);
  if (lod === 3) {
    for (const e of sides(octagon(3.22))) {
      for (const y of [0.55, 1.14, 1.73]) {
        panel(out, 'concrete', e, 0, e.width, y, y + 0.025, 0.011, color.stone);
      }
    }
  }
  const radiusAt = (y) => 3.05 + ((2.45 - 3.05) * (y - 2.94)) / (8.78 - 2.94);
  for (const [i, e] of sides(octagon(2.38)).entries()) {
    if ([0, 2, 4, 6].includes(i)) opening(out, e, e.width / 2, 9.83, 0.53, 1.39, lod);
  }
  for (const [i, y] of [[0, 5.17], [1, 6.72], [2, 4.98], [4, 4.15], [5, 5.75], [7, 3.72]]) {
    const bottom = sides(octagon(radiusAt(y)))[i];
    const top = sides(octagon(radiusAt(y + 1.46)))[i];
    const tapered = { ...bottom, at: (u, h, depth = 0) => {
      const frac = (h - y) / 1.46, a = bottom.at(u, h, depth);
      const b = top.at(u * top.width / bottom.width, h, depth);
      return [a[0] + frac * (b[0] - a[0]), h, a[2] + frac * (b[2] - a[2])];
    } };
    opening(out, tapered, bottom.width / 2, y, 0.55, 1.37, lod);
  }
}

function lantern(out, lod) {
  const floor = section.lanternSpring, head = section.lanternHead, deck = section.galleryDeck;
  const railRing = octagon(2.62);
  profile(out, 'iron', [[deck, 2.55], [deck + 0.11, 2.62], [deck + 0.16, 2.62]], color.darkIron);
  slab(out, 'iron', railRing, deck + 0.16, color.iron);
  const glazing = octagon(1.86);
  for (const [i, e] of sides(glazing).entries()) {
    panel(out, 'window', e, 0, e.width, floor, head, 0,
      i % 3 === 1 ? color.shadowGlass : color.glass);
    if (lod) {
      const count = lod >= 2 ? 3 : 2;
      for (let p = 0; p < count; p++) {
        const u = e.width * p / count;
        beam(out, 'iron', e.at(u, floor, 0.016), e.at(u, head, 0.016), 0.042, 0.052, color.darkIron);
      }
      const crossbars = lod === 3
        ? [floor + 0.17, floor + 1.14, floor + 2.18, head - 0.10]
        : [floor + 0.17, floor + 1.14, head - 0.10];
      for (const y of crossbars) {
        beam(out, 'iron', e.at(0, y, 0.022), e.at(e.width, y, 0.022), 0.043, 0.044, color.darkIron);
      }
    }
  }
  if (lod) {
    for (const e of sides(railRing)) {
      const y = deck + 0.90;
      beam(out, 'iron', e.at(0, y), e.at(e.width, y), 0.064, 0.062, color.darkIron);
      if (lod >= 2) beam(out, 'iron', e.at(0, y - 0.36), e.at(e.width, y - 0.36), 0.04, 0.046, color.darkIron);
      const count = lod >= 2 ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const u = e.width * i / count;
        beam(out, 'iron', e.at(u, deck + 0.14), e.at(u, y), 0.039, 0.042, color.darkIron);
      }
    }
  } else {
    profile(out, 'iron', [[deck + 0.81, 2.62], [deck + 0.90, 2.62]], color.darkIron);
  }
  profile(out, 'iron', [[head, 1.84], [head + 0.12, 2.02], [head + 0.24, 2.02],
    [16.38, 0.57], [16.79, 0.23], [16.9, 0.23]], color.darkIron);
  profile(out, 'iron', [[16.9, 0.23], [17.07, 0.18], [17.23, 0.25], [17.39, 0.14],
    [section.towerTop, 0.023]], color.darkIron);
  slab(out, 'iron', octagon(0.023), section.towerTop, color.darkIron);
}

function cleaningRoom(out, lod) {
  const [x0, x1, z0, z1] = section.roomBounds;
  const ring = rectangle(section.roomBounds);
  for (const [i, e] of sides(ring).entries()) {
    panel(out, 'concrete', e, 0, e.width, section.roomFoundation, 0.84, 0, color.foundation);
    panel(out, 'brick', e, 0, e.width, 0.84, section.roomEaves, 0, color.brick);
    panel(out, 'concrete', e, 0, e.width, 0.78, 1.10, 0.11, color.stone);
    panel(out, 'concrete', e, 0, e.width, 4.41, section.roomEaves, 0.14, color.stone);
    if (i === 1) {
      opening(out, e, e.width * 0.35, section.roomThreshold, 0.92, 2.12, lod, true);
      opening(out, e, e.width * 0.72, 1.69, 0.63, 1.28, lod);
    } else {
      for (const f of [0.23, 0.5, 0.77]) opening(out, e, e.width * f, 1.73, 0.64, 1.25, lod);
    }
    if (lod) {
      for (const f of [0.08, 0.37, 0.63, 0.92]) {
        panel(out, 'concrete', e, e.width * f - 0.13, e.width * f + 0.13,
          1.12, 4.41, 0.055, color.stone);
      }
    }
  }
  const overhang = rectangle([x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15]);
  for (const e of sides(overhang)) {
    panel(out, 'iron', e, 0, e.width, section.roomEaves, section.roomRoof, 0, color.iron);
  }
  slab(out, 'iron', overhang, section.roomRoof, color.iron);
  box(out, 'brick', x0 + 0.59, 5.35, z0 + 0.56, 0.48, 0.83, 0.48, color.brick);
  box(out, 'iron', x0 + 0.59, 5.78, z0 + 0.56, 0.57, 0.09, 0.56, color.darkIron);
  for (let i = 0; i < 3; i++) {
    const height = 0.26 + i * 0.18, width = 1.39 - i * 0.28;
    box(out, 'concrete', x1 + width / 2, 0.02 + height / 2, z0 + (z1 - z0) * 0.35,
      width, height, 1.65, color.stone);
  }
  const passage = rectangle(section.passageBounds);
  for (const [i, e] of sides(passage).entries()) {
    panel(out, 'brick', e, 0, e.width, section.roomFoundation, 4.31, 0, color.brick);
    if (i % 2 === 1) opening(out, e, e.width / 2, 1.8, 0.59, 1.07, lod);
    panel(out, 'concrete', e, 0, e.width, 4.13, 4.31, 0.07, color.stone);
  }
  slab(out, 'iron', passage, 4.31, color.iron);
}

function build(out, lod) {
  shaft(out, lod);
  lantern(out, lod);
  cleaningRoom(out, lod);
}

export const splitRockSkyline = (out) => build(out, 0);
export const splitRockDistrict = (out) => build(out, 1);
export const splitRockStreet = (out) => build(out, 2);
export const splitRockCloseup = (out) => build(out, 3);

const recipe = 'split-rock-model.mjs';
const camera = [20, 19, 32], lookAt = [0, 7, -2.8];
const authoredLevels = Object.fromEntries([
  ['district', 'splitRockDistrict', 0.19], ['street', 'splitRockStreet', 0.085], ['closeup', 'splitRockCloseup', 0.036],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const splitRockModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  recipe,
  surfaces,
  build: splitRockCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Split Rock Lighthouse in June 2012, with a buff octagonal tower, glazed iron lantern, exterior gallery, and attached cleaning room on Lake Superior’s North Shore.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: {
    outline: mappedTower,
    minimumCoverage: 0.92,
    basis: 'The mapped lighthouse shaft is OpenStreetMap way 390175205.',
  },
  mediumFiContext: { scale: 0.74, groundY: 0, terrain: {
    descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png',
  } },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    { name: 'lakeward-tower-and-cleaning-room', position: [-26, 12, 28], lookAt: [0, 8.1, -3] },
    { name: 'lantern-and-iron-gallery', position: [15, 16.9, 9.6], lookAt: [0, 13.6, 0] },
    { name: 'landward-entry-and-passage', position: [16, 7.2, -20], lookAt: [0, 4.4, -5.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-split-rock-lighthouse-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'splitRockSkyline', errorMeters: 0.45, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. OpenStreetMap ODbL 1.0, JMLAX101’s CC0 exterior and the public-domain Minnesota Historical Society construction section.',
};
