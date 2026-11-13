/** Generalife. Water courts in the palace frame and gardens in the mapped precinct frame. */
import { readFileSync } from 'node:fs';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';
import earcut from './polygon-triangulation.mjs';
export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ey/eyt/generalife/layout.json',
      import.meta.url,
    ),
  ),
);
const plaster = { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 };
const stone = { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93 };
const wood = { slot: 'door', graph: 'wood_plain', roughness: 0.88 };
const water = { slot: 'window', localRef: 'palette:#c8e9ed', roughness: 0.29, metallic: 0.27 };
export const surfaces = {
  plaster,
  green: plaster,
  darkGreen: plaster,
  flower: plaster,
  stone,
  mortar: stone,
  soil: stone,
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  wood,
  shade: wood,
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  water,
  jet: water,
};
const colors = {
  plaster: [0.79, 0.744, 0.607],
  stone: [0.646, 0.534, 0.382],
  mortar: [0.49, 0.397, 0.285],
  soil: [0.355, 0.256, 0.142],
  brick: [0.45, 0.288, 0.19],
  tile: [0.434, 0.279, 0.157],
  wood: [0.268, 0.164, 0.088],
  shade: [0.08, 0.082, 0.057],
  paving: [0.6, 0.51, 0.37],
  water: [0.069, 0.178, 0.18],
  jet: [0.59, 0.79, 0.77],
  green: [0.224, 0.365, 0.124],
  darkGreen: [0.089, 0.193, 0.057],
  flower: [0.51, 0.107, 0.229],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  c = Math.cos(layout.angle),
  s = Math.sin(layout.angle),
  tau = Math.PI * 2;
const range = (n) => Array.from({ length: n }, (_, i) => i),
  mix = (a, b, t) => a + (b - a) * t;
const I = (p) => p,
  arch = ([x, y, z]) => [c * x - s * z, y, s * x + c * z];
function writer(out, project) {
  return (r, poly, dir, tone = 1) => {
    const vs = poly.map((p) => project(p).map(Math.fround)),
      wanted = project(dir);
    for (let i = 1; i < vs.length - 1; i++) {
      const p = [vs[0], vs[i], vs[i + 1]];
      let n = normalFor(...p);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((a, v, j) => a + v * wanted[j], 0) < 0) {
        p.reverse();
        n = n.map((v) => -v);
      }
      out.addTriangle(
        r,
        'palette:#ffffff',
        p,
        n,
        undefined,
        colors[r].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
const rod = (o, P, r, a, b, w, d = w) => beam(o, r, P(a), P(b), w, d, colors[r]);
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function cap(f, r, rings, y, n = up) {
  const offsets = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    offsets.push(k);
    k += h.length;
  }
  const v = rings.flat(),
    ix = earcut(v.flat(), offsets);
  for (let i = 0; i < ix.length; i += 3)
    f(
      r,
      ix.slice(i, i + 3).map((j) => [v[j][0], typeof y === 'number' ? y : y(v[j], j), v[j][1]]),
      n,
    );
}
function side(a, b, sign = 1) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz),
    nx = (sign * dz) / w,
    nz = (-sign * dx) / w;
  return {
    a,
    b,
    w,
    n: [nx, 0, nz],
    point: (u, y, d = 0) => [a[0] + (dx * u) / w + nx * d, y, a[1] + (dz * u) / w + nz * d],
  };
}
function panel(f, r, s, a, b, lo, hi, d = 0, tone = 1) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  f(r, [s.point(a, lo, d), s.point(b, lo, d), s.point(b, hi, d), s.point(a, hi, d)], s.n, tone);
}
function strip(f, r, s, a, b, lo, hi, from, to) {
  if (b - a < 0.001 || hi - lo < 0.001) return;
  const outline = [
    [a, from],
    [b, from],
    [b, to],
    [a, to],
  ].map(([u, d]) => {
    const [x, , z] = s.point(u, 0, d);
    return [x, z];
  });
  prism(f, r, { outline }, lo, hi, false);
}
const ring = (x, z, r, n) =>
  range(n).map((i) => [x + r * Math.cos((tau * i) / n), z + r * Math.sin((tau * i) / n)]);
function hip(f, r, x, z, w, d, y, h, axis = 'x') {
  const A = rect(x, z, w, d).outline,
    B = rect(x, z, w * (axis === 'x' ? 0.81 : 0.12), d * (axis === 'x' ? 0.12 : 0.81)).outline;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      p = (a, k, y) => [a[k][0], y, a[k][1]];
    f(r, [p(A, i, y), p(A, j, y), p(B, j, y + h), p(B, i, y + h)], up, 1 - (i % 3) * 0.025);
  }
  cap(f, r, [B], y + h);
}
const curve = (x, spring, rise, pointed) =>
  spring +
  rise *
    (pointed
      ? 0.76 * Math.sqrt(Math.max(0, 1 - x * x)) + 0.24 * (1 - Math.abs(x))
      : Math.sqrt(Math.max(0, 1 - x * x)));
function arcade(
  f,
  s,
  base,
  top,
  centers,
  width,
  tier,
  { spring = 2.14, rise = 1.02, role = 'plaster', pointed = false, depth = 0.4 } = {},
) {
  const n = [2, 4, 6, 10, 14][tier];
  let last = 0;
  for (const u of centers) {
    const a = u - width * 0.5,
      b = u + width * 0.5;
    panel(f, role, s, last, a, base, top);
    for (let i = 0; i < n; i++) {
      const t0 = (2 * i) / n - 1,
        t1 = (2 * (i + 1)) / n - 1,
        p = mix(a, b, i / n),
        q = mix(a, b, (i + 1) / n);
      const y = curve(t0, base + spring, rise, pointed),
        z = curve(t1, base + spring, rise, pointed);
      f(role, [s.point(p, y), s.point(q, z), s.point(q, top), s.point(p, top)], s.n);
      if (tier >= 2) {
        f(
          'stone',
          [s.point(p, y), s.point(q, z), s.point(q, z, -depth), s.point(p, y, -depth)],
          down,
        );
        f(
          'stone',
          [
            s.point(p, y, 0.031),
            s.point(q, z, 0.031),
            s.point(q, z + 0.16, 0.031),
            s.point(p, y + 0.16, 0.031),
          ],
          s.n,
          0.93 + (i % 4) * 0.027,
        );
      }
    }
    if (tier >= 2)
      for (const [v, k] of [
        [a, -1],
        [b, 1],
      ]) {
        f(
          'stone',
          [
            s.point(v, base),
            s.point(v, base, -depth),
            s.point(v, base + spring, -depth),
            s.point(v, base + spring),
          ],
          [-s.n[2] * k, 0, s.n[0] * k],
        );
        panel(f, 'stone', s, v - 0.08, v + 0.08, base - 0.005, base + spring, 0.036);
      }
    last = b;
  }
  panel(f, role, s, last, s.w, base, top);
}
function shutters(f, s, base, top, n, tier) {
  if (tier === 0) return;
  for (let i = 0; i < n; i++) {
    const w = Math.min(1.17, (s.w / n) * 0.52),
      u = (s.w * (i + 0.5)) / n;
    panel(f, 'shade', s, u - w * 0.5, u + w * 0.5, base, top, 0.019);
    if (tier >= 2) {
      for (const x of [u - w * 0.5, u + w * 0.5])
        panel(f, 'stone', s, x - 0.068, x + 0.068, base - 0.09, top + 0.09, 0.053);
      panel(f, 'wood', s, u - 0.047, u + 0.047, base, top, 0.059);
      strip(f, 'stone', s, u - w * 0.62, u + w * 0.62, base - 0.09, base + 0.035, -0.02, 0.18);
    }
  }
}
function vegetation(f, o, P, x, z, y, h, type, tier) {
  const n = tier === 0 ? 4 : tier === 1 ? 5 : 8;
  if (type === 'cypress') {
    const r = h * 0.12,
      rows =
        tier === 0
          ? [
              [0, r * 0.42],
              [0.25, r * 0.95],
              [0.68, r * 0.61],
              [1, 0.019],
            ]
          : [
              [0, r * 0.42],
              [0.21, r * 0.95],
              [0.57, r * 0.73],
              [0.83, r * 0.38],
              [1, 0.019],
            ];
    const verts = rows.map(([a, b]) => ring(x, z, b, n).map(([u, v]) => [u, y + a * h, v]));
    for (let j = 1; j < verts.length; j++)
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          p = verts[j - 1][i],
          a = (tau * (i + 0.5)) / n;
        f(
          'darkGreen',
          [p, verts[j - 1][k], verts[j][k], verts[j][i]],
          [Math.cos(a), 0.23, Math.sin(a)],
          0.9 + (i % 4) * 0.055,
        );
      }
  } else {
    rod(o, P, 'wood', [x, y, z], [x, y + h * 0.68, z], 0.12);
    sphere(
      o,
      'green',
      P([x, y + h * 0.71, z]),
      [h * 0.39, h * 0.33, h * 0.37],
      colors.green,
      n,
      tier >= 2 ? 5 : 3,
    );
    if (tier >= 3)
      for (let i = 0; i < 6; i++) {
        const a = (i * tau) / 6,
          u = x + Math.cos(a) * h * 0.28,
          v = z + Math.sin(a) * h * 0.27;
        sphere(
          o,
          'stone',
          P([u, y + h * (0.68 + (i % 2) * 0.12), v]),
          [0.072, 0.076, 0.072],
          [0.71, 0.38, 0.07],
          5,
          3,
        );
      }
  }
}
function walls(f, o, tier) {
  const [A, C, G] = layout.courts;
  for (const T of [A, C, G]) {
    const { ring, y, bottom, holes } = T;
    if (tier === 0) {
      prism(f, 'paving', { outline: ring, holes }, bottom, y, false);
      continue;
    }
    prism(f, 'stone', { outline: ring, holes }, bottom, y - 0.12, false);
    cap(f, 'paving', [ring, ...holes], y);
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length];
      f(
        'stone',
        [
          [p[0], y - 0.12, p[1]],
          [q[0], y - 0.12, q[1]],
          [q[0], y, q[1]],
          [p[0], y, p[1]],
        ],
        [q[1] - p[1], 0, p[0] - q[0]],
      );
    }
  }
  const y = A.y,
    upper = y + 7.4,
    F = side([-147.1, -50.91], [-147.1, -31.0]),
    back = side([-154.65, -31], [-154.65, -50.91]);
  arcade(f, F, y, y + 4.28, [3.08, 7.1, 10.08, 13.2, 16.79], 2.15, tier, {
    spring: 2.22,
    rise: 1.23,
    pointed: true,
  });
  arcade(f, F, upper, upper + 3.39, [4.04, 9.41, 14.78], 3.62, tier, { spring: 1.61, rise: 1.0 });
  panel(f, 'plaster', F, 0, F.w, y + 4.29, upper);
  panel(f, 'plaster', back, 0, back.w, y, upper + 3.39);
  block(f, 'plaster', -151.42, -49.29, 7.36, 4.15, y - 4.8, upper + 3.62);
  hip(f, 'tile', -151.45, -49.35, 7.52, 4.28, upper + 3.62, 1.24, 'z');
  hip(f, 'tile', -150.93, -39.12, 8.17, 16.74, upper + 3.38, 1.19, 'z');
  hip(f, 'tile', -146.3, -41.02, 3.8, 20.42, y + 4.25, 1.1, 'z');
  shutters(f, F, y + 5.29, y + 6.77, 9, tier);
  if (tier >= 2)
    for (const v of [4.04, 9.41, 14.78]) {
      strip(f, 'wood', F, v - 1.71, v + 1.71, upper + 0.02, upper + 0.24, -0.12, 0.13);
      for (const u of range(11).map((i) => v - 1.69 + i * 0.338))
        panel(f, 'wood', F, u - 0.038, u + 0.038, upper + 0.12, upper + 0.81, 0.117);
    }
  const west = side([-146.95, -34.03], [-102.17, -34.04]),
    wBack = side([-102.17, -30.94], [-146.95, -30.91]);
  const n = tier === 0 ? 5 : tier === 1 ? 8 : 13;
  for (const side of [west, wBack])
    arcade(
      f,
      side,
      y,
      y + 3.93,
      range(n).map((i) => (side.w * (i + 0.5)) / n),
      (side.w / n) * 0.7,
      tier,
      { spring: 1.77, rise: 1.08, pointed: true },
    );
  hip(f, 'tile', -124.54, -32.43, 45.19, 3.42, y + 3.94, 0.83);
  block(f, 'brick', -125.6, -51.31, 42.41, 1.01, y - 0.06, y + 4.44);
  hip(f, 'tile', -125.6, -51.29, 42.65, 1.28, y + 4.45, 0.39);
  if (tier >= 1) {
    const s = side([-146.72, -50.78], [-104.24, -50.78], -1);
    shutters(f, s, y + 2.93, y + 3.8, 13, tier);
  }
  const gy = G.y;
  const south = side([-99.96, -31.5], [-99.96, -49.5], -1);
  arcade(f, south, y, y + 5.64, [4.14, 8.92, 13.36], 3.12, tier, {
    spring: 2.17,
    rise: 1.44,
    pointed: true,
  });
  hip(f, 'tile', -98.2, -40.72, 6.51, 18.53, y + 5.64, 1.56, 'z');
  for (const [x, z, w, d, h] of [
    [-85.85, -20.31, 8.57, 22.35, 5.78],
    [-95.1, -11.22, 12.67, 4.25, 4.75],
    [-92.42, -34.4, 6.32, 8.87, 5.52],
  ]) {
    block(f, 'plaster', x, z, w, d, gy - 3.71, gy + h);
    hip(f, 'tile', x, z, w + 0.24, d + 0.27, gy + h, 1.31, w > d ? 'x' : 'z');
  }
  const sy = C.y,
    h = 3.38,
    S = side([-154.18, -70.0], [-154.18, -51.31]),
    T = side([-149.09, -51.31], [-149.09, -70.0]);
  for (const F of [S, T]) {
    const n = [3, 5, 7, 7, 7][tier],
      bays = range(n).map((i) => (F.w * (i + 0.5)) / n),
      w = (F.w / n) * 0.73;
    arcade(f, F, sy, sy + h, bays, w, tier, { spring: 1.95, rise: 0.93 });
    arcade(f, F, sy + h, sy + 2 * h, bays, w, tier, { spring: 1.74, rise: 1.05 });
    if (tier >= 2) strip(f, 'stone', F, 0, F.w, sy + h - 0.08, sy + h + 0.15, -0.06, 0.16);
  }
  hip(f, 'tile', -151.66, -60.67, 5.53, 19.0, sy + 2 * h, 1.15, 'z');
  block(f, 'brick', -135.48, -70.14, 36.0, 0.65, sy - 0.15, sy + 2.56);
  block(f, 'stone', -116.68, -62.2, 0.58, 15.9, sy - 0.02, sy + 1.23);
  if (tier > 0) {
    const M = layout.mirador,
      px = M.ring.reduce((v, p) => v + p[0] / M.ring.length, 0),
      pz = M.ring.reduce((v, p) => v + p[1] / M.ring.length, 0);
    prism(f, 'stone', { outline: M.ring }, M.base, M.floor, false);
    for (const [dx, dz] of [
      [-3.35, -1.48],
      [-3.35, 1.48],
      [3.35, -1.48],
      [3.35, 1.48],
    ])
      rod(
        o,
        arch,
        'plaster',
        [px + dx, M.floor, pz + dz],
        [px + dx, M.floor + 3.08, pz + dz],
        0.39,
      );
    hip(f, 'tile', px, pz, 9.42, 4.93, M.floor + 3.14, 1.67);
  } else {
    const M = layout.mirador,
      mid = M.ring.reduce(
        ([a, b], p) => [a + p[0] / M.ring.length, b + p[1] / M.ring.length],
        [0, 0],
      );
    prism(f, 'stone', { outline: M.ring }, M.base, M.floor + 3.14, false);
    hip(f, 'tile', ...mid, 9.42, 4.93, M.floor + 3.14, 1.67);
  }
}
function basin(f, o, P, B, tier) {
  const { rings, y } = B,
    r = rings[0];
  cap(f, 'water', rings, y);
  if (rings.length > 1) {
    prism(f, 'soil', { outline: rings[1] }, y - 0.4, y + 0.4, false);
    if (tier > 0) {
      const R = rings[1],
        mid = R.reduce(([a, b], p) => [a + p[0] / R.length, b + p[1] / R.length], [0, 0]);
      const hedge = R.map((p) => p.map((v, i) => mix(mid[i], v, 0.83)));
      prism(f, 'darkGreen', { outline: hedge }, y + 0.39, y + 0.86, false);
    }
  }
  if (tier === 0) return;
  for (let i = 0; i < r.length; i++) {
    const s = side(r[i], r[(i + 1) % r.length]);
    if (tier === 1) panel(f, 'stone', s, 0, s.w, y - 0.22, y + 0.15);
    else strip(f, 'stone', s, 0, s.w, y - 0.4, y + 0.15, -0.1, 0.09);
    if (tier >= 2 && B.name.includes('Acequia') && s.w > 8) {
      const num = tier === 2 ? 7 : 11;
      for (const j of range(num)) {
        const u = (s.w * (j + 0.5)) / num,
          segments = tier === 2 ? 4 : 7;
        const path = (t) => s.point(u, y + 0.16 + Math.sin(Math.PI * t) * 0.58, 0.48 - 1.07 * t);
        for (let k = 0; k < segments; k++)
          rod(
            o,
            P,
            'jet',
            path(k / segments),
            path((k + 1) / segments),
            tier === 2 ? 0.021 : 0.015,
          );
      }
    }
  }
}
function courtPlants(f, o, tier) {
  const y = layout.courts[0].y;
  for (const side of [-1, 1]) {
    const z = -40.61 + side * 3.0;
    for (const [x, w] of [
      [-139.1, 14.9],
      [-123.7, 13.6],
      [-108.65, 13.8],
    ]) {
      block(f, 'soil', x, z, w, 2.26, y - 0.08, y + 0.115);
      if (tier > 0) {
        block(f, 'darkGreen', x, z + side * 0.98, w, 0.3, y + 0.11, y + 0.53);
        if (tier >= 2)
          for (const i of range(8)) {
            const u = x - w * 0.42 + i * w * 0.119;
            sphere(
              o,
              'flower',
              arch([u, y + 0.33, z + Math.sin(i * 1.14) * 0.38]),
              [0.26, 0.16, 0.21],
              i % 3 === 1 ? colors.flower : colors.green,
              5,
              3,
            );
          }
      }
    }
  }
  if (tier > 0)
    for (const [x, z, h] of [
      [-142.7, -44.8, 3.28],
      [-140.4, -36.4, 3.31],
      [-111.9, -44.18, 2.82],
      [-113.3, -36.93, 2.87],
      [-138, -61.8, 3.56],
    ])
      vegetation(f, o, arch, x, z, z < -50 ? 2.8 : y, h, 'citrus', tier);
  vegetation(f, o, arch, -145.4, -63.84, 2.8, tier === 0 ? 6.25 : 7.1, 'cypress', tier);
  if (tier >= 2) {
    const s = side([-135.3, -50.5], [-129.1, -50.5], -1);
    for (const i of range(11)) {
      const p = s.point(i * 0.53, y + 1.8 + Math.sin(i * 0.59) * 1.28, 0.14);
      sphere(o, 'flower', arch(p), [0.52, 0.39, 0.23], colors.flower, 6, 4);
    }
  }
}
function waterStair(f, o, tier) {
  const { a, b, k, lo, hi, landingFractions, width, steps } = layout.stairs,
    S = side(a, b),
    w = S.w;
  const n = [4, 13, steps, steps, steps][tier],
    fy = (t) => mix(lo, hi, t);
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n,
      y = fy(u);
    strip(f, 'paving', S, w * t, w * u, Math.min(lo - 4.6, y - 2.35), y, -width * 0.5, width * 0.5);
  }
  for (const s of [-1, 1]) {
    const z = s * (width * 0.5 + 0.18);
    const count = tier === 0 ? 4 : tier === 1 ? 7 : 15;
    for (let j = 0; j < count; j++) {
      const u = j / count,
        v = (j + 1) / count,
        p = S.point(w * u, fy(u), z),
        q = S.point(w * v, fy(v), z);
      const a = [p[0], p[1] + 0.77, p[2]],
        b = [q[0], q[1] + 0.77, q[2]];
      const A = S.point(w * u, fy(u) + 0.81, z + 0.3),
        B = S.point(w * v, fy(v) + 0.81, z + 0.3);
      f('plaster', [a, b, B, A], up);
      for (const [d, n] of [
        [z, S.n.map((v) => -v)],
        [z + 0.3, S.n],
      ])
        f(
          'plaster',
          [
            S.point(w * u, fy(u) - 0.38, d),
            S.point(w * v, fy(v) - 0.38, d),
            S.point(w * v, fy(v) + 0.77, d),
            S.point(w * u, fy(u) + 0.77, d),
          ],
          n,
        );
      if (tier > 0)
        rod(
          o,
          arch,
          'water',
          S.point(w * u, fy(u) + 0.789, z + 0.15),
          S.point(w * v, fy(v) + 0.789, z + 0.15),
          0.09,
          0.045,
        );
    }
  }
  if (tier > 0)
    for (const t of landingFractions) {
      const p = S.point(w * t, fy(t), 0),
        rim = ring(p[0], p[2], 0.33, 10),
        inner = ring(p[0], p[2], 0.25, 10);
      prism(f, 'stone', { outline: rim, holes: [inner] }, p[1] + 0.06, p[1] + 0.18, false);
      cap(f, 'water', [inner], p[1] + 0.145);
    }
  const end = side(b, k);
  strip(f, 'paving', end, 0, end.w, hi - 1.25, hi + 0.018, -width * 0.48, width * 0.48);
}
function gardens(f, o, tier) {
  const beds = layout.gardenBeds.slice(0, [7, 12, 25, 25, 25][tier]);
  for (const B of beds) {
    cap(f, tier === 1 ? 'green' : 'soil', [B.ring], (_, i) => B.soil[i]);
    if (tier <= 1) continue;
    for (let i = 0; i < B.ring.length; i++) {
      const j = (i + 1) % B.ring.length,
        a = B.ring[i],
        b = B.ring[j];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.4) continue;
      rod(
        o,
        I,
        'darkGreen',
        [a[0], B.soil[i] + 0.18, a[1]],
        [b[0], B.soil[j] + 0.18, b[1]],
        tier === 1 ? 0.22 : 0.32,
        0.29,
      );
    }
  }
  const trees =
    tier === 0
      ? layout.gardenTrees.filter((p, i) => i % 10 === 0)
      : tier === 1
        ? layout.gardenTrees.filter((p, i) => i % 3 === 0)
        : layout.gardenTrees;
  for (const { x, z, y, h, type } of trees) vegetation(f, o, I, x, z, y, h, type, tier);
}
function theatre(f, o, tier) {
  const T = layout.theatre,
    water = layout.pools[3];
  prism(f, 'stone', { outline: T.outline, holes: [water.rings[0]] }, T.base, T.low, false);
  const [a, b, z0, z1] = T.stage;
  block(f, 'wood', (a + b) * 0.5, (z0 + z1) * 0.5, b - a, z1 - z0, T.low - 0.07, T.y - 0.45);
  if (tier > 0) {
    const stageEdge = side([b, z0], [b, z1]);
    strip(f, 'darkGreen', stageEdge, 0, stageEdge.w, T.y - 0.45, T.y + 4.41, -1.05, 0.26);
    for (const z of [z0 + 0.32, z1 - 0.27]) {
      for (const x of [a + 0.3, a + 2.9])
        rod(o, I, 'shade', [x, T.y - 0.35, z], [x, T.y + 5.15, z], 0.18);
      rod(o, I, 'shade', [a + 0.3, T.y + 5.15, z], [a + 2.9, T.y + 5.15, z], 0.15);
    }
  }
  const n = tier === 0 ? 4 : tier === 1 ? 8 : T.rows;
  for (const i of range(n)) {
    const t = i / n,
      u = (i + 1) / n,
      x0 = mix(T.row0, T.row1, t),
      x1 = mix(T.row0, T.row1, u),
      y = mix(T.y + 0.32, T.low, u);
    block(f, 'paving', (x0 + x1) * 0.5, (T.z0 + T.z1) * 0.5, x1 - x0, T.z1 - T.z0, T.low - 0.09, y);
    if (tier === 0) continue;
    for (const [z, d] of [
      [T.z0 + 5.42, 9.74],
      [T.z1 - 5.46, 9.74],
      [0, 5.64],
    ]) {
      if (tier === 1) {
        cap(f, 'brick', [rect((x0 + x1) * 0.5 - 0.11, z, (x1 - x0) * 0.53, d).outline], y + 0.29);
        continue;
      }
      if (tier < 3) {
        block(f, 'brick', (x0 + x1) * 0.5 - 0.11, z, (x1 - x0) * 0.53, d, y, y + 0.39);
        continue;
      }
      const seats = Math.floor(d / (tier === 4 ? 0.54 : 0.7));
      for (const j of range(seats)) {
        const v = z - d * 0.5 + ((j + 0.5) * d) / seats,
          x = (x0 + x1) * 0.5 - 0.12;
        block(f, 'brick', x, v, 0.47, 0.44, y + 0.13, y + 0.32);
        block(f, 'brick', x - 0.19, v, 0.09, 0.45, y + 0.31, y + 0.67);
      }
    }
  }
}
export function buildGeneralifeLevel(out, level) {
  const tier = ['skyline', 'district', 'street', 'closeup', 'master'].indexOf(level);
  if (tier < 0) throw Error('Unknown Generalife level ' + level);
  const f = writer(out, I),
    p = writer(out, arch);
  walls(p, out, tier);
  for (const B of layout.pools) basin(B.palace ? p : f, out, B.palace ? arch : I, B, tier);
  courtPlants(p, out, tier);
  waterStair(p, out, tier);
  gardens(f, out, tier);
  theatre(f, out, tier);
}
export const buildGeneralifeSkyline = (o) => buildGeneralifeLevel(o, 'skyline');
export const buildGeneralifeDistrict = (o) => buildGeneralifeLevel(o, 'district');
export const buildGeneralifeStreet = (o) => buildGeneralifeLevel(o, 'street');
export const buildGeneralifeCloseup = (o) => buildGeneralifeLevel(o, 'closeup');
