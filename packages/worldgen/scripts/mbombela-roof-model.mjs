/** N0722: Mbombela's orange giraffe masts, stayed canopy, zebra bowl and green ramps. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0722',
  tau = Math.PI * 2;
export const mbombelaSegments = [12, 24, 40, 84];
export function mbombelaRadius(poly, a) {
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
  if (!hits.length) throw Error(`${candidateId}: missing native radial boundary`);
  return Math.min(...hits);
}
export function mbombelaFoundationOutline(r, detail) {
  return Array.from({ length: mbombelaSegments[detail] }, (_, i) => {
    const a = (i * tau) / mbombelaSegments[detail],
      R = mbombelaRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function mbombelaRoofPoint(r, a, t) {
  const outer = mbombelaRadius(r.outer, a) * 0.98,
    inner = mbombelaRadius(r.roofInner, a),
    R = outer * (1 - t) + inner * t,
    y =
      (t < 0.4 ? 37 + 1.75 * t : t < 0.75 ? 37.7 - (t - 0.4) * 2 : 37 - 4.8 * (t - 0.75)) +
      0.35 * Math.cos(2 * a);
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function mbombelaRoofMeshPoint(r, d, a, t) {
  const n = mbombelaSegments[d],
    rings =
      d === 0
        ? [0, 1]
        : d === 1
          ? [0, 0.4, 1]
          : d === 2
            ? [0, 0.4, 0.75, 1]
            : [0, 0.2, 0.4, 0.6, 0.75, 1],
    angle = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    i = Math.floor((angle / (Math.PI * 2)) * n),
    u = (angle / (Math.PI * 2)) * n - i,
    j = Math.min(
      rings.length - 2,
      rings.findIndex((q, k) => k < rings.length - 1 && t >= q && t <= rings[k + 1]),
    ),
    v = (t - rings[j]) / (rings[j + 1] - rings[j]),
    A = mbombelaRoofPoint(r, (i * Math.PI * 2) / n, rings[j]),
    B = mbombelaRoofPoint(r, ((i + 1) * Math.PI * 2) / n, rings[j]),
    C = mbombelaRoofPoint(r, ((i + 1) * Math.PI * 2) / n, rings[j + 1]),
    E = mbombelaRoofPoint(r, (i * Math.PI * 2) / n, rings[j + 1]);
  return u >= v
    ? A.map((x, k) => x * (1 - u) + B[k] * (u - v) + C[k] * v)
    : A.map((x, k) => x * (1 - v) + C[k] * u + E[k] * (v - u));
}
export function buildMbombelaStadium(face, detail, r) {
  const n = mbombelaSegments[detail],
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
      const R = mbombelaRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        mbombelaRadius(r.bowlInner, a) * (detail === 0 ? 1.18 : 1) * (1 - t) +
        mbombelaRadius(r.outer, a) * 0.86 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    lower = Math.min(r.minGround - F - 0.5, -0.4);
  prism(f, 'wall', { outline: mbombelaFoundationOutline(r, detail) }, lower, 0.27);
  box(f, 'turf', 0, 0.27, 0, 114, 0.03, 78);
  // Closed recessed services under the high folded shell; the outer hem remains open.
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      contact = r.columnContacts[detail][i] - F;
    f(
      'service',
      [body(a, lower, 0.84), body(b, lower, 0.84), body(b, 29, 0.84), body(a, 29, 0.84)],
      N,
    );
    if (detail) bar('wall', body(a, contact - 0.3, 0.905), body(a, 19, 0.905), 0.7);
    if (detail) {
      for (const y of [6, 13, 20]) {
        const ps = [body(a, y, 0.82), body(b, y, 0.82), body(b, y, 0.935), body(a, y, 0.935)];
        f('wall', ps, [0, 1, 0]);
        f(
          'wall',
          ps.map((p) => [p[0], p[1] - 0.45, p[2]]),
          [0, -1, 0],
        );
        f(
          'wall',
          [
            body(a, y, 0.935),
            body(b, y, 0.935),
            body(b, y - 0.45, 0.935),
            body(a, y - 0.45, 0.935),
          ],
          N,
        );
      }
      f(
        'glass',
        [
          body(a, contact + 0.3, 0.845),
          body(b, r.columnContacts[detail][(i + 1) % n] - F + 0.3, 0.845),
          body(b, 13.5, 0.845),
          body(a, 13.5, 0.845),
        ],
        N,
      );
      if (i % 4 === 0) {
        const p = body(m, 0, 0.858);
        box(f, 'entry', p[0], Math.max(contact, 5), p[2], 5.5, 4, 4.5);
      }
    }
  }
  // Orange supports remain geometric silhouettes at every level, with lattice/stays refined nearby.
  for (const mast of r.masts) {
    const [cx, cz] = mast.center,
      R = Math.hypot(cx, cz),
      N = [cx / R, cz / R],
      T = [-N[1], N[0]],
      G = mast.groundY - F,
      top = G + 48,
      p = (rr, y, t = 0) => [cx + N[0] * rr + T[0] * t, y, cz + N[1] * rr + T[1] * t],
      vertical = (role, ps, no) =>
        f(
          role,
          ps.map(([rr, t, y]) => p(rr, y, t)),
          [N[0] * no[0] + T[0] * no[1], no[2], N[1] * no[0] + T[1] * no[1]],
        ),
      angle = Math.atan2(cz, cx),
      head = p(14, top - 1.2);
    if (detail < 2) {
      prism(
        vertical,
        'orange',
        {
          outline:
            detail === 0
              ? [
                  [-0.7, G],
                  [0.7, G],
                  [10.2, top - 2.8],
                  [14, top - 1.2],
                  [10.5, top],
                  [9, top - 1],
                ]
              : [
                  [-0.7, G],
                  [0.7, G],
                  [0.7, 28],
                  [10.2, top - 2.8],
                  [14, top - 1.2],
                  [10.5, top],
                  [9, top - 1],
                  [-0.7, 27],
                ],
        },
        -0.35,
        0.35,
      );
    } else {
      bar('orange', p(-3, G - 0.2), p(-1, 28), 0.9);
      bar('orange', p(3, G - 0.2), p(1, 28), 0.9);
      prism(
        vertical,
        'orange',
        {
          outline: [
            [-3, G + 0.2],
            [-3, 28],
            [-13, 23],
            [-6, G + 4],
          ],
        },
        -0.6,
        0.6,
      );
      const count = detail === 2 ? 2 : 5;
      for (let j = 0; j < count; j++) {
        const t = j / count,
          u = (j + 1) / count,
          A = p(-1 + 10 * t, 28 + (top - 28) * t),
          B = p(-1 + 10 * u, 28 + (top - 28) * u),
          C = p(1 + 9.4 * t, 28 + (top - 28) * t),
          E = p(1 + 9.4 * u, 28 + (top - 28) * u);
        bar('orange', A, B, 0.38);
        bar('orange', C, E, 0.38);
        if (detail > 1) {
          bar('orange', A, E, 0.22);
          bar('orange', A, C, 0.2);
        }
      }
      bar('orange', p(9, top), p(14, top - 1.2), 0.5);
      bar('orange', p(14, top - 1.2), p(9.2, top - 2.5), 0.35);
    }
    for (const t of detail ? [0.2, 0.8] : [0.55]) {
      const q = mbombelaRoofMeshPoint(r, detail, angle, t);
      q[1] -= 0.12;
      if (detail) bar('metal', head, q, detail === 3 ? 0.14 : 0.24);
      else {
        const T = [-Math.sin(angle), 0, Math.cos(angle)],
          ps = [
            head.map((v, k) => v + T[k] * 0.12),
            q.map((v, k) => v + T[k] * 0.12),
            q.map((v, k) => v - T[k] * 0.12),
            head.map((v, k) => v - T[k] * 0.12),
          ];
        f('metal', ps, [Math.cos(angle), 0, Math.sin(angle)]);
        f('metal', ps, [-Math.cos(angle), 0, -Math.sin(angle)]);
      }
    }
  }
  for (const [ci, c] of r.cores.entries()) {
    if (!detail && ci % 2) continue;
    const N = c.normal,
      T = [-N[1], N[0]],
      base = c.groundY - F - 0.3,
      top = c.groundY - F + 23,
      emit = (role, ps, no) =>
        f(
          role,
          ps.map(([x, y, z]) => [
            c.center[0] + x * T[0] + z * N[0],
            y,
            c.center[1] + x * T[1] + z * N[1],
          ]),
          [no[0] * T[0] + no[2] * N[0], no[1], no[0] * T[1] + no[2] * N[1]],
        );
    box(emit, 'wall', 0, base, 0, 8, top - base, 10);
    if (detail > 1) {
      for (const x of [-2.3, 2.3]) box(emit, 'entry', x, base + 3, 5.02, 1, 14, 0.05);
      box(emit, 'wall', 0, top, 0, 8.2, 0.4, 10.2);
    }
  }
  for (const ramp of r.ramps) {
    const base = ramp.groundY - F + 0.15,
      top = 13,
      rx = 14,
      rz = 10,
      N = ramp.normal,
      T = [-N[1], N[0]],
      at = (a, y, s) => [
        ramp.center[0] + rx * Math.cos(a) * s * T[0] + rz * Math.sin(a) * s * N[0],
        y,
        ramp.center[1] + rx * Math.cos(a) * s * T[1] + rz * Math.sin(a) * s * N[1],
      ];
    if (!detail) {
      const ring = Array.from({ length: 6 }, (_, i) => {
        const p = at((i * tau) / 6, 0, 1);
        return [p[0], p[2]];
      });
      prism(f, 'green', { outline: ring }, base, top);
      continue;
    }
    const count = [0, 8, 28, 80][detail];
    for (let j = 0; j < count; j++) {
      const a = (j / count) * tau * 2,
        b = ((j + 1) / count) * tau * 2,
        y = base + ((top - base) * j) / count,
        z = base + ((top - base) * (j + 1)) / count,
        A = at(a, y, 0.7),
        B = at(a, y, 1),
        C = at(b, z, 1),
        E = at(b, z, 0.7),
        bottom = (p) => [p[0], p[1] - 0.3, p[2]],
        out = [
          Math.cos((a + b) / 2) * T[0] + Math.sin((a + b) / 2) * N[0],
          0,
          Math.cos((a + b) / 2) * T[1] + Math.sin((a + b) / 2) * N[1],
        ];
      for (const tri of [
        [A, B, C],
        [A, C, E],
      ]) {
        f('wall', tri, [0, 1, 0]);
        f('wall', tri.map(bottom), [0, -1, 0]);
      }
      f('wall', [B, C, bottom(C), bottom(B)], out);
      f(
        'wall',
        [A, E, bottom(E), bottom(A)],
        out.map((v) => -v),
      );
      for (const scale of [0.7, 1]) {
        const p = at(a, y, scale),
          q = at(b, z, scale),
          lo = [p, q, [q[0], q[1] + 1.05, q[2]], [p[0], p[1] + 1.05, p[2]]],
          no = scale === 1 ? out : out.map((v) => -v),
          inside = lo.map((v) => [v[0] + no[0] * -0.15, v[1], v[2] + no[2] * -0.15]);
        f('green', lo, no);
        f(
          'green',
          inside,
          no.map((v) => -v),
        );
        f('green', [lo[3], lo[2], inside[2], inside[3]], [0, 1, 0]);
        if (j === 0)
          f('green', [lo[0], lo[3], inside[3], inside[0]], [Math.sin(a), 0, -Math.cos(a)]);
        if (j === count - 1)
          f('green', [lo[1], lo[2], inside[2], inside[1]], [-Math.sin(b), 0, Math.cos(b)]);
      }
      if (j === 0) f('wall', [A, B, bottom(B), bottom(A)], [Math.sin(a), 0, -Math.cos(a)]);
      if (j === count - 1) f('wall', [E, C, bottom(C), bottom(E)], [-Math.sin(b), 0, Math.cos(b)]);
    }
    if (detail > 1)
      for (const [i, p] of ramp.supports.entries())
        bar(
          'wall',
          [p[0], ramp.supportGround[i] - F - 0.2, p[1]],
          [p[0], base + (top - base) * (i === 0 ? 1 : 0.5 + i / 16) - 0.12, p[1]],
          0.6,
        );
    const a = tau * 2,
      p = at(a, top, 0.85),
      R = mbombelaRadius(r.outer, Math.atan2(p[2], p[0])) * 0.9,
      q = [R * Math.cos(Math.atan2(p[2], p[0])), top, R * Math.sin(Math.atan2(p[2], p[0]))];
    bar('wall', p, q, 4, 0.4);
  }
  // Broad irregular zebra stripes are geometry colors over shared seat paint, never a copied seating bitmap.
  const rows = detail === 3 ? [20, 6, 22] : detail === 2 ? [6, 3, 6] : [1, 1, 1];
  for (const [ti, t] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          t0 = t.t0 + ((t.t1 - t.t0) * row) / rows[ti],
          t1 = t.t0 + ((t.t1 - t.t0) * (row + 1)) / rows[ti],
          y0 = t.y0 + ((t.y1 - t.y0) * row) / rows[ti],
          y1 = t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
          aisle = detail > 1 && i % (detail === 3 ? 12 : 6) === 0,
          role = aisle
            ? 'wall'
            : Math.sin(m * 18 + y1 * 0.28 + 1.2 * Math.sin(m * 5)) > 0
              ? 'seatPale'
              : 'seat';
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
    f('seat', [at(0, a, 0.3), at(0, b, 0.3), at(0, b, 1.4), at(0, a, 1.4)], N);
    for (const [t, lo, hi, next] of [
      [0.35, 11.5, 14.5, 0.41],
      [0.51, 17.5, 20, 0.57],
    ]) {
      f('entry', [at(t, a, lo), at(t, b, lo), at(t, b, hi), at(t, a, hi)], N);
      f('wall', [at(t, a, hi), at(t, b, hi), at(next, b, hi), at(next, a, hi)], [0, 1, 0]);
    }
    f('wall', [at(0.98, a, 20), at(0.98, b, 20), at(0.98, b, 30), at(0.98, a, 30)], N);
  }
  // Closed rounded-rectangle canopy, including its visible underside and diamond tone fields.
  const rings =
    detail === 0
      ? [0, 1]
      : detail === 1
        ? [0, 0.4, 1]
        : detail === 2
          ? [0, 0.4, 0.75, 1]
          : [0, 0.2, 0.4, 0.6, 0.75, 1];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rings.length - 1; j++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        t = rings[j],
        u = rings[j + 1],
        ps = [
          mbombelaRoofPoint(r, a, t),
          mbombelaRoofPoint(r, b, t),
          mbombelaRoofPoint(r, b, u),
          mbombelaRoofPoint(r, a, u),
        ],
        low = ps.map((p) => [p[0], p[1] - 0.32, p[2]]),
        pale = Math.floor((i * 18) / n) % 4 === 0,
        role = pale ? 'roofPale' : 'roof';
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
          ids.map((k) => low[k]),
          [0, -1, 0],
        );
      }
      if (j === rings.length - 2)
        f(
          'metal',
          [ps[2], ps[3], low[3], low[2]],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
    }
  if (detail)
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        low = (a, t, dy) => mbombelaRoofPoint(r, a, t).map((v, k) => (k === 1 ? v - dy : v)),
        A = low(a, 1, 0.45),
        B = low(b, 1, 0.45),
        C = low(a, 1, 3),
        E = low(b, 1, 3);
      bar('metal', A, B, 0.3);
      if (detail > 1) {
        bar('metal', C, E, 0.4);
        if (detail === 3 || i % 2 === 0) {
          bar('metal', A, C, 0.26);
          bar('metal', A, E, 0.2);
        }
      }
      if (detail === 3 || (detail === 2 && i % 2 === 0)) {
        const ts = [0, 0.4, 0.75, 1];
        for (let j = 0; j < ts.length - 1; j++) {
          const p = low(a, ts[j], 0.4),
            q = low(a, ts[j + 1], 0.4),
            lo = p.map((v, k) => (k === 1 ? v - 1.6 : v)),
            hi = q.map((v, k) => (k === 1 ? v - 1.6 : v));
          bar('metal', p, q, 0.26);
          bar('metal', lo, hi, 0.26);
          bar('metal', lo, q, 0.17);
        }
        bar('wall', body(a, 24, 0.905), low(a, 0, 0.45), 0.45);
        if (detail === 3)
          for (const t of [0.2, 0.6, 0.75]) bar('metal', low(a, t, 0.37), low(b, t, 0.37), 0.14);
        if (i % 6 === 0) {
          box(f, 'mark', C[0], C[1] - 0.7, C[2], 1.6, 0.55, 0.65);
          bar('metal', C, [C[0], C[1] - 0.5, C[2]], 0.15);
        }
      }
    }
  if (detail)
    for (const sign of [-1, 1]) {
      const a = sign > 0 ? 0 : Math.PI,
        roof = mbombelaRoofPoint(r, a, 1),
        x = roof[0] * 0.985;
      box(f, 'screen', x, roof[1] - 11, 0, 0.7, 4.5, 10);
      for (const z of [-3.5, 3.5]) {
        const p = mbombelaRoofMeshPoint(r, detail, Math.atan2(z, x), 1);
        bar('metal', [x, roof[1] - 6.8, z], [p[0], p[1] - 0.28, p[2]], detail ? 0.2 : 0.6);
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
