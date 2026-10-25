/** Whole mapped Homs mosque: basalt hall, silver dome group and twin minarets. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sy/sy4/khalid_ibn_al_walid_mosque/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  c = Math.cos(A.workingHeading),
  s = Math.sin(A.workingHeading),
  world = (q) => [c * q[0] - s * q[2], q[1], s * q[0] + c * q[2]],
  local = (q) => [c * q[0] + s * q[1], -s * q[0] + c * q[1]],
  P = p.outline.slice(0, -1).map(local),
  ref = 'palette:#ffffff',
  C = {
    basalt: rgb('545750'),
    stone: rgb('c9c5ad'),
    roof: rgb('c1c7c5'),
    glass: rgb('314642'),
    wood: rgb('796042'),
  },
  surfaces = {
    basalt: { slot: 'wall', graph: 'stone_basalt', roughness: 0.97, metallic: 0 },
    stone: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.22 },
    glass: { slot: 'window', localRef: ref, roughness: 0.84, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((q, v, i) => q + v * b[i], 0);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = world(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, y, up = true, col = C[k]) {
  const ids = earcut(R.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [R[j][0], y, R[j][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, k, R, y0, y1, col = C[k]) {
  const m = R.reduce((q, v) => q.map((a, i) => a + v[i] / R.length), [0, 0]);
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    if (dot(n, [(a[0] + b[0]) / 2 - m[0], 0, (a[1] + b[1]) / 2 - m[1]]) < 0)
      n.forEach((v, i) => {
        n[i] = -v;
      });
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
      col,
    );
  }
  flat(o, k, R, y0, false, col);
  flat(o, k, R, y1, true, col);
}
function box(o, k, x, y, z, w, h, dep, col = C[k]) {
  prism(
    o,
    k,
    [
      [x - w / 2, z - dep / 2],
      [x + w / 2, z - dep / 2],
      [x + w / 2, z + dep / 2],
      [x - w / 2, z + dep / 2],
    ],
    y - h / 2,
    y + h / 2,
    col,
  );
}
function revolve(o, k, x, z, profile, n, col = C[k], angle = 0, span = 2 * Math.PI) {
  for (let j = 0; j < profile.length - 1; j++) {
    const [a, r] = profile[j],
      [b, R] = profile[j + 1];
    for (let i = 0; i < n; i++) {
      const t = angle + (span * i) / n,
        u = angle + (span * (i + 1)) / n,
        v = (h, r, t) => [x + r * Math.cos(t), F + h, z + r * Math.sin(t)],
        N = [Math.cos((t + u) / 2), 0, Math.sin((t + u) / 2)];
      Q(o, k, [v(a, r, t), v(a, r, u), v(b, R, u), v(b, R, t)], N, col);
    }
  }
}
function dome(o, x, z, r, y, h, d, { angle = 0, span = 2 * Math.PI, finial = true } = {}) {
  const n = [8, 10, 20, 32][d],
    rings = [2, 3, 6, 10][d],
    profile = Array.from({ length: rings + 1 }, (_, i) => [
      y + h * Math.sin((i * Math.PI) / 2 / rings),
      r * Math.cos((i * Math.PI) / 2 / rings),
    ]);
  revolve(o, 'roof', x, z, profile, n, C.roof, angle, span);
  if (finial && d > 0 && (d > 1 || r > 7)) {
    revolve(
      o,
      'stone',
      x,
      z,
      [
        [y + h, 0.12],
        [y + h + 0.3, 0.23],
        [y + h + 0.55, 0.1],
        [y + h + 0.9, 0],
      ],
      d > 1 ? 8 : 6,
    );
  }
}
function circle(x, z, r, n) {
  return Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / n),
    z + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
}
const faces = P.map((a, i) => {
  const b = P[(i + 1) % P.length],
    len = Math.hypot(...sub(b, a)),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], 0, -u[0]];
  if (dot(n, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]) < 0)
    n.forEach((v, i) => {
      n[i] = -v;
    });
  return {
    len,
    u,
    n,
    point: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, F + y, a[1] + u[1] * x + n[2] * z],
  };
});
function archPoly(x, w, lo, hi, N) {
  const spring = hi - w * 0.25;
  return [
    [x - w / 2, lo],
    [x + w / 2, lo],
    ...Array.from({ length: N + 1 }, (_, i) => {
      const t = (i * Math.PI) / N;
      return [x + (w / 2) * Math.cos(t), spring + (hi - spring) * Math.sin(t)];
    }),
  ];
}
function facePoly(o, k, f, R, z = 0, col = C[k]) {
  const ids = earcut(R.flat());
  for (let j = 0; j < ids.length; j += 3)
    T(
      o,
      k,
      ids.slice(j, j + 3).map((i) => f.point(R[i][0], R[i][1], z)),
      f.n,
      col,
    );
}
function trim(o, f, R, depth, d) {
  const center = R.reduce((a, p) => a.map((v, i) => v + p[i] / R.length), [0, 0]),
    outside = R.map((q) => [
      center[0] + (q[0] - center[0]) * 1.22,
      center[1] + (q[1] - center[1]) * 1.1,
    ]);
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length;
    Q(
      o,
      'stone',
      [
        f.point(...outside[i], 0.035),
        f.point(...outside[j], 0.035),
        f.point(...R[j], 0.035),
        f.point(...R[i], 0.035),
      ],
      f.n,
    );
    Q(
      o,
      'stone',
      [
        f.point(...R[i], 0),
        f.point(...R[j], 0),
        f.point(...R[j], -depth),
        f.point(...R[i], -depth),
      ],
      [0, 1, 0],
    );
  }
  if (d > 1) {
    const x = center[0],
      bottom = Math.min(...R.map((q) => q[1])),
      top = Math.max(...R.map((q) => q[1]));
    Q(
      o,
      'roof',
      [
        f.point(x - 0.025, bottom, -depth + 0.035),
        f.point(x + 0.025, bottom, -depth + 0.035),
        f.point(x + 0.025, top - 0.12, -depth + 0.035),
        f.point(x - 0.025, top - 0.12, -depth + 0.035),
      ],
      f.n,
    );
  }
}
function walls(o, d) {
  for (const [fi, f] of faces.entries()) {
    const holes = [],
      N = [2, 2, 8, 12][d];
    if (d > 0) {
      const count = fi % 2 === 0 ? 5 : 4;
      for (const [lo, hi] of [A.windowLower, A.windowUpper])
        for (let i = 0; i < count; i++)
          holes.push({
            R: archPoly((f.len * (i + 1)) / (count + 1), A.windowWidth, lo, hi, N),
            slot: fi === 0 && lo === A.windowLower[0] ? 'wood' : 'glass',
          });
    }
    const border = [
        [0, 0],
        [f.len, 0],
        [f.len, A.bodyTop],
        [0, A.bodyTop],
      ],
      all = border.concat(...holes.map((h) => h.R)),
      indices = holes.map((_h, i) => 4 + holes.slice(0, i).reduce((s, h) => s + h.R.length, 0)),
      ids = earcut(all.flat(), indices);
    for (let j = 0; j < ids.length; j += 3)
      T(
        o,
        'basalt',
        ids.slice(j, j + 3).map((i) => f.point(...all[i])),
        f.n,
      );
    for (const h of holes) {
      facePoly(o, h.slot, f, h.R, -A.recessDepth);
      trim(o, f, h.R, A.recessDepth, d);
    }
    for (const y of [A.bodyTop - 0.45, A.bodyTop]) {
      const a = f.point(0, y, 0.035),
        b = f.point(f.len, y, 0.035);
      Q(o, 'stone', [a, b, f.point(f.len, y + 0.18, 0.035), f.point(0, y + 0.18, 0.035)], f.n);
    }
    if (d > 0)
      for (const x of [0, f.len]) {
        for (let y = 0.4; y < A.bodyTop - 0.6; y += 0.7) {
          const width = Math.min(0.48, f.len * 0.04);
          Q(
            o,
            'stone',
            [
              f.point(Math.max(0, x - width), y, 0.045),
              f.point(Math.min(f.len, x + width), y, 0.045),
              f.point(Math.min(f.len, x + width), y + 0.34, 0.045),
              f.point(Math.max(0, x - width), y + 0.34, 0.045),
            ],
            f.n,
          );
        }
      }
  }
  flat(o, 'basalt', P, F, false);
  flat(o, 'stone', P, F + A.bodyTop);
}
function minaret(o, q, d) {
  const [x, z] = q,
    n = [6, 10, 16, 24][d];
  box(o, 'stone', x, F + 2.9, z, 3.3, 5.8, 3.3);
  revolve(
    o,
    'stone',
    x,
    z,
    [
      [5.8, 1.5],
      [8, 1.45],
      [22.1, 1.38],
      [A.minaretGalleryBase, 1.95],
      [A.minaretGalleryTop, 1.95],
      [A.minaretGalleryTop, 1.02],
      [A.minaretShaftTop, 1.02],
      [33.1, 1.27],
      [34.8, 1.15],
      [36.3, 0.45],
      [A.minaretCapTop, 0.18],
      [A.minaretFinialTop, 0],
    ],
    n,
  );
  if (d > 0) {
    for (let y = 6.1; y < 22; y += d === 1 ? 5 : 1.25)
      revolve(
        o,
        'basalt',
        x,
        z,
        [
          [y, 1.47],
          [y + 0.22, 1.47],
        ],
        n,
        C.basalt,
      );
    const railY = A.minaretGalleryTop + 0.85;
    revolve(
      o,
      'roof',
      x,
      z,
      [
        [railY, 2],
        [railY + 0.1, 2],
      ],
      n,
    );
    for (let i = 0; i < n; i++) {
      const t = (i * 2 * Math.PI) / n;
      box(
        o,
        'roof',
        x + 2 * Math.cos(t),
        F + A.minaretGalleryTop + 0.45,
        z + 2 * Math.sin(t),
        0.075,
        0.9,
        0.075,
      );
    }
    for (const y of [12, 19, 28.5])
      for (const t of [0, Math.PI]) {
        const dx = Math.cos(t),
          dz = Math.sin(t),
          u = [-dz, dx],
          r = y > 25 ? 1.035 : 1.475,
          w = 0.22,
          h = 0.8;
        Q(
          o,
          'glass',
          [
            [x + dx * r - u[0] * w, F + y, z + dz * r - u[1] * w],
            [x + dx * r + u[0] * w, F + y, z + dz * r + u[1] * w],
            [x + dx * r + u[0] * w, F + y + h, z + dz * r + u[1] * w],
            [x + dx * r - u[0] * w, F + y + h, z + dz * r - u[1] * w],
          ],
          [dx, 0, dz],
        );
      }
  }
}
function arcade(o, { start, end, bays, depth = 3.8 }, d) {
  const v = sub(end, start),
    len = Math.hypot(...v),
    u = v.map((q) => q / len),
    n = [u[1], -u[0]],
    at = (x, y, z) => [start[0] + u[0] * x + n[0] * z, F + y, start[1] + u[1] * x + n[1] * z],
    N = [2, 4, 8, 12][d],
    bay = len / bays,
    w = bay - 0.7,
    top = A.arcadeTop,
    spring = A.arcadeSpring;
  for (let i = 0; i <= bays; i++) {
    const x = i * bay;
    const R = [
      [x - 0.3, -depth / 2],
      [x + 0.3, -depth / 2],
      [x + 0.3, depth / 2],
      [x - 0.3, depth / 2],
    ].map(([a, b]) => [at(a, 0, b)[0], at(a, 0, b)[2]]);
    if (d === 0) {
      for (let k = 0; k < 4; k++) {
        const a = R[k],
          b = R[(k + 1) % 4];
        Q(
          o,
          'stone',
          [
            [a[0], F, a[1]],
            [b[0], F, b[1]],
            [b[0], F + spring, b[1]],
            [a[0], F + spring, a[1]],
          ],
          [b[1] - a[1], 0, a[0] - b[0]],
        );
      }
    } else prism(o, 'stone', R, F, F + spring);
  }
  for (let i = 0; i < bays; i++) {
    const x = bay * (i + 0.5);
    for (let j = 0; j < N; j++) {
      const t0 = Math.PI - (j * Math.PI) / N,
        t1 = Math.PI - ((j + 1) * Math.PI) / N,
        a = x + (w / 2) * Math.cos(t0),
        b = x + (w / 2) * Math.cos(t1),
        ya = spring + 1.5 * Math.sin(t0),
        yb = spring + 1.5 * Math.sin(t1);
      for (const sg of [-1, 1])
        Q(
          o,
          j % 2 ? 'stone' : 'basalt',
          [
            at(a, ya, (sg * depth) / 2),
            at(b, yb, (sg * depth) / 2),
            at(b, top, (sg * depth) / 2),
            at(a, top, (sg * depth) / 2),
          ],
          [n[0] * sg, 0, n[1] * sg],
        );
      if (d > 0)
        Q(
          o,
          'stone',
          [
            at(a, ya, -depth / 2),
            at(b, yb, -depth / 2),
            at(b, yb, depth / 2),
            at(a, ya, depth / 2),
          ],
          [0, -1, 0],
        );
    }
  }
  const R = [
    at(-0.3, 0, -depth / 2),
    at(len + 0.3, 0, -depth / 2),
    at(len + 0.3, 0, depth / 2),
    at(-0.3, 0, depth / 2),
  ].map((q) => [q[0], q[2]]);
  prism(o, 'stone', R, F + top, F + top + 0.28);
  if (d > 1) {
    for (let i = 0; i <= bays; i++)
      for (const sg of [-1, 1]) {
        const k = at(i * bay, top + 0.52, (sg * depth) / 2);
        box(o, 'stone', k[0], k[1], k[2], 0.3, 0.48, 0.3);
      }
  }
}
function build(o, _f, d = 3) {
  walls(o, d);
  const minarets = p.minaretControls.map(local);
  for (const q of minarets) minaret(o, q, d);
  box(o, 'stone', 0, F + 14.1, 0, 16.6, 6.6, 16.6);
  revolve(
    o,
    'stone',
    0,
    0,
    [
      [A.drumBase, A.centralDomeRadius],
      [A.drumTop, A.centralDomeRadius],
    ],
    [8, 12, 20, 32][d],
  );
  dome(o, 0, 0, A.centralDomeRadius, A.drumTop, A.centralDomeRise, d);
  for (const [x, z, angle] of [
    [0, -8.1, Math.PI],
    [8.1, 0, -Math.PI / 2],
    [0, 8.1, 0],
    [-8.1, 0, Math.PI / 2],
  ]) {
    if (d > 0)
      revolve(
        o,
        'stone',
        x,
        z,
        [
          [A.bodyTop, A.semiDomeRadius],
          [A.semiDomeBase, A.semiDomeRadius],
        ],
        [8, 10, 20, 32][d],
        C.stone,
        angle,
        Math.PI,
      );
    dome(
      o,
      x,
      z,
      A.semiDomeRadius,
      d ? A.semiDomeBase : A.bodyTop,
      A.semiDomeRise + (d ? 0 : A.semiDomeBase - A.bodyTop),
      d,
      { angle, span: Math.PI, finial: false },
    );
  }
  for (const x of [-12.65, 12.65])
    for (const z of [-11.55, 11.55]) {
      revolve(
        o,
        'stone',
        x,
        z,
        [
          [A.bodyTop, 4.2],
          [A.cornerDomeBase, 4.2],
        ],
        [6, 8, 12, 20][d],
      );
      dome(o, x, z, A.cornerDomeRadius, A.cornerDomeBase, A.cornerDomeRise, d);
    }
  if (d > 0) {
    const n = [0, 8, 12, 16][d];
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) * 2 * Math.PI) / n,
        r = A.centralDomeRadius + 0.02,
        q = [r * Math.cos(t), r * Math.sin(t)],
        tangent = [-Math.sin(t), Math.cos(t)],
        f = {
          n: [Math.cos(t), 0, Math.sin(t)],
          point: (x, y, z = 0) => [
            q[0] + tangent[0] * x + Math.cos(t) * z,
            F + y,
            q[1] + tangent[1] * x + Math.sin(t) * z,
          ],
        };
      facePoly(o, 'glass', f, archPoly(0, 0.7, A.drumBase + 0.35, A.drumTop - 0.2, 4), 0.015);
    }
  }
  arcade(o, { start: [-17, -18.6], end: [17, -18.6], bays: 5 }, d);
  arcade(o, { start: [17, -45.1], end: [-17, -45.1], bays: 5 }, d);
  arcade(o, { start: [-16.6, -43.3], end: [-16.6, -20.5], bays: 4 }, d);
  arcade(o, { start: [16.6, -20.5], end: [16.6, -43.3], bays: 4 }, d);
  box(o, 'stone', 0, F - 0.12, -32, 37, 0.24, 30);
  if (d > 0) {
    for (const r of [0, 1, 2])
      box(o, 'stone', 0, F - 0.2 - r * 0.16, -48.7 - r * 0.35, 10, 0.22, 0.5);
    const n = [0, 8, 12, 16][d];
    prism(o, 'stone', circle(0, -32, 2.7, n), F, F + 0.42);
    prism(o, 'basalt', circle(0, -32, 2.45, n), F + 0.42, F + 0.45);
  }
  if (d > 0) {
    box(o, 'basalt', -18.1, F + 3.1, 7.3, 4, 6.2, 5);
    dome(o, -18.1, 7.3, 2.2, 6.25, 2.1, d);
  }
  if (d > 1) {
    for (let fi = 0; fi < 4; fi++) {
      const f = faces[fi],
        n = Math.floor(f.len / 0.85);
      for (let i = 0; i < n; i++) {
        const k = f.point(((i + 0.5) * f.len) / n, A.bodyTop + 0.48, 0.03);
        box(o, 'stone', k[0], k[1], k[2], 0.22, 0.45, 0.22);
      }
    }
    for (const f of faces)
      for (let x = 1.2; x < f.len; x += 2.4) {
        const q = f.point(x, A.bodyTop - 0.9, 0.05);
        box(o, 'stone', q[0], q[1], q[2], 0.2, 0.2, 0.2);
      }
  }
}
export const khalidMosqueSkyline = (o, f) => build(o, f, 0);
export const khalidMosqueDistrict = (o, f) => build(o, f, 1);
export const khalidMosqueStreet = (o, f) => build(o, f, 2);
export const khalidMosqueCloseup = (o, f) => build(o, f, 3);
export const khalidIbnAlWalidMosqueModel = {
  id: 'khalid_ibn_al_walid_mosque',
  key: 'khalid_ibn_al_walid_mosque',
  cell: 'sy/sy4',
  recipe: 'structure-khalid-ibn-al-walid-mosque.mjs',
  title: 'Khalid ibn al-Walid Mosque',
  category: 'mosque',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [76, 55, 85],
  lookAt: [0, F + 13, -13],
  portableGroundY: F - 0.3,
  mediumFiContext: { scale: 1.4, groundY: F - 0.3 },
  qaCameras: [
    {
      name: 'whole-mosque-hall-dome-group-twin-minarets-and-courtyard',
      position: [75, 50, 90],
      lookAt: [0, F + 15, -15],
      reviewLod: 'skyline',
    },
    {
      name: 'northern-open-ablaq-arcades-and-courtyard',
      position: [-40, 23, -70],
      lookAt: [0, F + 7, -24],
    },
    {
      name: 'silver-central-dome-drums-half-domes-and-corner-domes',
      position: [42, 35, 38],
      lookAt: [0, F + 18, 0],
    },
    {
      name: 'native-corner-minaret-gallery-cap-and-finial',
      position: [38, 36, -34],
      lookAt: [17, F + 27, -16],
    },
    {
      name: 'basalt-wall-pale-recessed-window-surrounds-and-side-projection',
      position: [-44, 14, 25],
      lookAt: [-15, F + 7, 4],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-khalid-ibn-al-walid-mosque.mjs',
    level: 'skyline',
    export: 'khalidMosqueSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'khalidMosqueDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'khalidMosqueStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'khalidMosqueCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole mapped prayerhall and both tagged northern minarets, pale central dome/four lower halfdomes/four cornerdomes, small side dome and north courtyard open ablaq arcades. Exact four native corners retained at every LOD. Named worship precinct and eastern ancillary footprint remain identity/context controls, not an extruded park boundary or substituted building.',
    'Three exact cleared published Qualla originals with creator PD-user dedications by Zozo2kx, Cloj and Anamnesis personally inspected/nativeSHA1matched. Explicit CC-BY-SA photograph under misleading PD-architecture label excluded without pixels. No supplemental imagery, generated photograph, photo textures or source media/body/metadata repair.',
    'Upper roof/dome sections, heights, window/merlon census, hidden rear, minaret balconies/finials, courtyard arcade limits and small side projection are original bounded photo estimates; later restored finish/fixtures unsurveyed. Private prayer/tomb interior, park monument, gardens and surrounding roads/landscape excluded.',
    'Independent400m field/16641samples/two rawtiles frozen before all structural sections. Fixed500.642m provider datum and+2.5m structural floor are unsurveyed reference estimates. Source ground/height PNG/rawtiles unchanged; exact footing/threshold/courtyard host contact unresolved, geographicpreview/replacementfalse. Flat render ground is a separate diagnosticfixture.',
  ],
};
