/** 'N0746': Bilbao's mapped gallery masses, flared titanium shells and river atrium. */
import earcut from 'earcut';
import { prism } from './khmer-structure-geometry.mjs';

const simplify = (ring, tolerance) => {
  const p = ring.slice();
  let changed = true;
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        u = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
        );
      if (Math.hypot(b[0] - a[0] - dx * u, b[1] - a[1] - dz * u) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
};

export function buildBilbao(face, detail, r) {
  const Y = r.floorY,
    tolerance = [3.2, 0.65, 0.12, 0.02][detail],
    cap = (role, ring, up) => {
      const ix = earcut(ring.flatMap((p) => [p[0], p[2]]));
      for (let i = 0; i < ix.length; i += 3)
        face(
          role,
          ix.slice(i, i + 3).map((k) => ring[k]),
          [0, up, 0],
        );
    },
    beam = (a, b, width, role = 'frame') => {
      const axis = b.map((v, k) => v - a[k]),
        L = Math.hypot(...axis),
        n = Math.abs(axis[1]) < L * 0.95 ? [-axis[2], 0, axis[0]] : [1, 0, 0],
        N = Math.hypot(...n),
        u = n.map((v) => ((v / N) * width) / 2),
        v = [
          axis[1] * u[2] - axis[2] * u[1],
          axis[2] * u[0] - axis[0] * u[2],
          axis[0] * u[1] - axis[1] * u[0],
        ].map((v) => v / L),
        ring = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([s, t]) => p.map((q, k) => q + s * u[k] + t * v[k])),
        A = ring(a),
        B = ring(b);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(
          role,
          [A[i], A[j], B[j], B[i]],
          A[i].map((q, k) => q - a[k]),
        );
      }
      face(
        role,
        A,
        axis.map((v) => -v),
      );
      face(role, B, axis);
    },
    loft = (poly, role, height, id, lo = Y, flare = true) => {
      const p = simplify(poly.outline, tolerance),
        center = p.reduce((s, q) => s.map((v, k) => v + q[k] / p.length), [0, 0]),
        span = [0, 1].map((k) => Math.max(...p.map((q) => q[k])) - Math.min(...p.map((q) => q[k]))),
        rings = [1, 3, 7, 12][detail],
        sign = id % 2 ? 1 : -1,
        top = ([x, z]) =>
          Y +
          height -
          (flare
            ? Math.max(
                0,
                2.6 +
                  (2.4 * (x - center[0])) / (span[0] || 1) +
                  (sign * 2.1 * (z - center[1])) / (span[1] || 1),
              )
            : 0),
        point = (q, t) => {
          const s = flare ? 0.9 + 0.1 * t + 0.1 * Math.sin(Math.PI * t) : 1;
          return [
            center[0] + (q[0] - center[0]) * s + (flare ? sign * 0.9 * Math.sin(Math.PI * t) : 0),
            lo + (top(q) - lo) * t,
            center[1] + (q[1] - center[1]) * s,
          ];
        },
        levels = Array.from({ length: rings + 1 }, (_, j) => p.map((q) => point(q, j / rings))),
        area = p.reduce((s, a, i) => {
          const b = p[(i + 1) % p.length];
          return s + a[0] * b[1] - a[1] * b[0];
        }, 0),
        sgn = Math.sign(area);
      for (let j = 1; j < levels.length; j++)
        for (let i = 0; i < p.length; i++) {
          const k = (i + 1) % p.length,
            n = [(p[k][1] - p[i][1]) * sgn, 0.001, (p[i][0] - p[k][0]) * sgn];
          face(role, [levels[j - 1][i], levels[j - 1][k], levels[j][k], levels[j][i]], n);
        }
      cap(role, levels.at(-1), 1);
      if (detail) cap(role, levels[0], -1);
      return { p, top, point };
    };
  const parent = { outline: simplify(r.parent.outline, tolerance), holes: [] };
  prism(face, 'floor', parent, r.foundationY, Y, detail > 0);
  // The continuous low gallery follows the irregular parent, including its long east arm.
  for (const p of r.lowBody)
    prism(
      face,
      'metal',
      {
        outline: simplify(p.outline, tolerance),
        holes: p.holes.map((h) => simplify(h, tolerance)),
      },
      Y,
      Y + 11,
      detail > 0,
    );
  const stoneIds = new Set([
    118500240, 118500243, 118500249, 118500252, 118500255, 118501682, 118501684, 118506777,
    118506963, 118507297, 118507299,
  ]);
  for (const part of r.parts) {
    const id = part.id - 35184372088832,
      stone = stoneIds.has(id) || part.polygons[0].outline.every((q) => q[1] > 20),
      role = id === 118506013 ? 'glass' : stone ? 'stone' : 'metal';
    for (const poly of part.polygons) {
      const shell = loft(poly, role, part.height, id, Y, !stone);
      if (stone && detail) {
        const p = shell.p;
        cap(
          'roof',
          p.map(([x, z]) => [x, Y + part.height + 0.035, z]),
          1,
        );
        for (let i = 0; i < p.length; i++) {
          const a = p[i],
            b = p[(i + 1) % p.length],
            L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L < 12 || i % 3) continue;
          const n = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L],
            U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
            x = (a[0] + b[0]) / 2 + n[0] * 0.05,
            z = (a[1] + b[1]) / 2 + n[1] * 0.05,
            w = Math.min(4, L * 0.2),
            h = detail === 1 ? 1.2 : 1.7;
          face(
            'glass',
            [
              [-w / 2, 0],
              [w / 2, 0],
              [w / 2, h],
              [-w / 2, h],
            ].map(([u, v]) => [x + U[0] * u, Y + part.height - 4 + v, z + U[1] * u]),
            [n[0], 0, n[1]],
          );
        }
      }
    }
  }
  // Two swept, pointed gallery fins are integral to the long eastern museum wing.
  for (const lane of [0, 1]) {
    const N = [4, 7, 15, 25][detail],
      lower = [],
      upper = [],
      back = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        x = 3 + 111 * t,
        z = -19 + 31 * t + lane * 13;
      lower.push([x, Y + 11, z]);
      upper.push([x, Y + 18 + 4 * t + 2 * Math.sin(Math.PI * t), z - 3 * Math.sin(Math.PI * t)]);
      back.push([x, Y + 11, z + 8]);
    }
    for (let i = 0; i < N; i++) {
      face('metal', [lower[i], lower[i + 1], upper[i + 1], upper[i]], [0, 0, -1]);
      face('metal', [upper[i], upper[i + 1], back[i + 1], back[i]], [0, 1, 0.5]);
      face('metal', [back[i], back[i + 1], lower[i + 1], lower[i]], [0, -1, 0]);
    }
    face('metal', [lower[0], upper[0], back[0]], [-1, 0, 0]);
    face('metal', [lower.at(-1), upper.at(-1), back.at(-1)], [1, 0, 0]);
  }
  // Independently mapped raised canopy. Ground below the canopy is never removed.
  const canopy = simplify(r.roof.outline, tolerance),
    c = canopy.reduce((s, p) => s.map((v, k) => v + p[k] / canopy.length), [0, 0]),
    roofPoint = ([x, z], drop = 0) => [
      x,
      Y + 21.8 + 2.2 * Math.sin(((x + 33) / 29) * Math.PI) - drop,
      z,
    ];
  cap(
    'metal',
    canopy.map((q) => roofPoint(q)),
    1,
  );
  if (detail)
    cap(
      'frame',
      canopy.map((q) => roofPoint(q, 0.32)),
      -1,
    );
  for (let i = 0; i < canopy.length; i++) {
    const j = (i + 1) % canopy.length,
      a = canopy[i],
      b = canopy[j];
    face(
      'metal',
      [roofPoint(a), roofPoint(b), roofPoint(b, 0.32), roofPoint(a, 0.32)],
      [a[0] - c[0], 0, a[1] - c[1]],
    );
  }
  // Glazed river atrium and its sloping mullions; dark opaque glass avoids sorting cost.
  const A = [-32, -44],
    B = [-9, -35],
    N = detail ? [4, 7, 11][detail - 1] : 1;
  for (let i = 0; i < N; i++) {
    const u = i / N,
      v = (i + 1) / N,
      pt = (t, y) => [A[0] + (B[0] - A[0]) * t, y, A[1] + (B[1] - A[1]) * t],
      top = (t) => Y + 20.8 + 2.8 * Math.sin(Math.PI * t),
      a = pt(u, Y),
      b = pt(v, Y),
      a1 = pt(u, top(u)),
      b1 = pt(v, top(v));
    face('glass', [a, b, b1, a1], [0.3, 0, -1]);
    if (detail) beam(a, a1, detail === 1 ? 0.22 : 0.15);
  }
  if (detail) {
    for (const y of [5, 10, 15, 20])
      beam([A[0], Y + y, A[1] - 0.06], [B[0], Y + y, B[1] - 0.06], 0.14);
    beam([-11, Y, -42], [-14, Y + 21.7, -41], 0.65, 'stone');
    for (const side of [0, 1])
      beam(
        [A[0] + side * 23, Y, A[1] + side * 9],
        [A[0] + side * 23, Y + 21, A[1] + side * 9],
        0.3,
      );
    // The entry follows the parent's actual exposed gallery edge. No detached facade.
    const E = [-48.679829996, 56.827049899],
      F = [-45.201242118, 70.741532391],
      dx = F[0] - E[0],
      dz = F[1] - E[1],
      len = Math.hypot(dx, dz),
      nx = -dz / len,
      nz = dx / len,
      ep = (p, y) => [p[0] + nx * 0.09, y, p[1] + nz * 0.09];
    face('glass', [ep(E, Y), ep(F, Y), ep(F, Y + 15), ep(E, Y + 18)], [nx, 0, nz]);
    for (const [p, h] of [
      [E, 18],
      [F, 15],
    ])
      beam(ep(p, Y), ep(p, Y + h), 0.22);
    for (const y of [4, 8, 12]) beam(ep(E, Y + y), ep(F, Y + y), 0.13);
    const steps = detail === 1 ? 4 : 12,
      segments = detail === 1 ? 5 : 14;
    for (let j = 0; j < steps; j++) {
      const ri = 15 + j * 0.42 * (12 / steps),
        ro = 15 + (j + 1) * 0.42 * (12 / steps),
        hi = Y + 0.26 * (j + 1) * (12 / steps),
        point = (R, t) => [-32 + R * Math.cos(t), 60 + R * Math.sin(t)];
      for (let k = 0; k < segments; k++) {
        const a = 2.5 + (k / segments) * 0.9,
          b = 2.5 + ((k + 1) / segments) * 0.9;
        prism(
          face,
          'floor',
          { outline: [point(ri, a), point(ro, a), point(ro, b), point(ri, b)], holes: [] },
          r.foundationY,
          hi,
          detail > 1,
        );
      }
    }
    if (detail >= 2)
      for (const t of [2.5, 2.95, 3.4]) {
        const point = (R, y) => [-32 + R * Math.cos(t), y, 60 + R * Math.sin(t)];
        beam(point(15, Y + 1), point(20.04, Y + 4.12), 0.075);
        for (const R of [15.3, 19.8])
          beam(point(R, Y + (R - 15) * 0.62), point(R, Y + (R - 15) * 0.62 + 1), 0.06);
      }
    // Small high lantern glazing differentiates the crown from the metallic lobes.
    const crown = r.parts.find((p) => p.height === 41);
    if (crown)
      for (const p of crown.polygons) {
        const q = p.outline;
        for (let i = 0; i < q.length; i++) {
          const a = q[i],
            b = q[(i + 1) % q.length],
            n = [b[1] - a[1], 0, a[0] - b[0]];
          face(
            'glass',
            [
              [a[0], Y + 37, a[1]],
              [b[0], Y + 37, b[1]],
              [b[0], Y + 40, b[1]],
              [a[0], Y + 40, a[1]],
            ],
            n,
          );
          beam([a[0], Y + 37, a[1]], [a[0], Y + 40, a[1]], 0.18);
        }
      }
  }
}
