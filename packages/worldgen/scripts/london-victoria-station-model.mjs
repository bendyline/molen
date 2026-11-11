/** London Victoria. Separate historic headhouses, hotel, roof halls and raised platforms. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcp/london_victoria_station/layout.json',
      import.meta.url,
    ),
  ),
);
const limestone = { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 };
const metal = { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.13 };
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  stone: limestone,
  hotel: limestone,
  clock: limestone,
  slate: { slot: 'roof', graph: 'slate', roughness: 0.91 },
  zinc: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.12 },
  frame: metal,
  black: metal,
  marquise: metal,
  white: metal,
  green: metal,
  mark: metal,
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  glass: { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.4 },
  clear: {
    slot: 'window',
    localRef: 'palette:#e5f4ff',
    roughness: 0.29,
    metallic: 0.04,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.55],
    doubleSided: true,
  },
};
const palette = {
  brick: [0.49, 0.236, 0.162],
  stone: [0.74, 0.665, 0.536],
  hotel: [0.58, 0.463, 0.315],
  clock: [0.88, 0.882, 0.8],
  slate: [0.186, 0.213, 0.227],
  zinc: [0.47, 0.5, 0.49],
  frame: [0.14, 0.173, 0.165],
  black: [0.045, 0.058, 0.06],
  marquise: [0.107, 0.194, 0.166],
  white: [0.82, 0.838, 0.79],
  green: [0.236, 0.343, 0.287],
  mark: [0.81, 0.66, 0.25],
  paving: [0.43, 0.397, 0.341],
  glass: [0.128, 0.205, 0.246],
  clear: [0.59, 0.73, 0.78],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t,
  range = (n) => Array.from({ length: n }, (_, i) => i);
const tint = (i, j = 0) =>
  0.92 + (((Math.imul(i + 37, 30323) ^ Math.imul(j + 73, 87211)) >>> 7) % 171) / 1080;
function writer(out) {
  return (role, points, dir, tone = 1) => {
    for (let i = 1; i < points.length - 1; i++) {
      const p = [points[0], points[i], points[i + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((a, v, k) => a + v * dir[k], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        role,
        ref,
        p,
        n,
        undefined,
        palette[role].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
function cap(f, role, ring, y) {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix.slice(i, i + 3).map((k) => [ring[k][0], y, ring[k][1]]),
      up,
    );
}
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
const rod = (o, r, a, b, w, d = w) => beam(o, r, a, b, w, d, palette[r]);
function side(a, b, sign = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz),
    n = [(sign * dz) / w, 0, (-sign * dx) / w];
  return {
    w,
    n,
    point: (u, y, d = 0) => [a[0] + (u * dx) / w + d * n[0], y, a[1] + (u * dz) / w + d * n[2]],
  };
}
function panel(f, r, s, a, b, lo, hi, d = 0, tone = 1) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  f(r, [s.point(a, lo, d), s.point(b, lo, d), s.point(b, hi, d), s.point(a, hi, d)], s.n, tone);
}
function band(f, r, s, a, b, lo, hi, from, to) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  const p = [
    [a, from],
    [b, from],
    [b, to],
    [a, to],
  ].map(([u, d]) => {
    const [x, , z] = s.point(u, 0, d);
    return [x, z];
  });
  prism(f, r, { outline: p }, lo, hi, false);
}
function roof(f, role, ring, base, height, tiers) {
  const x = ring.reduce((a, b) => a + b[0], 0) / ring.length,
    z = ring.reduce((a, b) => a + b[1], 0) / ring.length;
  const t =
    tiers === 0
      ? [
          [0, 1],
          [0.83, 0.7],
          [1, 0.55],
        ]
      : [
          [0, 1.025],
          [0.2, 0.952],
          [0.83, 0.77],
          [1, 0.55],
        ];
  const rows = t.map(([y, r]) =>
    ring.map(([a, b]) => [mix(x, a, r), base + y * height, mix(z, b, r)]),
  );
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < ring.length; i++) {
      const a = rows[j - 1],
        b = rows[j],
        k = (i + 1) % ring.length;
      f(role, [a[i], a[k], b[k], b[i]], up, tint(i, j));
    }
  cap(
    f,
    'zinc',
    rows.at(-1).map(([x, , z]) => [x, z]),
    base + height,
  );
}
const radial = (s, u, y, w, h, t, d) => s.point(u + w * Math.cos(t), y + h * Math.sin(t), d);
function window(f, s, u, y, w, h, tier, arched = false) {
  const a = u - w * 0.5,
    b = u + w * 0.5,
    top = y + h;
  if (tier <= 2) {
    panel(f, 'stone', s, a - 0.12, b + 0.12, y - 0.12, top + 0.14, 0.035);
    panel(f, 'glass', s, a, b, y, top, 0.066);
    return;
  }
  const radius = arched ? w * 0.33 : 0,
    spring = top - radius;
  panel(f, 'glass', s, a, b, y, spring, 0.053);
  for (const x of [a, b]) panel(f, 'stone', s, x - 0.1, x + 0.1, y - 0.12, spring + 0.025, 0.145);
  band(f, 'stone', s, a - 0.2, b + 0.2, y - 0.14, y + 0.017, 0.024, 0.24);
  if (arched) {
    const n = tier >= 3 ? 9 : 5;
    for (let j = 0; j < n; j++) {
      const p = (j * Math.PI) / n,
        q = ((j + 1) * Math.PI) / n;
      f(
        'glass',
        [
          s.point(u, spring, 0.054),
          radial(s, u, spring, w * 0.5, radius, p, 0.054),
          radial(s, u, spring, w * 0.5, radius, q, 0.054),
        ],
        s.n,
      );
      f(
        'stone',
        [
          radial(s, u, spring, w * 0.5, radius, p, 0.144),
          radial(s, u, spring, w * 0.5, radius, q, 0.144),
          radial(s, u, spring, w * 0.5 + 0.14, radius + 0.16, q, 0.144),
          radial(s, u, spring, w * 0.5 + 0.14, radius + 0.16, p, 0.144),
        ],
        s.n,
        tint(j),
      );
    }
  } else panel(f, 'stone', s, a - 0.19, b + 0.19, top, top + 0.15, 0.144);
  panel(f, 'frame', s, u - 0.042, u + 0.042, y, spring, 0.084);
  panel(f, 'frame', s, a, b, y + h * 0.54, y + h * 0.54 + 0.052, 0.084);
}
function openings(f, role, s, base, hi, centers, w, tier, depth = 0) {
  const n = [3, 4, 6, 10, 13][tier],
    spring = base + 2.55,
    rise = 1.61;
  let end = 0;
  for (const u of centers) {
    const a = u - w * 0.5,
      b = u + w * 0.5;
    panel(f, role, s, end, a, -2.25, hi, depth);
    for (let i = 0; i < n; i++) {
      const t0 = (Math.PI * (n - i)) / n,
        t1 = (Math.PI * (n - i - 1)) / n;
      const x = u + w * 0.5 * Math.cos(t0),
        y = u + w * 0.5 * Math.cos(t1);
      const lo = spring + rise * Math.sin(t0),
        high = spring + rise * Math.sin(t1);
      f(
        role,
        [
          s.point(x, lo, depth),
          s.point(y, high, depth),
          s.point(y, hi, depth),
          s.point(x, hi, depth),
        ],
        s.n,
      );
      if (tier > 0 && depth === 0) {
        f(
          'stone',
          [
            s.point(x, lo, 0.045),
            s.point(y, high, 0.045),
            s.point(y, high + 0.27, 0.045),
            s.point(x, lo + 0.27, 0.045),
          ],
          s.n,
          tint(i),
        );
        f(
          'stone',
          [
            s.point(x, lo),
            s.point(y, high),
            s.point(y, high - 0.03, -0.49),
            s.point(x, lo - 0.03, -0.49),
          ],
          down,
        );
      }
    }
    if (tier > 0 && depth === 0)
      for (const x of [a, b]) panel(f, 'stone', s, x - 0.14, x + 0.14, base, spring, 0.041);
    end = b;
  }
  panel(f, role, s, end, s.w, -2.25, hi, depth);
}
function clock(f, o, s, x, y, tier) {
  const n = tier >= 2 ? 28 : 12;
  for (const [r, role, d] of [
    [1.38, 'stone', 0.46],
    [1.09, 'clock', 0.54],
  ]) {
    f(
      role,
      range(n).map((i) => radial(s, x, y, r, r, (i * Math.PI * 2) / n, d)),
      s.n,
    );
  }
  for (const [t, d] of [
    [0.56, 0.82],
    [2.27, 0.6],
  ])
    rod(o, 'black', s.point(x, y, 0.577), radial(s, x, y, d, d, t, 0.577), 0.062);
  if (tier >= 2)
    for (const i of range(12)) {
      const a = (i * Math.PI) / 6;
      rod(
        o,
        'black',
        radial(s, x, y, 0.82, 0.82, a, 0.566),
        radial(s, x, y, 0.96, 0.96, a, 0.566),
        0.036,
      );
    }
}
function gable(f, r, s, u, y, w, h, d) {
  const A = s.point(u - w * 0.5, y, d),
    B = s.point(u + w * 0.5, y, d),
    C = s.point(u, y + h, d);
  f(r, [A, B, C], s.n);
  for (const [a, b] of [
    [A, C],
    [C, B],
  ]) {
    f('stone', [a, b, [b[0], b[1] + 0.28, b[2]], [a[0], a[1] + 0.28, a[2]]], s.n);
  }
}
function frontage(f, o, H, tier) {
  const s = side(H.a, H.b),
    { height: hi, depth, base, material: r } = H;
  const wide = s.w > 18,
    width = Math.min(wide ? 5.35 : 3.8, s.w * 0.6),
    centers = H.doors.map((t) => t * s.w);
  openings(f, r, s, base, hi, centers, width, tier);
  if (tier > 0) {
    const rear = side(
      s.point(0, 0, -depth).filter((_, i) => i !== 1),
      s.point(s.w, 0, -depth).filter((_, i) => i !== 1),
      -1,
    );
    openings(f, r, rear, base, hi, centers, width, tier);
  } else openings(f, r, s, base, hi, centers, width, tier, -depth);
  for (const i of [0, s.w]) {
    f(
      r,
      [s.point(i, -2.25), s.point(i, -2.25, -depth), s.point(i, hi, -depth), s.point(i, hi)],
      [i === 0 ? -1 : 1, 0, 0],
    );
  }
  const ring = [
    [0, 0.04],
    [s.w, 0.04],
    [s.w, -depth - 0.04],
    [0, -depth - 0.04],
  ].map(([x, d]) => {
    const [a, , b] = s.point(x, 0, d);
    return [a, b];
  });
  if (r === 'brick') roof(f, 'slate', ring, hi, 5.4, tier);
  else cap(f, 'zinc', ring, hi);
  const u = s.w * 0.51;
  if (H.clock) {
    const to = hi + 2.0,
      lo = base + 4.3;
    panel(f, 'stone', s, u - 3.65, u + 3.65, lo, to, 0.26);
    gable(f, 'stone', s, u, to, 8.4, 2.65, 0.26);
    clock(f, o, s, u, hi - 0.1, tier);
  } else if (H.pediment) gable(f, 'stone', s, u, hi, 12.7, 2.2, 0.22);
  if (tier === 0) return;
  for (const y of [base + 4.52, hi - 4.1, hi - 0.51]) {
    band(f, 'stone', s, 0, s.w, y, y + 0.28, -0.13, 0.42);
  }
  const bays = Math.max(1, Math.floor(s.w / (tier === 1 ? 5.4 : 3.22)));
  for (let i = 0; i < bays; i++) {
    const x = (s.w * (i + 0.5)) / bays;
    const levels = r === 'brick' ? [7.05, 10.51, 13.8, 17.02] : [7.32, 11.72];
    if (H.clock && Math.abs(x - u) < 4.6) continue;
    for (const [row, y] of levels.entries()) {
      window(
        f,
        s,
        x,
        y,
        Math.min(1.54, (s.w / bays) * 0.67),
        r === 'brick' ? 2.16 : 2.5,
        tier,
        row === 0 || r === 'stone',
      );
    }
    if (r === 'brick') {
      const y = hi + 1.1;
      band(f, 'slate', s, x - 0.79, x + 0.79, y - 0.41, y + 2.29, -2.55, -0.62);
      window(
        f,
        { ...s, point: (u, y, d) => s.point(u, y, d - 1.12) },
        x,
        y,
        1.05,
        1.63,
        tier,
        true,
      );
      if (tier >= 2 && i % 3 === 0)
        band(f, 'stone', s, x - 1.64, x - 1.19, hi + 2.0, hi + 5.82, -2.25, -1.6);
    }
    if (tier >= 2 && i % 3 === 0)
      band(f, 'stone', s, x - 1.31, x - 0.99, base + 4.58, hi - 0.59, -0.04, 0.23);
  }
  if (H.pediment && tier >= 2) {
    const x = u,
      y = hi - 1.25;
    band(f, 'stone', s, x - 5.65, x + 5.65, y - 0.55, y + 0.56, 0.02, 0.31);
    panel(f, 'hotel', s, x - 5.1, x + 5.1, y - 0.39, y + 0.37, 0.324);
    for (const offset of [-4.7, -2.95, 2.95, 4.7])
      band(f, 'stone', s, x + offset - 0.23, x + offset + 0.23, base + 4.3, y - 0.61, -0.13, 0.32);
  }
  if (H.clock && tier >= 2) {
    const centerFace = { ...s, point: (x, y, d) => s.point(x, y, d + 0.265) };
    for (const y of [7.75, 11.8, 15.82]) window(f, centerFace, u, y, 1.79, 2.65, tier, true);
    for (const x of [u - 3.36, u + 3.36])
      band(f, 'stone', s, x - 0.17, x + 0.17, 5.55, hi + 1.74, 0.27, 0.54);
  }
}
function hotel(f, o, tier) {
  const ring = layout.hotel,
    base = -1.48,
    top = 23.1;
  prism(f, 'hotel', { outline: ring }, base, top, false);
  roof(f, 'slate', ring, top, 7.26, tier);
  const cx = -95.17,
    cz = -25.4;
  for (const z of [-59.6, 11.5]) {
    block(f, 'slate', cx, z, 12.6, 12.1, top + 3.4, top + 5.02);
    roof(f, 'slate', rect(cx, z, 12.8, 12.35).outline, top + 5.02, 4.32, tier);
    rod(o, 'green', [cx, top + 9.13, z], [cx, top + 10.57, z], 0.13);
  }
  if (tier === 0) return;
  for (const [i, a] of ring.entries()) {
    const s = side(a, ring[(i + 1) % ring.length]),
      n = Math.floor(s.w / (tier === 1 ? 5.7 : 3.85));
    for (const y of [4.9, 8.67, 12.45, 16.57, 20.21, 22.55]) {
      if (tier === 1 && y > 13 && y < 22) continue;
      band(f, 'stone', s, 0, s.w, y, y + 0.24, -0.13, 0.48);
    }
    for (let j = 0; j < n; j++) {
      const u = (s.w * (j + 0.5)) / n;
      for (const [k, y] of [2.02, 6.14, 9.83, 13.55, 17.21].entries()) {
        if (tier === 1 && k % 2 === 0) continue;
        window(f, s, u, y, 1.64, 2.57, tier, k !== 3);
      }
      if (tier >= 2) {
        const d = s.w > 45 ? -2.15 : -1.42;
        band(f, 'slate', s, u - 0.91, u + 0.91, top + 0.65, top + 3.76, d - 2, d + 0.23);
        window(
          f,
          { ...s, point: (x, y, u) => s.point(x, y, u + d + 0.27) },
          u,
          top + 1.03,
          1.21,
          2.22,
          tier,
          true,
        );
      }
      if (tier >= 3)
        for (const v of [u - 0.84, u + 0.84])
          band(f, 'stone', s, v - 0.1, v + 0.1, 21.01, 22.52, 0.07, 0.46);
    }
  }
}
function marquise(f, o, tier) {
  for (const Q of layout.square) {
    const [a, b] = [Q.a[0], Q.b[0]],
      { z0, z1, eave: y } = Q,
      mid = (z0 + z1) * 0.5,
      ridge = y + 1.55;
    const rows = [
      [z0, y],
      [mid, ridge],
      [z1, y],
    ];
    for (let j = 1; j < rows.length; j++) {
      const [[z, e], [w, h]] = rows.slice(j - 1, j + 1);
      f(
        'zinc',
        [
          [a, e, z],
          [b, e, z],
          [b, h, w],
          [a, h, w],
        ],
        up,
      );
      if (tier >= 2)
        f(
          'zinc',
          [
            [a, e - 0.06, z],
            [b, e - 0.06, z],
            [b, h - 0.06, w],
            [a, h - 0.06, w],
          ],
          down,
          0.71,
        );
    }
    const bays = Math.max(2, Math.round((b - a) / (tier === 0 ? 15 : 7.5)));
    for (const i of range(bays + 1)) {
      const x = mix(a, b, i / bays);
      rod(o, 'marquise', [x, -1.3, z0 + 0.47], [x, y, z0 + 0.47], tier === 0 ? 0.46 : 0.285);
      if (tier >= 2) {
        rod(o, 'white', [x, y - 0.98, z0 + 0.47], [x + 0.63, y - 0.22, z0 + 0.47], 0.095);
        rod(o, 'marquise', [x, y - 0.16, z0], [x, y - 0.16, z1], 0.16);
      }
    }
    const s = side([a, z0], [b, z0]);
    panel(f, 'white', s, 0, s.w, y - 0.2, y + 0.12);
    if (tier > 0) panel(f, 'marquise', s, 0, s.w, y - 0.46, y - 0.21);
    if (tier >= 2 && b - a > 45) signage(f, s, s.w * 0.52, y - 0.124, tier);
  }
}
const glyphs = {
  L: [4, 4, 4, 4, 7],
  O: [7, 5, 5, 5, 7],
  N: [5, 7, 7, 7, 5],
  D: [6, 5, 5, 5, 6],
  V: [5, 5, 5, 5, 2],
  I: [7, 2, 2, 2, 7],
  C: [7, 4, 4, 4, 7],
  T: [7, 2, 2, 2, 2],
  R: [6, 5, 6, 5, 5],
  A: [2, 5, 7, 5, 5],
  S: [7, 4, 7, 1, 7],
};
function signage(f, s, center, y, tier) {
  const words = 'LONDON VICTORIA STATION',
    pixel = tier >= 3 ? 0.047 : 0.043,
    start = center - words.length * pixel * 2;
  for (let i = 0; i < words.length; i++) {
    const g = glyphs[words[i]];
    if (!g) continue;
    for (let j = 0; j < 5; j++)
      for (let k = 0; k < 3; k++) {
        if (!(g[j] & (1 << (2 - k)))) continue;
        const x = start + (4 * i + k) * pixel,
          v = y + (4 - j) * pixel;
        panel(f, 'black', s, x, x + pixel, v, v + pixel, 0.015);
      }
  }
}
function column(f, o, x, z, base, top, width, tier) {
  if (tier > 1) {
    rod(o, 'frame', [x, base, z], [x, top, z], width);
    return;
  }
  const a = x - width / 2,
    b = x + width / 2;
  for (const sign of [-1, 1])
    f(
      'frame',
      [
        [a, base, z],
        [b, base, z],
        [b, top, z],
        [a, top, z],
      ],
      [0, 0, sign],
    );
}
function barrels(f, o, tier) {
  for (const [h, B] of layout.sheds.entries()) {
    const { x0, x1, z0, z1, eave, rise } = B,
      c = (x0 + x1) * 0.5,
      r = (x1 - x0) * 0.5,
      n = [6, 10, 14, 20, 24][tier];
    const at = (i, z, dy = 0) => {
      const a = (Math.PI * i) / n;
      return [c - r * Math.cos(a), eave + rise * Math.sin(a) + dy, z];
    };
    const grid = tier === 0 ? 1 : tier === 1 ? 5 : tier === 2 ? 10 : 14;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < grid; j++) {
        const a = mix(z0, z1, j / grid),
          b = mix(z0, z1, (j + 1) / grid);
        const glazed =
          tier > 0 &&
          (i === Math.round(n * 0.21) ||
            i === Math.round(n * 0.75) ||
            (tier >= 2 && j < 3 && i % 2 === 0));
        f(
          glazed ? 'clear' : 'zinc',
          [at(i, a), at(i + 1, a), at(i + 1, b), at(i, b)],
          up,
          tint(i, j),
        );
        if (!glazed && tier >= 2)
          f(
            'zinc',
            [at(i, a, -0.065), at(i + 1, a, -0.065), at(i + 1, b, -0.065), at(i, b, -0.065)],
            down,
            0.65,
          );
      }
    for (const z of [z0 + 0.11, z1 - 0.11]) {
      const s = side([x0, z], [x1, z], z < 0 ? 1 : -1);
      for (let i = 0; i < n; i++) {
        const A = at(i, z, -0.27),
          B = at(i + 1, z, -0.27);
        if (tier > 0) f('clear', [[A[0], eave - 0.08, z], A, B, [B[0], eave - 0.08, z]], s.n);
        if (tier >= 3) rod(o, 'frame', A, B, 0.132);
      }
    }
    const bays = [4, 4, 9, 12, 15][tier];
    for (let j = 0; j <= bays; j++) {
      const z = mix(z0 + 0.4, z1 - 0.4, j / bays),
        posts = h ? [31.1, 66.2] : [-9.7, 18.8];
      for (const x of posts) {
        column(f, o, x, z, -1.88, eave - 0.19, tier === 0 ? 0.52 : 0.264, tier);
        if (tier >= 2) block(f, 'stone', x, z, 0.62, 0.61, -1.3, 0.85);
      }
      if (tier <= 1) continue;
      rod(o, 'frame', [x0, eave - 0.28, z], [x1, eave - 0.28, z], 0.19, 0.25);
      const segments = tier === 2 ? 6 : n;
      for (let k = 0; k < segments; k++) {
        const a = (k * n) / segments,
          b = ((k + 1) * n) / segments;
        rod(o, 'frame', at(a, z, -0.25), at(b, z, -0.25), 0.131);
        if (tier >= 3 && k % 2 === 0) {
          const [x] = at(a, z);
          rod(o, 'frame', [x, eave - 0.27, z], at(b, z, -0.29), 0.094);
        }
      }
      if (tier >= 2 && j % 2 === 0)
        for (const k of [2, n - 2])
          rod(o, 'frame', at(k, z, -0.26), at(k, Math.min(z + 8, z1), -0.26), 0.1);
    }
  }
}
function westSheds(f, o, tier) {
  const { x0, x1, z0, z1, count, eave, rise } = layout.sawtooth,
    width = (x1 - x0) / count;
  for (const i of range(count)) {
    const a = x0 + i * width,
      b = a + width,
      m = mix(a, b, 0.68),
      roof0 = z0 + (i === 4 ? 5.3 : 0);
    f(
      'zinc',
      [
        [a, eave, roof0],
        [m, eave + rise, roof0],
        [m, eave + rise, z1],
        [a, eave, z1],
      ],
      up,
      tint(i),
    );
    if (tier >= 2)
      f(
        'zinc',
        [
          [a, eave - 0.06, roof0],
          [m, eave + rise - 0.06, roof0],
          [m, eave + rise - 0.06, z1],
          [a, eave - 0.06, z1],
        ],
        down,
        0.69,
      );
    f(
      tier === 0 ? 'zinc' : 'clear',
      [
        [m, eave + rise, roof0],
        [b, eave, roof0],
        [b, eave, z1],
        [m, eave + rise, z1],
      ],
      up,
    );
    const bays = [3, 4, 8, 11, 13][tier];
    for (const k of range(bays + 1)) {
      const z = mix(roof0 + 0.5, z1 - 0.4, k / bays);
      const post = [-80.7, -64.2, -49.0, -32.0, -15.8][i];
      column(f, o, post, z, -1.62, eave, tier === 0 ? 0.48 : 0.25, tier);
      if (tier >= 2) {
        rod(o, 'frame', [a, eave - 0.18, z], [b, eave - 0.18, z], 0.17);
        rod(o, 'frame', [a, eave - 0.18, z], [m, eave + rise - 0.17, z], 0.18);
        if (tier >= 2) rod(o, 'frame', [m, eave + rise - 0.17, z], [b, eave - 0.18, z], 0.14);
      }
    }
  }
}
function overbuild(f, o, tier) {
  const { x0, x1, z0, z1, soffit, roof: hi } = layout.overbuild;
  const ring = layout.mall;
  prism(f, 'glass', { outline: ring }, soffit, hi);
  prism(f, 'zinc', { outline: ring }, hi - 0.04, hi + 0.24, false);
  const faces = ring.map((a, i) => side(a, ring[(i + 1) % ring.length])).filter((s) => s.w > 18);

  const rows = tier === 0 ? 3 : tier === 1 ? 5 : 7;
  for (const s of faces) {
    const n = Math.max(3, Math.round(s.w / (tier >= 2 ? 3.68 : 12.0)));
    for (let j = 1; j < rows; j++)
      panel(
        f,
        'frame',
        s,
        0,
        s.w,
        soffit + ((hi - soffit) * j) / rows,
        soffit + ((hi - soffit) * j) / rows + 0.12,
        0.063,
      );
    if (tier >= 1)
      for (let j = 1; j < n; j++) {
        const u = (j * s.w) / n;
        panel(f, 'frame', s, u - 0.083, u + 0.083, soffit + 0.14, hi, 0.062);
      }
  }
  for (const x of [x0 + 2.1, x1 - 1.7]) {
    for (const z of range(tier === 0 ? 2 : 7).map((j) =>
      mix(z0 + 3, z1 - 3, j / (tier === 0 ? 1 : 6)),
    )) {
      rod(o, 'stone', [x, -2.37, z], [x, soffit, z], tier === 0 ? 1.2 : 0.88, 1.4);
    }
  }
  if (tier >= 1) {
    const rows = layout.wing;
    prism(f, 'hotel', { outline: rows }, -2.15, 15.82, false);
    cap(f, 'zinc', rows, 15.82);
    for (let i = 0; i < 6; i++)
      block(f, 'zinc', x0 + 9.2 + i * 10.5, z0 + 43.6, 6.4, 5.4, hi + 0.16, hi + 1.06);
  }
}
function islands(f, o, tier) {
  for (const { knots } of layout.platforms) {
    const rows =
      tier === 0
        ? knots.filter((_, i) => i % 3 === 0 || i === knots.length - 1)
        : tier === 1
          ? knots.filter((_, i) => i % 2 === 0 || i === knots.length - 1)
          : knots;
    for (let i = 1; i < rows.length; i++) {
      const [A, B] = rows.slice(i - 1, i + 1);
      const pt = (k, u, y) => [k.x + u * k.width, k.top + y, k.z];
      f('paving', [pt(A, -0.5, 0), pt(A, 0.5, 0), pt(B, 0.5, 0), pt(B, -0.5, 0)], up);
      if (tier > 0)
        for (const side of [-1, 1]) {
          f(
            'stone',
            [
              pt(A, side * 0.5, 0),
              pt(B, side * 0.5, 0),
              pt(B, side * 0.5, -0.91),
              pt(A, side * 0.5, -0.91),
            ],
            [side, 0, 0],
          );
          if (tier >= 2) {
            f(
              'mark',
              [
                pt(A, side * 0.45, 0.013),
                pt(A, side * 0.47, 0.013),
                pt(B, side * 0.47, 0.013),
                pt(B, side * 0.45, 0.013),
              ],
              up,
            );
          }
        }
      if (tier >= 3 && i % 4 === 2) {
        const x = (A.x + B.x) * 0.5,
          z = (A.z + B.z) * 0.5,
          y = (A.top + B.top) * 0.5;
        rod(o, 'frame', [x - 0.59, y + 0.46, z], [x + 0.59, y + 0.46, z], 0.12, 0.44);
        for (const d of [-0.48, 0.48]) rod(o, 'frame', [x + d, y, z], [x + d, y + 0.44, z], 0.08);
      }
    }
  }
}
export function buildVictoriaLevel(o, level) {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error('Unknown London Victoria LOD ' + level);
  const f = writer(o);
  for (const H of layout.frontages) frontage(f, o, H, tier);
  frontage(f, o, { ...layout.eastWing, material: 'hotel', doors: [] }, tier);
  hotel(f, o, tier);
  marquise(f, o, tier);
  barrels(f, o, tier);
  westSheds(f, o, tier);
  overbuild(f, o, tier);
  islands(f, o, tier);
}
export const buildVictoriaSkyline = (o) => buildVictoriaLevel(o, 'skyline');
export const buildVictoriaDistrict = (o) => buildVictoriaLevel(o, 'district');
export const buildVictoriaStreet = (o) => buildVictoriaLevel(o, 'street');
export const buildVictoriaCloseup = (o) => buildVictoriaLevel(o, 'closeup');
