/** Original complete Tanggula headhouse: curved panel sail roof, mast and projecting annex. */

import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  brick: lin('b75e48'),
  base: lin('aaa79a'),
  white: lin('e0e2dd'),
  red: lin('d54637'),
  mast: lin('d9d3ad'),
  band: lin('c8ceca'),
  metal: lin('707c7c'),
  door: lin('567a90'),
  glass: lin('587b8a'),
  seam: lin('aeb9b5'),
};
export const headhouseSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  white: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.08 },
  red: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.08 },
  mast: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  band: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  seam: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.08 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.12 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.5 },
};
const cfg = {
  skyline: { nx: 16, nz: 2 },
  district: { nx: 32, nz: 2, detail: true },
  street: { nx: 64, nz: 4, detail: true, fine: true },
  closeup: { nx: 128, nz: 8, detail: true, fine: true, near: true },
  master: { nx: 256, nz: 12, detail: true, fine: true, near: true, master: true },
};
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  sub = (a, b) => a.map((v, i) => v - b[i]);
function T(o, c, p, s, col, N) {
  p = p.map((p) => p.map(Math.fround));
  let n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
    d = Math.hypot(...n);
  if (d < 1e-8) return;
  if (N && n.reduce((s, v, i) => s + v * N[i], 0) < 0) {
    p.reverse();
    n = n.map((v) => -v);
  }
  n = n.map((v) => v / d);
  o.addTriangle(
    c === cfg.skyline ? 'far' : s,
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
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'stone', col = C[s]) {
  for (const [p, N] of [
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
const adapter = (o, c) => ({
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
export const headhousePlan = [
  [-22.004333, 3.996812],
  [-21.796127, -4.32419],
  [21.869356, -4.32419],
  [21.931103, 4.651567],
  [5.096702, 4.697517],
  [5.099573, 11.207856],
  [-3.645012, 11.365809],
  [-3.590447, 4.065727],
];
const CENTER = 0.72728,
  LEFT = -22.18,
  RIGHT = 22.18,
  frontZ = (x) => 4.324 + (x + 0.04) * 0.0149;
const controls = [
  [0, 14.2, 0.9],
  [2, 11.3, 1.5],
  [5, 8.9, 2.1],
  [9, 7.1, 2.9],
  [13, 6.8, 3.4],
  [18, 7.1, 2.8],
  [22, 7.6, 2.6],
];
function profile(x, column = 1) {
  const d = (Math.abs(x - CENTER) / (x < CENTER ? CENTER - LEFT : RIGHT - CENTER)) * 22;
  let j = controls.findIndex((p) => p[0] >= d);
  if (j <= 0) return controls[0][column];
  if (j < 0) j = controls.length - 1;
  const i = j - 1,
    a = controls[i],
    b = controls[j],
    A = controls[Math.max(0, i - 1)],
    B = controls[Math.min(controls.length - 1, j + 1)],
    t = (d - a[0]) / (b[0] - a[0]),
    h = b[0] - a[0],
    m0 = (b[column] - A[column]) / (b[0] - A[0]),
    m1 = (B[column] - a[column]) / (B[0] - a[0]);
  return (
    (2 * t * t * t - 3 * t * t + 1) * a[column] +
    (t * t * t - 2 * t * t + t) * h * m0 +
    (-2 * t * t * t + 3 * t * t) * b[column] +
    (t * t * t - t * t) * h * m1
  );
}
const upper = (x) => profile(x),
  lower = (x) => profile(x) - profile(x, 2),
  roofPoint = (x, v, underside = false) => [
    x,
    upper(x) + 0.25 * (1 - (2 * v - 1) * (2 * v - 1)) - (underside ? 0.18 : 0),
    -4.55 + (frontZ(x) + 0.35 + 4.55) * v,
  ];
const rect = (u, y, w, h, kind = 'glass') => ({
  ring: [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + h],
    [u - w / 2, y + h],
  ],
  kind,
});
const face = (axis, side) =>
  axis === 'z'
    ? ([u, y, v]) => [side > 0 ? u : -u, y, side + Math.sign(side) * v]
    : ([u, y, v]) => [side + Math.sign(side) * v, y, side > 0 ? -u : u];
function wall(o, c, p, outer, holes = [], surface = 'brick', col = C[surface]) {
  const N = sub(p([0, 0, 1]), p([0, 0, 0]));
  if (!c.detail) {
    const ids = earcut(outer.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => p([...outer[j], 0])),
        surface,
        col,
        N,
      );
    for (const h of holes)
      Q(
        o,
        c,
        h.ring.map(([u, y]) => p([u, y, 0.015])),
        h.kind,
        C[h.kind],
        N,
      );
    return;
  }
  const flat = [...outer, ...holes.flatMap((h) => h.ring)],
    starts = holes.map(
      (h, i) => outer.length + holes.slice(0, i).reduce((n, h) => n + h.ring.length, 0),
    ),
    ids = earcut(flat.flat(), starts),
    depth = c.fine ? 0.3 : 0.14;
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      surface,
      col,
      N,
    );
  for (const h of holes) {
    const r = h.ring;
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4];
      Q(o, c, [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])], 'band', C.band);
    }
    Q(
      o,
      c,
      r.map(([u, y]) => p([u, y, -depth])),
      h.kind,
      C[h.kind],
      N,
    );
    if (c.fine)
      beamPath(
        adapter(o, c),
        'band',
        r.map(([u, y]) => p([u, y, 0.035])),
        0.12,
        0.12,
        C.band,
        true,
      );
    else {
      const center = r.reduce((a, b) => a.map((v, i) => v + b[i] / 4), [0, 0]);
      for (let i = 0; i < 4; i++) {
        const a = r[i],
          b = r[(i + 1) % 4],
          extend = (q) => {
            const D = Math.hypot(q[0] - center[0], q[1] - center[1]);
            return [q[0] + (0.1 * (q[0] - center[0])) / D, q[1] + (0.1 * (q[1] - center[1])) / D];
          };
        Q(
          o,
          c,
          [p([...a, 0.02]), p([...b, 0.02]), p([...extend(b), 0.02]), p([...extend(a), 0.02])],
          'band',
          C.band,
          N,
        );
      }
    }
    if (c.near && h.kind === 'glass') {
      const x = (r[0][0] + r[1][0]) / 2;
      beam(
        adapter(o, c),
        'metal',
        p([x, r[0][1], -depth + 0.03]),
        p([x, r[2][1], -depth + 0.03]),
        0.055,
        0.055,
        C.metal,
      );
    }
  }
}
function slab(o, c, ring, y0, y1) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y1, ring[j][1]]),
      'base',
      C.base,
      [0, 1, 0],
    );
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y0, ring[j][1]]),
      'base',
      C.base,
      [0, -1, 0],
    );
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      c,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      'base',
      C.base,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function body(o, c) {
  const front = ([u, y, v]) => [u, y, frontZ(u) + v],
    left = -21.9,
    right = 21.9;
  wall(
    o,
    c,
    front,
    [
      [left, 0.35],
      [right, 0.35],
      [right, 4.8],
      [left, 4.8],
    ],
    [
      rect(-18.4, 0.8, 1.0, 3.3, 'door'),
      rect(-14.8, 0.85, 1.0, 3.2, 'glass'),
      rect(-5.2, 0.35, 1.4, 3.8, 'door'),
      rect(8.0, 1.4, 1.4, 2.3),
      rect(16.8, 0.45, 4.1, 3.95, 'metal'),
    ],
  );
  wall(
    o,
    c,
    face('z', -4.324),
    [
      [-right, 0.35],
      [-left, 0.35],
      [-left, 4.8],
      [-right, 4.8],
    ],
    [
      rect(-17, 1.5, 1.8, 2.2),
      rect(-10, 1.5, 1.8, 2.2),
      rect(0, 0.35, 1.8, 3.8, 'door'),
      rect(9, 1.5, 1.8, 2.2),
      rect(17, 1.5, 1.8, 2.2),
    ],
  );
  for (const x of [left, right]) {
    const p = face('x', x),
      F = frontZ(x),
      sgn = Math.sign(x),
      a = sgn > 0 ? -F : -4.324,
      b = sgn > 0 ? 4.324 : F;
    wall(
      o,
      c,
      p,
      [
        [a, 0.35],
        [b, 0.35],
        [b, 4.8],
        [a, 4.8],
      ],
      [rect((a + b) / 2, 1.3, 1.4, 2.4)],
    );
  }
  if (c.fine) {
    const p = front,
      z = frontZ(16.8) - 0.3 + 0.035;
    for (let y = 0.7; y < 4.2; y += c.near ? 0.22 : 0.5)
      beam(adapter(o, c), 'metal', [14.82, y, z], [18.78, y, z], 0.035, 0.035, C.metal);
  }
}
function roof(o, c) {
  const xs = Array.from({ length: c.nx + 1 }, (_, i) => LEFT + ((RIGHT - LEFT) * i) / c.nx);
  for (let i = 0; i < c.nx; i++)
    for (let j = 0; j < c.nz; j++) {
      const a = xs[i],
        b = xs[i + 1],
        v = j / c.nz,
        w = (j + 1) / c.nz;
      Q(
        o,
        c,
        [roofPoint(a, v), roofPoint(b, v), roofPoint(b, w), roofPoint(a, w)],
        'white',
        C.white,
        [0, 1, 0],
      );
      Q(
        o,
        c,
        [
          roofPoint(a, v, true),
          roofPoint(a, w, true),
          roofPoint(b, w, true),
          roofPoint(b, v, true),
        ],
        'white',
        C.white,
        [0, -1, 0],
      );
    }
  for (const x of [LEFT, RIGHT])
    for (let j = 0; j < c.nz; j++) {
      const v = j / c.nz,
        w = (j + 1) / c.nz;
      Q(
        o,
        c,
        [roofPoint(x, v), roofPoint(x, w), roofPoint(x, w, true), roofPoint(x, v, true)],
        'white',
        C.white,
        [Math.sign(x), 0, 0],
      );
    }
  for (const front of [true, false]) {
    const p = ([x, y, v]) => [x, y, (front ? frontZ(x) + 0.35 : -4.55) + (front ? 1 : -1) * v],
      N = [0, 0, front ? 1 : -1];
    for (let i = 0; i < c.nx; i++) {
      const a = xs[i],
        b = xs[i + 1],
        r = [
          [a, lower(a)],
          [b, lower(b)],
          [b, upper(b)],
          [a, upper(a)],
        ];
      for (const [v, n] of [
        [0, N],
        [-0.14, N.map((v) => -v)],
      ])
        Q(
          o,
          c,
          r.map(([x, y]) => p([x, y, v])),
          'white',
          C.white,
          n,
        );
      if (c.detail) {
        Q(
          o,
          c,
          [
            p([a, upper(a), 0]),
            p([b, upper(b), 0]),
            p([b, upper(b), -0.14]),
            p([a, upper(a), -0.14]),
          ],
          'white',
          C.white,
          [0, 1, 0],
        );
        Q(
          o,
          c,
          [
            p([a, lower(a), -0.14]),
            p([b, lower(b), -0.14]),
            p([b, lower(b), 0]),
            p([a, lower(a), 0]),
          ],
          'white',
          C.white,
          [0, -1, 0],
        );
      }
    }
    if (c.detail)
      for (const x of [LEFT, RIGHT])
        Q(
          o,
          c,
          [
            p([x, lower(x), 0]),
            p([x, upper(x), 0]),
            p([x, upper(x), -0.14]),
            p([x, lower(x), -0.14]),
          ],
          'white',
          C.white,
          [Math.sign(x), 0, 0],
        );
    // Red infill below the suspended white edge closes the high central roof return.
    const redTop = xs.map((x) => [x, Math.max(4.8, upper(x) - 0.18)]),
      outer = [[LEFT, 4.8], [RIGHT, 4.8], ...redTop.toReversed()],
      ids = earcut(outer.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => p([...outer[j], -0.36])),
        'red',
        C.red,
        N,
      );
  }
  // Follow the crowned underside across the whole end. A flat return leaves
  // a visible slot below the canopy even when the roof shell itself is closed.
  for (const x of [LEFT, RIGHT]) {
    const inside = x - Math.sign(x) * 0.08;
    for (let j = 0; j < c.nz; j++) {
      const v = j / c.nz,
        w = (j + 1) / c.nz;
      for (const [side, normal] of [
        [x, Math.sign(x)],
        [inside, -Math.sign(x)],
      ]) {
        const a = roofPoint(side, v, true),
          b = roofPoint(side, w, true);
        Q(o, c, [[side, 4.8, a[2]], [side, 4.8, b[2]], b, a], 'white', C.white, [normal, 0, 0]);
      }
      Q(
        o,
        c,
        [
          roofPoint(x, v, true),
          roofPoint(inside, v, true),
          roofPoint(inside, w, true),
          roofPoint(x, w, true),
        ],
        'white',
        C.white,
        [0, 1, 0],
      );
    }
  }
  if (c.fine) {
    const step = c.near ? 1.25 : 3.4;
    for (let x = LEFT + 0.2; x < RIGHT; x += step) {
      const pts = Array.from({ length: c.nz + 1 }, (_, j) => {
        const p = roofPoint(x, j / c.nz);
        p[1] += 0.025;
        return p;
      });
      beamPath(adapter(o, c), 'seam', pts, 0.025, 0.025, C.seam);
      for (const front of [true, false]) {
        const z = (front ? frontZ(x) + 0.35 : -4.55) + (front ? 0.025 : -0.025);
        beam(adapter(o, c), 'seam', [x, lower(x), z], [x, upper(x), z], 0.025, 0.025, C.seam);
      }
    }
    for (const front of [true, false])
      for (let y = 5.3; y < 14; y += 1.3)
        for (let i = 0; i < c.nx; i++) {
          const a = xs[i],
            b = xs[i + 1];
          if (
            y < lower(a) + 0.05 ||
            y < lower(b) + 0.05 ||
            y > upper(a) - 0.05 ||
            y > upper(b) - 0.05
          )
            continue;
          const Z = (x) => (front ? frontZ(x) + 0.35 : -4.55) + (front ? 0.025 : -0.025);
          beam(adapter(o, c), 'seam', [a, y, Z(a)], [b, y, Z(b)], 0.025, 0.025, C.seam);
        }
  }
}
function annex(o, c) {
  const left = -3.645,
    right = 5.099,
    back = 4.3,
    front = 11.29;
  wall(
    o,
    c,
    face('z', front),
    [
      [left, 0.35],
      [right, 0.35],
      [right, 4.9],
      [left, 4.9],
    ],
    [],
  );
  for (const x of [left, right]) {
    const sign = Math.sign(x),
      p = face('x', x),
      a = sign > 0 ? -front : back,
      b = sign > 0 ? -back : front;
    wall(
      o,
      c,
      p,
      [
        [a, 0.35],
        [b, 0.35],
        [b, 4.9],
        [a, 4.9],
      ],
      [rect(sign > 0 ? -8.3 : 8.3, 0.35, 1.4, 3.55, 'door')],
    );
  }
  box(o, c, left - 0.38, right + 0.38, 4.9, 5.12, back - 0.25, front + 0.38, 'white', C.white);
  const outer = [
      [left - 0.55, 5.12, back - 0.4],
      [right + 0.55, 5.12, back - 0.4],
      [right + 0.55, 5.12, front + 0.55],
      [left - 0.55, 5.12, front + 0.55],
    ],
    inner = [
      [left + 0.7, 5.85, back + 0.9],
      [right - 0.7, 5.85, back + 0.9],
      [right - 0.7, 5.85, front - 0.9],
      [left + 0.7, 5.85, front - 0.9],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, c, [outer[i], outer[j], inner[j], inner[i]], 'red', C.red, [0, 1, 0]);
  }
  Q(o, c, inner, 'red', C.red, [0, 1, 0]);
  Q(o, c, outer, 'red', C.red, [0, -1, 0]);
  if (c.fine)
    for (const [a, b] of [
      [
        [left - 0.38, 4.9, front + 0.38],
        [right + 0.38, 4.9, front + 0.38],
      ],
      [
        [left - 0.38, 4.9, back - 0.25],
        [left - 0.38, 4.9, front + 0.38],
      ],
      [
        [right + 0.38, 4.9, front + 0.38],
        [right + 0.38, 4.9, back - 0.25],
      ],
    ])
      beam(adapter(o, c), 'band', a, b, 0.12, 0.15, C.band);
}
export function buildHeadhouseLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown headhouse tier ' + level);
  slab(o, c, headhousePlan, -3, 0.35);
  body(o, c);
  roof(o, c);
  annex(o, c);
  box(o, c, CENTER - 0.56, CENTER + 0.56, 5.8, 15.3, 3.8, 4.65, 'mast', C.mast);
  box(o, c, CENTER - 0.08, CENTER + 0.08, 15.3, 16.0, 4.05, 4.21, 'metal', C.metal);
}
export const buildHeadhouseSkyline = (o) => buildHeadhouseLevel(o, 'skyline');
export const buildHeadhouseDistrict = (o) => buildHeadhouseLevel(o, 'district');
export const buildHeadhouseStreet = (o) => buildHeadhouseLevel(o, 'street');
export const buildHeadhouseCloseup = (o) => buildHeadhouseLevel(o, 'closeup');
