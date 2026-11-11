/** Neo-Renaissance National Museum at the head of Wenceslas Square. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78, metallic: 0.22 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.77, metallic: 0.3 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.49 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.69, metallic: 0.26 },
  glaze: { slot: 'roof', graph: 'glass_frit_triangular', roughness: 0.44 },
};
const colors = {
  sandstone: [0.68, 0.581, 0.444],
  pavilion: [0.734, 0.627, 0.479],
  plinth: [0.463, 0.397, 0.318],
  steps: [0.61, 0.553, 0.461],
  trim: [0.775, 0.674, 0.528],
  pale: [0.852, 0.754, 0.616],
  relief: [0.646, 0.541, 0.411],
  window: [0.132, 0.148, 0.147],
  warmGlass: [0.181, 0.154, 0.121],
  patina: [0.244, 0.391, 0.343],
  slate: [0.273, 0.323, 0.302],
  ridge: [0.375, 0.442, 0.383],
  gold: [0.751, 0.5, 0.151],
  bronze: [0.225, 0.263, 0.199],
  glassRoof: [0.37, 0.49, 0.49],
  fountainWater: [0.139, 0.245, 0.232],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rectangle = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const bevel = (x, z, w, d, c) => [
  [x - w / 2 + c, z - d / 2],
  [x + w / 2 - c, z - d / 2],
  [x + w / 2, z - d / 2 + c],
  [x + w / 2, z + d / 2 - c],
  [x + w / 2 - c, z + d / 2],
  [x - w / 2 + c, z + d / 2],
  [x - w / 2, z + d / 2 - c],
  [x - w / 2, z - d / 2 + c],
];
const crossSum = (ring) =>
  ring.reduce((v, [x, z], i) => {
    const [a, b] = ring[(i + 1) % ring.length];
    return v + x * b - a * z;
  }, 0);
function polygon(out, slot, tone, points, expected) {
  points = points.map((p) => p.map(Math.fround));
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.1) return;
  if (expected && n.reduce((v, a, i) => v + a * expected[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, colors[tone]);
  else out.addQuad(slot, ref, points, n, undefined, colors[tone]);
}
function horizontal(out, slot, tone, rings, y) {
  const pts = rings.flat(),
    holes = [];
  let index = rings[0].length;
  for (const ring of rings.slice(1)) {
    holes.push(index);
    index += ring.length;
  }
  const ids = earcut(pts.flat(), holes);
  for (let i = 0; i < ids.length; i += 3)
    polygon(
      out,
      slot,
      tone,
      ids.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      up,
    );
}
function frame(a, b, dir = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    n = [(dir * dz) / l, 0, (-dir * dx) / l];
  return {
    l,
    n,
    p: (u, y, d = 0) => [a[0] + (dx * u) / l + n[0] * d, y, a[1] + (dz * u) / l + n[2] * d],
  };
}
function panel(out, slot, tone, { p, n }, a, b, lo, hi, d = 0) {
  polygon(out, slot, tone, [p(a, lo, d), p(b, lo, d), p(b, hi, d), p(a, hi, d)], n);
}
function band(out, f, a, b, y, h, d, tier, tone = 'trim') {
  const { p } = f;
  panel(out, 'trim', tone, f, a, b, y, y + h, d);
  if (tier >= 2)
    polygon(
      out,
      'trim',
      'pale',
      [p(a, y + h, d), p(b, y + h, d), p(b, y + h, -0.02), p(a, y + h, -0.02)],
      up,
    );
}
function block(out, slot, tone, x, z, w, d, lo, hi) {
  loft(
    out,
    slot,
    [lo, hi].map((y) =>
      rectangle(x, z, w, d)
        .toReversed()
        .map(([a, b]) => [a, y, b]),
    ),
    colors[tone],
  );
}
function mass(out, slot, tone, ring, lo, hi) {
  const dir = Math.sign(crossSum(ring));
  for (let i = 0; i < ring.length; i++) {
    const f = frame(ring[i], ring[(i + 1) % ring.length], dir);
    panel(out, slot, tone, f, 0, f.l, lo, hi);
  }
  horizontal(out, slot, tone, [ring], hi);
}
function window(out, f, u, lo, w, h, arch, tier, important = false) {
  const { p, n } = f,
    left = u - w / 2,
    right = u + w / 2,
    spring = lo + h * (arch ? 0.74 : 1),
    slot = tier >= 2 ? 'glass' : 'bronze';
  const tone = important ? 'warmGlass' : 'window';
  if (tier >= 2)
    panel(out, 'trim', 'trim', f, left - 0.15, right + 0.15, lo - 0.19, spring + 0.12, 0.059);
  panel(out, slot, tone, f, left, right, lo, spring, 0.096);
  if (arch) {
    const count = tier <= 2 ? 3 : 6;
    const edge = (i, extra = 0) => {
      const angle = (Math.PI * i) / count;
      return p(
        u - Math.cos(angle) * (w / 2 + extra),
        spring + Math.sin(angle) * (h * 0.26 + extra),
        extra ? 0.076 : 0.097,
      );
    };
    for (let i = 0; i < count; i++) {
      polygon(out, slot, tone, [p(u, spring, 0.097), edge(i), edge(i + 1)], n);
      if (tier >= 3)
        polygon(out, 'trim', 'pale', [edge(i), edge(i + 1), edge(i + 1, 0.22), edge(i, 0.22)], n);
    }
  }
  if (tier >= 3) {
    band(out, f, left - 0.23, right + 0.23, lo - 0.23, 0.2, 0.22, 2, 'relief');
    panel(out, 'bronze', 'window', f, u - 0.04, u + 0.04, lo + 0.02, spring, 0.119);
    if (important)
      panel(out, 'bronze', 'window', f, left, right, lo + h * 0.43, lo + h * 0.43 + 0.09, 0.12);
  }
}
function envelope(out, tier) {
  const { wells, eave } = layout,
    outer = tier ? layout.outer : layout.outline;
  const grade = tier ? layout.grade : outer.map(() => Math.min(...layout.grade));
  const dir = Math.sign(crossSum(outer));
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      f = frame(outer[i], outer[j], dir),
      { p, n, l } = f;
    const lower = [grade[i], grade[j]],
      baseY = 11.2;
    polygon(out, 'base', 'plinth', [p(0, lower[0]), p(l, lower[1]), p(l, baseY), p(0, baseY)], n);
    panel(out, 'stone', 'sandstone', f, 0, l, baseY, eave);
    if (!tier) continue;
    band(out, f, 0, l, baseY - 0.2, 0.76, 0.43, tier);
    band(out, f, 0, l, 27.78, 0.68, 0.49, tier);
    if (l < 2.6) continue;
    const center = p(l / 2, 0),
      front = n[2] > 0.5 && center[2] > 28,
      main = front && Math.abs(center[0] - 1.23) < 12.8;
    const number = Math.max(1, Math.round(l / (tier === 1 ? 4.65 : 3.58)));
    for (let k = 0; k < number; k++) {
      const u = (l * (k + 0.5)) / number,
        ground = mix(...lower, u / l);
      if (!main && ground < 4.4 && tier >= 2) window(out, f, u, 4.5, 1.45, 4.65, true, tier);
      if (!main) window(out, f, u, 13.68, 1.63, 5.75, tier >= 2, tier);
      if (!main || tier === 1) window(out, f, u, 21.58, 1.8, 4.23, false, tier);
      if (!main && tier >= 3 && ground < 0.6) window(out, f, u, 1.02, 1.16, 2.11, false, tier);
      if (tier >= 2 && k > 0) {
        const v = (l * k) / number,
          w = front ? 0.56 : 0.28;
        band(out, f, v - w / 2, v + w / 2, 12.31, 15.31, front ? 0.33 : 0.18, 1, 'trim');
        if (tier >= 3 && front) band(out, f, v - 0.42, v + 0.42, 26.88, 0.62, 0.45, 2, 'pale');
      }
    }
    if (tier >= 3) {
      for (const y of [2.9, 4.2, 9.8, 10.64, 20.2, 27.12])
        if (y > Math.max(...lower) + 0.32 && (!main || y > 11))
          band(out, f, 0, l, y, 0.1, 0.12, 1, 'relief');
    }
  }
  horizontal(out, 'roof', 'slate', [outer, ...wells], eave);
  for (const ring of wells) {
    const direction = -Math.sign(crossSum(ring));
    for (let i = 0; i < ring.length; i++) {
      const f = frame(ring[i], ring[(i + 1) % ring.length], direction);
      panel(out, 'stone', 'sandstone', f, 0, f.l, 21.5, eave);
    }
    horizontal(out, 'base', 'plinth', [ring], 21.5);
  }
}
function hip(out, slot, tone, x, z, w, d, low, high, tier, hall = false) {
  const lower = rectangle(x, z, w, d),
    inset = Math.min(w, d) * 0.33;
  const top = rectangle(x, z, w - 2 * inset, d - 2 * inset);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = [lower[i][0], low, lower[i][1]],
      b = [lower[j][0], low, lower[j][1]];
    const c = [top[j][0], high, top[j][1]],
      e = [top[i][0], high, top[i][1]];
    polygon(out, slot, tone, [a, b, c, e], up);
    if (tier >= 3 && hall) {
      const ribs = i % 2 ? 10 : 5;
      for (let k = 0; k <= ribs; k++) {
        const t = k / ribs,
          start = a.map((v, m) => mix(v, b[m], t)),
          end = e.map((v, m) => mix(v, c[m], t));
        beam(out, 'roof', start, end, 0.1, 0.085, colors.ridge);
      }
    }
  }
  horizontal(out, slot, tone, [top], high);
}
function roofs(out, tier) {
  for (const [x, z, w, d, h] of [
    [-24.9, 23, 26, 12.8, 34],
    [27, 23, 25.9, 12.8, 34],
    [-25.3, -33.9, 24.5, 10.8, 33.6],
    [27, -33.9, 24, 10.7, 33.6],
    [-42.3, -4.6, 10.7, 52.4, 34.5],
    [44.4, -4.6, 10.8, 52.4, 34.5],
    [0.6, -7.15, 16.6, 25.0, 35],
  ])
    hip(out, 'roof', 'slate', x, z, w, d, 28.89, h, tier);
  block(out, 'stone', 'pavilion', 1.25, -38.1, 24.8, 14.8, 27.9, 32.7);
  hip(out, 'roof', 'slate', 1.25, -38.1, 24.8, 14.8, 32.7, 38.2, tier);
  for (const { x, z, w, d, eave, peak } of layout.halls) {
    block(out, 'stone', 'sandstone', x, z, w, d, 28.81, eave);
    hip(out, 'glaze', 'glassRoof', x, z, w, d, eave, peak, tier, true);
  }
}
function profile(out, slot, tone, x, z, rows, n, tier) {
  if (!tier) {
    if (rows.length > 3) rows = [rows[0], rows[Math.floor(rows.length / 2)], rows.at(-1)];
    n = Math.min(n, 6);
    const rings = rows.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8));
    loft(out, slot, rings, colors[tone], { cap: false });
    horizontal(out, slot, tone, [rings.at(-1).map(([a, , b]) => [a, b])], rows.at(-1)[0]);
    return;
  }
  const rings = rows.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8));
  loft(out, slot, rings, colors[tone]);
  if (tier >= 3 && slot === 'copper') {
    for (let j = 0; j < 8; j++) {
      const k = Math.floor((n * j) / 8);
      for (let i = 1; i < rings.length; i++)
        beam(out, 'trim', rings[i - 1][k], rings[i][k], 0.105, 0.105, colors.pale);
    }
  }
}
function sculpture(out, x, y, z, scale, tier, winged = false) {
  const ry = (a) => y + a * scale;
  if (tier <= 1) {
    block(out, 'bronze', 'bronze', x, z, 0.59 * scale, 0.52 * scale, y, ry(1.76));
    return;
  }
  const dark = colors.bronze,
    sides = tier >= 4 ? 10 : 6;
  sphere(
    out,
    'bronze',
    [x, ry(0.84), z],
    [0.34 * scale, 0.63 * scale, 0.27 * scale],
    dark,
    sides,
    5,
  );
  sphere(
    out,
    'bronze',
    [x, ry(1.54), z],
    [0.187 * scale, 0.216 * scale, 0.19 * scale],
    dark,
    sides,
    4,
  );
  for (const s of [-1, 1]) {
    beam(
      out,
      'bronze',
      [x + s * 0.23 * scale, ry(1.09), z],
      [x + s * 0.48 * scale, ry(0.71), z + 0.11 * scale],
      0.13 * scale,
      0.17 * scale,
      dark,
    );
    if (winged) {
      polygon(
        out,
        'bronze',
        'bronze',
        [
          [x + s * 0.19 * scale, ry(0.74), z - 0.13 * scale],
          [x + s * 0.76 * scale, ry(1.77), z - 0.1 * scale],
          [x + s * 0.33 * scale, ry(1.41), z - 0.31 * scale],
        ],
        [0, 0, 1],
      );
    }
  }
}
function cornerCupolas(out, tier) {
  for (const {
    center: [x, z],
    ring,
  } of layout.caps) {
    mass(out, 'stone', 'pavilion', ring, 28.77, 34.7);
    if (tier >= 1)
      for (let i = 0; i < ring.length; i++) {
        const f = frame(ring[i], ring[(i + 1) % ring.length], Math.sign(crossSum(ring)));
        band(out, f, 0, f.l, 33.92, 0.49, 0.39, tier);
        if (f.l > 3) window(out, f, f.l / 2, 30.42, f.l * 0.58, 2.83, tier >= 2, tier);
      }
    const n = [8, 8, 16, 24, 32][tier];
    profile(
      out,
      'copper',
      'patina',
      x,
      z,
      [
        [34.65, 4.43],
        [35.63, 4.36],
        [37.35, 3.63],
        [38.79, 2.3],
        [39.85, 0.66],
        [40.14, 0.21],
      ],
      n,
      tier,
    );
    profile(
      out,
      'bronze',
      'gold',
      x,
      z,
      [
        [40.09, 0.27],
        [40.47, 0.35],
        [41, 0.075],
      ],
      tier > 2 ? 8 : 4,
      tier,
    );
  }
}
function pantheon(out, tier) {
  const [x, z] = layout.center,
    steps = bevel(x, z, 17.5, 17.65, 1.15),
    drum = bevel(x, z, 14.0, 14.15, 0.8);
  mass(out, 'stone', 'pavilion', steps, 28.79, 44.8);
  mass(out, 'trim', 'relief', bevel(x, z, 17.82, 17.97, 1.15), 44.5, 46.34);
  mass(out, 'stone', 'pavilion', drum, 46.34, 53.25);
  if (tier)
    for (let i = 0; i < steps.length; i++) {
      const f = frame(steps[i], steps[(i + 1) % steps.length]);
      band(out, f, 0, f.l, 35.7, 0.44, 0.28, tier, 'relief');
      band(out, f, 0, f.l, 43.65, 0.61, 0.46, tier, 'pale');
      if (f.l < 3) continue;
      for (const k of [1, 2, 3]) {
        const u = (f.l * k) / 4;
        window(out, f, u, 37.1, 1.72, 5.45, true, tier, true);
        if (tier >= 2) band(out, f, u - 1.49, u - 1.13, 36.2, 7.12, 0.21, 1);
      }
    }
  if (tier)
    for (let i = 0; i < drum.length; i++) {
      const f = frame(drum[i], drum[(i + 1) % drum.length]);
      band(out, f, 0, f.l, 52.45, 0.55, 0.34, tier);
      if (f.l < 3) continue;
      for (const k of [1, 2, 3]) {
        const u = (f.l * k) / 4;
        window(out, f, u, 46.85, 2.4, 4.86, true, tier, true);
        if (tier >= 2 && k < 3) band(out, f, u + 1.46, u + 1.99, 46.55, 5.92, 0.46, 2);
      }
    }
  const n = [8, 16, 24, 32, 40][tier];
  profile(
    out,
    'copper',
    'patina',
    x,
    z,
    [
      [53.22, 6.82],
      [54.52, 6.78],
      [56.03, 6.15],
      [57.6, 5.05],
      [59.12, 3.5],
      [60.12, 1.96],
      [60.46, 1.58],
    ],
    n,
    tier,
  );
  profile(
    out,
    'trim',
    'relief',
    x,
    z,
    [
      [60.38, 1.65],
      [60.79, 1.65],
      [60.94, 1.27],
      [64.08, 1.27],
      [64.44, 1.56],
    ],
    tier >= 2 ? 12 : 8,
    tier,
  );
  profile(
    out,
    'copper',
    'patina',
    x,
    z,
    [
      [64.4, 1.64],
      [65.35, 1.46],
      [66.55, 0.55],
      [67.12, 0.22],
    ],
    tier >= 2 ? 12 : 8,
    tier,
  );
  profile(
    out,
    'bronze',
    'gold',
    x,
    z,
    [
      [66.98, 0.19],
      [67.48, 0.38],
      [67.88, 0.3],
      [69, 0.058],
    ],
    tier >= 2 ? 8 : 4,
    tier,
  );
  if (tier >= 1)
    for (const dx of [-8.05, 8.05])
      for (const dz of [-8.03, 8.03]) {
        block(out, 'trim', 'pale', x + dx, z + dz, 2.15, 2.05, 44.5, 48.29);
        sculpture(out, x + dx, 48.24, z + dz, 2.42, tier, true);
      }
  if (tier >= 2)
    for (const dx of [-0.85, 0.85]) {
      const f = frame([x + 1.23, z + 1.04], [x - 1.23, z + 1.04]);
      window(out, f, f.l * (dx < 0 ? 0.27 : 0.73), 61.24, 0.43, 2.45, true, tier, false);
    }
}
function stairAndFountain(out, tier) {
  const x = 1.24,
    steps = [3, 9, 17, 23, 27][tier],
    y = 6.35;
  block(out, 'base', 'steps', x, 38.4, 55.2, 8.1, -3.9, y);
  for (const s of layout.stair) {
    const p = (j, k, x) => [
      x,
      k < 0 ? -3.9 : mix(s.lower[j], s.upper, k / (steps - 1)),
      s.z + (j - 0.5) * s.width,
    ];
    for (let i = 0; i < steps; i++) {
      const a = mix(s.x, s.end, i / steps),
        b = mix(s.x, s.end, (i + 1) / steps);
      polygon(out, 'base', 'steps', [p(0, i, a), p(1, i, a), p(1, i, b), p(0, i, b)], up);
      polygon(
        out,
        'base',
        'plinth',
        [p(0, i - 1, a), p(1, i - 1, a), p(1, i, a), p(0, i, a)],
        [-s.side, 0, 0],
      );
      for (const j of [0, 1])
        polygon(
          out,
          'base',
          'plinth',
          [p(j, -1, a), p(j, -1, b), p(j, i, b), p(j, i, a)],
          [0, 0, j ? 1 : -1],
        );
    }
    block(out, 'base', 'steps', s.end + s.side * 2.1, s.z, 4.2, s.width, -3.9, y);
    if (tier >= 2)
      for (const j of [0, 1]) {
        const a = p(j, 0, s.x),
          b = p(j, steps - 1, s.end);
        const shifted = (p, h) => [p[0], p[1] + h, p[2]];
        beam(out, 'trim', shifted(a, 0.95), shifted(b, 0.95), 0.37, 0.28, colors.trim);
        const n = tier >= 3 ? 16 : 6;
        for (let i = 0; i <= n; i++) {
          const q = a.map((v, k) => mix(v, b[k], i / n));
          beam(out, 'trim', q, shifted(q, 0.93), 0.16, 0.17, colors.pale);
        }
      }
  }
  const { fountain: f } = layout,
    [cx, cz] = f.center,
    n = [8, 10, 14, 18, 24][tier];
  const scale = (p, factor) => p.map((v, i) => mix(f.center[i], v, factor));
  const ring = f.ring,
    inner = ring.map((p) => scale(p, 0.86)),
    yWater = f.water,
    yRim = yWater + 0.3;
  const direction = Math.sign(crossSum(ring));
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j],
      c = inner[j],
      d = inner[i];
    const edge = frame(a, b, direction),
      inset = frame(c, d, direction);
    panel(out, 'base', 'steps', edge, 0, edge.l, -1.4, yRim);
    polygon(
      out,
      'trim',
      'pale',
      [
        [a[0], yRim, a[1]],
        [b[0], yRim, b[1]],
        [c[0], yRim, c[1]],
        [d[0], yRim, d[1]],
      ],
      up,
    );
    if (tier) panel(out, 'base', 'steps', inset, 0, inset.l, yWater - 0.1, yRim);
  }
  horizontal(out, 'copper', 'fountainWater', [inner], yWater);
  const z = cz - 2.2;
  if (!tier) {
    block(out, 'base', 'steps', cx, z, 3.5, 2.6, yWater, 2.76);
    return;
  }
  loft(
    out,
    'trim',
    [
      [0.08, 3.8, 1.63],
      [1.35, 3.25, 1.48],
      [2.16, 2.71, 1.29],
      [2.76, 2.06, 1.17],
    ].map(([y, rx, rz]) => radialRing(y, rx, rz, n, [cx, z])),
    colors.pale,
  );
  block(out, 'base', 'steps', cx, z - 0.21, 1.64, 1.33, 2.71, 3.38);
  sculpture(out, cx, 3.31, z - 0.21, 1.13, tier);
  if (tier >= 2)
    for (const offset of [-6.85, 6.85]) {
      block(out, 'base', 'steps', x + offset, 41.57, 1.36, 1.41, y, y + 0.57);
      sculpture(out, x + offset, y + 0.57, 41.57, 0.92, tier);
    }
}
function mainFront(out, tier) {
  const x = 1.24,
    z = 36.66,
    f = frame([x + 9.12, z], [x - 9.12, z]);
  const left = 0,
    right = f.l;
  for (const [a, b, y, h, d] of [
    [left, right, 11.05, 0.75, 0.54],
    [left, right, 27.36, 1.62, 0.76],
    [left, right, 29.26, 0.56, 0.72],
  ])
    band(out, f, a, b, y, h, d, tier);
  block(out, 'stone', 'pavilion', x, 32.23, 21.0, 8.62, 28.65, 33.8);
  const pediment = frame([x + 11.6, 36.65], [x - 11.6, 36.65]);
  const { p, n, l } = pediment;
  polygon(
    out,
    'trim',
    'relief',
    [p(0, 33.45, 0.64), p(l, 33.45, 0.64), p(l * 0.5, 37.66, 0.64)],
    n,
  );
  band(out, pediment, 0, l, 33.03, 0.55, 0.77, tier);
  if (tier >= 1) {
    beam(out, 'trim', p(0, 33.42, 0.94), p(l * 0.5, 37.66, 0.94), 0.41, 0.42, colors.pale);
    beam(out, 'trim', p(l * 0.5, 37.66, 0.94), p(l, 33.42, 0.94), 0.41, 0.42, colors.pale);
  }
  for (const k of tier ? [1, 2, 3] : []) {
    const u = (f.l * k) / 4;
    window(out, f, u, 6.36, 2.65, 6.2, true, tier, true);
    if (tier >= 1) window(out, f, u, 14.23, 2.56, 6.34, true, tier, true);
    if (tier >= 2) window(out, f, u, 22.1, 2.28, 4.3, false, tier, true);
  }
  for (const off of [-8.55, -5.1, -1.7, 1.7, 5.1, 8.55]) {
    const a = x + off,
      y = 13.05,
      at = z + 0.63;
    if (!tier) {
      const off = f.l / 2 - (a - x);
      panel(out, 'trim', 'trim', f, off - 0.36, off + 0.36, y, 27.65, 0.63);
    } else if (tier === 1) block(out, 'trim', 'trim', a, at, 0.72, 0.83, y, 27.65);
    else
      profile(
        out,
        'trim',
        'trim',
        a,
        at,
        [
          [y, 0.63],
          [y + 0.38, 0.56],
          [y + 0.69, 0.44],
          [26.9, 0.34],
          [27.52, 0.62],
          [27.71, 0.59],
        ],
        tier === 2 ? 6 : 10,
        tier,
      );
  }
  if (tier >= 3)
    for (let i = 0; i < 9; i++) {
      const u = (l * (i + 1)) / 10,
        point = p(u, 33.89, 0.81);
      sculpture(out, point[0], point[1], point[2], 0.47 + (1 - Math.abs(i - 4) / 4) * 0.26, tier);
    }
}
export function buildMuseumLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown National Museum tier ${level}`);
  envelope(out, tier);
  roofs(out, tier);
  cornerCupolas(out, tier);
  pantheon(out, tier);
  stairAndFountain(out, tier);
  mainFront(out, tier);
}
export const buildMuseumSkyline = (out) => buildMuseumLevel(out, 'skyline');
export const buildMuseumDistrict = (out) => buildMuseumLevel(out, 'district');
export const buildMuseumStreet = (out) => buildMuseumLevel(out, 'street');
export const buildMuseumCloseup = (out) => buildMuseumLevel(out, 'closeup');
