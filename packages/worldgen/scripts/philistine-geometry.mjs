/** 'N0757': mapped Ashdod museum, folded roofs and recessed entrance. */
import './install-deterministic-math.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildPhilistine(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    floor = r.floors[0],
    front = r.entry.center[1];
  for (const p of r.footing) prism(f, 'stone', p, r.foundationY, Y);
  for (const p of detail ? r.lower : r.floors) prism(f, 'wall', p, Y, Y + 3.35);
  for (const p of r.floors) prism(f, 'wall', p, Y + 3.35, Y + 5.5);
  const a = floor.outline[0],
    b = floor.outline[1],
    c = floor.outline[2],
    d = floor.outline[3],
    atZ = (z, p, q) => p[0] + ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]),
    bay = (near, far) => ({
      outline: [
        [atZ(near, a, d), near],
        [atZ(near, b, c), near],
        [atZ(far, b, c), far],
        [atZ(far, a, d), far],
      ],
      holes: [],
    });
  const heights = [7.4, 8.6, 9.4];
  for (let k = 0; k < 3; k++) {
    const near = r.roofBreaks[k],
      far = r.roofBreaks[k + 1],
      p = bay(near, far),
      hi = (z) => 5.65 + ((heights[k] - 5.65) * (near - z)) / (near - far);
    prism(
      (_role, ps, n) =>
        f(
          n[1] ? 'roof' : Math.abs(n[0]) > 0.5 ? 'glass' : 'wall',
          ps.map(([x, y, z]) => [x, Y + (y ? hi(z) : 5.5), z]),
          n,
        ),
      'roof',
      p,
      0,
      1,
    );
    if (detail) {
      for (const x of [-10.8, 10.8]) {
        // Frames follow the rising roof; the folded ends remain opaque glazing proxies.
        const s = Math.sign(x);
        f(
          'frame',
          [
            [x, Y + 5.5, near],
            [x, Y + 5.5, far],
            [x, Y + 5.66, far],
            [x, Y + 5.66, near],
          ],
          [s, 0, 0],
        );
        if (detail > 1)
          for (let j = 1; j < 5; j++) {
            const z = near + ((far - near) * j) / 5,
              h = hi(z) - 5.5;
            B('frame', x, 5.5, z, 0.11, h, 0.1);
          }
      }
      if (detail > 1)
        for (let j = 0; j < 22; j++) {
          const x = -10.5 + j,
            eps = 0.018;
          f(
            'frame',
            [
              [x - eps, Y + hi(near) + 0.015, near],
              [x + eps, Y + hi(near) + 0.015, near],
              [x + eps, Y + hi(far) + 0.015, far],
              [x - eps, Y + hi(far) + 0.015, far],
            ],
            [0, 1, 0],
          );
        }
    }
  }
  // Coping and low plinth follow all four actual mapped walls.
  for (let i = 0; i < floor.outline.length; i++) {
    const p = floor.outline[i],
      q = floor.outline[(i + 1) % floor.outline.length],
      v = q.map((v, k) => v - p[k]),
      L = Math.hypot(...v),
      t = v.map((v) => v / L),
      normal = [-t[1], t[0]],
      panel = (role, y, h, offset) =>
        f(
          role,
          [
            [0, y],
            [L, y],
            [L, y + h],
            [0, y + h],
          ].map(([u, y]) => [
            p[0] + t[0] * u + normal[0] * offset,
            Y + y,
            p[1] + t[1] * u + normal[1] * offset,
          ]),
          [normal[0], 0, normal[1]],
        );
    panel('wall', 5.4, 0.38, 0.06);
    if (detail) panel('stone', 0.02, 0.21, 0.035);
  }
  // The canopy is a roof-only projection over original ground, with two slender posts.
  B('roof', -5.2, 3.35, front + 0.55, 6.8, 0.16, 1.9);
  B('frame', -5.2, 3.51, front + 1.48, 6.9, 0.2, 0.12);
  for (const x of [-8.3, -2.1]) B('frame', x, 0, front + 1.2, 0.16, 3.35, 0.16);
  if (!detail) return;
  const E = r.entry,
    at = (u, y, depth) => [E.back[0] + u, Y + y, E.back[1] + depth];
  f(
    'glass',
    [
      at(-E.width / 2, 0.025, 0.025),
      at(E.width / 2, 0.025, 0.025),
      at(E.width / 2, 3.3, 0.025),
      at(-E.width / 2, 3.3, 0.025),
    ],
    [0, 0, 1],
  );
  for (const x of [-E.width / 2, 0, E.width / 2])
    B('frame', E.back[0] + x, 0.02, E.back[1] + 0.045, 0.1, 3.3, 0.08);
  B('frame', E.back[0], 1.65, E.back[1] + 0.05, E.width, 0.08, 0.08);
  f(
    'stone',
    [
      at(-E.width / 2, 0.04, 0),
      at(E.width / 2, 0.04, 0),
      at(E.width / 2, 0.04, E.depth),
      at(-E.width / 2, 0.04, E.depth),
    ],
    [0, 1, 0],
  );
  // Blank low-frequency fields retain facade rhythm without reproducing text or artwork.
  for (const x of [-0.5, 1.1]) {
    B(x < 0 ? 'paper' : 'banner', x, 0.55, front + 0.045, 1.15, 3.7, 0.055);
    for (const y of [0.5, 4.3]) B('frame', x, y, front + 0.11, 1.4, 0.06, 0.07);
  }
  const plaques = [
    [
      [3.4, 3.5],
      [4.2, 4.05],
      [5.3, 3.7],
      [5.2, 2.9],
      [4.5, 2.75],
    ],
    [
      [3.1, 2.65],
      [4.45, 2.8],
      [4.5, 1.55],
      [3.5, 1.4],
    ],
    [
      [4.65, 2.8],
      [6.1, 3],
      [6.6, 1.55],
      [4.8, 1.45],
    ],
  ];
  for (const p of plaques)
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, Y + z, front + y]),
          [n[0], n[2], n[1]],
        ),
      'paper',
      { outline: p, holes: [] },
      0.08,
      0.13,
    );
  if (detail > 1) {
    for (const x of [-9, -5, -1, 3, 7, 10]) {
      B('frame', x, 5.27, front + 0.3, 0.08, 0.09, 0.55);
      B('paper', x, 5.15, front + 0.57, 0.3, 0.18, 0.22);
    }
    // A restrained service hatch at the unseen rear is a declared reconstruction.
    B('frame', 7, 0.25, -14.78, 1.1, 2.1, 0.04);
  }
}
