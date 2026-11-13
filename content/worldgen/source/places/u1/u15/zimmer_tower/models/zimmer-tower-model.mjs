/** The former Cornelius Tower at Zimmerplein, Lier, in March 2010. */
import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid'),
  [outline] = read('map-frame').geometry.polygons;
const { stoneBase, cornice, hipPeak, chimneyTop, finialTop, clockCenterY, clockRadius } =
  plan.section;
const corners = [2, 0, 4, 3].map((i) => outline[i]);
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.89, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.86, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.18 },
  paint: { slot: 'window', localRef: white, roughness: 0.72, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    brick: 'a56f58',
    darkBrick: '915c49',
    buff: 'c9c2a9',
    band: 'd2c4a3',
    stone: 'aba790',
    base: 'bab4a2',
    slate: '616a69',
    shadow: '373e39',
    glass: '526e66',
    green: '424f40',
    hatch: 'a44441',
    bronze: '817250',
    gold: 'c6a86a',
    dialDark: '343b3b',
    dialLight: 'c1ba9a',
    blue: '597582',
    trim: '575748',
    darkWood: '514333',
    metal: '4d5148',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const point = ([x, z], y) => [x, y, z];

function ground([x, z]) {
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

function face(out, slot, vertices, expected, tint) {
  let normal = normalFor(...vertices);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    vertices = [...vertices].reverse();
    normal = normalFor(...vertices);
  }
  if (vertices.length === 4) quad(out, slot, vertices, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      vertices,
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
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  return {
    a,
    b,
    length,
    normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}
function rect(out, wall, slot, a, b, low, high, color, depth = 0) {
  face(
    out,
    slot,
    [
      wall.at(a, low, depth),
      wall.at(b, low, depth),
      wall.at(b, high, depth),
      wall.at(a, high, depth),
    ],
    wall.normal,
    color,
  );
}
function band(out, wall, slot, y, h, color, depth) {
  rect(out, wall, slot, -depth, wall.length + depth, y, y + h, color, depth);
}
function window(out, wall, u, y, width, height, lod, cross = true) {
  const a = u - width / 2,
    b = u + width / 2;
  rect(out, wall, 'stone', a - 0.14, b + 0.14, y - 0.13, y + height + 0.13, c.band, 0.036);
  rect(out, wall, 'paint', a, b, y, y + height, c.glass, 0.06);
  if (lod === 0) return;
  for (const x of cross ? [a + 0.038, u, b - 0.038] : [a + 0.038, b - 0.038])
    rect(out, wall, 'stone', x - 0.037, x + 0.037, y, y + height, c.band, 0.085);
  for (const f of cross ? [0.09, 0.55, 0.94] : [0.09, 0.62, 0.94]) {
    const h = y + height * f;
    rect(out, wall, 'stone', a - 0.05, b + 0.05, h - 0.037, h + 0.037, c.band, 0.086);
  }
  if (lod > 1) rect(out, wall, 'stone', a - 0.2, b + 0.2, y - 0.13, y - 0.03, c.buff, 0.16);
}
function disk(out, wall, u, y, radius, d, count, tint) {
  const center = wall.at(u, y, d);
  const p = (i) => {
    const a = (2 * Math.PI * (i % count)) / count;
    return wall.at(u + radius * Math.cos(a), y + radius * Math.sin(a), d);
  };
  for (let i = 0; i < count; i++) face(out, 'paint', [center, p(i), p(i + 1)], wall.normal, tint);
}
function mark(out, wall, u, y, angle, start, stop, depth, width, tint) {
  const p = (r) => wall.at(u + r * Math.cos(angle), y + r * Math.sin(angle), depth);
  beam(out, 'iron', p(start), p(stop), width, 0.024, tint);
}
function clock(out, wall, lod) {
  const center = wall.length / 2,
    n = [24, 32, 48, 60][lod];
  disk(out, wall, center, clockCenterY, clockRadius, 0.058, n, c.dialDark);
  disk(out, wall, center, clockCenterY, clockRadius - 0.12, 0.074, n, c.bronze);
  for (let i = 0; i <= 12; i++) {
    const a = (2 * Math.PI * i) / 12 + Math.PI / 2;
    const r = i === 12 ? 0 : 1.57,
      u = center + r * Math.cos(a),
      y = clockCenterY + r * Math.sin(a);
    const dialRadius = i === 12 ? 0.73 : 0.34,
      count = i === 12 ? n : [8, 12, 16, 20][lod];
    disk(out, wall, u, y, dialRadius, 0.101, count, c.gold);
    disk(out, wall, u, y, dialRadius * 0.87, 0.12, count, i % 3 === 2 ? c.dialLight : c.dialDark);
    if (i === 0 || i === 6) {
      disk(out, wall, u, y, dialRadius * 0.83, 0.144, count, i === 0 ? c.gold : c.blue);
      if (lod > 1)
        disk(
          out,
          wall,
          u - 0.055,
          y + 0.065,
          dialRadius * 0.46,
          0.17,
          count,
          i === 0 ? c.dialLight : c.glass,
        );
      continue;
    }
    if (lod > 0) {
      const ticks = i === 12 || lod > 1 ? 12 : 4;
      for (let j = 0; j < ticks; j++) {
        mark(
          out,
          wall,
          u,
          y,
          (2 * Math.PI * j) / ticks,
          dialRadius * 0.66,
          dialRadius * 0.81,
          0.145,
          i === 12 ? 0.032 : 0.018,
          i % 3 === 2 ? c.dialDark : c.gold,
        );
      }
      mark(out, wall, u, y, 0.56 * i + 0.7, 0, dialRadius * 0.59, 0.155, 0.039, c.gold);
      mark(out, wall, u, y, 0.32 * i + 1.4, 0, dialRadius * 0.77, 0.172, 0.025, c.gold);
    }
  }
}
function doorway(out, wall, low, lod) {
  const u = wall.length / 2,
    w = 0.73,
    spring = low + 2.46,
    n = lod > 1 ? 12 : 6;
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const a = (i * Math.PI) / n;
    return [u - w * Math.cos(a), spring + 0.4 * Math.sin(a)];
  });
  const frame = [[u - w, low], ...arch, [u + w, low]];
  const inside = arch.map(([x, y]) => wall.at(x, y, 0.037));
  rect(out, wall, 'paint', u - w, u + w, low, spring, c.green, 0.037);
  for (let i = 1; i < n; i++)
    face(out, 'paint', [inside[0], inside[i], inside[i + 1]], wall.normal, c.green);
  beamPath(
    out,
    'stone',
    frame.map(([x, y]) => wall.at(x, y, 0.115)),
    0.22,
    0.2,
    c.stone,
  );
  if (lod > 0) {
    beamPath(
      out,
      'stone',
      frame.map(([x, y]) => wall.at(u + (x - u) * 1.22, y + (y - low) * 0.08, 0.093)),
      0.135,
      0.14,
      c.buff,
    );
    rect(out, wall, 'paint', u - 0.017, u + 0.017, low, spring + 0.38, c.shadow, 0.06);
    rect(out, wall, 'stone', u - 0.99, u + 0.99, spring + 0.52, spring + 0.66, c.band, 0.12);
    window(out, wall, u, spring + 0.73, 0.52, 0.59, lod, false);
  }
}
function sideBell(out, wall, u, lod) {
  const y = 11.55,
    left = u - 0.51,
    right = u + 0.51;
  rect(out, wall, 'paint', left, right, y, y + 1.28, c.shadow, 0.065);
  face(
    out,
    'slate',
    [
      wall.at(left - 0.08, y + 1.37),
      wall.at(right + 0.08, y + 1.37),
      wall.at(right + 0.08, y + 1.13, 0.46),
      wall.at(left - 0.08, y + 1.13, 0.46),
    ],
    up,
    c.darkWood,
  );
  if (lod > 0) {
    for (const x of [left, right])
      beam(
        out,
        'iron',
        wall.at(x, y + 0.73, 0.044),
        wall.at(x, y + 1.13, 0.44),
        0.07,
        0.06,
        c.trim,
      );
    rect(out, wall, 'iron', u - 0.21, u + 0.21, y + 0.26, y + 0.47, c.bronze, 0.1);
    rect(out, wall, 'iron', u - 0.13, u + 0.13, y + 0.47, y + 0.7, c.gold, 0.105);
  }
}

function shaft(out, lod) {
  for (let i = 0; i < 4; i++) {
    const wall = edge(corners[i], corners[(i + 1) % 4]),
      width = wall.length;
    const bottom = Math.min(ground(wall.a), ground(wall.b)) - 0.42;
    if (i === 0) {
      rect(out, wall, 'stone', 0, width, bottom, cornice, c.base);
      doorway(out, wall, ground([0, 3.64]) + 0.06, lod);
      window(out, wall, width * 0.3, 4.57, 0.55, 2.75, lod, false);
      window(out, wall, width * 0.7, 4.57, 0.55, 2.75, lod, false);
      clock(out, wall, lod);
    } else {
      rect(out, wall, 'stone', 0, width, bottom, stoneBase, c.base);
      rect(out, wall, 'brick', 0, width, stoneBase, cornice, i === 3 ? c.brick : c.darkBrick);
      for (const y of [stoneBase, 5.52, 6.92, 8.17, 9.52, 10.91, 12.13])
        band(out, wall, 'stone', y, 0.1, c.band, 0.027);
      for (const u of [width * 0.27, width * 0.73]) {
        window(out, wall, u, 6.01, 1.09, 2.55, lod);
        if (i === 3) sideBell(out, wall, u, lod);
        else window(out, wall, u, 10.22, 0.64, 1.74, lod, false);
        if (i !== 2) window(out, wall, u, 1.9, 0.62, 1.05, lod, false);
      }
      if (i === 3) {
        rect(out, wall, 'stone', width / 2 - 0.54, width / 2 + 0.54, 9.76, 10.91, c.buff, 0.051);
        rect(out, wall, 'paint', width / 2 - 0.43, width / 2 + 0.43, 9.87, 10.8, c.hatch, 0.07);
      }
      if (lod > 0)
        for (const x of [0, width]) {
          for (let y = stoneBase; y < cornice - 0.25; y += 0.36) {
            const span = Math.round((y - stoneBase) / 0.36) % 2 === 0 ? 0.23 : 0.33;
            rect(
              out,
              wall,
              'stone',
              x === 0 ? 0 : x - span,
              x === 0 ? span : x,
              y,
              y + 0.32,
              c.buff,
              0.037,
            );
          }
        }
    }
    band(out, wall, 'stone', 13.0, 0.23, c.band, 0.12);
    band(out, wall, 'iron', 13.23, 0.2, c.darkWood, 0.16);
    if (lod > 1)
      for (let u = 0.22; u < width - 0.1; u += 0.46)
        rect(out, wall, 'iron', u, u + 0.13, 12.85, 13.1, c.trim, 0.18);
  }
}

function hip(out, ring, low, high, tint) {
  for (let i = 0; i < ring.length; i++)
    face(
      out,
      'slate',
      [point(ring[i], low), point(ring[(i + 1) % ring.length], low), high],
      up,
      tint,
    );
}
function roofing(out, lod) {
  const cap = corners.map(([x, z]) => [x * 1.105, z * 1.082]);
  hip(out, cap, cornice, [0, hipPeak, 0], c.slate);
  box(out, 'stone', 0, hipPeak - 0.36, 0, 1.21, chimneyTop - hipPeak + 0.36, 0.88, c.stone);
  box(out, 'stone', 0, chimneyTop - 0.15, 0, 1.37, 0.15, 1.05, c.band);
  box(out, 'iron', 0, chimneyTop - 0.05, 0, 0.069, finialTop - chimneyTop + 0.05, 0.069, c.metal);
  for (const direction of [-1, 1]) {
    const curve = [
      [0, chimneyTop + 0.3, 0],
      [0.55 * direction, chimneyTop + 0.2, 0],
      [0.77 * direction, chimneyTop + 0.44, 0],
      [0.46 * direction, chimneyTop + 0.77, 0],
      [0, chimneyTop + 0.83, 0],
    ];
    if (lod > 0) beamPath(out, 'iron', curve, 0.047, 0.041, c.metal);
  }
  if (lod > 0)
    beam(
      out,
      'iron',
      [-0.36, finialTop - 0.41, 0],
      [0.5, finialTop - 0.41, 0],
      0.063,
      0.039,
      c.metal,
    );
}

function rearEntrance(out, lod) {
  const x = 0.86,
    z = -4.7,
    width = 2.68,
    span = 2.39;
  const base = ground([x, z - 1.57]),
    top = base + 1.19,
    eave = top + 2.04;
  const steps = lod > 0 ? 8 : 4;
  for (let i = 0; i < steps; i++) {
    const depth = (span * (steps - i)) / steps;
    box(
      out,
      'stone',
      x,
      base - 0.07,
      z + span / 2 - depth / 2,
      1.82,
      ((top - base + 0.07) * (i + 1)) / steps,
      depth,
      c.stone,
    );
  }
  const rear = edge(corners[2], corners[3]),
    u = rear.length / 2 + x;
  rect(out, rear, 'paint', u - 0.62, u + 0.62, top, top + 2.14, c.green, 0.044);
  for (const dx of [-1, 1]) {
    box(
      out,
      'stone',
      x + dx * (width / 2 - 0.11),
      base - 0.1,
      z - 0.92,
      0.24,
      eave - base + 0.16,
      0.24,
      c.stone,
    );
    if (lod > 1)
      box(
        out,
        'stone',
        x + dx * (width / 2 - 0.11),
        eave - 0.2,
        z - 0.92,
        0.34,
        0.22,
        0.34,
        c.band,
      );
  }
  const ring = [
    [x - width / 2, z - span / 2],
    [x + width / 2, z - span / 2],
    [x + width / 2, z + span / 2],
    [x - width / 2, z + span / 2],
  ];
  hip(out, ring, eave, [x, eave + 0.8, z + 0.13], c.slate);
}
function build(out, lod) {
  shaft(out, lod);
  roofing(out, lod);
  rearEntrance(out, lod);
}
export const towerSkyline = (out) => build(out, 0);
export const towerDistrict = (out) => build(out, 1);
export const towerStreet = (out) => build(out, 2);
export const towerCloseup = (out) => build(out, 3);
const recipe = 'zimmer-tower-model.mjs',
  camera = [16, 12, 26],
  lookAt = [0, 9.1, -0.7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'towerDistrict', 0.31],
    ['street', 'towerStreet', 0.11],
    ['closeup', 'towerCloseup', 0.033],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const towerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: towerCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The sandstone Jubilee Clock façade, brick-and-stone side elevations and slate tent roof of the former Cornelius Tower in Lier.',
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
    minimumCoverage: 0.92,
    basis: 'Named OpenStreetMap Zimmertoren footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'stone_sandstone_raw', 'slate', 'metal_painted'],
  qaCameras: [
    { name: 'jubilee-clock-and-sandstone-door', position: [10, 7.5, 26], lookAt: [0, 9.05, 2.5] },
    { name: 'brick-side-and-bell-hatches', position: [21, 9, 1.5], lookAt: [1.1, 8.3, 0] },
    {
      name: 'rear-sheltered-stair-and-slate-roof',
      position: [13, 12, -24],
      lookAt: [0, 8.75, -1.85],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-zimmer-tower-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'towerSkyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Three exact public-domain Qualla exterior photographs.',
};
