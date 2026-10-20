/** 'N0546': original bone chapel interior, vaults and traversable portal. */

import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';
import { ossuaryLongBone, ossuarySkull } from './ossuary-relief-geometry.mjs';

export function buildCapelaInterior(f, detail, r) {
  const p = r.chapel,
    F = p.floorY,
    [x0, z0, x1, z1] = p.bounds,
    mid = (x0 + x1) / 2,
    openings = [
      {
        center: [mid, -1.7],
        axis: [1, 0],
        depth: 2,
        shape: 'rect',
        width: 2.2,
        bottom: F + 0.08,
        height: 3,
      },
      ...[4.5, 10.2, 16].map((z) => ({
        center: [6, z],
        axis: [0, 1],
        depth: 2,
        shape: 'rect',
        width: 0.72,
        bottom: F + 3.05,
        height: 1.5,
      })),
    ],
    cutter = openingBuilder(
      { addTriangle: (role, _ref, ps, n) => f(role, ps, n) },
      openings.map((h) => prepareOpening(h, 0, detail)),
    ),
    emit = (role, ps, n) => {
      for (let i = 1; i < ps.length - 1; i++) {
        const t = [ps[0], ps[i], ps[i + 1]];
        if (Math.hypot(...normalFor(...t)) > 0.5)
          cutter.addTriangle(role, 'palette:#ffffff', t, n, [], []);
      }
    };
  prism(f, 'floor', rect(mid, (z0 + z1) / 2, x1 - x0, z1 - z0), p.baseY, F + 0.08);
  const ring = { outline: p.outer, holes: [rect(mid, (z0 + z1) / 2, x1 - x0, z1 - z0).outline] };
  prism(emit, 'plaster', ring, F + 0.08, F + 6.45);
  // Interior bone backing keeps the dense ossuary field distinct from pale vault plaster.
  emit(
    'bone',
    [
      [x0 + 0.008, F + 0.3, z0],
      [x0 + 0.008, F + 3.35, z0],
      [x0 + 0.008, F + 3.35, z1],
      [x0 + 0.008, F + 0.3, z1],
    ],
    [1, 0, 0],
  );
  emit(
    'bone',
    [
      [x1 - 0.008, F + 0.3, z0],
      [x1 - 0.008, F + 3.35, z0],
      [x1 - 0.008, F + 3.35, z1],
      [x1 - 0.008, F + 0.3, z1],
    ],
    [-1, 0, 0],
  );
  emit(
    'bone',
    [
      [x0, F + 0.3, z0 + 0.008],
      [x1, F + 0.3, z0 + 0.008],
      [x1, F + 3.35, z0 + 0.008],
      [x0, F + 3.35, z0 + 0.008],
    ],
    [0, 0, 1],
  );

  // Skyline keeps the closed chapel envelope; hidden interior detail arrives nearby.
  if (detail === 0) return;
  // Light floor bands: broad source pattern, no unique image atlas.
  if (detail >= 1) {
    for (const x of [x0 + 0.13, ...p.pierXs, x1 - 0.13])
      box(f, 'trim', x, F + 0.083, (z0 + z1) / 2, 0.16, 0.018, z1 - z0);
    const rows = detail === 1 ? 7 : 14;
    for (let i = 0; i <= rows; i++)
      box(f, 'trim', mid, F + 0.084, z0 + ((z1 - z0) * i) / rows, x1 - x0, 0.018, 0.12);
  }
  function round(role, x, z, profile, n = detail <= 1 ? 6 : 10) {
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]),
    );
  }
  for (const x of p.pierXs)
    for (const z of p.pierZs) {
      round('bone', x, z, [
        [F + 0.09, 1],
        [F + 0.22, 1],
        [F + 0.32, 0.82],
        [F + p.spring - 0.2, 0.82],
        [F + p.spring, 0.99],
      ]);
      if (detail >= 2) {
        const rows = detail === 2 ? 4 : 12;
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2,
            C = Math.cos(a),
            S = Math.sin(a),
            G = (role, ps, n) =>
              f(
                role,
                ps.map(([u, y, d]) => [
                  x - S * u + C * (0.43 + d),
                  F + y,
                  z + C * u + S * (0.43 + d),
                ]),
                [-S * n[0] + C * n[2], n[1], C * n[0] + S * n[2]],
              );
          for (let j = 0; j < rows; j++) {
            const y = 0.55 + (j * 2.45) / rows;
            ossuaryLongBone(
              (role, ps, n) =>
                G(
                  role,
                  ps.map(([u, v, w]) => [
                    u,
                    v + y,
                    w + Math.sqrt(Math.max(0.01, 0.43 * 0.43 - u * u)) - 0.43,
                  ]),
                  n,
                ),
              0.5,
            );
          }
          for (const y of detail === 2 ? [1.8] : [1.2, 2.65])
            ossuarySkull(
              (role, ps, n) =>
                G(
                  role,
                  ps.map(([u, v, w]) => [u, v + y, w + 0.08]),
                  n,
                ),
              detail,
            );
        }
      }
    }
  // A closed groin ceiling with curved ribs at bay/aisle intersections.
  const xs = [x0, ...p.pierXs, x1],
    zs = [z0, ...p.pierZs, z1],
    N = detail === 0 ? 1 : detail === 1 ? 3 : detail === 2 ? 5 : 9,
    H = (u, v) =>
      F + p.spring + (p.crown - p.spring) * Math.sqrt(Math.max(0, 1 - Math.min(u * u, v * v)));
  function tube(points, radius, role) {
    for (let i = 0; i < points.length - 1; i++) {
      const A = points[i],
        B = points[i + 1],
        T = B.map((v, k) => v - A[k]),
        len = Math.hypot(...T),
        t = T.map((v) => v / len),
        q = Math.hypot(t[0], t[2]) > 0.01 ? [-t[2], 0, t[0]] : [1, 0, 0],
        ql = Math.hypot(...q),
        U = q.map((v) => v / ql),
        V = [t[1] * U[2] - t[2] * U[1], t[2] * U[0] - t[0] * U[2], t[0] * U[1] - t[1] * U[0]],
        rings = [A, B].map((P) =>
          Array.from({ length: 4 }, (_, j) =>
            P.map(
              (v, k) =>
                v +
                (Math.cos((j * Math.PI) / 2) * U[k] + Math.sin((j * Math.PI) / 2) * V[k]) * radius,
            ),
          ),
        );
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4,
          ps = [rings[0][j], rings[0][k], rings[1][k], rings[1][j]];
        f(role, ps, normalFor(...ps.slice(0, 3)));
      }
    }
  }
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 5; j++) {
      const A = xs[i],
        B = xs[i + 1],
        C = zs[j],
        D = zs[j + 1],
        P = (u, v) => [A + ((u + 1) * (B - A)) / 2, H(u, v), C + ((v + 1) * (D - C)) / 2];
      for (let u = 0; u < N; u++)
        for (let v = 0; v < N; v++)
          f(
            'plaster',
            [
              P(-1 + (2 * u) / N, -1 + (2 * v) / N),
              P(-1 + (2 * (u + 1)) / N, -1 + (2 * v) / N),
              P(-1 + (2 * (u + 1)) / N, -1 + (2 * (v + 1)) / N),
              P(-1 + (2 * u) / N, -1 + (2 * (v + 1)) / N),
            ],
            [0, -1, 0],
          );
      if (detail >= 2)
        for (const sign of [-1, 1])
          tube(
            Array.from({ length: N * 2 + 1 }, (_, k) => {
              const t = -1 + k / N;
              const p = P(t, t * sign);
              return [p[0], p[1] - 0.055, p[2]];
            }),
            0.065,
            'trim',
          );
      if (detail >= 3) {
        const center = [(A + B) / 2, F + p.crown - 0.08, (C + D) / 2],
          petals = detail === 2 ? 4 : 8;
        for (let k = 0; k < petals; k++) {
          const a = (k * Math.PI * 2) / petals,
            pts = Array.from({ length: 6 }, (_, l) => {
              const t = (l / 5) * Math.PI * 1.6,
                r = 0.11 + l * 0.035;
              return [
                center[0] + Math.cos(a + t) * r,
                center[1] - 0.04,
                center[2] + Math.sin(a + t) * r,
              ];
            });
          tube(pts, 0.018, 'floor');
        }
      }
    }
  if (detail >= 2) {
    // Reusable relief motifs embedded in the shared ivory/plaster wall surface.
    const wall = (which, center) => {
      const G = (role, ps, n) => {
          const P = ([u, y, d]) =>
              which === 0
                ? [x0 + d, F + y, center + u]
                : which === 1
                  ? [x1 - d, F + y, center - u]
                  : [mid + u, F + y, z0 + d],
            N = (n) => (which === 0 ? [n[2], n[1], n[0]] : which === 1 ? [-n[2], n[1], -n[0]] : n);
          f(role, ps.map(P), N(n));
        },
        length = which === 2 ? x1 - x0 : z1 - z0,
        cols = Math.floor(length / (detail === 2 ? 1.5 : 0.62)),
        rows = detail === 2 ? 3 : 12;
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < cols; col++) {
          const u = -length / 2 + 0.35 + (col * (length - 0.7)) / Math.max(1, cols - 1),
            y = 0.55 + (row * 2.35) / rows;
          if (which === 2 && Math.abs(u) < 1.3) continue;
          ossuaryLongBone(
            (role, ps, n) =>
              G(
                role,
                ps.map(([a, b, c]) => [u + a, y + b, 0.02 + c]),
                n,
              ),
            detail === 2 ? 0.62 : 0.48,
          );
        }
      const skulls = detail === 2 ? Math.floor(cols / 2) : Math.floor(cols * 0.65),
        levels = detail === 2 ? [1.6] : [0.85, 1.75, 2.65];
      for (const y of levels)
        for (let i = 0; i < skulls; i++) {
          const u = -length / 2 + 0.55 + ((length - 1.1) * i) / Math.max(1, skulls - 1);
          if (which === 2 && Math.abs(u) < 1.35) continue;
          ossuarySkull(
            (role, ps, n) =>
              G(
                role,
                ps.map(([a, b, c]) => [u + a, y + b, 0.1 + c]),
                n,
              ),
            detail,
          );
        }
    };
    wall(0, (z0 + z1) / 2);
    wall(1, (z0 + z1) / 2);
    wall(2, 0);
  }
  // The north portal is open. Its source inscription is represented by a plain lintel.
  const doorZ = -1.7;
  for (const sign of [-1, 1]) {
    const x = mid + sign * 1.38;
    round(
      'trim',
      x,
      doorZ - 0.23,
      [
        [F + 0.09, 0.45],
        [F + 0.25, 0.52],
        [F + 0.4, 0.34],
        [F + 2.85, 0.34],
        [F + 3.03, 0.58],
        [F + 3.18, 0.55],
      ],
      detail === 0 ? 4 : 8,
    );
    if (detail >= 2)
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        box(
          f,
          'trim',
          x + Math.cos(a) * 0.22,
          F + 2.87,
          doorZ - 0.23 + Math.sin(a) * 0.22,
          0.1,
          0.23,
          0.1,
        );
      }
  }
  box(f, 'trim', mid, F + 3.15, doorZ - 0.23, 3.5, 0.35, 0.52);
  if (detail >= 1) {
    box(f, 'trim', mid, F + 3.5, doorZ - 0.23, 3.72, 0.15, 0.62);
    f(
      'trim',
      [
        [mid - 1.6, F + 3.65, doorZ - 0.45],
        [mid + 1.6, F + 3.65, doorZ - 0.45],
        [mid, F + 4.25, doorZ - 0.45],
      ],
      [0, 0, -1],
    );
  }
  // Simplified original gilded retable; no copied painting or individual relic.
  const altarZ = z1 - 0.55;
  box(f, 'trim', mid, F + 0.09, altarZ, 3.7, 0.3, 1.3);
  box(f, 'gold', mid, F + 0.39, altarZ, 3.15, 1.1, 0.95);
  box(f, 'inset', mid, F + 1.5, altarZ + 0.25, 1.8, 3.2, 0.12);
  for (const sign of [-1, 1]) {
    const x = mid + sign * 1.25;
    round(
      'gold',
      x,
      altarZ,
      [
        [F + 1.48, 0.52],
        [F + 1.7, 0.4],
        [F + 4.55, 0.4],
        [F + 4.75, 0.65],
      ],
      detail === 0 ? 4 : 8,
    );
    if (detail >= 2) {
      const n = detail === 2 ? 18 : 36;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 6) / n;
        box(
          f,
          'gold',
          x + Math.cos(a) * 0.22,
          F + 1.7 + (i * 2.85) / n,
          altarZ + Math.sin(a) * 0.22,
          0.12,
          0.11,
          0.12,
        );
      }
    }
  }
  box(f, 'gold', mid, F + 4.75, altarZ, 4.0, 0.25, 0.7);
  box(f, 'gold', mid, F + 5.0, altarZ, 3.7, 0.15, 0.6);
  f(
    'gold',
    [
      [mid - 1.65, F + 5.15, altarZ - 0.3],
      [mid + 1.65, F + 5.15, altarZ - 0.3],
      [mid, F + 5.65, altarZ - 0.3],
    ],
    [0, 0, -1],
  );
  box(f, 'trim', mid, F + 2, altarZ - 0.12, 0.1, 1.9, 0.1);
  box(f, 'trim', mid, F + 3.1, altarZ - 0.12, 1.02, 0.1, 0.1);
}
