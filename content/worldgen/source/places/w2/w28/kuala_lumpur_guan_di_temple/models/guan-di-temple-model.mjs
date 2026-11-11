/** Kuala Lumpur's Guan Di Temple as photographed from Jalan Tun H.S. Lee in February 2007. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beam, beamPath, normalFor, loft, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { triangle } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const requireFromWorldgen = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = requireFromWorldgen('earcut');
const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const { section: s } = plan;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.76, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.67, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92, metallic: 0 },
  dark: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
};
const color = Object.fromEntries(Object.entries({
  plaster: 'ac593e', shadow: '894c3b', oxide: '8f3c32', trim: 'b34f3a',
  dark: '342925', wood: '662f2a', gold: 'b79558', jade: '55796d',
  tile: '485c54', tileLight: '789083', porcelain: 'c5b6a0', paving: 'a5a09a',
  lightStone: 'a69f8d', darkStone: '807768', rear: 'b3a28d', red: 'a83e33',
}).map(([name, value]) => [name, rgb(value)]));

const rect = (out, slot, x0, x1, y0, y1, z0, z1, c) =>
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c);
function panel(out, slot, points, outward, c) {
  const n = normalFor(...points);
  const aligned = n.reduce((sum, v, i) => sum + v * outward[i], 0) > 0;
  const corners = aligned ? points : points.toReversed();
  quad(out, slot, corners, aligned ? n : n.map((v) => -v), c);
}

function paving(out) {
  const top = s.forecourtFloor;
  const under = -1.25;
  const clean = outline.filter((p, i) => i === 0 || Math.hypot(p[0] - outline[i - 1][0], p[1] - outline[i - 1][1]) > 0.04);
  const edge = (p, y) => [p[0], y, p[1]];
  const faces = earcut(clean.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const points = faces.slice(i, i + 3).map((j) => edge(clean[j], top));
    triangle(out, 'stone', normalFor(...points)[1] > 0 ? points : points.reverse(), color.paving);
  }
  for (let i = 0; i < clean.length; i++) {
    const a = clean[i], b = clean[(i + 1) % clean.length];
    panel(out, 'stone', [edge(a, under), edge(b, under), edge(b, top), edge(a, top)],
      [b[1] - a[1], 0, a[0] - b[0]], color.darkStone);
  }
}

function roof(out, { x0, x1, z0, z1, eave, rise, lift, detailed }, lod) {
  const ridge = (z0 + z1) / 2;
  const width = x1 - x0;
  const corner = Math.min(width * 0.18, 1.8);
  const distantSideRoof = lod === 0 && !detailed;
  const stations = distantSideRoof ? [x0, x1] : [x0, x0 + corner, x1 - corner, x1];
  const profile = distantSideRoof ? [[0, 0], [1, 1]] : lod < 2 ? [[0, 0], [0.5, 0.35], [1, 1]]
    : [[0, 0], [0.19, 0.075], [0.41, 0.24], [0.69, 0.56], [1, 1]];
  const p = (x, edge, [t, h]) => {
    const r = Math.max(0, 1 - Math.min(x - x0, x1 - x) / corner);
    return [x, eave + rise * h + lift * r * r * (1 - h * 0.55), edge + (ridge - edge) * t];
  };
  for (const edge of [z0, z1]) {
    for (let j = 1; j < profile.length; j++) {
      const [a, b] = [profile[j - 1], profile[j]];
      for (let i = 1; i < stations.length; i++) {
        const [u, v] = [stations[i - 1], stations[i]];
        const points = [p(u, edge, a), p(v, edge, a), p(v, edge, b), p(u, edge, b)];
        panel(out, 'roof', points, [0, 1, 0], color.tile);
      }
      for (const end of [x0, x1]) {
        const [k, m] = [p(end, edge, a), p(end, edge, b)];
        panel(out, 'wall', [[end, eave - 0.15, k[2]], [end, eave - 0.15, m[2]], m, k],
          [end === x0 ? -1 : 1, 0, 0], color.shadow);
      }
    }
    const edgeLine = stations.map((x) => p(x, edge, [0, 0]));
    if (lod) beamPath(out, 'roof', edgeLine, 0.23, 0.19, color.jade);
    if (!lod) continue;
    for (const end of [x0, x1]) {
      beamPath(out, 'roof', profile.map((k) => p(end, edge, k)), 0.17, 0.19, color.tileLight);
    }
    if (lod < 2 || !detailed) continue;
    const spacing = lod === 3 ? 0.37 : 0.70;
    for (let x = x0 + spacing / 2; x < x1 - 0.16; x += spacing) {
      const run = profile.map((k) => {
        const [u, v, w] = p(x, edge, k);
        return [u, v + 0.031, w];
      });
      beamPath(out, 'roof', run, 0.075, 0.092, color.tileLight);
    }
  }
  const top = stations.map((x) => p(x, ridge, [1, 1]));
  if (lod) beamPath(out, 'roof', top, 0.25, 0.22, color.tileLight);
  return { x0, x1, y: eave + rise, z: ridge };
}

function crest(out, { x0, x1, y, z }, lod, isMain) {
  const width = x1 - x0, middle = (x0 + x1) / 2;
  const rail = isMain ? 0.56 : 0.37;
  box(out, 'wall', middle, y + 0.04, z, width * 0.89, rail, 0.29, color.oxide);
  for (const sign of [-1, 1]) {
    const u = middle + sign * width * 0.43;
    const lower = [u - sign * 0.72, y + 0.17, z];
    const outer = [u + sign * 0.15, y + rail + 0.27, z];
    const upper = [u + sign * 0.55, y + rail + 0.84, z];
    beamPath(out, 'roof', [lower, outer, upper], 0.23, 0.26, color.jade);
  }
  const figures = [3, 8, 15, 25][lod];
  const field = isMain ? width * 0.77 : width * 0.69;
  for (let i = 0; i < figures; i++) {
    const x = middle + field * ((i + 0.5) / figures - 0.5);
    const h = 0.24 + (i % 4) * 0.085 + (isMain ? 0.14 : 0);
    const tint = [color.jade, color.porcelain, color.gold, color.oxide][i % 4];
    box(out, 'roof', x, y + rail, z, 0.18 + (i % 3) * 0.05, h, 0.21, tint);
    if (lod >= 2) box(out, 'roof', x, y + rail + h - 0.035, z, 0.12, 0.11, 0.12, color.porcelain);
  }
  if (isMain) {
    box(out, 'roof', middle, y + rail, z, 0.48, 0.38, 0.39, color.jade);
    box(out, 'roof', middle, y + rail + 0.36, z, 0.25, 0.18, 0.25, color.gold);
  }
}

function frontHall(out, lod) {
  const f = s.mainHallFloor, x0 = -7.72, x1 = 7.72, z0 = s.mainHallRear, z1 = s.mainHallFront, e = s.mainEave;
  rect(out, 'stone', x0, x1, 0.12, f, z0, z1 + 0.76, color.lightStone);
  for (const [a, b] of [[x0, -2.13], [2.13, x1]]) {
    rect(out, 'wall', a, b, f, e, z1 - 0.42, z1, color.plaster);
  }
  rect(out, 'wall', -2.13, 2.13, f + 3.38, e, z1 - 0.40, z1, color.plaster);
  rect(out, 'wall', x0, x0 + 0.36, f, e, z0, z1 - 0.42, color.shadow);
  rect(out, 'wall', x1 - 0.36, x1, f, e, z0, z1 - 0.42, color.shadow);
  rect(out, 'wall', x0 + 0.36, x1 - 0.36, f, e, z0, z0 + 0.38, color.shadow);
  rect(out, 'dark', -2.13, 2.13, f, f + 3.39, z1 - 1.66, z1 - 1.59, color.dark);
  const gable = roof(out, { x0: -8.16, x1: 8.16, z0: z0 - 0.46, z1: z1 + 0.83,
    eave: e, rise: s.mainRoofRise, lift: 0.58, detailed: true }, lod);
  crest(out, gable, lod, true);
  rect(out, 'stone', -2.35, 2.35, 0.12, 0.26, z1 + 0.59, z1 + 1.09, color.paving);
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-10.99, -7.72] : [7.72, 11.05];
    rect(out, 'wall', a, b, 0.12, 4.06, z0 - 0.1, z1 + 0.02, color.plaster);
    roof(out, { x0: a - 0.08, x1: b + 0.09, z0: z0 - 0.50, z1: z1 + 0.54,
      eave: 4.06, rise: 1.55, lift: 0.19, detailed: false }, lod);
  }
  if (!lod) return;
  for (const sign of [-1, 1]) {
    box(out, 'wood', sign * 2.14, f, z1 + 0.14, 0.45, 3.70, 0.37, color.trim);
    box(out, 'wood', sign * 1.65, f + 0.21, z1 - 0.08, 0.26, 2.61, 0.05, color.wood);
    box(out, 'dark', sign * 4.83, f + 1.00, z1 + 0.027, 1.13, 1.80, 0.055, color.dark);
    box(out, 'wood', sign * 4.83, f + 2.79, z1 + 0.09, 1.32, 0.14, 0.16, color.trim);
  }
  box(out, 'wood', 0, f + 3.54, z1 + 0.10, 2.37, 0.57, 0.20, color.wood);
  box(out, 'roof', 0, f + 4.17, z1 + 0.14, 7.26, 0.20, 0.16, color.gold);
}

function courtyardGate(out, lod) {
  const y = s.forecourtFloor, z = 22.88;
  for (const sign of [-1, 1]) {
    box(out, 'stone', sign * 3.02, y, z, 0.64, 0.29, 0.61, color.lightStone);
    box(out, 'wood', sign * 3.02, y + 0.27, z, 0.36, 3.19, 0.38, color.trim);
    box(out, 'wood', sign * 3.02, 2.92, z, 0.61, 0.45, 0.64, color.oxide);
    const x = sign * 7.10;
    box(out, 'wall', x, y, s.frontLine - 0.21, 7.94, 0.59, 0.37, color.jade);
    box(out, 'roof', x, y + 1.21, s.frontLine - 0.20, 8.0, 0.12, 0.39, color.oxide);
    const posts = [4, 8, 13, 18][lod];
    for (let i = 0; i < posts; i++) {
      const u = 3.2 + (i + 0.5) * (7.75 / posts);
      box(out, 'roof', sign * u, y + 0.57, s.frontLine - 0.20, 0.14, 0.65, 0.18, color.jade);
    }
  }
  box(out, 'wood', 0, 3.18, z, 7.15, 0.36, 0.50, color.oxide);
  const cap = roof(out, { x0: -3.89, x1: 3.89, z0: 21.16, z1: 24.24,
    eave: 3.53, rise: 0.92, lift: 0.55, detailed: true }, lod);
  crest(out, cap, lod, false);
  if (lod < 2) return;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = sign * (2.65 - i * 0.38);
      beam(out, 'wood', [x, 3.06, z + 0.04], [x + sign * 0.28, 3.52, z + 0.71],
        0.15, 0.17, i % 2 ? color.gold : color.jade);
    }
    box(out, 'wood', sign * 3.03, 0.88, z + 0.21, 0.19, 1.99, 0.035, color.wood);
    const h = 2.73;
    const radii = [[h - 0.53, 0.11], [h - 0.44, 0.21], [h - 0.16, 0.24], [h, 0.12]];
    loft(out, 'wood', radii.map(([height, radius]) => radialRing(height, radius, radius, 8, [sign * 2.53, z + 0.37])), color.red);
  }
}

function rearSite(out, lod) {
  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -10.97 : 7.35, x1 = sign < 0 ? -7.35 : 11.04;
    rect(out, 'wall', x0, x1, 0.12, 4.02, -14.18, s.mainHallRear, color.shadow);
    roof(out, { x0, x1, z0: -14.22, z1: s.mainHallRear + 0.13, eave: 4.02, rise: 0.92,
      lift: 0.16, detailed: false }, lod);
  }
  rect(out, 'wall', -7.35, 7.35, 0.12, 4.55, -15.3, -6.0, color.plaster);
  roof(out, { x0: -7.63, x1: 7.63, z0: -15.55, z1: -5.60, eave: 4.55, rise: 2.10,
    lift: 0.34, detailed: false }, lod);
  const [back, front] = [s.rearRangeBack, s.rearRangeFront];
  rect(out, 'wall', -10.77, 10.87, 0.12, 7.26, back, front, color.rear);
  roof(out, { x0: -11.0, x1: 11.0, z0: back - 0.12, z1: front + 0.21, eave: 7.26,
    rise: 1.28, lift: 0.12, detailed: false }, lod);
  if (lod < 1) return;
  for (let x = -8.2; x <= 8.2; x += 4.1) {
    for (const z of [back - 0.031, front + 0.031]) {
      box(out, 'dark', x, 4.23, z, 1.49, 1.71, 0.055, color.dark);
      box(out, 'stone', x, 4.20, z, 1.63, 0.12, 0.18, color.lightStone);
    }
  }
}

function build(out, lod) {
  paving(out);
  frontHall(out, lod);
  courtyardGate(out, lod);
  rearSite(out, lod);
}

export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const recipe = 'guan-di-temple-model.mjs', camera = [28, 19, 61], lookAt = [0, 3.8, 9];
const authoredLevels = Object.fromEntries([
  ['district', 'templeDistrict', 0.43],
  ['street', 'templeStreet', 0.14],
  ['closeup', 'templeCloseup', 0.035],
].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]));
export const templeModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: templeCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Cantonese temple frontage with green glazed tile roofs, orange-red walls and an ornate gate on Jalan Tun H.S. Lee.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt, portableGroundY: -0.03,
  groundCutout: { outline, basis: 'Limit the opening to the mapped property covered by the modeled paving and hall foundations. Original composite elevation samples remain independent.' },
  buildingCutout: { outline, minimumCoverage: 0.97, basis: 'Suppress only generic buildings wholly within the named temple property.' },
  mediumFiContext: { scale: 2.15, groundY: -0.03, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'wood_plain', 'tile_glazed', 'stone_granite'],
  qaCameras: [
    { name: 'jalan-tun-hs-lee-entrance', position: [13, 7.2, 48], lookAt: [0, 4.1, 19] },
    { name: 'green-tile-and-ceramic-ridges', position: [-18, 16, 36], lookAt: [0, 6, 14] },
    { name: 'court-and-rear-ranges', position: [27, 25, -31], lookAt: [0, 2.9, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-guan-di-temple-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'templeSkyline', errorMeters: 0.82, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Property boundary © OpenStreetMap contributors, ODbL 1.0. Exact Gary Houston exterior photograph dedicated under CC0.',
};
