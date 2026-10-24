/** 'osireion': Osireion's open granite hall, low-water island and bounded excavation. */
import { box, prism, rect } from './khmer-structure-geometry.mjs';

export function buildOsireionHall(emit, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    point = ([x, y, z]) => [x * c - z * s, y, x * s + z * c],
    f = (role, ps, n) =>
      emit(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
    ground = (x, z) => {
      const p = point([x, 0, z]);
      return sample(p[0], p[2]);
    },
    F = r.floorY,
    B = r.bedY;
  // Every point in the exact mapped opening has an opaque bed at every level.
  prism(f, 'soil', { outline: r.localOutline }, B - 0.4, B);
  const inner = rect(0, 0, 30.8, 23.0).outline,
    outer = r.localOutline;
  // The original mapped rectangle is clockwise; match inner corners explicitly.
  const nearest = (p) =>
    inner.reduce((a, b) =>
      Math.hypot(a[0] - p[0], a[1] - p[1]) < Math.hypot(b[0] - p[0], b[1] - p[1]) ? a : b,
    );
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      u = nearest(a),
      v = nearest(b),
      n = detail === 0 ? 1 : 4;
    for (let j = 0; j < n; j++) {
      const at = (p, q, t) => p.map((x, k) => x + (q[k] - x) * t),
        p = at(a, b, j / n),
        q = at(a, b, (j + 1) / n),
        P = at(u, v, j / n),
        Q = at(u, v, (j + 1) / n),
        high = (p) => ground(...p) + 0.16;
      f(
        'soil',
        [
          [p[0], high(p), p[1]],
          [q[0], high(q), q[1]],
          [Q[0], -1.15, Q[1]],
          [P[0], -1.15, P[1]],
        ],
        [0, 1, 0],
      );
      f(
        'soil',
        [
          [P[0], B, P[1]],
          [Q[0], B, Q[1]],
          [Q[0], -1.15, Q[1]],
          [P[0], -1.15, P[1]],
        ],
        [-(P[0] + Q[0]), 0, -(P[1] + Q[1])],
      );
      // Buried outside skirt seals interpolation differences against the coarse host mesh.
      f(
        'soil',
        [
          [p[0], B - 0.05, p[1]],
          [q[0], B - 0.05, q[1]],
          [q[0], high(q), q[1]],
          [p[0], high(p), p[1]],
        ],
        [p[0] + q[0], 0, p[1] + q[1]],
      );
      // A short overlap covers the numeric edge of the terrain cut.
      const expand = (p) => p.map((x) => x * (1 + 0.12 / Math.hypot(...p))),
        e = expand(p),
        E = expand(q);
      f(
        'soil',
        [
          [e[0], ground(...e) - 0.15, e[1]],
          [E[0], ground(...E) - 0.15, E[1]],
          [q[0], high(q), q[1]],
          [p[0], high(p), p[1]],
        ],
        [0, 1, 0],
      );
    }
  }
  const masonry = (out, role, x, y, z, w, h, d) => {
    if (detail < 2 || role !== 'wall') return box(out, role, x, y, z, w, h, d);
    const rows = Math.max(1, Math.ceil(h / 0.85));
    for (let j = 0; j < rows; j++) {
      const count = Math.max(1, Math.ceil(w / 2.8));
      for (let i = 0; i < count; i++)
        box(
          out,
          role,
          x - w / 2 + ((i + 0.5) * w) / count,
          y + (j * h) / rows + 0.008,
          z,
          w / count - 0.014,
          h / rows - 0.016,
          d,
        );
    }
  };
  const nicheWall = (out, length, centers) => {
    const width = 1.35,
      top = -1.1,
      low = B + 0.18,
      high = B + 2.9,
      breaks = [-length / 2, ...centers.flatMap((x) => [x - width / 2, x + width / 2]), length / 2];
    masonry(out, 'wall', 0, B, 0, length, low - B, 1.35);
    masonry(out, 'wall', 0, high, 0, length, top - high, 1.35);
    for (let i = 0; i < breaks.length - 1; i += 2) {
      const a = breaks[i],
        b = breaks[i + 1];
      masonry(out, 'wall', (a + b) / 2, low, 0, b - a, high - low, 1.35);
    }
    // Closed backs make real shaded recesses without inventing underground rooms.
    box(out, 'wet', 0, low, -0.82, length, high - low, 0.26);
    if (detail >= 2)
      for (const x of centers) {
        masonry(out, 'wall', x, high - 0.04, 0.73, width + 0.38, 0.16, 0.12);
        for (const hand of [-1, 1])
          masonry(out, 'wall', x + hand * (width / 2 + 0.045), low, 0.73, 0.09, high - low, 0.1);
      }
  };
  for (const hand of [-1, 1]) {
    nicheWall(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, y, hand * (9.6 - z)]),
          [n[0], n[1], -hand * n[2]],
        ),
      28,
      detail === 0 ? [-7, 0, 7] : [-8.4, -4.2, 0, 4.2, 8.4],
    );
    nicheWall(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [hand * (14 - z), y, x]),
          [-hand * n[2], n[1], n[0]],
        ),
      20.5,
      [-5, 0, 5],
    );
  }
  const sockets =
    detail === 0 ? [] : [rect(-2.3, 0, 2.7, 1.6).outline, rect(3.0, 0, 2.0, 1.8).outline];
  prism(f, 'wet', { outline: rect(0, 0, 22.5, 10.2).outline, holes: sockets }, B, F);
  for (const p of sockets) prism(f, 'wet', { outline: p }, B, F - 0.48);
  const water = r.waterY;
  for (const q of [
    rect(0, -7.05, 26.4, 3.9),
    rect(0, 7.05, 26.4, 3.9),
    rect(-12.225, 0, 1.95, 10.2),
    rect(12.225, 0, 1.95, 10.2),
  ])
    prism(f, 'water', q, water - 0.04, water);
  function wornBlock(out, role, x, y, z, width, height, depth, seed) {
    if (detail === 0) return box(out, role, x, y, z, width, height, depth);
    const k = detail === 1 ? 0.04 : 0.07,
      ring = [
        [-0.5 + k, -0.5],
        [0.5 - k, -0.5],
        [0.5, -0.5 + k],
        [0.5, 0.5 - k],
        [0.5 - k, 0.5],
        [-0.5 + k, 0.5],
        [-0.5, 0.5 - k],
        [-0.5, -0.5 + k],
      ],
      low = ring.map(([a, b]) => [x + a * width, y, z + b * depth]),
      high = ring.map(([a, b], i) => [
        x + a * width * (1 - 0.02 * (i % 3)),
        y + height + (detail >= 2 ? (((i + seed) % 5) - 2) * 0.035 : 0),
        z + b * depth,
      ]);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      out(
        role,
        [low[i], low[j], high[j], high[i]],
        [low[j][2] - low[i][2], 0, low[i][0] - low[j][0]],
      );
    }
    out(role, low, [0, -1, 0]);
    out(role, high, [0, 1, 0]);
  }
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 5; i++) {
      const x = r.pierXs[i],
        z = r.pierZs[row],
        height = r.pierHeights[row][i];
      wornBlock(f, 'stone', x, F, z, 2.6, 0.24, 2.65, i + row);
      wornBlock(f, 'stone', x, F + 0.24, z, 2.35, height - 0.24, 2.4, i + row);
      if (detail >= 2) {
        box(f, 'stone', x, F + 0.25, z, 2.54, 0.1, 2.59);
        box(f, 'stone', x, F + 0.4, z, 2.42, 0.09, 2.47);
      }
    }
  for (const span of r.lintelSpans) {
    const n = Math.round((span.to - span.from) / 4.2);
    for (let i = 0; i < n; i++) {
      const x = span.from + (i + 0.5) * 4.2;
      wornBlock(f, 'stone', x, F + 3.5, span.z, 4.35, 1.02, 2.65, i);
      if (detail >= 2 && i % 2 === 0)
        wornBlock(f, 'stone', x + 0.45, F + 4.52, span.z - 0.08, 1.8, 0.38, 2.1, i + 2);
    }
  }
  // A few broad original fragments imply fractured remains, not a copied stone inventory.
  if (detail >= 1)
    for (let i = 0; i < (detail === 1 ? 4 : 12); i++) {
      const x = -12 + i * 2.12,
        z = i % 2 ? -10.7 : 10.7;
      wornBlock(f, 'wall', x, -1.12, z, 1.25 + (i % 3) * 0.35, 0.24 + (i % 4) * 0.14, 0.9, i);
    }
  const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    unit = (v) => {
      const h = Math.hypot(...v);
      return v.map((x) => x / h);
    };
  const beam = (a, b, width) => {
    const n = unit(b.map((x, i) => x - a[i])),
      u = unit(cross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
      v = cross(n, u),
      ring = (p) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, z]) => p.map((q, i) => q + ((u[i] * x + v[i] * z) * width) / 2)),
      p = ring(a),
      q = ring(b);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'wood',
        [p[i], p[j], q[j], q[i]],
        p[i].map((x, k) => (x + p[j][k]) / 2 - a[k]),
      );
    }
    f(
      'wood',
      p,
      n.map((x) => -x),
    );
    f('wood', q, n);
  };
  const bx = r.bridge.x,
    top = [bx, ground(bx, 15.6) + 0.18, 15.6],
    landing = [bx, -0.8, 9.6],
    bottom = [bx, F + 0.1, 4.95];
  box(f, 'wood', bx, -1.1, 9.6, 1.12, 0.3, 0.6);
  const flight = (start, end, first) => {
    const n = detail === 0 ? 1 : detail === 1 ? 6 : 14;
    for (const hand of [-1, 1])
      beam(
        [bx + hand * 0.52, start[1] - 0.15, start[2]],
        [bx + hand * 0.52, end[1] - 0.15, end[2]],
        0.16,
      );
    if (detail === 0)
      f(
        'wood',
        [
          [bx - 0.55, start[1], start[2]],
          [bx + 0.55, start[1], start[2]],
          [bx + 0.55, end[1], end[2]],
          [bx - 0.55, end[1], end[2]],
        ],
        [0, 1, 0],
      );
    else
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n,
          y = start[1] + (end[1] - start[1]) * t,
          z = start[2] + (end[2] - start[2]) * t;
        box(f, 'wood', bx, y - 0.12, z, 1.1, 0.12, Math.abs(start[2] - end[2]) / n + 0.03);
      }
    for (const hand of [-1, 1]) {
      beam(
        [bx + hand * 0.57, start[1] + 0.9, start[2]],
        [bx + hand * 0.57, end[1] + 0.9, end[2]],
        0.085,
      );
      for (let i = first ? 0 : 1; i < (detail === 0 ? 2 : 3); i++) {
        const t = i / (detail === 0 ? 1 : 2),
          y = start[1] + (end[1] - start[1]) * t,
          z = start[2] + (end[2] - start[2]) * t;
        beam([bx + hand * 0.57, y - 0.2, z], [bx + hand * 0.57, y + 1.0, z], 0.08);
      }
    }
  };
  flight(top, landing, true);
  flight(landing, bottom, false);
}
