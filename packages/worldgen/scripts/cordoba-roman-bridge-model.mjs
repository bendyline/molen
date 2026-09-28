/** Present pedestrian exterior reconstructed from Cuenca's restoration and mapped individual piers. */

import { readFileSync } from 'node:fs';
import { loft, normalFor, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
  readFileSync(structureSourcePath('n0009_puente_romano', 'map-frame.json')),
);
const stone = [0.76, 0.684, 0.52],
  pale = [0.87, 0.809, 0.668],
  mortar = [0.56, 0.515, 0.43];
const mix = (a, b, t) => a + (b - a) * t;
const xmin = -144.8,
  xmax = 144.1;
const centerline = frame.centerline.filter((p, i, a) => !i || p[0] > a[i - 1][0] + 0.001);
function center(x) {
  for (let i = 1; i < centerline.length; i++)
    if (x <= centerline[i][0])
      return mix(
        centerline[i - 1][1],
        centerline[i][1],
        Math.max(0, (x - centerline[i - 1][0]) / (centerline[i][0] - centerline[i - 1][0])),
      );
  return centerline.at(-1)[1];
}
const deck = (x) =>
  x < -70
    ? mix(7.95, 10.5, (x - xmin) / (-70 - xmin))
    : x > 25
      ? mix(10.5, 8.15, (x - 25) / (xmax - 25))
      : 10.5;
// Each opening is fitted between distinct mapped projections. Slightly pointed vaults are
// photo reconstructions; the public inventory gives four without a surveyed numbering key.
const openings = [
  [-141.8, -131.8, 2.35, false],
  [-122.7, -115.8, 3.6, true],
  [-104.4, -95.4, 3.25, true],
  [-86.7, -77.6, 3.1, false],
  [-66.2, -56.7, 3.05, false],
  [-47.0, -37.6, 3.05, false],
  [-27.8, -17.5, 3.0, false],
  [-6.9, 4.1, 2.85, false],
  [10.7, 21.4, 2.85, false],
  [28.1, 40.4, 2.55, false],
  [47.1, 55.6, 2.8, false],
  [63.0, 71.9, 2.6, false],
  [81.0, 90.4, 2.2, true],
  [99.0, 107.6, 2.0, true],
  [117.3, 125.5, 1.9, false],
  [136.1, 141.6, 2.65, false],
];
const arches = openings.map(([a, b, spring, pointed], i) => ({
  x: (a + b) / 2,
  span: b - a,
  spring,
  rise: i === 0 ? 3.25 : i === 15 ? 2.9 : (b - a) / 2 + (pointed ? 0.5 : 0),
  pointed,
}));
const archPoint = (a, t, r = 0) => {
  const ang = Math.PI * t;
  return [
    a.x - (a.span / 2 + r) * Math.cos(ang),
    a.spring + (a.rise + r) * Math.sin(ang) - (a.pointed ? 0.32 * Math.sin(2 * ang) ** 2 : 0),
  ];
};
function floorAt(x) {
  for (const a of arches) {
    const r = a.span / 2 + 0.7;
    if (Math.abs(x - a.x) <= r) {
      const t = Math.acos(Math.max(-1, Math.min(1, (a.x - x) / r))) / Math.PI;
      return archPoint(a, t, 0.7)[1];
    }
  }
  return 0;
}
function solid(out, poly, z0, z1, color = stone, slot = 'stone', bend = true) {
  let p = poly.filter(
    (a, i) =>
      Math.hypot(
        a[0] - poly[(i + poly.length - 1) % poly.length][0],
        a[1] - poly[(i + poly.length - 1) % poly.length][1],
      ) > 1e-6,
  );
  if (p.length < 3) return;
  const area = p.reduce(
    (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
    0,
  );
  if (Math.abs(area) < 1e-7) return;
  if (area < 0) p = [...p].reverse();
  const ring = (z) => p.map(([x, y]) => [x, y, z + (bend ? center(x) : 0)]),
    a = ring(z0),
    b = ring(z1);
  out.addConvexPolygon(
    slot,
    'palette:#ffffff',
    [...a].reverse(),
    normalFor(a[2], a[1], a[0]),
    (p) => [p[0], p[1]],
    color,
  );
  out.addConvexPolygon(slot, 'palette:#ffffff', b, normalFor(...b), (p) => [p[0], p[1]], color);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length,
      ps = [a[i], a[j], b[j], b[i]];
    quad(out, slot, ps, normalFor(...ps), color);
  }
}
const wedge = (out, x0, x1, y0, y1, t0, t1, z0, z1, c = stone, slot = 'stone') =>
  solid(
    out,
    [
      [x0, y0],
      [x1, y1],
      [x1, t1],
      [x0, t0],
    ],
    z0,
    z1,
    c,
    slot,
  );
function clip(poly, y, above) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      ia = above ? a[1] >= y : a[1] <= y,
      ib = above ? b[1] >= y : b[1] <= y;
    if (ia) result.push(a);
    if (ia !== ib) result.push([mix(a[0], b[0], (y - a[1]) / (b[1] - a[1])), y]);
  }
  return result;
}
const upstream = [
  [-129.762, -122.857],
  [-114.287, -104.453],
  [-95.18, -86.902],
  [-77.511, -66.536],
  [-56.738, -47.312],
  [-37.727, -28.282],
  [-17.864, -7.309],
  [4.21, 10.613],
  [21.546, 27.941],
  [40.703, 46.763],
  [55.823, 61.988],
  [72.133, 80.61],
  [90.584, 97.928],
  [107.872, 115.662],
  [125.834, 131.855],
];
const downstream = [
  [-123.775, -132.186],
  [-104.862, -116.026],
  [-86.633, -95.487],
  [-65.877, -77.667],
  [-47.282, -56.047],
  [-27.927, -36.015],
  [-6.86, -16.622],
  [10.49, 4.101],
  [28.868, 21.819],
  [47.443, 40.876],
  [63.469, 56.726],
  [81.269, 73.088],
  [99.079, 91.279],
  [117.679, 109.101],
  [135.727, 127.996],
];
function planSlice(pair) {
  const p = frame.geometry.outline;
  const index = (x) =>
    p.reduce((best, a, i) => (Math.abs(a[0] - x) < Math.abs(p[best][0] - x) ? i : best), 0);
  return p.slice(index(pair[0]), index(pair[1]) + 1);
}
function pier(out, plan, height, cap) {
  if (plan.length < 3) throw Error('Incomplete mapped Córdoba pier');
  if (
    plan.reduce(
      (s, a, i) =>
        s + a[0] * plan[(i + 1) % plan.length][1] - plan[(i + 1) % plan.length][0] * a[1],
      0,
    ) > 0
  )
    plan = [...plan].reverse();
  const cx = plan.reduce((s, p) => s + p[0], 0) / plan.length,
    cz = plan.reduce((s, p) => s + p[1], 0) / plan.length;
  const ring = (y, k = 1) => plan.map(([x, z]) => [cx + (x - cx) * k, y, cz + (z - cz) * k]);
  loft(out, 'stone', [ring(0, 1.04), ring(0.52, 1.04), ring(0.7), ring(height)], mortar);
  for (let row = 0; row < Math.ceil((height - 0.7) / 0.37); row++)
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.68));
      for (let k = 0; k < n; k++) {
        const t0 = (k + 0.013) / n,
          t1 = (k + 0.987) / n,
          y0 = 0.7 + row * 0.37 + 0.006,
          y1 = Math.min(height, 0.7 + (row + 1) * 0.37 - 0.006);
        if (y1 <= y0) continue;
        const ps = [
            [mix(a[0], b[0], t0), y0, mix(a[1], b[1], t0)],
            [mix(a[0], b[0], t1), y0, mix(a[1], b[1], t1)],
            [mix(a[0], b[0], t1), y1, mix(a[1], b[1], t1)],
            [mix(a[0], b[0], t0), y1, mix(a[1], b[1], t0)],
          ],
          normal = normalFor(...ps);
        for (const p of ps) {
          p[0] += normal[0] * 0.018;
          p[2] += normal[2] * 0.018;
        }
        quad(
          out,
          'stone',
          ps,
          normal,
          stone.map((v) => v + (((i * 7 + k * 3 + row * 11) % 13) - 6) * 0.007),
        );
      }
    }
  if (cap) {
    const top = height + cap;
    for (let row = 0; row < 6; row++) {
      const a = row / 6,
        b = (row + 1) / 6;
      loft(
        out,
        'stone',
        [ring(mix(height, top, a), 1 - a * 0.94), ring(mix(height, top, b) - 0.012, 1 - b * 0.94)],
        pale.map((v) => v - row * 0.006),
      );
    }
  }
  // Low discreet floodlight bracket on the restored pier crown.
  if (cap) {
    box(
      out,
      'iron',
      [cx - 0.12, height + cap + 0.015, cz - 0.15],
      [cx + 0.12, height + cap + 0.18, cz + 0.15],
      [0.24, 0.245, 0.23],
    );
  }
}
function statue(out) {
  const x = 7.74,
    z = -2.51,
    y = deck(x),
    ivory = [0.82, 0.804, 0.731];
  // Baroque square pedestal with stepped cornices and concave neck.
  const layers = [
    [0, 1.05],
    [0.2, 1.05],
    [0.3, 0.93],
    [0.5, 0.88],
    [0.68, 0.72],
    [1.1, 0.61],
    [1.45, 0.63],
    [1.72, 0.75],
    [1.86, 0.9],
    [2.05, 0.9],
    [2.18, 0.69],
    [2.42, 0.53],
    [2.61, 0.46],
  ];
  loft(
    out,
    'stone',
    layers.map(([dy, r]) => [
      [x - r, y + dy, z - r],
      [x - r, y + dy, z + r],
      [x + r, y + dy, z + r],
      [x + r, y + dy, z - r],
    ]),
    ivory,
  );
  for (const side of [-1, 1]) {
    box(
      out,
      'stone',
      [x - 0.31, y + 0.81, z + side * 0.654 - 0.015],
      [x + 0.31, y + 1.47, z + side * 0.654 + 0.015],
      [0.66, 0.64, 0.57],
    );
  }
  const base = y + 2.61;
  // Carved robe follows a weighted stance and has individual cloth folds, visible feet,
  // hands, facial volumes and layered wings. This is original sculptural interpretation.
  const robe = Array.from({ length: 14 }, (_, j) => {
    const t = j / 13,
      h = base + 0.15 + t * 1.65,
      r = 0.4 * (1 - t) + 0.29 * t;
    return Array.from({ length: 64 }, (_, k) => {
      const a = (-2 * Math.PI * k) / 64,
        fold = 0.022 * Math.cos(12 * a + t * 1.4);
      return [
        x + Math.cos(a) * (r + fold) + 0.06 * Math.sin(t * 3),
        h,
        z + Math.sin(a) * (r * 0.63 + fold),
      ];
    });
  });
  loft(out, 'stone', robe, ivory);
  sphere(out, 'stone', [x - 0.16, base + 0.13, z + 0.12], [0.12, 0.09, 0.27], ivory, 24, 12);
  sphere(out, 'stone', [x + 0.19, base + 0.13, z + 0.2], [0.12, 0.09, 0.26], ivory, 24, 12);
  sphere(out, 'stone', [x + 0.035, base + 1.92, z], [0.3, 0.32, 0.19], ivory, 32, 20);
  tube(out, 'stone', [x + 0.035, base + 2.03, z], [x + 0.06, base + 2.21, z], 0.105, ivory, 24);
  sphere(out, 'stone', [x + 0.055, base + 2.37, z + 0.015], [0.16, 0.22, 0.17], ivory, 40, 24);
  sphere(out, 'stone', [x + 0.055, base + 2.34, z + 0.172], [0.035, 0.054, 0.07], ivory, 20, 12);
  for (const side of [-1, 1]) {
    sphere(
      out,
      'stone',
      [x + 0.055 + side * 0.068, base + 2.395, z + 0.16],
      [0.045, 0.02, 0.02],
      [0.57, 0.55, 0.48],
      20,
      10,
    );
    tube(
      out,
      'stone',
      [x + 0.055 + side * 0.039, base + 2.421, z + 0.166],
      [x + 0.055 + side * 0.097, base + 2.413, z + 0.147],
      0.016,
      ivory,
      12,
    );
  }
  sphere(out, 'stone', [x + 0.055, base + 2.255, z + 0.149], [0.06, 0.012, 0.028], ivory, 20, 10);
  for (let i = 0; i < 17; i++) {
    const a = (i / 16) * Math.PI * 1.8 + 0.2;
    sphere(
      out,
      'stone',
      [
        x + 0.055 + Math.cos(a) * 0.152,
        base + 2.43 + Math.sin(a) * 0.06,
        z - 0.025 + Math.sin(a) * 0.145,
      ],
      [0.04, 0.09, 0.035],
      ivory,
      12,
      8,
    );
  }
  for (const side of [-1, 1]) {
    const shoulder = [x + side * 0.27, base + 1.97, z],
      elbow = [x + side * 0.45, base + 1.48 + (side > 0 ? 0.12 : 0), z + 0.08],
      hand = [x + side * 0.44, base + 1.16 + (side > 0 ? 0.31 : 0), z + 0.19];
    tube(out, 'stone', shoulder, elbow, 0.14, ivory, 24);
    tube(out, 'stone', elbow, hand, 0.09, ivory, 24);
    sphere(out, 'stone', hand, [0.076, 0.115, 0.07], ivory, 24, 16);
    const wing = [
      [0.19, 1.68],
      [0.46, 1.36],
      [0.81, 1.49],
      [0.91, 1.9],
      [0.88, 2.35],
      [0.6, 2.67],
      [0.36, 2.49],
    ].map(([u, v]) => [x + side * u, base + v]);
    solid(out, wing, z - 0.31, z - 0.19, ivory, 'stone', false);
    for (let f = 0; f < 11; f++) {
      const a = [x + side * (0.3 + f * 0.025), base + 2.07 + f * 0.027],
        b = [x + side * (0.49 + f * 0.035), base + 1.43 + f * 0.089],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        l = Math.hypot(dx, dy),
        nx = (-dy / l) * 0.04,
        ny = (dx / l) * 0.04;
      solid(
        out,
        [
          [a[0] - nx * 0.55, a[1] - ny * 0.55],
          [mix(a[0], b[0], 0.52) - nx, mix(a[1], b[1], 0.52) - ny],
          b,
          [mix(a[0], b[0], 0.52) + nx, mix(a[1], b[1], 0.52) + ny],
          [a[0] + nx * 0.55, a[1] + ny * 0.55],
        ],
        z - 0.197,
        z - 0.17,
        ivory.map((v) => v - f * 0.003),
        'stone',
        false,
      );
      tube(
        out,
        'stone',
        [a[0], a[1], z - 0.165],
        [mix(a[0], b[0], 0.9), mix(a[1], b[1], 0.9), z - 0.165],
        0.01,
        ivory,
        8,
      );
    }
  }
  tube(
    out,
    'iron',
    [x + 0.45, base + 0.04, z + 0.2],
    [x + 0.45, base + 2.56, z + 0.2],
    0.022,
    [0.45, 0.4, 0.27],
    12,
  );
}
function shrine(out) {
  const x = 7.3,
    z = 6.75,
    y = deck(x),
    light = [0.885, 0.85, 0.748];
  box(out, 'stone', [4.22, y - 0.16, 6.57], [10.45, y, 10.24], pale);
  for (const side of [-1, 1])
    box(
      out,
      'stone',
      [x + side * 1.12 - 0.3, y, 7.45],
      [x + side * 1.12 + 0.3, y + 3.6, 8.65],
      light,
    );
  box(out, 'stone', [x - 1.42, y + 3.15, 7.45], [x + 1.42, y + 3.65, 8.65], light);
  box(out, 'stone', [x - 1.48, y + 3.65, 7.4], [x + 1.48, y + 3.78, 8.72], pale);
  box(out, 'stone', [x - 1.42, y, 8.5], [x + 1.42, y + 3.15, 8.68], light);
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI) / 24,
      b = ((i + 1) * Math.PI) / 24,
      ps = [
        [x + 0.82 * Math.cos(a), y + 0.14, 7.78 + 0.62 * Math.sin(a)],
        [x + 0.82 * Math.cos(b), y + 0.14, 7.78 + 0.62 * Math.sin(b)],
        [x + 0.82 * Math.cos(b), y + 3.14, 7.78 + 0.62 * Math.sin(b)],
        [x + 0.82 * Math.cos(a), y + 3.14, 7.78 + 0.62 * Math.sin(a)],
      ];
    quad(out, 'marking', ps, normalFor(...ps), [0.105, 0.13, 0.113]);
    quad(
      out,
      'marking',
      [...ps].reverse(),
      normalFor(...ps).map((v) => -v),
      [0.105, 0.13, 0.113],
    );
  }
  box(out, 'stone', [x - 0.92, y + 0.02, z + 0.59], [x + 0.92, y + 0.2, 8.42], pale);
  for (const xx of [4.3, 10.36])
    box(out, 'stone', [xx - 0.14, y, 6.58], [xx + 0.14, y + 0.97, 10.24], light);
  box(out, 'stone', [4.22, y, 10.02], [10.45, y + 0.97, 10.26], light);
}
export function buildCordobaBridge(out) {
  const stops = [
    ...new Set([
      xmin,
      xmax,
      ...arches.flatMap((a) => [a.x - a.span / 2 - 0.7, a.x + a.span / 2 + 0.7]),
      ...Array.from({ length: Math.ceil((xmax - xmin) / 0.22) }, (_, i) => xmin + i * 0.22),
    ]),
  ]
    .filter((x) => x >= xmin && x <= xmax)
    .sort((a, b) => a - b);
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i],
      b = stops[i + 1],
      mid = (a + b) / 2,
      arch = arches.find((r) => Math.abs(mid - r.x) < r.span / 2 + 0.7);
    const lo = (x) =>
      arch
        ? archPoint(
            arch,
            Math.acos(Math.max(-1, Math.min(1, (arch.x - x) / (arch.span / 2 + 0.7)))) / Math.PI,
            0.7,
          )[1]
        : 0;
    wedge(out, a, b, lo(a), lo(b), deck(a) - 0.13, deck(b) - 0.13, -4.53, 4.53, mortar);
  }
  for (const a of arches) {
    const count = Math.ceil(a.span * 4.6);
    for (let i = 0; i < count; i++)
      for (let lane = 0; lane < 13; lane++) {
        const t0 = (i + 0.018) / count,
          t1 = (i + 0.982) / count;
        solid(
          out,
          [archPoint(a, t0), archPoint(a, t1), archPoint(a, t1, 0.7), archPoint(a, t0, 0.7)],
          -4.62 + (lane * 9.24) / 13 + 0.004,
          -4.62 + ((lane + 1) * 9.24) / 13 - 0.004,
          stone.map((v) => v + (((i * 11 + lane * 7) % 17) - 8) * 0.006),
        );
        if (lane === 0 || lane === 12)
          solid(
            out,
            [
              archPoint(a, t0, 0.7),
              archPoint(a, t1, 0.7),
              archPoint(a, t1, 0.9),
              archPoint(a, t0, 0.9),
            ],
            lane === 0 ? -4.69 : 4.55,
            lane === 0 ? -4.55 : 4.69,
            pale,
          );
      }
  }
  for (const side of [-1, 1])
    for (let row = 0; row < 29; row++)
      for (let x = xmin - 0.6 + (row % 2) * 0.38; x < xmax; x += 0.76) {
        const a = Math.max(xmin, x + 0.009),
          b = Math.min(xmax, x + 0.751);
        if (b <= a) continue;
        const poly = clip(
          clip(
            [
              [a, floorAt(a)],
              [b, floorAt(b)],
              [b, deck(b) - 0.13],
              [a, deck(a) - 0.13],
            ],
            row * 0.38 + 0.008,
            true,
          ),
          row * 0.38 + 0.371,
          false,
        );
        solid(
          out,
          poly,
          side < 0 ? -4.61 : 4.51,
          side < 0 ? -4.51 : 4.61,
          stone.map((v) => v + (((row * 11 + Math.floor((x + 200) * 7)) % 17) - 8) * 0.006),
        );
      }
  for (let i = 0; i < 15; i++) {
    const height = [
      4.25, 4.45, 4.8, 5.0, 5.1, 5.1, 5.2, 4.6, 4.65, 4.5, 4.4, 4.35, 4.15, 4.0, 3.85,
    ][i];
    pier(out, planSlice(upstream[i]), height, i === 7 ? 0 : 2.3);
    pier(out, planSlice(downstream[i]), i === 7 ? deck(7.3) : height + 0.15, i === 7 ? 0 : 1.75);
  }
  for (let x = xmin; x < xmax; x += 0.75) {
    const b = Math.min(xmax, x + 0.75);
    for (const side of [-1, 1]) {
      wedge(
        out,
        x,
        b,
        deck(x) - 0.28,
        deck(b) - 0.28,
        deck(x) - 0.11,
        deck(b) - 0.11,
        side < 0 ? -4.74 : 4.49,
        side < 0 ? -4.49 : 4.74,
        pale,
      );
      if (side > 0 && x > 3.8 && x < 10.5) continue;
      for (let row = 0; row < 2; row++)
        wedge(
          out,
          x + 0.007,
          b - 0.007,
          deck(x) + row * 0.43,
          deck(b) + row * 0.43,
          deck(x) + (row + 1) * 0.43 - 0.011,
          deck(b) + (row + 1) * 0.43 - 0.011,
          side < 0 ? -4.6 : 4.05,
          side < 0 ? -4.05 : 4.6,
          pale,
        );
      wedge(
        out,
        x + 0.004,
        b - 0.004,
        deck(x) + 0.86,
        deck(b) + 0.86,
        deck(x) + 1.04,
        deck(b) + 1.04,
        side < 0 ? -4.65 : 4.0,
        side < 0 ? -4.0 : 4.65,
        pale,
      );
    }
    for (let lane = 0; lane < 10; lane++)
      wedge(
        out,
        x + 0.006,
        b - 0.006,
        deck(x) - 0.12,
        deck(b) - 0.12,
        deck(x),
        deck(b),
        -4.04 + lane * 0.808 + 0.006,
        -4.04 + (lane + 1) * 0.808 - 0.006,
        [0.72, 0.694, 0.625].map(
          (v) => v + (((lane * 11 + Math.floor((x + 200) * 7)) % 9) - 4) * 0.006,
        ),
        'paving',
      );
  }
  for (let x = -138; x < 141; x += 12)
    for (const side of [-1, 1]) {
      const y = deck(x),
        z = center(x) + side * 3.82;
      box(out, 'iron', [x - 0.1, y, z - 0.15], [x + 0.1, y + 0.76, z + 0.15], [0.27, 0.28, 0.255]);
      box(
        out,
        'marking',
        [x - 0.104, y + 0.1, z - 0.1],
        [x + 0.104, y + 0.68, z + 0.1],
        [0.68, 0.745, 0.69],
      );
    }
  statue(out);
  shrine(out);
}
export const cordobaStudy = {
  id: 'N0009',
  key: 'puente_romano',
  title: 'Roman Bridge of Córdoba',
  wikidataId: 'Q97625652',
  build: buildCordobaBridge,
  mapFrameDocument: 'map-frame.json',
  surfaceOverrides: { stone: 'travertine' },
  brief:
    'Sixteen unequal stone vaults on a gently bent pedestrian deck, individually mapped pointed upstream and rounded downstream cutwaters, radial voussoirs and archivolts, restored masonry parapets, granite paving and low lamps, San Rafael with carved pedestal and the reconstructed opposite shrine.',
  refs: [
    'https://www.turismodecordoba.org/puente-romano',
    'https://www.arqueocordoba.com/monumentos/#puente-romano',
    'https://static.arteinformado.com/resources/app/docs/evento/23/127123/1_cat__logo_juan_cuenca_del_plano_al_espacio__baja_resoluci__n_.pdf',
    'https://gruporesa.com/puente-romano-de-cordoba/',
    'https://www.openstreetmap.org/way/403272673',
    'https://api-features.ign.es/collections/red_nap/items/526058',
    'https://datos-geodesia.ign.es/REDNAP/Lin00526/526057.pdf',
  ],
  sourceFacts: {
    presentArches: 16,
    pointedArches: 4,
    restorationArchitect: 'Juan Cuenca',
    restoration: '2004–2012 bridge and environs; bridge reopened2008',
    pedestrianSurface: 'Granite paving',
    mappedEnvelopeMeters: 289.809,
    nearbyGateBenchmarkMeters: 98.19104,
    benchmarkCaution:
      'NAPA339 belongs to the separate gate column; bridge markerCSHG194 is published pending leveling. Neither is a direct bridge deck elevation.',
  },
  reconstruction: {
    arches,
    upstreamPierRanges: upstream,
    downstreamPierRanges: downstream,
    deckWidthMeters: 9.24,
    datum:
      'NativeY0 is a provisional exposed-foundation reference89m ASL; vertical deck and pier profile is photo-scaled. No survey tie to the separate gate marker is claimed.',
    basis:
      'Exact map shape constrains individual pier positions, width, curvature and signed side; restored surfaces and sculptural silhouette use the architect’s published2016 exterior photographs. The four lightly pointed vault positions and statue anatomy are original photographic interpretations.',
  },
  nativeAxes: {
    x: 'southeast toward Calahorra',
    y: 'up from provisional exposed-foundation reference',
    z: 'southwest downstream',
  },
  geographic: () => ({
    anchor: frame.anchor,
    heading: frame.heading,
    featureIds: ['way/403272673'],
    source: 'https://www.openstreetmap.org/way/403272673',
    elevationMode: 'sea-level',
    elevationMeters: 89,
    notes:
      'Exact mapped individual piers and centerline fix scale/orientation. Local water stage, exposed foundation level89m, deck profile and shore grading remain photographic reconstruction; IGN gate-marker height is not misused as deck level.',
  }),
  limitations: [
    'Exterior reconstruction, with individually mapped unequal pier plans and photo-scaled vault profiles, heights and masonry. It is not a construction survey.',
    'Nearby Calahorra tower, Puerta gate, riverside mills and bank paths are separate structures. Buried former arches and foundations are not reconstructed.',
    'The contemporary painted artwork inside the curved shrine is represented by a dark surface; no source photograph or painting is embedded. San Rafael is an original sculptural interpretation, not a scanned reproduction.',
    'Published total lengths differ; the model follows the289.809m mapped structure envelope and its16openings. Provisional vertical datum89m requires local host water/shore agreement.',
  ],
  camera: { position: [-65, 90, 355], lookAt: [0, 6, 1], fov: 44 },
  qaCameras: [
    { name: 'upstream-piers', position: [-13, 23, -86], lookAt: [-13, 5, 0], fov: 48 },
    { name: 'downstream-piers', position: [25, 23, 79], lookAt: [25, 5, 0], fov: 48 },
    { name: 'arch-soffit', position: [-22, 2.2, 21], lookAt: [-22, 7, 0], fov: 55 },
    { name: 'san-rafael', position: [13, 17, 5], lookAt: [7.74, 14.15, -2.51], fov: 45 },
    { name: 'shrine', position: [11, 14.2, -1], lookAt: [7.3, 12.2, 8], fov: 48 },
    { name: 'walking-surface', position: [-30, 12.2, 2], lookAt: [11, 11.3, 2], fov: 58 },
    { name: 'north-approach', position: [-131, 22, 39], lookAt: [-128, 5, 0], fov: 51 },
  ],
};
