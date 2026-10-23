/** 'N0751': Pergamon's three mapped wings, courtyard pilasters and stepped hall roof. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildPergamon(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n));
  for (const p of r.floors) prism(f, 'plinth', p, r.foundationY, Y);
  // Authored bands retain all mapped notches; roofs supply the remaining overall height.
  for (const band of r.bodyLevels) {
    if (band.height === 10) {
      for (const p of band.lower) prism(f, 'glass', p, Y, Y + 3.8);
      for (const p of band.polygons) prism(f, 'glass', p, Y + 3.8, Y + band.wallHeight);
    } else for (const p of band.polygons) prism(f, 'wall', p, Y, Y + band.wallHeight);
  }
  function hip(x0, x1, z0, z1, lo, hi, inset) {
    const low = [
        [x0, lo, z0],
        [x1, lo, z0],
        [x1, lo, z1],
        [x0, lo, z1],
      ],
      high = [
        [x0 + inset, hi, z0 + inset],
        [x1 - inset, hi, z0 + inset],
        [x1 - inset, hi, z1 - inset],
        [x0 + inset, hi, z1 - inset],
      ];
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'roof',
        [low[i], low[j], high[j], high[i]],
        [low[j][2] - low[i][2], 1, low[i][0] - low[j][0]],
      );
    }
    f('roof', high, [0, 1, 0]);
    f('roof', low, [0, -1, 0]);
  }
  hip(-30.8, 5, -77.1, 42, Y + 22, Y + 25, 5);
  hip(49.3, 86.7, -77.6, 42.1, Y + 22, Y + 25, 5);
  hip(3.7, 49.5, -84.6, -42.2, Y + 24.2, Y + 27.1, 6);
  hip(13.8, 38.3, -96.2, -84.3, Y + 14.2, Y + 15, 2);
  // Broad stepped attic and the three source-picture roof lanterns.
  for (let j = 0; j < 3; j++)
    box(f, 'stone', 26.6, Y + 24.2 + j * 0.8, -46.2 - j * 1.3, 43 - j * 9, 0.8, 6.8 + j * 2.6);
  for (const x of [10.2, 43.2]) {
    box(f, 'wall', x, Y + 27, -59, 6.4, 2.7, 7.4);
    box(f, 'stone', x, Y + 29.7, -59, 7, 0.3, 8);
    if (detail)
      for (let k = 0; k < 5; k++)
        box(f, 'dark', x - 2.2 + k * 1.1, Y + 27.35, -55.27, 0.3, 1.95, 0.055);
  }
  box(f, 'wall', 26.6, Y + 27, -58.5, 13.3, 2, 8);
  box(f, 'stone', 26.6, Y + 29, -58.5, 14, 0.3, 8.7);
  function pane(g, role, u0, u1, lo, hi, d) {
    g(
      role,
      [
        [u0, lo, d],
        [u1, lo, d],
        [u1, hi, d],
        [u0, hi, d],
      ],
      [0, 0, 1],
    );
  }
  function facade(a, b, height) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      L = Math.hypot(dx, dz),
      U = [dx / L, dz / L],
      D = [U[1], -U[0]],
      g = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, d]) => [a[0] + u * U[0] + d * D[0], y, a[1] + u * U[1] + d * D[1]]),
          [n[0] * U[0] + n[2] * D[0], n[1], n[0] * U[1] + n[2] * D[1]],
        );
    const count = Math.max(2, Math.round(L / (detail === 1 ? 11 : 6.2))),
      pitch = L / count;
    box(g, 'stone', L / 2, Y + height - 1.1, 0.28, L, 0.65, 0.72);
    box(g, 'stone', L / 2, Y + height - 0.45, 0.45, L, 0.45, 1.05);
    box(g, 'stone', L / 2, Y + 3.7, 0.18, L, 0.3, 0.5);
    for (let i = 0; i <= count; i++) {
      const u = i * pitch;
      if (detail === 3) {
        const points = [
          [-0.43, -0.08],
          [0.43, -0.08],
          [0.43, 0.65],
        ];
        for (let k = 0; k < 4; k++)
          for (let j = 0; j <= 4; j++)
            points.push([0.43 - (k + j / 4) * 0.215, 0.65 - 0.07 * Math.sin((j * Math.PI) / 4)]);
        points.push([-0.43, 0.65]);
        prism(
          (role, ps, n) =>
            g(
              role,
              ps.map(([x, y, z]) => [x + u, y, z]),
              n,
            ),
          'stone',
          { outline: points, holes: [] },
          Y + 4.1,
          Y + 20.5,
        );
      } else box(g, 'stone', u, Y + 4.1, 0.29, 0.86, 16.4, 0.72);
      box(g, 'stone', u, Y + 3.9, 0.33, 1.22, 0.3, 0.82);
      box(g, 'stone', u, Y + 20.5, 0.35, 1.24, 0.42, 0.86);
      if (i === count) continue;
      const c = u + pitch / 2,
        w = Math.min(3.3, pitch - 1.4),
        lower = [
          [-w / 2, Y + 4.4],
          [w / 2, Y + 4.4],
          [w / 2, Y + 14.7],
          ...Array.from({ length: detail > 1 ? 9 : 5 }, (_, j) => [
            (w / 2) * Math.cos((j * Math.PI) / (detail > 1 ? 8 : 4)),
            Y + 14.7 + (w / 2) * Math.sin((j * Math.PI) / (detail > 1 ? 8 : 4)),
          ]),
        ];
      g(
        'glass',
        lower.map(([x, y]) => [c + x, y, 0.055]),
        [0, 0, 1],
      );
      pane(g, 'glass', c - w / 2, c + w / 2, Y + 17.6, Y + 20, 0.055);
      if (detail > 1) {
        for (const x of [c - w / 2, c + w / 2]) box(g, 'frame', x, Y + 4.4, 0.075, 0.09, 10.3, 0.1);
        for (let k = 1; k < 3; k++)
          pane(
            g,
            'frame',
            c - w / 2 + (k * w) / 3 - 0.035,
            c - w / 2 + (k * w) / 3 + 0.035,
            Y + 4.4,
            Y + 15.2,
            0.08,
          );
        for (let k = 1; k <= 5; k++)
          pane(g, 'frame', c - w / 2, c + w / 2, Y + 4.4 + k * 1.75, Y + 4.46 + k * 1.75, 0.08);
        pane(g, 'frame', c - 0.035, c + 0.035, Y + 17.6, Y + 20, 0.08);
        pane(g, 'frame', c - w / 2, c + w / 2, Y + 18.7, Y + 18.77, 0.08);
      }
    }
    if (detail > 1) {
      const n = Math.floor(L / (detail === 3 ? 1.4 : 3));
      for (let i = 0; i < n; i++)
        box(g, 'stone', ((i + 0.5) * L) / n, Y + height - 1.6, 0.38, 0.35, 0.5, 0.55);
    }
  }
  for (const part of r.parts.filter((p) => p.height === 25))
    for (const poly of part.polygons) {
      const area = poly.outline.reduce((n, a, i) => {
          const b = poly.outline[(i + 1) % poly.outline.length];
          return n + a[0] * b[1] - a[1] * b[0];
        }, 0),
        ring = area > 0 ? poly.outline : poly.outline.toReversed();
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 25) continue;
        if (detail) facade(a, b, 22);
        else {
          const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
          if (Math.abs(u[1]) < 0.2)
            for (let k = 0; k <= 4; k++) {
              const t = k / 4;
              box(
                f,
                'stone',
                a[0] + (b[0] - a[0]) * t,
                Y + 4.1,
                a[1] + (b[1] - a[1]) * t,
                0.9,
                16.4,
                0.9,
              );
            }
        }
      }
    }
  // The main entrance wall carries the same deep stone cornice as the gallery wings.
  box(f, 'stone', 26.6, Y + 23.25, -41.95, 46.5, 0.55, 1.1);
  box(f, 'stone', 26.6, Y + 23.8, -41.8, 47.1, 0.4, 1.45);
  if (detail) {
    const count = detail === 1 ? 8 : detail === 2 ? 23 : 46;
    for (let i = 0; i < count; i++)
      box(f, 'stone', 3.6 + ((i + 0.5) * 46) / count, Y + 22.75, -41.9, 0.4, 0.5, 0.65);
  }
  // Existing mapped vestibule: framed glazing, recessed doors and shallow solid canopy.
  box(f, 'stone', 26.65, Y + 9.8, -32.4, 19.9, 0.25, 19.1);
  if (detail) {
    const front = -23.7;
    box(f, 'frame', 26.65, Y + 8.6, front - 0.35, 20.2, 0.25, 1.4);
    for (let i = 0; i <= 7; i++)
      box(f, 'frame', 16.8 + (i * 19.7) / 7, Y + 0.02, front + 0.1, 0.13, 8.7, 0.18);
    for (const y of [3.8, 8.6]) box(f, 'frame', 26.65, Y + y, front + 0.11, 19.9, 0.12, 0.2);
    pane(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, y, front - 0.75 + z]),
          n,
        ),
      'door',
      23.3,
      30,
      Y + 0.02,
      Y + 3.8,
      0,
    );
    box(f, 'frame', 26.65, Y + 3.8, front - 0.12, 7.1, 0.18, 1.5);
    for (const x of [23.3, 26.65, 30]) box(f, 'frame', x, Y + 0.02, front - 0.72, 0.09, 3.8, 0.12);
    if (detail > 1) {
      for (const x of [16.75, 36.55])
        for (let k = 0; k <= 6; k++) box(f, 'frame', x, Y + 0.05, -23.9 - k * 3, 0.14, 9.7, 0.14);
      for (const x of [10, 43.3])
        pane(
          (role, ps, n) =>
            f(
              role,
              ps.map(([u, y, d]) => [u, y, -41.95 + d]),
              n,
            ),
          'glass',
          x - 1,
          x + 1,
          Y + 2,
          Y + 5.2,
          0.06,
        );
    }
  }
  // Distinct low entrance treads meet the existing rising courtyard grade.
  for (let i = 0; i < 2; i++)
    box(f, 'stone', 26.65, Y - 0.24, -23.7 + 0.25 + (1 - i) * 0.5, 7.2, 0.12 * (i + 1), 0.5);
}
