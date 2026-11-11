/** Palais des Papes, its square keeps, Gothic portal, limestone ranges and four open courts. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93 },
  cut: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.92 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.09 },
  glass: { slot: 'trim', graph: 'window_grid', roughness: 0.57 },
  garden: {
    slot: 'foundation',
    localRef: 'palette:#ffffff',
    name: 'Palace garden vegetation',
    roughness: 0.95,
    baseColorFactor: [0.23, 0.3, 0.104, 1],
  },
};
const colors = {
  wall: [0.69, 0.637, 0.547],
  tower: [0.64, 0.591, 0.499],
  chapel: [0.72, 0.664, 0.562],
  weathered: [0.48, 0.431, 0.354],
  darkStone: [0.334, 0.289, 0.236],
  cut: [0.775, 0.723, 0.627],
  trim: [0.85, 0.791, 0.688],
  paving: [0.595, 0.536, 0.436],
  lightPaving: [0.68, 0.62, 0.518],
  soil: [0.39, 0.32, 0.236],
  tile: [0.488, 0.378, 0.277],
  tileBrown: [0.42, 0.327, 0.252],
  slate: [0.308, 0.31, 0.297],
  dark: [0.126, 0.122, 0.105],
  glass: [0.17, 0.186, 0.18],
  green: [0.82, 0.92, 0.66],
  leaf: [0.69, 0.83, 0.53],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);
function face(out, slot, tone, p, expected) {
  p = p
    .map((q) => q.map(Math.fround))
    .filter((q, i, all) => !all.slice(0, i).some((r) => r.every((v, j) => v === q[j])));
  if (p.length < 3) return;
  let n = normalFor(...p);
  if (expected && n.reduce((a, v, i) => a + v * expected[i], 0) < 0) {
    p = p.toReversed();
    n = normalFor(...p);
  }
  if (Math.hypot(...n) < 0.5) return;
  if (p.length === 3) out.addTriangle(slot, ref, p, n, undefined, colors[tone]);
  else out.addQuad(slot, ref, p, n, undefined, colors[tone]);
}
function roofTriangles(out, slot, tone, rings, levels) {
  const all = rings.flat(),
    holes = [];
  let i = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(i);
    i += h.length;
  }
  const y = levels.flat(),
    indices = earcut(all.flat(), holes);
  for (let j = 0; j < indices.length; j += 3)
    face(
      out,
      slot,
      tone,
      indices.slice(j, j + 3).map((i) => [all[i][0], y[i], all[i][1]]),
      up,
    );
}
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x - w / 2, z + d / 2],
  [x + w / 2, z + d / 2],
  [x + w / 2, z - d / 2],
];
function flat(out, slot, tone, r, y) {
  roofTriangles(out, slot, tone, [r], [r.map(() => y)]);
}
function frame(f) {
  const [x, z] = f.a,
    [a, b] = f.b,
    len = Math.hypot(x - a, z - b),
    n = [f.n[0], 0, f.n[1]];
  return { len, n, p: (u, y, d = 0) => [mix(x, a, u) + n[0] * d, y, mix(z, b, u) + n[2] * d] };
}
function band(out, slot, tone, s, a, b, y, h, d = 0.09) {
  const { p, n } = s;
  face(out, slot, tone, [p(a, y, d), p(b, y, d), p(b, y + h, d), p(a, y + h, d)], n);
}
function pillar(out, s, u, y, h, width, d = 0.13, tone = 'cut') {
  const a = width / (2 * s.len);
  band(out, 'cut', tone, s, u - a, u + a, y, h, d);
}
function arch(t, spring, rise, pointed = true) {
  const x = Math.min(1, Math.max(0, t));
  return (
    spring + rise * (pointed ? Math.pow(1 - Math.abs(x * 2 - 1), 0.66) : Math.sin(Math.PI * x))
  );
}
function lancet(out, s, u, width, base, height, tier, tall) {
  const { p, n, len } = s,
    from = u - width * 0.5,
    to = u + width * 0.5,
    spring = base + height * 0.71,
    rise = height * 0.29;
  const glazed = tier >= 2 && tall && height > 3.25,
    slot = glazed ? 'glass' : 'iron',
    tone = glazed ? 'glass' : 'dark',
    offset = 0.074;
  band(
    out,
    'cut',
    'cut',
    s,
    from - 0.1 / len,
    to + 0.1 / len,
    base - 0.13,
    height * 0.72 + 0.11,
    0.05,
  );
  band(out, slot, tone, s, from, to, base, height * 0.71, offset);
  const seg = tier === 1 ? 2 : tier === 2 ? 4 : 8;
  const points = Array.from({ length: seg + 1 }, (_, i) =>
    p(mix(from, to, i / seg), arch(i / seg, spring, rise), offset),
  );
  for (let i = 1; i < points.length - 1; i++)
    face(out, slot, tone, [points[0], points[i], points[i + 1]], n);
  if (tier >= 2) {
    band(out, 'cut', 'trim', s, from - 0.18 / len, to + 0.18 / len, base - 0.15, 0.14, 0.12);
    if (tall) pillar(out, s, u, base + 0.03, height * 0.77, 0.12, 0.121);
  }
  if (tier >= 3)
    for (let i = 1; i < points.length; i++) {
      const shift = (q) => [q[0] + n[0] * 0.049, q[1] + 0.15, q[2] + n[2] * 0.049];
      face(
        out,
        'cut',
        'trim',
        [points[i - 1], points[i], shift(points[i]), shift(points[i - 1])],
        n,
      );
    }
}
function crest(out, f, s, style, tier) {
  const { p, len } = s;
  if (len < 3.1) return;
  const tower = style === 'tower',
    top = f.eave,
    count = Math.max(2, Math.round(len / (tower ? 2.17 : 3.27)));
  const h = tower ? 1.51 : 1.18;
  band(out, 'cut', 'cut', s, 0, 1, top - 0.14, 0.32, 0.16);
  if (tower && tier >= 2) {
    band(out, 'cut', 'cut', s, 0, 1, top - 0.72, 0.68, 0.44);
    face(
      out,
      'cut',
      'cut',
      [
        p(0, top - 0.035, 0.44),
        p(1, top - 0.035, 0.44),
        p(1, top - 0.035, -0.045),
        p(0, top - 0.035, -0.045),
      ],
      up,
    );
  }
  for (let i = 0; i < count; i++) {
    const a = (i + 0.21) / count,
      b = (i + 0.78) / count;
    band(out, 'cut', 'cut', s, a, b, top + 0.14, h, 0.19);
    if (tier >= 2) {
      face(
        out,
        'cut',
        'trim',
        [
          p(a, top + h + 0.14, 0.19),
          p(b, top + h + 0.14, 0.19),
          p(b, top + h + 0.14, -0.34),
          p(a, top + h + 0.14, -0.34),
        ],
        up,
      );
      face(
        out,
        'stone',
        'tower',
        [
          p(b, top + 0.12, 0.19),
          p(b, top + h + 0.14, 0.19),
          p(b, top + h + 0.14, -0.34),
          p(b, top + 0.12, -0.34),
        ],
        undefined,
      );
      face(
        out,
        'stone',
        'tower',
        [
          p(a, top + 0.12, -0.34),
          p(a, top + h + 0.14, -0.34),
          p(a, top + h + 0.14, 0.19),
          p(a, top + 0.12, 0.19),
        ],
        undefined,
      );
      if (tower && i % 2 === 0) {
        const u = (i + 0.5) / count;
        pillar(out, s, u, top - 2.07, 1.72, 0.47, 0.29, 'weathered');
        band(out, 'cut', 'cut', s, u - 0.44 / len, u + 0.44 / len, top - 0.72, 0.36, 0.34);
      }
    }
  }
}
function corridorY(z) {
  const g = layout.gate,
    t = Math.max(0, Math.min(1, (z - g.z0) / (g.z1 - g.z0)));
  return mix(g.floor, g.courtY, t);
}
function opening(out, f, s, tier) {
  const g = layout.gate,
    { p, n, len } = s,
    [x] = f.a,
    [a] = f.b;
  const u0 = (g.x - g.width / 2 - x) / (a - x),
    u1 = (g.x + g.width / 2 - x) / (a - x);
  const low = Math.max(0, Math.min(u0, u1)),
    high = Math.min(1, Math.max(u0, u1));
  if (high <= low) return false;
  const at = (u) => p(u, 0)[2],
    mid = at((low + high) / 2);
  if (mid < g.z0 - 0.45 || mid > g.z1 + 0.5) return false;
  const floor = (u) => mix(f.base[0], f.base[1], u),
    top = (u) => mix(f.top[0], f.top[1], u);
  const wall = (u, v) => {
    if (v - u < 0.00005) return;
    face(out, 'stone', 'wall', [p(u, floor(u)), p(v, floor(v)), p(v, top(v)), p(u, top(u))], n);
  };
  wall(0, low);
  wall(high, 1);
  const y = (u) => corridorY(at(u)) + arch((p(u, 0)[0] - g.x) / g.width + 0.5, g.spring, g.rise);
  const steps = tier === 0 ? 3 : tier === 1 ? 5 : tier === 2 ? 8 : 14;
  for (let i = 0; i < steps; i++) {
    const u = mix(low, high, i / steps),
      v = mix(low, high, (i + 1) / steps),
      a = y(u),
      b = y(v);
    face(out, 'stone', 'wall', [p(u, a), p(v, b), p(v, top(v)), p(u, top(u))], n);
    if (tier && f.visible) {
      const d = 0.19,
        h = tier >= 2 ? 0.39 : 0.3;
      face(out, 'cut', 'trim', [p(u, a, d), p(v, b, d), p(v, b + h, d), p(u, a + h, d)], n);
      if (tier >= 3)
        face(
          out,
          'cut',
          'weathered',
          [
            p(u, a + 0.11, d + 0.07),
            p(v, b + 0.11, d + 0.07),
            p(v, b + 0.2, d + 0.07),
            p(u, a + 0.2, d + 0.07),
          ],
          n,
        );
    }
  }
  if (tier && f.visible)
    for (const u of [low, high]) {
      if ((u === 0 || u === 1) && Math.abs(p(u, 0)[0] - g.x) < g.width * 0.488) continue;
      pillar(out, s, u, corridorY(at(u)), g.spring + 0.22, 0.33, 0.195);
    }
  if (tier >= 1 && f.visible && n[2] < -0.6) {
    const u = (low + high) / 2;
    if (low > 0.04 && high < 0.96 && len > 7) {
      const y0 = corridorY(at(u)) + g.spring + g.rise + 0.88;
      lancet(out, s, u, Math.min(0.17, 2.24 / len), y0 + 4.25, 4.21, tier, true);
      band(out, 'cut', 'cut', s, u - 2.42 / len, u + 2.42 / len, y0 + 2.15, 0.34, 0.196);
      if (tier >= 2)
        for (const offset of [-1.35, -0.45, 0.45, 1.35])
          pillar(out, s, u + offset / len, y0 + 1.27, 1.48, 0.28, 0.19, 'weathered');
    }
  }
  return true;
}
function recessedFront(out, f, s, tier, cloister, chapel) {
  const { p, n, len } = s;
  const c = layout.courts.find((c) => c.name === f.court),
    low = cloister ? c.level : Math.max(0.22, Math.min(...f.base) + 1.24);
  const spring = low + (cloister ? 3.5 : chapel ? 18.65 : 9.02),
    rise = cloister ? 1.25 : chapel ? 3.68 : 2.17,
    head = spring + rise;
  const top = (t) => (chapel ? Math.max(...f.top, f.eave + 3.9) : mix(f.top[0], f.top[1], t)),
    foot = (t) => mix(f.base[0], f.base[1], t);
  const count = Math.max(
      1,
      Math.round(len / (tier === 0 ? 13 : tier === 1 ? 7.6 : cloister ? 4.1 : chapel ? 7.8 : 6.5)),
    ),
    depth = cloister ? 1.63 : chapel ? 1.42 : 0.82;
  face(out, 'stone', 'wall', [p(0, head + 0.08), p(1, head + 0.08), p(1, top(1)), p(0, top(0))], n);
  for (let i = 0; i < count; i++) {
    const u = i / count,
      v = (i + 1) / count,
      a = mix(u, v, 0.14),
      b = mix(u, v, 0.86);
    for (const [r, t] of [
      [u, a],
      [b, v],
    ])
      face(
        out,
        'stone',
        'wall',
        [p(r, foot(r)), p(t, foot(t)), p(t, head + 0.1), p(r, head + 0.1)],
        n,
      );
    if (!cloister)
      face(out, 'stone', 'tower', [p(a, foot(a)), p(b, foot(b)), p(b, low), p(a, low)], n);
    if (tier)
      face(
        out,
        'stone',
        cloister ? 'darkStone' : 'weathered',
        [p(a, low, -depth), p(b, low, -depth), p(b, head + 0.1, -depth), p(a, head + 0.1, -depth)],
        n,
      );
    const seg = tier === 0 ? 2 : tier === 1 ? 3 : tier === 2 ? 5 : 8;
    for (let k = 0; k < seg; k++) {
      const t = k / seg,
        q = (k + 1) / seg,
        r = mix(a, b, t),
        s = mix(a, b, q),
        y = arch(t, spring, rise, !cloister),
        h = arch(q, spring, rise, !cloister);
      face(out, 'cut', 'cut', [p(r, y), p(s, h), p(s, head + 0.105), p(r, head + 0.105)], n);
      if (tier >= 2)
        face(out, 'cut', 'weathered', [p(r, y), p(s, h), p(s, h, -depth), p(r, y, -depth)], down);
    }
    if (tier >= 2) {
      for (const t of [a, b]) pillar(out, s, t, low, 0.36, 0.43, 0.14);
      if (chapel)
        for (const u of [a, b]) {
          const outer = u === a ? u - 0.13 / count : u + 0.13 / count;
          face(
            out,
            'cut',
            'cut',
            [
              p(outer, low, 0.45),
              p(u, low, 0.45),
              p(u, spring + 1.2, 0.45),
              p(outer, spring + 1.2, 0.45),
            ],
            n,
          );
          face(
            out,
            'cut',
            'weathered',
            [
              p(u, low, 0.45),
              p(u, low, -depth),
              p(u, spring + 1.2, -depth),
              p(u, spring + 1.2, 0.45),
            ],
            undefined,
          );
        }
      if (!cloister && len > 8)
        lancet(
          out,
          { ...s, p: (u, y, d = 0) => p(u, y, d - depth + 0.055) },
          (u + v) / 2,
          (b - a) * 0.41,
          low + 2.35,
          chapel ? 7.4 : 4.48,
          tier,
          true,
        );
    }
    if (tier >= 1 && f.eave > head + 3.5)
      lancet(
        out,
        s,
        (u + v) / 2,
        (b - a) * 0.42,
        head + 0.98,
        Math.min(3.65, f.eave - head - 1.3),
        tier,
        chapel,
      );
  }
}
function façade(out, w, f, tier) {
  const s = frame(f),
    { p, n, len } = s,
    style = w.style,
    tower = style === 'tower',
    chapel = style === 'chapel',
    retaining = style === 'retaining';
  const west = n[2] < -0.58 && p(0.5, 0)[2] < -26,
    cloister = f.court === 'Old Palace cloister' && len > 5.8;
  if (tier === 0 && !f.visible && len < 13) return;
  const g = layout.gate,
    minX = Math.min(f.a[0], f.b[0]),
    maxX = Math.max(f.a[0], f.b[0]),
    minZ = Math.min(f.a[1], f.b[1]),
    maxZ = Math.max(f.a[1], f.b[1]);
  const passage =
    Math.abs(n[2]) > 0.35 &&
    minX < g.x + g.width / 2 &&
    maxX > g.x - g.width / 2 &&
    minZ < g.z1 + 0.5 &&
    maxZ > g.z0 - 0.45;
  if (passage && opening(out, f, s, tier)) {
    if (tier && f.visible && west) crest(out, f, s, style, tier);
    return;
  }
  const niche =
    f.visible &&
    len > 8.5 &&
    ((west && (style === 'gate' || style === 'old' || chapel)) || cloister);
  const base = tier === 0 && !f.visible ? Math.min(...f.top) - 2.8 : null;
  if (niche && tier >= 1) recessedFront(out, f, s, tier, cloister, chapel);
  else {
    face(
      out,
      'stone',
      tower ? 'tower' : chapel ? 'chapel' : 'wall',
      [p(0, base ?? f.base[0]), p(1, base ?? f.base[1]), p(1, f.top[1]), p(0, f.top[0])],
      n,
    );
    if (cloister && tier === 0) {
      // Distant tier keeps the court floor and its open outline; the gallery resolves in the district tier.
      return;
    }
  }
  if (!f.visible) return;
  if ((tower || style === 'gate' || (retaining && tier >= 2)) && len > 3.9)
    crest(out, f, s, style, tier);
  if (!tier || len < 3.7 || retaining || niche) return;
  if (tier >= 2 && len > 5.1)
    band(out, 'cut', 'cut', s, 0, 1, Math.max(1.1, Math.max(...f.base) + 0.36), 0.28, 0.13);
  const slots = Math.max(
    1,
    Math.round(len / (tower ? 10.5 : chapel ? 7.8 : tier === 1 ? 10.9 : 9.65)),
  );
  const rows = tower ? [0.23, 0.56, 0.78] : chapel ? [0.25, 0.58] : [0.26, 0.61];
  for (let i = 0; i < slots; i++) {
    const u = (i + 0.5) / slots,
      foot = Math.max(0.1, mix(f.base[0], f.base[1], u) + 0.87),
      eave = Math.min(...f.top) - 0.74;
    if (tower && i % 2 && tier < 3) continue;
    for (const row of rows) {
      const height = tower ? (tier <= 1 ? 1.96 : 2.62) : chapel ? 6.04 : row > 0.5 ? 3.86 : 2.72,
        top = foot + (eave - foot) * row;
      if (top + height > eave) continue;
      const w = (tower ? 0.15 : chapel ? 0.39 : 0.29) / slots;
      lancet(out, s, u, w, top, height, tier, chapel || (!tower && tier >= 3));
    }
    if (tier >= 2 && chapel) {
      const z = i / slots,
        top = Math.min(...f.top) - 0.39;
      pillar(out, s, z, foot, top - foot, 0.69, 0.24, 'cut');
      pillar(out, s, z, foot, top - foot - 0.41, 0.41, 0.37, 'trim');
    }
  }
}
function westArcadeScreen(out, tier) {
  if (!tier) return;
  const g = layout.gate,
    n = [-0.145, 0, -0.989],
    count = 6,
    width = 6.46,
    start = g.x - width * 3.5;
  const p = (x, y, d = 0) => [x, y, g.westZ - (x - g.x) * 0.14665 - 0.98 - d],
    top = 12.57,
    spring = 9.16,
    rise = 2.71;
  for (let bay = 0; bay < count; bay++) {
    const x = start + bay * width,
      end = x + width,
      left = x + 0.64,
      right = end - 0.64;
    for (const [a, b] of [
      [x, left],
      [right, end],
    ]) {
      face(out, 'stone', 'wall', [p(a, -1.19), p(b, -1.19), p(b, top), p(a, top)], n);
      if (tier >= 2)
        face(
          out,
          'cut',
          'cut',
          [p(b, -1.19), p(b, -1.19, -0.97), p(b, top, -0.97), p(b, top)],
          undefined,
        );
    }
    const segments = tier === 1 ? 4 : tier === 2 ? 7 : 12;
    for (let i = 0; i < segments; i++) {
      const a = i / segments,
        b = (i + 1) / segments,
        u = mix(left, right, a),
        v = mix(left, right, b),
        y = arch(a, spring, rise),
        h = arch(b, spring, rise);
      face(out, 'cut', 'cut', [p(u, y), p(v, h), p(v, top), p(u, top)], n);
      face(out, 'cut', 'weathered', [p(u, y), p(v, h), p(v, h, -1.04), p(u, y, -1.04)], down);
      if (tier >= 3)
        face(
          out,
          'cut',
          'trim',
          [p(u, y, 0.036), p(v, h, 0.036), p(v, h + 0.18, 0.035), p(u, y + 0.18, 0.035)],
          n,
        );
    }
  }
  const end = start + count * width;
  face(
    out,
    'cut',
    'cut',
    [
      p(start, top - 0.21, 0.11),
      p(end, top - 0.21, 0.11),
      p(end, top + 0.26, 0.11),
      p(start, top + 0.26, 0.11),
    ],
    n,
  );
  face(
    out,
    'cut',
    'trim',
    [
      p(start, top + 0.26, 0.11),
      p(end, top + 0.26, 0.11),
      p(end, top + 0.26, -1.08),
      p(start, top + 0.26, -1.08),
    ],
    up,
  );
}
function westPortal(out, tier) {
  westArcadeScreen(out, tier);
  const g = layout.gate,
    w = g.width / 2;
  const floor = (z) => corridorY(z);
  face(
    out,
    'paving',
    'lightPaving',
    [
      [g.x - w, g.floor, g.z0],
      [g.x + w, g.floor, g.z0],
      [g.x + w, g.courtY, g.z1],
      [g.x - w, g.courtY, g.z1],
    ],
    up,
  );
  if (tier >= 1) {
    for (const side of [-1, 1]) {
      const x = g.x + side * w;
      face(
        out,
        'stone',
        'weathered',
        [
          [x, g.floor, g.z0],
          [x, g.courtY, g.z1],
          [x, g.courtY + g.spring, g.z1],
          [x, g.floor + g.spring, g.z0],
        ],
        [-side, 0, 0],
      );
    }
    const count = tier === 1 ? 5 : tier === 2 ? 8 : 16;
    for (let i = 0; i < count; i++) {
      const a = i / count,
        b = (i + 1) / count,
        x = g.x - w + g.width * a,
        q = g.x - w + g.width * b,
        h = arch(a, g.spring, g.rise),
        j = arch(b, g.spring, g.rise);
      face(
        out,
        'cut',
        'weathered',
        [
          [x, floor(g.z0) + h, g.z0],
          [x, floor(g.z1) + h, g.z1],
          [q, floor(g.z1) + j, g.z1],
          [q, floor(g.z0) + j, g.z0],
        ],
        down,
      );
    }
  }
  if (tier >= 1) {
    const z = g.westZ - 0.44;
    const s = { len: 10, n: [0, 0, -1], p: (u, y, d = 0) => [g.x + (u - 0.5) * 10, y, z - d] };
    band(out, 'cut', 'cut', s, 0.13, 0.87, 11.05, 0.63, 0.29);
    lancet(out, s, 0.5, 0.253, 15.42, 5.07, tier, true);
    if (tier >= 2)
      for (const a of [0.32, 0.44, 0.56, 0.68]) {
        const x = s.p(a, 0)[0];
        rod(out, 'cut', 'weathered', [x, 11.6, z - 0.34], [x, 13.63, z - 0.67], 0.22, 0.23);
      }
  }
  for (const { x, z, radius: r, tip } of layout.turretCenters) {
    const n = tier === 0 ? 5 : tier === 1 ? 7 : 10;
    const shaft = [
      [9.63, 0.2],
      [10.82, r * 0.87],
      [12.25, r],
      [25.9, r * 0.89],
      [26.5, r * 0.96],
    ];
    loft(
      out,
      'cut',
      shaft.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      colors.cut,
      { cap: false },
    );
    const roof = [
      [26.41, r * 1.06],
      [27.2, r * 0.96],
      [30.7, r * 0.62],
      [tip, 0.052],
    ];
    loft(
      out,
      'cut',
      roof.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      colors.slate,
    );
    if (tier >= 2) {
      for (const y of [15.0, 20.34, 24.1]) {
        const w = 0.17,
          d = z - r + 0.028;
        face(
          out,
          'iron',
          'dark',
          [
            [x - w, y, d],
            [x + w, y, d],
            [x + w, y + 1.08, d],
            [x - w, y + 1.08, d],
          ],
          [0, 0, -1],
        );
      }
      for (let i = 0; i < n; i++) {
        const a = (2 * Math.PI * i) / n,
          b = [x + r * Math.cos(a), 26.89, z + r * Math.sin(a)],
          q = [x + 0.13 * Math.cos(a), tip - 0.9, z + 0.13 * Math.sin(a)];
        if (tier >= 3) rod(out, 'cut', 'weathered', b, q, 0.048, 0.04);
      }
    }
  }
}
function approach(out, tier) {
  const { rows } = layout.approach;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i],
      l = (r) => [r.x - r.width / 2, r.y, r.z],
      h = (r) => [r.x + r.width / 2, r.y, r.z];
    face(out, 'paving', 'lightPaving', [l(a), h(a), h(b), l(b)], up);
    for (const side of [-1, 1]) {
      const p = side < 0 ? l(a) : h(a),
        q = side < 0 ? l(b) : h(b),
        d = [side, 0, 0];
      face(out, 'cut', 'weathered', [[p[0], a.base, p[2]], [q[0], b.base, q[2]], q, p], d);
      if (tier >= 2 && i > 1) {
        const shift = (p, x, y) => [p[0] + side * x, p[1] + y, p[2]];
        face(
          out,
          'cut',
          'cut',
          [
            shift(p, 0.07, 0.065),
            shift(q, 0.07, 0.065),
            shift(q, -0.31, 0.065),
            shift(p, -0.31, 0.065),
          ],
          up,
        );
        if (tier >= 3 && i < rows.length - 1) {
          const mid = [(p[0] + q[0]) * 0.5, (p[1] + q[1]) * 0.5, (p[2] + q[2]) * 0.5];
          face(
            out,
            'cut',
            'cut',
            [
              shift(p, -0.3, 0.11),
              shift(mid, -0.3, 0.11),
              shift(mid, -0.6, 0.11),
              shift(p, -0.6, 0.11),
            ],
            up,
          );
        }
      }
    }
  }
}
function gardens(out, tier) {
  for (const c of layout.courts)
    flat(out, 'paving', c.style === 'garden' ? 'soil' : 'lightPaving', c.ring, c.level);
  if (!tier) return;
  const upper = layout.courts[1],
    lower = layout.courts[2],
    old = layout.courts[3];
  const beds = [
    ...[-1, 1].flatMap((s) =>
      [9.9, 17.3, 24.4, 31.5].map((x) => [x, 42.2 + s * 3.55, 5.25, 5.85, upper.level]),
    ),
    ...[-29, -24.9, -20.7].map((x) => [x, 38.3, 3.15, 9.8, lower.level]),
    [29.9, -2.36, 12.4, 9.67, old.level],
  ];
  for (const [i, [x, z, w, d, y]] of beds.entries()) {
    flat(out, 'garden', i % 2 ? 'green' : 'leaf', rect(x, z, w, d), y + 0.054);
    if (tier >= 2)
      for (const side of [-1, 1]) {
        flat(out, 'paving', 'paving', rect(x, z + side * d * 0.51, w + 0.06, 0.19), y + 0.063);
      }
    if (tier >= 3 && i < 11) {
      const n = tier === 4 ? 5 : 3;
      for (let j = 0; j < n; j++)
        flat(
          out,
          'garden',
          'leaf',
          rect(x - w * 0.44 + (w * 0.88 * (j + 0.5)) / n, z, (w * 0.43) / n, d * 0.84),
          y + 0.092,
        );
    }
  }
}
function roofs(out, w, tier) {
  const { style } = w,
    slot = style === 'tower' || style === 'retaining' ? 'paving' : 'tile',
    tone =
      style === 'tower' || style === 'retaining'
        ? 'paving'
        : style === 'gate'
          ? 'tileBrown'
          : 'tile';
  for (const p of w.roofs) roofTriangles(out, slot, tone, p.rings, p.heights);
  if (tier >= 3 && style === 'chapel')
    for (const p of w.roofs) {
      const outer = p.rings[0],
        y = p.heights[0];
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length,
          [a, b] = outer[i],
          [x, z] = outer[j],
          len = Math.hypot(x - a, z - b);
        if (len > 12 && Math.abs(y[j] - y[i]) < 0.08)
          rod(out, 'tile', 'tileBrown', [a, y[i] + 0.069, b], [x, y[j] + 0.069, z], 0.14, 0.13);
      }
    }
}
export function buildAvignonLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Palais des Papes tier ${level}`);
  for (const w of tier <= 1 ? layout.coarseWings : layout.wings) {
    roofs(out, w, tier);
    for (const f of w.faces) façade(out, w, f, tier);
  }
  westPortal(out, tier);
  approach(out, tier);
  gardens(out, tier);
}
export const buildAvignonSkyline = (out) => buildAvignonLevel(out, 'skyline');
export const buildAvignonDistrict = (out) => buildAvignonLevel(out, 'district');
export const buildAvignonStreet = (out) => buildAvignonLevel(out, 'street');
export const buildAvignonCloseup = (out) => buildAvignonLevel(out, 'closeup');
