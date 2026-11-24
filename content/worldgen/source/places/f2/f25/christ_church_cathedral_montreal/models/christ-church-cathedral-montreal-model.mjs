import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  gableRoof,
  lathe,
  opening,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/christ-church-cathedral-montreal-shape-controls');
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.95 },
  carved: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.63 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
};
const gray = rgb('a8a398');
const lower = rgb('969185');
const pale = rgb('c0b8a7');
const paving = rgb('b4ac9c');
const slate = rgb('6e7775');
const slateBlue = rgb('727d7c');
const aluminum = rgb('888f8e');
const seam = rgb('a0a6a4');
const shutters = rgb('4e524d');
const dark = rgb('484c4a');
const blue = rgb('556565');
const red = rgb('753d36');
const street = shape.outline[0][1];
const cx = 0.5;
const bellZ = -5.2;
const base = 0.3;

function box(out, slot, x0, x1, z0, z1, y0, y1, color, bottom = false) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom });
}

function belt(out, f, y, depth, color = pale, height = 0.25) {
  fbox(out, 'carved', f, 0, f.length, y, y + height, -0.1, depth, color, { bottom: true });
}

function buttress(out, f, u, bottom, top, level, width = 0.82, depth = 0.96) {
  if (level === 0) {
    fbox(out, 'masonry', f, u - width / 2, u + width / 2, bottom, top, -0.1, depth * 0.79, lower);
    return;
  }
  const spans = [
    [bottom, top - 0.62, depth, width],
    [top - 0.62, top, depth * 0.62, width * 0.82],
  ];
  for (const [y0, y1, d, w] of spans) {
    fbox(out, 'masonry', f, u - w / 2, u + w / 2, y0, y1, -0.11, d, gray);
    if (level >= 2)
      fbox(
        out,
        'carved',
        f,
        u - w * 0.58,
        u + w * 0.58,
        y1 - 0.18,
        y1 - 0.075,
        -0.03,
        d + 0.13,
        pale,
      );
  }
}

function districtAperture(out, f, u, baseY, width, height, slot, color) {
  const half = width / 2;
  const rise = width * 0.54;
  const spring = baseY + height - rise;
  const arc = pointedArch(half, rise, 2);
  quad4(
    out,
    slot,
    f.P(u - half, baseY, 0.046),
    f.P(u + half, baseY, 0.046),
    f.P(u + half, spring, 0.046),
    f.P(u - half, spring, 0.046),
    color,
  );
  for (let i = 1; i < arc.length; i++) {
    const [[a, y0], [b, y1]] = [arc[i - 1], arc[i]];
    tri(
      out,
      slot,
      f.P(u, spring, 0.046),
      f.P(u + b, spring + y1, 0.046),
      f.P(u + a, spring + y0, 0.046),
      color,
    );
    quad4(
      out,
      'carved',
      f.P(u + a, spring + y0, 0.083),
      f.P(u + b, spring + y1, 0.083),
      f.P(u + b * 1.13, spring + y1 + 0.14, 0.083),
      f.P(u + a * 1.13, spring + y0 + 0.14, 0.083),
      pale,
    );
  }
}

function lancet(out, f, u, y, width, height, level, color = blue) {
  if (level === 1) {
    districtAperture(out, f, u, y, width, height, 'glass', color);
    return;
  }
  opening(out, f, u, y, width, height, {
    head: 'pointed',
    rise: width * 0.54,
    glassSlot: 'glass',
    frameSlot: 'carved',
    glass: color,
    frame: pale,
    frameWidth: level === 1 ? 0.13 : 0.175,
    frameDepth: 0.115,
    mullions: level >= 2 ? 1 : 0,
    transoms: level >= 3 ? 1 : 0,
  });
}

function timberDoor(out, f, u, y, w, h, level) {
  if (level === 1) {
    districtAperture(out, f, u, y, w, h, 'timber', red);
    return;
  }
  opening(out, f, u, y, w, h, {
    head: 'pointed',
    rise: w * 0.52,
    glassSlot: 'timber',
    frameSlot: 'carved',
    glass: red,
    frame: pale,
    frameWidth: level >= 2 ? 0.36 : 0.24,
    frameDepth: 0.22,
    mullions: level >= 2 ? 1 : 0,
    mullionColor: rgb('78413b'),
    sill: false,
  });
}

function roofSlope(out, x0, x1, z0, z1, y0, y1) {
  const a = [x0, y0, z0],
    b = [x0, y0, z1],
    c = [x1, y1, z1],
    d = [x1, y1, z0];
  quad4(out, 'slate', a, b, c, d, slateBlue);
}

function aisle(out, x0, x1, z0, z1, direction, level) {
  const outer = direction < 0 ? x0 : x1,
    inner = direction < 0 ? x1 : x0,
    high = 10.8,
    low = 8.45;
  box(out, 'masonry', x0, x1, z0, z1, base - 0.72, low, gray);
  if (direction < 0)
    roofSlope(out, outer - 0.43, inner + 0.14, z0 - 0.1, z1 + 0.11, low - 0.16, high);
  else roofSlope(out, inner - 0.14, outer + 0.43, z0 - 0.1, z1 + 0.11, high, low - 0.16);
  const f = direction < 0 ? wallFace([outer, z0], [outer, z1]) : wallFace([outer, z1], [outer, z0]);
  belt(out, f, 0.54, 0.13, lower, 0.28);
  if (level === 0) return;
  const n = f.length > 20 ? 6 : 3;
  const step = f.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * step;
    lancet(out, f, u, 2.77, Math.min(2.07, step * 0.52), 4.3, level);
    buttress(out, f, i * step + 0.36, 0.35, 7.38, level, 0.74, 0.75);
  }
  buttress(out, f, f.length - 0.36, 0.35, 7.38, level, 0.74, 0.75);
  if (level >= 2) belt(out, f, 2.36, 0.14, lower, 0.2);
}

function nave(out, level) {
  const a = -6.38,
    b = 7.37,
    z0 = -0.19;
  const eave = 14.68,
    ridge = 22.2;
  box(out, 'masonry', a, b, z0, street, base - 0.71, eave, gray);
  gableRoof(out, 'slate', [cx, z0 - 0.08], [cx, street], b - a, eave, ridge, slate, {
    overhang: 0.39,
    endSlot: 'masonry',
    endColor: gray,
  });
  aisle(out, -10.62, a, z0, street, -1, level);
  aisle(out, b, 11.62, z0, street, 1, level);
  const sideLeft = wallFace([a, z0], [a, street]);
  const sideRight = wallFace([b, street], [b, z0]);
  if (level >= 1) {
    for (const f of [sideLeft, sideRight]) {
      belt(out, f, 14.32, 0.19, lower, 0.16);
      for (let i = 0; i < 6; i++)
        lancet(out, f, ((i + 0.5) * f.length) / 6, 11.25, 1.39, 2.69, level);
    }
  }
  const x0 = 11.5,
    x1 = 15.23,
    zMin = 24.2,
    zMax = 29.36;
  box(out, 'masonry', x0, x1, zMin, zMax, -0.49, 6.93, gray);
  gableRoof(
    out,
    'slate',
    [x0, (zMin + zMax) / 2],
    [x1, (zMin + zMax) / 2],
    zMax - zMin,
    6.93,
    9.62,
    slate,
    { overhang: 0.23, endSlot: 'masonry', endColor: gray },
  );
  if (level >= 1)
    timberDoor(out, wallFace([x1, zMax], [x1, zMin]), (zMax - zMin) / 2, 0.5, 1.58, 3.8, level);
}

function transepts(out, level) {
  const west = -16.04,
    east = 16.58,
    z0 = -10.23,
    z1 = -0.12,
    center = (z0 + z1) / 2;
  const eave = 12.98,
    ridge = 20.14;
  box(out, 'masonry', west, east, z0, z1, -0.45, eave, gray);
  for (const [a, b] of [
    [west, cx - 5.75],
    [cx + 5.75, east],
  ]) {
    gableRoof(out, 'slate', [a, center], [b, center], z1 - z0, eave, ridge, slateBlue, {
      overhang: 0.35,
      endSlot: 'masonry',
      endColor: gray,
      ends: [a === west, b === east],
    });
  }
  for (const f of [wallFace([west, z0], [west, z1]), wallFace([east, z1], [east, z0])]) {
    belt(out, f, 0.62, 0.19, lower, 0.32);
    buttress(out, f, 0.68, 0.45, 12.52, level, 1.04, 1.12);
    buttress(out, f, f.length - 0.68, 0.45, 12.52, level, 1.04, 1.12);
    if (level >= 1) lancet(out, f, f.length / 2, 3.48, 4.72, 9.12, level);
    if (level >= 2) {
      belt(out, f, 3.03, 0.18, lower, 0.22);
      for (const u of [f.length * 0.23, f.length * 0.77])
        lancet(out, f, u, 2.31, 0.83, 2.35, level, dark);
    }
  }
}

function chancel(out, level) {
  const a = -5.66,
    b = 5.58,
    z0 = -24.36,
    z1 = -10.23,
    center = (a + b) / 2;
  box(out, 'masonry', a, b, z0, z1, -0.5, 13.95, gray);
  gableRoof(out, 'slate', [center, z0], [center, z1], b - a, 13.95, 21.04, slate, {
    overhang: 0.37,
    endSlot: 'masonry',
    endColor: gray,
  });
  aisle(out, -11.02, a, -20.2, z1, -1, level);
  aisle(out, b, 10.39, -20.83, z1, 1, level);
  const end = wallFace([b, z0], [a, z0]);
  if (level >= 1) {
    lancet(out, end, end.length * 0.5, 3.43, 5.17, 9.88, level);
    buttress(out, end, 0.48, 0.42, 11.43, level, 1.05, 1.12);
    buttress(out, end, end.length - 0.48, 0.42, 11.43, level, 1.05, 1.12);
  }
  const v = [9.66, -15.06];
  lathe(
    out,
    'masonry',
    v,
    [
      [-0.43, 3.13, 3.15],
      [7.6, 3.13, 3.15],
    ],
    8,
    gray,
    { rotation: Math.PI / 8, capTop: false },
  );
  lathe(
    out,
    'slate',
    v,
    [
      [7.6, 3.29, 3.31],
      [10.22, 0.26, 0.26],
      [10.46, 0, 0],
    ],
    8,
    slateBlue,
    { rotation: Math.PI / 8, capTop: false },
  );
}

function rose(out, f, u, y, r, level) {
  const count = [8, 12, 18, 24][level];
  const ring = (radius, i, d) =>
    f.P(
      u + radius * Math.cos((i * 2 * Math.PI) / count),
      y + radius * Math.sin((i * 2 * Math.PI) / count),
      d,
    );
  for (let i = 0; i < count; i++) {
    tri(out, 'glass', f.P(u, y, 0.04), ring(r, i, 0.04), ring(r, i + 1, 0.04), dark);
    quad4(
      out,
      'carved',
      ring(r, i, 0.08),
      ring(r + 0.28, i, 0.08),
      ring(r + 0.28, i + 1, 0.08),
      ring(r, i + 1, 0.08),
      pale,
    );
  }
  if (level < 2) return;
  const small = 0.38;
  for (let i = 0; i < count; i++) {
    quad4(
      out,
      'carved',
      ring(small, i, 0.12),
      ring(small + 0.095, i, 0.12),
      ring(small + 0.095, i + 1, 0.12),
      ring(small, i + 1, 0.12),
      pale,
    );
  }
  for (let i = 0; i < 8; i++) {
    const t = (i * Math.PI) / 4,
      dx = Math.cos(t),
      dy = Math.sin(t),
      w = 0.075;
    const p = (length, offset) =>
      f.P(u + length * dx - offset * dy, y + length * dy + offset * dx, 0.116);
    quad4(out, 'carved', p(small, -w), p(r, -w * 0.73), p(r, w * 0.73), p(small, w), pale);
  }
}

function frontFacade(out, level) {
  const f = wallFace([-10.63, street], [11.68, street]);
  const center = cx + 10.63;
  belt(out, f, 0.43, 0.22, lower, 0.25);
  const stepFront = street + 3.2;
  for (let i = 0; i < 4; i++)
    box(
      out,
      'carved',
      -7.29,
      8.28,
      street - 0.15,
      stepFront - i * 0.52,
      -0.22,
      0.145 + i * 0.159,
      paving,
    );
  for (const edge of [0.58, 3.13, f.length - 3.11, f.length - 0.56])
    buttress(out, f, edge, 0.4, edge < 1 || edge > f.length - 1 ? 8.36 : 11.67, level, 1.07, 1.07);
  if (level === 0) return;
  const portals =
    level === 1
      ? [
          [-3.5, 2.43, 4.2],
          [0, 3.03, 5.48],
          [3.5, 2.43, 4.2],
        ]
      : [
          [-3.5, 2.5, 4.33],
          [0, 3.16, 5.53],
          [3.5, 2.5, 4.33],
        ];
  for (const [offset, w, h] of portals) timberDoor(out, f, center + offset, 0.64, w, h, level);
  rose(out, f, center, 10.89, 2.6, level);
  if (level >= 2) {
    lancet(out, f, center, 15.47, 1.04, 3.1, level, dark);
    for (const u of [center - 4.9, center + 4.9]) lancet(out, f, u, 7.21, 1.24, 3.79, level);
    belt(out, f, 7.03, 0.17, lower, 0.19);
  }
}

function crossing(out, level) {
  const r = 5.84;
  const x0 = cx - r,
    x1 = cx + r,
    z0 = bellZ - r,
    z1 = bellZ + r;
  const stoneTop = 33.05;
  box(out, 'masonry', x0, x1, z0, z1, 13.69, stoneTop, gray);
  const faces = [
    wallFace([x0, z1], [x1, z1]),
    wallFace([x1, z1], [x1, z0]),
    wallFace([x1, z0], [x0, z0]),
    wallFace([x0, z0], [x0, z1]),
  ];
  for (const f of faces) {
    belt(out, f, 31.61, 0.3, pale, 0.44);
    if (level === 0) continue;
    belt(out, f, 22.91, 0.19, lower, 0.27);
    for (const u of [f.length * 0.36, f.length * 0.64])
      lancet(out, f, u, 24.38, 1.71, 5.95, level, shutters);
    for (const u of [0.55, f.length - 0.55]) buttress(out, f, u, 19.62, 31.06, level, 0.7, 0.62);
  }
  const top = shape.dimsFromParksCanada[2];
  const target = [cx, bellZ];
  const sections = [
    [stoneTop - 0.035, 6.0, 6.0],
    [34.34, 5.73, 5.73],
    [38.55, 4.27, 4.27],
    [57.22, 1.88, 1.88],
    [67.54, 0.28, 0.28],
  ];
  lathe(out, 'metal', target, sections, 8, aluminum, { rotation: Math.PI / 8, capTop: false });
  const finial = [67.52, 0.19, 0.19];
  lathe(
    out,
    'metal',
    target,
    [finial, [68.13, 0.22, 0.22], [68.52, 0.08, 0.08], [69.8, 0, 0]],
    8,
    seam,
    { capTop: false },
  );
  if (level < 2) return;
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    for (let i = 1; i < sections.length; i++) {
      const [y0, r0] = sections[i - 1],
        [y1, r1] = sections[i];
      const position = (y, r, angle) => [
        cx + (r + 0.029) * Math.cos(angle),
        y,
        bellZ + (r + 0.029) * Math.sin(angle),
      ];
      quad4(
        out,
        'metal',
        position(y0, r0, a - 0.006),
        position(y0, r0, a + 0.006),
        position(y1, r1, a + 0.009),
        position(y1, r1, a - 0.009),
        seam,
      );
    }
  }
  if (level >= 3) {
    box(
      out,
      'metal',
      cx - 0.64,
      cx + 0.64,
      bellZ - 0.055,
      bellZ + 0.055,
      top - 0.61,
      top - 0.49,
      seam,
    );
    box(out, 'metal', cx - 0.049, cx + 0.049, bellZ - 0.054, bellZ + 0.054, top - 1.22, top, seam);
  }
}

function build(out, level) {
  nave(out, level);
  transepts(out, level);
  chancel(out, level);
  crossing(out, level);
  frontFacade(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const streetDetail = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'christ-church-cathedral-montreal-model.mjs';
const camera = [60, 38, 99];
const lookAt = [0.4, 25.2, 4.8];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The standing Montréal cathedral with its limestone nave, lancets, crossing tower, aluminum spire and red triptych doors.',
  camera,
  lookAt,
  sunDirection: [-26, 51, 48],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis: 'The named Christ Church Cathedral envelope includes the attached porch and chancel.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'sainte-catherine-triptych-and-rose',
      position: [2, 8.6, 54.5],
      lookAt: [0.5, 9.3, 33.8],
    },
    { name: 'crossing-and-rebuilt-steeple', position: [47, 37, 34], lookAt: [0, 40, -3] },
    { name: 'transept-chancel-and-vestry', position: [42, 24, -46], lookAt: [0.6, 13, -12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'montreal-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.3,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.64, surfaces },
      street: { export: 'streetDetail', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
};
