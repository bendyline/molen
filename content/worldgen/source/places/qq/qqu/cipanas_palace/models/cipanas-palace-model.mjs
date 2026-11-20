import controls from '../plan-controls.json' with { type: 'json' };
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const surfaces = {
  walls: surface('wall', 'plaster_lime'),
  tile: surface('roof', 'tile_ceramic', 0.9),
  stone: surface('foundation', 'stone_ashlar'),
  timber: surface('trim', 'wood_plain'),
  glass: surface('window', 'window_punched', 0.65),
  iron: surface('trim', 'metal_painted', 0.79, 0.1),
};
const C = palette({
  cream: 'e8e0cf',
  bright: 'eee6d2',
  wood: 'c8c2ae',
  gray: 'a39c8e',
  tile: '805347',
  ridge: '68423a',
  shade: '77483c',
  base: 'c4b7a6',
  pane: '758a8c',
  sideGlass: '899c98',
  shadow: '565950',
  green: '56635c',
});
const floor = 2.05;
const eave = 6.7;
const porchEave = 6.45;
const front = -25.56;

function hip(out, lod, bounds, y, rise, alongX, color) {
  const [l, f, r, b] = bounds;
  const [p, q, s, t] = [
    [l, y, f],
    [r, y, f],
    [r, y, b],
    [l, y, b],
  ];
  const mx = (l + r) / 2,
    mz = (f + b) / 2;
  const length = alongX ? r - l : b - f;
  const width = alongX ? b - f : r - l;
  const h = Math.min(width * 0.44, length * 0.43);
  const top = y + rise;
  const a = alongX ? [l + h, top, mz] : [mx, top, f + h];
  const d = alongX ? [r - h, top, mz] : [mx, top, b - h];
  const faces = alongX
    ? [
        [p, q, d, a],
        [q, s, d],
        [s, t, a, d],
        [t, p, a],
      ]
    : [
        [p, q, a],
        [q, s, d, a],
        [s, t, d],
        [t, p, a, d],
      ];
  for (const [i, slope] of faces.entries()) face(out, 'tile', slope, up, i === 2 ? C.shade : color);
  if (lod === 0) return;
  beam(out, 'tile', a, d, 0.22, 0.23, C.ridge);
  for (const [[x, , z], [u, , v]] of pairs([p, q, s, t, p]))
    beam(out, 'timber', [x, y - 0.12, z], [u, y - 0.12, v], 0.19, 0.19, C.wood);
  if (lod >= 2) {
    const apex = alongX ? [a, d, d, a] : [a, a, d, d];
    for (const [index, corner] of [p, q, s, t].entries())
      beam(out, 'tile', corner, apex[index], 0.12, 0.12, C.ridge);
  }
}

function rooflines(out, lod) {
  hip(out, lod, [-11.65, -14.3, 12.16, 15.5], eave + 0.08, 5.9, false, C.tile);
  hip(out, lod, [-18.71, -9.24, -5.8, 7.55], eave, 3.1, false, C.tile);
  hip(out, lod, [6.1, -8.44, 18.35, 7.35], eave, 3.1, false, C.tile);
  hip(out, lod, [-11.67, 10.1, 12.14, 28.84], eave, 4.55, true, C.tile);
  hip(out, lod, [-10.18, front - 0.46, 10.08, -7.14], porchEave, 4.1, true, C.tile);
}

function glazedBay(out, w, l, r, low, high, lod, depth, color) {
  opening(out, w, l, r, low, high, 'timber', color, 'glass', C.bright, lod, depth);
  if (lod < 2) return;
  for (const y of [low + (high - low) * 0.29, low + (high - low) * 0.71])
    panel(out, 'timber', w, l, r, y - 0.027, y + 0.027, depth + 0.047, C.wood);
  if (lod === 3)
    for (const i of [0.24, 0.76]) {
      const u = l + (r - l) * i;
      panel(out, 'iron', w, u - 0.016, u + 0.016, low, high, depth + 0.039, C.green);
    }
}

function mainWalls(out, lod, polygon, grade) {
  shell(out, polygon, (p) => Math.min(grade(p) - 0.35, floor - 0.12), floor, {
    wall: 'stone',
    color: C.base,
    roofColor: C.gray,
  });
  shell(
    out,
    polygon,
    () => floor,
    eave,
    {
      wall: 'walls',
      color: C.cream,
      roofColor: C.cream,
    },
    (i) => ![4, 5, 6, 11].includes(i),
  );
  const sign = areaSign(polygon);
  for (const [i, [a, b]] of pairs(closed(polygon)).entries()) {
    if ([4, 5, 6, 11].includes(i)) continue;
    const w = edge(a, b, sign);
    trimBlock(out, 'walls', w, 0, w.length, eave - 0.33, eave - 0.1, -0.01, 0.12, C.bright);
    if (lod === 0) continue;
    trimBlock(out, 'walls', w, 0, w.length, 2.04, 2.19, -0.01, 0.09, C.bright);
    for (const u of [0.22, w.length - 0.22])
      trimBlock(out, 'walls', w, u - 0.18, u + 0.18, floor, eave - 0.24, -0.01, 0.18, C.bright);
    const n = Math.floor(w.length / 3.75);
    for (let k = 0; k < n; k++) {
      const u = (w.length * (k + 0.5)) / n;
      const bottom = Math.max(3.02, grade([w.p(u, 0)[0], w.p(u, 0)[2]]) + 0.4);
      glazedBay(out, w, u - 0.77, u + 0.77, bottom, 5.94, lod, 0.035, C.pane);
      if (lod >= 2)
        trimBlock(
          out,
          'walls',
          w,
          u - 0.94,
          u + 0.94,
          bottom - 0.16,
          bottom - 0.04,
          0.016,
          0.22,
          C.bright,
        );
    }
  }
}

function verandaPost(out, x, z, y, h, lod) {
  block(out, 'stone', x - 0.28, y, z - 0.27, 0.56, 0.24, 0.54, C.cream);
  ring(
    out,
    'timber',
    [x, z],
    [
      [y + 0.24, 0.22],
      [h - 0.37, 0.176],
      [h - 0.19, 0.25],
    ],
    [5, 6, 10, 14][lod],
    C.bright,
  );
  block(out, 'walls', x - 0.265, h - 0.23, z - 0.265, 0.53, 0.26, 0.53, C.bright);
}

function porchRail(out, ax, az, bx, bz, y, lod) {
  const a = [ax, y + 0.84, az],
    b = [bx, y + 0.84, bz];
  beam(out, 'timber', a, b, 0.13, 0.18, C.bright);
  if (lod === 0) return;
  const count = Math.ceil(Math.hypot(bx - ax, bz - az) / [1, 1.2, 0.48, 0.31][lod]);
  for (let i = 0; i <= count; i++) {
    const x = ax + ((bx - ax) * i) / count,
      z = az + ((bz - az) * i) / count;
    const w = i === 0 || i === count ? 0.24 : 0.096;
    block(out, 'timber', x - w / 2, y, z - w / 2, w, 0.84, w, C.bright);
  }
}

function frontVeranda(out, lod, grade, documentedSteps) {
  const frame = plane(front, -1);
  const back = plane(-18.36, -1);
  panel(out, 'walls', back, -9.64, 9.54, floor, porchEave, 0, C.cream);
  panel(out, 'walls', frame, -9.68, 9.57, porchEave - 0.68, porchEave, 0.01, C.cream);
  trimBlock(
    out,
    'timber',
    frame,
    -9.83,
    9.74,
    porchEave - 0.37,
    porchEave - 0.17,
    -0.08,
    0.18,
    C.bright,
  );
  const posts = lod === 0 ? [-8.94, -3.02, 3.02, 8.94] : [-8.94, -5.98, -3.02, 3.02, 5.98, 8.94];
  for (const x of posts) verandaPost(out, x, front + 0.48, floor, porchEave - 0.55, lod);
  for (const [left, right] of [
    [-9.36, -2.94],
    [2.94, 9.3],
  ])
    porchRail(out, left, front + 0.18, right, front + 0.18, floor, lod);
  const steps = [3, 6, documentedSteps, documentedSteps][lod];
  stairs(out, grade, 'stone', -2.99, 2.99, front - 4.18, front + 0.18, floor, steps, C.base);
  if (lod > 0) {
    for (const x of [-3.15, 3.15]) {
      const z = front - 4.1,
        foot = grade([x, z]);
      beam(out, 'stone', [x, foot + 0.24, z], [x, floor + 0.22, front + 0.04], 0.26, 0.31, C.cream);
      block(out, 'stone', x - 0.16, foot - 0.1, z - 0.17, 0.32, 0.52, 0.34, C.bright);
    }
  }
  for (const side of [-1, 1]) {
    const wall =
      side < 0 ? edge([-9.63, front], [-9.63, -8.75], -1) : edge([9.52, front], [9.52, -7.91]);
    panel(out, 'walls', wall, 0, wall.length, floor, porchEave, 0.003, C.cream);
    if (lod === 0) {
      panel(out, 'glass', wall, 0.4, 7.01, 3.01, 5.57, 0.028, C.sideGlass);
      continue;
    }
    for (let j = 0; j < 4; j++) {
      const u = 1.53 + 1.46 * j;
      glazedBay(
        out,
        wall,
        u - 0.68,
        u + 0.68,
        3.02,
        5.62,
        lod,
        0.027,
        j % 2 ? C.pane : C.sideGlass,
      );
    }
  }
  opening(
    out,
    back,
    -1.19,
    1.19,
    floor + 0.08,
    5.91,
    'timber',
    C.shadow,
    'timber',
    C.bright,
    lod,
    0.033,
  );
  for (const x of [-6.66, -3.8, 3.8, 6.66])
    glazedBay(out, back, x - 0.83, x + 0.83, 3.02, 5.87, lod, 0.034, C.pane);
}

function rearVeranda(out, lod, grade) {
  const deck = 3.26,
    z = 28.21;
  shell(out, rect(-11.02, 22.0, 11.52, z), (p) => Math.min(grade(p) - 0.26, deck - 0.23), deck, {
    wall: 'stone',
    color: C.base,
    roof: 'stone',
    roofColor: C.gray,
  });
  const wall = plane(22.03, 1);
  panel(out, 'walls', wall, -11.01, 11.5, 2.05, eave, 0.015, C.cream);
  panel(out, 'walls', plane(z, 1), -11.01, 11.5, eave - 0.47, eave, 0.006, C.cream);
  for (const x of [-10.33, -6.74, -3.17, 0.39, 3.95, 7.52, 11.08]) {
    verandaPost(out, x, z - 0.29, deck, eave - 0.27, lod);
    glazedBay(
      out,
      wall,
      x - 0.82,
      x + 0.82,
      deck + 0.14,
      6.02,
      Math.max(0, lod - 1),
      0.049,
      C.pane,
    );
  }
  for (const [a, b] of [
    [-10.52, -1.48],
    [1.57, 11.07],
  ])
    porchRail(out, a, z, b, z, deck, lod);
  stairs(out, grade, 'stone', -1.42, 1.52, 29.78, z - 0.06, deck, lod > 1 ? 4 : 2, C.base);
}

function build(out, lod, d, grade) {
  mainWalls(out, lod, d.outline, grade);
  frontVeranda(out, lod, grade, d.frontStairRisers);
  rearVeranda(out, lod, grade);
  rooflines(out, lod);
}

const bundle = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Single-storey tropical colonial villa at Cipanas, with the raised teak and glazed east veranda, broad eleven-step stair, clay hipped roofs, and a long shallow veranda facing the mountain slope.',
    camera: [-50, 20, -62],
    lookAt: [0, 4.4, -2.2],
    sun: [-230, 380, -420],
    yaw: 0.58,
    views: [
      { name: 'glazed-front-veranda', position: [-21, 6.0, -51], lookAt: [0, 4.4, -21] },
      { name: 'east-stair-and-hip', position: [31, 14, -50], lookAt: [0, 5, -15.2] },
      { name: 'mountain-side-veranda', position: [40, 16, 62], lookAt: [0, 4.3, 15.5] },
    ],
  },
  build,
);
export const { model, skyline, district, street, closeup } = bundle;
model.category = 'landmark';
model.buildingCutout = {
  outline: controls.dimensions.outline,
  minimumCoverage: 0.91,
  basis:
    'Replace only the generic envelope overlapping the mapped historic Gedung Induk main palace.',
};
