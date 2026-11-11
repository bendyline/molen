/** The Baroque Zwinger, aligned with the mapped courtyard, arcades and moat crossing. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { prism } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL('../../../content/worldgen/source/places/u3/u31/zwinger/layout.json', import.meta.url),
  ),
);
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.99 },
  roof: { slot: 'roof', graph: 'metal_copper', metallic: 0.39, roughness: 0.67 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  glazing: { slot: 'window', graph: 'metal_painted', metallic: 0.03, roughness: 0.73 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.67, roughness: 0.45 },
  lawn: { slot: 'foundation', graph: 'earth_rammed', roughness: 1 },
};
const palette = {
  wall: [0.62, 0.53, 0.42],
  trim: [0.73, 0.66, 0.54],
  base: [0.46, 0.42, 0.36],
  roof: [0.26, 0.53, 0.47],
  slate: [0.31, 0.36, 0.37],
  glazing: [0.085, 0.139, 0.129],
  bronze: [0.97, 0.64, 0.16],
  lawn: [0.27, 0.39, 0.125],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
const shade = (i, j = 0) =>
  0.93 + (((Math.imul(i + 179, 53017) ^ Math.imul(j + 17, 7119)) >>> 4) % 997) / 7100;
const neg = (v) => v.map((x) => -x);
function renderer(out) {
  return (slot, points, dir, tone = 1) => {
    for (let j = 1; j < points.length - 1; j++) {
      const ps = [points[0], points[j], points[j + 1]].map((v) => v.map(Math.fround));
      let n = normalFor(...ps);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((sum, v, i) => sum + v * dir[i], 0) < 0) {
        ps.reverse();
        n = neg(n);
      }
      out.addTriangle(
        slot,
        ref,
        ps,
        n,
        undefined,
        palette[slot].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const bevel = (x, z, w, d, b) => [
  [x - w / 2 + b, z - d / 2],
  [x + w / 2 - b, z - d / 2],
  [x + w / 2, z - d / 2 + b],
  [x + w / 2, z + d / 2 - b],
  [x + w / 2 - b, z + d / 2],
  [x - w / 2 + b, z + d / 2],
  [x - w / 2, z + d / 2 - b],
  [x - w / 2, z - d / 2 + b],
];
const mass = (f, slot, ring, y0, y1) => prism(f, slot, { outline: ring }, y0, y1, false);
function top(f, slot, ring, y, tone = 1) {
  const ix = earcut(ring.flatMap(([x, z]) => [x, z]));
  for (let i = 0; i < ix.length; i += 3)
    f(
      slot,
      ix.slice(i, i + 3).map((k) => {
        const [x, z, h] = ring[k];
        return [x, typeof y === 'function' ? y(h) : y, z];
      }),
      up,
      tone,
    );
}
function span(a, b, side = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    n = [(-dz / length) * side, 0, (dx / length) * side];
  return {
    length,
    n,
    p: (u, y, v = 0) => [
      mix(a[0], b[0], u / length) + v * n[0],
      y,
      mix(a[1], b[1], u / length) + v * n[2],
    ],
  };
}
function panel(f, slot, F, u0, u1, y0, y1, v, tone = 1) {
  f(slot, [F.p(u0, y0, v), F.p(u1, y0, v), F.p(u1, y1, v), F.p(u0, y1, v)], F.n, tone);
}
function arch(c, r, base, rise, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [c - r * Math.cos(t), base + rise * Math.sin(t)];
  });
}
function archWindow(f, F, c, w, y, h, v, tier, tone = 1) {
  const r = w / 2,
    s = y + h - r * 0.84,
    n = [0, 3, 5, 9, 12][tier];
  if (n < 1) return;
  const arc = arch(c, r, s, r * 0.84, n);
  panel(f, 'glazing', F, c - r, c + r, y, s, v, tone);
  for (let i = 0; i < n; i++) {
    const [a, b] = arc.slice(i, i + 2);
    f('glazing', [F.p(c, s, v), F.p(...a, v), F.p(...b, v)], F.n, tone);
  }
  if (tier < 2) return;
  const t = 0.15 + w * 0.035,
    outer = arch(c, r + t, s, r * 0.84 + t, n),
    d = v + 0.027;
  for (let i = 0; i < n; i++)
    f(
      'trim',
      [F.p(...arc[i], d), F.p(...arc[i + 1], d), F.p(...outer[i + 1], d), F.p(...outer[i], d)],
      F.n,
      shade(i, 3),
    );
  panel(f, 'trim', F, c - r - t, c - r, y - 0.1, s, d);
  panel(f, 'trim', F, c + r, c + r + t, y - 0.1, s, d);
  panel(f, 'trim', F, c - r - 0.27, c + r + 0.27, y - 0.17, y + 0.045, d + 0.046);
  panel(f, 'base', F, c - 0.042, c + 0.042, y, s + 0.19, d + 0.019);
  if (tier >= 3) {
    for (const frac of [0.28, 0.63])
      panel(
        f,
        'base',
        F,
        c - r + 0.04,
        c + r - 0.04,
        mix(y, s, frac),
        mix(y, s, frac) + 0.065,
        d + 0.026,
      );
    panel(
      f,
      'trim',
      F,
      c - 0.14,
      c + 0.14,
      arc[Math.floor(n / 2)][1] + 0.05,
      arc[Math.floor(n / 2)][1] + 0.37,
      d + 0.033,
    );
  }
}
function band(f, F, y0, y1, v, w, slot = 'trim') {
  const a = F.p(0, 0, v),
    b = F.p(F.length, 0, v),
    c = F.p(F.length, 0, v - w),
    d = F.p(0, 0, v - w);
  mass(
    f,
    slot,
    [a, b, c, d].map(([x, , z]) => [x, z]),
    y0,
    y1,
  );
}
function ornamental(f, slot, x, z, rx, rz, profile, segments, tone = 1) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: segments }, (_, i) => {
      const t = ((i + 0.5) * 2 * Math.PI) / segments;
      return [x + rx * r * Math.cos(t), y, z + rz * r * Math.sin(t)];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < segments; i++) {
      const k = (i + 1) % segments,
        a = rings[j - 1],
        b = rings[j],
        t = ((i + 1) * 2 * Math.PI) / segments;
      f(slot, [a[i], a[k], b[k], b[i]], [Math.cos(t), 0.08, Math.sin(t)], tone * shade(i, j));
    }
  f(slot, rings.at(-1), up, tone);
}
function balustrade(f, F, height, tier) {
  if (tier === 0) return;
  if (tier > 1) band(f, F, height, height + 0.16, 0.11, 0.31);
  band(f, F, height + 0.77, height + 0.9, 0.1, 0.3);
  const n = Math.max(1, Math.round(F.length / (tier === 1 ? 3.7 : tier === 2 ? 1.32 : 0.84)));
  for (let i = 0; i < n; i++) {
    const u = (F.length * (i + 0.5)) / n,
      [x, , z] = F.p(u, 0, -0.044);
    if (tier < 3) panel(f, 'trim', F, u - 0.075, u + 0.075, height + 0.15, height + 0.8, 0.034);
    else
      ornamental(
        f,
        'trim',
        x,
        z,
        0.115,
        0.115,
        [
          [height + 0.14, 1],
          [height + 0.32, 0.62],
          [height + 0.49, 0.94],
          [height + 0.76, 0.69],
        ],
        4,
      );
  }
}
function gallery(f, w, tier) {
  const height = Math.max(...w.path.map((p) => p[2])) + 5.7,
    base = Math.min(...w.path.map((p) => p[2])) - 1.45;
  if (tier === 0) {
    const sides = [0, -w.width].map((v) =>
      w.path.map((p, i) => {
        const n = span(
          w.path[Math.max(0, i - 1)],
          w.path[Math.min(w.path.length - 1, i + 1)],
          w.side,
        ).n;
        return [p[0] + v * n[0], p[1] + v * n[2]];
      }),
    );
    mass(f, 'wall', [...sides[0], ...sides[1].reverse()], base, height);
    return;
  }
  for (let i = 1; i < w.path.length; i++) {
    const a = w.path[i - 1],
      b = w.path[i],
      F = span(a, b, w.side);
    // Miters align the terrace walk and avoid wedge gaps between curved wall sections.
    const edge = (k, v) => {
      const p = w.path[k],
        before = k > 0 ? span(w.path[k - 1], p, w.side).n : F.n,
        after = k + 1 < w.path.length ? span(p, w.path[k + 1], w.side).n : F.n;
      const [x, z] = [before[0] + after[0], before[2] + after[2]],
        d = x * after[0] + z * after[2];
      return [p[0] + (x * v) / d, p[1] + (z * v) / d];
    };
    const a0 = edge(i - 1, 0),
      a1 = edge(i, 0),
      b1 = edge(i, -w.width),
      b0 = edge(i - 1, -w.width);
    mass(f, 'wall', [a0, a1, b1, b0], base, height);
    if (tier > 1) band(f, F, height - 0.39, height + 0.03, 0.15, w.width + 0.23);
    if (tier > 1) band(f, F, height - 4.55, height - 4.25, 0.09, 0.28, 'base');
    const n = Math.max(1, Math.round(F.length / (tier === 1 ? 4.35 : 3.06)));
    for (let j = 0; j < n; j++) {
      const c = (F.length * (j + 0.5)) / n,
        delta = F.length / n,
        y = height - 4.06;
      archWindow(f, F, c, Math.min(2.18, delta * 0.68), y, 3.35, 0.018, tier, shade(j, i));
      if (tier >= 2 && j > 0) {
        const u = (F.length * j) / n;
        panel(f, 'trim', F, u - 0.13, u + 0.13, y - 0.18, height - 0.31, 0.098);
        panel(f, 'trim', F, u - 0.25, u + 0.25, height - 0.73, height - 0.47, 0.13);
      }
    }
    balustrade(f, F, height + 0.038, tier);
    if (tier >= 3) {
      const outer = span(b1, b0, w.side);
      balustrade(f, outer, height + 0.038, tier === 4 ? 3 : 2);
    }
  }
}
function hipped(f, slot, x, z, w, d, y, peak, axis = 'z', sections = 1) {
  const ring = rect(x, z, w, d),
    long = axis === 'z',
    dw = long ? w * 0.2 : w * 0.69,
    dd = long ? d * 0.69 : d * 0.2;
  const ridge = rect(x, z, dw, dd),
    L = ring.map(([x, z]) => [x, y, z]),
    H = ridge.map(([x, z]) => [x, y + peak, z]);
  for (let j = 0; j < 4; j++) {
    const k = (j + 1) % 4,
      dir = [
        [0, 0.3, -1],
        [1, 0.3, 0],
        [0, 0.3, 1],
        [-1, 0.3, 0],
      ][j];
    for (let i = 0; i < sections; i++) {
      const a = i / sections,
        b = (i + 1) / sections,
        at = (r, t) => r[j].map((v, i) => mix(v, r[k][i], t));
      f(slot, [at(L, a), at(L, b), at(H, b), at(H, a)], dir, shade(j, i));
    }
  }
  f(slot, H, up);
}
function curvedSteps(f, x, z, y, dir, rx, rz, tier) {
  if (tier === 0) return;
  const seg = tier === 1 ? 6 : tier === 2 ? 10 : 16,
    steps = tier === 1 ? 1 : tier === 2 ? 4 : 6;
  for (let j = 0; j < steps; j++) {
    const t = j / steps,
      level = y - 0.99 + t * 1.18,
      loop = Array.from({ length: seg + 1 }, (_, i) => {
        const a = (Math.PI * i) / seg;
        return [x + Math.sin(a) * rx * (1 - t * 0.5) * dir, z + Math.cos(a) * rz * (1 - t * 0.31)];
      });
    mass(f, j % 2 === 0 ? 'trim' : 'wall', loop, level, level + 1.18 / steps);
  }
}
function pavilion(f, p, tier) {
  const floor = p.floor,
    eave = p.roofY;
  if (tier > 0)
    mass(f, 'base', rect(p.x, p.z, p.w + 0.4, p.d + 0.48), p.ground - 2.2, floor + 0.25);
  mass(
    f,
    'wall',
    tier === 0 ? rect(p.x, p.z, p.w, p.d) : bevel(p.x, p.z, p.w, p.d, 0.45),
    tier === 0 ? p.ground - 1.9 : floor,
    eave,
  );
  hipped(f, 'roof', p.x, p.z, p.w + 0.61, p.d + 0.55, eave + 0.04, 3.3, 'z', tier >= 3 ? 10 : 1);
  if (tier === 0) return;
  const xl = p.x - p.w / 2,
    xr = p.x + p.w / 2,
    za = p.z - p.d / 2,
    zb = p.z + p.d / 2;
  for (const [i, F] of [
    span([xr, za], [xr, zb], -1),
    span([xl, zb], [xl, za], -1),
    span([xl, za], [xr, za], -1),
    span([xr, zb], [xl, zb], -1),
  ].entries()) {
    band(f, F, eave - 0.4, eave + 0.06, 0.22, 0.33);
    if (tier > 1) band(f, F, floor + 0.08, floor + 0.32, 0.11, 0.24, 'base');
    const n = i < 2 ? (tier === 1 ? 5 : 7) : tier === 1 ? 2 : 3;
    for (let j = 0; j < n; j++) {
      const u = (F.length * (j + 0.5)) / n;
      archWindow(f, F, u, i < 2 ? 2.4 : 2.1, floor + 0.77, eave - floor - 2.34, 0.022, tier);
      if (tier >= 2 && j > 0) {
        const a = (F.length * j) / n;
        panel(f, 'trim', F, a - 0.24, a + 0.24, floor + 0.18, eave - 0.28, 0.112);
        panel(f, 'trim', F, a - 0.4, a + 0.4, eave - 0.91, eave - 0.58, 0.157);
      }
    }
  }
  curvedSteps(f, p.x + (p.front * p.w) / 2, p.z, floor, p.front, 4.45, 8.3, tier);
  if (tier >= 3)
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        const z = p.z + ((j - 2) * (p.d - 2.0)) / 4,
          x = p.x + side * (p.w / 2 + 0.14);
        ornamental(
          f,
          'trim',
          x,
          z,
          0.25,
          0.25,
          [
            [eave, 0.98],
            [eave + 0.43, 0.6],
            [eave + 0.8, 0.27],
          ],
          5,
        );
      }
}
function endPavilion(f, p, tier) {
  const { x, z, rx, rz, ground, floor, roofY } = p,
    r = bevel(x, z, 2 * rx, 2 * rz, Math.min(rx, rz) * 0.48);
  if (tier > 0) mass(f, 'base', r, ground - 2.0, floor + 0.55);
  mass(f, 'wall', r, tier === 0 ? ground - 1.9 : floor, roofY);
  ornamental(
    f,
    'roof',
    x,
    z,
    rx * 1.08,
    rz * 1.065,
    tier === 0
      ? [
          [roofY, 0.96],
          [roofY + 2.5, 0.78],
          [roofY + 4.05, 0.59],
          [roofY + 5.15, 0.26],
        ]
      : [
          [roofY, 0.96],
          [roofY + 0.85, 0.9],
          [roofY + 2.5, 0.78],
          [roofY + 4.05, 0.59],
          [roofY + 4.7, 0.31],
          [roofY + 5.15, 0.26],
        ],
    tier >= 3 ? 16 : 8,
  );
  if (tier === 0) return;
  for (let i = 0; i < r.length; i++) {
    const F = span(r[i], r[(i + 1) % r.length], -1),
      l = F.length;
    if (tier > 1) band(f, F, roofY - 0.49, roofY + 0.045, 0.22, 0.4);
    if (tier > 1) band(f, F, floor + 3.65, floor + 3.94, 0.1, 0.32);
    for (const [j, y] of [floor + 0.4, floor + 4.34].entries()) {
      const n = i % 2 === 0 ? (tier === 1 ? 2 : 3) : 1;
      for (let k = 0; k < n; k++)
        archWindow(
          f,
          F,
          ((k + 0.5) * l) / n,
          Math.min((l / n) * 0.56, 2.27),
          y,
          j === 0 ? 3.08 : 5.72,
          0.035,
          tier,
        );
    }
  }
  curvedSteps(f, x + p.front * rx, z, floor + 0.06, p.front, 4.75, 7.15, tier);
  if (tier >= 2)
    for (const [i, [px, pz]] of r.entries()) {
      ornamental(
        f,
        'trim',
        px,
        pz,
        0.42,
        0.42,
        [
          [roofY - 0.25, 1],
          [roofY + 0.5, 0.86],
          [roofY + 1.08, 0.53],
          [roofY + 1.65, 0.18],
        ],
        tier >= 3 ? 7 : 5,
        shade(i),
      );
    }
}
function throughWall(f, F, w, base, y0, spring, rise, topY, tier, slot = 'wall') {
  const n = [3, 6, 10, 15, 19][tier],
    left = (F.length - w) / 2,
    right = left + w;
  const arc = arch(F.length / 2, w / 2, spring, rise, n);
  for (const d of [0, -base]) {
    const G = d === 0 ? F : { ...F, n: neg(F.n) };
    panel(f, slot, G, 0, left, y0, topY, d);
    panel(f, slot, G, right, F.length, y0, topY, d);
    for (let i = 0; i < n; i++) {
      const [a, b] = arc.slice(i, i + 2);
      f(slot, [F.p(...a, d), F.p(...b, d), F.p(b[0], topY, d), F.p(a[0], topY, d)], G.n);
    }
    if (tier < 2) continue;
    const outer = arch(F.length / 2, w / 2 + 0.25, spring, rise + 0.25, n),
      off = d + (d === 0 ? 0.031 : -0.031);
    for (let i = 0; i < n; i++)
      f(
        'trim',
        [
          F.p(...arc[i], off),
          F.p(...arc[i + 1], off),
          F.p(...outer[i + 1], off),
          F.p(...outer[i], off),
        ],
        G.n,
        shade(i),
      );
  }
  for (let i = 0; i < n; i++) {
    const [a, b] = arc.slice(i, i + 2);
    f(
      'base',
      [F.p(...a, 0), F.p(...b, 0), F.p(...b, -base), F.p(...a, -base)],
      [0, -1, 0],
      shade(i),
    );
  }
  for (const [u, y, dir] of [
    [0, topY, [-1, 0, 0]],
    [left, spring, [1, 0, 0]],
    [right, spring, [-1, 0, 0]],
    [F.length, topY, [1, 0, 0]],
  ]) {
    const n0 = F.p(dir[0], 0, 0).map((v, i) => v - F.p(0, 0, 0)[i]);
    f(slot, [F.p(u, y0, 0), F.p(u, y0, -base), F.p(u, y, -base), F.p(u, y, 0)], n0);
  }
  f(
    'trim',
    [F.p(0, topY, 0), F.p(F.length, topY, 0), F.p(F.length, topY, -base), F.p(0, topY, -base)],
    up,
  );
}
function semper(f, s, tier) {
  const { x, z, w, d, y } = s,
    L = x - w / 2,
    R = x + w / 2,
    A = z - d / 2,
    B = z + d / 2,
    p = s.portalX,
    roof = y + 18.9;
  if (tier > 0) {
    mass(f, 'base', rect((L + p - 4.65) / 2, z, p - 4.65 - L, d + 0.32), y - 2.2, y + 2.36);
    mass(f, 'base', rect((p + 4.65 + R) / 2, z, R - p - 4.65, d + 0.32), y - 2.2, y + 2.36);
  }
  mass(
    f,
    'wall',
    rect((L + p - 4.65) / 2, z, p - 4.65 - L, d),
    tier === 0 ? y - 2.2 : y + 1.78,
    roof,
  );
  mass(
    f,
    'wall',
    rect((p + 4.65 + R) / 2, z, R - p - 4.65, d),
    tier === 0 ? y - 2.2 : y + 1.78,
    roof,
  );
  const F = span([p - 4.65, B + 0.36], [p + 4.65, B + 0.36], 1);
  throughWall(f, F, 4.25, d + 0.72, y - 2.2, y + 4.4, 2.13, roof + 0.8, tier);
  for (const [x0, x1] of [
    [L, p - 5.9],
    [p + 5.9, R],
  ]) {
    const cx = (x0 + x1) / 2,
      width = x1 - x0;
    hipped(f, 'slate', cx, z, width + 0.55, d + 0.5, roof + 0.03, 4.45, 'x', tier >= 3 ? 8 : 1);
    if (tier >= 2)
      for (const [i, sgn] of [-1, 1].entries())
        for (let j = 0; j < 7; j++) {
          const px = x0 + ((j + 0.5) * width) / 7,
            pz = z + sgn * 6.6;
          const frame = span([px - 1.1, pz - 0.9], [px + 1.1, pz - 0.9], 1);
          // Low sloped skylights sit on the roof above the gallery.
          const v = sgn * 0.29,
            cy = roof + 3.27;
          f(
            'glazing',
            [
              frame.p(0, cy + v, 0),
              frame.p(2.2, cy + v, 0),
              frame.p(2.2, cy - v, 1.65),
              frame.p(0, cy - v, 1.65),
            ],
            up,
            1.45 + shade(j, i) * 0.17,
          );
        }
  }
  ornamental(
    f,
    'slate',
    p,
    z,
    6.52,
    6.55,
    tier === 0
      ? [
          [roof + 0.8, 1],
          [y + 25.4, 0.91],
          [y + 28.32, 0.13],
        ]
      : [
          [roof + 0.8, 1],
          [y + 22.3, 1],
          [y + 25.4, 0.91],
          [y + 27.0, 0.54],
          [y + 28.1, 0.34],
          [y + 28.32, 0.13],
        ],
    8,
  );
  if (tier === 0) return;
  for (const F of [span([L, B], [R, B], 1), span([R, A], [L, A], 1)]) {
    for (const [a, b] of [
      [0, F.length / 2 - 4.7],
      [F.length / 2 + 4.7, F.length],
    ]) {
      const K = span([F.p(a, 0)[0], F.p(a, 0)[2]], [F.p(b, 0)[0], F.p(b, 0)[2]], 1);
      band(f, K, roof - 0.62, roof + 0.09, 0.24, 0.45);
      if (tier > 1) band(f, K, y + 9.58, y + 9.98, 0.17, 0.37);
      if (tier > 1) band(f, K, y + 2.06, y + 2.39, 0.17, 0.39, 'base');
      const count = tier === 1 ? 7 : 13;
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * K.length) / count;
        archWindow(f, K, u, tier === 1 ? 2.0 : 2.22, y + 2.88, 5.38, 0.025, tier, 1.15);
        archWindow(f, K, u, tier === 1 ? 2.0 : 2.33, y + 10.58, 6.25, 0.026, tier, 1.18);
        if (tier >= 2 && j > 0) {
          const k = (j * K.length) / count;
          panel(f, 'trim', K, k - 0.19, k + 0.19, y + 9.91, roof - 0.57, 0.14);
          panel(f, 'trim', K, k - 0.27, k + 0.27, y + 17.7, roof - 0.56, 0.18);
        }
      }
    }
  }
}
function crownGate(f, c, tier) {
  const { x, z, w, d, ground: y } = c,
    F = span([x - w / 2, z + d / 2], [x + w / 2, z + d / 2], 1);
  throughWall(f, F, 3.54, d, y - 1.4, y + 4.15, 1.77, y + 8.05, tier);
  const cap = bevel(x, z, w + 0.25, d + 0.15, 0.8);
  mass(f, 'trim', cap, y + 8.05, y + 8.68);
  mass(f, 'wall', bevel(x, z, w - 0.45, d - 0.4, 1.23), y + 8.66, y + 13.0);
  ornamental(
    f,
    'roof',
    x,
    z,
    w * 0.57,
    d * 0.55,
    [
      [y + 12.84, 0.83],
      [y + 13.55, 1],
      [y + 15.05, 0.96],
      [y + 16.48, 0.68],
      [y + 17.3, 0.49],
      [y + 18.18, 0.46],
      [y + 18.72, 0.24],
    ],
    tier >= 3 ? 16 : 8,
  );
  ornamental(
    f,
    'bronze',
    x,
    z,
    1.14,
    1.14,
    [
      [y + 18.58, 0.7],
      [y + 19.22, 0.78],
      [y + 19.49, 0.97],
      [y + 19.72, 0.88],
      [y + 20.04, 0.45],
      [y + 20.62, 0.23],
    ],
    tier >= 3 ? 12 : 6,
  );
  if (tier === 0) return;
  for (const [i, side] of [-1, 1].entries()) {
    const Z = z + (side * d) / 2,
      F = span([x - side * w * 0.47, Z], [x + side * w * 0.47, Z], 1);
    archWindow(f, F, F.length / 2, 2.8, y + 9.11, 3.56, -0.15, tier);
    for (const sign of [-1, 1]) {
      const px = x + sign * (w * 0.39),
        pz = Z + side * 0.1;
      ornamental(
        f,
        'trim',
        px,
        pz,
        0.4,
        0.4,
        [
          [y - 0.14, 1.13],
          [y + 0.36, 0.91],
          [y + 5.05, 0.66],
          [y + 5.73, 0.89],
          [y + 6.18, 1.15],
        ],
        tier >= 3 ? 8 : 5,
      );
      ornamental(
        f,
        'trim',
        px,
        pz,
        0.36,
        0.36,
        [
          [y + 8.54, 0.97],
          [y + 9.09, 0.7],
          [y + 9.75, 0.46],
          [y + 10.14, 0.19],
        ],
        tier >= 3 ? 7 : 5,
      );
      if (tier >= 2)
        ornamental(
          f,
          'bronze',
          x + sign * 1.39,
          z + side * 1.35,
          0.25,
          0.25,
          [
            [y + 16.19, 1],
            [y + 16.76, 0.71],
            [y + 17.24, 0.43],
          ],
          6,
          shade(i),
        );
    }
  }
}
function stoneBridge(f, b, tier) {
  const [a, c] = b.route,
    F = span(a, c, 1),
    width = b.width,
    h = F.length,
    n = 3,
    y = (u) => mix(...b.y, u / h);
  const crown = layout.crown,
    entrance = [crown.x, crown.z - crown.d * 0.5 - 0.58],
    ramp = span(entrance, a, 1);
  const throat = crown.d + 0.78;
  const g = crown.ground + 0.09,
    throatY = mix(g, b.y[0], throat / ramp.length);
  f(
    'trim',
    [
      ramp.p(0, g, -1.59),
      ramp.p(throat, throatY, -1.59),
      ramp.p(throat, throatY, 1.59),
      ramp.p(0, g, 1.59),
    ],
    up,
  );
  f(
    'trim',
    [
      ramp.p(throat, throatY, -1.59),
      ramp.p(ramp.length, b.y[0], -width * 0.5),
      ramp.p(ramp.length, b.y[0], width * 0.5),
      ramp.p(throat, throatY, 1.59),
    ],
    up,
  );
  for (let i = 0; i < n; i++) {
    const u = (i * h) / n,
      v = ((i + 1) * h) / n,
      mid = (u + v) / 2,
      local = span(
        F.p(u, 0, width * 0.5).filter((_, i) => i !== 1),
        F.p(v, 0, width * 0.5).filter((_, i) => i !== 1),
        1,
      );
    throughWall(
      f,
      local,
      Math.min(7.82, local.length * 0.75),
      width,
      b.bed,
      y(mid) - 2.25,
      1.91,
      y(mid) - 0.1,
      tier,
      'base',
    );
    f(
      'trim',
      [
        F.p(u, y(u), -width / 2),
        F.p(v, y(v), -width / 2),
        F.p(v, y(v), width / 2),
        F.p(u, y(u), width / 2),
      ],
      up,
    );
    for (const sign of [-1, 1]) {
      const t = sign * (width / 2 - 0.12),
        d = 0.22;
      f(
        'base',
        [
          F.p(u, y(u) - 0.18, t),
          F.p(v, y(v) - 0.18, t),
          F.p(v, y(v) + 0.77, t),
          F.p(u, y(u) + 0.77, t),
        ],
        F.n.map((x) => x * sign),
      );
      f(
        'trim',
        [
          F.p(u, y(u) + 0.77, t - d),
          F.p(v, y(v) + 0.77, t - d),
          F.p(v, y(v) + 0.77, t + d),
          F.p(u, y(u) + 0.77, t + d),
        ],
        up,
      );
      if (tier > 0) {
        const inside = t - sign * d;
        f(
          'base',
          [
            F.p(u, y(u), inside),
            F.p(v, y(v), inside),
            F.p(v, y(v) + 0.77, inside),
            F.p(u, y(u) + 0.77, inside),
          ],
          F.n.map((x) => -x * sign),
        );
      }
    }
  }
}
function garden(f, tier) {
  if (tier === 0) return;
  for (const lawn of layout.lawns) top(f, 'lawn', lawn, (h) => h + 0.16, 1.12);
  for (const b of layout.basins) {
    const ring = tier < 3 ? b.ring.filter((_, i) => i % 2 === 0) : b.ring,
      [cx, cz] = b.center;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length,
        a = ring[i],
        d = ring[j],
        p = (p, scale, offset) => [mix(cx, p[0], scale), p[2] + offset, mix(cz, p[1], scale)];
      const outward = [a[0] + d[0] - 2 * cx, 0, a[1] + d[1] - 2 * cz];
      f('trim', [p(a, 1.055, 0.27), p(d, 1.055, 0.27), p(d, 0.982, 0.27), p(a, 0.982, 0.27)], up);
      f(
        'base',
        [p(a, 1.055, -0.11), p(d, 1.055, -0.11), p(d, 1.055, 0.27), p(a, 1.055, 0.27)],
        outward,
      );
      if (tier >= 2)
        f(
          'base',
          [p(a, 0.982, 0.27), p(d, 0.982, 0.27), p(d, 0.982, -0.16), p(a, 0.982, -0.16)],
          neg(outward),
        );
    }
    if (tier >= 2)
      ornamental(
        f,
        'trim',
        cx,
        cz,
        0.43,
        0.43,
        [
          [b.ground - 0.15, 1],
          [b.ground + 0.24, 0.72],
          [b.ground + 0.72, 0.43],
        ],
        8,
      );
  }
}
export function buildZwingerLevel(out, level) {
  const tier = tiers[level],
    f = renderer(out);
  for (const p of layout.terraces)
    mass(
      f,
      'base',
      tier === 0
        ? rect(
            ...[0, 1].map((k) => p.ring.reduce((sum, v) => sum + v[k], 0) / p.ring.length),
            20.5,
            24,
          )
        : p.ring,
      p.ground - 1.85,
      p.height,
    );
  for (const w of layout.wings) gallery(f, w, tier);
  for (const p of layout.corners) pavilion(f, p, tier);
  for (const p of layout.ends) endPavilion(f, p, tier);
  semper(f, layout.semper, tier);
  crownGate(f, layout.crown, tier);
  stoneBridge(f, layout.bridge, tier);
  garden(f, tier);
}
export const buildZwingerSkyline = (out) => buildZwingerLevel(out, 'skyline');
export const buildZwingerDistrict = (out) => buildZwingerLevel(out, 'district');
export const buildZwingerStreet = (out) => buildZwingerLevel(out, 'street');
export const buildZwingerCloseup = (out) => buildZwingerLevel(out, 'closeup');
