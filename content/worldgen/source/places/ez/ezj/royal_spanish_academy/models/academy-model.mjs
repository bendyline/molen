/** Original Madrid headquarters exterior, with explicit source and browser tiers. */

import {
  beam,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  brick: lin('bd6c59'),
  stone: lin('d9d3c4'),
  base: lin('b4b3aa'),
  roof: lin('61676e'),
  wood: lin('8b6f4f'),
  metal: lin('525c5d'),
  glass: lin('6f8790'),
  relief: lin('c9bea5'),
};
export const academySurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.83 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.85 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.5 },
};
const cfg = {
  skyline: { round: 6 },
  district: { round: 8, windows: true },
  street: { round: 12, windows: true, fine: true },
  closeup: { round: 32, windows: true, fine: true, relief: true },
  master: { round: 64, windows: true, fine: true, relief: true, master: true },
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
const rect = (u, y, w, h, kind = 'glass') => ({
  ring: [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + h],
    [u - w / 2, y + h],
  ],
  u,
  y,
  w,
  h,
  kind,
});
const face = (axis, side) =>
  axis === 'z'
    ? ([u, y, v]) => [side > 0 ? u : -u, y, side + Math.sign(side) * v]
    : ([u, y, v]) => [side + Math.sign(side) * v, y, side > 0 ? -u : u];
function localBox(o, c, p, x0, x1, y0, y1, v0, v1, s, col = C[s]) {
  const t = {
    addTriangle: (s, r, ps, N, uv, col) => T(o, c, ps.map(p), s, col),
    addQuad: (s, r, ps, N, uv, col) => Q(o, c, ps.map(p), s, col),
  };
  box(t, c, x0, x1, y0, y1, v0, v1, s, col);
}
function wall(o, c, p, L, y0, y1, holes, s) {
  const outer = [
      [-L / 2, y0],
      [L / 2, y0],
      [L / 2, y1],
      [-L / 2, y1],
    ],
    N = sub(p([0, 0, 1]), p([0, 0, 0]));
  if (!c.windows) {
    Q(
      o,
      c,
      outer.map(([u, y]) => p([u, y, 0])),
      s,
      C[s],
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
    starts = holes.map((_, i) => 4 + i * 4),
    ids = earcut(flat.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      s,
      C[s],
      N,
    );
  for (const h of holes) {
    const R = h.ring,
      depth = c.fine ? 0.35 : 0.14;
    for (let i = 0; i < 4; i++) {
      const a = R[i],
        b = R[(i + 1) % 4];
      Q(o, c, [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])], 'stone', C.stone);
    }
    Q(
      o,
      c,
      R.map(([u, y]) => p([u, y, -depth])),
      h.kind,
      C[h.kind],
      N,
    );
    const w = 0.14;
    if (c.fine) {
      for (const [a, b] of [
        [
          [-h.w / 2, -0.16],
          [h.w / 2, 0.01],
        ],
        [
          [-h.w / 2, h.h - 0.01],
          [h.w / 2, h.h + 0.18],
        ],
        [
          [-h.w / 2 - 0.16, 0],
          [-h.w / 2, h.h],
        ],
        [
          [h.w / 2, 0],
          [h.w / 2 + 0.16, h.h],
        ],
      ])
        localBox(o, c, p, h.u + a[0], h.u + b[0], h.y + a[1], h.y + b[1], -0.02, 0.14, 'stone');
    } else
      for (let i = 0; i < 4; i++) {
        const a = R[i],
          b = R[(i + 1) % 4],
          d = [b[0] - a[0], b[1] - a[1]],
          D = Math.hypot(...d),
          v = [(d[1] / D) * w, (-d[0] / D) * w];
        Q(
          o,
          c,
          [
            p([...a, 0.025]),
            p([...b, 0.025]),
            p([b[0] + v[0], b[1] + v[1], 0.025]),
            p([a[0] + v[0], a[1] + v[1], 0.025]),
          ],
          'stone',
          C.stone,
          N,
        );
      }
    if (c.relief && h.kind === 'glass') {
      localBox(
        o,
        c,
        p,
        h.u - 0.045,
        h.u + 0.045,
        h.y,
        h.y + h.h,
        -depth + 0.005,
        -depth + 0.06,
        'wood',
      );
      localBox(
        o,
        c,
        p,
        h.u - h.w / 2,
        h.u + h.w / 2,
        h.y + h.h * 0.58,
        h.y + h.h * 0.58 + 0.06,
        -depth + 0.005,
        -depth + 0.06,
        'wood',
      );
    }
  }
}
function course(o, c, y, height = 0.18, over = 0.18) {
  box(o, c, -14.2 - over, 14.2 + over, y, y + height, -22.1 - over, -22.1 + 0.15, 'stone');
  box(o, c, -14.2 - over, 14.2 + over, y, y + height, 22.1 - 0.15, 22.1 + over, 'stone');
  box(o, c, -14.2 - over, -14.2 + 0.15, y, y + height, -22.1 - over, 22.1 + over, 'stone');
  box(o, c, 14.2 - 0.15, 14.2 + over, y, y + height, -22.1 - over, 22.1 + over, 'stone');
}
function roof(o, c) {
  const y = 20,
    z0 = -22.5,
    z1 = 22.5,
    x0 = -14.6,
    x1 = 14.6,
    r = 21.4;
  Q(
    o,
    c,
    [
      [x0, y, z0],
      [0, r, z0 + 5],
      [0, r, z1 - 5],
      [x0, y, z1],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x1, y, z1],
      [0, r, z1 - 5],
      [0, r, z0 + 5],
      [x1, y, z0],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  T(
    o,
    c,
    [
      [x0, y, z0],
      [x1, y, z0],
      [0, r, z0 + 5],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  T(
    o,
    c,
    [
      [x1, y, z1],
      [x0, y, z1],
      [0, r, z1 - 5],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x0, y, z1],
      [x1, y, z1],
      [x1, y, z0],
      [x0, y, z0],
    ],
    'roof',
    C.roof,
    [0, -1, 0],
  );
  for (const x of [-13.1, 13.1])
    for (const z of [-17, -7, 7, 17]) {
      box(o, c, x - 0.35, x + 0.35, 20, 23.2, z - 0.46, z + 0.46, 'brick');
      if (c.windows) box(o, c, x - 0.46, x + 0.46, 23.2, 23.4, z - 0.57, z + 0.57, 'stone');
    }
}
function frustum(o, c, x, z, y0, y1, r0, r1, n, s = 'stone', fluted = false) {
  const ring = (y, r) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2,
          rr = fluted ? r * (i % 2 === 0 ? 1 : 0.965) : r;
        return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
      }),
    a = ring(y0, r0),
    b = ring(y1, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(o, c, [a[i], b[i], b[j], a[j]], s, C[s]);
    T(o, c, [[x, y0, z], a[j], a[i]], s, C[s], [0, -1, 0]);
    T(o, c, [[x, y1, z], b[i], b[j]], s, C[s], [0, 1, 0]);
  }
}
function pediment(o, c, p, left, right, base, peak, depth = 0.7) {
  const front = [
      [left, base, 0],
      [right, base, 0],
      [(left + right) / 2, peak, 0],
    ],
    back = front.map(([u, y]) => [u, y, -depth]);
  T(o, c, front.map(p), 'stone', C.stone, sub(p([0, 0, 1]), p([0, 0, 0])));
  T(o, c, [...back].reverse().map(p), 'stone', C.stone);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    Q(o, c, [p(front[i]), p(back[i]), p(back[j]), p(front[j])], 'stone', C.stone);
  }
  if (c.fine) {
    const A = adapter(o, c);
    for (const [a, b] of [
      [front[0], front[2]],
      [front[2], front[1]],
    ])
      beam(A, 'stone', p([a[0], a[1], 0.08]), p([b[0], b[1], 0.08]), 0.23, 0.24, C.stone);
  }
}
function figure(o, c, x, y, z, dark = false) {
  const s = dark ? 'metal' : 'stone';
  frustum(o, c, x, z, y, y + 1.1, 0.4, 0.26, c.round, s);
  frustum(o, c, x, z, y + 1.05, y + 1.45, 0.27, 0.19, c.round, s);
  if (c.relief)
    sphere(
      adapter(o, c),
      s,
      [x, y + 1.65, z],
      [0.19, 0.25, 0.19],
      C[s],
      c.round,
      c.master ? 12 : 6,
    );
  else frustum(o, c, x, z, y + 1.45, y + 1.88, 0.19, 0.15, c.round, s);
  if (c.fine) {
    beam(adapter(o, c), s, [x - 0.2, y + 1.25, z], [x - 0.48, y + 0.75, z + 0.1], 0.15, 0.18, C[s]);
    beam(adapter(o, c), s, [x + 0.2, y + 1.25, z], [x + 0.45, y + 0.9, z + 0.13], 0.15, 0.18, C[s]);
  }
}
function portico(o, c) {
  // Entire projection is occupied by a closed landing and descending integral steps.
  box(o, c, -7.4, 7.4, -8, 2.2, 22.05, 26.5, 'base');
  const stairs = c === cfg.skyline ? 3 : c === cfg.district ? 6 : 12;
  for (let i = 0; i < stairs; i++) {
    const front = 26.5 + ((i + 1) / stairs) * 3.1,
      back = 26.5 + (i / stairs) * 3.1,
      top = 2.2 - ((i + 1) / stairs) * 1.9;
    box(o, c, -7.4, 7.4, -8, top, back, front, 'stone');
  }
  for (const x of [-5.7, -1.9, 1.9, 5.7]) {
    box(o, c, x - 0.72, x + 0.72, 2.2, 2.55, 24.55, 25.99, 'stone');
    frustum(
      o,
      c,
      x,
      25.27,
      2.55,
      12.1,
      0.6,
      0.49,
      c.relief ? c.round * 2 : c.round,
      'stone',
      c.relief,
    );
    frustum(o, c, x, 25.27, 12.1, 12.4, 0.49, 0.76, c.round);
    box(o, c, x - 0.78, x + 0.78, 12.4, 12.7, 24.49, 26.05, 'stone');
  }
  box(o, c, -7.7, 7.7, 12.7, 14.6, 21.9, 26.7, 'stone');
  box(o, c, -8.0, 8.0, 14.6, 14.9, 21.7, 26.9, 'stone');
  pediment(o, c, face('z', 26.95), -8.0, 8.0, 14.9, 17.5, 4.9);
  if (c.fine) {
    // A shallow original inset replaces the real lettered tablet.
    localBox(o, c, face('z', 26.71), -3.8, 3.8, 13.15, 14.05, 0.01, 0.08, 'stone', C.relief);
    for (const x of [-6, -4, -2, 0, 2, 4, 6])
      box(o, c, x - 0.18, x + 0.18, 12.45, 12.7, 26.0, 26.8, 'stone');
  }
  if (c.windows) {
    figure(o, c, -7.0, 15.4, 25.9);
    figure(o, c, 7, 15.4, 25.9);
    box(o, c, -0.65, 0.65, 17.5, 17.85, 24.65, 25.95, 'metal');
    figure(o, c, 0, 17.85, 25.3, true);
  }
}
function ornament(o, c) {
  if (!c.fine) return;
  // Dentils and alternating geometric attic plaques remain quiet, shared-material details.
  for (const [p, L, bays] of [
    [face('x', 14.2), 44.2, 11],
    [face('x', -14.2), 44.2, 11],
    [face('z', 22.1), 28.4, 7],
    [face('z', -22.1), 28.4, 7],
  ]) {
    for (let i = 0; i < Math.floor(L / 0.75); i++) {
      const u = -L / 2 + 0.4 + i * 0.75;
      localBox(o, c, p, u - 0.13, u + 0.13, 19.15, 19.55, 0.06, 0.35, 'stone');
    }
    for (let i = 0; i < bays + 1; i++) {
      const u = -L / 2 + 0.55 + (i * (L - 1.1)) / bays;
      localBox(o, c, p, u - 0.48, u + 0.48, 15.8, 17.9, 0.01, 0.1, 'stone', C.relief);
      if (c.relief) {
        const n = c.master ? 24 : 12,
          center = [u, 16.85, 0.11],
          r = 0.35;
        for (let j = 0; j < n; j++) {
          const a = (j / n) * Math.PI * 2,
            b = ((j + 1) / n) * Math.PI * 2;
          T(
            o,
            c,
            [
              p([u, 16.85, 0.23]),
              p([u + Math.cos(a) * r, 16.85 + Math.sin(a) * r, 0.11]),
              p([u + Math.cos(b) * r, 16.85 + Math.sin(b) * r, 0.11]),
            ],
            'stone',
            C.relief,
          );
        }
        localBox(o, c, p, u - 0.26, u + 0.26, 16.45, 16.55, 0.12, 0.25, 'stone');
      }
    }
  }
}
export function buildAcademyLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown academy tier ' + level);
  // Closed main body; window backs and roof complete all four exterior elevations.
  box(o, c, -14.2, 14.2, -8, 2, -22.1, 22.1, 'base');
  box(o, c, -14.2, 14.2, 19, 20, -22.1, 22.1, 'stone');
  for (const [p, L, bays, isNorth, isFront] of [
    [face('x', 14.2), 44.2, 11, true, false],
    [face('x', -14.2), 44.2, 11, false, false],
    [face('z', 22.1), 28.4, 7, false, true],
    [face('z', -22.1), 28.4, 7, false, false],
  ]) {
    const holes = [],
      attic = [];
    for (let i = 0; i < bays; i++) {
      const u = ((i - (bays - 1) / 2) * (L - 4)) / (bays - 1),
        central = i === (bays - 1) / 2;
      attic.push(rect(u, 15.5, 1.0, 3.0));
      if (isFront && Math.abs(u) < 7) {
        holes.push(rect(u, 2.2, central ? 2.4 : 1.6, 6.2, 'wood'));
        continue;
      }
      holes.push(
        rect(
          u,
          isNorth && central ? 2 : 3.0,
          isNorth && central ? 2.0 : 1.65,
          isNorth && central ? 5.2 : 4.1,
          isNorth && central ? 'wood' : 'glass',
        ),
      );
      holes.push(rect(u, 9.1, 1.65, 4.1));
      if (c.fine) {
        if (i % 2 === 0) pediment(o, c, p, u - 1.05, u + 1.05, 13.48, 14.05, 0.2);
        else localBox(o, c, p, u - 1.05, u + 1.05, 13.45, 13.65, 0.02, 0.2, 'stone');
      }
      if (isNorth && central && c.windows) {
        localBox(o, c, p, u - 1.4, u + 1.4, 8.3, 8.55, 0, 1, 'stone');
        if (c.fine) {
          localBox(o, c, p, u - 1.4, u + 1.4, 8.95, 9.1, 0.8, 1, 'stone');
          localBox(o, c, p, u - 1.4, u + 1.4, 8.55, 8.62, 0.8, 1, 'stone');
          for (let j = 0; j < 7; j++)
            localBox(o, c, p, u - 1.25 + j * 0.42, u - 1.2 + j * 0.42, 8.55, 9.0, 0.8, 1, 'stone');
        } else localBox(o, c, p, u - 1.4, u + 1.4, 8.55, 9.0, 0.8, 1, 'stone');
      }
    }
    wall(o, c, p, L, 2, 14.5, holes, 'brick');
    wall(o, c, p, L, 14.5, 19, attic, 'stone');
  }
  for (const [y, h, w] of c === cfg.skyline
    ? [
        [1.65, 0.25, 0.18],
        [14.35, 0.23, 0.2],
        [19.7, 0.3, 0.4],
      ]
    : [
        [0.5, 0.2, 0.18],
        [1.65, 0.25, 0.18],
        [2, 0.15, 0.12],
        [14.35, 0.23, 0.2],
        [14.7, 0.14, 0.14],
        [18.8, 0.2, 0.2],
        [19.7, 0.3, 0.4],
      ])
    course(o, c, y, h, w);
  if (c.fine) {
    // Original basement vent inventory; shallow dark recessed-looking panels.
    for (const z of [-18, -14, -10, -6, 6, 10, 14, 18])
      for (const side of [-1, 1]) {
        const p = face('x', side * 14.2);
        localBox(o, c, p, z - 0.65, z + 0.65, 0.55, 1.3, 0.01, 0.04, 'metal');
      }
  }
  roof(o, c);
  portico(o, c);
  ornament(o, c);
}
export const buildAcademySkyline = (o) => buildAcademyLevel(o, 'skyline');
export const buildAcademyDistrict = (o) => buildAcademyLevel(o, 'district');
export const buildAcademyStreet = (o) => buildAcademyLevel(o, 'street');
export const buildAcademyCloseup = (o) => buildAcademyLevel(o, 'closeup');
