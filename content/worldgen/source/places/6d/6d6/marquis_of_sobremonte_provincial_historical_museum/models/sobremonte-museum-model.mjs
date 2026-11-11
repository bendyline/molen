/** The whitewashed Córdoba house and museum, represented in January 2009. */
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
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  clay: { slot: 'roof', graph: 'clay_fired', roughness: 0.92, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.13 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
};
const c = Object.fromEntries(Object.entries({
  lime: 'd6d3c8', yard: 'cbc5b3', base: 'aaa395', stone: 'b3ad9f', trim: 'c8c4b8',
  white: 'd9d5c8', clay: '976b51', eave: '8d614c', tile: 'a37458',
  timber: '67564a', door: '56504a', dark: '393b36', iron: '4c4b43',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0];
const p3 = ([x, z], y) => [x, y, z];

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], tint);
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const a = terrain.heightsMeters[j], b = terrain.heightsMeters[j + 1];
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

const foundation = (p) => Math.min(s.floor - 0.42, ground(p) - 0.31);

function plane(a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const tangent = [dx / length, dz / length], normal = [tangent[1], 0, -tangent[0]];
  const at = (u, y, offset = 0) => [
    a[0] + u * tangent[0] + offset * normal[0], y,
    a[1] + u * tangent[1] + offset * normal[2],
  ];
  return { a, b, length, normal, at };
}

function rect(out, wall, slot, left, right, bottom, top, color, offset = 0) {
  if (right - left < 0.001 || top - bottom < 0.001) return;
  const { at, normal } = wall;
  face(out, slot, [at(left, bottom, offset), at(right, bottom, offset), at(right, top, offset), at(left, top, offset)],
    normal, color);
}

function planar(out, slot, ring, holes, to3d, normal, tint) {
  const xy = [...ring, ...holes.flat()];
  let next = ring.length;
  const indices = earcut(xy.flat(), holes.map((hole) => {
    const offset = next;
    next += hole.length;
    return offset;
  }));
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => xy[index]);
    const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(area) < 1e-8) continue;
    face(out, slot, [a, b, c].map(to3d), normal, tint);
  }
}

function archOpening(u, width, bottom, top, rise, lod) {
  const n = lod >= 2 ? 8 : 4, left = u - width / 2, right = u + width / 2;
  const arc = Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI * i / n;
    return [u - width / 2 * Math.cos(t), top - rise + rise * Math.sin(t)];
  });
  return [[left, bottom], ...arc, [right, bottom]];
}

const rectangle = (u, width, bottom, top) => [
  [u - width / 2, bottom], [u - width / 2, top], [u + width / 2, top], [u + width / 2, bottom],
];

function wallBody(out, wall, eave, openings, tint) {
  const { a, b, at, length, normal } = wall;
  const ring = [[0, foundation(a)], [length, foundation(b)], [length, eave], [0, eave]];
  planar(out, 'lime', ring, openings, ([u, y]) => at(u, y), normal, tint);
  rect(out, wall, 'lime', 0, length, Math.min(foundation(a), foundation(b)), s.floor + 0.10, c.base, 0.012);
}

function closeOpening(out, wall, ring, depth, slot, color, lod) {
  const { at, normal } = wall;
  planar(out, slot, ring, [], ([u, y]) => at(u, y, -depth), normal, color);
  if (lod < 2) return;
  for (let i = 0; i < ring.length; i++) {
    const [a, y] = ring[i], [b, h] = ring[(i + 1) % ring.length];
    const points = [at(a, y), at(b, h), at(b, h, -depth), at(a, y, -depth)];
    face(out, 'stone', points, normalFor(...points), c.stone);
  }
}

function window(out, wall, w, lod) {
  const { u, width, bottom, top, arch, balcony } = w;
  const ring = arch ? archOpening(u, width, bottom, top, 0.24, lod) : rectangle(u, width, bottom, top);
  closeOpening(out, wall, ring, 0.27, 'shade', c.dark, lod);
  if (!lod) return;
  const { at } = wall, left = u - width / 2, right = u + width / 2;
  beam(out, 'stone', at(left - 0.09, bottom - 0.06, 0.065), at(right + 0.09, bottom - 0.06, 0.065),
    0.11, 0.16, c.trim);
  const step = lod >= 2 ? 7 : 3;
  for (let i = 1; i < step; i++) {
    const f = i / step, x = left + f * width;
    const y = arch ? top - 0.24 + 0.24 * Math.sin(Math.PI * f) : top;
    beam(out, 'iron', at(x, bottom, 0.038), at(x, y, 0.038), 0.035, 0.036, c.iron);
  }
  for (const y of [bottom + 0.16, (bottom + top) / 2]) {
    beam(out, 'iron', at(left, y, 0.042), at(right, y, 0.042), 0.032, 0.042, c.iron);
  }
  if (!balcony || lod < 2) return;
  beam(out, 'stone', at(left - 0.15, bottom - 0.12, 0.16), at(right + 0.15, bottom - 0.12, 0.16),
    0.19, 0.37, c.trim);
  const y = bottom + 0.63;
  beam(out, 'iron', at(left - 0.055, y, 0.31), at(right + 0.055, y, 0.31), 0.047, 0.051, c.iron);
  for (let i = 0; i <= 7; i++) {
    const x = left + width * i / 7;
    beam(out, 'iron', at(x, bottom - 0.035, 0.31), at(x, y, 0.31), 0.028, 0.036, c.iron);
  }
}

function portal(out, wall, u, floor, lod) {
  const { width, top } = s.portal;
  const left = u - width / 2, right = u + width / 2;
  const ring = rectangle(u, width, floor, top - 0.39);
  closeOpening(out, wall, ring, 0.49, 'timber', c.door, lod);
  const { at } = wall;
  const lintel = (y, high, n, tint) =>
    beam(out, 'stone', at(left - n, y, 0.16), at(right + n, y, 0.16), high, 0.59, tint);
  lintel(top - 0.39, 0.48, 0.31, c.stone);
  lintel(top + 0.13, 0.19, 0.47, c.trim);
  if (!lod) return ring;
  for (const x of [left - 0.13, right + 0.13]) {
    const [a, , b] = at(x, floor, 0.17), sides = lod >= 2 ? 10 : 6;
    const rings = [[floor - 0.09, 0.28], [floor + 0.24, 0.29], [floor + 0.40, 0.18],
      [top - 1.01, 0.13], [top - 0.80, 0.21], [top - 0.53, 0.27]];
    loft(out, 'stone', rings.map(([y, r]) => radialRing(y, r, r * 0.94, sides, [a, b])), c.trim);
  }
  beam(out, 'stone', at(left - 0.23, floor - 0.08, 0.28), at(right + 0.23, floor - 0.08, 0.28),
    0.17, 0.60, c.stone);
  if (lod < 2) return ring;
  for (const x of [left + 0.10, u, right - 0.10]) {
    beam(out, 'timber', at(x, floor + 0.19, -0.44), at(x, top - 0.48, -0.44),
      0.075, 0.087, c.timber);
  }
  for (const y of [floor + 0.54, 2.11, 3.12]) {
    beam(out, 'timber', at(left + 0.13, y, -0.435), at(right - 0.13, y, -0.435),
      0.062, 0.082, c.timber);
  }
  return ring;
}

function streetFront(out, wall, eave, lod) {
  const [xStart] = wall.a;
  const position = (x) => xStart - x;
  const doorU = position(s.portal.x);
  const floor = Math.max(s.floor, ground([s.portal.x, s.portal.z]) + 0.09);
  const door = portal(out, wall, doorU, floor, lod);
  const openings = [];
  if (lod) {
    const lower = [-18.32, -12.59, -6.84, -0.72, 3.94, 12.62, 16.41];
    for (const x of lower) {
      const bottom = Math.max(0.97, ground([x, s.portal.z]) + 0.42);
      openings.push({ u: position(x), width: 1.19, bottom, top: bottom + 1.72, arch: true });
    }
    for (const x of [-17.71, -11.02, -4.31, 2.09, s.portal.x, 13.44]) {
      openings.push({ u: position(x), width: 1.19, bottom: 5.12, top: 7.16, balcony: true });
    }
  }
  const holes = openings.map((w) => w.arch ? archOpening(w.u, w.width, w.bottom, w.top, 0.24, lod) :
    rectangle(w.u, w.width, w.bottom, w.top));
  wallBody(out, wall, eave, [door, ...holes], c.lime);
  for (const w of openings) window(out, wall, w, lod);
}

function innerWall(out, wall, eave, lod, gallery) {
  const openings = [];
  if (lod && wall.length > 4) {
    const count = Math.max(1, Math.round(wall.length / (gallery ? 4.34 : 5.35)));
    for (let i = 0; i < count; i++) {
      const u = wall.length * (i + 0.5) / count;
      const low = gallery ? s.floor + 0.10 : 0.97;
      const top = Math.min(eave - 0.49, gallery ? 3.68 : 2.70);
      const width = gallery ? 1.92 : 1.15;
      openings.push({ u, width, bottom: low, top, arch: gallery });
    }
  }
  const holes = openings.map((w) => w.arch ? archOpening(w.u, w.width, w.bottom, w.top, 0.54, lod) :
    rectangle(w.u, w.width, w.bottom, w.top));
  wallBody(out, wall, eave, holes, c.yard);
  for (const hole of holes) closeOpening(out, wall, hole, 0.42, 'shade', c.dark, lod);
}

function roof(out, [x, u, z, v], eave, rise, lod, principal) {
  const a = [x - 0.17, eave, z - 0.17], b = [u + 0.17, eave, z - 0.17];
  const d = [u + 0.17, eave, v + 0.17], e = [x - 0.17, eave, v + 0.17];
  const width = u - x, depth = v - z;
  const [r, t] = width > depth ?
    [[x + depth * 0.30, eave + rise, (z + v) / 2], [u - depth * 0.30, eave + rise, (z + v) / 2]] :
    [[(x + u) / 2, eave + rise, z + width * 0.30], [(x + u) / 2, eave + rise, v - width * 0.30]];
  const faces = width > depth ? [[a, b, t, r], [b, d, t], [d, e, r, t], [e, a, r]] :
    [[a, b, r], [b, d, t, r], [d, e, t], [e, a, r, t]];
  for (const points of faces) face(out, 'clay', points, up, c.clay);
  if (!lod) return;
  beam(out, 'clay', r, t, 0.13, 0.16, c.tile);
  if (lod < 2 || !principal) return;
  const count = lod === 3 ? 125 : 76;
  for (let i = 0; i < count; i++) {
    const u = x + width * (i + 0.5) / count;
    beam(out, 'clay', [u, eave + 0.018, v + 0.19], [u, eave + 0.17, v - 0.40],
      0.077, 0.095, i % 7 ? c.eave : c.tile);
  }
}

function block(out, data, lod) {
  const { name, bounds, eave, rise } = data;
  const [x, u, z, v] = bounds, ring = [[x, z], [u, z], [u, v], [x, v]];
  for (let i = 0; i < ring.length; i++) {
    const wall = plane(ring[i], ring[(i + 1) % ring.length]);
    if (name === 'rosario' && i === 2) streetFront(out, wall, eave, lod);
    else if (name === 'rosario' && i === 0) innerWall(out, wall, eave, lod, true);
    else if (name === 'upperCorner' && i === 1) innerWall(out, wall, eave, lod, false);
    else innerWall(out, wall, eave, lod >= 2 ? lod : 0, name === 'centralRange' && i === 1);
  }
  roof(out, bounds, eave, rise, lod, name === 'rosario');
}

function corner(out, lod) {
  const { x, z, span, projection, floor, eave } = s.corner;
  const a = [x - span, z + projection], b = [x + projection, z + projection], d = [x + projection, z - span];
  const left = [x - span, z - 0.05], back = [x - 0.06, z - span];
  box(out, 'timber', (a[0] + b[0]) / 2, floor - 0.18, (z + a[1]) / 2,
    b[0] - a[0], 0.18, projection, c.timber);
  box(out, 'timber', (x + d[0]) / 2, floor - 0.18, (z + d[1]) / 2,
    projection, 0.18, span, c.timber);
  face(out, 'clay', [p3(a, eave), p3(b, eave), [x + 0.08, eave + 0.44, z - 0.13],
    p3(left, eave + 0.44)], up, c.clay);
  face(out, 'clay', [p3(b, eave), p3(d, eave), p3(back, eave + 0.44),
    [x + 0.08, eave + 0.44, z - 0.13]], up, c.clay);
  beamPath(out, 'timber', [p3(a, floor + 1.03), p3(b, floor + 1.03), p3(d, floor + 1.03)],
    0.14, 0.14, c.timber);
  if (!lod) return;
  for (const [p, q] of [[a, b], [b, d]]) {
    const count = lod === 3 ? 15 : lod === 2 ? 10 : 5;
    for (let i = 0; i <= count; i++) {
      const f = i / count, point = p.map((v, j) => v + f * (q[j] - v));
      beam(out, 'timber', p3(point, floor), p3(point, floor + 1.02),
        i % 5 ? 0.046 : 0.11, i % 5 ? 0.047 : 0.11, c.timber);
      if (lod >= 2 && i % 3 === 0) {
        const inner = p === a ? [point[0], z - 0.03] : [x - 0.03, point[1]];
        beam(out, 'timber', p3(inner, floor - 0.53), p3(point, floor - 0.16), 0.11, 0.13, c.timber);
      }
    }
  }
  for (const p of [a, b, d]) beam(out, 'timber', p3(p, floor + 1.0), p3(p, eave - 0.02), 0.11, 0.11, c.timber);
}

function build(out, lod) {
  for (const data of s.blocks) block(out, data, lod);
  corner(out, lod);
}

export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'sobremonte-museum-model.mjs';
const camera = [62, 42, 91], lookAt = [-0.5, 4.0, 10.7];
const authoredLevels = Object.fromEntries([
  ['district', 'museumDistrict', 0.30], ['street', 'museumStreet', 0.12], ['closeup', 'museumCloseup', 0.040],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const museumModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: museumCloseup, category: 'museum', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The whitewashed Sobremonte museum in Córdoba with its molded entrance, clay tile roofs, timber corner balcony and open patios.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.92, basis: 'Named Córdoba municipal heritage parcels 526 and 528 from IDECOR and Municipalidad de Córdoba, CC BY-SA 4.0.' },
  mediumFiContext: { scale: 0.80, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'clay_fired', 'wood_plain', 'metal_painted'],
  qaCameras: [
    { name: 'rosario-stone-portal-and-barred-windows', position: [5.9, 5.8, 64], lookAt: [6.3, 4.6, 33] },
    { name: 'ituzaingo-and-wrapped-timber-balcony', position: [48, 15, 63], lookAt: [12.3, 4.7, 27.1] },
    { name: 'clay-roofs-and-open-patios', position: [-39, 48, -42], lookAt: [-2.3, 3.1, 9.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-sobremonte-museum-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'museumSkyline', errorMeters: 0.78, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. Separate municipal parcel evidence from IDECOR / Municipalidad de Córdoba under CC BY-SA 4.0; OpenStreetMap ODbL 1.0; one exact public-domain Qualla photo.',
};
