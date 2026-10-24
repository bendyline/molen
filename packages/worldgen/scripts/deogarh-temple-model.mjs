/** 'dashavatara_temple_deogarh': surviving Deogarh sanctuary, carved entrance and broken stone crown. */
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildDeogarhTemple(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    F = r.plinth.floorY,
    h = r.body.width / 2,
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    };
  prism(f, 'wall', r.plinth.polygon, r.plinth.baseY, F);
  // The occupied archaeological base, not a slab across the surrounding site.
  for (const [y, w, t] of [
    [F - 0.65, 16.95, 0.15],
    [F - 0.3, 17.15, 0.15],
    [F - 0.1, 17.3, 0.1],
  ])
    box(f, 'trim', 0, y, 0, w, t, w);
  const basis = [
    { p: (u, d) => [-h + d, u], n: (u, d) => [d, 0, u] },
    { p: (u, d) => [u, -h + d], n: (u, d) => [u, 0, d] },
    { p: (u, d) => [h - d, -u], n: (u, d) => [-d, 0, -u] },
    { p: (u, d) => [-u, h - d], n: (u, d) => [-u, 0, -d] },
  ];
  function facade(side) {
    const b = basis[side];
    return (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, d]) => {
          const [x, z] = b.p(u, d);
          return [x, F + y, z];
        }),
        [b.n(n[0], n[2])[0], n[1], b.n(n[0], n[2])[2]],
      );
  }
  function B(g, role, u, y, d, w, t, depth) {
    box(g, role, u, y, d, w, t, depth);
  }
  function frame(g, width, height, bottom, depth, thickness, role = 'trim') {
    for (const sign of [-1, 1])
      B(
        g,
        role,
        sign * (width / 2 + thickness / 2),
        bottom,
        depth,
        thickness,
        height + thickness,
        0.2,
      );
    B(g, role, 0, bottom + height, depth, width + 2 * thickness, thickness, 0.2);
  }
  function disc(g, u, y, d, radius) {
    const sides = detail === 3 ? 10 : 6;
    const front = Array.from({ length: sides }, (_, i) => [
      u + Math.cos((i * Math.PI * 2) / sides) * radius,
      y + Math.sin((i * Math.PI * 2) / sides) * radius,
      d,
    ]);
    for (let i = 1; i < sides - 1; i++) g('trim', [front[0], front[i], front[i + 1]], [0, 0, -1]);
  }
  function figure(g, u, y, d, scale, recline = false) {
    // Shallow original human vocabulary, never a copied religious narrative.
    const G = (role, ps, n) =>
      g(
        role,
        ps.map(([x, Y, z]) =>
          recline
            ? [u + (Y - 0.6) * scale, y + x * scale, d + z * scale]
            : [u + x * scale, y + Y * scale, d + z * scale],
        ),
        recline ? [n[1], -n[0], n[2]] : n,
      );
    box(G, 'trim', 0, 0.28, 0, 0.34, 0.56, 0.16);
    disc(G, 0, 0.98, -0.1, 0.16);
    for (const sign of [-1, 1]) {
      box(G, 'trim', sign * 0.22, 0.28, 0, 0.13, 0.46, 0.16);
      box(G, 'trim', sign * 0.1, 0, 0, 0.12, 0.3, 0.16);
    }
  }
  for (let side = 0; side < 4; side++) {
    const g = facade(side),
      door = side === 0,
      w = door ? r.body.doorWidth : 1.8,
      bottom = door ? 0.08 : 0.9,
      height = door ? r.body.doorHeight : 2;
    const strip = (6.4 - w) / 2;
    for (const sign of [-1, 1]) B(g, 'wall', sign * (w / 2 + strip / 2), 0, 0.3, strip, 4.2, 0.6);
    B(g, 'wall', 0, 0, 0.3, w, bottom, 0.6);
    B(g, 'wall', 0, bottom + height, 0.3, w, 4.2 - bottom - height, 0.6);
    // Niche backing / doorway recess: deliberately behind the facade plane.
    B(g, door ? 'inset' : 'rubble', 0, bottom, door ? 1.0 : 0.34, w, height, 0.08);
    if (!door) B(g, 'wall', 0, bottom + height / 2, 0.17, w, 0.12, 0.35);
    frame(g, w, height, bottom, -0.04, detail === 0 ? 0.18 : 0.24);
    if (detail >= 1) {
      frame(g, w + 0.48, height + 0.32, bottom - 0.05, -0.14, 0.16);
      B(g, 'trim', 0, bottom + height + 0.64, -0.15, w + 1.05, 0.15, 0.44);
      for (const sign of [-1, 1]) B(g, 'trim', sign * 2.91, 0.18, -0.04, 0.22, 3.85, 0.16);
      B(g, 'trim', 0, 3.95, -0.12, 6.7, 0.2, 0.3);
      const count = detail === 1 ? 5 : 9;
      for (let i = 0; i < count; i++)
        B(g, 'trim', -2.7 + (i * 5.4) / (count - 1), 4.16, -0.13, 0.2, 0.13, 0.24);
    }
    if (detail >= 2) {
      if (door) {
        frame(g, w + 0.92, height + 0.62, bottom - 0.08, -0.25, 0.12);
        for (const sign of [-1, 1]) {
          figure(g, sign * 1.2, 0.16, -0.4, 0.62);
          for (let k = 0; k < 4; k++) figure(g, sign * 0.98, 1.1 + k * 0.41, -0.31, 0.25);
        }
        for (let i = -2; i <= 2; i++) {
          B(g, 'trim', i * 0.49, 3.04, -0.31, 0.34, 0.24, 0.22);
          loft(
            g,
            'trim',
            i * 0.49,
            -0.3,
            [
              [3.28, 0.42],
              [3.45, 0.12],
            ],
            false,
          );
        }
      } else {
        for (const sign of [-1, 1]) figure(g, sign * 0.53, 1.0, -0.03, 0.57);
        figure(g, 0, 2.18, -0.08, 0.9, side === 3);
        disc(g, 0, 2.7, -0.1, 0.25);
      }
    }
  }
  // Surviving tiered crown. Its uneven top is retained at every browser level.
  for (const [y, w, t] of [
    [4.2, 6.8, 0.22],
    [4.42, 6.15, 0.68],
    [5.1, 6.5, 0.22],
  ])
    box(f, y === 4.42 ? 'wall' : 'trim', 0, F + y, 0, w, t, w);
  // Discontinuous surviving masonry above the cornice, not a restored pyramid.
  const fragments = [
    [-1.35, 0, 1.6, 5, 1.5],
    [1.35, -0.3, 1.6, 4.4, 1.15],
    [0, -1.65, 1.2, 1.8, 0.9],
    [0, 0.95, 1.2, 2, 1.3],
    [-0.45, 0.75, 1.4, 1.2, 1.72],
  ];
  for (const [x, z, w, d, height] of fragments) box(f, 'rubble', x, F + 5.32, z, w, height, d);
  const support = (x, z) =>
    Math.max(
      5.32,
      ...fragments
        .filter(([u, v, w, d]) => Math.abs(x - u) < w / 2 && Math.abs(z - v) < d / 2)
        .map((p) => 5.32 + p[4]),
    );
  if (detail >= 1) {
    for (let side = 0; side < 4; side++) {
      const g = facade(side);
      for (let i = detail === 1 ? -2 : -3; i <= (detail === 1 ? 2 : 3); i++) {
        B(g, 'rubble', i * 0.8, 4.48, 0.08, 0.48, 0.48, 0.22);
        // Each small frame is translated to its own aedicule station.
        const mini = (role, ps, n) =>
          g(
            role,
            ps.map(([u, y, d]) => [u + i * 0.8, y, d]),
            n,
          );
        frame(mini, 0.25, 0.27, 4.55, -0.07, 0.075);
        B(mini, 'trim', 0, 4.52, -0.1, 0.56, 0.075, 0.2);
        disc(mini, 0, 4.88, -0.17, 0.19);
      }
    }
  }
  const count = detail === 0 ? 6 : detail === 1 ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const angle = (i * Math.PI * 2) / count,
      rad = detail === 0 ? 1.6 : 1.45 + (i % 3) * 0.2;
    box(
      f,
      'rubble',
      Math.cos(angle) * rad,
      F + support(Math.cos(angle) * rad, Math.sin(angle) * rad),
      Math.sin(angle) * rad,
      0.6 + (i % 3) * 0.16,
      0.38 + (i % 3) * 0.17,
      0.65,
    );
  }
  box(f, 'rubble', -0.65, F + 7.04, 0.7, 1, 0.48, 0.7);
  box(f, 'rubble', 1.15, F + 6.47, -0.85, 0.8, 0.65, 1);
  if (detail >= 2) {
    // Selected irregular mortar joints; the shared graph carries general grain.
    for (let side = 0; side < 4; side++) {
      const g = facade(side);
      for (let row = 0; row < 5; row++)
        for (let i = 0; i < 4; i++) {
          const u = -2.5 + i * 1.65 + (row % 2) * 0.3;
          if (Math.abs(u) < 1.6) continue;
          B(g, 'rubble', u, 0.45 + row * 0.72, -0.035, 1.25, 0.025, 0.03);
        }
    }
  }
  // Four small picture-led approaches. Tops stay connected to the occupied base.
  for (let side = 0; side < 4; side++) {
    const b = basis[side],
      center = b.p(0, h - 8.4 - 3),
      native = grade(...center),
      n = detail === 0 ? 3 : 8;
    for (let i = 0; i < n; i++) {
      const d = h - 8.4 - 3 + ((i + 0.5) * 3) / n,
        top = native + ((F - native) * (i + 1)) / n,
        [x, z] = b.p(0, d),
        low = Math.min(native, grade(x, z)) - 0.4;
      const along = side % 2 === 0;
      box(f, 'wall', x, low, z, along ? 3 / n : 4.2, top - low, along ? 4.2 : 3 / n);
      for (const sign of [-1, 1]) {
        const [q, w] = b.p(sign * 2.32, d);
        box(f, 'wall', q, low, w, along ? 3 / n : 0.44, top + 0.3 - low, along ? 0.44 : 3 / n);
      }
    }
  }
  for (const x of [-6.7, 6.7])
    for (const z of [-6.7, 6.7]) {
      box(f, 'wall', x, F, z, 1.8, 0.22, 1.8);
      if (detail >= 1) {
        box(f, 'trim', x, F + 0.22, z, 1.58, 0.12, 1.58);
        box(f, 'rubble', x - 0.22, F + 0.34, z + 0.15, 0.7, 0.25, 0.6);
      }
    }
  // Keep a central closed ceiling: no invented complete chamber fit-out.
  prism(f, 'wall', rect(0, 0, 5.2, 5.2), F + 3.65, F + 3.85);
}
