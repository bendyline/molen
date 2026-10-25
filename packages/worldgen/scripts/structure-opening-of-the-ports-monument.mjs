/** Manaus: complete original bronze allegories on the native eleven-control stepped base. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/6x/6xm/monument_abertura_dos_portos/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  F = p.parameters.floorY,
  ref = 'palette:#ffffff',
  C = {
    granite: rgb('96948a'),
    marble: rgb('d5cfb7'),
    sienna: rgb('bdad78'),
    bronze: rgb('454c40'),
    recess: rgb('77796a'),
  },
  surfaces = {
    granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
    marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.9, metallic: 0 },
    sienna: { slot: 'trim', graph: 'stone_marble', roughness: 0.9, metallic: 0 },
    bronze: { slot: 'trim', localRef: ref, roughness: 0.82, metallic: 0.55 },
    recess: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.96, metallic: 0 },
  };
const nseg = (d) => [3, 4, 10, 24][d];
function T(o, s, q, n) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    C[s],
  );
}
function Q(o, s, q, n) {
  T(o, s, q.slice(0, 3), n);
  T(o, s, [q[0], q[2], q[3]], n);
}
function cap(o, s, r, n = [0, 1, 0]) {
  const ax = Math.abs(n[1]) > 0.5 ? [0, 2] : Math.abs(n[2]) > 0.5 ? [0, 1] : [2, 1],
    ix = earcut(r.flatMap((v) => ax.map((k) => v[k])));
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => r[k]),
      n,
    );
}
function skin(o, s, rings, closed = true) {
  for (let j = 1; j < rings.length; j++) {
    const r = rings[j - 1],
      t = rings[j],
      mid = [0, 1, 2].map((k) => r.concat(t).reduce((a, v) => a + v[k], 0) / (2 * r.length));
    for (let i = 0; i < r.length; i++) {
      const k = (i + 1) % r.length,
        nn = r[i].map((v, a) => (v + r[k][a] + t[k][a] + t[i][a]) / 4 - mid[a]);
      Q(o, s, [r[i], r[k], t[k], t[i]], nn);
    }
  }
  if (closed) {
    cap(o, s, rings[0], [0, -1, 0]);
    cap(o, s, rings.at(-1));
  }
}
const square = (w, y) => [
  [-w / 2, y, -w / 2],
  [w / 2, y, -w / 2],
  [w / 2, y, w / 2],
  [-w / 2, y, w / 2],
];
function tiers(o, s, ls) {
  skin(
    o,
    s,
    ls.map(([y, w]) => square(w, F + y)),
  );
}
function base(o, d) {
  const outline = p.outline.slice(0, -1),
    scales = [1, 0.91, 0.82, 0.73];
  for (let i = 0; i < 4; i++)
    skin(
      o,
      'marble',
      [i * 0.22, (i + 1) * 0.22].map((y) =>
        outline.map(([x, z]) => [x * scales[i], F + y, z * scales[i]]),
      ),
    );
  tiers(
    o,
    'granite',
    d
      ? [
          [0.88, 4.8],
          [1.05, 4.8],
          [1.2, 4.45],
          [3.35, 4.1],
          [3.55, 4.45],
        ]
      : [
          [0.88, 4.8],
          [3.55, 4.45],
        ],
  );
  tiers(
    o,
    'sienna',
    d
      ? [
          [3.55, 4.5],
          [3.68, 4.75],
          [3.88, 4.9],
          [4.05, 4.75],
        ]
      : [
          [3.55, 4.9],
          [4.05, 4.75],
        ],
  );
  // Eight column shafts are separate from the central square core and remain visible in every level.
  central(o, d);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (const [x, z] of [
        [sx * 1.37, sz * 1.7],
        [sx * 1.7, sz * 1.37],
      ]) {
        const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 12 : 18;
        const ls = d
          ? [
              [4.05, 0.24],
              [4.18, 0.24],
              [4.28, 0.17],
              [6.58, 0.15],
              [6.69, 0.24],
              [6.88, 0.26],
            ]
          : [
              [4.05, 0.2],
              [6.88, 0.2],
            ];
        skin(
          o,
          'marble',
          ls.map(([y, r]) =>
            Array.from({ length: n }, (_, i) => [
              x + r * Math.sin((i * 2 * Math.PI) / n),
              F + y,
              z + r * Math.cos((i * 2 * Math.PI) / n),
            ]),
          ),
        );
        if (d > 1)
          for (const side of [-1, 1])
            tube(
              o,
              'marble',
              Array.from({ length: d === 3 ? 17 : 9 }, (_, i) => {
                const a = (i * 2 * Math.PI) / (d === 3 ? 16 : 8),
                  r = 0.09 * (1 - i / (d === 3 ? 19 : 10));
                return [x + side * 0.19 + r * Math.cos(a), F + 6.74 + r * Math.sin(a), z + 0.15];
              }),
              0.025,
              d === 3 ? 5 : 4,
            );
      }
  tiers(
    o,
    'sienna',
    d
      ? [
          [6.88, 3.8],
          [7.03, 3.8],
          [7.12, 4.25],
          [7.3, 4.25],
          [7.6, 3.7],
        ]
      : [
          [6.88, 4.25],
          [7.6, 3.7],
        ],
  );
  tiers(o, 'granite', [
    [7.6, 2.3],
    [7.83, 2.1],
    [8.1, 1.65],
  ]);
}
function face(a) {
  const n = [Math.sin(a), 0, Math.cos(a)],
    u = [Math.cos(a), 0, -Math.sin(a)];
  return { n, P: (x, y, z) => [u[0] * x + n[0] * z, F + y, u[2] * x + n[2] * z] };
}
function panel(o, s, r, f, z, holes = []) {
  const all = [r, ...holes].flat(),
    ix = earcut(
      all.flat(),
      holes.map((_, i) => r.length + holes.slice(0, i).reduce((a, v) => a + v.length, 0)),
    );
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(...all[k], z)),
      f.n,
    );
}
const rect = (w, y0, y1) => [
  [-w / 2, y0],
  [w / 2, y0],
  [w / 2, y1],
  [-w / 2, y1],
];
function relief(o, r, f, z, depth) {
  panel(o, 'bronze', r, f, z);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, 'bronze', [f.P(...a, z), f.P(...b, z), f.P(...b, z - depth), f.P(...a, z - depth)]);
  }
}
function central(o, d) {
  for (let k = 0; k < 4; k++) {
    const f = face((k * Math.PI) / 2),
      hole = rect(1.85, 4.4, 6.55);
    panel(o, 'granite', rect(2.95, 4.05, 6.88), f, 1.475, d ? [hole] : []);
    if (d) {
      for (let i = 0; i < 4; i++) {
        const a = hole[i],
          b = hole[(i + 1) % 4];
        Q(o, 'marble', [f.P(...a, 1.475), f.P(...b, 1.475), f.P(...b, 1.385), f.P(...a, 1.385)]);
      }
      panel(o, 'recess', hole, f, 1.385);
    }
    if (d > 0) {
      const shield = [
        [-0.5, 6.2],
        [0.5, 6.2],
        [0.46, 5.7],
        [0.3, 5.4],
        [0, 5.23],
        [-0.3, 5.4],
        [-0.46, 5.7],
      ];
      relief(o, shield, f, 1.5, 0.09);
      const wreath = Array.from({ length: d === 3 ? 25 : 13 }, (_, i) => {
        const a = (i * Math.PI) / (d === 3 ? 24 : 12);
        return f.P(0.69 * Math.cos(a), 6.36 - 0.92 * Math.sin(a), 1.53);
      });
      tube(o, 'bronze', wreath, 0.045, d === 3 ? 6 : 4);
      // Shallow original cartouche on the lower body; lettering is intentionally omitted.
      relief(
        o,
        [
          [-0.45, 2.9],
          [0.45, 2.9],
          [0.42, 2.35],
          [0, 2.13],
          [-0.42, 2.35],
        ],
        f,
        2.2,
        0.06,
      );
    }
  }
  cap(o, 'granite', square(2.95, F + 4.05), [0, -1, 0]);
  cap(o, 'granite', square(2.95, F + 6.88));
}
function tube(o, s, pts, r, n = 6) {
  const rings = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      v = normalize(b.map((x, k) => x - a[k])),
      u = normalize(cross(v, Math.abs(v[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0])),
      w = cross(v, u),
      rr = Array.isArray(r) ? r[i] : r;
    return Array.from({ length: n }, (_, j) =>
      p.map(
        (x, k) =>
          x +
          rr * (u[k] * Math.cos((j * 2 * Math.PI) / n) + w[k] * Math.sin((j * 2 * Math.PI) / n)),
      ),
    );
  });
  // Axis-aware normals/caps keep curved anatomy and attributes consistently outward.
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n,
        mid = pts[i].map((v, a) => (v + pts[i - 1][a]) / 2),
        nn = rings[i][j].map((v, a) => v - mid[a]);
      Q(o, s, [rings[i - 1][j], rings[i - 1][k], rings[i][k], rings[i][j]], nn);
    }
  const fan = (r, center, nn) => {
    for (let i = 0; i < n; i++) T(o, s, [center, r[i], r[(i + 1) % n]], nn);
  };
  fan(
    rings[0],
    pts[0],
    pts[0].map((v, k) => v - pts[1][k]),
  );
  fan(
    rings.at(-1),
    pts.at(-1),
    pts.at(-1).map((v, k) => v - pts.at(-2)[k]),
  );
}
function ellipsoid(o, c, r, d, transform = (x) => x, s = 'bronze') {
  const n = nseg(d),
    m = [2, 4, 8, 12][d],
    rings = [];
  for (let j = 1; j < m; j++) {
    const a = (j * Math.PI) / m;
    rings.push(
      Array.from({ length: n }, (_, i) =>
        transform([
          c[0] + r[0] * Math.sin(a) * Math.sin((i * 2 * Math.PI) / n),
          c[1] + r[1] * Math.cos(a),
          c[2] + r[2] * Math.sin(a) * Math.cos((i * 2 * Math.PI) / n),
        ]),
      ),
    );
  }
  const top = transform([c[0], c[1] + r[1], c[2]]),
    bottom = transform([c[0], c[1] - r[1], c[2]]),
    center = transform(c);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    T(
      o,
      s,
      [top, rings[0][i], rings[0][k]],
      rings[0][i].map((v, a) => v - center[a]),
    );
    T(
      o,
      s,
      [bottom, rings.at(-1)[k], rings.at(-1)[i]],
      rings.at(-1)[i].map((v, a) => v - center[a]),
    );
  }
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(
        o,
        s,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        rings[j][i].map((v, a) => v - center[a]),
      );
    }
}
function carvedHead(o, P, c, size, d, helmet = false) {
  if (d === 0) {
    ellipsoid(o, c, [0.16 * size, 0.23 * size, 0.17 * size], d, P);
    return;
  }
  const n = nseg(d),
    levels = d === 1 ? 6 : d === 2 ? 13 : 21,
    rings = [];
  for (let j = 0; j <= levels; j++) {
    const t = j / levels,
      y = c[1] + size * (-0.23 + 0.46 * t),
      a = Math.PI * (0.07 + 0.86 * t),
      w = size * 0.17 * Math.sin(a),
      z = size * 0.18 * Math.sin(a);
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const b = (i * 2 * Math.PI) / n,
          x = w * Math.sin(b),
          front = Math.max(0, Math.cos(b)),
          nose = 0.055 * size * Math.exp(-Math.pow((t - 0.49) / 0.12, 2)) * Math.pow(front, 12),
          eyes =
            0.018 *
            size *
            Math.exp(-Math.pow((t - 0.65) / 0.06, 2)) *
            (Math.exp(-Math.pow((x / size - 0.065) / 0.035, 2)) +
              Math.exp(-Math.pow((x / size + 0.065) / 0.035, 2))) *
            Math.pow(front, 6);
        return P([c[0] + x, y, c[2] + z * Math.cos(b) + nose - eyes]);
      }),
    );
  }
  skin(o, 'bronze', rings);
  ellipsoid(
    o,
    [c[0], c[1] + 0.16 * size, c[2] - 0.045 * size],
    [0.17 * size, 0.1 * size, 0.17 * size],
    d,
    P,
  );
  if (d > 1)
    for (const sign of [-1, 1])
      ellipsoid(
        o,
        [c[0] + sign * 0.17 * size, c[1], c[2]],
        [0.035 * size, 0.065 * size, 0.035 * size],
        d === 3 ? 2 : 1,
        P,
      );
  if (helmet)
    for (const sign of [-1, 1]) {
      const f = [
        [-0.05, 0.05],
        [0.32, 0.28],
        [0.25, 0.02],
        [0.02, -0.08],
      ].map(([x, y]) => P([c[0] + sign * (0.1 + x) * size, c[1] + (0.18 + y) * size, c[2] - 0.02]));
      Q(o, 'bronze', f);
      Q(o, 'bronze', f.map((v) => v.map((x, k) => x + (k === 2 ? -0.045 * size : 0))).reverse());
    }
}
function anatomy(o, P, pose, d) {
  const n = nseg(d),
    r = pose.scale ?? 1,
    hip = pose.hip,
    shoulder = pose.shoulder;
  const torso = (
    d > 1
      ? [
          [-0.05, 0.19, 0.14],
          [0.15, 0.2, 0.15],
          [0.35, 0.17, 0.12],
          [0.55, 0.26, 0.16],
          [0.8, 0.29, 0.17],
          [1, 0.21, 0.13],
        ]
      : [
          [-0.05, 0.19, 0.13],
          [0.25, 0.15, 0.11],
          [0.65, 0.27, 0.15],
          [0.92, 0.25, 0.13],
        ]
  ).map(([t, rx, rz]) =>
    Array.from({ length: n }, (_, i) =>
      P([
        hip[0] + (shoulder[0] - hip[0]) * t + rx * r * Math.sin((i * 2 * Math.PI) / n),
        hip[1] + (shoulder[1] - hip[1]) * t,
        hip[2] + (shoulder[2] - hip[2]) * t + rz * r * Math.cos((i * 2 * Math.PI) / n),
      ]),
    ),
  );
  skin(o, 'bronze', d === 0 ? [torso[0], torso.at(-1)] : torso);
  tube(
    o,
    'bronze',
    [
      P([shoulder[0], shoulder[1] - 0.18 * r, shoulder[2]]),
      P([pose.head[0], pose.head[1] - 0.18 * r, pose.head[2]]),
    ],
    0.09 * r,
    d === 0 ? 3 : n,
  );
  carvedHead(o, P, pose.head, r, d, pose.helmet);
  for (const limb of pose.limbs) {
    const points = limb.points.map(P),
      radii = limb.radii.map((x) => x * r);
    if (d === 0) tube(o, 'bronze', [points[0], points.at(-1)], [radii[0], radii.at(-1)], 3);
    else tube(o, 'bronze', points, radii, n);
  }
  if (d > 1)
    for (const hand of pose.hands ?? []) {
      ellipsoid(o, hand, [0.07 * r, 0.12 * r, 0.05 * r], d === 3 ? 2 : 1, P);
      if (d === 3)
        for (let j = 0; j < 4; j++)
          tube(
            o,
            'bronze',
            [
              P([hand[0] + (j - 1.5) * 0.026 * r, hand[1], hand[2] + 0.04 * r]),
              P([hand[0] + (j - 1.5) * 0.026 * r, hand[1] - 0.11 * r, hand[2] + 0.08 * r]),
            ],
            0.012 * r,
            5,
          );
    }
}
function boys(o, P, d, k) {
  const hip = [0, 2.72, 2.7],
    shoulder = [0, 3.25, 2.64],
    left = [-0.26, 3.0, 2.96],
    right = [0.28, 3.01, 2.98],
    pose = {
      hip,
      shoulder,
      head: [0, 3.49, 2.64],
      scale: 0.65,
      limbs: [
        {
          points: [
            [-0.15, 2.79, 2.68],
            [-0.34, 2.57, 3.03],
            [-0.36, 2.04, 3.12],
          ],
          radii: [0.14, 0.13, 0.08],
        },
        {
          points: [
            [0.15, 2.79, 2.68],
            [0.32, 2.54, 2.92],
            [0.37, 2.1, 3.02],
          ],
          radii: [0.14, 0.13, 0.08],
        },
        { points: [[-0.17, 3.19, 2.65], [-0.36, 3.08, 2.84], left], radii: [0.12, 0.1, 0.07] },
        { points: [[0.17, 3.19, 2.65], [0.37, 3.07, 2.84], right], radii: [0.12, 0.1, 0.07] },
      ],
      hands: [left, right],
    };
  anatomy(o, P, pose, d);
  if (d === 0) return;
  // Distinct emblem vocabularies; exact rear anatomy/compass order are original estimates.
  if (k === 0) {
    for (const x of [-0.4, 0.4])
      tube(
        o,
        'bronze',
        [P([x, 2.15, 3.34]), P([x * 0.9, 2.8, 3.2]), P([x * 0.6, 3.15, 3.02])],
        [0.08, 0.065, 0.018],
        nseg(d),
      );
    carvedHead(o, P, [0, 1.96, 3.49], 0.8, d);
  }
  if (k === 1) {
    ellipsoid(o, [0, 3.02, 3.03], [0.22, 0.22, 0.22], d, P);
    for (const sign of [-1, 1]) {
      const f = [
        [-0.07, 2.05],
        [sign * 0.55, 2.34],
        [sign * 0.8, 2.1],
        [sign * 0.22, 1.92],
      ].map(([x, y]) => P([x, y, 3.49]));
      Q(o, 'bronze', f);
      Q(o, 'bronze', f.map((v) => v.map((x, k) => x + (k === 2 ? -0.05 : 0))).reverse());
    }
    ellipsoid(o, [0, 2.11, 3.5], [0.14, 0.19, 0.15], d, P);
  }
  if (k === 2) {
    tube(
      o,
      'bronze',
      Array.from({ length: d === 3 ? 19 : 9 }, (_, i) => {
        const a = -1.15 + (i * 2.3) / (d === 3 ? 18 : 8);
        return P([0.31 * Math.cos(a) - 0.13, 2.12 + 0.31 * Math.sin(a), 3.5]);
      }),
      0.055,
      nseg(d),
    );
    carvedHead(o, P, [0.3, 2.7, 3.04], 0.7, d);
  }
  if (k === 3)
    tube(
      o,
      'bronze',
      Array.from({ length: d === 3 ? 25 : 13 }, (_, i) => {
        const t = i / (d === 3 ? 24 : 12);
        return P([
          0.28 * Math.sin(t * Math.PI * 3),
          2.12 + t * 0.85,
          3.38 + 0.06 * Math.cos(t * 2 * Math.PI),
        ]);
      }),
      0.045,
      nseg(d),
    );
}
function boats(o, d) {
  for (let k = 0; k < 4; k++) {
    const f = face((k * Math.PI) / 2),
      P = ([x, y, z]) => f.P(x, y, z),
      steps = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 8 : 14,
      rings = [];
    for (let j = 0; j <= steps; j++) {
      const t = j / steps,
        z = 1.7 + t * 2.18,
        w = 0.83 * (1 - 0.87 * Math.pow(t, 1.5)),
        top = 2.55 + 0.22 * Math.pow(t, 3),
        low = 1.13 + 0.95 * Math.pow(t, 1.7);
      rings.push(
        [
          [-w, top],
          [-w, low + 0.35],
          [0, low],
          [w, low + 0.35],
          [w, top],
        ].map(([x, y]) => P([x, y, z])),
      );
    }
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < 5; i++) {
        const n = (i + 1) % 5,
          center = [0, 1, 2].map(
            (a) => rings[j - 1].concat(rings[j]).reduce((v, q) => v + q[a], 0) / 10,
          ),
          nn = [0, 1, 2].map(
            (a) =>
              (rings[j - 1][i][a] + rings[j - 1][n][a] + rings[j][n][a] + rings[j][i][a]) / 4 -
              center[a],
          );
        Q(o, 'bronze', [rings[j - 1][i], rings[j - 1][n], rings[j][n], rings[j][i]], nn);
      }
    cap(
      o,
      'bronze',
      rings[0],
      f.n.map((v) => -v),
    );
    cap(o, 'bronze', rings.at(-1), f.n);
    if (d > 0)
      for (const sign of [-1, 1])
        tube(
          o,
          'bronze',
          Array.from({ length: steps + 1 }, (_, j) => {
            const t = j / steps;
            return P([
              sign * 0.83 * (1 - 0.87 * Math.pow(t, 1.5)),
              2.59 + 0.22 * Math.pow(t, 3),
              1.7 + t * 2.18,
            ]);
          }),
          0.05,
          nseg(d),
        );
    boys(o, P, d, k);
  }
}
function summit(o, d) {
  const P = ([x, y, z]) => [x - 0.38, F + 8.1 + y, z - 0.12],
    n = [3, 4, 32, 64][d],
    m = [2, 5, 10, 18][d],
    rings = [];
  // Full asymmetric draped standing Amazon figure, including the back and physical cloth folds.
  for (let j = 0; j <= m; j++) {
    const t = j / m,
      y = t * 1.65,
      w = 0.54 - 0.28 * t,
      rz = 0.43 - 0.23 * t;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          fold = d === 0 ? 0 : 0.045 * (1 - 0.6 * t) * Math.cos(8 * a + 1.8 * t);
        return P([
          -0.1 * (1 - t) + (w + fold) * Math.sin(a),
          y,
          (rz + fold) * Math.cos(a) - 0.12 * (1 - t),
        ]);
      }),
    );
  }
  skin(o, 'bronze', rings);
  if (d > 1) {
    const cape = [];
    for (let j = 0; j <= m; j++) {
      const t = j / m,
        y = 0.05 + 2.43 * t;
      cape.push(
        Array.from({ length: n }, (_, i) => {
          const a = (i * 2 * Math.PI) / n,
            fold = 0.055 * (1 - 0.45 * t) * Math.cos(11 * a + 2 * t),
            w = 0.47 - 0.26 * t,
            dep = 0.25 - 0.13 * t;
          return P([
            -0.36 * (1 - t) - 0.16 + (w + fold) * Math.sin(a),
            y,
            -0.21 + (dep + fold) * Math.cos(a),
          ]);
        }),
      );
    }
    skin(o, 'bronze', cape);
  }
  const l = [0.94, 1.88, 0.24],
    r = [-0.59, 3.36, 0.16],
    pose = {
      hip: [0, 1.45, 0],
      shoulder: [-0.02, 2.43, 0],
      head: [-0.02, 2.87, 0.015],
      scale: 1.05,
      limbs: [
        { points: [[-0.27, 2.35, 0.03], [-0.72, 2.91, 0.09], r], radii: [0.15, 0.12, 0.08] },
        { points: [[0.24, 2.35, 0.02], [0.48, 2.08, 0.18], l], radii: [0.15, 0.12, 0.08] },
      ],
      hands: [l, r],
    };
  anatomy(o, P, pose, d);
  tube(o, 'bronze', [P([-0.59, 3.24, 0.16]), P([-0.56, 3.92, 0.16])], 0.045, nseg(d));
  skin(
    o,
    'bronze',
    [
      [3.86, 0.1],
      [4.08, 0.14],
      [4.27, 0.075],
      [4.4, 0.012],
    ].map(([y, rr]) =>
      Array.from({ length: n }, (_, i) =>
        P([
          -0.56 + rr * Math.sin((i * 2 * Math.PI) / n),
          y,
          0.16 + rr * Math.cos((i * 2 * Math.PI) / n),
        ]),
      ),
    ),
  );
  if (d > 0) {
    for (let k = 0; k < (d === 3 ? 9 : 4); k++) {
      const a = (k / (d === 3 ? 8 : 3) - 0.5) * Math.PI;
      const pts = Array.from({ length: d === 3 ? 11 : 6 }, (_, i) => {
        const t = i / (d === 3 ? 10 : 5);
        return P([
          -0.02 + 0.19 * Math.sin(a) - 0.08 * t,
          2.99 - 0.55 * t,
          0.015 - 0.16 * Math.cos(a) - 0.06 * t,
        ]);
      });
      tube(o, 'bronze', pts, 0.035, nseg(d));
    }
  }
  const M = ([x, y, z]) => [x + 0.5, F + 8.1 + y, z + 0.28],
    hands = [
      [-0.25, 1.0, 0.38],
      [0.45, 1.0, 0.28],
    ];
  anatomy(
    o,
    M,
    {
      hip: [0.03, 0.62, 0],
      shoulder: [0.04, 1.5, 0.03],
      head: [0.03, 1.91, 0.05],
      scale: 0.9,
      helmet: true,
      limbs: [
        {
          points: [
            [-0.18, 0.69, 0],
            [-0.55, 0.55, 0.52],
            [-0.62, 0.05, 0.71],
          ],
          radii: [0.19, 0.15, 0.09],
        },
        {
          points: [
            [0.2, 0.69, 0],
            [0.52, 0.5, 0.49],
            [0.55, 0.05, 0.77],
          ],
          radii: [0.19, 0.15, 0.09],
        },
        { points: [[-0.2, 1.46, 0.04], [-0.43, 1.1, 0.21], hands[0]], radii: [0.14, 0.11, 0.07] },
        { points: [[0.29, 1.46, 0.03], [0.52, 1.18, 0.1], hands[1]], radii: [0.14, 0.11, 0.07] },
      ],
      hands,
    },
    d,
  );
  if (d > 0) {
    skin(
      o,
      'bronze',
      [
        [0.6, 0.31],
        [0.85, 0.35],
        [1.04, 0.23],
      ].map(([y, rr]) =>
        Array.from({ length: n }, (_, i) =>
          M([rr * Math.sin((i * 2 * Math.PI) / n), y, rr * 0.8 * Math.cos((i * 2 * Math.PI) / n)]),
        ),
      ),
    );
    tube(o, 'bronze', [M([0.5, 0.4, 0.23]), M([0.59, 1.5, 0.24])], 0.03, nseg(d));
  }
}
function build(o, _f, d = 3) {
  base(o, d);
  boats(o, d);
  summit(o, d);
}
export const openingPortsSkyline = (o, f) => build(o, f, 0),
  openingPortsDistrict = (o, f) => build(o, f, 1),
  openingPortsStreet = (o, f) => build(o, f, 2),
  openingPortsCloseup = (o, f) => build(o, f, 3);
export const openingPortsModel = {
  id: 'monument_abertura_dos_portos',
  key: 'monument_abertura_dos_portos',
  cell: '6x/6xm',
  recipe: 'structure-opening-of-the-ports-monument.mjs',
  title: 'Opening of the Ports Monument, Manaus',
  category: 'memorial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [17, 13, 21],
  lookAt: [0, F + 6.1, 0],
  portableGroundY: F - 0.1,
  mediumFiContext: { scale: 1, groundY: F - 0.1 },
  qaCameras: [
    {
      name: 'whole-monument-four-ship-groups-eight-columns-two-summit-figures',
      position: [17, 13, 21],
      lookAt: [0, F + 6.1, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'amazon-raised-torch-and-lower-mercury-whole-sculpture',
      position: [5.6, F + 11.1, 7.5],
      lookAt: [0, F + 10.2, 0.05],
    },
    {
      name: 'central-eight-columns-physical-inset-shield-and-cornices',
      position: [6, F + 7, 8],
      lookAt: [0, F + 5.7, 0],
    },
    {
      name: 'africa-and-europe-ships-seated-boys-and-emblems',
      position: [7, F + 4.5, 9],
      lookAt: [1, F + 2.6, 1.5],
    },
    {
      name: 'asia-americas-ships-and-all-eleven-native-base-stations',
      position: [-11, F + 6, -12],
      lookAt: [0, F + 3, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-opening-of-the-ports-monument.mjs',
    level: 'skyline',
    export: 'openingPortsSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'openingPortsDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'openingPortsStreet', errorMeters: 0.13, surfaces },
      closeup: { export: 'openingPortsCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole original11-control intrinsic base/four steps/lowergranitebody/four physical shipbows withseated boys/continent emblems/eight columns/real .09m centralpanel recesses/cornices/two summit bronze figures, womanraisedrighttorch/lowerMercury. Physicalsculpture profiles/anatomy/folds/emblem sections andcompass order are original medium-fi estimates, not photogrammetry or exact portrait. Skyline simplifies anatomical/attribute/column sections but retains whole component vocabulary.',
    'Exact published1208x1696 1903 PDbookphoto only/nativeSHA1matched and personallyinspected. NativePD-scan/PD-1923 plus sourcebookPD-old-auto/death1935/BrownUniversityLibrary1903 NOT_IN_COPYRIGHT record. No modernBY/SA/AIcolorized/ambiguous later photograph pixels, copiedmesh/generatedbitmap/photographictextures. Graygranite/creamtravertine/yellowSienamarble/darkbronze palette from primary1899 constructioncontract; restorationfinish unsurveyed.',
    'Independent300m129x129/16641sourcevalues/two rawTerrariumtiles frozen before floors/geometry. Fixed37.7936m datum/floor0 unsurveyedstructural reference. No groundfit/flatten/reacquire; exactstep/plazacontact unresolved, geographicpreview/replaceFootprintfalse. Diagnosticflatground separate; surroundingplaza/theatre/church/people/vegetation/lettering/privateinteriors excluded.',
  ],
};
