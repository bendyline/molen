/** Original whole Sinas/Hansen cruciform observatory exterior, in its native Athens frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  F = p.parameters.floorY,
  A = p.parameters.architecturalSections,
  R = f.geometry.outline.slice(0, -1),
  TAU = 2 * Math.PI;
const C = {
  wall: rgb('e8d5b2'),
  trim: rgb('eee4cd'),
  stone: rgb('aaa18a'),
  red: rgb('79372c'),
  roof: rgb('767873'),
  metal: rgb('3d4140'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.97, metallic: 0 },
  red: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.82, metallic: 0.08 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.1 },
};
const G = ([x, y, z]) => [x, F + y, z],
  GN = (n) => n,
  sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const recessEvidence = [],
  nativeEvidence = [],
  drumEvidence = [],
  railEvidence = [],
  pedimentEvidence = [];
function facade(a, b, name) {
  const u = unit(sub(b, a)),
    n = [u[1], -u[0]],
    L = Math.hypot(...sub(b, a)),
    M = ([x, y, z]) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  return { a, b, u, n, L, name, M };
}
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((q) => q.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0])),
    N = n && GN(n);
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed authored face');
  if (N && dot(c, N) < 0) [q[1], q[2]] = [q[2], q[1]];
  const normal = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normal,
    q.map((q) => (Math.abs(normal[1]) > 0.8 ? [q[0], q[2]] : [q[0] + q[2], q[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-9 &&
            cr(r[b], r[c], r[k]) >= -1e-9 &&
            cr(r[c], r[a], r[k]) >= -1e-9,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid source ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true, col) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function poly(o, k, r, y0, y1, col) {
  if (r.length < 3) return;
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, y0, false, col);
  cap(o, k, r, y1, true, col);
}
function tube(o, k, a, b, r, N = 6, R = r, col) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    rad = (i) => u.map((x, j) => x * Math.cos((i * TAU) / N) + v[j] * Math.sin((i * TAU) / N)),
    P = (at, i, r) => at.map((x, j) => x + rad(i)[j] * r);
  for (let i = 0; i < N; i++) {
    Q(o, k, [P(a, i, r), P(a, i + 1, r), P(b, i + 1, R), P(b, i, R)], rad(i + 0.5), col);
    T(
      o,
      k,
      [a, P(a, i + 1, r), P(a, i, r)],
      d.map((x) => -x),
      col,
    );
    T(o, k, [b, P(b, i, R), P(b, i + 1, R)], d, col);
  }
}
function localBox(o, k, lo, hi, M, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi,
    origin = M([0, 0, 0]),
    n = (v) => sub(M(v), origin);
  for (const [q, N] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [0, -1, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
        [x, y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 0, 1],
    ],
  ])
    Q(o, k, q.map(M), n(N), col);
}
function clip(r, n, d, keep = true) {
  const out = [],
    dist = (q) => (dot(q, n) - d) * (keep ? 1 : -1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      da = dist(a),
      db = dist(b);
    if (da >= -1e-8) out.push(a);
    if (da >= -1e-8 !== db >= -1e-8) out.push(lerp(a, b, da / (da - db)));
  }
  return out.filter((q, i) => !i || Math.hypot(...sub(q, out[i - 1])) > 1e-7);
}
function roof(o, r, eave, top, shape, axis, gableSurface = 'wall') {
  if (shape === 'flat') {
    cap(o, 'roof', r, eave + 0.05);
    return;
  }
  const u = unit(axis),
    n = [u[1], -u[0]],
    ds = r.map((q) => dot(q, n)),
    lo = Math.min(...ds),
    hi = Math.max(...ds),
    mid = (lo + hi) / 2,
    along = r.map((q) => dot(q, u)),
    a = Math.min(...along),
    b = Math.max(...along),
    cut = Math.min((hi - lo) / 2, (b - a) * 0.35),
    hip = shape === 'hipped',
    cuts = [
      [n, mid],
      ...(hip
        ? [
            [u, a + cut],
            [u, b - cut],
          ]
        : []),
    ];
  const H = (q) =>
    eave +
    (top - eave) *
      Math.max(
        0,
        Math.min(
          1 - Math.abs((dot(q, n) - mid) / ((hi - lo) / 2)),
          ...(hip ? [(dot(q, u) - a) / cut, (b - dot(q, u)) / cut] : [1]),
        ),
      );
  let cells = [r];
  for (const [n, d] of cuts) {
    const next = [];
    for (const cell of cells)
      for (const keep of [true, false]) {
        const c = clip(cell, n, d, keep);
        if (c.length >= 3 && Math.abs(area(c)) > 1e-7) next.push(c);
      }
    cells = next;
  }
  for (const cell of cells) cap(o, 'roof', cell, H);
  // Split boundary edges at every ridge/hip crease, closing their real vertical roof-end faces.
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const aa = r[i],
      bb = r[(i + 1) % r.length],
      ts = [0, 1];
    for (const [n, d] of cuts) {
      const x = dot(aa, n) - d,
        y = dot(bb, n) - d;
      if (x * y < -1e-10) ts.push(x / (x - y));
    }
    ts.sort((a, b) => a - b);
    for (let j = 0; j < ts.length - 1; j++) {
      const a = lerp(aa, bb, ts[j]),
        b = lerp(aa, bb, ts[j + 1]),
        ya = H(a),
        yb = H(b),
        normal = [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        a0 = [a[0], eave, a[1]],
        b0 = [b[0], eave, b[1]],
        at = [a[0], ya, a[1]],
        bt = [b[0], yb, b[1]],
        col = gableSurface === 'glass' ? rgb('6c8185') : C.wall;
      if (ya <= eave + 1e-6 && yb <= eave + 1e-6) continue;
      if (ya <= eave + 1e-6) T(o, gableSurface, [a0, b0, bt], normal, col);
      else if (yb <= eave + 1e-6) T(o, gableSurface, [a0, b0, at], normal, col);
      else Q(o, gableSurface, [a0, b0, bt, at], normal, col);
    }
  }
}
function cleanRing(r) {
  r = r.map((q) => q.slice());
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        u = sub(c, a),
        L = Math.hypot(...u),
        t = dot(sub(b, a), u) / (L * L);
      if (
        L &&
        Math.abs(u[0] * (b[1] - a[1]) - u[1] * (b[0] - a[0])) / L < 0.01 &&
        t >= 0 &&
        t <= 1
      ) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  if (area(r) < 0) r.reverse();
  return r;
}
export const nativeRing = cleanRing(R);
const ID = (q) => q;
function box(o, k, a, b, col) {
  localBox(o, k, a, b, ID, col);
}
function faces(r, label) {
  const rr = r.map((q) => q.slice());
  if (area(rr) < 0) rr.reverse();
  return rr.map((a, i) => facade(a, rr[(i + 1) % rr.length], `${label}:${i}`));
}
function band(o, k, r, y0, y1, scale = 1, col) {
  const rr = r.map((q) => q.map((v) => v * scale));
  poly(o, k, rr, y0, y1, col);
}
/** A genuinely cut rectangular recess; opaque shutters/door close only its deep back plane. */
function panel(
  o,
  fa,
  {
    x0 = 0,
    x1 = fa.L,
    y0 = A.basementTop,
    y1 = A.wallTop,
    bottom = A.windowBottom,
    height = A.windowHeight,
    width = 1.04,
    depth = A.windowReveal,
    lod,
    label = 'wing-window',
    door = false,
  },
) {
  const x = (x0 + x1) / 2,
    l = x - width / 2,
    r = x + width / 2,
    top = bottom + height,
    at = (a, b, c) => fa.M([a, b, c]),
    N = [fa.n[0], 0, fa.n[1]];
  for (const [a, b, c, d] of [
    [x0, l, y0, y1],
    [r, x1, y0, y1],
    [l, r, y0, bottom],
    [l, r, top, y1],
  ])
    if (b - a > 1e-6 && d - c > 1e-6)
      Q(o, 'wall', [at(a, c, 0), at(b, c, 0), at(b, d, 0), at(a, d, 0)], N);
  Q(
    o,
    'wall',
    [at(l, bottom, 0), at(l, bottom, -depth), at(l, top, -depth), at(l, top, 0)],
    [fa.u[0], 0, fa.u[1]],
  );
  Q(
    o,
    'wall',
    [at(r, bottom, 0), at(r, top, 0), at(r, top, -depth), at(r, bottom, -depth)],
    [-fa.u[0], 0, -fa.u[1]],
  );
  Q(
    o,
    'wall',
    [at(l, bottom, 0), at(r, bottom, 0), at(r, bottom, -depth), at(l, bottom, -depth)],
    [0, 1, 0],
  );
  Q(o, 'wall', [at(l, top, 0), at(l, top, -depth), at(r, top, -depth), at(r, top, 0)], [0, -1, 0]);
  Q(
    o,
    'red',
    [at(l, bottom, -depth), at(r, bottom, -depth), at(r, top, -depth), at(l, top, -depth)],
    N,
    door ? rgb('48372c') : C.red,
  );
  recessEvidence.push({
    label,
    outer: at(x, bottom + height * 0.5, 0.08),
    normal: N,
    depth,
    width,
    closedBack: true,
    center: at(x, bottom + height * 0.5, -depth * 0.5),
  });
  if (lod >= 1) {
    localBox(o, 'trim', [l - 0.07, bottom - 0.1, -depth - 0.01], [r + 0.07, bottom, 0.13], fa.M);
    localBox(o, 'trim', [l - 0.09, top, -0.04], [r + 0.09, top + 0.11, 0.1], fa.M);
    localBox(
      o,
      'red',
      [x - 0.018, bottom, -depth],
      [x + 0.018, top, -depth + 0.03],
      fa.M,
      rgb('4c2923'),
    );
  }
  if (lod >= 2) {
    for (const xx of [l - 0.035, r])
      localBox(o, 'trim', [xx, bottom - 0.02, -0.045], [xx + 0.035, top + 0.02, 0.035], fa.M);
    for (const side of [-1, 1]) {
      const a = side < 0 ? l + 0.04 : x + 0.04,
        b = side < 0 ? x - 0.04 : r - 0.04;
      for (let j = 0; j < (lod === 2 ? 6 : 12); j++) {
        const yy = bottom + 0.08 + ((height - 0.16) * j) / (lod === 2 ? 6 : 12);
        localBox(
          o,
          'red',
          [a, yy, -depth + 0.005],
          [b, yy + 0.035, -depth + 0.045],
          fa.M,
          door ? rgb('625044') : rgb('873f31'),
        );
      }
    }
  }
}
function plainWall(o, fa, y0, y1) {
  Q(
    o,
    'wall',
    [fa.M([0, y0, 0]), fa.M([fa.L, y0, 0]), fa.M([fa.L, y1, 0]), fa.M([0, y1, 0])],
    [fa.n[0], 0, fa.n[1]],
  );
}
function wings(o, lod) {
  poly(o, 'stone', nativeRing, 0, A.basementTop);
  nativeEvidence.push(...R.map((q) => q.slice()));
  // All twenty real cross corners survive at every level; small central shoulders stay solid.
  for (const fa of faces(nativeRing, 'native-cross')) {
    if (fa.L < 1.1) {
      plainWall(o, fa, A.basementTop, A.wallTop);
      continue;
    }
    const mid = fa.M([fa.L / 2, 0, 0]),
      isLong = fa.L > 8,
      isEast = mid[0] > 8,
      isWest = mid[0] < -8;
    const count = isLong ? (lod === 0 ? 2 : 3) : isEast ? 2 : 1;
    for (let j = 0; j < count; j++)
      panel(o, fa, {
        x0: (fa.L * j) / count,
        x1: (fa.L * (j + 1)) / count,
        width: isWest ? 1.45 : 1.04,
        door: isWest,
        bottom: isWest ? A.basementTop : A.windowBottom,
        height: isWest ? 3.7 : A.windowHeight,
        lod,
        label: isWest ? 'closed-west-entry' : 'wing-window',
      });
    if (lod >= 1)
      for (const x of [0.16, fa.L - 0.16]) {
        localBox(o, 'trim', [x - 0.14, A.basementTop, -0.01], [x + 0.14, A.wallTop, 0.15], fa.M);
        if (lod >= 2) {
          localBox(
            o,
            'trim',
            [x - 0.21, A.basementTop, -0.03],
            [x + 0.21, A.basementTop + 0.19, 0.22],
            fa.M,
          );
          localBox(
            o,
            'trim',
            [x - 0.21, A.wallTop - 0.2, -0.03],
            [x + 0.21, A.wallTop, 0.22],
            fa.M,
          );
        }
      }
    if (lod >= 2 && isLong)
      for (let j = 1; j < count; j++) {
        const x = (fa.L * j) / count;
        localBox(o, 'wall', [x - 0.07, A.basementTop, -0.01], [x + 0.07, A.wallTop, 0.05], fa.M);
      }
  }
  cap(o, 'wall', nativeRing, A.wallTop);
  band(o, 'trim', nativeRing, A.wallTop, A.corniceTop, 1.018);
  if (lod >= 1) {
    band(o, 'trim', nativeRing, A.basementTop - 0.12, A.basementTop + 0.05, 1.008);
    if (lod >= 2) {
      band(o, 'trim', nativeRing, A.wallTop - 0.2, A.wallTop - 0.1, 1.01);
      band(o, 'trim', nativeRing, A.corniceTop, A.corniceTop + 0.07, 1.028);
    }
  }
  if (lod >= 2) {
    // Modest original stone courses and basement vents, not a terrain-following foundation.
    for (const fa of faces(nativeRing, 'basement'))
      if (fa.L > 2) {
        for (const y of [0.36, 0.78, 1.18])
          localBox(o, 'stone', [0, y, -0.012], [fa.L, y + 0.025, 0.012], fa.M, rgb('837e70'));
        const num = Math.max(1, Math.floor(fa.L / 2.3));
        for (let j = 0; j < num; j++) {
          const x = ((j + 0.5) * fa.L) / num;
          localBox(
            o,
            'stone',
            [x - 0.012, 0, -0.015],
            [x + 0.012, A.basementTop, 0.015],
            fa.M,
            rgb('8f8778'),
          );
        }
      }
  }
  const h = A.corniceTop + 0.03,
    top = A.wingRidge,
    rects = [
      {
        r: [
          [-3.61, -13.6],
          [3.61, -13.6],
          [3.61, -4.18],
          [-3.61, -4.18],
        ],
        axis: [0, 1],
        end: [0, -13.6],
        n: [0, -1],
      },
      {
        r: [
          [-3.61, 4.18],
          [3.61, 4.18],
          [3.61, 13.6],
          [-3.61, 13.6],
        ],
        axis: [0, 1],
        end: [0, 13.6],
        n: [0, 1],
      },
      {
        r: [
          [-9.1, -3.61],
          [-4.18, -3.61],
          [-4.18, 3.61],
          [-9.1, 3.61],
        ],
        axis: [1, 0],
        end: [-9.1, 0],
        n: [-1, 0],
      },
      {
        r: [
          [4.18, -3.61],
          [9.1, -3.61],
          [9.1, 3.61],
          [4.18, 3.61],
        ],
        axis: [1, 0],
        end: [9.1, 0],
        n: [1, 0],
      },
    ];
  for (const rr of rects) {
    roof(o, rr.r, h, top, 'gabled', rr.axis, 'wall');
    const n = rr.n,
      u = [-n[1], n[0]],
      cen = rr.end,
      M = ([x, y, z]) => [cen[0] + u[0] * x + n[0] * z, y, cen[1] + u[1] * x + n[1] * z];
    // Raised raking cornice, with a real triangular tympanum behind it.
    pedimentEvidence.push({
      center: M([0, (h + top) / 2, 0]),
      normal: [n[0], 0, n[1]],
      end: cen.slice(),
    });
    if (lod >= 1) {
      tube(o, 'trim', M([-3.7, h, -0.03]), M([0, top + 0.11, -0.03]), 0.07, 4);
      tube(o, 'trim', M([0, top + 0.11, -0.03]), M([3.7, h, -0.03]), 0.07, 4);
      localBox(o, 'trim', [-3.72, h - 0.04, -0.04], [3.72, h + 0.1, 0.14], M);
    }
    if (lod >= 2) {
      for (const x of [-3.5, 0, 3.5]) {
        const yy = x === 0 ? top + 0.13 : h + 0.15;
        localBox(o, 'trim', [x - 0.1, yy, -0.04], [x + 0.1, yy + 0.12, 0.14], M);
        const pr = [
            [x - 0.16, yy + 0.12],
            [x, yy + 0.5],
            [x + 0.16, yy + 0.12],
            [x, yy + 0.23],
          ],
          front = pr.map(([xx, y]) => M([xx, y, 0.09]));
        T(o, 'trim', [front[0], front[1], front[3]], [n[0], 0, n[1]]);
        T(o, 'trim', [front[1], front[2], front[3]], [n[0], 0, n[1]]);
        const back = pr.map(([xx, y]) => M([xx, y, -0.01]));
        T(o, 'trim', [back[0], back[1], back[3]], [-n[0], 0, -n[1]]);
        T(o, 'trim', [back[1], back[2], back[3]], [-n[0], 0, -n[1]]);
        for (let j = 0; j < 4; j++) {
          const a = pr[j],
            b = pr[(j + 1) % 4];
          Q(
            o,
            'trim',
            [
              M([a[0], a[1], -0.01]),
              M([b[0], b[1], -0.01]),
              M([b[0], b[1], 0.09]),
              M([a[0], a[1], 0.09]),
            ],
            [a[1] - b[1], 0, b[0] - a[0]],
          );
        }
      }
    }
    if (lod >= 2) {
      const along = rr.axis,
        side = [along[1], -along[0]],
        ss = rr.r.map((q) => dot(q, along)),
        lo = Math.min(...ss),
        hi = Math.max(...ss),
        N = lod === 2 ? 7 : 16;
      for (let j = 0; j <= N; j++) {
        const t = lo + ((hi - lo) * j) / N;
        for (const s of [-1, 1])
          tube(
            o,
            'roof',
            [along[0] * t + side[0] * s * 3.55, h + 0.055, along[1] * t + side[1] * s * 3.55],
            [along[0] * t, top + 0.04, along[1] * t],
            0.026,
            4,
            0.026,
            rgb('989b94'),
          );
      }
    }
  }
  // West entry has intrinsic independent steps; no park paths or fitted terrain.
  if (lod >= 1)
    for (let j = 0; j < 5; j++) {
      const x = -9.0 - (5 - j) * 0.31;
      box(o, 'stone', [x, 0, -1.1], [x + 0.31, (A.basementTop * (j + 1)) / 5, 1.1]);
    }
}
function terrace(o, lod) {
  box(o, 'wall', [-4.29, A.wallTop, -4.29], [4.29, A.terraceTop - 0.13, 4.29]);
  box(o, 'trim', [-4.4, A.terraceTop - 0.13, -4.4], [4.4, A.terraceTop, 4.4]);
  if (lod === 0) return;
  const r = [
      [-4.24, -4.24],
      [4.24, -4.24],
      [4.24, 4.24],
      [-4.24, 4.24],
    ],
    count = [0, 2, 8, 12][lod],
    height = 0.67;
  for (const fa of faces(r, 'open-terrace-rail')) {
    for (const y of lod >= 2
      ? [A.terraceTop + 0.1, A.terraceTop + height]
      : [A.terraceTop + height])
      localBox(o, 'metal', [0, y - 0.023, -0.02], [fa.L, y + 0.023, 0.02], fa.M, C.trim);
    for (let j = 0; j <= count; j++) {
      const x = (fa.L * j) / count;
      localBox(
        o,
        'metal',
        [x - 0.027, A.terraceTop, -0.027],
        [x + 0.027, A.terraceTop + height + 0.02, 0.027],
        fa.M,
        C.trim,
      );
    }
    if (lod >= 3)
      for (let j = 0; j < count; j += 2) {
        const x0 = (fa.L * j) / count,
          x1 = (fa.L * (j + 2)) / count;
        for (const flip of [false, true])
          tube(
            o,
            'metal',
            fa.M([x0, A.terraceTop + (flip ? 0.6 : 0.15), 0]),
            fa.M([x1, A.terraceTop + (flip ? 0.15 : 0.6), 0]),
            0.013,
            4,
            0.013,
            C.trim,
          );
      }
    railEvidence.push({
      outer: fa.M([(fa.L / count) * 0.27, A.terraceTop + 0.3, 0.14]),
      normal: [fa.n[0], 0, fa.n[1]],
      width: fa.L / count,
    });
  }
}
const circle = (r, N) =>
  Array.from({ length: N }, (_, i) => [r * Math.sin((i * TAU) / N), r * Math.cos((i * TAU) / N)]);
function observatoryDome(o, lod) {
  const N = lod === 0 ? 12 : 16,
    r = A.domeRadius,
    ring = circle(r, N);
  for (const fa of faces(ring, 'drum')) {
    panel(o, fa, {
      y0: A.drumBottom,
      y1: A.drumTop,
      bottom: A.drumWindowBottom,
      height: A.drumWindowHeight,
      width: fa.L * 0.56,
      depth: 0.16,
      lod: Math.min(lod, 1),
      label: 'drum-red-window',
    });
    drumEvidence.push({
      point: fa.M([fa.L / 2, A.drumWindowBottom + 0.8, 0.08]),
      normal: [fa.n[0], 0, fa.n[1]],
    });
    if (lod >= 2) {
      localBox(o, 'trim', [0.02, A.drumBottom, -0.01], [0.1, A.drumTop, 0.09], fa.M);
      if (lod >= 3) {
        localBox(
          o,
          'trim',
          [-0.015, A.drumTop - 0.15, -0.02],
          [0.14, A.drumTop + 0.01, 0.13],
          fa.M,
        );
      }
    }
  }
  cap(o, 'wall', ring, A.drumTop);
  band(o, 'trim', circle(r + 0.11, N), A.drumTop - 0.03, A.drumTop + 0.11);
  if (lod >= 1) band(o, 'trim', circle(r + 0.045, N), A.drumBottom - 0.03, A.drumBottom + 0.07);
  const seg = [12, 20, 40, 72][lod],
    bands = [3, 5, 10, 18][lod],
    base = A.drumTop + 0.11,
    rad = r + 0.08,
    H = A.domeRise,
    point = (a, t, extra = 0) => [
      (rad + extra) * Math.cos(t) * Math.sin(a),
      base + H * Math.sin(t) + extra * Math.sin(t),
      (rad + extra) * Math.cos(t) * Math.cos(a),
    ];
  for (let j = 0; j < bands; j++)
    for (let i = 0; i < seg; i++) {
      const a = (i * TAU) / seg,
        b = ((i + 1) * TAU) / seg,
        t = (j * Math.PI) / 2 / bands,
        s = ((j + 1) * Math.PI) / 2 / bands,
        n = [
          Math.sin((a + b) / 2) * Math.cos((t + s) / 2),
          Math.sin((t + s) / 2),
          Math.cos((a + b) / 2) * Math.cos((t + s) / 2),
        ];
      if (j === bands - 1) T(o, 'roof', [point(a, t), point(b, t), [0, base + H, 0]], n);
      else Q(o, 'roof', [point(a, t), point(b, t), point(b, s), point(a, s)], n, rgb('484b46'));
    }
  cap(o, 'roof', circle(rad, seg), base, false, rgb('484b46'));
  if (lod >= 1) {
    const ribs = [0, 8, 20, 28][lod],
      pieces = [0, 4, 10, 16][lod];
    for (let i = 0; i < ribs; i++) {
      const a = (i * TAU) / ribs;
      for (let j = 0; j < pieces; j++)
        tube(
          o,
          'metal',
          point(a, (j * Math.PI) / 2 / pieces, 0.025),
          point(a, ((j + 1) * Math.PI) / 2 / pieces, 0.025),
          lod >= 3 ? 0.018 : 0.025,
          4,
          0.018,
          rgb('9b9380'),
        );
    }
    // Narrow meridian curbs flank the closed shutter sector; shell remains closed behind it.
    if (lod >= 2)
      for (const a of [-0.11, 0.11])
        for (let j = 0; j < pieces; j++)
          tube(
            o,
            'metal',
            point(a, (j * Math.PI) / 2 / pieces, 0.045),
            point(a, ((j + 1) * Math.PI) / 2 / pieces, 0.045),
            0.026,
            4,
            0.026,
            rgb('a59a83'),
          );
  }
  tube(
    o,
    'metal',
    [0, base + H - 0.025, 0],
    [0, A.finialTop, 0],
    0.035,
    lod === 0 ? 4 : 8,
    0.019,
    rgb('a9a28e'),
  );
  if (lod >= 2) {
    tube(o, 'metal', [-0.19, A.finialTop - 0.13, 0], [0.19, A.finialTop - 0.13, 0], 0.012, 4);
  }
}
export function buildAthensObservatory(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  nativeEvidence.length = 0;
  drumEvidence.length = 0;
  railEvidence.length = 0;
  pedimentEvidence.length = 0;
  wings(o, lod);
  terrace(o, lod);
  observatoryDome(o, lod);
}
export const athensObservatorySkyline = (o) => buildAthensObservatory(o, null, 0),
  athensObservatoryDistrict = (o) => buildAthensObservatory(o, null, 1),
  athensObservatoryStreet = (o) => buildAthensObservatory(o, null, 2),
  athensObservatoryCloseup = (o) => buildAthensObservatory(o, null, 3);
export const athensObservatoryModel = {
  id: 'national_observatory_of_athens',
  key: 'national_observatory_of_athens',
  cell: 'sw/swb',
  title: 'National Observatory of Athens — Sinas Building',
  wikidataId: 'Q1816405',
  category: p.category,
  recipe: 'national-observatory-of-athens-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildAthensObservatory,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole historic Sinas/Hansen cruciform observatory: actual native18x27m cross with all20corners/212subdivisioncontrol envelope, pale neoclassical wings/raised stone basement, actual deep tall red shuttered recesses/pilasters/sills/cornices/four triangular pediments/acroteria/low metal wing roofs, closed recessed west entry/independent steps, central square terrace/open rails/red-windowed circular drum/closed ribbed dark metal rotating dome/finial. One cleared published2015creatorCC0 whole exterior plus two expired namedHansen plan/section sheets. Hidden/current finish/precise ornament/windowcensus/entryside/heights conservative original estimates. Separate circular observatory/admin/whole institution grounds/trees/hills/interiors/telescope/inscriptions/photo/page pixels excluded.',
  camera: [42, 26, 34],
  lookAt: [0, 5.8, 0],
  portableGroundY: F - 0.18,
  sunDirection: [9, 14, 7],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_sandstone', 'metal_painted'],
  qaCameras: [
    { name: 'whole-west-entry-and-rear-cross', position: [-42, 25, -34], lookAt: [0, 5.2, 0] },
    {
      name: 'closed-ribbed-dome-red-window-drum-and-open-terrace',
      position: [16, 12, 16],
      lookAt: [0, 9, 0],
    },
    {
      name: 'east-pediment-red-shutter-recesses-and-pilasters',
      position: [24, 6.5, 9],
      lookAt: [7, 4.8, 0],
    },
    {
      name: 'west-closed-entry-stone-basement-and-steps',
      position: [-24, 4.8, -9],
      lookAt: [-8, 2.8, 0],
    },
    {
      name: 'whole-native-cruciform-plan-and-four-wing-roofs',
      position: [1, 58, 1],
      lookAt: [0, 4, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/athens-observatory-runtime-overlay.mjs',
    level: 'skyline',
    export: 'athensObservatorySkyline',
    errorMeters: 1.7,
    surfaces,
    authoredLevels: {
      district: { export: 'athensObservatoryDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'athensObservatoryStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'athensObservatoryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Three exact published Qualla originals only:2015Jebulonown/selfCC0 whole exterior plus two expired namedTheophilHansen1813–1891 architectural plan/section sheets, individually inspected/nativeSHA1 matched/passed unchanged policy. Conflicting hero/unrelated NASA/celestial imagery unused without repair or reclassification. Current finefinish/hidden elevations/precise ornaments/entryside/sections/window census bounded original estimates. No copied photographic/page pixels, historical cutaway interiors/telescope/instruments/text, separate circular observatory/admin/grounds/landscape/neighbor buildings.',
    'Original400m129x12916641sample field/two rawtiles fixed southapproach92.0898m provider-relative datum frozen before all floors/sections/geometry. No terrainfit/flatten/reacquire/modelraising. Preview/replacementfalse/exact foundation/threshold contact unresolved. Flat isolated ground and synthetic neighbors are review fixtures.',
  ],
};
