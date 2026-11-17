/** The standing earthen mosque and former Throne Hall at Old Dongola, following the conserved exterior. */
import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  adobe: { slot: 'wall', graph: 'earth_adobe', roughness: 0.96 },
  rubble: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  brick: { slot: 'roof', graph: 'brick_longformat', roughness: 0.93 },
  frame: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.92 },
};
const c = Object.fromEntries(
  Object.entries({
    adobe: 'bb9767',
    ramp: 'b69160',
    earth: 'ac8453',
    tan: 'c8a578',
    shade: 'a78458',
    rock: 'ac9573',
    stone: 'c8b697',
    red: '8d5c48',
    upper: 'be9a6d',
    adobeLight: 'd2ae7b',
    adobeDark: 'a9855b',
    dark: '4e4137',
    wood: '776750',
    deck: 'aa8e68',
    weathered: 'a17954',
    clay: 'b18963',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const levels = [
  [-1.9, 1.01, 'rubble', c.rock],
  [0.6, 0.993, 'adobe', c.adobe],
  [3.2, 0.951, 'adobe', c.ramp],
  [6.5, 0.882, 'adobe', c.adobe],
  [9.55, 0.855, 'adobe', c.upper],
];
const mix = (a, b, t) => a + (b - a) * t;
function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = mix(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = mix(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return mix(a, b, v - j) - terrain.modelDatumElevationMeters;
}
function contraction(y) {
  const i = Math.max(
    1,
    levels.findIndex(([top]) => y <= top),
  );
  const [lo, low] = levels[i - 1],
    [hi, high] = levels[i];
  return mix(low, high, (y - lo) / (hi - lo));
}

function edge(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(a[1] - b[1]) / length, (b[0] - a[0]) / length];
  const point = (u, y, offset = 0) => {
    const scale = contraction(y);
    return [
      mix(a[0], b[0], u) * scale + normal[0] * offset,
      y,
      mix(a[1], b[1], u) * scale + normal[1] * offset,
    ];
  };
  return {
    length,
    point,
    patch(slot, u, v, low, high, tint, offset = 0) {
      face(
        out,
        slot,
        [
          point(u, low, offset),
          point(v, low, offset),
          point(v, high, offset),
          point(u, high, offset),
        ],
        tint,
      );
    },
  };
}

function hatch(wall, u, y, width, height, lod, frame = false) {
  const { length, patch } = wall;
  const r = width / (2 * length * contraction(y));
  patch('inset', u - r, u + r, y, y + height, c.dark, 0.027);
  if (!frame || lod === 0) return;
  const band = 0.13 / length;
  for (const k of [-1, 1]) {
    const v = u + k * (r + band / 2);
    patch('frame', v - band / 2, v + band / 2, y - 0.08, y + height + 0.08, c.stone, 0.063);
  }
  patch('frame', u - r - band, u + r + band, y - 0.12, y, c.stone, 0.068);
  patch('brick', u - r - band, u + r + band, y + height, y + height + 0.16, c.red, 0.068);
}

function doorway(out, wall, u, lod) {
  const { length, point, patch } = wall;
  const [width, doorHeight] = plan.dimensions.westDoor;
  const floor = 0.11,
    soffit = floor + doorHeight;
  const r = width / (2 * length * contraction(floor));
  const [a, b] = [u - r, u + r];
  for (const [bottom, top, slot, color] of [
    [-1.9, floor, 'rubble', c.rock],
    [soffit, 3.2, 'adobe', c.adobe],
  ])
    patch(slot, 0, 1, bottom, top, color);
  for (const [x, v] of [
    [0, a],
    [b, 1],
  ]) {
    patch('adobe', x, v, floor, 0.6, c.shade);
    patch('adobe', x, v, 0.6, soffit, c.ramp);
  }
  patch('inset', a, b, floor, soffit, c.dark, -0.81);
  for (const [x, v] of [
    [a, point(a, floor, 0)],
    [b, point(b, floor, -0.81)],
  ]) {
    const front = x === a ? 0 : -0.81;
    const back = x === a ? -0.81 : 0;
    face(
      out,
      'frame',
      [v, point(x, floor, back), point(x, soffit, back), point(x, soffit, front)],
      c.stone,
    );
  }
  face(
    out,
    'frame',
    [point(a, soffit), point(b, soffit), point(b, soffit, -0.81), point(a, soffit, -0.81)],
    c.stone,
  );
  if (lod === 0) return;
  const jamb = 0.28 / length;
  for (const [x, v] of [
    [a - jamb, a],
    [b, b + jamb],
  ]) {
    patch('frame', x, v, floor, soffit, c.stone, 0.049);
    if (lod >= 2)
      for (let i = 1; i < 6; i++) {
        const y = floor + (i * doorHeight) / 6;
        patch('brick', x, v, y, y + 0.034, c.clay, 0.056);
      }
  }
  patch('frame', a - jamb, b + jamb, soffit, soffit + 0.23, c.stone, 0.08);
  patch('timber', a + 0.007, b - 0.007, floor + 0.02, soffit - 0.32, c.wood, -0.4);
  if (lod >= 2)
    for (let i = 1; i < 6; i++) {
      const x = mix(a, b, i / 6);
      patch('inset', x - 0.0008, x + 0.0008, floor + 0.02, soffit - 0.33, c.dark, -0.389);
    }
}

function repairs(wall, corner, lod, excludeDoor) {
  const count = Math.round(wall.length / (lod === 3 ? 0.49 : 0.95));
  for (let row = 0; row < 14; row++) {
    const y = 0.33 + row * 0.53;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.37 + 0.24 * (row % 2)) / count;
      if ((5 * i + 7 * row + 11 * corner) % 13 > 1 || u < 0.025 || u > 0.975) continue;
      if (excludeDoor && u > 0.48 && u < 0.75 && y < 3.08) continue;
      const r = 0.28 / count;
      const tint =
        (row + i) % 4 === 0 ? c.weathered : (row + i) % 3 === 0 ? c.adobeLight : c.adobeDark;
      wall.patch('adobe', u - r, u + r, y, y + 0.09 + 0.028 * (i % 3), tint, 0.011);
    }
  }
}

function hall(out, lod) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const wall = edge(out, a, b);
    const west = Math.min(a[0], b[0]) > 13 && wall.length > 10;
    const westDoorU = (plan.dimensions.westEntry[1] - a[1]) / (b[1] - a[1]);
    for (let j = 0; j < levels.length - 1; j++) {
      if (west && j < 2) continue;
      const [lo, , slot, color] = levels[j],
        [hi] = levels[j + 1];
      wall.patch(slot, 0, 1, lo, hi, color);
    }
    if (west) {
      doorway(out, wall, westDoorU, lod);
      for (const [u, y, w, h] of [
        [0.31, 5.0, 0.67, 0.95],
        [0.53, 7.94, 0.75, 0.78],
        [0.79, 7.98, 0.61, 0.7],
      ])
        hatch(wall, u, y, w, h, lod, true);
    } else if (wall.length > 11) {
      const north = a[1] + b[1] > 3;
      for (const [u, y, w, h] of north
        ? [
            [0.17, 2.55, 0.47, 0.73],
            [0.48, 2.64, 0.48, 0.78],
            [0.68, 6.9, 0.89, 0.99],
            [0.87, 7.03, 0.82, 0.93],
          ]
        : [
            [0.16, 3.88, 0.59, 0.83],
            [0.38, 6.93, 1.1, 1.13],
            [0.67, 7.31, 0.78, 0.83],
            [0.87, 3.66, 0.51, 0.79],
          ])
        hatch(wall, u, y, w, h, lod, north);
    } else if (wall.length > 4 && lod >= 1) {
      hatch(wall, 0.53, 6.84, 0.78, 0.92, lod, true);
    }
    if (lod >= 2 && wall.length > 5) repairs(wall, i, lod, west);
  }
  const capY = 9.54;
  const roof = earcut(outline.flat());
  for (let i = 0; i < roof.length; i += 3)
    triangle(
      out,
      'adobe',
      [roof[i + 2], roof[i + 1], roof[i]].map((j) => {
        const [x, z] = outline[j];
        return [x * 0.855, capY, z * 0.855];
      }),
      c.deck,
    );
}

function parapetSegment(out, a, b, y0, y1, lod, n) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const l = Math.hypot(dx, dz);
  const u = [-dz / l, dx / l];
  const p = (t, y, w) => [mix(a[0], b[0], t) + u[0] * w, y, mix(a[1], b[1], t) + u[1] * w];
  const h = (t) => y1 + (lod >= 2 ? 0.09 * Math.sin(n * 2 + t * 3.1) : 0);
  for (const [s, t] of [
    [0, 0.5],
    [0.5, 1],
  ]) {
    face(out, 'adobe', [p(s, y0, 0), p(t, y0, 0), p(t, h(t), 0), p(s, h(s), 0)], c.tan);
    face(
      out,
      'brick',
      [p(t, y0, -0.37), p(s, y0, -0.37), p(s, h(s), -0.37), p(t, h(t), -0.37)],
      c.shade,
    );
    face(
      out,
      'brick',
      [p(s, h(s), -0.37), p(s, h(s), 0), p(t, h(t), 0), p(t, h(t), -0.37)],
      c.clay,
    );
  }
}

function upperWorks(out, lod) {
  const parapet = outline.map(([x, z]) => [x * 0.834, z * 0.834]);
  for (let i = 0; i < parapet.length; i++) {
    const a = parapet[i],
      b = parapet[(i + 1) % parapet.length];
    // The tallest masonry extends the conserved roof viewing area towards the stair enclosure.
    parapetSegment(out, a, b, 9.5, pairHeight(a, b), lod, i);
  }
  function pairHeight(a, b) {
    return 9.96 + (a[0] + b[0] > 0 ? 0.42 : 0.11);
  }
  box(out, 'adobe', [4.15, 9.52, -4.15], [10.37, 11.32, 1.18], c.upper);
  box(out, 'adobe', [5.28, 11.3, -3.61], [9.48, 11.77, 0.55], c.adobe);
  box(out, 'brick', [5.73, 11.77, -3.41], [9.41, 12, 0.35], c.clay);
  box(out, 'inset', [10.364, 10.21, -2.88], [10.402, 10.92, -2.23], c.dark);
  box(out, 'inset', [5.35, 9.56, 1.174], [6.29, 11.03, 1.205], c.dark);
  if (lod < 2) return;
  for (let i = 0; i < 5; i++) {
    const z = -3.81 + 0.79 * i;
    beam(out, 'timber', [10.17, 10.4, z], [10.72, 10.4, z], 0.094, 0.094, c.wood);
  }
  for (const x of [-3.9, -2.15, -0.4, 1.35]) {
    box(out, 'timber', [x - 0.035, 9.54, -4.82], [x + 0.035, 10.49, -4.74], c.wood);
  }
  beam(out, 'timber', [-3.94, 10.42, -4.78], [1.41, 10.42, -4.78], 0.055, 0.055, c.wood);
}

function approach(out, lod) {
  const [x, z] = plan.dimensions.westEntry;
  const y = ground(x, z);
  for (let i = 0; i < 3; i++) {
    const width = 1.93 + i * 0.2;
    box(
      out,
      'rubble',
      [x - 1, y - 0.44, z - width / 2],
      [x + 0.25 + i * 0.32, 0.159 - i * 0.11, z + width / 2],
      c.rock,
    );
  }
  if (lod === 0) return;
  const path = [
    [x - 0.57, z - 2.91, 0.63],
    [x + 0.34, z - 3.06, 0.5],
    [x + 1.21, z - 3.26, 0.41],
    [x + 2.08, z - 3.29, 0.37],
    [x + 3.48, z - 3.66, 0.22],
  ];
  const p = ([x, z, height], offset, top) => [x, ground(x, z) + (top ? height : -0.22), z + offset];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i];
    face(
      out,
      'rubble',
      [p(a, 0.22, false), p(b, 0.22, false), p(b, 0.22, true), p(a, 0.22, true)],
      c.rock,
    );
    face(
      out,
      'rubble',
      [p(b, -0.23, false), p(a, -0.23, false), p(a, -0.23, true), p(b, -0.23, true)],
      c.rock,
    );
    face(
      out,
      'rubble',
      [p(a, -0.23, true), p(a, 0.22, true), p(b, 0.22, true), p(b, -0.23, true)],
      c.stone,
    );
  }
  const end = path.at(-1);
  face(
    out,
    'rubble',
    [p(end, 0.22, false), p(end, -0.23, false), p(end, -0.23, true), p(end, 0.22, true)],
    c.rock,
  );
}

function build(out, lod) {
  hall(out, lod);
  upperWorks(out, lod);
  approach(out, lod);
}

export const dongolaSkyline = (out) => build(out, 0);
export const dongolaDistrict = (out) => build(out, 1);
export const dongolaStreet = (out) => build(out, 2);
export const dongolaCloseup = (out) => build(out, 3);

const recipe = 'throne-hall-of-dongola-model.mjs';
const camera = [32, 17, 38],
  lookAt = [0, 4.3, 0];
const entryCamera = { position: [32, 4, -3.4], lookAt: [7.5, 5.2, -0.4] };
export const dongolaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: dongolaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Original mapped outline of the standing historic Throne Hall.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Throne Hall and mosque at Old Dongola with battered mud-brick walls, a sandstone west entry and conserved roof terrace above the Nile.',
  camera,
  lookAt,
  sunDirection: [16, 22, 17],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.95,
    cameraYaw: 0.04,
    focus: { center: [0, 4.0, 0] },
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'battered-wall-and-west-entry', ...entryCamera },
    { name: 'plateau-and-terrace-parapet', position: [23, 31, 25], lookAt: [0, 5.7, 0.7] },
    {
      name: 'east-elevation-and-raised-stair-block',
      position: [-39, 14, -21],
      lookAt: [0, 4.5, 0],
    },
    { name: 'restored-west-threshold', position: [22, 2.16, -7.1], lookAt: [12.6, 2.15, -2.56] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'dongolaSkyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'dongolaDistrict', 0.51],
        ['street', 'dongolaStreet', 0.17],
        ['closeup', 'dongolaCloseup', 0.052],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original geometry informed by the public-domain engraving by Robert Hartmann. OpenStreetMap controls ODbL 1.0.',
  limitations: plan.limitations,
};
