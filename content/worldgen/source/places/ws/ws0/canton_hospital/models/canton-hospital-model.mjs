import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/canton-hospital-shape-controls');
const halfWidth = site.historicalOutline[1][0];
const frontZ = site.historicalOutline[1][1];
const backZ = site.historicalOutline[2][1];
const lowerHeight = site.upperGalleryFloor;
const eaves = site.eaveHeight;
const ridge = site.roofRidgeHeight;
const bayWidth = (2 * halfWidth - 0.22) / site.facadeBays;
const front = facade([0, frontZ], [1, 0]);
const gallery = facade([0, frontZ - 2.76], [1, 0]);
const terrace = {
  left: -halfWidth - 0.32,
  right: halfWidth + 0.32,
  back: backZ - 0.37,
  front: frontZ + 1.04,
};

const surfaces = {
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.95 },
  mortar: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#454d49', roughness: 0.66 },
};

const tone = {
  brick: rgb('8c7060'),
  brickArch: [rgb('987b67'), rgb('876958'), rgb('927460'), rgb('9a7c66')],
  base: rgb('898377'),
  stone: rgb('b8af9b'),
  plaster: rgb('b6ad96'),
  inside: rgb('9a8f75'),
  timber: rgb('554c3a'),
  glass: rgb('46514a'),
  tile: rgb('545951'),
  ridge: rgb('696c61'),
  roofShade: rgb('605f50'),
};

function archBay(out, face, u, { bottom, spring, radius, top, depth, lod }) {
  const steps = [5, 8, 12, 16][lod];
  const edge = 0.19;
  const arcPoint = (angle, r, d) =>
    face.P(u + Math.cos(angle) * r, spring + Math.sin(angle) * r, d);
  for (let step = 0; step < steps; step++) {
    const right = (Math.PI * step) / steps;
    const left = (Math.PI * (step + 1)) / steps;
    const innerRight = arcPoint(right, radius, 0);
    const innerLeft = arcPoint(left, radius, 0);
    const outerRight = arcPoint(right, radius + edge, 0);
    const outerLeft = arcPoint(left, radius + edge, 0);
    const shade = lod > 1 ? tone.brickArch[step % tone.brickArch.length] : tone.brick;
    quad4(out, 'brick', innerLeft, innerRight, outerRight, outerLeft, shade);
    quad4(
      out,
      'brick',
      outerLeft,
      outerRight,
      [outerRight[0], top, outerRight[2]],
      [outerLeft[0], top, outerLeft[2]],
      tone.brick,
    );
    quad4(
      out,
      'brick',
      innerLeft,
      arcPoint(left, radius, -depth),
      arcPoint(right, radius, -depth),
      innerRight,
      shade,
    );
  }
  const lo = u - bayWidth / 2;
  const hi = u + bayWidth / 2;
  fbox(out, 'brick', face, lo, u - radius - edge, bottom, top, -depth, 0, tone.brick);
  fbox(out, 'brick', face, u + radius + edge, hi, bottom, top, -depth, 0, tone.brick);
  fbox(
    out,
    'brick',
    face,
    u - radius - edge,
    u - radius,
    bottom,
    spring,
    -depth,
    0,
    tone.brickArch[0],
  );
  fbox(
    out,
    'brick',
    face,
    u + radius,
    u + radius + edge,
    bottom,
    spring,
    -depth,
    0,
    tone.brickArch[0],
  );
  if (lod >= 2) {
    for (const direction of [-1, 1]) {
      const x = u + direction * (radius + 0.14);
      fbox(
        out,
        'stone',
        face,
        x - 0.19,
        x + 0.19,
        spring - 0.14,
        spring - 0.06,
        -0.031,
        0.073,
        tone.base,
      );
    }
  }
}

function upperBay(out, u, lod) {
  const span = bayWidth / 2;
  const balusterLo = u - span + 0.27;
  const balusterHi = u + span - 0.27;
  fbox(
    out,
    'stone',
    front,
    balusterLo,
    balusterHi,
    lowerHeight,
    lowerHeight + 0.17,
    -0.23,
    0.16,
    tone.stone,
  );
  fbox(
    out,
    'stone',
    front,
    balusterLo,
    balusterHi,
    lowerHeight + 0.85,
    lowerHeight + 0.99,
    -0.25,
    0.19,
    tone.stone,
  );
  if (lod >= 1) {
    const count = [0, 7, 10, 12][lod];
    for (let i = 1; i <= count; i++) {
      const x = balusterLo + ((balusterHi - balusterLo) * i) / (count + 1);
      if (lod === 1) {
        fbox(
          out,
          'stone',
          front,
          x - 0.08,
          x + 0.08,
          lowerHeight + 0.16,
          lowerHeight + 0.87,
          -0.12,
          0.07,
          tone.stone,
        );
        continue;
      }
      lathe(
        out,
        'stone',
        [x, frontZ - 0.038],
        [
          [lowerHeight + 0.16, 0.105, 0.105],
          [lowerHeight + 0.23, 0.105, 0.105],
          [lowerHeight + 0.43, 0.065, 0.065],
          [lowerHeight + 0.59, 0.087, 0.087],
          [lowerHeight + 0.72, 0.048, 0.048],
          [lowerHeight + 0.86, 0.095, 0.095],
        ],
        lod === 3 ? 6 : 4,
        tone.stone,
      );
    }
  }
  if (lod === 0) return;
  for (const y of [0.63, lowerHeight + 0.28]) {
    const shaded = y > 4;
    opening(out, gallery, u, y, shaded ? 2.08 : 1.74, shaded ? 2.96 : 2.8, {
      head: lod > 1 ? 'round' : 'flat',
      glassSlot: 'glass',
      frameSlot: 'timber',
      glass: tone.glass,
      frame: tone.timber,
      frameWidth: 0.09,
      frameDepth: 0.08,
      d: 0.04,
    });
    if (lod > 1) {
      fbox(
        out,
        'timber',
        gallery,
        u - 0.034,
        u + 0.034,
        y + 0.13,
        y + 2.27,
        0.073,
        0.116,
        tone.timber,
      );
      fbox(
        out,
        'timber',
        gallery,
        u - 0.79,
        u + 0.79,
        y + 1.8,
        y + 1.86,
        0.073,
        0.116,
        tone.timber,
      );
    }
  }
}

function courtElevation(out, lod) {
  const left = -halfWidth + 0.11;
  for (let i = 0; i < site.facadeBays; i++) {
    const x = left + (i + 0.5) * bayWidth;
    archBay(out, front, x, {
      bottom: 0.17,
      spring: 2.2,
      radius: 1.71,
      top: lowerHeight - 0.03,
      depth: 0.59,
      lod,
    });
    upperBay(out, x, lod);
  }
  for (let i = 0; i <= site.facadeBays; i++) {
    const x = left + i * bayWidth;
    fbox(
      out,
      'mortar',
      front,
      x - 0.225,
      x + 0.225,
      lowerHeight,
      eaves - 0.11,
      -0.52,
      -0.037,
      tone.plaster,
    );
    if (lod === 0) continue;
    for (const [lower, upper, extension] of [
      [lowerHeight, lowerHeight + 0.18, 0.08],
      [eaves - 0.39, eaves - 0.18, 0.07],
    ]) {
      fbox(
        out,
        'stone',
        front,
        x - 0.225 - extension,
        x + 0.225 + extension,
        lower,
        upper,
        -0.59,
        0.06,
        tone.stone,
      );
    }
  }
  fbox(
    out,
    'stone',
    front,
    -halfWidth - 0.09,
    halfWidth + 0.09,
    lowerHeight - 0.27,
    lowerHeight + 0.03,
    -0.54,
    0.16,
    tone.base,
  );
  fbox(
    out,
    'mortar',
    front,
    -halfWidth - 0.23,
    halfWidth + 0.23,
    eaves - 0.37,
    eaves,
    -0.5,
    0.41,
    tone.plaster,
  );
  fbox(
    out,
    'stone',
    front,
    -halfWidth - 0.33,
    halfWidth + 0.33,
    eaves - 0.12,
    eaves + 0.06,
    -0.52,
    0.53,
    tone.stone,
  );
  abox(
    out,
    'stone',
    [-halfWidth, lowerHeight - 0.26, frontZ - 2.83],
    [halfWidth, lowerHeight, frontZ - 0.04],
    tone.base,
  );
  abox(
    out,
    'mortar',
    [-halfWidth, eaves - 0.29, frontZ - 2.78],
    [halfWidth, eaves - 0.16, frontZ + 0.04],
    tone.inside,
  );
}

function secondaryElevation(out, face, length, count, lod) {
  for (let i = 0; i < count; i++) {
    const x = (length * (i + 1)) / (count + 1);
    for (const y of [1.06, lowerHeight + 0.93]) {
      const width = 1.34;
      const height = 2.14;
      opening(out, face, x, y, width, height, {
        glassSlot: 'glass',
        frameSlot: 'timber',
        frameWidth: 0.085,
        frameDepth: 0.14,
        glass: tone.glass,
        frame: tone.timber,
        d: 0.036,
      });
      fbox(out, 'stone', face, x - 0.8, x + 0.8, y - 0.114, y - 0.015, 0.012, 0.187, tone.base);
      if (lod < 2) continue;
      fbox(
        out,
        'timber',
        face,
        x - 0.025,
        x + 0.025,
        y + 0.08,
        y + height - 0.08,
        0.092,
        0.12,
        tone.timber,
      );
      for (const dy of [0.62, 1.31])
        fbox(
          out,
          'timber',
          face,
          x - 0.59,
          x + 0.59,
          y + dy,
          y + dy + 0.046,
          0.085,
          0.13,
          tone.timber,
        );
      if (lod === 3) {
        for (const direction of [-1, 1]) {
          const s = x + direction * 0.96;
          fbox(
            out,
            'timber',
            face,
            s - 0.18,
            s + 0.18,
            y + 0.04,
            y + height - 0.04,
            0,
            0.11,
            tone.timber,
          );
        }
      }
    }
  }
  for (const y of [0.68, lowerHeight - 0.08, eaves - 0.21])
    fbox(out, 'stone', face, -0.06, length + 0.06, y - 0.075, y + 0.075, -0.025, 0.17, tone.base);
}

function roof(out, lod) {
  const x = halfWidth + 0.66;
  const a = [-x, eaves + 0.045, frontZ + 0.68];
  const b = [x, eaves + 0.045, frontZ + 0.68];
  const c = [x, eaves + 0.045, backZ - 0.68];
  const d = [-x, eaves + 0.045, backZ - 0.68];
  const east = [halfWidth - 6.25, ridge, 0.23];
  const west = [-halfWidth + 6.25, ridge, 0.23];
  quad4(out, 'tile', a, b, east, west, tone.tile);
  tri(out, 'tile', b, c, east, tone.tile);
  quad4(out, 'tile', c, d, west, east, tone.tile);
  tri(out, 'tile', d, a, west, tone.tile);
  quad4(out, 'timber', d, c, b, a, tone.roofShade);
  abox(
    out,
    'tile',
    [west[0] - 0.19, ridge - 0.13, 0.1],
    [east[0] + 0.19, ridge + 0.14, 0.36],
    tone.ridge,
  );
  if (lod >= 1) {
    const count = lod === 1 ? 27 : lod === 2 ? 51 : 78;
    for (let i = 0; i < count; i++) {
      const u = -x + 0.13 + ((2 * x - 0.26) * (i + 0.5)) / count;
      for (const z of [a[2], d[2]]) {
        const extension = z > 0 ? [z - 0.14, z + 0.043] : [z - 0.043, z + 0.14];
        abox(
          out,
          'tile',
          [u - 0.046, eaves, extension[0]],
          [u + 0.046, eaves + 0.103, extension[1]],
          tone.ridge,
          { bottom: false },
        );
      }
    }
  }
  for (const [u, top] of [
    [-10.63, ridge + 0.38],
    [11.21, ridge + 0.95],
  ]) {
    abox(out, 'brick', [u - 0.36, ridge - 1.62, -0.74], [u + 0.36, top, 0.06], tone.brick);
    abox(out, 'stone', [u - 0.43, top - 0.12, -0.82], [u + 0.43, top + 0.075, 0.14], tone.base);
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  abox(
    out,
    'stone',
    [terrace.left, -1.66, terrace.back],
    [terrace.right, 0.19, terrace.front],
    tone.base,
  );
  abox(
    out,
    'brick',
    [-halfWidth, 0.17, backZ],
    [halfWidth, lowerHeight - 0.03, gallery.origin[1]],
    tone.brick,
  );
  abox(
    out,
    'mortar',
    [-halfWidth, lowerHeight - 0.04, backZ],
    [halfWidth, eaves, gallery.origin[1]],
    tone.inside,
  );
  for (const direction of [-1, 1]) {
    const x = direction * (halfWidth - 0.27);
    abox(
      out,
      'brick',
      [x - 0.27, 0.17, gallery.origin[1]],
      [x + 0.27, lowerHeight - 0.03, frontZ],
      tone.brick,
    );
    abox(
      out,
      'mortar',
      [x - 0.27, lowerHeight - 0.04, gallery.origin[1]],
      [x + 0.27, eaves, frontZ],
      tone.plaster,
    );
  }
  courtElevation(out, lod);
  if (lod >= 1) {
    secondaryElevation(out, facade([halfWidth, backZ], [-1, 0]), 2 * halfWidth, 7, lod);
    secondaryElevation(out, facade([halfWidth, frontZ], [0, -1]), frontZ - backZ, 2, lod);
    secondaryElevation(out, facade([-halfWidth, backZ], [0, 1]), frontZ - backZ, 2, lod);
    for (let i = 0; i < 3; i++) {
      const y = 0.18 - 0.13 * i;
      abox(
        out,
        'stone',
        [-2.22 - 0.07 * i, y - 0.19, frontZ - 0.13],
        [2.22 + 0.07 * i, y, frontZ + 0.32 + 0.28 * i],
        tone.base,
      );
    }
  }
  roof(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'canton-hospital-model.mjs';
const camera = [39, 22, 49];
const lookAt = [0, 5.14, 1.5];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The late nineteenth-century arcade and veranda of Canton Hospital, with the broad tiled roof shown in the November 1895 photograph.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [26, 43, 36],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    minHeight: 0.2,
    outline: [
      [terrace.left + 0.04, terrace.front - 0.04],
      [terrace.right - 0.04, terrace.front - 0.04],
      [terrace.right - 0.04, terrace.back + 0.04],
      [terrace.left + 0.04, terrace.back + 0.04],
    ],
    basis:
      'The reconstructed terrace covers the small area where the modern surface would obscure the historical arcade.',
  },
  buildingCutout: {
    outline: site.historicalOutline,
    minimumCoverage: 0.87,
    basis: 'The 1895 exterior is registered inside the documented Renji Road hospital premises.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'archival-veranda-front', position: [0, 9.8, 46], lookAt },
    { name: 'brick-arcade-and-veranda', position: [11, 7.5, 23.5], lookAt: [6, 4.5, 5.4] },
    { name: 'roof-and-court-arcade', position: [-20, 15.8, 29], lookAt: [-7, 7, 2.5] },
    { name: 'reconstructed-rear-wall', position: [32, 17, -38], lookAt: [0, 5.1, -2.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'canton-hospital-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.081, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.018, surfaces },
    },
  },
};
