/** Independent photographed gabled service outbuilding; icehouse function remains inferred. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildIcehouse(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    ring = r.outline,
    H = 1.75,
    courses = detail >= 3 ? 11 : 7;
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
      t = b.map((v, i) => (v - a[i]) / L),
      n = [-t[1], 0, t[0]],
      S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]],
      cuts = (edge === 1 ? r.openings : []).map((o) => ({
        ...o,
        lo: o.u * L - o.w / 2,
        hi: o.u * L + o.w / 2,
      })),
      us = [...new Set([0, L, ...cuts.flatMap((o) => [o.lo, o.hi])])].sort((a, b) => a - b),
      ys = [
        ...new Set([
          0,
          H,
          ...(detail >= 2 ? Array.from({ length: courses + 1 }, (_, i) => (i * H) / courses) : []),
          ...cuts.flatMap((o) => [o.bottom, o.top]),
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
        if (cuts.some((o) => u > o.lo && u < o.hi && y > o.bottom && y < o.top)) continue;
        if (detail >= 2) {
          const course = Math.min(courses - 1, Math.floor(y / (H / courses))),
            offset = (h) =>
              0.045 *
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
      const d = -0.2,
        frameRole = o.door ? 'wood' : 'trim';
      Q(
        o.door ? 'wood' : 'glass',
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.lo, o.top, d)],
        n,
      );
      Q(
        frameRole,
        [S(o.lo, o.bottom), S(o.lo, o.top), S(o.lo, o.top, d), S(o.lo, o.bottom, d)],
        [t[0], 0, t[1]],
      );
      Q(
        frameRole,
        [S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.hi, o.top), S(o.hi, o.bottom)],
        [-t[0], 0, -t[1]],
      );
      Q(
        frameRole,
        [S(o.lo, o.top), S(o.hi, o.top), S(o.hi, o.top, d), S(o.lo, o.top, d)],
        [0, -1, 0],
      );
      Q(
        'base',
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.bottom), S(o.lo, o.bottom)],
        [0, 1, 0],
      );
      if (detail) {
        const bar = (lo, hi, bottom, top, depth = 0.055, role = frameRole) =>
          Q(
            role,
            [S(lo, bottom, depth), S(hi, bottom, depth), S(hi, top, depth), S(lo, top, depth)],
            n,
          );
        bar(o.lo - 0.09, o.lo + 0.025, o.bottom, o.top + 0.12);
        bar(o.hi - 0.025, o.hi + 0.09, o.bottom, o.top + 0.12);
        bar(o.lo - 0.09, o.hi + 0.09, o.top - 0.02, o.top + 0.12);
        if (!o.door) {
          bar(o.lo - 0.09, o.hi + 0.09, o.bottom - 0.09, o.bottom + 0.025);
          bar(o.lo, o.hi, o.top - 0.38, o.top - 0.33);
          if (detail >= 2)
            bar((o.lo + o.hi) / 2 - 0.025, (o.lo + o.hi) / 2 + 0.025, o.bottom, o.top - 0.36);
        } else if (detail >= 2) {
          for (const y of [0.25, 1.65]) bar(o.lo + 0.1, o.hi - 0.1, y, y + 0.075, -0.18, 'wood');
          bar(o.lo + 0.12, o.lo + 0.18, 0.15, 1.95, -0.175, 'wood');
        }
      }
    }
  }
  const half = (r.z1 - r.z0) / 2,
    zc = (r.z0 + r.z1) / 2,
    peak = 4.1,
    rise = peak - H,
    roofY = (z) => peak - (rise * Math.abs(z - zc)) / half;
  const vb = H + 1.43,
    vt = H + 1.64,
    vw = 0.24;
  for (const front of [false, true]) {
    const x = front ? r.x1 : r.x0,
      sign = front ? 1 : -1,
      rows = [
        ...new Set([
          H,
          peak,
          ...(front ? [vb, vt] : []),
          ...(detail >= 2 ? Array.from({ length: 33 }, (_, i) => H + ((peak - H) * i) / 32) : []),
        ]),
      ].sort((a, b) => a - b);
    const edge = (y) => (half * (peak - y)) / (peak - H),
      gap = (y) => ((vw / 2) * (vt - y)) / (vt - vb),
      offset = (y) =>
        detail >= 2 ? 0.012 * Math.sin(Math.PI * ((((y - H) * 16) / (peak - H)) % 1)) : 0;
    for (let j = 0; j < rows.length - 1; j++) {
      const a = rows[j],
        b = rows[j + 1],
        points =
          front && (a + b) / 2 > vb && (a + b) / 2 < vt
            ? [
                [
                  [-edge(a), a],
                  [-gap(a), a],
                  [-gap(b), b],
                  [-edge(b), b],
                ],
                [
                  [gap(a), a],
                  [edge(a), a],
                  [edge(b), b],
                  [gap(b), b],
                ],
              ]
            : [
                [
                  [-edge(a), a],
                  [edge(a), a],
                  [edge(b), b],
                  [-edge(b), b],
                ],
              ];
      for (const ps of points)
        Q(
          'gable',
          ps.map(([z, y]) => [x + sign * offset(y), y, zc + z]),
          [sign, 0, 0],
        );
    }
  }
  // The triangular vent is an actual front-gable opening with timber reveals and a recessed dark back.
  const vent = [
      [zc - vw / 2, vb],
      [zc + vw / 2, vb],
      [zc, vt],
    ],
    back = r.x1 - 0.16;
  Q(
    'metal',
    vent.map(([z, y]) => [back, y, z]),
    [1, 0, 0],
  );
  for (let i = 0; i < 3; i++) {
    const a = vent[i],
      b = vent[(i + 1) % 3];
    Q(
      'wood',
      [
        [r.x1, a[1], a[0]],
        [r.x1, b[1], b[0]],
        [back, b[1], b[0]],
        [back, a[1], a[0]],
      ],
      [0, i === 0 ? 1 : -1, i === 1 ? -1 : 1],
    );
  }
  const x0 = r.x0 - 0.3,
    x1 = r.x1 + 0.3,
    z0 = r.z0 - 0.32,
    z1 = r.z1 + 0.32;
  for (const z of [z0, z1]) {
    const ps = [
        [x0, roofY(z), z],
        [x1, roofY(z), z],
        [x1, peak, zc],
        [x0, peak, zc],
      ],
      n = [0, 1, z === z0 ? -1 : 1];
    Q('roof', ps, n);
    Q(
      'roof',
      ps.map(([x, y, z]) => [x, y - 0.08, z]).toReversed(),
      n.map((v) => -v),
    );
    for (const x of [x0, x1])
      Q(
        'roof',
        [
          [x, roofY(z) - 0.08, z],
          [x, roofY(z), z],
          [x, peak, zc],
          [x, peak - 0.08, zc],
        ],
        [x === x0 ? -1 : 1, 0, 0],
      );
    Q(
      'roof',
      [
        [x0, roofY(z) - 0.08, z],
        [x1, roofY(z) - 0.08, z],
        [x1, roofY(z), z],
        [x0, roofY(z), z],
      ],
      [0, 0, z === z0 ? -1 : 1],
    );
  }
  if (detail) {
    const dy = 1.17,
      dz = 0.65,
      L = Math.hypot(dy, dz),
      ny = (-dz / L) * 0.034,
      nz = (dy / L) * 0.034,
      x = r.x1 - 0.174;
    Q(
      'wood',
      [
        [x, 0.17 + ny, -0.32 + nz],
        [x, 1.34 + ny, 0.33 + nz],
        [x, 1.34 - ny, 0.33 - nz],
        [x, 0.17 - ny, -0.32 - nz],
      ],
      [1, 0, 0],
    );
    for (const y of [0.28, 1.26]) B('metal', r.x1 - 0.15, y, -0.36, 0.035, 0.06, 0.14);
  }
  if (detail >= 2)
    for (let i = 0; i < courses; i++)
      for (const [x, z] of ring) {
        const bottom = ((i + 0.5) * H) / courses - 0.045,
          top = Math.min(bottom + 0.1, roofY(z + Math.sign(z) * 0.1) - 0.09);
        if (top > bottom + 0.01) B('wall', x, bottom, z, 0.2, top - bottom, 0.2);
      }
  for (const step of r.steps)
    prism(f, 'base', { outline: step.outline, holes: [] }, step.bottom, step.top);
}
