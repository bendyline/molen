/** Surviving open iron pier and its own three-gabled entrance arcade. Meter-scale native mesh. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  tau = 2 * Math.PI,
  deck = 0.3,
  iron = rgb('303b37'),
  white = rgb('e5e6dc'),
  timber = rgb('a8a392'),
  cream = rgb('e2ddc9'),
  burgundy = rgb('843b3b'),
  slate = rgb('787e83'),
  glass = rgb('7a8980'),
  concrete = rgb('93988d'),
  terra = rgb('a06a57');
const frame = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/gc/gcx/saltburn_pier/map-frame.json',
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
function strip(o, s, a, b, w, n, c) {
  const v = b.map((v, i) => v - a[i]),
    q = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]],
    L = Math.hypot(...q);
  if (L < 1e-8) return;
  const u = q.map((v) => (v * w) / L / 2),
    p = [
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
      a.map((v, i) => v + u[i]),
    ];
  quad(o, s, p, normalFor(...p), c);
}
function member(o, d, s, a, b, w, c, n = [0, 0, 1]) {
  if (d === 3) beam(o, s, a, b, w, w, c);
  else strip(o, s, a, b, w, n, c);
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
function roof(o, p, col = slate) {
  let n = normalFor(...p);
  if (n[1] < 0) {
    p = [...p].reverse();
    n = normalFor(...p);
  }
  if (p.length === 3)
    o.addTriangle(
      'roof',
      ref,
      p,
      n,
      p.map((p) => [p[0], p[2]]),
      col,
    );
  else quad(o, 'roof', p, n, col);
}

function shaft(o, d, x, zt, zb, y0 = -8, y1 = -0.45) {
  if (d < 2) {
    strip(o, 'iron', [x, y0, zb], [x, y1, zt], 0.2, [0, 0, 1], iron);
    if (d) strip(o, 'iron', [x, y0, zb], [x, y1, zt], 0.2, [1, 0, 0], iron);
    return;
  }
  const n = d === 3 ? 10 : 6,
    profiles =
      d === 3
        ? [
            [y0, 0.13],
            [y0 + 0.18, 0.17],
            [y0 + 0.28, 0.13],
            [-3.9, 0.13],
            [-3.86, 0.18],
            [-3.7, 0.18],
            [-3.66, 0.13],
            [y1 - 0.18, 0.13],
            [y1, 0.19],
          ]
        : [
            [y0, 0.13],
            [y1, 0.13],
          ],
    rings = profiles.map(([y, r]) => {
      const z = zb + ((zt - zb) * (y - y0)) / (y1 - y0);
      return Array.from({ length: n }, (_, i) => [
        x + r * Math.cos((-i * tau) / n),
        y,
        z + r * Math.sin((-i * tau) / n),
      ]);
    });
  loft(o, 'iron', rings, iron);
  if (d === 2) {
    B(o, 'iron', x, -3.9, (zb + zt) / 2, 0.35, 0.18, 0.35, iron);
    B(o, 'iron', x, y1 - 0.18, zt, 0.38, 0.18, 0.38, iron);
  }
  if (d === 3)
    for (const y of [-3.83, y1 - 0.08])
      for (const s of [-1, 1])
        B(
          o,
          'iron',
          x + s * 0.19,
          y,
          zb + ((zt - zb) * (y - y0)) / (y1 - y0),
          0.07,
          0.09,
          0.07,
          iron,
        );
}
function trestles(o, d) {
  const rows = Array.from({ length: 20 }, (_, i) => 9.8 + i * (197 / 19));
  for (const x of rows) {
    for (const z of [-2.05, 0, 2.05]) shaft(o, d, x, z, z * 1.35);
    if (d) B(o, 'wood', x, -0.45, 0, 0.35, 0.5, 5.5, timber);
    else strip(o, 'wood', [x, -0.2, -2.75], [x, -0.2, 2.75], 0.5, [1, 0, 0], timber);
    if (d > 1)
      for (const sign of [-1, 1])
        prismYZ(
          o,
          'haunch',
          x,
          0.38,
          [
            [sign * 1.72, 0.075],
            [sign * 2.75, 0.075],
            [sign * 2.75, -0.16],
            [sign * 2.66, -0.35],
            [sign * 2.5, -0.51],
            [sign * 2.27, -0.63],
            [sign * 2.15, -0.7],
            [sign * 1.72, -0.7],
          ],
          timber,
        );
    if (d)
      for (const z of [-2.05, 0, 2.05])
        for (const s of [-1, 1])
          member(o, d, 'strut', [x, -1.4, z], [x + s * 0.8, -0.08, z], 0.07, iron);
    for (const s of [-1, 1]) {
      member(o, d, 'iron', [x, -6.7, s * 2.65], [x, -0.55, 0], d ? 0.045 : 0.07, iron, [1, 0, 0]);
      if (d) member(o, d, 'iron', [x, -6.7, 0], [x, -0.55, s * 2.05], 0.045, iron, [1, 0, 0]);
    }
    if (d) member(o, d, 'iron', [x, -3.8, -2.4], [x, -3.8, 2.4], 0.055, iron, [1, 0, 0]);
  }
  for (let i = 0; i < rows.length - 1; i++)
    for (const z of [-2.05, 2.05]) {
      member(
        o,
        d,
        'iron',
        [rows[i], -6.7, z * 1.25],
        [rows[i + 1], -0.55, z],
        d ? 0.035 : 0.06,
        iron,
      );
      if (d) member(o, d, 'iron', [rows[i + 1], -6.7, z * 1.25], [rows[i], -0.55, z], 0.035, iron);
      if (d > 1)
        member(o, d, 'iron', [rows[i], -3.8, z * 1.1], [rows[i + 1], -3.8, z * 1.1], 0.045, iron);
    }
  if (d) for (const z of [-2.1, 0, 2.1]) B(o, 'wood', 108, -0.1, z, 200, 0.18, 0.24, timber);
  // The entrance stands over the shore end of the same open structure.
  for (const x of d ? [-6, 1, 8] : [-6, 8])
    for (const z of d ? [-11, -5, 5, 11] : [-11, 11]) shaft(o, d, x, z, z, -8, -0.5);
}

function rail(o, d, a, b, keepStart = false) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz);
  if (L < 0.15) return;
  const q = facing(o, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
    n = Math.max(1, Math.ceil(L / (d === 0 ? 11 : d === 1 ? 5.5 : 2.3)));
  if (d === 3) {
    physicalRailing(q, L, n, keepStart);
    return;
  }
  panel(q, 'paint', 0, deck, 0, L, 0.21, white);
  for (const y of d === 0 ? [0.5, 1.22] : [0.4, 0.67, 0.94, 1.22]) {
    const z = y > 1 ? 0.16 : y > 0.7 ? 0.06 : 0;
    if (d === 3) member(q, 3, 'paint', [-L / 2, deck + y, -z], [L / 2, deck + y, -z], 0.045, white);
    else panel(q, 'paint', 0, deck + y, -z, L, d === 0 ? 0.055 : 0.045, white);
  }
  for (let i = 0; i <= n; i++) {
    if (i === 0 && !keepStart) continue;
    const x = -L / 2 + (i * L) / n;
    if (d < 2) panel(q, 'iron', x, deck, 0, 0.07, 1.25, iron);
    else {
      const p = [
        [x, deck, 0],
        [x, deck + 0.75, 0],
        [x, deck + 1.06, -0.06],
        [x, deck + 1.22, -0.16],
        [x, deck + 1.25, -0.23],
      ];
      for (let j = 1; j < p.length; j++) member(q, d, 'iron', p[j - 1], p[j], 0.07, iron);
      B(q, 'iron', x, deck + 0.16, 0, 0.13, 0.12, 0.12, iron);
    }
  }
}

/** Closed meter-UV extrusion of a possibly concave profile in the normal/up plane. */
function prismYZ(o, slot, x, width, ring, color) {
  const p = ring.map((v) => [...v]);
  if (
    p.reduce(
      (n, a, i) => n + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) < 0
  )
    p.reverse();
  const ids = earcut(p.flat());
  for (const sign of [-1, 1])
    for (let i = 0; i < ids.length; i += 3) {
      const points = ids.slice(i, i + 3).map((j) => [x + (sign * width) / 2, p[j][1], p[j][0]]);
      if (normalFor(...points)[0] * sign < 0) points.reverse();
      o.addTriangle(
        slot,
        ref,
        points,
        [sign, 0, 0],
        points.map((v) => [v[2], v[1]]),
        color,
      );
    }
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      normal = [0, (a[0] - b[0]) / length, (b[1] - a[1]) / length];
    const points = [
        [x - width / 2, a[1], a[0]],
        [x + width / 2, a[1], a[0]],
        [x + width / 2, b[1], b[0]],
        [x - width / 2, b[1], b[0]],
      ],
      uv = [
        [0, 0],
        [width, 0],
        [width, length],
        [0, length],
      ];
    if (normalFor(...points).reduce((n, v, k) => n + v * normal[k], 0) < 0) {
      points.reverse();
      uv.reverse();
    }
    o.addQuad(slot, ref, points, normal, uv, color);
  }
}
function physicalRailing(o, length, n, keepStart) {
  B(o, 'kickboard', 0, deck, 0, length, 0.21, 0.035, white);
  for (const [y, z] of [
    [0.7, 0],
    [0.97, 0],
    [1.24, -0.06],
    [1.52, -0.16],
  ]) {
    const profile = Array.from({ length: 8 }, (_, i) => [
      z + 0.0225 * Math.cos((i * tau) / 8),
      y + 0.0225 * Math.sin((i * tau) / 8),
    ]);
    prismYZ(o, 'roundRail', 0, length, profile, white);
  }
  const centers = [
      [0, 0.29],
      [0, 1.02],
      [-0.008, 1.13],
      [-0.03, 1.25],
      [-0.065, 1.37],
      [-0.12, 1.47],
      [-0.185, 1.53],
      [-0.235, 1.55],
    ],
    edges = [-1, 1].map((sign) =>
      centers.map((p, i) => {
        const a = centers[Math.max(0, i - 1)],
          b = centers[Math.min(centers.length - 1, i + 1)],
          dy = b[1] - a[1],
          dz = b[0] - a[0],
          l = Math.hypot(dy, dz);
        return [p[0] + (sign * 0.04 * dy) / l, p[1] - (sign * 0.04 * dz) / l];
      }),
    ),
    profile = [...edges[0], ...edges[1].reverse()];
  for (let i = keepStart ? 0 : 1; i <= n; i++) {
    const x = -length / 2 + (i * length) / n;
    prismYZ(o, 'castPost', x, 0.07, profile, iron);
    B(o, 'castPost', x, deck - 0.01, 0, 0.13, 0.17, 0.12, iron);
  }
}

/** Slate courses are physical roof faces, with original subtle weathered side-roof bands. */
function slateRoof(o, d, z, w, ridge) {
  const span = w / 2 + 0.2,
    rise = ridge - 3.8,
    length = Math.hypot(span, rise),
    rows = d === 3 ? Math.ceil(length / 0.26) : 4,
    point = (x, t, sign) => [x, deck + 3.8 + rise * t, z + sign * span * (1 - t)];
  for (const sign of [-1, 1])
    for (let row = 0; row < rows; row++) {
      const t0 = row / rows,
        t1 = (row + 1) / rows,
        step = d === 3 ? 0.38 : 15,
        xs = [
          -7.5,
          ...Array.from(
            { length: Math.ceil(15 / step) },
            (_, i) => -7.5 + (i + 1) * step - (row % 2 ? step / 2 : 0),
          ).filter((x) => x > -7.499 && x < 7.499),
          7.5,
        ];
      for (let i = 0; i < xs.length - 1; i++) {
        const weathered = z !== 0 && row % 5 === 2,
          shade = (((row * 13 + i * 7 + (sign > 0 ? 3 : 0)) % 7) - 3) * 0.004,
          col = (weathered ? rgb('818575') : rgb('656b6c')).map((v) => v + shade);
        let p = [
            point(xs[i], t0, sign),
            point(xs[i + 1], t0, sign),
            point(xs[i + 1], t1, sign),
            point(xs[i], t1, sign),
          ],
          n = normalFor(...p);
        if (n[1] < 0) {
          p.reverse();
          n = normalFor(...p);
        }
        quad(o, 'slateCourse', p, n, col);
      }
    }
}
function bench(o, d, x, z) {
  const q = facing(o, z < 0 ? 0 : Math.PI, x, z);
  if (d < 2) {
    B(q, 'wood', 0, deck + 0.42, 0, 1.9, 0.09, 0.5, timber);
    panel(q, 'wood', 0, deck + 0.65, -0.24, 1.9, 0.35, timber);
    return;
  }
  for (const zz of [-0.18, -0.06, 0.06, 0.18])
    B(q, 'wood', 0, deck + 0.42, zz, 1.9, 0.07, 0.1, timber);
  for (const y of [0.64, 0.79, 0.94]) B(q, 'wood', 0, deck + y, -0.22, 1.9, 0.1, 0.06, timber);
  for (const xx of [-0.7, 0.7]) {
    member(
      q,
      d,
      'iron',
      [xx, deck + 0.05, -0.25],
      [xx, deck + 0.98, -0.25],
      0.055,
      iron,
      [1, 0, 0],
    );
    member(q, d, 'iron', [xx, deck + 0.05, 0.2], [xx, deck + 0.5, 0.1], 0.055, iron, [1, 0, 0]);
    member(q, d, 'iron', [xx, deck + 0.42, -0.25], [xx, deck + 0.42, 0.25], 0.07, iron, [1, 0, 0]);
    if (d === 3)
      member(q, d, 'iron', [xx, deck + 0.5, 0.2], [xx, deck + 0.72, -0.18], 0.04, iron, [1, 0, 0]);
  }
}
function pier(o, d) {
  const r = frame.authoredComponents.pierOutline;
  polygon(
    o,
    'concrete',
    [r[0], r[1], r[2], r[3], r[28], r[29], r[30], r[31]],
    -0.5,
    deck,
    concrete,
  );
  polygon(o, 'wood', r.slice(3, 29), deck - 0.23, deck, timber);
  // Estimated plain entrance apron connects the declared dry reference to the platform.
  const q = facing(o, frame.authoredComponents.arcade.angle),
    x0 = -13.6,
    x1 = -11.0,
    z = 2.5;
  quad(
    q,
    'concrete',
    [
      [x0, 0, -z],
      [x1, deck, -z],
      [x1, deck, z],
      [x0, 0, z],
    ],
    [-deck / (x1 - x0), 1, 0],
    concrete,
  );
  quad(
    q,
    'concrete',
    [
      [x0, -1.5, -z],
      [x0, -1.5, z],
      [x0, 0, z],
      [x0, 0, -z],
    ],
    [-1, 0, 0],
    concrete,
  );
  quad(
    q,
    'concrete',
    [
      [x1, -1.5, z],
      [x1, -1.5, -z],
      [x1, deck, -z],
      [x1, deck, z],
    ],
    [1, 0, 0],
    concrete,
  );
  for (const s of [-1, 1])
    quad(
      q,
      'concrete',
      [
        [x0, -1.5, s * z],
        [x1, -1.5, s * z],
        [x1, deck, s * z],
        [x0, 0, s * z],
      ],
      [0, 0, s],
      concrete,
    );
  trestles(o, d);
  for (let i = 1; i < 30; i++) rail(o, d, r[i], r[i + 1]);
  // Front platform sides have separate openings onto the promenade.
  rail(o, d, r[0], r[1], true);
  rail(o, d, r[30], r[31]);
  if (d)
    for (const [x, za, zb] of [
      [106.4, -3.2, 3.9],
      [153.1, -3.5, 3.6],
      [203, -4.3, 4.3],
    ])
      for (const z of [za, zb]) bench(o, d, x, z);
  if (d > 1)
    for (let x = 15.2; x < 208.5; x += d === 3 ? 0.32 : 1.28) {
      const w = x > 199 ? 9.0 : x > 150 && x < 156 ? 6.8 : x > 103 && x < 110 ? 6.8 : 5.1;
      strip(
        o,
        'seam',
        [x, deck + 0.004, -w / 2],
        [x, deck + 0.004, w / 2],
        0.009,
        [0, 1, 0],
        rgb('8c9084'),
      );
    }
}

function wall(o, d, w, y0, y1, holes = []) {
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
        ww < 1e-5 ||
        hh < 1e-5 ||
        holes.some((h) => Math.abs(x - h.x) < h.w / 2 - 1e-6 && y > h.y && y < h.y + h.h)
      )
        continue;
      panel(o, 'clap', x, ys[j], 0, ww, hh, cream);
    }
  for (const h of holes) {
    if (!h.open) panel(o, 'glass', h.x, h.y, -0.2, h.w, h.h, glass);
    for (const s of [-1, 1]) {
      if (d > 1) {
        const x = h.x + (s * h.w) / 2,
          y = h.y + (s > 0 ? h.h : 0);
        quad(
          o,
          'clap',
          [
            [x, h.y, 0],
            [x, h.y + h.h, 0],
            [x, h.y + h.h, -0.22],
            [x, h.y, -0.22],
          ],
          [-s, 0, 0],
          cream,
        );
        quad(
          o,
          'clap',
          [
            [h.x - h.w / 2, y, 0],
            [h.x + h.w / 2, y, 0],
            [h.x + h.w / 2, y, -0.22],
            [h.x - h.w / 2, y, -0.22],
          ],
          [0, -s, 0],
          cream,
        );
      }
      if (d) {
        panel(o, 'red', h.x + s * (h.w / 2 + 0.055), h.y - 0.04, 0.018, 0.11, h.h + 0.08, burgundy);
        panel(o, 'red', h.x, h.y + (s > 0 ? h.h : 0), 0.018, h.w + 0.2, 0.1, burgundy);
      }
    }
    if (d && !h.open) {
      for (const x of [-h.w / 4, 0, h.w / 4])
        panel(o, 'red', h.x + x, h.y + h.h * 0.55, -0.14, 0.045, h.h * 0.45, burgundy);
      panel(o, 'red', h.x, h.y + h.h * 0.55, -0.14, h.w, 0.06, burgundy);
    }
  }
  if (!d) return;
  const nx = Math.max(1, Math.round(w / 2.9)),
    grid = holes.length
      ? [-w / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2]), w / 2].sort(
          (a, b) => a - b,
        )
      : Array.from({ length: nx + 1 }, (_, i) => -w / 2 + (i * w) / nx),
    levels = [y0, y0 + 1.25, y0 + 2.45, y1];
  for (const x of grid) {
    for (let j = 1; j < levels.length; j++) {
      const y = (levels[j] + levels[j - 1]) / 2;
      if (holes.some((h) => Math.abs(x - h.x) < h.w / 2 + 0.1 && y > h.y && y < h.y + h.h))
        continue;
      panel(o, 'red', x, levels[j - 1], 0.028, 0.12, levels[j] - levels[j - 1], burgundy);
    }
  }
  for (let i = 0; i < grid.length - 1; i++)
    for (let j = 1; j < levels.length; j++) {
      const a = grid[i],
        b = grid[i + 1],
        y0 = levels[j - 1],
        y1 = levels[j],
        mid = (a + b) / 2;
      if (
        holes.some(
          (h) =>
            b > h.x - h.w / 2 + 0.001 &&
            a < h.x + h.w / 2 - 0.001 &&
            (y0 + y1) / 2 > h.y &&
            (y0 + y1) / 2 < h.y + h.h,
        )
      )
        continue;
      if (b - a < 0.4) continue;
      panel(o, 'red', mid, y0, 0.035, b - a, 0.1, burgundy);
      const p = [
        [a + 0.12, (y0 + y1) / 2, 0.04],
        [mid, y1 - 0.08, 0.04],
        [b - 0.12, (y0 + y1) / 2, 0.04],
        [mid, y0 + 0.1, 0.04],
      ];
      for (let k = 0; k < 4; k++)
        member(o, d, 'red', p[k], p[(k + 1) % 4], d > 1 ? 0.075 : 0.09, burgundy);
    }
  panel(o, 'red', 0, y1 - 0.1, 0.035, w, 0.1, burgundy);
}
function gable(o, d, w, ridge) {
  const y = deck + 3.75,
    p = [
      [-w / 2, y, 0],
      [w / 2, y, 0],
      [0, deck + ridge, 0],
    ];
  o.addTriangle(
    'clap',
    ref,
    p,
    [0, 0, 1],
    p.map((p) => [p[0], p[1]]),
    cream,
  );
  for (const s of [-1, 1])
    member(o, d, 'red', [(s * w) / 2, y, 0.035], [0, deck + ridge, 0.035], 0.14, burgundy);
  if (d) {
    panel(o, 'red', 0, y, 0.04, w, 0.12, burgundy);
    panel(o, 'red', 0, y, 0.04, 0.12, ridge - 3.75, burgundy);
    const yy = y + (ridge - 3.75) * 0.5;
    panel(o, 'red', 0, yy, 0.04, w * 0.5, 0.12, burgundy);
    for (const s of [-1, 1])
      member(o, d, 'red', [s * w * 0.25, yy, 0.04], [0, y + 0.15, 0.04], 0.08, burgundy);
  }
}
function porch(o, d, z, central) {
  const q = facing(o, -Math.PI / 2, -8.35, z),
    ww = central ? 4.2 : 2.45,
    y1 = deck + 2.65;
  wall(q, d, ww + 0.4, deck, y1, [{ x: 0, y: deck, w: ww, h: 2.25, open: central }]);
  if (!central && d !== 3) {
    panel(q, 'red', 0, deck, -0.14, ww, 1.12, burgundy);
    if (d)
      for (const x of [-0.6, 0.6]) {
        panel(q, 'red', x, deck + 0.2, -0.12, 0.85, 0.6, rgb('793332'));
      }
  }
  if (d === 3) glazedShopfront(q, ww);
  else if (central) B(q, 'entranceGlass', 0, deck, -0.17, ww, 2.25, 0.025, rgb('3f4c48'));
  for (const s of [-1, 1]) {
    const v = facing(q, (s * Math.PI) / 2, s * (ww / 2 + 0.2), -0.55);
    wall(v, d, 1.1, deck, y1);
  }
  roof(
    q,
    [
      [-ww / 2 - 0.32, y1 + 0.08, 0.18],
      [ww / 2 + 0.32, y1 + 0.08, 0.18],
      [ww / 2 + 0.32, y1 + 0.65, -1.25],
      [-ww / 2 - 0.32, y1 + 0.65, -1.25],
    ],
    rgb('616e67'),
  );
  if (central) {
    panel(q, 'glass', 0, y1, 0.02, ww, 0.42, rgb('37463d'));
    if (d > 1) {
      panel(q, 'clap', 0, y1 + 0.04, 0.03, ww - 0.2, 0.32, cream);
      for (let i = 0; i < 8; i++)
        panel(q, 'red', -1.6 + i * 0.45, y1 + 0.11, 0.04, 0.12, 0.1, burgundy);
    }
  }
  if (d)
    for (const s of [-1, 1]) panel(q, 'red', s * (ww / 2 + 0.26), deck, 0.1, 0.13, 2.75, burgundy);
}
/** Closed glazed exterior pose shown by the cleared 2016 landward photographs. */
function glazedShopfront(o, width) {
  const divisions = width > 3 ? 4 : 2,
    step = width / divisions,
    stock = 0.095;
  for (let i = 0; i <= divisions; i++)
    B(o, 'doorJoinery', -width / 2 + i * step, deck, -0.12, stock, 2.25, 0.09, burgundy);
  for (const y of [0, 1, 2.155])
    B(o, 'doorJoinery', 0, deck + y, -0.12, width + stock, stock, 0.09, burgundy);
  for (let i = 0; i < divisions; i++)
    for (const [y, h] of [
      [stock, 1 - stock],
      [1 + stock, 2.155 - 1 - stock],
    ])
      B(
        o,
        'entranceGlass',
        -width / 2 + (i + 0.5) * step,
        deck + y,
        -0.17,
        step - stock,
        h,
        0.025,
        rgb('3f4c48'),
      );
}
function crests(o, d, z, ridge) {
  B(o, 'red', 0, deck + ridge - 0.01, z, 14.8, 0.12, 0.14, terra);
  if (d < 2) return;
  for (let x = -7.15; x < 7.2; x += d === 3 ? 0.42 : 1.05) {
    const w = d === 3 ? 0.35 : 0.4,
      p = [
        [x - w / 2, deck + ridge + 0.1, z],
        [x - w * 0.28, deck + ridge + 0.28, z],
        [x + w * 0.28, deck + ridge + 0.28, z],
        [x + w / 2, deck + ridge + 0.1, z],
      ];
    for (let i = 0; i < 3; i++) strip(o, 'crest', p[i], p[i + 1], 0.045, [0, 0, 1], terra);
  }
  if (d === 3)
    for (const x of [-7.4, 7.4]) {
      const n = 8,
        rings = [
          [deck + ridge, 0.065],
          [deck + ridge + 0.22, 0.1],
          [deck + ridge + 0.37, 0.045],
          [deck + ridge + 0.48, 0.025],
        ].map(([y, r]) =>
          Array.from({ length: n }, (_, i) => [
            x + r * Math.cos((-i * tau) / n),
            y,
            z + r * Math.sin((-i * tau) / n),
          ]),
        );
      loft(o, 'red', rings, burgundy);
    }
}
function arcade(o, d) {
  const q = facing(o, frame.authoredComponents.arcade.angle);
  for (const [z, w, ridge] of [
    [-8.1, 6.8, 6.45],
    [0, 9.4, 7.5],
    [8.1, 6.8, 6.45],
  ]) {
    for (const sign of [-1, 1]) {
      const v = facing(q, (sign * Math.PI) / 2, sign * 7.25, z),
        front = sign < 0;
      wall(
        v,
        d,
        w,
        deck,
        deck + 3.75,
        [
          {
            x: 0,
            y: deck,
            w: z === 0 ? 4.2 : front ? 2.45 : 0.001,
            h: z === 0 ? 2.25 : front ? 2.25 : 0.001,
            open: z === 0 || d > 0,
          },
        ].filter((h) => h.w > 0.01),
      );
      gable(v, d, w, ridge);
    }
    if (d < 2)
      for (const s of [-1, 1])
        roof(q, [
          [-7.5, deck + 3.8, z + s * (w / 2 + 0.2)],
          [7.5, deck + 3.8, z + s * (w / 2 + 0.2)],
          [7.5, deck + ridge, z],
          [-7.5, deck + ridge, z],
        ]);
    else slateRoof(q, d, z, w, ridge);
    crests(q, d, z, ridge);
    if (d) porch(q, d, z, z === 0);
    else if (z === 0)
      B(
        facing(q, -Math.PI / 2, -8.35, 0),
        'entranceGlass',
        0,
        deck,
        -0.17,
        4.2,
        2.25,
        0.025,
        rgb('3f4c48'),
      );
  }
  for (const s of [-1, 1]) {
    wall(facing(q, s > 0 ? 0 : Math.PI, 0, s * 11.5), d, 14.5, deck, deck + 3.75);
    B(q, 'red', 0, deck + 3.65, s * 11.55, 14.9, 0.16, 0.16, burgundy);
    if (d === 3)
      for (let x = -7.2; x < 7.3; x += 0.28)
        panel(
          facing(q, s > 0 ? 0 : Math.PI),
          'red',
          s > 0 ? x : -x,
          deck + 3.42,
          11.57,
          0.12,
          0.22,
          burgundy,
        );
  }
  // The central opening leads onto the pier; exterior glazing is in its reference closed pose.
  B(q, 'wood', 0, deck - 0.09, 0, 14.5, 0.09, 23, timber);
  for (const s of [-1, 1]) B(q, 'red', 0, deck, s * 11.55, 14.5, 0.16, 0.15, burgundy);
}
function build(o, d) {
  pier(o, d);
  arcade(o, d);
}
export const saltburnPier = (o) => build(o, 3),
  saltburnPierStreet = (o) => build(o, 2),
  saltburnPierDistrict = (o) => build(o, 1),
  saltburnPierSkyline = (o) => build(o, 0);
const surfaces = {
  strut: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.83,
    metallic: 0.13,
    doubleSided: true,
  },
  entranceGlass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.08 },
  doorJoinery: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  castPost: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.13 },
  roundRail: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.07 },
  kickboard: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  haunch: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  slateCourse: { slot: 'roof', graph: 'slate', roughness: 0.91, metallic: 0 },
  iron: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.83,
    metallic: 0.13,
    doubleSided: true,
  },
  paint: {
    slot: 'trim',
    graph: 'metal_painted',
    roughness: 0.87,
    metallic: 0.07,
    doubleSided: true,
  },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
  clap: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.9, metallic: 0 },
  red: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0, doubleSided: true },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.91, metallic: 0 },
  seam: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.1, doubleSided: true },
  crest: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0, doubleSided: true },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.08 },
};
export const saltburnPierModel = {
  id: 'saltburn_pier',
  key: 'saltburn_pier',
  recipe: 'structure-saltburn-pier.mjs',
  cell: 'gc/gcx',
  title: 'Saltburn Pier',
  brief:
    'Surviving shortened timber pier on20 open triple iron trestles with flanged pipes/outward-raked outer feet/cross rods, grey board deck, black curved posts/four white rails/kickboards, two pairs of side viewing bays/benches and widened open head. Integral cream/burgundy three-gabled1925 entrance arcade with taller central roof, slate/perforated terracotta cresting, diagonal/diamond timber panels and three shallow front bays. No lost seaward shelter/length, cliff lift or neighboring shore buildings.',
  camera: [170, 48, 145],
  lookAt: [90, -1, 0],
  qaCameras: [
    { name: 'front', position: [-43, 14, 31], lookAt: [0, 3, 0] },
    { name: 'front-detail', position: [-24, 6, 1], lookAt: [-6, 2.7, 0] },
    { name: 'back', position: [39, 13, -29], lookAt: [0, 3, 0] },
    { name: 'base-detail', position: [35, -1.3, 20], lookAt: [35, -3.1, 0] },
    { name: 'roof-detail', position: [-7, 27, 31], lookAt: [0, 4, 0] },
    { name: 'deck-detail', position: [121, 4, 8], lookAt: [107, 1, 0] },
    { name: 'head-detail', position: [229, 9, 24], lookAt: [197, -0.2, 0] },
    { name: 'railing-detail', position: [89, 2.3, 6], lookAt: [90, 1.0, 2.7] },
    { name: 'haunch-detail', position: [42, -1, 7], lookAt: [40.9053, -0.3, 2.1] },
  ],
  mediumFiContext: { scale: 2, cameraYaw: 0, groundY: -8 },
  build: saltburnPier,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent native Terrarium ground and4 original tiles unchanged, dry promenade[-13.5,0] datum5.6524m. Local review8m grid has approximately.13m dry-contact interpolation difference. Fixed-8m iron supports extend below sampled pier/shore grade. Estimated plain entrance apron joins reference grade to deck.3m, with fixed below-grade edge closing the shore contact. Bounded preview only; tide/seabed, exact pavement slope and foundation embedment remain unverified; footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-saltburn-pier.mjs',
    level: 'skyline',
    export: 'saltburnPierSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'saltburnPierDistrict', errorMeters: 1, surfaces },
      street: { export: 'saltburnPierStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    'Plain entrance apron from dry promenade to front platform is a bounded authoring interpolation, not a surveyed pavement/ramp detail.8m source-grid interpolation has about.13m difference at the exact native dry reference. Ground is not altered to fit geometry.',
    'Selected surviving exterior corroborated by seven exact named Ownwork/self-CC0April2016natives after Qualla-first local scan. Independent mapped dimensions/plan retained. New round white rails/solid kickboards/continuous curved cast posts,40shaped timber haunches andsix course-divided slate roof planes are original medium-fi interpretations. Fine profiles,roof weathering/counts,bench/crest details,station spacing and unmeasured heights remain proportional estimates,not scans or engineering drawings. Historical private/attribution-only controls excluded from current reference inventory.',
    'Primary current pier length is about207m; map gives about201.5m open deck beyond arcade,216m including arcade and220.5m including front platform. Definitions/chainages differ; original outline retained without stretching to nominal dimensions.20 equally spaced transverse trestles remain estimates. Original story1250ft relates to an earlier length. No surviving end shelter is shown in inspected references.',
    'Independent terrain remains unchanged. Coastal composite and8m review interpolation do not certify tide/seabed, vertical datum or embedment. Deck.3m/fixed support bottom-8m are bounded authoring poses. Geographic preview requires current separate review; footprint replacement disabled.',
    'Includes integral own three-gabled entrance arcade; excludes cliff lift/stations/track, neighboring larger three-gabled venue/shops, beach/sea/water/boats, people/bins/life rings/flags/advertisements and interiors. Perforated ridge/diamond motifs and plain glyph marks are original simplified geometry. No photograph or drawing pixels embedded.',
  ],
};
export { arcade, pier, trestles };
