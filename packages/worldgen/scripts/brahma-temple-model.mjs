/** 'N0559': Pushkar's blue mandapa, paired red domes and clustered curved shikhara. */

import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildBrahmaTemple(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    F = r.floorY,
    C = r.courtY - F,
    point = ([x, y, z]) => [x * c - z * s, F + y, x * s + z * c],
    f = (role, ps, n) =>
      face(role, ps.map(point), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
    grade = (x, z) => {
      const p = point([x, 0, z]);
      return sample(p[0], p[2]) - F;
    },
    circle = (n) => (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]);

  // The mapped low court gallery prevents a generic multi-storey shell hiding the hall.
  const G = r.galleryFloorY - F;
  const simplify = (ps) => {
    if (ps.length < 3) return ps;
    const a = ps[0],
      b = ps.at(-1),
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    let far = 0,
      index = 0;
    for (let i = 1; i < ps.length - 1; i++) {
      const q = ps[i],
        t = Math.max(
          0,
          Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)),
        ),
        distance = Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dz);
      if (distance > far) {
        far = distance;
        index = i;
      }
    }
    return far > 1.5
      ? [...simplify(ps.slice(0, index + 1)).slice(0, -1), ...simplify(ps.slice(index))]
      : [a, b];
  };
  if (detail < 2) {
    for (const p of r.gallery) {
      const low = Math.min(...p.outline.map((q) => grade(...q))) - 0.4;
      prism(
        f,
        'pale',
        detail === 0 ? { outline: simplify([...p.outline, p.outline[0]]).slice(0, -1) } : p,
        low,
        G + 2.85,
        false,
      );
    }
  } else {
    const holes = [
        ...[-10, -6, -2, 2, 6, 10].map((x) => ({
          center: [x, 9.0],
          axis: [1, 0],
          width: 1.7,
          bottom: G + 0.05,
          height: 2.25,
          spring: 1.45,
          shape: 'round',
          depth: 1.4,
        })),
        ...[-6, -2, 2, 6].map((x) => ({
          center: [x, -9.15],
          axis: [1, 0],
          width: 1.7,
          bottom: G + 0.05,
          height: 2.25,
          spring: 1.45,
          shape: 'round',
          depth: 1.2,
        })),
      ].map((h) => prepareOpening(h, 0, detail)),
      adapter = { addTriangle: (_role, _ref, ps, n) => f('pale', ps, n) },
      clipped = openingBuilder(adapter, holes),
      cut = (role, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++)
          clipped.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], n);
      };
    for (const p of r.galleryWalls) {
      prism(cut, 'pale', p, G, G + 2.65, false);
      for (const ring of [p.outline, ...p.holes])
        openingReveals(
          adapter,
          ring,
          () => G,
          () => G + 2.65,
          holes,
          undefined,
        );
    }
    for (const p of r.gallery) {
      const low = Math.min(...p.outline.map((q) => grade(...q))) - 0.4;
      prism(f, 'pale', p, low, G, false);
      prism(f, 'pale', p, G + 2.65, G + 2.85, false);
    }
  }
  // The retained temple outline, not the surrounding precinct, owns this small court cap.
  for (const p of r.footprints) {
    if (detail === 0) {
      continue;
    }
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        low = Math.min(grade(...a), grade(...b), C - 0.2) - 0.35;
      f(
        'pale',
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], C - 0.12, b[1]],
          [a[0], C - 0.12, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
    prism(f, 'paving', p, C - 0.12, C);
  }
  for (const p of r.platform) {
    prism(f, 'pale', p, C - 0.12, -0.12, false);
    prism(f, 'paving', p, -0.12, 0, false);
  }
  for (const p of r.annexes) {
    if (detail === 0) {
      const xs = p.outline.map((q) => q[0]),
        zs = p.outline.map((q) => q[1]),
        x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs);
      box(f, 'pale', (x0 + x1) / 2, C, (z0 + z1) / 2, x1 - x0, 3.5 - C, z1 - z0);
      continue;
    }
    prism(f, 'pale', p, C, 3.5, false);
  }
  const stair = (z, width, run) => {
    const n = detail === 0 ? 2 : 6,
      low = C - 0.2;
    for (let i = 0; i < n; i++) {
      const top = C + ((0 - C) * (n - i)) / n;
      box(f, 'pale', 15.8 + ((i + 0.5) * run) / n, low, z, run / n, top - low, width);
    }
  };
  stair(0, 3.05, 4.0);
  stair(-5.1, 2.8, 3.1);
  for (const z of [-2.25, 2.25]) {
    box(f, 'pale', 16.8, C, z, 2.4, -C + 0.05, 1.15);
    if (detail >= 2) box(f, 'door', 18.01, C + 0.19, z, 0.025, 0.58, 0.52);
  }

  // Pale enclosed sanctuary, with an actual recessed closed door and side windows.
  if (detail === 0) box(f, 'pale', -9.8, 0, 0, 8.7, 5.6, 13.9);
  else {
    box(f, 'pale', -13.7, 0, 0, 0.6, 5.2, 13.4);
    for (const hand of [-1, 1]) {
      const z = hand * 6.4;
      for (const [x, w] of [
        [-12.35, 2.1],
        [-7.5, 3.2],
      ])
        box(f, 'pale', x, 0, z, w, 5.2, 0.6);
      box(f, 'pale', -10.2, 0, z, 2.2, 1.9, 0.6);
      box(f, 'pale', -10.2, 3.6, z, 2.2, 1.6, 0.6);
      box(f, 'door', -10.2, 1.95, z - hand * 0.2, 2.16, 1.6, 0.08);
      if (detail >= 2)
        for (let i = 0; i < 5; i++)
          box(f, 'gold', -11.08 + i * 0.44, 1.9, z + hand * 0.32, 0.035, 1.7, 0.035);
      box(f, 'pale', -5.6, 0, hand * 3.95, 0.6, 5.2, 5.5);
    }
    box(f, 'pale', -5.6, 3.3, 0, 0.6, 1.9, 2.4);
    box(f, 'door', -5.86, 0.08, 0, 0.12, 3.18, 2.34);
    box(f, 'pale', -9.8, 5.2, 0, 8.7, 0.4, 13.9);
    if (detail >= 1) {
      for (const z of [-1.3, 1.3]) box(f, 'gold', -5.23, 0, z, 0.14, 3.5, 0.18);
      box(f, 'gold', -5.23, 3.3, 0, 0.14, 0.2, 2.8);
      if (detail >= 2)
        for (let i = 0; i < 6; i++) box(f, 'gold', -5.77, 0.2, -0.96 + i * 0.38, 0.025, 2.9, 0.02);
    }
  }
  const columns = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 4; j++)
      if (i !== 1 || j === 0 || j === 3) columns.push([-4 + i * 7.6, -6.2 + (j * 12.4) / 3]);
  columns.push([14.8, -2.25], [14.8, 2.25]);
  for (const [x, z] of columns) {
    if (detail === 0) {
      box(
        (role, ps, n) => {
          if (n[1] === 0) f(role, ps, n);
        },
        'blue',
        x,
        0,
        z,
        0.7,
        4.6,
        0.7,
      );
      box(f, 'green', x, 4.6, z, 1.22, 0.6, 1.22);
      continue;
    }
    if (detail === 1) {
      loft(
        f,
        'blue',
        x,
        z,
        [
          [0, 0.92],
          [0.22, 0.72],
          [4.5, 0.59],
          [4.9, 1.22],
          [5.2, 1.22],
        ],
        false,
        circle(6),
      );
      box(f, 'green', x, 0.22, z, 0.76, 0.65, 0.76);
      box(f, 'gold', x, 2.6, z, 0.76, 0.12, 0.76);
      box(f, 'green', x, 4.65, z, 1.15, 0.22, 1.15);
      continue;
    }
    const n = detail === 2 ? 12 : 24,
      ring = (w) =>
        Array.from({ length: n }, (_, k) => {
          const a = (k * Math.PI * 2) / n,
            rad = (w / 2) * (detail >= 2 ? 1 + 0.035 * Math.cos(a * 8) : 1);
          return [Math.cos(a) * rad, Math.sin(a) * rad];
        });
    loft(
      f,
      'blue',
      x,
      z,
      [
        [0, 0.92],
        [0.16, 0.92],
        [0.24, 0.72],
        [0.95, 0.72],
        [1.08, 0.59],
        [2.6, 0.59],
        [2.7, 0.73],
        [2.82, 0.59],
        [4.35, 0.59],
        [4.5, 0.78],
        [4.64, 1.01],
        [4.9, 1.22],
        [5.2, 1.22],
      ],
      false,
      ring,
    );
    for (const [y, h, w] of [
      [0.22, 0.65, 0.75],
      [4.65, 0.22, 1.15],
    ]) {
      loft(
        f,
        'green',
        x,
        z,
        [
          [y, w],
          [y + h, w],
        ],
        false,
        circle(n),
      );
      loft(
        f,
        'gold',
        x,
        z,
        [
          [y, w + 0.055],
          [y + 0.075, w + 0.055],
        ],
        false,
        circle(n),
      );
      loft(
        f,
        'gold',
        x,
        z,
        [
          [y + h - 0.075, w + 0.055],
          [y + h, w + 0.055],
        ],
        false,
        circle(n),
      );
    }
    loft(
      f,
      'gold',
      x,
      z,
      [
        [2.6, 0.76],
        [2.72, 0.76],
      ],
      false,
      circle(n),
    );
    if (detail >= 2) {
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          co = Math.cos(a),
          si = Math.sin(a),
          p = (u, y, rad) => [x + co * rad - si * u, y, z + si * rad + co * u];
        for (const y of [0.35, 4.67])
          f(
            'pale',
            [
              p(-0.14, y, y > 4 ? 0.585 : 0.385),
              p(0, y + 0.3, y > 4 ? 0.6 : 0.39),
              p(0.14, y, y > 4 ? 0.585 : 0.385),
            ],
            [co, 0.05, si],
          );
        for (const h of [1.14, 2.86])
          f(
            'pale',
            [
              p(-0.02, h, 0.307),
              p(0.02, h, 0.307),
              p(0.02, h + 1.35, 0.307),
              p(-0.02, h + 1.35, 0.307),
            ],
            [co, 0, si],
          );
      }
    }
  }
  box(f, 'blue', 3.65, 5.2, 0, 17.3, 0.4, 14.6);
  box(f, 'blue', 14.1, 5.2, 0, 3.8, 0.4, 6.4);
  if (detail >= 2)
    for (const [x, z] of columns) {
      const n = 8;
      f(
        'gold',
        Array.from({ length: n }, (_, i) => [
          x + Math.cos((i * Math.PI * 2) / n) * 0.25,
          5.185,
          z + Math.sin((i * Math.PI * 2) / n) * 0.25,
        ]),
        [0, -1, 0],
      );
    }

  const parapet = (x, z, w, d) => {
    prism(
      f,
      'red',
      { outline: rect(x, z, w, d).outline, holes: [rect(x, z, w - 0.36, d - 0.36).outline] },
      5.6,
      6.2,
    );
    if (detail < 2) return;
    for (const axis of [0, 1])
      for (const hand of [-1, 1]) {
        const len = axis ? d : w,
          count = Math.floor(len / 1.25);
        for (let k = 0; k < count; k++) {
          const u = -len / 2 + ((k + 0.5) * len) / count,
            coords = [
              [-0.4, 6.2],
              [-0.32, 6.45],
              [0, 6.66],
              [0.32, 6.45],
              [0.4, 6.2],
            ],
            positions = coords.map(([v, y]) =>
              axis
                ? [x + hand * (w / 2 - 0.1), y, z + u + v]
                : [x + u + v, y, z + hand * (d / 2 - 0.1)],
            ),
            n = axis ? [hand, 0, 0] : [0, 0, hand];
          f('red', positions, n);
          f(
            'red',
            positions.toReversed(),
            n.map((v) => -v),
          );
        }
      }
  };
  parapet(3.65, 0, 17.1, 14.4);
  const n = detail === 0 ? 6 : detail === 1 ? 12 : detail === 2 ? 24 : 32;
  for (const [x, radius] of [
    [0, 3.7],
    [8, 3.3],
  ]) {
    const ys =
      detail === 0
        ? [
            [5.65, 2 * radius],
            [6.4, 2 * radius],
            [7.45, radius],
            [7.65, 0.15],
          ]
        : Array.from({ length: 9 }, (_, i) => {
            const t = ((i / 8) * Math.PI) / 2;
            return [5.9 + Math.sin(t) * 1.95, Math.max(0.12, Math.cos(t) * radius * 2)];
          });
    loft(f, 'red', x, 0, ys, false, circle(n));
    loft(
      f,
      'gold',
      x,
      0,
      [
        [7.8, 0.35],
        [8.04, 0.55],
        [8.34, 0.2],
        [8.5, 0.06],
      ],
      false,
      circle(detail === 0 ? 4 : 8),
    );
    if (detail >= 2)
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6,
          co = Math.cos(a),
          si = Math.sin(a);
        for (let j = 0; j < 6; j++) {
          const t0 = ((j / 8) * Math.PI) / 2,
            t1 = (((j + 1) / 8) * Math.PI) / 2,
            p = (t, u) => [
              x + co * (Math.cos(t) * radius + 0.016) - si * u,
              5.9 + Math.sin(t) * 1.95 + 0.015,
              si * (Math.cos(t) * radius + 0.016) + co * u,
            ];
          f('red', [p(t0, -0.025), p(t0, 0.025), p(t1, 0.025), p(t1, -0.025)], [co, 0.5, si]);
        }
      }
  }

  const stepped =
    detail === 0
      ? undefined
      : detail === 1
        ? (w) =>
            [
              [-0.5, -0.5],
              [0, -0.58],
              [0.5, -0.5],
              [0.58, 0],
              [0.5, 0.5],
              [0, 0.58],
              [-0.5, 0.5],
              [-0.58, 0],
            ].map((p) => p.map((v) => v * w))
        : (w) =>
            [
              [-0.5, -0.5],
              [-0.2, -0.5],
              [-0.2, -0.58],
              [0.2, -0.58],
              [0.2, -0.5],
              [0.5, -0.5],
              [0.5, -0.2],
              [0.58, -0.2],
              [0.58, 0.2],
              [0.5, 0.2],
              [0.5, 0.5],
              [0.2, 0.5],
              [0.2, 0.58],
              [-0.2, 0.58],
              [-0.2, 0.5],
              [-0.5, 0.5],
              [-0.5, 0.2],
              [-0.58, 0.2],
              [-0.58, -0.2],
              [-0.5, -0.2],
            ].map((p) => p.map((v) => v * w));
  const spire = (x, z, base, height, width, major) => {
    const k = detail === 0 ? 4 : detail === 1 ? 5 : detail === 2 ? (major ? 8 : 6) : 12,
      at = (t) => 0.45 + (width - 0.45) * Math.pow(1 - t, 0.65),
      profile = Array.from({ length: k + 1 }, (_, i) => [base + (i * height) / k, at(i / k)]);
    loft(f, 'red', x, z, profile, false, stepped);
    if (detail >= 2)
      for (let i = 1; i < k; i += detail === 2 ? 2 : 1) {
        const t = i / k,
          y = base + t * height,
          w = at(t);
        loft(
          f,
          'red',
          x,
          z,
          [
            [y, w + 0.12],
            [y + 0.1, w + 0.09],
          ],
          false,
          stepped,
        );
      }
    const top = base + height;
    loft(
      f,
      'gold',
      x,
      z,
      detail === 0 && !major
        ? [
            [top, 0.45],
            [top + 0.88, 0.05],
          ]
        : [
            [top, 0.45],
            [top + 0.15, 0.72],
            [top + 0.32, 0.64],
            [top + 0.5, 0.25],
            [top + 0.68, 0.4],
            [top + 0.88, 0.05],
          ],
      false,
      circle(detail === 0 ? 4 : 8),
    );
    if (major) {
      box(f, 'gold', x, top + 0.8, z, 0.045, 1.2, 0.045);
      const p = [
        [x, top + 1.92, z],
        [x + 1.1, top + 1.6, z + 0.12],
        [x, top + 1.25, z],
      ];
      f('gold', p, [0, 0, 1]);
      f('gold', p.toReversed(), [0, 0, -1]);
    }
  };
  spire(-9.8, 0, 5.6, 11.8, 7.7, true);
  for (const z of [-2.8, 2.8]) spire(-6.85, z, 5.6, 6.1, 2.4, false);
  if (detail >= 1) for (const z of [-2.8, 2.8]) spire(-11.8, z, 5.6, 4.1, 2.0, false);
}
