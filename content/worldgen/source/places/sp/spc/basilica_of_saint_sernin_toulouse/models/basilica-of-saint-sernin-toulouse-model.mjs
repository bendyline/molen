import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { cap } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  roundArch,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const frame = read('map-frame.json');
const plan = read('plan-controls.json');
const outline = frame.geometry.outline;
const parts = new Map(
  read('native-map/saint-sernin-surveyed-parts.json').parts.map((o) => [o.way.id, o.localOutline]),
);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.89 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  spire: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.79 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.77, metallic: 0.16 },
};

const brick = rgb('b78a72');
const paleBrick = rgb('c09477');
const weatheredBrick = rgb('a36e56');
const towerBrick = rgb('b68a6b');
const stone = rgb('c0ad8c');
const paleStone = rgb('d2c1a1');
const baseColor = rgb('a79f8b');
const glass = rgb('434d4b');
const recess = rgb('464744');
const roof = rgb('955643');
const lighterRoof = rgb('a2604c');
const metal = rgb('726952');
const outlineRect = (a, b, c, d) => [
  [a, c],
  [a, d],
  [b, d],
  [b, c],
];

function sampledOutline(id, gap) {
  const original = parts.get(id);
  const selected = [original[0]];
  for (const point of original.slice(1)) {
    const [x, z] = selected.at(-1);
    if (Math.hypot(point[0] - x, point[1] - z) > gap) selected.push(point);
  }
  const [x, z] = selected.at(-1);
  if (selected.length > 3 && Math.hypot(selected[0][0] - x, selected[0][1] - z) < gap / 2)
    selected.pop();
  return selected;
}
function walls(out, slot, ring, bottom, top, color, covered = true) {
  extrude(out, slot, ring, bottom, top, color, { top: false });
  if (!covered) cap(out, slot, ring, top, color);
}
function faces(ring) {
  const points = outwardRing(ring);
  return points.map((a, i) => wallFace(a, points[(i + 1) % points.length]));
}
function panel(out, slot, f, l, r, b, t, d, color) {
  if (r - l < 0.001 || t - b < 0.001) return;
  quad4(out, slot, f.P(l, b, d), f.P(r, b, d), f.P(r, t, d), f.P(l, t, d), color);
}
function course(out, f, y, h, bump, lod, slot = 'stone', tint = stone) {
  if (lod < 2) panel(out, slot, f, 0, f.length, y, y + h, bump, tint);
  else fbox(out, slot, f, 0, f.length, y, y + h, -0.042, bump, tint);
}
function band(out, ring, y, h, bump, lod, slot = 'stone', tint = stone) {
  for (const f of faces(ring)) course(out, f, y, h, bump, lod, slot, tint);
}
function arch(
  out,
  f,
  u,
  b,
  w,
  h,
  lod,
  { d = 0.045, pointed = false, tint = glass, trim = true, grid = false } = {},
) {
  const radius = w / 2;
  if (lod === 0 && d < 0.13) {
    panel(out, 'glass', f, u - radius, u + radius, b, b + h - radius * 0.3, d, tint);
    return;
  }
  const rise = pointed ? radius * 1.44 : radius;
  const spring = b + h - rise;
  const n = [2, 3, 5, 7][lod];
  const path = pointed ? pointedArch(radius, rise, n) : roundArch(radius, n * 2);
  const border = Math.min(0.26, w * 0.2);
  const around = pointed
    ? pointedArch(radius + border, rise + border, n)
    : roundArch(radius + border, n * 2);
  const p = (x, y, depth) => f.P(u + x, spring + y, depth);
  fan(
    out,
    'glass',
    [
      f.P(u - radius, b, d),
      f.P(u + radius, b, d),
      ...path
        .slice()
        .reverse()
        .map(([x, y]) => p(x, y, d)),
    ],
    tint,
  );
  if (!lod || !trim || (lod === 1 && d < 0.16)) return;
  for (const [left, right] of [
    [u - radius - border, u - radius],
    [u + radius, u + radius + border],
  ]) {
    panel(out, 'stone', f, left, right, b, spring, d + 0.036, stone);
  }
  for (let i = 0; i < path.length - 1; i++) {
    quad4(
      out,
      'stone',
      p(...path[i + 1], d + 0.038),
      p(...path[i], d + 0.038),
      p(...around[i], d + 0.038),
      p(...around[i + 1], d + 0.038),
      i % 3 === 1 ? paleStone : stone,
    );
  }
  if (lod >= 2 && grid) {
    panel(out, 'stone', f, u - radius, u + radius, b - 0.08, b + 0.012, d + 0.075, paleStone);
    panel(out, 'iron', f, u - 0.03, u + 0.03, b, spring + 0.15, d + 0.04, recess);
    if (lod === 3)
      for (const t of [0.29, 0.58, 0.8]) {
        const y = b + (spring - b) * t;
        panel(out, 'iron', f, u - radius, u + radius, y - 0.025, y + 0.025, d + 0.042, recess);
      }
  }
}

function roofFan(out, ring, center, eave, ridge, tint = roof) {
  const border = outwardRing(ring);
  const apex = [center[0], ridge, center[1]];
  for (let i = 0; i < border.length; i++) {
    const [x, z] = border[i],
      [nx, nz] = border[(i + 1) % border.length];
    tri(out, 'roof', [x, eave, z], [nx, eave, nz], apex, tint);
  }
}
function shallowAisleRoof(out, x0, x1, z0, z1, inner, outer, sign) {
  const u = sign > 0 ? x0 : x1,
    v = sign > 0 ? x1 : x0;
  const roofFace = [
    [u, inner, z0],
    [v, outer, z0],
    [v, outer, z1],
    [u, inner, z1],
  ];
  quad4(out, 'roof', ...(sign > 0 ? roofFace.slice().reverse() : roofFace), lighterRoof);
}
function buttress(out, f, u, width, baseY, peak, lod, depth = 0.96) {
  fbox(out, 'brick', f, u - width / 2, u + width / 2, baseY, peak, -0.19, depth, weatheredBrick);
  if (lod >= 2) {
    fbox(
      out,
      'foundation',
      f,
      u - width * 0.57,
      u + width * 0.57,
      baseY,
      baseY + 0.71,
      -0.14,
      depth + 0.08,
      baseColor,
    );
    fbox(
      out,
      'stone',
      f,
      u - width * 0.55,
      u + width * 0.55,
      peak - 0.24,
      peak,
      -0.11,
      depth + 0.12,
      stone,
    );
  }
}

function nave(out, lod) {
  const lower = outlineRect(-16.25, 16.67, 11.2, 58.02);
  const clerestory = outlineRect(-10.29, 10.43, 10.4, 58.02);
  walls(out, 'foundation', lower, -1.95, 1.39, baseColor);
  walls(out, 'brick', lower, 1.36, 9.85, brick, false);
  walls(out, 'brick', clerestory, 9.79, 19.18, paleBrick);
  gableRoof(out, 'roof', [0.06, 10.4], [0.06, 57.8], 20.69, 19.16, 23.61, roof, {
    overhang: 0.31,
    endSlot: 'brick',
    endColor: brick,
  });
  for (const sign of [-1, 1]) {
    const lowerX = sign > 0 ? 16.67 : -16.25;
    const upperX = sign > 0 ? 10.43 : -10.29;
    shallowAisleRoof(
      out,
      Math.min(lowerX, upperX) - 0.04,
      Math.max(lowerX, upperX) + 0.04,
      11.2,
      57.82,
      12.54,
      9.84,
      sign,
    );
    const f =
      sign < 0
        ? wallFace([lowerX, 11.21], [lowerX, 57.79])
        : wallFace([lowerX, 57.79], [lowerX, 11.21]);
    const c =
      sign < 0
        ? wallFace([upperX, 11.0], [upperX, 57.77])
        : wallFace([upperX, 57.77], [upperX, 11.0]);
    const count = lod === 0 ? 4 : 8;
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) * f.length) / count;
      const nearMiègeville = sign > 0 && f.P(u, 0, 0)[2] > 37.9 && f.P(u, 0, 0)[2] < 44.6;
      if (!nearMiègeville) arch(out, f, u, 3.42, 1.77, 3.94, lod, { grid: true });
      arch(out, c, ((j + 0.5) * c.length) / count, 13.14, 1.52, 3.04, lod, { grid: true });
      if (lod) buttress(out, f, ((j + 1) * f.length) / count - 0.13, 0.74, 1.25, 8.75, lod, 0.65);
    }
    if (lod) {
      for (const [y, h] of [
        [1.46, 0.43],
        [2.52, 0.33],
        [6.84, 0.28],
      ]) {
        panel(out, 'stone', f, 0, f.length, y, y + h, 0.021, stone);
      }
      course(out, f, 7.85, 0.19, 0.18, lod);
      course(out, f, 8.11, 0.28, 0.21, lod, 'brick', weatheredBrick);
      course(out, c, 17.31, 0.19, 0.19, lod);
      const small = lod === 1 ? 13 : 19;
      for (let j = 0; j < small; j++)
        arch(out, c, ((j + 0.5) * c.length) / small, 17.93, 0.52, 0.77, lod, { trim: false });
    }
  }
}

function transepts(out, lod) {
  const plan = outlineRect(-29.95, 30.34, -11.12, 13.15);
  walls(out, 'foundation', plan, -1.92, 1.22, baseColor);
  walls(out, 'brick', plan, 1.2, 18.87, brick);
  gableRoof(out, 'roof', [-29.95, 1.01], [30.34, 1.01], 24.27, 18.84, 23.81, roof, {
    overhang: 0.28,
    endSlot: 'brick',
    endColor: brick,
  });
  for (const f of faces(plan)) {
    const short = Math.abs(f.normal[0]) > 0.5;
    if (short) {
      for (const q of [0.25, 0.5, 0.75]) {
        arch(out, f, q * f.length, 9.43, 2.2, 5.48, lod, { grid: true });
        if (lod) buttress(out, f, q * f.length - 2.4, 0.68, 1.18, 16.93, lod, 0.79);
      }
      arch(out, f, f.length * 0.5, 16.77, 1.99, 4.25, lod, { grid: true });
    } else {
      for (const q of [0.09, 0.19, 0.29, 0.71, 0.81, 0.91])
        arch(out, f, q * f.length, 10.17, 1.67, 4.3, lod, { grid: true });
    }
    if (lod) {
      if (short)
        for (const y of [1.61, 2.64, 8.95]) {
          panel(out, 'stone', f, 0, f.length, y, y + 0.26, 0.021, stone);
        }
      course(out, f, 7.59, 0.35, 0.16, lod, 'stone', stone);
      course(out, f, 17.58, 0.23, 0.15, lod, 'brick', paleBrick);
      const count = short ? 9 : 25;
      if (lod >= 2)
        for (let j = 0; j < count; j++) {
          const u = ((j + 0.5) * f.length) / count;
          if (short || u < f.length * 0.32 || u > f.length * 0.68)
            arch(out, f, u, 17.96, 0.42, 0.82, lod, { trim: false });
        }
    }
  }
}

function chevet(out, lod) {
  const high = sampledOutline(260584822, lod === 0 ? 2.5 : lod === 1 ? 1.9 : 0.85);
  const middle = sampledOutline(260584856, lod === 0 ? 3.2 : lod === 1 ? 2.0 : 0.95);
  walls(out, 'foundation', middle, -1.8, 1.35, baseColor);
  walls(out, 'brick', middle, 1.33, 10.19, paleBrick);
  walls(out, 'brick', high, 9.95, 16.85, paleBrick);
  roofFan(out, middle, [0.04, -13.97], 10.16, 13.13, lighterRoof);
  roofFan(out, high, [-0.08, -14.67], 16.84, 19.45, lighterRoof);
  if (lod) {
    band(out, high, 15.68, 0.22, 0.16, lod, 'stone', paleStone);
    band(out, middle, 8.87, 0.2, 0.12, lod, 'stone', paleStone);
  }
  for (const [r, rise, y, scale] of lod
    ? [
        [high, 3.7, 11.38, 0.95],
        [middle, 3.93, 4.1, 1.42],
      ]
    : []) {
    for (const f of faces(r)) {
      if (f.length < scale * 0.86 || f.origin[1] > -15.9 || f.normal[1] > 0.57) continue;
      arch(out, f, f.length * 0.5, y, Math.min(scale, f.length * 0.65), rise, lod, { grid: true });
      if (lod > 1)
        fbox(out, 'stone', f, -0.12, 0.08, y - 0.81, y + rise + 0.2, -0.07, 0.124, stone);
    }
  }
  for (const id of [
    260584781, 260584815, 260584816, 260584817, 260584818, 260584824, 260584832, 260584833,
    260584834,
  ]) {
    const ring = sampledOutline(id, lod === 0 ? 2.83 : lod === 1 ? 1.56 : 0.76);
    const center = [0, 1].map((d) => ring.reduce((sum, p) => sum + p[d], 0) / ring.length);
    if (lod) walls(out, 'foundation', ring, -1.68, 1.63, baseColor);
    walls(out, 'brick', ring, lod ? 1.61 : -1.68, 7.94, brick);
    roofFan(out, ring, [center[0], center[1] + 0.19], 7.91, 10.19, lighterRoof);
    if (!lod) continue;
    band(out, ring, 7.26, 0.17, 0.14, lod, 'stone', paleStone);
    for (const f of faces(ring)) {
      if (f.origin[1] < center[1] + 0.2)
        panel(out, 'stone', f, 0, f.length, 2.78, 2.99, 0.022, stone);
    }
    for (const f of faces(ring)) {
      if (
        f.length >= 0.97 &&
        f.length <= 2.81 &&
        f.normal[1] < -0.17 &&
        f.origin[1] <= center[1] + 0.2
      ) {
        arch(out, f, f.length * 0.5, 3.05, Math.min(0.8, f.length * 0.65), 3.43, lod, {
          grid: true,
        });
      }
    }
  }
  for (const [x, y, z] of [
    [-16.85, 13.4, 13.17],
    [16.46, 17.0, 12.55],
  ]) {
    const stair = tower(out, 'brick', [x, z], 1.17, lod >= 2 ? 12 : 8, 1.08, y, paleBrick, {
      top: false,
    });
    roofFan(out, stair, [x, z], y, y + 0.88, roof);
    if (lod) band(out, stair, y - 1.0, 0.18, 0.15, lod);
  }
}

function rose(out, f, x, y, lod) {
  const n = [10, 24, 40, 56][lod];
  const radius = 3.56;
  const p = (a, r, d = 0.06) => f.P(x + r * Math.cos(a), y + r * Math.sin(a), d);
  const ang = (i) => (i * 2 * Math.PI) / n;
  fan(
    out,
    'glass',
    Array.from({ length: n }, (_, i) => p(ang(i), radius)),
    glass,
  );
  for (let i = 0; i < n; i++) {
    const a = ang(i),
      b = ang(i + 1);
    quad4(
      out,
      'stone',
      p(a, radius + 0.32, 0.23),
      p(b, radius + 0.32, 0.23),
      p(b, radius, 0.23),
      p(a, radius, 0.23),
      paleStone,
    );
  }
  if (!lod) return;
  const count = lod === 1 ? 8 : 12;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    beam(out, 'iron', p(a, 0.33, 0.24), p(a, radius - 0.14, 0.24), 0.092, 0.105, recess);
  }
  if (lod === 3)
    for (let j = 0; j < 12; j++) {
      const a = (j * 2 * Math.PI) / 12,
        b = a + (2 * Math.PI) / 12;
      beam(out, 'iron', p(a, 2.47, 0.25), p(b, 2.47, 0.25), 0.052, 0.056, recess);
    }
}
function west(out, lod) {
  const front = 75.03;
  const mass = outlineRect(-17.57, 17.83, 57.36, front);
  walls(out, 'foundation', mass, -1.48, 2.0, baseColor);
  walls(out, 'brick', mass, 1.98, 21.88, weatheredBrick, false);
  const f = wallFace([-17.57, front], [17.83, front]);
  const center = 17.66;
  const span = 17.1;
  const core = facade([-8.44, front + 0.18], [1, 0]);
  fbox(out, 'brick', f, 9.13, 26.23, 1.44, 21.88, -0.18, 0.018, paleBrick);
  tri(
    out,
    'brick',
    core.P(0, 21.85, 0.11),
    core.P(span, 21.85, 0.11),
    core.P(span / 2, 25.3, 0.11),
    paleBrick,
  );
  gableRoof(out, 'roof', [0.09, 59.4], [0.09, 75.16], 17.12, 21.86, 25.28, roof, {
    overhang: 0.19,
    endSlot: 'brick',
    endColor: paleBrick,
  });
  for (const u of [1.72, 6.08, 9.5, 25.96, 29.26, 33.76])
    buttress(out, f, u, 1.4, 1.08, 22.35, lod, 1.12);
  for (const side of [-1, 1]) {
    const u = center + side * 3.21;
    arch(out, f, u, 1.37, 4.93, 6.04, lod, { d: 0.21, tint: recess, grid: true });
    if (lod > 1) {
      for (const du of [-2.92, 2.92])
        fbox(out, 'stone', f, u + du - 0.19, u + du + 0.19, 1.28, 5.07, 0.04, 0.55, stone);
    }
  }
  const steps = lod >= 2 ? 5 : 2;
  for (let i = 1; i <= steps; i++) {
    abox(
      out,
      'foundation',
      [-6.48, 0.44, 74.94],
      [6.79, 1.42 - ((i - 1) * 0.67) / steps, 75.64 + (i * 0.58) / steps],
      baseColor,
      { bottom: false },
    );
  }
  if (lod) fbox(out, 'stone', f, 7.85, 27.4, 8.58, 11.1, 0.03, 0.21, paleStone);
  for (let i = 0; i < 7; i++)
    arch(out, f, 10.1 + i * 2.54, 9.0, 1.77, 1.86, lod, { d: 0.27, tint: recess });
  rose(out, f, center, 16.17, lod);
  if (lod > 1)
    for (const u of [4.28, 30.98]) arch(out, f, u, 4.08, 1.08, 2.82, lod, { grid: true });
  if (lod > 0) {
    course(out, f, 8.22, 0.21, 0.14, lod, 'stone', stone);
    for (const side of faces(mass)) {
      if (side.normal[1] > 0.7) continue;
      if (Math.abs(side.normal[0]) > 0.7) {
        for (const q of [0.18, 0.75])
          buttress(out, side, q * side.length, 1.01, 1.28, 21.88, lod, 0.95);
        arch(out, side, side.length * 0.46, 5.2, 1.04, 4.36, lod, { grid: true });
      }
    }
  }
}

function southernPortal(out, lod) {
  const f = facade([17.0, 44.26], [0, -1]);
  fbox(out, 'stone', f, 0, 6.18, 1.24, 7.96, -0.47, 0.31, stone);
  const portalX = 3.09,
    bottom = 1.54;
  arch(out, f, portalX, bottom, 3.94, 5.59, lod, { d: 0.35, tint: recess, grid: false });
  fbox(out, 'stone', f, -0.12, 6.32, 7.81, 8.24, -0.68, 0.42, paleStone);
  const steps = lod > 1 ? 4 : 2;
  for (let n = 1; n <= steps; n++) {
    fbox(
      out,
      'foundation',
      f,
      0.57,
      5.54,
      0.85,
      1.47 - ((n - 1) * 0.45) / steps,
      0.05,
      0.74 + n * 0.2,
      baseColor,
    );
  }
  if (!lod) return;
  for (const u of [0.47, 1.04, 5.16, 5.72]) {
    fbox(out, 'stone', f, u - 0.125, u + 0.125, 1.58, 5.65, 0.15, 0.6, paleStone);
    fbox(out, 'stone', f, u - 0.17, u + 0.17, 5.4, 5.7, 0.14, 0.72, stone);
  }
  const n = lod > 1 ? 18 : 8;
  const points = roundArch(1.8, n);
  const skirt = roundArch(2.12, n);
  const y = 5.13;
  for (let i = 0; i < n; i++) {
    const point = (set, index, d) => f.P(portalX + set[index][0], y + set[index][1], d);
    quad4(
      out,
      'stone',
      point(points, i + 1, 0.405),
      point(points, i, 0.405),
      point(skirt, i, 0.405),
      point(skirt, i + 1, 0.405),
      i % 4 === 1 ? paleStone : stone,
    );
  }
  fan(
    out,
    'stone',
    points
      .slice()
      .reverse()
      .map(([x, y]) => f.P(portalX + x, y + 5.13, 0.392)),
    paleStone,
  );
  fbox(out, 'stone', f, 1.27, 4.9, 4.96, 5.25, 0.31, 0.54, stone);
  if (lod >= 2) {
    for (let i = 0; i < 8; i++) {
      const u = 1.55 + i * 0.445;
      const h = 0.36 + 0.25 * (1 - Math.abs((i - 3.5) / 4));
      fbox(out, 'stone', f, u - 0.079, u + 0.079, 5.26, 5.26 + h, 0.4, 0.47, stone);
    }
  }
}

function stageRing(radius, center = [0, 0]) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * 2 * Math.PI) / 8;
    return [center[0] + Math.cos(a) * radius, center[1] + Math.sin(a) * radius];
  });
}
function bellTower(out, lod) {
  const stages = [
    { bottom: 24.17, top: 29.72, radius: 5.68, pointed: false },
    { bottom: 29.72, top: 35.2, radius: 5.51, pointed: false },
    { bottom: 35.2, top: 40.74, radius: 5.34, pointed: false },
    { bottom: 40.74, top: 46.31, radius: 5.13, pointed: true },
    { bottom: 46.31, top: 51.66, radius: 4.97, pointed: true },
  ];
  walls(out, 'brick', stageRing(6.08), 19.87, 24.24, towerBrick);
  for (const tier of stages) {
    const { bottom, top, radius, pointed } = tier;
    const ring = stageRing(radius);
    walls(out, 'brick', ring, bottom, top, towerBrick);
    for (const f of faces(ring)) {
      const w = f.length * 0.306;
      const y = bottom + 0.97;
      const h = top - bottom - 1.78;
      if (lod === 0) {
        panel(out, 'glass', f, f.length * 0.165, f.length * 0.835, y, top - 0.85, 0.046, recess);
        panel(out, 'stone', f, f.length * 0.469, f.length * 0.531, y, top - 0.79, 0.062, stone);
        continue;
      }
      for (const q of [0.28, 0.72])
        arch(out, f, f.length * q, y, w, h, lod, { pointed, tint: recess });
      course(out, f, top - 0.55, 0.32, 0.19, lod, 'stone', stone);
      if (lod >= 2) {
        for (const q of [0.03, 0.49, 0.97]) {
          const u = f.length * q;
          fbox(
            out,
            'stone',
            f,
            u - 0.111,
            u + 0.111,
            bottom + 0.58,
            top - 0.45,
            -0.082,
            0.19,
            paleStone,
          );
        }
        fbox(
          out,
          'stone',
          f,
          0.02,
          f.length - 0.02,
          bottom + 0.51,
          bottom + 0.72,
          -0.08,
          0.26,
          stone,
        );
      }
    }
  }
  const edge = stageRing(5.02);
  walls(out, 'brick', edge, 51.55, 52.35, towerBrick);
  if (lod) {
    for (const f of faces(edge)) {
      course(out, f, 51.48, 0.31, 0.22, lod, 'stone', stone);
      for (const q of [0, 0.5, 1])
        fbox(
          out,
          'brick',
          f,
          f.length * q - 0.22,
          f.length * q + 0.22,
          52.15,
          53.05,
          -0.19,
          0.2,
          towerBrick,
        );
    }
  }
  lathe(
    out,
    'spire',
    [0, 0],
    [
      [51.98, 4.07, 4.07],
      [53.28, 3.77, 3.77],
      [61.02, 1.27, 1.27],
      [63.95, 0.32, 0.32],
    ],
    8,
    metal,
    { rotation: Math.PI / 8 },
  );
  beam(out, 'iron', [0, 63.91, 0], [0, 65.0, 0], 0.082, 0.088, recess);
  if (lod > 1) beam(out, 'iron', [-0.47, 64.64, 0], [0.47, 64.64, 0], 0.062, 0.064, recess);
}
function build(out, lod) {
  nave(out, lod);
  transepts(out, lod);
  chevet(out, lod);
  west(out, lod);
  southernPortal(out, lod);
  bellTower(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'basilica-of-saint-sernin-toulouse-model.mjs';
const camera = [106, 57, 123];
const lookAt = [1, 23, 18];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Romanesque Basilica of Saint-Sernin in Toulouse, with a five-tier octagonal bell tower, tiled aisles, stone portals and layered eastern chapels.',
  camera,
  lookAt,
  sunDirection: [57, 72, 41],
  mediumFiContext: {
    scale: 1.57,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The native basilica envelope and attached chapels around its eastern ambulatory.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_limestone_weathered',
    'stone_ashlar',
    'tile_ceramic',
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-rose-and-crossing-tower', position: camera, lookAt },
    { name: 'miegeville-portal-and-south-nave', position: [67, 13, 50], lookAt: [16.8, 11, 40] },
    { name: 'chevet-and-radial-chapels', position: [68, 27, -88], lookAt: [0, 23, -9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'saint-sernin-toulouse-' + reviewLod,
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
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model based on firsthand CC0 Qualla and supplemental photography, native OpenStreetMap geometry under ODbL and open Mapzen terrain.',
};
