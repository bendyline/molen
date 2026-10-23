/** 'N0752_EASTPAVILION': independent brick Camera Obscura pavilion and rounded lead cap. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildEastPavilion(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const points = r.floors.flatMap((p) => p.outline),
    xs = points.map((p) => p[0]),
    zs = points.map((p) => p[1]),
    x0 = Math.min(...xs),
    x1 = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    cx = (x0 + x1) / 2,
    cz = (z0 + z1) / 2,
    w = x1 - x0,
    d = z1 - z0;
  for (const p of r.floors) prism(f, 'plinth', p, r.foundationY, Y);
  for (const p of r.lower) prism(f, 'wall', p, Y, Y + 2.4);
  for (const p of r.floors) prism(f, 'wall', p, Y + 2.4, Y + 5.5);
  B('dark', -1.53, 0, 0, 0.08, 2.4, 1.9);
  B('stone', (x0 - 1.55) / 2, 2.34, 0, -1.55 - x0 + 0.08, 0.1, 1.98);
  B('stone', (x0 - 1.55) / 2, -0.08, 0, -1.55 - x0 + 0.08, 0.08, 1.98);
  for (const [y, h, spread] of [
    [0, 0.2, 0.08],
    [3.15, 0.2, 0.08],
    [5.35, 0.3, 0.25],
  ])
    B('stone', cx, y, cz, w + spread * 2, h, d + spread * 2);
  const n = detail === 0 ? 8 : detail === 1 ? 12 : 24,
    profile = [
      [5.65, 1],
      [5.9, 0.87],
      [6.65, 0.68],
      [7.3, 0.47],
      [7.85, 0.2],
      [8.05, 0.08],
    ],
    rings = profile.map(([y, k]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a),
          q = 1 + (1 / Math.max(Math.abs(c), Math.abs(s)) - 1) * k;
        return [cx + c * (w + 0.3) * 0.5 * k * q, Y + y, cz + s * (d + 0.3) * 0.5 * k * q];
      }),
    );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 0.5) / n) * Math.PI * 2;
      f(
        'roof',
        [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        [Math.cos(a), 0.5, Math.sin(a)],
      );
      if (detail >= 2 && i % 2 === 0) {
        const v = [-Math.sin(a) * 0.035, 0, Math.cos(a) * 0.035],
          p = rings[j][i],
          q = rings[j + 1][i];
        f(
          'stone',
          [
            p.map((t, k) => t + v[k]),
            p.map((t, k) => t - v[k]),
            q.map((t, k) => t - v[k]),
            q.map((t, k) => t + v[k]),
          ],
          [Math.cos(a), 0.5, Math.sin(a)],
        );
      }
    }
  f('roof', rings.at(-1), [0, 1, 0]);
  B('roof', cx, 8.05, cz, 0.18, 0.45, 0.18);
  const finial = {
    outline: Array.from({ length: 8 }, (_, i) => [
      cx + Math.cos((i / 8) * Math.PI * 2) * 0.2,
      cz + Math.sin((i / 8) * Math.PI * 2) * 0.2,
    ]),
    holes: [],
  };
  prism(f, 'roof', finial, Y + 8.5, Y + 8.8);
  function window(side, u, y, ww, hh, blank = false) {
    const alongX = side === 'north' || side === 'south',
      sign = side === 'south' || side === 'east' ? 1 : -1,
      x = alongX ? cx + u : sign > 0 ? x1 : x0,
      z = alongX ? (sign > 0 ? z1 : z0) : cz + u,
      at = (role, a, b, c, W, H, D) =>
        alongX
          ? B(role, x + a, y + b, z + sign * c, W, H, D)
          : B(role, x + sign * c, y + b, z + a, D, H, W);
    at(blank ? 'stone' : 'glass', 0, -hh / 2, 0.04, ww, hh, 0.06);
    if (!detail) return;
    for (const a of [-1, 1])
      at('stone', a * (ww / 2 + 0.08), -hh / 2 - 0.12, 0.07, 0.16, hh + 0.4, 0.16);
    for (const b of [-hh / 2 - 0.12, hh / 2 + 0.12]) at('stone', 0, b, 0.1, ww + 0.32, 0.15, 0.2);
    if (blank) return;
    at('frame', 0, -hh / 2, 0.11, 0.06, hh, 0.07);
    for (let j = 1; j <= (detail === 1 ? 1 : 3); j++)
      at('frame', 0, -hh / 2 + (hh * j) / (detail === 1 ? 2 : 4), 0.12, ww, 0.055, 0.07);
  }
  window('south', 0.95, 1.7, 1.15, 2.2);
  window('south', -0.95, 1.7, 1.15, 2.2, true);
  window('south', 0, 4.35, 1.1, 0.75);
  window('north', 0, 1.7, 1.35, 2.2);
  window('north', 0, 4.35, 1.1, 0.75);
  if (detail) {
    window('east', 0, 1.7, 1.3, 2.2);
    window('east', 0, 4.35, 1.1, 0.75);
    window('west', 0, 4.35, 1.1, 0.75);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let y = 0.35; y < 5.35; y += detail === 1 ? 0.9 : 0.55)
          B(
            'stone',
            (sx > 0 ? x1 : x0) - sx * 0.1,
            y,
            (sz > 0 ? z1 : z0) - sz * 0.1,
            0.4,
            0.27,
            0.4,
          );
  }
}
