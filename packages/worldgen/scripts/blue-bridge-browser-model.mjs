/** Blue Bridge's broad short crossing, split vault, blue Moika rail and granite quays. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const MEANS = {
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  glass: [1, 1, 1],
  road: [1, 1, 1],
  marking: [1, 1, 1],
};
const blue = [0.065, 0.31, 0.48],
  light = [0.085, 0.36, 0.54],
  stone = [0.57, 0.445, 0.385],
  A = 7.85,
  W = 47.7;
const road = (x) => 3.25 + 0.2 * (1 - (x / 14.7) ** 2),
  inside = (x) => 0.62 + 2.25 * (1 - (x / A) ** 2);
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}
function band(out, s, z0, z1, lo, hi, c, n) {
  loft(
    out,
    s,
    Array.from({ length: n + 1 }, (_, i) => {
      const x = -A + (2 * A * i) / n;
      return [
        [x, hi(x), z0],
        [x, hi(x), z1],
        [x, lo(x), z1],
        [x, lo(x), z0],
      ];
    }),
    c,
  );
}
function ring(out, cx, cy, z, r, n, color) {
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n,
      p = (t, r) => [cx + r * Math.cos(t), cy + r * Math.sin(t), z];
    const points = [p(a, r), p(b, r), p(b, r - 0.025), p(a, r - 0.025)];
    quad(out, 'iron', points, [0, 0, 1], color);
    quad(out, 'iron', points.toReversed(), [0, 0, -1], color);
  }
}
function build(out, tier) {
  const w = writer(out, tier === 0),
    n = [6, 10, 24, 48][tier],
    wing = [2, 4, 8, 16][tier];
  band(w, 'iron', -W, 7.6, inside, (x) => inside(x) + 0.25, blue, n);
  band(w, 'concrete', 7.6, W, inside, (x) => inside(x) + 0.32, [0.46, 0.45, 0.405], n);
  band(
    w,
    'concrete',
    -W,
    W,
    (x) => inside(x) + 0.25,
    (x) => road(x) - 0.15,
    [0.59, 0.57, 0.52],
    n,
  );
  for (const z of [-W, W])
    band(w, 'iron', z - 0.1, z + 0.1, inside, (x) => road(x) - 0.14, blue, n);
  for (const sign of [-1, 1]) {
    const x0 = sign < 0 ? -14.7 : A,
      x1 = sign < 0 ? -A : 14.7;
    box(w, 'stone', [x0, 0, -W], [x1, 3.1, W], stone);
    for (const side of [-1, 1])
      for (let i = 0; i < wing; i++) {
        const t = i / wing,
          u = (i + 1) / wing,
          p = [sign * (A + 6.85 * t * t), 3.5, side * (W + 9.225 * t)],
          q = [sign * (A + 6.85 * u * u), 3.5, side * (W + 9.225 * u)];
        beam(w, 'stone', p, q, 0.7, 1, stone);
        beam(w, 'stone', [p[0], 1.7, p[2]], [q[0], 1.7, q[2]], 3.4, 1.05, stone);
      }
  }
  for (let i = 0; i < n; i++) {
    const x = -14.7 + (29.4 * i) / n,
      e = -14.7 + (29.4 * (i + 1)) / n;
    quad(
      w,
      'road',
      [
        [x, road(x) + 0.02, -W],
        [x, road(x) + 0.02, W],
        [e, road(e) + 0.02, W],
        [e, road(e) + 0.02, -W],
      ],
      [0, 1, 0],
      [0.13, 0.14, 0.14],
    );
  }
  for (const sign of [-1, 1]) {
    const z = sign * W,
      base = (x) => road(x) + 0.32;
    if (tier === 0) {
      beam(w, 'iron', [-A, 4.3, z], [A, 4.3, z], 0.2, 0.2, blue);
      continue;
    }
    const bays = 8,
      bw = (2 * A) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = -A + bw * i;
      box(w, 'iron', [x - 0.1, base(x), z - 0.09], [x + 0.1, base(x) + 1.05, z + 0.09], blue);
    }
    for (const h of [0.08, 0.82, 1.12])
      for (let i = 0; i < bays; i++) {
        const x = -A + bw * i,
          e = x + bw;
        beam(w, 'iron', [x, base(x) + h, z], [e, base(e) + h, z], 0.06, 0.06, light);
      }
    if (tier > 1) {
      for (let i = 0; i < bays * 2; i++) {
        const cx = -A + (bw / 2) * (i + 0.5),
          cy = base(cx) + 0.48,
          width = bw / 2 - 0.045;
        for (const dx of [-1, 1])
          for (const dy of [-1, 1])
            beam(
              w,
              'iron',
              [cx + (dx * width) / 2, cy + dy * 0.32, z],
              [cx, cy + dy * 0.2, z],
              0.035,
              0.035,
              light,
            );
        quatrefoil(w, cx, cy, z, tier === 2 ? 6 : 12);
      }
      for (let x = -A + 0.2; x < A; x += 0.4)
        ring(w, x, base(x) + 0.975, z, 0.12, tier === 2 ? 6 : 12, light);
    }
    const inner = sign * (W - 2.7);
    for (const h of [0.33, 0.7])
      beam(
        w,
        'iron',
        [-A, road(-A) + 0.17 + h, inner],
        [A, road(A) + 0.17 + h, inner],
        0.05,
        0.05,
        blue,
      );
    for (let x = -A; x <= A; x += A / 4)
      box(
        w,
        'iron',
        [x - 0.065, road(x) + 0.17, inner - 0.065],
        [x + 0.065, road(x) + 1, inner + 0.065],
        blue,
      );
  }
  if (tier > 1) {
    const pitch = tier === 2 ? 8.8 : 4.4;
    for (let z = -W + 0.55; z < 7.6; z += pitch)
      for (let i = 0; i < n; i++) {
        const x = -A + (2 * A * i) / n,
          e = -A + (2 * A * (i + 1)) / n;
        beam(w, 'iron', [x, inside(x) - 0.055, z], [e, inside(e) - 0.055, z], 0.09, 0.09, blue);
      }
  }
  for (const sign of [-1, 1])
    for (const x of [-8.75, 8.75]) {
      const z = sign * 48.4,
        b = 3.86;
      box(w, 'stone', [x - 0.35, 3.25, z - 0.35], [x + 0.35, b, z + 0.35], stone);
      if (tier === 0) {
        box(w, 'iron', [x - 0.12, b, z - 0.12], [x + 0.12, b + 3, z + 0.12], [0.16, 0.18, 0.175]);
        box(
          w,
          'glass',
          [x - 0.27, b + 3, z - 0.27],
          [x + 0.27, b + 3.8, z + 0.27],
          [0.6, 0.68, 0.63],
        );
        continue;
      }
      loft(
        w,
        'iron',
        [
          [0, 0.22],
          [0.5, 0.12],
          [2.7, 0.068],
          [2.99, 0.13],
          [3.12, 0.19],
          [3.72, 0.27],
          [3.9, 0.18],
          [4.2, 0.035],
        ].map(([y, r]) => radialRing(b + y, r, r, tier === 1 ? 4 : 8, [x, z])),
        [0.16, 0.18, 0.175],
      );
      box(
        w,
        'glass',
        [x - 0.18, b + 3.15, z - 0.18],
        [x + 0.18, b + 3.65, z + 0.18],
        [0.6, 0.68, 0.63],
      );
    }
  if (tier > 1) {
    for (let z = -36; z < 38; z += 3) {
      quad(
        w,
        'marking',
        [
          [3, road(3) + 0.035, z],
          [3, road(3) + 0.035, z + 0.07],
          [9, road(9) + 0.035, z + 0.07],
          [9, road(9) + 0.035, z],
        ],
        [0, 1, 0],
        [0.82, 0.83, 0.77],
      );
    }
    beam(w, 'iron', [9.2, 3.6, -51.2], [9.2, 7, -51.2], 0.08, 0.08, blue);
    box(w, 'marking', [8.5, 6.4, -51.25], [9.9, 6.8, -51.15], [0.82, 0.83, 0.77]);
  }
}
function quatrefoil(out, cx, cy, z, steps) {
  const r = 0.14;
  for (const [dx, dy, start] of [
    [r, 0, -Math.PI / 2],
    [0, r, 0],
    [-r, 0, Math.PI / 2],
    [0, -r, Math.PI],
  ])
    for (let i = 0; i < steps; i++) {
      const p = (t, scale) => [
        cx + (dx + r * Math.cos(t)) * scale,
        cy + (dy + r * Math.sin(t)) * scale,
        z,
      ];
      const a = start + (Math.PI * i) / steps,
        b = start + (Math.PI * (i + 1)) / steps;
      const points = [p(a, 1), p(b, 1), p(b, 0.89), p(a, 0.89)];
      quad(out, 'iron', points, [0, 0, 1], light);
      quad(out, 'iron', points.toReversed(), [0, 0, -1], light);
    }
}
export const buildBlueBridgeSkyline = (o) => build(o, 0),
  buildBlueBridgeDistrict = (o) => build(o, 1),
  buildBlueBridgeStreet = (o) => build(o, 2),
  buildBlueBridgeCloseup = (o) => build(o, 3);
