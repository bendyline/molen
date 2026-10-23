/** N0714: mapped Stadium 974, modular containers and a complete open steel roof ring. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const candidateId = 'N0714';
export function stadium974Radius(poly, angle) {
  const d = [Math.cos(angle), Math.sin(angle)],
    hits = [],
    cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      v = poly[(i + 1) % poly.length].map((n, k) => n - a[k]),
      den = cross(d, v);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(a, v) / den,
      u = cross(a, d) / den;
    if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hits.push(t);
  }
  if (!hits.length) throw Error(`${candidateId}: no mapped radial boundary`);
  return Math.min(...hits);
}
export function stadium974FoundationOutline(r, detail) {
  const n = [12, 24, 32, 64][detail];
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      R = stadium974Radius(r.outer, a) * 0.985;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function stadium974RoofPoint(r, a, t) {
  const R = stadium974Radius(r.outer, a) * 0.995 * (1 - t) + stadium974Radius(r.inner, a) * t;
  return [R * Math.cos(a), 40 + t * 1.4, R * Math.sin(a)];
}
export function buildStadium974(face, detail, r) {
  const F = r.floorY,
    tau = Math.PI * 2,
    n = [12, 24, 32, 64][detail],
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, normal) => face(role, ps.map(P), D(normal)),
    adapter = {
      addQuad: (role, _ref, ps, no) => f(role, ps, no),
      addConvexPolygon: (role, _ref, ps, no) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], no);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    radial = (poly, a, y, scale = 1) => {
      const R = stadium974Radius(poly, a) * scale;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = stadium974Radius(r.inner, a) * (1 - t) + stadium974Radius(r.outer, a) * 0.81 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    };
  prism(
    f,
    'wall',
    { outline: stadium974FoundationOutline(r, detail) },
    r.minGround - F - 0.45,
    0.27,
  );
  prism(
    f,
    'turf',
    {
      outline: Array.from({ length: n }, (_, i) => {
        const p = radial(r.inner, (i * tau) / n, 0);
        return [p[0], p[2]];
      }),
    },
    0.27,
    0.3,
  );
  // The full seating bowl is retained at every level. Rows refine at street distance.
  const rows = detail === 3 ? [18, 22] : detail === 2 ? [6, 8] : [1, 1];
  for (const [ti, tier] of r.tiers.entries())
    for (let j = 0; j < rows[ti]; j++)
      for (let i = 0; i < n; i++) {
        const a = (i * tau) / n,
          b = ((i + 1) * tau) / n,
          m = (a + b) / 2,
          u0 = tier.t0 + ((tier.t1 - tier.t0) * j) / rows[ti],
          u1 = tier.t0 + ((tier.t1 - tier.t0) * (j + 1)) / rows[ti],
          y1 = tier.y0 + ((tier.y1 - tier.y0) * (j + 1)) / rows[ti],
          y0 = detail < 2 ? tier.y0 + ((tier.y1 - tier.y0) * j) / rows[ti] : y1,
          base =
            j === 0
              ? ti === 0
                ? 0.27
                : 12.8
              : tier.y0 + ((tier.y1 - tier.y0) * j) / rows[ti] - 0.03,
          lo = [at(u0, a, y0), at(u0, b, y0)],
          hi = [at(u1, a, y1), at(u1, b, y1)],
          ps = [lo[0], lo[1], hi[1], hi[0]],
          seat = i % 9 === 2 ? 'seatRed' : i % 5 < 2 ? 'seatPale' : 'seat';
        if (detail > 1 && i % 2 === 0) {
          const p = ps[0].map((v, k) => v + (ps[1][k] - v) * 0.1),
            q = ps[3].map((v, k) => v + (ps[2][k] - v) * 0.1);
          f('wall', [ps[0], p, q, ps[3]], [0, 1, 0]);
          f(seat, [p, ps[1], ps[2], q], [0, 1, 0]);
        } else f(seat, ps, [0, 1, 0]);
        f(
          'wall',
          [lo[0], lo[1], [lo[1][0], base, lo[1][2]], [lo[0][0], base, lo[0][2]]],
          [-Math.cos(m), 0, -Math.sin(m)],
        );
        if (j === rows[ti] - 1)
          f(
            'wall',
            [hi[0], hi[1], [hi[1][0], tier.y0 - 1, hi[1][2]], [hi[0][0], tier.y0 - 1, hi[0][2]]],
            [Math.cos(m), 0, Math.sin(m)],
          );
      }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      normal = [Math.cos(m), 0, Math.sin(m)],
      pa = radial(r.outer, a, 0, 0.967),
      pb = radial(r.outer, b, 0, 0.967),
      len = Math.hypot(pb[0] - pa[0], pb[2] - pa[2]),
      tangent = [(pb[0] - pa[0]) / len, 0, (pb[2] - pa[2]) / len],
      outward = [tangent[2], 0, -tangent[0]],
      mid = pa.map((v, k) => (v + pb[k]) / 2),
      point = (u, y, d = 0) => [
        mid[0] + tangent[0] * u + outward[0] * d,
        y,
        mid[2] + tangent[2] * u + outward[2] * d,
      ],
      block = (role, u, y, l, h, d, off = 0) => {
        const points = [
          point(u - l / 2, 0, off - d / 2),
          point(u + l / 2, 0, off - d / 2),
          point(u + l / 2, 0, off + d / 2),
          point(u - l / 2, 0, off + d / 2),
        ].map((p) => [p[0], p[2]]);
        prism(f, role, { outline: points }, y, y + h);
      };
    // Quiet orange intermediate circulation belt; open bays remain between containers.
    f(
      'wall',
      [at(0.43, a, 12.6), at(0.43, b, 12.6), at(0.51, b, 12.6), at(0.51, a, 12.6)],
      [0, 1, 0],
    );
    f(
      'orange',
      [at(0.49, a, 12.8), at(0.49, b, 12.8), at(0.49, b, 15.6), at(0.49, a, 15.6)],
      normal.map((v) => -v),
    );
    if (i % (detail === 0 ? 3 : n / 8) === 0) {
      block('dark', 0, 0.27, Math.min(7, len * 0.65), 31.2, 4.6);
      if (detail > 1)
        for (let j = 0; j < 5; j++) {
          const y = 1 + j * 5.5,
            start = point(-3, y, -5),
            end = point(3, y + 2.6, -5),
            start2 = point(3, y + 2.8, -7.2),
            end2 = point(-3, y + 5.4, -7.2);
          bar('wall', start, end, 2, 0.25);
          bar('wall', start2, end2, 2, 0.25);
          bar('metal', point(-3, y + 5.4, -7.2), point(3, y + 5.4, -7.2), 0.16, 0.16);
        }
    } else {
      const stacks = detail === 0 ? [5, 21] : [3, 8.5, 14, 19.5, 25];
      for (const [j, y] of stacks.entries()) {
        const role = ['red', 'blue', 'yellow', 'white', 'dark'][(i * 3 + j * 2) % 5],
          length = Math.min(detail === 0 ? len * 0.84 : 12, len * 0.9);
        block(role, 0, y, length, detail === 0 ? 5 : 2.6, 2.5);
        if (detail === 3) {
          for (const s of [-1, 1])
            bar(
              'metal',
              point(s * length * 0.48, y + 0.1, 1.28),
              point(s * length * 0.48, y + 2.5, 1.28),
              0.12,
            );
          bar('metal', point(0, y + 0.1, 1.28), point(0, y + 2.5, 1.28), 0.1);
        }
      }
    }
    // Five closed concourse decks connect the containers to the seating and frame.
    if (detail) {
      for (const y of [3, 8.5, 14, 19.5, 25]) {
        const deck = [
            radial(r.outer, a, y, 0.81),
            radial(r.outer, b, y, 0.81),
            radial(r.outer, b, y, 0.991),
            radial(r.outer, a, y, 0.991),
          ],
          low = deck.map(([x, y, z]) => [x, y - 0.35, z]);
        f('wall', deck, [0, 1, 0]);
        f('wall', low, [0, -1, 0]);
        f('wall', [deck[2], deck[3], low[3], low[2]], normal);
        f(
          'wall',
          [deck[0], deck[1], low[1], low[0]],
          normal.map((v) => -v),
        );
      }
      if (detail > 1)
        bar(
          'metal',
          radial(r.outer, a, r.columnContacts[detail][i] - F, 0.967),
          radial(r.outer, a, 35, 0.967),
          0.35,
        );
    }
    // Slender inclined columns and closed footings support the open upper frame.
    const contact = r.columnContacts[detail][i] - F,
      foot = radial(r.outer, a, contact - 0.25, 0.97),
      head = radial(r.outer, a, 46, 0.995),
      bottom = radial(r.outer, a, 40, 0.995),
      inner = stadium974RoofPoint(r, a, 1),
      outer = stadium974RoofPoint(r, a, 0);
    bar('metal', foot, head, detail ? 0.42 : 1.05);
    bar('metal', head, radial(r.outer, b, 46, 0.995), detail ? 0.42 : 1.05);
    if (detail) bar('metal', outer, inner, 0.38, 0.65);
    if (detail > 1) {
      box(f, 'wall', foot[0], contact - 0.35, foot[2], 1.4, 0.6, 1.4);
      bar('metal', head, [inner[0], 43, inner[2]], 0.35);
      bar('metal', [inner[0], 43, inner[2]], inner, 0.32);
      bar('metal', bottom, radial(r.outer, b, 40, 0.995), 0.42);
      bar('metal', bottom, radial(r.outer, b, 46, 0.995), 0.3);
    }
    if (detail > 1) {
      for (const y of [7.5, 18.5, 30]) {
        bar('metal', radial(r.outer, a, y, 0.965), radial(r.outer, b, y, 0.965), 0.25);
        bar('metal', radial(r.outer, a, y, 0.965), radial(r.outer, b, y + 5, 0.965), 0.22);
      }
      for (const t of [0.33, 0.66]) {
        const p = stadium974RoofPoint(r, a, t).map((v, k) => (k === 1 ? v - 0.6 : v)),
          q = stadium974RoofPoint(r, b, t).map((v, k) => (k === 1 ? v - 0.6 : v));
        bar('metal', p, q, 0.22, 0.4);
      }
      if (i % 4 === 0) {
        const p = stadium974RoofPoint(r, m, 1);
        bar('metal', [p[0], p[1] - 0.3, p[2]], [p[0], p[1] - 2, p[2]], 0.14);
        box(f, 'mark', p[0], p[1] - 2, p[2], 2, 0.7, 1);
      }
    }
    // Explicit matching diagonals keep both skins closed even on nonplanar corners.
    const roof = [
        stadium974RoofPoint(r, a, 0),
        stadium974RoofPoint(r, b, 0),
        stadium974RoofPoint(r, b, 1),
        stadium974RoofPoint(r, a, 1),
      ],
      low = roof.map(([x, y, z]) => [x, y - 0.32, z]);
    for (const ids of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      f(
        'roof',
        ids.map((k) => roof[k]),
        [0, 1, 0],
      );
      f(
        'roof',
        ids.map((k) => low[k]),
        [0, -1, 0],
      );
    }
    f('roof', [roof[0], roof[1], low[1], low[0]], normal);
    f(
      'roof',
      [roof[2], roof[3], low[3], low[2]],
      normal.map((v) => -v),
    );
  }
  // End displays hang from the actual inner roof edge; no unconnected floating signs.
  for (const sign of [-1, 1]) {
    const x = sign * stadium974Radius(r.inner, sign > 0 ? 0 : Math.PI),
      y = 34;
    box(f, 'screen', x, y, 0, 0.7, 4.5, 12);
    for (const z of [-4, 4]) bar('metal', [x, 38, z], [x, 41.2, z], detail ? 0.2 : 0.7);
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
