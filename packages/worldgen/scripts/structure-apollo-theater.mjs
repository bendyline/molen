/** Apollo Theater's dated Harlem frontage, blade sign and native L-shaped auditorium envelope. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, slot, p, n, c) {
  if (normalFor(...p).reduce((v, a, i) => v + a * n[i], 0) < 0) p = [...p].reverse();
  rawQuad(o, slot, p, n, c);
}
function transform(o, a, x = 0, z = 0) {
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
function poly(o, slot, ps, y0, y1, col) {
  const p = ps.map((v) => v.slice());
  if (
    p.reduce(
      (a, v, i) => a + v[0] * p[(i + 1) % p.length][1] - v[1] * p[(i + 1) % p.length][0],
      0,
    ) < 0
  )
    p.reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    quad(
      o,
      slot,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  const ids = earcut(p.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const ps = ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]);
      if (normalFor(...ps)[1] * n[1] < 0) ps.reverse();
      o.addTriangle(
        slot,
        ref,
        ps,
        n,
        ps.map((p) => [p[0], p[2]]),
        col,
      );
    }
}
function strip(o, slot, a, b, w, col, n = [0, 0, 1]) {
  const v = b.map((p, i) => p - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    l = Math.hypot(...q);
  if (l < 1e-8) return;
  const u = q.map((v) => (v * w) / l / 2),
    ps = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, slot, ps, normalFor(...ps), col);
  if (slot === 'metal' || slot === 'stone') {
    const back = [...ps].reverse();
    quad(o, slot, back, normalFor(...back), col);
  }
}
function rod(o, d, slot, a, b, w, col, n) {
  if (d > 1) beam(o, slot, a, b, w, w, col);
  else strip(o, slot, a, b, w, col, n);
}
const frame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dr/dr7/apollo_theater/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  white = rgb('e5e0ce'),
  trim = rgb('d2cbb4'),
  brick = rgb('978675'),
  roofgrey = rgb('676b68'),
  dark = rgb('383c3c'),
  glass = rgb('596c6a'),
  yellow = rgb('d7bf72'),
  screen = rgb('c4c9c0'),
  red = rgb('a33028'),
  neon = rgb('f06035'),
  blue = rgb('315caa'),
  steel = rgb('a3aaa5'),
  W = 15.30922;
function flat(o, slot, p, col, n = [0, 0, 1]) {
  const ids = earcut(p.flatMap((v) => [v[0], v[1]]));
  for (let i = 0; i < ids.length; i += 3) {
    let ps = ids.slice(i, i + 3).map((j) => p[j]);
    if (normalFor(...ps).reduce((s, v, k) => s + v * n[k], 0) < 0) ps = ps.reverse();
    o.addTriangle(
      slot,
      ref,
      ps,
      n,
      ps.map((v) => [v[0], v[1]]),
      col,
    );
  }
}
function clip(ps, z, front) {
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      A = front ? a[1] >= z : a[1] <= z,
      C = front ? b[1] >= z : b[1] <= z;
    if (A) out.push(a);
    if (A !== C) {
      const t = (z - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), z]);
    }
  }
  return out;
}
function envelope(o, d) {
  const p = frame.geometry.outline;
  poly(o, 'trim', p, -3, 0.4, trim);
  // The street wall is authored separately with real window/entrance recesses.
  for (let i = 1; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    quad(
      o,
      'brick',
      [
        [a[0], 0.4, a[1]],
        [b[0], 0.4, b[1]],
        [b[0], 15.8, b[1]],
        [a[0], 15.8, a[1]],
      ],
      n,
      brick,
    );
  }
  poly(o, 'roof', p, 15.65, 15.8, roofgrey);
  const rear = clip(p, -17, false),
    high = clip(p, -35.4, false);
  poly(o, 'brick', rear, 15.8, 18.5, brick);
  poly(o, 'roof', rear, 18.5, 18.7, roofgrey);
  poly(o, 'brick', high, 18.7, 19.8, brick);
  poly(o, 'roof', high, 19.8, 20, roofgrey);
  if (d > 0) {
    B(o, 'metal', -2, 15.8, -8, 3.2, 0.8, 4, dark);
    B(o, 'metal', 1, 18.7, -28, 3.1, 0.7, 5, steel);
    B(o, 'brick', 17, 20, -51, 6.4, 1.3, 6.7, brick);
    B(o, 'roof', 17, 21.3, -51, 6.7, 0.18, 7, roofgrey);
    if (d > 1)
      for (let z = -10; z > -58; z -= 5.5) {
        B(o, 'metal', -8.7, 15.8, z, 0.16, 0.38, 0.16, dark);
        B(o, 'roof', -1.6, 15.82, z, 11, 0.025, 0.045, roofgrey);
      }
  }
}
function wall(o, d) {
  const ops = [];
  for (const x of [-5.48, -1.825, 1.825, 5.48])
    for (const y of [5.7, 10.7]) ops.push({ x, y, w: 2.65, h: 3.55 });
  ops.push({ x: -3.76, y: 0.4, w: 6.65, h: 3.35, door: true });
  ops.push({ x: 3.78, y: 0.4, w: 6.55, h: 3.35, shop: true });
  const xs = [-W / 2, W / 2, ...ops.flatMap((a) => [a.x - a.w / 2, a.x + a.w / 2])].sort(
      (a, b) => a - b,
    ),
    ys = [0.4, 15.8, ...ops.flatMap((a) => [a.y, a.y + a.h])].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const a = xs[i - 1],
        b = xs[i],
        y = ys[j - 1],
        h = ys[j] - y;
      if (
        b - a < 1e-7 ||
        h < 1e-7 ||
        ops.some(
          (v) =>
            (a + b) / 2 > v.x - v.w / 2 &&
            (a + b) / 2 < v.x + v.w / 2 &&
            y + h / 2 > v.y &&
            y + h / 2 < v.y + v.h,
        )
      )
        continue;
      quad(
        o,
        'trim',
        [
          [a, y, 0],
          [b, y, 0],
          [b, y + h, 0],
          [a, y + h, 0],
        ],
        [0, 0, 1],
        white,
      );
    }
  for (const a of ops) {
    const x0 = a.x - a.w / 2,
      x1 = a.x + a.w / 2,
      y0 = a.y,
      y1 = a.y + a.h,
      z = a.door ? -1.5 : a.shop ? -0.35 : -0.48;
    for (const [p, n] of [
      [
        [
          [x0, y0, 0],
          [x0, y0, z],
          [x0, y1, z],
          [x0, y1, 0],
        ],
        [1, 0, 0],
      ],
      [
        [
          [x1, y0, z],
          [x1, y0, 0],
          [x1, y1, 0],
          [x1, y1, z],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [x0, y1, 0],
          [x0, y1, z],
          [x1, y1, z],
          [x1, y1, 0],
        ],
        [0, -1, 0],
      ],
      [
        [
          [x0, y0, z],
          [x0, y0, 0],
          [x1, y0, 0],
          [x1, y0, z],
        ],
        [0, 1, 0],
      ],
    ])
      quad(o, 'trim', p, n, trim);
    quad(
      o,
      'glass',
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      [0, 0, 1],
      glass,
    );
    if (d === 0) continue;
    for (const x of [x0, x1]) B(o, 'metal', x, y0, z + 0.04, 0.06, a.h, 0.08, dark);
    const transom = a.door ? 3.08 : a.shop ? 2.85 : y0 + 2.65;
    B(o, 'metal', a.x, transom, z + 0.04, a.w, 0.07, 0.08, steel);
    if (a.door || a.shop) {
      const leaves = a.door ? 4 : 3;
      for (let i = 1; i < leaves; i++)
        B(o, 'metal', x0 + (a.w * i) / leaves, y0, z + 0.045, 0.075, a.h, 0.09, steel);
      if (a.door && d > 1)
        for (let i = 0; i < 4; i++)
          B(o, 'metal', x0 + (a.w * (i + 0.5)) / 4 + 0.3, 1.15, z + 0.1, 0.04, 0.6, 0.08, steel);
    } else {
      for (const x of [x0 - 0.06, x1 + 0.06])
        B(o, 'trim', x, y0 - 0.1, 0.045, 0.13, a.h + 0.2, 0.16, trim);
      for (const y of [y0 - 0.12, y1 + 0.02])
        B(o, 'trim', a.x, y, 0.06, a.w + 0.3, 0.13, 0.22, trim);
    }
  }
  // Ground entrance piers and the eastern same-building shop fascia.
  for (const x of [-7.35, 0, 7.35]) B(o, 'trim', x, 0.4, 0.05, 0.45, 3.65, 0.45, trim);
  B(o, 'metal', 3.78, 3.85, 0.1, 7.1, 1.13, 0.2, yellow);
  if (d > 0) word(o, d, 'APOLLO', 3.78, 3.99, 0.215, 6.5, 0.84, red, false, true);
  for (const x of [-7.35, -3.65, 0, 3.65, 7.35]) {
    const central = Math.abs(x) < 7,
      base = 5.25,
      top = 14.65;
    B(o, 'trim', x, base, 0.12, central ? 0.68 : 0.64, top - base, 0.34, white);
    if (d > 0) {
      B(o, 'trim', x, 5.05, 0.18, central ? 0.92 : 0.85, 0.24, 0.5, trim);
      B(o, 'trim', x, 14.62, 0.2, central ? 1.05 : 0.85, 0.28, 0.5, trim);
    }
    if (d > 0 && central) {
      const count = d === 1 ? 3 : d === 2 ? 5 : 7;
      for (let j = 0; j < count; j++) {
        const u = x - 0.27 + (0.54 * j) / (count - 1);
        // Narrow recessed strips read as the fluted face under shared materials.
        B(o, 'trim', u, 5.55, 0.299, 0.029, 8.65, 0.022, trim);
      }
      for (const s of [-1, 1]) {
        const n = d === 1 ? 5 : d === 2 ? 10 : 18;
        for (let k = 1; k <= n; k++) {
          const a = ((k - 1) / n) * Math.PI * 2,
            b = (k / n) * Math.PI * 2;
          rod(
            o,
            d,
            'trim',
            [x + s * 0.34 + Math.cos(a) * 0.14, 14.76 + Math.sin(a) * 0.13, 0.48],
            [x + s * 0.34 + Math.cos(b) * 0.14, 14.76 + Math.sin(b) * 0.13, 0.48],
            0.045,
            trim,
          );
        }
      }
    }
  }
  for (const y of d === 0 ? [5.05, 15.55] : [5.05, 9.45, 10.25, 15.1, 15.55])
    B(o, 'trim', 0, y, 0.095, W, 0.15, 0.3, trim);
  if (d > 0)
    for (const x of [-5.48, -1.825, 1.825, 5.48]) {
      B(o, 'trim', x, 9.62, 0.13, 2.65, 0.45, 0.16, white);
      B(o, 'trim', x, 9.56, 0.23, 0.43, 0.57, 0.15, trim);
      if (d > 1) {
        const shield = [
          [x - 0.17, 9.99, 0.33],
          [x + 0.17, 9.99, 0.33],
          [x + 0.15, 9.73, 0.33],
          [x, 9.62, 0.33],
          [x - 0.15, 9.73, 0.33],
        ];
        flat(o, 'trim', shield, white);
        for (let u = -1.1; u <= 1.1; u += 0.14)
          if (Math.abs(u) > 0.28) B(o, 'trim', x + u, 9.66, 0.24, 0.025, 0.34, 0.026, trim);
        // Original simple meander relief above the top windows.
        for (let u = -1.12; u < 1.2; u += 0.32) {
          for (const [du, y, w, h] of [
            [0, 14.48, 0.27, 0.035],
            [0.12, 14.3, 0.035, 0.2],
            [-0.08, 14.29, 0.2, 0.035],
            [-0.17, 14.29, 0.035, 0.12],
          ])
            B(o, 'trim', x + u + du, y, 0.12, w, h, 0.04, trim);
        }
      }
    }
  B(o, 'trim', 0, 15.83, 0.18, W + 0.42, 0.3, 0.85, white);
  B(o, 'trim', 0, 16.14, 0.1, W + 0.6, 0.17, 1, white);
  if (d > 0)
    for (let x = -7.22; x < 7.3; x += d === 1 ? 0.9 : 0.49)
      B(o, 'trim', x, 15.48, 0.24, 0.21, 0.36, 0.53, trim);
  // Open parapet: paired baluster groups separated by raised panel piers.
  B(o, 'trim', 0, 16.33, 0.02, W, 0.14, 0.38, trim);
  B(o, 'trim', 0, 17.23, 0.02, W + 0.16, 0.15, 0.45, trim);
  for (const x of [-7.28, -3.65, 0, 3.65, 7.28]) {
    B(o, 'trim', x, 16.45, 0.02, 0.65, 0.78, 0.35, white);
    if (d > 1) B(o, 'trim', x, 16.57, 0.212, 0.45, 0.48, 0.035, trim);
  }
  for (let i = 0; i < 4; i++) {
    const x = -5.48 + i * 3.65,
      n = d === 0 ? 2 : d === 1 ? 4 : 7;
    for (let j = 0; j < n; j++) {
      const u = x - 1.25 + (2.5 * (j + 0.5)) / n;
      if (d < 2) rod(o, 1, 'trim', [u, 16.47, 0.04], [u, 17.23, 0.04], 0.09, white);
      else {
        B(o, 'trim', u, 16.47, 0.02, 0.15, 0.12, 0.2, white);
        B(o, 'trim', u, 16.59, 0.02, 0.1, 0.48, 0.13, white);
        B(o, 'trim', u, 17.07, 0.02, 0.16, 0.16, 0.2, white);
      }
    }
  }
}
function oval(cx, cy, rx, ry, n) {
  return Array.from({ length: n }, (_, i) => [
    cx + rx * Math.cos((i * Math.PI * 2) / n),
    cy + ry * Math.sin((i * Math.PI * 2) / n),
  ]);
}
function letterPaths(char, n) {
  if (char === 'O')
    return { outer: oval(0.5, 0.5, 0.5, 0.5, n), holes: [oval(0.5, 0.5, 0.31, 0.32, n)] };
  if (char === 'A')
    return {
      outer: [
        [0, 0],
        [0.33, 1],
        [0.67, 1],
        [1, 0],
        [0.77, 0],
        [0.66, 0.28],
        [0.34, 0.28],
        [0.23, 0],
      ],
      holes: [
        [
          [0.41, 0.47],
          [0.59, 0.47],
          [0.5, 0.76],
        ],
      ],
    };
  if (char === 'L')
    return {
      outer: [
        [0, 0],
        [1, 0],
        [1, 0.19],
        [0.24, 0.19],
        [0.24, 1],
        [0, 1],
      ],
      holes: [],
    };
  const arc = Array.from({ length: n / 2 + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / (n / 2);
    return [0.5 + 0.49 * Math.cos(a), 0.69 + 0.31 * Math.sin(a)];
  });
  const inner = Array.from({ length: n / 2 + 1 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / (n / 2);
    return [0.5 + 0.27 * Math.cos(a), 0.69 + 0.15 * Math.sin(a)];
  });
  return {
    outer: [[0, 0], [0.22, 0], [0.22, 0.38], ...arc, [0, 1]],
    holes: [[[0.24, 0.54], ...inner, [0.24, 0.84]]],
  };
}
function glyph(o, d, ch, x, y, z, w, h, col, tubing = true, outlineOnly = false) {
  const { outer, holes } = letterPaths(ch, d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 24 : 40),
    rings = [outer, ...holes],
    pts = rings.flat(),
    ids = earcut(pts.flat(), holes.length ? [outer.length] : []),
    depth = d > 1 ? 0.055 : 0.025;
  const p = (v, zz) => [x + v[0] * w, y + v[1] * h, zz];
  if (outlineOnly) {
    for (const r of rings)
      for (let i = 0; i < r.length; i++)
        strip(o, 'sign', p(r[i], z), p(r[(i + 1) % r.length], z), 0.012, col);
    return;
  }
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((j) => p(pts[j], z));
    if (normalFor(...q)[2] < 0) q.reverse();
    o.addTriangle(
      'sign',
      ref,
      q,
      [0, 0, 1],
      q.map((v) => [v[0], v[1]]),
      col,
    );
  }
  if (d > 1)
    for (const r of rings)
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length];
        quad(
          o,
          'sign',
          [p(a, z - depth), p(b, z - depth), p(b, z), p(a, z)],
          normalFor(p(a, z - depth), p(b, z - depth), p(b, z)),
          col,
        );
      }
  if (d > 1 && tubing) {
    for (const r of rings) {
      const cx = r.reduce((s, p) => s + p[0], 0) / r.length,
        cy = r.reduce((s, p) => s + p[1], 0) / r.length;
      for (const t of d === 3 ? [0.04, 0.11] : [0.07])
        for (let i = 0; i < r.length; i++) {
          const a = r[i].map((v, k) => v * (1 - t) + [cx, cy][k] * t),
            b = r[(i + 1) % r.length].map((v, k) => v * (1 - t) + [cx, cy][k] * t);
          strip(o, 'sign', p(a, z + 0.012), p(b, z + 0.012), 0.014, neon);
        }
    }
  }
}
function word(o, d, text, cx, y, z, w, h, col, tubing = true, outlineOnly = false) {
  const pitch = w / text.length;
  for (let i = 0; i < text.length; i++)
    glyph(
      o,
      d,
      text[i],
      cx - w / 2 + i * pitch + 0.08 * pitch,
      y,
      z,
      0.79 * pitch,
      h,
      col,
      tubing,
      outlineOnly,
    );
}
function marquee(o, d) {
  if (d === 0) {
    B(o, 'metal', -3.77, 3.55, 2.25, 7.45, 1.43, 4.5, steel);
    for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
      const q = transform(o, a, -3.77 + (Math.sin(a) * 7.45) / 2, 2.25 + Math.cos(a) * 2.25),
        w = a === 0 ? 7.45 : 4.5;
      quad(
        q,
        'sign',
        [
          [-w / 2 + 0.1, 3.88, 0.02],
          [w / 2 - 0.1, 3.88, 0.02],
          [w / 2 - 0.1, 4.8, 0.02],
          [-w / 2 + 0.1, 4.8, 0.02],
        ],
        [0, 0, 1],
        screen,
      );
      for (const y of [3.75, 4.94])
        quad(
          q,
          'sign',
          [
            [-w / 2, y, 0.03],
            [w / 2, y, 0.03],
            [w / 2, y + 0.04, 0.03],
            [-w / 2, y + 0.04, 0.03],
          ],
          [0, 0, 1],
          blue,
        );
      if (a !== 0) {
        flat(
          q,
          'sign',
          [
            [-1.77, 5.02, -0.06],
            [1.77, 5.02, -0.06],
            [1.77, 5.8, -0.06],
            [1.6, 5.94, -0.06],
            [-1.6, 5.94, -0.06],
            [-1.77, 5.8, -0.06],
          ],
          yellow,
          [0, 0, -1],
        );
        flat(
          q,
          'sign',
          [
            [-1.77, 5.02, 0.04],
            [1.77, 5.02, 0.04],
            [1.77, 5.8, 0.04],
            [1.6, 5.94, 0.04],
            [-1.6, 5.94, 0.04],
            [-1.77, 5.8, 0.04],
          ],
          yellow,
        );
      }
    }
    return;
  }
  const x = -3.77,
    w = 7.45,
    dep = 4.5;
  B(o, 'metal', x, 3.55, dep / 2, w, 0.2, dep, dark);
  B(o, 'metal', x, 3.76, dep / 2, w, 1.18, dep, steel);
  for (const a of [0, Math.PI / 2, -Math.PI / 2]) {
    const q = transform(o, a, x + (Math.sin(a) * w) / 2, dep / 2 + (Math.cos(a) * dep) / 2),
      ww = a === 0 ? w : dep;
    B(q, 'sign', 0, 3.89, 0.035, ww - 0.2, 0.91, 0.05, screen);
    for (const y of [3.7, 3.79, 4.87, 4.98])
      B(q, 'sign', 0, y, 0.09, ww + 0.03, 0.045, 0.045, blue);
    for (const u of [-ww / 2 + 0.09, ww / 2 - 0.09])
      B(q, 'metal', u, 3.76, 0.12, 0.13, 1.24, 0.18, steel);
    if (a !== 0) {
      const wwcap = 3.55,
        cap = [
          [-wwcap / 2, 5.02],
          [wwcap / 2, 5.02],
          [wwcap / 2, 5.76],
          [wwcap / 2 - 0.12, 5.94],
          [-wwcap / 2 + 0.12, 5.94],
          [-wwcap / 2, 5.76],
        ];
      flat(
        q,
        'sign',
        cap.map((p) => [...p, 0.04]),
        yellow,
      );
      flat(
        q,
        'sign',
        cap.map((p) => [...p, -0.06]),
        yellow,
        [0, 0, -1],
      );
      for (let j = 0; j < cap.length; j++) {
        const a = cap[j],
          b = cap[(j + 1) % cap.length],
          ps = [
            [...a, -0.06],
            [...b, -0.06],
            [...b, 0.04],
            [...a, 0.04],
          ];
        quad(q, 'sign', ps, normalFor(...ps), yellow);
      }
      word(q, d, 'APOLLO', 0, 5.11, 0.075, 3.3, 0.67, red);
    }
  }
  if (d > 0) {
    const nx = d === 1 ? 8 : d === 2 ? 18 : 30,
      nz = d === 1 ? 4 : d === 2 ? 8 : 14;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++) {
        const xx = x - w / 2 + ((i + 0.5) * w) / nx,
          zz = ((j + 0.5) * dep) / nz;
        quad(
          o,
          'sign',
          [
            [xx - 0.025, 3.539, zz - 0.025],
            [xx + 0.025, 3.539, zz - 0.025],
            [xx + 0.025, 3.539, zz + 0.025],
            [xx - 0.025, 3.539, zz + 0.025],
          ],
          [0, -1, 0],
          rgb('f6d197'),
        );
      }
    for (const xx of [x - w / 2 + 0.25, x + w / 2 - 0.25])
      rod(o, d, 'metal', [xx, 6.25, -0.03], [xx, 4.99, 4.12], 0.045, steel);
  }
}
function blade(o, d) {
  const x = -3.65,
    cz = 1.25,
    ww = 2.12,
    y0 = 9.8,
    top = 25.2;
  B(o, 'sign', x, y0, cz, 0.22, top - y0, ww, yellow);
  for (const s of [-1, 1]) {
    const q = transform(o, (s * Math.PI) / 2, x + s * 0.125, cz);
    // Reading direction changes with the face normal; the same six letters read from either sidewalk.
    for (let i = 0; i < 6; i++)
      glyph(q, d, 'APOLLO'[i], -0.75, 22.68 - i * 2.4, 0.02, 1.5, 1.95, red);
    for (const u of [-ww / 2, ww / 2]) B(q, 'metal', u, y0, 0.015, 0.055, top - y0, 0.055, white);
    for (const yy of [y0, top - 0.04]) B(q, 'metal', 0, yy, 0.015, ww, 0.045, 0.06, white);
    if (d > 0)
      for (let i = 1; i < 6; i++)
        B(q, 'sign', 0, y0 + (i * (top - y0)) / 6, 0.016, ww, 0.018, 0.018, trim);
  }
  // Three open braced tiers behind the board. Roof and bracket do not fill the gaps.
  const back = -3.8,
    front = 0.16,
    low = 17.4;
  for (const xx of [x - 0.48, x + 0.48]) {
    for (const z of [back, front])
      rod(o, d, 'metal', [xx, low, z], [xx, 25, z], 0.095, dark, [1, 0, 0]);
    for (let j = 0; j <= 3; j++) {
      const yy = low + (j * (25 - low)) / 3;
      rod(o, d, 'metal', [xx, yy, back], [xx, yy, front], 0.095, dark, [1, 0, 0]);
      if (j < 3)
        for (const s of [-1, 1])
          rod(
            o,
            d,
            'metal',
            [xx, yy, s > 0 ? back : front],
            [xx, yy + (25 - low) / 3, s > 0 ? front : back],
            0.07,
            dark,
            [1, 0, 0],
          );
    }
    rod(o, d, 'metal', [xx, 10.2, 0.1], [xx, 6.3, -0.05], 0.07, dark, [1, 0, 0]);
    rod(o, d, 'metal', [xx, 10.2, 2.15], [xx, 6.3, -0.05], 0.075, dark, [1, 0, 0]);
    if (d > 0) rod(o, d, 'metal', [xx, 25, back], [xx, 15.9, -10.5], 0.018, dark, [1, 0, 0]);
  }
  if (d > 0)
    for (let j = 0; j <= 3; j++) {
      const yy = low + (j * (25 - low)) / 3;
      for (const z of [back, front])
        rod(o, d, 'metal', [x - 0.48, yy, z], [x + 0.48, yy, z], 0.075, dark, [0, 0, 1]);
    }
}
function build(o, d) {
  envelope(o, d);
  wall(o, d);
  marquee(o, d);
  blade(o, d);
}
export const apolloTheater = (o) => build(o, 3),
  apolloTheaterStreet = (o) => build(o, 2),
  apolloTheaterDistrict = (o) => build(o, 1),
  apolloTheaterSkyline = (o) => build(o, 0);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.7, metallic: 0 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.62,
    metallic: 0.25,
    doubleSided: true,
  },
  glass: { slot: 'window', localRef: ref, roughness: 0.3, metallic: 0.12 },
  sign: { slot: 'trim', localRef: ref, roughness: 0.5, metallic: 0.1 },
};
export const apolloTheaterModel = {
  id: 'apollo_theater',
  key: 'apollo_theater',
  recipe: 'structure-apollo-theater.mjs',
  cell: 'dr/dr7',
  title: 'Apollo Theater',
  brief:
    'Dated2013–2019 Harlem Apollo: four-bay glazed white terracotta front/five colossal pilasters, two square/transomed window tiers and fluted shield/meander spandrels, deep modillion cornice/open baluster parapet. Recessed western entrance/four doors under half-width projecting marquee with blue bands, pale display panels, warm soffit bulbs and two short-side APOLLO caps. Eastern glazed shop/yellow APOLLO fascia belongs to same frontage. Two-sided pale-yellow APOLLO blade with original geometric red letters/counters/neon strokes, open three-tier black steel trestle/V bracket. Exact native L-shaped stepped auditorium roof envelope; neighboring buildings/new Victoria spaces excluded.',
  camera: [-61, 43, 73],
  lookAt: [3, 10, -20],
  qaCameras: [
    { name: 'front', position: [-22, 19, 35], lookAt: [0, 12, 0] },
    { name: 'front-detail', position: [7, 12, 21], lookAt: [1.8, 10, 0.1] },
    { name: 'entry-detail', position: [-1, 2.5, 10], lookAt: [-3.77, 1.9, -0.8] },
    { name: 'marquee-detail', position: [6, 5.5, 8], lookAt: [-2.5, 4.7, 2] },
    { name: 'sign-east-detail', position: [9, 20, 7], lookAt: [-3.65, 19, 1.25] },
    { name: 'sign-west-detail', position: [-15, 19, 6], lookAt: [-3.65, 19, 1.25] },
    { name: 'roof-detail', position: [-28, 40, -17], lookAt: [-1, 18, -24] },
    { name: 'back', position: [45, 28, -78], lookAt: [10, 10, -48] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -3 },
  build: apolloTheater,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'One unchanged original Terrarium tile/2m review grid, dry eastern125thStreet sidewalk[5.4,2.4] datum8.7256m. Fixed foundation-3m/internal floor.4m clears native broad footprint relief. No terrain flattening; unmeasured threshold/pavement remains proportional and host dataset compatibility is conditional.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-apollo-theater.mjs',
    level: 'skyline',
    export: 'apolloTheaterSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'apolloTheaterDistrict', errorMeters: 1, surfaces },
      street: { export: 'apolloTheaterStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Cornice/parapet17.38m, blade25.2m and rear roof20m are photo/aerial-proportioned estimates, not measured elevation drawings. Shared concrete graph approximates glazed terracotta; original opaque palette glazing/sign colors and geometric typography; event content omitted. Fine shield/anthemion/neon profiles, hidden roof equipment/side/rear walls and exact marquee curves are simplified.',
  ],
};
export { blade, marquee, wall };
