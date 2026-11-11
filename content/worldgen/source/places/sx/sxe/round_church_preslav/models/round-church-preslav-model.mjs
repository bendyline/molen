/** Open medieval church ruins as seen at Preslav in June 2010. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { face, triangle, transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const { section: s } = plan;
const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.96, metallic: 0 },
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.89, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.87, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone', roughness: 0.97, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.15 },
};
const c = Object.fromEntries(Object.entries({
  rubble: '8f8473', darkRubble: '807564', restored: 'd3d4c9', shade: 'c0c2b7',
  trim: 'd8d6c8', course: 'b3ad99', paving: 'a19784', dark: '4e4a3d', iron: '4d4c42',
}).map(([name, color]) => [name, rgb(color)]));

function floorAt(z) {
  const grades = s.floorGrades;
  const i = grades.findIndex(([end]) => z <= end);
  if (i <= 0) return grades[i < 0 ? grades.length - 1 : 0][1];
  const [a, ay] = grades[i - 1], [b, by] = grades[i];
  return ay + (by - ay) * (z - a) / (b - a);
}

function groundAt(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), f = u - i, g = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (1 - g) * ((1 - f) * a[i] + f * a[i + 1]) +
    g * ((1 - f) * b[i] + f * b[i + 1]) - terrain.modelDatumElevationMeters;
}

const coord = ([x, z], y) => [x, y, z];
const boxSpan = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, tint);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function directed(out, slot, vertices, normal, tint) {
  face(out, slot, dot(normalFor(...vertices), normal) > 0 ? vertices : vertices.toReversed(), tint);
}
const horizontal = [0, 1, 0];

function clipAt(ring, z, side) {
  const clipped = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const inside = side * (a[1] - z) >= 0, next = side * (b[1] - z) >= 0;
    if (inside) clipped.push(a);
    if (inside !== next) {
      const x = a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
      clipped.push([x, z]);
    }
  }
  return clipped;
}

function floor(out, lod) {
  const ring = lod === 0 ? outline.filter((_, i) => [0, 1, 6, 9, 11, 14, 15, 18, 20, 23, 26, 27, 28].includes(i)) : outline;
  for (let i = 1; i < s.floorGrades.length; i++) {
    const [a, b] = [s.floorGrades[i - 1][0], s.floorGrades[i][0]];
    const slice = clipAt(clipAt(ring, a, 1), b, -1);
    const tris = earcut(slice.flat());
    for (let j = 0; j < tris.length; j += 3) {
      const p = tris.slice(j, j + 3).map((k) => coord(slice[k], floorAt(slice[k][1])));
      triangle(out, 'paving', normalFor(...p)[1] > 0 ? p : p.toReversed(), c.paving);
    }
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const upper = (p) => coord(p, floorAt(p[1]));
    const lower = (p) => coord(p, Math.min(floorAt(p[1]) - 0.12, groundAt(...p) - 0.15));
    directed(out, 'rubble', [lower(a), lower(b), upper(b), upper(a)], [b[1] - a[1], 0, a[0] - b[0]], c.darkRubble);
  }
}

/** Closed stone wall strip with one shared cap per segment. */
function strip(out, inside, outside, y0, y1, slot, tint) {
  const ringAt = (a, b, y) => [coord(a, y(a)), coord(b, y(b))];
  for (let i = 1; i < inside.length; i++) {
    const [a, b] = inside.slice(i - 1, i + 1), [d, e] = outside.slice(i - 1, i + 1);
    const inward = [a[0] - d[0], 0, a[1] - d[1]], outward = inward.map((n) => -n);
    const [a0, b0] = ringAt(a, b, y0), [a1, b1] = ringAt(a, b, y1);
    const [d0, e0] = ringAt(d, e, y0), [d1, e1] = ringAt(d, e, y1);
    directed(out, slot, [a0, b0, b1, a1], inward, tint);
    directed(out, slot, [d0, e0, e1, d1], outward, tint);
    directed(out, slot, [a1, b1, e1, d1], horizontal, tint);
  }
  for (const i of [0, inside.length - 1]) {
    const a = inside[i], b = outside[i], next = inside[i === 0 ? 1 : i - 1];
    directed(out, slot, [coord(a, y0(a)), coord(b, y0(b)), coord(b, y1(b)), coord(a, y1(a))],
      [a[0] - next[0], 0, a[1] - next[1]], tint);
  }
}

function lowWall(out, inside, outside, height, lod, tint = c.restored) {
  const base = (p) => floorAt(p[1]) - 0.045;
  const top = (p) => floorAt(p[1]) + height;
  if (!lod) {
    strip(out, inside, outside, base, top, 'lime', tint);
    return;
  }
  const seam = (p) => floorAt(p[1]) + Math.min(0.48, height * 0.55);
  strip(out, inside, outside, base, seam, 'rubble', c.rubble);
  strip(out, inside, outside, seam, top, 'lime', tint);
}

function arch(out, { half, spring, rise = half, depth, top, segments, trim = 0.25 }) {
  const p = (angle, z, outer) => [
    Math.cos(angle) * (half + (outer && top === undefined ? trim : 0)),
    outer ? (top ?? spring + Math.sin(angle) * (rise + trim)) : spring + Math.sin(angle) * rise,
    z,
  ];
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI / segments, b = (i + 1) * Math.PI / segments;
    for (const z of [-depth / 2, depth / 2]) {
      directed(out, 'trim', [p(a, z, false), p(b, z, false), p(b, z, true), p(a, z, true)],
        [0, 0, Math.sign(z)], c.trim);
    }
    const m = (a + b) / 2;
    const outward = [Math.cos(m), Math.sin(m), 0];
    for (const outer of [true, false]) {
      directed(out, 'trim', [p(a, -depth / 2, outer), p(b, -depth / 2, outer),
        p(b, depth / 2, outer), p(a, depth / 2, outer)],
        top !== undefined && outer ? horizontal : outward.map((v) => outer ? v : -v), c.trim);
    }
  }
}

function pier(out, x0, x1, z, depth, base, top, lod) {
  if (!lod) {
    boxSpan(out, 'lime', x0, x1, base, top, z - depth / 2, z + depth / 2, c.restored);
    return;
  }
  const seam = Math.min(base + 0.79, (base + top) / 2);
  boxSpan(out, 'rubble', x0, x1, base, seam, z - depth / 2, z + depth / 2, c.rubble);
  boxSpan(out, 'lime', x0, x1, seam, top, z - depth / 2, z + depth / 2, c.restored);
}

function portal(out, x, z, width, outer, depth, lod, height) {
  const base = floorAt(z), half = width / 2, top = base + height;
  const spring = top - half - 0.32;
  pier(out, x - outer / 2, x - half, z, depth, base - 0.07, top - 0.11, lod);
  pier(out, x + half, x + outer / 2, z, depth, base - 0.07, top - 0.11, lod);
  arch(transform(out, 0, [x, 0, z]), { half, spring, depth, top, segments: [4, 6, 9, 12][lod] });
}

function column(out, x, z, top, lod) {
  const base = floorAt(z);
  if (lod === 0) {
    boxSpan(out, 'trim', x - 0.21, x + 0.21, base, top, z - 0.21, z + 0.21, c.trim);
    return;
  }
  const sides = lod === 1 ? 6 : 10;
  const profile = [[base, 0.34], [base + 0.13, 0.34], [base + 0.24, 0.22],
    [top - 0.20, 0.19], [top - 0.10, 0.29], [top, 0.31]];
  loft(out, 'trim', profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z])), c.trim);
}

function drum(out, x, z, radius, height, lod) {
  const base = floorAt(z), n = lod === 0 ? 6 : lod === 1 ? 8 : 12;
  loft(out, 'rubble', [radialRing(base - 0.20, radius, radius, n, [x, z]),
    radialRing(base + height * 0.53, radius, radius, n, [x, z])], c.rubble);
  loft(out, 'lime', [radialRing(base + height * 0.53, radius, radius, n, [x, z]),
    radialRing(base + height, radius - 0.04, radius - 0.04, n, [x, z])], c.restored);
}

function courtyard(out, lod) {
  portal(out, 0, s.westGate, 2.24, 3.68, 0.84, lod, 3.39);
  for (const sign of [-1, 1]) {
    const a = sign < 0 ? -8.17 : 1.84, b = sign < 0 ? -1.84 : 8.17;
    pier(out, a, b, 10.22, 0.93, floorAt(10.22) - 0.14, floorAt(10.22) + 1.10, lod);
    const insideX = sign * 6.64, outsideX = sign * 8.14;
    if (!lod) {
      lowWall(out, [[insideX, 10.5], [insideX, s.atriumEast]], [[outsideX, 10.5], [outsideX, s.atriumEast]], 1.05, lod);
    } else {
      lowWall(out, [[insideX, 10.40], [insideX, 9.30]],
        [[outsideX, 10.40], [outsideX, 9.30]], 1.05, lod);
      for (let i = 0; i < 7; i++) {
        const centerZ = 9.3 - (i + 0.5) * 1.80;
        const count = lod >= 2 ? 5 : 3;
        const inner = Array.from({ length: count + 1 }, (_, j) => {
          const a = j * Math.PI / count;
          return [insideX + sign * Math.sin(a) * 0.60, centerZ + 0.90 * Math.cos(a)];
        });
        lowWall(out, inner, inner.map((p) => [outsideX, p[1]]), 0.95 + (i % 3) * 0.10, lod);
        if (lod >= 2) drum(out, sign * 5.92, centerZ, 0.29, 0.22, 1);
      }
    }
  }
  const z = 3.35, y = floorAt(z), n = [8, 12, 16, 20][lod];
  const points = (r, h, a) => [Math.cos(a) * r, h, z + Math.sin(a) * r];
  for (let i = 0; i < n; i++) {
    const a = i * Math.PI * 2 / n, b = (i + 1) * Math.PI * 2 / n;
    const outward = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
    directed(out, 'rubble', [points(0.59, y, a), points(0.59, y, b),
      points(0.59, y + 0.58, b), points(0.59, y + 0.58, a)], outward, c.darkRubble);
    directed(out, 'trim', [points(0.59, y + 0.58, a), points(0.59, y + 0.58, b),
      points(0.37, y + 0.58, b), points(0.37, y + 0.58, a)], horizontal, c.course);
    directed(out, 'rubble', [points(0.37, y + 0.14, a), points(0.37, y + 0.14, b),
      points(0.37, y + 0.58, b), points(0.37, y + 0.58, a)], outward.map((v) => -v), c.dark);
  }
}

function narthex(out, lod) {
  const west = s.atriumEast, east = s.narthexEast;
  portal(out, 0, west, 2.19, 4.20, 0.88, lod, 3.48);
  for (const sign of [-1, 1]) {
    const [a, b] = sign < 0 ? [-6.49, -2.10] : [2.10, 6.49];
    pier(out, a, b, west, 0.89, floorAt(west) - 0.07, floorAt(west) + 2.29, lod);
    const x = sign * 5.93;
    drum(out, x, -5.60, 1.60, 0.93, lod);
    lowWall(out, [[sign * 6.84, -4.7], [sign * 6.84, -10.83]],
      [[sign * 8.23, -4.7], [sign * 8.23, -10.83]], 1.16, lod);
  }
  portal(out, 0, east, 2.17, 2.92, 0.97, lod, 3.23);
  for (const sign of [-1, 1]) {
    portal(out, sign * 2.79, east, 1.47, 2.64, 0.89, lod, 2.71);
    const [a, b] = sign < 0 ? [-7.62, -4.11] : [4.11, 7.62];
    pier(out, a, b, east, 0.88, floorAt(east) - 0.11, floorAt(east) + 2.12, lod);
    lowWall(out, [[sign * 4.3, east - 0.16], [sign * 3.67, -12.91]],
      [[sign * 5.53, east - 0.16], [sign * 4.86, -11.78]], 1.10, lod);
  }
}

function rotunda(out, lod) {
  const [cx, cz] = s.naosCenter;
  const north = (angle, r) => [cx + Math.sin(angle) * r, cz + Math.cos(angle) * r];
  const start = Math.PI / 4, end = Math.PI * 1.75, sector = Math.PI / 6;
  if (!lod) {
    const angles = Array.from({ length: 14 }, (_, i) => start + (end - start) * i / 13);
    const westAndSouth = angles.filter((a) => a < Math.PI - 0.18);
    const eastAndNorth = angles.filter((a) => a > Math.PI + 0.18);
    for (const arc of [westAndSouth, eastAndNorth]) {
      lowWall(out, arc.map((a) => north(a, 5.25)), arc.map((a) => north(a, 7.22)), 1.12, lod);
    }
  } else {
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const n = lod === 1 ? 3 : lod === 2 ? 5 : 7;
      const angles = Array.from({ length: n + 1 }, (_, j) => start + (i + j / n) * sector);
      const inside = angles.map((a, j) => north(a, s.naosDiameter / 2 + 1.09 * Math.sin(j * Math.PI / n)));
      const outside = angles.map((a, j) => north(a, 6.99 + 0.37 * Math.sin(j * Math.PI / n)));
      lowWall(out, inside, outside, 1.03 + (i % 3) * 0.12, lod, i % 2 ? c.shade : c.restored);
    }
  }
  const apseZ = -22.24, n = [5, 8, 12, 16][lod];
  const arc = Array.from({ length: n + 1 }, (_, i) => i * Math.PI / n);
  const apse = (r, depth) => arc.map((a) => [0.36 + r * Math.cos(a), apseZ - depth * Math.sin(a)]);
  lowWall(out, apse(1.70, 3.17), apse(2.53, 4.02), 1.37, lod);
  for (const sign of [-1, 1]) {
    lowWall(out, [[0.36 + sign * 1.70, apseZ], [0.36 + sign * 1.70, apseZ + 0.56]],
      [[0.36 + sign * 2.53, apseZ], [0.36 + sign * 2.53, apseZ + 0.56]], 1.37, lod);
  }
  drum(out, cx, cz, 0.54, 0.35, lod);

  const angles = [-2.38, -1.87, -1.36, -0.85, -0.34, 0.17];
  const columns = angles.map((angle) => north(angle, 4.78));
  const spring = floorAt(cz) + 2.43;
  for (const [x, z] of columns) column(out, x, z, spring, lod);
  for (let i = 1; i < columns.length; i++) {
    const a = columns[i - 1], b = columns[i];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2;
    const half = Math.hypot(dx, dz) / 2 - 0.19;
    const archSpace = transform(out, -Math.atan2(dz, dx), [x, 0, z]);
    arch(archSpace, { half, spring, rise: half * 0.88, depth: 0.35, segments: [3, 5, 8, 11][lod], trim: 0.25 });
    if (lod >= 2) beam(out, 'metal', [a[0], spring - 0.07, a[1]], [b[0], spring - 0.07, b[1]],
      0.025, 0.026, c.iron);
  }
  if (lod >= 1) {
    for (const angle of [0.70, 1.22, 1.73, 2.24, 2.75]) {
      const [x, z] = north(angle, 4.78);
      drum(out, x, z, 0.33, 0.27, lod);
    }
  }
}

function build(out, lod) {
  floor(out, lod);
  courtyard(out, lod);
  narthex(out, lod);
  rotunda(out, lod);
}

export const churchSkyline = (out) => build(out, 0);
export const churchDistrict = (out) => build(out, 1);
export const churchStreet = (out) => build(out, 2);
export const churchCloseup = (out) => build(out, 3);
const recipe = 'round-church-preslav-model.mjs', camera = [25, 27, 45], lookAt = [0, -0.9, -6.9];
const authoredLevels = Object.fromEntries([
  ['district', 'churchDistrict', 0.44],
  ['street', 'churchStreet', 0.14],
  ['closeup', 'churchCloseup', 0.040],
].map(([name, entry, errorMeters]) => [name, { export: entry, errorMeters, surfaces }]));

export const churchModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: churchCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization', progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The roofless Round Church at Preslav, with an open well court, surviving arches and white-capped scalloped sanctuary.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom,
    validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  groundCutout: {
    outline,
    basis: 'The mapped ruin contains the modeled descending paved surface. Open only this area where viewer terrain would cover the court and naos floors.',
  },
  buildingCutout: { outline, minimumCoverage: 0.93, basis: 'Named native archaeological church outline, OpenStreetMap way 486119025.' },
  mediumFiContext: { scale: 2.6, groundY: 0.0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['stone_drywall', 'plaster_lime', 'stone_limestone_raw', 'stone', 'metal_painted'],
  qaCameras: [
    { name: 'west-entry-well-and-narthex', position: [1.9, 8.8, 25], lookAt: [0, -0.15, 0.3] },
    { name: 'sanctuary-niches-and-standing-arcade', position: [-17, 9.4, -28], lookAt: [0, -1.95, -14.3] },
    { name: 'open-ruin-and-altar-apse', position: [26, 19, -30], lookAt: [0, -1.32, -9.0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-round-church-preslav-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'churchSkyline', errorMeters: 0.83, surfaces, authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. OpenStreetMap footprint is ODbL. The seven matching Qualla photographs are public domain or CC0.',
};
