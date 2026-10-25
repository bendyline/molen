/** Castro Theatre: mapped concrete shell, Spanish Colonial facade, arcade and1937signage. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
function transform(o, a, x = 0, z = 0) {
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
function poly(o, slot, ps, y0, y1, col) {
  const p = ps.map((v) => v.slice());
  if (
    p.reduce(
      (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
      0,
    ) < 0
  )
    p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(p.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const ps = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
      if (normalFor(...ps)[1] * n[1] < 0) ps.reverse();
      o.addTriangle(
        slot,
        ref,
        ps,
        n,
        ps.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'stone') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9q/9q8/castro_theatre/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  terrain = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/9q/9q8/castro_theatre/terrain-grid.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  white = rgb('e4dfce'),
  buff = rgb('cbc3b1'),
  pink = rgb('d4c8bc'),
  gold = rgb('c4a36b'),
  concrete = rgb('cac8bd'),
  roofgrey = rgb('777b71'),
  red = rgb('a83334'),
  blue = rgb('3478a6'),
  dark = rgb('383a36'),
  glass = rgb('62716c'),
  wood = rgb('69503b'),
  tile = rgb('9f5d43'),
  bulb = rgb('f5d4a0'),
  W = 30.28882;
function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b -
    terrain.modelDatumElevationMeters
  );
}
function flat(o, slot, ps, col, n = [0, 0, 1], holes = []) {
  const p = [...ps, ...holes.flat()],
    starts = holes.map((_, i) => ps.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0)),
    idx = earcut(
      p.flatMap((v) => [v[0], v[1]]),
      starts,
    );
  for (let i = 0; i < idx.length; i += 3) {
    const q = idx.slice(i, i + 3).map((j) => p[j]);
    if (normalFor(...q).reduce((s, v, k) => s + v * n[k], 0) < 0) q.reverse();
    o.addTriangle(
      slot,
      ref,
      q,
      n,
      q.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function panel(o, slot, ps, z0, z1, col) {
  flat(
    o,
    slot,
    ps.map((p) => [...p, z1]),
    col,
  );
  flat(
    o,
    slot,
    ps.map((p) => [...p, z0]),
    col,
    [0, 0, -1],
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      q = [
        [...a, z0],
        [...b, z0],
        [...b, z1],
        [...a, z1],
      ];
    quad(o, slot, q, normalFor(...q), col);
  }
}
function line(o, d, ps, z, col = white, w = 0.06, slot = 'trim', closed = false) {
  for (let i = 1; i < ps.length + (closed ? 1 : 0); i++) {
    const a = ps[i - 1],
      b = ps[i % ps.length];
    rod(o, d, slot, [...a, z], [...b, z], w, col);
  }
}
function ellipse(x, y, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    x + rx * Math.cos((i * Math.PI * 2) / n),
    y + ry * Math.sin((i * Math.PI * 2) / n),
  ]);
}
function curve(ps, n) {
  const result = [];
  for (let i = 0; i < ps.length - 1; i++)
    for (let j = 0; j < n; j++) {
      const a = ps[Math.max(0, i - 1)],
        b = ps[i],
        c = ps[i + 1],
        e = ps[Math.min(ps.length - 1, i + 2)],
        t = j / n;
      result.push(
        [0, 1].map(
          (k) =>
            0.5 *
            (2 * b[k] +
              (-a[k] + c[k]) * t +
              (2 * a[k] - 5 * b[k] + 4 * c[k] - e[k]) * t * t +
              (-a[k] + 3 * b[k] - 3 * c[k] + e[k]) * t * t * t),
        ),
      );
    }
  return [...result, ps.at(-1)];
}
function arch(x, y, w, h, n) {
  const r = w / 2;
  return [
    [x - r, y],
    [x + r, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + r * Math.cos(a), y + h - r + r * Math.sin(a)];
    }),
  ];
}
function recess(o, d, ps, { col = glass, depth = 0.36, grid = false } = {}) {
  flat(
    o,
    col === glass ? 'glass' : 'trim',
    ps.map((p) => [...p, -depth]),
    col,
  );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      q = [
        [...a, 0],
        [...b, 0],
        [...b, -depth],
        [...a, -depth],
      ];
    quad(o, 'trim', q, normalFor(...q), buff);
  }
  if (d > 0) line(o, 1, ps, 0.045, white, 0.1, 'trim', true);
  if (grid && d > 0) {
    const y0 = Math.min(...ps.map((p) => p[1])),
      y1 = Math.max(...ps.map((p) => p[1]));
    // Intersections with the actual curved contour keep every mullion within its opening.
    const crossing = (value, axis) => {
      const r = [];
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i],
          b = ps[(i + 1) % ps.length];
        if ((a[axis] <= value && b[axis] > value) || (b[axis] <= value && a[axis] > value)) {
          const t = (value - a[axis]) / (b[axis] - a[axis]);
          r.push(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]));
        }
      }
      return r.sort((a, b) => a - b);
    };
    const x0 = Math.min(...ps.map((p) => p[0])),
      x1 = Math.max(...ps.map((p) => p[0])),
      pitch = d === 1 ? 0.9 : d === 2 ? 0.55 : 0.44;
    for (let x = x0 + pitch; x < x1 - 0.1; x += pitch) {
      const c = crossing(x, 0);
      if (c.length > 1)
        line(
          o,
          1,
          [
            [x, c[0]],
            [x, c.at(-1)],
          ],
          -depth + 0.035,
          gold,
          d === 1 ? 0.06 : 0.045,
          'wood',
        );
    }
    for (let y = y0 + pitch; y < y1 - 0.15; y += pitch) {
      const c = crossing(y, 1);
      if (c.length > 1)
        line(
          o,
          1,
          [
            [c[0], y],
            [c.at(-1), y],
          ],
          -depth + 0.04,
          gold,
          0.045,
          'wood',
        );
    }
    if (y1 - y0 > 5)
      for (const y of [5.8, 11.1]) {
        const c = crossing(y, 1);
        if (c.length > 1)
          line(
            o,
            2,
            [
              [c[0], y],
              [c.at(-1), y],
            ],
            -depth + 0.065,
            gold,
            0.13,
            'wood',
          );
      }
  }
}
const profile = [
    [-15.14441, 17],
    [-7.6, 17],
    [-6.4, 17.04],
    [-5.3, 17.4],
    [-4.4, 18.15],
    [-4.55, 18.75],
    [-4.8, 19.0],
    [-4.2, 19.45],
    [-3.35, 19.25],
    [-2.65, 19.5],
    [-2.15, 20.25],
    [-1.55, 20.12],
    [-0.8, 20.48],
    [0, 20.6],
  ],
  mainWindow = (n) => [
    [-3.25, 4.4],
    [3.25, 4.4],
    [3.25, 11.25],
    [2.65, 11.7],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [2.65 * Math.cos(a), 12.1 + 2.65 * Math.sin(a)];
    }),
    [-2.65, 11.7],
    [-3.25, 11.25],
  ];
function shell(o, d) {
  const { frontOutline: f, rearOutline: r } = frame.authoredComponents,
    p = [f[0], f[2], f[3], r[1], r[2], r[3], r[0], f[4]];
  poly(o, 'wall', p, -5, -3, concrete);
  for (let i = 1; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = [a[1] - b[1], 0, b[0] - a[0]];
    // Native body ring is clockwise here, so its outward normal points to the left of each edge.
    quad(
      o,
      'wall',
      [
        [a[0], -3, a[1]],
        [b[0], -3, b[1]],
        [b[0], 16.65, b[1]],
        [a[0], 16.65, a[1]],
      ],
      n,
      concrete,
    );
  }
  const ids = earcut(p.flat()),
    yy = (x) => 16.65 + (d === 0 ? 0 : 0.45 * (1 - (x / 15.4) * (x / 15.4)));
  // A shallow roof crown/falls is visible in the2016elevated image; no barrel-vault substitution.
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((j) => [p[j][0], yy(p[j][0]), p[j][1]]);
    if (normalFor(...q)[1] < 0) q.reverse();
    o.addTriangle(
      'roof',
      ref,
      q,
      normalFor(...q),
      q.map((p) => [p[0], p[2]]),
      roofgrey,
    );
  }
  if (d > 0) {
    for (const s of [-1, 1]) {
      for (const z of [-0.9, -6.6, -12.6, -18.2]) {
        const x = s * 15.1;
        B(o, 'wall', x, -3, z, 0.28, 20.1, 0.44, concrete);
        B(o, 'trim', x, 16.75, z, 0.95, 0.15, 0.95, buff);
        const low = [
            [-0.45, -0.45],
            [0.45, -0.45],
            [0.45, 0.45],
            [-0.45, 0.45],
          ],
          high = low.map((p) => p.map((v) => v * 0.35));
        for (let k = 0; k < 4; k++) {
          const j = (k + 1) % 4,
            q = [
              [x + low[k][0], 16.9, z + low[k][1]],
              [x + low[j][0], 16.9, z + low[j][1]],
              [x + high[j][0], 17.6, z + high[j][1]],
              [x + high[k][0], 17.6, z + high[k][1]],
            ];
          quad(o, 'trim', q, normalFor(...q), buff);
        }
        B(o, 'trim', x, 17.6, z, 0.33, 0.12, 0.33, buff);
      }
      B(o, 'trim', s * 15.12, 15.9, -9.4, 0.33, 0.12, 18.4, buff);
    }
    for (const [x, z] of [
      [-6, -30],
      [7, -39],
    ])
      B(o, 'metal', x, 16.8, z, 0.55, 0.35, 0.55, dark);
    if (d > 0) {
      B(o, 'metal', -10.6, 16.8, -7, 2.5, 1.25, 3.6, dark);
      for (const x of [-11.8, -10.6, -9.4]) B(o, 'metal', x, 18.05, -7, 0.16, 1.1, 0.45, buff);
    }
  }
}
function relief(o, d, x, y, w, h) {
  if (d === 0) return;
  const n = d === 1 ? 8 : d === 2 ? 12 : 20;
  const ps = ellipse(x, y, w / 2, h / 2, n);
  if (d > 1) panel(o, 'trim', ps, 0.23, 0.31, white);
  line(o, d === 3 ? 3 : 1, ps, 0.36, white, 0.1, 'trim', true);
  if (d > 1) {
    line(o, 1, ellipse(x, y, w * 0.38, h * 0.36, n), 0.375, buff, 0.045, 'trim', true);
    for (const s of [-1, 1]) {
      const a = curve(
        [
          [x + s * w * 0.2, y - h * 0.58],
          [x + s * w * 0.52, y - h * 0.38],
          [x + s * w * 0.61, y],
          [x + s * w * 0.5, y + h * 0.4],
          [x + s * w * 0.3, y + h * 0.56],
        ],
        d === 3 ? 5 : 2,
      );
      line(o, d === 3 ? 3 : 1, a, 0.35, white, 0.09, 'trim');
      if (d === 3)
        for (let j = 0; j < 6; j++) {
          const t = j / 5,
            p = a[Math.round(t * (a.length - 1))];
          sphere(o, 'trim', [p[0], p[1], 0.4], [0.16, 0.1, 0.075], white, 6, 4);
        }
    }
  }
}
function facade(o, d) {
  const top = curve(
      [
        ...profile,
        ...profile
          .slice(0, -1)
          .reverse()
          .map(([x, y]) => [-x, y]),
      ],
      d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 7,
    ),
    ps = [[-W / 2, 3.2], [W / 2, 3.2], ...top.reverse()],
    win = mainWindow(d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 20 : 36),
    niche = arch(0, 15.35, 2.1, 2.95, d === 0 ? 4 : d === 1 ? 8 : 16),
    oval = ellipse(0, 19.0, 0.64, 0.82, d === 0 ? 8 : d === 1 ? 12 : 24),
    sides = [-12.15, 12.15].map((x) => [
      [x - 0.86, 4.65],
      [x + 0.86, 4.65],
      [x + 0.86, 8.1],
      [x - 0.86, 8.1],
    ]),
    holes = [win, niche, oval, ...sides];
  flat(
    o,
    'trim',
    ps.map((p) => [...p, 0]),
    white,
    [0, 0, 1],
    holes.map((r) => r.map((p) => [...p, 0])),
  );
  // The raised scroll parapet has a genuine back and thickness above the roof.
  const upper = top.filter((p) => p[1] >= 17);
  flat(
    o,
    'trim',
    [[-W / 2, 16.5, -0.75], [W / 2, 16.5, -0.75], ...upper.map((p) => [...p, -0.75])],
    buff,
    [0, 0, -1],
  );
  for (let i = 1; i < top.length; i++) {
    const a = top[i - 1],
      b = top[i],
      q = [
        [...a, 0],
        [...b, 0],
        [...b, -0.75],
        [...a, -0.75],
      ];
    quad(o, 'trim', q, normalFor(...q), buff);
  }
  if (d > 0) line(o, 1, top, 0.05, buff, 0.2, 'trim');
  recess(o, d, win, { grid: true });
  recess(o, d, niche, { col: buff, depth: 0.55 });
  recess(o, d, oval, { col: buff, depth: 0.12 });
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -12.15 : 12.15;
    recess(o, d, sides[i], { grid: true, depth: 0.24 });
    if (d > 0) {
      B(o, 'trim', x, 4.53, 0.12, 2.45, 0.18, 0.55, buff);
      line(
        o,
        1,
        [
          [x - 1.18, 4.7],
          [x - 1.18, 8.5],
          [x - 0.76, 8.58],
          [x - 0.45, 8.98],
          [x, 9.12],
          [x + 0.45, 8.98],
          [x + 0.76, 8.58],
          [x + 1.18, 8.5],
          [x + 1.18, 4.7],
        ],
        0.15,
        white,
        0.16,
        'trim',
      );
      B(o, 'metal', x, 4.7, 0.35, 2.1, 0.06, 0.08, gold);
      B(o, 'metal', x, 5.45, 0.35, 2.1, 0.06, 0.08, gold);
      for (let j = 0; j < (d === 1 ? 6 : 13); j++)
        rod(
          o,
          1,
          'metal',
          [x - 0.96 + (j * 1.92) / (d === 1 ? 5 : 12), 4.7, 0.35],
          [x - 0.96 + (j * 1.92) / (d === 1 ? 5 : 12), 5.45, 0.35],
          0.03,
          gold,
        );
      // Broad blind upper panel stays plain; ornament remains confined to its border/header.
      flat(
        o,
        'trim',
        [
          [x - 2.6, 4.45, 0.015],
          [x + 2.6, 4.45, 0.015],
          [x + 2.6, 15.8, 0.015],
          [x - 2.6, 15.8, 0.015],
        ],
        pink,
        [0, 0, 1],
        [sides[i].map((p) => [...p, 0.015])],
      );
      line(
        o,
        1,
        [
          [x - 2.7, 4.4],
          [x + 2.7, 4.4],
          [x + 2.7, 15.9],
          [x - 2.7, 15.9],
        ],
        0.07,
        white,
        0.1,
        'trim',
        true,
      );
      relief(o, d, x, 16.35, 2.5, 0.7);
    }
  }
  if (d > 0) {
    for (const s of [-1, 1]) {
      B(o, 'trim', s * 4.1, 4.3, 0.08, 0.43, 14.6, 0.24, white);
      for (const y of [5.35, 8.5, 11.8, 15.1]) {
        relief(o, d, s * 4.1, y, 1.3, 0.9);
        if (d > 1) {
          // Original abstract foliage/garland rhythm; source sculptural artwork is not traced.
          const a = curve(
            [
              [s * 4.1 - 0.59, y - 0.7],
              [s * 4.1 - 0.45, y - 1.08],
              [s * 4.1, y - 1.3],
              [s * 4.1 + 0.45, y - 1.08],
              [s * 4.1 + 0.59, y - 0.7],
            ],
            d === 3 ? 7 : 3,
          );
          line(o, d === 3 ? 3 : 1, a, 0.37, white, 0.11, 'trim');
          const plaque = [
            [s * 4.1 - 0.43, y - 1.45],
            [s * 4.1 + 0.43, y - 1.45],
            [s * 4.1 + 0.39, y - 2.4],
            [s * 4.1, y - 2.65],
            [s * 4.1 - 0.39, y - 2.4],
          ];
          panel(o, 'trim', plaque, 0.2, 0.28, white);
          line(o, 1, plaque, 0.34, buff, 0.05, 'trim', true);
          for (let j = 0; j < (d === 3 ? 7 : 3); j++) {
            const p = a[Math.round((j * (a.length - 1)) / (d === 3 ? 6 : 2))];
            sphere(o, 'trim', [p[0], p[1], 0.44], [0.14, 0.16, 0.08], white, d === 3 ? 8 : 5, 4);
          }
        }
      }
      B(o, 'trim', s * 1.55, 16.2, 0.09, 0.28, 2.25, 0.25, white);
      B(o, 'trim', s * 1.55, 18.35, 0.15, 0.65, 0.17, 0.42, buff);
      if (d > 1)
        sphere(o, 'trim', [s * 1.55, 18.8, 0.15], [0.24, 0.3, 0.2], white, d === 3 ? 12 : 6, 5);
    }
    line(
      o,
      d > 1 ? 2 : 1,
      mainWindow(d > 1 ? 32 : 12),
      0.16,
      white,
      d > 1 ? 0.24 : 0.13,
      'trim',
      true,
    );
    if (d > 1) {
      for (const side of [-1, 1])
        for (const yy of [16.45, 17.1, 17.8])
          B(o, 'trim', side * 1.55, yy, 0.25, 0.4, 0.21, 0.22, white);
      const head = [
        [-1.6, 15.0],
        [-1.3, 15.2],
        [-0.75, 15.3],
        [0, 15.08],
        [0.75, 15.3],
        [1.3, 15.2],
        [1.6, 15.0],
      ];
      line(o, 2, head, 0.28, white, 0.18, 'trim');
      for (const xx of [-0.35, 0.35]) relief(o, d, xx, 20.25, 0.35, 0.32);
    }
    const fan = arch(0, 17.2, 2, 1.05, d > 1 ? 20 : 6).slice(2);
    if (d > 1) for (const p of fan) line(o, 1, [[0, 17.25], p], -0.36, white, 0.035, 'trim');
    for (const x of [-7.1, 7.1, -15.05, 15.05]) B(o, 'trim', x, 3.2, 0.08, 0.18, 13.8, 0.18, buff);
  }
}
function entry(o, d) {
  const w = 13.4,
    z = -3.4;
  B(o, 'wall', 0, -3, -3.6, 13.4, 6.85, 0.2, red);
  quad(
    o,
    'wood',
    [
      [-6.7, 3.85, 0],
      [6.7, 3.85, 0],
      [6.7, 3.85, -3.5],
      [-6.7, 3.85, -3.5],
    ],
    [0, -1, 0],
    buff,
  );
  for (const s of [-1, 1]) B(o, 'wall', s * 11.13, -3, -0.4, 8.03, 6.3, 0.8, red);
  for (const s of [-1, 1]) {
    const q = transform(o, s > 0 ? -Math.PI / 2 : Math.PI / 2, (s * w) / 2, -1.7);
    B(q, 'wall', 0, -3, 0, 3.4, 6.85, 0.18, red);
    B(q, 'tiles', 0, -1.5, 0.1, 3.4, 1.6, 0.09, blue);
    if (d > 0)
      for (const u of [-1.08, 0, 1.08]) {
        if (d > 1) {
          for (const s of [-1, 1]) B(q, 'wood', u + s * 0.42, 0.2, 0.16, 0.07, 2, 0.13, gold);
          for (const y of [0.2, 2.13]) B(q, 'wood', u, y, 0.16, 0.87, 0.07, 0.13, gold);
        }
        B(q, 'sign', u, 0.28, 0.14, 0.7, 1.81, 0.025, buff);
        if (d > 1)
          recess(transform(q, 0, u, 0.2), 1, arch(0, 2.3, 0.9, 0.5, 8), { col: buff, depth: 0.08 });
      }
  }
  // Keep the original independent broad grade: tile walkway rises inward and slopes along the street.
  const nx = d === 0 ? 2 : d === 1 ? 4 : 12,
    nz = d === 0 ? 1 : 3;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x0 = -w / 2 + (w * i) / nx,
        x1 = -w / 2 + (w * (i + 1)) / nx,
        z0 = (z * j) / nz,
        z1 = (z * (j + 1)) / nz,
        ps = [
          [x0, grade(x0, z0) + 0.075, z0],
          [x1, grade(x1, z0) + 0.075, z0],
          [x1, grade(x1, z1) + 0.075, z1],
          [x0, grade(x0, z1) + 0.075, z1],
        ];
      quad(o, 'tiles', ps, [0, 1, 0], tile);
      if (d > 1) {
        const p = ps.map((v) => [v[0], v[1] + 0.01, v[2]]);
        for (const [a, b] of [
          [p[0], p[1]],
          [p[0], p[3]],
        ])
          strip(o, 'tiles', a, b, 0.025, buff, [0, 1, 0]);
      }
    }
  for (let j = 0; j < 5; j++) {
    const x = (j - 2) * 2.35,
      y = grade(x, z) + 0.075,
      q = transform(o, 0, x, z);
    B(q, 'wood', 0, y, 0, 2.28, 3.1 - y, 0.18, wood);
    if (d > 0)
      for (const s of [-1, 1]) {
        B(q, 'glass', s * 0.54, y + 0.3, 0.11, 0.91, 2.28 - y, 0.025, glass);
        if (d > 1) B(q, 'wood', s * 0.54, 1.05, 0.14, 0.96, 0.07, 0.055, gold);
        if (d > 1) B(q, 'metal', s * 0.1, 0.65, 0.16, 0.04, 0.57, 0.08, gold);
      }
    if (d > 0) {
      const fan = arch(0, 2.85, 2.28, 0.9, d > 1 ? 16 : 6);
      flat(
        q,
        'tiles',
        fan.map((p) => [...p, 0.02]),
        buff,
      );
      line(q, 1, fan, 0.05, gold, 0.08, 'wood', true);
    }
  }
  // Faceted island ticket booth; original tile art/posters are deliberately not reproduced.
  const y = grade(0, -1.5) + 0.075,
    ring = Array.from({ length: d === 0 ? 4 : 8 }, (_, i) => [
      0.85 * Math.sin(((i + 0.5) * Math.PI * 2) / (d === 0 ? 4 : 8)),
      -1.5 + 0.7 * Math.cos(((i + 0.5) * Math.PI * 2) / (d === 0 ? 4 : 8)),
    ]);
  poly(o, 'tiles', ring, y, y + 1.02, blue);
  poly(o, 'glass', ring, y + 1.02, y + 2.42, glass);
  poly(
    o,
    'wood',
    ring.map(([x, z]) => [x * 1.16, -1.5 + (z + 1.5) * 1.16]),
    y + 2.42,
    y + 2.56,
    dark,
  );
  if (d > 0)
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        ww = Math.hypot(dx, dz),
        q = transform(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
      B(q, 'tiles', 0, y + 0.08, 0.018, ww - 0.1, 0.86, 0.025, white);
      if (d > 1)
        for (const yy of [y + 0.25, y + 0.55, y + 0.85])
          B(q, 'tiles', 0, yy, 0.025, ww - 0.15, 0.025, 0.025, blue);
    }
  if (d > 0)
    for (const [x, z] of ring) {
      rod(o, d, 'wood', [x, y + 1, z], [x, y + 2.44, z], 0.035, gold);
      if (d > 1) B(o, 'metal', x, y + 2.56, z, 0.04, 0.16, 0.04, dark);
    }
  for (const [x, c] of [
    [-11.15, blue],
    [11.15, dark],
  ]) {
    const y = grade(x, 0) + 0.07;
    B(o, 'glass', x, y, -0.02, 7.15, 3.05 - y, 0.08, glass);
    if (d > 0) {
      for (let i = 0; i < 5; i++)
        rod(
          o,
          d,
          'wood',
          [x - 3.25 + i * 1.625, y, 0.05],
          [x - 3.25 + i * 1.625, 3.1, 0.05],
          0.085,
          x < 0 ? white : wood,
        );
      for (const yy of [y + 0.28, 2.3, 2.95])
        rod(o, d, 'wood', [x - 3.55, yy, 0.06], [x + 3.55, yy, 0.06], 0.08, x < 0 ? white : wood);
    }
    // Simple pitched northern blue awning and rounded southern black awning.
    const n = d === 0 ? 1 : d === 1 ? 3 : 8;
    for (let j = 0; j < n; j++) {
      const a = j / n,
        b = (j + 1) / n,
        z0 = x < 0 ? a : Math.sin((a * Math.PI) / 2),
        z1 = x < 0 ? b : Math.sin((b * Math.PI) / 2),
        h0 = x < 0 ? 3.2 - 0.55 * a : 2.8 + 0.55 * Math.cos((a * Math.PI) / 2),
        h1 = x < 0 ? 3.2 - 0.55 * b : 2.8 + 0.55 * Math.cos((b * Math.PI) / 2);
      const ps = [
        [x - 3.75, h0, z0],
        [x + 3.75, h0, z0],
        [x + 3.75, h1, z1],
        [x - 3.75, h1, z1],
      ];
      quad(o, 'metal', ps, normalFor(...ps), c);
      quad(o, 'metal', [...ps].reverse(), normalFor(...[...ps].reverse()), c);
    }
    B(o, 'metal', x, 2.5, 1, 7.5, 0.3, 0.045, c);
  }
}
function letterStroke(o, d, ch, x, y, z, w, h, col = white) {
  const paths = {
    C: [
      [
        [0.9, 0.85],
        [0.76, 0.96],
        [0.22, 0.96],
        [0.08, 0.8],
        [0.08, 0.2],
        [0.22, 0.06],
        [0.78, 0.06],
        [0.91, 0.2],
      ],
    ],
    A: [
      [
        [0.08, 0],
        [0.08, 0.8],
        [0.22, 0.96],
        [0.78, 0.96],
        [0.92, 0.8],
        [0.92, 0],
      ],
      [
        [0.08, 0.43],
        [0.92, 0.43],
      ],
    ],
    S: [
      [
        [0.9, 0.82],
        [0.76, 0.96],
        [0.22, 0.96],
        [0.08, 0.8],
        [0.08, 0.61],
        [0.22, 0.5],
        [0.78, 0.5],
        [0.92, 0.38],
        [0.92, 0.2],
        [0.78, 0.06],
        [0.22, 0.06],
        [0.08, 0.2],
      ],
    ],
    T: [
      [
        [0.04, 0.95],
        [0.96, 0.95],
      ],
      [
        [0.5, 0.95],
        [0.5, 0.04],
      ],
    ],
    R: [
      [
        [0.08, 0.04],
        [0.08, 0.95],
        [0.73, 0.95],
        [0.91, 0.8],
        [0.91, 0.62],
        [0.73, 0.5],
        [0.08, 0.5],
      ],
      [
        [0.55, 0.5],
        [0.92, 0.04],
      ],
    ],
    O: [
      [
        [0.22, 0.06],
        [0.78, 0.06],
        [0.92, 0.21],
        [0.92, 0.8],
        [0.78, 0.96],
        [0.22, 0.96],
        [0.08, 0.8],
        [0.08, 0.21],
        [0.22, 0.06],
      ],
    ],
  }[ch];
  for (const ps of paths) {
    const p = ps.map((v) => [x + v[0] * w, y + v[1] * h]);
    line(o, 1, p, z, col, Math.min(w, h) * 0.145, 'sign');
    if (d > 1) line(o, 1, p, z + 0.018, gold, Math.min(w, h) * 0.025, 'sign');
  }
}
function word(o, d, word, x, y, z, w, h) {
  const p = w / word.length;
  for (let i = 0; i < word.length; i++)
    letterStroke(o, d, word[i], x - w / 2 + i * p + 0.07 * p, y, z, p * 0.78, h);
}
function signDecoration(o, d, ps, z, col, w = 0.04) {
  line(o, 1, ps, z, col, w, 'sign');
  if (d > 2) line(o, 1, ps, z + 0.012, buff, w * 0.26, 'sign');
}
function marquee(o, d) {
  const p = frame.authoredComponents.marqueeOutline;
  poly(o, 'metal', p, 2.99, 3.13, dark);
  poly(o, 'sign', p, 3.13, 4.44, red);
  for (const k of [0, 1, 3]) {
    const a = p[k],
      b = p[(k + 1) % 4],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      w = Math.hypot(dx, dz),
      q = transform(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    B(q, 'sign', 0, 3.35, 0.025, w - 0.14, 0.87, 0.05, white);
    for (const y of [3.31, 4.25]) B(q, 'sign', 0, y, 0.04, w, 0.04, 0.07, gold);
    if (d > 0) {
      for (const y of k === 0 ? [3.77] : [3.62, 3.92])
        line(
          q,
          1,
          [
            [-w / 2 + 0.1, y],
            [w / 2 - 0.1, y],
          ],
          0.06,
          buff,
          0.016,
          'sign',
        );
      const n = Math.round(w / (d === 1 ? 1.1 : 0.68)),
        zz = Array.from({ length: n * 2 + 1 }, (_, i) => [
          -w / 2 + (i * w) / (2 * n),
          4.36 + (i % 2 ? 0.4 : 0),
        ]);
      panel(q, 'sign', [[-w / 2, 4.33], [w / 2, 4.33], ...zz.slice().reverse()], -0.04, 0.025, red);
      const runs = k === 0 ? [zz.filter((p) => p[0] < -2.65), zz.filter((p) => p[0] > 2.65)] : [zz];
      for (const run of runs) {
        signDecoration(q, d, run, 0.075, gold, 0.055);
        signDecoration(
          q,
          d,
          run.map(([x, y]) => [x, y - 0.1]),
          0.08,
          blue,
          0.045,
        );
      }
      for (let j = 0; j < n; j++) {
        const x = -w / 2 + ((j + 0.5) * w) / n,
          rr = 0.18;
        signDecoration(
          q,
          d,
          [
            [x - rr, 3.17],
            [x - rr / 2, 3.3],
            [x + rr / 2, 3.3],
            [x + rr, 3.17],
            [x + rr / 2, 3.04],
            [x - rr / 2, 3.04],
            [x - rr, 3.17],
          ],
          0.065,
          gold,
          0.04,
        );
        if (d > 1)
          signDecoration(
            q,
            d,
            [
              [x - 0.29, 3.04],
              [x - 0.21, 3.17],
              [x - 0.29, 3.3],
            ],
            0.07,
            blue,
            0.04,
          );
      }
    }
    if (k === 0) {
      const cap = curve(
        [
          [-2.6, 4.35],
          [-2.4, 4.9],
          [-1.5, 4.93],
          [-0.7, 5.1],
          [0, 5.5],
          [0.7, 5.1],
          [1.5, 4.93],
          [2.4, 4.9],
          [2.6, 4.35],
        ],
        d === 0 ? 1 : d === 1 ? 2 : 5,
      );
      panel(q, 'sign', [[-2.6, 4.3], [2.6, 4.3], ...cap.reverse()], -0.06, 0.04, red);
      if (d > 0) {
        line(q, 1, cap, 0.08, gold, 0.06, 'sign');
        word(q, d, 'CASTRO', 0, 4.48, 0.08, 4.5, 0.47);
      }
    }
    if (d > 1)
      for (const s of [-1, 1]) {
        B(q, 'sign', s * (w / 2 - 0.05), 3.0, 0.07, 0.08, 1.95, 0.08, gold);
        signDecoration(q, d, ellipse(s * (w / 2 - 0.05), 3.04, 0.12, 0.13, 14), 0.09, blue, 0.03);
      }
  }
  if (d > 0) {
    const nx = d === 1 ? 8 : d === 2 ? 22 : 36,
      nz = d === 1 ? 3 : d === 2 ? 6 : 10;
    for (let j = 0; j < nz; j++) {
      const z = 0.25 + (j * 3.5) / (nz - 1),
        hw = 7.1 - z * 0.65;
      for (let i = 0; i < nx; i++) {
        const x = -hw + ((i + 0.5) * 2 * hw) / nx;
        quad(
          o,
          'sign',
          [
            [x - 0.025, 2.981, z - 0.025],
            [x + 0.025, 2.981, z - 0.025],
            [x + 0.025, 2.981, z + 0.025],
            [x - 0.025, 2.981, z + 0.025],
          ],
          [0, -1, 0],
          bulb,
        );
      }
    }
    for (const x of [-4.5, 0, 4.5])
      sphere(o, 'sign', [x, 2.53, -0.12], [0.16, 0.18, 0.16], bulb, d > 1 ? 12 : 6, 6);
  }
}
function blade(o, d) {
  const x = -7.3,
    cz = 1.26,
    w = 1.94,
    y0 = 5.25,
    top = 17.45;
  const profile = [
    [-w / 2, y0 + 0.25],
    [-w * 0.32, y0 + 0.05],
    [0, y0],
    [w * 0.32, y0 + 0.05],
    [w / 2, y0 + 0.25],
    [w / 2, top - 0.38],
    [w * 0.3, top - 0.18],
    [0, top],
    [-w * 0.3, top - 0.18],
    [-w / 2, top - 0.38],
  ];
  const q = transform(o, Math.PI / 2, x, cz);
  panel(q, 'sign', profile, -0.23, 0.23, gold);
  for (const s of [-1, 1]) {
    const q = transform(o, (s * Math.PI) / 2, x + s * 0.241, cz);
    flat(
      q,
      'sign',
      profile.map(([u, y]) => [u * 0.94, y, 0]),
      red,
    );
    line(
      q,
      1,
      profile.map(([u, y]) => [u * 0.94, y]),
      0.018,
      blue,
      0.045,
      'sign',
      true,
    );
    for (let i = 0; i < 6; i++)
      letterStroke(q, d, 'CASTRO'[i], -0.76, 15.12 - i * 1.67, 0.04, 1.52, 1.42);
    if (d > 0) {
      const diamond = [
        [0, 5.34],
        [0.24, 5.65],
        [0, 5.94],
        [-0.24, 5.65],
        [0, 5.34],
      ];
      signDecoration(q, d, diamond, 0.04, gold, 0.065);
      const crown = [
        [-0.37, 16.92],
        [-0.5, 17.15],
        [0, 17.36],
        [0.5, 17.15],
        [0.37, 16.92],
        [0.24, 16.66],
        [-0.24, 16.66],
        [-0.37, 16.92],
      ];
      flat(
        q,
        'sign',
        crown.map((p) => [...p, 0.025]),
        blue,
      );
      signDecoration(q, d, crown, 0.045, gold, 0.04);
      for (const v of [-1, 1])
        for (const yy of [5.65, 16.85]) {
          const ps = Array.from({ length: d === 1 ? 9 : 25 }, (_, i) => {
            const t = (i / (d === 1 ? 8 : 24)) * Math.PI * 3,
              r = 0.28 * (1 - t / (Math.PI * 4));
            return [v * 0.66 + v * r * Math.cos(t), yy + r * Math.sin(t)];
          });
          signDecoration(q, d, ps, 0.045, blue, 0.035);
        }
    }
  }
  for (const yy of [5.7, 8.8, 12.5, 16.7]) {
    for (const xx of [x - 0.23, x + 0.23])
      rod(o, d, 'metal', [xx, yy, 0.02], [xx, yy, 1], 0.045, gold, [1, 0, 0]);
  }
  if (d > 0)
    for (let y = 5.5; y < 17; y += 0.7)
      rod(o, d, 'metal', [x - 0.21, y, 0.09], [x + 0.21, y, 0.09], 0.03, gold);
}
function build(o, d) {
  shell(o, d);
  facade(o, d);
  entry(o, d);
  marquee(o, d);
  blade(o, d);
}
export const castroTheatre = (o) => build(o, 3),
  castroTheatreStreet = (o) => build(o, 2),
  castroTheatreDistrict = (o) => build(o, 1),
  castroTheatreSkyline = (o) => build(o, 0);
const surfaces = {
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.7,
    metallic: 0.15,
    doubleSided: true,
  },
  glass: { slot: 'window', localRef: ref, roughness: 0.32, metallic: 0.1 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  tiles: { slot: 'foundation', localRef: ref, roughness: 0.65, metallic: 0 },
  sign: { slot: 'trim', localRef: ref, roughness: 0.52, metallic: 0.1 },
};
export const castroTheatreModel = {
  id: 'castro_theatre',
  key: 'castro_theatre',
  recipe: 'structure-castro-theatre.mjs',
  cell: '9q/9q8',
  title: 'Castro Theatre',
  brief:
    'Dated2008–2016Castro Theatre, with2022exterior arcade layout: broad native concrete front/narrow rear auditorium/shallow roof, three-part white/buff Spanish Colonial facade with tall arched gridded light, scroll parapet/shell niche/oval/relief cartouches/abstract foliage, small flanking windows/balconies and blind pink panels. Native trapezoid1937marquee with red-gold-blue zigzags/hexagons/curved CASTROcrest/static pale boards and bulb soffit. Red double-sided CASTROblade, white channel letters/gold tube strokes/blue edge scrolls/crown/diamond, open attachment brackets. Deep tiled arcade, five glazed oak door pairs/three plain northwall poster recesses/faceted island booth; same-building shop glazing/blue north and dark south awnings. Sloping frontage/unchanged terrain, no neighboring structures or actual ads/artwork/interior.',
  camera: [-62, 44, 72],
  lookAt: [0, 8, -15],
  qaCameras: [
    { name: 'front', position: [-28, 17, 37], lookAt: [0, 10, 0.3] },
    { name: 'front-detail', position: [8, 16, 27], lookAt: [0, 14, 0] },
    { name: 'entry-detail', position: [3, 1, 8], lookAt: [0, 1, -1.7] },
    { name: 'marquee-detail', position: [11, 6, 10], lookAt: [0, 4, 3] },
    { name: 'sign-north-detail', position: [-19, 13, 8], lookAt: [-7.3, 12, 1.2] },
    { name: 'sign-south-detail', position: [6, 13, 7], lookAt: [-7.3, 12, 1.2] },
    { name: 'roof-detail', position: [-32, 35, -9], lookAt: [0, 16, -21] },
    { name: 'back', position: [33, 24, -63], lookAt: [0, 9, -32] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -5 },
  build: castroTheatre,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Two unchanged original Terrariumtiles/2m review grid. Dry northern sidewalk[-12,2.8] datum43.5497m; foundation-5m, arcade walkway and separate storefront thresholds follow independently sampled broad street slope with.075m paving allowance. Exact threshold/interior engineering not surveyed; no terrain flattening or model-fitting. Bounded preview.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-castro-theatre.mjs',
    level: 'skyline',
    export: 'castroTheatreSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'castroTheatreDistrict', errorMeters: 1, surfaces },
      street: { export: 'castroTheatreStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Facade17m/raised center20.6m/shallow roof16.65–17.1m are proportional map/photo estimates. Blade12.2m tall/canopy3mabovedatum(~3.66mabovefrontgrade) and4mprojection/9mfront use primary nominal measurements plus native plan. Fine sculpture represented by original abstract cartouches/leaves rather than copied artwork.',
    'Arcade walkway/door thresholds reflect independently sampled broad terrain slope, not a threshold survey; smooth actual paving/interior floor relationship remains approximate. Five door-pair bottoms follow local grade while upper fanlights form one cornice line. Glazing opaque for library, tube colors do not simulate flashing neon.2022foyer photographs supplement2008–2016exterior; post-renovation2026changes not claimed.',
  ],
};
export { blade, entry, facade, marquee };
