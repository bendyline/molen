/** 'new_hermitage': Two courts, raised corner halls, classical frontage and ten-figure portico. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildNewHermitage(face, detail, r) {
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
    loft = (role, rings) => {
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < rings[j].length; i++) {
          const k = (i + 1) % rings[j].length,
            center = rings[j].reduce(
              (s, p) => s.map((v, k) => v + p[k] / rings[j].length),
              [0, 0, 0],
            );
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - center[0], 0, rings[j][i][2] - center[2]],
          );
        }
      for (const [ring, normal] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ]) {
        const center = ring.reduce((s, p) => s.map((v, k) => v + p[k] / ring.length), [0, 0, 0]);
        for (let i = 0; i < ring.length; i++)
          f(role, [center, ring[i], ring[(i + 1) % ring.length]], [0, normal, 0]);
      }
    },
    window = (w, lo, h, width = w.width, arch = false, niche = false) => {
      const radius = width / 2,
        spring = lo + h - (arch ? radius : 0),
        at = (u, y, v = 0.07) => [w.x + w.T[0] * u + w.N[0] * v, y, w.z + w.T[2] * u + w.N[2] * v],
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
        f(niche ? 'figure' : 'glass', [ps[0], ps[i], ps[i + 1]], w.N);
      if (detail >= 2)
        for (let i = 0; i < profile.length; i++) {
          const a = profile[i],
            b = profile[(i + 1) % profile.length];
          if (detail === 3) bar('trim', at(...a, 0.16), at(...b, 0.16), 0.15);
          else {
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              L = Math.hypot(dx, dy),
              u = (-dy * 0.1) / L,
              v = (dx * 0.1) / L;
            f(
              'trim',
              [
                at(a[0] - u, a[1] - v, 0.16),
                at(b[0] - u, b[1] - v, 0.16),
                at(b[0] + u, b[1] + v, 0.16),
                at(a[0] + u, a[1] + v, 0.16),
              ],
              w.N,
            );
          }
        }
      if (detail === 3 && !niche) {
        bar('trim', at(0, lo, 0.17), at(0, spring, 0.17), 0.075);
        bar('trim', at(-radius, lo + h * 0.5, 0.17), at(radius, lo + h * 0.5, 0.17), 0.075);
      }
      if (detail >= 2 && !w.court) {
        bar(
          'trim',
          at(-radius - 0.2, lo + h + 0.25, 0.2),
          at(radius + 0.2, lo + h + 0.25, 0.2),
          0.22,
          0.32,
        );
        if (lo > 8) {
          const p = at(0, lo + h + 1.2, 0.09);
          box(f, 'trim', p[0], p[1], p[2], width + 0.7, 0.85, 0.12);
        }
      }
    };

  for (const p of r.body) prism(f, 'floor', p, bottom, 0.15);
  for (const p of r.masses)
    prism(
      (role, ps, n) => {
        if (n[1] < 0.5) f(role, ps, n);
      },
      'wall',
      p,
      0.15,
      p.height,
      false,
    );
  for (const t of r.roofPanels[detail]) f('roof', t, [0, 1, 0]);
  if (detail) {
    for (const e of r.edges) {
      if (detail === 1 && e.L < 10) continue;
      const { a, b, N, height } = e;
      for (const [y, width] of [
        [0.8, 0.3],
        [8.3, 0.38],
        [height - 0.35, 0.55],
        [height + 0.1, 0.4],
      ])
        bar(
          'trim',
          [a[0] + N[0] * 0.1, y, a[1] + N[2] * 0.1],
          [b[0] + N[0] * 0.1, y, b[1] + N[2] * 0.1],
          width,
          width + 0.15,
        );
      if (detail >= 2 && !e.court) {
        const count = Math.max(1, Math.floor(e.L / 5));
        for (let i = 0; i <= count; i++) {
          const t = i / count,
            x = a[0] + (b[0] - a[0]) * t,
            z = a[1] + (b[1] - a[1]) * t;
          box(f, 'trim', x + N[0] * 0.1, 9, z + N[2] * 0.1, 0.45, Math.min(9.8, height - 10), 0.3);
        }
      }
    }
    for (const w of r.windows) {
      if (detail === 1 && w.index % 2) continue;
      if (w.height > 24) {
        if (!w.behindPortico) window(w, 2, 4.8, w.width, false, false);
        window(w, 10.1, 6, w.width);
        window(w, 21.1, 3.3, w.width * 0.8);
      } else {
        if (!w.behindPortico) window(w, 2, 4.8, w.width, w.court, w.front);
        window(w, 10.1, 6, w.width);
      }
    }
  }

  const p = r.portico,
    Q = ([u, y, v]) => [
      p.center[0] + p.T[0] * u + p.N[0] * v,
      y,
      p.center[1] + p.T[2] * u + p.N[2] * v,
    ],
    F = (role, ps, n) =>
      f(role, ps.map(Q), [p.T[0] * n[0] + p.N[0] * n[2], n[1], p.T[2] * n[0] + p.N[2] * n[2]]),
    B = (role, a, b, w, d = w) => bar(role, Q(a), Q(b), w, d);
  // The occupied podium and steps are bounded to the actual entrance approach.
  box(F, 'floor', 0, bottom, 3.2, 23, 1.55 - bottom, 6.4);
  for (let i = 0, n = detail ? 6 : 2; i < n; i++)
    box(
      F,
      'floor',
      0,
      bottom,
      6.4 + ((i + 0.5) * 2.4) / n,
      8,
      1.55 * (1 - i / n) - bottom,
      2.4 / n + 0.01,
    );
  // A sloped side approach joins the same entrance floor; no precinct-wide slab.
  const ramp = {
    outline: [
      [-26, 1.7],
      [-11.5, 1.7],
      [-11.5, 4.5],
      [-26, 4.5],
    ],
    holes: [],
  };
  prism(
    (role, ps, n) =>
      F(
        role,
        ps.map(([x, y, z]) => [x, y === 1 ? Math.max(0, (1.55 * (x + 26)) / 14.5) : bottom, z]),
        n,
      ),
    'floor',
    ramp,
    0,
    1,
  );
  box(F, 'trim', 0, 7.9, 3.1, 23.8, 1.3, 6.8);
  box(F, 'floor', 0, 9.2, 3.1, 24, 0.25, 7);
  if (detail) {
    for (const side of [-1, 1]) {
      B('metal', [side * 11.8, 10.5, -0.2], [side * 11.8, 10.5, 6.5], 0.09);
      for (let z = 0; detail >= 2 && z <= 6.5; z += 0.65)
        B('metal', [side * 11.8, 9.45, z], [side * 11.8, 10.5, z], 0.065);
    }
    B('metal', [-11.8, 10.5, 6.5], [11.8, 10.5, 6.5], 0.1);
    for (let x = -11.5; detail >= 2 && x <= 11.5; x += 0.65)
      B('metal', [x, 9.45, 6.5], [x, 10.5, 6.5], 0.06);
    for (const u of [-7.8, 0, 7.8]) box(F, 'door', u, 1.55, 0.02, 2, 5.4, 0.18);
  }
  for (const c of r.figures) {
    const A = ([x, y, z]) => Q([c.u + c.T[0] * x + c.N[0] * z, y, c.v + c.T[2] * x + c.N[2] * z]),
      figureFace = (role, ps, n) =>
        f(role, ps.map(A), [
          p.T[0] * (c.T[0] * n[0] + c.N[0] * n[2]) + p.N[0] * (c.T[2] * n[0] + c.N[2] * n[2]),
          n[1],
          p.T[2] * (c.T[0] * n[0] + c.N[0] * n[2]) + p.N[2] * (c.T[2] * n[0] + c.N[2] * n[2]),
        ]),
      limb = (a, b, w) => bar('figure', A(a), A(b), w),
      sides = detail === 3 ? 8 : 6;
    box(figureFace, 'trim', 0, 1.55, 0, 1.15, 0.55, 1.1);
    if (detail === 0) {
      box(figureFace, 'figure', 0, 2.1, 0, 0.7, 5.8, 0.65);
      continue;
    }
    box(figureFace, 'trim', 0, 2.1, -0.43, 0.65, 5.8, 0.42);
    if (detail === 1) {
      box(figureFace, 'figure', 0, 4.2, 0, 0.8, 2.4, 0.55);
      box(figureFace, 'figure', 0, 6.6, 0.03, 0.5, 0.75, 0.5);
      for (const sign of [-1, 1]) {
        limb([sign * 0.25, 4.25, 0], [sign * 0.34, 2.2, 0.03], 0.28);
        limb([sign * 0.5, 6.55, 0], [sign * 0.95, 7.05, 0.1], 0.31);
        limb([sign * 0.95, 7.05, 0.1], [sign * 0.42, 7.85, -0.1], 0.25);
      }
      continue;
    }
    for (const sign of [-1, 1]) {
      limb([sign * 0.28, 4.3, 0], [sign * 0.3, 3.2, 0.1], 0.36);
      limb([sign * 0.3, 3.2, 0.1], [sign * 0.34, 2.25, 0.03], 0.25);
      box(figureFace, 'figure', sign * 0.34, 2.1, 0.17, 0.32, 0.25, 0.6);
      limb([sign * 0.5, 6.55, 0], [sign * 0.95, 7.05, 0.1], 0.31);
      limb([sign * 0.95, 7.05, 0.1], [sign * 0.42, 7.85, -0.1], 0.25);
    }
    const rings = [
      [4.1, 0.42, 0.3],
      [4.7, 0.36, 0.27],
      [5.6, 0.49, 0.31],
      [6.4, 0.62, 0.31],
      [6.65, 0.47, 0.26],
    ].map(([y, rx, rz]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i * 2 * Math.PI) / sides;
        return A([Math.cos(a) * rx, y, Math.sin(a) * rz]);
      }),
    );
    // Loft in local building axes after each figure's explicit facing transform.
    loft('figure', rings);
    const head = [
      [6.65, 0.2],
      [6.85, 0.29],
      [7.25, 0.28],
      [7.4, 0.12],
    ].map(([y, radius]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i * 2 * Math.PI) / sides;
        return A([Math.cos(a) * radius, y, Math.sin(a) * radius + 0.03]);
      }),
    );
    loft('figure', head);
  }
}
