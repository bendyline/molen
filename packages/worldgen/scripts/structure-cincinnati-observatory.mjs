/** Cincinnati Observatory: separate south-facing Herget and west-facing Mitchel buildings. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, profile as radialProfile } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dn/dng/cincinnati_observatory/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff';
const C = {
  brick: rgb('a16149'),
  stone: rgb('bcb59f'),
  trim: rgb('ddd0a8'),
  roof: rgb('72766c'),
  metal: rgb('bdbcb2'),
  rib: rgb('767b73'),
  glass: rgb('596b66'),
  door: rgb('726957'),
};
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.98, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', localRef: ref, roughness: 0.94, metallic: 0.03 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.73, metallic: 0.3 },
  rib: { slot: 'trim', localRef: ref, roughness: 0.83, metallic: 0.2 },
  glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.35, metallic: 0.08 },
  door: { slot: 'trim', localRef: ref, roughness: 0.89, metallic: 0 },
};
function profile(o, layers, sides, center) {
  radialProfile(
    o,
    layers.map(({ y, r, slot, color }) => [y, r, r, slot, color]),
    sides,
    center,
  );
}
function tri(o, s, ps, n, col = C[s]) {
  if (n && normalFor(...ps).reduce((a, v, i) => a + v * n[i], 0) < 0) ps = [ps[0], ps[2], ps[1]];
  const normal = normalFor(...ps),
    a = normal.map(Math.abs),
    uv =
      a[1] > 0.65 ? (p) => [p[0], p[2]] : a[0] > a[2] ? (p) => [p[2], p[1]] : (p) => [p[0], p[1]];
  o.addTriangle(s, ref, ps, normal, ps.map(uv), col);
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
const area = (r) =>
  r.reduce((a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1], 0);
const clockwise = (r) => (area(r) < 0 ? r : [...r].reverse());
const rect = (x, y, w, h) => [
  [x - w / 2, y],
  [x + w / 2, y],
  [x + w / 2, y + h],
  [x - w / 2, y + h],
];
const circle = (x, y, r, n) =>
  Array.from({ length: n }, (_, i) => [
    x + Math.cos((i / n) * Math.PI * 2) * r,
    y + Math.sin((i / n) * Math.PI * 2) * r,
  ]);
function frame(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], 0, u[0]];
  return {
    len,
    u,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function panel(o, s, outer, holes, f, depth = 0) {
  const pts = [outer, ...holes].flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((a, r) => a + r.length, 0),
    ),
    ix = earcut(pts.flat(), starts);
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => f.P(...pts[k], depth)),
      f.n,
    );
}
function strip(o, s, f, x, y, w, h, depth = 0.025) {
  panel(o, s, rect(x, y, w, h), [], f, depth);
}
function cap(o, s, r, y, up = true) {
  const ix = earcut(r.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, lo, hi) {
  r = clockwise(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    strip(o, s, f, f.len / 2, lo, f.len, hi - lo, 0);
  }
  cap(o, s, r, hi);
  cap(o, s, r, lo, false);
}
function block(o, s, f, x, y, w, h, front, back = 0) {
  const r = rect(x, y, w, h);
  panel(o, s, r, [], f, front);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      ps = [f.P(...a, front), f.P(...b, front), f.P(...b, back), f.P(...a, back)];
    Q(o, s, ps, normalFor(...ps));
  }
}
function opening(o, f, h, d) {
  const r = rect(h.x, h.y, h.w, h.h),
    depth = d === 0 ? 0.015 : -0.21;
  panel(o, h.door ? 'door' : 'glass', r, [], f, depth);
  if (!d) return;
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4],
      ps = [f.P(...a), f.P(...b), f.P(...b, depth), f.P(...a, depth)];
    Q(o, 'trim', ps, normalFor(...ps));
  }
  if (d === 1) {
    strip(o, 'trim', f, h.x, h.y - 0.1, h.w + 0.2, 0.12, 0.08);
    return;
  }
  for (const sg of [-1, 1])
    block(o, 'trim', f, h.x + sg * (h.w / 2 + 0.065), h.y - 0.06, 0.13, h.h + 0.12, 0.08, -0.025);
  block(o, 'trim', f, h.x, h.y + h.h, h.w + 0.25, 0.15, 0.11, -0.01);
  block(o, 'trim', f, h.x, h.y - 0.12, h.w + 0.3, 0.14, 0.19, -0.02);
  if (d > 1) {
    strip(o, 'trim', f, h.x, h.y + h.h * 0.5, h.w, 0.06, -0.13);
    if (!h.narrow) {
      strip(o, 'trim', f, h.x, h.y, 0.055, h.h, -0.13);
      if (d > 2)
        for (const sg of [-1, 1]) strip(o, 'trim', f, h.x + (sg * h.w) / 6, h.y, 0.035, h.h, -0.14);
    }
  }
}
function wall(o, f, lo, hi, holes, d, stoneTop) {
  panel(o, 'stone', rect(f.len / 2, lo, f.len, stoneTop - lo), [], f);
  panel(
    o,
    'brick',
    rect(f.len / 2, stoneTop, f.len, hi - stoneTop),
    d ? holes.map((h) => rect(h.x, h.y, h.w, h.h)) : [],
    f,
  );
  for (const h of holes) opening(o, f, h, d);
  block(o, 'trim', f, f.len / 2, stoneTop - 0.06, f.len, 0.12, 0.075, -0.02);
  if (d > 0) strip(o, 'trim', f, f.len / 2, 2.1 + (stoneTop - 1.25), f.len, 0.09, 0.035);
}
function rail(o, a, b, y, d) {
  const f = frame(a, b);
  for (const h of [0, 0.7]) beam(o, 'trim', f.P(0, y + h), f.P(f.len, y + h), 0.13, 0.12, C.trim);
  if (d < 1) return;
  const count = Math.max(1, Math.floor(f.len / (d > 1 ? 0.42 : 1.4)));
  for (let i = 0; i <= count; i++) {
    const x = (f.len * i) / count,
      p = f.P(x, y);
    if (d > 2)
      profile(
        o,
        [
          { y, r: 0.055, slot: 'trim', color: C.trim },
          { y: y + 0.13, r: 0.08, slot: 'trim', color: C.trim },
          { y: y + 0.42, r: 0.045, slot: 'trim', color: C.trim },
          { y: y + 0.62, r: 0.07, slot: 'trim', color: C.trim },
          { y: y + 0.7, r: 0.055, slot: 'trim', color: C.trim },
        ],
        5,
        [p[0], p[2]],
      );
    else beam(o, 'trim', f.P(x, y), f.P(x, y + 0.7), 0.065, 0.065, C.trim);
  }
}
function cornice(o, r, top, d) {
  r = clockwise(r);
  for (let i = 0; i < r.length; i++) {
    const f = frame(r[i], r[(i + 1) % r.length]);
    if (d < 2) strip(o, 'trim', f, f.len / 2, top - 0.5, f.len, 0.5, 0.06);
    else {
      block(o, 'trim', f, f.len / 2, top - 0.5, f.len, 0.3, 0.15, -0.02);
      block(o, 'trim', f, f.len / 2, top - 0.2, f.len, 0.2, 0.3, -0.03);
    }
    if (d > 1)
      for (let j = 0.28; j < f.len; j += 0.5)
        block(o, 'trim', f, j, top - 0.55, 0.13, 0.12, 0.2, 0.03);
  }
  cap(o, 'roof', r, top);
  cap(o, 'trim', r, top - 0.5, false);
}
function column(o, p, bottom, top, r, d) {
  const n = [5, 8, 12, 20][d],
    layers = [
      [bottom, r * 1.23],
      [bottom + 0.18, r * 1.23],
      [bottom + 0.26, r],
      [top - 0.34, r * 0.83],
      [top - 0.24, r * 1.2],
      [top - 0.09, r * 1.3],
      [top, r * 1.3],
    ];
  profile(
    o,
    layers.map(([y, r]) => ({ y, r, slot: 'trim', color: C.trim })),
    n,
    [p[0], p[2]],
  );
  if (d === 3)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      beam(
        o,
        'trim',
        [p[0] + Math.cos(a) * r * 0.98, bottom + 0.4, p[2] + Math.sin(a) * r * 0.98],
        [p[0] + Math.cos(a) * r * 0.85, top - 0.42, p[2] + Math.sin(a) * r * 0.85],
        0.025,
        0.025,
        C.stone,
      );
    }
}
function pediment(o, f, width, base, peak, depth, d, oculus = false) {
  const outer = [
      [-width / 2, base],
      [width / 2, base],
      [0, peak],
    ],
    holes = oculus ? [circle(0, base + 0.62, 0.36, d > 1 ? 20 : 10)] : [];
  panel(o, 'brick', outer, holes, f, depth);
  panel(o, 'trim', outer, [], { ...f, n: f.n.map((v) => -v) }, depth - 0.4);
  if (oculus) {
    panel(o, 'glass', holes[0], [], f, depth - 0.1);
    const out = circle(0, base + 0.62, 0.51, holes[0].length);
    for (let i = 0; i < out.length; i++) {
      const j = (i + 1) % out.length;
      Q(
        o,
        'trim',
        [
          f.P(...out[i], depth + 0.03),
          f.P(...out[j], depth + 0.03),
          f.P(...holes[0][j], depth + 0.03),
          f.P(...holes[0][i], depth + 0.03),
        ],
        f.n,
      );
    }
  }
  for (let i = 0; i < 3; i++) {
    const a = outer[i],
      b = outer[(i + 1) % 3];
    beam(o, 'trim', f.P(...a, depth + 0.06), f.P(...b, depth + 0.06), 0.18, 0.22, C.trim);
    Q(
      o,
      'trim',
      [f.P(...a, depth), f.P(...b, depth), f.P(...b, depth - 0.4), f.P(...a, depth - 0.4)],
      normalFor(f.P(...a, depth), f.P(...b, depth), f.P(...b, depth - 0.4)),
    );
  }
}
function stairs(o, f, width, yTop, depth, n) {
  for (let i = 0; i < n; i++) {
    const front = depth + (n - i) * 0.32,
      back = depth + (n - i - 1) * 0.32,
      lo = yTop - (n - i) * 0.18,
      hi = lo + 0.18;
    const r = [
      f.P(-width / 2, lo, back),
      f.P(width / 2, lo, back),
      f.P(width / 2, lo, front),
      f.P(-width / 2, lo, front),
    ].map((p) => [p[0], p[2]]);
    prism(o, 'stone', r, lo - 0.12, hi);
  }
}
function dome(o, center, r, y, d, cone = false) {
  const n = [12, 20, 36, 48][d],
    rows = cone ? 1 : [3, 4, 8, 12][d],
    ring = (j, offset = 0) => {
      const t = ((j / rows) * Math.PI) / 2,
        rr = cone ? (j === 0 ? r : 0) : r * Math.cos(t);
      return Array.from({ length: n }, (_, i) => [
        center[0] + (rr + offset) * Math.cos((i / n) * Math.PI * 2),
        y + (cone ? j * r * 0.8 : r * Math.sin(t)),
        center[1] + (rr + offset) * Math.sin((i / n) * Math.PI * 2),
      ]);
    };
  for (let j = 0; j < rows; j++) {
    const a = ring(j),
      b = ring(j + 1);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      const outward = [
        Math.cos(((i + 0.5) / n) * Math.PI * 2),
        1,
        Math.sin(((i + 0.5) / n) * Math.PI * 2),
      ];
      if (j === rows - 1) tri(o, 'metal', [a[i], a[k], b[i]], outward);
      else Q(o, 'metal', [a[i], a[k], b[k], b[i]], outward);
    }
  }
  cap(o, 'metal', circle(...center, r, n), y, false);
  if (d > 0) {
    const ribs = d === 1 ? 8 : d === 2 ? 20 : 24;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * Math.PI * 2;
      for (let j = 0; j < rows; j++) {
        const t = ((j / rows) * Math.PI) / 2,
          u = (((j + 1) / rows) * Math.PI) / 2,
          R = r + 0.025,
          A = [
            center[0] + R * Math.cos(t) * Math.cos(a),
            y + R * Math.sin(t),
            center[1] + R * Math.cos(t) * Math.sin(a),
          ],
          B = [
            center[0] + R * Math.cos(u) * Math.cos(a),
            y + R * Math.sin(u),
            center[1] + R * Math.cos(u) * Math.sin(a),
          ];
        if (!cone && d === 1) {
          const edge = (p, sign) => [
            p[0] - Math.sin(a) * 0.02 * sign,
            p[1],
            p[2] + Math.cos(a) * 0.02 * sign,
          ];
          Q(
            o,
            'rib',
            [edge(A, -1), edge(A, 1), edge(B, 1), edge(B, -1)],
            [Math.cos(a), 1, Math.sin(a)],
          );
        } else if (!cone) beam(o, 'rib', A, B, 0.035, 0.035, C.rib);
      }
    }
    if (!cone)
      for (const offset of [-0.12, 0.12]) {
        const a = 0.65 + offset;
        for (let j = 0; j < rows; j++) {
          const t = ((j / rows) * Math.PI) / 2,
            u = (((j + 1) / rows) * Math.PI) / 2,
            R = r + 0.045;
          beam(
            o,
            'rib',
            [
              center[0] + R * Math.cos(t) * Math.cos(a),
              y + R * Math.sin(t),
              center[1] + R * Math.cos(t) * Math.sin(a),
            ],
            [
              center[0] + R * Math.cos(u) * Math.cos(a),
              y + R * Math.sin(u),
              center[1] + R * Math.cos(u) * Math.sin(a),
            ],
            0.085,
            0.055,
            C.rib,
          );
        }
      }
  }
}
function herget(o, d) {
  const original = plan.buildings[0].outline,
    body = clockwise([
      original[0],
      original[1],
      original[2],
      [original[3][0], 4],
      [original[6][0], 4],
      original[7],
      original[8],
      original[13],
    ]);
  for (let i = 0; i < body.length; i++) {
    const f = frame(body[i], body[(i + 1) % body.length]),
      front = f.n[2] > 0.8,
      back = f.n[2] < -0.8,
      side = Math.abs(f.n[0]) > 0.8,
      count = f.len > 18 ? 5 : f.len > 9 ? 3 : f.len > 4 ? 1 : 0,
      holes = [];
    for (let j = 0; j < count; j++) {
      const narrow = (front || back) && f.P(((j + 0.5) / Math.max(1, count)) * f.len, 0)[0] < -5.5,
        door = front && f.len > 8 && f.len < 11 && j === 0;
      holes.push({
        x: (f.len * (j + 0.5)) / count,
        y: door ? 1.25 : 2.12,
        w: door ? 1.7 : narrow ? 0.63 : 1.35,
        h: door ? 3.5 : 3.8,
        narrow,
        door,
      });
    }
    wall(o, f, -0.28, 6.7, holes, d, 1.25);
    if (d > 1 && side && f.len > 8)
      for (let j = 0; j < 3; j++)
        block(o, 'glass', f, ((j + 0.5) / 3) * f.len, 0.1, 0.85, 0.65, 0.025, 0);
  }
  cornice(o, original, 7.3, d);
  cap(o, 'stone', body, -0.28, false);
  const porch = frame([-0.37, 8.05], [0.63, 8.05]),
    f = { ...porch, P: (x, y, z = 0) => [x - 0.37, y, 8.05 + z] },
    porchRing = [
      [-5.25, 4],
      [4.48, 4],
      [4.48, 8.42],
      [-5.25, 8.42],
    ];
  prism(o, 'stone', porchRing, -0.1, 1.25);
  for (const x of [-4.28, 4.28]) {
    block(o, 'trim', f, x, 1.25, 0.72, 5.25, 0.34, -0.35);
    if (d > 1) for (let y = 1.6; y < 6.4; y += 0.42) strip(o, 'stone', f, x, y, 0.72, 0.024, 0.35);
  }
  for (const x of [-1.42, 1.42]) column(o, f.P(x, 0), 1.25, 6.55, 0.27, d);
  pediment(o, f, 10.0, 7.3, 9.08, 0.37, d, true);
  if (d > 0)
    profile(
      o,
      [
        { y: 9.08, r: 0.15, slot: 'trim', color: C.trim },
        { y: 9.25, r: 0.25, slot: 'trim', color: C.trim },
        { y: 9.48, r: 0.1, slot: 'trim', color: C.trim },
      ],
      8,
      [-0.37, 8.42],
    );
  for (const [a, b] of [
    [
      [-5, 1.8],
      [-5, 8.2],
    ],
    [
      [4.25, 8.2],
      [4.25, 1.8],
    ],
    [
      [-4.3, 8.2],
      [-0.95, 8.2],
    ],
    [
      [0.85, 8.2],
      [4.3, 8.2],
    ],
  ])
    rail(o, a, b, 1.3, d);
  stairs(o, f, 1.9, 1.25, 0.45, 7);
  for (const [a, b] of [
    [
      [-10.9, -8.3],
      [-5.25, -8.3],
    ],
    [
      [4.8, -8.3],
      [10.9, -8.3],
    ],
    [
      [-10.9, 1.7],
      [-5.3, 1.7],
    ],
    [
      [4.6, 1.7],
      [10.9, 1.7],
    ],
    [
      [-10.9, -8.3],
      [-10.9, 1.7],
    ],
    [
      [10.9, 1.7],
      [10.9, -8.3],
    ],
  ])
    rail(o, a, b, 7.36, d);
  const drum = [
    [-5.25, -8.15],
    [4.85, -8.15],
    [4.85, 2.0],
    [-5.25, 2.0],
  ];
  prism(o, 'brick', drum, 7.3, 8.35);
  cornice(o, drum, 8.55, d);
  dome(o, [-0.2, -3.05], 4.7, 8.55, d);
  for (const x of [-9.0, -6.5]) {
    box(o, 'brick', [x - 0.25, 7.3, -6.7], [x + 0.25, 9.05, -6.12], C.brick);
    box(o, 'brick', [x - 0.34, 8.85, -6.8], [x + 0.34, 9.07, -6.03], C.brick);
    if (d > 1) box(o, 'roof', [x - 0.17, 9.07, -6.63], [x + 0.17, 9.09, -6.19], C.roof);
  }
}
function mitchel(o, d) {
  const r = clockwise(plan.buildings[1].outline),
    body = clockwise([plan.buildings[1].outline[0], ...plan.buildings[1].outline.slice(4)]);
  for (let i = 0; i < body.length; i++) {
    const f = frame(body[i], body[(i + 1) % body.length]),
      front = f.n[0] < -0.8 && f.len > 3,
      south = f.n[2] > 0.8,
      holes = [];
    if (front) {
      for (const t of [0.1, 0.3, 0.7, 0.9]) holes.push({ x: f.len * t, y: 0.8, w: 1.25, h: 3.35 });
      holes.push({ x: 45.0 - body[i][1], y: 0.32, w: 1.65, h: 3.3, door: true });
    } else if (f.len > 3) {
      const count = f.len > 8 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        if (south) continue;
        holes.push({ x: (f.len * (j + 0.5)) / count, y: 0.8, w: 1.25, h: 3.35 });
      }
    }
    wall(o, f, -2.4, 5.1, holes, d, -0.1);
    if (d > 1 && f.n[0] > 0.1 && f.len > 3) strip(o, 'glass', f, f.len / 2, -1.8, 1, 0.95, 0.025);
  }
  cornice(o, r, 5.6, d);
  cap(o, 'stone', r, -2.4, false);
  const c = [42.35, 45.63],
    s = [43.05, 36.75],
    n = [10, 16, 24, 32][d];
  prism(o, 'brick', circle(...c, 3.8, n), 5.6, 6.5);
  prism(o, 'trim', circle(...c, 3.88, n), 6.38, 6.56);
  dome(o, c, 3.8, 6.56, d);
  prism(o, 'brick', circle(...s, 2.13, n), 5.6, 6.1);
  prism(o, 'trim', circle(...s, 2.23, n), 5.96, 6.16);
  dome(o, s, 2.23, 6.16, d, true);
  const f = frame([30.76, 45.0], [30.76, 46.0]),
    porch = [f.P(-2.15, 0, 0), f.P(2.15, 0, 0), f.P(2.15, 0, 2.0), f.P(-2.15, 0, 2.0)].map((p) => [
      p[0],
      p[2],
    ]);
  prism(o, 'stone', porch, -0.3, 0.32);
  for (const x of [-1.65, 1.65]) column(o, f.P(x, 0, 1.6), 0.32, 4.55, 0.19, d);
  for (const x of [-1.95, 1.95]) block(o, 'trim', f, x, 0.32, 0.26, 4.28, 0.18, -0.03);
  block(o, 'trim', f, 0, 4.55, 4.55, 0.45, 2.02, -0.01);
  pediment(o, f, 4.7, 5.0, 5.6, 2.05, d);
  const arch = [
    [-0.82, 0.32],
    [0.82, 0.32],
    [0.82, 3.15],
    ...Array.from({ length: 13 }, (_, i) => [
      0.82 * Math.cos((i / 12) * Math.PI),
      3.15 + 0.42 * Math.sin((i / 12) * Math.PI),
    ]),
  ];
  panel(o, 'glass', arch, [], f, -0.2);
  if (d > 0) {
    for (const x of [-0.9, 0.9]) strip(o, 'trim', f, x, 0.32, 0.12, 2.85, 0.03);
    strip(o, 'trim', f, 0, 0.32, 0.06, 2.82, -0.15);
    strip(o, 'trim', f, 0, 3.0, 1.65, 0.06, -0.15);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI,
        b = ((i + 1) / 12) * Math.PI;
      beam(
        o,
        'trim',
        f.P(0.9 * Math.cos(a), 3.15 + 0.5 * Math.sin(a), 0.03),
        f.P(0.9 * Math.cos(b), 3.15 + 0.5 * Math.sin(b), 0.03),
        0.11,
        0.11,
        C.trim,
      );
    }
  }
  stairs(o, f, 2.0, 0.32, 2.05, 3);
  if (d > 1)
    for (const i of [0, 4, 5]) {
      const a = r[i];
      box(o, 'trim', [a[0] - 0.13, -0.1, a[1] - 0.13], [a[0] + 0.13, 5.1, a[1] + 0.13], C.trim);
    }
}
function skyline(o) {
  const original = plan.buildings[0].outline,
    body = [
      original[0],
      original[1],
      original[2],
      [original[3][0], 4],
      [original[6][0], 4],
      original[7],
      original[8],
      original[13],
    ];
  prism(o, 'stone', body, -0.28, 1.25);
  prism(o, 'brick', body, 1.25, 6.8);
  const porch = [
    [-5.25, 4],
    [4.48, 4],
    [4.48, 8.42],
    [-5.25, 8.42],
  ];
  prism(o, 'stone', porch, -0.1, 1.25);
  for (const r of [original]) {
    const ring = clockwise(r);
    for (let i = 0; i < ring.length; i++) {
      const f = frame(ring[i], ring[(i + 1) % ring.length]);
      strip(o, 'trim', f, f.len / 2, 6.8, f.len, 0.5);
    }
    cap(o, 'roof', r, 7.3);
    cap(o, 'trim', r, 6.8, false);
  }
  const f = frame([-0.37, 8.42], [0.63, 8.42]);
  for (const x of [-4.28, 4.28]) block(o, 'trim', f, x, 1.25, 0.72, 5.55, 0.2, -0.4);
  for (const x of [-1.42, 1.42]) {
    const p = f.P(x, 0);
    profile(
      o,
      [
        { y: 1.25, r: 0.3, slot: 'trim', color: C.trim },
        { y: 6.8, r: 0.26, slot: 'trim', color: C.trim },
      ],
      5,
      [p[0], p[2]],
    );
  }
  pediment(o, f, 10, 7.3, 9.08, 0, 0, true);
  prism(
    o,
    'brick',
    [
      [-5.25, -8.15],
      [4.85, -8.15],
      [4.85, 2],
      [-5.25, 2],
    ],
    7.3,
    8.55,
  );
  dome(o, [-0.2, -3.05], 4.7, 8.55, 0);
  for (const x of [-9, -6.5])
    box(o, 'brick', [x - 0.3, 7.3, -6.7], [x + 0.3, 9.07, -6.12], C.brick);
  for (const x of [-10.9, 10.9]) {
    const rf = frame([x, -8.3], [x, 1.7]);
    strip(o, 'trim', rf, 5, 7.36, 10, 0.1);
    strip(o, 'trim', rf, 5, 7.96, 10, 0.1);
  }
  const mr = plan.buildings[1].outline;
  prism(o, 'brick', mr, -2.4, 5.2);
  for (let i = 0; i < mr.length; i++) {
    const mf = frame(mr[i], mr[(i + 1) % mr.length]);
    strip(o, 'trim', mf, mf.len / 2, 5.2, mf.len, 0.4);
  }
  cap(o, 'roof', mr, 5.6);
  for (const [center, radius, bottom, cone] of [
    [[42.35, 45.63], 3.8, 6.56, false],
    [[43.05, 36.75], 2.23, 6.16, true],
  ]) {
    prism(o, 'brick', circle(...center, radius, 10), 5.6, bottom);
    dome(o, center, radius, bottom, 0, cone);
  }
  const mf = frame([30.76, 45], [30.76, 46]);
  for (const x of [-1.65, 1.65]) {
    const p = mf.P(x, 0, 1.6);
    profile(
      o,
      [
        { y: 0.32, r: 0.2, slot: 'trim', color: C.trim },
        { y: 4.6, r: 0.17, slot: 'trim', color: C.trim },
      ],
      5,
      [p[0], p[2]],
    );
  }
  block(o, 'trim', mf, 0, 4.6, 4.55, 0.4, 2.02, 0);
  pediment(o, mf, 4.7, 5, 5.6, 2.05, 0);
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  herget(o, d);
  mitchel(o, d);
}
export const cincinnatiSkyline = (o, f) => build(o, f, 0);
export const cincinnatiDistrict = (o, f) => build(o, f, 1);
export const cincinnatiStreet = (o, f) => build(o, f, 2);
export const cincinnatiModel = {
  id: 'cincinnati_observatory',
  key: 'cincinnati_observatory',
  recipe: 'structure-cincinnati-observatory.mjs',
  cell: 'dn/dng',
  title: 'Cincinnati Observatory',
  category: 'civic-cultural',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete separated Herget and Mitchel observatory buildings at original native positions: redbrick/raised stonebases/pale dressed sash, open south Herget Doric portico/pediment/oculus/steps/balustrades, flat roof balustrade/paired chimneys and ribbed silver dome on square support; west Mitchel two-column entry/lowpediment, central rear domed turret and smaller northeast conical turret. No campus slab/driveways/interiors/telescopes/temporaryworks.',
  camera: [-80, 55, 110],
  lookAt: [17, 4, 22],
  portableGroundY: -2.5,
  mediumFiContext: { scale: 1.5, groundY: -2.5 },
  qaCameras: [
    {
      name: 'herget-south-portico-oculus-open-balustrades-and-dome',
      position: [-24, 15, 34],
      lookAt: [0, 6, 0],
    },
    {
      name: 'herget-west-sash-roof-balustrade-chimneys-and-ribs',
      position: [-27, 15, -13],
      lookAt: [0, 7, -3],
    },
    {
      name: 'mitchel-west-five-bay-front-and-open-two-column-entry',
      position: [6, 9, 48],
      lookAt: [37, 3, 45],
    },
    {
      name: 'mitchel-east-domed-turret-and-northeast-conical-cap',
      position: [66, 17, 26],
      lookAt: [40, 4, 43],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent160mhilltop field frozen before geometry at fixed south Herget approach[0,12]. Exact Mitchel downslope foundation/threshold and hostcontact approximate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cincinnati-observatory.mjs',
    level: 'skyline',
    export: 'cincinnatiSkyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'cincinnatiDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'cincinnatiStreet', errorMeters: 0.18, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Complete two intrinsic observatory building exteriors only. Original full map plans retain all17/22vertices; centimeter-scale collinear Herget wall jogs simplified between retained principal corners, with original full roof envelope. Silver Herget dome/portico/roof and Mitchel front controlled by two2019CC0exteriors. Primary architectural text and native curved plans establish concealed Mitchel main rear dome and northeast cone turret. Heights/vertical basement offsets/roof profiles/window census/ornaments/rear details remain bounded medium-fi estimates.',
    'Operator reports Herget renovation beganJuly2026; temporary works and current cosmetic condition excluded/unverified. Permanent1895ribbed silver dome represented closed; no moving slit/telescope/interior. Main porch genuine open air below entablature; high windows recessed in nearer levels; open balustrades simplified at distance.',
    'Shared procedural brick/limestone/painted-metal and muted local glazing; no photograph texture or generatedbitmap. Qualla-published exact4032x3024WarrenLeMayCC0exteriors/nativeSHA1matched before geometry. Interior/attic/markers/astronomy/unrelated/attribution imagery unused. Primary architectural document used only for text facts, no images/diagrams.',
    'No separate radio tower/survey markers/driveways/grounds/landscape/campusslab/neighbor houses, interiors/telescopes/lettering/people/cars or temporaryrenovation. Independent original160mterrain/rawtiles/grid/heightPNG frozen unchanged; no flattening/fitting. Exact front stairs/downslopebase/hostcontact unverified; replaceFootprint=false.',
  ],
};
