import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { mappedPodium, radii, operatorTowerBodyHeightM, operatorSteelMastHeightM } = read(
  'native-map/n-seoul-tower-shape-controls',
);
const podium = outwardRing(mappedPodium);
const center = [0, 0];
const totalHeight = operatorTowerBodyHeightM + operatorSteelMastHeightM;
const mainRadius = radii.mainDeck;
const upperRadius = radii.upperDeck;
const tau = 2 * Math.PI;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.14 },
  glass: { slot: 'window', localRef: 'palette:#53605b', roughness: 0.37, metallic: 0.11 },
};
const colors = {
  shaft: rgb('d1d1c2'),
  base: rgb('99978d'),
  roof: rgb('a3a399'),
  trim: rgb('c4c4b9'),
  pane: rgb('526766'),
  palePane: rgb('647b75'),
  apron: rgb('707a75'),
  crown: rgb('acafa1'),
  red: rgb('9e4238'),
  white: rgb('cbcbc0'),
  frame: rgb('aeb8a9'),
  darker: rgb('7c8480'),
};

const storeys = [
  [91.0, 95.86, mainRadius, colors.pane],
  [96.65, 100.5, mainRadius, colors.palePane],
  [101.29, 105.05, mainRadius * 0.94, colors.pane],
  [105.79, 109.22, mainRadius * 0.92, colors.palePane],
  [110.3, 114.24, upperRadius, colors.pane],
  [115.0, 118.88, upperRadius * 0.96, colors.palePane],
];
const mast = [
  [135.7, 149.6, radii.baseAntenna, 2.65, true],
  [149.6, 171.4, 2.65, 2.28, false],
  [171.4, 180.5, 2.28, 1.82, true],
  [180.5, 193.5, 1.82, 1.54, false],
  [193.5, 207.15, 1.54, 1.2, true],
  [207.15, 212.8, 1.2, 0.96, false],
  [212.8, 223.4, 0.96, 0.68, true],
  [223.4, 232.3, 0.68, 0.44, false],
  [232.3, totalHeight, 0.44, 0.14, true],
];

function round(out, slot, profile, sides, color, caps) {
  lathe(
    out,
    slot,
    center,
    profile.map(([y, radius]) => [y, radius, radius]),
    sides,
    color,
    caps,
  );
}

function band(out, slot, bottom, top, radius, sides, color) {
  round(
    out,
    slot,
    [
      [bottom, radius],
      [top, radius],
    ],
    sides,
    color,
    { capTop: false },
  );
}

function edgePoint(angle, radius, y) {
  return [radius * Math.cos(angle), y, radius * Math.sin(angle)];
}

function glazing(out, bottom, top, radius, sides, color, level) {
  band(out, 'glass', bottom, top, radius, sides, color);
  if (level < 2) return;
  const bars = level === 3 ? sides : sides / 2;
  for (let i = 0; i < bars; i++) {
    const angle = (i * tau) / bars;
    beam(
      out,
      'steel',
      edgePoint(angle, radius + 0.038, bottom + 0.09),
      edgePoint(angle, radius + 0.038, top - 0.05),
      0.12,
      0.12,
      colors.frame,
    );
  }
  if (level === 3) {
    band(out, 'steel', bottom + 0.29, bottom + 0.4, radius + 0.105, sides, colors.frame);
  }
}

function observationHead(out, sides, level) {
  round(
    out,
    'concrete',
    [
      [84.9, 4.13],
      [87.15, mainRadius * 0.51],
      [90.9, mainRadius],
    ],
    sides,
    colors.apron,
    { capTop: false, capBottom: true },
  );
  if (level === 0) {
    round(
      out,
      'glass',
      [
        [90.9, mainRadius],
        [100.8, mainRadius],
        [105.2, mainRadius * 0.94],
        [110.0, mainRadius * 0.91],
        [110.25, upperRadius],
        [119.05, upperRadius],
      ],
      sides,
      colors.pane,
      { capTop: false },
    );
    for (const height of [95.9, 101.1, 108.3, 114.6]) {
      const r = height < 101 ? mainRadius : height < 110 ? mainRadius * 0.95 : upperRadius;
      band(out, 'steel', height, height + 0.74, r + 0.05, sides, colors.trim);
    }
  } else {
    for (const [i, [bottom, top, radius, tint]] of storeys.entries()) {
      glazing(out, bottom, top, radius, sides, tint, level);
      const next = storeys[i + 1];
      const yNext = next?.[0] ?? 120.05;
      const rNext = next?.[2] ?? upperRadius * 0.95;
      round(
        out,
        'steel',
        [
          [top, radius],
          [top + 0.18, radius + 0.21],
          [yNext - 0.14, rNext + 0.2],
          [yNext, rNext],
        ],
        sides,
        colors.trim,
        { capTop: false },
      );
    }
  }
  round(
    out,
    'roof',
    [
      [118.86, upperRadius * 0.98],
      [120.08, upperRadius * 1.02],
      [124.7, upperRadius * 0.9],
      [128.3, upperRadius * 0.67],
      [131.2, 3.89],
      [operatorTowerBodyHeightM, 3.12],
    ],
    sides,
    colors.crown,
  );
  if (level > 0) {
    for (const [y, r] of [
      [121.25, upperRadius * 0.99],
      [125.4, upperRadius * 0.87],
      [129.0, 5.46],
    ]) {
      band(out, 'steel', y, y + 0.2, r + 0.095, sides, colors.darker);
    }
  }
}

function antennas(out, level) {
  const sides = level < 2 ? 4 : 6;
  for (const [i, [bottom, top, radius, next, red]] of mast.entries()) {
    const tint = red ? colors.red : colors.white;
    if (level < 2 || i >= 5) {
      round(
        out,
        'steel',
        [
          [bottom, radius],
          [top, next],
        ],
        sides,
        tint,
        { capTop: false },
      );
      continue;
    }
    const panels = Math.max(2, Math.round((top - bottom) / (level === 2 ? 5.1 : 3.3)));
    for (let p = 0; p < panels; p++) {
      const t0 = p / panels;
      const t1 = (p + 1) / panels;
      const y0 = bottom + (top - bottom) * t0;
      const y1 = bottom + (top - bottom) * t1;
      const r0 = radius + (next - radius) * t0;
      const r1 = radius + (next - radius) * t1;
      const beamWidth = 0.13 + r0 * 0.045;
      for (let s = 0; s < 4; s++) {
        const a = (s * tau) / 4 + tau / 8;
        const b = a + tau / 4;
        const a0 = edgePoint(a, r0, y0);
        const a1 = edgePoint(a, r1, y1);
        const b0 = edgePoint(b, r0, y0);
        const b1 = edgePoint(b, r1, y1);
        beam(out, 'steel', a0, a1, beamWidth, beamWidth, tint);
        beam(out, 'steel', a0, b0, beamWidth, beamWidth, tint);
        beam(out, 'steel', a0, b1, beamWidth * 0.62, beamWidth * 0.62, tint);
        if (level === 3) beam(out, 'steel', b0, a1, beamWidth * 0.47, beamWidth * 0.47, tint);
      }
    }
  }
  if (level > 0) {
    for (const [y, r, tint] of [
      [137.5, 3.15, colors.red],
      [148.0, 3.06, colors.red],
      [169.8, 2.63, colors.white],
      [179.2, 2.19, colors.red],
      [192.85, 2.04, colors.white],
      [212.3, 1.28, colors.white],
    ]) {
      band(out, 'steel', y, y + 0.86, r, 8, tint);
    }
  }
}

function entrancePodium(out, level) {
  extrude(out, 'base', podium, -17.2, -1.35, colors.base, { top: false });
  extrude(out, 'concrete', podium, -1.36, 10.3, colors.shaft, {
    topSlot: 'roof',
    topColor: colors.roof,
  });
  for (const [i, point] of podium.entries()) {
    const face = wallFace(point, podium[(i + 1) % podium.length]);
    const length = face.length;
    if (length < 2.4) continue;
    fbox(out, 'steel', face, 0, length, 9.85, 10.36, -0.24, 0.13, colors.trim);
    for (const [bottom, top] of [
      [0.0, 2.65],
      [4.32, 7.86],
    ]) {
      const left = 0.23;
      const right = length - 0.23;
      quad4(
        out,
        'glass',
        face.P(left, bottom, 0.03),
        face.P(right, bottom, 0.03),
        face.P(right, top, 0.03),
        face.P(left, top, 0.03),
        colors.pane,
      );
      if (level >= 1) {
        const count = Math.ceil(length / (level === 1 ? 5.3 : 2.35));
        for (let p = 1; p < count; p++) {
          const u = (length * p) / count;
          fbox(out, 'steel', face, u - 0.057, u + 0.057, bottom, top, 0.02, 0.11, colors.frame);
        }
      }
    }
    if (level > 1) {
      fbox(out, 'steel', face, 0.01, length - 0.01, 11.08, 11.26, -0.34, -0.24, colors.frame);
      const railCount = Math.ceil(length / (level === 3 ? 2.05 : 3.65));
      for (let s = 0; s < railCount; s++) {
        const u = (length * (s + 0.5)) / railCount;
        fbox(out, 'steel', face, u - 0.06, u + 0.06, 10.29, 11.26, -0.34, -0.22, colors.frame);
      }
    }
  }
}

function build(sink, level) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  const sides = [12, 20, 32, 56][level];
  entrancePodium(out, level);
  round(
    out,
    'concrete',
    [
      [-1.0, 4.96],
      [12.0, 4.73],
      [46.5, 4.39],
      [83.5, 4.02],
      [87, 4.12],
    ],
    sides,
    colors.shaft,
    { capTop: false },
  );
  if (level >= 1) {
    band(out, 'steel', 11.26, 11.64, 4.78, sides, colors.trim);
    band(out, 'steel', 83.14, 84.08, 4.12, sides, colors.apron);
  }
  observationHead(out, sides, level);
  antennas(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'n-seoul-tower-model.mjs';
const camera = [160, 151, 313];
const lookAt = [0, 113, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'N Seoul Tower with its mapped low pavilion, white concrete stem, stepped green-gray glazed observation levels and red-and-white steel antenna.',
  camera,
  lookAt,
  sunDirection: [-29, 55, 40],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: podium,
    minimumCoverage: 0.94,
    basis:
      'Relation 16474080 provides the integral summit pavilion footprint below the broadcasting shaft.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-footprint-caps.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'pavilion-and-stem', position: [74, 23, 98], lookAt: [0, 10, -5] },
    { name: 'observation-deck-and-crown', position: [-75, 124, 87], lookAt: [0, 106, 0] },
    { name: 'red-and-white-mast', position: [57, 216, 137], lookAt: [0, 182, 0] },
    { name: 'tower-over-namsan', position: [-210, 61, -294], lookAt: [0, 115, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'n-seoul-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.235, surfaces },
      street: { export: 'street', errorMeters: 0.095, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.032, surfaces },
    },
  },
};
