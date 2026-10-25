/** Restored four-domed pavilion and its complete surviving iron/concrete pier. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  tau = 2 * Math.PI,
  deck = 0.6,
  white = rgb('e8e6df'),
  green = rgb('3e6658'),
  iron = rgb('3b4943'),
  glass = rgb('657878'),
  roof = rgb('b0bcc0'),
  edge = rgb('87959b'),
  wood = rgb('9b9482'),
  cream = rgb('e0d8b6'),
  concrete = rgb('9b9c91');
const frame = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcj/penarth_pier/map-frame.json',
      import.meta.url,
    ),
  ),
);
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
function panel(o, s, x, y, z, w, h, c) {
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
function polygon(o, s, ring, y0, y1, c) {
  const r = ring.map((p) => p.slice());
  if (
    r.reduce(
      (n, p, i) => n + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      c,
    );
  }
  const ids = earcut(r.flat());
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]);
      if (normalFor(...p)[1] * n[1] < 0) p = p.reverse();
      o.addTriangle(
        s,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        c,
      );
    }
}
function roofFace(o, p, c = roof) {
  let n = normalFor(p[0], p[1], p[2]);
  if (n[1] < 0) {
    p = [...p].reverse();
    n = normalFor(p[0], p[1], p[2]);
  }
  if (p.length === 3)
    o.addTriangle(
      'roof',
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      c,
    );
  else quad(o, 'roof', p, n, c);
}
function strip(o, s, a, b, w, n, c) {
  const v = b.map((v, i) => v - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    len = Math.hypot(...q);
  if (len < 1e-8) return;
  const u = q.map((v) => (v * w) / len / 2);
  const points = [
    a.map((v, i) => v - u[i]),
    b.map((v, i) => v - u[i]),
    b.map((v, i) => v + u[i]),
    a.map((v, i) => v + u[i]),
  ];
  quad(o, s, points, normalFor(...points), c);
}
function line(o, d, s, a, b, w, c) {
  if (d === 3) beam(o, s, a, b, w, w, c);
  else strip(o, s, a, b, w, [0, 0, 1], c);
}
function windowWall(o, d, w, y0, y1, holes, slot = 'wall', col = white) {
  const xs = [-w / 2, w / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2])].sort(
      (a, b) => a - b,
    ),
    ys = [y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const x = (xs[i] + xs[i + 1]) / 2,
        y = (ys[j] + ys[j + 1]) / 2,
        ww = xs[i + 1] - xs[i],
        hh = ys[j + 1] - ys[j];
      if (
        ww < 0.001 ||
        hh < 0.001 ||
        holes.some((h) => Math.abs(x - h.x) < h.w / 2 - 0.00001 && y > h.y && y < h.y + h.h)
      )
        continue;
      panel(o, slot, x, ys[j], 0, ww, hh, col);
    }
  for (const h of holes) {
    panel(o, 'glass', h.x, h.y, -0.27, h.w, h.h, glass);
    if (d === 3) {
      for (const sign of [-1, 1]) {
        const x = h.x + (sign * h.w) / 2,
          y = h.y + (sign > 0 ? h.h : 0);
        quad(
          o,
          slot,
          [
            [x, h.y, 0],
            [x, h.y + h.h, 0],
            [x, h.y + h.h, -0.27],
            [x, h.y, -0.27],
          ],
          [-sign, 0, 0],
          col,
        );
        quad(
          o,
          slot,
          [
            [h.x - h.w / 2, y, 0],
            [h.x + h.w / 2, y, 0],
            [h.x + h.w / 2, y, -0.27],
            [h.x - h.w / 2, y, -0.27],
          ],
          [0, -sign, 0],
          col,
        );
      }
    }
    if (d) {
      if (d > 1)
        for (const sign of [-1, 1]) {
          B(
            o,
            'wall',
            h.x + sign * (h.w / 2 + 0.035),
            h.y - 0.05,
            0.02,
            0.07,
            h.h + 0.1,
            0.1,
            white,
          );
          B(o, 'wall', h.x, h.y + (sign > 0 ? h.h : 0), 0.02, h.w + 0.14, 0.07, 0.1, white);
        }
      if (!h.lattice) {
        const n = d === 3 ? Math.max(1, Math.round(h.w / 0.38)) : 1;
        for (let i = 1; i < n; i++)
          panel(o, 'iron', h.x - h.w / 2 + (h.w * i) / n, h.y, -0.19, 0.04, h.h, iron);
        for (let y = h.y + 0.65; y < h.y + h.h; y += d === 3 ? 0.65 : 1.3)
          panel(o, 'iron', h.x, y, -0.19, h.w, 0.035, iron);
      } else {
        const nx = d === 1 ? 2 : d === 2 ? 4 : 5;
        for (const sign of [-1, 1])
          for (let k = -nx; k <= nx; k++) {
            const x0 = h.x - h.w / 2 + (k * h.w) / nx,
              pts = [];
            for (const y of [h.y, h.y + h.h]) {
              const x = x0 + (sign * (y - h.y) * h.w) / h.h;
              if (x >= h.x - h.w / 2 - 0.00001 && x <= h.x + h.w / 2 + 0.00001)
                pts.push([x, y, -0.13]);
            }
            for (const x of [h.x - h.w / 2, h.x + h.w / 2]) {
              const y = h.y + (((x - x0) / sign) * h.h) / h.w;
              if (y > h.y && y < h.y + h.h) pts.push([x, y, -0.13]);
            }
            if (pts.length >= 2)
              strip(o, 'wall', pts[0], pts[1], d === 1 ? 0.065 : 0.085, [0, 0, 1], white);
          }
      }
    }
  }
}
function dome(o, d, cx, cz) {
  const n = [8, 12, 20, 32][d],
    profiles =
      d === 0
        ? [
            [11.15, 3.05],
            [12, 2.5],
            [13.7, 1.4],
            [14, 0.55],
          ]
        : [
            [11.15, 3.05],
            [11.35, 2.75],
            [11.8, 2.5],
            [12.65, 2.35],
            [13.35, 1.9],
            [13.85, 1.1],
            [14, 0.5],
          ],
    rings = profiles.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i * tau) / n;
        return [
          cx + r * Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.35),
          y,
          cz + r * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.35),
        ];
      }),
    );
  loft(o, 'zinc', rings, roof);
  B(o, 'zinc', cx, 14, cz, 1.3, 0.14, 1.3, roof);
  if (d) {
    B(o, 'zinc', cx, 14.14, cz, 0.65, 0.25, 0.65, roof);
    const q = facing(o, 0, cx, cz);
    for (const sign of [-1, 1]) {
      roofFace(
        q,
        [
          [sign * 0.4, 14.39, -0.4],
          [sign * 0.4, 14.39, 0.4],
          [0, 15.15, 0],
        ],
        roof,
      );
      roofFace(
        q,
        [
          [-0.4, 14.39, sign * 0.4],
          [0.4, 14.39, sign * 0.4],
          [0, 15.15, 0],
        ],
        roof,
      );
    }
  }
  if (d === 3)
    for (let j = 0; j < rings.length - 1; j++)
      for (let i = 0; i < n; i++) {
        const k = (i + 1) % n,
          a = rings[j][i],
          b = rings[j + 1][k],
          c = rings[j][k],
          nrm = normalFor(a, c, b);
        strip(
          o,
          'seam',
          a.map((v, k) => v + nrm[k] * 0.009),
          b.map((v, k) => v + nrm[k] * 0.009),
          0.014,
          nrm,
          edge,
        );
      }
}
function tower(o, d, cx, cz) {
  const q = facing(o, 0, cx, cz);
  for (let i = 0; i < 4; i++) {
    const v = facing(
        q,
        (i * Math.PI) / 2,
        Math.sin((i * Math.PI) / 2) * 2.3,
        Math.cos((i * Math.PI) / 2) * 2.3,
      ),
      holes = [{ x: 0, y: 7.8, w: 2.1, h: 2.35, lattice: true }];
    if (d > 0)
      for (const y of [1.8, 5.8])
        for (const x of [-0.62, 0.62]) holes.push({ x, y, w: 0.52, h: 1.0, lattice: true });
    windowWall(v, d, 4.6, deck, 10.8, holes);
    if (d > 1)
      for (const sign of [-1, 1]) B(v, 'wall', sign * 2.13, deck, -0.06, 0.24, 10.2, 0.34, white);
  }
  B(q, 'wall', 0, 10.75, 0, 6.35, 0.25, 6.35, white);
  if (d > 1)
    for (const sign of [-1, 1])
      for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) {
        B(q, 'wall', x, 10.4, sign * 2.7, 0.18, 0.36, 1, white);
        B(q, 'wall', sign * 2.7, 10.4, x, 1, 0.36, 0.18, white);
      }
  dome(o, d, cx, cz);
}
function barrel(o, d) {
  const centers = [-9, -3, 3, 9],
    ends = [-14.6, 14.6, ...centers.flatMap((x) => [x - 1.5, x + 1.5])].sort((a, b) => a - b),
    n = [8, 12, 20, 32][d],
    cut = Math.acos(3 / 7.2),
    angles = [
      ...Array.from({ length: n + 1 }, (_, i) => (i * Math.PI) / n),
      cut,
      Math.PI - cut,
    ].sort((a, b) => a - b),
    point = (x, t) => [x, 4.1 + 6.6 * Math.sin(t), 7.2 * Math.cos(t)];
  for (let j = 0; j < ends.length - 1; j++)
    for (let i = 0; i < angles.length - 1; i++) {
      const a = angles[i],
        b = angles[i + 1],
        x = (ends[j] + ends[j + 1]) / 2,
        z = 7.2 * Math.cos((a + b) / 2);
      if (d > 0 && centers.some((c) => Math.abs(x - c) < 1.5) && Math.abs(z) > 3) continue;
      roofFace(o, [
        point(ends[j], a),
        point(ends[j + 1], a),
        point(ends[j + 1], b),
        point(ends[j], b),
      ]);
    }
  B(o, 'zinc', 0, 10.7, 0, 29.2, 0.35, 0.75, roof);
  if (d)
    for (let x = -14.3; x < 14.4; x += d === 3 ? 0.65 : 2.0)
      for (const z of [-0.4, 0.4]) B(o, 'iron', x, 10.77, z, 0.32, 0.11, 0.03, iron);
  if (d > 0)
    for (const sign of [-1, 1])
      for (const x of centers) {
        const v = facing(o, sign < 0 ? Math.PI : 0, sign < 0 ? -x : x, sign * 7.35);
        windowWall(v, d, 3.0, 4.1, 9.65, [{ x: 0, y: 4.55, w: 2.2, h: 4.55 }]);
        for (const s of [-1, 1]) B(v, 'wall', s * 1.48, 4.1, 0, 0.18, 5.55, 0.3, white);
        const arch = [
          [-1.6, 9.55],
          [-1.3, 9.7],
          [-0.9, 10.0],
          [0, 10.12],
          [0.9, 10.0],
          [1.3, 9.7],
          [1.6, 9.55],
        ];
        const fill = [[-1.5, 9.55], [1.5, 9.55], ...arch.slice(1, -1).reverse()];
        const ids = earcut(fill.flat());
        for (let k = 0; k < ids.length; k += 3) {
          let pp = ids.slice(k, k + 3).map((j) => [fill[j][0], fill[j][1], 0.015]);
          if (normalFor(...pp)[2] < 0) pp = pp.reverse();
          v.addTriangle(
            'wall',
            ref,
            pp,
            [0, 0, 1],
            pp.map((p) => [p[0], p[1]]),
            white,
          );
        }
        for (let i = 0; i < arch.length - 1; i++) {
          const a = arch[i],
            b = arch[i + 1];
          strip(v, 'wall', [a[0], a[1], 0.12], [b[0], b[1], 0.12], 0.18, [0, 0, 1], white);
          roofFace(
            v,
            [
              [a[0], a[1], 0],
              [b[0], b[1], 0],
              [b[0], point(0, cut)[1], -4.35],
              [a[0], point(0, cut)[1], -4.35],
            ],
            roof,
          );
        }
        for (const s of [-1, 1]) {
          const cheek = [
            [4.1, 0],
            [9.6, 0],
            [point(0, cut)[1], -4.35],
            ...Array.from({ length: 7 }, (_, i) => {
              const p = point(0, cut * (1 - i / 6));
              return [p[1], p[2] - 7.35];
            }),
          ];
          const ids = earcut(cheek.flat());
          for (let k = 0; k < ids.length; k += 3) {
            let pp = ids.slice(k, k + 3).map((j) => [s * 1.5, cheek[j][0], cheek[j][1]]);
            if (normalFor(...pp)[0] * s < 0) pp = pp.reverse();
            v.addTriangle(
              'zinc',
              ref,
              pp,
              [s, 0, 0],
              pp.map((p) => [p[2], p[1]]),
              roof,
            );
          }
        }
      }
  if (d > 1) {
    for (let x = -14.6; x < 14.7; x += 29.2 / 10)
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n;
        const p = point(x, a),
          q = point(x, b);
        strip(
          o,
          'wall',
          p.map((v, j) => v + (j === 1 ? 0.025 : 0)),
          q.map((v, j) => v + (j === 1 ? 0.025 : 0)),
          0.11,
          [0, 1, 0],
          white,
        );
      }
  }
  if (d === 3)
    for (let row = 1; row < 26; row++) {
      const t = (row * Math.PI) / 26;
      for (let x = -14.3 + (row % 2) * 0.4; x < 14.4; x += 0.8) {
        const a = point(x, t),
          b = point(x + 0.38, t + 0.035),
          c = point(x + 0.76, t),
          nrm = [0, Math.sin(t), Math.cos(t)];
        if (centers.some((v) => Math.abs(x + 0.38 - v) < 1.7) && Math.abs(a[2]) > 4.4) continue;
        strip(
          o,
          'seam',
          a.map((v, j) => v + nrm[j] * 0.008),
          b.map((v, j) => v + nrm[j] * 0.008),
          0.012,
          nrm,
          edge,
        );
        strip(
          o,
          'seam',
          b.map((v, j) => v + nrm[j] * 0.008),
          c.map((v, j) => v + nrm[j] * 0.008),
          0.012,
          nrm,
          edge,
        );
      }
    }
}
function arc(o, d, s, r, y0, y1, col) {
  const n = [6, 10, 18, 30][d];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n,
      b = -Math.PI / 2 + ((i + 1) * Math.PI) / n,
      nm = [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)];
    quad(
      o,
      s,
      [
        [r * Math.sin(a), y0, r * Math.cos(a)],
        [r * Math.sin(b), y0, r * Math.cos(b)],
        [r * Math.sin(b), y1, r * Math.cos(b)],
        [r * Math.sin(a), y1, r * Math.cos(a)],
      ],
      nm,
      col,
    );
  }
}
function arcSlab(o, d, r, y0, y1, s = 'wall', col = white) {
  const n = [6, 10, 18, 30][d],
    ring = Array.from({ length: n + 1 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / n;
      return [r * Math.sin(a), r * Math.cos(a)];
    });
  polygon(o, s, ring, y0, y1, col);
}
function roundColumn(o, d, x, z, y0, y1, r, col = white) {
  if (d < 2) {
    B(o, 'wall', x, y0, z, r * 2, y1 - y0, r * 2, col);
    return;
  }
  const n = d === 3 ? 12 : 8,
    ring = (y, rr) =>
      Array.from({ length: n }, (_, i) => [
        x + rr * Math.cos((-i * tau) / n),
        y,
        z + rr * Math.sin((-i * tau) / n),
      ]);
  loft(
    o,
    'wall',
    [
      ring(y0, r * 1.25),
      ring(y0 + 0.13, r * 1.25),
      ring(y0 + 0.18, r),
      ring(y1 - 0.16, r * 0.92),
      ring(y1 - 0.14, r * 1.3),
      ring(y1, r * 1.3),
    ],
    col,
  );
}
function pod(o, d, sign) {
  const q = facing(o, (sign * Math.PI) / 2, sign * 16.4, 0),
    r = sign > 0 ? 6.3 : 4.9;
  arcSlab(q, d, r + 0.3, deck - 0.3, deck, 'wood', wood);
  if (sign > 0) arc(q, d, 'glass', r - 0.65, deck, 3.4, glass);
  else
    arcWindowWall(
      q,
      d,
      r - 0.65,
      deck,
      3.4,
      [-0.7, 0, 0.7].map((a) => ({ a, y: deck, w: 1.2, h: 2.4 })),
    );
  if (d)
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 9;
      roundColumn(q, d, r * Math.sin(a), r * Math.cos(a), deck, 3.4, 0.15);
      if (d > 1)
        B(
          facing(q, a, (r - 0.62) * Math.sin(a), (r - 0.62) * Math.cos(a)),
          'iron',
          0,
          deck,
          0,
          0.06,
          2.8,
          0.06,
          iron,
        );
    }
  arcSlab(q, d, r + 0.25, 3.4, 3.6);
  arc(q, d, 'wall', r + 0.25, 3.6, 4.08, white);
  if (d)
    for (let i = 0; i < 20; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 19;
      B(
        q,
        'iron',
        (r + 0.2) * Math.sin(a),
        4.06,
        (r + 0.2) * Math.cos(a),
        0.035,
        0.65,
        0.035,
        green,
      );
    }
  if (d) arc(q, d, 'metal', r + 0.2, 4.69, 4.73, green);
  arcWindowWall(
    q,
    d,
    r - 1.1,
    3.6,
    6.6,
    [-0.65, 0, 0.65].map((a) => ({ a, y: 4.05, w: 1, h: 1.95 })),
  );
  for (const a of [-0.65, 0, 0.65]) {
    const v = facing(q, a, (r - 1.1) * Math.sin(a), (r - 1.1) * Math.cos(a));
    if (d) for (const s of [-1, 1]) B(v, 'wall', s * 0.56, 4, 0.06, 0.08, 2.04, 0.12, white);
  }
  arcSlab(q, d, r - 1.0, 6.55, 6.75);
  arc(q, d, 'wall', r - 1, 6.75, 7.1, white);
  if (d)
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 17;
      B(q, 'iron', (r - 1) * Math.sin(a), 7.08, (r - 1) * Math.cos(a), 0.035, 0.6, 0.035, green);
    }
  if (sign > 0) {
    arc(q, d, 'glass', r - 2.15, 6.75, 9.25, glass);
    if (d)
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 11;
        B(
          q,
          'iron',
          (r - 2.12) * Math.sin(a),
          6.75,
          (r - 2.12) * Math.cos(a),
          0.06,
          2.5,
          0.06,
          iron,
        );
      }
    arcSlab(q, d, r - 1.8, 9.25, 9.45, 'zinc', roof);
  } else
    windowWall(q, d, 8.5, 6.75, 9.8, [
      { x: 0, y: 6.8, w: 1.1, h: 2.15 },
      { x: -2.5, y: 7.3, w: 1, h: 1.2 },
      { x: 2.5, y: 7.3, w: 1, h: 1.2 },
    ]);
}
function arcWindowWall(o, d, r, y0, y1, holes) {
  const n = [6, 10, 18, 30][d],
    angles = [
      ...Array.from({ length: n + 1 }, (_, i) => -Math.PI / 2 + (i * Math.PI) / n),
      ...holes.flatMap((h) => [h.a - h.w / (2 * r), h.a + h.w / (2 * r)]),
    ].sort((a, b) => a - b),
    ys = [y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])].sort((a, b) => a - b),
    point = (a, y, rr = r) => [rr * Math.sin(a), y, rr * Math.cos(a)];
  for (let i = 0; i < angles.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      const a = angles[i],
        b = angles[i + 1],
        mid = (a + b) / 2,
        y = (ys[j] + ys[j + 1]) / 2;
      if (
        b - a < 1e-6 ||
        ys[j + 1] - ys[j] < 1e-6 ||
        holes.some((h) => Math.abs(mid - h.a) < h.w / (2 * r) - 1e-6 && y > h.y && y < h.y + h.h)
      )
        continue;
      quad(
        o,
        'wall',
        [point(a, ys[j]), point(b, ys[j]), point(b, ys[j + 1]), point(a, ys[j + 1])],
        [Math.sin(mid), 0, Math.cos(mid)],
        white,
      );
    }
  for (const h of holes) {
    const a = h.a - h.w / (2 * r),
      b = h.a + h.w / (2 * r),
      nm = [Math.sin(h.a), 0, Math.cos(h.a)];
    quad(
      o,
      'glass',
      [
        point(a, h.y, r - 0.25),
        point(b, h.y, r - 0.25),
        point(b, h.y + h.h, r - 0.25),
        point(a, h.y + h.h, r - 0.25),
      ],
      nm,
      glass,
    );
    if (d > 1)
      for (const aa of [a, b])
        quad(
          o,
          'wall',
          [
            point(aa, h.y),
            point(aa, h.y + h.h),
            point(aa, h.y + h.h, r - 0.25),
            point(aa, h.y, r - 0.25),
          ],
          [Math.cos(aa), 0, -Math.sin(aa)],
          white,
        );
  }
}
function wing(o, d, sign) {
  const chain = [
    [-15.4, 8.4],
    [-15.6, 12.0],
    [-17.1, 16.0],
    [-20.0, 20.0],
  ];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i],
      b = chain[i + 1],
      dx = b[0] - a[0],
      dz = (b[1] - a[1]) * sign,
      L = Math.hypot(dx, dz),
      angle = Math.atan2(-dz, dx),
      q = facing(o, angle, (a[0] + b[0]) / 2, (sign * (a[1] + b[1])) / 2);
    B(q, 'concrete', 0, -8, 0, L + 0.2, deck + 8, 4.5, concrete);
    B(q, 'wall', 0, deck, -1.8, L + 0.2, 2.75, 0.3, white);
    if (d > 0) {
      const v = facing(q, Math.PI, 0, -2);
      windowWall(v, d, L + 0.1, deck, 3.35, [{ x: 0, y: 1.4, w: Math.min(1.1, L - 0.5), h: 1.15 }]);
      for (const x of [-L / 2 + 0.3, L / 2 - 0.3]) roundColumn(q, d, x, 2, deck, 3.35, 0.13);
    } else B(q, 'wall', 0, deck, 1.8, L, 2.75, 0.3, white);
    for (const s of [-1, 1])
      roofFace(
        q,
        [
          [-L / 2 - 0.2, 3.45, s * 2.4],
          [L / 2 + 0.2, 3.45, s * 2.4],
          [L / 2 + 0.2, 4.65, 0],
          [-L / 2 - 0.2, 4.65, 0],
        ],
        roof,
      );
  }
  const q = facing(o, 0, -20, sign * 20.5);
  B(q, 'concrete', 0, -8, 0, 5.2, deck + 8, 5.4, concrete);
  for (const s of [-1, 1]) {
    windowWall(facing(q, (s * Math.PI) / 2, s * 2.5, 0), d, 5.2, deck, 3.35, [
      { x: 0, y: 1.3, w: 1.4, h: 1.3 },
    ]);
    B(q, 'wall', 0, deck, s * 2.5, 5.1, 2.75, 0.25, white);
    roofFace(
      q,
      [
        [s * 2.8, 3.45, -2.9],
        [s * 2.8, 3.45, 2.9],
        [0, 4.8, 1.3],
        [0, 4.8, -1.3],
      ],
      roof,
    );
    roofFace(
      q,
      [
        [-2.8, 3.45, s * 2.9],
        [2.8, 3.45, s * 2.9],
        [0, 4.8, s * 1.3],
      ],
      roof,
    );
  }
}
function pavilion(o, d) {
  B(o, 'concrete', 1.5, -0.5, 0, 50.5, 1.1, 22, concrete);
  for (const sign of [-1, 1]) {
    const v = facing(o, sign < 0 ? Math.PI : 0, 0, sign * 7.15);
    windowWall(
      v,
      d,
      29.2,
      deck,
      4.1,
      [-10, -3.4, 3.4, 10].map((x) => ({ x, y: 0.8, w: 2.3, h: 2.6 })),
    );
    B(v, 'wall', 0, 3.9, 0.06, 29.5, 0.18, 0.22, white);
  }
  barrel(o, d);
  for (const x of [-14.6, 14.6]) for (const z of [-5.6, 5.6]) tower(o, d, x, z);
  pod(o, d, -1);
  pod(o, d, 1);
  wing(o, d, -1);
  wing(o, d, 1);
  if (d)
    for (const x of [-16, -9, -2, 5, 12, 19, 26])
      for (const z of [-9.5, -3.3, 3.3, 9.5]) {
        B(o, 'concrete', x, -15.5, z, 0.55, 15.0, 0.55, concrete);
        if (d > 1) {
          B(o, 'concrete', x, -1.1, z, 1.2, 0.6, 1.2, concrete);
          if (z === -9.5 || z === 9.5)
            line(o, d, 'concrete', [x, -6, z], [x + 5, -0.6, z], 0.3, concrete);
        }
      }
  else
    for (const x of [-16, 0, 16, 26])
      for (const z of [-9.5, 9.5]) panel(o, 'concrete', x, -15.5, z, 0.6, 15, concrete);
  B(o, 'wall', -23.35, 0.15, 0, 1.9, 0.15, 6.5, white);
  B(o, 'wall', -22.25, 0.3, 0, 1.1, 0.3, 6.2, white);
  // Projecting square clock on the landward south tower, corroborated by architect side photo.
  if (d > 0) {
    const q = facing(o, 0, -18.2, 8.25);
    for (const y of [6.9, 7.5]) B(q, 'iron', 0, y, 0, 3.2, 0.07, 0.09, iron);
    for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) {
      line(q, d, 'iron', [x - 0.3, 6.9, 0], [x + 0.3, 7.5, 0], 0.04, iron);
      line(q, d, 'iron', [x + 0.3, 6.9, 0], [x - 0.3, 7.5, 0], 0.04, iron);
    }
    for (const sign of [-1, 1]) {
      const face = facing(q, sign < 0 ? Math.PI : 0, -1.65, sign * 0.12);
      panel(face, 'dial', 0, 6.38, 0, 0.78, 0.78, white);
      if (d > 1) {
        for (const s of [-1, 1]) {
          B(face, 'iron', s * 0.41, 6.34, 0.025, 0.035, 0.86, 0.04, iron);
          B(face, 'iron', 0, 6.34 + (s > 0 ? 0.86 : 0), 0.025, 0.86, 0.035, 0.04, iron);
        }
        for (let i = 0; i < 12; i++) {
          const a = (i * tau) / 12,
            x = 0.3 * Math.sin(a),
            y = 6.77 + 0.3 * Math.cos(a);
          line(
            face,
            0,
            'iron',
            [x, y, 0.04],
            [x * 0.88, 6.77 + (y - 6.77) * 0.88, 0.04],
            0.018,
            iron,
          );
        }
        line(face, 0, 'iron', [0, 6.77, 0.05], [0.2, 6.9, 0.05], 0.022, iron);
        line(face, 0, 'iron', [0, 6.77, 0.05], [-0.17, 6.55, 0.05], 0.02, iron);
      }
    }
  }
}
function lamp(o, d, x, z) {
  B(o, 'wall', x, deck, z, 0.16, 2.65, 0.16, white);
  if (d === 0) return;
  const q = facing(o, 0, x, z),
    y = deck + 2.65;
  for (let i = 0; i < 4; i++) {
    const v = facing(q, (i * Math.PI) / 2);
    quad(
      v,
      'glass',
      [
        [-0.16, y, 0.16],
        [0.16, y, 0.16],
        [0.25, y + 0.7, 0.25],
        [-0.25, y + 0.7, 0.25],
      ],
      [0, 0, 1],
      glass,
    );
    line(v, d, 'iron', [-0.16, y, 0.16], [-0.25, y + 0.7, 0.25], 0.035, iron);
    line(v, d, 'iron', [0.16, y, 0.16], [0.25, y + 0.7, 0.25], 0.035, iron);
    roofFace(
      v,
      [
        [-0.3, y + 0.73, 0.3],
        [0.3, y + 0.73, 0.3],
        [0, y + 1.0, 0],
      ],
      edge,
    );
  }
  B(q, 'iron', 0, y + 1.0, 0, 0.035, 0.25, 0.035, iron);
}
function shelter(o, d, x, z, w = 16, dep = 5.4, small = false) {
  const q = facing(o, 0, x, z);
  const h = small ? 2.7 : 3.15,
    wd = d === 2 ? 1 : d;
  B(q, 'wood', 0, deck - 0.15, 0, w, 0.15, dep, wood);
  for (const xx of [-w / 2, w / 2]) {
    const v = facing(q, xx > 0 ? Math.PI / 2 : -Math.PI / 2, xx, 0);
    windowWall(
      v,
      wd,
      dep,
      deck,
      deck + h,
      small
        ? [{ x: 0, y: 1.2, w: 1.6, h: 1.25 }]
        : [-1.45, 0, 1.45].map((x) => ({ x, y: 2.55, w: 0.48, h: 0.38 })),
      'clap',
      cream,
    );
  }
  if (small) {
    for (const sign of [-1, 1])
      windowWall(
        facing(q, sign < 0 ? Math.PI : 0, 0, (sign * dep) / 2),
        wd,
        w,
        deck,
        deck + h,
        [{ x: 0, y: 1.15, w: 1.6, h: 1.35 }],
        'clap',
        cream,
      );
  } else {
    for (const xx of [-w / 2 + 2, w / 2 - 2]) {
      for (const sign of [-1, 1])
        windowWall(
          facing(q, sign < 0 ? Math.PI : 0, xx, (sign * dep) / 2),
          wd,
          4,
          deck,
          deck + h,
          [{ x: 0, y: 1.45, w: 1.1, h: 1.2 }],
          'clap',
          cream,
        );
      B(q, 'clap', xx < 0 ? -4 : 4, deck, 0, 0.14, h, dep, cream);
    }
    for (const sign of [-1, 1])
      for (const xx of [-3.6, 3.6]) {
        B(q, 'clap', xx, deck, (sign * dep) / 2, 0.1, h, 0.1, white);
      }
    B(q, 'clap', 0, deck, (-Math.sign(z) * dep) / 2, 8, h, 0.14, cream);
  }
  for (const sign of [-1, 1]) {
    roofFace(
      q,
      [
        [-w / 2 - 0.45, deck + h + 0.12, sign * (dep / 2 + 0.4)],
        [w / 2 + 0.45, deck + h + 0.12, sign * (dep / 2 + 0.4)],
        [w / 2 + 0.45, deck + h + 1.45, 0],
        [-w / 2 - 0.45, deck + h + 1.45, 0],
      ],
      edge,
    );
    const v = facing(q, (sign * Math.PI) / 2, sign * (w / 2 + 0.03), 0);
    v.addTriangle(
      'clap',
      ref,
      [
        [-dep / 2, deck + h, 0],
        [dep / 2, deck + h, 0],
        [0, deck + h + 1.35, 0],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      cream,
    );
  }
}
function railSegment(o, d, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz);
  if (len < 0.2) return;
  const q = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  if (d === 3) {
    castBalustrade(q, len);
    return;
  }
  B(q, 'green', 0, deck + 1.18, 0, len, 0.065, 0.07, green);
  B(q, 'wall', 0, deck + 0.12, 0, len, 0.06, 0.06, white);
  if (!d) return;
  const n = Math.max(1, Math.ceil(len / (d === 3 ? 1.7 : 3)));
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    if (d === 3) B(q, 'green', x, deck, 0, 0.055, 1.2, 0.055, green);
    else panel(q, 'green', x, deck, 0, 0.055, 1.2, green);
  }
  if (d > 1)
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + ((i + 0.5) * len) / n,
        w = (len / n) * 0.44,
        base = deck + 0.18;
      for (const sign of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 4; k++) {
          const t = k / 4;
          pts.push([x + sign * w * t, base + 0.82 * Math.sqrt(1 - t * t), 0.015]);
        }
        for (let k = 0; k < 4; k++) strip(q, 'wall', pts[k], pts[k + 1], 0.035, [0, 0, 1], white);
      }
      for (const s of [-1, 1])
        strip(
          q,
          'wall',
          [x, base, 0.015],
          [x + s * w * 0.7, base + 0.65, 0.015],
          0.028,
          [0, 0, 1],
          white,
        );
    }
}

/** Closed cast-metal plate with four open fan counters, simplified from the cleared native. */
function fanCasting(o, x, pitch) {
  const width = pitch - 0.055,
    bottom = deck + 0.16,
    height = 1.04,
    depth = 0.04,
    outer = [
      [-0.5, 0],
      [0.5, 0],
      [0.5, 1],
      [-0.5, 1],
    ],
    holes = [
      [
        [-0.43, 0.87],
        [-0.08, 0.15],
        [-0.24, 0.89],
      ],
      [
        [-0.2, 0.9],
        [-0.025, 0.17],
        [-0.025, 0.91],
      ],
      [
        [0.24, 0.895],
        [0.08, 0.16],
        [0.43, 0.875],
      ],
      [
        [0.025, 0.915],
        [0.025, 0.18],
        [0.2, 0.905],
      ],
    ],
    rings = [outer, ...holes].map((r) => r.map(([u, v]) => [x + u * width, bottom + v * height])),
    points = rings.flat(),
    offsets = [4, 7, 10, 13],
    ids = earcut(points.flat(), offsets);
  for (const sign of [-1, 1])
    for (let i = 0; i < ids.length; i += 3) {
      let p = ids.slice(i, i + 3).map((j) => [...points[j], (sign * depth) / 2]);
      if (normalFor(...p)[2] * sign < 0) p = p.reverse();
      o.addTriangle(
        'railWhite',
        ref,
        p,
        [0, 0, sign],
        p.map((v) => v.slice(0, 2)),
        white,
      );
    }
  for (const [j, ring] of rings.entries()) {
    const area = ring.reduce(
      (sum, a, i) =>
        sum + a[0] * ring[(i + 1) % ring.length][1] - ring[(i + 1) % ring.length][0] * a[1],
      0,
    );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        side = (j === 0 ? 1 : -1) * Math.sign(area),
        n = [((b[1] - a[1]) * side) / length, ((a[0] - b[0]) * side) / length, 0];
      let p = [
          [...a, -depth / 2],
          [...b, -depth / 2],
          [...b, depth / 2],
          [...a, depth / 2],
        ],
        uv = [
          [0, 0],
          [length, 0],
          [length, depth],
          [0, depth],
        ];
      if (normalFor(...p).reduce((s, v, k) => s + v * n[k], 0) < 0) {
        p = p.reverse();
        uv = uv.reverse();
      }
      o.addQuad('railWhite', ref, p, n, uv, white);
    }
  }
}
function castBalustrade(o, length) {
  const n = Math.max(1, Math.ceil(length / 1.7)),
    pitch = length / n;
  B(o, 'railGreen', 0, deck + 1.18, 0, length, 0.065, 0.07, green);
  B(o, 'railGreen', 0, deck + 0.12, 0, length, 0.06, 0.06, green);
  for (let i = 0; i <= n; i++)
    B(o, 'railGreen', -length / 2 + i * pitch, deck - 0.01, 0, 0.055, 1.22, 0.055, green);
  for (let i = 0; i < n; i++) fanCasting(o, -length / 2 + (i + 0.5) * pitch, pitch);
}
function pier(o, d) {
  polygon(o, 'wood', frame.authoredComponents.deckOutline, deck - 0.22, deck, wood);
  const rowX = [
    30, 39, 48, 55, 58, 61, 64, 67, 70, 79, 88, 97, 106, 115, 123, 127, 131, 135, 139, 143, 147,
    151, 155, 159, 163, 167,
  ];
  for (let i = 0; i < rowX.length; i++) {
    const x = rowX[i];
    if (d === 0 && i % 2) continue;
    for (const z of x >= 127
      ? [-8, -3, 4, 10]
      : x >= 123
        ? [-7, -3, 3, 8]
        : x >= 55 && x <= 70
          ? [-6.8, -3, 3, 7.6]
          : [-3, 3]) {
      if (d > 1) B(o, 'iron', x, -15.5, z, 0.24, 15.75, 0.24, iron);
      else panel(o, 'iron', x, -15.5, z, 0.3, 15.75, iron);
      if (d === 3) {
        B(o, 'concrete', x, -15.5, z, 0.6, 0.6, 0.6, concrete);
        B(o, 'iron', x, -5.3, z, 0.32, 0.18, 0.32, iron);
      }
    }
    if (d && i < rowX.length - 1) {
      const b = rowX[i + 1];
      for (const z of x >= 127 ? [-8, 10] : x >= 123 ? [-7, 8] : [-3, 3])
        for (const s of [-1, 1])
          line(o, d, 'iron', [s > 0 ? x : b, -10, z], [s > 0 ? b : x, -0.3, z], 0.045, iron);
    }
  }
  for (const x of [166, 170])
    for (const z of [-12, -6, 0, 6, 12]) {
      B(o, 'concrete', x, -15.5, z, 0.6, 15.9, 0.6, concrete);
    }
  if (d > 0)
    for (const x of [166, 170])
      for (const y of [-10, -5]) B(o, 'concrete', x, y, 0, 0.4, 0.4, 25, concrete);
  if (d)
    for (const z of [-13, 13])
      line(o, d, 'concrete', [166, -13, z], [170, -0.1, z], 0.35, concrete);
  landing(o, d);
  const ring = frame.authoredComponents.deckOutline;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    if (Math.max(a[0], b[0]) < 27) continue;
    railSegment(o, d, a, b);
  }
  for (const z of [-10.8, 10.8]) railSegment(o, d, [-12.8, z], [19, z]);
  if (d > 1) {
    for (let x = 28; x < 169; x += 1.3)
      strip(o, 'seam', [x, deck + 0.006, -3], [x, deck + 0.006, 3], 0.012, [0, 1, 0], edge);
  }
  for (const z of [-4.7, 5.5]) shelter(o, d, 63.3, z);
  shelter(o, d, 158.7, 1, 5.3, 4.9, true);
  for (let x = 31; x < 167; x += d === 0 ? 45 : d === 2 ? 18 : 15) lamp(o, d, x, 0);
}
function landing(o, d) {
  // Fixed stair pose read from the long side original; actual tidal operation is not represented.
  for (const z of [11.2, 13.2])
    line(o, 3, 'concrete', [158, -9.1, z], [169, 0.38, z], 0.35, concrete);
  B(o, 'concrete', 157.8, -9.35, 12.2, 3.5, 0.35, 2.6, concrete);
  const n = d > 1 ? 42 : 10;
  for (let i = 0; i < n; i++)
    B(
      o,
      'concrete',
      158.5 + (10.5 * i) / n,
      -9 + (9.4 * i) / n,
      12.2,
      10.5 / n + 0.05,
      0.15,
      2.0,
      concrete,
    );
  for (const z of [11.1, 13.3]) {
    line(o, d, 'iron', [158.5, -8, z], [169, 1.4, z], 0.05, green);
    if (d > 0)
      for (let i = 0; i < 9; i++)
        B(o, 'iron', 158.5 + (10.5 * i) / 8, -9 + (9.4 * i) / 8, z, 0.04, 1.15, 0.04, green);
  }
}
function build(o, d) {
  pavilion(o, d);
  pier(o, d);
}
export const penarthPier = (o) => build(o, 3),
  penarthPierStreet = (o) => {
    pavilion(o, 1);
    pier(o, 2);
  },
  penarthPierDistrict = (o) => coarse(o, 1),
  penarthPierSkyline = (o) => coarse(o, 0);
const surfaces = {
  railWhite: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.1 },
  railGreen: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.1 },
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.91, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.16, doubleSided: true },
  green: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.86,
    metallic: 0.1,
    doubleSided: true,
  },
  metal: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.8,
    metallic: 0.18,
    doubleSided: true,
  },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.96, metallic: 0 },
  clap: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.9, metallic: 0 },
  zinc: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.45 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.45 },
  seam: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.84,
    metallic: 0.25,
    doubleSided: true,
  },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.1 },
  dial: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0 },
};
export const penarthPierModel = {
  id: 'penarth_pier',
  key: 'penarth_pier',
  recipe: 'structure-penarth-pier.mjs',
  cell: 'gc/gcj',
  title: 'Penarth Pier',
  brief:
    'Restored white concrete shore pavilion with four silver square Moghul domes/finials and diamond grilles, zinc barrel roof/four tall dormer windows per side/11 ribs/ridge vents, curved seaward glass colonnade/two terraces/upper observatory, convex landward lobby/low curving shop wings and projecting clock. Complete surviving timber deck on iron neck piles/concrete end frames, white/green traceried railings/lamps, two open-porch shelters, broad open head/ticket hut and landing edge. Lost1931 theatre and neighboring promenade buildings excluded.',
  camera: [150, 65, 185],
  lookAt: [62, 1, 0],
  qaCameras: [
    { name: 'front', position: [-65, 23, 65], lookAt: [0, 5, 0] },
    { name: 'front-detail', position: [58, 18, 3], lookAt: [16, 5, 0] },
    { name: 'back', position: [65, 25, -70], lookAt: [2, 5, 0] },
    { name: 'base-detail', position: [-36, 8, 36], lookAt: [-15, 3, 15] },
    { name: 'roof-detail', position: [-8, 37, 32], lookAt: [0, 9, 0] },
    { name: 'pier-detail', position: [95, 3, 47], lookAt: [105, -3, 0] },
    { name: 'head-detail', position: [184, 15, 34], lookAt: [150, 1, 0] },
    { name: 'lattice-detail', position: [24, 10, 18], lookAt: [14.6, 8.5, 5.6] },
    { name: 'balustrade-detail', position: [110, 2.6, 8], lookAt: [110, 1.25, 3.8] },
    { name: 'head-balustrade-detail', position: [140, 2.4, 15.5], lookAt: [140, 1.25, 10.9] },
  ],
  mediumFiContext: { scale: 2.0, cameraYaw: 0 },
  build: penarthPier,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent Welsh Government1m DTM, survey2022-04-01, dry Esplanade[-25,0] datum8.4271m. Native DSM deck median9.0200m guides model deck.6m; ridge around19.2m and dome cells22.3m guide proportional heights. Rejected Terrarium ocean16m plateau preserved. Ground unmodified; dry approach and own outlines clear deck, fixed supports reach below reviewed ground. Bounded preview only: actual pile/tidal/landing accuracy remains unverified; footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-penarth-pier.mjs',
    level: 'skyline',
    export: 'penarthPierSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'penarthPierDistrict', errorMeters: 1.0, surfaces },
      street: { export: 'penarthPierStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    'Mapped shelter footprints extend up to1.3m past the generalized landuse deck ring. Four authored bulge-edge vertices are explicitly widened to retain porch floors/outer rails; original map ring is preserved. Shore-wing foundations extend to fixed-8m and marine supports to-15.5m beneath reviewed grade; hidden foundations and embedment are visual estimates.',
    'Selected post2013 restored exterior. Closed close-level white cast-metal fan panels have four original simplified open counters each and green framing, interpreted from the exact cleared Qualla2024native; casting profile/counts are not a survey. Broader roof curves, scale seams, lattice, heights, hidden walls, support spacing and finials remain estimates. Cleared full-pavilion/support imagery is still required for whole-model fidelity; full fixed exterior scope is retained.',
    'Main body about35x17m/shore wings46m; full envelope193m agrees broadly with primary about200m. Current mapped broad head28m differs legacy15m landing-stage description. Native outline retained; exact original chainages/alteration history not inferred.',
    'Independent1m Welsh DTM is unchanged; source interpolation under roof/deck is not survey certainty or seabed/tide measurement. Fixed supports/landing poses and host terrain compatibility remain approximate. Bounded geographic preview requires current review; footprint replacement disabled.',
    'No lost seaward wooden theatre, neighboring apartments/baths/promende buildings, separate K6 kiosk, beach/sea/boats, people/temporary signs/flags/string lights, loose furniture or interiors. Clock marks are original simplified glyphs without copied brand text. No source pixels embedded.',
  ],
};
export { barrel, pavilion, pier, pod, tower, wing };

/** Distance meshes keep the pavilion silhouette and open pier; detail remains in the closeup recipe. */
function coarseDome(o, d, cx, cz) {
  const n = d ? 8 : 4,
    profile = d
      ? [
          [11.15, 3.05],
          [11.8, 2.5],
          [13.35, 1.9],
          [14, 0.5],
        ]
      : [
          [11.15, 3.05],
          [12.2, 2.45],
          [13.7, 1.3],
          [14, 0.5],
        ],
    rings = profile.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-i * tau) / n + Math.PI / 4;
        return [
          cx + r * Math.sign(Math.cos(a)) * (d ? Math.pow(Math.abs(Math.cos(a)), 0.35) : 1),
          y,
          cz + r * Math.sign(Math.sin(a)) * (d ? Math.pow(Math.abs(Math.sin(a)), 0.35) : 1),
        ];
      }),
    );
  loft(o, 'zinc', rings, roof);
  const q = facing(o, 0, cx, cz);
  for (const s of [-1, 1]) {
    roofFace(
      q,
      [
        [s * 0.34, 14.1, -0.34],
        [s * 0.34, 14.1, 0.34],
        [0, 15.15, 0],
      ],
      roof,
    );
    roofFace(
      q,
      [
        [-0.34, 14.1, s * 0.34],
        [0.34, 14.1, s * 0.34],
        [0, 15.15, 0],
      ],
      roof,
    );
  }
}
function coarsePavilion(o, d) {
  B(o, 'concrete', 1.5, -0.5, 0, 50.5, 1.1, 22, concrete);
  coarseWalls(o, 0, 0, 29.2, 14.3, 3.5);
  for (const z of [-7.17, 7.17])
    for (const x of [-10, -3.4, 3.4, 10])
      panel(facing(o, z < 0 ? Math.PI : 0, 0, z), 'glass', x, 0.8, 0.01, 2.3, 2.6, glass);
  for (let i = 0; i < (d ? 12 : 8); i++) {
    const n = d ? 12 : 8,
      a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    roofFace(o, [
      [-14.6, 4.1 + 6.6 * Math.sin(a), 7.2 * Math.cos(a)],
      [14.6, 4.1 + 6.6 * Math.sin(a), 7.2 * Math.cos(a)],
      [14.6, 4.1 + 6.6 * Math.sin(b), 7.2 * Math.cos(b)],
      [-14.6, 4.1 + 6.6 * Math.sin(b), 7.2 * Math.cos(b)],
    ]);
  }
  B(o, 'zinc', 0, 10.7, 0, 29.2, 0.35, 0.75, roof);
  for (const x of [-14.6, 14.6])
    for (const z of [-5.6, 5.6]) {
      coarseWalls(o, x, z, 4.6, 4.6, 10.2);
      B(o, 'wall', x, 10.75, z, 6.35, 0.25, 6.35, white);
      coarseDome(o, d, x, z);
      if (d)
        for (let i = 0; i < 4; i++) {
          const v = facing(
            o,
            (i * Math.PI) / 2,
            x + Math.sin((i * Math.PI) / 2) * 2.32,
            z + Math.cos((i * Math.PI) / 2) * 2.32,
          );
          panel(v, 'glass', 0, 7.8, 0, 2.1, 2.35, glass);
          for (const sign of [-1, 1])
            strip(v, 'wall', [-sign, 7.85, 0.01], [sign, 10.1, 0.01], 0.08, [0, 0, 1], white);
        }
    }
  for (const sign of [-1, 1])
    for (const x of [-9, -3, 3, 9]) {
      const v = facing(o, sign < 0 ? Math.PI : 0, sign < 0 ? -x : x, sign * 7.4);
      panel(v, 'wall', 0, 4.1, 0, 3.0, 5.6, white);
      panel(v, 'glass', 0, 4.55, 0.02, 2.2, 4.55, glass);
      roofFace(
        v,
        [
          [-1.6, 9.6, 0],
          [1.6, 9.6, 0],
          [1.6, 10.1, -2.9],
          [-1.6, 10.1, -2.9],
        ],
        roof,
      );
    }
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * 16.4, 0),
      r = sign > 0 ? 6.3 : 4.9;
    arc(q, 0, 'glass', r - 0.65, deck, 3.4, glass);
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + ((i + 0.5) * Math.PI) / 4;
      B(q, 'wall', r * Math.sin(a), deck, r * Math.cos(a), 0.28, 2.8, 0.28, white);
    }
    for (const [y, rr] of [
      [3.4, r + 0.25],
      [6.55, r - 1.0],
    ]) {
      const n = d ? 8 : 4,
        ring = Array.from({ length: n + 1 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / n;
          return [rr * Math.sin(a), y, rr * Math.cos(a)];
        });
      q.addConvexPolygon('wall', ref, ring, [0, 1, 0], (p) => [p[0], p[2]], white);
      arc(q, 0, 'wall', rr, y, y + 0.35, white);
    }
    arc(q, 0, 'wall', r - 1.1, 3.6, 6.6, white);
    if (sign > 0) {
      arc(q, 0, 'glass', r - 2.15, 6.75, 9.25, glass);
      arcSlab(q, 0, r - 1.8, 9.25, 9.45, 'zinc', roof);
    } else panel(q, 'wall', 0, 6.75, 0, 8.5, 3.05, white);
  }
  for (const sign of [-1, 1]) {
    B(o, 'wall', -20, -8, sign * 20.5, 5.1, 11.35, 5.2, white);
    const chain = [
      [-15.4, 8.4],
      [-15.6, 12],
      [-17.1, 16],
      [-20, 20],
    ];
    for (let i = 0; i < chain.length - 1; i++) {
      const a = chain[i],
        b = chain[i + 1],
        dx = b[0] - a[0],
        dz = sign * (b[1] - a[1]),
        L = Math.hypot(dx, dz),
        q = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (sign * (a[1] + b[1])) / 2);
      for (const s of [-1, 1]) {
        panel(facing(q, s < 0 ? Math.PI : 0, 0, s * 2.2), 'wall', 0, -8, 0, L + 0.2, 11.35, white);
        roofFace(
          q,
          [
            [-L / 2 - 0.2, 3.45, s * 2.4],
            [L / 2 + 0.2, 3.45, s * 2.4],
            [L / 2 + 0.2, 4.65, 0],
            [-L / 2 - 0.2, 4.65, 0],
          ],
          roof,
        );
      }
    }
    for (const s of [-1, 1]) {
      roofFace(
        o,
        [
          [-22.8, 3.45, sign * (20.5 + s * 2.9)],
          [-17.2, 3.45, sign * (20.5 + s * 2.9)],
          [-20, 4.8, sign * 20.5],
        ],
        roof,
      );
    }
  }
  for (const x of [-12, 6, 24])
    for (const z of [-9.5, 9.5]) B(o, 'concrete', x, -15.5, z, 0.6, 15, 0.6, concrete);
}
function coarseWalls(o, x, z, w, dep, h) {
  for (const s of [-1, 1]) {
    panel(facing(o, s < 0 ? Math.PI : 0, x, z + (s * dep) / 2), 'wall', 0, deck, 0, w, h, white);
    panel(facing(o, (s * Math.PI) / 2, x + (s * w) / 2, z), 'wall', 0, deck, 0, dep, h, white);
  }
}
function coarsePier(o, d) {
  for (const [a, b, w, zc = 0] of [
    [-13, 28, 22],
    [28, 54, 7],
    [54, 73, 16.2, 0.4],
    [73, 122, 7],
    [122, 126, 16],
    [126, 164, 20, 1],
    [164, 170, 28],
  ]) {
    B(o, 'wood', (a + b) / 2, deck - 0.22, zc, b - a, 0.22, w, wood);
    for (const z of [zc - w / 2, zc + w / 2]) {
      panel(o, 'wall', (a + b) / 2, deck + 0.12, z, b - a, 0.8, white);
      if (d) {
        B(o, 'green', (a + b) / 2, deck + 1.18, z, b - a, 0.07, 0.07, green);
      }
    }
  }
  for (const x of [30, 48, 68, 88, 108, 125, 145, 167])
    for (const z of x > 122 ? [-8, 10] : [-3, 3]) panel(o, 'iron', x, -15.5, z, 0.3, 15.75, iron);
  if (d)
    for (const z of [-3, 3])
      for (const x of [30, 48, 73, 92, 111]) {
        strip(o, 'iron', [x, -10, z], [x + 12, -0.3, z], 0.07, [0, 0, 1], iron);
        strip(o, 'iron', [x + 12, -10, z], [x, -0.3, z], 0.07, [0, 0, 1], iron);
      }
  for (const z of [-4.7, 5.5]) {
    for (const x of [57.3, 69.3]) B(o, 'clap', x, deck, z, 4, 3.15, 5.4, cream);
    B(o, 'clap', 63.3, deck, z - Math.sign(z) * 2.7, 8, 3.15, 0.14, cream);
    for (const x of [59.7, 66.9])
      B(o, 'wall', x, deck, z + Math.sign(z) * 2.7, 0.1, 3.15, 0.1, white);
    for (const s of [-1, 1])
      roofFace(
        o,
        [
          [54.85, deck + 3.27, z + s * 3.1],
          [71.75, deck + 3.27, z + s * 3.1],
          [71.75, deck + 4.6, z],
          [54.85, deck + 4.6, z],
        ],
        edge,
      );
  }
  B(o, 'clap', 158.7, deck, 1, 5.3, 2.7, 4.9, cream);
  for (const s of [-1, 1])
    roofFace(
      o,
      [
        [155.6, deck + 2.82, 1 + s * 2.9],
        [161.8, deck + 2.82, 1 + s * 2.9],
        [161.8, deck + 4.15, 1],
        [155.6, deck + 4.15, 1],
      ],
      edge,
    );
  if (d) landing(o, 0);
}
function coarse(o, d) {
  coarsePavilion(o, d);
  coarsePier(o, d);
}
