/** 'flamsteed_house_royal_observatory_greenwich': independent mapped house, Octagon Room, turrets and time ball. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildFlamsteed(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  for (const p of r.floors) prism(f, 'plinth', p, r.foundationY, Y);
  for (const p of r.lower) prism(f, 'plinth', p, Y, Y + 4.1);
  for (const p of r.floors) prism(f, 'roof', p, Y + 4.1, Y + 4.3);
  prism(f, 'wall', r.upper, Y + 3.65, Y + 11.8);
  // A small open-sided east recess belongs to the low museum range, not a painted door.
  B('dark', 10.84, 0, 4.2, 0.08, 2.55, 2.4);
  B('plinth', 11.5, 2.55, 4.2, 1.5, 1.55, 2.4);
  B('stone', 11.55, 2.5, 4.2, 1.6, 0.12, 2.5);
  B('stone', 11.55, -0.08, 4.2, 1.6, 0.08, 2.5);
  // Cornices follow the actual canted outline rather than a rectangular cap over its corners.
  for (const [lo, hi, spread] of [
    [3.62, 3.85, 0.12],
    [11.5, 11.8, 0.3],
    [11.8, 12.12, 0.5],
  ]) {
    const poly = {
      outline: r.upper.outline.map(([x, z]) => [
        x + (x > 0 ? spread : -spread),
        z + (z < -4 ? -spread : spread),
      ]),
      holes: [],
    };
    prism(f, 'stone', poly, Y + lo, Y + hi);
  }
  prism(f, 'roof', r.upper, Y + 12.12, Y + 12.25);
  const towers = [
    { x: -10.12, z: -11.2, w: 4.7, d: 4.65 },
    { x: 10.05, z: -7.3, w: 3, d: 4.15 },
  ];
  function roundedCap(x, z, w, d) {
    const n = detail === 0 ? 8 : detail === 1 ? 12 : 20,
      profile = [
        [0, 1],
        [0.45, 0.85],
        [1.1, 0.55],
        [1.5, 0.13],
      ],
      rings = profile.map(([y, k]) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2,
            c = Math.cos(a),
            s = Math.sin(a),
            squareness = 1 / Math.max(Math.abs(c), Math.abs(s));
          const q = 1 + (squareness - 1) * k;
          return [x + c * w * 0.5 * k * q, Y + 15.1 + y, z + s * d * 0.5 * k * q];
        }),
      );
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          a = ((i + 0.5) / n) * Math.PI * 2;
        f(
          'roof',
          [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
          [Math.cos(a), 0.5, Math.sin(a)],
        );
      }
    f('roof', rings.at(-1), [0, 1, 0]);
    if (detail >= 2)
      for (let i = 0; i < n; i += 2) {
        const a = (i / n) * Math.PI * 2;
        for (let j = 0; j < rings.length - 1; j++) {
          const p = rings[j][i],
            q = rings[j + 1][i],
            t = [-Math.sin(a) * 0.035, 0, Math.cos(a) * 0.035];
          f(
            'stone',
            [
              p.map((v, k) => v + t[k]),
              p.map((v, k) => v - t[k]),
              q.map((v, k) => v - t[k]),
              q.map((v, k) => v + t[k]),
            ],
            [Math.cos(a), 0.5, Math.sin(a)],
          );
        }
      }
  }
  function sphere(x, y, z, radius, role) {
    const n = detail === 0 ? 8 : detail === 1 ? 12 : 20,
      m = detail < 2 ? 6 : 10;
    for (let j = 0; j < m; j++)
      for (let i = 0; i < n; i++) {
        const q = (a, b) => {
          const u = (a / n) * Math.PI * 2,
            v = (b / m) * Math.PI;
          return [
            x + radius * Math.cos(u) * Math.sin(v),
            Y + y + radius * Math.cos(v),
            z + radius * Math.sin(u) * Math.sin(v),
          ];
        };
        const a = ((i + 0.5) / n) * Math.PI * 2,
          b = ((j + 0.5) / m) * Math.PI;
        f(
          role,
          [q(i, j), q(i + 1, j), q(i + 1, j + 1), q(i, j + 1)],
          [Math.cos(a) * Math.sin(b), Math.cos(b), Math.sin(a) * Math.sin(b)],
        );
      }
  }
  for (const t of towers) {
    B('wall', t.x, 3.6, t.z, t.w, 11.4, t.d);
    B('stone', t.x, 14.85, t.z, t.w + 0.5, 0.25, t.d + 0.5);
    roundedCap(t.x, t.z, t.w + 0.15, t.d + 0.15);
    if (t.x < 0) {
      B('roof', t.x, 16.5, t.z, 0.15, 0.55, 0.15);
      sphere(t.x, 17.1, t.z, 0.25, 'roof');
    }
    if (detail) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          for (let y = 4; y < 14.9; y += detail === 1 ? 2.1 : 0.65) {
            B(
              'stone',
              t.x + sx * (t.w / 2 - 0.15),
              y,
              t.z + sz * (t.d / 2 - 0.15),
              0.42,
              0.3,
              0.42,
            );
          }
      window(t.x, 13.65, t.z - t.d / 2 - 0.04, 1.15, 1.65, 0);
    }
  }
  const east = towers[1];
  B('dark', east.x, 16.4, east.z, 0.17, 5.5, 0.17);
  sphere(east.x, 17.6, east.z, 0.95, 'ball');
  B('dark', east.x, 20.8, east.z, 3.15, 0.12, 0.14);
  B('dark', east.x, 21.8, east.z, 1.8, 0.06, 0.12);
  B('stone', east.x + 0.72, 21.62, east.z, 0.4, 0.4, 0.15);
  // Roof balustrade: a clear silhouette band far away, spaced solid balusters nearby.
  for (const edge of [
    [
      [-7.8, -9.9],
      [8.5, -9.9],
    ],
    [
      [-7.9, -9.8],
      [-7.9, -1.2],
    ],
    [
      [8.5, -9.7],
      [8.5, -1.3],
    ],
    [
      [-4.6, 2.1],
      [5, 2.1],
    ],
  ]) {
    const [a, b] = edge,
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      count = detail === 0 ? 1 : Math.ceil(length / (detail === 1 ? 1.5 : 0.48));
    if (detail === 0) {
      B(
        'stone',
        (a[0] + b[0]) / 2,
        12.2,
        (a[1] + b[1]) / 2,
        Math.max(0.15, Math.abs(dx)),
        0.65,
        Math.max(0.15, Math.abs(dz)),
      );
      continue;
    }
    for (const y of [12.2, 12.97])
      B(
        'stone',
        (a[0] + b[0]) / 2,
        y,
        (a[1] + b[1]) / 2,
        Math.max(0.17, Math.abs(dx)),
        0.13,
        Math.max(0.17, Math.abs(dz)),
      );
    for (let i = 0; i <= count; i++) {
      const x = a[0] + (dx * i) / count,
        z = a[1] + (dz * i) / count;
      B('stone', x, 12.28, z, 0.14, 0.72, 0.14);
      if (detail === 3) B('stone', x, 12.48, z, 0.22, 0.25, 0.22);
    }
  }
  // Finish both canted rear balustrade returns with closed rails and spaced posts.
  for (const [a, b] of [
    [
      [-7.9, -1.2],
      [-4.6, 2.1],
    ],
    [
      [5, 2.1],
      [8.5, -1.3],
    ],
  ]) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      nx = (-dz / len) * 0.08,
      nz = (dx / len) * 0.08,
      outline = [
        [a[0] + nx, a[1] + nz],
        [b[0] + nx, b[1] + nz],
        [b[0] - nx, b[1] - nz],
        [a[0] - nx, a[1] - nz],
      ];
    for (const y of [12.2, 12.97]) prism(f, 'stone', { outline, holes: [] }, Y + y, Y + y + 0.13);
    if (detail >= 2)
      for (let j = 0; j <= 8; j++)
        B('stone', a[0] + (dx * j) / 8, 12.28, a[1] + (dz * j) / 8, 0.14, 0.72, 0.14);
  }
  function window(x, y, z, w, h, side) {
    const at = (role, a, b, c, ww, hh, dd) =>
      side === 1
        ? B(role, x + c, y + b, z + a, dd, hh, ww)
        : B(role, x + a, y + b, z + c * (side === -1 ? -1 : 1), ww, hh, dd);
    at('glass', 0, -h / 2, 0, w, h, 0.045);
    if (!detail) return;
    for (const a of [-1, 1])
      at('stone', a * (w / 2 + 0.12), -h / 2 - 0.14, -0.035, 0.2, h + 0.5, 0.16);
    for (const b of [-h / 2 - 0.14, h / 2 + 0.14]) at('stone', 0, b, -0.055, w + 0.5, 0.22, 0.2);
    at('frame', 0, -h / 2, -0.07, 0.08, h, 0.09);
    const rows = detail === 1 ? 1 : Math.max(1, Math.round(h / 0.75));
    for (let j = 1; j <= rows; j++)
      at('frame', 0, -h / 2 + (h * j) / (rows + 1), -0.08, w, 0.065, 0.08);
    if (detail >= 2) {
      for (const a of [-1, 1]) at('stone', a * (w / 2 + 0.25), -h / 2, -0.02, 0.09, h + 0.6, 0.1);
    }
  }
  // Three tall north lights and the side/canted lights distinguish the Octagon Room.
  for (const x of [-5.3, 0.2, 5.5]) window(x, 7.65, -9.74, x === 0.2 ? 2.7 : 1.75, 6.15, 0);
  for (const z of [-6.3, -2.8]) window(8.45, 7.65, z, 1.8, 6.05, 1);
  window(0.2, 7.65, 2.06, 3, 6.15, -1);
  if (detail) {
    for (const x of [-9.6, -6.3, -3, 0.3, 3.6, 6.9, 10.1]) window(x, 1.9, -10.03, 1.25, 2.3, 0);
    for (const x of [-8, -3, 2, 7]) window(x, 1.9, 9.64, 1.25, 2.35, -1);
    for (const z of [0.7, 7.2]) window(12.3, 1.9, z, 1.2, 2.35, 1);
    B('stone', 0.2, 3.8, -10.06, 16.4, 0.2, 0.25);
    B('dark', 0.2, 3.96, -10.45, 3, 0.14, 0.9);
    for (const x of [-1.1, 1.5]) B('frame', x, 4.1, -10.83, 0.07, 0.75, 0.07);
    B('frame', 0.2, 4.8, -10.83, 2.7, 0.07, 0.07);
    B('stone', 8.58, 3.05, -3.9, 0.15, 0.85, 1.4);
    // Curving ramped shoulders remain strips, with no invented inscription lettering.
    for (const side of [-1, 1]) {
      const n = detail === 1 ? 4 : 12;
      for (let i = 0; i < n; i++) {
        const x = side * (8.5 + (i * 3.5) / n),
          next = side * (8.5 + ((i + 1) * 3.5) / n),
          height = (k) => 4.5 + 6.4 * Math.pow(1 - k / n, 2);
        f(
          'stone',
          [
            [x, Y + height(i), -9.93],
            [next, Y + height(i + 1), -9.93],
            [next, Y + height(i + 1) + 0.27, -9.93],
            [x, Y + height(i) + 0.27, -9.93],
          ],
          [0, 0, -1],
        );
      }
    }
    if (detail >= 2)
      for (const x of [-7.85, 8.35])
        for (let y = 4.1; y < 11.5; y += 0.6) B('stone', x, y, -9.8, 0.62, 0.26, 0.3);
  }
}
