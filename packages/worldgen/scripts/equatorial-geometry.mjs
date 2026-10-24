/** 'great_equatorial_building_royal_observatory_greenwich': octagonal stock brick, projecting gallery and green onion dome. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildEquatorial(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  for (const p of r.footing) prism(f, 'plinth', p, r.foundationY, Y);
  for (const p of r.lower) prism(f, 'wall', p, Y, Y + 2.6);
  prism(f, 'wall', r.octagon, Y + 2.6, Y + 9.6);
  B('dark', -4.34, 0, 0, 0.08, 2.6, 1.8);
  B('stone', -4.78, 2.5, 0, 0.96, 0.12, 1.94);
  const ring = (radius, count = 8, phase = Math.PI / 8) =>
    Array.from({ length: count }, (_, i) => [
      Math.cos(phase + (i / count) * Math.PI * 2) * radius,
      Math.sin(phase + (i / count) * Math.PI * 2) * radius,
    ]);
  function band(role, inner, outer, lo, hi, count = 8, phase = Math.PI / 8) {
    prism(
      f,
      role,
      { outline: ring(outer, count, phase), holes: [ring(inner, count, phase)] },
      Y + lo,
      Y + hi,
    );
  }
  for (const [y, h] of [
    [3.1, 0.22],
    [6.45, 0.18],
    [9.35, 0.25],
  ])
    band('stone', 5.59, 5.78, y, y + h);
  // Closed annular deck, lower fascia and handrail; the real timber look uses shared paint.
  band('frame', 5.57, 6.32, 6.5, 6.67);
  band('frame', 6.12, 6.32, 6.64, 6.82);
  band('frame', 6.1, 6.32, 7.48, 7.62);
  if (detail) {
    const count = detail === 1 ? 3 : detail === 2 ? 6 : 8;
    const outer = ring(6.22);
    for (let i = 0; i < 8; i++) {
      const a = outer[i],
        b = outer[(i + 1) % 8];
      for (let j = 0; j < count; j++) {
        const t = j / count,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        B('frame', x, 6.78, z, 0.1, 0.73, 0.1);
        if (detail === 3) B('frame', x, 6.98, z, 0.16, 0.28, 0.16);
      }
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
        rad = Math.hypot(...mid),
        u = mid.map((v) => v / rad);
      B('dark', u[0] * 5.62, 6.1, u[1] * 5.62, 0.19, 0.5, 0.19);
    }
  }
  const n = detail === 0 ? 12 : detail === 1 ? 20 : detail === 2 ? 32 : 48,
    fullProfile = [
      [9.6, 5.25],
      [10.1, 5.7],
      [11.4, 6.05],
      [13.4, 5.75],
      [14.8, 4.7],
      [15.65, 3.2],
      [16.05, 1.7],
      [16.2, 1.25],
    ],
    profile = detail === 0 ? fullProfile.filter((_, i) => ![1, 6].includes(i)) : fullProfile,
    rings = profile.map(([y, rad]) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos((i / n) * Math.PI * 2) * rad,
        Y + y,
        Math.sin((i / n) * Math.PI * 2) * rad,
      ]),
    );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 0.5) / n) * Math.PI * 2;
      f(
        'roof',
        [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        [Math.cos(a), 0.4, Math.sin(a)],
      );
    }
  f('roof', rings.at(-1), [0, 1, 0]);
  if (detail >= 2)
    for (let i = 0; i < n; i += 2) {
      const a = (i / n) * Math.PI * 2,
        normal = [Math.cos(a), 0.4, Math.sin(a)],
        across = [-Math.sin(a) * 0.026, 0, Math.cos(a) * 0.026];
      for (let j = 0; j < rings.length - 1; j++) {
        const p = rings[j][i].map((v, k) => v + (k === 1 ? 0 : normal[k] * 0.025)),
          q = rings[j + 1][i].map((v, k) => v + (k === 1 ? 0 : normal[k] * 0.025));
        f(
          'seam',
          [
            p.map((v, k) => v + across[k]),
            p.map((v, k) => v - across[k]),
            q.map((v, k) => v - across[k]),
            q.map((v, k) => v + across[k]),
          ],
          normal,
        );
      }
    }
  // A closed south-facing shutter strip is an exterior cue, not a functioning aperture.
  for (let j = 0; j < profile.length - 1; j++) {
    const a = profile[j],
      b = profile[j + 1],
      point = (v, t) => [Math.cos(t) * (v[1] + 0.035), Y + v[0], Math.sin(t) * (v[1] + 0.035)];
    f(
      'seam',
      [
        point(a, Math.PI / 2 - 0.04),
        point(a, Math.PI / 2 + 0.04),
        point(b, Math.PI / 2 + 0.04),
        point(b, Math.PI / 2 - 0.04),
      ],
      [0, 0.3, 1],
    );
  }
  const crownN = detail === 0 ? 8 : detail === 1 ? 12 : 24;
  band('dark', 1.1, 1.34, 16.2, detail === 0 ? 16.96 : 16.32, crownN, 0);
  if (detail > 0) {
    for (const y of [16.33, 16.89]) band('dark', 1.23, 1.3, y, y + 0.055, crownN, 0);
    for (let i = 0; i < crownN; i++) {
      const a = (i / crownN) * Math.PI * 2;
      B('dark', Math.cos(a) * 1.27, 16.34, Math.sin(a) * 1.27, 0.045, 0.64, 0.045);
    }
  }
  // Each sash uses the tangent plane of its actual octagonal face.
  const apothem = 5.65 * Math.cos(Math.PI / 8);
  function light(angle, center, w, h) {
    const nx = Math.cos(angle),
      nz = Math.sin(angle),
      ux = -nz,
      uz = nx,
      local = ([u, y, depth]) => [
        nx * (apothem + depth) + ux * u,
        Y + y,
        nz * (apothem + depth) + uz * u,
      ],
      draw = (role, u, y, depth, W, H, D) =>
        prism(
          (m, ps, n) => f(m, ps.map(local), [ux * n[0] + nx * n[2], n[1], uz * n[0] + nz * n[2]]),
          role,
          {
            outline: [
              [u - W / 2, depth - D / 2],
              [u + W / 2, depth - D / 2],
              [u + W / 2, depth + D / 2],
              [u - W / 2, depth + D / 2],
            ],
            holes: [],
          },
          y,
          y + H,
        ),
      bottom = center - h / 2;
    draw('glass', 0, bottom, 0.055, w, h, 0.06);
    if (!detail) return;
    for (const sign of [-1, 1])
      draw('frame', sign * (w / 2 + 0.065), bottom - 0.05, 0.08, 0.11, h + 0.16, 0.12);
    draw('stone', 0, bottom - 0.11, 0.1, w + 0.3, 0.13, 0.16);
    draw('arch', 0, bottom + h + 0.035, 0.1, w + 0.35, 0.2, 0.13);
    if (detail >= 2) {
      draw('frame', 0, bottom, 0.14, 0.065, h, 0.06);
      for (let j = 1; j < 4; j++) draw('frame', 0, bottom + (h * j) / 4, 0.14, w, 0.05, 0.06);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    for (const [center, h, w] of [
      [1.65, 2.2, 1.35],
      [4.8, 2.05, 1.4],
      [8.3, 1.08, 1.02],
    ]) {
      if (i === 4 && center < 2) continue;
      if (detail === 0 && center !== 4.8) continue;
      light(a, center, w, h);
    }
  }
}
