/** Eden's twin-tower hotel, open verandas, winter garden and northern courtyard gallery/stage. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL('../../../content/worldgen/source/places/6d/6d6/eden_hotel/', import.meta.url),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('d4c7af'),
    trim: rgb('e4ddc9'),
    roof: rgb('ae5d37'),
    base: rgb('777b70'),
    glass: rgb('607671'),
    door: rgb('53493a'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'stucco', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.95, metallic: 0 },
    base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.4, metallic: 0.1 },
    door: { slot: 'door', localRef: 'palette:#fffffd', roughness: 0.9, metallic: 0 },
  },
  tint = (c, s) => c.map((v) => Math.min(1, v * s)),
  sub = (a, b) => a.map((v, k) => v - b[k]),
  ring = (P) =>
    Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-7 ? P.slice(0, -1) : P;
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
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
function faces(P) {
  P = ring(P);
  let area = 0;
  for (let i = 0; i < P.length; i++)
    area += P[i][0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * P[i][1];
  if (area < 0) P = P.toReversed();
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      w = Math.hypot(dx, dz);
    return { a, b, w, u: [dx / w, dz / w], n: [dz / w, 0, -dx / w] };
  }).filter((f) => f.w > 0.005);
}
const point = (f, u, y, depth = 0) => [
    f.a[0] + u * f.u[0] + depth * f.n[0],
    y,
    f.a[1] + u * f.u[1] + depth * f.n[2],
  ],
  rect = (u, y, w, h) => [
    [u - w / 2, y],
    [u + w / 2, y],
    [u + w / 2, y + h],
    [u - w / 2, y + h],
  ],
  rectangle = (x0, x1, z0, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
function panel(o, s, f, P, depth = 0, col = C[s]) {
  const ids = earcut(P.flat());
  for (let k = 0; k < ids.length; k += 3)
    T(
      o,
      s,
      ids.slice(k, k + 3).map((i) => point(f, ...P[i], depth)),
      f.n,
      col,
    );
}
function flat(o, s, P, y, col = C[s], down = false) {
  P = ring(P);
  const ids = earcut(P.flat());
  for (let k = 0; k < ids.length; k += 3)
    T(
      o,
      s,
      ids.slice(k, k + 3).map((i) => [P[i][0], y, P[i][1]]),
      [0, down ? -1 : 1, 0],
      col,
    );
}
function solid(o, s, P, bottom, top, col = C[s]) {
  P = ring(P);
  for (const f of faces(P))
    panel(
      o,
      s,
      f,
      [
        [0, bottom],
        [f.w, bottom],
        [f.w, top],
        [0, top],
      ],
      0,
      col,
    );
  flat(o, s, P, top, col);
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  solid(o, s, rectangle(x - w / 2, x + w / 2, z - l / 2, z + l / 2), y, y + h, col);
}
function fbox(o, s, f, u, y, w, h, depth, col = C[s], offset = 0) {
  const R = rect(u, y, w, h),
    a = R.map((v) => point(f, ...v, offset)),
    b = R.map((v) => point(f, ...v, offset + depth));
  Q(o, s, b, f.n, col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], null, col);
  }
}
function circle(u, y, r, N) {
  return Array.from({ length: N }, (_, k) => [
    u + r * Math.cos((k * 2 * Math.PI) / N),
    y + r * Math.sin((k * 2 * Math.PI) / N),
  ]);
}
function wall(o, f, bottom, top, windows, d, s = 'wall') {
  const R = [
      [0, bottom],
      [f.w, bottom],
      [f.w, top],
      [0, top],
    ],
    W = windows.filter((w) =>
      w.poly.every(
        (v) => v[0] > 0.05 && v[0] < f.w - 0.05 && v[1] > bottom + 0.02 && v[1] < top - 0.02,
      ),
    );
  if (d < 2) panel(o, s, f, R);
  else {
    const flatP = [...R, ...W.flatMap((w) => w.poly)],
      holes = W.map((_, i) => 4 + W.slice(0, i).reduce((n, w) => n + w.poly.length, 0)),
      ids = earcut(flatP.flat(), holes);
    for (let k = 0; k < ids.length; k += 3)
      T(
        o,
        s,
        ids.slice(k, k + 3).map((i) => point(f, ...flatP[i])),
        f.n,
      );
  }
  for (const w of W) {
    const dep = d < 2 ? 0.015 : -0.18;
    panel(
      o,
      w.door ? 'door' : 'glass',
      f,
      w.poly,
      dep,
      w.door ? C.door : tint(C.glass, 0.9 + (w.i % 4) * 0.04),
    );
    if (d > 1)
      for (let k = 0; k < w.poly.length; k++) {
        const j = (k + 1) % w.poly.length;
        Q(
          o,
          'trim',
          [
            point(f, ...w.poly[k]),
            point(f, ...w.poly[j]),
            point(f, ...w.poly[j], dep),
            point(f, ...w.poly[k], dep),
          ],
          null,
          tint(C.trim, 0.88),
        );
      }
    if (w.circle) {
      if (d > 0)
        for (let k = 0; k < w.poly.length; k++) {
          const j = (k + 1) % w.poly.length,
            a = w.poly[k],
            b = w.poly[j],
            outer = (v) => [w.u + (v[0] - w.u) * 1.2, w.y + (v[1] - w.y) * 1.2];
          Q(
            o,
            'trim',
            [
              point(f, ...a, 0.04),
              point(f, ...b, 0.04),
              point(f, ...outer(b), 0.04),
              point(f, ...outer(a), 0.04),
            ],
            f.n,
          );
        }
      continue;
    }
    if (d > 0) {
      panel(o, 'trim', f, rect(w.u, w.y - 0.08, w.w + 0.2, 0.12), 0.05);
      if (d > 1) {
        panel(o, 'trim', f, rect(w.u, w.y + 0.02, 0.055, w.h - 0.04), -0.11);
        if (d === 3) {
          for (const sign of [-1, 1])
            panel(o, 'trim', f, rect(w.u + (sign * w.w) / 2, w.y, 0.09, w.h), 0.04);
          panel(o, 'trim', f, rect(w.u, w.y + w.h - 0.06, w.w, 0.1), 0.04);
          panel(o, 'door', f, rect(w.u, w.y + w.h * 0.55, w.w, 0.04), -0.12);
          fbox(o, 'trim', f, w.u, w.y - 0.14, w.w + 0.35, 0.12, 0.2);
        }
      }
    }
  }
}
function regular(f, levels, d) {
  const W = [];
  const n = Math.max(1, Math.floor(f.w / [7, 4.6, 3.8, 3.45][d]));
  if (f.w < 2) return W;
  for (const y of levels)
    for (let k = 0; k < n; k++) {
      const u = ((k + 0.5) * f.w) / n,
        w = Math.min(1.18, (f.w / n) * 0.6),
        h = y < 2 ? 0.72 : 1.85;
      W.push({ poly: rect(u, y, w, h), u, y, w, h, i: k });
    }
  return W;
}
function roof(o, P, eaves, peak, d) {
  P = ring(P);
  const center = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]),
    N = [1, 2, 5, 8][d];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
    for (let j = 0; j < N; j++) {
      const t0 = j / N,
        t1 = (j + 1) / N,
        V = (v, t) => [
          v[0] + (center[0] - v[0]) * t,
          eaves + (peak - eaves) * t,
          v[1] + (center[1] - v[1]) * t,
        ];
      Q(
        o,
        'roof',
        [V(a, t0), V(b, t0), V(b, t1), V(a, t1)],
        [0, 1, 0],
        tint(C.roof, 1 - (j % 2) * 0.045),
      );
    }
  }
}
function rail(o, a, b, y, d, spacing = 1.05) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    f = faces([
      [a[0], a[1]],
      [b[0], b[1]],
      [b[0] + (dz / L) * 0.2, b[1] - (dx / L) * 0.2],
      [a[0] + (dz / L) * 0.2, a[1] - (dx / L) * 0.2],
    ])[0];
  const N = d === 0 ? 1 : Math.max(1, Math.floor(L / spacing));
  for (let k = 0; k <= N; k++) {
    const x = a[0] + (dx * k) / N,
      z = a[1] + (dz * k) / N;
    if (d === 0) {
      const q = [
        [x - (0.055 * dx) / L, y, z - (0.055 * dz) / L],
        [x + (0.055 * dx) / L, y, z + (0.055 * dz) / L],
        [x + (0.055 * dx) / L, y + 0.72, z + (0.055 * dz) / L],
        [x - (0.055 * dx) / L, y + 0.72, z - (0.055 * dz) / L],
      ];
      Q(o, 'trim', q, null);
      Q(o, 'trim', q.toReversed(), null);
    } else if (d === 1) box(o, 'trim', x, y, z, 0.11, 0.72, 0.11);
    else {
      const rr = [0.1, 0.065, 0.12, 0.07, 0.1],
        yy = [0, 0.12, 0.34, 0.57, 0.7];
      for (let j = 0; j < 4; j++)
        box(o, 'trim', x, y + yy[j], z, rr[j] * 2, yy[j + 1] - yy[j], rr[j] * 2);
    }
  }
  // Continuous thin cap and base are independent of the open baluster spaces.
  const u = [(-dz / L) * 0.11, (dx / L) * 0.11],
    q = (h) => [
      [a[0] + u[0], h, a[1] + u[1]],
      [b[0] + u[0], h, b[1] + u[1]],
      [b[0] - u[0], h, b[1] - u[1]],
      [a[0] - u[0], h, a[1] - u[1]],
    ];
  Q(o, 'trim', q(y + 0.77), [0, 1, 0]);
  Q(o, 'trim', q(y + 0.08), [0, 1, 0]);
  if (d > 0) {
    const aa = [a[0] + u[0], y + 0.69, a[1] + u[1]],
      bb = [b[0] + u[0], y + 0.69, b[1] + u[1]];
    Q(o, 'trim', [aa, bb, [bb[0], y + 0.77, bb[2]], [aa[0], y + 0.77, aa[2]]], f.n);
  }
}
function stairs(o, x, width, z, y, count, rise, run, d) {
  for (let k = 0; k < count; k++) {
    if (d === 0) {
      const yy = y + (k + 1) * rise,
        zz = z + k * run;
      Q(
        o,
        'base',
        [
          [x - width / 2, yy, zz],
          [x + width / 2, yy, zz],
          [x + width / 2, yy, zz + run],
          [x - width / 2, yy, zz + run],
        ],
        [0, 1, 0],
        tint(C.trim, 0.93),
      );
      Q(
        o,
        'base',
        [
          [x - width / 2, yy - rise, zz],
          [x + width / 2, yy - rise, zz],
          [x + width / 2, yy, zz],
          [x - width / 2, yy, zz],
        ],
        [0, 0, -1],
        tint(C.trim, 0.93),
      );
    } else
      box(o, 'base', x, y + k * rise, z + (k + 0.5) * run, width, rise, run, tint(C.trim, 0.93));
    if (d > 1)
      box(o, 'trim', x, y + (k + 1) * rise - 0.025, z + k * run + 0.035, width + 0.05, 0.04, 0.1);
  }
}
function towers(o, d) {
  for (const [x, z] of A.towerCentres) {
    const w = 2.7,
      l = 3.2,
      c = 0.58,
      P = [
        [-w + c, -l],
        [w - c, -l],
        [w, -l + c],
        [w, l - c],
        [w - c, l],
        [-w + c, l],
        [-w, l - c],
        [-w, -l + c],
      ].map((v) => [x + v[0], z + v[1]]);
    for (const f of faces(P)) {
      const W = [];
      if (f.w > 2)
        for (const y of [A.floorY + 1.0, A.upperFloorY + 1.0]) {
          const u = f.w / 2,
            ww = 1.1,
            h = 1.95;
          W.push({ poly: rect(u, y, ww, h), u, y, w: ww, h, i: 0 });
        }
      if (f.w > 2) {
        const u = f.w / 2,
          y = 13.55;
        W.push({ poly: circle(u, y, 0.67, [5, 10, 16, 24][d]), circle: true, u, y, i: 0 });
      }
      wall(o, f, A.floorY, A.towerEavesEstimate, W, d);
      if (d > 0)
        for (const y of d === 1 ? [6.15, 10.7, 14.85] : [6.15, 10.7, 11.6, 14.85])
          fbox(o, 'trim', f, f.w / 2, y, f.w + 0.13, 0.15, 0.12);
      if (d > 1)
        for (const side of [0.17, f.w - 0.17]) fbox(o, 'trim', f, side, A.floorY, 0.16, 8.4, 0.1);
    }
    roof(o, P, A.towerEavesEstimate, A.towerRoofTopEstimate, d);
  }
}
function principal(o, d) {
  const P = ring(p.outline),
    body = P.filter((_, i) => ![5, 6, 7, 8].includes(i)).map(([x, z]) => [x, Math.max(-10.9, z)]);
  solid(o, 'base', P, A.plinthBottomY, A.floorY);
  for (const f of faces(P)) {
    if (d > 0 && f.w > 3) for (const w of regular(f, [0.55], d)) panel(o, 'door', f, w.poly, 0.02);
  }
  for (const f of faces(body))
    wall(
      o,
      f,
      A.floorY,
      A.mainEavesEstimate,
      regular(f, [A.floorY + 0.85, A.upperFloorY + 1.0], d),
      d,
    );
  flat(o, 'roof', body, A.mainEavesEstimate);
  for (const R of [
    rectangle(-28.1, -10.1, -10.9, 27.8),
    rectangle(-10.1, 5.4, -10.9, 27.7),
    rectangle(5.4, 24.6, -10.9, 20.6),
  ])
    roof(o, R, A.mainEavesEstimate, A.mainRoofRidgeEstimate, d);
  // Both veranda floors, genuine open colonnades, open railings and lean tiled canopies.
  for (const [x0, x1] of A.frontLoggiaRanges) {
    for (const y of [A.floorY, A.upperFloorY]) {
      box(o, 'trim', (x0 + x1) / 2, y - 0.16, -13.8, x1 - x0, 0.16, 5.85);
      if (y === A.upperFloorY)
        flat(o, 'trim', rectangle(x0, x1, -16.725, -10.875), y - 0.16, C.trim, true);
      const N = d === 0 ? 2 : 4;
      for (let k = 0; k <= N; k++) {
        const x = x0 + ((x1 - x0) * k) / N;
        box(o, 'trim', x, y, -16.45, 0.32, y === A.floorY ? 3.98 : 3.6, 0.32);
        if (d > 1) {
          box(o, 'trim', x, y, -16.45, 0.52, 0.16, 0.52);
          box(o, 'trim', x, y + (y === A.floorY ? 3.77 : 3.39), -16.45, 0.52, 0.18, 0.52);
        }
      }
      rail(o, [x0, -16.5], [x1, -16.5], y + 0.08, d);
    }
    const q = [
      [x0 - 0.15, 10.0, -17.0],
      [x1 + 0.15, 10.0, -17.0],
      [x1 + 0.15, 10.85, -10.7],
      [x0 - 0.15, 10.85, -10.7],
    ];
    Q(o, 'roof', q, [0, 1, 0]);
    const under = q.map((v) => [v[0], v[1] - 0.12, v[2]]);
    Q(o, 'trim', under, [0, -1, 0]);
    if (d > 0)
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        Q(o, 'roof', [q[k], q[j], under[j], under[k]], null);
      }
    if (d > 1)
      for (let j = 1; j < 12; j++) {
        const t = j / 12;
        Q(
          o,
          'roof',
          [
            [x0 - 0.15, 10 + 0.85 * t + 0.018, -17 + 6.3 * t],
            [x1 + 0.15, 10 + 0.85 * t + 0.018, -17 + 6.3 * t],
            [x1 + 0.15, 10 + 0.85 * t + 0.018, -16.97 + 6.3 * t],
            [x0 - 0.15, 10 + 0.85 * t + 0.018, -16.97 + 6.3 * t],
          ],
          [0, 1, 0],
          tint(C.roof, 0.82),
        );
      }
  }
  const face = { a: [-10.1, -14.88], b: [8.3, -14.88], w: 18.4, u: [1, 0], n: [0, 0, -1] },
    n = 5;
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) * face.w) / n,
      w = face.w / n - 0.32;
    panel(o, 'glass', face, rect(x, A.floorY, w, A.upperFloorY - A.floorY), 0.015);
    if (d > 0) {
      const M = [0, 2, 6, 9][d];
      for (let j = 1; j < M; j++)
        panel(
          o,
          'trim',
          face,
          rect(x - w / 2 + (j * w) / M, A.floorY, 0.032, A.upperFloorY - A.floorY),
          0.05,
        );
      for (let j = 1; j < (d === 1 ? 3 : 7); j++)
        panel(
          o,
          'trim',
          face,
          rect(x, A.floorY + (j * (A.upperFloorY - A.floorY)) / (d === 1 ? 3 : 7), w, 0.035),
          0.05,
        );
    }
    fbox(o, 'trim', face, (k * face.w) / n + 0.16, A.floorY, 0.28, A.upperFloorY - A.floorY, 0.22);
  }
  fbox(o, 'trim', face, face.w - 0.16, A.floorY, 0.28, A.upperFloorY - A.floorY, 0.22);
  panel(o, 'door', face, rect(face.w / 2, A.floorY + 0.06, 1.65, 2.85), 0.06);
  if (d > 0) panel(o, 'trim', face, rect(face.w / 2, A.floorY + 0.06, 0.07, 2.85), 0.08);
  wall(o, face, A.upperFloorY, A.mainEavesEstimate, regular(face, [7.15], d), d);
  box(o, 'trim', -0.9, 6.15, -14.95, 18.8, 0.22, 0.42);
  box(o, 'trim', -0.9, 10.62, -14.95, 19.1, 0.25, 0.55);
  box(o, 'trim', -0.9, 10.9, -14.7, 19.3, 0.36, 0.3);
  rail(o, [-10.4, -14.75], [-3.8, -14.75], 11.18, d, 0.65);
  rail(o, [2, -14.75], [8.6, -14.75], 11.18, d, 0.65);
  // Original bounded curved pediment and rosette, without copying insignia or text.
  const front = { ...face, a: [-4.7, -14.95], w: 7.6 },
    poly = [
      [0, 10.85],
      [7.6, 10.85],
      [7.6, 11.25],
      ...Array.from({ length: [5, 8, 14, 22][d] + 1 }, (_, i) => {
        const t = i / [5, 8, 14, 22][d];
        return [7.6 * (1 - t), 11.25 + 1.35 * Math.sin(t * Math.PI)];
      }),
    ];
  panel(o, 'trim', front, poly, 0.1);
  if (d > 0) {
    panel(o, 'wall', front, circle(3.8, 11.72, 0.37, 16), 0.12);
    for (const side of [-1, 1])
      for (let k = 0; k < (d > 1 ? 4 : 1); k++)
        panel(o, 'trim', front, circle(3.8 + side * (0.7 + k * 0.35), 11.63, 0.12, 8), 0.15);
  }
  const t = A.frontTerrace;
  box(
    o,
    'base',
    (t.x0 + t.x1) / 2,
    A.plinthBottomY,
    (t.z0 + t.z1) / 2,
    t.x1 - t.x0,
    A.floorY - A.plinthBottomY,
    t.z1 - t.z0,
    tint(C.trim, 0.92),
  );
  stairs(
    o,
    -0.95,
    A.frontStair.width,
    A.frontStair.nearZ,
    A.forecourtY,
    A.frontSteps,
    A.frontStepRise,
    0.4,
    d,
  );
  if (d > 0) for (const x of [t.x0, t.x1]) rail(o, [x, t.z0], [x, t.z1], A.floorY, d, 0.75);
}
function galleryAndStage(o, d) {
  const P = ring(p.features.find((f) => f.id === 'way/604420827').outline),
    floor = A.northernGalleryFloorY;
  flat(o, 'base', P, floor);
  for (const f of faces(P)) {
    const mid = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2],
      open = f.w > 20 && mid[0] > 25 && mid[1] > -5 && mid[1] < 16;
    if (open) {
      const count = d === 0 ? 3 : Math.max(3, Math.round(f.w / 3.4));
      for (let k = 0; k <= count; k++) {
        const q = point(f, (k * f.w) / count, floor);
        box(o, 'trim', q[0], floor, q[2], 0.3, 3.8, 0.3);
      }
      const inset = { ...f, a: [f.a[0] - f.n[0] * 2.7, f.a[1] - f.n[2] * 2.7] };
      wall(
        o,
        inset,
        floor,
        3.9,
        regular(inset, [0.3], d).map((w) => ({
          ...w,
          poly: rect(w.u, 0.25, w.w, 2.65),
          y: 0.25,
          h: 2.65,
          door: true,
        })),
        d,
      );
    } else wall(o, f, floor, 3.9, regular(f, [1.0], d), d);
    if (d > 0) fbox(o, 'trim', f, f.w / 2, 3.8, f.w, 0.16, 0.12);
  }
  flat(o, 'roof', P, 4.2);
  flat(o, 'trim', P, 4.12, C.trim, true);
  if (d > 1) for (const f of faces(P)) fbox(o, 'roof', f, f.w / 2, 4.08, f.w + 0.15, 0.12, 0.25);
  const S = A.courtyardAndStagePlan.stage,
    [x, z] = S.center;
  box(o, 'base', x, A.plinthBottomY, z, S.width, S.floorY - A.plinthBottomY, S.depth);
  flat(
    o,
    'base',
    rectangle(x - 2, x + 2, z - S.depth / 2, z + 2.8),
    S.floorY + 0.015,
    tint(C.trim, 0.88),
  );
  stairs(o, x, 3.0, z - S.depth / 2 - 2.1, A.forecourtY, S.frontSteps, S.stepRise, 0.35, d);
  for (const [a, b] of [
    [
      [x - S.width / 2, z - S.depth / 2],
      [x - 1.8, z - S.depth / 2],
    ],
    [
      [x + 1.8, z - S.depth / 2],
      [x + S.width / 2, z - S.depth / 2],
    ],
    [
      [x - S.width / 2, z - S.depth / 2],
      [x - S.width / 2, z + S.depth / 2],
    ],
    [
      [x + S.width / 2, z - S.depth / 2],
      [x + S.width / 2, z + S.depth / 2],
    ],
  ])
    rail(o, a, b, S.floorY + 0.03, d, 0.75);
  const f = {
      a: [x - S.backWallWidth / 2, S.backWallZ],
      b: [x + S.backWallWidth / 2, S.backWallZ],
      w: S.backWallWidth,
      u: [1, 0],
      n: [0, 0, -1],
    },
    N = [5, 8, 16, 24][d],
    profile = [
      [0, S.floorY],
      [S.backWallWidth, S.floorY],
      [S.backWallWidth, 4.55],
      ...Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N;
        return [S.backWallWidth * (1 - t), 4.55 + 1.35 * Math.sin(t * Math.PI)];
      }),
    ];
  panel(o, 'trim', f, profile, 0.16);
  panel(o, 'trim', { ...f, n: [0, 0, 1] }, profile, 0.16);
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    Q(
      o,
      'trim',
      [
        point(f, ...profile[i], -0.16),
        point(f, ...profile[j], -0.16),
        point(f, ...profile[j], 0.16),
        point(f, ...profile[i], 0.16),
      ],
      null,
    );
  }
  for (const side of [-1, 1])
    box(o, 'trim', x + (side * S.backWallWidth) / 2, S.floorY, S.backWallZ, 0.4, 3.55, 0.55);
  if (d > 0)
    for (let i = 2; i < profile.length - 1; i++) {
      const a = profile[i],
        b = profile[i + 1];
      Q(
        o,
        'trim',
        [
          point(f, ...a, 0.23),
          point(f, ...b, 0.23),
          point(f, b[0], b[1] + 0.1, 0.23),
          point(f, a[0], a[1] + 0.1, 0.23),
        ],
        f.n,
      );
    }
}
function build(o, _f, d = 3) {
  principal(o, d);
  towers(o, d);
  galleryAndStage(o, d);
}
export const edenSkyline = (o, f) => build(o, f, 0),
  edenDistrict = (o, f) => build(o, f, 1),
  edenStreet = (o, f) => build(o, f, 2),
  edenCloseup = (o, f) => build(o, f, 3);
export const edenHotelModel = {
  id: 'eden_hotel',
  key: 'eden_hotel',
  cell: '6d/6d6',
  recipe: 'structure-eden-hotel.mjs',
  title: 'Eden Hotel',
  category: 'building',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-90, 49, -105],
  lookAt: [12, 7, 3],
  portableGroundY: -0.16,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  qaCameras: [
    {
      name: 'whole-west-twin-oculus-towers-open-verandas-and-glazed-winter-garden',
      position: [-72, 30, -102],
      lookAt: [-2, 8, -3],
    },
    {
      name: 'whole-rear-room-wings-roofs-and-northern-l-gallery',
      position: [87, 53, 82],
      lookAt: [16, 6, 5],
    },
    {
      name: 'west-elevation-raised-stair-twelve-risers-towers-and-pediment',
      position: [-0.9, 12, -87],
      lookAt: [-0.9, 8, -13],
    },
    {
      name: 'southern-tower-real-oculus-recessed-windows-and-tiled-hip',
      position: [-36, 14, -30],
      lookAt: [-25, 12, -14],
    },
    {
      name: 'open-upper-and-lower-verandas-columns-and-baluster-spaces',
      position: [-17, 7, -27],
      lookAt: [-17, 6, -13],
    },
    {
      name: 'winter-garden-grid-glazing-central-upper-bays-and-bounded-pediment',
      position: [-0.9, 8, -29],
      lookAt: [-0.9, 7, -14.7],
    },
    {
      name: 'whole-open-northern-courtyard-stage-steps-and-long-gallery',
      position: [22, 18, 41],
      lookAt: [42, 2, 13],
    },
    {
      name: 'curved-outdoor-stage-wall-open-balustrade-and-six-step-run',
      position: [41, 7, 8],
      lookAt: [41, 2.6, 23],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-eden-hotel.mjs',
    level: 'skyline',
    export: 'edenSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'edenDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'edenStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'edenCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Complete actual main10-corner gross hotel envelope and adjacent8-corner northern L-gallery, paired faceted towers/tile hips/oculi, two genuinely open two-level front verandas/square columns/balusters, glazed central winter garden/upper bays/curved pediment and bounded original rosette, raised main12-riser stair/terrace/stone plinth, room wings/estimated rear roofs and observed open courtyard/small curved outdoor stage/6-riser stair/pierced balustrades. Detached southern unknown building/whole park/estate/hills/trees/furniture/lion statues/people/text/interiors excluded.',
    'Two exact cleared2816x2112 ClaudioElias2009 own/PD-self Qualla originals individually inspected/native byte matched; no attribution-only hero or other dubious imagery, new external photo fetch, borrowed mesh or generated bitmap. Front/northern court appearance is2009-supported surviving museum, not a survey of every later restoration detail.',
    'Whole native gross main/gallery boundaries retained; upper room/roof divisions/hidden interior patio sections/tower dimensions/entry/stair census/stage coordinates/fine window census/ornamental relief are original bounded photographic estimates. Source map does not separately delineate roof parts/interior courts; only the actually observed external north courtyard is asserted open. No fake entire courtyard pad or roof over the observed outdoor stage.',
    'Six actual canonical slots: pale stucco wall/trim, fired-clay roof, rough stone foundation/stairs, opaque local glass and dark doors. Three shared graphs and2 local accents. Near levels restore actual recessed oculi/windows, sash/grid mullions, open veranda/annex columns, moldings, roof courses and open balusters; no transparent interiors or active illumination.',
    'Independent16641value200m source field/two raw tiles/PNG frozen before geometry and unchanged. Flat/isolated appearance accepted with source-field limitation evidence; coarse local grades disagree with common building/platform levels, so exact foundation/threshold/courtyard contact remains unverified and replacementfalse. No fitting/flattening/reacquisition or surrounding ground pad.',
  ],
};
