import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const load = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = load('plan-controls');
const frame = load('map-frame');
const terrain = load('terrain-grid');
const outerRadius = plan.dimensions.mainCaveaDiameterM / 2;
const orchestra = 1.1;
const centerZ = 0.9;
const colors = {
  stone: rgb('a6967b'),
  edge: rgb('ac9c81'),
  dark: rgb('887a66'),
  rubble: rgb('998973'),
  column: rgb('b7a78a'),
  columnCap: rgb('bcae92'),
  paving: rgb('a29e93'),
  stage: rgb('b7ae9d'),
  opening: rgb('524b3f'),
  benches: ['b0a187', 'a5967e', 'b1a48c', 'aa9a81', 'a99982', 'bcac90', 'a3947c'].map(rgb),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.95 },
  seat: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95 },
  column: { slot: 'trim', graph: 'stone_travertine', roughness: 0.91 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.97 },
};
const aisleAngles = [0.3, 0.81, 1.34, 1.88, 2.41, 2.9];
const begin = -0.092,
  end = Math.PI + 0.102;
const arc = (r, y, a) => [r * Math.cos(a), y, centerZ - r * Math.sin(a)];

function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}
function siteY(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const [r0, r1] = terrain.heightsMeters.slice(j, j + 2);
  return (
    (1 - b) * ((1 - a) * r0[i] + a * r0[i + 1]) +
    b * ((1 - a) * r1[i] + a * r1[i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function segment(out, radius0, radius1, y0, y1, a, b, color, risers = true) {
  if (risers) {
    quad4(
      out,
      'seat',
      arc(radius0, y0, b),
      arc(radius0, y0, a),
      arc(radius0, y1, a),
      arc(radius0, y1, b),
      colors.dark,
    );
  }
  quad4(
    out,
    'seat',
    arc(radius0, y1, a),
    arc(radius1, y1, a),
    arc(radius1, y1, b),
    arc(radius0, y1, b),
    color,
  );
}
function bayTop(out, r0, r1, y0, y1, a, b, level, row) {
  const size = [2, 2, 6, 9][level];
  for (let j = 0; j < size; j++) {
    const from = a + ((b - a) * j) / size,
      to = a + ((b - a) * (j + 1)) / size;
    segment(
      out,
      r0,
      r1,
      y0,
      y1,
      from,
      to,
      colors.benches[(row * 3 + j * 2) % colors.benches.length],
    );
  }
}
function stairs(out, r0, r1, y0, y1, a, b, level) {
  const count = level > 1 ? 2 : 1;
  for (let j = 0; j < count; j++) {
    const i = j / count,
      next = (j + 1) / count;
    const r = r0 + (r1 - r0) * i,
      far = r0 + (r1 - r0) * next;
    segment(out, r, far, y0 + (y1 - y0) * i, y0 + (y1 - y0) * next, a, b, colors.rubble);
  }
  if (count === 2) {
    const landing = (r0 + r1) / 2;
    const halfRise = (y0 + y1) / 2;
    quad4(
      out,
      'seat',
      arc(landing, halfRise, a),
      arc(r0, halfRise, a),
      arc(r0, y1, a),
      arc(landing, y1, a),
      colors.rubble,
    );
    quad4(
      out,
      'seat',
      arc(r0, halfRise, b),
      arc(landing, halfRise, b),
      arc(landing, y1, b),
      arc(r0, y1, b),
      colors.rubble,
    );
  }
}
function tierData(level) {
  const reserved = { rows: 5, inner: 4.12, outer: 9.54, rise: 1.13 };
  const tiers = [
    reserved,
    { rows: 9, inner: 9.54, outer: 18.25, rise: 4.95 },
    { rows: 6, inner: 18.25, outer: 25.41, rise: 4.68 },
    { rows: 4, inner: 25.41, outer: outerRadius, rise: 4.24 },
  ];
  return tiers.map((tier, index) => ({
    ...tier,
    rows: level === 0 ? [2, 2, 2, 2][index] : tier.rows,
  }));
}
function cavea(out, level) {
  const breaks = level === 0 ? [0.8, 1.88, 2.9] : aisleAngles;
  let y = orchestra,
    row = 0;
  for (const tier of tierData(level)) {
    const rise = tier.rise / tier.rows,
      width = (tier.outer - tier.inner) / tier.rows;
    for (let j = 0; j < tier.rows; j++) {
      const r0 = tier.inner + j * width,
        r1 = r0 + width;
      const stepHalf = Math.min(0.077, 0.51 / r1);
      let a = begin;
      for (const b of breaks) {
        bayTop(out, r0, r1, y, y + rise, a, b - stepHalf, level, row);
        stairs(out, r0, r1, y, y + rise, b - stepHalf, b + stepHalf, level);
        a = b + stepHalf;
      }
      bayTop(out, r0, r1, y, y + rise, a, end, level, row);
      row++;
      y += rise;
    }
  }
  const pieces = [14, 32, 52, 70][level];
  const retainingPeak = orchestra + plan.dimensions.caveaOverallRiseM;
  for (let j = 0; j < pieces; j++) {
    const a = begin + ((end - begin) * j) / pieces,
      b = begin + ((end - begin) * (j + 1)) / pieces;
    const [x0, , z0] = arc(outerRadius, 0, a),
      [x1, , z1] = arc(outerRadius, 0, b);
    const ya = siteY(x0, z0) - 0.62,
      yb = siteY(x1, z1) - 0.62;
    const topA = retainingPeak + 0.4 + 0.24 * Math.cos(a * 7.0),
      topB = retainingPeak + 0.4 + 0.24 * Math.cos(b * 7.0);
    quad4(out, 'stone', [x0, ya, z0], [x1, yb, z1], [x1, topB, z1], [x0, topA, z0], colors.rubble);
    quad4(
      out,
      'stone',
      arc(outerRadius + 0.64, topA, a),
      arc(outerRadius + 0.64, topB, b),
      arc(outerRadius - 0.06, topB, b),
      arc(outerRadius - 0.06, topA, a),
      colors.edge,
    );
    quad4(
      out,
      'stone',
      arc(outerRadius - 0.06, retainingPeak - 0.19, b),
      arc(outerRadius - 0.06, retainingPeak - 0.19, a),
      arc(outerRadius - 0.06, topA, a),
      arc(outerRadius - 0.06, topB, b),
      colors.dark,
    );
    if (level > 1 && j % 4 === 1) {
      const u = a + (b - a) * 0.18,
        v = a + (b - a) * 0.79;
      for (let i = 1; i < 5; i++) {
        const h = retainingPeak - 1.7 * i;
        quad4(
          out,
          'stone',
          arc(outerRadius + 0.021, h, u),
          arc(outerRadius + 0.021, h, v),
          arc(outerRadius + 0.04, h + 0.046, v),
          arc(outerRadius + 0.04, h + 0.046, u),
          colors.dark,
        );
      }
    }
  }
  for (const a of [begin, end]) {
    const near = arc(9.6, orchestra, a),
      outer = arc(outerRadius, retainingPeak, a);
    const lower = [outer[0], siteY(outer[0], outer[2]) - 0.46, outer[2]];
    const inward = [near[0], siteY(near[0], near[2]) - 0.42, near[2]];
    const v = a === begin ? [near, inward, lower, outer] : [outer, lower, inward, near];
    quad4(out, 'stone', ...v, colors.rubble);
  }
}

function orchestraFloor(out, level) {
  const segments = [8, 16, 24, 36][level],
    r = 4.19,
    z = 0.4;
  for (let j = 0; j < segments; j++) {
    const from = (Math.PI * j) / segments,
      to = (Math.PI * (j + 1)) / segments;
    const p = (a) => [r * Math.cos(a), orchestra, z - r * Math.sin(a)];
    tri(
      out,
      'paving',
      [0, orchestra, z],
      p(from),
      p(to),
      j % 5 === 4 ? colors.stage : colors.paving,
    );
  }
  box(out, 'paving', [-4.14, 0.45, z - 0.04], [4.14, orchestra, 3.2], colors.paving);
}
function shaft(out, x, z, y, height, r, level, cap) {
  if (level === 0) {
    box(out, 'column', [x - r, y, z - r], [x + r, y + height, z + r], colors.column);
    return;
  }
  const n = [5, 8, 11, 16][level];
  const collar = Math.min(0.16, height / 5);
  const center = [x, z];
  box(
    out,
    'column',
    [x - r * 1.38, y, z - r * 1.38],
    [x + r * 1.38, y + collar, z + r * 1.38],
    colors.columnCap,
  );
  const form = [
    [y + collar, r],
    [y + collar + 0.08, r * 0.91],
    [y + height - collar, r * 0.78],
    [y + height, r * (cap ? 1.15 : 0.79)],
  ];
  loft(
    out,
    'column',
    form.map(([level, rad]) => radialRing(level, rad, rad, n, center)),
    colors.column,
    { cap: false },
  );
  if (cap) {
    box(
      out,
      'column',
      [x - r * 1.23, y + height, z - r * 1.23],
      [x + r * 1.23, y + height + 0.22, z + r * 1.23],
      colors.columnCap,
    );
  }
  if (level === 3 && height > 3.2) {
    for (const band of [0.31, 0.62]) {
      const h = y + height * band,
        rr = r * (1 - 0.23 * band);
      loft(
        out,
        'stone',
        [radialRing(h, rr, rr, n, center), radialRing(h + 0.07, rr + 0.014, rr + 0.014, n, center)],
        colors.edge,
        { cap: false },
      );
    }
  }
}
function stage(out, level) {
  const w = plan.dimensions.stageWidthM / 2,
    depth = plan.dimensions.stageDepthM,
    z = 3.82;
  const top = 2.03;
  box(out, 'paving', [-w, 0.48, z], [w, top, z + depth], colors.stage);
  const f = facade([0, z - 0.038], [-1, 0]);
  for (let j = 0; j < 13; j++) {
    if (level === 0 && j % 2 === 1) continue;
    const x = -w + 1.41 + j * 2.82;
    if (j === 2 || j === 10) {
      for (let k = level === 0 ? 2 : 0; k < 4; k++) {
        fbox(
          out,
          'paving',
          f,
          x - 0.77,
          x + 0.77,
          orchestra - 0.11,
          orchestra + 0.22 * (k + 1),
          0.02,
          1.26 - k * 0.28,
          colors.stage,
        );
      }
    } else {
      fbox(out, 'stone', f, x - 0.96, x + 0.96, orchestra - 0.22, 2.02, -0.2, 0.42, colors.rubble);
      if (level > 1) {
        fbox(out, 'paving', f, x - 1.07, x + 1.07, 1.76, 2.07, -0.13, 0.48, colors.edge);
      }
    }
  }
  const zones = [
    {
      center: 15.28,
      width: 5.35,
      columns: [
        [-1.5, 4.35, true],
        [0.75, 4.45, true],
        [2.0, 2.14, false],
      ],
      lintel: [-1.61, 0.94, 4.44],
    },
    {
      center: 8.8,
      width: 5.74,
      columns: [
        [-1.8, 5.35, true],
        [0.05, 5.41, true],
        [1.83, 2.2, false],
      ],
      lintel: [-2.06, 0.38, 5.51],
    },
    {
      center: 2.8,
      width: 3.55,
      columns: [
        [-1.14, 4.12, false],
        [0.37, 4.71, false],
        [1.39, 3.03, false],
      ],
    },
    {
      center: -4.88,
      width: 6.83,
      columns: [
        [-2.64, 5.3, true],
        [-0.83, 5.32, true],
        [0.92, 5.38, true],
        [2.43, 5.37, true],
      ],
      lintel: [-2.79, 2.66, 5.54],
    },
    {
      center: -11.15,
      width: 3.1,
      columns: [
        [-0.9, 2.75, false],
        [0.71, 3.29, false],
      ],
    },
  ];
  for (const zone of zones) {
    const { center, width, columns, lintel } = zone;
    const half = width / 2;
    box(
      out,
      'stone',
      [center - half, top - 0.08, 8.28],
      [center + half, top + 0.62, 10.92],
      colors.rubble,
    );
    box(
      out,
      'column',
      [center - half - 0.08, top + 0.61, 8.19],
      [center + half + 0.08, top + 0.83, 10.99],
      colors.columnCap,
    );
    for (let i = 0; i < columns.length; i++) {
      const [x, h, cap] = columns[i];
      shaft(out, center + x, 8.91 + 0.21 * (i % 2), top + 0.79, h, 0.32, level, cap);
    }
    if (lintel) {
      const [x0, x1, y] = lintel;
      box(
        out,
        'column',
        [center + x0, top + 0.75 + y, 8.44],
        [center + x1, top + 1.19 + y, 9.62],
        colors.columnCap,
      );
    }
  }
  for (const [x0, x1, z0, z1, h] of [
    [-18.42, -14.18, 9.68, 11.28, 8.51],
    [-20.57, -18.36, 10.0, 15.1, 4.34],
    [18.27, 21.03, 9.16, 15.17, 4.96],
    [-20.4, -17.83, 15.16, 19.79, 2.99],
    [18.48, 22.35, 15.2, 19.96, 2.67],
    [-13.6, -9.1, 19.51, 20.9, 1.55],
    [8.38, 16.17, 18.1, 19.24, 1.81],
  ]) {
    box(out, 'stone', [x0, -0.46, z0], [x1, h, z1], colors.rubble);
    if (level > 0) {
      box(
        out,
        'stone',
        [x0 + 0.08, h - 0.015, z0 + 0.12],
        [x1 - 0.28, h + 0.2, z1 - 0.11],
        colors.stone,
      );
    }
  }
  for (const [x, z, y, h] of [
    [-16.91, 9.39, 8.4, 3.94],
    [-15.58, 9.72, 8.38, 2.11],
    [-17.2, 8.8, 2.53, 5.44],
    [-15.4, 8.39, 2.52, 5.49],
    [-13.64, 9.82, 2.04, 2.6],
  ]) {
    shaft(out, x, z, y, h, 0.3, level, false);
  }
}

function build(out, level) {
  cavea(out, level);
  orchestraFloor(out, level);
  stage(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'roman-theatre-of-dougga-model.mjs';
const camera = [48, 42, -63],
  lookAt = [0, 4.6, -0.8];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Roman Theatre of Dougga',
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
    'Standing Roman theatre with a limestone seating bowl, stepped aisles, small orchestra and partial stage colonnade.',
  camera,
  lookAt,
  sunDirection: [-32, 57, -46],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis: 'Mapped Roman theatre envelope, seating cavea and stage terraces.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone_weathered', 'stone_travertine'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cavea-and-standing-stage-colonnade', position: [0, 18, -30], lookAt: [0, 4.0, 3] },
    { name: 'stage-ruins-and-radial-stairways', position: [28, 23, 20], lookAt: [0, 6, -12] },
    { name: 'orchestra-and-three-cavea-tiers', position: [0.8, 4.2, 3.4], lookAt: [0, 7.6, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'roman-theatre-of-dougga-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.94,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.4, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.071, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geography under ODbL and Mapzen elevations under source attribution terms.',
};
