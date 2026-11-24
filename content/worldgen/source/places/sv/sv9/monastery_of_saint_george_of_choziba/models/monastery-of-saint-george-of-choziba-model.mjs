import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const controls = read('native-map/monastery-of-saint-george-of-choziba-shape-controls');
const terrain = read('terrain-grid');
const [bridgeStart, bridgeEnd] = controls.bridge;
const bridgeAxis = [bridgeEnd[0] - bridgeStart[0], bridgeEnd[1] - bridgeStart[1]];
const bridgeFace = facade(bridgeStart, bridgeAxis);
const channelUs = [-0.4, 1.4, 3.76, 5.9, 7.3, 8.77, 10.65, 12.2];
const channelOffsets = [-4.35, -2.0, 2.0, 4.35];
const channelShape = outwardRing(
  [
    [channelUs[0], channelOffsets[0]],
    [channelUs.at(-1), channelOffsets[0]],
    [channelUs.at(-1), channelOffsets.at(-1)],
    [channelUs[0], channelOffsets.at(-1)],
  ].map(([u, offset]) => {
    const [x, , z] = bridgeFace.P(u, 0, offset);
    return [x, z];
  }),
);
const outline = outwardRing(controls.outline);
const c = Object.fromEntries(
  Object.entries({
    lime: 'c8b49a',
    light: 'd1bda2',
    block: 'b99f83',
    warm: 'b29a79',
    shadow: 'a48b71',
    base: '99816a',
    paving: 'bba68a',
    blue: '909da2',
    silver: 'a8aba2',
    roof: '9e7060',
    dark: '51483e',
    wood: '685447',
    iron: '5b5352',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  walls: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95 },
  pale: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
};

function window(out, f, u, y, w, h, level, head = 'flat') {
  opening(out, f, u, y, w, h, {
    head,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: c.dark,
    frame: c.light,
    frameWidth: level >= 2 ? 0.11 : 0,
    frameDepth: 0.15,
    d: 0.078,
    sill: level >= 2,
    mullions: level >= 2 && w > 1.05 ? 1 : 0,
  });
}

function cross(out, x, z, y, h) {
  abox(out, 'metal', [x - 0.038, y, z - 0.038], [x + 0.038, y + h, z + 0.038], c.iron);
  abox(
    out,
    'metal',
    [x - 0.24 * h, y + 0.61 * h, z - 0.038],
    [x + 0.24 * h, y + 0.61 * h + 0.07, z + 0.038],
    c.iron,
  );
}

function archSpan(out, f, u, top, r, depth, level, slot = 'walls') {
  const spring = top - r - 0.34;
  const points = roundArch(r, level >= 2 ? 8 : 4);
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, h0] = points[i],
      [x1, h1] = points[i + 1];
    quad4(
      out,
      slot,
      f.P(u + x0, spring + h0, 0),
      f.P(u + x1, spring + h1, 0),
      f.P(u + x1, top, 0),
      f.P(u + x0, top, 0),
      c.lime,
    );
    quad4(
      out,
      slot,
      f.P(u + x0, spring + h0, -depth),
      f.P(u + x1, spring + h1, -depth),
      f.P(u + x1, spring + h1, 0),
      f.P(u + x0, spring + h0, 0),
      c.shadow,
    );
    quad4(
      out,
      slot,
      f.P(u + x1, spring + h1, -depth),
      f.P(u + x0, spring + h0, -depth),
      f.P(u + x0, top, -depth),
      f.P(u + x1, top, -depth),
      c.lime,
    );
    if (level >= 2) {
      const s = 1 + 0.14 / r;
      quad4(
        out,
        'trim',
        f.P(u + x0, spring + h0, 0.014),
        f.P(u + x1, spring + h1, 0.014),
        f.P(u + x1 * s, spring + h1 * s, 0.046),
        f.P(u + x0 * s, spring + h0 * s, 0.046),
        c.light,
      );
    }
  }
}

function masonryVolume(out, slot, ring, low, high, color, options) {
  extrude(out, slot, ring, low, high, color, { top: false });
  if (options.top === false) return;
  const key = options.topSlot ?? slot;
  const tint = options.topColor ?? color;
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      key,
      'palette:#ffffff',
      outwardRing(ring),
      [],
      () => high,
      [0, 1, 0],
      (p) => p,
      tint,
    )
  )
    throw Error('Choziba masonry cap could not be triangulated');
  const { positions, indices } = cap.finalize();
  const point = (i) => Array.from(positions.slice(3 * i, 3 * i + 3));
  for (let i = 0; i < indices.length; i += 3)
    tri(out, key, point(indices[i]), point(indices[i + 1]), point(indices[i + 2]), tint);
}

function base(out, level) {
  const lower = [
    [-17.8, -8.8],
    [-7.6, -11.6],
    [6.6, -10.2],
    [15.2, -8.8],
    [16.4, -3.9],
    [15.0, 1.2],
    [11.8, 3.25],
    [12.0, 8.1],
    [-12.4, 8.8],
    [-13.3, 4],
    [-17.8, 3.7],
  ];
  masonryVolume(out, 'base', lower, -8.2, 6.24, c.base, { top: false });
  masonryVolume(out, 'walls', outline, 6.15, 10.59, c.block, {
    topSlot: 'base',
    topColor: c.paving,
  });
  masonryVolume(out, 'trim', outline, 10.58, 10.83, c.warm, { top: false });
  const f = facade([0, 9.57], [1, -0.025]);
  fbox(out, 'base', f, -12.53, 11.91, 5.03, 5.28, 0.03, 0.27, c.warm);
  if (level >= 1) {
    for (const [u, y] of [
      [-9.9, 7.32],
      [-5.7, 6.88],
      [0, 7.12],
      [4.7, 6.59],
      [8.8, 6.9],
    ])
      window(out, f, u, y, 0.43, 1.12, level, 'round');
    for (const u of [-8.2, 0.5, 8.2]) {
      const g = facade([u, 8.54], [1, -0.025]);
      const a = g.P(-0.53, -2.55, 1.59),
        b = g.P(0.53, -2.55, 1.59);
      const d = g.P(-0.53, 5.66, 0.35),
        e = g.P(0.53, 5.66, 0.35);
      quad4(out, 'base', a, b, e, d, c.shadow);
      quad4(out, 'base', g.P(-0.53, -2.55, -1.1), a, d, g.P(-0.53, 5.66, -1.1), c.warm);
      quad4(out, 'base', b, g.P(0.53, -2.55, -1.1), g.P(0.53, 5.66, -1.1), e, c.base);
    }
  }
  const front = facade([0.1, 8.71], [1, 0]);
  fbox(out, 'pale', front, -12.55, 11.64, 10.71, 15.28, -3.52, 0.02, c.lime);
  const west = facade([-13.05, 1.2], [0, 1]);
  fbox(out, 'walls', west, -10.55, 6.34, 10.75, 15.48, -5.21, -0.02, c.block);
  masonryVolume(
    out,
    'pale',
    [
      [-16.8, -9.45],
      [-8.22, -11.8],
      [-5.84, -11.48],
      [-6.19, -2.34],
      [-16.21, -1.98],
    ],
    10.96,
    18.1,
    c.light,
    { topSlot: 'base', topColor: c.paving },
  );
  masonryVolume(
    out,
    'walls',
    [
      [-7.65, -11.82],
      [2.47, -11.28],
      [3.3, -7.71],
      [1.9, -5.25],
      [-7.7, -5.57],
    ],
    12.35,
    19.47,
    c.block,
    { topSlot: 'base', topColor: c.paving },
  );
  if (level >= 1) {
    const upper = facade([-11.54, -2.12], [1, 0]);
    for (const u of [-3.0, 0.07, 2.54]) window(out, upper, u, 14.62, 0.74, 1.25, level);
    opening(out, front, -5.17, 10.91, 1.42, 2.44, {
      head: 'round',
      glassSlot: 'timber',
      frameSlot: 'trim',
      glass: c.wood,
      frame: c.light,
      frameWidth: level >= 2 ? 0.16 : 0,
      frameDepth: 0.16,
      d: 0.087,
      sill: false,
    });
    for (const u of [-8.83, -2.65, -0.3, 3.9, 8.4])
      window(out, front, u, 11.8, 0.83, 1.73, level, 'round');
    for (const u of [-5.55, -0.73, 3.17]) window(out, west, u, 11.49, 0.71, 1.52, level, 'round');
  }
  if (level >= 2) {
    for (const u of [-10.5, -6.19, -2.16, 2.26, 6.4, 10.44])
      fbox(out, 'trim', front, u - 0.16, u + 0.16, 10.86, 14.89, -0.065, 0.18, c.light);
    fbox(out, 'trim', front, -12.46, 11.58, 15.05, 15.28, 0.01, 0.16, c.warm);
  }
}

function dome(out, x, z, y, r, h, level) {
  const apothem = r * Math.cos(Math.PI / 8);
  lathe(
    out,
    'walls',
    [x, z],
    [
      [y, r, r],
      [y + 1.54, r, r],
      [y + 1.66, r + 0.09, r + 0.09],
    ],
    8,
    c.light,
    { rotation: Math.PI / 8 },
  );
  lathe(
    out,
    'roof',
    [x, z],
    [
      [y + 1.62, r, r],
      [y + 1.62 + h * 0.41, r * 0.92, r * 0.92],
      [y + 1.62 + h * 0.75, r * 0.68, r * 0.68],
      [y + 1.62 + h * 0.94, r * 0.35, r * 0.35],
      [y + 1.62 + h, r * 0.06, r * 0.06],
    ],
    [8, 12, 16, 24][level],
    c.blue,
    { rotation: Math.PI / 8 },
  );
  if (level >= 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const f = facade(
        [x + apothem * Math.sin(a), z + apothem * Math.cos(a)],
        [Math.cos(a), -Math.sin(a)],
      );
      window(out, f, 0, y + 0.28, Math.min(0.46, r * 0.3), 0.91, level, 'round');
    }
    cross(out, x, z, y + 1.6 + h, 0.73);
  }
}

function chapels(out, level) {
  abox(out, 'pale', [1.74, 11.04, -8.67], [11.37, 18.38, 5.1], c.light);
  gableRoof(out, 'roof', [6.55, 5.11], [6.43, -8.74], 9.84, 18.35, 20.46, c.silver, {
    endSlot: 'pale',
    endColor: c.light,
    overhang: 0.14,
  });
  dome(out, 6.54, -2.5, 19.71, 2.45, 2.06, level);
  abox(out, 'walls', [10.88, 10.9, -7.07], [15.65, 17.0, 1.53], c.lime);
  gableRoof(out, 'roof', [13.31, 1.55], [13.34, -7.1], 5.07, 16.99, 18.2, c.roof, {
    endSlot: 'walls',
    endColor: c.lime,
    overhang: 0.12,
  });
  dome(out, 13.32, -3.62, 17.44, 1.56, 1.39, level);
  const f = facade([-4.32, 3.91], [1, 0]);
  fbox(out, 'walls', f, -6.6, 4.73, 13.86, 14.24, -3.81, 0.5, c.block);
  fbox(out, 'trim', f, -6.68, 4.79, 17.48, 17.86, -3.91, 0.57, c.light);
  if (level === 0) {
    fbox(out, 'pale', f, -6.6, 4.73, 15.9, 17.51, -0.45, 0, c.light);
    for (const u of [-6.43, -2.26, 1.91, 4.35])
      fbox(out, 'pale', f, u - 0.19, u + 0.19, 14.18, 15.92, -0.52, 0, c.light);
  } else {
    for (let i = 0; i < 6; i++) {
      const u = -6.61 + 2.064 * i;
      fbox(out, 'pale', f, u - 0.15, u + 0.15, 14.18, 17.52, -0.62, 0, c.light);
    }
    for (let i = 0; i < 5; i++)
      archSpan(out, f, -5.578 + 2.064 * i, 17.5, 0.88, 0.62, level, 'pale');
    const church = facade([6.57, 5.11], [1, 0]);
    for (const u of [-2.52, 0, 2.41]) window(out, church, u, 14.75, 0.91, 1.74, level, 'round');
    window(out, church, 0, 17.57, 0.78, 0.55, level);
    const east = facade([13.32, 1.55], [1, 0]);
    window(out, east, 0, 12.53, 1.48, 2.75, level, 'round');
    window(out, east, 0, 15.83, 0.64, 0.65, level);
  }
  const tower = [-14.05, -7.78];
  abox(
    out,
    'pale',
    [tower[0] - 1.6, 17.63, tower[1] - 1.6],
    [tower[0] + 1.6, 20.74, tower[1] + 1.6],
    c.light,
  );
  if (level >= 1) {
    window(out, facade([tower[0], tower[1] + 1.61], [1, 0]), 0, 18.34, 1.26, 1.95, level, 'round');
    window(out, facade([tower[0] + 1.61, tower[1]], [0, -1]), 0, 18.34, 1.16, 1.92, level, 'round');
  }
  lathe(
    out,
    'roof',
    tower,
    [
      [20.7, 2.21, 2.21],
      [21.19, 1.14, 1.14],
      [21.91, 0.24, 0.24],
    ],
    4,
    c.silver,
    { rotation: Math.PI / 4 },
  );
  if (level >= 1) cross(out, tower[0], tower[1], 21.9, 0.72);
}

function approach(out, level) {
  const face = facade([12.0, 8.21], [1, -0.264]);
  for (let i = 0; i < 8; i++) {
    const u = i * 2.42;
    const height = 10.7 - i * 0.44;
    fbox(out, 'base', face, u, u + 2.43, -5.1, height, -4.8, 0, c.base);
    fbox(out, 'trim', face, u, u + 2.43, height - 0.17, height + 0.085, -4.83, 0.14, c.paving);
    if (level >= 1)
      fbox(out, 'walls', face, u, u + 2.43, height + 0.09, height + 0.91, -0.26, -0.018, c.block);
  }
  const gate = facade([16.5, 5.28], [1, -0.265]);
  for (const [a, b] of [
    [-1.69, -0.96],
    [0.96, 1.67],
  ])
    fbox(out, 'walls', gate, a, b, 9.48, 13.58, -1.15, 0, c.lime);
  archSpan(out, gate, 0, 13.6, 0.96, 1.15, level);
  fbox(out, 'trim', gate, -1.83, 1.83, 13.51, 13.8, -1.29, 0.14, c.light);
  if (level >= 2) {
    const terrace = facade([0, 9.68], [1, -0.025]);
    for (let i = 0; i < 19; i++) {
      const u = -12.37 + i * 1.27;
      fbox(out, 'metal', terrace, u - 0.025, u + 0.025, 10.78, 11.56, -0.09, 0.005, c.iron);
    }
    fbox(out, 'metal', terrace, -12.37, 10.49, 11.52, 11.59, -0.092, 0.002, c.iron);
  }
}

function sourceHeight(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const s = u - i;
  const t = v - j;
  const rows = terrain.heightsMeters;
  const near = rows[j][i] * (1 - s) + rows[j][i + 1] * s;
  const far = rows[j + 1][i] * (1 - s) + rows[j + 1][i + 1] * s;
  return near * (1 - t) + far * t - terrain.modelDatumElevationMeters;
}

function bridgeChannel(out) {
  const beds = [0, -19.7, -20.16, -19.83, -19.52, -19.25, -16.47, 0];
  const point = (i, j) => {
    const [x, , z] = bridgeFace.P(channelUs[i], 0, channelOffsets[j]);
    const border =
      i === 0 || i === channelUs.length - 1 || j === 0 || j === channelOffsets.length - 1;
    return [x, border ? sourceHeight(x, z) - 0.013 : beds[i], z];
  };
  for (let i = 0; i < channelUs.length - 1; i++)
    for (let j = 0; j < channelOffsets.length - 1; j++)
      quad4(
        out,
        'base',
        point(i, j),
        point(i, j + 1),
        point(i + 1, j + 1),
        point(i + 1, j),
        c.base,
      );
}

function footbridge(out, level) {
  const [a, b] = controls.bridge;
  const d = [b[0] - a[0], b[1] - a[1]];
  const span = Math.hypot(...d);
  const face = facade(a, d);
  const grade = (u) => -13.55 + (2.71 * u) / span;
  const width = 2.35;
  const mainRadius = 2.24;
  const minorRadius = 1.14;
  const slices = [[0, 1.52, -20.6]];
  for (const [center, r, peak] of [
    [1.52 + mainRadius, mainRadius, -15.41],
    [8.77, minorRadius, -14.13],
  ]) {
    const points = roundArch(r, level >= 2 ? 10 : 5);
    const spring = peak - r;
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i],
        q = points[i + 1];
      slices.push([center + p[0], center + q[0], spring + p[1], spring + q[1]]);
    }
  }
  slices.push([1.52 + mainRadius * 2, 8.77 - minorRadius, -20.35]);
  slices.push([8.77 + minorRadius, span, -16.43]);
  for (const [u, v, low, high = low] of slices) {
    const y = grade(u),
      next = grade(v);
    for (const off of [-width / 2, width / 2]) {
      const a = face.P(u, low, off),
        b = face.P(v, high, off);
      const p = face.P(u, y, off),
        q = face.P(v, next, off);
      if (off > 0) quad4(out, 'base', a, b, q, p, c.warm);
      else quad4(out, 'base', b, a, p, q, c.base);
    }
    quad4(
      out,
      'base',
      face.P(u, low, -width / 2),
      face.P(v, high, -width / 2),
      face.P(v, high, width / 2),
      face.P(u, low, width / 2),
      c.base,
    );
    quad4(
      out,
      'trim',
      face.P(u, y, width / 2),
      face.P(v, next, width / 2),
      face.P(v, next, -width / 2),
      face.P(u, y, -width / 2),
      c.paving,
    );
  }
  for (const [u, y] of [
    [0, -20.6],
    [span, -16.43],
  ]) {
    const cap = [
      face.P(u, y, -width / 2),
      face.P(u, y, width / 2),
      face.P(u, grade(u), width / 2),
      face.P(u, grade(u), -width / 2),
    ];
    if (u !== 0) cap.reverse();
    quad4(out, 'base', ...cap, c.base);
  }
  for (const side of [-1, 1]) {
    const inner = (width / 2 - 0.19) * side,
      outer = (width / 2 + 0.045) * side;
    const v4 = (at, end, lo, hi) => [
      face.P(0, grade(0) + lo, at),
      face.P(span, grade(span) + lo, at),
      face.P(span, grade(span) + hi, end),
      face.P(0, grade(0) + hi, end),
    ];
    const outside = v4(outer, outer, -0.04, 0.83),
      inside = v4(inner, inner, -0.04, 0.83);
    const top = v4(outer, inner, 0.83, 0.83);
    if (side > 0) inside.reverse();
    else {
      outside.reverse();
      top.reverse();
    }
    quad4(out, 'walls', ...outside, c.lime);
    quad4(out, 'walls', ...inside, c.block);
    quad4(out, 'trim', ...top, c.light);
  }
  if (level >= 1)
    for (let i = 0; i < 7; i++) {
      const u = -0.46 * i;
      fbox(out, 'base', face, u - 0.49, u, -17.8, grade(0) - i * 0.37, -1.13, 1.13, c.block);
    }
}

function build(out, level) {
  base(out, level);
  chapels(out, level);
  approach(out, level);
  bridgeChannel(out);
  footbridge(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'monastery-of-saint-george-of-choziba-model.mjs';
const camera = [23, 38, 83];
const lookAt = [-15, 6, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-monastery',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Saint George’s three-level limestone monastery, domed chapels, cliff ledge and stone footbridge in Wadi Qelt.',
  camera,
  lookAt,
  sunDirection: [36, 61, 66],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis:
      'The measured 1883 ground outline defines the historic monastery core on the cliff ledge.',
  },
  groundCutout: {
    outline: channelShape,
    minHeight: -24,
    basis:
      'A narrow opening at the mapped footbridge exposes its stone arches above the Wadi Qelt channel. The sloped channel mesh meets the original terrain at all four edges.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'ravine-terraces-and-stone-facade', position: [1, 24, 61], lookAt: [1, 8, 1] },
    { name: 'chapel-domes-and-cliff-path', position: [46, 29, 28], lookAt: [7, 14, 1] },
    { name: 'stone-footbridge-and-wadi', position: [-39, -7, 47], lookAt: [-62, -14, 20] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'wadi-qelt-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.128, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.053, surfaces },
    },
  },
};
