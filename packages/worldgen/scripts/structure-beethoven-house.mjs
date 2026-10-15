/** Beethoven House: Bonngasse 20 front house and lower birthplace garden wing. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, normalFor, sphere } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  cream = rgb('ddd7bd'),
  pink = rgb('d59c8d'),
  yellow = rgb('ddc480'),
  stone = rgb('b9b8a6'),
  white = rgb('eee8d6'),
  green = rgb('36594f'),
  red = rgb('b76b51'),
  slate = rgb('535e60'),
  iron = rgb('3b4644'),
  glass = rgb('7c9390'),
  gold = rgb('baa15a');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
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
function rect(o, x0, z0, x1, z1, lo, hi, s = 'wall', c = cream) {
  B(o, s, (x0 + x1) / 2, lo, (z0 + z1) / 2, x1 - x0, hi - lo, z1 - z0, c);
}
function line(o, s, a, b, w, c) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    ox = ((-dy / l) * w) / 2,
    oy = ((dx / l) * w) / 2;
  quad(
    o,
    s,
    [
      [a[0] + ox, a[1] + oy, a[2]],
      [b[0] + ox, b[1] + oy, b[2]],
      [b[0] - ox, b[1] - oy, b[2]],
      [a[0] - ox, a[1] - oy, a[2]],
    ],
    [0, 0, 1],
    c,
  );
}
function curved(o, s, points, width, c) {
  for (let i = 1; i < points.length; i++) line(o, s, points[i - 1], points[i], width, c);
}
function outline(o, x, y, w, h, z, s, c) {
  for (const xx of [x - w / 2, x + w / 2]) face(o, s, xx, y, z, 0.035, h, c);
  for (const yy of [y, y + h]) face(o, s, x, yy, z, w, 0.035, c);
}
function window(
  o,
  x,
  y,
  w,
  h,
  d,
  { shutters = true, redPanels = false, pairs = false, door = false } = {},
) {
  if (!d) return;
  face(o, 'glass', x, y, 0.075, w, h, glass);
  for (const xx of [x - w / 2, x + w / 2])
    B(o, 'stone', xx, y - 0.1, 0.07, 0.13, h + 0.2, 0.18, stone);
  for (const yy of [y - 0.11, y + h]) B(o, 'stone', x, yy, 0.07, w + 0.25, 0.12, 0.22, stone);
  if (d > 1) {
    const n = pairs ? 4 : 2;
    for (let i = 0; i <= n; i++) {
      const xx = x - w / 2 + (i * w) / n;
      B(o, 'wood', xx, y, 0.19, i === n / 2 ? 0.075 : 0.043, h, 0.065, white);
    }
    for (let i = 0, n = door ? 5 : 6; i <= n; i++)
      face(o, 'wood', x, y + (h * i) / n, 0.24, w, i === n - 2 ? 0.065 : 0.035, white);
    if (door) {
      B(o, 'wood', x, y, 0.14, w, 0.45, 0.12, white);
      for (let i = 0; i < Math.ceil(w / 0.09); i++)
        face(o, 'wood', x - w / 2 + i * 0.09, y + 0.04, 0.22, 0.018, 0.34, stone);
    }
  }
  if (shutters) {
    const sw = w / (pairs ? 2 : 2),
      gap = 0.19;
    for (const sign of [-1, 1]) {
      const xx = x + sign * (w / 2 + gap + sw / 2),
        f = facing(o, sign * 0.045, xx, 0);
      B(f, 'wood', 0, y, -0.005, sw, h, 0.1, green);
      if (d > 1) {
        const n = redPanels ? 2 : 1;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < 2; j++) {
            const cx = -sw / 2 + ((i + 0.5) * sw) / n,
              cy = y + 0.12 + j * h * 0.5;
            outline(f, cx, cy, sw / n - 0.16, h * 0.5 - 0.22, 0.08, 'wood', redPanels ? red : iron);
          }
        if (d > 2)
          for (const yy of [y + 0.17, y + h - 0.17])
            face(f, 'metal', -sign * sw * 0.33, yy, 0.12, sw * 0.35, 0.04, iron);
      }
    }
  }
}
function basket(o, x, y, w, d) {
  if (d < 2) return;
  for (const yy of [y - 0.12, y + 0.06]) B(o, 'metal', x, yy, 0.38, w + 0.12, 0.025, 0.035, iron);
  for (let i = 0; i <= 4; i++) {
    const xx = x - w / 2 + (i * w) / 4;
    beam(o, 'metal', [xx, y - 0.12, 0.4], [xx, y - 0.21, 0.07], 0.025, 0.025, iron);
    B(o, 'metal', xx, y - 0.12, 0.38, 0.018, 0.3, 0.025, iron);
  }
}
function roofPlane(o, bounds, yAt, holes, d) {
  const r = [
      [bounds[0], bounds[1]],
      [bounds[2], bounds[1]],
      [bounds[2], bounds[3]],
      [bounds[0], bounds[3]],
    ],
    loops = [r, ...holes],
    pts = loops.flat(),
    indices = earcut(
      pts.flat(),
      holes.map((_, i) => 4 + i * 4),
    );
  for (let i = 0; i < indices.length; i += 3) {
    const p = indices.slice(i, i + 3).map((j) => [pts[j][0], yAt(...pts[j]), pts[j][1]]);
    let n = normalFor(...p);
    if (n[1] < 0) n = n.map((v) => -v);
    o.addTriangle(
      'roof',
      ref,
      p,
      n,
      p.map((v) => [v[0], v[2]]),
      slate,
    );
  }
  if (d > 1) {
    const rows = d > 2 ? Math.ceil(Math.abs(bounds[3] - bounds[1]) / 0.2) : 8;
    for (let j = 1; j < rows; j++) {
      const z = bounds[1] + ((bounds[3] - bounds[1]) * j) / rows;
      let spans = [[bounds[0], bounds[2]]];
      for (const hole of holes) {
        if (z <= hole[0][1] || z >= hole[2][1]) continue;
        const a = hole[0][0],
          b = hole[1][0];
        spans = spans.flatMap(([l, r]) =>
          r <= a || l >= b
            ? [[l, r]]
            : [
                [l, Math.min(r, a)],
                [Math.max(l, b), r],
              ].filter(([l, r]) => r - l > 0.005),
        );
      }
      for (const [l, r] of spans) {
        quad(
          o,
          'roof',
          [
            [l, yAt(l, z) + 0.018, z],
            [r, yAt(r, z) + 0.018, z],
            [r, yAt(r, z + 0.018) + 0.018, z + 0.018],
            [l, yAt(l, z + 0.018) + 0.018, z + 0.018],
          ],
          [0, 1, 0],
          slate.map((v) => v * 0.7),
        );
      }
    }
  }
}
function dormer(
  o,
  x,
  z,
  d,
  { back = false, low = 9.72, top = 11.35, w = 1.35, depth = 2.9, vent = false } = {},
) {
  const f = facing(o, back ? Math.PI : 0, x, z);
  B(f, 'wood', 0, low, 0, w, top - low, 0.12, white);
  if (vent) {
    if (d) face(f, 'metal', 0, low + 0.17, 0.075, w * 0.3, 0.19, iron);
  } else window(f, 0, low + 0.12, w - 0.22, top - low - 0.22, d, { shutters: false });
  for (const s of [-1, 1]) {
    const p = [
      [(s * w) / 2, low, 0],
      [(s * w) / 2, top, 0],
      [(s * w) / 2, top + 0.25, -depth],
      [(s * w) / 2, top + 0.1, -depth],
    ];
    quad(f, 'roof', p, [s, 0, 0], slate);
  }
  const n = back || d < 2 ? 2 : 8;
  for (let i = 0; i < n; i++) {
    const a = -w / 2 + (i * w) / n,
      b = -w / 2 + ((i + 1) * w) / n,
      ya = top + 0.18 * Math.sin((Math.PI * i) / n),
      yb = top + 0.18 * Math.sin((Math.PI * (i + 1)) / n),
      p = [
        [a, ya, 0.13],
        [b, yb, 0.13],
        [b, yb + 0.25, -depth],
        [a, ya + 0.25, -depth],
      ];
    let normal = normalFor(...p);
    if (normal[1] < 0) normal = normal.map((v) => -v);
    quad(f, 'roof', p, normal, slate);
    if (d > 1) {
      line(f, 'stone', [a, ya - 0.07, 0.17], [b, yb - 0.07, 0.17], 0.09, white);
      line(f, 'wood', [a, ya + 0.02, 0.2], [b, yb + 0.02, 0.2], 0.055, back ? red : slate);
    }
  }
}
function mainRoof(o, d) {
  const y = (_x, z) => 12.55 - Math.abs(z) * 0.55,
    holes = [];
  for (const x of [-1.9, 1.9])
    holes.push([
      [x - 0.68, 2.08],
      [x + 0.68, 2.08],
      [x + 0.68, 5.04],
      [x - 0.68, 5.04],
    ]);
  roofPlane(o, [-3.8, 0, 3.8, 5.75], y, holes, d);
  const rearHoles = [-1.9, 1.9].map((x) => [
    [x - 0.68, -5.04],
    [x + 0.68, -5.04],
    [x + 0.68, -2.08],
    [x - 0.68, -2.08],
  ]);
  if (d)
    rearHoles.push([
      [-0.28, -1.8],
      [0.28, -1.8],
      [0.28, -0.9],
      [-0.28, -0.9],
    ]);
  roofPlane(o, [-3.8, -5.75, 3.8, 0], y, rearHoles, d);
  for (const x of [-1.9, 1.9]) dormer(o, x, 5.04, d);
  for (const x of [-1.9, 1.9]) dormer(o, x, -5.04, d, { back: true });
  if (d)
    dormer(o, 0, -1.8, d, { back: true, low: 11.9, top: 12.6, w: 0.55, depth: 0.9, vent: true });
  for (const sign of [-1, 1]) {
    const p = [
      [sign * 3.58, 9.4, -5.55],
      [sign * 3.58, 9.4, 5.55],
      [sign * 3.58, 12.55, 0],
    ];
    o.addTriangle(
      'wall',
      ref,
      p,
      [sign, 0, 0],
      p.map((v) => [v[2], v[1]]),
      cream,
    );
  }
  if (d) {
    B(o, 'roof', 0, 12.5, 0, 7.7, 0.12, 0.18, slate);
    for (const z of [-5.65, 5.65])
      for (let k = 0; k < (d > 1 ? 4 : 1); k++)
        B(o, 'metal', 0, 9.05 + k * 0.08, z, 7.5 + k * 0.08, 0.09, 0.18 + k * 0.05, slate);
    B(o, 'wall', 2.4, 11.7, -1.6, 0.55, 1.75, 0.65, cream);
    B(o, 'roof', 2.4, 13.45, -1.6, 0.68, 0.1, 0.8, slate);
  }
}
function wingRoof(o, d) {
  const f = facing(o, Math.PI / 2, -2.2, -12.5),
    y = (_x, z) => 9.1 - Math.abs(z) * 1.05;
  roofPlane(f, [-7.4, 0, 7.4, 2.32], y, [], d);
  roofPlane(f, [-7.4, -2.32, 7.4, 0], y, [], d);
  for (const sign of [-1, 1]) {
    const p = [
      [sign * 7.05, 6.5, -2.2],
      [sign * 7.05, 6.5, 2.2],
      [sign * 7.05, 9.1, 0],
    ];
    f.addTriangle(
      'wall',
      ref,
      p,
      [sign, 0, 0],
      p.map((v) => [v[2], v[1]]),
      yellow,
    );
  }
  if (d) B(f, 'roof', 0, 9.06, 0, 14.9, 0.12, 0.15, slate);
  for (const xx of d ? [-3.7, 3.0] : [])
    dormer(f, xx, 1.9, d, { low: 7.16, top: 8.62, w: 1.13, depth: 1.28 });
}
function swag(o, x, y, w, h, z, d, c = red) {
  const n = d > 2 ? 12 : 5,
    points = Array.from({ length: n + 1 }, (_, i) => [
      x - w / 2 + (w * i) / n,
      y - h * Math.sin((Math.PI * i) / n),
      z,
    ]);
  curved(o, 'wood', points, 0.045, c);
}
function portal(o, d) {
  const x = 1.9,
    w = 2.35,
    h = 2.65;
  face(o, 'wood', x, 0.12, 0.1, w, h, green);
  face(o, 'glass', x, 2.78, 0.12, w, 0.5, glass);
  if (!d) return;
  for (const xx of [x - w / 2 - 0.13, x + w / 2 + 0.13]) {
    B(o, 'stone', xx, 0.05, 0.08, 0.21, 3.44, 0.33, stone);
    B(o, 'stone', xx, 0.05, 0.12, 0.28, 0.25, 0.4, stone);
  }
  for (const [y, ww, hh] of [
    [3.3, 2.9, 0.13],
    [3.46, 3.15, 0.1],
    [3.95, 2.1, 0.1],
  ])
    B(o, 'stone', x, y, 0.12, ww, hh, 0.4, stone);
  const p = [
      [x - 1.45, 3.56, 0.18],
      [x + 1.45, 3.56, 0.18],
      [x + 1.05, 3.7, 0.18],
      [x + 0.9, 3.95, 0.18],
      [x - 0.9, 3.95, 0.18],
      [x - 1.05, 3.7, 0.18],
    ],
    ids = earcut(p.flatMap((v) => [v[0], v[1]]));
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((j) => p[j]);
    o.addTriangle(
      'stone',
      ref,
      q,
      [0, 0, 1],
      q.map((v) => [v[0], v[1]]),
      stone,
    );
  }
  if (d < 2) return;
  for (const xx of [x - 0.98, x - 0.52, x + 0.52, x + 0.98]) {
    const ww = Math.abs(xx - x) > 0.8 ? 0.29 : 0.76;
    outline(o, xx, 0.28, ww, 1.75, 0.19, 'wood', red);
    for (const yy of [0.28, 2.02]) B(o, 'wood', xx, yy, 0.18, ww + 0.09, 0.045, 0.08, green);
    for (const xr of [xx - ww / 2 - 0.04, xx + ww / 2 + 0.04])
      B(o, 'wood', xr, 0.26, 0.18, 0.035, 1.83, 0.08, green);
  }
  for (const xx of [x - 0.5, x + 0.5]) {
    swag(o, xx, 2.47, 0.68, 0.12, 0.21, d);
    for (const a of [-1, 1]) face(o, 'wood', xx + a * 0.34, 2.31, 0.22, 0.055, 0.18, red);
    const n = d > 2 ? 16 : 8;
    curved(
      o,
      'wood',
      Array.from({ length: n + 1 }, (_, i) => [
        xx + 0.16 * Math.cos((i * Math.PI * 2) / n),
        1.13 + 0.19 * Math.sin((i * Math.PI * 2) / n),
        0.24,
      ]),
      0.03,
      red,
    );
    B(o, 'metal', xx, 1.07, 0.3, 0.1, 0.1, 0.08, gold);
  }
  B(o, 'wood', x, 0.12, 0.2, 0.05, 2.64, 0.08, green);
  B(o, 'metal', x + 0.07, 1.15, 0.28, 0.075, 0.3, 0.06, gold);
  for (let i = 0; i < 6; i++) {
    const cx = x - 1.0 + i * 0.4;
    curved(
      o,
      'wood',
      Array.from({ length: 7 }, (_, j) => [
        cx - 0.2 + (0.4 * j) / 6,
        2.95 + 0.16 * Math.sin((Math.PI * j) / 6),
        0.22,
      ]),
      0.036,
      green,
    );
  }
  for (const s of [-1, 1]) swag(o, x + s * 0.5, 4.17, 0.92, 0.17, 0.18, d, stone);
  B(o, 'stone', x, 3.28, 0.28, 0.33, 0.4, 0.3, stone);
  for (let i = 0; i < 5; i++)
    beam(
      o,
      'stone',
      [x, 3.8, 0.3],
      [x + (i - 2) * 0.08, 4.02 - Math.abs(i - 2) * 0.05, 0.3],
      0.06,
      0.06,
      stone,
    );
  if (d > 2) {
    for (let i = 0; i < 20; i++) face(o, 'wood', x - 1.1 + i * 0.115, 2.72, 0.26, 0.04, 0.035, red);
    for (const xx of [x - 0.97, x + 0.97]) {
      const p = [
        [xx - 0.1, 2.19, 0.23],
        [xx + 0.1, 2.19, 0.23],
        [xx + 0.05, 2.35, 0.23],
        [xx + 0.12, 2.48, 0.23],
        [xx - 0.12, 2.48, 0.23],
        [xx - 0.05, 2.35, 0.23],
      ];
      const ids = earcut(p.flatMap((v) => [v[0], v[1]]));
      for (let i = 0; i < ids.length; i += 3) {
        const q = ids.slice(i, i + 3).map((j) => p[j]);
        o.addTriangle(
          'wood',
          ref,
          q,
          [0, 0, 1],
          q.map((v) => [v[0], v[1]]),
          red,
        );
      }
    }
  }
}
function trellis(o, w, y, h, d) {
  if (d < 2) return;
  for (const yy of [y, y + h * 0.65]) B(o, 'wood', 0, yy, 0.14, w, 0.055, 0.06, green);
  for (let i = 0, n = Math.ceil(w / 0.3); i <= n; i++) {
    const x = -w / 2 + (i * w) / n;
    B(o, 'wood', x, y - 0.15, 0.16, 0.05, h + 0.3, 0.06, green);
  }
}
export function beethoven(o, _frame, d = 3) {
  rect(o, -3.6, -5.6, 3.6, 5.4, -0.4, 9.4, 'wall', pink);
  face(facing(o, Math.PI, 0, -5.61), 'wall', 0, 0.2, 0.0, 7.2, 9.2, yellow);
  rect(o, -4.15, -19.55, -0.2, -5.4, -0.4, 6.5, 'wall', yellow);
  mainRoof(o, d);
  wingRoof(o, d);
  const f = facing(o, 0, 0, 5.41);
  B(f, 'stone', 0, -0.15, 0.01, 7.2, 0.42, 0.14, stone);
  for (const y of [4.35, 7.15])
    for (const x of [-1.9, 1.9]) {
      window(f, x, y, 2.0, 1.53, d, { pairs: true, redPanels: true });
      basket(f, x, y, 2, d);
    }
  window(f, -1.9, 1.02, 2.0, 1.62, d, { pairs: true, redPanels: true });
  portal(f, d);
  if (d) {
    B(f, 'stone', -1.9, 3.55, 0.11, 1.08, 0.3, 0.12, stone);
    if (d > 1) {
      for (const yy of [3.59, 3.77]) face(f, 'stone', -1.9, yy, 0.19, 0.94, 0.025, white);
      for (const xx of [-2.36, -1.44]) B(f, 'metal', xx, 3.59, 0.2, 0.045, 0.045, 0.035, gold);
    }
    B(f, 'metal', 3.4, 0.2, 0.17, 0.07, 9.0, 0.07, slate);
    B(f, 'stone', 3.25, 1.42, 0.13, 0.32, 0.46, 0.06, stone);
  }
  const back = facing(o, Math.PI, 0, -5.62);
  window(back, -1.8, 0.6, 2.25, 2.45, d, { shutters: false, door: true });
  for (const y of [4.1, 6.95]) window(back, -1.8, y, 1.12, 1.65, d);
  window(back, 1.8, 6.95, 1.12, 1.65, d);
  trellis(facing(back, 0, -1.8, 0), 2.5, 3.24, 0.25, d);
  const wing = facing(o, Math.PI / 2, -0.19, -12.5);
  for (const x of [-5.5, -2.8, 0.1, 3.1, 5.7]) window(wing, x, 3.85, 1.05, 1.65, d);
  for (const x of [-5.4, -2.8, 2.8, 5.4]) window(wing, x, 1.0, 1.05, 1.7, d);
  window(wing, 0, 0.65, 1.2, 2.6, d, { shutters: false, door: true });
  trellis(wing, 13.5, 3.05, 0.55, d);
  if (d) {
    B(o, 'metal', -0.1, 0.5, -18.9, 0.065, 6.1, 0.065, slate);
    B(o, 'metal', -0.1, 0.5, -6.1, 0.065, 6.1, 0.065, slate);
    for (const z of [-6.1, -18.9]) B(o, 'metal', -2.2, 6.45, z, 4.4, 0.09, 0.12, slate);
  }
  // Small courtyard rises gently to the rear gate; sandstone hardscape only.
  rect(o, -0.16, -19.9, 4.5, -5.64, 0.25, 0.62, 'stone', rgb('bdb49b'));
  if (d > 1) {
    for (let j = 0; j < 18; j++) {
      const z = -19.9 + j * 0.8;
      quad(
        o,
        'stone',
        [
          [-0.16, 0.636, z],
          [4.5, 0.636, z],
          [4.5, 0.636, z + 0.024],
          [-0.16, 0.636, z + 0.024],
        ],
        [0, 1, 0],
        rgb('8e8b7c'),
      );
      for (let i = 0; i < 5; i++) {
        const x = 0.15 + i * 0.95 + (j % 2) * 0.4;
        if (x > 4.45) continue;
        quad(
          o,
          'stone',
          [
            [x, 0.638, z],
            [x + 0.02, 0.638, z],
            [x + 0.02, 0.638, z + 0.77],
            [x, 0.638, z + 0.77],
          ],
          [0, 1, 0],
          rgb('8e8b7c'),
        );
      }
    }
  }
  if (d) {
    const g = facing(o, 0, 2.15, -19.7);
    for (const x of [-2.2, 0, 2.2]) {
      B(g, 'metal', x, 0.62, 0, 0.07, 1.18, 0.07, iron);
      if (d > 2) sphere(g, 'metal', [x, 1.88, 0], [0.09, 0.1, 0.09], iron, 6, 3);
    }
    for (const yy of [0.75, 1.58]) B(g, 'metal', 0, yy, 0, 4.5, 0.035, 0.045, iron);
    if (d > 1)
      for (let i = 0; i < 17; i++)
        B(g, 'metal', -2.15 + i * 0.27, 0.75, 0, 0.025, 0.83, 0.035, iron);
  }
}
export function beethovenSkyline(o) {
  beethoven(o, undefined, 0);
}
export function beethovenDistrict(o) {
  beethoven(o, undefined, 1);
}
export function beethovenStreet(o) {
  beethoven(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.88, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.28 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const beethovenModel = {
  id: 'beethoven_house',
  recipe: 'structure-beethoven-house.mjs',
  key: 'beethoven_house',
  cell: 'u1/u1j',
  title: 'Beethoven House',
  brief:
    'Bonngasse 20: narrow three-storey pink street facade, paired white casements and green/red shutters, carved stone portal and paneled green door, slate roof with two curved dormers; yellow rear elevation and lower garden wing beside the paved courtyard.',
  camera: [27, 23, 32],
  lookAt: [0, 5, -6],
  qaCameras: [
    { name: 'front', position: [8, 10, 29], lookAt: [0, 5, 1] },
    { name: 'back', position: [25, 19, -35], lookAt: [-1, 4, -8] },
  ],
  build: beethoven,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Bonngasse pavement at local [1.6,5.65], Y=0. Front doorway floor about Y=0.12; courtyard Y=0.62 and lower rear-wing threshold Y=0.65 follow the slight independent ground rise.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-beethoven-house.mjs',
    level: 'skyline',
    export: 'beethovenSkyline',
    errorMeters: 0.18,
    surfaces,
    authoredLevels: {
      district: { export: 'beethovenDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'beethovenStreet', errorMeters: 0.03, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from five individually inspected local Qualla street/courtyard/garden/portal photographs, official museum building history and aerial roof context. Hidden party walls, exact dimensions, roof joins and small ornament are estimates; no surveyed plan used.',
    'Bonngasse 20 front building, connected lower birthplace garden wing and courtyard hardscape only. Bonngasse 18, research/concert buildings, sculpture, vegetation, interiors, people and photographic pixels excluded.',
    'Independent unmodified Terrarium ground retained. Urban elevation interpolation is not survey accuracy; host terrain may differ. Footprint replacement remains disabled.',
    'Shutter panels, door relief, dormer caps, trellis, slate courses and garden gate are simplified progressively at distance. No physical-device performance measurement claimed.',
  ],
};
