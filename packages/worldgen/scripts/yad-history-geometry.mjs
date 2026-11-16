/** 'holocaust_history_museum_yad_vashem': buried triangular museum, splayed west wings and integrated roof light. */
import { box, prism } from './khmer-structure-geometry.mjs';

function buildApproach(face, bar, detail, bridge) {
  const { start, end, startY, endY, width, steps, piers } = bridge;
  const delta = end.map((v, k) => v - start[k]),
    length = Math.hypot(...delta),
    side = [delta[1] / length, -delta[0] / length],
    point = (t, offset, y) => [
      start[0] + delta[0] * t + side[0] * offset,
      y,
      start[1] + delta[1] * t + side[1] * offset,
    ],
    height = (t) => startY + (endY - startY) * t,
    slab = (a, b, ya, yb, depth) => {
      const ring = (t, y) => [
        point(t, -width / 2, y - depth),
        point(t, width / 2, y - depth),
        point(t, width / 2, y),
        point(t, -width / 2, y),
      ];
      const back = ring(a, ya),
        front = ring(b, yb);
      face('floor', back, [-delta[0], 0, -delta[1]]);
      face('floor', front, [delta[0], 0, delta[1]]);
      for (const [i, n] of [
        [0, [0, -1, 0]],
        [1, [side[0], 0, side[1]]],
        [2, [0, 1, 0]],
        [3, [-side[0], 0, -side[1]]],
      ]) {
        const j = (i + 1) % 4;
        face('floor', [back[i], back[j], front[j], front[i]], n);
      }
    };
  if (steps) {
    // From bridge toe to door, the flight rises toward the elevated museum floor.
    for (let i = 0; i <= steps; i++) {
      const a = i / (steps + 1),
        b = (i + 1) / (steps + 1),
        y = height(i / steps);
      slab(a, b, y, y, 0.39);
    }
  } else {
    slab(0, 1, startY, endY, 0.38);
  }
  for (const { t, bottom } of piers) {
    const [x, , z] = point(t, 0, bottom);
    const h = height(t) - bottom - 0.34;
    box(face, 'wall', x, bottom, z, 1.01, h, 0.67);
  }
  for (const s of [-1, 1]) {
    const offset = s * (width / 2 - 0.075);
    for (const [rise, size] of detail
      ? [
          [1.08, 0.065],
          [0.52, 0.043],
        ]
      : [[1.08, 0.08]]) {
      bar(
        point(0.012, offset, height(0.012) + rise),
        point(0.99, offset, height(0.99) + rise),
        size,
      );
    }
    const count = detail ? Math.max(2, Math.ceil(length / 2.8)) : 1;
    for (let i = 0; i <= count; i++) {
      const t = 0.022 + (0.95 * i) / count,
        y = steps ? height(Math.min(steps, Math.floor(t * (steps + 1))) / steps) : height(t);
      bar(point(t, offset, y), point(t, offset, y + 1.11), 0.055);
    }
  }
}

export function buildYadHistory(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k] / ps.length, 0)),
    loft = (role, rings, sides) => {
      f(role, rings[0], [-1, 0, 0]);
      f(role, rings.at(-1), [1, 0, 0]);
      for (let i = 1; i < rings.length; i++) {
        const a = rings[i - 1],
          b = rings[i],
          center = mean([...a, ...b]);
        for (const j of sides ?? a.keys()) {
          const k = (j + 1) % a.length,
            ps = [a[j], b[j], b[k], a[k]],
            c = mean(ps);
          f(role, ps, [0, c[1] - center[1], c[2] - center[2]]);
        }
      }
    },
    width = (x, side) =>
      (side > 0 ? 5.4336 : 5.6) + ((x + 78.2563) / 176.3) * (side > 0 ? 0.84 : 0.83),
    apex = (x) => {
      const i = r.site.crest.findIndex(([at]) => at >= x);
      const [b, hi] = r.site.crest[i < 0 ? r.site.crest.length - 1 : i];
      const [a, lo] = r.site.crest[Math.max(0, i - 1)];
      return a === b ? hi : lo + ((x - a) * (hi - lo)) / (b - a);
    },
    underside = (x) => Math.min(-0.35, -0.35 - ((x - 65) * 4.15) / 33.1),
    section = (x, side, low = -0.35) => {
      const w = width(x, side),
        h = apex(x),
        z = (y) => side * (w + (0.65 - w) * (Math.max(y, 0) / h));
      return [
        [x, Y + low, z(low)],
        [x, Y + h, side * 0.65],
        [x, Y + h - 0.15, side * 0.25],
        [x, Y + low, z(low) - side * 0.38],
      ];
    },
    bar = (a, b, size = 0.12, role = 'frame') => {
      const delta = b.map((v, k) => v - a[k]),
        length = Math.hypot(...delta),
        u = delta.map((v) => v / length),
        reference = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
        cross = (p, q) => [
          p[1] * q[2] - p[2] * q[1],
          p[2] * q[0] - p[0] * q[2],
          p[0] * q[1] - p[1] * q[0],
        ],
        vv = cross(u, reference),
        norm = Math.hypot(...vv),
        v = vv.map((x) => ((x / norm) * size) / 2),
        w = cross(u, v),
        ring = (p) =>
          [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
          ].map(([sv, sw]) => p.map((x, k) => x + sv * v[k] + sw * w[k]));
      const A = ring(a),
        B = ring(b);
      f(
        role,
        A,
        u.map((x) => -x),
      );
      f(role, B, u);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4,
          ps = [A[j], B[j], B[k], A[k]],
          c = mean(ps),
          m = mean([a, b]);
        f(
          role,
          ps,
          c.map((x, k) => x - m[k]),
        );
      }
    };

  // Independent paths cross the roof line over buried slabs between the skylight runs.
  const eastX = 98.1,
    westX = -78.2563,
    entryX = r.site.bridges[0].start[0],
    entryMin = entryX - 2.3,
    entryMax = entryX + 2.3,
    knots = (a, b) => [a, ...r.site.crest.map(([x]) => x).filter((x) => x > a && x < b), b],
    shell = (a, b, side, opening = false) =>
      loft(
        'wall',
        knots(a, b).map((x) => section(x, side, opening ? 3.25 : underside(x))),
        detail ? undefined : [0, 1],
      );
  for (const p of r.site.buriedCore) prism(f, 'floor', p, r.foundationY, Y, detail > 0);
  shell(westX, eastX, 1);
  shell(westX, entryMin, -1);
  shell(entryMin, entryMax, -1, true);
  shell(entryMax, eastX, -1);
  const ridge = (x) => {
    const h = Y + apex(x);
    return [
      [x, h - 0.05, -0.65],
      [x, h + r.site.ridgeRise, 0],
      [x, h - 0.05, 0.65],
    ];
  };
  for (const [a, b] of r.site.skylightRuns) loft('glass', knots(a, b).map(ridge));
  for (const [a, b] of r.site.roofCrossings) {
    const cap = (x) => [
      [x, Y + apex(x) - 0.15, -0.65],
      [x, Y + apex(x) - 0.15, 0.65],
      [x, Y + apex(x) + 0.08, 0.65],
      [x, Y + apex(x) + 0.08, -0.65],
    ];
    loft('wall', knots(a, b).map(cap));
  }
  const terminal = (side) => section(eastX, side, underside(eastX));
  f('wall', [terminal(-1)[0], terminal(1)[0], terminal(1)[1], terminal(-1)[1]], [1, 0, 0]);
  loft(
    'floor',
    [64.9, 65, eastX].map((x) => {
      const left = -width(x, -1) + 0.1,
        right = width(x, 1) - 0.1,
        bottom = Y + underside(x);
      return [
        [x, bottom, left],
        [x, Y - 0.04, left],
        [x, Y - 0.04, right],
        [x, bottom, right],
      ];
    }),
  );
  box(f, 'glass', entryX, Y + 0.035, -4.48, 4.4, 3.04, 0.12);
  box(f, 'floor', entryX, Y - 0.2, -5.49, 4.55, 0.2, 1.86);
  box(f, 'wall', entryX, Y + 3.21, -5.2, 4.55, 0.19, 1.65);
  if (detail) {
    for (const dx of [-2.13, -0.69, 0.69, 2.13])
      box(f, 'frame', entryX + dx, Y + 0.05, -4.57, 0.12, 3, 0.18);
    box(f, 'frame', entryX, Y + 2.35, -4.57, 4.4, 0.12, 0.18);
  }

  // Curved wings are sampled from a few broad, deliberate planes at distance.
  const steps = [3, 5, 10, 16][detail],
    tipX = westX - 25.05,
    exitX = r.site.bridges[1].start[0],
    exitMin = exitX - 1.55,
    exitMax = exitX + 1.55,
    flare = (side, a, b, opening = false) =>
      [
        a,
        ...Array.from({ length: steps - 1 }, (_, i) => tipX + (25.05 * (i + 1)) / steps).filter(
          (x) => x > a && x < b,
        ),
        b,
      ].map((x) => {
        const u = (westX - x) / 25.05,
          ease = u * u,
          outer = (side > 0 ? 5.4336 : 5.6) + (side > 0 ? 7.56 : 4.9) * ease,
          top = 0.65 + (side > 0 ? 5.35 : 4.65) * ease,
          h = apex(westX) - 4.4 * u + 4.1 * ease,
          bottom = opening ? 3.0 : -2.2 * ease,
          edge = outer + ((top - outer) * Math.max(0, bottom)) / h;
        return [
          [x, Y + bottom, side * edge],
          [x, Y + h, side * top],
          [x, Y + h - 0.13, side * (top - 0.42)],
          [x, Y + bottom, side * (edge - 0.42)],
        ];
      });
  loft('wall', flare(-1, tipX, westX));
  loft('wall', flare(1, tipX, exitMin));
  loft('wall', flare(1, exitMin, exitMax, true));
  loft('wall', flare(1, exitMax, westX));
  box(f, 'glass', exitX, Y + 0.035, 4.34, 2.91, 2.89, 0.13);
  box(f, 'floor', exitX, Y - 0.24, 5.31, 3.05, 0.24, 2.05);
  if (detail) {
    for (const dx of [-1.38, 0, 1.38]) box(f, 'frame', exitX + dx, Y + 0.05, 4.44, 0.1, 2.8, 0.16);
    box(f, 'frame', exitX, Y + 2.28, 4.44, 2.88, 0.09, 0.16);
  }
  const overlook = detail
    ? [
        [-99, 4.3, 0.56],
        [-89, 4.54, 1.2],
        [-85.5, 4.65, 2.2],
        [-76, 4.9, 3.5],
        [-70, 5.46, 3.9],
      ]
    : [
        [-99, 4.3, 0.56],
        [-70, 5.46, 3.9],
      ];
  loft(
    'floor',
    overlook.map(([x, w, depth]) => [
      [x, Y - depth, -w],
      [x, Y, -w],
      [x, Y, w],
      [x, Y - depth, w],
    ]),
  );
  box(f, 'glass', -86.6, Y + 0.05, 0, 0.14, 3.8, 7.2);
  const westGlassApex = Math.min(8.6, apex(westX) - 0.7);
  loft(
    'glass',
    [-86.7, -86.55].map((x) => [
      [x, Y + 3.85, -3.6],
      [x, Y + westGlassApex, 0],
      [x, Y + 3.85, 3.6],
    ]),
  );
  if (detail) {
    for (const z of [-3.55, -1.2, 1.2, 3.55])
      box(f, 'frame', -86.46, Y + 0.05, z, 0.15, 3.85, 0.12);
    box(f, 'frame', -86.46, Y + 2.8, 0, 0.15, 0.13, 7.2);
    box(f, 'frame', -86.46, Y + 3.8, 0, 0.15, 0.13, 7.2);
    bar([-86.75, Y + 3.8, -3.6], [-86.75, Y + westGlassApex, 0]);
    bar([-86.75, Y + westGlassApex, 0], [-86.75, Y + 3.8, 3.6]);
    // Balcony rails stay broad panels at district distance; thin bars appear only nearby.
    box(f, 'glass', -98.8, Y + 0.08, 0, 0.08, 1.05, 8.5);
    box(f, 'frame', -98.8, Y + 1.14, 0, 0.14, 0.13, 8.55);
    for (const side of [-1, 1]) {
      bar([-98.8, Y + 1.15, side * 4.28], [-85.7, Y + 1.15, side * 4.57], 0.09);
      bar([-98.8, Y + 0.47, side * 4.28], [-85.7, Y + 0.47, side * 4.57], 0.06);
    }
  }
  // Repeated ridge frames explain the triangular light without private textures.
  const spacing = [0, 8, 3.2, 2.4][detail];
  if (spacing)
    for (const [a, b] of r.site.skylightRuns) {
      const segments = knots(a, b),
        thickness = detail === 1 ? 0.18 : 0.1;
      for (let s = 1; s < segments.length; s++) {
        const start = segments[s - 1],
          end = segments[s],
          n = Math.ceil((end - start) / spacing);
        for (let i = 0; i < n + (s === segments.length - 1 ? 1 : 0); i++) {
          const x = start + ((end - start) * i) / n;
          const [left, top, right] = ridge(x).map(([x, y, z]) => [x, y + 0.025, z]);
          bar(left, top, thickness);
          bar(top, right, thickness);
          if (detail > 1 && i < n) {
            const xn = start + ((end - start) * (i + 1)) / n;
            bar(
              left,
              ridge(xn)[1].map((v, k) => v + (k === 1 ? 0.025 : 0)),
              0.075,
            );
          }
        }
      }
    }
  for (const bridge of r.site.bridges) buildApproach(f, bar, detail, bridge);
  // The Hall of Names is part of the same underground museum. Only its visible roof light
  // is modeled; its picture-led location is retained explicitly as an approximation.
  const h = r.hallNames,
    n = [8, 12, 20, 24][detail],
    at = (i, radius, y) => [
      h.center[0] + Math.cos((i * 2 * Math.PI) / n) * radius,
      y,
      h.center[1] + Math.sin((i * 2 * Math.PI) / n) * radius,
    ],
    lower = Array.from({ length: n }, (_, i) => at(i, h.radius, h.baseY)),
    shoulder = Array.from({ length: n }, (_, i) => at(i, h.radius * 0.89, h.baseY + 0.37)),
    crown = Array.from({ length: n }, (_, i) => at(i, h.radius * 0.64, h.baseY + h.height)),
    aperture = Array.from({ length: n }, (_, i) =>
      at(i, h.radius * 0.42, h.baseY + h.height - 0.015),
    ),
    apertureWell = Array.from({ length: n }, (_, i) => at(i, h.radius * 0.42, h.baseY + 0.65));
  prism(f, 'floor', { outline: lower.map((p) => [p[0], p[2]]) }, h.foundationY, h.baseY, true);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      c = mean([lower[i], lower[j], shoulder[i], shoulder[j]]);
    f(
      'glass',
      [lower[i], lower[j], shoulder[j], shoulder[i]],
      [c[0] - h.center[0], 0.4, c[2] - h.center[1]],
    );
    f(
      'roof',
      [shoulder[i], shoulder[j], crown[j], crown[i]],
      [c[0] - h.center[0], 0.75, c[2] - h.center[1]],
    );
    f('roof', [crown[i], crown[j], aperture[j], aperture[i]], [0, 1, 0]);
    if (detail) {
      f(
        'wall',
        [aperture[i], aperture[j], apertureWell[j], apertureWell[i]],
        [h.center[0] - c[0], 0, h.center[1] - c[2]],
      );
    }
    if (detail > 1) bar(shoulder[i], crown[i], 0.058, 'roof');
  }
  f('glass', apertureWell, [0, 1, 0]);
}
