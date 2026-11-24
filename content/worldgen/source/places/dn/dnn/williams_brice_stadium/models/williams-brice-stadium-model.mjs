import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fan,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const controls = read('native-map/williams-brice-survey-controls');
const colors = {
  deck: rgb('9e9786'),
  concrete: rgb('b3a996'),
  pale: rgb('bdb39d'),
  step: rgb('ada592'),
  dark: rgb('655e52'),
  glass: rgb('44494b'),
  metal: rgb('787c75'),
  white: rgb('e9e5d4'),
  garnet: rgb('762e38'),
  grass: rgb('687e46'),
  edge: rgb('59623f'),
  paint: rgb('dedfc6'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.92 },
  steps: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93 },
};

function planRing(x, z, y, radius, arcSteps) {
  const points = [];
  for (let corner = 0; corner < 4; corner++) {
    const angle = ((1 - corner) * Math.PI) / 2;
    const sx = corner === 0 || corner === 1 ? 1 : -1;
    const sz = corner === 0 || corner === 3 ? 1 : -1;
    for (let j = 0; j <= arcSteps; j++) {
      const theta = angle - (j * Math.PI) / (2 * arcSteps);
      points.push([
        sx * (x - radius) + radius * Math.cos(theta),
        y,
        sz * (z - radius) + radius * Math.sin(theta),
      ]);
    }
  }
  return points;
}

function annulus(out, a, b, slot, tone) {
  for (let i = 0; i < a.length; i++) {
    const j = (i + 1) % a.length;
    quad4(out, slot, b[i], b[j], a[j], a[i], tone);
  }
}

function field(out, level) {
  const [x, z] = [plan.dimensions.fieldWidthM, plan.dimensions.fieldLengthM].map((d) => d / 2);
  const surface = (a, b, c, d, y, shade) =>
    quad4(out, 'detail', [a, y, b], [a, y, d], [c, y, d], [c, y, b], shade);
  const pitchEdge = planRing(33, 62, 0.015, 10, 3);
  loft(out, 'steps', [pitchEdge.map(([px, , pz]) => [px, -0.7, pz]), pitchEdge], colors.edge, {
    cap: false,
  });
  fan(out, 'detail', pitchEdge, colors.edge);
  surface(-x, -z, x, z, 0.027, colors.grass);
  const paint = (a, b, c, d) => surface(a, b, c, d, 0.048, colors.paint);
  for (const sign of [-1, 1]) {
    surface(-x, sign < 0 ? -z : z - 9.1, x, sign < 0 ? -z + 9.1 : z, 0.036, colors.garnet);
    paint(-x, sign * z - 0.075, x, sign * z + 0.075);
    paint(sign * x - 0.065, -z, sign * x + 0.065, z);
    const poleZ = sign * (z + 0.7);
    if (level > 0) {
      const bar = (a, b) => beam(out, 'detail', a, b, 0.11, 0.11, rgb('dfbc52'));
      bar([0, 0.12, poleZ + sign], [0, 3.05, poleZ]);
      bar([-2.82, 3.05, poleZ], [2.82, 3.05, poleZ]);
      for (const offset of [-2.82, 2.82]) bar([offset, 3.05, poleZ], [offset, 9.0, poleZ]);
    }
  }
  const n = level === 0 ? 5 : 10;
  for (let i = 0; i <= 2 * n; i++) {
    const y = ((i - n) * 45.72) / n;
    paint(-x, y - 0.058, x, y + 0.058);
  }
}

function lowerBowl(out, level) {
  const runs = [2, 6, 17, 31][level];
  const arcs = [1, 2, 4, 6][level];
  const shape = (t, y) => planRing(32 + 28 * t, 61 + 23 * t, y, 10 + 12 * t, arcs);
  for (let i = 0; i < runs; i++) {
    const t = i / runs;
    const u = (i + 1) / runs;
    const y = 1.1 + t * 14.5;
    const inner = shape(t, y);
    loft(
      out,
      'steps',
      [shape(t, y - 14.5 / runs).reverse(), inner.slice().reverse()],
      i % 3 ? colors.step : colors.deck,
      {
        cap: false,
      },
    );
    annulus(out, inner, shape(u, y), 'steps', i % 4 === 0 ? colors.pale : colors.step);
  }
  const rim = shape(1, 15.58);
  loft(out, 'concrete', [shape(1, -1.22), rim], colors.concrete, { cap: false });
  loft(out, 'detail', [shape(0, 0.07).reverse(), shape(0, 1.09).reverse()], colors.garnet, {
    cap: false,
  });
  annulus(out, rim, planRing(61.2, 85.15, 15.58, 22, arcs), 'detail', colors.garnet);
}

function upperDeck(out, side, level) {
  const west = side === -1;
  const span = west ? Math.abs(controls.westStands.bounds[0][0]) : controls.eastStands.bounds[0][1];
  const rows = [2, 6, 17, 28][level];
  const sections = [3, 7, 17, 23][level];
  const halfLength = west ? 82 : 85;
  const halfWidth = west ? 118 : 115;
  const point = (t, u, y) => [
    side * (55 + (halfWidth - 55) * t - u * u * (7 + 11 * t)),
    y,
    halfLength * u,
  ];
  const rimHeight = west ? 35.8 : 35.4;
  const range = rimHeight - 16.35;
  const strip = (a, b, low, high, slot, color, outer = false) => {
    for (let i = 0; i < sections; i++) {
      const u = (2 * i) / sections - 1;
      const v = (2 * (i + 1)) / sections - 1;
      const q = [point(a, u, low), point(a, v, low), point(b, v, high), point(b, u, high)];
      if ((side === -1) !== outer) q.reverse();
      quad4(out, slot, ...q, color);
    }
  };
  if (level < 2) {
    strip(0, 1, 16.35, rimHeight - 0.64, 'steps', colors.step);
    for (const t of [0.27, 0.56, 0.83]) {
      strip(
        t,
        t + 0.016,
        16.39 + t * (range - 0.64),
        16.39 + (t + 0.016) * (range - 0.64),
        'steps',
        colors.pale,
      );
    }
  } else {
    for (let i = 0; i < rows; i++) {
      const t = i / rows;
      const y = 16.35 + t * range;
      strip(t, t, y - range / rows, y, 'steps', colors.deck);
      strip(t, (i + 1) / rows, y, y, 'steps', i % 4 === 0 ? colors.pale : colors.step);
    }
  }
  strip(0, 1, 15.05, rimHeight - 1.75, 'concrete', colors.dark, true);
  strip(1, 1, rimHeight - 1.75, rimHeight, 'concrete', colors.pale, true);
  strip(1, 1, rimHeight - 1.8, rimHeight - 1.3, 'detail', colors.garnet, true);
  for (const u of [-1, 1]) {
    const p = [
      point(0, u, 15.05),
      point(1, u, rimHeight - 1.75),
      point(1, u, rimHeight - 0.65),
      point(0, u, 16.35),
    ];
    if (side * u < 0) p.reverse();
    quad4(out, 'concrete', ...p, colors.pale);
  }

  const pierCount = [3, 5, 10, 12][level];
  const lightY = west ? plan.dimensions.westDeckMaxM : plan.dimensions.eastDeckMaxM;
  for (let i = 0; i < pierCount; i++) {
    const z = ((i / (pierCount - 1)) * 1.78 - 0.89) * halfLength;
    const u = z / halfLength;
    const x = Math.abs(point(1, u, 0)[0]);
    const pier = (offset, y) => [side * (x + offset), y, z];
    beam(out, 'concrete', pier(-12, -1.1), pier(-12, 25), 2.05, 2.8, colors.concrete);
    beam(out, 'concrete', pier(-12, 23), pier(-0.9, rimHeight - 1), 2.6, 2.7, colors.pale);
    if (level > 0) {
      beam(out, 'concrete', pier(-21, -0.7), pier(-21, 18.6), 1.45, 1.43, colors.concrete);
      beam(out, 'concrete', pier(-23, 8.9), pier(-2.8, 8.9), 0.81, 1.65, colors.pale);
      beam(out, 'concrete', pier(-23, 14), pier(-2.8, 14), 0.81, 1.44, colors.pale);
    }
  }
  const banks = [3, 5, 8, 10][level];
  let previous;
  for (let i = 0; i < banks; i++) {
    const z = ((i / (banks - 1)) * 1.84 - 0.92) * halfLength;
    const x = Math.abs(point(1, z / halfLength, 0)[0]);
    const upper = [side * (x + 1.2), lightY - 0.53, z];
    beam(out, 'metal', [side * (x - 1), rimHeight - 0.45, z], upper, 0.8, 1.1, colors.metal);
    if (previous) beam(out, 'detail', previous, upper, 1.04, 0.64, colors.white);
    previous = upper;
  }
  if (west) {
    abox(out, 'concrete', [-span, 31.2, -32.5], [-span + 14.1, 42.25, 32.5], colors.pale);
    for (const y of [33.2, 37.15]) {
      abox(out, 'detail', [-span + 14.08, y, -30], [-span + 14.2, y + 1.64, 30], colors.glass);
      if (level > 1) {
        for (let z = -28; z < 29; z += level === 2 ? 5.35 : 3.1) {
          abox(
            out,
            'metal',
            [-span + 14.2, y, z],
            [-span + 14.29, y + 1.64, z + 0.19],
            colors.metal,
          );
        }
      }
    }
  }
}

function endArchitecture(out, level) {
  const z = controls.field.bounds[1][1];
  const southRoof = plan.dimensions.southDeckMaxM;
  const tiers = [2, 5, 13, 18][level];
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const u = (i + 1) / tiers;
    const back = z + 20 + 18.8 * u;
    abox(
      out,
      'steps',
      [-40 - 10 * t, 13.6, z + 20 + 18.8 * t],
      [40 + 10 * t, 15 + 9.7 * t, back],
      i % 3 === 0 ? colors.pale : colors.step,
    );
  }
  abox(out, 'concrete', [-47.3, -1.15, 81.1], [47.3, southRoof, 107], colors.concrete);
  abox(out, 'detail', [-44, 16.6, 107], [44, 19.95, 107.08], colors.glass);
  abox(out, 'steps', [-48, southRoof - 0.52, 80.5], [48, southRoof + 0.19, 107.5], colors.deck);
  abox(
    out,
    'detail',
    [-47.5, southRoof - 0.77, 107.0],
    [47.5, southRoof - 0.41, 107.52],
    colors.garnet,
  );
  if (level > 0) {
    for (const y of [5.25, 11.35, 15.8]) {
      abox(out, 'steps', [-47.7, y, 106.2], [47.7, y + 0.54, 107.61], colors.pale);
    }
    for (let x = -42; x <= 42; x += 7) {
      abox(out, 'detail', [x - 1.65, 0.15, 107.0], [x + 1.65, 4.55, 107.08], colors.dark);
    }
  }
  abox(out, 'concrete', [-36, -1.0, -98], [36, 13.05, -81], colors.pale);
  abox(out, 'metal', [-13, 19.3, -97.7], [13, 27.1, -94.75], colors.metal);
  abox(out, 'detail', [-12.45, 20.1, -94.78], [12.45, 25.9, -94.67], colors.glass);
  for (const s of [-1, 1]) {
    abox(
      out,
      'concrete',
      [s * 9.75 - 0.58, 12.5, -97],
      [s * 9.75 + 0.58, 19.4, -96.1],
      colors.concrete,
    );
    for (const end of [-1, 1]) {
      const center = [s * (end < 0 ? 59 : 65), end * 88];
      const segments = [4, 6, 14, 20][level];
      const ring = (y, width) =>
        Array.from({ length: segments }, (_, i) => {
          const angle = (-2 * Math.PI * i) / segments;
          return [
            center[0] + Math.cos(angle) * width,
            y,
            center[1] + Math.sin(angle) * width * 0.82,
          ];
        });
      loft(out, 'concrete', [ring(-0.65, 5.8), ring(24.4, 5.8)], colors.concrete, { cap: false });
      for (let landing = 0; landing < 6; landing += level === 0 ? 3 : level === 1 ? 2 : 1) {
        const y = 2.3 + landing * 4.03;
        const bottom = ring(y - 0.64, 9.6);
        const deck = ring(y, 10.35);
        loft(out, 'steps', [bottom, deck, ring(y + 0.42, 10.35)], colors.pale, { cap: false });
        annulus(out, ring(y + 0.42, 5.8), ring(y + 0.42, 10.35), 'concrete', colors.dark);
      }
      fan(out, 'concrete', ring(24.4, 5.8), colors.pale);
    }
  }
}

function build(out, level) {
  field(out, level);
  lowerBowl(out, level);
  upperDeck(out, -1, level);
  upperDeck(out, 1, level);
  endArchitecture(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'williams-brice-stadium-model.mjs';
const camera = [-260, 155, 216];
const lookAt = [0, 12, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Williams–Brice Stadium (2006)',
  wikidataId: plan.wikidataId,
  category: 'football-stadium',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '2006-10-28',
    validFrom: '2006-01-01',
    validUntil: '2007-01-01',
  },
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 2006 Williams–Brice Stadium bowl, concrete side decks and lights, stacked access ramps and enlarged south end.',
  camera,
  lookAt,
  sunDirection: [-58, 70, 43],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_boardformed', 'concrete_plain', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-deck-and-south-entrance', position: [-225, 27, 182], lookAt: [-8, 15, 0] },
    { name: 'north-scoreboard-and-lower-bowl', position: [38, 87, 152], lookAt: [0, 13, -16] },
    { name: 'east-cantilevers-and-light-bars', position: [248, 19, -64], lookAt: [20, 19, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'williams-brice-stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.68, surfaces },
      street: { export: 'street', errorMeters: 0.27, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.082, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Mapped geometry under ODbL and USGS elevation data in the public domain.',
};
