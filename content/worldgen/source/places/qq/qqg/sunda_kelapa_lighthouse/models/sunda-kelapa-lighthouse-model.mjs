import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const geometry = read('native-map/sunda-kelapa-lighthouse-shape-controls');
const radius = geometry.shaftRadius;
const color = Object.fromEntries(
  Object.entries({
    stucco: 'ddd4c4',
    lower: 'c9c0ad',
    stone: 'baab94',
    chalk: 'e5ddcc',
    rail: '67665d',
    iron: '69645a',
    shade: '58554d',
    glass: '6e7d80',
    lamp: 'b78e54',
    deep: '403f37',
    timber: '696052',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  shaft: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  gallery: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.9 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.93 },
};
const verticalProfile = [
  [-0.23, radius * 0.994],
  [0.68, radius * 0.986],
  [2.84, radius * 0.963],
  [5.82, radius * 0.937],
  [8.98, radius * 0.906],
  [12.25, radius * 0.871],
];
const at = (y, r, angle) => [r * Math.cos(angle), y, r * Math.sin(angle)];
const layers = (profile) => profile.map(([height, r]) => [height, r, r]);
const around = (out, slot, profile, segments, tint, capTop = false) =>
  lathe(out, slot, [0, 0], layers(profile), segments, tint, { capTop });

function shaftRadius(y) {
  const next = verticalProfile.findIndex(([height]) => height >= y);
  const [y0, r0] = verticalProfile[next - 1];
  const [y1, r1] = verticalProfile[next];
  return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
}

function porthole(out, y, r, level) {
  const n = level >= 2 ? 16 : 8;
  const offset = shaftRadius(y) + 0.013;
  const atRim = (i, width, depth) => {
    const angle = (i * 2 * Math.PI) / n;
    return [Math.cos(angle) * width, y + Math.sin(angle) * width, offset + depth];
  };
  fan(
    out,
    'glass',
    Array.from({ length: n }, (_, i) => atRim(i, r + 0.006, 0.01)),
    color.deep,
  );
  if (level)
    for (let i = 0; i < n; i++) {
      quad4(
        out,
        'gallery',
        atRim(i, r, 0.048),
        atRim(i, r + 0.075, 0.021),
        atRim(i + 1, r + 0.075, 0.021),
        atRim(i + 1, r, 0.048),
        color.stone,
      );
      if (level >= 2)
        quad4(
          out,
          'gallery',
          atRim(i + 1, r, 0.048),
          atRim(i, r, 0.048),
          atRim(i, r, 0.008),
          atRim(i + 1, r, 0.008),
          color.lower,
        );
    }
}

function tower(out, level) {
  const segments = [12, 18, 28, 40][level];
  around(
    out,
    'foundation',
    [
      [-0.91, radius * 1.04],
      [0.12, radius * 1.04],
      [0.24, radius * 1.005],
    ],
    segments,
    color.lower,
  );
  const shaft = level === 0 ? [verticalProfile[0], verticalProfile.at(-1)] : verticalProfile;
  around(out, 'shaft', shaft, segments, color.stucco);
  around(
    out,
    'gallery',
    [
      [12.08, radius * 0.868],
      [12.27, radius * 0.893],
      [12.42, radius * 0.892],
      [12.56, radius * 0.93],
      [12.78, radius * 1.03],
      [12.95, radius * 1.093],
      [13.16, radius * 1.115],
      [13.37, radius * 1.115],
    ],
    segments,
    color.chalk,
    true,
  );
  if (level >= 2) {
    around(
      out,
      'shaft',
      [
        [0.38, radius * 0.996],
        [0.59, radius * 0.99],
        [0.63, radius * 0.982],
      ],
      segments,
      color.lower,
    );
    around(
      out,
      'gallery',
      [
        [13.24, radius * 1.121],
        [13.29, radius * 1.128],
        [13.34, radius * 1.106],
      ],
      segments,
      color.lower,
    );
  }
  porthole(out, 4.39, 0.228, level);
  porthole(out, 8.82, 0.219, level);
  const entry = facade([-radius * 0.996, 0], [0, 1]);
  opening(out, entry, 0.06, 0.16, 0.78, 2.01, {
    head: 'round',
    glassSlot: 'timber',
    frameSlot: 'gallery',
    glass: color.timber,
    frame: color.stone,
    d: 0.028,
    frameWidth: level >= 2 ? 0.087 : 0,
    frameDepth: 0.102,
    sill: false,
  });
  if (level >= 2) {
    for (const u of [-0.2, 0, 0.21])
      fbox(out, 'timber', entry, u - 0.012, u + 0.012, 0.22, 1.67, 0.039, 0.047, color.deep);
    fbox(out, 'foundation', entry, -0.43, 0.6, -0.17, 0.18, 0.008, 0.39, color.lower);
  }
}

function lantern(out, level) {
  const n = level ? 12 : 8;
  const theta = (i) => (2 * Math.PI * (i + 0.5)) / n;
  const glassR = 0.775;
  around(
    out,
    'metal',
    [
      [13.37, 0.84],
      [13.82, 0.84],
      [14.57, 0.799],
      [14.69, 0.799],
    ],
    n,
    color.iron,
  );
  for (let i = 0; i < n; i++) {
    const a = theta(i);
    const b = theta(i + 1);
    quad4(
      out,
      'glass',
      at(14.69, glassR, b),
      at(14.69, glassR, a),
      at(15.66, glassR, a),
      at(15.66, glassR, b),
      i % 4 === 2 ? color.lamp : color.glass,
    );
    if (level)
      beam(
        out,
        'metal',
        at(14.62, glassR + 0.011, a),
        at(15.7, glassR + 0.011, a),
        0.06,
        0.053,
        color.iron,
      );
    if (level === 3)
      beam(
        out,
        'metal',
        at(15.07, glassR + 0.027, a),
        at(15.07, glassR + 0.027, b),
        0.042,
        0.037,
        color.iron,
      );
  }
  around(
    out,
    'metal',
    [
      [15.66, 0.88],
      [15.76, 0.89],
      [15.88, 0.74],
      [15.99, 0.1],
      [geometry.towerHeight, 0.037],
    ],
    n,
    color.iron,
    true,
  );
  if (level >= 2) {
    around(
      out,
      'metal',
      [
        [14.614, 0.811],
        [14.683, 0.831],
        [14.72, 0.828],
      ],
      n,
      color.shade,
    );
    for (let i = 0; i < n; i += 2) {
      const angle = theta(i);
      const a = theta(i) + 0.076;
      const b = theta(i) - 0.076;
      quad4(
        out,
        'glass',
        at(13.99, 0.84, a),
        at(13.99, 0.84, b),
        at(14.18, 0.837, b),
        at(14.18, 0.837, a),
        color.shade,
      );
      if (level === 3)
        beam(
          out,
          'metal',
          at(13.99, 0.84, angle),
          at(14.18, 0.842, angle),
          0.025,
          0.027,
          color.iron,
        );
    }
  }
}

function rail(out, level) {
  const posts = [10, 12, 20, 28][level];
  const r = radius * 1.054;
  const rot = (i) => (i * 2 * Math.PI) / posts;
  for (let i = 0; i < posts; i++) {
    const a = rot(i);
    const b = rot(i + 1);
    beam(out, 'metal', at(14.23, r, a), at(14.23, r, b), 0.048, 0.054, color.rail);
    beam(out, 'metal', at(13.33, r, a), at(14.25, r, a), 0.063, 0.061, color.rail);
    if (level) beam(out, 'metal', at(13.63, r, a), at(13.63, r, b), 0.034, 0.044, color.rail);
    if (level === 3) {
      const m = (a + b) / 2;
      beam(out, 'metal', at(13.57, r, m), at(14.2, r, m), 0.026, 0.028, color.rail);
    }
  }
}

function build(out, level) {
  tower(out, level);
  lantern(out, level);
  rail(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'sunda-kelapa-lighthouse-model.mjs';
const camera = [15, 12.8, 29.5];
const lookAt = [0, 7.65, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'The round white tower of Sunda Kelapa Lighthouse with two portholes, a projecting stone gallery and its historic glazed lantern.',
  camera,
  lookAt,
  sunDirection: [-25, 52, 51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outwardRing(geometry.outline),
    minimumCoverage: 0.92,
    basis: 'The mapped OSM ring contains the current cylindrical lighthouse shaft.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'harbor-face-and-portholes', position: [4.6, 7.9, 21], lookAt: [0, 7.36, 0] },
    { name: 'stone-gallery-and-lantern', position: [5.2, 16.8, 13.5], lookAt: [0, 13.48, 0] },
    { name: 'west-mole-entry', position: [-10.4, 4.0, 8.6], lookAt: [0, 3.36, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'sunda-kelapa-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.23,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.11, surfaces },
      street: { export: 'street', errorMeters: 0.045, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.018, surfaces },
    },
  },
};
