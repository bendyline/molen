/** Whole principal Miraflores Palace: original native courtyard, arcades and raised tiled pavilions. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/d9/d9b/miraflores_palace/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('d2cbb1'),
    trim: rgb('e5e5d9'),
    roof: rgb('aa6247'),
    wood: rgb('504537'),
    metal: rgb('475f52'),
    glass: rgb('425b56'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.08 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.06 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((v) => (Math.abs(normalFor(...q)[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, rings, y, up = true) {
  const ps = rings.flat(),
    hs = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((s, r) => s + r.length, 0)),
    ix = earcut(ps.flat(), hs);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [ps[k][0], y, ps[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
const area = (r) =>
  r.reduce((v, a, i) => v + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0);
function F(a, b, r, inward = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sign = Math.sign(area(r)) * (inward ? -1 : 1),
    n = [sign * u[1], 0, -sign * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function B(o, s, x, y, z, w, h, l) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], C[s]);
}
function strip(o, s, f, x, y, w, h, z = 0.1) {
  Q(
    o,
    s,
    [
      f.P(x - w / 2, y, z),
      f.P(x + w / 2, y, z),
      f.P(x + w / 2, y + h, z),
      f.P(x - w / 2, y + h, z),
    ],
    f.n,
  );
}
function arch(x, y, w, h, n, segmental = false) {
  const rx = w / 2,
    ry = segmental ? 0.42 : rx,
    shoulder = y + h - ry;
  return [
    [x - rx, y],
    [x + rx, y],
    ...Array.from({ length: n + 1 }, (_, j) => {
      const t = (j * Math.PI) / n;
      return [x + rx * Math.cos(t), shoulder + ry * Math.sin(t)];
    }),
  ];
}
function rect(x, y, w, h) {
  return [
    [x - w / 2, y],
    [x + w / 2, y],
    [x + w / 2, y + h],
    [x - w / 2, y + h],
  ];
}
function face(o, f, y0, y1, holes = [], slot = 'wall', fill = 'glass', depth = 0.45, back = false) {
  const ps = [
      [
        [0, y0],
        [f.len, y0],
        [f.len, y1],
        [0, y1],
      ],
      ...holes,
    ].flat(),
    hs = holes.map((_, i) => 4 + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    ix = earcut(ps.flat(), hs);
  for (const z of back ? [0, -depth] : [0])
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        slot,
        ix.slice(i, i + 3).map((k) => f.P(...ps[k], z)),
        z === 0 ? f.n : f.n.map((v) => -v),
      );
  for (const h of holes) {
    for (let j = 0; j < h.length; j++)
      Q(o, 'trim', [
        f.P(...h[j]),
        f.P(...h[(j + 1) % h.length]),
        f.P(...h[(j + 1) % h.length], -depth),
        f.P(...h[j], -depth),
      ]);
    if (fill) {
      const ids = earcut(h.flat());
      for (let i = 0; i < ids.length; i += 3)
        T(
          o,
          h.surface ?? fill,
          ids.slice(i, i + 3).map((k) => f.P(...h[k], -depth)),
          f.n,
        );
      if (back)
        for (let i = 0; i < ids.length; i += 3)
          T(
            o,
            h.surface ?? fill,
            ids.slice(i, i + 3).map((k) => f.P(...h[k], -depth - 0.01)),
            f.n.map((v) => -v),
          );
    }
  }
}
function lathe(o, s, x, z, rows, N) {
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        [y, r] = rows[j],
        [yy, rr] = rows[j + 1];
      Q(o, s, [
        [x + r * Math.sin(a), y, z + r * Math.cos(a)],
        [x + r * Math.sin(b), y, z + r * Math.cos(b)],
        [x + rr * Math.sin(b), yy, z + rr * Math.cos(b)],
        [x + rr * Math.sin(a), yy, z + rr * Math.cos(a)],
      ]);
    }
}
function balustrade(o, f, y, d) {
  if (d === 0) {
    strip(o, 'trim', f, f.len / 2, y, f.len, 0.82, 0.1);
    return;
  }
  beam(o, 'trim', f.P(0, y + 0.98, 0.04), f.P(f.len, y + 0.98, 0.04), 0.16, 0.22, C.trim);
  beam(o, 'trim', f.P(0, y + 0.08, 0.04), f.P(f.len, y + 0.08, 0.04), 0.12, 0.26, C.trim);
  const n = Math.max(1, Math.floor(f.len / [12, 6.5, 2.8, 1.0][d]));
  for (let i = 0; i <= n; i++) {
    const q = f.P((i * f.len) / n, 0, 0.04);
    if (d === 1) B(o, 'trim', q[0], y + 0.12, q[2], 0.17, 0.78, 0.17);
    else
      lathe(
        o,
        'trim',
        q[0],
        q[2],
        d === 2
          ? [
              [y + 0.12, 0.1],
              [y + 0.4, 0.18],
              [y + 0.72, 0.08],
              [y + 0.91, 0.11],
            ]
          : [
              [y + 0.12, 0.11],
              [y + 0.24, 0.11],
              [y + 0.42, 0.19],
              [y + 0.58, 0.17],
              [y + 0.78, 0.075],
              [y + 0.91, 0.11],
            ],
        d === 2 ? 4 : 6,
      );
  }
}
function ornament(o, f, x, y, d) {
  if (d < 2) return;
  const N = d === 2 ? 6 : 12,
    center = f.P(x, y, 0.2);
  for (let j = 0; j < N; j++) {
    const a = (j * 2 * Math.PI) / N,
      b = ((j + 1) * 2 * Math.PI) / N;
    T(
      o,
      'trim',
      [
        center,
        f.P(x + 0.27 * Math.cos(a), y + 0.22 * Math.sin(a), 0.17),
        f.P(x + 0.27 * Math.cos(b), y + 0.22 * Math.sin(b), 0.17),
      ],
      f.n,
    );
  }
  if (d === 3)
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++) {
        const a = j / 4,
          b = (j + 1) / 4;
        beam(
          o,
          'trim',
          f.P(x + side * (0.22 + 0.5 * a), y - 0.08 + 0.18 * Math.sin(a * Math.PI), 0.16),
          f.P(x + side * (0.22 + 0.5 * b), y - 0.08 + 0.18 * Math.sin(b * Math.PI), 0.16),
          0.07,
          0.09,
          C.trim,
        );
      }
}
function trimHole(o, f, h, d) {
  if (d < 1) return;
  const cx = (h[0][0] + h[1][0]) / 2,
    cy = (h[0][1] + Math.max(...h.map((v) => v[1]))) / 2,
    outer = h.map(([x, y]) => [cx + (x - cx) * 1.15, cy + (y - cy) * 1.065]);
  for (let i = 0; i < h.length; i++) {
    const j = (i + 1) % h.length;
    Q(
      o,
      'trim',
      [f.P(...h[i], 0.1), f.P(...h[j], 0.1), f.P(...outer[j], 0.12), f.P(...outer[i], 0.12)],
      f.n,
    );
  }
}
function exterior(o, d) {
  cap(o, 'trim', [p.outline, p.courtyard], 1.2);
  for (let i = 0; i < 4; i++) {
    const f = F(p.outline[i], p.outline[(i + 1) % 4], p.outline),
      count = d === 0 ? 3 : Math.max(3, Math.round(f.len / 6.4)) | 1,
      holes = [];
    for (let j = 0; j < count; j++) {
      const x = ((j + 0.5) * f.len) / count,
        door = i === 3 && j === Math.floor(count / 2),
        h = arch(x, door ? 1.2 : 1.7, door ? 3.2 : 2.0, door ? 4.7 : 3.9, [3, 4, 7, 12][d], true);
      h.surface = door ? 'wood' : 'glass';
      if (d >= 2) holes.push(h);
      else {
        const ids = earcut(h.flat());
        for (let k = 0; k < ids.length; k += 3)
          T(
            o,
            door ? 'wood' : 'glass',
            ids.slice(k, k + 3).map((k) => f.P(...h[k], 0.1)),
            f.n,
          );
      }
      trimHole(o, f, h, d);
      ornament(o, f, x, 6.23, d);
      if (d >= 2) {
        const w = door ? 3.2 : 2.0;
        for (let k = 1; k < (door ? 4 : 5); k++)
          strip(
            o,
            'metal',
            f,
            x - w / 2 + (k * w) / (door ? 4 : 5),
            door ? 1.4 : 1.9,
            0.035,
            door ? 4.0 : 3.3,
            -0.37,
          );
        strip(o, 'metal', f, x, 3.4, w, 0.055, -0.36);
      }
    }
    face(o, f, 0, 7.2, holes, 'wall', 'glass', 0.45, true);
    for (const [y, h] of [
      [0.75, 0.18],
      [6.7, 0.2],
      [7.05, 0.28],
    ]) {
      if (d === 0) strip(o, 'trim', f, f.len / 2, y, f.len, h, 0.12);
      else beam(o, 'trim', f.P(0, y, 0.13), f.P(f.len, y, 0.13), h, 0.38, C.trim);
    }
    if (d > 0)
      for (let j = 0; j <= count; j++) {
        const x = (j * f.len) / count;
        strip(o, 'trim', f, x, 1, 0.55, 5.7, 0.12);
        if (d >= 2)
          for (let k = 0; k < 12; k++) strip(o, 'wall', f, x, 1.2 + k * 0.44, 0.59, 0.065, 0.15);
      }
    balustrade(o, f, 7.2, d);
  }
}
function court(o, d) {
  const r = p.courtyard;
  cap(o, 'trim', [r], 1.15);
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4], r, true),
      n =
        d === 0
          ? 2
          : d === 1
            ? Math.max(2, Math.round(f.len / 12))
            : Math.max(3, Math.round(f.len / 6.0)),
      holes = [];
    for (let j = 0; j < n; j++) {
      const x = ((j + 0.5) * f.len) / n,
        w = Math.min(4.2, (f.len / n) * 0.72),
        h = arch(x, 1.2, w, 4.3, [3, 4, 8, 12][d]);
      holes.push(h);
    }
    face(o, f, 1.2, 5.8, holes, 'trim', null, d < 2 ? 0.18 : 0.34, d >= 1);
    balustrade(o, f, 5.8, d);
    if (d >= 2)
      for (let j = 0; j <= n; j++) {
        const q = f.P((j * f.len) / n, 0, 0.15);
        lathe(
          o,
          'trim',
          q[0],
          q[2],
          [
            [1.2, 0.29],
            [1.4, 0.3],
            [1.55, 0.21],
            [4.3, 0.19],
            [4.45, 0.32],
          ],
          d === 2 ? 6 : 10,
        );
        if (d === 3 && j % 2 === 0) {
          lathe(
            o,
            'trim',
            q[0],
            q[2],
            [
              [6.8, 0.18],
              [6.95, 0.11],
              [7.2, 0.27],
              [7.4, 0.12],
            ],
            8,
          );
        }
      }
  }
}
function roofs(o) {
  const panel = (o, s, q, n) => {
    Q(o, s, q, n);
    Q(o, s, [q[0], q[3], q[2], q[1]], [0, -1, 0]);
  };
  const outer = p.outline,
    inner = p.courtyard,
    mid = outer.map((q, i) => q.map((v, k) => (v + inner[i][k]) / 2));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    panel(
      o,
      'roof',
      [
        [outer[i][0], 7.2, outer[i][1]],
        [outer[j][0], 7.2, outer[j][1]],
        [mid[j][0], 8.8, mid[j][1]],
        [mid[i][0], 8.8, mid[i][1]],
      ],
      [0, 1, 0],
    );
    panel(
      o,
      'roof',
      [
        [mid[i][0], 8.8, mid[i][1]],
        [mid[j][0], 8.8, mid[j][1]],
        [inner[j][0], 5.8, inner[j][1]],
        [inner[i][0], 5.8, inner[i][1]],
      ],
      [0, 1, 0],
    );
  }
}
function pavilion(o, x, z, d) {
  const r = [
    [x - 4.15, z - 3.15],
    [x + 4.15, z - 3.15],
    [x + 4.15, z + 3.15],
    [x - 4.15, z + 3.15],
  ];
  for (let i = 0; i < 4; i++) {
    const f = F(r[i], r[(i + 1) % 4], r),
      h = rect(f.len / 2, 8.7, 1.7, 2.0);
    face(o, f, 7.2, 11.3, d >= 2 ? [h] : [], 'wall', 'glass', 0.45, true);
    if (d < 2) strip(o, 'glass', f, f.len / 2, 8.7, 1.7, 2, 0.1);
    trimHole(o, f, h, d);
    if (d >= 1) {
      beam(o, 'trim', f.P(0, 11.2, 0.06), f.P(f.len, 11.2, 0.06), 0.25, 0.3, C.trim);
      Q(
        o,
        'metal',
        [
          f.P(f.len / 2 - 1.2, 10.9, 0.1),
          f.P(f.len / 2 + 1.2, 10.9, 0.1),
          f.P(f.len / 2 + 1.2, 10.65, 0.9),
          f.P(f.len / 2 - 1.2, 10.65, 0.9),
        ],
        [0, 1, 0],
        C.trim,
      );
    }
  }
  const rows = [
    [11.3, 1.07],
    [13.6, 0.78],
    [14.3, 0.67],
  ];
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4,
        [y, s] = rows[j],
        [yy, ss] = rows[j + 1],
        P = (q, h, s) => [x + (q[0] - x) * s, h, z + (q[1] - z) * s];
      Q(o, 'roof', [P(r[i], y, s), P(r[k], y, s), P(r[k], yy, ss), P(r[i], yy, ss)], [0, 1, 0]);
    }
  cap(o, 'roof', [r.map((q) => [x + (q[0] - x) * 0.67, z + (q[1] - z) * 0.67])], 14.3);
}
function entry(o, d) {
  const z = p.frontZ,
    n = [2, 4, 6, 8][d];
  for (let j = 0; j < n; j++) {
    const y = (1.2 * (j + 1)) / n,
      r = 4.8 - (j * 1.4) / n,
      ring = [
        [-3, z - 0.05],
        [3, z - 0.05],
        ...Array.from({ length: [4, 8, 12, 16][d] + 1 }, (_, k) => {
          const a = (k * Math.PI) / [4, 8, 12, 16][d];
          return [r * Math.cos(a), z + 0.7 + r * Math.sin(a)];
        }),
      ];
    cap(o, 'trim', [ring], y);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      Q(o, 'trim', [
        [a[0], y - 1.2 / n, a[1]],
        [b[0], y - 1.2 / n, b[1]],
        [b[0], y, b[1]],
        [a[0], y, a[1]],
      ]);
    }
  }
  const P = (x, y, dz) => [x, y, z + dz],
    glass = rgb('acc5b8');
  Q(
    o,
    'glass',
    [P(-3, 5.35, 0.05), P(3, 5.35, 0.05), P(3, 4.8, 4.6), P(-3, 4.8, 4.6)],
    [0, 1, 0],
    glass,
  );
  for (const x of [-3, 3]) {
    beam(o, 'metal', P(x, 5.35, 0.05), P(x, 4.8, 4.6), 0.12, 0.12, C.trim);
    if (d > 0) {
      beam(o, 'metal', P(x, 1.2, 4.4), P(x, 4.8, 4.4), 0.12, 0.12, C.trim);
      for (let j = 0; j < 4; j++) {
        const a = j / 4,
          b = (j + 1) / 4;
        beam(
          o,
          'metal',
          P(x, 3.6 + 1.2 * a, 2.7 + 0.7 * Math.sin(a * Math.PI)),
          P(x, 3.6 + 1.2 * b, 2.7 + 0.7 * Math.sin(b * Math.PI)),
          0.05,
          0.06,
          C.trim,
        );
      }
    }
  }
  for (const t of [0, 0.5, 1])
    beam(
      o,
      'metal',
      P(-3, 5.35 - 0.55 * t, 0.05 + 4.55 * t),
      P(3, 5.35 - 0.55 * t, 0.05 + 4.55 * t),
      0.09,
      0.1,
      C.trim,
    );
  if (d > 0)
    for (const side of [-1, 1]) {
      const q0 = P(side * 3.0, 2.3, 0.3),
        q1 = P(side * 4.2, 1.15, 4.4);
      beam(o, 'trim', q0, q1, 0.15, 0.22, C.trim);
      const count = d === 1 ? 3 : d === 2 ? 5 : 8;
      for (let j = 0; j <= count; j++) {
        const t = j / count,
          q = q0.map((v, k) => v + (q1[k] - v) * t);
        lathe(
          o,
          'trim',
          q[0],
          q[2],
          [
            [q[1] - 1, 0.1],
            [q[1] - 0.8, 0.14],
            [q[1] - 0.5, 0.18],
            [q[1] - 0.1, 0.08],
          ],
          d === 3 ? 8 : 4,
        );
      }
    }
}
function fountain(o, d) {
  const c = p.courtyard.reduce((a, q) => a.map((v, k) => v + q[k] / 4), [0, 0]),
    [x, z] = c;
  for (const side of [-1, 1]) {
    B(o, 'trim', x + side * 3.2, 1.15, z, 0.3, 0.4, 5.6);
    B(o, 'trim', x, 1.15, z + side * 2.65, 6.4, 0.4, 0.3);
  }
  Q(
    o,
    'glass',
    [
      [x - 3, 1.42, z - 2.5],
      [x + 3, 1.42, z - 2.5],
      [x + 3, 1.42, z + 2.5],
      [x - 3, 1.42, z + 2.5],
    ],
    [0, 1, 0],
  );
  lathe(
    o,
    'metal',
    x,
    z,
    [
      [1.2, 0.7],
      [1.45, 0.7],
      [1.6, 0.25],
      [2.0, 0.2],
      [2.15, 1.35],
      [2.3, 1.4],
      [2.5, 0.24],
      [3.1, 0.17],
      [3.25, 0.95],
      [3.4, 1.0],
      [3.6, 0.16],
      [4.0, 0.12],
      [4.15, 0.05],
    ],
    [4, 6, 12, 20][d],
  );
}
function build(o, _f, d = 3) {
  exterior(o, d);
  court(o, d);
  roofs(o);
  for (const x of [-24.0, 24.0]) pavilion(o, x, p.frontZ - 3.75, d);
  entry(o, d);
  fountain(o, d);
}
export const mirafloresSkyline = (o, f) => build(o, f, 0),
  mirafloresDistrict = (o, f) => build(o, f, 1),
  mirafloresStreet = (o, f) => build(o, f, 2),
  mirafloresCloseup = (o, f) => build(o, f, 3);
export const mirafloresModel = {
  id: 'miraflores_palace',
  key: 'miraflores_palace',
  cell: 'd9/d9b',
  recipe: 'structure-miraflores-palace.mjs',
  title: 'Miraflores Palace, Caracas',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-69, 46, 84],
  lookAt: [0, 6, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.15, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-principal-palace-open-court-and-two-front-mansards',
      position: [-67, 50, 77],
      lookAt: [0, 5, 0],
    },
    {
      name: 'rusticated-window-recesses-cornices-balusters-and-mansard',
      position: [-43, 11, 47],
      lookAt: [-16, 6.2, 20],
    },
    {
      name: 'raised-curving-entry-stair-metal-and-glass-canopy',
      position: [-14, 7, 45],
      lookAt: [0, 3.6, 22],
    },
    {
      name: 'open-arcaded-courtyard-and-intrinsic-fountain',
      position: [3, 9, 7],
      lookAt: [3, 3.7, -12],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozenbeforegeometry; actualhostterrain/thresholdcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-miraflores-palace.mjs',
    level: 'skyline',
    export: 'mirafloresSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'mirafloresDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'mirafloresStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'mirafloresCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'ThreeexactpublishedClementeRJ/RJ1ownPD-self1996/1998Quallaoriginals inspected/nativeSHA1matched/item-specificgrantsbound/existingpolicypasses.34families/0conflicts; politicalhero/uncleararchival/USGovvisit/interiorpainting/historicversions/attribution-onlyimagesunused. No officialsourcephoto/architecturediagram/generatedbitmap/photo texture/downloadedmesh.',
    'Originalwhole4vertexouterand4vertexopeninnercourtyard retained withfullprincipalwings/back/sides. Nativecomponentheightsabsent: raisedfloor1.2m/mainwall7.2m/outerbalustrade8.3m/courtarcade5.8m/balustrade6.8m/wingridge8.8m/twofrontpavilions11.3m/mansard14.3m areoriginalphotoestimates. Westentryassignment/frontbearing/raisedpavilioncount/hiddenrear/roofprofiles/metricheight/currentcosmeticsbounded, notsurveyedcurrentcondition.',
    'Recognizablecreamrustication/tallwindowanddoorrecesses/whitearchframes/cornices/floralcartouches/stonebalusters, twofrontredtilemansardpavilions/upperwindows, raisedcurvedentry/wroughtmetalglasscanopy andwholeopenarcadedcourtyard/lowwingroofs/centralfountain. Representativewindow/arch/ornament/balustercounts; finepresidentialinsignia/letters/flags/interiors/plantings/palms/people/roofgearomitted. Intrinsiccourtyardpaving/fountainonly, neverroofedcourtyardorfullcompoundsitefloor.',
    'Independent400m129x129/16641values/4rawTerrariumtiles frozenbeforegeometryunchanged/no fit/flatten/reacquire. Portable/shared/contextflatstage separate; liveurbanhostterrain/thresholdcontactunverified. Nativepreview/replaceFootprint=false. Named6vertexpresidentialcompoundidentity-only; separateofficeblocks472476108/472476112/helipad1268322522/restofcompoundexcluded.',
  ],
};
