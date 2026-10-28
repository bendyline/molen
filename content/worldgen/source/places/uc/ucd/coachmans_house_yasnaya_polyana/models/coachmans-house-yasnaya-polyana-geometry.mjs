/** Complete mapped coachman's hut: log body, thick thatched hip, recessed openings. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildCoachman(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const ring = r.outline,
    H = 2.5,
    courses = detail >= 3 ? 10 : 5,
    openings = [
      [],
      detail ? [{ u: 0.5, w: 0.75, bottom: 0.75, top: 2.03 }] : [],
      [
        { u: 0.77, w: 1.0, bottom: 0, top: 2.17, door: true },
        ...(detail
          ? [
              { u: 0.22, w: 0.72, bottom: 0.72, top: 2.05 },
              { u: 0.45, w: 0.72, bottom: 0.72, top: 2.05 },
            ]
          : []),
      ],
      [],
    ];
  prism(f, 'base', { outline: ring, holes: [] }, r.foundationY, Y);
  Q(
    'wall',
    ring.map(([x, z]) => [x, H, z]),
    [0, 1, 0],
  );
  for (let edge = 0; edge < ring.length; edge++) {
    const a = ring[edge],
      b = ring[(edge + 1) % ring.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      t = b.map((v, i) => (v - a[i]) / L),
      n = [-t[1], 0, t[0]],
      S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]],
      cuts = openings[edge].map((o) => ({ ...o, lo: o.u * L - o.w / 2, hi: o.u * L + o.w / 2 }));
    const us = [...new Set([0, L, ...cuts.flatMap((o) => [o.lo, o.hi])])].sort((a, b) => a - b),
      levels =
        detail >= 2 ? Array.from({ length: courses + 1 }, (_, i) => (i * H) / courses) : [0, H],
      ys = [...new Set([...levels, ...cuts.flatMap((o) => [o.bottom, o.top])])].sort(
        (a, b) => a - b,
      );
    for (let ui = 0; ui < us.length - 1; ui++)
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const u0 = us[ui],
          u1 = us[ui + 1],
          y0 = ys[yi],
          y1 = ys[yi + 1],
          u = (u0 + u1) / 2,
          y = (y0 + y1) / 2;
        if (cuts.some((o) => u > o.lo && u < o.hi && y > o.bottom && y < o.top)) continue;
        if (detail >= 2) {
          const course = Math.min(courses - 1, Math.floor(y / (H / courses))),
            offset = (h) =>
              0.055 *
              Math.sin(
                Math.PI * Math.max(0, Math.min(1, (h - (course * H) / courses) / (H / courses))),
              ),
            ym = (y0 + y1) / 2;
          Q(
            'wall',
            [
              S(u0, y0, offset(y0)),
              S(u1, y0, offset(y0)),
              S(u1, ym, offset(ym)),
              S(u0, ym, offset(ym)),
            ],
            n,
          );
          Q(
            'wall',
            [
              S(u0, ym, offset(ym)),
              S(u1, ym, offset(ym)),
              S(u1, y1, offset(y1)),
              S(u0, y1, offset(y1)),
            ],
            n,
          );
        } else Q('wall', [S(u0, y0), S(u1, y0), S(u1, y1), S(u0, y1)], n);
      }
    for (const o of cuts) {
      const d = -0.22,
        role = o.door ? 'wood' : 'glass';
      Q(
        role,
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.lo, o.top, d)],
        n,
      );
      Q(
        'trim',
        [S(o.lo, o.bottom), S(o.lo, o.top), S(o.lo, o.top, d), S(o.lo, o.bottom, d)],
        [t[0], 0, t[1]],
      );
      Q(
        'trim',
        [S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.hi, o.top), S(o.hi, o.bottom)],
        [-t[0], 0, -t[1]],
      );
      Q('trim', [S(o.lo, o.top), S(o.hi, o.top), S(o.hi, o.top, d), S(o.lo, o.top, d)], [0, -1, 0]);
      Q(
        'base',
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.bottom), S(o.lo, o.bottom)],
        [0, 1, 0],
      );
      if (detail) {
        const border = (u0, u1, y0, y1, depth = 0.07) =>
          Q('trim', [S(u0, y0, depth), S(u1, y0, depth), S(u1, y1, depth), S(u0, y1, depth)], n);
        border(o.lo - 0.1, o.lo + 0.035, o.bottom - 0.07, o.top + 0.14);
        border(o.hi - 0.035, o.hi + 0.1, o.bottom - 0.07, o.top + 0.14);
        border(o.lo - 0.1, o.hi + 0.1, o.top - 0.035, o.top + 0.14);
        if (!o.door) {
          border(o.lo - 0.1, o.hi + 0.1, o.bottom - 0.1, o.bottom + 0.035);
          const mid = o.top - 0.47;
          border(o.lo, o.hi, mid - 0.025, mid + 0.025);
          if (detail >= 2) {
            border((o.lo + o.hi) / 2 - 0.025, (o.lo + o.hi) / 2 + 0.025, o.bottom, o.top);
          }
        } else if (detail >= 2) {
          border(o.lo + 0.13, o.lo + 0.17, o.bottom + 0.12, o.top - 0.16, -0.205);
          border(o.hi - 0.17, o.hi - 0.13, o.bottom + 0.12, o.top - 0.16, -0.205);
          border(o.lo + 0.13, o.hi - 0.13, o.top * 0.5 - 0.025, o.top * 0.5 + 0.025, -0.205);
        }
      }
    }
  }
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]),
    x0 = Math.min(...xs) - 0.55,
    x1 = Math.max(...xs) + 0.55,
    z0 = Math.min(...zs) - 0.55,
    z1 = Math.max(...zs) + 0.55,
    D = (z1 - z0) / 2,
    zc = (z0 + z1) / 2,
    roof = (u, y) => [
      [x0 + D * u, y, z0 + D * u],
      [x1 - D * u, y, z0 + D * u],
      [x1 - D * u, y, z1 - D * u],
      [x0 + D * u, y, z1 - D * u],
    ],
    bands = detail
      ? [
          [0, H - 0.08],
          [-0.025, H + 0.16],
          [0.12, H + 0.74],
          [0.53, H + 1.78],
          [1, H + 2.55],
        ]
      : [
          [0, H - 0.08],
          [0, H + 0.16],
          [1, H + 2.55],
        ];
  for (let b = 0; b < bands.length - 1; b++) {
    const A = roof(...bands[b]),
      C = roof(...bands[b + 1]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        n = i === 0 ? [0, 1, -1] : i === 1 ? [1, 1, 0] : i === 2 ? [0, 1, 1] : [-1, 1, 0];
      Q('roof', [A[i], A[j], C[j], C[i]], n);
    }
  }
  Q('roof', roof(0, H - 0.08), [0, -1, 0]);
  // Pale stack is seated below the pitched roof, rather than floating over its ridge.
  B('chimney', -0.55, 4.55, -0.25, 0.5, 1.3, 0.5);
  B('chimney', -0.55, 5.85, -0.25, 0.66, 0.15, 0.64);
  if (detail >= 2) {
    B('chimney', -0.55, 6, -0.25, 0.75, 0.1, 0.7);
    B('base', -0.55, 6.105, -0.25, 0.4, 0.025, 0.35);
  }
  // Small threshold and supported approach; the original outside ground is not flattened.
  for (const s of r.steps) prism(f, 'base', { outline: s.outline, holes: [] }, s.base, s.top);
  if (detail >= 2) {
    // Chunky cross-wall log ends, using the same wall graph; no separate per-log texture.
    for (let i = 0; i < courses; i++)
      for (const [x, z] of ring) {
        const y = ((i + 0.5) * H) / courses - 0.09;
        B('wall', x, y, z, 0.24, 0.18, 0.24);
      }
    // Two simple wooden ridge hold-down poles.
    for (const x of [-2.35, 2.35]) {
      B('trim', x, 4.95, zc, 0.07, 0.12, 0.85);
    }
    // Low woven garden edging is interrupted at the doorway. Deliberately coarse, not individual twigs.
    const front = ring[2],
      end = ring[3],
      len = Math.hypot(end[0] - front[0], end[1] - front[1]),
      tx = (end[0] - front[0]) / len,
      tz = (end[1] - front[1]) / len,
      door = cutsAtFront();
    for (const [lo, hi] of [
      [0.06, door[0] - 0.14],
      [door[1] + 0.14, len - 0.06],
    ]) {
      const center = (lo + hi) / 2;
      for (let i = 0; i < 4; i++) {
        const dy = 0.07 + i * 0.085,
          ps = [
            [lo, dy],
            [hi, dy],
            [hi, dy + 0.035],
            [lo, dy + 0.035],
          ].map(([u, y]) => [front[0] + tx * u - tz * 0.16, y, front[1] + tz * u + tx * 0.16]);
        Q('trim', ps, [-tz, 0, tx]);
        Q('trim', ps.toReversed(), [tz, 0, -tx]);
      }
      for (const u of [lo, center, hi])
        B(
          'trim',
          front[0] + tx * u - tz * 0.17,
          0.2,
          front[1] + tz * u + tx * 0.17,
          0.045,
          0.4,
          0.045,
        );
    }
    function cutsAtFront() {
      return [0.77 * len - 0.5, 0.77 * len + 0.5];
    }
  }
}
