/** Budgeted Kievyan twin vaults and basalt portals; detailed original recipe remains separate. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const MEANS = {
  basalt: [0.9129740140085889, 0.9129740140085889, 0.9129740140085889],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  road: [1, 1, 1],
  marking: [1, 1, 1],
};
const stone = [0.34, 0.352, 0.324],
  concrete = [0.58, 0.58, 0.535],
  iron = [0.1, 0.125, 0.113],
  HALF = 136.152,
  ROAD = 58.3,
  SOFFIT = 56.25;
const bottom = (x) => 5.5 + 48 * (1 - (x / 57.5) ** 2),
  top = (x) => bottom(x) + 2.7 + 1.2 * (x / 57.5) ** 2;
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
function prism(out, s, p, z0, z1, c) {
  let area = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) p = p.toReversed();
  const a = p.map(([x, y]) => [x, y, z0]),
    b = p.map(([x, y]) => [x, y, z1]);
  out.addConvexPolygon(s, 'palette:#ffffff', a.toReversed(), [0, 0, -1], () => [0, 0], c);
  out.addConvexPolygon(s, 'palette:#ffffff', b, [0, 0, 1], () => [0, 0], c);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    quad(out, s, [a[i], a[j], b[j], b[i]], normalFor(a[i], a[j], b[j]), c);
  }
}
function transverse(out, x) {
  const p = ([u, y, v]) => [x + v, y, -u];
  return {
    addQuad(s, r, ps, n, uv, c) {
      out.addQuad(s, r, ps.map(p), [n[2], n[1], -n[0]], uv, c);
    },
    addTriangle(s, r, ps, n, uv, c) {
      out.addTriangle(s, r, ps.map(p), [n[2], n[1], -n[0]], uv, c);
    },
    addConvexPolygon(s, r, ps, n, uv, c) {
      out.addConvexPolygon(s, r, ps.map(p), [n[2], n[1], -n[0]], uv, c);
    },
  };
}
function portal(out, x, low, n) {
  const t = transverse(out, x),
    r = 6.7,
    sy = 46.3;
  for (const [a, b] of [
    [-11.4, -r],
    [r, 11.4],
  ])
    box(t, 'basalt', [a, low, -3], [b, SOFFIT, 3], stone);
  for (let i = 0; i < n; i++) {
    const a = -r * Math.cos((Math.PI * i) / n),
      b = -r * Math.cos((Math.PI * (i + 1)) / n),
      y = (u) => sy + r * Math.sqrt(Math.max(0, 1 - (u / r) ** 2));
    prism(
      t,
      'basalt',
      [
        [a, y(a)],
        [b, y(b)],
        [b, SOFFIT],
        [a, SOFFIT],
      ],
      -3,
      3,
      stone,
    );
  }
}
function build(out, tier) {
  const w = writer(out, tier === 0),
    n = [8, 16, 32, 64][tier],
    pairs =
      tier === 0
        ? [[-11.3, 11.3]]
        : [
            [-11.3, -1],
            [1, 11.3],
          ];
  for (const [z0, z1] of pairs) {
    const rings = Array.from({ length: n + 1 }, (_, i) => {
      const x = -57.5 + (115 * i) / n;
      return [
        [x, bottom(x), z0],
        [x, top(x), z0],
        [x, top(x), z1],
        [x, bottom(x), z1],
      ];
    });
    loft(w, 'concrete', rings, concrete);
    for (const sign of [-1, 1])
      for (const ax of [11.5, 21, 30.5, 40, 49.5]) {
        const x = sign * ax,
          low = Math.min(top(x - 0.6), top(x + 0.6));
        for (const z of [z0 + 0.6, z1 - 0.6])
          box(w, 'concrete', [x - 0.6, low, z - 0.6], [x + 0.6, SOFFIT, z + 0.6], concrete);
        if (tier > 0)
          beam(w, 'concrete', [x, SOFFIT - 0.4, z0], [x, SOFFIT - 0.4, z1], 0.7, 0.7, concrete);
      }
    for (const sign of [-1, 1])
      box(w, 'concrete', [sign * 59 - 4, 0, z0 - 0.7], [sign * 59 + 4, 7.4, z1 + 0.7], concrete);
  }
  for (const [x, low] of [
    [-64, 5],
    [64, 5],
    [-100, 26],
    [100, 26],
  ])
    portal(w, x, low, [4, 6, 12, 24][tier]);
  for (const sign of [-1, 1]) {
    const center = sign * 120,
      lo = sign < 0 ? -HALF : 103,
      hi = sign < 0 ? -103 : HALF,
      r = 5.8,
      cuts = [
        lo,
        hi,
        ...Array.from(
          { length: n / 2 + 1 },
          (_, i) => center - r * Math.cos((Math.PI * i) / (n / 2)),
        ),
      ].sort((a, b) => a - b),
      y = (x) =>
        Math.abs(x - center) < r
          ? 44 + r * Math.sqrt(Math.max(0, 1 - ((x - center) / r) ** 2))
          : 35.5;
    for (let i = 1; i < cuts.length; i++) {
      const a = cuts[i - 1],
        b = cuts[i];
      prism(
        w,
        'basalt',
        [
          [a, y(a + 1e-7)],
          [b, y(b - 1e-7)],
          [b, SOFFIT],
          [a, SOFFIT],
        ],
        -11.4,
        11.4,
        stone,
      );
    }
  }
  box(w, 'concrete', [-HALF, SOFFIT, -12.9], [HALF, ROAD, 12.9], concrete);
  quad(
    w,
    'road',
    [
      [-HALF, ROAD + 0.02, -9.9],
      [-HALF, ROAD + 0.02, 9.9],
      [HALF, ROAD + 0.02, 9.9],
      [HALF, ROAD + 0.02, -9.9],
    ],
    [0, 1, 0],
    [0.11, 0.12, 0.115],
  );
  for (const z of [-12.68, 12.68]) {
    if (tier === 0) {
      beam(w, 'iron', [-HALF, ROAD + 1, z], [HALF, ROAD + 1, z], 0.15, 0.15, iron);
      continue;
    }
    const pitch = tier === 1 ? 16 : 2.8;
    for (let x = -HALF; x < HALF; x += pitch) {
      const end = Math.min(HALF, x + pitch);
      for (const h of [0.18, 1.12])
        beam(w, 'iron', [x, ROAD + h, z], [end, ROAD + h, z], 0.08, 0.08, iron);
      beam(w, 'iron', [x, ROAD + 0.15, z], [x, ROAD + 1.16, z], 0.12, 0.12, iron);
      if (tier >= 2) {
        const cx = (x + end) / 2,
          cy = ROAD + 0.65,
          r = 0.38,
          segments = tier === 2 ? 4 : 12;
        for (let i = 0; i < segments; i++) {
          const a = (i * Math.PI * 2) / segments,
            b = ((i + 1) * Math.PI * 2) / segments,
            p = (q, rad) => [cx + rad * Math.cos(q), cy + rad * Math.sin(q), z];
          quad(w, 'iron', [p(a, r), p(b, r), p(b, r - 0.05), p(a, r - 0.05)], [0, 0, 1], iron);
          quad(w, 'iron', [p(a, r - 0.05), p(b, r - 0.05), p(b, r), p(a, r)], [0, 0, -1], iron);
        }
        if (tier === 3)
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2;
            beam(
              w,
              'iron',
              [cx, cy, z],
              [cx + 0.34 * Math.cos(a), cy + 0.34 * Math.sin(a), z],
              0.04,
              0.04,
              iron,
            );
          }
      }
    }
  }
  if (tier > 1) {
    for (const x of [-126.152, -84, -42, 0, 42, 84, 126.152])
      for (const z of [-11.85, 11.85]) {
        beam(w, 'iron', [x, ROAD, z], [x, ROAD + 7, z], 0.18, 0.18, iron);
        for (const dx of [-1, 1]) {
          beam(w, 'iron', [x, ROAD + 6.4, z], [x + dx * 1.3, ROAD + 7, z], 0.11, 0.11, iron);
          sphere(
            w,
            'marking',
            [x + dx * 1.3, ROAD + 7, z],
            [0.35, 0.4, 0.35],
            [0.9, 0.86, 0.71],
            8,
            4,
          );
        }
      }
    for (let x = -HALF; x < HALF; x += 9)
      for (const z of [-3.3, 3.3])
        quad(
          w,
          'marking',
          [
            [x, ROAD + 0.035, z - 0.075],
            [x, ROAD + 0.035, z + 0.075],
            [Math.min(HALF, x + 4), ROAD + 0.035, z + 0.075],
            [Math.min(HALF, x + 4), ROAD + 0.035, z - 0.075],
          ],
          [0, 1, 0],
          [0.82, 0.82, 0.76],
        );
  }
}
export const buildKievyanSkyline = (o) => build(o, 0),
  buildKievyanDistrict = (o) => build(o, 1),
  buildKievyanStreet = (o) => build(o, 2),
  buildKievyanCloseup = (o) => build(o, 3);
