/** 'N0741_THEATRE': Giant-order river facade, courtyard and rounded canal-side roof corner. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildHermitageTheatre(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + r.floorY,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    bottom = r.minGround - r.floorY - 0.4,
    cylinder = (role, x, z, profile, sides = detail === 3 ? 12 : 6) => {
      const rings = profile.map(([y, radius]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (i * 2 * Math.PI) / sides;
          return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
        }),
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
    window = (w, lo, h, arch = false, niche = false, pediment = false) => {
      const radius = w.width / 2,
        spring = lo + h - (arch ? radius : 0),
        at = (u, y, v = 0.08) => [w.x + w.T[0] * u + w.N[0] * v, y, w.z + w.T[2] * u + w.N[2] * v],
        profile = [
          [-radius, lo],
          [radius, lo],
        ];
      if (arch)
        for (let i = 0, n = detail === 3 ? 8 : 4; i <= n; i++) {
          const a = (Math.PI * i) / n;
          profile.push([radius * Math.cos(a), spring + radius * Math.sin(a)]);
        }
      else profile.push([radius, lo + h], [-radius, lo + h]);
      const ps = profile.map(([u, y]) => at(u, y));
      for (let i = 1; i < ps.length - 1; i++)
        f(niche ? 'niche' : 'glass', [ps[0], ps[i], ps[i + 1]], w.N);
      if (detail >= 2)
        for (let i = 0; i < profile.length; i++) {
          const a = profile[i],
            b = profile[(i + 1) % profile.length];
          if (detail === 3) bar('trim', at(...a, 0.17), at(...b, 0.17), 0.14);
          else {
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              L = Math.hypot(dx, dy),
              u = (-dy * 0.1) / L,
              v = (dx * 0.1) / L;
            f(
              'trim',
              [
                at(a[0] - u, a[1] - v, 0.17),
                at(b[0] - u, b[1] - v, 0.17),
                at(b[0] + u, b[1] + v, 0.17),
                at(a[0] + u, a[1] + v, 0.17),
              ],
              w.N,
            );
          }
        }
      if (detail >= 2 && pediment) {
        const y = lo + h + 0.45;
        bar('trim', at(-radius - 0.2, y, 0.23), at(radius + 0.2, y, 0.23), 0.22);
        bar('trim', at(-radius - 0.2, y, 0.23), at(0, y + 0.8, 0.23), 0.18);
        bar('trim', at(0, y + 0.8, 0.23), at(radius + 0.2, y, 0.23), 0.18);
      }
      if (detail === 3 && !niche) {
        bar('trim', at(0, lo, 0.18), at(0, spring, 0.18), 0.075);
        bar('trim', at(-radius, lo + h * 0.5, 0.18), at(radius, lo + h * 0.5, 0.18), 0.075);
      }
      if (detail >= 2 && niche) {
        const p = at(0, lo + 0.25, 0.36);
        if (h < 2) {
          cylinder(
            'trim',
            p[0],
            p[2],
            [
              [lo + 0.1, 0.35],
              [lo + 0.45, 0.27],
            ],
            6,
          );
          cylinder(
            'trim',
            p[0],
            p[2],
            [
              [lo + 0.45, 0.17],
              [lo + 0.7, 0.25],
              [lo + 1.05, 0.13],
            ],
            6,
          );
        } else {
          box(f, 'trim', p[0], p[1], p[2], 0.8, 0.3, 0.55);
          cylinder(
            'trim',
            p[0],
            p[2],
            [
              [lo + 0.55, 0.27],
              [lo + 1.7, 0.32],
              [lo + 3.3, 0.38],
              [lo + 3.6, 0.23],
            ],
            6,
          );
          cylinder(
            'trim',
            p[0],
            p[2],
            [
              [lo + 3.6, 0.2],
              [lo + 3.9, 0.27],
              [lo + 4.25, 0.16],
            ],
            6,
          );
        }
      }
    };
  for (const p of r.body)
    prism(
      (role, ps, n) => {
        if (n[1] < 0.5) f(role, ps, n);
      },
      'wall',
      p,
      bottom,
      22.2,
    );
  for (const t of r.roofPanels[detail]) f('roof', t, [0, 1, 0]);
  for (const p of r.drumLevels[detail]) {
    prism(f, 'wall', p, 22.15, 24.15);
    prism(f, 'roof', p, 24.15, 24.35);
    if (detail)
      for (let i = 0; i < p.outline.length; i++) {
        const a = p.outline[i],
          b = p.outline[(i + 1) % p.outline.length];
        bar('trim', [a[0], 22.4, a[1]], [b[0], 22.4, b[1]], 0.35, 0.45);
      }
  }
  if (!detail) return;
  for (const e of r.edges) {
    const { a, b, N } = e;
    if (detail === 1 && e.L < 10) continue;
    for (const [y, width] of [
      [0.8, 0.3],
      [5.9, 0.28],
      [8.4, 0.45],
      [21.7, 0.65],
      [22.3, 0.35],
    ])
      bar(
        'trim',
        [a[0] + N[0] * 0.08, y, a[1] + N[2] * 0.08],
        [b[0] + N[0] * 0.08, y, b[1] + N[2] * 0.08],
        width,
        width + 0.15,
      );
    if (detail >= 2 && !e.court) {
      for (let y = 1.2; y < 8; y += 0.85)
        bar(
          'trim',
          [a[0] - N[0] * 0.03, y, a[1] - N[2] * 0.03],
          [b[0] - N[0] * 0.03, y, b[1] - N[2] * 0.03],
          0.05,
          0.08,
        );
    }
  }
  for (const w of r.windows) {
    if (detail === 1 && w.index % 2) continue;
    window(w, 1.35, 4.3);
    window(w, 6.25, 1.7, true);
    const niche = w.front && [0, 2, 14, 16].includes(w.index);
    window(w, 9.2, 5.7, niche, niche, !w.court && !niche);
    if (niche) {
      const medallion = { ...w, width: 1.2 };
      window(medallion, 18.0, 1.3, true, true);
    } else window(w, 17.8, 2.6);
  }
  for (const c of r.columns) {
    box(f, 'trim', c.x, 8.4, c.z, 1.3, 0.4, 1.3);
    cylinder('trim', c.x, c.z, [
      [8.8, 0.6],
      [9.15, 0.52],
      [20.9, 0.43],
      [21.15, 0.7],
      [21.55, 0.73],
    ]);
    box(f, 'trim', c.x, 21.55, c.z, 1.55, 0.35, 1.4);
    if (detail === 3)
      for (const sign of [-1, 1]) {
        bar(
          'trim',
          [c.x + sign * 0.42, 21.0, c.z - 0.15],
          [c.x + sign * 0.73, 21.4, c.z - 0.3],
          0.22,
        );
        bar(
          'trim',
          [c.x - 0.15, 21.0, c.z + sign * 0.42],
          [c.x - 0.3, 21.4, c.z + sign * 0.73],
          0.22,
        );
      }
  }
  if (detail >= 2) {
    for (const u of [-30, -26, 27, 32]) {
      const p = [r.front.center[0] + r.front.T[0] * u, r.front.center[1] + r.front.T[2] * u];
      box(f, 'trim', p[0], 9.1, p[1], 0.45, 12.2, 0.3);
    }
    for (const x of [-22, 0, 23]) {
      box(f, 'wall', x, 23.1, 5, 1.3, 1.7, 1.1);
      box(f, 'metal', x, 24.8, 5, 1.6, 0.2, 1.4);
    }
  }
}
