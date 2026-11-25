import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  fbox,
  lathe,
  outwardRing,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/aksum-old-cathedral-shape-controls');
const ring = site.mappedRing;
const west = wallFace(ring[0], ring[1]);
const center = (ring[0][0] + ring[1][0]) / 2;
const landing = 3.4;
const east = ring[7][1];
const backOfPortico = 9.44;
const roof = 11.63;
const body = outwardRing([
  [ring[0][0], backOfPortico],
  [ring[1][0], backOfPortico],
  ...ring.slice(2),
]);

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.97 },
  slab: { slot: 'roof', localRef: 'palette:#a39478', roughness: 0.95 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
  shadow: { slot: 'window', localRef: 'palette:#39342a', roughness: 0.97 },
};
const tint = {
  wall: rgb('99836c'),
  course: ['9c8870', 'a7937c', '8b765e', 'a1947d', '978571', '887968'].map(rgb),
  cut: rgb('c0ac91'),
  pier: rgb('baa489'),
  riser: rgb('a2937d'),
  base: rgb('867763'),
  top: rgb('9d8a71'),
  roof: rgb('96836a'),
  wood: rgb('6d5140'),
  shadow: rgb('42362a'),
};

function stepFlight(out, lod, halfWidth, fromY, toY, fromZ, toZ, runs) {
  const count = lod === 0 ? 4 : runs;
  for (let i = 0; i < count; i++) {
    const y0 = fromY + (i * (toY - fromY)) / count;
    const z0 = fromZ + (i * (toZ - fromZ)) / count;
    const y1 = y0 + (toY - fromY) / count;
    const z1 = z0 + (toZ - fromZ) / count;
    abox(
      out,
      'base',
      [center - halfWidth, i === 0 ? y0 - 1.5 : y0, z1 - 0.018],
      [center + halfWidth, y1, z0],
      i % 3 ? tint.riser : tint.top,
      { bottom: false },
    );
    if (lod !== 3) continue;
    const tread = wallFace([center - halfWidth, z0], [center + halfWidth, z0]);
    for (let length = 0.3 + (i % 2) * 0.48; length < tread.length - 0.1; length += 1.23) {
      fbox(
        out,
        'base',
        tread,
        length,
        Math.min(length + 1.18, tread.length - 0.015),
        y0 + 0.033,
        y1 - 0.005,
        -0.01,
        0.028,
        tint.course[(Math.floor(length) + i) % 6],
      );
    }
  }
}

function podium(out, lod) {
  const lower = outwardRing([
    [-25.7, 20.1],
    [15.3, 20.1],
    [15.3, -33.4],
    [10.8, -33.4],
    [10.8, -37.75],
    [-23.1, -37.75],
    [-23.1, -34.2],
    [-25.7, -34.2],
  ]);
  const upper = outwardRing([
    [-25.15, 17.45],
    [center - 10.09, 17.45],
    [center - 10.09, 14.51],
    [center + 10.09, 14.51],
    [center + 10.09, 17.45],
    [14.75, 17.45],
    [14.75, -32.9],
    [10.23, -32.9],
    [10.23, -37.25],
    [-22.56, -37.25],
    [-22.56, -33.65],
    [-25.15, -33.65],
  ]);
  extrude(out, 'base', lower, -3.1, 1.73, tint.base, { topColor: tint.top });
  extrude(out, 'base', upper, 1.73, landing, tint.base, { topColor: tint.top });
  stepFlight(out, lod, 20.5, -0.13, 1.73, 28.21, 20.08, 12);
  abox(out, 'base', [center - 10.4, 1.68, 14.1], [center + 10.4, 1.73, 20.12], tint.top, {
    bottom: false,
  });
  stepFlight(out, lod, 10.1, 1.69, landing, 20.12, 14.52, 10);
  for (const [a, b] of [
    [-25.1, center - 10.08],
    [center + 10.08, 14.7],
  ]) {
    abox(out, 'base', [a, 3.3, 16.45], [b, 4.03, 17.45], tint.base, { bottom: false });
    const sections = lod === 0 ? 2 : 8;
    for (let i = 0; i <= sections; i++) {
      const x = a + 0.48 + (i * (b - a - 0.96)) / sections;
      abox(out, 'cut', [x - 0.35, 3.99, 16.49], [x + 0.35, 4.64, 17.41], tint.pier);
      if (lod > 1) {
        abox(out, 'cut', [x - 0.42, 4.6, 16.425], [x + 0.42, 4.75, 17.475], tint.cut);
      }
    }
  }
  if (lod < 2) return;
  for (const [i, a] of lower.entries()) {
    const face = wallFace(a, lower[(i + 1) % lower.length]);
    if (face.length < 5 || face.normal[1] > 0.9) continue;
    const columns = Math.ceil(face.length / (lod === 3 ? 1.55 : 2.65));
    for (let row = 0; row < (lod === 3 ? 4 : 2); row++) {
      const y0 = -0.83 + row * (lod === 3 ? 0.65 : 1.25);
      for (let i = 0; i < columns; i++) {
        const span = face.length / columns;
        const u = i * span + ((i * 7 + row * 3) % 13) * 0.012 + 0.04;
        fbox(
          out,
          'base',
          face,
          u,
          Math.min(face.length - 0.018, u + span - 0.21),
          y0,
          y0 + (lod === 3 ? 0.55 : 1.14),
          -0.025,
          0.045,
          tint.course[(row + i * 5) % 6],
        );
      }
    }
  }
}

function portico(out, lod) {
  const pillars = [
    [0, 1.46],
    [4.76, 6.49],
    [10.49, 12.2],
    [15.61, west.length],
  ];
  for (const [a, b] of pillars) {
    fbox(out, 'cut', west, a, b, landing, 9.92, -4.65, 0, tint.pier);
    if (lod > 0) {
      fbox(out, 'cut', west, a - 0.095, b + 0.095, landing, 3.83, -0.05, 0.16, tint.cut);
      fbox(out, 'cut', west, a - 0.085, b + 0.085, 9.64, 9.96, -0.05, 0.143, tint.cut);
    }
    if (lod < 2) continue;
    const lift = lod === 3 ? 0.465 : 0.87;
    for (let y = 3.89, i = 0; y < 9.58; y += lift, i++) {
      const split = a + (b - a) * (i % 2 ? 0.34 : 0.57);
      for (const [u0, u1, offset] of [
        [a + 0.03, split - 0.023, 0],
        [split + 0.025, b - 0.029, 2],
      ]) {
        fbox(
          out,
          'stone',
          west,
          u0,
          u1,
          y,
          Math.min(y + lift - 0.048, 9.59),
          -0.014,
          0.029,
          tint.course[(i + offset) % 6],
        );
      }
    }
  }
  fbox(out, 'stone', west, 0, west.length, 9.92, roof, -4.67, 0, tint.wall, { bottom: true });
  fbox(out, 'cut', west, -0.27, west.length + 0.26, 9.92, 10.24, -0.01, 0.32, tint.cut);
  fbox(out, 'cut', west, -0.13, west.length + 0.15, 11.27, 11.53, -0.04, 0.15, tint.cut);
  const inside = wallFace([ring[0][0], backOfPortico + 0.025], [ring[1][0], backOfPortico + 0.025]);
  for (const u of [3.15, 8.49, 13.92]) {
    fbox(out, 'shadow', inside, u - 0.76, u + 0.76, 3.65, 6.29, -0.012, 0.021, tint.shadow);
    fbox(out, 'wood', inside, u - 0.66, u + 0.66, 3.66, 6.13, 0.015, 0.048, tint.wood);
    fbox(out, 'cut', inside, u - 0.89, u + 0.89, 6.35, 6.49, -0.015, 0.095, tint.pier);
    fbox(out, 'shadow', inside, u - 0.8, u + 0.8, 7, 8.84, -0.012, 0.03, tint.shadow);
    if (lod < 2) continue;
    const cells = lod === 3 ? 6 : 3;
    for (let i = 1; i < cells; i++) {
      const offset = (i * 1.54) / cells;
      fbox(
        out,
        'wood',
        inside,
        u - 0.77 + offset,
        u - 0.73 + offset,
        7.03,
        8.8,
        0.018,
        0.055,
        tint.wood,
      );
      fbox(
        out,
        'wood',
        inside,
        u - 0.77,
        u + 0.77,
        7 + offset,
        7.04 + offset,
        0.018,
        0.057,
        tint.wood,
      );
    }
  }
}

function masonry(out, lod) {
  extrude(out, 'stone', body, landing, roof, tint.wall, { topSlot: 'slab', topColor: tint.roof });
  if (lod === 0) return;
  for (const [i, start] of body.entries()) {
    const side = wallFace(start, body[(i + 1) % body.length]);
    if (side.normal[1] > 0.99 && side.length > 15) continue;
    const longSide = side.length > 18;
    const openings = longSide
      ? [0.24, 0.52, 0.76].map((p) => [p * side.length, 6.82, 1.01, 1.77])
      : side.length > 6
        ? [[0.58 * side.length, 7.55, 0.88, 1.22]]
        : [];
    for (const [u, y, width, height] of openings) {
      fbox(
        out,
        'shadow',
        side,
        u - width / 2,
        u + width / 2,
        y,
        y + height,
        0.02,
        0.055,
        tint.shadow,
      );
      fbox(
        out,
        'cut',
        side,
        u - width * 0.68,
        u + width * 0.68,
        y - 0.09,
        y + 0.03,
        0,
        0.17,
        tint.cut,
      );
      fbox(
        out,
        'cut',
        side,
        u - width * 0.62,
        u + width * 0.62,
        y + height,
        y + height + 0.15,
        0,
        0.085,
        tint.cut,
      );
      if (lod > 1) {
        fbox(out, 'wood', side, u - 0.054, u + 0.054, y, y + height, 0.039, 0.09, tint.wood);
      }
    }
    if (lod < 2) continue;
    const rise = lod === 3 ? 0.43 : 0.77;
    const width = lod === 3 ? 0.97 : 1.82;
    for (let row = 0, y = landing + 0.07; y < roof - 0.28; row++, y += rise) {
      for (let i = -1; i * width < side.length; i++) {
        const offset = ((row * 3 + (i + 1) * 7) % 13) / 13;
        const left = Math.max(0.032, (i + (row % 2) * 0.47) * width + offset * 0.16);
        const right = Math.min(side.length - 0.025, left + width * (0.67 + offset * 0.23));
        if (
          right - left < 0.11 ||
          openings.some(
            ([u, y0, w, h]) =>
              left < u + w * 0.75 &&
              right > u - w * 0.75 &&
              y < y0 + h + 0.18 &&
              y + rise > y0 - 0.13,
          )
        )
          continue;
        fbox(
          out,
          'stone',
          side,
          left,
          right,
          y,
          Math.min(roof - 0.16, y + rise - 0.037),
          -0.009,
          0.036 + 0.057 * offset,
          tint.course[(row + (i + 1) * 3) % 6],
        );
      }
    }
  }
}

function parapets(out, lod) {
  const outline = outwardRing(ring);
  for (const [i, a] of outline.entries()) {
    const side = wallFace(a, outline[(i + 1) % outline.length]);
    const entry = side.normal[1] > 0.98 && side.length > 15;
    const count = Math.max(2, Math.round(side.length / (entry ? 1.43 : 2.5)));
    const stride = side.length / count;
    fbox(out, 'stone', side, 0, side.length, roof - 0.014, roof + 0.53, -0.45, 0.02, tint.wall);
    for (let j = 0; j < count; j += lod === 0 && !entry ? 3 : 1) {
      const u = (j + 0.5) * stride;
      const h = (entry ? 0.73 : 0.52) + (j % 5 === 0 ? 0.22 : 0);
      fbox(
        out,
        'stone',
        side,
        u - 0.22,
        u + 0.23,
        roof + 0.44,
        roof + h + 0.29,
        -0.48,
        0.027,
        tint.pier,
      );
      if (lod === 0) continue;
      fbox(
        out,
        'cut',
        side,
        u - 0.26,
        u + 0.27,
        roof + h + 0.27,
        roof + h + 0.4,
        -0.51,
        0.061,
        tint.cut,
      );
    }
  }
  const z = 10.55;
  abox(
    out,
    'stone',
    [center - 1.83, roof - 0.02, z - 1.38],
    [center + 1.83, 13.04, z + 1.48],
    tint.wall,
  );
  abox(
    out,
    'shadow',
    [center - 0.54, 12.19, z + 1.46],
    [center + 0.54, 12.97, z + 1.51],
    tint.shadow,
  );
  lathe(
    out,
    'slab',
    [center, z],
    [
      [12.99, 1.56, 1.28],
      [13.29, 1.43, 1.2],
      [13.64, 0.88, 0.78],
      [13.79, 0.16, 0.16],
    ],
    lod > 1 ? 12 : 8,
    tint.roof,
  );
  abox(
    out,
    'wood',
    [center - 0.065, 13.74, z - 0.06],
    [center + 0.065, 14.72, z + 0.06],
    tint.wood,
  );
  abox(
    out,
    'wood',
    [center - 0.32, 14.35, z - 0.055],
    [center + 0.32, 14.47, z + 0.055],
    tint.wood,
  );
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  podium(out, lod);
  masonry(out, lod);
  portico(out, lod);
  parapets(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'old-church-of-our-lady-mary-of-zion-model.mjs';
const camera = [center - 39, 21, 59];
const lookAt = [center, 6, -2];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'heritage-cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The Old Cathedral at Aksum in 1893, with three lintelled portico openings, flat crenellated roof, and a broad double flight of steps on the Aksumite podium.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-30, 38, 47],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.91,
    basis: 'Named OpenStreetMap way 188465648 delineates the mapped church envelope at this site.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-approach-and-stair', position: [center, 8.3, 46], lookAt: [center, 6.6, 11] },
    {
      name: 'lintelled-portico-and-rooflet',
      position: [center + 7, 11.9, 27],
      lookAt: [center - 1, 9.7, 12],
    },
    { name: 'south-podium-and-side-projection', position: [36, 13.2, 13], lookAt: [0, 6.5, 2] },
    {
      name: 'east-terrace-and-rear-envelope',
      position: [26, 17, east - 39],
      lookAt: [center, 6, east + 7],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: recipe.replace('-model.mjs', '-') + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.088, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.025, surfaces },
    },
  },
};
