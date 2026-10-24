/** 'gillette_stadium': Gillette's open blue-red bowl,2023 north display/atrium, lighthouse and entry arch. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const gilletteSegments = [12, 24, 40, 72];
export function gilletteRadius(poly, a) {
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
  if (!hits.length) throw Error('gillette_stadium: missing own radial boundary');
  return Math.min(...hits);
}
export function gilletteFoundationOutline(r, d) {
  return Array.from({ length: gilletteSegments[d] }, (_, i) => {
    const a = (i * tau) / gilletteSegments[d],
      R = gilletteRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function gilletteNorthBack(z, y) {
  return -131 + 5 * (z / 80) ** 2 - 0.2 * (y - 12.5);
}
export function gilletteScreenX(z) {
  return -110 + 5 * (z / 56.388) ** 2;
}
export function buildGilletteStadium(face, detail, r) {
  const F = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, no) => face(role, ps.map(P), D(no)),
    n = gilletteSegments[detail],
    adapter = {
      addQuad: (role, _ref, ps, no) => f(role, ps, no),
      addConvexPolygon: (role, _ref, ps, no) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], no);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (a, y, s = 1) => {
      const R = gilletteRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    upper = (a, y, s = 1) => {
      const R = gilletteRadius(r.standOuter, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R =
        gilletteRadius(r.bowlInner, a) * (detail === 0 ? 1.1 : 1) * (1 - t) +
        gilletteRadius(r.standOuter, a) * 0.94 * t;
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
        if (detail)
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
    { outline: gilletteFoundationOutline(r, detail) },
    Math.min(r.minGround - F - 0.5, -0.4),
    0.27,
  );
  box(f, 'turf', 0, 0.27, 0, 115, 0.03, 65);
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      side = Math.abs(Math.sin(m)) > 0.42,
      northGate = Math.cos(m) < (detail === 0 ? -0.94 : -0.97),
      N = [Math.cos(m), 0, Math.sin(m)],
      contact = r.columnContacts[detail][i] - F,
      tiers = [
        ...(northGate ? [] : [{ t0: 0, t1: 0.28, y0: 1.4, y1: 16, role: 'seatBlue' }]),
        ...(side
          ? [
              { t0: 0.39, t1: 0.58, y0: 22, y1: 29, role: 'seatRed' },
              { t0: 0.69, t1: 0.98, y0: 34, y1: 48, role: 'seatBlue' },
            ]
          : []),
      ],
      rows = detail === 3 ? [28, 12, 28] : detail === 2 ? [6, 3, 6] : [1, 1, 1];
    for (const [ti, t] of tiers.entries())
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
          role = detail > 1 && i % 5 === 0 ? 'wall' : t.role;
        slab(role, ps, detail > 1 ? (t.y1 - t.y0) / rows[ti] + 0.1 : 0.4, true);
      }
    if (side)
      for (const [t0, t1, lo, hi] of [
        [0.28, 0.39, 16, 22],
        [0.58, 0.69, 29, 34],
      ]) {
        const ps = [at(t0, a, hi), at(t0, b, hi), at(t1, b, hi), at(t1, a, hi)];
        if (detail) slab('wall', ps, 0.45, false);
        else f('wall', ps, [0, 1, 0]);
        f(
          'glass',
          [at(t0, a, lo), at(t0, b, lo), at(t0, b, hi), at(t0, a, hi)],
          N.map((x) => -x),
        );
      }
    const outsideY = side ? 29 : 14;
    if (!northGate)
      f(
        'brick',
        [
          body(a, Math.min(contact - 0.3, -0.4), 0.86),
          body(b, Math.min(r.columnContacts[detail][(i + 1) % n] - F - 0.3, -0.4), 0.86),
          body(b, outsideY, 0.86),
          body(a, outsideY, 0.86),
        ],
        N,
      );
    if (detail) {
      bar(
        'wall',
        body(a, Math.min(contact - 0.3, -0.4), 0.965),
        upper(a, side ? 48 : 17, 0.965),
        0.95,
      );
      for (const y of side ? [8, 16, 24] : [8])
        slab(
          'wall',
          [body(a, y, 0.85), body(b, y, 0.85), body(b, y, 0.97), body(a, y, 0.97)],
          0.5,
          false,
        );
      if (i % 4 === 0) {
        const p = body(m, 0, 0.94);
        box(f, 'wall', p[0], -0.4, p[2], 7, side ? 28.4 : 14.4, 7);
      }
    }
    if (side) {
      const A = upper(a, 50, 0.96),
        B = upper(b, 50, 0.96);
      bar('metal', A, B, detail ? 0.55 : 1.1);
      if (detail) {
        bar('metal', body(a, 46, 0.965), A, 0.5);
        if (detail > 1) {
          bar('metal', [A[0], A[1] - 1.6, A[2]], [B[0], B[1] - 1.6, B[2]], 0.25);
          bar('metal', [A[0], A[1] - 1.6, A[2]], B, 0.18);
          const p = upper(m, 50.4, 0.96);
          box(f, 'mark', p[0], p[1], p[2], 2, 0.6, 1);
        }
      }
    }
  }
  //2023 G-P Atrium: curved leaning external glazing, connected floors and a closed roof.
  const panels = [4, 8, 16, 32][detail],
    width = 80;
  for (let i = 0; i < panels; i++) {
    const z = -width + (i * width * 2) / panels,
      w = -width + ((i + 1) * width * 2) / panels,
      back = (z, y) => [gilletteNorthBack(z, y), y, z],
      front = (z, y) => [gilletteScreenX(z), y, z];
    f('glass', [back(z, 12.5), back(w, 12.5), back(w, 35.5), back(z, 35.5)], [-1, 0, 0]);
    const passage = (z + w) / 2 > -45 && (z + w) / 2 < -2;
    if (!passage)
      f('service', [back(z, -0.4), back(w, -0.4), back(w, 12.5), back(z, 12.5)], [-1, 0, 0]);
    for (const y of detail ? [12.5, 23, 31, 35.5] : [35.5])
      slab('wall', [back(z, y), back(w, y), front(w, y), front(z, y)], 0.5, false);
    f(
      'service',
      [
        front(z, passage ? 12.5 : -0.4),
        front(w, passage ? 12.5 : -0.4),
        front(w, 23),
        front(z, 23),
      ],
      [1, 0, 0],
    );
    f(
      'glass',
      [
        [front(z, 23)[0] - 0.7, 23, z],
        [front(w, 23)[0] - 0.7, 23, w],
        [front(w, 35.5)[0] - 0.7, 35.5, w],
        [front(z, 35.5)[0] - 0.7, 35.5, z],
      ],
      [1, 0, 0],
    );
    if (detail) {
      if (detail > 1 || i % 2 === 0) bar('metal', back(z, 12.5), back(z, 35.5), 0.25);
      bar('wall', back(z, -0.4), back(z, 12.5), 0.8);
      if (detail > 1) for (const y of [20, 27.5]) bar('metal', back(z, y), back(w, y), 0.18);
    }
    if (i === 0 || i === panels - 1) {
      const t = i === 0 ? z : w;
      f(
        'wall',
        [back(t, -0.4), front(t, -0.4), front(t, 35.5), back(t, 35.5)],
        [0, 0, i === 0 ? -1 : 1],
      );
    }
  }
  // The nominal370ftx60ft curved north display is a neutral physical screen, not event art.
  const half = 56.388,
    bottom = 24,
    top = 42.288;
  for (let i = 0; i < panels; i++) {
    const z = -half + (i * half * 2) / panels,
      w = -half + ((i + 1) * half * 2) / panels,
      A = [gilletteScreenX(z) + 0.25, bottom, z],
      B = [gilletteScreenX(w) + 0.25, bottom, w],
      C = [B[0], top, w],
      E = [A[0], top, z];
    f('screen', [A, B, C, E], [1, 0, 0]);
    f('metal', [[A[0] - 0.7, bottom, z], [B[0] - 0.7, bottom, w], B, A], [0, -1, 0]);
    f(
      'metal',
      [
        [A[0] - 0.7, bottom, z],
        [B[0] - 0.7, bottom, w],
        [C[0] - 0.7, top, w],
        [E[0] - 0.7, top, z],
      ],
      [-1, 0, 0],
    );
    slab('metal', [[A[0] - 0.7, top, z], [B[0] - 0.7, top, w], C, E], 0.15, false);
    if (detail) {
      bar('metal', A, B, 0.2);
      bar('metal', E, C, 0.2);
      bar('wall', [A[0], -0.4, z], [A[0], bottom, z], 0.9);
    }
    if (i === 0 || i === panels - 1) {
      const p = i === 0 ? A : B;
      f(
        'metal',
        [
          [p[0] - 0.7, bottom, p[2]],
          [p[0], bottom, p[2]],
          [p[0], top, p[2]],
          [p[0] - 0.7, top, p[2]],
        ],
        [0, 0, i === 0 ? -1 : 1],
      );
    }
  }
  // New octagonal tower retains its own mapped footprint and north-end position.
  const L = r.lighthouse,
    [cx, cz] = L.center,
    G = L.groundY - F,
    deck = G + 66.4464,
    ring = (scale, y) =>
      L.outline.map(([x, z]) => [cx + (x - cx) * scale, y, cz + (z - cz) * scale]),
    lo = ring(1.05, -0.4),
    shaft = ring(0.93, G + 60),
    toe = ring(1.05, G + 8),
    skin = (role, A, B) => {
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8,
          m = avg([A[i], A[j]]);
        f(role, [A[i], A[j], B[j], B[i]], [m[0] - cx, 0, m[2] - cz]);
      }
    },
    avg = (ps) => ps.reduce((v, p) => v.map((x, k) => x + p[k] / ps.length), [0, 0, 0]);
  skin('wall', lo, toe);
  skin('tower', toe, shaft);
  skin('tower', shaft, ring(0.95, deck - 1));
  for (const [scale, y0, y1] of [
    [1.35, deck - 1, deck],
    [1.12, deck, deck + 0.4],
    [1.25, deck + 6.4, deck + 7],
  ])
    prism(f, 'metal', { outline: ring(scale, 0).map((p) => [p[0], p[2]]) }, y0, y1);
  skin('glass', ring(1.1, deck + 0.4), ring(1.1, deck + 6.4));
  if (detail) {
    skin('glass', ring(1.32, deck), ring(1.32, deck + 1.2));
    for (let i = 0; i < 8; i++) {
      const p = ring(1.1, deck + 0.4)[i],
        q = ring(1.1, deck + 6.4)[i];
      bar('metal', p, q, 0.14);
    }
    const shaftPoint = (i, y, t) => {
      const j = (i + 1) % 8,
        u = (y - (G + 8)) / 52,
        left = toe[i].map((v, k) => v + (shaft[i][k] - v) * u),
        right = toe[j].map((v, k) => v + (shaft[j][k] - v) * u),
        p = left.map((v, k) => v + (right[k] - v) * t),
        R = Math.hypot(p[0] - cx, p[2] - cz);
      return [p[0] + ((p[0] - cx) / R) * 0.015, y, p[2] + ((p[2] - cz) / R) * 0.015];
    };
    for (let i = 0; i < 8; i += 2) {
      const p = shaftPoint(i, G + 12, 0.12),
        q = shaftPoint(i, G + 12, 0.35),
        s = shaftPoint(i, G + 59, 0.35),
        t = shaftPoint(i, G + 59, 0.12),
        mid = avg([p, q]);
      f('glass', [p, q, s, t], [mid[0] - cx, 0, mid[2] - cz]);
      if (detail > 1)
        for (let y = G + 17; y < G + 57; y += 6)
          bar('metal', shaftPoint(i, y, 0.12), shaftPoint(i, y, 0.35), 0.13);
    }
  }

  // Supported entry deck and paired blue arches attach to the east side of the lighthouse.
  const bridge = r.bridge,
    V = bridge.end.map((v, k) => v - bridge.start[k]),
    length = Math.hypot(...V),
    U = V.map((v) => v / length),
    T = [-U[1], U[0]],
    point = (t, y, s = 0) => [
      bridge.start[0] + V[0] * t + T[0] * s,
      y,
      bridge.start[1] + V[1] * t + T[1] * s,
    ],
    count = [2, 6, 12, 24][detail];
  slab(
    'wall',
    [point(0, 12.5, -2.3), point(1, 12.5, -2.3), point(1, 12.5, 2.3), point(0, 12.5, 2.3)],
    0.5,
    true,
  );
  for (const t of [0, 1]) {
    const p = point(t, 0);
    box(f, 'wall', p[0], -0.4, p[2], 5, 5.9, 5);
  }
  for (const s of [-2.1, 2.1])
    for (let i = 0; i < count; i++) {
      const t = i / count,
        u = (i + 1) / count,
        A = point(t, 5.5 + 6 * Math.sin(Math.PI * t), s),
        B = point(u, 5.5 + 6 * Math.sin(Math.PI * u), s);
      bar('arch', A, B, detail ? 0.45 : 0.9);
      if (detail) {
        if (detail > 1 || i % 2 === 0) bar('arch', A, point(t, 12, s), 0.16);
        if (detail > 1) {
          bar('metal', point(t, 13.5, s), point(u, 13.5, s), 0.14);
          bar('metal', point(t, 12.5, s), point(t, 13.5, s), 0.12);
        }
      }
    }
  if (detail === 1)
    for (const s of [-2.1, 2.1]) {
      bar('metal', point(0, 13.5, s), point(1, 13.5, s), 0.14);
      for (const t of [0, 0.5, 1]) bar('metal', point(t, 12.5, s), point(t, 13.5, s), 0.12);
    }
  if (detail > 1)
    for (const s of [-2.1, 2.1]) bar('metal', point(1, 12.5, s), point(1, 13.5, s), 0.12);
  box(f, 'screen', 122, 26, 0, 1, 8, 28);
  for (const z of [-10, 10]) bar('wall', [122, -0.4, z], [122, 26, z], 1);
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
        ),
      end = 54.864,
      width = 24.384;
    for (const z of [-width, width]) paint(0, z, end * 2, 0.14);
    for (const x of [-end, end]) paint(x, 0, 0.14, width * 2);
    for (let yard = 0; yard <= 100; yard += 5) {
      const x = -45.72 + yard * 0.9144;
      paint(x, 0, 0.12, width * 2);
      if (detail > 1) for (const z of [-2.82, 2.82]) paint(x, z, 1.2, 0.12);
    }
    if (detail > 1)
      for (let yard = 1; yard < 100; yard++) {
        const x = -45.72 + yard * 0.9144;
        for (const z of [-2.82, 2.82]) paint(x, z, 0.1, 0.45);
      }
    for (const sign of [-1, 1]) {
      const x = sign * 54.864,
        base = detail > 1 ? sign * 56.5 : x;
      bar('goal', [base, 0.3, 0], [base, 3.2, 0], 0.17);
      if (detail > 1) bar('goal', [base, 3.2, 0], [x, 3.2, 0], 0.17);
      bar('goal', [x, 3.2, -2.82], [x, 3.2, 2.82], 0.13);
      for (const z of [-2.82, 2.82]) bar('goal', [x, 3.2, z], [x, 9.2, z], 0.13);
    }
  }
}
