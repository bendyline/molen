/** Ernst-Happel's roof annulus, white collar truss, open concrete frame and blue track. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildHappelStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, normal) => face(role, ps.map(P), D(normal)),
    count = [16, 32, 48, 64][detail],
    cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    radius = (poly, angle) => {
      const d = [Math.cos(angle), Math.sin(angle)],
        hits = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length],
          v = b.map((n, k) => n - a[k]),
          den = cross(d, v);
        if (Math.abs(den) < 1e-8) continue;
        const t = cross(a, v) / den,
          u = cross(a, d) / den;
        if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
      }
      if (!hits.length) throw Error(`Happel outline is not radial at ${angle}`);
      return Math.min(...hits);
    },
    point = (R, a, y) => [R * Math.cos(a), y, R * Math.sin(a)],
    at = (t, a, y = 0) => {
      const lo = radius(r.inner, a),
        hi = radius(r.outer, a) * 0.94;
      return point(lo + (hi - lo) * t, a, y);
    },
    outside = (a, y, scale = 1) => point(radius(r.outer, a) * scale, a, y),
    opening = (a, y, offset = 0) => point(radius(r.roofInner, a) + offset, a, y),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    band = (role, t0, t1, y0, y1, thick = 0.35, aisle = false) => {
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count,
          mid = (a + b) / 2,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          below = ps.map(([x, y, z]) => [x, y - thick, z]),
          surface =
            role === 'seatBlue' && Math.sin(mid) > 0.1 && Math.abs(Math.cos(mid)) > 0.25
              ? 'seatGold'
              : role;
        if (aisle && i % 2 === 0) {
          const p = ps[0].map((n, k) => n + (ps[1][k] - n) * 0.1),
            q = ps[3].map((n, k) => n + (ps[2][k] - n) * 0.1);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(surface, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(surface, ps, [0, 1, 0]);
        if (detail > 1) {
          f('wall', below, [0, -1, 0]);
          f(surface, [lo[0], below[0], below[1], lo[1]], [-Math.cos(mid), 0, -Math.sin(mid)]);
          f('wall', [hi[0], hi[1], below[2], below[3]], [Math.cos(mid), 0, Math.sin(mid)]);
        }
      }
    },
    belt = (lo, hi) => {
      const poly = Array.from({ length: count }, (_, i) => {
        const p = outside((i * Math.PI * 2) / count, 0);
        return [p[0], p[2]];
      });
      if (detail > 1)
        prism(
          f,
          'wall',
          { outline: poly, holes: [poly.map((p) => p.map((v) => v * 0.9))] },
          lo,
          hi,
        );
      else
        for (let i = 0; i < count; i++) {
          const a = (i * Math.PI * 2) / count,
            b = ((i + 1) * Math.PI * 2) / count,
            m = (a + b) / 2;
          f(
            'wall',
            [outside(a, lo), outside(b, lo), outside(b, hi), outside(a, hi)],
            [Math.cos(m), 0, Math.sin(m)],
          );
          if (detail === 1)
            f(
              'wall',
              [outside(a, hi, 0.9), outside(b, hi, 0.9), outside(b, hi), outside(a, hi)],
              [0, 1, 0],
            );
        }
    },
    capsule = (R, steps) => [
      ...Array.from({ length: steps + 1 }, (_, i) => {
        const a = -Math.PI / 2 + (Math.PI * i) / steps;
        return [
          r.fieldCenter[0] + r.trackStraightHalf + R * Math.cos(a),
          r.fieldCenter[1] + R * Math.sin(a),
        ];
      }),
      ...Array.from({ length: steps + 1 }, (_, i) => {
        const a = Math.PI / 2 + (Math.PI * i) / steps;
        return [
          r.fieldCenter[0] - r.trackStraightHalf + R * Math.cos(a),
          r.fieldCenter[1] + R * Math.sin(a),
        ];
      }),
    ];
  const foot = Array.from({ length: count }, (_, i) => {
    const p = outside((i * Math.PI * 2) / count, 0);
    return [p[0], p[2]];
  });
  prism(
    f,
    'wall',
    { outline: foot, holes: [foot.map((p) => p.map((v) => v * 0.97))] },
    r.minGround - F - 0.3,
    0.3,
  );
  for (const [lo, hi] of detail
    ? [
        [0.3, 0.75],
        [5.8, 6.2],
        [11.6, 12.0],
        [18.8, 19.4],
      ]
    : [
        [0.3, 0.75],
        [18.8, 19.4],
      ])
    belt(lo, hi);
  const columns = [8, 32, 48, 64][detail];
  for (let i = 0; i < columns; i++) {
    const a = (i * Math.PI * 2) / columns;
    bar('wall', outside(a, 0.3, 0.994), outside(a, 19.4, 0.994), detail ? 1.15 : 1.7, 1.4);
  }
  const rows = detail === 3 ? [8, 8, 10] : detail === 2 ? [4, 4, 5] : [1, 1, 1];
  for (const [ti, tier] of r.tiers.entries()) {
    for (let i = 0; i < rows[ti]; i++) {
      const a = i / rows[ti],
        b = (i + 1) / rows[ti],
        t0 = tier.t0 + (tier.t1 - tier.t0) * a,
        t1 = tier.t0 + (tier.t1 - tier.t0) * b;
      if (detail < 2) band('seatBlue', t0, t1, tier.y0, tier.y1);
      else {
        const y = tier.y0 + (tier.y1 - tier.y0) * b;
        band('seatBlue', t0, t1, y, y, (tier.y1 - tier.y0) / rows[ti] + 0.1, true);
      }
    }
  }
  for (const [t0, t1, y] of [
    [0.27, 0.32, 5.7],
    [0.61, 0.66, 11.4],
  ])
    band('wall', t0, t1, y, y, 0.45);
  // Closed roof top, underside and both edges retain the native central opening.
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count,
      ps = [
        opening(a, r.roofInnerY),
        opening(b, r.roofInnerY),
        outside(b, r.roofOuterY),
        outside(a, r.roofOuterY),
      ],
      below = ps.map(([x, y, z]) => [x, y - 0.35, z]),
      m = (a + b) / 2;
    f('roof', ps, [0, 1, 0]);
    f('roof', below, [0, -1, 0]);
    f('metal', [ps[0], below[0], below[1], ps[1]], [-Math.cos(m), 0, -Math.sin(m)]);
    f('metal', [ps[2], below[2], below[3], ps[3]], [Math.cos(m), 0, Math.sin(m)]);
  }
  if (detail) {
    const trusses = detail === 1 ? 16 : detail === 2 ? 32 : 64;
    for (const y of [20.1, r.rimTop])
      for (let i = 0; i < count; i++)
        bar(
          'metal',
          outside((i * Math.PI * 2) / count, y),
          outside(((i + 1) * Math.PI * 2) / count, y),
          0.24,
        );
    for (let i = 0; i < trusses; i++) {
      const a = (i * Math.PI * 2) / trusses,
        b = ((i + 1) * Math.PI * 2) / trusses;
      bar('metal', outside(a, 19.4), outside(a, r.rimTop), 0.22);
      if (detail > 1) bar('metal', outside(a, 20.1), outside(b, r.rimTop), 0.14);
      if (detail === 3) bar('metal', outside(b, 20.1), outside(a, r.rimTop), 0.14);
      bar('metal', outside(a, 19.4, 0.97), opening(a, 22.6), 0.45, 0.65);
      if (detail > 1) bar('metal', outside(a, r.rimTop), opening(a, r.roofInnerY), 0.14);
    }
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count;
      if (detail === 1) {
        const p = opening(a, 23.1, -0.45),
          q = opening(b, 23.1, -0.45),
          u = opening(a, 23.1, 0.2),
          v = opening(b, 23.1, 0.2);
        f('metal', [p, q, v, u], [0, 1, 0]);
      } else bar('metal', opening(a, 23.1, -0.15), opening(b, 23.1, -0.15), 0.65, 0.25);
      if (detail > 1) bar('metal', opening(a, 24.2, -0.25), opening(b, 24.2, -0.25), 0.08);
    }
  } else {
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        b = ((i + 1) * Math.PI * 2) / count;
      f(
        'metal',
        [outside(a, 26.1), outside(b, 26.1), outside(b, r.rimTop), outside(a, r.rimTop)],
        [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      );
    }
  }
  // Pale-green frontage occupies the photographed long-side sector inside the concrete frame.
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count,
      m = (a + b) / 2;
    if (Math.sin(m) > -0.65) continue;
    const pa = outside(a, 0, 0.986),
      pb = outside(b, 0, 0.986),
      n = [Math.cos(m), 0, Math.sin(m)],
      map = (t, y, d = 0) => [
        pa[0] + (pb[0] - pa[0]) * t + n[0] * d,
        y,
        pa[2] + (pb[2] - pa[2]) * t + n[2] * d,
      ];
    f('front', [map(0, 0.3), map(1, 0.3), map(1, 11.6), map(0, 11.6)], n);
    if (detail && Math.abs(Math.cos(m)) < 0.25)
      f(
        'glass',
        [
          map(0.18, 0.75, 0.035),
          map(0.82, 0.75, 0.035),
          map(0.82, 2.65, 0.035),
          map(0.18, 2.65, 0.035),
        ],
        n,
      );
    if (detail)
      for (const y of [2.8, 8.2])
        for (let j = 0; j < 3; j++) {
          const lo = (j + 0.18) / 3,
            hi = (j + 0.8) / 3;
          f(
            'glass',
            [map(lo, y, 0.03), map(hi, y, 0.03), map(hi, y + 1.5, 0.03), map(lo, y + 1.5, 0.03)],
            n,
          );
        }
  }
  // Two roof-hung end boards remain neutral and have explicit hangers in nearby levels.
  for (const sign of [-1, 1]) {
    const c = opening(sign > 0 ? 0 : Math.PI, 0, -0.8),
      local = (role, ps, normal) =>
        f(
          role,
          ps.map(([s, y, d]) => [c[0] + sign * d, y, c[2] + s]),
          [sign * normal[2], normal[1], normal[0]],
        );
    box(local, 'screen', 0, 13.5, 0, 14, 5.5, 0.8);
    if (detail)
      for (const z of [-5, 5]) {
        bar('metal', [c[0], 19, c[2] + z], [c[0], 22.9, c[2] + z], 0.14);
        bar('metal', [c[0], 22.8, c[2] + z], [c[0] + sign * 1.8, 22.8, c[2] + z], 0.14);
      }
  }
  const floor =
    detail < 2
      ? Array.from({ length: count }, (_, i) => {
          const p = at(0, (i * Math.PI * 2) / count);
          return [p[0], p[2]];
        })
      : r.inner;
  prism(f, 'track', { outline: floor }, r.minGround - F - 0.4, 0.3);
  prism(f, 'turf', { outline: capsule(r.trackRadius, [6, 12, 20, 32][detail]) }, 0.3, 0.315);
  if (detail) {
    const paint = (x, z, w, d) =>
        f(
          'mark',
          [
            [x - w / 2, 0.335, z - d / 2],
            [x + w / 2, 0.335, z - d / 2],
            [x + w / 2, 0.335, z + d / 2],
            [x - w / 2, 0.335, z + d / 2],
          ],
          [0, 1, 0],
        ),
      cx = r.fieldCenter[0],
      cz = r.fieldCenter[1],
      arcSteps = detail > 1 ? 48 : 12;
    for (let lane = 0; lane <= 8; lane += detail === 1 ? 2 : 1) {
      const R = r.trackRadius + (lane * (r.trackOuterRadius - r.trackRadius)) / 8,
        a = capsule(R - 0.05, arcSteps),
        b = capsule(R + 0.05, arcSteps);
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        f(
          'mark',
          [
            [...a[i].slice(0, 1), 0.325, a[i][1]],
            [a[j][0], 0.325, a[j][1]],
            [b[j][0], 0.325, b[j][1]],
            [b[i][0], 0.325, b[i][1]],
          ],
          [0, 1, 0],
        );
      }
    }
    for (const z of [-34, 34]) paint(cx, cz + z, 105, 0.12);
    for (const x of [-52.5, 0, 52.5]) paint(cx + x, cz, 0.12, 68);
    for (const sign of [-1, 1]) {
      paint(cx + sign * 36, cz, 0.12, 40.32);
      for (const z of [-20.16, 20.16]) paint(cx + sign * 44.25, cz + z, 16.5, 0.12);
      for (const z of [-3.66, 3.66])
        bar('mark', [cx + sign * 52.5, 0.335, cz + z], [cx + sign * 52.5, 2.775, cz + z], 0.08);
      bar('mark', [cx + sign * 52.5, 2.775, cz - 3.66], [cx + sign * 52.5, 2.775, cz + 3.66], 0.08);
    }
    const circle = detail > 1 ? 32 : 16;
    for (let i = 0; i < circle; i++) {
      const a = (i * Math.PI * 2) / circle,
        b = ((i + 1) * Math.PI * 2) / circle;
      f(
        'mark',
        [
          [cx + 9.09 * Math.cos(a), 0.335, cz + 9.09 * Math.sin(a)],
          [cx + 9.09 * Math.cos(b), 0.335, cz + 9.09 * Math.sin(b)],
          [cx + 9.21 * Math.cos(b), 0.335, cz + 9.21 * Math.sin(b)],
          [cx + 9.21 * Math.cos(a), 0.335, cz + 9.21 * Math.sin(a)],
        ],
        [0, 1, 0],
      );
    }
  }
}
