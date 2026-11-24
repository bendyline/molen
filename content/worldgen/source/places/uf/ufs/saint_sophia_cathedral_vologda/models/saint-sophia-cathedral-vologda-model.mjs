import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const native = frame.geometry.outline;
const walls = outwardRing(native);
const { foundation, plinth, wallSpring, vaultTop, apseEave, centralCross, sideCross } =
  plan.dimensions;
const lime = rgb('ddd9bd');
const pale = rgb('e7e2c7');
const plinthTint = rgb('c9c1a8');
const slate = rgb('6d7571');
const silver = rgb('9b9e98');
const darkerMetal = rgb('777d77');
const edge = rgb('a7aaa0');
const iron = rgb('554d39');
const glass = rgb('4c544d');
const porchWood = rgb('79543b');
const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'plaster_lime', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.9 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.72 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
};

function narrowWindow(out, face, u, y, width, height, lod, tint = glass) {
  opening(out, face, u, y, width, height, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: tint,
    frame: plinthTint,
    d: 0.04,
    head: 'round',
    frameWidth: lod === 3 ? 0.094 : 0,
    frameDepth: 0.12,
    sill: lod === 3,
    transoms: lod === 3 ? 1 : 0,
  });
}

function body(out, lod) {
  const upperRing = outwardRing([
    [-14.46, -15.47],
    [14.97, -15.47],
    [14.87, 17.4],
    [-14.44, 17.43],
  ]);
  if (lod > 0) extrude(out, 'base', walls, foundation - 3.2, plinth, plinthTint, { top: false });
  extrude(
    out,
    'lime',
    walls,
    lod === 0 ? foundation - 3.2 : plinth - 0.012,
    apseEave + 0.15,
    lime,
    { top: false },
  );
  extrude(out, 'lime', upperRing, apseEave - 0.12, wallSpring, lime, { top: false });
  abox(out, 'metal', [-10.52, wallSpring, -11.68], [10.99, vaultTop - 1.04, 13.2], slate, {
    bottom: false,
  });
  const west = facade([0.2, 17.43], [1, 0]);
  const east = facade([0.22, -15.49], [-1, 0]);
  const north = facade([14.99, 0.94], [0, -1]);
  const south = facade([-14.447, 0.96], [0, 1]);
  for (const face of [west, east, north, south]) {
    const length = face === west || face === east ? 29.2 : 32.72;
    const groups = face === west || face === east ? 3 : 5;
    const gap = length / groups;
    const steps = [3, 7, 10, 13][lod];
    for (let i = 0; i < groups; i++) {
      const u = -length / 2 + (i + 0.5) * gap;
      const radius = gap / 2;
      const crest =
        vaultTop - wallSpring - (groups === 5 ? (i % 2 === 0 ? 1.67 : 0.57) : i === 1 ? 0 : 1.39);
      const top = (j, protrude = 0) => {
        const t = (j * Math.PI) / steps;
        return [u - radius * Math.cos(t), wallSpring + crest * Math.sin(t) + protrude];
      };
      for (let j = 0; j < steps; j++) {
        const a = top(j),
          b = top(j + 1),
          upperA = top(j, 0.16),
          upperB = top(j + 1, 0.16);
        if (j === 0)
          tri(out, 'lime', face.P(a[0], wallSpring), face.P(b[0], wallSpring), face.P(...b), lime);
        else if (j === steps - 1)
          tri(out, 'lime', face.P(a[0], wallSpring), face.P(b[0], wallSpring), face.P(...a), lime);
        else
          quad4(
            out,
            'lime',
            face.P(a[0], wallSpring),
            face.P(b[0], wallSpring),
            face.P(...b),
            face.P(...a),
            lime,
          );
        quad4(
          out,
          'metal',
          face.P(...upperA, 0.12),
          face.P(...upperB, 0.12),
          face.P(b[0], vaultTop - 1.07, -4.65),
          face.P(a[0], vaultTop - 1.07, -4.65),
          slate,
        );
        if (lod > 0)
          quad4(
            out,
            'trim',
            face.P(...a, 0.11),
            face.P(...b, 0.11),
            face.P(...upperB, 0.12),
            face.P(...upperA, 0.12),
            pale,
          );
      }
      if (lod === 0) continue;
      const pilaster = u - radius + 0.04;
      fbox(
        out,
        'trim',
        face,
        pilaster - 0.071,
        pilaster + 0.09,
        plinth,
        wallSpring + 0.14,
        -0.075,
        0.12,
        pale,
      );
      narrowWindow(out, face, u, wallSpring - 1.5, 0.84, 3.17, lod);
      if (face === east) continue;
      if (!(face === west && i === 1))
        narrowWindow(out, face, u, 10.0 + (i % 2) * 0.48, 1.04, 5.42, lod);
      if (lod === 3 && (i === 0 || i === 2)) narrowWindow(out, face, u, 1.68, 0.63, 1.91, lod);
    }
    if (lod > 0)
      fbox(
        out,
        'trim',
        face,
        -length / 2,
        length / 2,
        plinth - 0.21,
        plinth + 0.24,
        -0.08,
        0.16,
        pale,
      );
  }
}

function apses(out, lod) {
  for (const [start, end] of [
    [0, 8],
    [8, 17],
    [17, 23],
  ]) {
    const arc = outwardRing(native.slice(start, end + 1));
    const x = (arc[0][0] + arc.at(-1)[0]) / 2;
    const roofZ = -14.9;
    const layers =
      lod === 0
        ? [
            [apseEave, 1],
            [apseEave + 4.15, 0.26],
          ]
        : [
            [apseEave, 1.02],
            [apseEave + 1.45, 0.88],
            [apseEave + 3.28, 0.56],
            [apseEave + 4.42, 0.15],
          ];
    const rings = layers.map(([y, scale]) =>
      arc.map(([a, b]) => [x + (a - x) * scale, y, roofZ + (b - roofZ) * scale]),
    );
    loft(out, 'metal', rings, slate, { cap: false });
    const top = rings.at(-1);
    const apex = [x, apseEave + 4.6, roofZ];
    for (let i = 0; i < top.length; i++)
      tri(out, 'metal', top[i], top[(i + 1) % top.length], apex, slate);
    if (lod === 0) continue;
    for (let i = 0; i < arc.length - 1; i++) {
      const f = wallFace(arc[i], arc[i + 1]);
      if (f.normal[1] < -0.23 && i % 2 === 1)
        narrowWindow(out, f, f.length / 2, 12.15, 0.87, 4.67, lod);
      if (lod > 1)
        fbox(
          out,
          'trim',
          f,
          0.01,
          f.length - 0.01,
          apseEave - 0.52,
          apseEave - 0.26,
          0,
          0.12,
          pale,
        );
    }
  }
}

function drumAndDome(out, x, z, r, base, highest, lod) {
  const height = highest - base;
  const sides = [7, 14, 20, 28][lod];
  const ring = (y, radius) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-Math.PI * 2 * i) / sides;
      return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
    });
  const upper = base + height * 0.43;
  const core = r * 0.72;
  loft(
    out,
    'lime',
    [
      ring(base, core * 1.11),
      ring(base + 0.36, core),
      ring(upper - 0.34, core),
      ring(upper, core * 1.09),
    ],
    pale,
    { cap: false },
  );
  if (lod > 0) {
    const count = lod === 1 ? 6 : 10;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * (i + 0.5)) / count;
      const c = Math.cos(a),
        s = Math.sin(a);
      const f = facade([x + c * (core - 0.055), z + s * (core - 0.055)], [s, -c]);
      narrowWindow(out, f, 0, base + height * 0.084, 0.57, height * 0.258, lod);
    }
  }
  const profile = [
    [0.42, 0.74],
    [0.48, 0.94],
    [0.56, 1],
    [0.66, 0.86],
    [0.73, 0.58],
    [0.78, 0.28],
    [0.81, 0.108],
  ];
  const detail = lod === 0 ? profile.filter((_, i) => i !== 1 && i !== 4) : profile;
  loft(
    out,
    'metal',
    detail.map(([t, s]) => ring(base + height * t, r * s)),
    silver,
    { cap: false },
  );
  if (lod > 1) {
    const ribs = lod === 2 ? 8 : 14;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * 2 * Math.PI;
      for (let j = 1; j < profile.length; j++) {
        const point = ([t, s]) => [
          x + (r * s + 0.032) * Math.cos(a),
          base + height * t,
          z + (r * s + 0.032) * Math.sin(a),
        ];
        beam(
          out,
          'metal',
          point(profile[j - 1]),
          point(profile[j]),
          0.054,
          0.045,
          i % 2 ? edge : darkerMetal,
        );
      }
    }
  }
  const stem = base + height * 0.801;
  const crossUnit = height * 0.165;
  beam(out, 'iron', [x, stem, z], [x, highest, z], 0.12, 0.13, iron);
  beam(
    out,
    'iron',
    [x - crossUnit * 0.52, highest - crossUnit * 0.33, z],
    [x + crossUnit * 0.52, highest - crossUnit * 0.33, z],
    0.117,
    0.115,
    iron,
  );
  if (lod > 0) {
    beam(
      out,
      'iron',
      [x - crossUnit * 0.31, highest - crossUnit * 0.8, z],
      [x + crossUnit * 0.32, highest - crossUnit * 0.58, z],
      0.09,
      0.094,
      iron,
    );
    beam(
      out,
      'iron',
      [x - crossUnit * 0.3, highest - crossUnit * 0.09, z],
      [x + crossUnit * 0.29, highest - crossUnit * 0.09, z],
      0.09,
      0.094,
      iron,
    );
  }
}

function porch(out, lod) {
  const f = facade([0.31, 19.62], [1, 0]);
  fbox(out, 'base', f, -3.29, 3.29, foundation, 0.57, -2.32, 0.36, plinthTint);
  fbox(out, 'lime', f, -3.13, 3.13, 0.56, 5.35, -2.38, 0, lime);
  quad4(
    out,
    'metal',
    [-3.32, 5.27, 17.14],
    [-3.32, 5.27, 19.83],
    [0.31, 7.15, 19.83],
    [0.31, 7.15, 17.16],
    darkerMetal,
  );
  quad4(
    out,
    'metal',
    [0.31, 7.15, 17.16],
    [0.31, 7.15, 19.83],
    [3.57, 5.27, 19.83],
    [3.57, 5.27, 17.16],
    darkerMetal,
  );
  tri(out, 'lime', f.P(-3.34, 5.33), f.P(3.29, 5.33), f.P(0, 7.06), lime);
  for (const u of [-1.94, 0, 1.94]) {
    opening(out, f, u, 0.79, 1.57, 3.78, {
      glassSlot: 'wood',
      frameSlot: 'trim',
      glass: porchWood,
      frame: pale,
      d: 0.045,
      head: 'round',
      frameWidth: lod === 3 ? 0.091 : 0,
      mullions: lod > 1 ? 2 : 0,
      transoms: lod > 1 ? 2 : 0,
      sill: false,
    });
  }
  if (lod === 0) return;
  for (const u of [-2.93, -0.95, 0.96, 2.91]) {
    fbox(out, 'trim', f, u - 0.2, u + 0.2, 0.66, 3.71, -0.08, 0.18, pale);
    fbox(out, 'trim', f, u - 0.27, u + 0.27, 3.68, 3.88, -0.1, 0.2, plinthTint);
  }
  for (let i = 0; i < 4; i++)
    fbox(
      out,
      'base',
      f,
      -2.27,
      2.27,
      -0.19,
      0.48 - i * 0.12,
      0.19 + i * 0.26,
      0.45 + i * 0.26,
      plinthTint,
    );
}

function build(out, lod) {
  body(out, lod);
  apses(out, lod);
  porch(out, lod);
  for (const x of [-8.28, 8.6])
    for (const z of [-7.95, 8.95]) drumAndDome(out, x, z, 3.57, 35.12, sideCross, lod);
  drumAndDome(out, 0.21, 0.56, 4.66, 36.82, centralCross, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'saint-sophia-cathedral-vologda-model.mjs';
const camera = [52, 33, -85];
const lookAt = [0, 28, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The white Saint Sophia Cathedral in Vologda with five tall, silver onion domes, the curved apse range, and a west porch.',
  camera,
  lookAt,
  sunDirection: [-46, 60, -52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: walls,
    minimumCoverage: 0.92,
    basis: 'The individually named and mapped cathedral outline.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'east-apses-and-five-domes', position: camera, lookAt },
    { name: 'west-porch-and-white-masonry', position: [24, 6, 42], lookAt: [0, 15, 14] },
    { name: 'vault-roof-and-windowed-drums', position: [41, 57, 42], lookAt: [0, 38, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'saint-sophia-cathedral-vologda-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
