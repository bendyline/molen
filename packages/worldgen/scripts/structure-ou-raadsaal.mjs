/** Whole Ou Raadsaal: native courtyard building and its three-capped, clock-topped portico. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ke/kek/ou_raadsaal/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  tau = Math.PI * 2,
  C = {
    wall: rgb('bc8f66'),
    trim: rgb('d3b58a'),
    roof: rgb('d3dad5'),
    glass: rgb('35454d'),
    metal: rgb('726957'),
    clock: rgb('e3dcc3'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.42, metallic: 0.05 },
    metal: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.8, metallic: 0.2 },
    clock: { slot: 'trim', localRef: ref, roughness: 0.94, metallic: 0 },
  },
  core = [p.outline[0], p.outline[1], ...p.outline.slice(4)],
  portico = [p.outline[2], p.outline[3], p.outline[4], p.outline[1]],
  x0 = p.outline[0][0],
  x1 = p.outline[6][0],
  front = (p.outline[0][1] + p.outline[6][1]) / 2,
  px0 = p.outline[2][0],
  px1 = p.outline[3][0],
  pcx = (px0 + px1) / 2;
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(
    q[1].map((v, i) => v - q[0][i]),
    q[2].map((v, i) => v - q[0][i]),
  );
  if (Math.hypot(...c) < 1e-8) return;
  if (n && c.reduce((a, v, i) => a + v * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  const nn = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    nn,
    q.map((v) => (Math.abs(nn[1]) > 0.7 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, rings, y, up = true) {
  const pts = rings.flat(),
    holes = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((a, r) => a + r.length, 0)),
    ix = earcut(pts.flat(), holes);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [pts[k][0], y, pts[k][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, s, r, y0, y1) {
  cap(o, s, [r], y0, false);
  cap(o, s, [r], y1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(o, s, [
      [a[0], y0, a[1]],
      [b[0], y0, b[1]],
      [b[0], y1, b[1]],
      [a[0], y1, a[1]],
    ]);
  }
}
function box(o, s, x, y, z, w, h, l) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  prism(o, s, r, y, y + h);
}
function frame(a, b, inward = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = inward ? [-u[1], u[0]] : [u[1], -u[0]];
  return {
    len,
    n: [n[0], 0, n[1]],
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z],
  };
}
const area = (r) =>
    r.reduce((s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  ccw = (r) => (area(r) > 0 ? r : [...r].reverse());
function strip(o, s, f, x, y, w, h, z = 0) {
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
function rail(o, f, y, d, start = 0, end = f.len) {
  if (d < 2) {
    strip(o, 'trim', f, (start + end) / 2, y, end - start, 0.32, 0.2);
    return;
  }
  beam(o, 'trim', f.P(start, y + 0.7, 0.15), f.P(end, y + 0.7, 0.15), 0.18, 0.2, C.trim);
  const count = Math.max(2, Math.floor((end - start) / (d === 3 ? 0.63 : 1.1)));
  for (let i = 0; i <= count; i++) {
    const x = start + ((end - start) * i) / count;
    beam(
      o,
      'trim',
      f.P(x, y, 0.15),
      f.P(x, y + 0.65, 0.15),
      d === 3 ? 0.16 : 0.2,
      d === 3 ? 0.2 : 0.2,
      C.trim,
    );
  }
}
function hole(x, y, w, h, steps, arched) {
  const r = w / 2,
    spring = y + h - r;
  return arched
    ? [
        [x - r, y],
        [x + r, y],
        ...Array.from({ length: steps + 1 }, (_, i) => {
          const a = (i / steps) * Math.PI;
          return [x + r * Math.cos(a), spring + r * Math.sin(a)];
        }),
      ]
    : [
        [x - w / 2, y],
        [x + w / 2, y],
        [x + w / 2, y + h],
        [x - w / 2, y + h],
      ];
}
function wall(o, f, count, d, courtyard = false) {
  const windows = [],
    frontFace = f.n[2] < -0.8 && !courtyard,
    rows = d === 0 ? (frontFace ? [1.2, 7.3, 13.4] : [7.3]) : [1.2, 7.3, 13.4],
    w = Math.min(1.65, (f.len / count) * 0.57),
    h = 4.1;
  if (d < 2) Q(o, 'wall', [f.P(0, 0), f.P(f.len, 0), f.P(f.len, 18.5), f.P(0, 18.5)], f.n);
  for (let i = 0; i < count; i++)
    for (const y of rows) {
      const x = ((i + 0.5) * f.len) / count,
        r = hole(x, y, w, h, [3, 3, 4, 8][d], y < 2);
      windows.push(r);
      if (d < 2) {
        const ix = earcut(r.flat());
        for (let j = 0; j < ix.length; j += 3)
          T(
            o,
            'glass',
            ix.slice(j, j + 3).map((k) => f.P(...r[k], 0.015)),
            f.n,
          );
      } else {
        const ix = earcut(r.flat());
        for (let j = 0; j < ix.length; j += 3)
          T(
            o,
            'glass',
            ix.slice(j, j + 3).map((k) => f.P(...r[k], -0.42)),
            f.n,
          );
        for (let j = 0; j < r.length; j++) {
          const a = r[j],
            b = r[(j + 1) % r.length];
          Q(o, 'trim', [f.P(...a), f.P(...b), f.P(...b, -0.42), f.P(...a, -0.42)]);
        }
      }
      if (d > 1 || (d === 1 && frontFace)) {
        strip(o, 'trim', f, x, y - 0.18, w + 0.36, 0.18, 0.06);
        strip(o, 'trim', f, x - w / 2 - 0.1, y, 0.12, h, 0.06);
        strip(o, 'trim', f, x + w / 2 + 0.1, y, 0.12, h, 0.06);
        if (y > 2) {
          strip(o, 'trim', f, x, y + h, w + 0.4, 0.18, 0.08);
          if (frontFace) {
            const roof = [
              f.P(x - w * 0.75, y + h + 0.15, 0.12),
              f.P(x, y + h + 0.8, 0.12),
              f.P(x + w * 0.75, y + h + 0.15, 0.12),
            ];
            T(o, 'trim', roof, f.n);
          }
        }
      }
      if (d >= 2) {
        strip(o, 'metal', f, x, y, 0.07, h, -0.35);
        strip(o, 'metal', f, x, y + h * 0.62, w, 0.07, -0.35);
        if (d === 3)
          for (const q of [-1 / 6, 1 / 6]) strip(o, 'metal', f, x + q * w, y, 0.035, h, -0.34);
      }
    }
  if (d >= 2) {
    const outline = [
        [0, 0],
        [f.len, 0],
        [f.len, 18.5],
        [0, 18.5],
      ],
      pts = [outline, ...windows].flat(),
      holes = windows.map((_, i) => 4 + windows.slice(0, i).reduce((s, r) => s + r.length, 0)),
      ix = earcut(pts.flat(), holes);
    for (let i = 0; i < ix.length; i += 3)
      T(
        o,
        'wall',
        ix.slice(i, i + 3).map((k) => f.P(...pts[k])),
        f.n,
      );
  }
  if (d > 0 && !courtyard)
    for (const y of [0.45, 6.1, 12.2, 18.2]) {
      strip(o, 'trim', f, f.len / 2, y, f.len, 0.28, 0.18);
      if (d >= 2)
        Q(
          o,
          'trim',
          [
            f.P(0, y + 0.28),
            f.P(f.len, y + 0.28),
            f.P(f.len, y + 0.28, 0.35),
            f.P(0, y + 0.28, 0.35),
          ],
          [0, 1, 0],
        );
    }
  if (d > 1 && frontFace) rail(o, f, 18.55, d);
}
function body(o, d) {
  cap(o, 'wall', [core, ...p.holes], 0.02, false);
  cap(o, 'roof', [core, ...p.holes], 18.55);
  for (const [r, inward] of [[core, false], ...p.holes.map((r) => [r, true])]) {
    const ring = ccw(r);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        f = frame(a, b, inward);
      if (f.len < 0.5) {
        Q(o, 'wall', [f.P(0, 0), f.P(f.len, 0), f.P(f.len, 18.5), f.P(0, 18.5)], f.n);
        continue;
      }
      const count = Math.max(
        1,
        Math.floor(
          f.len / (d === 0 ? 8 : d === 1 && (inward || f.n[2] > -0.8) ? 6 : inward ? 4.5 : 3.5),
        ),
      );
      wall(o, f, count, d, inward);
    }
  }
  // Exact original projected-portico footprint, physically open above its intrinsic threshold.
  prism(o, 'trim', portico, 0, 0.25);
}
function column(o, x, z, y, h, d) {
  const n = [4, 6, 10, 14][d],
    profile =
      d === 0
        ? [
            [y, 0.29],
            [y + h, 0.29],
          ]
        : [
            [y, 0.49],
            [y + 0.28, 0.49],
            [y + 0.4, 0.31],
            [y + h - 0.48, 0.27],
            [y + h - 0.4, 0.48],
            [y + h, 0.5],
          ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * tau,
        b = ((i + 1) / n) * tau,
        [y0, r0] = profile[j - 1],
        [y1, r1] = profile[j];
      Q(o, 'trim', [
        [x + r0 * Math.cos(a), y0, z + r0 * Math.sin(a)],
        [x + r0 * Math.cos(b), y0, z + r0 * Math.sin(b)],
        [x + r1 * Math.cos(b), y1, z + r1 * Math.sin(b)],
        [x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a)],
      ]);
    }
  if (d === 3)
    for (const side of [-1, 1])
      sphere(o, 'trim', [x + side * 0.3, y + h - 0.25, z - 0.22], [0.15, 0.13, 0.12], C.trim, 6, 4);
}
function porticoFront(o, d) {
  const len = px1 - px0,
    f = frame([px0, 0], [px1, 0]),
    columns = d === 0 ? [-0.43, 0.43] : [-0.43, -0.145, 0.145, 0.43];
  for (let level = 0; level < 3; level++) {
    const y = level * 6.1 + 0.3;
    for (const q of columns) column(o, pcx + q * len, 0.65, y, 5.45, d);
    prism(o, 'trim', portico, y + 5.45, y + 5.83);
    if (level < 2 && d > 0) rail(o, f, y + 5.85, d, 0.4, len - 0.4);
  }
  // Native portico width controls the pediment, with a bounded sculptural shield relief.
  const g = [
    [pcx - len * 0.56, 18.7, 0.1],
    [pcx, 21.2, 0.1],
    [pcx + len * 0.56, 18.7, 0.1],
  ];
  T(o, 'wall', g, [0, 0, -1]);
  if (d > 0) {
    beam(o, 'trim', g[0], g[1], 0.27, 0.28, C.trim);
    beam(o, 'trim', g[1], g[2], 0.27, 0.28, C.trim);
    beam(o, 'trim', g[2], g[0], 0.25, 0.28, C.trim);
  }
  if (d >= 2) {
    sphere(o, 'trim', [pcx, 19.65, -0.04], [0.56, 0.73, 0.15], C.trim, 12, 8);
    for (const s of [-1, 1])
      beam(o, 'trim', [pcx + s * 0.7, 19.3, -0.04], [pcx + s * 3.7, 19.1, -0.04], 0.2, 0.2, C.trim);
  }
}
function mansard(o, x, z, y, w, l, h, d) {
  const n = [8, 12, 24, 40][d],
    profile =
      d === 0
        ? [
            [0, 1],
            [h * 0.7, 0.84],
            [h, 0.55],
          ]
        : [
            [0, 1.02],
            [h * 0.15, 1],
            [h * 0.55, 0.91],
            [h * 0.85, 0.74],
            [h, 0.53],
          ],
    point = (a, s, yy) => {
      const c = Math.cos(a),
        v = Math.sin(a);
      return [
        x + ((Math.sign(c) * Math.sqrt(Math.abs(c)) * w) / 2) * s,
        y + yy,
        z + ((Math.sign(v) * Math.sqrt(Math.abs(v)) * l) / 2) * s,
      ];
    };
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * tau,
        b = ((i + 1) / n) * tau,
        [y0, s0] = profile[j - 1],
        [y1, s1] = profile[j];
      Q(o, 'roof', [point(a, s0, y0), point(b, s0, y0), point(b, s1, y1), point(a, s1, y1)]);
    }
  cap(
    o,
    'roof',
    [
      Array.from({ length: n }, (_, i) => {
        const q = point((i / n) * tau, profile.at(-1)[1], h);
        return [q[0], q[2]];
      }),
    ],
    y + h,
  );
  if (d > 0) {
    box(o, 'trim', x, y - 0.25, z, w + 1, 0.25, l + 1);
    for (const sx of d === 1 ? [0] : [-0.29, 0, 0.29]) {
      const xx = x + sx * w,
        zz = z - l * 0.47,
        f = frame([xx - 0.55, zz], [xx + 0.55, zz]);
      strip(o, 'trim', f, 0.55, y + h * 0.22, 1.1, 1.05, 0.02);
      strip(o, 'glass', f, 0.55, y + h * 0.32, 0.54, 0.52, 0.04);
    }
  }
}
function clock(o, x, z, y, d) {
  const n = [6, 8, 16, 24][d],
    r = 0.76;
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const normal = [Math.sin(a), 0, Math.cos(a)],
      u = [Math.cos(a), 0, -Math.sin(a)],
      c = [x + normal[0] * 1.18, y, z + normal[2] * 1.18],
      P = (v, w) => [c[0] + u[0] * v, c[1] + w, c[2] + u[2] * v];
    for (let i = 0; i < n; i++)
      T(
        o,
        'clock',
        [
          P(0, 0),
          P(Math.cos((i / n) * tau) * r, Math.sin((i / n) * tau) * r),
          P(Math.cos(((i + 1) / n) * tau) * r, Math.sin(((i + 1) / n) * tau) * r),
        ],
        normal,
      );
    if (d > 0) {
      for (let i = 0; i < 12; i++) {
        const t = (i / 12) * tau;
        beam(
          o,
          'metal',
          P(Math.sin(t) * r * 0.73, Math.cos(t) * r * 0.73),
          P(Math.sin(t) * r * 0.91, Math.cos(t) * r * 0.91),
          0.035,
          0.035,
          C.metal,
        );
      }
      beam(o, 'metal', P(0, 0), P(0.44, 0.36), 0.045, 0.045, C.metal);
      beam(o, 'metal', P(0, 0), P(-0.25, 0.32), 0.06, 0.06, C.metal);
    }
  }
}
function tower(o, d) {
  const x = pcx,
    z = 4.9;
  box(o, 'trim', x, 25.5, z, 4.3, 0.55, 4.3);
  if (d === 0) box(o, 'trim', x, 26, z, 2.5, 4.4, 2.5);
  else {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) column(o, x + sx * 1.22, z + sz * 1.22, 26, 4, d);
    box(o, 'trim', x, 30, z, 3.5, 0.45, 3.5);
  }
  clock(o, x, z, 28.3, d);
  mansard(o, x, z, 30.5, 3.4, 3.4, 2.0, d);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      if (d === 0 && sz === 1) continue;
      beam(
        o,
        'trim',
        [x + sx * 0.6, 32.5, z + sz * 0.6],
        [x + sx * 0.6, 34.3, z + sz * 0.6],
        0.17,
        0.17,
        C.trim,
      );
    }
  box(o, 'trim', x, 34.3, z, 1.8, 0.35, 1.8);
  // Original small allegorical architectural silhouette. Facial/drapery carving is not digitized.
  sphere(
    o,
    'metal',
    [x, 34.95, z],
    [0.38, 0.38, 0.38],
    C.metal,
    [5, 6, 10, 14][d],
    [3, 4, 6, 8][d],
  );
  const profile = [
      [35.2, 0.35],
      [35.55, 0.42],
      [36.4, 0.28],
      [36.85, 0.3],
    ],
    n = [4, 6, 10, 14][d];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * tau,
        b = ((i + 1) / n) * tau,
        [y0, r0] = profile[j - 1],
        [y1, r1] = profile[j];
      Q(o, 'metal', [
        [x + r0 * Math.cos(a), y0, z + r0 * Math.sin(a)],
        [x + r0 * Math.cos(b), y0, z + r0 * Math.sin(b)],
        [x + r1 * Math.cos(b), y1, z + r1 * Math.sin(b)],
        [x + r1 * Math.cos(a), y1, z + r1 * Math.sin(a)],
      ]);
    }
  sphere(o, 'metal', [x, 37.1, z], [0.2, 0.26, 0.21], C.metal, [5, 6, 10, 14][d], [3, 4, 6, 8][d]);
  beam(o, 'metal', [x - 0.25, 36.6, z], [x - 0.65, 37.25, z - 0.05], 0.18, 0.18, C.metal);
  beam(o, 'metal', [x + 0.2, 36.6, z], [x + 0.5, 35.9, z], 0.16, 0.16, C.metal);
  T(
    o,
    'metal',
    [
      [x - 0.67, 37.15, z],
      [x - 0.67, 38, z],
      [x - 0.95, 37.5, z],
    ],
    [0, 0, -1],
  );
}
function build(o, _f, d = 3) {
  body(o, d);
  porticoFront(o, d);
  const endWidth = 7.6,
    endZ = front + 4.3;
  for (const x of [x0 + endWidth / 2, x1 - endWidth / 2]) {
    box(o, 'wall', x, 18.5, endZ, endWidth, 0.6, 8.8);
    mansard(o, x, endZ, 19.1, endWidth + 1, 8.8, 3.3, d);
  }
  box(o, 'wall', pcx, 18.5, 5.5, 13, 0.8, 10.7);
  mansard(o, pcx, 5.5, 19.3, 13.8, 11, 6.2, d);
  tower(o, d);
}
export const raadsaalSkyline = (o, f) => build(o, f, 0);
export const raadsaalDistrict = (o, f) => build(o, f, 1);
export const raadsaalStreet = (o, f) => build(o, f, 2);
export const raadsaalCloseup = (o, f) => build(o, f, 3);
export const raadsaalModel = {
  id: 'ou_raadsaal',
  key: 'ou_raadsaal',
  cell: 'ke/kek',
  recipe: 'structure-ou-raadsaal.mjs',
  title: 'Ou Raadsaal, Pretoria',
  category: 'civic',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [110, 85, -135],
  lookAt: [1, 15, 24],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 3, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-native-building-three-domedcaps-clock-and-courtyards',
      position: [100, 98, -100],
      lookAt: [0, 12, 25],
      reviewLod: 'skyline',
    },
    {
      name: 'northfront-three-tier-portico-mansard-and-clock-lantern',
      position: [-20, 31, -75],
      lookAt: [1, 17, 3],
    },
    {
      name: 'all-three-native-courtyards-and-whole-rear-envelope',
      position: [-75, 115, 105],
      lookAt: [0, 12, 40],
    },
    {
      name: 'central-portico-recesses-open-colonnade-and-pediment',
      position: [22, 20, -35],
      lookAt: [0, 10, 3],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent400mfield frozen before geometry; actual norththreshold/street/courtyard grade/compatiblehostcontact preview-only.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-ou-raadsaal.mjs',
    level: 'skyline',
    export: 'raadsaalSkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'raadsaalDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'raadsaalStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'raadsaalCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Whole surviving namedOuRaadsaal, not ChurchSquareplaza or PalaceofJustice. Complete original outer13vertices/three4+6+10vertexcourtyard holes retained, open native frontportico footprint. Principal3storey18.5mbody/38mapex, three roundedmansardcaps/centralclockcupola/lantern/allegoricalsilhouette, porticocolumns/pediment/balconies and repeated facadebays are photographic estimates. Native mapping fixes complete geometry in plan; rear/courtyard/roof heights/sections and detailed fenestration/ornament census are not surveyed.',
    'Qualla-first39publishedfamilies checked. One exact4823x3215namedlumoplankcreatorCC0original inspected/nativeSHA1matched; primary Flickrphoto54445014179/immutableNSID199350666@N08/CC0dedication bound. Original caption erroneously names PalaceofJustice; actual centralclock/three-cappedOuRaadsaal identity independently tied to named native southside building and municipal heritage text. No sibling/upstream metadata edited and no uncertain grant adopted. No attributionphoto/agencyimage/diagram/phototexture/generatedbitmap/downloadedmesh.',
    'Detailed levels have true window recesses/glassbackings and physically open colonnaded portico/courtyards/clocklantern; skyline/district simplify windows into flat architectural cues and the skyline clockbody is solid. Capitals/cornice/roof dormers/balustrade/sculpture silhouette and clock hands are original bounded medium-fi interpretations, not exact artist-carving digitization or currentmechanismstate.',
    'The sourcephoto foreground retainingwall/underpass belongs to the square and is excluded. PalaceofJustice/twin corner towers, centralKrugermonument, GPO/OldCapitol/adjacentblocks and streets/plaza/plantings/people/vehicles/flags/post props are separate unrepresented story structures; this asset does not claim to complete the entire square. No whole-site base or roominteriors.',
    'Independent400m129x129field/16641values frozen at native northapproach before geometry, original source values/raw tilebytes unchanged. CompositeurbanDEMmay include building/vegetation returns and is not surveyed threshold/groundheight. Portable/shared/context use separate flatreviewstage; actual approach/footing/courtyard/hostterrain contact remains approximate geographicpreview/replaceFootprint=false.',
  ],
};
