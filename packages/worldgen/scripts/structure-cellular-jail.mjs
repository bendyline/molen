/** Three surviving radial prison wings, central watchtower and intrinsic entrance/work buildings. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/w4/w41/cellular_jail/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff';
const C = {
  brick: rgb('726a59'),
  ochre: rgb('c8b976'),
  trim: rgb('c5c7b8'),
  roof: rgb('a56e5b'),
  metal: rgb('557f70'),
  window: rgb('4b625b'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.97, metallic: 0 },
  ochre: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.89, metallic: 0.13 },
  window: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.68, metallic: 0.04 },
};
const area = (r) =>
    r.reduce((s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0),
  mid = (a, b) => a.map((v, i) => (v + b[i]) / 2),
  CW = (r) => (area(r) < 0 ? r : r.toReversed());
function T(o, s, p, n) {
  p = p.map((q) => q.map(Math.fround));
  const q = normalFor(...p);
  if (q.every((v) => v === 0)) return;
  if (n && q.reduce((a, v, i) => a + v * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((q) => [q[0] + q[2], q[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], typeof y === 'function' ? y(r[k]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function solid(o, s, raw, lo, hi) {
  const r = CW(raw),
    Y = (y, p) => (typeof y === 'function' ? y(p) : y);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], Y(lo, a), a[1]],
        [b[0], Y(lo, b), b[1]],
        [b[0], Y(hi, b), b[1]],
        [a[0], Y(hi, a), a[1]],
      ],
      [-(b[1] - a[1]), 0, b[0] - a[0]],
    );
  }
  cap(o, s, r, lo, false);
  cap(o, s, r, hi);
}
function frame(a, b) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
    v = [-u[1], u[0]],
    P = (x, y, z) => [a[0] + u[0] * x + v[0] * z, y, a[1] + u[1] * x + v[1] * z];
  return { L, u, v, P };
}
function block(o, s, F, x, y, z, w, h, t) {
  const r = [
    [-w / 2, -t / 2],
    [w / 2, -t / 2],
    [w / 2, t / 2],
    [-w / 2, t / 2],
  ].map(([a, b]) => {
    const q = F.P(x + a, 0, z + b);
    return [q[0], q[2]];
  });
  solid(o, s, r, y - h / 2, y + h / 2);
}
function stick(o, s, a, b, w, d) {
  if (d > 1) beam(o, s, a, b, w, w, C[s]);
  else {
    const v = b.map((q, i) => q - a[i]),
      L = Math.hypot(...v),
      u = Math.abs(v[1]) > L * 0.99 ? [w / 2, 0, 0] : [0, w / 2, 0],
      p = [
        a.map((q, i) => q - u[i]),
        b.map((q, i) => q - u[i]),
        b.map((q, i) => q + u[i]),
        a.map((q, i) => q + u[i]),
      ];
    Q(o, s, p);
    Q(o, s, p.toReversed());
  }
}
function arch(o, s, F, c, base, z, w, spring, rise, hi, depth, d) {
  const N = [2, 2, 4, 8][d];
  for (let j = 0; j < N; j++) {
    const a = Math.PI - (Math.PI * j) / N,
      b = Math.PI - (Math.PI * (j + 1)) / N,
      x = c + (w / 2) * Math.cos(a),
      xx = c + (w / 2) * Math.cos(b),
      y = base + spring + rise * Math.sin(a),
      yy = base + spring + rise * Math.sin(b);
    for (const k of [-1, 1])
      Q(
        o,
        s,
        [
          F.P(x, y, z + (k * depth) / 2),
          F.P(xx, yy, z + (k * depth) / 2),
          F.P(xx, base + hi, z + (k * depth) / 2),
          F.P(x, base + hi, z + (k * depth) / 2),
        ],
        [F.v[0] * k, 0, F.v[1] * k],
      );
    Q(
      o,
      s,
      [
        F.P(x, y, z - depth / 2),
        F.P(x, y, z + depth / 2),
        F.P(xx, yy, z + depth / 2),
        F.P(xx, yy, z - depth / 2),
      ],
      [0, -1, 0],
    );
  }
}
const wings = plan.wings.map((w) => {
  const a = mid(...w.near),
    b = mid(...w.far),
    F = frame(a, b),
    width = Math.hypot(w.far[0][0] - w.far[1][0], w.far[0][1] - w.far[1][1]);
  return { ...w, F, width };
});
function prison(o, d) {
  solid(o, 'brick', plan.rings[0], -0.45, 0);
  solid(o, 'trim', plan.rings[0], 10.15, 10.42);
  if (d) for (const y of [3.4, 6.8]) solid(o, 'brick', plan.rings[0], y - 0.16, y);
  for (const w of wings) {
    const { F, width } = w,
      L = F.L,
      front = width / 2 - 0.16,
      inner = front - 1.75,
      n = d === 0 ? 2 : Math.round(L / [0, 18, 10, 3.15][d]),
      pitch = L / n,
      pier = d < 2 ? 0.64 : 0.48,
      opening = pitch - pier;
    const core = [
      F.P(0, 0, -width / 2),
      F.P(L, 0, -width / 2),
      F.P(L, 0, inner),
      F.P(0, 0, inner),
    ].map((p) => [p[0], p[2]]);
    solid(o, 'brick', core, 0, 10.15);
    for (let i = 0; i <= n; i++) {
      const x = i * pitch;
      if (d < 2) block(o, 'brick', F, x, 5.075, front, pier, 10.15, 0.36);
      else
        for (let f = 0; f < 3; f++) {
          block(o, f === 0 ? 'trim' : 'brick', F, x, f * 3.4 + 1.65, front, pier, 3.3, 0.36);
          block(o, 'trim', F, x, f * 3.4 + 2.07, front, pier + 0.16, 0.18, 0.44);
        }
    }
    for (let f = 0; f < 3; f++) {
      const base = f * 3.4;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * pitch;
        arch(o, 'brick', F, x, base, front, opening, 2.0, 1.0, 3.25, 0.36, d);
        if (d > 0) {
          Q(
            o,
            'window',
            [
              F.P(x - 0.43, base + 0.08, inner + 0.015),
              F.P(x + 0.43, base + 0.08, inner + 0.015),
              F.P(x + 0.43, base + 2.15, inner + 0.015),
              F.P(x - 0.43, base + 2.15, inner + 0.015),
            ],
            [F.v[0], 0, F.v[1]],
          );
          if (d > 1) {
            block(o, 'trim', F, x, base + 2.2, inner + 0.02, 0.94, 0.12, 0.14);
            Q(
              o,
              'window',
              [
                F.P(x - 0.32, base + 2.45, -width / 2 - 0.014),
                F.P(x + 0.32, base + 2.45, -width / 2 - 0.014),
                F.P(x + 0.32, base + 2.85, -width / 2 - 0.014),
                F.P(x - 0.32, base + 2.85, -width / 2 - 0.014),
              ],
              [-F.v[0], 0, -F.v[1]],
            );
            block(o, 'roof', F, x, base + 2.93, -width / 2 - 0.23, 0.93, 0.11, 0.56);
            if (d > 2)
              for (const zz of [-0.36, 0.36])
                stick(
                  o,
                  'brick',
                  F.P(x + zz, base + 2.55, -width / 2 - 0.015),
                  F.P(x + zz, base + 2.88, -width / 2 - 0.5),
                  0.09,
                  d,
                );
          }
        }
        if (d > 0) {
          stick(
            o,
            'metal',
            F.P(x - opening / 2, base + 1, front),
            F.P(x + opening / 2, base + 1, front),
            0.055,
            d,
          );
          if (d > 1) {
            const bars = d === 2 ? 0 : 3;
            for (let k = 1; k <= bars; k++) {
              const xx = x - opening / 2 + (opening * k) / (bars + 1);
              stick(o, 'metal', F.P(xx, base + 0.08, front), F.P(xx, base + 1, front), 0.035, d);
            }
          }
        }
      }
      if (d > 1) block(o, 'brick', F, L / 2, base + 0.07, front - 0.75, L, 0.14, 1.9);
    }
    if (d > 0) {
      block(o, 'brick', F, L / 2, 10.72, 0, L, 0.6, width);
      const nn = d === 1 ? n : 2 * n;
      for (let i = 0; i < nn; i++)
        for (const z of [-width / 2 + 0.2, width / 2 - 0.2])
          block(o, 'trim', F, ((i + 0.5) * L) / nn, 11.15, z, d === 1 ? 0.65 : 0.45, 0.35, 0.45);
    }
  }
}
function cylinder(o, s, c, r, lo, hi, n) {
  const ring = Array.from({ length: n }, (_, i) => [
    c[0] + r * Math.cos((-i * 2 * Math.PI) / n),
    c[1] + r * Math.sin((-i * 2 * Math.PI) / n),
  ]);
  solid(o, s, ring, lo, hi);
  return ring;
}
function watchtower(o, d) {
  const r = plan.hub,
    center = r.reduce((s, p) => s.map((v, i) => v + p[i] / r.length), [0, 0]),
    R = 6.1,
    F = frame(center, [center[0] + 1, center[1]]);
  solid(o, 'brick', r, -0.4, 10.42);
  if (d > 0)
    for (const y of [0.2, 3.4, 6.8, 10.2]) {
      const q = r.map((p) => p.map((v, i) => center[i] + (v - center[i]) * 1.025));
      solid(o, 'trim', q, y, y + 0.16);
    }
  const N = d === 0 ? 6 : 8,
    ring = Array.from({ length: N }, (_, i) => [
      center[0] + R * Math.cos((-i * 2 * Math.PI) / N),
      center[1] + R * Math.sin((-i * 2 * Math.PI) / N),
    ]);
  solid(o, 'trim', ring, 10.35, 10.55);
  for (let i = 0; i < N; i++) {
    const a = ring[i],
      b = ring[(i + 1) % N],
      aa = [a[0], 10.55, a[1]],
      bb = [a[0], 13.0, a[1]];
    stick(o, 'metal', aa, bb, 0.13, d);
    if (d > 0) {
      for (const y of [11.5, 12.85]) stick(o, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.1, d);
      if (d > 1) stick(o, 'metal', [a[0], 10.6, a[1]], [b[0], 12.85, b[1]], 0.09, d);
    }
  }
  const roof = ring.map((p) => p.map((v, i) => center[i] + (v - center[i]) * 1.14));
  cap(o, 'roof', roof, 12.95, false);
  for (let i = 0; i < N; i++)
    T(
      o,
      'roof',
      [
        [roof[i][0], 13, roof[i][1]],
        [roof[(i + 1) % N][0], 13, roof[(i + 1) % N][1]],
        [center[0], 15.3, center[1]],
      ],
      [0, 1, 0],
    );
  if (d > 1) {
    block(o, 'ochre', F, 0, 5, 0, 2.2, 10, 2.2);
    for (let j = 0; j < 24; j++) {
      const y = 0.3 + j * 0.4,
        sgn = j % 2 === 0 ? -1 : 1;
      block(o, 'metal', F, sgn * 2.1, y, 0, 1.8, 0.13, 3.1);
    }
  }
}
const gate = plan.gate,
  G = {
    P: (x, y, z) => [
      gate.center[0] + gate.u[0] * x + gate.v[0] * z,
      y,
      gate.center[1] + gate.u[1] * x + gate.v[1] * z,
    ],
    u: gate.u,
    v: gate.v,
  },
  project = (p) => [
    (p[0] - gate.center[0]) * gate.u[0] + (p[1] - gate.center[1]) * gate.u[1],
    (p[0] - gate.center[0]) * gate.v[0] + (p[1] - gate.center[1]) * gate.v[1],
  ],
  GR = gate.ring.map(project),
  fromGate = (r) =>
    r.map((p) => {
      const q = G.P(p[0], 0, p[1]);
      return [q[0], q[2]];
    });
function clip(raw, bound, keep) {
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i],
      b = raw[(i + 1) % raw.length],
      aa = keep * (a[0] - bound) >= 0,
      bb = keep * (b[0] - bound) >= 0;
    if (aa) out.push(a);
    if (aa !== bb) {
      const t = (bound - a[0]) / (b[0] - a[0]);
      out.push([bound, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function entrance(o, d) {
  for (const k of [-1, 1]) solid(o, 'ochre', fromGate(clip(GR, k * 2.5, k)), -0.4, 4.8);
  solid(o, 'ochre', gate.ring, 4.8, 9.7);
  const depth = -Math.min(...GR.map((p) => p[1]));
  arch(o, 'ochre', G, 0, 0, -depth / 2, 5, 3, 1.6, 4.8, depth, d);
  if (d > 0) {
    block(o, 'trim', G, 0, 4.7, 1.1, gate.length, 0.24, 2.6);
    block(o, 'roof', G, 0, 7.9, 1.2, gate.length, 0.16, 2.7);
    for (let i = 0; i <= 12; i++) {
      const x = -gate.length / 2 + (i * gate.length) / 12;
      stick(o, 'metal', G.P(x, 4.85, 2.25), G.P(x, 7.8, 2.25), 0.13, d);
      if (d > 1) {
        stick(o, 'metal', G.P(x, 7.8, 2.1), G.P(x + 0.6, 6.5, 2.1), 0.09, d);
        for (let k = 1; k < 5; k++)
          stick(
            o,
            'metal',
            G.P(x + (k * gate.length) / 60, 4.85, 2.25),
            G.P(x + (k * gate.length) / 60, 5.85, 2.25),
            0.045,
            d,
          );
      }
    }
    for (const y of [5.85, 5.0])
      stick(o, 'metal', G.P(-gate.length / 2, y, 2.25), G.P(gate.length / 2, y, 2.25), 0.085, d);
    for (let x = -gate.length / 2 + 2; x < gate.length / 2; x += 4.2) {
      if (Math.abs(x) < 4) continue;
      for (const y of [1.5, 6.1]) {
        Q(
          o,
          'window',
          [
            G.P(x - 0.55, y - 1.1, 0.015),
            G.P(x + 0.55, y - 1.1, 0.015),
            G.P(x + 0.55, y + 1.1, 0.015),
            G.P(x - 0.55, y + 1.1, 0.015),
          ],
          [gate.v[0], 0, gate.v[1]],
        );
        if (d > 1) {
          arch(o, 'trim', G, x, y - 1.1, 0.12, 1.1, 1.45, 0.55, 2.15, 0.18, d);
          stick(o, 'metal', G.P(x, y - 1.05, 0.04), G.P(x, y + 0.92, 0.04), 0.045, d);
        }
      }
    }
    block(o, 'trim', G, 0, 9.72, 0, gate.length, 0.22, 0.7);
    if (d > 1)
      for (let x = -gate.length / 2; x < gate.length / 2; x += 2.3)
        block(o, 'trim', G, x, 10.1, 0, 0.85, 0.55, 0.65);
  }
  for (const x of [-13.8, 13.8]) {
    const q = G.P(x, 0, 1.25),
      c = [q[0], q[2]],
      N = [8, 12, 20, 32][d],
      r = 2.6;
    cylinder(o, 'ochre', c, r, -0.4, 14.2, N);
    if (d > 0) for (const y of [4.8, 9.7, 13.8]) cylinder(o, 'trim', c, r + 0.09, y, y + 0.18, N);
    if (!d) {
      const lower = Array.from({ length: N }, (_, i) => [
          c[0] + r * Math.cos((-i * 2 * Math.PI) / N),
          c[1] + r * Math.sin((-i * 2 * Math.PI) / N),
        ]),
        upper = lower.map((p) => p.map((v, k) => c[k] + (v - c[k]) * 1.25));
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        Q(o, 'trim', [
          [lower[i][0], 14.2, lower[i][1]],
          [lower[j][0], 14.2, lower[j][1]],
          [upper[j][0], 15.6, upper[j][1]],
          [upper[i][0], 15.6, upper[i][1]],
        ]);
      }
      cap(o, 'trim', upper, 15.6);
    } else {
      const nn = d === 1 ? 8 : 16;
      for (let i = 0; i < nn; i++) {
        const a = (-i * 2 * Math.PI) / nn,
          rr = 2.86,
          F = frame([c[0], c[1]], [c[0] + Math.cos(a), c[1] + Math.sin(a)]);
        block(o, 'ochre', F, rr, 14.9, 0, 0.8, 1.4, 0.32);
      }
      cylinder(o, 'trim', c, 3.27, 15.5, 15.8, N);
      for (let i = 0; i < nn; i++) {
        const a = (-i * 2 * Math.PI) / nn,
          F = frame(c, [c[0] + Math.cos(a), c[1] + Math.sin(a)]);
        block(o, 'trim', F, 3.02, 16, 0, 0.55, 0.4, 0.6);
      }
    }
    if (d > 1) {
      Q(
        o,
        'window',
        [
          G.P(x - 0.48, 0.05, 3.88),
          G.P(x + 0.48, 0.05, 3.88),
          G.P(x + 0.48, 2.25, 3.88),
          G.P(x - 0.48, 2.25, 3.88),
        ],
        [gate.v[0], 0, gate.v[1]],
      );
    }
  }
}
function shed(o, raw, d, gallows = false) {
  const a = mid(raw[0], raw.at(-1)),
    b = mid(raw[1], raw[2]),
    F = frame(a, b),
    width =
      Math.max(...raw.map((p) => Math.abs((p[0] - a[0]) * F.v[0] + (p[1] - a[1]) * F.v[1]))) * 2,
    eave = gallows ? 3.4 : 2.7,
    roof = (p) =>
      eave +
      (gallows ? 1.7 : 1.4) *
        (1 - Math.min(1, Math.abs((p[0] - a[0]) * F.v[0] + (p[1] - a[1]) * F.v[1]) / (width / 2)));
  solid(o, 'brick', raw, -0.35, eave - 0.1);
  const local = raw.map((p) => [
    (p[0] - a[0]) * F.u[0] + (p[1] - a[1]) * F.u[1],
    (p[0] - a[0]) * F.v[0] + (p[1] - a[1]) * F.v[1],
  ]);
  for (const k of [-1, 1]) {
    const part = clip(
      local.map((p) => [p[1], p[0]]),
      0,
      k,
    ).map((p) => {
      const q = F.P(p[1], 0, p[0]);
      return [q[0], q[2]];
    });
    if (part.length > 2) solid(o, 'roof', part, roof, (p) => roof(p) + 0.14);
  }
  if (d > 1)
    for (let x = 2; x < F.L; x += 4) {
      block(o, 'metal', F, x, 1.2, width / 2 + 0.014, 1.25, 2.1, 0.08);
      stick(o, 'metal', F.P(x, 0, width / 2), F.P(x, eave, width / 2), 0.12, d);
    }
}
function build(o, _f, d = 3) {
  prison(o, d);
  watchtower(o, d);
  entrance(o, d);
  shed(o, plan.workshed, d);
  shed(o, plan.gallows, d, true);
}
export const cellularJailSkyline = (o, f) => build(o, f, 0);
export const cellularJailDistrict = (o, f) => build(o, f, 1);
export const cellularJailStreet = (o, f) => build(o, f, 2);
const F = wings[1].F,
  front = wings[1].width / 2;
export const cellularJailModel = {
  id: 'cellular_jail',
  key: 'cellular_jail',
  recipe: 'structure-cellular-jail.mjs',
  cell: 'w4/w41',
  title: 'Cellular Jail',
  category: 'historic-prison',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [190, 135, 295],
  lookAt: [5, 5, 78],
  portableGroundY: -0.6,
  mediumFiContext: { scale: 2, groundY: -0.6 },
  qaCameras: [
    {
      name: 'whole-three-surviving-wings-watchtower-and-entrance',
      position: [-180, 145, 280],
      lookAt: [0, 5, 75],
    },
    {
      name: 'ochre-gateway-two-flared-round-towers-and-upper-gallery',
      position: G.P(0, 14, 64),
      lookAt: G.P(0, 7, 0),
    },
    {
      name: 'real-three-level-arched-corridors-railings-and-cell-doors',
      position: F.P(70, 8, front + 18),
      lookAt: F.P(60, 5, front),
    },
    {
      name: 'rear-cell-ventilators-and-intrinsic-workshed-gallows',
      position: [-65, 18, 115],
      lookAt: [12, 4, 94],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent360m91x91coastalfield/4rawtilesfrozenbeforegeometryatunchangedinitialentranceregistrationpoint,subsequentlylocated1.16mbehindactualfacade. Originalacquisitionprosecorrectedindurablerecord; rawgrid/datumunchanged. Coastalbathymetry/urbanreturnsandthresholdcontactuncertified, nogroundfitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cellular-jail.mjs',
    level: 'skyline',
    export: 'cellularJailSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'cellularJailDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'cellularJailStreet', errorMeters: 0.32, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Quallafirst55families/0conflicts. TwoexactAmbujSaxena2003-12-12publishedselfphotographedPDselfwholeoriginalsplusoneexact2010-04-05PramukhownPDself2288x1712entranceoriginalindividuallyinspected/nativeSHA1matched. Supplementfoundin14-filegatesubcategoryafterbounded200-filemaininventory. QuallaCC0courtesy-nameconflictandtransferredPDuserphotographnotadopted. Allattributionimages/unrelatedregionalimages/modernsculptures/signsunused; no generated/copiedbitmaptextures.',
    'Entirethreewingoriginalnativeoutline/watchtower,originalfullentranceblock,Workshed/Gallowspolygonsretained. Radialwingbodiesaredeepcellrowswithrealopenarchedgalleries,whitegroundpiers/caps,darkbrickbands,thinrailsandrearventilatorhoods. Centralopenwatchgallery/redpyramidalroof,ochreentrance/tworoundflaredcrowns/uppergallery/realmaingateway,ownredshedroofsincluded. Destroyedfourwingsandhospitalnotinvented.',
    'Floorpitch3.4m/wingroof10.42m/central15.3m/gatebody9.7m/towers16.2m,wingpartition/cellcount/archpitch,roundtowercenters±13.8mandradius2.6m, crown/bracket/rail/ventilatorcensusandrearentrancesectionsestimatedfromthreephotographs, notsurveyed. Native3levelentrancetagnotblindlyapplied; phototwofrontoccupiablefloorsandtallroundtowersgovern.',
    'LowerLODsgroupwingarchesandomitfinebars/vents/battlementswhilepreservingallthreefulllengthwings/threefloors/openfrontgalleries/centralwatchtower/entiregatewayandtwoturrets/ownworkbuildings. Nofullhistoricalsevenwingrestoration/interiorexhibits/modernmuseumserviceblocks/parcelwalls/landscape/grounds/paths/art/people/signs/vehicles.',
    'Independent360m91x91/8281heightsand4rawsourceTerrariumtilesretainedunchanged. Fieldextendsintoverydeepcoastalwaterandcontainsurbanreturns; notsurveyedprisonfloorlevels. Allintrinsicfloor/footingsmodeldatumapproximate,flatQAgroundonly; currentlivehostthresholdcontactunverified. PreviewreplaceFootprint=false,nogradingorwholeparcelpad.',
  ],
};
