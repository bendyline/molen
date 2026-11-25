import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/saint-neophytos-enkleistra-shape-controls');
const terraceY = site.terraceY;

const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97 },
  dress: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  cliff: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98 },
  limewash: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
};
const tone = {
  stone: rgb('b1a28a'),
  wall: rgb('a89b82'),
  dressed: rgb('c2b5a0'),
  terrace: rgb('b6a88f'),
  limewash: rgb('c9c0a9'),
  repair: rgb('bcb298'),
  wood: rgb('635440'),
  shadow: rgb('4b4439'),
  tile: rgb('7a6552'),
  ledge: [rgb('a69983'), rgb('aea28c'), rgb('938773'), rgb('b7a78a')],
  rock: [rgb('9c917e'), rgb('a39884'), rgb('958b79'), rgb('9e937f'), rgb('a89b87')],
};

function cliff(out, lod) {
  const limits = [
    [-24.0, -3.43, 12.8],
    [-20.4, -0.72, 16.6],
    [-16.1, -0.37, 16.5],
    [-10.8, 1.46, 15.75],
    [-7.1, 0.81, 15.15],
    [-3.3, 1.77, 15.6],
    [1.2, 1.91, 14.7],
    [5.7, 0.87, 14.18],
    [10.4, 0.12, 13.2],
    [15.8, -0.33, 13.42],
    [20.7, -1.08, 13.25],
    [24.1, -4.66, 10.5],
  ];
  const offsets = [
    [0.0, -2.0],
    [0.44, -1.46],
    [0.62, -0.86],
    [0.77, 0.46],
    [0.86, -0.09],
    [0.96, -1.9],
    [1.03, -4.2],
  ];
  const layers = lod === 0 ? [0, 2, 4, 6] : lod === 1 ? [0, 1, 2, 4, 5, 6] : [0, 1, 2, 3, 4, 5, 6];
  const segments = lod >= 2 ? lod : 1;
  const frontPoints = layers.map((layer) => {
    const [heightFraction, setback] = offsets[layer];
    return limits.flatMap(([x, z, crest], i) => {
      if (i === limits.length - 1) return [[x, crest * heightFraction, z + setback]];
      const [nx, nz, nextCrest] = limits[i + 1];
      return Array.from({ length: segments }, (_, j) => {
        const t = j / segments;
        const index = i * segments + j;
        const variation = Math.sin(index * 1.78 + layer * 2.44);
        return [
          x + (nx - x) * t + 0.57 * variation,
          (crest + (nextCrest - crest) * t) * heightFraction + 0.3 * variation,
          z + (nz - z) * t + setback + 0.79 * Math.sin(index * 2.26 - layer * 1.73),
        ];
      });
    });
  });
  for (let row = 1; row < frontPoints.length; row++) {
    const low = frontPoints[row - 1];
    const high = frontPoints[row];
    for (let i = 0; i < low.length - 1; i++) {
      const color = lod === 0 ? tone.rock[0] : tone.rock[(i * 3 + row * 2) % tone.rock.length];
      tri(out, 'cliff', low[i], low[i + 1], high[i + 1], color);
      tri(out, 'cliff', low[i], high[i + 1], high[i], color);
    }
  }
  const top = frontPoints.at(-1);
  const rear = top.map(([x, y], i) => [
    x,
    y - 0.18 + 0.45 * Math.sin(i * 0.82),
    -13.3 - 1.8 * Math.sin(i * 0.3),
  ]);
  for (let i = 0; i < top.length - 1; i++) {
    const color = tone.rock[(i * 2 + 1) % tone.rock.length];
    tri(out, 'cliff', top[i], top[i + 1], rear[i], color);
    tri(out, 'cliff', top[i + 1], rear[i + 1], rear[i], color);
    const floorLeft = [rear[i][0], -0.1, rear[i][2]];
    const floorRight = [rear[i + 1][0], -0.1, rear[i + 1][2]];
    tri(out, 'cliff', floorRight, floorLeft, rear[i], color);
    tri(out, 'cliff', floorRight, rear[i], rear[i + 1], color);
  }
  for (const index of [0, top.length - 1]) {
    const front = frontPoints.map((row) => row[index]);
    const outer = rear[index];
    for (let i = 0; i < front.length - 1; i++) {
      const level = i / (front.length - 1);
      const a = front[i];
      const b = front[i + 1];
      const q = [outer[0], (outer[1] + 0.1) * level - 0.1, outer[2]];
      const p = [outer[0], ((outer[1] + 0.1) * (i + 1)) / (front.length - 1) - 0.1, outer[2]];
      if (index === 0) {
        tri(out, 'cliff', q, a, b, tone.rock[2]);
        tri(out, 'cliff', q, b, p, tone.rock[2]);
      } else {
        tri(out, 'cliff', a, q, p, tone.rock[3]);
        tri(out, 'cliff', a, p, b, tone.rock[3]);
      }
    }
  }
}

function ledgeBlocks(out, face, base, top, lod) {
  if (lod === 0) return;
  const levelCount = lod === 1 ? 3 : lod === 2 ? 6 : 9;
  const course = (top - base) / levelCount;
  const step = lod === 3 ? 1.14 : lod === 2 ? 1.66 : 2.4;
  for (let row = 0; row < levelCount; row++) {
    const start = row % 2 === 0 ? 0.15 : 0.61 * step;
    for (let column = 0; start + column * step < face.length - 0.16; column++) {
      const x = start + column * step + 0.13 * Math.sin(row + column * 2.6);
      const end = Math.min(x + step - 0.12, face.length - 0.08);
      const y = base + row * course + 0.059 * Math.sin(column * 1.29 + row);
      const h = course * (0.72 + 0.105 * Math.sin(column * 1.6 + row * 3.3));
      const relief = 0.021 + 0.035 * (1 + Math.sin(column * 2.3 + row));
      if (end > x + 0.1)
        fbox(
          out,
          'limestone',
          face,
          x,
          end,
          y,
          Math.min(top - 0.04, y + h),
          -0.06,
          relief,
          tone.ledge[(row * 3 + column) % 4],
        );
    }
  }
}

function approach(out, lod) {
  const retainingEdge = site.historicalOutline.map(([x, z], i) => [
    x,
    i === 1 || i === 2 ? z - 0.61 : z,
  ]);
  const terrace = outwardRing(retainingEdge);
  extrude(out, 'limestone', terrace, -2.92, terraceY - 0.16, tone.wall, {
    topSlot: 'dress',
    topColor: tone.terrace,
  });
  extrude(out, 'dress', terrace, terraceY - 0.16, terraceY, tone.terrace);
  for (let i = 0; i < 3; i++) {
    const a = retainingEdge[i];
    const b = retainingEdge[i + 1];
    const wall = wallFace(a, b);
    const lowestVisible = i === 0 ? 2.2 : 0.18;
    ledgeBlocks(out, wall, lowestVisible, terraceY - 0.19, lod);
  }

  const [highX, highY, highZ] = site.stairTop;
  const [lowX, lowY, lowZ] = site.stairFoot;
  const flight = facade([lowX, lowZ], [highX - lowX, highZ - lowZ]);
  const run = Math.hypot(highX - lowX, highZ - lowZ);
  const count = lod === 0 ? 12 : site.stairCount;
  const halfStep = site.stairWidth / 2;
  for (let step = 0; step < count; step++) {
    const u = (run * step) / count;
    const v = (run * (step + 1)) / count;
    const y = lowY + ((highY - lowY) * (step + 1)) / count;
    fbox(
      out,
      'dress',
      flight,
      u - 0.018,
      v + 0.026,
      y - 0.25,
      y,
      -halfStep - 0.06,
      halfStep + 0.06,
      tone.ledge[step % 4],
    );
    if (lod >= 1)
      fbox(
        out,
        'limestone',
        flight,
        u,
        v + 0.013,
        Math.max(-2.8, y - 1.17),
        y - 0.22,
        -halfStep,
        halfStep,
        tone.wall,
      );
  }

  const [endX, endY, endZ] = site.bridgeEnd;
  const landingWidth = 1.45;
  abox(
    out,
    'limestone',
    [endX - landingWidth, -3.12, lowZ - 0.24],
    [endX + landingWidth, endY - 0.15, endZ],
    tone.wall,
  );
  abox(
    out,
    'dress',
    [endX - landingWidth, endY - 0.16, lowZ - 0.25],
    [endX + landingWidth, endY, endZ],
    tone.terrace,
  );
  for (const direction of [-1, 1]) {
    const x = endX + direction * 1.17;
    abox(
      out,
      'dress',
      [x - 0.14, endY, lowZ + 0.26],
      [x + 0.14, endY + 0.23, endZ - 0.19],
      tone.dressed,
    );
    for (const z of [lowZ + 0.51, endZ - 0.47]) {
      abox(
        out,
        'limestone',
        [x - 0.25, endY + 0.01, z - 0.24],
        [x + 0.25, endY + 0.88, z + 0.24],
        tone.stone,
      );
      if (lod >= 1)
        abox(
          out,
          'dress',
          [x - 0.28, endY + 0.84, z - 0.27],
          [x + 0.28, endY + 0.96, z + 0.27],
          tone.dressed,
        );
    }
  }
  const bankZ = 25.5;
  const bankY = -2.91;
  const bankWidth = 1.31;
  const left = endX - bankWidth;
  const right = endX + bankWidth;
  quad4(
    out,
    'limestone',
    [left, endY, endZ - 0.03],
    [left, bankY, bankZ],
    [right, bankY, bankZ],
    [right, endY, endZ - 0.03],
    tone.wall,
  );
  if (lod >= 1) {
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const z = endZ + ((bankZ - endZ) * i) / steps;
      const next = endZ + ((bankZ - endZ) * (i + 1)) / steps;
      const height = endY + ((bankY - endY) * i) / steps;
      abox(
        out,
        'dress',
        [left, height - 0.31, z],
        [right, height, next + 0.026],
        tone.ledge[i % 4],
        { bottom: false },
      );
    }
  }
}

function gate(out, lod) {
  const initial = facade([0, 4.13], [1, 0]);
  const center = -13.52;
  const extent = [-18.2, -9.04];
  const spring = terraceY + 2.35;
  const radius = 2.31;
  const rim = 0.34;
  const waist = terraceY + 5.31;
  const crown = terraceY + 6.69;
  const steps = [6, 9, 14, 18][lod];
  const arc = (angle, distance, d) =>
    initial.P(center + distance * Math.cos(angle), spring + distance * Math.sin(angle), d);
  for (let i = 0; i < steps; i++) {
    const right = (i * Math.PI) / steps;
    const left = ((i + 1) * Math.PI) / steps;
    const a = arc(left, radius, 0.04);
    const b = arc(right, radius, 0.04);
    const c = arc(right, radius + rim, 0.025);
    const d = arc(left, radius + rim, 0.025);
    quad4(out, 'dress', a, b, c, d, tone.ledge[i % 4]);
    quad4(out, 'limestone', d, c, [c[0], waist, c[2]], [d[0], waist, d[2]], tone.wall);
    quad4(out, 'limestone', a, arc(left, radius, -0.95), arc(right, radius, -0.95), b, tone.stone);
  }
  for (const [a, b] of [
    [extent[0], center - radius - rim],
    [center + radius + rim, extent[1]],
  ]) {
    fbox(out, 'limestone', initial, a, b, terraceY, waist, -4.35, 0.027, tone.wall);
    const face = wallFace([a, 4.158], [b, 4.158]);
    ledgeBlocks(out, face, terraceY + 0.07, waist - 0.18, lod);
  }
  for (const direction of [-1, 1]) {
    const x = center + direction * (radius + rim / 2);
    fbox(
      out,
      'dress',
      initial,
      x - rim / 2,
      x + rim / 2,
      terraceY,
      spring,
      -0.95,
      0.04,
      tone.stone,
    );
  }
  fbox(out, 'limestone', initial, extent[0], extent[1], waist, crown, -4.35, 0.027, tone.wall);
  fbox(
    out,
    'dress',
    initial,
    extent[0] - 0.18,
    extent[1] + 0.19,
    crown - 0.11,
    crown + 0.15,
    -4.44,
    0.2,
    tone.dressed,
  );
  fbox(
    out,
    'timber',
    initial,
    center - 0.33,
    center + 0.29,
    waist + 0.11,
    waist + 1.08,
    -0.025,
    0.043,
    tone.shadow,
  );
  fbox(
    out,
    'timber',
    initial,
    center - radius,
    center + radius,
    terraceY + 0.03,
    waist - 0.08,
    -3.28,
    -3.12,
    tone.shadow,
  );

  const screenWidth = radius - 0.07;
  const screenTop = terraceY + 1.42;
  for (let i = 0; i < (lod >= 2 ? 5 : 3); i++) {
    const y = terraceY + 0.17 + (i * 1.16) / (lod >= 2 ? 4 : 2);
    fbox(
      out,
      'dress',
      initial,
      center - screenWidth,
      center + screenWidth,
      y,
      y + 0.095,
      -0.64,
      -0.4,
      tone.dressed,
    );
  }
  if (lod >= 1)
    for (let i = 0; i <= 8; i++) {
      const x = center - screenWidth + (i * 2 * screenWidth) / 8;
      fbox(
        out,
        'dress',
        initial,
        x - 0.062,
        x + 0.062,
        terraceY + 0.14,
        screenTop,
        -0.65,
        -0.39,
        tone.dressed,
      );
    }
}

function screen(out, a, b, z, top, doorway, lod) {
  const front = facade([0, z], [1, 0]);
  const [x, width, height] = doorway;
  const left = x - width / 2;
  const right = x + width / 2;
  for (const [lo, hi, low] of [
    [a, left, terraceY],
    [right, b, terraceY],
    [left, right, terraceY + height],
  ])
    fbox(out, 'limewash', front, lo, hi, low, top, -1.78, 0.035, tone.limewash);
  fbox(
    out,
    'timber',
    front,
    left,
    right,
    terraceY + 0.045,
    terraceY + height - 0.045,
    -0.38,
    -0.26,
    tone.wood,
  );
  fbox(
    out,
    'limestone',
    front,
    x - width * 0.63,
    x + width * 0.63,
    terraceY,
    terraceY + 0.14,
    -0.15,
    0.21,
    tone.dressed,
  );
  fbox(
    out,
    'limestone',
    front,
    a - 0.055,
    b + 0.055,
    top - 0.105,
    top + 0.086,
    -1.85,
    0.117,
    tone.stone,
  );
  if (lod < 2) return;
  const middle = (a + b) / 2;
  for (const u of [middle - 0.63, middle + 0.47])
    fbox(
      out,
      'timber',
      front,
      u - 0.042,
      u + 0.042,
      top - 0.66,
      top - 0.24,
      0.039,
      0.056,
      tone.shadow,
    );
  fbox(
    out,
    'limewash',
    front,
    right + 0.26,
    Math.min(right + 0.88, b),
    terraceY + 0.43,
    terraceY + 1.44,
    0.031,
    0.056,
    tone.repair,
  );
}

function structures(out, lod) {
  gate(out, lod);
  screen(out, -20.16, -18.19, 2.48, terraceY + 3.42, [-19.31, 0.63, 2.06], lod);
  screen(out, -9.13, -5.12, 3.79, terraceY + 4.54, [-6.61, 0.66, 1.77], lod);
  screen(out, -5.14, 4.31, 3.55, terraceY + 3.88, [0.9, 0.92, 2.18], lod);
  screen(out, 4.3, 12.22, 3.32, terraceY + 4.11, [10.34, 1.0, 2.77], lod);
  screen(out, 12.21, 20.14, 2.97, terraceY + 3.76, [17.82, 0.88, 2.44], lod);
  const eaves = terraceY + 4.08;
  quad4(
    out,
    'tile',
    [4.1, eaves, 3.58],
    [12.38, eaves, 3.58],
    [12.38, eaves + 0.51, 0.74],
    [4.1, eaves + 0.51, 0.74],
    tone.tile,
  );
  if (lod >= 1)
    for (let i = 0; i < 13; i++) {
      const x = 4.28 + 0.61 * i;
      abox(
        out,
        'timber',
        [x - 0.058, eaves - 0.16, 3.43],
        [x + 0.058, eaves + 0.014, 3.6],
        tone.wood,
      );
    }

  // The wall beside the small door retains the rising remnant of a plaster molding.
  if (lod >= 2) {
    const front = facade([0, 3.37], [1, 0]);
    const arc = (angle, r) =>
      front.P(4.22 + r * Math.cos(angle), terraceY + 1.58 + r * Math.sin(angle), 0.18);
    for (const radius of [1.12, 1.37, 1.59]) {
      for (let i = 0; i < 8; i++) {
        const angle = 1.83 + i * 0.132;
        const end = angle + 0.132;
        quad4(
          out,
          'dress',
          arc(end, radius),
          arc(angle, radius),
          arc(angle, radius + 0.114),
          arc(end, radius + 0.114),
          tone.dressed,
        );
      }
    }
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  cliff(out, lod);
  approach(out, lod);
  structures(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'saint-neophytos-enkleistra-model.mjs';
const camera = [33, 29, 57];
const lookAt = [0, 7.15, 1];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The hermitage and chapel at the Enkleistra of Saint Neophytos in 1888, with the cliff, arched stone screen, elevated terrace, stairs and the ravine crossing.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-22, 35, 44],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    minHeight: terraceY + 0.02,
    outline: [
      [-15.89, 3.52],
      [-11.17, 3.52],
      [-11.17, 0.83],
      [-15.89, 0.83],
    ],
    basis: 'The small entrance recess is excavated into the cliff above the preserved terrace.',
  },
  buildingCutout: {
    outline: site.mappedCliffsideBuilding,
    minimumCoverage: 0.86,
    basis:
      'The underlying cliffside range is the presently mapped footprint that registers the historical enclosure.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'hogarth-facing-cliff', position: [15, 12.3, 46], lookAt: [-0.7, 7.0, 3.2] },
    { name: 'hermitage-cell-and-arch', position: [-12, 9.9, 22], lookAt: [-11.9, 9.2, 3.1] },
    { name: 'old-stair-and-ravine-crossing', position: [24.8, 11.5, 29], lookAt: [4.1, 4.6, 9.4] },
    { name: 'cliff-and-terrace-overview', position: [-36, 32, 37], lookAt: [-4.4, 7.2, 0.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'saint-neophytos-enkleistra-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.085, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.019, surfaces },
    },
  },
};
