/** Original picture-proportioned Ho Chi Minh Mausoleum exterior; no downloaded meshes. */
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  base: lin('737d79'),
  edge: lin('89928c'),
  pier: lin('a4aaa0'),
  red: lin('917e70'),
  joint: lin('58635e'),
  inner: lin('424c48'),
  wood: lin('795138'),
  panel: lin('956945'),
  roof: lin('979d92'),
};
export const mausoleumSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.86 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.8 },
};
const cfgs = {
  skyline: {},
  district: { courses: 1.35, panels: 4.5 },
  street: { courses: 0.86, panels: 2.8, fine: true },
  closeup: { courses: 0.86, panels: 2.1, fine: true, joints: true },
  master: { courses: 0.86, panels: 1.65, fine: true, joints: true, master: true },
};
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function T(o, c, p, s, col, N) {
  p = p.map((v) => v.map(Math.fround));
  if (Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) < 1e-8) return;
  let n = normalFor(...p);
  if (N && n.reduce((a, v, i) => a + v * N[i], 0) < 0) {
    p.reverse();
    n = normalFor(...p);
  }
  o.addTriangle(
    c === cfgs.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s, col, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'base', col = C.base) {
  const a = [x0, y0, z0],
    b = [x1, y0, z0],
    d = [x0, y0, z1],
    e = [x1, y0, z1],
    A = [x0, y1, z0],
    B = [x1, y1, z0],
    D = [x0, y1, z1],
    E = [x1, y1, z1];
  for (const [p, N] of [
    [
      [a, d, e, b],
      [0, -1, 0],
    ],
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [
      [d, D, E, e],
      [0, 0, 1],
    ],
    [
      [b, B, A, a],
      [0, 0, -1],
    ],
    [
      [a, A, D, d],
      [-1, 0, 0],
    ],
    [
      [e, E, B, b],
      [1, 0, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
function prism(o, c, ring, y0, y1, s = 'base', col = C.base) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const [y, N] of [
      [y0, [0, -1, 0]],
      [y1, [0, 1, 0]],
    ])
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]),
        s,
        col,
        N,
      );
  let area = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - a[1] * b[0];
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      c,
      [
        [...a.slice(0, 1), y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      s,
      col,
      area > 0 ? [b[1] - a[1], 0, a[0] - b[0]] : [a[1] - b[1], 0, b[0] - a[0]],
    );
  }
}
function bevel(o, c, lo, hi, y0, y1, s = 'stone', col = C.edge) {
  const ring = (b) => [
      [b[0], b[2]],
      [b[1], b[2]],
      [b[1], b[3]],
      [b[0], b[3]],
    ],
    a = ring(lo),
    b = ring(hi);
  for (const [r, y, N] of [
    [a, y0, [0, -1, 0]],
    [b, y1, [0, 1, 0]],
  ])
    Q(
      o,
      c,
      r.map((p) => [p[0], y, p[1]]),
      s,
      col,
      N,
    );
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      c,
      [
        [a[i][0], y0, a[i][1]],
        [a[j][0], y0, a[j][1]],
        [b[j][0], y1, b[j][1]],
        [b[i][0], y1, b[i][1]],
      ],
      s,
      col,
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
    );
  }
}
// Flush stone courses retain metric texture projection. These are joints, never dark window proxies.
function wallCourses(
  o,
  c,
  u0,
  u1,
  y0,
  y1,
  plane,
  axis = 'z',
  sign = 1,
  s = 'base',
  col = C.base,
  scale = 1,
) {
  if (!c.courses) return;
  const dy = c.courses * scale,
    du = c.panels * scale,
    N = axis === 'z' ? [0, 0, sign] : [sign, 0, 0],
    p = (u, y) => (axis === 'z' ? [u, y, plane] : [plane, y, u]),
    w = c.joints ? 0.014 : 0.024;
  for (let row = 0, y = y0; y < y1 - 0.01; y += dy, row++) {
    const top = Math.min(y1, y + dy);
    if (top < y1 - 0.01)
      Q(o, c, [p(u0, top - w), p(u1, top - w), p(u1, top + w), p(u0, top + w)], s, C.joint, N);
    for (let u = u0 + du * (row % 2 ? 0.5 : 1); u < u1 - 0.04; u += du)
      Q(
        o,
        c,
        [p(u - w, y + 0.025), p(u + w, y + 0.025), p(u + w, top - 0.025), p(u - w, top - 0.025)],
        s,
        C.joint,
        N,
      );
    if (c.master)
      for (let u = u0 + 0.04; u < u1 - 0.04; u += du) {
        const end = Math.min(u1 - 0.04, u + du - 0.08),
          shade = col.map(
            (v, k) => v * (0.985 + ((row + Math.floor(u * 2) + k + 1000) % 4) * 0.009),
          );
        Q(
          o,
          c,
          [p(u, y + 0.045), p(end, y + 0.045), p(end, top - 0.045), p(u, top - 0.045)],
          s,
          shade,
          N,
        );
      }
  }
}
function coursesBox(o, c, b, s = 'base', col = C.base) {
  const [x0, x1, y0, y1, z0, z1] = b;
  wallCourses(o, c, x0, x1, y0, y1, z1 + 0.006, 'z', 1, s, col);
  wallCourses(o, c, x0, x1, y0, y1, z0 - 0.006, 'z', -1, s, col);
  wallCourses(o, c, z0, z1, y0, y1, x0 - 0.006, 'x', -1, s, col);
  wallCourses(o, c, z0, z1, y0, y1, x1 + 0.006, 'x', 1, s, col);
}
function solid(o, c, b, s = 'base', col = C.base, joints = false) {
  box(o, c, ...b, s, col);
  if (joints) coursesBox(o, c, b, s, col);
}
export const mausoleumPlan = [
  [-16.7, -18.172],
  [16.703, -18.172],
  [16.703, 9.83],
  [20.676, 9.83],
  [20.676, 18.172],
  [-20.676, 18.172],
  [-20.676, 10.34],
  [-16.7, 10.34],
];
export const mausoleumPierParts = [
  {
    id: 35185465033093,
    outline: [
      [9.257025, 6.241756],
      [9.256031, 7.662759],
      [7.835029, 7.661765],
      [7.836023, 6.240762],
    ],
  },
  {
    id: 35185465033094,
    outline: [
      [5.813941, 6.075385],
      [5.86741, 7.769697],
      [4.446407, 7.768703],
      [4.392938, 6.074391],
    ],
  },
  {
    id: 35185465033095,
    outline: [
      [-1.291074, 6.070416],
      [-1.292068, 7.491419],
      [-2.713071, 7.490425],
      [-2.712077, 6.069422],
    ],
  },
  {
    id: 35185465033096,
    outline: [
      [2.152012, 6.236786],
      [2.151018, 7.657789],
      [0.730015, 7.656795],
      [0.731008, 6.235792],
    ],
  },
  {
    id: 35185465033097,
    outline: [
      [-8.6694, 6.119909],
      [-8.670394, 7.540912],
      [-10.091398, 7.539919],
      [-10.090404, 6.118915],
    ],
  },
  {
    id: 35185465033098,
    outline: [
      [-5.007468, 5.958508],
      [-5.28177, 7.433974],
      [-6.429465, 7.378518],
      [-6.428471, 5.957514],
    ],
  },
  {
    id: 35185465033099,
    outline: [
      [5.935787, -11.851038],
      [5.934793, -10.430035],
      [4.513791, -10.431029],
      [4.514784, -11.852032],
    ],
  },
  {
    id: 35185465033100,
    outline: [
      [2.219395, -11.962946],
      [2.218401, -10.541943],
      [0.797398, -10.542937],
      [0.798392, -11.96394],
    ],
  },
  {
    id: 35185465033101,
    outline: [
      [-1.169227, -11.856008],
      [-1.170221, -10.435005],
      [-2.591224, -10.435999],
      [-2.59023, -11.857002],
    ],
  },
  {
    id: 35185465033102,
    outline: [
      [-4.88562, -11.967916],
      [-4.886614, -10.546913],
      [-6.307617, -10.547907],
      [-6.306623, -11.96891],
    ],
  },
  {
    id: 35185465033103,
    outline: [
      [-8.602014, -12.079823],
      [-8.603008, -10.65882],
      [-10.024012, -10.659814],
      [-10.023018, -12.080817],
    ],
  },
  {
    id: 35185465033104,
    outline: [
      [9.37887, -11.684668],
      [9.377876, -10.263664],
      [7.956874, -10.264659],
      [7.957868, -11.685662],
    ],
  },
  {
    id: 35185465033105,
    outline: [
      [7.952899, -4.580646],
      [9.373901, -4.579652],
      [9.318445, -3.431957],
      [7.897442, -3.432951],
    ],
  },
  {
    id: 35185465033106,
    outline: [
      [8.064806, -8.297039],
      [9.485808, -8.296045],
      [9.484814, -6.875042],
      [8.063812, -6.876036],
    ],
  },
  {
    id: 35185465033107,
    outline: [
      [8.059837, -1.192024],
      [9.480839, -1.19103],
      [9.479845, 0.229973],
      [8.058843, 0.228979],
    ],
  },
  {
    id: 35185465033108,
    outline: [
      [7.94793, 2.524369],
      [9.368932, 2.525363],
      [9.367938, 3.946366],
      [7.946936, 3.945372],
    ],
  },
  {
    id: 35185465033109,
    outline: [
      [-10.027988, -4.975801],
      [-8.606984, -4.974808],
      [-8.607978, -3.553804],
      [-10.028982, -3.554798],
    ],
  },
  {
    id: 35185465033110,
    outline: [
      [-9.861617, -8.418887],
      [-8.440614, -8.417893],
      [-8.441608, -6.99689],
      [-9.862611, -6.997883],
    ],
  },
  {
    id: 35185465033111,
    outline: [
      [-10.139896, -1.259408],
      [-8.718892, -1.258414],
      [-8.719886, 0.162589],
      [-10.14089, 0.161595],
    ],
  },
  {
    id: 35185465033112,
    outline: [
      [-10.251804, 2.456985],
      [-8.557492, 2.403516],
      [-8.558486, 3.824519],
      [-10.252798, 3.877988],
    ],
  },
];
export const mausoleumPiers = mausoleumPierParts
  .slice(0, 6)
  .map((p) => p.outline.reduce((s, p) => s + p[0], 0) / p.outline.length)
  .sort((a, b) => a - b);
export function buildMausoleumLevel(o, level = 'master') {
  const c = cfgs[level];
  if (!c) throw Error('Unknown mausoleum tier ' + level);
  // Whole occupied T-shaped foundation; eight central steps and flanking terraces cover its front.
  prism(o, c, mausoleumPlan, -5, 0.8);
  solid(o, c, [-20.676, -7.5, 0.8, 3.05, 10.34, 18.172], 'base', C.base, true);
  solid(o, c, [7.5, 20.676, 0.8, 3.05, 9.83, 18.172], 'base', C.base, true);
  const floor = 2.6;
  for (let i = 0; i < 8; i++) {
    const z = 18.172 - i * (7.832 / 8),
      y = 1.52 + (i * (floor - 1.52)) / 7;
    box(o, c, -7.5, 7.5, 0.8, y, z - 7.832 / 8, z);
    if (c.fine) box(o, c, -7.5, 7.5, y - 0.055, y + 0.012, z - 0.12, z + 0.035, 'base', C.edge);
  }
  // Recess is cut from geometry, including closed jambs, soffit, floor and back wall.
  solid(o, c, [-16.7, -4.4, 0.8, 7.8, -18.172, 10.34], 'base', C.base, true);
  solid(o, c, [4.4, 16.703, 0.8, 7.8, -18.172, 10.34], 'base', C.base, true);
  solid(o, c, [-4.4, 4.4, 0.8, floor, -18.172, 10.34]);
  solid(o, c, [-4.4, 4.4, 5.5, 7.8, -18.172, 10.34], 'base', C.base, true);
  solid(o, c, [-4.4, 4.4, floor, 5.5, -18.172, 7.1], 'base', C.base, true);
  box(o, c, -4.4, 4.4, floor, 5.5, 7.1, 7.115, 'base', C.inner);
  box(o, c, -1.52, 1.52, floor, 5.02, 7.102, 7.18, 'door', C.wood);
  if (c.courses) {
    for (const x of [-1.54, 0, 1.54])
      box(o, c, x - 0.05, x + 0.05, floor, 5.08, 7.18, 7.25, 'door', C.panel);
    for (const y of [floor + 0.07, 3.37, 4.15, 4.98])
      box(o, c, -1.54, 1.54, y - 0.045, y + 0.045, 7.18, 7.25, 'door', C.panel);
  }
  if (c.fine)
    for (const x of [-0.77, 0.77])
      for (const y of [2.97, 3.76, 4.56]) {
        box(o, c, x - 0.57, x + 0.57, y - 0.24, y + 0.24, 7.181, 7.207, 'door', C.panel);
        if (c.joints)
          for (const a of [-0.57, 0.57])
            box(
              o,
              c,
              x + a - 0.018,
              x + a + 0.018,
              y - 0.25,
              y + 0.25,
              7.205,
              7.235,
              'door',
              C.wood,
            );
      }
  // Native parts resolve the 7.8m parent tag: terraces9.4/10.4m,piers18.25m,cap20.5m,roof20.9/21.6m.
  solid(o, c, [-14.065, 13.298, 7.8, 9.4, -15.289, 10.836], 'base', C.edge, true);
  solid(o, c, [-11.841, 11.566, 9.4, 10.4, -13.541, 8.921], 'base', C.base, true);
  box(o, c, -10.3, 9.8, 10.4, 10.55, -12.35, 8.05, 'stone', C.edge);
  solid(o, c, [-7.784078, 7.245876, 10.4, 18.25, -9.554654, 5.256455], 'stone', C.red, false);
  // Picture-guided closed backing returns cover the full end bays beyond the mapped core.
  box(o, c, -8.7, 8.0, 10.4, 18.25, 5.18, 5.256455, 'stone', C.red);
  box(o, c, -8.7, 8.1, 10.4, 18.25, -9.554654, -9.48, 'stone', C.red);
  box(o, c, -7.784078, -7.7, 10.4, 18.25, -10.65, 6.25, 'stone', C.red);
  box(o, c, 7.16, 7.245876, 10.4, 18.25, -10.65, 6.25, 'stone', C.red);
  // End-pier returns close oblique sightlines between each corner pier and the core backing.
  box(o, c, -10.1, -8.66, 10.4, 18.25, 5.18, 7.55, 'stone', C.pier);
  box(o, c, 7.83, 9.49, 10.4, 18.25, 5.18, 7.77, 'stone', C.pier);
  box(o, c, -10.03, -8.6, 10.4, 18.25, -12.1, -9.48, 'stone', C.pier);
  box(o, c, 7.83, 9.49, 10.4, 18.25, -11.69, -9.48, 'stone', C.pier);
  for (const part of mausoleumPierParts) {
    prism(o, c, part.outline, 10.4, 18.25, 'stone', C.pier);
    if (c.courses) {
      const r = part.outline,
        area = r.reduce((s, a, i) => {
          const b = r[(i + 1) % r.length];
          return s + a[0] * b[1] - a[1] * b[0];
        }, 0);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          L = Math.hypot(dx, dz),
          N = area > 0 ? [dz / L, 0, -dx / L] : [-dz / L, 0, dx / L],
          P = (t, y) => [a[0] + dx * t + N[0] * 0.006, y, a[1] + dz * t + N[2] * 0.006];
        for (let y = 10.4 + c.courses; y < 18.24; y += c.courses)
          Q(
            o,
            c,
            [P(0, y - 0.012), P(1, y - 0.012), P(1, y + 0.012), P(0, y + 0.012)],
            'stone',
            C.joint,
            N,
          );
        if (c.master)
          for (let y = 10.43; y < 18.22; y += c.courses)
            Q(
              o,
              c,
              [
                P(0.025, y),
                P(0.975, y),
                P(0.975, Math.min(18.22, y + c.courses - 0.06)),
                P(0.025, Math.min(18.22, y + c.courses - 0.06)),
              ],
              'stone',
              C.pier.map((v) => v * 1.008),
              N,
            );
      }
    }
  }
  if (c.fine) {
    wallCourses(o, c, -7.78, 7.24, 10.45, 18.23, 5.263455, 'z', 1, 'stone', C.red, 1.5);
    wallCourses(o, c, -7.78, 7.24, 10.45, 18.23, -9.561654, 'z', -1, 'stone', C.red, 1.5);
    wallCourses(o, c, -9.55, 5.25, 10.45, 18.23, -7.791078, 'x', -1, 'stone', C.red, 1.5);
    wallCourses(o, c, -9.55, 5.25, 10.45, 18.23, 7.252876, 'x', 1, 'stone', C.red, 1.5);
  }
  // Closed shallow flared cap,smaller roof slab andraised central top. No copied inscription.
  const cap = [-10.091398, 9.37887, -11.807509, 7.662759],
    bottom = [cap[0] + 0.6, cap[1] - 0.6, cap[2] + 0.6, cap[3] - 0.6];
  box(o, c, bottom[0], bottom[1], 18.25, 18.45, bottom[2], bottom[3], 'stone', C.edge);
  bevel(o, c, bottom, cap, 18.45, 20.5, 'stone', C.pier);
  solid(o, c, [-8.723863, 7.956874, 20.5, 20.9, -10.385512, 5.967454], 'stone', C.edge, true);
  solid(o, c, [-6.809711, 5.988262, 20.9, 21.6, -8.74467, 4.053303], 'stone', C.roof, true);
  if (c.fine) {
    for (const x of [-9, -6, -3, 0, 3, 6, 9]) {
      const X = ((x + 0.356264) * 9.735134) / 9.135134 - 0.356264;
      Q(
        o,
        c,
        [
          [x - 0.012, 18.46, 7.074],
          [x + 0.012, 18.46, 7.074],
          [X + 0.012, 20.49, 7.668],
          [X - 0.012, 20.49, 7.668],
        ],
        'stone',
        C.joint,
        [0, 0, 1],
      );
    }
    const y = 19.48,
      t = (y - 18.45) / (20.5 - 18.45),
      z = 7.062759 + 0.6 * t + 0.008,
      x0 = bottom[0] - 0.6 * t,
      x1 = bottom[1] + 0.6 * t;
    Q(
      o,
      c,
      [
        [x0, y - 0.012, z],
        [x1, y - 0.012, z],
        [x1, y + 0.012, z],
        [x0, y + 0.012, z],
      ],
      'stone',
      C.joint,
      [0, 0, 1],
    );
  }
}
export const buildMausoleumSkyline = (o) => buildMausoleumLevel(o, 'skyline');
export const buildMausoleumDistrict = (o) => buildMausoleumLevel(o, 'district');
export const buildMausoleumStreet = (o) => buildMausoleumLevel(o, 'street');
export const buildMausoleumCloseup = (o) => buildMausoleumLevel(o, 'closeup');
