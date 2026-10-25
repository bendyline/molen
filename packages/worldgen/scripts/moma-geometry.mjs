/** 'museum_of_modern_art': Mapped MoMA galleries, recessed entrance and knife-edge canopy. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildMoma(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    panel = (role, x0, x1, lo, hi, z) =>
      f(
        role,
        [
          [x0, lo, z],
          [x1, lo, z],
          [x1, hi, z],
          [x0, hi, z],
        ],
        [0, 0, 1],
      ),
    strip = (role, a, b, w, z) => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        L = Math.hypot(dx, dy),
        nx = ((-dy / L) * w) / 2,
        ny = ((dx / L) * w) / 2;
      f(
        role,
        [
          [a[0] + nx, a[1] + ny, z],
          [b[0] + nx, b[1] + ny, z],
          [b[0] - nx, b[1] - ny, z],
          [a[0] - nx, a[1] - ny, z],
        ],
        [0, 0, 1],
      );
    },
    grid = (x0, x1, lo, hi, z, spacing = 3) => {
      panel('glass', x0, x1, lo, hi, z);
      if (!detail) return;
      const N = Math.ceil((x1 - x0) / (detail === 1 ? spacing * 2 : spacing)),
        M = Math.ceil((hi - lo) / (detail === 1 ? 8 : 4.2)),
        w = detail === 1 ? 0.24 : 0.15;
      for (let i = 0; i <= N; i++)
        box(f, 'frame', x0 + ((x1 - x0) * i) / N - w / 2, lo, z + 0.06, w, hi - lo, 0.16);
      for (let j = 0; j <= M; j++)
        box(
          f,
          'frame',
          (x0 + x1) / 2,
          lo + ((hi - lo) * j) / M - w / 2,
          z + 0.07,
          x1 - x0,
          w,
          0.18,
        );
    };
  for (const p of r.floors) prism(f, 'floor', p, r.foundationY, Y, detail > 0);
  if (!detail)
    f(
      'wall',
      [
        [-35, Y + 7, 27.1],
        [-6, Y + 7, 27.1],
        [-6, Y + 7, 30.45],
        [-35, Y + 7, 30.45],
      ],
      [0, -1, 0],
    );
  // The lower band is cut back three metres to make a real open lobby recess.
  for (const band of r.bodyLevels) {
    for (const lower of band.lower) prism(f, 'wall', lower, Y, Y + 7, detail > 0);
    for (const p of band.polygons) {
      prism(f, 'wall', p, Y + 7, Y + band.height, detail > 0);
      if (detail) prism(f, 'roof', p, Y + band.height + 0.015, Y + band.height + 0.1, false);
    }
  }
  panel('dark', -34.8, -6, Y + 7, Y + 25, 30.54);
  // Deep clear entrance, broad pale reveal and a thin cantilevered canopy.
  grid(-34.7, -6.1, Y + 0.05, Y + 7, 27.25, 3.2);
  if (detail) {
    box(f, 'wall', -35.05, Y, 28.5, 0.35, 25, 4.1);
    box(f, 'wall', -5.9, Y, 28.5, 0.25, 25, 4.1);
    box(f, 'wall', -20.4, Y + 6.8, 28.6, 29.1, 0.2, 4.1);
  }
  const canopy = {
    outline: [
      [-32, 27],
      [-9, 27],
      [-9, 35.3],
      [-32, 35.3],
    ],
    holes: [],
  };
  prism(f, 'dark', canopy, Y + 4.45, Y + 4.62, detail > 0);
  if (detail) {
    box(f, 'frame', -20.5, Y + 4.6, 35.32, 23.1, 0.07, 0.06);
    for (const x of [-26, -22.8, -16, -12.8]) box(f, 'frame', x, Y + 0.05, 27.35, 0.09, 3.2, 0.12);
    for (const x of [-25, -21.8, -15, -11.8]) box(f, 'frame', x, Y + 1.1, 27.47, 0.06, 0.55, 0.05);
  }
  // The adjacent gallery face and original garden-facing curtain wall.
  grid(-5.65, 12.7, Y + 0.25, Y + 24.7, 30.58, 3.1);
  const east = (role, ps, n) =>
    f(
      role,
      ps.map(([u, y, d]) => [42.93 + d, y, -29.9 + u]),
      [n[2], n[1], n[0]],
    );
  east(
    'glass',
    [
      [0, Y + 1, 0],
      [25.7, Y + 1, 0],
      [25.7, Y + 24, 0],
      [0, Y + 24, 0],
    ],
    [0, 0, 1],
  );
  if (detail) {
    const N = detail === 1 ? 5 : 10;
    for (let i = 0; i <= N; i++) box(east, 'frame', (25.7 * i) / N, Y + 1, 0.06, 0.16, 23, 0.18);
    for (let j = 0; j <= 5; j++) box(east, 'frame', 12.85, Y + 1 + j * 4.6, 0.07, 25.7, 0.16, 0.19);
    box(f, 'wall', 44.3, Y + 5.9, -17.05, 3.1, 0.25, 25.7);
    box(f, 'frame', 45.85, Y + 6.15, -17.05, 0.1, 1.0, 25.7);
    for (let i = 0; i <= 8; i++)
      box(f, 'frame', 45.85, Y + 6.15, -29.9 + (i * 25.7) / 8, 0.1, 1, 0.1);
  }
  // Higher stepped gallery roofs and service mass use distinct inset glass ribbons.
  if (detail)
    for (const band of r.bodyLevels) {
      if (band.height < 35) continue;
      for (const p of band.polygons)
        for (let i = 0; i < p.outline.length; i++) {
          const a = p.outline[i],
            b = p.outline[(i + 1) % p.outline.length],
            L = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (L < 10) continue;
          const U = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
            area = p.outline.reduce((s, v, j) => {
              const q = p.outline[(j + 1) % p.outline.length];
              return s + v[0] * q[1] - v[1] * q[0];
            }, 0),
            sign = Math.sign(area),
            N = [U[1] * sign, -U[0] * sign],
            edge = (role, ps, n) =>
              f(
                role,
                ps.map(([u, y, d]) => [a[0] + u * U[0] + d * N[0], y, a[1] + u * U[1] + d * N[1]]),
                [U[0] * n[0] + N[0] * n[2], n[1], U[1] * n[0] + N[1] * n[2]],
              );
          const count = band.height > 40 ? (detail === 1 ? 4 : 12) : 2;
          for (let j = 0; j < count; j++) {
            const lo = Y + 8 + ((band.height - 12) * j) / count,
              hi = Math.min(Y + band.height - 1, lo + (detail === 1 ? 2.5 : 3));
            edge(
              'glass',
              [
                [0.8, lo, 0.06],
                [L - 0.8, lo, 0.06],
                [L - 0.8, hi, 0.06],
                [0.8, hi, 0.06],
              ],
              [0, 0, 1],
            );
            if (detail >= 2)
              for (let k = 1; k < L / 3.5; k++)
                box(edge, 'frame', k * 3.5, lo, 0.13, 0.11, hi - lo, 0.12);
          }
        }
    }
  // Current west gallery-front skin belongs to MoMA; the native tower above it survives.
  const a = r.annex;
  box(f, 'dark', (a.x0 + a.x1) / 2, Y, a.z - 0.05, a.x1 - a.x0, a.height, 0.3);
  grid(a.x0 + 0.2, a.x1 - 0.2, Y + 0.1, Y + a.height - 0.2, a.z + 0.12, detail === 1 ? 5 : 3.2);
  if (detail >= 2) {
    for (const [lo, hi, x0, x1] of [
      [1, 5, -71, -63],
      [5, 9, -63, -55],
      [9, 13, -55, -47],
    ]) {
      strip('white', [x0, Y + lo], [x1, Y + hi], 0.45, a.z + 0.23);
      strip('frame', [x0, Y + lo + 1], [x1, Y + hi + 1], 0.09, a.z + 0.27);
    }
    for (let x = a.x0 + 1; x < a.x1 - 1; x += 4)
      box(f, 'frame', x, Y + 0.1, a.z + 0.34, 0.08, 2.8, 0.08);
  }
  // Slim identity blade: original simple glyph geometry, no photographic sign atlas.
  box(f, 'white', -34.95, Y + 9, 30.75, 1.75, 15, 0.24);
  if (detail >= 2) {
    const glyph = (letter, u0) => {
      const map = ([u, v]) => [-34.3 - v * 0.9, Y + 10.5 + (u + u0) * 2.5],
        z = 30.89,
        line = (a, b, w = 0.11) => strip('dark', map(a), map(b), w, z);
      if (letter === 'M') {
        line([0, 0], [0, 1]);
        line([0, 1], [0.45, 0.45]);
        line([0.45, 0.45], [0.9, 1]);
        line([0.9, 1], [0.9, 0]);
      }
      if (letter === 'o')
        for (let i = 0; i < 12; i++) {
          const t = (i * Math.PI) / 6,
            s = ((i + 1) * Math.PI) / 6;
          line(
            [0.4 + 0.33 * Math.cos(t), 0.38 + 0.32 * Math.sin(t)],
            [0.4 + 0.33 * Math.cos(s), 0.38 + 0.32 * Math.sin(s)],
            0.09,
          );
        }
      if (letter === 'A') {
        line([0, 0], [0.45, 1]);
        line([0.45, 1], [0.9, 0]);
        line([0.2, 0.4], [0.7, 0.4]);
      }
    };
    for (const [letter, i] of [
      ['M', 0],
      ['o', 1],
      ['M', 2],
      ['A', 3],
    ])
      glyph(letter, i * 1.16);
    // Broad panel joints, visible at walking distance only.
    if (detail === 3) {
      for (let x = -32.8; x < -6; x += 2.4) box(f, 'dark', x, Y + 7, 30.555, 0.025, 18, 0.035);
      for (let y = 10; y < 25; y += 3) box(f, 'dark', -20.4, Y + y, 30.555, 28.8, 0.025, 0.035);
    }
  }
}
