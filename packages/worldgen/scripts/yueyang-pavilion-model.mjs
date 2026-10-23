/** 'N0617': Yueyang's three golden swept roofs and open red-timber balcony. */
import { cross, normalize } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYueyangPavilion(face, detail, r, sample) {
  const P = ([x, y, z]) => [
      r.center[0] + x * r.xAxis[0] + z * r.zAxis[0],
      r.floorY + y,
      r.center[1] + x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, n) => face(role, points.map(P), D(n)),
    beam = (role, a, b, width, depth = width) => {
      const axis = normalize(b.map((v, k) => v - a[k])),
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
    cylinder = (role, x, z, radius, bottom, top, n = detail === 0 ? 4 : 8) =>
      prism(
        f,
        role,
        {
          outline: Array.from({ length: n }, (_, i) => [
            x + Math.cos((i * Math.PI * 2) / n) * radius,
            z + Math.sin((i * Math.PI * 2) / n) * radius,
          ]),
        },
        bottom,
        top,
      );

  box(f, 'stone', 0, r.bottomY - r.floorY, 0, r.width, 0.65 - r.bottomY + r.floorY, r.depth);
  if (detail > 0) box(f, 'stone', 0, 0.56, 0, r.width + 0.1, 0.12, r.depth + 0.1);
  // Supported treads meet the retained coarse DEM; no broad frontage platform.
  for (const sign of [-1, 1]) {
    const reach = r.depth / 2 + 1.7,
      p = P([0, 0, sign * reach]),
      grade = sample(p[0], p[2]) - r.floorY + 0.03,
      count = detail === 0 ? 2 : 5,
      bottom = Math.min(grade - 0.3, r.bottomY - r.floorY);
    for (let i = 0; i < count; i++) {
      const top = grade + ((0.65 - grade) * (i + 1)) / count;
      box(
        f,
        'stone',
        0,
        bottom,
        sign * (reach - (1.7 * (i + 0.5)) / count),
        3.2,
        top - bottom,
        1.7 / count + 0.01,
      );
    }
  }

  for (let floorIndex = 0; floorIndex < r.floors.length; floorIndex++) {
    const b = r.floors[floorIndex],
      base = b.bottom,
      top = b.top,
      cw = b.columnWidth,
      cd = b.columnDepth;
    box(f, 'panel', 0, base, 0, b.width, top - base, b.depth);
    if (floorIndex > 0) box(f, 'timber', 0, base - 0.22, 0, cw + 0.35, 0.24, cd + 0.35);
    const columns = [];
    for (const z of [-cd / 2, cd / 2])
      for (const x of detail === 0 ? [-cw / 2, 0, cw / 2] : [-cw / 2, -cw / 4, 0, cw / 4, cw / 2])
        columns.push([x, z]);
    if (detail > 0)
      for (const x of [-cw / 2, cw / 2]) for (const z of [-cd / 4, 0, cd / 4]) columns.push([x, z]);
    for (const [x, z] of columns) {
      if (detail === 0 && floorIndex === 2) continue;
      cylinder('timber', x, z, floorIndex === 0 ? 0.23 : 0.18, base, top);
      if (detail >= 2) {
        cylinder('stone', x, z, floorIndex === 0 ? 0.3 : 0.22, base, base + 0.17);
        box(f, 'timber', x, top - 0.48, z, 0.72, 0.2, 0.55);
        box(f, 'timber', x, top - 0.24, z, 1.02, 0.2, 0.8);
      }
    }
    // Real open wraparound middle balcony: posts and rails, never filled sheets.
    if (floorIndex === 1) {
      const outline = [
        [-cw / 2, -cd / 2],
        [cw / 2, -cd / 2],
        [cw / 2, cd / 2],
        [-cw / 2, cd / 2],
      ];
      for (let side = 0; side < 4; side++) {
        const a = outline[side],
          b = outline[(side + 1) % 4],
          count = detail === 0 ? 2 : detail === 1 ? 4 : 6,
          at = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t];
        for (const y of [base + 0.3, base + 1.05])
          beam('lattice', at(0, y), at(1, y), detail === 0 ? 0.18 : 0.1);
        for (let i = 0; i <= count; i++)
          beam('lattice', at(i / count, base + 0.2), at(i / count, base + 1.1), 0.13);
        if (detail >= 2)
          for (let i = 0; i < count; i++) {
            const t0 = (i + 0.16) / count,
              t1 = (i + 0.84) / count,
              mid = (i + 0.5) / count;
            beam('lattice', at(t0, base + 0.42), at(mid, base + 0.42), 0.075);
            beam('lattice', at(mid, base + 0.42), at(mid, base + 0.85), 0.075);
            beam('lattice', at(mid, base + 0.85), at(t1, base + 0.85), 0.075);
            if (detail === 3) {
              beam('lattice', at(t0, base + 0.42), at(t0, base + 0.68), 0.075);
              beam('lattice', at(t1, base + 0.63), at(t1, base + 0.85), 0.075);
            }
          }
      }
    }
    if (detail > 0) {
      // Closed timber/lattice doors and shutters; no invented transparent blue glass.
      for (let side = 0; side < 4; side++) {
        const c = Math.cos((side * Math.PI) / 2),
          s = Math.sin((side * Math.PI) / 2),
          width = side % 2 ? b.depth : b.width,
          depth = side % 2 ? b.width : b.depth,
          at = ([x, y, z]) => [c * x - s * z, y, s * x + c * z],
          normal = [-s, 0, c],
          map = (role, ps, n) =>
            f(role, ps.map(at), [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]]),
          bays = floorIndex === 0 ? 5 : 3;
        for (let i = 0; i < bays; i++) {
          const x = ((i - (bays - 1) / 2) * width) / bays,
            w = (width / bays) * 0.77,
            lo = base + 0.45,
            hi = top - 0.45,
            z = depth / 2 + 0.018;
          f(
            'lattice',
            [
              at([x - w / 2, lo, z]),
              at([x + w / 2, lo, z]),
              at([x + w / 2, hi, z]),
              at([x - w / 2, hi, z]),
            ],
            normal,
          );
          if (detail >= 2) {
            for (const xx of [x - w / 2, x, x + w / 2])
              box(map, 'panel', xx, lo, z + 0.035, 0.09, hi - lo, 0.08);
            for (const y of [lo, lo + (hi - lo) * 0.4, hi - 0.1])
              box(map, 'panel', x, y, z + 0.035, w, 0.1, 0.08);
            if (detail === 3)
              for (const fraction of [0.25, 0.75])
                box(
                  map,
                  'panel',
                  x - w / 2 + w * fraction,
                  lo + (hi - lo) * 0.4,
                  z + 0.035,
                  0.065,
                  (hi - lo) * 0.6,
                  0.08,
                );
          }
        }
      }
      // Unlettered tablet: no copied or invented Chinese inscription.
      if (floorIndex === 2)
        for (const z of [-b.depth / 2 - 0.08, b.depth / 2 + 0.08])
          box(f, 'timber', 0, top - 0.85, z, b.width * 0.62, 0.62, 0.13);
    }
  }

  for (let roofIndex = 0; roofIndex < r.roofs.length; roofIndex++) {
    const b = r.roofs[roofIndex],
      segments = [2, 3, 4, 6][detail],
      perimeter = (w, d) =>
        [
          [-w / 2, -d / 2],
          [w / 2, -d / 2],
          [w / 2, d / 2],
          [-w / 2, d / 2],
        ].flatMap((a, i, all) => {
          const z = all[(i + 1) % 4];
          return Array.from({ length: segments }, (_, k) => ({
            x: a[0] + ((z[0] - a[0]) * k) / segments,
            z: a[1] + ((z[1] - a[1]) * k) / segments,
            corner: (1 - (2 * k) / segments) ** 2,
          }));
        }),
      ridge = b.width * 0.44,
      profiles =
        detail === 0
          ? [
              [1, 1, 0, 1],
              [0.78, 0.7, 0.18, 0],
              [0.44, 0.025, 1, 0],
            ]
          : [
              [1, 1, 0, 1],
              [0.91, 0.9, -0.035, 0.32],
              [0.7, 0.6, 0.26, 0.02],
              [0.44, 0.025, 1, 0],
            ],
      rings = profiles.map(([w, d, h, up], k) =>
        perimeter(b.width * w, b.depth * d).map((p) => [
          p.x,
          b.low +
            b.rise * h +
            b.lift * up * p.corner +
            (roofIndex === 2 && k === profiles.length - 1
              ? 0.35 * (1 - (p.x / (ridge / 2)) ** 2)
              : 0),
          p.z,
        ]),
      ),
      n = rings[0].length,
      thickness = detail === 0 ? 0.16 : 0.18;
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          ps = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
        f('roof', ps, [0, 1, 0]);
        f(
          'timber',
          ps.map((p) => [p[0], p[1] - thickness, p[2]]),
          [0, -1, 0],
        );
      }
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = rings[0][i],
        b = rings[0][k];
      f(
        'timber',
        [a, b, [b[0], b[1] - thickness, b[2]], [a[0], a[1] - thickness, a[2]]],
        [a[0] + b[0], 0, a[2] + b[2]],
      );
    }
    // Close the narrow curved ridge with corresponding strips, not a planar fan.
    const top = rings.at(-1),
      half = segments * 2;
    for (let i = 0; i < segments; i++) {
      const a = top[i],
        b = top[i + 1],
        c = top[(half + segments - i - 1) % n],
        d = top[(half + segments - i) % n];
      f('roof', [a, b, c, d], [0, 1, 0]);
      f(
        'timber',
        [a, b, c, d].map((p) => [p[0], p[1] - thickness, p[2]]),
        [0, -1, 0],
      );
    }
    for (const side of [1, 3])
      for (let i = 0; i < segments; i++) {
        const a = top[side * segments + i],
          b = top[(side * segments + i + 1) % n];
        f(
          'timber',
          [a, b, [b[0], b[1] - thickness, b[2]], [a[0], a[1] - thickness, a[2]]],
          [side === 1 ? 1 : -1, 0, 0],
        );
      }
    if (detail > 0)
      for (let corner = 0; corner < 4; corner++) {
        for (let j = 1; j < rings.length; j++) {
          const a = rings[j - 1][corner * segments],
            b = rings[j][corner * segments];
          beam('roof', [a[0], a[1] + 0.09, a[2]], [b[0], b[1] + 0.09, b[2]], 0.16);
        }
      }
  }
  const y = r.roofs[2].low + r.roofs[2].rise + 0.35;
  for (const [low, high, rad] of [
    [y, y + 0.15, 0.24],
    [y + 0.15, r.finialTop - 0.2, 0.15],
    [r.finialTop - 0.2, r.finialTop, 0.08],
  ])
    cylinder('roof', 0, 0, rad, low, high, detail === 0 ? 4 : 8);
}
