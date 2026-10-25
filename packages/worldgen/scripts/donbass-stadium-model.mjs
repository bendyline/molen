/** 'donbass_arena': individual Donbass Arena, inclined saucer roof and three-tier bowl. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export const donbassSegments = [12, 20, 32, 64];
const tau = Math.PI * 2;
export function donbassRadius(poly, a) {
  const d = [Math.cos(a), Math.sin(a)],
    hits = [],
    cross = (p, q) => p[0] * q[1] - p[1] * q[0];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      v = poly[(i + 1) % poly.length].map((x, k) => x - p[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(p, v) / den,
      u = cross(p, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error('donbass_arena: missing native radial boundary');
  return Math.min(...hits);
}
export function donbassFoundationOutline(r, detail) {
  return Array.from({ length: donbassSegments[detail] }, (_, i) => {
    const a = (i * tau) / donbassSegments[detail],
      R = donbassRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
/** The roof tilts toward geographic south, independently of the local pitch direction. */
export function donbassRoofPoint(r, a, t) {
  const R = donbassRadius(r.inner, a) * (1 - t) + donbassRadius(r.outer, a) * t,
    x = R * Math.cos(a),
    z = R * Math.sin(a),
    south = x * r.xAxis[1] + z * r.zAxis[1];
  return [x, 46 - south * 0.045 + 2.5 * (1 - t) - Math.sin(Math.PI * t), z];
}
export function buildDonbassStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    n = donbassSegments[detail],
    step = tau / n,
    body = (a, y, s = 1) => {
      const R = donbassRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = donbassRadius(r.bowlInner, a) * (1 - t) + donbassRadius(r.outer, a) * 0.91 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    slab = (role, ps, thick = 0.3) => {
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        if (detail)
          f(
            role,
            ids.map((i) => [ps[i][0], ps[i][1] - thick, ps[i][2]]),
            [0, -1, 0],
          );
      }
      const sign = Math.sign(
        ps.reduce((s, p, i) => s + p[0] * ps[(i + 1) % 4][2] - p[2] * ps[(i + 1) % 4][0], 0),
      );
      for (const i of [0, 2]) {
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    upper = (a, y) => {
      const p = body(a, 0, 0.9);
      return y - (p[0] * r.xAxis[1] + p[2] * r.zAxis[1]) * 0.025;
    };
  prism(
    f,
    'wall',
    { outline: donbassFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.6, -0.5),
    0.27,
  );
  box(f, 'turf', 0, 0.27, 0, 112, 0.03, 74);
  const roofBands = detail < 2 ? [0, 0.25, 1] : [0, 0.12, 0.25, 0.5, 0.75, 1];
  for (let i = 0; i < n; i++) {
    const a = i * step,
      b = (i + 1) * step,
      m = (a + b) * 0.5,
      N = [Math.cos(m), 0, Math.sin(m)],
      A = donbassRoofPoint(r, a, 1),
      B = donbassRoofPoint(r, b, 1),
      I = donbassRoofPoint(r, a, 0),
      J = donbassRoofPoint(r, b, 0),
      G = r.columnContacts[detail][i] - F,
      H = r.columnContacts[detail][(i + 1) % n] - F;
    // Closed lower retail/services follow individual original grades, below a common concourse.
    f(
      'wall',
      [
        body(a, Math.min(G - 0.2, 0), 0.89),
        body(b, Math.min(H - 0.2, 0), 0.89),
        body(b, 12, 0.89),
        body(a, 12, 0.89),
      ],
      N,
    );
    if (detail) {
      f(
        'glass',
        [
          body(a, Math.max(G + 0.5, 2), 0.891),
          body(b, Math.max(H + 0.5, 2), 0.891),
          body(b, 10, 0.891),
          body(a, 10, 0.891),
        ],
        N,
      );
      slab(
        'wall',
        [body(a, 12, 0.82), body(b, 12, 0.82), body(b, 12, 0.96), body(a, 12, 0.96)],
        0.55,
      );
    }
    const facade = [
      body(a, 12, 0.88),
      body(b, 12, 0.88),
      body(b, B[1] - 2.2, 0.98),
      body(a, A[1] - 2.2, 0.98),
    ];
    // Closed glazing is visible from both the outside and the bowl. Fix its diagonal
    // before winding reversal so the inclined front and back are the same surface.
    for (const ids of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      const points = ids.map((k) => facade[k]);
      f('glass', points, N);
      f(
        'glass',
        points,
        N.map((v) => -v),
      );
    }
    f('wall', [body(a, A[1] - 2.2, 0.98), body(b, B[1] - 2.2, 0.98), B, A], N);
    for (let j = 0; j < roofBands.length - 1; j++)
      slab(
        roofBands[j + 1] <= 0.25 ? 'roofGlass' : 'roof',
        [
          donbassRoofPoint(r, a, roofBands[j]),
          donbassRoofPoint(r, b, roofBands[j]),
          donbassRoofPoint(r, b, roofBands[j + 1]),
          donbassRoofPoint(r, a, roofBands[j + 1]),
        ],
        0.28,
      );
    // Paired inner chords and diagonals express the deep space frame, not a paper-thin roof.
    bar(
      'metal',
      [I[0], I[1] - 0.9, I[2]],
      [J[0], J[1] - 0.9, J[2]],
      detail ? 0.45 : 1.0,
      detail ? 1.0 : 1.0,
    );
    if (detail) {
      bar('metal', [I[0], I[1] - 4, I[2]], [J[0], J[1] - 4, J[2]], 0.35);
      if (detail > 1 || i % 2 === 0) {
        bar('metal', [I[0], I[1] - 0.9, I[2]], [I[0], I[1] - 4, I[2]], 0.25);
        bar('metal', [I[0], I[1] - 4, I[2]], [J[0], J[1] - 0.9, J[2]], 0.2);
      }
      if (detail > 1)
        for (const t of [0.25, 0.5, 0.75]) {
          const p = donbassRoofPoint(r, a, t),
            q = donbassRoofPoint(r, b, t);
          bar('metal', [p[0], p[1] - 0.8, p[2]], [q[0], q[1] - 0.8, q[2]], 0.25);
        }
      if (detail > 1) {
        const C = body(a, 12, 0.88),
          T = body(a, A[1] - 2.2, 0.98);
        bar('metal', C, T, 0.18);
        for (const y of [20, 29, 38])
          if (y < Math.min(A[1], B[1]) - 2.2) {
            const t = (y - 12) / (A[1] - 14.2),
              s = 0.88 + 0.1 * t;
            bar('metal', body(a, y, s), body(b, y, s), 0.18);
          }
      }
    }
    const tiers = [
        { lo: 0, hi: 0.37, y0: 1.4, y1: 14 },
        { lo: 0.44, hi: 0.62, y0: 18, y1: 23.5 },
        { lo: 0.7, hi: 0.99, y0: 27, y1: 34 },
      ],
      rows = detail === 3 ? [22, 10, 16] : detail === 2 ? [5, 3, 5] : [1, 1, 1];
    for (const [ti, t] of tiers.entries())
      for (let j = 0; j < rows[ti]; j++) {
        const u = j / rows[ti],
          v = (j + 1) / rows[ti],
          lo = t.lo + (t.hi - t.lo) * u,
          hi = t.lo + (t.hi - t.lo) * v,
          y = t.y0 + (t.y1 - t.y0) * v,
          Y = (ang, h) => (ti === 2 ? upper(ang, h) : h),
          role =
            detail > 1 && i % 6 === 0
              ? 'wall'
              : i % 7 === 0 || (ti === 0 && i % 5 === 0)
                ? 'seatDark'
                : 'seatOrange';
        slab(
          role,
          [
            at(lo, a, Y(a, detail < 2 ? t.y0 : y)),
            at(lo, b, Y(b, detail < 2 ? t.y0 : y)),
            at(hi, b, Y(b, detail < 2 ? t.y1 : y)),
            at(hi, a, Y(a, detail < 2 ? t.y1 : y)),
          ],
          detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.12 : 0.4,
        );
      }
    for (const [t0, t1, y0, y1] of [
      [0.37, 0.44, 14, 18],
      [0.62, 0.7, 23.5, 27],
    ]) {
      f(
        'glass',
        [at(t0, a, y0), at(t0, b, y0), at(t0, b, y1), at(t0, a, y1)],
        N.map((v) => -v),
      );
      slab('wall', [at(t0, a, y1), at(t0, b, y1), at(t1, b, y1), at(t1, a, y1)], 0.4);
    }
  }
  // Twelve primary roof trusses and pale framed, outward-leaning facade service-core approximations.
  const cores = detail === 0 ? 6 : 12;
  for (let i = 0; i < cores; i++) {
    const a = (i * tau) / cores,
      p = donbassRoofPoint(r, a, 1),
      q = donbassRoofPoint(r, a, 0),
      N = [Math.cos(a), 0, Math.sin(a)],
      low = body(a, 11, 0.88),
      high = body(a, p[1] - 1.7, 0.98),
      width = detail === 0 ? 5 : 7.5,
      tangent = [-Math.sin(a), 0, Math.cos(a)],
      shift = (v, s) => v.map((x, k) => x + tangent[k] * s);
    bar('wall', low, high, width, 1.1);
    if (detail) {
      const fore = (v) => v.map((x, k) => x + N[k] * 0.65);
      f(
        'glass',
        [
          fore(shift(low, -width * 0.28)),
          fore(shift(low, width * 0.28)),
          fore(shift(high, width * 0.28)),
          fore(shift(high, -width * 0.28)),
        ],
        N,
      );
      for (const sign of [-1, 1])
        bar('wall', shift(low, sign * width * 0.5), shift(high, sign * width * 0.5), 0.5, 0.9);
      const lower = q.map((x, k) => (k === 1 ? x - 4 : x)),
        rear = p.map((x, k) => (k === 1 ? x - 1.5 : x));
      bar('metal', rear, q, 0.5);
      bar('metal', rear, lower, 0.45);
      bar('metal', q, lower, 0.35);
      if (detail > 1)
        for (let j = 1; j < 5; j++) {
          const t = j / 5,
            A = rear.map((x, k) => x * (1 - t) + q[k] * t),
            B = rear.map((x, k) => x * (1 - t) + lower[k] * t);
          bar('metal', A, B, 0.22);
          const t2 = (j - 1) / 5,
            C = rear.map((x, k) => x * (1 - t2) + q[k] * t2);
          bar('metal', C, B, 0.2);
        }
    }
  }
  if (detail) {
    for (const sign of [-1, 1]) {
      const a = sign > 0 ? 0 : Math.PI,
        p = donbassRoofPoint(r, a, 0),
        x = p[0];
      box(f, 'display', x, p[1] - 7.3, 0, 0.65, 5.3, 11);
      for (const z of [-3, 3]) bar('metal', [x, p[1] - 1, z], [x, p[1] - 7.3, z], 0.25);
    }
    // Four broad entry flights remain inside the own mapped envelope and meet sampled original grade.
    for (let i = 0; i < 4; i++) {
      const a = ((i + 0.5) * tau) / 4,
        R = donbassRadius(r.outer, a),
        ground = r.entryContacts[i] - F,
        h = Math.max(1, 12 - ground),
        count = detail === 3 ? Math.min(64, Math.ceil(h / 0.22)) : 6;
      for (let j = 0; j < count; j++) {
        const u = j / count,
          v = (j + 1) / count,
          lo = R * (0.97 - 0.14 * u),
          hi = R * (0.97 - 0.14 * v),
          y = ground + h * v,
          tangent = [-Math.sin(a), Math.cos(a)],
          A = [lo * Math.cos(a), y, lo * Math.sin(a)],
          B = [hi * Math.cos(a), y, hi * Math.sin(a)],
          off = (p, w) => [p[0] + tangent[0] * w, p[1], p[2] + tangent[1] * w];
        slab('wall', [off(A, -4), off(A, 4), off(B, 4), off(B, -4)], h / count + 0.05);
      }
    }
    const line = (x, z, w, d) =>
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
    for (const z of [-34, 34]) line(0, z, 105, 0.12);
    for (const x of [-52.5, 0, 52.5]) line(x, 0, 0.12, 68);
    for (const sign of [-1, 1]) {
      const x = sign * 52.5;
      for (const z of [-3.66, 3.66]) bar('mark', [x, 0.3, z], [x, 2.74, z], 0.1);
      bar('mark', [x, 2.74, -3.66], [x, 2.74, 3.66], 0.1);
      for (const z of [-20.16, 20.16]) line(sign * 44.25, z, 16.5, 0.12);
      line(sign * 36, 0, 0.12, 40.32);
    }
    const count = detail > 1 ? 32 : 12;
    for (let i = 0; i < count; i++)
      bar(
        'mark',
        [9.15 * Math.cos((i * tau) / count), 0.315, 9.15 * Math.sin((i * tau) / count)],
        [9.15 * Math.cos(((i + 1) * tau) / count), 0.315, 9.15 * Math.sin(((i + 1) * tau) / count)],
        0.1,
        0.02,
      );
  }
}
