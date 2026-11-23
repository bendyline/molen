import fs from 'node:fs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const half = d.width / 2;
const end = d.depth / 2;
const colors = {
  wall: rgb('b69b82'),
  front: rgb('b9a18a'),
  recess: rgb('99816b'),
  tile: rgb('98553e'),
  tileLight: rgb('a15c43'),
  wood: rgb('494039'),
  concrete: rgb('a09482'),
  iron: rgb('3e3b35'),
  shadow: rgb('322d28'),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', metallic: 0.2, roughness: 0.79 },
};

// Outlines in wall-local coordinates. The hole rings run clockwise.
const rect = (x, w, y, h) => [
  [x - w / 2, y],
  [x - w / 2, y + h],
  [x + w / 2, y + h],
  [x + w / 2, y],
];
const arch = (x, w, base, spring, rise, steps) => [
  [x - w / 2, base],
  ...Array.from({ length: steps + 1 }, (_, i) => {
    const t = Math.PI * (1 - i / steps);
    return [x + (w / 2) * Math.cos(t), spring + rise * Math.sin(t)];
  }),
  [x + w / 2, base],
];

function plasterWall(out, F, outline, holes, thickness, color) {
  const rings = [outline, ...holes];
  const holesAt = rings
    .slice(0, -1)
    .map((_, i) => rings.slice(0, i + 1).reduce((sum, ring) => sum + ring.length, 0));
  const points = rings.flat();
  const indices = earcut(points.flat(), holesAt);
  const on = (point, face) => F.P(...point, face);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => points[j]);
    tri(out, 'plaster', on(a, 0), on(b, 0), on(c, 0), color);
    tri(out, 'plaster', on(c, -thickness), on(b, -thickness), on(a, -thickness), color);
  }
  for (const ring of rings) {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      quad4(out, 'plaster', on(a, 0), on(a, -thickness), on(b, -thickness), on(b, 0), color);
    });
  }
}

function profile(halfWidth, bottom, shoulders, crown) {
  const right = shoulders.map(([fraction, y]) => [fraction * halfWidth, y]);
  return [
    [-halfWidth, bottom],
    [halfWidth, bottom],
    ...right,
    ...crown.slice().reverse(),
    ...right
      .slice()
      .reverse()
      .map(([x, y]) => [-x, y]),
  ];
}

function inset(out, F, ring, depth, slot, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => F.P(...ring[j], depth));
    tri(out, slot, a, b, c, color);
  }
}

function facadeVolumes(out, lod) {
  const outerFace = facade([0, -end], [-1, 0]);
  const entrance = facade([0, -end - 0.26], [-1, 0]);
  const sideWindows = [-3.42, 3.42].map((x) => rect(x, 0.56, 1.8, 1.23));
  const spring = 7.15;
  const steps = [6, 8, 12, 16][lod];
  const crown = arch(0, 1.9, 5.98, spring, d.frontCrown - spring, steps).slice(1, -1);
  const bellHole = arch(0, 0.85, 6.35, 7.1, 0.31, steps);
  const outer = profile(
    half,
    d.plinth,
    [
      [1, 4.88],
      [0.94, 4.92],
      [0.85, 4.78],
      [0.72, 4.8],
      [0.6, 5.0],
      [0.47, 5.47],
      [0.34, 5.63],
      [0.26, 5.9],
    ],
    crown,
  );
  const door = rect(0, 1.88, d.landing, 2.43);
  plasterWall(
    out,
    outerFace,
    outer,
    [bellHole, door, ...sideWindows],
    d.wallThickness,
    colors.wall,
  );
  for (const ring of sideWindows) inset(out, outerFace, ring, -0.16, 'wood', colors.shadow);

  const innerShoulders = [
    [1, 4.28],
    [0.97, 4.64],
    [0.87, 4.87],
    [0.72, 5.0],
    [0.6, 5.2],
    [0.46, 5.52],
    [0.36, 5.64],
    [0.29, 5.84],
  ];
  const recesses = [-1.91, 1.91].map((x) => arch(x, 0.43, 1.6, 2.32, 0.18, steps / 2));
  const raised = profile(2.6, d.plinth + 0.015, innerShoulders, [
    [-0.7, 5.99],
    [0.7, 5.99],
  ]);
  plasterWall(out, entrance, raised, [door, ...recesses], 0.255, colors.front);
  inset(out, entrance, door, -0.22, 'wood', colors.wood);
  for (const ring of recesses) inset(out, entrance, ring, -0.14, 'plaster', colors.recess);

  const bellZ = -end + 0.16;
  fbox(out, 'metal', outerFace, -0.43, 0.43, 6.63, 6.675, -0.16, -0.11, colors.iron);
  const rings = [
    [6.365, 0.22],
    [6.41, 0.171],
    [6.55, 0.126],
    [6.61, 0.076],
  ];
  const sides = [6, 8, 10, 12][lod];
  for (let j = 0; j + 1 < rings.length; j++) {
    const ringPoint = (i, k) => {
      const [y, r] = rings[k];
      const t = (-2 * Math.PI * i) / sides;
      return [r * Math.cos(t), y, bellZ + r * Math.sin(t)];
    };
    for (let i = 0; i < sides; i++) {
      quad4(
        out,
        'metal',
        ringPoint(i, j),
        ringPoint(i + 1, j),
        ringPoint(i + 1, j + 1),
        ringPoint(i, j + 1),
        colors.iron,
      );
    }
  }
}

function nave(out, lod) {
  for (const sign of [-1, 1]) {
    const F = facade([sign * half, 0], [0, -sign]);
    const u = d.sideWindowCenters.map((z) => -sign * z);
    const windows = u.map((x) => rect(x, 0.84, 1.79, 1.56));
    const sideDoor = sign < 0 ? [rect(5.88, 0.89, 0.38, 2.08)] : [];
    plasterWall(
      out,
      F,
      rect(0, d.depth - 0.25, d.plinth, d.eave - d.plinth).reverse(),
      [...windows, ...sideDoor],
      d.wallThickness,
      colors.wall,
    );
    for (const opening of [...windows, ...sideDoor])
      inset(out, F, opening, -0.17, 'wood', colors.wood);
    if (lod >= 2) {
      for (const x of u) {
        fbox(out, 'wood', F, x - 0.038, x + 0.038, 1.81, 3.34, -0.16, -0.115, colors.wood);
        fbox(out, 'wood', F, x - 0.42, x + 0.42, 2.55, 2.585, -0.16, -0.115, colors.wood);
      }
    }
  }
  const rear = facade([0, end], [1, 0]);
  plasterWall(
    out,
    rear,
    [
      [-half, d.plinth],
      [half, d.plinth],
      [half, d.eave],
      [0, d.ridge],
      [-half, d.eave],
    ],
    [],
    d.wallThickness,
    colors.wall,
  );
  const edge = half + 0.24;
  const y = (x) => d.ridge + 0.09 - (Math.abs(x) / edge) * (d.ridge - d.eave + 0.13);
  const frontZ = -end + 0.08;
  const backZ = end + 0.25;
  for (const [a, b] of [
    [-edge, 0],
    [0, edge],
  ]) {
    quad4(
      out,
      'roof',
      [a, y(a), frontZ],
      [a, y(a), backZ],
      [b, y(b), backZ],
      [b, y(b), frontZ],
      colors.tile,
    );
    quad4(
      out,
      'wood',
      [b, y(b) - 0.15, frontZ],
      [b, y(b) - 0.15, backZ],
      [a, y(a) - 0.15, backZ],
      [a, y(a) - 0.15, frontZ],
      colors.wood,
    );
    quad4(
      out,
      'wood',
      [a, y(a) - 0.15, backZ],
      [b, y(b) - 0.15, backZ],
      [b, y(b), backZ],
      [a, y(a), backZ],
      colors.wood,
    );
    if (lod >= 2) {
      const courses = lod === 3 ? 28 : 14;
      for (let i = 1; i < courses; i++) {
        const z = frontZ + ((backZ - frontZ) * i) / courses;
        const p = (x, dz, dy) => [x, y(x) + dy, z + dz];
        quad4(
          out,
          'roof',
          p(a, 0, 0.045),
          p(a, 0.1, 0.012),
          p(b, 0.1, 0.012),
          p(b, 0, 0.045),
          i % 3 === 1 ? colors.tileLight : colors.tile,
        );
        quad4(out, 'roof', p(a, 0, 0), p(a, 0, 0.045), p(b, 0, 0.045), p(b, 0, 0), colors.tile);
      }
    }
  }
  for (const x of [-edge, edge]) {
    abox(
      out,
      'wood',
      [x - 0.055, d.eave - 0.19, frontZ],
      [x + 0.055, d.eave - 0.015, backZ],
      colors.wood,
    );
  }
}

function entranceDetails(out, lod) {
  for (let i = 1; i <= 3; i++) {
    abox(
      out,
      'concrete',
      [-1.27, -0.11, -end - 1.47 + 0.33 * (i - 1)],
      [1.27, (d.landing * i) / 3, -end - 0.27],
      colors.concrete,
    );
  }
  if (lod === 0) return;
  const low = [0, 0.98, -end - 1.34];
  const high = [0, 1.25, -end - 0.51];
  beam(out, 'metal', low, high, 0.036, 0.036, colors.iron);
  beam(out, 'metal', [0, 0.13, low[2]], low, 0.036, 0.036, colors.iron);
  beam(out, 'metal', [0, 0.41, high[2]], high, 0.036, 0.036, colors.iron);
  if (lod < 2) return;
  const F = facade([0, -end - 0.26], [-1, 0]);
  fbox(out, 'wood', F, -0.017, 0.017, 0.47, 2.83, -0.216, -0.192, colors.shadow);
  fbox(out, 'metal', F, -0.16, 0.16, 3.56, 3.64, 0.01, 0.35, colors.iron);
  if (lod === 3) {
    for (const x of [-3.42, 3.42]) {
      for (const offset of [-0.17, 0, 0.17])
        fbox(
          out,
          'metal',
          F,
          x + offset - 0.013,
          x + offset + 0.013,
          1.83,
          3.0,
          -0.38,
          -0.346,
          colors.iron,
        );
    }
  }
}

function build(out, lod) {
  facadeVolumes(out, lod);
  nave(out, lod);
  entranceDetails(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'san-pedro-chapel-model.mjs';
const camera = [15, 10, -22];
const lookAt = [0, 3.1, -1.0];
const levels = { district: 0.25, street: 0.11, closeup: 0.035 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Tucson’s standing Mission Revival adobe chapel with a shaped northern parapet, open bell arch, and small red-tiled nave.',
  camera,
  lookAt,
  sunDirection: [10, 20, -14],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Only the mapped chapel way is replaced by its measured adobe exterior.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-parapet-and-entry', position: [0, 5.4, -22.5], lookAt: [0, 3.9, -6.85] },
    { name: 'east-nave-and-bell-arch', position: [16.5, 8.5, -12.5], lookAt: [0, 3.25, -1.55] },
    { name: 'west-nave-and-south-gable', position: [-16.5, 9.25, 13.5], lookAt: [0, 2.9, 0.75] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'san-pedro-chapel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.57,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(levels).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
