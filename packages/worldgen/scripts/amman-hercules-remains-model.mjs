/** 'temple_of_hercules': Amman's two complete plain-shaft columns, broken portico and low temple remains. */
import { buildCorinthianColumn } from './corinthian-column-geometry.mjs';
import { box, loft, rect } from './khmer-structure-geometry.mjs';

export function buildAmmanHerculesRemains(emit, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    point = ([x, y, z]) => [x * c - z * s, y, x * s + z * c],
    f = (role, ps, n) => {
      emit(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]);
    },
    ground = (x, z) => {
      const p = point([x, 0, z]);
      return sample(p[0], p[2]);
    },
    ring = (radius, n) =>
      Array.from({ length: n }, (_, i) => [
        Math.cos((i * Math.PI * 2) / n) * radius,
        Math.sin((i * Math.PI * 2) / n) * radius,
      ]),
    round = (out, role, x, z, profile, n) =>
      loft(out, role, x, z, profile, false, (w) => ring(w / 2, n));
  const lowWall = (a, b, height, width = 1.25) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      nx = ((-dz / length) * width) / 2,
      nz = ((dx / length) * width) / 2,
      count = Math.max(1, Math.ceil(length / (detail === 0 ? 12 : detail === 1 ? 6 : 3)));
    for (let i = 0; i < count; i++) {
      const start = i / count,
        end = (i + 1) / count,
        p = [a[0] + dx * start, a[1] + dz * start],
        q = [a[0] + dx * end, a[1] + dz * end],
        plan = [
          [p[0] + nx, p[1] + nz],
          [q[0] + nx, q[1] + nz],
          [q[0] - nx, q[1] - nz],
          [p[0] - nx, p[1] - nz],
        ],
        low = plan.map(([x, z]) => [x, ground(x, z) - 0.4, z]),
        top = plan.map(([x, z], k) => [
          x,
          ground(x, z) + height + (detail >= 2 ? (((i + k) % 4) - 1) * 0.06 : 0),
          z,
        ]);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        f(
          'wall',
          [low[k], low[j], top[j], top[k]],
          [plan[k][1] - plan[j][1], 0, plan[j][0] - plan[k][0]],
        );
      }
      f('wall', top, [0, 1, 0]);
      if (detail >= 2) {
        const up = top.map(([x, y, z]) => [x, y + 0.1, z]);
        f('rubble', up, [0, 1, 0]);
        for (let k = 0; k < 4; k++) {
          const j = (k + 1) % 4;
          f(
            'rubble',
            [top[k], top[j], up[j], up[k]],
            [plan[k][1] - plan[j][1], 0, plan[j][0] - plan[k][0]],
          );
        }
      }
    }
  };
  const native = r.controls[0].polygons[0].outline,
    outer = native.map(([x, z]) => [x * c + z * s, -x * s + z * c]);
  for (let i = 0; i < outer.length; i++)
    lowWall(outer[i], outer[(i + 1) % outer.length], 0.35, 0.72);
  const C = r.cella;
  for (const [a, b, h] of [
    [[C.west, C.north], [C.west, C.south], 1.7],
    [[C.west, C.north], [-10, C.north], 1.1],
    [[-7, C.north], [C.east, C.north], 0.9],
    [[C.west, C.south], [-13, C.south], 1.0],
    [[-10, C.south], [1, C.south], 0.75],
    [[3, C.south], [C.east, C.south], 0.9],
    [[C.east, C.north], [C.east, -2.4], 1.25],
    [[C.east, 2.4], [C.east, C.south], 1.0],
  ])
    lowWall(a, b, h);
  const rectangle = ([x0, z0, x1, z1]) =>
      rect((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0).outline,
    inner = rectangle(r.portico.inner),
    mound = rectangle(r.portico.outer),
    Y = F - 0.12;
  f(
    'soil',
    inner.map(([x, z]) => [x, Y, z]),
    [0, 1, 0],
  );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = inner[i],
      b = inner[j],
      A = mound[i],
      B = mound[j];
    f(
      'soil',
      [
        [a[0], Y, a[1]],
        [b[0], Y, b[1]],
        [B[0], ground(...B) + 0.06, B[1]],
        [A[0], ground(...A) + 0.06, A[1]],
      ],
      [0, 1, 0],
    );
  }
  for (const q of r.columns) {
    const n = detail === 0 ? 6 : detail === 1 ? 12 : detail === 2 ? 24 : 32,
      low =
        Math.min(...[-1.1, 1.1].flatMap((x) => [-1.1, 1.1].map((z) => ground(q.x + x, q.z + z)))) -
        0.35;
    box(f, 'wall', q.x, low, q.z, 2.15, F - low, 2.15);
    if (detail >= 1)
      for (let i = 1; i <= 3; i++) {
        const y = F - i * 0.23;
        if (y > low) box(f, 'wall', q.x, y, q.z, 2.18, 0.035, 2.18);
      }
    if (q.complete) {
      const scale = q.height / 15.2;
      if (detail === 0) {
        box(f, 'column', q.x, F, q.z, 1.55, 0.22, 1.55);
        round(
          f,
          'column',
          q.x,
          q.z,
          [
            [F + 0.22, 1.08],
            [F + 8.85, 0.9],
          ],
          n,
        );
        box(f, 'column', q.x, F + 8.85, q.z, 1.7, 1.35, 1.7);
      } else {
        // Keep the existing original base/capital; the photographed shaft is unfluted.
        buildCorinthianColumn(
          (role, ps, target) => {
            if (role === 'shaft') return;
            f(
              'column',
              ps.map(([x, y, z]) => [q.x + x * scale, F + y * scale, q.z + z * scale]),
              target,
            );
          },
          0,
          0,
          detail === 1 ? 1 : detail === 2 ? 2 : 3,
          0,
        );
        const profile = [
          [F + 0.74 * scale, 1.57 * scale],
          [F + 3.5 * scale, 1.6 * scale],
          [F + 7 * scale, 1.54 * scale],
          [F + 10.8 * scale, 1.42 * scale],
          [F + 13.2 * scale, 1.32 * scale],
        ];
        if (detail === 1) round(f, 'column', q.x, q.z, profile, n);
        else {
          const diameter = (y) => {
              const i = profile.findIndex((p) => p[0] >= y);
              if (i <= 0) return profile[0][1];
              const a = profile[i - 1],
                b = profile[i];
              return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
            },
            cuts = [profile[0][0], F + 2.3, F + 4.8, F + 7.1, profile.at(-1)[0]];
          for (let i = 0; i < cuts.length - 1; i++) {
            const lo = cuts[i],
              hi = cuts[i + 1],
              p = [
                [lo, diameter(lo)],
                ...profile.filter((p) => p[0] > lo && p[0] < hi),
                [hi - 0.012, diameter(hi - 0.012)],
              ];
            round(f, 'column', q.x, q.z, p, n);
            round(
              f,
              'rubble',
              q.x,
              q.z,
              [
                [hi - 0.012, diameter(hi) * 0.995],
                [hi, diameter(hi) * 0.995],
              ],
              n,
            );
          }
        }
      }
    } else {
      const h = q.height,
        base =
          detail === 0
            ? [
                [F, 1.55],
                [F + 0.28, 1.08],
              ]
            : [
                [F, 1.55],
                [F + 0.14, 1.55],
                [F + 0.19, 1.25],
                [F + 0.28, 1.4],
                [F + 0.38, 1.1],
                [F + 0.5, 1.08],
              ];
      round(f, 'column', q.x, q.z, base, n);
      const segments = detail === 0 ? 1 : Math.max(1, Math.ceil((h - 0.5) / 2.25));
      for (let i = 0; i < segments; i++) {
        const lo = 0.5 + ((h - 0.5) * i) / segments,
          hi = 0.5 + ((h - 0.5) * (i + 1)) / segments,
          rad = (y) => 0.53 - (0.085 * y) / 10.2;
        round(
          f,
          'column',
          q.x,
          q.z,
          [
            [F + lo, rad(lo) * 2],
            [F + hi - (detail >= 2 ? 0.018 : 0), rad(hi) * 2],
          ],
          n,
        );
        if (detail >= 2)
          round(
            f,
            'rubble',
            q.x,
            q.z,
            [
              [F + hi - 0.018, rad(hi) * 1.99],
              [F + hi, rad(hi) * 1.99],
            ],
            n,
          );
      }
    }
  }
  if (detail === 0) box(f, 'stone', 13.8, F + 10.2, -5.4, 1.45, 0.8, 5.1);
  else
    for (const [y, h, w, d] of [
      [10.2, 0.15, 1.45, 5.1],
      [10.35, 0.43, 1.28, 4.95],
      [10.78, 0.11, 1.48, 5.16],
      [10.89, 0.12, 1.56, 5.22],
    ])
      box(f, 'stone', 13.8, F + y, -5.4, w, h, d);
  if (detail >= 2)
    for (const hand of [-1, 1]) {
      const high = [
          [13.1, F + 11.01, -5.4 + hand * 2.62],
          [14.5, F + 11.01, -5.4 + hand * 2.62],
          [14.4, F + 11.16, -5.4 + hand * 2.25],
          [13.2, F + 11.07, -5.4 + hand * 2.25],
        ],
        low = high.map(([x, _y, z]) => [x, F + 11, z]);
      f('stone', high, [0, 1, 0]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        f(
          'stone',
          [low[i], low[j], high[j], high[i]],
          [
            (low[i][0] + low[j][0]) / 2 - 13.8,
            0,
            (low[i][2] + low[j][2]) / 2 - (-5.4 + hand * 2.4),
          ],
        );
      }
    }
  const soilTriangles = [];
  const addSoil = (ps) => {
    for (let i = 1; i < ps.length - 1; i++) soilTriangles.push([ps[0], ps[i], ps[i + 1]]);
  };
  addSoil(inner.map(([x, z]) => [x, Y, z]));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = inner[i],
      b = inner[j],
      A = mound[i],
      B = mound[j];
    addSoil([
      [a[0], Y, a[1]],
      [b[0], Y, b[1]],
      [B[0], ground(...B) + 0.06, B[1]],
      [A[0], ground(...A) + 0.06, A[1]],
    ]);
  }
  const occupiedGrade = (x, z) => {
    let h = ground(x, z);
    for (const [a, b, c] of soilTriangles) {
      const d = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]),
        u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / d,
        v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / d,
        w = 1 - u - v;
      if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) h = Math.max(h, u * a[1] + v * b[1] + w * c[1]);
    }
    return h;
  };
  // Fallen drums and molded cornice fragments are original approximations, not restored shafts.
  for (const [x, z, length, radius] of [
    [18.2, -1.3, 2.4, 0.55],
    [19.0, 2.0, 1.8, 0.5],
    [17.8, 5.0, 1.6, 0.55],
  ]) {
    const dy = occupiedGrade(x, z + length) - occupiedGrade(x, z),
      theta = Math.atan2(dy, length),
      si = Math.sin(theta),
      co = Math.cos(theta),
      y = occupiedGrade(x, z) + radius / co + 0.025;
    round(
      (role, ps, n) =>
        f(
          role,
          ps.map(([u, v, w]) => [x + u, y + v * si + w * co, z + v * co - w * si]),
          [n[0], n[1] * si + n[2] * co, n[1] * co - n[2] * si],
        ),
      'column',
      0,
      0,
      [
        [0, radius * 2],
        [Math.hypot(length, dy), radius * 1.9],
      ],
      detail === 0 ? 6 : detail === 1 ? 10 : 20,
    );
  }
  for (const [x, z, w, d, h] of [
    [18, -6.5, 2.4, 1.0, 0.7],
    [16.5, 7.0, 1.8, 1.2, 0.6],
    [4.5, -8.2, 1.4, 1.1, 0.6],
    [-13.2, 6.3, 1.5, 1.0, 0.5],
  ]) {
    const y = occupiedGrade(x, z) + 0.03;
    box(f, 'rubble', x, y, z, w, h, d);
    if (detail >= 2) {
      box(f, 'stone', x, y + h * 0.5, z, w + 0.18, 0.13, d + 0.14);
      box(f, 'stone', x, y + h * 0.7, z, w + 0.28, 0.11, d + 0.22);
    }
  }
}
