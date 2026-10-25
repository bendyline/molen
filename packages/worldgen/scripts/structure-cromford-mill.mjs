/** Complete surviving Cromford First Mill and 1785 addition; primary metric scale, published PD references. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcq/cromford_mill/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  P = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('a49b87'),
    cut: rgb('b1a78e'),
    frame: rgb('deded2'),
    roof: rgb('8f9088'),
    glass: rgb('4f5c5c'),
    iron: rgb('424740'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.99, metallic: 0 },
    cut: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.99, metallic: 0 },
    frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.89, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 1, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.4, metallic: 0.03 },
    iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.12 },
  };
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  vary = (c, t) => c.map((v) => Math.min(1, v * t)),
  rect = (x, y, w, h) => [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  const a = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, a, y, false, col);
  cap(o, s, a, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [
        [a[i][0], y, a[i][1]],
        [a[j][0], y, a[j][1]],
        [a[j][0], y + h, a[j][1]],
        [a[i][0], y + h, a[i][1]],
      ],
      [a[j][1] - a[i][1], 0, a[i][0] - a[j][0]],
      col,
    );
  }
}
function rod(o, s, a, b, w, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    len = Math.hypot(...v);
  if (len < 1e-7) return;
  const axis = v.map((v) => v / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    v2 = cross(axis, u),
    ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((v, k) => v + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    D = ring(b);
  Q(
    o,
    s,
    A,
    axis.map((v) => -v),
    col,
  );
  Q(o, s, D, axis, col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], D[j], D[i]], null, col);
  }
}
function arch(cx, invert, spring, crown, r, n) {
  return [
    [cx - r, invert],
    [cx + r, invert],
    [cx + r, spring],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [cx + r * Math.cos(a), spring + (crown - spring) * Math.sin(a)];
    }),
  ];
}
function circle(x, y, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((2 * Math.PI * i) / n),
    y + r * Math.sin((2 * Math.PI * i) / n),
  ]);
}
/** Outer wall is cut around each opening; panes/boards sit behind real jamb reveals. */
function wall(o, d, a, b, wins, normal) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    N = normal ?? [u[1], 0, -u[0]],
    point = (x, y, dep = 0) => [a[0] + u[0] * x + N[0] * dep, y, a[1] + u[1] * x + N[2] * dep],
    quad = (s, x0, x1, y0, y1, dep, col) =>
      Q(
        o,
        s,
        [point(x0, y0, dep), point(x1, y0, dep), point(x1, y1, dep), point(x0, y1, dep)],
        N,
        col,
      ),
    R = [
      [0, 0],
      [len, 0],
      [len, P.eave],
      [0, P.eave],
    ],
    holes = wins.filter((w) => d || w.kind !== 'window'),
    shapes = holes.map((w) => w.shape ?? rect(w.x, w.y, w.w, w.h)),
    flat = [R, ...shapes].flat(),
    hs = [];
  let count = 4;
  for (const r of shapes) {
    hs.push(count);
    count += r.length;
  }
  const ix = earcut(flat.flat(), hs);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'stone',
      ix.slice(i, i + 3).map((k) => point(...flat[k])),
      N,
    );
  const bounds = shapes.map((r) => [
    Math.min(...r.map((v) => v[0])),
    Math.max(...r.map((v) => v[0])),
    Math.min(...r.map((v) => v[1])),
    Math.max(...r.map((v) => v[1])),
  ]);
  if (d > 1) {
    const course = d === 3 ? 0.3 : 0.6,
      rows = Math.ceil(P.eave / course);
    for (let j = 0; j < rows; j++) {
      const y0 = j * course,
        y1 = Math.min(P.eave, (j + 1) * course - 0.012),
        ys = [y0, y1, ...bounds.flatMap((b) => [b[2], b[3]]).filter((y) => y > y0 && y < y1)].sort(
          (a, b) => a - b,
        ),
        block = d === 3 ? 0.8 : 1.3,
        xs = [
          0,
          len,
          ...Array.from({ length: Math.ceil(len / block) }, (_, i) =>
            Math.min(len, (i + (j % 2 ? 0.5 : 0)) * block),
          ),
          ...bounds.flatMap((b) => [b[0], b[1]]),
        ]
          .filter((x) => x >= 0 && x <= len)
          .sort((a, b) => a - b);
      for (let k = 1; k < xs.length; k++)
        for (let l = 1; l < ys.length; l++) {
          const A = xs[k - 1] + 0.006,
            E = xs[k] - 0.006,
            Y = ys[l - 1] + 0.003,
            V = ys[l] - 0.003;
          if (
            E - A < 0.02 ||
            V - Y < 0.02 ||
            bounds.some(
              (b) =>
                (A + E) / 2 > b[0] &&
                (A + E) / 2 < b[1] &&
                (Y + V) / 2 > b[2] &&
                (Y + V) / 2 < b[3],
            )
          )
            continue;
          quad('stone', A, E, Y, V, 0.012, vary(C.stone, 0.89 + ((j * 11 + k * 7) % 13) * 0.017));
        }
    }
  }
  for (const w of wins) {
    const shape = w.shape ?? rect(w.x, w.y, w.w, w.h),
      dep = w.kind === 'open' ? P.culvert.depth : w.kind === 'shaft' ? 0.32 : 0.18;
    if (!d && w.kind === 'window') {
      quad('frame', w.x - w.w / 2, w.x + w.w / 2, w.y, w.y + w.h, 0.018, C.frame);
      quad(
        'glass',
        w.x - w.w / 2 + 0.07,
        w.x + w.w / 2 - 0.07,
        w.y + 0.07,
        w.y + w.h - 0.07,
        0.023,
        C.glass,
      );
      continue;
    }
    const ring = shape,
      slot = ['blocked', 'shaft', 'open'].includes(w.kind) ? 'iron' : 'glass';
    if (w.kind === 'open') {
      const ind = earcut(ring.flat());
      for (let i = 0; i < ind.length; i += 3)
        T(
          o,
          'iron',
          ind.slice(i, i + 3).map((k) => point(...ring[k], -dep)),
          N,
          vary(C.iron, 0.45),
        );
    } else {
      const ind = earcut(ring.flat());
      for (let i = 0; i < ind.length; i += 3)
        T(
          o,
          slot,
          ind.slice(i, i + 3).map((k) => point(...ring[k], -dep)),
          N,
          w.kind === 'window' ? vary(C.glass, 0.94 + ((Math.round(w.x) * 7) % 5) * 0.012) : C.iron,
        );
    }
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k],
        b = ring[(k + 1) % ring.length];
      const dx = b[0] - a[0],
        dy = b[1] - a[1];
      Q(
        o,
        'cut',
        [point(...a), point(...b), point(...b, -dep), point(...a, -dep)],
        [-dy * u[0], dx, -dy * u[1]],
      );
    }
    if (w.kind !== 'window') {
      if (d > 1 && w.kind === 'blocked')
        for (let k = 1; k < 6; k++) {
          const x = w.x - w.w / 2 + (w.w * k) / 6;
          rod(
            o,
            'iron',
            point(x, w.y + 0.02, -0.155),
            point(x, w.y + w.h - 0.02, -0.155),
            0.025,
            vary(C.iron, 0.75),
          );
        }
      continue;
    }
    const frame = (x0, x1, y0, y1) => quad('frame', x0, x1, y0, y1, -0.1, C.frame);
    for (const x of [w.x - w.w / 2 + 0.025, w.x + w.w / 2 - 0.025]) {
      if (d === 3) rod(o, 'frame', point(x, w.y, -0.1), point(x, w.y + w.h, -0.1), 0.075);
      else frame(x - 0.04, x + 0.04, w.y, w.y + w.h);
    }
    for (const y of [w.y + 0.025, w.y + w.h - 0.025]) {
      if (d === 3)
        rod(o, 'frame', point(w.x - w.w / 2, y, -0.1), point(w.x + w.w / 2, y, -0.1), 0.075);
      else frame(w.x - w.w / 2, w.x + w.w / 2, y - 0.04, y + 0.04);
    }
    if (d > 1) {
      const rows = w.panes === 20 ? 5 : 4;
      for (let k = 1; k < 4; k++) {
        const x = w.x - w.w / 2 + (w.w * k) / 4;
        if (d === 3)
          rod(o, 'frame', point(x, w.y + 0.04, -0.12), point(x, w.y + w.h - 0.04, -0.12), 0.028);
        else frame(x - 0.016, x + 0.016, w.y + 0.04, w.y + w.h - 0.04);
      }
      for (let k = 1; k < rows; k++) {
        const y = w.y + (w.h * k) / rows;
        if (d === 3)
          rod(
            o,
            'frame',
            point(w.x - w.w / 2 + 0.04, y, -0.12),
            point(w.x + w.w / 2 - 0.04, y, -0.12),
            k === 2 ? 0.047 : 0.028,
          );
        else frame(w.x - w.w / 2 + 0.04, w.x + w.w / 2 - 0.04, y - 0.016, y + 0.016);
      }
    }
  }
}
function windowsFor(a, b, side, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    global = (x, y, w = 0.92, h = 1.75, kind = 'window', panes = 16, shape = null) => {
      const t = (x - a[0]) / u[0];
      return {
        x: t,
        y,
        w,
        h,
        kind,
        panes,
        shape: shape?.map(([xx, yy]) => [(xx - a[0]) / u[0], yy]),
      };
    },
    windows = [];
  for (let i = 0; i < 15; i++) {
    const x = -13.15 + (26.3 * i) / 14;
    for (let row = 0; row < 3; row++) {
      if (side === 'east' && row === 0 && i < 7) continue;
      if (side === 'west' && row === 0 && [10, 11, 13].includes(i)) continue;
      const w = side === 'west' && row === 1 && [11, 14].includes(i) ? 0.48 : 0.92;
      if (x - w / 2 <= Math.min(a[0], b[0]) + 0.035 || x + w / 2 >= Math.max(a[0], b[0]) - 0.035)
        continue;
      windows.push(global(x, P.mainFloors[row], w, 1.75, 'window', row ? 16 : 20));
    }
  }
  const specials =
    side === 'east'
      ? [
          {
            x: P.wheelOpening.x,
            y: P.wheelOpening.y,
            w: P.wheelOpening.width,
            h: P.wheelOpening.height,
            kind: 'blocked',
          },
          { x: -12.9, y: 0.55, w: 1.12, h: 2.0, kind: 'blocked' },
          {
            x: P.shaftAperture.x,
            y: P.shaftAperture.y,
            w: 0.66,
            h: 0.66,
            kind: 'shaft',
            shape: circle(
              P.shaftAperture.x,
              P.shaftAperture.y,
              P.shaftAperture.radius,
              [8, 12, 20, 32][d],
            ),
          },
          {
            x: P.culvert.x,
            y: 0.14,
            w: 2.6,
            h: 0.81,
            kind: 'open',
            shape: arch(
              P.culvert.x,
              P.culvert.invert,
              P.culvert.spring,
              P.culvert.crown,
              P.culvert.halfWidth,
              [4, 8, 16, 32][d],
            ),
          },
        ]
      : [{ x: 5.62, y: 0.65, w: 1.4, h: 2.2, kind: 'blocked' }];
  for (const w of specials)
    if (w.x - w.w / 2 > Math.min(a[0], b[0]) + 0.02 && w.x + w.w / 2 < Math.max(a[0], b[0]) - 0.02)
      windows.push(global(w.x, w.y, w.w, w.h, w.kind, 16, w.shape));
  return windows;
}
function routePoint(r, t) {
  const ds = r.slice(1).map((v, i) => Math.hypot(v[0] - r[i][0], v[1] - r[i][1])),
    total = ds.reduce((a, b) => a + b, 0);
  let s = t * total;
  for (let i = 0; i < ds.length; i++) {
    if (s <= ds[i] || i === ds.length - 1) return mix(r[i], r[i + 1], Math.min(1, s / ds[i]));
    s -= ds[i];
  }
  return r.at(-1);
}
function roof(o, d) {
  const r = p.outline,
    east = [r[3], r[2], r[1]],
    west = [r[4], r[5], r[0]],
    S = mix(r[3], r[4], 0.5),
    N = mix(r[0], r[1], 0.5);
  for (const chain of [east, west]) {
    const total = chain
        .slice(1)
        .reduce((s, v, i) => s + Math.hypot(v[0] - chain[i][0], v[1] - chain[i][1]), 0),
      split = Math.hypot(chain[1][0] - chain[0][0], chain[1][1] - chain[0][1]) / total,
      n = [2, 12, 128, 256][d],
      ts = [
        ...new Set([0, 1, split, ...Array.from({ length: n - 1 }, (_, i) => (i + 1) / n)]),
      ].sort((a, b) => a - b),
      point = (t, high) => {
        const E = routePoint(chain, t),
          R = mix(S, N, t),
          q = high ? [R[0], P.ridge, R[1]] : [E[0], P.eave + 0.06, E[1]],
          wave = d > 1 ? 0.014 * Math.cos(t * n * Math.PI) : 0;
        return [q[0], q[1] + wave, q[2]];
      };
    for (let i = 1; i < ts.length; i++)
      Q(
        o,
        'roof',
        [point(ts[i - 1], false), point(ts[i], false), point(ts[i], true), point(ts[i - 1], true)],
        [0, 1, 0],
        vary(C.roof, 0.97 + (i % 3) * 0.012),
      );
  }
  for (const [a, b, R] of [
    [r[0], r[1], N],
    [r[3], r[4], S],
  ])
    T(
      o,
      'stone',
      [
        [a[0], P.eave, a[1]],
        [b[0], P.eave, b[1]],
        [R[0], P.ridge, R[1]],
      ],
      [a === r[0] ? 1 : -1, 0, 0],
    );
  if (d)
    for (const chain of [east, west])
      for (let i = 1; i < chain.length; i++)
        rod(
          o,
          'iron',
          [chain[i - 1][0], P.eave + 0.04, chain[i - 1][1]],
          [chain[i][0], P.eave + 0.04, chain[i][1]],
          0.13,
        );
}
function build(o, _f, d = 3) {
  const r = p.outline;
  cap(o, 'stone', r, 0, false);
  cap(o, 'stone', r, P.eave);
  for (const chain of [
    [3, 2, 1],
    [4, 5, 0],
  ])
    for (let i = 1; i < chain.length; i++) {
      const a = r[chain[i - 1]],
        b = r[chain[i]],
        side = chain[0] === 3 ? 'east' : 'west';
      wall(o, d, a, b, windowsFor(a, b, side, d), [0, 0, side === 'east' ? 1 : -1]);
    }
  for (const [ia, ib, north] of [
    [0, 1, true],
    [3, 4, false],
  ]) {
    const a = r[ia],
      b = r[ib],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      wins = [];
    if (north)
      for (const row of [0, 1, 2])
        for (const t of [0.31, 0.7])
          wins.push({
            x: len * t,
            y: P.mainFloors[row],
            w: 0.9,
            h: 1.75,
            kind: 'window',
            panes: row ? 16 : 20,
          });
    else
      for (const y of [0.6, 4.05]) wins.push({ x: len * 0.52, y, w: 1.3, h: 2.0, kind: 'blocked' });
    wall(o, d, a, b, wins, [north ? 1 : -1, 0, 0]);
  }
  roof(o, d);
  if (d) {
    const Aq = P.aqueduct;
    B(o, 'iron', Aq.x, Aq.y, 4.25, Aq.length, 0.12, Aq.width);
    for (const z of [3.92, 4.57]) B(o, 'iron', Aq.x, Aq.y + 0.12, z, Aq.length, 0.42, 0.1);
    for (const x of [Aq.x - Aq.length / 2 + 0.25, Aq.x + Aq.length / 2 - 0.25])
      B(o, 'cut', x, Aq.y - 0.5, 4.2, 0.3, 0.5, 0.8);
  }
  if (d > 1) {
    for (const x of [-9.1, 1.1, 12.8]) {
      const chain = [r[3], r[2], r[1]],
        i = x <= chain[1][0] ? 0 : 1,
        z =
          chain[i][1] +
          ((chain[i + 1][1] - chain[i][1]) * (x - chain[i][0])) / (chain[i + 1][0] - chain[i][0]) +
          0.1;
      rod(o, 'iron', [x, 0.2, z], [x, P.eave - 0.1, z], 0.07);
    }
    const Aq = P.aqueduct;
    for (let i = 0; i < 12; i++) {
      const x = Aq.x - Aq.length / 2 + (Aq.length * i) / 11;
      B(o, 'iron', x, Aq.y + 0.2, 4.62, 0.045, 0.25, 0.08);
    }
  }
}
export const cromfordMillSkyline = (o, f) => build(o, f, 0),
  cromfordMillDistrict = (o, f) => build(o, f, 1),
  cromfordMillStreet = (o, f) => build(o, f, 2),
  cromfordMillCloseup = (o, f) => build(o, f, 3);
export const cromfordMillModel = {
  id: 'cromford_mill',
  key: 'cromford_mill',
  cell: 'gc/gcq',
  recipe: 'structure-cromford-mill.mjs',
  title: 'Cromford First Mill',
  category: 'industrial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [36, 22, 45],
  lookAt: [0, 4.6, 0],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 1.8, groundY: -0.16 },
  qaCameras: [
    {
      name: 'whole-first-mill-1771-and-1785-extension',
      position: [33, 20, 47],
      lookAt: [0, 4.6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'yard-front-sash-windows-wheelopening-and-culvert',
      position: [6, 9, 35],
      lookAt: [0, 4.3, 0],
    },
    {
      name: 'north-end-and-physical-segmental-culvert-mouth',
      position: [24, 7, 22],
      lookAt: [10, 2.8, 2],
    },
    {
      name: 'western-upper-yard-facade-and-low-gray-gable-roof',
      position: [-26, 19, -39],
      lookAt: [0, 5, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: p.geometryBasis,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cromford-mill.mjs',
    level: 'skyline',
    export: 'cromfordMillSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'cromfordMillDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'cromfordMillStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'cromfordMillCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'WholeFirstMillBuilding18with1785extension;three-survivingstoreysratherthanlostfive. SeparatelylistedabuttingBuilding17 andothermillcampusstructures/SecondMillruins/modernwaterwheel/wholewaterpowerplant are independentcompanions, excluded/notcountedbuilt. Complete15-bayarchitecturalrhythm includes source-text-identifiedtwoformerlyoccludedbays; exacthiddenfenestration/doorquoins/roofservices unknown. Coursepattern/colorpatches andverticals approximate.',
    'Threeexactalready-published2009chevinown/PD-selforiginals/nativeSHA1/revisions/itemgrants bound. Native105fileinventorymetadataonly. No additionalarchitecturepixels/questionablerights/otherlicensedphotos/localmediaedits. Primary2024amendedheritagetext supplies metricdimensions/bays/fenestration/conservationstate; operator2026text confirmsongoingsiteuse/otherbuildings. No protectedsitephotos/plans orphoto textures/generatedbitmaps.',
    'Primary28.3x8mmetricbody declaredbeforefield, original6pointnativeproxy41.37x11.25m keptseparatelyratherthanclaimedexactsurvey. Modelpreservesrelativecoarseoutlineatprimarymetricdimensions. Exactworldfootprint/anchorregistration uncertainty remains; preview/replaceFootprint=false. Three-storey~9.2meaves/10.8mridge/windowheights/foundation/culvert/aqueductremnantposition/source-relativegrades are approximate.',
    'Actualrecessed16paneupper/20panegroundwindows, realboardedwheelopening/circularshaftpocket andshortsegmentalculvertmouth/soffit; modelonlyvisibleportal/shortdarkvault, notsurveyedundergroundbrookroute. No restoredworkinghistoricwheel orwater/cliff/yard meshes. Stonegrain/paintedframes/roughgraycorrugatedsheetroof useportablepalette plus sharedgraphs, notphoto textures.',
    'Independent256m129²16641samples/originalTerrariumtiles frozenbeforegeometry unchanged. Providerrelativeapproachdatumnotasurvey, outputpixels/gridmayoversamplecoarseDEM; actualhostgroundcontactunverified. Flatreviewfixtures; no fieldfitting/flattening/reacquisition.',
  ],
};
