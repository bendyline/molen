/** 'N0760': Saint Isaac cathedral, mapped porticos, drum colonnade and five domes. */
import './install-deterministic-math.mjs';
import { normalize, cross as vectorCross } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildIsaac(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    rib = (A, B) => {
      const axis = normalize(B.map((v, k) => v - A[k])),
        across = normalize(vectorCross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        other = vectorCross(axis, across),
        ring = (C) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([u, v]) => C.map((a, k) => a + across[k] * u * 0.09 + other[k] * v * 0.09)),
        a = ring(A),
        b = ring(B);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          n = a[i].map((v, k) => (v + a[j][k]) / 2 - A[k]);
        f('gold', [a[i], a[j], b[j], b[i]], n);
      }
      f(
        'gold',
        a,
        axis.map((v) => -v),
      );
      f('gold', b, axis);
    },
    cylinder = (role, x, z, profile, count) => {
      const rings = profile.map(([y, rad]) =>
        Array.from({ length: count }, (_, i) => {
          const a = (i * Math.PI * 2) / count;
          return [x + Math.cos(a) * rad, Y + y, z + Math.sin(a) * rad];
        }),
      );
      for (let k = 0; k < rings.length - 1; k++)
        for (let i = 0; i < count; i++) {
          const j = (i + 1) % count,
            a = ((i + 0.5) * Math.PI * 2) / count;
          f(
            role,
            [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
            [Math.cos(a), 0.01, Math.sin(a)],
          );
        }
      for (const [ring, n] of [
        [rings[0], [0, -1, 0]],
        [rings.at(-1), [0, 1, 0]],
      ])
        for (let i = 1; i < count - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], n);
    },
    column = (x, z, base, top, rad, segments, capital = true) => {
      cylinder(
        'column',
        x,
        z,
        detail > 2
          ? [
              [base, rad],
              [base + (top - base) * 0.38, rad * 1.035],
              [top, rad * 0.85],
            ]
          : [
              [base, rad],
              [top, rad * 0.85],
            ],
        segments,
      );
      if (capital) {
        if (detail === 1) B('patina', x, top, z, rad * 2.5, 0.95, rad * 2.5);
        else {
          B('stone', x, base - 0.35, z, rad * 2.5, 0.35, rad * 2.5);
          B('patina', x, top, z, rad * 2.35, 0.6, rad * 2.35);
          B('stone', x, top + 0.6, z, rad * 2.65, 0.35, rad * 2.65);
        }
      }
    },
    dome = (x, z, lo, hi, rad, count, bands) => {
      const profile = Array.from({ length: bands + 1 }, (_, i) => {
        const a = (i * Math.PI) / 2 / bands;
        return [lo + (hi - lo) * Math.sin(a), Math.max(0.08, rad * Math.cos(a))];
      });
      cylinder('gold', x, z, profile, count);
      if (detail > 1)
        for (let i = 0; i < count; i += 2) {
          const a = (i * Math.PI * 2) / count;
          for (let k = 0; k < profile.length - 1; k++) {
            const ps = [profile[k], profile[k + 1]].map(([y, rr]) => [
              x + Math.cos(a) * (rr + 0.22),
              Y + y,
              z + Math.sin(a) * (rr + 0.22),
            ]);
            rib(ps[0], ps[1]);
          }
        }
    },
    cross = (x, z, y, h, w) => {
      B('gold', x, y, z, w, h, w);
      if (detail) B('gold', x, y + h * 0.64, z, h * 0.62, w, w);
    };
  const n = [8, 16, 32, 48][detail],
    segments = [4, 4, 10, 16][detail],
    E = r.entry;
  prism(f, 'stone', r.floors[0], r.foundationY, Y);
  if (detail > 1) {
    for (const p of r.lower) prism(f, 'wall', p, Y, Y + E.base + E.spring + E.rise);
    prism(f, 'wall', r.core, Y + E.base + E.spring + E.rise, Y + 38);
    prism(f, 'stone', E.floor, Y, Y + E.base);
  } else prism(f, 'wall', r.core, Y, Y + 38);
  // Corner pylons belong to the same mapped cathedral and carry open belfries.
  for (const c of r.corners) {
    prism(f, 'wall', c.polygon, Y, Y + 43.5);
    prism(f, 'stone', c.polygon, Y + 43.5, Y + 45);
  }
  for (const p of r.porticos) {
    const n = p.normal,
      t = p.tangent,
      at = (u, y, d) => [
        p.center[0] + t[0] * u - n[0] * d,
        Y + y,
        p.center[1] + t[1] * u - n[1] * d,
      ],
      w = p.width,
      depth = Math.max(3, p.depth),
      rowCount = detail === 0 ? 1 : 2,
      count = detail === 0 ? (p.frontColumns === 8 ? 4 : 2) : p.frontColumns;
    // Stair/platform stays inside its mapped portico footprint.
    if (detail) {
      const steps = detail === 1 ? 1 : detail === 2 ? 6 : 8;
      for (let i = 0; i < steps; i++) {
        const d0 = i * 0.16,
          h = (1.28 * (i + 1)) / steps,
          poly = {
            outline: [
              [-w / 2, d0],
              [w / 2, d0],
              [w / 2, depth],
              [-w / 2, depth],
            ].map(([u, d]) => [at(u, 0, d)[0], at(u, 0, d)[2]]),
            holes: [],
          };
        // at() above is internal; prism receives the local callback f.
        prism(f, 'stone', poly, Y, Y + h);
      }
    }
    for (let row = 0; row < rowCount; row++)
      for (let i = 0; i < count; i++) {
        const u = -w / 2 + 2.2 + ((w - 4.4) * i) / (count - 1),
          d = row === 0 ? 1.45 : Math.max(2.9, depth - 1.4),
          q = at(u, 0, d);
        column(q[0], q[2], detail === 0 ? 0 : 1.28, 24, 1.0, segments, detail > 0);
      }
    const slab = (role, lo, hi, extra = 0) => {
      const poly = {
        outline: [
          [-w / 2 - extra, -0.2],
          [w / 2 + extra, -0.2],
          [w / 2 + extra, depth + 0.3],
          [-w / 2 - extra, depth + 0.3],
        ].map(([u, d]) => [at(u, 0, d)[0], at(u, 0, d)[2]]),
        holes: [],
      };
      prism(f, role, poly, Y + lo, Y + hi);
    };
    if (detail === 0) slab('stone', 24, 29.5, 0.65);
    else {
      slab('stone', 24, 25.5, 0.55);
      slab('wall', 25.5, 28.6, 0.25);
      slab('stone', 28.6, 29.5, 0.65);
    }
    const front = 0,
      back = depth,
      tri = (d) => [at(-w / 2, 29.5, d), at(w / 2, 29.5, d), at(0, 42, d)];
    f('stone', tri(front), [n[0], 0, n[1]]);
    f('stone', tri(back), [-n[0], 0, -n[1]]);
    const A = tri(front),
      C = tri(back);
    for (const [i, j] of [
      [0, 1],
      [1, 2],
      [2, 0],
    ])
      f(
        i === 0 ? 'stone' : 'patina',
        [A[i], A[j], C[j], C[i]],
        i === 0 ? [0, -1, 0] : [n[0] * 0.1, 1, n[1] * 0.1],
      );
    if (detail) {
      f(
        'patina',
        [at(-w / 2 + 2, 30.4, -0.06), at(w / 2 - 2, 30.4, -0.06), at(0, 40.7, -0.06)],
        [n[0], 0, n[1]],
      );
      if (detail > 1)
        for (const u of [-w * 0.4, 0, w * 0.4]) {
          const q = at(u, 0, 0);
          B('stone', q[0], 41.8 - (Math.abs(u) / w) * 25, q[2], 1.5, 0.7, 1.5);
        }
    }
  }
  const [cx, cz] = r.drum.center,
    R = r.drum.radius;
  cylinder('stone', cx, cz, [[38, 21], ...(detail === 0 ? [] : [[44, 21]]), [49.8, R + 1.0]], n);
  cylinder(
    'wall',
    cx,
    cz,
    [
      [49.8, R - 2.7],
      [72, R - 2.7],
    ],
    n,
  );
  const drumCols = detail === 0 ? 4 : detail === 1 ? 16 : 24;
  for (let i = 0; i < drumCols; i++) {
    const a = (i * Math.PI * 2) / drumCols;
    column(
      cx + Math.cos(a) * (R - 0.4),
      cz + Math.sin(a) * (R - 0.4),
      50,
      69.8,
      0.75,
      segments,
      detail > 0,
    );
  }
  cylinder(
    'stone',
    cx,
    cz,
    [[69.8, R + 1.2], ...(detail === 0 ? [] : [[71.4, R + 1.2]]), [72.1, R + 0.7]],
    n,
  );
  cylinder(
    'wall',
    cx,
    cz,
    [
      [72.1, R - 1],
      [75, R - 1],
    ],
    n,
  );
  cylinder(
    'patina',
    cx,
    cz,
    [
      [75, R - 0.6],
      [75.6, R - 0.6],
    ],
    n,
  );
  dome(cx, cz, 75.5, 93.5, R - 1, n, [3, 5, 8, 12][detail]);
  cylinder(
    'stone',
    cx,
    cz,
    [
      [91.5, 3.0],
      [94, 3.0],
    ],
    detail === 0 ? 6 : 12,
  );
  cylinder(
    'dark',
    cx,
    cz,
    [
      [94, 2.2],
      [98, 2.2],
    ],
    detail === 0 ? 6 : 12,
  );
  if (detail)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      column(cx + Math.cos(a) * 2.65, cz + Math.sin(a) * 2.65, 94, 97.7, 0.25, segments, false);
    }
  dome(cx, cz, 98, 100, 3, detail === 0 ? 6 : 12, detail === 0 ? 2 : 4);
  cross(cx, cz, 100, 1.5, 0.18);
  for (const c of r.corners) {
    const [x, z] = c.center,
      size = detail === 0 ? 3 : 4.5;
    if (detail === 0) {
      B('wall', x, 45, z, size * 2, 10, size * 2);
      dome(x, z, 55, 60, 5, 6, 2);
      continue;
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) column(x + sx * 4.3, z + sz * 4.3, 45, 55, 0.55, segments, true);
    cylinder(
      'dark',
      x,
      z,
      [
        [45, 1.8],
        [55.5, 1.8],
      ],
      8,
    );
    B('stone', x, 55.8, z, 11.5, 0.8, 11.5);
    dome(x, z, 56.6, 60, 5.2, detail === 1 ? 8 : 16, detail === 1 ? 3 : 6);
    cross(x, z, 60, 1.3, 0.15);
  }
  if (!detail) return;
  // Gallery windows stay on the inner drum; the outer columns remain real gaps.
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) * Math.PI) / 12,
      rad = R - 2.67,
      span = 0.045,
      q = (t, y, radius = rad) => [cx + Math.cos(t) * radius, Y + y, cz + Math.sin(t) * radius];
    f(
      'glass',
      [q(a - span, 54), q(a + span, 54), q(a + span, 65), q(a - span, 65)],
      [Math.cos(a), 0, Math.sin(a)],
    );
  }
  for (let i = 0; i < 24; i++) {
    const a = ((i + 0.5) * Math.PI) / 12,
      span = 0.03,
      rad = R - 0.97,
      q = (t, y) => [cx + Math.cos(t) * rad, Y + y, cz + Math.sin(t) * rad];
    f(
      'glass',
      [q(a - span, 72.4), q(a + span, 72.4), q(a + span, 74.7), q(a - span, 74.7)],
      [Math.cos(a), 0, Math.sin(a)],
    );
  }
  if (detail > 1) {
    const ring = (radius) =>
      Array.from({ length: n }, (_, i) => [
        cx + Math.cos((i * Math.PI * 2) / n) * radius,
        cz + Math.sin((i * Math.PI * 2) / n) * radius,
      ]);
    prism(f, 'patina', { outline: ring(R + 1.1), holes: [ring(R + 0.9)] }, Y + 73.25, Y + 73.45);
  }
  // One genuine doorway behind the southwest portico; other doors are flat proxies.
  const at = (u, y, d) => [E.center[0] + u, Y + E.base + y, E.center[1] - d],
    count = detail > 1 ? 12 : 4,
    w = E.width,
    h = E.spring + E.rise;
  if (detail > 1) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI - (i * Math.PI) / count,
        b = Math.PI - ((i + 1) * Math.PI) / count,
        u0 = (Math.cos(a) * w) / 2,
        u1 = (Math.cos(b) * w) / 2,
        y0 = E.spring + Math.sin(a) * E.rise,
        y1 = E.spring + Math.sin(b) * E.rise;
      f('stone', [at(u0, y0, 0), at(u1, y1, 0), at(u1, h, 0), at(u0, h, 0)], [0, 0, 1]);
      f(
        'stone',
        [at(u0, y0, 0), at(u1, y1, 0), at(u1, y1, E.depth), at(u0, y0, E.depth)],
        [0, -1, 0],
      );
    }
    for (const u of [-w / 2, w / 2])
      f(
        'stone',
        [at(u, 0, 0), at(u, 0, E.depth), at(u, E.spring, E.depth), at(u, E.spring, 0)],
        [-Math.sign(u), 0, 0],
      );
  }
  f(
    'dark',
    [
      at(-w / 2, 0, detail > 1 ? E.depth - 0.025 : -0.05),
      at(w / 2, 0, detail > 1 ? E.depth - 0.025 : -0.05),
      at(w / 2, h, detail > 1 ? E.depth - 0.025 : -0.05),
      at(-w / 2, h, detail > 1 ? E.depth - 0.025 : -0.05),
    ],
    [0, 0, 1],
  );
  f(
    'stone',
    [at(-w / 2, 0, 0), at(w / 2, 0, 0), at(w / 2, 0, E.depth), at(-w / 2, 0, E.depth)],
    [0, 1, 0],
  );
  // Fit the eight large arched windows to the measured outside pylon faces.
  for (const c of r.corners)
    for (const axis of [0, 1]) {
      const direction = Math.sign(c.center[axis] - r.drum.center[axis]),
        other = 1 - axis,
        value = c.center[other],
        ring = c.polygon.outline,
        sign = Math.sign(
          ring.reduce((s, a, i) => {
            const b = ring[(i + 1) % ring.length];
            return s + a[0] * b[1] - a[1] * b[0];
          }, 0),
        ),
        hits = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if ((a[other] <= value && b[other] > value) || (b[other] <= value && a[other] > value)) {
          const q = a.map((v, k) => v + ((b[k] - v) * (value - a[other])) / (b[other] - a[other])),
            L = Math.hypot(b[0] - a[0], b[1] - a[1]),
            t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
          hits.push({ q, t, n: [t[1] * sign, -t[0] * sign] });
        }
      }
      const e = hits.sort((a, b) => direction * (b.q[axis] - a.q[axis]))[0],
        points = [
          [-2.5, 5],
          [2.5, 5],
          [2.5, 17],
        ];
      for (let i = 1; i <= 8; i++) {
        const a = (i * Math.PI) / 8;
        points.push([Math.cos(a) * 2.5, 17 + Math.sin(a) * 2.5]);
      }
      const at = (u, y, d = 0.06) => [
        e.q[0] + e.t[0] * u + e.n[0] * d,
        Y + y,
        e.q[1] + e.t[1] * u + e.n[1] * d,
      ];
      f(
        'glass',
        points.map(([u, y]) => at(u, y)),
        [e.n[0], 0, e.n[1]],
      );
      if (detail > 1) {
        for (const u of [-2.75, 2.75])
          f(
            'stone',
            [at(u - 0.15, 4.6), at(u + 0.15, 4.6), at(u + 0.15, 19.7), at(u - 0.15, 19.7)],
            [e.n[0], 0, e.n[1]],
          );
        f('stone', [at(-3, 19.6), at(3, 19.6), at(3, 20.3), at(-3, 20.3)], [e.n[0], 0, e.n[1]]);
      }
    }
  if (detail > 1) {
    for (const c of r.corners) {
      const [x, z] = c.center;
      B('stone', x, 36.5, z, 13.7, 0.5, 13.7);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i * Math.PI) / 16,
        x = cx + Math.cos(a) * (R + 1),
        z = cz + Math.sin(a) * (R + 1);
      B('patina', x, 72.1, z, 0.18, 1.2, 0.18);
    }
  }
}
