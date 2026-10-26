/** Independent stepped log threshing barn with a lower inset bay and three recessed entrances. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildRiga(face, detail, r) {
  const Y = r.floorY;
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const Q = (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [x, Y + y, z]),
      n,
    );
  const B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);

  for (const part of r.parts) {
    const ring = part.outline,
      H = part.wallHeight,
      courses = detail === 3 ? Math.ceil(H / 0.25) : Math.ceil(H / 0.38);
    prism(f, 'base', { outline: ring, holes: [] }, r.foundationY, Y);
    Q(
      'wall',
      ring.map(([x, z]) => [x, H, z]),
      [0, 1, 0],
    );
    for (let edge = 0; edge < 4; edge++) {
      const a = ring[edge],
        b = ring[(edge + 1) % 4],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = b.map((v, k) => (v - a[k]) / L),
        n = [-t[1], 0, t[0]];
      const S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]];
      const cuts = r.doors
        .filter((d) => d.part === part.id && d.edge === edge)
        .map((d) => {
          const u = d.edge === 0 ? d.center - a[1] : d.center - a[0];
          return { ...d, lo: u - d.width / 2, hi: u + d.width / 2 };
        });
      const us = [...new Set([0, L, ...cuts.flatMap((o) => [o.lo, o.hi])])].sort((a, b) => a - b);
      const ys = [
        ...new Set([
          0,
          H,
          ...(detail >= 2 ? Array.from({ length: courses + 1 }, (_, i) => (i * H) / courses) : []),
          ...cuts.map((o) => o.top),
        ]),
      ].sort((a, b) => a - b);
      for (let i = 0; i < us.length - 1; i++)
        for (let j = 0; j < ys.length - 1; j++) {
          const lo = us[i],
            hi = us[i + 1],
            bottom = ys[j],
            top = ys[j + 1],
            u = (lo + hi) / 2,
            y = (bottom + top) / 2;
          if (cuts.some((o) => u > o.lo && u < o.hi && y < o.top)) continue;
          if (detail >= 2) {
            const course = Math.min(courses - 1, Math.floor(y / (H / courses))),
              offset = (h) =>
                0.038 *
                Math.sin(
                  Math.PI * Math.max(0, Math.min(1, (h - (course * H) / courses) / (H / courses))),
                ),
              mid = (bottom + top) / 2;
            Q(
              'wall',
              [
                S(lo, bottom, offset(bottom)),
                S(hi, bottom, offset(bottom)),
                S(hi, mid, offset(mid)),
                S(lo, mid, offset(mid)),
              ],
              n,
            );
            Q(
              'wall',
              [
                S(lo, mid, offset(mid)),
                S(hi, mid, offset(mid)),
                S(hi, top, offset(top)),
                S(lo, top, offset(top)),
              ],
              n,
            );
          } else Q('wall', [S(lo, bottom), S(hi, bottom), S(hi, top), S(lo, top)], n);
        }
      for (const o of cuts) {
        const d = -0.2;
        Q('door', [S(o.lo, 0, d), S(o.hi, 0, d), S(o.hi, o.top, d), S(o.lo, o.top, d)], n);
        Q('wood', [S(o.lo, 0), S(o.lo, o.top), S(o.lo, o.top, d), S(o.lo, 0, d)], [t[0], 0, t[1]]);
        Q(
          'wood',
          [S(o.hi, 0, d), S(o.hi, o.top, d), S(o.hi, o.top), S(o.hi, 0)],
          [-t[0], 0, -t[1]],
        );
        Q(
          'wood',
          [S(o.lo, o.top), S(o.hi, o.top), S(o.hi, o.top, d), S(o.lo, o.top, d)],
          [0, -1, 0],
        );
        Q('base', [S(o.lo, 0, d), S(o.hi, 0, d), S(o.hi, 0), S(o.lo, 0)], [0, 1, 0]);
        if (detail) {
          const bar = (lo, hi, y0, y1, depth = 0.075, role = 'wood') =>
            Q(role, [S(lo, y0, depth), S(hi, y0, depth), S(hi, y1, depth), S(lo, y1, depth)], n);
          bar(o.lo - 0.12, o.lo + 0.025, 0, o.top + 0.13);
          bar(o.hi - 0.025, o.hi + 0.12, 0, o.top + 0.13);
          bar(o.lo - 0.12, o.hi + 0.12, o.top - 0.01, o.top + 0.13);
          if (detail >= 2) {
            for (const y of [0.34, o.top - 0.38]) bar(o.lo + 0.06, o.hi - 0.06, y, y + 0.1, -0.175);
            if (o.double)
              bar(
                (o.lo + o.hi) / 2 - 0.025,
                (o.lo + o.hi) / 2 + 0.025,
                0.05,
                o.top - 0.05,
                -0.17,
                'metal',
              );
            for (const u of [o.lo + 0.12, o.hi - 0.12])
              for (const y of [0.36, o.top - 0.36])
                bar(u - 0.08, u + 0.08, y, y + 0.06, -0.15, 'metal');
          }
        }
      }
      // Coarse external bracing is structural; small log relief is reserved for near LODs.
      if (detail) {
        const count = Math.max(1, Math.round(L / 2.7));
        for (let i = 0; i <= count; i++) {
          const u = (i * L) / count;
          if (cuts.some((o) => u > o.lo - 0.2 && u < o.hi + 0.2)) continue;
          const q = S(Math.max(0.08, Math.min(L - 0.08, u)), 0, 0.1);
          B('wood', q[0], 0, q[2], 0.13, H + 0.035, 0.13);
        }
        const a0 = S(0, H - 0.14, 0.07),
          b0 = S(L, H - 0.14, 0.07);
        Q('wood', [[...a0], [...b0], S(L, H + 0.015, 0.07), S(0, H + 0.015, 0.07)], n);
      }
    }
    const x0 = part.x0 - 0.28,
      x1 = part.x1 + 0.28,
      z0 = part.z0 - 0.32,
      z1 = part.z1 + 0.32,
      zc = (z0 + z1) / 2,
      rx0 = x0 + part.hipInset,
      rx1 = x1 - part.hipInset,
      e = part.eave,
      peak = part.ridge;
    const roofFaces = [
      [
        [x0, e, z0],
        [x1, e, z0],
        [rx1, peak, zc],
        [rx0, peak, zc],
      ],
      [
        [x1, e, z1],
        [x0, e, z1],
        [rx0, peak, zc],
        [rx1, peak, zc],
      ],
      [
        [x0, e, z1],
        [x0, e, z0],
        [rx0, peak, zc],
      ],
      [
        [x1, e, z0],
        [x1, e, z1],
        [rx1, peak, zc],
      ],
    ];
    for (const ps of roofFaces) Q('roof', ps, [0, 1, 0]);
    // Opaque underside and continuous vertical eave band close every hip and wall/roof join.
    Q(
      'wood',
      [
        [x0, e, z0],
        [x0, e, z1],
        [x1, e, z1],
        [x1, e, z0],
      ],
      [0, -1, 0],
    );
    for (const [a, b, n] of [
      [
        [x0, z0],
        [x1, z0],
        [0, 0, -1],
      ],
      [
        [x1, z0],
        [x1, z1],
        [1, 0, 0],
      ],
      [
        [x1, z1],
        [x0, z1],
        [0, 0, 1],
      ],
      [
        [x0, z1],
        [x0, z0],
        [-1, 0, 0],
      ],
    ])
      Q(
        'wood',
        [
          [a[0], H - 0.025, a[1]],
          [b[0], H - 0.025, b[1]],
          [b[0], e, b[1]],
          [a[0], e, a[1]],
        ],
        n,
      );
    if (detail >= 2) {
      // Small seated corner ends, with no separate cylindrical high-poly logs.
      for (const [x, z] of ring)
        for (let i = 0; i < courses; i++)
          B('wall', x, (i * H) / courses + 0.02, z, 0.25, (H / courses) * 0.6, 0.25);
      B('roof', (rx0 + rx1) / 2, peak - 0.012, zc, Math.max(0.1, rx1 - rx0), 0.035, 0.09);
    }
  }
  for (const step of r.steps)
    prism(f, 'base', { outline: step.outline, holes: [] }, step.bottom, step.top);
}
