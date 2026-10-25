/** 'casale_main': the mapped main villa/baths, with its genuine open peristyle. */
import './install-deterministic-math.mjs';
import { createRequire } from 'node:module';
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

const pc = createRequire(new URL('../../terrain/package.json', import.meta.url))(
  'polygon-clipping',
);
const rect = (x0, z0, x1, z1) => [
  [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
];
const clean = (p) => ({ outline: p[0].slice(0, -1), holes: p.slice(1).map((h) => h.slice(0, -1)) });
function cap(f, role, p, height, up = true) {
  const rings = [p.outline, ...p.holes],
    points = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(n);
    n += h.length;
  }
  const ix = earcut(points.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    f(
      role,
      ix
        .slice(i, i + 3)
        .map((k) => [
          points[k][0],
          typeof height === 'function' ? height(points[k]) : height,
          points[k][1],
        ]),
      [0, up ? 1 : -1, 0],
    );
}
function roofShell(f, role, p, height, detail, adjacent) {
  cap(f, role, p, height);
  cap(f, role, p, (q) => height(q) - 0.14, false);
  if (!detail) return;
  for (const ring of [p.outline, ...p.holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        area = ring.reduce(
          (s, p, i) =>
            s + p[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * p[1],
          0,
        ),
        sign = Math.sign(area) * (ring === p.outline ? 1 : -1),
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [((b[1] - a[1]) * sign) / length, 0, ((a[0] - b[0]) * sign) / length];
      f(
        role,
        [
          [a[0], height(a) - 0.14, a[1]],
          [b[0], height(b) - 0.14, b[1]],
          [b[0], height(b), b[1]],
          [a[0], height(a), a[1]],
        ],
        n,
      );
      const point = [(a[0] + b[0]) / 2 + n[0] * 0.003, (a[1] + b[1]) / 2 + n[2] * 0.003],
        other = adjacent?.(point);
      if (other) {
        const a0 = other(a),
          b0 = other(b),
          a1 = height(a) - 0.14,
          b1 = height(b) - 0.14;
        if (Math.max(a1 - a0, b1 - b0) > 0.15 && Math.min(a1 - a0, b1 - b0) > -0.02)
          f(
            'wall',
            [
              [a[0], a0, a[1]],
              [b[0], b0, b[1]],
              [b[0], Math.max(b0, b1), b[1]],
              [a[0], Math.max(a0, a1), a[1]],
            ],
            n,
          );
      }
    }
}
const floorAbsolute = ([x, z]) =>
  x < -43
    ? 543.2
    : x < -24
      ? 544.2
      : x >= 25 && z >= -9 && z <= 11
        ? 551
        : x >= 25
          ? 549.2
          : x >= 17
            ? 548
            : z < -17
              ? 547.4
              : 545.5;
export function casaleWorkingRoof([x, z], datum, region = [x, z]) {
  const floor = floorAbsolute(region) - datum,
    [rx, rz] = region;
  if (rx < -43) return floor + 4.3 + 2.2 * Math.max(0, 1 - Math.abs(z + 33) / 11);
  if (rx < -24) return floor + 4.4 + 1.3 * Math.max(0, 1 - Math.abs(x + 34) / 12);
  if (rx >= 25 && rz >= -9 && rz <= 11) {
    const t = x > 49 ? Math.hypot((x - 49) / 8, (z - 1) / 10) : Math.abs(z - 1) / 10;
    return floor + 6 + 3 * Math.max(0, 1 - t);
  }
  if (rx >= 25) return floor + 4.4 + 1.7 * Math.max(0, 1 - Math.abs(x - 34) / 13);
  if (rx >= 17) return floor + 4.1 + 1.8 * Math.max(0, 1 - Math.abs(x - 21) / 4);
  if (rz < -17) return floor + 4 + 1.6 * Math.max(0, 1 - Math.abs(z + 23) / 10);
  if (rz > 17) return floor + 3.8 + 1.5 * Math.max(0, 1 - Math.abs(z - 24) / 11);
  return floor + 3.5 + 0.19 * Math.max(Math.abs(x) - 12.9, Math.abs(z) - 8.6, 0);
}
function ring(radius, x, z, n = 8, phase = Math.PI / 8) {
  return Array.from({ length: n }, (_, i) => [
    x + radius * Math.cos(phase + (i * 2 * Math.PI) / n),
    z + radius * Math.sin(phase + (i * 2 * Math.PI) / n),
  ]);
}

export function buildCasaleMain(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    F = (p) => floorAbsolute(p) - r.datumMeters,
    roof = (p) => casaleWorkingRoof(p, r.datumMeters),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d),
    main = r.floors[0],
    occupied = [[main.outline, ...main.holes]],
    cx = r.redRoof.center[0],
    cz = r.redRoof.center[1],
    red = ring(r.redRoof.radius, cx, cz),
    glass = ring(r.redRoof.glassRadius, cx, cz),
    redParts = pc.intersection(occupied, [[red]]),
    roofed = pc.difference(occupied, [[red]]),
    xs = detail ? [-80, -43, -34, -24, 17, 21, 25, 34, 49, 65] : [-80, -43, -24, 17, 25, 65],
    zs = detail ? [-50, -33, -23, -17, -9, 1, 11, 17, 24, 45] : [-50, -17, 17, 45];
  const insideRing = (p, ring) => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i],
          b = ring[j];
        if (
          a[1] > p[1] !== b[1] > p[1] &&
          p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
        )
          hit = !hit;
      }
      return hit;
    },
    inBuilding = (p) => insideRing(p, main.outline) && !main.holes.some((h) => insideRing(p, h)),
    redHeight = (p) =>
      544.2 - r.datumMeters + 4.8 + 0.1 * (r.redRoof.radius - Math.hypot(p[0] - cx, p[1] - cz)),
    adjacent = (p) =>
      !inBuilding(p) || insideRing(p, glass)
        ? undefined
        : insideRing(p, red)
          ? redHeight
          : (q) => casaleWorkingRoof(q, r.datumMeters, p);
  // Floor terraces are genuine model-owned coverage; the garden hole remains unfilled.
  if (detail) {
    const fx = [-80, -43, -24, 17, 25, 65],
      fz = [-50, -17, -9, 11, 17, 45];
    for (let i = 0; i < fx.length - 1; i++)
      for (let j = 0; j < fz.length - 1; j++) {
        const y = F([(fx[i] + fx[i + 1]) / 2, (fz[j] + fz[j + 1]) / 2]);
        for (const p of pc
          .intersection(occupied, [rect(fx[i], fz[j], fx[i + 1], fz[j + 1])])
          .map(clean)) {
          prism(
            (role, ps, n) => {
              if (n[1] > 0.5) return;
              f(role, ps, n);
            },
            'stone',
            p,
            r.foundationY,
            y,
          );
          cap(f, 'floor', p, y);
        }
      }
  } else cap(f, 'stone', main, r.floorY - 0.12);
  // Closed perimeter walls follow the mapped apses. Higher shelter divisions are approximate.
  const outer = [];
  for (let i = 0; i < main.outline.length; i++) {
    const a = main.outline[i],
      b = main.outline[(i + 1) % main.outline.length],
      times = [0],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    if (detail) {
      for (const [axis, cuts] of [
        [0, xs],
        [1, zs],
      ])
        for (const v of cuts) {
          const den = b[axis] - a[axis];
          if (Math.abs(den) > 1e-8) {
            const t = (v - a[axis]) / den;
            if (t > 1e-7 && t < 1 - 1e-7) times.push(t);
          }
        }
      for (let j = 0; j < red.length; j++) {
        const u = red[j],
          v = red[(j + 1) % red.length],
          ex = v[0] - u[0],
          ez = v[1] - u[1],
          den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-8) continue;
        const t = ((u[0] - a[0]) * ez - (u[1] - a[1]) * ex) / den,
          w = ((u[0] - a[0]) * dz - (u[1] - a[1]) * dx) / den;
        if (t > 1e-7 && t < 1 - 1e-7 && w >= 0 && w <= 1) times.push(t);
      }
    }
    times.sort((a, b) => a - b);
    let last = -1;
    for (const t of times)
      if (t - last > 1e-7) {
        outer.push([a[0] + dx * t, a[1] + dz * t]);
        last = t;
      }
  }
  const area = outer.reduce(
      (n, p, i) =>
        n + p[0] * outer[(i + 1) % outer.length][1] - outer[(i + 1) % outer.length][0] * p[1],
      0,
    ),
    sgn = Math.sign(area);
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(b[1] - a[1]) * sgn, 0, (a[0] - b[0]) * sgn];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      top = (p) =>
        detail
          ? insideRing(mid, red)
            ? redHeight(p)
            : casaleWorkingRoof(p, r.datumMeters, mid)
          : roof(p),
      floor = F(mid),
      stoneTop = floor + 1.3;
    if (!detail) {
      f(
        'wall',
        [
          [a[0], r.foundationY, a[1]],
          [b[0], r.foundationY, b[1]],
          [b[0], roof(b), b[1]],
          [a[0], roof(a), a[1]],
        ],
        n,
      );
      continue;
    }
    f(
      'stone',
      [
        [a[0], r.foundationY, a[1]],
        [b[0], r.foundationY, b[1]],
        [b[0], stoneTop, b[1]],
        [a[0], stoneTop, a[1]],
      ],
      n,
    );
    f(
      'wall',
      [
        [a[0], stoneTop, a[1]],
        [b[0], stoneTop, b[1]],
        [b[0], top(b) - 0.14, b[1]],
        [a[0], top(a) - 0.14, a[1]],
      ],
      n,
    );
    if (detail > 1 && length > 3.2)
      for (let k = 0; k < Math.floor(length / 3.4); k++) {
        const t = (k + 0.5) / Math.floor(length / 3.4),
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t,
          nn = [n[0] / length, n[2] / length],
          u = [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
          y = Math.min(roof([x, z]) - 0.9, stoneTop + 1.1);
        f(
          'glass',
          [
            [-0.58, 0],
            [0.58, 0],
            [0.58, 0.48],
            [-0.58, 0.48],
          ].map(([q, h]) => [x + u[0] * q + nn[0] * 0.018, y + h, z + u[1] * q + nn[1] * 0.018]),
          n,
        );
      }
  }
  // Independently sealed roof sheets; every piece is clipped to the actual occupied footprint.
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < zs.length - 1; j++) {
      for (const p of pc
        .intersection(roofed, [rect(xs[i], zs[j], xs[i + 1], zs[j + 1])])
        .map(clean)) {
        const mid = [(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2];
        roofShell(
          f,
          mid[0] >= 25 && mid[1] > -9 && mid[1] < 11 ? 'copper' : 'roof',
          p,
          detail ? (q) => casaleWorkingRoof(q, r.datumMeters, mid) : roof,
          detail,
          adjacent,
        );
      }
    }
  // The red bath roof and faceted skylight are separate visible surfaces, not a painted roof square.
  for (const p of pc.difference(redParts, [[glass]]).map(clean))
    roofShell(f, 'redroof', p, redHeight, detail, adjacent);
  const skylightBase = 544.2 - r.datumMeters + 5.25,
    skylightTop = skylightBase + 2.0;
  for (let i = 0; i < glass.length; i++) {
    const a = glass[i],
      b = glass[(i + 1) % glass.length];
    f(
      'glass',
      [
        [a[0], skylightBase, a[1]],
        [b[0], skylightBase, b[1]],
        [cx, skylightTop, cz],
      ],
      [0, 1, 0],
    );
    if (detail > 1) {
      const dx = cx - a[0],
        dz = cz - a[1],
        len = Math.hypot(dx, dz),
        w = 0.045;
      f(
        'wood',
        [
          [a[0] - (dz / len) * w, skylightBase + 0.025, a[1] + (dx / len) * w],
          [a[0] + (dz / len) * w, skylightBase + 0.025, a[1] - (dx / len) * w],
          [cx + (dz / len) * w, skylightTop + 0.025, cz - (dx / len) * w],
          [cx - (dz / len) * w, skylightTop + 0.025, cz + (dx / len) * w],
        ],
        [0, 1, 0],
      );
    }
  }
  // Open portico: thirty-two near columns, fewer silhouette supports only at skyline distance.
  const court = main.holes[0],
    posts = [];
  for (let e = 0; e < 4; e++) {
    const a = court[e],
      b = court[(e + 1) % 4],
      count = e % 2 === 0 ? 7 : 11;
    for (let j = 0; j < count - 1; j++) {
      const t = j / (count - 1),
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      if (detail === 0 && j !== 0 && j !== Math.floor((count - 1) / 2)) continue;
      posts.push([x, z]);
    }
  }
  const sides = detail === 0 ? 4 : detail === 1 ? 4 : detail === 2 ? 8 : 12;
  for (const [x, z] of posts) {
    const profile =
      detail < 2
        ? [
            [0, 0.34],
            [3.1, 0.26],
            [3.35, 0.39],
          ]
        : detail === 2
          ? [
              [0, 0.43],
              [0.18, 0.43],
              [0.28, 0.31],
              [3.0, 0.25],
              [3.25, 0.4],
              [3.4, 0.4],
            ]
          : [
              [0, 0.47],
              [0.12, 0.47],
              [0.18, 0.39],
              [0.27, 0.39],
              [0.35, 0.31],
              [2.96, 0.25],
              [3.06, 0.32],
              [3.18, 0.4],
              [3.4, 0.4],
            ];
    for (let j = 1; j < profile.length; j++)
      for (let k = 0; k < sides; k++) {
        const a = (k * 2 * Math.PI) / sides,
          b = ((k + 1) * 2 * Math.PI) / sides,
          lo = profile[j - 1],
          hi = profile[j];
        f(
          'column',
          [
            [x + lo[1] * Math.cos(a), r.floorY + lo[0], z + lo[1] * Math.sin(a)],
            [x + lo[1] * Math.cos(b), r.floorY + lo[0], z + lo[1] * Math.sin(b)],
            [x + hi[1] * Math.cos(b), r.floorY + hi[0], z + hi[1] * Math.sin(b)],
            [x + hi[1] * Math.cos(a), r.floorY + hi[0], z + hi[1] * Math.sin(a)],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
    if (detail > 1) {
      B('stone', x, r.floorY - 0.16, z, 1.0, 0.16, 1.0);
      B('wood', x, r.floorY + 3.4, z, 0.85, 0.19, 0.85);
    }
  }
  if (detail) {
    // Timber longitudinal beams and rafters remain behind the real open column bays.
    for (const z of [-8.7, 8.65]) B('wood', 0, r.floorY + 3.38, z, 26.7, 0.2, 0.24);
    for (const x of [-12.9, 12.9]) B('wood', x, r.floorY + 3.38, 0, 0.24, 0.2, 17.7);
    for (const z of [-13.8, 13.8]) B('wall', 0, r.floorY, z, 36.3, 3.35, 0.45);
    for (const x of [-18.1, 18.1]) B('wall', x, r.floorY, 0, 0.45, 3.35, 27.3);
    for (const [a, b, n] of [
      [
        [-18.1, -13.8],
        [18.1, -13.8],
        [0, 0, 1],
      ],
      [
        [18.1, 13.8],
        [-18.1, 13.8],
        [0, 0, -1],
      ],
      [
        [-18.1, 13.8],
        [-18.1, -13.8],
        [1, 0, 0],
      ],
      [
        [18.1, -13.8],
        [18.1, 13.8],
        [-1, 0, 0],
      ],
    ]) {
      for (let i = 0; i < 20; i++) {
        const p = a.map((v, k) => v + ((b[k] - v) * i) / 20),
          q = a.map((v, k) => v + ((b[k] - v) * (i + 1)) / 20),
          lo = r.floorY + 3.35;
        f(
          'wall',
          [
            [p[0], lo, p[1]],
            [q[0], lo, q[1]],
            [q[0], Math.max(lo, roof(q) - 0.14), q[1]],
            [p[0], Math.max(lo, roof(p) - 0.14), p[1]],
          ],
          n,
        );
      }
    }
    if (detail > 1)
      for (const [x, z] of posts) {
        const alongX = Math.abs(x) > 12.5,
          sign = alongX ? Math.sign(x) : Math.sign(z);
        B(
          'wood',
          x + (alongX ? sign * 2.3 : 0),
          r.floorY + 3.45,
          z + (!alongX ? sign * 2.3 : 0),
          alongX ? 4.6 : 0.12,
          0.16,
          alongX ? 0.12 : 4.6,
        );
      }
  }
  // A shallow, dry shaped basin in the otherwise unfilled garden. No copied mosaic or water art.
  const pool = { outline: r.poolOutline, holes: [] };
  if (detail) prism(f, 'stone', pool, r.foundationY, r.poolY + 0.15);
  else cap(f, 'stone', pool, r.poolY + 0.15);
  if (detail > 1) {
    const inner = pc
      .difference([[r.poolOutline]], [[r.poolOutline.map((p) => p.map((v) => v * 0.92))]])
      .map(clean);
    for (const p of inner) prism(f, 'stone', p, r.poolY + 0.15, r.poolY + 0.48);
  }
}
