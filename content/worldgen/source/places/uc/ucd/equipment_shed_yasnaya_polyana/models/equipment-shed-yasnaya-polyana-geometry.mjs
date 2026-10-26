/** Independent long equipment shed: weathered log walls, three timber doors and red hip roof. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildEquipment(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + x * r.gradeSlope,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    N = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), N(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    ring = r.outline,
    H = 2.25,
    courses = detail >= 3 ? 10 : 6;
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
      cuts = (edge === 0 ? r.openings : []).map((o) => ({
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
        frameRole = 'trim';
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

  const x0 = r.x0 - 0.4,
    x1 = r.x1 + 0.4,
    z0 = r.z0 - 0.35,
    z1 = r.z1 + 0.35,
    zc = (z0 + z1) / 2,
    D = (z1 - z0) / 2,
    rx0 = x0 + D,
    rx1 = x1 - D,
    eave = H - 0.06,
    peak = H + 1.35;
  // Closed opaque hip volume, with an actual timber bearing band beneath its roof.
  prism(f, 'trim', { outline: ring, holes: [] }, Y + H - 0.1, Y + H + 0.09);
  Q(
    'roof',
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [rx1, peak, zc],
      [rx0, peak, zc],
    ],
    [0, 1, -1],
  );
  Q(
    'roof',
    [
      [x1, eave, z1],
      [x0, eave, z1],
      [rx0, peak, zc],
      [rx1, peak, zc],
    ],
    [0, 1, 1],
  );
  Q(
    'roof',
    [
      [x0, eave, z1],
      [x0, eave, z0],
      [rx0, peak, zc],
    ],
    [-1, 1, 0],
  );
  Q(
    'roof',
    [
      [x1, eave, z0],
      [x1, eave, z1],
      [rx1, peak, zc],
    ],
    [1, 1, 0],
  );
  Q(
    'roof',
    [
      [x0, eave, z0],
      [x0, eave, z1],
      [x1, eave, z1],
      [x1, eave, z0],
    ],
    [0, -1, 0],
  );
  // The ordinary reference has small plaques at the two ends; retain plain panels, no copied text.
  if (detail) {
    const a = ring[0],
      b = ring[1],
      Z = (x) => a[1] + ((x - a[0]) * (b[1] - a[1])) / (b[0] - a[0]);
    for (const x of [r.x0 + 1, r.x1 - 1]) B('sign', x, 1.25, Z(x) + 0.05, 0.58, 0.22, 0.035);
  }
  if (detail >= 2)
    for (let i = 0; i < courses; i++)
      for (const [x, z] of ring) B('wall', x, ((i + 0.5) * H) / courses - 0.07, z, 0.2, 0.14, 0.2);
  for (const step of r.steps)
    prism(f, 'base', { outline: step.outline, holes: [] }, step.bottom, step.top);
}
