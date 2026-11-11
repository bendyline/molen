/** Skytsborg with its historical wooden observatory, around 1918. */
import fs from 'node:fs';
import { beam, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const [mappedOutline] = read('map-frame').geometry.polygons;
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.92, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.83, metallic: 0.09 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63, metallic: 0.03 },
};
const c = Object.fromEntries(Object.entries({
  rubble: 'c3b9aa', darkRubble: '8b8173', coping: 'c1b6a4', brick: 'a47c67',
  wood: '9e9683', woodTrim: 'b0a78f', roof: '818a8c', glass: '4b554e', iron: '555b50',
}).map(([key, hex]) => [key, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0], tau = 2 * Math.PI, north = 1.5 * Math.PI;

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0.5, 1]], tint);
}

const wrap = (a) => (a + tau) % tau;
const signedAngle = (a, center) => ((a - center + 3 * Math.PI) % tau) - Math.PI;
const outward = (angle) => [Math.cos(angle), 0, Math.sin(angle)];
function wallPoint(angle, y, inside = false, offset = 0) {
  // A single linear taper keeps the joins aligned where adjacent strips have different openings.
  const f = y / s.parapet;
  const thickness = s.baseThickness + (s.topThickness - s.baseThickness) * f;
  const radius = s.baseRadius + (s.topRadius - s.baseRadius) * f - (inside ? thickness : 0) + offset;
  return [radius * Math.cos(angle), y, radius * s.ovalRatio * Math.sin(angle)];
}

function openings(lod) {
  const doorArc = s.doorWidth / (2 * s.baseRadius);
  const spring = s.floor + s.doorSpring, rise = s.doorHeight - s.doorSpring;
  const door = { center: north, half: doorArc, bottom: s.floor, splits: [4, 6, 10, 14][lod],
    head: (a) => spring + rise * Math.sqrt(Math.max(0, 1 - Math.pow(signedAngle(a, north) / doorArc, 2))),
    entry: true };
  const ports = [];
  for (const [row, f] of s.portRows.entries()) {
    for (let i = 0; i < f.count; i++) {
      const primary = row === 3 && i === 0;
      if (!lod && !primary && (row < 2 || i % 3)) continue;
      const y = f.y - f.height / 2, center = wrap(north + f.phase + tau * i / f.count);
      const width = primary ? 0.762 : f.width;
      ports.push({ center, half: width / (2 * (s.baseRadius - 0.22)), bottom: y,
        splits: 1, head: () => y + f.height, entry: false });
    }
  }
  if (lod) {
    ports.push({ center: Math.PI / 2, half: 0.11, bottom: 3.9, splits: 1,
      head: () => 4.26, entry: false });
  }
  return [door, ...ports];
}

function angularBreaks(open, lod) {
  const count = [12, 20, 32, 48][lod], angles = [0, tau];
  for (let i = 1; i < count; i++) angles.push(tau * i / count);
  for (const o of open) {
    for (let i = 0; i <= o.splits; i++) angles.push(wrap(o.center + o.half * (2 * i / o.splits - 1)));
  }
  return angles.sort((a, b) => a - b).filter((a, i, sorted) => i === 0 || a - sorted[i - 1] > 1e-7);
}

function wallStrip(out, a, b, lo, hi, inner) {
  const direction = outward((a + b) / 2).map((v) => inner ? -v : v);
  face(out, 'rubble', [wallPoint(a, lo[0], inner), wallPoint(b, lo[1], inner),
    wallPoint(b, hi[1], inner), wallPoint(a, hi[0], inner)], direction, inner ? c.darkRubble : c.rubble);
}

function openingReveal(out, a, b, opening) {
  if (!opening.entry) {
    const y = opening.bottom;
    face(out, 'brick', [wallPoint(a, y), wallPoint(b, y), wallPoint(b, y, true), wallPoint(a, y, true)], up, c.brick);
  }
  const ya = opening.head(a), yb = opening.head(b);
  face(out, 'brick', [wallPoint(a, ya), wallPoint(b, yb), wallPoint(b, yb, true),
    wallPoint(a, ya, true)], [0, -1, 0], c.brick);
}

function masonry(out, lod) {
  const open = openings(lod), angles = angularBreaks(open, lod);
  for (let i = 1; i < angles.length; i++) {
    const a = angles[i - 1], b = angles[i], middle = (a + b) / 2;
    const holes = open.filter((o) => Math.abs(signedAngle(middle, o.center)) < o.half).sort((p, q) => p.bottom - q.bottom);
    let floor = [s.foundation, s.foundation];
    for (const hole of holes) {
      for (const inner of [false, true]) wallStrip(out, a, b, floor, [hole.bottom, hole.bottom], inner);
      openingReveal(out, a, b, hole);
      floor = [hole.head(a), hole.head(b)];
    }
    for (const inner of [false, true]) wallStrip(out, a, b, floor, [s.parapet, s.parapet], inner);
    const top = s.parapet;
    face(out, 'rubble', [wallPoint(a, top), wallPoint(b, top), wallPoint(b, top, true),
      wallPoint(a, top, true)], up, c.coping);
    face(out, 'rubble', [[0, s.floor - 0.03, 0], wallPoint(a, s.floor - 0.03, true),
      wallPoint(b, s.floor - 0.03, true)], up, c.darkRubble);
    face(out, 'wood', [[0, top - 0.11, 0], wallPoint(a, top - 0.11, true),
      wallPoint(b, top - 0.11, true)], up, c.wood);
  }
  for (const o of open) {
    for (const sign of [-1, 1]) {
      const a = o.center + o.half * sign;
      const y0 = o.bottom, y1 = o.head(a);
      const towardOpening = [sign * Math.sin(a), 0, -sign * Math.cos(a)];
      face(out, 'brick', [wallPoint(a, y0), wallPoint(a, y1), wallPoint(a, y1, true),
        wallPoint(a, y0, true)], towardOpening, c.brick);
    }
  }
  const [door] = open;
  if (lod) {
    for (const side of [-1, 1]) {
      const a = north + side * door.half, b = north + side * (door.half + 0.037);
      face(out, 'brick', [wallPoint(a, s.floor, false, 0.022), wallPoint(b, s.floor, false, 0.022),
        wallPoint(b, s.floor + s.doorSpring, false, 0.022), wallPoint(a, s.floor + s.doorSpring, false, 0.022)],
      outward(north), c.brick);
    }
  }
  for (let i = 0; i < 3; i++) {
    const depth = 0.94 - i * 0.24;
    box(out, 'rubble', 0, -0.20, -2.91 - depth / 2, 1.49, 0.2 + (i + 1) * s.floor / 3,
      depth, c.coping);
  }
  if (lod >= 2) {
    const hinge = wallPoint(north - door.half, s.floor, false, 0.07);
    const edge = [hinge[0] - 0.57, hinge[1], hinge[2] - 0.77];
    const high = s.floor + 1.67;
    face(out, 'wood', [hinge, edge, [edge[0], high, edge[2]], [hinge[0], high, hinge[2]]],
      [0, 0, -1], c.woodTrim);
    for (const y of [s.floor + 0.28, s.floor + 1.29]) {
      beam(out, 'wood', [hinge[0], y, hinge[2] - 0.035], [edge[0], y, edge[2] - 0.035], 0.09, 0.07, c.wood);
    }
  }
}

function observatory(out, lod) {
  const base = s.parapet - 0.11, top = s.observatoryTop, radius = s.observatoryRadius;
  const point = (i, y, r = radius) => {
    const a = Math.PI / 8 + i * Math.PI / 4;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  for (let i = 0; i < 8; i++) {
    const j = i + 1, a = point(i, base), b = point(j, base);
    const direction = [a[0] + b[0], 0, a[2] + b[2]];
    const at = (f, y, setback = 0) => {
      const x = a[0] + (b[0] - a[0]) * f, z = a[2] + (b[2] - a[2]) * f;
      return [x * (1 - setback), y, z * (1 - setback)];
    };
    for (const [f0, f1, y0, y1] of [[0, 1, base, base + 0.24], [0, 1, top - 0.22, top],
      [0, 0.21, base + 0.24, top - 0.22], [0.79, 1, base + 0.24, top - 0.22]]) {
      face(out, 'wood', [at(f0, y0), at(f1, y0), at(f1, y1), at(f0, y1)], direction, c.wood);
    }
    face(out, 'glass', [at(0.18, base + 0.20, 0.055), at(0.82, base + 0.20, 0.055),
      at(0.82, top - 0.18, 0.055), at(0.18, top - 0.18, 0.055)], direction, c.glass);
    if (lod) {
      for (const f of [0.21, 0.79]) {
        beam(out, 'wood', at(f, base + 0.20), at(f, top - 0.18), 0.065, 0.085, c.woodTrim);
      }
      beam(out, 'wood', at(0.19, base + 0.24), at(0.81, base + 0.24), 0.064, 0.083, c.woodTrim);
    }
    if (lod >= 2) beam(out, 'wood', at(0.5, base + 0.24, 0.022), at(0.5, top - 0.22, 0.022),
      0.045, 0.046, c.woodTrim);
    face(out, 'roof', [point(i, top, radius + 0.15), point(j, top, radius + 0.15),
      [0, s.observatoryRidge, 0]], up, c.roof);
    if (lod === 3) beam(out, 'roof', point(i, top + 0.03, radius + 0.15), [0, s.observatoryRidge + 0.03, 0],
      0.036, 0.036, c.roof);
  }
  if (lod >= 2) beam(out, 'roof', [0, s.observatoryRidge, 0], [0, s.observatoryRidge + 0.19, 0],
    0.075, 0.075, c.iron);
}

function build(out, lod) {
  masonry(out, lod);
  observatory(out, lod);
}
export const skytsborgSkyline = (out) => build(out, 0);
export const skytsborgDistrict = (out) => build(out, 1);
export const skytsborgStreet = (out) => build(out, 2);
export const skytsborgCloseup = (out) => build(out, 3);
const recipe = 'skytsborg-model.mjs', camera = [-14.5, 12.5, -20], lookAt = [0, 5.8, 0];
const authoredLevels = Object.fromEntries([
  ['district', 'skytsborgDistrict', 0.10], ['street', 'skytsborgStreet', 0.044], ['closeup', 'skytsborgCloseup', 0.019],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const skytsborgModel = {
  id: plan.model, key: plan.model, cell: plan.cell, title: plan.title, wikidataId: plan.wikidataId,
  recipe, surfaces, build: skytsborgCloseup, category: 'watchtower', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'Skytsborg, the Government Hill watchtower known as Blackbeard’s Castle, with its tapered stone shell, open north entry, gun ports and wooden observatory around 1918.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline: mappedOutline, minimumCoverage: 0.93, basis: 'Mapped Skytsborg tower envelope, OSM way 378307440. The modeled wall uses the NPS measurements.' },
  mediumFiContext: { scale: 0.73, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_limestone_weathered', 'brick_flemish', 'wood_weatherboard', 'metal_corrugated'],
  qaCameras: [
    { name: 'north-entry-and-tapered-masonry', position: [-3.5, 4.6, -15], lookAt: [0, 4.9, 0] },
    { name: 'gun-ports-and-wood-observatory', position: [12.4, 12.5, 10.9], lookAt: [0, 7.7, 0] },
    { name: 'north-arch-and-stone-steps', position: [2.5, 2.9, -8.1], lookAt: [0, 2.2, -1.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-skytsborg-watchtower-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'skytsborgSkyline', errorMeters: 0.26, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and the two exact public-domain Qualla postcards.',
};
