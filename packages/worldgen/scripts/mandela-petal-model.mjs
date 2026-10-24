/** nelson_mandela_bay_stadium: Nelson Mandela Bay's curved metal petals, membrane fields and open galleries. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'nelson_mandela_bay_stadium',
  tau = Math.PI * 2;
export function mandelaRadius(poly, a) {
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
  if (!hits.length) throw Error(`${candidateId}: missing mapped radial boundary`);
  return Math.min(...hits);
}
export function mandelaOuterRadius(r, a) {
  const w = tau / 36 / 4;
  return [-2, -1, 0, 1, 2].reduce((sum, k) => sum + mandelaRadius(r.outer, a + k * w), 0) / 5;
}
export function mandelaBodyRadius(r, a) {
  return mandelaOuterRadius(r, a) * 0.925;
}
export function mandelaFoundationOutline(r, detail) {
  const n = [12, 24, 36, 72][detail];
  return Array.from({ length: n }, (_, i) => {
    const a = (i * tau) / n,
      R = mandelaBodyRadius(r, a);
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function mandelaRoofPoint(r, a, t) {
  const profiles = [
      [0, 0.985, 17],
      [0.18, 1.01, 26],
      [0.42, 0.96, 37],
      [0.68, 0.6, 40],
      [1, 0, 37.5],
    ],
    i = Math.min(
      profiles.length - 2,
      Math.max(
        0,
        profiles.findIndex(
          (p, i) => i < profiles.length - 1 && t >= p[0] && t <= profiles[i + 1][0],
        ),
      ),
    ),
    p = profiles[i],
    q = profiles[i + 1],
    u = (t - p[0]) / (q[0] - p[0]),
    outer = mandelaOuterRadius(r, a),
    inner = mandelaRadius(r.roofInner, a),
    radius = (P) => (P[0] <= 0.42 ? outer * P[1] : inner + ((outer * 0.96 - inner) * P[1]) / 0.96),
    R = radius(p) * (1 - u) + radius(q) * u,
    y = p[2] * (1 - u) + q[2] * u;
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export const mandelaPetalWidth = (t) => 0.015 + 0.31 * Math.sin(Math.PI * t * 0.86);
export function buildMandelaStadium(face, detail, r) {
  const F = r.floorY,
    n = [12, 24, 36, 72][detail],
    petals = detail ? 36 : 12,
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
    body = (a, y, scale = 1) => {
      const R = mandelaBodyRadius(r, a) * scale;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = mandelaRadius(r.inner, a) * (1 - t) + mandelaBodyRadius(r, a) * 0.97 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    };
  prism(
    f,
    'wall',
    { outline: mandelaFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.5, -0.3),
    0.27,
  );
  prism(
    f,
    'turf',
    {
      outline: Array.from({ length: n }, (_, i) => {
        const a = (i * tau) / n,
          R = mandelaRadius(r.inner, a);
        return [R * Math.cos(a), R * Math.sin(a)];
      }),
    },
    0.27,
    0.3,
  );
  const rows = detail === 3 ? [24, 6, 9] : detail === 2 ? [7, 2, 2] : [1, 1, 1];
  for (const [ti, tier] of r.tiers.entries())
    for (let j = 0; j < rows[ti]; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          t0 = tier.t0 + ((tier.t1 - tier.t0) * j) / rows[ti],
          t1 = tier.t0 + ((tier.t1 - tier.t0) * (j + 1)) / rows[ti],
          y1 = tier.y0 + ((tier.y1 - tier.y0) * (j + 1)) / rows[ti],
          y0 = detail < 2 ? tier.y0 + ((tier.y1 - tier.y0) * j) / rows[ti] : y1,
          base =
            j === 0
              ? ti === 0
                ? 0.27
                : tier.y0 - 2
              : tier.y0 + ((tier.y1 - tier.y0) * j) / rows[ti] - 0.03,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          role = i % 7 === 1 ? 'seatWarm' : 'seat';
        if (detail > 1 && i % 2 === 0) {
          const p = ps[0].map((v, k) => v + (ps[1][k] - v) * 0.12),
            q = ps[3].map((v, k) => v + (ps[2][k] - v) * 0.12);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(role, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(role, ps, [0, 1, 0]);
        const bottom = lo.map((p) => [p[0], base, p[2]]),
          normal = [-Math.cos(m), 0, -Math.sin(m)];
        if (detail > 1 && i % 2 === 0) {
          const p = lo[0].map((v, k) => v + (lo[1][k] - v) * 0.12),
            q = bottom[0].map((v, k) => v + (bottom[1][k] - v) * 0.12);
          f('wall', [lo[0], p, q, bottom[0]], normal);
          f(role, [p, lo[1], bottom[1], q], normal);
        } else f(role, [lo[0], lo[1], bottom[1], bottom[0]], normal);

        if (j === rows[ti] - 1)
          f(
            'wall',
            [hi[0], hi[1], [hi[1][0], tier.y0 - 2, hi[1][2]], [hi[0][0], tier.y0 - 2, hi[0][2]]],
            [Math.cos(m), 0, Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      no = [Math.cos(m), 0, Math.sin(m)],
      contact = r.columnContacts[detail][i] - F;
    // Two open concrete colonnade levels below the continuous glazed box band.
    bar('wall', body(a, contact - 0.3), body(a, 17), detail ? 0.65 : 1.1);
    if (detail > 1)
      box(
        f,
        'wall',
        ...(() => {
          const p = body(a, 0);
          return [p[0], contact - 0.35, p[2], 1.6, 0.6, 1.6];
        })(),
      );
    for (const y of [8, 15.6]) {
      f(
        'wall',
        [body(a, y, 0.91), body(b, y, 0.91), body(b, y, 1.005), body(a, y, 1.005)],
        [0, 1, 0],
      );
      f('wall', [body(a, y), body(b, y), body(b, y - 0.5), body(a, y - 0.5)], no);
    }
    f(
      'glass',
      [body(a, 16, 0.965), body(b, 16, 0.965), body(b, 20.5, 0.965), body(a, 20.5, 0.965)],
      no,
    );
    if (detail) {
      f('service', [body(a, 7, 0.9), body(b, 7, 0.9), body(b, 15, 0.9), body(a, 15, 0.9)], no);
      for (const t of [0.565, 0.77]) {
        const y = t < 0.6 ? 16.9 : 25;
        f('wall', [at(t, a, y), at(t, b, y), at(t + 0.045, b, y), at(t + 0.045, a, y)], [0, 1, 0]);
        f(
          'glass',
          [
            at(t + 0.04, a, y + 0.2),
            at(t + 0.04, b, y + 0.2),
            at(t + 0.04, b, y + 2),
            at(t + 0.04, a, y + 2),
          ],
          no.map((v) => -v),
        );
      }
      if (i % 6 === 0) {
        const center = body(m, 0, 0.91),
          tangent = [-Math.sin(m), 0, Math.cos(m)];
        box(f, 'entry', center[0], Math.max(contact, 6), center[2], 5, 4, 4);
        if (detail > 1)
          for (let j = 0; j < (detail === 3 ? 10 : 3); j++) {
            const p = center.map(
              (v, k) =>
                v +
                tangent[k] * (j - (detail === 3 ? 5 : 1.5)) * (detail === 3 ? 0.7 : 2) +
                no[k] * 3,
            );
            box(
              f,
              'wall',
              p[0],
              Math.max(contact, 6),
              p[2],
              0.8,
              (j + 1) * (detail === 3 ? 0.2 : 0.65),
              3.5,
            );
          }
      }
    }
  }
  // Closed curved opaque leaves alternate with closed, quiet membrane fields.
  const steps = [2, 2, 4, 12][detail],
    crosses = [1, 1, 2, 4][detail],
    bay = tau / petals;
  for (let i = 0; i < petals; i++) {
    const center = i * bay,
      leaf = (t, u) => {
        const a = center + mandelaPetalWidth(t) * bay * u,
          p = mandelaRoofPoint(r, a, t);
        p[1] += 1.05 * Math.sin(Math.PI * t) * (1 - u * u);
        return p;
      },
      membrane = (t, u) => {
        const w = mandelaPetalWidth(t),
          a = center + bay * (w + (1 - 2 * w) * u),
          p = mandelaRoofPoint(r, a, t);
        p[1] += 7 * Math.sin(Math.PI * u) * Math.pow(1 - t, 4);
        return p;
      };
    for (const [role, point] of [
      ['roof', leaf],
      ['membrane', membrane],
    ])
      for (let j = 0; j < steps; j++)
        for (let k = 0; k < crosses; k++) {
          const t0 = j / steps,
            t1 = (j + 1) / steps,
            u0 = role === 'roof' ? -1 + (2 * k) / crosses : k / crosses,
            u1 = role === 'roof' ? -1 + (2 * (k + 1)) / crosses : (k + 1) / crosses,
            ps = [point(t0, u0), point(t0, u1), point(t1, u1), point(t1, u0)],
            low = ps.map(([x, y, z]) => [x, y - 0.32, z]);
          const pa = point(t0, (u0 + u1) / 2),
            pb = point(t1, (u0 + u1) / 2),
            angle = Math.atan2((pa[2] + pb[2]) / 2, (pa[0] + pb[0]) / 2),
            dy = pb[1] - pa[1],
            dr = Math.hypot(pb[0], pb[2]) - Math.hypot(pa[0], pa[2]),
            normal = [Math.cos(angle) * dy, -dr, Math.sin(angle) * dy];
          for (const ids of [
            [0, 1, 2],
            [0, 2, 3],
          ]) {
            f(
              role,
              ids.map((k) => ps[k]),
              normal,
            );
            f(
              role,
              ids.map((k) => low[k]),
              normal.map((v) => -v),
            );
          }
          if (j === 0)
            f(
              role,
              [ps[0], ps[1], low[1], low[0]],
              [Math.cos(center + bay * 0.3), 0, Math.sin(center + bay * 0.3)],
            );
          if (j === steps - 1)
            f(
              role,
              [ps[2], ps[3], low[3], low[2]],
              [-Math.cos(center + bay * 0.3), 0, -Math.sin(center + bay * 0.3)],
            );
          // Shared top/bottom vertices close material seams without duplicate interior caps.
        }
    if (detail) {
      // Inner underside truss and the deep rolled petal support share actual roof endpoints.
      const points = Array.from({ length: steps + 1 }, (_, j) => {
        const p = leaf(j / steps, 0);
        p[1] -= 0.85;
        return p;
      });
      for (let j = 0; j < steps; j++) {
        bar('metal', points[j], points[j + 1], 0.35, 0.5);
        if (detail > 1) {
          const a = points[j].map((v, k) => (k === 1 ? v - 1.4 : v)),
            b = points[j + 1].map((v, k) => (k === 1 ? v - 1.4 : v));
          if (detail === 3) {
            const tangent = [-Math.sin(center), 0, Math.cos(center)],
              shift = (p, s) => p.map((v, k) => v + tangent[k] * s);
            for (const s of [-0.65, 0.65]) bar('metal', shift(a, s), shift(b, s), 0.26);
            bar('metal', shift(a, j % 2 ? -0.65 : 0.65), points[j + 1], 0.18);
            if (j % 3 === 0) bar('metal', shift(a, -0.65), shift(a, 0.65), 0.2);
          } else {
            bar('metal', a, b, 0.48, 0.26);
            bar('metal', a, points[j + 1], 0.18);
          }
        }
      }
      bar('metal', body(center, 16, 0.965), points[0], 0.55);
      if (detail > 1) {
        for (const t of [0.4, 0.7])
          bar(
            'metal',
            leaf(t, -1).map((v, k) => (k === 1 ? v - 0.55 : v)),
            leaf(t, 1).map((v, k) => (k === 1 ? v - 0.55 : v)),
            0.18,
          );
        const p = leaf(1, 0);
        bar('metal', [p[0], p[1] - 0.3, p[2]], [p[0], p[1] - 1.8, p[2]], 0.15);
        box(f, 'screen', p[0], p[1] - 2, p[2], 1.7, 0.8, 0.7);
      }
    }
  }
  for (const sign of [-1, 1]) {
    const a = sign > 0 ? 0 : Math.PI,
      R = mandelaRadius(r.roofInner, a),
      x = sign * R;
    box(f, 'screen', x, 29.5, 0, 0.8, 4, 10);
    for (const z of [-3, 3]) bar('metal', [x, 33, z], [x, 37.2, z], detail ? 0.22 : 0.65);
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
        bar('mark', [sign * 52.5, 0.32, z], [sign * 52.5, 2.76, z], 0.1);
      bar('mark', [sign * 52.5, 2.76, -3.66], [sign * 52.5, 2.76, 3.66], 0.1);
    }
    const count = detail === 1 ? 12 : 32;
    for (let i = 0; i < count; i++) {
      const a = (i * tau) / count,
        b = ((i + 1) * tau) / count;
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
