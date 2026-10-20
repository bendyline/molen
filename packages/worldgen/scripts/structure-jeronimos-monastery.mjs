/** Jerónimos: native connected ensemble, two open courts and photograph-directed Manueline exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, cleanRing, rgb } from './landmark-model-helpers.mjs';

const directory = new URL(
  '../../../content/worldgen/source/places/ey/eyc/jeronimos_monastery/',
  import.meta.url,
);
const frame = JSON.parse(fs.readFileSync(new URL('map-frame.json', directory)));
const ref = 'palette:#ffffff';
const stone = rgb('cfc8b8'),
  pale = rgb('ddd5c2'),
  shadow = rgb('50514c');
const tile = rgb('a85f43'),
  grass = rgb('7c915f'),
  paving = rgb('c4bba5');
const tint = (c, t) => c.map((v) => Math.min(1, v * t));
const ring = (r) => r.slice(0, -1).map((p) => p.slice());
const part = (suffix) => frame.geometry.parts.find((p) => p.id.endsWith(`/${suffix}`));
// Four distinct native end turrets: front/rear pairs at both dormitory ends.
const dormitoryTurrets = [
  [-228.15, -10.65],
  [-228.15, -21.3],
  [-42.65, -7.9],
  [-42.65, -18.55],
];
const main = part('52776569451649'),
  church = part('52776569451650');
const base = ring(frame.geometry.outline),
  court = ring(main.holes[0]);
const native = (p) => [p.outline, ...p.holes];
// Half-plane clipping is local and only used for the connected, inspected plan slices below.
function clipRing(r, axis, limit, above) {
  let out = [];
  r = ring(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      ia = above ? a[axis] >= limit : a[axis] <= limit,
      ib = above ? b[axis] >= limit : b[axis] <= limit;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  if (out.length < 3) return [];
  out = cleanRing(out);
  return out.length >= 3 ? [...out, out[0]] : [];
}
function cropped(p, x0, z0, x1, z1) {
  let r = p.map((v) => v.map((q) => q.slice()));
  for (const [axis, limit, above] of [
    [0, x0, true],
    [0, x1, false],
    [1, z0, true],
    [1, z1, false],
  ])
    r = r.map((v) => clipRing(v, axis, limit, above));
  if (!r[0]?.length) return [];
  return [r.filter((v) => v.length >= 4)];
}
const shape = (p) => ({ outline: ring(p[0]), holes: p.slice(1).map(ring) });
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
/** Cut wall faces and reveals. Open galleries have no backing plane. */
function wall(o, s, a, b, lo, hi, holes = [], depth = 0.8, color = stone, back = true) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    u = [dx / len, dz / len],
    n = [u[1], 0, -u[0]];
  const map = ([x, y], d = 0) => [a[0] + u[0] * x - n[0] * d, y, a[1] + u[1] * x - n[2] * d];
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
  if (!back)
    polygon(
      o,
      s,
      [
        [0, lo],
        [len, lo],
        [len, hi],
        [0, hi],
      ].map((p) => map(p, depth)),
      tint(color, 0.94),
      n.map((v) => -v),
      holes.map((h) => h.map((p) => map(p, depth))),
    );
  for (const h of holes) {
    for (let i = 0; i < h.length; i++) {
      const k = (i + 1) % h.length;
      quad(o, s, [map(h[i]), map(h[k]), map(h[k], depth), map(h[i], depth)], tint(color, 0.87));
    }
    if (back)
      polygon(
        o,
        'recess',
        h.map((p) => map(p, depth)),
        shadow,
        n,
      );
  }
}
function edge(o, r, y, w = 0.16, h = 0.18, color = pale) {
  for (let i = 0; i < r.length; i++)
    beam(
      o,
      'trim',
      [r[i][0], y + h / 2, r[i][1]],
      [r[(i + 1) % r.length][0], y + h / 2, r[(i + 1) % r.length][1]],
      w,
      h,
      color,
    );
}
function curve(o, pts, w = 0.12, color = pale, slot = 'trim') {
  // Continuous triangular stone rods avoid hidden end caps at every joined detail segment.
  const rows = pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)],
      v = b.map((x, k) => x - a[k]),
      len = Math.hypot(...v);
    if (len < 1e-6) throw Error('Repeated curve point');
    const u = v.map((x) => x / len),
      temp = Math.abs(u[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0],
      cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ],
      f = cross(u, temp),
      fl = Math.hypot(...f),
      n = f.map((x) => x / fl),
      v0 = cross(u, n);
    return Array.from({ length: 3 }, (_, j) =>
      p.map(
        (x, k) =>
          x +
          w *
            0.65 *
            (n[k] * Math.cos((j * 2 * Math.PI) / 3) + v0[k] * Math.sin((j * 2 * Math.PI) / 3)),
      ),
    );
  });
  for (let i = 1; i < rows.length; i++)
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3;
      quad(o, slot, [rows[i - 1][j], rows[i - 1][k], rows[i][k], rows[i][j]], color);
    }
  tri(o, slot, rows[0], color);
  tri(o, slot, [...rows.at(-1)].reverse(), color);
}
function archTrim(o, x, y, z, w, h, d, pointed = false, th = 0.16) {
  const a = arch(x, y, w, h, d === 3 ? 8 : d === 2 ? 5 : 3, pointed);
  curve(
    o,
    a.slice(1).map(([x, y]) => [x, y, z]),
    th,
  );
  B(o, 'trim', x, y - 0.12, z, w + 0.5, 0.18, 0.4, pale);
}
function circle(o, x, y, z, r, d, w = 0.13) {
  const n = d === 3 ? 8 : 6;
  curve(
    o,
    Array.from({ length: n + 1 }, (_, i) => [
      x + r * Math.cos((i * 2 * Math.PI) / n),
      y + r * Math.sin((i * 2 * Math.PI) / n),
      z,
    ]),
    w,
  );
}
function column(o, x, y, z, h, r, d, fluted = false) {
  if (d === 1) {
    lathe(
      o,
      'trim',
      x,
      z,
      [
        [y, r],
        [y + h, r],
      ],
      4,
      pale,
    );
    return;
  }
  const n = d === 3 ? 6 : 4;
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y, r * 1.6],
      [y + 0.2, r * 1.6],
      [y + 0.3, r],
      [y + h - 0.3, r * 0.85],
      [y + h - 0.2, r * 1.5],
      [y + h, r * 1.5],
    ],
    n,
    pale,
  );
  if (fluted && d === 3)
    for (const t of [0.5])
      lathe(
        o,
        'trim',
        x,
        z,
        [
          [y + h * t, r * 1.06],
          [y + h * t + 0.08, r * 1.12],
        ],
        6,
        pale,
      );
}
function cone(o, x, y, z, r, h, d) {
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y, r],
      [y + h * 0.08, r * 1.15],
      [y + h, r * 0.02],
    ],
    d === 3 ? 6 : d === 2 ? 6 : 4,
    pale,
  );
}
function pin(o, x, y, z, h, d) {
  if (d === 2) {
    lathe(
      o,
      'trim',
      x,
      z,
      [
        [y, h * 0.13],
        [y + h * 0.1, h * 0.15],
        [y + h, 0.025],
      ],
      4,
      pale,
    );
    return;
  }
  cone(o, x, y, z, h * 0.13, h * 0.8, d);
  if (d >= 2) {
    lathe(
      o,
      'trim',
      x,
      z,
      [
        [y + h * 0.76, 0.12],
        [y + h * 0.87, 0.23],
        [y + h * 0.94, 0.08],
        [y + h, 0.08],
      ],
      6,
      pale,
    );
    if (d === 3)
      for (let i = 1; i <= 2; i++) {
        const t = i / 3;
        lathe(
          o,
          'trim',
          x,
          z,
          [
            [y + h * 0.8 * t, h * 0.13 * (1 - t) + 0.06],
            [y + h * 0.8 * t + 0.09, h * 0.13 * (1 - t) + 0.12],
          ],
          6,
          pale,
        );
      }
  }
}
function cross(o, x, y, z, h, d) {
  if (d === 0) return;
  B(o, 'trim', x, y, z, 0.14, h, 0.14, pale);
  B(o, 'trim', x, y + h * 0.6, z, h * 0.65, 0.14, 0.14, pale);
}
function plaque(o, x, y, z, w, h, d) {
  if (d < 2) return;
  const rr = [
    [x - w * 0.5, y + h],
    [x + w * 0.5, y + h],
    [x + w * 0.42, y + h * 0.3],
    [x, y],
    [x - w * 0.42, y + h * 0.3],
  ];
  polygon(
    o,
    'trim',
    rr.map(([x, y]) => [x, y, z]),
    pale,
    [0, 0, 1],
  );
  if (d === 3) {
    for (const dx of [-0.2, 0, 0.2])
      B(o, 'trim', x + dx * w, y + h * 0.35, z + 0.04, 0.09, h * 0.4, 0.06, tint(stone, 0.85));
  }
}
function reliefStatue(o, x, y, z, h, d) {
  if (d < 2) return;
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [y, h * 0.19],
      [y + h * 0.08, h * 0.22],
      [y + h * 0.17, h * 0.15],
      [y + h * 0.65, h * 0.13],
      [y + h * 0.78, h * 0.2],
      [y + h * 0.85, h * 0.06],
      [y + h * 0.9, h * 0.11],
      [y + h, h * 0.05],
    ],
    d === 3 ? 6 : 4,
    pale,
  );
  if (d === 3) {
    beam(
      o,
      'trim',
      [x - h * 0.1, y + h * 0.72, z],
      [x - h * 0.29, y + h * 0.43, z + 0.05],
      h * 0.09,
      h * 0.09,
      pale,
    );
    beam(
      o,
      'trim',
      [x + h * 0.1, y + h * 0.72, z],
      [x + h * 0.25, y + h * 0.6, z + 0.1],
      h * 0.09,
      h * 0.09,
      pale,
    );
  }
}
/** Plan-preserving body: front windows are actual holes, not overlays over a solid prism. */
function body(o, polys, lo, hi, d, frontBays = [], additionalHoles) {
  for (const p of polys) {
    let { outline: r, holes } = shape(p);
    if (d > 0) r = simplify(r, 0.15);
    if (d === 0) {
      r = simplify(r, 1.5);
      holes = holes.map((h) => simplify(h, 0.8));
    }
    // The continuous foundation closes these exterior shells below the visible floors.
    cap(o, 'stone', r, hi, stone, [0, 1, 0], holes);
    for (const [rr, sign] of [[r, 1], ...holes.map((h) => [h, -1])]) {
      const r0 = (area(rr) > 0 ? 1 : -1) * sign > 0 ? rr : [...rr].reverse();
      for (let i = 0; i < r0.length; i++) {
        const a = r0[i],
          b = r0[(i + 1) % r0.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 1e-6) continue;
        const hs = [];
        if (
          d > 0 &&
          Math.abs(b[1] - a[1]) < 0.15 * len &&
          a[1] > -11 &&
          b[1] > -11 &&
          a[0] < -31 &&
          b[0] < -31 &&
          b[0] < a[0]
        )
          for (const x of frontBays) {
            const t = (x - a[0]) / (b[0] - a[0]);
            const terminal = x === -222.5 || x === -47.7,
              w = terminal ? 3.1 : 5.4;
            if (t * len > w / 2 + 0.02 && t * len < len - w / 2 - 0.02) {
              hs.push(arch(t * len, 1.4, w, 5.7, d === 3 ? 10 : d === 2 ? 6 : 2));
              hs.push(
                arch(t * len, 9.0, terminal ? 2.1 : 2.7, 6.7, d === 3 ? 10 : d === 2 ? 6 : 2),
              );
            }
          }
        if (hi === 21.6 && hs.length) {
          hs.length = 0;
          for (const [x, y, w, h] of [
            [-142, 1.4, 3.5, 5.7],
            [-135.1, 1.4, 6.3, 6.8],
            [-128, 1.4, 3.5, 5.7],
            [-142.2, 9.6, 2.4, 8.6],
            [-127.9, 9.6, 2.4, 8.6],
            [-137.1, 9.6, 1.65, 8.6],
            [-135.1, 9.6, 1.65, 8.6],
            [-133.1, 9.6, 1.65, 8.6],
          ]) {
            const t = (x - a[0]) / (b[0] - a[0]);
            if (t > 0 && t < 1) hs.push(arch(t * len, y, w, h, d === 3 ? 8 : 2, y > 9));
          }
        }
        if (d > 0 && additionalHoles) hs.push(...additionalHoles(a, b, len));
        wall(o, 'stone', a, b, Math.min(lo, 1.2), hi, hs, 1.1);
      }
    }
  }
}
function simplify(r, tol) {
  const out = r.map((p) => p.slice());
  let changed = true;
  while (changed && out.length > 4) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length],
        p = out[i],
        b = out[(i + 1) % out.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / l < tol) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out;
}
function turretRoofCuts(d) {
  return dormitoryTurrets.map(([x, z]) =>
    (d === 1
      ? [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ]
      : [
          [1, -0.6],
          [1, 0.6],
          [0.6, 1],
          [-0.6, 1],
          [-1, 0.6],
          [-1, -0.6],
          [-0.6, -1],
          [0.6, -1],
        ]
    ).map(([a, b]) => [x + a * 3.465, z + b * 3.465]),
  );
}
function clipRoofSide(r, a, b, inside) {
  if (!r.length) return [];
  const value = (p) =>
      ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) * (inside ? 1 : -1),
    out = [];
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      vp = value(p),
      vq = value(q),
      ip = vp >= -1e-8,
      iq = vq >= -1e-8;
    if (ip) out.push(p);
    if (ip !== iq) {
      const t = vp / (vp - vq);
      out.push(p.map((v, k) => v + t * (q[k] - v)));
    }
  }
  return out;
}
/** Subtract the actual chimney/turret wall envelope, so roof sheets cannot enter its window recesses. */
function roofOutsideTurrets(r, d) {
  let fragments = [r];
  for (const cut of turretRoofCuts(d)) {
    const xx = cut.map((p) => p[0]),
      zz = cut.map((p) => p[1]);
    fragments = fragments.flatMap((poly) => {
      if (
        poly.every((p) => p[0] < Math.min(...xx)) ||
        poly.every((p) => p[0] > Math.max(...xx)) ||
        poly.every((p) => p[1] < Math.min(...zz)) ||
        poly.every((p) => p[1] > Math.max(...zz))
      )
        return [poly];
      let remaining = poly;
      const outside = [];
      for (let i = 0; i < cut.length; i++) {
        const a = cut[i],
          b = cut[(i + 1) % cut.length],
          piece = clipRoofSide(remaining, a, b, false);
        if (piece.length >= 3 && Math.abs(area(piece)) > 1e-7) outside.push(cleanRing(piece));
        remaining = clipRoofSide(remaining, a, b, true);
        if (remaining.length < 3) break;
      }
      return outside.filter((p) => p.length >= 3 && Math.abs(area(p)) > 1e-7);
    });
  }
  return fragments;
}
function turretRoofEdge(a, b, d) {
  return turretRoofCuts(d).some((r) =>
    r.some((p, i) => {
      const q = r[(i + 1) % r.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        l2 = dx * dx + dz * dz;
      return [a, b].every(
        (v) =>
          Math.abs(dx * (v[1] - p[1]) - dz * (v[0] - p[0])) < 1e-5 &&
          ((v[0] - p[0]) * dx + (v[1] - p[1]) * dz) / l2 >= -1e-5 &&
          ((v[0] - p[0]) * dx + (v[1] - p[1]) * dz) / l2 <= 1.00001,
      );
    }),
  );
}
/** Only native/crop perimeter edges close a roof; triangulation and subtraction seams are internal. */
function roofEnvelopeEdge(p, a, b, x0, z0, x1, z1) {
  const onSegment = (u, v) => {
    const dx = v[0] - u[0],
      dz = v[1] - u[1],
      l2 = dx * dx + dz * dz;
    if (l2 < 1e-10) return false;
    return [a, b].every(
      (q) =>
        Math.abs(dx * (q[1] - u[1]) - dz * (q[0] - u[0])) / Math.sqrt(l2) < 1e-5 &&
        ((q[0] - u[0]) * dx + (q[1] - u[1]) * dz) / l2 >= -1e-5 &&
        ((q[0] - u[0]) * dx + (q[1] - u[1]) * dz) / l2 <= 1.00001,
    );
  };
  return (
    p.some((r) => r.some((q, i) => onSegment(q, r[(i + 1) % r.length]))) ||
    [
      [0, x0],
      [0, x1],
      [1, z0],
      [1, z1],
    ].some(([axis, value]) => Math.abs(a[axis] - value) < 1e-5 && Math.abs(b[axis] - value) < 1e-5)
  );
}
/** Two planar roof pitches clipped per existing plan triangle; no artificial triangulation ridges. */
function roof(o, p, x0, z0, x1, z1, axis, mid, half, eave, rise, d) {
  const all = p.flat(),
    offsets = [];
  let n = p[0].length;
  for (const h of p.slice(1)) {
    offsets.push(n);
    n += h.length;
  }
  const ids = earcut(all.flat(), offsets),
    boundary = new Map();
  const height = ([x, z]) =>
    eave + rise * Math.max(0, 1 - Math.abs((axis === 0 ? x : z) - mid) / half);
  const pointKey = (p) => p.map((v) => v.toFixed(5)).join(',');
  for (let k = 0; k < ids.length; k += 3) {
    const tri2 = ids.slice(k, k + 3).map((i) => all[i]);
    tri2.push(tri2[0]);
    for (const [lo, hi] of [
      [-1e4, mid],
      [mid, 1e4],
    ]) {
      const bounds = [x0, z0, x1, z1];
      bounds[axis] = Math.max(bounds[axis], lo);
      bounds[axis + 2] = Math.min(bounds[axis + 2], hi);
      if (bounds[axis] >= bounds[axis + 2]) continue;
      const q = cropped([tri2], ...bounds);
      for (const pp of q) {
        for (const rr of roofOutsideTurrets(ring(pp[0]), d)) {
          const pts = rr.map(([x, z]) => [
            x,
            eave + rise * Math.max(0, 1 - Math.abs((axis === 0 ? x : z) - mid) / half),
            z,
          ]);
          polygon(o, 'roof', pts, tile, [0, 1, 0]);
          for (let i = 0; i < rr.length; i++) {
            const a = rr[i],
              b = rr[(i + 1) % rr.length],
              key = [pointKey(a), pointKey(b)].sort().join('|');
            if (boundary.has(key)) boundary.delete(key);
            else boundary.set(key, [a, b]);
          }
        }
      }
    }
  }
  for (const [a, b] of boundary.values()) {
    if (!roofEnvelopeEdge(p, a, b, x0, z0, x1, z1) || turretRoofEdge(a, b, d)) continue;
    const ya = height(a),
      yb = height(b);
    quad(
      o,
      'stone',
      [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [b[0], yb, b[1]],
        [a[0], ya, a[1]],
      ],
      stone,
    );
  }
}
/** Hipped roof cut into four true planes; every roof edge closes back to its eave. */
function hip(o, p, x0, z0, x1, z1, eave, rise) {
  const hx = (x1 - x0) / 2,
    hz = Math.min(hx, (z1 - z0) / 2),
    planes = [
      [rise / hx, 0, eave - (rise * x0) / hx],
      [-rise / hx, 0, eave + (rise * x1) / hx],
      [0, rise / hz, eave - (rise * z0) / hz],
      [0, -rise / hz, eave + (rise * z1) / hz],
    ];
  const evaluate = (f, p) => f[0] * p[0] + f[1] * p[1] + f[2],
    all = p.flat(),
    holes = [];
  let off = p[0].length;
  for (const h of p.slice(1)) {
    holes.push(off);
    off += h.length;
  }
  const ids = earcut(all.flat(), holes),
    edges = new Map(),
    key = (p) => p.map((v) => v.toFixed(5)).join(',');
  const halfPlane = (r, f) => {
    const out = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        va = evaluate(f, a),
        vb = evaluate(f, b),
        ia = va >= -1e-8,
        ib = vb >= -1e-8;
      if (ia) out.push(a);
      if (ia !== ib) {
        const t = va / (va - vb);
        out.push(a.map((v, k) => v + t * (b[k] - v)));
      }
    }
    return out;
  };
  for (let k = 0; k < ids.length; k += 3) {
    const r = ids.slice(k, k + 3).map((i) => all[i]);
    r.push(r[0]);
    for (const pp of cropped([r], x0, z0, x1, z1))
      for (const [i, f] of planes.entries()) {
        let rr = ring(pp[0]);
        for (const [j, g] of planes.entries())
          if (i !== j)
            rr = halfPlane(
              rr,
              g.map((v, k) => v - f[k]),
            );
        if (rr.length < 3) continue;
        rr = cleanRing(rr);
        if (rr.length < 3) continue;
        polygon(
          o,
          'roof',
          rr.map((p) => [p[0], evaluate(f, p), p[1]]),
          tile,
          [0, 1, 0],
        );
        for (let j = 0; j < rr.length; j++) {
          const a = rr[j],
            b = rr[(j + 1) % rr.length],
            id = [key(a), key(b)].sort().join('|');
          if (edges.has(id)) edges.delete(id);
          else edges.set(id, [a, b]);
        }
      }
  }
  for (const [a, b] of edges.values()) {
    if (!roofEnvelopeEdge(p, a, b, x0, z0, x1, z1)) continue;
    const height = (p) => Math.min(...planes.map((f) => evaluate(f, p)));
    quad(
      o,
      'stone',
      [
        [a[0], eave, a[1]],
        [b[0], eave, b[1]],
        [b[0], height(b), b[1]],
        [a[0], height(a), a[1]],
      ],
      stone,
    );
  }
}
function westWing(o, d, bodyDetail = d) {
  const nativeMain = native(main),
    west = cropped(nativeMain, -240, -125, -42.5, 0);
  const westNormal = [
      ...cropped(nativeMain, -240, -125, -145.75, 0),
      ...cropped(nativeMain, -124.4, -125, -42.5, 0),
    ],
    center = cropped(nativeMain, -145.75, -125, -124.4, 0);
  const bays = [
    ...Array.from({ length: 11 }, (_, i) => -217 + ((i + 0.5) * 71) / 11),
    ...Array.from({ length: 11 }, (_, i) => -124 + ((i + 0.5) * 72) / 11),
    -222.5,
    -47.7,
  ];
  const backWindows = (a, b, len) => {
    if (bodyDetail < 2 || len < 20) return [];
    const north = a[1] > -105 && a[1] < -99 && b[1] > -105 && b[1] < -99,
      west = a[0] > -201 && a[0] < -196 && b[0] > -201 && b[0] < -196;
    if (!north && !west) return [];
    return Array.from({ length: Math.floor(len / 6.8) }, (_, i) =>
      arch(((i + 0.5) * len) / Math.floor(len / 6.8), 5, 1.6, 10, d === 3 ? 6 : 4),
    );
  };
  body(o, westNormal, 1.2, 18.2, bodyDetail, bays, backWindows);
  body(o, center, 1.2, 21.6, bodyDetail, [-142, -135, -128], backWindows);
  for (const pp of west) {
    roof(o, pp, -220.4, -23, -145.75, 0, 1, -15.2, 7.8, 18.2, 5.3, bodyDetail);
    roof(o, pp, -124.4, -23, -51.5, 0, 1, -14.8, 7.8, 18.2, 5.3, bodyDetail);
    hip(o, pp, -145.75, -38.6, -124.4, -4.7, 21.6, 4.4);
    hip(o, pp, -145.75, -119.5, -124.4, -99.1, 21.6, 4.4);
    roof(o, pp, -215, -120, -42.5, -98, 1, -109, 11, 18.2, 4.9, bodyDetail);
    roof(o, pp, -215, -104, -196, -20, 0, -205.5, 9.5, 18.2, 4.9, bodyDetail);
    for (const [x0, x1] of [
      [-200.3, -185.9],
      [-157.8, -145.75],
      [-124.4, -111.0],
      [-83.5, -68.8],
      [-58.1, -51.5],
    ])
      roof(o, pp, x0, -43, x1, -19, 0, (x0 + x1) / 2, (x1 - x0) / 2, 18.2, 4.0, bodyDetail);
  }
  if (d > 0) {
    for (const [x0, x1, z] of [
      [-220.4, -145.75, -9.8],
      [-124.4, -51.6, -8.4],
    ]) {
      edge(
        o,
        [
          [x0, z],
          [x1, z],
        ],
        7.7,
        0.5,
        0.35,
      );
      edge(
        o,
        [
          [x0, z],
          [x1, z],
        ],
        17.7,
        0.55,
        0.35,
      );
      for (const x of bays.filter((x) => x > x0 && x < x1)) {
        if (d >= 2) {
          archTrim(o, x, 9, z + 0.1, 2.7, 6.7, d);
          B(o, 'trim', x, 9, z + 0.2, 0.09, 6.2, 0.1, pale);
          B(o, 'trim', x, 12.8, z + 0.2, 2.5, 0.09, 0.1, pale);
          B(o, 'trim', x, 1.4, z + 0.2, 0.13, 4.9, 0.1, pale);
          curve(
            o,
            [
              [x - 2.5, 6.3, z + 0.2],
              [x, 5, z + 0.2],
              [x + 2.5, 6.3, z + 0.2],
            ],
            0.14,
          );
        }
        if (d === 3) {
          for (const sign of [1]) {
            column(o, x + sign * 3.1, 1.3, z + 0.35, 16.5, 0.14, d);
            pin(o, x + sign * 3.1, 18.1, z + 0.2, 1.3, d);
          }
          plaque(o, x, 16.2, z + 0.22, 0.7, 0.8, d);
        }
      }
    }
    const z = -4.9;
    edge(
      o,
      [
        [-145.7, z],
        [-124.4, z],
      ],
      20.9,
      0.6,
      0.4,
    );
    for (const x of [-142.2, -127.9]) {
      if (d >= 2) archTrim(o, x, 9.6, z + 0.15, 2.4, 8.6, d);
      pin(o, x, 21.5, z, 3.5, d);
    }
    if (d >= 2) archTrim(o, -135.1, 1.4, z + 0.15, 6.3, 6.8, d);
    if (d >= 2) {
      for (const x of [-137.1, -135.1, -133.1])
        archTrim(o, x, 9.6, z + 0.2, 1.65, 8.6, d, true, 0.17);
      plaque(o, -135.1, 18.6, z + 0.2, 1.2, 1.8, d);
    }
  }
  // Facade turrets remain separate from the much broader church campanile.
  for (const [x, z] of dormitoryTurrets) turret(o, x, z, 3.3, 1.2, bodyDetail);
}

/** Photograph-directed shaft, window chamber, armorial drum and long crocketed spire. */
function turret(o, x, z, r, lo, d) {
  const radius = r * 1.05,
    spireColor = rgb('b4aa8b');
  if (d === 1) {
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [lo, r * 0.85],
        [17.7, r * 0.85],
        [18.2, radius],
        [26.8, radius],
        [35.2, 0.16],
        [36.6, 0.025],
      ],
      4,
      stone,
    );
    return;
  }
  const n = d === 3 ? 12 : 8;
  lathe(
    o,
    'stone',
    x,
    z,
    [
      [lo, r * 0.85],
      [17.7, r * 0.85],
      [18.2, radius],
    ],
    n,
    stone,
  );
  const rr = [
    [1, -0.6],
    [1, 0.6],
    [0.6, 1],
    [-0.6, 1],
    [-1, 0.6],
    [-1, -0.6],
    [-0.6, -1],
    [0.6, -1],
  ].map(([a, b]) => [x + a * radius, z + b * radius]);
  cap(o, 'stone', rr, 18.2, stone);
  cap(o, 'stone', rr, 23.8, stone);
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      cardinal = Math.abs(a[0] - b[0]) < 1e-6 || Math.abs(a[1] - b[1]) < 1e-6;
    wall(
      o,
      'stone',
      a,
      b,
      18.2,
      23.8,
      cardinal ? [arch(len / 2, 19.0, 1.05, 4.2, d === 3 ? 6 : 4, true)] : [],
      0.55,
    );
  }
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [23.8, radius],
      [24.1, radius * 1.12],
      [24.35, radius],
    ],
    8,
    pale,
  );
  prism(o, 'stone', rr, 24.35, 26.8, stone);
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [26.7, radius],
      [26.95, radius * 1.05],
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
      [26.95, r * 0.94],
      [35.2, 0.16],
    ],
    8,
    spireColor,
  );
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [35.2, 0.16],
      [35.4, 0.4],
      [35.65, 0.24],
      [35.8, 0.12],
    ],
    d === 3 ? 6 : 4,
    pale,
  );
  cross(o, x, 35.8, z, 0.8, d);
  const leaf = (cx, y, cz, radial) => {
    const u = [-radial[1], radial[0]],
      p = [
        [cx + u[0] * 0.17, y, cz + u[1] * 0.17],
        [cx - u[0] * 0.17, y, cz - u[1] * 0.17],
        [cx + radial[0] * 0.38, y + 0.12, cz + radial[1] * 0.38],
        [cx, y + 0.42, cz],
      ],
      center = p[0].map((_, i) => p.reduce((s, q) => s + q[i], 0) / 4);
    for (const ids of [
      [0, 1, 2],
      [0, 3, 1],
      [1, 3, 2],
      [2, 3, 0],
    ]) {
      const q = ids.map((i) => p[i]),
        avg = q[0].map((_, i) => q.reduce((s, p) => s + p[i], 0) / 3 - center[i]);
      tri(o, 'trim', q, pale, avg);
    }
  };
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2,
      fo = facing(o, a, x, z);
    if (d === 3) {
      archTrim(fo, 0, 19, radius + 0.03, 1.05, 4.2, d, true, 0.12);
      plaque(fo, 0, 24.7, radius + 0.04, 0.85, 1.2, d);
      beam(fo, 'trim', [-0.6, 17.7, r * 0.85], [-0.6, lo + 0.2, r * 0.85], 0.16, 0.13, pale);
    }
    const px = x + radius * 0.8 * Math.cos(a),
      pz = z + radius * 0.8 * Math.sin(a);
    cone(o, px, 26.8, pz, 0.38, 1.6, d);
  }
  if (d === 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        u = [Math.cos(a), Math.sin(a)];
      curve(
        o,
        [
          [x + r * 0.94 * u[0], 26.95, z + r * 0.94 * u[1]],
          [x + r * 0.47 * u[0], 31.075, z + r * 0.47 * u[1]],
          [x + 0.16 * u[0], 35.2, z + 0.16 * u[1]],
        ],
        0.14,
      );
      for (const t of [0.2, 0.45, 0.7]) {
        const rr = r * 0.94 * (1 - t) + 0.16 * t;
        leaf(x + rr * u[0], 26.95 + 8.25 * t, z + rr * u[1], u);
      }
    }
}
/** Convex chamfered court offsets preserve parallel gallery depth. */
function offset(r, dist) {
  return r.map((p, i) => {
    const prev = (i + r.length - 1) % r.length,
      n0 = outward(r, prev),
      n1 = outward(r, i),
      den = 1 + n0[0] * n1[0] + n0[2] * n1[2];
    return [p[0] + (dist * (n0[0] + n1[0])) / den, p[1] + (dist * (n0[2] + n1[2])) / den];
  });
}
const gallery = offset(court, 3.6);
function local([lon, lat]) {
  const rad = Math.PI / 180,
    R = 6378137,
    f = Math.cos(frame.anchor[1] * rad),
    x = (lon - frame.anchor[0]) * rad * R * f,
    z = -R * f * (Math.asinh(Math.tan(lat * rad)) - Math.asinh(Math.tan(frame.anchor[1] * rad))),
    c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  return [c * x - s * z, s * x + c * z];
}
const garden = frame.controls.cloisterPavingSource.geometry.coordinates.map((r) =>
  ring(r).map(local),
);
function cloister(o, d, posts = d) {
  const east = cropped(native(main), -42.5, -150, 50, -19);
  for (const p of east) if (p.length > 1) p[1] = [...gallery, gallery[0]];
  body(o, east, 2.65, 12.3, d);
  prism(o, 'stone', gallery, 1.2, 2.65, stone);
  if (d === 0) {
    cap(o, 'garden', court, 2.67, grass);
    return;
  }
  prism(o, 'stone', gallery, 7.42, 7.6, stone, [court]);
  prism(o, 'stone', gallery, 12.08, 12.3, stone, [court]);
  cap(o, 'paving', court, 2.675, paving);
  cap(o, 'paving', garden[0], 2.685, paving, [0, 1, 0], garden.slice(1));
  for (const rr of garden.slice(1, 5)) cap(o, 'garden', rr, 2.69, grass);
  const fountain = garden.at(-1),
    fx = fountain.reduce((s, p) => s + p[0], 0) / fountain.length,
    fz = fountain.reduce((s, p) => s + p[1], 0) / fountain.length;
  lathe(
    o,
    'trim',
    fx,
    fz,
    [
      [2.68, 3.1],
      [2.85, 3.15],
      [2.95, 3.08],
      [2.95, 2.8],
      [2.78, 2.8],
    ],
    d === 3 ? 24 : 12,
    pale,
  );
  cap(
    o,
    'recess',
    Array.from({ length: 16 }, (_, i) => [
      fx + 2.78 * Math.cos((i * Math.PI) / 8),
      fz + 2.78 * Math.sin((i * Math.PI) / 8),
    ]),
    2.8,
    rgb('778b80'),
  );
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = outward(court, i).map((v) => -v),
      count = len > 20 ? 5 : 1,
      bay = len / count;
    const reversed = [b, a],
      a0 = reversed[0],
      b0 = reversed[1],
      fo = facing(o, Math.atan2(-u[1], u[0]), a[0], a[1]);
    // Court-facing surface has true voids and a second masonry face inside the covered gallery.
    const lower = [],
      upper = [];
    for (let j = 0; j < count; j++) {
      const x = (j + 0.5) * bay;
      lower.push(arch(x, 3.08, bay - 0.85, 4.18, d === 3 ? 12 : d === 2 ? 8 : 4));
      upper.push(arch(x, 8.15, bay - 0.8, 3.62, d === 3 ? 12 : d === 2 ? 8 : 4));
    }
    // Reverse edge for normals into the court. Local hole x is reversed with it.
    wall(o, 'stone', a0, b0, 2.65, 7.42, lower, 0.6, stone, false);
    wall(o, 'stone', a0, b0, 7.6, 12.3, upper, 0.58, stone, false);
    edge(o, [a, b], 7.42, 0.82, 0.2);
    edge(o, [a, b], 12.3, 0.8, 0.21);
    edge(o, [a, b], 13.35, 0.78, 0.15);
    B(fo, 'stone', len / 2, 12.5, -0.03, len, 0.85, 0.52, stone);
    for (let j = 0; j < count; j++) {
      const x = (j + 0.5) * bay;
      for (const t of posts >= 2 ? [-0.25, 0, 0.25] : [0])
        column(fo, x + t * (bay - 0.85), 3.08, 0, 2.65, d === 3 ? 0.1 : 0.11, d, d === 3);
      column(fo, x, 8.15, 0, 2.6, 0.12, d);
      if (d === 3) {
        archTrim(fo, x, 3.08, 0, bay - 0.85, 4.18, d, false, 0.15);
        archTrim(fo, x, 8.15, 0.02, bay - 0.8, 3.62, d, false, 0.13);
        const sub = (bay - 0.85) / 2;
        for (const t of [-1, 1]) {
          const cx = x + (t * sub) / 2;
          curve(
            fo,
            arch(cx, 5.37, sub, 1.36, d === 3 ? 8 : 5)
              .slice(1)
              .map(([x, y]) => [x, y, 0.03]),
            0.11,
          );
          circle(fo, cx, 6.52, 0.04, 0.29, 2, 0.09);
        }
        circle(fo, x, 6.82, 0.03, 0.32, d, 0.09);
        for (const t of [-1, 1])
          curve(
            fo,
            arch(x + (t * (bay - 0.8)) / 4, 10.05, (bay - 0.8) / 2, 1.25, d === 3 ? 8 : 5)
              .slice(1)
              .map(([x, y]) => [x, y, 0.04]),
            0.1,
          );
        circle(fo, x, 12.94, 0.3, 0.28, 2, 0.1);
        if (d === 3) {
          const w = 0.5;
          curve(
            fo,
            [
              [x, 12.6, 0.31],
              [x + w, 12.93, 0.31],
              [x, 13.25, 0.31],
              [x - w, 12.93, 0.31],
              [x, 12.6, 0.31],
            ],
            0.08,
          );
        }
      }
      if (d === 3) {
        for (const y of [7.25, 11.95])
          for (const sign of [-1, 1])
            curve(
              o,
              Array.from({ length: 5 }, (_, k) => {
                const t = k / 4,
                  sx = x + (t - 0.5) * bay * 0.85 * sign,
                  deep = 3.2 * t;
                return [
                  a[0] + u[0] * sx - n[0] * deep,
                  y - 0.8 * Math.sin(Math.PI * t),
                  a[1] + u[1] * sx - n[2] * deep,
                ];
              }),
              0.09,
              pale,
            );
      }
    }
    for (let j = 0; j <= count; j++) {
      const x = j * bay;
      if (j < count) B(fo, 'trim', x, 2.65, 0, 0.7, 10.9, 0.85, pale);
      if ((d === 3 && j < count) || (d === 2 && j === 0)) pin(fo, x, 13.5, 0, 2.0, d);
    }
  }
  // Individual monastic room roof pitches surround, rather than close, the open court.
  for (const p of east) {
    roof(o, p, -42.5, -85, -25, -25, 0, -33.75, 8.75, 12.3, 3.5, d);
    roof(o, p, 22, -86, 45, -28, 0, 33.5, 11.5, 12.3, 4, d);
    roof(o, p, -25, -86, 22, -77, 1, -81.5, 4.5, 12.3, 2.6, d);
  }
}
function northernRooms(o, d) {
  for (const suffix of ['52776569451127', '52776569451126']) {
    const p = native(part(suffix));
    body(o, [p], 3.4, 11.4, d);
    if (suffix.endsWith('127')) {
      roof(o, p, 18, -146, 46, -85, 0, 32, 14, 11.4, 3.2, d);
      roof(o, p, -12, -146, 20, -134, 1, -140, 6, 11.4, 2.2, d);
    } else {
      roof(o, p, -75, -144, -20, -129, 1, -136.5, 7.5, 11.4, 2.8, d);
      roof(o, p, -44, -130, -20, -85, 0, -32, 12, 11.4, 3.2, d);
    }
    if (d >= 2) {
      const r = ring(p[0]);
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 8) continue;
        for (let j = 0; j < Math.floor(len / 6); j++) {
          const t = (j + 0.5) / Math.floor(len / 6),
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            fo = facing(o, Math.atan2(-dz, dx), a[0] + t * dx, a[1] + t * dz);
          B(fo, 'recess', 0, 6.5, 0.05, 1.3, 2.6, 0.05, shadow);
          B(fo, 'trim', 0, 6.35, 0.07, 1.6, 0.16, 0.15, pale);
        }
      }
    }
  }
  const refectory = native(part('52776569451128'));
  body(o, [refectory], 1.2, 16.1, d);
  roof(o, refectory, -73, -104, -46, -41, 0, -62, 10.3, 16.1, 4.0, d);
}
function bellTower(o, d) {
  const x = -25.3,
    z = -4.0,
    w = 10.2;
  // The native west church block supplies the lower shaft; do not plug its cut windows with an overlapping box.

  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2,
      fo = facing(o, a, x, z);
    wall(
      fo,
      'stone',
      [5.1, 5.1],
      [-5.1, 5.1],
      24.1,
      33.8,
      d > 0 ? [arch(5.1, 26.1, 2.6, 5.5, d === 3 ? 8 : 4, true)] : [],
      0.85,
    );
  }
  B(o, 'stone', x, 33.8, z, w, 0.4, 10.2, stone);
  B(o, 'trim', x, 24.1, z, w + 1.0, 0.7, 11, pale);
  B(o, 'trim', x, 33.3, z, w + 1.1, 0.9, 11.1, pale);
  // Two visibly different lower south windows from the actual 2017 facade photograph.
  if (d >= 2) {
    archTrim(o, x, 3.0, 1.78, 2.1, 5.4, d, false, 0.22);
    archTrim(o, x, 12.2, 1.78, 2.6, 5.5, d, true, 0.24);
    for (const [y, h] of [
      [3, 4.4],
      [12.2, 4.2],
    ])
      B(o, 'trim', x, y, 1.85, 0.11, h, 0.13, pale);
    plaque(o, x, 19.1, 1.78, 1.8, 2.5, d);
    for (const xx of [-30.3, -20.3]) B(o, 'trim', xx, 1.2, 1.7, 0.22, 22.5, 0.26, pale);
  }
  // Four upper bell openings: recesses bounded behind, on cut tower wall shells.
  if (d > 0) {
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2,
        fo = facing(o, a, x, z);

      if (d >= 2) {
        archTrim(fo, 0, 26.1, 5.17, 2.6, 5.5, d, true, 0.28);
        circle(fo, -3.1, 30.7, 5.18, 0.7, d, 0.12);
        if (d === 3) {
          curve(
            fo,
            [
              [-3.1, 30.7, 5.2],
              [-3.1, 31.2, 5.2],
            ],
            0.07,
            shadow,
          );
          curve(
            fo,
            [
              [-3.1, 30.7, 5.2],
              [-2.8, 30.5, 5.2],
            ],
            0.07,
            shadow,
          );
        }
      }
    }
  }
  // Broad stone dome on a square, chamfered drum; distinct from narrow turret spires.
  const drum = [
    [-5.1, -3.9],
    [-3.9, -5.1],
    [3.9, -5.1],
    [5.1, -3.9],
    [5.1, 3.9],
    [3.9, 5.1],
    [-3.9, 5.1],
    [-5.1, 3.9],
  ].map(([a, b]) => [x + a, z + b]);
  prism(o, 'stone', drum, 34.2, 36.1, stone);
  const n = d === 3 ? 24 : d === 2 ? 16 : 8,
    prof = [
      [36.1, 5.35],
      [37.8, 5.2],
      [39.4, 4.6],
      [41.1, 3.65],
      [42.6, 2.1],
      [43.6, 0.5],
      [43.8, 0.25],
    ];
  lathe(o, 'stone', x, z, prof, n, stone);
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      curve(
        o,
        prof.map(([y, r]) => [x + r * Math.cos(a), y, z + r * Math.sin(a)]),
        0.17,
      );
      for (let j = 1; j < prof.length - 1; j++)
        if (d === 3)
          lathe(
            o,
            'trim',
            x + prof[j][1] * Math.cos(a),
            z + prof[j][1] * Math.sin(a),
            [
              [prof[j][0], 0.14],
              [prof[j][0] + 0.22, 0.2],
              [prof[j][0] + 0.34, 0.08],
            ],
            6,
            pale,
          );
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        column(o, x + sx * 4.6, 34.2, z + sz * 4.6, 3.0, 0.32, d);
        pin(o, x + sx * 4.6, 37.2, z + sz * 4.6, 2.3, d);
      }
  }
  lathe(
    o,
    'trim',
    x,
    z,
    [
      [43.8, 0.2],
      [44.1, 0.55],
      [44.6, 0.65],
      [45, 0.25],
      [45.3, 0.2],
    ],
    d >= 2 ? 8 : 4,
    pale,
  );
  cross(o, x, 45.3, z, 0.7, d);
}
function nave(o, d) {
  const r = ring(church.outline);
  prism(o, 'stone', r, -8.25, 1.2, stone);
  const cp = native(church);
  const towerBand = cropped(cp, -31, -28, -19, 3),
    naveBand = cropped(cp, -19.94, -27, 20.0, 1),
    transept = cropped(cp, 19.93, -31, 44.9, 4.41),
    chapel = cropped(cp, 24.8, 4.14, 39.2, 14.48),
    apse = cropped(cp, 44.5, -23, 65, -4);
  body(o, towerBand, 1.2, 24.1, d, [], (a, b, len) => {
    if (a[1] > 1.3 && b[1] > 1.3) {
      const c = ((-25.3 - a[0]) / (b[0] - a[0])) * len;
      return [
        arch(c, 3.0, 2.1, 5.4, d === 3 ? 8 : 5),
        arch(c, 12.2, 2.6, 5.5, d === 3 ? 8 : 5, true),
      ];
    }
    if (a[0] < -30 && b[0] < -30 && Math.abs(b[0] - a[0]) < 0.03 * len) {
      const c = ((-13.1 - a[1]) * (b[1] - a[1])) / len;
      return [
        arch(c, 1.3, 7.5, 6.6, d === 3 ? 8 : 4, true),
        Array.from({ length: d === 3 ? 16 : 8 }, (_, i) => [
          c + 2.5 * Math.cos((i * 2 * Math.PI) / (d === 3 ? 16 : 8)),
          16 + 2.5 * Math.sin((i * 2 * Math.PI) / (d === 3 ? 16 : 8)),
        ]),
      ];
    }
    return [];
  });
  body(o, transept, 1.2, 25.1, d);
  body(o, chapel, 1.2, 16.8, d, [], (a, b, len) => {
    if (a[1] > 14 && b[1] > 14) {
      const c = ((32 - a[0]) * (b[0] - a[0])) / len;
      return [
        Array.from({ length: d === 3 ? 16 : 8 }, (_, i) => [
          c + 1.3 * Math.cos((i * 2 * Math.PI) / (d === 3 ? 16 : 8)),
          13.3 + 1.3 * Math.sin((i * 2 * Math.PI) / (d === 3 ? 16 : 8)),
        ]),
      ];
    }
    return [];
  });
  body(o, apse, 1.2, 20.5, d);
  // Actual nave walls leave openings in the front, back and west facade.
  const naver = shape(naveBand[0]);
  cap(o, 'stone', naver.outline, 1.2, stone);
  cap(o, 'stone', naver.outline, 24.1, stone);
  const frontA = [19.93363, 0],
    frontB = [-19.93363, 0],
    win = [-12.1, -4.2, 15.9],
    portalX = 7.0;
  if (d === 0) wall(o, 'stone', frontA, frontB, 1.2, 24.1);
  else {
    const holes = win.map((x) =>
      arch(frontA[0] - x, 8.0, 2.95, 11.0, d === 3 ? 12 : d === 2 ? 8 : 4, true),
    );
    holes.push(arch(frontA[0] - portalX, 1.3, 5.8, 7.1, d === 3 ? 12 : d === 2 ? 8 : 4, true));
    wall(o, 'stone', frontA, frontB, 1.2, 24.1, holes, 1.25);
  }
  wall(
    o,
    'stone',
    [-19.94, -26.82],
    [19.94, -26.82],
    1.2,
    24.1,
    d > 0 ? [-10, 0, 10].map((x) => arch(x + 19.94, 14.5, 2.6, 6.8, 6, true)) : [],
    1.0,
  );
  // West axial church entrance and rose are distinct from the richly decorated south portal.
  const west = facing(o, -Math.PI / 2, -30.6, -13.1);
  if (d > 0) {
    archTrim(west, 0, 1.3, 0.15, 7.5, 6.6, d, true, 0.3);
    circle(west, 0, 16, 0.2, 2.5, d, 0.2);
    if (d >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        curve(
          west,
          [
            [0, 16, 0.2],
            [2.35 * Math.cos(a), 16 + 2.35 * Math.sin(a), 0.2],
          ],
          0.1,
        );
      }
  }
  for (const p of naveBand) roof(o, p, -20, -27, 20, 1, 1, -13.1, 13.9, 24.1, 2.0, d);
  for (const p of transept) hip(o, p, 19.93, -31, 44.9, 4.41, 25.1, 4.3);
  for (const p of chapel) hip(o, p, 24.8, 4.14, 39.2, 14.48, 16.8, 3.4);
  for (const p of apse) roof(o, p, 44.5, -23, 65, -4, 1, -13.5, 9.5, 20.5, 3.6, d);
  bellTower(o, d);
  if (d === 0) return;
  const facade = facing(o, 0, 0, 0);
  for (const x of win) {
    archTrim(facade, x, 8, 0.1, 2.95, 11.0, d, true, 0.28);
    if (d >= 2) {
      B(o, 'trim', x, 8, 0.3, 0.13, 9.5, 0.2, pale);
      for (const y of [9, 11.5, 14, 16.5]) B(o, 'trim', x, y, 0.31, 2.8, 0.1, 0.16, pale);
    }
  }
  for (const x of [-19.9, -16.3, -0.5, 11.9, 20]) {
    B(o, 'stone', x, 1.2, 0.7, 0.85, 23.2, 1.5, stone);
    for (const y of [6.8, 15.8, 23.5]) B(o, 'trim', x, y, 0.9, 1.2, 0.35, 1.9, pale);
    pin(o, x, 24.0, 0.7, 3.4, d);
  }
  // Pierced Manueline roof parapet, with visibly separate stone posts and voids.
  B(o, 'trim', 0, 24.1, 0.2, 39.87, 0.25, 0.65, pale);
  B(o, 'trim', 0, 25.3, 0.2, 39.87, 0.2, 0.6, pale);
  const count = d === 3 ? 40 : 20;
  for (let i = 0; i <= count; i++) {
    const x = -19.9 + (i * 39.8) / count;
    B(o, 'trim', x, 24.35, 0.2, 0.16, 0.95, 0.34, pale);
    if (d === 3) {
      circle(o, x + 0.45, 24.8, 0.35, 0.32, d, 0.085);
    }
  }
  southPortal(o, portalX, d);
  // Projecting south transept chapel: its circular window and tiled hip roof are prominent.
  const south = facing(o, 0, 32, 14.47);
  if (d >= 2) {
    circle(south, 0, 13.3, 0.15, 1.5, d, 0.25);
    edge(
      o,
      [
        [24.9, 14.55],
        [39.2, 14.55],
      ],
      12.0,
      0.35,
      0.3,
    );
  }
}
function southPortal(o, x, d) {
  const z = 1.1;
  // Actual door recess is in the nave wall. These stepped frames project out of it.
  if (d === 1) {
    B(o, 'trim', x, 1.2, z, 7.0, 0.3, 2.3, pale);
    for (const sign of [-1, 1]) column(o, x + sign * 3.5, 1.2, z, 18.6, 0.3, d);
    pin(o, x, 20, z, 5.6, d);
    return;
  }
  for (const sign of [-1, 1]) {
    column(o, x + sign * 3.4, 1.2, z, 18.2, 0.27, d, true);
    column(o, x + sign * 2.9, 1.2, z + 0.3, 12.9, 0.18, d);
    pin(o, x + sign * 3.4, 19.4, z, 3.7, d);
  }
  archTrim(o, x, 1.3, z + 0.4, 5.8, 7.1, d, true, 0.35);
  column(o, x, 1.3, z + 0.65, 5.3, 0.14, d);
  for (const sign of [-1, 1])
    archTrim(o, x + sign * 1.45, 1.4, z + 0.58, 2.55, 4.8, d, false, 0.18);
  // Crossover canopy ribs and successive sculpture/arch tiers remain real raised geometry.
  for (const sign of [-1, 1])
    curve(
      o,
      Array.from({ length: 13 }, (_, j) => {
        const t = j / 12;
        return [
          x + sign * (-3.6 + 7.2 * t),
          7.7 + 2.3 * Math.sin(Math.PI * t),
          z + 0.6 - 0.6 * Math.sin(Math.PI * t),
        ];
      }),
      0.22,
    );
  for (const [y, w, h] of [
    [9.8, 3.7, 5.6],
    [15.3, 2.2, 4.7],
    [19.5, 1.2, 2.3],
  ]) {
    archTrim(o, x, y, z + 0.05, w, h, d, true, 0.2);
    reliefStatue(o, x, y + 0.5, z + 0.15, h * 0.62, d);
  }
  for (const sign of [-1, 1])
    for (const [y, w] of [
      [6.8, 2.8],
      [11.5, 3.0],
      [16.2, 2.8],
    ]) {
      const xx = x + sign * w;
      B(o, 'trim', xx, y, z + 0.25, 0.9, 0.15, 0.8, pale);
      archTrim(o, xx, y + 0.25, z, 0.65, 2.2, d, true, 0.14);
      reliefStatue(o, xx, y + 0.4, z + 0.2, 1.45, d);
      cone(o, xx, y + 2.5, z, 0.55, 0.7, d);
    }
  pin(o, x, 22.0, z, 3.6, d);
  cross(o, x, 25.4, z, 0.9, d);
}
function foundation(o, d) {
  prism(o, 'foundation', base, -8.25, 1.2, stone);
  if (d === 0) return;
  const western = ring(frame.geometry.holes[0]);
  cap(o, 'paving', western, 1.225, paving);
  if (d >= 2) {
    const lawn = [
      [-189, -95],
      [-78, -94],
      [-78, -46],
      [-189, -46],
    ];
    cap(o, 'garden', lawn, 1.24, grass);
    for (const z of [-93, -45])
      beam(o, 'paving', [-190, 1.26, z], [-76, 1.26, z], 2.0, 0.06, paving);
    beam(o, 'paving', [-134, 1.26, -97], [-134, 1.26, -41], 2.1, 0.06, paving);
  }
}
export function jeronimosMonastery(o, _frame = frame, d = 3) {
  foundation(o, d);
  westWing(o, d);
  cloister(o, d);
  northernRooms(o, d);
  nave(o, d);
}
function simpleGable(o, x, z, w, depth, eave, rise, alongX = true) {
  const map = ([a, y, b]) => (alongX ? [x + b, y, z + a] : [x + a, y, z + b]);
  for (const sign of [-1, 1])
    quad(
      o,
      'roof',
      [
        [(sign * w) / 2, eave, -depth / 2],
        [(sign * w) / 2, eave, depth / 2],
        [0, eave + rise, depth / 2],
        [0, eave + rise, -depth / 2],
      ].map(map),
      tile,
      [0, 1, 0],
    );
  for (const sign of [-1, 1])
    tri(
      o,
      'roof',
      [
        [-w / 2, eave, (sign * depth) / 2],
        [w / 2, eave, (sign * depth) / 2],
        [0, eave + rise, (sign * depth) / 2],
      ].map(map),
      tile,
    );
}
function simplifiedCloster(o, d) {
  const east = cropped(native(main), -42.5, -150, 50, -19);
  for (const p of east) if (p.length > 1) p[1] = [...gallery, gallery[0]];
  body(o, east, 2.65, 12.3, 0);
  cap(o, 'stone', gallery, 2.65, stone);
  cap(o, 'garden', court, 2.67, grass);
  if (d === 0) return;
  for (const y of [7.45, 12.15]) {
    cap(o, 'stone', gallery, y, stone, [0, 1, 0], [court]);
    for (let i = 0; i < court.length; i++) {
      const a = court[i],
        b = court[(i + 1) % court.length];
      quad(
        o,
        'stone',
        [
          [a[0], y - 0.2, a[1]],
          [b[0], y - 0.2, b[1]],
          [b[0], y, b[1]],
          [a[0], y, a[1]],
        ],
        stone,
        outward(court, i).map((v) => -v),
      );
    }
  }
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = len > 20 ? 5 : 1;
    for (let j = 0; j < count; j++) {
      const t = j / count,
        x = a[0] + t * (b[0] - a[0]),
        z = a[1] + t * (b[1] - a[1]);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2,
          b = ((k + 1) * Math.PI) / 2;
        quad(
          o,
          'stone',
          [
            [x + 0.5657 * Math.cos(a), 2.65, z + 0.5657 * Math.sin(a)],
            [x + 0.5657 * Math.cos(b), 2.65, z + 0.5657 * Math.sin(b)],
            [x + 0.5657 * Math.cos(b), 12.3, z + 0.5657 * Math.sin(b)],
            [x + 0.5657 * Math.cos(a), 12.3, z + 0.5657 * Math.sin(a)],
          ],
          stone,
        );
      }
    }
  }
}
export function jeronimosMonasterySkyline(o) {
  cap(o, 'foundation', base, 1.2, stone);
  const skirt = base;
  for (let i = 0; i < skirt.length; i++) {
    const a = skirt[i],
      b = skirt[(i + 1) % skirt.length];
    quad(
      o,
      'foundation',
      [
        [a[0], -8.25, a[1]],
        [b[0], -8.25, b[1]],
        [b[0], 1.2, b[1]],
        [a[0], 1.2, a[1]],
      ],
      stone,
      outward(skirt, i),
    );
  }
  body(o, cropped(native(main), -240, -125, -145.75, 0), 1.2, 18.2, 0);
  body(o, cropped(native(main), -145.75, -125, -124.4, 0), 1.2, 21.6, 0);
  body(o, cropped(native(main), -124.4, -125, -42.5, 0), 1.2, 18.2, 0);
  for (const [x, z, w, depth, eave, rise, along] of [
    [-183, -15, 14, 76, 18.2, 5.3, true],
    [-84, -15, 14, 76, 18.2, 5.3, true],

    [-130, -109, 13, 145, 18.2, 4.9, true],
    [-205, -66, 14, 78, 18.2, 4.9, false],
  ])
    simpleGable(o, x, z, w, depth, eave, rise, along);
  for (const [x0, z0, x1, z1, eave, rise] of [
    [-145.75, -38.6, -124.4, -4.7, 21.6, 4.4],
    [-145.75, -119.5, -124.4, -99.1, 21.6, 4.4],
  ])
    hip(
      o,
      [
        [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
          [x0, z0],
        ],
      ],
      x0,
      z0,
      x1,
      z1,
      eave,
      rise,
    );
  for (const [x0, x1] of [
    [-200.3, -185.9],
    [-157.8, -145.75],
    [-124.4, -111],
    [-83.5, -68.8],
    [-58.1, -51.5],
  ])
    simpleGable(o, (x0 + x1) / 2, -27, x1 - x0, 16, 18.2, 4, false);
  for (const [x, z] of dormitoryTurrets)
    lathe(
      o,
      'stone',
      x,
      z,
      [
        [1.2, 2.8],
        [26.8, 3.465],
        [36.6, 0.025],
      ],
      4,
      stone,
    );
  simplifiedCloster(o, 0);
  for (const suffix of ['52776569451127', '52776569451126', '52776569451128']) {
    const p = part(suffix),
      r = simplify(ring(p.outline), 1.3);
    prism(o, 'stone', r, 1.2, suffix.endsWith('128') ? 16.1 : 11.4, stone);
  }
  for (const [x, z, w, h, depth] of [
    [0, -13.4, 39.87, 22.9, 26.82],
    [-25.3, -13, 10.5, 22.9, 29.3],
    [32.3, -13.3, 24.8, 23.9, 35.4],
    [32, 9.3, 14.3, 15.6, 10.3],
    [54.5, -13.5, 20, 19.3, 17],
  ])
    B(o, 'stone', x, 1.2, z, w, h, depth, stone);
  simpleGable(o, 0, -13.4, 26.8, 39.8, 24.1, 2, true);
  for (const [x0, z0, x1, z1, eave, rise] of [
    [19.93, -31, 44.9, 4.41, 25.1, 4.3],
    [24.8, 4.14, 39.2, 14.48, 16.8, 3.4],
  ])
    hip(
      o,
      [
        [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
          [x0, z0],
        ],
      ],
      x0,
      z0,
      x1,
      z1,
      eave,
      rise,
    );
  simpleGable(o, 54.5, -13.5, 17, 20, 20.5, 3.6, true);
  B(o, 'stone', -25.3, 24.1, -4, 10.2, 12, 10.2, stone);
  lathe(
    o,
    'stone',
    -25.3,
    -4,
    [
      [36.1, 5.35],
      [39.4, 4.6],
      [42.6, 2.1],
      [43.8, 0.25],
      [46, 0.06],
    ],
    8,
    stone,
  );
}
export function jeronimosMonasteryDistrict(o) {
  foundation(o, 0);
  westWing(o, 1);
  simplifiedCloster(o, 1);
  northernRooms(o, 0);
  nave(o, 0);
}
export function jeronimosMonasteryStreet(o) {
  foundation(o, 1);
  westWing(o, 1, 2);
  cloister(o, 1, 2);
  northernRooms(o, 0);
  nave(o, 2);
}
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.93, metallic: 0 },
  recess: { slot: 'window', localRef: ref, roughness: 0.95, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  garden: { slot: 'foundation', localRef: 'palette:#fffefd', roughness: 1, metallic: 0 },
};
export const jeronimosMonasteryModel = {
  id: 'jeronimos_monastery',
  key: 'jeronimos_monastery',
  recipe: 'structure-jeronimos-monastery.mjs',
  cell: 'ey/eyc',
  title: 'Jerónimos Monastery',
  brief:
    'Native connected monastery ensemble with integral west dormitory/museum facade, eleven normal bays each side of a central three-bay pavilion, recessed lower arcade glazing, tall upper windows and pitched terracotta roofs. Four slender crocketed dormitory turrets in front/rear end pairs and a separate broad stone-domed church campanile. True open two-storey chamfered cloister, triple lower shafts/paired upper lights, medallion parapets and conical pinnacles; lawn, paths and low circular fountain. Church Latin-cross mass, giant pointed south windows, projecting tiered sculptural south portal, pierced roof rail, distinct rear/chancel roofs, attached northern monastic rooms and separate large western court.',
  camera: [200, 160, 260],
  lookAt: [-80, 11, -55],
  portableGroundY: -0.15,
  qaCameras: [
    { name: 'south-full-facade', position: [-100, 70, 260], lookAt: [-88, 12, -12] },
    { name: 'church-south-portal', position: [27, 22, 62], lookAt: [5, 13, 0] },
    { name: 'church-bell-dome', position: [-74, 46, 48], lookAt: [-34, 29, -10] },
    { name: 'western-entrance', position: [-135, 18, 47], lookAt: [-135, 12, -12] },
    { name: 'main-cloister', position: [-11, 18, -45], lookAt: [9, 7, -64] },
    { name: 'cloister-tracery', position: [1, 6, -53], lookAt: [-19, 6, -56] },
    { name: 'west-paired-turrets', position: [-268, 44, 18], lookAt: [-228, 24, -16] },
    { name: 'western-court', position: [-120, 65, -80], lookAt: [-135, 10, -25] },
    { name: 'north-roofs-overhead', position: [-70, 265, -180], lookAt: [-80, 5, -70] },
  ],
  mediumFiContext: {
    scale: 1.02,
    groundY: 0.04,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: base,
    basis:
      'Exact native connected ensemble outline. Physical model-owned foundation and both court floors cover the clipped area. Original provider field stays unchanged; no footprint is replaced or terrain flattening applied.',
  },
  build: jeronimosMonastery,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original512m Terrarium field frozen before geometry,2original tiles and263169samples. External south footway datum12.4954m defines Y=0. Physical court floors and building heights are photographic estimates; provider roof/vegetation contamination remains explicit.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-jeronimos-monastery.mjs',
    level: 'skyline',
    export: 'jeronimosMonasterySkyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'jeronimosMonasteryDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'jeronimosMonasteryStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'All vertical dimensions, roof pitches and facade positions within native plan limits are photographic interpretations, not measured drawings. Fine statuary, inscriptions and dense carved foliage are generalized.',
    'Principal cloister galleries have real openings; interior monastic rooms and exhibitions are not represented. No navigable collision or survey-quality archaeological/architectural reconstruction.',
    'Two source terrain PNGs/263169derived heights remain unchanged. Composite urban DEM may include roofs or vegetation;1m sample spacing is not survey accuracy and default coarse terrain is not automatically certified.',
  ],
};
