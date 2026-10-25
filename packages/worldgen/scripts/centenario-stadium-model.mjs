/** 'estadio_centenario': Centenario's three banks, America canopy and fluted Torre de los Homenajes. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const centenarioSegments = [12, 20, 32, 64];
export function centenarioRadius(poly, a) {
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
  if (!hits.length) throw Error('estadio_centenario: nonradial native boundary');
  return Math.min(...hits);
}
export function centenarioFoundationOutline(r, d) {
  return Array.from({ length: centenarioSegments[d] }, (_, i) => {
    const a = (i * tau) / centenarioSegments[d],
      R = centenarioRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
export function buildCentenarioStadium(face, detail, r) {
  const F = r.floorY,
    n = centenarioSegments[detail],
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
      const R = centenarioRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = centenarioRadius(r.inner, a) * (1 - t) + centenarioRadius(r.outer, a) * 0.94 * t;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
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
    rows = detail === 3 ? 14 : detail === 2 ? 5 : 1;
  prism(
    f,
    'wall',
    { outline: centenarioFoundationOutline(r, detail), holes: [r.inner] },
    Math.min(r.minGround - F - 0.6, -0.6),
    0.27,
  );
  prism(
    f,
    'apron',
    {
      outline: r.inner,
      holes: [
        [
          [-55, -36],
          [55, -36],
          [55, 36],
          [-55, 36],
        ],
      ],
    },
    0.27,
    0.3,
  );
  box(f, 'turf', 0, 0.3, 0, 110, 0.02, 72);
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) * 0.5,
      N = [Math.cos(m), 0, Math.sin(m)],
      west = Math.sin(m) > 0.72,
      top = detail && west ? 27.8 : 31,
      tiers = [
        { lo: 0, hi: 0.25, y0: 1.4, y1: 8.5 },
        { lo: 0.33, hi: 0.6, y0: 12, y1: 19.6 },
        { lo: 0.7, hi: 0.98, y0: 23, y1: top },
      ];
    f(
      'wall',
      [at(0, a, 0.27), at(0, b, 0.27), at(0, b, 1.4), at(0, a, 1.4)],
      N.map((v) => -v),
    );
    for (const [k, t] of tiers.entries())
      for (let j = 0; j < rows; j++) {
        const u = j / rows,
          v = (j + 1) / rows,
          lo = t.lo + (t.hi - t.lo) * u,
          hi = t.lo + (t.hi - t.lo) * v,
          y = t.y0 + (t.y1 - t.y0) * v,
          role = detail > 1 && i % 6 === 0 ? 'wall' : (i + k) % 4 === 0 ? 'seatPale' : 'seatBlue';
        slab(
          role,
          [
            at(lo, a, detail > 1 ? y : t.y0),
            at(lo, b, detail > 1 ? y : t.y0),
            at(hi, b, y),
            at(hi, a, y),
          ],
          detail > 1 ? (t.y1 - t.y0) / rows + 0.1 : 0.4,
        );
      }
    for (const [lo, hi, y0, y1] of [
      [0.25, 0.33, 8.5, 12],
      [0.6, 0.7, 19.6, 23],
    ]) {
      slab('wall', [at(lo, a, y1), at(lo, b, y1), at(hi, b, y1), at(hi, a, y1)], 0.4);
      f(
        'wall',
        [at(lo, a, y0), at(lo, b, y0), at(lo, b, y1), at(lo, a, y1)],
        N.map((v) => -v),
      );
      if (detail > 1 && i % 3 === 1) {
        const left = at(lo, a, y0),
          right = at(lo, b, y0),
          p = left.map((v, k) => (v + right[k]) * 0.5 - N[k] * 0.04),
          T = [-Math.sin(m), 0, Math.cos(m)];
        // Recessed neutral concourse face, with a projecting pale lintel.
        f(
          'glass',
          [
            [p[0] - T[0] * 2, y0 + 0.15, p[2] - T[2] * 2],
            [p[0] + T[0] * 2, y0 + 0.15, p[2] + T[2] * 2],
            [p[0] + T[0] * 2, y1 - 0.3, p[2] + T[2] * 2],
            [p[0] - T[0] * 2, y1 - 0.3, p[2] - T[2] * 2],
          ],
          N.map((v) => -v),
        );
      }
    }
    const ga = r.columnContacts[detail][i] - F,
      gb = r.columnContacts[detail][(i + 1) % n] - F;
    f(
      'brick',
      [body(a, ga - 0.3, 0.98), body(b, gb - 0.3, 0.98), body(b, top, 0.98), body(a, top, 0.98)],
      N,
    );
    slab(
      'wall',
      [body(a, top, 0.94), body(b, top, 0.94), body(b, top, 0.98), body(a, top, 0.98)],
      0.35,
    );
    if (detail) {
      bar('wall', body(a, ga - 0.3, 0.98), body(a, top + 0.5, 0.98), 0.5);
      bar('metal', body(a, top + 0.7, 0.945), body(b, top + 0.7, 0.945), 0.1);
      bar('metal', body(a, top, 0.945), body(a, top + 0.7, 0.945), 0.1);
      if (i % 3 === 0) {
        const p = body(m, Math.max(ga, gb), 0.982);
        box(f, 'glass', p[0], p[1] + 0.3, p[2], 2.2, 2.5, 1);
      }
    }
  }
  // Native América canopy above its central press/gallery section.
  const roof = detail
    ? r.roof
    : [
        [-41.5, 86],
        [40.9, 86],
        [40.9, 112],
        [-41.5, 112],
      ];
  prism(f, 'roof', { outline: roof }, 32.1, 32.45);
  if (detail) {
    for (const frame of r.roofFrames[detail]) {
      const { x, z, frontZ, groundY } = frame;
      bar('wall', [x, groundY - F - 0.3, z], [x, 32.1, z], 0.65);
      bar('metal', [x, 31.8, z], [x, 32.1, frontZ], 0.25);
    }
    box(f, 'glass', 0, 27.8, 99, 70, 3, 2);
    box(f, 'wall', 0, 27.4, 99, 72, 0.4, 4);
  }
  // Tower plan, shaft, upper spine and flank buttresses retain the four native component controls.
  const t = r.tower,
    G = t.groundY - F,
    c = t.center,
    bodyW = t.width,
    bodyD = t.depth;
  if (!detail) {
    prism(f, 'wall', { outline: t.outline }, G - 0.3, G + 75);
    prism(f, 'wall', { outline: t.coreOutline }, G - 0.3, G + 90);
    for (const p of t.buttresses) prism(f, 'wall', { outline: p }, G - 0.3, G + 15);
  } else {
    // A narrower occupied core leaves real side recesses between the corner piers and floor ledges.
    box(f, 'wall', c[0], G - 0.3, c[1], bodyW * 0.69, 75.3, bodyD * 0.88);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(
          f,
          'wall',
          c[0] + sx * (bodyW / 2 - 0.28),
          G - 0.3,
          c[1] + sz * (bodyD / 2 - 0.28),
          0.56,
          75.3,
          0.56,
        );
    prism(f, 'wall', { outline: t.coreOutline }, G - 0.3, G + 90);
    for (const p of t.buttresses) prism(f, 'wall', { outline: p }, G - 0.3, G + 15);
    for (let i = 0; i < 9; i++) {
      const y = G + 18 + i * 6.2;
      box(f, 'wall', c[0], y, c[1], bodyW + 0.3, 0.32, bodyD + 0.3);
      if (detail > 1)
        for (const sx of [-1, 1])
          bar(
            'wall',
            [c[0] + sx * bodyW * 0.34, y - 1.2, c[1]],
            [c[0] + sx * bodyW * 0.52, y, c[1]],
            0.24,
          );
    }
    const ribs = detail === 3 ? 7 : detail === 2 ? 5 : 3;
    for (let i = 0; i < ribs; i++)
      box(
        f,
        'wall',
        c[0] - bodyW * 0.33 + (bodyW * 0.66 * i) / (ribs - 1),
        G + 2,
        c[1] - bodyD / 2 - 0.18,
        0.18,
        72,
        0.36,
      );
    box(f, 'glass', c[0], G + 3, c[1] - bodyD / 2 - 0.03, 1, 70, 0.1);
    for (const y of [G + 72.7, G + 74, G + 75.1])
      box(f, 'wall', c[0], y, c[1], bodyW + 0.65, 0.25, bodyD + 0.65);
  }
  bar('wall', [c[0] - 13, G + 21, c[1]], [c[0] + 13, G + 21, c[1]], 1.2, 1.5);
  if (detail) {
    const cc = t.coreCenter;
    bar('metal', [cc[0], G + 89.8, cc[1]], [cc[0], G + 96, cc[1]], 0.12);
    if (detail > 1)
      for (let i = 0; i < 9; i++) {
        const y = G + 92 + i * 0.35,
          ps = [
            [cc[0], y, cc[1]],
            [cc[0] + 4.5, y, cc[1]],
            [cc[0] + 4.5, y + 0.35, cc[1]],
            [cc[0], y + 0.35, cc[1]],
          ];
        f(i % 2 ? 'flagBlue' : 'seatPale', ps, [0, 0, 1]);
        f(i % 2 ? 'flagBlue' : 'seatPale', ps, [0, 0, -1]);
      }
  }
  for (const l of r.lights) {
    const [x, z] = l.center,
      L = Math.hypot(x, z),
      N = [-x / L, 0, -z / L],
      T = [-N[2], 0, N[0]],
      point = (u, y, v) => [x + T[0] * u + N[0] * v, y, z + T[2] * u + N[2] * v];
    bar('metal', [x, l.groundY - F - 0.3, z], [x, 48, z], detail ? 0.65 : 1.1);
    const ps = [point(-4, 45, 0), point(4, 45, 0), point(4, 51, 0), point(-4, 51, 0)];
    if (detail) {
      prism(
        f,
        'metal',
        {
          outline: [
            [-4, -0.5],
            [4, -0.5],
            [4, 0.5],
            [-4, 0.5],
          ].map(([u, v]) => {
            const p = point(u, 0, v);
            return [p[0], p[2]];
          }),
        },
        45,
        51,
      );
    } else {
      f('metal', ps, N);
      f(
        'metal',
        ps,
        N.map((v) => -v),
      );
    }
    if (detail > 1)
      for (let j = 0; j < 4; j++)
        for (let k = 0; k < 5; k++) {
          const u = -3.2 + k * 1.6,
            y = 45.5 + j * 1.35;
          f(
            'mark',
            [
              point(u - 0.5, y, 0.52),
              point(u + 0.5, y, 0.52),
              point(u + 0.5, y + 0.7, 0.52),
              point(u - 0.5, y + 0.7, 0.52),
            ],
            N,
          );
        }
  }
  if (detail) {
    for (const x of [-115, 115]) {
      box(f, 'display', x, 25, 0, 0.6, 4, 9);
      for (const z of [-3, 3])
        bar('metal', [x, r.displayContacts[x < 0 ? 0 : 1] - F - 0.3, z], [x, 25, z], 0.5);
    }
  }
  if (detail > 1) {
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
    const steps = detail === 3 ? 32 : 16;
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
