/** Montreal basilica main exterior: two square Gothic towers, real recessed portico and low main roof. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/f2/f25/notre_dame_basilica_montreal/map-frame.json' with {
  type: 'json',
};
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('a4a59f'),
  trim = rgb('bdbeb6'),
  shadow = rgb('787b76'),
  dark = rgb('303a3b'),
  glass = rgb('415157'),
  roof = rgb('6d7876'),
  sculpture = rgb('aeb0a5');
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, q, n, u, col) => o.addTriangle(s, r, q.map(p), v(n), u, col),
    addQuad: (s, r, q, n, u, col) => o.addQuad(s, r, q.map(p), v(n), u, col),
    addConvexPolygon: (s, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, s, x, y, z, w, h, col) {
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
    col,
  );
}
function polygon(o, s, r, y, col, up = true) {
  const q = r.slice();
  if (Math.hypot(q[0][0] - q.at(-1)[0], q[0][1] - q.at(-1)[1]) < 0.001) q.pop();
  const ids = earcut(q.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [q[k][0], y, q[k][1]]);
    if (up) p.reverse();
    o.addTriangle(
      s,
      ref,
      p,
      [0, up ? 1 : -1, 0],
      p.map((v) => [v[0], v[2]]),
      col,
    );
  }
}
function filled(o, s, pts, z, col) {
  const ids = earcut(pts.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [pts[k][0], pts[k][1], z]);
    o.addTriangle(
      s,
      ref,
      p,
      [0, 0, 1],
      p.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function stripe(o, s, a, b, w, col) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    v = [((-dy / l) * w) / 2, ((dx / l) * w) / 2, 0];
  quad(
    o,
    s,
    [
      a.map((x, i) => x - v[i]),
      b.map((x, i) => x - v[i]),
      b.map((x, i) => x + v[i]),
      a.map((x, i) => x + v[i]),
    ],
    [0, 0, 1],
    col,
  );
}
function rectFrame(o, x, y, z, w, h, d, col = trim) {
  const t = d < 2 ? 0.12 : 0.16;
  face(o, 'trim', x - w / 2, y, z, t, h, col);
  face(o, 'trim', x + w / 2, y, z, t, h, col);
  face(o, 'trim', x, y, z, w, t, col);
  face(o, 'trim', x, y + h - t, z, w, t, col);
}
function curve(x, y, w, h, n) {
  const a = w / 2,
    spring = y + h * 0.62,
    rise = h * 0.38,
    left = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [
        x - a + a * t,
        spring + (rise * Math.sqrt(Math.max(0, 4 - (t - 2) * (t - 2)))) / Math.sqrt(3),
      ];
    });
  return [
    ...left,
    ...left
      .slice(0, -1)
      .reverse()
      .map((p) => [2 * x - p[0], p[1]]),
  ];
}
/** Patch a wall around a real opening, its intrados and an opaque recessed back. */
function arch(
  o,
  x,
  y,
  z,
  w,
  h,
  panelW,
  panelH,
  depth,
  d,
  { slot = 'stone', back = true, col = stone, backCol = dark, outline = true } = {},
) {
  const c = curve(x, y, w, h, [1, 1, 3, 7][d]),
    top = y + panelH;
  const chain = [[x - w / 2, y], ...c, [x + w / 2, y]];
  if (d === 0) {
    face(o, slot, x, y, z, panelW, panelH, col);
    filled(o, 'glass', chain, z + 0.01, backCol);
    return;
  }
  const pw = (panelW - w) / 2;
  for (const sign of [-1, 1])
    if (pw > 0.001) face(o, slot, x + (sign * (w + pw)) / 2, y, z, pw, panelH, col);
  for (let i = 1; i < c.length; i++)
    quad(
      o,
      slot,
      [
        [c[i - 1][0], c[i - 1][1], z],
        [c[i][0], c[i][1], z],
        [c[i][0], top, z],
        [c[i - 1][0], top, z],
      ],
      [0, 0, 1],
      col,
    );
  if (depth > 0)
    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1],
        b = chain[i],
        q = [
          [a[0], a[1], z],
          [a[0], a[1], z - depth],
          [b[0], b[1], z - depth],
          [b[0], b[1], z],
        ];
      quad(o, slot, q, normalFor(...q), shadow);
    }
  if (back) filled(o, 'glass', chain, z - depth, backCol);
  if (outline)
    for (let i = 1; i < chain.length; i++)
      stripe(
        o,
        'trim',
        [...chain[i - 1], z + 0.025],
        [...chain[i], z + 0.025],
        d === 1 ? 0.13 : 0.22,
        trim,
      );
}
function ring(o, x, y, z, r, t, d, col = trim) {
  const n = [6, 8, 16, 32][d];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    quad(
      o,
      'trim',
      [
        [x + (r - t) * Math.cos(a), y + (r - t) * Math.sin(a), z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
        [x + (r - t) * Math.cos(b), y + (r - t) * Math.sin(b), z],
      ],
      [0, 0, 1],
      col,
    );
  }
}
function disk(o, x, y, z, r, d, col = glass) {
  const n = [6, 8, 16, 32][d];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    o.addTriangle(
      'glass',
      ref,
      [
        [x, y, z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      col,
    );
  }
}
function rose(o, x, y, z, r, d) {
  disk(o, x, y, z, r, d);
  if (!d) return;
  ring(o, x, y, z + 0.02, r + 0.15, 0.18, d);
  if (d >= 2) {
    ring(o, x, y, z + 0.04, r * 0.28, 0.08, d);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      stripe(
        o,
        'trim',
        [x + r * 0.23 * Math.cos(a), y + r * 0.23 * Math.sin(a), z + 0.05],
        [x + r * 0.92 * Math.cos(a), y + r * 0.92 * Math.sin(a), z + 0.05],
        0.065,
        trim,
      );
      if (d === 3) {
        const px = x + r * 0.64 * Math.cos(a),
          py = y + r * 0.64 * Math.sin(a);
        ring(o, px, py, z + 0.035, r * 0.22, 0.045, 1);
      }
    }
  }
}
function tracery(o, x, y, z, w, h, d, louvre = false) {
  if (!d) return;
  // Paired lancets below a circular tracery head, never a clock face.
  face(o, 'trim', x, y, z, w * 0.065, h * 0.7, trim);
  const yy = y + h * 0.79;
  if (d >= 2) rose(o, x, yy, z, w * 0.18, d === 2 ? 1 : d);
  if (d >= 2) {
    for (const sign of [-1, 1]) {
      const c = curve(x + sign * w * 0.25, y, w * 0.42, h * 0.71, [1, 1, 3, 6][d]);
      for (let i = 1; i < c.length; i++)
        stripe(o, 'trim', [...c[i - 1], z], [...c[i], z], 0.08, trim);
    }
    const rows = louvre ? (d === 3 ? 13 : 7) : 8;
    for (let i = 1; i < rows; i++)
      face(
        o,
        louvre ? 'metal' : 'trim',
        x,
        y + (h * 0.67 * i) / rows,
        z + 0.01,
        w * 0.91,
        louvre ? 0.13 : 0.035,
        louvre ? dark : shadow,
      );
    if (!louvre) {
      for (const xx of [-0.35, -0.15, 0.15, 0.35])
        face(o, 'metal', x + w * xx, y, z + 0.012, 0.035, h * 0.66, dark);
    }
  }
}
function windowPanel(o, y0, y1, wy, wh, d, { louvre = false, roseOnly = false } = {}) {
  const w = 8.8;
  if (roseOnly) {
    face(o, 'stone', 0, y0, 0, w, y1 - y0, stone);
    rose(o, 0, (y0 + y1) / 2, 0.025, 1.48, d);
    if (d >= 2) rectFrame(o, 0, y0 + 0.3, 0.018, 6.5, y1 - y0 - 0.6, d, shadow);
    return;
  }
  face(o, 'stone', 0, y0, 0, w, wy - y0, stone);
  arch(o, 0, wy, 0, 3.55, wh, w, y1 - wy, d ? 0.42 : 0, d, { backCol: louvre ? dark : glass });
  tracery(o, 0, wy + 0.05, -0.39, 3.3, wh - 0.2, d, louvre);
  if (d) {
    face(o, 'trim', 0, wy - 0.15, 0.09, 3.85, 0.16, trim);
  }
}
function crenels(o, w, y, z, d, n) {
  face(o, 'stone', 0, y, z, w, 0.65, stone);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + ((i + 0.5) * w) / n;
    if (d) B(o, 'stone', x, y + 0.65, z - 0.15, (w / n) * 0.48, 1.05, 0.34, stone);
    else face(o, 'stone', x, y + 0.65, z + 0.01, (w / n) * 0.48, 1.05, stone);
    if (d >= 2) face(o, 'trim', x, y + 1.62, z + 0.035, (w / n) * 0.52, 0.15, trim);
  }
}
function cornerPier(o, x, z, d) {
  const n = d >= 2 ? 8 : 4,
    low =
      d >= 2
        ? [
            [-5.2, 0.72],
            [15.8, 0.72],
            [16.1, 0.62],
            [30.5, 0.62],
            [31, 0.54],
            [57.8, 0.54],
            [58.2, 0.65],
            [60.4, 0.48],
            [62.5, 0.43],
            [63, 0.25],
          ]
        : [
            [-5.2, 0.65],
            [58, 0.65],
            [62.8, 0.35],
          ];
  loft(
    o,
    'trim',
    low.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
    stone,
  );
  loft(
    o,
    'metal',
    [radialRing(62.8, 0.26, 0.26, n, [x, z]), radialRing(65, 0.012, 0.012, n, [x, z])],
    roof,
  );
  if (d >= 2)
    for (const y of [5.2, 10.6, 15.8, 20.5, 25.5, 30.5, 35.5, 41.8, 47.3, 57.8, 60.3])
      loft(
        o,
        'trim',
        [radialRing(y, 0.75, 0.75, 8, [x, z]), radialRing(y + 0.16, 0.75, 0.75, 8, [x, z])],
        trim,
      );
}
function tower(o, x, z, d) {
  if (!d) {
    B(o, 'stone', x, -5.2, z, 8.8, 63.4, 8.8, stone);
    for (let i = 0; i < 4; i++) {
      const q = facing(
        o,
        (i * Math.PI) / 2,
        x + (i === 1 ? 4.4 : i === 3 ? -4.4 : 0),
        z + (i === 0 ? 4.4 : i === 2 ? -4.4 : 0),
      );
      for (const [y, h] of [
        [5, 8.5],
        [20, 8.5],
        [32.5, 8],
        [48.7, 8.6],
      ])
        filled(q, 'glass', [[-1.7, y], ...curve(0, y, 3.4, h, 1), [1.7, y]], 0.012, dark);
      rose(q, 0, 44.6, 0.013, 1.5, d);
      crenels(q, 8.8, 58.2, 0, d, 3);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        q = facing(o, a, x + Math.sin(a) * 4.4, z + Math.cos(a) * 4.4);
      windowPanel(q, -5.2, 16.1, 5, 8.5, d);
      windowPanel(q, 16.1, 30.6, 20, 8.5, d);
      windowPanel(q, 30.6, 41.9, 32.5, 8, d, { louvre: true });
      windowPanel(q, 41.9, 47.4, 0, 0, d, { roseOnly: true });
      windowPanel(q, 47.4, 58.2, 48.7, 8.6, d, { louvre: true });
      crenels(q, 8.8, 58.2, 0, d, 3);
      for (const y of [5.0, 16.0, 30.5, 41.8, 47.3, 57.9]) {
        face(q, 'trim', 0, y, 0.1, 9.05, 0.22, trim);
        if (d >= 2) face(q, 'trim', 0, y - 0.17, 0.06, 8.9, 0.12, shadow);
      }
    }
    B(o, 'roof', x, 58.18, z, 8.7, 0.08, 8.7, roof);
    if (x < 0) {
      const q = facing(o, -Math.PI / 2, x - 4.4, z);
      door(q, 0, 0.6, 0.035, 2.7, 3.8, Math.min(d, 2));
      const risers = d === 1 ? 6 : 12;
      for (let i = 0; i < risers; i++)
        B(
          q,
          'stone',
          0,
          -2.1,
          3.4 - (i * 3.36) / risers,
          3.1,
          ((i + 1) * 2.7) / risers,
          3.6 / risers,
          stone,
        );
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cornerPier(o, x + sx * 4.4, z + sz * 4.4, d);
}
function statue(o, x, y, z, d, kind) {
  if (!d) {
    filled(
      o,
      'sculpture',
      [
        [x - 0.55, y],
        [x + 0.55, y],
        [x + 0.3, y + 3.3],
        [x, y + 4.2],
        [x - 0.3, y + 3.3],
      ],
      z,
      sculpture,
    );
    return;
  }
  const n = d === 1 ? 4 : d === 2 ? 8 : 16;
  const rings = [
    [y + 0.05, 0.55],
    [y + 1.25, 0.42],
    [y + 2.6, 0.35],
    [y + 3.15, 0.52],
  ].map(([h, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * 2 * Math.PI) / n,
        rr = r * (1 + (d >= 2 ? 0.09 : 0) * Math.cos(8 * a));
      return [x + rr * Math.cos(a), h, z + rr * 0.65 * Math.sin(a)];
    }),
  );
  loft(o, 'sculpture', rings, sculpture);
  sphere(o, 'sculpture', [x, y + 3.7, z], [0.32, 0.43, 0.3], sculpture, n, d >= 2 ? 6 : 3);
  for (const sign of [-1, 1]) {
    const end = [
      x + sign * (kind === 'mary' ? 1.0 : 0.6),
      y + (kind === 'mary' ? 2.4 : 2.75),
      z + 0.23,
    ];
    beam(o, 'sculpture', [x + sign * 0.42, y + 3.05, z], end, 0.19, 0.23, sculpture);
    if (d >= 2) sphere(o, 'sculpture', end, [0.12, 0.15, 0.12], sculpture, 6, 4);
  }
  if (kind === 'joseph' && d >= 2) {
    sphere(o, 'sculpture', [x + 0.48, y + 3.25, z + 0.25], [0.22, 0.27, 0.2], sculpture, 8, 5);
    beam(
      o,
      'sculpture',
      [x + 0.45, y + 3.0, z + 0.25],
      [x + 0.38, y + 2.4, z + 0.3],
      0.28,
      0.28,
      sculpture,
    );
  }
  if (kind === 'john') {
    beam(o, 'metal', [x - 0.8, y, z], [x - 0.8, y + 4.8, z], 0.07, 0.07, dark);
    beam(o, 'metal', [x - 1.1, y + 4.2, z], [x - 0.5, y + 4.2, z], 0.07, 0.07, dark);
  }
}
function door(o, x, y, z, w, h, d) {
  arch(o, x, y, z, w, h, w + 0.5, h + 0.6, 0, d, { slot: 'trim', col: trim, backCol: dark });
  if (d) {
    for (const sign of [-1, 1])
      face(o, 'metal', x + sign * w * 0.24, y, z + 0.02, w * 0.45, h * 0.72, dark);
    face(o, 'trim', x, y, z + 0.03, 0.09, h * 0.75, trim);
    for (let i = 1; i < (d === 3 ? 9 : 4); i++)
      face(
        o,
        'metal',
        x,
        y + (h * 0.72 * i) / (d === 3 ? 9 : 4),
        z + 0.05,
        w * 0.94,
        0.035,
        shadow,
      );
  }
}
function front(o, d) {
  const z = 32.12,
    w = 23.0,
    each = w / 3;
  // Base/platform and shallow six-riser public entrance stair; no adaptive foundation.
  B(o, 'stone', 0, -0.8, z - 1.1, w + 1.6, 1.4, 4.4, stone);
  if (d)
    for (let i = 0; i < 6; i++)
      B(o, 'stone', 0, -0.8, z + 2.9 - i * 0.42, w + 1.8, (i + 1) * 0.1 + 0.8, 0.44, stone);
  else B(o, 'stone', 0, -0.8, z + 1.8, w + 1.8, 1.0, 1.7, stone);
  for (let i = -1; i <= 1; i++) {
    const q = facing(o, 0, i * each, z),
      pw = each;
    arch(q, 0, 0.6, 0, 6.7, 14.5, pw, 15.5, 2.3, d, { back: false });
    if (d) {
      arch(q, 0, 0.6, -2.3, 3.4, 4.1, pw, 5.4, 0, d, { backCol: dark });
      door(q, 0, 0.6, -2.25, 3.4, 4.1, d);
      arch(q, 0, 6, -2.24, 3.3, 7.0, pw, 10.1, 0.3, d, { outline: true, backCol: glass });
      tracery(q, 0, 6.1, -2.5, 3.12, 6.7, d);
      if (d >= 2) {
        for (const off of [0.24, 0.45]) {
          const cc = curve(0, 0.6, 6.7 + off * 2, 14.5 + off, [1, 1, 3, 7][d]);
          for (let k = 1; k < cc.length; k++)
            stripe(
              q,
              'trim',
              [...cc[k - 1], 0.04 + off * 0.1],
              [...cc[k], 0.04 + off * 0.1],
              0.11,
              trim,
            );
        }
      }
    }
    face(q, 'trim', 0, 16.0, 0.08, pw, 0.5, trim);
    arch(q, 0, 18.8, 0.0, 6.2, 11.1, pw, 12.6, 0.2, d, { backCol: shadow });
    if (d) {
      arch(q, 0, 22.1, -0.15, 2.7, 6.7, 3.4, 7.0, 0.5, d, { backCol: shadow });
      B(q, 'trim', 0, 21.85, -0.15, 3, 0.25, 1.2, trim);
      statue(q, 0, 22.1, -0.35, d, i === -1 ? 'joseph' : i === 0 ? 'mary' : 'john');
      if (d >= 2)
        for (const xx of [-2.5, 2.5]) {
          face(q, 'trim', xx, 17.7, 0.03, 0.28, 4.2, trim);
          face(q, 'trim', xx, 20.9, 0.07, 0.6, 0.22, trim);
        }
    }
  }
  face(o, 'stone', 0, 16.5, z, w, 2.3, stone);
  face(o, 'stone', 0, 30.5, z, w, 1.1, stone);
  face(o, 'trim', 0, 31.55, z + 0.08, w, 0.34, trim);
  crenels(o, w, 31.9, z, d, 10);
  B(o, 'metal', 0, 33.6, z - 0.2, 0.1, 1.9, 0.1, roof);
  B(o, 'metal', 0, 34.6, z - 0.2, 0.95, 0.1, 0.1, roof);
}
function navePinnacle(o, x, z, d) {
  const n = d < 2 ? 4 : 8;
  loft(
    o,
    'trim',
    d < 2
      ? [radialRing(28.4, 0.55, 0.55, n, [x, z]), radialRing(34.5, 0.14, 0.14, n, [x, z])]
      : [
          radialRing(28.4, 0.55, 0.55, n, [x, z]),
          radialRing(31.6, 0.45, 0.45, n, [x, z]),
          radialRing(32.0, 0.56, 0.56, n, [x, z]),
          radialRing(34.5, 0.14, 0.14, n, [x, z]),
        ],
    stone,
  );
  if (d >= 2)
    loft(
      o,
      'metal',
      [radialRing(34.45, 0.14, 0.14, n, [x, z]), radialRing(35.2, 0.008, 0.008, n, [x, z])],
      roof,
    );
}
function naveWindow(o, x, y, z, w, h, pw, ph, d) {
  arch(o, x, y, z, w, h, pw, ph, 0.3, d, { backCol: glass });
  if (!d) return;
  // Three narrow lights and two broad transoms observed on the street-side elevation.
  for (const sign of [-1, 1])
    face(o, 'trim', x + (sign * w) / 6, y + 0.04, z - 0.27, 0.09, h * 0.73, trim);
  for (const t of [0.31, 0.61]) face(o, 'trim', x, y + h * t, z - 0.25, w, 0.18, trim);
  if (d >= 2) {
    for (const sign of [-1, 0, 1]) {
      const c = curve(x + (sign * w) / 3, y, w * 0.31, h * 0.92, 3);
      for (let i = 1; i < c.length; i++)
        stripe(o, 'trim', [...c[i - 1], z - 0.26], [...c[i], z - 0.26], 0.065, trim);
    }
    for (let i = 1; i < 12; i++)
      face(o, 'metal', x, y + (h * 0.7 * i) / 12, z - 0.24, w * 0.94, 0.025, shadow);
  }
}
function lowerDoorCanopy(o, d) {
  // East-side basement entrance: photographic extension,not the unrelated native western projection.
  const q = facing(o, -Math.PI / 2, -20.5, -7),
    floor = -3.2;
  door(q, 0, floor, 0.05, 2.1, 2.6, Math.min(d, 2));
  for (const sign of [-1, 1]) B(q, 'stone', sign * 1.8, -5.2, 1.05, 0.35, 4.7, 2.1, stone);
  const z0 = -0.08,
    z1 = 2.2;
  for (const sign of [-1, 1]) {
    const p = [
      [0, 0.35, z0],
      [0, 0.35, z1],
      [sign * 2.15, -0.5, z1],
      [sign * 2.15, -0.5, z0],
    ];
    if (sign < 0) p.reverse();
    quad(q, 'roof', p, normalFor(...p), roof);
  }
  if (d) {
    for (const z of [z0, z1]) {
      const pp = facing(q, z === z0 ? Math.PI : 0, 0, z);
      filled(
        pp,
        'trim',
        [
          [-2.15, -0.5],
          [2.15, -0.5],
          [0, 0.35],
        ],
        0.015,
        trim,
      );
    }
    B(q, 'stone', 0, -3.45, 1.3, 3.2, 0.25, 2.3, stone);
  }
}
function body(o, frame, d) {
  const r = frame.geometry.outline.slice(0, -1),
    body = r.slice(0, 16),
    foot = -5.2;
  polygon(o, 'stone', body, foot, stone, false);
  polygon(o, 'roof', body, 29, roof);
  for (let i = 13; i < body.length; i++) {
    let a = body[i],
      b = body[(i + 1) % body.length];
    if (i === 13) {
      const t = 9.6 / Math.hypot(b[0] - a[0], b[1] - a[1]);
      a = a.map((v, k) => v + (b[k] - v) * t);
    } else if (i === 15) {
      const t = 9.6 / Math.hypot(b[0] - a[0], b[1] - a[1]);
      b = b.map((v, k) => v + (a[k] - v) * t);
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        o,
        Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    if (i === 14) {
      face(q, 'stone', 0, foot, 0, len, 29 - foot, stone);
      if (d)
        for (const x of [-10, 0, 10])
          filled(
            q,
            'glass',
            [[x - 1.1, 5], ...curve(x, 5, 2.2, 17, 1), [x + 1.1, 5]],
            0.015,
            glass,
          );
    } else {
      const reverse = i === 15,
        sign = reverse ? 1 : -1,
        endX = sign * (len / 2 - 4.55),
        mainW = len - 9.1,
        offset = -sign * 4.55;
      if (!d) {
        face(q, 'stone', 0, foot, 0, len, 29 - foot, stone);
        B(q, 'stone', endX, 29, -0.18, 9.1, 4.3, 0.36, stone);
        crenels(facing(q, 0, endX, 0), 9.1, 33.3, 0, d, 4);
      } else {
        face(q, 'stone', 0, foot, 0, len, 0.6 - foot, shadow);
        face(q, 'stone', 0, 0.6, 0, len, 3.4, stone);
        for (let k = 0; k < 4; k++) {
          const x = offset - mainW / 2 + ((k + 0.5) * mainW) / 4;
          naveWindow(q, x, 4, 0, 4.8, 22, mainW / 4, 25, d);
        }
        naveWindow(q, endX, 4, 0, 4.7, 22, 9.1, 25, d);
        for (const t of [-0.5, 0.5])
          B(q, 'stone', endX + t * 8.3, foot, 0.28, 0.9, 34.2, 0.85, stone);
        // Raised rear end bay with a blind upper lancet panel and crenellated parapet.
        arch(q, endX, 29, 0, 3.5, 3.4, 9.1, 4.3, 0.15, d === 1 ? 0 : Math.min(d, 2), {
          backCol: shadow,
        });
        B(q, 'stone', endX, 29, -0.25, 9.1, 4.3, 0.14, stone);
        crenels(facing(q, 0, endX, 0), 9.1, 33.3, 0, d, 4);
        for (let k = 0; k <= 4; k++) {
          const x = offset - mainW / 2 + (k * mainW) / 4;
          B(q, 'stone', x, foot, 0.35, 0.8, 33.6, 1.0, stone);
          if (d >= 2)
            for (const y of [0.6, 8, 17, 26]) B(q, 'trim', x, y, 0.35, 1.0, 0.22, 1.2, trim);
        }
        face(q, 'trim', 0, 0.45, 0.09, len, 0.3, trim);
        face(q, 'trim', 0, 28.5, 0.08, len, 0.36, trim);
      }
      // Roofline shafts are silhouette geometry at every level.
      for (let k = 0; k <= 4; k++) {
        const x = offset - mainW / 2 + (k * mainW) / 4;
        navePinnacle(q, x, 0.35, d);
      }
      navePinnacle(q, sign * (len / 2 - 0.45), 0.28, d);
    }
  }
  const half = 18.5,
    z0 = -32.5,
    z1 = 23.0;
  for (const sign of [-1, 1]) {
    const q = [
      [0, 33, z0],
      [0, 33, z1],
      [sign * half, 29, z1],
      [sign * half, 29, z0],
    ];
    if (sign < 0) q.reverse();
    quad(o, 'roof', q, normalFor(...q), roof);
  }
  for (const z of [z0, z1]) {
    const q = facing(o, z === z0 ? Math.PI : 0, 0, z);
    filled(
      q,
      'stone',
      [
        [-half, 29],
        [half, 29],
        [0, 33],
      ],
      0,
      stone,
    );
  }
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const z = z0 + ((z1 - z0) * (i + 0.5)) / 12;
      for (const sign of [-1, 1])
        beam(o, 'metal', [0, 33.03, z], [sign * half, 29.03, z], 0.035, 0.035, roof);
    }
  // Mapped western low volume stays an explicit estimate; its lower masonry is continuous with the church.
  const q = [[r[16][0], r[16][1]], r[17], r[18], r[19], [r[16][0], r[16][1]]];
  polygon(o, 'stone', q, foot, stone, false);
  polygon(o, 'roof', q, 7.3, roof);
  for (let i = 0; i < q.length - 1; i++) {
    const a = q[i],
      b = q[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const s = facing(
      o,
      Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      (a[0] + b[0]) / 2,
      (a[1] + b[1]) / 2,
    );
    face(s, 'stone', 0, foot, 0, len, 7.3 - foot, stone);
  }
  lowerDoorCanopy(o, d);
}
export function notreDameBasilicaMontreal(o, frame = nativeFrame, d = 3) {
  body(o, frame, d);
  front(o, d);
  for (const [x, z] of frame.geometry.towerCentersLocal) tower(o, x, z, d);
}
export const notreDameBasilicaMontrealSkyline = (o) => notreDameBasilicaMontreal(o, nativeFrame, 0);
export const notreDameBasilicaMontrealDistrict = (o) =>
  notreDameBasilicaMontreal(o, nativeFrame, 1);
export const notreDameBasilicaMontrealStreet = (o) => notreDameBasilicaMontreal(o, nativeFrame, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.45, metallic: 0.02 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.83, metallic: 0.55 },
  sculpture: { slot: 'trim', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
export const notreDameBasilicaMontrealModel = {
  id: 'notre_dame_basilica_montreal',
  key: 'notre_dame_basilica_montreal',
  recipe: 'structure-notre-dame-basilica-montreal.mjs',
  cell: 'f2/f25',
  title: 'Notre-Dame Basilica, Montreal',
  build: notreDameBasilicaMontreal,
  surfaces,
  brief:
    'Principal Montreal limestone Gothic Revival basilica: twin square65m towers with paired lancets,louvres,rose windows,octagonal corner colonnettes,crenels and eight slender pinnacle tips; deeply recessed triple entrance portico,three statuary niches with robed saints,blind pointed arcade and central cross; low-pitched copper main roof,four wide transomed nave bays per side,raised rear end bay,roofline pinnacles,lower masonry,basement entrance canopy and raised east-tower door/stair. Native western low projection remains estimated. Rear Sacred Heart chapel,adjacent seminary,interiors,scaffolding,banners and street scenery excluded.',
  camera: [100, 72, 135],
  lookAt: [0, 27, 4],
  portableGroundY: -0.15,
  quality: 'medium-fi-exterior',
  reviewStatus: 'medium-fi-exterior-bounded-preview-review-in-qa',
  geographicStatus: 'reviewed-preview',
  groundContactBasis:
    'Primary CPRQ side photos establish the lower masonry storey and basement entrance. Fixed architectural foot and stairs are checked against the original unchanged NRCan DTM;bounded source preview,not survey. No pad,cutout or adaptive foundations.',
  mediumFiContext: {
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'place-darmes-front', position: [0, 30, 123], lookAt: [0, 30, 31] },
    { name: 'triple-portico', position: [0, 9, 62], lookAt: [0, 8, 31] },
    { name: 'statuary-arcade', position: [12, 27, 57], lookAt: [0, 25, 32] },
    { name: 'west-tower', position: [44, 40, 65], lookAt: [16, 38, 28] },
    { name: 'tower-crown-tracery', position: [36, 59, 54], lookAt: [16, 53, 28] },
    { name: 'low-roof', position: [75, 69, -60], lookAt: [0, 29, -4] },
    { name: 'rear-chapel-exclusion', position: [-60, 40, -95], lookAt: [0, 18, -26] },
    { name: 'east-lower-masonry', position: [-68, 9, -9], lookAt: [-20, 7, -7] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-notre-dame-basilica-montreal.mjs',
    level: 'skyline',
    export: 'notreDameBasilicaMontrealSkyline',
    errorMeters: 2.3,
    surfaces,
    authoredLevels: {
      district: { export: 'notreDameBasilicaMontrealDistrict', errorMeters: 1.3, surfaces },
      street: { export: 'notreDameBasilicaMontrealStreet', errorMeters: 0.45, surfaces },
    },
  },
  limitations: [
    'Photo-directed medium-fi exterior,not a survey,scan or navigable interior. Fine Gothic carving,tracery,louvre slats and statue anatomy simplified; side articulation follows primary CPRQ photos;western hidden details,vestibule height and rear interface remain estimates.',
    'Foundation publishes65m body length,37m width and65m towers above forecourt. Native40.8m facade includes tower/buttress projections. Main65m rear interface explicitly inferred within103m merged parent; rear chapel and dependencies excluded. No whole-parent footprint replacement.',
    'Published65m tower height used as approximate pinnacle bound.29m main eave,33m low roof ridge,lower floor/base and all facade levels are photographic estimates.',
    'Original NRCan bare-earth ground and dry pavement reference remain unchanged. Primary side photos establish a missing lower masonry storey,basement doorway/canopy,raised entrance stair and roofline articulation. Fixed lower-storey/subgrade foot-5.2m,crypt door floor-3.2m and main floor+.6m are architectural approximations,not terrain-derived per-vertex fitting. Bounded source-ground contact must pass current QA before activation;no pad or cutout.',
    'Two accepted local originals control facade/colour;three primary CPRQ full side/rear photos control lower masonry,side bays,pinnacles and copper roof. Temporary scaffolds,banners,night illumination,adjacent seminary,forecourt monuments,traffic and interiors excluded. Photos are inspected controls,not redistributed texture pixels; shared material graphs.',
  ],
};
