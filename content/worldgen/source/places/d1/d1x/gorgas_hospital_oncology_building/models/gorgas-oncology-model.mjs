/** Exposed concrete oncology block on the former Gorgas Hospital campus. */
import fs from 'node:fs';
import { beam, beamPath, cross, normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { B as box, rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'), s = plan.section;
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94, metallic: 0 },
  slab: { slot: 'trim', graph: 'concrete_panel', roughness: 0.93, metallic: 0 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_glazed', roughness: 0.85, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48, metallic: 0.06 },
};
const c = Object.fromEntries(Object.entries({
  wall: 'b4b0a4', concrete: 'a9a69d', bright: 'c0bbae', slab: 'afada3',
  recess: '72746e', glass: '667173', glassDark: '4b5657', lintel: 'b1ab9d',
  terra: 'a96853', terraLight: 'be7d64', pocket: '70534a', roof: 'adab9e',
}).map(([name, hex]) => [name, rgb(hex)]));
const white = 'palette:#ffffff', up = [0, 1, 0], down = [0, -1, 0];

function face(out, slot, points, expected, tint) {
  if (points.length === 4) {
    const [a, b, c, d] = points;
    face(out, slot, [a, b, c], expected, tint);
    face(out, slot, [a, c, d], expected, tint);
    return;
  }
  const [a, b, d] = points;
  const normal = cross(b.map((v, i) => v - a[i]), d.map((v, i) => v - a[i]));
  if (Math.hypot(...normal) < 0.00006) return;
  const p = normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0 ? [...points].reverse() : points;
  out.addTriangle(slot, white, p, normalFor(...p), [[0, 0], [1, 0], [0, 1]], tint);
}

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u), j = Math.floor(v), dx = u - i, dz = v - j;
  const [a, b] = terrain.heightsMeters.slice(j, j + 2);
  return (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz - terrain.modelDatumElevationMeters;
}
const foot = (x, z) => ground(x, z) - 0.31;

function edges(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [u, v] = ring[(i + 1) % ring.length];
    return sum + x * v - z * u;
  }, 0);
  const ordered = area > 0 ? ring : [...ring].reverse();
  return ordered.map((a, i) => {
    const b = ordered[(i + 1) % ordered.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length, dz = (b[1] - a[1]) / length;
    const normal = [dz, 0, -dx];
    return {
      length, normal,
      at: (u, y, n = 0) => [a[0] + u * dx + n * dz, y, a[1] + u * dz - n * dx],
    };
  });
}

function panel(out, edge, slot, a, b, y, top, offset, tint) {
  if (b - a < 0.015 || top - y < 0.015) return;
  const { at, normal } = edge;
  face(out, slot, [at(a, y, offset), at(b, y, offset), at(b, top, offset), at(a, top, offset)], normal, tint);
}

function column(out, edge, x, y, h, d, thickness, trim) {
  const { at, normal } = edge;
  const a = x - thickness / 2, b = x + thickness / 2;
  const tip = d + trim;
  panel(out, edge, 'wall', a, b, y, h, tip, c.bright);
  const left = [-(normal[2]), 0, normal[0]];
  for (const [p, side] of [[a, 1], [b, -1]]) {
    face(out, 'wall', [at(p, y, d), at(p, y, tip), at(p, h, tip), at(p, h, d)],
      left.map((n) => n * side), c.wall);
  }
}

function screen(out, edge, a, b, lo, hi, lod) {
  if (lod < 3) {
    panel(out, edge, 'brick', a, b, lo, hi, -0.22, c.terra);
    return;
  }
  panel(out, edge, 'brick', a, b, lo, hi, -0.32, c.pocket);
  const { at, normal } = edge;
  const height = hi - lo;
  const strips = Math.max(2, Math.floor((b - a) / 0.55)), spacing = (b - a) / strips;
  for (let i = 0; i < strips; i++) {
    const x = a + i * spacing;
    for (const dir of [-1, 1]) {
      const head = x + (dir === -1 ? spacing : 0), tail = x + (dir === 1 ? spacing : 0);
      const p = [at(head, lo, -0.18), at(tail, hi, -0.18), at(tail - 0.058, hi, -0.18),
        at(head - 0.058, lo, -0.18)];
      face(out, 'brick', p, normal, c.terraLight);
    }
  }
}

function podium(out, lod) {
  const [f0] = s.podiumFloors;
  const terrainEdges = edges(outline);
  for (const edge of terrainEdges) {
    const { length, at, normal } = edge;
    const segments = lod >= 2 ? Math.ceil(length / 6.5) : 1;
    for (let i = 0; i < segments; i++) {
      const a = length * i / segments, b = length * (i + 1) / segments;
      const [x, , z] = at(a, 0), [u, , v] = at(b, 0);
      const low = Math.min(ground(x, z) - 0.26, f0 - 0.10);
      const end = Math.min(ground(u, v) - 0.26, f0 - 0.10);
      face(out, 'base', [at(a, low), at(b, end), at(b, f0), at(a, f0)], normal, c.concrete);
    }
    const street = normal[2] > 0.65, open = normal[2] > 0.65 || Math.abs(normal[0]) > 0.65;
    for (let level = 1; level < s.podiumFloors.length; level++) {
      const y = s.podiumFloors[level - 1], top = s.podiumFloors[level];
      panel(out, edge, 'wall', 0, length, y + 0.08, top - 0.35, open ? -1.46 : -0.24, c.concrete);
      panel(out, edge, 'slab', 0, length, top - 0.34, top, 0.009, c.slab);
      face(out, 'slab', [at(0, top - 0.34, 0.005), at(length, top - 0.34, 0.005),
        at(length, top - 0.34, -1.46), at(0, top - 0.34, -1.46)], down, c.slab);
      const count = Math.max(3, Math.round(length / (!lod ? 8.0 : 4.85)));
      for (let i = 0; i < count; i++) {
        const a = length * i / count, b = length * (i + 1) / count;
        if (!open && lod < 2) continue;
        panel(out, edge, 'glazing', a + 0.81, b - 0.69, y + 0.52, top - 0.99, open ? -1.422 : -0.21,
          (i + level) % 4 === 0 ? c.glass : c.glassDark);
        if (!lod) continue;
        column(out, edge, a + 0.24, y + 0.14, top - 0.32, -1.46, 0.30, 1.12);
        if (street || lod >= 2) screen(out, edge, a + 0.44, b - 0.18, top - 0.87, top - 0.38, lod);
        if (lod >= 2 && street) {
          const arch = Array.from({ length: 6 }, (_, j) => {
            const t = j / 5;
            return at(a + 0.30 + (b - a - 0.53) * t, top - 0.35 - 0.16 * Math.sin(Math.PI * t), 0.035);
          });
          beamPath(out, 'slab', arch, 0.103, 0.15, c.bright);
        }
      }
    }
  }
  const [a, b, c0, d] = outline.map(([x, z]) => [x, s.podiumFloors.at(-1), z]);
  face(out, 'base', [a, b, c0, d], up, c.roof);
}

function tower(out, lod) {
  const [a, b, back, front] = s.towerFootprint;
  const ring = [[a, back], [b, back], [b, front], [a, front]];
  for (const edge of edges(ring)) {
    const { length, normal, at } = edge;
    const street = normal[2] > 0.6;
    const coarse = lod === 0 ? 6.9 : lod === 1 ? 4.42 : 3.04;
    const columns = Math.max(3, Math.round(length / coarse));
    for (let i = 1; i < s.towerFloors.length; i++) {
      const low = s.towerFloors[i - 1], top = s.towerFloors[i];
      const recess = street ? -0.99 : -0.71;
      panel(out, edge, 'wall', 0, length, low, top - 0.29, recess, c.recess);
      panel(out, edge, 'slab', 0, length, top - 0.27, top, 0.12, c.bright);
      face(out, 'slab', [at(0, top - 0.27, 0.12), at(length, top - 0.27, 0.12),
        at(length, top - 0.27, recess), at(0, top - 0.27, recess)], down, c.slab);
      for (let j = 0; j < columns; j++) {
        const u = length * j / columns, v = length * (j + 1) / columns;
        panel(out, edge, 'glazing', u + 0.52, v - 0.37, low + 0.28, top - 0.51, recess + 0.025,
          (j + i * 3) % 7 === 4 ? c.glass : c.glassDark);
        if (!lod && j % 2) continue;
        column(out, edge, u + 0.13, low + 0.12, top - 0.24, recess, lod ? 0.20 : 0.26,
          street ? 1.12 : 0.82);
        if (lod >= 2) {
          const m = (u + v) / 2;
          panel(out, edge, 'slab', m - 0.037, m + 0.037, low + 0.28, top - 0.51, recess + 0.05, c.lintel);
        }
      }
      if (street || lod >= 2) {
        const post = normal[0] < 0 || normal[2] > 0 ? 0.77 : length - 0.77;
        column(out, edge, post, low - 0.03, top, recess, street ? 1.16 : 0.82, 1.28);
      }
    }
  }
  const y = s.towerFloors.at(-1);
  face(out, 'base', ring.map(([x, z]) => [x, y, z]), up, c.roof);
  if (lod) box(out, 'base', (a + b) / 2, y - 0.02, (front + back) / 2, 8.48, 0.78, 4.28, c.concrete);
}

function portal(out, lod) {
  const { baseX, topX, baseZ, topZ, height } = s.portal;
  const front = [0, 0, 1];
  const get = (side, inner) => {
    const sign = side === 0 ? 1 : -1;
    const x = baseX[side] + (inner ? sign * 2.38 : 0);
    const top = topX[side] + (inner ? sign * 2.14 : 0);
    return [[x, foot(x, baseZ), baseZ], [top, height, topZ]];
  };
  const edges = [0, 1].map((side) => {
    const [a, b] = get(side, false), [p, q] = get(side, true);
    face(out, 'wall', [a, p, q, b], front, c.concrete);
    for (const [line, sign] of [[[a, b], side === 0 ? -1 : 1], [[p, q], side === 0 ? 1 : -1]]) {
      const [u, v] = line;
      face(out, 'wall', [u, v, [v[0], v[1], v[2] - 1.35], [u[0], u[1], u[2] - 1.35]], [sign, 0, 0], c.wall);
    }
    return q;
  });
  const [left, right] = edges;
  const [leftLow, rightLow] = edges.map(([x, y, z]) => [x, y - 1.87, z + 0.37]);
  face(out, 'wall', [leftLow, rightLow, right, left], front, c.bright);
  face(out, 'wall', [leftLow, rightLow, [rightLow[0], rightLow[1], rightLow[2] - 2.12],
    [leftLow[0], leftLow[1], leftLow[2] - 2.12]], down, c.wall);
  const midpoint = (baseX[0] + baseX[1]) / 2;
  box(out, 'wall', midpoint + 0.5, 0.33, topZ - 0.85, 10.48, height - 1.11, 0.41, c.concrete);
  box(out, 'glazing', midpoint - 2.45, 0.38, topZ - 0.60, 2.66, 2.78, 0.11, c.glassDark);
  if (lod >= 2) {
    for (const h of [2.1, 4.2, 6.3, 8.4]) {
      const t = h / height, x = baseX[0] + (topX[0] - baseX[0]) * t, z = baseZ + (topZ - baseZ) * t;
      beam(out, 'base', [x + 0.08, h, z + 0.027], [x + 2.24, h, z + 0.027], 0.042, 0.066, c.lintel);
    }
  }
}

function build(out, lod) {
  podium(out, lod);
  tower(out, lod);
  portal(out, lod);
}

export const hospitalSkyline = (out) => build(out, 0);
export const hospitalDistrict = (out) => build(out, 1);
export const hospitalStreet = (out) => build(out, 2);
export const hospitalCloseup = (out) => build(out, 3);

const recipe = 'gorgas-oncology-model.mjs';
const camera = [69, 45, 106], lookAt = [-2.4, 9.0, -1.5];
const authoredLevels = Object.fromEntries([
  ['district', 'hospitalDistrict', 0.44], ['street', 'hospitalStreet', 0.18], ['closeup', 'hospitalCloseup', 0.065],
].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]));

export const hospitalModel = {
  id: plan.model, key: plan.model, title: plan.title, cell: plan.cell, wikidataId: plan.wikidataId,
  recipe, surfaces, build: hospitalCloseup, category: 'hospital', quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json', geographicStatus: 'historical-proposal', orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: 'The Ancón oncology block with its angled concrete entrance, exposed stacked floorplates, recessed glazing and terra-cotta lattice galleries.',
  appearance: { kind: 'historical', representedDate: plan.representedDate, validFrom: plan.validFrom, validUntil: plan.validUntil, currentWorldEligible: false },
  camera, lookAt,
  buildingCutout: { outline, minimumCoverage: 0.90, basis: 'Named oncology building envelope, OpenStreetMap way 73814947.' },
  mediumFiContext: { scale: 0.84, groundY: 0, terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' } },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'concrete_panel', 'concrete_plain', 'brick_glazed'],
  qaCameras: [
    { name: 'calle-gorgas-portal-and-concrete-slabs', position: [-37, 5.1, 68], lookAt: [-6.0, 11.5, 21] },
    { name: 'podium-galleries-and-lattice', position: [22, 5.9, 58], lookAt: [10.8, 5.9, 33.2] },
    { name: 'upper-hospital-floorplates-and-rear-terrace', position: [54, 43, -67], lookAt: [-6, 10.8, -9.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-gorgas-oncology-building-${reviewLod}`, position: camera, lookAt, reviewLod,
  })),
  runtimeLodOverlay: { module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline', export: 'hospitalSkyline', errorMeters: 0.85, surfaces, authoredLevels },
  limitations: plan.limitations,
  sourceLicense: 'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photo.',
};
