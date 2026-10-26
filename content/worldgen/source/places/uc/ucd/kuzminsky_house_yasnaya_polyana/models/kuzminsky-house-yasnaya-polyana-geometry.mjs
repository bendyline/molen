/** 'kuzminsky_house_yasnaya_polyana': compact white house, arched fronts and northeast porch. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
export function buildKuzminsky(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      ),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const hip = (x0, x1, z0, z1, y, rise, inset) => {
    const z = (z0 + z1) / 2,
      a = [x0 + inset, y + rise, z],
      b = [x1 - inset, y + rise, z],
      q = [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ];
    Q('roof', [q[0], q[1], b, a], [0, 1, -1]);
    Q('roof', [q[1], q[2], b], [1, 1, 0]);
    Q('roof', [q[2], q[3], a, b], [0, 1, 1]);
    Q('roof', [q[3], q[0], a], [-1, 1, 0]);
    Q('roof', q, [0, -1, 0]);
  };
  const beam = (role, a, b, width) => {
    const d = b.map((v, i) => v - a[i]),
      len = Math.hypot(...d),
      n = d.map((v) => v / len),
      u = Math.abs(n[2]) < 0.9 ? [n[1], -n[0], 0] : [0, n[2], -n[1]],
      L = Math.hypot(...u),
      v = u.map((x) => ((x / L) * width) / 2),
      w = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
      corners = (p) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([s, t]) => p.map((x, i) => x + s * v[i] + t * w[i])),
      front = corners(a),
      back = corners(b);
    Q(
      role,
      front,
      n.map((x) => -x),
    );
    Q(role, back, n);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q(
        role,
        [front[i], front[j], back[j], back[i]],
        front[i].map((x, k) => (x + front[j][k]) / 2 - a[k]),
      );
    }
  };
  const recess = (cx, front, back, width, height, side = false) => {
    const S = ([u, v, d]) => (side ? [d, v, cx + u] : [cx + u, v, d]),
      sign = front > back ? 1 : -1,
      n = side ? [sign, 0, 0] : [0, 0, sign];
    for (const s of [-1, 1])
      Q(
        'wall',
        [
          S([(s * width) / 2, 0, front]),
          S([(s * width) / 2, height, front]),
          S([(s * width) / 2, height, back]),
          S([(s * width) / 2, 0, back]),
        ],
        side ? [0, 0, -s] : [-s, 0, 0],
      );
    Q(
      'trim',
      [
        S([-width / 2, height, front]),
        S([width / 2, height, front]),
        S([width / 2, height, back]),
        S([-width / 2, height, back]),
      ],
      [0, -1, 0],
    );
    Q(
      'wood',
      [
        S([-width / 2 + 0.03, 0, back]),
        S([width / 2 - 0.03, 0, back]),
        S([width / 2 - 0.03, height - 0.05, back]),
        S([-width / 2 + 0.03, height - 0.05, back]),
      ],
      n,
    );
    Q(
      'base',
      [
        S([-width / 2, -0.04, front]),
        S([width / 2, -0.04, front]),
        S([width / 2, -0.04, back]),
        S([-width / 2, -0.04, back]),
      ],
      [0, 1, 0],
    );
    if (detail >= 2) {
      if (side) B('trim', back - 0.03, 0, cx, 0.06, height - 0.1, 0.06);
      else B('trim', cx, 0, back + sign * 0.025, 0.06, height - 0.1, 0.04);
    }
  };
  for (const p of r.main) {
    prism(f, 'base', p, r.foundationY, Y);
    prism(
      (role, ps, n) => {
        if (Math.abs(n[1]) > 0.5) f(role, ps, n);
      },
      'wall',
      p,
      Y,
      Y + r.eave,
    );
    for (let i = 0; i < p.outline.length; i++) {
      const a = p.outline[i],
        b = p.outline[(i + 1) % p.outline.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        front = Math.abs(a[1]) < 0.1 && Math.abs(b[1]) < 0.1,
        rear = a[1] < -11 && b[1] < -11,
        side = a[0] < 0 && b[0] < 0;
      if (front || rear) {
        const z = front ? 0 : -11.70976,
          sg = front ? 1 : -1,
          lo = Math.min(a[0], b[0]),
          hi = Math.max(a[0], b[0]);
        for (const [x0, x1, y0, y1] of [
          [lo, -0.75, 0, r.eave],
          [0.75, hi, 0, r.eave],
          [-0.75, 0.75, 2.35, r.eave],
        ])
          Q(
            'wall',
            [
              [x0, y0, z],
              [x1, y0, z],
              [x1, y1, z],
              [x0, y1, z],
            ],
            [0, 0, sg],
          );
        // A shallow center risalit remains open at the recessed lower doorway.
        for (const x of [-1.55, 1.55]) B('wall', x, 0, z + sg * 0.16, 1.6, 2.35, 0.32);
        B('wall', 0, 2.35, z + sg * 0.16, 4.7, r.eave - 2.35, 0.32);
        recess(0, z + sg * 0.32, z - sg * 0.38, 1.5, 2.35);
      } else if (side) {
        const x = -8.95,
          z0 = Math.min(a[1], b[1]),
          z1 = Math.max(a[1], b[1]);
        for (const [u0, u1, y0, y1] of [
          [z0, -9.05, 0, r.eave],
          [-7.55, z1, 0, r.eave],
          [-9.05, -7.55, 2.3, r.eave],
        ])
          Q(
            'wall',
            [
              [x, y0, u0],
              [x, y0, u1],
              [x, y1, u1],
              [x, y1, u0],
            ],
            [-1, 0, 0],
          );
        recess(-8.3, -8.95, -8.57, 1.5, 2.3, true);
      } else
        Q(
          'wall',
          [
            [a[0], 0, a[1]],
            [b[0], 0, b[1]],
            [b[0], r.eave, b[1]],
            [a[0], r.eave, a[1]],
          ],
          [dz, 0, -dx],
        );
    }
  }
  hip(-9.45, 9.45, -12.17, 0.48, r.eave + 0.12, r.roofRise, 5.2);
  B('trim', 0, r.eave - 0.2, -5.85, 18.7, 0.32, 12.4);
  for (const sign of [-1, 1]) {
    const z = sign === 1 ? 0.34 : -12.05;
    Q(
      'wall',
      [
        [-2.65, r.eave + 0.08, z],
        [0, r.eave + 1.45, z],
        [2.65, r.eave + 0.08, z],
      ],
      [0, 0, sign],
    );
    for (const sx of [-1, 1]) {
      Q(
        'roof',
        [
          [0, r.eave + 1.58, z + sign * 0.12],
          [0, r.eave + 1.58, z - sign * 3.3],
          [sx * 2.85, r.eave + 0.06, z - sign * 3.3],
          [sx * 2.85, r.eave + 0.06, z + sign * 0.12],
        ],
        [sx, 1, 0],
      );
      beam(
        'trim',
        [0, r.eave + 1.45, z + sign * 0.13],
        [sx * 2.78, r.eave + 0.08, z + sign * 0.13],
        0.15,
      );
    }
    B('trim', 0, 3.04, z + sign * 0.65, 4.6, 0.22, 1.65);
    for (const x of [-2.2, 0, 2.2]) {
      B('trim', x, 3.25, z + sign * 1.42, 0.13, 1, 0.13);
      beam('trim', [x, 2.12, z], [x, 3.04, z + sign * 1.1], detail ? 0.13 : 0.2);
    }
    for (const y of [3.4, 4.23]) B('trim', 0, y, z + sign * 1.42, 4.65, 0.12, 0.14);
    for (const x of [-2.2, 2.2]) B('trim', x, 4.23, z + sign * 0.65, 0.13, 0.12, 1.64);
    if (detail >= 2)
      for (let x = -2.1; x < 2.1; x += 0.3) {
        beam('trim', [x - 0.11, 3.52, z + sign * 1.44], [x + 0.11, 4.12, z + sign * 1.44], 0.055);
        beam('trim', [x + 0.11, 3.52, z + sign * 1.44], [x - 0.11, 4.12, z + sign * 1.44], 0.055);
      }
  }
  for (const x of [-2.6, 2.6]) {
    B('wall', x, 8, -5.85, 0.68, 1.48, 0.65);
    B('trim', x, 9.18, -5.85, 0.79, 0.14, 0.76);
    hip(x - 0.46, x + 0.46, -6.3, -5.4, 9.45, 0.22, 0.46);
  }
  // The northeast porch is actually open: two posts, a low green roof, deck and recessed door.
  prism(f, 'base', r.porch, r.foundationY, Y - 0.16);
  prism(f, 'wood', r.porch, Y - 0.16, Y);
  hip(-12.45, -8.55, -10.48, -6.12, 2.7, 0.4, 1.7);
  for (const z of [-9.98, -6.62]) {
    B('trim', -12, 0, z, 0.18, 2.76, 0.18);
    B('trim', -12, 2.4, z, 0.32, 0.3, 0.32);
  }
  for (const s of r.steps) prism(f, 'base', { outline: s.outline, holes: [] }, s.base, s.top);
  // Closed sloped masonry cheeks sit beside the front treads.
  const fs = r.steps.slice(0, r.frontStepCount),
    last = fs.at(-1),
    z0 = fs[0].outline[0][1],
    z1 = last.outline[2][1],
    top0 = fs[0].top - Y + 0.65,
    top1 = last.top - Y + 0.65,
    base = Math.min(...fs.map((s) => s.base)) - Y;
  for (const sign of [-1, 1]) {
    const x = sign * 1.64,
      poly = [
        [base, z0],
        [base, z1],
        [top1, z1],
        [top0, z0],
      ],
      a = poly.map(([y, z]) => [x - 0.1, y, z]),
      b = poly.map(([y, z]) => [x + 0.1, y, z]);
    Q('wall', a, [-1, 0, 0]);
    Q('wall', b, [1, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      Q('wall', [a[i], a[j], b[j], b[i]], [0, poly[j][1] - poly[i][1], poly[i][0] - poly[j][0]]);
    }
  }
  if (!detail) return;
  const window = (x, y, z, w, h, side = 0, blind = false) => {
    const S = ([u, v, d]) => (side ? [x + side * d, y + v, z + u] : [x + u, y + v, z + d]),
      sg = side || (z < -6 ? -1 : 1),
      n = side ? [side, 0, 0] : [0, 0, sg],
      panel = (role, x0, y0, x1, y1, d) =>
        Q(
          role,
          [
            [x0, y0, d],
            [x1, y0, d],
            [x1, y1, d],
            [x0, y1, d],
          ].map(S),
          n,
        );
    panel(blind ? 'wall' : 'glass', -w / 2, 0, w / 2, h, sg * 0.035);
    for (const [a, b, c, d] of [
      [-w / 2 - 0.08, -0.08, -w / 2, h + 0.08],
      [w / 2, -0.08, w / 2 + 0.08, h + 0.08],
      [-w / 2, h, w / 2, h + 0.1],
      [-w / 2, -0.12, w / 2, 0.01],
    ])
      panel('trim', a, b, c, d, sg * 0.075);
    if (detail >= 2 && !blind) {
      panel('trim', -0.035, 0, 0.035, h, sg * 0.09);
      panel('trim', -w / 2, h * 0.66, w / 2, h * 0.66 + 0.055, sg * 0.09);
      if (detail === 3) panel('trim', -w / 2, h * 0.33, w / 2, h * 0.33 + 0.045, sg * 0.09);
    }
  };
  for (const z of [0.055, -11.78])
    for (const x of [-6.7, -4.3, 4.3, 6.7]) {
      window(x, 0.45, z, 1.05, 1.65);
      window(x, 3.72, z, 1.05, 2.05);
    }
  for (const sign of [-1, 1]) {
    const z = sign === 1 ? 0.37 : -12.08,
      rad = 1.23,
      base = 3.32,
      spring = 5.25,
      n = detail === 1 ? 6 : detail === 2 ? 10 : 16;
    Q(
      'glass',
      [
        [-rad, base, z],
        [rad, base, z],
        [rad, spring, z],
        [-rad, spring, z],
      ],
      [0, 0, sign],
    );
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI,
        b = ((i + 1) / n) * Math.PI,
        p = [Math.cos(a) * rad, spring + Math.sin(a) * rad, z],
        q = [Math.cos(b) * rad, spring + Math.sin(b) * rad, z];
      Q('glass', [[0, spring, z], p, q], [0, 0, sign]);
      beam('trim', p, q, 0.12);
    }
    for (const x of [-rad, -0.4, 0.4, rad])
      B('trim', x, base, z + sign * 0.04, 0.08, spring - base, 0.08);
    for (const y of [base + 0.7, spring]) B('trim', 0, y, z + sign * 0.04, rad * 2, 0.08, 0.08);
  }
  for (const side of [-1, 1])
    for (const z of [-9.3, -6, -2.7]) {
      window(side * 9.04, 3.6, z, 1.22, 2.05, side, true);
      if (side > 0 || z > -6) window(side * 9.04, 0.48, z, 1.05, 1.65, side);
    }
  if (detail >= 2) {
    for (const x of [-8.5, 8.5, -2.7, 2.7])
      for (const z of [0.16, -11.9])
        for (let i = 0; i < 13; i++) B('trim', x, i * 0.51, z, 0.85, 0.065, 0.1);
    for (const z of [0.18, -11.9]) {
      B('trim', 0, 3.05, z, 18, 0.12, 0.15);
      for (const x of [-8.72, 8.72]) B('roof', x, -0.45, z, 0.085, 7.22, 0.085);
    }
    for (const x of [-6, -3, 3, 6]) B('wood', x, -0.35, 0.06, 0.6, 0.22, 0.08);
  }
}
