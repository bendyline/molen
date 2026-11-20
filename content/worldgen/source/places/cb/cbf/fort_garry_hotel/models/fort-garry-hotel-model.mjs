import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  panel,
  pairs,
  plane,
  rect,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const terrain = floorSampler(read('terrain-grid.json'));
const color = palette({
  limestone: 'c6bba2',
  light: 'd5c8ad',
  shade: 'b1a58d',
  granite: '92938c',
  trim: 'd7cab1',
  copper: '648374',
  darkCopper: '526b61',
  brightCopper: '748a77',
  glass: '5f6762',
  lit: '77827b',
  bronze: '87795e',
  roof: '767b73',
  warm: '8a7860',
});
const neutral = (slot, localRef, roughness, metallic = 0) => ({
  slot,
  localRef: 'palette:' + localRef,
  roughness,
  metallic,
});
const surfaces = {
  stone: surface('wall', 'stone_ashlar', 0.94),
  granite: surface('foundation', 'stone_granite', 0.94),
  trim: neutral('trim', '#fff4e6', 0.85),
  glass: neutral('window', '#edf1ed', 0.51, 0.05),
  copper: neutral('roof', '#e1eee8', 0.81, 0.24),
  metal: surface('trim', 'metal_painted', 0.73, 0.18),
};
const up = [0, 1, 0];
const point = (i) => d.outline[i];
const native = (id) => d.controls[id];
const indices = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const detailedTower = [
  ...indices(0, 16),
  ...indices(19, 36),
  ...indices(41, 42),
  ...indices(57, 67),
  73,
].map(point);
const towerSimple = [0, 5, 14, 20, 30, 35, 42, 57, 61, 62, 66, 73].map(point);
const orielWays = [1416392898, 1416392899, 1416392900, 1416392901];
const bodyBand = (out, w, low, high, tint, depth = 0.14) =>
  panel(out, 'trim', w, 0, w.length, low, high, depth, tint);
const pointCentre = (pts) => [0, 1].map((k) => pts.reduce((v, p) => v + p[k] / pts.length, 0));

function facade(out, outline, level) {
  const contact = (p) => Math.min(terrain(p) - 0.48, -0.21);
  shell(out, outline, contact, 1.24, { wall: 'granite', roof: 'granite', color: color.granite });
  shell(out, outline, () => 1.24, d.roofEave, {
    wall: 'stone',
    roof: 'copper',
    color: color.limestone,
    roofColor: color.roof,
  });
  const order = areaSign(outline);
  for (const [[a, b], i] of pairs(closed(outline)).map((q, i) => [q, i])) {
    const w = edge(a, b, order);
    if (w.length < 0.9) continue;
    bodyBand(out, w, 10.3, 10.7, color.trim, 0.12);
    bodyBand(out, w, d.upperHeight - 0.04, d.upperHeight + 0.51, color.light, 0.17);
    if (level === 0 || w.length < 2.4) continue;
    bodyBand(out, w, d.middleHeight - 0.14, d.middleHeight + 0.31, color.trim, 0.12);
    bodyBand(out, w, 44.68, 45.19, color.trim, 0.17);
    bodyBand(out, w, d.roofEave - 0.24, d.roofEave + 0.04, color.light, 0.14);
    const north = a[1] < -35.8 && b[1] < -35.8;
    const pitch = level === 1 ? 6.35 : north ? 3.2 : 3.23;
    const count = Math.max(1, Math.round(w.length / pitch));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * w.length) / count;
      const x = w.p(u, 0)[0];
      const width = Math.min(0.72, (w.length / count) * 0.23);
      if (!(north && x > -3.0 && x < 7.5))
        arch(
          out,
          w,
          u,
          1.67,
          6.57,
          width * 1.45,
          1.29,
          0.045,
          Math.max(0, level - 2),
          { inner: color.glass, trim: color.light, width: 0.19 },
          { inner: 'glass', trim: 'trim' },
        );
      for (let r = 0; r < 6; r++) {
        const base = d.baseHeight + 1.09 + r * 3.52;
        opening(
          out,
          w,
          u - width,
          u + width,
          base,
          base + 1.72,
          'trim',
          (r * 7 + j + i) % 5 ? color.glass : color.lit,
          'glass',
          color.trim,
          level - 1,
          0.04,
        );
      }
      arch(
        out,
        w,
        u,
        33.32,
        38.72,
        width * 1.03,
        0.91,
        0.053,
        Math.max(0, level - 2),
        { inner: color.glass, trim: color.trim, width: 0.162 },
        { inner: 'glass', trim: 'trim' },
      );
      if (level >= 2) {
        panel(out, 'trim', w, u - width - 0.12, u + width + 0.12, 35.94, 36.13, 0.105, color.trim);
        opening(
          out,
          w,
          u - width * 0.72,
          u + width * 0.72,
          43.33,
          44.51,
          'trim',
          color.glass,
          'glass',
          color.light,
          level - 2,
          0.057,
        );
      }
    }
    if (level >= 2 && w.length > 5.0)
      for (const y of [1.36, 2.17, 3.03, 4.06, 5.32, 6.58, 7.82, 9.08])
        bodyBand(out, w, y, y + 0.035, color.shade, 0.019);
  }
}

function oriels(out, level) {
  for (const id of orielWays) {
    const outline = native(id);
    const [x, z] = pointCentre(outline);
    shell(out, outline, () => 16.0, 37.08, {
      wall: 'stone',
      roof: 'trim',
      color: color.light,
      roofColor: color.light,
    });
    if (level === 0) continue;
    const w = plane(z - 0.51, -1);
    for (const y of [16.07, 19.7, 23.23, 26.76, 30.29, 33.9]) {
      panel(out, 'trim', w, x - 1.75, x + 1.75, y - 0.075, y + 0.13, 0.075, color.trim);
      for (const dx of level === 1 ? [0] : [-0.87, 0.0, 0.87]) {
        opening(
          out,
          w,
          x + dx - 0.32,
          x + dx + 0.32,
          y + 0.66,
          y + 2.51,
          'trim',
          color.glass,
          'glass',
          color.light,
          level - 1,
          0.066,
        );
      }
    }
  }
}

function hipped(out, { cx, cz, width, depth, eave, peak, alongX = true }, level) {
  const w = width / 2,
    v = depth / 2;
  const e = [
    [-w, -v],
    [w, -v],
    [w, v],
    [-w, v],
  ].map(([x, z]) => [x + cx, eave, z + cz]);
  const hx = alongX ? w * 0.72 : w * 0.1,
    hz = alongX ? v * 0.11 : v * 0.72;
  const high = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([x, z]) => [x + cx, peak, z + cz]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'copper',
      [e[i], e[j], high[j], high[i]],
      up,
      i % 2 ? color.copper : color.darkCopper,
    );
    if (level === 0) continue;
    beam(out, 'trim', e[i], e[j], 0.16, 0.22, color.trim);
    if (level >= 2) {
      const n = Math.ceil(
        Math.hypot(e[j][0] - e[i][0], e[j][2] - e[i][2]) / (level === 2 ? 2.5 : 1.35),
      );
      for (let k = 1; k < n; k++) {
        const t = k / n,
          a = e[i].map((v, l) => mix(v, e[j][l], t)),
          b = high[i].map((v, l) => mix(v, high[j][l], t));
        beam(
          out,
          'copper',
          [a[0], a[1] + 0.064, a[2]],
          [b[0], b[1] + 0.064, b[2]],
          0.038,
          0.067,
          color.brightCopper,
        );
      }
    }
  }
  face(out, 'copper', high, up, color.copper);
  if (level >= 1)
    for (const [a, b] of pairs(closed(high)))
      beam(out, 'copper', a, b, 0.13, 0.16, color.darkCopper);
}
function pointedDormer(out, x, z, y, width, height, depth, level, ornate = false) {
  const left = x - width / 2,
    right = x + width / 2,
    high = y + height,
    shoulder = high - height * 0.36;
  const a = [left, y, z],
    b = [right, y, z],
    c = [right, shoulder, z],
    e = [left, shoulder, z],
    p = [x, high, z];
  const rear = [x, high - 0.6, z + depth];
  const n = [0, 0, -1];
  face(out, 'stone', [a, b, c, p, e], n, ornate ? color.light : color.shade);
  face(out, 'copper', [e, p, rear, [left, shoulder - 0.2, z + depth]], up, color.copper);
  face(out, 'copper', [p, c, [right, shoulder - 0.2, z + depth], rear], up, color.darkCopper);
  if (level === 0) return;
  const w = plane(z, -1);
  const w2 = width * 0.19;
  arch(
    out,
    w,
    x,
    y + 0.21,
    y + height * 0.47,
    w2,
    height * 0.14,
    0.035,
    Math.max(0, level - 2),
    { inner: color.glass, trim: color.trim, width: 0.11 },
    { inner: 'glass', trim: 'trim' },
  );
  if (ornate) {
    for (const [left, right] of [
      [e, p],
      [p, c],
    ])
      beam(out, 'trim', left, right, 0.17, 0.21, color.trim);
    for (const xx of [x - width * 0.42, x + width * 0.42]) {
      block(out, 'stone', xx - 0.13, shoulder - 0.38, z - 0.09, 0.26, 1.64, 0.25, color.light);
      beam(
        out,
        'metal',
        [xx, shoulder + 1.2, z],
        [xx, shoulder + 1.77, z],
        0.07,
        0.08,
        color.bronze,
      );
    }
  }
}
function roofs(out, level) {
  const wings = [
    { ridge: 54.8, x: -19.5, z: -30.15, w: 15.65, v: 13.2 },
    { ridge: 57.6, x: 23.0, z: -30.05, w: 15.65, v: 13.4 },
    { ridge: 53.2, x: 2.55, z: -29.55, w: 42.05, v: 15.1 },
    { ridge: 54.0, x: -19.55, z: -19.05, w: 15.54, v: 21.5, alongX: false },
    { ridge: 53.0, x: 23.05, z: -19.19, w: 15.36, v: 22.1, alongX: false },
    { ridge: 56.0, x: 1.9, z: -19.8, w: 15.35, v: 21.5, alongX: false },
    { ridge: 56.5, x: -19.94, z: -8.93, w: 15.46, v: 11.5 },
    { ridge: 56.3, x: 1.77, z: -9.11, w: 15.61, v: 12.0 },
    { ridge: 56.8, x: 23.31, z: -8.85, w: 15.65, v: 11.76 },
  ];
  for (const wing of wings)
    hipped(
      out,
      {
        cx: wing.x,
        cz: wing.z,
        width: wing.w,
        depth: wing.v,
        eave: d.roofEave,
        peak: wing.ridge,
        alongX: wing.alongX,
      },
      level,
    );
  for (const x of [-25.1, -13.0, 16.4, 28.7])
    pointedDormer(out, x, -36.48, 45.8, 2.48, 4.67, 3.6, level, true);
  if (level >= 1) {
    for (const x of [-9.9, -6.8, -3.7, -0.59, 2.5, 5.6, 8.7, 11.8, 14.85])
      pointedDormer(out, x, -34.99, 47.0, 1.46, 2.18, 2.93, level);
    if (level >= 2)
      for (const x of [-8.7, -4.9, -1.1, 2.7, 6.5, 10.3, 14.1])
        pointedDormer(out, x, -33.32, 50.21, 1.14, 1.68, 1.77, level);
    for (const x of [-19.95, 1.78, 23.28])
      pointedDormer(out, x, -5.56, 46.92, 2.62, 3.46, 2.73, level, true);
  }
  // Original first-return samples bound the principal thick shaft near the west courtyard.
  block(out, 'stone', -13.1, 44.1, -24.47, 2.92, d.chimneyTop - 44.1, 3.18, color.shade);
  block(out, 'trim', -13.36, d.chimneyTop - 0.48, -24.71, 3.45, 0.48, 3.7, color.trim);
  if (level >= 2) {
    for (const x of [-13.05, -12.39, -11.73, -11.04, -10.34])
      block(out, 'stone', x, d.chimneyTop - 1.39, -24.63, 0.17, 0.91, 0.17, color.light);
  }
}

function canopy(out, level) {
  const poly = native(157041983);
  const curb = 0.91;
  shell(out, native(1396364064), (p) => Math.min(terrain(p) - 0.3, 0), curb, {
    wall: 'granite',
    roof: 'granite',
    color: color.granite,
  });
  stairs(
    out,
    terrain,
    'granite',
    -1.61,
    6.14,
    -44.35,
    -41.75,
    curb,
    level >= 2 ? 6 : 4,
    color.granite,
  );
  shell(out, poly, () => 6.52, 7.55, {
    wall: 'copper',
    roof: 'copper',
    color: color.copper,
    roofColor: color.darkCopper,
  });
  for (const id of [1396364062, 1396364063]) {
    const center = pointCentre(native(id));
    const sides = [6, 9, 14, 20][level];
    const profile = [
      [0.74, 0.42],
      [1.05, 0.48],
      [1.22, 0.37],
      [5.94, 0.36],
      [6.19, 0.51],
      [6.58, 0.51],
    ];
    const rings = profile.map(([y, r]) => radialRing(y, r, r, sides, center));
    loft(out, 'stone', rings, color.light, { cap: false });
  }
  for (const [a, b] of pairs(closed(poly))) {
    const w = edge(a, b, areaSign(poly));
    if (w.length < 0.2) continue;
    bodyBand(out, w, 6.49, 6.66, color.trim, 0.09);
    bodyBand(out, w, 7.49, 7.59, color.brightCopper, 0.1);
  }
  if (level >= 1) {
    const w = plane(-36.076, -1);
    for (const x of [-1.0, 2.3, 5.65])
      arch(
        out,
        w,
        x,
        curb,
        4.66,
        0.91,
        0.75,
        0.05,
        level - 1,
        { inner: color.glass, trim: color.light, width: 0.23 },
        { inner: 'glass', trim: 'trim' },
      );
    for (const x of [-1.79, 6.29]) {
      beam(out, 'metal', [x, 0.76, -44.15], [x, 1.93, -40.68], 0.085, 0.089, color.bronze);
      if (level >= 2)
        for (const [z, y] of [
          [-44, 0.53],
          [-42.8, 0.83],
          [-41.0, 1.0],
        ])
          beam(out, 'metal', [x, y, z], [x, y + 0.91, z], 0.076, 0.078, color.bronze);
    }
  }
}

function smallerWings(out, level) {
  const rooms = [
    { shape: native(306738965), height: 14.96 },
    { shape: native(1387340155), height: 7.35 },
    { shape: native(1387340156), height: 5.79 },
    { shape: native(1389443361), height: 10.7 },
    { shape: native(1416392897), height: 8.71 },
  ];
  for (const { shape, height } of rooms) {
    shell(out, shape, (p) => Math.min(terrain(p) - 0.51, -0.15), height, {
      wall: 'stone',
      roof: 'copper',
      color: color.limestone,
      roofColor: color.roof,
    });
    if (level === 0) continue;
    for (const [a, b] of pairs(closed(shape))) {
      const w = edge(a, b, areaSign(shape));
      if (w.length < 1.43) continue;
      bodyBand(out, w, height - 0.47, height - 0.04, color.trim);
      const num = Math.max(1, Math.floor(w.length / 3.14));
      for (let j = 0; j < num; j++) {
        const u = (w.length * (j + 0.5)) / num,
          wid = Math.min(0.71, (w.length / num) * 0.31);
        opening(
          out,
          w,
          u - wid,
          u + wid,
          1.46,
          height > 10 ? 5.36 : 4.75,
          'trim',
          color.glass,
          'glass',
          color.trim,
          level - 1,
          0.05,
        );
      }
    }
  }
  hipped(out, { cx: 8.94, cz: 9.56, width: 8.04, depth: 8.02, eave: 5.76, peak: 7.78 }, level);
}

function build(out, level) {
  facade(out, level < 2 ? towerSimple : detailedTower, level);
  oriels(out, level);
  roofs(out, level);
  canopy(out, level);
  smallerWings(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'fort-garry-hotel-model.mjs';
const camera = [96, 79, -137],
  lookAt = [2, 27, -12];
export const fortGarryHotelAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'hotel-commercial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original NRCan bare earth at the Broadway entrance and along the surveyed hotel footprint.',
  brief:
    'Winnipeg’s Fort Garry Hotel with its buff stone arcades, four Broadway oriels, copper Château roofs and attached dining and reception volumes.',
  camera,
  lookAt,
  sunDirection: [-71, 125, -141],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.annex, d.pavilion],
    minimumCoverage: 0.92,
    basis: 'Native named Hotel Fort Garry envelope and associated low rear attached buildings.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_granite', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'broadway-stair-and-copper-porte-cochere',
      position: [18, 9, -62],
      lookAt: [2.5, 15, -32],
    },
    { name: 'upper-arcades-dormers-and-chimney', position: [-60, 67, -73], lookAt: [4, 47, -24] },
    { name: 'rear-rotunda-and-roof-wings', position: [61, 54, 66], lookAt: [2.4, 22, -10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-garry-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries({ district: 0.56, street: 0.19, closeup: 0.061 }).map(
        ([name, errorMeters]) => [name, { export: name, errorMeters, surfaces }],
      ),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. OpenStreetMap ODbL 1.0 and Natural Resources Canada elevation.',
};
