/** Independent medium-fi Karlštejn derivative. Original detailed master stays untouched. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const map = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2f/karlstejn_castle/map-parts.json',
      import.meta.url,
    ),
  ),
);

const grade = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u2f/karlstejn_castle/site-grade.json',
      import.meta.url,
    ),
  ),
);
const workingFloors = grade.workingFloors;
const rootLifts = [
  [48.139, -32.947, 12.890999999999998],
  [46.5, -6.4, 5.890999999999998],
  [36.557, 14.273, 7.269],
  [43.45, 26.72, 7.269],
  [17.8, 48, 9.796],
  [57, 32.7, 6.795999999999999],
  [64.6, 54.1, 9.796],
  [-32.5, 56.4, 0.841],
  [-13.8, 63.4, 0.841],
  [-3.5, 63.8, 0.841],
  [-40.8, 49.8, -3.508],
  [-70.5, 44.2, -14.939],
  [48.434, -3.652, 6.579999999999998],
  [42.25, 39.3, 7.269],
];
function rootLift(x, z) {
  return rootLifts.find((p) => Math.abs(p[0] - x) < 0.002 && Math.abs(p[1] - z) < 0.002)?.[2] ?? 0;
}
export function karlstejnGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function foundations(o) {
  for (const id of [
    443238530, 443238531, 443238533, 449117940, 453018670, 695579421, 453018671, 453018676,
    495183288,
  ]) {
    const p = ring(id),
      hi = workingFloors[id] - 0.04,
      area = p.reduce((sum, a, i) => {
        const b = p[(i + 1) % p.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        n = Math.max(
          1,
          Math.ceil(
            Math.hypot(b[0] - a[0], b[1] - a[1]) /
              (o.detail === 'skyline' ? 1000 : o.detail === 'district' ? 8 : 4),
          ),
        );
      for (let j = 0; j < n; j++) {
        const u = mix(a, b, j / n),
          v = mix(a, b, (j + 1) / n);
        const wall = [
          [u[0], karlstejnGround(...u) - 4, u[1]],
          [v[0], karlstejnGround(...v) - 4, v[1]],
          [v[0], hi, v[1]],
          [u[0], hi, u[1]],
        ];
        // Mapped rings have both windings; retain front faces toward the outside.
        face(o, 'stone', area > 0 ? wall.reverse() : wall, stone);
      }
    }
  }
}
const plaster = [0.86, 0.8, 0.66],
  trim = [0.72, 0.67, 0.56],
  stone = [0.54, 0.52, 0.45],
  wood = [0.22, 0.13, 0.08],
  slate = [0.24, 0.26, 0.28],
  glass = [0.095, 0.115, 0.105];
const master = (o) => !o.detail,
  near = (o) => !['skyline', 'district'].includes(o.detail),
  fine = (o) => !['skyline', 'district', 'street'].includes(o.detail);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  color = (a, t) => a.map((v) => v * t);
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
const tri = (o, s, p, c) =>
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    c,
  );
function frame(o, x = 0, y = 0, z = 0, a = 0) {
  if (!o.localFrame) y += rootLift(x, z);
  const c = Math.cos(a),
    s = Math.sin(a),
    rot = ([x, y, z]) => [x * c + z * s, y, -x * s + z * c];
  return {
    detail: o.detail,
    localFrame: true,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (slot, ref, p, n, uv, col) =>
          o[k](
            slot,
            ref,
            p.map((v) => {
              const q = rot(v);
              return [q[0] + x, q[1] + y, q[2] + z];
            }),
            rot(n),
            uv,
            col,
          ),
      ]),
    ),
  };
}
const edgeFrame = (o, a, b) => frame(o, a[0], 0, a[1], Math.atan2(a[1] - b[1], b[0] - a[0]));
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
function points(id) {
  return map.features.find((f) => f.id === `way/${id}`).points.map((p) => [...p]);
}
function ring(id) {
  const p = points(id);
  if (p[0].join() === p.at(-1).join()) p.pop();
  return area(p) < 0 ? p.reverse() : p;
}
function cap(o, p, y, slot = 'stone', c = stone) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][2] - q[0][2]) - (q[2][0] - q[0][0]) * (q[1][2] - q[0][2]),
      ) < 0.0001
    )
      continue;
    if (normalFor(...q)[1] < 0) q.reverse();
    tri(o, slot, q, c);
  }
}
function prism(o, p, lo, hi, slot = 'plaster', c = plaster) {
  cap(o, p, hi, slot, c);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      slot,
      [
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
        [b[0], lo, b[1]],
        [a[0], lo, a[1]],
      ],
      c,
    );
  }
}
const rectangle = (x, z, w, d) => [
  [x, z],
  [x + w, z],
  [x + w, z + d],
  [x, z + d],
];
function line(o, a, b, w = 0.12, slot = 'carved', c = trim) {
  if (Math.hypot(...b.map((v, i) => v - a[i])) < 0.001) return;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (master(o) || len < 0.001) {
    beam(o, slot, a, b, w, w, c);
    return;
  }
  const dx = ((b[1] - a[1]) * w) / (2 * len),
    dy = ((a[0] - b[0]) * w) / (2 * len),
    p = [
      [a[0] - dx, a[1] - dy, a[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [a[0] + dx, a[1] + dy, a[2]],
    ];
  if (normalFor(...p)[2] < 0) p.reverse();
  face(o, slot, p, c);
}
function opening(x, y, w, h, pointed = false, steps = 12) {
  const p = [
    [x - w / 2, y],
    [x + w / 2, y],
  ];
  if (!pointed) return [...p, [x + w / 2, y + h], [x - w / 2, y + h]];
  const spring = y + h - (Math.sqrt(3) * w) / 2;
  for (let i = 0; i <= steps; i++) {
    const u = w / 2 - (w * i) / steps;
    const dx = u >= 0 ? u + w / 2 : u - w / 2;
    p.push([x + u, spring + Math.sqrt(Math.max(0, w * w - dx * dx))]);
  }
  return p;
}
function panel(o, w, lo, hi, windows = [], slot = 'plaster', c = plaster) {
  const valid = o.detail === 'skyline' ? [] : windows;
  const all = [
    [
      [0, lo],
      [w, lo],
      [w, hi],
      [0, hi],
    ],
    ...valid.map((v) => opening(v[0], v[1], v[2], v[3], v[4], o.detail === 'district' ? 6 : 12)),
  ];
  const p = all.flat(),
    holes = [];
  let n = 4;
  for (const r of all.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ix = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ix.length; i += 3) {
    const q = ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    if (
      Math.abs(
        (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[2][0] - q[0][0]) * (q[1][1] - q[0][1]),
      ) < 0.00001
    )
      continue;
    if (normalFor(...q)[2] < 0) q.reverse();
    tri(o, slot, q, c);
  }
  for (let i = 0; i < valid.length; i++) {
    const v = valid[i],
      r = all[i + 1];
    const ix = earcut(r.flat());
    for (let k = 0; k < ix.length; k += 3) {
      const p = ix.slice(k, k + 3).map((j) => [r[j][0], r[j][1], -0.34]);
      if (normalFor(...p)[2] < 0) p.reverse();
      tri(o, 'glass', p, glass);
    }
    if (fine(o)) {
      for (let j = 0; j < r.length; j++) {
        const a = r[j],
          b = r[(j + 1) % r.length];
        face(
          o,
          'carved',
          [
            [a[0], a[1], 0],
            [b[0], b[1], 0],
            [b[0], b[1], -0.34],
            [a[0], a[1], -0.34],
          ],
          trim,
        );
        line(o, [a[0], a[1], 0.07], [b[0], b[1], 0.07], 0.16);
      }
      if (v[2] > 1.1) {
        line(o, [v[0], v[1], -0.12], [v[0], v[1] + v[3] - 0.2, -0.12], 0.09, 'wood', wood);
        line(
          o,
          [v[0] - v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          [v[0] + v[2] / 2, v[1] + v[3] * 0.48, -0.12],
          0.08,
          'wood',
          wood,
        );
      }
    }
    if (master(o))
      for (let y = v[1] + 0.28; y < v[1] + v[3] - (v[4] ? v[2] * 0.9 : 0.15); y += 0.42)
        line(
          o,
          [v[0] - v[2] * 0.42, y, -0.19],
          [v[0] + v[2] * 0.42, y, -0.19],
          0.025,
          'metal',
          [0.24, 0.23, 0.2],
        );
  }
}
function band(o, w, y, slot = 'carved', c = trim) {
  if (master(o)) box(o, slot, [0, y - 0.12, -0.02], [w, y + 0.12, 0.16], c);
  else
    face(
      o,
      slot,
      [
        [0, y - 0.12, 0.06],
        [w, y - 0.12, 0.06],
        [w, y + 0.12, 0.06],
        [0, y + 0.12, 0.06],
      ],
      c,
    );
}
function boards(o, w, y, h, half = false) {
  box(o, 'wood', [-0.42, y, -0.42], [w + 0.42, y + h, 0.28], wood);
  if (!near(o)) return;
  for (let x = -0.32; x < w + 0.3; x += master(o) ? 0.22 : 0.65) {
    if (master(o))
      box(
        o,
        'wood',
        [x, y + 0.07, 0.28],
        [x + 0.15, y + h - 0.07, 0.32],
        color(wood, 0.86 + 0.07 * (((Math.round(x * 100) % 5) + 5) % 5)),
      );
    else
      face(
        o,
        'wood',
        [
          [x, y + 0.07, 0.32],
          [x + 0.15, y + 0.07, 0.32],
          [x + 0.15, y + h - 0.07, 0.32],
          [x, y + h - 0.07, 0.32],
        ],
        wood,
      );
  }
  if (half) {
    for (let x = 0.2; x < w - 0.3; x += 2.4) {
      box(
        o,
        'plaster',
        [x, y + 0.45, 0.32],
        [Math.min(x + 2.1, w - 0.1), y + h - 0.25, 0.35],
        plaster,
      );
      line(o, [x, y + 0.4, 0.42], [Math.min(x + 2.1, w - 0.1), y + 1.15, 0.42], 0.15, 'wood', wood);
    }
  }
  for (let x = 0.8; x < w; x += 1.4) {
    line(o, [x, y - 0.8, -0.02], [x, y, 0.45], 0.2, 'wood', wood);
    if (fine(o)) {
      face(
        o,
        'recess',
        [
          [x - 0.12, y + h * 0.55, 0.35],
          [x + 0.12, y + h * 0.55, 0.35],
          [x + 0.12, y + h * 0.55 + 0.32, 0.35],
          [x - 0.12, y + h * 0.55 + 0.32, 0.35],
        ],
        [0.06, 0.055, 0.05],
      );
    }
  }
}
function roofFacet(o, a, b, c, d) {
  const q = [a, b, c, d];
  if (normalFor(...q)[1] < 0) q.reverse();
  if (Math.hypot(...c.map((v, i) => v - d[i])) < 0.001)
    tri(o, 'slate', normalFor(a, b, c)[1] < 0 ? [c, b, a] : [a, b, c], slate);
  else face(o, 'slate', q, slate);
  if (!fine(o)) return;
  const distance = Math.hypot(...d.map((v, i) => v - a[i])),
    rows = Math.ceil(distance / (master(o) ? 0.34 : 1.3));
  const normal = normalFor(...q);
  for (let r = 0; r < rows; r++) {
    const t0 = r / rows + 0.004,
      t1 = (r + 1) / rows - 0.004,
      l0 = mix(a, d, t0),
      r0 = mix(b, c, t0),
      l1 = mix(a, d, t1),
      r1 = mix(b, c, t1),
      width = Math.hypot(...r0.map((v, i) => v - l0[i])),
      count = Math.max(1, Math.ceil(width / (master(o) ? 0.3 : 1.25)));
    for (let j = 0; j < count; j++) {
      const u0 = (j + 0.025) / count,
        u1 = (j + 0.975) / count;
      const p = [mix(l0, r0, u0), mix(l0, r0, u1), mix(l1, r1, u1), mix(l1, r1, u0)].map((p) =>
        p.map((v, i) => v + normal[i] * 0.028),
      );
      if (normalFor(...p)[1] < 0) p.reverse();
      face(o, 'slate', p, color(slate, 0.84 + ((r * 7 + j * 13) % 11) * 0.032));
    }
  }
}
function hip(o, w, d, y, h, finials = false) {
  const x = -0.6,
    z = -0.6,
    W = w + 1.2,
    D = d + 1.2;
  const a = [x, y, z],
    b = [x + W, y, z],
    c = [x + W, y, z + D],
    e = [x, y, z + D];
  let u, v;
  if (D > W) {
    u = [w / 2, y + h, W / 2 - 0.6];
    v = [w / 2, y + h, d - W / 2 + 0.6];
    roofFacet(o, a, b, u, u);
    roofFacet(o, b, c, v, u);
    roofFacet(o, c, e, v, v);
    roofFacet(o, e, a, u, v);
  } else {
    u = [W / 2 - 0.6, y + h, d / 2];
    v = [w - W / 2 + 0.6, y + h, d / 2];
    roofFacet(o, a, b, v, u);
    roofFacet(o, b, c, v, v);
    roofFacet(o, c, e, u, v);
    roofFacet(o, e, a, u, u);
  }
  if (finials) {
    for (const p of [u, v]) {
      box(
        o,
        'metal',
        [p[0] - 0.04, p[1], p[2] - 0.04],
        [p[0] + 0.04, p[1] + 2, p[2] + 0.04],
        [0.26, 0.25, 0.22],
      );
    }
  }
  if (!near(o)) return;
  line(o, u, v, 0.16, 'metal', slate);
  for (const p of [a, b, c, e])
    line(
      o,
      p,
      Math.hypot(p[0] - u[0], p[2] - u[2]) < Math.hypot(p[0] - v[0], p[2] - v[2]) ? u : v,
      0.11,
      'metal',
      slate,
    );
  // Small triangular slate dormers on the long roof slopes.
  const long = D > W ? d : w,
    count = Math.max(1, Math.floor((long - 5) / 4));
  for (const side of [-1, 1])
    for (let j = 0; j < count; j++) {
      const t = ((j + 1) * long) / (count + 1),
        f =
          D > W
            ? frame(o, w / 2 + side * w * 0.38, y + h * 0.22, t, (side * Math.PI) / 2)
            : frame(o, t, y + h * 0.22, d / 2 + side * d * 0.38, side > 0 ? 0 : Math.PI);
      const p = [
        [-0.48, 0, 0.25],
        [0.48, 0, 0.25],
        [0, 0.9, 0.25],
      ];
      tri(f, 'wood', p, wood);
      face(
        f,
        'slate',
        [
          [-0.5, 0, 0.28],
          [0, 0.95, 0.28],
          [0, 0.95, -0.7],
          [-0.5, 0, -0.7],
        ],
        slate,
      );
      face(
        f,
        'slate',
        [
          [0, 0.95, 0.28],
          [0.5, 0, 0.28],
          [0.5, 0, -0.7],
          [0, 0.95, -0.7],
        ],
        slate,
      );
    }
}
function fourWalls(
  o,
  w,
  d,
  lo,
  hi,
  rows,
  { hoarding = 0, half = false, palaceLoggia = false } = {},
) {
  const facets = [
    [frame(o, w, 0, 0, Math.PI), w],
    [frame(o, 0, 0, d), w],
    [frame(o, w, 0, d, Math.PI / 2), d],
    [frame(o, 0, 0, 0, -Math.PI / 2), d],
  ];
  for (let i = 0; i < 4; i++) {
    const [f, len] = facets[i],
      windows = [];
    for (const row of rows) {
      const count = row.count ?? Math.max(1, Math.floor((len - 2) / row.pitch));
      for (let j = 0; j < count; j++)
        windows.push([
          ((j + 1) * len) / (count + 1),
          lo + row.y,
          row.w,
          row.h,
          row.pointed ?? false,
        ]);
    }
    const facadeWindows =
      palaceLoggia && i === 1
        ? [
            ...windows.filter(
              ([x, y, width, height]) =>
                !(x - width / 2 < 11 && x + width / 2 > 2 && y < 17 && y + height > 9),
            ),
            [3.5, 10, 1.8, 5.5, true],
            [6, 10, 1.8, 5.5, true],
            [8.5, 10, 1.8, 5.5, true],
          ]
        : windows;
    panel(f, len, lo, hi, facadeWindows);
    if (near(o)) {
      for (const y of [lo + 1.2, ...rows.slice(1).map((r) => lo + r.y - 1.2)]) band(f, len, y);
      if (fine(o))
        for (let y = lo + 0.3; y < hi; y += 0.72)
          for (const x of [0.25, len - 0.25])
            box(
              f,
              'carved',
              [x - 0.24, y, 0.04],
              [x + 0.24, y + 0.64, 0.12],
              color(trim, 0.94 + 0.02 * (Math.floor(y) % 4)),
            );
    }
    if (hoarding) boards(f, len, hi - hoarding, hoarding, half);
  }
  cap(o, rectangle(0, 0, w, d), hi, 'wood', wood);
}
function majorTowers(o) {
  const g = edgeFrame(o, [48.139, -32.947], [64.507, -29.634]);
  const w = 16.7,
    d = 25.4;
  fourWalls(
    g,
    w,
    d,
    13,
    60,
    [
      { y: 5, w: 1.5, h: 2.3, pitch: 7 },
      { y: 18, w: 1.65, h: 5.2, count: 1, pointed: true },
      { y: 32, w: 1.05, h: 2.3, pitch: 4 },
      { y: 38, w: 0.8, h: 1, pitch: 4 },
    ],
    { hoarding: 3.5 },
  );
  hip(g, w, d, 60, 13, true);
  if (near(o)) {
    for (const z of [5, 20]) {
      box(g, 'carved', [8.05, 65, z], [8.85, 69, z + 1.2], trim);
      box(g, 'carved', [7.94, 69, z - 0.1], [8.96, 69.4, z + 1.3], trim);
    }
    const porch = frame(o, 46.5, 0, -6.4, -0.23);
    fourWalls(porch, 5.9, 2.9, 20, 39, [
      { y: 5, w: 0.6, h: 1.3, count: 2 },
      { y: 12, w: 0.55, h: 1.1, count: 2 },
    ]);
    hip(porch, 5.9, 2.9, 39, 6);
  }
  const m = edgeFrame(o, [36.557, 14.273], [53.542, 16.66]);
  fourWalls(
    m,
    17.15,
    23.55,
    8,
    32,
    [
      { y: 4, w: 1.4, h: 2.2, pitch: 5 },
      { y: 11, w: 1.7, h: 3.7, pitch: 6, pointed: true },
      { y: 18, w: 1.15, h: 1.8, pitch: 4 },
    ],
    { hoarding: 3 },
  );
  hip(m, 17.15, 23.55, 32, 10, true);
  const f = frame(o, 43.45, 0, 26.72);
  loft(f, 'slate', [radialRing(40.5, 1.2, 1.2, 8), radialRing(44, 1.05, 1.05, 8)], slate, {
    cap: true,
  });
  if (o.detail === 'skyline')
    loft(f, 'slate', [radialRing(44, 1.05, 1.05, 8), radialRing(52, 0.03, 0.03, 8)], slate, {
      cap: true,
    });
  else {
    loft(f, 'recess', [radialRing(44, 1, 1, 8), radialRing(46, 1, 1, 8)], glass, { cap: true });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      line(f, [Math.cos(a), 44, Math.sin(a)], [Math.cos(a), 46, Math.sin(a)], 0.13, 'carved', trim);
    }
    loft(f, 'slate', [radialRing(46, 1.15, 1.15, 8), radialRing(52, 0.03, 0.03, 8)], slate, {
      cap: true,
    });
  }
}
function palace(o) {
  const p = frame(o, 17.8, 0, 48, -0.022);
  fourWalls(
    p,
    42,
    10.7,
    4,
    24,
    [
      { y: 3, w: 1.15, h: 1.8, pitch: 5 },
      { y: 9, w: 1.5, h: 2.6, pitch: 5 },
      { y: 15, w: 1, h: 1.35, pitch: 4 },
    ],
    { hoarding: 2.1, palaceLoggia: true },
  );
  hip(p, 42, 10.7, 24, 9, true);
  const e = frame(o, 57, 0, 32.7);
  fourWalls(e, 7.2, 16, 7, 25, [
    { y: 5, w: 1, h: 2.2, pitch: 4 },
    { y: 12, w: 0.7, h: 1.2, pitch: 3 },
  ]);
  hip(e, 7.2, 16, 25, 7);
  const f = frame(o, 64.6, 0, 54.1);
  const sides = o.detail === 'skyline' ? 10 : near(o) ? 40 : 16;
  loft(
    f,
    'plaster',
    [radialRing(4, 5.85, 5.85, sides), radialRing(26, 5.85, 5.85, sides)],
    plaster,
    { cap: true },
  );
  loft(f, 'slate', [radialRing(26, 6.35, 6.35, sides), radialRing(38, 0.04, 0.04, sides)], slate, {
    cap: true,
  });
  if (near(o))
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        g = frame(f, Math.sin(a) * 5.88, 0, Math.cos(a) * 5.88, a);
      panel(g, 0.85, 23, 24.3, [], 'recess', glass);
      if (fine(o)) line(g, [0.43, 23, 0], [0.43, 24.3, 0], 0.07, 'wood', wood);
    }
  // The loggia apertures are cut in the palace wall above; do not cover them with a second wall.
  if (near(o)) {
    const log = frame(p, 2, 0, 10.7);
    band(log, 8, 9.3);
  }
}
function archPassage(o, w, d, y, h) {
  const r = w * 0.29,
    spring = y + 3.2,
    steps = near(o) ? 16 : 6;
  box(o, 'plaster', [0, y, 0], [w / 2 - r, y + h, d], plaster);
  box(o, 'plaster', [w / 2 + r, y, 0], [w, y + h, d], plaster);
  const top = spring + r;
  box(o, 'plaster', [w / 2 - r, top, 0], [w / 2 + r, y + h, d], plaster);
  for (let i = 0; i < steps; i++) {
    const a = Math.PI - (i * Math.PI) / steps,
      b = Math.PI - ((i + 1) * Math.PI) / steps;
    const x0 = w / 2 + r * Math.cos(a),
      x1 = w / 2 + r * Math.cos(b),
      y0 = spring + r * Math.sin(a),
      y1 = spring + r * Math.sin(b);
    for (const z of [0, d]) {
      const q = [
        [x0, y0, z],
        [x1, y1, z],
        [x1, top, z],
        [x0, top, z],
      ];
      if (Math.abs(y0 - top) < 0.00001) tri(o, 'plaster', [q[0], q[1], q[2]], plaster);
      else if (Math.abs(y1 - top) < 0.00001) tri(o, 'plaster', [q[0], q[1], q[3]], plaster);
      else face(o, 'plaster', z === 0 ? q.slice().reverse() : q, plaster);
    }
    face(
      o,
      'carved',
      [
        [x0, y0, 0],
        [x1, y1, 0],
        [x1, y1, d],
        [x0, y0, d],
      ],
      trim,
    );
    if (near(o)) for (const z of [-0.08, d + 0.08]) line(o, [x0, y0, z], [x1, y1, z], 0.22);
  }
}
function gate(o, a, b, d, base, height) {
  base =
    workingFloors[
      Math.abs(a[0] - 12.39) < 0.01
        ? 453018676
        : Math.abs(a[0] - 23.39) < 0.01
          ? 495183288
          : 453018671
    ];
  const f = edgeFrame(o, a, b),
    w = Math.hypot(b[0] - a[0], b[1] - a[1]);
  archPassage(f, w, d, base, height - 4);
  hip(f, w, d, base + height - 4, 4, true);
  if (near(o))
    for (const z of [-0.03, d + 0.03]) {
      const v = frame(f, 0, 0, z, z < 0 ? Math.PI : 0);
      if (z < 0) continue;
      panel(
        v,
        w,
        base + height - 7,
        base + height - 4,
        [[w * 0.5, base + height - 6.5, 0.65, 1.2]],
        'plaster',
        plaster,
      );
    }
}
function passages(o) {
  // Timber skyway is elevated across open air; the ground remains visible below.
  const f = edgeFrame(o, [48.434, -3.652], [50.415, -3.152]);
  const w = 2.05,
    d = 19.2,
    lo = 24.5;
  box(f, 'wood', [-0.12, lo, -0.1], [w + 0.12, lo + 0.35, d + 0.1], wood);
  for (const side of [0, w]) {
    box(f, 'wood', [side - 0.08, lo + 0.35, 0], [side + 0.08, lo + 2.7, d], wood);
    if (near(o)) {
      for (let z = 0.45; z < d; z += 1.1) {
        box(
          f,
          'wood',
          [side - 0.14, lo + 0.35, z],
          [side + 0.14, lo + 2.7, z + 0.15],
          color(wood, 1.2),
        );
        if (fine(o)) line(f, [side, lo + 0.45, z], [side, lo + 2.55, z + 0.9], 0.11, 'wood', wood);
      }
      for (let z = 1; z < d; z += 2.2)
        box(f, 'recess', [side - 0.16, lo + 1.3, z], [side + 0.16, lo + 2.05, z + 0.58], glass);
    }
  }
  hip(f, w, d, lo + 2.7, 1.8);
  // Masonry arcaded palace passage; a real opening under its elevated deck.
  const a = frame(o, 42.25, 0, 39.3);
  const bottom = karlstejnGround(43, 41) - (workingFloors[443238531] - 8) - 4;
  box(a, 'plaster', [0, bottom, 0], [3.5 * 0.21, 12, 4], plaster);
  box(a, 'plaster', [3.5 * 0.79, bottom, 0], [3.5, 12, 4], plaster);
  archPassage(a, 3.5, 4, 12, 7.2);
  box(a, 'plaster', [0, 19.2, 0], [3.5, 21.8, 4], plaster);
  hip(a, 3.5, 4, 21.8, 2.2);
}
function burgrave(o) {
  for (const [a, b, d] of [
    [[-32.5, 56.4], [-13.8, 63.4], 8.2],
    [[-13.8, 63.4], [-3.5, 63.8], 7.3],
    [[-3.5, 63.8], [6, 62.3], 7.5],
  ]) {
    const f = edgeFrame(o, a, b),
      w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    fourWalls(
      f,
      w,
      d,
      1,
      17,
      [
        { y: 4, w: 1.1, h: 1.7, pitch: 4 },
        { y: 9, w: 1.2, h: 1.7, pitch: 4 },
      ],
      { hoarding: 3.8, half: true },
    );
    hip(f, w, d, 17, 8);
  }
  const f = edgeFrame(o, [-40.8, 49.8], [-31.2, 47.4]);
  fourWalls(
    f,
    10,
    14,
    1,
    18,
    [
      { y: 4, w: 1.2, h: 2, pitch: 4 },
      { y: 10, w: 1.2, h: 2, pitch: 4 },
    ],
    { hoarding: 3.5, half: true },
  );
  hip(f, 10, 14, 18, 7);
  const well = frame(o, -70.5, 0, 44.2);
  const sides = o.detail === 'skyline' ? 10 : 24;
  loft(well, 'plaster', [radialRing(1, 4.4, 5, sides), radialRing(8, 4.4, 5, sides)], plaster, {
    cap: true,
  });
  loft(well, 'slate', [radialRing(8, 4.9, 5.5, sides), radialRing(13, 0.05, 0.05, sides)], slate, {
    cap: true,
  });
  if (near(o)) {
    const v = frame(well, -2, 0, 4.6);
    panel(v, 4, 2, 6, [[2, 2.3, 1.3, 2.7, true]]);
  }
}
const level = (x, z) => karlstejnGround(x, z) + 0.15;
function site(o) {
  foundations(o);
}
function wallLine(o, id, height = 4) {
  const p = points(id);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.3) continue;
    const f = edgeFrame(o, a, b);
    const ya = level(...a),
      yb = level(...b);

    const h1 = ya + height,
      h2 = yb + height;
    const w = 0.95;
    for (const side of [-w, w]) {
      const p = [
        [0, ya - 4, side],
        [len, yb - 4, side],
        [len, h2, side],
        [0, h1, side],
      ];
      face(f, 'stone', side < 0 ? p.reverse() : p, stone);
    }
    face(
      f,
      'stone',
      [
        [0, h1, w],
        [len, h2, w],
        [len, h2, -w],
        [0, h1, -w],
      ],
      stone,
    );
    if (['skyline', 'district'].includes(o.detail)) continue;
    const n = Math.max(1, Math.ceil(len / 2.3));
    for (let k = 0; k < n; k++) {
      const x = ((k + 0.15) * len) / n,
        y = h1 + ((h2 - h1) * (k + 0.35)) / n;
      box(f, 'stone', [x, y, -w], [Math.min(x + (len / n) * 0.56, len), y + 1.1, w], stone);
      if (fine(o))
        box(
          f,
          'slate',
          [x - 0.05, y + 1.1, -w - 0.12],
          [Math.min(x + (len / n) * 0.56, len) + 0.05, y + 1.24, w + 0.12],
          slate,
        );
    }
    if (master(o))
      for (const side of [-1, 1])
        for (let y = 0.25; y < height; y += 0.46)
          for (let x = 0.1; x < len - 0.1; x += 0.72) {
            const top = ya + ((yb - ya) * x) / len + y;
            box(
              f,
              'stone',
              [x, top, side * w - 0.035],
              [Math.min(x + 0.66, len), top + 0.4, side * w + 0.035],
              color(stone, 0.84 + 0.06 * (Math.floor(x * 3 + y * 7) % 5)),
            );
          }
  }
}
function defenses(o) {
  for (const id of [453018669, 453018672, 453018673, 453018675, 453018677, 495878769, 495878767])
    wallLine(o, id, id === 453018669 ? 3.8 : 2.5);
  gate(o, [12.39, -71.56], [17.21, -67.9], 6.3, 9.5, 15);
  gate(o, [23.39, -62.57], [29.11, -60.81], 5.7, 9, 15);
  gate(o, [3.62, 35.76], [8.25, 40.47], 6.6, 2.2, 17);
  if (o.detail === 'skyline') return;
  for (const id of [495183275, 495183278, 495183281, 495183285]) {
    const p = ring(id),
      a = p[0],
      b = p[1],
      w = Math.hypot(b[0] - a[0], b[1] - a[1]),
      d = Math.hypot(p[2][0] - b[0], p[2][1] - b[1]),
      f = edgeFrame(o, a, b),
      h = workingFloors[id];
    prism(f, rectangle(0, 0, w, d), h, h + 4, 'plaster', plaster);
    hip(f, w, d, h + 4, 4, true);
  }
  if (near(o)) {
    // Stepped route beside the Marian court and its sloping parapet.
    const f = edgeFrame(o, [14, 44], [25, 13]);
    const len = 33,
      low = level(14, 44),
      high = level(25, 13);
    for (let i = 0; i < 26; i++)
      box(
        f,
        'limestone',
        [(i * len) / 26, low + (i * (high - low)) / 26, 0],
        [((i + 1) * len) / 26, low + ((i + 1) * (high - low)) / 26, 2.1],
        trim,
      );
    for (const z of [-0.2, 2.3])
      beam(f, 'plaster', [0, low + 1.2, z], [len, high + 1.2, z], 0.4, 1.4, plaster);
  }
}
function buildKarlstejnRuntime(out, detail) {
  const o = { ...out, detail };
  site(o);
  majorTowers(o);
  palace(o);
  burgrave(o);
  passages(o);
  defenses(o);
}
function compactSkyline(out) {
  const o = { ...out, detail: 'skyline' };
  site(o);
  for (const [a, b, w, d, lo, hi, rh] of [
    [[48.139, -32.947], [64.507, -29.634], 16.7, 25.4, 13, 60, 13],
    [[36.557, 14.273], [53.542, 16.66], 17.15, 23.55, 8, 32, 10],
    [[17.8, 48], [59.8, 48.92], 42, 10.7, 4, 24, 9],
    [[57, 32.7], [64.2, 32.7], 7.2, 16, 7, 25, 7],
    [[-32.5, 56.4], [-13.8, 63.4], 20, 8.2, 1, 17, 8],
    [[-13.8, 63.4], [-3.5, 63.8], 10.3, 7.3, 1, 17, 8],
    [[-3.5, 63.8], [6, 62.3], 9.6, 7.5, 1, 17, 8],
    [[-40.8, 49.8], [-31.2, 47.4], 10, 14, 1, 18, 7],
  ]) {
    const f = edgeFrame(o, a, b);
    prism(f, rectangle(0, 0, w, d), lo, hi);
    hip(f, w, d, hi, rh, hi === 60);
  }
  for (const [x, z, r, lo, hi, rh] of [
    [64.6, 54.1, 5.85, 4, 26, 12],
    [-70.5, 44.2, 4.6, 1, 8, 5],
    [43.45, 26.72, 1.1, 41, 46, 6],
  ]) {
    const f = frame(o, x, 0, z);
    loft(f, 'plaster', [radialRing(lo, r, r, 8), radialRing(hi, r, r, 8)], plaster, { cap: true });
    loft(
      f,
      'slate',
      [radialRing(hi, r + 0.4, r + 0.4, 8), radialRing(hi + rh, 0.03, 0.03, 8)],
      slate,
      { cap: true },
    );
  }
  passages(o);
  for (const [a, b, d, y] of [
    [[12.39, -71.56], [17.21, -67.9], 6.3, 9.5],
    [[23.39, -62.57], [29.11, -60.81], 5.7, 9],
    [[3.62, 35.76], [8.25, 40.47], 6.6, 2.2],
  ]) {
    const f = edgeFrame(o, a, b),
      w = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const shift =
      workingFloors[
        Math.abs(a[0] - 12.39) < 0.01
          ? 453018676
          : Math.abs(a[0] - 23.39) < 0.01
            ? 495183288
            : 453018671
      ] - y;
    const g = frame(f, 0, shift, 0);
    box(g, 'plaster', [0, y, 0], [w * 0.25, y + 11, d], plaster);
    box(g, 'plaster', [w * 0.75, y, 0], [w, y + 11, d], plaster);
    box(g, 'plaster', [w * 0.25, y + 5, 0], [w * 0.75, y + 11, d], plaster);
    hip(g, w, d, y + 11, 4);
  }
  // Only major curtain corners matter at skyline scale.
  for (const p of [
    [
      [8, 69],
      [70, 63],
      [70, -49],
      [49, -47],
      [30, 3],
      [8, 41],
    ],
    [
      [-73, 49],
      [-73, 60],
      [-43, 62],
    ],
    [
      [8, -66],
      [14, -24],
      [11, -1],
      [4, 35],
    ],
  ])
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1],
        b = p[i],
        ya = level(...a) + 2,
        yb = level(...b) + 2;
      beam(o, 'stone', [a[0], ya, a[1]], [b[0], yb, b[1]], 1.5, 4, stone);
    }
}

const means = {
  stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
  limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  carved: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
  plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
  recess: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
};
export const buildKarlstejnReviewedMaster = (o) => buildKarlstejnRuntime(o, 'closeup');
export const buildKarlstejnReviewedCloseup = (o) => buildKarlstejnRuntime(o, 'closeup');
export const buildKarlstejnReviewedStreet = (o) => buildKarlstejnRuntime(o, 'street');
export const buildKarlstejnReviewedDistrict = (o) => buildKarlstejnRuntime(o, 'district');
export function buildKarlstejnReviewedSkyline(out) {
  const o = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        out[k](
          s,
          r,
          p,
          n,
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  compactSkyline(o);
}
