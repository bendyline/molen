/** 'N0724': MCG's two roof systems, four-tier oval and six tapered light towers. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const mcgSegments = [12, 24, 40, 72];
export function mcgRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0],
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
  if (!hits.length) throw Error('N0724: missing native radial boundary');
  return Math.min(...hits);
}
export function mcgAngles(r, d) {
  return [
    ...new Set(
      [
        ...Array.from({ length: mcgSegments[d] }, (_, i) => (i * tau) / mcgSegments[d]),
        r.southStart % tau,
        r.southEnd % tau,
      ].map((v) => Math.round(v * 1e10) / 1e10),
    ),
  ].sort((a, b) => a - b);
}
export function mcgNorth(r, a) {
  return (((a - r.southStart) % tau) + tau) % tau > r.southSpan;
}
export function mcgRoofPoint(r, a, t, north = mcgNorth(r, a)) {
  const R = mcgRadius(r.outer, a) * 0.985 * (1 - t) + mcgRadius(r.inner, a) * 1.2 * t,
    v = ((((a - r.southEnd) % tau) + tau) % tau) / (tau - r.southSpan),
    base = north ? 45 + 2 * Math.sin(Math.PI * v) : 40.5 + 0.5 * Math.cos(2 * a);
  return [
    R * Math.cos(a),
    base + 0.9 * Math.sin(Math.PI * t) - (north ? 2 : 1) * t,
    R * Math.sin(a),
  ];
}
export function mcgRoofMeshPoint(r, d, a, t) {
  const angles = mcgAngles(r, d),
    angle = ((a % tau) + tau) % tau,
    i = angles.findLastIndex((q) => q <= angle),
    b = i === angles.length - 1 ? tau : angles[i + 1],
    u = (angle - angles[i]) / (b - angles[i]),
    rings = d === 0 ? [0, 1] : d === 1 ? [0, 0.65, 1] : [0, 0.35, 0.72, 1],
    j = Math.min(
      rings.length - 2,
      rings.findIndex((q, k) => k < rings.length - 1 && t >= q && t <= rings[k + 1]),
    ),
    v = (t - rings[j]) / (rings[j + 1] - rings[j]),
    north = mcgNorth(r, (angles[i] + b) / 2),
    A = mcgRoofPoint(r, angles[i], rings[j], north),
    B = mcgRoofPoint(r, b, rings[j], north),
    C = mcgRoofPoint(r, b, rings[j + 1], north),
    E = mcgRoofPoint(r, angles[i], rings[j + 1], north);
  return u >= v
    ? A.map((x, k) => x * (1 - u) + B[k] * (u - v) + C[k] * v)
    : A.map((x, k) => x * (1 - v) + C[k] * u + E[k] * (v - u));
}
export function mcgFoundationOutline(r, d) {
  return mcgAngles(r, d).map((a) => {
    const R = mcgRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function buildMcgStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, no) => face(role, ps.map(P), D(no)),
    angles = mcgAngles(r, detail),
    adapter = {
      addQuad: (role, _ref, ps, no) => f(role, ps, no),
      addConvexPolygon: (role, _ref, ps, no) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], no);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (a, y, s = 1) => {
      const R = mcgRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = mcgRadius(r.inner, a) * 1.01 * (1 - t) + mcgRadius(r.outer, a) * 0.94 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    slab = (role, ps, thick = 0.35, ends = true) => {
      const sign = Math.sign(
        ps.reduce(
          (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][2] - p[2] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        f(
          role,
          ids.map((i) => [ps[i][0], ps[i][1] - thick, ps[i][2]]),
          [0, -1, 0],
        );
      }
      for (let i = 0; i < 4; i++) {
        if (!ends && (i === 1 || i === 3)) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    };
  prism(
    f,
    'wall',
    { outline: mcgFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.5, -0.4),
    0.27,
  );
  prism(
    f,
    'turf',
    {
      outline: angles.map((a) => {
        const R = mcgRadius(r.inner, a);
        return [R * Math.cos(a), R * Math.sin(a)];
      }),
    },
    0.27,
    0.3,
  );
  const rows = detail === 3 ? [20, 6, 6, 22] : detail === 2 ? [5, 2, 2, 6] : [1, 1, 1, 1];
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = i === angles.length - 1 ? tau : angles[i + 1],
      m = (a + b) / 2,
      north = mcgNorth(r, m),
      N = [Math.cos(m), 0, Math.sin(m)],
      contact = r.columnContacts[detail][i] - F;
    for (const [ti, t] of r.tiers.entries())
      for (let j = 0; j < rows[ti]; j++) {
        const u = j / rows[ti],
          v = (j + 1) / rows[ti],
          t0 = t.t0 + (t.t1 - t.t0) * u,
          t1 = t.t0 + (t.t1 - t.t0) * v,
          y = t.y0 + (t.y1 - t.y0) * v,
          ps = [
            at(t0, a, detail < 2 ? t.y0 : y),
            at(t0, b, detail < 2 ? t.y0 : y),
            at(t1, b, detail < 2 ? t.y1 : y),
            at(t1, a, detail < 2 ? t.y1 : y),
          ],
          role =
            detail > 1 && i % 5 === 0
              ? 'wall'
              : north
                ? ti % 2
                  ? 'seatPale'
                  : 'seatGreen'
                : ti % 2
                  ? 'seatGreen'
                  : 'seatPale';
        slab(role, ps, detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.1 : 0.4, false);
      }
    for (const [t0, t1, lo, hi] of [
      [0.24, 0.3, 10, 13],
      [0.43, 0.48, 17, 20],
      [0.59, 0.65, 24, 27],
    ]) {
      const walking = [at(t0, a, hi), at(t0, b, hi), at(t1, b, hi), at(t1, a, hi)];
      if (detail < 2) f('wall', walking, [0, 1, 0]);
      else slab('wall', walking, 0.45, false);
      f(
        'glass',
        [at(t0, a, lo), at(t0, b, lo), at(t0, b, hi), at(t0, a, hi)],
        N.map((x) => -x),
      );
    }
    f(
      'service',
      [
        body(a, Math.min(contact - 0.3, 0), 0.86),
        body(b, Math.min(r.columnContacts[detail][(i + 1) % angles.length] - F - 0.3, 0), 0.86),
        body(b, detail ? 8 : 12, 0.86),
        body(a, detail ? 8 : 12, 0.86),
      ],
      N,
    );
    if (detail) {
      if (detail > 1 || i % 2 === 0)
        bar('wall', body(a, contact - 0.3, 0.96), body(a, 36, 0.96), 0.9);
      for (const y of [8, 16, 24])
        slab(
          'wall',
          [body(a, y, 0.85), body(b, y, 0.85), body(b, y, 0.97), body(a, y, 0.97)],
          0.5,
          false,
        );
      f(
        'glass',
        [
          body(a, Math.min(23.8, Math.max(contact, 8)), 0.865),
          body(
            b,
            Math.min(23.8, Math.max(r.columnContacts[detail][(i + 1) % angles.length] - F, 8)),
            0.865,
          ),
          body(b, 24, 0.865),
          body(a, 24, 0.865),
        ],
        N,
      );
      if (i % 3 === 0) {
        const p = body(m, 0, 0.96);
        box(
          f,
          'wall',
          p[0],
          Math.max(contact - 0.3, 0),
          p[2],
          7,
          28 - Math.max(contact - 0.3, 0),
          7,
        );
        if (detail > 1) box(f, 'glass', p[0], 12, p[2] + 3.52, 4, 12, 0.1);
      }
    }
    const rings = detail === 0 ? [0, 1] : detail === 1 ? [0, 0.65, 1] : [0, 0.35, 0.72, 1];
    for (let j = 0; j < rings.length - 1; j++) {
      const t = rings[j],
        u = rings[j + 1],
        ps = [
          mcgRoofPoint(r, a, t, north),
          mcgRoofPoint(r, b, t, north),
          mcgRoofPoint(r, b, u, north),
          mcgRoofPoint(r, a, u, north),
        ];
      slab(
        north && t >= 0.72 ? 'roofGlass' : 'roof',
        ps,
        0.35,
        mcgNorth(r, a - 1e-7) !== north || mcgNorth(r, b + 1e-7) !== north,
      );
    }
    if (detail === 1 && !north && i % 2 === 0) {
      const A = mcgRoofPoint(r, a, 0, false),
        B = mcgRoofPoint(r, a, 1, false),
        tip = [A[0], A[1] + 5, A[2]],
        T = [-Math.sin(a), 0, Math.cos(a)];
      f('teal', [A, tip, B], T);
      f(
        'teal',
        [A, tip, B],
        T.map((v) => -v),
      );
    }
    if (detail > 1) {
      const A = mcgRoofPoint(r, a, 0, north),
        B = mcgRoofPoint(r, a, 1, north),
        C = mcgRoofPoint(r, b, 0, north);
      bar(north ? 'metal' : 'teal', [A[0], A[1] - 0.45, A[2]], [B[0], B[1] - 0.45, B[2]], 0.4);
      bar(
        'wall',
        body(a, r.roofSupportContacts[detail][i] - F - 0.3, 0.87),
        [A[0], A[1] - 0.6, A[2]],
        0.8,
      );
      for (const t of [0.35, 0.72, 1]) {
        const p = mcgRoofPoint(r, a, t, north),
          q = mcgRoofPoint(r, b, t, north);
        p[1] -= 0.4;
        q[1] -= 0.4;
        bar(north ? 'metal' : 'teal', p, q, 0.16);
      }
      if (!north) {
        const tip = [A[0], A[1] + 5, A[2]];
        bar('teal', A, tip, 0.28);
        bar('teal', tip, B, 0.2);
        bar('teal', tip, C, 0.2);
      }
    }
  }
  // Original northern mast concept:26 cigar-shaped members at closeup, grouped farther away.
  const masts = [4, 8, 13, 26][detail];
  for (let i = 0; i < masts; i++) {
    const u = (i + 0.5) / masts,
      a = r.southEnd + (tau - r.southSpan) * u,
      A = mcgRoofMeshPoint(r, detail, a, 0),
      B = mcgRoofMeshPoint(r, detail, a, 0.92),
      R = Math.hypot(A[0], A[2]),
      N = [A[0] / R, 0, A[2] / R],
      height = 8 + 14 * Math.sin(Math.PI * u),
      bottom = [A[0], A[1] - 3, A[2]],
      top = [A[0] + N[0] * 2, A[1] + height, A[2] + N[2] * 2];
    if (detail < 2) bar('metal', bottom, top, detail ? 0.65 : 1.2);
    else {
      const T = [-N[2], 0, N[0]],
        rings = [
          [0, 0.25],
          [0.25, 0.65],
          [0.65, 0.55],
          [1, 0.1],
        ],
        sides = detail === 3 ? 8 : 6;
      for (let j = 0; j < rings.length - 1; j++)
        for (let k = 0; k < sides; k++) {
          const point = (j, k) => {
            const [t, w] = rings[j],
              a = (k * tau) / sides;
            return bottom.map(
              (v, l) => v + (top[l] - v) * t + w * (T[l] * Math.cos(a) + N[l] * Math.sin(a)),
            );
          };
          const p = point(j, k),
            q = point(j, k + 1),
            v = point(j + 1, k + 1),
            w = point(j + 1, k);
          f(
            'metal',
            [p, q, v, w],
            [
              T[0] * Math.cos(((k + 0.5) * tau) / sides) +
                N[0] * Math.sin(((k + 0.5) * tau) / sides),
              0,
              T[2] * Math.cos(((k + 0.5) * tau) / sides) +
                N[2] * Math.sin(((k + 0.5) * tau) / sides),
            ],
          );
        }
      bar('metal', bottom, top, 0.18);
      for (const [end, w] of [
        [bottom, 0.25],
        [top, 0.1],
      ])
        f(
          'metal',
          Array.from({ length: sides }, (_, k) => {
            const a = (k * tau) / sides;
            return end.map((v, l) => v + w * (T[l] * Math.cos(a) + N[l] * Math.sin(a)));
          }),
          end === bottom ? [0, -1, 0] : [0, 1, 0],
        );
    }
    if (detail) {
      bar('metal', top, B, 0.12);
      const C = mcgRoofMeshPoint(r, detail, a, 0);
      const anchor = [C[0] + N[0] * 7, C[1] - 4, C[2] + N[2] * 7];
      bar('metal', top, anchor, 0.12);
      bar('metal', C, anchor, 0.4);
      box(f, 'wall', anchor[0], anchor[1] - 1, anchor[2], 2, 2, 2);
    }
  }
  for (const l of r.lights) {
    const [x, z] = l.center,
      G = l.groundY - F,
      top = G + 75,
      R = Math.hypot(x, z),
      N = [x / R, z / R],
      T = [-N[1], N[0]],
      p = (t, y, d = 0) => [
        x + T[0] * t + N[0] * (d - (y - top) * 0.35),
        y,
        z + T[1] * t + N[1] * (d - (y - top) * 0.35),
      ];
    if (!detail) {
      const ring = (y, w) =>
          Array.from({ length: 3 }, (_, i) => [
            x + w * Math.cos((i * tau) / 3),
            y,
            z + w * Math.sin((i * tau) / 3),
          ]),
        lo = ring(G - 0.3, 1.6),
        hi = ring(top, 1.1);
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3,
          a = ((i + 0.5) * tau) / 3;
        f('metal', [lo[i], lo[j], hi[j], hi[i]], [Math.cos(a), 0, Math.sin(a)]);
      }
      f('metal', lo, [0, -1, 0]);
      f('metal', hi, [0, 1, 0]);
    } else {
      const sides = detail === 3 ? 12 : 6;
      for (let i = 0; i < sides; i++) {
        const a = (i * tau) / sides,
          b = ((i + 1) * tau) / sides;
        f(
          'metal',
          [
            [x + 2.4 * Math.cos(a), G - 0.3, z + 2.4 * Math.sin(a)],
            [x + 2.4 * Math.cos(b), G - 0.3, z + 2.4 * Math.sin(b)],
            [x + 1.1 * Math.cos(b), top, z + 1.1 * Math.sin(b)],
            [x + 1.1 * Math.cos(a), top, z + 1.1 * Math.sin(a)],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
      prism(
        f,
        'metal',
        {
          outline: Array.from({ length: sides }, (_, i) => [
            x + 1.1 * Math.cos((i * tau) / sides),
            z + 1.1 * Math.sin((i * tau) / sides),
          ]),
        },
        top - 0.1,
        top,
      );
    }
    const front = [p(-4, top), p(4, top), p(7, top + 7), p(-7, top + 7)];
    f('screen', front, [-N[0], 0, -N[1]]);
    f('metal', front, [N[0], 0, N[1]]);
    if (detail) {
      for (let i = 0; i < 4; i++) bar('metal', front[i], front[(i + 1) % 4], 0.22);
      if (detail > 1) {
        const rows = detail === 3 ? 6 : 3,
          cols = detail === 3 ? 8 : 5;
        for (let j = 0; j < rows; j++)
          for (let k = 0; k < cols; k++) {
            const y = top + 0.6 + ((j + 0.5) * 5.8) / rows,
              w = 4 + ((y - top) * 3) / 7,
              t = -w + ((k + 0.5) * 2 * w) / cols,
              ps = [
                p(t - 0.45, y - 0.3, -0.05),
                p(t + 0.45, y - 0.3, -0.05),
                p(t + 0.45, y + 0.3, -0.05),
                p(t - 0.45, y + 0.3, -0.05),
              ];
            f('mark', ps, [-N[0], 0, -N[1]]);
          }
      }
    }
  }
  if (detail) {
    for (const atrium of r.atriums) {
      const c = atrium.center;
      box(f, 'glass', c[0], atrium.groundY - F - 0.2, c[1], 13, 24 - (atrium.groundY - F), 10);
      if (detail > 1)
        for (const sign of [-1, 1])
          bar(
            'wall',
            [c[0] + sign * 6, atrium.groundY - F - 0.3, c[1] + 5],
            [c[0] + sign * 6, 24, c[1] + 5],
            0.7,
          );
    }
    for (const s of r.displays) {
      const [x, z] = s.center;
      box(f, 'screen', x, 24, z, 12, 7, 1);
      for (const dx of [-4, 4]) bar('metal', [x + dx, 17, z], [x + dx, 24, z], 0.5);
    }
    const W = r.wicketAxis,
      T = [-W[1], W[0]],
      cricket = (x, z) => [x * W[0] + z * T[0], 0.315, x * W[1] + z * T[1]];
    f('pitch', [cricket(-14, -7), cricket(14, -7), cricket(14, 7), cricket(-14, 7)], [0, 1, 0]);
    f(
      'pitchPale',
      [
        cricket(-10.06, -1.525),
        cricket(10.06, -1.525),
        cricket(10.06, 1.525),
        cricket(-10.06, 1.525),
      ].map((p) => [p[0], p[1] + 0.01, p[2]]),
      [0, 1, 0],
    );
    for (const sign of [-1, 1]) {
      const x = sign * 10.06;
      f(
        'mark',
        [
          cricket(x - 0.06, -1.525),
          cricket(x + 0.06, -1.525),
          cricket(x + 0.06, 1.525),
          cricket(x - 0.06, 1.525),
        ].map((p) => [p[0], p[1] + 0.02, p[2]]),
        [0, 1, 0],
      );
      if (detail > 1)
        for (const z of [-0.114, 0, 0.114]) {
          const p = cricket(x, z);
          bar('mark', p, [p[0], 1.02, p[2]], 0.04);
        }
    }
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = i === angles.length - 1 ? tau : angles[i + 1],
        point = (a, s) => {
          const R = mcgRadius(r.inner, a) * s;
          return [R * Math.cos(a), 0.32, R * Math.sin(a)];
        };
      f('mark', [point(a, 0.951), point(b, 0.951), point(b, 0.949), point(a, 0.949)], [0, 1, 0]);
    }
  }
}
