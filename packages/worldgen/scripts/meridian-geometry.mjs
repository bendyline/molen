/** 'meridian_building_royal_observatory_greenwich': connected transit rooms, shutters, gables and true three-arched entry. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildMeridian(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    B = (role, x, y, z, w, h, d) => box(f, role, x, Y + y, z, w, h, d);
  for (const p of r.floors) prism(f, 'plinth', p, r.foundationY, Y);
  for (const band of r.body) {
    for (const p of band.lower) prism(f, 'wall', p, Y, Y + 2.9);
    for (const p of band.polygons) prism(f, 'wall', p, Y + 2.9, Y + band.height);
  }
  // Extrude a two-dimensional facade polygon in Z, including concave arch spandrels.
  function vertical(role, outline, z0, z1) {
    prism(
      (material, ps, n) =>
        f(
          material,
          ps.map(([x, z, y]) => [x, Y + y, z]),
          [n[0], n[2], n[1]],
        ),
      role,
      { outline, holes: [] },
      z0,
      z1,
    );
  }
  const steps = detail === 0 ? 4 : detail === 1 ? 6 : detail === 2 ? 10 : 16;
  function archRing(x, spring, inner, outer, z0, z1, role = 'arch') {
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI,
        b = ((i + 1) / steps) * Math.PI;
      vertical(
        role,
        [
          [x + Math.cos(a) * inner, spring + Math.sin(a) * inner],
          [x + Math.cos(a) * outer, spring + Math.sin(a) * outer],
          [x + Math.cos(b) * outer, spring + Math.sin(b) * outer],
          [x + Math.cos(b) * inner, spring + Math.sin(b) * inner],
        ],
        z0,
        z1,
      );
    }
  }
  for (const x of r.portals) {
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const a = (i / steps) * Math.PI;
      return [x + Math.cos(a) * 0.9, 1.85 + Math.sin(a) * 0.9];
    });
    vertical('wall', [[x - 0.9, 2.9], [x + 0.9, 2.9], ...curve], r.north, r.north + 0.95);
    archRing(x, 1.85, 0.9, 1.12, r.north - 0.08, r.north + 0.08);
    B('dark', x, 0, r.north + 0.9, 1.8, 2.72, 0.06);
    for (const sx of [-1, 1]) B('stone', x + sx * 1.06, 1.73, r.north - 0.09, 0.36, 0.16, 0.23);
  }
  const rooms = [
    [-8.88, -3.3, -4, 3.5, 3.65, 5],
    [-3.3, 3.1, -4.33, 4.04, 5.6, 8],
    [3.1, 7.67, -3.78, 3.48, 3.65, 5],
    [7.67, 14.55, -4.33, 7.2, 3.65, 5],
    [14.55, 19.75, -1.18, 7.2, 5.6, 8],
    [19.75, 31.47, -1.18, 7.2, 6.2, 8],
  ];
  function roof(x0, x1, z0, z1, lo, hi) {
    const mid = (x0 + x1) / 2;
    f(
      'roof',
      [
        [x0, Y + lo, z0],
        [mid, Y + hi, z0],
        [mid, Y + hi, z1],
        [x0, Y + lo, z1],
      ],
      [-1, 1, 0],
    );
    f(
      'roof',
      [
        [mid, Y + hi, z0],
        [x1, Y + lo, z0],
        [x1, Y + lo, z1],
        [mid, Y + hi, z1],
      ],
      [1, 1, 0],
    );
    for (const [z, sign] of [
      [z0, -1],
      [z1, 1],
    ]) {
      f(
        'wall',
        [
          [x0, Y + lo, z],
          [x1, Y + lo, z],
          [mid, Y + hi, z],
        ],
        [0, 0, sign],
      );
      if (detail) {
        for (const [a, b] of [
          [
            [x0, Y + lo, z],
            [mid, Y + hi, z],
          ],
          [
            [mid, Y + hi, z],
            [x1, Y + lo, z],
          ],
        ]) {
          f(
            'stone',
            [
              a,
              b,
              b.map((v, k) => v + (k === 1 ? 0.16 : 0)),
              a.map((v, k) => v + (k === 1 ? 0.16 : 0)),
            ],
            [0, 0, sign],
          );
        }
        B('stone', mid, lo - 0.15, z, x1 - x0 + 0.12, 0.2, 0.2);
      }
    }
  }
  for (const a of rooms) roof(...a);
  // The small silver cap sits on a closed raised stock-brick base behind the eastern transit/galleries junction.
  B('wall', 20.8, 5.6, 3, 5.6, 1.8, 4.5);
  B('stone', 20.8, 7.23, 3, 5.8, 0.17, 4.7);
  const n = detail === 0 ? 8 : detail === 1 ? 12 : 24,
    profile = [
      [7.4, 2.55],
      [8.1, 2.4],
      [8.65, 1.8],
      [8.98, 0.7],
      [9.1, 0.08],
    ],
    rings = profile.map(([y, radius]) =>
      Array.from({ length: n }, (_, i) => [
        20.8 + Math.cos((i / n) * Math.PI * 2) * radius,
        Y + y,
        3 + Math.sin((i / n) * Math.PI * 2) * radius,
      ]),
    );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 0.5) / n) * Math.PI * 2;
      f(
        'lead',
        [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        [Math.cos(a), 0.5, Math.sin(a)],
      );
    }
  f('lead', rings.at(-1), [0, 1, 0]);
  // Black transit covers follow each north/south facade; they are static exterior covers.
  for (const [x, z0, z1, top] of [
    [-0.1, -4.36, 4.07, 7.5],
    [11.1, -4.36, 7.23, 4.65],
    [17.15, -1.21, 7.23, 7.5],
  ])
    for (const [z, sign] of [
      [z0, -1],
      [z1, 1],
    ]) {
      B('dark', x, 0.3, z, 0.82, top - 0.3, 0.09);
      for (const side of [-1, 1])
        B('stone', x + side * 0.54, 0.2, z + sign * 0.02, 0.14, top - 0.1, 0.16);
      if (detail >= 2)
        for (let y = 0.7; y < top; y += 0.65) B('frame', x, y, z + sign * 0.08, 0.7, 0.045, 0.045);
    }
  function window(x, y, z, w, h, sign, arched = false) {
    const bottom = y - h / 2,
      edge = z + sign * 0.06,
      front = z + sign * 0.1;
    if (arched) {
      const rad = w / 2,
        spring = bottom + h - rad,
        outline = [
          [x - rad, bottom],
          [x + rad, bottom],
          ...Array.from({ length: steps + 1 }, (_, i) => {
            const a = (i / steps) * Math.PI;
            return [x + Math.cos(a) * rad, spring + Math.sin(a) * rad];
          }),
        ];
      vertical('glass', outline, edge - 0.03, edge + 0.03);
      if (detail) archRing(x, spring, rad, rad + 0.2, front - 0.06, front + 0.06);
    } else B('glass', x, bottom, edge, w, h, 0.06);
    if (!detail) return;
    for (const side of [-1, 1])
      B('frame', x + side * (w / 2 + 0.06), bottom - 0.05, front, 0.1, h + 0.12, 0.12);
    B('stone', x, bottom - 0.12, front, w + 0.3, 0.13, 0.18);
    if (!arched) B('arch', x, bottom + h + 0.04, front, w + 0.3, 0.2, 0.14);
    if (detail >= 2) {
      B('frame', x, bottom, front + sign * 0.03, 0.07, h, 0.1);
      for (let j = 1; j <= (detail === 1 ? 1 : 3); j++)
        B(
          'frame',
          x,
          bottom + (h * j) / (detail === 1 ? 2 : 4),
          front + sign * 0.04,
          w,
          0.055,
          0.1,
        );
    }
  }
  if (detail) {
    for (const [x0, x1, z0, z1, lo] of rooms) {
      const mid = (x0 + x1) / 2;
      for (const [z, sign] of [
        [z0 - 0.035, -1],
        [z1 + 0.035, 1],
      ]) {
        B('stone', mid, 3.05, z, x1 - x0, 0.2, 0.16);
        if (lo > 5) {
          if (x0 > 19) {
            window(mid, 4.8, z, 1.5, 2.6, sign, true);
            for (const offset of [-3.55, 3.55]) window(mid + offset, 4.75, z, 1.0, 2.05, sign);
          } else for (const offset of [-1.6, 1.6]) window(mid + offset, 4.45, z, 0.85, 1.7, sign);
        }
        if (!(x0 > 19 && sign < 0))
          for (const offset of x1 - x0 > 8 ? [-3.55, 0, 3.55] : [-1.7, 1.7]) {
            const x = mid + offset;
            if (Math.abs(x - mid) < 0.8 && x0 < 19) continue;
            window(x, 1.65, z, 1.08, 2.1, sign);
          }
      }
    }
    if (detail >= 2)
      for (const x of [19.75, 31.47])
        for (const z of [-1.2, 7.22])
          for (let y = 0.3; y < 6.1; y += 0.65) B('stone', x, y, z, 0.32, 0.18, 0.24);
  }
}
