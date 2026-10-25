/** Complete Nottingham Albert Hall, native envelope with researched Baroque terracotta front. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcr/albert_hall_nottingham/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    buff: rgb('b7a58b'),
    brick: rgb('89624e'),
    roof: rgb('666860'),
    glass: rgb('45504e'),
    metal: rgb('4d504b'),
    joint: rgb('8e806c'),
  },
  pale = rgb('d3cdbd'),
  surfaces = {
    buff: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
    brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
    glass: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.29, metallic: 0.04 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.35 },
    joint: { slot: 'trim', localRef: ref, roughness: 1, metallic: 0 },
  };
const rect = (x, z, w, l) => [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ],
  area = (p) =>
    p.reduce(
      (s, a, i) => s + a[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * a[1],
      0,
    ) / 2,
  vary = (c, k) => c.map((v) => Math.min(1, Math.max(0, v * k)));
function tri(o, s, p, h, col = C[s]) {
  p = p.map((p) => p.map(Math.fround));
  const n = cross(
    p[1].map((v, i) => v - p[0][i]),
    p[2].map((v, i) => v - p[0][i]),
  );
  if (Math.hypot(...n) < 1e-8) return;
  if (h && n.reduce((s, v, i) => s + v * h[i], 0) < 0) [p[1], p[2]] = [p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, h, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], h, col);
  tri(o, s, [p[0], p[2], p[3]], h, col);
}
function cap(o, s, p, y, up = true, col = C[s]) {
  const ix = earcut(p.flat());
  for (let i = 0; i < ix.length; i += 3)
    tri(
      o,
      s,
      ix.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, p, y0, y1, col = C[s]) {
  const sign = area(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      s,
      [
        [p[i][0], y0, p[i][1]],
        [p[j][0], y0, p[j][1]],
        [p[j][0], y1, p[j][1]],
        [p[i][0], y1, p[i][1]],
      ],
      [sign * (p[j][1] - p[i][1]), 0, sign * (p[i][0] - p[j][0])],
      col,
    );
  }
  cap(o, s, p, y0, false, col);
  cap(o, s, p, y1, true, col);
}
function extrude(o, s, p, z0, z1, col = C[s]) {
  const ix = earcut(p.flat()),
    sign = area(p) > 0 ? 1 : -1;
  for (const [z, sg] of [
    [z0, -1],
    [z1, 1],
  ])
    for (let i = 0; i < ix.length; i += 3)
      tri(
        o,
        s,
        ix.slice(i, i + 3).map((j) => [p[j][0], p[j][1], z]),
        [0, 0, sg],
        col,
      );
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      s,
      [
        [p[i][0], p[i][1], z0],
        [p[j][0], p[j][1], z0],
        [p[j][0], p[j][1], z1],
        [p[i][0], p[i][1], z1],
      ],
      [sign * (p[j][1] - p[i][1]), sign * (p[i][0] - p[j][0]), 0],
      col,
    );
  }
}
const B = (o, s, a, b, w, h = w, col = C[s]) => beam(o, s, a, b, w, h, col);
function lathe(o, s, x, z, profile, n, col = C[s], flute = 0) {
  let last;
  for (const [y, r] of profile) {
    const p = Array.from({ length: n }, (_, i) => {
      const a = (i * tau) / n,
        rr = r * (1 - (flute ? (0.045 * (1 - Math.cos(a * flute))) / 2 : 0));
      return [x + rr * Math.cos(a), z + rr * Math.sin(a)];
    });
    if (last) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        Q(
          o,
          s,
          [
            [last.p[i][0], last.y, last.p[i][1]],
            [last.p[j][0], last.y, last.p[j][1]],
            [p[j][0], y, p[j][1]],
            [p[i][0], y, p[i][1]],
          ],
          [Math.cos(((i + 0.5) * tau) / n), 0, Math.sin(((i + 0.5) * tau) / n)],
          col,
        );
      }
    } else cap(o, s, p, y, false, col);
    last = { p, y };
  }
  cap(o, s, last.p, last.y, true, col);
}
function frame(o, x, y, w, h, z, d) {
  if (d === 0) return;
  if (d === 1) {
    for (const sign of [-1, 1])
      Q(
        o,
        'buff',
        [
          [x + (sign * w) / 2 - 0.08, y, z],
          [x + (sign * w) / 2 + 0.08, y, z],
          [x + (sign * w) / 2 + 0.08, y + h, z],
          [x + (sign * w) / 2 - 0.08, y + h, z],
        ],
        [0, 0, 1],
        pale,
      );
    for (const yy of [y, y + h])
      Q(
        o,
        'buff',
        [
          [x - w / 2, yy - 0.08, z],
          [x + w / 2, yy - 0.08, z],
          [x + w / 2, yy + 0.08, z],
          [x - w / 2, yy + 0.08, z],
        ],
        [0, 0, 1],
        pale,
      );
    return;
  }
  for (const s of [-1, 1])
    B(o, 'buff', [x + (s * w) / 2, y, z], [x + (s * w) / 2, y + h, z], 0.16, 0.18, pale);
  for (const yy of [y, y + h])
    B(o, 'buff', [x - w / 2, yy, z], [x + w / 2, yy, z], 0.17, 0.18, pale);
}
function window(o, x, y, w, h, z, d) {
  Q(
    o,
    'glass',
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
  );
  frame(o, x, y, w, h, z + 0.06, d);
  if (d === 1) {
    Q(
      o,
      'buff',
      [
        [x - 0.03, y, z + 0.09],
        [x + 0.03, y, z + 0.09],
        [x + 0.03, y + h, z + 0.09],
        [x - 0.03, y + h, z + 0.09],
      ],
      [0, 0, 1],
      pale,
    );
    Q(
      o,
      'buff',
      [
        [x - w / 2, y + h * 0.5 - 0.025, z + 0.09],
        [x + w / 2, y + h * 0.5 - 0.025, z + 0.09],
        [x + w / 2, y + h * 0.5 + 0.025, z + 0.09],
        [x - w / 2, y + h * 0.5 + 0.025, z + 0.09],
      ],
      [0, 0, 1],
      pale,
    );
    return;
  }
  if (d >= 2) {
    B(o, 'buff', [x, y, z + 0.09], [x, y + h, z + 0.09], 0.055, 0.06, pale);
    const n = d === 3 ? Math.max(2, Math.round(h / 1.3)) : 2;
    for (let i = 1; i < n; i++)
      B(
        o,
        'buff',
        [x - w / 2, y + (i * h) / n, z + 0.09],
        [x + w / 2, y + (i * h) / n, z + 0.09],
        0.045,
        0.055,
        pale,
      );
  }
}
function archRing(o, s, x, spring, r, rz, z, width, d, col = C[s], start = 0, end = Math.PI) {
  const n = [4, 7, 14, 24][d];
  for (let i = 0; i < n; i++) {
    const a = start + ((end - start) * i) / n,
      b = start + ((end - start) * (i + 1)) / n,
      p = [
        [x + r * Math.cos(a), spring + rz * Math.sin(a)],
        [x + r * Math.cos(b), spring + rz * Math.sin(b)],
        [x + (r + width) * Math.cos(b), spring + (rz + width) * Math.sin(b)],
        [x + (r + width) * Math.cos(a), spring + (rz + width) * Math.sin(a)],
      ];
    if (d < 3)
      Q(
        o,
        s,
        p.map((p) => [...p, z]),
        [0, 0, 1],
        col,
      );
    else extrude(o, s, p, z - 0.12, z + 0.12, col);
  }
}
function archFill(o, s, x, y, w, spring, rise, z, d, col = C[s]) {
  const n = [4, 7, 14, 24][d],
    p = [
      [x - w / 2, y],
      [x + w / 2, y],
      [x + w / 2, spring],
      ...Array.from({ length: n }, (_, i) => {
        const a = ((i + 1) * Math.PI) / n;
        return [x + (w / 2) * Math.cos(a), spring + rise * Math.sin(a)];
      }),
    ];
  extrude(o, s, p, z - 0.035, z + 0.035, col);
}
function roundWindow(o, x, y, r, z, d) {
  const n = [6, 10, 20, 32][d],
    p = Array.from({ length: n }, (_, i) => [
      x + r * Math.cos((i * tau) / n),
      y + r * Math.sin((i * tau) / n),
    ]);
  extrude(o, 'glass', p, z - 0.02, z + 0.02);
  archRing(o, 'buff', x, y, r, r, z + 0.05, 0.16, d, C.buff, 0, tau);
  if (d >= 1) {
    B(o, 'buff', [x - r, y, z + 0.1], [x + r, y, z + 0.1], 0.06, 0.06, pale);
    B(o, 'buff', [x, y - r, z + 0.1], [x, y + r, z + 0.1], 0.06, 0.06, pale);
  }
}
function column(o, x, z, y, h, r, d) {
  const n = [4, 6, 12, 32][d],
    prof =
      d < 2
        ? [
            [y, r * 1.15],
            [y + 0.25, r],
            [y + h - 0.4, r * 0.85],
            [y + h, r * 1.3],
          ]
        : [
            [y, r * 1.3],
            [y + 0.15, r * 1.3],
            [y + 0.32, r],
            [y + h * 0.4, r * 0.98],
            [y + h - 0.5, r * 0.83],
            [y + h - 0.27, r * 1.1],
            [y + h - 0.12, r * 1.32],
            [y + h, r * 1.32],
          ];
  lathe(o, 'buff', x, z, prof, n, C.buff, d === 3 ? 16 : 0);
  if (d >= 1) prism(o, 'buff', rect(x, z, r * 3, r * 2.7), y + h, y + h + 0.16);
  if (d >= 3)
    for (const sign of [-1, 1]) {
      const cx = x + sign * r * 0.85,
        cy = y + h - 0.18;
      archRing(o, 'buff', cx, cy, r * 0.4, r * 0.4, z + r * 0.75, r * 0.11, d, C.buff, 0, tau);
    }
}
function pediment(o, x, y, w, h, z, d, fill = true) {
  if (fill)
    extrude(
      o,
      'buff',
      [
        [x - w / 2, y],
        [x + w / 2, y],
        [x, y + h],
      ],
      z - 0.35,
      z + 0.03,
    );
  B(o, 'buff', [x - w / 2 - 0.15, y, z + 0.18], [x, y + h + 0.1, z + 0.18], 0.25, 0.3);
  B(o, 'buff', [x, y + h + 0.1, z + 0.18], [x + w / 2 + 0.15, y, z + 0.18], 0.25, 0.3);
  if (d)
    for (const s of [-1, 1])
      B(
        o,
        'buff',
        [x + s * w * 0.5, y - 0.12, z + 0.14],
        [x + s * w * 0.15, y - 0.12, z + 0.14],
        0.22,
        0.3,
      );
}
function festoon(o, x, y, z, w, h, d) {
  if (d < 2) return;
  const n = d === 3 ? 15 : 8;
  for (let i = 0; i < n; i++) {
    const a = i / n,
      b = (i + 1) / n,
      P = (t) => [x + (t - 0.5) * w, y - h * Math.sin(Math.PI * t), z];
    B(o, 'buff', P(a), P(b), 0.12, 0.16);
    if (d === 3 && i % 2 === 0) sphere(o, 'buff', P((a + b) / 2), [0.15, 0.22, 0.1], C.buff, 6, 3);
  }
}
function shield(o, x, y, z, d) {
  if (d < 2) return;
  const p = [
    [x - 0.38, y + 0.52],
    [x + 0.38, y + 0.52],
    [x + 0.45, y + 0.1],
    [x + 0.27, y - 0.35],
    [x, y - 0.55],
    [x - 0.27, y - 0.35],
    [x - 0.45, y + 0.1],
  ];
  extrude(o, 'buff', p, z - 0.05, z + 0.16);
  for (const s of [-1, 1]) festoon(o, x + s * 0.72, y + 0.25, z + 0.16, 0.7, 0.42, d);
  if (d === 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      sphere(
        o,
        'buff',
        [x + Math.cos(a) * 0.6, y + Math.sin(a) * 0.73, z + 0.14],
        [0.16, 0.2, 0.12],
        C.buff,
        6,
        3,
      );
    }
}
function balustrade(o, x0, x1, y, z, d) {
  if (d === 0) {
    Q(
      o,
      'buff',
      [
        [x0, y, z],
        [x1, y, z],
        [x1, y + 1.0, z],
        [x0, y + 1.0, z],
      ],
      [0, 0, 1],
    );
    return;
  }
  B(o, 'buff', [x0, y, z], [x1, y, z], 0.24, 0.2);
  B(o, 'buff', [x0, y + 1, z], [x1, y + 1, z], 0.3, 0.2);
  const count = Math.max(2, Math.ceil((x1 - x0) / (d === 1 ? 1.3 : 0.55)));
  for (let i = 0; i <= count; i++) {
    const x = x0 + ((x1 - x0) * i) / count;
    if (d === 1) prism(o, 'buff', rect(x, z, 0.16, 0.2), y + 0.1, y + 0.9);
    else
      lathe(
        o,
        'buff',
        x,
        z,
        [
          [y + 0.1, 0.12],
          [y + 0.2, 0.08],
          [y + 0.46, 0.15],
          [y + 0.64, 0.11],
          [y + 0.8, 0.06],
          [y + 0.9, 0.11],
        ],
        d === 3 ? 8 : 6,
      );
  }
}
function body(o, d) {
  prism(o, 'buff', plan.outline, -0.65, 0.25);
  prism(o, 'brick', plan.outline, 0.25, 16.4);
  prism(o, 'buff', rect(-3, 0.12, 24.3, 0.45), 0, 16.5);
  for (const [y, h, dep] of [
    [0.28, 0.28, 0.5],
    [4.8, 0.35, 0.62],
    [15.8, 0.28, 0.62],
    [16.25, 0.32, 0.85],
    [16.7, 0.28, 1.0],
  ])
    prism(o, 'buff', rect(-3, 0.08, 24.7, dep), y, y + h);
  if (d >= 2) {
    for (let y = 0.65; y < 4.7; y += 0.48)
      Q(
        o,
        'joint',
        [
          [-15.1, y - 0.012, 0.365],
          [9.1, y - 0.012, 0.365],
          [9.1, y + 0.012, 0.365],
          [-15.1, y + 0.012, 0.365],
        ],
        [0, 0, 1],
      );
  }
  const x0 = -15.1,
    x1 = 11.9,
    z0 = -42.8,
    z1 = -0.1,
    cx = (x0 + x1) / 2,
    h = 21.6,
    e = 16.4,
    inset = (x1 - x0) / 2;
  Q(
    o,
    'roof',
    [
      [x0, e, z0],
      [x0, e, z1],
      [cx, h, z1 - inset],
      [cx, h, z0 + inset],
    ],
    [-1, 1, 0],
  );
  Q(
    o,
    'roof',
    [
      [x1, e, z1],
      [x1, e, z0],
      [cx, h, z0 + inset],
      [cx, h, z1 - inset],
    ],
    [1, 1, 0],
  );
  tri(
    o,
    'roof',
    [
      [x0, e, z1],
      [x1, e, z1],
      [cx, h, z1 - inset],
    ],
    [0, 1, 1],
  );
  tri(
    o,
    'roof',
    [
      [x1, e, z0],
      [x0, e, z0],
      [cx, h, z0 + inset],
    ],
    [0, 1, -1],
  );
  B(o, 'roof', [cx, h, z0 + inset], [cx, h, z1 - inset], 0.22, 0.22);
  Q(
    o,
    'roof',
    [
      [11.9, 17.4, -15.1],
      [15.35, 16.4, -15.1],
      [15.35, 16.4, -0.1],
      [11.9, 17.4, -0.1],
    ],
    [1, 1, 0],
  );
  // The rear and side are brick hall architecture within the exact parent, not neighboring buildings.
  if (d >= 1) {
    for (let i = 0; i < 5; i++) {
      const z = -7.5 - i * 7.0,
        x = z < -15.1 ? 11.92 : 15.35,
        proxy = rotated(o, x, z, Math.PI / 2);
      archFill(proxy, 'glass', 0, 11.5, 5.0, 11.5, 2.15, 0.08, d);
      archRing(proxy, 'buff', 0, 11.5, 2.5, 2.15, 0.16, 0.16, d);
      if (d >= 2)
        for (const u of [-0.82, 0.82])
          B(proxy, 'buff', [u, 11.5, 0.2], [u, 13.5, 0.2], 0.08, 0.08, pale);
      window(proxy, 0, 2.0, 1.7, 2.1, 0.08, d);
    }
  }
  if (d === 3) {
    for (let i = 0; i < 7; i++)
      window(rotated(o, -15.2, -5 - i * 5.4, -Math.PI / 2), 0, 6.7, 1.5, 5.0, 0.06, 2);
    for (let i = 0; i < 5; i++)
      window(rotated(o, -12 + i * 4.5, -42.85, Math.PI), 0, 5.2, 1.6, 5.0, 0.06, 2);
  }
}
function facade(o, d) {
  for (const x of [-13, -8, -3, 2, 7]) {
    if (x === -3) {
      for (let i = 0; i < 3; i++) window(o, x + (i - 1) * 1.45, 5.8, 1.1, 7.4, 0.42, d);
      for (const s of [-1, 1]) column(o, x + s * 2.8, 0.8, 5.1, 8.75, 0.38, d);
      prism(o, 'buff', rect(x, 0.7, 6.6, 1.0), 14.0, 14.45);
      archRing(o, 'buff', x, 14.4, 2.65, 1.25, 0.9, 0.3, d, C.buff, 0.1 * Math.PI, 0.43 * Math.PI);
      archRing(o, 'buff', x, 14.4, 2.65, 1.25, 0.9, 0.3, d, C.buff, 0.57 * Math.PI, 0.9 * Math.PI);
      pediment(o, x, 17, 8.8, 2.8, 0.28, d);
      shield(o, x, 18.0, 0.58, d);
      prism(o, 'buff', rect(x, -0.25, 5.4, 1), 19.6, 21.5);
      prism(o, 'buff', rect(x, -0.2, 5.9, 1.25), 21.3, 21.7);
      for (let i = 0; i < 4; i++) window(o, x + (i - 1.5) * 1.18, 0.9, 0.75, 2.8, 0.43, d);
    } else if (x === -8 || x === 2) {
      window(o, x, 5.8, 1.7, 6.2, 0.44, d);
      pediment(o, x, 12.3, 2.6, 0.8, 0.48, d);
      roundWindow(o, x, 14.25, 0.82, 0.45, d);
      festoon(o, x, 13.5, 0.62, 2.3, 0.7, d);
      archFill(o, 'metal', x, 0.2, 3.7, 2.4, 1.85, 0.41, d);
      archRing(o, 'buff', x, 2.4, 1.85, 1.85, 0.66, 0.27, d);
      for (const s of [-1, 1]) prism(o, 'buff', rect(x + s * 2.05, 0.5, 0.42, 0.55), 0.1, 2.5);
      if (d >= 1) {
        B(o, 'buff', [x, 0.2, 0.55], [x, 2.5, 0.55], 0.12, 0.12);
        for (const s of [-1, 1]) window(o, x + s * 0.92, 0.65, 1.4, 1.8, 0.56, d);
      }
    } else {
      window(o, x, 5.8, 1.5, 5.2, 0.44, d);
      window(o, x, 12.2, 1.25, 2.8, 0.44, d);
      pediment(o, x, 15.3, 2.5, 0.7, 0.46, d);
      archFill(o, 'metal', x, 0.15, 2.5, 2.1, 1.0, 0.43, d);
      archRing(o, 'buff', x, 2.1, 1.25, 1.0, 0.66, 0.24, d);
      prism(o, 'buff', rect(x, -0.25, 3.3, 1.3), 17, 19);
      archFill(o, 'glass', x, 17.1, 1.7, 17.9, 0.85, 0.46, d);
      archRing(o, 'buff', x, 17.9, 0.85, 0.85, 0.61, 0.2, d);
      pediment(o, x, 19.0, 4.0, 1.45, 0.43, d);
      Q(
        o,
        'roof',
        [
          [x - 1.8, 19.05, -0.5],
          [x, 20.5, -0.5],
          [x, 20.5, -2.2],
          [x - 1.8, 19.05, -2.2],
        ],
        [-1, 1, 0],
      );
      Q(
        o,
        'roof',
        [
          [x, 20.5, -0.5],
          [x + 1.8, 19.05, -0.5],
          [x + 1.8, 19.05, -2.2],
          [x, 20.5, -2.2],
        ],
        [1, 1, 0],
      );
    }
  }
  // Heavy rusticated pilasters and stepped keystones are separate masonry, not painted stripes.
  for (const x of [-15.0, -10.6, -5.55, -0.45, 4.55, 9.0]) {
    if (d < 2) {
      prism(o, 'buff', rect(x, 0.45, 0.7, 0.5), 5.0, 16.5);
      continue;
    }
    for (let i = 0; i < 18; i++) {
      const y = 5 + i * 0.6;
      prism(
        o,
        'buff',
        rect(x, 0.5, 0.74 + (i % 2 ? 0 : 0.28), 0.6 + (i % 2 ? 0 : 0.14)),
        y,
        y + 0.54,
        vary(C.buff, 0.96 + (i % 3) * 0.035),
      );
    }
    prism(o, 'buff', rect(x, 0.57, 1.05, 0.85), 15.7, 16.2);
  }
  balustrade(o, -10.9, -6.1, 16.65, 0.3, d);
  balustrade(o, 0.1, 5.2, 16.65, 0.3, d);
  for (const x of [-13, -8, 2, 7]) {
    prism(o, 'buff', rect(x, 0.53, 0.5, 0.3), 12.0, 12.8);
    if (d >= 2) festoon(o, x, 5.65, 0.64, 1.8, 0.35, d);
  }
  if (d >= 2) {
    for (const x of [-8, 2])
      for (const s of [-1, 1]) {
        B(o, 'buff', [x + s * 1.05, 14.9, 0.58], [x + s * 1.2, 14.2, 0.58], 0.11, 0.16);
        shield(o, x + s * 1.3, 13.4, 0.65, 2);
      }
    for (const x of [-6.5, 0.5]) festoon(o, x, 18.4, 0.57, 1.6, 0.75, d);
  }
}
function rotated(o, x, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    T = (p) => [x + c * p[0] + s * p[2], p[1], z - s * p[0] + c * p[2]];
  return {
    addTriangle(slot, r, p, _n, uv, col) {
      o.addTriangle(slot, r, p.map(T), normalFor(...p.map(T)), uv, col);
    },
    addQuad(slot, r, p, _n, uv, col) {
      o.addQuad(slot, r, p.map(T), normalFor(...p.map(T)), uv, col);
    },
    addConvexPolygon(slot, r, p, _n, uv, col) {
      o.addConvexPolygon(slot, r, p.map(T), normalFor(...p.map(T)), uv, col);
    },
  };
}
function portal(o, y, d) {
  const w = 2.6,
    r = w / 2,
    spring = y + 3.8,
    top = y + 5.7,
    n = [3, 5, 10, 18][d];
  for (const x of [-1.65, 1.65]) prism(o, 'buff', rect(x, 2.05, 0.65, 0.7), y, top);
  const poly = [
    [-r, top],
    [r, top],
    [r, spring],
    ...Array.from({ length: n }, (_, i) => {
      const a = ((i + 1) * Math.PI) / n;
      return [r * Math.cos(a), spring + r * Math.sin(a)];
    }),
  ];
  extrude(o, 'buff', poly, 1.7, 2.4);
  if (d >= 1) {
    for (const x of [-1.65, 1.65]) column(o, x, 2.5, y + 0.1, 5.3, 0.22, d);
    archRing(o, 'buff', 0, spring, r, r, 2.48, 0.2, d);
    archRing(o, 'buff', 0, top, 1.8, 0.7, 2.5, 0.24, d);
    if (d >= 2) balustrade(o, -1.25, 1.25, y + 0.08, 2.05, d);
  }
}
function tower(o, d) {
  const x = 12.2,
    z = -3.25;
  prism(o, 'buff', rect(x, z, 6.2, 6.3), 0, 24.6);
  for (const y of [4.8, 18.8, 23.9, 24.5]) prism(o, 'buff', rect(x, z, 6.7, 6.8), y, y + 0.35);
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const px = x + s * 2.65,
        pz = z + t * 2.7;
      prism(o, 'buff', rect(px, pz, 0.9, 0.95), 0, 25.3);
      if (d >= 2)
        for (let j = 0; j < 35; j++) {
          const y = 0.3 + j * 0.7;
          for (const side of [-1, 1])
            Q(
              o,
              'joint',
              [
                [px - 0.46, y - 0.015, pz + side * 0.48],
                [px + 0.46, y - 0.015, pz + side * 0.48],
                [px + 0.46, y + 0.015, pz + side * 0.48],
                [px - 0.46, y + 0.015, pz + side * 0.48],
              ],
              [0, 0, side],
            );
        }
      lathe(
        o,
        'buff',
        px,
        pz,
        [
          [25.2, 0.5],
          [25.5, 0.45],
          [25.9, 0.52],
          [26.25, 0.35],
          [26.5, 0.12],
        ],
        d === 0 ? 4 : d === 1 ? 6 : 12,
      );
    }
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const p = rotated(o, x, z, a);
    if (d >= 1) {
      window(p, 0, 20.0, 0.6, 1.1, 3.2, d);
      shield(p, 0, 19.5, 3.3, d === 3 ? 2 : 0);
      if (d >= 2) {
        Q(
          p,
          'joint',
          [
            [-1.8, 6.3, 3.16],
            [1.8, 6.3, 3.16],
            [1.8, 17.7, 3.16],
            [-1.8, 17.7, 3.16],
          ],
          [0, 0, 1],
          vary(C.buff, 0.94),
        );
        for (const yy of [6.3, 17.7]) B(p, 'buff', [-1.9, yy, 3.25], [1.9, yy, 3.25], 0.22, 0.25);
      }
    }
    portal(p, 25, d);
  }
  // Main entrance belongs to the tower, with an arched gated recess.
  archFill(o, 'metal', x, 0.1, 2.4, 2.6, 1.2, 0.15, d);
  archRing(o, 'buff', x, 2.6, 1.2, 1.2, 0.35, 0.25, d);
  if (d >= 2)
    for (let i = 0; i < 9; i++)
      B(o, 'metal', [x - 1 + i * 0.25, 0.2, 0.3], [x - 1 + i * 0.25, 3.2, 0.3], 0.04, 0.045);
  lathe(
    o,
    'buff',
    x,
    z,
    [
      [30.55, 2.75],
      [31.1, 2.9],
      [31.35, 2.9],
    ],
    d === 0 ? 8 : d === 1 ? 12 : 24,
  );
  const prof = [
    [31.35, 2.8],
    [31.65, 2.75],
    [32.0, 2.58],
    [32.6, 2.36],
    [33.25, 1.95],
    [33.8, 1.45],
    [34.2, 1.05],
    [34.65, 0.65],
    [35, 0.3],
  ];
  lathe(
    o,
    'roof',
    x,
    z,
    d === 0 ? prof.filter((_, i) => i % 2 === 0) : prof,
    d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 24 : 40,
  );
  lathe(
    o,
    'buff',
    x,
    z,
    [
      [35, 0.3],
      [35.22, 0.42],
      [35.5, 0.22],
      [35.65, 0.15],
    ],
    d === 0 ? 4 : 12,
  );
  B(o, 'metal', [x, 35.6, z], [x, 37, z], 0.06, 0.06);
  if (d >= 1)
    lathe(
      o,
      'metal',
      x,
      z,
      [
        [36.9, 0.14],
        [37, 0.14],
      ],
      8,
    );
}
function build(o, _f, d = 3) {
  if (d === 0) return skyline(o);
  body(o, d);
  facade(o, d);
  tower(o, d);
}
function skyline(o) {
  body(o, 0);
  for (const x of [-13, -8, -3, 2, 7]) {
    window(o, x, 5.8, x === -3 ? 4.6 : 1.6, 7, 0.44, 0);
    if (x === -8 || x === 2) {
      const p = Array.from({ length: 8 }, (_, i) => [
        x + 0.85 * Math.cos((i * tau) / 8),
        14.25 + 0.85 * Math.sin((i * tau) / 8),
      ]);
      const ix = earcut(p.flat());
      for (let i = 0; i < ix.length; i += 3)
        tri(
          o,
          'glass',
          ix.slice(i, i + 3).map((j) => [...p[j], 0.45]),
          [0, 0, 1],
        );
    }
  }
  for (const [x, w, h, y] of [
    [-13, 4, 1.45, 19],
    [7, 4, 1.45, 19],
    [-3, 8.8, 2.8, 17],
  ]) {
    extrude(
      o,
      'buff',
      [
        [x - w / 2, y],
        [x + w / 2, y],
        [x, y + h],
      ],
      -0.3,
      0.4,
    );
  }
  prism(o, 'buff', rect(-3, -0.2, 5.5, 1.1), 19.7, 21.7);
  for (const x of [-5.8, -0.2])
    lathe(
      o,
      'buff',
      x,
      0.8,
      [
        [5.1, 0.5],
        [14.2, 0.5],
      ],
      4,
    );
  for (const x of [-8, 2]) archFill(o, 'metal', x, 0.2, 3.6, 2.4, 1.8, 0.42, 0);
  const tx = 12.2,
    tz = -3.25;
  prism(o, 'buff', rect(tx, tz, 6.2, 6.3), 0, 24.6);
  prism(o, 'buff', rect(tx, tz, 6.7, 6.8), 24.5, 25);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      lathe(
        o,
        'buff',
        tx + sx * 2.65,
        tz + sz * 2.7,
        [
          [24.8, 0.5],
          [25.8, 0.5],
          [26.5, 0.1],
        ],
        4,
      );
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2])
    portal(rotated(o, tx, tz, a), 25, 0);
  lathe(
    o,
    'buff',
    tx,
    tz,
    [
      [30.55, 2.75],
      [31.35, 2.9],
    ],
    8,
  );
  lathe(
    o,
    'roof',
    tx,
    tz,
    [
      [31.35, 2.8],
      [32.6, 2.36],
      [33.8, 1.45],
      [35, 0.3],
    ],
    8,
  );
  B(o, 'metal', [tx, 35, tz], [tx, 37, tz], 0.12, 0.12);
}
export const albertHallSkyline = (o, f) => build(o, f, 0);
export const albertHallDistrict = (o, f) => build(o, f, 1);
export const albertHallStreet = (o, f) => build(o, f, 2);
export const albertHallModel = {
  id: 'albert_hall_nottingham',
  key: 'albert_hall_nottingham',
  recipe: 'structure-albert-hall-nottingham.mjs',
  cell: 'gc/gcr',
  title: 'Albert Hall, Nottingham',
  category: 'concert-hall',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Complete native Nottingham Albert Hall: deep brick hall/hipped slate roof, warmbuffterracotta5bayBaroque front with rusticatedpiers, closedcasement/roundwindows, heavycornices/atticdormers/piercedbalustrade, centralIonicaedicule/brokensegmentalpediment/cartouche/festoons; attachedsquare3stagetower/claspingbuttresses/domespinnacles, genuine4openIonicportalrotunda/curvedpediments, closedogeedome/finial;5Diocletianwindows onbrickreturn. Original representative carving; no neighboringPlayhouse/missionhouse outsideparent/interior/streetscape.',
  camera: [-43, 30, 63],
  lookAt: [0, 14, -12],
  portableGroundY: -0.7,
  mediumFiContext: { scale: 1.2, groundY: -0.7 },
  qaCameras: [
    {
      name: 'complete-native-hall-tower-and-hipped-roof',
      position: [43, 44, 63],
      lookAt: [0, 15, -17],
      reviewLod: 'skyline',
    },
    {
      name: 'terracotta-baroque-five-bay-front-and-open-tower',
      position: [-24, 23, 43],
      lookAt: [0, 15, 0],
    },
    {
      name: 'deep-brick-return-five-diocletian-windows-and-slate-roof',
      position: [50, 31, -33],
      lookAt: [0, 13, -22],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Fixed pavement point[0,4]outside original westernfront before rawterrain acquisition. Complete native outline retained; frontage slope/threshold and concealed foundation levels approximate, no street terrain flattening/fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-albert-hall-nottingham.mjs',
    level: 'skyline',
    export: 'albertHallSkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'albertHallDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'albertHallStreet', errorMeters: 0.35, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Three exact already-published Qualla own-workPD/CC0architectural originals inspected, nativeSHA1matched and primary creator releases bound. Fourth2025near-duplicate unused; interiors/organ/unrelatedlandmarks/other-licensed imagery not used. No photographic textures or generated bitmaps; nativegeometry/originalrepresentative carving and sharedPBRsurfaces.',
    'Whole17vertexparent retained with deep brick hall/attached footprint projections and hippedslateroof. Roof ridge/hip partition, front/tower heights, side/rear window subdivisions, concealed return/threshold levels and fine carvings are photographic/primarytext estimates. Main37mfinial height is not surveyed. Original cartouche/festoons/capitals/pediments are medium-fi motifs rather than exact sculptural census or copied lettering.',
    'Four turret portals genuinely open beneath closedconnectedrotundacornice/ogeedome, glazing and gated entries closed with3Dframing. Upperfrontstonebalustrade pierced at nearlevels, simplified distant silhouette. Separate neighboringNottinghamPlayhouse/missionhouse/cathedral and all interiors/streetfixtures/people/landscape excluded.',
    'Independent original source terrain retained, fixed westfront pavement chosen before geometry. No terrain flattening/fitting or replacement footprint, street/threshold slope/host attachment remains approximate preview. Flat review stageY-.7shows architecture, not a surveyed certified sidewalk/contact surface.',
  ],
};
