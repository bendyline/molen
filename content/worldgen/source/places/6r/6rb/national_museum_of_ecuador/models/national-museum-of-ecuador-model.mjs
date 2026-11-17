import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const outline = read('map-frame.json').geometry.outline;
const terrain = read('terrain-grid.json');
const { facadeTopY, estimatedAgoraCrownY, entranceThresholdY, foundationBaseY } = plan.dimensions;
const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.73, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#e4f6ff', roughness: 0.23, metallic: 0.26 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.08 },
};
const concrete = rgb('a29d93');
const paleConcrete = rgb('cbc7ba');
const coping = rgb('e2ded1');
const roof = rgb('d5d4c9');
const roofSeam = rgb('b1b8b3');
const frame = rgb('555c58');
const trim = rgb('3a4243');
const lowerGlass = ['345557', '3f5f60', '466565', '4e6e6e'].map(rgb);
const upperGlass = ['5b7f81', '688d90', '74969c', '80a0a4'].map(rgb);
const entryDoor = rgb('27454d');
const signPanel = rgb('2e3337');
const signText = rgb('dddcd8');
const mouth = 23;
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const atHeight = ([x, z], y) => [x, y, z];

function face(out, slot, points, color) {
  quad(out, slot, points, normalFor(...points), color);
}

function wall(out, slot, a, b, low, high, color) {
  const bottom = Array.isArray(low) ? low : [low, low];
  face(
    out,
    slot,
    [atHeight(a, bottom[0]), atHeight(b, bottom[1]), atHeight(b, high), atHeight(a, high)],
    color,
  );
}

function roofBand(out, a, b, low, high, color) {
  for (let i = 0; i < a.length; ++i) {
    const j = (i + 1) % a.length;
    face(
      out,
      'roof',
      [atHeight(a[i], low), atHeight(a[j], low), atHeight(b[j], high), atHeight(b[i], high)],
      color,
    );
  }
}

function ground([x, z]) {
  const [u, v] = [x, z].map((value, i) => (value - terrain.origin[i]) / terrain.stepMeters);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const { heightsMeters: y } = terrain;
  return (
    (y[j][i] * (1 - a) + y[j][i + 1] * a) * (1 - b) +
    (y[j + 1][i] * (1 - a) + y[j + 1][i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function facade(out, detail) {
  const bands = [
    [0.82, 3.13],
    [3.67, 6.19],
    [6.72, 9.27],
  ];
  for (let i = 0; i < outline.length; ++i) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    // A narrow darker lower band meets the original field along the park side.
    const support = [a, b].map((point) =>
      Math.min(0.49, Math.max(foundationBaseY, ground(point) - 1.6)),
    );
    wall(out, 'concrete', a, b, support, 0.67, concrete);
    let sill = 0.67;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = detail === 0 ? 1 : Math.ceil(length / [1, 5, 2.37, 1.54][detail]);
    for (const [row, [low, high]] of bands.entries()) {
      wall(out, 'trim', a, b, sill, low, row === 0 ? trim : frame);
      for (let p = 0; p < count; ++p) {
        const t0 = p / count;
        const t1 = (p + 1) / count;
        const joint = detail === 0 ? 0 : Math.min(0.055 / length, (t1 - t0) / 4);
        const glass = row === 0 ? lowerGlass : upperGlass;
        const baseShade = (i + row * 2) % 4;
        const shade = detail < 2 ? baseShade : (baseShade + (p % 5 === 2 ? 1 : 0)) % 4;
        wall(out, 'glass', mix(a, b, t0), mix(a, b, t1 - joint), low, high, glass[shade]);
        if (joint) wall(out, 'trim', mix(a, b, t1 - joint), mix(a, b, t1), low, high, frame);
      }
      sill = high;
    }
    wall(out, 'concrete', a, b, sill, facadeTopY, coping);
  }
}

function roofing(out, detail) {
  const ring = (scale) =>
    outline.map(([x, z]) => [x * scale - 1.5 * (1 - scale), z * scale - 4 * (1 - scale)]);
  const edge = ring(0.994);
  const shoulder = ring(0.73);
  const crown = ring(0.36);
  const crownFoot = ring(0.65);
  roofBand(out, outline, edge, facadeTopY, facadeTopY - 0.17, coping);
  roofBand(out, edge, shoulder, facadeTopY - 0.17, facadeTopY - 0.22, roof);
  roofBand(out, shoulder, crownFoot, facadeTopY - 0.22, 10.2, roofSeam);
  if (detail < 2) {
    roofBand(out, crownFoot, crown, 10.2, estimatedAgoraCrownY - 0.55, roof);
  } else {
    const mid = ring(0.51);
    roofBand(out, crownFoot, mid, 10.2, 11.9, roof);
    roofBand(out, mid, crown, 11.9, estimatedAgoraCrownY - 0.55, roof);
  }
  roofBand(out, crown, ring(0.015), estimatedAgoraCrownY - 0.55, estimatedAgoraCrownY, roof);
  const cap = ring(0.015).map((point) => atHeight(point, estimatedAgoraCrownY));
  for (let i = 1; i < cap.length - 1; ++i)
    out.addTriangle(
      'roof',
      'palette:#ffffff',
      [cap[0], cap[i], cap[i + 1]],
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      roof,
    );
}

const monogram = {
  M: [
    [0, 0],
    [0, 1],
    [0.5, 0.43],
    [1, 1],
    [1, 0],
  ],
  U: [
    [0, 1],
    [0, 0.18],
    [0.18, 0],
    [0.82, 0],
    [1, 0.18],
    [1, 1],
  ],
  N: [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ],
  A: [
    [0, 0],
    [0.5, 1],
    [1, 0],
  ],
};

function entrance(out, detail) {
  const [x, z] = outline[mouth];
  const [ax, az] = outline[mouth - 1];
  const [bx, bz] = outline[mouth + 1];
  const length = Math.hypot(bx - ax, bz - az);
  const along = [(bx - ax) / length, (bz - az) / length];
  const outward = [-along[1], along[0]];
  const local = (u, v, y) => [
    x + u * along[0] + v * outward[0],
    y,
    z + u * along[1] + v * outward[1],
  ];
  const panel = (slot, u0, u1, v, y0, y1, color) =>
    face(
      out,
      slot,
      [local(u0, v, y0), local(u1, v, y0), local(u1, v, y1), local(u0, v, y1)],
      color,
    );
  const slab = (slot, left, right, inner, outer, bottom, top, color) => {
    const polygon = [
      [left, inner],
      [left, outer],
      [right, outer],
      [right, inner],
    ].map(([u, v]) => local(u, v, top));
    face(out, slot, polygon, color);
    for (let i = 0; i < polygon.length; ++i) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      face(out, slot, [[a[0], bottom, a[2]], [b[0], bottom, b[2]], b, a], color);
    }
  };
  const floor = entranceThresholdY;
  slab('concrete', -7.2, 7.2, -0.65, 4.8, floor - 0.79, floor, paleConcrete);
  slab('concrete', -6.8, 6.8, -0.42, 3.03, 4.22, 4.57, coping);
  for (const u of [-6.8, 5.98])
    slab('concrete', u, u + 0.82, -0.44, 3.01, floor, 4.22, paleConcrete);
  panel('trim', -5.98, 5.98, 0.38, floor, 4.22, signPanel);
  panel('glass', -4.38, 0.19, 0.44, floor + 0.13, 3.02, entryDoor);
  panel('trim', 0.55, 5.67, 0.45, floor + 0.15, 3.2, signPanel);
  if (detail < 1) return;
  for (const u of [-4.43, -3.24, -2.1, -0.96, 0.15])
    panel('trim', u, u + 0.064, 0.46, floor + 0.11, 3.06, frame);
  panel('trim', -4.43, 0.21, 0.46, 2.57, 2.65, frame);
  const stroke = ([u0, y0], [u1, y1], size = 0.031) => {
    const d = Math.hypot(u1 - u0, y1 - y0);
    const a = (-(y1 - y0) / d) * size;
    const b = ((u1 - u0) / d) * size;
    face(
      out,
      'trim',
      [
        local(u0 - a, 0.49, y0 - b),
        local(u1 - a, 0.49, y1 - b),
        local(u1 + a, 0.49, y1 + b),
        local(u0 + a, 0.49, y0 + b),
      ],
      signText,
    );
  };
  for (const [i, letter] of [...'MUNA'].entries()) {
    const line = monogram[letter].map(([u, y]) => [0.87 + i * 0.62 + u * 0.49, 2.03 + y * 0.61]);
    for (let j = 1; j < line.length; ++j) stroke(line[j - 1], line[j]);
    if (letter === 'A') stroke([line[0][0] + 0.12, 2.28], [line[2][0] - 0.12, 2.28]);
  }
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    const lines = [
      [0.12, 1.74],
      [0.47, 1.46],
      [0.47, 2.38],
      [0.13, 2.59],
    ];
    for (let i = 1; i < lines.length; ++i)
      stroke(...lines.slice(i - 1, i + 1).map(([u, y]) => [4.42 + u * side, y]), 0.035);
  }
  if (detail === 3)
    for (const u of [-3.4, -1.13]) panel('trim', u - 0.018, u + 0.018, 0.49, 1.26, 1.58, signText);
}

function draw(out, detail) {
  facade(out, detail);
  roofing(out, detail);
  entrance(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [160, 76, -160];
const lookAt = [0, 4, 2];

export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The National Museum of Ecuador occupies the Edificio de los Espejos in Quito. Its low oval of smoked mirrored glass wraps the Casa de la Cultura’s museum and theatres beneath a pale roof.',
  camera,
  lookAt,
  sunDirection: [76, 110, -65],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_standing_seam'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.78,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'avenida-patria-entrance', position: [42, 5, -86], lookAt: [27, 2.4, -65] },
    { name: 'north-curtain-wall', position: [85, 15, -133], lookAt: [6, 4, -38] },
    { name: 'park-side-and-plinth', position: [117, 20, 145], lookAt: [12, 1, 30] },
    { name: 'agora-roof', position: [-42, 132, 88], lookAt: [0, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.29, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original exterior geometry informed by one exact CC0 Qualla photograph, open geographic data and institutional architecture records.',
};
