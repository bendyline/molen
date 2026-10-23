/** 'N0741_OLD': Long river facade, central arched bays and covered Winter Canal arch. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildOldHermitage(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + r.floorY,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, points, normal) => face(role, points.map(P), D(normal)),
    adapter = {
      addQuad: (role, _ref, points, normal) => f(role, points, normal),
      addConvexPolygon: (role, _ref, points, normal) => {
        for (let i = 1; i < points.length - 1; i++)
          f(role, [points[0], points[i], points[i + 1]], normal);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    bottom = r.minGround - r.floorY - 0.4,
    window = (w, lo, height, arch, pediment = false) => {
      const radius = w.width / 2,
        spring = lo + height - (arch ? radius : 0),
        point = (u, y, depth = 0.07) => [
          w.x + w.T[0] * u + w.N[0] * depth,
          y,
          w.z + w.T[2] * u + w.N[2] * depth,
        ],
        profile = [
          [-radius, lo],
          [radius, lo],
        ];
      if (arch)
        for (let i = 0, n = detail === 3 ? 8 : 4; i <= n; i++) {
          const a = (Math.PI * i) / n;
          profile.push([radius * Math.cos(a), spring + radius * Math.sin(a)]);
        }
      else profile.push([radius, lo + height], [-radius, lo + height]);
      const ps = profile.map(([u, y]) => point(u, y));
      for (let i = 1; i < ps.length - 1; i++) f('glass', [ps[0], ps[i], ps[i + 1]], w.N);
      if (detail >= 2)
        for (let i = 0; i < profile.length; i++) {
          const a = profile[i],
            b = profile[(i + 1) % profile.length];
          if (detail === 3) bar('trim', point(...a, 0.16), point(...b, 0.16), 0.14);
          else {
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              length = Math.hypot(dx, dy),
              u = (-dy * 0.1) / length,
              v = (dx * 0.1) / length;
            f(
              'trim',
              [
                point(a[0] - u, a[1] - v, 0.16),
                point(b[0] - u, b[1] - v, 0.16),
                point(b[0] + u, b[1] + v, 0.16),
                point(a[0] + u, a[1] + v, 0.16),
              ],
              w.N,
            );
          }
        }
      if (detail >= 2 && pediment) {
        const y = lo + height + 0.55;
        bar('trim', point(-radius - 0.25, y, 0.22), point(radius + 0.25, y, 0.22), 0.23, 0.36);
        if (w.index % 2) {
          bar('trim', point(-radius - 0.25, y, 0.22), point(0, y + 0.8, 0.22), 0.19);
          bar('trim', point(0, y + 0.8, 0.22), point(radius + 0.25, y, 0.22), 0.19);
        } else if (detail === 3) {
          const n = 8;
          for (let j = 0; j < n; j++) {
            const a = (Math.PI * j) / n,
              b = (Math.PI * (j + 1)) / n;
            bar(
              'trim',
              point((radius + 0.25) * Math.cos(a), y + 0.65 * Math.sin(a), 0.22),
              point((radius + 0.25) * Math.cos(b), y + 0.65 * Math.sin(b), 0.22),
              0.18,
            );
          }
        }
      }
      if (detail === 3) {
        bar('trim', point(0, lo, 0.17), point(0, spring, 0.17), 0.075);
        bar(
          'trim',
          point(-radius, lo + height * 0.5, 0.17),
          point(radius, lo + height * 0.5, 0.17),
          0.075,
        );
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
  if (detail) {
    for (const e of r.edges) {
      const { a, b, N } = e;
      for (const [y, w] of [
        [0.5, 0.35],
        [7.5, 0.45],
        [21.85, 0.65],
        [22.4, 0.3],
      ])
        bar(
          'trim',
          [a[0] + N[0] * 0.08, y, a[1] + N[2] * 0.08],
          [b[0] + N[0] * 0.08, y, b[1] + N[2] * 0.08],
          w,
          w + 0.12,
        );
      if (detail >= 2 && (e.front || e.east)) {
        // Shallow horizontal rustication is shared trim geometry, rather than a unique atlas.
        for (let y = 1.1; y < 7; y += 0.9)
          bar(
            'trim',
            [a[0] + N[0] * -0.03, y, a[1] + N[2] * -0.03],
            [b[0] + N[0] * -0.03, y, b[1] + N[2] * -0.03],
            0.055,
            0.09,
          );
        if (detail === 3) {
          const count = Math.floor(e.L / 0.9);
          for (let i = 0; i < count; i++) {
            const t = (i + 0.5) / count,
              x = a[0] + (b[0] - a[0]) * t,
              z = a[1] + (b[1] - a[1]) * t;
            box(f, 'trim', x + N[0] * 0.2, 21.5, z + N[2] * 0.2, 0.22, 0.3, 0.28);
          }
        }
      }
    }
    for (const w of r.windows) {
      if (detail === 1 && w.index % 2) continue;
      window(w, 1.1, 5.3, true);
      window(w, 9, 5.7, w.central, !w.central);
      window(w, 17.6, 3.3, detail >= 2);
      if (detail >= 2 && w.central) {
        bar('trim', [w.x - 1.35, 8.0, w.z - 0.15], [w.x - 1.35, 21.2, w.z - 0.15], 0.3, 0.38);
        box(f, 'trim', w.x - 1.35, 14.9, w.z - 0.12, 0.6, 0.22, 0.28);
      }
    }
    // Broad risalits and pilaster pairs articulate the long river front without a new texture.
    for (const x of r.pilasters) {
      box(f, 'trim', x, 7.7, -12.45, 0.72, 13.6, 0.35);
      box(f, 'trim', x, 20.9, -12.47, 1.1, 0.4, 0.48);
    }
    if (detail >= 2)
      for (const x of [-47, -27, -5, 18, 38]) {
        box(f, 'wall', x, 23.1, 1.5, 1.5, 2.6, 1.3);
        box(f, 'metal', x, 25.7, 1.5, 1.8, 0.2, 1.6);
      }
  }

  const b = r.bridge,
    { x0, x1, z0, z1 } = b,
    center = (x0 + x1) / 2,
    pier = 2.5,
    radius = (x1 - x0 - pier * 2) / 2,
    spring = 1.25,
    rise = 5.5,
    top = 16.2,
    segments = [4, 6, 12, 20][detail];
  for (const x of [x0 + pier / 2, x1 - pier / 2])
    box(f, 'wall', x, bottom, (z0 + z1) / 2, pier, spring - bottom, z1 - z0);
  for (let i = 0; i < segments; i++) {
    const a = (Math.PI * i) / segments,
      c = (Math.PI * (i + 1)) / segments,
      xa = center + radius * Math.cos(c),
      xb = center + radius * Math.cos(a),
      ya = spring + rise * Math.sin(c),
      yb = spring + rise * Math.sin(a),
      points = [
        [xa, ya, z0],
        [xb, yb, z0],
        [xb, top, z0],
        [xa, top, z0],
      ];
    f('wall', points, [0, 0, -1]);
    f(
      'wall',
      points.map(([x, y]) => [x, y, z1]),
      [0, 0, 1],
    );
    f(
      'trim',
      [
        [xa, ya, z0],
        [xb, yb, z0],
        [xb, yb, z1],
        [xa, ya, z1],
      ],
      [0, -1, 0],
    );
    if (detail >= 2)
      for (const z of [z0 - 0.06, z1 + 0.06]) {
        const q = [
          [xa, ya, z],
          [xb, yb, z],
          [xb, yb + 0.55, z],
          [xa, ya + 0.55, z],
        ];
        f('trim', q, [0, 0, z < z0 ? -1 : 1]);
      }
  }
  for (const x of [x0, x1])
    f(
      'wall',
      [
        [x, spring, z0],
        [x, top, z0],
        [x, top, z1],
        [x, spring, z1],
      ],
      [x === x0 ? -1 : 1, 0, 0],
    );
  // Continuous upper gallery floor lies above the open canal arch, with a closed metal roof.
  box(f, 'floor', center, 7.8, (z0 + z1) / 2, x1 - x0, 0.4, z1 - z0);
  const roofProfile = [
    [z0, top],
    [z0 + (z1 - z0) * 0.17, 18.5],
    [(z0 + z1) / 2, 19],
    [z1 - (z1 - z0) * 0.17, 18.5],
    [z1, top],
  ];
  for (let i = 1; i < roofProfile.length; i++) {
    const [a, ya] = roofProfile[i - 1],
      [c, yc] = roofProfile[i];
    f(
      'roof',
      [
        [x0, ya, a],
        [x1, ya, a],
        [x1, yc, c],
        [x0, yc, c],
      ],
      [0, 1, 0],
    );
  }
  for (const [x, n] of [
    [x0, -1],
    [x1, 1],
  ]) {
    const ps = [[x, top, z0], ...roofProfile.slice(1).map(([z, y]) => [x, y, z])];
    for (let i = 1; i < ps.length - 1; i++) f('roof', [ps[0], ps[i], ps[i + 1]], [n, 0, 0]);
  }
  if (detail)
    for (const z of [z0, z1]) {
      for (const y of [7.6, 8.25, 15.9]) bar('trim', [x0, y, z], [x1, y, z], 0.28, 0.45);
      for (let i = 0; i < 6; i++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / 6;
        window(
          { x, z, T: [1, 0, 0], N: [0, 0, z === z0 ? -1 : 1], width: 1.75, index: i },
          9,
          5.3,
          true,
        );
        if (detail === 3) {
          bar(
            'metal',
            [x - 1.4, 8.4, z + (z === z0 ? -0.25 : 0.25)],
            [x + 1.4, 8.4, z + (z === z0 ? -0.25 : 0.25)],
            0.07,
          );
          for (let j = 0; j <= 4; j++)
            bar(
              'metal',
              [x - 1.4 + j * 0.7, 7.9, z + (z === z0 ? -0.25 : 0.25)],
              [x - 1.4 + j * 0.7, 8.4, z + (z === z0 ? -0.25 : 0.25)],
              0.055,
            );
        }
      }
    }
}
