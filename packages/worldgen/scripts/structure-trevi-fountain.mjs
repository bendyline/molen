/** Trevi: researched fountain/facade, actual basin plan and interpreted sculptural silhouettes. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { treviHorseAnatomy, treviHumanAnatomy } from './trevi-sculpture-anatomy.mjs';

const directory = new URL(
  '../../../content/worldgen/source/places/sr/sr2/trevi_fountain/',
  import.meta.url,
);
const read = (n) => JSON.parse(fs.readFileSync(new URL(n, directory)));
const frame = read('map-frame.json'),
  opening = read('ground-opening.json');
const ref = 'palette:#ffffff',
  W = frame.controls.facadeWidthMeters / 2;
const cream = rgb('d6cdb7'),
  pale = rgb('dfd8c5'),
  marble = rgb('e0dbce');
const rock = rgb('c7baa0'),
  green = rgb('6f8176');
const water = rgb('508b89'),
  foam = rgb('c8d8cb');
const tint = (c, t) => c.map((v) => Math.min(1, v * t));
function tri(o, s, p, c, desired) {
  p = p.map((q) => q.map(Math.fround));
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.5) return;
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
  if (desired && n.reduce((a, v, i) => a + v * desired[i], 0) < 0) {
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
  const axes = Math.abs(n[1]) > 0.7 ? [0, 2] : [0, 1],
    all = [...p, ...holes.flat()],
    starts = [];
  let off = p.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(
    all.flatMap((q) => axes.map((k) => q[k])),
    starts,
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
function prism(o, s, ring, lo, hi, c) {
  for (const [y, n] of [
    [lo, [0, -1, 0]],
    [hi, [0, 1, 0]],
  ])
    polygon(
      o,
      s,
      ring.map(([x, z]) => [x, y, z]),
      c,
      n,
    );
  const area = ring.reduce((a, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return a + p[0] * q[1] - q[0] * p[1];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1];
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
      area > 0 ? [dz, 0, -dx] : [-dz, 0, dx],
    );
  }
}
function strip(o, s, a, b, w, c) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 1e-5) return;
  const dx = ((b[1] - a[1]) * w) / len / 2,
    dy = (-(b[0] - a[0]) * w) / len / 2;
  quad(
    o,
    s,
    [
      [a[0] + dx, a[1] + dy, a[2]],
      [b[0] + dx, b[1] + dy, b[2]],
      [b[0] - dx, b[1] - dy, b[2]],
      [a[0] - dx, a[1] - dy, a[2]],
    ],
    c,
    [0, 0, 1],
  );
}
function rings(o, s, rows, c, cap = true) {
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < rows[j].length; i++) {
      const k = (i + 1) % rows[j].length;
      const p = [rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]];
      quad(o, s, p, c);
    }
  if (cap)
    for (const [r, reverse] of [
      [rows[0], true],
      [rows.at(-1), false],
    ]) {
      const p = reverse ? [...r].reverse() : r;
      const center = p.reduce((a, v) => a.map((x, i) => x + v[i] / p.length), [0, 0, 0]);
      for (let i = 0; i < p.length; i++) tri(o, s, [center, p[i], p[(i + 1) % p.length]], c);
    }
}
function cyl(o, s, x, y, z, layers, c, n = 12) {
  if (n === 4 && layers.length > 4) layers = [layers[0], layers[2], layers.at(-2), layers.at(-1)];
  rings(
    o,
    s,
    layers.map(([h, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-2 * Math.PI * i) / n;
        return [x + r * Math.cos(a), y + h, z + r * Math.sin(a)];
      }),
    ),
    c,
  );
}
function ellipsoid(o, s, p, r, c, n = 10, lat = 6) {
  const q = (j, i) => {
    const t = -Math.PI / 2 + (Math.PI * j) / lat,
      a = (-2 * Math.PI * i) / n;
    return [
      p[0] + r[0] * Math.cos(t) * Math.cos(a),
      p[1] + r[1] * Math.sin(t),
      p[2] + r[2] * Math.cos(t) * Math.sin(a),
    ];
  };
  const rows = Array.from({ length: lat - 1 }, (_, j) =>
    Array.from({ length: n }, (_, i) => q(j + 1, i)),
  );
  rings(o, s, rows, c, false);
  for (let i = 0; i < n; i++) {
    tri(o, s, [[p[0], p[1] - r[1], p[2]], q(1, i + 1), q(1, i)], c);
    tri(o, s, [[p[0], p[1] + r[1], p[2]], q(lat - 1, i), q(lat - 1, i + 1)], c);
  }
}
function limb(o, s, a, b, ra, rb, c, n = 6) {
  const v = b.map((x, i) => x - a[i]),
    len = Math.hypot(...v);
  if (len < 0.001) return;
  const axis = v.map((x) => x / len);
  let u = Math.abs(axis[1]) < 0.95 ? [axis[2], 0, -axis[0]] : [1, 0, 0];
  const l = Math.hypot(...u);
  u = u.map((x) => x / l);
  const w = [
    axis[1] * u[2] - axis[2] * u[1],
    axis[2] * u[0] - axis[0] * u[2],
    axis[0] * u[1] - axis[1] * u[0],
  ];
  rings(
    o,
    s,
    [
      [a, ra],
      [b, rb],
    ].map(([p, r]) =>
      Array.from({ length: n }, (_, i) => {
        const t = (-2 * Math.PI * i) / n;
        return p.map((x, k) => x + r * (u[k] * Math.cos(t) + w[k] * Math.sin(t)));
      }),
    ),
    c,
  );
}
function transformed(o, x, y, z, scale = 1, mirror = 1, yaw = 0) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    point = ([a, b, d]) => [
      x + scale * (c * a * mirror + s * d),
      y + b * scale,
      z + scale * (-s * a * mirror + c * d),
    ];
  return {
    addTriangle(slot, ref, ps, _normal, uv, color) {
      let p = ps.map(point);
      if (mirror < 0) p = [p[0], p[2], p[1]];
      o.addTriangle(slot, ref, p, normalFor(...p), uv, color);
    },
  };
}
function curve(o, s, points, r, c, n) {
  for (let i = 1; i < points.length; i++) limb(o, s, points[i - 1], points[i], r, r, c, n);
}
function arch(cx, y, w, h, n) {
  return [
    [cx - w, y],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = Math.PI - (Math.PI * i) / n;
      return [cx + w * Math.cos(a), y + h - w + w * Math.sin(a)];
    }),
    [cx + w, y],
  ];
}
function archTrim(o, cx, y, w, h, z, d) {
  const p = arch(cx, y, w, h, d === 0 ? 5 : d === 1 ? 8 : 16);
  for (let i = 1; i < p.length; i++)
    strip(o, 'trim', [...p[i - 1], z], [...p[i], z], d === 0 ? 0.25 : 0.17, pale);
}
const noClose = (ring) =>
  Math.hypot(ring[0][0] - ring.at(-1)[0], ring[0][1] - ring.at(-1)[1]) < 1e-5
    ? ring.slice(0, -1)
    : ring;
const site = noClose(frame.geometry.outline),
  basin = noClose(frame.geometry.waterOutline);
function simplify(r, t) {
  let p = r.slice();
  for (let pass = 0; pass < 3; pass++)
    p = p.filter((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        len === 0 ||
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / len > t
      );
    });
  return p;
}
function basinAndSteps(o, d) {
  const waterRing = d === 0 ? simplify(basin, 0.42) : basin;
  prism(o, 'trim', site, -3.25, -1.55, tint(cream, 0.84));
  if (d === 0)
    polygon(
      o,
      'water',
      waterRing.map(([x, z]) => [x, -1.49, z]),
      water,
    );
  else prism(o, 'water', waterRing, -1.56, -1.49, water);
  // The actual water polygon has rocky bays; keep a low thick coping following its front/side edge.
  if (d > 0)
    for (let i = 0; i < basin.length; i++) {
      const a = basin[i],
        b = basin[(i + 1) % basin.length];
      if ((a[1] + b[1]) / 2 < 12) continue;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz);
      if (len < 0.02) continue;
      const nx = (-dz / len) * 0.15,
        nz = (dx / len) * 0.15;
      prism(
        o,
        'trim',
        [
          [a[0] + nx, a[1] + nz],
          [a[0] - nx, a[1] - nz],
          [b[0] - nx, b[1] - nz],
          [b[0] + nx, b[1] + nz],
        ],
        -1.55,
        -1.1,
        pale,
      );
    }
  const steps = d === 0 ? 1 : d === 1 ? 3 : 9;
  for (let i = 0; i < site.length; i++) {
    if (i === 12) continue;
    const a = site[i],
      b = site[(i + 1) % site.length];
    const inward = (p, t) => {
      const dx = 1.5 - p[0],
        dz = 12 - p[1],
        len = Math.hypot(dx, dz);
      return [p[0] + (dx / len) * t, p[1] + (dz / len) * t];
    };
    for (let k = 0; k < steps; k++) {
      const lo = (3.1 * k) / steps,
        hi = (3.1 * (k + 1)) / steps,
        h = 0.2 - (1.62 * k) / steps,
        aa = inward(a, lo),
        bb = inward(b, lo),
        cc = inward(b, hi),
        dd = inward(a, hi);
      polygon(
        o,
        'trim',
        [aa, bb, cc, dd].map(([x, z]) => [x, h, z]),
        tint(cream, 0.92),
      );
      quad(
        o,
        'trim',
        [
          [cc[0], h, cc[1]],
          [dd[0], h, dd[1]],
          [dd[0], h - 1.62 / steps, dd[1]],
          [cc[0], h - 1.62 / steps, cc[1]],
        ],
        cream,
      );
    }
  }
}
function giantColumn(o, x, d) {
  const n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 20;
  cyl(
    o,
    'trim',
    x,
    2.6,
    0.85,
    d === 1
      ? [
          [0, 0.97],
          [0.8, 0.8],
          [13.0, 0.66],
          [13.9, 0.9],
        ]
      : [
          [0, 0.97],
          [0.35, 0.97],
          [0.45, 0.83],
          [0.8, 0.8],
          [12.7, 0.66],
          [13.0, 0.92],
          [13.6, 1.02],
          [13.9, 0.9],
        ],
    pale,
    n,
  );
  if (d > 1)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const p = [x + 0.85 * Math.cos(a), 15.8, 0.85 + 0.85 * Math.sin(a)];
      if (d === 2)
        tri(
          o,
          'trim',
          [
            [p[0] - 0.15, p[1] - 0.25, p[2]],
            [p[0] + 0.15, p[1] - 0.25, p[2]],
            [p[0], p[1] + 0.35, p[2] + 0.12],
          ],
          pale,
        );
      else ellipsoid(o, 'trim', p, [0.19, 0.34, 0.19], pale, 6, 4);
    }
  B(o, 'trim', x, 16.5, 0.9, 2.28, 0.28, 2.2, pale);
}
function deepNiches(o, d) {
  const main = arch(0, 2.8, 3.9, 13.2, d === 0 ? 5 : d === 1 ? 8 : 20).map(([x, y]) => [x, y, 0]);
  const holes = [
    main,
    ...[-7.45, 7.45].map((x) => [
      [x - 1.4, 3.3, 0],
      [x + 1.4, 3.3, 0],
      [x + 1.4, 9.1, 0],
      [x - 1.4, 9.1, 0],
    ]),
  ];
  polygon(
    o,
    'facade',
    [
      [-11.2, 2.6, 0],
      [11.2, 2.6, 0],
      [11.2, 17.1, 0],
      [-11.2, 17.1, 0],
    ],
    cream,
    [0, 0, 1],
    holes,
  );
  B(o, 'facade', 0, 2.6, -4.05, 22.4, 15.1, 0.3, cream);
  // A true cylindrical niche and hemispherical conch, open toward+Z.
  const n = d === 0 ? 5 : d === 1 ? 6 : d === 2 ? 10 : 28,
    lat = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 8,
    r = 3.74,
    cy = 12.06;
  const q = (a, t = 0) => [
    r * Math.cos(t) * Math.cos(a),
    cy + r * Math.sin(t),
    0.04 - r * Math.cos(t) * Math.sin(a),
  ];
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    quad(
      o,
      'trim',
      [
        [r * Math.cos(a), 2.8, 0.04 - r * Math.sin(a)],
        [r * Math.cos(b), 2.8, 0.04 - r * Math.sin(b)],
        q(b),
        q(a),
      ],
      tint(cream, 0.85),
      [-Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    for (let j = 0; j < lat; j++) {
      const t = (j * Math.PI) / 2 / lat,
        u = ((j + 1) * Math.PI) / 2 / lat;
      quad(o, 'trim', [q(a, t), q(b, t), q(b, u), q(a, u)], tint(cream, 0.89 + (j % 2) * 0.025), [
        -Math.cos((a + b) / 2),
        -1,
        Math.sin((a + b) / 2),
      ]);
    }
  }
  // Continuous narrow raised coffer bands; closed tube end caps caused dark dotted seams.
  const rib = (a, t) =>
    q(a, t).map((v, i) => {
      const center = i === 1 ? cy : i === 2 ? 0.04 : 0;
      return center + (v - center) * 0.97;
    });
  if (d > 1) {
    const horizontal = d === 2 ? 2 : 5,
      vertical = d === 2 ? 6 : 12,
      rows = d === 2 ? 4 : 8;
    for (let j = 1; j <= horizontal; j++) {
      const t = (j * Math.PI) / 14;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI) / n,
          b = ((i + 1) * Math.PI) / n,
          mid = (a + b) / 2;
        quad(
          o,
          'trim',
          [rib(a, t - 0.012), rib(b, t - 0.012), rib(b, t + 0.012), rib(a, t + 0.012)],
          pale,
          [-Math.cos(mid), -Math.sin(t), Math.sin(mid)],
        );
      }
    }
    for (let i = 0; i <= vertical; i++) {
      const a = (i * Math.PI) / vertical;
      for (let j = 0; j < rows; j++) {
        const t = (j * Math.PI) / 2 / rows,
          u = ((j + 1) * Math.PI) / 2 / rows;
        quad(
          o,
          'trim',
          [rib(a - 0.01, t), rib(a + 0.01, t), rib(a + 0.01, u), rib(a - 0.01, u)],
          pale,
          [-Math.cos(a), -Math.sin((t + u) / 2), Math.sin(a)],
        );
      }
    }
  }
  archTrim(o, 0, 2.8, 4.08, 13.5, 0.12, d);
  for (const x of [-7.45, 7.45]) {
    B(o, 'facade', x, 3.3, -1.65, 2.8, 5.8, 0.16, tint(cream, 0.72));
    for (const side of [-1, 1]) B(o, 'trim', x + side * 1.47, 3.3, -0.8, 0.16, 5.8, 1.7, cream);
    B(o, 'trim', x, 9.1, -0.8, 3.1, 0.18, 1.7, pale);
    B(o, 'trim', x, 3.12, -0.8, 3.1, 0.18, 1.7, pale);
  }
  const small = d === 0 ? [-2.8, 2.8] : [-2.85, -2.25, 2.25, 2.85];
  for (const x of small)
    cyl(
      o,
      'trim',
      x,
      3.2,
      Math.abs(x) > 2.5 ? 0.45 : -1.5,
      d === 1
        ? [
            [0, 0.36],
            [0.4, 0.28],
            [7.4, 0.24],
            [7.9, 0.43],
          ]
        : [
            [0, 0.36],
            [0.22, 0.36],
            [0.4, 0.28],
            [7.4, 0.24],
            [7.6, 0.43],
            [7.9, 0.43],
          ],
      pale,
      d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12,
    );
  if (d > 1)
    for (const x of small) {
      const z = Math.abs(x) > 2.5 ? 0.45 : -1.5;
      B(o, 'trim', x, 11.05, z - 0.42, 0.88, 0.18, 1.1, pale);
    }
  const curveN = d === 0 ? 4 : d === 1 ? 8 : 18;
  for (let i = 0; i < curveN; i++) {
    const a = (i * Math.PI) / curveN,
      b = ((i + 1) * Math.PI) / curveN,
      pt = (u, y, r) => [(2.85 / 3.13) * r * Math.cos(u), y, 0.45 - r * Math.sin(u)];
    quad(
      o,
      'trim',
      [pt(a, 11.1, 3.13), pt(b, 11.1, 3.13), pt(b, 11.45, 3.13), pt(a, 11.45, 3.13)],
      pale,
    );
    quad(
      o,
      'trim',
      [pt(a, 11.45, 3.13), pt(b, 11.45, 3.13), pt(b, 11.45, 2.78), pt(a, 11.45, 2.78)],
      pale,
    );
    quad(
      o,
      'trim',
      [pt(a, 11.1, 2.78), pt(b, 11.1, 2.78), pt(b, 11.45, 2.78), pt(a, 11.45, 2.78)],
      pale,
      [-Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
    quad(
      o,
      'trim',
      [pt(a, 11.1, 3.13), pt(b, 11.1, 3.13), pt(b, 11.1, 2.78), pt(a, 11.1, 2.78)],
      pale,
      [0, -1, 0],
    );
    if (i === 0 || i === curveN - 1) {
      const u = i === 0 ? a : b;
      quad(
        o,
        'trim',
        [pt(u, 11.1, 3.13), pt(u, 11.45, 3.13), pt(u, 11.45, 2.78), pt(u, 11.1, 2.78)],
        pale,
        [0, 0, 1],
      );
    }
  }
}
function windowBay(o, x, d) {
  for (const [y, h] of [
    [3.9, 3.6],
    [11.35, 3.7],
    [18.15, 0.9],
  ]) {
    const w = y > 18 ? 1.0 : 1.65;
    quad(
      o,
      'shutter',
      [
        [x - w / 2, y, 0.095],
        [x + w / 2, y, 0.095],
        [x + w / 2, y + h, 0.095],
        [x - w / 2, y + h, 0.095],
      ],
      green,
      [0, 0, 1],
    );
    if (d === 0) continue;
    if (d === 1) {
      for (const xx of [x - w / 2 - 0.12, x + w / 2 + 0.12])
        strip(o, 'trim', [xx, y - 0.1, 0.25], [xx, y + h + 0.1, 0.25], 0.18, pale);
      for (const yy of [y - 0.1, y + h + 0.1])
        strip(o, 'trim', [x - w / 2 - 0.2, yy, 0.25], [x + w / 2 + 0.2, yy, 0.25], 0.18, pale);
      if (y < 18) {
        B(o, 'trim', x, y - 0.5, 0.45, 2.35, 0.16, 0.8, pale);
        polygon(
          o,
          'trim',
          [
            [x - 1.2, y + h + 0.2, 0.3],
            [x + 1.2, y + h + 0.2, 0.3],
            [x, y + h + 0.9, 0.3],
          ],
          pale,
          [0, 0, 1],
        );
      }
      continue;
    }
    for (const dx of [-w / 2 - 0.12, w / 2 + 0.12])
      B(o, 'trim', x + dx, y - 0.15, 0.12, 0.17, h + 0.3, 0.24, pale);
    for (const yy of [y - 0.17, y + h + 0.03])
      B(o, 'trim', x, yy, 0.15, w + 0.48, 0.16, 0.38, pale);
    B(o, 'trim', x, y + 0.08, 0.12, 0.07, h - 0.1, 0.2, pale);
    if (y < 18) {
      B(o, 'trim', x, y + h * 0.52, 0.12, w, 0.08, 0.2, pale);
      B(o, 'trim', x, y - 0.68, 0.45, 2.35, 0.18, 0.8, pale);
      if (d === 2) {
        for (const dx of [-0.55, 0.55]) B(o, 'trim', x + dx, y - 0.5, 0.73, 0.09, 0.4, 0.11, pale);
      } else if (d === 3)
        for (let i = -2; i <= 2; i++)
          cyl(
            o,
            'trim',
            x + i * 0.34,
            y - 0.5,
            0.73,
            [
              [0, 0.07],
              [0.12, 0.09],
              [0.3, 0.045],
              [0.4, 0.07],
            ],
            pale,
            4,
          );
      if (y < 10) {
        polygon(
          o,
          'trim',
          [
            [x - 1.3, y + h + 0.18, 0.32],
            [x + 1.3, y + h + 0.18, 0.32],
            [x, y + h + 0.97, 0.32],
          ],
          cream,
          [0, 0, 1],
        );
        for (const a of [-1, 1])
          strip(o, 'trim', [x + a * 1.35, y + h + 0.18, 0.38], [x, y + h + 1.05, 0.38], 0.15, pale);
      } else {
        const n = d === 1 ? 5 : 12;
        for (let i = 0; i < n; i++) {
          const a = (Math.PI * i) / n,
            b = (Math.PI * (i + 1)) / n;
          strip(
            o,
            'trim',
            [x + 1.25 * Math.cos(a), y + h + 0.13 + 0.55 * Math.sin(a), 0.36],
            [x + 1.25 * Math.cos(b), y + h + 0.13 + 0.55 * Math.sin(b), 0.36],
            0.16,
            pale,
          );
        }
      }
    }
    if (d === 3)
      for (let k = 1; k < 8; k++)
        B(o, 'shutter', x, y + (h * k) / 8, 0.115, w, 0.035, 0.06, tint(green, 0.86));
  }
}
function facade(o, d) {
  B(o, 'trim', 0, -3.25, -1.95, 2 * W, 5.85, 4.5, cream);
  for (const side of [-1, 1]) {
    B(o, 'facade', (side * (W + 11.2)) / 2, 2.6, -2.1, W - 11.2, 17.2, 4.2, cream);
    for (const x of [13.25, 17.55, 21.9]) windowBay(o, side * x, d);
    for (const x of d === 0 ? [] : [11.35, 15.2, 19.55, 24.25]) {
      B(o, 'trim', side * x, 3.0, 0.12, 0.68, 13.35, 0.35, pale);
      if (d > 1) B(o, 'trim', side * x, 16.15, 0.15, 1.2, 0.55, 0.5, pale);
    }
  }
  deepNiches(o, d);
  for (const x of [-10.45, -4.6, 4.6, 10.45]) giantColumn(o, x, d);
  for (const [y, h, depth, extra] of [
    [2.65, 0.18, 0.45, 0],
    [9.8, 0.18, 0.24, 0],
    [16.8, 0.35, 0.65, 0.2],
    [17.15, 0.28, 1.02, 0.45],
    [17.43, 0.22, 1.25, 0.7],
    [19.55, 0.25, 0.7, 0.4],
  ].filter((_, i) => (d === 0 ? [0, 2, 5].includes(i) : d === 1 ? [0, 2, 4, 5].includes(i) : true)))
    B(o, 'trim', 0, y, -0.2, 2 * W + extra, h, depth, pale);
  B(o, 'facade', 0, 17.7, -1.8, 23.2, 4.6, 3.6, cream);
  for (const [y, h, w, z] of [
    [17.7, 0.3, 24.1, 0.45],
    [18.0, 0.24, 24.7, 0.62],
    [22.1, 0.25, 23.7, 0.4],
    [22.35, 0.22, 24.2, 0.62],
  ].filter((_, i) => d !== 1 || [0, 3].includes(i)))
    B(o, 'trim', 0, y, z / 2, w, h, z + 0.35, pale);
  if (d > 0) {
    for (const side of [-1, 1]) {
      B(o, 'trim', side * 7.5, 23.05, -0.65, 8, 0.15, 0.5, pale);
      for (let i = 0; i < (d === 1 ? 4 : 10); i++)
        cyl(
          o,
          'trim',
          side * (3.9 + (i * 7.3) / (d === 1 ? 3 : 9)),
          22.5,
          -0.65,
          [
            [0, 0.12],
            [0.15, 0.16],
            [0.4, 0.08],
            [0.55, 0.13],
          ],
          pale,
          4,
        );
    }
  }
  // Central blank inscription panel and framed side reliefs; no fabricated lettering.
  if (d > 0) {
    B(o, 'trim', 0, 18.6, 0.18, 9.6, 2.75, 0.24, pale);
    for (const x of [-8.7, 8.7]) B(o, 'trim', x, 19, 0.18, 4.6, 2.3, 0.24, pale);
    for (const x of [-7.45, 7.45]) {
      B(o, 'trim', x, 12.0, 0.12, 3.2, 3.8, 0.2, pale);
      B(o, 'facade', x, 12.18, 0.24, 2.82, 3.43, 0.08, tint(cream, 0.85));
    }
  }
  if (d > 1)
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const x = side * 7.45 + (k - 1) * 0.7,
          y = 12.4 + (k === 1 ? 0.3 : 0);
        polygon(
          o,
          'sculpture',
          [
            [x - 0.28, y, 0.32],
            [x + 0.28, y, 0.32],
            [x + 0.16, y + 1.4, 0.32],
            [x - 0.16, y + 1.4, 0.32],
          ],
          marble,
          [0, 0, 1],
        );
        ellipsoid(o, 'sculpture', [x, y + 1.65, 0.36], [0.18, 0.24, 0.07], marble, 6, 3);
        strip(o, 'sculpture', [x, y + 1.1, 0.35], [x + side * 0.45, y + 1.35, 0.35], 0.13, marble);
      }
  if (d > 1) {
    for (let i = -24; i <= 24; i++) B(o, 'trim', i, 16.68, 0.35, 0.18, 0.19, 0.3, pale);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++)
        B(o, 'trim', side * (12 + i * 2.1), 18.25, 0.08, 1.3, 0.14, 0.15, pale);
  }
}
function figure(
  o,
  d,
  { x = 0, y = 0, z = 0, scale = 1, mirror = 1, pose = 'stand', yaw = 0 } = {},
) {
  const q = transformed(o, x, y, z, scale, mirror, yaw),
    n = d < 2 ? 5 : d === 2 ? 5 : 14;
  if (d < 2) {
    const outline =
      pose === 'triton'
        ? [
            [-0.8, 0],
            [-0.65, 0.8],
            [-0.3, 1.5],
            [-0.35, 2.2],
            [-1.45, 3.1],
            [-1.5, 3.3],
            [-0.4, 2.75],
            [0.15, 2.75],
            [0.2, 3.4],
            [0.5, 3.6],
            [0.85, 3.5],
            [1, 3.1],
            [0.8, 2.7],
            [1.25, 2.1],
            [1.8, 1.8],
            [1.65, 1.6],
            [1.1, 1.9],
            [0.8, 2],
            [0.55, 1.4],
            [1.3, 0.2],
            [1.2, 0],
          ]
        : [
            [-0.65, 0],
            [-0.7, 0.7],
            [-0.4, 1.8],
            [-0.65, 2.2],
            [-1, 2.6],
            [-0.72, 3.25],
            [-0.25, 3.5],
            [-0.2, 3.8],
            [-0.25, 4.1],
            [0, 4.3],
            [0.35, 4.23],
            [0.45, 3.9],
            [0.3, 3.5],
            [0.7, 3.25],
            [1, 2.6],
            [0.65, 2.1],
            [0.45, 1.75],
            [0.75, 0.5],
            [0.8, 0],
          ];
    if (d === 0) {
      outline.splice(
        0,
        outline.length,
        [-0.6, 0],
        [-0.5, 1.7],
        [-0.9, 2.6],
        [-0.55, 3.35],
        [-0.2, 3.55],
        [-0.25, 4.1],
        [0.1, 4.3],
        [0.4, 4.05],
        [0.3, 3.5],
        [0.7, 3.2],
        [0.8, 2.5],
        [0.4, 1.8],
        [0.75, 0],
      );
    }
    if (d === 1) {
      const simple = simplify(outline, 0.11);
      outline.splice(0, outline.length, ...simple);
    }
    const depth = d === 0 ? 0.3 : 0.42;
    for (const [z, n] of [
      [-depth, [0, 0, -1]],
      [depth, [0, 0, 1]],
    ])
      polygon(
        q,
        'sculpture',
        outline.map(([x, y]) => [x, y, z]),
        marble,
        n,
      );
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length];
      quad(
        q,
        'sculpture',
        [
          [a[0], a[1], -depth],
          [b[0], b[1], -depth],
          [b[0], b[1], depth],
          [a[0], a[1], depth],
        ],
        marble,
      );
    }
    return;
  }
  const crouch = ['triton', 'angel', 'angel-horn'].includes(pose),
    ocean = pose === 'ocean';
  const anatomy = treviHumanAnatomy(q, d, pose, marble, tri),
    head = anatomy.head;
  if (!crouch) {
    const rows = [0, 0.45, 1.1, 1.85, 2.35].map((h, j) =>
      Array.from({ length: n }, (_, i) => {
        const a = (-2 * Math.PI * i) / n,
          r =
            [0.66, 0.62, 0.54, 0.51, 0.43][j] *
            (1 + 0.13 * Math.sin(a * 5 + j * 0.7)) *
            (ocean
              ? 1 - 0.65 * Math.max(0, Math.cos(a)) * Math.max(0, Math.sin(a)) * (1 - h / 2.35)
              : 1);
        return [
          -(ocean ? 0.48 : 0.15) * (1 - h / 2.35) + r * Math.cos(a),
          h + (ocean ? (0.18 * Math.cos(a) * h) / 2.35 : 0),
          0.06 + r * 0.6 * Math.sin(a),
        ];
      }),
    );
    rings(q, 'sculpture', rows, marble);
    if (!ocean) {
      polygon(
        q,
        'sculpture',
        [
          [-0.52, 3.45, 0.25],
          [0.4, 2.4, 0.44],
          [0.58, 1.7, 0.42],
          [-0.5, 2.6, 0.4],
        ],
        marble,
        [0, 0, 1],
      );
    }
  }
  const hw = anatomy.headWidth;
  ellipsoid(
    q,
    'sculpture',
    [head[0], head[1] - 0.05, head[2] + hw * 0.46],
    [hw * 0.1, hw * 0.12, hw * 0.16],
    marble,
    d === 3 ? 8 : 5,
    4,
  );
  if (ocean || pose === 'triton')
    ellipsoid(
      q,
      'sculpture',
      [head[0], head[1] - 0.22, head[2] + hw * 0.3],
      [hw * 0.27, 0.24, hw * 0.24],
      tint(marble, 0.97),
      d === 3 ? 10 : 5,
      4,
    );
  if (d === 3) {
    for (const side of ['l', 'r'])
      for (const name of ['upperArm', 'foreArm']) {
        const p = anatomy.joints[`${name}.${side}`];
        if (p)
          ellipsoid(
            q,
            'sculpture',
            p,
            name === 'upperArm' ? [0.2, 0.22, 0.2] : [0.14, 0.15, 0.14],
            marble,
            8,
            5,
          );
      }
    if (ocean || pose === 'triton') {
      const chest = anatomy.joints.chest;
      for (const side of [-1, 1])
        ellipsoid(
          q,
          'sculpture',
          [chest[0] + side * 0.23, chest[1] + 0.45, chest[2] + 0.18],
          [0.29, 0.19, 0.16],
          marble,
          10,
          5,
        );
      for (let j = 0; j < 3; j++)
        for (const side of [-1, 1])
          ellipsoid(
            q,
            'sculpture',
            [side * 0.11, chest[1] + 0.18 - j * 0.14, 0.22],
            [0.14, 0.1, 0.07],
            marble,
            8,
            4,
          );
    }
    for (let i = 0; i < 9; i++) {
      const a = (i * Math.PI) / 4.5;
      ellipsoid(
        q,
        'sculpture',
        [head[0] + Math.cos(a) * hw * 0.36, head[1] + hw * 0.36, head[2] + Math.sin(a) * hw * 0.32],
        [hw * 0.17, hw * 0.16, hw * 0.16],
        marble,
        6,
        4,
      );
    }
    if (ocean)
      ellipsoid(
        q,
        'sculpture',
        [head[0], head[1] - 0.25, head[2] + hw * 0.37],
        [hw * 0.29, 0.25, hw * 0.24],
        marble,
        10,
        6,
      );
  }
  if (pose.startsWith('angel')) {
    // Folded seated garment follows the raised thighs, leaving the lower legs visible.
    const rows = [
      [0, 1.85, 0, 0.5, 0.4],
      [0, 1.35, 0.3, 0.66, 0.6],
      [0.1, 0.85, 0.55, 0.72, 0.62],
    ].map(([x, y, z, rx, rz]) =>
      Array.from({ length: d === 3 ? 12 : 6 }, (_, i) => {
        const a = (-2 * Math.PI * i) / (d === 3 ? 12 : 6),
          f = 1 + 0.1 * Math.cos(a * 5);
        return [x + rx * f * Math.cos(a), y, z + rz * f * Math.sin(a)];
      }),
    );
    rings(q, 'sculpture', rows.reverse(), marble);
    const wing = [
      [0.5, 3.1, -0.12],
      [1.25, 3.8, -0.25],
      [2.0, 3.9, -0.28],
      [2.9, 3.65, -0.2],
      [3.4, 3.55, -0.12],
      [2.7, 3.05, -0.02],
      [1.7, 2.8, 0.05],
      [0.55, 2.9, 0.12],
    ];
    for (const p of wing) p[1] -= 0.7;
    polygon(q, 'sculpture', wing, marble, [0, 0, 1]);
    const back = wing.map(([x, y, z]) => [x, y, z - 0.15]);
    polygon(q, 'sculpture', back, marble, [0, 0, -1]);
    for (let i = 0; i < wing.length; i++)
      quad(
        q,
        'sculpture',
        [wing[i], back[i], back[(i + 1) % wing.length], wing[(i + 1) % wing.length]],
        marble,
      );
    if (d === 3)
      for (let i = 0; i < 6; i++)
        curve(
          q,
          'sculpture',
          [
            [0.8, 2.45, 0.03],
            [1.5 + i * 0.15, 2.8, 0.04],
            [2.2 + i * 0.17, 2.45 + i * 0.055, 0.08],
          ],
          0.035,
          marble,
          4,
        );
    const mouth = [head[0] + 0.1, head[1] - 0.1, head[2] + hw * 0.43],
      tip = pose === 'angel-horn' ? [1.65, 2.5, 0.85] : [-0.75, 4.4, 0.65];
    limb(q, 'sculpture', mouth, tip, 0.035, 0.045, marble, 6);
    const flared = tip.map((v, i) => v + (tip[i] - mouth[i]) * 0.15);
    limb(q, 'sculpture', tip, flared, 0.045, 0.15, marble, 6);
  }
  if (pose === 'health')
    limb(q, 'sculpture', [0.95, 0.6, 0.4], [0.95, 3.9, 0.4], 0.035, 0.035, marble, 4);
  if (pose === 'abundance')
    ellipsoid(q, 'sculpture', [-0.28, 2.4, 0.5], [0.24, 0.14, 0.2], marble, d === 3 ? 10 : 5, 4);
}

function horse(o, d, x, mirror) {
  const q = transformed(o, x, 0.1, 5.7, d < 2 ? 1.14 : 1.4, mirror, mirror * 0.13);
  if (d === 1) {
    const shape = [
      [-0.6, 0],
      [-0.8, 1.6],
      [-0.7, 2.5],
      [-0.6, 3.3],
      [-0.55, 3.8],
      [-0.3, 4.0],
      [-0.15, 3.65],
      [0.2, 3.4],
      [0.75, 3.3],
      [0.95, 3.05],
      [0.8, 2.8],
      [0.15, 2.8],
      [0.1, 2.2],
      [0.55, 1.7],
      [1.15, 2.05],
      [1.35, 1.9],
      [0.65, 1.25],
      [0.3, 1.35],
      [0.35, 0.7],
      [1.4, 0.2],
      [1.8, 0.45],
      [1.5, 0.7],
      [1.9, 0.8],
      [2.2, 0.35],
      [1.7, -0.1],
      [0.4, 0.15],
    ];
    const simple = simplify(shape, 0.09);
    shape.splice(0, shape.length, ...simple);
    for (const [z, n] of [
      [-0.4, [0, 0, -1]],
      [0.4, [0, 0, 1]],
    ])
      polygon(
        q,
        'sculpture',
        shape.map(([x, y]) => [x, y, z]),
        marble,
        n,
      );
    for (let i = 0; i < shape.length; i++) {
      const a = shape[i],
        b = shape[(i + 1) % shape.length];
      quad(
        q,
        'sculpture',
        [
          [a[0], a[1], -0.4],
          [b[0], b[1], -0.4],
          [b[0], b[1], 0.4],
          [a[0], a[1], 0.4],
        ],
        marble,
      );
    }
    return;
  }
  // Complete horse anatomy replaces the previous disconnected head/limb proxy.
  treviHorseAnatomy(q, d, mirror < 0, marble, tri);
  // The hippocamp has a curled marine tail rather than a normal horse tail.
  curve(
    q,
    'sculpture',
    [
      [0, 0.9, -0.7],
      [0.5, 0.55, -1.35],
      [1.3, 0.25, -1.3],
      [1.85, 0.5, -0.9],
      [1.75, 0.8, -0.45],
    ],
    0.19,
    marble,
    d === 3 ? 8 : 5,
  );
  polygon(
    q,
    'sculpture',
    [
      [1.75, 0.8, -0.45],
      [2.3, 1.25, -0.7],
      [2.5, 0.9, -0.4],
      [2.15, 0.5, -0.15],
    ],
    marble,
    [0, 0, 1],
  );
}
function crest(o, d) {
  const y = 22.6;
  const shield = [
    [-1.3, 2.75],
    [-1.7, 2.35],
    [-1.55, 1.5],
    [-1.2, 0.55],
    [-0.65, 0],
    [0, -0.35],
    [0.65, 0],
    [1.2, 0.55],
    [1.55, 1.5],
    [1.7, 2.35],
    [1.3, 2.75],
    [0.7, 2.5],
    [-0.7, 2.5],
  ].map(([x, h]) => [x, y + h, 0.3]);
  polygon(o, 'sculpture', shield, marble, [0, 0, 1]);
  if (d > 1) {
    polygon(
      o,
      'sculpture',
      shield.map(([x, y]) => [x, y, 0.02]),
      marble,
      [0, 0, -1],
    );
    for (let i = 0; i < shield.length; i++) {
      const a = shield[i],
        b = shield[(i + 1) % shield.length];
      quad(o, 'sculpture', [[a[0], a[1], 0.02], [b[0], b[1], 0.02], b, a], marble);
    }
  }

  if (d > 0) {
    for (let i = 0; i < shield.length; i++) {
      if (d === 1) strip(o, 'sculpture', shield[i], shield[(i + 1) % shield.length], 0.14, pale);
      else limb(o, 'sculpture', shield[i], shield[(i + 1) % shield.length], 0.14, 0.14, pale, 4);
    }
    for (const side of [-1, 1]) {
      curve(
        o,
        'sculpture',
        [
          [side * 1.5, y, 0.45],
          [side * 2.4, y + 0.5, 0.4],
          [side * 2.5, y + 1.4, 0.4],
          [side * 2, y + 2, 0.4],
          [side * 1.9, y + 2.5, 0.4],
        ],
        0.17,
        marble,
        6,
      );
      figure(o, d, {
        x: side * 3,
        y: y - 0.65,
        z: 0.3,
        scale: 0.64,
        mirror: side,
        pose: side < 0 ? 'angel-horn' : 'angel',
      });
    }
    for (const x of [-0.75, 0, 0.75])
      strip(
        o,
        'sculpture',
        [x - 0.5, y + 0.15, 0.32],
        [x + 0.7, y + 2.55, 0.32],
        0.08,
        tint(marble, 0.82),
      );
  }
  if (d > 1) B(o, 'sculpture', 0, y + 0.9, 0.36, 2.45, 0.16, 0.06, tint(marble, 0.92));
  cyl(
    o,
    'sculpture',
    0,
    25.35,
    0.2,
    [
      [0, 0.65],
      [0.2, 0.7],
      [0.35, 0.57],
      [0.55, 0.62],
      [0.7, 0.42],
      [0.85, 0.48],
      [0.95, 0.2],
    ],
    marble,
    d === 0 ? 4 : d === 1 ? 6 : 8,
  );
}
function sculpture(o, d) {
  const shellN = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 12 : 20;
  const shellRim = Array.from({ length: shellN + 1 }, (_, i) => {
    const a = (Math.PI * i) / shellN;
    return [2.1 * Math.cos(a), 2.8 + 0.65 * Math.sin(a), 2.1 + 1.5 * Math.sin(a)];
  });
  for (let i = 0; i < shellN; i++)
    tri(o, 'sculpture', [[0, 2.15, 3.5], shellRim[i], shellRim[i + 1]], marble, [0, 1, 1]);
  if (d > 1)
    for (let i = 0; i <= shellN; i += 2)
      limb(o, 'sculpture', [0, 2.17, 3.53], shellRim[i], 0.04, 0.04, pale, 4);

  figure(o, d, { x: 0, y: 3.05, z: 2.0, scale: 1.26, pose: 'ocean' });
  if (d > 0) {
    for (const x of [-7.45, 7.45])
      figure(o, d, {
        x,
        y: 3.25,
        z: -0.45,
        scale: 1.05,
        pose: x < 0 ? 'abundance' : 'health',
        mirror: 1,
      });
    for (const side of [-1, 1]) {
      horse(o, d, side * 4.8, side);
      figure(o, d, {
        x: side * 7.0,
        y: 0.35,
        z: 6.4,
        scale: 0.95,
        mirror: side,
        pose: 'triton',
        yaw: side * 0.3,
      });
    }
    for (const x of [-10.6, -4.9, 4.9, 10.6])
      figure(o, d, { x, y: 18.1, z: 0.55, scale: 0.72, mirror: x < 0 ? -1 : 1 });
  }
  crest(o, d);
}
function rockwork(o, d) {
  // Explicit ledge locations follow inspected views and the mapped rear-water scallops.
  const clusters = [
    [-19, 1.2, 2.1, 3.6, 2, 2],
    [-17, 0.1, 5, 2.6, 2.2, 3],
    [-15, -0.3, 8.3, 3.2, 1.4, 2.6],
    [-12, 0.1, 4.5, 3, 1.5, 3],
    [-9, 0.3, 7, 3.3, 1.4, 2.6],
    [-6, 0.45, 6.9, 3, 1.5, 2],
    [-2, 1.2, 4.9, 3, 1.3, 2.6],
    [2, 1.35, 4.6, 3, 1.25, 2.8],
    [7, 0.5, 6, 3, 1.5, 3],
    [10, -0.1, 7.4, 3.4, 1.3, 2.8],
    [13, -0.2, 7.5, 3.1, 1.5, 3],
    [17, 0.8, 4, 3.2, 2.4, 2.2],
    [19, 1.6, 1.5, 3.2, 2.4, 2],
    [-3, -0.6, 9.8, 4.2, 0.7, 2.2],
    [3, -0.5, 10, 4.1, 0.7, 2.2],
  ];
  const picks =
    d === 0
      ? clusters.filter((_, i) => [1, 7, 11].includes(i))
      : d === 1
        ? clusters.filter((_, i) => i % 3 !== 0)
        : clusters;
  for (let i = 0; i < picks.length; i++) {
    const [x, y, z, rx, ry, rz] = picks[i],
      n = d === 0 ? 4 : d === 1 ? 5 : d === 2 ? 7 : 11,
      levels = d === 3 ? 6 : d === 1 ? 2 : 3,
      rows = [];
    for (let j = 0; j < levels; j++) {
      const t = j / (levels - 1),
        r =
          levels === 6
            ? [0.78, 1, 1.02, 0.86, 0.87, 0.6][j]
            : j === 0
              ? 0.8
              : j === levels - 1
                ? 0.5
                : 1;
      rows.push(
        Array.from({ length: n }, (_, k) => {
          const a = (-2 * Math.PI * k) / n;
          const wobble = 1 + 0.13 * Math.sin(i * 7 + k * 2);
          return [
            x + rx * r * wobble * Math.cos(a),
            y + ry * (t * 2 - 1) + 0.12 * Math.cos(k * 3 + i),
            z + rz * r * wobble * Math.sin(a),
          ];
        }),
      );
    }
    rings(o, 'rock', rows, tint(rock, 0.86 + (i % 4) * 0.05));
  }
  const bowls = [
    [0, 0.55, 7.5, 3.4, 1.8],
    [0, -0.1, 9.6, 4.7, 2.1],
    [0, -0.65, 11.1, 6.3, 2.2],
  ];
  for (const [x, y, z, rx, rz] of d === 0 ? bowls.slice(-1) : bowls) {
    const n = d === 0 ? 5 : d === 1 ? 10 : d === 2 ? 20 : 32;
    const points = Array.from({ length: n + 1 }, (_, i) => {
      const a = (Math.PI * i) / n;
      return [x + rx * Math.cos(a), z + rz * Math.sin(a)];
    });
    const ring = [...points, [x - rx, z - 0.4], [x + rx, z - 0.4]];
    prism(o, 'rock', ring, y - 0.55, y, rock);
    polygon(
      o,
      'water',
      ring.map(([xx, zz]) => [xx, y + 0.025, zz]),
      tint(water, 1.25),
    );
    for (let i = 0; i < n; i++) {
      const a = points[i],
        b = points[i + 1],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        nx = dz / len,
        nz = -dx / len;
      const top = (p) => [p[0] + nx * 0.025, y + 0.035, p[1] + nz * 0.025];
      const bottom = (p) => [p[0] + nx * 0.18, y - 0.58, p[1] + nz * 0.18];
      quad(o, 'water', [top(a), top(b), bottom(b), bottom(a)], tint(water, 1.15 + (i % 3) * 0.08));
      if (d > 1) {
        const subdivisions = d === 3 ? 4 : 1;
        for (let j = 0; j < subdivisions; j++) {
          const t = (j + 0.25) / subdivisions,
            width = d === 3 ? 0.055 : 0.07,
            p = [a[0] + dx * t, a[1] + dz * t],
            r = [p[0] + (dx / len) * width, p[1] + (dz / len) * width];
          quad(
            o,
            'water',
            [top(p), top(r), bottom(r), bottom(p)].map((v) => [
              v[0] + nx * 0.018,
              v[1],
              v[2] + nz * 0.018,
            ]),
            tint(foam, 0.95 + (i % 2) * 0.05),
          );
        }
      }
    }
  }
  if (d > 1) {
    const n = d === 3 ? 22 : 10;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n;
      const x = 6.3 * Math.cos(a),
        z = 11.1 + 2.2 * Math.sin(a);
      quad(
        o,
        'water',
        [
          [x, -0.7, z],
          [x + 0.035, -0.7, z],
          [x + 0.06, -1.45, z + 0.28],
          [x, -1.45, z + 0.28],
        ],
        tint(foam, 0.86),
      );
    }
  }
}
export function treviFountain(o, _frame = frame, d = 3) {
  basinAndSteps(o, d);
  facade(o, d);
  rockwork(o, d);
  sculpture(o, d);
}
export const treviFountainSkyline = (o) => treviFountain(o, frame, 0);
export const treviFountainDistrict = (o) => treviFountain(o, frame, 1);
export const treviFountainStreet = (o) => treviFountain(o, frame, 2);
const surfaces = {
  facade: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_marble', roughness: 0.91, metallic: 0 },
  sculpture: { slot: 'trim', graph: 'stone_marble', roughness: 0.87, metallic: 0 },
  rock: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  shutter: { slot: 'window', localRef: 'palette:#fffefd', roughness: 0.82, metallic: 0 },
  water: { slot: 'foundation', localRef: ref, roughness: 0.27, metallic: 0.03 },
};
export const treviFountainModel = {
  id: 'trevi_fountain',
  key: 'trevi_fountain',
  recipe: 'structure-trevi-fountain.mjs',
  cell: 'sr/sr2',
  title: 'Trevi Fountain',
  brief:
    'Pale Palazzo Poli fountain facade with four giant Corinthian columns, actual deep conch niche and four small inner columns, flanking allegory niches, three pedimented shutter-window bays per wing, attic/balustrade and sculptural papal crest. Recognizable posed Oceanus/shell chariot, distinct sea horses/tritons and side/attic figures, rough stepped travertine rock and curved spill bowls; mapped turquoise basin with separate dry amphitheatre/stairs. Full rear palace and neighboring city excluded.',
  camera: [58, 32, 76],
  lookAt: [0, 10, 9],
  qaCameras: [
    { name: 'front', position: [0, 15, 68], lookAt: [0, 10, 1] },
    { name: 'left-oblique', position: [-43, 16, 42], lookAt: [-2, 9, 2] },
    { name: 'right-oblique', position: [43, 16, 42], lookAt: [2, 9, 2] },
    { name: 'deep-niche', position: [0, 1.8, 17], lookAt: [0, 8, -1] },
    { name: 'rock-and-spillways', position: [15, 3.3, 24], lookAt: [0, 1.7, 6] },
    { name: 'papal-crest', position: [5, 25, 17], lookAt: [0, 24, 0.2] },
    { name: 'basin-and-stairs', position: [-26, 9, 31], lookAt: [0, -0.5, 17] },
    { name: 'overhead', position: [0, 85, 15], lookAt: [0, 0, 14] },
  ],
  portableGroundY: -3.8,
  mediumFiContext: {
    scale: 1.05,
    groundY: -3.8,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: { outline: opening.outline, basis: opening.basis },
  build: treviFountain,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Frozen independent Terrarium256m source field, original2PNG tiles/all66049derived1m samples retained; provider-relative32.7437m dry outer Piazza di Trevi path contact. Physical fountain/site opening requires actual floor coverage; no source flattening or fitting.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-trevi-fountain.mjs',
    level: 'skyline',
    export: 'treviFountainSkyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'treviFountainDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'treviFountainStreet', errorMeters: 0.3, surfaces },
    },
  },
  limitations: [
    ...frame.limitations,
    'Facade width49.69m follows mapped line;26.3m reported overall height is a non-survey visual control. Individual cornices, column dimensions, water/step levels, rock positions and statue poses are photographic estimates. Sculptures retain restrained silhouettes, not exact faces, muscle/finger/fabric detail or copied reliefs/inscriptions.',
    'Immediate4.2m backing facade is a bounded wall volume, not the complete Palazzo Poli. No interior, water simulation, fountain plumbing or navigable collision claim. Waterfall strips are static pale geometric surfaces.',
    'Original Terrarium pixels may oversample much coarser composite source data;1m sampling does not imply survey accuracy. Provider-relative vertical reference only; default coarse host terrain compatibility not certified.',
  ],
};
