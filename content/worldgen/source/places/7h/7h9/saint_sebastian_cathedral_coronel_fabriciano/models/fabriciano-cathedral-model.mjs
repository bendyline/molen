/** The folded concrete and glass co-cathedral in Santa Helena as it stood in June 2010. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam, beamPath, normalFor,
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
  wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.81, metallic: 0.18 },
  stone: { slot: 'trim', graph: 'concrete_plain', roughness: 0.90, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.27 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0.14 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'b3a27b', wallDark: 'a2957d', cement: 'b4aa98', plinth: '958874',
  roof: 'b9b1a3', roofAlt: 'b0a99c', seam: 'c8bdac', bronze: '9e6f44',
  glass: '3f4846', darkGlass: '373a36', glassLight: '69706c', grille: 'b9b9ac',
  shade: '494139', copper: '72503d', stain: '948468',
}).map(([name, hex]) => [name, rgb(hex)]));
const up = [0, 1, 0], forward = [0, 0, 1], white = 'palette:#ffffff';

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], color);
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const a = terrain.heightsMeters[j], b = terrain.heightsMeters[j + 1];
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

const footing = (x, z) => Math.min(s.floor - 0.55, ground(x, z) - 0.32);
const panel = (out, slot, a, b, low, high, z, tint) =>
  face(out, slot, [[a, low, z], [b, low, z], [b, high, z], [a, high, z]], forward, tint);

function planar(out, slot, polygon, holes, z, tint) {
  const xy = [...polygon, ...holes.flat()];
  let next = polygon.length;
  const indices = earcut(xy.flat(), holes.map((ring) => {
    const start = next;
    next += ring.length;
    return start;
  }));
  for (let i = 0; i < indices.length; i += 3) {
    face(out, slot, indices.slice(i, i + 3).map((index) => [...xy[index], z]), forward, tint);
  }
}

function lattice(out, bottom, top, width, z, triangular, lod) {
  const x = s.center;
  const span = (y) => width / 2 * (triangular ? Math.max(0, 1 - (y - bottom) / (top - bottom)) : 1);
  const glazing = triangular ?
    [[x - width / 2, bottom], [x + width / 2, bottom], [x, top]] :
    [[x - width / 2, bottom], [x + width / 2, bottom], [x + width / 2, top], [x - width / 2, top]];
  planar(out, 'glass', glazing, [], z - 0.18, c.glass);
  if (!lod) return glazing;
  const edge = glazing.map(([u, y]) => [u, y, z + 0.022]);
  beamPath(out, 'metal', edge, 0.12, 0.088, c.grille, true);
  const columns = triangular ? [0, 4, 6, 8][lod] : [0, 2, 3, 4][lod];
  const rows = triangular ? [0, 2, 4, 5][lod] : [0, 3, 5, 7][lod];
  for (let i = 1; i < columns; i++) {
    const u = x + width * (i / columns - 0.5);
    const y = top - (triangular ? 2 * Math.abs(u - x) / width * (top - bottom) : 0);
    beam(out, 'metal', [u, bottom, z + 0.026], [u, y, z + 0.026], 0.052, 0.056, c.grille);
  }
  for (let i = 1; i < rows; i++) {
    const y = bottom + (top - bottom) * i / rows;
    const half = span(y);
    beam(out, 'metal', [x - half, y, z + 0.024], [x + half, y, z + 0.024], 0.045, 0.048, c.grille);
  }
  if (lod >= 2) {
    for (let row = 0; row < rows; row++) {
      const a = bottom + (top - bottom) * row / rows;
      const b = bottom + (top - bottom) * (row + 1) / rows;
      const count = triangular ? Math.max(1, Math.ceil(columns * (1 - row / rows))) : columns;
      const lo = span(a), hi = span(b);
      for (let i = 0; i < count; i++) {
        const p = 2 * i / count - 1, q = 2 * (i + 1) / count - 1;
        beam(out, 'metal', [x + p * lo, a, z + 0.025], [x + q * hi, b, z + 0.025], 0.027, 0.037, c.grille);
        beam(out, 'metal', [x + q * lo, a, z + 0.024], [x + p * hi, b, z + 0.024], 0.027, 0.037, c.grille);
      }
    }
  }
  return glazing;
}

function front(out, lod) {
  const { floor, center, left, right, frontZ: z, eave, gableTop, upperGlass, lowerGlass } = s;
  const topGlass = lattice(out, upperGlass.bottom, upperGlass.top, upperGlass.width, z, true, lod);
  const lowGlass = lattice(out, lowerGlass.bottom, lowerGlass.top, lowerGlass.width, z, false, lod);
  const gable = [[left, eave], [right, eave], [center, gableTop]];
  planar(out, 'wall', gable, [topGlass, lowGlass], z, c.wall);
  const [entryLeft, entryRight] = [center - 2.32, center + 2.58];
  panel(out, 'wall', left, entryLeft, floor, eave, z, c.wall);
  panel(out, 'wall', entryRight, right, floor, eave, z, c.wall);
  panel(out, 'glass', entryLeft, entryRight, floor, eave, z - 0.81, c.darkGlass);
  for (const [x, n] of [[entryLeft, 1], [entryRight, -1]]) {
    face(out, 'wall', [[x, floor, z], [x, eave, z], [x, eave, z - 0.81], [x, floor, z - 0.81]],
      [n, 0, 0], c.shade);
  }
  face(out, 'stone', [[left, footing(left, z), z], [right, footing(right, z), z],
    [right, floor, z], [left, floor, z]], forward, c.plinth);
  beamPath(out, 'roof', [[left - 0.14, eave, z + 0.14], [center, gableTop + 0.06, z + 0.14],
    [right + 0.14, eave, z + 0.14]], 0.25, 0.28, c.shade);
  if (!lod) return;
  beamPath(out, 'metal', [[left + 0.10, eave - 0.08, z + 0.161], [center, gableTop - 0.30, z + 0.161],
    [right - 0.10, eave - 0.08, z + 0.161]], 0.19, 0.22, c.bronze);
  for (const x of [entryLeft + 0.08, center + 0.20, entryRight - 0.08]) {
    box(out, 'metal', x, floor, z - 0.71, 0.075, eave - floor, 0.092, c.copper);
  }
  if (lod < 2) return;
  for (const [a, b, y, h] of [
    [-6.25, -5.31, 6.20, 0.24], [-5.82, -5.20, 7.12, 0.20], [-5.44, -4.84, 7.62, 0.18],
    [-5.61, -4.92, 8.24, 0.17], [-5.74, -5.16, 8.95, 0.22], [-4.88, -4.19, 6.45, 0.15],
    [3.68, 4.91, 6.80, 0.18], [4.22, 4.84, 7.45, 0.21], [4.38, 5.04, 8.15, 0.16],
    [4.94, 5.61, 8.62, 0.24], [4.29, 5.17, 9.09, 0.13], [3.84, 4.39, 9.60, 0.14],
  ]) panel(out, 'wall', a, b, y, y + h, z + 0.008, c.stain);
}

function nave(out, lod) {
  const { left, right, center, eave, gableTop, sidePeak, sideBays } = s;
  const sections = [[s.frontZ, eave, gableTop]];
  for (const [, peak, end] of sideBays) {
    sections.push([peak, sidePeak, gableTop - 1.14]);
    sections.push([end, eave, gableTop - 0.95]);
  }
  const sideX = (x, z) => x + (z - s.frontZ) / (s.rearZ - s.frontZ) * (x < center ? -0.65 : 0.72);
  for (const [x, sign] of [[left, -1], [right, 1]]) {
    const normal = [sign, 0, 0];
    const at = (z, y) => [sideX(x, z), y, z];
    for (let i = 1; i < sections.length; i++) {
      const [a, sideA, topA] = sections[i - 1], [b, sideB, topB] = sections[i];
      face(out, 'wall', [at(a, footing(sideX(x, a), a)), at(b, footing(sideX(x, b), b)),
        at(b, sideB), at(a, sideA)], normal, i % 2 ? c.cement : c.wallDark);
      const leftRoof = at(a, sideA), rightRoof = at(b, sideB);
      const crestA = [center, topA, a], crestB = [center, topB, b];
      face(out, 'roof', [leftRoof, rightRoof, crestB], up, c.roof);
      face(out, 'roof', [leftRoof, crestB, crestA], up, i % 2 ? c.roofAlt : c.roof);
      if (lod >= 2) {
        beam(out, 'metal', leftRoof, rightRoof, 0.095, 0.12, c.bronze);
        const count = lod === 3 ? 9 : 4;
        for (let j = 1; j <= count; j++) {
          const f = j / (count + 1);
          const mix = (a, b) => a.map((v, k) => v + (b[k] - v) * f);
          const inner = mix(crestA, crestB), outer = mix(leftRoof, rightRoof), fold = mix(leftRoof, crestB);
          const raised = ([x, y, z]) => [x, y + 0.022, z];
          beamPath(out, 'roof', [raised(outer), raised(fold), raised(inner)], 0.042, 0.046, c.seam);
        }
      }
      if (lod && i % 2 === 0) {
        const z = (a + b) / 2, u = sideX(x, z) + sign * 0.025;
        face(out, 'glass', [[u, 2.38, z + 0.81], [u, 2.38, z - 0.81], [u, 5.72, z - 0.81],
          [u, 5.72, z + 0.81]], normal, c.glassLight);
      }
    }
  }
  const z = s.rearZ, a = sideX(left, z), b = sideX(right, z), normal = [0, 0, -1];
  face(out, 'wall', [[a, footing(a, z), z], [b, footing(b, z), z], [b, eave, z], [a, eave, z]], normal, c.wallDark);
  face(out, 'wall', [[a, eave, z], [b, eave, z], [center, gableTop - 0.95, z]], normal, c.cement);
  if (lod) {
    const k = z - 0.025;
    face(out, 'glass', [[center - 2.45, 10.67, k], [center + 2.45, 10.67, k],
      [center, gableTop - 1.55, k]], normal, c.glassLight);
  }
}

function approach(out, lod) {
  const { centerX, frontZ, width, top } = s.canopy;
  const depth = frontZ - s.frontZ + 0.13, z = (frontZ + s.frontZ) / 2;
  box(out, 'roof', centerX, top - 0.26, z, width, 0.24, depth, c.copper);
  box(out, 'metal', centerX, top - 0.20, frontZ, width + 0.09, 0.27, 0.22, c.bronze);
  const stepY = Math.min(s.floor - 0.13, ground(centerX, frontZ) + 0.22);
  box(out, 'stone', centerX, stepY - 0.15, z, width + 0.21, 0.20, depth + 0.30, c.cement);
  if (!lod) return;
  for (const x of [centerX - 2.48, centerX + 2.48]) {
    beam(out, 'metal', [x, top - 0.25, frontZ - 0.34], [x, top - 1.08, s.frontZ - 0.02], 0.13, 0.16, c.copper);
  }
  beam(out, 'metal', [centerX, 4.0, frontZ - 0.91], [centerX, 4.98, frontZ - 0.91], 0.075, 0.083, c.copper);
  beam(out, 'metal', [centerX - 0.32, 4.67, frontZ - 0.91], [centerX + 0.32, 4.67, frontZ - 0.91], 0.071, 0.075, c.copper);
  if (lod >= 2) {
    for (let i = 1; i <= 11; i++) {
      const x = centerX + width * (i / 12 - 0.5);
      beam(out, 'roof', [x, top + 0.002, s.frontZ], [x, top + 0.002, frontZ], 0.04, 0.05, c.bronze);
    }
  }
}

function build(out, lod) {
  nave(out, lod);
  front(out, lod);
  approach(out, lod);
}

export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);

const recipe = 'fabriciano-cathedral-model.mjs';
const camera = [41, 28, 75], lookAt = [0, 7.5, -1.0];
const authoredLevels = Object.fromEntries([
  ['district', 'cathedralDistrict', 0.29], ['street', 'cathedralStreet', 0.13], ['closeup', 'cathedralCloseup', 0.039],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const cathedralModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: cathedralCloseup, category: 'cathedral', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The 2010 Saint Sebastian Co-Cathedral in Coronel Fabriciano with its folded tent-like roof, ochre gable, geometric glass framing and covered entry.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.92, basis: 'Named cathedral outline from OpenStreetMap way 255920710.' },
  mediumFiContext: { scale: 0.83, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'metal_standing_seam', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'rua-sao-sebastiao-glazed-gable', position: [0, 5.2, 55], lookAt: [-0.4, 8.5, 15.7] },
    { name: 'three-folded-side-bays', position: [52, 22, 28], lookAt: [1.6, 7.4, -3.8] },
    { name: 'rear-and-folded-nave-roof', position: [-43, 29, -56], lookAt: [-0.6, 7.7, -10.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-fabriciano-cathedral-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'cathedralSkyline', errorMeters: 0.76, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party public-domain Qualla photo.',
};
