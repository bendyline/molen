/** Browser derivatives of Kihnu; the original detailed master is unchanged. */

import { beam, normalFor } from './authored-structure-mesh.mjs';
import { buildKihnuDetail } from './lighthouse-baltic-iron-models.mjs';
import { ring } from './lighthouse-expansion-models.mjs';
import { lathe, transformed } from './lighthouse-models.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const TAU = Math.PI * 2,
  white = [0.88, 0.88, 0.83],
  red = [0.68, 0.035, 0.035],
  black = [0.035, 0.042, 0.04];
export const kihnuProfile = [
  [0.22, 3.02],
  [0.38, 2.93],
  [0.74, 2.81],
  [1.22, 2.755],
  [20.5, 1.37],
  [21.02, 1.43],
  [21.84, 1.49],
];
export const kihnuPorts = [2.05, 6.62, 11.12, 15.62, 20.04].flatMap((y) =>
  Array.from({ length: y < 3 ? 8 : 4 }, (_, i) => ({
    y,
    angle: (y < 3 ? Math.PI / 8 : Math.PI / 4) + (i * TAU) / (y < 3 ? 8 : 4),
  })),
);
export function kihnuRadius(y) {
  let j = 1;
  while (j < kihnuProfile.length - 1 && kihnuProfile[j][0] < y) j++;
  const [a, r] = kihnuProfile[j - 1],
    [b, s] = kihnuProfile[j];
  return r + ((s - r) * (y - a)) / (b - a);
}
const P = (r, y, a) => [r * Math.sin(a), y, r * Math.cos(a)];
const means = {
  metal: [0.908889, 0.908889, 0.908889],
  concrete: [0.710816, 0.710816, 0.681928],
  rubble: [0.527226, 0.504248, 0.457096],
  brick: [0.620345, 0.549823, 0.504963],
  wood: [0.825128, 0.825128, 0.825128],
  granite: [0.701109, 0.701109, 0.701109],
}; // Replaced by the checked, measured canonical graph means during authoring.
function makeTinted(out) {
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, p, n, uv, c) =>
        out[name](
          slot,
          ref,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[slot]?.[i] ?? 1)),
        ),
    ]),
  );
}
function graphicLine(out, a, u0, y0, u1, y1, width = 0.012) {
  const r = 1.379,
    dx = u1 - u0,
    dy = y1 - y0,
    l = Math.hypot(dx, dy),
    du = ((-dy / l) * width) / 2,
    dv = ((dx / l) * width) / 2;
  const at = (u, y) => P(r, y, a + u / 1.37),
    p = [at(u0 - du, y0 - dv), at(u1 - du, y1 - dv), at(u1 + du, y1 + dv), at(u0 + du, y0 + dv)];
  if (normalFor(...p.slice(0, 3)).reduce((n, v, i) => n + v * P(1, 0, a)[i], 0) < 0) p.reverse();
  quad(out, 'metal', p, normalFor(...p.slice(0, 3)), red);
}
function ports(out, district) {
  for (const h of kihnuPorts) {
    const a = h.angle,
      r = kihnuRadius(h.y) + 0.016,
      t = [Math.cos(a), 0, -Math.sin(a)],
      center = P(r, h.y, a),
      at = (x, y) => center.map((v, i) => v + t[i] * x + (i === 1 ? y : 0));
    const p = [at(0, -0.225), at(0.225, 0), at(0, 0.225), at(-0.225, 0)];
    quad(out, 'metal', p, P(1, 0, a), red);
    if (district)
      for (let i = 0; i < 8; i++) {
        const aa = (i * TAU) / 8,
          bb = ((i + 1) * TAU) / 8;
        out.addTriangle(
          'glass',
          'metric:uv',
          [
            P(r + 0.004, h.y, a),
            at(0.13 * Math.cos(aa), 0.13 * Math.sin(aa)).map((v, k) => v + P(0.004, 0, a)[k]),
            at(0.13 * Math.cos(bb), 0.13 * Math.sin(bb)).map((v, k) => v + P(0.004, 0, a)[k]),
          ],
          P(1, 0, a),
          [
            [0, 0],
            [Math.cos(aa), Math.sin(aa)],
            [Math.cos(bb), Math.sin(bb)],
          ],
          [0.1, 0.16, 0.17],
        );
      }
  }
}
function oilStore(out, district) {
  const o = transformed(out, 0.191, [2.655, 0, -11.765]);
  box(o, 'rubble', [-2.43, 0, -2.41], [2.43, 2.85, 2.41], [0.49, 0.45, 0.36]);
  for (const a of [0, Math.PI]) {
    const f = transformed(o, a),
      p = [
        [-2.43, 2.85, 2.41],
        [2.43, 2.85, 2.41],
        [0, 4.04, 2.41],
      ];
    f.addTriangle(
      'rubble',
      'metric:uv',
      p,
      [0, 0, 1],
      p.map((p) => [p[0], p[1]]),
      [0.5, 0.46, 0.38],
    );
  }
  for (const s of [-1, 1]) {
    const p = [
      [0, 4.13, -2.62],
      [s * 2.65, 2.86, -2.62],
      [s * 2.65, 2.86, 2.62],
      [0, 4.13, 2.62],
    ];
    if (normalFor(...p.slice(0, 3))[1] < 0) p.reverse();
    quad(o, 'metal', p, normalFor(...p.slice(0, 3)), [0.49, 0.075, 0.045]);
  }
  const f = transformed(o, Math.PI);
  box(f, 'wood', [-0.52, 0.26, 2.415], [0.52, 2.18, 2.42], [0.25, 0.25, 0.2]);
  if (district) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const f = transformed(o, a);
      box(f, 'brick', [-2.45, 2.68, 2.415], [2.45, 2.85, 2.445], [0.49, 0.16, 0.095]);
    }
    const w = transformed(o, Math.PI / 2);
    box(w, 'glass', [-0.375, 1.25, 2.415], [0.375, 2.15, 2.42], [0.1, 0.16, 0.17]);
  }
}
function lantern(out, n, district) {
  lathe(
    out,
    'metal',
    [
      [23.8, 1.68],
      [23.87, 1.68],
    ],
    black,
    n,
  );
  lathe(
    out,
    'glass',
    [
      [23.89, 1.365],
      [25.7, 1.365],
    ],
    [0.27, 0.39, 0.42],
    10,
  );
  for (let i = 0; i < 10; i++) {
    if (!district) {
      const a = (i * TAU) / 10;
      const at = (x, y) => P(1.377, y, a).map((v, k) => v + x * [Math.cos(a), 0, -Math.sin(a)][k]);
      quad(
        out,
        'metal',
        [at(-0.025, 23.86), at(0.025, 23.86), at(0.025, 25.73), at(-0.025, 25.73)],
        P(1, 0, a),
        [0.58, 0.57, 0.49],
      );
      continue;
    }
    tube(
      out,
      'metal',
      P(1.377, 23.86, (i * TAU) / 10),
      P(1.377, 25.73, (i * TAU) / 10),
      0.025,
      [0.58, 0.57, 0.49],
      4,
    );
  }
  lathe(
    out,
    'metal',
    [
      [25.69, 1.43],
      [25.76, 1.45],
    ],
    black,
    n,
  );
  const profile = [[25.76, 1.45]];
  const domeSteps = district ? 8 : 4;
  for (let i = 1; i <= domeSteps; i++) {
    const a = (i * Math.PI) / (2 * domeSteps);
    profile.push([25.76 + 1.08 * Math.sin(a), Math.max(0.12, 1.45 * Math.cos(a))]);
  }
  lathe(out, 'metal', profile, red, n);
  lathe(
    out,
    'metal',
    [
      [26.79, 0.22],
      [26.97, 0.115],
      [27.06, 0.16],
      [27.23, 0.23],
      [27.51, 0.03],
      [28.3, 0.017],
      [28.324, 0.002],
    ],
    black,
    8,
  );
  beam(out, 'metal', [-0.53, 28.03, 0], [0.54, 28.03, 0], 0.025, 0.018, black);
  box(out, 'metal', [-0.54, 27.88, -0.017], [-0.2, 28.18, 0.017], black);
  if (district)
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      for (let j = 1; j < 8; j++)
        tube(
          out,
          'metal',
          P(profile[j - 1][1] + 0.009, profile[j - 1][0], a),
          P(profile[j][1] + 0.009, profile[j][0], a),
          0.009,
          red.map((v) => v * 0.83),
          4,
        );
    }
}
function build(out, district) {
  const n = district ? 24 : 8;
  lathe(
    out,
    'concrete',
    [
      [0, 3.15],
      [0.14, 3.15],
      [0.22, 3.03],
    ],
    [0.28, 0.29, 0.26],
    n,
  );
  lathe(out, 'metal', kihnuProfile, white, n);
  ports(out, district);
  box(out, 'metal', [-0.47, 0.3, 2.77], [0.47, 2.21, 2.78], [0.16, 0.18, 0.16]);
  box(out, 'granite', [-0.68, 0, 2.21], [0.68, 0.15, 3.34], [0.45, 0.44, 0.4]);
  box(out, 'granite', [-0.62, 0.15, 2.21], [0.62, 0.3, 2.93], [0.52, 0.51, 0.47]);
  ring(out, 'metal', 21.84, 1.35, 2.5, 0.12, white, 8);
  ring(out, 'metal', 21.96, 1.32, 2.52, 0.055, black, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i * TAU) / 8,
      b = ((i + 1) * TAU) / 8;
    if (district) beam(out, 'metal', P(1.36, 20.65, a), P(2.48, 21.84, a), 0.14, 0.17, white);
    tube(out, 'metal', P(2.46, 21.96, a), P(2.46, 23.11, a), 0.04, red, 4);
    for (const y of district ? [22.02, 22.96] : [22.96])
      tube(out, 'metal', P(2.46, y, a), P(2.46, y, b), 0.023, y > 22.5 ? red : black, 4);
    if (district)
      for (let j = 1; j < 5; j++) {
        const p = P(2.46, 22.02, a),
          q = P(2.46, 22.02, b),
          s = p.map((v, k) => v + ((q[k] - v) * j) / 5);
        tube(out, 'metal', s, [s[0], 22.94, s[2]], 0.012, black, 4);
      }
  }
  lathe(
    out,
    'metal',
    [
      [21.97, 1.37],
      [23.8, 1.37],
    ],
    white,
    n,
  );
  if (district)
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) * TAU) / 8,
        w = 0.49,
        y0 = 22.07,
        y1 = 23.69;
      for (const [u0, v0, u1, v1] of [
        [-w, y0, -w, y1],
        [-w, y1, w, y1],
        [w, y1, w, y0],
        [w, y0, -w, y0],
        [0, 22.665, 0.13, 22.885],
        [0.13, 22.885, 0, 23.105],
        [0, 23.105, -0.13, 22.885],
        [-0.13, 22.885, 0, 22.665],
      ])
        graphicLine(out, a, u0, v0, u1, v1);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const yy = sy < 0 ? 22.14 : 23.62,
            xx = sx * (w - 0.04);
          for (const [u0, v0, u1, v1] of [
            [xx - sx * 0.025, yy, xx - sx * 0.025, yy + sy * 0.08],
            [xx - sx * 0.025, yy + sy * 0.08, xx - sx * 0.11, yy + sy * 0.08],
            [xx - sx * 0.11, yy + sy * 0.08, xx - sx * 0.11, yy],
            [xx - sx * 0.11, yy, xx - sx * 0.025, yy],
          ])
            graphicLine(out, a, u0, v0, u1, v1);
        }
    }
  lantern(out, n, district);
  oilStore(out, district);
}
export function buildKihnuSkyline(out) {
  build(makeTinted(out), false);
}
export function buildKihnuDistrict(out) {
  build(out, true);
}

export function buildKihnuStreet(out) {
  buildKihnuDetail(out, 0.12);
}
export function buildKihnuCloseup(out) {
  buildKihnuDetail(out, 0.48);
}
