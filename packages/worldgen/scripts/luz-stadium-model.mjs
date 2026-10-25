/** estadio_da_luz: Estádio da Luz's four red arches, wave roof and three-tier red bowl. */
import { beam, cross } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'estadio_da_luz',
  tau = Math.PI * 2,
  corner = Math.atan2(64, 94);
export const luzSegments = [12, 16, 40, 96];
export const luzCorners = [corner, Math.PI - corner, Math.PI + corner, tau - corner];
export function luzAngle(i, n) {
  const section = Math.floor(i / (n / 4)),
    u = (i - (section * n) / 4) / (n / 4),
    a = luzCorners[section % 4] + Math.floor(section / 4) * tau,
    b =
      section % 4 === 3
        ? luzCorners[0] + tau + Math.floor(section / 4) * tau
        : luzCorners[(section + 1) % 4] + Math.floor(section / 4) * tau;
  return a + (b - a) * u;
}
export function luzWave(a) {
  const angle = ((((a - corner) % tau) + tau) % tau) + corner;
  for (let i = 0; i < 4; i++) {
    const lo = luzCorners[i],
      hi = i === 3 ? luzCorners[0] + tau : luzCorners[i + 1];
    if (angle >= lo - 1e-8 && angle <= hi + 1e-8)
      return Math.max(0, Math.sin((Math.PI * (angle - lo)) / (hi - lo)));
  }
  throw Error(`${candidateId}: no roof quadrant`);
}
export function luzRadius(poly, a) {
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
  if (!hits.length) throw Error(`${candidateId}: missing own native boundary`);
  return Math.min(...hits);
}
export function luzFoundationOutline(r, detail) {
  return Array.from({ length: luzSegments[detail] }, (_, i) => {
    const a = luzAngle(i, luzSegments[detail]),
      R = luzRadius(r.outer, a) * 0.998;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function luzRoofPoint(r, a, t) {
  const outer = luzRadius(r.outer, a),
    inner = [-0.006, 0, 0.006].reduce((s, v) => s + luzRadius(r.roofInner, a + v), 0) / 3,
    R = outer * (1 - t) + inner * t;
  return [R * Math.cos(a), 27.5 + 6 * luzWave(a) - 1.4 * t, R * Math.sin(a)];
}
export const luzTierY = (tier, y, a) => (tier === 2 ? 20 + (y - 20) * (0.3 + 0.7 * luzWave(a)) : y);

export function buildLuzStadium(face, detail, r) {
  const n = luzSegments[detail],
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
      const R = luzRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y, ti = 0) => {
      const R = luzRadius(r.inner, a) * (1 - t) + luzRadius(r.outer, a) * 0.94 * t;
      return [R * Math.cos(a), luzTierY(ti, y, a), R * Math.sin(a)];
    },
    lower = Math.min(-0.4, r.minGround - F - 0.5);
  const pipe = (role, A, B, radius, sides) => {
    const length = Math.hypot(...B.map((v, k) => v - A[k])),
      axis = B.map((v, k) => (v - A[k]) / length),
      seed = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
      raw = cross(axis, seed),
      L = Math.hypot(...raw),
      u = raw.map((v) => v / L),
      v = cross(axis, u),
      circle = (c, i) =>
        c.map(
          (x, k) =>
            x + radius * (u[k] * Math.cos((i * tau) / sides) + v[k] * Math.sin((i * tau) / sides)),
        );
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides,
        no = u.map(
          (x, k) =>
            x * Math.cos(((i + 0.5) * tau) / sides) + v[k] * Math.sin(((i + 0.5) * tau) / sides),
        );
      f(role, [circle(A, i), circle(A, j), circle(B, j), circle(B, i)], no);
    }
    f(
      role,
      Array.from({ length: sides }, (_, i) => circle(A, i)),
      axis.map((v) => -v),
    );
    f(
      role,
      Array.from({ length: sides }, (_, i) => circle(B, i)),
      axis,
    );
  };
  prism(f, 'wall', { outline: luzFoundationOutline(r, detail) }, lower, 0.27);
  box(f, 'turf', 0, 0.27, 0, 114, 0.03, 78);
  // Continuous lower concrete service/concourse structure with red exposed upper rakers.
  for (let i = 0; i < n; i++) {
    const a = luzAngle(i, n),
      b = luzAngle(i + 1, n),
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      top = (q) => 26 + 4 * luzWave(q);
    f(
      'wall',
      [body(a, lower, 0.975), body(b, lower, 0.975), body(b, 11.7, 0.975), body(a, 11.7, 0.975)],
      N,
    );
    if (detail) {
      for (const y of [4.5, 9.5])
        f(
          'glass',
          [body(a, y, 0.977), body(b, y, 0.977), body(b, y + 2.5, 0.977), body(a, y + 2.5, 0.977)],
          N,
        );
      for (const y of [3, 7, 11.7]) {
        const ps = [body(a, y, 0.93), body(b, y, 0.93), body(b, y, 0.998), body(a, y, 0.998)];
        f('wall', ps, [0, 1, 0]);
        f(
          'wall',
          ps.map((p) => [p[0], p[1] - 0.45, p[2]]),
          [0, -1, 0],
        );
        f(
          'wall',
          [
            body(a, y, 0.998),
            body(b, y, 0.998),
            body(b, y - 0.45, 0.998),
            body(a, y - 0.45, 0.998),
          ],
          N,
        );
      }
      f(
        'louver',
        [
          body(a, 12, 0.94),
          body(b, 12, 0.94),
          body(b, top(b) - 0.3, 0.94),
          body(a, top(a) - 0.3, 0.94),
        ],
        N,
      );
      bar('red', body(a, 12, 0.94), body(a, top(a), 0.99), 0.38);
      bar(
        'red',
        body(a, Math.max(r.columnContacts[detail][i] - F - 0.3, lower), 0.99),
        body(a, 27.5 + 6 * luzWave(a) - 0.2, 0.99),
        0.38,
      );
      const ps = [
        body(a, top(a), 0.937),
        body(b, top(b), 0.937),
        body(b, top(b), 0.997),
        body(a, top(a), 0.997),
      ];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          'wall',
          ids.map((k) => ps[k]),
          [0, 1, 0],
        );
        f(
          'wall',
          ids.map((k) => [ps[k][0], ps[k][1] - 0.4, ps[k][2]]),
          [0, -1, 0],
        );
      }
      f(
        'pale',
        [
          body(a, top(a), 0.998),
          body(b, top(b), 0.998),
          body(b, top(b) + 0.8, 0.998),
          body(a, top(a) + 0.8, 0.998),
        ],
        N,
      );
      if (detail > 1 && i % 4 === 0) {
        const p = body(m, 0, 0.982);
        box(f, 'entry', p[0], Math.max(0, r.columnContacts[detail][i] - F), p[2], 4.5, 4, 4);
      }
    } else {
      f(
        'louver',
        [body(a, 11.7, 0.97), body(b, 11.7, 0.97), body(b, top(b), 0.97), body(a, top(a), 0.97)],
        N,
      );
    }
  }
  // Three red seating bands. The upper stand follows the four low roof corners.
  const rows = detail === 3 ? [22, 10, 24] : detail === 2 ? [6, 3, 6] : [1, 1, 1];
  for (const [ti, t] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = luzAngle(i, n),
          b = luzAngle(i + 1, n),
          m = (a + b) / 2,
          t0 = t.t0 + ((t.t1 - t.t0) * row) / rows[ti],
          t1 = t.t0 + ((t.t1 - t.t0) * (row + 1)) / rows[ti],
          y0 = t.y0 + ((t.y1 - t.y0) * row) / rows[ti],
          y1 = t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
          aisle = detail > 1 && i % (detail === 3 ? 12 : 6) === 0,
          role = aisle ? 'wall' : (row + i) % 9 === 0 ? 'seatWarm' : 'seat';
        f(
          role,
          [
            at(t0, a, detail < 2 ? y0 : y1, ti),
            at(t0, b, detail < 2 ? y0 : y1, ti),
            at(t1, b, y1, ti),
            at(t1, a, y1, ti),
          ],
          [0, 1, 0],
        );
        if (detail > 1)
          f(
            role,
            [at(t0, a, y0, ti), at(t0, b, y0, ti), at(t0, b, y1, ti), at(t0, a, y1, ti)],
            [-Math.cos(m), 0, -Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = luzAngle(i, n),
      b = luzAngle(i + 1, n),
      m = (a + b) / 2,
      N = [-Math.cos(m), 0, -Math.sin(m)];
    f('red', [at(0, a, 0.3), at(0, b, 0.3), at(0, b, 1.4), at(0, a, 1.4)], N);
    for (const [t, hi, lo, next] of [
      [0.36, 13, 10, 0.42],
      [0.58, 20, 17.5, 0.64],
    ]) {
      f('entry', [at(t, a, lo), at(t, b, lo), at(t, b, hi), at(t, a, hi)], N);
      f('wall', [at(t, a, hi), at(t, b, hi), at(next, b, hi), at(next, a, hi)], [0, 1, 0]);
      if (detail) bar('pale', at(t, a, hi + 0.15), at(t, b, hi + 0.15), 0.2, 0.4);
    }
    f('wall', [at(0.98, a, 20, 2), at(0.98, b, 20, 2), at(0.98, b, 29, 2), at(0.98, a, 29, 2)], N);
  }
  // Roof uses the mapped four-sided aperture, not a circular generic canopy.
  const rings = [1, 2, 3, 6][detail];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rings; j++) {
      const a = luzAngle(i, n),
        b = luzAngle(i + 1, n),
        t = j / rings,
        u = (j + 1) / rings,
        ps = [
          luzRoofPoint(r, a, t),
          luzRoofPoint(r, b, t),
          luzRoofPoint(r, b, u),
          luzRoofPoint(r, a, u),
        ],
        low = ps.map((p) => [p[0], p[1] - 0.32, p[2]]),
        role = j === rings - 1 ? 'roofPale' : 'roof';
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
      if (j === 0)
        f('red', [ps[0], ps[1], low[1], low[0]], [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)]);
      if (j === rings - 1)
        f(
          'pale',
          [ps[2], ps[3], low[3], low[2]],
          [-Math.cos((a + b) / 2), 0, -Math.sin((a + b) / 2)],
        );
    }
  // Four red tubular arches meet concrete corner cores and the lower roof chord.
  const arches = [4, 8, 14, 24][detail],
    sides = [4, 4, 8, 12][detail];
  for (let q = 0; q < 4; q++)
    for (let j = 0; j < arches; j++) {
      const a = luzAngle((q * n) / 4 + (j * n) / (4 * arches), n),
        b = luzAngle((q * n) / 4 + ((j + 1) * n) / (4 * arches), n),
        point = (a, top) => body(a, 27.5 + (top ? 15.5 : 6) * luzWave(a), 0.995),
        A = point(a, true),
        B = point(b, true),
        lowA = point(a, false),
        lowB = point(b, false);
      pipe('red', A, B, detail ? 0.62 : 0.9, sides);
      if (detail) {
        bar('red', lowA, lowB, 0.35);
        if (detail > 1) {
          bar('red', A, lowA, 0.18);
          bar('red', j % 2 ? A : lowA, j % 2 ? lowB : B, 0.15);
        }
      }
    }
  for (const c of r.cores) {
    const count = [4, 6, 8, 12][detail],
      poly = Array.from({ length: count }, (_, i) => [
        c.center[0] + 3.4 * Math.cos((i * tau) / count),
        c.center[1] + 3.4 * Math.sin((i * tau) / count),
      ]);
    prism(f, 'wall', { outline: poly }, c.groundY - F - 0.35, 27.25);
    if (detail)
      for (const y of [7, 14, 21, 27])
        prism(
          f,
          'pale',
          { outline: poly.map((p) => p.map((v, k) => c.center[k] + (v - c.center[k]) * 1.025)) },
          y - 0.15,
          y + 0.15,
        );
  }
  if (detail)
    for (let i = 0; i < n; i++) {
      const a = luzAngle(i, n),
        b = luzAngle(i + 1, n),
        roof = (t) => luzRoofPoint(r, a, t).map((v, k) => (k === 1 ? v - 0.65 : v)),
        points = [0, 0.5, 1].map(roof);
      for (let j = 0; j < 2; j++) {
        bar('metal', points[j], points[j + 1], 0.28);
        if (detail > 1) {
          const lo = points[j].map((v, k) => (k === 1 ? v - 1.5 : v)),
            hi = points[j + 1].map((v, k) => (k === 1 ? v - 1.5 : v));
          bar('red', lo, hi, 0.24);
          bar('red', lo, points[j + 1], 0.16);
        }
      }
      if (detail === 3)
        for (const t of [0.25, 0.5, 0.75])
          bar(
            'metal',
            roof(t),
            luzRoofPoint(r, b, t).map((v, k) => (k === 1 ? v - 0.65 : v)),
            0.15,
          );
      const p = roof(1),
        q = luzRoofPoint(r, b, 1).map((v, k) => (k === 1 ? v - 0.65 : v));
      bar('red', p, q, 0.34);
      if (detail > 1 && i % 6 === 0) {
        box(f, 'mark', p[0], p[1] - 1.2, p[2], 1.6, 0.55, 0.65);
        bar('metal', p, [p[0], p[1] - 1, p[2]], 0.15);
      }
    }
  for (const sign of [-1, 1]) {
    const a = sign > 0 ? 0 : Math.PI,
      roof = luzRoofPoint(r, a, 1),
      x = roof[0] * 0.98;
    box(f, 'screen', x, roof[1] - 6.5, 0, 0.8, 4, 9);
    for (const z of [-3, 3]) {
      const p = luzRoofPoint(r, Math.atan2(z, x), 1);
      bar('red', [x, roof[1] - 2.8, z], [p[0], p[1] - 0.28, p[2]], detail ? 0.22 : 0.7);
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
