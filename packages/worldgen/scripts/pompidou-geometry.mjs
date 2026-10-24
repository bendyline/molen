/** 'centre_georges_pompidou': Pompidou exterior frame, gerberettes, escalator and service facade. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildPompidou(face, detail, r) {
  const Y = r.floorY,
    L = r.length,
    half = L / 2,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n));
  const rod = (
    role,
    a,
    b,
    radius,
    sides = detail === 3 ? 10 : detail === 2 ? 8 : 6,
    endCap = true,
  ) => {
    const d = b.map((v, k) => v - a[k]),
      len = Math.hypot(...d),
      axis = d.map((v) => v / len),
      seed = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
      cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ],
      u0 = cross(axis, seed),
      u = u0.map((v) => v / Math.hypot(...u0)),
      v = cross(axis, u),
      rings = [a, b].map((c) =>
        Array.from({ length: sides }, (_, i) =>
          c.map(
            (q, k) =>
              q +
              radius *
                (u[k] * Math.cos((i * Math.PI * 2) / sides) +
                  v[k] * Math.sin((i * Math.PI * 2) / sides)),
          ),
        ),
      );
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides,
        n = rings[0][i].map((q, k) => q - a[k]);
      f(role, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], n);
    }
    for (let i = 1; i < sides - 1; i++) {
      f(
        role,
        [rings[0][0], rings[0][i], rings[0][i + 1]],
        axis.map((v) => -v),
      );
      if (endCap) f(role, [rings[1][0], rings[1][i], rings[1][i + 1]], axis);
    }
  };
  prism(f, 'floor', r.floors[0], r.foundationY, Y);
  box(f, 'glass', 0, Y + 0.05, 0, r.coreLength, 41.5, r.coreWidth);
  box(f, 'roof', 0, Y + 41.5, 0, r.coreLength, 0.5, r.coreWidth);
  const stations = detail ? 14 : 7,
    step = L / (stations - 1),
    sides = detail === 3 ? 10 : detail === 2 ? 8 : 6;
  for (let i = 0; i < stations; i++) {
    const x = -half + i * step;
    for (const z of [-26, 26]) {
      if (detail) rod('white', [x, r.foundationY, z], [x, Y + 43, z], 0.48, sides);
      else box(f, 'white', x, Y, z, 0.95, 43, 0.95);
      if (detail > 1) box(f, 'floor', x, r.foundationY, z, 1.7, Y - r.foundationY, 1.7);
      for (const j of detail === 1 ? [1, 3, 6] : detail ? [1, 2, 3, 4, 5, 6] : [6]) {
        const y = Y + j * 6.9,
          sign = Math.sign(z);
        // Solid tapered cantilever wedge instead of a cosmetic flat triangle.
        const q = [
            [-0.33, y - 0.25, z - sign * 2.1],
            [-0.33, y + 0.55, z - sign * 2.1],
            [-0.33, y + 0.2, z + sign * 4.2],
          ],
          t = q.map((p) => [0.33, p[1], p[2]]);
        f('white', q, [-1, 0, 0]);
        f('white', t, [1, 0, 0]);
        for (let k = 0; k < 3; k++) {
          const n = (k + 1) % 3;
          f('white', [q[k], q[n], t[n], t[k]], [0, k === 0 ? 1 : -1, sign]);
        }
      }
    }
    if (detail > 1) {
      for (const j of [1, 2, 3, 4, 5, 6]) {
        const y = Y + j * 6.9;
        rod('white', [x, y, -25.8], [x, y, 25.8], 0.19, 6);
        if (detail === 3 || i === 0 || i === stations - 1)
          for (let k = 0; k < 6; k++) {
            const a = -25.8 + k * 8.6,
              b = a + 8.6;
            rod('white', [x, y, a], [x, y - 1.5, b], 0.13, 6);
            rod('white', [x, y - 1.5, a], [x, y, b], 0.13, 6);
          }
      }
    }
  }
  for (const z of [-25.9, 25.9]) {
    for (let j = 1; j <= 6; j++) box(f, 'white', 0, Y + j * 6.9 - 0.18, z, L, 0.36, 0.38);
    if (detail)
      for (let i = 0; i < 13; i += detail < 3 ? 2 : 1) {
        const x = -half + (i * L) / 13,
          b = Math.min(half, x + (L / 13) * (detail < 3 ? 2 : 1));
        for (const [lo, hi] of detail < 3
          ? [
              [0, 3],
              [3, 6],
            ]
          : [
              [0, 2],
              [2, 4],
              [4, 6],
            ]) {
          rod('white', [x, Y + lo * 6.9, z], [b, Y + hi * 6.9, z], detail === 1 ? 0.18 : 0.13, 6);
          rod('white', [b, Y + lo * 6.9, z], [x, Y + hi * 6.9, z], detail === 1 ? 0.18 : 0.13, 6);
        }
      }
  }
  if (detail > 1) {
    for (const z of [-22.55, 22.55]) {
      for (let i = 0; i <= 52; i += detail === 2 ? 2 : 1)
        box(f, 'white', -r.coreLength / 2 + (i * r.coreLength) / 52, Y + 0.05, z, 0.1, 41.4, 0.1);
      for (let j = 1; j <= 6; j++) box(f, 'white', 0, Y + j * 6.9, z, r.coreLength, 0.12, 0.12);
    }
    // End-wall glazing bars and roof-level spine.
    for (const x of [-r.coreLength / 2 - 0.05, r.coreLength / 2 + 0.05])
      for (let k = 0; k <= 14; k++)
        box(f, 'white', x, Y + 0.05, -22.5 + (k * 45) / 14, 0.12, 41.5, 0.12);
    for (const z of [-16, 0, 16]) box(f, 'roof', 0, Y + 42, z, L - 5, 0.5, 1.1);
  }
  // Western caterpillar: six rising flights joined by short level landings.
  const tubeZ = 30.6,
    path = [];
  for (let j = 0; j <= 6; j++) {
    const x = -half + 2 + (j * (L - 4)) / 6,
      y = Y + 1.8 + j * 6.6;
    path.push([x, y, tubeZ]);
    if (j < 6) path.push([x + 8, y, tubeZ]);
  }
  const ringAt = (p) =>
    Array.from({ length: detail > 1 ? 12 : 6 }, (_, k) => [
      p[0],
      p[1] + 1.55 * Math.cos((k * Math.PI * 2) / (detail > 1 ? 12 : 6)),
      p[2] + 1.55 * Math.sin((k * Math.PI * 2) / (detail > 1 ? 12 : 6)),
    ]);
  for (let i = 0; i < path.length - 1; i++) {
    const a = ringAt(path[i]),
      b = ringAt(path[i + 1]);
    for (let k = 0; k < a.length; k++) {
      const j = (k + 1) % a.length,
        mid = ((k + 0.5) * Math.PI * 2) / a.length;
      f(
        Math.cos(mid) < -0.35 ? 'red' : 'glass',
        [a[k], a[j], b[j], b[k]],
        [0, Math.cos(mid), Math.sin(mid)],
      );
    }
    if (detail)
      rod(
        'red',
        [path[i][0], path[i][1] - 1.5, tubeZ],
        [path[i + 1][0], path[i + 1][1] - 1.5, tubeZ],
        0.22,
        detail ? 6 : 4,
      );
    if (detail > 1) {
      const d = path[i + 1].map((v, k) => v - path[i][k]),
        n = Math.max(1, Math.ceil(Math.hypot(...d) / (detail === 2 ? 12 : 2.5)));
      for (let j = 0; j < n; j++) {
        const c = path[i].map((v, k) => v + (d[k] * j) / n),
          ring = ringAt(c).filter((_, k) => detail === 3 || k % 2 === 0);
        for (let k = 0; k < ring.length; k++)
          rod('white', ring[k], ring[(k + 1) % ring.length], 0.055, 4);
      }
    }
  }
  for (const [p, normal] of [
    [path[0], [-1, 0, 0]],
    [path.at(-1), [1, 0, 0]],
  ]) {
    const ring = ringAt(p);
    for (let i = 1; i < ring.length - 1; i++) f('glass', [ring[0], ring[i], ring[i + 1]], normal);
  }
  // Representative service banks retain their color and location at every LOD.
  const pipeCount = detail > 1 ? 28 : detail ? 14 : 6;
  for (let i = 0; i < pipeCount; i++) {
    const x = -half + 4 + (i * (L - 8)) / (pipeCount - 1),
      end = Y + 41 + (i % 3) * 0.4;
    rod('blue', [x, Y + 1.2, -29], [x, end, -29], detail ? 0.55 : 0.8, sides);
    if (detail) {
      if (detail === 1) rod('blue', [x, end, -29], [x, Y + 41, -24], 0.55, sides);
      else {
        rod('blue', [x, end, -29], [x, end + 1, -27], 0.55, sides);
        rod('blue', [x, end + 1, -27], [x, Y + 41, -24], 0.55, sides);
      }
    }
  }
  for (const x0 of [-L * 0.31, L * 0.31]) {
    const count = detail > 1 ? 6 : detail ? 3 : 1;
    for (let i = 0; i < count; i++)
      rod(
        'green',
        [x0 - 4.5 + i * 0.68, Y + 0.3, -31],
        [x0 - 4.5 + i * 0.68, Y + 46, -31],
        detail ? 0.29 : 0.85,
        sides,
      );
    for (let j = 0; j <= 6; j += detail ? 1 : 3) box(f, 'red', x0, Y + j * 6.9, -26, 5.6, 0.8, 6.8);
    box(f, 'red', x0, Y + 46, -26, 7.2, 3, 7.2);
    for (const dx of [-3.1, 3.1])
      rod('white', [x0 + dx, Y, -29.4], [x0 + dx, Y + 46, -29.4], 0.17, 6);
    if (detail > 1)
      for (let j = 0; j < 6; j++)
        rod('white', [x0 - 2.7, Y + j * 6.9, -29.6], [x0 + 2.7, Y + (j + 1) * 6.9, -29.6], 0.17, 6);
  }
  if (detail)
    for (const j of [2, 4, 6]) box(f, 'yellow', 0, Y + j * 6.9 - 1.5, -24, L - 6, 0.65, 0.65);
  // Large street-level intake mouths are finite recessed rings, not black decals.
  if (detail > 1)
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const x = side * (half - 5 - i * 3.2),
          z = -30;
        rod('white', [x, Y, z], [x, Y + 6.5, z], 1.22, 12);
        rod('white', [x, Y + 6.5, z], [x, Y + 7.8, z - 1.8], 1.22, 12);
        rod('white', [x, Y + 7.8, z - 1.8], [x, Y + 7.8, z - 3], 1.22, 12, false);
        const outer = Array.from({ length: 12 }, (_, k) => [
            x + 1.22 * Math.cos((k * Math.PI) / 6),
            Y + 7.8 + 1.22 * Math.sin((k * Math.PI) / 6),
            z - 3.01,
          ]),
          inner = Array.from({ length: 12 }, (_, k) => [
            x + 1.02 * Math.cos((k * Math.PI) / 6),
            Y + 7.8 + 1.02 * Math.sin((k * Math.PI) / 6),
            z - 3.01,
          ]),
          back = inner.map((p) => [p[0], p[1], z - 2.5]);
        for (let k = 0; k < 12; k++) {
          const j = (k + 1) % 12;
          f('white', [outer[k], outer[j], inner[j], inner[k]], [0, 0, -1]);
          f(
            'roof',
            [inner[k], inner[j], back[j], back[k]],
            [x - inner[k][0], Y + 7.8 - inner[k][1], 0],
          );
        }
        for (let k = 1; k < 11; k++) f('roof', [back[0], back[k], back[k + 1]], [0, 0, -1]);
      }
}
