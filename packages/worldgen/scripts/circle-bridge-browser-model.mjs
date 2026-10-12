/** Compact closed-state Cirkelbroen; preserved platform positions and exterior arc clipping. */
import './install-deterministic-math.mjs';
import { beam, cross, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const tau = Math.PI * 2;
const white = [0.9, 0.91, 0.87];
const red = [0.67, 0.18, 0.115];
const wood = [0.29, 0.13, 0.066];
const stainless = [0.64, 0.68, 0.68];
const deck = [0.77, 0.69, 0.52];
const deckY = 2.8;
// Names follow Ramboll's 2012 plan. Centers fit the exact-QID OSM outline;
// radii add the white outboard flange missing from that approximate mapped edge.
// Heights/count allocation are photographic reconstructions, not fabrication measurements.
const circlePlatforms = [
  { name: 'P1', x: -14.348, z: 4.347, r: 4.7, mast: 17.2, stays: 22, end: -1 },
  { name: 'P2', x: -9.451, z: -2.345, r: 6.0, mast: 22.2, stays: 25 },
  { name: 'P3', x: 0.608, z: -2.476, r: 6.65, mast: 22, stays: 27 },
  { name: 'P4', x: 7.19, z: 4.26, r: 4.9, mast: 14.7, stays: 22 },
  { name: 'P5', x: 14.195, z: 0.425, r: 5.0, mast: 17.2, stays: 22, end: 1 },
];
const point = (c, radius, angle, y) => [
  c.x + radius * Math.cos(angle),
  y,
  c.z + radius * Math.sin(angle),
];
const arcRing = (c, radius, y, sides = 192) => radialRing(y, radius, radius, sides, [c.x, c.z]);
/** Clip one convex platform to its radical half-planes: no overlapping coplanar decks. */
function clippedDisc(c, n) {
  let points = arcRing(c, c.r, deckY, n).map(([x, , z]) => [x, z]);
  for (const other of circlePlatforms) {
    if (other === c || Math.hypot(c.x - other.x, c.z - other.z) >= c.r + other.r) continue;
    const dx = other.x - c.x,
      dz = other.z - c.z,
      limit = (other.x ** 2 + other.z ** 2 - c.x ** 2 - c.z ** 2 + c.r ** 2 - other.r ** 2) / 2;
    const next = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const da = a[0] * dx + a[1] * dz - limit,
        db = b[0] * dx + b[1] * dz - limit;
      if (da <= 0) next.push(a);
      if (da < 0 !== db < 0) {
        const t = da / (da - db);
        next.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    points = next;
  }
  return points;
}

/** Analytic exposed arcs, with real gaps at platform junctions and the two shore entrances. */
function exposedArcs(c, inset = 0) {
  const r = c.r - inset,
    cuts = [0, tau];
  for (const other of circlePlatforms) {
    if (other === c) continue;
    const dx = other.x - c.x,
      dz = other.z - c.z,
      d = Math.hypot(dx, dz),
      r2 = other.r - inset;
    if (d >= r + r2 || d <= Math.abs(r - r2)) continue;
    const direction = Math.atan2(dz, dx),
      half = Math.acos((d * d + r * r - r2 * r2) / (2 * d * r));
    for (const a of [direction - half, direction + half]) cuts.push((a + tau) % tau);
  }
  if (c.end) {
    const half = Math.asin(1.5 / r),
      angle = c.end < 0 ? Math.PI : 0;
    for (const a of [angle - half, angle + half]) cuts.push((a + tau) % tau);
  }
  cuts.sort((a, b) => a - b);
  return cuts.slice(1).flatMap((b, i) => {
    const a = cuts[i],
      mid = (a + b) / 2,
      p = point(c, r, mid, 0);
    if (
      circlePlatforms.some(
        (o) => o !== c && Math.hypot(p[0] - o.x, p[2] - o.z) < o.r - inset - 1e-6,
      )
    )
      return [];
    if (c.end && c.end * Math.cos(mid) > 0 && Math.abs(r * Math.sin(mid)) < 1.5) return [];
    return [[a, b]];
  });
}

const MEANS = {
  iron: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  steel: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  timber: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
};
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
function line(out, slot, p, r, color, tier) {
  for (let i = 1; i < p.length; i++) {
    if (tier < 2) beam(out, slot, p[i - 1], p[i], r * 2, r * 2, color);
    else tube(out, slot, p[i - 1], p[i], r, color, tier === 2 ? 4 : 6);
  }
}
function thinRibbon(out, slot, a, b, width, color) {
  const axis = b.map((v, i) => v - a[i]),
    across = [axis[1], -axis[0], 0],
    len = Math.hypot(...across) || 1,
    offset = across.map((v) => ((v / len) * width) / 2),
    p = [
      a.map((v, i) => v - offset[i]),
      b.map((v, i) => v - offset[i]),
      b.map((v, i) => v + offset[i]),
      a.map((v, i) => v + offset[i]),
    ];
  quad(out, slot, p, normalFor(...p), color);
  quad(out, slot, p.toReversed(), normalFor(...p.toReversed()), color);
}
function build(target, tier) {
  const out = writer(target, tier === 0),
    sides = [8, 16, 32, 64][tier],
    column = [4, 6, 12, 20][tier];
  for (const c of circlePlatforms) {
    const poly = clippedDisc(c, sides),
      bottom = poly.map(([x, z]) => [
        x,
        2 + 0.52 * Math.min(1, Math.hypot(x - c.x, z - c.z) / c.r),
        z,
      ]);
    out.addConvexPolygon(
      'concrete',
      'palette:#ffffff',
      poly.map(([x, z]) => [x, deckY, z]),
      [0, 1, 0],
      null,
      deck,
    );
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length,
        p = [[c.x, 2, c.z], bottom[j], bottom[i]];
      out.addTriangle('iron', 'palette:#ffffff', p, normalFor(...p), null, white);
      const q = [
        bottom[i],
        bottom[j],
        [poly[j][0], deckY, poly[j][1]],
        [poly[i][0], deckY, poly[i][1]],
      ];
      quad(out, 'iron', q, normalFor(...q), white);
    }
    const levels =
      tier < 2
        ? [
            [-2.6, 0.44],
            [0.9, 0.48],
            [1.99, 1.72],
          ]
        : [
            [-2.6, 0.44],
            [0.9, 0.48],
            [1.38, 0.58],
            [1.65, 0.8],
            [1.99, 1.72],
          ];
    loft(
      out,
      'iron',
      levels.map(([y, r]) => arcRing(c, r, y, column)),
      white,
    );
    const top = deckY + c.mast,
      hubY = top - 0.32,
      ringY = deckY + c.mast * 0.72,
      ringR = c.r * 0.315;
    loft(out, 'iron', [arcRing(c, 0.15, deckY, column), arcRing(c, 0.1, top, column)], white);
    if (tier > 0) {
      line(
        out,
        'iron',
        Array.from({ length: [0, 9, 17, 33][tier] }, (_, i) =>
          point(c, ringR, (i / [0, 8, 16, 32][tier]) * tau, ringY),
        ),
        0.022,
        white,
        tier,
      );
      loft(
        out,
        'iron',
        [arcRing(c, 0.25, deckY + 0.015, column), arcRing(c, 0.25, deckY + 0.065, column)],
        white,
      );
    }
    const arcs = exposedArcs(c, 0.04),
      arcLength = arcs.reduce((n, [a, b]) => n + b - a, 0),
      stays = tier === 0 ? 4 : tier === 1 ? 6 : tier === 2 ? 14 : c.stays;
    for (let j = 0; j < stays; j++) {
      let t = ((j + 0.5) / stays) * arcLength,
        angle = arcs[0][0];
      for (const [a, b] of arcs) {
        if (t <= b - a) {
          angle = a + t;
          break;
        }
        t -= b - a;
      }
      const foot = point(c, c.r - 0.09, angle, deckY + 0.11),
        mid = point(c, ringR, angle, ringY),
        tip = point(c, 0.34, angle, hubY);
      if (tier === 0) {
        thinRibbon(out, 'steel', foot, mid, 0.015, stainless);
        thinRibbon(out, 'steel', mid, tip, 0.015, stainless);
      } else line(out, 'steel', [foot, mid, tip], 0.005, stainless, tier);
      if (tier === 3) {
        line(
          out,
          'steel',
          [foot, foot.map((v, i) => v + (mid[i] - v) * 0.033)],
          0.018,
          stainless,
          tier,
        );
        box(
          out,
          'iron',
          [foot[0] - 0.045, deckY, foot[2] - 0.045],
          [foot[0] + 0.045, deckY + 0.04, foot[2] + 0.045],
          white,
        );
      }
    }
    for (const [a, b] of exposedArcs(c, 0.26)) {
      const n = Math.max(2, Math.ceil(((b - a) * c.r) / [4, 3.2, 0.75, 0.3][tier])),
        base = (t) => point(c, c.r - 0.26, a + (b - a) * t, deckY + 0.07),
        top = (t) => point(c, c.r - 0.68, a + (b - a) * t, deckY + 1.17);
      for (let i = 0; i < n; i++) {
        const t = i / n,
          u = (i + 1) / n;
        if (tier === 0) {
          const p = [base(t), base(u), top(u), top(t)];
          quad(out, 'iron', p, normalFor(...p), red);
          quad(out, 'iron', p.toReversed(), normalFor(...p.toReversed()), red);
          continue;
        }
        beam(out, 'timber', top(t), top(u), 0.135, 0.07, wood);
        line(out, 'iron', [base(t), base(u)], 0.02, red, tier);
        if (tier === 1) {
          line(out, 'iron', [base(t), top(t)], 0.016, red, tier);
          continue;
        }
        for (const shift of [-1, 1])
          line(
            out,
            'iron',
            [base(t), top(Math.max(0, Math.min(n, i + shift)) / n)],
            0.012,
            red,
            tier,
          );
        if (tier === 3)
          line(
            out,
            'steel',
            [
              top(t).map((v, j) => v - (j === 1 ? 0.048 : 0)),
              top(u).map((v, j) => v - (j === 1 ? 0.048 : 0)),
            ],
            0.011,
            [0.86, 0.82, 0.67],
            tier,
          );
      }
      if (tier > 0) for (const t of [0, 1]) line(out, 'iron', [base(t), top(t)], 0.016, red, tier);
    }
  }
  // The source describes the closed assembly; long quay ramps and opening animation are separate.
  for (const c of circlePlatforms.filter((p) => p.end)) {
    const x0 = c.x + c.end * Math.sqrt(c.r ** 2 - 1.5 ** 2),
      x1 = x0 + c.end * 1.4,
      a = Math.min(x0, x1),
      b = Math.max(x0, x1);
    box(out, 'iron', [a, deckY - 0.17, c.z - 1.5], [b, deckY - 0.006, c.z + 1.5], white);
    quad(
      out,
      'concrete',
      [
        [a, deckY + 0.003, c.z - 1.47],
        [a, deckY + 0.003, c.z + 1.47],
        [b, deckY + 0.003, c.z + 1.47],
        [b, deckY + 0.003, c.z - 1.47],
      ],
      [0, 1, 0],
      deck,
    );
    if (tier > 0)
      for (const side of [-1, 1]) {
        const z = c.z + side * 1.5;
        line(
          out,
          'steel',
          [
            [x1, deckY, z],
            [x1, deckY + 1.15, z],
            [x0, deckY + 1.15, z],
          ],
          0.033,
          stainless,
          tier,
        );
      }
  }
  if (tier > 1) {
    const p = circlePlatforms[2];
    loft(
      out,
      'iron',
      [
        [-2.72, 1.1],
        [-1.1, 1.1],
        [-0.12, 0.47],
      ].map(([y, r]) => arcRing(p, r, y, column)),
      white,
    );
    const floats = [
      [-1, -4.4],
      [8.5, 2.3],
      [14.8, -0.9],
      [14.4, 1.6],
      [7.2, 6],
      [-1, -0.5],
    ];
    loft(
      out,
      'iron',
      [-2.7, -1.15].map((y) => floats.toReversed().map(([x, z]) => [x, y, z])),
      [0.23, 0.27, 0.27],
    );
  }
}
export const buildCircleSkyline = (o) => build(o, 0),
  buildCircleDistrict = (o) => build(o, 1),
  buildCircleStreet = (o) => build(o, 2),
  buildCircleCloseup = (o) => build(o, 3);
