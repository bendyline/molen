import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, eave, ridge, roofOverhang } = plan.dimensions;
const [westRear, rearBend, rearJoin, eastRear, eastFront, frontBend, westFront] =
  frame.geometry.outline;
const surfaces = {
  render: { slot: 'wall', graph: 'stucco', roughness: 0.97 },
  thatch: { slot: 'roof', graph: 'thatch', roughness: 0.98 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.79 },
};
const lime = rgb('e5dfca');
const reed = rgb('75634b');
const reedEdge = rgb('907855');
const timber = rgb('5c5947');
const rock = rgb('95887a');
const glass = rgb('393833');
const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sections = [
  [westRear, westFront, ridge],
  [rearBend, interpolate(westFront, frontBend, 0.935), ridge - 0.1],
  [rearJoin, frontBend, ridge - 0.08],
  [eastRear, eastFront, ridge + 0.13],
];

function roof(out, lod) {
  const crossSection = (a, b, h) => {
    const mid = interpolate(a, b, 0.53);
    const across = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const slope = lod === 0 ? [0, 1] : lod === 1 ? [0, 0.67, 1] : [0, 0.16, 0.54, 0.79, 0.93, 1];
    const make = (edge) =>
      slope.map((t) => {
        const [x, z] = interpolate(edge, mid, t);
        const y = eave + (h - eave) * (t + (lod > 0 ? 0.21 * t * (1 - t) : 0));
        const overhang = roofOverhang * (1 - t);
        return [
          x + ((edge[0] - mid[0]) * overhang * 2) / across,
          y,
          z + ((edge[1] - mid[1]) * overhang * 2) / across,
        ];
      });
    return [make(a), make(b), [mid[0], h, mid[1]]];
  };
  const strips = sections.map((section) => crossSection(...section));
  for (let i = 0; i < strips.length - 1; i++) {
    const [back, front, peak] = strips[i],
      [nextBack, nextFront, nextPeak] = strips[i + 1];
    for (let j = 0; j < back.length - 1; j++) {
      quad4(
        out,
        'thatch',
        front[j],
        nextFront[j],
        nextFront[j + 1],
        front[j + 1],
        j === 0 ? reedEdge : reed,
      );
      quad4(
        out,
        'thatch',
        nextBack[j],
        back[j],
        back[j + 1],
        nextBack[j + 1],
        j === 0 ? reedEdge : reed,
      );
    }
    for (const [A, B] of [
      [front[0], nextFront[0]],
      [nextBack[0], back[0]],
    ]) {
      quad4(out, 'thatch', [A[0], A[1] - 0.22, A[2]], [B[0], B[1] - 0.22, B[2]], B, A, reedEdge);
    }
    if (lod > 0) {
      const offset = (p, d, y) => [p[0], p[1] + y, p[2] + d];
      quad4(
        out,
        'trim',
        offset(peak, 0.08, 0.035),
        offset(nextPeak, 0.08, 0.035),
        offset(nextPeak, -0.08, 0.035),
        offset(peak, -0.08, 0.035),
        timber,
      );
    }
  }
  for (const [i, swap] of [
    [0, false],
    [sections.length - 1, true],
  ]) {
    const [a, b] = sections[i];
    const [, , peak] = strips[i];
    const [u, v] = swap ? [b, a] : [a, b];
    tri(out, 'render', [u[0], eave, u[1]], [v[0], eave, v[1]], peak, lime);
    const gable = wallFace(u, v);
    if (lod > 0) {
      const m = swap ? gable.length * 0.46 : gable.length * 0.58;
      if (swap) window(out, gable, m, 1.16, 0.16, 0.77, lod, 'slit');
      else window(out, gable, gable.length - 1.31, 0.13, 0.79, 1.82, lod, 'door');
    }
  }
}

function window(out, F, u, y, w, h, lod, type = 'sash') {
  if (type === 'door')
    fbox(out, 'stone', F, u - w * 0.64, u + w * 0.64, 0.007, 0.11, 0.04, 0.24, rock);
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: type === 'door' ? timber : glass,
    frame: timber,
    d: 0.042,
    frameWidth: lod > 1 ? 0.057 : 0,
    sill: lod > 1 && type === 'sash',
    mullions: lod > 2 && type === 'sash' ? 1 : 0,
    transoms: lod > 2 && type === 'sash' ? 1 : 0,
    frameDepth: 0.09,
  });
  if (lod > 1 && type === 'sash') {
    for (const side of [-1, 1]) {
      const edge = u + side * w * 0.72;
      fbox(out, 'trim', F, edge - w * 0.17, edge + w * 0.17, y, y + h + 0.03, 0.03, 0.083, timber);
    }
  }
}

function faces(out, lod) {
  const front = wallFace(westFront, frontBend);
  const barn = wallFace(frontBend, eastFront);
  const rear = wallFace(rearBend, westRear);
  const rearBarn = wallFace(eastRear, rearJoin);
  window(out, front, 1.72, 0.92, 0.66, 0.87, lod);
  window(out, front, 4.14, 0.13, 0.89, 1.82, lod, 'door');
  window(out, front, 7.18, 0.96, 0.65, 0.83, lod);
  window(out, front, 10.28, 0.89, 0.66, 0.91, lod);
  window(out, front, 13.45, 0.13, 0.92, 1.86, lod, 'door');
  window(out, barn, 2.53, 0.13, 1.08, 1.88, lod, 'door');
  window(out, barn, 6.49, 0.94, 0.22, 0.74, lod, 'slit');
  if (lod > 0) {
    window(out, rearBarn, 1.47, 1.0, 0.18, 0.77, lod, 'slit');
    window(out, rearBarn, 3.47, 0.13, 0.84, 1.8, lod, 'door');
    window(out, rear, 2.12, 1.05, 0.21, 0.72, lod, 'slit');
    window(out, rear, 10.62, 0.99, 0.57, 0.79, lod);
    window(out, rear, 13.88, 1.18, 0.32, 0.48, lod, 'slit');
  }
}

function chimney(out, x, z, bottom, top, width, lod) {
  abox(out, 'render', [x - width / 2, bottom, z - 0.31], [x + width / 2, top, z + 0.31], lime, {
    bottom: false,
  });
  abox(
    out,
    'stone',
    [x - width / 2 - 0.07, top - 0.12, z - 0.39],
    [x + width / 2 + 0.07, top, z + 0.39],
    rock,
  );
  if (lod > 2)
    for (const dx of [-0.22, 0.22])
      abox(
        out,
        'trim',
        [x + dx - 0.095, top - 0.005, z - 0.11],
        [x + dx + 0.095, top + 0.075, z + 0.11],
        timber,
      );
}

function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor, rock, { top: false });
  extrude(out, 'render', frame.geometry.outline, floor, eave, lime, { top: false });
  roof(out, lod);
  faces(out, lod);
  chimney(out, -2.28, 1.1, 4.35, 5.94, 1.04, lod);
  chimney(out, 8.57, -1.12, 4.43, 5.82, 0.87, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'burns-cottage-model.mjs';
const camera = [-32, 10, 27];
const lookAt = [-1, 2.4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The low whitewashed, thatched cottage at Alloway where Robert Burns was born, with the attached byre and barn.',
  camera,
  lookAt,
  sunDirection: [-13, 44, 25],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The mapped cottage and attached byre and barn.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'southwest-gable-and-entrance-row', position: camera, lookAt },
    { name: 'southeast-reed-eaves-and-shutters', position: [1, 5, 20], lookAt: [0, 2.2, 1] },
    { name: 'bent-rear-range-and-ridge', position: [21, 9, -24], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'burns-cottage-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
