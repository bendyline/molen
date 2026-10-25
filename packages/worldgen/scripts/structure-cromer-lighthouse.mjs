/** Cromer's complete connected octagonal lighthouse and three former keeper dwellings. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u1/u12/cromer_lighthouse/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  tc = p.tower.center,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('ecece5'),
    frame: rgb('e7e8e2'),
    green: rgb('36785d'),
    roof: rgb('535652'),
    glass: rgb('354344'),
    metal: rgb('afb3ab'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.95, metallic: 0 },
    frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.05 },
    green: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.99, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.32, metallic: 0.06 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.24 },
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
function opening(o, f, h, d, green = false) {
  const dep = d ? 0.22 : 0,
    trim = green ? 'green' : 'frame',
    x = (h.x0 + h.x1) / 2;
  rect(o, h.door ? 'green' : 'glass', f, h.x0, h.y0, h.x1, h.y1, d ? -dep : 0.008);
  if (!d) return;
  const v = [
    [h.x0, h.y0],
    [h.x1, h.y0],
    [h.x1, h.y1],
    [h.x0, h.y1],
  ];
  for (let k = 0; k < 4; k++) {
    const a = v[k],
      b = v[(k + 1) % 4],
      nx = -(b[1] - a[1]),
      ny = b[0] - a[0],
      n = [f.P(nx, ny)[0] - f.P(0, 0)[0], ny, f.P(nx, ny)[2] - f.P(0, 0)[2]];
    Q(o, 'wall', [f.P(...a), f.P(...b), f.P(...b, -dep), f.P(...a, -dep)], n);
  }
  for (const xx of [h.x0, h.x1])
    rect(o, 'frame', f, xx - 0.047, h.y0 - 0.05, xx + 0.047, h.y1 + 0.05, -0.07);
  for (const yy of [h.y0, h.y1])
    rect(o, 'frame', f, h.x0 - 0.05, yy - 0.047, h.x1 + 0.05, yy + 0.047, -0.07);
  if (!h.door) {
    rect(o, 'frame', f, x - 0.021, h.y0, x + 0.021, h.y1, -0.14);
    const rows = d === 1 ? 1 : h.short ? 1 : 4;
    for (let j = 1; j <= rows; j++) {
      const y = h.y0 + ((h.y1 - h.y0) * j) / (rows + 1);
      rect(o, 'frame', f, h.x0, y - 0.021, h.x1, y + 0.021, -0.14);
    }
    if (d > 1 && !h.short)
      for (const xx of [h.x0 + (h.x1 - h.x0) / 4, h.x0 + ((h.x1 - h.x0) * 3) / 4])
        rect(o, 'frame', f, xx - 0.015, h.y0, xx + 0.015, h.y1, -0.14);
  }
  Q(
    o,
    trim,
    [
      f.P(h.x0 - 0.1, h.y0 - 0.08),
      f.P(h.x1 + 0.1, h.y0 - 0.08),
      f.P(h.x1 + 0.1, h.y0 - 0.08, 0.14),
      f.P(h.x0 - 0.1, h.y0 - 0.08, 0.14),
    ],
    [0, 1, 0],
  );
  rect(o, trim, f, h.x0 - 0.1, h.y0 - 0.15, h.x1 + 0.1, h.y0 - 0.08, 0.14);
}
function facade(o, r, i, top, holes, d, green = false) {
  const f = face(r, i);
  if (!d) rect(o, 'wall', f, 0, -0.12, f.len, top);
  else {
    const ys = [-0.12, top, ...holes.flatMap((h) => [h.y0, h.y1])].sort((a, b) => a - b);
    for (let j = 1; j < ys.length; j++) {
      const y = (ys[j - 1] + ys[j]) / 2,
        hh = holes.filter((h) => y > h.y0 && y < h.y1).sort((a, b) => a.x0 - b.x0);
      let x = 0;
      for (const h of hh) {
        rect(o, 'wall', f, x, ys[j - 1], h.x0, ys[j]);
        x = h.x1;
      }
      rect(o, 'wall', f, x, ys[j - 1], f.len, ys[j]);
    }
  }
  for (const h of holes) opening(o, f, h, d, green);
  if (d > 0) rect(o, 'wall', f, 0, top - 0.16, f.len, top, 0.09);
}
function roofPlane(o, a, b, c, e, d, seed) {
  // Every slate lies on its own true roof plane, including tapered hip courses.
  const rows = [1, 4, 10, 19][d];
  for (let j = 0; j < rows; j++) {
    const t = j / rows,
      t1 = (j + 1) / rows,
      A = mix(a, c, t),
      B = mix(b, e, t),
      D = mix(a, c, t1),
      E = mix(b, e, t1),
      len = Math.hypot(...B.map((x, k) => x - A[k])),
      n = d < 2 ? 1 : Math.max(1, Math.ceil(len / [1, 1, 0.7, 0.42][d]));
    for (let k = 0; k < n; k++) {
      const q = [
          mix(A, B, k / n),
          mix(A, B, (k + 1) / n),
          mix(D, E, (k + 1) / n),
          mix(D, E, k / n),
        ],
        v = (((seed * 17 + j * 7 + k * 11) % 13) - 6) * 0.012;
      Q(o, 'roof', q, [0, 1, 0], vary(C.roof, 1 + v));
    }
  }
}
function cottage(o, part, idx, d) {
  const r = part.outline,
    top = part.eave,
    hip = part.roof === 'hipped';
  cap(o, 'wall', r, -0.12, false);
  for (let i = 0; i < 4; i++) {
    const f = face(r, i),
      holes = [];
    // Shared part seams remain solid partitions inside the attached aggregate.
    const internal =
      (idx === 0 && (i === 0 || i === 2)) || (idx === 1 && i === 0) || (idx === 2 && i === 1);
    if (!internal && !(idx === 2 && i === 3)) {
      const count = idx === 2 ? 2 : f.len > 8 ? 3 : 2;
      for (let j = 0; j < count; j++) {
        const x = (f.len * (j + 0.5)) / count,
          w = idx === 2 ? 0.85 : 1.0;
        for (const y of hip ? [0.65, 3.72] : [0.58])
          holes.push({
            x0: x - w / 2,
            x1: x + w / 2,
            y0: y,
            y1: y + (hip ? 1.72 : 1.85),
            door: idx === 2 && j === 1,
          });
      }
    }
    facade(o, r, i, top, holes, d, hip);
  }
  const cx = r.reduce((a, v) => a + v[0], 0) / 4,
    cz = r.reduce((a, v) => a + v[1], 0) / 4,
    q = r.map((v) => [
      v[0] + Math.sign(v[0] - cx) * 0.18,
      top + 0.03,
      v[1] + Math.sign(v[1] - cz) * 0.18,
    ]);
  if (hip) {
    const z0 = (q[0][2] + q[1][2]) / 2,
      z1 = (q[2][2] + q[3][2]) / 2,
      w = (q[1][0] + q[2][0] - q[0][0] - q[3][0]) / 2,
      hh = Math.min(w * 0.43, (z1 - z0) * 0.37),
      A = [cx, part.ridge, z0 + hh],
      B = [cx, part.ridge, z1 - hh];
    roofPlane(o, q[0], q[1], A, A, d, idx);
    roofPlane(o, q[1], q[2], A, B, d, idx + 2);
    roofPlane(o, q[2], q[3], B, B, d, idx + 4);
    roofPlane(o, q[3], q[0], B, A, d, idx + 6);
    if (d) rod(o, 'roof', A, B, 0.13, d);
  } else {
    const x0 = (q[0][0] + q[3][0]) / 2,
      x1 = (q[1][0] + q[2][0]) / 2,
      A = [x0, part.ridge, cz],
      B = [x1, part.ridge, cz];
    roofPlane(o, q[0], q[1], A, B, d, 7);
    roofPlane(o, q[2], q[3], B, A, d, 8);
    T(
      o,
      'wall',
      [
        [r[0][0], top, r[0][1]],
        [r[3][0], top, r[3][1]],
        [x0, part.ridge - 0.03, cz],
      ],
      [-1, 0, 0],
    );
    T(
      o,
      'wall',
      [
        [r[1][0], top, r[1][1]],
        [r[2][0], top, r[2][1]],
        [x1, part.ridge - 0.03, cz],
      ],
      [1, 0, 0],
    );
    if (d) rod(o, 'roof', A, B, 0.12, d);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      'frame',
      [[q[i][0], top - 0.08, q[i][2]], [q[j][0], top - 0.08, q[j][2]], q[j], q[i]],
      [q[j][2] - q[i][2], 0, q[i][0] - q[j][0]],
    );
    if (d > 1)
      rod(
        o,
        'metal',
        q[i].map((v, k) => (k === 1 ? v - 0.06 : v)),
        q[j].map((v, k) => (k === 1 ? v - 0.06 : v)),
        0.075,
        d,
      );
  }
  if (hip) {
    const chimneys =
      idx === 0
        ? [[cx, cz + 0.5]]
        : [
            [cx - 1, cz + 1.5],
            [cx + 1.6, cz - 1.5],
          ];
    for (const [x, z] of chimneys) {
      box(o, 'wall', x, part.ridge - 0.45, z, 0.63, 1.25, 0.8, vary(C.wall, 0.83));
      box(o, 'roof', x, part.ridge + 0.72, z, 0.77, 0.16, 0.93);
      if (d)
        for (const dx of [-0.16, 0.16])
          box(o, 'roof', x + dx, part.ridge + 0.86, z, 0.18, 0.24, 0.24);
    }
  }
  if (d > 1)
    for (const i of [1, 3]) {
      const q = face(r, i).P(0.18, 0, 0.04);
      rod(o, 'metal', [q[0], 0.1, q[2]], [q[0], top, q[2]], 0.07, d);
    }
}
const ring = (y, r, n = 8) =>
  Array.from({ length: n }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI * 2) / n;
    return [tc[0] + Math.cos(a) * r, y, tc[1] + Math.sin(a) * r];
  });
function lathe(o, s, pr, n, d = 1) {
  for (let j = 1; j < pr.length; j++) {
    const A = ring(...pr[j - 1], n),
      B = ring(...pr[j], n);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n + Math.PI / 8;
      Q(
        o,
        s,
        [A[i], A[k], B[k], B[i]],
        [Math.cos(a), pr[j][1] < pr[j - 1][1] ? 0.4 : 0, Math.sin(a)],
      );
    }
  }
  if (d) {
    cap(
      o,
      s,
      ring(...pr[0], n).map((v) => [v[0], v[2]]),
      pr[0][0],
      false,
    );
    cap(
      o,
      s,
      ring(...pr.at(-1), n).map((v) => [v[0], v[2]]),
      pr.at(-1)[0],
    );
  }
}
function tower(o, d) {
  const r = ring(0, 3.1).map((v) => [v[0], v[2]]);
  cap(o, 'wall', r, -0.12, false);
  for (let i = 0; i < 8; i++) {
    const f = face(r, i),
      holes = [],
      x = f.len / 2;
    if (i === 0 || i === 1) {
      const ys =
        i === 0
          ? [
              [1.1, 3.2],
              [6.1, 8.35],
              [10.9, 12.0],
            ]
          : [
              [4.9, 7.2],
              [10.6, 11.8],
            ];
      for (const [y0, y1] of ys)
        holes.push({
          x0: x - (y0 > 10 ? 0.48 : 0.42),
          x1: x + (y0 > 10 ? 0.48 : 0.42),
          y0,
          y1,
          short: y0 > 10,
        });
    }
    facade(o, r, i, 13.25, holes, d);
  }
  lathe(
    o,
    'wall',
    d
      ? [
          [13.2, 3.1],
          [13.35, 3.22],
          [13.6, 3.22],
          [13.65, 3.48],
          [13.82, 3.55],
          [13.95, 3.55],
        ]
      : [
          [13.2, 3.1],
          [13.95, 3.55],
        ],
    8,
  );
  // Octagonal open balustrade: separate vertical balusters, clear gaps, two slender rails.
  const railR = 3.36,
    rr = ring(0, railR),
    per = [2, 4, 6, 7][d];
  for (let i = 0; i < 8; i++) {
    const a = rr[i],
      b = rr[(i + 1) % 8];
    for (let k = 0; k < per; k++) {
      const x = mix(a, b, k / per);
      rod(o, 'frame', [x[0], 13.95, x[2]], [x[0], 15.05, x[2]], d === 0 ? 0.12 : 0.1, d);
    }
    for (const y of [14.01, 15.05]) rod(o, 'frame', [a[0], y, a[2]], [b[0], y, b[2]], 0.14, d);
  }
  const n = [12, 20, 32, 48][d];
  lathe(
    o,
    'frame',
    [
      [14.87, 1.4],
      [15.25, 1.4],
    ],
    n,
  );
  lathe(
    o,
    'glass',
    [
      [15.25, 1.29],
      [17, 1.29],
    ],
    n,
  );
  lathe(
    o,
    'metal',
    [
      [16.94, 1.43],
      [17.08, 1.43],
    ],
    n,
  );
  const panes = [6, 8, 12, 16][d];
  for (let i = 0; i < panes; i++) {
    const a = (Math.PI * 2 * i) / panes,
      x = tc[0] + Math.cos(a) * 1.31,
      z = tc[1] + Math.sin(a) * 1.31;
    rod(o, 'frame', [x, 15.2, z], [x, 17.04, z], d < 2 ? 0.065 : 0.045, d);
  }
  if (d)
    lathe(
      o,
      'frame',
      [
        [16.03, 1.32],
        [16.08, 1.32],
      ],
      n,
      0,
    );
  lathe(
    o,
    'metal',
    [
      [17.08, 1.43],
      [17.26, 1.22],
      [17.52, 0.63],
      [17.72, 0.44],
      [17.8, 0.44],
    ],
    n,
  );
  lathe(
    o,
    'frame',
    [
      [17.8, 0.42],
      [18, 0.28],
    ],
    d ? 12 : 6,
  );
  rod(o, 'metal', [tc[0], 18, tc[1]], [tc[0], 18.8, tc[1]], 0.045, d);
  if (d) {
    rod(o, 'metal', [tc[0] - 0.48, 18.5, tc[1]], [tc[0] + 0.52, 18.5, tc[1]], 0.035, d);
    Q(
      o,
      'metal',
      [
        [tc[0] - 0.42, 18.48, tc[1]],
        [tc[0] - 0.42, 18.68, tc[1]],
        [tc[0] - 0.08, 18.6, tc[1]],
        [tc[0] - 0.08, 18.51, tc[1]],
      ],
      [0, 0, 1],
      rgb('525950'),
    );
  }
  const masts =
    d === 0
      ? [[tc[0] - 2.25, tc[1] - 0.1, 21.1]]
      : [
          [tc[0] - 2.25, tc[1] - 0.1, 21.1],
          [tc[0] + 2.22, tc[1] - 0.2, 19.45],
        ];
  for (const [x, z, y] of masts) {
    rod(o, 'metal', [x, 14, z], [x, y, z], 0.055, d);
    if (d > 1 && y > 20) {
      box(o, 'metal', x, 19.4, z, 0.22, 0.65, 0.25);
      latheAt(
        o,
        x,
        z,
        [
          [20.45, 0.12],
          [20.56, 0.22],
          [20.95, 0.02],
        ],
        12,
      );
    }
  }
  if (d > 1) {
    const f = face(r, 0);
    for (const y of [5.9, 10.5])
      rod(o, 'metal', f.P(0.05, y, 0.025), f.P(f.len - 0.05, y, 0.025), 0.025, d);
  }
}
function latheAt(o, x, z, pr, n) {
  const proxy = {
    addTriangle(s, r, q, no, uv, c) {
      o.addTriangle(
        s,
        r,
        q.map((v) => [v[0] - tc[0] + x, v[1], v[2] - tc[1] + z]),
        no,
        uv,
        c,
      );
    },
  };
  lathe(proxy, 'metal', pr, n);
}
function build(o, _f, d = 3) {
  for (let i = 0; i < p.parts.length; i++) cottage(o, p.parts[i], i, d);
  tower(o, d);
}
export const cromerLighthouseSkyline = (o, f) => build(o, f, 0),
  cromerLighthouseDistrict = (o, f) => build(o, f, 1),
  cromerLighthouseStreet = (o, f) => build(o, f, 2),
  cromerLighthouseCloseup = (o, f) => build(o, f, 3);
export const cromerLighthouseModel = {
  id: 'cromer_lighthouse',
  key: 'cromer_lighthouse',
  cell: 'u1/u12',
  recipe: 'structure-cromer-lighthouse.mjs',
  title: 'Cromer Lighthouse',
  category: 'lighthouse',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [34, 23, 36],
  lookAt: [0, 8, 6],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.6, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-connected-octagonal-tower-and-three-keeper-dwellings',
      position: [30, 22, 38],
      lookAt: [0, 8, 6],
      reviewLod: 'skyline',
    },
    {
      name: 'stepped-gallery-open-white-balustrade-round-glazed-lantern',
      position: [17, 17, 13],
      lookAt: [5, 15.4, -0.86],
    },
    {
      name: 'two-hipped-cottage-wings-green-trim-and-low-gable-link',
      position: [-21, 10, 25],
      lookAt: [-2, 3.7, 8],
    },
    {
      name: 'whole-seaward-and-hidden-rear-attached-building',
      position: [-24, 19, -25],
      lookAt: [0, 7, 6],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129²field frozen at fixedNEapproach beforegeometry; actualcliffthreshold/foundations and livehostterraincontact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-cromer-lighthouse.mjs',
    level: 'skyline',
    export: 'cromerLighthouseSkyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'cromerLighthouseDistrict', errorMeters: 0.28, surfaces },
      street: { export: 'cromerLighthouseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'cromerLighthouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole1833octagonaltower and allconnectedkeeperaccommodation retained as two two-storeyhippedwings andlowgabledlink. Original9pointnativeaggregateoutline preserved incontrols; finepartsubdivision/towercentre[5,-.86]/3.1mradius/eaves5.8m/ridges7.65–7.8m/link3–4.6m estimatedfromsingleclearwholephoto. Official18mstructuraltower separatefrom84mMHWlight elevation; mainshaft13.25m/gallery13.95m/lantern17m/roof18m/finial18.8m/mast21.1m are photo-boundedintermediates andhardware, notsurveyedlevels.',
    'Qualla-first30families/0reservedconflicts;publishedmodernexteriors attribution-requiring andunused. OneStavros1own2007original:explicitnativePD-user-en grant boundtoexactsame-name/date/size/original-uploaddescription andnativeSHA1/originalpixels. NativePermissionabsent, acceptedonlybystrictsamelineoriginalphotographer-uploadproof; no source metadata/category/articlebody edits. Allarchitecturalreferencepixelsinspected; operator2025textconfirmssurvivingoctagonaltower/20thcenturylantern/threecottages. No restrictedphotos,photo-textures/generatedbitmap/downloadedmesh.',
    'Whiteeightflatshaftfaces/steppedcornices/physicallyopenwhiteoctagonalbalustrade/rounddarkglazedlantern/slimframes/grayroundedcap/weatherhardware. Twoobservedoffsetwindowstacks physicallyrecessedatdetailedLODs; whitecottagepaintedsashes/greensills/grayhippedslateroofs/chimneys/lowblankgablelink. Hiddenrearwindowcensus/roofvalleys/cottagepartitions/currentradiomastdetails,2007greenpaint/trimandpatina approximate. Skylinewindowdepth/slatecourses/finesashbarsandbalusters simplify; entireconnectedbody/crown preserved.',
    'Detachedgarage/chaletpark/golfclub/widerboundarywalls withoutwholetrace/yardpaving/grass/cliff/sea/trees/interiors excluded. No hugepropertyslab or inventedvisiblefoundation. Standaloneportable/shared/contextflatfixtures separatefrom truegeographicgrade; ordinarypreview/replaceFootprint=false.',
    'Independent256m129x129field/all16641values/twooriginalrawtiles/PNG frozenbeforegeometry unchanged; providerNEapproachdatum74.8043m,absolute47.3–75.4315m,relative-27.5043–.6272m. Terrainfieldisnotfinefoundation/cliffthreshold survey; actualhostcontactunverified. No terrainfit/flatten/reacquisition.',
  ],
};
