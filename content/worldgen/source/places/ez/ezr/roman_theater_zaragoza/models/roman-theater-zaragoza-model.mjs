import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { localRings } = read('native-map/roman-theater-zaragoza-mapped-parts.json');
const {
  historicalCaveaDiameterM,
  orchestraRadiusEstimateM: orchestraRadius,
  orchestraFloorModelY: floor,
  caveaCenterLocal: [centerX, centerZ],
  reportedCanopyToArchaeologicalLevelM: canopyHeight,
  canopyEaveAboveOrchestraM,
  canopyPostCount,
} = plan.dimensions;
const precinct = outwardRing(frame.geometry.outline);
const canopy = outwardRing(localRings[471774338]);
const eaves = floor + canopyEaveAboveOrchestraM;
const ridge = floor + canopyHeight;
const roofRidgeZ = 7;

const surfaces = {
  ancient: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  seats: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.95 },
  paving: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.91 },
  fill: { slot: 'foundation', graph: 'gravel', roughness: 0.99 },
  retaining: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96 },
  deck: { slot: 'trim', graph: 'wood_vertical', roughness: 0.94 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.75 },
  roof: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    roughness: 0.51,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.46],
    doubleSided: true,
  },
};
const gravel = rgb('a29a84');
const masonry = rgb('a99e82');
const retaining = rgb('948975');
const limestone = ['b9ae98', 'b4a991', 'c0b6a0', 'afa38b'].map(rgb);
const paving = ['c9bdab', 'cbc0af', 'c7bcab', 'cec1b0'].map(rgb);
const timber = rgb('726b62');
const metal = rgb('d2d3c6');
const rail = rgb('5c6363');
const polycarbonate = rgb('d1d7d2');
const pt = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a + (b - a) * t;
const profile = (r, a, y) => [centerX + r * Math.cos(a), y, centerZ + r * Math.sin(a)];

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const upper = lerp(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const lower = lerp(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return lerp(upper, lower, v - j) - terrain.modelDatumElevationMeters;
}

function triangulated(ring) {
  const indices = earcut(ring.flat());
  return Array.from({ length: indices.length / 3 }, (_, i) => {
    const [a, b, c] = indices.slice(i * 3, i * 3 + 3).map((j) => ring[j]);
    const normalY = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    return normalY > 0 ? [a, b, c] : [a, c, b];
  });
}

function excavation(out) {
  const base = floor - 0.24;
  for (const triangle of triangulated(precinct)) {
    tri(out, 'fill', ...triangle.map((p) => pt(p, base)), gravel);
  }
  for (let i = 0; i < precinct.length; i++) {
    const a = precinct[i];
    const b = precinct[(i + 1) % precinct.length];
    const ga = Math.max(base + 0.4, ground(a) + 0.08);
    const gb = Math.max(base + 0.4, ground(b) + 0.08);
    quad4(
      out,
      'retaining',
      pt(b, base - 0.35),
      pt(a, base - 0.35),
      pt(a, ga),
      pt(b, gb),
      retaining,
    );
  }
}

function orchestra(out, level) {
  const count = [9, 15, 23, 29][level];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count;
    const b = ((i + 1) * Math.PI) / count;
    const outerA = profile(orchestraRadius, a, floor);
    const outerB = profile(orchestraRadius, b, floor);
    tri(
      out,
      'paving',
      [centerX, floor, centerZ],
      outerB,
      outerA,
      paving[level > 1 ? Math.floor(i / 3) % 4 : 0],
    );
    quad4(
      out,
      'paving',
      [outerA[0], floor - 0.28, outerA[2]],
      [outerB[0], floor - 0.28, outerB[2]],
      outerB,
      outerA,
      paving[i % 4],
    );
  }
}

function remains(out, level) {
  const stepCount = [4, 7, 8, 9][level];
  const subdivisions = [3, 5, 10, 14][level];
  for (const [sector, low, high, reach] of [
    [0, 0.028, 1.5, 27.7],
    [1, 1.643, 3.114, 28.9],
  ]) {
    for (let row = 0; row < stepCount; row++) {
      const r0 = lerp(16.15, reach, row / stepCount);
      const r1 = lerp(16.15, reach, (row + 1) / stepCount);
      const y = floor + 0.21 + (row * 3.33) / stepCount;
      const edge = (column) => {
        const angle = lerp(low, high, column / subdivisions);
        const code = (row * 7 + column * 13 + 3 * sector) % 11;
        const cut = level ? 0.079 * (code - 5) : 0;
        const dr = level ? (((code * 3) % 5) - 2) * 0.037 : 0;
        return {
          top: profile(r0 + dr, angle, y + cut * 0.37),
          foot: profile(r0 + dr, angle, y - 0.93),
          back: profile(r1 + dr + 0.18, angle, y + cut * 0.37 + 0.09),
        };
      };
      for (let j = 0; j < subdivisions; j++) {
        const a = edge(j);
        const b = edge(j + 1);
        const tint = limestone[(sector + row + Math.floor(j / 3)) % 4];
        tri(out, 'seats', a.top, b.top, b.back, tint);
        tri(out, 'seats', a.top, b.back, a.back, tint);
        quad4(out, 'ancient', a.foot, b.foot, b.top, a.top, masonry);
        if (j === 0)
          quad4(out, 'ancient', a.foot, a.top, a.back, [a.back[0], a.foot[1], a.back[2]], masonry);
        if (j === subdivisions - 1)
          quad4(out, 'ancient', b.foot, [b.back[0], b.foot[1], b.back[2]], b.back, b.top, masonry);
      }
    }
  }
  const perimeter = historicalCaveaDiameterM / 2;
  const fragments = [
    0.13, 0.34, 0.52, 0.71, 0.91, 1.13, 1.32, 1.81, 2.02, 2.24, 2.46, 2.69, 2.88, 3.02,
  ];
  for (const [i, angle] of fragments.entries()) {
    if (level === 0 && i % 2) continue;
    const inside = 30.1 + (i % 4) * 1.07;
    const outside = Math.min(perimeter - 1.2, 34.8 + ((i * 5) % 9) * 1.81);
    const a = profile(inside, angle, 0);
    const b = profile(outside, angle, 0);
    const pa = [a[0], a[2]];
    const pb = [b[0], b[2]];
    const bottom = floor - 0.24;
    const ga = Math.max(floor + 0.66, ground(pa) + 0.14);
    const gb = Math.max(floor + 0.91, ground(pb) + 0.44);
    fragment(out, pa, pb, bottom, ga + 0.74 + (i % 3) * 0.62, gb, 0.88 + (i % 4) * 0.17);
  }
  for (const r of level === 0 ? [43.4] : [36.4, 43.4, 50]) {
    for (const [a, b] of [
      [0.21, 0.75],
      [0.86, 1.3],
      [1.9, 2.49],
      [2.58, 3.04],
    ]) {
      const n = level < 2 ? 3 : 6;
      for (let j = 0; j < n; j++) {
        const p = profile(r, lerp(a, b, j / n), 0);
        const q = profile(r, lerp(a, b, (j + 1) / n), 0);
        const p2 = [p[0], p[2]];
        const q2 = [q[0], q[2]];
        const ya = Math.max(floor + 0.72, ground(p2) + 0.21);
        const yb = Math.max(floor + 0.65, ground(q2) + 0.25);
        fragment(out, p2, q2, floor - 0.24, ya + (j % 3) * 0.2, yb, 0.72);
      }
    }
  }
}

function fragment(out, a, b, base, topA, topB, width) {
  const F = facade(a, [b[0] - a[0], b[1] - a[1]]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const half = width / 2;
  const A = F.P(0, topA, half);
  const B = F.P(length, topB, half);
  const C = F.P(length, topB, -half);
  const D = F.P(0, topA, -half);
  const low = ([x, , z]) => [x, base, z];
  quad4(out, 'ancient', A, B, C, D, limestone[0]);
  quad4(out, 'ancient', low(A), low(B), B, A, masonry);
  quad4(out, 'ancient', low(C), low(D), D, C, masonry);
  quad4(out, 'ancient', low(B), low(C), C, B, masonry);
  quad4(out, 'ancient', low(D), low(A), A, D, masonry);
}

function platform(out, level) {
  const F = facade([centerX, centerZ - 0.27], [1, 0]);
  const y = floor + 0.89;
  fbox(out, 'deck', F, -20.5, 21.2, y - 0.27, y, -6.9, 0.2, timber);
  const back = facade([centerX, centerZ - 8.75], [1, 0]);
  for (const u of level === 0 ? [-17, -6, 6, 17] : [-20, -15, -9, -3, 3.2, 9.6, 15.6, 20.6]) {
    fbox(out, 'ancient', back, u - 0.6, u + 0.6, floor - 0.22, floor + 0.98, 0, 2.02, masonry);
  }
  if (level > 0) {
    for (const h of [0.38, 1.04]) {
      beam(out, 'steel', F.P(-20.47, y + h, 0.13), F.P(21.17, y + h, 0.13), 0.042, 0.045, rail);
    }
    for (let x = -20.45; x < 21.2; x += level === 1 ? 4.14 : 2.08) {
      beam(out, 'steel', F.P(x, y, 0.13), F.P(x, y + 1.04, 0.13), 0.045, 0.045, rail);
    }
  }
}

const roofY = (z) => ridge - ((ridge - eaves) * Math.abs(z - roofRidgeZ)) / 44;

function clippedAtRidge(points, side) {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const insideA = side * (a[1] - roofRidgeZ) >= 0;
    const insideB = side * (b[1] - roofRidgeZ) >= 0;
    if (insideA) output.push(a);
    if (insideA !== insideB)
      output.push([lerp(a[0], b[0], (roofRidgeZ - a[1]) / (b[1] - a[1])), roofRidgeZ]);
  }
  return output;
}

function spans(value, component) {
  const along = 1 - component;
  const intersections = [];
  for (let i = 0; i < canopy.length; i++) {
    const a = canopy[i];
    const b = canopy[(i + 1) % canopy.length];
    if (a[component] <= value === b[component] <= value) continue;
    intersections.push(
      lerp(a[along], b[along], (value - a[component]) / (b[component] - a[component])),
    );
  }
  return intersections.sort((a, b) => a - b);
}

function shelter(out, level) {
  for (const triangle of triangulated(canopy)) {
    for (const side of [-1, 1]) {
      const clipped = clippedAtRidge(triangle, side);
      if (clipped.length >= 3)
        fan(
          out,
          'roof',
          clipped.map((p) => pt(p, roofY(p[1]))),
          polycarbonate,
        );
    }
  }

  const edges = canopy.map((p, i) => {
    const q = canopy[(i + 1) % canopy.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const length = edges.reduce((a, b) => a + b, 0);
  let at = 0;
  let walked = 0;
  for (let k = 0; k < canopyPostCount; k++) {
    const distance = ((k + 0.4) * length) / canopyPostCount;
    while (walked + edges[at] < distance) walked += edges[at++];
    const p = canopy[at];
    const q = canopy[(at + 1) % canopy.length];
    const t = (distance - walked) / edges[at];
    const x = 0.962 * lerp(p[0], q[0], t) - 0.24;
    const z = 0.962 * lerp(p[1], q[1], t) + 0.21;
    const base = floor - 0.24;
    const y = roofY(z);
    if (level > 0) {
      abox(
        out,
        'retaining',
        [x - 0.38, base - 0.04, z - 0.38],
        [x + 0.38, base + 0.23, z + 0.38],
        retaining,
        {
          bottom: false,
        },
      );
    }
    lathe(
      out,
      'steel',
      [x, z],
      [
        [base, 0.255, 0.255],
        [y - 0.08, 0.225, 0.225],
      ],
      level < 2 ? 5 : 8,
      metal,
      { capTop: false },
    );
  }
  for (let i = 0; i < canopy.length; i++) {
    const a = canopy[i];
    const b = canopy[(i + 1) % canopy.length];
    const topA = pt(a, roofY(a[1]) - 0.084);
    const topB = pt(b, roofY(b[1]) - 0.084);
    const baseA = pt(a, topA[1] - 0.16);
    const baseB = pt(b, topB[1] - 0.16);
    if (level === 0) quad4(out, 'steel', baseA, baseB, topB, topA, metal);
    else beam(out, 'steel', topA, topB, 0.19, 0.21, metal);
  }

  const pitch = [32, 13, 7.2, 5.35][level];
  for (let x = -46.4; x <= 43; x += pitch) {
    const z = spans(x, 0);
    for (let i = 0; i + 1 < z.length; i += 2) {
      const breaks =
        z[i] < roofRidgeZ && z[i + 1] > roofRidgeZ
          ? [z[i], roofRidgeZ, z[i + 1]]
          : [z[i], z[i + 1]];
      for (let j = 1; j < breaks.length; j++) {
        const a = breaks[j - 1];
        const b = breaks[j];
        beam(out, 'steel', [x, roofY(a) - 0.25, a], [x, roofY(b) - 0.25, b], 0.094, 0.12, metal);
      }
    }
  }
  for (let z = -29.6; z <= 40; z += pitch) {
    const x = spans(z, 1);
    for (let i = 0; i + 1 < x.length; i += 2) {
      const y = roofY(z);
      beam(out, 'steel', [x[i], y - 0.27, z], [x[i + 1], y - 0.27, z], 0.11, 0.124, metal);
      if (level > 1) {
        for (let left = x[i] + 0.7; left + 1.8 < x[i + 1]; left += 5.8) {
          const right = Math.min(left + 5.8, x[i + 1] - 0.2);
          beam(
            out,
            'steel',
            [left, y - 0.27, z],
            [(left + right) / 2, y - 1.01, z],
            0.078,
            0.078,
            metal,
          );
          beam(
            out,
            'steel',
            [(left + right) / 2, y - 1.01, z],
            [right, y - 0.27, z],
            0.078,
            0.078,
            metal,
          );
        }
      }
    }
  }
}

function build(out, level) {
  excavation(out);
  orchestra(out, level);
  remains(out, level);
  platform(out, level);
  shelter(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'roman-theater-zaragoza-model.mjs';
const camera = [102, 74, -98];
const lookAt = [-9, 1, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Roman Theater of Caesaraugusta, Zaragoza',
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Zaragoza’s excavated Roman theater, with concentric seating remains under the high translucent protective canopy.',
  camera,
  lookAt,
  sunDirection: [-42, 34, -76],
  portableGroundY: floor - 0.94,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: precinct,
    basis:
      'Named archaeological precinct containing the sunken ruins and the original modern retaining walls.',
  },
  buildingCutout: {
    outline: canopy,
    minimumCoverage: 0.91,
    basis:
      'Mapped protective canopy, excluding the adjoining museum building and unrelated street frontages.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'gravel',
    'concrete_boardformed',
    'wood_vertical',
    'metal_painted',
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'canopy-and-site-overview', position: camera, lookAt },
    { name: 'orchestra-from-stage', position: [-11, 2.5, -31.5], lookAt: [-8, -3.75, 5] },
    { name: 'central-passage-and-masonry', position: [18, -0.5, 16.5], lookAt: [-5, -4.65, 15.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'caesaraugusta-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.12,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.51, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.071, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
