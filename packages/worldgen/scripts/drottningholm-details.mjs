/** 'drottningholm_palace': original roof pavilions, lakefront loggia and garden steps. */
import './install-deterministic-math.mjs';
import { box, rect } from './khmer-structure-geometry.mjs';

function author(face, r) {
  const F = (role, ps, n) =>
    face(
      role,
      ps.map(([x, y, z]) => [x, y + r.floorY, z]),
      n,
    );
  return { F, B: (role, x, y, z, w, h, d) => box(F, role, x, y, z, w, h, d) };
}
function hip(F, x, z, w, d, y, rise) {
  const p = rect(x, z, w, d).outline,
    q = rect(x, z, w * 0.68, d * 0.68).outline;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    F(
      'roof',
      [
        [p[i][0], y, p[i][1]],
        [p[j][0], y, p[j][1]],
        [q[j][0], y + rise, q[j][1]],
        [q[i][0], y + rise, q[i][1]],
      ],
      [p[i][0] + p[j][0] - 2 * x, 1, p[i][1] + p[j][1] - 2 * z],
    );
  }
  F(
    'roof',
    q.map(([x, z]) => [x, y + rise, z]),
    [0, 1, 0],
  );
}
export function drawDrottningholmRoofPavilion(face, detail, r, x) {
  const { F, B } = author(face, r),
    z = -2.8,
    n = detail === 0 ? 0 : detail === 1 ? 1 : detail === 2 ? 3 : 8;
  const ring = (y, scale) => {
    const rx = 5.4 * scale,
      rz = 15.35 * scale,
      cr = 4.2 * scale;
    if (!n) return rect(x, z, rx * 2, rz * 2).outline.map(([X, Z]) => [X, y, Z]);
    const out = [];
    for (let k = 0; k < 4; k++) {
      const cx = x + (k === 0 || k === 3 ? 1 : -1) * (rx - cr),
        cz = z + (k < 2 ? 1 : -1) * (rz - cr);
      for (let j = 0; j <= n; j++) {
        const t = ((k + j / n) * Math.PI) / 2;
        out.push([cx + cr * Math.cos(t), y, cz + cr * Math.sin(t)]);
      }
    }
    return out;
  };
  const profile =
      detail === 0
        ? [
            [18.2, 1],
            [23.3, 0.9],
            [25.9, 0.38],
          ]
        : [
            [18.2, 1],
            [19.6, 1.04],
            [22.2, 0.98],
            [24.5, 0.72],
            [25.9, 0.38],
          ],
    rings = profile.map(([y, s]) => ring(y, s));
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < rings[k].length; i++) {
      const j = (i + 1) % rings[k].length,
        A = rings[k - 1][i],
        Z = rings[k - 1][j];
      F('roof', [A, Z, rings[k][j], rings[k][i]], [A[0] + Z[0] - 2 * x, 1, A[2] + Z[2] - 2 * z]);
    }
  for (const [points, N] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ])
    for (let j = 1; j < points.length - 1; j++) F('roof', [points[0], points[j], points[j + 1]], N);
  B('stone', x, 25.9, z, 2.7, 1.6, 3.3);
  hip(F, x, z, 3.4, 4.0, 27.5, 0.9);
  if (!detail) return;
  for (const side of [-1, 1]) {
    F(
      'glass',
      [
        [x - 0.95, 26.35, z + side * 1.656],
        [x + 0.95, 26.35, z + side * 1.656],
        [x + 0.95, 27.1, z + side * 1.656],
        [x - 0.95, 27.1, z + side * 1.656],
      ],
      [0, 0, side],
    );
    F(
      'glass',
      [
        [x + side * 1.356, 26.35, z - 1.15],
        [x + side * 1.356, 26.35, z + 1.15],
        [x + side * 1.356, 27.1, z + 1.15],
        [x + side * 1.356, 27.1, z - 1.15],
      ],
      [side, 0, 0],
    );
    const front = side < 0 ? -18.5 : 12.9,
      back = front - side * 2.5,
      cy = 22.6,
      count = detail === 1 ? 8 : detail === 2 ? 12 : 24;
    const P = (t, rad, Z) => [x + Math.cos(t) * rad, cy + Math.sin(t) * rad, Z];
    for (let j = 0; j < count; j++) {
      const t = (j * 2 * Math.PI) / count,
        T = ((j + 1) * 2 * Math.PI) / count;
      F(
        'roof',
        [P(t, 1.2, front), P(T, 1.2, front), P(T, 1.2, back), P(t, 1.2, back)],
        [Math.cos((t + T) / 2), Math.sin((t + T) / 2), 0],
      );
      F(
        'stone',
        [P(t, 1.2, front), P(T, 1.2, front), P(T, 0.97, front), P(t, 0.97, front)],
        [0, 0, side],
      );
      F(
        'dark',
        [
          [x, cy, front + side * 0.012],
          P(t, 0.97, front + side * 0.012),
          P(T, 0.97, front + side * 0.012),
        ],
        [0, 0, side],
      );
    }
    const Z = front + side * 0.025;
    F(
      'trim',
      [
        [x - 0.045, cy - 0.05, Z],
        [x + 0.045, cy - 0.05, Z],
        [x + 0.045, cy + 0.66, Z],
        [x - 0.045, cy + 0.66, Z],
      ],
      [0, 0, side],
    );
    F(
      'trim',
      [
        [x - 0.05, cy - 0.045, Z],
        [x + 0.47, cy - 0.045, Z],
        [x + 0.47, cy + 0.045, Z],
        [x - 0.05, cy + 0.045, Z],
      ],
      [0, 0, side],
    );
  }
}
export function drawDrottningholmArcade(face, detail, r) {
  if (!detail || !r.lakeArcade) return;
  const { F, B } = author(face, r),
    a = r.lakeArcade,
    bay = (a.x1 - a.x0) / a.count,
    n = detail === 1 ? 2 : detail === 2 ? 8 : 16;
  for (let j = 0; j <= a.count; j++)
    B('stone', a.x0 + j * bay, 0, a.front + 0.45, a.pierWidth, a.top, 0.9);
  for (let j = 0; j < a.count; j++) {
    const mid = a.x0 + (j + 0.5) * bay,
      rx = (bay - a.pierWidth) / 2,
      ry = Math.min(rx, a.top - a.spring - 0.25);
    for (let k = 0; k < n; k++) {
      const t = (k * Math.PI) / n,
        T = ((k + 1) * Math.PI) / n,
        x = mid - rx * Math.cos(t),
        X = mid - rx * Math.cos(T),
        y = a.spring + ry * Math.sin(t),
        Y = a.spring + ry * Math.sin(T);
      F(
        'wall',
        [
          [x, y, a.front],
          [X, Y, a.front],
          [X, a.top, a.front],
          [x, a.top, a.front],
        ],
        [0, 0, -1],
      );
      F(
        'stone',
        [
          [x, y, a.front],
          [x, y, a.front + 0.9],
          [X, Y, a.front + 0.9],
          [X, Y, a.front],
        ],
        [0, -1, 0],
      );
    }
  }
  const x = 3.5,
    z = a.front - 1.0;
  B('stone', x, 5.6, z, 11.6, 0.35, 2.7);
  for (const X of [0.8, 1.2, 5.8, 6.2]) {
    const sides = detail === 1 ? 4 : detail === 2 ? 8 : 12,
      profile = [
        [0, 0.24],
        [0.2, 0.24],
        [0.42, 0.16],
        [5.25, 0.14],
        [5.42, 0.24],
        [5.6, 0.27],
      ];
    for (let k = 1; k < profile.length; k++)
      for (let j = 0; j < sides; j++) {
        const t = (j * 2 * Math.PI) / sides,
          T = ((j + 1) * 2 * Math.PI) / sides,
          P = (i, u) => [
            X + Math.cos(u) * profile[i][1],
            profile[i][0],
            a.front - 0.27 + Math.sin(u) * profile[i][1],
          ];
        F(
          'stone',
          [P(k - 1, t), P(k - 1, T), P(k, T), P(k, t)],
          [Math.cos((t + T) / 2), 0, Math.sin((t + T) / 2)],
        );
      }
  }
  B('stone', x, 6.0, z - 1.05, 11.9, 0.16, 0.22);
  B('stone', x, 6.9, z - 1.05, 11.9, 0.16, 0.26);
  const posts = detail === 1 ? 4 : detail === 2 ? 9 : 16;
  for (let j = 0; j <= posts; j++)
    B('stone', x - 5.7 + (11.4 * j) / posts, 6.15, z - 1.05, 0.15, 0.75, 0.15);
}
export function drawDrottningholmGardenSteps(face, detail, r) {
  if (!detail) return;
  const { B } = author(face, r),
    x = 3.5,
    back = r.gardenEntryZ ?? 11.7,
    landing = 13.7,
    front = 23.7,
    top = 5.85,
    start = r.gardenStairBaseY ?? 1.7,
    n = detail === 1 ? 4 : detail === 2 ? 8 : 12;
  B('stone', x, -3.6, (back + landing) / 2, 8.4, top + 3.6, landing - back);
  for (let j = 0; j < n; j++) {
    const z = front - ((front - landing) * (j + 1)) / n,
      y = start + ((top - start) * (j + 1)) / n;
    B('stone', x, -3.6, z, 8.4, y + 3.6, (front - landing) / n + 0.02);
  }
  for (const X of [x - 4.2, x + 4.2])
    B('stone', X, top, (back + landing) / 2, 0.25, 0.9, landing - back);
  // The original main wall closes this reconstructed stair landing; no copied doorway or interior.
  B('dark', x, top + 0.1, back + 0.035, 2.8, 3.0, 0.05);
}
