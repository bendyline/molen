/** Hotel Majapahit: researched Art Deco streetfront and colonial courtyard compound. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const base = new URL(
  '../../../content/worldgen/source/places/qw/qw8/hotel_majapahit/',
  import.meta.url,
);
const ref = 'palette:#ffffff',
  wall = rgb('e4e2cc'),
  stone = rgb('dcded0'),
  trim = rgb('71847d'),
  roof = rgb('a95e43'),
  glass = rgb('3d5250'),
  iron = rgb('303c37'),
  wood = rgb('614b38');
function facing(o, a, x = 0, z = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    v = (p) => [co * p[0] + si * p[2], p[1], -si * p[0] + co * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, uv, c) => o.addTriangle(s, r, p.map(q), v(n), uv, c),
    addQuad: (s, r, p, n, uv, c) => o.addQuad(s, r, p.map(q), v(n), uv, c),
    addConvexPolygon: (s, r, p, n, uv, c) => {
      const pp = p.map(q),
        u = p.map(uv);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => u[pp.indexOf(p)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function prism(o, loops, low, high, color = stone, slot = 'stone') {
  const rings = loops.map((r, i) => {
    r = cleanRing(r);
    if (r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r.pop();
    const a = r.reduce(
      (s, p, j) => s + p[0] * r[(j + 1) % r.length][1] - r[(j + 1) % r.length][0] * p[1],
      0,
    );
    if (a > 0 !== (i === 0)) r.reverse();
    return r;
  });
  const pts = rings.flat(),
    holes = [];
  let count = 0;
  for (let i = 0; i < rings.length; i++) {
    if (i) holes.push(count);
    count += rings[i].length;
  }
  const indices = earcut(pts.flat(), holes);
  for (const [y, n] of [
    [low, [0, -1, 0]],
    [high, [0, 1, 0]],
  ])
    for (let i = 0; i < indices.length; i += 3) {
      const p = indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]);
      o.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      quad(
        o,
        slot,
        [
          [a[0], low, a[1]],
          [b[0], low, b[1]],
          [b[0], high, b[1]],
          [a[0], high, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        color,
      );
    }
}
function upNormal(p) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  return n;
}
function edgeFrame(o, a, b) {
  return facing(o, Math.atan2(a[1] - b[1], b[0] - a[0]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
}
/** Split convex roof polygons around the portico's independently photographed roof join. */
function withoutRectangle(polygon, rectangle) {
  const clip = (points, axis, value, sign) => {
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        da = (a[axis] - value) * sign,
        db = (b[axis] - value) * sign;
      if (da >= 0) out.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        out.push(a.map((v, k) => v + (b[k] - v) * t));
      }
    }
    return out;
  };
  const pieces = [];
  let inside = polygon;
  for (const [axis, value, sign] of [
    [0, rectangle[0], 1],
    [0, rectangle[1], -1],
    [2, rectangle[2], 1],
    [2, rectangle[3], -1],
  ]) {
    const outside = clip(inside, axis, value, -sign);
    if (outside.length >= 3) pieces.push(outside);
    inside = clip(inside, axis, value, sign);
    if (inside.length < 3) break;
  }
  return pieces;
}
function hip(o, x, z, w, l, y, rise, detail) {
  const a = [x - w / 2, y, z - l / 2],
    b = [x + w / 2, y, z - l / 2],
    c = [x + w / 2, y, z + l / 2],
    d = [x - w / 2, y, z + l / 2];
  const along = l > w,
    ridge = along
      ? [
          [x, y + rise, z - l / 2 + w * 0.42],
          [x, y + rise, z + l / 2 - w * 0.42],
        ]
      : [
          [x - w / 2 + l * 0.42, y + rise, z],
          [x + w / 2 - l * 0.42, y + rise, z],
        ];
  const faces = along
    ? [
        [a, b, ridge[0]],
        [b, c, ridge[1], ridge[0]],
        [c, d, ridge[1]],
        [d, a, ridge[0], ridge[1]],
      ]
    : [
        [a, b, ridge[1], ridge[0]],
        [b, c, ridge[1]],
        [c, d, ridge[0], ridge[1]],
        [d, a, ridge[0]],
      ];
  for (const face of faces) {
    const pieces =
      x === -5 && z === -18 ? withoutRectangle(face, [-16.6, 6.6, -33.1, -28.95]) : [face];
    for (const p of pieces)
      for (let i = 1; i < p.length - 1; i++) {
        const t = [p[0], p[i], p[i + 1]];
        o.addTriangle(
          'roof',
          ref,
          t,
          upNormal(t),
          t.map((v) => [v[0], v[2]]),
          roof,
        );
      }
  }
  if (detail > 1) beam(o, 'roof', ridge[0], ridge[1], 0.18, 0.17, roof);
}
function win(o, x, y, z, w, h, d) {
  if (!d) return;
  face(o, 'glass', x, y, z, w, h, glass);
  if (d < 2) return;
  for (const u of [-w / 2 - 0.05, w / 2 + 0.05])
    face(o, 'wall', x + u, y - 0.07, z + 0.035, 0.1, h + 0.14, stone);
  for (const v of [0, h]) face(o, 'wall', x, y + v, z + 0.04, w + 0.2, 0.1, stone);
  for (let u = -w / 2 + w / 4; u < w / 2; u += w / 4)
    face(o, 'metal', x + u, y, z + 0.065, 0.055, h, wood);
  for (const v of [h * 0.35, h * 0.7]) face(o, 'metal', x, y + v, z + 0.07, w, 0.05, wood);
}
function archShape(o, x, y, z, w, h, n, slot = 'glass', col = glass) {
  const spring = y + h - w / 2,
    p = [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, spring, z],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i * Math.PI) / n;
    p.push([x + (Math.cos(a) * w) / 2, spring + (Math.sin(a) * w) / 2, z]);
  }
  o.addConvexPolygon(slot, ref, p, [0, 0, 1], (p) => [p[0], p[1]], col);
}
function balustrade(o, x, y, z, w, d, stoneRail = false, curved = false) {
  B(o, 'wall', x, y, z, w, 0.12, 0.22, stone);
  B(o, stoneRail ? 'wall' : 'metal', x, y + 0.83, z, w, 0.12, 0.23, stoneRail ? stone : iron);
  if (d < 2) return;
  for (let u = -w / 2 + 0.22; u < w / 2; u += d === 2 ? 0.65 : stoneRail ? 0.49 : 0.28) {
    if (stoneRail && d > 2 && (w > 5 || curved))
      loft(
        o,
        'wall',
        [
          [y + 0.13, 0.065],
          [y + 0.32, 0.11],
          [y + 0.58, 0.055],
          [y + 0.83, 0.07],
        ].map(([h, r]) => radialRing(h, r, r, 5, [x + u, z])),
        stone,
      );
    else
      face(
        o,
        stoneRail ? 'wall' : 'metal',
        x + u,
        y + 0.12,
        z,
        0.065,
        0.72,
        stoneRail ? stone : iron,
      );
  }
}
function arcade(o, a, b, d, { rearWindows = true, rail = true } = {}) {
  const f = edgeFrame(o, a, b),
    L = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = Math.max(1, Math.round(L / 3.3)),
    step = L / n;
  // The roofed gallery is genuinely open in the street and close-up levels.
  if (d) for (const y of [0.22, 4.55, 8.9]) B(f, 'wall', 0, y, -1.25, L, 0.25, 2.8, stone);
  if (!d) {
    B(f, 'wall', 0, 0.47, -0.15, L, 8.43, 0.3, wall);
    return;
  }
  for (const y of [0.48, 4.8]) {
    if (d === 1) B(f, 'wall', 0, y, -0.12, L, 4.1, 0.25, wall);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + step * (i + 0.5),
        w = step - 0.42,
        sy = y + 2.6,
        r = w / 2,
        top = y + 4.1;
      if (d === 1) archShape(f, x, y + 0.05, 0.035, w, 3.85, 3);
      else {
        for (const u of [x - step / 2, x + step / 2]) {
          if (d === 2) {
            face(f, 'wall', u, y, 0.15, 0.42, 2.66, wall);
            continue;
          }
          B(f, 'wall', u, y, -0.1, 0.42, 2.66, 0.5, wall);
          B(f, 'metal', u, y, -0.09, 0.48, 0.24, 0.57, trim);
          B(f, 'metal', u, sy - 0.1, -0.08, 0.5, 0.17, 0.57, trim);
        }
        const segments = d > 2 ? 8 : 4;
        for (let j = 0; j < segments; j++) {
          const aa = (j * Math.PI) / segments,
            bb = ((j + 1) * Math.PI) / segments,
            p = [
              [x + Math.cos(aa) * r, sy + Math.sin(aa) * r],
              [x + Math.cos(bb) * r, sy + Math.sin(bb) * r],
            ];
          for (const z of d === 2 ? [0.15] : [-0.35, 0.15])
            quad(
              f,
              'wall',
              [
                [p[0][0], p[0][1], z],
                [p[1][0], p[1][1], z],
                [p[1][0], top, z],
                [p[0][0], top, z],
              ],
              [0, 0, z > 0 ? 1 : -1],
              wall,
            );
          if (d > 2)
            quad(
              f,
              'wall',
              [
                [p[0][0], p[0][1], -0.35],
                [p[1][0], p[1][1], -0.35],
                [p[1][0], p[1][1], 0.15],
                [p[0][0], p[0][1], 0.15],
              ],
              [-Math.cos((aa + bb) / 2), -Math.sin((aa + bb) / 2), 0],
              wall,
            );
        }
      }
      if (rearWindows) win(f, x, y + 0.22, -2.68, 1.8, 2.75, d === 2 ? 1 : d);
      if (rail && d > 1) balustrade(f, x, y + 0.02, 0.1, w, d, y < 1);
      if (d > 2) {
        face(f, 'metal', x, y + 3.97, 0.17, 0.5, 0.09, trim);
        if (y < 1)
          for (let k = 0; k < 4; k++) face(f, 'metal', x, 4.63 + k * 0.085, 0.18, 0.7, 0.035, trim);
      }
    }
  }
  for (const y of [4.4, 8.75]) B(f, 'wall', 0, y, 0, L, 0.15, 0.44, stone);
}
function portico(o, d) {
  const f = facing(o, Math.PI, -5, -30.8),
    w = 23;
  // Garden-facing classical crosswing, with a shallow curved upper balcony.
  for (const y of [0.5, 5.0])
    for (const x of [-18, -14, -8, -4, 0, 4, 8, 14, 18]) win(f, x, y, -2.25, 2.0, 3.2, d);
  for (const x of [-11.1, 11.1]) {
    loft(
      f,
      'wall',
      [
        [0.3, 0.53],
        [0.6, 0.53],
        [0.8, 0.38],
        [9.7, 0.35],
        [9.9, 0.5],
        [10.2, 0.5],
      ].map(([y, r]) => radialRing(y, r, r, d > 1 ? 12 : 6, [x, 0])),
      stone,
    );
    B(f, 'metal', x, 9.7, 0, 1, 0.3, 1, trim);
  }
  // White soffit and upper rear wall close the photographed portico, above its doors.
  B(f, 'wall', 0, 10.1, -1.5, w, 1.05, 3.5, wall);
  B(f, 'wall', 0, 8.9, -2.75, w, 1.3, 0.8, wall);
  B(f, 'wall', 0, 10.15, 0.18, w + 0.55, 0.2, 0.45, stone);
  const tri = [
    [-w / 2, 11.15, 0.23],
    [w / 2, 11.15, 0.23],
    [0, 15.4, 0.23],
  ];
  f.addTriangle(
    'wall',
    ref,
    tri,
    [0, 0, 1],
    tri.map((v) => [v[0], v[1]]),
    wall,
  );
  for (const [a, b] of [
    [tri[0], tri[2]],
    [tri[2], tri[1]],
  ])
    beam(f, 'wall', a, b, 0.35, 0.4, stone);
  if (d > 1) {
    const p = [];
    for (let j = 0; j < 20; j++) {
      const a = (j * 2 * Math.PI) / 20;
      p.push([Math.cos(a) * 0.75, 12.75 + Math.sin(a) * 0.75, 0.27]);
    }
    f.addConvexPolygon('wall', ref, p, [0, 0, 1], (v) => [v[0], v[1]], stone);
  }
  const arc = [],
    n = d > 1 ? 20 : 8;
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (i * Math.PI) / n;
    arc.push([Math.sin(t) * 8.7, Math.cos(t) * 2.1]);
  }
  prism(f, [arc], 4.5, 4.83, stone, 'wall');
  if (d > 1)
    for (let i = 0; i < n; i++) {
      const a = arc[i],
        b = arc[i + 1],
        rr = edgeFrame(f, b, a);
      balustrade(rr, 0, 4.84, 0, Math.hypot(b[0] - a[0], b[1] - a[1]), d, true, true);
    }
}
function entrance(o, d) {
  const f = facing(o, -0.283, -7, 63),
    w = 34;
  B(f, 'wall', 0, -1.5, -3, w, 11, 12, wall);
  B(f, 'membrane', 0, 9.5, -3, w, 0.16, 12, trim);
  for (const y of [8.25, 9.5]) B(f, 'metal', 0, y, 3.1, w + 1.1, 0.24, 0.65, trim);
  B(f, 'wall', 0, 9.65, -1, 25, 1.1, 7, wall);
  B(f, 'metal', 0, 10.75, -1, 26, 0.23, 7.7, trim);
  for (const x of [-16.4, 16.4]) {
    B(f, 'wall', x, -1.5, 2.0, 2.7, 14, 3.6, wall);
    B(f, 'metal', x, 12.5, 2, 3.65, 0.3, 4.3, trim);
    B(f, 'glass', x, 12.8, 2, 0.8, 4, 0.8, rgb('c7c6ae'));
    B(f, 'metal', x, 16.8, 2, 1.1, 0.3, 1.1, iron);
    if (d > 0) {
      for (const u of [-0.43, 0.43])
        for (const v of [-0.43, 0.43]) B(f, 'metal', x + u, 12.8, 2 + v, 0.065, 4, 0.065, trim);
      for (let y = 13.3; y < 16.8; y += 0.65) B(f, 'metal', x, y, 2, 0.9, 0.06, 0.9, trim);
    }
    if (d > 1) {
      win(f, x - 0.65, 0.6, 3.83, 0.22, 2.2, d);
      win(f, x + 0.65, 0.6, 3.83, 0.22, 2.2, d);
    }
  }
  for (const x of [-11.2, -5.6, 0, 5.6, 11.2]) win(f, x, 5.45, 3.035, 4.15, 2.5, d);
  for (const x of [-13, -8.7, -4.35, 0, 4.35, 8.7, 13]) win(f, x, 0.35, 3.04, 3.55, 3.4, d);
  B(f, 'wall', 0, 4.0, 5.1, 30, 0.3, 4.6, wall);
  B(f, 'wall', 0, 4.8, 8.2, 14, 0.35, 8.8, wall);
  B(f, 'wall', 0, 5.15, 8.2, 14.6, 0.15, 9.1, stone);
  for (const x of [-6.3, 6.3]) {
    B(f, 'wall', x, -1.5, 11.7, 0.8, 6.3, 0.8, wall);
    B(f, 'metal', x, 4.1, 11.7, 1, 0.7, 1, trim);
    B(f, 'metal', x, -0.05, 11.7, 0.9, 0.65, 0.9, wood);
  }
  for (const x of [-12.4, -8.3, 8.3, 12.4]) B(f, 'wall', x, -1.5, 6.9, 0.45, 5.5, 0.45, wall);
  if (d > 1) {
    for (const x of [-13, -9, 9, 13]) {
      B(f, 'metal', x, 3.1, 4.0, 3, 0.15, 1.9, trim);
      for (let j = 0; j < 6; j++) B(f, 'wall', x - 1.25 + j * 0.5, 3.11, 4, 0.2, 0.06, 1.9, stone);
    }
  }
  if (d > 0) for (const x of [-10, 0, 10]) B(f, 'metal', x, 10.9, -1, 0.055, 3.3, 0.055, stone);
}
export function majapahit(o, frame, d = 3) {
  const map = frame ?? JSON.parse(fs.readFileSync(new URL('map-frame.json', base))),
    outline = map.geometry.outline;
  // Low foundation preserves the map's open gardens without a fabricated flat terrain pad.
  if (d) prism(o, [outline, ...map.geometry.rings.slice(1)], -5, 0.24, stone, 'wall');
  // Room cores sit behind genuinely open courtyard galleries.
  B(o, 'wall', -37.35, -5, 19, 13.3, 13.9, 74, wall);
  B(o, 'wall', -38.35, -5, -39, 11.3, 13.9, 42, wall);
  B(o, 'wall', 26.85, -5, 19, 14.3, 13.9, 74, wall);
  B(o, 'wall', 28.85, -5, -39, 10.3, 13.9, 42, wall);
  B(o, 'wall', -5, -5, -67.85, 78, 13.9, 10.3, wall);
  B(o, 'wall', -5, -5, -17.85, 49, 13.9, 20.3, wall);
  B(o, 'wall', -5, -5, 16.65, 14.6, 13.9, 41.3, wall);
  B(o, 'wall', -6, -5, 49, 24, 9.5, 22, wall);
  B(o, 'membrane', -6, 4.5, 49, 24, 0.15, 22, trim);
  // Lower street wings follow the oblique road, distinct from the entrance block.
  prism(
    o,
    [
      [
        [-44, 56],
        [-27, 55],
        [-23, 48],
        [-17, 49],
        [-17, 63],
        [-27, 79],
        [-44, 73],
      ],
    ],
    -1.5,
    4.6,
    wall,
    'wall',
  );
  prism(
    o,
    [
      [
        [17, 49],
        [31, 40],
        [41, 46],
        [42, 75],
        [47, 77],
        [47, 100],
        [10, 90],
        [15, 76],
        [17, 70],
      ],
    ],
    -1.5,
    4.6,
    wall,
    'wall',
  );
  for (const [x, z, w, l] of [
    [-36, -5, 18, 125],
    [26, -4, 18, 124],
    [-5, -66.5, 81, 16],
    [-5, -18, 54, 30],
    [-5.5, 19, 22, 44],
  ])
    hip(o, x, z, w, l, 9.1, Math.min(w, l) * 0.22, d);
  // Front two gardens and broad rear garden; directions put +Z toward each courtyard.
  for (const [a, b] of [
    [
      [-28, 55],
      [-28, -5],
    ],
    [
      [17, -5],
      [17, 57],
    ],
    [
      [-15, -5],
      [-15, 39],
    ],
    [
      [5, 39],
      [5, -5],
    ],
    [
      [-15, 40],
      [5, 40],
    ],
    [
      [-28, -5],
      [-15, -5],
    ],
    [
      [5, -5],
      [17, -5],
    ],
    [
      [-30, -18],
      [-30, -59],
    ],
    [
      [21, -59],
      [21, -18],
    ],
    [
      [-30, -60],
      [21, -60],
    ],
  ])
    arcade(o, a, b, d);
  // External elevations use restrained windows where the corpus does not resolve detail.
  if (d > 0)
    for (const [a, b] of [
      [
        [-44, -65],
        [-44, 55],
      ],
      [
        [34, 55],
        [34, -66],
      ],
      [
        [-44, -73],
        [34, -73],
      ],
    ]) {
      const f = edgeFrame(o, a, b),
        L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let x = -L / 2 + 2; x < L / 2; x += 4.5)
        for (const y of [0.8, 5.0]) win(f, x, y, 0.055, 1.45, 2.5, d === 2 ? 1 : d);
    }
  // The pediment has its own crossing gable, rather than an unsupported triangular screen.
  const gable = facing(o, Math.PI, -5, -30.8);
  for (const side of [-1, 1]) {
    const p = [
      [side * 11.5, 11.15, 0.2],
      [0, 15.4, 0.2],
      [0, 15.4, -15],
      [side * 11.5, 11.15, -15],
    ];
    quad(gable, 'roof', p, upNormal(p), roof);
  }
  for (const [a, b] of [
    [
      [-44, 73],
      [-27, 79],
    ],
    [
      [10, 90],
      [47, 100],
    ],
  ]) {
    const f = edgeFrame(o, a, b),
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    B(f, 'metal', 0, 4.4, 0, L, 0.2, 0.35, trim);
    for (let x = -L / 2 + 1.9; x < L / 2; x += 3.6) win(f, x, 0.65, 0.035, 2.7, 2.8, d);
  }
  portico(o, d);
  entrance(o, d);
}
export function majapahitSkyline(o) {
  majapahit(o, undefined, 0);
}
export function majapahitDistrict(o) {
  majapahit(o, undefined, 1);
}
export function majapahitStreet(o) {
  majapahit(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.9, metallic: 0 },
  roof: { ...landmarkSurfaces.roof, graph: 'tile_flat' },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.9, metallic: 0 },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const majapahitModel = {
  id: 'hotel_majapahit',
  recipe: 'structure-hotel-majapahit.mjs',
  key: 'hotel_majapahit',
  cell: 'qw/qw8',
  title: 'Hotel Majapahit',
  brief:
    'Cream Art Deco entrance with twin glazed beacons, stepped parapets and projecting canopy; red hipped-roof courtyard wings with open arcades and a pedimented classical crosswing.',
  camera: [185, 154, 238],
  lookAt: [0, 5, 8],
  qaCameras: [
    { name: 'front', position: [-65, 30, 182], lookAt: [-7, 8, 63] },
    { name: 'back', position: [110, 100, -170], lookAt: [-5, 6, -30] },
    { name: 'courtyard-detail', position: [-21, 6, 28], lookAt: [-28, 4.8, 15] },
    { name: 'portico-detail', position: [-9, 8, -53], lookAt: [-5, 7, -31] },
    { name: 'entrance-detail', position: [-30, 10, 95], lookAt: [-7, 8, 63] },
  ],
  build: majapahit,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview',
  groundContactBasis:
    'Original DeltaDTM v1.1.1 one arcsecond coastal source, independently reproduced across existing320m review extent. Existing dry Jalan Tunjungan approach[-7,80] gives datum3.0098565mEGM2008. Footing, anchor, heading and reference unchanged; rejected Terrarium retained. Subsequent photograph-directed portico roof/ceiling/backwall and curved-baluster repair leaves ground and lower architecture unchanged.5m review spacing interpolates approximately30m source; another host field requires review.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hotel-majapahit.mjs',
    level: 'skyline',
    export: 'majapahitSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'majapahitDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'majapahitStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'Full historic exterior reviewed with the exact published Qualla FishynilaCC0 entrance original and independent primary architectural field observations, municipal heritage text and current operator balcony description. Earlier private/attribution imagery is excluded; interiors excluded.',
    'Mapped compound/open gardens retained. Primary architectural text controls Art Deco front, colonnaded curved-beam verandas, two-storey central crosswing, pediment, white balustrades and courtyard balcony. Heights, roof pitches/colour/joins, window spacing, gallery depths, precise ornament and hidden elevations remain medium-fi estimates.',
    'Later eastern pool/service wing excluded by an explicit scope cut. Simplified original relief; no photo textures or exact crests/lettering copied.',
    'Independent original DeltaDTM v1.1.1 coastal DTM replaces rejected Terrarium after existing geometry. Source one arcsecond(approximately30m);5m review spacing is interpolation, not source resolution or surveyed floor accuracy. Frame,dry reference,footing and lower architecture unchanged;later photo-directed portico roof/ceiling/backwall and curved-baluster repair uses fixed architectural controls. No NODATA filling, flattening, cutout or footprint replacement. Another host field requires contact review.',
  ],
};
