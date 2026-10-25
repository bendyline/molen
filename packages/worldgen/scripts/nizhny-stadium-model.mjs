/** nizhny_novgorod_stadium: circular white colonnade, blue panel roof and open two-tier bowl. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'nizhny_novgorod_stadium',
  tau = Math.PI * 2;
export function nizhnyRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    cross = (u, v) => u[0] * v[1] - u[1] * v[0],
    hits = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      v = poly[(i + 1) % poly.length].map((x, k) => x - p[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(p, v) / den,
      u = cross(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: missing native boundary`);
  return Math.min(...hits);
}
export const nizhnySegments = [12, 22, 40, 88];
export function nizhnyFoundationOutline(r, detail) {
  return Array.from({ length: nizhnySegments[detail] }, (_, i) => {
    const a = (i * tau) / nizhnySegments[detail],
      R = nizhnyRadius(r.outer, a) * 0.998;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function nizhnyBowlRadius(t, a) {
  const inner = 1 / Math.pow(Math.pow(Math.cos(a) / 62, 4) + Math.pow(Math.sin(a) / 46, 4), 0.25),
    outer = 1 / Math.sqrt((Math.cos(a) / 122) ** 2 + (Math.sin(a) / 101) ** 2);
  return inner * (1 - t) + outer * t;
}
export function nizhnyRoofPoint(r, a, t) {
  const outer = nizhnyRadius(r.outer, a),
    inner = 1 / Math.sqrt((Math.cos(a) / 112) ** 2 + (Math.sin(a) / 87) ** 2),
    R = outer * (1 - t) + inner * t;
  return [R * Math.cos(a), 53.6 - 4.1 * t, R * Math.sin(a)];
}
export function buildNizhnyStadium(face, detail, r) {
  const n = nizhnySegments[detail],
    F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, no) => face(role, ps.map(P), D(no)),
    adapter = {
      addQuad: (role, _ref, ps, no) => f(role, ps, no),
      addConvexPolygon: (role, _ref, ps, no) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], no);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (a, y, s = 1) => {
      const R = nizhnyRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = nizhnyBowlRadius(t, a);
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    lower = Math.min(-0.4, r.minGround - F - 0.5);
  prism(f, 'wall', { outline: nizhnyFoundationOutline(r, detail) }, lower, 0.27);
  box(f, 'turf', 0, 0.27, 0, 114, 0.03, 79);
  // Raised perimeter gallery is occupied construction, not a surrounding plaza slab.
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)];
    for (const y of [8.4, 16, 25, 32]) {
      const scale = y === 8.4 ? 1 : 0.885,
        inner = y === 8.4 ? 0.79 : 0.79;
      const ps = [body(a, y, inner), body(b, y, inner), body(b, y, scale), body(a, y, scale)];
      f('wall', ps, [0, 1, 0]);
      f(
        'wall',
        ps.map((p) => [p[0], p[1] - 0.45, p[2]]),
        [0, -1, 0],
      );
      f(
        'wall',
        [body(a, y, scale), body(b, y, scale), body(b, y - 0.45, scale), body(a, y - 0.45, scale)],
        N,
      );
      if (y > 8.4 && detail) {
        const wave = (q) => 0.55 * Math.sin(q * 8),
          ps = [
            body(a, y, 0.883),
            body(b, y, 0.883),
            body(b, y + 1.3 + wave(b), 0.883),
            body(a, y + 1.3 + wave(a), 0.883),
          ];
        f(y === 16 ? 'blue' : 'pale', ps, N);
      }
    }
    const y0 = Math.min(r.columnContacts[detail][i] - F - 0.25, 8.1),
      R = nizhnyRadius(r.outer, a) * 0.993,
      T = [-Math.sin(a), Math.cos(a)],
      A = [Math.cos(a), Math.sin(a)],
      tri = [
        [-1.1, -2],
        [1.1, -2],
        [0, 0.7],
      ].map(([u, v]) => [A[0] * (R + v) + T[0] * u, A[1] * (R + v) + T[1] * u]);
    prism(f, 'column', { outline: tri }, y0, 53.15);
    // Closed ground service frontage behind the open upper colonnade.
    f(
      'service',
      [body(a, lower, 0.93), body(b, lower, 0.93), body(b, 7.95, 0.93), body(a, 7.95, 0.93)],
      N,
    );
    if (detail) {
      f('glass', [body(a, 8.5, 0.8), body(b, 8.5, 0.8), body(b, 31.5, 0.8), body(a, 31.5, 0.8)], N);
      bar('wall', body(a, 8.1, 0.865), body(a, 38, 0.865), 0.85);
      if (i % Math.max(1, n / 22) === 0) {
        const center = body(m, 0, 0.937);
        box(f, 'entry', center[0], Math.max(lower, 0), center[2], 4, 6, 4);
      }
    }
  }
  // Two actual seating bands, with closed risers and a connected inter-tier box belt.
  const rows = detail === 3 ? [22, 29] : detail === 2 ? [6, 8] : [1, 1];
  for (const [ti, tier] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          t0 = tier.t0 + ((tier.t1 - tier.t0) * row) / rows[ti],
          t1 = tier.t0 + ((tier.t1 - tier.t0) * (row + 1)) / rows[ti],
          y0 = tier.y0 + ((tier.y1 - tier.y0) * row) / rows[ti],
          y1 = tier.y0 + ((tier.y1 - tier.y0) * (row + 1)) / rows[ti],
          aisle = detail > 1 && i % (detail === 3 ? 11 : 5) === 0,
          role = aisle
            ? 'wall'
            : ['blue', 'seatPale', 'seatWhite'][((i * 17 + row * 11 + Math.floor(i / 5)) % 7) % 3];
        f(
          role,
          [
            at(t0, a, detail < 2 ? y0 : y1),
            at(t0, b, detail < 2 ? y0 : y1),
            at(t1, b, y1),
            at(t1, a, y1),
          ],
          [0, 1, 0],
        );
        if (detail > 1)
          f(
            role,
            [at(t0, a, y0), at(t0, b, y0), at(t0, b, y1), at(t0, a, y1)],
            [-Math.cos(m), 0, -Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [-Math.cos(m), 0, -Math.sin(m)];
    for (const [t, y0, y1, role] of [
      [0, 0.3, 1.4, 'blue'],
      [0.42, 15.2, 19, 'entry'],
      [0.98, 32, 39.5, 'wall'],
    ])
      f(role, [at(t, a, y0), at(t, b, y0), at(t, b, y1), at(t, a, y1)], N);
    f('wall', [at(0.42, a, 19), at(0.42, b, 19), at(0.5, b, 19), at(0.5, a, 19)], [0, 1, 0]);
  }
  // Closed blue/pale polycarbonate proxies, including matching front-facing undersides.
  const rings = [2, 3, 4, 6][detail];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rings; j++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        t = j / rings,
        u = (j + 1) / rings,
        ps = [
          nizhnyRoofPoint(r, a, t),
          nizhnyRoofPoint(r, b, t),
          nizhnyRoofPoint(r, b, u),
          nizhnyRoofPoint(r, a, u),
        ],
        bottom = ps.map((p) => [p[0], p[1] - 0.32, p[2]]),
        role = ['roofPale', 'roofWhite', 'roofBlue', 'roofWhite', 'roofPale'][
          (i * 7 + j * 13 + Math.floor(i / 3)) % 5
        ];
      // Identical diagonal is necessary for nonplanar annular quadrilaterals.
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((k) => ps[k]),
          [0, 1, 0],
        );
        f(
          role,
          ids.map((k) => bottom[k]),
          [0, -1, 0],
        );
      }
      if (j === 0)
        f(
          'metal',
          [ps[0], ps[1], bottom[1], bottom[0]],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      if (j === rings - 1)
        f(
          'metal',
          [ps[2], ps[3], bottom[3], bottom[2]],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
    }
  if (detail)
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        innerA = nizhnyRoofPoint(r, a, 1),
        innerB = nizhnyRoofPoint(r, b, 1),
        shift = (p, y) => [p[0], p[1] + y, p[2]],
        topA = shift(innerA, -0.62),
        topB = shift(innerB, -0.62),
        lowA = shift(innerA, -6.5),
        lowB = shift(innerB, -6.5);
      bar('metal', topA, topB, 0.35);
      bar('metal', lowA, lowB, 0.4);
      bar('metal', topA, lowA, 0.28);
      bar('metal', topA, lowB, detail === 1 ? 0.5 : 0.23);
      if (detail > 1) {
        const radial = [0, 0.35, 0.7, 1].map((t) => shift(nizhnyRoofPoint(r, a, t), -0.8));
        for (let j = 0; j < 3; j++) {
          bar('metal', radial[j], radial[j + 1], 0.35);
          const lo = shift(radial[j], -2.4),
            hi = shift(radial[j + 1], -2.4);
          bar('metal', lo, hi, 0.35);
          bar('metal', lo, radial[j + 1], 0.2);
        }
        bar('metal', body(a, 32, 0.865), radial[0], 0.55);
        if (detail === 3)
          for (const t of [0.2, 0.4, 0.6, 0.8])
            bar(
              'metal',
              shift(nizhnyRoofPoint(r, a, t), -0.6),
              shift(nizhnyRoofPoint(r, b, t), -0.6),
              0.16,
            );
        if (i % 4 === 0) {
          const p = shift(innerA, -7);
          box(f, 'mark', p[0], p[1], p[2], 1.8, 0.6, 0.75);
          bar('metal', shift(innerA, -0.3), shift(innerA, -7), 0.16);
        }
      }
    }
  // Tangent entrance flights connect their own retained grade to the raised gallery.
  if (detail)
    for (let i = 0; i < 11; i++) {
      const a = (i * tau) / 11,
        T = [-Math.sin(a), 0, Math.cos(a)],
        B = body(a, 8.4, 0.995),
        base = r.stairContacts[i] - F,
        A = body(a, base, 1.02).map((v, k) => v - T[k] * 28),
        steps = detail === 3 ? 28 : detail === 2 ? 10 : 3,
        W = detail === 1 ? 5 : 4.5,
        L = Math.hypot(B[0] - A[0], B[2] - A[2]),
        S = [(B[2] - A[2]) / L, 0, -(B[0] - A[0]) / L];
      const p = (t, y, side) =>
        A.map(
          (v, k) => v + (B[k] - v) * t + (k === 1 ? y - (A[1] + (B[1] - A[1]) * t) : S[k] * side),
        );
      for (let j = 0; j < steps; j++) {
        const t = j / steps,
          u = (j + 1) / steps,
          y = base + (8.4 - base) * u,
          prev = base + (8.4 - base) * t,
          ps = [p(t, y, -W), p(t, y, W), p(u, y, W), p(u, y, -W)];
        f('wall', ps, [0, 1, 0]);
        f(
          'wall',
          [p(t, prev, -W), p(t, prev, W), p(t, y, W), p(t, y, -W)],
          T.map((v) => -v),
        );
      }
      for (const sign of [-1, 1]) {
        const outside = sign * (W + 0.2),
          inside = sign * W,
          top = [
            p(0, base + 0.7, outside),
            p(1, 9.1, outside),
            p(1, 9.1, inside),
            p(0, base + 0.7, inside),
          ];
        f('wall', top, [0, 1, 0]);
        for (const side of [outside, inside])
          f(
            'wall',
            [
              p(0, base - 0.2, side),
              p(1, base - 0.2, side),
              p(1, 9.1, side),
              p(0, base + 0.7, side),
            ],
            S.map((v) => v * sign * (side === outside ? 1 : -1)),
          );
        for (const q of [0, 1])
          f(
            'wall',
            [
              p(q, base - 0.2, outside),
              p(q, base - 0.2, inside),
              p(q, q ? 9.1 : base + 0.7, inside),
              p(q, q ? 9.1 : base + 0.7, outside),
            ],
            T.map((v) => v * (q ? 1 : -1)),
          );
      }
      // Interior blue circulation flights visible through the tall white columns.
      if (detail > 1)
        for (const [y, next] of [
          [8.4, 16],
          [16, 25],
          [25, 32],
        ]) {
          const a0 = a + 0.025,
            a1 = a + 0.14,
            A0 = body(a0, y, 0.875),
            B0 = body(a1, next, 0.875),
            length = Math.hypot(B0[0] - A0[0], B0[2] - A0[2]),
            S0 = [(B0[2] - A0[2]) / length, 0, -(B0[0] - A0[0]) / length],
            direction = [(B0[0] - A0[0]) / length, 0, (B0[2] - A0[2]) / length],
            point = (u, h, s) => [
              A0[0] + (B0[0] - A0[0]) * u + S0[0] * s,
              h,
              A0[2] + (B0[2] - A0[2]) * u + S0[2] * s,
            ];
          if (detail === 3) {
            for (let j = 0; j < 22; j++) {
              const t = j / 22,
                u = (j + 1) / 22,
                prev = y + (next - y) * t,
                top = y + (next - y) * u,
                ps = [
                  point(t, top, -1.6),
                  point(t, top, 1.6),
                  point(u, top, 1.6),
                  point(u, top, -1.6),
                ];
              f('blue', ps, [0, 1, 0]);
              f(
                'blue',
                [
                  point(t, prev, -1.6),
                  point(t, prev, 1.6),
                  point(t, top, 1.6),
                  point(t, top, -1.6),
                ],
                direction.map((v) => -v),
              );
              f(
                'blue',
                [
                  point(t, prev - 0.6, -1.6),
                  point(t, prev - 0.6, 1.6),
                  point(u, top - 0.6, 1.6),
                  point(u, top - 0.6, -1.6),
                ],
                [0, -1, 0],
              );
              for (const sign of [-1, 1])
                f(
                  'blue',
                  [
                    point(t, prev - 0.6, sign * 1.6),
                    point(u, top - 0.6, sign * 1.6),
                    point(u, top, sign * 1.6),
                    point(t, top, sign * 1.6),
                  ],
                  S0.map((v) => v * sign),
                );
              if (j === 0)
                f(
                  'blue',
                  [
                    point(0, y - 0.6, -1.6),
                    point(0, y - 0.6, 1.6),
                    point(0, y, 1.6),
                    point(0, y, -1.6),
                  ],
                  direction.map((v) => -v),
                );
              if (j === 21)
                f(
                  'blue',
                  [
                    point(1, next - 0.6, -1.6),
                    point(1, next - 0.6, 1.6),
                    point(1, next, 1.6),
                    point(1, next, -1.6),
                  ],
                  direction,
                );
            }
          } else
            bar(
              'blue',
              A0.map((v, k) => (k === 1 ? v - 0.4 : v)),
              B0.map((v, k) => (k === 1 ? v - 0.4 : v)),
              3.3,
              1.2,
            );
          for (const sign of [-1, 1])
            bar('blue', point(0, y + 0.7, sign * 1.7), point(1, next + 0.7, sign * 1.7), 0.18, 1.2);
          for (const q of [A0, B0]) box(f, 'blue', q[0], q[1] - 0.4, q[2], 4, 0.4, 4);
        }
    }
  for (const sign of [-1, 1]) {
    const x = sign * 108;
    box(f, 'screen', x, 34, 0, 0.8, 5.5, 11);
    for (const z of [-4, 4]) {
      const roof = nizhnyRoofPoint(r, Math.atan2(z, x), 1);
      bar('metal', [x, 39, z], [roof[0], roof[1] - 0.3, roof[2]], detail ? 0.25 : 0.7);
    }
  }
  if (detail) {
    const paint = (x, z, w, d) =>
      f(
        'mark',
        [
          [x - w / 2, 0.315, z - d / 2],
          [x + w / 2, 0.315, z - d / 2],
          [x + w / 2, 0.315, z + d / 2],
          [x - w / 2, 0.315, z + d / 2],
        ],
        [0, 1, 0],
      );
    for (const z of [-34, 34]) paint(0, z, 105, 0.14);
    for (const x of [-52.5, 0, 52.5]) paint(x, 0, 0.14, 68);
    for (const sign of [-1, 1]) {
      for (const [d, w] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(sign * (52.5 - d), 0, 0.14, w);
        for (const z of [-w / 2, w / 2]) paint(sign * (52.5 - d / 2), z, d, 0.14);
      }
      for (const z of [-3.66, 3.66])
        bar('mark', [sign * 52.5, 0.3, z], [sign * 52.5, 2.74, z], 0.1);
      bar('mark', [sign * 52.5, 2.74, -3.66], [sign * 52.5, 2.74, 3.66], 0.1);
    }
    for (let i = 0; i < 32; i++) {
      const a = (i * tau) / 32,
        b = ((i + 1) * tau) / 32;
      f(
        'mark',
        [
          [9.08 * Math.cos(a), 0.315, 9.08 * Math.sin(a)],
          [9.08 * Math.cos(b), 0.315, 9.08 * Math.sin(b)],
          [9.22 * Math.cos(b), 0.315, 9.22 * Math.sin(b)],
          [9.22 * Math.cos(a), 0.315, 9.22 * Math.sin(a)],
        ],
        [0, 1, 0],
      );
    }
  }
}
