import fs from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const plan = read('../plan-controls.json');
const frame = read('../map-frame.json');
const { local: hallFootprint } = read('../native-map/phra-that-choeng-chum-hall-footprint.json');
const dimensions = plan.dimensions;
const materials = {
  white: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  whiteTrim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.87 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  glazed: { slot: 'roof', graph: 'tile_glazed', roughness: 0.77 },
  gilding: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.74, metallic: 0.15 },
  red: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
};
const white = rgb('e2dfd3');
const chalk = rgb('efe9da');
const pale = rgb('d8d4c7');
const base = rgb('aaa699');
const terracotta = rgb('b76a42');
const deepRed = rgb('733b2b');
const green = rgb('536a53');
const yellow = rgb('b99b50');
const brightGold = rgb('d1b063');
const coffee = rgb('552d24');
const dark = rgb('3f3c34');
const stupaY = 0.59;

function strip(out, slot, F, a, b, lower, upper, inset, tint) {
  quad4(
    out,
    slot,
    F.P(a, lower, inset),
    F.P(b, lower, inset),
    F.P(b, upper, inset),
    F.P(a, upper, inset),
    tint,
  );
}

function square(y, half, cz, cx = 0, chamfer = 0) {
  if (chamfer > 0) return chamferedRectangle(cx, y + stupaY, cz, half * 2, half * 2, chamfer);
  return [
    [-half, -half],
    [-half, half],
    [half, half],
    [half, -half],
  ].map(([x, z]) => [cx + x, y + stupaY, cz + z]);
}

function squareShell(out, slot, shape, tint, bevel = false, cap = false) {
  loft(
    out,
    slot,
    shape.map(([y, r]) => square(y, r, 0, 0, bevel ? r * 0.085 : 0)),
    tint,
    { cap },
  );
}

const mainTaper = [
  [-1.89, 4.21],
  [0.09, 4.25],
  [0.35, 4.25],
  [0.68, 3.92],
  [0.99, 3.89],
  [1.08, 3.76],
  [3.96, 3.28],
  [5.37, 3.01],
  [5.53, 3.04],
  [5.78, 3.04],
  [5.95, 2.86],
  [8.86, 2.48],
  [9.16, 2.47],
  [9.22, 2.55],
  [9.47, 2.51],
  [9.56, 2.27],
  [12.28, 2.09],
  [12.93, 1.92],
  [13.02, 1.91],
  [13.23, 1.73],
  [13.43, 1.73],
  [13.64, 1.48],
  [13.78, 1.48],
  [14.12, 1.29],
  [14.31, 1.57],
  [14.53, 1.57],
  [14.66, 1.37],
  [14.93, 1.37],
  [15.13, 1.5],
  [15.42, 1.51],
  [15.6, 1.38],
];
const giltProfile = [
  [15.59, 1.38],
  [15.84, 1.42],
  [16.43, 1.38],
  [16.91, 1.29],
  [17.55, 1.11],
  [18.18, 0.94],
  [18.91, 0.63],
  [19.59, 0.37],
  [19.68, 0.53],
  [19.85, 0.51],
  [19.94, 0.38],
  [20.11, 0.55],
  [20.28, 0.41],
  [20.5, 0.39],
  [21.38, 0.27],
  [21.71, 0.19],
  [21.82, 0.25],
  [22.08, 0.16],
  [22.37, 0.12],
];
function stupa(out, lod) {
  const paleProfile =
    lod === 0
      ? mainTaper.filter((_, index) => [0, 2, 4, 6, 9, 11, 14, 17, 21, 24, 28, 30].includes(index))
      : mainTaper;
  squareShell(out, 'white', paleProfile, white, lod > 1);
  const tip =
    lod === 0
      ? giltProfile.filter((_, index) => [0, 3, 6, 8, 12, 14, 16, 18].includes(index))
      : giltProfile;
  squareShell(out, 'gilding', tip, yellow, lod > 1);
  const rings = lod === 0 ? 4 : 10;
  const end = dimensions.stupaHeight;
  const finial = [
    [22.36, 0.13],
    [22.77, 0.115],
    [23.23, 0.081],
    [end, 0.009],
  ];
  loft(
    out,
    'gilding',
    finial.map(([y, r]) => radialRing(y + stupaY, r, r, rings)),
    brightGold,
    { cap: true },
  );
  if (lod > 0)
    for (let i = 0; i < 7; i++) {
      const y = 22.39 + i * 0.18;
      const r = 0.168 - i * 0.012;
      loft(
        out,
        'gilding',
        [
          [y, r * 0.65],
          [y + 0.052, r],
          [y + 0.083, r * 0.68],
        ].map(([height, rad]) => radialRing(height + stupaY, rad, rad, rings)),
        brightGold,
        { cap: false },
      );
    }
  const walls = [
    { F: facade([0, 3.55], [1, 0]), east: false },
    { F: facade([3.55, 0], [0, -1]), east: true },
    { F: facade([0, -3.55], [-1, 0]), east: false },
    { F: facade([-3.55, 0], [0, 1]), east: false },
  ];
  for (const { F, east } of walls) portal(out, F, east, lod);
  if (lod > 1) {
    for (const F of [
      facade([0, 2.515], [1, 0]),
      facade([2.515, 0], [0, -1]),
      facade([0, -2.515], [-1, 0]),
      facade([-2.515, 0], [0, 1]),
    ]) {
      for (let step = -4; step <= 4; step++) {
        const u = step * 0.48;
        opening(out, F, u, 9.19 + stupaY, 0.34, 0.25, {
          head: 'round',
          glassSlot: 'gilding',
          glass: yellow,
          frameWidth: 0,
          sill: false,
          d: 0.045,
        });
      }
    }
  }
}

function portal(out, F, east, lod) {
  const ground = stupaY + 0.33;
  const plaster = (u0, u1, y0, y1, d0, d1, tint = chalk) =>
    fbox(out, 'whiteTrim', F, u0, u1, y0 + ground, y1 + ground, d0, d1, tint);
  plaster(-1.34, 1.34, -0.51, 0.21, -0.26, 1.21, pale);
  for (const u of [-0.86, 0.86]) {
    plaster(u - 0.32, u + 0.32, 0.1, 0.35, -0.28, 0.97);
    plaster(u - 0.17, u + 0.17, 0.3, 2.76, -0.45, 0.81);
    plaster(u - 0.27, u + 0.27, 2.73, 2.91, -0.42, 0.95);
    if (lod > 1) plaster(u - 0.28, u + 0.28, 0.35, 0.53, -0.31, 0.89, pale);
  }
  plaster(-0.82, 0.82, 0.15, 2.72, -0.28, 0.74, east ? pale : chalk);
  opening(out, F, 0, ground + 0.22, 1.24, 3.54, {
    head: 'pointed',
    glassSlot: 'door',
    frameSlot: 'whiteTrim',
    glass: east ? dark : coffee,
    frame: chalk,
    frameWidth: lod === 0 ? 0 : 0.14,
    frameDepth: 0.15,
    sill: false,
    d: 0.855,
    rise: 0.71,
  });
  const apex = F.P(0, ground + 4.28, 0.58);
  tri(
    out,
    'whiteTrim',
    F.P(-1.19, ground + 2.86, 0.53),
    F.P(1.19, ground + 2.86, 0.53),
    apex,
    white,
  );
  if (lod > 0) {
    const roofL = [
      F.P(-1.23, ground + 2.77, 0.94),
      F.P(-0.82, ground + 3.33, 0.75),
      F.P(-0.43, ground + 3.54, 0.56),
      apex,
    ];
    const roofR = [
      F.P(1.23, ground + 2.77, 0.94),
      F.P(0.82, ground + 3.33, 0.75),
      F.P(0.43, ground + 3.54, 0.56),
      apex,
    ];
    beamPath(out, 'whiteTrim', roofL, 0.095, 0.15, chalk);
    beamPath(out, 'whiteTrim', roofR, 0.095, 0.15, chalk);
    for (const [y, r] of [
      [4.01, 0.47],
      [4.33, 0.33],
      [4.7, 0.21],
    ])
      plaster(-r, r, y, y + 0.13, -0.42, 0.29);
  }
}

const hallArms = [
  { start: [4.47, -0.29], end: [14.42, -0.1], half: 4.75, edge: 4.15, ridge: 9.11 },
  { start: [29.7, -0.51], end: [14.42, -0.1], half: 5.11, edge: 4.18, ridge: 9.23 },
  { start: [14.96, 8.71], end: [14.42, -0.1], half: 5.18, edge: 4.23, ridge: 9.46 },
  { start: [15.16, -10.42], end: [14.42, -0.1], half: 4.63, edge: 4.42, ridge: 9.6 },
];
function roofArm(out, arm, lod) {
  const F = wallFace(arm.start, arm.end);
  const curving = (t) => arm.ridge + (arm.edge - arm.ridge) * t - 0.56 * Math.sin(Math.PI * t);
  const lengths = [0, 0.39, 1.07, F.length];
  const courses = [
    [0, 0.66, 0.89, 1],
    [0, 0.24, 0.56, 0.79, 0.91, 1],
    [0, 0.24, 0.56, 0.79, 0.91, 1],
    [0, 0.15, 0.31, 0.48, 0.64, 0.79, 0.91, 1],
  ][lod];
  const slope = (u, t, side) =>
    F.P(
      u,
      curving(t) +
        0.34 * Math.pow(Math.max(0, 1 - u / 1.18), 2) * (0.27 + 0.73 * Math.abs(t - 0.49) * 2),
      side * t * arm.half,
    );
  for (const side of [-1, 1]) {
    for (let i = 1; i < courses.length; i++) {
      const a = courses[i - 1],
        b = courses[i];
      const greenEdge = b > 0.89;
      for (let j = 1; j < lengths.length; j++) {
        const u = lengths[j - 1],
          v = lengths[j];
        const L = [slope(u, b, side), slope(v, b, side), slope(v, a, side), slope(u, a, side)];
        quad4(
          out,
          greenEdge ? 'glazed' : 'tile',
          ...(side > 0 ? L : L.reverse()),
          greenEdge ? green : terracotta,
        );
      }
    }
    const lip = lengths.map((u) => slope(u, 1, side));
    const barge = courses.map((t) => slope(0, t, side));
    if (lod === 0) {
      const [a, b] = [lip[0], lip.at(-1)];
      beam(out, 'whiteTrim', a, b, 0.18, 0.14, chalk);
    } else {
      beamPath(out, 'whiteTrim', lip, 0.16, 0.16, chalk);
      beamPath(out, 'whiteTrim', barge, 0.14, 0.17, chalk);
      if (lod > 1) {
        for (let i = 1; i < courses.length; i++) {
          const t = (courses[i] + courses[i - 1]) * 0.5;
          const p = slope(0, t, side);
          beam(
            out,
            'whiteTrim',
            p,
            [p[0] - F.along[0] * 0.075, p[1] + 0.23, p[2] - F.along[1] * 0.075],
            0.073,
            0.075,
            chalk,
          );
        }
      }
    }
    for (let i = 1; i < courses.length; i++) {
      const a = slope(0, courses[i - 1], side);
      const b = slope(0, courses[i], side);
      const lowA = [a[0], arm.edge - 0.37, a[2]];
      const lowB = [b[0], arm.edge - 0.37, b[2]];
      quad4(out, 'white', ...(side > 0 ? [b, a, lowA, lowB] : [a, b, lowB, lowA]), white);
    }
  }
  if (lod > 0) {
    const p = F.P(-0.04, arm.ridge + 0.16, 0);
    const chamfer = F.P(-0.36, arm.ridge + 0.74, 0);
    const tip = F.P(-0.17, arm.ridge + 1.27, 0);
    beamPath(out, 'whiteTrim', [p, chamfer, tip], 0.097, 0.11, chalk);
    beam(out, 'whiteTrim', slope(0, 0, 1), F.P(F.length, arm.ridge, 0), 0.17, 0.16, chalk);
  }
}

function hallFacade(out, lod) {
  const south = wallFace(hallFootprint[9], hallFootprint[8]);
  const w = south.length;
  fbox(out, 'whiteTrim', south, -0.025, w + 0.025, 0.55, 1.05, -0.47, 0.34, pale);
  fbox(out, 'whiteTrim', south, -0.03, w + 0.03, 1.05, 1.14, -0.08, 0.16, chalk);
  for (const u of [w * 0.24, w * 0.5, w * 0.76]) {
    if (lod === 0) {
      strip(out, 'door', south, u - 0.6, u + 0.6, 0.99, 3.98, 0.058, dark);
      continue;
    }
    opening(out, south, u, 1.04, 1.43, 3.32, {
      head: 'pointed',
      glassSlot: 'door',
      frameSlot: 'whiteTrim',
      glass: dark,
      frame: chalk,
      frameWidth: 0.125,
      frameDepth: 0.16,
      mullions: 0,
      d: 0.048,
      rise: 0.42,
    });
    fbox(out, 'red', south, u - 0.75, u - 0.65, 1.08, 3.88, -0.04, 0.145, deepRed);
    if (lod > 1)
      for (const edge of [-0.93, 0.93])
        fbox(
          out,
          'whiteTrim',
          south,
          u + edge - 0.07,
          u + edge + 0.07,
          1.01,
          4.42,
          -0.07,
          0.18,
          chalk,
        );
  }
  if (lod === 0) return;
  for (const [ia, ib] of [
    [11, 10],
    [7, 6],
    [6, 5],
    [3, 2],
    [1, 0],
  ]) {
    const F = wallFace(hallFootprint[ia], hallFootprint[ib]);
    if (F.length < 4.5) continue;
    for (let u = 1.0; u < F.length - 0.6; u += 2.25) {
      strip(out, 'window', F, u - 0.37, u + 0.37, 1.77, 3.3, 0.074, dark);
      fbox(out, 'whiteTrim', F, u - 0.49, u + 0.49, 1.63, 1.8, -0.06, 0.13, pale);
    }
  }
}

function hall(out, lod) {
  extrude(out, 'footing', hallFootprint, -1.42, 0.69, base, { top: false });
  extrude(out, 'white', hallFootprint, 0.63, 4.56, white, { top: false });
  const faces = earcut(hallFootprint.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces
      .slice(i, i + 3)
      .map((index) => [hallFootprint[index][0], 4.55, hallFootprint[index][1]]);
    tri(out, 'white', a, c, b, pale);
  }
  for (const arm of hallArms) roofArm(out, arm, lod);
  hallFacade(out, lod);
}

function build(out, lod) {
  stupa(out, lod);
  hall(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'wat-phra-that-choeng-chum-model.mjs';
const camera = [36, 20, 51];
const lookAt = [9, 10, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces: materials,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The square, white Lan Xang stupa with its gilt spire and the orange-and-green roof of the adjoining viharn in Sakon Nakhon.',
  camera,
  lookAt,
  sunDirection: [-23, 41, 53],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The named square mapped stupa body.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(materials).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-doorways-and-gilt-spire', position: [15, 5.7, 45], lookAt: [8, 11.5, 1] },
    { name: 'four-gabled-orange-and-green-roof', position: [40, 27, 29], lookAt: [16, 4.8, 0] },
    { name: 'stupa-portals-and-step-bands', position: [-13, 12, 28], lookAt: [0, 10.1, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'choeng-chum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.79,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces: materials },
      street: { export: 'street', errorMeters: 0.14, surfaces: materials },
      closeup: { export: 'closeup', errorMeters: 0.067, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
