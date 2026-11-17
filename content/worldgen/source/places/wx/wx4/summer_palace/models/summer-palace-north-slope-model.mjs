/** The Tibetan Buddhist ensemble and its neighboring glazed pagoda on Longevity Hill. */
import {
  beam,
  beamPath,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  surfaces as courtSurfaces,
  face,
  frame,
  gold,
  granite,
  indigo,
  levels,
  marble,
  rectangle,
  red,
  roofs,
  solid,
  turquoise,
} from './summer-palace-model.mjs';

export const forms = new Set(['four-regions', 'duobao']);
export const surfaces = {
  ...courtSurfaces,
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.54, roughness: 0.52 },
};
const plaster = [0.735, 0.702, 0.627];
const vermilion = [0.446, 0.112, 0.074];
const shutters = [0.142, 0.091, 0.069];
const soilStone = [0.455, 0.423, 0.36];
const stupaColors = {
  white: plaster,
  red: [0.55, 0.135, 0.083],
  green: [0.277, 0.389, 0.216],
  black: [0.18, 0.191, 0.188],
};
const octagon = Math.PI / 8;

function cap(out, w, d, y, rise, color) {
  const ring = (h, k, l) =>
    rectangle(w * k, d * l)
      .toReversed()
      .map(([x, z]) => [x, y + h, z]);
  loft(out, 'tile', [ring(0, 1, 1), ring(rise, 0.71, 0.08)], color);
}

function flatTibetanPodium(out, outline, toe, grade, h, detail) {
  solid(out, 'stone', outline, toe, grade + 0.58, soilStone);
  solid(out, 'plaster', outline, grade + 0.54, grade + h - 0.18, vermilion);
  const top = outline.map(([x, z]) => [x * 1.025, z * 1.025]);
  solid(out, 'stone', top, grade + h - 0.23, grade + h, plaster);
  if (detail >= 2) {
    const track = outline.map(([x, z]) => [x * 1.008, z * 1.008]);
    solid(out, 'stone', track, grade + 0.82, grade + 0.92, soilStone);
  }
}

function blindWindow(out, x, y, z, sign, w, h) {
  const panel = (width, bottom, top, depth, tint, slot) =>
    face(
      out,
      slot,
      [
        [x - width / 2, bottom, depth],
        [x + width / 2, bottom, depth],
        [x + width / 2, top, depth],
        [x - width / 2, top, depth],
      ],
      tint,
      [0, 0, sign],
    );
  panel(w * 1.28, y - 0.07, y + h + 0.09, z, plaster, 'stone');
  panel(w, y, y + h, z + sign * 0.008, shutters, 'timber');
}

function chamberOutline(w, d, shape) {
  if (shape === 'round') return radialRing(0, w / 2, d / 2, 12).map(([x, , z]) => [x, z]);
  if (shape === 'crescent') {
    const arc = (rise) =>
      Array.from({ length: 13 }, (_, i) => {
        const x = i / 6 - 1;
        return [(x * w) / 2, -d * 0.38 + rise * Math.sqrt(Math.max(0, 1 - x * x))];
      });
    return [
      ...arc(d),
      ...arc(d * 0.35)
        .slice(1, -1)
        .reverse(),
    ];
  }
  if (shape === 'six')
    return radialRing(0, w / 2, d / 2, 6, [0, 0], Math.PI / 6).map(([x, , z]) => [x, z]);
  if (shape === 'trapezoid')
    return [
      [-w * 0.41, -d / 2],
      [w * 0.41, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ];
  return rectangle(w, d);
}

function shrine(out, control, detail) {
  const { center, grade, toe, width: w, depth: d, role, base, shape, angle = 0 } = control;
  const local = frame(out, center, grade, angle);
  const low = role === 'minor';
  const slab = detail === 0 && shape !== 'round' ? rectangle(w, d) : chamberOutline(w, d, shape);
  if (detail === 0 && low) {
    solid(local, 'plaster', slab, toe - grade, base + 0.91, vermilion);
    return;
  }
  if (detail === 0) solid(local, 'plaster', slab, toe - grade, base, vermilion);
  else flatTibetanPodium(local, slab, toe - grade, 0, base, detail);
  const u = w * (low ? 0.56 : 0.73),
    v = d * (low ? 0.58 : 0.69);
  const h = low ? 1.62 : 2.34;
  box(local, 'plaster', [-u / 2, base, -v / 2], [u / 2, base + h, v / 2], plaster);
  if (low) {
    box(
      local,
      'stone',
      [-u * 0.59, base + h, -v * 0.59],
      [u * 0.59, base + h + 0.21, v * 0.59],
      soilStone,
    );
  } else if (detail < 2) {
    cap(local, u * 1.23, v * 1.28, base + h, 1.28, roofs.gold);
  } else {
    courtRoof(local, u * 1.25, v * 1.28, base + h + 0.14, 1.55, roofs.gold, detail, false, 0.31);
    for (const z of [-v * 0.49, v * 0.49])
      beam(local, 'timber', [-u * 0.48, base + h, z], [u * 0.48, base + h, z], 0.24, 0.31, indigo);
  }
  if (detail >= 2) {
    const side = -1,
      n = low ? 2 : Math.max(3, Math.round(w / 2.7));
    blindWindow(local, 0, base + 0.17, v * side * 0.502, side, Math.min(0.8, u * 0.3), 1.15);
    if (shape === 'rect' || shape === 'trapezoid') {
      const floor = d * 0.5 * side;
      for (let i = 0; i < n; i++) {
        const x = ((i - (n - 1) / 2) * w * 0.68) / n;
        blindWindow(local, x, base * 0.47, floor + side * 0.012, side, 0.32, 0.52);
      }
    }
  }
}

function stoneSteps(out, step, detail) {
  const { from, to, width, toe, grades } = step;
  const [x, y, z] = from,
    [u, , w] = to;
  const run = Math.hypot(u - x, w - z),
    angle = Math.atan2(-(u - x), w - z);
  const local = frame(out, [x, z], y, angle);
  const count = detail === 0 ? 2 : Math.max(3, Math.round(run / (detail === 1 ? 1.1 : 0.36)));
  const elevation = (t) => grades[Math.round(t * (grades.length - 1))] - y;
  for (let i = 0; i < count; i++) {
    const a = (run * i) / count,
      b = (run * (i + 1)) / count;
    box(
      local,
      'stone',
      [-width / 2, toe - y, a],
      [width / 2, elevation((i + 1) / count), b],
      granite,
    );
  }
  if (detail === 0) return;
  for (const sign of [-1, 1]) {
    const e = sign * (width / 2 + 0.12);
    const rail = Array.from({ length: 7 }, (_, i) => [e, elevation(i / 6) + 0.24, (run * i) / 6]);
    beamPath(local, 'marble', rail, 0.22, 0.3, marble);
  }
}

function stupa(out, { center, grade, toe, color }, detail) {
  const o = frame(out, center, grade, 0),
    tint = stupaColors[color];
  const y = 2.35,
    r = 1.43,
    n = detail < 2 ? 6 : detail === 2 ? 10 : 18;
  if (detail === 0) {
    box(o, 'plaster', [-1.42, toe - grade, -1.42], [1.42, y, 1.42], vermilion);
  } else {
    flatTibetanPodium(o, rectangle(2.84, 2.84), toe - grade, 0, y, detail);
    blindWindow(o, 0, 0.89, -1.428, -1, 0.48, 0.73);
    blindWindow(o, 0.86, 1.04, -1.428, -1, 0.22, 0.42);
    blindWindow(o, -0.86, 1.04, -1.428, -1, 0.22, 0.42);
  }
  const profile =
    detail < 2
      ? [
          [0, 0.88],
          [0.25, 0.6],
          [0.76, 1],
          [1.28, 0.47],
          [1.6, 0.32],
          [3.8, 0.086],
          [4.18, 0.24],
          [4.46, 0.035],
        ]
      : [
          [0, 0.86],
          [0.12, 0.91],
          [0.24, 0.64],
          [0.48, 0.69],
          [0.81, 1],
          [1.12, 0.85],
          [1.4, 0.53],
          [1.56, 0.42],
          [1.73, 0.31],
        ];
  loft(
    o,
    'plaster',
    profile.map(([h, k]) => radialRing(y + h, r * k, r * k, n)),
    tint,
  );
  if (detail < 2) return;
  const spire = Array.from({ length: 14 }, (_, i) => {
    const h = 1.71 + i * 0.16,
      w = 0.34 - (i / 13) * 0.247;
    return [
      [h, w],
      [h + 0.043, w * 1.14],
      [h + 0.084, w * 0.94],
    ];
  }).flat();
  const edges = spire.map(([h, k]) => radialRing(y + h, r * k, r * k, n));
  loft(o, 'tile', edges, tint);
  const finial = [
    [3.84, 0.11],
    [3.91, 0.26],
    [4.04, 0.21],
    [4.13, 0.06],
    [4.24, 0.13],
    [4.38, 0.09],
    [4.54, 0.02],
  ];
  loft(
    o,
    'bronze',
    finial.map(([h, k]) => radialRing(y + h, k, k, n)),
    gold,
  );
}

function redRetainingWall(out, { a, b, grade, toe, height }, detail) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const local = frame(out, a, grade, angle),
    foot = toe - grade;
  if (detail === 0) {
    box(local, 'plaster', [0, foot, -0.57], [len, height, 0.57], vermilion);
    return;
  }
  box(local, 'stone', [0, foot, -0.62], [len, 0.46, 0.62], soilStone);
  box(local, 'plaster', [0, 0.45, -0.57], [len, height, 0.57], vermilion);
  box(local, 'tile', [0, height, -0.69], [len, height + 0.21, 0.69], roofs.gold);
  if (detail >= 2) {
    const count = Math.floor(len / 2.45);
    for (let i = 1; i < count; i++) {
      const x = (len * i) / count;
      blindWindow(local, x, height * 0.62, -0.579, -1, 0.36, 0.53);
    }
  }
}

function fourRegions(out, layout, detail) {
  const [room] = layout.sites;
  const { width: w, depth: d, center, angle } = room.frame;
  const top = room.grade + 0.73,
    shoulder = Math.max(room.toe + 0.28, top - 5.2);
  solid(out, 'stone', room.outline, room.toe, shoulder, granite);
  solid(out, 'plaster', room.outline, shoulder, top - 0.22, vermilion);
  solid(out, 'stone', room.outline, top - 0.22, top, marble);
  const hall = frame(out, center, top, angle + Math.PI);
  if (detail === 0) {
    box(hall, 'plaster', [-w * 0.42, 0, -d * 0.39], [w * 0.42, 4.88, d * 0.39], red);
    cap(hall, w * 1.06, d * 1.08, 5.1, 4.05, roofs.gold);
  } else {
    courtBay(hall, w, d, 0, 4.88, 7, detail, { wall: true, frontScreen: true });
    courtRoof(hall, w * 1.073, d * 1.07, 5.11, 4.05, roofs.gold, detail, true, 0.68);
    const entry = frame(hall, [0, d * 0.39], 0, 0);
    courtBay(entry, w * 0.43, d * 0.27, 0, 3.08, 3, detail);
    courtRoof(entry, w * 0.47, d * 0.33, 3.22, 1.35, roofs.gold, detail, false, 0.25);
  }
  for (const control of layout.regions.shrines) shrine(out, control, detail);
  for (const control of layout.regions.stupas) stupa(out, control, detail);
  for (const line of layout.regions.walls) redRetainingWall(out, line, detail);
  for (const step of layout.regions.steps) stoneSteps(out, step, detail);
}

function glazedEave(out, base, inner, spread, rise, tint, detail) {
  const n = 8;
  const profile =
    detail === 0
      ? [
          [0, spread],
          [rise, inner],
        ]
      : [
          [0, spread],
          [rise * 0.16, spread * 0.89],
          [rise * 0.55, inner * 1.18],
          [rise, inner],
        ];
  const rings = profile.map(([y, r]) => radialRing(base + y, r, r, n, [0, 0], octagon));
  loft(out, 'tile', rings, tint);
  if (detail < 2) return;
  const brackets = radialRing(base - 0.13, inner * 1.04, inner * 1.04, n, [0, 0], octagon);
  for (let i = 0; i < n; i++) {
    const corner = rings[0][i];
    beam(out, 'tile', corner, rings[1][i], 0.13, 0.14, tint);
    beam(out, 'timber', brackets[i], corner, 0.162, 0.145, indigo);
    if (detail >= 3) {
      const [x, y, z] = corner;
      beam(
        out,
        'bronze',
        [x * 0.979, y - 0.045, z * 0.979],
        [x * 0.979, y - 0.245, z * 0.979],
        0.057,
        0.056,
        gold,
      );
    }
  }
}

function niche(out, x, y, z, w, h, detail, large) {
  const tint = [0.178, 0.329, 0.294],
    peak = (x, y) => [x, y, z];
  const ring = [
    peak(x - w / 2, y),
    peak(x + w / 2, y),
    peak(x + w / 2, y + h * 0.64),
    peak(x + w * 0.27, y + h * 0.88),
    peak(x, y + h),
    peak(x - w * 0.27, y + h * 0.88),
    peak(x - w / 2, y + h * 0.64),
  ];
  for (let i = 1; i < ring.length - 1; i++)
    face(out, 'tile', [ring[0], ring[i], ring[i + 1]], tint, [0, 0, 1]);
  const front = z + 0.011,
    ro = large ? marble : [0.598, 0.42, 0.215];
  face(
    out,
    'tile',
    [
      [x - w * 0.25, y + h * 0.1, front],
      [x + w * 0.25, y + h * 0.1, front],
      [x + w * 0.13, y + h * 0.53, front],
      [x - w * 0.13, y + h * 0.53, front],
    ],
    ro,
    [0, 0, 1],
  );
  const size = w * 0.126;
  if (large) {
    const bodyZ = front + w * 0.075;
    sphere(out, 'tile', [x, y + h * 0.19, bodyZ], [w * 0.31, h * 0.088, w * 0.14], ro, 6, 3);
    loft(
      out,
      'tile',
      [
        radialRing(y + h * 0.19, w * 0.224, w * 0.093, 6, [x, bodyZ]),
        radialRing(y + h * 0.39, w * 0.132, w * 0.097, 6, [x, bodyZ]),
        radialRing(y + h * 0.53, w * 0.085, w * 0.081, 6, [x, bodyZ]),
      ],
      ro,
    );
    sphere(out, 'tile', [x, y + h * 0.595, bodyZ], [size, h * 0.083, w * 0.101], ro, 7, 4);
  } else if (detail >= 3) {
    loft(
      out,
      'tile',
      [
        radialRing(y + h * 0.43, size * 0.87, size * 0.67, 6, [x, front]),
        radialRing(y + h * 0.6, size, size * 0.73, 6, [x, front]),
        radialRing(y + h * 0.69, size * 0.59, size * 0.52, 6, [x, front]),
      ],
      ro,
    );
  } else {
    face(
      out,
      'tile',
      [
        [x - size, y + h * 0.48, front],
        [x + size, y + h * 0.48, front],
        [x, y + h * 0.72, front],
      ],
      ro,
      [0, 0, 1],
    );
  }
  if (large && detail >= 2) {
    const outer = ring.map(([u, v, p]) => [x + (u - x) * 1.19, y + (v - y) * 1.13, p + 0.006]);
    for (let i = 1; i < ring.length; i++)
      face(out, 'tile', [ring[i - 1], ring[i], outer[i], outer[i - 1]], marble, [0, 0, 1]);
  }
}

function glazedDrum(out, radius, bottom, top, color, detail, rows) {
  const mid = (top - bottom) * 0.5;
  const outer = 2 * radius * Math.sin(octagon),
    z = radius * Math.cos(octagon);
  loft(
    out,
    'tile',
    [
      radialRing(bottom, radius, radius, 8, [0, 0], octagon),
      radialRing(top, radius, radius, 8, [0, 0], octagon),
    ],
    color,
  );
  if (detail === 0) return;
  for (let i = 0; i < 8; i++) {
    const side = frame(out, [0, 0], bottom, (i * Math.PI) / 4);
    const q = z + 0.008;
    niche(side, 0, mid * 0.42, q, outer * 0.54, mid * 0.92, detail, true);
    if (detail === 1) continue;
    const columns = detail === 2 ? 5 : 7;
    const cellW = (outer * 0.89) / columns,
      cellH = (2 * mid * 0.91) / rows;
    for (let k = 0; k < rows; k++)
      for (let j = 0; j < columns; j++) {
        const x = (j - (columns - 1) * 0.5) * cellW,
          y = mid * 0.07 + k * cellH;
        if (Math.abs(x) < outer * 0.31 && y > mid * 0.2 && y < mid * 1.37) continue;
        niche(side, x, y, q, cellW * 0.77, cellH * 0.8, detail, false);
      }
  }
}

function duobao(out, layout, detail) {
  const [site] = layout.sites;
  const { width: w, depth: d, center, angle } = site.frame;
  const pagoda = frame(out, center, site.grade, angle);
  const r = Math.min(w, d) * 0.43;
  const terrace = rectangle(w, d);
  solid(pagoda, 'stone', terrace, site.toe - site.grade, 0.32, plaster);
  for (const [bottom, top, k] of [
    [0.28, 0.51, 1],
    [0.51, 0.68, 0.91],
    [0.68, 0.93, 0.87],
    [0.93, 1.13, 0.9],
  ])
    solid(pagoda, 'marble', rectangle(w * k, d * k), bottom, top, marble);
  const bodies = [
    [1.13, 5.92, 0.86, roofs.gold, 8],
    [7.22, 10.37, 0.68, [0.56, 0.396, 0.18], 7],
    [11.82, 14.52, 0.53, [0.32, 0.387, 0.219], 6],
  ];
  for (const [bottom, top, k, tint, rows] of bodies)
    glazedDrum(pagoda, r * k, bottom, top, tint, detail, detail === 2 ? Math.min(rows, 5) : rows);
  const eaves = [
    [5.72, 0.76, 1.19, 0.78, roofs.gold],
    [6.71, 0.67, 0.96, 0.54, roofs.green],
    [10.15, 0.58, 0.95, 0.71, [0.345, 0.239, 0.293]],
    [11.07, 0.49, 0.79, 0.62, indigo],
    [14.25, 0.47, 0.76, 0.53, turquoise],
    [14.94, 0.41, 0.66, 0.49, roofs.green],
    [15.69, 0.29, 0.59, 0.98, roofs.gold],
  ];
  for (const [y, a, b, rise, color] of eaves)
    glazedEave(pagoda, y, r * a, r * b, rise, color, detail);
  const junctions = [
    [6.38, 6.75, 0.76, 0.72],
    [10.77, 11.14, 0.58, 0.55],
    [11.65, 11.86, 0.52, 0.52],
    [14.72, 14.99, 0.47, 0.44],
    [15.34, 15.73, 0.43, 0.35],
  ];
  for (const [low, high, a, b] of junctions)
    loft(
      pagoda,
      'tile',
      [
        radialRing(low, r * a, r * a, 8, [0, 0], octagon),
        radialRing(high, r * b, r * b, 8, [0, 0], octagon),
      ],
      indigo,
    );
  const finial = [
    [16.55, 0.27],
    [16.83, 0.3],
    [17.12, 0.34],
    [17.49, 0.31],
    [17.66, 0.17],
    [17.83, 0.23],
    [18.09, 0.12],
    [18.31, 0.09],
    [18.56, 0.014],
  ];
  loft(
    pagoda,
    'bronze',
    finial.map(([h, k]) => radialRing(h, r * k * 0.77, r * k * 0.77, detail >= 2 ? 12 : 8)),
    gold,
  );
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    const x = side * w * 0.43;
    for (let i = 0; i < 5; i++) {
      const z = (i - 2) * d * 0.19;
      box(pagoda, 'marble', [x - 0.09, 1.03, z - 0.089], [x + 0.09, 1.96, z + 0.089], marble);
    }
    beam(pagoda, 'marble', [x, 1.71, -d * 0.38], [x, 1.71, d * 0.38], 0.104, 0.112, marble);
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  if (layout.form === 'four-regions') fourRegions(out, layout, detail);
  else if (layout.form === 'duobao') duobao(out, layout, detail);
  else throw new Error(`No north-slope generator for ${layout.form}`);
}
