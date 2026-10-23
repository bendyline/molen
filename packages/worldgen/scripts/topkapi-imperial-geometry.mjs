/** 'N0742_IMPERIAL': Low brick gatehouse, marble portals and inclined vaulted passage. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiImperial(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    grade = (z) => (r.frontControlZ - z) * r.floorSlope,
    f = (role, ps, n) =>
      face(
        role,
        ps.map((p) => P(role === 'floor' ? [p[0], p[1] + grade(p[2]), p[2]] : p)),
        D(n),
      ),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    segment = (x, R, rise) => {
      const radius = (R * R + rise * rise) / (2 * rise);
      return rise - radius + Math.sqrt(Math.max(0, radius * radius - x * x));
    },
    pointed = (x, R, rise) => {
      const a = (rise * rise - R * R) / (2 * R);
      return Math.sqrt(Math.max(0, (R + a) * (R + a) - (Math.abs(x) + a) * (Math.abs(x) + a)));
    },
    curve = (x, R, rise, point) => (point ? pointed(x, R, rise) : segment(x, R, rise)),
    profile = (R, spring, rise, point, n) => {
      const p = [
        [-R, 0],
        [R, 0],
      ];
      for (let i = 0; i <= n; i++) {
        const x = R - (2 * R * i) / n;
        p.push([x, spring + curve(x, R, rise, point)]);
      }
      return p;
    },
    cylinder = (role, x, z, base, profile, sides = 8) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: sides }, (_, i) => [
          x + R * Math.cos(((i + 0.5) * 2 * Math.PI) / sides),
          base + y,
          z + R * Math.sin(((i + 0.5) * 2 * Math.PI) / sides),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < sides; i++) {
          const k = (i + 1) % sides;
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0, rings[j][i][2] - z],
          );
        }
      for (const [ring, normal] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 0; i < sides; i++)
          f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, normal, 0]);
    },
    bore = (z0, z1, R, spring, rise, point, n) => {
      box(f, 'wall', (-20.5 - R) / 2, -1, (z0 + z1) / 2, 20.5 - R, 11.7, z1 - z0);
      box(f, 'wall', (20.4 + R) / 2, -1, (z0 + z1) / 2, 20.4 - R, 11.7, z1 - z0);
      for (let i = 0; i < n; i++) {
        const a = -R + (2 * R * i) / n,
          b = -R + (2 * R * (i + 1)) / n,
          ya = spring + curve(a, R, rise, point),
          yb = spring + curve(b, R, rise, point);
        for (const [z, N] of [
          [z0, -1],
          [z1, 1],
        ])
          f(
            'wall',
            [
              [a, ya + grade(z), z],
              [b, yb + grade(z), z],
              [b, 10.7, z],
              [a, 10.7, z],
            ],
            [0, 0, N],
          );
        f(
          'wall',
          [
            [a, ya + grade(z0), z0],
            [b, yb + grade(z0), z0],
            [b, yb + grade(z1), z1],
            [a, ya + grade(z1), z1],
          ],
          [0, -1, 0],
        );
        f(
          'roof',
          [
            [a, 10.7, z0],
            [b, 10.7, z0],
            [b, 10.7, z1],
            [a, 10.7, z1],
          ],
          [0, 1, 0],
        );
      }
    },
    panel = (role, cx, z, N, p, base = grade(z)) => {
      const points = p.map(([x, y]) => [cx + x, base + y, z]);
      for (let i = 1; i < points.length - 1; i++)
        f(role, [points[0], points[i], points[i + 1]], [0, 0, N]);
    },
    ringBand = (cx, z, N, R, spring, rise, width, point, role = 'trim') => {
      const n = [4, 6, 12, 20][detail],
        base = grade(z);
      for (let i = 0; i < n; i++) {
        const a = -R + (2 * R * i) / n,
          b = -R + (2 * R * (i + 1)) / n,
          ya = spring + curve(a, R, rise, point),
          yb = spring + curve(b, R, rise, point);
        f(
          role,
          [
            [cx + a, base + ya, z],
            [cx + b, base + yb, z],
            [cx + (b * (R + width)) / R, base + yb + width, z],
            [cx + (a * (R + width)) / R, base + ya + width, z],
          ],
          [0, 0, N],
        );
        if (detail >= 2)
          f(
            role,
            [
              [cx + a, base + ya, z],
              [cx + b, base + yb, z],
              [cx + b, base + yb, z - N * 0.18],
              [cx + a, base + ya, z - N * 0.18],
            ],
            [0, -1, 0],
          );
      }
      for (const sign of [-1, 1])
        box(
          f,
          role,
          cx + sign * (R + width / 2),
          base + 0.12,
          z - N * 0.1,
          width,
          spring - 0.12,
          0.2,
        );
    },
    plaque = (x, y, z, N, w, h) => {
      const base = grade(z);
      box(f, 'panel', x, base + y, z, w, h, 0.08);
      for (const dy of [0, h])
        bar(
          'gold',
          [x - w / 2, base + y + dy, z + N * 0.06],
          [x + w / 2, base + y + dy, z + N * 0.06],
          0.075,
        );
      for (const dx of [-w / 2, w / 2])
        bar('gold', [x + dx, base + y, z + N * 0.06], [x + dx, base + y + h, z + N * 0.06], 0.075);
      // Original geometric accents only; no copied calligraphy, tughra or readable text.
      if (detail >= 2)
        for (let i = 0; i < Math.max(2, Math.floor(w / 0.55)); i++) {
          const u = x - w / 2 + ((i + 0.5) * w) / Math.max(2, Math.floor(w / 0.55));
          bar(
            'gold',
            [u - 0.14, base + y + h / 2, z + N * 0.07],
            [u, base + y + h * 0.76, z + N * 0.07],
            0.025,
          );
          bar(
            'gold',
            [u, base + y + h * 0.76, z + N * 0.07],
            [u + 0.14, base + y + h / 2, z + N * 0.07],
            0.025,
          );
        }
    };

  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, 0);
  bore(-6.35, 6.35, 1.9, 3.25, 0.9, false, [6, 8, 14, 24][detail]);
  // Tall blind recesses reveal the real lower passage on both faces of the solid gatehouse.
  bore(6.35, 7.32, 2.8, 6.0, 3.05, true, [6, 8, 14, 24][detail]);
  bore(-7.32, -6.35, 2.8, 5.7, 3.05, true, [6, 8, 14, 24][detail]);
  for (const N of [-1, 1]) {
    const z = N * 7.34,
      base = grade(z),
      inside = z - N * 0.82;
    // A small stone plinth and continuous coping connect the brick wings.
    for (const sign of [-1, 1]) box(f, 'ashlar', sign * 11.3, -0.6, z, 18.4, 1.75, 0.12);
    box(f, 'ashlar', -0.05, 10.65, z, 41.05, 0.28, 0.3);
    box(f, 'trim', -0.05, 10.95, z, 41.2, 0.2, 0.42);
    if (detail)
      for (let i = 0, n = detail === 1 ? 32 : detail === 2 ? 50 : 72; i < n; i++)
        box(f, 'trim', -20.3 + ((i + 0.5) * 40.5) / n, 10.78, z + N * 0.1, 0.22, 0.3, 0.34);
    // Marble frontispiece: outer jambs/lintel and two pointed blind niches.
    for (const sign of [-1, 1]) {
      box(f, 'trim', sign * 3.17, base + 0.03, z + N * 0.08, 0.45, 9.65, 0.32);
      box(f, 'trim', sign * 5.7, base + 0.03, z + N * 0.03, 0.28, 7.6, 0.22);
      box(f, 'trim', sign * 4.45, base + 0.05, z, 2.15, 0.3, 0.25);
      box(f, 'trim', sign * 4.45, base + 6.82, z, 2.15, 0.24, 0.25);
      panel(
        'ashlar',
        sign * 4.45,
        z + N * 0.1,
        N,
        profile(0.87, 3.9, 1.25, true, [4, 6, 12, 18][detail]),
      );
      ringBand(sign * 4.45, z + N * 0.28, N, 0.87, 3.9, 1.25, 0.18, true);
      if (detail >= 2) {
        const c = sign * 4.45;
        box(f, 'trim', c, base + 0.45, z + N * 0.18, 1.35, 0.15, 0.12);
        panel('trim', c, z + N * 0.2, N, [
          [-0.63, 0.6],
          [0.63, 0.6],
          [0.63, 2.45],
          [0, 2.9],
          [-0.63, 2.45],
        ]);
      }
      if (detail) plaque(sign * 4.45, 5.75, z + N * 0.18, N, 1.75, 0.62);
    }
    box(f, 'trim', 0, base + 9.55, z + N * 0.08, 6.8, 0.35, 0.35);
    ringBand(0, z + N * 0.22, N, 2.8, N === 1 ? 6 : 5.7, 3.05, 0.25, true);
    if (detail) {
      ringBand(0, inside + N * 0.05, N, 1.9, 3.25, 0.9, 0.22, false);
      const G = grade(inside),
        upper = profile(2.65, N === 1 ? 6 : 5.7, 2.85, true, [6, 8, 14, 20][detail]);
      // The ornamental upper panel is solid; only the lower route is walk-through.
      panel(
        'panel',
        0,
        inside + N * 0.03,
        N,
        upper.map(([x, y]) => [x, Math.max(6.25, y)]),
        G,
      );
      plaque(0, 4.7, inside + N * 0.09, N, 4.8, 1.05);
      // Paired green-grey stone columns and original stepped abstract capitals.
      for (const sign of [-1, 1]) {
        cylinder(
          'column',
          sign * 2.52,
          inside + N * 0.12,
          G,
          [
            [0.25, 0.25],
            [0.55, 0.25],
            [0.75, 0.19],
            [5.75, 0.19],
            [5.95, 0.3],
          ],
          detail === 3 ? 12 : 8,
        );
        box(f, 'trim', sign * 2.52, G + 5.95, inside + N * 0.12, 0.7, 0.35, 0.55);
        if (detail >= 2)
          for (let k = 0; k < 3; k++)
            box(
              f,
              'trim',
              sign * 2.52,
              G + 6.3 + k * 0.12,
              inside + N * 0.12,
              0.66 - k * 0.12,
              0.12,
              0.52 - k * 0.08,
            );
      }
      const cy = G + 4.42,
        R = 0.44,
        n = detail === 3 ? 20 : 12;
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n,
          b = ((i + 1) * 2 * Math.PI) / n;
        f(
          'panel',
          [
            [0, cy, inside + N * 0.12],
            [Math.cos(a) * R, cy + Math.sin(a) * R, inside + N * 0.12],
            [Math.cos(b) * R, cy + Math.sin(b) * R, inside + N * 0.12],
          ],
          [0, 0, N],
        );
        bar(
          'gold',
          [Math.cos(a) * R, cy + Math.sin(a) * R, inside + N * 0.13],
          [Math.cos(b) * R, cy + Math.sin(b) * R, inside + N * 0.13],
          0.045,
        );
      }
      if (detail >= 2) {
        const rise = N === 1 ? 6 : 5.7;
        for (let i = -3; i <= 3; i++) {
          const x = i * 0.58,
            top = rise + pointed(x, 2.65, 2.85);
          bar(
            'gold',
            [x, G + 6.3, inside + N * 0.07],
            [x, G + top - 0.12, inside + N * 0.07],
            0.035,
          );
        }
      }
    }
    for (const x of [-13.8, 12.8]) {
      panel('void', x, z + N * 0.03, N, [
        [-0.11, 3.4],
        [0.11, 3.4],
        [0.11, 4.15],
        [-0.11, 4.15],
      ]);
      if (detail >= 2) {
        for (const dx of [-0.2, 0.2])
          bar(
            'ashlar',
            [x + dx, base + 3.3, z + N * 0.05],
            [x + dx, base + 4.25, z + N * 0.05],
            0.12,
          );
      }
    }
  }
  // A low inferred cap closes the inaccessible top without inventing a lost upper storey.
  box(f, 'roof', -0.05, 10.71, 0, 40.6, 0.12, 14.1);
  for (const x of [-20.45, 20.4]) box(f, 'wall', x, 10.7, 0, 0.2, 0.5, 14.6);
  if (detail === 3)
    for (const x of [-18, -12, -6, 0, 6, 12, 18])
      bar('roof', [x, 10.86, -6.9], [x, 10.86, 6.9], 0.025);
}
