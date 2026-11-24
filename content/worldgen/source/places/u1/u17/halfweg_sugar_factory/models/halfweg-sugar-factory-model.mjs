import fs from 'node:fs';
import {
  abox,
  lathe,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const { silos, kiln } = read('native-map/halfweg-national-heights');
const colors = {
  concrete: rgb('aba799'),
  aluminum: rgb('c0c3c1'),
  service: rgb('929891'),
  darkMetal: rgb('55595a'),
  glass: rgb('586766'),
  mirror: rgb('929b9b'),
  lobby: rgb('536262'),
  oldIron: rgb('686257'),
  agedCollar: rgb('757169'),
  guard: rgb('474b46'),
};
const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  aluminum: { slot: 'wall', graph: 'metal_stainless_beadblasted', roughness: 0.79 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.87 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.65 },
};

function ring(out, slot, center, profile, facets, color, capTop = false) {
  lathe(
    out,
    slot,
    center,
    profile.map(([height, radius]) => [height, radius, radius]),
    facets,
    color,
    { capTop },
  );
}

function diamond(out, center, angle, offset, height, width, halfHeight, color) {
  const [x, z] = center;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const point = (along, y) => [
    x + offset * cosine - along * sine,
    y,
    z + offset * sine + along * cosine,
  ];
  quad4(
    out,
    'detail',
    point(0, height - halfHeight),
    point(-width, height),
    point(0, height + halfHeight),
    point(width, height),
    color,
  );
}

function windowField(out, silo, facets, level, baseTop) {
  const columns = [6, 14, 20, 24][level];
  const floors = plan.dimensions.siloFloorCount;
  const floorSize = (silo.roofM - baseTop - 1.9) / floors;
  const angleStep = (2 * Math.PI) / facets;
  const faceRadius = silo.radius * Math.cos(angleStep / 2);
  for (let j = 0; j < floors; j += level === 0 ? 2 : 1) {
    for (let k = 0; k < columns; k++) {
      const i = Math.floor(((k + (j % 2) * 0.48) * facets) / columns);
      const angle = (i + 0.5) * angleStep;
      const y = baseTop + 0.85 + (j + 0.44) * floorSize;
      const color =
        (j + k + (silo.side === 'east' ? 1 : 0)) % 3 === 0 ? colors.mirror : colors.glass;
      diamond(out, silo.center, angle, faceRadius + 0.022, y, 1.02, 0.96, colors.darkMetal);
      if (level >= 1) diamond(out, silo.center, angle, faceRadius + 0.042, y, 0.87, 0.82, color);
    }
  }
}

function siloExterior(out, silo, level) {
  const { center, radius, gradeM, roofM, roofServiceHighM } = silo;
  const facets = [10, 32, 64, 96][level];
  const baseTop = gradeM + 4.66;
  ring(
    out,
    'concrete',
    center,
    [
      [gradeM - 0.72, radius - 0.19],
      [gradeM + 0.12, radius - 0.19],
    ],
    facets,
    colors.concrete,
    true,
  );
  ring(
    out,
    'detail',
    center,
    [
      [gradeM + 0.08, radius * 0.66],
      [baseTop - 0.19, radius * 0.66],
    ],
    facets,
    colors.lobby,
  );
  const legs = level === 0 ? 6 : 16;
  for (let i = 0; i < legs; i++) {
    const angle = (i * 2 * Math.PI) / legs;
    const x = center[0] + (radius - 1.25) * Math.cos(angle);
    const z = center[1] + (radius - 1.25) * Math.sin(angle);
    abox(
      out,
      'concrete',
      [x - 0.4, gradeM - 0.22, z - 0.59],
      [x + 0.4, baseTop + 0.23, z + 0.59],
      colors.concrete,
    );
  }
  ring(
    out,
    'concrete',
    center,
    [
      [baseTop - 0.23, radius * 0.91],
      [baseTop + 0.05, radius],
    ],
    facets,
    colors.concrete,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [baseTop, radius],
      [roofM - 0.23, radius],
    ],
    facets,
    colors.aluminum,
  );
  ring(
    out,
    'aluminum',
    center,
    [
      [roofM - 0.29, radius - 0.01],
      [roofM - 0.17, radius + 0.08],
      [roofM, radius + 0.08],
    ],
    facets,
    colors.aluminum,
  );
  ring(
    out,
    'roof',
    center,
    [
      [roofM - 0.06, radius - 0.03],
      [roofM + 0.01, radius - 0.1],
    ],
    facets,
    colors.service,
    true,
  );
  const [x, z] = center;
  abox(
    out,
    'roof',
    [x - 3.02, roofM - 0.01, z - 2.86],
    [x + 4.3, roofServiceHighM, z + 1.3],
    colors.service,
  );
  if (level >= 2) {
    abox(
      out,
      'steel',
      [x + 4.62, roofM - 0.01, z - 2.12],
      [x + 6.35, roofM + 0.48, z + 0.44],
      colors.service,
    );
  }
  windowField(out, silo, facets, level, baseTop);
}

function limeKiln(out, level) {
  const { center, gradeM, radius, topM } = kiln;
  const facets = [8, 20, 32, 48][level];
  const upper = topM - 3.16;
  ring(
    out,
    'concrete',
    center,
    [
      [gradeM - 0.72, radius + 0.24],
      [gradeM + 1.4, radius + 0.24],
    ],
    facets,
    colors.concrete,
  );
  ring(
    out,
    'steel',
    center,
    [
      [gradeM + 1.33, radius - 0.45],
      [12.3, radius - 0.49],
      [16.3, radius - 0.08],
      [upper - 5.68, radius - 0.03],
      [upper - 0.68, radius + 0.15],
      [upper + 0.15, radius + 0.15],
    ],
    facets,
    colors.oldIron,
  );
  ring(
    out,
    'steel',
    center,
    [
      [upper - 0.02, radius + 0.12],
      [upper + 0.19, radius + 0.61],
      [upper + 0.66, radius + 0.61],
      [upper + 0.79, radius + 0.18],
    ],
    facets,
    colors.agedCollar,
    true,
  );
  ring(
    out,
    'steel',
    center,
    [
      [upper + 0.58, radius - 0.4],
      [topM - 0.15, radius - 0.36],
      [topM, radius - 0.4],
    ],
    facets,
    colors.oldIron,
    true,
  );
  if (level >= 1) {
    for (const height of [12.9, 17.1, 27.8, 33.1]) {
      ring(
        out,
        'detail',
        center,
        [
          [height, radius - 0.56],
          [height + 0.21, radius + 0.35],
          [height + 0.47, radius + 0.35],
          [height + 0.57, radius - 0.03],
        ],
        facets,
        colors.guard,
      );
    }
    const [x, z] = center;
    abox(
      out,
      'steel',
      [x + radius - 0.16, gradeM + 0.32, z - 0.55],
      [x + radius + 0.28, upper + 0.6, z - 0.38],
      colors.guard,
    );
    abox(
      out,
      'steel',
      [x + radius - 0.16, gradeM + 0.32, z + 0.44],
      [x + radius + 0.28, upper + 0.6, z + 0.61],
      colors.guard,
    );
    if (level >= 2) {
      for (let y = 1.1; y < upper; y += level === 2 ? 0.94 : 0.47) {
        abox(
          out,
          'detail',
          [x + radius + 0.09, y, z - 0.41],
          [x + radius + 0.2, y + 0.045, z + 0.48],
          colors.guard,
        );
      }
    }
  }
}

function entryPods(out, level) {
  for (const silo of silos) {
    const [x, z] = silo.center;
    const y = silo.gradeM;
    abox(
      out,
      'concrete',
      [x + 12.35, y - 0.36, z - 17.4],
      [x + 16.38, y + 3.35, z - 7.05],
      colors.concrete,
    );
    abox(
      out,
      'roof',
      [x + 12.26, y + 3.32, z - 17.49],
      [x + 16.45, y + 3.52, z - 7],
      colors.service,
    );
    if (level >= 1) {
      abox(
        out,
        'detail',
        [x + 13.1, y + 0.19, z - 17.44],
        [x + 15.63, y + 2.74, z - 17.39],
        colors.glass,
      );
    }
  }
}

function build(out, level) {
  for (const silo of silos) siloExterior(out, silo, level);
  entryPods(out, level);
  limeKiln(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'halfweg-sugar-factory-model.mjs';
const camera = [112, 64, 114];
const lookAt = [11, 21, 6];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Halfweg Sugar Factory',
  wikidataId: plan.wikidataId,
  category: 'industrial-heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The former Halfweg Sugar Factory’s two circular aluminum-clad silos and surviving lime kiln.',
  camera,
  lookAt,
  sunDirection: [-42, 75, -64],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis:
      'BAG footprint of the western silo. East silo and kiln retained as independently located parts.',
  },
  embeddedCanonicalGraphs: [
    'concrete_plain',
    'metal_stainless_beadblasted',
    'metal_standing_seam',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'paired-silos-from-plaza', position: [-6, 7.6, -61], lookAt: [-8, 24, 0] },
    { name: 'exposed-silo-bases', position: [20, 3.4, -38], lookAt: [-7, 5.1, 0] },
    { name: 'preserved-lime-kiln', position: [89, 22, 52], lookAt: [57, 23, 29] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'halfweg-sugar-factory-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.76,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. OpenStreetMap geometry under ODbL and Dutch AHN elevation data under the published open data terms.',
};
