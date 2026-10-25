/** Whole white concrete monument: original photograph-directed sculpture and native intrinsic access. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/7n/7ns/statue_of_father_cicero/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    sculpture: rgb('e4e4db'),
    base: rgb('d9dcd1'),
    trim: rgb('e6e7dd'),
    metal: rgb('7c8780'),
    recess: rgb('bfc4ba'),
  },
  surfaces = {
    sculpture: { slot: 'wall', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    base: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.98, metallic: 0 },
    trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.08 },
    recess: { slot: 'trim', localRef: ref, roughness: 0.98, metallic: 0 },
  };
function T(o, s, q, n) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
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
const area = (r) =>
  r.reduce((v, a, i) => v + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0);
function cap(o, s, r, y, up = true) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function F(a, b, r = p.pedestal) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [Math.sign(area(r)) * u[1], 0, -Math.sign(area(r)) * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function prism(o, s, r, y0, y1) {
  cap(o, s, r, y1);
  for (let i = 0; i < r.length; i++) {
    const f = F(r[i], r[(i + 1) % r.length], r);
    Q(o, s, [f.P(0, y0), f.P(f.len, y0), f.P(f.len, y1), f.P(0, y1)], f.n);
  }
}
function wall(o, f, holes) {
  const outer = [
      [0, 2.6],
      [f.len, 2.6],
      [f.len, 10],
      [0, 10],
    ],
    pts = [outer, ...holes].flat(),
    ids = earcut(
      pts.flat(),
      holes.map((_, k) => 4 + holes.slice(0, k).reduce((a, v) => a + v.length, 0)),
    );
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      'base',
      ids.slice(i, i + 3).map((k) => f.P(...pts[k])),
      f.n,
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const a = h[i],
        b = h[(i + 1) % h.length];
      Q(o, 'trim', [f.P(...a), f.P(...b), f.P(...b, -1.15), f.P(...a, -1.15)]);
    }
    const ix = earcut(h.flat());
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'recess',
        ix.slice(i, i + 3).map((k) => f.P(...h[k], -1.15)),
        f.n,
      );
  }
}
function arch(x, y, w, h, n) {
  const r = w / 2,
    yy = y + h - r;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i * Math.PI) / n),
      yy + r * Math.sin((i * Math.PI) / n),
    ]),
  ];
}
function B(o, s, x, y, z, w, h, dep) {
  box(o, s, [x - w / 2, y, z - dep / 2], [x + w / 2, y + h, z + dep / 2], C[s]);
}
function stairs(o, side, d) {
  const x = side * 6.35,
    w = 1.3,
    z0 = 9,
    z1 = -4.2,
    y0 = 2.6,
    y1 = 10,
    n = [1, 12, 28, 38][d],
    r = [];
  if (d === 0) {
    Q(
      o,
      'base',
      [
        [x - w / 2, y0, z0],
        [x + w / 2, y0, z0],
        [x + w / 2, y1, z1],
        [x - w / 2, y1, z1],
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1])
      T(
        o,
        'base',
        [
          [x + (side * w) / 2, y0, z0],
          [x + (side * w) / 2, y1, z1],
          [x + (side * w) / 2, y0, z1],
        ],
        [side, 0, 0],
      );
    Q(
      o,
      'base',
      [
        [x - w / 2, y0, z1],
        [x - w / 2, y1, z1],
        [x + w / 2, y1, z1],
        [x + w / 2, y0, z1],
      ],
      [0, 0, -1],
    );
    return;
  }
  for (let j = 0; j < n; j++) {
    const a = j / n,
      b = (j + 1) / n,
      z = z0 + (z1 - z0) * a,
      zz = z0 + (z1 - z0) * b,
      y = y0 + (y1 - y0) * b;
    r.push([z, y]);
    r.push([zz, y]);
    Q(
      o,
      'base',
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y, zz],
        [x - w / 2, y, zz],
      ],
      [0, 1, 0],
    );
    const yy = y0 + (y1 - y0) * a;
    Q(
      o,
      'base',
      [
        [x - w / 2, yy, z],
        [x + w / 2, yy, z],
        [x + w / 2, y, z],
        [x - w / 2, y, z],
      ],
      [0, 0, 1],
    );
  }
  const profile = [[z0, y0], ...r, [z1, y0]],
    ix = earcut(profile.flat());
  for (const sign of [-1, 1])
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'base',
        ix.slice(i, i + 3).map((k) => [x + (sign * w) / 2, profile[k][1], profile[k][0]]),
        [sign, 0, 0],
      );
  if (d > 0) {
    for (const sign of [-1, 1]) {
      const xx = x + (sign * w) / 2;
      beam(o, 'trim', [xx, y0 + 1, z0], [xx, y1 + 1, z1], 0.09, 0.09, C.trim);
      const posts = [0, 4, 7, 11][d];
      for (let j = 0; j <= posts; j++) {
        const t = j / posts;
        B(o, 'trim', xx, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t, 0.1, 1, 0.1);
      }
    }
  }
}
function pedestal(o, d) {
  let prev = 0;
  for (const s of p.steps) {
    prism(o, 'base', s.ring, prev, s.height);
    prev = s.height;
  }
  prism(o, 'base', p.lowerApproach, 0, 2.6);
  cap(o, 'trim', p.pedestal, 10);
  for (let i = 0; i < p.pedestal.length; i++) {
    const f = F(p.pedestal[i], p.pedestal[(i + 1) % p.pedestal.length]),
      holes = i === p.frontEdge ? [arch(f.len * 0.5, 2.61, 2.1, 5.9, [4, 6, 10, 16][d])] : [];
    wall(o, f, holes);
    if (d === 0) {
      Q(o, 'trim', [f.P(0, 10), f.P(f.len, 10), f.P(f.len, 10.8), f.P(0, 10.8)], f.n);
    } else {
      beam(o, 'trim', f.P(0, 11.05, 0.03), f.P(f.len, 11.05, 0.03), 0.12, 0.14, C.trim);
      const count = d === 1 ? 2 : d === 2 ? 4 : 6;
      for (let j = 0; j < count; j++) {
        const t = j / count;
        B(
          o,
          'trim',
          ...(() => {
            const q = f.P(f.len * t, 10, 0.02);
            return [q[0], 10, q[2], 0.12, 1.05, 0.12];
          })(),
        );
        if (d >= 2 && j % 2 === 0)
          beam(
            o,
            'metal',
            f.P(f.len * (t + 0.5 / count), 10.15, 0.02),
            f.P(f.len * (t + 0.5 / count), 10.95, 0.02),
            0.045,
            0.045,
            C.metal,
          );
      }
      if (d >= 2)
        for (const yy of [10.25, 10.7])
          beam(o, 'metal', f.P(0, yy, 0.02), f.P(f.len, yy, 0.02), 0.045, 0.045, C.metal);
    }
  }
  stairs(o, -1, d);
  stairs(o, 1, d);
}
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  G = (v, c, r) => Math.exp(-((v - c) * (v - c)) / (r * r));
function profile(rows, y) {
  if (y <= rows[0][0]) return rows[0].slice(1);
  for (let i = 1; i < rows.length; i++)
    if (y <= rows[i][0])
      return mix(
        rows[i - 1].slice(1),
        rows[i].slice(1),
        (y - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]),
      );
  return rows.at(-1).slice(1);
}
function skin(o, s, fn, N, J, y0, y1) {
  const rows = Array.from({ length: J + 1 }, (_, j) =>
    Array.from({ length: N }, (_, i) => fn(y0 + ((y1 - y0) * j) / J, (i * 2 * Math.PI) / N)),
  );
  for (let j = 0; j < J; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N;
      Q(o, s, [rows[j][i], rows[j][k], rows[j + 1][k], rows[j + 1][i]]);
    }
  for (const [r, up] of [
    [rows[0], false],
    [rows.at(-1), true],
  ]) {
    const c = r.reduce((a, v) => a.map((x, k) => x + v[k] / r.length), [0, 0, 0]);
    for (let i = 0; i < N; i++) T(o, s, [c, r[i], r[(i + 1) % N]], [0, up ? 1 : -1, 0]);
  }
}
function blob(o, s, c, r, N, J) {
  skin(
    o,
    s,
    (t, a) => {
      const b = (t * Math.PI) / 2;
      return [
        c[0] + r[0] * Math.cos(b) * Math.sin(a),
        c[1] + r[1] * Math.sin(b),
        c[2] + r[2] * Math.cos(b) * Math.cos(a),
      ];
    },
    N,
    J,
    -0.9999,
    0.9999,
  );
}
function pathTube(o, s, points, radii, N) {
  let previous;
  const rings = points.map((c, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)],
      axis = normalize(b.map((v, k) => v - a[k]));
    let u;
    if (previous) {
      const dot = previous.reduce((v, q, k) => v + q * axis[k], 0);
      u = normalize(previous.map((q, k) => q - dot * axis[k]));
    } else u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
    previous = u;
    const v = cross(axis, u),
      r = radii[i];
    return Array.from({ length: N }, (_, j) =>
      c.map(
        (q, k) =>
          q + r * (Math.sin((j * 2 * Math.PI) / N) * u[k] + Math.cos((j * 2 * Math.PI) / N) * v[k]),
      ),
    );
  });
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N;
      Q(o, s, [rings[j][i], rings[j + 1][i], rings[j + 1][k], rings[j][k]]);
    }
  for (const [r, c, n] of [
    [rings[0], points[0], points[0].map((v, k) => v - points[1][k])],
    [rings.at(-1), points.at(-1), points.at(-1).map((v, k) => v - points.at(-2)[k])],
  ])
    for (let i = 0; i < N; i++) T(o, s, [c, r[i], r[(i + 1) % N]], n);
}
const bodyRows = [
  [10, 2.72, 1.35, 1.25],
  [11, 2.8, 1.4, 1.3],
  [14, 2.5, 1.4, 1.25],
  [17, 2.2, 1.35, 1.18],
  [19.5, 2.18, 1.25, 1.1],
  [21.8, 2.55, 1.12, 1.08],
  [22.5, 2.65, 1.03, 1.0],
  [23.0, 2.4, 0.9, 0.86],
  [23.35, 1.5, 0.72, 0.7],
  [23.6, 0.75, 0.64, 0.66],
];
function cassockPoint(y, a) {
  const [rx, f, b] = profile(bodyRows, y),
    ca = Math.cos(a),
    x = rx * Math.sin(a),
    fold =
      (0.105 * Math.cos(12 * a + 0.045 * y) + 0.06 * Math.cos(7 * a - 0.04 * y)) * G(y, 15.0, 7.5),
    placket = 0.08 * G(x, 0, 0.17) * Math.max(0, ca);
  return [x + fold * Math.sin(a), y, (ca >= 0 ? f : b) * ca + fold * ca + placket];
}
function arms(o, d) {
  const N = [6, 10, 18, 28][d],
    segments = [3, 5, 12, 20][d],
    right = [
      [-1.95, 22.5, -0.1],
      [-2.8, 21.3, 0.15],
      [-3.05, 19.4, 0.85],
      [-2.6, 19.45, 1.6],
      [-1.65, 20.0, 2.15],
    ],
    left = [
      [1.95, 22.5, -0.12],
      [2.85, 21.3, -0.1],
      [3.05, 19.2, 0.2],
      [2.75, 17.7, 0.9],
      [2.65, 17.45, 1.2],
    ],
    radii = [0.75, 0.72, 0.6, 0.49, 0.4];
  for (const points of [right, left]) {
    const dense = [],
      rs = [];
    for (let j = 0; j < segments; j++) {
      const t = (j * (points.length - 1)) / (segments - 1),
        k = Math.min(points.length - 2, Math.floor(t)),
        v = t - k;
      dense.push(
        points[k].map((_, axis) => {
          const a = points[Math.max(0, k - 1)][axis],
            b = points[k][axis],
            c = points[k + 1][axis],
            d = points[Math.min(points.length - 1, k + 2)][axis];
          return (
            0.5 *
            (2 * b +
              (-a + c) * v +
              (2 * a - 5 * b + 4 * c - d) * v * v +
              (-a + 3 * b - 3 * c + d) * v * v * v)
          );
        }),
      );
      rs.push(radii[k] + (radii[k + 1] - radii[k]) * v);
    }
    pathTube(o, 'sculpture', dense, rs, N);
  }
  blob(
    o,
    'sculpture',
    [-1.55, 20.05, 2.27],
    [0.62, 0.43, 0.4],
    [6, 8, 14, 22][d],
    [3, 4, 8, 12][d],
  );
  blob(
    o,
    'sculpture',
    [2.62, 17.38, 1.45],
    [0.45, 0.65, 0.29],
    [6, 8, 14, 22][d],
    [3, 4, 8, 12][d],
  );
  if (d >= 2) {
    for (let j = 0; j < 4; j++) {
      const x = -2.03 + j * 0.27;
      pathTube(
        o,
        'sculpture',
        [
          [x, 20.2, 2.35],
          [x + 0.02, 20.0, 2.65],
          [x + 0.04, 19.58, 2.62],
          [x + 0.05, 19.47, 2.38],
        ],
        [0.145, 0.145, 0.12, 0.08],
        d === 2 ? 6 : 10,
      );
      const xx = 2.15 + j * 0.23;
      pathTube(
        o,
        'sculpture',
        [
          [xx, 17.45, 1.52],
          [xx + 0.12, 17.1, 1.84],
          [xx + 0.22, 16.75, 1.85],
          [xx + 0.25, 16.63, 1.61],
        ],
        [0.13, 0.13, 0.105, 0.065],
        d === 2 ? 6 : 10,
      );
    }
    pathTube(
      o,
      'sculpture',
      [
        [-1.05, 20.05, 2.18],
        [-1.18, 19.75, 2.42],
        [-1.43, 19.65, 2.4],
      ],
      [0.19, 0.16, 0.11],
      d === 2 ? 6 : 10,
    );
    pathTube(
      o,
      'sculpture',
      [
        [2.95, 17.65, 1.4],
        [3.15, 17.25, 1.3],
        [3.06, 17.0, 1.1],
      ],
      [0.18, 0.15, 0.1],
      d === 2 ? 6 : 10,
    );
  }
  pathTube(
    o,
    'sculpture',
    [
      [-1.55, 10, 2.25],
      [-1.55, 19.8, 2.25],
      [-1.62, 20.2, 2.25],
    ],
    [0.12, 0.13, 0.15],
    [4, 6, 10, 14][d],
  );
}
const headRows = [
  [23.65, 0.5, 0.52, 0.1],
  [23.95, 0.7, 0.7, 0.13],
  [24.3, 0.91, 0.8, 0.1],
  [24.75, 1.0, 0.84, 0.05],
  [25.25, 1.04, 0.87, 0],
  [25.7, 1.04, 0.9, -0.04],
  [26.15, 1.0, 0.9, -0.08],
  [26.5, 0.89, 0.83, -0.07],
  [26.8, 0.65, 0.65, -0.05],
  [27, 0.025, 0.025, -0.02],
];
function headPoint(y, a) {
  const [rx, rz, cz] = profile(headRows, y),
    ca = Math.cos(a),
    x = rx * Math.sin(a),
    f = Math.max(0, ca);
  let z = rz * ca + cz;
  if (ca > 0) {
    const nose =
        0.36 * G(x, 0, 0.22) * G(y, 25.25, 0.47) + 0.16 * G(x, 0, 0.28) * G(y, 25.04, 0.13),
      eyes = -0.17 * (G(x, -0.43, 0.25) + G(x, 0.43, 0.25)) * G(y, 25.64, 0.12),
      brows = 0.14 * (G(x, -0.43, 0.31) + G(x, 0.43, 0.31)) * G(y, 25.9, 0.1),
      cheeks = 0.1 * (G(x, -0.63, 0.28) + G(x, 0.63, 0.28)) * G(y, 25.1, 0.32),
      mouth =
        0.065 * G(x, 0, 0.45) * G(y, 24.65, 0.12) - 0.065 * G(x, 0, 0.42) * G(y, 24.69, 0.047),
      chin = 0.12 * G(x, 0, 0.45) * G(y, 24.2, 0.21),
      fold = -0.05 * (G(x, -0.37, 0.055) + G(x, 0.37, 0.055)) * G(y, 24.8, 0.3),
      forehead = -0.025 * G(x, 0, 0.75) * (G(y, 26.12, 0.028) + G(y, 26.23, 0.028));
    z += (nose + eyes + brows + cheeks + mouth + chin + fold + forehead) * f;
  }
  z += 0.025 * Math.sin(18 * x + 6 * y) * G(y, 26.63, 0.35) * Math.abs(ca);
  return [x, y, z];
}
function head(o, d) {
  skin(o, 'sculpture', headPoint, [8, 16, 32, 64][d], [6, 12, 28, 62][d], 23.65, 27);
  skin(
    o,
    'sculpture',
    (y, a) => [0.67 * Math.sin(a), y, 0.62 * Math.cos(a)],
    [6, 10, 18, 24][d],
    [1, 2, 3, 5][d],
    23.15,
    23.95,
  );
  if (d > 0)
    for (const side of [-1, 1]) {
      skin(
        o,
        'sculpture',
        (t, a) => {
          const b = (t * Math.PI) / 2,
            xx = 0.33 * Math.cos(b) * Math.sin(a),
            yy = 0.59 * Math.sin(b),
            ca = Math.cos(a);
          return [
            side * 1.03 + xx,
            25.1 + yy,
            0.02 + 0.26 * Math.cos(b) * ca - (ca > 0 ? 0.13 * G(xx, 0, 0.15) * G(yy, 0, 0.34) : 0),
          ];
        },
        [6, 8, 14, 24][d],
        [3, 5, 10, 16][d],
        -0.9999,
        0.9999,
      );
    }
}
function hat(o, d) {
  const N = [8, 12, 24, 40][d],
    P = (a, back = false, inner = false) => {
      const x = (inner ? 1.03 : 1.65) * Math.sin(a),
        y = (inner ? 1.32 : 2.05) * Math.cos(a);
      return [2.65 + x, 15.4 + y, 1.12 + 0.14 * Math.sin(a) * Math.sin(a) - (back ? 0.17 : 0)];
    };
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      b = ((i + 1) * 2 * Math.PI) / N;
    Q(o, 'sculpture', [P(a), P(b), P(b, false, true), P(a, false, true)], [0, 0, 1]);
    Q(o, 'sculpture', [P(a, true), P(a, true, true), P(b, true, true), P(b, true)], [0, 0, -1]);
    Q(
      o,
      'sculpture',
      [P(a), P(a, true), P(b, true), P(b)],
      [Math.sin((a + b) / 2), Math.cos((a + b) / 2), 0],
    );
    Q(
      o,
      'sculpture',
      [P(a, false, true), P(b, false, true), P(b, true, true), P(a, true, true)],
      [-Math.sin((a + b) / 2), -Math.cos((a + b) / 2), 0],
    );
  }
  const J = [2, 3, 8, 14][d],
    pt = (t, a) => [
      2.65 + 1.03 * Math.cos(t) * Math.sin(a),
      15.4 + 1.32 * Math.cos(t) * Math.cos(a),
      1.12 + 1.06 * Math.sin(t),
    ];
  for (let j = 0; j < J; j++)
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        t = (j * Math.PI) / (2 * J),
        u = ((j + 1) * Math.PI) / (2 * J);
      Q(o, 'sculpture', [pt(t, a), pt(t, b), pt(u, b), pt(u, a)], [0, 0, 1]);
    }
  const center = [2.65, 15.4, 0.95];
  for (let i = 0; i < N; i++)
    T(
      o,
      'sculpture',
      [center, P((i * 2 * Math.PI) / N, true, true), P(((i + 1) * 2 * Math.PI) / N, true, true)],
      [0, 0, -1],
    );
}
function figure(o, d) {
  skin(o, 'sculpture', cassockPoint, [8, 14, 28, 64][d], [5, 10, 20, 52][d], 10, 23.6);
  arms(o, d);
  head(o, d);
  hat(o, d);
  const count = [0, 5, 14, 20][d];
  for (let i = 0; i < count; i++) {
    const y = 10.55 + (i * 11.8) / Math.max(1, count - 1),
      z = cassockPoint(y, 0)[2] + 0.08;
    blob(
      o,
      'sculpture',
      [0, y, z],
      [0.15, 0.15, 0.1],
      d === 1 ? 4 : d === 2 ? 8 : 12,
      d === 1 ? 2 : d === 2 ? 4 : 6,
    );
  }
  if (d >= 2)
    skin(
      o,
      'trim',
      (y, a) => [0.7 * Math.sin(a), y, 0.65 * Math.cos(a)],
      [12, 16, 24, 32][d],
      2,
      23.28,
      23.52,
    );
}
function build(o, _f, d = 3) {
  pedestal(o, d);
  figure(o, d);
}
export const ciceroSkyline = (o, f) => build(o, f, 0),
  ciceroDistrict = (o, f) => build(o, f, 1),
  ciceroStreet = (o, f) => build(o, f, 2),
  ciceroCloseup = (o, f) => build(o, f, 3);
export const ciceroModel = {
  id: 'statue_of_father_cicero',
  key: 'statue_of_father_cicero',
  cell: '7n/7ns',
  recipe: 'structure-statue-of-father-cicero.mjs',
  title: 'Statue of Father Cícero, Juazeiro do Norte',
  category: 'memorial',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-28, 22, 53],
  lookAt: [0, 14, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.0, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-cleric-cane-hat-intrinsic-pedestal-and-side-stairs',
      position: [-27, 23, 49],
      lookAt: [0, 14, 0],
    },
    {
      name: 'physical-face-combed-hair-ears-collar-and-brows',
      position: [-4, 25.8, 9.5],
      lookAt: [0, 25.3, 0],
    },
    {
      name: 'bent-right-hand-on-cane-and-left-hand-holding-hat',
      position: [-9, 19.6, 13],
      lookAt: [0, 18.3, 1.4],
    },
    {
      name: 'arched-base-open-balustrade-and-whole-rear-access',
      position: [24, 14, -27],
      lookAt: [0, 8, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozenbeforegeometry; exacthillapproach/hostgroundcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-statue-of-father-cicero.mjs',
    level: 'skyline',
    export: 'ciceroSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'ciceroDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'ciceroStreet', errorMeters: 0.13, surfaces },
      closeup: { export: 'ciceroCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Threeexactalready-publishedKabesaomat/LourencoTorrescreator-PDQuallaoriginals individuallyinspected/nativeSHA1matched/item-specificPD-self/PD-usergrantsbound/existingpolicypasses.18families; unrelatedconflictinghero/Rodin/museumexcluded; MTurmandatorycreditambiguityuninspected/unused. No generatedbitmap/photo texture/downloadedmesh/officialsourcephoto/architecturediagram.',
    'Officialmunicipal27moverall=17mfigure+10mpedestal. Originalcomplete8vertexmainbase/10vertexnotchedapproach/13native8vertex0.2..2.6msteps retained. Whole61mterraceplazaslabexcluded. Nativeheighttagsnotfigurescan; wholewhitecleric/cassockfolds/centralbuttons/collar/physicalhead/ears/brows/nose/eyeandmouthrecesses/combedhair, bentrightforearm/handoncane/lefthandholdinghat areoriginalboundedphotographicsculpturalinterpretations. Fineportrait/hiddenrear/cosmeticsnotphotogrammetry.',
    'Uppergallery/archedfrontrecess/twosideflightprofiles/railcounts/closedpedestalinterior areoriginalboundedestimates. Physicaldetailedfingerseparation/caneclearance/hatbrimandcrown, wholecassockbackandsides included; distantreducedcloth/face/finger/railcounts preservewhole17mfigure/27mheight/cane/hat/base. No antenna/plaquetext/graffiti/people/interiorstairroom.',
    'Independent400m129x129/16641values/2rawTerrariumtiles frozenbeforegeometrywithoutfit/flatten/reacquire. HillDEMnotlocalsurvey; portable/shared/contextflatgroundseparate. Nativepreview/replaceFootprint=false; actualhillgroundattachment/precisestairthresholdsunverified. No outerplaza/hill/church/museum/cablecar/trees/roads/neighbours/whole-sitefloor.',
  ],
};
