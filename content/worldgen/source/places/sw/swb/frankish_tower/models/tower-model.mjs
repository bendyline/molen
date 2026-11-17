/** The 1869 Frankish Tower, with the Propylaia's south-wing fabric retained around its base. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.91 },
  bed: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95 },
  timber: { slot: 'roof', graph: 'wood_plain', roughness: 0.94 },
};
const tone = {
  // biome-ignore lint/suspicious/noApproximativeNumericConstant: Limestone vertex color, not a mathematical constant.
  rubble: [0.55, 0.51, 0.434],
  joint: [0.4, 0.373, 0.328],
  lower: [0.65, 0.62, 0.55],
  pale: [0.74, 0.709, 0.637],
  worn: [0.63, 0.586, 0.506],
  shadow: [0.298, 0.275, 0.231],
  coping: [0.65, 0.615, 0.533],
  wood: [0.375, 0.282, 0.189],
  roof: [0.6, 0.557, 0.483],
};
const X = layout.dimensions.eastWest / 2,
  Z = layout.dimensions.northSouth / 2,
  H = layout.dimensions.height;
const between = (a, b, t) => a + (b - a) * t;
const size = (v) => [
  [-v[0], -v[1]],
  [-v[0], v[1]],
  [v[0], v[1]],
  [v[0], -v[1]],
];
const windows = [
  [
    { u: 1.1, b: 0.02, t: 2.16, w: 1.13 },
    { u: -0.38, b: 15.25, t: 17.37, w: 1.04 },
  ], // east
  [{ u: -0.26, b: 19.67, t: 20.52, w: 0.53 }], // south
  [{ u: 0.39, b: 12.97, t: 14.51, w: 0.79 }], // west
  [
    { u: -0.67, b: 5.95, t: 8.18, w: 1.24 },
    { u: 0.64, b: 19.1, t: 20.11, w: 0.62 },
  ], // north
];
const sides = [
  { half: Z, map: (u, y, v) => [X - v, y, u], normal: [1, 0, 0] },
  { half: X, map: (u, y, v) => [u, y, Z - v], normal: [0, 0, 1] },
  { half: Z, map: (u, y, v) => [-X + v, y, -u], normal: [-1, 0, 0] },
  { half: X, map: (u, y, v) => [-u, y, -Z + v], normal: [0, 0, -1] },
];
const hash = (a, b, c) => ((a * 37 + b * 83 + c * 53 + 11) % 101) / 100;
function surface(out, slot, p, n, color) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = p.toReversed();
    normal = normal.map((v) => -v);
  }
  out.addQuad(slot, '', p, normal, undefined, color);
}
function wallRectangle(out, s, slot, color, x0, x1, y0, y1, dep) {
  const p = (x, y) => s.map(x, y, dep);
  surface(out, slot, [p(x0, y0), p(x1, y0), p(x1, y1), p(x0, y1)], s.normal, color);
}
function aperture(out, s, win, d) {
  const { u, b, t, w } = win,
    a = u - w / 2,
    c = u + w / 2;
  const depth = d <= 1 ? 0.56 : 1.55;
  wallRectangle(out, s, 'rubble', tone.shadow, a, c, b, t, depth);
  const p = s.map;

  const lateral = s.map(1, 0, 0).map((v, i) => v - s.map(0, 0, 0)[i]);
  for (const [x, normal] of [
    [a, lateral],
    [c, lateral.map((v) => -v)],
  ]) {
    const rb = x === a ? a - 0.11 : c + 0.11;
    surface(
      out,
      'marble',
      [p(x, b, 0), p(x, t, 0), p(rb, t, depth), p(rb, b, depth)],
      normal,
      tone.worn,
    );
  }
  surface(
    out,
    'marble',
    [p(a, b, 0), p(c, b, 0), p(c + 0.11, b, depth), p(a - 0.11, b, depth)],
    [0, 1, 0],
    tone.pale,
  );
  surface(
    out,
    'marble',
    [p(a, t, 0), p(c, t, 0), p(c + 0.11, t, depth), p(a - 0.11, t, depth)],
    [0, -1, 0],
    tone.lower,
  );
  if (d >= 1) {
    const ext = 0.14,
      front = -0.073;
    wallRectangle(out, s, 'marble', tone.pale, a - ext, c + ext, b - 0.19, b + 0.022, front);
    wallRectangle(out, s, 'marble', tone.worn, a - ext, c + ext, t, t + 0.2, front);
    for (const [x0, x1] of [
      [a - ext, a],
      [c, c + ext],
    ])
      wallRectangle(out, s, 'marble', tone.lower, x0, x1, b, t, front);
  }
}
function wall(out, side, d) {
  const s = sides[side],
    holes = windows[side].map((win) => ({
      ...win,
      left: win.u - win.w / 2,
      right: win.u + win.w / 2,
    }));
  const height = 24.56;
  const dates = [-1.4, 0, height, ...holes.flatMap(({ b, t }) => [b, t])];
  const courses = d === 0 ? 0 : d === 1 ? 14 : 51;
  for (let i = 1; i < courses; i++) dates.push((height * i) / courses);
  const stops = [...new Set(dates)].sort((a, b) => a - b);
  for (let i = 0; i < stops.length - 1; i++) {
    const y = stops[i],
      top = stops[i + 1],
      mid = (y + top) / 2;
    const openings = holes
      .filter((h) => mid > h.b && mid < h.t)
      .toSorted((a, b) => a.left - b.left);
    const runs = [-s.half, ...openings.flatMap((h) => [h.left, h.right]), s.half];
    for (let k = 0; k < runs.length; k += 2) {
      const a = runs[k],
        b = runs[k + 1],
        low = y < 5.4;
      const base = low ? 'lower' : 'rubble';
      wallRectangle(
        out,
        s,
        'rubble',
        tone[d >= 2 ? 'joint' : base],
        a,
        b,
        y,
        top,
        d >= 2 ? 0.022 : 0,
      );
      if (d < 1 || top - y < 0.066) continue;
      const count =
        d === 1
          ? Math.max(1, Math.round((b - a) / 1.6))
          : Math.max(1, Math.round((b - a) / (d === 2 ? 0.97 : d === 3 ? 0.69 : 0.55)));
      const cuts = Array.from({ length: count + 1 }, (_, j) =>
        j === 0
          ? a
          : j === count
            ? b
            : between(a, b, (j + (hash(side, i, j) - 0.5) * 0.46) / count),
      );
      for (let j = 0; j < count; j++) {
        const xx = cuts[j],
          right = cuts[j + 1],
          v = hash(side, i, j),
          vo = hash(j, i, side);
        const dep = d === 1 ? -0.019 : -0.021 - vo * (d === 2 ? 0.036 : 0.105);
        const margin = (d === 1 ? 0.009 : 0.013) + (d >= 3 ? vo * 0.013 : 0);
        const southSpolia = side === 1 && y >= 2.4 && y < 5.25 && xx > -0.9 && right < 2.5;
        const rich = base === 'lower' || v > 0.86 || southSpolia;
        const color = tone[rich ? 'pale' : base].map((n) => n + (v - 0.49) * 0.134);
        const slot = rich ? 'marble' : 'rubble';
        const x0 = xx + (xx === a ? 0 : margin),
          x1 = right - (right === b ? 0 : margin),
          y0 = y + margin,
          y1 = top - margin;
        const p = s.map;
        // The base surface closes the joints. Larger stones get shallow bevels close to the camera.
        if (d < 3) {
          wallRectangle(out, s, slot, color, x0, x1, y0, y1, dep);
        } else {
          const inset = Math.min(0.041, (x1 - x0) / 6, (y1 - y0) / 5);
          const rear = [p(x0, y0, 0.023), p(x1, y0, 0.023), p(x1, y1, 0.023), p(x0, y1, 0.023)];
          const front = [
            p(x0 + inset, y0 + inset, dep),
            p(x1 - inset, y0 + inset, dep),
            p(x1 - inset, y1 - inset, dep),
            p(x0 + inset, y1 - inset, dep),
          ];
          surface(out, slot, front, s.normal, color);
          for (let q = 0; q < 4; q++) {
            const next = (q + 1) % 4,
              points = [rear[q], rear[next], front[next], front[q]];
            surface(
              out,
              slot,
              points,
              s.normal,
              color.map((v) => v * 0.91),
            );
          }
        }
      }
    }
  }
  for (const win of holes) aperture(out, s, win, d);
}
function foundation(out, d) {
  const depth = layout.foundationDepth;
  const rings = [depth, -0.24, 0.06].map((y, i) =>
    size([X + (2 - i) * 0.12, Z + (2 - i) * 0.11]).map(([x, z]) => [x, y, z]),
  );
  loft(out, 'bed', rings, tone.lower);
  if (d >= 1) {
    for (const s of [-1, 1])
      for (let j = 0; j < 8; j++) {
        const z = between(-Z, Z, j / 7),
          h = 0.19 + hash(j, s + 1, 0) * 0.2;
        box(
          out,
          'bed',
          [s * X - 0.13, -0.4, z - 0.14],
          [s * X + 0.14, -0.4 + h, z + 0.14],
          tone.worn,
        );
      }
  }
}
function crown(out, d) {
  const y = 24.56;
  for (let i = 0; i < sides.length; i++) {
    const s = sides[i],
      lim = s.half;
    const p = (u, v, w) => s.map(u, v, w);
    const prism = (a, b, lo, hi, deep, slot, color) => {
      const ring = (y) => [p(a, y, 0), p(b, y, 0), p(b, y, deep), p(a, y, deep)];
      const bottom = ring(lo),
        top = ring(hi);
      const oriented =
        normalFor(...bottom)[1] > 0 ? [bottom, top] : [bottom.toReversed(), top.toReversed()];
      loft(out, slot, oriented, color);
    };
    prism(-lim, lim, y, y + 0.36, 0.63, 'rubble', tone.rubble);
    const count = i % 2 === 0 ? 4 : 5;
    for (let j = 0; j < count; j++) {
      const end = j === 0 || j === count - 1,
        u = between(-lim + 0.037, lim - 0.89, j / (count - 1)),
        w = end ? 0.85 : 0.73;
      const h = end ? H - (i % 2 === 0 ? 0 : 0.1 + j * 0.026) : H - 0.34 - hash(i, j, 4) * 0.23;
      prism(u, u + w, y + 0.34, h, 0.67, 'rubble', tone[hash(i, j, 1) > 0.58 ? 'worn' : 'rubble']);
      if (d >= 2) prism(u + 0.035, u + w - 0.035, h - 0.04, h + 0.034, 0.61, 'marble', tone.coping);
    }
  }
  box(out, 'bed', [-X + 0.63, 23.81, -Z + 0.63], [X - 0.63, 24.07, Z - 0.63], tone.roof);
  if (d >= 2)
    for (let i = 1; i < 6; i++) {
      box(
        out,
        'marble',
        [between(-X + 0.68, X - 0.68, i / 6) - 0.018, 24.065, -Z + 0.65],
        [between(-X + 0.68, X - 0.68, i / 6) + 0.018, 24.088, Z - 0.65],
        tone.worn,
      );
    }
}
function northTurret(out, d) {
  const x = -2.52,
    z = -Z,
    y = 11.75;
  box(out, 'marble', [x - 0.61, y, z - 0.55], [x + 0.61, y + 0.31, z + 0.13], tone.lower);
  box(out, 'rubble', [x - 0.6, y + 0.31, z - 0.63], [x + 0.6, y + 1.79, z + 0.13], tone.rubble);
  box(out, 'marble', [x - 0.69, y + 1.72, z - 0.71], [x + 0.69, y + 1.96, z + 0.15], tone.coping);
  if (d >= 1)
    for (const s of [-1, 1]) {
      beam(
        out,
        'marble',
        [x + s * 0.38, y - 0.08, z - 0.06],
        [x + s * 0.38, y + 0.47, z - 0.53],
        0.25,
        0.22,
        tone.worn,
      );
    }
}
function stair(out, d) {
  const y = 0.43,
    z = -Z - 0.91,
    start = 4.72,
    end = 1.37,
    span = start - end,
    top = 5.92;
  const n = d === 0 ? 5 : d === 1 ? 10 : d === 2 ? 16 : 24;
  const stairWidth = 1.16;
  for (const side of [-1, 1]) {
    const edge = z + (side * stairWidth) / 2;
    beam(out, 'timber', [start, y, edge], [end, top, edge], 0.109, 0.24, tone.wood);
    if (d >= 1)
      beam(
        out,
        'timber',
        [start, y + 0.84, edge],
        [end, top + 0.88, edge],
        0.055,
        0.065,
        tone.wood,
      );
    if (d >= 2)
      for (let j = 0; j <= 4; j++) {
        const x = between(start, end, j / 4),
          h = between(y, top, j / 4);
        beam(out, 'timber', [x, h, edge], [x, h + 0.91, edge], 0.054, 0.056, tone.wood);
      }
  }
  for (let i = 0; i < n; i++) {
    const a = between(start, end, (i + 1) / n),
      b = between(y, top, (i + 1) / n);
    box(
      out,
      'timber',
      [a - 0.04, b - 0.065, z - stairWidth / 2],
      [a + span / n + 0.035, b, z + stairWidth / 2],
      tone.wood,
    );
  }
  box(out, 'timber', [-0.36, top - 0.14, -Z - 1.49], [end, top, -Z + 0.17], tone.wood);
}
function build(out, d) {
  foundation(out, d);
  for (let i = 0; i < 4; i++) wall(out, i, d);
  crown(out, d);
  northTurret(out, d);
  stair(out, d);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
export function buildTowerLevel(out, level) {
  const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
  build(out, levels[level]);
}
