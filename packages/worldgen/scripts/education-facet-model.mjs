/** N0719: Education City's folded silver shell, chevron vents and green bowl. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0719',
  tau = Math.PI * 2;
export const educationSegments = [12, 24, 40, 96];
export function educationRadius(poly, a) {
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
export function educationFoundationOutline(r, detail) {
  return Array.from({ length: educationSegments[detail] }, (_, i) => {
    const a = (i * tau) / educationSegments[detail],
      R = educationRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function educationRoofPoint(r, a, t) {
  const outer = educationRadius(r.outer, a) * 0.94,
    inner = educationRadius(r.aperture, a),
    R = outer * (1 - t) + inner * t,
    y = t < 0.4 ? 47 + 2.5 * t : t < 0.75 ? 48 - (t - 0.4) / 0.35 : 47 - 12 * (t - 0.75);
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function educationFacadePoint(r, a, y) {
  const scale =
      y <= 23
        ? 0.91 + ((y - 10) / 13) * 0.09
        : y <= 36
          ? 1 - ((y - 23) / 13) * 0.015
          : 0.985 - ((y - 36) / 11) * 0.045,
    R = educationRadius(r.outer, a) * scale;
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function buildEducationStadium(face, detail, r) {
  const n = educationSegments[detail],
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
      const R = educationRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        educationRadius(r.aperture, a) * 0.93 * (1 - t) + educationRadius(r.outer, a) * 0.9 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    lower = Math.min(r.minGround - F - 0.5, -0.4);
  prism(f, 'wall', { outline: educationFoundationOutline(r, detail) }, lower, 0.27);
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
    bar('wall', body(a, contact - 0.3, 0.905), body(a, 19, 0.905), detail ? 0.7 : 1.2);
    if (detail) {
      for (const y of [10, 18, 26]) {
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
  // Offset facet rows create real flat diamond folds; four chevron bands are recessed.
  const bases =
      detail === 0
        ? [10, 23, 36, 47]
        : detail === 1
          ? [10, 23, 37, 38, 47]
          : [10, 23, 34, 34.6, 35.6, 36.2, 37.2, 37.8, 38.8, 39.4, 47],
    point = (i, j, inset = 0) => {
      const a = ((i + (j === 1 ? 0.5 : 0)) * tau) / n,
        zig = j === 0 ? 2 * (i % 2) : j >= 2 && j < bases.length - 1 ? 1.8 * (i % 2) : 0,
        p = educationFacadePoint(r, a, bases[j] + zig),
        R = Math.hypot(p[0], p[2]);
      return [(p[0] * (R - inset)) / R, p[1], (p[2] * (R - inset)) / R];
    };
  for (let j = 0; j < bases.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        m = (a + b) / 2,
        N = [Math.cos(m), 0, Math.sin(m)],
        vent = detail === 1 ? j === 2 : detail > 1 && [2, 4, 6, 8].includes(j),
        role = vent ? 'vent' : (i + Math.floor(j / 2)) % 7 === 0 ? 'silverPale' : 'silver',
        ps = [
          point(i, j, vent ? 0.22 : 0),
          point(i + 1, j, vent ? 0.22 : 0),
          point(i + 1, j + 1, vent ? 0.22 : 0),
          point(i, j + 1, vent ? 0.22 : 0),
        ],
        back = ps.map((p) => {
          const R = Math.hypot(p[0], p[2]);
          return [(p[0] * (R - 0.28)) / R, p[1], (p[2] * (R - 0.28)) / R];
        });
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((k) => ps[k]),
          N,
        );
        f(
          role,
          ids.map((k) => back[k]),
          N.map((v) => -v),
        );
      }
      if (j === 0) f('silver', [ps[0], ps[1], back[1], back[0]], [0, -1, 0]);
      if (j === bases.length - 2) f('silver', [ps[2], ps[3], back[3], back[2]], [0, 1, 0]);
      if (vent) {
        const outerLo = [point(i, j), point(i + 1, j)],
          outerHi = [point(i, j + 1), point(i + 1, j + 1)];
        f('metal', [outerLo[0], outerLo[1], ps[1], ps[0]], [0, 1, 0]);
        f('metal', [ps[3], ps[2], outerHi[1], outerHi[0]], [0, -1, 0]);
      }
    }
  // Green/white tiers preserve the broad lower patterned band and two upper green bands.
  const rows = detail === 3 ? [22, 10, 24] : detail === 2 ? [6, 3, 6] : [1, 1, 1];
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
            : (i * 11 + row * 5 + ti * 7) % 9 < (ti === 0 ? 4 : 1)
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
      [0.36, 12, 15, 0.42],
      [0.59, 22, 25, 0.65],
    ]) {
      f('entry', [at(t, a, lo), at(t, b, lo), at(t, b, hi), at(t, a, hi)], N);
      f('wall', [at(t, a, hi), at(t, b, hi), at(next, b, hi), at(next, a, hi)], [0, 1, 0]);
    }
    f('wall', [at(0.98, a, 25), at(0.98, b, 25), at(0.98, b, 37), at(0.98, a, 37)], N);
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
          educationRoofPoint(r, a, t),
          educationRoofPoint(r, b, t),
          educationRoofPoint(r, b, u),
          educationRoofPoint(r, a, u),
        ],
        low = ps.map((p) => [p[0], p[1] - 0.32, p[2]]),
        pale = (i + 2 * j) % 11 < 2,
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
        low = (a, t, dy) => educationRoofPoint(r, a, t).map((v, k) => (k === 1 ? v - dy : v)),
        A = low(a, 1, 0.45),
        B = low(b, 1, 0.45),
        C = low(a, 1, 6.5),
        E = low(b, 1, 6.5);
      bar('metal', A, B, 0.3);
      bar('metal', C, E, 0.4);
      bar('metal', A, C, 0.26);
      bar('metal', A, E, 0.2);
      if (detail > 1) {
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
        bar('wall', body(a, 26, 0.905), low(a, 0, 0.45), 0.45);
        if (detail === 3)
          for (const t of [0.25, 0.5, 0.8]) bar('metal', low(a, t, 0.37), low(b, t, 0.37), 0.14);
        if (i % 6 === 0) {
          box(f, 'mark', C[0], C[1] - 0.7, C[2], 1.6, 0.55, 0.65);
          bar('metal', C, [C[0], C[1] - 0.5, C[2]], 0.15);
        }
      }
    }
  for (const sign of [-1, 1]) {
    const a = sign > 0 ? 0 : Math.PI,
      roof = educationRoofPoint(r, a, 1),
      x = roof[0] * 0.985;
    box(f, 'screen', x, roof[1] - 11, 0, 0.7, 4.5, 10);
    for (const z of [-3.5, 3.5]) {
      const p = educationRoofPoint(r, Math.atan2(z, x), 1);
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
