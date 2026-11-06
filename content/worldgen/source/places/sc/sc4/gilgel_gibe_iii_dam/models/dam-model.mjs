import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [37.301644605, 6.847880293],
  heading: -0.459476554871,
  datum: 707.5954505,
  crest: 896,
  base: 646,
  normalPool: 889,
  crestEnds: [-315, 315],
  nativeCrestZ: -74.16,
  spillway: { from: -21.4, to: 83.7, bays: 7 },
  powerhouse: { upstream: [84, 411], downstream: [106, 592], width: 46, units: 10 },
  shafts: [
    [235, 171, 822, 13],
    [229, 317, 819, 15],
  ],
};

const palette = {
  body: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.545, 0.527, 0.48] },
  step: { slot: 'trim', graph: 'concrete_plain', rgb: [0.61, 0.586, 0.533] },
  dark: { slot: 'foundation', graph: 'concrete_panel', rgb: [0.38, 0.36, 0.322] },
  steel: { slot: 'trim', graph: 'metal_painted', rgb: [0.24, 0.279, 0.3] },
  gate: { slot: 'door', graph: 'metal_painted', rgb: [0.168, 0.211, 0.238] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.325, 0.394, 0.425] },
  windows: { slot: 'window', graph: 'window_grid', rgb: [0.177, 0.235, 0.256] },
  crane: { slot: 'trim', graph: 'metal_painted', rgb: [0.66, 0.209, 0.122] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { rgb, ...surface }]) => [key, surface]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { crest, base, datum, crestEnds, nativeCrestZ, spillway, powerhouse } = controls;
const p = (x, y, z) => [x, y - datum, z];
const rod = (out, m, a, b, width, depth) => beam(out, m, a, b, width, depth, palette[m].rgb);
const box = (out, m, x, y, z, width, height, depth) =>
  rod(out, m, p(x, y - height / 2, z), p(x, y + height / 2, z), depth, width);
function surface(out, m, points, toward, shade = 1) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  const add = points.length === 3 ? out.addTriangle : out.addQuad;
  add.call(
    out,
    m,
    'palette:#ffffff',
    points,
    normal,
    undefined,
    palette[m].rgb.map((v) => v * shade),
  );
}

// Foundation, toe and crest follow the mapped trapezoidal gravity footprint.
const crossSections = [
  [base, -66, 96, -48, 91],
  [686, -70, 82, -67, 106],
  [718, -73, 73, -96, 130],
  [755, nativeCrestZ, 46, -144, 167],
  [790, nativeCrestZ, 21, -195, 204],
  [828, nativeCrestZ, -9, -243, 252],
  [862, nativeCrestZ, -38, -278, 288],
  [881, nativeCrestZ, -54, -301, 305],
  [crest, nativeCrestZ, -55, ...crestEnds],
];
function profile(y) {
  const i = crossSections.findIndex((row) => row[0] >= y);
  if (i === 0) return crossSections[0].slice(1);
  const a = crossSections[i - 1],
    b = crossSections[i],
    t = (y - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, k) => v + (b[k + 1] - v) * t);
}
function arch(out, tier) {
  const slices = [2, 4, 9, 18, 24][tier];
  const limits = [
    ...new Set([
      ...crossSections.map((r) => r[0]),
      ...Array.from({ length: slices - 1 }, (_, i) => 711 + ((i + 1) * 168) / slices),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < limits.length; i++) {
    const a = limits[i - 1],
      b = limits[i],
      [u, v, left, right] = profile(a),
      [U, V, L, R] = profile(b);
    if (a >= 881) {
      for (const [lo, hi, Lo, Hi] of [
        [left, spillway.from, L, spillway.from],
        [spillway.to, right, spillway.to, R],
      ]) {
        surface(out, 'body', [p(lo, a, u), p(hi, a, u), p(Hi, b, U), p(Lo, b, U)], [0, 0, -1]);
        surface(out, 'body', [p(lo, a, v), p(hi, a, v), p(Hi, b, V), p(Lo, b, V)], [0, 0, 1]);
      }
      for (const [x, side] of [
        [spillway.from, 1],
        [spillway.to, -1],
      ])
        surface(out, 'body', [p(x, a, u), p(x, a, v), p(x, b, V), p(x, b, U)], [side, 0, 0]);
    } else
      surface(out, 'body', [p(left, a, u), p(right, a, u), p(R, b, U), p(L, b, U)], [0, 0, -1]);
    const stepped = tier > 0 && a >= 686 && b <= 881;
    const foot = stepped ? V : v;
    if (a < 881) {
      const recess = (y) => 18 * Math.min(1, Math.max(0, (y - 790) / 27));
      const lowerInset = recess(a),
        upperInset = recess(b);
      const ranges =
        upperInset > 0
          ? [
              [left, spillway.from, L, spillway.from, 0, 0],
              [spillway.to, right, spillway.to, R, 0, 0],
              [spillway.from, spillway.to, spillway.from, spillway.to, lowerInset, upperInset],
            ]
          : [[left, right, L, R, 0, 0]];
      for (const [lo, hi, Lo, Hi, lift, raise] of ranges) {
        const stepAt = stepped && raise === 0;
        const end = stepAt ? a : b,
          depth = stepAt ? foot : V;
        surface(
          out,
          'body',
          [
            p(lo, a, v - lift),
            p(hi, a, v - lift),
            p(Hi, end, depth - raise),
            p(Lo, end, depth - raise),
          ],
          stepAt ? [0, 1, 0] : [0, 0, 1],
          0.94 + (i % 4) * 0.035,
        );
        if (stepAt)
          surface(
            out,
            'body',
            [p(Lo, a, V), p(Hi, a, V), p(Hi, b, V), p(Lo, b, V)],
            [0, 0, 1],
            1 - (i % 5) * 0.023,
          );
      }
    }
    for (const [x, X, side] of [
      [left, L, -1],
      [right, R, 1],
    ]) {
      surface(out, 'body', [p(x, a, u), p(x, a, v), p(X, b, V)], [side, 0, 0]);
      surface(out, 'body', [p(x, a, u), p(X, b, V), p(X, b, U)], [side, 0, 0]);
    }
  }
  const [a, b] = crestEnds;
  const left = spillway.from,
    right = spillway.to;
  for (const [x, X] of [
    [a, left],
    [right, b],
  ]) {
    box(out, 'step', (x + X) / 2, crest + 0.1, -64.7, X - x, 0.2, 18.9);
    if (tier > 0)
      for (const z of [-73.8, -55.6])
        rod(out, 'steel', p(x, crest + 1.1, z), p(X, crest + 1.1, z), 0.12, 0.16);
  }
  if (tier > 1)
    for (let x = a + 4; x < b; x += tier > 2 ? 8 : 16) {
      if (x >= left && x <= right) continue;
      for (const z of [-73.8, -55.6]) box(out, 'steel', x, crest + 0.63, z, 0.12, 1.12, 0.12);
    }
}

const chuteProfile = [
  [881, -57],
  [857, -38],
  [831, -14],
  [807, 7],
  [795, 28],
  [792, 49],
  [795, 71],
];
function chutes(out, tier) {
  const path = tier === 0 ? chuteProfile.filter((_, i) => [0, 2, 4, 6].includes(i)) : chuteProfile;
  const pitch = (spillway.to - spillway.from) / spillway.bays;
  for (let i = 0; i < spillway.bays; i++) {
    const a = spillway.from + i * pitch,
      b = a + pitch,
      side = 0.88;
    for (let j = 1; j < path.length; j++) {
      const [y, z] = path[j - 1],
        [Y, Z] = path[j],
        h = j === path.length - 1 ? 3.8 : 5.2;
      surface(
        out,
        'step',
        [p(a + side, y, z), p(b - side, y, z), p(b - side, Y, Z), p(a + side, Y, Z)],
        [0, 1, 1],
      );
      const gap = j === 1 ? 9.2 : h;
      for (const x of [a, b - side]) {
        surface(
          out,
          'body',
          [p(x, y - 2, z), p(x + side, y - 2, z), p(x + side, Y - 2, Z), p(x, Y - 2, Z)],
          [0, -1, 0],
        );
        surface(
          out,
          'step',
          [p(x, y + gap, z), p(x + side, y + gap, z), p(x + side, Y + h, Z), p(x, Y + h, Z)],
          [0, 1, 1],
        );
        for (const [X, sign] of [
          [x, -1],
          [x + side, 1],
        ])
          surface(
            out,
            'body',
            [p(X, y - 2, z), p(X, Y - 2, Z), p(X, Y + h, Z), p(X, y + gap, z)],
            [sign, 0, 0],
          );
      }
    }
    const left = a + side,
      right = b - side;
    for (const sign of [-1, 1]) {
      surface(
        out,
        'gate',
        [
          p(left, 880, -60 + sign * 0.12),
          p(right, 880, -60 + sign * 0.12),
          p(right, 894, -58.3 + sign * 0.12),
          p(left, 894, -58.3 + sign * 0.12),
        ],
        [0, 0, sign],
      );
    }
    if (tier > 1) {
      for (const y of [883.5, 888.3, 892.2])
        rod(out, 'steel', p(left, y, -57.8), p(right, y, -57.8), 0.36, 0.35);
      box(out, 'steel', (left + right) / 2, 898, -64, 0.8, 4.6, 2.3);
    }
    box(out, 'body', a + 0.45, 891.2, -58.5, 1.35, 17.7, 18);
  }
  box(out, 'body', spillway.to - 0.32, 891.2, -58.5, 1.35, 17.7, 18);
  box(out, 'step', 31, 896.15, -67.9, 106, 1.1, 8.4);
  box(out, 'body', 31, 784.6, 60.2, 105, 19.1, 21.6);
  for (const x of [-37, 101]) {
    if (tier === 0) {
      box(out, 'body', x, 767.2, 60.8, 17, 31, 17.1);
      box(out, 'gate', x, 766.4, 69.45, 8.8, 12.1, 0.3);
    } else {
      for (const side of [-1, 1]) box(out, 'body', x + side * 6.45, 767.2, 60.8, 4.1, 31, 17.1);
      box(out, 'body', x, 776.2, 60.8, 8.8, 13, 17.1);
      box(out, 'body', x, 755.5, 60.8, 8.8, 7.6, 17.1);
      box(out, 'gate', x, 765.6, 65.1, 8.8, 12.6, 0.44);
    }
    box(out, 'step', x, 773, 68.9, 13, 1.5, 3.8);
  }
  for (const side of [-1, 1]) {
    box(out, 'crane', -40 + side * 4.4, 901.1, -63, 1.3, 9.5, 1.5);
    if (tier > 1)
      rod(out, 'crane', p(-40 + side * 4.2, 898, -63), p(-40 - side * 2.9, 905, -63), 0.53, 0.52);
  }
  box(out, 'crane', -40, 906.1, -63, 13, 1.8, 3.4);
}

function plantPoint(u, y, v) {
  const [x, z] = powerhouse.upstream,
    [a, b] = powerhouse.downstream,
    L = Math.hypot(a - x, b - z);
  return p(x + (a - x) * u + ((b - z) * v) / L, y, z + (b - z) * u - ((a - x) * v) / L);
}
function plantBox(out, m, u, v, y, w, h) {
  const corners = [
    [u[0], v],
    [u[1], v],
    [u[1], v + w],
    [u[0], v + w],
  ];
  const outline = (Y) => corners.map(([x, z]) => plantPoint(x, Y, z));
  const lower = outline(y),
    upper = outline(y + h);
  surface(out, m, upper, [0, 1, 0]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = [lower[i][2] - lower[j][2], 0, lower[j][0] - lower[i][0]];
    surface(out, m, [lower[i], lower[j], upper[j], upper[i]], n);
  }
}
function generatorHall(out, tier) {
  plantBox(out, 'body', [-0.08, 1.1], -1, 684, 50, 29);
  plantBox(out, 'dark', [-0.08, 1.1], -1, 712.8, 50, 1.1);
  plantBox(out, 'body', [-0.015, 1.015], 22, 713.9, 25, 12.4);
  plantBox(out, 'roof', [-0.023, 1.023], 21.4, 726.3, 26, 1.1);
  const N = tier === 0 ? 5 : powerhouse.units;
  for (let i = 0; i < N; i++) {
    const a = (i + 0.06) / N,
      b = (i + 0.94) / N,
      mid = (i + 0.5) / N;
    if (tier < 2) plantBox(out, 'body', [a, b], -2.1, 691.6, 9.8, 16.2);
    else {
      const jamb = (b - a) * 0.15;
      plantBox(out, 'body', [a, a + jamb], -2.9, 691.6, 10.6, 16.2);
      plantBox(out, 'body', [b - jamb, b], -2.9, 691.6, 10.6, 16.2);
      plantBox(out, 'body', [a + jamb, b - jamb], -2.9, 704, 10.6, 3.8);
      plantBox(out, 'gate', [a + jamb, b - jamb], -1.85, 691.6, 0.35, 12.4);
    }
    const pane = [
      plantPoint(a + 0.004, 717, 21.91),
      plantPoint(b - 0.004, 717, 21.91),
      plantPoint(b - 0.004, 724.6, 21.91),
      plantPoint(a + 0.004, 724.6, 21.91),
    ];
    surface(out, 'windows', pane, [-1, 0, 0]);
    if (tier > 1) {
      plantBox(out, 'steel', [mid - 0.006, mid + 0.006], 10.3, 714.2, 6.5, 2.2);
      for (const du of [-0.015, 0.015]) {
        rod(
          out,
          'steel',
          plantPoint(mid + du, 713.8, 13),
          plantPoint(mid + du, 723.7, 13),
          0.19,
          0.21,
        );
      }
      rod(out, 'steel', plantPoint(a, 723.9, 13), plantPoint(b, 723.9, 13), 0.33, 0.35);
    }
  }
  if (tier > 0) {
    plantBox(out, 'crane', [0.965, 1.058], 4.1, 721.3, 17.2, 1.9);
    for (const u of [0.978, 1.042]) {
      rod(out, 'crane', plantPoint(u, 714, 6), plantPoint(u, 722, 6), 0.59, 0.67);
      rod(out, 'crane', plantPoint(u, 714, 19.2), plantPoint(u, 722, 19.2), 0.59, 0.67);
    }
  }
}
function surgeShaft(out, x, z, baseY, radius, tier) {
  const count = [10, 16, 24, 32, 40][tier],
    height = 34;
  const point = (i, r, h) =>
    p(x + r * Math.cos((i / count) * Math.PI * 2), h, z + r * Math.sin((i / count) * Math.PI * 2));
  for (let i = 0; i < count; i++) {
    const j = i + 1,
      theta = ((i + 0.5) / count) * Math.PI * 2,
      n = [Math.cos(theta), 0, Math.sin(theta)];
    const y = baseY + height;
    surface(
      out,
      'body',
      [
        point(i, radius, baseY - 24),
        point(j, radius, baseY - 24),
        point(j, radius, y),
        point(i, radius, y),
      ],
      n,
    );
    surface(
      out,
      'step',
      [point(i, radius, y), point(j, radius, y), point(j, radius - 1, y), point(i, radius - 1, y)],
      [0, 1, 0],
    );
    surface(
      out,
      'dark',
      [
        point(i, radius - 1, y),
        point(j, radius - 1, y),
        point(j, radius - 1, y - 5.2),
        point(i, radius - 1, y - 5.2),
      ],
      n.map((v) => -v),
    );
    surface(
      out,
      'dark',
      [p(x, y - 5.2, z), point(i, radius - 1, y - 5.2), point(j, radius - 1, y - 5.2)],
      [0, 1, 0],
      0.54,
    );
  }
}
export function buildDamLevel(out, name) {
  const tier = tiers[name];
  if (tier === undefined) throw Error('Unknown Gibe III tier: ' + name);
  arch(out, tier);
  chutes(out, tier);
  generatorHall(out, tier);
  for (const shaft of controls.shafts) surgeShaft(out, ...shaft, tier);
}
export const buildDamSkyline = (out) => buildDamLevel(out, 'skyline');
export const buildDamDistrict = (out) => buildDamLevel(out, 'district');
export const buildDamStreet = (out) => buildDamLevel(out, 'street');
export const buildDamCloseup = (out) => buildDamLevel(out, 'closeup');
