/** 'arena_fonte_nova': Arena Fonte Nova's open southern bowl, louvered enclosure and membrane roof. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const fonteSegments = [8, 12, 32, 64];
export function fonteRadius(poly, a) {
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
  if (!hits.length) throw Error('arena_fonte_nova: nonradial native boundary');
  return Math.min(...hits);
}
export function fonteFoundationOutline(r, d) {
  return Array.from({ length: fonteSegments[d] }, (_, i) => {
    const a = ((i - (d === 0 ? 0.5 : 0)) * tau) / fonteSegments[d],
      R = fonteRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}

export const fonteGap = (a) => Math.cos(a) > Math.cos(Math.PI / 8) - 1e-8;
export function fonteRoofPoint(r, a, t) {
  const R = fonteRadius(r.inner, a) * (1 - t) + fonteRadius(r.outer, a) * t;
  return [R * Math.cos(a), 48 - 3 * t + 3 * Math.sin(Math.PI * t), R * Math.sin(a)];
}
export function buildFonteStadium(face, detail, r) {
  const F = r.floorY,
    n = fonteSegments[detail],
    tau = Math.PI * 2,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], F + y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, N) => face(role, ps.map(P), D(N)),
    adapter = {
      addQuad: (role, _ref, ps, N) => f(role, ps, N),
      addConvexPolygon: (role, _ref, ps, N) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], N);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    body = (a, y, s = 1) => {
      const R = fonteRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = fonteRadius(r.inner, a) * (1 - t) + fonteRadius(r.outer, a) * 0.94 * t;
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
      for (let i = 0; i < 4; i++) {
        if (!detail && (i === 1 || i === 3)) continue;
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    inner = r.inner,
    field = [
      [-54, -31],
      [54, -31],
      [54, 31],
      [-54, 31],
    ],
    rows = detail === 3 ? [20, 8, 20] : detail === 2 ? [5, 2, 5] : [1, 1, 1],
    nr = [1, 2, 3, 5][detail];
  prism(
    f,
    'wall',
    { outline: fonteFoundationOutline(r, detail), holes: [inner] },
    Math.min(r.minGround - F - 0.6, -0.6),
    0.27,
  );
  prism(f, 'apron', { outline: inner, holes: [field] }, 0.27, 0.3);
  box(f, 'turf', 0, 0.3, 0, 108, 0.02, 62);
  for (let i = 0; i < n; i++) {
    const a = ((i - (detail === 0 ? 0.5 : 0)) * tau) / n,
      b = ((i + 1 - (detail === 0 ? 0.5 : 0)) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      gap = fonteGap(m),
      ga = r.columnContacts[detail][i] - F,
      gb = r.columnContacts[detail][(i + 1) % n] - F;
    // A continuous cable-supported oval roof crosses the open south end.
    for (let j = 0; j < nr; j++)
      slab(
        'roof',
        [
          fonteRoofPoint(r, a, j / nr),
          fonteRoofPoint(r, b, j / nr),
          fonteRoofPoint(r, b, (j + 1) / nr),
          fonteRoofPoint(r, a, (j + 1) / nr),
        ],
        0.22,
      );
    if (!gap) {
      f(
        'wall',
        [at(0, a, 0.27), at(0, b, 0.27), at(0, b, 1.4), at(0, a, 1.4)],
        N.map((v) => -v),
      );
      for (const [k, t] of [
        { lo: 0, hi: 0.27, y0: 1.4, y1: 12 },
        { lo: 0.35, hi: 0.53, y0: 16, y1: 24 },
        { lo: 0.64, hi: 0.96, y0: 29, y1: 43 },
      ].entries())
        for (let j = 0; j < rows[k]; j++) {
          const u = j / rows[k],
            v = (j + 1) / rows[k],
            lo = t.lo + (t.hi - t.lo) * u,
            hi = t.lo + (t.hi - t.lo) * v,
            y = t.y0 + (t.y1 - t.y0) * v,
            role =
              detail > 1 && i % 5 === 0
                ? 'wall'
                : detail > 1
                  ? ['seat', 'seat2', 'seat3'][(Math.floor(i / 3) + (j % 3)) % 3]
                  : 'seat';
          slab(
            role,
            [
              at(lo, a, detail > 1 ? y : t.y0),
              at(lo, b, detail > 1 ? y : t.y0),
              at(hi, b, y),
              at(hi, a, y),
            ],
            detail > 1 ? (t.y1 - t.y0) / rows[k] + 0.12 : 0.4,
          );
        }
      slab('wall', [at(0.27, a, 16), at(0.27, b, 16), at(0.35, b, 16), at(0.35, a, 16)], 0.35);
      f(
        'glass',
        [at(0.27, a, 12), at(0.27, b, 12), at(0.27, b, 16), at(0.27, a, 16)],
        N.map((v) => -v),
      );
      f(
        'wall',
        [
          body(a, ga - 0.3, 0.985),
          body(b, gb - 0.3, 0.985),
          body(b, 12, 0.985),
          body(a, 12, 0.985),
        ],
        N,
      );
      if (detail) {
        f(
          'glass',
          [body(a, 12.2, 0.99), body(b, 12.2, 0.99), body(b, 16, 0.99), body(a, 16, 0.99)],
          N,
        );
        const count = [0, 4, 8, 18][detail];
        for (let j = 0; j < count; j++) {
          const y = 17 + j * (25 / (count - 1));
          slab(
            'metal',
            [body(a, y, 0.975), body(b, y, 0.975), body(b, y, 0.997), body(a, y, 0.997)],
            detail === 1 ? 1.1 : 0.24,
          );
        }
      } else
        f(
          'panel',
          [body(a, 12, 0.985), body(b, 12, 0.985), body(b, 43, 0.985), body(a, 43, 0.985)],
          N,
        );
    }
    // The glazed restaurant/concourse crosses the south opening above the field-level view.
    slab('wall', [at(0.53, a, 26), at(0.53, b, 26), at(0.64, b, 26), at(0.64, a, 26)], 0.45);
    slab('wall', [at(0.53, a, 29), at(0.53, b, 29), at(0.64, b, 29), at(0.64, a, 29)], 0.3);
    for (const [t, sign] of [
      [0.53, -1],
      [0.64, 1],
    ])
      f(
        'glass',
        [at(t, a, 26), at(t, b, 26), at(t, b, 29), at(t, a, 29)],
        N.map((v) => v * sign),
      );
    // Outer concrete posts and roof compression ring follow each native radial section.
    if (detail) {
      bar('wall', body(a, ga - 0.3, 0.985), body(a, 45, 0.985), 0.75);
      bar('metal', body(a, 45), body(b, 45), 0.42);
      const top = fonteRoofPoint(r, a, 0);
      bar('metal', top, [top[0], 53, top[2]], 0.24);
      bar('metal', [top[0], 53, top[2]], body(a, 45), 0.12);
      bar('metal', top, body(a, 44), 0.32);
      if (detail > 1) {
        const bottom = top.map((v, k) => (k === 1 ? v - 2.3 : v));
        bar('metal', bottom, body(a, 43.2), 0.22);
        bar('metal', bottom, top, 0.18);
        bar('metal', bottom, fonteRoofPoint(r, a, 0.5), 0.12);
      }
    } else if (i % 2 === 0) bar('metal', fonteRoofPoint(r, a, 0), body(a, 45), 0.4);
  }
  // Supported native lower entrance-canopy strip, kept separate from the detached garage.
  if (detail) {
    const q = r.entrance;
    prism(f, 'wall', { outline: q.outline }, 0.27, 1.2);
    for (const i of [0, Math.floor(q.outline.length / 2)]) {
      const p = q.outline[i];
      bar('wall', [p[0], q.contacts[i] - F - 0.3, p[1]], [p[0], 0.27, p[1]], 0.7);
    }
  }
  // South entrance steps conform to the unmodified sampled downslope.
  const steps = [1, 4, 8, 24][detail];
  for (let i = 0; i < steps; i++) {
    const lo = i / steps,
      hi = (i + 1) / steps,
      y = r.stairY[Math.round((i * 24) / steps)],
      next = r.stairY[Math.round(((i + 1) * 24) / steps)],
      x0 = 140 + lo * 36,
      x1 = 140 + hi * 36;
    slab(
      'wall',
      [
        [x0, y, -30],
        [x1, y, -30],
        [x1, y, 30],
        [x0, y, 30],
      ],
      Math.max(0.15, y - next + 0.12),
    );
  }
  if (detail > 1) {
    for (const z of [-30, 0, 30]) {
      for (let i = 0; i < 24; i++) {
        const x0 = 140 + i * 1.5,
          x1 = x0 + 1.5;
        bar('metal', [x0, r.stairY[i] + 1, z], [x1, r.stairY[i + 1] + 1, z], 0.09);
        if (i % 4 === 0) bar('metal', [x0, r.stairY[i], z], [x0, r.stairY[i] + 1, z], 0.09);
      }
    }
  }
  // Two hanging neutral displays are carried by the inner roof ring.
  for (const sign of [-1, 1]) {
    const c = fonteRoofPoint(r, sign < 0 ? Math.PI : 0, 0),
      x = c[0];
    if (detail) {
      box(f, 'display', x, 36, -0.1, 1, 8, 14);
      for (const z of [-5, 5]) bar('metal', [x, 44, z], [x, 48, z], 0.13);
    } else box(f, 'display', x, 36, 0, 0.8, 8, 14);
  }
  if (detail > 1) {
    const paint = (x, z, w, d) =>
        f(
          'mark',
          [
            [x - w / 2, 0.35, z - d / 2],
            [x + w / 2, 0.35, z - d / 2],
            [x + w / 2, 0.35, z + d / 2],
            [x - w / 2, 0.35, z + d / 2],
          ],
          [0, 1, 0],
        ),
      L = r.fieldLength / 2,
      W = r.fieldWidth / 2;
    for (const z of [-W, W]) paint(0, z, L * 2, 0.12);
    for (const x of [-L, 0, L]) paint(x, 0, 0.12, W * 2);
    const ns = detail === 3 ? 48 : 20;
    for (let i = 0; i < ns; i++) {
      const a = (i * tau) / ns,
        b = ((i + 1) * tau) / ns;
      slab(
        'mark',
        [
          [9.15 * Math.cos(a), 0.35, 9.15 * Math.sin(a)],
          [9.15 * Math.cos(b), 0.35, 9.15 * Math.sin(b)],
          [9.27 * Math.cos(b), 0.35, 9.27 * Math.sin(b)],
          [9.27 * Math.cos(a), 0.35, 9.27 * Math.sin(a)],
        ],
        0.01,
      );
    }
    for (const sign of [-1, 1]) {
      for (const [depth, width] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(sign * (L - depth), 0, 0.12, width);
        for (const z of [-width / 2, width / 2]) paint(sign * (L - depth / 2), z, depth, 0.12);
      }
      for (const z of [-3.66, 3.66]) bar('mark', [sign * L, 0.32, z], [sign * L, 2.76, z], 0.12);
      bar('mark', [sign * L, 2.76, -3.66], [sign * L, 2.76, 3.66], 0.12);
      if (detail === 3) {
        for (const z of [-3.66, 3.66]) {
          bar('metal', [sign * L, 2.76, z], [sign * (L + 2), 0.32, z], 0.055);
          bar('metal', [sign * L, 0.32, z], [sign * (L + 2), 0.32, z], 0.055);
        }
        for (let i = 0; i <= 12; i++) {
          const z = -3.66 + (7.32 * i) / 12;
          bar('mark', [sign * L, 2.76, z], [sign * (L + 2), 0.32, z], 0.022);
        }
      }
    }
  }
}
