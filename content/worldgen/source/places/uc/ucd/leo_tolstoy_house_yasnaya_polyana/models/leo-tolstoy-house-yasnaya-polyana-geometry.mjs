/** Tolstoy House: mapped envelope and picture-led front/rear architectural projections. */
import {
  box,
  prism,
} from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildTolstoy(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n));
  const B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d),
    Q = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x, Y + y, z]),
        n,
      );
  const hip = (x0, x1, z0, z1, y, rise, inset, role = 'roof') => {
    const mid = (z0 + z1) / 2,
      a = [x0 + inset, y + rise, mid],
      b = [x1 - inset, y + rise, mid],
      q = [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ];
    Q(role, [q[0], q[1], b, a], [0, 1, -1]);
    Q(role, [q[1], q[2], b], [1, 1, 0]);
    Q(role, [q[2], q[3], a, b], [0, 1, 1]);
    Q(role, [q[3], q[0], a], [-1, 1, 0]);
    Q(role, q, [0, -1, 0]);
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
      const j = (i + 1) % 4,
        normal = front[i].map((x, k) => (x + front[j][k]) / 2 - a[k]);
      Q(role, [front[i], front[j], back[j], back[i]], normal);
    }
  };
  for (const p of r.main) {
    prism(f, 'base', p, r.foundationY, Y);
    // A real front and rear doorway: remove the surface, return jambs/soffit, place door behind.
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
        n = [dz, 0, -dx],
        point = (x, y) => [x, y, a[1] + ((x - a[0]) / dx) * dz],
        front = Math.abs(a[1]) < 0.1 && Math.abs(b[1]) < 0.1,
        rear = a[1] < -12 && b[1] < -12;
      if (front || rear) {
        const lo = Math.min(a[0], b[0]),
          hi = Math.max(a[0], b[0]),
          cx = front ? 10.65 : 12.1,
          w = 1.35,
          h = 2.25;
        for (const [x0, x1, y0, y1] of [
          [lo, cx - w / 2, 0, r.eave],
          [cx + w / 2, hi, 0, r.eave],
          [cx - w / 2, cx + w / 2, h, r.eave],
        ])
          Q(
            'wall',
            [point(x0, y0), point(x1, y0), point(x1, y1), point(x0, y1)],
            front ? [0, 0, 1] : [0, 0, -1],
          );
        const sign = front ? 1 : -1,
          z = point(cx, 0)[2],
          deep = z - sign * 0.38;
        for (const s of [-1, 1])
          Q(
            'wall',
            [
              [cx + (s * w) / 2, 0, z],
              [cx + (s * w) / 2, h, z],
              [cx + (s * w) / 2, h, deep],
              [cx + (s * w) / 2, 0, deep],
            ],
            [-s, 0, 0],
          );
        Q(
          'trim',
          [
            [cx - w / 2, h, z],
            [cx + w / 2, h, z],
            [cx + w / 2, h, deep],
            [cx - w / 2, h, deep],
          ],
          [0, -1, 0],
        );
        B('wood', cx, 0, deep, w - 0.06, h - 0.05, 0.08);
        B('base', cx, -0.06, z - sign * 0.19, w, 0.06, 0.42);
        if (detail >= 2) {
          B('trim', cx, 0, deep + sign * 0.055, 0.055, h - 0.1, 0.05);
          B('trim', cx, 1.42, deep + sign * 0.055, w - 0.12, 0.06, 0.05);
        }
      } else
        Q(
          'wall',
          [
            [a[0], 0, a[1]],
            [b[0], 0, b[1]],
            [b[0], r.eave, b[1]],
            [a[0], r.eave, a[1]],
          ],
          n,
        );
    }
  }
  hip(-17.05, 17.05, -12.7, 0.46, r.eave + 0.12, r.roofRise, 6.2);
  B('trim', 0, r.eave - 0.18, -6.12, 33.8, 0.3, 12.9);
  // Central front pediment interrupts the green hip roof above the balcony.
  Q(
    'wall',
    [
      [-8.3, r.eave + 0.13, 0.25],
      [-4.5, r.eave + 1.48, 0.25],
      [-0.7, r.eave + 0.13, 0.25],
    ],
    [0, 0, 1],
  );
  for (const sign of [-1, 1]) {
    Q(
      'roof',
      [
        [-4.5, r.eave + 1.58, 0.4],
        [-4.5, r.eave + 1.58, -3.9],
        [-4.5 + sign * 4, r.eave + 0.12, -3.9],
        [-4.5 + sign * 4, r.eave + 0.12, 0.4],
      ],
      [sign, 1, 0],
    );
    beam('trim', [-4.5, r.eave + 1.5, 0.49], [-4.5 + sign * 3.9, r.eave + 0.12, 0.49], 0.14);
  }
  // Six chunky pale chimney stacks and green caps remain in every LOD.
  for (const [x, z] of [
    [-13, -7.5],
    [-7, -7.4],
    [-2, -7.1],
    [3.5, -7.1],
    [9, -7.1],
    [14, -4.5],
  ]) {
    const base = r.eave + 1.5;
    B('wall', x, base, z, 0.6, 1.55, 0.65);
    B('trim', x, base + 1.25, z, 0.73, 0.14, 0.78);
    hip(x - 0.4, x + 0.4, z - 0.43, z + 0.43, base + 1.48, 0.22, 0.4);
  }
  // Supported projecting balcony, open rails and a plain cloth canopy; no photographs or art.
  B('trim', -4.3, 3.04, 1.2, 12, 0.22, 2.5);
  const posts = detail ? [-10.2, -8, -5.7, -3.4, -1.1, 1.6] : [-10.2, -4.3, 1.6];
  for (const x of posts) {
    B('trim', x, 3.25, 2.38, 0.13, 1.05, 0.13);
    beam('trim', [x, 2.2, 0.05], [x, 3.04, 1.95], detail ? 0.13 : 0.2);
  }
  B('trim', -4.3, 4.27, 2.38, 12, 0.13, 0.16);
  B('trim', -4.3, 3.38, 2.38, 12, 0.13, 0.14);
  for (const x of [-10.2, 1.6]) {
    B('trim', x, 4.27, 1.16, 0.14, 0.13, 2.45);
    B('trim', x, 3.38, 1.16, 0.12, 0.13, 2.45);
  }
  if (detail >= 2)
    for (let x = -10; x < 1.5; x += 0.27) {
      B('trim', x, 3.5, 2.38, 0.07, 0.7, 0.07);
      if (detail === 3) {
        beam('trim', [x - 0.08, 3.58, 2.4], [x + 0.08, 3.98, 2.4], 0.045);
      }
    }
  for (const side of [-1, 1]) {
    Q(
      'canvas',
      [
        [-7, 6.55, 0.3],
        [-2, 6.55, 0.3],
        [-2, 4.95, 1.24],
        [-7, 4.95, 1.24],
      ],
      [0, side, side],
    );
    Q(
      'canvas',
      [
        [-7, 4.95, 1.24],
        [-2, 4.95, 1.24],
        [-2, 4.78, 1.24],
        [-7, 4.78, 1.24],
      ],
      [0, 0, side],
    );
  }
  // A low rear polygonal room and its actual projecting green roof.
  prism(f, 'base', r.bay, r.foundationY, Y + 0.12);
  prism(f, 'wall', r.bay, Y, Y + 2.5);
  const center = [-3, -13.5],
    peak = 3.35;
  for (let i = 0; i < r.bay.outline.length; i++) {
    const a = r.bay.outline[i],
      b = r.bay.outline[(i + 1) % r.bay.outline.length];
    Q(
      'roof',
      [
        [a[0], 2.5, a[1]],
        [b[0], 2.5, b[1]],
        [center[0], peak, center[1]],
      ],
      [0, 1, 0],
    );
  }
  // Rear open porch: underside and posts rest on closed footings, no card across the opening.
  prism(f, 'base', r.porch, r.foundationY, Y - 0.18);
  prism(f, 'wood', r.porch, Y - 0.18, Y);
  hip(4.5, 16.85, -15.65, -11.8, 2.9, 0.35, 1.3);
  const px = detail ? [5, 7.5, 10, 12.5, 16.4] : [5, 10, 16.4];
  for (const x of px) {
    B('wood', x, 0, -15.15, 0.14, 2.92, 0.14);
    B('trim', x, 2.55, -15.15, 0.25, 0.35, 0.25);
  }
  for (const [x0, x1] of [
    [5, 8],
    [10.5, 16.4],
  ]) {
    const cx = (x0 + x1) / 2;
    B('wood', cx, 1, -15.15, x1 - x0, 0.12, 0.14);
    B('wood', cx, 0.15, -15.15, x1 - x0, 0.12, 0.12);
    if (detail >= 2)
      for (let x = x0 + 0.2; x < x1; x += 0.32) {
        beam('trim', [x - 0.13, 0.26, -15.16], [x + 0.13, 0.91, -15.16], 0.055);
        beam('trim', [x + 0.13, 0.26, -15.16], [x - 0.13, 0.91, -15.16], 0.055);
      }
  }
  for (const step of r.steps)
    prism(f, 'base', { outline: step.outline, holes: [] }, step.base, step.top);
  if (!detail) return;
  // Quiet window modules: shared glass, physical white frames and nearby mullions.
  const window = (x, y, z, w, h, side = 0) => {
    const S = ([u, v, d]) => (side ? [x + side * d, y + v, z + u] : [x + u, y + v, z + d]),
      n = side ? [side, 0, 0] : [0, 0, z < -6 ? -1 : 1],
      sign = side || n[2],
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
    panel('glass', -w / 2, 0, w / 2, h, sign * 0.035);
    for (const [a, b, c, d] of [
      [-w / 2 - 0.08, -0.08, -w / 2, h + 0.08],
      [w / 2, -0.08, w / 2 + 0.08, h + 0.08],
      [-w / 2, h, w / 2, h + 0.1],
      [-w / 2, -0.12, w / 2, 0.01],
    ])
      panel('trim', a, b, c, d, sign * 0.075);
    if (detail >= 2) {
      panel('trim', -0.035, 0, 0.035, h, sign * 0.09);
      panel('trim', -w / 2, h * 0.68, w / 2, h * 0.68 + 0.055, sign * 0.09);
      if (detail === 3) panel('trim', -w / 2, h * 0.34, w / 2, h * 0.34 + 0.045, sign * 0.09);
    }
  };
  const xs = [-14, -11.1, -8.2, -5.3, -2.4, 0.5, 3.4, 6.3, 10.65, 14];
  for (const x of xs) {
    if (Math.abs(x - 10.65) > 0.1) window(x, 0.42, 0.055, 1.1, 1.6);
    if (x < -7.1 || x > -1.2) window(x, 3.72, 0.055, 1.07, 2.12);
  }
  // Upper balcony doorway is glass with physical framing; its canopy remains independent.
  window(-4.4, 3.42, 0.065, 2.1, 2.55);
  for (const x of [-14, -10, -7, 1.4, 4.3, 7.2, 10.1, 14.6]) {
    if (Math.abs(x - 12.1) > 1) window(x, 0.4, -12.3, 1.05, 1.6);
    window(x, 3.72, -12.3, 1.07, 2.12);
  }
  // Tall round-headed rear window: a true arch silhouette of shared glass, not a painted atlas.
  const cx = -3,
    base = 3.55,
    spring = 5.38,
    rad = 1.1,
    z = -12.31,
    n = detail === 1 ? 6 : detail === 2 ? 10 : 16;
  Q(
    'glass',
    [
      [cx - rad, base, z],
      [cx + rad, base, z],
      [cx + rad, spring, z],
      [cx - rad, spring, z],
    ],
    [0, 0, -1],
  );
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      p = [cx + Math.cos(a) * rad, spring + Math.sin(a) * rad, z],
      q = [cx + Math.cos(b) * rad, spring + Math.sin(b) * rad, z];
    Q('glass', [[cx, spring, z], p, q], [0, 0, -1]);
    beam('trim', p, q, 0.1);
  }
  for (const dx of [-rad, 0, rad]) B('trim', cx + dx, base, -12.36, 0.09, spring - base, 0.08);
  B('trim', cx, spring, -12.36, rad * 2, 0.08, 0.08);
  B('trim', cx, base + 0.75, -12.36, rad * 2, 0.07, 0.08);
  for (const x of [-4.8, -1.2]) window(x, 0.45, -15.16, 0.8, 1.3);
  for (const sign of [-1, 1])
    for (const z of [-9.5, -5.9, -2.4]) {
      window(sign * 16.62, 0.45, z, 1.1, 1.6, sign);
      window(sign * 16.62, 3.72, z, 1.1, 2.12, sign);
    }
  // Basement vents, corner bands, downpipes and roof details appear only nearby.
  if (detail >= 2) {
    for (const x of [-15.9, 15.9])
      for (const z of [0.12, -12.34])
        for (let i = 0; i < 13; i++) B('trim', x, i * 0.5, z, 1.1, 0.06, 0.09);
    for (const x of [-15, -8, 0, 7, 14]) {
      B('wood', x, -0.34, 0.05, 0.62, 0.23, 0.06);
      if (detail === 3)
        for (const dx of [-0.2, 0, 0.2]) B('trim', x + dx, -0.34, 0.09, 0.035, 0.23, 0.035);
    }
    B('trim', 0, 3.05, 0.1, 33.1, 0.11, 0.12);
    for (const x of [-16.2, 4, 16.2]) {
      B('roof', x, -0.45, 0.22, 0.09, 7.25, 0.09);
      beam('roof', [x, -0.45, 0.22], [x + 0.25, -0.5, 0.55], 0.09);
    }
    for (const x of [-7.7, -6.1, -2.9, -1.3]) B('trim', x, r.eave - 0.22, 0.45, 0.18, 0.16, 0.4);
  }
}
