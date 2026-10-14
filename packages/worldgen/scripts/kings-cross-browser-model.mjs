/** King's Cross far silhouette; closer tiers retain the detailed master through bounded reduction. */
import './install-deterministic-math.mjs';
import { loft, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const TAU = 2 * Math.PI,
  MEANS = {
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    stone: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
  };
const tint = (s, c) => c.map((v, i) => v * (MEANS[s]?.[i] ?? 1));
const P = (x, y, z) => [x + 34, y, z];
const roofY = (r) =>
  r <= 24
    ? Math.sqrt(Math.max(0, 441 - (r - 24) ** 2))
    : r <= 58
      ? -49 + Math.sqrt(4900 - (r - 24) ** 2)
      : -49 + 1.2 * Math.sqrt(4900 - 34 ** 2) - Math.sqrt(196 - (r - 64.8) ** 2);
export function buildKingsCrossSkyline(out) {
  const brick = tint('brick', [0.55, 0.46, 0.31]),
    stone = tint('stone', [0.66, 0.61, 0.49]),
    steel = tint('metal', [0.73, 0.74, 0.7]),
    slate = tint('slate', [0.22, 0.24, 0.25]),
    glass = [0.34, 0.43, 0.48];
  function emit(s, r, p, h, uv, c) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (h && n.reduce((v, x, j) => v + x * h[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      out.addTriangle(
        s,
        r,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        c,
      );
    }
  }
  const o = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]),
    ),
    face = (p, c, h) => emit('wall', 'palette:#ffffff', p, h, null, c);
  for (const cx of [-16.4, 16.4]) {
    box(o, 'wall', P(cx - 15.24, 0, -122), P(cx + 15.24, 6.8, 122), brick);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 12,
        b = ((i + 1) * Math.PI) / 12,
        p = (a, z) => P(cx + 15.47 * Math.cos(a), 6.8 + 15.47 * Math.sin(a), z);
      face(
        [p(a, -122), p(b, -122), p(b, 122), p(a, 122)],
        i >= 5 && i < 7 ? [0.18, 0.23, 0.28] : glass,
        [Math.cos(a), Math.sin(a), 0],
      );
    }
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      face(
        [
          P(cx, 7.2, 124.03),
          P(cx + 14.65 * Math.cos(a), 7.2 + 14.65 * Math.sin(a), 124.03),
          P(cx + 14.65 * Math.cos(b), 7.2 + 14.65 * Math.sin(b), 124.03),
        ],
        glass,
        [0, 0, 1],
      );
      face(
        [
          P(cx + 14.65 * Math.cos(a), 7.2 + 14.65 * Math.sin(a), 124),
          P(cx + 14.65 * Math.cos(b), 7.2 + 14.65 * Math.sin(b), 124),
          P(cx + 14.65 * Math.cos(b), 24.4, 124),
          P(cx + 14.65 * Math.cos(a), 24.4, 124),
        ],
        brick,
        [0, 0, 1],
      );
    }
    box(o, 'wall', P(cx - 15.4, 0, 122), P(cx + 15.4, 7.1, 124), brick);
  }
  for (const x of [-33.3, 0, 33.3])
    box(o, 'wall', P(x - 1.75, 0, 119), P(x + 1.75, x === 0 ? 32.65 : 25, 124.4), brick);
  box(o, 'wall', P(-3.25, 32.3, 117.75), P(3.25, 32.65, 124.25), stone);
  loft(
    o,
    'wall',
    [
      [P(-3.5, 32.65, 117.5), P(3.5, 32.65, 117.5), P(3.5, 32.65, 124.5), P(-3.5, 32.65, 124.5)],
      [
        P(-0.05, 34.4, 120.95),
        P(0.05, 34.4, 120.95),
        P(0.05, 34.4, 121.05),
        P(-0.05, 34.4, 121.05),
      ],
    ],
    slate,
  );
  box(o, 'wall', P(-0.1, 34.4, 120.9), P(0.1, 36, 121.1), stone);
  for (const [a, b] of [
    [-49, -33.8],
    [33.8, 46.8],
  ]) {
    box(o, 'wall', P(a, 0, -120), P(b, 18.4, 122), brick);
    const cx = (a + b) / 2;
    for (const side of [-1, 1])
      face(
        [
          P(cx, 21, -120),
          P(cx, 21, 122),
          P(side < 0 ? a : b, 18.4, 122),
          P(side < 0 ? a : b, 18.4, -120),
        ],
        slate,
        [side, 1, 0],
      );
  }
  const left = (z) => -80 + ((-z - 11) * 28) / 115;
  for (let i = 0; i < 4; i++) {
    const a = i / 4,
      b = (i + 1) / 4,
      p = (u, z) =>
        P(
          left(z) + (-49 - left(z)) * u,
          8 + (-49 - left(z)) * 0.14 * Math.min(u % 0.5, 0.5 - (u % 0.5)) * 4,
          z,
        );
    face([p(a, -121), p(a, -22), p(b, -22), p(b, -121)], slate, [0, 1, 0]);
  }
  box(o, 'wall', P(left(-121), 0, -121), P(-49, 8, -120.5), brick);
  const rs = [3, 14, 24, 44, 58, 69],
    n = 16,
    p = (r, a) => P(-49 - r * Math.cos(a), roofY(r), 51 + r * Math.sin(a));
  for (let j = 0; j < rs.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n,
        b = a + Math.PI / n,
        ps = [p(rs[j], a), p(rs[j + 1], a), p(rs[j + 1], b), p(rs[j], b)];
      face(ps, steel, [0, 1, 0]);
      face(
        ps.map((v) => [v[0], v[1] - 0.04, v[2]]),
        steel,
        [0, -1, 0],
      );
    }
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n,
      b = a + Math.PI / n,
      q = p(65, a),
      Q = p(65, b);
    face(
      [
        [q[0], 0, q[2]],
        [Q[0], 0, Q[2]],
        [Q[0], 6.1, Q[2]],
        [q[0], 6.1, q[2]],
      ],
      glass,
      [-Math.cos(a), 0, Math.sin(a)],
    );
    face([P(-49, 0.07, 51), [q[0], 0.07, q[2]], [Q[0], 0.07, Q[2]]], stone, [0, 1, 0]);
  }
  for (let i = 0; i < 16; i++) {
    const a = (i * TAU) / 16,
      b = ((i + 1) * TAU) / 16;
    face(
      [
        P(0, 29.5, 124.5),
        P(1.68 * Math.cos(a), 29.5 + 1.68 * Math.sin(a), 124.5),
        P(1.68 * Math.cos(b), 29.5 + 1.68 * Math.sin(b), 124.5),
      ],
      stone,
      [0, 0, 1],
    );
  }
}
