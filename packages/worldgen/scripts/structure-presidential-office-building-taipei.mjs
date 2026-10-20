/** Presidential Office Building: present exterior, two open courts and asymmetric porticos. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/ws/wsq/presidential_office_building_taipei/map-frame.json' with {
  type: 'json',
};
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  red = rgb('985c50'),
  pale = rgb('deded2'),
  gray = rgb('b7b9b0'),
  copper = rgb('a2c1ad'),
  metal = rgb('8eaaa0'),
  glass = rgb('47575b'),
  wood = rgb('665d52');
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const inner = [
  [-39, -22],
  [39, -22],
  [39, -16],
  [46.8, -14],
  [46.8, 14],
  [39, 16],
  [39, 22],
  [-39, 22],
  [-39, 16],
  [-46.8, 14],
  [-46.8, -14],
  [-39, -16],
];
const signed = (r) =>
  r.reduce((n, p, i) => {
    const q = r[(i + 1) % r.length];
    return n + p[0] * q[1] - q[0] * p[1];
  }, 0);
function prism(
  out,
  outer,
  holes,
  y0,
  y1,
  color,
  slot = 'brick',
  innerColor = pale,
  exterior = true,
  interior = true,
) {
  const rings = [outer, ...holes].map((r, i) => {
      const q =
        r.length > 1 && Math.hypot(r[0][0] - r.at(-1)[0], r[0][1] - r.at(-1)[1]) < 1e-6
          ? r.slice(0, -1)
          : r.slice();
      if (signed(q) > 0 !== (i === 0)) q.reverse();
      return q;
    }),
    points = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ids = earcut(points.flat(), starts);
  for (let k = 0; k < rings.length; k++)
    for (let i = 0; i < rings[k].length; i++) {
      if (!exterior && k === 0) continue;
      if (!interior && k > 0) continue;
      const a = rings[k][i],
        b = rings[k][(i + 1) % rings[k].length];
      quad(
        out,
        k ? 'stone' : slot,
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
        k ? innerColor : color,
      );
    }
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3) {
      const p = ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]);
      out.addTriangle(
        slot,
        ref,
        p,
        n,
        p.map((p) => [p[0], p[2]]),
        color,
      );
    }
}
function oriented(out, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => out.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => out.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return out.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(out, slot, x0, x1, y0, y1, z, color) {
  quad(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
    color,
  );
}
function hip(out, x0, x1, z0, z1, eave, peak, slot = 'roof', color = copper) {
  const dx = x1 - x0,
    dz = z1 - z0,
    alongX = dx >= dz,
    run = Math.min(dx, dz) / 2;
  const p = [
      [x0, eave, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [x0, eave, z1],
    ],
    a = alongX ? [x0 + run, peak, (z0 + z1) / 2] : [(x0 + x1) / 2, peak, z0 + run],
    b = alongX ? [x1 - run, peak, (z0 + z1) / 2] : [(x0 + x1) / 2, peak, z1 - run];
  const faces = alongX
    ? [
        [p[0], p[1], b, a],
        [p[1], p[2], b],
        [p[2], p[3], a, b],
        [p[3], p[0], a],
      ]
    : [
        [p[0], p[1], a],
        [p[1], p[2], b, a],
        [p[2], p[3], b],
        [p[3], p[0], a, b],
      ];
  for (const raw of faces) {
    const p = raw.filter(
      (q, i) => !raw.slice(0, i).some((r) => Math.hypot(...q.map((v, j) => v - r[j])) < 1e-7),
    );
    const n = normalFor(...p);
    if (n[1] < 0) p.reverse();
    out.addConvexPolygon(slot, ref, p, normalFor(...p), (p) => [p[0], p[2]], color);
  }
}
function archShape(x, y, w, h, n = 10, rise = w / 2) {
  const r = w / 2,
    sp = y + h - rise,
    p = [
      [x - r, y],
      [x + r, y],
      [x + r, sp],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    p.push([x + r * Math.cos(a), sp + rise * Math.sin(a)]);
  }
  return p;
}
function wall(out, width, y0, y1, holes, d, slot = 'brick', color = red) {
  if (!d) {
    face(out, slot, -width / 2, width / 2, y0, y1, 0, color);
    return;
  }
  if (d === 1 && slot === 'stone') {
    face(out, slot, -width / 2, width / 2, y0, y1, 0, color);
    for (const h of holes)
      out.addConvexPolygon(
        'glass',
        ref,
        h.r.map((p) => [p[0], p[1], 0.005]),
        [0, 0, 1],
        (p) => [p[0], p[1]],
        glass,
      );
    return;
  }
  const rings = [rect(-width / 2, width / 2, y0, y1), ...holes.map((h) => h.r)],
    p = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ids = earcut(p.flat(), starts);
  for (let i = 0; i < ids.length; i += 3) {
    const pp = ids.slice(i, i + 3).map((j) => [p[j][0], p[j][1], 0]);
    out.addTriangle(
      slot,
      ref,
      pp,
      [0, 0, 1],
      pp.map((p) => [p[0], p[1]]),
      color,
    );
  }
  for (const h of holes) {
    const r = h.r.slice();
    if (signed(r) < 0) r.reverse();
    const depth = h.depth ?? 0.2;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if (d === 1 && Math.abs(a[0] - b[0]) > 0.001) continue;
      quad(
        out,
        'stone',
        [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], b[1], -depth],
          [a[0], a[1], -depth],
        ],
        [a[1] - b[1], b[0] - a[0], 0],
        gray,
      );
    }
    out.addConvexPolygon(
      'glass',
      ref,
      r.map((p) => [p[0], p[1], -depth]),
      [0, 0, 1],
      (p) => [p[0], p[1]],
      glass,
    );
    if (d > 1) {
      const xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]),
        x = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys),
        w = Math.max(...xs) - Math.min(...xs);
      face(out, 'wood', x - 0.035, x + 0.035, lo, hi, -depth + 0.02, wood);
      for (const t of [0.32, 0.66])
        face(
          out,
          'wood',
          x - w / 2,
          x + w / 2,
          lo + (hi - lo) * t - 0.035,
          lo + (hi - lo) * t + 0.035,
          -depth + 0.02,
          wood,
        );
    }
  }
}
function rail(out, x0, x1, y, z, d) {
  if (d === 1) {
    face(out, 'stone', x0, x1, y, y + 0.14, z + 0.2, gray);
    face(out, 'stone', x0, x1, y + 0.92, y + 1.09, z + 0.2, pale);
    for (let x = x0 + 0.3; x < x1; x += 0.95)
      face(out, 'stone', x - 0.07, x + 0.07, y + 0.14, y + 0.92, z + 0.1, pale);
    return;
  }
  B(out, 'stone', (x0 + x1) / 2, y, z, x1 - x0, 0.14, 0.34, gray);
  B(out, 'stone', (x0 + x1) / 2, y + 0.92, z, x1 - x0, 0.17, 0.4, pale);
  if (d < 2) {
    if (d === 1)
      for (let x = x0 + 0.35; x < x1; x += 1.15)
        B(out, 'stone', x, y + 0.14, z, 0.15, 0.78, 0.2, pale);
    return;
  }
  for (let x = x0 + 0.24; x < x1 - 0.1; x += d === 2 ? 1.1 : 1.0) {
    if (d === 2) B(out, 'stone', x, y + 0.14, z, 0.16, 0.78, 0.16, pale);
    else
      loft(
        out,
        'stone',
        [
          [y + 0.14, 0.12],
          [y + 0.3, 0.15],
          [y + 0.88, 0.14],
        ].map(([y, r]) => radialRing(y, r, r, 4, [x, z])),
        pale,
      );
  }
}
function archBand(out, x, y, z, w, h, rise, d) {
  const r = w / 2,
    sp = y + h - rise,
    n = d === 1 ? 3 : d === 2 ? 8 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      lo = [x + r * Math.cos(a), sp + rise * Math.sin(a)],
      hi = [x + r * Math.cos(b), sp + rise * Math.sin(b)],
      ro = r + 0.24,
      rr = rise + 0.24;
    quad(
      out,
      'stone',
      [
        [lo[0], lo[1], z + 0.16],
        [x + ro * Math.cos(a), sp + rr * Math.sin(a), z + 0.16],
        [x + ro * Math.cos(b), sp + rr * Math.sin(b), z + 0.16],
        [hi[0], hi[1], z + 0.16],
      ],
      [0, 0, 1],
      pale,
    );
    quad(
      out,
      'stone',
      [
        [lo[0], lo[1], z + 0.16],
        [hi[0], hi[1], z + 0.16],
        [hi[0], hi[1], z - 0.55],
        [lo[0], lo[1], z - 0.55],
      ],
      [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
      gray,
    );
    quad(
      out,
      'brick',
      [
        [x + ro * Math.cos(a), sp + rr * Math.sin(a), z],
        [x + ro * Math.cos(b), sp + rr * Math.sin(b), z],
        [x + ro * Math.cos(b), y + h + 0.5, z],
        [x + ro * Math.cos(a), y + h + 0.5, z],
      ],
      [0, 0, 1],
      red,
    );
  }
}
function col(out, x, y, z, h, d, paired = false) {
  for (const dx of paired && d > 1 ? [-0.34, 0.34] : [0]) {
    if (d < 2) B(out, 'stone', x + dx, y, z, paired ? 0.8 : 0.48, h, 0.5, pale);
    else
      loft(
        out,
        'stone',
        [
          [y, 0.35],
          [y + 0.17, 0.37],
          [y + 0.35, 0.24],
          [y + h - 0.3, 0.22],
          [y + h - 0.12, 0.37],
          [y + h, 0.4],
        ].map(([yy, r]) => radialRing(yy, r, r, 6, [x + dx, z])),
        pale,
      );
  }
}
function arcade(out, width, bays, d) {
  const spacing = width / bays;
  if (!d) {
    B(out, 'stone', 0, 18.8, 0, width, 0.6, 2.6, pale);
    return;
  }
  for (const y of [3.2, 8.4, 13.6, 18.8, 22.2]) B(out, 'stone', 0, y, 0, width, 0.28, 3.1, pale);
  for (let i = 0; i <= bays; i++) {
    const x = -width / 2 + i * spacing;
    B(out, 'brick', x, 3.48, 0, 0.65, 9.85, 0.72, red);
    B(out, 'stone', x, 3.35, 0, 0.95, 0.25, 0.95, pale);
    col(out, x, 13.9, 0, 4.6, d, true);
    if (d > 1)
      for (const y of [7.95, 8.35, 12.9, 14.5, 15.35, 16.2, 17.05])
        B(out, 'stone', x, y, 0.02, 1, 0.22, 0.92, pale);
  }
  for (let i = 0; i < bays; i++) {
    const x = -width / 2 + (i + 0.5) * spacing,
      w = spacing - 0.65;
    archBand(out, x, 8.68, 0, w, 4.7, 0.7, d);
    archBand(out, x, 13.88, 0, w, 4.55, w / 2, d);
    rail(out, x - w / 2, x + w / 2, 8.66, 0.1, d);
    rail(out, x - w / 2, x + w / 2, 13.86, 0.1, d);
  }
  rail(out, -width / 2, width / 2, 19.15, 0.15, d);
  for (let x = -width / 2; x <= width / 2 + 0.01; x += spacing) {
    B(out, 'brick', x, 19.1, -0.25, 0.5, 3.1, 0.5, red);
    B(out, 'stone', x, 21.7, -0.2, 0.7, 0.22, 0.65, pale);
  }
}
function cornices(out, w, y, z, d) {
  for (const [yy, h, depth] of [
    [y, 0.22, 0.35],
    [y + 0.25, 0.16, 0.65],
  ])
    B(out, 'stone', 0, yy, z, w, h, depth, pale);
  if (d > 1)
    for (let x = -w / 2 + 0.4; x < w / 2; x += 1.1)
      B(out, 'stone', x, y - 0.3, z, 0.2, 0.3, 0.42, pale);
}
function eye(out, x, y, z, r, d) {
  const n = d === 1 ? 8 : d === 2 ? 12 : 20;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    quad(
      out,
      'stone',
      [
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + (r + 0.2) * Math.cos(a), y + (r + 0.2) * Math.sin(a), z],
        [x + (r + 0.2) * Math.cos(b), y + (r + 0.2) * Math.sin(b), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      [0, 0, 1],
      pale,
    );
  }
  const r0 = Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i / n) * Math.PI * 2),
    y + r * Math.sin((i / n) * Math.PI * 2),
    z - 0.03,
  ]);
  out.addConvexPolygon('glass', ref, r0, [0, 0, 1], (p) => [p[0], p[1]], glass);
  if (d > 1) {
    face(out, 'wood', x - 0.03, x + 0.03, y - r, y + r, z, wood);
    face(out, 'wood', x - r, x + r, y - 0.03, y + 0.03, z, wood);
  }
}
function corner(out, x, z, d) {
  B(out, 'brick', x, 1.5, z, d ? 8.3 : 9, 24.3, d ? 8.3 : 9, red);
  for (const y of d === 1
    ? [2, 4.4, 8.5, 13.3, 18.8, 25.5]
    : d
      ? [2, 2.8, 3.6, 4.4, 7.8, 8.5, 12.6, 13.3, 18.8, 24.7, 25.5]
      : [19])
    B(out, 'stone', x, y, z, 9.3, 0.25, 9.3, pale);
  B(out, 'stone', x, 25.7, z, 10.4, 0.6, 10.4, pale);
  B(out, 'brick', x, 26.3, z, 7.8, 3.6, 7.8, red);
  B(out, 'stone', x, 29.6, z, 8.5, 0.4, 8.5, pale);
  hip(out, x - 4.6, x + 4.6, z - 4.6, z + 4.6, 30, 32.5);
  if (!d) return;
  for (let i = 0; i < 4; i++) {
    const o = oriented(out, (i * Math.PI) / 2, x, z),
      holes = [];
    for (const y of [4.8, 10, 15.2, 20.3])
      holes.push({ r: rect(-1.05, 1.05, y, y + (y > 20 ? 2 : 3.5)) });
    wall(oriented(o, 0, 0, 4.51), 8.6, 1.6, 25.5, holes, d);
    B(o, 'stone', -3.9, 1.6, 4.55, 0.35, 24, 0.25, pale);
    B(o, 'stone', 3.9, 1.6, 4.55, 0.35, 24, 0.25, pale);
    for (const xx of [-2.2, 2.2]) eye(o, xx, 27.9, 3.93, 0.48, d);
    // The front and side gables sit below the small belvedere roof.
    const pp = [
      [-4.3, 23.1, 4.73],
      [4.3, 23.1, 4.73],
      [0, 25.7, 4.73],
    ];
    o.addTriangle(
      'stone',
      ref,
      pp,
      [0, 0, 1],
      pp.map((p) => [p[0], p[1]]),
      pale,
    );
    face(o, 'glass', -0.65, 0.65, 23.25, 24.4, 4.76, glass);
  }
}
function centralTower(out, frame, d) {
  const native = frame.geometry.parts
      .find((p) => p.properties.kind_detail === 'tower')
      .outline.slice(0, -1),
    towerX = native.map((p) => p[0]),
    towerZ = native.map((p) => p[1]),
    x = (Math.min(...towerX) + Math.max(...towerX)) / 2,
    z = (Math.min(...towerZ) + Math.max(...towerZ)) / 2;
  prism(out, native, [], 20, 46, red, 'brick', pale, d === 0);
  if (d) {
    const ring = signed(native) > 0 ? native : [...native].reverse();
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        angle = Math.atan2(dz, -dx),
        o = oriented(out, angle, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
        h = [];
      if (len > 3)
        for (const y of [26.8, 33.5, 40.2]) h.push({ r: rect(-0.7, 0.7, y, y + 3.2), depth: 0.24 });
      wall(o, len, 20, 46, h, d);
      for (const y of [24.8, 25.5, 26.2, 44.8, 45.5])
        face(o, 'stone', -len / 2, len / 2, y, y + 0.22, 0.03, pale);
    }
  }
  if (!d) {
    B(out, 'stone', x, 45.5, z, 9.8, 11.7, 9.8, pale);
    for (let i = 0; i < 4; i++) {
      const o = oriented(out, (i * Math.PI) / 2, x, z),
        p = archShape(0, 48.4, 3.5, 6.4, 6).map((p) => [p[0], p[1], 4.91]);
      o.addConvexPolygon('glass', ref, p, [0, 0, 1], (p) => [p[0], p[1]], glass);
    }
    hip(out, x - 5, x + 5, z - 5, z + 5, 57.2, 60, 'stone', gray);
    return;
  }
  B(out, 'stone', x, 45.9, z, 9.4, 0.65, 9.4, pale);
  for (let i = 0; i < 4; i++) {
    const o = oriented(out, (i * Math.PI) / 2, x, z);
    const crown = oriented(o, 0, 0, 4.5);
    wall(
      crown,
      8.7,
      46.5,
      56.8,
      [{ r: archShape(0, 48.4, 3.5, 6.4, d === 1 ? 6 : 14), depth: 0.45 }],
      d,
      'stone',
      pale,
    );
    for (const xx of [-3.3, 3.3]) {
      B(o, 'brick', xx, 46.5, 4.65, 1.25, 10.2, 0.6, red);
      for (let yy = 47; yy < 56.9; yy += 0.85) B(o, 'stone', xx, yy, 4.82, 1.4, 0.22, 0.6, pale);
      col(o, xx, 49.1, 5.05, 5.5, d, true);
      if (d > 1)
        for (let j = 0; j < 4; j++)
          B(o, 'stone', xx, 46.4 + j * 0.55, 4.85 + j * 0.13, 1.15, 0.42, 0.8 + j * 0.18, pale);
    }
    eye(o, 0, 47.5, 4.6, 0.65, d);
    cornices(o, 10.1, 56.8, 4.6, d);
    B(o, 'stone', 0, 55.3, 4.73, 4.0, 0.22, 0.25, pale);
  }
  B(out, 'stone', x, 57.1, z, 10.3, 0.4, 10.3, pale);
  hip(out, x - 5.2, x + 5.2, z - 5.2, z + 5.2, 57.5, 60, 'stone', gray);
  beam(out, 'metal', [x, 60, z], [x, 64, z], 0.075, 0.075, metal);
  if (d > 1) {
    face(oriented(out, 0, x, z), 'flag', 0.06, 1.8, 62.5, 63.55, 0, rgb('b74a43'));
    face(oriented(out, Math.PI, x, z), 'flag', -1.8, -0.06, 62.5, 63.55, -0.005, rgb('b74a43'));
    for (const a of [0, Math.PI]) {
      const o = oriented(out, a, x, z),
        left = a === 0 ? 0.06 : -0.9,
        right = a === 0 ? 0.9 : -0.06,
        cx = (left + right) / 2;
      face(o, 'flag', left, right, 63.025, 63.55, 0.012, rgb('344b80'));
      const sun = Array.from({ length: 12 }, (_, i) => [
        cx + 0.13 * Math.cos((i / 12) * Math.PI * 2),
        63.2875 + 0.13 * Math.sin((i / 12) * Math.PI * 2),
        0.022,
      ]);
      o.addConvexPolygon('flag', ref, sun, [0, 0, 1], (p) => [p[0], p[1]], pale);
    }
  }
}
function centralHall(out, d) {
  B(out, 'stone', 0, 1.5, 0, 22.7, 12.3, 41.4, pale);
  const n = d === 0 ? 4 : d === 1 ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      pp = [
        [11.8 * Math.cos(a), 13.8 + 4 * Math.sin(a), -18],
        [11.8 * Math.cos(b), 13.8 + 4 * Math.sin(b), -18],
        [11.8 * Math.cos(b), 13.8 + 4 * Math.sin(b), 18],
        [11.8 * Math.cos(a), 13.8 + 4 * Math.sin(a), 18],
      ];
    quad(out, 'roof', pp, [Math.cos((a + b) / 2), Math.sin((a + b) / 2), 0], gray);
  }
  B(out, 'stone', 0, 17.6, 0, 11, 1.2, 9.5, pale);
  hip(out, -6.2, 6.2, -5.4, 5.4, 18.8, 20, 'stone', gray);
  if (d)
    for (const sign of [-1, 1]) {
      const o = oriented(out, (sign * Math.PI) / 2, sign * 11.71, 0),
        holes = [];
      for (let x = -17; x < 19; x += 4.4)
        for (const y of [3.8, 9]) holes.push({ r: rect(x - 0.65, x + 0.65, y, y + 3.2) });
      wall(o, 40, 1.6, 13.7, holes, d, 'stone', pale);
    }
}
function entrance(out, d, back = false) {
  const o = oriented(out, back ? Math.PI : 0, 0, back ? -37.6 : 39.5),
    w = back ? 8.5 : 13;
  B(o, 'stone', 0, 0.15, 1.8, w, 1.4, 6.2, gray);
  B(o, 'stone', 0, 9.0, 1.5, w, 0.48, 6.0, pale);
  if (d) {
    for (const x of [-w * 0.4, -w * 0.28, w * 0.28, w * 0.4]) col(o, x, 1.55, 4.0, 7.45, d);
    for (let i = 0; i < 6; i++)
      B(o, 'stone', 0, 0.05, 6.1 - i * 0.36, w * 0.8, 0.24 + i * 0.24, 2.1 - i * 0.35, gray);
    const holes = [{ r: archShape(0, 1.6, 4.4, 6.8, d === 1 ? 6 : 16) }];
    wall(oriented(o, 0, 0, -0.16), w - 2, 1.5, 8.9, holes, d, 'stone', pale);
    rail(o, -w / 2, w / 2, 9.55, 4.25, d);
  } else {
    B(o, 'stone', -w * 0.4, 1.55, 4, 0.9, 7.45, 0.9, pale);
    B(o, 'stone', w * 0.4, 1.55, 4, 0.9, 7.45, 0.9, pale);
  }
}
function facade(out, a, x, z, w, bays, d, portico = true) {
  const o = oriented(out, a, x, z),
    back = portico ? -2.8 : 0,
    holes = [];
  if (d)
    for (let i = 0; i < bays; i++)
      for (const [y, h] of [
        [3.8, 3.2],
        [9, 3.5],
        [14.2, 3.4],
        [19.7, 1.9],
      ]) {
        const xx = -w / 2 + ((i + 0.5) * w) / bays;
        holes.push({ r: rect(xx - 0.65, xx + 0.65, y, y + h) });
      }
  wall(oriented(o, 0, 0, back), w, 1.5, 22.4, holes, d);
  if (portico) arcade(o, w, bays, d);
  else for (const y of [3.2, 8.4, 13.6, 18.8, 22.2]) B(o, 'stone', 0, y, 0, w, 0.22, 0.2, pale);
  cornices(o, w, 22.55, portico ? -0.1 : 0, d);
}
export function presidentialOfficeBuildingTaipei(out, frame = nativeFrame, d = 3) {
  const outer = d === 0 ? rect(-65, 65, -38.5, 39) : frame.geometry.outline,
    holes = d === 0 ? [rect(-46.7, -12, -22, 22), rect(12, 46.7, -22, 22)] : frame.geometry.holes;
  prism(out, outer, holes, -0.35, 1.5, gray, 'stone');
  // Architectural mass leaves one large open space until the lower central hall divides it.
  // The arcaded outer three sides stand forward of the recessed wall; north has no portico.
  prism(
    out,
    rect(-61.2, 64.4, -34.8, 35),
    [inner],
    1.5,
    22.4,
    red,
    'brick',
    pale,
    d === 0,
    d === 0,
  );
  centralHall(out, d);
  for (const sign of [-1, 1]) {
    facade(out, 0, sign * 31.2, 38.0, 36, 8, d);
    facade(out, Math.PI, sign * 31.0, -37.6, 35.5, 8, d);
  }
  facade(out, -Math.PI / 2, -64.3, 0, 51, 11, d, true);
  facade(out, Math.PI / 2, 64.5, 0, 51, 11, d, false);
  hip(out, -50, 50, 23.0, 39.1, 22.85, 25.6);
  hip(out, -50, 50, -39, -23, 22.85, 25.6);
  hip(out, -65.0, -46.5, -28, 28, 22.85, 25.6);
  hip(out, 46.5, 65, -28, 28, 22.85, 25.6);
  for (const x of [-56, 56]) for (const z of [-31.6, 31.6]) corner(out, x, z, d);
  for (const x of [-10, 10]) {
    B(out, 'brick', x, 1.5, 37.8, 5.6, 24.8, 5.2, red);
    for (const y of d ? [3.2, 4, 4.8, 7.8, 8.4, 13, 13.6, 18.5, 21.4, 25.5] : [8.4, 19, 25.5])
      B(out, 'stone', x, y, 37.8, 5.8, 0.24, 5.4, pale);
    B(out, 'stone', x, 26.3, 37.8, 6.1, 0.5, 5.8, pale);
    if (d)
      for (const y of [5, 10.3, 15.5, 22.5])
        face(out, 'glass', x - 0.7, x + 0.7, y, y + 2.2, 40.42, glass);
  }
  if (d) {
    const holes = [];
    for (const x of [-4.6, 0, 4.6])
      for (const y of [10.3, 15.5]) holes.push({ r: rect(x - 0.8, x + 0.8, y, y + 3.5) });
    holes.push({ r: archShape(0, 20.0, 3.7, 4.4, d === 1 ? 6 : 14) });
    wall(oriented(out, 0, 0, 38.2), 14.2, 9.45, 25.4, holes, d, 'stone', pale);
    for (const x of [-6.4, -2.35, 2.35, 6.4]) B(out, 'stone', x, 9.5, 38.5, 0.28, 13.4, 0.42, pale);
    for (const y of [9.5, 14.1, 19.2, 25.25]) B(out, 'stone', 0, y, 38.4, 14.6, 0.25, 0.55, pale);
    const pp = [
      [-3, 25.4, 38.5],
      [3, 25.4, 38.5],
      [0, 28.0, 38.5],
    ];
    out.addTriangle(
      'stone',
      ref,
      pp,
      [0, 0, 1],
      pp.map((p) => [p[0], p[1]]),
      pale,
    );
    // Four small rounded corner porches follow their own native roof outlines.
    for (const p of frame.geometry.parts.filter((p) => p.properties.kind_detail === 'roof')) {
      const ring = p.outline.slice(0, -1);
      prism(out, ring, [], 5.4, 5.65, pale, 'stone');
      if (d > 1)
        for (let j = 1; j < ring.length; j += 2) col(out, ring[j][0], 1.5, ring[j][1], 3.9, 1);
      else for (let j = 1; j < ring.length; j += 3) col(out, ring[j][0], 1.5, ring[j][1], 3.9, 1);
    }
  }
  centralTower(out, frame, d);
  entrance(out, d);
  if (d) entrance(out, d, true);
  if (d) {
    for (const z of [-31, 31])
      for (const x of [-38, -22, 22, 38]) {
        B(out, 'stone', x, 25.2, z, 1.25, 1.25, 1.25, pale);
        hip(out, x - 0.8, x + 0.8, z - 0.8, z + 0.8, 26.45, 27.0);
        if (d > 1)
          for (let j = 0; j < 4; j++)
            B(out, 'metal', x, 25.45 + j * 0.22, z + 0.64, 1, 0.055, 0.09, metal);
      }
    // Actual inward-facing courtyard walls. Window apertures replace wall triangles.
    const ring = signed(inner) > 0 ? inner : [...inner].reverse();
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        len = Math.hypot(dx, dz),
        o = oriented(out, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
        h = [],
        count = Math.floor(len / 4);
      for (let k = 0; k < count; k++)
        for (const y of [3.5, 8.8, 14, 19.5]) {
          const x = -len / 2 + ((k + 0.5) * len) / count;
          h.push({ r: rect(x - 0.7, x + 0.7, y, y + (y > 19 ? 1.9 : 3.5)) });
        }
      wall(o, len, 1.5, 22.4, h, d, 'stone', pale);
      for (const y of [3.2, 8.4, 13.6, 18.8])
        face(o, 'stone', -len / 2, len / 2, y, y + 0.17, 0.025, gray);
    }
    if (d > 1)
      for (const z of [-39.03, 39.13])
        for (let x = -49; x < 50; x += 2.2)
          beam(
            out,
            'metal',
            [x, 22.87, z],
            [x, 25.62, z > 0 ? 31.05 : -31.05],
            0.032,
            0.032,
            metal,
          );
  }
}
export const presidentialOfficeBuildingTaipeiSkyline = (o, f) =>
  presidentialOfficeBuildingTaipei(o, f, 0);
export function presidentialOfficeBuildingTaipeiDistrict(out, frame) {
  presidentialOfficeBuildingTaipei(out, frame, 0);
  for (const [a, x, z, w, bays] of [
    [0, 0, 38.1, 100, 23],
    [Math.PI, 0, -37.7, 100, 23],
    [-Math.PI / 2, -64.4, 0, 51, 11],
    [Math.PI / 2, 64.6, 0, 51, 11],
  ]) {
    const o = oriented(out, a, x, z);
    for (const y of [3.2, 8.4, 13.6, 18.8, 22.2])
      face(o, 'stone', -w / 2, w / 2, y, y + 0.28, 0, pale);
    for (let i = 0; i < bays; i++) {
      const xx = -w / 2 + ((i + 0.5) * w) / bays;
      if ((a === 0 || a === Math.PI) && Math.abs(xx) < 14) continue;
      for (const [y, h] of [
        [4.1, 3.0],
        [9.2, 3.4],
        [14.5, 3.3],
        [20, 1.8],
      ])
        face(o, 'glass', xx - 0.7, xx + 0.7, y, y + h, 0.02, glass);
      if (a !== Math.PI / 2) {
        B(o, 'brick', xx + w / bays / 2, 3.5, 0.04, 0.48, 10.0, 0.6, red);
        B(o, 'stone', xx + w / bays / 2, 13.9, 0.04, 0.5, 4.6, 0.6, pale);
      }
    }
  }
  for (const x of [-56, 56])
    for (const z of [-31.6, 31.6])
      for (let i = 0; i < 4; i++) {
        const o = oriented(out, (i * Math.PI) / 2, x, z);
        for (const y of [5, 10.2, 15.4, 20.6]) face(o, 'glass', -0.7, 0.7, y, y + 2.8, 4.54, glass);
      }
}
export const presidentialOfficeBuildingTaipeiStreet = (o, f) =>
  presidentialOfficeBuildingTaipei(o, f, 1);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.18 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.18 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.36, metallic: 0.08 },
  flag: { slot: 'trim', localRef: ref, roughness: 0.94, metallic: 0 },
};
export const presidentialOfficeBuildingTaipeiModel = {
  id: 'presidential_office_building_taipei',
  key: 'presidential_office_building_taipei',
  recipe: 'structure-presidential-office-building-taipei.mjs',
  cell: 'ws/wsq',
  title: 'Presidential Office Building, Taipei',
  build: presidentialOfficeBuildingTaipei,
  surfaces,
  brief:
    'Surviving red-brick and pale aggregate presidential office: two open courtyards with white internal elevations, lower central hall with curved roof, approximately60m tall cruciform central shaft and ornate arched crown/pyramidal gray cap. Four green-hipped corner towers, paired flat guard towers and present flat entrance porches, differentiated deep arcades on east/south/west with north facade solid, perforated balustrades, raised vents and green metal wing roofs. Service/security annexes and precinct landscaping excluded.',
  camera: [125, 95, 175],
  lookAt: [0, 23, 0],
  portableGroundY: -0.36,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'front-facade', position: [0, 24, 165], lookAt: [0, 28, 20] },
    { name: 'two-open-courts', position: [105, 115, 100], lookAt: [0, 15, 0] },
    { name: 'south-arcade', position: [-91, 16, 52], lookAt: [-44, 11, 31] },
    { name: 'north-no-portico', position: [115, 42, -30], lookAt: [58, 15, 0] },
    { name: 'central-crown', position: [22, 54, 73], lookAt: [0, 51, 32] },
    { name: 'courtyard-and-hall', position: [-30, 34, 12], lookAt: [-20, 11, -5] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Native signed building frame and external dry forecourt[0,55] retained. Published third-party NLSC-claimed2024 20mDTM Terrarium tile independently decoded, datum5.1845m. It replaces rejected composite after geometry without changing walls/foundations. Bounded source preview only; original official raster and publisher encoding pipeline unavailable; no survey claim.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-presidential-office-building-taipei.mjs',
    level: 'skyline',
    export: 'presidentialOfficeBuildingTaipeiSkyline',
    errorMeters: 4.2,
    surfaces,
    authoredLevels: {
      district: { export: 'presidentialOfficeBuildingTaipeiDistrict', errorMeters: 4.2, surfaces },
      street: { export: 'presidentialOfficeBuildingTaipeiStreet', errorMeters: 0.65, surfaces },
    },
  },
  limitations: [
    'Bounded exterior preview; see current hash-bound QA. Geometry, hidden foundations and fine ornament are approximate, not surveyed.',
    'Official approximately140m×85m overall plan and60m tower are approximate references. Native main outline is quantized; photo-directed roof levels, arcade bays and hidden foundations are not surveyed.',
    'North exterior lacks portico per official description; central hall and courtyard chambers generalized. Interior rooms and security/service annexes omitted.',
    'Original rejected composite is preserved separately. Replacement is an independently decoded published third-party reencoding claimed as2024NLSC20mDTM; original official raster and publisher conversion pipeline unavailable. Zoom13 pixels17.3m;1m review grid interpolates, not1m accuracy. Preview accepts only retained source relative ground; other DEMs require independent contact review.',
    'Reference imagery remains local provenance; no photograph used as facade texture.',
  ],
};
