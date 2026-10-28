/** Demolished Schinkel observatory: official1879cross plan and north elevation, published1880. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
  torus,
} from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u3/u33/berlin_observatory/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const ref = 'palette:#ffffff',
  tau = 2 * Math.PI;
const C = {
  wall: rgb('c3bdad'),
  trim: rgb('d8d1c0'),
  base: rgb('aaa493'),
  roof: rgb('606863'),
  metal: rgb('59635e'),
  glass: rgb('414d4c'),
  plaque: rgb('655f51'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  trim: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  base: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.35 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.35 },
  glass: { slot: 'trim', localRef: 'palette:#feffff', roughness: 0.3, metallic: 0.04 },
  plaque: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0.1 },
};
function tri(o, s, p, n, col = C[s]) {
  if (n && normalFor(...p).reduce((a, x, i) => a + x * n[i], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    col,
  );
}
function Q(o, s, p, n, col = C[s]) {
  tri(o, s, [p[0], p[1], p[2]], n, col);
  tri(o, s, [p[0], p[2], p[3]], n, col);
}
function cap(o, s, p, y, up = true, col = C[s]) {
  const ix = earcut(p.flat());
  for (let j = 0; j < ix.length; j += 3)
    tri(
      o,
      s,
      ix.slice(j, j + 3).map((k) => [p[k][0], y, p[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, p, y0, y1, col = C[s]) {
  p = p.map((q) => (q.length === 3 ? [q[0], q[2]] : q));
  if (
    p.reduce(
      (a, q, i) => a + q[0] * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * q[1],
      0,
    ) < 0
  )
    p = [...p].reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
  cap(o, s, p, y0, false, col);
  cap(o, s, p, y1, true, col);
}
function edge(a, b) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [t[1], -t[0]];
  return {
    len,
    n: [n[0], 0, n[1]],
    P: (u, y, dep = 0) => [a[0] + u * t[0] + dep * n[0], y, a[1] + u * t[1] + dep * n[1]],
  };
}
function beamAt(o, s, f, u0, y0, u1, y1, dep, w, h = w, col = C[s]) {
  beam(o, s, f.P(u0, y0, dep), f.P(u1, y1, dep), w, h, col);
}
function faceAt(o, s, f, u, y, w, h, dep = 0, col = C[s]) {
  Q(
    o,
    s,
    [
      f.P(u - w / 2, y, dep),
      f.P(u + w / 2, y, dep),
      f.P(u + w / 2, y + h, dep),
      f.P(u - w / 2, y + h, dep),
    ],
    f.n,
    col,
  );
}
function window(o, f, u, y, w, h, d) {
  faceAt(o, 'glass', f, u, y, w, h, 0.025);
  if (d === 0) return;
  if (d === 1) {
    for (const yy of [y - 0.05, y + h + 0.05])
      beamAt(o, 'trim', f, u - w / 2 - 0.08, yy, u + w / 2 + 0.08, yy, 0.1, 0.12, 0.18);
    beamAt(o, 'trim', f, u, y, u, y + h, 0.07, 0.045, 0.055);
    return;
  }
  const r = 0.065;
  for (const x of [u - w / 2 - r / 2, u + w / 2 + r / 2])
    beamAt(o, 'trim', f, x, y - 0.07, x, y + h + 0.07, 0.095, r, 0.16);
  for (const yy of [y - 0.05, y + h + 0.05])
    beamAt(o, 'trim', f, u - w / 2 - 0.09, yy, u + w / 2 + 0.09, yy, 0.1, 0.12, 0.19);
  if (d === 1) {
    beamAt(o, 'trim', f, u, y, u, y + h, 0.063, 0.04, 0.05);
    beamAt(o, 'trim', f, u - w / 2, y + h * 0.53, u + w / 2, y + h * 0.53, 0.063, 0.04, 0.05);
    return;
  }
  beamAt(o, 'trim', f, u, y, u, y + h, 0.07, 0.04, 0.055);
  for (let k = 1; k < 4; k++)
    beamAt(
      o,
      'trim',
      f,
      u - w / 2,
      y + (h * k) / 4,
      u + w / 2,
      y + (h * k) / 4,
      0.07,
      0.037,
      0.048,
    );
  beamAt(
    o,
    'trim',
    f,
    u - w / 2 - 0.14,
    y + h + 0.19,
    u + w / 2 + 0.14,
    y + h + 0.19,
    0.1,
    0.105,
    0.21,
  );
  beamAt(o, 'trim', f, u - w / 2 - 0.17, y - 0.14, u + w / 2 + 0.17, y - 0.14, 0.13, 0.13, 0.27);
  // Lower sash apron has shallow paneled woodwork, independent of the wall surface.
  const apronY = y - 0.49;
  faceAt(o, 'wall', f, u, apronY, w, 0.32, 0.04);
  for (const x of [u - w / 2 + 0.08, u + w / 2 - 0.08])
    beamAt(o, 'trim', f, x, apronY + 0.03, x, apronY + 0.29, 0.1, 0.048, 0.055);
  beamAt(o, 'trim', f, u, apronY + 0.03, u, apronY + 0.29, 0.1, 0.04, 0.05);
  if (d === 3)
    for (const dx of [-0.24, 0.24])
      faceAt(o, 'base', f, u + dx * w, apronY + 0.06, w * 0.32, 0.2, 0.06, C.wall);
}
function building(o, d) {
  const p = plan.planCalibration.outline;
  prism(o, 'wall', p, -0.35, 6.98);
  prism(o, 'base', p, -0.35, 0.55);
  prism(o, 'roof', p, 7.12, 7.27);
  if (d === 0) {
    prism(o, 'trim', p, 6.95, 7.13);
    return;
  }
  prism(o, 'trim', p, 3.22, 3.4);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      f = edge(a, b);
    beamAt(o, 'trim', f, 0, 6.94, f.len, 6.94, 0.06, 0.15, 0.17);
    beamAt(o, 'trim', f, -0.08, 7.12, f.len + 0.08, 7.12, 0.11, 0.19, 0.24);
    if (d >= 2) {
      beamAt(o, 'trim', f, 0, 0.57, f.len, 0.57, 0.035, 0.1, 0.12);
      beamAt(o, 'trim', f, 0, 6.76, f.len, 6.76, 0.035, 0.11, 0.13);
    }
    if (d === 3)
      for (let k = 1; k < Math.ceil(f.len / 0.75); k++) {
        const u = (k * f.len) / Math.ceil(f.len / 0.75);
        beamAt(o, 'base', f, u, -0.26, u, 0.48, 0.012, 0.018, 0.022, C.base);
      }
  }
  // Low true perimeter parapet: no site slab or parcel extrusion.
  if (d >= 2)
    for (let i = 0; i < p.length; i++) {
      const f = edge(p[i], p[(i + 1) % p.length]);
      beamAt(o, 'wall', f, 0, 7.35, f.len, 7.35, -0.03, 0.18, 0.15);
      beamAt(o, 'trim', f, -0.02, 7.48, f.len + 0.02, 7.48, -0.03, 0.12, 0.23);
    }
}
function facades(o, d) {
  const p = plan.planCalibration.outline;
  // Native plate has repeated residential bays on both long walls of the eastern arm.
  for (const z of [-6.13915, 6.112]) {
    const f = z < 0 ? edge([-18.8813, z], [-4.775, z]) : edge([-4.775, z], [-18.8813, z]);
    for (const u of [2.25, 5.77, 9.3, 12.8]) {
      window(o, f, u, 4.08, 1.25, 2.03, d);
      if (d > 0) window(o, f, u, 0.97, 1.12, 1.75, d);
    }
  }
  // Three faces of the opposed chamfered terminal observing bays, not generic square towers.
  for (const i of [2, 3, 4, 12, 13, 14]) {
    const f = edge(p[i], p[(i + 1) % p.length]);
    window(o, f, f.len / 2, 3.98, Math.min(1.38, f.len * 0.57), 2.2, d);
  }
  // Short west transit room: paired tall closed meridian shutters, visible in the north plate.
  for (const i of [7, 9]) {
    const f = edge(p[i], p[(i + 1) % p.length]);
    for (const u of [1.12, f.len - 1.12]) {
      faceAt(o, 'metal', f, u, 3.7, 0.34, 2.92, 0.035);
      if (d >= 2)
        for (let k = 0; k < 15; k++)
          beamAt(
            o,
            'trim',
            f,
            u - 0.18,
            3.8 + k * 0.18,
            u + 0.18,
            3.8 + k * 0.18,
            0.075,
            0.025,
            0.04,
          );
    }
  }
  const west = edge(p[8], p[9]);
  for (const u of [west.len * 0.25, west.len * 0.75]) window(o, west, u, 4.08, 1.05, 2.0, d);
  // Two diagonal hall bays have their own doors and intrinsic approach treads on the plan.
  for (const i of [6, 10]) {
    const f = edge(p[i], p[(i + 1) % p.length]),
      u = f.len * 0.47;
    faceAt(o, 'metal', f, u, 0.2, 1.18, 2.4, 0.03);
    if (d > 0) {
      for (const x of [u - 0.67, u + 0.67]) beamAt(o, 'trim', f, x, 0.1, x, 2.66, 0.08, 0.12, 0.2);
      beamAt(o, 'trim', f, u - 0.76, 2.68, u + 0.76, 2.68, 0.1, 0.18, 0.26);
    }
    for (let k = 0; k < (d === 0 ? 2 : 5); k++) {
      const h = 0.2 / (d === 0 ? 2 : 5),
        dep = 0.28 * (d === 0 ? 2.5 : 1),
        j = k + 1;
      const q = [
        f.P(u - 0.96, 0, dep * j),
        f.P(u + 0.96, 0, dep * j),
        f.P(u + 0.96, 0, dep * (j - 1)),
        f.P(u - 0.96, 0, dep * (j - 1)),
      ];
      prism(o, 'base', q, -0.35, 0.2 - k * h);
    }
  }
}
function eastTemple(o, d) {
  const x = -18.8813,
    f = edge([x, 6.112], [x, -6.13915]),
    u = f.len / 2;
  // Story records a temple front and Apollo-chariot pediment; exact concealed east bay census is estimated.
  faceAt(o, 'metal', f, u, 0.55, 1.5, 2.55, 0.04);
  for (const v of [-4.3, -2.65, 2.65, 4.3]) {
    window(o, f, u + v, 4.06, 1.12, 2.0, d);
    if (d > 0) window(o, f, u + v, 1.05, 1.05, 1.72, d);
  }
  for (const dx of [-1.65, 1.65]) {
    const a = f.P(u + dx, 0.55, 0.1),
      b = f.P(u + dx, 6.82, 0.1);
    beam(o, 'trim', a, b, 0.32, 0.18, C.trim);
    if (d > 0) {
      beamAt(o, 'trim', f, u + dx - 0.22, 0.63, u + dx + 0.22, 0.63, 0.11, 0.18, 0.31);
      beamAt(o, 'trim', f, u + dx - 0.23, 6.75, u + dx + 0.23, 6.75, 0.11, 0.15, 0.29);
    }
  }
  beamAt(o, 'trim', f, u - 3.4, 7.06, u + 3.4, 7.06, 0.18, 0.29, 0.42);
  const a = f.P(u - 3.4, 7.15, 0.12),
    b = f.P(u + 3.4, 7.15, 0.12),
    c = f.P(u, 8.58, 0.12);
  tri(o, 'wall', [a, b, c], f.n);
  tri(
    o,
    'wall',
    [
      a.map((v, i) => v - f.n[i] * 0.3),
      c.map((v, i) => v - f.n[i] * 0.3),
      b.map((v, i) => v - f.n[i] * 0.3),
    ],
    f.n.map((x) => -x),
  );
  for (const [p, q] of [
    [a, b],
    [b, c],
    [c, a],
  ])
    beam(o, 'trim', p, q, 0.15, 0.19, C.trim);
  if (d >= 2) {
    // Original unlettered shallow Apollo/chariot relief from the story, not a copied image or sculptural scan.
    const o3 = {
      addTriangle(s, _r, ps, _n, _uv, col) {
        tri(
          o,
          s,
          ps.map((p) => f.P(u + p[0], p[1], 0.175 + p[2])),
          f.n,
          col,
        );
      },
      addQuad(s, _r, ps, _n, _uv, col) {
        Q(
          o,
          s,
          ps.map((p) => f.P(u + p[0], p[1], 0.175 + p[2])),
          f.n,
          col,
        );
      },
      addConvexPolygon(s, _r, ps, _n, _uv, col) {
        for (let i = 1; i < ps.length - 1; i++)
          tri(
            o,
            s,
            [ps[0], ps[i], ps[i + 1]].map((p) => f.P(u + p[0], p[1], 0.175 + p[2])),
            f.n,
            col,
          );
      },
    };
    for (const xx of [-0.65, 0.05])
      torus(o3, 'trim', [xx, 7.43, 0.02], 0.17, 0.026, C.trim, d === 3 ? 18 : 12, 4);
    sphere(o3, 'trim', [-0.75, 7.98, 0.025], [0.09, 0.11, 0.045], C.trim, 8, 5);
    beam(o3, 'trim', [-0.75, 7.87, 0.02], [-0.62, 7.56, 0.02], 0.11, 0.07, C.trim);
    beam(o3, 'trim', [-0.57, 7.58, 0.03], [0.18, 7.58, 0.03], 0.08, 0.08, C.trim);
    for (let j = 0; j < 2; j++) {
      const xx = 0.55 + j * 0.52;
      sphere(o3, 'trim', [xx, 7.73, 0.02], [0.29, 0.11, 0.05], C.trim, 10, 5);
      beam(o3, 'trim', [xx + 0.17, 7.75, 0.02], [xx + 0.25, 7.97, 0.02], 0.1, 0.065, C.trim);
      for (const dx of [-0.16, 0.14])
        beam(o3, 'trim', [xx + dx, 7.67, 0.02], [xx + dx + 0.06, 7.39, 0.02], 0.04, 0.04, C.trim);
    }
  }
  for (let k = 0; k < (d === 0 ? 2 : 5); k++) {
    const n = d === 0 ? 2 : 5,
      depth = (n - k) * 0.26,
      y = -0.35 + ((k + 1) * 0.9) / n;
    const q = [
      f.P(u - 1.45, 0, depth + 0.05),
      f.P(u + 1.45, 0, depth + 0.05),
      f.P(u + 1.45, 0, 0.02),
      f.P(u - 1.45, 0, 0.02),
    ];
    prism(o, 'base', q, -0.35, y);
  }
}
function cylinder(o, s, profile, n) {
  loft(
    o,
    s,
    profile.map(([y, r]) => radialRing(y, r, r, n)),
    C[s],
  );
}
function dome(o, d) {
  const n = [10, 24, 48, 72][d],
    m = [4, 8, 12, 20][d],
    r = 3.75,
    y = 10.1;
  cylinder(
    o,
    'wall',
    [
      [7.15, 3.88],
      [7.35, 3.96],
      [7.48, 3.8],
      [9.2, 3.8],
    ],
    n,
  );
  cylinder(
    o,
    'trim',
    [
      [9.15, 3.91],
      [9.29, 3.96],
      [9.38, 3.82],
      [10.04, 3.82],
      [10.13, 3.95],
      [10.22, 3.91],
    ],
    n,
  );
  const rings = [];
  for (let j = 0; j <= m; j++) {
    const a = (j * Math.PI) / 2 / (m + 0.04),
      rr = r * Math.cos(a);
    rings.push(radialRing(y + r * Math.sin(a), rr, rr, n));
  }
  loft(o, 'roof', rings, C.roof);
  if (d === 0) return;
  const count = d === 1 ? 16 : 32;
  for (let i = 0; i < count; i++) {
    const a = (i * tau) / count,
      x = 3.84 * Math.sin(a),
      z = 3.84 * Math.cos(a),
      f = edge(
        [x - 0.1 * Math.cos(a), z + 0.1 * Math.sin(a)],
        [x + 0.1 * Math.cos(a), z - 0.1 * Math.sin(a)],
      );
    faceAt(o, 'base', f, 0.1, 9.42, 0.115, 0.5, 0.005, C.base);
    if (d >= 2)
      beam(
        o,
        'trim',
        [3.855 * Math.sin(a), 9.38, 3.855 * Math.cos(a)],
        [3.855 * Math.sin(a), 10.03, 3.855 * Math.cos(a)],
        0.035,
        0.045,
        C.trim,
      );
  }
  // Meridian slit is modeled with closed iron shutters, not a black cutout or invented open telescope.
  const P = (a, x = 0, extra = 0.025) => [
    x,
    y + (r + extra) * Math.sin(a),
    Math.sqrt(Math.max(0, (r + extra) * (r + extra) - x * x)) * Math.cos(a),
  ];
  for (const xx of [-0.28, 0.28]) {
    const pts = Array.from({ length: m + 1 }, (_, j) => P((j * Math.PI * 0.5) / m, xx, 0.035));
    beamPath(o, 'metal', pts, d === 1 ? 0.055 : 0.04, 0.045, C.metal);
  }
  if (d >= 2) {
    for (let j = 0; j < m; j++)
      Q(
        o,
        'metal',
        [
          P((j * Math.PI * 0.5) / m, -0.27, 0.035),
          P((j * Math.PI * 0.5) / m, 0.27, 0.035),
          P(((j + 1) * Math.PI * 0.5) / m, 0.27, 0.035),
          P(((j + 1) * Math.PI * 0.5) / m, -0.27, 0.035),
        ],
        [0, 1, 1],
      );
    for (let i = 0; i < 24; i++) {
      const a = (i * tau) / 24,
        pts = Array.from({ length: m + 1 }, (_, j) => {
          const t = (j * Math.PI * 0.49) / m;
          return [
            (r + 0.018) * Math.cos(t) * Math.sin(a),
            y + (r + 0.018) * Math.sin(t),
            (r + 0.018) * Math.cos(t) * Math.cos(a),
          ];
        });
      beamPath(o, 'metal', pts, 0.014, 0.017, C.metal);
    }
    torus(o, 'metal', [0, 13.96, -0.08], 0.15, 0.018, C.metal, d === 3 ? 20 : 12, 4);
    beam(o, 'metal', [-0.36, 13.91, 0], [0.45, 13.91, 0], 0.025, 0.025, C.metal);
  }
}
function benchmark(o, d) {
  // Intrinsic Normalhöhenpunkt on the north terminal wall, not the detached printed survey rods A/B.
  const z = 11.105,
    f = edge([1.23, z], [-0.99, z]),
    u = f.len / 2;
  faceAt(o, 'plaque', f, u, 0.45, 1.18, 1.62, 0.045);
  if (d === 0) return;
  for (const dx of [-0.68, 0.68])
    beamAt(o, 'trim', f, u + dx, 0.22, u + dx, 2.23, 0.12, 0.16, 0.28);
  for (const [yy, w] of [
    [0.18, 1.62],
    [0.39, 1.47],
    [2.18, 1.6],
    [2.3, 1.73],
  ])
    beamAt(o, 'trim', f, u - w / 2, yy, u + w / 2, yy, 0.15, 0.14, 0.34);
  faceAt(o, 'base', f, u, 0.6, 0.98, 0.33, 0.075, C.trim);
  if (d >= 2) {
    const pts = Array.from({ length: 17 }, (_, i) =>
      f.P(
        u + 0.43 * Math.cos((i * Math.PI) / 16),
        1.32 + 0.43 * Math.sin((i * Math.PI) / 16),
        0.12,
      ),
    );
    beamPath(o, 'trim', pts, 0.07, 0.1, C.trim);
    sphere(o, 'trim', f.P(u, 1.38, 0.12), [0.22, 0.22, 0.06], C.trim, d === 3 ? 16 : 10, 6);
    for (let i = 0; i < 10; i++) {
      const a = (i * tau) / 10;
      beam(
        o,
        'trim',
        f.P(u + 0.12 * Math.cos(a), 1.38 + 0.12 * Math.sin(a), 0.17),
        f.P(u + 0.3 * Math.cos(a), 1.38 + 0.3 * Math.sin(a), 0.17),
        0.026,
        0.035,
        C.trim,
      );
    }
    for (const yy of [0.76, 0.88, 1.04])
      beamAt(o, 'trim', f, u - 0.35, yy, u + 0.35, yy, 0.105, 0.022, 0.026);
  }
}
function build(o, _frame, d = 3) {
  building(o, d);
  facades(o, d);
  eastTemple(o, d);
  dome(o, d);
  benchmark(o, d);
}
export const berlinObservatorySkyline = (o, f) => build(o, f, 0),
  berlinObservatoryDistrict = (o, f) => build(o, f, 1),
  berlinObservatoryStreet = (o, f) => build(o, f, 2);
export const berlinObservatoryModel = {
  id: 'berlin_observatory',
  key: 'berlin_observatory',
  recipe: 'structure-berlin-observatory.mjs',
  cell: 'u3/u33',
  title: 'Berlin Observatory (1880)',
  category: 'observatory',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Complete historical1880Schinkel Kreuzberg observatory: scaled official cross-plan/eastern residentialwing/opposed chamfered observingbays/short westtransitwing, restrained two-story Hellenic walls/plinth/cornices/tall sash, east temple-front pediment/shallow Apollo-chariot interpretation, central7.5mhemisphericaliron dome/raiseddrum/paneledband/closedmeridian shutters/ribs, intrinsicframednorthheightbenchmark. No present-daybuilding, Babelsberg/stablestower, park/parcel/slab/people or copiedletters.',
  camera: [-37, 24, 39],
  lookAt: [-4, 5.6, 0],
  portableGroundY: -0.53,
  mediumFiContext: { scale: 0.62, groundY: -0.53 },
  qaCameras: [
    {
      name: 'official-cross-plan-observation-bays-and-central-hemisphere',
      position: [-30, 35, 29],
      lookAt: [-4, 5, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'north-framed-normalheight-benchmark-and-tall-sash',
      position: [3.5, 5.4, 20],
      lookAt: [0.1, 3.7, 10.9],
    },
    {
      name: 'raised-drum-closed-meridian-shutter-and-iron-hemisphere',
      position: [10, 13.8, 16],
      lookAt: [0, 10.6, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed easternentranceapproach[-21,0]predates independent currentterrain acquisition; no1880grade survey or exact hostfooting fit claimed.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-berlin-observatory.mjs',
    level: 'skyline',
    export: 'berlinObservatorySkyline',
    errorMeters: 0.32,
    surfaces,
    authoredLevels: {
      district: { export: 'berlinObservatoryDistrict', errorMeters: 0.14, surfaces },
      street: { export: 'berlinObservatoryStreet', errorMeters: 0.04, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical1880only: official1879plan/elevation published1880control this dated reconstruction. Exact buildingQ73494076declares demolition1913-08. Supported1880-01-01to1881-01-01appearance interval is deliberately limited to the plate publicationyear, not the whole1835-1913life. Default current world excludes the asset; date opt-in required. Earlier royalstables observatory and surviving Babelsberg successor excluded.',
    'Printed20mbar/northarrow control original hand-traced30.07mx22.40mcross-plan; currentstreet/parcel is never extruded. Interiorhatchedinstrumentpiers, surveyrodmarkersA/B, people/trees/park and nearbybuildings are absent. Footprintdomecentre is only provisionally registered to the rounded former-site coordinate; exact historical building registration and terrain attachment are unverified.',
    'Original medium-fi exterior from two native inspected publishedQualla official1880plates. NativeSHA1/primaryPD-olddeclarations are pinned; omittedoriginalPDcategories restored from exactprimaryrecords. One unrelated Earthrise gallery record was repaired to its native-verifiedexistingQuallacanonicalfile, preserving the correctplanhero and allstorytext. No outsideimage, generatedbitmap, copiedphototexture or otherlicensedsource used.',
    'Central7.5mdiameter is storydocumented; section heights/storey levels, rooflead/plaster/stonecolors, concealed facades/windows and exact shutter mechanism are drawing-based estimates. North elevation controls benchmarkframe/tallupper sash/chamferedbay/cornice/drum/hemisphere. Story records east templefront/Apollochariot; unseen pilaster/windowcensus and originalshallowrelief are bounded interpretations, not a measuredfront elevation/sculpture scan. Lettering omitted.',
    'Benchmark/closedtransit shutters/windows are modeled exterior surfaces, not accessible interiors; slat/relief/rib detail retireswithdistance. Current120mraw independent providerterrain was frozenbeforegeometry and is not flattened/fitted or an1880grade survey. Foundationextends.35mbelow approximate approachdatum; flatstageY-.53showsarchitecture, not certified historical ground contact.',
  ],
};
