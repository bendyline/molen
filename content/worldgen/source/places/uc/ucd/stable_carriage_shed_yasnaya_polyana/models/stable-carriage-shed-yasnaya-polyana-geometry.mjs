/** Long estate stable: plaster walls, stall doors/windows, carriage opening and green hip. */
import { box } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildStable(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + r.floorY + x * r.gradeSlope,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    N = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), N(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, y, z, w, h, d),
    { x0, x1, z0, z1 } = r,
    H = 3.05;
  // The near-ground plinth follows the retained long-axis grade; no native yard flattening.
  B('base', (x0 + x1) / 2, -1.8, 0, x1 - x0, 1.8, z1 - z0);
  f(
    'wall',
    [
      [x0, H, z0],
      [x1, H, z0],
      [x1, H, z1],
      [x0, H, z1],
    ],
    [0, 1, 0],
  );
  const front = [
      ...[-25, -9, 8, 21].map((x) => ({ x, w: 1.45, bottom: 0, top: 2.35, door: true })),
      { x: 28.2, w: 3.7, bottom: 0, top: 2.65, door: true, carriage: true },
      ...[-30, -20, -15, -4, 2, 13.5, 17].map((x) => ({ x, w: 0.85, bottom: 1.58, top: 2.43 })),
    ],
    rear = detail
      ? [-25, -14, -3, 8, 19, 28].map((x) => ({ x, w: 0.75, bottom: 1.7, top: 2.4 }))
      : [];
  const wall = (a, b, normal, openings) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [normal[0], normal[2]],
      S = (u, y, d = 0) => [a[0] + t[0] * u + n[0] * d, y, a[1] + t[1] * u + n[1] * d],
      cuts = openings.map((o) => ({
        ...o,
        lo: o.u ?? o.x - x0 - o.w / 2,
        hi: (o.u ?? o.x - x0 - o.w / 2) + o.w,
      })),
      us = [...new Set([0, L, ...cuts.flatMap((o) => [o.lo, o.hi])])].sort((a, b) => a - b),
      ys = [...new Set([0, H, ...cuts.flatMap((o) => [o.bottom, o.top])])].sort((a, b) => a - b);
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const u0 = us[i],
          u1 = us[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1],
          u = (u0 + u1) / 2,
          y = (y0 + y1) / 2;
        if (cuts.some((o) => u > o.lo && u < o.hi && y > o.bottom && y < o.top)) continue;
        f('wall', [S(u0, y0), S(u1, y0), S(u1, y1), S(u0, y1)], normal);
      }
    for (const o of cuts) {
      const d = -0.2;
      f(
        o.door ? 'wood' : 'glass',
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.lo, o.top, d)],
        normal,
      );
      f(
        'trim',
        [S(o.lo, o.bottom), S(o.lo, o.top), S(o.lo, o.top, d), S(o.lo, o.bottom, d)],
        [t[0], 0, t[1]],
      );
      f(
        'trim',
        [S(o.hi, o.bottom, d), S(o.hi, o.top, d), S(o.hi, o.top), S(o.hi, o.bottom)],
        [-t[0], 0, -t[1]],
      );
      f('trim', [S(o.lo, o.top), S(o.hi, o.top), S(o.hi, o.top, d), S(o.lo, o.top, d)], [0, -1, 0]);
      f(
        'base',
        [S(o.lo, o.bottom, d), S(o.hi, o.bottom, d), S(o.hi, o.bottom), S(o.lo, o.bottom)],
        [0, 1, 0],
      );
      if (detail) {
        const bar = (lo, hi, bottom, top, depth = 0.035) =>
          f(
            'trim',
            [S(lo, bottom, depth), S(hi, bottom, depth), S(hi, top, depth), S(lo, top, depth)],
            normal,
          );
        bar(o.lo - 0.07, o.lo + 0.025, o.bottom, o.top + 0.08);
        bar(o.hi - 0.025, o.hi + 0.07, o.bottom, o.top + 0.08);
        bar(o.lo - 0.07, o.hi + 0.07, o.top - 0.025, o.top + 0.08);
        if (!o.door) {
          bar(o.lo - 0.07, o.hi + 0.07, o.bottom - 0.07, o.bottom + 0.025);
          if (detail >= 2)
            bar((o.lo + o.hi) / 2 - 0.025, (o.lo + o.hi) / 2 + 0.025, o.bottom, o.top);
        } else if (detail >= 2) {
          bar((o.lo + o.hi) / 2 - 0.018, (o.lo + o.hi) / 2 + 0.018, o.bottom, o.top, -0.18);
          for (const y of [0.28, 1.95]) bar(o.lo + 0.12, o.hi - 0.12, y, y + 0.075, -0.165);
        }
      }
    }
  };
  // Stable doors remain in the far silhouette; subpixel panes and trim arrive nearer.
  wall([x0, z0], [x1, z0], [0, 0, -1], detail ? front : front.filter((o) => o.door));
  wall([x0, z1], [x1, z1], [0, 0, 1], rear);
  wall(
    [x0, z0],
    [x0, z1],
    [-1, 0, 0],
    detail ? [{ u: (z1 - z0) / 2 - 0.4, w: 0.8, bottom: 1.6, top: 2.4 }] : [],
  );
  wall(
    [x1, z0],
    [x1, z1],
    [1, 0, 0],
    detail ? [{ u: (z1 - z0) / 2 - 0.4, w: 0.8, bottom: 1.6, top: 2.4 }] : [],
  );
  const A = [x0 - 0.4, z0 - 0.4],
    C = [x1 + 0.4, z1 + 0.4],
    half = (C[1] - A[1]) / 2,
    rx0 = A[0] + half,
    rx1 = C[0] - half,
    peak = H + 2.2;
  f(
    'roof',
    [
      [A[0], H, A[1]],
      [C[0], H, A[1]],
      [rx1, peak, 0],
      [rx0, peak, 0],
    ],
    [0, 1, -1],
  );
  f(
    'roof',
    [
      [C[0], H, C[1]],
      [A[0], H, C[1]],
      [rx0, peak, 0],
      [rx1, peak, 0],
    ],
    [0, 1, 1],
  );
  f(
    'roof',
    [
      [A[0], H, C[1]],
      [A[0], H, A[1]],
      [rx0, peak, 0],
    ],
    [-1, 1, 0],
  );
  f(
    'roof',
    [
      [C[0], H, A[1]],
      [C[0], H, C[1]],
      [rx1, peak, 0],
    ],
    [1, 1, 0],
  );
  f(
    'roof',
    [
      [A[0], H, A[1]],
      [A[0], H, C[1]],
      [C[0], H, C[1]],
      [C[0], H, A[1]],
    ],
    [0, -1, 0],
  );
  // Three green ventilators are seated through the ridge, with small hipped caps.
  for (const x of [-20, 0, 20]) {
    B('roof', x, peak - 0.25, 0, 0.7, 0.95, 0.7);
    B('roof', x, peak + 0.7, 0, 0.92, 0.11, 0.92);
    if (detail >= 2) {
      for (const y of [0.04, 0.23, 0.42]) B('wood', x, peak + y, -0.356, 0.5, 0.08, 0.025);
    }
  }
  if (detail) {
    B('trim', 0, H - 0.1, z0 - 0.035, x1 - x0, 0.16, 0.12);
    B('trim', 0, H - 0.1, z1 + 0.035, x1 - x0, 0.16, 0.12);
  }
  for (const step of r.steps)
    B('base', step.x, step.bottom, z0 - 0.45, step.width, step.top - step.bottom, 0.9);
  if (detail >= 2) {
    // Sparse standing seams merge by material; no tiny rivets or private facade atlas.
    for (let x = rx0 + 0.8; x < rx1; x += 1.6) {
      const strip = 0.025;
      f(
        'roof',
        [
          [x - strip, H + 0.015, A[1]],
          [x + strip, H + 0.015, A[1]],
          [x + strip, peak + 0.015, 0],
          [x - strip, peak + 0.015, 0],
        ],
        [0, 1, -1],
      );
      f(
        'roof',
        [
          [x - strip, peak + 0.015, 0],
          [x + strip, peak + 0.015, 0],
          [x + strip, H + 0.015, C[1]],
          [x - strip, H + 0.015, C[1]],
        ],
        [0, 1, 1],
      );
    }
  }
}
