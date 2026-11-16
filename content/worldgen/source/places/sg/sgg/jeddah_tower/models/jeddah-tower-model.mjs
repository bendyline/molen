/** The partial Jeddah Tower superstructure at the November 2026 construction milestone. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const ground = read('terrain-grid');
const base = frame.geometry.polygons[0];
const top = plan.dimensions.structureHeight;
const floorCount = plan.dimensions.floorCount;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metalness: 0.18 },
  steel: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78, metalness: 0.15 },
  earth: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
};
const tints = Object.fromEntries(
  Object.entries({
    concrete: 'a49d91',
    pale: 'b1aa9e',
    slab: '999285',
    shaded: '62605b',
    enclosed: '615e57',
    dark: '494b47',
    window: '7895a0',
    windowBlue: '73929e',
    windowPale: '7e9ba4',
    mullion: '66767a',
    primer: 'b58441',
    guard: '9b763e',
    equipment: '544d42',
    steel: 'a9a89b',
    stone: 'b4aa96',
    frame: 'b5b0a5',
  }).map(([k, v]) => [k, rgb(v)]),
);
const blend = (a, b, t) => a.map((p, i) => p + (b[i] - p) * t);
const midpoint = (a, b) => blend(a, b, 0.5);
const heightClamp = (u) => Math.max(0, Math.min(1, u));
const at = ([x, z], y, scale = 1) => [scale * x, y, scale * z];
const tipGroups = [
  [2, 3],
  [5, 6],
  [8, 0],
];
const inner = [1, 4, 7];
const tipFor = new Map();
for (const [wing, indices] of tipGroups.entries()) {
  const corners = [inner[wing], inner[(wing + 1) % 3]];
  const root = midpoint(base[corners[0]], base[corners[1]]);
  const middle = midpoint(base[indices[0]], base[indices[1]]);
  for (const index of indices) tipFor.set(index, { root, middle, wing });
}
const workingLevels = [430.5, 408.5, 419.5];
const tipWall = new Set([2, 5, 8]);
const workBands = [
  [268, 275],
  [306, 314],
  [398, 409],
  [414, 423],
  [426, 434],
  [474, 482],
];

function footprint(y) {
  return base.map(([x, z], index) => {
    const t = heightClamp(y / top);
    const tip = tipFor.get(index);
    if (!tip) return [x * (1 - 0.21 * t), z * (1 - 0.21 * t)];
    const { root, middle, wing } = tip;
    const setback = heightClamp((y - workingLevels[wing]) / 6.5);
    const length = (1 - [0.48, 0.53, 0.55][wing] * t) * (1 - 0.71 * setback);
    const width = 1 - 0.23 * t - 0.14 * setback;
    return [0, 1].map(
      (k) =>
        root[k] * (1 - 0.21 * t) + (middle[k] - root[k]) * length + ([x, z][k] - middle[k]) * width,
    );
  });
}

function floorElevation(floor) {
  if (floor < 10) return floor * 4.45;
  return 44.5 + ((top - 44.5) * (floor - 10)) / (floorCount - 10);
}

function edge(ring, i) {
  return [ring[i], ring[(i + 1) % ring.length]];
}

function panel(out, slot, i, low, high, tint, options = {}) {
  const {
    innerScale = 1,
    left = 0,
    right = 1,
    bottom = footprint(low),
    upper = footprint(high),
  } = options;
  const [a, b] = edge(bottom, i),
    [c, d] = edge(upper, i);
  face(
    out,
    slot,
    [
      at(blend(b, a, 1 - right), low, innerScale),
      at(blend(a, b, left), low, innerScale),
      at(blend(c, d, left), high, innerScale),
      at(blend(c, d, right), high, innerScale),
    ],
    tint,
  );
}

function pavement(out, ring, y, slot, tint, down = false, scale = 1) {
  const labels = earcut(ring.flat());
  for (let i = 0; i < labels.length; i += 3) {
    const [a, b, c] = labels.slice(i, i + 3).map((j) => at(ring[j], y, scale));
    triangle(out, slot, down ? [a, b, c] : [a, c, b], tint);
  }
}

function hasGlass(edgeIndex, floor) {
  if (tipWall.has(edgeIndex)) return floor >= 3 && floor <= 8 && edgeIndex !== 2;
  if (floor >= 19 && floor <= [0, 40, 0, 43, 39, 0, 35, 44, 0][edgeIndex]) return true;
  return floor >= 2 && floor <= 9 && [0, 1, 3, 4, 6, 7].includes(edgeIndex);
}

function elevationFacade(out, lod) {
  const stride = lod === 0 ? 6 : lod === 1 ? 3 : 1;
  const baseElevation = -Math.max(
    2.4,
    ground.modelDatumElevationMeters - Math.min(...ground.heightsMeters.flat()),
  );
  for (let i = 0; i < base.length; i++)
    panel(out, 'earth', i, baseElevation, 2.65, tints.stone, { innerScale: 1.025 });
  pavement(out, footprint(2.65), 2.65, 'earth', tints.stone, false, 1.025);
  pavement(out, footprint(baseElevation), baseElevation, 'earth', tints.stone, true, 1.025);
  for (let floor = 0; floor < floorCount; floor += stride) {
    const low = Math.max(2.68, floorElevation(floor));
    const high = floorElevation(Math.min(floor + stride, floorCount));
    const bottom = footprint(low),
      upper = footprint(high),
      rings = { bottom, upper };
    const thick = lod < 2 ? 0.73 : 0.36;
    const p0 = footprint(high - thick);
    for (let i = 0; i < base.length; i++) {
      const glazed = hasGlass(i, floor + Math.min(1, stride));
      const screens = workBands.some(([a, b]) => low >= a - 2 && low <= b) && !tipWall.has(i);
      const slabTint = (floor + i) % 9 === 0 ? tints.frame : tints.slab;
      if (lod >= 1 || floor % 12 === 0) {
        panel(out, 'concrete', i, high - thick, high, slabTint, { bottom: p0, upper });
      }
      if (glazed) {
        const divisions = lod < 3 ? 1 : tipWall.has(i) ? 4 : 9;
        const tintSet = [tints.window, tints.windowPale, tints.windowBlue];
        for (let bay = 0; bay < divisions; bay++) {
          const left = bay / divisions,
            right = (bay + 1) / divisions;
          const tint = tintSet[(Math.floor(bay / 3) + Math.floor(floor / 5) + i) % tintSet.length];
          panel(out, 'glass', i, low, high, tint, { ...rings, innerScale: 1.003, left, right });
          if (lod === 3) {
            const half = 0.009;
            panel(out, 'steel', i, low, high, tints.mullion, {
              ...rings,
              innerScale: 1.006,
              left: Math.max(0, right - half),
              right,
            });
          }
        }
      } else if (tipWall.has(i)) {
        panel(
          out,
          'concrete',
          i,
          low,
          high,
          (floor + 2 * i) % 8 === 0 ? tints.pale : tints.concrete,
          rings,
        );
      } else {
        panel(out, 'concrete', i, low, high, (floor + i) % 13 === 0 ? tints.enclosed : tints.dark, {
          ...rings,
          innerScale: lod === 0 ? 0.986 : 0.875,
        });
        if (lod >= 2) {
          for (const longEdge of [
            [0, 0.13],
            [0.84, 1],
          ]) {
            panel(out, 'concrete', i, low, high, tints.shaded, {
              ...rings,
              left: longEdge[0],
              right: longEdge[1],
              innerScale: 0.984,
            });
          }
          for (const [left, right] of [
            [0, 0.025],
            [0.36, 0.386],
            [0.66, 0.689],
            [0.975, 1],
          ]) {
            if (lod === 3 || left === 0)
              panel(out, 'concrete', i, low, high, tints.slab, {
                ...rings,
                left,
                right,
                innerScale: 0.992,
              });
          }
        }
        if (screens) {
          panel(out, 'steel', i, low, high, tints.guard, { ...rings, innerScale: 1.024 });
          if (lod >= 2)
            panel(out, 'steel', i, low + 0.12, Math.min(low + 0.68, high), tints.primer, {
              innerScale: 1.031,
            });
        }
      }
    }
    if (lod === 3 || (lod === 2 && floor % 3 === 0))
      pavement(out, upper, high, 'concrete', tints.slab);
    if (lod === 3) pavement(out, p0, high - thick, 'concrete', tints.shaded, true);
  }
  pavement(out, footprint(top), top, 'concrete', tints.concrete);
}

function workPlatforms(out, lod) {
  const floors = [...workingLevels, top - 2.2];
  for (const [platform, y] of floors.entries()) {
    const ring = footprint(y);
    const i = platform === 3 ? 2 : tipGroups[platform][0];
    const first = platform === 3 ? 0 : i - 1;
    const count = platform === 3 ? ring.length : 3;
    for (let n = 0; n < count; n++) {
      const k = (first + n) % ring.length;
      panel(out, 'steel', k, y - 1.45, y + 1.25, tints.primer, {
        innerScale: 1.056,
        bottom: ring,
        upper: ring,
      });
      if (lod >= 1) {
        const [a, b] = edge(ring, k);
        for (const height of [y - 1.18, y + 0.24, y + 1.21]) {
          beam(
            out,
            'steel',
            at(a, height, 1.061),
            at(b, height, 1.061),
            0.25,
            0.19,
            tints.equipment,
          );
        }
        if (lod >= 2) {
          const posts = Math.max(2, Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) / 2.8));
          for (let j = 0; j < posts; j++) {
            const p = blend(a, b, j / posts);
            beam(
              out,
              'steel',
              at(p, y - 1.45, 1.065),
              at(p, y + 1.2, 1.065),
              0.16,
              0.16,
              tints.guard,
            );
          }
        }
      }
    }
  }
}

const cranes = [
  { x: -7.5, z: 3.7, angle: 2.4, tower: 14.4, rise: 41, length: 41, tint: tints.primer },
  { x: 6.8, z: 6, angle: 0.49, tower: 20.2, rise: 45, length: 35, tint: tints.primer },
  { x: -1.4, z: -8.1, angle: -1.37, tower: 16.8, rise: 36, length: 29, tint: tints.steel },
];

function lattice(out, start, end, width, bays, lod, tint) {
  const dir = end.map((p, i) => p - start[i]);
  const d = Math.hypot(dir[0], dir[2]);
  const u = d < 0.001 ? [1, 0, 0] : [-dir[2] / d, 0, dir[0] / d];
  const norm = Math.hypot(...dir);
  const v =
    d < 0.001
      ? [0, 0, 1]
      : [(-dir[1] * dir[0]) / (norm * d), d / norm, (-dir[1] * dir[2]) / (norm * d)];
  const ends = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ];
  const point = (t, [a, b]) =>
    blend(start, end, t).map((p, i) => p + ((a * u[i] + b * v[i]) * width) / 2);
  if (lod === 0) {
    beam(out, 'steel', start, end, width * 0.68, width * 0.55, tint);
    return;
  }
  const chord = lod === 1 ? 0.28 : 0.19;
  for (const q of ends) beam(out, 'steel', point(0, q), point(1, q), chord, chord, tint);
  for (let i = 0; i < bays; i++) {
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4,
        u = i / bays,
        v = (i + 1) / bays;
      if (lod >= 2 || j % 2 === 0)
        beam(out, 'steel', point(u, ends[j]), point(v, ends[k]), chord * 0.69, chord * 0.69, tint);
      if (lod >= 2)
        beam(out, 'steel', point(u, ends[j]), point(u, ends[k]), chord * 0.64, chord * 0.64, tint);
    }
  }
}

function towerCranes(out, lod) {
  for (const { x, z, angle, tower, rise, length, tint } of cranes) {
    const pivot = [x, top + tower, z],
      base = [x, top - 1.7, z];
    const across = (d, y) => [x + Math.cos(angle) * d, y, z + Math.sin(angle) * d];
    const tip = across(length, pivot[1] + rise),
      back = across(-9.8, pivot[1] + 1.8),
      head = across(-3.4, pivot[1] + 12.4);
    lattice(out, base, pivot, 2.3, lod === 3 ? 9 : 5, lod, tint);
    lattice(out, pivot, tip, 1.38, lod === 3 ? 13 : 7, lod, tint);
    lattice(out, pivot, head, 1.22, lod === 3 ? 5 : 3, lod, tint);
    beam(out, 'steel', pivot, back, 1.1, 0.65, tint);
    box(
      out,
      'steel',
      [back[0] - 1.3, back[1] - 1.2, back[2] - 1.3],
      [back[0] + 1.3, back[1] + 0.34, back[2] + 1.3],
      tints.equipment,
    );
    if (lod >= 1) {
      beam(out, 'steel', head, tip, 0.14, 0.14, tints.equipment);
      beam(out, 'steel', head, back, 0.16, 0.16, tints.equipment);
      const hook = [tip[0], tip[1] - 17.5, tip[2]];
      beam(out, 'steel', tip, hook, 0.1, 0.1, tints.equipment);
      box(
        out,
        'steel',
        [hook[0] - 0.32, hook[1] - 0.46, hook[2] - 0.32],
        [hook[0] + 0.32, hook[1], hook[2] + 0.32],
        tint,
      );
    }
    if (lod >= 2) {
      box(
        out,
        'steel',
        [x - 2.5, pivot[1] - 0.6, z - 1.3],
        [x - 0.9, pivot[1] + 1.12, z + 0.55],
        tint,
      );
      box(
        out,
        'glass',
        [x - 2.5, pivot[1] + 0.44, z - 1.32],
        [x - 0.89, pivot[1] + 0.99, z - 1.3],
        tints.windowBlue,
      );
    }
  }
}

function build(out, lod) {
  elevationFacade(out, lod);
  workPlatforms(out, lod);
  towerCranes(out, lod);
}
export const jeddahSkyline = (out) => build(out, 0);
export const jeddahDistrict = (out) => build(out, 1);
export const jeddahStreet = (out) => build(out, 2);
export const jeddahCloseup = (out) => build(out, 3);
const recipe = 'jeddah-tower-model.mjs';
const camera = [470, 295, 700],
  lookAt = [0, 274, 0];
export const jeddahTowerModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: jeddahCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.geometryBasis,
  appearance: {
    representedConstructionDate: plan.representedDate,
    constructionStage: '120 levels, under construction',
  },
  buildingCutout: {
    outline: base,
    minimumCoverage: 0.81,
    basis:
      'The mapped as-built tower footing. Surrounding works and podium are outside this preview.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Jeddah Tower under construction at the 120th-floor milestone, with its exposed concrete wings, partly glazed envelope, ochre work platforms and cranes.',
  camera,
  lookAt,
  sunDirection: [-42, 72, 54],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.1,
    cameraYaw: 0.25,
    focus: { center: [0, 155, 0] },
    groundY: 0,
    far: 3500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'grade-and-lower-curtain-wall', position: [148, 48, 183], lookAt: [4, 54, 2] },
    { name: 'exposed-decks-and-glazing', position: [187, 134, -210], lookAt: [2, 146, -8] },
    { name: 'formwork-and-luffing-cranes', position: [126, 485, 224], lookAt: [0, 464, 0] },
    { name: 'three-wing-plan', position: [88, 707, 105], lookAt: [0, 284, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'jeddahSkyline',
    errorMeters: 5.4,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'jeddahDistrict', 3.1],
        ['street', 'jeddahStreet', 0.83],
        ['closeup', 'jeddahCloseup', 0.13],
      ].map(([key, name, errorMeters]) => [key, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original work informed by the exact Qualla CC0 exterior photograph by Fahadharbi and a named OpenStreetMap footprint (ODbL 1.0).',
  limitations: plan.limitations,
};
