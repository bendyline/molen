/** Original medium-fi Alferaki Palace exterior from a native creator-CC0 2024 photograph. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = f.geometry.outline.slice(0, -1),
  TAU = 2 * Math.PI;
const C = {
  wall: rgb('cedfd4'),
  base: rgb('88b299'),
  trim: rgb('e9e7db'),
  glass: rgb('637a82'),
  wood: rgb('6b5242'),
  metal: rgb('313d42'),
  roof: rgb('758078'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  base: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.03 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.87, metallic: 0.1 },
};
const G = ([x, y, z]) => [x, F + y, z],
  GN = (n) => n,
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const recessEvidence = [],
  nativeEvidence = [],
  columnEvidence = [],
  porticoEvidence = [],
  balconyEvidence = [];
function facade(a, b, name) {
  const u = unit(sub(b, a)),
    n = [u[1], -u[0]],
    L = Math.hypot(...sub(b, a)),
    M = ([x, y, z]) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  return { a, b, u, n, L, name, M };
}
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
const ID = (q) => q;
function box(o, k, lo, hi, col) {
  localBox(o, k, lo, hi, ID, col);
}
function faces(r, label) {
  const rr = r.map((q) => q.slice());
  if (area(rr) < 0) rr.reverse();
  return rr.map((a, i) => facade(a, rr[(i + 1) % rr.length], `${label}:${i}`));
}
const nativeFront = facade(R[6], R[5], 'giant-order-front');
export const frontFrame = nativeFront;
const shifted = (fa, z) => ({ ...fa, M: ([x, y, d]) => fa.M([x, y, z + d]) });
function verticalPoly(o, k, r, z0, z1, M, col) {
  const a = r.map(([x, y]) => M([x, y, z0])),
    b = r.map(([x, y]) => M([x, y, z1])),
    n = sub(M([0, 0, 1]), M([0, 0, 0]));
  for (let j = 1; j < r.length - 1; j++) {
    T(o, k, [b[0], b[j], b[j + 1]], n, col);
    T(
      o,
      k,
      [a[0], a[j + 1], a[j]],
      n.map((x) => -x),
      col,
    );
  }
  for (let j = 0; j < r.length; j++) {
    const q = r[j],
      s = r[(j + 1) % r.length],
      N = sub(M([s[1] - q[1], q[0] - s[0], 0]), M([0, 0, 0]));
    Q(o, k, [a[j], a[(j + 1) % r.length], b[(j + 1) % r.length], b[j]], N, col);
  }
}
/** Deep closed glazing/wood doors. Walls terminate at actual reveals, not painted rectangles. */
function window(o, fa, x0, x1, y0, y1, bottom, height, width, lod, label, door = false) {
  const x = (x0 + x1) / 2,
    l = x - width / 2,
    r = x + width / 2,
    top = bottom + height,
    d = A.windowReveal,
    at = (a, b, c) => fa.M([a, b, c]),
    N = [fa.n[0], 0, fa.n[1]];
  for (const [a, b, c, e] of [
    [x0, l, y0, y1],
    [r, x1, y0, y1],
    [l, r, y0, bottom],
    [l, r, top, y1],
  ])
    if (b - a > 1e-7 && e - c > 1e-7)
      Q(o, 'wall', [at(a, c, 0), at(b, c, 0), at(b, e, 0), at(a, e, 0)], N);
  for (const [x, s] of [
    [l, 1],
    [r, -1],
  ])
    Q(
      o,
      'trim',
      [at(x, bottom, 0), at(x, top, 0), at(x, top, -d), at(x, bottom, -d)],
      [fa.u[0] * s, 0, fa.u[1] * s],
    );
  Q(
    o,
    'trim',
    [at(l, bottom, 0), at(r, bottom, 0), at(r, bottom, -d), at(l, bottom, -d)],
    [0, 1, 0],
  );
  Q(o, 'trim', [at(l, top, 0), at(l, top, -d), at(r, top, -d), at(r, top, 0)], [0, -1, 0]);
  Q(
    o,
    door ? 'wood' : 'glass',
    [at(l, bottom, -d), at(r, bottom, -d), at(r, top, -d), at(l, top, -d)],
    N,
  );
  recessEvidence.push({
    label,
    outer: at(x + 0.1, bottom + height * 0.43, 0.09),
    normal: N,
    depth: d,
    width,
    closedBack: true,
  });
  if (lod === 1) {
    Q(
      o,
      'trim',
      [
        at(l - 0.1, bottom - 0.1, 0.05),
        at(r + 0.1, bottom - 0.1, 0.05),
        at(r + 0.1, bottom, 0.05),
        at(l - 0.1, bottom, 0.05),
      ],
      N,
    );
    Q(
      o,
      'trim',
      [
        at(l - 0.1, top, 0.05),
        at(r + 0.1, top, 0.05),
        at(r + 0.1, top + 0.12, 0.05),
        at(l - 0.1, top + 0.12, 0.05),
      ],
      N,
    );
    Q(
      o,
      'wood',
      [
        at(x - 0.035, bottom, -d + 0.05),
        at(x + 0.035, bottom, -d + 0.05),
        at(x + 0.035, top, -d + 0.05),
        at(x - 0.035, top, -d + 0.05),
      ],
      N,
    );
  }
  if (lod >= 2) {
    for (const xx of [l - 0.065, r])
      localBox(o, 'trim', [xx, bottom - 0.035, -0.025], [xx + 0.065, top + 0.065, 0.09], fa.M);
    localBox(o, 'trim', [l - 0.14, bottom - 0.13, -d], [r + 0.14, bottom, 0.22], fa.M);
    localBox(o, 'trim', [l - 0.13, top, -0.01], [r + 0.13, top + 0.16, 0.15], fa.M);
    localBox(o, 'wood', [x - 0.035, bottom, -d], [x + 0.035, top, -d + 0.05], fa.M);
    for (const yy of lod >= 2
      ? [bottom + height * 0.27, bottom + height * 0.76]
      : [bottom + height * 0.7])
      localBox(o, 'wood', [l, yy, -d], [r, yy + 0.055, -d + 0.06], fa.M);
  }
  if (lod >= 3) {
    for (const xx of [l + 0.015, r - 0.06])
      localBox(o, 'wood', [xx, bottom, -d], [xx + 0.045, top, -d + 0.045], fa.M);
    if (door)
      for (const xx of [l + 0.1, x + 0.1])
        for (const yy of [bottom + 0.3, bottom + height * 0.55])
          localBox(
            o,
            'wood',
            [xx, yy, -d + 0.01],
            [xx + width * 0.35, yy + height * 0.24, -d + 0.07],
            fa.M,
            rgb('78604a'),
          );
  }
}
function ringBand(o, r, y0, y1, col = C.trim) {
  poly(o, 'trim', r, y0, y1, col);
}
function loft(o, k, center, profile, N, col = C[k], flutes = 0) {
  const P = (j, i) => {
    const [y, r] = profile[j],
      a = (i * TAU) / N,
      v = flutes ? r * (1 + 0.055 * Math.cos(a * flutes)) : r;
    return [center[0] + v * Math.sin(a), y, center[1] + v * Math.cos(a)];
  };
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++)
      Q(
        o,
        k,
        [P(j, i), P(j, i + 1), P(j + 1, i + 1), P(j + 1, i)],
        [Math.sin(((i + 0.5) * TAU) / N), 0, Math.cos(((i + 0.5) * TAU) / N)],
        col,
      );
  cap(
    o,
    k,
    Array.from({ length: N }, (_, i) => [P(0, i)[0], P(0, i)[2]]),
    profile[0][0],
    false,
    col,
  );
  cap(
    o,
    k,
    Array.from({ length: N }, (_, i) => [P(profile.length - 1, i)[0], P(profile.length - 1, i)[2]]),
    profile.at(-1)[0],
    true,
    col,
  );
}
function curvedLine(o, k, M, x, y, rx, ry, z, N, full = false, col) {
  const end = full ? TAU : Math.PI;
  for (let i = 0; i < N; i++) {
    const a = (i * end) / N,
      b = ((i + 1) * end) / N;
    tube(
      o,
      k,
      M([x + rx * Math.cos(a), y + ry * Math.sin(a), z]),
      M([x + rx * Math.cos(b), y + ry * Math.sin(b), z]),
      0.025,
      4,
      0.025,
      col,
    );
  }
}
function rail(o, fa, y, height, lod, label) {
  const N = lod === 1 ? 2 : lod === 2 ? 5 : 8;
  for (const yy of [y + 0.1, y + height])
    localBox(o, 'metal', [0, yy - 0.025, -0.025], [fa.L, yy + 0.025, 0.025], fa.M);
  for (let j = 0; j <= N; j++) {
    const x = (fa.L * j) / N;
    localBox(o, 'metal', [x - 0.02, y, -0.025], [x + 0.02, y + height, 0.025], fa.M);
    if (lod >= 2 && j < N)
      curvedLine(
        o,
        'metal',
        fa.M,
        x + (fa.L / N) * 0.5,
        y + height * 0.52,
        (fa.L / N) * 0.28,
        height * 0.25,
        0,
        lod === 2 ? 6 : 10,
        true,
      );
  }
  if (label === 'wing-balcony')
    balconyEvidence.push({
      outer: fa.M([(fa.L / N) * 0.23, y + height * 0.3, 0.1]),
      normal: [fa.n[0], 0, fa.n[1]],
    });
}
function giantColumns(o, lod) {
  const fa = nativeFront,
    cs = [7.85, 13.18, 18.51, 23.84],
    N = [6, 12, 24, 64][lod];
  for (const x of cs) {
    const q = fa.M([x, 0, A.columnZ]),
      center = [q[0], q[2]];
    columnEvidence.push({ center: q, x, radius: 0.56 });
    localBox(
      o,
      'trim',
      [x - 0.76, A.columnFoot, A.columnZ - 0.76],
      [x + 0.76, A.columnFoot + 0.2, A.columnZ + 0.76],
      fa.M,
    );
    loft(
      o,
      'trim',
      center,
      lod === 0
        ? [
            [1.55, 0.54],
            [10.02, 0.48],
          ]
        : lod === 2
          ? [
              [1.55, 0.65],
              [1.8, 0.54],
              [9.7, 0.46],
              [10.02, 0.48],
            ]
          : [
              [1.55, 0.65],
              [1.7, 0.65],
              [1.8, 0.54],
              [5.8, 0.51],
              [9.7, 0.46],
              [10.02, 0.48],
            ],
      N,
      C.trim,
      lod === 3 ? 16 : lod === 2 ? 12 : 0,
    );
    loft(
      o,
      'trim',
      center,
      [
        [10.02, 0.53],
        [10.2, 0.62],
        [10.46, 0.78],
        [10.56, 0.72],
      ],
      lod === 0 ? 4 : 8,
    );
    localBox(
      o,
      'trim',
      [x - 0.85, 10.56, A.columnZ - 0.85],
      [x + 0.85, 10.7, A.columnZ + 0.85],
      fa.M,
    );
    if (lod >= 1) {
      const leaves = lod === 1 ? 4 : 8;
      for (let i = 0; i < leaves; i++) {
        const a = (i * TAU) / leaves,
          u = [Math.cos(a), Math.sin(a)],
          M = ([s, y, d]) => [
            center[0] + u[0] * (0.57 + d) - u[1] * s,
            y,
            center[1] + u[1] * (0.57 + d) + u[0] * s,
          ];
        verticalPoly(
          o,
          'trim',
          [
            [-0.19, 10.07],
            [0, 10.52],
            [0.19, 10.07],
            [0, 9.95],
          ],
          -0.035,
          0.045,
          M,
        );
      }
      if (lod >= 2)
        for (const side of [-1, 1])
          curvedLine(
            o,
            'trim',
            ([a, y, z]) => fa.M([x + a, y, A.columnZ + z]),
            side * 0.56,
            10.43,
            0.2,
            0.15,
            0.58,
            lod === 2 ? 6 : 12,
            true,
          );
    }
  }
  for (let j = 0; j < 3; j++)
    porticoEvidence.push({
      outer: fa.M([(cs[j] + cs[j + 1]) / 2, 8.6, 0.5]),
      normal: [fa.n[0], 0, fa.n[1]],
      depth: A.frontRecess + 0.5,
    });
  if (lod >= 1)
    for (let j = 0; j < 3; j++) {
      const x0 = cs[j] + 0.65,
        x1 = cs[j + 1] - 0.65,
        a = fa.M([x0, 0, 0.42]),
        b = fa.M([x1, 0, 0.42]);
      rail(
        o,
        facade([a[0], a[2]], [b[0], b[2]], 'portico-base-rail'),
        A.basementTop,
        0.66,
        lod,
        'portico',
      );
    }
}
function front(o, lod) {
  const fa = nativeFront,
    L = fa.L,
    middle = [7.25, 24.45];
  for (const [x0, x1] of [
    [0, middle[0]],
    [middle[1], L],
  ]) {
    const count = lod === 0 ? 1 : 3;
    for (let j = 0; j < count; j++) {
      const a = x0 + ((x1 - x0) * j) / count,
        b = x0 + ((x1 - x0) * (j + 1)) / count,
        w = lod === 0 ? 1.7 : j === 1 ? 1.25 : 0.85;
      window(
        o,
        fa,
        a,
        b,
        A.basementTop,
        A.lowerTop,
        A.lowerWindowBottom,
        A.lowerWindowHeight,
        w,
        lod,
        'primary-lower-wing',
      );
      window(
        o,
        fa,
        a,
        b,
        A.lowerTop,
        A.upperTop,
        A.upperWindowBottom,
        A.upperWindowHeight,
        w,
        lod,
        'primary-upper-wing',
      );
    }
    if (lod >= 1) {
      const x = (x0 + x1) / 2;
      localBox(o, 'trim', [x - 1.85, 5.93, -0.04], [x + 1.85, 6.1, 0.85], fa.M);
      for (const side of [-1, 1])
        tube(
          o,
          'trim',
          fa.M([x + side * 1.4, 5.55, 0.02]),
          fa.M([x + side * 1.4, 5.95, 0.67]),
          0.11,
          6,
          0.1,
        );
      const aa = fa.M([x - 1.78, 0, 0.82]),
        bb = fa.M([x + 1.78, 0, 0.82]);
      rail(
        o,
        facade([aa[0], aa[2]], [bb[0], bb[2]], 'wing-balcony'),
        6.1,
        0.85,
        lod,
        'wing-balcony',
      );
      for (const xx of [x - 1.78, x + 1.78]) {
        const a = fa.M([xx, 0, 0.0]),
          b = fa.M([xx, 0, 0.82]);
        rail(o, facade([a[0], a[2]], [b[0], b[2]], 'balcony-return'), 6.1, 0.85, 1, 'return');
      }
    }
    if (lod >= 2) {
      const x = (x0 + x1) / 2;
      curvedLine(
        o,
        'trim',
        fa.M,
        x,
        A.upperWindowBottom + A.upperWindowHeight + 0.17,
        0.7,
        0.55,
        0.1,
        12,
      );
    }
  }
  const back = shifted(fa, -A.frontRecess),
    cs = [7.85, 13.18, 18.51, 23.84];
  for (let j = 0; j < 3; j++) {
    const x0 = j === 0 ? middle[0] : cs[j],
      x1 = j === 2 ? middle[1] : cs[j + 1];
    window(
      o,
      back,
      x0,
      x1,
      A.basementTop,
      A.lowerTop,
      A.lowerWindowBottom,
      A.lowerWindowHeight,
      1.3,
      lod,
      'closed-central-lower-entry',
      j === 0,
    );
    window(
      o,
      back,
      x0,
      x1,
      A.lowerTop,
      A.upperTop,
      A.upperWindowBottom,
      A.upperWindowHeight,
      1.3,
      lod,
      'recessed-central-upper-window',
    );
  }
  // Real portico back and side returns enclose the actual exterior recess.
  for (const [x, sign] of [
    [middle[0], 1],
    [middle[1], -1],
  ])
    Q(
      o,
      'wall',
      [
        fa.M([x, A.basementTop, 0]),
        fa.M([x, A.upperTop, 0]),
        fa.M([x, A.upperTop, -A.frontRecess]),
        fa.M([x, A.basementTop, -A.frontRecess]),
      ],
      [fa.u[0] * sign, 0, fa.u[1] * sign],
    );
  localBox(o, 'trim', [middle[0] - 0.4, 10.7, -1], [middle[1] + 0.4, 12.3, 0.9], fa.M);
  if (lod >= 1) {
    for (const [y, h, z] of [
      [10.72, 0.12, 0.99],
      [11.02, 0.13, 1.04],
      [11.9, 0.16, 1.06],
      [12.19, 0.13, 1.13],
    ])
      localBox(o, 'trim', [middle[0] - 0.5, y, -1.02], [middle[1] + 0.5, y + h, z], fa.M);
  }
  verticalPoly(
    o,
    'trim',
    [
      [middle[0] - 0.65, 12.31],
      [(middle[0] + middle[1]) / 2, A.pedimentTip],
      [middle[1] + 0.65, 12.31],
    ],
    -0.7,
    0.95,
    fa.M,
  );
  if (lod >= 1) {
    for (const side of [-1, 1])
      tube(
        o,
        'trim',
        fa.M([side < 0 ? middle[0] - 0.8 : middle[1] + 0.8, 12.34, 1]),
        fa.M([(middle[0] + middle[1]) / 2, A.pedimentTip + 0.12, 1]),
        0.115,
        4,
        0.115,
      );
  }
  if (lod >= 2) {
    const cen = (middle[0] + middle[1]) / 2;
    curvedLine(o, 'trim', fa.M, cen, 13.05, 0.75, 0.55, 1.02, 16, true);
    for (const side of [-1, 1])
      for (let j = 0; j < 3; j++)
        curvedLine(o, 'trim', fa.M, cen + side * (1.7 + j * 1.7), 12.75, 0.55, 0.3, 1.015, 8, true);
    for (let j = 0; j < 34; j++) {
      const x = middle[0] + ((middle[1] - middle[0]) * j) / 34;
      localBox(o, 'trim', [x, 11.8, 0.88], [x + 0.17, 12.03, 1.13], fa.M);
    }
  }
  giantColumns(o, lod);
}
function vase(o, center, y, lod) {
  const N = [4, 4, 8, 20][lod],
    q = ([x, h, z]) => [center[0] + x, h, center[1] + z];
  box(o, 'trim', q([-0.5, y, -0.5]), q([0.5, y + 0.55, 0.5]));
  loft(
    o,
    'trim',
    center,
    lod < 3
      ? [
          [y + 0.55, 0.3],
          [y + 0.85, 0.47],
          [y + 1.4, 0.5],
          [y + 1.55, 0.35],
        ]
      : [
          [y + 0.55, 0.3],
          [y + 0.65, 0.36],
          [y + 0.8, 0.29],
          [y + 0.95, 0.47],
          [y + 1.28, 0.5],
          [y + 1.41, 0.34],
          [y + 1.47, 0.52],
          [y + 1.55, 0.35],
        ],
    N,
  );
  loft(
    o,
    'trim',
    center,
    [
      [y + 1.55, 0.08],
      [y + 1.72, 0.11],
      [y + 1.8, 0.025],
    ],
    lod === 0 ? 4 : 6,
  );
}
/** A perimeter cornice, leaving the low roof visible inside its lip. */
function corniceShell(o, y0, y1, innerLip = false) {
  const outer = R.map((q) => q.slice());
  if (area(outer) < 0) outer.reverse();
  const inner = outer.map((q) => q.map((v) => v * 0.988));
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length,
      a = outer[i],
      b = outer[j],
      c = inner[i],
      d = inner[j],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    Q(
      o,
      'trim',
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
    );
    Q(
      o,
      'trim',
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [d[0], y1, d[1]],
        [c[0], y1, c[1]],
      ],
      [0, 1, 0],
    );
    if (innerLip)
      Q(
        o,
        'trim',
        [
          [c[0], A.roofTop, c[1]],
          [c[0], y1, c[1]],
          [d[0], y1, d[1]],
          [d[0], A.roofTop, d[1]],
        ],
        n.map((v) => -v),
      );
  }
}
function wholeBody(o, lod) {
  poly(o, 'wall', R, 0, A.basementTop, C.base);
  for (const q of R) nativeEvidence.push(q.slice());
  const front = faces(R, 'whole-palace').find(
    (f) => Math.hypot(...sub(f.a, R[6])) < 0.001 && Math.hypot(...sub(f.b, R[5])) < 0.001,
  );
  if (!front) throw Error('Native front edge missing');
  for (const fa of faces(R, 'whole-palace')) {
    if (
      fa === front ||
      (Math.hypot(...sub(fa.a, front.a)) < 0.001 && Math.hypot(...sub(fa.b, front.b)) < 0.001)
    )
      continue;
    if (fa.L < 2.3 || lod === 0) {
      Q(
        o,
        'wall',
        [
          fa.M([0, A.basementTop, 0]),
          fa.M([fa.L, A.basementTop, 0]),
          fa.M([fa.L, A.upperTop, 0]),
          fa.M([0, A.upperTop, 0]),
        ],
        [fa.n[0], 0, fa.n[1]],
      );
      continue;
    }
    const N = Math.max(1, Math.floor(fa.L / (lod === 1 ? 9 : 4.7)));
    for (let j = 0; j < N; j++) {
      const a = (fa.L * j) / N,
        b = (fa.L * (j + 1)) / N;
      window(
        o,
        fa,
        a,
        b,
        A.basementTop,
        A.lowerTop,
        A.lowerWindowBottom,
        A.lowerWindowHeight,
        1.15,
        lod,
        'bounded-side-lower-window',
      );
      window(
        o,
        fa,
        a,
        b,
        A.lowerTop,
        A.upperTop,
        A.upperWindowBottom,
        A.upperWindowHeight,
        1.15,
        lod,
        'bounded-side-upper-window',
      );
    }
  }
  cap(o, 'wall', R, A.upperTop);
  corniceShell(o, A.upperTop, A.corniceTop);
  poly(o, 'roof', R, A.corniceTop - 0.35, A.roofTop);
  if (lod >= 1) {
    ringBand(o, R, A.basementTop - 0.1, A.basementTop + 0.06);
    ringBand(o, R, A.lowerTop - 0.12, A.lowerTop + 0.06);
    corniceShell(o, A.corniceTop - 0.17, A.corniceTop + 0.08, true);
  }
}
function roofPerimeter(o, lod) {
  const ids = [0, 5, 6, 9];
  for (const i of ids) vase(o, R[i], A.corniceTop + 0.08, lod);
  for (const x of [7.65, 24.25]) {
    const q = nativeFront.M([x, 0, 0]);
    vase(o, [q[0], q[2]], A.corniceTop + 0.6, lod);
  }
  if (lod === 0) return;
  for (const fa of faces(R, 'roof-perimeter')) {
    if (fa.L < 2.3) continue;
    for (const y of [A.corniceTop + 0.17, A.railTop])
      localBox(o, 'metal', [0, y - 0.025, -0.025], [fa.L, y + 0.025, 0.025], fa.M);
    const N = Math.max(1, Math.ceil(fa.L / (lod === 1 ? 7 : lod === 2 ? 5.4 : 1.5)));
    for (let j = 0; j <= N; j++) {
      const x = (fa.L * j) / N;
      localBox(o, 'metal', [x - 0.024, A.corniceTop, -0.03], [x + 0.024, A.railTop, 0.03], fa.M);
      if (lod >= 2 && j < N) {
        tube(
          o,
          'metal',
          fa.M([x, A.corniceTop + 0.22, 0]),
          fa.M([x + fa.L / N, A.railTop - 0.07, 0]),
          0.016,
          4,
        );
        tube(
          o,
          'metal',
          fa.M([x, A.railTop - 0.07, 0]),
          fa.M([x + fa.L / N, A.corniceTop + 0.22, 0]),
          0.016,
          4,
        );
      }
    }
    if (lod >= 2 && fa.L > 20 && dot(fa.n, nativeFront.n) < 0.5)
      for (const t of [0.33, 0.67]) {
        const q = fa.M([fa.L * t, 0, 0]);
        vase(o, [q[0], q[2]], A.corniceTop + 0.08, lod);
      }
  }
}
export function buildAlferakiPalace(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  nativeEvidence.length = 0;
  columnEvidence.length = 0;
  porticoEvidence.length = 0;
  balconyEvidence.length = 0;
  wholeBody(o, lod);
  front(o, lod);
  roofPerimeter(o, lod);
}
export const alferakiPalaceSkyline = (o) => buildAlferakiPalace(o, null, 0),
  alferakiPalaceDistrict = (o) => buildAlferakiPalace(o, null, 1),
  alferakiPalaceStreet = (o) => buildAlferakiPalace(o, null, 2),
  alferakiPalaceCloseup = (o) => buildAlferakiPalace(o, null, 3);
const cam = nativeFront.M([nativeFront.L + 29, 29, 50]),
  look = nativeFront.M([nativeFront.L / 2, 7, -12]);
export const alferakiPalaceModel = {
  id: 'alferaki_palace',
  key: 'alferaki_palace',
  cell: 'ub/ub7',
  title: 'Alferaki Palace',
  wikidataId: 'Q4721899',
  category: p.category,
  recipe: 'alferaki-palace-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildAlferakiPalace,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole actual ten-control Alferaki Palace: current pale mint/cream-white facades/green raised basement, four giant fluted Corinthian columns and real recessed front/closed window-door backs, layered entablature/triangular relief-abstracted pediment, wing triplewindow banks/two upper balconies/actual pierced metal rails, complete irregular side/rear/native roof outline/low hidden roof/open roofperimeter rail and vase finials. One different2024Fargohown/selfCC0 exactoriginal after Qualla-first search/published-source exclusions, no oldunboundsourceuse or repair. Fine relief/heraldry/leaf/curl patterns original geometric abstractions; hidden roof/elevations/window census/heights/entry inferred. No copied pixels/inscriptions/artwork/neighborannexe/roads/trees/poles/wires/people/interiors.',
  camera: cam,
  lookAt: look,
  portableGroundY: F - 0.18,
  sunDirection: sub(nativeFront.M([10, 18, 15]), nativeFront.M([0, 0, 0])),
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_sandstone', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-rear-irregular-palace-and-roof-rail',
      position: nativeFront.M([-28, 27, -48]),
      lookAt: look,
    },
    {
      name: 'four-fluted-corinthian-columns-actual-portico-and-pediment',
      position: nativeFront.M([15, 10, 24]),
      lookAt: nativeFront.M([15, 8.4, 0]),
    },
    {
      name: 'wing-triple-recesses-and-pierced-balcony',
      position: nativeFront.M([28, 6.8, 14]),
      lookAt: nativeFront.M([28, 6.4, 0]),
    },
    {
      name: 'roof-vases-open-iron-rail-and-cornice',
      position: nativeFront.M([38, 19, 10]),
      lookAt: nativeFront.M([29, 13, -2]),
    },
    {
      name: 'whole-native-ten-control-envelope-and-hidden-low-roof',
      position: [0, 85, 4],
      lookAt: [0, 6, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/alferaki-palace-runtime-overlay.mjs',
    level: 'skyline',
    export: 'alferakiPalaceSkyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'alferakiPalaceDistrict', errorMeters: 1, surfaces },
      street: { export: 'alferakiPalaceStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'alferakiPalaceCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Qualla-first22families/zero conflicts; older published creatorPD2008/derivative unused after unchanged inventory/native-primary guard did not bind missing local basis/legacyfirst-release syntax. Different2024Fargohown/selfCC0 original alone individually inspected/nativeSHA1 matched/passed unchanged supplementalinventory. No sameimage reclassification/Quallasource repairs. Current mint-white/greenfinish from accepted2024photo only. Fine sculptural relief/heraldry/capitalleaves/iron curls original abstractions, exact ornament/hidden roof/elevations/windowcensus/entry/sections estimated. Neighbor annexe/street/trees/people/poles/wires/signs/interiors/sourcepixels/text excluded.',
    'Original400m129x12916641sample field/two rawtiles/fixedNWapproach44m datum frozen before all floor/section/geometry choices. No terrainfit/flatten/reacquire/modelraising. Preview/replacementfalse/exactgroundcontact unresolved. Flat isolated ground/synthetic neighbor fixtures only.',
  ],
};
