/** 'N0597': paired octagonal brick tomb towers; original relief, not traced inscriptions. */
import earcut from 'earcut';
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildKharaqanMasonry(face, detail, reconstruction, sample) {
  for (const tower of reconstruction.towers) {
    const R = tower.radius,
      bodyR = R * 0.87,
      shaftR = R * 0.13,
      H = tower.bodyHeight,
      c = Math.cos(tower.phaseRadians),
      s = Math.sin(tower.phaseRadians),
      point = ([x, y, z]) => [
        tower.center[0] + x * c - z * s,
        tower.floorY + y,
        tower.center[1] + x * s + z * c,
      ],
      f = (role, ps, n) =>
        face(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
      ring = (radius, n = 8, offset = 0) =>
        Array.from({ length: n }, (_, i) => [
          Math.cos((i * Math.PI * 2) / n + offset) * radius,
          Math.sin((i * Math.PI * 2) / n + offset) * radius,
        ]);
    const bottom = tower.bottomY - tower.floorY;
    prism(f, 'base', { outline: ring(R + 0.12, detail === 0 ? 8 : 16) }, bottom, 0.12);
    const apothem = bodyR * Math.cos(Math.PI / 8),
      half = bodyR * Math.sin(Math.PI / 8);
    const arch = (width, y, height, spring) => {
      const steps = detail < 2 ? 2 : detail === 2 ? 3 : 4,
        points = [
          [-width / 2, y],
          [width / 2, y],
          [width / 2, y + spring],
        ],
        rise = (height - spring) / (Math.sqrt(3) / 2);
      for (let i = 1; i <= steps; i++) {
        const a = (i * Math.PI) / (3 * steps);
        points.push([-width / 2 + width * Math.cos(a), y + spring + rise * Math.sin(a)]);
      }
      for (let i = 1; i <= steps; i++) {
        const a = (2 * Math.PI) / 3 + (i * Math.PI) / (3 * steps);
        points.push([width / 2 + width * Math.cos(a), y + spring + rise * Math.sin(a)]);
      }
      return points;
    };
    const extrude = (role, polygon, map, depth) => {
      const ix = earcut(polygon.flat());
      for (let i = 0; i < ix.length; i += 3) {
        const ps = ix.slice(i, i + 3).map((k) => polygon[k]);
        face(
          role,
          ps.map((p) => map(p, depth)),
          map.normal,
        );
      }
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length],
          dx = b[0] - a[0],
          dy = b[1] - a[1];
        face(role, [map(a, 0), map(b, 0), map(b, depth), map(a, depth)], map.sideNormal(dy, -dx));
      }
    };
    for (let side = 0; side < 8; side++) {
      const theta = ((side + 0.5) * Math.PI) / 4,
        n = [Math.cos(theta), Math.sin(theta)],
        u = [-n[1], n[0]],
        local = ([x, y], depth = 0) => [
          u[0] * x + n[0] * (apothem + depth),
          y,
          u[1] * x + n[1] * (apothem + depth),
        ],
        wallNormal = [n[0], 0, n[1]],
        map = (p, z) => point(local(p, z));
      map.normal = [n[0] * c - n[1] * s, 0, n[0] * s + n[1] * c];
      map.sideNormal = (x, y) => [u[0] * x * c - u[1] * x * s, y, u[0] * x * s + u[1] * x * c];
      const holes = [];
      if (detail > 0)
        holes.push({ polygon: arch(half * 1.38, 2.55, 6.9, 5.35), depth: 0.14, role: 'brick' });
      if (side === tower.doorFace)
        holes.push({ polygon: arch(0.96, 0.18, 2.12, 1.6), depth: 0.27, role: 'metal' });
      const outer = [
          [-half, 0.12],
          [half, 0.12],
          [half, H],
          [-half, H],
        ],
        rings = [outer, ...holes.map((h) => h.polygon)],
        flat = rings.flat(),
        starts = [];
      let count = outer.length;
      for (const r of rings.slice(1)) {
        starts.push(count);
        count += r.length;
      }
      const triangles = earcut(flat.flat(), starts);
      for (let i = 0; i < triangles.length; i += 3)
        f(
          'brick',
          triangles.slice(i, i + 3).map((k) => local(flat[k])),
          wallNormal,
        );
      for (const h of holes) {
        const ix = earcut(h.polygon.flat());
        for (let i = 0; i < ix.length; i += 3)
          f(
            h.role,
            ix.slice(i, i + 3).map((k) => local(h.polygon[k], -h.depth)),
            wallNormal,
          );
        for (let i = 0; i < h.polygon.length; i++) {
          const a = h.polygon[i],
            b = h.polygon[(i + 1) % h.polygon.length],
            dx = b[0] - a[0],
            dy = b[1] - a[1];
          f(
            'relief',
            [local(a), local(b), local(b, -h.depth), local(a, -h.depth)],
            [-dy * u[0], dx, -dy * u[1]],
          );
        }
      }
      if (detail >= 1) {
        // A broad, shallow raised pointed frame keeps the panel rhythm legible.
        const inner = arch(half * 1.38, 2.55, 6.9, 5.35),
          outer = arch(half * 1.55, 2.43, 7.2, 5.5),
          flat = [...outer, ...inner],
          ix = earcut(flat.flat(), [outer.length]);
        for (let i = 0; i < ix.length; i += 3)
          f(
            'relief',
            ix.slice(i, i + 3).map((k) => local(flat[k], 0.045)),
            wallNormal,
          );
        for (const [ring, sign] of [
          [outer, 1],
          [inner, -1],
        ])
          for (let i = 0; i < ring.length; i++) {
            const a = ring[i],
              b = ring[(i + 1) % ring.length],
              dx = b[0] - a[0],
              dy = b[1] - a[1];
            f(
              'relief',
              [local(a), local(b), local(b, 0.045), local(a, 0.045)],
              [sign * dy * u[0], -sign * dx, sign * dy * u[1]],
            );
          }
      }
      if (detail >= 2) {
        const bar = (x, y, dx, dy, length, width, depth = 0.06) => {
          const q = Math.hypot(dx, dy),
            vx = ((dx / q) * length) / 2,
            vy = ((dy / q) * length) / 2,
            wx = ((-dy / q) * width) / 2,
            wy = ((dx / q) * width) / 2,
            polygon = [
              [x - vx - wx, y - vy - wy],
              [x + vx - wx, y + vy - wy],
              [x + vx + wx, y + vy + wy],
              [x - vx + wx, y - vy + wy],
            ],
            m = (p, d) => map(p, -0.13 + d);
          m.normal = map.normal;
          m.sideNormal = map.sideNormal;
          extrude('relief', polygon, m, depth);
        };
        // Original basket/chevron pattern; all bars remain inside the recessed rectangle.
        for (let row = 0; row < (detail === 2 ? 3 : 5); row++)
          for (let column = -1; column <= 1; column++) {
            const x = column * 0.54,
              y = 3.35 + row * 0.85;
            if (tower.name === 'east') {
              bar(x - 0.09, y, 1, 1, 0.43, 0.105);
              bar(x + 0.09, y + 0.27, 1, -1, 0.43, 0.105);
            } else {
              bar(x, y, 1, row % 2 ? 1 : -1, 0.49, 0.11);
              bar(x + 0.1, y + 0.24, 1, 0, 0.34, 0.1);
            }
          }
        // Nonliteral large geometric frieze; no pseudo-script or copied Kufic lettering.
        for (let column = -2; column <= 2; column++) {
          const x = column * 0.44,
            y = 10.55;
          const diamond = [
              [x - 0.18, y],
              [x, y + 0.3],
              [x + 0.18, y],
              [x, y - 0.3],
            ],
            m = (p, d) => map(p, 0.025 + d);
          m.normal = map.normal;
          m.sideNormal = map.sideNormal;
          extrude('relief', diamond, m, 0.06);
        }
      }
      // Continuous string courses do not copy individual bricks or inscriptions.
      for (const y of detail === 0 ? [11.5] : [9.75, 10.0, 11.5]) {
        const a = local([-half, y], 0.055),
          b = local([half, y], 0.055),
          d = local([half, y + 0.12], 0.055),
          e = local([-half, y + 0.12], 0.055);
        f('relief', [a, b, d, e], wallNormal);
      }
    }
    // Solid octagonal top under the hollow cap; the roof slots above stay open.
    const outline = ring(bodyR);
    f(
      'brick',
      outline.map(([x, z]) => [x, H, z]),
      [0, 1, 0],
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        center = [Math.cos(a) * bodyR, Math.sin(a) * bodyR],
        sides = [6, 8, 12, 16][detail],
        profile =
          detail === 0
            ? [
                [0.12, shaftR],
                [H, shaftR],
              ]
            : [
                [0.12, shaftR * 1.08],
                [0.7, shaftR],
                [H - 0.3, shaftR],
                [H - 0.18, shaftR * 1.07],
                [H, shaftR * 1.07],
              ],
        rings = profile.map(([y, r]) =>
          ring(r, sides).map(([x, z]) => [x + center[0], y, z + center[1]]),
        );
      for (let j = 1; j < rings.length; j++)
        for (let k = 0; k < sides; k++) {
          const next = (k + 1) % sides,
            ps = [rings[j - 1][k], rings[j - 1][next], rings[j][next], rings[j][k]],
            theta = ((k + 0.5) * Math.PI * 2) / sides;
          f('brick', ps, [Math.cos(theta), 0.01, Math.sin(theta)]);
        }
      f('brick', rings[0], [0, -1, 0]);
      f('brick', rings.at(-1), [0, 1, 0]);
    }
    // Hollow curved brick cap. Four actual lower slots survive every LOD.
    const sides = [12, 16, 24, 32][detail],
      r0 = bodyR * 0.98,
      ys = detail === 0 ? [0, 0.45, 1.25, 2.4, 3] : [0, 0.45, 1.25, 2.4, 2.82, 3],
      outer = ys.map((dy) =>
        ring(r0 * Math.sqrt(Math.max(0, 1 - (dy / 3) ** 2)), sides).map(([x, z]) => [x, H + dy, z]),
      ),
      inner = ys.map((dy) =>
        ring(Math.max(0, r0 * Math.sqrt(Math.max(0, 1 - (dy / 3) ** 2)) - 0.15), sides).map(
          ([x, z]) => [x, H + dy - 0.035, z],
        ),
      ),
      gap = (j, i) => j === 1 && i % (sides / 4) === 0;
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < sides; i++) {
        const k = (i + 1) % sides,
          a = outer[j][i],
          b = outer[j][k],
          c = outer[j + 1][k],
          d = outer[j + 1][i],
          A = inner[j][i],
          B = inner[j][k],
          C = inner[j + 1][k],
          D = inner[j + 1][i],
          angle = ((i + 0.5) * Math.PI * 2) / sides,
          n = [Math.cos(angle), 0.4, Math.sin(angle)];
        if (!gap(j, i)) {
          f('brick', [a, b, c, d], n);
          f(
            'brick',
            [A, D, C, B],
            n.map((v) => -v),
          );
        } else {
          f('brick', [a, A, B, b], [0, 1, 0]);
          f('brick', [d, c, C, D], [0, -1, 0]);
          f(
            'brick',
            [a, d, D, A],
            [-Math.sin((i * Math.PI * 2) / sides), 0, Math.cos((i * Math.PI * 2) / sides)],
          );
          f(
            'brick',
            [b, B, C, c],
            [Math.sin((k * Math.PI * 2) / sides), 0, -Math.cos((k * Math.PI * 2) / sides)],
          );
        }
      }
    if (detail >= 2 && tower.name === 'west') {
      const adapter = {
        addQuad: (role, _ref, ps, n) => f(role, ps, n),
        addTriangle: (role, _ref, ps, n) => f(role, ps, n),
        addConvexPolygon: (role, _ref, ps, n) => f(role, ps, n),
      };
      for (const side of [1, 3, 5, 7]) {
        const a = ((side + 0.5) * Math.PI) / 4,
          n = [Math.cos(a), Math.sin(a)],
          foot = [n[0] * (apothem + 1.03), 0, n[1] * (apothem + 1.03)],
          p = point(foot),
          baseY = sample(p[0], p[2]) - tower.floorY + 0.035;
        beam(
          adapter,
          'metal',
          [foot[0], baseY, foot[2]],
          [n[0] * (apothem + 0.14), H - 0.8, n[1] * (apothem + 0.14)],
          0.12,
          0.13,
        );
        box(f, 'metal', foot[0], baseY - 0.035, foot[2], 0.25, 0.09, 0.25);
      }
    }
  }
}
