import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  closed,
  floorSampler,
  pairs,
  planarMid,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const elevation = floorSampler(read('terrain-grid'));
const footprint = (id) => frame.features.find((feature) => feature.id === 'way/' + id).points;
const visitorOutline = footprint(470511754);
const twoQuarters = [
  {
    main: [-109.31, -97.42, -7.77, -0.1],
    ell: [-105.84, -99.19, -0.77, 8.3],
    porch: [-106.65, -100.06],
    tone: 'ded8c3',
    outline: footprint(470511758),
  },
  {
    main: [-92.69, -80.3, -8.03, -0.31],
    ell: [-88.01, -82.66, -0.88, 7.53],
    porch: [-90.31, -82.22],
    tone: 'd6cebb',
    outline: footprint(470511756),
  },
];
const guardhouseOutline = footprint(470511760);
const blockhouseOutline = footprint(470511761);
const stone = rgb('baae92');
const darkerStone = rgb('a2987d');
const foundation = rgb('9e9176');
const paleTrim = rgb('e6dfcd');
const shutter = rgb('64685e');
const grayRoof = rgb('938d82');
const darkRoof = rgb('6b675d');
const paleRoof = rgb('dedacf');
const brownTrim = rgb('55483a');
const brownTimber = rgb('816c53');
const dustyGlass = rgb('566367');
const brass = rgb('aa925c');

const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93 },
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  foundation: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.14 },
  shingle: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9 },
  flatRoof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.94 },
};

const wallFrames = (polygon) => pairs(closed(outwardRing(polygon))).map(([a, b]) => wallFace(a, b));
function base(out, outline, top, thickness = 0.28) {
  const minimum = Math.min(...outline.map((point) => elevation(point)));
  extrude(out, 'foundation', outline, minimum - 0.7, top + thickness, foundation, { top: false });
}
function slab(out, slot, ring, bottom, top, color) {
  extrude(out, slot, ring, bottom, top, color, { top: false });
  cap(out, slot, ring, top, color);
}
function opening(out, side, x, y, width, height, detail, door = false, trim = paleTrim) {
  const left = x - width / 2;
  const right = x + width / 2;
  const head = y + height;
  const at = (u, h) => side.P(u, h, 0.055);
  if (detail === 0) {
    quad4(
      out,
      door ? 'trim' : 'glass',
      at(left, y),
      at(right, y),
      at(right, head),
      at(left, head),
      door ? brownTimber : dustyGlass,
    );
    return;
  }
  fbox(
    out,
    door ? 'trim' : 'glass',
    side,
    left,
    right,
    y,
    head,
    0.012,
    0.052,
    door ? brownTimber : dustyGlass,
  );
  if (detail === 1) {
    for (const u of [left - 0.084, right]) {
      quad4(out, 'trim', at(u, y), at(u + 0.084, y), at(u + 0.084, head), at(u, head), trim);
    }
    quad4(
      out,
      'trim',
      at(left, head),
      at(right, head),
      at(right, head + 0.084),
      at(left, head + 0.084),
      trim,
    );
    return;
  }
  for (const u of [left - 0.035, right + 0.035]) {
    fbox(out, 'trim', side, u - 0.051, u + 0.051, y, head, 0.038, 0.123, trim);
  }
  fbox(out, 'trim', side, left - 0.084, right + 0.084, head, head + 0.084, 0.036, 0.115, trim);
  fbox(out, 'trim', side, left - 0.084, right + 0.084, y - 0.084, y, 0.038, 0.143, trim);
  if (door) {
    fbox(
      out,
      'glass',
      side,
      left + 0.13,
      right - 0.13,
      y + 0.97,
      head - 0.27,
      0.055,
      0.078,
      dustyGlass,
    );
    fbox(out, 'trim', side, right - 0.18, right - 0.137, y + 0.78, y + 0.85, 0.07, 0.115, brass);
    return;
  }
  fbox(out, 'trim', side, x - 0.027, x + 0.027, y, head, 0.055, 0.086, trim);
  fbox(
    out,
    'trim',
    side,
    left,
    right,
    y + height * 0.49,
    y + height * 0.49 + 0.038,
    0.055,
    0.084,
    trim,
  );
  if (detail === 3) {
    for (const fraction of [0.26, 0.73]) {
      const rail = y + fraction * height;
      fbox(out, 'trim', side, left, right, rail, rail + 0.023, 0.055, 0.081, trim);
    }
  }
}
function chimney(out, x, z, y, high, color) {
  abox(out, 'limestone', [x - 0.32, y, z - 0.32], [x + 0.32, high, z + 0.32], color);
  abox(
    out,
    'limestone',
    [x - 0.375, high - 0.095, z - 0.375],
    [x + 0.375, high + 0.065, z + 0.375],
    darkerStone,
  );
}

function visitorCenter(out, detail) {
  const outline = visitorOutline;
  const level = elevation([-33.5, -26]) + 0.16;
  const roofline = level + 3.24;
  base(out, outline, level);
  extrude(out, 'limestone', outline, level + 0.09, roofline, stone, { top: false });
  const [cx, cz] = planarMid(outline);
  const roof = outline.map(([x, z]) => [cx + (x - cx) * 1.026, cz + (z - cz) * 1.033]);
  extrude(out, 'trim', roof, roofline - 0.14, roofline + 0.23, brownTrim, { top: false });
  slab(out, 'flatRoof', roof, roofline + 0.223, roofline + 0.25, paleRoof);
  for (const side of wallFrames(outline)) {
    const length = side.length;
    const nx = side.normal[0];
    const nz = side.normal[1];
    if (length < 3.5) continue;
    const isCourt = nz < -0.87 && length > 10.5;
    if (isCourt) {
      fbox(
        out,
        'trim',
        side,
        0.58,
        length - 0.58,
        level + 0.33,
        roofline - 0.31,
        0.014,
        0.127,
        brownTimber,
      );
      const windowCount = length > 15 ? 6 : 3;
      for (let i = 0; i < windowCount; i++) {
        const middle = (length * (i + 0.5)) / windowCount;
        fbox(
          out,
          'glass',
          side,
          middle - 0.49,
          middle + 0.49,
          level + 0.5,
          roofline - 0.44,
          0.129,
          0.169,
          dustyGlass,
        );
        if (detail >= 1)
          fbox(
            out,
            'trim',
            side,
            middle - 0.026,
            middle + 0.026,
            level + 0.5,
            roofline - 0.44,
            0.172,
            0.201,
            brownTrim,
          );
      }
    } else if (detail >= 1 && Math.abs(nx) < 0.4) {
      opening(
        out,
        side,
        length * 0.53,
        level + 1.44,
        Math.min(3.4, length * 0.46),
        1.1,
        detail,
        false,
        brownTrim,
      );
    }
    if (detail >= 1) {
      for (const u of [0.07, length - 0.15]) {
        fbox(out, 'trim', side, u, u + 0.12, level + 0.15, roofline, 0.014, 0.146, brownTimber);
      }
    }
  }
  if (detail >= 1) {
    const court = rect(-49.9, -26.3, -32.7, -24.14);
    slab(out, 'foundation', court, elevation([-41.5, -25]) - 0.22, level + 0.025, rgb('b4aa97'));
  }
}

function house(out, item, detail) {
  const [left, right, front, back] = item.main;
  const [ellLeft, ellRight, ellFront, ellBack] = item.ell;
  const body = rect(left, front, right, back);
  const ell = rect(ellLeft, ellFront, ellRight, ellBack);
  const level = elevation([(left + right) / 2, front]) + 0.34;
  const eave = level + 5.08;
  const color = rgb(item.tone);
  base(out, body, level, 0.04);
  base(out, ell, level - 0.05, 0.04);
  extrude(out, 'siding', body, level, eave, color, { top: false });
  extrude(out, 'siding', ell, level - 0.05, level + 2.7, color, { top: false });
  gableRoof(
    out,
    'shingle',
    [left, (front + back) / 2],
    [right, (front + back) / 2],
    back - front,
    eave,
    level + 7.38,
    grayRoof,
    { overhang: 0.27, endSlot: 'siding', endColor: color },
  );
  gableRoof(
    out,
    'shingle',
    [(ellLeft + ellRight) / 2, ellFront],
    [(ellLeft + ellRight) / 2, ellBack],
    ellRight - ellLeft,
    level + 2.7,
    level + 4.02,
    grayRoof,
    { overhang: 0.23, endSlot: 'siding', endColor: color, ends: [false, true] },
  );
  chimney(
    out,
    (left + right) / 2 + 1.9,
    (front + back) / 2 - 0.22,
    level + 6.7,
    level + 8.03,
    rgb('a28773'),
  );
  for (const side of wallFrames(body)) {
    const north = side.normal[1] < -0.8;
    const south = side.normal[1] > 0.8;
    const radii = north || south ? [0.2, 0.5, 0.8] : [0.28, 0.7];
    for (const f of radii) {
      if (!(south && f === 0.5))
        opening(out, side, side.length * f, level + 3.24, 0.79, 1.22, detail);
      if (south && f === 0.5) continue;
      const door = north && f === 0.5;
      opening(
        out,
        side,
        side.length * f,
        level + (door ? 0.08 : 0.94),
        door ? 0.95 : 0.83,
        door ? 2.18 : 1.34,
        detail,
        door,
      );
      if (detail >= 2 && north && !door) {
        for (const d of [-0.68, 0.68]) {
          fbox(
            out,
            'trim',
            side,
            side.length * f + d - 0.15,
            side.length * f + d + 0.15,
            level + 0.93,
            level + 2.31,
            0.032,
            0.11,
            shutter,
          );
        }
      }
    }
  }
  const [porchLeft, porchRight] = item.porch;
  const outer = front - 1.35;
  slab(
    out,
    'trim',
    rect(porchLeft, outer, porchRight, front),
    level - 0.16,
    level + 0.04,
    brownTimber,
  );
  slab(
    out,
    'shingle',
    rect(porchLeft - 0.09, outer - 0.11, porchRight + 0.09, front + 0.07),
    level + 2.55,
    level + 2.67,
    grayRoof,
  );
  for (const x of [porchLeft + 0.12, (porchRight + porchLeft) / 2, porchRight - 0.12]) {
    abox(
      out,
      'trim',
      [x - 0.062, level, outer + 0.1],
      [x + 0.062, level + 2.55, outer + 0.225],
      paleTrim,
    );
  }
  for (const side of wallFrames(ell)) {
    if (side.normal[1] < -0.8) continue;
    opening(out, side, side.length * 0.64, level + 0.82, 0.76, 1.13, detail);
  }
}

function guardhouse(out, detail) {
  const envelope = rect(-73.35, 108.75, -42.85, 116.075);
  const level = elevation([-57.5, 108.35]) + 0.13;
  const eave = level + 3.08;
  base(out, envelope, level, 0.1);
  extrude(out, 'limestone', envelope, level, eave, darkerStone, { top: false });
  gableRoof(
    out,
    'shingle',
    [-73.35, 112.41],
    [-42.85, 112.41],
    7.325,
    eave,
    level + 4.85,
    grayRoof,
    { overhang: 0.43, endSlot: 'limestone', endColor: darkerStone },
  );
  for (const side of wallFrames(envelope)) {
    const north = side.normal[1] < -0.85;
    const positions = side.length > 20 ? [0.12, 0.24, 0.36, 0.49, 0.61, 0.75, 0.87] : [0.51];
    for (const [index, fraction] of positions.entries()) {
      const door = north && (index === 1 || index === 5);
      opening(
        out,
        side,
        side.length * fraction,
        level + (door ? 0.15 : 1.05),
        door ? 1.02 : 0.66,
        door ? 2.16 : 1.17,
        detail,
        door,
        stone,
      );
    }
  }
  for (const x of [-64.35, -51.95]) chimney(out, x, 112.15, level + 4.52, level + 5.32, stone);
}

function blockhouse(out, detail) {
  const center = [64.98, 17.5];
  const radius = plan.dimensions.blockhouseRadiusM;
  const ring = Array.from({ length: 6 }, (_, i) => {
    const angle = (i * Math.PI) / 3 + 0.064;
    return [center[0] + radius * Math.cos(angle), center[1] + radius * Math.sin(angle)];
  });
  const level = elevation(center) + 0.14;
  const eave = level + 5.13;
  base(out, ring, level);
  extrude(out, 'limestone', ring, level, eave, stone, { top: false });
  const roof = outwardRing(
    ring.map(([x, z]) => [
      center[0] + (x - center[0]) * 1.082,
      center[1] + (z - center[1]) * 1.082,
    ]),
  );
  extrude(out, 'trim', roof, eave - 0.14, eave + 0.12, brownTrim, { top: false });
  const apex = level + 7.64;
  for (const [a, b] of pairs(closed(roof))) {
    tri(
      out,
      'shingle',
      [a[0], eave + 0.1, a[1]],
      [b[0], eave + 0.1, b[1]],
      [center[0], apex, center[1]],
      darkRoof,
    );
  }
  chimney(out, center[0] + 0.03, center[1] - 0.06, apex - 0.63, apex + 0.65, darkerStone);
  const wings = [
    { x: 65.03, start: 7.98, end: 13.2 },
    { x: 62.79, start: 22.22, end: 28.02 },
  ];
  for (const [index, { x, start, end }] of wings.entries()) {
    const half = plan.dimensions.wingSideM / 2;
    const wall = rect(x - half, start, x + half, end);
    const wingEave = level + 2.74;
    base(out, wall, level, 0.1);
    extrude(out, 'limestone', wall, level, wingEave, stone, { top: false });
    gableRoof(out, 'shingle', [x, start], [x, end], half * 2, wingEave, level + 4.17, grayRoof, {
      overhang: 0.27,
      endSlot: 'limestone',
      endColor: stone,
      ends: [index === 0, index === 1],
    });
    for (const side of wallFrames(wall)) {
      if (side.normal[1] * (index === 0 ? 1 : -1) > 0.86) continue;
      const door = side.normal[1] * (index === 0 ? -1 : 1) > 0.86;
      opening(
        out,
        side,
        side.length / 2,
        level + (door ? 0.13 : 0.96),
        door ? 0.98 : 0.75,
        door ? 2.12 : 1.23,
        detail,
        door,
        darkerStone,
      );
    }
  }
  for (const side of wallFrames(ring)) {
    for (const [fraction, h] of [
      [0.32, 3.42],
      [0.72, 3.42],
      [0.53, 1.45],
    ]) {
      const middle = side.length * fraction;
      fbox(
        out,
        'trim',
        side,
        middle - 0.094,
        middle + 0.094,
        level + h,
        level + h + 0.48,
        0.014,
        0.042,
        brownTrim,
      );
    }
  }
}

function build(out, detail) {
  visitorCenter(out, detail);
  guardhouse(out, detail);
  blockhouse(out, detail);
  for (const item of twoQuarters) house(out, item, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-hays-model.mjs';
const camera = [137, 124, -159];
const lookAt = [-20, 2.5, 35];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'archaeological',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Fort Hays State Historic Site, with the limestone blockhouse and guardhouse, two officers houses and visitor center.',
  camera,
  lookAt,
  sunDirection: [-47, 52, -64],
  mediumFiContext: {
    scale: 2.05,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: visitorOutline,
    outlines: [
      visitorOutline,
      guardhouseOutline,
      blockhouseOutline,
      ...twoQuarters.map((item) => item.outline),
    ],
    minimumCoverage: 0.9,
    basis:
      'Suppress duplicate building forms only over the five individually mapped building outlines.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'fort-site-five-surviving-and-visitor-buildings', position: camera, lookAt },
    { name: 'limestone-hexagonal-blockhouse', position: [86, 8, -14], lookAt: [64.5, 3, 18] },
    {
      name: 'long-limestone-guardhouse',
      position: [-40, 8, 80],
      lookAt: [-57, 0.8, 112],
    },
    {
      name: 'paired-frame-officers-quarters',
      position: [-71, 12, -30],
      lookAt: [-94, 3.1, -0.5],
    },
    { name: 'visitor-center-recessed-entry', position: [-37, 4.1, -54], lookAt: [-33.6, 2.3, -22] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-hays-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.51, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.068, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from the exact CC0 Qualla image by FUBAR007, public-domain USDA survey imagery, published historic site facts, and native OSM geometry under ODbL.',
};
