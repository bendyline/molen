/** 'N0733': Arrowhead's red saddle bowl, curled press roofs and circular ramp towers. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

const tau = Math.PI * 2;
export const arrowheadSegments = [8, 12, 32, 64];
export const arrowheadCircleSegments = [4, 8, 12, 24];
export const arrowheadCrest = (a) => 43 + 16 * Math.sin(a) ** 2 + 2.5 * Math.sin(2 * a) ** 2;
export function arrowheadRadius(poly, a) {
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
  if (!hits.length) throw Error('N0733: nonradial native boundary');
  return Math.min(...hits);
}
export function arrowheadFoundationOutline(r, d) {
  return Array.from({ length: arrowheadSegments[d] }, (_, i) => {
    const a = (i * tau) / arrowheadSegments[d],
      R = arrowheadRadius(r.outer, a) * 0.98;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
}
const circle = (c, R, n) =>
  Array.from({ length: n }, (_, i) => [
    c[0] + R * Math.cos((i * tau) / n),
    c[1] + R * Math.sin((i * tau) / n),
  ]);
export function buildArrowheadStadium(face, detail, r) {
  const F = r.floorY,
    n = arrowheadSegments[detail],
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
      const R = arrowheadRadius(r.outer, a) * s;
      return [R * Math.cos(a), y, R * Math.sin(a)];
    },
    at = (t, a, y) => {
      const R = arrowheadRadius(r.inner, a) * (1 - t) + arrowheadRadius(r.outer, a) * 0.93 * t;
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
    field = [
      [-57, -27],
      [57, -27],
      [57, 27],
      [-57, 27],
    ],
    rows = detail === 3 ? [18, 8, 22] : detail === 2 ? [5, 2, 6] : [1, 1, 1];
  prism(
    f,
    'wall',
    { outline: arrowheadFoundationOutline(r, detail), holes: [r.inner] },
    Math.min(r.minGround - F - 0.6, -0.6),
    0.27,
  );
  prism(f, 'apron', { outline: r.inner, holes: [field] }, 0.27, 0.3);
  box(f, 'turf', 0, 0.3, 0, 114, 0.02, 54);
  if (detail) {
    for (const sign of [-1, 1])
      box(f, 'endzone', sign * (45.72 + 4.572), 0.32, 0, 9.144, 0.015, 48.768);
  }
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n,
      m = (a + b) * 0.5,
      N = [Math.cos(m), 0, Math.sin(m)],
      tiers = [
        { lo: 0, hi: 0.3, y0: 1.4, y1: 17 },
        { lo: 0.38, hi: 0.53, y0: 22, y1: 30 },
        { lo: 0.64, hi: 0.98, y0: 36, y1: arrowheadCrest(m) },
      ];
    f(
      'wall',
      [at(0, a, 0.27), at(0, b, 0.27), at(0, b, 1.4), at(0, a, 1.4)],
      N.map((v) => -v),
    );
    for (const [k, t] of tiers.entries())
      for (let j = 0; j < rows[k]; j++) {
        const u = j / rows[k],
          v = (j + 1) / rows[k],
          lo = t.lo + (t.hi - t.lo) * u,
          hi = t.lo + (t.hi - t.lo) * v,
          ya = t.y0 + ((k === 2 ? arrowheadCrest(a) : t.y1) - t.y0) * v,
          yb = t.y0 + ((k === 2 ? arrowheadCrest(b) : t.y1) - t.y0) * v,
          role = detail > 1 && i % 6 === 0 ? 'wall' : 'seat';
        slab(
          role,
          [
            at(lo, a, detail > 1 ? ya : t.y0),
            at(lo, b, detail > 1 ? yb : t.y0),
            at(hi, b, yb),
            at(hi, a, ya),
          ],
          detail > 1
            ? ((k === 2 ? Math.max(arrowheadCrest(a), arrowheadCrest(b)) : t.y1) - t.y0) / rows[k] +
                0.12
            : 0.45,
        );
      }
    for (const [lo, hi, y0, y1] of [
      [0.3, 0.38, 17, 22],
      [0.53, 0.64, 30, 36],
    ]) {
      slab('wall', [at(lo, a, y1), at(lo, b, y1), at(hi, b, y1), at(hi, a, y1)], 0.4);
      f(
        'glass',
        [at(lo, a, y0), at(lo, b, y0), at(lo, b, y1), at(lo, a, y1)],
        N.map((v) => -v),
      );
    }
    slab(
      'wall',
      [
        at(0.98, a, arrowheadCrest(a)),
        at(0.98, b, arrowheadCrest(b)),
        body(b, arrowheadCrest(b), 0.94),
        body(a, arrowheadCrest(a), 0.94),
      ],
      0.4,
    );
    const ga = r.columnContacts[detail][i] - F,
      gb = r.columnContacts[detail][(i + 1) % n] - F,
      A = body(a, 0, 0.985),
      B = body(b, 0, 0.985),
      end = Math.abs(Math.cos(m)) > 0.72;
    // Low exterior enclosure keeps the upper bowl's concrete rakers exposed.
    f(
      end ? 'panel' : 'wall',
      [
        [A[0], ga - 0.3, A[2]],
        [B[0], gb - 0.3, B[2]],
        [B[0], 36, B[2]],
        [A[0], 36, A[2]],
      ],
      N,
    );
    if (detail) {
      if (!end)
        f('glass', [body(a, 24, 0.99), body(b, 24, 0.99), body(b, 33, 0.99), body(a, 33, 0.99)], N);
      slab(
        'wall',
        [body(a, 24, 0.86), body(b, 24, 0.86), body(b, 24, 0.995), body(a, 24, 0.995)],
        0.5,
      );
      slab(
        'wall',
        [body(a, 35.5, 0.86), body(b, 35.5, 0.86), body(b, 35.5, 0.995), body(a, 35.5, 0.995)],
        0.5,
      );
      bar('wall', body(a, ga - 0.3, 0.985), body(a, arrowheadCrest(a), 0.94), 0.8);
      if (detail > 1) bar('wall', body(a, 24, 0.985), at(0.75, a, 38), 0.55);
    }
  }
  // Curved side press galleries and upturned roof ends, fitted to native side sections.
  for (const side of r.roofSections[detail]) {
    const ps = side.sections;
    for (let i = 0; i < ps.length - 1; i++) {
      const A = ps[i],
        B = ps[i + 1],
        sign = side.sign,
        front = (p) => p.z - sign * 12,
        Y = (x) => 65.2 + 4 * Math.pow(Math.abs(x) / 72, 6),
        top = [
          [A.x, Y(A.x), front(A)],
          [B.x, Y(B.x), front(B)],
          [B.x, Y(B.x), B.z],
          [A.x, Y(A.x), A.z],
        ];
      slab('roof', top, 0.35);
      if (detail) {
        slab(
          'wall',
          [
            [A.x, 61.5, front(A)],
            [B.x, 61.5, front(B)],
            [B.x, 61.5, B.z],
            [A.x, 61.5, A.z],
          ],
          0.35,
        );
        for (const back of [false, true]) {
          const za = back ? A.z : front(A),
            zb = back ? B.z : front(B),
            N = [0, 0, back ? sign : -sign];
          f(
            'glass',
            [
              [A.x, 61.5, za],
              [B.x, 61.5, zb],
              [B.x, 64.2, zb],
              [A.x, 64.2, za],
            ],
            N,
          );
          f(
            'panel',
            [
              [A.x, 64.2, za],
              [B.x, 64.2, zb],
              [B.x, Y(B.x) - 0.35, zb],
              [A.x, Y(A.x) - 0.35, za],
            ],
            N,
          );
        }
        bar('wall', [A.x, A.groundY - F - 0.3, A.z], [A.x, Y(A.x) - 0.35, A.z], 0.65);
        bar('wall', [A.x, 50, A.z], [A.x, 61.15, front(A)], 0.4);
        bar('mark', [A.x, Y(A.x) + 0.18, front(A)], [B.x, Y(B.x) + 0.18, front(B)], 0.24);
        if (i === 0 || i === ps.length - 2) {
          const C = i === 0 ? A : B;
          f(
            'panel',
            [
              [C.x, 61.5, front(C)],
              [C.x, 61.5, C.z],
              [C.x, Y(C.x) - 0.35, C.z],
              [C.x, Y(C.x) - 0.35, front(C)],
            ],
            [i === 0 ? -1 : 1, 0, 0],
          );
        }
        if (i === ps.length - 2)
          bar('wall', [B.x, B.groundY - F - 0.3, B.z], [B.x, Y(B.x) - 0.35, B.z], 0.65);
      }
    }
  }
  if (detail)
    for (const end of r.endSections) {
      const ps = end.sections,
        sign = end.sign;
      for (let i = 0; i < ps.length - 1; i++) {
        const A = ps[i],
          B = ps[i + 1],
          H = (z) => 32 - 5.5 * Math.max(0, (Math.abs(z) - 18) / 12),
          low = Math.max(A.groundY, B.groundY) - F + 1;
        f(
          'glass',
          [
            [A.x * 0.99, low, A.z * 0.99],
            [B.x * 0.99, low, B.z * 0.99],
            [B.x * 0.99, H(B.z), B.z * 0.99],
            [A.x * 0.99, H(A.z), A.z * 0.99],
          ],
          [sign, 0, 0],
        );
      }
    }
  // Four round access towers, open oculi and actual helical circulation surfaces.
  const nc = arrowheadCircleSegments[detail];
  for (const rot of r.rotundas) {
    const c = rot.center,
      outer = circle(c, 13.2, nc),
      inner = circle(c, 4.8, nc),
      low = rot.floorY - F,
      high = 40;
    if (!detail) {
      prism(f, 'wall', { outline: outer, holes: [inner] }, rot.minGround - F - 0.3, high);
      continue;
    }
    const levels = detail === 1 ? [28, 40] : [low, 28, 40];
    for (const y of levels) prism(f, 'wall', { outline: outer, holes: [inner] }, y - 0.45, y);
    for (const [y0, y1] of [
      [low + 0.1, 27.5],
      [28.5, 39.5],
    ])
      for (let i = 0; i < nc; i++) {
        const a = (i * tau) / nc,
          b = ((i + 1) * tau) / nc,
          N = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
          at = (t, y) => [c[0] + 13.1 * Math.cos(t), y, c[1] + 13.1 * Math.sin(t)];
        f('glass', [at(a, y0), at(b, y0), at(b, y1), at(a, y1)], N);
      }
    const posts = detail === 1 ? 4 : 8;
    for (let i = 0; i < posts; i++) {
      const a = (i * tau) / posts,
        p = [c[0] + 12.6 * Math.cos(a), c[1] + 12.6 * Math.sin(a)],
        G = rot.contacts[i * (8 / posts)] - F;
      bar('wall', [p[0], G - 0.3, p[1]], [p[0], 40, p[1]], 0.55);
    }
    if (detail > 1) {
      const count = detail === 3 ? 96 : 32,
        point = (i, R, dy = 0) => {
          const a = (i * tau * 4) / count;
          return [
            c[0] + R * Math.cos(a),
            low + ((high - low) * i) / count + dy,
            c[1] + R * Math.sin(a),
          ];
        };
      for (let i = 0; i < count; i++) {
        slab('wall', [point(i, 3.5), point(i + 1, 3.5), point(i + 1, 11.8), point(i, 11.8)], 0.28);
        if (detail === 3) {
          bar('metal', point(i, 3.5, 1), point(i + 1, 3.5, 1), 0.1);
          if (i % 8 === 0) bar('metal', point(i, 3.5), point(i, 3.5, 1), 0.1);
        }
      }
    }
  }
  // Native layered corner access strips connect the tower and stadium levels.
  for (const ramp of r.access) {
    if (!detail) continue;
    const y = ramp.level === 2 ? 40 : 28;
    prism(f, 'wall', { outline: ramp.outline }, y - 0.35, y);
    for (const i of [0, Math.floor(ramp.outline.length / 2)]) {
      const p = ramp.outline[i];
      bar('wall', [p[0], ramp.contacts[i] - F - 0.3, p[1]], [p[0], y - 0.35, p[1]], 0.6);
    }
    if (detail > 1)
      for (let i = 0; i < ramp.outline.length; i++) {
        const p = ramp.outline[i],
          q = ramp.outline[(i + 1) % ramp.outline.length];
        bar('metal', [p[0], y + 1, p[1]], [q[0], y + 1, q[1]], 0.1);
        bar('metal', [p[0], y, p[1]], [p[0], y + 1, p[1]], 0.1);
      }
  }
  // Two oval end displays, supported from original ground with inward cantilevers.
  const ns = [8, 12, 20, 32][detail];
  for (const sign of [-1, 1]) {
    const point = (i, back = false) => {
      const a = (i * tau) / ns;
      return [sign * (116 + (back ? 1.2 : 0)), 54 + 6 * Math.sin(a), 27 * Math.cos(a)];
    };
    for (let i = 0; i < ns; i++) {
      const a = (i * tau) / ns,
        b = ((i + 1) * tau) / ns;
      f('display', [[sign * 116, 54, 0], point(i), point(i + 1)], [-sign, 0, 0]);
      if (detail) {
        f('panel', [[sign * 117.2, 54, 0], point(i, true), point(i + 1, true)], [sign, 0, 0]);
        f(
          'metal',
          [point(i), point(i, true), point(i + 1, true), point(i + 1)],
          [0, Math.sin((a + b) / 2), Math.cos((a + b) / 2)],
        );
      }
    }
    for (const z of [-20, 20]) {
      const G = r.displayContacts[sign < 0 ? 0 : 1][z < 0 ? 0 : 1] - F;
      bar('wall', [sign * 123, G - 0.3, z], [sign * 123, 53, z], 0.85);
      bar('metal', [sign * 123, 53, z], [sign * 116.6, 54, z], 0.6);
    }
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
      );
    for (const z of [-24.384, 24.384]) paint(0, z, 109.728, 0.12);
    for (let i = -12; i <= 12; i++) paint(i * 4.572, 0, 0.12, 48.768);
    for (const x of [-54.864, 54.864]) paint(x, 0, 0.14, 48.768);
    if (detail === 3)
      for (let i = -49; i <= 49; i++) for (const z of [-9.3, 9.3]) paint(i * 0.9144, z, 0.1, 0.45);
    for (const sign of [-1, 1]) {
      bar('goal', [sign * 58, 0.32, 0], [sign * 58, 3.05, 0], 0.18);
      bar('goal', [sign * 58, 3.05, 0], [sign * 54.864, 3.05, 0], 0.18);
      bar('goal', [sign * 54.864, 3.05, -2.82], [sign * 54.864, 3.05, 2.82], 0.16);
      for (const z of [-2.82, 2.82])
        bar('goal', [sign * 54.864, 3.05, z], [sign * 54.864, 12, z], 0.14);
    }
  }
}
