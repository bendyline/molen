/** Ivan Martos's paired bronzes, modeled from the Red Square sculpture and relief photographs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.65, metallic: 0.31 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.78 },
};
const colors = {
  bronze: '6b8177',
  patina: '7b9588',
  deep: '4f665e',
  recess: '48544d',
  edge: '8a9e8f',
  granite: 'b47e69',
  rim: 'c2927c',
  base: 'aa7c68',
  apron: 'bcb2a3',
  mortar: 'a29385',
  gold: 'd7b47c',
};
const rgb = Object.fromEntries(
  Object.entries(colors).map(([k, h]) => [
    k,
    h.match(/../g).map((p) => {
      const c = parseInt(p, 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  TAU = 2 * Math.PI;
const Y = layout.statueBase,
  D = layout.deck,
  up = [0, 1, 0],
  down = [0, -1, 0],
  front = [0, 0, 1];
const identity = (p) => p;
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t;
const average = (ps) => ps[0].map((_, i) => ps.reduce((n, p) => n + p[i], 0) / ps.length);

function tri(out, slot, tint, ps, direction) {
  let n = normalFor(...ps);
  if (Math.hypot(...n) < 0.99) return;
  if (dot(n, direction) < 0) {
    ps = ps.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', ps, n, undefined, rgb[tint]);
}
function quad(out, slot, tint, [a, b, c, d], direction) {
  tri(out, slot, tint, [a, b, c], direction);
  tri(out, slot, tint, [a, c, d], direction);
}
function skin(out, slot, tint, rings) {
  const N = rings[0].length,
    centers = rings.map(average);
  for (let j = 0; j + 1 < rings.length; j++)
    for (let k = 0; k < N; k++) {
      const i = (k + 1) % N;
      const ps = [rings[j][k], rings[j][i], rings[j + 1][i], rings[j + 1][k]];
      quad(out, slot, tint, ps, sub(average(ps), average([centers[j], centers[j + 1]])));
    }
  for (const [j, k] of [
    [0, 1],
    [rings.length - 1, rings.length - 2],
  ]) {
    const n = sub(centers[j], centers[k]);
    for (let i = 0; i < N; i++)
      tri(out, slot, tint, [centers[j], rings[j][i], rings[j][(i + 1) % N]], n);
  }
}
const sideCount = [4, 6, 8, 12, 16];
function sections(out, P, rows, d, tint = 'bronze', folds = 0) {
  const N = sideCount[d];
  skin(
    out,
    'bronze',
    tint,
    rows.map(([y, x, z, rx, rz], j) =>
      Array.from({ length: N }, (_, i) => {
        const a = (i * TAU) / N;
        const r = 1 + folds * (Math.sin(3 * a + 0.48 * j) + 0.42 * Math.cos(5 * a - j * 0.75));
        return P([x + rx * r * Math.cos(a), y, z - rz * r * Math.sin(a)]);
      }),
    ),
  );
}
function limb(out, ps, d, tint = 'bronze', P = identity) {
  const N = sideCount[d],
    centers = ps.map(([x, y, z]) => P([x, y, z]));
  let u;
  const rings = centers.map((center, i) => {
    const axis = normalize(
      sub(centers[Math.min(i + 1, centers.length - 1)], centers[Math.max(i - 1, 0)]),
    );
    if (u) {
      const offset = dot(u, axis);
      const projection = u.map((v, k) => v - offset * axis[k]);
      u = Math.hypot(...projection) > 0.05 ? normalize(projection) : undefined;
    }
    u ??= normalize(cross(axis, Math.abs(axis[1]) > 0.92 ? [1, 0, 0] : up));
    const v = normalize(cross(axis, u)),
      r = ps[i][3],
      s = ps[i][4] ?? r;
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N;
      return center.map((c, k) => c + u[k] * r * Math.cos(a) + v[k] * s * Math.sin(a));
    });
  });
  skin(out, 'bronze', tint, rings);
}
function local(origin, yaw) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return ([x, y, z]) => [origin[0] + x * c + z * s, origin[1] + y, origin[2] - x * s + z * c];
}
function blob(out, c, r, d, tint = 'bronze', slot = 'bronze') {
  sphere(out, slot, c, r, rgb[tint], [4, 6, 8, 12, 16][d], [3, 4, 6, 8, 10][d]);
}
function rectangular(out, slot, tint, rows, x = 0, z = 0) {
  const ring = ([y, a, b]) => [
    [x - a, y, z - b],
    [x + a, y, z - b],
    [x + a, y, z + b],
    [x - a, y, z + b],
  ];
  skin(out, slot, tint, rows.map(ring));
}
function box(out, slot, tint, center, half) {
  const [x, y, z] = center,
    [w, h, l] = half;
  rectangular(
    out,
    slot,
    tint,
    [
      [y - h, w, l],
      [y + h, w, l],
    ],
    x,
    z,
  );
}
function pedestal(out, d) {
  const layers =
    d === 0 ? layout.stone.filter((_, i) => [0, 3, 6, 8, 9, 13, 15].includes(i)) : layout.stone;
  for (let i = 1; i < layers.length; i++) {
    const band = [layers[i - 1], layers[i]].map(([y, x, z]) => [D + y, x, z]);
    const A = band[0],
      B = band[1];
    const ring = ([y, x, z]) => [
      [-x, y, -z],
      [x, y, -z],
      [x, y, z],
      [-x, y, z],
    ];
    const a = ring(A),
      b = ring(B);
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) % 4;
      quad(
        out,
        'granite',
        i < 3 ? 'base' : i >= layers.length - 6 ? 'rim' : 'granite',
        [a[k], a[j], b[j], b[k]],
        [
          [0, 0, -1],
          [1, 0, 0],
          [0, 0, 1],
          [-1, 0, 0],
        ][k],
      );
    }
  }
  const [, X, Z] = layers.at(-1);
  quad(
    out,
    'granite',
    'rim',
    [
      [-X, layout.bronzeBottom, -Z],
      [X, layout.bronzeBottom, -Z],
      [X, layout.bronzeBottom, Z],
      [-X, layout.bronzeBottom, Z],
    ],
    up,
  );
  rectangular(out, 'bronze', 'deep', [
    [layout.bronzeBottom, 2.32, 1.23],
    [Y, 2.32, 1.23],
  ]);
  rectangular(out, 'granite', 'apron', [
    [D - 0.32, 3.48, 1.98],
    [D - 0.015, 3.48, 1.98],
  ]);
  if (d > 1) {
    for (const x of [-1.57, 0, 1.57]) {
      for (const s of [-1, 1])
        box(out, 'granite', 'mortar', [x, D + 0.408, s * 1.6505], [0.01, 0.156, 0.004]);
    }
    for (const s of [-1, 1])
      box(out, 'granite', 'mortar', [s * 3.071, D + 0.408, 0], [0.005, 0.156, 0.01]);
  }
}

function head(out, at, yaw, d, kind) {
  const P = local(at, yaw),
    q = kind === 'minin' ? 1 : 0.94;
  const Q = ([x, y, z]) => P([x * q, y, z]);
  const rows = [
    [-0.295, 0, -0.006, 0.113, 0.093],
    [-0.236, 0, 0.032, 0.151, 0.132],
    [-0.151, 0, 0.022, 0.185, 0.166],
    [-0.064, 0, 0.006, 0.183, 0.172],
    [0.035, 0, -0.009, 0.185, 0.167],
    [0.128, 0, -0.026, 0.164, 0.158],
    [0.2, 0, -0.045, 0.103, 0.115],
    [0.221, 0, -0.049, 0.04, 0.053],
  ];
  sections(out, Q, d < 2 ? rows.filter((_, i) => [0, 2, 4, 6, 7].includes(i)) : rows, d, 'bronze');
  sections(
    out,
    Q,
    [
      [-0.067, 0, -0.075, 0.185, 0.129],
      [0.055, 0, -0.058, 0.194, 0.15],
      [0.151, 0, -0.05, 0.157, 0.153],
      [0.219, 0, -0.047, 0.075, 0.091],
    ],
    d,
    'deep',
    0.066,
  );
  if (d === 0) return;
  const a = Q([-0.043, -0.146, 0.174]),
    b = Q([0.048, -0.147, 0.174]),
    n = Q([0, -0.112, 0.248]),
    k = Q([0, 0.005, 0.165]);
  const f = Q([0, 0, 1]).map((v, i) => v - at[i]);
  tri(out, 'bronze', 'patina', [a, b, n], f);
  tri(out, 'bronze', 'bronze', [a, n, k], f);
  tri(out, 'bronze', 'bronze', [b, k, n], f);
  sections(
    out,
    Q,
    [
      [-0.304, 0, 0.063, 0.081, 0.102],
      [-0.233, 0, 0.099, 0.129, 0.108],
      [-0.154, 0, 0.103, 0.15, 0.071],
    ],
    d,
    'deep',
    0.12,
  );
  if (d < 2) return;
  for (const s of [-1, 1]) {
    blob(out, Q([s * 0.179, -0.085, -0.003]), [0.035, 0.063, 0.04], d - 1, 'bronze');
    limb(
      out,
      [
        [s * 0.023, 0.017, 0.171, 0.017],
        [s * 0.086, 0.024, 0.162, 0.021],
        [s * 0.14, 0.006, 0.125, 0.011],
      ],
      1,
      'deep',
      Q,
    );
    limb(
      out,
      [
        [s * 0.016, -0.183, 0.189, 0.012],
        [s * 0.061, -0.173, 0.183, 0.016],
        [s * 0.104, -0.201, 0.15, 0.01],
      ],
      1,
      'deep',
      Q,
    );
  }
  if (d >= 3) {
    const N = d === 3 ? 13 : 20;
    for (let i = 0; i < N; i++) {
      const a = (TAU * i) / N,
        y = 0.085 + 0.023 * Math.sin(3 * a);
      const ps = Array.from({ length: 5 }, (_, j) => {
        const t = j / 4,
          phi = a + 0.18 * t,
          r = 0.158 + 0.026 * Math.sin(Math.PI * t);
        return Q([Math.cos(phi) * r, y + 0.117 * t, -0.045 + Math.sin(phi) * r]);
      });
      tubePath(out, 'bronze', ps, 0.021, rgb[i % 4 === 0 ? 'patina' : 'deep'], 5);
    }
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.032;
      tubePath(
        out,
        'bronze',
        [Q([x, -0.189, 0.186]), Q([x * 0.9, -0.238, 0.2]), Q([x * 0.65, -0.284, 0.161])],
        0.012,
        rgb.bronze,
        4,
      );
    }
  }
}

function raisedHand(out, c, d) {
  blob(out, c, [0.115, 0.105, 0.077], Math.min(d, 2), 'bronze');
  if (d === 0) {
    const top = add(c, [0.02, 0.195, 0.013]);
    tube(out, 'bronze', c, top, 0.063, rgb.patina, 4);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const x = (i - 1.5) * 0.05,
      y = 0.179 + 0.041 * Math.sin((i * Math.PI) / 3);
    limb(
      out,
      [
        [c[0] + x, c[1] + 0.047, c[2], 0.029],
        [c[0] + x * 1.29, c[1] + y * 0.76, c[2] - 0.013, 0.024],
        [c[0] + x * 1.44, c[1] + y, c[2] - 0.052, 0.017],
      ],
      d > 2 ? 2 : 1,
      'bronze',
    );
  }
  limb(
    out,
    [
      [c[0] + 0.077, c[1] - 0.019, c[2] + 0.011, 0.036],
      [c[0] + 0.16, c[1] + 0.03, c[2] + 0.018, 0.028],
      [c[0] + 0.204, c[1] + 0.062, c[2] + 0.005, 0.022],
    ],
    d > 2 ? 2 : 1,
    'patina',
  );
}
function grippingHand(out, c, d, orientation = 1) {
  blob(out, c, [0.119, 0.126, 0.095], Math.min(d, 2), 'bronze');
  if (d < 2) return;
  for (let i = 0; i < 4; i++) {
    const y = (i - 1.5) * 0.046;
    limb(
      out,
      [
        [c[0] - 0.07 * orientation, c[1] + y, c[2] + 0.055, 0.029],
        [c[0] + 0.02 * orientation, c[1] + y - 0.013, c[2] + 0.099, 0.023],
        [c[0] + 0.081 * orientation, c[1] + y - 0.037, c[2] + 0.046, 0.017],
      ],
      1,
      'patina',
    );
  }
}
function drape(out, rows, d, tint) {
  const n = d < 2 ? 5 : d === 2 ? 8 : d === 3 ? 13 : 19;
  const at = (r, i) => {
    const t = i / n,
      [left, right] = rows[r];
    return left.map(
      (v, k) =>
        mix(v, right[k], t) +
        (k === 2 ? 0.084 * Math.sin(t * TAU * 3 + r * 0.56) * Math.sin(Math.PI * t) : 0),
    );
  };
  for (let r = 0; r + 1 < rows.length; r++)
    for (let i = 0; i < n; i++) {
      const a = at(r, i),
        b = at(r, i + 1),
        c = at(r + 1, i + 1),
        e = at(r + 1, i);
      quad(out, 'bronze', i % 4 === 0 && d > 1 ? 'patina' : tint, [a, b, c, e], front);
      quad(
        out,
        'bronze',
        'deep',
        [a, b, c, e].map((p) => add(p, [0, 0, -0.034])),
        [0, 0, -1],
      );
      if (i === 0 || i === n - 1) {
        const A = i === 0 ? a : b,
          B = i === 0 ? e : c;
        quad(
          out,
          'bronze',
          'deep',
          [A, B, add(B, [0, 0, -0.034]), add(A, [0, 0, -0.034])],
          [i === 0 ? -1 : 1, 0, 0],
        );
      }
    }
}

function figures(out, d) {
  const B = (x, y, z) => [x, Y + y, z],
    lim = (a, tint = 'bronze') =>
      limb(
        out,
        a.map(([x, y, z, r, s]) => [x, Y + y, z, r, s]),
        d,
        tint,
      );
  // Minin bears his weight on the far leg and raises the open hand above the head.
  lim([
    [-1.17, 1.22, -0.13, 0.205],
    [-1.31, 0.67, -0.07, 0.144],
    [-1.36, 0.12, -0.08, 0.096],
  ]);
  lim([
    [-0.75, 1.31, 0.02, 0.238],
    [-0.7, 0.69, 0.25, 0.156],
    [-0.57, 0.095, 0.46, 0.099],
  ]);
  blob(out, B(-1.38, 0.083, 0.07), [0.145, 0.079, 0.247], Math.min(d, 2), 'deep');
  blob(out, B(-0.55, 0.085, 0.58), [0.15, 0.084, 0.242], Math.min(d, 2));
  sections(
    out,
    identity,
    [
      [Y + 1.15, -1.03, 0.0, 0.49, 0.28],
      [Y + 1.34, -1.01, 0.019, 0.524, 0.318],
      [Y + 1.82, -0.98, 0.012, 0.405, 0.274],
      [Y + 2.09, -0.94, -0.035, 0.37, 0.248],
      [Y + 2.47, -0.89, -0.037, 0.437, 0.289],
      [Y + 2.94, -0.9, -0.075, 0.517, 0.278],
      [Y + 3.14, -0.89, -0.04, 0.37, 0.205],
      [Y + 3.24, -0.84, -0.009, 0.142, 0.141],
    ].filter((_, i) => d > 0 || [0, 2, 3, 5, 7].includes(i)),
    d,
    'bronze',
    d === 0 ? 0.035 : 0.12,
  );
  lim([
    [-0.85, 3.04, -0.01, 0.142],
    [-0.83, 3.28, 0.02, 0.126],
    [-0.83, 3.46, 0.038, 0.127],
  ]);
  lim([
    [-1.25, 2.97, -0.016, 0.208],
    [-1.59, 3.25, 0.031, 0.174],
    [-1.79, 3.61, 0.162, 0.133],
    [-1.9, 4.0, 0.348, 0.079],
  ]);
  lim([
    [-0.46, 2.95, -0.01, 0.192],
    [-0.28, 2.47, 0.13, 0.152],
    [-0.043, 2.45, 0.282, 0.114],
    [0.194, 2.55, 0.377, 0.081],
  ]);
  head(out, B(-0.79, 3.57, 0.055), 0.48, d, 'minin');
  raisedHand(out, layout.hands.minin.raised, d);
  grippingHand(out, layout.hands.minin.sword, d, -1);
  if (d > 0) {
    drape(
      out,
      [
        [B(-1.06, 2.87, 0.206), B(-0.74, 3.12, 0.188)],
        [B(-0.93, 2.51, 0.289), B(-0.67, 2.68, 0.226)],
        [B(-0.76, 2.12, 0.288), B(-0.49, 2.28, 0.222)],
        [B(-0.76, 1.73, 0.321), B(-0.44, 1.79, 0.226)],
        [B(-1.17, 1.28, 0.255), B(-0.61, 1.2, 0.274)],
      ],
      d,
      'bronze',
    );
    drape(
      out,
      [
        [B(-0.47, 2.85, -0.192), B(-0.19, 2.43, 0.211)],
        [B(-0.47, 2.29, -0.259), B(-0.07, 2.19, 0.098)],
        [B(-0.58, 1.68, -0.253), B(-0.09, 1.62, 0.105)],
        [B(-0.73, 0.89, -0.267), B(-0.33, 0.77, 0.182)],
      ],
      d,
      'deep',
    );
    tubePath(
      out,
      'bronze',
      [B(-1.24, 2.054, 0.158), B(-1.08, 2.03, 0.253), B(-0.79, 2.07, 0.27), B(-0.57, 2.09, 0.175)],
      0.032,
      rgb.edge,
      6,
    );
  }

  // Pozharsky's pelvis stays on the seat. Both knees and the supporting shield are forward.
  box(out, 'bronze', 'deep', B(0.94, 0.51, -0.44), [0.466, 0.51, 0.384]);
  lim([
    [0.85, 0.98, -0.04, 0.34],
    [0.31, 0.79, 0.54, 0.263],
    [-0.17, 0.77, 0.65, 0.174],
  ]);
  lim([
    [-0.17, 0.78, 0.65, 0.173],
    [-0.54, 0.46, 0.72, 0.125],
    [-0.97, 0.11, 0.75, 0.075],
  ]);
  blob(out, B(-1.1, 0.086, 0.85), [0.22, 0.085, 0.155], Math.min(d, 2), 'patina');
  lim([
    [0.89, 1.0, 0.094, 0.343],
    [0.54, 0.83, 0.71, 0.274],
    [0.39, 0.62, 0.96, 0.166],
  ]);
  lim([
    [0.4, 0.65, 0.95, 0.162],
    [0.82, 0.38, 1.05, 0.138],
    [1.23, 0.105, 1.09, 0.08],
  ]);
  blob(out, B(1.27, 0.081, 1.135), [0.163, 0.076, 0.16], Math.min(d, 2), 'patina');
  sections(
    out,
    identity,
    [
      [Y + 0.79, 0.93, -0.12, 0.446, 0.338],
      [Y + 1.16, 0.97, -0.119, 0.402, 0.35],
      [Y + 1.42, 1.14, -0.154, 0.375, 0.293],
      [Y + 1.78, 1.22, -0.143, 0.383, 0.286],
      [Y + 2.16, 1.22, -0.163, 0.484, 0.302],
      [Y + 2.38, 1.14, -0.111, 0.286, 0.225],
      [Y + 2.49, 1.08, -0.045, 0.133, 0.132],
    ].filter((_, i) => d > 0 || [0, 1, 3, 4, 6].includes(i)),
    d,
    'bronze',
    d > 0 ? 0.09 : 0,
  );
  lim([
    [1.09, 2.34, -0.046, 0.146],
    [1.04, 2.64, -0.018, 0.116],
    [1.03, 2.79, 0.026, 0.115],
  ]);
  lim([
    [0.77, 2.2, -0.045, 0.187],
    [0.46, 2.2, 0.09, 0.147],
    [0.23, 2.62, 0.249, 0.11],
    [0.21, 2.98, 0.355, 0.078],
  ]);
  lim([
    [1.51, 2.22, -0.064, 0.188],
    [1.68, 1.81, 0.198, 0.153],
    [1.74, 1.55, 0.671, 0.107],
    [1.71, 1.47, 1.036, 0.074],
  ]);
  head(out, B(0.99, 2.8, 0.035), -0.57, d, 'poz');
  grippingHand(out, layout.hands.poz.sword, d);
  grippingHand(out, layout.hands.poz.shield, d);
  if (d > 0) {
    drape(
      out,
      [
        [B(0.5, 2.32, 0.061), B(1.18, 2.47, 0.027)],
        [B(0.53, 1.97, 0.289), B(1.45, 2.08, 0.053)],
        [B(0.75, 1.52, 0.25), B(1.57, 1.74, 0.089)],
        [B(0.55, 1.17, 0.405), B(1.45, 1.44, 0.115)],
        [B(0.24, 0.72, 0.846), B(1.29, 1.02, 0.425)],
      ],
      d,
      'bronze',
    );
    drape(
      out,
      [
        [B(0.7, 2.21, -0.216), B(1.53, 2.26, -0.272)],
        [B(0.54, 1.94, -0.324), B(1.62, 1.82, -0.393)],
        [B(0.49, 1.35, -0.353), B(1.55, 1.35, -0.486)],
        [B(0.26, 0.34, -0.365), B(1.66, 0.31, -0.516)],
      ],
      d,
      'deep',
    );
  }
}

function swordAndShield(out, d) {
  const { hilt, blade, guard } = layout.sword;
  const grip = add(hilt, [0, 0.23, 0]);
  const n = d === 0 ? 6 : sideCount[d];
  const h = (f, w) => [
    mix(blade[0], guard[0], f),
    mix(blade[1], guard[1], f),
    mix(blade[2], guard[2], f),
    w,
    w * 0.56,
  ];
  limb(
    out,
    [h(0, 0.03), h(0.07, 0.087), h(0.96, 0.109), h(1, 0.102)],
    Math.max(0, d - 1),
    'patina',
  );
  tube(out, 'bronze', hilt, grip, 0.063, rgb.deep, n);
  beam(
    out,
    'bronze',
    add(guard, [-0.185, 0.02, 0]),
    add(guard, [0.185, 0.02, 0]),
    0.104,
    0.092,
    rgb.patina,
  );
  blob(out, grip, [0.089, 0.074, 0.064], Math.min(d, 2), 'patina');
  if (d > 1) {
    for (let i = 0; i < 6; i++) {
      const f = 0.13 + 0.122 * i,
        p = h(f, 0);
      tubePath(
        out,
        'bronze',
        [
          [p[0] - 0.056, p[1] + 0.041, p[2] + 0.061],
          [p[0], p[1] - 0.002, p[2] + 0.066],
          [p[0] + 0.058, p[1] + 0.041, p[2] + 0.061],
        ],
        0.012,
        rgb.edge,
        5,
      );
    }
  }
  const shield = layout.shield,
    P = local(shield.center, shield.yaw);
  const at = (a, r, z) => P([Math.cos(a) * r, Math.sin(a) * r, z + Math.sin(a) * r * shield.tilt]);
  const N = [8, 14, 24, 32, 48][d],
    r = shield.radius;
  for (let i = 0; i < N; i++) {
    const a = (i * TAU) / N,
      b = ((i + 1) * TAU) / N,
      A = at(a, r, 0),
      B = at(b, r, 0);
    tri(out, 'bronze', 'deep', [P([0, 0, 0.097]), A, B], front);
    quad(out, 'bronze', 'bronze', [A, at(a, r, -0.08), at(b, r, -0.08), B], sub(A, shield.center));
    tri(out, 'bronze', 'deep', [P([0, 0, -0.098]), at(b, r, -0.08), at(a, r, -0.08)], [0, 0, -1]);
  }
  if (d > 0) {
    for (const R of [r - 0.035, 0.49])
      tubePath(
        out,
        'bronze',
        Array.from({ length: N }, (_, i) => at((i * TAU) / N, R, 0.04)),
        d === 1 ? 0.022 : 0.027,
        rgb.patina,
        5,
        true,
      );
    blob(out, P([0, -0.003, 0.106]), [0.22, 0.257, 0.087], Math.min(2, d), 'bronze');
  }
  if (d > 1) {
    head(out, P([0, 0.03, 0.152]), shield.yaw, 1, 'poz');
    for (const s of [-1, 1])
      tubePath(
        out,
        'bronze',
        [P([s * 0.211, -0.193, 0.112]), P([s * 0.234, 0.117, 0.111]), P([s * 0.174, 0.26, 0.114])],
        0.022,
        rgb.patina,
        5,
      );
    const petals = d === 2 ? 10 : 18;
    for (let i = 0; i < petals; i++) {
      const a = (i * TAU) / petals;
      tubePath(
        out,
        'bronze',
        [
          [a - 0.07, 0.579],
          [a, 0.63],
          [a + 0.07, 0.579],
          [a, 0.533],
        ].map(([t, r]) => at(t, r, 0.066)),
        0.014,
        rgb.edge,
        4,
        true,
      );
    }
  }
}

// Capital lettering in the two observed lines. Strokes remain model geometry at close range.
const glyph = {
  А: ['003960', '1555'],
  Б: ['690900', '054564614000'],
  В: ['00094968664505', '054563614000'],
  Г: ['000969'],
  Д: ['0001031529596353536360'],
  Е: ['69090060', '0454'],
  Ж: ['093460', '693400', '3930'],
  З: ['0868674535', '456361400100'],
  И: ['09006960'],
  І: ['3930'],
  К: ['0900', '690460'],
  Л: ['0019285960'],
  М: ['0009346960'],
  Н: ['0900', '6960', '0565'],
  О: ['1040616719090210'],
  П: ['00096960'],
  Р: ['00094968664505'],
  С: ['6769190702104062'],
  Т: ['0969', '3930'],
  У: ['0934', '6910'],
  Ю: ['0900', '0535', '204062672929272220'],
  Я: ['6069190705194565', '3500'],
  Ѣ: ['0929', '2919', '10154564614010'],
  1: ['163930', '1050'],
  8: ['10406163450507194967664505030110'],
  '.': ['2120'],
};
function lettering(out) {
  for (const [i, text] of layout.inscription.entries()) {
    const h = i === 0 ? 0.125 : 0.157,
      w = i === 0 ? 0.105 : 0.116,
      advance = w * 1.11;
    let x = (-advance * (text.length - 1)) / 2 - w * 0.45;
    const y = D + (i === 0 ? 3.115 : 2.92),
      z = 1.326;
    for (const c of text) {
      if (c !== ' ' && !Object.hasOwn(glyph, c)) throw Error('Missing pedestal letter ' + c);
      for (const line of glyph[c] ?? []) {
        const nodes = line
          .match(/../g)
          .map(([a, b]) => [x + (w * Number(a)) / 6, y + (h * Number(b)) / 9, z]);
        for (let k = 1; k < nodes.length; k++) {
          const a = nodes[k - 1],
            b = nodes[k],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            n = Math.hypot(dx, dy);
          if (n < 1e-6) continue;
          const U = [(-dy * 0.005) / n, (dx * 0.005) / n, 0];
          quad(out, 'bronze', 'gold', [add(a, U), add(b, U), sub(b, U), sub(a, U)], front);
        }
      }
      x += advance;
    }
  }
}

function relief(out, d, sign) {
  const P = (x, y, z) => [sign * x, D + 1.435 + y, sign * (1.325 + z)];
  const reliefBox = (x, y, z, a, b, c, tint) => box(out, 'bronze', tint, P(x, y, z), [a, b, c]);
  reliefBox(0, 0.667, 0, 1.8, 0.667, 0.022, 'recess');
  if (d === 0) return;
  const band = [
    [
      [-1.78, 0.034, 0.04],
      [1.78, 0.034, 0.04],
    ],
    [
      [-1.78, 1.302, 0.04],
      [1.78, 1.302, 0.04],
    ],
    [
      [-1.78, 0.034, 0.04],
      [-1.78, 1.302, 0.04],
    ],
    [
      [1.78, 0.034, 0.04],
      [1.78, 1.302, 0.04],
    ],
  ];
  for (const [a, b] of band) tube(out, 'bronze', P(...a), P(...b), 0.022, rgb.deep, 4);
  const person = ({ x, y = 0, h, tilt = 0, kneel = false, gesture = 1, helmet = false }) => {
    const at = (u, v, r) => P(x + u * h + tilt * v, y + v * h, r);
    const center = (v, r) => at(0, v, r);
    const rings = [
      [0.11, 0.113, 0.036],
      [0.45, 0.106, 0.067],
      [0.74, 0.141, 0.062],
      [0.8, 0.063, 0.039],
    ];
    const n = d < 3 ? 4 : 6;
    skin(
      out,
      'bronze',
      kneel ? 'deep' : 'bronze',
      rings.map(([v, w, r]) =>
        Array.from({ length: n }, (_, i) => {
          const a = (i * TAU) / n;
          return at(w * Math.cos(a), v, r - 0.048 * Math.sin(a));
        }),
      ),
    );
    const c = center(0.906, 0.065);
    blob(out, c, [h * 0.073, h * 0.104, 0.055], d < 3 ? 0 : 1, helmet ? 'patina' : 'bronze');
    if (helmet && d > 1) blob(out, center(0.981, 0.056), [h * 0.08, h * 0.041, 0.054], 1, 'edge');
    if (d > 1) {
      for (const s of [-1, 1]) {
        const a = at(s * 0.115, 0.715, 0.079),
          b = at(s * 0.21, 0.56, 0.11),
          c = at(s * 0.245, 0.5 + s * gesture * 0.1, 0.135);
        limb(
          out,
          [a, b, c].map((p, i) => [...p, h * [0.035, 0.029, 0.02][i]]),
          0,
          'patina',
        );
      }
      if (kneel) {
        const a = at(0.063, 0.18, 0.092),
          b = at(0.29, 0.114, 0.114),
          c = at(0.43, 0.075, 0.109);
        limb(
          out,
          [a, b, c].map((p, i) => [...p, h * [0.076, 0.062, 0.044][i]]),
          0,
          'deep',
        );
      } else {
        for (const s of [-1, 1])
          tube(
            out,
            'bronze',
            at(s * 0.068, 0.22, 0.059),
            at(s * 0.104, 0.035, 0.08),
            h * 0.033,
            rgb.bronze,
            4,
          );
      }
    }
  };
  if (sign === 1) {
    const donors = [
      { x: -1.49, h: 1.1, tilt: 0.13, gesture: 1 },
      { x: -1.1, h: 1.15, tilt: 0.19, gesture: 1 },
      { x: -0.69, h: 0.79, tilt: 0.2, kneel: true, gesture: 1 },
      { x: -0.29, h: 1.11, tilt: 0.14, gesture: -1 },
      { x: 0.21, h: 1.22, tilt: -0.14, gesture: -1 },
      { x: 0.62, h: 0.86, tilt: -0.19, kneel: true, gesture: -1 },
      { x: 1.04, h: 1.09, tilt: -0.11, gesture: -1 },
      { x: 1.47, h: 1.12, tilt: -0.16, gesture: -1 },
    ];
    donors.forEach(person);
    if (d > 1) {
      reliefBox(-0.11, 0.2, 0.079, 0.19, 0.131, 0.067, 'patina');
      tube(out, 'bronze', P(-0.53, 0.456, 0.16), P(-0.27, 0.478, 0.17), 0.043, rgb.patina, 5);
    }
  } else {
    const soldiers = [
      { x: -1.46, h: 1.17, tilt: 0.15, helmet: true },
      { x: -1.14, h: 1.15, tilt: 0.12, helmet: true },
      { x: -0.78, h: 1.12, tilt: 0.1, helmet: true },
      { x: -0.22, y: 0.46, h: 0.78, tilt: 0.12, helmet: true },
      { x: 0.67, h: 0.93, tilt: 0.21, kneel: true, gesture: -1 },
      { x: 1.06, h: 1.07, tilt: 0.2, gesture: -1 },
      { x: 1.48, h: 0.91, tilt: 0.15, kneel: true, gesture: -1 },
    ];
    soldiers.forEach(person);
    blob(out, P(-0.18, 0.51, 0.1), [0.41, 0.215, 0.112], Math.min(d, 2), 'bronze');
    blob(out, P(0.21, 0.73, 0.119), [0.157, 0.215, 0.085], Math.min(d, 2), 'patina');
    blob(out, P(0.356, 0.864, 0.135), [0.15, 0.093, 0.074], Math.min(d, 2), 'patina');
    if (d > 1) {
      for (const [x, y, u, v] of [
        [-0.48, 0.53, -0.6, 0.16],
        [-0.31, 0.51, -0.27, 0.119],
        [0.12, 0.57, 0.29, 0.36],
        [0.22, 0.53, 0.44, 0.37],
      ])
        tube(out, 'bronze', P(x, y, 0.159), P(u, v, 0.16), 0.038, rgb.bronze, 5);
      tube(out, 'bronze', P(-0.11, 1.05, 0.118), P(0.42, 1.209, 0.118), 0.026, rgb.edge, 5);
      blob(out, P(-0.97, 0.59, 0.116), [0.13, 0.218, 0.037], 1, 'patina');
    }
  }
}
export function buildMonument(out, level = 'master') {
  const d = tier[level];
  if (d === undefined) throw Error('Unknown Minin and Pozharsky detail level ' + level);
  pedestal(out, d);
  figures(out, d);
  swordAndShield(out, d);
  for (const sign of [-1, 1]) relief(out, d, sign);
  if (d >= 2) lettering(out);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');
