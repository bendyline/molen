/** Absecon: current banded masonry tower and native reconstructed keeper-house group. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  Y = -0.12,
  cream = rgb('dedbc4'),
  black = rgb('41454a'),
  white = rgb('d9ded4'),
  gray = rgb('b0b5ac'),
  red = rgb('994d43'),
  redEdge = rgb('783b32'),
  gold = rgb('b6ae83'),
  dark = rgb('39463f'),
  glass = rgb('61766f'),
  wood = rgb('725748');
const houseOutline = [
  [-7.993, 28.725],
  [-8.129, 22.738],
  [-5.857, 22.829],
  [-5.799, 14.363],
  [-1.361, 14.236],
  [-1.581, 11.554],
  [3.889, 11.421],
  [3.798, 13.693],
  [11.334, 13.549],
  [11.312, 28.725],
];
const towerRadius = (y) => 4.1 - (1.9 * Math.max(0, Math.min(44, y - Y))) / 44;
const windows = [
  { a: 0, y0: Y + 14.3, y1: Y + 15.55, w: 0.69 },
  { a: 0, y0: Y + 37.3, y1: Y + 38.55, w: 0.64 },
  { a: Math.PI, y0: Y + 3.2, y1: Y + 4.45, w: 0.75 },
  { a: Math.PI, y0: Y + 25.1, y1: Y + 26.35, w: 0.65 },
  { a: Math.PI / 2, y0: Y + 7.7, y1: Y + 8.95, w: 0.7 },
  { a: Math.PI / 2, y0: Y + 33.1, y1: Y + 34.35, w: 0.64 },
  { a: (3 * Math.PI) / 2, y0: Y + 20.5, y1: Y + 21.75, w: 0.65 },
  { a: (3 * Math.PI) / 2, y0: Y + 41.1, y1: Y + 42.35, w: 0.6 },
  { a: 0, y0: Y + 0.15, y1: Y + 2.55, w: 1.05, door: true },
];
function oriented(out, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return out.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function panel(out, slot, u0, u1, y0, y1, z, color) {
  quad(
    out,
    slot,
    [
      [u0, y0, z],
      [u1, y0, z],
      [u1, y1, z],
      [u0, y1, z],
    ],
    [0, 0, 1],
    color,
  );
}
function poly(out, ring, y0, y1, color, slot = 'floor') {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      p = [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ];
    const area = ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0);
    const sign = area > 0 ? 1 : -1;
    quad(out, slot, p, [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])], color);
  }
  for (const [y, normal] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
      out.addTriangle(
        slot,
        ref,
        p,
        normal,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
}
function tower(out, d) {
  const n = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 48 : 96;
  loft(out, 'wall', [radialRing(-1.05, 4.2, 4.2, n), radialRing(Y + 0.1, 4.2, 4.2, n)], cream);
  const holes = (d === 0 ? [windows[0], windows.at(-1)] : windows).map((h) => ({
    ...h,
    half: h.w / 2 / towerRadius((h.y0 + h.y1) / 2),
  }));
  const angles = [
    ...new Set([
      0,
      Math.PI * 2,
      ...Array.from({ length: n }, (_, i) => (i * Math.PI * 2) / n),
      ...holes.flatMap((h) =>
        [-1, 1].map((s) => (((h.a + s * h.half) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)),
      ),
    ]),
  ].sort((a, b) => a - b);
  const point = (a, y, depth = 0) => [
    (towerRadius(y) - depth) * Math.sin(a),
    y,
    (towerRadius(y) - depth) * Math.cos(a),
  ];
  const color = (y) => (y >= Y + 24 && y < Y + 38 ? black : cream);
  for (let i = 0; i < angles.length - 1; i++) {
    const a = angles[i],
      b = angles[i + 1],
      mid = (a + b) / 2,
      cover = (h) => Math.abs(Math.atan2(Math.sin(mid - h.a), Math.cos(mid - h.a))) < h.half - 1e-7;
    const ys = [
      Y,
      Y + 24,
      Y + 38,
      Y + 44,
      ...holes.filter(cover).flatMap((h) => [h.y0, h.y1]),
    ].sort((a, b) => a - b);
    for (let j = 0; j < ys.length - 1; j++) {
      const y0 = ys[j],
        y1 = ys[j + 1];
      if (
        y1 - y0 < 1e-7 ||
        holes.some((h) => cover(h) && (y0 + y1) / 2 > h.y0 && (y0 + y1) / 2 < h.y1)
      )
        continue;
      const p = [point(a, y0), point(b, y0), point(b, y1), point(a, y1)];
      quad(out, 'wall', p, normalFor(...p), color((y0 + y1) / 2));
    }
  }
  for (const h of holes) {
    const a = h.a - h.half,
      b = h.a + h.half;
    for (const [p, q] of [
      [
        [a, h.y0],
        [b, h.y0],
      ],
      [
        [b, h.y0],
        [b, h.y1],
      ],
      [
        [b, h.y1],
        [a, h.y1],
      ],
      [
        [a, h.y1],
        [a, h.y0],
      ],
    ]) {
      const ps = [point(...p), point(...q), point(...q, 0.27), point(...p, 0.27)];
      quad(out, 'wall', ps, normalFor(...ps), color((h.y0 + h.y1) / 2));
    }
    const y = (h.y0 + h.y1) / 2,
      r = towerRadius(y),
      q = oriented(out, h.a, r * Math.sin(h.a), r * Math.cos(h.a));
    panel(
      q,
      h.door ? 'wood' : 'glass',
      -h.w / 2,
      h.w / 2,
      h.y0,
      h.y1,
      -0.27,
      h.door ? wood : glass,
    );
    if (d > 1) {
      for (const x of [-h.w / 2, h.w / 2])
        B(q, 'wood', x, h.y0, -0.245, 0.045, h.y1 - h.y0, 0.045, gray);
      for (const y of [h.y0, h.y1]) B(q, 'wood', 0, y, -0.245, h.w, 0.045, 0.045, gray);
      if (!h.door) B(q, 'wood', 0, (h.y0 + h.y1) / 2, -0.24, h.w, 0.045, 0.045, gray);
      if (d > 1 && !h.door)
        for (const y of [h.y0 + (h.y1 - h.y0) / 4, h.y0 + ((h.y1 - h.y0) * 3) / 4])
          B(q, 'wood', 0, y, -0.24, h.w, 0.025, 0.025, gray);
    }
  }
  // Flared neck and actual ten-sided gallery, with hollow air between its rails.
  loft(
    out,
    'wall',
    [radialRing(Y + 43.55, 2.22, 2.22, n), radialRing(Y + 44.15, 2.34, 2.34, n)],
    cream,
  );
  loft(
    out,
    'iron',
    [
      radialRing(Y + 44.12, 2.34, 2.34, 10),
      radialRing(Y + 44.55, 3.15, 3.15, 10),
      radialRing(Y + 44.7, 3.15, 3.15, 10),
    ],
    gold,
  );
  loft(
    out,
    'iron',
    [radialRing(Y + 44.7, 2.16, 2.16, 10), radialRing(Y + 46.3, 2.16, 2.16, 10)],
    gold,
  );
  if (d > 0)
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        rr = 2.7;
      beam(
        out,
        'iron',
        [2.2 * Math.cos(a), Y + 43.65, 2.2 * Math.sin(a)],
        [rr * Math.cos(a), Y + 44.56, rr * Math.sin(a)],
        0.13,
        0.22,
        gold,
      );
    }
  const railCount = d === 0 ? 5 : d === 1 ? 10 : d === 2 ? 30 : 50;
  for (let i = 0; i < railCount; i++) {
    const a = (i * Math.PI * 2) / railCount,
      rr = 3.04,
      pt = [rr * Math.cos(a), Y + 44.7, rr * Math.sin(a)];
    beam(out, 'iron', pt, [pt[0], Y + 45.85, pt[2]], d > 1 ? 0.035 : 0.06, 0.04, gold);
  }
  for (const y of d === 0 ? [Y + 45.85] : [Y + 44.86, Y + 45.3, Y + 45.85])
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        b = ((i + 1) * Math.PI) / 5;
      beam(
        out,
        'iron',
        [3.04 * Math.cos(a), y, 3.04 * Math.sin(a)],
        [3.04 * Math.cos(b), y, 3.04 * Math.sin(b)],
        0.045,
        0.045,
        gold,
      );
    }
  // Ten-pane lantern, modern external guard hoops and shallow roof with ventilator.
  loft(
    out,
    'glass',
    [radialRing(Y + 46.28, 2.075, 2.075, 10), radialRing(Y + 49.55, 2.075, 2.075, 10)],
    glass,
  );
  if (d > 0)
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5;
      beam(
        out,
        'iron',
        [2.08 * Math.cos(a), Y + 46.27, 2.08 * Math.sin(a)],
        [2.08 * Math.cos(a), Y + 49.58, 2.08 * Math.sin(a)],
        0.055,
        0.055,
        gold,
      );
      if (d > 1) {
        beam(
          out,
          'iron',
          [2.58 * Math.cos(a), Y + 45.84, 2.58 * Math.sin(a)],
          [2.58 * Math.cos(a), Y + 49.95, 2.58 * Math.sin(a)],
          0.025,
          0.025,
          gold,
        );
      }
    }
  for (const y of d === 0 ? [Y + 46.28, Y + 49.55] : [Y + 46.28, Y + 47.37, Y + 48.46, Y + 49.55])
    loft(
      out,
      'iron',
      [radialRing(y - 0.026, 2.115, 2.115, 10), radialRing(y + 0.026, 2.115, 2.115, 10)],
      gold,
    );
  if (d > 1)
    for (const y of [Y + 46.3, Y + 49.92])
      loft(
        out,
        'iron',
        [radialRing(y - 0.018, 2.58, 2.58, 10), radialRing(y + 0.018, 2.58, 2.58, 10)],
        gold,
        { cap: false },
      );
  loft(
    out,
    'iron',
    [
      radialRing(Y + 49.53, 2.19, 2.19, 10),
      ...(d > 0 ? [radialRing(Y + 49.69, 2.24, 2.24, 10)] : []),
      radialRing(Y + 50.35, 0.36, 0.36, 10),
      ...(d > 0 ? [radialRing(Y + 50.52, 0.27, 0.27, 10)] : []),
      ...(d > 0 ? [radialRing(Y + 51.5, 0.27, 0.27, 10)] : []),
      radialRing(Y + 51.75, 0.34, 0.34, 10),
      radialRing(Y + 52.1208, 0.07, 0.07, 10),
    ],
    gold,
  );
}
function houseWall(out, d, angle, cx, cz, width, y0, y1, holes = []) {
  const q = oriented(out, angle, cx, cz),
    outer = [
      [-width / 2, y0],
      [width / 2, y0],
      [width / 2, y1],
      [-width / 2, y1],
    ],
    rings = [
      outer,
      ...holes.map((h) =>
        h.circle
          ? Array.from({ length: d < 2 ? 8 : 20 }, (_, i) => [
              h.x + (Math.cos((i * Math.PI * 2) / (d < 2 ? 8 : 20)) * h.w) / 2,
              h.y + (Math.sin((i * Math.PI * 2) / (d < 2 ? 8 : 20)) * h.w) / 2,
            ])
          : [
              [h.x - h.w / 2, h.y],
              [h.x + h.w / 2, h.y],
              [h.x + h.w / 2, h.y + h.h],
              [h.x - h.w / 2, h.y + h.h],
            ],
      ),
    ],
    flat = rings.flat(),
    indices = earcut(
      flat.flat(),
      rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    );
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => [flat[j][0], flat[j][1], 0]);
    q.addTriangle(
      'wall',
      ref,
      p,
      [0, 0, 1],
      p.map((p) => [p[0], p[1]]),
      white,
    );
  }
  for (let j = 1; j < rings.length; j++) {
    const h = holes[j - 1],
      ring = rings[j],
      back = ring.map(([x, y]) => [x, y, -0.19]);
    q.addConvexPolygon(
      h.door ? 'wood' : 'glass',
      ref,
      back,
      [0, 0, 1],
      (p) => [p[0], p[1]],
      h.door ? wood : glass,
    );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], b[1], -0.19],
          [a[0], a[1], -0.19],
        ];
      quad(q, 'wall', p, normalFor(...p), gray);
      if (d > 1) beam(q, 'wood', [a[0], a[1], 0.024], [b[0], b[1], 0.024], 0.055, 0.06, gray);
    }
    if (d > 1 && !h.circle && !h.door) {
      B(q, 'wood', h.x, h.y, -0.15, 0.035, h.h, 0.04, dark);
      for (const y of d === 1
        ? [h.y + h.h / 2]
        : [h.y + h.h / 4, h.y + h.h / 2, h.y + (h.h * 3) / 4])
        B(q, 'wood', h.x, y, -0.15, h.w, 0.035, 0.04, dark);
    }
  }
}
function hip(out, x0, x1, z0, z1, eave, peak) {
  const zm = (z0 + z1) / 2,
    ridge0 = x0 + (z1 - z0) / 2,
    ridge1 = x1 - (z1 - z0) / 2;
  const polygons =
    x1 - x0 >= z1 - z0
      ? [
          [
            [x0, eave, z1],
            [x1, eave, z1],
            [ridge1, peak, zm],
            [ridge0, peak, zm],
          ],
          [
            [x1, eave, z0],
            [x0, eave, z0],
            [ridge0, peak, zm],
            [ridge1, peak, zm],
          ],
          [
            [x0, eave, z0],
            [x0, eave, z1],
            [ridge0, peak, zm],
          ],
          [
            [x1, eave, z1],
            [x1, eave, z0],
            [ridge1, peak, zm],
          ],
        ]
      : [
          [
            [x0, eave, z1],
            [x1, eave, z1],
            [(x0 + x1) / 2, peak, z1 - (x1 - x0) / 2],
          ],
          [
            [x1, eave, z0],
            [x0, eave, z0],
            [(x0 + x1) / 2, peak, z0 + (x1 - x0) / 2],
          ],
          [
            [x0, eave, z0],
            [x0, eave, z1],
            [(x0 + x1) / 2, peak, z1 - (x1 - x0) / 2],
            [(x0 + x1) / 2, peak, z0 + (x1 - x0) / 2],
          ],
          [
            [x1, eave, z1],
            [x1, eave, z0],
            [(x0 + x1) / 2, peak, z0 + (x1 - x0) / 2],
            [(x0 + x1) / 2, peak, z1 - (x1 - x0) / 2],
          ],
        ];
  for (const p of polygons)
    out.addConvexPolygon('iron', ref, p, normalFor(...p), (p) => [p[0], p[2]], red);
}
function baluster(out, d, x, z) {
  if (d < 2) {
    B(out, 'wood', x, 1.05, z, 0.065, 0.83, 0.065, white);
    return;
  }
  const n = d === 2 ? 4 : 6;
  const profile =
    d === 2
      ? [
          [1.05, 0.042],
          [1.49, 0.065],
          [1.88, 0.04],
        ]
      : [
          [1.05, 0.042],
          [1.2, 0.045],
          [1.32, 0.065],
          [1.49, 0.045],
          [1.65, 0.07],
          [1.78, 0.04],
          [1.88, 0.04],
        ];
  loft(
    out,
    'wood',
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    white,
  );
}
function house(out, d) {
  poly(out, houseOutline, 0.74, 0.91, gray);
  if (d === 0) {
    B(out, 'wall', 1.65, 0.9, 21.15, 14.7, 6.1, 9.7, white);
  } else {
    const upperFront = [-5.5, -3.7, 0, 3.8, 5.6].map((x) => ({ x, y: 4.65, w: 1.0, h: 1.85 }));
    houseWall(out, d, 0, 1.65, 26, 14.7, 0.91, 7.0, [
      ...upperFront,
      { x: 0, y: 0.91, w: 1.48, h: 2.48, door: true },
      { x: -4.6, y: 2.2, w: 0.88, circle: true },
      { x: 4.6, y: 2.2, w: 0.88, circle: true },
    ]);
    houseWall(
      out,
      d,
      Math.PI,
      1.65,
      16.3,
      14.7,
      0.91,
      7.0,
      [-4.7, 0, 4.7].flatMap((x) => [1.3, 4.65].map((y) => ({ x, y, w: 1, h: 1.85 }))),
    );
    for (const [angle, x] of [
      [Math.PI / 2, 9],
      [-Math.PI / 2, -5.7],
    ])
      houseWall(
        out,
        d,
        angle,
        x,
        21.15,
        9.7,
        0.91,
        7,
        [-2.8, 0, 2.8].flatMap((x) => [1.3, 4.65].map((y) => ({ x, y, w: 0.95, h: 1.85 }))),
      );
  }
  // Low back rooms and narrow connecting passage are distinct from the two-storey house.
  B(out, 'wall', 1.15, 0.15, 12.8, 5.1, 3.5, 2.8, white);
  B(out, 'wall', 1.15, 0.05, 7.7, 2.65, 2.85, 8.1, white);
  hip(out, -0.175, 2.475, 3.65, 11.75, 2.9, 3.7);
  // The porch roof follows the actual mapped stepped perimeter, not a rectangular terrain pad.
  const inner = [
      [-5.7, 16.3],
      [9, 16.3],
      [9, 26],
      [-5.7, 26],
    ],
    all = [...houseOutline, ...inner],
    idx = earcut(all.flat(), [houseOutline.length]);
  for (let i = 0; i < idx.length; i += 3) {
    let p = idx
      .slice(i, i + 3)
      .map((j) => [all[j][0], j < houseOutline.length ? 3.7 : 4.25, all[j][1]]);
    if (normalFor(...p)[1] < 0) p = p.reverse();
    out.addTriangle(
      'iron',
      ref,
      p,
      normalFor(...p),
      p.map((p) => [p[0], p[2]]),
      red,
    );
  }
  for (let i = 0; i < houseOutline.length; i++) {
    const a = houseOutline[i],
      b = houseOutline[(i + 1) % houseOutline.length];
    beam(out, 'wood', [a[0], 3.64, a[1]], [b[0], 3.64, b[1]], 0.13, 0.18, gray);
  }
  hip(out, -6.1, 9.4, 15.9, 26.4, 7.04, 8.65);
  B(out, 'wood', 1.65, 6.85, 21.15, 15.5, 0.2, 10.5, gray);
  // B above is a thin cornice below the hip roof, not an extra floor.
  const columns =
    d === 0
      ? [
          [-7.5, 28.45],
          [-0.4, 28.45],
          [3.7, 28.45],
          [10.9, 28.45],
        ]
      : [
          ...[-7.5, -4, -0.4, 3.7, 7.3, 10.9].map((x) => [x, 28.45]),
          ...[15, 18.4, 21.8, 25.2].map((z) => [11.05, z]),
          ...[23.3, 25.8].map((z) => [-7.8, z]),
        ];
  for (const [x, z] of columns) {
    B(out, 'floor', x, -0.38, z, d === 0 ? 0.34 : 0.65, 1.2, 0.34, gray);
    for (const offset of d === 0 ? [0] : [-0.17, 0.17]) {
      const xx = x + offset;
      if (d < 2) B(out, 'wood', xx, 0.9, z, 0.13, 2.74, 0.13, white);
      else
        loft(
          out,
          'wood',
          [
            [0.9, 0.105],
            [1.05, 0.105],
            [1.15, 0.075],
            [3.35, 0.065],
            [3.48, 0.1],
            [3.64, 0.12],
          ].map(([y, r]) => radialRing(y, r, r, d === 2 ? 6 : 10, [xx, z])),
          white,
        );
    }
  }
  if (d > 0) {
    const segments = [
      [-7.5, -4, 28.45, 28.45],
      [-4, -0.4, 28.45, 28.45],
      [3.7, 7.3, 28.45, 28.45],
      [7.3, 10.9, 28.45, 28.45],
      [11.05, 11.05, 15, 28.45],
      [-7.8, -7.8, 23.3, 28.45],
    ];
    for (const [x0, x1, z0, z1] of segments) {
      for (const y of [1.03, 1.94]) beam(out, 'wood', [x0, y, z0], [x1, y, z1], 0.08, 0.09, white);
      const len = Math.hypot(x1 - x0, z1 - z0),
        count = Math.ceil(len / (d === 1 ? 0.7 : d === 2 ? 0.26 : 0.24));
      for (let i = 1; i < count; i++) {
        const t = i / count;
        baluster(out, d, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
      }
    }
    // White crisscross skirts enclose the raised porch edge, with real holes.
    const skirts = [
      [-7.5, -0.4, 28.55, 28.55],
      [3.7, 10.9, 28.55, 28.55],
      [11.12, 11.12, 14.1, 28.55],
      [-7.95, -7.95, 22.9, 28.55],
    ];
    for (const [x0, x1, z0, z1] of skirts) {
      const len = Math.hypot(x1 - x0, z1 - z0),
        count = Math.ceil(len / (d === 1 ? 3.3 : d === 2 ? 0.6 : 0.3));
      beam(out, 'wood', [x0, 0.12, z0], [x1, 0.12, z1], 0.065, 0.065, white);
      for (let i = 0; i < count; i++)
        for (const reverse of [false, true]) {
          const t0 = i / count,
            t1 = (i + 1) / count;
          beam(
            out,
            'wood',
            [x0 + (x1 - x0) * t0, reverse ? 0.72 : 0.12, z0 + (z1 - z0) * t0],
            [x0 + (x1 - x0) * t1, reverse ? 0.12 : 0.72, z0 + (z1 - z0) * t1],
            d === 1 ? 0.07 : 0.035,
            0.035,
            white,
          );
        }
    }
    // Ground-floor porch stays genuinely open around the recessed main house wall.
    for (let i = 0; i < 5; i++)
      B(out, 'wood', 1.65, 0.03, 29.65 - i * 0.2, 2.9, 0.18 + i * 0.17, 2.0 - i * 0.4, gray);
    for (const x of [0.14, 3.16])
      beam(out, 'wood', [x, 0.95, 30.65], [x, 1.85, 28.75], 0.055, 0.055, white);
    B(out, 'wall', -3.7, 7.2, 20.6, 0.65, 2.1, 0.78, white);
    // Small hip-roof dormer and its inset front sash.
    B(out, 'wood', 1.65, 7.6, 25.1, 1.45, 1.0, 0.95, gray);
    panel(out, 'glass', 1.12, 2.18, 7.75, 8.38, 25.59, glass);
    hip(out, 0.75, 2.55, 24.55, 25.85, 8.57, 8.93);
    if (d > 1) {
      for (let x = -5.6; x < 9.4; x += 0.95) {
        const zh = 26.4 - (26.4 - 21.15) * Math.min(1, Math.min(x + 6.1, 9.4 - x) / 5.25),
          yh = 7.04 + (8.65 - 7.04) * Math.min(1, (26.4 - zh) / 5.25);
        beam(out, 'iron', [x, 7.06, 26.38], [x, yh + 0.022, zh], 0.025, 0.025, redEdge);
      }
      for (let x = -5.6; x < 9.4; x += 0.95) {
        const zh = 15.9 + 5.25 * Math.min(1, Math.min(x + 6.1, 9.4 - x) / 5.25),
          yh = 7.04 + (1.61 * (zh - 15.9)) / 5.25;
        beam(out, 'iron', [x, 7.06, 15.92], [x, yh + 0.022, zh], 0.025, 0.025, redEdge);
      }
      for (let z = 16.4; z < 26.4; z += 0.95)
        for (const sign of [-1, 1]) {
          const dist = Math.min(z - 15.9, 26.4 - z),
            x = sign < 0 ? -6.1 : 9.4,
            xx = x - sign * dist,
            y = 7.04 + (1.61 * dist) / 5.25;
          beam(out, 'iron', [x, 7.06, z], [xx, y + 0.022, z], 0.025, 0.025, redEdge);
        }
      for (let x = -5.6; x < 9.3; x += 0.65)
        B(out, 'wood', x, 6.65, 26.14, 0.12, 0.26, 0.34, white);
    }
  }
}
export function abseconLighthouse(out, _frame, d = 3) {
  tower(out, d);
  house(out, d);
}
export function abseconLighthouseSkyline(out) {
  abseconLighthouse(out, undefined, 0);
}
export function abseconLighthouseDistrict(out) {
  abseconLighthouse(out, undefined, 1);
}
export function abseconLighthouseStreet(out) {
  abseconLighthouse(out, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.83, metallic: 0.12 },
  floor: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.36, metallic: 0.08 },
};
const nativeTower = [
  [-2.3542194573463706, 2.163305332016048],
  [-2.9780242859792687, 1.3407662206081752],
  [-3.196079958209905, -0.8259894936956408],
  [-1.8629041503481558, -2.4848687090568737],
  [-0.8333501590544472, -3.0065461984958817],
  [0.7151211206033897, -3.0148267943594877],
  [2.1642252604439447, -2.2999354186492074],
  [2.7880300911593134, -1.4773963072524707],
  [3.0060857604722635, 0.6893594066504416],
  [2.086939706134774, 2.5524933004328636],
  [0.7482435020031835, 3.1790583294891737],
  [-0.2840706868018188, 3.1845787255641316],
];

export const abseconLighthouseModel = {
  id: 'absecon_lighthouse',
  key: 'absecon_lighthouse',
  recipe: 'structure-absecon-lighthouse.mjs',
  cell: 'dq/dqg',
  title: 'Absecon Lighthouse',
  build: abseconLighthouse,
  surfaces,
  brief:
    'Present cream-black-cream tapering painted-brick lighthouse, sparse deeply recessed sash lights, flared pale neck and ten-sided projecting corbelled gallery, open pale/gold iron rail, tall gridded decagonal lantern with guard hoops, shallow pyramidal roof/ventilator. Native reconstructed two-storey keeper house with red standing-seam hip roof, small dormer, white chimney, bracketed cornice, five upper front sashes/two round lower lights, central entrance/stairs and open paired-column wraparound porch/balustrade, lower rear rooms and low tower link. Detached oil house/former assistant quarters, gardens and nearby buildings excluded.',
  camera: [58, 31, 68],
  lookAt: [0, 25, 10],
  qaCameras: [
    { name: 'whole-site', position: [60, 28, 70], lookAt: [0, 25, 10] },
    { name: 'keeper-house-front', position: [30, 12, 57], lookAt: [1.65, 4.4, 22] },
    { name: 'porch-and-entrance', position: [12, 4, 41], lookAt: [1.65, 2, 26] },
    { name: 'house-rear-and-link', position: [26, 10, -10], lookAt: [1.5, 3.5, 14] },
    { name: 'tower-base-and-sash', position: [-14, 8, -19], lookAt: [0, 4, 0] },
    { name: 'gallery-and-lantern', position: [12, 51, 15], lookAt: [0, 47.4, 0] },
  ],
  mediumFiContext: { scale: 0.9 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native tower centroid and signed mapped keeper-house front frame. External dry front-right footway12.054,32.437 defines2.2735m provider datum; original source-specific USGS NJ_South_Jersey_Lidar_2018_B18 raster130843/2019acquisition resampled before geometry. Source heights unchanged. Native tower ring only is clipped beneath physical shaft/footing; original ground beneath raised house/porch remains. Exact current paving/foundations are not surveyed.',
  groundCutout: {
    outline: nativeTower,
    basis:
      'Original quantized native tower ring only, fully covered by actual wider brick shaft/own narrow footing. Raised keeper-house/porch and connecting approach retain their original source ground. No garden, plaza or fitted platform.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-absecon-lighthouse.mjs',
    level: 'skyline',
    export: 'abseconLighthouseSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'abseconLighthouseDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'abseconLighthouseStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    'Operator171ft supplies approximate52.1208m full tower height; model baseY-.12 is relative to separate external dry-footway datum, not sea level. HABS1964 graphic-scale interpretation controls approximately8.2m base/6.3m gallery and historic lantern structure, with explicit original standards caveat. Native ring is narrower/quantized and remains geographic control, not a surveyed present brick edge.',
    'Five full local exterior photos plus local1964 lantern drawing,30 thumbnails and three official original HABS sheets inspected. Current black-band proportions use distant photograph10 rather than historic paint depiction. Unseen rear sash positions, modern guard hoops, restored house wall/roof elevations, low link and architectural details remain photographic estimates.',
    'Reconstructed keeper-house museum opened2001 per operator. Historic drawings do not measure this present house. Modern buildings, detached oil house, former assistant quarters, gardens/fences/lamps and navigable interiors excluded. No reference pixels used as textures.',
    'Original USGS one-metre field remains unchanged;66049derived values and203401original pixels verified. Source classification/interpolation at hidden foundations/paving remains uncertain; default coarse Earth ground and whole neighborhood compatibility are not certified.',
  ],
};
