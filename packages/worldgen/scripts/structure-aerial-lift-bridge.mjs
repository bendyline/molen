/** Duluth Aerial Lift Bridge: fixed high truss, open battered towers and lowered road span. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/cb/cbq/aerial_lift_bridge/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    steel: rgb('c5cdca'),
    concrete: rgb('bebdb0'),
    road: rgb('747d7c'),
    glass: rgb('708b91'),
    house: rgb('9aaeb3'),
    white: rgb('e1e2d6'),
    cable: rgb('697677'),
    mark: rgb('d9bd72'),
  };
const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.18 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  road: { slot: 'roof', localRef: ref, roughness: 0.96, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.3, metallic: 0.08 },
  house: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
};
const halfSpan = plan.officialNominal.movingSpan / 2,
  guide = plan.officialNominal.betweenSpans / 2;
function tri(o, s, p, h, col = C[s]) {
  if (h && normalFor(...p).reduce((a, v, i) => a + v * h[i], 0) < 0) p = [p[0], p[2], p[1]];
  const n = normalFor(...p),
    a = n.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, p, n, p.map(uv), col);
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true, col = C[s]) {
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      s,
      ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function ribbon(o, a, b, width, n, col = C.steel, s = 'steel') {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)).map((v) => (v * width) / 2),
    p = [
      a.map((v, i) => v + u[i]),
      b.map((v, i) => v + u[i]),
      b.map((v, i) => v - u[i]),
      a.map((v, i) => v - u[i]),
    ];
  Q(o, s, p, n, col);
  Q(
    o,
    s,
    [...p].reverse(),
    n.map((v) => -v),
    col,
  );
}
function bar(o, a, b, width, depth, n, col = C.steel, s = 'steel') {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)),
    v = cross(axis, u),
    ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([j, k]) => c.map((x, i) => x + (u[i] * j * width + v[i] * k * depth) / 2));
  loft(o, s, [ring(a), ring(b)], col);
}
function member(o, a, b, width, d, n = [0, 0, 1], primary = false, col = C.steel) {
  const length = Math.hypot(...b.map((v, i) => v - a[i]));
  if (d === 0 || (!primary && d === 1)) {
    ribbon(o, a, b, d === 0 ? Math.max(width, 0.55) : width, n, col);
    return;
  }
  if (d < 3 || !primary || width < 0.55 || length < 5.5) {
    bar(o, a, b, width, width * 0.65, n, col);
    return;
  }
  // Long built-up members have two rails and actual open lattice webs close up.
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(n, axis)),
    P = (t, side) => a.map((v, i) => v + axis[i] * t + u[i] * side * width * 0.38);
  for (const side of [-1, 1])
    bar(o, P(0, side), P(length, side), width * 0.24, width * 0.55, n, col);
  const count = Math.max(1, Math.ceil(length / 3.0));
  for (let j = 0; j < count; j++)
    bar(
      o,
      P((length * j) / count, j % 2 ? 1 : -1),
      P((length * (j + 1)) / count, j % 2 ? -1 : 1),
      0.16,
      0.2,
      n,
      col,
    );
}
function towerPoint(sign, y, u, v) {
  const q = (y - 0.6) / 60.7,
    outer = 74.2 - 10.3 * q,
    inner = guide + 0.25,
    half = 5.6 - 0.4 * q;
  return [sign * (inner + (outer - inner) * u), y, (v * 2 - 1) * half];
}
function towers(o, d) {
  const levels =
    d === 0
      ? [0.6, 20.8, 41.1, 61.3]
      : Array.from(
          { length: (d === 1 ? 5 : 8) + 1 },
          (_, j) => 0.6 + (60.7 * j) / (d === 1 ? 5 : 8),
        );
  for (const sign of [-1, 1]) {
    for (const u of [0, 1])
      for (const v of [0, 1]) {
        const a = towerPoint(sign, 0.6, u, v),
          b = towerPoint(sign, 61.3, u, v);
        if (d === 0) bar(o, a, b, 1.1, 0.72, [0, 0, 1]);
        else member(o, a, b, 0.82, d, [0, 0, 1], true);
        box(o, 'concrete', [a[0] - 1.15, -8, a[2] - 1], [a[0] + 1.15, 0.6, a[2] + 1], C.concrete);
        const top = towerPoint(sign, 61.3, u, v);
        if (d > 0) {
          const corners = [
            [-0.48, -0.48],
            [0.48, -0.48],
            [0.48, 0.48],
            [-0.48, 0.48],
          ];
          for (const [x, z] of corners)
            member(o, [top[0] + x, 61.25, top[2] + z], [top[0], 65.1, top[2]], 0.17, d, [0, 0, 1]);
          for (const y of [62.1, 63.4])
            for (let k = 0; k < 4; k++) {
              const a = corners[k],
                b = corners[(k + 1) % 4],
                q = (65.1 - y) / 3.85;
              member(
                o,
                [top[0] + a[0] * q, y, top[2] + a[1] * q],
                [top[0] + b[0] * q, y, top[2] + b[1] * q],
                0.12,
                d,
                [0, 1, 0],
              );
            }
        } else ribbon(o, top, [top[0], 65.1, top[2]], 0.45, [0, 0, 1]);
      }
    for (let j = 1; j < levels.length; j++) {
      const y0 = levels[j - 1],
        y1 = levels[j];
      for (const v of [0, 1]) {
        const a = towerPoint(sign, y0, 0, v),
          b = towerPoint(sign, y0, 1, v),
          c = towerPoint(sign, y1, 0, v),
          e = towerPoint(sign, y1, 1, v);
        member(o, a, e, 0.4, d, [0, 0, 1]);
        member(o, b, c, 0.4, d, [0, 0, 1]);
        member(o, c, e, 0.48, d, [0, 0, 1], d > 1);
      }
      for (const u of [0, 1]) {
        const a = towerPoint(sign, y0, u, 0),
          b = towerPoint(sign, y0, u, 1),
          c = towerPoint(sign, y1, u, 0),
          e = towerPoint(sign, y1, u, 1);
        member(o, a, e, 0.4, d, [1, 0, 0]);
        if (d > 0) member(o, b, c, 0.4, d, [1, 0, 0]);
        member(o, c, e, 0.44, d, [1, 0, 0]);
      }
    }
    // Straight lift guides and high counterweights are distinct from the battered old towers.
    for (const z of [-5.15, 5.15]) {
      if (d > 0) {
        bar(
          o,
          [sign * (guide - 0.15), 0, z],
          [sign * (guide - 0.15), 59.4, z],
          0.4,
          0.32,
          [0, 0, 1],
        );
        box(
          o,
          'concrete',
          [sign * 61.3 - 0.7, 28, z - 0.75],
          [sign * 61.3 + 0.7, 55, z + 0.75],
          rgb('a3aaa7'),
        );
        if (d > 1) {
          for (const yy of [28.1, 37, 46, 54.8])
            box(
              o,
              'steel',
              [sign * 61.3 - 0.79, yy, z - 0.83],
              [sign * 61.3 + 0.79, yy + 0.2, z + 0.83],
              C.steel,
            );
          for (const u of [-0.22, 0.22])
            bar(
              o,
              [sign * (guide - 0.15) + u, 0, z],
              [sign * (guide - 0.15) + u, 59.4, z],
              0.09,
              0.1,
              [0, 0, 1],
              C.cable,
            );
        }
        wheel(o, sign * 60.7, 58.3, z, 1.4, d);
      }
    }
  }
}
function wheel(o, x, y, z, r, d) {
  const n = d === 1 ? 8 : d === 2 ? 12 : 24,
    point = (a, rr, dep) => [x + rr * Math.cos(a), y + rr * Math.sin(a), z + dep];
  for (let j = 0; j < n; j++) {
    const a = (j * Math.PI * 2) / n,
      b = ((j + 1) * Math.PI * 2) / n;
    for (const side of [-1, 1])
      Q(
        o,
        'steel',
        [
          point(a, r - 0.14, side * 0.16),
          point(b, r - 0.14, side * 0.16),
          point(b, r + 0.14, side * 0.16),
          point(a, r + 0.14, side * 0.16),
        ],
        [0, 0, side],
      );
    for (const rr of [r - 0.14, r + 0.14])
      Q(
        o,
        'steel',
        [point(a, rr, -0.16), point(b, rr, -0.16), point(b, rr, 0.16), point(a, rr, 0.16)],
        [(rr < r ? -1 : 1) * Math.cos((a + b) / 2), (rr < r ? -1 : 1) * Math.sin((a + b) / 2), 0],
      );
  }
  for (let j = 0; j < (d === 1 ? 4 : 8); j++) {
    const a = (j * Math.PI * 2) / (d === 1 ? 4 : 8);
    member(o, [x, y, z], point(a, r, 0), 0.16, d, [0, 0, 1]);
  }
  box(o, 'steel', [x - 0.2, y - 0.2, z - 0.24], [x + 0.2, y + 0.2, z + 0.24], C.steel);
}
function upperY(x) {
  const q = Math.abs(x) / 63.6;
  if (q < 0.34) return 68.2;
  if (q < 0.68) return 68.2 - ((q - 0.34) / 0.34) * 2.4;
  return 65.8 - ((q - 0.68) / 0.32) * 7.6;
}
function fixedUpper(o, d) {
  const n = d < 2 ? 6 : 12,
    xs = Array.from({ length: n + 1 }, (_, j) => -63.6 + (127.2 * j) / n),
    y = 54.864;
  for (const z of [-5.2, 5.2]) {
    member(o, [-63.6, y, z], [63.6, y, z], 0.88, d, [0, 0, 1], true);
    for (let j = 0; j <= n; j++) {
      const x = xs[j];
      member(o, [x, y, z], [x, upperY(x), z], 0.48, d, [0, 0, 1]);
      if (j === 0) continue;
      const a = xs[j - 1];
      member(o, [a, upperY(a), z], [x, upperY(x), z], 0.85, d, [0, 0, 1], true);
      member(o, [a, y, z], [x, upperY(x), z], 0.43, d, [0, 0, 1]);
      if (d > 0) member(o, [a, upperY(a), z], [x, y, z], 0.43, d, [0, 0, 1]);
    }
  }
  for (let j = 0; j <= n; j++) {
    const x = xs[j],
      top = upperY(x);
    member(o, [x, top, -5.2], [x, top, 5.2], 0.38, d, [0, 1, 0]);
    if (d > 0) member(o, [x, y, -5.2], [x, y, 5.2], 0.35, d, [0, 1, 0]);
    if (j && d > 0) {
      const a = xs[j - 1];
      member(o, [a, upperY(a), -5.2], [x, top, 5.2], 0.27, d, [0, 1, 0]);
      member(o, [a, upperY(a), 5.2], [x, top, -5.2], 0.27, d, [0, 1, 0]);
    }
  }
  if (d > 0) {
    box(o, 'steel', [-63.6, 54.59, 5.38], [63.6, 54.76, 6.05], C.steel);
    for (const yy of [55.25, 55.85])
      bar(o, [-63.6, yy, 6.05], [63.6, yy, 6.05], 0.11, 0.12, [0, 0, 1]);
    if (d > 1)
      for (let x = -63.6; x <= 63.6; x += 5.3)
        bar(o, [x, 54.7, 6.05], [x, 55.9, 6.05], 0.11, 0.11, [0, 0, 1]);
  }
}
function movingY(x) {
  const q = Math.abs(x) / halfSpan;
  return q < 0.4 ? 9.5 : 9.5 - ((q - 0.4) / 0.6) * 3.0;
}
function movingSpan(o, d) {
  const n = d < 2 ? 6 : 12,
    xs = Array.from({ length: n + 1 }, (_, j) => -halfSpan + (2 * halfSpan * j) / n);
  for (const z of [-5.25, 5.25]) {
    member(o, [-halfSpan, -0.4, z], [halfSpan, -0.4, z], 0.68, d, [0, 0, 1], true);
    for (let j = 0; j <= n; j++) {
      const x = xs[j];
      member(o, [x, -0.4, z], [x, movingY(x), z], 0.35, d, [0, 0, 1]);
      if (!j) continue;
      const a = xs[j - 1];
      member(o, [a, movingY(a), z], [x, movingY(x), z], 0.65, d, [0, 0, 1], true);
      member(
        o,
        [a, j % 2 ? -0.4 : movingY(a), z],
        [x, j % 2 ? movingY(x) : -0.4, z],
        0.38,
        d,
        [0, 0, 1],
      );
      if (d > 1)
        member(
          o,
          [a, j % 2 ? movingY(a) : -0.4, z],
          [x, j % 2 ? -0.4 : movingY(x), z],
          0.3,
          d,
          [0, 0, 1],
        );
    }
  }
  if (d > 0)
    for (const x of xs) {
      member(o, [x, movingY(x), -5.25], [x, movingY(x), 5.25], 0.34, d, [0, 1, 0]);
      if (d > 1 && Math.abs(x) > 5)
        member(
          o,
          [x - 3, movingY(x) - 0.2, -5.2],
          [x + 3, movingY(x) - 0.2, 5.2],
          0.2,
          d,
          [0, 1, 0],
        );
    }
}
function envelopeZ(x, side) {
  const a = side > 0 ? plan.outline[9] : plan.outline[5],
    b = side > 0 ? plan.outline[0] : plan.outline[4];
  return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
}
function deck(o, d) {
  const p = plan.outline;
  cap(o, 'road', p, -0.65, false);
  cap(o, 'road', p, 0);
  const sign =
    p.reduce(
      (s, a, j) => s + a[0] * p[(j + 1) % p.length][1] - p[(j + 1) % p.length][0] * a[1],
      0,
    ) > 0
      ? 1
      : -1;
  for (let j = 0; j < p.length; j++) {
    const a = p[j],
      b = p[(j + 1) % p.length];
    Q(
      o,
      'steel',
      [
        [a[0], -0.65, a[1]],
        [b[0], -0.65, b[1]],
        [b[0], 0, b[1]],
        [a[0], 0, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
  for (const s of [-1, 1]) {
    const a = plan.axis[0][0],
      b = plan.axis[1][0],
      z0 = envelopeZ(a, s),
      z1 = envelopeZ(b, s);
    Q(
      o,
      'steel',
      [
        [a, 0.06, s * 4.2],
        [b, 0.06, s * 4.2],
        [b, 0.06, z1],
        [a, 0.06, z0],
      ],
      [0, 1, 0],
      rgb('a8b1ae'),
    );
    member(o, [a, 0.32, z0], [b, 0.32, z1], 0.2, d, [0, 0, 1]);
    member(o, [a, 1.15, z0], [b, 1.15, z1], 0.16, d, [0, 0, 1]);
    if (d > 0) {
      const count = Math.ceil((b - a) / (d === 1 ? 10 : 3.8));
      for (let j = 0; j <= count; j++) {
        const x = a + ((b - a) * j) / count,
          z = envelopeZ(x, s);
        bar(o, [x, 0.1, z], [x, 1.15, z], 0.12, 0.12, [0, 0, 1]);
      }
      bar(o, [a, 0.8, s * 3.88], [b, 0.8, s * 3.88], 0.16, 0.16, [0, 0, 1]);
    }
  }
  if (d > 0) {
    for (const z of [-0.08, 0.08])
      Q(
        o,
        'road',
        [
          [-75.3, 0.016, z - 0.045],
          [75.3, 0.016, z - 0.045],
          [75.3, 0.016, z + 0.045],
          [-75.3, 0.016, z + 0.045],
        ],
        [0, 1, 0],
        C.mark,
      );
    if (d > 1)
      for (let x = -72; x < 75; x += 6)
        Q(
          o,
          'road',
          [
            [x, 0.012, -3.6],
            [x + 0.06, 0.012, -3.6],
            [x + 0.06, 0.012, 3.6],
            [x, 0.012, 3.6],
          ],
          [0, 1, 0],
          rgb('8a9290'),
        );
  }
}
function windows(o, lo, hi, d) {
  if (d === 0) return;
  const [x0, y0, z0] = lo,
    [x1, y1, z1] = hi;
  for (const z of [z0 - 0.035, z1 + 0.035]) {
    Q(
      o,
      'glass',
      [
        [x0 + 0.25, y0 + 0.25, z],
        [x1 - 0.25, y0 + 0.25, z],
        [x1 - 0.25, y1 - 0.25, z],
        [x0 + 0.25, y1 - 0.25, z],
      ],
      [0, 0, z < (z0 + z1) / 2 ? -1 : 1],
    );
    if (d > 1)
      for (let x = x0 + 0.25; x < x1; x += 1.15)
        bar(o, [x, y0 + 0.2, z], [x, y1 - 0.2, z], 0.09, 0.09, [0, 0, 1], C.white);
  }
  for (const x of [x0 - 0.035, x1 + 0.035])
    Q(
      o,
      'glass',
      [
        [x, y0 + 0.25, z0 + 0.25],
        [x, y0 + 0.25, z1 - 0.25],
        [x, y1 - 0.25, z1 - 0.25],
        [x, y1 - 0.25, z0 + 0.25],
      ],
      [x < (x0 + x1) / 2 ? -1 : 1, 0, 0],
    );
}
function house(o, d) {
  const h = plan.operatorHouse,
    x = h.centerX,
    z = h.centerZ;
  box(o, 'house', [x - 2.8, h.bodyBottom, z - 1.35], [x + 2.8, h.bodyTop, z + 1.35], C.house);
  box(o, 'house', [x - 2.1, h.bodyTop, z - 1.4], [x + 2.1, h.cabTop, z + 1.4], C.white);
  windows(o, [x - 2.1, h.bodyTop, z - 1.4], [x + 2.1, h.cabTop, z + 1.4], d);
  for (const s of [-1, 1])
    Q(
      o,
      'house',
      [
        [x - 2.35, h.cabTop, z + s * 1.55],
        [x + 2.35, h.cabTop, z + s * 1.55],
        [x + 1.7, h.roofTop, z],
        [x - 1.7, h.roofTop, z],
      ],
      [0, 1, 0],
      C.white,
    );
  for (const sign of [-1, 1])
    tri(
      o,
      'house',
      [
        [x + sign * 2.35, h.cabTop, z - 1.55],
        [x + sign * 2.35, h.cabTop, z + 1.55],
        [x + sign * 1.7, h.roofTop, z],
      ],
      [sign, 0, 0],
      C.white,
    );
  for (const xx of [x - 2.4, x + 2.4])
    for (const zz of [z - 1.2, z + 1.2])
      member(o, [xx, 0.1, zz], [xx, h.bodyBottom, zz], 0.25, d, [0, 0, 1]);
  if (d > 1) {
    for (let xx = x - 2.5; xx < x + 2.8; xx += 0.8)
      for (const zz of [z - 1.39, z + 1.39])
        bar(o, [xx, h.bodyBottom, zz], [xx, h.bodyTop, zz], 0.1, 0.09, [0, 0, 1], C.house, 'house');
    for (const xx of [x - 3.2, x + 3.2])
      member(o, [xx, 5.4, -5.2], [xx, 8.7, -2.8], 0.23, d, [1, 0, 0]);
  }
  for (const sign of [-1, 1]) {
    const xx = sign * 54;
    box(o, 'house', [xx - 1.3, 0.2, -6.7], [xx + 1.3, 3.2, -4.3], C.house);
    box(o, 'house', [xx - 1.5, 3.2, -6.9], [xx + 1.5, 3.45, -4.1], C.white);
    if (d > 0) windows(o, [xx - 1.3, 1.5, -6.7], [xx + 1.3, 2.85, -4.3], d);
  }
}
function build(o, _f, d = 3) {
  deck(o, d);
  towers(o, d);
  fixedUpper(o, d);
  movingSpan(o, d);
  house(o, d);
}
export const aerialLiftSkyline = (o, f) => build(o, f, 0),
  aerialLiftDistrict = (o, f) => build(o, f, 1),
  aerialLiftStreet = (o, f) => build(o, f, 2);
export const aerialLiftBridgeModel = {
  id: 'aerial_lift_bridge',
  key: 'aerial_lift_bridge',
  recipe: 'structure-aerial-lift-bridge.mjs',
  cell: 'cb/cbq',
  title: 'Aerial Lift Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete current Duluth lift bridge in lowered road-open state: original native151mbridge envelope/road axis, paired open battered lattice towers and concrete footings/inner lift guides/high counterweights/cables/top sheaves/pinnacles, fixed original high arched truss with transverse bracing/catwalk, separate low moving road truss/metal deck/sidewalks/rails, central outboard sea-side operator machinery house/upper glazed cab and small end huts. Two inspected2024native Qualla creatorCC0aerials and official owner dimensions; member/hidden mechanical sections and lake/shore contact approximate. No1905gondola, separate breakwaters/lighthouses/museum/shore buildings/water/boats/people/traffic/copied branding.',
  camera: [170, 100, 205],
  lookAt: [0, 27, 0],
  portableGroundY: -8.4,
  mediumFiContext: { scale: 2.7, groundY: -8.4 },
  qaCameras: [
    {
      name: 'fixed-high-truss-open-towers-and-separate-lowered-road-span',
      position: [100, 58, 195],
      lookAt: [0, 29, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'battered-tower-inner-guides-counterweights-and-top-sheaves',
      position: [-97, 48, -34],
      lookAt: [-63, 39, 0],
    },
    {
      name: 'lower-road-truss-sidewalks-and-outboard-operator-house',
      position: [18, 21, -42],
      lookAt: [0, 6, -2],
    },
    {
      name: 'fixed-upper-arched-truss-lattice-and-transverse-bracing',
      position: [32, 87, 34],
      lookAt: [0, 61, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed northern dry road approach before independent360mrawterrain. Closed road0; lake/waterline/bank/footing and published height measurement datums approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-aerial-lift-bridge.mjs',
    level: 'skyline',
    export: 'aerialLiftSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'aerialLiftDistrict', errorMeters: 1.25, surfaces },
      street: { export: 'aerialLiftStreet', errorMeters: 0.45, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exactly two native4000x2250Bspor.88August2024Qualla originals actually inspected and SHA1matched to pinned Commons explicit own-work/selfCC0releases. Near aerial controls current lattice/upper fixed truss/lowered road truss/guide/weight/sheave/operator-house forms; harbor aerial confirms whole bridge and independent waterfront context. Old1911transporter card, uncreditedPDcandidate and attribution images excluded. No external architectural photograph, generatedbitmap, copied photo texture, lettering or artwork.',
    'Original approximately150.99mroad axis and full ten-vertex actual bridge envelope control plan. Official502ftoverall/386ftmovingtruss/390ftbetween-spans refer to different extents; they are not one global scale. Official225fttop/180ftfixed underside have no explicit surveyed datum, so adopted pavement-relative heights are approximate. Tower batter, footings, truss panel/member sizes, rail/guide/counterweight/cable/sheave details and roof sections are photographic medium-fi estimates, not engineering/as-built survey.',
    'Original high truss remains fixed as an extant1905structural member; the low1930road truss is a separate static lowered span. Large intervening air gap, open lattice towers and underneath water channel stay open. Closeup long built-up members have two rails/open lattice webs, coarser solid rails/representative braces retire fine detail by distance. No operating animation, navigational clearance guarantee, mechanical collision or historic transporter gondola.',
    'Operator house is central along span and outboard on the photographed northeast/sea side, with lower machinery housing and upper glazed cab; road center remains unobstructed. Exact machinery-house sections/conservation/window census and small end huts are estimates. Closed glazing is opaque blue-grey. Traffic, people, boats, lights/flags/signs and copied branding excluded.',
    'Intrinsic bridge road/sidewalk deck and individual concrete footings only; no canal wall/breakwater/lighthouse/museum/neighbor buildings, landscape/site slab or model water. Independent360mrawTerrariumfield frozen before geometry at original north dry-road approach; original source grid/tiles/PNGunchanged without flattening/fitting. Lake level/bank/pier/host datum contact approximate; flatstage is illustrative rather than geographic certification.',
  ],
};
