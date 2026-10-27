/** Distant Bell Rock: real taper/cornice/lantern, open cage, SSE solar bay and attached landing. */
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  ring,
  shell,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-expansion-models.mjs';
import {
  lathe,
  transformed,
} from '../../../../../../../../packages/worldgen/scripts/lighthouse-models.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const paint = [0.64, 0.64, 0.6],
  metal = [0.18, 0.18, 0.14],
  glass = [0.065, 0.1, 0.115];
const polar = (r, y, a) => [Math.sin(a) * r, y, Math.cos(a) * r];

export function bellRockSkyline(out) {
  lathe(
    out,
    'wall',
    [
      [0, 6.4008],
      [1.6, 6],
      [3, 5.4],
      [5, 4.76],
    ],
    [0.19, 0.2, 0.15],
    12,
  );
  lathe(
    out,
    'wall',
    [
      [5, 4.76],
      [7, 4.25],
    ],
    [0.34, 0.35, 0.29],
    12,
  );
  lathe(
    out,
    'wall',
    [
      [7, 4.25],
      [9.144, 3.78],
    ],
    [0.51, 0.51, 0.45],
    12,
  );
  lathe(
    out,
    'wall',
    [
      [9.144, 3.78],
      [12, 3.31],
      [16, 2.91],
      [21, 2.56],
      [26, 2.34],
      [30.55, 2.286],
    ],
    paint,
    12,
  );
  lathe(
    out,
    'wall',
    [
      [30.5, 2.286],
      [30.87, 2.46],
      [31.4, 3.12],
      [31.56, 3.12],
    ],
    paint,
    12,
  );
  lathe(
    out,
    'wall',
    [
      [31.53, 2.06],
      [32.32, 2.06],
    ],
    metal,
    12,
  );
  lathe(
    out,
    'wall',
    [
      [32.32, 2.05],
      [34.47, 2.05],
    ],
    glass,
    12,
  );
  lathe(
    out,
    'wall',
    [
      [34.45, 2.18],
      [34.77, 1.89],
      [35.28, 0.93],
      [35.49, 0.08],
    ],
    metal,
    12,
  );
  // Four broad cage ribs carry its separate silhouette; fine wire and glazing grids drop out.
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    beam(out, 'wall', polar(3.02, 31.57, a), polar(2.76, 34.35, a), 0.11, 0.11, metal);
    beam(out, 'wall', polar(2.76, 34.35, a), polar(0.18, 35.86, a), 0.11, 0.11, metal);
  }
  beam(out, 'wall', [0, 35.4, 0], [0, 36, 0], 0.12, 0.12, metal);
  const solar = transformed(out, Math.PI / 8);
  box(solar, 'wall', [-1.25, 31.35, 2.6], [1.25, 31.52, 4.15], metal);
  box(solar, 'wall', [-1.18, 31.6, 4.04], [1.18, 32.75, 4.12], glass);
  box(out, 'wall', [-1.53, 9.02, 3.5], [1.53, 9.16, 5.67], metal);
  // A solid far ladder carries the access route without sub-pixel rungs.
  beam(out, 'wall', [0, 0.8, 6.57], [0, 9.16, 5.75], 0.62, 0.09, metal);
}

const profile = [
  [0, 6.4008],
  [0.6, 6.34],
  [1.6, 6],
  [3, 5.4],
  [5, 4.76],
  [7, 4.25],
  [9.144, 3.78],
  [12, 3.31],
  [16, 2.91],
  [21, 2.56],
  [26, 2.34],
  [30.55, 2.286],
];
const pale = [0.85, 0.85, 0.79],
  bronze = [0.24, 0.22, 0.15],
  dark = [0.1, 0.12, 0.12];
function curvedProfile(step) {
  const slope = (i) => {
    const a = profile[Math.max(0, i - 1)],
      b = profile[Math.min(profile.length - 1, i + 1)];
    return (b[1] - a[1]) / (b[0] - a[0]);
  };
  const result = [profile[0]];
  for (let j = 1; j < profile.length; j++) {
    const [y0, r0] = profile[j - 1],
      [y1, r1] = profile[j],
      dy = y1 - y0,
      n = Math.ceil(dy / step);
    for (let i = 1; i <= n; i++) {
      const t = i / n,
        t2 = t * t,
        t3 = t2 * t;
      result.push([
        y0 + dy * t,
        (2 * t3 - 3 * t2 + 1) * r0 +
          (t3 - 2 * t2 + t) * dy * slope(j - 1) +
          (-2 * t3 + 3 * t2) * r1 +
          (t3 - t2) * dy * slope(j),
      ]);
    }
  }
  return result;
}
function buildNear(out, q) {
  const holes = [
    { angle: 0, y: 9.144, w: 0.96, h: 1.85, trimColor: pale },
    ...[13.15, 17.55, 22.1, 26.8, 29.4].map((y, i) => ({
      angle: i % 2 ? Math.PI : 0,
      y,
      w: 0.43,
      h: 0.64,
      trimColor: pale,
      grid: q.grid,
    })),
    { angle: Math.PI / 2, y: 27.4, w: 0.41, h: 0.61, trimColor: pale },
  ];
  shell(out, {
    profile: curvedProfile(q.step),
    holes,
    slot: 'plaster',
    segments: q.sides,
    color: (y, a) => {
      const t = Math.min(1, Math.max(0, (y - 1.8 + 0.3 * Math.sin(a * 3)) / 7.2)),
        s = t * t * (3 - 2 * t),
        lower = [0.26, 0.28, 0.21];
      return pale.map((v, i) => lower[i] + (v - lower[i]) * s);
    },
  });
  if (q.courses)
    for (let y = 0.45; y < 7.5; y += 0.48) {
      let j = 1;
      while (profile[j][0] < y) j++;
      const [a, r] = profile[j - 1],
        [b, s] = profile[j],
        rr = r + ((s - r) * (y - a)) / (b - a);
      ring(out, 'ashlar', y, rr - 0.025, rr + 0.018, 0.026, [0.29, 0.3, 0.23], q.courses);
    }
  lathe(
    out,
    'granite',
    [
      [30.5, 2.286],
      [30.87, 2.46],
      [31.23, 2.89],
      [31.4, 2.92],
    ],
    pale,
    q.sides,
  );
  ring(out, 'metal', 31.4, 1.87, 3.12, 0.16, [0.46, 0.47, 0.41], q.rail);
  for (let i = 0; i < q.posts; i++) {
    const a = (i * Math.PI * 2) / q.posts;
    beam(out, 'metal', polar(3.04, 31.56, a), polar(3.04, 32.68, a), 0.045, 0.045, bronze);
    if (q.braces) beam(out, 'metal', polar(2.3, 30.88, a), polar(3.1, 31.44, a), 0.075, 0.09, dark);
  }
  for (const y of [32.1, 32.64]) ring(out, 'metal', y, 3.015, 3.065, 0.055, bronze, q.rail);
  lathe(
    out,
    'metal',
    [
      [31.53, 2.06],
      [32.32, 2.06],
    ],
    bronze,
    q.sides,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = ((i + 1) * Math.PI) / 6,
      p = [
        polar(2.05, 32.32, a),
        polar(2.05, 32.32, b),
        polar(2.05, 34.47, b),
        polar(2.05, 34.47, a),
      ];
    quad(out, 'glass', p, normalFor(...p.slice(0, 3)), [0.22, 0.3, 0.31]);
    beam(out, 'metal', p[0], p[3], 0.038, 0.038, bronze);
    beam(out, 'metal', p[0], p[2], 0.027, 0.027, bronze);
  }
  for (const y of [32.32, 33.395, 34.47]) ring(out, 'metal', y, 2.01, 2.09, 0.055, bronze, q.rail);
  lathe(
    out,
    'metal',
    [
      [34.45, 2.18],
      [34.57, 2.18],
      [34.77, 1.89],
      [35.05, 1.47],
      [35.28, 0.93],
      [35.49, 0.08],
    ],
    bronze,
    q.sides,
  );
  for (let i = 0; i < q.cage; i++) {
    const a = (i * Math.PI * 2) / q.cage;
    beamPath(
      out,
      'metal',
      [polar(3.02, 31.57, a), polar(2.76, 34.35, a), polar(1.55, 35.38, a), polar(0.18, 35.86, a)],
      0.042,
      0.042,
      [0.41, 0.42, 0.37],
    );
  }
  for (const [y, r] of [
    [33.1, 2.86],
    [34.35, 2.76],
    [35.38, 1.55],
  ])
    ring(out, 'metal', y, r - 0.018, r + 0.018, 0.028, [0.41, 0.42, 0.37], q.rail);
  beam(out, 'metal', [0, 35.4, 0], [0, 36, 0], 0.054, 0.054, bronze);
  const pv = transformed(out, Math.PI / 8);
  box(pv, 'metal', [-1.25, 31.35, 2.6], [1.25, 31.52, 4.15], dark);
  box(pv, 'glass', [-1.18, 31.6, 4.04], [1.18, 32.75, 4.12], [0.065, 0.11, 0.15]);
  for (const x of [-1.1, 1.1])
    beam(pv, 'metal', [x, 30.65, 2.15], [x, 31.5, 4.03], 0.09, 0.11, dark);
  if (q.grid) {
    for (let x = -1.2; x <= 1.21; x += 0.3)
      beam(pv, 'metal', [x, 31.58, 4.14], [x, 32.77, 4.14], 0.025, 0.024, pale);
    for (let y = 31.58; y <= 32.78; y += 0.3)
      beam(pv, 'metal', [-1.2, y, 4.14], [1.2, y, 4.14], 0.025, 0.024, pale);
  }
  box(out, 'metal', [-1.53, 9.02, 3.5], [1.53, 9.16, 5.67], bronze);
  if (q.grid)
    for (let x = -1.5; x < 1.52; x += 0.26)
      beam(out, 'metal', [x, 9.19, 3.5], [x, 9.19, 5.67], 0.028, 0.035, [0.39, 0.38, 0.29]);
  for (const x of [-1.43, 1.43]) {
    beam(out, 'metal', [x, 7.6, 4.03], [x, 9.07, 5.6], 0.12, 0.12, bronze);
    for (const z of [3.6, 5.65]) beam(out, 'metal', [x, 9.17, z], [x, 10.2, z], 0.05, 0.05, bronze);
    beam(out, 'metal', [x, 10.2, 3.55], [x, 10.2, 5.65], 0.064, 0.064, bronze);
  }
  const ladderPoints = [
    [0.8, 6.57],
    [3, 5.75],
    [9.18, 5.75],
    [9.18, 3.97],
    [11.4, 3.97],
  ];
  for (const x of [-0.31, 0.31]) {
    beamPath(
      out,
      'metal',
      ladderPoints.slice(0, 3).map(([y, z]) => [x, y, z]),
      0.07,
      0.07,
      bronze,
    );
    beam(out, 'metal', [x, 9.18, 3.97], [x, 11.4, 3.97], 0.07, 0.07, bronze);
  }
  for (let y = 0.9; y < 9.18; y += q.rung) {
    const z = y < 3 ? 6.57 - ((y - 0.8) * 0.82) / 2.2 : 5.75;
    beam(out, 'metal', [-0.31, y, z], [0.31, y, z], 0.054, 0.054, bronze);
  }
  for (let y = 9.3; y < 11.4; y += q.rung)
    beam(out, 'metal', [-0.31, y, 3.97], [0.31, y, 3.97], 0.054, 0.054, bronze);
  for (const [a, y] of [
    [0, 16.05],
    [Math.PI / 2, 20.8],
    [-Math.PI / 2, 16.05],
  ]) {
    const o = transformed(out, a),
      r = y < 18 ? 2.91 : 2.56;
    box(o, 'concrete', [-0.39, y, r - 0.1], [0.39, y + 0.63, r + 0.46], pale);
    box(o, 'metal', [-0.29, y + 0.1, r + 0.45], [0.29, y + 0.5, r + 0.48], dark);
  }
}

export const bellRockDistrict = (out) =>
  buildNear(out, {
    sides: 12,
    step: 4,
    rail: 12,
    posts: 6,
    cage: 4,
    courses: 0,
    grid: false,
    braces: false,
    rung: 0.65,
  });
export const bellRockStreet = (out) =>
  buildNear(out, {
    sides: 32,
    step: 1.8,
    rail: 24,
    posts: 12,
    cage: 8,
    courses: 24,
    grid: true,
    braces: true,
    rung: 0.4,
  });
export const bellRockCloseup = (out) =>
  buildNear(out, {
    sides: 64,
    step: 0.8,
    rail: 48,
    posts: 24,
    cage: 16,
    courses: 64,
    grid: true,
    braces: true,
    rung: 0.29,
  });
