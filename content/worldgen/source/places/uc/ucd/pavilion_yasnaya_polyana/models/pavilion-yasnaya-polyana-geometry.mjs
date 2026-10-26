/** Compact enclosed mint-board pavilion; both unequal gable windows are physical recesses. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildPavilion(face, detail, r) {
  const Y = r.floorY,
    H = 2.85,
    R = 4.5,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    ring = r.outline;
  prism(f, 'base', r.body, r.foundationY, Y);
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
      opening =
        edge === 1
          ? { u: L / 2, width: 2.3, bottom: 0.8, top: 2.3, role: 'glass' }
          : edge === 3
            ? { u: L / 2, width: 0.62, bottom: 0.8, top: 2.1, role: 'glass' }
            : edge === 2
              ? { u: 3.15, width: 0.85, bottom: 0, top: 2.03, role: 'door' }
              : null,
      us = opening ? [0, opening.u - opening.width / 2, opening.u + opening.width / 2, L] : [0, L],
      ys = [...new Set([0, 0.66, H, ...(opening ? [opening.bottom, opening.top] : [])])].sort(
        (a, b) => a - b,
      );
    for (let i = 0; i < us.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const u0 = us[i],
          u1 = us[i + 1],
          y0 = ys[j],
          y1 = ys[j + 1];
        if (opening && i === 1 && y0 >= opening.bottom && y1 <= opening.top) continue;
        Q(y1 <= 0.66 ? 'vertical' : 'wall', [S(u0, y0), S(u1, y0), S(u1, y1), S(u0, y1)], n);
      }
    if (opening) {
      const l = opening.u - opening.width / 2,
        h = opening.u + opening.width / 2,
        lo = opening.bottom,
        hi = opening.top,
        d = -0.12;
      Q(opening.role, [S(l, lo, d), S(h, lo, d), S(h, hi, d), S(l, hi, d)], n);
      Q('trim', [S(l, lo), S(l, hi), S(l, hi, d), S(l, lo, d)], [t[0], 0, t[1]]);
      Q('trim', [S(h, lo, d), S(h, hi, d), S(h, hi), S(h, lo)], [-t[0], 0, -t[1]]);
      Q('trim', [S(l, hi), S(h, hi), S(h, hi, d), S(l, hi, d)], [0, -1, 0]);
      Q('trim', [S(l, lo, d), S(h, lo, d), S(h, lo), S(l, lo)], [0, 1, 0]);
      if (detail) {
        const band = (u0, u1, y0, y1, depth = 0.025) =>
          Q('trim', [S(u0, y0, depth), S(u1, y0, depth), S(u1, y1, depth), S(u0, y1, depth)], n);
        band(l - 0.07, l + 0.025, lo - 0.06, hi + 0.08);
        band(h - 0.025, h + 0.07, lo - 0.06, hi + 0.08);
        band(l - 0.07, h + 0.07, hi - 0.02, hi + 0.08);
        band(l - 0.09, h + 0.09, lo - 0.06, lo + 0.035);
        if (opening.role === 'glass') {
          if (edge === 1) {
            for (const k of [1, 2])
              band(
                l + (opening.width * k) / 3 - 0.025,
                l + (opening.width * k) / 3 + 0.025,
                lo,
                hi,
                -0.07,
              );
            band(l, h, 1.88, 1.93, -0.07);
            if (detail >= 2) {
              band(l, h, 1.32, 1.36, -0.07);
              for (let k = 0; k < 3; k++)
                band(
                  l + (opening.width * (k + 0.5)) / 3 - 0.015,
                  l + (opening.width * (k + 0.5)) / 3 + 0.015,
                  lo,
                  1.9,
                  -0.07,
                );
            }
          } else {
            band(l, h, 1.23, 1.27, -0.07);
            if (detail >= 2) {
              band(l, h, 1.67, 1.71, -0.07);
              band(opening.u - 0.016, opening.u + 0.016, lo, hi, -0.07);
            }
          }
        } else if (detail >= 2) {
          band(l + 0.08, h - 0.08, 0.3, 0.36, -0.1);
          band(l + 0.08, h - 0.08, 1.65, 1.71, -0.1);
        }
      }
    }
    if (detail) {
      // Coarse closed corner boards and continuous sill/cornice; texture supplies fine grain.
      const band = (u0, u1, y0, y1) =>
        Q('trim', [S(u0, y0, 0.035), S(u1, y0, 0.035), S(u1, y1, 0.035), S(u0, y1, 0.035)], n);
      band(0, 0.075, 0, H);
      band(L - 0.075, L, 0, H);
      if (opening?.role === 'door') {
        band(0, opening.u - opening.width / 2, 0.63, 0.69);
        band(opening.u + opening.width / 2, L, 0.63, 0.69);
      } else band(0, L, 0.63, 0.69);
      band(0, L, H - 0.11, H + 0.025);
      if (detail >= 2)
        for (let y = 0.9; y < 2.75; y += 0.25) {
          const spans =
            opening && y >= opening.bottom && y <= opening.top
              ? [
                  [0, opening.u - opening.width / 2],
                  [opening.u + opening.width / 2, L],
                ]
              : [[0, L]];
          for (const [u0, u1] of spans)
            Q('wall', [S(u0, y, 0.009), S(u1, y, 0.009), S(u1, y + 0.015), S(u0, y + 0.015)], n);
        }
    }
  }
  // Vertical-board gables have actual inset triangular vents and closed reveals in every LOD.
  for (const edge of [1, 3]) {
    const a = ring[edge],
      b = ring[(edge + 1) % 4],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      t = b.map((v, i) => (v - a[i]) / L),
      n = [-t[1], 0, t[0]],
      S = (u, y, d = 0) => [a[0] + u * t[0] + d * n[0], y, a[1] + u * t[1] + d * n[2]],
      outer = [
        [0, H],
        [L, H],
        [L / 2, R],
      ],
      inner = [
        [L / 2 - 0.085, 3.62],
        [L / 2 + 0.085, 3.62],
        [L / 2, 3.82],
      ];
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3;
      Q('vertical', [S(...outer[i]), S(...outer[j]), S(...inner[j]), S(...inner[i])], n);
      Q(
        'trim',
        [S(...inner[i]), S(...inner[j]), S(...inner[j], -0.08), S(...inner[i], -0.08)],
        [
          -(inner[j][1] - inner[i][1]) * t[0],
          inner[j][0] - inner[i][0],
          -(inner[j][1] - inner[i][1]) * t[1],
        ],
      );
    }
    Q(
      'door',
      inner.map((p) => S(...p, -0.08)),
      n,
    );
  }
  const x0 = -2.04,
    x1 = 2.04,
    z0 = Math.min(...ring.map((p) => p[1])) - 0.2,
    z1 = r.frontZ + 0.2,
    A = [0, R, z0],
    C = [0, R, z1],
    q = [
      [x0, H - 0.09, z0],
      [x1, H - 0.09, z0],
      [x1, H - 0.09, z1],
      [x0, H - 0.09, z1],
    ];
  // Two thin closed pitched sheets leave the vertical-board gables visible beneath the overhang.
  for (const [ps, n] of [
    [
      [q[0], q[3], C, A],
      [-1, 1, 0],
    ],
    [
      [q[1], q[2], C, A],
      [1, 1, 0],
    ],
  ]) {
    const under = ps.map(([x, y, z]) => [x, y - 0.075, z]);
    Q('roof', ps, n);
    Q(
      'roof',
      under,
      n.map((v) => -v),
    );
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q('roof', [under[i], under[j], ps[j], ps[i]], [ps[j][2] - ps[i][2], 0, ps[i][0] - ps[j][0]]);
    }
  }
  if (detail) {
    const beam = (a, b, width) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        L = Math.hypot(dx, dy),
        ox = ((-dy / L) * width) / 2,
        oy = ((dx / L) * width) / 2,
        ps = [
          [a[0] + ox, a[1] + oy],
          [b[0] + ox, b[1] + oy],
          [b[0] - ox, b[1] - oy],
          [a[0] - ox, a[1] - oy],
        ],
        z = a[2];
      Q(
        'trim',
        ps.map(([x, y]) => [x, y, z - 0.045]),
        [0, 0, -1],
      );
      Q(
        'trim',
        ps.map(([x, y]) => [x, y, z + 0.045]),
        [0, 0, 1],
      );
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        Q(
          'trim',
          [
            [...ps[i], z - 0.045],
            [...ps[j], z - 0.045],
            [...ps[j], z + 0.045],
            [...ps[i], z + 0.045],
          ],
          [ps[j][1] - ps[i][1], ps[i][0] - ps[j][0], 0],
        );
      }
    };
    for (const z of [z0 - 0.015, z1 + 0.015])
      for (const sign of [-1, 1]) {
        beam([0, R, z], [sign * 2.04, H - 0.09, z], 0.11);
        if (detail >= 2) {
          const count = detail === 3 ? 18 : 10;
          for (let i = 0; i < count; i++) {
            const u = (i + 0.5) / count,
              x = sign * 2.04 * u,
              y = R + (H - 0.09 - R) * u,
              w = 0.07;
            Q(
              'trim',
              [
                [x - w, y - 0.04, z + 0.05],
                [x + w, y - 0.04, z + 0.05],
                [x, y - 0.18, z + 0.05],
              ],
              [0, 0, 1],
            );
            Q(
              'trim',
              [
                [x - w, y - 0.04, z - 0.05],
                [x + w, y - 0.04, z - 0.05],
                [x, y - 0.18, z - 0.05],
              ],
              [0, 0, -1],
            );
            Q(
              'trim',
              [
                [x - w, y - 0.04, z - 0.05],
                [x + w, y - 0.04, z - 0.05],
                [x + w, y - 0.04, z + 0.05],
                [x - w, y - 0.04, z + 0.05],
              ],
              [0, 1, 0],
            );
            Q(
              'trim',
              [
                [x - w, y - 0.04, z - 0.05],
                [x, y - 0.18, z - 0.05],
                [x, y - 0.18, z + 0.05],
                [x - w, y - 0.04, z + 0.05],
              ],
              [-1, -1, 0],
            );
            Q(
              'trim',
              [
                [x + w, y - 0.04, z - 0.05],
                [x, y - 0.18, z - 0.05],
                [x, y - 0.18, z + 0.05],
                [x + w, y - 0.04, z + 0.05],
              ],
              [1, -1, 0],
            );
          }
        }
      }
    B('roof', 0, R - 0.025, (z0 + z1) / 2, 0.1, 0.08, z1 - z0 + 0.1);
    if (detail >= 2)
      for (const z of [r.frontZ + 0.04, r.backZ - 0.04])
        for (let x = -1.6; x < 1.6; x += 0.16) {
          const top = R - (Math.abs(x) * 1.65) / 1.76;
          if (top > H + 0.05 && Math.abs(x) > 0.14) B('vertical', x, H, z, 0.025, top - H, 0.022);
        }
  }
  for (const a of r.aprons) prism(f, 'base', { outline: a.outline, holes: [] }, a.base, a.top);
}
