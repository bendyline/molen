/** Belém: mapped tower/bastion/court, photo-directed Manueline silhouettes and entrance bridge. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const directory = new URL(
  '../../../content/worldgen/source/places/ey/eyc/belem_tower/',
  import.meta.url,
);
const read = (name) => JSON.parse(fs.readFileSync(new URL(name, directory)));
const frame = read('map-frame.json'),
  ground = read('terrain-grid.json');
const datum = ground.modelDatumElevationMeters,
  ref = 'palette:#ffffff';
const stone = rgb('c9c2ae'),
  pale = rgb('d8d0bb'),
  shadow = rgb('766f60');
const steel = rgb('545853'),
  wood = rgb('968b73');
const tint = (c, t) => c.map((v) => Math.min(1, v * t));
const ring = (r) => r.slice(0, -1).map((p) => p.slice());
const part = (suffix) => frame.geometry.parts.find((p) => p.id.endsWith(`/${suffix}`));
const base = ring(frame.geometry.foundationOutline),
  bastion = ring(part('52776577266815').outline);
const court = ring(part('52776577266815').holes[0]),
  tower = ring(part('35184490579137').outline);
const upper = ring(part('35185759050921').outline);
function tri(o, s, p, c, desired) {
  p = p.map((q) => q.map(Math.fround));
  const ab = p[1].map((v, i) => v - p[0][i]),
    ac = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(
      ab[1] * ac[2] - ab[2] * ac[1],
      ab[2] * ac[0] - ab[0] * ac[2],
      ab[0] * ac[1] - ab[1] * ac[0],
    ) < 1e-8
  )
    return;
  let n = normalFor(...p);
  if (desired && n.reduce((s, v, i) => s + v * desired[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    n = n.map((v) => -v);
  }
  o.addTriangle(
    s,
    ref,
    p,
    n,
    p.map((q) => [q[0] + q[2], q[1]]),
    c,
  );
}
function quad(o, s, p, c, n) {
  tri(o, s, [p[0], p[1], p[2]], c, n);
  tri(o, s, [p[0], p[2], p[3]], c, n);
}
function polygon(o, s, p, c, n = [0, 1, 0], holes = []) {
  const k = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[2]) > 0.7 ? 2 : 0,
    axes = k === 1 ? [0, 2] : k === 2 ? [0, 1] : [2, 1];
  const all = p.concat(...holes),
    offsets = [];
  let off = p.length;
  for (const h of holes) {
    offsets.push(off);
    off += h.length;
  }
  const ids = earcut(
    all.flatMap((q) => axes.map((k) => q[k])),
    offsets,
  );
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      s,
      ids.slice(i, i + 3).map((j) => all[j]),
      c,
      n,
    );
}
const area = (r) =>
  r.reduce((s, p, i) => {
    const q = r[(i + 1) % r.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0);
const outward = (r, i) => {
  const a = r[i],
    b = r[(i + 1) % r.length],
    l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    sign = area(r) > 0 ? 1 : -1;
  return [(sign * (b[1] - a[1])) / l, 0, (sign * (a[0] - b[0])) / l];
};
function cap(o, s, r, y, c, n = [0, 1, 0], holes = []) {
  polygon(
    o,
    s,
    r.map(([x, z]) => [x, y, z]),
    c,
    n,
    holes.map((h) => h.map(([x, z]) => [x, y, z])),
  );
}
function prism(o, s, r, lo, hi, c, holes = []) {
  cap(o, s, r, lo, c, [0, -1, 0], holes);
  cap(o, s, r, hi, c, [0, 1, 0], holes);
  for (const [r0, sign] of [[r, 1], ...holes.map((h) => [h, -1])])
    for (let i = 0; i < r0.length; i++) {
      const a = r0[i],
        b = r0[(i + 1) % r0.length];
      quad(
        o,
        s,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        c,
        outward(r0, i).map((v) => v * sign),
      );
    }
}
function raised(o, offset) {
  const q = (p) => [p[0], p[1] + offset, p[2]];
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), n, u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), n, u, c),
    addConvexPolygon: (s, _r, p, n, _u, c) => polygon(o, s, p.map(q), c, n),
  };
}
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
    addConvexPolygon: (s, _r, p, n, _u, c) => polygon(o, s, p.map(q), c, v(n)),
  };
}
function lathe(o, s, x, z, profile, n, c, flute = 0) {
  const rows = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n,
        rr = r * (1 + flute * Math.cos(i * Math.PI));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      quad(o, s, [rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]], c, [
        Math.cos((2 * Math.PI * (i + 0.5)) / n),
        0,
        Math.sin((2 * Math.PI * (i + 0.5)) / n),
      ]);
    }
  for (const [row, normal] of [
    [rows[0], [0, -1, 0]],
    [rows.at(-1), [0, 1, 0]],
  ])
    polygon(o, s, row, c, normal);
}
function arch(x, y, w, h, n, pointed = false) {
  const r = w / 2,
    spring = y + h - (pointed ? w * 0.66 : r),
    out = [
      [x - r, y],
      [x + r, y],
      [x + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push([
      x + r * Math.cos(Math.PI * t),
      spring + (pointed ? w * 0.66 : r) * Math.sin(Math.PI * t),
    ]);
  }
  return out;
}
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
/** A real masonry aperture with a bounded recessed rear; no dark decal over an uncut facade. */
function wall(o, s, a, b, lo, hi, holes = [], depth = 0.65, color = stone, detail = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    ux = dx / len,
    uz = dz / len;
  const n = [uz, 0, -ux],
    map = (p, deep = 0) => [a[0] + ux * p[0] - n[0] * deep, p[1], a[1] + uz * p[0] - n[2] * deep];
  polygon(
    o,
    s,
    [
      [0, lo],
      [len, lo],
      [len, hi],
      [0, hi],
    ].map((p) => map(p)),
    color,
    n,
    holes.map((h) => h.map((p) => map(p))),
  );
  if (detail > 1) {
    const step = detail === 3 ? 0.54 : 1.2,
      width = detail === 3 ? 1.25 : 2.6,
      bounds = holes.map((h) => [
        Math.min(...h.map((p) => p[0])),
        Math.max(...h.map((p) => p[0])),
        Math.min(...h.map((p) => p[1])),
        Math.max(...h.map((p) => p[1])),
      ]);
    let row = 0;
    for (let y = lo; y < hi - 0.02; y += step, row++)
      for (let x = (-(row % 2) * width) / 2; x < len; x += width) {
        const x0 = Math.max(0.018, x + 0.018),
          x1 = Math.min(len - 0.018, x + width - 0.018),
          y0 = y + 0.012,
          y1 = Math.min(hi - 0.012, y + step - 0.012);
        if (
          x1 <= x0 ||
          y1 <= y0 ||
          bounds.some(
            (b) => x0 < b[1] + 0.05 && x1 > b[0] - 0.05 && y0 < b[3] + 0.05 && y1 > b[2] - 0.05,
          )
        )
          continue;
        const tone = 0.96 + ((row * 7 + Math.floor(x / width) * 3 + 90) % 9) * 0.009;
        quad(
          o,
          s,
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ].map((p) => map(p, -0.008)),
          tint(color, tone),
          n,
        );
      }
  }
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const p = h[i],
        q = h[(i + 1) % h.length];
      quad(o, s, [map(p), map(q), map(q, depth), map(p, depth)], tint(color, 0.86));
    }
    polygon(
      o,
      'recess',
      h.map((p) => map(p, depth)),
      shadow,
      n,
    );
  }
}
function mould(o, a, b, y, w = 0.13, h = 0.13, c = pale) {
  beam(o, 'trim', [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], w, h, c);
}
function edgeMould(o, r, y, w = 0.13, h = 0.13) {
  for (let i = 0; i < r.length; i++) mould(o, r[i], r[(i + 1) % r.length], y, w, h);
}
function archFrame(o, x, y, z, w, h, d, pointed = false) {
  const a = arch(x, y, w, h, d === 3 ? 12 : d === 2 ? 8 : 4, pointed),
    b = arch(x, y - 0.06, w + 0.26, h + 0.2, d === 3 ? 12 : d === 2 ? 8 : 4, pointed);
  for (let i = 0; i < a.length; i++) {
    const k = (i + 1) % a.length;
    quad(
      o,
      'trim',
      [
        [a[i][0], a[i][1], z],
        [a[k][0], a[k][1], z],
        [b[k][0], b[k][1], z],
        [b[i][0], b[i][1], z],
      ],
      pale,
      [0, 0, 1],
    );
  }
}
function shield(o, x, y, z, w, h, d) {
  const p = [
    [-0.5, 1],
    [0.5, 1],
    [0.47, 0.25],
    [0.28, 0.02],
    [0, -0.08],
    [-0.28, 0.02],
    [-0.47, 0.25],
  ].map(([u, v]) => [x + u * w, y + v * h, z]);
  polygon(o, 'trim', p, pale, [0, 0, 1]);
  if (d < 2) return;
  // Raised Order of Christ cross with flared arms and recessed central cross.
  for (const [cx, cy, cw, ch] of [
    [0, 0.52, 0.16, 0.7],
    [0, 0.55, 0.58, 0.15],
    [-0.22, 0.55, 0.16, 0.3],
    [0.22, 0.55, 0.16, 0.3],
    [0, 0.85, 0.32, 0.15],
    [0, 0.23, 0.3, 0.15],
  ]) {
    const xx = x + cx * w,
      yy = y + cy * h - (ch * h) / 2;
    if (d === 3) B(o, 'trim', xx, yy, z + 0.025, cw * w, ch * h, 0.04, tint(stone, 0.78));
    else
      quad(
        o,
        'trim',
        [
          [xx - (cw * w) / 2, yy, z + 0.03],
          [xx + (cw * w) / 2, yy, z + 0.03],
          [xx + (cw * w) / 2, yy + ch * h, z + 0.03],
          [xx - (cw * w) / 2, yy + ch * h, z + 0.03],
        ],
        tint(stone, 0.78),
        [0, 0, 1],
      );
  }
}
function pinnacle(o, x, z, y, h, d) {
  const n = d === 3 ? 8 : 4;
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y, 0.22],
      [y + 0.2, 0.32],
      [y + h * 0.82, 0.055],
      [y + h, 0.095],
    ],
    n,
    pale,
  );
}
function turret(o, x, z, y, scale, d) {
  const n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 16 : 24,
    r = scale;
  const profile =
    d === 0
      ? [
          [y, 0.15 * r],
          [y + 1 * r, 1.02 * r],
          [y + 4 * r, 1.02 * r],
          [y + 5 * r, 0.08 * r],
        ]
      : [
          [y, 0.18 * r],
          [y + 0.4 * r, 0.6 * r],
          [y + 1.2 * r, 1.05 * r],
          [y + 1.45 * r, 1.12 * r],
          [y + 1.65 * r, 1.02 * r],
          [y + 4.1 * r, 1.02 * r],
          [y + 4.25 * r, 1.18 * r],
        ];
  if (d === 1) {
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [y, 0.15 * r],
        [y + 1.45 * r, 1.08 * r],
        [y + 4.2 * r, 1.08 * r],
        [y + 5.45 * r, 0.12 * r],
        [y + 6.15 * r, 0.25 * r],
        [y + 6.72 * r, 0.02 * r],
      ],
      6,
      stone,
    );
    return;
  }
  if (d === 2) {
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [y, 0.16 * r],
        [y + 1.4 * r, 1.12 * r],
        [y + 1.65 * r, 1.02 * r],
      ],
      8,
      stone,
    );
    const nn = 8,
      rr = 1.02 * r,
      body = Array.from({ length: nn }, (_, i) => [
        x + rr * Math.cos((2 * Math.PI * (i - 0.5)) / nn),
        z + rr * Math.sin((2 * Math.PI * (i - 0.5)) / nn),
      ]);
    for (let i = 0; i < nn; i++) {
      const a = body[i],
        b = body[(i + 1) % nn],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      wall(
        o,
        'stone',
        a,
        b,
        y + 1.65 * r,
        y + 4.1 * r,
        i % 2 === 0 ? [rect(len / 2, y + 2.7 * r, 0.42 * r, 0.85 * r)] : [],
        0.22 * r,
      );
    }
    lathe(
      o,
      'trim',
      x,
      z,
      [
        [y + 4.1 * r, 1.18 * r],
        [y + 4.8 * r, 0.95 * r],
        [y + 5.48 * r, 0.15 * r],
      ],
      8,
      pale,
    );
    lathe(
      o,
      'trim',
      x,
      z,
      [
        [y + 5.45 * r, 0.18 * r],
        [y + 5.8 * r, 0.35 * r],
        [y + 6.1 * r, 0.12 * r],
        [y + 6.4 * r, 0.22 * r],
        [y + 6.72 * r, 0.02 * r],
      ],
      4,
      pale,
    );
    return;
  }
  if (d === 0) lathe(o, 'stone', x, z, profile, n, stone);
  else {
    lathe(o, 'stone', x, z, profile.slice(0, 5), n, stone);
    const nn = d === 3 ? 16 : 8,
      rr = 1.02 * r,
      body = Array.from({ length: nn }, (_, i) => [
        x + rr * Math.cos((2 * Math.PI * (i - 0.5)) / nn),
        z + rr * Math.sin((2 * Math.PI * (i - 0.5)) / nn),
      ]);
    for (let i = 0; i < nn; i++) {
      const a = body[i],
        b = body[(i + 1) % nn],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const holes =
        i % (nn / 4) === 0
          ? [rect(len / 2, y + 2.7 * r, Math.min(0.42 * r, len * 0.8), 0.85 * r)]
          : [];
      wall(o, 'stone', a, b, y + 1.65 * r, y + 4.1 * r, holes, 0.22 * r);
    }
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [y + 4.1 * r, 1.02 * r],
        [y + 4.25 * r, 1.18 * r],
      ],
      n,
      stone,
    );
  }
  if (d === 0) return;
  // Fluted Moorish dome and beaded finial are separate from cylindrical bartizan body.
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y + 4.25 * r, 1.18 * r],
      [y + 4.55 * r, 1.06 * r],
      [y + 5.05 * r, 0.84 * r],
      [y + 5.42 * r, 0.42 * r],
      [y + 5.48 * r, 0.15 * r],
    ],
    n,
    pale,
    d > 1 ? 0.065 : 0,
  );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y + 5.45 * r, 0.18 * r],
      [y + 5.65 * r, 0.38 * r],
      [y + 5.82 * r, 0.21 * r],
      [y + 6.03 * r, 0.12 * r],
      [y + 6.18 * r, 0.28 * r],
      [y + 6.36 * r, 0.1 * r],
      [y + 6.57 * r, 0.2 * r],
      [y + 6.72 * r, 0.03 * r],
    ],
    d === 1 ? 4 : 8,
    pale,
  );
  if (d === 3)
    for (const yy of [y + 1.4 * r, y + 4.22 * r])
      for (const phase of [0, Math.PI])
        for (let i = 0; i < 32; i++) {
          const points = [i, i + 1].map((k) => {
            const a = (2 * Math.PI * k) / 32;
            return [
              x + 1.18 * r * Math.cos(a),
              yy + 0.075 * r * Math.sin(a * 8 + phase),
              z + 1.18 * r * Math.sin(a),
            ];
          });
          quad(
            o,
            'trim',
            [
              points[0].map((v, j) => v - (j === 1 ? 0.04 * r : 0)),
              points[1].map((v, j) => v - (j === 1 ? 0.04 * r : 0)),
              points[1].map((v, j) => v + (j === 1 ? 0.04 * r : 0)),
              points[0].map((v, j) => v + (j === 1 ? 0.04 * r : 0)),
            ],
            pale,
            [Math.cos((2 * Math.PI * (i + 0.5)) / 32), 0, Math.sin((2 * Math.PI * (i + 0.5)) / 32)],
          );
        }
  if (d > 1) {
    for (const yy of [y + 1.4 * r, y + 4.22 * r])
      lathe(
        o,
        'trim',
        x,
        z,
        [
          [yy - 0.08 * r, 1.11 * r],
          [yy, 1.17 * r],
          [yy + 0.08 * r, 1.11 * r],
        ],
        n,
        pale,
      );
  }
}
function parapet(o, r, y, d, { small = false } = {}) {
  const step = small ? 1.55 : 1.7;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      angle = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2;
    const n = outward(r, i),
      oo = facing(o, Math.atan2(n[0], n[2]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    wall(o, 'stone', a, b, y, y + 0.65, [], 0.2); // continuous low parapet, discrete shield merlons above.
    if (d === 0) continue;
    const count = Math.max(1, Math.round(len / step));
    for (let j = 0; j < count; j++) {
      const u = ((j + 0.5) / count - 0.5) * len;
      if (small) {
        if (d < 3)
          polygon(
            oo,
            'trim',
            [
              [u - 0.21, y + 0.65, 0],
              [u + 0.21, y + 0.65, 0],
              [u + 0.21, y + 1.3, 0],
              [u, y + 1.58, 0],
              [u - 0.21, y + 1.3, 0],
            ],
            pale,
            [0, 0, 1],
          );
        else {
          B(oo, 'trim', u, y + 0.65, 0, 0.42, 0.65, 0.38, pale);
          const r = [
            [-0.29, -0.25],
            [0.29, -0.25],
            [0.29, 0.25],
            [-0.29, 0.25],
          ];
          for (let k = 0; k < 4; k++) {
            const a = r[k],
              b = r[(k + 1) % 4];
            tri(
              oo,
              'trim',
              [
                [u + a[0], y + 1.3, a[1]],
                [u + b[0], y + 1.3, b[1]],
                [u, y + 1.66, 0],
              ],
              pale,
              [a[0] + b[0], 0.5, a[1] + b[1]],
            );
          }
        }
      } else {
        if (d === 3) B(oo, 'stone', u, y + 0.65, -0.13, 0.7, 0.72, 0.38, stone);
        shield(oo, u, y + 0.53, 0.09, 0.88, 1.2, d);
      }
    }
    if (d > 1)
      for (let t = 0.4; t < len; t += d === 3 ? 0.68 : 1.36) {
        const x = a[0] + ((b[0] - a[0]) * t) / len,
          z = a[1] + ((b[1] - a[1]) * t) / len;
        if (d === 3)
          beam(
            o,
            'trim',
            [x - n[0] * 0.28, y - 0.65, z - n[2] * 0.28],
            [x + n[0] * 0.02, y, z + n[2] * 0.02],
            0.2,
            0.24,
            pale,
          );
        else
          quad(
            o,
            'trim',
            [
              [x - n[0] * 0.28, y - 0.65, z - n[2] * 0.28],
              [x + n[0] * 0.02, y, z + n[2] * 0.02],
              [x + n[0] * 0.02 + 0.16 * n[2], y, z + n[2] * 0.02 - 0.16 * n[0]],
              [x - n[0] * 0.28 + 0.16 * n[2], y - 0.65, z - n[2] * 0.28 - 0.16 * n[0]],
            ],
            pale,
          );
      }
    void angle;
  }
}
function quatrefoilRail(o, a, b, y, d) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    n = [dz / len, 0, -dx / len],
    oo = facing(o, Math.atan2(n[0], n[2]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  const count = Math.max(1, Math.round(len / 1.35)),
    pitch = len / count;
  if (d === 1) {
    for (const yy of [y, y + 1.02])
      quad(
        oo,
        'trim',
        [
          [-len / 2, yy, 0],
          [len / 2, yy, 0],
          [len / 2, yy + 0.15, 0],
          [-len / 2, yy + 0.15, 0],
        ],
        pale,
        [0, 0, 1],
      );
    for (let j = 0; j <= count; j++) {
      const x = -len / 2 + j * pitch;
      quad(
        oo,
        'trim',
        [
          [x - 0.065, y, 0],
          [x + 0.065, y, 0],
          [x + 0.065, y + 1.16, 0],
          [x - 0.065, y + 1.16, 0],
        ],
        pale,
        [0, 0, 1],
      );
    }
    return;
  }
  B(oo, 'trim', 0, y, 0, len, 0.15, 0.26, pale);
  B(oo, 'trim', 0, y + 1.02, 0, len, 0.15, 0.28, pale);
  for (let j = 0; j <= count; j++)
    B(oo, 'trim', -len / 2 + j * pitch, y, 0, 0.13, 1.16, 0.25, pale);
  if (d < 2) {
    for (let j = 0; j < count; j++)
      B(oo, 'trim', -len / 2 + (j + 0.5) * pitch, y + 0.15, 0, 0.12, 0.88, 0.2, pale);
    return;
  }
  for (let j = 0; j < count; j++) {
    const center = -len / 2 + (j + 0.5) * pitch,
      cy = y + 0.58,
      r = 0.31;
    // Four lobes enclose four actual see-through holes around the central cross.
    for (let k = 0; k < 4; k++) {
      const a0 = Math.PI / 4 + (k * Math.PI) / 2,
        points = [];
      for (let q = 0; q <= (d === 3 ? 6 : 4); q++) {
        const a = a0 + (Math.PI * 1.5 * q) / (d === 3 ? 6 : 4);
        points.push([
          center + Math.cos(a0) * 0.18 + Math.cos(a) * r,
          cy + Math.sin(a0) * 0.18 + Math.sin(a) * r,
        ]);
      }
      for (let q = 1; q < points.length; q++) {
        if (d === 3)
          beam(oo, 'trim', [...points[q - 1], 0.03], [...points[q], 0.03], 0.075, 0.075, pale);
        else {
          const a = points[q - 1],
            b = points[q],
            dx = b[0] - a[0],
            dy = b[1] - a[1],
            l = Math.hypot(dx, dy),
            nx = (-dy / l) * 0.04,
            ny = (dx / l) * 0.04;
          quad(
            oo,
            'trim',
            [
              [a[0] + nx, a[1] + ny, 0.03],
              [b[0] + nx, b[1] + ny, 0.03],
              [b[0] - nx, b[1] - ny, 0.03],
              [a[0] - nx, a[1] - ny, 0.03],
            ],
            pale,
            [0, 0, 1],
          );
        }
      }
    }
    B(oo, 'trim', center, y + 0.48, 0, pitch - 0.18, 0.11, 0.2, pale);
    B(oo, 'trim', center, y + 0.15, 0, 0.11, 0.87, 0.2, pale);
  }
}
function diamondRail(o, a, b, y, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = Math.round(len / 0.8);
  mould(o, a, b, y, 0.12, 0.13);
  mould(o, a, b, y + 1, 0.13, 0.14);
  for (let j = 0; j < count; j++) {
    const x = a[0] + ((b[0] - a[0]) * j) / count,
      z = a[1] + ((b[1] - a[1]) * j) / count;
    beam(
      o,
      'trim',
      [x, y + 0.13, z],
      [x + (b[0] - a[0]) / count, y + 0.98, z + (b[1] - a[1]) / count],
      0.065,
      0.065,
      pale,
    );
    if (d > 1)
      beam(
        o,
        'trim',
        [x, y + 0.98, z],
        [x + (b[0] - a[0]) / count, y + 0.13, z + (b[1] - a[1]) / count],
        0.065,
        0.065,
        pale,
      );
  }
}
function courtAndBastion(o, d) {
  // The mapped upper foundation edge is retained; a conservative battered toe flares below it.
  const toe = base.map(([x, z]) => [x * 1.055, 13 + (z - 13) * 1.055]);
  cap(o, 'foundation', toe, -1.05, tint(stone, 0.74), [0, -1, 0]);
  cap(o, 'foundation', base, 1.2, tint(stone, 0.79));
  for (let i = 0; i < base.length; i++) {
    const k = (i + 1) % base.length;
    quad(
      o,
      'foundation',
      [
        [toe[i][0], -1.05, toe[i][1]],
        [toe[k][0], -1.05, toe[k][1]],
        [base[k][0], 1.2, base[k][1]],
        [base[i][0], 1.2, base[i][1]],
      ],
      tint(stone, 0.79),
      outward(base, i),
    );
  }
  // Map outline/hole are retained verbatim. Full bottom support, then open-sky lower courtyard.
  prism(o, 'stone', bastion, 1.2, 3.24, stone);
  cap(o, 'stone', court, 3.24, tint(stone, 0.96));
  cap(o, 'stone', bastion, 7.95, stone, [0, 1, 0], [court]);
  const portCounts = { 4: 5, 5: 2, 6: 2, 7: 2, 8: 5 };
  for (let i = 0; i < bastion.length; i++) {
    const a = bastion[i],
      b = bastion[(i + 1) % bastion.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes = [];
    if (d > 0)
      for (let j = 0; j < (portCounts[i] ?? 0); j++)
        holes.push(rect((len * (j + 0.5)) / portCounts[i], 3.42, 1.02, 1.12));
    wall(o, 'stone', a, b, 3.24, 7.95, holes, 1.05);
  }
  const courtRing = area(court) < 0 ? court : [...court].reverse();
  for (let i = 0; i < courtRing.length; i++) {
    const a = courtRing[i],
      b = courtRing[(i + 1) % courtRing.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(courtRing, i),
      holes = [];
    if (d > 0) {
      const count = len > 9 ? 3 : 1;
      for (let j = 0; j < count; j++)
        holes.push(arch((len * (j + 0.5)) / count, 3.24, 1.25, 2.9, d > 1 ? 8 : 4, true));
    }
    wall(o, 'stone', a, b, 3.24, 7.95, holes, 0.65, tint(stone, 0.94));
    if (d > 1)
      for (const h of holes) {
        const mid = (h[0][0] + h[1][0]) / 2;
        const oo = facing(
          o,
          Math.atan2(n[0], n[2]),
          a[0] + ((b[0] - a[0]) * mid) / len,
          a[1] + ((b[1] - a[1]) * mid) / len,
        );
        archFrame(oo, 0, 3.24, 0.04, 1.25, 2.9, d, true);
      }
    if (d > 0) quatrefoilRail(o, a, b, 7.95, d);
    else wall(o, 'trim', a, b, 7.95, 8.95, [], 0.2, pale);
  }
  for (const p of court) pinnacle(o, p[0], p[1], 8.95, 2.2, d);
  parapet(o, bastion, 7.95, d);
  for (const i of [4, 5, 6, 7, 8, 9]) turret(o, ...[bastion[i][0], bastion[i][1], 5.45, 0.86, d]);
  if (d > 0) {
    edgeMould(o, bastion, 7.78, 0.26, 0.2);
    edgeMould(o, base, 1.13, 0.24, 0.12);
  }
}
function facadeWindows(o, r, lo, hi, d, upperStory = false) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = outward(r, i),
      oo = facing(o, Math.atan2(n[0], n[2]), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
      holes = [];
    // Native tower ring starts at SW: side0 west,1 north,2 east,3 south.
    const south = i === 3;
    if (d > 0) {
      if (upperStory && !south) holes.push(arch(len / 2, 25.05, 1.7, 2.65, d > 1 ? 10 : 5));
      else if (!upperStory) {
        if (south) holes.push(rect(len / 2, 8, 1, 1.8));
        else holes.push(arch(len / 2, 7.05, 1.85, 2.95, d > 1 ? 10 : 5));
        if (south) {
          for (let j = 0; j < 7; j++)
            holes.push(arch((len * (j + 0.5)) / 7, 12.92, len / 7 - 0.22, 2.96, d > 1 ? 10 : 5));
          for (const x of [-2.95, 2.95])
            holes.push(arch(len / 2 + x, 19, 1.7, 2.75, d > 1 ? 10 : 5));
        } else {
          for (const y of d === 1 ? [13.45] : [13.45, 19.1])
            for (const x of [-0.55, 0.55])
              holes.push(arch(len / 2 + x, y, 1, 1.95, d > 1 ? 10 : 5));
        }
      }
    }
    wall(o, 'stone', a, b, lo, hi, holes, south && !upperStory ? 1.25 : 0.85, stone, d);
    if (d === 0) continue;
    if (d === 1) continue;
    if (upperStory && !south) {
      archFrame(oo, 0, 25.05, 0.045, 1.7, 2.65, d);
      B(oo, 'trim', 0, 24.85, 0.13, 2.15, 0.24, 0.38, pale);
    } else if (south && !upperStory) {
      B(oo, 'trim', 0, 12.73, 0.4, len + 0.3, 0.24, 1, pale);
      B(oo, 'trim', 0, 16.13, 0.4, len + 0.35, 0.27, 1, pale);
      for (let j = 0; j <= 7; j++) {
        const x = -len / 2 + (len * j) / 7;
        lathe(
          oo,
          'trim',
          x,
          0.35,
          [
            [12.94, 0.18],
            [13.1, 0.25],
            [13.3, 0.13],
            [15.13, 0.13],
            [15.3, 0.24],
            [15.55, 0.24],
          ],
          d > 1 ? 8 : 4,
          pale,
        );
      }
      diamondRail(oo, [-len / 2, 0.68], [len / 2, 0.68], 12.9, d);
      for (const x of [-2.95, 2.95]) {
        archFrame(oo, x, 19, 0.05, 1.7, 2.75, d);
        B(oo, 'trim', x, 18.8, 0.3, 2.2, 0.25, 0.7, pale);
        quatrefoilRail(oo, [x - 1.05, 0.55], [x + 1.05, 0.55], 19, d);
      }
      shield(oo, 0, 19.5, 0.08, 2, 2.4, 1);
      if (d > 1) {
        for (const [xx, yy] of [
          [0, 20.2],
          [-0.36, 20.6],
          [0.36, 20.6],
          [0, 20.95],
          [0, 21.45],
        ])
          B(oo, 'trim', xx, yy, 0.115, 0.2, 0.28, 0.04, tint(stone, 0.72));
      }
    } else if (!upperStory) {
      archFrame(oo, 0, 7.05, 0.045, 1.85, 2.95, d);
      for (const y of [13.45, 19.1]) {
        for (const x of [-0.55, 0.55]) archFrame(oo, x, y, 0.055, 1, 1.95, d);
        lathe(
          oo,
          'trim',
          0,
          0.12,
          [
            [y, 0.12],
            [y + 0.15, 0.17],
            [y + 1.7, 0.1],
            [y + 1.95, 0.2],
          ],
          d > 1 ? 8 : 4,
          pale,
        );
        B(oo, 'trim', 0, y - 0.15, 0.2, 2.6, 0.19, 0.5, pale);
      }
      B(oo, 'trim', 0, 12.65, 0.55, 2.95, 0.25, 1.1, pale);
      quatrefoilRail(oo, [-1.4, 0.94], [1.4, 0.94], 12.9, d);
      for (const x of [-1, 0, 1])
        beam(oo, 'trim', [x, 11.9, 0.04], [x, 12.65, 0.8], 0.26, 0.3, pale);
      if (d > 1) {
        pinnacle(oo, 0, 0.12, 15.7, 1.1, d);
        for (const x of [-1.65, 1.65]) B(oo, 'trim', x, 12.8, 0.1, 0.18, 3, 0.26, pale);
      }
    }
  }
}
function towerAndOrnament(o, d) {
  const northPodium = base.slice(2, 8);
  prism(o, 'stone', northPodium, 1.2, 6.25, stone);
  if (d > 1) edgeMould(o, northPodium, 6.2, 0.24, 0.18);
  facadeWindows(o, tower, 1.2, 23.5, d);
  cap(o, 'stone', tower, 23.5, stone);
  // The roofwalk projects outside the main body; upper terrace/parapet retain actual native rings.
  const walk = part('52776578212031');
  prism(o, 'trim', ring(walk.outline), 23.5, 24.05, pale);
  parapet(o, ring(walk.outline), 24.05, d);
  facadeWindows(o, upper, 24.05, 29, d, true);
  cap(o, 'stone', upper, 29, stone);
  const roof = part('52776578212030');
  prism(o, 'stone', ring(roof.outline), 29, 29.55, stone, [ring(roof.holes[0])]);
  parapet(o, upper, 29.25, d, { small: true });
  for (const p of upper) turret(o, p[0], p[1], 26.5, 0.92, d);
  for (const i of [1, 2]) turret(o, tower[i][0], tower[i][1], 5.9, 1.07, d);
  if (d > 0) {
    edgeMould(o, tower, 6.25, 0.22, 0.18);
    edgeMould(o, tower, 23.2, 0.26, 0.2);
    edgeMould(o, upper, 28.85, 0.2, 0.14);
  }
  // Madonna and Child under the canopy, immediately south of the open court.
  const x = 0.3,
    z = 22.8;
  B(o, 'trim', x, 8.8, z, 1.9, 0.28, 1.25, pale);
  for (const xx of [x - 0.72, x + 0.72])
    lathe(
      o,
      'trim',
      xx,
      z,
      [
        [9.08, 0.14],
        [9.3, 0.2],
        [11.3, 0.12],
        [11.5, 0.24],
      ],
      d > 1 ? 8 : 4,
      pale,
    );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [11.5, 1.12],
      [11.73, 0.94],
      [12.1, 0.74],
      [12.9, 0.02],
    ],
    d > 1 ? 8 : 4,
    pale,
  );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [9.08, 0.32],
      [9.45, 0.3],
      [10.25, 0.19],
      [10.5, 0.27],
      [10.73, 0.14],
    ],
    d > 1 ? 8 : 4,
    pale,
  );
  if (d > 1) {
    beam(o, 'trim', [x - 0.2, 10.2, z], [x - 0.37, 9.83, z + 0.22], 0.17, 0.16, pale);
    beam(o, 'trim', [x - 0.37, 9.83, z + 0.22], [x + 0.28, 10, z + 0.19], 0.15, 0.15, pale);
    beam(o, 'trim', [x + 0.18, 10.2, z], [x + 0.43, 10.05, z + 0.15], 0.16, 0.16, pale);
    lathe(
      o,
      'trim',
      x + 0.29,
      z + 0.03,
      [
        [9.95, 0.11],
        [10.3, 0.14],
        [10.5, 0.08],
      ],
      8,
      pale,
    );
    for (const xx of [x - 1.05, x + 1.05]) pinnacle(o, xx, z, 9.05, 3, d);
  }
}
const groundAt = (x, z) => {
  const a = (x - ground.origin[0]) / ground.stepMeters,
    b = (z - ground.origin[1]) / ground.stepMeters,
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j,
    h = ground.heightsMeters;
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v
  );
};
function bridge(o, d) {
  // Native east entrance + official aerial L-plan. End meets the unchanged source shore field.
  const points = [
      [12.6, 3.24, -2.94],
      [27, 3.24, -2.94],
      [27, groundAt(27, -42) + 0.08, -42],
    ],
    width = 2.35;
  for (let i = 0; i < 2; i++) {
    const a = points[i],
      b = points[i + 1],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      len = Math.hypot(dx, dz),
      nx = dz / len,
      nz = -dx / len;
    const corners = [
      [-1, 0],
      [1, 0],
      [1, 1],
      [-1, 1],
    ].map(([s, t]) => [
      a[0] + dx * t + (nx * s * width) / 2,
      a[1] + (b[1] - a[1]) * t,
      a[2] + dz * t + (nz * s * width) / 2,
    ]);
    quad(o, 'wood', corners, wood, [0, 1, 0]);
    quad(
      o,
      'wood',
      corners.map((p) => [p[0], p[1] - 0.2, p[2]]),
      wood,
      [0, -1, 0],
    );
    for (let k = 0; k < 4; k++) {
      const q = (k + 1) % 4;
      quad(
        o,
        'wood',
        [
          corners[k],
          corners[q],
          corners[q].map((v, j) => v - (j === 1 ? 0.2 : 0)),
          corners[k].map((v, j) => v - (j === 1 ? 0.2 : 0)),
        ],
        wood,
      );
    }
    if (d === 0) continue;
    const count = Math.ceil(len / (d === 1 ? 8 : d === 2 ? 4 : 3));
    for (const s of [-1, 1]) {
      for (let j = 0; j <= count; j++) {
        const t = j / count,
          x = a[0] + dx * t + (nx * s * width) / 2,
          z = a[2] + dz * t + (nz * s * width) / 2,
          y = a[1] + (b[1] - a[1]) * t;
        B(o, 'metal', x, y, z, 0.065, 1.05, 0.065, steel);
      }
      for (const h of d === 1 ? [1.05] : [0.34, 0.7, 1.05])
        beam(
          o,
          'metal',
          [a[0] + (nx * s * width) / 2, a[1] + h, a[2] + (nz * s * width) / 2],
          [b[0] + (nx * s * width) / 2, b[1] + h, b[2] + (nz * s * width) / 2],
          0.045,
          0.045,
          steel,
        );
    }
    for (let j = 1; j < count; j += 2) {
      const t = j / count,
        x = a[0] + dx * t,
        z = a[2] + dz * t,
        y = a[1] + (b[1] - a[1]) * t,
        lo = Math.min(y - 0.4, groundAt(x, z) - 0.15);
      B(o, 'metal', x, lo, z, 0.16, y - lo - 0.2, 0.16, steel);
      if (d > 1)
        for (const s of [-1, 1])
          beam(
            o,
            'metal',
            [x, lo + 0.3, z],
            [x + nx * s * 1.05, y - 0.22, z + nz * s * 1.05],
            0.09,
            0.09,
            steel,
          );
    }
    if (d === 3)
      for (let u = 0.2; u < len; u += 0.33) {
        const t = u / len,
          y = a[1] + (b[1] - a[1]) * t;
        beam(
          o,
          'wood',
          [a[0] + dx * t - nx * 1.12, y + 0.006, a[2] + dz * t - nz * 1.12],
          [a[0] + dx * t + nx * 1.12, y + 0.006, a[2] + dz * t + nz * 1.12],
          0.012,
          0.012,
          tint(wood, 0.83),
        );
      }
  }
  const entry = part('35185759057840');
  prism(o, 'stone', ring(entry.outline), 1.2, 3.24, stone);
  const annex = ring(part('35185759057839').outline);
  cap(o, 'stone', annex, 7.95, stone);
  cap(o, 'stone', annex, 1.2, stone, [0, -1, 0]);
  for (let i = 0; i < annex.length; i++) {
    const a = annex[i],
      b = annex[(i + 1) % annex.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const holes = d > 0 && i === 4 ? [arch(len * 0.38, 3.24, 1.45, 2.8, d > 1 ? 10 : 5, true)] : [];
    wall(o, 'stone', a, b, 1.2, 7.95, holes, 0.7);
    if (d > 1 && i === 4) {
      const n = outward(annex, i),
        oo = facing(
          o,
          Math.atan2(n[0], n[2]),
          a[0] + (b[0] - a[0]) * 0.38,
          a[1] + (b[1] - a[1]) * 0.38,
        );
      archFrame(oo, 0, 3.24, 0.04, 1.45, 2.8, d, true);
    }
  }
  for (let j = 0; j < 7; j++)
    B(o, 'stone', 11.6, 1.2 + j * 0.29, -0.7 + j * 0.35, 1.8, 0.29, (7 - j) * 0.35, stone);
}
export function belemTower(o, _frame = frame, d = 3) {
  const elevated = raised(o, -datum);
  courtAndBastion(elevated, d);
  towerAndOrnament(elevated, d);
  bridge(elevated, d);
}
export const belemTowerSkyline = (o) => belemTower(o, frame, 0);
export const belemTowerDistrict = (o) => belemTower(o, frame, 1);
export const belemTowerStreet = (o) => belemTower(o, frame, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.92, metallic: 0 },
  recess: { slot: 'window', localRef: ref, roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  metal: { slot: 'trim', localRef: 'palette:#fffefd', roughness: 0.7, metallic: 0.2 },
};
export const belemTowerModel = {
  id: 'belem_tower',
  key: 'belem_tower',
  recipe: 'structure-belem-tower.mjs',
  cell: 'ey/eyc',
  title: 'Belém Tower',
  brief:
    'Pale Manueline square tower with recessed upper chapel, projecting machicolated roofwalk and Christ-cross shield merlons; fluted domed bartizans and beaded finials. Distinct north paired balconies and seven-arch south river loggia, royal shield and Madonna canopy. Native polygonal river bastion with16 recessed gunports, actual lower open court, pierced quatrefoil rails/pinnacles, tidal foundation and narrow L-shaped elevated steel/wood entrance bridge.',
  camera: [59, 35, 68],
  lookAt: [2, 10, 1],
  portableGroundY: -6.33,
  qaCameras: [
    { name: 'north-facade', position: [0, 13, -58], lookAt: [0, 11, 0] },
    { name: 'south-loggia', position: [0, 17, 58], lookAt: [0, 12, 6] },
    { name: 'west-bastion', position: [-48, 8, 17], lookAt: [0, 1, 14] },
    { name: 'open-court', position: [-3, 22, 32], lookAt: [0, 1.3, 16] },
    { name: 'bartizan', position: [-14, 12, -17], lookAt: [-7, 6, -7] },
    { name: 'roof-and-shields', position: [-17, 31, -17], lookAt: [0, 22, 0] },
    { name: 'bridge-entry', position: [37, 8, -22], lookAt: [13, -0.5, -3] },
    { name: 'overhead', position: [2, 78, 5], lookAt: [2, 0, 4] },
  ],
  mediumFiContext: {
    scale: 1.05,
    groundY: -6.14,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: base,
    basis:
      'Exact mapped foundation outline only; continuous physical foundation supports all covered samples. Bridge remains open below the deck. Original shore/river terrain values retained and restored on model hide.',
  },
  build: belemTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original frozen Terrarium field,2original raster tiles/66049samples. Provider-relative5.1389m dry north promenade contact controls Y=0; mapped building part heights referred to offshore provider0m sample. No source flattening or tidal/bathymetric/survey claim.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-belem-tower.mjs',
    level: 'skyline',
    export: 'belemTowerSkyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'belemTowerDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'belemTowerStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Foundation toe flares5.5percent below the native upper foundation edge; north podium and masonry courses follow photographic interpretation. Mapped29m body/30m parapet exclude interpreted bartizan domes/finials, extending to32.7m above provider-water control. Aperture heights, sculpture and ornament are conservative photographic interpretations, not measured drawings.',
    'The bridge L-plan is constrained by the official aerial/entrance photos and mapped east landing; route, structural spans and widths are approximate. Endpoint meets unchanged source shore field. No engineered bridge, interiors, navigable collision or operating tide/water simulation.',
    'Original Terrarium pixels may oversample coarser composite DEM;1m sampling is not survey resolution. Default coarse world terrain is not certified.',
  ],
};
