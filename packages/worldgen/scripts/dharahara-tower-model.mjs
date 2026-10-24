/** 'dharahara': standing rebuilt Dharahara and separately preserved earlier remains. */
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { loft, prism } from './khmer-structure-geometry.mjs';

export function buildDharaharaTower(face, detail, r, sample) {
  const F = r.floorY,
    O = r.oldFloorY,
    [x, z] = r.center,
    [ox, oz] = r.oldCenter;
  const n = [8, 16, 40, 64][detail],
    circle =
      (count = n) =>
      (width) =>
        Array.from({ length: count }, (_, i) => [
          (Math.cos((i * Math.PI * 2) / count) * width) / 2,
          (Math.sin((i * Math.PI * 2) / count) * width) / 2,
        ]);
  const revolve = (role, cx, cz, profile, count = n) =>
    loft(face, role, cx, cz, profile, false, circle(count));
  const tube = (role, a, b, width, count = 4) => {
    const d = b.map((v, i) => v - a[i]),
      L = Math.hypot(...d),
      v = d.map((q) => q / L),
      s = Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0],
      cross = (p, q) => [
        p[1] * q[2] - p[2] * q[1],
        p[2] * q[0] - p[0] * q[2],
        p[0] * q[1] - p[1] * q[0],
      ],
      u0 = cross(v, s),
      u = u0.map((q) => q / Math.hypot(...u0)),
      w = cross(v, u),
      ring = (p) =>
        Array.from({ length: count }, (_, i) =>
          p.map(
            (q, k) =>
              q +
              (width / 2) *
                (u[k] * Math.cos((i * Math.PI * 2) / count) +
                  w[k] * Math.sin((i * Math.PI * 2) / count)),
          ),
        );
    const low = ring(a),
      high = ring(b);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      face(
        role,
        [low[i], low[j], high[j], high[i]],
        low[i].map((q, k) => q - a[k]),
      );
    }
    face(
      role,
      low,
      v.map((q) => -q),
    );
    face(role, high, v);
  };
  const footing = (cx, cz, rad, top) => {
    const ring = circle()(rad * 2),
      low =
        Math.min(
          ...Array.from({ length: 64 }, (_, i) =>
            sample(
              cx + Math.cos((i * Math.PI) / 32) * rad,
              cz + Math.sin((i * Math.PI) / 32) * rad,
            ),
          ),
        ) - 0.45;
    prism(face, 'stone', { outline: ring.map(([a, b]) => [cx + a, cz + b]) }, low, top, false);
  };
  footing(x, z, 10, F + 0.16);
  revolve('stone', x, z, [
    [F + 0.16, 20],
    [F + 0.45, 19.2],
    [F + 0.45, 18.4],
    [F + 0.8, 18.4],
    [F + 0.8, 17.4],
    [F + 1.15, 17.4],
    [F + 1.15, 16.2],
    [F + 1.5, 16.2],
  ]);
  const radius = (y) => 7.55 - ((y - 1.5) * 2.7) / 58.1,
    a = r.entranceAngleRadians,
    co = Math.cos(a),
    si = Math.sin(a),
    radial = ([u, y, v]) => [x - si * u + co * v, F + y, z + co * u + si * v];
  const hole = prepareOpening(
      {
        center: [x + co * 7.4, z + si * 7.4],
        axis: [-si, co],
        width: 1.8,
        bottom: F + 1.5,
        height: 3.4,
        spring: 2.45,
        shape: 'round',
        depth: 2.1,
      },
      0,
      detail,
    ),
    cut = openingBuilder({ addTriangle: (_role, _ref, ps, norm) => face('pale', ps, norm) }, [
      hole,
    ]);
  const body = (role, ps, norm) => {
    for (let i = 1; i < ps.length - 1; i++)
      cut.addTriangle(role, 'palette:#ffffff', [ps[0], ps[i], ps[i + 1]], norm);
  };
  loft(
    detail >= 1 ? body : face,
    'pale',
    x,
    z,
    [
      [F + 1.5, 15.1],
      [F + 59.6, 9.7],
    ],
    false,
    circle(),
  );
  const collarHeights = [13, 20, 27, 34, 41, 48, 54, 59.6];
  for (const y of collarHeights) {
    const d = radius(y) * 2;
    revolve(
      'pale',
      x,
      z,
      detail === 0
        ? [
            [F + y - 0.17, d + 0.26],
            [F + y + 0.17, d + 0.26],
          ]
        : [
            [F + y - 0.27, d + 0.02],
            [F + y - 0.16, d + 0.3],
            [F + y - 0.04, d + 0.38],
            [F + y + 0.11, d + 0.3],
            [F + y + 0.22, d + 0.1],
          ],
    );
  }
  // Sparse circular oculi on the mostly blind shaft; no invented rows of large windows.
  if (detail >= 2)
    for (const [y, theta] of [
      [11, 0.9],
      [16, 2.0],
      [22, 0.4],
      [31, 2.3],
      [38, 0.6],
      [45, 1.2],
      [50, 2.5],
      [55, 0.1],
      [24, 3.8],
      [37, 4.8],
      [49, 5.1],
    ]) {
      const ct = Math.cos(theta),
        st = Math.sin(theta),
        rr = radius(y),
        at = (u, v, d) => [x + ct * (rr + d) - st * u, F + y + v, z + st * (rr + d) + ct * u],
        count = detail === 2 ? 10 : 16;
      const inner = Array.from({ length: count }, (_, i) =>
        at(
          Math.cos((i * Math.PI * 2) / count) * 0.32,
          Math.sin((i * Math.PI * 2) / count) * 0.32,
          0.012,
        ),
      );
      face('metal', inner, [ct, 0, st]);
      for (let i = 0; i < count; i++) {
        const p = (i * Math.PI * 2) / count,
          q = ((i + 1) * Math.PI * 2) / count;
        face(
          'pale',
          [
            at(Math.cos(p) * 0.32, Math.sin(p) * 0.32, 0.014),
            at(Math.cos(q) * 0.32, Math.sin(q) * 0.32, 0.014),
            at(Math.cos(q) * 0.41, Math.sin(q) * 0.41, 0.075),
            at(Math.cos(p) * 0.41, Math.sin(p) * 0.41, 0.075),
          ],
          [ct, 0, st],
        );
      }
    }
  // The entrance recess is cut into the shaft, with a closed arched door behind its rim.
  if (detail >= 1) {
    const arch = (w, bottom, spring, h) => [
        [-w / 2, bottom],
        [w / 2, bottom],
        [w / 2, bottom + spring],
        ...Array.from({ length: 13 }, (_, i) => {
          const t = (i * Math.PI) / 12;
          return [(Math.cos(t) * w) / 2, bottom + spring + Math.sin(t) * (h - spring)];
        }),
      ],
      door = arch(1.8, 1.5, 2.45, 3.4),
      outer = arch(2.35, 1.45, 2.45, 3.7);
    face(
      'metal',
      door.map(([u, y]) => radial([u, y, 6.7])),
      [co, 0, si],
    );
    for (let i = 0; i < door.length - 1; i++) {
      const j = i + 1;
      face(
        'pale',
        [
          radial([door[i][0], door[i][1], 7.52]),
          radial([door[j][0], door[j][1], 7.52]),
          radial([outer[j][0], outer[j][1], 7.65]),
          radial([outer[i][0], outer[i][1], 7.65]),
        ],
        [co, 0, si],
      );
      face(
        'stone',
        [
          radial([door[i][0], door[i][1], 6.7]),
          radial([door[j][0], door[j][1], 6.7]),
          radial([door[j][0], door[j][1], 7.52]),
          radial([door[i][0], door[i][1], 7.52]),
        ],
        [-si, 0, co],
      );
    }
    for (let i = 0; i < 5; i++) {
      const d = 8.1 + i * 0.55,
        y = 1.5 - i * 0.3,
        ps = [
          [-1.3, d - 0.32],
          [1.3, d - 0.32],
          [1.3, d + 0.32],
          [-1.3, d + 0.32],
        ].map(([u, v]) => {
          const p = radial([u, 0, v]);
          return [p[0], p[2]];
        }),
        low = Math.min(...ps.map((p) => sample(...p))) - 0.35;
      prism(face, 'stone', { outline: ps }, low, F + y);
    }
    if (detail >= 2) {
      const p = radial([0.4, 2.85, 6.73]);
      tube('gold', p, [p[0], p[1] - 0.27, p[2]], 0.065, 4);
    }
  }
  // Projecting crown and open rail preserve the recognizable upper silhouette.
  revolve(
    'pale',
    x,
    z,
    detail === 0
      ? [
          [F + 59.6, 9.7],
          [F + 60.3, 13.6],
          [F + 61, 13.6],
          [F + 61, 9.3],
          [F + 64.4, 9.3],
        ]
      : [
          [F + 59.4, 9.7],
          [F + 59.8, 10.5],
          [F + 60.05, 11.9],
          [F + 60.32, 13.2],
          [F + 60.55, 13.6],
          [F + 60.8, 13.6],
          [F + 61, 13.2],
          [F + 61, 9.3],
          [F + 64.3, 9.3],
          [F + 64.55, 10.0],
        ],
  );
  if (detail >= 1) {
    const count = [0, 24, 48, 64][detail];
    for (let i = 0; i < count; i++) {
      const t = (i * Math.PI * 2) / count,
        c = Math.cos(t),
        s = Math.sin(t);
      tube(
        'metal',
        [x + c * 6.35, F + 61, z + s * 6.35],
        [x + c * 6.35, F + 62.45, z + s * 6.35],
        detail === 1 ? 0.08 : 0.065,
        4,
      );
      if (detail >= 2)
        tube(
          'pale',
          [x + c * 4.9, F + 59.6, z + s * 4.9],
          [x + c * 6.25, F + 60.3, z + s * 6.25],
          0.14,
          4,
        );
    }
    for (const y of [61.18, 62.45]) {
      const count = detail === 1 ? 12 : n;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          b = ((i + 1) * Math.PI * 2) / count;
        const p = (t, radius, h) => [x + Math.cos(t) * radius, F + y + h, z + Math.sin(t) * radius];
        face(
          'metal',
          [p(a, 6.415, 0), p(b, 6.415, 0), p(b, 6.415, 0.07), p(a, 6.415, 0.07)],
          [Math.cos(a), 0, Math.sin(a)],
        );
        face(
          'metal',
          [p(a, 6.345, 0), p(b, 6.345, 0), p(b, 6.345, 0.07), p(a, 6.345, 0.07)],
          [-Math.cos(a), 0, -Math.sin(a)],
        );
        for (const h of [0, 0.07])
          face(
            'metal',
            [p(a, 6.345, h), p(b, 6.345, h), p(b, 6.415, h), p(a, 6.415, h)],
            [0, h ? 1 : -1, 0],
          );
      }
    }
    for (let i = 0; i < (detail === 1 ? 12 : 24); i++) {
      const t = (i * Math.PI * 2) / (detail === 1 ? 12 : 24),
        c = Math.cos(t),
        s = Math.sin(t);
      tube(
        'metal',
        [x + c * 4.8, F + 64.5, z + s * 4.8],
        [x + c * 4.3, F + 66.6, z + s * 4.3],
        0.07,
        4,
      );
    }
  }
  const domeSteps = [3, 5, 8, 12][detail],
    profile = Array.from({ length: domeSteps + 1 }, (_, i) => {
      const t = (i * Math.PI) / 2 / domeSteps;
      return [F + 64.55 + Math.sin(t) * 3.65, Math.max(0.02, Math.cos(t) * 10.0)];
    });
  revolve('gold', x, z, profile);
  revolve(
    'gold',
    x,
    z,
    [
      [F + 68.2, 0.6],
      [F + 68.75, 0.7],
      [F + 69.05, 0.3],
      [F + 72, 0.015],
    ],
    Math.min(n, 16),
  );
  // Separate earlier base and irregular hollow stump; no intact destroyed tower added.
  footing(ox, oz, 11.7, O + 0.5);
  const oldProfiles = [];
  for (let i = 0; i < 8; i++) {
    const y = O + 0.5 + i * 0.4375,
      d = 22.4 - i * 1.12;
    oldProfiles.push([y, d], [y + 0.4375, d]);
  }
  revolve('stone', ox, oz, oldProfiles, Math.min(n, 40));
  const m = [8, 16, 32, 48][detail],
    top = (i) => O + 7.7 + 0.36 * Math.sin(i * 2.4) + 0.22 * Math.cos(i * 1.3),
    point = (i, rad, y) => [
      ox + Math.cos((i * Math.PI * 2) / m) * rad,
      y,
      oz + Math.sin((i * Math.PI * 2) / m) * rad,
    ];
  for (let i = 0; i < m; i++) {
    const j = (i + 1) % m,
      ct = Math.cos(((i + 0.5) * Math.PI * 2) / m),
      st = Math.sin(((i + 0.5) * Math.PI * 2) / m);
    face(
      'brick',
      [point(i, 5.1, O + 4), point(j, 5.1, O + 4), point(j, 4.75, top(j)), point(i, 4.75, top(i))],
      [ct, 0, st],
    );
    if (detail >= 1) {
      face(
        'brick',
        [point(i, 3.4, O + 4), point(j, 3.4, O + 4), point(j, 3.4, top(j)), point(i, 3.4, top(i))],
        [-ct, 0, -st],
      );
      face(
        'stone',
        [
          point(i, 4.75, top(i)),
          point(j, 4.75, top(j)),
          point(j, 3.4, top(j)),
          point(i, 3.4, top(i)),
        ],
        [0, 1, 0],
      );
    }
  }
  if (detail >= 2)
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4,
        ct = Math.cos(t),
        st = Math.sin(t),
        P = (u, y) => [ox + ct * 5.08 - st * u, O + y, oz + st * 5.08 + ct * u];
      face(
        'pale',
        [P(-0.65, 4.1), P(0.85, 4.1), P(0.7, 5.7), P(-0.3, 6.2), P(-0.8, 5.3)],
        [ct, 0, st],
      );
    }
  const side = 8.3,
    base = O + 0.5,
    peak = [ox, O + 12.5, oz],
    corners = [
      [-side, -side],
      [side, -side],
      [side, side],
      [-side, side],
    ].map(([u, v]) => [ox + u, base, oz + v]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (detail >= 1)
      face(
        'glass',
        [corners[i], corners[j], peak],
        [corners[i][0] + corners[j][0] - 2 * ox, 1, corners[i][2] + corners[j][2] - 2 * oz],
      );
    tube('metal', corners[i], corners[j], 0.12);
    tube('metal', corners[i], peak, 0.12);
    if (detail >= 1)
      for (let k = 1; k < 5; k++) {
        const t = k / 5,
          A = corners[i].map((v, c) => v + (peak[c] - v) * t),
          B = corners[j].map((v, c) => v + (peak[c] - v) * t);
        tube('metal', A, B, 0.06);
        if (detail >= 2) {
          const A0 = corners[i].map((v, c) => v + (corners[j][c] - v) * t);
          tube('metal', A0, peak, 0.06);
        }
      }
  }
}
