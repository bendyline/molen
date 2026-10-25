/** mala_strana_bridge_tower: connected unequal bridge towers, open pointed gate and slate roof silhouettes. */
import earcut from 'earcut';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildMalaStranaMasonry(face, detail, r, sample) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), P(normal)),
    F = r.floorY,
    ground = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    },
    polygon = (role, rings, map, n) => {
      const points = rings.flat(),
        holes = [];
      let count = rings[0].length;
      for (const h of rings.slice(1)) {
        holes.push(count);
        count += h.length;
      }
      const ids = earcut(points.flat(), holes);
      for (let i = 0; i < ids.length; i += 3)
        f(
          role,
          ids.slice(i, i + 3).map((k) => map(points[k])),
          n,
        );
    },
    arch = (center, width, bottom, spring, crown, steps) => {
      const a = width / 2,
        rise = crown - spring,
        radius = (rise * rise + a * a) / (2 * a),
        shift = radius - a,
        ps = [
          [center - a, bottom],
          [center + a, bottom],
          [center + a, spring],
        ];
      for (let i = 1; i <= steps; i++) {
        const x = a * (1 - i / steps);
        ps.push([
          center + x,
          spring + Math.sqrt(Math.max(0, radius * radius - (x + shift) * (x + shift))),
        ]);
      }
      for (let i = 1; i <= steps; i++) {
        const x = (a * i) / steps;
        ps.push([
          center - x,
          spring + Math.sqrt(Math.max(0, radius * radius - (x + shift) * (x + shift))),
        ]);
      }
      return ps;
    },
    solid = (role, rings, back, front, map, normal, tangent) => {
      polygon(role, rings, (p) => map(p, front), normal);
      polygon(
        role,
        rings,
        (p) => map(p, back),
        normal.map((v) => -v),
      );
      for (let k = 0; k < rings.length; k++) {
        const ring = rings[k],
          sign =
            Math.sign(
              ring.reduce(
                (s, p, i) =>
                  s + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
                0,
              ),
            ) * (k ? -1 : 1);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            b = ring[(i + 1) % ring.length],
            u = (b[1] - a[1]) * sign,
            y = (a[0] - b[0]) * sign;
          f(
            role,
            [map(a, back), map(b, back), map(b, front), map(a, front)],
            [tangent[0] * u, y, tangent[2] * u],
          );
        }
      }
    },
    circle = (s, y, radius, n) =>
      Array.from({ length: n }, (_, i) => [
        s + radius * Math.cos((i * Math.PI * 2) / n),
        y + radius * Math.sin((i * Math.PI * 2) / n),
      ]);

  // Separate occupied foundations: no slab closes the native passage between towers.
  for (const part of [r.main, r.lower]) {
    const bottom = Math.min(...part.outline.map((p) => ground(...p))) - 0.45;
    prism(f, 'stone', { outline: part.outline, holes: [] }, bottom, F + 0.18);
    prism(f, 'wall', { outline: part.outline, holes: [] }, F + 0.18, F + part.height);
  }
  const G = r.gallery,
    M = r.main,
    L = r.lower;
  for (const [y, height, margin] of detail === 0
    ? [[25.8, 1.05, 0.12]]
    : [
        [25.5, 0.28, -0.18],
        [25.78, 0.32, 0.06],
        [26.1, 0.4, 0.25],
        [26.5, 0.35, 0.12],
      ]) {
    box(f, 'stone', G.center[0], F + y, G.center[1], G.width + margin, height, G.depth + margin);
  }
  prism(f, 'wall', { outline: r.roof.outline, holes: [] }, F + 26.8, F + 29.05);
  // A genuinely pierced gallery surrounds the central roof room.
  for (let side = 0; side < 4; side++) {
    const alongX = side % 2 === 0,
      sign = side < 2 ? -1 : 1,
      length = (alongX ? G.width : G.depth) - 1.6,
      fixed =
        (alongX ? G.center[1] : G.center[0]) + sign * ((alongX ? G.depth : G.width) / 2 - 0.26),
      center = alongX ? G.center[0] : G.center[1],
      rail = (s, y, w, h, d) =>
        box(
          f,
          'stone',
          alongX ? s : fixed,
          F + y,
          alongX ? fixed : s,
          alongX ? w : d,
          h,
          alongX ? d : w,
        );
    rail(center, 26.85, length, 0.42, 0.38);
    rail(center, 28.5, length, 0.28, 0.4);
    if (detail > 0) {
      const n = detail === 1 ? 3 : 5;
      for (let j = 1; j < n; j++)
        rail(center - length / 2 + (length * j) / n, 27.25, 0.26, 1.25, 0.38);
    }
  }
  const radial = (role, x, z, profile, n) =>
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => [
        (w / 2) * Math.cos((i * Math.PI * 2) / n),
        (w / 2) * Math.sin((i * Math.PI * 2) / n),
      ]),
    );
  for (const turret of r.turrets) {
    const [x, z] = turret.center,
      diameter = (turret.width + turret.depth) / 2,
      n = detail === 0 ? 6 : 8;
    radial(
      'stone',
      x,
      z,
      [
        [F + 24.7, diameter * 0.45],
        [F + 25.7, diameter],
        [F + 29.0, diameter],
        [F + 29.35, diameter * 1.13],
      ],
      n,
    );
    radial(
      'roof',
      x,
      z,
      [
        [F + 29.35, diameter * 1.13],
        [F + 35.4, 0.07],
      ],
      n,
    );
    box(f, 'metal', x, F + 35.4, z, 0.08, 0.6, 0.08);
  }
  // Four sloping faces and a closed narrow ridge, with two supported finials.
  function hip(part, base, ridge, capWidth, capDepth) {
    const [x, z] = part.center,
      w = part.width + 0.45,
      d = part.depth + 0.45,
      low = rect(x, z, w, d).outline.map(([x, z]) => [x, F + base, z]),
      high = rect(x, z, capWidth, capDepth).outline.map(([x, z]) => [x, F + ridge, z]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        a = low[i],
        b = low[j];
      f('roof', [a, b, high[j], high[i]], [b[2] - a[2], 1, a[0] - b[0]]);
    }
    polygon(
      'roof',
      [rect(x, z, capWidth, capDepth).outline],
      ([x, z]) => [x, F + ridge, z],
      [0, 1, 0],
    );
    polygon('roof', [rect(x, z, w, d).outline], ([x, z]) => [x, F + base, z], [0, -1, 0]);
    for (const s of [-1, 1]) {
      box(f, 'metal', x, F + ridge, z + (s * capDepth) / 2, 0.09, part.height - ridge, 0.09);
      if (detail > 0)
        radial(
          'metal',
          x,
          z + (s * capDepth) / 2,
          [
            [F + part.height - 0.45, 0.2],
            [F + part.height - 0.25, 0.06],
          ],
          6,
        );
    }
    if (detail > 1)
      for (let i = 0; i < 4; i++) {
        const a = low[i],
          b = high[i],
          dx = b[0] - a[0],
          dy = b[1] - a[1],
          dz = b[2] - a[2],
          length = Math.hypot(dx, dy, dz);
        // The hip seams are one continuous strip rather than tiles per cell.
        const side = [
          (-dz / Math.max(0.001, Math.hypot(dx, dz))) * 0.04,
          0,
          (dx / Math.max(0.001, Math.hypot(dx, dz))) * 0.04,
        ];
        if (length > 0)
          f(
            'roof',
            [
              a.map((v, k) => v + side[k]),
              b.map((v, k) => v + side[k] + (k === 1 ? 0.025 : 0)),
              b.map((v, k) => v - side[k] + (k === 1 ? 0.025 : 0)),
              a.map((v, k) => v - side[k]),
            ],
            [0, 1, 0],
          );
      }
  }
  hip(r.roof, 29.05, 44.65, 0.5, 2.5);
  hip(r.lowerRoof, 16.5, 28.05, 0.5, 3.1);

  // The real passage runs east-west, through the gate between the two towers.
  const gate = r.gate,
    center = gate.center[1],
    outer = [
      [gate.center[1] - gate.depth / 2, r.minGround - 0.8],
      [gate.center[1] + gate.depth / 2, r.minGround - 0.8],
      [gate.center[1] + gate.depth / 2, F + 11.2],
      [gate.center[1] - gate.depth / 2, F + 11.2],
    ],
    throat = arch(
      center,
      5.0,
      r.minGround - 0.4,
      F + 4.6,
      F + 8.0,
      detail === 0 ? 2 : detail === 1 ? 4 : 8,
    ),
    map = ([s, y], depth) => [depth, y, s],
    left = gate.center[0] - gate.width / 2,
    right = gate.center[0] + gate.width / 2;
  solid('wall', [outer, throat], left, right, map, [1, 0, 0], [0, 0, 1]);
  for (const sign of [-1, 1]) {
    const x = gate.center[0] + (sign * gate.width) / 2;
    box(f, 'stone', x, F + 10.85, center, 0.28, 0.38, gate.depth + 0.12);
    const crenels = detail === 0 ? 3 : 5;
    for (let i = 0; i < crenels; i++)
      box(
        f,
        'stone',
        x,
        F + 11.2,
        center - gate.depth / 2 + (gate.depth * (i + 0.5)) / crenels,
        0.48,
        0.8,
        gate.depth / (crenels * 1.65),
      );
    if (detail > 0) {
      const frameOuter = arch(
          center,
          5.56,
          r.minGround - 0.4,
          F + 4.65,
          F + 8.5,
          detail === 1 ? 4 : 8,
        ),
        frameInner = arch(
          center,
          5.08,
          r.minGround - 0.4,
          F + 4.65,
          F + 8.05,
          detail === 1 ? 4 : 8,
        );
      solid(
        'stone',
        [frameOuter, frameInner],
        x + sign * 0.02,
        x + sign * 0.17,
        map,
        [sign, 0, 0],
        [0, 0, 1],
      );
      // Blank original geometric plaques evoke relief rhythm without copied heraldry.
      if (detail > 1)
        for (const t of [-1.8, 0, 1.8]) {
          const shield = [
            [center + t - 0.38, F + 9.0],
            [center + t + 0.38, F + 9.0],
            [center + t + 0.32, F + 9.7],
            [center + t - 0.32, F + 9.7],
          ];
          solid('stone', [shield], x + sign * 0.02, x + sign * 0.16, map, [sign, 0, 0], [0, 0, 1]);
        }
    }
  }

  // Closed inset panels, shallow blind Gothic relief and lower Renaissance dormer.
  function facades(part) {
    const ps = part.outline,
      sign = Math.sign(
        ps.reduce(
          (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
    return ps
      .map((a, i) => {
        const b = ps[(i + 1) % ps.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          n = [u[2] * sign, 0, -u[0] * sign];
        return {
          a,
          b,
          len,
          u,
          n,
          map: ([s, y], depth) => [
            a[0] + u[0] * s + n[0] * depth,
            F + y,
            a[1] + u[2] * s + n[2] * depth,
          ],
        };
      })
      .filter((e) => e.len > 6);
  }
  if (detail > 0)
    for (const part of [M, L])
      for (const edge of facades(part)) {
        const { map, n, u, len } = edge,
          east = n[0] > 0.8;
        const rows = part === M ? [5.0, 10.8, 22.8] : [4.2, 9.1, 13.7];
        for (const y of rows) {
          const fractions = part === M ? [0.5] : detail === 1 ? [0.35, 0.65] : [0.24, 0.5, 0.76];
          for (const t of fractions) {
            if (part === M && east && y === 22.8) continue;
            const s = len * t,
              w = part === M ? 1.05 : 0.92,
              h = part === M ? 1.6 : 1.3,
              outer = [
                [s - w / 2 - 0.15, y - 0.14],
                [s + w / 2 + 0.15, y - 0.14],
                [s + w / 2 + 0.15, y + h + 0.15],
                [s - w / 2 - 0.15, y + h + 0.15],
              ],
              inner = [
                [s - w / 2, y],
                [s + w / 2, y],
                [s + w / 2, y + h],
                [s - w / 2, y + h],
              ];
            solid('stone', [outer, inner], 0.01, 0.16, map, n, u);
            solid('panel', [inner], 0.025, 0.04, map, n, u);
            if (detail > 1)
              solid(
                'stone',
                [
                  [
                    [s - 0.055, y],
                    [s + 0.055, y],
                    [s + 0.055, y + h],
                    [s - 0.055, y + h],
                  ],
                ],
                0.05,
                0.14,
                map,
                n,
                u,
              );
          }
        }
        if (part === M && east) {
          for (const t of [0.22, 0.5, 0.78]) {
            const s = len * t,
              base = 13.8,
              outer = arch(s, 2.35, base, 18.2, 20.7, detail === 1 ? 3 : 6),
              inner = arch(s, 1.95, base + 0.2, 18.2, 20.35, detail === 1 ? 3 : 6);
            solid('stone', [outer, inner], 0.015, 0.18, map, n, u);
            if (detail > 1)
              solid(
                'stone',
                [
                  [
                    [s - 0.055, 14.0],
                    [s + 0.055, 14.0],
                    [s + 0.055, 19.4],
                    [s - 0.055, 19.4],
                  ],
                ],
                0.04,
                0.12,
                map,
                n,
                u,
              );
          }
          if (detail > 1)
            solid(
              'stone',
              [circle(len * 0.5, 21.65, 0.63, 12), circle(len * 0.5, 21.65, 0.4, 12)],
              0.02,
              0.18,
              map,
              n,
              u,
            );
        }
        if (detail > 1) {
          // Broad floor bands are continuous and stop at each actual footprint corner.
          for (const y of part === M ? [8.5, 12.8, 24.5] : [7.2, 12.2, 16.2])
            solid(
              'stone',
              [
                [
                  [0.04, y],
                  [len - 0.04, y],
                  [len - 0.04, y + 0.2],
                  [0.04, y + 0.2],
                ],
              ],
              0.005,
              0.12,
              map,
              n,
              u,
            );
        }
      }
  if (detail > 0) {
    const [x, z] = r.lowerRoof.center,
      xx = x + r.lowerRoof.width / 2 + 0.12,
      map = ([s, y], depth) => [depth, F + y, s],
      profile = [
        [z - 1.6, 16.4],
        [z + 1.6, 16.4],
        [z + 1.6, 17.4],
        [z + 1.15, 17.4],
        [z + 1.15, 18.3],
        [z + 0.68, 18.3],
        [z + 0.68, 19.2],
        [z + 0.28, 19.2],
        [z + 0.28, 19.7],
        [z - 0.28, 19.7],
        [z - 0.28, 19.2],
        [z - 0.68, 19.2],
        [z - 0.68, 18.3],
        [z - 1.15, 18.3],
        [z - 1.15, 17.4],
        [z - 1.6, 17.4],
      ];
    solid('stone', [profile], xx - 2.1, xx + 0.15, map, [1, 0, 0], [0, 0, 1]);
    solid(
      'panel',
      [
        [
          [z - 0.4, 16.8],
          [z + 0.4, 16.8],
          [z + 0.4, 17.8],
          [z - 0.4, 17.8],
        ],
      ],
      xx + 0.16,
      xx + 0.18,
      map,
      [1, 0, 0],
      [0, 0, 1],
    );
  }
}
