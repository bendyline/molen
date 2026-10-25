/** 'arena_amazonia': the mapped Arena Amazônia, with continuous diagonal basket shell. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export const amazoniaSegments = [12, 20, 32, 64];
const tau = Math.PI * 2;
export function amazoniaRadius(poly, a) {
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
  if (!hits.length) throw Error('arena_amazonia: missing native radial boundary');
  return Math.min(...hits);
}
export function amazoniaFoundationOutline(r, detail) {
  return Array.from({ length: amazoniaSegments[detail] }, (_, i) => {
    const a = (i * tau) / amazoniaSegments[detail],
      R = amazoniaRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
/** v0..2 facade; v2..4 canopy. The same surface carries both diagonal systems. */
export function amazoniaShellPoint(r, a, v) {
  const O = amazoniaRadius(r.outer, a),
    I = amazoniaRadius(r.inner, a),
    rings = [
      [0.96 * O, 0],
      [O, 16],
      [0.97 * O, 31],
      [(O * 0.97 + I) * 0.5, 34],
      [I, 34.5],
    ],
    j = Math.min(3, Math.max(0, Math.floor(v))),
    t = v - j,
    R = rings[j][0] * (1 - t) + rings[j + 1][0] * t,
    y = rings[j][1] * (1 - t) + rings[j + 1][1] * t;
  return [R * Math.cos(a), y, R * Math.sin(a)];
}
export function buildAmazoniaStadium(face, detail, r) {
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
    n = amazoniaSegments[detail],
    step = tau / n,
    radial = (poly, a, y, scale = 1) => {
      const R = amazoniaRadius(poly, a) * scale;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    body = (a, y, scale = 1) => radial(r.outer, a, y, scale),
    at = (t, a, y) => {
      const I = amazoniaRadius(r.bowlInner, a),
        O = amazoniaRadius(r.outer, a) * 0.9,
        R = I * (1 - t) + O * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    slab = (role, ps, thick = 0.3, closeSides = true) => {
      // A fixed diagonal prevents crossed top/underside planes on nonplanar roof cells.
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
      for (let i = 0; i < 4; i++) {
        if (!closeSides && (i === 1 || i === 3)) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    sheet = (params, role = 'roof') => {
      const center = params.reduce((s, p) => s.map((v, k) => v + p[k] / params.length), [0, 0]),
        normal =
          center[1] < 2
            ? [Math.cos(center[0]), 0.15, Math.sin(center[0])]
            : [0.2 * Math.cos(center[0]), 1, 0.2 * Math.sin(center[0])],
        points = params.map(([a, v]) => amazoniaShellPoint(r, a, v)),
        c = amazoniaShellPoint(r, ...center),
        back = (p) => [p[0] - normal[0] * 0.22, p[1] - normal[1] * 0.22, p[2] - normal[2] * 0.22];
      const skin = (surface, ps) => {
        f(surface, ps, normal);
        if (detail)
          f(
            surface,
            ps.map(back),
            normal.map((v) => -v),
          );
      };
      if (detail) {
        // Partition the shell into membrane and rounded-corner frame patches.
        // A single skin avoids intersecting overlays on the curved shoulder.
        const cuts = points.flatMap((p, i) =>
          [points[(i + 3) % 4], points[(i + 1) % 4]].map((q) =>
            p.map((v, k) => v * 0.85 + q[k] * 0.15),
          ),
        );
        for (let i = 0; i < cuts.length; i++)
          skin('roof', [c, cuts[i], cuts[(i + 1) % cuts.length]]);
        for (let i = 0; i < points.length; i++)
          skin('metal', [points[i], cuts[i * 2], cuts[i * 2 + 1]]);
      } else
        for (let i = 0; i < points.length; i++)
          skin(role, [c, points[i], points[(i + 1) % points.length]]);
      if (detail)
        for (let i = 0; i < points.length; i++) {
          const a = points[i],
            b = points[(i + 1) % points.length];
          f('metal', [a, back(a), back(b), b], [b[2] - a[2], 0, a[0] - b[0]]);
        }
    };
  prism(
    f,
    'wall',
    { outline: amazoniaFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.6, -0.5),
    0.27,
  );
  box(f, 'turf', 0, 0.27, 0, 112, 0.03, 74);
  // Diamonds meet across the rounded shoulder. The first row leaves actual triangular portals.
  for (let j = 1; j <= 3; j++)
    for (let i = 0; i < n; i++) {
      if ((i + j) % 2 !== 1) continue;
      const a = i * step,
        corners = [
          [a - step, j],
          [a, j - 1],
          [a + step, j],
          [a, j + 1],
        ];
      sheet(corners, 'roof');
      if (detail) {
        if (detail > 1)
          for (let k = 0; k < 4; k++) {
            const p = corners[k],
              q = corners[(k + 1) % 4],
              steps = detail === 3 ? 4 : 2;
            for (let s = 0; s < steps; s++) {
              const A = amazoniaShellPoint(
                  r,
                  p[0] + ((q[0] - p[0]) * s) / steps,
                  p[1] + ((q[1] - p[1]) * s) / steps,
                ),
                B = amazoniaShellPoint(
                  r,
                  p[0] + ((q[0] - p[0]) * (s + 1)) / steps,
                  p[1] + ((q[1] - p[1]) * (s + 1)) / steps,
                );
              // Visible deep crossing boxes below the membrane, joined at each shell node.
              bar('metal', [A[0], A[1] - 0.6, A[2]], [B[0], B[1] - 0.6, B[2]], 0.65, 1.2);
            }
          }
      }
    }
  // Close half diamonds at the smooth inner roof rim; the field aperture remains entirely open.
  for (let i = 1; i < n; i += 2)
    sheet([
      [(i - 1) * step, 4],
      [i * step, 3],
      [(i + 1) * step, 4],
      [i * step, 4],
    ]);
  for (let i = 0; i < n; i++) {
    const a = i * step,
      b = (i + 1) * step,
      m = (a + b) * 0.5,
      N = [Math.cos(m), 0, Math.sin(m)],
      A = amazoniaShellPoint(r, a, 4),
      B = amazoniaShellPoint(r, b, 4);
    bar(
      'metal',
      [A[0], A[1] - 0.65, A[2]],
      [B[0], B[1] - 0.65, B[2]],
      detail ? 0.65 : 1.0,
      detail ? 1.5 : 1.0,
    );
    if (detail) {
      f('glass', [body(a, 2, 0.87), body(b, 2, 0.87), body(b, 23, 0.87), body(a, 23, 0.87)], N);
      for (const y of detail > 1 ? [7, 14, 23] : [7, 23])
        slab(
          'wall',
          [
            body(a, y, y === 23 ? 0.92 : 0.76),
            body(b, y, y === 23 ? 0.92 : 0.76),
            body(b, y, 0.97),
            body(a, y, 0.97),
          ],
          0.45,
          false,
        );
      if (detail > 1 || i % 2 === 0) {
        const contact = r.columnContacts[detail][i] - F;
        bar('wall', body(a, contact - 0.3, 0.94), body(a, 29, 0.94), 0.8);
      }
    }
    const tiers = [
        { lo: 0, hi: 0.43, y0: 1.4, y1: 12 },
        { lo: 0.54, hi: 0.98, y0: 17, y1: 26 },
      ],
      rows = detail === 3 ? [22, 20] : detail === 2 ? [6, 6] : [1, 1];
    for (const [ti, t] of tiers.entries())
      for (let row = 0; row < rows[ti]; row++) {
        const u = row / rows[ti],
          v = (row + 1) / rows[ti],
          lo = t.lo + (t.hi - t.lo) * u,
          hi = t.lo + (t.hi - t.lo) * v,
          y = t.y0 + (t.y1 - t.y0) * v,
          role =
            detail > 1 && i % 6 === 0
              ? 'wall'
              : ti === 0
                ? i % 5 === 0
                  ? 'seatYellow'
                  : 'seatOrange'
                : 'seatYellow';
        slab(
          role,
          [
            at(lo, a, detail < 2 ? t.y0 : y),
            at(lo, b, detail < 2 ? t.y0 : y),
            at(hi, b, detail < 2 ? t.y1 : y),
            at(hi, a, detail < 2 ? t.y1 : y),
          ],
          detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.1 : 0.4,
          false,
        );
      }
    f(
      'glass',
      [at(0.43, a, 12), at(0.43, b, 12), at(0.43, b, 17), at(0.43, a, 17)],
      N.map((v) => -v),
    );
    slab('wall', [at(0.43, a, 17), at(0.43, b, 17), at(0.54, b, 17), at(0.54, a, 17)], 0.4, false);
  }
  if (detail) {
    for (const sign of [-1, 1]) {
      const a = sign > 0 ? 0 : Math.PI,
        p = amazoniaShellPoint(r, a, 4),
        x = p[0];
      box(f, 'display', x, 28, 0, 0.6, 4.5, 10);
      for (const z of [-3, 3]) bar('metal', [x, 33.85, z], [x, 28, z], 0.25);
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
