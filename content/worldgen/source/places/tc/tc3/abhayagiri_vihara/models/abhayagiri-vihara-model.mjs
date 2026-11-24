import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/abhayagiri-vihara-shape-controls');
const outline = outwardRing(shape.outline);
const outer = outwardRing(shape.terrace);
const terrace = 1.82;
const brick = rgb('985e4c');
const plinthBrick = rgb('a66b55');
const upperBrick = rgb('9b6352');
const edgeBrick = rgb('b37b5d');
const stone = rgb('aa9b86');
const dress = rgb('b9a68e');
const figuredStone = rgb('988979');
const paving = rgb('b4a68e');
const agedPaving = rgb('a69983');
const bronze = rgb('90825e');

const surfaces = {
  dome: { slot: 'wall', graph: 'brick_longformat', roughness: 0.97 },
  wall: { slot: 'trim', graph: 'brick', roughness: 0.965 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  pavement: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.965 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.89 },
};

const faces = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const circle = (y, r) => [y, r, r];

function pavedCourt(out) {
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      'pavement',
      'palette:#ffffff',
      outer,
      [],
      () => terrace,
      [0, 1, 0],
      (p) => p,
      paving,
    )
  )
    throw Error('Abhayagiri terrace could not be triangulated');
  const { positions, indices } = cap.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const point = (n) => Array.from(positions.slice(n * 3, n * 3 + 3));
    tri(out, 'pavement', point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), paving);
  }
}

function enclosure(out, level) {
  pavedCourt(out);
  for (const f of faces(outer)) {
    const length = f.length;
    const [x, z] = f.origin;
    let gate = length * 0.5;
    if (Math.abs(f.along[0]) < 0.08) {
      const target = x > 0 ? 3.38 : 0.74;
      gate = (target - z) / f.along[1];
    } else if (z > 60) {
      gate = (-3.17 - x) / f.along[0];
    }
    const openSegment = length < 10;
    const opening = openSegment ? length * 0.5 - 0.12 : 3.4;
    if (openSegment) gate = length * 0.5;
    const intervals = openSegment
      ? []
      : gate < opening || gate > length - opening
        ? [[0, length]]
        : [
            [0, gate - opening],
            [gate + opening, length],
          ];
    for (const [from, to] of intervals) {
      fbox(out, 'wall', f, from, to, -2.2, terrace + 1.14, -0.54, 0.04, plinthBrick);
      if (level >= 1)
        fbox(out, 'trim', f, from, to, terrace + 1.11, terrace + 1.31, -0.67, 0.17, dress);
    }
    if (intervals.length === 1) continue;
    const n = level === 0 ? 2 : level === 1 ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const t = i / n,
        y = terrace - (terrace - 0.06) * t;
      fbox(
        out,
        'pavement',
        f,
        gate - opening + 0.17,
        gate + opening - 0.17,
        -1.3,
        y,
        -0.12 + t * 2.73,
        0.08 + ((i + 1) * 2.73) / n,
        agedPaving,
      );
    }
    if (level >= 2) {
      for (const side of [-1, 1]) {
        const u = gate + side * (opening + 0.09);
        fbox(out, 'trim', f, u - 0.33, u + 0.33, terrace - 0.14, terrace + 1.49, -0.8, 0.39, stone);
        fbox(
          out,
          'trim',
          f,
          u - 0.41,
          u + 0.41,
          terrace + 1.46,
          terrace + 1.64,
          -0.87,
          0.49,
          dress,
        );
      }
    }
  }
}

function bell(out, level) {
  const sides = level === 0 ? 16 : level === 1 ? 36 : level === 2 ? 72 : 112;
  const baseSides = level === 0 ? 16 : level === 1 ? 36 : level === 2 ? 64 : 96;
  const base = [
    [terrace - 0.06, 54.4],
    [terrace + 1.83, 54.4],
    [terrace + 2.01, 53.75],
    [terrace + 2.05, 51.73],
    [terrace + 3.14, 51.73],
    [terrace + 3.32, 51.12],
    [terrace + 3.38, 49.33],
    [terrace + 4.65, 49.33],
    [terrace + 4.87, 48.7],
    [terrace + 4.87, 47.29],
  ];
  const rings = level === 0 ? base.filter((_, i) => [0, 1, 3, 4, 6, 7, 9].includes(i)) : base;
  lathe(
    out,
    'wall',
    [0, 0],
    rings.map(([y, r]) => circle(y, r)),
    baseSides,
    plinthBrick,
    { capTop: false },
  );
  const stages = level === 0 ? 7 : level === 1 ? 14 : level === 2 ? 24 : 36;
  const domeHeight = 43.84;
  const profile = Array.from({ length: stages + 1 }, (_, i) => {
    const rise = i / stages;
    const radius = 47.29 * Math.sqrt(1 - 0.885 * rise);
    return [terrace + 4.86 + domeHeight * rise, radius, radius * (1 - 0.003 * rise)];
  });
  lathe(out, 'dome', [0, 0], profile, sides, brick, { capTop: true });
}

function top(out, level) {
  const y = terrace + 48.54;
  const r = 11.43;
  abox(out, 'dome', [-r, y - 0.68, -r], [r, y + 9.89, r], upperBrick);
  abox(out, 'wall', [-r - 0.27, y - 0.08, -r - 0.27], [r + 0.27, y + 0.59, r + 0.27], edgeBrick);
  abox(out, 'wall', [-r - 0.39, y + 9.42, -r - 0.39], [r + 0.39, y + 9.91, r + 0.39], edgeBrick);
  if (level >= 1) {
    const square = outwardRing([
      [-r, -r],
      [-r, r],
      [r, r],
      [r, -r],
    ]);
    for (const f of faces(square)) {
      fbox(out, 'wall', f, 0, f.length, y + 8.78, y + 9.04, -0.025, 0.2, edgeBrick);
      fbox(out, 'wall', f, 0, f.length, y + 0.94, y + 1.16, -0.027, 0.18, edgeBrick);
      if (level >= 2) {
        const step = level === 2 ? 2.96 : 1.82;
        for (let u = 1.12; u < f.length - 0.36; u += step)
          fbox(out, 'wall', f, u - 0.205, u + 0.205, y + 1.56, y + 8.54, 0.008, 0.15, plinthBrick);
        for (const h of [3.45, 5.16, 6.88])
          fbox(out, 'wall', f, 0.71, f.length - 0.71, y + h, y + h + 0.16, 0.015, 0.095, edgeBrick);
      }
    }
  }
  const drum = [
    [y + 9.86, 5.11],
    [y + 10.17, 5.15],
    [y + 10.65, 4.64],
    [y + 12.08, 4.58],
    [y + 12.57, 4.75],
    [y + 12.85, 4.56],
    [y + 14.22, 4.26],
    [y + 14.45, 4.39],
  ];
  const spire = [
    [y + 14.36, 4.29],
    [y + 15.37, 4.18],
    [y + 16.8, 3.98],
    [y + 18.61, 3.66],
    [y + 20.11, 3.22],
    [y + 21.55, 2.64],
    [y + 23.35, 1.75],
    [y + 24.55, 0.84],
    [y + 25.52, 0.25],
  ];
  const sides = level === 0 ? 10 : level === 1 ? 18 : level === 2 ? 32 : 48;
  const drumProfile = level === 0 ? drum.filter((_, i) => [0, 2, 4, 7].includes(i)) : drum;
  const spireProfile = level === 0 ? spire.filter((_, i) => i % 2 === 0) : spire;
  lathe(
    out,
    'wall',
    [0, 0],
    drumProfile.map(([h, r]) => circle(h, r)),
    sides,
    upperBrick,
    { capTop: false },
  );
  lathe(
    out,
    'dome',
    [0, 0],
    spireProfile.map(([h, r]) => circle(h, r)),
    sides,
    upperBrick,
    { capTop: true },
  );
  if (level >= 1) {
    lathe(
      out,
      'metal',
      [0, 0],
      [
        [y + 25.42, 0.29],
        [y + 25.61, 0.4],
        [y + 25.96, 0.42],
        [y + 26.24, 0.19],
        [terrace + 75.2856, 0.034],
      ].map(([h, r]) => circle(h, r)),
      level >= 2 ? 16 : 10,
      bronze,
      { capTop: true },
    );
  }
}

function stoneFront(out, f, level) {
  const u = f.length / 2;
  const body = [
    [0, 0.57, 7.13, 1.42],
    [0.57, 0.99, 6.31, 1.12],
    [0.99, 2.1, 5.7, 0.79],
    [2.1, 2.57, 6.47, 1.19],
    [2.57, 3.79, 5.28, 0.72],
    [3.79, 4.13, 6.03, 0.91],
    [4.13, 4.59, 5.49, 0.63],
    [4.59, 4.86, 5.23, 0.49],
  ];
  for (const [bottom, high, half, d] of level === 0 ? [body[0], body[2], body[4], body[7]] : body)
    fbox(
      out,
      'trim',
      f,
      u - half,
      u + half,
      terrace + bottom,
      terrace + high,
      -2.34,
      d,
      bottom === 0.99 || bottom === 2.57 ? figuredStone : dress,
    );
  if (level === 0) return;
  for (const dx of [-6.1, 6.1]) {
    fbox(
      out,
      'trim',
      f,
      u + dx - 0.43,
      u + dx + 0.43,
      terrace + 0.42,
      terrace + 4.5,
      -0.72,
      1.31,
      stone,
    );
    fbox(
      out,
      'trim',
      f,
      u + dx - 0.53,
      u + dx + 0.53,
      terrace + 4.42,
      terrace + 4.84,
      -0.83,
      1.49,
      dress,
    );
    if (level >= 2)
      fbox(
        out,
        'trim',
        f,
        u + dx - 0.28,
        u + dx + 0.28,
        terrace + 1.61,
        terrace + 3.68,
        1.28,
        1.44,
        figuredStone,
      );
  }
  if (level >= 2) {
    const spacing = level === 2 ? 1.42 : 0.93;
    for (let x = -4.48; x < 4.73; x += spacing) {
      fbox(
        out,
        'trim',
        f,
        u + x - 0.24,
        u + x + 0.24,
        terrace + 1.18,
        terrace + 1.95,
        0.751,
        0.925,
        dress,
      );
      if (level === 3)
        fbox(
          out,
          'trim',
          f,
          u + x - 0.198,
          u + x + 0.198,
          terrace + 2.82,
          terrace + 3.6,
          0.703,
          0.84,
          stone,
        );
    }
  }
}

function build(out, level) {
  enclosure(out, level);
  bell(out, level);
  top(out, level);
  for (const f of [
    wallFace([-7.1, 53.45], [7.1, 53.45]),
    wallFace([53.45, 7.1], [53.45, -7.1]),
    wallFace([7.1, -53.45], [-7.1, -53.45]),
    wallFace([-53.45, -7.1], [-53.45, 7.1]),
  ])
    stoneFront(out, f, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'abhayagiri-vihara-model.mjs';
const camera = [183, 115, 194];
const lookAt = [0, 26, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-buddhist-stupa',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Anuradhapura’s restored Abhayagiri stupa with a brick dome, three basal rings, four stone frontispieces and a paved square terrace.',
  camera,
  lookAt,
  sunDirection: [-54, 63, 78],
  mediumFiContext: {
    scale: 1.13,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The named circular footprint encloses the stupa and its three basal brick courses.',
  },
  groundCutout: {
    outline: outer.map(([x, z]) => [x * 0.993, z * 0.993]),
    basis:
      'Within the mapped wall the model uses the conserved flat paving, while the original Copernicus surface remains visible outside.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-entry-and-brick-dome', position: [-2, 14, 133], lookAt: [0, 32, 0] },
    { name: 'stone-frontispiece-and-three-rings', position: [39, 13, 94], lookAt: [0, 9, 48] },
    { name: 'square-chamber-and-restored-spire', position: [105, 81, 100], lookAt: [3, 61, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'abhayagiri-vihara-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.22,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
};
