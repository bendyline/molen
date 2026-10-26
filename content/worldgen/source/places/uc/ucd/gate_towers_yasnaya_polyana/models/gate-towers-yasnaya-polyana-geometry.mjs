/** Paired round gate towers with real arched recesses; no geometry spans the passage. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildGateTowers(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    n = [12, 20, 28, 36][detail],
    archN = [4, 6, 8, 12][detail];
  for (const tower of r.towers) {
    const [cx, cz] = tower.center,
      R = tower.radius,
      Y = tower.baseY,
      H = 3.05,
      S = (theta, rad, y) => [cx + Math.sin(theta) * rad, Y + y, cz + Math.cos(theta) * rad],
      normal = (theta) => [Math.sin(theta), 0, Math.cos(theta)],
      Q = (role, ps, target) => f(role, ps, target),
      radial = (role, theta0, theta1, rad0, y0, rad1, y1) => {
        const a = S(theta0, rad0, y0),
          b = S(theta1, rad0, y0),
          c = S(theta1, rad1, y1),
          d = S(theta0, rad1, y1);
        Q(
          role,
          [a, b, c, d],
          [...normal((theta0 + theta1) / 2).map((v, i) => (i === 1 ? rad0 - rad1 : v * (y1 - y0)))],
        );
      },
      lathe = (role, profile, count = n, closed = true) => {
        for (let j = 0; j < profile.length - 1; j++)
          for (let i = 0; i < count; i++)
            radial(
              role,
              (i * Math.PI * 2) / count,
              ((i + 1) * Math.PI * 2) / count,
              ...profile[j],
              ...profile[j + 1],
            );
        if (closed) {
          for (const [k, ny] of [
            [0, -1],
            [profile.length - 1, 1],
          ]) {
            const [rad, y] = profile[k];
            if (rad > 0)
              Q(
                role,
                Array.from({ length: count }, (_, i) => S((i * Math.PI * 2) / count, rad, y)),
                [0, ny, 0],
              );
          }
        }
      };
    lathe('trim', [
      [R * 1.06, tower.foundationY - Y],
      [R * 1.06, 0.12],
    ]);
    const panelAngles = detail ? [0, Math.PI / 2, Math.PI, Math.PI * 1.5] : [Math.PI],
      half = 0.35,
      alpha = Math.asin(half / R),
      spring = 1.95;
    for (let p = 0; p < panelAngles.length; p++) {
      const theta = panelAngles[p],
        next =
          panelAngles[(p + 1) % panelAngles.length] +
          (p === panelAngles.length - 1 ? Math.PI * 2 : 0),
        start = theta + alpha,
        end = next - alpha,
        segments = Math.ceil((end - start) / ((Math.PI * 2) / n));
      for (let i = 0; i < segments; i++) {
        const a = start + ((end - start) * i) / segments,
          b = start + ((end - start) * (i + 1)) / segments;
        radial('wall', a, b, R, 0, R, H);
      }
      const isDoor = Math.abs(theta - Math.PI) < 0.001,
        bottom = isDoor ? 0.12 : 0.3,
        depth = isDoor ? 0.16 : 0.09,
        inner = R - depth,
        back = (u, y, offset = 0) => [
          cx + Math.sin(theta) * (inner + offset) + Math.cos(theta) * u,
          Y + y,
          cz + Math.cos(theta) * (inner + offset) - Math.sin(theta) * u,
        ],
        arcs = Array.from({ length: archN + 1 }, (_, i) => {
          const u = -half + (i * 2 * half) / archN;
          return {
            theta: theta + Math.asin(u / R),
            u,
            y: spring + Math.sqrt(Math.max(0, half * half - u * u)),
          };
        });
      for (let i = 0; i < arcs.length - 1; i++) {
        const a = arcs[i],
          b = arcs[i + 1],
          m = (a.theta + b.theta) / 2;
        radial('wall', a.theta, b.theta, R, 0, R, bottom);
        Q(
          'wall',
          [S(a.theta, R, a.y), S(b.theta, R, b.y), S(b.theta, R, H), S(a.theta, R, H)],
          normal(m),
        );
        Q(
          isDoor ? 'door' : 'wall',
          [back(a.u, bottom), back(b.u, bottom), back(b.u, spring), back(a.u, spring)],
          normal(theta),
        );
        Q(
          isDoor ? 'door' : 'wall',
          [back(0, spring), back(a.u, a.y), back(b.u, b.y)],
          normal(theta),
        );
        const dy = b.y - a.y,
          du = b.u - a.u;
        Q(
          'trim',
          [S(a.theta, R, a.y), S(b.theta, R, b.y), back(b.u, b.y), back(a.u, a.y)],
          [dy * Math.cos(m), -du, -dy * Math.sin(m)],
        );
        Q(
          'trim',
          [S(a.theta, R, bottom), S(b.theta, R, bottom), back(b.u, bottom), back(a.u, bottom)],
          [0, 1, 0],
        );
      }
      for (const sign of [-1, 1]) {
        const a = theta + sign * alpha,
          tangent = [Math.cos(a) * -sign, 0, Math.sin(a) * sign];
        Q(
          'trim',
          [S(a, R, bottom), S(a, R, spring), back(sign * half, spring), back(sign * half, bottom)],
          tangent,
        );
      }
      if (detail) {
        const strip = (a, b, y0, y1) => {
          radial('trim', a, b, R + 0.025, y0, R + 0.025, y1);
          radial('trim', a, b, R + 0.002, y0, R + 0.002, y1);
          for (const [y, ny] of [
            [y0, -1],
            [y1, 1],
          ])
            Q(
              'trim',
              [S(a, R + 0.002, y), S(b, R + 0.002, y), S(b, R + 0.025, y), S(a, R + 0.025, y)],
              [0, ny, 0],
            );
          for (const [a0, sign] of [
            [a, -1],
            [b, 1],
          ])
            Q(
              'trim',
              [
                S(a0, R + 0.002, y0),
                S(a0, R + 0.002, y1),
                S(a0, R + 0.025, y1),
                S(a0, R + 0.025, y0),
              ],
              [Math.cos(a0) * sign, 0, -Math.sin(a0) * sign],
            );
        };
        for (const sign of [-1, 1])
          strip(
            theta + sign * (alpha + 0.035) - 0.018,
            theta + sign * (alpha + 0.035) + 0.018,
            0.27,
            2.68,
          );
        for (let i = 0; i < archN; i++)
          strip(
            theta - alpha - 0.05 + ((2 * alpha + 0.1) * i) / archN,
            theta - alpha - 0.05 + ((2 * alpha + 0.1) * (i + 1)) / archN,
            2.65,
            2.68,
          );
        if (isDoor && detail >= 2) {
          for (const y of [0.42, 1.5]) {
            Q(
              'door',
              [
                back(-0.28, y, 0.012),
                back(0.28, y, 0.012),
                back(0.28, y + 0.045, 0.012),
                back(-0.28, y + 0.045, 0.012),
              ],
              normal(theta),
            );
          }
          const hp = back(0.18, 0.92, 0.025);
          box(f, 'metal', hp[0], hp[1], hp[2], 0.035, 0.12, 0.04);
        }
      }
    }
    lathe('trim', [
      [R, 3.0],
      [R * 1.04, 3.08],
      [R * 1.11, 3.17],
      [R * 1.13, 3.23],
    ]);
    const roof =
      detail === 0
        ? [
            [R * 1.13, 3.23],
            [R * 0.77, 3.56],
            [R * 0.66, 3.9],
            [R * 0.25, 4.24],
            [0, 4.25],
          ]
        : [
            [R * 1.13, 3.23],
            [R * 0.99, 3.36],
            [R * 0.77, 3.56],
            [R * 0.66, 3.9],
            [R * 0.52, 4.14],
            [R * 0.25, 4.24],
            [0, 4.25],
          ];
    lathe('roof', roof);
    if (detail >= 2)
      for (let i = 0; i < (detail === 3 ? 16 : 8); i++) {
        const a = (i * Math.PI * 2) / (detail === 3 ? 16 : 8) - 0.006,
          b = a + 0.012;
        for (let j = 0; j < roof.length - 2; j++) {
          const [ra, ya] = roof[j],
            [rb, yb] = roof[j + 1];
          radial('metal', a, b, ra + 0.012, ya, rb + 0.012, yb);
          for (const [t, sign] of [
            [a, -1],
            [b, 1],
          ])
            Q(
              'metal',
              [S(t, ra, ya), S(t, rb, yb), S(t, rb + 0.012, yb), S(t, ra + 0.012, ya)],
              [Math.cos(t) * sign, 0, -Math.sin(t) * sign],
            );
        }
      }
    lathe(
      'metal',
      [
        [0.022, 4.23],
        [0.022, 4.76],
      ],
      detail ? 8 : 6,
    );
    box(f, 'metal', cx + 0.1, Y + 4.55, cz, 0.2, 0.13, 0.026);
  }
  for (const wing of r.wings) {
    prism(f, 'wall', { outline: wing.outline, holes: [] }, wing.base, wing.top);
    if (detail) prism(f, 'trim', { outline: wing.outline, holes: [] }, wing.top, wing.top + 0.06);
  }
}
