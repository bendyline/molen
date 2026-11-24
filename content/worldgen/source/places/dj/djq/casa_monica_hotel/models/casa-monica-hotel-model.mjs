import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const outline = frame.geometry.outline;
const { cornerTowerApproximateTopM, parapetApproximateTopM, centralBalconyApproximateWidthM } =
  plan.dimensions;
const surfaces = {
  ivory: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  roofing: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87 },
  patio: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.88 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.82 },
};
const warm = rgb('d3c7ae');
const ivory = rgb('e4d7bb');
const stone = rgb('c4b799');
const red = rgb('874944');
const clay = rgb('985649');
const silver = rgb('bcad95');
const honey = rgb('b59760');
const dark = rgb('58605c');
const wood = rgb('654f43');
const rail = rgb('59605a');
const king = facade([0, 24.48], [1, 0]);
const cornerNorth = facade([32.31, 26.284], [1, 0]);
const cornerWest = facade([38.979, 20.37], [0, -1]);
const westDining = wallFace(outline[12], outline[8]);
const westWing = wallFace(outline[8], outline[0]);

function box(out, slot, lo, hi, tint) {
  abox(out, slot, lo, hi, tint, { bottom: false });
}

function panel(out, slot, f, u, y, w, h, depth, tint) {
  const l = u - w / 2;
  const r = u + w / 2;
  quad4(
    out,
    slot,
    f.P(l, y, depth),
    f.P(r, y, depth),
    f.P(r, y + h, depth),
    f.P(l, y + h, depth),
    tint,
  );
}

function window(out, f, u, floor, width, height, level, head = 'flat') {
  if (level === 0) {
    panel(
      out,
      'dark',
      f,
      u,
      floor,
      width,
      height - (head === 'flat' ? 0 : width * 0.22),
      0.078,
      dark,
    );
    return;
  }
  opening(out, f, u, floor, width, height, {
    head,
    glassSlot: 'dark',
    frameSlot: 'stone',
    glass: dark,
    frame: head === 'flat' ? stone : honey,
    frameWidth: head === 'flat' ? 0.11 : 0.2,
    frameDepth: head === 'flat' ? 0.06 : 0.14,
    d: 0.06,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 2 ? 1 : 0,
    mullionColor: wood,
  });
}

function volume(out, ring, lower, top, tint, cap = 'patio') {
  extrude(out, 'ivory', ring, lower, top, tint, { top: false });
  const indices = earcut(ring.flat());
  const p = ([x, z]) => [x, top, z];
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((j) => ring[j]);
    if ((b[1] - a[1]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[1] - a[1]))
      tri(out, cap, p(a), p(b), p(c), silver);
    else tri(out, cap, p(a), p(c), p(b), silver);
  }
}

function hip(out, l, r, b, f, y, peak, axis) {
  const a = [l, y, b],
    g = [r, y, b],
    c = [r, y, f],
    d = [l, y, f];
  const x = (l + r) / 2,
    z = (b + f) / 2;
  if (axis === 'x') {
    const u = [l + (r - l) * 0.2, peak, z],
      v = [r - (r - l) * 0.2, peak, z];
    quad4(out, 'roofing', a, u, v, g, clay);
    quad4(out, 'roofing', d, c, v, u, red);
    tri(out, 'roofing', a, d, u, red);
    tri(out, 'roofing', g, v, c, clay);
  } else {
    const u = [x, peak, z];
    tri(out, 'roofing', a, u, g, clay);
    tri(out, 'roofing', g, u, c, red);
    tri(out, 'roofing', c, u, d, clay);
    tri(out, 'roofing', d, u, a, red);
  }
}

function massing(out, level) {
  const important = [
    0, 3, 5, 8, 9, 12, 13, 14, 15, 18, 20, 22, 23, 24, 25, 27, 28, 29, 30, 32, 33, 34, 36, 37, 40,
    43, 44, 46, 47, 49, 51, 53, 54,
  ];
  const perimeter = level === 0 ? important.map((i) => outline[i]) : outline;
  volume(out, perimeter, -0.45, 13.06, warm);
  box(out, 'ivory', [-34.72, 12.89, 3.91], [25.94, 17.53, 24.42], warm);
  box(out, 'ivory', [-34.43, 12.95, 18.31], [-18.94, 18.43, 26.26], ivory);
  box(out, 'ivory', [-12.77, 12.98, 16.23], [-5.67, 19.27, 26.76], warm);
  box(out, 'ivory', [-12.21, 12.9, 24.35], [0.91, 16.05, 25.19], warm);
  volume(
    out,
    [
      [0.87, 24.41],
      [1.93, 25.72],
      [3.43, 26.55],
      [5.3, 26.62],
      [6.81, 25.97],
      [8.08, 24.42],
      [8.08, 20.2],
      [0.87, 20.2],
    ],
    12.88,
    18.86,
    ivory,
  );
  volume(
    out,
    [
      outline[0],
      outline[3],
      outline[5],
      outline[8],
      outline[12],
      [23.09, 15.44],
      [13.81, -16.85],
      [9.47, -29.98],
    ],
    12.81,
    17.41,
    warm,
  );
  box(out, 'ivory', [-31.18, 12.94, 3.71], [-18.57, 15.54, 17.83], warm);
  hip(out, -34.97, -19.14, 18.06, 26.58, 18.44, 20.68, 'x');
  hip(out, -17.95, -5.71, 4.02, 24.55, 17.49, 19.8, 'x');
  hip(out, 9.17, 25.72, 5.4, 23.73, 17.38, 19.38, 'x');
  hip(out, -10.78, 8.75, -26.8, -19.65, 12.95, 15.58, 'x');
  if (level > 0) {
    box(out, 'ivory', [20.65, 13.02, -27.02], [22.78, 16.95, -24.71], stone);
    box(out, 'ivory', [-33.71, 13.08, -3.28], [-32.21, 15.32, -1.79], stone);
  }
}

function crenels(out, f, start, end, y, level) {
  fbox(out, 'stone', f, start, end, y - 0.27, y + 0.25, -0.14, 0.29, stone);
  if (level === 0) return;
  const n = Math.floor((end - start) / 0.88);
  const width = (end - start) / n;
  for (let i = 0; i < n; i++) {
    const u = start + i * width + width / 2;
    const h = y + 0.77;
    fbox(out, 'ivory', f, u - width * 0.31, u + width * 0.31, y + 0.19, h, -0.18, 0.26, ivory);
    if (level > 1)
      tri(
        out,
        'ivory',
        f.P(u - width * 0.31, h, 0.261),
        f.P(u + width * 0.31, h, 0.261),
        f.P(u, h + 0.16, 0.261),
        ivory,
      );
  }
}

function railing(out, f, left, right, y, d, level, material = 'iron') {
  const tint = material === 'iron' ? rail : wood;
  for (const h of [0.06, 0.98])
    beam(out, material, f.P(left, y + h, d), f.P(right, y + h, d), 0.057, 0.07, tint);
  if (level === 0) return;
  const spacing = level === 1 ? 1.23 : level === 2 ? 0.29 : 0.19;
  for (let u = left + 0.08; u < right; u += spacing)
    beam(out, material, f.P(u, y + 0.05, d), f.P(u, y + 0.98, d), 0.041, 0.052, tint);
}

function smallBalcony(out, f, u, y, w, level) {
  fbox(out, 'stone', f, u - w / 2, u + w / 2, y - 0.21, y, 0, 0.51, stone);
  railing(out, f, u - w / 2, u + w / 2, y, 0.52, level, 'iron');
}

function tower(out, level) {
  const l = 25.865,
    r = 38.788,
    b = 14.53,
    f = 26.25;
  const eave = cornerTowerApproximateTopM - 5.45;
  box(out, 'ivory', [l, -0.44, b], [r, eave, f], ivory);
  hip(
    out,
    l - 0.87,
    r + 0.89,
    b - 0.85,
    f + 0.92,
    eave - 0.02,
    cornerTowerApproximateTopM,
    'pyramid',
  );
  for (const facade of [cornerNorth, cornerWest]) {
    for (const y of [13.16, 17.6, eave - 0.31]) {
      fbox(out, 'stone', facade, -6.13, 6.12, y, y + 0.29, -0.015, 0.25, stone);
    }
    for (const u of [-3.07, 0, 3.07]) window(out, facade, u, 22.91, 2.03, 3.47, level, 'round');
    for (const u of [-2.73, 2.73]) {
      window(out, facade, u, 18.24, 1.64, 3.01, level, 'round');
      if (level > 0) smallBalcony(out, facade, u, 18.23, 1.93, level === 1 ? 0 : level);
    }
    for (const u of [-3.54, 0, 3.54]) {
      window(out, facade, u, 1.18, 1.65, 2.83, level === 1 ? 0 : level);
      window(out, facade, u, 6.0, 1.55, 2.44, level === 1 ? 0 : level, 'round');
      if (level > 0) smallBalcony(out, facade, u, 5.94, 1.89, level === 1 ? 0 : level);
    }
    for (const u of [-1.09, 1.09])
      window(out, facade, u, 12.94, 1.04, 2.69, level === 1 ? 0 : level);
    panel(out, 'stone', facade, 0, 26.87, 10.64, 0.54, 0.16, honey);
    if (level > 1) {
      for (let u = -5.14; u < 5.37; u += 0.58) {
        beam(
          out,
          'wood',
          facade.P(u - 0.24, 27.0, 0.17),
          facade.P(u + 0.24, 27.36, 0.17),
          0.043,
          0.034,
          wood,
        );
        beam(
          out,
          'wood',
          facade.P(u + 0.24, 27.0, 0.17),
          facade.P(u - 0.24, 27.36, 0.17),
          0.043,
          0.034,
          wood,
        );
      }
      for (let u = -5.45; u < 6; u += 0.56)
        fbox(
          out,
          'wood',
          facade,
          u - 0.081,
          u + 0.081,
          eave - 0.72,
          eave + 0.034,
          0.02,
          0.53,
          wood,
        );
    }
  }
}

function diningPavilion(out, level) {
  const f = westDining;
  const width = centralBalconyApproximateWidthM;
  const half = width / 2;
  const middle = 8.17;
  const bottom = 9.42;
  const cap = 14.31;
  fbox(
    out,
    'ivory',
    f,
    middle - half - 0.83,
    middle + half + 0.83,
    12.87,
    parapetApproximateTopM - 0.57,
    -2.4,
    0.31,
    ivory,
  );
  crenels(out, f, middle - half - 0.97, middle + half + 0.97, parapetApproximateTopM - 0.84, level);
  const [fx, , fz] = f.P(0, 0, 0.315);
  const raised = facade([fx, fz], f.along);
  for (const u of [-4.6, 0, 4.6]) {
    window(out, raised, middle + u, 15.49, 1.78, 3.83, level, 'pointed');
    window(out, raised, middle + u, 11.0, 1.62, 2.45, level > 1 ? 2 : 0);
  }
  fbox(
    out,
    'wood',
    f,
    middle - half,
    middle + half,
    bottom - 0.37,
    bottom - 0.03,
    0.02,
    1.77,
    wood,
  );
  quad4(
    out,
    'roofing',
    f.P(middle - half - 0.25, cap - 0.49, 1.92),
    f.P(middle + half + 0.25, cap - 0.49, 1.92),
    f.P(middle + half + 0.25, cap, 0.05),
    f.P(middle - half - 0.25, cap, 0.05),
    clay,
  );
  for (const u of [-1, -0.66, -0.33, 0, 0.33, 0.66, 1]) {
    const p = middle + u * half;
    fbox(out, 'wood', f, p - 0.093, p + 0.093, bottom, cap - 0.39, 1.53, 1.69, wood);
  }
  railing(out, f, middle - half, middle + half, bottom, 1.62, level, 'wood');
  if (level > 1) {
    for (let u = middle - half + 0.17; u < middle + half; u += 0.63)
      beam(out, 'wood', f.P(u, bottom - 1.29, 0.24), f.P(u, bottom - 0.31, 1.62), 0.15, 0.16, wood);
  }
}

function entry(out, level) {
  const f = westWing;
  const middle = 12.5;
  fbox(out, 'stone', f, middle - 4.86, middle + 4.86, -0.12, 10.88, -0.16, 0.77, stone);
  const face = facade([f.P(0, 0, 0.79)[0], f.P(0, 0, 0.79)[2]], f.along);
  for (const u of [-2.5, -0.84, 0.84, 2.5]) window(out, face, middle + u, 0.53, 1.16, 3.41, level);
  for (const u of [-4.2, -3.38, 3.38, 4.2]) {
    const [x, , z] = face.P(middle + u, 0, 0.19);
    lathe(
      out,
      'stone',
      [x, z],
      [
        [0.37, 0.32, 0.32],
        [0.84, 0.29, 0.29],
        [8.37, 0.235, 0.235],
        [8.79, 0.39, 0.39],
      ],
      level > 1 ? 12 : 6,
      ivory,
    );
  }
  fbox(out, 'stone', face, middle - 4.84, middle + 4.84, 4.03, 4.65, 0, 0.12, ivory);
  if (level > 0) {
    const rosette = Array.from({ length: 28 }, (_, i) => {
      const a = (i * Math.PI) / 14;
      const r = 0.96 + 0.18 * Math.cos(a * 4);
      return face.P(middle + r * Math.cos(a), 6.29 + r * Math.sin(a), 0.078);
    });
    for (let i = 0; i < rosette.length; i++)
      tri(
        out,
        'dark',
        face.P(middle, 6.29, 0.078),
        rosette[i],
        rosette[(i + 1) % rosette.length],
        dark,
      );
  }
}

function streetEdge(coordinate, axis) {
  const by = 1 - axis;
  let edge = -Infinity;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (a[axis] <= coordinate === b[axis] <= coordinate) continue;
    const t = (coordinate - a[axis]) / (b[axis] - a[axis]);
    edge = Math.max(edge, a[by] + (b[by] - a[by]) * t);
  }
  return edge;
}

function wings(out, level) {
  for (const u of [
    -32.1, -28.64, -25.13, -21.62, -17.6, -14.19, -10.46, -6.72, -2.59, 10.38, 14.09, 17.82, 21.63,
  ]) {
    const f = facade([u, streetEdge(u, 0) + 0.061], [1, 0]);
    for (const y of [1.46, 5.02, 8.58, 12.0, 15.16])
      window(
        out,
        f,
        0,
        y,
        1.37,
        y === 1.46 ? 2.43 : 2.15,
        level === 1 || y > 15 ? 0 : level,
        y === 1.46 ? 'round' : 'flat',
      );
    if (level > 1 && u < 22 && (u < -27 || u > -3)) smallBalcony(out, f, 0, 4.92, 1.77, 1);
  }
  for (const u of [3.3, 10.47, 14.26, 20.83, 24.34, 28.1, 32.7]) {
    const [, , z] = westWing.P(u, 0);
    const f = facade([streetEdge(z, 1) + 0.12, z], [0, -1]);
    for (const y of [1.59, 4.99, 8.48, 11.93]) {
      if (level === 0 && (y === 4.99 || y === 11.93)) continue;
      window(out, f, 0, y, 1.41, 2.2, level === 1 ? 0 : level);
    }
  }
  if (level > 0) {
    const perimeter = outwardRing(outline);
    for (let i = 0; i < perimeter.length; i++) {
      const f = wallFace(perimeter[i], perimeter[(i + 1) % perimeter.length]);
      if (
        f.length < 5 ||
        (f.origin[0] > 23 && f.normal[0] > 0.5) ||
        (f.origin[1] > 16 && f.normal[1] > 0.5)
      )
        continue;
      const cols = Math.round(f.length / 3.65);
      for (let c = 0; c < cols; c++) {
        const u = ((c + 0.5) * f.length) / cols;
        for (const y of [1.34, 4.71, 8.18, 11.33]) window(out, f, u, y, 1.34, 1.65, 0);
      }
    }
  }
  for (const [l, r] of [
    [-21.9, -14.81],
    [8.47, 13.84],
    [17.97, 25.92],
  ])
    crenels(out, king, l, r, 17.71, level);
}

function build(out, level) {
  massing(out, level);
  wings(out, level);
  tower(out, level);
  diningPavilion(out, level);
  entry(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'casa-monica-hotel-model.mjs';
const camera = [96, 39, 94];
const lookAt = [0, 13.1, -1.54];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Casa Monica Hotel',
  wikidataId: plan.wikidataId,
  category: 'hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Spanish and Moorish Revival hotel with its red-roofed corner tower, timber veranda and crenellated parapets.',
  camera,
  lookAt,
  sunDirection: [94, 55, 38],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis: 'Named footprint of the standing Casa Monica Hotel at King and Cordova.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'tile_ceramic',
    'concrete_plain',
    'wood_vertical',
    'metal_painted',
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'king-cordova-tower', position: [76, 15.6, 67], lookAt: [20.1, 15.3, 13.22] },
    { name: 'cordova-dining-balcony', position: [82, 13.5, -7], lookAt: [29.8, 12.7, 7.5] },
    { name: 'guest-wings-and-court', position: [-72, 41, -75], lookAt: [-4.2, 10.2, -3.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'casa-monica-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.06,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
