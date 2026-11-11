/** Naeba's ski-front hotel buildings and day-trip arrival hall in December 2025. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam, beamPath, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url));
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), terrain = read('terrain-grid');
const polygons = read('map-frame').geometry.polygons;
const white = 'palette:#ffffff', up = [0, 1, 0];

const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.94, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0.12 },
  glass: { slot: 'window', localRef: white, roughness: 0.49, metallic: 0 },
};
const color = Object.fromEntries(Object.entries({
  pale: 'eeede7', white: 'f2f0e8', cream: 'd8d4c7', gray: 'aca99f',
  glass: '545e65', blue: '68757c', dark: '444e56', opening: '3f4649',
  roof: '777b78', seam: '91928b', steel: 'a7aca7', accent: '90594c',
}).map(([name, hex]) => [name, rgb(hex)]));

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}

function face(out, slot, points, wanted, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((total, value, i) => total + value * wanted[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addTriangle(slot, white, points, normal, [[0, 0], [1, 0], [0, 1]], tint);
}

function signedArea(ring) {
  return ring.reduce((area, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return area + x * b - z * a;
  }, 0) / 2;
}

const footprint = polygons.map((ring) => {
  const open = ring.filter((point, i) => {
    const prev = ring[(i + ring.length - 1) % ring.length];
    return Math.hypot(point[0] - prev[0], point[1] - prev[1]) > 0.13;
  });
  return signedArea(open) < 0 ? [...open].reverse() : open;
});

function wallFrame(a, b, floorAt) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  const ux = dx / length, uz = dz / length;
  const at = (u, y, depth = 0) => {
    const x = a[0] + ux * u, z = a[1] + uz * u;
    return [x + uz * depth, floorAt(x, z) + y, z - ux * depth];
  };
  return { length, at, normal: [uz, 0, -ux] };
}

function horizontal(out, slot, ring, heightAt, tint) {
  const triangles = earcut(ring.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((index) => {
      const [x, z] = ring[index];
      return [x, heightAt(x, z), z];
    });
    face(out, slot, points, up, tint);
  }
}

function strip(out, wall, slot, start, end, bottom, top, tint, offset = 0) {
  if (end - start < 0.03 || top - bottom < 0.03) return;
  const { at } = wall;
  face(out, slot, [at(start, bottom, offset), at(end, bottom, offset),
    at(end, top, offset), at(start, top, offset)], wall.normal, tint);
}

function towerBands(out, wall, wing, lod) {
  if (wall.length < 6) return;
  const margin = 1.20;
  const levels = lod === 0 ? 11 : wing.levels - 1, row = (wing.height - 9.0) / levels;
  for (let i = 0; i < levels; i++) {
    const y = 4.75 + row * i;
    strip(out, wall, 'glass', margin, wall.length - margin, y, y + row * (lod ? 0.56 : 0.40),
      i % 5 === 1 ? color.blue : color.dark, 0.018);
    if (lod > 0) {
      strip(out, wall, 'concrete', 0, wall.length, y - 0.31, y + 0.06, color.pale, 0.23);
    }
    if (lod > 1) {
      const panes = lod === 3 ? 11 : 6;
      for (let j = 1; j < panes; j++) {
        const x = margin + (wall.length - 2 * margin) * j / panes;
        strip(out, wall, 'steel', x - 0.037, x + 0.037, y + 0.09, y + row * 0.56, color.steel, 0.042);
      }
    }
  }
}

function hotelWindows(out, wall, wing, lod, facade) {
  if (wall.length < 6.4) return;
  const end = Math.min(wall.length * 0.17, 3.4);
  const span = wall.length - 2 * end;
  const pitch = [15.3, 7.1, 4.45, 3.78][lod];
  const count = Math.max(1, Math.round(span / pitch)), unit = span / count;
  const rows = lod === 0 ? Math.min(3, wing.levels - 2) : lod === 1 ? Math.min(5, wing.levels - 2) : wing.levels - 2;
  const first = 6.1, floor = (wing.height - first - 2.3) / rows;
  const tallBlank = wing.name !== 'building-6' ? 0 : 1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < count; x++) {
      if (lod > 1 && tallBlank && count > 12 && (x === 1 || x === count - 2)) continue;
      const mid = end + (x + 0.5) * unit;
      const width = Math.min(unit * (lod < 2 ? 0.47 : 0.55), lod < 2 ? 3.10 : 2.05);
      const bottom = first + floor * y + floor * 0.13;
      const top = bottom + floor * (lod === 0 ? 0.27 : lod === 1 ? 0.41 : 0.46);
      const tint = (x + y * 3 + facade) % 11 < 3 ? color.blue : color.glass;
      strip(out, wall, 'glass', mid - width / 2, mid + width / 2, bottom, top, tint, 0.017);
      if (lod === 3 && width >= 1.45 && (x + y + facade) % 3 === 0) {
        strip(out, wall, 'steel', mid - 0.041, mid + 0.041, bottom, top, color.steel, 0.043);
      }
    }
  }
}

function baseGlazing(out, wall, wing, lod, i) {
  if (wall.length < 7) return;
  const top = wing.name === 'day-trip-centre' ? 5.45 : 4.58;
  const end = Math.min(wall.length * 0.12, 1.8);
  strip(out, wall, 'glass', end, wall.length - end, 0.75, top, i % 2 === 0 ? color.glass : color.opening, 0.034);
  strip(out, wall, 'concrete', 0, wall.length, top, top + 0.54, color.cream, 0.17);
  if (lod < 1) return;
  const bays = Math.max(1, Math.floor((wall.length - end * 2) / (lod === 1 ? 7.7 : 4.25)));
  for (let j = 1; j < bays; j++) {
    const x = end + (wall.length - end * 2) * j / bays;
    strip(out, wall, 'steel', x - 0.13, x + 0.13, 0.71, top, color.steel, 0.070);
  }
  if (lod > 1) {
    strip(out, wall, 'steel', end, wall.length - end, top * 0.57, top * 0.57 + 0.09, color.steel, 0.068);
  }
}

function buildWing(out, ring, wing, lod) {
  const floorAt = (_, z) => wing.ground + (wing.fall ?? 0) * z;
  const roofAt = (x, z) => floorAt(x, z) + wing.height;
  horizontal(out, 'roof', ring, roofAt, color.roof);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const wall = wallFrame(a, b, floorAt), { length, at } = wall;
    const baseA = Math.min(floorAt(...a) - 0.30, ground(...a) - 0.41);
    const baseB = Math.min(floorAt(...b) - 0.30, ground(...b) - 0.41);
    face(out, wing.curtain ? 'panel' : 'concrete',
      [[a[0], baseA, a[1]], [b[0], baseB, b[1]], at(length, wing.height), at(0, wing.height)],
      wall.normal, i % 4 === 1 ? color.pale : color.white);
    baseGlazing(out, wall, wing, lod, i);
    if (wing.curtain) towerBands(out, wall, wing, lod);
    else if (wing.name !== 'day-trip-centre') hotelWindows(out, wall, wing, lod, i);
    if (lod > 0) {
      strip(out, wall, 'steel', 0, length, wing.height - 0.35, wing.height + 0.13, color.seam, 0.085);
    }
    if (lod > 1 && wing.name !== 'day-trip-centre') {
      strip(out, wall, 'concrete', 0, length, 4.78, 5.03, color.cream, 0.23);
    }
  }
}

function plantRooms(out, lod) {
  const rooms = [
    [-58.1, 246.4, 75.6, 24.7, 16.7, 3.2],
    [-58.2, 194.7, 32.60, 9.0, 8.0, 4.7],
    [-33.0, 107.5, 38.62, 10.0, 8.0, 5.4],
    [-29.0, -43.5, 23.1, 19.7, 10.0, 5.8],
  ];
  for (const [x, z, y, w, d, h] of rooms) {
    box(out, 'concrete', x, y - 0.12, z, w, h, d, color.pale);
    if (lod > 0) box(out, 'roof', x, y + h - 0.18, z, w + 0.35, 0.33, d + 0.35, color.roof);
    if (lod > 1) {
      box(out, 'steel', x + w * 0.24, y + h + 0.12, z, w * 0.31, 1.12, d * 0.44, color.seam);
    }
  }
}

function southConnector(out, lod) {
  const start = [-61.0, 218.0], end = [-56.8, 229.5];
  beam(out, 'concrete', [start[0], 2.25, start[1]], [end[0], 2.25, end[1]], 11.6, 4.2, color.cream);
  if (lod > 0) {
    beam(out, 'roof', [start[0], 4.45, start[1]], [end[0], 4.45, end[1]], 12.4, 0.36, color.roof);
  }
}

function arrivalCanopy(out, lod) {
  const segments = [5, 9, 14, 20][lod];
  const start = -260, end = -221, front = 89.5, back = 71.0, base = -11.83;
  const curve = (i) => {
    const t = i / segments;
    return [start + (end - start) * t, base + 3.22 * 4 * t * (1 - t)];
  };
  const frontEdge = [], rearEdge = [];
  for (let i = 0; i <= segments; i++) {
    const [z, y] = curve(i);
    frontEdge.push([front, y, z]);
    rearEdge.push([back, y, z]);
    if (i === 0) continue;
    face(out, 'roof', [frontEdge[i - 1], rearEdge[i - 1], rearEdge[i], frontEdge[i]], up, color.roof);
    const [z0, y0] = curve(i - 1);
    face(out, 'glass', [[front - 1.15, -17.08, z0], [front - 1.15, -17.08, z],
      [front - 1.15, y - 0.24, z], [front - 1.15, y0 - 0.24, z0]], [1, 0, 0], color.glass);
  }
  beamPath(out, 'steel', frontEdge, 0.36, 0.46, color.steel);
  if (lod > 0) {
    for (let i = 0; i <= segments; i += lod === 1 ? 2 : 1) {
      const [z, y] = curve(i);
      beam(out, 'steel', [front - 1.09, -17.1, z], [front - 1.09, y, z], 0.16, 0.22, color.steel);
    }
    beam(out, 'steel', [front - 1.08, -14.6, start], [front - 1.08, -14.6, end], 0.12, 0.17, color.steel);
  }
  if (lod > 1) {
    box(out, 'steel', front + 1.4, -16.93, -237.2, 5.6, 0.40, 28.4, color.gray);
    box(out, 'steel', front - 0.75, -11.56, -238.5, 0.33, 0.69, 7.1, color.accent);
  }
}

function build(out, lod) {
  for (let i = 0; i < footprint.length; i++) buildWing(out, footprint[i], plan.section.wings[i], lod);
  plantRooms(out, lod);
  southConnector(out, lod);
  arrivalCanopy(out, lod);
}

export const resortSkyline = (out) => build(out, 0);
export const resortDistrict = (out) => build(out, 1);
export const resortStreet = (out) => build(out, 2);
export const resortCloseup = (out) => build(out, 3);
const recipe = 'naeba-ski-resort-model.mjs';
const camera = [-605, 300, 205], lookAt = [-4, 18, 3];
const authoredLevels = Object.fromEntries([
  ['district', 'resortDistrict', 0.72], ['street', 'resortStreet', 0.22], ['closeup', 'resortCloseup', 0.06],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const resortModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: resortCloseup, category: 'landmark', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The Naeba resort base with the striped Prince Hotel tower, curved ranks of pale hotel wings, and glazed day-trip ski centre.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline: footprint[0], outlines: footprint, minimumCoverage: 0.94,
    basis: 'Five individually mapped hotel and base building footprints, OpenStreetMap ODbL 1.0.' },
  mediumFiContext: { scale: 9.6, groundY: 0, far: 15000, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['concrete_plain', 'concrete_panel', 'membrane', 'metal_painted'],
  qaCameras: [
    { name: 'southern-tower-and-ski-front', position: [-244, 111, 341], lookAt: [-54, 31, 169] },
    { name: 'long-hotel-wing-and-snowfront', position: [-297, 116, -112], lookAt: [3, 11, -47] },
    { name: 'curved-glazed-arrival-hall', position: [164, 20, -260], lookAt: [76, -9, -231] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-naeba-resort-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'resortSkyline', errorMeters: 1.5, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license. OpenStreetMap outlines ODbL 1.0. Four exact published Qualla photos in the public domain or dedicated to CC0.',
};
