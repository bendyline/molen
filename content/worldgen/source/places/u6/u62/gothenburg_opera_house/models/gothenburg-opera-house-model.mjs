/** Göteborgsoperan at Lilla Bommen in the 2008 public-domain photographs. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid'),
  frame = read('map-frame');
const [outline] = frame.geometry.polygons;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_panel', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.16 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
  glass: { slot: 'window', localRef: white, roughness: 0.4, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    panel: 'a4a59b',
    pale: 'b6b8b0',
    darkPanel: '8e9992',
    base: '928f82',
    seam: '8e8e84',
    ochre: 'bb8d68',
    orange: 'b88261',
    inset: '806752',
    roof: '88958f',
    fascia: '404b47',
    glass: '445a5b',
    glassLight: '596d6b',
    glassDark: '37474a',
    steel: '505c55',
    paleSteel: '89968e',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const point = ([x, z], y) => [x, y, z];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}
function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length;
  return {
    length,
    x: (a[0] + b[0]) / 2,
    z: (a[1] + b[1]) / 2,
    normal: [uz, 0, -ux],
    at: (u, y, depth = 0) => [a[0] + ux * u + uz * depth, y, a[1] + uz * u - ux * depth],
  };
}
function panel(out, wall, slot, left, right, low, high, tint, offset = 0) {
  face(
    out,
    slot,
    [
      wall.at(left, low, offset),
      wall.at(right, low, offset),
      wall.at(right, high, offset),
      wall.at(left, high, offset),
    ],
    wall.normal,
    tint,
  );
}
function outward(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return sum + x * b - z * a;
  }, 0);
  return area > 0 ? ring : [...ring].reverse();
}

const partRoles = [
  'east',
  'canopy',
  'foyer',
  'fly',
  'auditorium',
  'office',
  'stage',
  'plant',
  'workshop',
  'waterfront',
  'service',
  'stage',
  'office',
  'gallery',
  'waterfront',
];
const parts = frame.features.slice(1).map(({ id, points, properties }) => {
  const role = partRoles[Number(id.split('/')[1]) - 1561676092];
  const ring = outward(cleanRing(points));
  const highest = Number(properties.height),
    roofRise = Number(properties['roof:height'] ?? 0);
  const roofShape = properties['roof:shape'];
  const isGable = roofShape === 'gabled';
  const bearing =
    (Number(properties['roof:direction'] ?? (role === 'gallery' ? 146 : 325)) * Math.PI) / 180;
  const direction = [Math.sin(bearing + frame.heading), -Math.cos(bearing + frame.heading)];
  const project = ([x, z]) => (isGable ? z : x * direction[0] + z * direction[1]);
  const projections = ring.map(project),
    min = Math.min(...projections),
    max = Math.max(...projections),
    mid = (min + max) / 2;
  const highAt = (p) => {
    const t = (project(p) - min) / (max - min);
    if (isGable) return highest - 2 * roofRise * Math.abs(t - 0.5);
    return highest - (roofShape === 'skillion' ? roofRise * t : 0);
  };
  return { role, ring, highest, highAt, ridge: isGable ? mid : undefined };
});

function splitRing(ring, z, side) {
  const inside = (p) => (p[1] - z) * side >= 0;
  const vertices = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (inside(a)) vertices.push(a);
    if (inside(a) !== inside(b)) {
      const t = (z - a[1]) / (b[1] - a[1]);
      if (t > 0.00001 && t < 0.99999) vertices.push([lerp(a[0], b[0], t), z]);
    }
  }
  return cleanRing(vertices);
}
function roof(out, part) {
  const { ring, ridge, highAt, role } = part;
  for (const roof of ridge === undefined
    ? [ring]
    : [-1, 1].map((side) => splitRing(ring, ridge, side))) {
    const indices = earcut(roof.flat());
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => point(roof[j], highAt(roof[j])));
      face(out, 'roof', p, up, role === 'canopy' ? c.fascia : c.roof);
    }
  }
}
function glazedBand(out, wall, y, h, lod, doors = false) {
  const w = wall.length;
  if (w < 0.52 || h < 0.48) return;
  panel(out, wall, 'glass', 0.08, w - 0.08, y, y + h, c.glass, 0.025);
  if (lod === 0) return;
  const bays = Math.max(1, Math.round(w / [0, 4.8, 3.8, 2.9][lod]));
  for (let i = 0; i < bays; i++) {
    const a = (w * i) / bays + 0.11,
      b = (w * (i + 1)) / bays - 0.11;
    if (i % 4 === 1) panel(out, wall, 'glass', a, b, y + 0.07, y + h - 0.07, c.glassLight, 0.039);
    panel(out, wall, 'steel', a - 0.055, a + 0.055, y - 0.025, y + h + 0.025, c.steel, 0.079);
    if (doors && lod > 1 && i % 3 === 1) {
      panel(
        out,
        wall,
        'glass',
        a + 0.15,
        b - 0.11,
        y,
        Math.min(y + 2.67, y + h - 0.05),
        c.glassDark,
        0.095,
      );
      panel(
        out,
        wall,
        'steel',
        (a + b) / 2 - 0.04,
        (a + b) / 2 + 0.04,
        y,
        Math.min(y + 2.62, y + h),
        c.steel,
        0.105,
      );
    }
  }
  if (lod > 1)
    for (const fraction of h > 5 ? [0.37, 0.72] : [0.52])
      panel(out, wall, 'steel', 0, w, y + h * fraction, y + h * fraction + 0.09, c.steel, 0.075);
}
function outerWall(out, part, a, b, lod) {
  const wall = edge(a, b),
    w = wall.length;
  if (w < 0.075) return;
  const highA = part.highAt(a),
    highB = part.highAt(b),
    high = Math.min(highA, highB);
  const lower = Math.min(-1.08, ground(...a) - 0.65, ground(...b) - 0.65);
  const front = wall.normal[2] > 0.55;
  const publicFoyer = part.role === 'foyer' && (front || wall.normal[0] > 0.64) && wall.x > 28;
  const publicGallery = part.role === 'foyer' && front && wall.x < 28;
  const overhang = part.role === 'east' && wall.x > 63;
  const gallery = part.role === 'gallery' && (front || wall.normal[0] < -0.5);
  const water = part.role === 'waterfront' && (wall.normal[2] < -0.12 || wall.normal[0] > 0.22);
  const low = part.role === 'canopy' ? high - 0.38 : overhang ? 9.65 : lower;
  const slot = gallery ? 'brick' : 'concrete';
  const tint = gallery ? c.ochre : water ? c.darkPanel : part.role === 'fly' ? c.pale : c.panel;
  face(
    out,
    slot,
    [wall.at(0, low), wall.at(w, low), wall.at(w, highB), wall.at(0, highA)],
    wall.normal,
    tint,
  );
  if (part.role === 'canopy') {
    if (front) panel(out, wall, 'steel', 0, w, high - 0.43, high, c.fascia, 0.035);
    return;
  }
  if (publicFoyer) glazedBand(out, wall, 0.25, high - 2.5, lod, true);
  if (publicGallery && w > 0.35) {
    panel(out, wall, 'brick', 0, w, 0.56, high - 3.6, c.ochre, 0.018);
    if (lod > 0) glazedBand(out, wall, high - 6.15, 1.41, lod);
  }
  if (water) glazedBand(out, wall, 1.13, Math.min(8.16, high - 2.4), lod);
  if (gallery && w > 1.3) {
    glazedBand(out, wall, 13.6, Math.min(2.06, high - 14.27), lod);
    if (lod > 0) {
      const bays = Math.max(1, Math.round(w / 7.9));
      for (let i = 0; i < bays; i++) {
        const a = (w * (i + 0.26)) / bays,
          b = (w * (i + 0.76)) / bays;
        for (const y of [4.7, 9.0]) panel(out, wall, 'glass', a, b, y, y + 1.48, c.glassDark, 0.03);
      }
    }
  }
  if (w > 0.4 && (front || water) && (publicFoyer || gallery || part.role === 'east')) {
    face(
      out,
      'steel',
      [
        wall.at(0, highA - 0.33, 0.075),
        wall.at(w, highB - 0.33, 0.075),
        wall.at(w, highB, 0.075),
        wall.at(0, highA, 0.075),
      ],
      wall.normal,
      c.fascia,
    );
  }
  if (lod < 2 || w < 0.95 || gallery || publicFoyer || water) return;
  const base = overhang ? 10.4 : Math.max(3.4, high - 16);
  for (let y = base; y < high - 0.72; y += lod === 3 ? 2.63 : 3.95)
    panel(out, wall, 'concrete', 0, w, y, y + 0.055, c.seam, 0.019);
  if (part.role === 'office' && w > 4.6) glazedBand(out, wall, high - 4.85, 1.76, lod);
}
function massing(out, lod) {
  for (const part of parts) {
    const { ring, ridge } = part;
    roof(out, part);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const facadeBreak = part.role === 'foyer' ? 28 : part.role === 'east' ? 63 : undefined;
      if (facadeBreak !== undefined && (a[0] - facadeBreak) * (b[0] - facadeBreak) < -0.0001) {
        const middle = [facadeBreak, lerp(a[1], b[1], (facadeBreak - a[0]) / (b[0] - a[0]))];
        outerWall(out, part, a, middle, lod);
        outerWall(out, part, middle, b, lod);
      } else if (ridge !== undefined && (a[1] - ridge) * (b[1] - ridge) < -0.0001) {
        const middle = [lerp(a[0], b[0], (ridge - a[1]) / (b[1] - a[1])), ridge];
        outerWall(out, part, a, middle, lod);
        outerWall(out, part, middle, b, lod);
      } else outerWall(out, part, a, b, lod);
    }
  }
}
function forecourt(out, lod) {
  const { postsX, z, top } = plan.section.forecourtScreen;
  const left = postsX[0],
    right = postsX.at(-1);
  box(out, 'brick', (left + right) / 2, top - 1.03, z, right - left + 1.1, 1.03, 1.31, c.orange);
  for (const x of postsX) {
    const base = ground(x, z);
    box(out, 'concrete', x, base - 0.27, z, 1.11, 0.96, 1.35, c.base);
    box(out, 'brick', x, base + 0.63, z, 0.98, top - base - 1.58, 1.18, c.orange);
  }
  const canopyZ = plan.section.canopyFrontZ;
  box(out, 'steel', 20.3, 12.41, canopyZ - 0.51, 70.0, 0.4, 2.4, c.fascia);
  if (lod > 0) {
    for (let x = -13.3; x < 53; x += 7.45) {
      box(out, 'steel', x, 0.05, canopyZ - 0.83, 0.25, 12.4, 0.25, c.steel);
      if (lod > 1)
        beam(
          out,
          'steel',
          [x, 12.5, canopyZ + 0.5],
          [x, 11.78, canopyZ - 2.12],
          0.13,
          0.14,
          c.paleSteel,
        );
    }
    for (let z = -5; z <= 13; z += 6) {
      beam(out, 'steel', [66.7, 20.05, z], [75.7, 20.65, z], 0.28, 0.28, c.paleSteel);
      if (lod > 1) beam(out, 'steel', [68.8, 16.0, z], [75.7, 20.65, z], 0.12, 0.12, c.steel);
    }
  }
  for (const [x, z] of plan.section.flyTowerPoints) {
    box(out, 'concrete', x, 29.93, z, 0.78, 2.53, 0.78, c.pale);
    if (lod > 0) {
      box(out, 'steel', x, 32.42, z, 0.27, 0.71, 0.27, c.paleSteel);
      if (lod > 1)
        beam(out, 'steel', [x - 0.39, 32.81, z], [x + 0.39, 32.81, z], 0.13, 0.13, c.steel);
    }
  }
}
function build(out, lod) {
  massing(out, lod);
  forecourt(out, lod);
}
export const operaSkyline = (out) => build(out, 0);
export const operaDistrict = (out) => build(out, 1);
export const operaStreet = (out) => build(out, 2);
export const operaCloseup = (out) => build(out, 3);

const recipe = 'gothenburg-opera-house-model.mjs',
  camera = [134, 77, 157],
  lookAt = [2, 14, -7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'operaDistrict', 0.52],
    ['street', 'operaStreet', 0.19],
    ['closeup', 'operaCloseup', 0.052],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const operaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: operaCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Gothenburg Opera House at Lilla Bommen, with an ochre public wing, concrete fly towers, glazed foyer, detached entrance frames and curved waterfront galleries.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Named OpenStreetMap opera-house footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'concrete_panel', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    {
      name: 'south-ochre-galleries-and-stage-tower',
      position: [-12, 26, 159],
      lookAt: [0, 14.0, 17],
    },
    {
      name: 'public-foyer-and-orange-entry-frames',
      position: [90, 13.5, 74],
      lookAt: [44, 12, 13],
    },
    {
      name: 'harbour-elevation-and-curving-roofs',
      position: [113, 58, -122],
      lookAt: [9, 10, -15],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-gothenburg-opera-house-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'operaSkyline',
    errorMeters: 1.11,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Two exact public-domain Qualla exterior photographs.',
};
