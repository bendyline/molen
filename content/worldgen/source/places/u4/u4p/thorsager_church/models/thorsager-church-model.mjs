/** Romanesque round church and surviving additions, Thorsager, April 2009. */
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
const { nave, belfry, porch, chancel, apse, west } = plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.77, metallic: 0.23 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.16 },
  glass: { slot: 'window', localRef: white, roughness: 0.53, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    brick: 'b57454',
    oldBrick: 'a66a50',
    band: '985f48',
    lighterBrick: 'c17d58',
    sill: 'a99982',
    plinth: '8b8272',
    roof: 'a5a9a7',
    seam: '858d8b',
    ridge: '8d9492',
    glass: '4e514b',
    shade: '302d29',
    wood: '593c2a',
    iron: '555b57',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const midpoint = (a, b) => a.map((v, i) => (v + b[i]) / 2);

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    mix(mix(a[i], a[i + 1], dx), mix(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
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
const atHeight = ([x, z], y) => [x, y, z];

function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length,
    normal = [uz, 0, -ux];
  return {
    a,
    b,
    length,
    normal,
    at: (u, y, depth = 0) => [a[0] + ux * u + uz * depth, y, a[1] + uz * u - ux * depth],
  };
}
function rectangle(out, wall, slot, a, b, low, high, color, depth = 0) {
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
function masonry(out, wall, top, color, base = Math.min(ground(wall.a), ground(wall.b)) - 0.55) {
  rectangle(out, wall, 'brick', 0, wall.length, base, top, color);
}
function foundation(out, wall, height = 0.26) {
  const a = ground(wall.a),
    b = ground(wall.b);
  face(
    out,
    'stone',
    [
      wall.at(0, a - 0.27, 0.025),
      wall.at(wall.length, b - 0.27, 0.025),
      wall.at(wall.length, b + height, 0.025),
      wall.at(0, a + height, 0.025),
    ],
    wall.normal,
    c.plinth,
  );
}

function arch(out, wall, u, bottom, width, height, lod, { doorway = false, wallTop = 0 } = {}) {
  const radius = width / 2,
    spring = bottom + height - radius;
  const segments = lod > 1 ? 10 : 5,
    left = u - radius,
    right = u + radius;
  const depth = doorway ? -0.23 : 0.017,
    trim = doorway ? 0.08 : 0.047;
  const curve = Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (Math.PI * i) / segments;
    return [u - radius * Math.cos(angle), spring + radius * Math.sin(angle)];
  });
  rectangle(out, wall, 'glass', left, right, bottom, spring, doorway ? c.wood : c.glass, depth);
  const arc = curve.map(([x, y]) => wall.at(x, y, depth));
  for (let i = 1; i < segments; i++)
    face(out, 'glass', [arc[0], arc[i], arc[i + 1]], wall.normal, doorway ? c.wood : c.glass);
  if (doorway) {
    const base = Math.min(ground(wall.a), ground(wall.b)) - 0.56;
    rectangle(out, wall, 'brick', 0, left, base, wallTop, c.brick);
    rectangle(out, wall, 'brick', right, wall.length, base, wallTop, c.brick);
    rectangle(out, wall, 'stone', left, right, base, bottom, c.sill);
    for (let i = 0; i < segments; i++) {
      const [a, y] = curve[i],
        [b, z] = curve[i + 1];
      face(
        out,
        'brick',
        [wall.at(a, y), wall.at(b, z), wall.at(b, wallTop), wall.at(a, wallTop)],
        wall.normal,
        c.brick,
      );
      face(out, 'brick', [arc[i], arc[i + 1], wall.at(b, z), wall.at(a, y)], [0, -1, 0], c.band);
    }
    for (const a of [left, right]) {
      const normal = wall.at(u, 0).map((value, i) => value - wall.at(a, 0)[i]);
      face(
        out,
        'brick',
        [
          wall.at(a, bottom),
          wall.at(a, spring),
          wall.at(a, spring, depth),
          wall.at(a, bottom, depth),
        ],
        normal,
        c.band,
      );
    }
    if (lod > 1)
      for (let i = -3; i <= 3; i++) {
        const x = u + (i * width) / 8;
        rectangle(out, wall, 'glass', x - 0.008, x + 0.008, bottom, spring, c.shade, depth + 0.01);
      }
  }
  if (lod > 0) {
    beamPath(
      out,
      doorway ? 'brick' : 'stone',
      curve.map(([x, y]) => wall.at(x, y, trim)),
      doorway ? 0.19 : 0.075,
      0.075,
      doorway ? c.lighterBrick : c.band,
    );
    if (!doorway)
      rectangle(
        out,
        wall,
        'stone',
        left - 0.09,
        right + 0.09,
        bottom - 0.09,
        bottom,
        c.sill,
        0.045,
      );
  }
}

function gable(out, corners, eave, ridge, axis, lod, isPorch = false) {
  const ends = axis === 'x' ? [1, 3] : [0, 2];
  const mid = ends.map((i) => midpoint(corners[i], corners[(i + 1) % 4]));
  const roofCenter = midpoint(mid[0], mid[1]);
  const roofCorners = corners.map((p) => p.map((v, i) => v + (v - roofCenter[i]) * 0.048));
  const roofPeaks = ends.map((i) => midpoint(roofCorners[i], roofCorners[(i + 1) % 4]));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      wall = edge(corners[i], corners[j]),
      end = ends.indexOf(i);
    if (isPorch && i === 1) {
      const threshold = ground(midpoint(wall.a, wall.b)) + 0.08;
      arch(out, wall, wall.length / 2, threshold, 1.47, 2.52, lod, {
        doorway: true,
        wallTop: eave,
      });
    } else {
      masonry(out, wall, eave, i % 2 ? c.brick : c.oldBrick);
      if (lod > 0) foundation(out, wall);
    }
    if (end >= 0) {
      face(
        out,
        'brick',
        [wall.at(0, eave), wall.at(wall.length, eave), atHeight(mid[end], ridge)],
        wall.normal,
        c.brick,
      );
      if (lod > 0)
        beamPath(
          out,
          'roof',
          [
            atHeight(roofCorners[i], eave),
            atHeight(roofPeaks[end], ridge),
            atHeight(roofCorners[j], eave),
          ],
          0.11,
          0.14,
          c.ridge,
        );
      continue;
    }
    const a = roofCorners[i],
      b = roofCorners[j];
    const near = roofPeaks.find(
      (p) => Math.hypot(a[0] - p[0], a[1] - p[1]) < Math.hypot(b[0] - p[0], b[1] - p[1]),
    );
    const far = roofPeaks.find((p) => p !== near);
    face(
      out,
      'roof',
      [atHeight(a, eave), atHeight(b, eave), atHeight(far, ridge), atHeight(near, ridge)],
      up,
      c.roof,
    );
    if (lod > 1) {
      const count = Math.ceil(wall.length / (lod === 3 ? 0.66 : 1.1));
      for (let n = 1; n < count; n++) {
        const f = n / count;
        const along = (p, q, y) => [mix(p[0], q[0], f), y + 0.021, mix(p[1], q[1], f)];
        beam(out, 'roof', along(a, b, eave), along(near, far, ridge), 0.032, 0.024, c.seam);
      }
    }
    if (lod > 0 && !isPorch) {
      const u = wall.length * 0.57,
        base = ground(midpoint(wall.a, wall.b)) + 1.75;
      arch(out, wall, u, base, 0.69, 1.6, lod);
    }
  }
  if (lod > 0)
    beam(out, 'roof', ...roofPeaks.map((p) => atHeight(p, ridge + 0.025)), 0.14, 0.13, c.ridge);
}

function roundNave(out, lod) {
  const count = [20, 32, 52, 64][lod],
    [cx, cz] = nave.center;
  const angles = Array.from({ length: count + 1 }, (_, i) => (2 * Math.PI * (i % count)) / count);
  const ring = (a, radius, y) => [cx + radius * Math.cos(a), y, cz + radius * Math.sin(a)];
  const section = [
    [nave.radius + 0.25, nave.eave],
    [nave.radius * 0.8, nave.eave + 0.78],
    [nave.radius * 0.52, nave.eave + 1.43],
    [2.06, nave.lanternBase + 0.11],
  ];
  const windowEdges = [
    Math.round(count * 0.2),
    Math.round(count * 0.36),
    Math.round(count * 0.63),
    Math.round(count * 0.81),
  ];
  for (let i = 0; i < count; i++) {
    const a = angles[i],
      b = angles[i + 1];
    const wall = edge(
      ...[a, b].map((v) => {
        const [x, , z] = ring(v, nave.radius, 0);
        return [x, z];
      }),
    );
    masonry(out, wall, nave.eave + 0.015, i % 7 < 2 ? c.oldBrick : c.brick);
    rectangle(out, wall, 'brick', 0, wall.length, nave.eave - 0.21, nave.eave, c.band, 0.042);
    if (lod > 0) {
      foundation(out, wall);
      if (windowEdges.includes(i))
        arch(
          out,
          wall,
          wall.length / 2,
          ground(midpoint(wall.a, wall.b)) + 2.88,
          Math.min(0.88, wall.length * 0.83),
          2.18,
          lod,
        );
    }
    for (let j = 0; j < section.length - 1; j++) {
      const [p, q] = [section[j], section[j + 1]];
      face(out, 'roof', [ring(a, ...p), ring(b, ...p), ring(b, ...q), ring(a, ...q)], up, c.roof);
    }
    if (lod > 1 && i % 2 === 0)
      beamPath(
        out,
        'roof',
        section.map(([r, y]) => ring(a, r, y + 0.024)),
        0.029,
        0.025,
        c.seam,
      );
  }
}

function bellTower(out, lod) {
  const [x, z] = belfry.center,
    r = belfry.width / 2,
    bottom = nave.lanternBase - 0.67;
  const corners = [
    [x - r, z - r],
    [x + r, z - r],
    [x + r, z + r],
    [x - r, z + r],
  ];
  const cap = corners.map(([a, b]) => [x + 1.1 * (a - x), z + 1.1 * (b - z)]);
  const apex = [x, belfry.peak, z];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      wall = edge(corners[i], corners[j]),
      mid = wall.length / 2;
    const opening = 0.68,
      sill = nave.lanternBase + 0.41,
      lintel = belfry.eave - 0.33;
    rectangle(out, wall, 'brick', 0, wall.length, bottom, sill, c.brick);
    rectangle(out, wall, 'brick', 0, mid - opening, sill, lintel, c.brick);
    rectangle(out, wall, 'brick', mid + opening, wall.length, sill, lintel, c.brick);
    rectangle(out, wall, 'brick', 0, wall.length, lintel, belfry.eave, c.oldBrick);
    rectangle(out, wall, 'glass', mid - opening, mid + opening, sill, lintel, c.shade, -0.27);
    if (lod > 0) {
      rectangle(
        out,
        wall,
        'stone',
        mid - opening - 0.07,
        mid + opening + 0.07,
        sill - 0.1,
        sill,
        c.sill,
        0.06,
      );
      rectangle(out, wall, 'iron', mid - 0.049, mid + 0.049, sill, lintel, c.iron, -0.07);
    }
    const a = atHeight(cap[i], belfry.eave),
      b = atHeight(cap[j], belfry.eave);
    face(out, 'roof', [a, b, apex], up, c.roof);
    if (lod > 1) {
      beam(out, 'roof', a, apex, 0.059, 0.067, c.ridge);
      for (let k = 1; k < 7; k++) {
        const f = k / 7;
        beam(
          out,
          'roof',
          [mix(a[0], b[0], f), a[1] + 0.023, mix(a[2], b[2], f)],
          [x, apex[1] + 0.016, z],
          0.021,
          0.018,
          c.seam,
        );
      }
    }
  }
  box(out, 'iron', x, belfry.peak - 0.06, z, 0.085, 0.63, 0.085, c.iron);
  if (lod > 0)
    beam(
      out,
      'iron',
      [x - 0.23, belfry.peak + 0.43, z],
      [x + 0.23, belfry.peak + 0.43, z],
      0.046,
      0.039,
      c.iron,
    );
}

function curvedApse(out, lod) {
  const arc = apse.mappedArc.map((i) => outline[i]);
  const join = midpoint(arc[0], arc.at(-1)),
    peak = atHeight([join[0] - 0.24, join[1]], apse.peak);
  const expanded = arc.map((p) => p.map((v, i) => join[i] + (v - join[i]) * 1.12));
  for (let i = 0; i < arc.length - 1; i++) {
    const wall = edge(arc[i], arc[i + 1]);
    masonry(out, wall, apse.eave, i % 2 ? c.oldBrick : c.brick);
    rectangle(out, wall, 'brick', 0, wall.length, apse.eave - 0.26, apse.eave, c.band, 0.039);
    face(
      out,
      'roof',
      [atHeight(expanded[i], apse.eave), atHeight(expanded[i + 1], apse.eave), peak],
      up,
      c.roof,
    );
    if (lod > 0) foundation(out, wall);
    if (lod > 0 && i === 2)
      arch(out, wall, wall.length / 2, ground(midpoint(wall.a, wall.b)) + 1.9, 0.47, 1.16, lod);
    if (lod > 1)
      beam(out, 'roof', atHeight(expanded[i], apse.eave + 0.026), peak, 0.026, 0.022, c.seam);
  }
}

const rectangular = ({ west: w, east, north, south }) => [
  [w, north],
  [east, north],
  [east, south],
  [w, south],
];
function build(out, lod) {
  roundNave(out, lod);
  bellTower(out, lod);
  const porchCorners = porch.mappedCorners.map((i) => outline[i]);
  gable(out, porchCorners, porch.eave, porch.ridge, 'x', lod, true);
  gable(out, rectangular(chancel), chancel.eave, chancel.ridge, 'x', lod);
  curvedApse(out, lod);
  gable(out, rectangular(west), west.eave, west.ridge, 'x', lod);
  const porchPeak = midpoint(porchCorners[1], porchCorners[2]);
  for (const [x, z, y, w, h] of [
    [porchPeak[0], porchPeak[1] - 0.32, porch.ridge - 0.29, 0.55, 1.23],
    [west.west + 0.63, (west.north + west.south) / 2, west.ridge - 0.41, 0.49, 1.65],
  ]) {
    box(out, 'brick', x, y, z, w, h, w * 0.86, c.oldBrick);
    if (lod > 0) box(out, 'brick', x, y + h - 0.12, z, w + 0.12, 0.12, w * 0.86 + 0.09, c.band);
  }
}
export const churchSkyline = (out) => build(out, 0);
export const churchDistrict = (out) => build(out, 1);
export const churchStreet = (out) => build(out, 2);
export const churchCloseup = (out) => build(out, 3);

const recipe = 'thorsager-church-model.mjs',
  camera = [32, 17, 37],
  lookAt = [4.5, 6.0, -2.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'churchDistrict', 0.33],
    ['street', 'churchStreet', 0.12],
    ['closeup', 'churchCloseup', 0.035],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const churchModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: churchCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'A round brick Romanesque nave with a swept silver-gray roof and square belfry. The eastern chancel and curved apse, south porch and low west tower block follow the mapped church outline.',
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
    basis: 'Named OpenStreetMap Thorsager Kirke footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'stone_sandstone_raw', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'south-porch-and-round-nave', position: [5, 5.8, 31], lookAt: [3.4, 6.8, 1] },
    { name: 'east-chancel-and-apse', position: [37, 8, 10], lookAt: [8.5, 6.7, -4] },
    { name: 'west-block-and-belfry', position: [-22, 12.4, -24], lookAt: [2.7, 6.0, -3.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-thorsager-church-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'churchSkyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Two exact public-domain Qualla exterior photographs.',
};
