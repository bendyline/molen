import fs from 'node:fs';
import {
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const galleryRing = outwardRing(frame.geometry.outline);
const body = outwardRing(frame.features[1].points);
const center = [
  body.reduce((sum, [x]) => sum + x, 0) / body.length,
  body.reduce((sum, [, z]) => sum + z, 0) / body.length,
];
const { foundation, gallery, top, hub, sailRadius } = plan.dimensions;
const stone = rgb('989077');
const weatheredStone = rgb('7e7660');
const timber = rgb('624d38');
const trim = rgb('817052');
const charcoal = rgb('41413a');
const darkest = rgb('31322e');
const sailWood = rgb('95896b');
const glass = rgb('3b4039');
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.88 },
  floor: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.92 },
  shingle: { slot: 'roof', graph: 'wood_painted_shingle', roughness: 0.93 },
  sail: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
};

const scaled = (ring, scale) =>
  ring.map(([x, z]) => [center[0] + (x - center[0]) * scale, center[1] + (z - center[1]) * scale]);
const sidePairs = (ring) =>
  ring.map((point, index) => wallFace(point, ring[(index + 1) % ring.length]));

function skin(out, slot, lower, y0, upper, y1, color) {
  for (let i = 0; i < lower.length; i++) {
    const j = (i + 1) % lower.length;
    quad4(
      out,
      slot,
      [lower[i][0], y0, lower[i][1]],
      [lower[j][0], y0, lower[j][1]],
      [upper[j][0], y1, upper[j][1]],
      [upper[i][0], y1, upper[i][1]],
      color,
    );
  }
}

function prism(out, slot, ring, y0, y1, color, bottom = false) {
  skin(out, slot, ring, y0, ring, y1, color);
  fan(
    out,
    slot,
    ring.map(([x, z]) => [x, y1, z]),
    color,
  );
  if (bottom)
    fan(
      out,
      slot,
      ring
        .slice()
        .reverse()
        .map(([x, z]) => [x, y0, z]),
      color,
    );
}

function masonry(out, lod) {
  const base = scaled(body, 0.89);
  prism(out, 'stone', scaled(body, 0.94), foundation, 0.46, weatheredStone);
  prism(out, 'stone', base, 0.42, 13.41, stone);
  if (lod === 0) return;
  for (const [index, face] of sidePairs(base).entries()) {
    const middle = face.length / 2;
    const width = index === 2 ? 1.8 : 0.69;
    for (const y of index === 2 ? [0.26, 5.25, 7.72] : [3.24, 7.72]) {
      const height = y < 1 ? 2.61 : 1.04;
      opening(out, face, middle, y, width, height, {
        glassSlot: 'window',
        frameSlot: 'trim',
        glass,
        frame: trim,
        frameWidth: 0.08,
        d: 0.032,
        sill: true,
        sillDepth: 0.16,
        mullions: lod > 1 && y > 1 ? 1 : 0,
      });
    }
  }
}

function galleryDeck(out, lod) {
  const edge = scaled(galleryRing, 0.98);
  prism(out, 'trim', galleryRing, gallery - 0.53, gallery - 0.12, timber, true);
  prism(out, 'floor', edge, gallery - 0.14, gallery, trim);
  for (const [i, face] of sidePairs(edge).entries()) {
    const length = face.length;
    const brackets = lod === 0 ? 1 : lod === 1 ? 2 : 3;
    const posts = lod < 2 ? 2 : 4;
    for (let j = 0; j < brackets; j++) {
      const u = (length * (j + 0.5)) / brackets;
      const rim = face.P(u, gallery - 0.4);
      const brace = [
        center[0] + (rim[0] - center[0]) * 0.53,
        gallery - 4.55,
        center[1] + (rim[2] - center[1]) * 0.53,
      ];
      beam(out, 'trim', brace, rim, 0.34, 0.34, timber);
    }
    for (const height of lod === 0 ? [1.06] : [0.19, 1.06]) {
      fbox(
        out,
        'trim',
        face,
        0,
        length,
        gallery + height - 0.08,
        gallery + height,
        -0.08,
        0.06,
        timber,
      );
    }
    for (let j = 0; j < posts; j++) {
      const u = (length * j) / posts;
      fbox(out, 'trim', face, u - 0.065, u + 0.065, gallery, gallery + 1.13, -0.09, 0.09, trim);
    }
    if (lod < 2) continue;
    const spans = lod === 3 ? 15 : 8;
    for (let j = 0; j < spans; j++) {
      const a = (length * j) / spans;
      const b = (length * (j + 1)) / spans;
      const reverse = (i + j) % 2 === 0;
      beam(
        out,
        'trim',
        face.P(a, gallery + (reverse ? 0.21 : 1.0), -0.018),
        face.P(b, gallery + (reverse ? 1.0 : 0.21), -0.018),
        0.055,
        0.057,
        timber,
      );
      if (lod === 3)
        beam(
          out,
          'trim',
          face.P(a, gallery + (reverse ? 1.0 : 0.21), -0.061),
          face.P(b, gallery + (reverse ? 0.21 : 1.0), -0.061),
          0.05,
          0.049,
          trim,
        );
    }
  }
}

function smock(out, lod) {
  const levels = [
    [13.24, 1.014],
    [14.57, 0.94],
    [17.15, 0.81],
    [20.25, 0.687],
    [22.77, 0.63],
  ];
  for (let i = 1; i < levels.length; i++) {
    const [y0, a] = levels[i - 1];
    const [y1, b] = levels[i];
    skin(out, 'shingle', scaled(body, a), y0, scaled(body, b), y1, charcoal);
  }
  prism(out, 'trim', scaled(body, 1.027), 13.23, 13.57, darkest);
  prism(out, 'trim', scaled(body, 0.66), 22.56, 22.9, darkest);
  if (lod === 0) return;
  const smockFaces = sidePairs(body);
  const [baseHeight, baseScale] = levels[1];
  const [upperHeight, upperScale] = levels[2];
  for (const i of [0, 2, 4, 6]) {
    const face = smockFaces[i];
    const windowFace = {
      P(u, y, d) {
        const scale =
          baseScale + ((upperScale - baseScale) * (y - baseHeight)) / (upperHeight - baseHeight);
        const [x, , z] = face.P(face.length / 2 + u / scale, y, d / scale);
        return [center[0] + (x - center[0]) * scale, y, center[1] + (z - center[1]) * scale];
      },
    };
    opening(out, windowFace, 0, 15.19, 0.68, 1.18, {
      glassSlot: 'window',
      frameSlot: 'trim',
      glass,
      frame: trim,
      frameWidth: 0.095,
      d: 0.12,
      transoms: lod > 1 ? 1 : 0,
    });
  }
  if (lod < 2) return;
  const eaves = scaled(body, 1.014);
  const shoulders = scaled(body, 0.63);
  for (let j = 0; j < eaves.length; j++) {
    beam(
      out,
      'trim',
      [eaves[j][0], 13.58, eaves[j][1]],
      [shoulders[j][0], 22.8, shoulders[j][1]],
      0.09,
      0.095,
      darkest,
    );
  }
}

function cap(out, lod) {
  const sides = lod === 0 ? 8 : 12;
  const sections = [
    [22.72, 4.2, 4.5, -0.16],
    [23.33, 4.3, 4.6, -0.13],
    [24.28, 3.52, 4.35, -0.08],
    [25.22, 2.06, 3.62, -0.05],
    [top - 0.05, 0.47, 2.52, 0.05],
  ];
  const rings = sections.map(([, rx, rz, shift]) =>
    outwardRing(
      Array.from({ length: sides }, (_, i) => {
        const a = (2 * Math.PI * i) / sides;
        return [center[0] + rx * Math.cos(a), center[1] + shift + rz * Math.sin(a)];
      }),
    ),
  );
  for (let i = 1; i < sections.length; i++) {
    skin(out, 'shingle', rings[i - 1], sections[i - 1][0], rings[i], sections[i][0], darkest);
  }
  prism(out, 'shingle', rings.at(-1), top - 0.05, top, charcoal);
  prism(out, 'trim', rings[0], 22.65, 22.9, timber);
  if (lod === 0) return;
  const heel = [center[0], gallery + 0.11, center[1] + 8.65];
  beam(out, 'trim', [center[0], 23.68, center[1] + 4.28], heel, 0.3, 0.32, timber);
  for (const sign of [-1, 1]) {
    beam(out, 'trim', [center[0] + sign * 3.5, 22.83, center[1] + 2.4], heel, 0.21, 0.22, trim);
  }
}

function sails(out, lod) {
  const x = center[0];
  const z = center[1] - 5.27;
  beam(out, 'iron', [x, hub, z - 0.18], [x, hub, center[1] - 3.91], 0.48, 0.48, darkest);
  beam(out, 'iron', [x, hub, z - 0.43], [x, hub, z + 0.31], 0.73, 0.79, darkest);
  for (let i = 0; i < 4; i++) {
    const angle = ((i + 0.21) * Math.PI) / 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const p = (radius, offset, depth = 0) => [
      x + dx * radius - dy * offset,
      hub + dy * radius + dx * offset,
      z + depth,
    ];
    const root = 2.52;
    const tipWidth = 0.95;
    const rootWidth = 1.52;
    beam(out, 'iron', p(0.16, 0), p(sailRadius, 0.04, 0.15), 0.23, 0.17, charcoal);
    beam(
      out,
      'sail',
      p(root, rootWidth, 0.1),
      p(sailRadius, tipWidth, 0.24),
      0.084,
      0.088,
      sailWood,
    );
    if (lod > 0) {
      beam(
        out,
        'sail',
        p(root, rootWidth * 0.55, 0.09),
        p(sailRadius, tipWidth * 0.55, 0.18),
        0.073,
        0.078,
        timber,
      );
    }
    const rungs = [3, 12, 19, 23][lod];
    for (let j = 0; j <= rungs; j++) {
      const t = j / rungs;
      const radius = root + t * (sailRadius - root);
      beam(
        out,
        'sail',
        p(radius, -0.13, t * 0.16),
        p(radius, rootWidth + t * (tipWidth - rootWidth), 0.11 + t * 0.13),
        lod === 0 ? 0.12 : 0.064,
        0.077,
        sailWood,
      );
    }
  }
}

function build(out, lod) {
  masonry(out, lod);
  galleryDeck(out, lod);
  smock(out, lod);
  cap(out, lod);
  sails(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'historic-mill-of-sanssouci-model.mjs';
const camera = [25, 15, -48];
const lookAt = [0, 16, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Historic Windmill of Sanssouci with a timber-braced gallery, dark octagonal smock, and four open lattice sails.',
  camera,
  lookAt,
  sunDirection: [-29, 48, -42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'The native perimeter of the individually named windmill gallery.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'working-gallery-and-sails', position: camera, lookAt },
    { name: 'gallery-braces-and-masonry', position: [-16, 3, -24], lookAt: [0, 9.5, 0] },
    { name: 'tailpole-and-rounded-cap', position: [25, 21, 30], lookAt: [0, 18, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'historic-mill-of-sanssouci-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.95,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
