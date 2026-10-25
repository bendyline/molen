/** Complete former-prison memorial: native individual buildings, courtyards, walls and towers. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u3/u33/berlin_hohenschonhausen_memorial/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('926e58'),
    plaster: rgb('bcb19a'),
    roof: rgb('626860'),
    tile: rgb('62625a'),
    metal: rgb('697975'),
    glass: rgb('4d6565'),
  },
  white = rgb('dedfd6'),
  wire = rgb('535c58'),
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.97, metallic: 0 },
    plaster: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 1, metallic: 0 },
    tile: { slot: 'roof', graph: 'slate', roughness: 1, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.48, metallic: 0.02 },
  };
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t),
  vary = (c, t) => c.map((v) => Math.min(1, v * t));
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      s,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
}
function rod(o, s, a, b, w, d = 1, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    len = Math.hypot(...v),
    axis = v.map((x) => x / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u);
  if (d === 0) {
    for (const n of [u, v2])
      Q(
        o,
        s,
        [
          a.map((x, k) => x - (n[k] * w) / 2),
          a.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x - (n[k] * w) / 2),
        ],
        cross(n, axis),
        col,
      );
    return;
  }
  const ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((x, k) => x - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    axis.map((x) => -x),
    col,
  );
  Q(o, s, B, axis, col);
}
function face(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sg = Math.sign(
      r.reduce(
        (s, v, k) => s + v[0] * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * v[1],
        0,
      ),
    ),
    n = [sg * u[1], 0, -sg * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 > 1e-5 && y1 - y0 > 1e-5)
    Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function window(o, f, h, d) {
  const dep = d > 1 ? 0.18 : 0,
    s = h.door ? 'metal' : 'glass',
    col = h.door ? C.metal : h.cell ? rgb('a0b0a7') : C.glass;
  rect(o, s, f, h.x0, h.y0, h.x1, h.y1, d > 1 ? -dep : 0.006, col);
  if (d < 2) return;
  const q = [
    [h.x0, h.y0],
    [h.x1, h.y0],
    [h.x1, h.y1],
    [h.x0, h.y1],
  ];
  for (let i = 0; i < 4; i++) {
    const a = q[i],
      b = q[(i + 1) % 4],
      u = -(b[1] - a[1]),
      v = b[0] - a[0],
      A = f.P(0, 0),
      B = f.P(u, v),
      n = [B[0] - A[0], v, B[2] - A[2]];
    Q(o, 'metal', [f.P(...a), f.P(...b), f.P(...b, -dep), f.P(...a, -dep)], n, white);
  }
  if (h.door) {
    if (d > 2) {
      const x = (h.x0 + h.x1) / 2;
      rect(o, 'metal', f, x - 0.015, h.y0, x + 0.015, h.y1, -0.15, wire);
      rect(o, 'metal', f, x + 0.06, h.y0 + 0.95, x + 0.25, h.y0 + 0.99, -0.1, wire);
    }
    return;
  }
  if (d > 2) {
    for (const x of [h.x0, h.x1])
      rect(o, 'metal', f, x - 0.045, h.y0 - 0.04, x + 0.045, h.y1 + 0.04, -0.03, white);
    for (const y of [h.y0, h.y1])
      rect(o, 'metal', f, h.x0 - 0.04, y - 0.045, h.x1 + 0.04, y + 0.045, -0.03, white);
  }
  if (!h.cell) {
    const x = (h.x0 + h.x1) / 2,
      y = (h.y0 + h.y1) / 2;
    rect(o, 'metal', f, x - 0.025, h.y0, x + 0.025, h.y1, -0.12, white);
    rect(o, 'metal', f, h.x0, y - 0.025, h.x1, y + 0.025, -0.12, white);
  } else if (d > 2) {
    for (let j = 1; j < 4; j++) {
      const x = h.x0 + ((h.x1 - h.x0) * j) / 4;
      rect(o, 'metal', f, x - 0.012, h.y0, x + 0.012, h.y1, -0.14, white);
    }
    for (let j = 1; j < 4; j++) {
      const y = h.y0 + ((h.y1 - h.y0) * j) / 4;
      rect(o, 'metal', f, h.x0, y - 0.012, h.x1, y + 0.012, -0.14, white);
    }
  }
}
function inside(q, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
function neighborHeight(b, f) {
  let top = -0.12;
  for (const a of p.buildings)
    if (
      a.id !== b.id &&
      !['canopy', 'exercise', 'tower'].includes(a.type) &&
      [0.001, f.len / 2, f.len - 0.001].every((x) => {
        const q = f.P(x, 0, 0.04);
        return inside([q[0], q[2]], a.outline);
      })
    )
      top = Math.max(top, a.height);
  return Math.min(b.height, top);
}
function facade(o, b, i, d) {
  const r = b.outline,
    f = face(r, i),
    h = b.height,
    old = b.type === 'main',
    cell = b.type === 'cells',
    garage = b.type === 'garage',
    newer = cell || b.type === 'interrogation',
    low = ['workshop', 'utility', 'annex-low'].includes(b.type),
    brickTop = old ? 6.8 : newer ? 1.8 : b.type === 'hospital' ? 3.1 : low || garage ? h : 0.9,
    holes = [];
  const bottom = neighborHeight(b, f);
  if (bottom >= h - 0.01) return;
  if (d && f.len > 2.3) {
    const step = old ? 3.18 : garage ? 3.4 : newer ? 4.0 : b.type === 'hospital' ? 4.1 : 4.5,
      count = Math.max(1, Math.floor(f.len / step)),
      rows = garage
        ? [[0.12, 2.72]]
        : old
          ? [
              [0.65, 2.45],
              [3.85, 5.65],
              [7.05, 8.85],
              [10.25, 12.05],
            ]
          : newer
            ? [
                [0.35, 1.2],
                [2.7, 4.55],
                [6, 7.85],
                [9.3, 11.15],
              ]
            : h > 5
              ? [
                  [0.6, 2.35],
                  [3.65, 5.4],
                ]
              : [[0.7, 2.2]];
    for (let k = 0; k < count; k++) {
      const x = (f.len * (k + 0.5)) / count,
        w = garage ? Math.min(2.65, f.len / count - 0.28) : cell ? 0.9 : 1.35;
      for (const [y0, y1] of rows)
        if (y1 < h - 0.3 && y0 > bottom + 0.02)
          holes.push({ x0: x - w / 2, x1: x + w / 2, y0, y1, door: garage, cell });
    }
  }
  const ys = [
    bottom,
    h,
    ...(brickTop > bottom && brickTop < h ? [brickTop] : []),
    ...(d > 1 ? holes.flatMap((q) => [q.y0, q.y1]) : []),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y = (ys[j - 1] + ys[j]) / 2,
      hh = (d > 1 ? holes : []).filter((q) => y > q.y0 && y < q.y1).sort((a, b) => a.x0 - b.x0);
    let x = 0;
    for (const q of hh) {
      rect(o, y < brickTop ? 'brick' : 'plaster', f, x, ys[j - 1], q.x0, ys[j]);
      x = q.x1;
    }
    rect(o, y < brickTop ? 'brick' : 'plaster', f, x, ys[j - 1], f.len, ys[j]);
  }
  for (const q of holes) window(o, f, q, d);
  if (d > 1) {
    rect(o, 'roof', f, 0, h - 0.12, f.len, h + 0.07, 0.06);
    if (garage) {
      for (const q of holes) {
        const x = (q.x0 + q.x1) / 2;
        rect(o, 'metal', f, x - 0.02, q.y0, x + 0.02, q.y1, 0.01, wire);
        if (d > 2)
          for (let a = q.x0 + 0.24; a < q.x1; a += 0.35)
            rect(o, 'metal', f, a - 0.007, q.y0, a + 0.007, q.y1, 0.012, vary(C.metal, 0.8));
      }
    }
  }
  if (old && d > 1) {
    rect(o, 'brick', f, 0, 6.46, f.len, 6.7, 0.1);
    if (d > 2)
      for (let x = 0.2; x < f.len; x += 0.42) {
        Q(
          o,
          'brick',
          [
            f.P(x, 6.45, 0.18),
            f.P(x + 0.16, 6.45, 0.18),
            f.P(x + 0.16, 6.65, 0.18),
            f.P(x, 6.65, 0.18),
          ],
          f.n,
          vary(C.brick, 1.08),
        );
      }
  }
}
function poly(o, s, q, n = [0, 1, 0], col = C[s]) {
  const axis = Math.abs(n[1]) > 0.5 ? [0, 2] : Math.abs(n[0]) > 0.5 ? [2, 1] : [0, 1],
    ix = earcut(q.flatMap((v) => [v[axis[0]], v[axis[1]]]));
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => q[k]),
      n,
      col,
    );
}
function pitched(o, b, d) {
  const r = b.outline,
    min = [0, 1].map((k) => Math.min(...r.map((v) => v[k]))),
    max = [0, 1].map((k) => Math.max(...r.map((v) => v[k]))),
    x0 = min[0] - 0.16,
    x1 = max[0] + 0.16,
    z0 = min[1] - 0.16,
    z1 = max[1] + 0.16,
    zc = (z0 + z1) / 2,
    e = b.height,
    hi = b.type === 'hospital' ? 9.2 : e + 2,
    cut = b.type === 'hospital' ? 3 : 2,
    ey = e + (hi - e) * 0.48,
    half = (((z1 - z0) / 2) * (hi - ey)) / (hi - e),
    A = [x0 + cut, hi, zc],
    B = [x1 - cut, hi, zc],
    NW = [x0, e, z0],
    NE = [x1, e, z0],
    SW = [x0, e, z1],
    SE = [x1, e, z1],
    H0 = [x0, ey, zc - half],
    H1 = [x0, ey, zc + half],
    J0 = [x1, ey, zc - half],
    J1 = [x1, ey, zc + half];
  poly(o, 'tile', [NW, NE, J0, B, A, H0]);
  poly(o, 'tile', [SE, SW, H1, A, B, J1]);
  T(o, 'tile', [H0, H1, A], [0, 1, 0]);
  T(o, 'tile', [J1, J0, B], [0, 1, 0]);
  poly(o, 'plaster', [NW, SW, H1, H0], [-1, 0, 0]);
  poly(o, 'plaster', [SE, NE, J0, J1], [1, 0, 0]);
  if (d) {
    rod(o, 'tile', A, B, 0.16, d > 1 ? 1 : 0);
    if (b.type === 'hospital')
      for (let k = 0; k < 5; k++) {
        const x = x0 + ((x1 - x0) * (k + 1)) / 6,
          z = z0 + 1.1,
          y = e + ((hi - e) * 1.1) / (zc - z0);
        box(o, 'plaster', x, y - 0.1, z, 1.5, 0.95, 1.25);
        Q(
          o,
          'glass',
          [
            [x - 0.48, y + 0.05, z - 0.635],
            [x + 0.48, y + 0.05, z - 0.635],
            [x + 0.48, y + 0.7, z - 0.635],
            [x - 0.48, y + 0.7, z - 0.635],
          ],
          [0, 0, -1],
        );
        const a = [x - 0.84, y + 0.84, z - 0.7],
          b = [x + 0.84, y + 0.84, z - 0.7],
          c = [x, y + 1.42, z - 0.7],
          bb = [x - 0.84, y + 0.84, z + 0.7],
          dd = [x + 0.84, y + 0.84, z + 0.7],
          cc = [x, y + 1.42, z + 0.7];
        T(o, 'plaster', [a, b, c], [0, 0, -1]);
        Q(o, 'tile', [a, c, cc, bb], [0, 1, 0]);
        Q(o, 'tile', [c, b, dd, cc], [0, 1, 0]);
      }
  }
}
function wall(o, line, h, d, width = 0.32, s = 'brick') {
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      f = face([a, b, [b[0] + 1, b[1] + 1]], 0),
      n = f.n;
    for (const sign of [-1, 1])
      Q(
        o,
        s,
        [
          [a[0] + ((n[0] * width) / 2) * sign, 0, a[1] + ((n[2] * width) / 2) * sign],
          [b[0] + ((n[0] * width) / 2) * sign, 0, b[1] + ((n[2] * width) / 2) * sign],
          [b[0] + ((n[0] * width) / 2) * sign, h, b[1] + ((n[2] * width) / 2) * sign],
          [a[0] + ((n[0] * width) / 2) * sign, h, a[1] + ((n[2] * width) / 2) * sign],
        ],
        n.map((v) => v * sign),
      );
    if (d)
      Q(
        o,
        'roof',
        [
          [a[0] - (n[0] * width) / 2, h, a[1] - (n[2] * width) / 2],
          [b[0] - (n[0] * width) / 2, h, b[1] - (n[2] * width) / 2],
          [b[0] + (n[0] * width) / 2, h, b[1] + (n[2] * width) / 2],
          [a[0] + (n[0] * width) / 2, h, a[1] + (n[2] * width) / 2],
        ],
        [0, 1, 0],
      );
    if (d > 1 && h >= 4) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.ceil(len / 5);
      for (let j = 0; j <= count; j++) {
        const x = a[0] + ((b[0] - a[0]) * j) / count,
          z = a[1] + ((b[1] - a[1]) * j) / count;
        rod(o, 'metal', [x, h, z], [x + n[0] * 0.24, h + 0.6, z + n[2] * 0.24], 0.035, 0, wire);
      }
      rod(o, 'metal', [a[0], h + 0.5, a[1]], [b[0], h + 0.5, b[1]], 0.018, 0, wire);
      if (d > 2) rod(o, 'metal', [a[0], h + 0.25, a[1]], [b[0], h + 0.25, b[1]], 0.018, 0, wire);
    }
  }
}
function tower(o, b, d) {
  const r = b.outline,
    c = [0, 1].map((k) => r.reduce((s, q) => s + q[k], 0) / r.length),
    rad = Math.max(...r.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]))),
    rr = Array.from({ length: 8 }, (_, i) => [
      c[0] + Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * rad,
      c[1] + Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * rad,
    ]),
    shaft = rr.map((q) => [c[0] + (q[0] - c[0]) * 0.79, c[1] + (q[1] - c[1]) * 0.79]);
  cap(o, 'plaster', shaft, 0, false);
  for (let i = 0; i < 8; i++) {
    const a = shaft[i],
      bb = shaft[(i + 1) % 8];
    Q(
      o,
      'plaster',
      [
        [a[0], 0, a[1]],
        [bb[0], 0, bb[1]],
        [bb[0], 6.3, bb[1]],
        [a[0], 6.3, a[1]],
      ],
      [bb[1] - a[1], 0, a[0] - bb[0]],
    );
    const f = face(shaft, i);
    if (d && i % 2 === 0) rect(o, 'glass', f, f.len / 2 - 0.16, 4.6, f.len / 2 + 0.16, 5.3, 0.008);
    const f2 = face(rr, i);
    rect(o, 'glass', f2, 0.03, 6.35, f2.len - 0.03, 7.9);
    if (d) {
      for (const x of [0])
        rod(o, 'metal', f2.P(x, 6.3), f2.P(x, 7.96), 0.065, d > 1 ? 1 : 0, white);
      rect(o, 'metal', f2, 0, 6.25, f2.len, 6.4, 0.03, white);
      rect(o, 'metal', f2, 0, 7.91, f2.len, 8.02, 0.07, white);
    }
    const a2 = rr[i],
      b2 = rr[(i + 1) % 8];
    T(
      o,
      'roof',
      [
        [a2[0], 8.02, a2[1]],
        [b2[0], 8.02, b2[1]],
        [c[0], 8.3, c[1]],
      ],
      [0, 1, 0],
    );
  }
  if (d > 1) {
    const y = 3.85;
    cap(o, 'roof', rr, y);
    for (let i = 0; i < 8; i++) {
      const f = face(rr, i);
      rod(o, 'metal', f.P(0, y + 0.05, 0.2), f.P(f.len, y + 0.05, 0.2), 0.045, 0, wire);
    }
  }
}
function exercise(o, b, d) {
  const r = b.outline;
  wall(o, [...r, r[0]], 3.2, d, 0.23, 'plaster');
  const min = [0, 1].map((k) => Math.min(...r.map((v) => v[k]))),
    max = [0, 1].map((k) => Math.max(...r.map((v) => v[k]))),
    n = d ? 8 : 3;
  for (let i = 1; i < n; i++) {
    const x = min[0] + ((max[0] - min[0]) * i) / n;
    wall(
      o,
      [
        [x, min[1]],
        [x, max[1]],
      ],
      3.2,
      d,
      0.18,
      'plaster',
    );
  }
  if (d > 1)
    for (let x = min[0]; x <= max[0]; x += 1.4)
      rod(o, 'metal', [x, 3.26, min[1]], [x, 3.26, max[1]], 0.025, 0, wire);
}
function canopy(o, b, d) {
  cap(o, 'roof', b.outline, 3.2);
  if (d) for (const q of b.outline) box(o, 'metal', q[0], 0, q[1], 0.14, 3.2, 0.14, wire);
}
function gate(o, d) {
  const a = p.gate[0],
    b = p.gate.at(-1),
    f = face([a, b, [b[0] + 1, b[1] + 1]], 0);
  for (const q of [a, b]) box(o, 'plaster', q[0], 0, q[1], 0.7, 4.2, 0.7);
  rod(o, 'plaster', f.P(0, 3.95), f.P(f.len, 3.95), 0.42, d ? 1 : 0);
  if (d) {
    for (const frac of [0.22, 0.78]) {
      const q = f.P(f.len * frac, 0, -0.55),
        end = [q[0] + f.n[0] * 2.8, 0, q[2] + f.n[2] * 2.8];
      for (const y of [0.2, 3.7])
        rod(o, 'metal', [q[0], y, q[2]], [end[0], y, end[2]], 0.065, d > 1 ? 1 : 0, wire);
      for (let j = 0; j <= 8; j++) {
        const t = j / 8;
        rod(
          o,
          'metal',
          [q[0] + (end[0] - q[0]) * t, 0.2, q[2] + (end[2] - q[2]) * t],
          [q[0] + (end[0] - q[0]) * t, 3.7, q[2] + (end[2] - q[2]) * t],
          0.035,
          0,
          wire,
        );
      }
    }
  }
}
function build(o, _frame, d = 3) {
  for (const b of p.buildings) {
    if (b.type === 'tower') {
      tower(o, b, d);
      continue;
    }
    if (b.type === 'exercise') {
      exercise(o, b, d);
      continue;
    }
    if (b.type === 'canopy') {
      canopy(o, b, d);
      continue;
    }
    if (d) cap(o, 'brick', b.outline, -0.12, false);
    for (let i = 0; i < b.outline.length; i++) facade(o, b, i, d);
    if (['hospital', 'annex-hip'].includes(b.type)) pitched(o, b, d);
    else cap(o, 'roof', b.outline, b.height);
  }
  for (const w of p.walls) wall(o, w.outline, w.height, d);
  gate(o, d);
  if (d > 1)
    for (const f of p.fences) {
      for (let i = 1; i < f.outline.length; i++) {
        const a = f.outline[i - 1],
          b = f.outline[i],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = Math.ceil(len / 4);
        for (let j = 0; j <= n; j++) {
          const q = mix(a, b, j / n);
          rod(o, 'metal', [q[0], 0, q[1]], [q[0], 3.5, q[1]], 0.035, 0, wire);
        }
        for (const y of [0.2, 1.6, 3.4])
          rod(o, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.025, 0, wire);
      }
    }
}
export const berlinHohenschonhausenSkyline = (o, f) => build(o, f, 0),
  berlinHohenschonhausenDistrict = (o, f) => build(o, f, 1),
  berlinHohenschonhausenStreet = (o, f) => build(o, f, 2),
  berlinHohenschonhausenCloseup = (o, f) => build(o, f, 3);
export const berlinHohenschonhausenModel = {
  id: 'berlin_hohenschonhausen_memorial',
  key: 'berlin_hohenschonhausen_memorial',
  cell: 'u3/u33',
  recipe: 'structure-berlin-hohenschonhausen-memorial.mjs',
  title: 'Berlin-Hohenschönhausen Memorial',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-210, 125, 195],
  lookAt: [-45, 3, 2],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.3, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-prison-complex-all-native-parts-and-courtyard-voids',
      position: [-205, 135, 190],
      lookAt: [-45, 3, 2],
      reviewLod: 'skyline',
    },
    {
      name: 'main-entrance-old-four-storey-brick-plaster-building-and-garages',
      position: [-158, 16, -12],
      lookAt: [-100, 6, -2],
    },
    {
      name: 'southwest-octagonal-watchtower-security-wall-hospital-and-exercise-yards',
      position: [-170, 24, 90],
      lookAt: [-105, 5, 43],
    },
    {
      name: 'whole-three-storey-cell-interrogation-u-and-open-courtyard',
      position: [85, 69, 65],
      lookAt: [-2, 6, -3],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129²field atfixedwestgateapproach frozenbeforegeometry, hostcontact/individualthresholds unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-berlin-hohenschonhausen-memorial.mjs',
    level: 'skyline',
    export: 'berlinHohenschonhausenSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'berlinHohenschonhausenDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'berlinHohenschonhausenStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'berlinHohenschonhausenCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'All20mappedintrinsicfeatures/161originaloutlinevertices retained independently ascontrol;threeupperwatchtowersregularizedto8photo-supportedfaceswithinoriginalextents:oldmain/attachedfactoryannexes/newcell/interrogationU/hospital/workshops/garages/canopy/exerciseyards/utility/3towers. Native4levels onnewprisoninterpreted3mainfloors+lowsemibasement; operator3floors/primaryoldmain2brick+2plaster/hospital2levels+halfhiproof controlverticalmassing. Heights13.5/12.6/6.4m andhospital9.2mridge/8.3mtower, hiddenwindowcensus/dormers/radio/paint/slateroofdetails bounded estimates. Nativewatchtowerheight6m/minheight4m nottreatedasfullmeasuredverticalsurvey; upperrooms/roof photo-proportioned8.3moverall. No filledcourtyard/siteparcel extrusion.',
    'Threeexplicitcreator-PDoriginals individuallyinspected, exactnativeSHA1/dimensions/bytes/revisions/authorgrants/originalownGermanuploadrowsbound. Qualla-first151families/0conflicts; dedicatedstorymodernphotosareCCBYSAandunused,87exterior/29mainnativefilescomplete. Platte/ChristianLiebscher2006PD-user-deentrance/corner,Langinger2009ownPD-releasegarages. Germantransferproofbindsitemgrant/profile/originalfile/name/ownstatement/log/dimensions/bytes;67focusedtests,no source metadata/category/articlebody edits. No restrictedpixels/phototextures/generatedbitmap/downloadedmesh.',
    'Wholepermanentcomplexrecognizableexterior, notsurvey-grade reconstruction: onlythreeclearedcomponentphotos,sohiddennewcellwindowfrostedpanels/grids/oldannexfenestration/hospitalhalfhipend/dormercensus/finecourtyardpartitions/currentmuseumadaptation/patina approximate. Garagecloseddoorsretainhistorichardware; laterglazingbehindthemnotassertedabsent. Openexerciseenclosure8representativebays,notcertifiedexactcensus. Skylinewindowdetails/roofhardware/wire/mesh simplify;allmasses/voids/threeoctagonalwatchtowers/gate/wallsremain.',
    'Sixboundedsecuritywalltraces includeoriginalnativewall367216300first12points,excludeitslongneighborhoodcontinuation. Entrancegate staysopenwithseparateleaves/posts/lintel. Nativebuilding:partwatchtowerduplicatesnotextra towers. Detachedgreen-whiteMfSadministrationblockseenbehindgarageandotheroutsidepropertybuildings excluded; no hugepavingslab/road/grass/tree/temporarysignage/exhibitionwagon/people/interiors.',
    'Independent256m129²fieldorigin[-160,-128]/2mstep/all16641samples/4rawTerrariumtiles/PNG frozenbeforegeometry unchanged. Fixedwestgateproviderdatum56.8198m,absolute55.2278–56.9414m; notthreshold/foundationsurvey. Flatportable/shared/contextfixtures separatefrom actualhostterraincontact,ordinarypreview/replaceFootprint=false; nofieldfitting/flattening/reacquisition.',
  ],
};
