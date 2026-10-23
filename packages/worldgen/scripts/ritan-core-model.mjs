/** 'N0553': Ritan's low altar, four approaches, red circular wall and stone portals. */
import { box, loft } from './khmer-structure-geometry.mjs';

export function buildRitanCore(face, detail, r, sample) {
  const P = ([x, y, z]) => [
      r.center[0] + r.xAxis[0] * x + r.zAxis[0] * z,
      y,
      r.center[1] + r.xAxis[1] * x + r.zAxis[1] * z,
    ],
    D = ([x, y, z]) => [r.xAxis[0] * x + r.zAxis[0] * z, y, r.xAxis[1] * x + r.zAxis[1] * z],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    grade = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    },
    T = r.altarTop;
  box(f, 'base', 0, r.altarBase, 0, r.width, T - r.altarBase - 0.12, r.depth);
  box(f, 'stone', 0, T - 0.12, 0, r.width + 0.12, 0.12, r.depth + 0.12);
  if (detail > 0)
    for (const x of [-r.width / 2 + 0.16, r.width / 2 - 0.16])
      for (const z of [-r.depth / 2 + 0.16, r.depth / 2 - 0.16])
        box(f, 'stone', x, r.altarBase, z, 0.34, T - r.altarBase - 0.13, 0.34);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a),
      at = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
          [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
        ),
      half = side % 2 ? r.width / 2 : r.depth / 2,
      start = half + 3.05,
      p = [c * 0 - s * start, s * 0 + c * start],
      low = grade(...p) + 0.035,
      bottom = Math.min(low - 0.35, r.altarBase),
      count = detail === 0 ? 3 : 9;
    for (let i = 0; i < count; i++) {
      const top = low + ((T - low) * (i + 1)) / count;
      box(
        at,
        'stone',
        0,
        bottom,
        start - (3 / count) * (i + 0.5),
        3.55,
        top - bottom,
        3 / count + 0.025,
      );
    }
    // Splayed solid stone cheeks, not an invented balustrade.
    for (const x of [-1.95, 1.95]) {
      const ps = [
        [x - 0.14, low, start],
        [x + 0.14, low, start],
        [x - 0.14, T + 0.09, half],
        [x + 0.14, T + 0.09, half],
        [x - 0.14, bottom, half],
        [x + 0.14, bottom, half],
        [x - 0.14, bottom, start],
        [x + 0.14, bottom, start],
      ];
      for (const [ix, n] of [
        [
          [0, 1, 3, 2],
          [0, 1, 1],
        ],
        [
          [2, 3, 5, 4],
          [0, 0, -1],
        ],
        [
          [4, 5, 7, 6],
          [0, -1, 0],
        ],
        [
          [6, 7, 1, 0],
          [0, 0, 1],
        ],
        [
          [0, 2, 4, 6],
          [-1, 0, 0],
        ],
        [
          [1, 7, 5, 3],
          [1, 0, 0],
        ],
      ])
        at(
          'stone',
          ix.map((i) => ps[i]),
          n,
        );
    }
  }
  const R = r.radius,
    gaps = [2.0, 2.0, 6.85, 2.0].map((v) => Math.asin(v / R)),
    count = [4, 5, 12, 16][detail];
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const from = (quadrant * Math.PI) / 2 + gaps[quadrant],
      to = ((quadrant + 1) * Math.PI) / 2 - gaps[(quadrant + 1) % 4];
    for (let i = 0; i < count; i++) {
      const angles = [from + ((to - from) * i) / count, from + ((to - from) * (i + 1)) / count],
        Q = (k, radius, y) => [
          Math.cos(angles[k]) * radius,
          grade(Math.cos(angles[k]) * R, Math.sin(angles[k]) * R) + y,
          Math.sin(angles[k]) * radius,
        ],
        outer = angles.map((_, k) => Q(k, R + 0.35, -0.35)),
        inner = angles.map((_, k) => Q(k, R - 0.35, -0.35)),
        highOuter = angles.map((_, k) => Q(k, R + 0.35, 1.55)),
        highInner = angles.map((_, k) => Q(k, R - 0.35, 1.55)),
        mid = (angles[0] + angles[1]) / 2,
        normal = [Math.cos(mid), 0, Math.sin(mid)];
      f('wall', [outer[0], outer[1], highOuter[1], highOuter[0]], normal);
      f(
        'wall',
        [inner[1], inner[0], highInner[0], highInner[1]],
        normal.map((v) => -v),
      );
      f('wall', [highOuter[0], highOuter[1], highInner[1], highInner[0]], [0, 1, 0]);
      if (i === 0)
        f(
          'wall',
          [inner[0], outer[0], highOuter[0], highInner[0]],
          [Math.sin(angles[0]), 0, -Math.cos(angles[0])],
        );
      if (i === count - 1)
        f(
          'wall',
          [outer[1], inner[1], highInner[1], highOuter[1]],
          [-Math.sin(angles[1]), 0, Math.cos(angles[1])],
        );
      const section = [
        [R + 0.53, 1.55],
        [R + 0.17, 1.79],
        [R - 0.17, 1.79],
        [R - 0.53, 1.55],
      ];
      for (let j = 0; j < section.length - 1; j++)
        f(
          'roof',
          [
            Q(0, ...section[j]),
            Q(1, ...section[j]),
            Q(1, ...section[j + 1]),
            Q(0, ...section[j + 1]),
          ],
          [0, 1, 0],
        );
      if (detail >= 2) {
        const ribs = detail === 3 ? 5 : 3;
        for (let k = 1; k <= ribs; k++) {
          const a = angles[0] + ((angles[1] - angles[0]) * k) / (ribs + 1),
            b = a + 0.003;
          for (const sign of [-1, 1]) {
            const p = (a, rad, y) => [
              Math.cos(a) * rad,
              grade(Math.cos(a) * R, Math.sin(a) * R) + y,
              Math.sin(a) * rad,
            ];
            f(
              'roof',
              [
                p(a, R + sign * 0.49, 1.58),
                p(b, R + sign * 0.49, 1.58),
                p(b, R + sign * 0.15, 1.81),
                p(a, R + sign * 0.15, 1.81),
              ],
              [0, 1, 0],
            );
          }
        }
      }
    }
  }
  for (const gate of r.gates) {
    const c = Math.cos(gate.angle),
      s = Math.sin(gate.angle),
      G = ([x, y, z]) => [gate.center[0] + c * x - s * z, y, gate.center[1] + s * x + c * z],
      at = (role, ps, n) => f(role, ps.map(G), [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]]),
      centers = gate.triple ? [-4.8, 0, 4.8] : [0],
      floor = gate.floorY;
    for (const center of centers) {
      const H = gate.triple ? (center === 0 ? 4.7 : 4.3) : 4,
        span = gate.triple ? 3.4 : 3.2;
      for (const x of [center - span / 2 - 0.22, center + span / 2 + 0.22]) {
        const p = G([x, 0, 0]),
          base = Math.min(gate.baseY, grade(p[0], p[2]) - 0.3);
        box(at, 'stone', x, base, 0, 0.62, floor - base + 0.15, 0.72);
        if (detail === 0) box(at, 'stone', x, floor + 0.15, 0, 0.44, H - 0.55, 0.44);
        else
          loft(
            at,
            'stone',
            x,
            0,
            [
              [floor + 0.15, 0.62],
              [floor + 0.3, 0.49],
              [floor + H - 0.6, 0.43],
              [floor + H - 0.46, 0.58],
              [floor + H - 0.33, 0.5],
            ],
            false,
          );
        if (detail === 0)
          loft(
            at,
            'stone',
            x,
            0,
            [
              [floor + H - 0.4, 0.5],
              [floor + H, 0],
            ],
            false,
          );
        else {
          const ring = (w) =>
            Array.from({ length: detail === 3 ? 8 : 6 }, (_, i) => [
              (Math.cos((i * 2 * Math.PI) / (detail === 3 ? 8 : 6)) * w) / 2,
              (Math.sin((i * 2 * Math.PI) / (detail === 3 ? 8 : 6)) * w) / 2,
            ]);
          loft(
            at,
            'stone',
            x,
            0,
            [
              [floor + H - 0.38, 0.48],
              [floor + H - 0.21, 0.58],
              [floor + H + 0.02, 0.4],
              [floor + H + 0.26, 0.025],
            ],
            false,
            ring,
          );
        }
      }
      const openingTop = H - 1.5;
      if (detail === 0) box(at, 'stone', center, floor + openingTop, 0, span + 0.7, 0.85, 0.43);
      else {
        box(at, 'stone', center, floor + openingTop, 0, span + 0.48, 0.19, 0.42);
        box(at, 'stone', center, floor + openingTop + 0.19, 0, span + 0.25, 0.51, 0.27);
        box(at, 'stone', center, floor + openingTop + 0.7, 0, span + 0.7, 0.15, 0.43);
      }
      if (detail >= 1)
        for (const sign of [-1, 1]) {
          const x = center + sign * (span / 2 + 0.5),
            h = floor + openingTop + 0.63;
          loft(
            at,
            'stone',
            x,
            0,
            [
              [h, 0.35],
              [h + 0.22, 0.48],
              [h + 0.35, 0.19],
            ],
            false,
          );
        }
      if (gate.closed) {
        box(at, 'door', center, floor + 0.04, 0, span, openingTop - 0.05, 0.12);
        if (detail >= 2) {
          for (const x of [center - span / 2 + 0.08, center, center + span / 2 - 0.08])
            box(at, 'door', x, floor + 0.08, 0.08, 0.06, openingTop - 0.16, 0.05);
          for (let row = 0; row < 5; row++)
            for (let col = 0; col < 6; col++)
              box(
                at,
                'stone',
                center - span * 0.4 + col * span * 0.16,
                floor + 0.32 + (row * (openingTop - 0.5)) / 4,
                0.095,
                0.035,
                0.035,
                0.025,
              );
        }
      }
    }
  }
}
