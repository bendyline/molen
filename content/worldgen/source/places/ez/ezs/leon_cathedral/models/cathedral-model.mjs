/** León Cathedral and its connected open cloister, fitted to the mapped site. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const cathedralSurfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone' },
  trim: { slot: 'trim', graph: 'stone_limestone_raw' },
  granite: { slot: 'foundation', graph: 'stone_limestone_weathered' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  slate: { slot: 'roof', graph: 'slate' },
  glass: { slot: 'trim', graph: 'metal_painted' },
  wood: { slot: 'door', graph: 'wood_plain' },
};
const tierOf = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const tints = {
  wall: 'd5c4a9',
  light: 'e0d3bb',
  cap: 'e7dbc4',
  ash: 'b6a48b',
  base: 'a99c86',
  tile: 'a27560',
  tileLight: 'b48169',
  slate: '72767a',
  dark: '373b3d',
  blue: '526273',
  brown: '514c45',
  teal: '506669',
  glassLight: '6d7064',
  wood: '63534a',
  copper: '6c766a',
};
const C = Object.fromEntries(
  Object.entries(tints).map(([name, hex]) => [
    name,
    hex.match(/../g).map((pair) => {
      const s = parseInt(pair, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const around = (r) => r.map((a, i) => [a, r[(i + 1) % r.length]]);
const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const at = (p, y) => [p[0], y, p[1]];
const center = (r) => r.reduce((a, p) => a.map((n, i) => n + p[i] / r.length), [0, 0]);
const area = (r) => around(r).reduce((s, [[x, z], [u, v]]) => s + x * v - u * z, 0);
const positive = (r) => (area(r) > 0 ? r : r.toReversed());
const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const transform = (r, c, s) => r.map((p) => blend(c, p, s));
const keep = (r, tier) =>
  tier ? r : r.filter((_, i) => i === 0 || i === r.length - 1 || i % 3 === 0);

function face(out, slot, tone, points, outward) {
  const n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * outward[i], 0) < 0) points = points.toReversed();
  const tris =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (const tri of tris) out.addTriangle(slot, ref, tri, normalFor(...tri), undefined, C[tone]);
}
function frame(a, b) {
  const l = length(a, b),
    dx = (b[0] - a[0]) / l,
    dz = (b[1] - a[1]) / l;
  return {
    length: l,
    normal: [dz, 0, -dx],
    right: [dx, 0, dz],
    point: (u, y, w = 0) => [a[0] + dx * u + dz * w, y, a[1] + dz * u - dx * w],
  };
}
function panel(out, f, slot, tone, a, b, y0, y1, w = 0) {
  if (b - a < 1e-5 || y1 - y0 < 1e-5) return;
  face(
    out,
    slot,
    tone,
    [f.point(a, y0, w), f.point(b, y0, w), f.point(b, y1, w), f.point(a, y1, w)],
    f.normal,
  );
}
function cap(out, slot, tone, r, y) {
  const ids = earcut(r.flat(), undefined, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      out,
      slot,
      tone,
      ids.slice(i, i + 3).map((j) => at(r[j], y)),
      [0, 1, 0],
    );
}
function shell(out, slot, tone, r, low, high, { top = false } = {}) {
  for (const [a, b] of around(r)) {
    const f = frame(a, b);
    panel(out, f, slot, tone, 0, f.length, low, high);
  }
  if (top) cap(out, slot, tone, r, high);
}
function band(out, r, rows, tone, slot = 'stone') {
  const c = center(r);
  for (let j = 1; j < rows.length; j++) {
    const [a, y] = rows[j - 1],
      [b, z] = rows[j];
    const lower = transform(r, c, a),
      upper = transform(r, c, b);
    for (let i = 0; i < r.length; i++) {
      const k = (i + 1) % r.length,
        f = frame(r[i], r[k]);
      face(
        out,
        slot,
        tone,
        [at(lower[i], y), at(lower[k], y), at(upper[k], z), at(upper[i], z)],
        [f.normal[0], a >= b ? 0.35 : -0.35, f.normal[2]],
      );
    }
  }
}
function trim(out, f, y, width = 0.23, depth = 0.3) {
  beam(out, 'trim', f.point(0, y, depth / 2), f.point(f.length, y, depth / 2), depth, width, C.cap);
}
function block(out, f, slot, tone, a, b, y0, y1, d) {
  const r = positive(
    [f.point(a, y0, -0.03), f.point(b, y0, -0.03), f.point(b, y0, d), f.point(a, y0, d)].map(
      ([x, , z]) => [x, z],
    ),
  );
  shell(out, slot, tone, r, y0, y1, { top: true });
}

function pointed(u, y, r, h, count) {
  const k = 0.57,
    scale = Math.sqrt(1 - Math.pow(k / (1 + k), 2));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = -Math.cos((Math.PI * i) / count),
      v = (Math.abs(t) + k) / (1 + k);
    return [u + r * t, y + (h * Math.sqrt(Math.max(0, 1 - v * v))) / scale];
  });
}
function archMould(out, f, u, y, r, h, w, step, n, tone = 'light') {
  const a = pointed(u, y, r, h, n),
    b = pointed(u, y, r + step, h + step, n);
  for (let i = 1; i < a.length; i++)
    face(
      out,
      'trim',
      tone,
      [a[i - 1], a[i], b[i], b[i - 1]].map((p) => f.point(...p, w)),
      f.normal,
    );
}
function pointedFill(out, f, slot, tone, u, r, base, spring, rise, w, n) {
  panel(out, f, slot, tone, u - r, u + r, base, spring, w);
  const a = pointed(u, spring, r, rise, n),
    p = f.point(u, spring, w);
  for (let i = 1; i < a.length; i++)
    face(out, slot, tone, [p, f.point(...a[i - 1], w), f.point(...a[i], w)], f.normal);
}
function arcade(out, f, doors, top, back, tier, { recess = true, base = -3.7 } = {}) {
  let last = 0;
  const n = [2, 4, 8, 12, 16][tier];
  for (const p of doors) {
    const { u, radius: r, threshold, spring, rise } = p,
      l = u - r,
      b = u + r;
    panel(out, f, 'stone', 'wall', last, l, base, top);
    panel(out, f, 'granite', 'base', l, b, base, threshold);
    const arch = pointed(u, spring, r, rise, n);
    for (let i = 1; i < arch.length; i++) {
      const [a, c] = [arch[i - 1], arch[i]];
      face(
        out,
        'stone',
        'wall',
        [f.point(...a), f.point(...c), f.point(c[0], top), f.point(a[0], top)],
        f.normal,
      );
      if (recess || tier >= 2)
        face(
          out,
          'trim',
          'ash',
          [f.point(...a), f.point(...c), f.point(...c, back), f.point(...a, back)],
          [0, -1, 0],
        );
    }
    for (const side of [-1, 1]) {
      const v = u + side * r;
      if (recess || tier >= 2)
        face(
          out,
          'trim',
          'ash',
          [
            f.point(v, threshold),
            f.point(v, spring),
            f.point(v, spring, back),
            f.point(v, threshold, back),
          ],
          f.right.map((q) => -q * side),
        );
    }
    if (tier && (recess || tier >= 2)) archMould(out, f, u, spring, r, rise, 0.09, 0.21, n);
    if (tier >= 2 && recess) {
      for (const [i, d] of [0.31, 0.5, 0.68].entries())
        archMould(
          out,
          f,
          u,
          spring,
          r + d,
          rise + d,
          0.07 + 0.06 * i,
          0.13,
          n,
          i % 2 ? 'cap' : 'light',
        );
      for (const sign of [-1, 1])
        block(
          out,
          f,
          'trim',
          'light',
          u + sign * (r + 0.33) - 0.12,
          u + sign * (r + 0.33) + 0.12,
          threshold,
          spring,
          0.2,
        );
    }
    if (recess) {
      pointedFill(out, f, 'wood', 'wood', u, r, threshold, spring, rise, back, n);
      face(
        out,
        'granite',
        'base',
        [
          f.point(l, threshold, back),
          f.point(b, threshold, back),
          f.point(b, threshold, 0.24),
          f.point(l, threshold, 0.24),
        ],
        [0, 1, 0],
      );
      if (tier >= 3) {
        block(out, f, 'trim', 'light', u - 0.115, u + 0.115, threshold + 0.05, spring - 0.04, 0.18);
        const statue = f.point(u, threshold + 1.52, 0.33);
        beam(out, 'trim', f.point(u, threshold + 0.72, 0.33), statue, 0.38, 0.29, C.light);
        sphere(out, 'trim', f.point(u, threshold + 1.83, 0.36), [0.13, 0.16, 0.13], C.light, 6, 5);
      }
    }
    last = b;
  }
  panel(out, f, 'stone', 'wall', last, f.length, base, top);
}

function lancet(out, f, u, base, height, width, tier, tone = 'blue', w = 0.035) {
  const radius = width * 0.5,
    spring = base + height * 0.69,
    rise = height * 0.31,
    n = [2, 4, 6, 8, 12][tier];
  pointedFill(out, f, 'glass', tone, u, radius, base, spring, rise, w, n);
  if (tier < 2) return;
  archMould(out, f, u, spring, radius, rise, w + 0.025, tier >= 2 ? 0.17 : 0.12, n);
  if (tier >= 2) {
    for (const p of [u - radius, u + radius])
      beam(
        out,
        'trim',
        f.point(p, base, w + 0.08),
        f.point(p, spring, w + 0.08),
        0.13,
        0.15,
        C.light,
      );
    beam(
      out,
      'trim',
      f.point(u - radius - 0.13, base, w + 0.1),
      f.point(u + radius + 0.13, base, w + 0.1),
      0.24,
      0.18,
      C.cap,
    );
    beam(
      out,
      'trim',
      f.point(u, base, w + 0.085),
      f.point(u, spring + rise * 0.62, w + 0.085),
      0.1,
      0.105,
      C.ash,
    );
    if (tier >= 3)
      for (const q of [0.34, 0.63])
        beam(
          out,
          'glass',
          f.point(u - radius, base + height * q, w + 0.052),
          f.point(u + radius, base + height * q, w + 0.052),
          0.05,
          0.064,
          C.dark,
        );
  }
}

function rose(out, f, u, y, r, tier) {
  const n = [8, 12, 18, 24, 32][tier],
    w = 0.095;
  const point = (i, r) => [
    u + r * Math.cos((Math.PI * 2 * i) / n),
    y + r * Math.sin((Math.PI * 2 * i) / n),
  ];
  for (let i = 0; i < n; i++) {
    const a = point(i, r),
      b = point(i + 1, r),
      c = point(i + 1, r + 0.3),
      d = point(i, r + 0.3);
    face(
      out,
      'glass',
      tier >= 2 ? ['blue', 'blue', 'teal', 'blue'][i % 4] : 'dark',
      [f.point(u, y, w), f.point(...a, w), f.point(...b, w)],
      f.normal,
    );
    if (tier)
      face(
        out,
        'trim',
        'light',
        [a, b, c, d].map((p) => f.point(...p, w + 0.055)),
        f.normal,
      );
  }
  if (!tier) return;
  const spokes = tier === 1 ? 8 : tier === 2 ? 12 : 16;
  for (let i = 0; i < spokes; i++) {
    const theta = (Math.PI * 2 * i) / spokes;
    const p = (r, a = 0) =>
      f.point(u + r * Math.cos(theta + a), y + r * Math.sin(theta + a), w + 0.1);
    if (tier === 1)
      face(
        out,
        'trim',
        'light',
        [p(r * 0.12, -0.09), p(r * 0.86, -0.023), p(r * 0.86, 0.023), p(r * 0.12, 0.09)],
        f.normal,
      );
    else beam(out, 'trim', p(r * 0.16), p(r * 0.85), r * 0.027, r * 0.033, C.light);
    if (tier === 2)
      beamPath(
        out,
        'trim',
        [p(r * 0.59, -0.125), p(r * 0.8), p(r * 0.59, 0.125)],
        r * 0.026,
        r * 0.029,
        C.cap,
      );
    if (tier >= 3)
      beamPath(
        out,
        'trim',
        [
          p(r * 0.42),
          p(r * 0.56, -0.12),
          p(r * 0.77, -0.13),
          p(r * 0.89),
          p(r * 0.77, 0.13),
          p(r * 0.56, 0.12),
        ],
        r * 0.023,
        r * 0.027,
        C.cap,
        true,
      );
  }
  if (tier === 1) return;
  const hub = Array.from({ length: 12 }, (_, i) => {
    const v = (Math.PI * 2 * i) / (tier >= 2 ? 12 : 8);
    return f.point(u + r * 0.17 * Math.cos(v), y + r * 0.17 * Math.sin(v), w + 0.11);
  });
  beamPath(out, 'trim', hub, r * 0.037, r * 0.038, C.cap, true);
}

function gabledRoof(out, r, eave, peak, axis, includeGables = true) {
  const [a, b, c, d] = r,
    side =
      axis === 'x'
        ? [
            [a, d],
            [b, c],
          ]
        : [
            [a, b],
            [d, c],
          ];
  const [l, h] = side.map(([p, q]) => blend(p, q, 0.5));
  for (const i of [0, 1])
    face(
      out,
      'tile',
      i ? 'tileLight' : 'tile',
      [at(side[0][i], eave), at(side[1][i], eave), at(h, peak), at(l, peak)],
      [0, 1, 0],
    );
  if (!includeGables) return;
  for (const [i, ends] of side.entries()) {
    const mid = i ? h : l,
      normal = axis === 'x' ? [i ? 1 : -1, 0, 0] : [0, 0, i ? 1 : -1];
    face(out, 'stone', 'light', [at(ends[0], eave), at(ends[1], eave), at(mid, peak)], normal);
  }
}

function largeGable(out, f, base, peak, tier, { roseY, radius, lower }) {
  const l = f.length,
    u = l / 2;
  panel(out, f, 'stone', 'light', 0, l, lower, base);
  face(out, 'stone', 'light', [f.point(0, base), f.point(l, base), f.point(u, peak)], f.normal);
  rose(out, f, u, roseY, radius, tier);
  if (!tier) return;
  trim(out, f, base - 0.25, 0.38, 0.42);
  beam(out, 'trim', f.point(0, base, 0.18), f.point(u, peak, 0.18), 0.38, 0.44, C.light);
  beam(out, 'trim', f.point(u, peak, 0.18), f.point(l, base, 0.18), 0.38, 0.44, C.light);
  if (tier >= 2) {
    lancet(out, f, u, base + 1.05, peak - base - 2.05, 2.15, tier, 'dark', 0.08);
    for (const a of [l * 0.18, l * 0.34, l * 0.5, l * 0.66, l * 0.82])
      lancet(out, f, a, lower + 1.0, Math.min(4.8, roseY - radius - lower - 1.46), 1.22, tier);
  }
}

function pinnacle(out, x, z, y, height, w, tier) {
  const r = rectangle(x - w / 2, x + w / 2, z - w / 2, z + w / 2);
  if (tier < 2) {
    for (const [a, b] of around(r))
      face(out, 'trim', 'light', [at(a, y), at(b, y), [x, y + height, z]], frame(a, b).normal);
    return;
  }
  band(
    out,
    r,
    [
      [1, y],
      [0.96, y + height * 0.44],
      [0.64, y + height * 0.6],
      [0.055, y + height],
    ],
    'light',
    'trim',
  );
  if (tier >= 3)
    beam(
      out,
      'trim',
      [x, y + height * 0.96, z],
      [x, y + height + 0.3, z],
      w * 0.11,
      w * 0.11,
      C.cap,
    );
}

function tower(out, t, tier) {
  const r = t.ring,
    c = center(r),
    north = t.name === 'north',
    start = t.spireStart;
  const levels = tier
    ? [
        [1, 15.8],
        [1, 23.2],
        [0.96, 26.2],
        [0.96, 38.5],
        [0.91, 41.8],
        [0.91, start],
      ]
    : [
        [1, 15.8],
        [0.94, 39.0],
        [0.91, start],
      ];
  band(out, r, levels, 'wall');
  const fns = around(transform(r, c, 0.914)).map(([a, b]) => frame(a, b));
  for (const f of fns) {
    if (north) {
      for (const u of [f.length * 0.33, f.length * 0.67]) {
        lancet(out, f, u, 43.2, 8.3, Math.min(1.82, f.length * 0.24), tier, 'dark');
        if (tier)
          lancet(out, f, u, 33.05, 6.65, Math.min(1.63, f.length * 0.22), tier, 'dark', 0.24);
      }
    } else {
      lancet(out, f, f.length / 2, 42.1, 9.14, Math.min(3.07, f.length * 0.45), tier, 'dark');
      if (tier)
        lancet(
          out,
          f,
          f.length / 2,
          32.7,
          7.4,
          Math.min(2.72, f.length * 0.42),
          tier,
          'dark',
          0.22,
        );
    }
    if (tier) for (const y of [24.9, 39.7, start - 0.75]) trim(out, f, y, 0.31, 0.34);
  }
  const baseR = transform(r, c, north ? 0.67 : 0.77);
  if (north || tier < 2) {
    band(
      out,
      baseR,
      [
        [1, start],
        [0.67, start + 4.3],
        [0.052, t.topY],
      ],
      north ? 'light' : 'slate',
      north ? 'trim' : 'slate',
    );
  } else {
    const corner = [...baseR];
    const perimeter = corner.flatMap((a, i) => [a, blend(a, corner[(i + 1) % 4], 0.5)]);
    const end = at(c, t.topY - 0.25);
    for (const p of perimeter) {
      const a = at(p, start),
        m = at(blend(p, c, 0.45), start + 7.8);
      beamPath(out, 'trim', [a, m, end], tier >= 3 ? 0.37 : 0.5, 0.53, C.light);
    }
    for (const f of [0.26, 0.5, 0.72]) {
      const y = mix(start, t.topY - 0.2, f);
      beamPath(
        out,
        'trim',
        perimeter.map((p) => at(blend(p, c, f), y)),
        0.3,
        0.4,
        C.light,
        true,
      );
    }
    if (tier >= 3)
      for (const [i, p] of perimeter.entries()) {
        const q = perimeter[(i + 1) % perimeter.length],
          mid = blend(p, q, 0.5);
        for (const [lo, hi] of [
          [0.26, 0.5],
          [0.5, 0.72],
        ]) {
          const low = mix(start, t.topY, lo),
            high = mix(start, t.topY, hi);
          beamPath(
            out,
            'trim',
            [at(blend(p, c, lo), low), at(blend(mid, c, hi), high), at(blend(q, c, lo), low)],
            0.16,
            0.17,
            C.light,
          );
        }
      }
    band(
      out,
      baseR,
      [
        [0.53, start + 0.3],
        [0.08, t.topY - 2.1],
      ],
      'slate',
      'slate',
    );
  }
  if (tier) {
    for (const [x, z] of transform(r, c, 0.94)) {
      pinnacle(out, x, z, start - 2.2, north ? 7.3 : 8.4, 1.47, tier);
      const low = blend(c, [x, z], 1.01),
        high = blend(c, [x, z], 0.91);
      beam(out, 'trim', at(low, 16.0), at(high, start - 2.2), 1.03, 0.99, C.light);
    }
    beam(out, 'glass', at(c, t.topY - 0.25), at(c, t.topY + 0.78), 0.13, 0.13, C.copper);
    if (!north) {
      const west = fns.reduce((a, b) => (a.normal[0] < b.normal[0] ? a : b)),
        u = west.length / 2,
        y = 19.7;
      rose(out, { ...west, point: (u, y, w = 0) => west.point(u, y, w + 0.5) }, u, y, 1.02, 0);
      for (const h of [
        [0.55, 0.18],
        [-0.12, 0.68],
      ])
        beam(
          out,
          'trim',
          west.point(u, y, 0.7),
          west.point(u + h[0], y + h[1], 0.7),
          0.075,
          0.08,
          C.cap,
        );
    }
  }
}

function lower(out, tier) {
  const ring = tier ? layout.main : layout.skylineWalls,
    porches = [layout.west, layout.south];
  const isSame = (a, b) => a[0] === b[0] && a[1] === b[1];
  for (const [a, b] of around(ring)) {
    const door = porches.find((p) => isSame(a, p.edge[0]) && isSame(b, p.edge[1]));
    const f = frame(a, b);
    if (door) {
      arcade(out, f, door.portals, door.top, door.back, tier);
      panel(out, f, 'stone', 'wall', 0, f.length, door.top, 16.12);
      if (tier) trim(out, f, door.top - 0.22, 0.39, 0.49);
      continue;
    }
    panel(out, f, 'stone', 'wall', 0, f.length, -3.7, 16.12);
    const p = blend(a, b, 0.5);
    if (tier && f.length > 4.2 && ((p[0] > -32 && p[0] < -12 && p[1] > 7) || p[0] > 29)) {
      lancet(out, f, f.length / 2, 5.8, 7.6, Math.min(2.35, f.length * 0.52), tier, 'dark');
    }
  }
  cap(out, 'tile', 'tileLight', ring, 16.12);
}

function upperChurch(out, tier) {
  const { nave: n, transept: t, choir: c } = layout;
  const wing = ([a, b], bays) => {
    const f = frame(a, b);
    panel(out, f, 'stone', 'wall', 0, f.length, 15.87, 31.1);
    for (const x of tier ? bays : bays.filter((_, i) => i % 2 === 0)) {
      const u = (x - a[0]) / f.right[0];
      lancet(out, f, u, 19.1, 10.65, Math.min(3.75, f.length / (bays.length * 1.44)), tier);
      if (tier >= 2) lancet(out, f, u, 16.8, 1.68, 1.54, tier, 'dark');
    }
    if (tier) trim(out, f, 30.92, 0.29, 0.37);
  };
  for (const a of [n, c]) {
    const x0 = Math.min(a.start, a.end),
      x1 = Math.max(a.start, a.end),
      r = rectangle(x0, x1, a.north, a.south);
    wing([r[0], r[1]], a.bays);
    wing([r[2], r[3]], a.bays);
    gabledRoof(out, r, a.eave, a.ridge, 'x');
  }
  const front = frame([-44.6, 7.27], [-44.6, -10.13]);
  largeGable(out, front, 38.0, 46.6, tier, { roseY: 29.7, radius: 5.4, lower: 15.9 });
  if (tier)
    for (const z of [-9.99, 7.16]) {
      shell(out, 'trim', 'light', rectangle(-44.96, -43.41, z - 0.69, z + 0.69), 16.1, 38.0);
      pinnacle(out, -44.2, z, 36.9, 9.0, 1.83, tier);
    }
  const tr = rectangle(t.west, t.east, t.north, t.south);
  for (const i of [0, 2]) {
    const f = frame(tr[i], tr[(i + 1) % 4]);
    largeGable(out, f, 30.75, 39.05, tier, { roseY: 24.15, radius: 4.28, lower: 15.8 });
    if (tier)
      for (const [x, z] of [tr[i], tr[(i + 1) % 4]]) {
        shell(out, 'trim', 'light', rectangle(x - 0.57, x + 0.57, z - 0.57, z + 0.57), 15.8, 31.5);
        pinnacle(out, x, z, 30.8, 8.1, 1.38, tier);
      }
  }
  for (const i of [1, 3]) {
    const f = frame(tr[i], tr[(i + 1) % 4]);
    panel(out, f, 'stone', 'wall', 0, f.length, 15.95, t.eave);
    for (const u of [5.7, f.length - 6.4]) lancet(out, f, u, 20.1, 9.7, 3.12, tier);
  }
  gabledRoof(out, tr, t.eave, t.ridge, 'z', false);
  const ap = layout.apse;
  for (const [a, b] of around(ap)) {
    const f = frame(a, b);
    panel(out, f, 'stone', 'wall', 0, f.length, 15.9, 31.0);
    if (f.length > 2.0 && Math.abs(a[0] - b[0]) < 11.0)
      lancet(out, f, f.length / 2, 18.8, 10.6, Math.min(f.length * 0.74, 2.85), tier);
  }
  const apex = [27.6, 37.95, -2.31];
  for (const [a, b] of around(ap))
    face(out, 'tile', 'tile', [at(a, 31), at(b, 31), apex], [0, 1, 0]);
  for (const run of layout.bayCaps) {
    const mid = blend(run[0], run.at(-1), 0.5),
      inner = blend(mid, [29.0, -3.0], 0.39),
      footprint = positive([run[0], ...run.slice(1), inner]);
    const peak = at(blend(mid, inner, 0.55), 18.95);
    for (const [a, b] of around(footprint))
      face(out, 'tile', 'tileLight', [at(a, 16.14), at(b, 16.14), peak], [0, 1, 0]);
  }
}

function flying(out, tier) {
  const xstations = [-30.6, -24.15, -17.52, -10.86, 15.0, 21.23, 27.65];
  const count = [2, 3, 6, 9, 12][tier];
  function rib(a, b, curvature, width) {
    const path = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count,
        p = blend(a, b, t);
      p[1] += curvature * Math.sin(t * Math.PI);
      return p;
    });
    if (tier >= 2) beamPath(out, 'trim', path, width, width * 1.12, C.light);
    else {
      const f = frame([a[0], a[2]], [b[0], b[2]]),
        d = width * 0.36;
      for (let i = 1; i < path.length; i++)
        for (const side of [-1, 1]) {
          const shift = (p, y) => [
            p[0] + f.normal[0] * side * d,
            p[1] + y,
            p[2] + f.normal[2] * side * d,
          ];
          const p = path[i - 1],
            q = path[i];
          face(
            out,
            'trim',
            'light',
            [shift(p, -d), shift(q, -d), shift(q, d), shift(p, d)],
            f.normal.map((n) => n * side),
          );
        }
    }
  }
  for (const side of [-1, 1])
    for (const [i, x] of xstations.entries()) {
      if (!tier && i % 2 !== 0) continue;
      const innerZ = side < 0 ? -8.5 : 5.45,
        outerZ = side < 0 ? (x < 0 ? -16.6 : -21.2) : x < 0 ? 12.4 : 17.5;
      const h = i >= 4 ? 23.1 : 21.8;
      pinnacle(out, x, outerZ, 10.6, h - 10.6 + 2.8, tier ? 1.55 : 1.26, tier);
      rib([x, 27.8, innerZ], [x, h, outerZ], 2.15, tier === 0 ? 0.71 : 0.6);
      if (tier >= 2 || (tier === 1 && i % 2 === 0))
        rib([x, 24.75, innerZ], [x, h - 3.7, outerZ], 1.7, 0.54);
    }
  const positions = [
    [30.7, -22.3],
    [37.4, -18.2],
    [44.8, -13.45],
    [46.35, -3.0],
    [42.2, 7.9],
    [36.3, 13.1],
  ];
  for (const [i, q] of positions.entries()) {
    if (!tier && i % 2 !== 0) continue;
    const p = blend(q, [29, -2.8], 0.57);
    pinnacle(out, q[0], q[1], 12.0, 14.3, 1.45, tier);
    rib(at(p, 28.45), at(q, 22.85), 1.8, 0.57);
    if (tier >= 2 || (tier === 1 && i % 2 === 0)) rib(at(p, 25.05), at(q, 19.7), 1.44, 0.5);
  }
  for (const side of [-1, 1]) {
    const a = [-43.9, 22.7, side < 0 ? -9.6 : 6.75],
      b = [-40.5, 18.65, side < 0 ? -16.6 : 12.92];
    rib(a, b, 2.75, 0.62);
  }
}

function cloister(out, tier) {
  for (const [wing, w] of layout.wings.entries()) {
    const outside = keep(w.outer, tier >= 2),
      [a, b] = w.court,
      f = frame(b, a);
    const spans = outside.map((p, i) => (i === 0 ? 0 : length(outside[i - 1], p)));
    const sum = spans.reduce((s, v) => s + v, 0);
    let distance = 0;
    const previous = layout.wings[(wing + 3) % 4],
      next = layout.wings[(wing + 1) % 4];
    const controls = outside.map((p, i) => {
      distance += spans[i];
      const t = distance / sum;
      const ridge =
        mix((previous.ridge + w.ridge) * 0.5, (w.ridge + next.ridge) * 0.5, t) +
        Math.sin(Math.PI * t) * 0.24;
      return [p, blend(a, b, t), ridge];
    });
    for (let i = 1; i < controls.length; i++) {
      const [p, q, peak0] = controls[i - 1],
        [r, s, peak1] = controls[i],
        edge = frame(p, r);
      panel(out, edge, 'stone', 'wall', 0, edge.length, -3.4, 13.75);
      const m = blend(p, q, 0.48),
        n = blend(r, s, 0.48);
      face(
        out,
        'tile',
        'tile',
        [at(p, 13.75), at(r, 13.75), at(n, peak1), at(m, peak0)],
        [0, 1, 0],
      );
      face(
        out,
        'tile',
        'tileLight',
        [at(m, peak0), at(n, peak1), at(s, 12.7), at(q, 12.7)],
        [0, 1, 0],
      );
    }
    const n = tier ? 6 : 3,
      pitch = f.length / n,
      portals = Array.from({ length: n }, (_, i) => ({
        u: (i + 0.5) * pitch,
        radius: pitch * 0.365,
        threshold: 3.4,
        spring: 7.55,
        rise: 2.38,
      }));
    arcade(out, f, portals, 12.7, -1.25, tier >= 3 ? 2 : tier, { recess: false });
    if (tier) {
      trim(out, f, 12.34, 0.28, 0.46);
      for (let i = 0; tier >= 2 && i <= n; i++) {
        const u = Math.max(0.15, Math.min(f.length - 0.15, i * pitch));
        block(out, f, 'trim', 'light', u - 0.12, u + 0.12, 3.62, 10.0, 0.2);
      }
    }
  }
}

export function buildCathedralLevel(out, level = 'master') {
  const tier = tierOf[level];
  if (tier === undefined) throw Error(`Unknown León Cathedral tier ${level}`);
  lower(out, tier);
  upperChurch(out, tier);
  for (const t of layout.towers) tower(out, t, tier);
  flying(out, tier);
  cloister(out, tier);
}
export const buildCathedralSkyline = (out) => buildCathedralLevel(out, 'skyline');
export const buildCathedralDistrict = (out) => buildCathedralLevel(out, 'district');
export const buildCathedralStreet = (out) => buildCathedralLevel(out, 'street');
export const buildCathedralCloseup = (out) => buildCathedralLevel(out, 'closeup');
