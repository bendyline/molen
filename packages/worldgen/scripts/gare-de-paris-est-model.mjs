/** Gare de Paris-Est. The two stone terminal halls, their concourse and platform shelters. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u0/u09/gare_de_paris_est/layout.json',
      import.meta.url,
    ),
  ),
);
const stone = { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 };
const zinc = { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.1 };
const iron = { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.16 };
const base = { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 };
const glass = { slot: 'wall', graph: 'glass_frit_triangular', roughness: 0.38 };
const clear = {
  slot: 'window',
  localRef: 'palette:#e5f4ff',
  roughness: 0.3,
  metallic: 0.04,
  alphaMode: 'BLEND',
  baseColorFactor: [1, 1, 1, 0.56],
  doubleSided: true,
};
export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  stone,
  figure: stone,
  clock: stone,
  slate: { slot: 'roof', graph: 'slate', roughness: 0.9 },
  zinc,
  shelter: zinc,
  iron,
  marquise: iron,
  frame: iron,
  black: iron,
  buffer: iron,
  base,
  tactile: base,
  glass,
  roofGlass: glass,
  clear,
};
const palette = {
  ashlar: [0.66, 0.581, 0.467],
  stone: [0.74, 0.663, 0.538],
  figure: [0.54, 0.463, 0.351],
  clock: [0.88, 0.87, 0.775],
  slate: [0.16, 0.193, 0.208],
  zinc: [0.3, 0.351, 0.36],
  shelter: [0.218, 0.265, 0.239],
  iron: [0.065, 0.091, 0.086],
  marquise: [0.13, 0.23, 0.182],
  frame: [0.44, 0.46, 0.419],
  black: [0.035, 0.048, 0.047],
  buffer: [0.43, 0.041, 0.026],
  base: [0.386, 0.359, 0.315],
  tactile: [0.65, 0.588, 0.458],
  glass: [0.112, 0.183, 0.215],
  roofGlass: [0.26, 0.386, 0.422],
  clear: [0.55, 0.69, 0.73],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  south = [0, 0, 1],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t,
  range = (n) => Array.from({ length: n }, (_, i) => i);
const tint = (i, j = 0) =>
  0.91 + (((Math.imul(i + 37, 30323) ^ Math.imul(j + 73, 87211)) >>> 7) % 181) / 1030;
function writer(out) {
  return (role, points, dir, light = 1) => {
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
        palette[role].map((v) => Math.min(1, v * light)),
      );
    }
  };
}
function cap(f, role, rings, toPoint, dir = up, tone = 1) {
  const starts = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(k);
    k += h.length;
  }
  const p = rings.flat(),
    v = p.map(toPoint),
    indices = earcut(p.flat(), starts);
  for (let i = 0; i < indices.length; i += 3)
    f(
      role,
      indices.slice(i, i + 3).map((k) => v[k]),
      dir,
      tone,
    );
}
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
function side(a, b, n) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    w = Math.hypot(dx, dz);
  return {
    w,
    n,
    point: (u, y, offset = 0) => [
      a[0] + (dx * u) / w + n[0] * offset,
      y,
      a[1] + (dz * u) / w + n[2] * offset,
    ],
  };
}
const front = (x0, x1, z) => side([x0, z], [x1, z], south);
function panel(f, role, F, x0, x1, y0, y1, d = 0, tone = 1) {
  if (x1 - x0 < 0.001 || y1 - y0 < 0.001) return;
  f(
    role,
    [F.point(x0, y0, d), F.point(x1, y0, d), F.point(x1, y1, d), F.point(x0, y1, d)],
    F.n,
    tone,
  );
}
function band(f, role, F, x0, x1, lo, hi, d = 0.1, w = 0.24) {
  const p = [
    F.point(x0, 0, d - w),
    F.point(x1, 0, d - w),
    F.point(x1, 0, d),
    F.point(x0, 0, d),
  ].map(([x, , z]) => [x, z]);
  prism(f, role, { outline: p }, lo, hi, false);
}
function profile(f, role, x, z, rings, n = 8) {
  const rows = rings.map(([y, r, scale = 1, offset = 0]) =>
    range(n).map((i) => {
      const a = (2 * Math.PI * i) / n;
      return [x + r * Math.cos(a), y, z + offset + r * scale * Math.sin(a)];
    }),
  );
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < n; i++) {
      const a = rows[j - 1],
        b = rows[j],
        k = (i + 1) % n,
        t = (2 * Math.PI * (i + 0.5)) / n;
      f(role, [a[i], a[k], b[k], b[i]], [Math.cos(t), 0.03, Math.sin(t)], tint(i, j));
    }
  f(role, rows.at(-1), up);
}
function hip(f, x, z, w, d, y, rise, tier) {
  const a = rect(x, z, w + 0.21, d + 0.27).outline,
    b = rect(x, z, w * 0.71, d * 0.6).outline;
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    f(
      'slate',
      [
        [a[i][0], y, a[i][1]],
        [a[k][0], y, a[k][1]],
        [b[k][0], y + rise, b[k][1]],
        [b[i][0], y + rise, b[i][1]],
      ],
      up,
      tint(i),
    );
  }
  cap(f, 'zinc', [b], ([x, z]) => [x, y + rise, z]);
  if (tier >= 2) {
    for (const u of [-0.33, 0, 0.33]) {
      const xx = x + w * u,
        zz = z + d * 0.19;
      block(f, 'ashlar', xx, zz, 0.83, 0.61, y + rise - 0.2, y + rise + 0.79);
      block(f, 'stone', xx, zz, 1.01, 0.78, y + rise + 0.79, y + rise + 0.93);
    }
  }
}
function arch(f, F, role, center, width, spring, rise, z, n, tone = 1) {
  const R = (i) => {
    const a = (Math.PI * i) / n;
    return [center + width * 0.5 * Math.cos(a), spring + rise * Math.sin(a)];
  };
  for (let i = 0; i < n; i++) {
    const [x, y] = R(i),
      [a, b] = R(i + 1);
    f(role, [F.point(center, spring, z), F.point(x, y, z), F.point(a, b, z)], F.n, tone);
  }
}
function window(f, F, x, y, w, h, tier, arched = false) {
  const a = x - w / 2,
    b = x + w / 2,
    top = y + h;
  if (tier <= 1) {
    panel(f, 'stone', F, a - 0.18, b + 0.18, y - 0.18, top + 0.16, 0.05);
    panel(f, 'glass', F, a, b, y, top, 0.073);
    return;
  }
  const s = arched ? top - w * 0.35 : top;
  panel(f, 'glass', F, a, b, y, s, 0.051);
  for (const u of [a, b]) panel(f, 'stone', F, u - 0.102, u + 0.102, y - 0.14, s + 0.025, 0.15);
  band(f, 'stone', F, a - 0.24, b + 0.24, y - 0.143, y + 0.016, 0.19, 0.21);
  if (arched) {
    const n = tier >= 3 ? 9 : 6,
      r = w * 0.35;
    arch(f, F, 'glass', x, w, s, r, 0.052, n);
    for (let i = 0; i < n; i++) {
      const t = (Math.PI * i) / n,
        k = (Math.PI * (i + 1)) / n;
      const R = (a, u) =>
        F.point(x + (w * 0.5 + u) * Math.cos(a), s + (r + u) * Math.sin(a), 0.143);
      f('stone', [R(t, 0), R(k, 0), R(k, 0.15), R(t, 0.15)], F.n, tint(i));
    }
  } else panel(f, 'stone', F, a - 0.18, b + 0.18, top, top + 0.14, 0.132);
  panel(f, 'frame', F, x - 0.048, x + 0.048, y, top - 0.1, 0.081);
  panel(f, 'frame', F, a, b, y + h * 0.5, y + h * 0.5 + 0.058, 0.086);
}
function office(f, B, tier) {
  const { x, z, w, d, wall, roof, frontBays, sideBays } = B,
    b = layout.plinth;
  block(f, 'ashlar', x, z, w, d, b, wall);
  hip(f, x, z, w, d, wall + 0.02, roof - wall, tier);
  if (tier === 0) return;
  const F = [
    front(x - w * 0.5, x + w * 0.5, z + d * 0.5),
    side([x - w * 0.5, z - d * 0.5], [x - w * 0.5, z + d * 0.5], [-1, 0, 0]),
    side([x + w * 0.5, z + d * 0.5], [x + w * 0.5, z - d * 0.5], [1, 0, 0]),
    side([x + w * 0.5, z - d * 0.5], [x - w * 0.5, z - d * 0.5], [0, 0, -1]),
  ];
  for (const [i, S] of F.entries()) {
    const bays = i === 0 || i === 3 ? frontBays : sideBays,
      n = tier === 1 ? Math.max(1, Math.ceil(bays * 0.53)) : bays;
    if (tier === 1 && i === 3) continue;
    panel(f, 'base', S, 0, S.w, b, 2.08, 0.076);
    for (const y of [7.65, 13.0, wall - 0.44]) {
      if (tier <= 2) panel(f, 'stone', S, 0, S.w, y - 0.17, y + 0.095, 0.084);
      else band(f, 'stone', S, 0, S.w, y - 0.17, y + 0.095, 0.23, 0.26);
    }
    for (let j = 0; j < n; j++) {
      const u = (S.w * (j + 0.5)) / n,
        ww = Math.min(2.45, (S.w / n) * 0.59);
      const detail = tier === 2 ? 1 : tier;
      window(f, S, u, 3.19, ww, 3.52, detail, true);
      window(f, S, u, 8.85, ww, 3.13, detail, true);
      if (wall > 19.1 || i === 0)
        window(f, S, u, 14.0, ww * 0.86, Math.min(3.24, wall - 14.82), detail, false);
    }
    if (tier >= 3) {
      for (const u of [0.32, S.w - 0.32])
        for (let j = 0; j < 17; j++) {
          const y = 2.15 + (j * (wall - 2.15)) / 17;
          panel(f, 'stone', S, u - 0.3, u + 0.3, y, y + 0.21, 0.117, tint(j));
        }
      for (let u = 0.5; u < S.w; u += 1.45)
        panel(f, 'stone', S, u - 0.18, u + 0.18, wall - 0.65, wall - 0.39, 0.18);
    }
  }
}
function statue(f, out, H, tier) {
  const x = H.x,
    z = H.front - 1.02,
    y = H.roof,
    staff = H.statue === 'staff';
  block(f, 'stone', x, z, 3.43, 2.22, y - 0.13, y + 0.54);
  if (tier <= 1) {
    profile(
      f,
      'figure',
      x,
      z,
      [
        [y + 0.49, 0.91, 0.88],
        [y + 1.4, 0.81, 0.78],
        [y + 2.14, 0.45, 0.85],
        [y + 2.48, 0.28, 0.8],
        [y + 3.05, 0.105, 0.81],
      ],
      6,
    );
    return;
  }
  const N = tier >= 3 ? 14 : 8;
  profile(
    f,
    'figure',
    x,
    z,
    [
      [y + 0.54, 0.96, 0.89, 0.12],
      [y + 0.88, 0.9, 0.87, 0.17],
      [y + 1.41, 0.78, 0.68, 0.02],
      [y + 2.03, 0.48, 0.79, -0.18],
      [y + 2.34, 0.34, 0.81, -0.2],
    ],
    N,
  );
  sphere(
    out,
    'figure',
    [x, y + 2.63, z - 0.13],
    [0.29, 0.377, 0.272],
    palette.figure,
    N,
    tier >= 3 ? 7 : 5,
  );
  profile(
    f,
    'stone',
    x,
    z - 0.15,
    [
      [y + 2.88, 0.276],
      [y + 3.0, 0.28],
      [y + 3.05, 0.13],
    ],
    N,
  );
  for (const a of [-1, 1]) {
    sphere(
      out,
      'figure',
      [x + a * 0.43, y + 1.01, z + 0.49],
      [0.49, 0.35, 0.57],
      palette.figure,
      N,
      5,
    );
    beam(
      out,
      'figure',
      [x + a * 0.33, y + 2.15, z - 0.13],
      [x + a * 0.71, y + 1.48, z + 0.4],
      0.26,
      0.23,
      palette.figure,
    );
  }
  if (staff)
    beam(
      out,
      'iron',
      [x + 0.93, y + 0.45, z + 0.45],
      [x + 0.93, y + 3.11, z + 0.41],
      0.081,
      0.083,
      palette.iron,
    );
  else {
    const S = front(x - 1.29, x - 0.28, z + 0.72);
    cap(
      f,
      'stone',
      [
        [
          [0.1, y + 1.19],
          [0.1, y + 1.98],
          [0.9, y + 1.98],
          [0.9, y + 1.19],
          [0.51, y + 0.92],
        ],
      ],
      ([a, b]) => S.point(a, b),
      south,
    );
  }
  if (tier === 4)
    for (const a of [-0.57, -0.35, -0.13, 0.13, 0.35, 0.57]) {
      beam(
        out,
        'figure',
        [x + a * 0.49, y + 2.06, z + 0.14],
        [x + a, y + 1.36, z + 0.64],
        0.059,
        0.042,
        palette.figure,
      );
    }
}
function clock(f, out, F, u, y, tier) {
  const n = tier >= 3 ? 30 : tier >= 2 ? 20 : 10;
  const disc = (r, role, d) =>
    f(
      role,
      range(n).map((i) => {
        const a = (2 * Math.PI * i) / n;
        return F.point(u + Math.cos(a) * r, y + Math.sin(a) * r, d);
      }),
      F.n,
    );
  disc(1.78, 'stone', 0.24);
  disc(1.45, 'clock', 0.31);
  for (const [a, r] of [
    [0.52, 1.08],
    [2.23, 0.79],
  ]) {
    const A = F.point(u, y, 0.37),
      B = F.point(u + r * Math.cos(a), y + r * Math.sin(a), 0.37);
    if (tier >= 2) beam(out, 'black', A, B, 0.087, 0.046, palette.black);
    else f('black', [F.point(u - 0.1, y, 0.37), B, F.point(u + 0.1, y, 0.37)], F.n);
  }
  if (tier >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (2 * Math.PI * i) / 12,
        cos = Math.cos(a),
        sin = Math.sin(a);
      f(
        'black',
        [
          F.point(u + 1.12 * cos - 0.041 * sin, y + 1.12 * sin + 0.041 * cos, 0.373),
          F.point(u + 1.33 * cos - 0.041 * sin, y + 1.33 * sin + 0.041 * cos, 0.373),
          F.point(u + 1.33 * cos + 0.041 * sin, y + 1.33 * sin - 0.041 * cos, 0.373),
          F.point(u + 1.12 * cos + 0.041 * sin, y + 1.12 * sin - 0.041 * cos, 0.373),
        ],
        F.n,
      );
    }
}
function fanWall(f, out, H, tier) {
  const { x, w, front: z, back, cornice, roof, archWidth, archRise } = H,
    F = front(x - w * 0.5, x + w * 0.5, z),
    u = w * 0.5,
    spring = 8.85;
  const top = (a) => roof - ((roof - cornice) * Math.abs(a - u)) / u;
  const n = tier === 0 ? 6 : tier === 1 ? 10 : tier === 2 ? 18 : 28;
  const edge = range(n + 1).map((i) => {
    const a = (Math.PI * i) / n;
    return [u - archWidth * 0.5 * Math.cos(a), spring + archRise * Math.sin(a)];
  });
  const fill = [[0, spring], ...edge, [w, spring], [w, cornice], [u, roof], [0, cornice]];
  cap(f, 'ashlar', [fill], ([a, b]) => F.point(a, b), F.n);
  for (let i = 1; i < edge.length; i++) {
    const [a, b] = edge[i - 1],
      [c, d] = edge[i];
    f(
      tier <= 1 ? 'roofGlass' : 'clear',
      [F.point(u, spring, -0.31), F.point(a, b, -0.31), F.point(c, d, -0.31)],
      F.n,
      tint(i),
    );
    if (tier >= 1) {
      const expand = ([a, b], e) => [u + (a - u) * (1 + e), spring + (b - spring) * (1 + e)];
      const A = expand([a, b], 0.053),
        B = expand([c, d], 0.053);
      f(
        'stone',
        [F.point(a, b, 0.122), F.point(c, d, 0.122), F.point(...B, 0.122), F.point(...A, 0.122)],
        F.n,
        tint(i),
      );
      if (tier >= 2) {
        f(
          'stone',
          [F.point(a, b, -0.31), F.point(c, d, -0.31), F.point(c, d, 0.115), F.point(a, b, 0.115)],
          [0, -1, 0.1],
        );
        const t = i % 2 === 0 ? 0.096 : 0.06;
        beam(out, 'iron', F.point(u, spring, -0.24), F.point(a, b, -0.24), t, 0.07, palette.iron);
      }
    }
  }
  if (tier >= 2) {
    for (const r of [0.32, 0.59, 0.84])
      for (let j = 1; j < edge.length; j++) {
        const p = ([a, b]) => [mix(u, a, r), mix(spring, b, r)];
        const A = p(edge[j - 1]),
          B = p(edge[j]);
        f(
          'iron',
          [
            F.point(...A, -0.216),
            F.point(...B, -0.216),
            F.point(B[0], B[1] + 0.09, -0.216),
            F.point(A[0], A[1] + 0.09, -0.216),
          ],
          F.n,
        );
      }
    for (let j = 1; j < 29; j++) {
      const a = (w * j) / 29,
        y = top(a) - 0.9;
      panel(f, 'stone', F, a - 0.32, a + 0.32, y - 0.33, y + 0.1, 0.096, tint(j));
    }
  }
  if (tier >= 1) clock(f, out, F, u, 8.82, tier);
  const P = (a, b) => [x - w / 2 + a, top(a), b];
  for (const [a, b] of [
    [0, w * 0.5],
    [w * 0.5, w],
  ]) {
    const p = [P(a, back), P(b, back), P(b, z), P(a, z)];
    f('zinc', p, up);
    if (tier >= 1)
      f(
        'zinc',
        p.map(([x, y, z]) => [x, y - 0.13, z]),
        down,
        0.83,
      );
    if (tier >= 2) {
      const v = mix(a, b, 0.54),
        W = 2.16;
      f(
        'roofGlass',
        [P(v - W, back + 0.5), P(v + W, back + 0.5), P(v + W, z - 1.9), P(v - W, z - 1.9)].map(
          ([x, y, z]) => [x, y + 0.018, z],
        ),
        up,
      );
      for (let i = 1; i < 17; i++) {
        const q = mix(back, z, i / 17),
          A = P(a, q),
          B = P(b, q);
        f('frame', [A, B, [B[0], B[1] + 0.09, B[2]], [A[0], A[1] + 0.09, A[2]]], [0, 0, 1]);
      }
    }
  }
  for (const a of [0, w]) {
    const A = [x - w / 2 + a, layout.plinth, back],
      B = [A[0], layout.plinth, z],
      y = cornice;
    f('ashlar', [A, B, [B[0], y, z], [A[0], y, back]], [a === 0 ? -1 : 1, 0, 0]);
  }
  const rear = side([x + w * 0.5, back], [x - w * 0.5, back], [0, 0, -1]);
  cap(
    f,
    'ashlar',
    [
      [
        [0, layout.plinth],
        [w, layout.plinth],
        [w, cornice],
        [w * 0.5, roof],
        [0, cornice],
      ],
    ],
    ([a, b]) => rear.point(a, b),
    rear.n,
  );
  statue(f, out, H, tier);
}
function arcades(f, H, stairs, tier) {
  const F = front(H.x - H.w * 0.5, H.x + H.w * 0.5, H.front + 0.13),
    count = tier === 0 ? 5 : H.arcades,
    unit = F.w / count,
    lo = stairs.landing,
    top = 8.85;
  const spring = lo + 2.87,
    rise = Math.min(1.71, unit * 0.37),
    jamb = unit * 0.113,
    n = tier <= 1 ? 4 : tier === 2 ? 8 : 12;
  for (let i = 0; i < count; i++) {
    const c = unit * (i + 0.5),
      a = c - unit * 0.5 + jamb,
      b = c + unit * 0.5 - jamb;
    panel(f, 'ashlar', F, c - unit * 0.5, a, lo, top);
    panel(f, 'ashlar', F, b, c + unit * 0.5, lo, top);
    const arc = range(n + 1).map((i) => [
      c + (b - a) * 0.5 * Math.cos((Math.PI * i) / n),
      spring + rise * Math.sin((Math.PI * i) / n),
    ]);
    for (let j = 0; j < n; j++) {
      const [x, y] = arc[j],
        [u, v] = arc[j + 1];
      f('stone', [F.point(x, y), F.point(u, v), F.point(u, top), F.point(x, top)], F.n, tint(i, j));
      if (tier >= 2)
        f(
          'stone',
          [F.point(x, y, -1.0), F.point(u, v, -1.0), F.point(u, v), F.point(x, y)],
          [0, -1, 0],
        );
    }
    if (tier >= 2) {
      for (const u of [a, b])
        f(
          'stone',
          [F.point(u, lo, -1.0), F.point(u, spring, -1.0), F.point(u, spring), F.point(u, lo)],
          [u === a ? 1 : -1, 0, 0],
        );
      const p = F.point(c - unit * 0.5, 0, 0.51);
      profile(
        f,
        'stone',
        p[0],
        p[2],
        [
          [lo, 0.37],
          [lo + 0.15, 0.39],
          [lo + 0.32, 0.28],
          [spring - 0.19, 0.25],
          [spring, 0.36],
        ],
        tier >= 3 ? 12 : 7,
      );
    }
    if (tier >= 1) {
      const open = i >= 3 && i <= 5;
      if (!open) panel(f, 'glass', F, a, b, lo + 0.07, spring, -1.42, 0.78);
      else
        for (const sign of [-1, 1]) {
          const edge = c + sign * (b - a) * 0.5,
            inner = c + sign * 0.86;
          panel(
            f,
            'clear',
            F,
            Math.min(edge, inner),
            Math.max(edge, inner),
            lo + 0.025,
            spring,
            -1.42,
          );
        }
      arch(f, F, 'clear', c, b - a, spring, rise, -1.42, n, 0.87);
      if (tier >= 2) {
        panel(f, 'frame', F, a, b, spring - 0.07, spring + 0.037, -1.38);
        for (const u of [a + 0.07, c - 0.89, c + 0.89, b - 0.07])
          panel(f, 'frame', F, u - 0.045, u + 0.045, lo, spring, -1.39);
      }
    }
  }
  if (tier >= 1) band(f, 'stone', F, 0, F.w, 8.48, 8.73, 0.26, 0.36);
}
function terrace(f, S, tier) {
  const n = tier === 0 ? 2 : tier === 1 ? 4 : S.x < 0 ? 10 : 7,
    front = S.z + 2.68,
    back = S.z;
  for (let i = 0; i < n; i++) {
    const a = mix(front, back, i / n),
      b = mix(front, back, (i + 1) / n),
      x = S.x - S.w * 0.5,
      u = S.x + S.w * 0.5;
    const y = S.grade.map((g) => mix(g + 0.13, S.landing, (i + 1) / n));
    const A = [x, y[0], a],
      B = [u, y[1], a];
    f('base', [A, B, [u, y[1], b], [x, y[0], b]], up);
    f('base', [[x, layout.plinth, a], [u, layout.plinth, a], B, A], south);
  }
  block(f, 'base', S.x, (S.z + 43.35) * 0.5, S.w, S.z - 43.35, layout.plinth, S.landing);
}
function marquise(f, out, tier) {
  const { x0, x1, z0, z1, height: y } = layout.streetLedge;
  const points = [
    [x0, y + 0.5, z0],
    [x1, y + 0.5, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  f(tier >= 2 ? 'clear' : 'roofGlass', points, up, 0.78);
  const F = front(x0, x1, z1);
  panel(f, 'marquise', F, 0, F.w, y - 0.36, y + 0.025);
  if (tier === 0) return;
  const n = tier === 1 ? 18 : tier === 2 ? 40 : 58;
  for (let i = 0; i <= n; i++) {
    const x = mix(x0 + 0.05, x1 - 0.05, i / n),
      p = [x, y + 0.39, z0 + 0.12],
      q = [x, y - 0.068, z1 - 0.09];
    if (tier >= 2) beam(out, 'marquise', p, q, 0.093, 0.138, palette.marquise);
    else f('marquise', [p, q, [q[0], q[1] - 0.17, q[2]], [p[0], p[1] - 0.17, p[2]]], [1, 0, 0]);
    if (tier >= 3 && i % 3 === 0)
      beam(
        out,
        'marquise',
        [x, y - 1.28, z0 + 0.08],
        [x, y - 0.24, z1 - 0.19],
        0.099,
        0.128,
        palette.marquise,
      );
  }
  if (tier >= 2)
    for (const H of layout.halls) {
      const B = front(H.x - 17.2, H.x + 17.2, z0 + 0.31);
      panel(f, 'stone', B, 0, B.w, 8.04, 8.22, 0.2);
      for (let u = 0.25; u < B.w; u += 0.56)
        panel(f, 'stone', B, u - 0.071, u + 0.071, 7.73, 8.06, 0.18);
    }
  if (tier >= 2) {
    const glyph = {
      G: [
        [
          [0.9, 0.85],
          [0.72, 1],
          [0.24, 1],
          [0, 0.78],
          [0, 0.22],
          [0.25, 0],
          [0.77, 0],
          [0.9, 0.18],
          [0.9, 0.45],
          [0.55, 0.45],
        ],
      ],
      A: [
        [
          [0, 0],
          [0.46, 1],
          [0.92, 0],
        ],
        [
          [0.22, 0.42],
          [0.7, 0.42],
        ],
      ],
      R: [
        [
          [0, 0],
          [0, 1],
          [0.68, 1],
          [0.9, 0.83],
          [0.9, 0.66],
          [0.68, 0.52],
          [0, 0.52],
        ],
        [
          [0.45, 0.52],
          [0.96, 0],
        ],
      ],
      E: [
        [
          [0.9, 1],
          [0, 1],
          [0, 0],
          [0.9, 0],
        ],
        [
          [0, 0.51],
          [0.76, 0.51],
        ],
      ],
      D: [
        [
          [0, 0],
          [0, 1],
          [0.58, 1],
          [0.88, 0.79],
          [0.88, 0.21],
          [0.58, 0],
          [0, 0],
        ],
      ],
      L: [
        [
          [0, 1],
          [0, 0],
          [0.91, 0],
        ],
      ],
      S: [
        [
          [0.9, 0.84],
          [0.73, 1],
          [0.23, 1],
          [0.06, 0.85],
          [0.06, 0.63],
          [0.23, 0.53],
          [0.73, 0.44],
          [0.9, 0.29],
          [0.9, 0.14],
          [0.72, 0],
          [0.21, 0],
          [0.01, 0.13],
        ],
      ],
      T: [
        [
          [0, 1],
          [0.96, 1],
        ],
        [
          [0.48, 1],
          [0.48, 0],
        ],
      ],
      "'": [
        [
          [0.37, 0.79],
          [0.54, 0.99],
        ],
      ],
    };
    const name = "GARE DE L'EST",
      left = layout.halls[0].x - 5.3;
    panel(f, 'marquise', F, left - x0 - 0.42, left - x0 + 11.02, 6.63, 6.73, 0.12);
    for (const [i, ch] of [...name].entries())
      for (const stroke of glyph[ch] ?? [])
        for (let j = 1; j < stroke.length; j++) {
          const [u, v] = stroke[j - 1],
            [a, b] = stroke[j],
            nx = (b - v) * 0.035,
            nz = (u - a) * 0.035;
          const p = (x, y) => [left + i * 0.8 + x * 0.61, 6.83 + y * 0.76, z1 + 0.18];
          f(
            'clock',
            [p(u - nx, v - nz), p(a - nx, b - nz), p(a + nx, b + nz), p(u + nx, v + nz)],
            south,
          );
        }
  }
}
function concourse(f, out, B, tier, extend = false) {
  const { x0, x1, z0, z1, spring, rise } = B,
    n = tier === 0 ? 4 : tier === 1 ? 6 : tier === 2 ? 12 : 18;
  const p = (x, v, d = 0) => [
    x,
    spring + rise * Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)) + d,
    mix(z0, z1, v),
  ];
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      m = (a + b) * 0.5,
      glass = m > 0.39 && m < 0.62;
    const points = [p(x0, a), p(x1, a), p(x1, b), p(x0, b)];
    f(glass ? (tier >= 2 ? 'clear' : 'roofGlass') : 'zinc', points, up, tint(i));
    if (tier >= 1 && !glass)
      f(
        'zinc',
        points.map(([x, y, z]) => [x, y - 0.09, z]),
        down,
        0.89,
      );
  }
  const opening = extend ? 4.86 : 6.62;
  const A = side([x1, z0], [x0, z0], [0, 0, -1]);
  panel(f, 'roofGlass', A, 0, A.w, opening, spring, -0.027, 0.89);
  for (const x of [x0, x1])
    for (let i = 0; i < n; i++) {
      const a = p(x, i / n),
        b = p(x, (i + 1) / n);
      f(
        'roofGlass',
        [[x, layout.plinth, a[2]], [x, layout.plinth, b[2]], b, a],
        [x === x0 ? -1 : 1, 0, 0],
      );
    }
  if (tier >= 1) {
    panel(f, 'marquise', A, 0, A.w, opening - 0.2, opening + 0.1, 0.07);
    const sections = tier === 1 ? 6 : tier === 2 ? 13 : 35;
    for (let i = 1; i < sections; i++) {
      const x = mix(x0, x1, i / sections),
        u = x1 - x;
      panel(f, 'frame', A, u - 0.055, u + 0.055, opening, spring, 0.025);
      for (let j = 0; j < n; j++) {
        const a = j / n,
          b = (j + 1) / n,
          w = tier >= 2 ? 0.13 : 0.19;
        f(
          'iron',
          [p(x - w, a, -0.14), p(x + w, a, -0.14), p(x + w, b, -0.14), p(x - w, b, -0.14)],
          down,
        );
      }
      if (tier >= 2)
        beam(
          out,
          'iron',
          [x, spring - 0.18, z0 + 0.24],
          [x, spring - 0.18, z1 - 0.24],
          0.15,
          0.13,
          palette.iron,
        );
    }
  }
}
function islandPoint(K, u, dy) {
  return [K.x + K.width * u, K.grade + dy, K.z];
}
function shelters(f, out, P, tier) {
  const knots =
    tier === 0
      ? [P.knots[0], P.knots[Math.floor(P.knots.length * 0.55)], P.knots.at(-1)]
      : tier === 1
        ? P.knots.filter((_, i) => i % 3 === 0 || i === P.knots.length - 1)
        : P.knots;
  const floor = 0.64,
    roof = floor + P.height;
  for (let i = 1; i < knots.length; i++) {
    const A = knots[i - 1],
      B = knots[i];
    const p = (u, h) => islandPoint(A, u, h),
      q = (u, h) => islandPoint(B, u, h);
    const Aroof = A.roofGrade - A.grade,
      Broof = B.roofGrade - B.grade;
    f('base', [p(-0.5, floor), p(0.5, floor), q(0.5, floor), q(-0.5, floor)], up);
    for (const sign of [-1, 1]) {
      const edge = 0.5 * sign,
        e = 0.52 * sign;
      if (tier >= 1)
        f(
          'base',
          [p(edge, floor - 0.76), q(edge, floor - 0.76), q(edge, floor), p(edge, floor)],
          [sign, 0, 0],
        );
      if (tier >= 2)
        f(
          'tactile',
          [
            p(edge, floor + 0.013),
            q(edge, floor + 0.013),
            q(edge - sign * 0.041, floor + 0.013),
            p(edge - sign * 0.041, floor + 0.013),
          ],
          up,
        );
      const r = [
        p(0, roof + Aroof + 0.24),
        q(0, roof + Broof + 0.24),
        q(e, roof + Broof - 0.12),
        p(e, roof + Aroof - 0.12),
      ];
      f('shelter', r, up, P.color * tint(i, P.id));
      if (tier >= 1)
        f(
          'shelter',
          r.map(([x, y, z]) => [x, y - 0.045, z]),
          down,
          0.88,
        );
      if (tier >= 2)
        f(
          'iron',
          [
            p(e, roof + Aroof - 0.24),
            q(e, roof + Broof - 0.24),
            q(e, roof + Broof - 0.1),
            p(e, roof + Aroof - 0.1),
          ],
          [sign, 0, 0],
        );
    }
    if (tier >= 1 && (tier !== 2 || i % 2 === 0 || i === knots.length - 1)) {
      const x = B.x,
        z = B.z,
        y = B.grade + floor;
      block(f, 'iron', x, z, 0.235, 0.32, y - 0.02, y + P.height + Broof + 0.05);
      if (tier >= 2)
        for (const sign of [-1, 1]) {
          const a = [x, y + P.height + Broof - 0.84, z],
            b = [x + sign * B.width * 0.5, y + P.height + Broof - 0.13, z];
          if (tier >= 3) beam(out, 'iron', a, b, 0.115, 0.105, palette.iron);
          else f('iron', [a, b, [b[0], b[1] - 0.12, b[2]], [a[0], a[1] - 0.12, a[2]]], [0, 0, 1]);
        }
    }
    if (tier >= 2) {
      const n = Math.max(1, Math.ceil((B.z - A.z) / (tier >= 3 ? 3.9 : 10.4)));
      for (let j = 0; j < n; j++) {
        const s = (j + 0.5) / n,
          K = {
            x: mix(A.x, B.x, s),
            z: mix(A.z, B.z, s),
            width: mix(A.width, B.width, s),
            grade: mix(A.roofGrade, B.roofGrade, s),
          };
        const t = (u, h, d = 0) => {
          const [x, y, z] = islandPoint(K, u, h);
          return [x, y, z + d];
        };
        for (const sign of [-1, 1]) {
          const b = sign * 0.505;
          f(
            'iron',
            [t(0, roof - 0.06), t(b, roof - 0.29), t(b, roof - 0.41), t(0, roof - 0.23)],
            [0, 0, 1],
          );
          if (tier >= 3)
            for (const [u, v] of [
              [0.05, 0.18],
              [0.21, 0.32],
              [0.35, 0.48],
            ]) {
              f(
                'iron',
                [
                  t(u * sign, roof - 0.29),
                  t(v * sign, roof - 0.15),
                  t((v + 0.029) * sign, roof - 0.15),
                  t((u + 0.029) * sign, roof - 0.29),
                ],
                [0, 0, 1],
              );
            }
        }
      }
    }
  }
}
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildParisEstLevel(out, level) {
  const tier = tiers[level],
    f = writer(out);
  for (const B of layout.officeBlocks) office(f, B, tier);
  for (const [i, H] of layout.halls.entries()) {
    fanWall(f, out, H, tier);
    arcades(f, H, layout.stairs[i], tier);
    terrace(f, layout.stairs[i], tier);
  }
  marquise(f, out, tier);
  concourse(f, out, layout.concourse, tier);
  concourse(f, out, layout.concourse.extension, tier, true);
  for (const P of layout.islands) shelters(f, out, P, tier);
}
export const buildParisEstSkyline = (out) => buildParisEstLevel(out, 'skyline');
export const buildParisEstDistrict = (out) => buildParisEstLevel(out, 'district');
export const buildParisEstStreet = (out) => buildParisEstLevel(out, 'street');
export const buildParisEstCloseup = (out) => buildParisEstLevel(out, 'closeup');
