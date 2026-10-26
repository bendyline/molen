/** Photo-led birch roundwood footbridge; bridge-aligned axes are rotated by geographic heading. */
import { box } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildBirchBridge(face, detail, r) {
  const L = r.length,
    at = (x) => {
      const t = (x + L / 2) / L;
      return r.endYs[0] + t * (r.endYs[1] - r.endYs[0]) + r.camber * Math.sin(Math.PI * t);
    },
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => [r.cx + x, y, r.cz + z]),
        n,
      ),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    unit = (a) => a.map((v) => v / Math.hypot(...a)),
    log = (a, b, radius, seed, caps = true, flatTop = false) => {
      const t = unit(b.map((v, i) => v - a[i])),
        u = unit(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1])),
        v = cross(t, u),
        sides = detail === 3 ? 12 : detail === 2 ? 8 : 6,
        length = Math.hypot(...b.map((v, i) => v - a[i])),
        sections = detail >= 2 ? Math.max(1, Math.ceil(length / (detail === 3 ? 0.65 : 1.2))) : 1,
        S = (q, i) => {
          const angle = (i * 2 * Math.PI) / sides,
            wobble = detail >= 2 ? 1 + 0.025 * Math.sin(seed + q * 9 + i * 3) : 1;
          const p = a.map(
            (x, k) =>
              x +
              q * (b[k] - x) +
              radius * wobble * (u[k] * Math.cos(angle) + v[k] * Math.sin(angle)),
          );
          if (flatTop) {
            const centerY = a[1] + q * (b[1] - a[1]);
            if (p[1] >= centerY - 1e-8) p[1] = centerY + radius * 0.6;
          }
          return p;
        };
      for (let j = 0; j < sections; j++)
        for (let i = 0; i < sides; i++) {
          const q0 = j / sections,
            q1 = (j + 1) / sections,
            angle = ((i + 0.5) * 2 * Math.PI) / sides,
            n = u.map((x, k) => x * Math.cos(angle) + v[k] * Math.sin(angle)),
            patch = detail >= 2 && (seed * 7 + j * 11 + i * 3) % 17 === 0;
          if (patch) {
            const qa = q0 + (q1 - q0) * 0.3,
              qb = q0 + (q1 - q0) * 0.52;
            for (const [lo, hi, role] of [
              [q0, qa, 'birch'],
              [qa, qb, 'bark'],
              [qb, q1, 'birch'],
            ])
              f(role, [S(lo, i), S(lo, i + 1), S(hi, i + 1), S(hi, i)], n);
          } else f('birch', [S(q0, i), S(q0, i + 1), S(q1, i + 1), S(q1, i)], n);
        }
      if (caps) {
        f(
          'cutwood',
          Array.from({ length: sides }, (_, i) => S(0, i)),
          t.map((x) => -x),
        );
        f(
          'cutwood',
          Array.from({ length: sides }, (_, i) => S(1, i)),
          t,
        );
      }
    },
    railXs = Array.from({ length: 4 }, (_, i) => -L / 2 + (i * L) / 3);

  if (detail === 0) {
    // A closed continuous deck keeps the small bridge legible at skyline distance.
    for (let i = 0; i < 3; i++) {
      const a = railXs[i],
        b = railXs[i + 1],
        y0 = at(a),
        y1 = at(b),
        z0 = -0.85,
        z1 = 0.85,
        ps = [
          [a, y0, z0],
          [b, y1, z0],
          [b, y1, z1],
          [a, y0, z1],
        ],
        under = ps.map(([x, y, z]) => [x, y - 0.14, z]);
      f('birch', ps, [y0 - y1, b - a, 0]);
      f('birch', under, [y1 - y0, a - b, 0]);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        f(
          'birch',
          [under[k], under[j], ps[j], ps[k]],
          unit([ps[j][2] - ps[k][2], 0, ps[k][0] - ps[j][0]]),
        );
      }
    }
  } else {
    const count = Math.ceil(L / (detail === 1 ? 0.28 : 0.18)),
      step = L / count;
    for (let i = 0; i < count; i++) {
      const x = -L / 2 + (i + 0.5) * step,
        radius = step * 0.52;
      // Flatten the walking faces of the cross logs while retaining round lower edges.
      log(
        [x, at(x) - radius * 0.6, -0.86],
        [x, at(x) - radius * 0.6, 0.86],
        radius,
        i + 2,
        true,
        true,
      );
    }
  }
  for (const side of [-1, 1]) {
    const z = side * 0.85;
    for (let i = 0; i < 3; i++) {
      const a = railXs[i],
        b = railXs[i + 1];
      log([a, at(a) - 0.2, z * 0.82], [b, at(b) - 0.2, z * 0.82], 0.085, 70 + i);
      for (const y of [0.47, 1.02])
        log([a, at(a) + y, z], [b, at(b) + y, z], y > 0.5 ? 0.065 : 0.045, 80 + i + side);
      log([a, at(a) + 0.12, z], [b, at(b) + 0.83, z], 0.04, 92 + i + side);
    }
    for (let i = 0; i < railXs.length; i++) {
      const x = railXs[i];
      log([x, at(x) - 0.22, z], [x, at(x) + 1.08, z], 0.075, 110 + i + side);
    }
  }
  for (const support of r.supports) {
    const x = support.center[0] - r.cx,
      z = support.center[1] - r.cz;
    box(f, 'cutwood', x, support.bottom, z, 0.34, support.top - support.bottom, 1.88);
  }
}
