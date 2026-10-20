/** Surviving marble octagon, original slab roof and wind reliefs; ruined annex/porches. */
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

const tau = Math.PI * 2,
  ref = 'palette:#ffffff',
  r = 4.2463,
  apothem = r * Math.cos(Math.PI / 8),
  width = 2 * r * Math.sin(Math.PI / 8);
const marble = rgb('d6cdbb'),
  trim = rgb('ddd4c2'),
  relief = rgb('d0c4ad'),
  roof = rgb('c4bcaa'),
  tile = rgb('a99b86'),
  metal = rgb('a0aba4'),
  dark = rgb('4a504d');
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
function face(o, slot, x, y, z, w, h, c) {
  if (w > 1e-8 && h > 1e-8)
    quad(
      o,
      slot,
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
function oct(o, slot, r, y0, y1, c) {
  loft(
    o,
    slot,
    [radialRing(y0, r, r, 8, [0, 0], Math.PI / 8), radialRing(y1, r, r, 8, [0, 0], Math.PI / 8)],
    c,
  );
}
const courses = [
  0.9, 1.55, 2.25, 3.05, 3.85, 4.12, 4.45, 5.25, 6.15, 6.95, 7.24, 7.55, 8.4, 9.2, 9.65,
];
function walls(o, d) {
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      q = facing(o, a, apothem * Math.sin(a), apothem * Math.cos(a)),
      door = i === 1 || i === 7,
      vent = i === 0 || i === 2 || i === 6,
      holes = [
        ...(door ? [{ x: 0, y: 0.9, w: 1.33, h: 3.04, depth: 0.55 }] : []),
        ...(vent && d > 0 ? [{ x: 0, y: 8.53, w: 0.83, h: 0.43, depth: 0.42 }] : []),
      ];
    const panel = (x0, x1, y0, y1, c) =>
      face(q, 'marble', (x0 + x1) / 2, y0, 0, x1 - x0, y1 - y0, c);
    const ys = [
      ...new Set([
        0.9,
        9.65,
        ...(d === 0 ? [] : courses),
        ...holes.flatMap((h) => [h.y, h.y + h.h]),
      ]),
    ].sort((a, b) => a - b);
    for (let row = 0; row < ys.length - 1; row++) {
      const lo = ys[row],
        hi = ys[row + 1],
        omit = holes.filter((h) => (lo + hi) / 2 > h.y && (lo + hi) / 2 < h.y + h.h);
      let x = -width / 2;
      for (const h of omit) {
        panel(x, h.x - h.w / 2, lo, hi, marble);
        x = h.x + h.w / 2;
      }
      panel(x, width / 2, lo, hi, marble);
    }
    for (const h of holes) {
      for (const sign of [-1, 1])
        quad(
          q,
          'marble',
          [
            [h.x + (sign * h.w) / 2, h.y, 0],
            [h.x + (sign * h.w) / 2, h.y + h.h, 0],
            [h.x + (sign * h.w) / 2, h.y + h.h, -h.depth],
            [h.x + (sign * h.w) / 2, h.y, -h.depth],
          ],
          [-sign, 0, 0],
          trim,
        );
      for (const [y, up] of [
        [h.y, true],
        [h.y + h.h, false],
      ])
        quad(
          q,
          'marble',
          [
            [h.x - h.w / 2, y, 0],
            [h.x + h.w / 2, y, 0],
            [h.x + h.w / 2, y, -h.depth],
            [h.x - h.w / 2, y, -h.depth],
          ],
          [0, up ? 1 : -1, 0],
          trim,
        );
      face(q, 'metal', h.x, h.y, -h.depth, h.w, h.h, dark);
      if (d > 0) {
        if (h.h > 1) {
          for (const x of [-0.74, 0.74]) B(q, 'trim', x, 0.9, 0.055, 0.14, 3.19, 0.17, trim);
          B(q, 'trim', 0, 3.94, 0.06, 1.68, 0.22, 0.23, trim);
          B(q, 'trim', 0, 4.16, 0.045, 1.87, 0.13, 0.29, trim);
          for (const x of [-0.56, 0, 0.56]) B(q, 'metal', x, 1.03, -0.2, 0.035, 2.78, 0.045, metal);
          for (const y of [1.04, 2.88, 3.72]) B(q, 'metal', 0, y, -0.2, 1.17, 0.038, 0.045, metal);
          if (d > 1) {
            for (let j = 0; j < 11; j++)
              B(q, 'metal', -0.55 + j * 0.11, 1.06, -0.2, 0.018, 2.67, 0.025, metal);
            for (const y of [1.13, 2.96, 3.65])
              for (let j = 0; j < 8; j++) {
                const xx = -0.51 + j * 0.145;
                beam(
                  q,
                  'metal',
                  [xx - 0.055, y - 0.055, -0.18],
                  [xx + 0.055, y + 0.055, -0.18],
                  0.013,
                  0.018,
                  metal,
                );
                beam(
                  q,
                  'metal',
                  [xx - 0.055, y + 0.055, -0.18],
                  [xx + 0.055, y - 0.055, -0.18],
                  0.013,
                  0.018,
                  metal,
                );
              }
          }
        } else
          for (let j = 0; j < 5; j++)
            B(q, 'metal', -0.34 + j * 0.17, h.y, -0.13, 0.018, h.h, 0.024, metal);
      }
    }
    if (d > 0)
      for (let j = 1; j < courses.length - 1; j++) {
        const y = courses[j];
        if (holes.some((h) => y > h.y - 0.02 && y < h.y + h.h + 0.02)) continue;
        face(q, 'marble', 0, y - 0.008, 0.005, width, 0.016, rgb('c2b8a4'));
        if (d > 1) {
          const x = ((j % 3) - 1) * 0.42;
          face(q, 'marble', x, y + 0.04, 0.006, 0.012, courses[j + 1] - y - 0.08, rgb('c3b9a6'));
        }
      }
    if (d === 3 && (i === 2 || i === 6)) {
      const pts = [
        [-0.38, 6.22, 0.012],
        [0.38, 6.22, 0.012],
        [0.38, 7.04, 0.012],
        ...[1, 2, 3, 4, 5, 6].map((j) => {
          const a = (j * Math.PI) / 6;
          return [0.38 * Math.cos(a), 7.04 + 0.38 * Math.sin(a), 0.012];
        }),
      ];
      // Surviving infill surface: this is not a newly open doorway.
      q.addConvexPolygon('marble', ref, pts, [0, 0, 1], (p) => [p[0], p[1]], rgb('c5bdac'));
    }
    // Surviving porch attachment scars, not a reconstructed pediment.
    if (door && d > 0) {
      B(q, 'trim', -0.78, 4.35, -0.01, 0.32, 0.34, 0.14, marble);
      B(q, 'trim', 0.78, 4.35, -0.01, 0.32, 0.34, 0.14, marble);
      for (const sign of [-1, 1])
        beam(
          q,
          'marble',
          [sign * 0.88, 4.53, 0.025],
          [sign * 0.48, 4.79, 0.025],
          0.13,
          0.12,
          marble,
        );
    }
    if (d > 1 && i !== 0 && i !== 4) {
      for (let j = 0; j < 7; j++) {
        const x = -1.22 + j * 0.405;
        beam(
          q,
          'trim',
          [0, 8.38, 0.02],
          [x, 7.4 + Math.abs(x) * 0.15, 0.02],
          0.008,
          0.012,
          rgb('c3b9a7'),
        );
      }
      beam(q, 'metal', [0, 8.35, 0.04], [0, 8.39, 0.32], 0.016, 0.016, metal);
    }
  }
}
function limb(o, a, b, ra, rb, d, c = relief) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    n = d < 2 ? 4 : d === 2 ? 7 : 10,
    ring = (p, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (-i * tau) / n;
        return [
          p[0] + (dy / len) * r * Math.cos(t),
          p[1] - (dx / len) * r * Math.cos(t),
          p[2] + r * 0.55 * Math.sin(t),
        ];
      });
  loft(o, 'relief', [ring(a, ra), ring(b, rb)], c);
}
function plate(o, pts, depth, c = relief) {
  const area = pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const ring = area > 0 ? pts : [...pts].reverse();
  const front = ring.map(([x, y]) => [x, y, depth]);
  o.addConvexPolygon('relief', ref, front, [0, 0, 1], (p) => [p[0], p[1]], c);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const p = [
      [a[0], a[1], depth - 0.045],
      [b[0], b[1], depth - 0.045],
      [b[0], b[1], depth],
      [a[0], a[1], depth],
    ];
    quad(o, 'relief', p, normalFor(...p), c);
  }
}
function wind(o, d, i) {
  const a = (i * tau) / 8,
    q = facing(o, a, apothem * Math.sin(a), apothem * Math.cos(a)),
    y = 9.77,
    seg = d < 2 ? 4 : d === 2 ? 8 : 12,
    lat = d < 2 ? 3 : d === 2 ? 5 : 7;
  const ell = (center, radii) => sphere(q, 'relief', center, radii, relief, seg, lat);
  if (d === 0) {
    plate(
      q,
      [
        [-1.4, y + 1.1],
        [-0.6, y + 1.37],
        [0.4, y + 1.05],
        [-0.4, y + 0.86],
      ],
      0.07,
    );
    plate(
      q,
      [
        [-1.3, y + 0.14],
        [-0.6, y + 0.7],
        [0.8, y + 0.94],
        [1.05, y + 0.55],
        [0.1, y + 0.12],
      ],
      0.15,
    );
    sphere(q, 'relief', [0.88, y + 1.15, 0.14], [0.18, 0.2, 0.11], relief, 4, 3);
    return;
  }

  // Low relief: no detached full-depth statues. All fly to the viewer's right.
  plate(
    q,
    [
      [-1.48, y + 1.15],
      [-0.78, y + 1.42],
      [0.36, y + 1.22],
      [-0.1, y + 0.92],
      [-1.1, y + 0.96],
    ],
    0.065,
  );
  plate(
    q,
    [
      [-1.38, y + 1.08],
      [-1.1, y + 0.96],
      [-0.1, y + 0.92],
      [0.3, y + 0.68],
      [-0.65, y + 0.78],
    ],
    0.075,
  );
  ell([0.45, y + 0.74, 0.13], [0.4, 0.28, 0.13]);
  ell([0.88, y + 1.17, 0.14], [0.19, 0.22, 0.13]);
  limb(q, [0.66, y + 0.8, 0.14], [0.78, y + 1.02, 0.14], 0.12, 0.1, d);
  const wrapped = i === 0 || i === 1 || i === 5 || i === 7;
  const kneeY = i === 6 ? y + 0.38 : y + 0.62,
    leg = [
      [-0.05, y + 0.53, 0.13],
      [-0.62, kneeY, 0.14],
      [-1.2, y + 0.1, 0.13],
    ],
    other = [
      [-0.06, y + 0.45, 0.14],
      [-0.73, y + 0.24, 0.15],
      [-1.29, y + 0.22, 0.15],
    ];
  for (const points of [leg, other])
    for (let k = 0; k < 2; k++)
      limb(q, points[k], points[k + 1], k ? 0.09 : 0.13, k ? 0.065 : 0.1, d);
  ell([-1.24, y + 0.09, 0.14], [0.13, 0.065, 0.085]);
  ell([-1.31, y + 0.22, 0.15], [0.13, 0.065, 0.085]);
  plate(
    q,
    [
      [-0.38, y + 0.62],
      [0.2, y + 0.94],
      [0.7, y + 0.8],
      [0.58, y + 0.23],
      [0.14, y + 0.02],
      [-0.33, y + 0.2],
    ],
    0.21,
  );
  if (wrapped)
    plate(
      q,
      [
        [0.1, y + 1.07],
        [0.64, y + 1.17],
        [1.1, y + 0.86],
        [0.9, y + 0.42],
        [0.32, y + 0.33],
      ],
      0.25,
    );
  const hands =
    i === 0
      ? [
          [0.86, y + 0.83, 0.21],
          [1.3, y + 1.02, 0.2],
        ]
      : i === 7
        ? [
            [0.93, y + 0.39, 0.32],
            [1.22, y + 0.59, 0.31],
          ]
        : [
            [0.63, y + 0.35, 0.22],
            [1.14, y + 0.48, 0.21],
          ];
  limb(q, [0.62, y + 0.84, 0.17], [0.44, y + 0.53, 0.25], 0.12, 0.1, d);
  limb(q, [0.44, y + 0.53, 0.25], hands[0], 0.1, 0.065, d);
  limb(q, [0.75, y + 0.79, 0.18], [1.02, y + 0.65, 0.2], 0.115, 0.085, d);
  limb(q, [1.02, y + 0.65, 0.2], hands[1], 0.085, 0.06, d);
  for (const p of hands) ell(p, [0.08, 0.065, 0.07]);
  // Direction-specific surviving attributes, simplified from inspected originals.
  if (i === 0) {
    limb(q, [1.05, y + 1.05, 0.19], [1.43, y + 1.02, 0.21], 0.12, 0.055, d);
    ell([1.43, y + 1.02, 0.21], [0.09, 0.08, 0.055]);
  } else if (i === 7) {
    sphere(
      q,
      'relief',
      [1.03, y + 0.55, 0.28],
      [0.4, 0.39, 0.065],
      relief,
      d < 2 ? 6 : 12,
      d < 2 ? 3 : 6,
    );
    if (d > 1)
      for (let j = 0; j < 12; j++) {
        const a = (j * tau) / 12,
          b = ((j + 1) * tau) / 12;
        beam(
          q,
          'relief',
          [1.03 + 0.34 * Math.cos(a), y + 0.55 + 0.34 * Math.sin(a), 0.35],
          [1.03 + 0.34 * Math.cos(b), y + 0.55 + 0.34 * Math.sin(b), 0.35],
          0.025,
          0.025,
          relief,
        );
      }
  } else if (i === 1 || i === 4) {
    loft(
      q,
      'relief',
      [
        [0, 0.21],
        [0.1, 0.32],
        [0.34, 0.34],
        [0.41, 0.24],
      ].map(([yy, rr]) => radialRing(y + 0.07 + yy, rr, rr * 0.5, d < 2 ? 6 : 12, [1.0, 0.25])),
      relief,
    );
    if (d > 1) ell([1, y + 0.13, 0.43], [0.12, 0.06, 0.025]);
  } else if (i === 2 || i === 6) {
    plate(
      q,
      [
        [0.4, y + 0.31],
        [1.39, y + 0.71],
        [1.22, y + 0.2],
        [0.73, y + 0.1],
      ],
      0.3,
    );
    if (d > 1)
      for (let j = 0; j < 7; j++)
        ell(
          [0.66 + (j % 4) * 0.13, y + 0.3 + Math.floor(j / 4) * 0.13, 0.34],
          [0.065, 0.065, 0.045],
        );
  } else if (i === 3) {
    limb(q, [0.94, y + 0.42, 0.25], [1.45, y + 0.37, 0.25], 0.07, 0.12, d);
  }
  if (d > 1) {
    ell([1.02, y + 1.18, 0.235], [0.075, 0.06, 0.05]);
    for (let j = 0; j < (d === 2 ? 4 : 5); j++)
      limb(
        q,
        [-1.31 + j * 0.08, y + 1.09 + j * 0.055, 0.082],
        [-0.25 + j * 0.1, y + 1.05 + j * 0.025, 0.09],
        0.012,
        0.012,
        d,
        trim,
      );
    for (let j = 0; j < (d === 2 ? 3 : 6); j++) {
      const x = -0.27 + j * 0.135;
      limb(q, [x, y + 0.22, 0.225], [x + 0.34, y + 0.67, 0.235], 0.015, 0.015, d, trim);
    }
    if (wrapped)
      for (let j = 0; j < 4; j++)
        limb(
          q,
          [0.37 + j * 0.13, y + 0.42, 0.27],
          [0.59 + j * 0.12, y + 0.91, 0.27],
          0.014,
          0.014,
          d,
          trim,
        );
  }
}
function annex(o, d) {
  const n = d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 18 : 28,
    r0 = 1.27,
    r1 = 1.75,
    center = -apothem;
  const p = (r, a, y) => [r * Math.sin(a), y, center + r * Math.cos(a)],
    height = (i) =>
      2.45 +
      0.08 * Math.cos(i * 0.23) -
      (i > n * 0.38 && i < n * 0.53 ? 0.15 : 0) +
      (i < 2 || i > n - 2 ? 0.7 : 0);
  for (let i = 0; i < n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n,
      b = Math.PI / 2 + (Math.PI * (i + 1)) / n,
      hi = height(i),
      hh = height(i + 1);
    for (const [rr, reverse] of [
      [r1, false],
      [r0, true],
    ]) {
      const ps = [p(rr, a, -0.45), p(rr, b, -0.45), p(rr, b, hh), p(rr, a, hi)];
      const q = reverse ? [...ps].reverse() : ps;
      quad(o, 'marble', q, normalFor(...q), marble);
    }
    const ps = [p(r0, a, hi), p(r1, a, hi), p(r1, b, hh), p(r0, b, hh)];
    quad(o, 'marble', ps, normalFor(...ps), trim);
  }
  if (d > 0)
    for (const sign of [-1, 1])
      B(o, 'marble', sign * 1.63, 2.2, center + 0.03, 0.27, 1.9, 0.28, marble);
}
function porch(o, d, sign) {
  const a = (sign * Math.PI) / 4,
    q = facing(o, a, apothem * Math.sin(a), apothem * Math.cos(a));
  for (let k = 0; k < 3; k++)
    B(q, 'marble', 0, -0.45 + k * 0.45, 0.95, 2.6 - k * 0.18, 0.45, 2.4 - k * 0.16, marble);
  const columns = sign === 1 ? [-0.91, 0.91] : [-0.91];
  for (const x of columns) {
    const h = sign === 1 ? 1.95 : 1.65,
      n = d < 2 ? 8 : 20,
      ring = (y, rr) => radialRing(y, rr, rr, n, [x, 1.65]);
    loft(q, 'marble', [ring(0.9, 0.23), ring(0.9 + h, 0.21)], marble);
    if (d > 1) {
      for (let j = 0; j < 20; j++) {
        const t = (j * tau) / 20,
          xx = x + 0.23 * Math.sin(t),
          zz = 1.65 + 0.23 * Math.cos(t);
        beam(
          q,
          'trim',
          [xx, 0.95, zz],
          [x + 0.21 * Math.sin(t), 0.9 + h - 0.08, 1.65 + 0.21 * Math.cos(t)],
          0.013,
          0.016,
          trim,
        );
      }
      B(q, 'marble', x - 0.04, 0.9 + h - 0.02, 1.65, 0.25, 0.09, 0.31, marble);
    }
  }
}

const roofCornice = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/sw/swb/tower_of_the_winds/roof-cornice-construction-controls.json',
      import.meta.url,
    ),
  ),
);
function metricTri(o, slot, p, c) {
  const n = normalFor(...p),
    drop = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
    axes = [0, 1, 2].filter((i) => i !== drop);
  o.addTriangle(
    slot,
    ref,
    p,
    n,
    p.map((p) => [p[axes[0]], p[axes[1]]]),
    c,
  );
}
function metricQuad(o, slot, p, c) {
  for (const ids of [
    [0, 1, 2],
    [0, 2, 3],
  ])
    metricTri(
      o,
      slot,
      ids.map((i) => p[i]),
      c,
    );
}
function stockLoft(o, slot, rings, c, cap = true) {
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      metricQuad(o, slot, [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], c);
    }
  if (cap)
    for (const [r, rev] of [
      [rings[0], true],
      [rings.at(-1), false],
    ]) {
      const p = rev ? [...r].reverse() : r;
      for (let i = 1; i < p.length - 1; i++) metricTri(o, slot, [p[0], p[i], p[i + 1]], c);
    }
}
function profiledRoofCovers(o) {
  const c = roofCornice.roof,
    n = c.profileSegments;
  for (let i = 0; i < c.ribs; i++) {
    const side = Math.floor(i / 3),
      t = (i % 3) / 3,
      a = (side * tau) / 8 - Math.PI / 8,
      b = ((side + 1) * tau) / 8 - Math.PI / 8,
      A = [
        (1 - t) * c.outerRadius * Math.sin(a) + t * c.outerRadius * Math.sin(b),
        c.outerY,
        (1 - t) * c.outerRadius * Math.cos(a) + t * c.outerRadius * Math.cos(b),
      ],
      B = [A[0] * c.innerRatio, c.innerY, A[2] * c.innerRatio],
      axis = normalize(B.map((v, k) => v - A[k])),
      u = normalize([axis[2], 0, -axis[0]]),
      v = cross(axis, u),
      length = Math.hypot(...B.map((v, k) => v - A[k])),
      arc = (w, h) =>
        Array.from({ length: n + 1 }, (_, j) => [
          w * Math.cos((Math.PI * j) / n),
          h * Math.sin((Math.PI * j) / n),
        ]),
      profile = [...arc(c.halfWidth, c.height), ...arc(c.innerHalfWidth, c.innerHeight).reverse()],
      sections = i % 3 === 0 ? c.hipSections : c.sections;
    for (let j = 0; j < sections; j++) {
      const lo = (j * length) / sections + (j ? c.jointGap / 2 : 0),
        hi = ((j + 1) * length) / sections - (j < sections - 1 ? c.jointGap / 2 : 0),
        stations = [
          [lo, c.startScale],
          [lo + c.bevelLength, c.bevelScale],
          [hi, c.bodyScale],
        ],
        rings = stations.map(([s, f]) =>
          profile.map(([x, y]) =>
            A.map((n, k) => n + axis[k] * s + u[k] * x * f + v[k] * (c.baseNormalOffset + y * f)),
          ),
        );
      stockLoft(o, 'roofCover', rings, tile, false);
      // Each end is a returned U-shaped tile edge; its arch counter remains real air.
      for (const [r, reverse] of [
        [rings[0], true],
        [rings.at(-1), false],
      ])
        for (let k = 0; k < n; k++) {
          const p = [r[k], r[k + 1], r[2 * n - k], r[2 * n + 1 - k]];
          metricQuad(o, 'roofCover', reverse ? [...p].reverse() : p, tile);
        }
    }
  }
}
function carvedSpouts(o) {
  const c = roofCornice.spouts,
    n = c.segments;
  for (let face = 0; face < c.faces; face++) {
    const a = (face * tau) / 8,
      q = facing(o, a, c.anchorRadius * Math.sin(a), c.anchorRadius * Math.cos(a));
    for (const x of c.offsets) {
      const outer = c.outerProfile.map(([z, rx, ry], j) =>
          Array.from({ length: n }, (_, k) => {
            const a = (k * tau) / n,
              f = j < 3 ? 1 + (k % 2 ? -0.5 : 1) * c.maneAlternation : 1;
            return [x + rx * Math.cos(a) * f, c.centerY + ry * Math.sin(a) * f, z];
          }),
        ),
        mouth = (z) =>
          Array.from({ length: n }, (_, k) => {
            const a = (k * tau) / n;
            return [
              x + c.mouth.rx * Math.cos(a),
              c.centerY + c.mouth.centerY + c.mouth.ry * Math.sin(a),
              z,
            ];
          }),
        front = mouth(c.mouth.front),
        back = mouth(c.mouth.back);
      stockLoft(q, 'lionMask', outer, trim, false);
      for (let k = 0; k < n; k++) {
        const t = (k + 1) % n;
        metricQuad(q, 'lionMask', [front[k], outer.at(-1)[k], outer.at(-1)[t], front[t]], trim);
        metricQuad(q, 'lionMask', [outer[0][k], back[k], back[t], outer[0][t]], trim);
      }
      stockLoft(q, 'lionMask', [front, back], trim, false);
      const metric = {
        addTriangle: (slot, _ref, p, _n, _uv, c) => metricTri(q, slot, p, c),
        addQuad: (slot, _ref, p, _n, _uv, c) => metricQuad(q, slot, p, c),
      };
      for (const sign of [-1, 1]) {
        sphere(
          metric,
          'lionCarving',
          [x + sign * 0.062, c.centerY - 0.009, 0.13],
          [0.043, 0.031, 0.03],
          trim,
          8,
          4,
        );
        sphere(
          metric,
          'lionCarving',
          [x + sign * 0.105, c.centerY + 0.092, 0.065],
          [0.033, 0.04, 0.032],
          trim,
          8,
          4,
        );
        B(q, 'lionCarving', x + sign * 0.05, c.centerY + 0.046, 0.13, 0.07, 0.02, 0.04, trim);
      }
      B(q, 'lionCarving', x, c.centerY + 0.012, 0.155, 0.038, 0.067, 0.038, trim);
    }
  }
}
function profiledCornice(o) {
  const c = roofCornice.cornice;
  stockLoft(
    o,
    'corniceProfile',
    c.profile.map(([y, r]) => radialRing(y, r, r, c.sides, [0, 0], c.angleOffset)),
    trim,
  );
}

function top(o, d) {
  oct(o, 'trim', 4.29, 9.58, 9.72, trim);
  oct(o, 'marble', 4.2463, 9.72, 11.24, marble);
  if (d !== 3)
    for (const [rr, y, h] of [
      [4.28, 11.24, 0.12],
      [4.4, 11.36, 0.14],
      [4.49, 11.5, 0.16],
    ])
      oct(o, 'trim', rr, y, y + h, trim);
  const outer = Array.from({ length: 24 }, (_, i) => {
      const side = Math.floor(i / 3),
        t = (i % 3) / 3,
        a = (side * tau) / 8 - Math.PI / 8,
        b = ((side + 1) * tau) / 8 - Math.PI / 8;
      return [
        (1 - t) * 4.49 * Math.sin(a) + t * 4.49 * Math.sin(b),
        11.66,
        (1 - t) * 4.49 * Math.cos(a) + t * 4.49 * Math.cos(b),
      ];
    }),
    inner = outer.map((p) => [p[0] * 0.055, 12.76, p[2] * 0.055]);
  loft(o, 'roof', [outer, inner], roof, { cap: false });
  for (let i = 0; i < 24; i++) {
    if (d === 3 || d === 0 || (d === 1 && i % 3 !== 0)) continue;
    beam(
      o,
      'tile',
      outer[i].map((v, k) => v + (k === 1 ? 0.026 : 0)),
      inner[i].map((v, k) => v + (k === 1 ? 0.026 : 0)),
      0.075,
      0.055,
      tile,
    );
  }
  oct(o, 'trim', 0.31, 12.75, 12.93, trim);
  oct(o, 'marble', 0.24, 12.93, 13.16, marble);
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        q = facing(o, a, 0.24 * Math.sin(a), 0.24 * Math.cos(a));
      plate(
        q,
        [
          [-0.07, 12.98],
          [0, 13.18],
          [0.07, 13.0],
        ],
        0.02,
        trim,
      );
    }
    if (d !== 3)
      for (let i = 0; i < 8; i++) {
        const a = (i * tau) / 8,
          q = facing(o, a, 4.2 * Math.sin(a), 4.2 * Math.cos(a));
        for (const x of [-1.05, 0, 1.05]) {
          sphere(q, 'trim', [x, 11.52, 0.03], [0.11, 0.1, 0.08], trim, 8, 4);
          sphere(q, 'trim', [x, 11.49, 0.095], [0.045, 0.03, 0.015], rgb('c5bba7'), 6, 3);
        }
      }
  }
}
export function towerOfTheWinds(o, _frame, d = 3) {
  for (let k = 0; k < 3; k++)
    oct(o, 'marble', r + 0.48 - k * 0.17, -0.45 + k * 0.45, k * 0.45, marble);
  walls(o, d);
  top(o, d);
  if (d === 3) {
    profiledRoofCovers(o);
    profiledCornice(o);
    carvedSpouts(o);
  }
  for (let i = 0; i < 8; i++) wind(o, d, i);
  for (const sign of [-1, 1]) porch(o, d, sign);
  annex(o, d);
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        q = facing(o, a, apothem * Math.sin(a), apothem * Math.cos(a));
      B(q, 'trim', 0, 0.82, 0.035, width, 0.1, 0.12, trim);
    }
}
export function towerOfTheWindsSkyline(o) {
  towerOfTheWinds(o, undefined, 0);
}
export function towerOfTheWindsDistrict(o) {
  towerOfTheWinds(o, undefined, 1);
}
export function towerOfTheWindsStreet(o) {
  towerOfTheWinds(o, undefined, 2);
}
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.88, metallic: 0 },
  relief: { slot: 'trim', graph: 'stone_marble', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_marble', roughness: 0.94, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  roofCover: { slot: 'roof', graph: 'clay_fired', roughness: 0.9, metallic: 0 },
  corniceProfile: { slot: 'trim', graph: 'stone_marble', roughness: 0.88, metallic: 0 },
  lionMask: { slot: 'trim', graph: 'stone_marble', roughness: 0.88, metallic: 0 },
  lionCarving: { slot: 'trim', graph: 'stone_marble', roughness: 0.88, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.15 },
};
export const towerOfTheWindsModel = {
  id: 'tower_of_the_winds',
  key: 'tower_of_the_winds',
  recipe: 'structure-tower-of-the-winds.mjs',
  cell: 'sw/swb',
  title: 'Tower of the Winds',
  brief:
    'Surviving octagonal Pentelic marble tower with variable stone courses, two deep north doorways with metal grilles, eight shallow rightward-flying winged wind reliefs and simplified attributes, sundial lines, projecting cornice/lion spouts,24-slab low pyramidal roof with radial joint covers and broken capital, three stepped base courses, ruined porch platforms/three column stumps and open broken southern reservoir annex. Missing porch roofs/full columns/Triton vane not restored.',
  camera: [-16, 12, 22],
  lookAt: [0, 6.6, 0],
  qaCameras: [
    { name: 'front', position: [0, 9, 32], lookAt: [0, 6.6, 0] },
    { name: 'front-detail', position: [-7, 11.5, 12], lookAt: [0, 10.4, 0] },
    { name: 'back', position: [17, 10, -23], lookAt: [0, 5.5, 0] },
    { name: 'base-detail', position: [-9, 4, 10], lookAt: [-2.7, 2.1, 2.7] },
    { name: 'annex-detail', position: [-7, 6, -10], lookAt: [0, 1.8, -4.8] },
    { name: 'profiled-roof-covers', position: [-8, 17, 10], lookAt: [0, 12.05, 0] },
    { name: 'lion-spouts', position: [-1.05, 11.8, 6.2], lookAt: [-1.05, 11.52, 4.18] },
  ],
  mediumFiContext: { scale: 1.25 },
  build: towerOfTheWinds,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent native Terrarium datum72.8751m at dry north site floor[0,5.9]; mapped footprint-.172..+.974m. Three own steps rise to.9m and door threshold.9m. North approaches/doors clear independent ground; western/southern grade meets lower steps and broken annex. Current source contact reviewed as bounded preview, without reconstructing wider excavation. Ground unchanged; coarse urban ground and other host compatibility remain limitations. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tower-of-the-winds.mjs',
    level: 'skyline',
    export: 'towerOfTheWindsSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'towerOfTheWindsDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'towerOfTheWindsStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'Current surviving exterior uses exact named photographer Ownwork/self-CC0 natives after Qualla-first41paths. Earlier attribution/private/aerial image controls are historical and excluded. Built physically curved/segmented ochre roof joint covers, closed stepped cornice and lion-mask spouts with real recessed mouths. Full fixed octagonal tower/eight wind reliefs/porches/ruined annex retained. Main sideabout3.25m and almost9m wall guide scale; top13.16m including broken capital is an authored elevation estimate. Exact courses, roof/cornice profiles, wind sculpture contours/poses/depth, threshold and damage remain estimates, not scans.',
    'Two ruined porch platforms/three column stumps and broken open southern annex retained; full porch columns/pediments, complete reservoir and bronze Triton not restored. Eight low-relief wind figures keep winged flying poses and coarse attributes; two less-documented poses and fine face/cloth details are conservative original interpretations. No source photographic pixels embedded or redistributed. Interior water-clock mechanism, detached fragments, interpretation furniture and surrounding ruins/stairs/walls excluded.',
    'Independent terrain retained unchanged. Archaeological ground may not be resolved by coarse urban DEM; north steps/doors and southern annex contact reviewed as a bounded preview, footprint replacement disabled.',
  ],
};
