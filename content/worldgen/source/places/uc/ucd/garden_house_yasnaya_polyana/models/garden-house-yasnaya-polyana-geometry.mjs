/** Garden House exterior with a genuinely open gallery, access stair and supported timber floor. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildGardenHouse(face, detail, r) {
  const Y = r.floorY,
    H = 4.3,
    G = 2.25,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const body = r.body,
    ring = body.outline,
    front = r.frontZ,
    x0 = r.x0,
    x1 = r.x1;
  prism(f, 'base', body, Y - 0.16, Y);
  const beam = (role, a, b, w, d = w) => {
    const v = b.map((v, k) => v - a[k]),
      len = Math.hypot(...v),
      n = v.map((v) => v / len),
      u = Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [n[2], 0, -n[0]],
      l = Math.hypot(...u),
      s = u.map((v) => ((v / l) * w) / 2),
      t = [n[1] * s[2] - n[2] * s[1], n[2] * s[0] - n[0] * s[2], n[0] * s[1] - n[1] * s[0]].map(
        (v) => (v * d) / w,
      ),
      corners = (p) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([i, j]) => p.map((v, k) => v + i * s[k] + j * t[k])),
      A = corners(a),
      C = corners(b);
    Q(
      role,
      A,
      n.map((v) => -v),
    );
    Q(role, C, n);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q(
        role,
        [A[i], A[j], C[j], C[i]],
        A[i].map((v, k) => (v + A[j][k]) / 2 - a[k]),
      );
    }
  };
  for (const p of r.piers) {
    prism(f, 'base', { outline: p.outline, holes: [] }, r.foundationY, p.top);
  }
  // Closed lower and upper rooms use real openings rather than dark rectangles over a wall.
  const layers = [
    [0, G, 'wall'],
    [G, H, 'upper'],
  ];
  for (const [lo, hi, role] of layers)
    for (let edge = 0; edge < 4; edge++) {
      const a = ring[edge],
        b = ring[(edge + 1) % 4],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        t = b.map((v, i) => (v - a[i]) / L),
        n = [-t[1], 0, t[0]],
        S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]],
        isFront = edge === 2,
        cuts = isFront
          ? (lo === 0 ? r.entryXs : [-5.2]).map((x) => ({
              u: x - a[0],
              w: lo === 0 ? 2.1 : 1.35,
              bottom: lo,
              top: lo + (lo === 0 ? 2.05 : 1.8),
            }))
          : [];
      const us = [...new Set([0, L, ...cuts.flatMap((o) => [o.u - o.w / 2, o.u + o.w / 2])])].sort(
          (a, b) => a - b,
        ),
        levels =
          role === 'wall' && detail >= 2
            ? Array.from(
                { length: (detail === 3 ? 10 : 5) + 1 },
                (_, i) => lo + (i * (hi - lo)) / (detail === 3 ? 10 : 5),
              )
            : [lo, hi],
        ys = [...new Set([...levels, ...cuts.flatMap((o) => [o.bottom, o.top])])].sort(
          (a, b) => a - b,
        );
      for (let i = 0; i < us.length - 1; i++)
        for (let j = 0; j < ys.length - 1; j++) {
          const u0 = us[i],
            u1 = us[i + 1],
            y0 = ys[j],
            y1 = ys[j + 1],
            u = (u0 + u1) / 2,
            y = (y0 + y1) / 2;
          if (cuts.some((o) => u > o.u - o.w / 2 && u < o.u + o.w / 2 && y > o.bottom && y < o.top))
            continue;
          if (role === 'wall' && detail >= 2) {
            const ym = (y0 + y1) / 2;
            Q(role, [S(u0, y0), S(u1, y0), S(u1, ym, 0.045), S(u0, ym, 0.045)], n);
            Q(role, [S(u0, ym, 0.045), S(u1, ym, 0.045), S(u1, y1), S(u0, y1)], n);
          } else Q(role, [S(u0, y0), S(u1, y0), S(u1, y1), S(u0, y1)], n);
        }
      for (const o of cuts) {
        const left = o.u - o.w / 2,
          right = o.u + o.w / 2,
          d = -0.22;
        Q(
          'wood',
          [S(left, o.bottom, d), S(right, o.bottom, d), S(right, o.top, d), S(left, o.top, d)],
          n,
        );
        Q(
          'trim',
          [S(left, o.bottom), S(left, o.top), S(left, o.top, d), S(left, o.bottom, d)],
          [t[0], 0, t[1]],
        );
        Q(
          'trim',
          [S(right, o.bottom, d), S(right, o.top, d), S(right, o.top), S(right, o.bottom)],
          [-t[0], 0, -t[1]],
        );
        Q(
          'trim',
          [S(left, o.top), S(right, o.top), S(right, o.top, d), S(left, o.top, d)],
          [0, -1, 0],
        );
        Q(
          'base',
          [S(left, o.bottom, d), S(right, o.bottom, d), S(right, o.bottom), S(left, o.bottom)],
          [0, 1, 0],
        );
        if (detail) {
          const band = (u0, u1, y0, y1, depth = 0.04) =>
            Q('trim', [S(u0, y0, depth), S(u1, y0, depth), S(u1, y1, depth), S(u0, y1, depth)], n);
          band(left - 0.08, left + 0.03, o.bottom, o.top + 0.09);
          band(right - 0.03, right + 0.08, o.bottom, o.top + 0.09);
          band(left - 0.08, right + 0.08, o.top - 0.02, o.top + 0.09);
          if (!o.vent) {
            band(o.u - 0.025, o.u + 0.025, o.bottom + 0.05, o.top - 0.06, -0.2);
            if (detail >= 2) {
              band(left + 0.1, right - 0.1, o.bottom + 0.35, o.bottom + 0.41, -0.2);
              band(left + 0.1, right - 0.1, o.top - 0.42, o.top - 0.36, -0.2);
            }
          }
        }
      }
    }
  Q(
    'upper',
    ring.map(([x, z]) => [x, H, z]),
    [0, 1, 0],
  );
  // The gallery floor and rails remain open, including in the skyline derivative.
  B('trim', (x0 + x1) / 2, G - 0.15, (front + r.galleryZ) / 2, x1 - x0, 0.15, r.galleryZ - front);
  const posts = [-8.4, -4.5, -1.25, 4.7];
  for (const x of posts) B('trim', x, G, r.galleryZ - 0.06, 0.12, H - G, 0.12);
  const railY = G + 0.92;
  for (const [a, b] of [
    [x0, -0.05],
    [1.05, x1],
  ]) {
    B('trim', (a + b) / 2, railY, r.galleryZ - 0.06, b - a, 0.08, 0.09);
    if (detail) B('trim', (a + b) / 2, G + 0.12, r.galleryZ - 0.06, b - a, 0.075, 0.08);
  }
  for (const x of [x0, x1])
    B('trim', x, railY, (front + r.galleryZ) / 2, 0.09, 0.08, r.galleryZ - front);
  if (detail >= 2) {
    for (let x = x0 + 0.35; x < x1 - 0.1; x += 0.63) {
      if (x > -0.05 && x < 1.05) continue;
      B('trim', x, G + 0.18, r.galleryZ - 0.06, 0.045, 0.73, 0.045);
    }
    for (const x of posts.slice(1, -1).filter((x) => x < -0.6 || x > 1.2)) {
      beam('trim', [x, G + 0.15, r.galleryZ - 0.04], [x + 0.5, G + 0.65, r.galleryZ - 0.04], 0.07);
    }
  }
  // External stair descends along the northeast front; the space beneath stays open.
  if (detail === 0) {
    const [a, b] = r.stairEnds;
    const p = [
      [a[0], Y + a[1] - 0.16, a[2]],
      [b[0], Y + b[1] - 0.16, b[2]],
      [b[0], Y + b[1], b[2]],
      [a[0], Y + a[1], a[2]],
    ];
    const side = r.stairWidth / 2;
    f(
      'trim',
      p.map(([x, y, z]) => [x, y, z - side]),
      [0, 0, -1],
    );
    f(
      'trim',
      p.map(([x, y, z]) => [x, y, z + side]),
      [0, 0, 1],
    );
    for (const [i, j, n] of [
      [0, 1, [0, -1, 0]],
      [1, 2, [1, 0, 0]],
      [2, 3, [0, 1, 0]],
      [3, 0, [-1, 0, 0]],
    ])
      f(
        'trim',
        [
          [p[i][0], p[i][1], p[i][2] - side],
          [p[j][0], p[j][1], p[j][2] - side],
          [p[j][0], p[j][1], p[j][2] + side],
          [p[i][0], p[i][1], p[i][2] + side],
        ],
        n,
      );
  } else
    for (const s of r.treads)
      prism(f, 'trim', { outline: s.outline, holes: [] }, s.top - 0.13, s.top);
  for (const z of [r.stairZ - r.stairWidth / 2, r.stairZ + r.stairWidth / 2]) {
    const [a, b] = r.stairEnds;
    beam('trim', [a[0], a[1] - 0.18, z], [b[0], b[1] - 0.18, z], 0.1, 0.18);
    if (detail) {
      beam('trim', [a[0], a[1] + 0.9, z], [b[0], b[1] + 0.9, z], 0.075);
      for (const u of [0, 0.5, 1]) {
        const x = a[0] + u * (b[0] - a[0]),
          y = a[1] + u * (b[1] - a[1]);
        B('trim', x, y, z, 0.075, 0.95, 0.075);
      }
    }
  }
  for (const s of r.aprons) prism(f, 'base', { outline: s.outline, holes: [] }, s.base, s.top);
  // A simple hip roof covers the whole gallery, rather than terminating at the room wall.
  const rx0 = x0 - 0.38,
    rx1 = x1 + 0.38,
    rz0 = Math.min(...ring.map((p) => p[1])) - 0.38,
    rz1 = r.galleryZ + 0.35,
    zc = (rz0 + rz1) / 2,
    inset = (rz1 - rz0) / 2,
    A = [rx0 + inset, H + 1.5, zc],
    C = [rx1 - inset, H + 1.5, zc],
    q = [
      [rx0, H, rz0],
      [rx1, H, rz0],
      [rx1, H, rz1],
      [rx0, H, rz1],
    ];
  Q('roof', [q[0], q[1], C, A], [0, 1, -1]);
  Q('roof', [q[1], q[2], C], [1, 1, 0]);
  Q('roof', [q[2], q[3], A, C], [0, 1, 1]);
  Q('roof', [q[3], q[0], A], [-1, 1, 0]);
  Q('roof', q, [0, -1, 0]);
  if (detail >= 2) {
    for (const x of [x0 + 0.06, x1 - 0.06]) B('trim', x, 0.15, front + 0.02, 0.14, H - 0.15, 0.12);
    B('trim', (x0 + x1) / 2, G - 0.05, front + 0.02, x1 - x0, 0.12, 0.12);
  }
}
