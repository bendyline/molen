import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = outwardRing(frame.geometry.outline);
const { foundation, commercialTop, mezzanineTop, shaftTop, cornice, parapet } = plan.dimensions;
const brick = rgb('ad997b');
const crown = rgb('b6a488');
const sandstone = rgb('bbad95');
const pale = rgb('c7baa0');
const base = rgb('80766a');
const roof = rgb('79756d');
const glass = rgb('657f82');
const darkGlass = rgb('506b70');
const shadow = rgb('9e896b');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
};

const walls = outline.map((a, i) => wallFace(a, outline[(i + 1) % outline.length]));

function cover(out, y, color) {
  const indices = earcut(outline.flat(), [], 2);
  const p = (i) => [outline[i][0], y, outline[i][1]];
  for (let j = 0; j < indices.length; j += 3)
    tri(out, 'roof', p(indices[j]), p(indices[j + 2]), p(indices[j + 1]), color);
}

function massing(out) {
  extrude(out, 'foundation', outline, foundation, commercialTop, base, { top: false });
  extrude(out, 'brick', outline, commercialTop, mezzanineTop, shadow, { top: false });
  extrude(out, 'brick', outline, mezzanineTop, shaftTop, brick, { top: false });
  extrude(out, 'brick', outline, shaftTop, cornice, crown, { top: false });
  cover(out, cornice, roof);
  abox(out, 'roof', [-5.64, cornice - 0.1, -4.5], [12.42, cornice + 0.71, 7.81], roof, {
    bottom: false,
  });
}

function rail(out, face, u0, u1, y, height, depth, lod) {
  fbox(out, 'trim', face, u0, u1, y, y + 0.11, -0.08, depth, pale);
  fbox(out, 'trim', face, u0, u1, y + height - 0.14, y + height, -0.088, depth + 0.03, pale);
  const n = Math.max(1, Math.round((u1 - u0) / (lod === 3 ? 0.35 : 0.54)));
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    const half = i === 0 || i === n ? 0.1 : 0.049;
    fbox(
      out,
      'trim',
      face,
      u - half,
      u + half,
      y + 0.1,
      y + height - 0.12,
      -0.04,
      depth * 0.68,
      sandstone,
    );
  }
}

function pane(out, face, u, y, width, height, lod, tint, detail = false) {
  opening(out, face, u, y, width, height, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: tint,
    frame: pale,
    d: 0.035,
    frameWidth: lod === 3 && detail ? 0.086 : 0,
    frameDepth: 0.11,
    mullions: lod > 1 && detail ? 2 : 0,
    transoms: lod > 1 ? (detail ? 3 : 1) : 0,
    sill: false,
  });
}

function belts(out, face, lod) {
  const n = face.length;
  const baseBands = [
    [commercialTop - 0.21, 0.29, 0.25],
    [mezzanineTop - 0.31, 0.39, 0.26],
    [cornice - 0.15, 0.27, 0.31],
  ];
  const bands =
    lod === 0
      ? baseBands
      : [
          ...baseBands,
          [mezzanineTop - 0.63, 0.2, 0.19],
          [shaftTop + 0.07, 0.24, 0.16],
          [cornice - 0.45, 0.21, 0.22],
        ];
  for (const [y, h, d] of bands) {
    fbox(out, 'trim', face, 0.025, n - 0.025, y, y + h, -0.082, d, sandstone);
  }
}

function frontBays(out, face, lod) {
  const length = face.length;
  const n = Math.max(1, Math.round(length / 4.63));
  const span = length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * span;
    const width = Math.min(2.18, span * 0.6);
    if (lod > 0) {
      const door = i % 4 === 1;
      pane(out, face, u, 0.44, Math.min(3.44, span * 0.76), 3.36, lod, darkGlass, door);
      pane(out, face, u, 5.49, width * 1.04, 3.45, lod, glass, true);
      if (lod > 1) {
        rail(out, face, u - width * 0.52, u + width * 0.52, 4.78, 0.67, 0.21, lod);
        const edge = u - span / 2 + 0.13;
        fbox(
          out,
          'trim',
          face,
          edge - 0.09,
          edge + 0.09,
          commercialTop + 0.09,
          mezzanineTop - 0.4,
          0.02,
          0.17,
          sandstone,
        );
      }
    }
    const floor = (shaftTop - mezzanineTop) / 7;
    for (let j = 0; j < 7; j++) {
      const y = mezzanineTop + floor * j + 0.76;
      const tint = (i + j) % 5 === 3 ? darkGlass : glass;
      if (lod === 0) {
        if (j % 2 === 0) pane(out, face, u, y, width, 1.79, lod, tint);
        continue;
      }
      if (i % 3 === 0 && n > 2) {
        for (const k of [-0.53, 0.53])
          pane(
            out,
            face,
            u + width * k,
            y,
            width * 0.83,
            j === 0 ? 2.12 : 1.84,
            lod,
            tint,
            j === 0,
          );
      } else {
        pane(out, face, u, y, width, j === 0 ? 2.12 : 1.84, lod, tint, j === 0);
      }
      if (lod === 3)
        fbox(
          out,
          'trim',
          face,
          u - width * 0.53,
          u + width * 0.53,
          y - 0.12,
          y - 0.016,
          0.01,
          0.18,
          sandstone,
        );
    }
    pane(out, face, u, shaftTop + 0.76, width, 3.13, lod, glass, true);
    if (lod === 0) continue;
    const end = Math.min((i + 1) * span - 0.21, length - 0.13);
    rail(out, face, i * span + 0.21, end, cornice + 0.05, parapet - cornice - 0.05, 0.16, lod);
    if (lod > 1) {
      const x = Math.min(u + span * 0.37, length - 0.18);
      fbox(
        out,
        'trim',
        face,
        x - 0.08,
        x + 0.08,
        shaftTop + 0.59,
        cornice - 0.49,
        0.031,
        0.14,
        sandstone,
      );
      if (lod === 3) {
        const dia = (a, b) => face.P(u + a, shaftTop + 4.0 + b, 0.077);
        quad4(out, 'trim', dia(-0.18, 0), dia(0, -0.15), dia(0.18, 0), dia(0, 0.15), pale);
      }
    }
  }
}

function secondaryBays(out, face, lod) {
  if (lod === 0) return;
  const axial = face.length;
  const n = Math.max(1, Math.round(axial / 5.6));
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * axial) / n;
    const w = Math.min((axial / n) * 0.62, 1.83);
    for (let j = 0; j < 8; j++) {
      const y = 5.7 + j * 3.86;
      pane(out, face, u, y, w, j === 0 ? 2.9 : 1.83, lod < 3 ? 1 : lod, glass);
    }
  }
}

function build(out, lod) {
  massing(out);
  for (const face of walls) {
    if (face.length < 2.7) continue;
    belts(out, face, lod);
    const street = face.normal[1] > 0.3 || face.normal[0] < -0.6;
    if (street) frontBays(out, face, lod);
    else secondaryBays(out, face, lod);
    if (lod === 0 || !street) {
      fbox(
        out,
        'trim',
        face,
        0.02,
        face.length - 0.02,
        cornice + 0.06,
        parapet - 0.1,
        -0.21,
        0.05,
        crown,
      );
    }
    if (lod < 2 || !street || face.length < 11) continue;
    for (const end of [0.14, face.length - 0.32]) {
      const direction = end < 1 ? 1 : -1;
      for (let y = mezzanineTop + 0.31; y < shaftTop; y += lod === 3 ? 0.56 : 1.12) {
        const u = end + direction * 0.42;
        fbox(
          out,
          'trim',
          face,
          Math.min(end, u),
          Math.max(end, u),
          y,
          y + 0.054,
          0.004,
          0.055,
          shadow,
        );
      }
    }
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'daniel-boone-hotel-charleston-west-virginia-model.mjs';
const camera = [-61, 21, 69];
const lookAt = [-4, 17.8, 2.6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The former Daniel Boone Hotel with a stepped buff-brick shaft, two-story retail base and terra-cotta roof balustrade.',
  camera,
  lookAt,
  sunDirection: [-39, 61, 54],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The individually confirmed hotel footprint at 405 Capitol Street.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'capitol-and-washington-corner', position: camera, lookAt },
    { name: 'retail-base-and-windows', position: [-43, 5, 39], lookAt: [-18, 9, 15] },
    { name: 'stepped-wings-and-parapet', position: [-56, 43, -24], lookAt: [-16, 27, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'daniel-boone-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
