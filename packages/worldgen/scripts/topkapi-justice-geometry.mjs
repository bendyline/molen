/** 'tower_of_justice_topkapi_palace': Square stone shaft, paired-column belvedere, curved pediments and lead spire. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiJustice(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, p, n) => face(role, p.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, p, n) => f(role, p, n),
      addConvexPolygon: (role, _ref, p, n) => {
        for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    turn = (i, [u, y, d]) =>
      [
        [u, y, d],
        [-d, y, u],
        [-u, y, -d],
        [d, y, -u],
      ][i],
    side = (i) => (role, p, n) =>
      f(
        role,
        p.map((p) => turn(i, p)),
        turn(i, n),
      ),
    segment = (x, R, rise) => {
      const q = (R * R + rise * rise) / (2 * rise);
      return rise - q + Math.sqrt(Math.max(0, q * q - x * x));
    },
    cylinder = (role, x, z, profile, sides) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: sides }, (_, i) => [
          x + R * Math.cos((i * 2 * Math.PI) / sides),
          y,
          z + R * Math.sin((i * 2 * Math.PI) / sides),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < sides; i++) {
          const k = (i + 1) % sides;
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.01, rings[j][i][2] - z],
          );
        }
      if (role !== 'column')
        for (const [ring, N] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ])
          for (let i = 0; i < sides; i++)
            f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, N, 0]);
    },
    archPanel = (emit, role, R, base, spring, rise, d) => {
      const p = [
        [-R, base, d],
        [R, base, d],
      ];
      for (let i = 0, n = [4, 6, 12, 20][detail]; i <= n; i++) {
        const x = R - (2 * R * i) / n;
        p.push([x, spring + segment(x, R, rise), d]);
      }
      for (let i = 1; i < p.length - 1; i++) emit(role, [p[0], p[i], p[i + 1]], [0, 0, 1]);
    },
    band = (emit, role, R, spring, rise, width, d) => {
      for (let i = 0, n = [4, 6, 12, 20][detail]; i < n; i++) {
        const a = -R + (2 * R * i) / n,
          b = -R + (2 * R * (i + 1)) / n,
          ya = spring + segment(a, R, rise),
          yb = spring + segment(b, R, rise);
        emit(
          role,
          [
            [a, ya, d],
            [b, yb, d],
            [(b * (R + width)) / R, yb + width, d],
            [(a * (R + width)) / R, ya + width, d],
          ],
          [0, 0, 1],
        );
      }
    };
  for (const p of r.body) prism(f, 'wall', p, r.foundationBottom, 0);
  box(f, 'wall', 0, 0, 0, 7.6, 16.0, 7.6);
  // True masonry recesses on the otherwise plain shaft; the window backing is half a metre behind its face.
  for (let i = 0; i < 4; i++) {
    const g = side(i),
      windows = [
        [7.5, 9.15],
        [12, 13.75],
      ];
    for (const sign of [-1, 1]) box(g, 'wall', sign * 2.4, 0, 4.0, 3.6, 16.0, 0.4);
    let y = 0;
    for (const [lo, hi] of windows) {
      box(g, 'wall', 0, y, 4.0, 1.2, lo - y, 0.4);
      y = hi;
    }
    box(g, 'wall', 0, y, 4.0, 1.2, 16.0 - y, 0.4);
    for (const [lo, hi] of windows) {
      box(g, 'glass', 0, lo, 3.82, 1.15, hi - lo, 0.04);
      if (detail) {
        for (const x of [-0.6, 0.6]) box(g, 'trim', x, lo, 4.19, 0.1, hi - lo, 0.1);
        for (const yy of [lo, hi]) box(g, 'trim', 0, yy, 4.19, 1.3, 0.1, 0.1);
      }
      if (detail >= 2) {
        for (const x of [-0.3, 0, 0.3]) box(g, 'rail', x, lo, 3.9, 0.035, hi - lo, 0.04);
        for (let yy = lo + 0.3; yy < hi; yy += 0.3) box(g, 'rail', 0, yy, 3.9, 1.1, 0.03, 0.04);
        band(g, 'trim', 0.62, hi + 0.04, 0.36, 0.1, 4.22);
      }
    }
  }
  // Projecting stone balcony and corbelled support band.
  box(f, 'trim', 0, 15.7, 0, 8.7, 0.3, 8.7);
  box(f, 'trim', 0, 16.0, 0, 9.4, 0.35, 9.4);
  box(f, 'trim', 0, 16.35, 0, 9.65, 0.2, 9.65);
  if (detail)
    for (let i = 0; i < 4; i++)
      for (let j = 0, n = detail === 1 ? 4 : 8; j < n; j++) {
        const u = -3.8 + (7.6 * j) / (n - 1),
          g = side(i);
        box(g, 'trim', u, 15.2, 4.15, 0.4, 0.55, 0.7);
        if (detail >= 2) box(g, 'trim', u, 14.95, 4.02, 0.28, 0.35, 0.4);
      }
  // Four arched glazed openings have real reveals and closed masonry above them.
  const R = 1.55,
    base = 17.35,
    spring = 23.0,
    rise = 1.6;
  box(f, 'trim', 0, 16.55, 0, 7.0, 0.8, 7.0);
  for (let i = 0; i < 4; i++) {
    const g = side(i);
    for (const sign of [-1, 1]) box(g, 'wall', sign * 2.35, 17.35, 3.12, 1.6, 8.05, 0.46);
    for (let j = 0, n = [4, 6, 12, 20][detail]; j < n; j++) {
      const a = -R + (2 * R * j) / n,
        b = -R + (2 * R * (j + 1)) / n,
        ya = spring + segment(a, R, rise),
        yb = spring + segment(b, R, rise);
      for (const [d, N] of [
        [2.89, -1],
        [3.35, 1],
      ])
        g(
          'wall',
          [
            [a, ya, d],
            [b, yb, d],
            [b, 25.4, d],
            [a, 25.4, d],
          ],
          [0, 0, N],
        );
      g(
        'trim',
        [
          [a, ya, 2.89],
          [b, yb, 2.89],
          [b, yb, 3.35],
          [a, ya, 3.35],
        ],
        [0, -1, 0],
      );
    }
    archPanel(g, 'glass', R, base, spring, rise, 2.94);
    band(g, 'trim', R, spring, rise, 0.18, 3.41);
    for (const x of [-R - 0.09, R + 0.09]) box(g, 'trim', x, base, 3.39, 0.18, spring - base, 0.15);
    if (detail) {
      const offsets = detail === 1 ? [0] : [-0.78, 0, 0.78];
      for (const u of offsets)
        box(g, 'rail', u, base, 3.0, 0.065, spring + segment(u, R, rise) - base, 0.07);
      for (let yy = 18.2, step = detail === 1 ? 1.8 : 0.9; yy < 24.55; yy += step) {
        const half =
          yy <= spring
            ? R
            : R * Math.sqrt(Math.max(0, 1 - ((yy - spring) / rise) * ((yy - spring) / rise)));
        box(g, 'rail', 0, yy, 3.0, half * 2, 0.06, 0.07);
      }
    }
    // Paired free shafts at each corner, eight in all.
    for (const u of [-2.75, 2.75]) {
      const [x, , z] = turn(i, [u, 0, 3.55]);
      cylinder(
        'column',
        x,
        z,
        detail >= 2
          ? [
              [17.0, 0.4],
              [17.2, 0.34],
              [17.45, 0.23],
              [24.5, 0.21],
              [24.7, 0.32],
            ]
          : [
              [17, 0.28],
              [24.7, 0.28],
            ],
        [4, 6, 10, 14][detail],
      );
      if (detail) {
        box(f, 'trim', x, 16.8, z, 0.8, 0.23, 0.8);
        box(f, 'trim', x, 24.7, z, 0.7, 0.5, 0.7);
      }
      if (detail >= 2) {
        cylinder(
          'column',
          x,
          z,
          [
            [24.6, 0.3],
            [24.85, 0.39],
            [25.0, 0.3],
          ],
          8,
        );
        for (const sign of [-1, 1]) box(f, 'trim', x + sign * 0.32, 24.85, z, 0.14, 0.2, 0.6);
      }
    }
    // Modern muted blue-green balcony panels and a shared painted-metal rail.
    if (detail) box(g, 'glass', 0, 16.65, 4.6, 9.0, 0.9, 0.035);
    else
      g(
        'glass',
        [
          [-4.5, 16.65, 4.6],
          [4.5, 16.65, 4.6],
          [4.5, 17.55, 4.6],
          [-4.5, 17.55, 4.6],
        ],
        [0, 0, 1],
      );
    box(g, 'rail', 0, 17.5, 4.6, 9.25, 0.065, 0.07);
    if (detail)
      for (let j = 0, n = detail >= 2 ? 6 : 3; j <= n; j++)
        box(g, 'rail', -4.55 + (9.1 * j) / n, 16.55, 4.6, 0.055, 1.0, 0.07);
  }
  box(f, 'trim', 0, 25.2, 0, 8.1, 0.25, 8.1);
  box(f, 'trim', 0, 25.45, 0, 8.6, 0.2, 8.6);
  // Segmental pediments on all four faces, rather than generic triangular gables.
  for (let i = 0; i < 4; i++) {
    const g = side(i),
      R = 4.3,
      spring = 25.65,
      rise = 2.4;
    archPanel(g, 'wall', R, 25.5, spring, rise, 4.25);
    band(g, 'trim', R, spring, rise, 0.19, 4.34);
    if (detail) band(g, 'trim', R - 0.22, spring + 0.15, rise - 0.27, 0.09, 4.37);
    if (detail >= 2)
      for (let j = 0, n = 12; j < n; j++) {
        const u = -3.9 + (7.8 * j) / (n - 1);
        box(g, 'trim', u, 25.27, 4.15, 0.13, 0.18, 0.24);
      }
  }
  // A closed curved shoulder joins the four pediments beneath the square spire.
  for (let i = 0, n = [4, 6, 12, 20][detail]; i < n; i++)
    for (let j = 0; j < n; j++) {
      const p = [
        [i, j],
        [i + 1, j],
        [i + 1, j + 1],
        [i, j + 1],
      ].map(([a, b]) => {
        const x = -4.25 + (8.5 * a) / n,
          z = -4.25 + (8.5 * b) / n;
        return [x, 25.65 + segment(Math.min(Math.abs(x), Math.abs(z)), 4.3, 2.4), z];
      });
      f('roof', p, [0, 1, 0]);
    }
  // Closed square lead pyramid, with only a few purposeful seams in close levels.
  const ring = [
      [-3.65, 25.9, -3.65],
      [3.65, 25.9, -3.65],
      [3.65, 25.9, 3.65],
      [-3.65, 25.9, 3.65],
    ],
    peak = [0, 36.5, 0];
  for (let i = 0; i < 4; i++)
    f('roof', [ring[i], ring[(i + 1) % 4], peak], [ring[i][0], 1, ring[i][2]]);
  f('roof', ring, [0, -1, 0]);
  if (detail >= 2)
    for (let i = 0; i < 4; i++) {
      bar('roof', ring[i], peak, 0.05);
      for (const t of [0.25, 0.5, 0.75])
        bar(
          'roof',
          ring[i].map((v, k) => v + (peak[k] - v) * t),
          ring[(i + 1) % 4].map((v, k) => v + (peak[k] - v) * t),
          0.035,
        );
    }
  cylinder(
    'gold',
    0,
    0,
    detail
      ? [
          [36.45, 0.13],
          [36.65, 0.23],
          [36.8, 0.1],
          [37.0, 0.18],
          [37.25, 0.08],
          [37.6, 0.04],
          [37.9, 0.01],
        ]
      : [
          [36.45, 0.15],
          [37.9, 0.01],
        ],
    [3, 6, 8, 10][detail],
  );
}
