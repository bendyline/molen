/** The andesite cathedral, attached Hatherly Hall and memorial in July 2024. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const { blocks, floor, memorial } = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const terrain = read('terrain-grid');
const up = [0, 1, 0],
  white = 'palette:#ffffff';
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.93, metallic: 0 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.12 },
  glass: { slot: 'window', localRef: white, roughness: 0.52, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    masonry: '979da4',
    darkStone: '838a93',
    opening: '373f49',
    glass: '4c5763',
    lightGlass: '6b7e8d',
    slate: '848587',
    verge: '746659',
    timber: '62564d',
    red: '774746',
    trim: '89877e',
    base: '777974',
    cross: 'a49989',
    crossBase: '847b6e',
    bell: '565047',
    gold: 'b9a780',
  }).map(([key, value]) => [key, rgb(value)]),
);

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const dx = u - i,
    dz = v - j,
    a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, wanted, color) {
  let normal = normalFor(...points);
  if (normal.some((n) => !Number.isFinite(n))) throw Error('Invalid surface normal');
  if (normal.reduce((sum, value, i) => sum + value * wanted[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
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
      color,
    );
}

function wallFrame(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  const ux = dx / length,
    uz = dz / length,
    normal = [uz, 0, -ux];
  return {
    length,
    normal,
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}

function panel(out, wall, slot, ring, holes, color, depth = 0) {
  const vertices = [...ring, ...holes.flat()];
  let offset = ring.length;
  const cuts = holes.map((hole) => {
    const start = offset;
    offset += hole.length;
    return start;
  });
  const indices = earcut(vertices.flat(), cuts);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => vertices[index]);
    if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) < 1e-8) continue;
    face(
      out,
      slot,
      [a, b, c].map(([u, y]) => wall.at(u, y, depth)),
      wall.normal,
      color,
    );
  }
}

const rect = (left, bottom, right, top) => [
  [left, bottom],
  [right, bottom],
  [right, top],
  [left, top],
];

function lancet(center, bottom, width, height, lod) {
  const left = center - width / 2,
    right = center + width / 2;
  const spring = bottom + height - width * 0.83;
  if (lod < 2)
    return [
      [left, bottom],
      [right, bottom],
      [right, spring],
      [center, bottom + height],
      [left, spring],
    ];
  const segments = lod === 2 ? 3 : 5,
    ring = [
      [left, bottom],
      [right, bottom],
    ];
  for (let i = 0; i <= segments; i++) {
    const angle = ((Math.PI / 3) * i) / segments;
    ring.push([left + width * Math.cos(angle), spring + width * Math.sin(angle)]);
  }
  for (let i = segments - 1; i >= 0; i--) {
    const angle = ((Math.PI / 3) * i) / segments;
    ring.push([right - width * Math.cos(angle), spring + width * Math.sin(angle)]);
  }
  return ring;
}

function opening(out, wall, data, ring, lod) {
  const [u, bottom, width, height, kind] = data,
    depth = lod > 1 ? -0.19 : -0.035;
  const isDoor = kind === 'door' || kind === 'red';
  panel(
    out,
    wall,
    isDoor ? 'timber' : 'glass',
    ring,
    [],
    colors[
      kind === 'red'
        ? 'red'
        : kind === 'door'
          ? 'timber'
          : kind === 'light'
            ? 'lightGlass'
            : 'opening'
    ],
    depth,
  );
  if (lod < 2) return;
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]];
    const points = [wall.at(...a), wall.at(...b), wall.at(...b, depth), wall.at(...a, depth)];
    quad(out, 'trim', points, normalFor(...points), colors.darkStone);
  }
  if (kind !== 'red') {
    beamPath(
      out,
      'trim',
      ring.map((point) => wall.at(...point, 0.02)),
      0.13,
      0.11,
      colors.trim,
      true,
    );
  }
  if (kind === 'red') {
    const [left, right] = [u - width / 2, u + width / 2];
    panel(
      out,
      wall,
      'trim',
      rect(left - 0.13, bottom + height, right + 0.13, bottom + height + 0.16),
      [],
      colors.trim,
      0.045,
    );
    for (const fraction of [-0.32, 0, 0.32]) {
      const center = u + width * fraction;
      panel(
        out,
        wall,
        'glass',
        rect(center - 0.16, bottom + 0.57, center + 0.16, bottom + height - 0.26),
        [],
        colors.glass,
        depth + 0.018,
      );
    }
  } else if (!isDoor) {
    const start = bottom + 0.08,
      top = bottom + height - width * 0.48;
    beam(
      out,
      'metal',
      wall.at(u, start, depth + 0.03),
      wall.at(u, top, depth + 0.03),
      0.045,
      0.035,
      colors.darkStone,
    );
    if (lod === 3) {
      for (const fraction of [0.35, 0.62]) {
        const y = bottom + height * fraction;
        beam(
          out,
          'metal',
          wall.at(u - width * 0.46, y, depth + 0.03),
          wall.at(u + width * 0.46, y, depth + 0.03),
          0.026,
          0.03,
          colors.darkStone,
        );
      }
    }
  }
}

function buttress(out, wall, u, lod, height) {
  const rectangularRing = (y, width, projection) => [
    wall.at(u - width / 2, y, -0.03),
    wall.at(u + width / 2, y, -0.03),
    wall.at(u + width / 2, y, projection),
    wall.at(u - width / 2, y, projection),
  ];
  const base = wall.at(u, 0, 0.3),
    bottom = Math.min(-0.2, ground(base[0], base[2]) - 0.2);
  loft(
    out,
    'masonry',
    [
      rectangularRing(bottom, 0.78, 0.7),
      rectangularRing(height * 0.49, 0.75, 0.67),
      rectangularRing(height * 0.6, 0.68, 0.47),
      rectangularRing(height * 0.89, 0.64, 0.42),
      rectangularRing(height, 0.62, 0.11),
    ],
    colors.darkStone,
  );
  if (lod >= 2) {
    for (const [y, width, projection] of [
      [height * 0.51, 0.81, 0.73],
      [height * 0.91, 0.72, 0.48],
    ]) {
      loft(
        out,
        'trim',
        [
          rectangularRing(y - 0.1, width, projection),
          rectangularRing(y + 0.04, width, projection - 0.09),
        ],
        colors.trim,
      );
    }
  }
}

function buildingWall(out, a, b, block, index, lod) {
  const wall = wallFrame(a, b),
    length = wall.length;
  const [ax, az] = a,
    [bx, bz] = b;
  const baseA = Math.min(floor - 0.32, ground(ax, az) - 0.34);
  const baseB = Math.min(floor - 0.32, ground(bx, bz) - 0.34);
  const gable = block.axis === 'x' ? index % 2 === 1 : index % 2 === 0;
  const outer = [
    [0, baseA],
    [length, baseB],
    [length, block.eave],
    ...(gable ? [[length / 2, block.ridge]] : []),
    [0, block.eave],
  ];
  const windows = [];
  if (block.name === 'nave' && index === 3) windows.push([length / 2, 3.0, 1.6, 4.62, 'lancet']);
  if (block.name === 'nave' && index === 0) {
    for (const u of [1.5, 8.6, 11.72, 14.35]) windows.push([u, 2.14, 0.82, 2.47, 'lancet']);
  }
  if (block.name === 'north-transept' && index === 0) {
    windows.push([length / 2, 2.55, 2.16, 5.55, 'lancet']);
  }
  if (block.name === 'north-chapel' && index === 0) {
    windows.push([length / 2, 2.44, 1.53, 4.22, 'lancet']);
  }
  if (block.name === 'south-aisle' && index === 2) {
    for (const u of [2.2, 7.6, 11.5, 16.0, 19.8]) windows.push([u, 2.22, 0.75, 2.04, 'lancet']);
  }
  if (block.name === 'hatherly-front' && index === 3) {
    windows.push(
      [length * 0.74, 2.49, 0.68, 3.07, 'light'],
      [length * 0.31, 2.04, 2.31, 1.99, 'red'],
    );
  }
  if (block.name === 'north-porch' && index === 0)
    windows.push([length / 2, 0.11, 1.55, 2.63, 'door']);
  const rings =
    lod > 0
      ? windows.map(([u, y, w, h, k]) =>
          k === 'red' ? rect(u - w / 2, y, u + w / 2, y + h) : lancet(u, y, w, h, lod),
        )
      : [];
  panel(out, wall, 'masonry', outer, rings, index === 3 ? colors.darkStone : colors.masonry);
  if (lod === 0) {
    for (const [u, y, w, h, k] of windows) {
      panel(
        out,
        wall,
        'glass',
        k === 'red' ? rect(u - w / 2, y, u + w / 2, y + h) : lancet(u, y, w, h, lod),
        [],
        colors[k === 'red' ? 'red' : 'opening'],
        0.016,
      );
    }
  } else {
    windows.forEach((window, i) => {
      opening(out, wall, window, rings[i], lod);
    });
  }
  if (block.name === 'nave' && index === 3) {
    const y = block.ridge - 1.48,
      half = ((length * (block.ridge - y)) / (block.ridge - block.eave)) * 0.48;
    panel(
      out,
      wall,
      'timber',
      [
        [length / 2 - half, y],
        [length / 2 + half, y],
        [length / 2, block.ridge - 0.1],
      ],
      [],
      colors.timber,
      0.024,
    );
  }
  if (lod > 0 && block.name === 'nave') {
    if (index === 3) {
      buttress(out, wall, 0.57, lod, 4.16);
      buttress(out, wall, length - 0.57, lod, 4.16);
    }
    if (index === 0) {
      for (const u of [0.6, 7.0, 10.1, 15.2]) buttress(out, wall, u, lod, 3.83);
    }
  }
  if (lod >= 2 && ['nave', 'north-transept', 'south-aisle'].includes(block.name)) {
    const stripY = block.name === 'south-aisle' ? 2.03 : 1.37;
    const bottom = Math.max(stripY, Math.min(ground(ax, az), ground(bx, bz)) + 0.31);
    panel(
      out,
      wall,
      'trim',
      rect(0.02, bottom, length - 0.02, bottom + 0.11),
      [],
      colors.base,
      0.03,
    );
  }
}

function gabledRoof(out, axis, bounds, eave, ridge, lod) {
  const [x, a, z, b] = bounds,
    center = axis === 'x' ? (z + b) / 2 : (x + a) / 2;
  const points =
    axis === 'x'
      ? [
          [x, eave, z],
          [a, eave, z],
          [x, ridge, center],
          [a, ridge, center],
          [x, eave, b],
          [a, eave, b],
        ]
      : [
          [x, eave, z],
          [x, eave, b],
          [center, ridge, z],
          [center, ridge, b],
          [a, eave, z],
          [a, eave, b],
        ];
  face(out, 'roof', [points[0], points[1], points[3], points[2]], up, colors.slate);
  face(out, 'roof', [points[2], points[3], points[5], points[4]], up, colors.slate);
  if (lod > 0) {
    beam(out, 'roof', points[2], points[3], 0.14, 0.09, colors.slate);
    for (const indices of [
      [0, 2, 4],
      [1, 3, 5],
    ]) {
      beamPath(
        out,
        'timber',
        indices.map((index) => points[index]),
        0.16,
        0.16,
        colors.verge,
      );
    }
  }
  if (lod > 1) {
    beam(out, 'timber', points[0], points[1], 0.11, 0.15, colors.verge);
    beam(out, 'timber', points[4], points[5], 0.11, 0.15, colors.verge);
  }
}

function buildBlock(out, block, lod) {
  const [x, a, z, b] = block.bounds,
    ring = [
      [x, z],
      [a, z],
      [a, b],
      [x, b],
    ];
  for (let i = 0; i < ring.length; i++)
    buildingWall(out, ring[i], ring[(i + 1) % ring.length], block, i, lod);
  const e = block.name === 'north-porch' ? 0.09 : 0.16;
  gabledRoof(
    out,
    block.axis,
    [x - e, a + e, z - e, b + e],
    block.eave + 0.04,
    block.ridge + 0.08,
    lod,
  );
}

function sanctuary(out, lod) {
  const ring = [...outline.slice(7, 13), [16.8, -1.4], [16.8, -9.1]];
  const center = [17.41, 8.67, -5.15],
    eave = 5.55;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      wall = wallFrame(a, b);
    const bottomA = Math.min(-0.24, ground(...a) - 0.25),
      bottomB = Math.min(-0.24, ground(...b) - 0.25);
    const outer = [
      [0, bottomA],
      [wall.length, bottomB],
      [wall.length, eave],
      [0, eave],
    ];
    const light = [wall.length / 2, 1.99, Math.min(1.35, wall.length * 0.52), 2.76, 'lancet'];
    const window = lancet(...light.slice(0, 4), lod);
    panel(out, wall, 'masonry', outer, lod > 0 && i < 5 ? [window] : [], colors.darkStone);
    if (lod > 0 && i < 5) opening(out, wall, light, window, lod);
    face(out, 'roof', [[a[0], eave, a[1]], [b[0], eave, b[1]], center], up, colors.slate);
  }
}

function bellcote(out, lod) {
  const x = 9.67,
    z = 9.27,
    base = 9.1,
    top = 11.27;
  for (const xx of [x - 0.41, x + 0.41]) {
    for (const zz of [z - 0.46, z + 0.46]) {
      box(out, 'timber', xx, base, zz, 0.13, top - base, 0.13, colors.timber);
    }
  }
  gabledRoof(out, 'x', [x - 0.61, x + 0.63, z - 0.61, z + 0.61], top, top + 0.92, lod);
  const sides = lod < 2 ? 8 : 16;
  loft(
    out,
    'metal',
    [
      radialRing(10.31, 0.34, 0.34, sides, [x, z]),
      radialRing(10.42, 0.29, 0.29, sides, [x, z]),
      radialRing(10.79, 0.18, 0.18, sides, [x, z]),
      radialRing(10.89, 0.13, 0.13, sides, [x, z]),
    ],
    colors.bell,
  );
  if (lod > 1)
    beam(out, 'timber', [x - 0.45, 10.94, z], [x + 0.45, 10.94, z], 0.14, 0.13, colors.timber);
}

function memorialCross(out, lod) {
  const { x, z, height } = memorial,
    y = ground(x, z);
  const platform = (elevation, width, depth) => [
    [x - width / 2, elevation, z - depth / 2],
    [x - width / 2, elevation, z + depth / 2],
    [x + width / 2, elevation, z + depth / 2],
    [x + width / 2, elevation, z - depth / 2],
  ];
  loft(
    out,
    'trim',
    [
      platform(y - 0.22, 2.39, 1.88),
      platform(y + 0.15, 2.39, 1.88),
      platform(y + 0.17, 2.13, 1.64),
      platform(y + 0.39, 2.13, 1.64),
      platform(y + 0.53, 1.7, 1.29),
      platform(y + 0.66, 1.47, 1.14),
      platform(y + 0.99, 1.28, 1.02),
      platform(y + 1.2, 0.81, 0.71),
    ],
    colors.crossBase,
  );
  const left = x - 0.88,
    right = x + 0.88;
  const wall = wallFrame([left, z - 0.16], [right, z - 0.16]);
  const profile = [
    [0.65, 1.19],
    [1.11, 1.19],
    [1.12, 2.86],
    [1.17, 3.02],
    [1.28, 3.04],
    [1.63, 3.04],
    [1.63, 3.39],
    [1.28, 3.39],
    [1.17, 3.44],
    [1.11, 3.59],
    [1.08, height - 0.08],
    [0.7, height],
    [0.65, height - 0.12],
    [0.65, 3.59],
    [0.58, 3.44],
    [0.46, 3.39],
    [0.13, 3.39],
    [0.13, 3.04],
    [0.46, 3.04],
    [0.59, 3.02],
    [0.64, 2.86],
  ].map(([u, h]) => [u, y + h]);
  panel(out, wall, 'trim', profile, [], colors.cross);
  const back = wallFrame([right, z + 0.16], [left, z + 0.16]);
  panel(
    out,
    back,
    'trim',
    profile.map(([u, h]) => [1.76 - u, h]),
    [],
    colors.cross,
  );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    const pts = [wall.at(...a), wall.at(...b), wall.at(...b, -0.32), wall.at(...a, -0.32)];
    quad(out, 'trim', pts, normalFor(...pts), colors.crossBase);
  }
  if (lod > 1) {
    for (const [u, v, radius] of [
      [0.88, 3.21, 0.13],
      [0.32, 3.22, 0.09],
      [1.43, 3.22, 0.09],
      [0.88, 2.84, 0.1],
      [0.88, 3.68, 0.1],
    ]) {
      const circle = Array.from({ length: 9 }, (_, i) => {
        const angle = (2 * Math.PI * i) / 9;
        return wall.at(u + radius * Math.cos(angle), y + v + radius * Math.sin(angle), 0.014);
      });
      beamPath(out, 'trim', circle, 0.024, 0.023, colors.crossBase, true);
    }
  }
}

function build(out, lod) {
  for (const block of blocks) buildBlock(out, block, lod);
  sanctuary(out, lod);
  bellcote(out, lod);
  memorialCross(out, lod);
}

export const cathedralSkyline = (out) => build(out, 0);
export const cathedralDistrict = (out) => build(out, 1);
export const cathedralStreet = (out) => build(out, 2);
export const cathedralCloseup = (out) => build(out, 3);
const recipe = 'taranaki-cathedral-model.mjs';
const camera = [-52, 24, -47],
  lookAt = [3.7, 5, -1.7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'cathedralDistrict', 0.29],
    ['street', 'cathedralStreet', 0.11],
    ['closeup', 'cathedralCloseup', 0.035],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: cathedralCloseup,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Taranaki Cathedral in New Plymouth with steep slate gables, dark andesite walls, recessed Gothic lancets and the open bellcote above the attached hall.',
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
    minimumCoverage: 0.91,
    basis: 'Named OpenStreetMap church footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 0.86,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_drywall',
    'slate',
    'stone_limestone_weathered',
    'wood_plain',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'vivian-street-and-memorial', position: [-30.5, 6.6, -33.8], lookAt: [-2.5, 4.5, 0.6] },
    { name: 'west-gable-and-hall-bellcote', position: [-22, 10.5, 34], lookAt: [4.8, 5.3, 5.4] },
    { name: 'eastern-apse-and-north-transept', position: [42, 21, -35], lookAt: [11.8, 4.1, -7.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-taranaki-cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.76,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint data © OpenStreetMap contributors, ODbL 1.0. Two first-party exterior photographs dedicated to CC0.',
};
