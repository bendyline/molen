import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fan,
  fbox,
  opening,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { baseRadius, foundation, shaftShoulder, balcony, cornice, roofEave, height } =
  plan.dimensions;
const tau = Math.PI * 2;
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.92 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};
const cream = rgb('d4c4a2');
const pale = rgb('d8cbb0');
const shadow = rgb('54493f');
const iron = rgb('4d443e');
const timber = rgb('645344');
const clay = rgb('8f594a');

const polar = (r, a, y, x = 0, z = 0) => [x + r * Math.sin(a), y, z + r * Math.cos(a)];
function ring(radius, y, count, x = 0, z = 0) {
  return Array.from({ length: count }, (_, i) => polar(radius, (i * tau) / count, y, x, z));
}
function profile(out, surface, sections, sides, color, x = 0, z = 0) {
  loft(
    out,
    surface,
    sections.map(([y, r]) => ring(r, y, sides, x, z)),
    color,
    { cap: false },
  );
}
function tangent(a, r) {
  const [x, , z] = polar(r, a, 0);
  return facade([x, z], [Math.cos(a), -Math.sin(a)]);
}
function band(out, surface, sides, y, r, thick, color, x = 0, z = 0) {
  profile(
    out,
    surface,
    [
      [y - thick / 2, r - 0.13],
      [y - thick / 4, r],
      [y + thick / 4, r],
      [y + thick / 2, r - 0.13],
    ],
    sides,
    color,
    x,
    z,
  );
}

function mainShaft(out, sides, lod) {
  profile(
    out,
    'plaster',
    [
      [foundation, baseRadius - 0.12],
      [0.13, baseRadius],
      [0.39, baseRadius - 0.04],
      [2.05, 6.45],
      [4.25, 6.13],
      [shaftShoulder, 6.02],
      [10.5, 5.76],
      [14.6, 5.55],
      [balcony - 0.29, 5.27],
    ],
    sides,
    cream,
  );
  band(out, 'trim', sides, shaftShoulder, 6.13, 0.31, rgb('b5a789'));
  band(out, 'trim', sides, shaftShoulder - 0.3, 6.13, 0.17, rgb('c5b593'));
  const entry = tangent(0, 6.83);
  opening(out, entry, 0, 0.04, 2.27, 3.95, {
    head: 'round',
    mullions: lod > 1 ? 1 : 0,
    transoms: lod > 1 ? 2 : 0,
    glass: rgb('554b41'),
    frame: pale,
    frameWidth: 0.23,
    frameDepth: 0.15,
    sill: false,
  });
  if (lod > 0) fbox(out, 'trim', entry, -1.42, 1.42, -0.12, 0.13, -0.15, 0.65, rgb('aea895'));
  const tall = tangent(0.41, 5.94);
  opening(out, tall, 0, 6.7, 1.04, 7.75, {
    head: 'round',
    glass: rgb('635c50'),
    frame: pale,
    frameWidth: 0.155,
    frameDepth: 0.14,
    mullions: lod > 1 ? 2 : 0,
  });
  for (const angle of [-1.04, 2.22, 3.67]) {
    const face = tangent(angle, 5.95);
    const center = 8.87;
    const count = lod > 1 ? 18 : 10;
    const round = (r, depth) =>
      Array.from({ length: count }, (_, i) => {
        const phi = (i * tau) / count;
        return face.P(Math.cos(phi) * r, center + Math.sin(phi) * r, depth);
      });
    const back = round(0.65, 0.005);
    fan(out, 'glass', back, shadow);
    const inside = round(0.65, 0.12);
    const outside = round(0.83, 0.18);
    const rim = round(0.89, 0.09);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      quad4(out, 'trim', back[i], inside[i], inside[j], back[j], rgb('a49577'));
      quad4(out, 'trim', inside[i], outside[i], outside[j], inside[j], pale);
      quad4(out, 'trim', outside[i], rim[i], rim[j], outside[j], rgb('b4a282'));
    }
  }
}

function secondaryTurret(out, lod) {
  const a = -0.35;
  const [x, , z] = polar(5.42, a, 0);
  const sides = lod > 1 ? 24 : 12;
  profile(
    out,
    'plaster',
    [
      [10.05, 0.12],
      [10.22, 0.28],
      [11.15, 0.62],
      [12.24, 1.03],
      [15.1, 1.01],
      [18.02, 0.94],
      [balcony, 1.05],
    ],
    sides,
    pale,
    x,
    z,
  );
  band(out, 'trim', sides, 12.27, 1.14, 0.36, rgb('b5a281'), x, z);
  band(out, 'trim', sides, 12.66, 1.1, 0.16, pale, x, z);
  const face = tangent(a, 6.49);
  opening(out, face, 0, 15.88, 0.36, 1.18, {
    head: 'round',
    frameWidth: 0.075,
    frameDepth: 0.08,
    frame: pale,
    glass: shadow,
    sill: false,
  });
  return [a, x, z];
}

function platform(out, sides, lod) {
  const [angle, x, z] = secondaryTurret(out, lod);
  profile(
    out,
    'timber',
    [
      [balcony - 0.49, 5.25],
      [balcony - 0.33, 6.07],
      [balcony, 6.09],
    ],
    sides,
    timber,
  );
  band(out, 'iron', sides, balcony + 0.03, 6.13, 0.16, iron);
  profile(
    out,
    'timber',
    [
      [balcony - 0.47, 1.02],
      [balcony - 0.29, 1.5],
      [balcony, 1.57],
    ],
    lod > 1 ? 30 : 14,
    timber,
    x,
    z,
  );
  const silhouette = (a, y) => {
    const side = 5.42 * Math.sin(a - angle);
    const reach =
      Math.abs(side) < 1.57 && Math.cos(a - angle) > 0
        ? 5.42 * Math.cos(a - angle) + Math.sqrt(1.57 * 1.57 - side * side)
        : 6.08;
    return polar(Math.max(6.08, reach), a, y);
  };
  const count = [0, 24, 62, 110][lod];
  for (const y of [balcony + 0.19, balcony + 0.99]) {
    const perimeter = Array.from({ length: count }, (_, i) =>
      silhouette((tau * i) / count - Math.PI, y),
    );
    beamPath(out, 'iron', perimeter, 0.052, 0.055, iron, true);
  }
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count - Math.PI;
    const major = i % 5 === 0;
    beam(
      out,
      'iron',
      silhouette(a, balcony + 0.05),
      silhouette(a, balcony + (major ? 1.14 : 1.035)),
      major ? 0.088 : 0.038,
      major ? 0.088 : 0.038,
      iron,
    );
    if (lod >= 2 && i % 2 === 0) {
      const curve = [
        silhouette(a - 0.019, balcony + 0.46),
        silhouette(a, balcony + 0.76),
        silhouette(a + 0.019, balcony + 0.46),
        silhouette(a, balcony + 0.36),
      ];
      beamPath(out, 'iron', curve, 0.024, 0.035, iron, true);
    }
  }
  if (lod > 0) {
    const brackets = lod > 1 ? 22 : 12;
    for (let i = 0; i < brackets; i++) {
      const a = (tau * i) / brackets;
      beam(
        out,
        'timber',
        polar(5.36, a, balcony - 1.27),
        polar(5.99, a, balcony - 0.32),
        0.16,
        0.14,
        timber,
      );
    }
  }
}

function tankAndRoof(out, sides, lod) {
  profile(
    out,
    'plaster',
    [
      [balcony - 0.12, 5.32],
      [20.05, 5.26],
      [23.35, 5.11],
      [26.45, 4.99],
      [cornice, 4.97],
    ],
    sides,
    pale,
  );
  for (const y of [26.38, 27.85]) band(out, 'trim', sides, y, 5.115, 0.18, rgb('b7a686'));
  if (lod > 0) {
    const arches = lod > 1 ? 34 : 22;
    for (let i = 0; i < arches; i++) {
      const face = tangent((tau * i) / arches, 5.015);
      if (lod > 1) {
        opening(out, face, 0, 26.51, 0.6, 1.24, {
          head: 'round',
          frameWidth: 0.07,
          frameDepth: 0.07,
          frame: cream,
          glass: rgb('6c5d48'),
          sill: false,
        });
      } else {
        const shape = [
          [-0.43, 26.51],
          [0.43, 26.51],
          [0.43, 27.2],
          [0.31, 27.57],
          [0, 27.72],
          [-0.31, 27.57],
          [-0.43, 27.2],
        ];
        fan(
          out,
          'glass',
          shape.map(([u, v]) => face.P(u, v, 0.025)),
          shadow,
        );
      }
    }
  }
  profile(
    out,
    'timber',
    [
      [cornice - 0.47, 5.03],
      [cornice - 0.06, 5.65],
      [roofEave + 0.06, 5.79],
    ],
    sides,
    timber,
  );
  if (lod >= 2) {
    for (let i = 0; i < 42; i++) {
      const a = (tau * i) / 42;
      beam(
        out,
        'timber',
        polar(5.06, a, cornice - 0.43),
        polar(5.73, a, roofEave - 0.03),
        0.12,
        0.12,
        timber,
      );
    }
  }
  profile(
    out,
    'tile',
    [
      [roofEave, 5.79],
      [roofEave + 0.17, 5.76],
      [28.94, 4.82],
      [30.11, 3.24],
      [31.68, 1.46],
      [32.61, 0.18],
    ],
    sides,
    clay,
  );
  const finial = [
    [32.55, 0.2],
    [32.76, 0.17],
    [32.85, 0.12],
    [height, 0.026],
  ];
  profile(out, 'iron', finial, 8, iron);
}

function build(out, lod) {
  const sides = [0, 24, 48, 72][lod];
  mainShaft(out, sides, lod);
  platform(out, sides, lod);
  tankAndRoof(out, sides, lod);
}
export function skyline(out) {
  const sides = 14;
  profile(
    out,
    'plaster',
    [
      [foundation, baseRadius],
      [0, baseRadius],
      [shaftShoulder, 6.02],
      [balcony - 0.4, 5.27],
    ],
    sides,
    cream,
  );
  profile(
    out,
    'iron',
    [
      [balcony - 0.5, 5.35],
      [balcony - 0.22, 6.12],
      [balcony + 0.16, 6.12],
      [balcony + 0.16, 5.28],
    ],
    sides,
    iron,
  );
  const [x, , z] = polar(5.42, -0.35, 0);
  profile(
    out,
    'plaster',
    [
      [10.05, 0.12],
      [12.24, 1.04],
      [balcony, 1.04],
    ],
    12,
    pale,
    x,
    z,
  );
  profile(
    out,
    'plaster',
    [
      [balcony - 0.2, 5.32],
      [cornice, 4.97],
    ],
    sides,
    pale,
  );
  profile(
    out,
    'timber',
    [
      [cornice - 0.32, 5.02],
      [cornice, 5.67],
      [roofEave, 5.79],
    ],
    sides,
    timber,
  );
  profile(
    out,
    'tile',
    [
      [roofEave, 5.79],
      [30.11, 3.24],
      [32.64, 0.18],
      [height, 0.026],
    ],
    sides,
    clay,
  );
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'old-fresno-water-tower-model.mjs';
const camera = [-27, 22, 43];
const lookAt = [0, 16.1, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Fresno’s cream-painted 1894 water tower with an ornate iron balcony, projecting stair turret and red tiled roof.',
  camera,
  lookAt,
  sunDirection: [-48, 52, 48],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.95,
    basis: 'Named surveyed circular tower footprint, directly tied to the standing tower.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'fresno-street-front-and-roof', position: camera, lookAt },
    { name: 'oculus-stair-turret-and-balcony', position: [-18, 13, 24], lookAt: [-2, 14, 3] },
    { name: 'eaves-blind-arcade-and-red-tile', position: [-18, 31.5, -23], lookAt: [0, 25, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-fresno-water-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.55,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.087, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.032, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
