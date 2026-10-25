/** Complete bowed stone bridge with a real main vault and four through spandrel arches. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/ww/ww9/anji_bridge/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  C = {
    wall: rgb('bbbfb2'),
    trim: rgb('c9ccbd'),
    deck: rgb('c2c5b9'),
    iron: rgb('4d554e'),
    joint: rgb('949f93'),
  };
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  deck: { slot: 'roof', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  iron: { slot: 'trim', localRef: ref, roughness: 0.91, metallic: 0.4 },
};
const P = plan.parameters,
  a = P.mainSpan / 2,
  rise = P.rise,
  R = (a * a + rise * rise) / (2 * rise),
  cy = rise - R - P.verticalOffset,
  alpha = Math.asin(a / R),
  bottom = -5.25;
const deckY = (x) => P.deckCrownY - P.deckParabola * x * x;
const intrados = (x) => Math.sqrt(Math.max(0, R * R - x * x)) + cy;
const extrados = (x) =>
  Math.max(
    -4.12,
    Math.sqrt(Math.max(0, (R + P.mainRingThickness) * (R + P.mainRingThickness) - x * x)) + cy,
  );
function tri(o, s, ps, hint, col = C[s]) {
  const fp = ps.map((p) => p.map(Math.fround)),
    n = cross(
      fp[1].map((v, i) => v - fp[0][i]),
      fp[2].map((v, i) => v - fp[0][i]),
    );
  // A vertical slice can converge to a native end-corner; emit its one real triangle only.
  if (Math.hypot(...n) < 1e-10) return;
  if (normalFor(...ps).reduce((v, x, i) => v + x * hint[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    col,
  );
}
function Q(o, s, ps, hint, col = C[s]) {
  tri(o, s, [ps[0], ps[1], ps[2]], hint, col);
  tri(o, s, [ps[0], ps[2], ps[3]], hint, col);
}
const sides = [plan.leftSide, plan.rightSide],
  minX = Math.min(...plan.outline.map((p) => p[0])),
  maxX = Math.max(...plan.outline.map((p) => p[0]));
function sideZ(x, side) {
  const r = sides[side];
  for (let i = 1; i < r.length; i++)
    if (x <= r[i][0] + 1e-8) {
      const t = (x - r[i - 1][0]) / (r[i][0] - r[i - 1][0]);
      return r[i - 1][1] + t * (r[i][1] - r[i - 1][1]);
    }
  return r.at(-1)[1];
}
function sidePoint(x, y, side, depth = 0) {
  return [x, y, sideZ(x, side) + (side ? 1 : -1) * depth];
}
function sorted(values) {
  return [...new Set(values.map((v) => Math.round(v * 1e9) / 1e9))].sort((a, b) => a - b);
}
function clipX(poly, value, less = true) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length],
      pa = less ? p[0] <= value : p[0] >= value,
      qa = less ? q[0] <= value : q[0] >= value;
    if (pa) out.push(p);
    if (pa !== qa) {
      const t = (value - p[0]) / (q[0] - p[0]);
      out.push([value, p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}
function sidePanel(o, side, s, outer, holes = [], depth = 0, col = C[s]) {
  const ps = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((n, r) => n + r.length, 0),
    ),
    ix = earcut(ps.flat(), starts),
    bend = sides[side][1][0],
    hint = [0, 0, side ? 1 : -1];
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => ps[j]);
    for (const less of [true, false]) {
      const p = clipX(t, bend, less);
      for (let j = 1; j < p.length - 1; j++)
        tri(
          o,
          s,
          [p[0], p[j], p[j + 1]].map(([x, y]) => sidePoint(x, y, side, depth)),
          hint,
          col,
        );
    }
  }
}
function archAngles(n) {
  return sorted([
    ...Array.from({ length: n + 1 }, (_, i) => -alpha + (2 * alpha * i) / n),
    ...sides.map((s) => Math.asin(s[1][0] / R)),
  ]);
}
function opening(center, width, spring, n) {
  const lo = center - width / 2,
    hi = center + width / 2,
    floor = Array.from({ length: Math.max(3, Math.ceil(n / 2)) + 1 }, (_, i) => {
      const x = lo + ((hi - lo) * i) / Math.max(3, Math.ceil(n / 2));
      return [x, extrados(x) + 0.13];
    }),
    ring = [...floor, [hi, spring]];
  for (let i = 1; i <= n; i++) {
    const t = (Math.PI * i) / n;
    ring.push([center + (Math.cos(t) * width) / 2, spring + (Math.sin(t) * width) / 2]);
  }
  return ring;
}
function allOpenings(d) {
  return [-1, 1].flatMap((sign) =>
    P.reliefOpenings.map((p) => ({
      ...p,
      center: sign * p.center,
      ring: opening(sign * p.center, p.width, p.spring, [4, 6, 12, 24][d]),
    })),
  );
}
function boundaryZ(x) {
  const z = [];
  for (let i = 0; i < plan.outline.length; i++) {
    const p = plan.outline[i],
      q = plan.outline[(i + 1) % plan.outline.length];
    if (x < Math.min(p[0], q[0]) - 1e-7 || x > Math.max(p[0], q[0]) + 1e-7) continue;
    if (Math.abs(p[0] - q[0]) < 1e-8) {
      z.push(p[1], q[1]);
      continue;
    }
    const t = (x - p[0]) / (q[0] - p[0]);
    if (t >= -1e-7 && t <= 1 + 1e-7) z.push(p[1] + t * (q[1] - p[1]));
  }
  return [Math.min(...z), Math.max(...z)];
}
function bridgeBody(o, d, holes) {
  const na = [12, 24, 48, 96][d],
    nt = [16, 28, 56, 112][d],
    angles = archAngles(na),
    arch = angles.map((t) => [R * Math.sin(t), R * Math.cos(t) + cy]);
  for (let side = 0; side < 2; side++) {
    const lo = sides[side][0][0],
      hi = sides[side].at(-1)[0],
      xs = sorted([
        lo,
        hi,
        sides[side][1][0],
        ...Array.from({ length: nt + 1 }, (_, i) => lo + ((hi - lo) * i) / nt),
      ]),
      outer = [
        [lo, bottom],
        [-a, bottom],
        ...arch,
        [a, bottom],
        [hi, bottom],
        ...xs.reverse().map((x) => [x, deckY(x)]),
      ];
    sidePanel(
      o,
      side,
      'wall',
      outer,
      holes.map((h) => h.ring),
    );
    if (d > 0) {
      const outerArc = angles.map((t) => [
        (R + P.mainRingThickness) * Math.sin(t),
        (R + P.mainRingThickness) * Math.cos(t) + cy,
      ]);
      for (let i = 1; i < arch.length; i++)
        sidePanel(o, side, 'trim', [arch[i - 1], arch[i], outerArc[i], outerArc[i - 1]], [], 0.022);
    }
  }
  // The open main intrados is divided into the28real parallel stone ribs in the close model.
  const ribs = [1, 1, 8, P.parallelRibs][d];
  for (let i = 1; i < angles.length; i++) {
    const t0 = angles[i - 1],
      t1 = angles[i],
      x0 = R * Math.sin(t0),
      x1 = R * Math.sin(t1),
      y0 = R * Math.cos(t0) + cy,
      y1 = R * Math.cos(t1) + cy,
      z0 = [sideZ(x0, 0), sideZ(x0, 1)],
      z1 = [sideZ(x1, 0), sideZ(x1, 1)];
    for (let j = 0; j < ribs; j++) {
      const zs = (z, k) => z[0] + ((z[1] - z[0]) * k) / ribs,
        ps = [
          [x0, y0, zs(z0, j)],
          [x0, y0, zs(z0, j + 1)],
          [x1, y1, zs(z1, j + 1)],
          [x1, y1, zs(z1, j)],
        ],
        c =
          d === 3
            ? C.wall.map((v, k) => v * (0.97 + 0.04 * (0.5 + 0.5 * Math.sin(j * 2.1 + k * 0.8))))
            : C.wall;
      Q(o, 'wall', ps, [-(x0 + x1) / 2, -((y0 + y1) / 2 - cy), 0], c);
    }
  }
  // Every small arch is a real full-width tunnel, including the sloping extrados sill.
  for (const hole of holes)
    for (let i = 0; i < hole.ring.length; i++) {
      const p = hole.ring[i],
        q = hole.ring[(i + 1) % hole.ring.length],
        ps = [sidePoint(...p, 0), sidePoint(...p, 1), sidePoint(...q, 1), sidePoint(...q, 0)];
      Q(o, 'wall', ps, [-(q[1] - p[1]), q[0] - p[0], 0]);
    }
  const xs = sorted([
    ...plan.outline.map((p) => p[0]),
    ...Array.from({ length: nt + 1 }, (_, i) => minX + ((maxX - minX) * i) / nt),
  ]);
  for (let i = 1; i < xs.length; i++) {
    const x0 = xs[i - 1],
      x1 = xs[i],
      z0 = boundaryZ(x0),
      z1 = boundaryZ(x1);
    Q(
      o,
      'deck',
      [
        [x0, deckY(x0), z0[0]],
        [x1, deckY(x1), z1[0]],
        [x1, deckY(x1), z1[1]],
        [x0, deckY(x0), z0[1]],
      ],
      [0, 1, 0],
    );
  }
  // Native three-node end sections remain intact; no bank retaining walls are added.
  for (const r of [plan.southwestEnd, plan.northeastEnd])
    for (let i = 1; i < r.length; i++) {
      const p = r[i - 1],
        q = r[i],
        ps = [
          [p[0], bottom, p[1]],
          [q[0], bottom, q[1]],
          [q[0], deckY(q[0]), q[1]],
          [p[0], deckY(p[0]), p[1]],
        ];
      Q(o, 'wall', ps, normalFor(...ps));
    }
  for (const less of [true, false]) {
    const p = clipX(plan.outline, less ? -a : a, less),
      ix = earcut(p.flat());
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        'wall',
        ix.slice(i, i + 3).map((j) => [p[j][0], bottom, p[j][1]]),
        [0, -1, 0],
      );
  }
}
function minorArchRings(o, d, holes) {
  if (d === 0) return;
  const n = [4, 6, 12, 24][d];
  for (let side = 0; side < 2; side++)
    for (const h of holes) {
      const r = h.width / 2,
        t = 0.42;
      for (let i = 0; i < n; i++) {
        const t0 = (Math.PI * i) / n,
          t1 = (Math.PI * (i + 1)) / n,
          xy = (a, r) => [h.center + Math.cos(a) * r, h.spring + Math.sin(a) * r],
          p = [xy(t0, r), xy(t1, r), xy(t1, r + t), xy(t0, r + t)];
        sidePanel(o, side, 'trim', p, [], 0.025);
      }
    }
}
function railSection(side, x, y0, y1, w) {
  const z = sideZ(x, side),
    sign = side ? 1 : -1;
  return [
    [x, y0, z - sign * w],
    [x, y0, z],
    [x, y1, z],
    [x, y1, z - sign * w],
  ];
}
function rail(o, d) {
  for (let side = 0; side < 2; side++) {
    const lo = sides[side][0][0] + 0.45,
      hi = sides[side].at(-1)[0] - 0.45,
      n = [10, 18, 36, 72][d],
      xs = sorted([
        lo,
        hi,
        sides[side][1][0],
        ...Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n),
      ]);
    const layers =
      d === 0
        ? [[0.02, 1.03, 0.35]]
        : [
            [0.02, 0.19, 0.42],
            [0.19, 0.86, 0.31],
            [0.86, 1.02, 0.4],
          ];
    for (const [y0, y1, w] of layers)
      loft(
        o,
        'trim',
        xs.map((x) => railSection(side, x, deckY(x) + y0, deckY(x) + y1, w)),
        C.trim,
      );
    const count = d === 0 ? 1 : d === 1 ? 9 : 18;
    for (let j = 0; j <= count; j++) {
      const x = lo + ((hi - lo) * j) / count,
        y = deckY(x),
        sign = side ? 1 : -1,
        z = sideZ(x, side) - sign * 0.16;
      if (d === 0) {
        loft(
          o,
          'trim',
          [
            [y, 0.23],
            [y + 1.28, 0.17],
          ].map(([yy, r]) => radialRing(yy, r, r, 4, [x, z], Math.PI / 4)),
          C.trim,
        );
        continue;
      }
      const sidesN = d === 1 ? 4 : d === 2 ? 6 : 10,
        levels =
          d === 1
            ? [
                [0.1, 0.22],
                [1.05, 0.14],
                [1.28, 0.18],
              ]
            : [
                [0.1, 0.24],
                [0.25, 0.24],
                [0.32, 0.15],
                [0.85, 0.13],
                [0.95, 0.2],
                [1.03, 0.2],
                [1.12, 0.13],
              ];
      loft(
        o,
        'trim',
        levels.map(([yy, r]) => radialRing(y + yy, r, r, sidesN, [x, z], Math.PI / 4)),
        C.trim,
      );
      if (j % 3 !== 2)
        sphere(
          o,
          'trim',
          [x, y + 1.23, z],
          [0.2, 0.21, 0.2],
          C.trim,
          d === 3 ? 12 : 6,
          d === 3 ? 7 : 3,
        );
      else
        loft(
          o,
          'trim',
          [
            [1.1, 0.13],
            [1.23, 0.17],
            [1.38, 0.1],
            [1.44, 0.08],
          ].map(([yy, r]) => radialRing(y + yy, r, r, sidesN, [x, z])),
          C.trim,
        );
    }
    if (d > 1)
      for (let j = 0; j < count; j++)
        panelCarving(
          o,
          side,
          lo + ((hi - lo) * j) / count,
          lo + ((hi - lo) * (j + 1)) / count,
          d,
          j,
        );
  }
}
function carvingPoint(x, y, side, depth = 0.028) {
  return sidePoint(x, deckY(x) + y, side, depth);
}
function carvingStroke(o, side, points, d, w = 0.035, depth = 0.03) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-5) continue;
    const nx = (-(b[1] - a[1]) * w) / (2 * len),
      ny = ((b[0] - a[0]) * w) / (2 * len),
      q = [
        [a[0] + nx, a[1] + ny],
        [a[0] - nx, a[1] - ny],
        [b[0] - nx, b[1] - ny],
        [b[0] + nx, b[1] + ny],
      ],
      hint = [0, 0, side ? 1 : -1];
    Q(
      o,
      'trim',
      q.map((p) => carvingPoint(...p, side, depth)),
      hint,
      C.wall,
    );
    if (d === 3)
      for (const [k, l] of [
        [0, 3],
        [1, 2],
      ]) {
        const ps = [
          carvingPoint(...q[k], side, 0),
          carvingPoint(...q[l], side, 0),
          carvingPoint(...q[l], side, depth),
          carvingPoint(...q[k], side, depth),
        ];
        Q(o, 'trim', ps, normalFor(...ps), C.wall);
      }
  }
}
function coil(o, side, x, y, r, d, mirror = 1) {
  const n = d === 3 ? 14 : 6,
    ps = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n,
        a = t * Math.PI * 3,
        rr = r * (1 - 0.82 * t);
      return [x + mirror * rr * Math.cos(a), y + rr * Math.sin(a)];
    });
  carvingStroke(o, side, ps, d, 0.025);
}
function panelCarving(o, side, lo, hi, d, variant) {
  const gap = 0.3,
    width = hi - lo - 2 * gap;
  if (width < 0.3) return;
  const a = lo + gap,
    b = hi - gap,
    m = (a + b) / 2,
    n = d === 3 ? 18 : 8,
    ps = Array.from({ length: n + 1 }, (_, j) => {
      const t = j / n;
      return [a + width * t, 0.51 + 0.16 * Math.sin(t * Math.PI * 3 + variant * 0.7)];
    });
  carvingStroke(o, side, ps, d, d === 3 ? 0.04 : 0.055, 0.025);
  if (variant % 3 === 0) {
    const x = b - 0.18,
      y = 0.65,
      p = carvingPoint(x, y, side, 0.055);
    sphere(o, 'trim', p, [0.12, 0.075, 0.05], C.wall, d === 3 ? 10 : 6, 4);
    carvingStroke(
      o,
      side,
      [
        [x - 0.04, y + 0.03],
        [x - 0.13, y + 0.15],
        [x + 0.02, y + 0.1],
      ],
      d,
      0.025,
      0.05,
    );
    for (const t of [0.28, 0.62]) {
      const xx = a + width * t;
      carvingStroke(
        o,
        side,
        [
          [xx, 0.5],
          [xx - 0.12, 0.34],
          [xx + 0.08, 0.29],
        ],
        d,
        0.025,
      );
    }
  } else {
    coil(o, side, m, 0.54, 0.17, d, variant % 2 ? 1 : -1);
  }
  if (d === 3) {
    coil(o, side, a + 0.18, 0.5, 0.13, d);
    coil(o, side, b - 0.18, 0.5, 0.13, d, -1);
  }
}
function solid(x, y, holes) {
  if (y > deckY(x) - 0.05 || y < bottom + 0.1 || (Math.abs(x) < a && y < intrados(x) + 0.04))
    return false;
  for (const h of holes)
    if (Math.abs(x - h.center) < h.width / 2 + 0.02) {
      const yy =
        h.spring +
        Math.sqrt(Math.max(0, (h.width * h.width) / 4 - (x - h.center) * (x - h.center)));
      if (y > extrados(x) + 0.08 && y < yy + 0.04) return false;
    }
  return true;
}
function stoneDetails(o, d, holes) {
  if (d < 2) return;
  const count = d === 2 ? 22 : 46;
  for (let side = 0; side < 2; side++) {
    // Voussoir seams and iron dovetails remain on the real arch material, outside all openings.
    for (let j = 1; j < count; j++) {
      const t = -alpha + (2 * alpha * j) / count,
        x0 = R * Math.sin(t),
        y0 = R * Math.cos(t) + cy,
        x1 = (R + P.mainRingThickness) * Math.sin(t),
        y1 = (R + P.mainRingThickness) * Math.cos(t) + cy;
      if (d === 3) {
        const ps = [
          [x0, y0],
          [x1, y1],
        ];
        for (let k = 1; k < ps.length; k++) {
          const p = ps[k - 1],
            q = ps[k],
            dx = q[0] - p[0],
            dy = q[1] - p[1],
            len = Math.hypot(dx, dy),
            nx = (-dy * 0.006) / len,
            ny = (dx * 0.006) / len;
          sidePanel(
            o,
            side,
            'wall',
            [
              [p[0] + nx, p[1] + ny],
              [q[0] + nx, q[1] + ny],
              [q[0] - nx, q[1] - ny],
              [p[0] - nx, p[1] - ny],
            ],
            [],
            0.031,
            C.joint,
          );
        }
      }
      const r = R + 0.61,
        x = r * Math.sin(t),
        y = r * Math.cos(t) + cy;
      if (solid(x, y, holes))
        sidePanel(
          o,
          side,
          'iron',
          [
            [x - 0.1, y - 0.035],
            [x - 0.03, y - 0.018],
            [x + 0.1, y - 0.035],
            [x + 0.1, y + 0.035],
            [x + 0.03, y + 0.018],
            [x - 0.1, y + 0.035],
          ],
          [],
          0.045,
        );
    }
    if (d !== 3) continue;
    for (let row = 0; row < 15; row++) {
      const y = bottom + 0.45 + row * 0.64;
      for (let x = minX + 0.25; x < maxX - 0.3; x += 1.12) {
        const xx = Math.min(x + 1.06, maxX - 0.3);
        if ([x, xx].every((x) => solid(x, y - 0.02, holes) && solid(x, y + 0.02, holes)))
          sidePanel(
            o,
            side,
            'wall',
            [
              [x, y - 0.006],
              [xx, y - 0.006],
              [xx, y + 0.006],
              [x, y + 0.006],
            ],
            [],
            0.008,
            C.joint,
          );
      }
      for (let x = minX + 0.5 + (row % 2) * 0.55; x < maxX - 0.5; x += 1.12)
        if ([y, y + 0.55].every((y) => solid(x - 0.015, y, holes) && solid(x + 0.015, y, holes)))
          sidePanel(
            o,
            side,
            'wall',
            [
              [x - 0.006, y],
              [x + 0.006, y],
              [x + 0.006, y + 0.55],
              [x - 0.006, y + 0.55],
            ],
            [],
            0.008,
            C.joint,
          );
    }
  }
  if (d === 3) {
    // Twenty-seven actual rib seams run along the main intrados, without building a river slab.
    const angles = archAngles(64);
    for (let j = 1; j < P.parallelRibs; j++)
      for (let i = 1; i < angles.length; i++) {
        const pts = [angles[i - 1], angles[i]].map((t) => {
          const x = R * Math.sin(t),
            y = R * Math.cos(t) + cy,
            z = sideZ(x, 0) + ((sideZ(x, 1) - sideZ(x, 0)) * j) / P.parallelRibs;
          return [x, y - 0.006, z];
        });
        Q(
          o,
          'wall',
          [
            [pts[0][0], pts[0][1], pts[0][2] - 0.007],
            [pts[0][0], pts[0][1], pts[0][2] + 0.007],
            [pts[1][0], pts[1][1], pts[1][2] + 0.007],
            [pts[1][0], pts[1][1], pts[1][2] - 0.007],
          ],
          [0, -1, 0],
          C.joint,
        );
      }
    for (let x = minX + 0.8; x < maxX - 0.8; x += 1.1) {
      const z = boundaryZ(x),
        y = deckY(x) + 0.006;
      Q(
        o,
        'deck',
        [
          [x - 0.007, y, z[0] + 0.5],
          [x + 0.007, y, z[0] + 0.5],
          [x + 0.007, y, z[1] - 0.5],
          [x - 0.007, y, z[1] - 0.5],
        ],
        [0, 1, 0],
        C.joint,
      );
    }
  }
}
function build(o, _frame, d = 3) {
  const holes = allOpenings(d);
  bridgeBody(o, d, holes);
  minorArchRings(o, d, holes);
  rail(o, d);
  stoneDetails(o, d, holes);
}
export const anjiSkyline = (o, f) => build(o, f, 0);
export const anjiDistrict = (o, f) => build(o, f, 1);
export const anjiStreet = (o, f) => build(o, f, 2);
export const anjiBridgeModel = {
  id: 'anji_bridge',
  key: 'anji_bridge',
  recipe: 'structure-anji-bridge.mjs',
  cell: 'ww/ww9',
  title: 'Anji Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native bowed stone bridge/end outline: true37.37m/7.285mcircular segmental main vault,28parallel limestone ribs, four genuine through open-spandrel arches with sloping extrados sills, convex humpback deck, carved solid balustrades/ball and shaped posts, arch-ring joints/iron butterfly cramps and bounded native end abutments. No river, banks, park or replica. Native outline/engineering main arch controls retained; small-arch/ring/rail sections and exact grade/contact are photographic estimates.',
  camera: [42, 22, 55],
  lookAt: [0, 0.2, 0],
  portableGroundY: -5.4,
  mediumFiContext: { scale: 1.9, groundY: -5.4 },
  qaCameras: [
    {
      name: 'main-vault-four-through-relief-arches-and-bowed-outline',
      position: [22, 9, 43],
      lookAt: [0, -0.5, 0],
    },
    {
      name: 'carved-solid-balustrades-shaped-posts-and-deck',
      position: [-25, 8, 15],
      lookAt: [-7, 2.6, 0],
    },
    {
      name: 'twenty-eight-stone-ribs-voussoirs-and-iron-dovetails',
      position: [2, -3.3, 14],
      lookAt: [0, 0.4, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed southwest dry approach[-30,0]/Y0was selected before terrain acquisition. Flat review ground lies below the vault; actual bank/riverbed and footing contact remain approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-anji-bridge.mjs',
    level: 'skyline',
    export: 'anjiSkyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'anjiDistrict', errorMeters: 0.3, surfaces },
      street: { export: 'anjiStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'All8native plan vertices and the two bowed sides/flared ends are retained. Actual structural extent is about54m in mapping, consistent with ASCEabout50.9mstructural length plus mapped end transitions. The broader64mstory length is not used to stretch the native bridge or adopt adjoining riverbank walls. Native widths are mapping estimates, not an independent survey.',
    'ASCE122.6ftmain span/23.9ftrise/28parallel limestone ribs guide a genuine circular segmental vault. Ring1.12m, deckcrown4.8mabove southwest approach, small arch spans3.0/4.8m and levels, balustrade sections/post forms, footings and crossfall are original medium-fi photographic estimates. All4subsidiary arches are true full-width tunnels with sills following the main extrados.',
    'Exact2272x1704cleared published QuallaZhao1974PublicDomainexterior and native named PD-user dedication have been inspected and bound. The misleadingCC0crop has an explicitCCBYSA3.0Panoramioparent and is excluded; museum replica and other licensed/unknown sources unused. ASCEpage supplies numeric/structural text facts only; no ASCEphotograph or image texture used.',
    'Carved dragon/cloud/vine balustrade relief, ball/shaped caps, voussoir/course/rib seams and small iron dovetails are bounded original geometry. Exact restoration date, panel iconography, individual stone ages, irregular erosion/lichen and fine inscriptions are approximated or omitted. Delicate carving/seams and exact28rib division retire progressively with viewing distance.',
    'Fixed southwest approach[-30,0]/modelY0was chosen before sampling. Main springing is near-4.5m and footings reach-5.25m; riverbed/bank/water and precise original foundations are not reconstructed. Host terrain contact remains unverified, source relief is retained without fitted ground/river slabs, and unrelated park/secondary bridge/boats/visitors are excluded.',
  ],
};
