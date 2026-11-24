import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const parts = read('native-map/shenzhen-history-mapped-parts');
const museumOutline = outwardRing(frame.geometry.outline);
const museumCourt = frame.geometry.holes.map(outwardRing);
const glazed = parts.filter((part) => part.tags['building:material'] === 'glass');
const connections = parts.filter((part) =>
  ['way/781536969', 'way/781536970', 'way/781536981', 'way/781536982'].includes(part.id),
);
const canopy = parts
  .filter((part) => part.role === 'Civic Center canopy')
  .map((part) => outwardRing(part.points));

const panel = rgb('b2b9ba');
const panelLight = rgb('bdc3c3');
const panelJoint = rgb('747c7f');
const slopeStone = rgb('aaa9a0');
const rampCap = rgb('c1c1b7');
const sill = rgb('8c9391');
const curtain = rgb('5e757d');
const paleGlass = rgb('718892');
const interior = rgb('454c4e');
const steel = rgb('666c6c');
const fascia = rgb('4f5b62');
const above = rgb('497088');
const soffit = rgb('434d54');

const surfaces = {
  panel: { slot: 'wall', graph: 'concrete_panel', roughness: 0.88 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.14 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88, metallic: 0.15 },
  underside: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.94 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
};

function triangulate(outer, holes = []) {
  const vertices = [...outer, ...holes.flat()];
  const starts = [];
  let start = outer.length;
  for (const hole of holes) {
    starts.push(start);
    start += hole.length;
  }
  const indices = earcut(vertices.flat(), starts);
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3)
    triangles.push(indices.slice(i, i + 3).map((j) => vertices[j]));
  return triangles;
}

function planeTriangle(out, slot, poly, y, color, top = true) {
  const [a, b, c] = poly.map(([x, z]) => [x, y(x, z), z]);
  const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (Math.abs(up) < 0.00003) return;
  if (up > 0 === top) tri(out, slot, a, b, c, color);
  else tri(out, slot, a, c, b, color);
}

function cap(out, slot, ring, y, tone, holes = []) {
  for (const poly of triangulate(ring, holes)) planeTriangle(out, slot, poly, y, tone);
}

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * h[j][i] + a * h[j][i + 1]) +
    b * ((1 - a) * h[j + 1][i] + a * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function edges(ring) {
  return ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
}

function wallQuad(out, slot, f, a, b, bottom, top, color, depth = 0) {
  quad4(
    out,
    slot,
    f.P(a, bottom, depth),
    f.P(b, bottom, depth),
    f.P(b, top, depth),
    f.P(a, top, depth),
    color,
  );
}

function panelDetails(out, f, u0, u1, bottom, top, level) {
  if (level < 2 || u1 - u0 < 0.1 || top - bottom < 0.32) return;
  const bays = Math.max(1, Math.round((u1 - u0) / 3.25));
  for (let bay = 1; bay < bays; bay++) {
    const u = u0 + ((u1 - u0) * bay) / bays;
    wallQuad(out, 'steel', f, u - 0.02, u + 0.02, bottom + 0.02, top - 0.02, panelJoint, 0.035);
  }
  for (let y = bottom + 1.62; y < top - 0.19; y += 1.62) {
    wallQuad(out, 'steel', f, u0 + 0.04, u1 - 0.04, y - 0.022, y + 0.022, panelJoint, 0.037);
  }
}

function wallOpening(out, f, a, b, y0, y1, depth, level) {
  const front = [f.P(a, y0), f.P(b, y0), f.P(b, y1), f.P(a, y1)];
  const back = [f.P(a, y0, -depth), f.P(b, y0, -depth), f.P(b, y1, -depth), f.P(a, y1, -depth)];
  quad4(out, 'panel', front[3], front[0], back[0], back[3], panelLight);
  quad4(out, 'panel', front[1], front[2], back[2], back[1], panelLight);
  quad4(out, 'concrete', front[0], front[1], back[1], back[0], sill);
  quad4(out, 'underside', front[2], front[3], back[3], back[2], soffit);
  quad4(out, 'glazing', ...back, interior);
  if (level > 0) {
    const bays = 5;
    for (let i = 0; i <= bays; i++) {
      const u = a + ((b - a) * i) / bays;
      fbox(out, 'steel', f, u - 0.058, u + 0.058, y0, y1, -depth + 0.015, -depth + 0.13, steel);
    }
    fbox(out, 'steel', f, a, b, y0 + 2.27, y0 + 2.38, -depth + 0.01, -depth + 0.105, steel);
  }
}

function entrance(out, f, a, b, portalTop, top, depth, level) {
  wallQuad(out, 'panel', f, 0, a, 0.48, portalTop, panel);
  wallQuad(out, 'panel', f, b, f.length, 0.48, portalTop, panel);
  wallQuad(out, 'panel', f, 0, f.length, portalTop, top, panelLight);
  wallOpening(out, f, a, b, 0.48, portalTop, depth, level);
  panelDetails(out, f, 0, f.length, portalTop, top, level);
}

function mainVolume(out, level) {
  const roofHeight = plan.dimensions.northAttachedHeightM;
  extrude(out, 'concrete', museumOutline, -5.8, 0.48, sill, { top: false });
  for (const f of edges(museumOutline)) {
    const [x] = f.P(f.length / 2, 0);
    const southPorch = f.normal[1] > 0.75 && x > -12 && x < 14;
    const slot = 'panel';
    const top = f.normal[1] > 0.75 ? plan.dimensions.mainDocumentedHeightM : roofHeight;
    if (southPorch) {
      const a = f.length * 0.06;
      const b = f.length * 0.94;
      wallQuad(out, 'panel', f, 0, f.length, 0.48, 3.0, panel);
      wallQuad(out, 'panel', f, 0, a, 3.0, 13.5, panelLight);
      wallQuad(out, 'panel', f, b, f.length, 3.0, 13.5, panelLight);
      wallQuad(out, 'panel', f, 0, f.length, 13.5, top, panelLight);
      wallOpening(out, f, a, b, 3.0, 13.5, 3.6, level);
      fbox(out, 'concrete', f, a, b, 7.95, 8.19, -3.56, -0.03, sill);
    } else {
      wallQuad(out, slot, f, 0, f.length, 0.48, top, panel);
      panelDetails(out, f, 0, f.length, 0.48, top, level);
      if (level > 0 && f.length > 20 && f.normal[1] < -0.75) {
        for (const y of [3.75, 8.32, 12.68])
          wallQuad(out, 'glazing', f, 0.9, f.length - 0.9, y, y + 1.28, curtain, 0.049);
      }
    }
    if (top < roofHeight) wallQuad(out, 'panel', f, 0, f.length, top, roofHeight, panelJoint);
  }
  for (const ring of museumCourt)
    for (const f of edges(ring.slice().reverse()))
      wallQuad(out, 'panel', f, 0, f.length, 0.47, roofHeight, panel);
  cap(out, 'concrete', museumOutline, () => roofHeight, sill, museumCourt);
}

function linkedWing(out, part, level, glass) {
  const ring = outwardRing(part.points);
  const y = Number(part.tags.height);
  if (part.id === 'way/781536981') {
    // The mapped south support wraps the open approach beneath the central steel brace.
    const front = wallFace([-5.205, 44.8], [5.731, 44.955]);
    const n = front.length;
    for (const [a, b] of [
      [0, 1.25],
      [n - 1.25, n],
    ]) {
      fbox(out, 'panel', front, a, b, -0.6, y, -7.22, 0, panelLight);
    }
    fbox(out, 'panel', front, 0, n, y - 1.1, y, -7.22, 0, panel);
    if (level > 1) panelDetails(out, front, 0, n, y - 1.07, y, level);
    return;
  }
  cap(out, 'concrete', ring, () => y, sill);
  if (part.id === 'way/781536969') {
    extrude(out, 'concrete', ring, -2.5, 0.48, sill, { top: false });
    for (const f of edges(ring))
      if (f.normal[0] < 0.9) wallQuad(out, 'panel', f, 0, f.length, 0.48, y, panel);
    const front = wallFace([63.93, 18.513], [63.93, -22.264]);
    entrance(out, front, 12.9, 27.8, 5.2, y, 3.1, level);
    if (level > 1)
      for (const u of [16.5, 21.4, 25.65])
        fbox(out, 'panel', front, u - 0.42, u + 0.42, 0.48, 5.22, -0.63, 0, panelLight);
    return;
  }
  if (!glass) {
    extrude(out, 'panel', ring, -2.5, y, panel, { top: false });
    for (const f of edges(ring)) panelDetails(out, f, 0, f.length, 0.47, y, level);
    return;
  }
  extrude(out, 'concrete', ring, -3.5, 0.37, sill, { top: false });
  for (const [index, f] of edges(ring).entries()) {
    wallQuad(out, 'glazing', f, 0, f.length, 0.37, y, index % 2 ? paleGlass : curtain);
    if (f.length < 1.7 || level === 0) continue;
    const floors = Math.round(y / 3.6);
    for (let i = 1; i < floors; i++) {
      const h = (i * y) / floors;
      wallQuad(out, 'steel', f, 0, f.length, h - 0.044, h + 0.044, steel, 0.06);
    }
    if (level > 1) {
      const bays = Math.round(f.length / (level === 3 ? 2.55 : 4.35));
      for (let j = 1; j < bays; j++) {
        const x = (j * f.length) / bays;
        wallQuad(out, 'steel', f, x - 0.043, x + 0.043, 0.55, y - 0.04, panelJoint, 0.067);
      }
    }
  }
}

const section = [
  [-120, 49.6],
  [-104, 45.2],
  [-86, 39.7],
  [-68, 35.1],
  [-48, 31.9],
  [-26, 29.45],
  [-6, 28.68],
  [11, 28.87],
  [29, 30.0],
  [48, 32.35],
  [62, 35.61],
  [72, 38.8],
];

function height(x, z) {
  const last = section.findIndex((p) => p[0] >= x);
  const i = last < 0 ? section.length - 1 : Math.max(1, last);
  const [a, ya] = section[i - 1];
  const [b, yb] = section[i];
  return ya + ((x - a) / (b - a)) * (yb - ya) - 0.016 * z;
}

const underside = (x, z) => height(x, z) - 3.15;

function halfPlane(polygon, x, keepSign) {
  const points = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const da = keepSign * (a[0] - x);
    const db = keepSign * (b[0] - x);
    if (da >= 0) points.push(a);
    if (da * db < 0) points.push([x, a[1] + (da / (da - db)) * (b[1] - a[1])]);
  }
  return points;
}

function boundarySegments(rings) {
  const boundary = new Map();
  for (const ring of rings)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const key = [a.join(','), b.join(',')].sort().join('/');
      if (boundary.has(key)) boundary.delete(key);
      else boundary.set(key, [a, b]);
    }
  return [...boundary.values()];
}

function canopyMesh(out, level) {
  const ribs = section.filter((_, i) => level > 0 || i % 2 === 0 || i === section.length - 1);
  const xcuts = ribs.map(([x]) => x);
  for (const ring of canopy) {
    for (const poly of triangulate(ring)) {
      for (let i = 1; i < xcuts.length; i++) {
        const strip = halfPlane(halfPlane(poly, xcuts[i - 1], 1), xcuts[i], -1);
        for (let j = 1; j < strip.length - 1; j++) {
          const patch = [strip[0], strip[j], strip[j + 1]];
          planeTriangle(out, 'roof', patch, height, above);
          planeTriangle(out, 'underside', patch, underside, soffit, false);
        }
      }
    }
  }
  for (const [a, b] of boundarySegments(canopy)) {
    const crossings = xcuts.filter(
      (x) => x > Math.min(a[0], b[0]) + 0.03 && x < Math.max(a[0], b[0]) - 0.03,
    );
    if (a[0] > b[0]) crossings.reverse();
    const points = [
      a,
      ...crossings.map((x) => [x, a[1] + (b[1] - a[1]) * ((x - a[0]) / (b[0] - a[0]))]),
      b,
    ];
    for (let i = 1; i < points.length; i++) {
      const p = points[i - 1];
      const q = points[i];
      const A = [p[0], underside(...p), p[1]];
      const B = [q[0], underside(...q), q[1]];
      const C = [q[0], height(...q), q[1]];
      const D = [p[0], height(...p), p[1]];
      quad4(out, 'steel', A, B, C, D, fascia);
      if (level > 1 && Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.25)
        beam(out, 'steel', D, C, 0.115, 0.115, steel);
    }
  }
}

const braceStations = [
  [-87, -47],
  [-79, 34],
  [-56, 34],
  [-55, -59],
  [-27, 44],
  [0, 44],
  [1, -59],
  [27, 57],
  [49, 57],
  [53, -65],
];

const distantBraceStations = new Set([0, 1, 5, 7, 9]);
function roofSupports(out, level) {
  for (const [i, [x, z]] of braceStations.entries()) {
    if (level === 0 && !distantBraceStations.has(i)) continue;
    const base = Math.max(grade(x, z) + 0.17, 0.26);
    const insetFromWall = Math.abs(x) < 6 ? 18.5 : z > 0 ? 12.8 : 13.2;
    const roofZ = z - Math.sign(z) * 4.9;
    const joint = [x, insetFromWall, z];
    const foot = [x, base, z];
    const wide = Math.abs(x) < 6 ? 7.7 : 5.73;
    beam(out, 'steel', foot, joint, 0.95, 0.95, steel);
    for (const side of [-1, 1]) {
      const topX = x + side * wide;
      const top = [topX, underside(topX, roofZ) + 0.1, roofZ];
      beam(out, 'steel', joint, top, 0.66, 0.78, steel);
      if (level > 1) {
        const lower = [x + side * 3.8, base + 0.23, z - 1.3];
        beam(out, 'steel', lower, joint, 0.48, 0.46, steel);
      }
    }
    if (level > 0)
      abox(
        out,
        'concrete',
        [x - 0.83, base - 0.31, z - 0.78],
        [x + 0.83, base + 0.16, z + 0.78],
        sill,
      );
  }
}

function podiumRamp(out, a, b, front, rear, level) {
  const ring = outwardRing([
    [a, front],
    [b, front],
    [b - 1.2, rear],
    [a + 1.6, rear],
  ]);
  const top = (x, z) => Math.max(grade(x, z) + 0.28, 0.68 + ((front - z) / (front - rear)) * 3.28);
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    quad4(
      out,
      'concrete',
      [p[0], grade(...p) - 0.72, p[1]],
      [q[0], grade(...q) - 0.72, q[1]],
      [q[0], top(...q), q[1]],
      [p[0], top(...p), p[1]],
      slopeStone,
    );
  }
  cap(out, 'panel', ring, top, rampCap);
  if (level > 1) {
    const rearEdge = wallFace(ring[1], ring[2]);
    for (const y of [0.4, 0.83, 1.26])
      wallQuad(out, 'panel', rearEdge, 0.28, rearEdge.length - 0.28, y, y + 0.047, sill, 0.021);
  }
}

function build(out, level) {
  mainVolume(out, level);
  for (const p of glazed) linkedWing(out, p, level, true);
  for (const p of connections) linkedWing(out, p, level, false);
  canopyMesh(out, level);
  roofSupports(out, level);
  podiumRamp(out, -32.7, -10.8, 80.1, 50.0, level);
  podiumRamp(out, 12.3, 33.4, 83.6, 55.9, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'shenzhen-museum-model.mjs';
const camera = [157, 81, 148];
const lookAt = [-14, 16, 9];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Shenzhen Museum',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The History and Folk Culture wing of Shenzhen Museum with its sweeping steel canopy, modular pale facade, glazed sections and flanking entrance ramps.',
  camera,
  lookAt,
  sunDirection: [73, 61, 53],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    holes: frame.geometry.holes,
    minimumCoverage: 0.88,
    basis: 'Mapped museum wing and interior opening below the Civic Center canopy.',
  },
  embeddedCanonicalGraphs: [
    'concrete_panel',
    'concrete_plain',
    'metal_painted',
    'metal_standing_seam',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'museums-south-entrance-and-canopy', position: [1, 3.6, 143], lookAt: [1, 17, 24] },
    {
      name: 'east-entrance-panels-and-structure',
      position: [116, 8.0, 27],
      lookAt: [45, 13.0, -1],
    },
    { name: 'roof-profiles-and-courtyard', position: [107, 99, -126], lookAt: [-19, 15.0, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'shenzhen-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
