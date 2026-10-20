/** Grand Central's own surviving street exterior; surrounding towers/viaduct are separate. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';

const clockControls = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dr/dr5/grand_central_terminal/clock-construction-controls.json',
      import.meta.url,
    ),
  ),
);

import {
  beam,
  sphere as fullSphere,
  loft,
  normalFor,
  radialRing,
} from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad as rawQuad } from './structure-mesh.mjs';

function quad(o, s, p, n, c) {
  const q = p.filter(
    (v, i) => Math.hypot(...v.map((v, k) => v - p[(i + p.length - 1) % p.length][k])) > 1e-5,
  );
  if (q.length === 3)
    o.addTriangle(
      s,
      'palette:#ffffff',
      q,
      n,
      q.map((p) => [p[0], p[1] + p[2]]),
      c,
    );
  else if (q.length === 4) rawQuad(o, s, q, n, c);
  else throw Error('Invalid face');
}

let detailLevel = 3;
function sphere(o, s, c, r, col, n = 32, l = 16) {
  fullSphere(
    o,
    s,
    c,
    r,
    col,
    detailLevel < 3 ? Math.min(n, detailLevel === 2 ? 8 : 4) : n,
    detailLevel < 3 ? Math.min(l, detailLevel === 2 ? 4 : 3) : l,
  );
}
const ref = 'palette:#ffffff',
  tau = 2 * Math.PI;
const stone = rgb('cec6b4'),
  trim = rgb('dfd7c6'),
  granite = rgb('b3aaa0'),
  shade = rgb('a59a87'),
  copper = rgb('7eaa8a'),
  seam = rgb('719a7c'),
  metal = rgb('68786c'),
  glass = rgb('526c70'),
  roof = rgb('b9b5a0'),
  flat = rgb('76786f'),
  bronze = rgb('4d6253'),
  gold = rgb('c2a04c');
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
function plate(o, s, p, z, depth, c) {
  if (
    p.reduce(
      (sum, q, i) => sum + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1],
      0,
    ) < 0
  )
    p = [...p].reverse();
  loft(o, s, [p.map(([x, y]) => [x, y, z - depth]), p.map(([x, y]) => [x, y, z])], c);
}
function bar(o, d, s, x, y, z, w, h, dep, c) {
  if (d === 3) B(o, s, x, y, z, w, h, dep, c);
  else
    quad(
      o,
      s,
      [
        [x - w / 2, y, z + dep / 2],
        [x + w / 2, y, z + dep / 2],
        [x + w / 2, y + h, z + dep / 2],
        [x - w / 2, y + h, z + dep / 2],
      ],
      [0, 0, 1],
      c,
    );
}
function flatBeam(o, d, s, a, b, w, dep, c) {
  if (d === 3) {
    beam(o, s, a, b, w, dep, c);
    return;
  }
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    x = ((-dy / len) * w) / 2,
    y = ((dx / len) * w) / 2;
  quad(
    o,
    s,
    [
      [a[0] + x, a[1] + y, a[2] + dep / 2],
      [a[0] - x, a[1] - y, a[2] + dep / 2],
      [b[0] - x, b[1] - y, b[2] + dep / 2],
      [b[0] + x, b[1] + y, b[2] + dep / 2],
    ],
    [0, 0, 1],
    c,
  );
}
function archTop(h, x) {
  return h.y + h.h - h.r + Math.sqrt(Math.max(0, h.r * h.r - (x - h.x) * (x - h.x)));
}
/** Build the wall around actual recessed arched/rectangular/oval windows, not decals. */
function wall(o, d, w, h, z, holes, y0 = -1.3) {
  const xs = [
    -w / 2,
    w / 2,
    ...holes.flatMap((h) => {
      const n = h.oval ? (d === 1 ? 8 : d < 3 ? 12 : 32) : h.r ? (d < 2 ? 4 : d < 3 ? 8 : 24) : 1;
      return Array.from({ length: n + 1 }, (_, i) => h.x - h.w / 2 + (i * h.w) / n);
    }),
  ].sort((a, b) => a - b);
  const top = (h, x) =>
      h.oval
        ? h.y + h.h / 2 + (Math.sqrt(Math.max(0, 1 - ((x - h.x) / (h.w / 2)) ** 2)) * h.h) / 2
        : h.r
          ? archTop(h, x)
          : h.y + h.h,
    base = (h, x) =>
      h.oval
        ? h.y + h.h / 2 - (Math.sqrt(Math.max(0, 1 - ((x - h.x) / (h.w / 2)) ** 2)) * h.h) / 2
        : h.y;
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1];
    if (b - a < 1e-7) continue;
    const open = holes
      .filter((q) => (a + b) / 2 > q.x - q.w / 2 && (a + b) / 2 < q.x + q.w / 2)
      .sort((a, b) => a.y - b.y);
    let ya = y0,
      yb = y0;
    for (const q of open) {
      const loA = base(q, a),
        loB = base(q, b);
      quad(
        o,
        'stone',
        [
          [a, ya, z],
          [b, yb, z],
          [b, loB, z],
          [a, loA, z],
        ],
        [0, 0, 1],
        stone,
      );
      ya = top(q, a);
      yb = top(q, b);
    }
    quad(
      o,
      'stone',
      [
        [a, ya, z],
        [b, yb, z],
        [b, h, z],
        [a, h, z],
      ],
      [0, 0, 1],
      stone,
    );
  }
  for (const q of holes) {
    const n = q.oval ? (d === 1 ? 8 : d < 3 ? 12 : 32) : q.r ? (d < 2 ? 4 : d < 3 ? 8 : 24) : 1,
      pts = Array.from({ length: n + 1 }, (_, i) => q.x - q.w / 2 + (i * q.w) / n),
      dep = q.depth ?? 0.6,
      zz = z - dep;
    for (let j = 0; j < n; j++) {
      const a = pts[j],
        b = pts[j + 1],
        ta = top(q, a),
        tb = top(q, b),
        ba = base(q, a),
        bb = base(q, b);
      quad(
        o,
        'glass',
        [
          [a, ba, zz],
          [b, bb, zz],
          [b, tb, zz],
          [a, ta, zz],
        ],
        [0, 0, 1],
        glass,
      );
      if (q.r || q.oval)
        quad(
          o,
          'stone',
          [
            [a, ta, z],
            [b, tb, z],
            [b, tb, zz],
            [a, ta, zz],
          ],
          [0, -1, 0],
          shade,
        );
      if (q.oval)
        quad(
          o,
          'stone',
          [
            [a, ba, z],
            [a, ba, zz],
            [b, bb, zz],
            [b, bb, z],
          ],
          [0, 1, 0],
          trim,
        );
    }
    if (!q.oval) {
      for (const sign of [-1, 1]) {
        const x = q.x + (sign * q.w) / 2,
          t = top(q, x);
        quad(
          o,
          'stone',
          [
            [x, q.y, z],
            [x, t, z],
            [x, t, zz],
            [x, q.y, zz],
          ],
          [-sign, 0, 0],
          shade,
        );
      }
      quad(
        o,
        'stone',
        [
          [q.x - q.w / 2, q.y, z],
          [q.x - q.w / 2, q.y, zz],
          [q.x + q.w / 2, q.y, zz],
          [q.x + q.w / 2, q.y, z],
        ],
        [0, 1, 0],
        granite,
      );
      if (!q.r)
        quad(
          o,
          'stone',
          [
            [q.x - q.w / 2, q.y + q.h, z],
            [q.x + q.w / 2, q.y + q.h, z],
            [q.x + q.w / 2, q.y + q.h, zz],
            [q.x - q.w / 2, q.y + q.h, zz],
          ],
          [0, -1, 0],
          shade,
        );
    }
    if (d > 0) {
      const edge = q.oval
        ? Array.from({ length: d < 3 ? 12 : 40 }, (_, i) => {
            const a = (i * tau) / (d < 3 ? 12 : 40);
            return [q.x + (q.w / 2) * Math.cos(a), q.y + q.h / 2 + (q.h / 2) * Math.sin(a)];
          })
        : q.r
          ? [...pts.map((x) => [x, top(q, x)])]
          : [];
      for (let i = 1; i < edge.length; i++)
        flatBeam(
          o,
          d,
          'trim',
          [...edge[i - 1], z + 0.05],
          [...edge[i], z + 0.05],
          0.23,
          0.24,
          trim,
        );
      if (q.oval)
        flatBeam(
          o,
          d,
          'trim',
          [...edge.at(-1), z + 0.05],
          [...edge[0], z + 0.05],
          0.23,
          0.24,
          trim,
        );
      if (!q.oval && (d > 1 || q.r)) {
        for (const sign of [-1, 1])
          B(
            o,
            'trim',
            q.x + sign * (q.w / 2 + 0.13),
            q.y,
            z + 0.055,
            0.2,
            q.r ? q.h - q.r : q.h,
            0.24,
            trim,
          );
        B(o, 'trim', q.x, q.y - 0.16, z + 0.06, q.w + 0.6, 0.2, 0.28, trim);
      }
      const pitch = d === 1 ? 5 : d === 2 ? 2.7 : 0.56,
        thick = d === 1 ? 0.12 : 0.065;
      for (let x = q.x - q.w / 2 + pitch; x < q.x + q.w / 2 - 0.1; x += pitch) {
        const a = base(q, x) + 0.07,
          b = top(q, x) - 0.07;
        if (b > a) bar(o, d, 'metal', x, a, zz + 0.1, thick, b - a, 0.1, metal);
      }
      for (let y = q.y + pitch; y < q.y + q.h - 0.05; y += pitch) {
        let half = q.w / 2;
        if (q.oval) half *= Math.sqrt(Math.max(0, 1 - ((y - q.y - q.h / 2) / (q.h / 2)) ** 2));
        else if (q.r && y > q.y + q.h - q.r)
          half = Math.sqrt(Math.max(0, q.r * q.r - (y - (q.y + q.h - q.r)) ** 2));
        bar(o, d, 'metal', q.x, y, zz + 0.1, 2 * half, thick, 0.1, metal);
      }
      if (q.h > 10)
        for (const y of [q.y + 5.3, q.y + 10.5])
          bar(o, d, 'metal', q.x, y, zz + 0.17, q.w, 0.17, 0.18, metal);
    }
  }
}
function column(o, d, x) {
  const n = d < 2 ? 6 : d === 2 ? 12 : 40,
    rings = (
      d === 1
        ? [
            [7.5, 1.28],
            [29.7, 1.04],
          ]
        : [
            [7.5, 1.28],
            [8.0, 1.31],
            [8.3, 1.07],
            [29.1, 0.87],
            [29.7, 1.04],
          ]
    ).map(([y, r]) => radialRing(y, r, r, n, [x, 44.2]));
  loft(o, 'trim', rings, trim);
  B(o, 'stone', x, 6.5, 44.0, 3.15, 1.0, 3.1, granite);
  B(o, 'trim', x, 29.65, 44.1, 2.6, 0.55, 2.65, trim);
  if (d > 2) {
    for (let i = 0; i < (d === 2 ? 10 : 20); i++) {
      const a = (i * tau) / (d === 2 ? 10 : 20);
      beam(
        o,
        'stone',
        [x + 1.074 * Math.cos(a), 8.5, 44.2 + 1.074 * Math.sin(a)],
        [x + 0.875 * Math.cos(a), 28.9, 44.2 + 0.875 * Math.sin(a)],
        0.07,
        0.09,
        shade,
      );
    }
    for (const sign of [-1, 1])
      sphere(o, 'trim', [x + sign * 0.82, 29.46, 45.0], [0.36, 0.27, 0.3], trim, 8, 4);
  }
}
function hip(o, s, x, z, w, dep, y, peak, ridge, c, d) {
  const pts = [
      [x - w / 2, y, z - dep / 2],
      [x + w / 2, y, z - dep / 2],
      [x + w / 2, y, z + dep / 2],
      [x - w / 2, y, z + dep / 2],
    ],
    a = [x - ridge / 2, peak, z],
    b = [x + ridge / 2, peak, z];
  for (let p of [
    [pts[0], pts[1], b, a],
    [pts[1], pts[2], b],
    [pts[2], pts[3], a, b],
    [pts[3], pts[0], a],
  ]) {
    if (normalFor(...p)[1] < 0) p = [...p].reverse();
    if (p.length === 4) quad(o, s, p, normalFor(...p), c);
    else
      o.addTriangle(
        s,
        ref,
        p,
        normalFor(...p),
        p.map((p) => [p[0], p[2]]),
        c,
      );
  }
  if (d > 2) {
    const pitch = d === 2 ? 2.8 : 1.15;
    for (let xx = x - ridge / 2 + 0.4; xx < x + ridge / 2; xx += pitch)
      for (const sign of [-1, 1])
        beam(
          o,
          'copper',
          [xx, y + 0.025, z + (sign * dep) / 2],
          [xx, peak + 0.025, z],
          0.035,
          0.05,
          seam,
        );
  }
}
function cornice(o, x, z, w, dep, y, d) {
  for (const [h, pad, dy] of [
    [0.3, 0.1, 0],
    [0.35, 0.35, 0.3],
    [0.5, 0.7, 0.65],
  ])
    B(o, 'trim', x, y + dy, z, w + pad * 2, h, dep + pad * 2, trim);
  if (d > 2) {
    for (let xx = x - w / 2 + 0.6; xx < x + w / 2; xx += d === 2 ? 2.1 : 1.05)
      for (const sign of [-1, 1])
        B(o, 'trim', xx, y - 0.22, z + sign * (dep / 2 + 0.25), 0.28, 0.36, 0.6, trim);
  }
}
function ovalGarland(o, d, x) {
  if (d < 2) return;
  const y = 24.1;
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i * Math.PI) / 11;
    sphere(
      o,
      'trim',
      [x + 2.65 * Math.cos(a), y + 0.9 + 2.8 * Math.sin(a), 44.13],
      [0.43, 0.26, 0.23],
      trim,
      8,
      4,
    );
  }
  sphere(o, 'trim', [x, 20.1, 44.3], [0.75, 0.4, 0.3], trim, 10, 4);
}
function cartouche(o, d, x, y, z, scale = 1) {
  if (d === 0) return;
  sphere(o, 'trim', [x, y, z], [1.05 * scale, 1.35 * scale, 0.24], trim, d < 2 ? 8 : 16, 6);
  sphere(o, 'stone', [x, y, z + 0.22], [0.74 * scale, 1.02 * scale, 0.05], stone, 12, 6);
  if (d > 1)
    for (let i = 0; i < (d === 2 ? 8 : 16); i++) {
      const a = (i * tau) / (d === 2 ? 8 : 16);
      sphere(
        o,
        'trim',
        [x + 1.36 * scale * Math.cos(a), y + 1.65 * scale * Math.sin(a), z + 0.12],
        [0.44 * scale, 0.24 * scale, 0.18],
        trim,
        8,
        4,
      );
    }
}
function disc(o, s, x, y, z, r, c, n = 40) {
  const ring = Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * tau) / n),
    y + r * Math.sin((i * tau) / n),
    z,
  ]);
  o.addConvexPolygon(s, ref, ring, [0, 0, 1], (p) => [p[0], p[1]], c);
}
function clock(o, d) {
  if (d === 3) {
    constructedClock(o);
    return;
  }
  const x = 0,
    y = 37.6,
    z = 45.02,
    r = 2.03,
    n = d < 2 ? 16 : d === 2 ? 32 : 48;
  disc(o, 'trim', x, y, z - 0.14, r + 0.33, trim, n);
  disc(o, 'clock', x, y, z, r, rgb('ac985c'), n);
  disc(o, 'glass', x, y, z + 0.01, r * 0.87, rgb('657b73'), n);
  if (d === 0) return;
  disc(o, 'clock', x, y, z + 0.03, r * 0.61, gold, n);
  disc(o, 'glass', x, y, z + 0.045, r * 0.55, rgb('47746c'), n);
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i * tau) / 12;
    beam(
      o,
      'clock',
      [Math.cos(a) * r * 0.58, y + Math.sin(a) * r * 0.58, z + 0.06],
      [Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98, z + 0.06],
      0.09,
      0.06,
      gold,
    );
    if (d > 1) {
      const romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][
        i
      ];
      let cursor = -(romans.length - 1) * 0.115;
      for (const ch of romans) {
        const cx = Math.cos(a) * r * 0.78 + cursor,
          cy = y + Math.sin(a) * r * 0.78;
        const segs =
          ch === 'I'
            ? [
                [
                  [-0.035, -0.21],
                  [0.035, 0.21],
                ],
              ]
            : ch === 'V'
              ? [
                  [
                    [-0.08, 0.19],
                    [0, -0.18],
                  ],
                  [
                    [0, -0.18],
                    [0.08, 0.19],
                  ],
                ]
              : [
                  [
                    [-0.09, 0.19],
                    [0.09, -0.19],
                  ],
                  [
                    [-0.09, -0.19],
                    [0.09, 0.19],
                  ],
                ];
        for (const [p, q] of segs)
          beam(
            o,
            'clock',
            [cx + p[0], cy + p[1], z + 0.08],
            [cx + q[0], cy + q[1], z + 0.08],
            0.035,
            0.04,
            rgb('e2d7b2'),
          );
        cursor += 0.23;
      }
    }
  }
  beam(o, 'clock', [0, y, z + 0.16], [-0.82, y + 0.7, z + 0.16], 0.12, 0.09, gold);
  beam(o, 'clock', [0, y, z + 0.17], [0.64, y - 0.96, z + 0.17], 0.08, 0.08, gold);
  sphere(o, 'clock', [0, y, z + 0.2], [0.14, 0.14, 0.06], gold, 8, 4);
}

// Physical close-detail clock stock; no photograph or painted-on numerals.
function clockQuad(o, slot, p, color, uv) {
  o.addQuad(slot, ref, p, normalFor(...p), uv, color);
}
function clockStock(o, slot, points, back, front, color) {
  const rings = [back, front].map((z) => points.map(([x, y]) => [x, y, z]));
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length,
      len = Math.hypot(points[j][0] - points[i][0], points[j][1] - points[i][1]);
    clockQuad(o, slot, [rings[0][i], rings[0][j], rings[1][j], rings[1][i]], color, [
      [0, 0],
      [len, 0],
      [len, front - back],
      [0, front - back],
    ]);
  }
  for (const [r, reverse] of [
    [rings[0], true],
    [rings[1], false],
  ]) {
    const p = reverse ? [...r].reverse() : r;
    o.addConvexPolygon(slot, ref, p, normalFor(...p), (p) => [p[0], p[1]], color);
  }
}
function clockRing(o, slot, cx, cy, rx, ry, profile, n, color, rotation = 0) {
  const point = (a, [t, z]) => {
    const x = (rx + t) * Math.cos(a),
      y = (ry + t) * Math.sin(a);
    return [
      cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      cy + x * Math.sin(rotation) + y * Math.cos(rotation),
      z,
    ];
  };
  const lengths = [0],
    uvRadius = (rx + ry) / 2 + profile.reduce((sum, p) => sum + p[0], 0) / profile.length;
  for (let j = 0; j < profile.length; j++)
    lengths.push(
      lengths.at(-1) +
        Math.hypot(...profile[(j + 1) % profile.length].map((v, k) => v - profile[j][k])),
    );
  for (let i = 0; i < n; i++)
    for (let j = 0; j < profile.length; j++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n,
        k = (j + 1) % profile.length;
      clockQuad(
        o,
        slot,
        [point(a, profile[j]), point(b, profile[j]), point(b, profile[k]), point(a, profile[k])],
        color,
        [
          [a * uvRadius, lengths[j]],
          [b * uvRadius, lengths[j]],
          [b * uvRadius, lengths[j + 1]],
          [a * uvRadius, lengths[j + 1]],
        ],
      );
    }
}
function clockRod(o, slot, a, b, w, back, front, color) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    u = [(dy * w) / (2 * len), (-dx * w) / (2 * len)];
  clockStock(
    o,
    slot,
    [
      [a[0] + u[0], a[1] + u[1]],
      [b[0] + u[0], b[1] + u[1]],
      [b[0] - u[0], b[1] - u[1]],
      [a[0] - u[0], a[1] - u[1]],
    ],
    back,
    front,
    color,
  );
}
function clockEllipse(cx, cy, rx, ry, n, rotation = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * tau) / n,
      x = rx * Math.cos(a),
      y = ry * Math.sin(a);
    return [
      cx + x * Math.cos(rotation) - y * Math.sin(rotation),
      cy + x * Math.sin(rotation) + y * Math.cos(rotation),
    ];
  });
}
function constructedClock(o) {
  const [cx, cy, z] = clockControls.center,
    blue = rgb('367e9b'),
    burgundy = rgb('5d354f'),
    ivory = rgb('e2e2d5'),
    brass = rgb('cdb667'),
    vine = rgb('526553'),
    darkHand = rgb('35413c'),
    ring = (r, w, back, front, n = 64) =>
      clockRing(
        o,
        'clockBrass',
        cx,
        cy,
        r,
        r,
        [
          [w / 2, z + back],
          [w / 2, z + front],
          [-w / 2, z + front],
          [-w / 2, z + back],
        ],
        n,
        brass,
      );
  clockRing(
    o,
    'clockStone',
    cx,
    cy,
    0,
    0,
    [
      [2.4, z - 0.3],
      [2.4, z - 0.08],
      [2.34, z + 0.03],
      [2.17, z + 0.07],
      [2.08, z + 0.03],
      [2.08, z - 0.3],
    ],
    64,
    trim,
  );
  clockStock(o, 'clockGlazing', clockEllipse(cx, cy, 2.03, 2.03, 64), z - 0.07, z + 0.02, blue);
  ring(2.02, 0.045, 0.025, 0.095);
  ring(1.285, 0.045, 0.035, 0.105, 48);
  const romans = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = Math.PI / 2 - (i * tau) / 12,
      ca = Math.cos(a),
      sa = Math.sin(a),
      x = cx + 1.65 * ca,
      y = cy + 1.65 * sa,
      rot = a - Math.PI / 2,
      local = (u, v) => [x + u * sa + v * ca, y - u * ca + v * sa];
    clockStock(
      o,
      'clockGlazing',
      clockEllipse(x, y, 0.265, 0.35, 20, rot),
      z + 0.025,
      z + 0.055,
      burgundy,
    );
    clockRing(
      o,
      'clockBrass',
      x,
      y,
      0.265,
      0.35,
      [
        [0.013, z + 0.05],
        [0.013, z + 0.1],
        [-0.013, z + 0.1],
        [-0.013, z + 0.05],
      ],
      20,
      brass,
      rot,
    );
    const f = a + tau / 24;
    clockRod(
      o,
      'clockBrass',
      [cx + 1.3 * Math.cos(f), cy + 1.3 * Math.sin(f)],
      [cx + 2.0 * Math.cos(f), cy + 2.0 * Math.sin(f)],
      0.035,
      z + 0.05,
      z + 0.11,
      brass,
    );
    let cursor = -(romans[i].length - 1) * 0.066;
    for (const ch of romans[i]) {
      const segments =
        ch === 'I'
          ? [
              [
                [0, -0.235],
                [0, 0.235],
              ],
            ]
          : ch === 'V'
            ? [
                [
                  [-0.05, 0.235],
                  [0, -0.235],
                ],
                [
                  [0, -0.235],
                  [0.05, 0.235],
                ],
              ]
            : [
                [
                  [-0.05, -0.235],
                  [0.05, 0.235],
                ],
                [
                  [-0.05, 0.235],
                  [0.05, -0.235],
                ],
              ];
      for (const [p, q] of segments)
        clockRod(
          o,
          'clockGlazing',
          local(cursor + p[0], p[1]),
          local(cursor + q[0], q[1]),
          0.018,
          z + 0.065,
          z + 0.095,
          ivory,
        );
      cursor += 0.132;
    }
    // Original restrained branching ornament, inferred from the native floral metalwork.
    let prev = [cx + 0.22 * ca, cy + 0.22 * sa];
    for (let j = 1; j <= 4; j++) {
      const r = 0.22 + j * 0.235,
        b = a + 0.11 * Math.sin((j * Math.PI) / 2),
        next = [cx + r * Math.cos(b), cy + r * Math.sin(b)];
      clockRod(o, 'clockBrass', prev, next, 0.028, z + 0.035, z + 0.065, vine);
      prev = next;
    }
  }
  for (const [len, a, back] of [
    [1.96, Math.PI * 0.31, 0.14],
    [1.43, Math.PI * 0.17, 0.2],
  ]) {
    const transform = (p) => [
        cx + p[0] * Math.sin(a) + p[1] * Math.cos(a),
        cy - p[0] * Math.cos(a) + p[1] * Math.sin(a),
      ],
      stock = (points, b, f, color) =>
        clockStock(
          o,
          color === brass ? 'clockBrass' : 'clockGlazing',
          points.map(transform),
          z + b,
          z + f,
          color,
        );
    stock(
      [
        [0, -0.53],
        [0.13, 0.12],
        [0, len],
        [-0.13, 0.12],
      ],
      back,
      back + 0.065,
      brass,
    );
    stock(
      [
        [0, -0.31],
        [0.061, 0.12],
        [0, len - 0.18],
        [-0.061, 0.12],
      ],
      back + 0.065,
      back + 0.08,
      darkHand,
    );
    stock(
      [
        [-0.21, len - 0.49],
        [0.21, len - 0.49],
        [0, len],
      ],
      back + 0.01,
      back + 0.07,
      brass,
    );
    stock(
      [
        [-0.11, len - 0.43],
        [0.11, len - 0.43],
        [0, len - 0.15],
      ],
      back + 0.07,
      back + 0.085,
      darkHand,
    );
  }
  clockStock(o, 'clockBrass', clockEllipse(cx, cy, 0.17, 0.17, 16), z + 0.24, z + 0.31, brass);
  clockStock(
    o,
    'clockGlazing',
    clockEllipse(cx, cy, 0.105, 0.105, 16),
    z + 0.31,
    z + 0.335,
    rgb('a6b7b6'),
  );
}

function limb(o, d, a, b, r, c = stone) {
  beam(o, 'sculpture', a, b, r, r, c);
  if (d > 0)
    for (const p of [a, b])
      sphere(o, 'sculpture', p, [r * 0.58, r * 0.58, r * 0.58], c, d < 3 ? 6 : 10, d === 2 ? 3 : 4);
}
function clockContactOutput(o) {
  return {
    addTriangle: (_slot, ...a) => o.addTriangle('clockContactStone', ...a),
    addQuad: (_slot, ...a) => o.addQuad('clockContactStone', ...a),
    addConvexPolygon: (_slot, ...a) => o.addConvexPolygon('clockContactStone', ...a),
  };
}
function sculpture(o, d) {
  if (d < 2) {
    coarseSculpture(o, d);
    return;
  }
  const z = 44.1; // Integral sculpture, proportioned to inspected facade originals.
  const curved = Array.from({ length: d === 1 ? 8 : d < 3 ? 12 : 32 }, (_, i) => {
    const x = -11 + (i * 22) / ((d === 1 ? 8 : d < 3 ? 12 : 32) - 1);
    return [x, 35.9 + 3.05 * (1 - (x / 11) ** 2)];
  });
  plate(o, 'stone', [[-11, 35.7], [11, 35.7], ...curved.slice().reverse()], 44.45, 1.0, stone);
  for (let i = 1; i < curved.length; i++)
    beam(o, 'trim', [...curved[i - 1], 44.67], [...curved[i], 44.67], 0.35, 0.3, trim);
  // Eagle behind Mercury, wings spread to either side.
  sphere(o, 'sculpture', [0, 40.5, z - 0.5], [1.2, 1.45, 0.95], shade, d < 2 ? 6 : 12, 6);
  sphere(o, 'sculpture', [-0.35, 42.0, z - 0.35], [0.42, 0.55, 0.4], stone, 8, 4);
  for (const sign of [-1, 1]) {
    plate(
      o,
      'sculpture',
      [
        [sign * 0.35, 41.3],
        [sign * 1.0, 42.1],
        [sign * 5.2, 42.25],
        [sign * 4.0, 40.8],
        [sign * 2.1, 40.35],
      ],
      z,
      0.7,
      stone,
    );
    if (d > 1)
      for (let i = 0; i < 7; i++)
        limb(
          o,
          d,
          [sign * (0.9 + i * 0.4), 41.8, z + 0.05],
          [sign * (1.4 + i * 0.48), 40.7 + i * 0.12, z + 0.13],
          0.09,
          shade,
        );
  }
  // Mercury: contrapposto legs, torso, lifted right hand and caduceus left.
  limb(
    d === 3 ? clockContactOutput(o) : o,
    d,
    [-0.25, d === 3 ? 40.15 : 39.0, z + 0.7],
    [0.08, 41.4, z + 0.7],
    0.65,
  );
  limb(
    d === 3 ? clockContactOutput(o) : o,
    d,
    [0.65, d === 3 ? 40.15 : 39.0, z + 0.65],
    [0.0, 41.4, z + 0.7],
    0.6,
  );
  sphere(o, 'sculpture', [0.0, 42.4, z + 0.7], [0.9, 1.28, 0.55], stone, d < 2 ? 8 : 16, 8);
  sphere(o, 'sculpture', [0.06, 44.0, z + 0.72], [0.48, 0.59, 0.44], stone, 12, 6);
  sphere(o, 'sculpture', [0.03, 44.4, z + 0.65], [0.59, 0.23, 0.47], stone, 12, 5);
  limb(o, d, [-0.65, 43.1, z + 0.7], [-1.55, 43.7, z + 0.65], 0.36);
  limb(o, d, [-1.55, 43.7, z + 0.65], [-2.2, 45.35, z + 0.7], 0.28);
  sphere(o, 'sculpture', [-2.25, 45.58, z + 0.7], [0.22, 0.23, 0.13], stone, 8, 4);
  limb(o, d, [0.67, 43.1, z + 0.7], [1.8, 42.8, z + 0.8], 0.36);
  limb(o, d, [1.8, 42.8, z + 0.8], [2.9, 43.5, z + 0.8], 0.27);
  if (d > 0) {
    beam(o, 'sculpture', [2.5, 42.4, z + 0.8], [3.2, 44.2, z + 0.8], 0.13, 0.14, stone);
    for (const sign of [-1, 1]) {
      plate(
        o,
        'sculpture',
        [
          [sign * 0.43, 44.25],
          [sign * 0.77, 44.75],
          [sign * 0.57, 43.98],
        ],
        z + 0.83,
        0.14,
        stone,
      );
      limb(o, d, [3.03, 43.6, z + 0.8], [3.03 + sign * 0.35, 44.1, z + 0.8], 0.11);
    }
  }
  plate(
    o,
    'sculpture',
    [
      [-0.85, 41.6],
      [0.8, 41.6],
      [0.55, 39.8],
      [-0.25, 40.25],
      [-0.7, 39.55],
    ],
    z + 1.0,
    0.27,
    trim,
  );
  // Seated Hercules west and Minerva east, with bent arms/legs, not standing duplicates.
  for (const sign of [-1, 1]) {
    const x = sign * 6.25,
      y = 38.5;
    sphere(o, 'sculpture', [x, y + 1.2, z + 0.3], [0.82, 1.08, 0.62], stone, d < 2 ? 6 : 12, 6);
    sphere(o, 'sculpture', [x - sign * 0.35, y + 2.55, z + 0.4], [0.46, 0.55, 0.44], stone, 10, 6);
    if (sign === 1)
      sphere(o, 'sculpture', [x - sign * 0.33, y + 2.9, z + 0.34], [0.57, 0.28, 0.47], trim, 10, 5);
    limb(o, d, [x, y + 0.7, z + 0.45], [x + sign * 1.4, y - 0.5, z + 0.75], 0.59);
    limb(o, d, [x + sign * 1.4, y - 0.5, z + 0.75], [x + sign * 2.4, y - 0.8, z + 0.85], 0.39);
    limb(o, d, [x - sign * 0.5, y + 1.6, z + 0.45], [x - sign * 1.6, y + 0.85, z + 0.85], 0.3);
    limb(o, d, [x + sign * 0.5, y + 1.65, z + 0.4], [x + sign * 1.25, y + 2.2, z + 0.7], 0.3);
    limb(o, d, [x + sign * 1.25, y + 2.2, z + 0.7], [x + sign * 1.6, y + 1.45, z + 0.8], 0.25);
    if (d > 1) {
      plate(
        o,
        'sculpture',
        [
          [x - 0.8, y + 1],
          [x + 0.8, y + 1],
          [x + sign * 1.7, y - 0.65],
          [x - 0.8, y - 0.4],
        ],
        z + 1.0,
        0.18,
        trim,
      );
      for (let i = 0; i < 5; i++)
        beam(
          o,
          'sculpture',
          [x - 0.6 + i * 0.25, y + 0.7, z + 1.2],
          [x + sign * 0.8 - 0.6 + i * 0.25, y - 0.4, z + 1.18],
          0.07,
          0.07,
          shade,
        );
    }
  }
  if (d > 0)
    for (let i = 0; i < 18; i++) {
      const sign = i < 9 ? -1 : 1,
        x = sign * (2.1 + (i % 9) * 0.85),
        y = d === 3 && i % 9 < 2 ? 35.1 : 36.0 + 1.6 * (1 - (x / 11) ** 2),
        q = d === 3 && i % 9 < 2 ? clockContactOutput(o) : o;
      sphere(q, 'sculpture', [x, y + 0.2, z + 0.9], [0.55, 0.35, 0.3], stone, 8, 4);
      if (d > 1)
        sphere(q, 'sculpture', [x + 0.25, y + 0.42, z + 1.05], [0.2, 0.17, 0.17], trim, 8, 4);
    }
  clock(o, d);
}
function ownStatue(o, d) {
  B(o, 'granite', 0, 6.9, 45.0, 1.8, 0.7, 1.6, granite);
  B(o, 'granite', 0, 7.6, 45.0, 1.3, 1.5, 1.3, granite);
  if (d === 0) {
    B(o, 'bronze', 0, 9.1, 45, 0.8, 2.8, 0.6, bronze);
    return;
  }
  sphere(o, 'bronze', [0, 11.6, 45], [0.29, 0.35, 0.26], bronze, 10, 6);
  B(o, 'bronze', 0, 9.8, 45, 0.72, 1.5, 0.48, bronze);
  for (const sign of [-1, 1]) {
    limb(o, d, [sign * 0.2, 9.3, 45], [sign * 0.2, 10.4, 45], 0.25, bronze);
    limb(o, d, [sign * 0.32, 10.9, 45], [sign * 0.6, 10.2, 45.05], 0.18, bronze);
  }
}
export function grandCentralTerminal(o, _frame, d = 3) {
  detailLevel = d;
  const front = facing(o, 0, 0.12, 43.5),
    holes = [
      ...[-29.5, 0, 29.5].map((x) => ({ x, y: 7.8, w: 13.4, h: 21.0, r: 6.7, depth: 0.85 })),
      ...[-14, 14].flatMap((x) => [
        { x, y: 8.1, w: 4.8, h: 11.0, depth: 0.65 },
        { x, y: 21.35, w: 4.3, h: 6.1, oval: true, depth: 0.7 },
      ]),
      ...[-35, -23, -11, 0, 11, 23, 35].map((x) => ({
        x,
        y: 0.6,
        w: x === 0 ? 7.5 : 8.2,
        h: 4.8,
        depth: 0.75,
      })),
    ];
  wall(front, d, 85.8, 34.95, 0, holes);
  // Granite lower band only where the actual openings leave masonry.
  for (const x of [-42, -29, -17, -5.5, 5.5, 17, 29, 42])
    B(front, 'granite', x, -1.3, 0.01, x === 0 ? 1 : 1.4, 7.5, 0.12, granite);
  for (const y of [5.45, 6.15, 7.1]) B(front, 'granite', 0, y, 0.18, 85.8, 0.28, 0.55, granite);
  for (const x of [-38, -22, -18, -10, -7.8, 7.8, 10, 18, 22, 38]) column(o, d, x + 0.12);
  for (const x of [-14, 14]) ovalGarland(o, d, x + 0.12);
  cornice(o, 0.12, 33.7, 85.8, 19.6, 30.0, d);
  B(front, 'stone', 0, 32.0, -0.05, 85.8, 2.95, 0.9, stone);
  for (const x of [-29.5, 0, 29.5]) {
    B(front, 'trim', x, 32.4, 0.49, x === 0 ? 23 : 23.7, 0.16, 0.16, trim);
    B(front, 'trim', x, 34.1, 0.49, x === 0 ? 23 : 23.7, 0.16, 0.16, trim);
    for (const sign of [-1, 1])
      B(front, 'trim', x + sign * 11.7, 32.4, 0.49, 0.15, 1.85, 0.16, trim);
  }
  for (const x of [-41, -14, 14, 41])
    cartouche(front, d, x, 33.45, 0.65, x === -41 || x === 41 ? 1.1 : 0.85);
  hip(o, 'copper', 0.12, 33.4, 86.5, 20.6, 34.2, 37.25, 70, copper, d);
  // Side wings: three large arched side windows and flanking rectangular bays, per operator section.
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * 45.65, -10.1),
      a = [-15, 0, 15].map((x) => ({ x, y: 6.0, w: 10.5, h: 22.6, r: 5.25, depth: 0.72 })),
      b = [-28.2, 28.2].map((x) => ({ x, y: 7.0, w: 6.6, h: 15.3, depth: 0.6 })),
      doors = [-15, 0, 15].map((x) => ({
        x,
        y: sign < 0 ? 1.25 : 0.45,
        w: 4.3,
        h: 3.9,
        depth: 0.82,
      }));
    wall(q, d, 67.1, 31.0, 0, [...a, ...b, ...doors]);
    for (const x of [-22.1, -7.5, 7.5, 22.1]) B(q, 'trim', x, 6.1, 0.2, 1.3, 23.5, 0.65, trim);
    for (const y of [5.4, 29.2, 30.3]) B(q, 'trim', 0, y, 0.15, 67.4, 0.35, 0.65, trim);
    hip(
      facing(o, Math.PI / 2, sign * 40.35, -10.1),
      'copper',
      0,
      0,
      68.2,
      11.3,
      31.2,
      34.8,
      56,
      copper,
      d,
    );
    if (d > 0) {
      B(q, 'metal', 0, 5.05, 2.0, 13.5, 0.3, 4.2, metal);
      for (const x of [-6.2, 0, 6.2])
        beam(q, 'metal', [x, 4.1, 0.2], [x, 5.0, 3.8], 0.12, 0.12, metal);
    }
  }
  // Front side-return blocks and rear own interface; no MetLife massing.
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * 43.02, 33.5);
    wall(
      q,
      d,
      20.6,
      30.0,
      0,
      [-5.7, 5.7].map((x) => ({ x, y: 9, w: 3.7, h: 15, depth: 0.5 })),
    );
    B(q, 'trim', 0, 6.0, 0.1, 20.8, 0.4, 0.5, trim);
  }
  const back = facing(o, Math.PI, 0, -43.5);
  wall(
    back,
    d,
    91.5,
    29.8,
    0,
    [-33, -20, -7, 7, 20, 33].flatMap((x) => [
      { x, y: 8, w: 5.0, h: 9, depth: 0.5 },
      { x, y: 20, w: 5.0, h: 5.0, depth: 0.5 },
    ]),
  );
  cornice(o, 0, -39.1, 91.5, 8.8, 29.5, d);
  B(o, 'flat', 0, 29.8, -39.1, 90.5, 0.25, 8.6, flat);
  // Main-concourse roof is a raised shallow pitched/hipped enclosure above the internal vault.
  for (const sign of [-1, 1]) {
    B(o, 'stone', sign * 34.45, 30.5, -9.0, 0.7, 4.8, 45.7, stone);
    B(o, 'stone', 0, 30.5, -9 + sign * 22.6, 69.5, 4.8, 0.65, stone);
  }
  hip(o, 'copper', 0, -9, 70, 46, 35.1, 41.5, 55.5, copper, d);
  hip(o, 'roof', 0, -9, 57, 32.4, 39.3, 42.05, 51, roof, 0);
  if (d > 0) {
    for (const sign of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const z = 17.7 + i * 1.9;
        B(o, 'flat', sign * 22, 23.5, z, 9.5, 0.6, 1.2, flat);
      }
    for (const sign of [-1, 1]) {
      B(o, 'flat', sign * 12, 24.0, 20, 7.5, 2.0, 4.2, flat);
      for (const x of [-1.8, 1.8])
        disc(facing(o, -Math.PI / 2, sign * 12, 20), 'metal', x, 25, 2.2, 0.73, metal, 12);
    }
  }
  // Own inner area-way stays open above its lower roof.
  B(o, 'flat', 0, 15.6, 20.2, 68, 0.25, 10.6, flat);
  for (const sign of [-1, 1]) B(o, 'stone', sign * 34.1, 15.6, 20.2, 0.6, 15.6, 10.6, shade);
  sculpture(o, d);
  ownStatue(o, d);
  if (d > 1) {
    for (let row = 0; row < 12; row++) {
      const y = 8.8 + row * 1.7;
      for (const x of [-41.5, 41.5]) B(front, 'stone', x, y, 0.015, 2.0, 0.026, 0.035, shade);
    }
    for (const x of [-35, -23, -11, 0, 11, 23, 35]) {
      for (let i = 0; i < 5; i++)
        B(front, 'metal', x + (i - 2) * 1.25, 0.75, -0.48, 0.045, 4.5, 0.065, bronze);
      B(front, 'metal', x, 3.7, -0.45, 8, 0.06, 0.08, bronze);
    }
  }
}
function coarseSculpture(o, _d) {
  plate(
    o,
    'stone',
    [
      [-11, 35.8],
      [11, 35.8],
      [0, 39.0],
    ],
    44.5,
    0.8,
    stone,
  );
  plate(
    o,
    'sculpture',
    [
      [-5.3, 42.2],
      [5.3, 42.2],
      [1.7, 40.5],
      [-1.7, 40.5],
    ],
    44.0,
    0.7,
    stone,
  );
  B(o, 'sculpture', 0, 39.3, 44.7, 1.35, 4.2, 1.1, stone);
  B(o, 'sculpture', 0, 43.5, 44.7, 0.85, 1.0, 0.9, stone);
  limb(o, 0, [-0.5, 43.0, 44.8], [-2.2, 45.7, 44.8], 0.5);
  limb(o, 0, [0.5, 43.0, 44.8], [3.1, 43.9, 44.8], 0.48);
  for (const sign of [-1, 1]) {
    B(o, 'sculpture', sign * 6.2, 38.7, 44.6, 1.5, 2.0, 1.0, stone);
    B(o, 'sculpture', sign * 6, 40.7, 44.7, 0.8, 0.8, 0.8, stone);
    limb(o, 0, [sign * 6.2, 39.1, 44.7], [sign * 8.6, 37.6, 45.0], 0.7);
  }
  clock(o, 0);
}
export function grandCentralTerminalSkyline(o) {
  detailLevel = 0;
  const w = facing(o, 0, 0.12, 43.5);
  wall(
    w,
    -1,
    85.8,
    35,
    0,
    [-29.5, 0, 29.5].map((x) => ({ x, y: 7.8, w: 13.4, h: 21, r: 6.7, depth: 0.85 })),
  );
  for (const x of [-38, -22, -18, -10, -7.8, 7.8, 10, 18, 22, 38])
    B(o, 'trim', x, 7.5, 44.1, 1.9, 22.6, 1.7, trim);
  for (const sign of [-1, 1]) {
    const q = facing(o, (sign * Math.PI) / 2, sign * 45.65, -10.1);
    wall(
      q,
      -1,
      67.1,
      31,
      0,
      [-15, 0, 15].map((x) => ({ x, y: 6, w: 10.5, h: 22.6, r: 5.25, depth: 0.72 })),
    );
    hip(
      facing(o, Math.PI / 2, sign * 40.35, -10.1),
      'copper',
      0,
      0,
      68.2,
      11.3,
      31.2,
      34.8,
      56,
      copper,
      0,
    );
    B(o, 'stone', sign * 43, 0, 33.6, 0.6, 31, 20.2, stone);
  }
  B(o, 'stone', 0, -1.3, -43.5, 91.5, 31.3, 0.6, stone);
  B(o, 'trim', 0.12, 30.2, 43.7, 87.1, 1.1, 1.5, trim);
  hip(o, 'copper', 0.12, 33.4, 86.5, 20.6, 34.2, 37.25, 70, copper, 0);
  hip(o, 'copper', 0, -9, 70, 46, 35.1, 41.5, 55.5, copper, 0);
  hip(o, 'roof', 0, -9, 57, 32.4, 39.3, 42.05, 51, roof, 0);
  B(o, 'stone', -34.45, 29, -9, 0.6, 6.2, 46, stone);
  B(o, 'stone', 34.45, 29, -9, 0.6, 6.2, 46, stone);
  B(o, 'flat', 0, 29.8, -39.1, 90.5, 0.3, 8.6, flat);
  B(o, 'flat', 0, 15.6, 20.2, 68, 0.3, 10.6, flat);
  coarseSculpture(o, 0);
}
export function grandCentralTerminalDistrict(o, f) {
  grandCentralTerminal(o, f, 1);
}
export function grandCentralTerminalStreet(o, f) {
  grandCentralTerminal(o, f, 2);
}
const surfaces = {
  clockContactStone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  clockStone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89, metallic: 0 },
  clockBrass: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.3 },
  clockGlazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.1 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.89, metallic: 0 },
  sculpture: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  granite: { slot: 'wall', graph: 'stone_marble', roughness: 0.91, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  flat: { slot: 'roof', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.25 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.3 },
  clock: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.3 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0.1 },
};
export const grandCentralTerminalModel = {
  id: 'grand_central_terminal',
  key: 'grand_central_terminal',
  recipe: 'structure-grand-central-terminal.mjs',
  cell: 'dr/dr5',
  title: 'Grand Central Terminal',
  brief:
    'Own Beaux-Arts limestone terminal: three great arched gridded south windows, ten fluted columns, oval windows/garlands, granite retail entrances, attic/dentilled cornice/cartouches, Tiffany-style coloured exterior clock, original simplified Mercury/eagle/Hercules/Minerva group and bronze Vanderbilt figure, green copper front/side hips, raised light main-concourse roof and open internal area-way. Surrounding viaduct, towers, platforms and interiors excluded.',
  camera: [-130, 86, 170],
  lookAt: [0, 21, 0],
  qaCameras: [
    { name: 'exterior-clock', position: [0.15, 38.5, 54], lookAt: [0, 37.6, 45.08] },
    { name: 'front', position: [0, 33, 200], lookAt: [0, 21, 10] },
    { name: 'front-detail', position: [-23, 39, 88], lookAt: [0, 36.5, 43.5] },
    { name: 'back', position: [110, 80, -140], lookAt: [0, 23, -9] },
    { name: 'base-detail', position: [-19, 12, 80], lookAt: [0, 6, 43.5] },
    { name: 'roof-detail', position: [-65, 110, 30], lookAt: [0, 27, -1] },
  ],
  mediumFiContext: { scale: 1.1 },
  build: grandCentralTerminal,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Independent native Terrarium datum16.7424m at dry south sidewalk[0,46.5]; own NYC footprint-.784..+1.151m lies above below-grade own base-1.3m. South storefront/central frontage and side closed entrances clear ground; lower granite base absorbs source slope. Geographic contact visually reviewed as bounded preview; public coarse urban DEM and threshold elevations remain approximate, host-dependent. Terrain unchanged; footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-grand-central-terminal.mjs',
    level: 'skyline',
    export: 'grandCentralTerminalSkyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: {
      district: { export: 'grandCentralTerminalDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'grandCentralTerminalStreet', errorMeters: 0.4, surfaces },
    },
  },
  limitations: [
    'New physical exterior clock is based only on exact native Highsmith2008photographer-public-domain detail after Qualla-first41paths. Blue field,12burgundy oval medallions,radial white Roman numerals,gold rings/spokes and raised hands built; exact craft,dial dimensions,ornament,time and current patina remain medium-fi estimates. Full fixed terminal exterior still awaits broader cleared public-domain coverage. Earlier image controls are historical and excluded.',
    'Own envelope uses official NYC BIN1035381 polygon91.584x87.720m, south facade85.807m; this agrees historical301ft overall width and excludes broader mapped viaduct margins. Local2019/2012 photographs, primary operator2010 section and aerial control proportions. Facade/detail/roof heights, window profiles and original simplified sculptures remain estimates, not measured survey/scans.',
    'Integral clock/sculpture group, bronze Vanderbilt, original monumental windows and own roof masses retained. Side/rear opening placements and hidden area-way equipment are approximate. Neighbouring MetLife/Hyatt/Graybar/One Vanderbilt, road viaduct/bridge, tracks/interiors, flags, shop signage/awnings and street furniture excluded. No reference photographic pixels or plan pages redistributed.',
    'Native independent terrain retained unchanged; geographic activation requires current source contact review. Footprint replacement disabled.',
  ],
};
