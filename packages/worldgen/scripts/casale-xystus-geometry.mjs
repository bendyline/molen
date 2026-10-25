/** 'casale_xystus': mapped covered rooms beside a genuinely unroofed oval ruin court. */
import './install-deterministic-math.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildCasaleXystus(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d),
    Y = r.floorY,
    E = Y + r.eave,
    outline = r.floors[0].outline;
  prism(f, 'stone', r.floors[0], r.foundationY, Y);
  if (detail) prism(f, 'floor', r.floors[0], Y, Y + 0.025);
  const area = (p) =>
      p.reduce(
        (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
        0,
      ),
    sgn = Math.sign(area(outline));
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      n = [(dz * sgn) / len, 0, (-dx * sgn) / len],
      ts = [0, 1];
    if (Math.abs(a[1] - r.entry.center[1]) < 0.002 && Math.abs(b[1] - r.entry.center[1]) < 0.002)
      for (const x of [-r.entry.width / 2, r.entry.width / 2]) {
        const t = (x - a[0]) / dx;
        if (t > 0 && t < 1) ts.push(t);
      }
    ts.sort((a, b) => a - b);
    for (let j = 1; j < ts.length; j++) {
      const p = a.map((v, k) => v + (b[k] - v) * ts[j - 1]),
        q = a.map((v, k) => v + (b[k] - v) * ts[j]),
        entry =
          Math.abs(p[1] - r.entry.center[1]) < 0.002 &&
          Math.abs((p[0] + q[0]) / 2) < r.entry.width / 2 - 0.001,
        panel = (role, lo, hi) =>
          f(
            role,
            [
              [p[0], lo, p[1]],
              [q[0], lo, q[1]],
              [q[0], hi, q[1]],
              [p[0], hi, p[1]],
            ],
            n,
          );
      if (!detail) {
        panel('wall', Y, E);
        continue;
      }
      if (entry) panel('wall', Y + r.entry.height, E);
      else {
        panel('stone', Y, Y + 0.8);
        panel('wall', Y + 0.8, E);
      }
      if (detail > 1 && !entry && Math.hypot(q[0] - p[0], q[1] - p[1]) > 2.5) {
        const count = Math.max(1, Math.floor(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3));
        for (let k = 0; k < count; k++) {
          const t = (k + 0.5) / count,
            x = p[0] + (q[0] - p[0]) * t,
            z = p[1] + (q[1] - p[1]) * t,
            u = [dx / len, dz / len];
          f(
            'glass',
            [
              [-0.55, 0],
              [0.55, 0],
              [0.55, 0.65],
              [-0.55, 0.65],
            ].map(([w, h]) => [
              x + u[0] * w + n[0] * 0.014,
              Y + 1.6 + h,
              z + u[1] * w + n[2] * 0.014,
            ]),
            n,
          );
        }
      }
    }
  }
  const left = (outline[0][0] + outline[1][0]) / 2,
    right = (outline[2][0] + outline[3][0]) / 2,
    front = r.entry.center[1],
    back = Math.min(...outline.map((p) => p[1])),
    ridge = Y + r.ridge;
  for (const [a, b] of [
    [front, 0],
    [0, back],
  ]) {
    const ya = a === 0 ? ridge : E,
      yb = b === 0 ? ridge : E,
      roof = [
        [left, ya, a],
        [right, ya, a],
        [right, yb, b],
        [left, yb, b],
      ];
    f('roof', roof, [0, 1, 0]);
    if (detail) {
      f(
        'roof',
        roof.map((p) => [p[0], p[1] - 0.12, p[2]]),
        [0, -1, 0],
      );
      for (const x of [left, right])
        f(
          'roof',
          [
            [x, ya - 0.12, a],
            [x, yb - 0.12, b],
            [x, yb, b],
            [x, ya, a],
          ],
          [Math.sign(x), 0, 0],
        );
    }
  }
  for (const x of [left, right])
    f(
      'wall',
      [
        [x, E, back],
        [x, E, front],
        [x, ridge, 0],
      ],
      [Math.sign(x), 0, 0],
    );
  if (detail) {
    for (const z of [front, back]) {
      B('wood', 0, E - 0.15, z, 14.98, 0.14, 0.15);
      f(
        'roof',
        [
          [left, E - 0.12, z],
          [right, E - 0.12, z],
          [right, E, z],
          [left, E, z],
        ],
        [0, 0, Math.sign(z)],
      );
    }
    for (const x of [-6, -3, 3, 6]) B('wood', x, Y + 0.8, front + 0.018, 0.13, r.eave - 0.8, 0.12);
    const e = r.entry,
      z = e.center[1],
      rear = z - e.depth,
      x0 = -e.width / 2,
      x1 = e.width / 2;
    f(
      'glass',
      [
        [x0, Y + 0.025, rear],
        [x1, Y + 0.025, rear],
        [x1, Y + e.height, rear],
        [x0, Y + e.height, rear],
      ],
      [0, 0, 1],
    );
    f(
      'wall',
      [
        [x0, Y, z],
        [x0, Y, rear],
        [x0, Y + e.height, rear],
        [x0, Y + e.height, z],
      ],
      [1, 0, 0],
    );
    f(
      'wall',
      [
        [x1, Y, rear],
        [x1, Y, z],
        [x1, Y + e.height, z],
        [x1, Y + e.height, rear],
      ],
      [-1, 0, 0],
    );
    f(
      'wall',
      [
        [x0, Y + e.height, z],
        [x0, Y + e.height, rear],
        [x1, Y + e.height, rear],
        [x1, Y + e.height, z],
      ],
      [0, -1, 0],
    );
    B('stone', 0, Y, (z + rear) / 2, e.width, 0.06, e.depth);
    for (const x of [x0, x1]) B('wood', x, Y, z + 0.025, 0.14, e.height + 0.12, 0.15);
    B('wood', 0, Y + e.height, z + 0.025, e.width + 0.14, 0.12, 0.15);
  }
  // Low surviving walls are individually grounded; no slab fills the courtyard.
  for (const wall of r.wallSegments) {
    const p = wall.outline,
      low = p.map((q, i) => [q[0], wall.base[i], q[1]]),
      high = p.map((q, i) => [q[0], wall.top[i], q[1]]),
      s = Math.sign(area(p));
    f('stone', low, [0, -1, 0]);
    f('stone', high, [0, 1, 0]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'stone',
        [low[i], low[j], high[j], high[i]],
        [(p[j][1] - p[i][1]) * s, 0, (p[i][0] - p[j][0]) * s],
      );
    }
  }
  for (const c of r.columns) {
    const [x, z] = c.point,
      base = c.base;
    prism(f, 'stone', { outline: c.pad, holes: [] }, base - 0.15, base + 0.08);
    const sides = detail === 0 ? 4 : detail === 1 ? 6 : detail === 2 ? 8 : 12,
      profile =
        detail === 0
          ? [
              [0.08, 0.32],
              [c.height, 0.25],
            ]
          : detail === 1
            ? [
                [0.08, 0.35],
                [0.18, 0.35],
                [Math.max(0.2, c.height - 0.1), 0.24],
                [c.height, 0.27],
              ]
            : detail === 2
              ? [
                  [0.08, 0.37],
                  [0.17, 0.37],
                  [0.23, 0.28],
                  [Math.max(0.24, c.height - 0.09), 0.25],
                  [c.height, 0.28],
                ]
              : [
                  [0.08, 0.39],
                  [0.14, 0.39],
                  [0.18, 0.34],
                  [0.24, 0.29],
                  [Math.max(0.25, c.height - 0.08), 0.25],
                  [c.height, 0.28],
                ];
    const rings = profile.map(([y, radius], j) =>
      Array.from({ length: sides }, (_, i) => {
        const t = (i * 2 * Math.PI) / sides,
          broken = detail === 3 && j === profile.length - 1 ? 0.012 * Math.sin(i * 2.1) : 0.0;
        return [x + radius * Math.cos(t), base + y + broken, z + radius * Math.sin(t)];
      }),
    );
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < sides; i++) {
        const k = (i + 1) % sides;
        f(
          'column',
          [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
          [
            Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
            0,
            Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
          ],
        );
      }
    const top = rings.at(-1);
    for (let i = 1; i < top.length - 1; i++) f('column', [top[0], top[i], top[i + 1]], [0, 1, 0]);
  }
}
