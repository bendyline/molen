/** 'N0535': Specific octagonal Quba Mere Diwane exterior and its open east portico. */
import { box, loft, prism } from './khmer-structure-geometry.mjs';

export function buildQubaDiwaneTemple(emit, detail, r, sampleTerrain) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    pose = ([u, y, v]) => [r.center[0] + c * u - s * v, y, r.center[1] + s * u + c * v],
    direction = ([x, y, z]) => [c * x - s * z, y, s * x + c * z],
    f = (role, ps, n) => emit(role, ps.map(pose), direction(n)),
    floor = r.floorY,
    grade = (x, z) => {
      const p = pose([x, 0, z]);
      return sampleTerrain(p[0], p[2]);
    },
    ring = (radius, n = 8) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((i + 0.5) * Math.PI * 2) / n;
        return [radius * Math.cos(a), radius * Math.sin(a)];
      }),
    round = (role, x, z, profile, n = 8) =>
      loft(
        f,
        role,
        x,
        z,
        profile.map(([y, rad]) => [y, rad * 2]),
        false,
        (w) => ring(w / 2, n),
      );
  function foundation(outline, top) {
    const low = outline.map(([x, z]) => [x, grade(x, z) - 0.45, z]),
      high = outline.map(([x, z]) => [x, top, z]);
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length,
        a = outline[i],
        b = outline[j];
      f('base', [low[i], low[j], high[j], high[i]], [b[1] - a[1], 0, a[0] - b[0]]);
    }
    // Top and bottom caps are retained for dependable streaming/fallback geometry.
    prism(
      (role, ps, n) => {
        if (Math.abs(n[1]) > 0.5) f(role, ps, n);
      },
      'base',
      { outline, holes: [] },
      Math.min(...low.map((p) => p[1])),
      top,
    );
  }
  const foot = ring(10.5);
  foundation(foot, floor);
  foundation(
    [
      [8.5, -4.8],
      [14.8, -4.8],
      [14.8, 4.8],
      [8.5, 4.8],
    ],
    floor,
  );
  if (detail > 0)
    round(
      'base',
      0,
      0,
      [
        [floor, 10.5],
        [floor + 0.14, 10.5],
        [floor + 0.14, 10.1],
        [floor + 0.32, 10.1],
      ],
      8,
    );

  // A local facade frame has x tangent, z outward; holes are real in the stone skin.
  function facade(angle, apothem) {
    const nx = Math.cos(angle),
      nz = Math.sin(angle),
      tx = -nz,
      tz = nx;
    return (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, d]) => [nx * (apothem + d) + tx * x, y, nz * (apothem + d) + tz * x]),
        [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
      );
  }
  function skin(q, width, lo, hi, holes = [], thickness = 0.38, role = 'stone') {
    const xs = [
        -width / 2,
        width / 2,
        ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2]),
      ].sort((a, b) => a - b),
      ys = [lo, hi, ...holes.flatMap((h) => [h.y, h.y + h.h])].sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (holes.some((h) => Math.abs(x - h.x) < h.w / 2 && y > h.y && y < h.y + h.h)) continue;
        if (xs[i + 1] - xs[i] > 1e-5 && ys[j + 1] - ys[j] > 1e-5)
          for (const d of [0, -thickness])
            q(
              role,
              [
                [xs[i], ys[j], d],
                [xs[i + 1], ys[j], d],
                [xs[i + 1], ys[j + 1], d],
                [xs[i], ys[j + 1], d],
              ],
              [0, 0, d === 0 ? 1 : -1],
            );
      }
    const boundaries = [
      [
        [-width / 2, lo],
        [width / 2, lo],
        [width / 2, hi],
        [-width / 2, hi],
      ],
      ...holes.map((h) => [
        [h.x - h.w / 2, h.y],
        [h.x - h.w / 2, h.y + h.h],
        [h.x + h.w / 2, h.y + h.h],
        [h.x + h.w / 2, h.y],
      ]),
    ];
    for (const ring of boundaries)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        q(
          role,
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -thickness],
            [a[0], a[1], -thickness],
          ],
          [b[1] - a[1], a[0] - b[0], 0],
        );
      }
  }
  const ap = r.apothem,
    w = 2 * ap * Math.tan(Math.PI / 8),
    bodyTop = floor + r.bodyHeight;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4,
      q = facade(angle, ap),
      door = [0, 2, 6].includes(i),
      window = { x: 0, y: floor + 5.1, w: 0.5, h: 1.6 },
      holes =
        detail === 0 ? [] : [window, ...(door ? [{ x: 0, y: floor + 0.3, w: 2.25, h: 2.9 }] : [])];
    skin(q, w, floor + 0.25, bodyTop, holes);
    if (detail > 0) {
      box(q, 'window', 0, window.y, -0.15, 0.5, window.h, 0.045);
      for (const x of [-0.42, 0.42]) box(q, 'stone', x, window.y - 0.16, 0.04, 0.2, 1.96, 0.18);
      box(q, 'stone', 0, window.y + window.h, 0.06, 1.05, 0.22, 0.22);
      for (const x of [-w / 2 + 0.25, w / 2 - 0.25])
        box(q, 'stone', x, floor + 0.3, 0.08, 0.4, 8.35, 0.26);
      box(q, 'stone', 0, bodyTop - 0.6, 0.12, w, 0.3, 0.35);
      if (door) {
        box(q, 'wood', 0, floor + 0.3, -0.12, 2.25, 2.9, 0.16);
        for (const x of [-1.3, 1.3]) box(q, 'stone', x, floor + 0.3, 0.11, 0.32, 3.15, 0.3);
        box(q, 'stone', 0, floor + 3.2, 0.12, 2.95, 0.3, 0.32);
        if (detail >= 2) {
          for (const x of [-0.55, 0.55]) {
            box(q, 'wood', x, floor + 0.6, -0.015, 0.82, 2.23, 0.1);
            for (const y of [1.1, 2.05])
              for (const sign of [-1, 1]) {
                // Original abstract fan relief on the timber; no copied readable motif.
                const xx = x + sign * 0.16;
                q(
                  'wood',
                  [
                    [xx - 0.16, floor + y, 0],
                    [xx, floor + y + 0.35, 0.09],
                    [xx + 0.16, floor + y, 0],
                  ],
                  [0, 0, 1],
                );
              }
          }
          box(q, 'gold', -0.13, floor + 1.55, 0.055, 0.05, 0.22, 0.055);
          box(q, 'gold', 0.13, floor + 1.55, 0.055, 0.05, 0.22, 0.055);
        }
      } else if (i % 2 === 1) {
        const n = detail === 1 ? 5 : 9,
          y = floor + 5.15,
          rad = 1.6;
        for (let k = 0; k < n; k++) {
          const a = (Math.PI * k) / n,
            b = (Math.PI * (k + 1)) / n;
          q(
            'stone',
            [
              [0, y, 0.12],
              [Math.cos(a) * rad, y + Math.sin(a) * rad, 0.12],
              [Math.cos(b) * rad, y + Math.sin(b) * rad, 0.12],
            ],
            [0, 0, 1],
          );
          if (detail >= 2) {
            const angle = (a + b) / 2,
              d = 0.055,
              point = (angle, radius, depth) => [
                Math.cos(angle) * radius,
                y + Math.sin(angle) * radius,
                depth,
              ];
            q(
              'stone',
              [
                point(angle - d, 0.16, 0.13),
                point(angle - d, rad, 0.13),
                point(angle, rad, 0.31),
                point(angle, 0.16, 0.2),
              ],
              [0, 0, 1],
            );
            q(
              'stone',
              [
                point(angle, 0.16, 0.2),
                point(angle, rad, 0.31),
                point(angle + d, rad, 0.13),
                point(angle + d, 0.16, 0.13),
              ],
              [0, 0, 1],
            );
          }
        }
      }
      if (detail >= 2)
        for (let k = 0; k < 9; k++) {
          const x = -w / 2 + 0.5 + (k * (w - 1)) / 8;
          q(
            'stone',
            [
              [x - 0.24, bodyTop - 0.72, 0.24],
              [x + 0.24, bodyTop - 0.72, 0.24],
              [x, bodyTop - 1.08, 0.22],
            ],
            [0, 0, 1],
          );
        }
    }
  }
  const roofRadius = ap / Math.cos(Math.PI / 8);
  round(
    'stone',
    0,
    0,
    [
      [bodyTop - 0.2, roofRadius + 0.12],
      [bodyTop + 0.14, roofRadius + 0.12],
    ],
    8,
  );
  if (detail > 0)
    round(
      'roof',
      0,
      0,
      [
        [bodyTop + 0.14, roofRadius],
        [bodyTop + 0.27, roofRadius],
      ],
      8,
    );

  function finial(x, z, y, scale) {
    if (detail === 0) return;
    round(
      'gold',
      x,
      z,
      [
        [y, 0.065 * scale],
        [y + 0.75 * scale, 0.045 * scale],
        [y + 1.1 * scale, 0.012 * scale],
      ],
      6,
    );
    if (detail >= 2)
      round(
        'gold',
        x,
        z,
        [
          [y + 0.34 * scale, 0.05 * scale],
          [y + 0.47 * scale, 0.16 * scale],
          [y + 0.64 * scale, 0.05 * scale],
        ],
        8,
      );
  }
  function cone(x, z, baseY, radius, topY, central = false) {
    const n = detail === 0 ? 8 : central ? 16 : 12;
    round(
      'roof',
      x,
      z,
      [
        [baseY, radius],
        [topY, 0.025],
      ],
      n,
    );
    if (detail >= 1) {
      const nr = central ? 16 : 8;
      for (let i = 0; i < nr; i++) {
        const a = ((i + 0.5) * Math.PI * 2) / nr,
          da = 0.012;
        f(
          'stone',
          [
            [x + Math.cos(a - da) * radius, baseY, z + Math.sin(a - da) * radius],
            [x + Math.cos(a) * (radius + 0.065), baseY, z + Math.sin(a) * (radius + 0.065)],
            [x + Math.cos(a) * 0.035, topY - 0.1, z + Math.sin(a) * 0.035],
          ],
          [Math.cos(a), 0.2, Math.sin(a)],
        );
        f(
          'stone',
          [
            [x + Math.cos(a) * (radius + 0.065), baseY, z + Math.sin(a) * (radius + 0.065)],
            [x + Math.cos(a + da) * radius, baseY, z + Math.sin(a + da) * radius],
            [x + Math.cos(a) * 0.035, topY - 0.1, z + Math.sin(a) * 0.035],
          ],
          [Math.cos(a), 0.2, Math.sin(a)],
        );
      }
    }
    finial(x, z, topY, central ? 1 : 0.65);
  }
  // Large windowed drum; eight narrow slit bays remain actual recesses at textured levels.
  const n = detail === 0 ? 8 : 16,
    rad = 4.2,
    drumTop = floor + 14.8;
  if (detail === 0)
    round(
      'stone',
      0,
      0,
      [
        [bodyTop, rad],
        [drumTop, rad],
      ],
      n,
    );
  else
    for (let i = 0; i < n; i++) {
      const q = facade((i * Math.PI * 2) / n, rad * Math.cos(Math.PI / n)),
        width = 2 * rad * Math.sin(Math.PI / n),
        hole = { x: 0, y: floor + 11, w: 0.36, h: 2.2 };
      skin(q, width, bodyTop, drumTop, i % 2 === 0 ? [hole] : [], 0.28);
      if (i % 2 === 0) box(q, 'window', 0, hole.y, -0.13, 0.36, hole.h, 0.035);
      if (detail >= 2)
        q(
          'stone',
          [
            [-width * 0.28, drumTop - 0.25, 0.12],
            [width * 0.28, drumTop - 0.25, 0.12],
            [0, drumTop - 0.62, 0.11],
          ],
          [0, 0, 1],
        );
    }
  round(
    'stone',
    0,
    0,
    [
      [drumTop - 0.1, rad + 0.12],
      [drumTop + 0.19, rad + 0.12],
    ],
    n,
  );
  cone(0, 0, drumTop + 0.19, rad + 0.12, floor + 25, true);
  for (const a of r.smallTowerAngles) {
    const x = 6.3 * Math.cos(a),
      z = 6.3 * Math.sin(a),
      rad = 1.7,
      lo = bodyTop - 0.1,
      hi = floor + 12.2;
    round(
      'stone',
      x,
      z,
      [
        [lo, rad],
        [hi, rad],
      ],
      detail === 0 ? 8 : 12,
    );
    if (detail > 0) {
      round(
        'stone',
        x,
        z,
        [
          [hi - 0.25, rad + 0.15],
          [hi + 0.1, rad + 0.15],
        ],
        12,
      );
      if (detail >= 2) {
        const q = facade(a, 6.3 + rad),
          y = floor + 10.3;
        // Tiny dark inset under a shallow stone hood, rather than projecting black boxes.
        box(q, 'window', 0, y, 0.012, 0.32, 0.65, 0.018);
        box(q, 'stone', 0, y + 0.65, 0.05, 0.56, 0.13, 0.12);
      }
    }
    cone(x, z, hi + 0.1, rad + 0.15, floor + 17.2);
  }
  // Real open portico: four square posts, high lintels and a thin top slab.
  for (const x of [9.8, 14.2])
    for (const z of [-4.1, 4.1]) box(f, 'stone', x, floor, z, 0.8, 7.5, 0.8);
  box(f, 'stone', 12, floor + 7.5, 0, 6.4, 1.15, 9.6);
  box(f, 'roof', 12, floor + 8.65, 0, 6.7, 0.24, 9.8);
  if (detail > 0) {
    for (const x of [9.8, 14.2])
      for (const z of [-4.1, 4.1]) box(f, 'base', x, floor, z, 0.88, 0.55, 0.88);
    const q = facade(0, 14.9),
      radius = 0.9,
      points = Array.from({ length: 13 }, (_, i) => [
        Math.cos((i * Math.PI) / 12) * radius,
        floor + 8.9 + Math.sin((i * Math.PI) / 12) * radius,
      ]);
    // Uninscribed semicircular crest sits on the outer portico beam.
    for (let i = 0; i < 12; i++)
      q(
        'stone',
        [
          [0, floor + 8.9, -0.3],
          [points[i][0], points[i][1], -0.3],
          [points[i + 1][0], points[i + 1][1], -0.3],
        ],
        [0, 0, -1],
      );
    for (let i = 0; i < 12; i++)
      q(
        'stone',
        [
          [0, floor + 8.9, 0.15],
          [points[i][0], points[i][1], 0.15],
          [points[i + 1][0], points[i + 1][1], 0.15],
        ],
        [0, 0, 1],
      );
    for (let i = 0; i < 12; i++)
      q(
        'stone',
        [
          [points[i][0], points[i][1], -0.3],
          [points[i + 1][0], points[i + 1][1], -0.3],
          [points[i + 1][0], points[i + 1][1], 0.15],
          [points[i][0], points[i][1], 0.15],
        ],
        [0, 1, 0],
      );
  }
  // Short approaches use local ground, without covering the entire surrounding court.
  for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
    const q = facade(a, a === 0 ? 14.8 : 10.0),
      length = 2,
      width = a === 0 ? 5.6 : 3.4,
      steps = detail === 0 ? 2 : 5;
    for (let i = 0; i < steps; i++) {
      const d = (length * (i + 0.5)) / steps,
        x = Math.cos(a) * (a === 0 ? 14.8 : 10.0) + Math.cos(a) * d,
        z = Math.sin(a) * (a === 0 ? 14.8 : 10.0) + Math.sin(a) * d,
        top = floor - (floor - grade(x, z)) * (i / steps),
        bottom = Math.min(top - 0.1, grade(x, z) - 0.2);
      box(q, 'base', 0, bottom, d, width, top - bottom, length / steps + 0.025);
    }
  }
}
