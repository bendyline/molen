/** 'rajko_mitic_stadium': Rajko Mitic's excavated oval, single western canopy and red-banded entrance. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const rajkoSegments = [12, 20, 32, 64];
export function rajkoRadius(poly, a) {
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
  if (!hits.length) throw Error('rajko_mitic_stadium: nonradial native boundary');
  return Math.min(...hits);
}
export function rajkoCapsule(radius, steps) {
  return [0, 1].flatMap((end) =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = -Math.PI / 2 + end * Math.PI + (i * Math.PI) / steps;
      return [(end ? -42 : 42) + radius * Math.cos(a), radius * Math.sin(a)];
    }),
  );
}
export function rajkoRoofPoint(r, u, t) {
  const a = r.westStart + (r.westEnd - r.westStart) * u,
    R = rajkoRadius(r.outer, a) * (0.98 - 0.78 * t) + rajkoRadius(r.inner, a) * 0.8 * t;
  return [R * Math.cos(a), 27.6 + 1.2 * Math.sin(Math.PI * u) + 1.1 * t, R * Math.sin(a)];
}
export function buildRajkoStadium(face, detail, r) {
  const F = r.floorY,
    n = rajkoSegments[detail],
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
      const R = rajkoRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = rajkoRadius(r.inner, a) * (1 - t) + rajkoRadius(r.outer, a) * 0.94 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    west = (a) => a >= r.westStart && a <= r.westEnd,
    slab = (role, ps, thick = 0.35) => {
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
        const p = ps[i],
          q = ps[(i + 1) % 4];
        f(
          role,
          [p, [p[0], p[1] - thick, p[2]], [q[0], q[1] - thick, q[2]], q],
          [(q[2] - p[2]) * sign, 0, (p[0] - q[0]) * sign],
        );
      }
    },
    rows = detail === 3 ? 44 : detail === 2 ? 10 : 1;
  const trackOutline = rajkoCapsule(49.1, detail === 3 ? 32 : detail === 2 ? 20 : 8);
  prism(
    f,
    'wall',
    { outline: r.outer, holes: [trackOutline] },
    Math.min(r.minGround - F - 0.7, -0.7),
    0.27,
  );
  prism(
    f,
    'track',
    {
      outline: trackOutline,
      holes: [
        [
          [-52.55, -34],
          [52.55, -34],
          [52.55, 34],
          [-52.55, 34],
        ],
      ],
    },
    0.27,
    0.3,
  );
  box(f, 'turf', 0, 0.3, 0, 105.1, 0.02, 68);
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) / 2,
      N = [Math.cos(m), 0, Math.sin(m)],
      W = west(m),
      g = r.columnContacts[detail][i] - F,
      h = r.columnContacts[detail][(i + 1) % n] - F;
    f(
      'wall',
      [at(0, a, 0.27), at(0, b, 0.27), at(0, b, 1.4), at(0, a, 1.4)],
      N.map((v) => -v),
    );
    for (let j = 0; j < rows; j++) {
      const u = j / rows,
        v = (j + 1) / rows,
        y = 1.4 + 20.1 * v,
        role =
          detail > 1 && i % 8 === 0
            ? 'wall'
            : Math.abs(Math.cos(m)) < 0.48 && !W
              ? 'seatPale'
              : Math.floor((i * 16) / n) % 2
                ? 'seatRed'
                : 'seatPale';
      slab(
        role,
        [at(u, a, detail > 1 ? y : 1.4), at(u, b, detail > 1 ? y : 1.4), at(v, b, y), at(v, a, y)],
        detail > 1 ? 20.1 / rows + 0.1 : 0.4,
      );
    }
    // Original sampled ground reaches the outer retaining face; no regional terrain flattening.
    f(
      'wall',
      [body(a, g - 0.35, 0.99), body(b, h - 0.35, 0.99), body(b, 22, 0.99), body(a, 22, 0.99)],
      N,
    );
    slab('wall', [body(a, 22, 0.94), body(b, 22, 0.94), body(b, 22, 0.99), body(a, 22, 0.99)], 0.4);
    if (detail) {
      bar('metal', body(a, 22.8, 0.945), body(b, 22.8, 0.945), 0.11);
      bar('metal', body(a, 22, 0.945), body(a, 22.8, 0.945), 0.1);
    }
    if (W) {
      // Curved western office/hospitality frontage with red bands and pale window piers.
      if (detail) {
        f('brick', [body(a, g - 0.3, 1), body(b, h - 0.3, 1), body(b, 18, 1), body(a, 18, 1)], N);
        for (const [y0, y1] of [
          [18.1, 20.8],
          [22, 24.7],
        ]) {
          f(
            'glass',
            [body(a, y0, 1.002), body(b, y0, 1.002), body(b, y1, 1.002), body(a, y1, 1.002)],
            N,
          );
          bar('wall', body(a, y0, 1.003), body(a, y1, 1.003), 0.22);
          slab(
            'accent',
            [body(a, y1, 1.008), body(b, y1, 1.008), body(b, y1, 1.025), body(a, y1, 1.025)],
            0.4,
          );
        }
        slab(
          'wall',
          [body(a, 25.9, 0.86), body(b, 25.9, 0.86), body(b, 25.9, 1.02), body(a, 25.9, 1.02)],
          0.32,
        );
        f(
          'glass',
          [body(a, 23.4, 0.865), body(b, 23.4, 0.865), body(b, 25.7, 0.865), body(a, 25.7, 0.865)],
          N.map((v) => -v),
        );
        slab(
          'wall',
          [body(a, 23.4, 0.86), body(b, 23.4, 0.86), body(b, 23.4, 0.98), body(a, 23.4, 0.98)],
          0.4,
        );
        bar('accent', body(a, g - 0.3, 0.98), body(a, 27.7, 0.98), 0.55);
      } else
        f(
          'accent',
          [body(a, 22, 0.99), body(b, 22, 0.99), body(b, 26, 0.99), body(a, 26, 0.99)],
          N,
        );
    } else if (detail > 1 && i % 6 === 0) {
      const p = body(m, 22, 0.97);
      box(f, 'wall', p[0], 22, p[2], 3, 1.2, 3);
    }
  }
  const nr = [4, 8, 16, 32][detail],
    bands = detail < 2 ? [0, 1] : [0, 0.45, 0.8, 1];
  for (let i = 0; i < nr; i++) {
    const a = i / nr,
      b = (i + 1) / nr;
    for (let j = 0; j < bands.length - 1; j++)
      slab(
        'roof',
        [
          rajkoRoofPoint(r, a, bands[j]),
          rajkoRoofPoint(r, b, bands[j]),
          rajkoRoofPoint(r, b, bands[j + 1]),
          rajkoRoofPoint(r, a, bands[j + 1]),
        ],
        0.3,
      );
    if (detail) {
      const A = rajkoRoofPoint(r, a, 0),
        B = rajkoRoofPoint(r, a, 1),
        Y = A[1] - 0.6;
      bar('metal', [A[0], Y, A[2]], [B[0], B[1] - 0.45, B[2]], 0.35);
      bar('metal', [A[0], Y, A[2]], [A[0], A[1] - 0.04, A[2]], 0.3);
      bar('wall', [A[0], r.roofContacts[detail][i] - F - 0.3, A[2]], [A[0], Y, A[2]], 0.7);
      if (detail > 1) {
        const mid = rajkoRoofPoint(r, a, 0.5);
        bar('metal', [mid[0], Y, mid[2]], [B[0], B[1] - 0.45, B[2]], 0.16);
        for (const t of [0.45, 0.8, 1]) {
          const p = rajkoRoofPoint(r, a, t),
            q = rajkoRoofPoint(r, b, t);
          bar('metal', [p[0], p[1] - 0.4, p[2]], [q[0], q[1] - 0.4, q[2]], 0.12);
          bar('metal', [p[0], p[1] - 0.4, p[2]], [p[0], p[1] - 0.02, p[2]], 0.12);
        }
      }
    }
  }
  // Four slender floodlight masts remain specific skyline cues.
  for (const l of r.lights) {
    const [x, z] = l.center,
      L = Math.hypot(x, z),
      N = [-x / L, 0, -z / L],
      T = [-N[2], 0, N[0]],
      point = (u, y, v) => [x + T[0] * u + N[0] * v, y, z + T[2] * u + N[2] * v];
    bar('metal', [x, l.groundY - F - 0.4, z], [x, 53, z], detail ? 0.72 : 1.1);
    if (detail) {
      prism(
        f,
        'metal',
        {
          outline: [
            [-2.9, -0.575],
            [2.9, -0.575],
            [2.9, 0.575],
            [-2.9, 0.575],
          ].map(([u, v]) => {
            const p = point(u, 0, v);
            return [p[0], p[2]];
          }),
        },
        51,
        59,
      );
      if (detail > 1)
        for (let j = 0; j < 6; j++)
          for (let k = 0; k < 3; k++) {
            const u = -1.9 + k * 1.9,
              y = 51.5 + j * 1.15;
            f(
              'mark',
              [
                point(u - 0.55, y, 0.59),
                point(u + 0.55, y, 0.59),
                point(u + 0.55, y + 0.7, 0.59),
                point(u - 0.55, y + 0.7, 0.59),
              ],
              N,
            );
          }
    } else {
      const ps = [point(-2.9, 51, 0), point(2.9, 51, 0), point(2.9, 59, 0), point(-2.9, 59, 0)];
      f('metal', ps, N);
      f(
        'metal',
        ps,
        N.map((v) => -v),
      );
    }
  }
  if (detail) {
    const a = Math.PI * 0.51,
      E = r.entryY,
      p = body(a, E, 1.01),
      q = body(a, E, 0.96),
      T = [Math.sin(a), 0, -Math.cos(a)];
    // A restrained central entrance portico; no crest, lettering or copied advertisements.
    const A = [p[0] - T[0] * 12, E, p[2] - T[2] * 12],
      B = [p[0] + T[0] * 12, E, p[2] + T[2] * 12],
      C = [q[0] + T[0] * 12, E, q[2] + T[2] * 12],
      D = [q[0] - T[0] * 12, E, q[2] - T[2] * 12];
    slab('roof', [A, B, C, D], 0.4);
    for (const t of [-12, 12]) {
      const c = [p[0] + T[0] * t, p[2] + T[2] * t],
        G = r.entryContacts[t < 0 ? 0 : 1] - F;
      bar('accent', [c[0], G - 0.3, c[1]], [c[0], E, c[1]], 0.55);
    }
    const x = 125,
      z = -8;
    box(f, 'display', x, 22.5, z, 1, 5.5, 11);
    for (const dz of [-4, 4])
      bar(
        'metal',
        [x, r.displayContacts[dz < 0 ? 0 : 1] - F - 0.3, z + dz],
        [x, 22.5, z + dz],
        0.6,
      );
  }
  if (detail > 1) {
    const steps = detail === 3 ? 32 : 16;
    for (let lane = 1; lane < 8; lane++) {
      const a = rajkoCapsule(39.1 + lane * 1.22, steps),
        b = rajkoCapsule(39.0 + lane * 1.22, steps);
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        f(
          'mark',
          [
            [a[i][0], 0.325, a[i][1]],
            [a[j][0], 0.325, a[j][1]],
            [b[j][0], 0.325, b[j][1]],
            [b[i][0], 0.325, b[i][1]],
          ],
          [0, 1, 0],
        );
      }
    }
    const paint = (x, z, w, d) =>
      f(
        'mark',
        [
          [x - w / 2, 0.335, z - d / 2],
          [x + w / 2, 0.335, z - d / 2],
          [x + w / 2, 0.335, z + d / 2],
          [x - w / 2, 0.335, z + d / 2],
        ],
        [0, 1, 0],
      );
    for (const z of [-34, 34]) paint(0, z, 105, 0.12);
    for (const x of [-52.5, 0, 52.5]) paint(x, 0, 0.12, 68);
    for (const sign of [-1, 1]) {
      for (const [d, w] of [
        [16.5, 40.32],
        [5.5, 18.32],
      ]) {
        paint(sign * (52.5 - d), 0, 0.12, w);
        for (const z of [-w / 2, w / 2]) paint(sign * (52.5 - d / 2), z, d, 0.12);
      }
      for (const z of [-3.66, 3.66])
        bar('mark', [sign * 52.5, 0.32, z], [sign * 52.5, 2.76, z], 0.1);
      bar('mark', [sign * 52.5, 2.76, -3.66], [sign * 52.5, 2.76, 3.66], 0.1);
    }
    for (let i = 0; i < steps; i++) {
      const a = (i * tau) / steps,
        b = ((i + 1) * tau) / steps;
      f(
        'mark',
        [
          [9.08 * Math.cos(a), 0.335, 9.08 * Math.sin(a)],
          [9.08 * Math.cos(b), 0.335, 9.08 * Math.sin(b)],
          [9.22 * Math.cos(b), 0.335, 9.22 * Math.sin(b)],
          [9.22 * Math.cos(a), 0.335, 9.22 * Math.sin(a)],
        ],
        [0, 1, 0],
      );
    }
  }
}
