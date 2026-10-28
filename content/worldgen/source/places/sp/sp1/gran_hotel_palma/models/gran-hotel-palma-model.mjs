/** Original Modernista hotel exterior; native whole-building envelope, photo-estimated projections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = f.geometry.outline.slice(0, -1),
  TAU = 2 * Math.PI;
const C = {
  stone: rgb('cec5ae'),
  trim: rgb('dfd5c0'),
  metal: rgb('343d39'),
  glass: rgb('4d6461'),
  plinth: rgb('252e32'),
  decor: rgb('62554a'),
  blue: rgb('4e6991'),
  roof: rgb('a4a69b'),
  white: rgb('dedfd8'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.25 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.37, metallic: 0.06 },
  plinth: { slot: 'foundation', graph: 'stone_granite', roughness: 0.84, metallic: 0 },
  decor: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.8, metallic: 0 },
};
const G = ([x, y, z]) => [x, F + y, z],
  GN = (n) => n,
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const recessEvidence = [],
  nativeEvidence = [],
  bayEvidence = [],
  balconyEvidence = [];
function facade(a, b, name) {
  const u = unit(sub(b, a)),
    n = [u[1], -u[0]],
    L = Math.hypot(...sub(b, a)),
    M = ([x, y, z]) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  return { a, b, u, n, L, name, M };
}
const west = facade(R[0], R[3], 'west'),
  south = facade(R[33], R[0], 'south'),
  facades = [west, south];
const SOURCE_ENTRY_S = 0.6 + (1.5 * (south.L - 3)) / 4;
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((q) => q.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0])),
    N = n && GN(n);
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed authored face');
  if (N && dot(c, N) < 0) [q[1], q[2]] = [q[2], q[1]];
  const normal = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normal,
    q.map((q) => (Math.abs(normal[1]) > 0.8 ? [q[0], q[2]] : [q[0] + q[2], q[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-9 &&
            cr(r[b], r[c], r[k]) >= -1e-9 &&
            cr(r[c], r[a], r[k]) >= -1e-9,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid source ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true, col) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function poly(o, k, r, y0, y1, col) {
  if (r.length < 3) return;
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, y0, false, col);
  cap(o, k, r, y1, true, col);
}
function tube(o, k, a, b, r, N = 6, R = r, col) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    rad = (i) => u.map((x, j) => x * Math.cos((i * TAU) / N) + v[j] * Math.sin((i * TAU) / N)),
    P = (at, i, r) => at.map((x, j) => x + rad(i)[j] * r);
  for (let i = 0; i < N; i++) {
    Q(o, k, [P(a, i, r), P(a, i + 1, r), P(b, i + 1, R), P(b, i, R)], rad(i + 0.5), col);
    T(
      o,
      k,
      [a, P(a, i + 1, r), P(a, i, r)],
      d.map((x) => -x),
      col,
    );
    T(o, k, [b, P(b, i, R), P(b, i + 1, R)], d, col);
  }
}
function cone(o, k, r, y0, y1, col) {
  const center = [
    r.reduce((s, q) => s + q[0], 0) / r.length,
    y1,
    r.reduce((s, q) => s + q[1], 0) / r.length,
  ];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      mid = [(a[0] + b[0]) / 2 - center[0], 0, (a[1] + b[1]) / 2 - center[2]];
    T(o, k, [[a[0], y0, a[1]], [b[0], y0, b[1]], center], mid, col);
  }
  cap(o, k, r, y0, false, col);
}
function archCurve(t, pointed) {
  return pointed
    ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(t, 1 - t)) * (1 - Math.min(t, 1 - t)))) /
        Math.sqrt(0.75)
    : Math.sqrt(Math.max(0, 1 - 4 * (t - 0.5) * (t - 0.5)));
}
/** Front face, physical deep reveals and a back closure only when explicitly requested. */
function archPanel(
  o,
  {
    x0,
    x1,
    y0,
    y1,
    front,
    depth,
    width,
    bottom,
    height,
    pointed = true,
    N = 6,
    glass = false,
    back = false,
    detail = false,
    label = 'opening',
    openingCenter,
    riseRatio = 0.23,
    rect = false,
    backSurface = 'glass',
    backColor = C.glass,
    k = 'stone',
    M = (q) => q,
  },
) {
  N = rect ? 1 : N;
  const center = openingCenter ?? (x0 + x1) / 2,
    l = center - width / 2,
    r = center + width / 2,
    rise = rect ? 0 : width * riseRatio,
    shoulder = bottom + height - rise,
    behind = front - depth,
    P = (x, y, z) => M([x, y, z]),
    direction = (n) => sub(M(n), M([0, 0, 0]));
  if (shoulder <= bottom) throw Error('Opening rise exceeds whole height');
  function solid(a, b, c, d) {
    if (d - c < 1e-6) return;
    const rr = [
        [a, c, front],
        [b, c, front],
        [b, d, front],
        [a, d, front],
      ],
      bb = rr.map((q) => [q[0], q[1], behind]);
    Q(o, k, rr.map(M), direction([0, 0, 1]));
    Q(o, k, bb.map(M), direction([0, 0, -1]));
  }
  for (const [q, n] of [
    [
      [P(x0, y0, front), P(x0, y1, front), P(x0, y1, behind), P(x0, y0, behind)],
      [-1, 0, 0],
    ],
    [
      [P(x1, y0, front), P(x1, y1, front), P(x1, y1, behind), P(x1, y0, behind)],
      [1, 0, 0],
    ],
    [
      [P(x0, y0, front), P(x1, y0, front), P(x1, y0, behind), P(x0, y0, behind)],
      [0, -1, 0],
    ],
    [
      [P(x0, y1, front), P(x1, y1, front), P(x1, y1, behind), P(x0, y1, behind)],
      [0, 1, 0],
    ],
  ])
    Q(o, k, q, direction(n));
  if (l > x0) solid(x0, l, y0, y1);
  if (r < x1) solid(r, x1, y0, y1);
  if (bottom > y0) solid(l, r, y0, bottom);
  for (let j = 0; j < N; j++) {
    const a = l + (width * j) / N,
      b = l + (width * (j + 1)) / N,
      ya = shoulder + rise * archCurve(j / N, pointed),
      yb = shoulder + rise * archCurve((j + 1) / N, pointed);
    Q(
      o,
      k,
      [P(a, ya, front), P(b, yb, front), P(b, y1, front), P(a, y1, front)],
      direction([0, 0, 1]),
    );
    Q(
      o,
      k,
      [P(a, ya, behind), P(b, yb, behind), P(b, y1, behind), P(a, y1, behind)],
      direction([0, 0, -1]),
    );
    Q(
      o,
      'trim',
      [P(a, ya, front), P(b, yb, front), P(b, yb, behind), P(a, ya, behind)],
      direction([yb - ya, -(b - a), 0]),
    );
    if (detail)
      Q(
        o,
        'trim',
        [
          P(a, ya, front + 0.025),
          P(b, yb, front + 0.025),
          P(b, yb + 0.13, front + 0.025),
          P(a, ya + 0.13, front + 0.025),
        ],
        direction([0, 0, 1]),
      );
  }
  for (const [x, sign] of [
    [l, 1],
    [r, -1],
  ])
    Q(
      o,
      'trim',
      [P(x, bottom, front), P(x, shoulder, front), P(x, shoulder, behind), P(x, bottom, behind)],
      direction([sign, 0, 0]),
    );
  if (bottom > y0)
    Q(
      o,
      'trim',
      [P(l, bottom, front), P(r, bottom, front), P(r, bottom, behind), P(l, bottom, behind)],
      direction([0, 1, 0]),
    );
  if (glass || back) {
    const q = [
      [l, bottom, behind + 0.015],
      [r, bottom, behind + 0.015],
      [r, shoulder, behind + 0.015],
    ];
    for (let j = N - 1; j >= 0; j--) {
      const x = l + (width * j) / N,
        y = shoulder + rise * archCurve(j / N, pointed);
      q.push([x, y, behind + 0.015]);
    }
    for (let i = 1; i < q.length - 1; i++)
      T(o, backSurface, [q[0], q[i], q[i + 1]].map(M), direction([0, 0, 1]), backColor);
  }
  recessEvidence.push({
    label,
    center: [center, bottom + Math.min(height * 0.5, 2), front - depth * 0.5],
    width,
    depth,
    closedBack: glass || back,
    transform: M,
  });
}

function clipFacade(r, fa, setback) {
  const out = [],
    d = (q) => dot(sub(q, fa.a), fa.n) + setback;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = d(a),
      db = d(b);
    if (da <= 1e-9) out.push(a);
    if (da <= 1e-9 !== db <= 1e-9) out.push(lerp(a, b, da / (da - db)));
  }
  return out.filter((q, i) => !i || Math.hypot(...sub(q, out[i - 1])) > 1e-7);
}
function clean(r) {
  r = r.map((q) => q.slice());
  let change = true;
  while (change && r.length > 3) {
    change = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        v = sub(c, a),
        L = Math.hypot(...v),
        dist = Math.abs((b[0] - a[0]) * v[1] - (b[1] - a[1]) * v[0]) / L;
      if (Math.hypot(...sub(a, b)) < 0.09 || dist < 0.035) {
        r.splice(i, 1);
        change = true;
        break;
      }
    }
  }
  return r;
}
function localBox(o, k, lo, hi, M, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi,
    origin = M([0, 0, 0]),
    n = (v) => sub(M(v), origin);
  for (const [q, N] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [0, -1, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
        [x, y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 0, 1],
    ],
  ])
    Q(o, k, q.map(M), n(N), col);
}
function circle(center, r, N) {
  return Array.from({ length: N }, (_, i) => [
    center[0] + r * Math.cos((i * TAU) / N),
    center[1] + r * Math.sin((i * TAU) / N),
  ]);
}
function loft(o, k, r0, y0, r1, y1, col) {
  const sign = Math.sign(area(r0));
  for (let i = 0; i < r0.length; i++) {
    const j = (i + 1) % r0.length,
      a = r0[i],
      b = r0[j],
      c = r1[j],
      d = r1[i];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [c[0], y1, c[1]],
        [d[0], y1, d[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r0, y0, false, col);
  cap(o, k, r1, y1, true, col);
}
function rail(o, points, y, lod, stone = false, closed = false) {
  if (lod === 0) return;
  if (lod === 1 && closed) points = points.filter((_, i) => i % 2 === 0);
  const k = stone ? 'trim' : 'metal',
    N = 4;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    tube(
      o,
      k,
      [p[0], y + 0.15, p[1]],
      [p[0], y + A.balconyRailHeight, p[1]],
      stone ? 0.055 : 0.025,
      N,
    );
    if (i || closed) {
      const a = points[(i + points.length - 1) % points.length];
      tube(
        o,
        k,
        [a[0], y + A.balconyRailHeight, a[1]],
        [p[0], y + A.balconyRailHeight, p[1]],
        stone ? 0.07 : 0.035,
        N,
      );
      if (lod >= 3)
        tube(o, k, [a[0], y + 0.17, a[1]], [p[0], y + 0.17, p[1]], stone ? 0.055 : 0.025, N);
      if (lod === 3) {
        const mid = lerp(a, p, 0.5),
          u = unit(sub(p, a)),
          w = Math.hypot(...sub(p, a)) * 0.34;
        for (const sign of [-1, 1]) {
          const q1 = [mid[0] - u[0] * w, y + 0.5, mid[1] - u[1] * w],
            q2 = [mid[0], y + 0.5 + sign * 0.25, mid[1]],
            q3 = [mid[0] + u[0] * w, y + 0.5, mid[1] + u[1] * w];
          tube(o, k, q1, q2, 0.016, 4);
          tube(o, k, q2, q3, 0.016, 4);
        }
      }
    }
  }
}
function balcony(o, fa, s, y, lod, stone = false) {
  const N = [2, 2, 3, 9][lod],
    w = 1.35,
    depth = A.balconyProjection,
    arc = Array.from({ length: N + 1 }, (_, i) => {
      const a = (Math.PI * i) / N;
      return [s + Math.cos(a) * w, 0.1 + Math.sin(a) * depth];
    }),
    r = arc.map((q) => {
      const p = fa.M([q[0], 0, q[1]]);
      return [p[0], p[2]];
    });
  poly(o, 'trim', r, y - 0.13, y + 0.04);
  if (lod >= 2)
    loft(
      o,
      'trim',
      r.map((q) =>
        lerp(
          q,
          [...fa.M([s, 0, 0.1])].filter((_, i) => i !== 1),
          0.16,
        ),
      ),
      y - 0.38,
      r,
      y - 0.13,
    );
  rail(o, r, y, lod, stone, false);
  balconyEvidence.push({ face: fa.name, s, y, plan: r });
}
function columns(o, fa, positions, lod) {
  const N = [4, 4, 6, 10][lod];
  for (const x of positions) {
    for (const shift of [-0.23, 0.23]) {
      const P = (y, z = 0.14) => fa.M([x + shift, y, z]);
      tube(o, 'trim', P(1.02), P(3.55), 0.17, N, 0.185);
      tube(o, 'trim', P(0.78), P(1.02), 0.24, N, 0.2);
      localBox(o, 'trim', [x + shift - 0.26, 3.48, -0.08], [x + shift + 0.26, 3.78, 0.39], fa.M);
      if (lod >= 3) {
        tube(o, 'trim', P(1.13), P(1.23), 0.19, N);
        tube(o, 'trim', P(3.3), P(3.4), 0.205, N);
      }
    }
  }
}
function shutters(o, fa, s, y, w, h, lod, front) {
  localBox(o, 'decor', [s - w / 2, y, front - 0.025], [s + w / 2, y + h, front + 0.025], fa.M);
  if (lod >= 2) {
    localBox(o, 'trim', [s - 0.035, y, front + 0.02], [s + 0.035, y + h, front + 0.09], fa.M);
    const count = lod === 2 ? 3 : 10;
    for (let i = 1; i < count; i++)
      localBox(
        o,
        'decor',
        [s - w / 2, y + (h * i) / count, front + 0.03],
        [s + w / 2, y + (h * i) / count + 0.035, front + 0.065],
        fa.M,
      );
  }
}
function crown(o, center, n, lod) {
  const u = [-n[1], n[0]],
    M = ([x, y, z]) => [center[0] + u[0] * x + n[0] * z, y, center[1] + u[1] * x + n[1] * z],
    profile = [
      [-1.45, 22.2],
      [-1.45, 24.1],
      [-1.02, 24.1],
      [-0.85, 24.35],
      [0, A.cornerCrownTop],
      [0.85, 24.35],
      [1.02, 24.1],
      [1.45, 24.1],
      [1.45, 22.2],
    ],
    sign = Math.sign(area(profile));
  for (const ids of triangulate(profile)) {
    const q = ids.map((i) => M([profile[i][0], profile[i][1], 0.25]));
    T(o, 'trim', q, [n[0], 0, n[1]]);
    T(
      o,
      'trim',
      ids.map((i) => M([profile[i][0], profile[i][1], -0.16])),
      [-n[0], 0, -n[1]],
    );
  }
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length],
      normal = [u[0] * (b[1] - a[1]) * sign, -(b[0] - a[0]) * sign, u[1] * (b[1] - a[1]) * sign];
    Q(
      o,
      'trim',
      [
        M([a[0], a[1], 0.25]),
        M([b[0], b[1], 0.25]),
        M([b[0], b[1], -0.16]),
        M([a[0], a[1], -0.16]),
      ],
      normal,
    );
  }
  if (lod >= 2) {
    const N = lod === 3 ? 16 : 8;
    for (let i = 0; i < N; i++) {
      const a = (i * TAU) / N,
        b = ((i + 1) * TAU) / N,
        P = (t) => M([0.37 * Math.cos(t), 23.43 + 0.46 * Math.sin(t), 0.285]);
      T(o, 'trim', [M([0, 23.43, 0.285]), P(a), P(b)], [n[0], 0, n[1]], C.stone);
    }
    for (const x of [-1.32, 1.32]) {
      const q = M([x, 24.16, 0.05]);
      cone(o, 'trim', circle([q[0], q[2]], 0.12, 4), 24.16, 24.65);
    }
  }
}
function oriel(o, center, n, lod, crowned = false) {
  const N = [4, 6, 8, 16][lod],
    r = A.orielRadius;
  for (let j = 0; j < 2; j++) {
    const y = A.orielStages[j],
      top = A.orielStages[j + 1] - 0.2,
      ring = circle(center, r, N);
    poly(o, 'glass', ring, y + 0.12, top);
    poly(o, 'trim', circle(center, r + 0.14, N), y - 0.17, y + 0.12);
    poly(o, 'trim', circle(center, r + 0.1, N), top, top + 0.18);
    if (lod >= 1)
      for (let i = 0; i < N; i += lod === 1 ? 2 : 1) {
        const q = ring[i];
        tube(o, 'trim', [q[0], y + 0.12, q[1]], [q[0], top, q[1]], lod === 1 ? 0.055 : 0.042, 4);
        if (lod >= 2) tube(o, 'metal', [q[0], y + 0.35, q[1]], [q[0], top - 0.22, q[1]], 0.017, 4);
      }
    bayEvidence.push({ center, radius: r, bottom: y + 0.12, top, closed: true });
  }
  for (const y of [A.orielStages[0], A.orielStages[2]]) {
    poly(o, 'trim', circle(center, r + 0.26, N), y - 0.18, y + 0.05);
    rail(o, circle(center, r + 0.19, N), y, lod, y === A.orielStages[0], true);
  }
  loft(o, 'trim', circle(center, 0.45, N), 4.55, circle(center, r + 0.24, N), 5.65);
  if (crowned) poly(o, 'trim', circle(center, 0.42, N), 0.74, 4.6);
  if (lod >= 1) {
    const M = ([x, y, z]) => [center[0] - n[1] * x + n[0] * z, y, center[1] + n[0] * x + n[1] * z];
    archPanel(o, {
      x0: -1.25,
      x1: 1.25,
      y0: 14.48,
      y1: 19.0,
      front: 0.35,
      depth: 0.62,
      width: 1.1,
      bottom: 15,
      height: 2.9,
      N: 2,
      rect: true,
      back: true,
      M,
      label: 'oriel-upper-shut-door',
    });
    shutters(o, { M }, 0, 15, 1.1, 2.9, lod, -0.24);
  }
  if (crowned) crown(o, center, n, lod);
}
function modelFacades(o, lod) {
  const counts = lod === 0 ? [1, 1] : lod === 1 ? [2, 2] : [7, 4],
    N = [2, 2, 6, 10][lod],
    entryCenters = [];
  for (let k = 0; k < facades.length; k++) {
    const fa = facades[k],
      start = k === 0 ? 2.4 : 0.6,
      end = k === 0 ? fa.L - 0.7 : fa.L - 2.4,
      count = counts[k],
      step = (end - start) / count,
      entryI = k === 1 ? (lod < 2 ? 0 : 1) : -1,
      entryS = k === 1 ? SOURCE_ENTRY_S : null,
      postPositions = [];
    if (k === 1) entryCenters.push(entryS);
    for (let i = 0; i < count; i++) {
      const a = start + i * step,
        b = a + step,
        isEntry = i === entryI,
        s = isEntry ? SOURCE_ENTRY_S : (a + b) / 2;
      archPanel(o, {
        x0: a,
        x1: b,
        y0: A.plinthTop,
        y1: A.groundTop,
        front: 0.03,
        depth: isEntry ? A.entryDepth : A.groundRevealDepth,
        openingCenter: s,
        width: Math.min(step - 0.75, 4.3, 2 * Math.min(s - a, b - s) - 0.05),
        bottom: isEntry ? A.entryThreshold : 0.9,
        height: isEntry ? 3.8 : A.groundOpeningHeight,
        N,
        pointed: false,
        back: true,
        M: fa.M,
        label: isEntry ? 'stepped-closed-entry' : 'ground-segmental-glazing',
      });
      if (lod >= 1) {
        const paneZ = 0.03 - (isEntry ? A.entryDepth : A.groundRevealDepth) + 0.055;
        for (const x of [s - 0.7, s + 0.7])
          localBox(
            o,
            'metal',
            [x - 0.035, 1.02, paneZ - 0.03],
            [x + 0.035, 4.16, paneZ + 0.03],
            fa.M,
          );
        localBox(o, 'metal', [s - 1.1, 3.7, paneZ - 0.03], [s + 1.1, 3.76, paneZ + 0.03], fa.M);
      }
      for (let floor = 0; floor < 3; floor++) {
        const y = A.upperFloors[floor],
          orielSlot = k === 1 && Math.abs(s - entryS) < 1,
          front = -0.24;
        if (orielSlot) continue;
        if (lod === 0) {
          if (floor === 1)
            Q(
              o,
              'decor',
              [
                fa.M([s - 0.65, y, front]),
                fa.M([s + 0.65, y, front]),
                fa.M([s + 0.65, y + 2.85, front]),
                fa.M([s - 0.65, y + 2.85, front]),
              ],
              [fa.n[0], 0, fa.n[1]],
              C.decor,
            );
          if (floor === 1) balcony(o, fa, s, y - 0.18, lod);
          continue;
        }
        archPanel(o, {
          x0: a,
          x1: b,
          y0: y - 0.55,
          y1: y + 3.75,
          front,
          depth: A.upperRevealDepth,
          width: 1.28,
          bottom: y + 0.05,
          height: 2.9,
          N: 1,
          rect: true,
          back: true,
          backSurface: 'decor',
          backColor: C.decor,
          M: fa.M,
          label: 'upper-shuttered-recess',
        });
        shutters(o, fa, s, y + 0.05, 1.25, 2.9, lod, front - A.upperRevealDepth + 0.055);
        balcony(o, fa, s, y - 0.18, lod, floor === 0);
      }
      if (lod >= 1) {
        archPanel(o, {
          x0: a,
          x1: b,
          y0: 18.85,
          y1: A.mainTop,
          front: -0.18,
          depth: 0.48,
          width: Math.min(step - 0.45, 3.65),
          bottom: 19.12,
          height: 2.85,
          N: lod === 1 ? 2 : 8,
          pointed: false,
          riseRatio: 0.48,
          back: true,
          backSurface: 'decor',
          backColor: C.blue,
          M: fa.M,
          label: 'blue-ceramic-attic-arch',
        });
        shutters(o, fa, s, 19.27, 1.08, 1.86, lod, -0.58);
        if (lod >= 3)
          for (const side of [-1, 1]) {
            const c = fa.M([s + side * 1.0, 20.4, -0.63]);
            for (let j = 0; j < 4; j++) {
              const q = fa.M([
                s + side * 1.0 + 0.18 * Math.cos((j * Math.PI) / 2),
                20.4 + 0.3 * Math.sin((j * Math.PI) / 2),
                -0.61,
              ]);
              tube(o, 'decor', c, q, 0.025, 4, 0.025, C.white);
            }
          }
      } else
        Q(
          o,
          'decor',
          [
            fa.M([a + 0.2, 19, -0.17]),
            fa.M([b - 0.2, 19, -0.17]),
            fa.M([b - 0.2, 21.7, -0.17]),
            fa.M([a + 0.2, 21.7, -0.17]),
          ],
          [fa.n[0], 0, fa.n[1]],
          C.blue,
        );
      postPositions.push(a);
      if (i === count - 1) postPositions.push(b);
    }
    if (lod >= 1) columns(o, fa, postPositions, lod);
    for (const y of [5.65, 10.15, 14.45, 18.85, 22.05]) {
      if (lod === 0 && y !== 5.65 && y !== 22.05) continue;
      localBox(o, 'trim', [start, y - 0.09, -0.7], [end, y + 0.11, 0.18], fa.M);
    }
    if (k === 1) {
      const x = entryS,
        w = 1.35,
        risers = A.entryStepRisers;
      for (let i = 0; i < risers; i++) {
        const depth = (risers - i) * 0.3;
        localBox(
          o,
          'trim',
          [x - w, 0, 0.03],
          [x + w, ((i + 1) * A.entryThreshold) / risers, 0.03 + depth],
          fa.M,
        );
      }
      if (lod >= 2)
        for (const sign of [-1, 1]) {
          const p = fa.M([x + sign * 1.5, 3.35, 0.28]),
            q = fa.M([x + sign * 1.5, 3.35, 0.75]);
          tube(o, 'metal', p, q, 0.04, 4);
          tube(o, 'metal', q, [q[0], 2.85, q[2]], 0.035, 4);
          sphere(
            o,
            'glass',
            [q[0], 2.69, q[2]],
            [0.16, 0.19, 0.16],
            C.white,
            lod === 3 ? 10 : 6,
            4,
          );
        }
    }
    if (lod >= 2) {
      const points = Array.from({ length: lod === 1 ? 5 : 6 }, (_, i) => {
        const q = fa.M([start + ((end - start) * i) / (lod === 1 ? 4 : 5), 0, -0.25]);
        return [q[0], q[2]];
      });
      rail(o, points, 22.5, lod, false, false);
    }
  }
  return entryCenters[0];
}
function backWindows(o, lod) {
  if (lod < 1) return;
  const sign = Math.sign(area(R));
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      d = sub(b, a),
      L = Math.hypot(...d);
    if (L < 7 || i === 0 || i === 1 || i === 2 || i >= 33) continue;
    const u = d.map((x) => x / L),
      n = [sign * u[1], -sign * u[0]],
      count = Math.floor(L / (lod === 1 ? 8 : 4.5));
    for (let j = 0; j < count; j++) {
      const c = lerp(a, b, (j + 0.5) / count),
        M = ([x, y, z]) => [c[0] + u[0] * x + n[0] * z, y, c[1] + u[1] * x + n[1] * z];
      for (const y of lod === 1 ? [10.5] : [6.2, 10.5, 14.8]) {
        Q(
          o,
          'glass',
          [
            M([-0.5, y, 0.018]),
            M([0.5, y, 0.018]),
            M([0.5, y + 2, 0.018]),
            M([-0.5, y + 2, 0.018]),
          ],
          [n[0], 0, n[1]],
        );
        if (lod >= 2) {
          localBox(o, 'trim', [-0.65, y - 0.15, 0.01], [-0.5, y + 2.15, 0.15], M);
          localBox(o, 'trim', [0.5, y - 0.15, 0.01], [0.65, y + 2.15, 0.15], M);
        }
      }
    }
  }
}
export function buildGranHotelPalma(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  nativeEvidence.length = 0;
  bayEvidence.length = 0;
  balconyEvidence.length = 0;
  poly(o, 'plinth', R, 0, A.plinthTop);
  poly(o, 'trim', R, A.mainTop - 0.3, A.roofTerrace);
  for (const q of R) nativeEvidence.push(q.slice());
  let ground = R,
    upper = R;
  for (const fa of facades) {
    ground = clipFacade(ground, fa, A.groundBodySetback);
    upper = clipFacade(upper, fa, A.upperBodySetback);
  }
  if (lod < 2) {
    ground = clean(ground);
    upper = clean(upper);
  }
  poly(o, 'stone', ground, A.plinthTop, A.groundTop);
  poly(o, 'stone', upper, A.groundTop, A.mainTop - 0.3);
  modelFacades(o, lod);
  const entryS = SOURCE_ENTRY_S,
    cornerN = unit(west.n.map((x, i) => x + south.n[i])),
    corner = R[0].map((x, i) => x + cornerN[i] * 0.22),
    mid = south.M([entryS, 0, 0.28]);
  oriel(o, corner, cornerN, lod, true);
  oriel(o, [mid[0], mid[2]], south.n, lod, false);
  backWindows(o, lod);
}
export const granHotelSkyline = (o) => buildGranHotelPalma(o, null, 0),
  granHotelDistrict = (o) => buildGranHotelPalma(o, null, 1),
  granHotelStreet = (o) => buildGranHotelPalma(o, null, 2),
  granHotelCloseup = (o) => buildGranHotelPalma(o, null, 3);
const front = ([x, y, z]) => [x, F + y, z];
export const granHotelPalmaModel = {
  id: 'gran_hotel_palma',
  key: 'gran_hotel_palma',
  cell: 'sp/sp1',
  wikidataId: 'Q3780261',
  title: 'Gran Hotel, Palma',
  category: p.category,
  recipe: 'gran-hotel-palma-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildGranHotelPalma,
  brief:
    'Whole1903Modernista Gran Hotel/nowCaixaForum Palma: complete native36control concave envelope and hidden rear wings/lightwell gaps, cream masonry/roof terrace, actual deep segmental ground glazing and four-step closed entry/paired round columns/dark plinth, projected stacked curved glazed oriels/round balconies, shuttered upper recesses/curved stone and metal balcony rails, blue-white original upper ornamental panels/corner crown/parapet/roof railing and intrinsic globe lamps. Visible south/Weyler and west façades follow native street context; projections/ornament/hidden elevations estimated from cleared published photos. No neighboring buildings/streets/trees/people/cafe furnishings/interiors/gallery artwork/logos/poster/text copies.',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  camera: front([-65, 40, 72]),
  lookAt: front([-2, 12, 1]),
  portableGroundY: F - 0.18,
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  qaCameras: [
    {
      name: 'whole-rear-wings-and-native-lightwell-gaps',
      position: front([66, 42, -66]),
      lookAt: front([0, 12, 0]),
    },
    {
      name: 'real-stepped-closed-entry-paired-columns-and-ground-arches',
      position: front([-3, 4, 27]),
      lookAt: front([-5, 2.9, 15]),
    },
    {
      name: 'projecting-corner-glazed-oriel-and-round-balconies',
      position: front([-28, 10, 31]),
      lookAt: front([-17, 10, 16]),
    },
    {
      name: 'upper-shutters-and-curved-balcony-rails',
      position: front([-30, 15, 15]),
      lookAt: front([-20, 12, 3]),
    },
    {
      name: 'blue-white-upper-frieze-and-corner-crown',
      position: front([-27, 26, 27]),
      lookAt: front([-17, 22.2, 16]),
    },
    {
      name: 'native-whole-building-outline-and-roof-terrace',
      position: front([3, 95, 5]),
      lookAt: front([0, 10, 0]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/gran-hotel-palma-runtime-overlay.mjs',
    level: 'skyline',
    export: 'granHotelSkyline',
    errorMeters: 2.6,
    surfaces,
    authoredLevels: {
      district: { export: 'granHotelDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'granHotelStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'granHotelCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Four exact published Qualla creatorPD/CC0 originals individually inspected/nativeSHA1 matched:2010Selcommons own/PD-self entry and2019Antekbojar own/CC0 whole corner/near/oblique frontage. Assumed-authorGranhotel.JPG/unrelatedPalma/Miro/artworks/maps/protected or doubtful sources unselected. No supplemental imagery, copied pixels/generated photo textures, article/media/rightsmetadata repair/reclassification. Original blue-white ornament/rails/crown simplify public architectural motifs; gallery posters/artworks/brand marks/interiors omitted. Exact hidden rear/terrace/party-wall profiles/bay and ornament census/currentfinish are bounded estimates. Distant levels simplify windows/rails/columns/census while retaining whole native envelope and both projected curved bays.',
    'Independent400m129x12916641sample original field/two rawtiles/fixed SW19.7745m provider datum frozen before floors/sections/geometry. No fitting/flattening/reacquisition or subsequent raising to hide source contact. All geographic placement preview/replaceFootprint=false; exact grade/entry thresholds unresolved. Flat isolated ground and synthetic neighbors are review fixtures.',
  ],
};
