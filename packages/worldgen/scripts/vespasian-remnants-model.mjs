/** N0525: surviving fluted Corinthian corner of Vespasian and Titus. */
import earcut from 'earcut';
export const vespasianCandidateId = 'N0525';
function prism(f, role, p, lo, hi) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.065 * (1 + Math.cos(a * flutes))) / 2 : 0));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
const B = (f, role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h);
function acanthus(f, angle, y, detail) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    shape = [
      [-0.22, 0, 1.03],
      [0.22, 0, 1.03],
      [-0.37, 0.55, 1.45],
      [0.37, 0.55, 1.45],
      [0, 1.15, 1.7],
      [0, 0.7, 1.57],
    ],
    p = shape.map(([u, v, r]) => [c * r - s * u, y + v, s * r + c * u]);
  for (const ix of detail === 0
    ? [
        [0, 1, 4],
        [0, 4, 2],
        [1, 3, 4],
      ]
    : [
        [0, 1, 5],
        [1, 3, 5],
        [3, 4, 5],
        [4, 2, 5],
        [2, 0, 5],
        [0, 2, 4, 3, 1],
      ])
    f(
      'column',
      ix.map((i) => p[i]),
      [c, 0.25, s],
    );
}
function column(f, x, z, detail, Y) {
  const G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + u, Y + y, z + v]),
        n,
      ),
    n = [8, 16, 24, 32][detail];
  B(G, 'column', 0, 0, 0, 2.3, 0.22, 2.3);
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [0.22, 0.97],
          [0.7, 0.8],
        ]
      : [
          [0.22, 0.93],
          [0.3, 1.04],
          [0.4, 1.04],
          [0.48, 0.88],
          [0.58, 0.86],
          [0.65, 0.96],
          [0.74, 0.8],
        ],
    n,
  );
  const shaft =
    detail === 0
      ? [
          [0.7, 0.785],
          [13.2, 0.66],
        ]
      : detail === 1
        ? [
            [0.74, 0.785],
            [5, 0.79],
            [10, 0.73],
            [13.2, 0.66],
          ]
        : [
            [0.74, 0.785],
            [0.86, 0.79],
            [3.5, 0.8],
            [7, 0.77],
            [10.8, 0.71],
            [13.2, 0.66],
          ];
  lathe(
    G,
    'column',
    0,
    0,
    shaft,
    [8, 24, 72, 96][detail],
    detail === 0 ? 0 : detail === 1 ? 12 : 24,
  );
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [13.2, 0.67],
          [15.03, 1.08],
        ]
      : [
          [13.2, 0.67],
          [13.35, 0.76],
          [13.5, 0.7],
          [14.25, 0.79],
          [14.88, 1.08],
          [15.03, 1.08],
        ],
    n,
  );
  if (detail >= 1)
    for (const upper of [false, true])
      for (let k = 0; k < 8; k++)
        acanthus(
          (role, ps, target) =>
            G(
              role,
              ps.map(([u, y, v]) => [u * 0.66, 13.32 + (upper ? 0.58 : 0) + y * 0.7, v * 0.66]),
              [target[0] / 0.66, target[1] / 0.7, target[2] / 0.66],
            ),
          (k * Math.PI) / 4 + (upper ? Math.PI / 8 : 0),
          0,
          detail,
        );
  const cap =
    detail <= 1
      ? rect(0, 0, 2.6, 2.6)
      : {
          outline: [
            [-1.3, -1.3],
            [0, -1.0],
            [1.3, -1.3],
            [1.0, 0],
            [1.3, 1.3],
            [0, 1.0],
            [-1.3, 1.3],
            [-1.0, 0],
          ],
          holes: [],
        };
  prism(G, 'column', cap, 15.02, 15.2);
  if (detail >= 2)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        c = Math.cos(a),
        s = Math.sin(a),
        count = detail === 3 ? 10 : 6,
        ps = Array.from({ length: count }, (_, j) => {
          const t = j / (count - 1),
            theta = t * Math.PI * 2.1,
            r = 0.24 * (1 - t) + 0.025;
          return [
            1.01 * c - r * Math.cos(theta) * s,
            14.86 + r * Math.sin(theta),
            1.01 * s + r * Math.cos(theta) * c,
          ];
        });
      for (let j = 0; j < ps.length - 1; j++) {
        const a = ps[j],
          b = ps[j + 1];
        G(
          'column',
          [
            [a[0], a[1] - 0.025, a[2]],
            [b[0], b[1] - 0.025, b[2]],
            [b[0], b[1] + 0.025, b[2]],
            [a[0], a[1] + 0.025, a[2]],
          ],
          [c, 0, s],
        );
      }
    }
}
const L = (width, extension = 0.5) => ({
  outline: [
    [8.95 - extension, 9.3 - width / 2],
    [12.55 - width / 2, 9.3 - width / 2],
    [12.55 - width / 2, 5.7 - extension],
    [12.55 + width / 2, 5.7 - extension],
    [12.55 + width / 2, 9.3 + width / 2],
    [8.95 - extension, 9.3 + width / 2],
  ],
  holes: [],
});
function entablature(f, detail, Y) {
  const G = (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [x, Y + y, z]),
      n,
    );
  for (const [y, h, w] of detail === 0
    ? [
        [15.2, 0.7, 1.7],
        [15.9, 0.8, 1.9],
        [16.7, 0.3, 2.3],
      ]
    : [
        [15.2, 0.22, 1.65],
        [15.42, 0.22, 1.8],
        [15.64, 0.23, 1.96],
        [15.87, 0.68, 1.98],
        [16.55, 0.18, 2.24],
        [16.73, 0.23, 2.45],
        [16.96, 0.12, 2.6],
      ])
    prism(G, 'column', L(w), y, y + h);
  // The taller core survives as rough discontinuous masses above the dressed band.
  const top = {
    outline: [
      [8.25, 8.55],
      [11.75, 8.55],
      [11.75, 5.1],
      [13.35, 5.1],
      [13.35, 10.05],
      [8.25, 10.05],
    ],
    holes: [],
  };
  prism(
    (role, ps, n) =>
      G(
        role,
        ps.map(([x, y, z]) => [x, y + (y > 17.1 ? 0.15 * Math.sin(x * 2.1 + z * 1.7) : 0), z]),
        n,
      ),
    'core',
    top,
    17.08,
    17.8,
  );
  if (detail >= 2) {
    for (let k = 0; k < 10; k++) {
      const x = 8.65 + k * 0.48,
        z = 5.4 + k * 0.48;
      B(G, 'column', x, 16.48, 10.36, 0.2, 0.22, 0.26);
      B(G, 'column', 13.61, 16.48, z, 0.26, 0.22, 0.2);
    }
    // Chunky sacrificial/frieze relief rhythms; fine historic carvings are not reproduced.
    for (const x of [9.2, 10.7, 12.1]) {
      B(G, 'column', x, 16.02, 10.31, 0.24, 0.34, 0.12);
      for (const side of [-1, 1])
        G(
          'column',
          [
            [x, 16.31, 10.4],
            [x + side * 0.28, 16.45, 10.42],
            [x + side * 0.19, 16.21, 10.43],
          ],
          [0, 0, 1],
        );
    }
    for (const z of [6.0, 7.25, 8.5]) B(G, 'column', 13.57, 16.02, z, 0.12, 0.3, 0.2);
  }
}
export function buildVespasianRemnants(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    pose = ([u, v]) => [c * u - s * v, s * u + c * v],
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    grade = (u, v) => sampleTerrain(...pose([u, v])),
    ground = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, grade(u, v) + y, v]),
        n,
      );
  // Only retained mapped remnant footprints are extruded, never the whole temple site.
  for (const part of r.fragments)
    for (const p of part.polygons) prism(ground, 'core', p, -0.65, part.height);
  const corner = r.controls.find((q) => q.id === r.mainCornerId);
  for (const p of corner.localPolygons) prism(f, 'core', p, r.foundationBase, r.floorY);
  for (const [x, z] of r.columns) {
    B(f, 'core', x, r.foundationBase, z, 2.4, r.floorY - r.foundationBase, 2.4);
    column(f, x, z, detail, r.floorY);
  }
  entablature(f, detail, r.floorY);
}
