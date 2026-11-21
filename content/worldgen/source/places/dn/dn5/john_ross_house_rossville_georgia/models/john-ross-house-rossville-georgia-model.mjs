import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  rect,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  wood: '827971',
  woodLight: '93867a',
  woodDark: '746b61',
  chink: 'c1b5a1',
  shutter: '7d6b5b',
  door: '795f4d',
  frame: '867868',
  roof: '86796a',
  roofLight: '958877',
  stone: '949086',
  stoneLight: 'a29a8b',
  gravel: 'a2a093',
  hinge: '4d4b46',
  shadow: '555951',
});
const surfaces = {
  timbers: surface('wall', 'wood_log', 0.95),
  lime: surface('wall', 'stucco', 0.95),
  painted: surface('trim', 'wood_plain', 0.92),
  roof: surface('roof', 'shingle_cedar', 0.94),
  stone: surface('foundation', 'stone_ashlar', 0.96),
  paving: surface('foundation', 'stone_drywall', 0.94),
  fitting: surface('trim', 'metal_painted', 0.92, 0.09),
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
};

const x0 = -d.coreWidth / 2,
  x1 = d.coreWidth / 2;
const z0 = -d.coreDepth / 2,
  z1 = d.coreDepth / 2;
const gapA = x0 + d.westRoomWidth,
  gapB = gapA + d.dogtrotWidth;
const deck = d.deckHeight;
const upper = deck + d.groundFloorHeight;
const eave = upper + d.upperFloorHeight;
const yRoof = eave + d.roofRise;
const roofOverhang = 0.235;
const roofWallY = mix(eave + 0.042, yRoof + 0.052, roofOverhang / (z1 + roofOverhang));

function courses(out, w, bottom, top, openings, level) {
  if (level === 0) {
    panel(out, 'timbers', w, 0, w.length, bottom, top, 0, c.wood);
    const count = Math.round((top - bottom) / 0.6);
    for (let i = 1; i < count; i++) {
      const y = mix(bottom, top, i / count);
      panel(out, 'lime', w, 0, w.length, y, y + 0.067, 0.016, c.chink);
    }
    for (const [a, b, low, high, kind] of openings)
      panel(out, 'painted', w, a, b, low, high, 0.033, kind === 'door' ? c.door : c.shutter);
    return;
  }
  const count = Math.max(1, Math.round((top - bottom) / 0.229));
  const boundaries = [bottom, top, ...openings.flatMap(([, , a, b]) => [a, b])].filter(
    (y) => y >= bottom && y <= top,
  );
  for (let i = 1; i < count; i++) boundaries.push(mix(bottom, top, i / count));
  const heights = [...new Set(boundaries)].sort((a, b) => a - b);
  for (let i = 0; i < heights.length - 1; i++) {
    const low = heights[i];
    const high = heights[i + 1];
    const mid = (low + high) / 2;
    const open = openings.filter(([, , base, cap]) => mid > base && mid < cap);
    const positions = [0, ...open.flatMap(([a, b]) => [a, b]), w.length].sort((a, b) => a - b);
    for (let j = 0; j < positions.length - 1; j++) {
      const a = positions[j];
      const b = positions[j + 1];
      const u = (a + b) / 2;
      if (b - a < 0.001 || open.some(([l, r]) => u > l && u < r)) continue;
      const segment = Math.min((high - low) * 0.27, 0.056);
      const logTop = high - Math.min(0.011, (high - low) * 0.14);
      const seam = i % 4 === 2 ? c.woodLight : i % 4 === 0 ? c.woodDark : c.wood;
      panel(out, 'lime', w, a, b, low, high, -0.015, c.chink);
      if (level < 2) panel(out, 'timbers', w, a, b, low + segment, logTop, 0.012, seam);
      else
        trimBlock(
          out,
          'timbers',
          w,
          a,
          b,
          low + segment,
          logTop,
          -0.018,
          0.042 + (i % 3) * 0.008,
          seam,
        );
    }
  }
  for (const [a, b, low, high, kind] of openings) {
    panel(out, 'shadow', w, a, b, low, high, -0.07, c.shadow);
    const dirt = kind === 'door' ? c.door : c.shutter;
    panel(out, 'painted', w, a + 0.025, b - 0.025, low + 0.03, high - 0.02, 0.015, dirt);
    if (level > 0) {
      for (const u of [a, b])
        trimBlock(
          out,
          'painted',
          w,
          u - 0.06,
          u + 0.06,
          low - 0.042,
          high + 0.06,
          -0.01,
          0.074,
          c.frame,
        );
      for (const y of [low, high])
        trimBlock(
          out,
          'painted',
          w,
          a - 0.06,
          b + 0.06,
          y - 0.061,
          y + 0.045,
          -0.01,
          0.08,
          c.frame,
        );
    }
    if (level < 2) continue;
    for (let i = 1; i < 5; i++) {
      const u = mix(a, b, i / 5);
      panel(out, 'painted', w, u - 0.009, u + 0.009, low + 0.075, high - 0.015, 0.028, c.woodDark);
    }
    for (const y of [low + 0.28, high - 0.35])
      panel(out, 'fitting', w, a + 0.02, a + 0.246, y, y + 0.037, 0.067, c.hinge);
  }
}

const openingsFor = (left, specs) =>
  specs.map(([x, w, lo, hi, kind]) => [x - left - w / 2, x - left + w / 2, lo, hi, kind]);
const door = (x) => [x, 0.87, deck + 0.012, deck + 1.92, 'door'];
const window = (x) => [x, 0.62, deck + 0.8, deck + 1.76, 'shutter'];
const upperWindow = (x) => [x, 0.56, upper + 0.33, upper + 1.58, 'shutter'];

function logHouse(out, level) {
  const rooms = [
    {
      a: x0,
      b: gapA,
      north: [door(-4.7), window(-6.56), window(-2.55)],
      south: [door(-4.9), window(-6.52)],
    },
    { a: gapB, b: x1, north: [door(4.66), window(6.57)], south: [door(4.73)] },
  ];
  for (const room of rooms) {
    const { a, b, north, south } = room;
    const foot = rect(a + 0.18, z0 + 0.14, b - 0.18, z1 - 0.14);
    shell(out, foot, (p) => grade(p) - 0.39, deck, {
      wall: 'stone',
      color: c.stone,
      roof: 'stone',
    });
    courses(out, edge([a, z0], [b, z0]), deck, upper, openingsFor(a, north), level);
    courses(out, edge([a, z1], [b, z1], -1), deck, upper, openingsFor(a, south), level);
  }
  const upperWindows = [upperWindow(-4.8), upperWindow(0.34), upperWindow(1.88)];
  courses(out, edge([x0, z0], [x1, z0]), upper, eave, openingsFor(x0, upperWindows), level);
  courses(out, edge([x0, z1], [x1, z1], -1), upper, eave, openingsFor(x0, upperWindows), level);
  for (const [z, sign] of [
    [z0, 1],
    [z1, -1],
  ]) {
    const w = edge([x0, z], [x1, z], sign);
    panel(out, 'painted', w, 0, w.length, eave - 0.01, roofWallY, 0.006, c.woodDark);
  }
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const w = edge([x, z0], [x, z1], sign);
    const leftDoor = x > 0 ? [] : [[0.55, 1.12, deck + 0.59, deck + 1.61, 'shutter']];
    courses(out, w, deck, eave, leftDoor, level);
    panel(out, 'timbers', w, 0, w.length, eave - 0.01, roofWallY, 0, c.woodDark);
    const facePoints = [
      w.p(0, roofWallY),
      w.p(w.length, roofWallY),
      w.p(w.length / 2, yRoof + 0.052),
    ];
    face(out, 'timbers', facePoints, w.normal, c.woodDark);
    if (level > 0) {
      const bands = level === 1 ? 4 : 8;
      for (let i = 1; i < bands; i++) {
        const q = i / bands;
        const y = mix(roofWallY, yRoof + 0.052, q);
        const n = w.length * (1 - q) * 0.5;
        panel(
          out,
          'painted',
          w,
          w.length * 0.5 - n,
          w.length * 0.5 + n,
          y - 0.022,
          y + 0.016,
          0.028,
          c.chink,
        );
      }
    }
  }
  for (const [x, sign] of [
    [gapA, 1],
    [gapB, -1],
  ]) {
    const w = edge([x, z0], [x, z1], sign);
    courses(out, w, deck, upper, [[1.92, 2.81, deck + 0.025, deck + 1.91, 'door']], level);
  }
  const bridge = rect(gapA + 0.013, z0 - 0.05, gapB - 0.013, z1 + 0.05);
  shell(out, bridge, () => deck - 0.15, deck + 0.015, {
    wall: 'painted',
    color: c.wood,
    roof: 'painted',
    roofColor: c.woodLight,
  });
  const floorTop = rect(gapA - 0.01, z0 - 0.02, gapB + 0.01, z1 + 0.02);
  face(
    out,
    'painted',
    floorTop.reverse().map((p) => at(p, upper - 0.073)),
    [0, -1, 0],
    c.woodDark,
  );
  if (level > 1) {
    for (const [x, sign] of [
      [x0, -1],
      [x1, 1],
      [gapA, 1],
      [gapB, -1],
    ]) {
      const end = x + sign * 0.16;
      const start = Math.min(x, end);
      for (const z of [z0 - 0.035, z1 - 0.13]) {
        const upto = x === gapA || x === gapB ? upper : eave;
        const n = Math.round((upto - deck) / 0.229);
        for (let i = 0; i < n; i++) {
          const y = mix(deck, upto, i / n);
          block(
            out,
            'timbers',
            start,
            y + 0.068,
            z,
            0.16,
            0.116,
            0.15,
            i % 2 ? c.wood : c.woodDark,
          );
        }
      }
    }
  }
}

function roofSlope(out, spanLeft, spanRight, zNear, zFar, nearY, farY, level, shade) {
  const p = [
    [spanLeft, nearY, zNear],
    [spanRight, nearY, zNear],
    [spanRight, farY, zFar],
    [spanLeft, farY, zFar],
  ];
  face(out, 'roof', p, up, shade);
  if (level === 0) return;
  for (const x of [spanLeft, spanRight])
    beam(out, 'painted', [x, nearY, zNear], [x, farY, zFar], 0.078, 0.094, c.woodDark);
  if (level < 2) return;
  const n = Math.round(Math.hypot(zFar - zNear, farY - nearY) / (level === 2 ? 0.33 : 0.197));
  for (let j = 1; j < n; j++) {
    const t = j / n;
    const z = mix(zNear, zFar, t);
    const y = mix(nearY, farY, t) + 0.018;
    face(
      out,
      'roof',
      [
        [spanLeft + 0.03, y, z - 0.012],
        [spanRight - 0.03, y, z - 0.012],
        [spanRight - 0.03, y, z + 0.012],
        [spanLeft + 0.03, y, z + 0.012],
      ],
      up,
      shade,
    );
  }
}

function porches(out, level) {
  for (const [z, sign, depth] of [
    [z0, -1, d.porchDepths[0]],
    [z1, 1, d.porchDepths[1]],
  ]) {
    const outer = z + sign * depth;
    const left = -7.92,
      right = 7.92;
    const deckRange = rect(left, Math.min(z, outer), right, Math.max(z, outer));
    shell(out, deckRange, () => deck - 0.21, deck, {
      wall: 'painted',
      color: c.woodDark,
      roof: 'painted',
      roofColor: c.woodLight,
    });
    const low = deck + 1.99;
    const high = upper - 0.08;
    roofSlope(
      out,
      left - 0.15,
      right + 0.15,
      z - sign * 0.08,
      outer + sign * 0.14,
      high,
      low,
      level,
      c.roof,
    );
    const xs = [left + 0.17, -5.25, gapA - 0.14, gapB + 0.14, 5.27, right - 0.16];
    for (const x of xs) {
      const zPost = outer - sign * 0.16;
      const footing = grade([x, zPost]) - 0.22;
      block(
        out,
        'stone',
        x - 0.16,
        footing,
        zPost - 0.16,
        0.32,
        Math.max(0.14, deck - 0.2 - footing),
        0.32,
        c.stone,
      );
      block(
        out,
        'timbers',
        x - 0.069,
        deck - 0.022,
        zPost - 0.074,
        0.138,
        low - deck + 0.13,
        0.148,
        c.woodLight,
      );
    }
    const stepZ = outer + sign * 0.88;
    stairs(
      out,
      grade,
      'paving',
      gapA + 0.12,
      gapB - 0.12,
      stepZ,
      outer,
      deck,
      level === 0 ? 2 : 4,
      c.gravel,
    );
    for (let i = 0; i < xs.length - 1; i++) {
      if (i === 2) continue;
      const a = xs[i] + 0.075,
        b = xs[i + 1] - 0.075;
      const railZ = outer - sign * 0.16;
      for (const h of [deck + 0.12, deck + 0.81])
        beam(out, 'painted', [a, h, railZ], [b, h, railZ], 0.066, 0.085, c.frame);
      if (level > 0) {
        beam(out, 'painted', [a, deck + 0.15, railZ], [b, deck + 0.78, railZ], 0.047, 0.06, c.wood);
        beam(
          out,
          'painted',
          [a, deck + 0.78, railZ + 0.024],
          [b, deck + 0.15, railZ + 0.024],
          0.047,
          0.06,
          c.wood,
        );
      }
    }
    if (level > 1) {
      for (let i = 1; i < 17; i++) {
        const x = mix(left, right, i / 17);
        const zEnd = outer + sign * 0.04;
        beam(
          out,
          'painted',
          [x, low - 0.096, zEnd],
          [x, low - 0.014, zEnd - sign * 0.46],
          0.081,
          0.084,
          c.wood,
        );
      }
    }
  }
}

function chimney(out, sign, level) {
  const center = sign * (Math.abs(x0) + 0.53);
  const z = 0.06;
  const ground = grade([center, z]);
  const low = ground - 0.39;
  const hi = yRoof + (sign > 0 ? 0.84 : 0.54);
  const sections = [
    [low, 0.65, 1.01],
    [deck + 0.11, 0.61, 0.95],
    [upper + 0.41, 0.58, 0.83],
    [upper + 1.14, 0.46, 0.66],
    [upper + 1.73, 0.335, 0.436],
    [hi - 0.22, 0.335, 0.436],
    [hi - 0.12, 0.385, 0.49],
    [hi, 0.385, 0.49],
  ];
  for (const [[y, rx, rz], [top, ux, uz]] of sections.slice(1).map((s, i) => [sections[i], s])) {
    const a = rect(center - rx, z - rz, center + rx, z + rz).map((p) => at(p, y));
    const b = rect(center - ux, z - uz, center + ux, z + uz).map((p) => at(p, top));
    const normals = [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face(out, 'stone', [a[i], a[j], b[j], b[i]], normals[i], i % 2 ? c.stone : c.stoneLight);
    }
  }
  const topOutline = rect(center - 0.385, z - 0.49, center + 0.385, z + 0.49);
  face(
    out,
    'stone',
    topOutline.map((p) => at(p, hi)),
    up,
    c.stoneLight,
  );
  if (level > 1) {
    const w = edge([center - 0.3, z - 0.445], [center + 0.3, z - 0.445]);
    panel(out, 'shadow', w, 0.1, 0.48, hi - 0.2, hi - 0.13, 0.049, c.shadow);
  }
}

function build(out, level) {
  logHouse(out, level);
  for (const z of [z0 - roofOverhang, z1 + roofOverhang])
    roofSlope(
      out,
      x0 - 0.24,
      x1 + 0.24,
      z,
      0,
      eave + 0.042,
      yRoof + 0.052,
      level,
      z < 0 ? c.roofLight : c.roof,
    );
  porches(out, level);
  for (const sign of [-1, 1]) chimney(out, sign, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'john-ross-house-rossville-georgia-model.mjs';
const camera = [23, 12, -26];
const lookAt = [0, 3, 0];
const errors = { district: 0.25, street: 0.095, closeup: 0.031 };
export const johnRossHouseAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original USGS grade at the current mapped relocated cabin, with shallow stone footings beneath the porches.',
  brief:
    'The relocated square-log John Ross House, with two stone chimneys, two shingled porches and an open central dogtrot.',
  camera,
  lookAt,
  sunDirection: [-4, 9, -7],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Mapped relocated log house with both porches in Rossville.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap((s) => s.graph ?? []),
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'front-dogtrot-and-stone-chimney',
      position: [13, 4.9, -15.5],
      lookAt: [-0.2, 3.12, -0.5],
    },
    { name: 'rear-shakes-and-porch', position: [-15, 7, 14.5], lookAt: [0.6, 3.4, 1.25] },
    { name: 'open-dogtrot-and-two-log-rooms', position: [0.6, 2.97, -11], lookAt: [0.78, 2.17, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'john-ross-house-rossville-georgia-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. U.S. Geological Survey elevation and © OpenStreetMap contributors.',
};
