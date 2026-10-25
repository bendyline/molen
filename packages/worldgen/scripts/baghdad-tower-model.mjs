/** 'baghdad_tower': mapped Baghdad broadcast tower; photo-led glazing and shared cladding. */
import { cross, normalize } from './authored-structure-mesh.mjs';
import { prism } from './khmer-structure-geometry.mjs';

export function buildBaghdadTower(face, detail, r) {
  const phase = r.phaseRadians,
    sides = [12, 24, 36, 48][detail],
    P = ([x, y, z]) => [x + r.center[0], y + r.floorY, z + r.center[1]],
    f = (role, ps, n) => face(role, ps.map(P), n),
    ring = (radius, n = sides, offset = phase) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos(offset + (i * Math.PI * 2) / n) * radius,
        Math.sin(offset + (i * Math.PI * 2) / n) * radius,
      ]),
    loft = (role, profile, n = sides, caps = true) => {
      const rings = profile.map(([y, radius]) => ring(radius, n).map(([x, z]) => [x, y, z]));
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < n; i++) {
          const k = (i + 1) % n,
            a = rings[j - 1][i],
            b = rings[j - 1][k];
          f(role, [a, b, rings[j][k], rings[j][i]], [a[0] + b[0], 0, a[2] + b[2]]);
        }
      if (caps) {
        f(role, rings[0], [0, -1, 0]);
        f(role, rings.at(-1), [0, 1, 0]);
      }
    },
    beam = (role, a, b, width, depth = width) => {
      const axis = normalize(b.map((v, i) => v - a[i])),
        u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
        v = cross(axis, u),
        end = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([x, y]) => p.map((q, k) => q + (x * u[k] * width) / 2 + (y * v[k] * depth) / 2)),
        A = end(a),
        B = end(b);
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) % 4;
        f(
          role,
          [A[i], A[k], B[k], B[i]],
          A[i].map((q, k) => q + A[(i + 1) % 4][k] - 2 * a[k]),
        );
      }
      f(
        role,
        A,
        axis.map((v) => -v),
      );
      f(role, B, axis);
    },
    collar = (radius, inner, bottom, top, n = sides, role = 'concrete') => {
      const outer = ring(radius, n),
        inside = ring(inner, n);
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          a = outer[i],
          b = outer[k],
          c = inside[i],
          d = inside[k],
          radial = [a[0] + b[0], 0, a[1] + b[1]];
        f(
          role,
          [
            [a[0], bottom, a[1]],
            [b[0], bottom, b[1]],
            [b[0], top, b[1]],
            [a[0], top, a[1]],
          ],
          radial,
        );
        f(
          role,
          [
            [c[0], bottom, c[1]],
            [d[0], bottom, d[1]],
            [d[0], top, d[1]],
            [c[0], top, c[1]],
          ],
          radial.map((v) => -v),
        );
        for (const [y, sign] of [
          [bottom, -1],
          [top, 1],
        ])
          f(
            role,
            [
              [a[0], y, a[1]],
              [b[0], y, b[1]],
              [d[0], y, d[1]],
              [c[0], y, c[1]],
            ],
            [0, sign, 0],
          );
      }
    },
    guard = (radius, y, n = 24) => {
      const points = ring(radius, n);
      for (let i = 0; i < n; i++) {
        const a = points[i],
          b = points[(i + 1) % n];
        beam('paint', [a[0], y, a[1]], [a[0], y + 0.85, a[1]], 0.065);
        for (const h of detail === 3 ? [0.4, 0.85] : [0.85])
          beam('paint', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.065);
      }
    };

  // Only the mapped tower plinth: no surrounding precinct or neighboring centre.
  for (const p of detail === 0 ? [{ outline: ring(r.radius, 12) }] : r.foundationPolygons)
    prism(f, 'base', p, r.bottomY - r.floorY, 0.44);
  for (const tier of r.baseTiers) {
    const n = 12,
      half = Math.PI / n,
      ap = Math.cos(half),
      bottom = tier.bottom,
      top = tier.top,
      h = top - bottom,
      radius = (y) =>
        (tier.lowerRadius + ((tier.upperRadius - tier.lowerRadius) * (y - bottom)) / h) * ap;
    loft(
      'concrete',
      [
        [bottom, tier.lowerRadius],
        [top, tier.upperRadius],
      ],
      n,
    );
    for (let i = 0; i < n; i++) {
      const angle = phase + ((i + 0.5) * Math.PI * 2) / n,
        normal = [Math.cos(angle), 0, Math.sin(angle)],
        tangent = [-normal[2], 0, normal[0]],
        width = tier.upperRadius * Math.sin(half) * 1.42,
        map = ([u, y], offset = 0.025) => [
          normal[0] * (radius(y) + offset) + tangent[0] * u,
          y,
          normal[2] * (radius(y) + offset) + tangent[2] * u,
        ],
        lo = bottom + 0.32,
        shoulder = bottom + h * 0.58,
        hi = top - 0.28,
        arch =
          detail === 0
            ? [
                [-width / 2, lo],
                [width / 2, lo],
                [width / 2, hi],
                [-width / 2, hi],
              ]
            : [
                [-width / 2, lo],
                [width / 2, lo],
                ...Array.from({ length: detail === 3 ? 9 : 5 }, (_, j) => {
                  const a = (j * Math.PI) / (detail === 3 ? 8 : 4);
                  return [(Math.cos(a) * width) / 2, shoulder + Math.sin(a) * (hi - shoulder)];
                }),
              ];
      f(
        'glass',
        arch.map((p) => map(p)),
        normal,
      );
      if (detail >= 1) {
        if (detail >= 2)
          for (let k = 0; k < arch.length; k++)
            beam('paint', map(arch[k], 0.07), map(arch[(k + 1) % arch.length], 0.07), 0.13, 0.1);
        beam('paint', map([0, lo], 0.07), map([0, hi], 0.07), 0.12, 0.1);
      }
    }
    if (detail >= 2) guard(tier.upperRadius + 0.05, top, 24);
  }

  // Four real recessed closed vertical glazing strips, with opaque side reveals.
  const points = ring(r.shaftRadius),
    low = r.shaftBottom,
    high = r.shaftTop;
  for (let i = 0; i < sides; i++) {
    const k = (i + 1) % sides,
      a = points[i],
      b = points[k],
      n = normalize([a[0] + b[0], 0, a[1] + b[1]]),
      outer = [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ];
    if (detail > 0 && i % (sides / 4) === 0) {
      const inner = outer.map((p) => p.map((v, k) => v - n[k] * 0.2));
      f('glass', inner, n);
      for (let j = 0; j < 4; j++) {
        const next = (j + 1) % 4,
          mid = outer[j].map((v, k) => (v + outer[next][k]) / 2),
          center = outer.reduce((p, q) => p.map((v, k) => v + q[k] / 4), [0, 0, 0]);
        f(
          'shaft',
          [outer[j], outer[next], inner[next], inner[j]],
          center.map((v, k) => v - mid[k]),
        );
      }
      if (detail >= 2)
        for (let y = 15; y < 101; y += 4)
          beam('dark', [inner[0][0], y, inner[0][2]], [inner[1][0], y, inner[1][2]], 0.08);
    } else f('shaft', outer, n);
  }
  for (const [y, sign] of [
    [low, -1],
    [high, 1],
  ])
    f(
      'shaft',
      points.map(([x, z]) => [x, y, z]),
      [0, sign, 0],
    );
  for (const y of r.collars) {
    collar(r.collarRadius, r.shaftRadius, y, y + 1, detail === 0 ? 8 : 24);
    if (detail >= 2) guard(r.collarRadius - 0.15, y + 1, 24);
  }
  loft(
    'concrete',
    detail === 0 ? [r.bowlProfile[0], r.bowlProfile[3], r.bowlProfile.at(-1)] : r.bowlProfile,
    12,
  );
  if (detail >= 2)
    for (let i = 0; i < 12; i++) {
      const a = phase + (i * Math.PI) / 6;
      for (let j = 1; j < r.bowlProfile.length; j++) {
        const [y, radius] = r.bowlProfile[j - 1],
          [v, s] = r.bowlProfile[j];
        beam(
          'paint',
          [Math.cos(a) * (radius + 0.06), y, Math.sin(a) * (radius + 0.06)],
          [Math.cos(a) * (s + 0.06), v, Math.sin(a) * (s + 0.06)],
          0.18,
        );
      }
    }
  loft(
    'glass',
    [
      [r.crownBottom, r.crownRadius],
      [r.crownTop, r.crownRadius],
    ],
    12,
  );
  if (detail >= 1) {
    collar(r.crownRadius + 0.08, r.crownRadius - 0.16, r.crownBottom, r.crownBottom + 0.36, 12);
    collar(r.crownRadius + 0.08, r.crownRadius - 0.16, r.crownTop - 0.4, r.crownTop, 12);
    for (const [x, z] of ring(r.crownRadius + 0.04, 12))
      beam('concrete', [x, r.crownBottom, z], [x, r.crownTop, z], 0.32);
    if (detail >= 2)
      for (const y of [r.crownBottom + 3.1, r.crownBottom + 6.4])
        collar(r.crownRadius + 0.05, r.crownRadius - 0.03, y, y + 0.16, 12, 'paint');
  }
  // Twelve mapped sectors retain a central well below the separate upper cap.
  for (const web of r.crownWebs)
    for (const p of web.polygons) prism(f, 'concrete', p, web.bottom, web.top);
  loft(
    'concrete',
    [
      [r.capBottom, r.capRadius],
      [r.capTop, r.capRadius],
    ],
    detail === 0 ? 8 : 24,
  );
  for (let i = 0; i < r.antenna.length; i++) {
    const [bottom, top, radius] = r.antenna[i],
      n = detail === 0 ? 4 : detail === 1 ? 8 : 12;
    if (detail === 0)
      loft(
        i % 2 ? 'paint' : 'red',
        [
          [bottom, radius],
          [top, radius],
        ],
        n,
      );
    else {
      const bands = Math.max(1, Math.ceil((top - bottom) / 3));
      for (let j = 0; j < bands; j++)
        loft(
          (j + i) % 2 ? 'paint' : 'red',
          [
            [bottom + (j * (top - bottom)) / bands, radius],
            [bottom + ((j + 1) * (top - bottom)) / bands, radius],
          ],
          n,
          false,
        );
      f(
        'paint',
        ring(radius, n).map(([x, z]) => [x, top, z]),
        [0, 1, 0],
      );
    }
  }
}
