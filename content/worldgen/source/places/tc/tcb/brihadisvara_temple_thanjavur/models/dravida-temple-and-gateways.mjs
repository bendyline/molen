import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  spire,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../temple-plan.json' with { type: 'json' };

export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  relief: { slot: 'trim', graph: 'stone_granite', roughness: 0.93 },
  paving: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98 },
  dark: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.97 },
};
const red = rgb('a27c61'),
  light = rgb('b89472'),
  shade = rgb('8e6c57'),
  worn = rgb('927c69'),
  dark = rgb('46433f');
const {
  center: [x, z],
  axis: [a, b],
  rings,
} = site;
const F = facade([x, z], [a, b]);
const world = (u, v) => [x + u * a - v * b, z + u * b + v * a];
const ring = (u, v, du, dv) =>
  [
    [u - du, v - dv],
    [u - du, v + dv],
    [u + du, v + dv],
    [u + du, v - dv],
  ].map(([U, V]) => world(U, V));
const box = (out, slot, u0, u1, v0, v1, y0, y1, color) =>
  fbox(out, slot, F, u0, u1, y0, y1, v0, v1, color);
const base = (out, u, v, du, dv, y, h = 0.6) => {
  box(out, 'paving', u - du, u + du, v - dv, v + dv, y - 3.7, y, colorFoot(u));
  box(out, 'stone', u - du, u + du, v - dv, v + dv, y, y + h, shade);
  box(
    out,
    'relief',
    u - du + 0.16,
    u + du - 0.16,
    v - dv + 0.16,
    v + dv - 0.16,
    y + h,
    y + h + 0.27,
    light,
  );
};
const colorFoot = (u) => (u > 160 ? worn : shade);
function faceDetail(out, r, y, h, level, rows = 1) {
  const oriented = outwardRing(r);
  for (let i = 0; i < oriented.length; i++) {
    const f = wallFace(oriented[i], oriented[(i + 1) % oriented.length]);
    if (f.length < 2.5) continue;
    const n = Math.max(1, Math.round(f.length / [6.2, 6.2, 5.1, 3.9][level]));
    for (let j = 0; j < n; j++) {
      const span = f.length / n,
        u = (j + 0.5) * span,
        w = Math.min(span * 0.72, 2.05);
      for (let k = 0; k < rows; k++) {
        const Y = y + (k * h) / rows,
          H = h / rows;
        const tablet = (l, r, lo, hi, depth) => {
          if (level === 3) {
            fbox(out, 'relief', f, l, r, lo, hi, -0.04, depth, light);
          } else {
            quad4(
              out,
              'relief',
              f.P(l, lo, depth),
              f.P(r, lo, depth),
              f.P(r, hi, depth),
              f.P(l, hi, depth),
              light,
            );
          }
        };
        if (level > 1) {
          tablet(u - w * 0.62, u + w * 0.62, Y, Y + 0.27, 0.24);
          tablet(u - w * 0.58, u - w * 0.4, Y + 0.25, Y + H * 0.76, 0.28);
          tablet(u + w * 0.4, u + w * 0.58, Y + 0.25, Y + H * 0.76, 0.28);
        }
        if (level > 1)
          opening(out, f, u, Y + 0.28, w * 0.72, H * 0.57, {
            head: 'pointed',
            glassSlot: 'dark',
            frameSlot: 'relief',
            glass: dark,
            frameWidth: 0,
            sill: false,
            d: 0.045,
            rise: Math.min(H * 0.24, w * 0.34),
          });
        const roof = (d, factor) => [
          f.P(u - w * 0.63, Y + H * 0.73, d),
          f.P(u + w * 0.63, Y + H * 0.73, d),
          f.P(u, Y + H * 0.98, d * factor),
        ];
        const [A, B, C] = roof(0.32, 0.67);
        tri(out, 'relief', A, B, C, light);
      }
    }
  }
}
function stepped(out, u, v, du, dv, y, height, levels, level, gate = false) {
  const r0 = du,
    s0 = dv;
  const parts = levels;
  let previous = [du, dv];
  for (let i = 0; i < parts; i++) {
    const t = i / parts,
      Y = y + t * height,
      h = height / parts;
    const w = r0 * (1 - 0.78 * t),
      d = s0 * (1 - 0.77 * t);
    const r = ring(u, v, w, d);
    extrude(out, 'stone', r, Y, Y + h, i % 4 === 0 ? light : red);
    if (level > 1)
      extrude(out, 'relief', ring(u, v, w + 0.31, d + 0.31), Y + h * 0.11, Y + h * 0.2, light);
    if (level)
      extrude(out, 'relief', ring(u, v, w + 0.25, d + 0.25), Y + h * 0.84, Y + h * 0.96, light);
    if (level && (i > 0 || !gate)) faceDetail(out, r, Y + h * 0.22, h * 0.57, level);
    if (level === 3 && i > 0 && i % 2 === 0) {
      for (const sign of [-1, 1])
        for (const cross of [-1, 1]) {
          const c = world(u + sign * w * 0.79, v + cross * d * 0.79);
          lathe(
            out,
            'relief',
            c,
            [
              [Y + h * 0.18, 0.6, 0.6],
              [Y + h * 0.52, 0.66, 0.66],
              [Y + h * 0.72, 0.32, 0.32],
              [Y + h * 0.81, 0, 0],
            ],
            level === 3 ? 8 : 5,
            light,
          );
        }
    }
    previous = [w, d];
  }
  const cap = world(u, v),
    t = y + height;
  if (gate) {
    box(
      out,
      'relief',
      u - previous[0] * 0.72,
      u + previous[0] * 0.72,
      v - previous[1],
      v + previous[1],
      t,
      t + 0.42,
      light,
    );
    const n = 5;
    for (let i = 0; i < n; i++) {
      const c = world(u, v + (i - (n - 1) / 2) * previous[1] * 0.46);
      lathe(
        out,
        'relief',
        c,
        [
          [t + 0.42, 0.29, 0.29],
          [t + 0.76, 0.37, 0.37],
          [t + 1.29, 0, 0],
        ],
        level > 1 ? 8 : 5,
        light,
      );
    }
  } else {
    const f = level > 1 ? 16 : 8;
    lathe(
      out,
      'relief',
      cap,
      [
        [t, 4.03, 4.03],
        [t + 0.53, 4.1, 4.1],
        [t + 1.18, 3.3, 3.3],
        [t + 2.43, 3.25, 3.25],
        [t + 3.93, 2.48, 2.48],
        [t + 4.7, 1.1, 1.1],
        [t + 5.23, 0.43, 0.43],
        [t + 5.96, 0.44, 0.44],
        [t + 6.28, 0, 0],
      ],
      f,
      light,
    );
  }
}
function sanctuary(out, level) {
  const foot = rings.main,
    hall = rings.hall,
    y = 3.62;
  extrude(out, 'paving', foot, -1.75, y, shade);
  extrude(out, 'relief', foot, y, y + 0.54, light);
  extrude(out, 'stone', ring(-0.2, 0.22, 12.8, 12.84), y + 0.54, y + 8.2, red);
  extrude(out, 'relief', ring(-0.2, 0.22, 13.04, 13.05), y + 8.14, y + 8.75, light);
  stepped(out, 0, 0.16, 12.1, 12.37, y + 8.74, 47.06, 13, level);
  extrude(out, 'stone', hall, y + 0.54, y + 6.2, red);
  extrude(out, 'relief', hall, y + 6.18, y + 6.53, light);
  box(out, 'paving', 21, 64, -10.98, 11.58, y + 6.52, y + 7.45, worn);
  box(out, 'stone', 11, 19.23, -7.42, 8.23, y + 0.54, y + 16.5, red);
  stepped(out, 15.17, 0.4, 4.65, 7.85, y + 15.8, 4.7, 3, Math.max(0, level - 1), true);
  if (level) {
    faceDetail(out, ring(-0.2, 0.22, 12.8, 12.84), y + 1, y + 6.87 - (y + 1), level, 2);
    faceDetail(out, hall, y + 1.2, 4.7, level);
    faceDetail(out, ring(15.11, 0.4, 4.08, 7.81), y + 7.7, 7.1, level, 2);
  }
  for (let i = 0; i < 9; i++) {
    const u = 74 + i * 1.15,
      h = y + 0.55 - (i + 0.5) * 0.42;
    box(out, 'paving', u, u + 1.19, -2.91, 0.83, -0.32, h, worn);
    if (level > 1)
      for (const v of [-3.15, 1.1])
        box(out, 'relief', u, u + 1.14, v - 0.22, v + 0.22, h - 0.18, h + 0.6, light);
  }
}
function gateway(out, u, v, du, dv, y, inner, level) {
  const path = 2.44;
  for (const sign of [-1, 1]) {
    const [from, to] = sign < 0 ? [v - dv, v - path] : [v + path, v + dv];
    box(out, 'paving', u - du, u + du, from, to, y - 3.35, y + 0.48, worn);
    box(
      out,
      'stone',
      u - du + 0.1,
      u + du - 0.1,
      from + 0.095,
      to - 0.095,
      y + 0.48,
      y + 5.06,
      red,
    );
  }
  box(out, 'stone', u - du, u + du, v - dv, v + dv, y + 4.88, y + 5.48, shade);
  box(
    out,
    'relief',
    u - du - 0.17,
    u + du + 0.17,
    v - dv - 0.18,
    v + dv + 0.18,
    y + 5.41,
    y + 6.06,
    light,
  );
  stepped(out, u, v, 4.08, 8.13, y + 6.04, inner ? 14.66 : 18.68, inner ? 6 : 7, level, true);
  if (level) {
    for (const sign of [-1, 1]) {
      const V = v + sign * (dv + path) * 0.5;
      faceDetail(out, ring(u, V, du - 0.1, (dv - path) * 0.5 - 0.1), y + 0.81, 3.72, level);
    }
  }
  for (let i = 0; i < 3; i++) {
    box(
      out,
      'paving',
      u + du + i * 0.55,
      u + du + (i + 1) * 0.55,
      v - path,
      v + path,
      y - 0.79,
      y + 0.36 - 0.16 * i,
      worn,
    );
  }
}
function gallerySpan(out, u0, u1, v0, v1, across, elevation, level) {
  const span = across ? u1 - u0 : v1 - v0,
    y = elevation;
  const panel = across
    ? (l, r, w, W, Y, H, s, c) => box(out, s, u0 + l, u0 + r, v0 + w, v0 + W, Y, H, c)
    : (l, r, w, W, Y, H, s, c) => box(out, s, u0 + w, u0 + W, v0 + l, v0 + r, Y, H, c);
  const depth = across ? v1 - v0 : u1 - u0;
  const outerAtLow = across ? v0 < 0 : u0 < 0;
  const outer = outerAtLow ? 0 : depth - 0.67;
  const inner = outerAtLow ? depth - 2.04 : 1.38;
  panel(0, span, 0, depth, y - 2.3, y + 0.21, 'paving', worn);
  panel(0, span, outer, outer + 0.67, y, y + 5.3, 'stone', shade);
  panel(0, span, 0, depth, y + 4.36, y + 4.96, 'stone', red);
  panel(0, span, 0, depth, y + 4.96, y + 5.24, 'relief', light);
  const count = Math.max(1, Math.round(span / (level > 1 ? 3.72 : 7.6))),
    segment = span / count;
  for (let i = 0; i <= count; i++) {
    const k = i * segment,
      L = Math.max(0, k - 0.27),
      R = Math.min(span, k + 0.27);
    panel(L, R, inner, inner + 0.63, y + 0.18, y + 4.35, 'relief', light);
    if (level === 3) {
      panel(
        Math.max(0, L - 0.14),
        Math.min(span, R + 0.14),
        inner - 0.17,
        inner + 0.81,
        y + 3.73,
        y + 4.06,
        'relief',
        red,
      );
      panel(
        Math.max(0, L - 0.13),
        Math.min(span, R + 0.13),
        inner - 0.13,
        inner + 0.79,
        y + 0.18,
        y + 0.51,
        'stone',
        shade,
      );
    }
  }
  if (level > 1)
    for (let i = 0; i < count; i++) {
      const l = i * segment,
        r = l + segment,
        mid = (l + r) / 2;
      const p = (u, Y) => (across ? F.P(u0 + u, Y, v0 + inner) : F.P(u0 + inner, Y, v0 + u));
      const A = p(l + 0.29, y + 3.48),
        B = p(mid, y + 4.28),
        C = p(r - 0.29, y + 3.48),
        D = p(l + 0.29, y + 4.36),
        E = p(r - 0.29, y + 4.36);
      for (const [P, Q, R] of [
        [A, B, D],
        [B, E, D],
        [B, C, E],
      ]) {
        tri(out, 'relief', P, Q, R, light);
        tri(out, 'relief', P, R, Q, light);
      }
    }
}
function court(out, level) {
  gallerySpan(out, -60.38, 181.67, -62.26, -56.14, true, 0.2, level);
  gallerySpan(out, -61.02, 181.96, 53.47, 59.41, true, -0.71, level);
  gallerySpan(out, -61.0, -53.56, -56.15, 53.47, false, 1.08, level);
  gallerySpan(out, 174.85, 181.73, -56.14, -14.88, false, -0.05, level);
  gallerySpan(out, 174.13, 181.87, 10.62, 53.49, false, 0.44, level);
  gateway(out, 177.39, -2.17, 8.11, 12.82, -0.11, true, level);
  gateway(out, 249.35, -2.35, 8.75, 14.8, 1.26, false, level);
}
function pavilion(out, u, v, du, dv, y, height, level, id) {
  const outline = rings[id];
  if (id === 'nandi') {
    base(out, u, v, du, dv, y, 1.02);
    for (const U of [-0.77, 0, 0.77])
      for (const V of [-0.77, 0.77]) {
        const x = u + U * du,
          z = v + V * dv;
        box(out, 'relief', x - 0.36, x + 0.36, z - 0.36, z + 0.36, y + 1.25, y + 5.84, light);
        box(out, 'relief', x - 0.52, x + 0.52, z - 0.54, z + 0.54, y + 5.38, y + 5.84, red);
      }
    box(out, 'stone', u - du, u + du, v - dv, v + dv, y + 5.84, y + 6.37, red);
    box(
      out,
      'relief',
      u - du + 0.4,
      u + du - 0.4,
      v - dv + 0.4,
      v + dv - 0.4,
      y + 6.35,
      y + 7.0,
      light,
    );
    const c = world(u - 0.9, v);
    lathe(
      out,
      'dark',
      c,
      [
        [y + 1.36, 1.95, 1.24],
        [y + 1.71, 2.19, 1.26],
        [y + 2.39, 1.84, 1.09],
        [y + 2.9, 1.21, 0.87],
        [y + 3.28, 0.59, 0.49],
        [y + 3.48, 0.1, 0.1],
      ],
      level > 1 ? 12 : 8,
      dark,
      { rotation: Math.atan2(b, a) },
    );
    const head = world(u + 1.41, v);
    lathe(
      out,
      'dark',
      head,
      [
        [y + 2.03, 0.46, 0.57],
        [y + 2.65, 0.63, 0.65],
        [y + 3.11, 0.46, 0.48],
        [y + 3.31, 0.04, 0.04],
      ],
      8,
      dark,
    );
    for (const sign of [-1, 1])
      spire(out, 'relief', world(u + 1.26, v + sign * 0.45), 0.14, 6, y + 3.01, 0.47, worn);
    return;
  }
  extrude(out, 'paving', outline, y - 2.76, y + 0.64, worn);
  extrude(out, 'stone', outline, y + 0.63, y + height - 1.04, red);
  extrude(out, 'relief', outline, y + height - 1.41, y + height - 0.66, light);
  extrude(out, 'paving', outline, y + height - 0.67, y + height - 0.51, worn);
  if (level) faceDetail(out, outline, y + 0.75, height - 2.19, level);
  if (id === 'amman')
    stepped(out, 102.84, -20.9, 4.14, 5.19, y + height - 0.65, 5.09, 4, level, true);
}
function architecturalCaps(out) {
  return {
    ...out,
    addCap(slot, ref, outline, holes, height, normal, uv, color) {
      const triangulator = new MeshBufferBuilder();
      if (!triangulator.addCap('wall', ref, outline, holes, height, normal, uv, color))
        return false;
      const { indices, positions } = triangulator.finalize();
      for (let i = 0; i < indices.length; i += 3) {
        const points = [0, 1, 2].map((offset) => {
          const start = indices[i + offset] * 3;
          return [...positions.subarray(start, start + 3)];
        });
        tri(out, slot, ...points, color);
      }
      return true;
    },
  };
}
function build(target, level) {
  const out = architecturalCaps(target);
  sanctuary(out, level);
  court(out, level);
  pavilion(out, 119.2, -0.89, 6.02, 6.08, 0.63, 8, level, 'nandi');
  pavilion(out, 101.3, -30, 6.0, 12.0, 0.62, 6.1, level, 'amman');
  pavilion(out, 150.25, -42.4, 4.82, 7.98, 0.07, 5.8, level, 'natarajar');
  pavilion(out, 9.45, -27.98, 3.1, 5.1, 2.61, 5.85, level, 'perumal');
  pavilion(out, -33.1, -33.0, 4.0, 6.3, 2.09, 5.66, level, 'karuvarur');
  for (const [id, height] of [
    ['pillar', 11.88],
    ['moon', 2.74],
    ['sun', 2.68],
  ]) {
    const r = rings[id],
      y = id === 'pillar' ? 2.45 : 3.21;
    extrude(out, 'paving', r, y - 1.7, y + 0.41, shade);
    extrude(out, 'relief', r, y + 0.41, y + height, light);
  }
}
export function buildSkyline(target) {
  const out = architecturalCaps(target);
  extrude(out, 'paving', rings.main, -1.75, 4.16, shade);
  extrude(out, 'stone', ring(-0.2, 0.22, 12.8, 12.84), 4.16, 12.37, red);
  stepped(out, 0, 0.16, 12.1, 12.37, 12.36, 47.06, 13, 0);
  extrude(out, 'stone', rings.hall, 4.16, 10.65, red);
  box(out, 'stone', 11, 19.23, -7.42, 8.23, 4.16, 20.36, red);

  for (const [u, v, du, dv, y, inner] of [
    [177.39, -2.17, 8.11, 12.82, -0.11, true],
    [249.35, -2.35, 8.75, 14.8, 1.26, false],
  ]) {
    box(out, 'stone', u - du, u + du, v - dv, v - 2.44, y - 2.3, y + 5.08, red);
    box(out, 'stone', u - du, u + du, v + 2.44, v + dv, y - 2.3, y + 5.08, red);
    box(out, 'stone', u - du, u + du, v - dv, v + dv, y + 5.08, y + 6.04, light);
    stepped(out, u, v, 4.08, 8.13, y + 6.04, inner ? 14.66 : 18.68, inner ? 6 : 7, 0, true);
  }
  for (const [u, U, v, V, y] of [
    [-60.38, 181.67, -62.26, -56.14, 0.2],
    [-61.02, 181.96, 53.47, 59.41, -0.71],
    [-61.0, -53.56, -56.15, 53.47, 1.08],
    [174.85, 181.73, -56.14, -14.88, -0.05],
    [174.13, 181.87, 10.62, 53.49, 0.44],
  ])
    box(out, 'paving', u, U, v, V, y - 2.3, y + 5.24, worn);
  for (const [id, y, h] of [
    ['nandi', 0.63, 7],
    ['amman', 0.62, 9.8],
    ['natarajar', 0.07, 5.4],
    ['perumal', 2.61, 5.4],
    ['karuvarur', 2.09, 5.2],
  ])
    extrude(out, 'stone', rings[id], y - 2.5, y + h, red);
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
