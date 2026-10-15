/** Getty Villa: two open peristyles, individual museum ranges and hillside terrace arcade. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, cleanRing, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  floor = 1,
  upper = 6.3;
const cream = rgb('e4dbc0'),
  marble = rgb('eee9da'),
  ochre = rgb('c8a566'),
  red = rgb('913e30'),
  black = rgb('514944'),
  tile = rgb('ad6650'),
  brick = rgb('9e7058'),
  paving = rgb('d4c7ad'),
  glass = rgb('3f514f');
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
function cap(o, r, y, s, c) {
  r = cleanRing(r);
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]);
    o.addTriangle(
      s,
      ref,
      p,
      [0, 1, 0],
      p.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function prism(o, r, lo, hi, s, c) {
  r = cleanRing(r);
  if (
    r.reduce(
      (a, p, i) => a + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) > 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    quad(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [a[1] - b[1], 0, b[0] - a[0]],
      c,
    );
  }
  cap(o, r, hi, s, c);
}
function rect(o, x0, z0, x1, z1, lo, hi, s = 'wall', c = cream) {
  B(o, s, (x0 + x1) / 2, lo, (z0 + z1) / 2, x1 - x0, hi - lo, z1 - z0, c);
}
function roofFace(o, p, d) {
  let n = normalFor(...p);
  if (n[1] < 0) n = n.map((v) => -v);
  quad(o, 'roof', p, n, tile);
  quad(
    o,
    'marble',
    p.map((v) => [v[0], v[1] - 0.12, v[2]]).reverse(),
    n.map((v) => -v),
    marble,
  );
  if (d > 2) {
    beam(o, 'roof', p[2], p[3], 0.16, 0.13, tile);
    const len = Math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
      num = Math.ceil(len / (d > 2 ? 1.05 : 6));
    for (let i = 0; i <= num; i++) {
      const t = i / num,
        a = p[0].map((v, k) => v * (1 - t) + p[1][k] * t),
        b = p[3].map((v, k) => v * (1 - t) + p[2][k] * t);
      a[1] += 0.03;
      b[1] += 0.03;
      beam(
        o,
        'roof',
        a,
        b,
        0.075,
        0.055,
        tile.map((v) => v * 1.1),
      );
    }
  }
}
function roofRing(o, outer, inner, ridge, eave, top, d) {
  const ring = (r, y) => [
      [r[0], y, r[1]],
      [r[2], y, r[1]],
      [r[2], y, r[3]],
      [r[0], y, r[3]],
    ],
    a = ring(outer, eave),
    b = ring(ridge, top),
    c = ring(inner, eave);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    roofFace(o, [a[i], a[j], b[j], b[i]], d);
    roofFace(o, [c[j], c[i], b[i], b[j]], d);
  }
}
function hip(o, x, z, w, dep, y, rise, d) {
  const f = facing(o, 0, x, z),
    k = Math.min(w, dep) * 0.34;
  const a = [
      [-w / 2, y, -dep / 2],
      [w / 2, y, -dep / 2],
      [w / 2, y, dep / 2],
      [-w / 2, y, dep / 2],
    ],
    b = [
      [-w / 2 + k, y + rise, -dep / 2 + k],
      [w / 2 - k, y + rise, -dep / 2 + k],
      [w / 2 - k, y + rise, dep / 2 - k],
      [-w / 2 + k, y + rise, dep / 2 - k],
    ];
  for (let i = 0; i < 4; i++) roofFace(f, [a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]], d);
  cap(
    f,
    b.map((v) => [v[0], v[2]]),
    y + rise,
    'roof',
    tile,
  );
}
function column(o, x, z, y, h, d, order = 'plain', redBase = false) {
  const f = facing(o, 0, x, z),
    n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16,
    r = 0.27;
  const profile =
    d < 2
      ? [
          [0, r],
          [h - 0.16, r * 0.78],
        ]
      : d === 2
        ? [
            [0, r],
            [h - 0.16, r * 0.78],
          ]
        : [
            [0, r * 1.35],
            [0.12, r * 1.35],
            [0.21, r],
            [h - 0.52, r * 0.78],
            [h - 0.33, r * 1.03],
            [h - 0.16, r * 1.4],
          ];
  loft(
    f,
    'marble',
    profile.map(([v, rr]) => radialRing(y + v, rr, rr, n)),
    marble,
    { cap: false },
  );
  if (d) {
    B(f, 'marble', 0, y + h - 0.16, 0, 0.83, 0.16, 0.77, marble);
    if (redBase) {
      loft(
        f,
        'wall',
        [
          radialRing(y + 0.22, r + 0.012, r + 0.012, n),
          radialRing(y + 1.35, r * 0.94 + 0.012, r * 0.94 + 0.012, n),
        ],
        red,
        { cap: false },
      );
    }
  }
  if (d > 2) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        b = a + 0.055,
        rr = r - 0.01,
        p = [a, b].map((v) => [Math.sin(v) * rr, Math.cos(v) * rr]);
      quad(
        f,
        'marble',
        [
          [p[0][0], y + 0.3, p[0][1]],
          [p[1][0], y + 0.3, p[1][1]],
          [p[1][0] * 0.8, y + h - 0.54, p[1][1] * 0.8],
          [p[0][0] * 0.8, y + h - 0.54, p[0][1] * 0.8],
        ],
        [Math.sin(a), 0, Math.cos(a)],
        marble.map((v) => v * 0.73),
      );
    }
    if (order === 'ionic') {
      for (const xx of [-0.33, 0.33])
        for (const zz of [-0.33, 0.33]) {
          const p = Array.from({ length: 8 }, (_, i) => [
            xx + Math.sin((i * Math.PI) / 4) * 0.16,
            y + h - 0.29 + Math.cos((i * Math.PI) / 4) * 0.14,
            zz,
          ]);
          f.addConvexPolygon(
            'marble',
            ref,
            p,
            [0, 0, Math.sign(zz)],
            (p) => [p[0], p[1]],
            marble.map((v) => v * 0.83),
          );
        }
    }
    if (order === 'corinthian') {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        beam(
          f,
          'marble',
          [Math.sin(a) * 0.2, y + h - 0.65, Math.cos(a) * 0.2],
          [Math.sin(a) * 0.36, y + h - 0.34, Math.cos(a) * 0.36],
          0.09,
          0.07,
          marble,
        );
      }
    }
  }
}
function series(o, a, x, z, w, y, h, d, order = 'plain', redBase = false) {
  const f = facing(o, a, x, z),
    n = Math.round(w / 2.8),
    skip = d === 0 ? 4 : d === 1 ? 2 : 1;
  for (let i = 0; i <= n; i += skip) column(f, -w / 2 + (w * i) / n, 0, y, h, d, order, redBase);
  if (n % skip) column(f, w / 2, 0, y, h, d, order, redBase);
  B(f, 'marble', 0, y + h, 0, w + 1, 0.22, 0.7, marble);
  if (d) B(f, 'wall', 0, y + h + 0.22, 0, w + 1, 0.3, 0.66, red);
}
function window(o, x, y, w, h, d) {
  if (!d) return;
  face(o, 'glass', x, y, 0.08, w, h, glass);
  if (d === 2) {
    for (const xx of [x - w / 2, x + w / 2])
      face(o, 'marble', xx, y - 0.07, 0.14, 0.12, h + 0.14, marble);
    for (const yy of [y - 0.12, y + h]) face(o, 'marble', x, yy, 0.14, w + 0.3, 0.12, marble);
    return;
  }
  if (d > 2) {
    for (const xx of [x - w / 2, x + w / 2])
      B(o, 'marble', xx, y - 0.07, 0.12, 0.12, h + 0.14, 0.12, marble);
    for (const yy of [y - 0.12, y + h]) B(o, 'marble', x, yy, 0.12, w + 0.3, 0.12, 0.12, marble);
    if (w > 1.1) face(o, 'marble', x, y, 0.18, 0.065, h, marble);
    for (let j = 1; j < 4; j++) face(o, 'marble', x, y + (h * j) / 4, 0.18, w, 0.045, black);
  }
}
function mural(o, w, y, h, d) {
  if (!d) return;
  face(o, 'wall', 0, y, 0.025, w, h, ochre);
  face(o, 'wall', 0, y, 0.045, w, 0.7, black);
  face(o, 'wall', 0, y + 0.7, 0.05, w, 0.17, red);
  if (d > 1) {
    const n = Math.ceil(w / 3);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n;
      for (const xx of [x - (w / n) * 0.39, x + (w / n) * 0.39]) {
        face(o, 'wall', xx, y + 0.95, 0.07, 0.1, h - 1.23, red);
        face(o, 'marble', xx + 0.12, y + 0.95, 0.075, 0.035, h - 1.23, marble);
      }
      for (const yy of [y + 0.95, y + h - 0.28])
        face(o, 'wall', x, yy, 0.07, (w / n) * 0.8, 0.09, red);
      if (d > 2) {
        face(o, 'wall', x, y + 1.1, 0.08, 0.045, h - 1.7, cream);
        face(o, 'wall', x, y + h - 0.43, 0.08, (w / n) * 0.52, 0.045, cream);
      }
    }
  }
}
function rail(o, w, y, d) {
  if (!d) return;
  B(o, 'marble', 0, y + 0.83, 0, w, 0.15, 0.28, marble);
  B(o, 'marble', 0, y, 0, w, 0.12, 0.22, marble);
  if (d > 1)
    for (let i = 0, n = Math.ceil(w / (d > 2 ? 0.44 : 0.85)); i <= n; i++) {
      const x = -w / 2 + (i * w) / n;
      face(o, 'marble', x, y + 0.12, 0.075, 0.11, 0.72, marble);
      face(facing(o, Math.PI), 'marble', -x, y + 0.12, 0.075, 0.11, 0.72, marble);
      if (d > 2) {
        face(o, 'marble', x, y + 0.31, 0.085, 0.17, 0.27, marble);
        face(facing(o, Math.PI), 'marble', -x, y + 0.31, 0.085, 0.17, 0.27, marble);
      }
    }
}
function pilasters(o, w, y, h, d) {
  if (d < 2) return;
  const n = Math.round(w / 2.8);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    B(o, 'marble', x, y, 0.09, 0.27, h, 0.2, marble);
    B(o, 'marble', x, y + h - 0.26, 0.11, 0.55, 0.26, 0.3, marble);
    B(o, 'marble', x, y, 0.1, 0.46, 0.15, 0.3, marble);
  }
}
function pediment(o, w, y, rise, d) {
  const p = [
    [-w / 2, y, 0.12],
    [w / 2, y, 0.12],
    [0, y + rise, 0.12],
  ];
  o.addTriangle(
    'marble',
    ref,
    p,
    [0, 0, 1],
    p.map((v) => [v[0], v[1]]),
    marble,
  );
  if (d)
    for (const s of [-1, 1])
      beam(
        o,
        'marble',
        [(s * w) / 2, y + 0.08, 0.18],
        [0, y + rise + 0.08, 0.18],
        0.13,
        0.17,
        marble,
      );
}
function pool(o, x, z, w, len, d) {
  const n = d < 2 ? 3 : 12,
    r = w * 0.34,
    half = len / 2 - r;
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = (i * Math.PI) / n;
    ring.push([x + Math.cos(a) * r, z + half + Math.sin(a) * r]);
  }
  ring.push([x - w / 2, z + half], [x - w / 2, z - half]);
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i * Math.PI) / n;
    ring.push([x + Math.cos(a) * r, z - half + Math.sin(a) * r]);
  }
  ring.push([x + w / 2, z - half], [x + w / 2, z + half]);
  const inner = ring.map((p) => [x + (p[0] - x) * 0.92, z + (p[1] - z) * 0.989]);
  if (!d) {
    prism(o, ring, floor + 0.02, floor + 0.38, 'marble', marble);
    cap(o, inner, floor + 0.46, 'pool', rgb('68a9b2'));
  } else {
    // Open basin rim: the water does not overlap a nearly coplanar stone cap.
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length,
        a = ring[i],
        b = ring[j],
        c = inner[j],
        e = inner[i];
      quad(
        o,
        'marble',
        [
          [a[0], floor + 0.38, a[1]],
          [b[0], floor + 0.38, b[1]],
          [c[0], floor + 0.38, c[1]],
          [e[0], floor + 0.38, e[1]],
        ],
        [0, 1, 0],
        marble,
      );
      for (const [l, r, sign] of [
        [a, b, 1],
        [e, c, -1],
      ])
        quad(
          o,
          'marble',
          [
            [l[0], floor + 0.02, l[1]],
            [r[0], floor + 0.02, r[1]],
            [r[0], floor + 0.38, r[1]],
            [l[0], floor + 0.38, l[1]],
          ],
          [sign * (r[1] - l[1]), 0, sign * (l[0] - r[0])],
          marble,
        );
    }
    cap(o, inner, floor + 0.23, 'pool', rgb('68a9b2'));
  }
  if (d > 1) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      beam(o, 'marble', [a[0], floor + 0.42, a[1]], [b[0], floor + 0.42, b[1]], 0.18, 0.13, marble);
    }
  }
}
function arch(o, x, w, d) {
  const r = w / 2,
    shoulder = -4.1,
    n = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n,
      l = x + Math.cos(a) * r,
      q = x + Math.cos(b) * r,
      ya = shoulder + Math.sin(a) * r,
      yb = shoulder + Math.sin(b) * r;
    for (const [z, normal] of [
      [-0.7, [0, 0, -1]],
      [0.7, [0, 0, 1]],
    ])
      quad(
        o,
        'brick',
        [
          [l, ya, z],
          [q, yb, z],
          [q, 0.55, z],
          [l, 0.55, z],
        ],
        normal,
        brick,
      );
    quad(
      o,
      'brick',
      [
        [l, ya, -0.7],
        [q, yb, -0.7],
        [q, yb, 0.7],
        [l, ya, 0.7],
      ],
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
      brick,
    );
    if (d > 1) {
      quad(
        o,
        'marble',
        [
          [x + Math.cos(a) * (r + 0.23), shoulder + Math.sin(a) * (r + 0.23), 0.74],
          [x + Math.cos(b) * (r + 0.23), shoulder + Math.sin(b) * (r + 0.23), 0.74],
          [q, yb, 0.74],
          [l, ya, 0.74],
        ],
        [0, 0, 1],
        brick.map((v) => v * 1.3),
      );
    }
  }
}
function terrace(o, d) {
  rect(o, -25.5, 77, 23, 83, 0.5, 1, 'marble', paving);
  const f = facing(o, 0, -1.25, 82);
  for (let i = 0; i < 7; i++) {
    const x = -20.4 + i * 6.8;
    arch(f, x, 5.3, d);
    B(f, 'brick', x - 3.4, -9.8, 0, 1.5, 10.3, 1.4, brick);
  }
  B(f, 'brick', 23.8, -9.8, 0, 1.5, 10.3, 1.4, brick);
  for (const x of [-28.7, 25.7]) {
    rect(o, x - 3, 77.5, x + 3, 89.3, -10, 1, 'brick', brick);
    for (const xx of [x - 2.7, x + 2.7]) column(o, xx, 86.6, 1, 3.4, d);
    B(o, 'wall', x, 1, 78, 6, 3.4, 0.5, cream);
    hip(o, x, 84, 7, 11, 4.8, 1.1, d);
    rail(facing(o, 0, x, 89.2), 5.4, 1, d);
  }
  for (const x of [-36, 35.5]) {
    rect(o, x - 4, 77.5, x + 4, 82.8, -9.6, 1, 'brick', brick);
    rail(facing(o, 0, x, 82.8), 8, 1, d);
  }
  rail(facing(o, 0, -1.25, 83), 48, 1, d);
}
function corridor(o, a, x, z, len, d, openBack = false) {
  const f = facing(o, a, x, z);
  rect(f, -len / 2, -5, len / 2, 0, -3.3, 1, 'marble', paving);
  if (!openBack) {
    B(f, 'wall', 0, 1, -4.8, len, 4.45, 0.4, cream);
    mural(facing(f, 0, 0, -4.55), len, 1, 4.2, d);
  }
  series(f, 0, 0, -0.35, len - 0.8, 1, 3.65, d);
  roofFace(
    f,
    [
      [-len / 2 - 0.25, 5.05, 0.35],
      [len / 2 + 0.25, 5.05, 0.35],
      [len / 2 + 0.25, 5.8, -5.25],
      [-len / 2 - 0.25, 5.8, -5.25],
    ],
    d,
  );
  if (d > 1) {
    const n = Math.ceil(len / 2.8);
    for (let i = 0; i < n; i++) {
      const xx = -len / 2 + ((i + 0.5) * len) / n;
      B(f, 'marble', xx, 4.62, -2.3, 0.15, 0.18, 4.25, marble);
      if (d > 2)
        for (const zz of [-1.3, -2.5, -3.7]) {
          B(f, 'marble', xx, 4.6, zz, 2.2, 0.08, 0.07, marble);
        }
    }
  }
}
function skyline(o) {
  for (const [x0, z0, x1, z1] of [
    [-22.5, -74, 22, -58.6],
    [-22.5, -39, 22, -24],
    [-22.5, -58.6, -11, -39],
    [8.6, -58.6, 22, -39],
  ])
    rect(o, x0, z0, x1, z1, -3, 11.65);
  roofRing(
    o,
    [-23.1, -74.6, 22.6, -23.4],
    [-10.5, -58.1, 8.1, -39.5],
    [-16.4, -66.6, 15.3, -31.4],
    11.7,
    13.8,
    0,
  );
  rect(o, -14, -62, 12, -36, -2.5, 1, 'marble', paving);
  pool(o, -1.2, -48.8, 2.8, 13, 0);
  rect(o, -38, -67, -22.5, -31, -2, 10.9);
  hip(o, -30.25, -49, 16.5, 37, 11, 1.4, 0);
  rect(o, -44, -67, -38, -31, 6.08, 6.3, 'marble', marble);
  series(o, -Math.PI / 2, -43.5, -49, 34.6, 1, 4.75, 0);
  roofFace(
    o,
    [
      [-44, 10, -67],
      [-44, 10, -31],
      [-38, 11.1, -31],
      [-38, 11.1, -67],
    ],
    0,
  );
  for (const x of [-18.2, 15.5]) {
    rect(o, x - 3, -24.1, x + 3, -18, -3, 11.65);
    hip(o, x, -21.7, 7, 8, 11.7, 0.85, 0);
  }
  rect(o, -15.2, -24, 12.5, -18, 6, 6.3, 'marble', marble);
  series(o, 0, -1.35, -18.5, 27, 1, 4.75, 0);
  rect(o, -20.5, -18, 18.2, 77.8, -3.3, 1, 'marble', paving);
  rect(o, 17.6, -18, 18.2, 78, -10, 1, 'brick', brick);
  corridor(o, Math.PI / 2, -15.5, 29.5, 95, 0);
  corridor(o, -Math.PI / 2, 13.1, 29.5, 95, 0);
  corridor(o, Math.PI, -1.2, 72.7, 28.6, 0, true);
  pool(o, -1.2, 28.3, 8.4, 70, 0);
  rect(o, -40, 77, 40, 83, 0.5, 1, 'marble', paving);
  const f = facing(o, 0, -1.25, 82);
  for (let i = 0; i < 5; i++) {
    const x = -19.2 + i * 9.6;
    arch(f, x, 7.5, 0);
    B(f, 'brick', x - 4.8, -9.8, 0, 2.1, 10.3, 1.4, brick);
  }
  B(f, 'brick', 24, -9.8, 0, 2.1, 10.3, 1.4, brick);
  for (const x of [-28.7, 25.7]) {
    rect(o, x - 3, 77.5, x + 3, 89.3, -10, 1, 'brick', brick);
    for (const xx of [x - 2.7, x + 2.7]) column(o, xx, 86.6, 1, 3.4, 0);
    hip(o, x, 84, 7, 11, 4.8, 1.1, 0);
  }
}
export function getty(o, _frame, d = 3) {
  if (d === 0) return skyline(o);
  // The museum surrounds a genuinely open inner court. Lower galleries are recessed behind its colonnade.
  for (const [x0, z0, x1, z1] of [
    [-22.5, -74, 22, -62],
    [-22.5, -36, 22, -24],
    [-22.5, -62, -14.1, -36],
    [11.7, -62, 22, -36],
  ])
    rect(o, x0, z0, x1, z1, -3, upper);
  for (const [x0, z0, x1, z1] of [
    [-22.5, -74, 22, -58.6],
    [-22.5, -39, 22, -24],
    [-22.5, -58.6, -11, -39],
    [8.6, -58.6, 22, -39],
  ])
    rect(o, x0, z0, x1, z1, upper, 11.65);
  rect(o, -14.1, -62, 11.7, -36, -2.5, 1, 'marble', paving);
  roofRing(
    o,
    [-23.1, -74.6, 22.6, -23.4],
    [-10.5, -58.1, 8.1, -39.5],
    [-16.4, -66.6, 15.3, -31.4],
    11.7,
    13.8,
    d,
  );
  // Shallow northern gallery projection follows the mapped museum envelope.
  rect(o, -7.9, -77, 5.6, -74, -2, 11.5);
  hip(o, -1.15, -75.4, 14.4, 4.3, 11.6, 0.75, d);
  // South projecting end rooms and upper balcony above an open lower porch.
  for (const x of [-18.2, 15.5]) {
    rect(o, x - 3, -24.1, x + 3, -18.0, -3, 11.65);
    hip(o, x, -21.7, 7, 8, 11.7, 0.85, d);
    const f = facing(o, 0, x, -17.99);
    for (const xx of [-1.15, 0, 1.15]) window(f, xx, 7.65, 0.85, 2.3, d);
    pediment(f, 6.2, 11.6, 0.65, d);
  }
  rect(o, -15.2, -24, 12.5, -18, upper - 0.3, upper, 'marble', marble);
  series(o, 0, -1.35, -18.5, 27.0, 1, 4.75, d, 'corinthian', true);
  rail(facing(o, 0, -1.35, -18.05), 27.5, upper, d);
  const sf = facing(o, 0, -1.35, -23.98);
  mural(sf, 27.2, 1, 4.55, d);
  window(sf, 0, 1, 2.3, 3.7, d);
  for (const x of [-5.6, 5.6]) window(sf, x, 2, 1.2, 2, d);
  pilasters(sf, 27, upper + 0.25, 4.5, d);
  for (const x of [-2.8, 0, 2.8]) window(sf, x, upper + 0.4, x === 0 ? 1.5 : 1, 3.05, d);
  pediment(sf, 5.3, 11.4, 0.7, d);
  // Inner Ionic colonnade with upper pilaster rhythm and coffered walks.
  for (const [a, x, z, w] of [
    [0, -1.2, -59.2, 19.4],
    [Math.PI, -1.2, -38.4, 19.4],
    [Math.PI / 2, -11.6, -48.8, 20.8],
    [-Math.PI / 2, 9.2, -48.8, 20.8],
  ]) {
    series(o, a, x, z, w, 1, 4.7, d, 'ionic');
    const f = facing(o, a, x, z);
    B(f, 'marble', 0, 5.75, -1.1, w + 1, 0.25, 3.0, marble);
    if (d > 1)
      for (let i = 0; i < Math.round(w / 2.8); i++)
        B(f, 'marble', -w / 2 + (i + 0.5) * 2.8, 5.55, -1.1, 2.3, 0.12, 0.11, marble);
    const wall = facing(f, 0, 0, -2.5);
    mural(wall, w, 1, 4.5, d);
    for (let i = 0; i < 3; i++) window(wall, (i - 1) * 5.6, 2, 1.25, 2, d);
    const uf = facing(f, 0, 0, 0.6);
    pilasters(uf, w, 6.6, 4.5, d);
    for (let i = 0; i < 4; i++) window(uf, (i - 1.5) * 4.4, 7.1, 1.2, 2.7, d);
  }
  pool(o, -1.2, -48.8, 2.8, 13, d);
  // West atrium wing and two-storey entrance porch facing the modern theater.
  for (const [x0, z0, x1, z1] of [
    [-38, -67, -22.5, -55.7],
    [-38, -43, -22.5, -31],
    [-38, -55.7, -34.5, -43],
    [-26, -55.7, -22.5, -43],
  ])
    rect(o, x0, z0, x1, z1, -2, 10.9);
  roofRing(
    o,
    [-38.5, -67.5, -22, -30.5],
    [-34.2, -55.4, -26.3, -43.3],
    [-36.3, -61.5, -24.4, -37],
    11,
    12.4,
    d,
  );
  rect(o, -34.5, -55.7, -26, -43, 10.7, 10.78, 'glass', glass);
  if (d > 1)
    for (let j = 0; j < 6; j++)
      B(o, 'marble', -30.25, 10.81, -55.5 + j * 2.4, 8.5, 0.08, 0.07, marble);
  rect(o, -44, -67, -38, -31, 0.6, 1, 'marble', paving);
  rect(o, -44, -67, -38, -31, upper - 0.22, upper, 'marble', marble);
  series(o, -Math.PI / 2, -43.5, -49, 34.6, 1, 4.75, d, 'corinthian', true);
  const wf = facing(o, -Math.PI / 2, -38.03, -49);
  mural(wf, 35.8, 1, 4.7, d);
  window(wf, 0, 1, 3, 4, d);
  window(wf, 0, 6.5, 2.4, 3, d);
  for (const xx of [-11, -5.7, 5.7, 11]) window(wf, xx, 7.1, 1.2, 1.9, d);
  const wp = facing(o, -Math.PI / 2, -43.5, -49);
  if (d) {
    const n = d === 1 ? 6 : 12;
    for (let i = 0; i <= n; i++) {
      const x = -17.3 + (i * 34.6) / n;
      B(wp, 'marble', x, upper, 0, 0.22, 3.5, 0.24, marble);
      B(wp, 'wall', x, upper, 0, 0.27, 0.6, 0.29, black);
    }
  }
  rail(wp, 34.6, upper, d);
  roofFace(
    wp,
    [
      [-18, 10, 0.6],
      [18, 10, 0.6],
      [18, 11.1, -5.9],
      [-18, 11.1, -5.9],
    ],
    d,
  );
  // Exterior gallery windows and cream stringcourses; no invented modern campus masses.
  for (const [a, x, z, w] of [
    [Math.PI, -0.25, -74.01, 44.5],
    [Math.PI / 2, 22.01, -49, 50],
    [-Math.PI / 2, -38.01, -61.3, 11.4],
    [-Math.PI / 2, -38.01, -37, 12],
  ]) {
    const f = facing(o, a, x, z);
    for (const y of [upper - 0.1, 11.3]) if (d) B(f, 'marble', 0, y, 0.04, w, 0.18, 0.15, marble);
    if (d)
      for (let i = 0, n = Math.floor(w / 6); i < n; i++) {
        const xx = -w / 2 + ((i + 0.5) * w) / n;
        window(f, xx, 7.3, 1.35, 2.6, d);
        if (d > 1) window(f, xx, 2.4, 1.25, 2.3, d);
      }
  }
  // Raised outer court: sloping independent ground remains under the built platform.
  rect(o, -20.5, -18, 18.2, 77.8, -3.3, 1, 'marble', paving);
  rect(o, 17.6, -18, 18.2, 78, -10, 1, 'brick', brick);
  corridor(o, Math.PI / 2, -15.5, 29.5, 95, d);
  corridor(o, -Math.PI / 2, 13.1, 29.5, 95, d);
  corridor(o, Math.PI, -1.2, 72.7, 28.6, d, true);
  // The south screen is open to the viewing terrace, with small solid end pylons.
  rect(o, -20.5, 77, -15.5, 78, 1, 5.65);
  rect(o, 13.1, 77, 18.2, 78, 1, 5.65);
  series(o, 0, -1.2, 77.5, 27.4, 1, 3.7, d);
  for (const x of [-18, 15.7]) window(facing(o, 0, x, 78.02), 0, 2.2, 1.1, 1.9, d);
  pool(o, -1.2, 28.3, 8.4, 70, d);
  if (d) {
    for (const x of [-10.2, 7.8]) {
      for (let j = 0; j < 5; j++) {
        const z = -5 + j * 16;
        rect(o, x - 2.05, z, x + 2.05, z + 12, 1.01, 1.06, 'wall', rgb('8f8b66'));
        if (d > 1)
          for (const xx of [x - 2.1, x + 2.1])
            B(o, 'marble', xx, 1.04, z + 6, 0.1, 0.13, 12.2, marble);
      }
    }
  }
  terrace(o, d);
}
export function gettySkyline(o) {
  getty(o, undefined, 0);
}
export function gettyDistrict(o) {
  getty(o, undefined, 1);
}
export function gettyStreet(o) {
  getty(o, undefined, 2);
}
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_limestone', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.9, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
  pool: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.2, metallic: 0.12 },
};
export const gettyModel = {
  id: 'getty_villa',
  recipe: 'structure-getty-villa.mjs',
  key: 'getty_villa',
  cell: '9q/9q5',
  title: 'Getty Villa',
  brief:
    'Roman villa museum with cream gallery ranges around an open inner peristyle, west atrium and double-height entrance porch, south balcony between projecting pavilions, long red-tile outer colonnade and shaped pool, with an attached brick-arched viewing terrace above sloping ground.',
  camera: [129, 105, 165],
  lookAt: [-6, 3, 7],
  qaCameras: [
    { name: 'front', position: [-37, 38, 190], lookAt: [-3, 5, 10] },
    { name: 'back', position: [-115, 77, -126], lookAt: [-8, 5, -26] },
  ],
  build: getty,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'West museum approach [-44,-49] at Y=0; main/peristyle floor Y=1, upper gallery Y=6.3. Independent USGS bare-earth datum; southern terrace supports descend to hillside road level.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-getty-villa.mjs',
    level: 'skyline',
    export: 'gettySkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels: {
      district: { export: 'gettyDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'gettyStreet', errorMeters: 0.065, surfaces },
    },
  },
  limitations: [
    'Original medium-fi exterior from six individually inspected local Qualla photographs, official Getty visitor plans/axonometric and aerial roof context. Hidden joins, gallery depths, heights and fine ornament are estimates, not surveyed geometry.',
    'Main villa, peristyles, pools and attached viewing terrace only. Modern theater, entry pavilion, cafe, auditorium, parking and separate campus buildings excluded. No artworks, vegetation, people, interiors or photographic pixels copied.',
    'Independent unmodified USGS CA_LosAngeles_B23 raster 114605 retained. Bare-earth ground under structures is interpolated by the source; host terrain may differ. Footprint replacement remains disabled.',
    'Column capitals/fluting, painted wall panels, roof tiles, balusters and brick arcade details are simplified progressively with distance. No physical-device frame-rate measurement claimed.',
  ],
};
