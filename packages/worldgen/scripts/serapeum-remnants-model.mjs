/** N0523: surviving column and sphinx group at the Serapeum of Alexandria. */
import earcut from 'earcut';
export const serapeumCandidateId = 'N0523';
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
        rr = r * (1 - (flutes ? (0.028 * (1 + Math.cos(a * flutes))) / 2 : 0));
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
function taper(f, role, x, z, y0, y1, w0, d0, w1, d1) {
  const a = rect(x, z, w0, d0).outline.map(([u, v]) => [u, y0, v]),
    b = rect(x, z, w1, d1).outline.map(([u, v]) => [u, y1, v]);
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
}
function ellipsoid(f, role, x, y, z, rx, ry, rz, n, bands) {
  const G = (role, ps, target) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + u * rx, y + v * ry, z + w * rz]),
      [target[0] / rx, target[1] / ry, target[2] / rz],
    );
  lathe(
    G,
    role,
    0,
    0,
    Array.from({ length: bands + 1 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / bands;
      return [Math.sin(a), Math.max(0.005, Math.cos(a))];
    }),
    n,
  );
}
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
function sphinx(f, detail, part) {
  const [x, z] = part.center,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u + x, y * (part.heightScale ?? 1) + part.floorY, v + z]),
        [n[0], n[1] / (part.heightScale ?? 1), n[2]],
      ),
    n = [6, 8, 12, 18][detail],
    bands = [3, 4, 6, 8][detail];
  // Restored pale, tapering plinth; original rough block remains distinct above it.
  taper(
    G,
    'limestone',
    0,
    0,
    (part.foundationBase - part.floorY) / (part.heightScale ?? 1),
    1.45,
    3.3,
    4.7,
    2.7,
    4.1,
  );
  B(G, 'limestone', 0, 1.45, 0, 3.4, 0.18, 4.8);
  if (detail >= 1) B(G, 'limestone', 0, 1.63, 0, 3.15, 0.2, 4.45);
  B(G, 'limestone', 0, detail === 0 ? 1.63 : 1.83, 0, 2.95, detail === 0 ? 0.4 : 0.2, 4.15);
  B(G, 'statue', 0, 2.03, 0, 2.1, 0.35, 3.35);
  // Picture-led crouching mass. The hidden back and animal anatomy are simplified.
  ellipsoid(G, 'statue', 0, 2.86, -0.55, 0.83, 0.65, 1.15, n, bands);
  taper(G, 'statue', 0, 0.3, 2.35, 3.8, 1.6, 1.15, 0.78, 0.65);
  for (const u of [-0.5, 0.5]) ellipsoid(G, 'statue', u, 2.58, 1.14, 0.34, 0.25, 0.66, n, bands);
  ellipsoid(G, 'statue', 0, 4.05, 0.44, 0.48, 0.67, 0.39, n, bands);
  for (const side of [-1, 1]) {
    const p = [
        [side * 0.42, 4.49, 0.25],
        [side * 0.58, 4.28, 0.37],
        [side * 0.79, 3.22, 0.66],
        [side * 0.4, 3.32, 0.91],
        [side * 0.36, 3.88, 0.78],
      ],
      back = p.map(([u, y, v]) => [u, y, v - 0.31]);
    G('statue', p, [side * 0.25, 0, 1]);
    G('statue', back, [0, 0, -1]);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      G('statue', [p[i], p[j], back[j], back[i]], [side, 0.1, 0]);
    }
  }
  if (detail >= 1) {
    // Worn forehead/nose/chin masses; no photographic face or exact hieroglyphs.
    const nose = [
      [-0.11, 4.22, 0.74],
      [0.11, 4.22, 0.74],
      [0.13, 3.96, 0.83],
      [0, 3.99, 1.01],
      [-0.13, 3.96, 0.83],
    ];
    for (let i = 0; i < nose.length; i++) {
      const j = (i + 1) % nose.length;
      G('statue', [nose[i], nose[j], [0, 4.1, 0.79]], [0, 0, 1]);
    }
    ellipsoid(G, 'statue', 0, 3.84, 0.75, 0.24, 0.1, 0.1, n, 3);
    B(G, 'statue', 0, 4.59, 0.58, 0.13, 0.2, 0.12);
  }
  if (detail >= 2) {
    for (const side of [-1, 1]) {
      G(
        'incision',
        [
          [side * 0.13, 4.21, 0.765],
          [side * 0.35, 4.2, 0.69],
          [side * 0.3, 4.25, 0.712],
        ],
        [0, 0, 1],
      );
    }
    G(
      'incision',
      [
        [-0.19, 3.84, 0.851],
        [0.19, 3.84, 0.851],
        [0.14, 3.82, 0.856],
        [-0.14, 3.82, 0.856],
      ],
      [0, 0, 1],
    );
  }
}
export function buildSerapeumRemnants(face, detail, r) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    part = r.column,
    Y = part.floorY,
    G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [u, Y + y, v]),
        n,
      ),
    n = [8, 12, 24, 40][detail];
  B(G, 'limestone', 0, part.foundationBase - Y, 0, 4.9, Y - part.foundationBase + 0.25, 4.9);
  B(G, 'column', 0, 0.25, 0, 4.35, 1.05, 4.35);
  B(G, 'column', 0, 1.3, 0, 4.6, 0.24, 4.6);
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [1.54, 1.5],
          [2.4, 1.3],
          [24.05, 1.05],
        ]
      : [
          [1.54, 1.43],
          [1.66, 1.58],
          [1.87, 1.58],
          [2.05, 1.38],
          [2.3, 1.31],
          [9, 1.29],
          [17.5, 1.18],
          [24.05, 1.05],
        ],
    n,
  );
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [24.05, 1.05],
          [26.75, 1.6],
        ]
      : [
          [24.05, 1.05],
          [24.25, 1.12],
          [24.4, 1.06],
          [25.15, 1.13],
          [26.3, 1.52],
          [26.75, 1.6],
        ],
    n,
  );
  for (let k = 0; k < 8; k++) {
    acanthus(G, (k * Math.PI) / 4, 24.3, detail);
    if (detail >= 1) acanthus(G, (k * Math.PI) / 4 + Math.PI / 8, 25.05, detail);
  }
  const square =
    detail === 0
      ? rect(0, 0, 3.55, 3.55)
      : {
          outline: [
            [-1.77, -1.77],
            [-0.8, -1.49],
            [0, -1.35],
            [0.8, -1.49],
            [1.77, -1.77],
            [1.49, -0.8],
            [1.35, 0],
            [1.49, 0.8],
            [1.77, 1.77],
            [0.8, 1.49],
            [0, 1.35],
            [-0.8, 1.49],
            [-1.77, 1.77],
            [-1.49, 0.8],
            [-1.35, 0],
            [-1.49, -0.8],
          ],
          holes: [],
        };
  prism(G, 'column', square, 26.72, 27.0);
  if (detail >= 2)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        co = Math.cos(a),
        si = Math.sin(a),
        points = Array.from({ length: detail === 3 ? 12 : 7 }, (_, j) => {
          const t = j / (detail === 3 ? 11 : 6),
            theta = t * Math.PI * 2.4,
            rr = 0.34 * (1 - t) + 0.035;
          return [
            1.35 * co + rr * Math.cos(theta) * -si,
            26.3 + rr * Math.sin(theta),
            1.35 * si + rr * Math.cos(theta) * co,
          ];
        });
      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i],
          q = points[i + 1],
          w = 0.055;
        G(
          'column',
          [
            [p[0] - co * w, p[1], p[2] - si * w],
            [p[0] + co * w, p[1], p[2] + si * w],
            [q[0] + co * w, q[1], q[2] + si * w],
            [q[0] - co * w, q[1], q[2] - si * w],
          ],
          [co, 0, si],
        );
      }
    }
  for (const p of r.sphinxes) sphinx(f, detail, p);
}
