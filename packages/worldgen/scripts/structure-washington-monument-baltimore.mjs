/** Baltimore's marble column, gallery, own circular enclosure and draped Washington figure. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const white = rgb('dddcd2'),
  light = rgb('e8e6db'),
  vein = rgb('c3c1b7'),
  joint = rgb('bcbcb3'),
  iron = rgb('333b38'),
  bronze = rgb('5a6256'),
  glass = rgb('8c9897');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function round(
  o,
  levels,
  d,
  {
    n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 40 : 64,
    x = 0,
    z = 0,
    c = white,
    slot = 'marble',
    cap = true,
  } = {},
) {
  loft(
    o,
    slot,
    levels.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    c,
    { cap },
  );
}
function ribbon(o, s, a, b, w, c = joint) {
  const delta = b.map((v, i) => v - a[i]),
    l = Math.hypot(...delta),
    across =
      Math.abs(delta[1]) > 0.001
        ? [((-delta[1] / l) * w) / 2, ((delta[0] / l) * w) / 2, 0]
        : [0, w / 2, 0],
    p = [
      a.map((v, i) => v + across[i]),
      b.map((v, i) => v + across[i]),
      b.map((v, i) => v - across[i]),
      a.map((v, i) => v - across[i]),
    ];
  quad(o, s, p, normalFor(...p), c);
}
function gallery(o, d) {
  const n = d === 0 ? 16 : d === 1 ? 32 : 64;
  // The monument's own raised circular paved enclosure, not a replacement terrain surface.
  round(
    o,
    [
      [-0.8, 14.75],
      [0.32, 14.75],
      [0.48, 14.9],
      [0.55, 14.9],
    ],
    d,
    { n, c: vein },
  );
  for (let i = 0; i < 4; i++) {
    const q = facing(o, (i * Math.PI) / 2);
    for (const sign of [-1, 1]) B(q, 'marble', sign * 4.1, 0.55, 7.4, 6.0, 5.15, 0.7, white);
    B(q, 'marble', 0, 3.8, 7.4, 2.2, 1.9, 0.7, white);
    B(q, 'marble', 0, 0.55, 7.4, 2.2, 0.4, 0.7, white);
    if (d > 0) {
      face(q, 'glass', 0, 0.95, 7.13, 1.65, 2.85, glass);
      for (const x of [-0.92, 0.92]) B(q, 'marble', x, 0.95, 7.82, 0.22, 3.05, 0.25, light);
      B(q, 'marble', 0, 3.8, 7.83, 2.13, 0.26, 0.3, light);
      for (const x of [-0.5, 0, 0.5]) B(q, 'iron', x, 1.02, 7.24, 0.045, 2.65, 0.06, iron);
      for (const y of [1.2, 2.0, 2.8, 3.5]) B(q, 'iron', 0, y, 7.24, 1.62, 0.045, 0.06, iron);
      if (d > 1) {
        const mark = (x, y, w) => {
          const n = d === 2 ? 6 : 12;
          for (let i = 0; i < n; i++) {
            const xx = x - w / 2 + ((i + 0.5) * w) / n;
            face(q, 'bronze', xx, y, 7.78, (w / n) * 0.35, 0.07 + (i % 3) * 0.015, bronze);
            if (d > 2 && i % 2 === 0)
              face(q, 'bronze', xx + 0.025, y + 0.055, 7.781, (w / n) * 0.5, 0.025, bronze);
          }
        };
        for (const x of [-4.3, 4.3])
          for (let row = 0; row < 4; row++) mark(x, 2.6 + row * 0.3, row % 2 ? 2.0 : 1.5);
        for (let row = 0; row < 3; row++) mark(0, 4.55 + row * 0.2, 2.4 - row * 0.15);
      }
      if (d > 1) {
        for (const y of [1.35, 2.1, 2.85, 3.6, 4.35, 5.1])
          face(q, 'marble', 0, y, 7.756, 14.25, 0.014, joint);
        for (const sign of [-1, 1])
          for (let k = 0; k < 4; k++) {
            const x = sign * (1.7 + k * 1.5);
            face(q, 'marble', x, 1.36 + (k % 2) * 0.75, 7.761, 0.014, 0.73, joint);
            face(q, 'marble', x, 3.61 + (k % 2) * 0.75, 7.761, 0.014, 0.73, joint);
          }
      }
    }
    const steps = d === 0 ? 1 : 4;
    for (let j = 0; j < steps; j++)
      B(q, 'marble', 0, 0.55 + j * 0.1, 8.2 + (steps - j - 0.5) * 0.35, 2.3, 0.1, 0.37, light);
    if (d > 0) {
      for (const sign of [-1, 1]) {
        beam(q, 'iron', [sign * 1.18, 0.85, 9.8], [sign * 1.18, 1.45, 8.0], 0.055, 0.055, iron);
        for (let j = 0; j < 4; j++)
          B(q, 'iron', sign * 1.18, 0.65 + j * 0.1, 9.55 - j * 0.4, 0.035, 0.65, 0.035, iron);
      }
    }
  }
  B(o, 'marble', 0, 5.7, 0, 15.2, 0.24, 15.8, vein);
  B(o, 'marble', 0, 5.94, 0, 15.65, 0.3, 16.25, light);
  B(o, 'marble', 0, 6.24, 0, 15.3, 0.22, 15.9, white);
  const steps = d < 2 ? 2 : 5;
  for (let j = 0; j < steps; j++)
    B(
      o,
      'marble',
      0,
      6.46 + j * 0.1,
      0,
      11.3 - j * (4.2 / steps),
      0.1,
      11.3 - j * (4.2 / steps),
      light,
    );
  B(o, 'marble', 0, 6.46 + steps * 0.1, 0, 6.7, 1.25 - steps * 0.1, 6.7, white);
  B(o, 'marble', 0, 7.71, 0, 7.0, 0.24, 7.0, light);
  // Four enlarged circular skylights are visible from above, rather than urns on roof corners.
  if (d > 0)
    for (const x of [-5.05, 5.05])
      for (const z of [-5.15, 5.15]) {
        round(
          o,
          [
            [6.46, 0.76],
            [6.62, 0.76],
            [6.68, 0.62],
          ],
          d,
          { n: d === 1 ? 8 : 20, x, z, c: light },
        );
        round(
          o,
          [
            [6.68, 0.59],
            [6.83, 0.38],
            [6.88, 0.08],
          ],
          d,
          { n: d === 1 ? 8 : 20, x, z, c: glass, slot: 'glass' },
        );
        if (d > 1)
          for (const a of [0, Math.PI / 2])
            beam(
              o,
              'iron',
              [x - Math.cos(a) * 0.58, 6.76, z - Math.sin(a) * 0.58],
              [x + Math.cos(a) * 0.58, 6.76, z + Math.sin(a) * 0.58],
              0.035,
              0.035,
              iron,
            );
      }
  if (d > 1) {
    for (let j = 0; j < 4; j++) {
      const q = facing(o, (j * Math.PI) / 2);
      for (let k = -6; k <= 6; k++) {
        if (Math.abs(k) > 3) face(q, 'marble', k, 6.465, 0, 0.013, 0.01, joint);
      }
    }
  }
}

function forgedBeam(o, slot, a, b, w, d, c) {
  const out = {
    addTriangle: (...v) => o.addTriangle(...v),
    addQuad: (...v) => o.addQuad(...v),
    addConvexPolygon: (slot, ref, p, n, _uv, c) => {
      const drop = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
        axes = [0, 1, 2].filter((i) => i !== drop);
      return o.addConvexPolygon(slot, ref, p, n, (p) => [p[axes[0]], p[axes[1]]], c);
    },
  };
  beam(out, slot, a, b, w, d, c);
}
const ironwork = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dq/dqc/washington_monument_baltimore/ironwork-construction-controls.json',
      import.meta.url,
    ),
  ),
);
/** Closed flat forged stock, including actual counter edges rather than painted cutouts. */
function ringStock(o, slot, x, y, z, ro, ri, n, depth) {
  const p = (r, a, zz) => [x + r * Math.cos(a), y + r * Math.sin(a), zz];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    for (const [zz, reverse] of [
      [z + depth / 2, false],
      [z - depth / 2, true],
    ]) {
      const ps = [p(ri, a, zz), p(ro, a, zz), p(ro, b, zz), p(ri, b, zz)];
      quad(o, slot, reverse ? [...ps].reverse() : ps, [0, 0, reverse ? -1 : 1], iron);
    }
    for (const [r, reverse] of [
      [ro, false],
      [ri, true],
    ]) {
      const ps = [
        p(r, a, z - depth / 2),
        p(r, b, z - depth / 2),
        p(r, b, z + depth / 2),
        p(r, a, z + depth / 2),
      ];
      const v = reverse ? [...ps].reverse() : ps;
      quad(o, slot, v, normalFor(...v), iron);
    }
  }
}
function plateStock(o, slot, outline, z, depth) {
  const center = outline.reduce(
    (a, p) => [a[0] + p[0] / outline.length, a[1] + p[1] / outline.length],
    [0, 0],
  );
  for (const [zz, reverse] of [
    [z + depth / 2, false],
    [z - depth / 2, true],
  ])
    for (let i = 0; i < outline.length; i++) {
      const ps = [
          [...center, zz],
          [...outline[i], zz],
          [...outline[(i + 1) % outline.length], zz],
        ],
        v = reverse ? [...ps].reverse() : ps;
      o.addTriangle(
        slot,
        'palette:#ffffff',
        v,
        [0, 0, reverse ? -1 : 1],
        v.map((p) => [p[0], p[1]]),
        iron,
      );
    }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      ps = [
        [...a, z - depth / 2],
        [...b, z - depth / 2],
        [...b, z + depth / 2],
        [...a, z + depth / 2],
      ];
    quad(o, slot, ps, normalFor(...ps), iron);
  }
}
function lance(o, slot, x, y, z, width, height, depth) {
  plateStock(
    o,
    slot,
    [
      [x, y - height / 2],
      [x + width / 2, y],
      [x, y + height / 2],
      [x - width / 2, y],
    ],
    z,
    depth,
  );
}
function medallion(o, x, y, z, d) {
  const k = ironwork,
    n = k.ringSegments[d === 3 ? 'close' : 'street'];
  ringStock(o, 'railMedallion', x, y, z, k.medallionOuter, k.medallionInner, n, 0.052);
  if (d === 3) {
    ringStock(
      o,
      'railMedallion',
      x,
      y,
      z,
      k.medallionSecondOuter,
      k.medallionSecondInner,
      n,
      0.045,
    );
    for (const sign of [-1, 1])
      B(
        o,
        'railRosette',
        x,
        y +
          sign * (k.medallionOuter + (k.top - k.middle - k.medallionOuter) / 2) -
          (k.top - k.middle - k.medallionOuter + 0.02) / 2,
        z,
        0.035,
        k.top - k.middle - k.medallionOuter + 0.02,
        0.045,
        iron,
      );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      forgedBeam(
        o,
        'railRosette',
        [x + 0.198 * Math.cos(a), y + 0.198 * Math.sin(a), z],
        [x + 0.234 * Math.cos(a), y + 0.234 * Math.sin(a), z],
        0.024,
        0.022,
        iron,
      );
    }
    for (let i = 0; i < k.rosetteLeaves; i++) {
      const a = (i * Math.PI * 2) / k.rosetteLeaves,
        cs = Math.cos(a),
        sn = Math.sin(a),
        p = (r, t) => [x + cs * r - sn * t, y + sn * r + cs * t];
      plateStock(
        o,
        'railRosette',
        [p(0.07, 0), p(0.132, -0.032), p(0.181, 0), p(0.132, 0.032)],
        z + 0.004,
        0.044,
      );
    }
    const outline = Array.from({ length: 12 }, (_, i) => [
      x + 0.075 * Math.cos((i * Math.PI) / 6),
      y + 0.075 * Math.sin((i * Math.PI) / 6),
    ]);
    plateStock(o, 'railRosette', outline, z + 0.008, 0.064);
  }
}
function entranceFasces(o, d) {
  for (let j = 0; j < 4; j++)
    for (const sign of [-1, 1]) {
      const q = facing(o, (j * Math.PI) / 2),
        x = sign * ironwork.gateHalfWidth,
        z = ironwork.gatePostZ;
      if (d === 2) {
        B(q, 'gateFasces', x, 0.55, z, 0.16, 1.58, 0.16, iron);
        lance(q, 'gateCrest', x, 2.25, z, 0.2, 0.3, 0.08);
        continue;
      }
      const levels = [
        [0.55, 0.13],
        [0.62, 0.13],
        [0.66, 0.1],
        [0.7, 0.1],
        [0.74, 0.082],
        [1.96, 0.082],
        [2.0, 0.11],
        [2.06, 0.11],
        [2.1, 0.075],
        [2.18, 0.075],
      ];
      loft(
        q,
        'gateFasces',
        levels.map(([y, r]) => radialRing(y, r, r, 8, [x, z])),
        iron,
      );
      for (const xx of [-0.095, -0.0475, 0, 0.0475, 0.095]) {
        B(q, 'gateFasces', x + xx, 0.72, z + 0.105, 0.028, 1.22, 0.035, iron);
        lance(q, 'gateCrest', x + xx, 2.12 + (xx === 0 ? 0.17 : 0), z + 0.105, 0.075, 0.28, 0.045);
      }
      for (const y of [0.8, 1.04, 1.76, 1.93])
        B(q, 'gateFasces', x, y, z + 0.11, 0.27, 0.035, 0.06, iron);
      for (const sign of [-1, 1]) {
        plateStock(
          q,
          'gateCrest',
          [
            [x, 2.14],
            [x + sign * 0.21, 2.12],
            [x + sign * 0.145, 2.25],
            [x + sign * 0.09, 2.2],
          ].sort((a, b) => Math.atan2(a[1] - 2.18, a[0] - x) - Math.atan2(b[1] - 2.18, b[0] - x)),
          z,
          0.045,
        );
      }
    }
}
function forgedEnclosure(o, d) {
  const k = ironwork,
    N = k.cells[d === 3 ? 'close' : 'street'],
    start = k.sectorStart,
    span = Math.PI / 2 - 2 * start;
  for (let sector = 0; sector < 4; sector++) {
    for (let j = 0; j < N; j++) {
      const a = (sector * Math.PI) / 2 + start + (span * j) / N,
        b = (sector * Math.PI) / 2 + start + (span * (j + 1)) / N,
        m = (a + b) / 2,
        w = 2 * k.radius * Math.sin((b - a) / 2),
        z = k.radius * Math.cos((b - a) / 2),
        q = facing(o, m),
        decor = d === 3 && (j < 2 || j >= N - 2);
      for (const y of [k.bottom, k.top])
        forgedBeam(q, 'railStock', [-w / 2, y, z], [w / 2, y, z], 0.04, 0.05, iron);
      if (decor) medallion(q, 0, k.middle, z, d);
      else {
        forgedBeam(
          q,
          'railStock',
          [-w / 2, k.bottom, z],
          [w / 2, k.top, z],
          k.barWidth,
          k.barDepth,
          iron,
        );
        forgedBeam(
          q,
          'railStock',
          [w / 2, k.bottom, z],
          [-w / 2, k.top, z],
          k.barWidth,
          k.barDepth,
          iron,
        );
        if (d === 3) B(q, 'railStock', 0, k.middle - 0.032, z + 0.004, 0.075, 0.064, 0.065, iron);
      }
      if (d === 3) {
        B(q, 'railStock', -w / 2, k.bottom, z, 0.027, k.top - k.bottom + 0.08, 0.042, iron);
        lance(q, 'railSpear', -w / 2, 2.035, z, 0.08, 0.25, 0.046);
      }
      if (j === N - 1 && d === 3) {
        B(q, 'railStock', w / 2, k.bottom, z, 0.027, k.top - k.bottom + 0.08, 0.042, iron);
        lance(q, 'railSpear', w / 2, 2.035, z, 0.08, 0.25, 0.046);
      }
    }
  }
  entranceFasces(o, d);
}

function enclosure(o, d) {
  if (d > 1) {
    forgedEnclosure(o, d);
    return;
  }
  if (d === 0) {
    for (let k = 0; k < 4; k++)
      for (let j = 0; j < 3; j++) {
        const a = (k * Math.PI) / 2 + 0.13 + ((Math.PI / 2 - 0.26) * j) / 3,
          b = (k * Math.PI) / 2 + 0.13 + ((Math.PI / 2 - 0.26) * (j + 1)) / 3;
        ribbon(
          o,
          'iron',
          [14.35 * Math.sin(a), 1.55, 14.35 * Math.cos(a)],
          [14.35 * Math.sin(b), 1.55, 14.35 * Math.cos(b)],
          0.08,
          iron,
        );
      }
    return;
  }
  const panels = d === 0 ? 16 : d === 1 ? 32 : d === 2 ? 64 : 96,
    R = 14.35;
  for (let i = 0; i < panels; i++) {
    const a = (i / panels) * Math.PI * 2,
      b = ((i + 1) / panels) * Math.PI * 2,
      m = (a + b) / 2,
      dist = Math.abs(Math.sin(m * 2));
    if (dist < 0.24) continue;
    const p = (y) => [R * Math.sin(a), y, R * Math.cos(a)],
      q = (y) => [R * Math.sin(b), y, R * Math.cos(b)];
    if (d === 0) {
      ribbon(o, 'iron', p(1.55), q(1.55), 0.08, iron);
      continue;
    }
    for (const y of [0.72, 1.68]) {
      if (d === 1) ribbon(o, 'iron', p(y), q(y), 0.045, iron);
      else beam(o, 'iron', p(y), q(y), 0.045, 0.045, iron);
    }
    if (d !== 1 || i % 2 === 0) beam(o, 'iron', p(0.59), p(1.82), 0.045, 0.045, iron);
    if (d > 1) {
      beam(o, 'iron', p(0.75), q(1.65), 0.035, 0.035, iron);
      beam(o, 'iron', q(0.75), p(1.65), 0.035, 0.035, iron);
      if (d > 2) {
        sphere(o, 'iron', p(1.84), [0.04, 0.11, 0.04], iron, 6, 3);
      }
    }
  }
  if (d > 0)
    for (let j = 0; j < 4; j++)
      for (const sign of [-1, 1]) {
        const q = facing(o, (j * Math.PI) / 2);
        B(q, 'iron', sign * 1.95, 0.55, 14.18, 0.22, 1.64, 0.22, iron);
        B(q, 'iron', sign * 1.95, 2.19, 14.18, 0.32, 0.1, 0.32, iron);
        if (d > 1)
          round(
            q,
            [
              [2.29, 0.1],
              [2.49, 0.025],
            ],
            d,
            { x: sign * 1.95, z: 14.18, n: 8, c: iron, slot: 'iron' },
          );
      }
}
function column(o, d) {
  round(
    o,
    [
      [7.95, 3.13],
      [8.14, 3.13],
      [8.24, 3.02],
      [8.45, 3.02],
      [8.68, 2.89],
    ],
    d,
  );
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 40 : 64,
    rows = d < 2 ? 2 : d === 2 ? 18 : 36;
  const radius = (t) => 2.89 - 0.38 * t + 0.045 * Math.sin(Math.PI * t);
  round(
    o,
    Array.from({ length: rows + 1 }, (_, j) => [8.68 + (34.52 * j) / rows, radius(j / rows)]),
    d,
    { n, cap: false },
  );
  if (d > 1) {
    const courses = d === 2 ? 22 : 43;
    for (let j = 1; j < courses; j++) {
      const y = 8.68 + (34.52 * j) / courses,
        r = radius(j / courses) + 0.006;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2,
          b = ((i + 1) / n) * Math.PI * 2;
        quad(
          o,
          'marble',
          [
            [r * Math.sin(a), y - 0.008, r * Math.cos(a)],
            [r * Math.sin(b), y - 0.008, r * Math.cos(b)],
            [r * Math.sin(b), y + 0.008, r * Math.cos(b)],
            [r * Math.sin(a), y + 0.008, r * Math.cos(a)],
          ],
          [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
          joint,
        );
      }
      if (d > 2)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8 + (j % 2) / 16) * Math.PI * 2,
            rr = radius((j + 0.5) / courses) + 0.008;
          ribbon(
            o,
            'marble',
            [rr * Math.sin(a), y + 0.016, rr * Math.cos(a)],
            [rr * Math.sin(a), y + 0.76, rr * Math.cos(a)],
            0.012,
            joint,
          );
        }
    }
  }
  round(
    o,
    d === 0
      ? [
          [43.2, 2.55],
          [43.45, 2.55],
          [45, 3.65],
        ]
      : [
          [43.2, 2.55],
          [43.36, 2.55],
          [43.45, 2.68],
          [43.55, 2.68],
          [43.66, 2.58],
          [43.86, 2.7],
          [44.3, 3.06],
          [44.72, 3.48],
          [45, 3.65],
        ],
    d,
    { n },
  );
  B(o, 'marble', 0, 45, 0, 7.6, 1.1, 7.6, light);
  // Lookout door recesses in the round support above the square abacus.
  const r = 2.66,
    bodyY = 46.1,
    bodyH = 1.85;
  if (d === 0)
    round(
      o,
      [
        [bodyY, r],
        [bodyY + bodyH, r],
      ],
      d,
      { n: 8 },
    );
  else {
    round(
      o,
      [
        [47.64, r],
        [47.95, r],
      ],
      d,
      { cap: false },
    );
    const steps = d === 1 ? 3 : d === 2 ? 6 : 10,
      gap = 0.15;
    for (let k = 0; k < 4; k++)
      for (let j = 0; j < steps; j++) {
        const a = (k * Math.PI) / 2 + gap + ((Math.PI / 2 - 2 * gap) * j) / steps,
          b = (k * Math.PI) / 2 + gap + ((Math.PI / 2 - 2 * gap) * (j + 1)) / steps;
        for (const [rad, reverse] of [
          [r, false],
          [2.2, true],
        ]) {
          const p = [
            [rad * Math.sin(a), bodyY, rad * Math.cos(a)],
            [rad * Math.sin(b), bodyY, rad * Math.cos(b)],
            [rad * Math.sin(b), 47.64, rad * Math.cos(b)],
            [rad * Math.sin(a), 47.64, rad * Math.cos(a)],
          ];
          const n = [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)];
          quad(o, 'marble', reverse ? [...p].reverse() : p, reverse ? n.map((v) => -v) : n, white);
        }
      }
    for (let i = 0; i < 4; i++) {
      const q = facing(o, (i * Math.PI) / 2);
      face(q, 'glass', 0, 46.13, 2.1, 0.7, 1.5, glass);
      for (const x of [-0.24, 0, 0.24]) B(q, 'iron', x, 46.12, 2.66, 0.035, 1.52, 0.035, iron);
      B(q, 'iron', 0, 46.9, 2.67, 0.7, 0.035, 0.035, iron);
    }
  }
  round(
    o,
    [
      [47.95, 2.73],
      [48.074, 2.73],
      [48.199, 2.5],
      [48.323, 2.5],
      [48.506, 2.22],
      [48.863, 1.85],
      [49.236, 1.44],
      [49.568, 1.02],
      [49.668, 0.87],
      [49.9, 0.87],
    ],
    d,
    { n },
  );
}
function sculptedLimb(o, a, b, r, d) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, [0, 0, 1])),
    v = cross(u, axis),
    n = d === 1 ? 6 : d === 2 ? 8 : 16;
  const ring = (t, r) =>
    Array.from({ length: n }, (_, i) => {
      const angle = (-i / n) * Math.PI * 2;
      return a.map(
        (x, k) => x + (b[k] - x) * t + (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)) * r,
      );
    });
  loft(o, 'marble', [ring(0, r * 0.85), ring(0.45, r), ring(1, r * 0.75)], light);
}
function statue(o, d) {
  const base = 49.9,
    n = d === 0 ? 6 : d === 1 ? 6 : d === 2 ? 10 : 24,
    l = d === 0 ? 3 : d === 1 ? 3 : d === 2 ? 5 : 10;
  const ell = (p, r, c = light) => sphere(o, 'marble', [p[0], base + p[1], p[2]], r, c, n, l);
  const rings = (levels) =>
    loft(
      o,
      'marble',
      levels.map(([y, rx, rz, x = 0, z = 0]) => radialRing(base + y, rx, rz, n, [x, z])),
      light,
    );
  if (d === 0) {
    rings([
      [0.08, 0.6, 0.35],
      [1.25, 0.7, 0.4],
      [2.4, 0.56, 0.37],
      [3.5, 0.62, 0.32],
      [3.72, 0.3, 0.24],
    ]);
    ell([0, 4.13, 0.02], [0.3, 0.38, 0.29]);
    beam(o, 'marble', [-0.5, base + 3.3, 0.1], [-0.72, base + 2.6, 0.65], 0.3, 0.3, light);
    return;
  }
  for (const sign of [-1, 1]) {
    const x = sign * 0.29;
    ell([x, 0.14, 0.32 + (sign > 0 ? 0.12 : 0)], [0.22, 0.14, 0.4]);
    rings([
      [0.18, 0.19, 0.22, x, 0.1],
      [0.75, 0.2, 0.24, x, 0.08],
      [1.5, 0.24, 0.27, x, 0.01],
      [2.1, 0.26, 0.28, x, 0],
    ]);
  }
  rings([
    [1.95, 0.47, 0.31],
    [2.4, 0.49, 0.34],
    [3.0, 0.59, 0.35],
    [3.48, 0.69, 0.31],
    [3.66, 0.38, 0.28],
  ]);
  rings([
    [3.65, 0.19, 0.18],
    [3.9, 0.18, 0.18],
  ]);
  ell([0, 4.13, 0.025], [0.285, 0.37, 0.275]);
  ell([0, 4.28, -0.13], [0.31, 0.24, 0.22], white);
  if (d > 2) ell([0, 4.11, -0.24], [0.26, 0.18, 0.13], white);
  // Right forearm presents the commission at the waist; left shoulder carries the cloak.
  for (const [a, b, r] of [
    [[-0.62, 3.44, 0.02], [-0.76, 2.95, 0.18], 0.22],
    [[-0.76, 2.95, 0.18], [-0.7, 2.64, 0.75], 0.17],
    [[0.61, 3.43, 0.02], [0.73, 2.9, 0.13], 0.23],
    [[0.73, 2.9, 0.13], [0.51, 2.57, 0.46], 0.18],
  ]) {
    sculptedLimb(o, [a[0], base + a[1], a[2]], [b[0], base + b[1], b[2]], r, d);
    ell(b, [r * 0.75, r * 0.75, r * 0.75]);
  }
  ell([-0.69, 2.63, 0.82], [0.16, 0.12, 0.23]);
  ell([0.5, 2.57, 0.48], [0.16, 0.14, 0.17]);
  // Open draped shell with soft folds, hiding one leg and wrapping the left shoulder.
  const angular = d === 1 ? 8 : d === 2 ? 18 : 32,
    rows = d === 1 ? 3 : d === 2 ? 5 : 9,
    point = (i, j) => {
      const a = -1.55 + (i / angular) * 4.25,
        t = j / rows,
        top = 3.62 - 0.67 * Math.max(0, a - 0.2),
        bottom = 0.15 + 1.0 * (0.5 + 0.5 * Math.cos(a * 1.5)),
        y = bottom + (top - bottom) * t,
        rx = 0.58 + 0.12 * Math.sin(t * Math.PI) + 0.1 * Math.sin(a * 9 + t * 1.2) * (1 - 0.3 * t),
        rz = 0.39 + 0.08 * Math.cos(a * 9 + t * 1.2) * (1 - 0.3 * t);
      return [0.1 + rx * Math.cos(a), base + y, -0.03 + rz * Math.sin(a)];
    };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < angular; i++) {
      const p = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const points = ids.map((k) => p[k]),
          norm = normalFor(...points);
        o.addTriangle(
          'marble',
          'palette:#ffffff',
          points,
          norm,
          points.map((p) => [p[0], p[1]]),
          white,
        );
        const reverse = [...points].reverse();
        o.addTriangle(
          'marble',
          'palette:#ffffff',
          reverse,
          norm.map((v) => -v),
          reverse.map((p) => [p[0], p[1]]),
          white,
        );
      }
    }
  if (d > 1) {
    // Uniform epaulettes, collar, coat buttons and restrained facial planes.
    for (const sign of [-1, 1]) {
      ell([sign * 0.59, 3.48, 0.09], [0.21, 0.11, 0.28], white);
      beam(
        o,
        'marble',
        [sign * 0.12, base + 3.77, 0.18],
        [sign * 0.36, base + 3.48, 0.32],
        0.1,
        0.08,
        white,
      );
      for (let k = 0; k < 4; k++)
        beam(
          o,
          'marble',
          [sign * (0.46 + k * 0.065), base + 3.48, 0.3],
          [sign * (0.47 + k * 0.065), base + 3.32, 0.32],
          0.025,
          0.025,
          light,
        );
    }
    for (const y of [2.7, 2.98, 3.25, 3.48])
      for (const x of [-0.17, 0.17]) ell([x, y, 0.352], [0.055, 0.055, 0.025], white);
    ell([0, 4.08, 0.293], [0.066, 0.13, 0.083], white);
    for (const sign of [-1, 1]) {
      ell([sign * 0.13, 4.19, 0.254], [0.075, 0.018, 0.018], white);
      ell([sign * 0.276, 4.11, 0.0], [0.05, 0.09, 0.055], white);
    }
    ell([0, 3.94, 0.26], [0.11, 0.025, 0.04], white);
    if (d > 2) {
      for (let i = 0; i < 11; i++) {
        const a = (i / 10) * Math.PI;
        ell(
          [Math.cos(a) * 0.23, 4.33 + Math.sin(a) * 0.1, -0.08 + Math.sin(a) * 0.08],
          [0.08, 0.07, 0.15],
          white,
        );
      }
      for (let i = 0; i < 6; i++) {
        const x = -0.5 + i * 0.19;
        beam(o, 'marble', [x, base + 2.4, 0.39], [x + 0.14, base + 2.75, 0.34], 0.025, 0.025, vein);
      }
    }
  }
}
export function washingtonMonumentBaltimore(o, _frame, d = 3) {
  gallery(o, d);
  enclosure(o, d);
  column(o, d);
  statue(o, d);
}
export function washingtonMonumentBaltimoreSkyline(o) {
  washingtonMonumentBaltimore(o, undefined, 0);
}
export function washingtonMonumentBaltimoreDistrict(o) {
  washingtonMonumentBaltimore(o, undefined, 1);
}
export function washingtonMonumentBaltimoreStreet(o) {
  washingtonMonumentBaltimore(o, undefined, 2);
}
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.8, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.75, metallic: 0.45 },
  railStock: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  railSpear: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  railMedallion: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  railRosette: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  gateFasces: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  gateCrest: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.18 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.12 },
};
export const washingtonMonumentBaltimoreModel = {
  id: 'washington_monument_baltimore',
  key: 'washington_monument_baltimore',
  recipe: 'structure-washington-monument-baltimore.mjs',
  cell: 'dq/dqc',
  title: 'Washington Monument (Baltimore)',
  brief:
    'Baltimore unfluted marble column on square gallery and stepped terrace, four circular skylights, Doric capital/square lookout and round bell pedestal, carved draped Washington figure with commission gesture, four door/stair approaches and own circular diamond iron enclosure. Separate park sculptures, fountains, lawns, roads and buildings excluded.',
  camera: [-47, 39, 65],
  lookAt: [0, 25, 0],
  qaCameras: [
    { name: 'front', position: [0, 29, 84], lookAt: [0, 26, 0] },
    { name: 'front-detail', position: [-10, 55, 17], lookAt: [0, 49, 0] },
    { name: 'back', position: [51, 30, -66], lookAt: [0, 23, 0] },
    { name: 'base-detail', position: [-23, 14, 30], lookAt: [0, 4, 0] },
    { name: 'ironwork-medallions', position: [-4.5, 2.2, 19.0], lookAt: [-3.15, 1.28, 14.0] },
    { name: 'ironwork-lattice', position: [11.5, 2.4, 16.4], lookAt: [8.8, 1.3, 11.4] },
  ],
  mediumFiContext: { scale: 0.85 },
  build: washingtonMonumentBaltimore,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry south approach[0,16.2] gives datum29.993m in preserved unmodified Terrarium. Mapped gallery ground is about+.27..+.41m; own circular enclosure edge lies+.04..+.24m. Own curb/paving top+.55m and foundations to-.8m meet the native grade without unsupported footings. Current portable ground/contact and north-up preview reviewed; generic-footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-washington-monument-baltimore.mjs',
    level: 'skyline',
    export: 'washingtonMonumentBaltimoreSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'washingtonMonumentBaltimoreDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'washingtonMonumentBaltimoreStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'Full fixed stone column/podium/statue silhouette/immediate railings retained. Current imagery is two exact Daderot own-photo PD-self originals after Qualla-first48paths. Actual immediate ironwork is rebuilt with diamond lattice, closed spear stocks, concentric open rosette medallions and bundled entrance piers. Earlier attribution/private/aerial controls are historical and excluded; broader whole-monument/roof/skylight/statue fidelity pending. Nominal54.46m height, roughly15m gallery and6m column diameter guide scale. Component heights, entasis, enclosure radius, carving/inscriptions and statue proportions remain estimates, not measured survey or conservation geometry.',
    'Washington is a draped stone silhouette with uniform/gesture/folds, not a portrait scan. Hidden folds/limbs and head details are conservative authored approximations. The foreground equestrian statue in the night photograph is a separate park monument and excluded. No photographic pixels redistributed.',
    'Only monument and immediate circular paved/iron enclosure and four approaches. Wider park monuments, fountains, landscaping, roads/buildings and temporary fixtures excluded. Current bounded independent Terrarium foundation/contact and signed placement reviewed as a preview. Coarse urban elevation and other host terrain compatibility remain limitations; footprint replacement disabled.',
  ],
};
