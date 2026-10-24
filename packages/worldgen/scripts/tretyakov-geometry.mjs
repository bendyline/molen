/** 'tretyakov_gallery': connected gallery ranges, Vasnetsov facade, recessed arch and roof lanterns. */
import './install-deterministic-math.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTretyakov(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]];
  const f = (role, ps, n) => face(role, ps.map(P), P(n));
  const B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  const vertical = (role, poly, front, back) =>
    prism(
      (role, ps, n) =>
        f(
          role,
          ps.map(([x, z, y]) => [x, Y + y, z]),
          [n[0], n[2], n[1]],
        ),
      role,
      { outline: poly, holes: [] },
      front,
      back,
    );
  for (const p of r.footing) prism(f, 'stone', p, r.foundationY, Y);
  for (const p of r.body)
    prism((role, ps, n) => f(n[1] > 0.5 ? 'flat' : role, ps, n), 'wall', p, Y, Y + 10.4);
  for (const p of r.lowerLobby) prism(f, 'stone', p, Y, Y + 3.8);
  for (const p of r.lobby) prism(f, 'stone', p, Y + 3.8, Y + 3.88);
  // True central arch through the mapped porch; door is recessed behind the soffit.
  const n = detail === 0 ? 4 : detail === 1 ? 6 : 12,
    arch = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    arch.push([-1.55 * Math.cos(a), 2.1 + 1.55 * Math.sin(a)]);
  }
  vertical('stone', [...arch, [1.55, 3.8], [-1.55, 3.8]], -0.025, 1.45);
  B('door', 0, 0, 1.43, 3.1, 3.7, 0.08);
  B('stone', 0, -0.3, -0.95, 3.2, 0.15, 0.6);
  B('stone', 0, -0.15, -0.4, 3.1, 0.15, 0.5);
  if (detail > 0) {
    B('frame', 0, 0.1, 1.37, 0.06, 3.45, 0.035);
    for (const x of [-0.77, 0.77]) {
      B('glass', x, 2.05, 1.365, 1.1, 1.05, 0.025);
      for (const y of [0.25, 1.05]) B('dark', x, y, 1.36, 1.12, 0.62, 0.035);
    }
    B('stone', 0, 0, 0.72, 3.1, 0.06, 1.45);
  }
  // Three closed curved gables, roof strips and continuous cream/gold edging.
  for (const [cx, w, peak] of [
    [0, 7.2, 7.1],
    [-5.2, 3.6, 5.7],
    [5.2, 3.6, 5.7],
  ]) {
    const steps = detail === 0 ? 2 : detail === 1 ? 3 : 6,
      top = [];
    for (let i = 0; i <= steps * 2; i++) {
      const u = -1 + i / steps;
      top.push([cx + (u * w) / 2, 4.0 + (peak - 4.0) * Math.pow(1 - Math.abs(u), 1.45)]);
    }
    vertical('stone', [[cx - w / 2, 3.8], ...top, [cx + w / 2, 3.8]], -0.06, 3.52);
    for (let i = 0; i < top.length - 1; i++) {
      const a = top[i],
        b = top[i + 1];
      f(
        'roof',
        [
          [a[0], Y + a[1], -0.08],
          [b[0], Y + b[1], -0.08],
          [b[0], Y + b[1], 3.56],
          [a[0], Y + a[1], 3.56],
        ],
        [0, 1, 0],
      );
      vertical('wall', [a, b, [b[0], b[1] - 0.24], [a[0], a[1] - 0.24]], -0.14, -0.055);
      if (detail > 0)
        vertical('gold', [a, b, [b[0], b[1] + 0.07], [a[0], a[1] + 0.07]], -0.165, -0.12);
    }
    if (cx !== 0) {
      B('door', cx, 0.03, -0.105, 1.7, 2.85, 0.09);
      if (detail > 0)
        for (const x of [-0.53, 0, 0.53]) B('glass', cx + x, 2.0, -0.16, 0.36, 0.63, 0.025);
    }
  }
  // Historic front plane: inscription fields are intentionally blank, no copied text.
  B('wall', 0, 3.88, 3.38, 24, 7.24, 0.26);
  for (const x of [-7.25, 7.25]) {
    B('stone', x, 7.95, 3.205, 9.0, 2.05, 0.12);
    if (detail > 0) {
      B('stone', x, 7.73, 3.12, 9.25, 0.13, 0.15);
      B('stone', x, 10.02, 3.12, 9.25, 0.13, 0.15);
    }
  }
  B('frieze', 0, 10.25, 3.17, 24.3, 0.65, 0.18);
  B('roof', 0, 10.97, 3.35, 24.6, 0.17, 0.75);
  B('stone', 0, 7.3, 3.18, 24.2, 0.25, 0.17);
  // Raised gray keeled feature, two tiers of three arched lights and abstract relief.
  const keel = [
    [-2.6, 5.4],
    [-2.6, 11.9],
    [-2.5, 13.2],
    [-1.9, 14.5],
    [-0.8, 15.8],
    [0, 16.6],
    [0.8, 15.8],
    [1.9, 14.5],
    [2.5, 13.2],
    [2.6, 11.9],
    [2.6, 5.4],
  ];
  vertical('relief', keel, 2.89, 3.37);
  const light = (x, y, w, h, z, trim = true) => {
    const m = detail === 0 ? 4 : 8,
      rad = w / 2,
      spring = y + h - rad,
      poly = [[x - rad, y]];
    for (let i = 0; i <= m; i++) {
      const a = (i * Math.PI) / m;
      poly.push([x - rad * Math.cos(a), spring + rad * Math.sin(a)]);
    }
    poly.push([x + rad, y]);
    vertical('glass', poly, z, z + 0.035);
    if (detail && trim) {
      for (const sign of [-1, 1])
        B('stone', x + sign * (rad + 0.055), y, z - 0.015, 0.105, h - rad, 0.11);
      for (let i = 0; i < m; i++) {
        const a = (i * Math.PI) / m,
          b = ((i + 1) * Math.PI) / m;
        vertical(
          'stone',
          [
            [x - rad * Math.cos(a), spring + rad * Math.sin(a)],
            [x - rad * Math.cos(b), spring + rad * Math.sin(b)],
            [x - (rad + 0.11) * Math.cos(b), spring + (rad + 0.11) * Math.sin(b)],
            [x - (rad + 0.11) * Math.cos(a), spring + (rad + 0.11) * Math.sin(a)],
          ],
          z - 0.065,
          z + 0.045,
        );
      }
      B('frame', x, y, z - 0.03, 0.045, h - 0.07, 0.035);
    }
  };
  for (const y of [5.65, 8.08]) for (const x of [-1.65, 0, 1.65]) light(x, y, 1.15, 1.95, 2.85);
  if (detail > 0) {
    for (let i = 1; i < keel.length - 2; i++) {
      const a = keel[i],
        b = keel[i + 1];
      vertical(
        'gold',
        [a, b, [b[0] * 1.045, b[1] + 0.07], [a[0] * 1.045, a[1] + 0.07]],
        2.82,
        2.91,
      );
    }
    vertical(
      'relief',
      [
        [-1.7, 11.3],
        [-1.15, 12.7],
        [0, 13.5],
        [1.4, 12.8],
        [1.8, 11.4],
        [0.4, 11.6],
        [-0.2, 12.3],
        [-0.7, 11.4],
      ],
      2.75,
      2.9,
    );
    vertical(
      'stone',
      [
        [-0.55, 14.2],
        [0, 14.7],
        [0.55, 14.2],
        [0, 13.7],
      ],
      2.75,
      2.86,
    );
    for (const x of [-11.8, 11.8])
      for (let y = 0.3; y < 10.3; y += 0.65) B('stone', x, y, 3.16, 0.38, 0.34, 0.3);
    for (const x of [-9.4, 9.4]) {
      light(x, 0.7, 1.5, 2.8, 3.12);
      vertical(
        'stone',
        [
          [x - 1, 3.65],
          [x - 0.6, 4.1],
          [x, 4.55],
          [x + 0.6, 4.1],
          [x + 1, 3.65],
        ],
        3.0,
        3.16,
      );
    }
    // Tile-band color rhythm stays broad and merged; no per-building texture atlas.
    if (detail > 1)
      for (let x = -11.6; x < 11.7; x += 0.8) {
        vertical(
          'stone',
          [
            [x, 10.48],
            [x + 0.18, 10.66],
            [x + 0.36, 10.48],
            [x + 0.18, 10.3],
          ],
          3.055,
          3.12,
        );
        B('frieze', x, 7.36, 3.055, 0.2, 0.1, 0.1);
      }
  }
  // Eight photo-led roof lanterns inside the two mapped masses; a closed roof remains below.
  const lanterns = [
    [-6, 10.6, 5.1, 11],
    [6, 10.6, 5.1, 11],
    [-22, 41, 10.2, 35],
    [-7, 41, 10.2, 35],
    [8, 41, 10.2, 35],
    [-69, 33, 10.2, 48],
    [-53, 33, 10.2, 48],
    [-37, 33, 10.2, 48],
  ];
  for (const [x, z, w, d] of lanterns) {
    const base = 10.47,
      ridge = 14.4;
    vertical(
      'glazed',
      [
        [x - w / 2, base],
        [x, ridge],
        [x + w / 2, base],
      ],
      z - d / 2,
      z + d / 2,
    );
    if (detail > 0) {
      B('frame', x, ridge, z, w < 6 ? 0.12 : 0.16, 0.11, d + 0.14);
      for (const sign of [-1, 1]) B('frame', x + (sign * w) / 2, base, z, 0.13, 0.13, d + 0.1);
      const sections = detail === 1 ? 2 : Math.ceil(d / 4);
      for (let j = 0; j <= sections; j++) {
        const pz = z - d / 2 + (j * d) / sections;
        for (const sign of [-1, 1])
          f(
            'frame',
            [
              [x, Y + ridge + 0.035, pz - 0.055],
              [x + (sign * w) / 2, Y + base + 0.035, pz - 0.055],
              [x + (sign * w) / 2, Y + base + 0.035, pz + 0.055],
              [x, Y + ridge + 0.035, pz + 0.055],
            ],
            [0, 1, 0],
          );
      }
    }
  }
  if (detail > 0) {
    // Secondary elevations follow the actual edge normals and stay seated on the polygon.
    for (const poly of r.body) {
      const ring = poly.outline,
        sgn = Math.sign(
          ring.reduce((n, p, i) => {
            const q = ring[(i + 1) % ring.length];
            return n + p[0] * q[1] - p[1] * q[0];
          }, 0),
        );
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 4) continue;
        if (Math.abs((a[0] + b[0]) / 2) < 13 && (a[1] + b[1]) / 2 < 5) continue;
        const t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
          n = [t[1] * sgn, -t[0] * sgn],
          count = Math.max(1, Math.floor(len / (detail === 1 ? 15 : 5.4)));
        const quad = (role, x, z, y, w, h, offset) =>
          f(
            role,
            [
              [-w / 2, 0],
              [w / 2, 0],
              [w / 2, h],
              [-w / 2, h],
            ].map(([u, v]) => [
              x + t[0] * u + n[0] * offset,
              Y + y + v,
              z + t[1] * u + n[1] * offset,
            ]),
            [n[0], 0, n[1]],
          );
        for (let j = 0; j < count; j++) {
          const q = (j + 0.5) / count,
            x = a[0] + (b[0] - a[0]) * q,
            z = a[1] + (b[1] - a[1]) * q;
          if (Math.abs(x) < 13 && z < 5) continue;
          for (const y of [1.2, 6.1]) {
            quad('glass', x, z, y, 1.45, 2.25, 0.04);
            if (detail > 1) {
              quad('stone', x, z, y - 0.13, 1.75, 0.13, 0.08);
              quad('stone', x, z, y + 2.25, 1.75, 0.13, 0.08);
              for (const sign of [-1, 1])
                quad('stone', x + t[0] * sign * 0.8, z + t[1] * sign * 0.8, y, 0.13, 2.25, 0.08);
            }
          }
        }
        quad('stone', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 9.85, len, 0.3, 0.025);
        quad('stone', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 7.0, len, 1.3, 0.015);
      }
    }
  }
}
