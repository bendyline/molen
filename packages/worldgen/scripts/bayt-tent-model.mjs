/** al_bayt_stadium: Al Bayt's peaked tent, striped fabric enclosure and red-lined bowl. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'al_bayt_stadium',
  tau = Math.PI * 2;
export const baytSegments = [8, 20, 36, 84];
export function baytAngles(r, detail) {
  const n = baytSegments[detail],
    z = Math.max(...r.outer.map((p) => Math.abs(p[1])));
  return [
    ...new Set([
      ...Array.from({ length: n }, (_, i) => (i * tau) / n),
      ...[-1, 1].flatMap((sign) => [-22, 22].map((x) => (Math.atan2(sign * z, x) + tau) % tau)),
    ]),
  ].sort((a, b) => a - b);
}
export function baytRadius(poly, a) {
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
export function baytFoundationOutline(r, detail) {
  return baytAngles(r, detail).map((a) => {
    const R = baytRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function baytRoofPoint(r, a, t) {
  const outer = baytRadius(r.outer, a) * 0.98,
    inner = baytRadius(r.aperture, a),
    R = outer * (1 - t) + inner * t,
    halfX = Math.max(...r.outer.map((p) => Math.abs(p[0]))),
    x = outer * Math.cos(a),
    wave = (1 - Math.cos((tau * x) / (halfX * 0.5))) * 0.5,
    side = Math.min(1, Math.abs(Math.sin(a)) * 2),
    ridge = 51 + 16 * wave * side,
    y =
      t <= 0.42
        ? 31 +
          Math.sin(4 * a) * 0.55 +
          (ridge - 31 - Math.sin(4 * a) * 0.55) * Math.sin((t / 0.42) * Math.PI * 0.5)
        : ridge + ((45 - ridge) * (t - 0.42)) / 0.58;
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function baytFacadePoint(r, a, y, scale = 0.98) {
  const R = baytRadius(r.outer, a) * scale;
  return [R * Math.cos(a), y + Math.sin(4 * a) * 0.55, R * Math.sin(a)];
}
export function buildBaytStadium(face, detail, r) {
  const angles = baytAngles(r, detail),
    n = angles.length,
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
      const R = baytRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        baytRadius(r.bowlInner, a) * (detail === 0 ? 1.18 : 1) * (1 - t) +
        baytRadius(r.outer, a) * 0.8 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    lower = Math.min(r.minGround - F - 0.5, -0.4);
  prism(f, 'wall', { outline: baytFoundationOutline(r, detail) }, lower, 0.27);
  box(f, 'turf', 0, 0.27, 0, 114, 0.03, 78);
  // Recessed closed service frontage and local supports below the suspended tent hem.
  for (let i = 0; i < n; i++) {
    const a = angles[i],
      b = angles[i + 1] ?? tau,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      contact = r.columnContacts[detail][i] - F;
    f('service', [body(a, lower, 0.9), body(b, lower, 0.9), body(b, 29, 0.9), body(a, 29, 0.9)], N);
    bar('wall', body(a, contact - 0.3, 0.94), body(a, 19, 0.94), detail ? 0.7 : 1.2);
    if (detail) {
      for (const y of [7, 15, 23]) {
        const ps = [body(a, y, 0.87), body(b, y, 0.87), body(b, y, 0.97), body(a, y, 0.97)];
        f('wall', ps, [0, 1, 0]);
        f(
          'wall',
          ps.map((p) => [p[0], p[1] - 0.45, p[2]]),
          [0, -1, 0],
        );
        f(
          'wall',
          [body(a, y, 0.97), body(b, y, 0.97), body(b, y - 0.45, 0.97), body(a, y - 0.45, 0.97)],
          N,
        );
      }
      f(
        'glass',
        [
          body(a, contact + 0.3, 0.905),
          body(b, r.columnContacts[detail][(i + 1) % n] - F + 0.3, 0.905),
          body(b, 13.5, 0.905),
          body(a, 13.5, 0.905),
        ],
        N,
      );
    }
  }
  // Fabric is horizontal and striped, with the two long-side arched entrances left open.
  const bands =
    detail === 0
      ? [7, 9, 10, 28.8, 31]
      : detail === 1
        ? [7, 11, 13, 19, 21, 28.8, 31]
        : [7, 8.5, 9.3, 12.2, 13, 15.2, 16.1, 18.4, 19.1, 22.1, 23.4, 28.8, 31];
  for (let i = 0; i < n; i++) {
    const a = angles[i],
      b = angles[i + 1] ?? tau,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      p = body(m, 0, 0.98),
      portal = Math.abs(p[0]) < 22 && Math.abs(Math.sin(m)) > 0.6;
    if (portal) continue;
    for (let j = 0; j < bands.length - 1; j++) {
      const role = j % 2 ? 'stripe' : 'tent',
        ps = [
          baytFacadePoint(r, a, bands[j]),
          baytFacadePoint(r, b, bands[j]),
          baytFacadePoint(r, b, bands[j + 1]),
          baytFacadePoint(r, a, bands[j + 1]),
        ],
        back = ps.map((p) => {
          const R = Math.hypot(p[0], p[2]);
          return [(p[0] * (R - 0.25)) / R, p[1], (p[2] * (R - 0.25)) / R];
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
      if (j === 0) f('tent', [ps[0], ps[1], back[1], back[0]], [0, -1, 0]);
      if (j === bands.length - 2) f('stripe', [ps[2], ps[3], back[3], back[2]], [0, 1, 0]);
    }
    if (detail) {
      const low = body(a, r.columnContacts[detail][i] - F, 0.94),
        hi = body(a, 9, 0.98);
      bar('wall', low, hi, 0.7);
    }
  }
  for (const sign of [-1, 1]) {
    const z =
        sign *
        (Math.max(
          ...r.outer
            .filter((p) => Math.abs(p[0]) < 25 && p[1] * sign > 0)
            .map((p) => Math.abs(p[1])),
        ) *
          0.98 +
          0.25),
      N = [0, 0, sign],
      radius = 14,
      cy = 8,
      segments = detail ? 16 : 6,
      arcp = Array.from({ length: segments + 1 }, (_, i) => {
        const a = (i * Math.PI) / segments;
        return [-radius * Math.cos(a), cy + radius * Math.sin(a), z];
      }),
      emit = (role, ps, no) => f(role, ps, no),
      back = (p) => [p[0], p[1], p[2] - sign * 1.2];
    // Closed red jambs and curved lintel surround a real recessed arch, not a black decal.
    for (const sx of [-1, 1]) box(emit, 'portal', sx * 18, 7, z - sign * 0.6, 8, 24.8, 1.2);
    for (let i = 0; i < segments; i++) {
      const p = arcp[i],
        q = arcp[i + 1],
        ps = [p, q, [q[0], 31.8, q[2]], [p[0], 31.8, p[2]]];
      f('portal', ps, N);
      f(
        'portal',
        ps.map(back),
        N.map((v) => -v),
      );
      f('portal', [p, q, back(q), back(p)], [0, -1, 0]);
    }
    // Curved opaque glazing closes the service volume behind the covered public opening.
    const glass = arcp.map((p) => [p[0], p[1], p[2] - sign * 2.2]);
    for (let i = 1; i < glass.length - 1; i++) f('glass', [glass[0], glass[i], glass[i + 1]], N);
    f(
      'glass',
      [
        [-14, 7, z - sign * 2.2],
        [14, 7, z - sign * 2.2],
        [14, 8, z - sign * 2.2],
        [-14, 8, z - sign * 2.2],
      ],
      N,
    );
    box(emit, 'wall', 0, 6.55, z - sign * 2.2, 44, 0.45, 6);
    for (const x of [-18, 18])
      bar('wall', [x, Math.min(0, r.minGround - F) - 0.3, z - sign * 2], [x, 7, z - sign * 2], 1);
  }
  // Three burgundy/cream bowl tiers, two dark closed hospitality belts and actual near treads.
  const rows = detail === 3 ? [22, 10, 24] : detail === 2 ? [6, 3, 6] : [1, 1, 1];
  for (const [ti, t] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = angles[i],
          b = angles[i + 1] ?? tau,
          m = (a + b) / 2,
          t0 = t.t0 + ((t.t1 - t.t0) * row) / rows[ti],
          t1 = t.t0 + ((t.t1 - t.t0) * (row + 1)) / rows[ti],
          y0 = t.y0 + ((t.y1 - t.y0) * row) / rows[ti],
          y1 = t.y0 + ((t.y1 - t.y0) * (row + 1)) / rows[ti],
          aisle = detail > 1 && i % (detail === 3 ? 12 : 6) === 0,
          role = aisle ? 'wall' : (i * 11 + row * 5 + ti * 7) % 9 < 2 ? 'seatPale' : 'seat';
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
    const a = angles[i],
      b = angles[i + 1] ?? tau,
      m = (a + b) / 2,
      N = [-Math.cos(m), 0, -Math.sin(m)];
    f('seat', [at(0, a, 0.3), at(0, b, 0.3), at(0, b, 1.4), at(0, a, 1.4)], N);
    for (const [t, lo, hi, next] of [
      [0.39, 16, 19, 0.45],
      [0.61, 24, 27, 0.67],
    ]) {
      f('entry', [at(t, a, lo), at(t, b, lo), at(t, b, hi), at(t, a, hi)], N);
      f('wall', [at(t, a, hi), at(t, b, hi), at(next, b, hi), at(next, a, hi)], [0, 1, 0]);
    }
    f('wall', [at(0.98, a, 27), at(0.98, b, 27), at(0.98, b, 44), at(0.98, a, 44)], N);
  }
  // Peaked cream tent canopy; shared canvas and broad red/dark/cream lining strips retain the woven character.
  const rings =
    detail === 0
      ? [0, 0.42, 1]
      : detail === 1
        ? [0, 0.42, 1]
        : detail === 2
          ? [0, 0.42, 0.8, 1]
          : [0, 0.15, 0.3, 0.42, 0.6, 0.8, 1];
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rings.length - 1; j++) {
      const a = angles[i],
        b = angles[i + 1] ?? tau,
        t = rings[j],
        u = rings[j + 1],
        ps = [
          baytRoofPoint(r, a, t),
          baytRoofPoint(r, b, t),
          baytRoofPoint(r, b, u),
          baytRoofPoint(r, a, u),
        ],
        low = ps.map((p) => [p[0], p[1] - 0.38, p[2]]),
        pale = (i + 2 * j) % 11 < 2,
        role = pale ? 'roofPale' : 'roof',
        lining =
          detail > 1
            ? i % 8 === 0
              ? 'liningDark'
              : i % 8 === 1
                ? 'liningPale'
                : 'liningRed'
            : 'liningRed';
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
          lining,
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
      const a = angles[i],
        b = angles[i + 1] ?? tau,
        low = (a, t, dy) => baytRoofPoint(r, a, t).map((v, k) => (k === 1 ? v - dy : v)),
        A = low(a, 1, 0.5),
        B = low(b, 1, 0.5),
        C = low(a, 1, 5.5),
        E = low(b, 1, 5.5);
      bar('metal', A, B, 0.3);
      bar('metal', C, E, 0.4);
      bar('metal', A, C, 0.26);
      if (detail > 1) bar('metal', A, E, 0.2);
      if (detail > 1) {
        const ts = [0.03, 0.42, 0.8, 1];
        for (let j = 0; j < ts.length - 1; j++) {
          const p = low(a, ts[j], 0.46),
            q = low(a, ts[j + 1], 0.46),
            lo = p.map((v, k) => (k === 1 ? v - 1.6 : v)),
            hi = q.map((v, k) => (k === 1 ? v - 1.6 : v));
          bar('metal', p, q, 0.26);
          bar('metal', lo, hi, 0.26);
          bar('metal', lo, q, 0.17);
        }
        bar('wall', body(a, 23, 0.94), low(a, 0.04, 0.5), 0.45);
        if (detail === 3)
          for (const t of [0.3, 0.6, 0.8]) bar('metal', low(a, t, 0.43), low(b, t, 0.43), 0.14);
        if (i % 6 === 0) {
          box(f, 'mark', C[0], C[1] - 0.7, C[2], 1.6, 0.55, 0.65);
          bar('metal', C, [C[0], C[1] - 0.5, C[2]], 0.15);
        }
      }
    }
  if (detail)
    for (const sign of [-1, 1]) {
      const rx = baytRadius(r.aperture, 0),
        rz = baytRadius(r.aperture, Math.PI / 2),
        steps = detail === 3 ? 20 : detail === 2 ? 10 : 4;
      for (let j = 0; j < steps; j++) {
        const z = -rz + (2 * rz * j) / steps,
          w = -rz + (2 * rz * (j + 1)) / steps,
          y = (z) => 45.1 + 4.7 * Math.cos(((z / rz) * Math.PI) / 2),
          a = [sign * (rx + 0.2), y(z), z],
          b = [sign * (rx + 12), y(z), z],
          c = [sign * (rx + 12), y(w), w],
          d = [sign * (rx + 0.2), y(w), w];
        f('roofPale', [a, b, c, d], [0, 1, 0]);
        f('metal', [[a[0], 45, z], [a[0], 45, w], d, a], [-sign, 0, 0]);
        f('metal', [b, c, [b[0], 45, w], [b[0], 45, z]], [sign, 0, 0]);
        if (detail > 1) bar('metal', a, b, 0.12);
        if (j === 0) f('metal', [a, b, [b[0], 45, z], [a[0], 45, z]], [0, 0, -1]);
        if (j === steps - 1) f('metal', [d, c, [c[0], 45, w], [d[0], 45, w]], [0, 0, 1]);
      }
    }
  for (const sign of [-1, 1]) {
    const a = sign > 0 ? 0 : Math.PI,
      roof = baytRoofPoint(r, a, 1),
      x = roof[0] * 0.985;
    box(f, 'screen', x, roof[1] - 11, 0, 0.7, 4.5, 10);
    for (const z of [-3.5, 3.5]) {
      const p = baytRoofPoint(r, Math.atan2(z, x), 1);
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
