/** N0716: existing Mestalla, unequal steep terraces, western canopy and three glazed cores. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0716',
  tau = Math.PI * 2;
export function mestallaRadius(poly, a) {
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
  if (!hits.length) throw Error(`${candidateId}: missing own mapped bowl boundary`);
  return Math.min(...hits);
}
export const mestallaHeightScale = (a) => 1 - 0.32 * Math.max(0, (-Math.sin(a) - 0.35) / 0.65);
export function mestallaFoundationOutline(r, detail) {
  const n = [12, 24, 36, 64][detail];
  return Array.from({ length: n }, (_, i) => {
    const a = (i * tau) / n,
      R = mestallaRadius(r.outer, a) * 0.985;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export const mestallaRoofY = (_x, z) => 32 + ((-z - 35) / 42) * 2;
export function buildMestallaStadium(face, detail, r) {
  const F = r.floorY,
    n = [12, 24, 36, 64][detail],
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
      const R = mestallaRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = mestallaRadius(r.inner, a) * (1 - t) + mestallaRadius(r.outer, a) * 0.95 * t;
      return [R * Math.cos(a), y * mestallaHeightScale(a), R * Math.sin(a)];
    };
  prism(
    f,
    'wall',
    { outline: mestallaFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.45, -0.25),
    0.27,
  );
  prism(
    f,
    'turf',
    {
      outline: Array.from({ length: n }, (_, i) => {
        const a = (i * tau) / n,
          R = mestallaRadius(r.inner, a);
        return [R * Math.cos(a), R * Math.sin(a)];
      }),
    },
    0.27,
    0.3,
  );
  const rows = detail === 3 ? [16, 20, 18] : detail === 2 ? [5, 6, 6] : [1, 1, 1];
  for (const [ti, tier] of r.tiers.entries())
    for (let row = 0; row < rows[ti]; row++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          t0 = tier.t0 + ((tier.t1 - tier.t0) * row) / rows[ti],
          t1 = tier.t0 + ((tier.t1 - tier.t0) * (row + 1)) / rows[ti],
          y1 = tier.y0 + ((tier.y1 - tier.y0) * (row + 1)) / rows[ti],
          y0 = detail < 2 ? tier.y0 + ((tier.y1 - tier.y0) * row) / rows[ti] : y1,
          base =
            row === 0
              ? ti === 0
                ? 0.27
                : tier.y0 - 2
              : tier.y0 + ((tier.y1 - tier.y0) * row) / rows[ti] - 0.03,
          lo = [at(t0, a, y0), at(t0, b, y0)],
          hi = [at(t1, a, y1), at(t1, b, y1)],
          bottom = [at(t0, a, base), at(t0, b, base)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          role = ti === 1 && Math.sin(m) > 0.48 ? 'seatDark' : i % 9 === 2 ? 'seatPale' : 'seat',
          normal = [-Math.cos(m), 0, -Math.sin(m)];
        if (detail > 1 && i % 2 === 0) {
          const p = lo[0].map((v, k) => v + (lo[1][k] - v) * 0.12),
            q = hi[0].map((v, k) => v + (hi[1][k] - v) * 0.12),
            v = bottom[0].map((v, k) => v + (bottom[1][k] - v) * 0.12);
          f('aisle', [lo[0], p, q, hi[0]], [0, 1, 0]);
          f(role, [p, lo[1], hi[1], q], [0, 1, 0]);
          f('wall', [lo[0], p, v, bottom[0]], normal);
          f(role, [p, lo[1], bottom[1], v], normal);
        } else {
          f(role, ps, [0, 1, 0]);
          f(role, [lo[0], lo[1], bottom[1], bottom[0]], normal);
        }
        if (row === rows[ti] - 1)
          f(
            'wall',
            [hi[0], hi[1], at(t1, b, tier.y0 - 2), at(t1, a, tier.y0 - 2)],
            [Math.cos(m), 0, Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      H0 = 40 * mestallaHeightScale(a),
      H1 = 40 * mestallaHeightScale(b),
      H = (H0 + H1) / 2,
      no = [Math.cos(m), 0, Math.sin(m)],
      pa = body(a, 0, 0.985),
      pb = body(b, 0, 0.985),
      map = (u, y, d = 0) => [
        pa[0] + (pb[0] - pa[0]) * u + no[0] * d,
        y,
        pa[2] + (pb[2] - pa[2]) * u + no[2] * d,
      ],
      west = Math.sin(m) < -0.55,
      base = r.columnContacts[detail][i] - F;
    bar(
      west ? 'wall' : 'dark',
      body(a, base - 0.25, 0.985),
      body(a, H0, 0.985),
      detail ? 0.85 : 1.4,
    );
    if (!detail) {
      f(west ? 'wall' : 'dark', [map(0, 0.3), map(1, 0.3), map(1, H1 - 10), map(0, H0 - 10)], no);
      continue;
    }
    // Five quiet gallery belts; repeated recessed services do not copy the photo banners.
    for (const y of [5, 10, 15, 20, 25]) {
      if (y > H - 1) continue;
      const ps = [body(a, y, 0.88), body(b, y, 0.88), body(b, y, 1), body(a, y, 1)],
        low = ps.map(([x, y, z]) => [x, y - 0.35, z]);
      f('wall', ps, [0, 1, 0]);
      f('wall', low, [0, -1, 0]);
      f('wall', [ps[2], ps[3], low[3], low[2]], no);
      if (detail > 1) bar('metal', body(a, y + 0.8, 0.995), body(b, y + 0.8, 0.995), 0.1);
    }
    f(
      west ? 'wall' : 'dark',
      [map(0, 0.3, -1.2), map(1, 0.3, -1.2), map(1, H1 - 10, -1.2), map(0, H0 - 10, -1.2)],
      no,
    );
    if (west) {
      f(
        'grille',
        [
          map(0.04, 20, -0.35),
          map(0.96, 20, -0.35),
          map(0.96, H1 - 0.8, -0.35),
          map(0.04, H0 - 0.8, -0.35),
        ],
        no,
      );
      if (detail === 3) {
        const length = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]),
          columns = Math.max(3, Math.ceil(length / 1.1)),
          top = Math.min(H0, H1) - 0.8,
          rows = Math.max(3, Math.ceil((top - 20) / 1.1));
        for (let j = 0; j <= columns; j++) {
          const u = 0.04 + (0.92 * j) / columns;
          bar('wall', map(u, 20, -0.19), map(u, top, -0.19), 0.17, 0.2);
        }
        for (let j = 0; j <= rows; j++) {
          const y = 20 + ((top - 20) * j) / rows;
          bar('wall', map(0.04, y, -0.19), map(0.96, y, -0.19), 0.17, 0.2);
        }
      }
      for (const y of [6, 11, 16])
        f(
          'glass',
          [
            map(0.22, y, -1.17),
            map(0.78, y, -1.17),
            map(0.78, y + 1.8, -1.17),
            map(0.22, y + 1.8, -1.17),
          ],
          no,
        );
    } else {
      // Sloping exposed upper rakers connect the facade to the high uncovered terraces.
      bar('dark', body(a, H0 - 13, 0.985), at(0.98, a, 40), detail > 1 ? 0.7 : 1.1);
      if (i % 2 === 0)
        f(
          'panel',
          [
            map(0.17, 3, -1.17),
            map(0.83, 3, -1.17),
            map(0.83, H1 - 13, -1.17),
            map(0.17, H0 - 13, -1.17),
          ],
          no,
        );
    }
    if (i % 4 === 0)
      f(
        'entry',
        [map(0.2, 0.35, -1.15), map(0.8, 0.35, -1.15), map(0.8, 3.7, -1.15), map(0.2, 3.7, -1.15)],
        no,
      );
    for (const t of [0.255, 0.66]) {
      const y = t < 0.3 ? 9 : 25;
      f('dark', [at(t, a, y), at(t, b, y), at(t + 0.045, b, y), at(t + 0.045, a, y)], [0, 1, 0]);
      f(
        'dark',
        [
          at(t + 0.04, a, y - 1),
          at(t + 0.04, b, y - 1),
          at(t + 0.04, b, y + 3),
          at(t + 0.04, a, y + 3),
        ],
        no.map((v) => -v),
      );
    }
    if (detail > 1 && Math.sin(m) > -0.45 && i % 3 === 0) {
      const pa = at(0.98, a, 40),
        pb = at(0.98, b, 40),
        p = pa.map((v, k) => (v + pb[k]) / 2);
      bar('metal', [p[0], p[1] - 0.4, p[2]], [p[0], p[1] + 4, p[2]], 0.26);
      box(f, 'mark', p[0], p[1] + 3.3, p[2], 4.2, 1.7, 0.6);
    }
  }
  // The western roof follows its own eleven-vertex native polygon, not a generic annulus.
  const roof = r.roof,
    indices = earcut(roof.flat()),
    points = roof.map(([x, z]) => [x, mestallaRoofY(x, z), z]),
    low = points.map(([x, y, z]) => [x, y - 0.32, z]);
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3);
    f(
      'roof',
      ids.map((k) => points[k]),
      [0, 1, 0],
    );
    f(
      'under',
      ids.map((k) => low[k]),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < roof.length; i++) {
    const j = (i + 1) % roof.length,
      p = points[i],
      q = points[j],
      center = roof.reduce((s, p) => s.map((v, k) => v + p[k] / roof.length), [0, 0]);
    f(
      'under',
      [p, q, low[j], low[i]],
      [(p[0] + q[0]) / 2 - center[0], 0, (p[2] + q[2]) / 2 - center[1]],
    );
  }
  if (detail) {
    const count = [0, 6, 10, 16][detail],
      range = (x) => {
        const hits = [];
        for (let i = 0; i < roof.length; i++) {
          const p = roof[i],
            q = roof[(i + 1) % roof.length];
          if (
            Math.abs(q[0] - p[0]) > 1e-8 &&
            x >= Math.min(p[0], q[0]) &&
            x <= Math.max(p[0], q[0])
          )
            hits.push(p[1] + ((q[1] - p[1]) * (x - p[0])) / (q[0] - p[0]));
        }
        return [Math.min(...hits), Math.max(...hits)];
      };
    for (let i = 0; i < count; i++) {
      const x = -49 + (98 * i) / (count - 1),
        [back, front] = range(x),
        p = [x, mestallaRoofY(x, back) - 0.7, back],
        q = [x, mestallaRoofY(x, front) - 0.7, front];
      bar('under', p, q, 0.45, 0.8);
      bar('under', [x, 18, back], p, 0.55);
      if (detail > 1) {
        bar('under', [x, p[1] - 2.2, back], q, 0.3);
        bar('under', [x, p[1] - 2.2, back], p, 0.3);
        bar('mark', [x, q[1] - 0.9, front], [x, q[1] - 0.2, front], 0.16);
        box(f, 'mark', x, q[1] - 1, front, 1.3, 0.65, 0.5);
      }
    }
  }
  // Three mapped circulation-core positions: closed glazed shells and supported floor bands.
  for (const c of r.cores) {
    const N = [6, 8, 16, 24][detail],
      [cx, cz] = c.center,
      base = c.groundY - F,
      ring = (scale = 1) =>
        Array.from({ length: N }, (_, i) => {
          const a = (i * tau) / N;
          return [cx + c.rx * scale * Math.cos(a), cz + c.rz * scale * Math.sin(a)];
        }),
      outline = ring();
    prism(f, 'wall', { outline }, base - 0.35, base + 0.25);
    prism(f, detail ? 'glass' : 'dark', { outline }, base + 0.25, c.top);
    prism(f, 'wall', { outline }, c.top, c.top + 0.3);
    if (detail) {
      const levels = detail === 1 ? [10, 22, 34] : [5, 10, 15, 20, 25, 30, 35, 40];
      for (const y of levels) {
        if (y <= base + 0.3 || y >= c.top - 0.5) continue;
        prism(
          f,
          'coreBand',
          { outline: ring(1.008), holes: [ring(0.955).toReversed()] },
          y - 0.25,
          y + 0.1,
        );
      }
      if (detail > 1)
        for (let i = 0; i < N; i++) {
          const a = (i * tau) / N,
            x = cx + c.rx * Math.cos(a),
            z = cz + c.rz * Math.sin(a);
          bar('dark', [x, base + 0.25, z], [x, c.top, z], 0.2);
        }
    }
  }
  // The two neutral screens stay on supported high end terraces.
  for (const sign of [-1, 1]) {
    const x = sign * mestallaRadius(r.outer, sign > 0 ? 0 : Math.PI) * 0.9,
      p = [x, 38, 9];
    box(f, 'screen', p[0], p[1], p[2], 0.75, 5, 11);
    for (const z of [5, 13]) bar('dark', [x, 33, z], [x, 43, z], detail ? 0.3 : 0.7);
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
    for (const z of [-35, 35]) paint(0, z, 105, 0.14);
    for (const x of [-52.5, 0, 52.5]) paint(x, 0, 0.14, 70);
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
