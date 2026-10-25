/** Historic Palace U and its courtyard; modern Tower explicitly outside scope. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/te/te7/taj_mahal_palace_hotel/map-frame.json' with {
  type: 'json',
};
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  stone = rgb('858985'),
  cream = rgb('e5dcc6'),
  pale = rgb('eee7d6'),
  red = rgb('a45142'),
  tile = rgb('ac6653'),
  glass = rgb('425b62'),
  shadow = rgb('333b3a'),
  gold = rgb('b8a273');
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
function filled(o, s, p, z, col) {
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => [p[k][0], p[k][1], z]);
    o.addTriangle(
      s,
      ref,
      q,
      [0, 0, 1],
      q.map((p) => [p[0], p[1]]),
      col,
    );
  }
}
function polygon(o, s, r, y, col, up = true) {
  const p = r.slice();
  if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 0.001) p.pop();
  const ids = earcut(p.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => [p[k][0], y, p[k][1]]);
    if (up) q.reverse();
    o.addTriangle(
      s,
      ref,
      q,
      [0, up ? 1 : -1, 0],
      q.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function line(o, a, b, w, col = cream) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    v = [((-dy / l) * w) / 2, ((dx / l) * w) / 2, 0];
  quad(
    o,
    'trim',
    [
      a.map((p, i) => p - v[i]),
      b.map((p, i) => p - v[i]),
      b.map((p, i) => p + v[i]),
      a.map((p, i) => p + v[i]),
    ],
    [0, 0, 1],
    col,
  );
}
function frame(o, x, y, z, w, h, d) {
  if (d < 2) return;
  if (d === 2) {
    face(o, 'trim', x, y - 0.075, z - 0.028, w + 0.1, h + 0.15, cream);
    return;
  }
  for (const a of [-1, 1]) face(o, 'trim', x + (a * w) / 2, y, z, 0.1, h, cream);
  face(o, 'trim', x, y, z, w, 0.1, cream);
  face(o, 'trim', x, y + h - 0.1, z, w, 0.1, cream);
}
function window(o, x, y, z, w, h, d, { round = false, col = glass } = {}) {
  if (round) {
    const n = [1, 1, 4, 8][d],
      r = w / 2,
      pts = [
        [x - r, y],
        ...Array.from({ length: n + 1 }, (_, i) => {
          const a = Math.PI - (i * Math.PI) / n;
          return [x + r * Math.cos(a), y + h - r + r * Math.sin(a)];
        }),
        [x + r, y],
      ];
    filled(o, 'glass', pts, z, col);
    if (d >= 2)
      for (let i = 1; i < pts.length - 2; i++)
        line(o, [...pts[i], z + 0.02], [...pts[i + 1], z + 0.02], 0.13);
  } else face(o, 'glass', x, y, z, w, h, col);
  frame(o, x, y, z + 0.02, w + 0.22, h + 0.15, d);
  if (d >= 2) {
    face(o, 'trim', x, y, z + 0.035, 0.08, h, cream);
    if (d === 3) face(o, 'trim', x, y + h * 0.62, z + 0.038, w, 0.07, cream);
  }
  if (d === 3) {
    face(o, 'trim', x, y - 0.12, z + 0.15, w + 0.5, 0.14, cream);
    quad(
      o,
      'trim',
      [
        [x - w / 2 - 0.25, y + 0.02, z],
        [x + w / 2 + 0.25, y + 0.02, z],
        [x + w / 2 + 0.25, y + 0.02, z + 0.15],
        [x - w / 2 - 0.25, y + 0.02, z + 0.15],
      ].reverse(),
      [0, 1, 0],
      cream,
    );
  }
}
function curve(x, y, w, h, n) {
  const a = w / 2,
    sy = y + h * 0.62,
    rise = h * 0.38,
    l = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      return [
        x - a + a * t,
        sy + (rise * Math.sqrt(Math.max(0, 4 - (t - 2) * (t - 2)))) / Math.sqrt(3),
      ];
    });
  return [
    ...l,
    ...l
      .slice(0, -1)
      .reverse()
      .map((p) => [2 * x - p[0], p[1]]),
  ];
}
function arcade(o, x, y, z, w, h, cell, top, depth, d, closed = false) {
  const c = curve(x, y, w, h, [1, 2, 4, 8][d]),
    chain = [[x - w / 2, y], ...c, [x + w / 2, y]];
  if (!d) {
    filled(o, 'glass', chain, z + 0.02, shadow);
    return;
  }
  const side = (cell - w) / 2;
  for (const sx of [-1, 1]) face(o, 'stone', x + (sx * (w + side)) / 2, y, z, side, top - y, stone);
  for (let i = 0; i < c.length - 1; i++) {
    const a = c[i],
      b = c[i + 1];
    quad(
      o,
      'stone',
      [
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], top, z],
        [a[0], top, z],
      ],
      [0, 0, 1],
      stone,
    );
  }
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i],
      b = chain[i + 1],
      p = [
        [a[0], a[1], z],
        [a[0], a[1], z - depth],
        [b[0], b[1], z - depth],
        [b[0], b[1], z],
      ];
    quad(o, 'trim', p, normalFor(...p), cream);
    if (d >= 2) line(o, [...a, z + 0.02], [...b, z + 0.02], 0.21);
  }
  filled(o, 'glass', chain, z - depth, closed ? glass : shadow);
  if (closed && d >= 2)
    for (let i = 1; i < 4; i++)
      face(o, 'metal', x - w / 2 + (w * i) / 4, y, z - depth + 0.02, 0.06, h * 0.7, gold);
  if (d >= 2)
    for (const sx of [-1, 1])
      B(o, 'trim', x + sx * (w / 2 + 0.15), y - 0.02, z, 0.38, 1.0, 0.46, cream);
}
function rail(o, w, y, z, d) {
  face(o, 'trim', 0, y, z, w, 0.14, cream);
  face(o, 'trim', 0, y + 1, z, w, 0.13, cream);
  if (d >= 2) {
    const n = Math.floor(w / (d === 3 ? 0.35 : 1.5));
    for (let i = 0; i <= n; i++) face(o, 'trim', -w / 2 + (w * i) / n, y, z, 0.1, 1, cream);
  }
}
function gable(o, x, y, z, w, h, d) {
  filled(
    o,
    'trim',
    [
      [x - w / 2, y],
      [x, y + h],
      [x + w / 2, y],
    ],
    z,
    cream,
  );
  if (d >= 2) {
    for (const sx of [-1, 1])
      line(o, [x + (sx * w) / 2, y, z + 0.03], [x, y + h, z + 0.03], 0.17, pale);
    for (const xx of [-0.2, 0.2]) window(o, x + w * xx, y + 0.2, z + 0.04, w * 0.16, h * 0.4, 1);
  }
}
function oriel(o, x, y, z, w, h, d) {
  if (d === 2) d = 1;
  if (d === 0) {
    face(o, 'trim', x, y, z + 0.15, w, h, cream);
    for (let i = 0; i < 3; i++)
      window(o, x, y + 0.7 + (i * h) / 3, z + 0.17, w * 0.65, h / 3 - 1.1, 0);
    return;
  }
  const r = [
    [-w / 2, -0.04],
    [-w / 2, 0.9],
    [-w * 0.32, 1.45],
    [w * 0.32, 1.45],
    [w / 2, 0.9],
    [w / 2, -0.04],
  ]
    .reverse()
    .map((p) => [p[0] + x, p[1] + z]);
  if (d === 1) {
    polygon(o, 'trim', r, y, cream, false);
    polygon(o, 'trim', r, y + h, cream);
    for (let i = 0; i < 5; i++) {
      const a = r[i],
        b = r[i + 1],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        q = facing(
          o,
          Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
          (a[0] + b[0]) / 2,
          (a[1] + b[1]) / 2,
        );
      face(q, 'trim', 0, y, 0, len, h, cream);
      if (i !== 0 && i !== 4)
        for (let f = 0; f < 3; f++)
          window(q, 0, y + (f * h) / 3 + 0.85, 0.018, len * 0.63, h / 3 - 2, d);
    }
  } else {
    for (let f = 0; f < 3; f++) {
      const fy = y + (f * h) / 3;
      polygon(o, 'trim', r, fy, cream, false);
      polygon(o, 'trim', r, fy + h / 3, cream);
      for (let i = 0; i < 5; i++) {
        const a = r[i],
          b = r[i + 1],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          q = facing(
            o,
            Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
            (a[0] + b[0]) / 2,
            (a[1] + b[1]) / 2,
          );
        face(q, 'trim', 0, fy, 0, len, h / 3, cream);
        if (i !== 0 && i !== 4) window(q, 0, fy + 0.85, 0.018, len * 0.63, h / 3 - 2, d);
        if (d >= 2) {
          face(q, 'trim', 0, fy + 0.55, 0.03, len, 0.1, pale);
          face(q, 'trim', 0, fy + h / 3 - 0.4, 0.03, len, 0.15, pale);
        }
      }
      if (d >= 2) {
        for (const sx of [-1, 1])
          B(o, 'trim', x + sx * w * 0.32, fy - 0.45, z + 1.15, 0.22, 0.45, 0.7, cream);
      }
      if (f < 2) {
        const rr = r.map((p) => [p[0], p[1] + 0.18]);
        polygon(o, 'roof', rr, fy + h / 3 + 0.1, tile);
      }
    }
  }
  // Three short sloping red faces retain the characteristic oriel eaves at every level.
  if (d)
    for (let f = 1; f <= 3; f++) {
      const yy = y + (f * h) / 3;
      const slope = [
        [x - w / 2 - 0.15, yy, z - 0.1],
        [x + w / 2 + 0.15, yy, z - 0.1],
        [x + w / 2 + 0.3, yy - 0.5, z + 1.6],
        [x - w / 2 - 0.3, yy - 0.5, z + 1.6],
      ].reverse();
      quad(o, 'roof', slope, normalFor(...slope), tile);
    }
  gable(o, x, y + h - 0.15, z + 1.48, w * 0.65, 1.8, d);
}
function hip(o, x0, x1, z0, z1, y, h, d) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  if (z1 < z0) [z0, z1] = [z1, z0];
  const inset = Math.min((x1 - x0) / 2, (z1 - z0) / 2) * 0.7,
    pts = [
      [
        [x0, y, z0],
        [x1, y, z0],
        [x1 - inset, y + h, (z0 + z1) / 2],
        [x0 + inset, y + h, (z0 + z1) / 2],
      ],
      [
        [x1, y, z0],
        [x1, y, z1],
        [x1 - inset, y + h, (z0 + z1) / 2],
      ],
      [
        [x1, y, z1],
        [x0, y, z1],
        [x0 + inset, y + h, (z0 + z1) / 2],
        [x1 - inset, y + h, (z0 + z1) / 2],
      ],
      [
        [x0, y, z1],
        [x0, y, z0],
        [x0 + inset, y + h, (z0 + z1) / 2],
      ],
    ];
  for (const p of pts) {
    p.reverse();
    if (p.length === 4) quad(o, 'roof', p, normalFor(...p), tile);
    else
      o.addTriangle(
        'roof',
        ref,
        p,
        normalFor(...p),
        p.map((v) => [v[0], v[2]]),
        tile,
      );
  }
  if (d >= 2)
    B(
      o,
      'roof',
      (x0 + x1) / 2,
      y + h,
      (z0 + z1) / 2,
      Math.max(0.2, x1 - x0 - 2 * inset),
      0.12,
      0.18,
      tile,
    );
}
function lathe(o, s, x, z, profile, n, col, offset = 0) {
  loft(
    o,
    s,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z], offset)),
    col,
  );
}
function finial(o, x, y, z, h, d) {
  const n = [4, 3, 4, 10][d],
    p =
      d < 2
        ? [
            [y, 0.18],
            [y + h * 0.2, 0.3],
            [y + h * 0.35, 0.12],
            [y + h, 0.025],
          ]
        : [
            [y, 0.2],
            [y + h * 0.1, 0.34],
            [y + h * 0.2, 0.17],
            [y + h * 0.4, 0.12],
            [y + h * 0.5, 0.25],
            [y + h * 0.6, 0.1],
            [y + h * 0.72, 0.16],
            [y + h, 0.025],
          ];
  lathe(o, 'metal', x, z, p, n, gold);
}
function onion(o, x, z, y, r, h, d) {
  const n = [6, 6, 12, 32][d],
    count = [3, 3, 5, 14][d],
    p = Array.from({ length: count + 1 }, (_, i) => {
      const t = i / count;
      return [
        y + h * t,
        Math.max(0.05, r * (0.9 + Math.sin(t * Math.PI) * 0.15) * Math.cos((t * Math.PI) / 2)),
      ];
    });
  lathe(o, 'dome', x, z, p, n, red);
  if (d >= 2)
    for (let i = 1; i < count; i += 2)
      loft(
        o,
        'dome',
        [
          radialRing(p[i][0] - 0.035, p[i][1] + 0.05, p[i][1] + 0.05, n, [x, z]),
          radialRing(p[i][0] + 0.035, p[i][1] + 0.05, p[i][1] + 0.05, n, [x, z]),
        ],
        red,
        { cap: false },
      );
}
function roundTower(o, x, z, d) {
  const n = [6, 8, 8, 32][d],
    radius = 3.7;
  lathe(
    o,
    'stone',
    x,
    z,
    [
      [-0.65, radius],
      [42, radius],
    ],
    n,
    stone,
    Math.PI / n,
  );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [42, radius],
      [42.35, radius + 0.4],
    ],
    n,
    cream,
  );
  if (d)
    for (const [y, h] of d === 1
      ? [
          [0.4, 5],
          [7, 4.3],
          [20.3, 4.1],
          [33, 6],
        ]
      : [
          [0.4, 5],
          [7, 4.3],
          [14.3, 4.1],
          [20.3, 4.1],
          [26.3, 4.1],
          [33, 6],
        ])
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          rr = radius * Math.cos(Math.PI / n) + 0.025,
          q = facing(o, Math.PI / 2 - a, x + Math.cos(a) * rr, z + Math.sin(a) * rr);
        window(q, 0, y, 0.01, y < 1 ? 2.3 : 1.1, h, d, { round: y === 33 || y < 1 });
        if (d >= 2) {
          for (const sx of [-1, 1]) face(q, 'trim', sx * 0.9, y - 0.2, 0.02, 0.1, h + 0.4, cream);
        }
      }
  if (d)
    for (const y of [13.1, 31.3]) {
      lathe(
        o,
        'trim',
        x,
        z,
        [
          [y - 0.25, radius],
          [y, radius + 1.05],
          [y + 0.25, radius + 1.05],
        ],
        n,
        cream,
      );
      if (d >= 2) {
        const posts = d === 3 ? 24 : 8;
        for (let i = 0; i < posts; i++) {
          const a = (i * Math.PI * 2) / posts;
          const q = facing(
            o,
            Math.PI / 2 - a,
            x + (radius + 0.85) * Math.cos(a),
            z + (radius + 0.85) * Math.sin(a),
          );
          if (d === 2) face(q, 'trim', 0, y + 0.25, 0, 0.12, 1, cream);
          else B(q, 'trim', 0, y + 0.25, 0, 0.12, 1, 0.12, cream);
        }
        lathe(
          o,
          'trim',
          x,
          z,
          [
            [y + 1.2, radius + 1.0],
            [y + 1.3, radius + 1.0],
          ],
          n,
          cream,
        );
      }
    }
  onion(o, x, z, 42.35, 4.2, 6.8, d);
  finial(o, x, 49.15, z, 3.2, d);
}
function centralDome(o, x, z, d) {
  const n = [8, 12, 32, 64][d],
    r = 9.3;
  lathe(
    o,
    'stone',
    x,
    z,
    [
      [39.5, r],
      [51.7, r],
    ],
    8,
    stone,
    Math.PI / 8,
  );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [51.7, r],
      [52.25, r + 0.5],
    ],
    8,
    cream,
    Math.PI / 8,
  );
  if (d)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = facing(
          o,
          Math.PI / 2 - a,
          x + Math.cos(a) * (r * Math.cos(Math.PI / 8) + 0.03),
          z + Math.sin(a) * (r * Math.cos(Math.PI / 8) + 0.03),
        );
      for (const xx of [-1.25, 1.25]) window(q, xx, 42, 0.02, 1.7, 6.5, d, { round: true });
      for (const yy of [40.1, 44, 48.7, 50.6]) face(q, 'trim', 0, yy, 0.035, 7, 0.12, cream);
    }
  const count = [4, 7, 12, 24][d],
    profile = Array.from({ length: count + 1 }, (_, i) => {
      const t = (i / count) * Math.acos(1.45 / 9.8);
      return [52.25 + 12.2 * Math.sin(t), 9.8 * Math.cos(t)];
    });
  lathe(o, 'dome', x, z, profile, n, red);
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      for (let j = 0; j < profile.length - 1; j++) {
        const p = profile[j],
          q = profile[j + 1],
          r0 = p[1] + 0.09,
          r1 = q[1] + 0.09,
          aa = a - 0.014,
          bb = a + 0.014,
          pts = [
            [x + r0 * Math.cos(aa), p[0], z + r0 * Math.sin(aa)],
            [x + r0 * Math.cos(bb), p[0], z + r0 * Math.sin(bb)],
            [x + r1 * Math.cos(bb), q[0], z + r1 * Math.sin(bb)],
            [x + r1 * Math.cos(aa), q[0], z + r1 * Math.sin(aa)],
          ];
        pts.reverse();
        quad(o, 'dome', pts, normalFor(...pts), rgb('794737'));
      }
    }
  const ly = 64.32,
    posts = d === 0 ? 4 : 8;
  lathe(
    o,
    'dome',
    x,
    z,
    [
      [64.2, 1.6],
      [ly, 1.65],
    ],
    n,
    red,
  );
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts;
    const q = facing(o, Math.PI / 2 - a, x + Math.cos(a) * 1.3, z + Math.sin(a) * 1.3);
    if (d === 0) face(q, 'trim', 0, ly, 0, 0.19, 4.2, cream);
    else B(q, 'trim', 0, ly, 0, 0.21, 4.2, 0.21, cream);
  }
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [68.5, 1.65],
      [68.8, 1.9],
    ],
    Math.min(16, n),
    cream,
  );
  onion(o, x, z, 68.8, 1.7, 2.4, d);
  finial(o, x, 71.2, z, 1.952, d);
  if (d)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const xx = x + sx * 6.6,
          zz = z + sz * 6.6;
        lathe(
          o,
          'trim',
          xx,
          zz,
          [
            [42.4, 1.25],
            [52.3, 1.25],
          ],
          d === 1 ? 4 : 8,
          cream,
        );
        if (d >= 2)
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2,
              q = facing(o, Math.PI / 2 - a, xx + 1.26 * Math.cos(a), zz + 1.26 * Math.sin(a));
            window(q, 0, 44, 0.01, 0.75, 6.7, d, { round: true });
          }
        onion(o, xx, zz, 52.3, 1.6, 3, d);
        finial(o, xx, 55.3, zz, 1.3, d);
      }
}
function facade(o, len, d, { front = false, courtyard = false } = {}) {
  if (!front) face(o, 'stone', 0, -0.65, 0, len, 40.15, stone);
  else {
    face(o, 'stone', 0, 6.4, 0, len, 33.1, stone);
    face(o, 'stone', 0, -0.65, 0, len, 0.8, stone);
    if (!d) face(o, 'stone', 0, -0.65, 0, len, 7.05, stone);
  }
  if (front) {
    const cell = len / 19;
    for (let i = 0; i < 19; i++)
      arcade(
        o,
        -len / 2 + (i + 0.5) * cell,
        0.15,
        0,
        cell * 0.8,
        5.3,
        cell,
        6.4,
        2.1,
        d,
        i >= 8 && i <= 10,
      );
  }
  for (const y of d ? [6.4, 12.6, 18.6, 24.6, 30.6, 36.5, 39.3] : [12.6, 36.5])
    face(o, 'trim', 0, y, 0.03, len, d < 2 ? 0.18 : 0.28, cream);
  if (front) {
    for (const sx of [-1, 1])
      for (const x of [14, 19.6, 25.2, 30.8, 36.4, 42]) oriel(o, sx * x, 12.6, 0.04, 3.8, 18, d);
    for (let i = 0; i < 12; i++) {
      const x = (i < 6 ? -1 : 1) * [14, 19.6, 25.2, 30.8, 36.4, 42][i % 6];
      if (d) window(o, x, 31.2, 0.04, 2.0, 4.3, d, { round: true });
    }
    if (d)
      for (let i = 0; i < 19; i++)
        window(o, -len / 2 + ((i + 0.5) * len) / 19, 7, 0.04, (len / 19) * 0.64, 4.5, d, {
          round: true,
        });
    if (d) {
      for (const sx of [-1, 1]) {
        const q = facing(o, 0, sx * 48, 0);
        face(q, 'trim', 0, 12.6, 0.05, 6.2, 23.7, cream);
        for (let f = 0; f < 4; f++) {
          for (const xx of [-1.75, 0, 1.75]) window(q, xx, 13.1 + f * 5.8, 0.08, 1.2, 3.6, d);
          rail(q, 6.1, 13.3 + f * 5.8, 0.13, d);
        }
        gable(q, 0, 36.5, 0.08, 7.1, 3.2, d);
      }
      const q = facing(o, 0, 0, 0.1);
      face(q, 'stone', 0, 6.4, 0, 18, 32.9, stone);
      for (const [x, w, h] of [
        [-6, 5.2, 6.1],
        [0, 7, 9.2],
        [6, 5.2, 6.1],
      ]) {
        const c = curve(x, 30.8, w, h, [1, 1, 3, 6][d]);
        filled(q, 'trim', [[x - w / 2, 30.8], ...c, [x + w / 2, 30.8]], 0.025, cream);
      }
      for (let f = 0; f < 5; f++) {
        for (const xx of [-6, 0, 6]) {
          for (const x of [-1.4, 0, 1.4])
            window(q, xx + x, 7.1 + f * 6, 0.04, 1.0, 4.0, d, { round: f < 3 });
          rail(facing(q, 0, xx, 0), 5.3, 6.8 + f * 6, 0.13, d);
        }
        face(q, 'trim', 0, 12.4 + f * 6, 0.09, 18, 0.2, cream);
      }
      gable(q, 0, 38.3, 0.08, 12, 4.0, d);
    }
  } else if (d) {
    const n = Math.max(2, Math.round(len / (d === 1 ? 12 : 5.4)));
    for (let f = 0; f < 5; f++)
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + ((i + 0.5) * len) / n;
        window(o, x, 1.4 + f * 7, 0.025, Math.min(2.4, (len / n) * 0.6), 4.8, d === 2 ? 1 : d, {
          round: f === 0 || f === 4,
        });
        if (d >= 2 && f < 4) {
          face(o, 'trim', x, 6.5 + f * 7, 0.05, Math.min(3, (len / n) * 0.8), 0.16, cream);
        }
      }
    if (courtyard && d >= 2)
      for (let i = 0; i < n; i += 2)
        oriel(o, -len / 2 + ((i + 0.5) * len) / n, 12.6, 0.04, 3.5, 18, d === 2 ? 1 : d);
  }
  if (d) {
    face(o, 'trim', 0, 36.7, 0.04, len, 2.1, cream);
    const n = Math.max(2, Math.floor(len / (d === 1 ? 6.6 : 3.3)));
    for (let i = 0; i < n; i++)
      window(o, -len / 2 + ((i + 0.5) * len) / n, 37, 0.06, (len / n) * 0.74, 1.25, Math.min(d, 1));
    if (d >= 2) {
      rail(o, len, 35.7, 0.07, d);
      for (let i = 0; i < n; i += 2)
        gable(o, -len / 2 + ((i + 0.5) * len) / n, 39.2, 0.06, 2.8, 2.2, d);
    }
  }
}
export function tajMahalPalaceHotel(out, frame = nativeFrame, d = 3) {
  const r = frame.geometry.outline.slice(0, -1),
    frontZ = r[7][1],
    cx = (r[7][0] + r[8][0]) / 2;
  polygon(out, 'stone', r, -0.65, stone, false);
  // The recessed waterfront arcade has its own continuous stone floor above the foundation.
  // Keep it inside the existing building line; the public road/quay is not part of the hotel.
  quad(
    out,
    'stone',
    [
      [r[8][0], 0.15, frontZ],
      [r[7][0], 0.15, frontZ],
      [r[7][0], 0.15, frontZ - 2.1],
      [r[8][0], 0.15, frontZ - 2.1],
    ],
    [0, 1, 0],
    stone,
  );
  polygon(out, 'roof', r, 39.5, tile);
  for (let i = 0; i < r.length; i++) {
    if (i === 6) continue;
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (i === 5) {
      const end = r[7],
        len = end[1] - a[1],
        q = facing(out, Math.PI / 2, (a[0] + end[0]) / 2, (a[1] + end[1]) / 2);
      facade(q, len, d);
      continue;
    }
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      q = facing(
        out,
        Math.PI + Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
      );
    facade(q, len, d, { front: i === 7, courtyard: [1, 2, 3].includes(i) });
  }
  hip(out, r[8][0], r[7][0], r[2][1], frontZ, 39.5, 3.4, d);
  hip(facing(out, Math.PI / 2), -r[1][1], -r[2][1], r[0][0], r[1][0], 39.5, 3.4, d);
  hip(facing(out, Math.PI / 2), -r[4][1], -r[3][1], r[3][0], r[5][0], 39.5, 3.4, d);
  // Own low courtyard terrace is photo-directed, absent from the coarse native high-roof outline.
  const x0 = r[2][0],
    x1 = r[3][0],
    z0 = r[2][1] - 8.5,
    z1 = r[2][1],
    w = x1 - x0;
  B(out, 'stone', (x0 + x1) / 2, -0.65, (z0 + z1) / 2, w, 14.15, z1 - z0, stone);
  B(out, 'trim', (x0 + x1) / 2, 13.5, (z0 + z1) / 2, w, 0.15, z1 - z0, cream);
  if (d) {
    const q = facing(out, Math.PI, (x0 + x1) / 2, z0);
    for (let i = 0; i < Math.floor(w / 4); i++)
      window(q, -w / 2 + ((i + 0.5) * w) / Math.floor(w / 4), 2, 0.025, 2.3, 8, d, { round: true });
    rail(q, w, 13.65, 0.05, d);
  }
  for (const p of [r[0], r[5], r[7], r[8]]) roundTower(out, p[0], p[1], d);
  centralDome(out, cx, frontZ - 12.9, d);
}
export const tajMahalPalaceHotelSkyline = (o) => tajMahalPalaceHotel(o, nativeFrame, 0);
export const tajMahalPalaceHotelDistrict = (o) => tajMahalPalaceHotel(o, nativeFrame, 1);
export const tajMahalPalaceHotelStreet = (o) => tajMahalPalaceHotel(o, nativeFrame, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.89, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.92, metallic: 0 },
  dome: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.15 },
  glass: { slot: 'window', localRef: ref, roughness: 0.4, metallic: 0.04 },
  metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.6, metallic: 0.4 },
};
export const tajMahalPalaceHotelModel = {
  id: 'taj_mahal_palace_hotel',
  key: 'taj_mahal_palace_hotel',
  recipe: 'structure-taj-mahal-palace-hotel.mjs',
  cell: 'te/te7',
  title: 'Taj Mahal Palace Hotel',
  build: tajMahalPalaceHotel,
  surfaces,
  brief:
    'Historic Palace U around open courtyard: dark basalt and cream trim,continuous stone floor inside19recessed waterfront ground bays with3central entrance doors,12three-level projecting oriel stacks,round corner towers and onion roofs,white roof gables and attic strip,hipped tiled roofs,octagonal main drum and ribbed red dome with open lantern. Low courtyard terrace retained; modern Tower and connector wings,public road/quay,Gateway,harbor,pool/garden/furnishings and interiors excluded.',
  camera: [160, 110, 190],
  lookAt: [0, 29, 0],
  portableGroundY: -0.15,
  quality: 'medium-fi-exterior',
  reviewStatus: 'owner-accepted-medium-fi-preview',
  geographicStatus: 'preview-proposal',
  qaCameras: [
    { name: 'waterfront-whole', position: [3, 30, 165], lookAt: [3, 31, 15] },
    { name: 'waterfront-oriels', position: [-27, 21, 54], lookAt: [-24, 20, 29] },
    { name: 'ground-arcade', position: [-22, 4.5, 46], lookAt: [-22, 4, 28.8] },
    { name: 'arcade-floor', position: [-22, 1.7, 33], lookAt: [-22, 0.15, 27.5] },
    { name: 'north-corner', position: [90, 25, 65], lookAt: [52, 24, 20] },
    { name: 'main-dome-lantern', position: [35, 72, 61], lookAt: [3, 55, 15] },
    { name: 'open-courtyard', position: [3, 48, -70], lookAt: [3, 17, -10] },
    { name: 'courtyard-terrace', position: [-9, 23, -33], lookAt: [3, 12, -4] },
    { name: 'roof-and-excluded-tower', position: [112, 96, -90], lookAt: [10, 30, -1] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-taj-mahal-palace-hotel.mjs',
    level: 'skyline',
    export: 'tajMahalPalaceHotelSkyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'tajMahalPalaceHotelDistrict', errorMeters: 1.6, surfaces },
      street: { export: 'tajMahalPalaceHotelStreet', errorMeters: 0.6, surfaces },
    },
  },
  limitations: [
    'Photographic medium-fi surviving Palace exterior, not a scan or navigable interior. Fine tracery,balustrades,carving,roof junctions and unseen rear details are estimates.',
    'Native parent combines Palace/Tower. Historic5243.7m²U uses retained parent vertices and explicit inferred northern interface;low courtyard terrace and projecting upper bays/turrets are photo-directed extensions. Courtyard remains open; no whole-parent replacement.',
    'Published Tata240ft dome description interpreted as approximate73.152m overall finial envelope. Exact crown/ground datum and floor heights are not surveyed;39.5m main eave and52.25m red-dome base follow photographic massing estimates. Generic20m map height retained as a conflicting tag.',
    'Owner accepted the geographic preview on 2026-10-19 with known coastal/urban host-terrain contact artifacts. Source ground and model geometry are unmodified; activation and completed story coverage use this explicit acceptance.',
    'Modern76mTowerpart,connector wings,neighboring buildings,Gateway of India,pool,garden,furniture,harbor scenery and interiors excluded. Original photo pixels are inspection controls, not redistributed textures; ordinary shared material graphs.',
  ],
};
