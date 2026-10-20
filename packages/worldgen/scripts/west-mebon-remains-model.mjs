/** 'N0549': pictured West Mebon east gateways, open wall and mapped pool causeway. */
import { box, loft } from './khmer-structure-geometry.mjs';

function pose(f, x, y, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([u, v, w]) => [x + c * u - s * w, y + v, z + s * u + c * w]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function facade(f, d, blind) {
  const width = 5.2,
    door = 1.65,
    h = 3.8,
    pier = (width - door) / 2;
  for (const sign of [-1, 1]) box(f, 'stone', (sign * (door + pier)) / 2, 0, 0, pier, h, 0.7);
  box(f, 'carved', 0, 2.65, 0, door, h - 2.65, 0.7);
  if (blind) box(f, 'stone', 0, 0, -0.27, door, 2.65, 0.16);
  if (d === 0) return;
  for (const sign of [-1, 1]) {
    box(f, 'carved', sign * (door / 2 + 0.12), 0, 0.43, 0.2, 2.85, 0.23);
    const shaft = pose(f, sign * 1.22, 0, 0.49);
    loft(
      shaft,
      'carved',
      0,
      0,
      d === 1
        ? [
            [0, 0.5],
            [0.3, 0.33],
            [2.4, 0.33],
            [2.7, 0.48],
          ]
        : [
            [0, 0.45],
            [0.16, 0.53],
            [0.3, 0.4],
            [0.48, 0.33],
            [2.35, 0.33],
            [2.5, 0.45],
            [2.7, 0.48],
          ],
      d >= 2,
    );
    box(f, 'carved', sign * 2.35, 0, 0.35, 0.28, 3.6, 0.19);
    if (d >= 2)
      for (const y of [0.38, 0.55, 2.28, 2.43, 2.58])
        box(shaft, 'carved', 0, y, 0.08, 0.49, 0.075, 0.39);
  }
  box(f, 'carved', 0, 2.8, 0.44, 3, 0.4, 0.36);
  box(f, 'carved', 0, 3.35, 0.4, 4.8, 0.18, 0.28);
  if (d >= 2) {
    for (let j = -3; j <= 3; j++) {
      const x = j * 0.38;
      // Original abstract leaf/scroll volumes, without copying a narrative relief.
      loft(
        f,
        'carved',
        x,
        0.67,
        [
          [2.86, 0.16],
          [3.0, 0.29],
          [3.13, 0.12],
        ],
        true,
      );
    }
  }
}
function crown(f, d, top, broken) {
  const profile =
    d === 0
      ? [
          [3.8, 5.6],
          [4.4, 4.8],
          [top - 0.2, 1.45],
          [top, 0.9],
        ]
      : [
          [3.8, 5.6],
          [4.02, 5.85],
          [4.25, 5.3],
          [4.48, 4.55],
          [4.85, 4.9],
          [5.15, 4.35],
          [5.4, 3.75],
          ...(broken
            ? [
                [5.56, 3.7],
                [top, 2.9],
              ]
            : [
                [5.75, 4.0],
                [6.15, 3.5],
                [6.35, 2.9],
                [6.65, 3.2],
                [7.03, 2.6],
                [7.25, 2.15],
                [top - 0.25, 1.8],
                [top, 1.25],
              ]),
        ];
  const scale = (top - 3.8) / (broken ? 2 : 4.3);
  const rings = profile.map(([y, w]) => [d === 0 ? y : 3.8 + (y - 3.8) * scale, w]);
  const n = d === 0 ? 4 : d <= 2 ? 8 : 16;
  const footprint = (w) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + 0.5) * Math.PI * 2) / n,
        r = w * 0.5 * (1 + (d >= 2 ? 0.07 * Math.cos(4 * a) : 0));
      return [Math.cos(a) * r, Math.sin(a) * r];
    });
  loft(f, 'stone', 0, 0, rings, false, footprint);
  if (d >= 2)
    for (const [k, y] of [4.28, 5.12, ...(broken ? [] : [6.12, 7.0])].entries()) {
      const width = [5.0, 4.05, 3.15, 2.35][k],
        height = 3.8 + (y - 3.8) * scale;
      for (let j = 0; j < 8; j++) {
        const a = (j * Math.PI) / 4,
          part = pose(
            f,
            Math.cos(a) * width * 0.46,
            height,
            Math.sin(a) * width * 0.46,
            -a + Math.PI / 2,
          );
        loft(
          part,
          'carved',
          0,
          0,
          [
            [0, 0.42],
            [0.18, 0.62],
            [0.38, 0.39],
            [0.52, 0.12],
          ],
          true,
        );
      }
    }
}
function gate(f, p, d, F, sample) {
  const [x, z] = p.center,
    lower = Math.min(...[-3, 3].flatMap((u) => [-3, 3].map((v) => sample(x + u, z + v)))) - 0.45;
  const g = pose(f, x, F, z);
  box(g, 'base', 0, lower - F, 0, 6.2, F - lower, 6.2);
  if (d >= 1)
    for (const [y, w] of [
      [-0.3, 6.1],
      [-0.14, 5.8],
    ])
      box(g, 'carved', 0, y, 0, w, 0.14, w);
  for (const side of [-1, 1]) facade(pose(g, side * 2.25, 0, 0, (side * Math.PI) / 2), d, false);
  for (const side of [-1, 1]) facade(pose(g, 0, 0, side * 2.25, side === 1 ? 0 : Math.PI), d, true);
  crown(g, d, p.top, p.broken);
  const steps = d === 0 ? 1 : 4;
  for (const side of [-1, 1])
    for (let i = 0; i < steps; i++) {
      const x = side * (3.2 + ((i + 0.5) * 1.2) / steps),
        bottom = Math.min(sample(p.center[0] + x, z) - F - 0.2, -0.05),
        top = -0.03 - i * 0.13;
      box(g, 'base', x, bottom, 0, 1.2 / steps, Math.max(0.1, top - bottom), 2.2);
    }
}
function wall(f, r, d, sample) {
  const x = r.wallX,
    F = r.floorY;
  for (let half = 0; half < 2; half++) {
    const lo = r.towers[half].center[1] + 3.15,
      hi = r.towers[half + 1].center[1] - 3.15,
      length = hi - lo,
      count = d === 0 ? 4 : 8,
      pitch = length / count,
      width = d === 0 ? 1.35 : 0.95,
      base = Math.min(...[lo, (lo + hi) / 2, hi].map((z) => sample(x, z))) - 0.4;
    box(f, 'base', x, base, (lo + hi) / 2, 1.4, F + 0.45 - base, length);
    box(f, 'stone', x, F + 0.45, (lo + hi) / 2, 1.1, 0.32, length);
    box(f, 'stone', x, F + 2.22, (lo + hi) / 2, 1.1, 0.58, length);
    box(f, 'carved', x, F + 2.8, (lo + hi) / 2, 1.42, 0.25, length + 0.1);
    for (let i = 0; i <= count; i++) {
      const a = i === 0 ? lo : lo + (i - 0.5) * pitch + width / 2,
        b = i === count ? hi : lo + (i + 0.5) * pitch - width / 2;
      box(f, 'stone', x, F + 0.77, (a + b) / 2, 1.1, 1.45, b - a);
    }
    if (d >= 2) {
      for (let i = 0; i < count; i++) {
        const z = lo + (i + 0.5) * pitch;
        for (const side of [-1, 1]) {
          box(f, 'carved', x + side * 0.59, F + 0.68, z, 0.13, 0.15, width + 0.3);
          box(f, 'carved', x + side * 0.59, F + 2.18, z, 0.13, 0.15, width + 0.3);
        }
      }
      for (let i = 0; i < count * 2; i++)
        box(
          f,
          'carved',
          x,
          F + 3.05,
          lo + ((i + 0.5) * length) / (count * 2),
          1.15,
          0.12,
          length / (count * 2) - 0.04,
        );
    }
  }
}
export function buildWestMebonRemains(f, d, r, sample) {
  for (const p of r.towers) gate(f, p, d, r.floorY, sample);
  wall(f, r, d, sample);
  const [a, b] = r.axis,
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    angle = -Math.atan2(dz, dx),
    causeway = pose(f, (a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2, -angle),
    bottom = Math.min(...r.axis.map((p) => sample(...p))) - 1;
  box(causeway, 'base', 0, bottom, 0, length, r.floorY - 0.18 - bottom, 2.5);
  box(causeway, 'carved', 0, r.floorY - 0.18, 0, length, 0.18, 3);
  if (d >= 1)
    for (const side of [-1, 1])
      box(causeway, 'carved', 0, r.floorY, side * 1.35, length, 0.15, 0.25);
  if (d >= 2)
    for (let i = 0; i < Math.ceil(length / 1.8); i++)
      box(
        causeway,
        'carved',
        -length / 2 + ((i + 0.5) * length) / Math.ceil(length / 1.8),
        r.floorY - 0.03,
        0,
        length / Math.ceil(length / 1.8) - 0.025,
        0.04,
        2.4,
      );
  const p = r.platform;
  box(f, 'base', ...[p.center[0], bottom, p.center[1]], p.width, r.floorY - 0.2 - bottom, p.depth);
  box(f, 'carved', p.center[0], r.floorY - 0.2, p.center[1], p.width + 0.3, 0.2, p.depth + 0.3);
  if (d >= 1)
    for (const [x, z, w, dep] of [
      [0, 5.4, 10.8, 0.45],
      [0, -5.4, 10.8, 0.45],
      [-5.4, 0, 0.45, 10.8],
    ])
      box(f, 'carved', p.center[0] + x, r.floorY, p.center[1] + z, w, 0.22, dep);
  // Surviving low bank fragments only, leaving the open pool and its banks native.
  for (const [x, z, w, dep] of [
    [-32, 1, 9, 1.2],
    [-20, 100, 15, 1.3],
    [-37, 65, 1.2, 9],
    [-37, 29, 1.4, 13],
    [23, 100, 13, 1.1],
  ].slice(0, d === 0 ? 3 : 5)) {
    const y = sample(x, z) - 0.35;
    box(f, 'base', x, y, z, w, 0.8, dep);
    if (d >= 2) box(f, 'carved', x + 0.13, y + 0.8, z, w * 0.88, 0.17, dep * 0.85);
  }
}
