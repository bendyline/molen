/** Original whole temple ensemble; geographic plans and explicit exterior approximations. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  U = A.planAxisU,
  V = A.planAxisV,
  F = A.relativeFloors;
const C = {
  brick: rgb('ac7660'),
  roof: rgb('6c4d43'),
  stone: rgb('b4b4a4'),
  wood: rgb('514337'),
  trim: rgb('c6c8bb'),
  glass: rgb('242b2a'),
};
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  unit = (a) => a.map((v) => v / Math.hypot(...a)),
  P = ([u, y, v]) => [U[0] * u + V[0] * v, y, U[1] * u + V[1] * v],
  uv = (q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]],
  identity = (q) => q;
export const openingEvidence = [],
  passageEvidence = [],
  componentEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => P(v).map(Math.fround));
  n = n && P(n);
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function box(o, k, lo, hi, M = identity, col) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const q of [
    [
      [x, y, z],
      [x, y, Z],
      [X, y, Z],
      [X, y, z],
    ],
    [
      [x, Y, Z],
      [x, Y, z],
      [X, Y, z],
      [X, Y, Z],
    ],
    [
      [x, y, Z],
      [x, Y, Z],
      [X, Y, Z],
      [X, y, Z],
    ],
    [
      [X, y, z],
      [X, Y, z],
      [x, Y, z],
      [x, y, z],
    ],
    [
      [x, y, z],
      [x, Y, z],
      [x, Y, Z],
      [x, y, Z],
    ],
    [
      [X, y, Z],
      [X, Y, Z],
      [X, Y, z],
      [X, y, z],
    ],
  ])
    Q(o, k, q.map(M).reverse(), null, col);
}
function tube(o, k, a, b, r, N = 6, col) {
  const axis = unit(sub(b, a));
  if (!axis.every(Number.isFinite)) return;
  const u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    ring = (at, i) =>
      at.map(
        (x, j) =>
          x + r * (u[j] * Math.cos((i * 2 * Math.PI) / N) + v[j] * Math.sin((i * 2 * Math.PI) / N)),
      );
  for (let i = 0; i < N; i++) {
    Q(
      o,
      k,
      [ring(a, i), ring(a, i + 1), ring(b, i + 1), ring(b, i)],
      sub(ring(a, i + 0.5), a),
      col,
    );
    T(
      o,
      k,
      [a, ring(a, i + 1), ring(a, i)],
      axis.map((x) => -x),
      col,
    );
    T(o, k, [b, ring(b, i), ring(b, i + 1)], axis, col);
  }
}
const area = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    tri = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let ok = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-10) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-10 &&
            cr(r[b], r[c], r[k]) >= -1e-10 &&
            cr(r[c], r[a], r[k]) >= -1e-10,
        )
      )
        continue;
      tri.push([a, b, c]);
      ids.splice(j, 1);
      ok = true;
      break;
    }
    if (!ok) throw Error('Invalid native ring');
  }
  tri.push(ids);
  return tri;
}
const value = (v, q) => (typeof v === 'function' ? v(q) : v);
function cap(o, k, r, y, up = true) {
  for (const t of triangulate(r))
    T(
      o,
      k,
      t.map((i) => [r[i][0], value(y, r[i]), r[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, k, r, bottom, top) {
  const sign = Math.sign(area(r));
  cap(o, k, r, top);
  cap(o, k, r, bottom, false);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], value(bottom, a), a[1]],
        [b[0], value(bottom, b), b[1]],
        [b[0], value(top, b), b[1]],
        [a[0], value(top, a), a[1]],
      ],
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
    );
  }
}
const rect = (a, b, c, d) => [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ],
  native = (id) =>
    f.features
      .find((e) => e.id === `way/${id}`)
      .outline.slice(0, -1)
      .map(uv),
  bounds = (r) => [
    Math.min(...r.map((q) => q[0])),
    Math.min(...r.map((q) => q[1])),
    Math.max(...r.map((q) => q[0])),
    Math.max(...r.map((q) => q[1])),
  ];
function grade(v) {
  const knots = A.galleryGradeKnots;
  if (v <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++)
    if (v <= knots[i][0]) {
      const [a, x] = knots[i - 1],
        [b, y] = knots[i];
      return x + ((y - x) * (v - a)) / (b - a);
    }
  return knots.at(-1)[1];
}
function edge(a, b, sign) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((x) => x / L),
    n = [sign * u[1], 0, -sign * u[0]],
    M = ([x, y, d]) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[1] * x + n[2] * d];
  return { L, u, n, M };
}
/** Actual recesses; no wall is left across an aperture. */
function wall(o, k, r, y0, y1, lod, options = {}) {
  const sign = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      e = edge(a, b, sign),
      { L, M, n } = e,
      front = n[2] < -0.7 && !options.component?.includes('clerestory'),
      holes = [];
    if (lod && L > 3 && (lod >= 2 || front) && (!options.frontOnly || front)) {
      const count =
        front && L > 20
          ? lod === 1
            ? 3
            : lod === 2
              ? 5
              : Math.max(5, Math.floor(L / 6))
          : Math.max(1, Math.floor(L / (lod === 1 ? 30 : lod === 2 ? 22 : 10)));
      for (let j = 0; j < count; j++) {
        const x = ((j + 0.5) * L) / count,
          w = Math.min(front ? 3.3 : 1.7, (L / count) * 0.55),
          h = front ? Math.min(5, y1 - y0 - 1) : Math.min(2.1, (y1 - y0) * 0.45);
        holes.push({
          x0: x - w / 2,
          x1: x + w / 2,
          y0: front ? y0 + 0.25 : y0 + (y1 - y0) * 0.35,
          y1: front ? y0 + 0.25 + h : y0 + (y1 - y0) * 0.35 + h,
          depth: front ? 0.65 : 0.35,
          kind: front ? 'door' : 'window',
          round: front && (j === 0 || j === count - 1) && count >= 3,
        });
      }
    }
    const X = [...new Set([0, L, ...holes.flatMap((h) => [h.x0, h.x1])])].sort((a, b) => a - b),
      Y = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
    for (let ix = 1; ix < X.length; ix++)
      for (let iy = 1; iy < Y.length; iy++) {
        const x = (X[ix] + X[ix - 1]) / 2,
          y = (Y[iy] + Y[iy - 1]) / 2;
        if (holes.some((h) => x > h.x0 && x < h.x1 && y > h.y0 && y < h.y1)) continue;
        Q(
          o,
          k,
          [
            [X[ix - 1], Y[iy - 1], 0],
            [X[ix], Y[iy - 1], 0],
            [X[ix], Y[iy], 0],
            [X[ix - 1], Y[iy], 0],
          ].map(M),
          n,
        );
      }
    for (const h of holes) {
      const xc = (h.x0 + h.x1) / 2,
        yc = (h.y0 + h.y1) / 2,
        w = h.x1 - h.x0,
        hh = h.y1 - h.y0,
        back = h.kind === 'door' && !h.round ? 'wood' : 'glass';
      if (h.round) {
        const R = Math.min(w, hh) * 0.5,
          N = [0, 8, 12, 20][lod],
          angles0 = [
            ...Array.from({ length: N }, (_, i) => (i * 2 * Math.PI) / N),
            ...[-1, 1].flatMap((a) =>
              [-1, 1].map((b) => (Math.atan2(b * hh, a * w) + 2 * Math.PI) % (2 * Math.PI)),
            ),
          ].sort((a, b) => a - b);
        for (let j = 0; j < angles0.length; j++) {
          const q = (t) => [xc + R * Math.cos(t), yc + R * Math.sin(t), 0],
            angles = [
              angles0[j],
              j + 1 < angles0.length ? angles0[j + 1] : angles0[0] + 2 * Math.PI,
            ],
            outer = (t) => {
              const c = Math.cos(t),
                s = Math.sin(t),
                d = Math.min(Math.abs(w / 2 / (c || 1e-12)), Math.abs(hh / 2 / (s || 1e-12)));
              return [xc + d * c, yc + d * s, 0];
            },
            aa = q(angles[0]),
            bb = q(angles[1]);
          Q(o, k, [aa, bb, outer(angles[1]), outer(angles[0])].map(M), n);
          Q(
            o,
            'wood',
            [aa, bb, [bb[0], bb[1], -h.depth], [aa[0], aa[1], -h.depth]].map(M).reverse(),
            null,
          );
          T(
            o,
            back,
            [
              [xc, yc, -h.depth],
              [bb[0], bb[1], -h.depth],
              [aa[0], aa[1], -h.depth],
            ].map(M),
            n,
          );
        }
      } else {
        for (const q of [
          [
            [h.x0, h.y0, 0],
            [h.x1, h.y0, 0],
            [h.x1, h.y0, -h.depth],
            [h.x0, h.y0, -h.depth],
          ],
          [
            [h.x1, h.y1, 0],
            [h.x0, h.y1, 0],
            [h.x0, h.y1, -h.depth],
            [h.x1, h.y1, -h.depth],
          ],
          [
            [h.x0, h.y1, 0],
            [h.x0, h.y0, 0],
            [h.x0, h.y0, -h.depth],
            [h.x0, h.y1, -h.depth],
          ],
          [
            [h.x1, h.y0, 0],
            [h.x1, h.y1, 0],
            [h.x1, h.y1, -h.depth],
            [h.x1, h.y0, -h.depth],
          ],
        ])
          Q(o, 'wood', q.map(M).reverse(), null);
        Q(
          o,
          back,
          [
            [h.x0, h.y0, -h.depth],
            [h.x1, h.y0, -h.depth],
            [h.x1, h.y1, -h.depth],
            [h.x0, h.y1, -h.depth],
          ].map(M),
          n,
        );
        if (
          lod === 3 &&
          !options.component?.startsWith('stupa-') &&
          !options.component?.startsWith('smallTower-')
        ) {
          for (const x of [h.x0 + 0.07, xc, h.x1 - 0.07])
            box(
              o,
              'wood',
              [x - 0.035, h.y0, -h.depth + 0.01],
              [x + 0.035, h.y1, -h.depth + 0.09],
              M,
            );
          for (const t of [0.3, 0.7])
            box(
              o,
              'wood',
              [h.x0, yc + (t - 0.5) * hh - 0.035, -h.depth + 0.01],
              [h.x1, yc + (t - 0.5) * hh + 0.035, -h.depth + 0.08],
              M,
            );
        }
      }
      openingEvidence.push({
        component: options.component,
        kind: h.round ? 'round-window' : h.kind,
        slot: back,
        depth: h.depth,
        center: P(M([xc + (h.round ? 0 : w * 0.22), yc, 0])),
        normal: P(n),
      });
    }
  }
}
/** A solid curved hip roof, with independently closed underside and eave edges. */
function roof(o, cx, cz, w, d, eave, rise, lod, trim = true) {
  const ridge = Math.max(w * 0.18, (w - d * 0.65) / 2),
    N = !trim && lod >= 2 ? (lod === 2 ? 1 : 2) : [1, 1, 2, 3][lod],
    J = [1, 1, 1, 2][lod],
    sides = [
      { a: [-w / 2, -d / 2], b: [w / 2, -d / 2], r: [-ridge, 0], s: [ridge, 0] },
      { a: [w / 2, -d / 2], b: [w / 2, d / 2], r: [ridge, 0], s: [ridge, 0] },
      { a: [w / 2, d / 2], b: [-w / 2, d / 2], r: [ridge, 0], s: [-ridge, 0] },
      { a: [-w / 2, d / 2], b: [-w / 2, -d / 2], r: [-ridge, 0], s: [-ridge, 0] },
    ],
    point = (side, t, u) => {
      const ee = side.a.map((v, i) => v + (side.b[i] - v) * u),
        rr = side.r.map((v, i) => v + (side.s[i] - v) * u);
      return [
        cx + rr[0] * (1 - t) + ee[0] * t,
        eave +
          rise * Math.pow(1 - t, 1.7) +
          Math.min(1.6, rise * 0.23) * Math.pow(t, 8) * Math.pow(Math.abs(2 * u - 1), 6),
        cz + rr[1] * (1 - t) + ee[1] * t,
      ];
    };
  for (const side of sides) {
    for (let i = 0; i < N; i++)
      for (let j = 0; j < J; j++) {
        const q = [
          point(side, i / N, j / J),
          point(side, (i + 1) / N, j / J),
          point(side, (i + 1) / N, (j + 1) / J),
          point(side, i / N, (j + 1) / J),
        ];
        Q(o, 'roof', q, [0, 1, 0]);
        if (lod >= 2) Q(o, 'wood', q.map((v) => [v[0], v[1] - 0.16, v[2]]).reverse(), [0, -1, 0]);
      }
    if (lod >= 2)
      for (let j = 0; j < J; j++) {
        const a = point(side, 1, j / J),
          b = point(side, 1, (j + 1) / J);
        Q(o, 'wood', [a, b, [b[0], b[1] - 0.16, b[2]], [a[0], a[1] - 0.16, a[2]]], null);
      }
    if (lod === 3 && trim) {
      const q = Array.from({ length: N + 1 }, (_, i) => point(side, i / N, 0));
      for (let i = 1; i < q.length; i++) tube(o, 'trim', q[i - 1], q[i], 0.1, lod === 2 ? 3 : 4);
    }
  }
  if (lod && trim)
    tube(
      o,
      'trim',
      [cx - ridge, eave + rise + 0.06, cz],
      [cx + ridge, eave + rise + 0.06, cz],
      0.14,
      lod === 1 ? 3 : 4,
    );
  if (lod === 3 && trim)
    for (const side of [-1, 1]) {
      const a = [cx + side * ridge, eave + rise, cz],
        N = 6;
      let last = a;
      for (let i = 1; i <= N; i++) {
        const t = i / N,
          q = [
            a[0] + side * (0.7 + 1.1 * Math.sin(t * Math.PI * 1.3)),
            a[1] + 1.1 * t + 0.55 * Math.sin(t * Math.PI * 1.3),
            cz,
          ];
        tube(o, 'trim', last, q, 0.1, 3);
        last = q;
      }
    }
}
function railing(o, ax, bx, z, y, lod) {
  if (!lod) return;
  for (const yy of [y + 0.12, y + 1.05])
    box(o, 'stone', [ax, yy - 0.06, z - 0.07], [bx, yy + 0.06, z + 0.07]);
  const count = Math.ceil((bx - ax) / (lod === 1 ? 20 : lod === 2 ? 2.8 : 1.4));
  for (let i = 0; i <= count; i++) {
    const x = ax + ((bx - ax) * i) / count;
    box(o, 'stone', [x - 0.07, y, z - 0.09], [x + 0.07, y + 1.16, z + 0.09]);
  }
}
function stairs(o, cx, z, w, y, rise, lod) {
  if (!lod) return;
  const N = [0, 1, 3, 12][lod],
    run = Math.max(3, rise * 1.8);
  for (let i = 0; i < N; i++)
    box(
      o,
      'stone',
      [cx - w / 2, y, z - run + (i * run) / N],
      [cx + w / 2, y + (rise * (i + 1)) / N, z - run + ((i + 1) * run) / N],
    );
  if (lod >= 2)
    for (const side of [-1, 1])
      tube(
        o,
        'stone',
        [cx + (side * w) / 2, y + 0.8, z - run],
        [cx + (side * w) / 2, y + rise + 0.8, z],
        0.1,
        4,
      );
}
function hall(o, id, name, lod) {
  const r = native(id),
    [x, z, X, Z] = bounds(r),
    cx = (x + X) / 2,
    cz = (z + Z) / 2,
    w = X - x,
    d = Z - z,
    Fy = F[name],
    tiers = name === 'tamThe' ? 3 : 2,
    height = A.hallHeights[name],
    plinth = 3;
  let core = r.map((q) => [cx + (q[0] - cx) * 0.93, cz + (q[1] - cz) * 0.93]);
  core = core.map((q) => [q[0], q[1] < cz ? q[1] + 2.5 : q[1]]);
  wall(o, 'brick', core, Fy + (lod ? plinth : 0), Fy + plinth + 8.2, lod, { component: name });
  cap(o, 'wood', core, Fy + plinth + 8.2);
  if (lod) prism(o, 'brick', r, Fy, Fy + plinth);
  const front = z + 3;
  stairs(o, cx - w * 0.23, z, w * 0.23, Fy, plinth, lod);
  stairs(o, cx + w * 0.23, z, w * 0.23, Fy, plinth, lod);
  if (name === 'tamThe') {
    // Intrinsic central stone ramp between the two entry flights. The carved
    // relief is not copied; the actual sloping architectural plane is retained.
    const left = cx - w * 0.095,
      right = cx + w * 0.095,
      foot = z - 5.4;
    Q(
      o,
      'stone',
      [
        [left, Fy, foot],
        [right, Fy, foot],
        [right, Fy + plinth, z],
        [left, Fy + plinth, z],
      ],
      [0, 1, -1],
    );
    Q(
      o,
      'stone',
      [
        [left, Fy, foot],
        [left, Fy, z],
        [right, Fy, z],
        [right, Fy, foot],
      ],
      [0, -1, 0],
    );
    Q(
      o,
      'stone',
      [
        [left, Fy, z],
        [left, Fy + plinth, z],
        [right, Fy + plinth, z],
        [right, Fy, z],
      ],
      [0, 0, 1],
    );
    T(
      o,
      'stone',
      [
        [left, Fy, foot],
        [left, Fy + plinth, z],
        [left, Fy, z],
      ],
      [-1, 0, 0],
    );
    T(
      o,
      'stone',
      [
        [right, Fy, foot],
        [right, Fy, z],
        [right, Fy + plinth, z],
      ],
      [1, 0, 0],
    );
  }
  if (lod) railing(o, x + 1, X - 1, z, Fy + plinth, lod);
  if (name === 'quanAm') {
    const depth = (Z - z) * 0.55;
    roof(o, cx, z + depth / 2, w + 1.3, depth + 2, Fy + plinth + 8.2, 4.5, lod);
    if (lod)
      box(o, 'wood', [cx - w * 0.34, Fy + 9, z + 3], [cx + w * 0.34, Fy + 15, z + depth - 3]);
    roof(o, cx, z + depth / 2, w * 0.72, depth * 0.72, Fy + 15, 4, lod);
    roof(o, cx, Z - (Z - z) * 0.23, w * 0.36, (Z - z) * 0.47, Fy + 11.2, 3.4, lod);
  } else {
    roof(o, cx, cz, w + 2, d + 2, Fy + plinth + 8.2, name === 'tamThe' ? 9.8 : 10, lod);
    const w2 = w * 0.81,
      d2 = d * 0.65,
      y2 = Fy + (tiers === 3 ? 18.5 : 20.5),
      cw2 = w * (tiers === 3 ? 0.74 : 0.65),
      cd2 = d * (tiers === 3 ? 0.45 : 0.28),
      upperCore = rect(cx - cw2 / 2, cz - cd2 / 2, cx + cw2 / 2, cz + cd2 / 2);
    // The opaque section starts inside the lower roof; the visible clerestory
    // is a short band, rather than a floating block above the roof slope.
    wall(o, 'wood', upperCore, Fy + 8, y2 - 2.2, 0);
    wall(o, 'wood', upperCore, y2 - 2.2, y2, lod, { component: `${name}-clerestory` });
    cap(o, 'wood', upperCore, y2);
    roof(o, cx, cz, w2 + 2, d2 + 2, y2, 9.5, lod);
    if (tiers === 3) {
      const w3 = w * 0.64,
        d3 = d * 0.39,
        uppermostCore = rect(cx - w * 0.285, cz - d * 0.085, cx + w * 0.285, cz + d * 0.085);
      wall(o, 'wood', uppermostCore, Fy + 16, Fy + 25, 0);
      wall(o, 'wood', uppermostCore, Fy + 25, Fy + 27, lod, {
        component: `${name}-upper-clerestory`,
      });
      cap(o, 'wood', uppermostCore, Fy + 27);
      roof(o, cx, cz, w3 + 2, d3 + 2, Fy + 27, height - 27, lod);
    }
  }
  if (lod) {
    const count = lod === 1 ? 4 : 9;
    for (let j = 0; j < count; j++) {
      const u = x + 2 + ((w - 4) * j) / (count - 1);
      tube(
        o,
        'wood',
        [u, Fy + plinth, front],
        [u, Fy + plinth + 8.4, front],
        0.25,
        lod === 1 ? 4 : lod === 2 ? 5 : 6,
      );
      if (lod >= 2) {
        box(
          o,
          'wood',
          [u - 0.6, Fy + plinth + 7.4, front - 0.35],
          [u + 0.6, Fy + plinth + 7.65, front + 0.35],
        );
        tube(o, 'wood', [u, Fy + plinth + 6.8, front], [u + 0.6, Fy + plinth + 7.6, front], 0.1, 4);
      }
    }
  }
  componentEvidence.push({ name, nativeId: id, center: P([cx, Fy, cz]), height });
}
/** Gallery centerlines are original sections inside the exact native envelope. */
const paths = [
  {
    id: 1158511977,
    side: 1,
    pts: [
      [-110, 25],
      [-115, -190],
      [-127, -190],
      [-132, -335],
      [-144, -335],
      [-147, -530],
      [-60, -530],
      [23, -532],
      [26, -336],
      [12, -336],
      [14, -190],
      [0, -190],
      [1, 23],
    ],
  },
  {
    id: 449266739,
    side: 1,
    pts: [
      [-80, 32],
      [-121, 34],
      [-120, 189],
      [-135, 189],
      [-135, 220],
    ],
  },
  {
    id: 449266747,
    side: -1,
    pts: [
      [-29, 31],
      [13, 31],
      [17, 186],
    ],
  },
  {
    id: 449266738,
    side: -1,
    pts: [
      [21, 191],
      [34, 192],
      [34, 227],
      [38, 227],
      [38, 271],
    ],
  },
  {
    id: 449266735,
    side: 1,
    pts: [
      [-135, 220],
      [-135, 270],
      [-134, 310],
      [-133, 361],
      [35, 361],
      [35, 271],
    ],
  },
];
// The wooden inner gate replaces the middle of the northern gallery crossbar.
// Preserve its three real passages instead of running a gallery wall across them.
const northernGallery = paths[0];
paths.splice(
  0,
  1,
  { ...northernGallery, pts: [...northernGallery.pts.slice(0, 6), [-77, -530]] },
  { ...northernGallery, pts: [[-43, -531], ...northernGallery.pts.slice(7)] },
);
function gallery(o, definition, lod) {
  if (!lod) return;
  for (let i = 1; i < definition.pts.length; i++) {
    const a = definition.pts[i - 1],
      b = definition.pts[i],
      L = Math.hypot(...sub(b, a)),
      D = sub(b, a).map((v) => v / L),
      n = [-D[1], D[0]],
      span = lod === 1 ? 85 : lod === 2 ? 42 : 21,
      sections = Math.max(1, Math.ceil(L / span));
    for (let j = 0; j < sections; j++) {
      const lo = (j * L) / sections,
        hi = ((j + 1) * L) / sections,
        mid = (lo + hi) / 2,
        center = a.map((v, k) => v + D[k] * mid),
        y = grade(center[1]),
        M = ([x, yy, z]) => [center[0] + D[0] * x + n[0] * z, yy, center[1] + D[1] * x + n[1] * z],
        len = hi - lo + 0.35;
      const capture = {
        addTriangle(k, ref, q, _normal, uvs, col) {
          const converted = q.map((v) => {
            const u = v[0] * U[0] + v[2] * U[1],
              z = v[0] * V[0] + v[2] * V[1],
              w = M([u, v[1], z]);
            return P(w).map(Math.fround);
          });
          const nn = normalFor(...converted);
          o.addTriangle(k, ref, converted, nn, uvs, col);
        },
      };
      roof(capture, 0, 0, len, 8.8, y + 4.5, 2.7, lod, false);
      const side = definition.side,
        wallZ = 3.1 * side;
      box(o, 'brick', [-len / 2, y, wallZ - 0.18], [len / 2, y + 4.35, wallZ + 0.18], M);
      if (lod === 1) continue;
      const bays = Math.max(1, Math.floor(len / (lod === 2 ? 21 : 7)));
      for (let q = 0; q <= bays; q++) {
        const x = -len / 2 + (len * q) / bays;
        tube(
          o,
          'wood',
          M([x, y, -side * 3.1]),
          M([x, y + 4.6, -side * 3.1]),
          0.14,
          lod === 2 ? 4 : 6,
        );
      }
      box(o, 'wood', [-len / 2, y + 4.1, -3.2], [len / 2, y + 4.35, -3], M);
      if (lod === 3 && i % 2 === 0 && j === Math.floor(sections / 2))
        roof(capture, 0, 0, 11, 10, y + 5.3, 3, lod, true);
    }
  }
}
function radialRoof(o, cx, cz, r, y, rise, lod, N = 8) {
  const layers = lod === 3 ? 2 : 1,
    at = (t, i, dy = 0) => {
      const rr = r * (0.2 + 0.8 * t),
        a = (i * 2 * Math.PI) / N + Math.PI / 8;
      return [
        cx + rr * Math.cos(a),
        y + rise * Math.pow(1 - t, 1.6) + 0.7 * Math.pow(t, 8) + dy,
        cz + rr * Math.sin(a),
      ];
    };
  for (let i = 0; i < N; i++)
    for (let j = 0; j < layers; j++) {
      const a = j / layers,
        b = (j + 1) / layers;
      Q(o, 'roof', [at(a, i), at(b, i), at(b, i + 1), at(a, i + 1)], [0, 1, 0]);
      if (lod)
        Q(
          o,
          'wood',
          [at(a, i, -0.14), at(b, i, -0.14), at(b, i + 1, -0.14), at(a, i + 1, -0.14)].reverse(),
          [0, -1, 0],
        );
    }
  cap(
    o,
    'roof',
    Array.from({ length: N }, (_, i) => [at(0, i)[0], at(0, i)[2]]),
    y + rise,
  );
  if (lod)
    for (let i = 0; i < N; i++)
      Q(o, 'wood', [at(1, i), at(1, i + 1), at(1, i + 1, -0.14), at(1, i, -0.14)], null);
  if (lod === 3)
    for (let i = 0; i < N; i++) {
      let last = at(0, i);
      for (let j = 1; j <= layers; j++) {
        const q = at(j / layers, i);
        tube(o, 'trim', last, q, 0.075, 3);
        last = q;
      }
    }
}
function bell(o, lod) {
  const r = native(449263544),
    [x, z, X, Z] = bounds(r),
    cx = (x + X) / 2,
    cz = (z + Z) / 2,
    y = F.bell;
  if (!lod) {
    prism(
      o,
      'wood',
      Array.from({ length: 8 }, (_, i) => [
        cx + 6 * Math.cos((i * Math.PI) / 4),
        cz + 6 * Math.sin((i * Math.PI) / 4),
      ]),
      y,
      y + 15,
    );
  } else {
    prism(o, 'stone', r, y, y + 0.75);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      tube(
        o,
        'wood',
        [cx + 7.6 * Math.cos(a), y, cz + 7.6 * Math.sin(a)],
        [cx + 7.6 * Math.cos(a), y + 15.4, cz + 7.6 * Math.sin(a)],
        0.29,
        lod === 1 ? 4 : lod === 2 ? 5 : 6,
      );
    }
    const ring = Array.from({ length: 8 }, (_, i) => [
      cx + 8 * Math.cos((i * Math.PI) / 4),
      cz + 8 * Math.sin((i * Math.PI) / 4),
    ]);
    prism(o, 'wood', ring, y + 7.7, y + 8.05);
    if (lod >= 2)
      for (let i = 0; i < 8; i++) {
        const a = ring[i],
          b = ring[(i + 1) % 8];
        tube(o, 'wood', [a[0], y + 9.05, a[1]], [b[0], y + 9.05, b[1]], 0.08, 4);
      }
    stairs(o, cx, cz + 1, 2.5, y, 7.6, lod);
    passageEvidence.push({
      component: 'bell-tower-ground-colonnade',
      origin: P([cx + 4, y + 3, cz - 14]),
      direction: P([0, 0, 1]),
      clearDistance: 25,
    });
  }
  for (const [r, y0, h] of [
    [12, y + 5.5, 3.7],
    [10, y + 10.5, 3.3],
    [7.7, y + 14.7, 3.55],
  ])
    radialRoof(o, cx, cz, r, y0, h, lod);
  if (lod) tube(o, 'trim', [cx, y + 18.25, cz], [cx, y + 19.2, cz], 0.18, 5);
  componentEvidence.push({ name: 'bell', center: P([cx, y, cz]), height: 18.25 });
}
function stupa(o, id, name, floors, height, lod) {
  const r = native(id),
    [x, z, X, Z] = bounds(r),
    cx = (x + X) / 2,
    cz = (z + Z) / 2,
    y = F[name],
    baseR = (X - x) * 0.45,
    coreR = baseR * 0.62,
    baseH = name === 'stupa' ? 6 : 2,
    step = (height - baseH - 9) / floors,
    ring = (rr, N = lod ? 8 : 4) =>
      Array.from({ length: N }, (_, i) => [
        cx + rr * Math.cos((i * 2 * Math.PI) / N + Math.PI / 8),
        cz + rr * Math.sin((i * 2 * Math.PI) / N + Math.PI / 8),
      ]);
  if (lod < 2) prism(o, 'brick', ring(coreR), y, y + height - 8);
  else prism(o, 'stone', r, y, y + baseH);
  for (let i = 0; i < floors; i++) {
    const yy = y + baseH + i * step,
      rr = coreR * (1 - (0.24 * i) / floors);
    if (lod >= 2) {
      const shell = ring(rr);
      if (lod === 3 || (lod === 2 && i % 2 === 0))
        wall(o, 'brick', shell, yy, yy + step - 0.65, lod, {
          component: `${name}-storey-${i + 1}`,
        });
      else prism(o, 'brick', shell, yy, yy + step - 0.65);
    }
    const rim = ring(rr + Math.min(1.55, step * 0.4));
    if (lod >= 2) prism(o, 'trim', rim, yy + step - 0.65, yy + step - 0.45);
    else cap(o, 'trim', rim, yy + step - 0.45);
    if (lod >= 2) radialRoof(o, cx, cz, rr + 1.5, yy + step - 0.4, 1, lod);
  }
  const top = y + height - 9;
  const crown = ring(coreR * 0.35);
  prism(o, 'trim', crown, top, top + 2);
  for (let j = 0; j < 3; j++)
    prism(o, 'trim', ring(coreR * (0.28 - 0.06 * j)), top + 2 + j * 1.5, top + 3.1 + j * 1.5);
  tube(o, 'trim', [cx, top + 5, cz], [cx, y + height, cz], 0.22, lod ? 6 : 3);
  componentEvidence.push({ name, center: P([cx, y, cz]), height, floors });
}
function fretTower(o, cx, cz, d, y, lod) {
  if (!lod) {
    box(o, 'wood', [cx - 5, y + 7.9, cz - d * 0.33], [cx + 5, y + 14, cz + d * 0.33]);
    return;
  }
  const cy = y + 12.2,
    radius = 1.35,
    N = lod === 1 ? 4 : lod === 2 ? 8 : 16;
  const angles = [
    ...new Set([
      ...Array.from({ length: N }, (_, i) => (i * 2 * Math.PI) / N),
      ...[-5, 5].flatMap((x) =>
        [y + 7.9, y + 14].map((Y) => (Math.atan2(Y - cy, x) + 2 * Math.PI) % (2 * Math.PI)),
      ),
    ]),
  ].sort((a, b) => a - b);
  for (const side of [-1, 1]) {
    const z = cz + side * d * 0.33;
    const at = (a, outer = false) => {
      const c = Math.cos(a),
        s = Math.sin(a);
      const r = outer
        ? Math.min(
            5 / Math.max(1e-12, Math.abs(c)),
            (s > 0 ? y + 14 - cy : cy - y - 7.9) / Math.max(1e-12, Math.abs(s)),
          )
        : radius;
      return [cx + r * c, cy + r * s, z];
    };
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i],
        b = angles[(i + 1) % angles.length],
        aa = at(a),
        bb = at(b);
      Q(o, 'wood', [aa, bb, at(b, true), at(a, true)], [0, 0, side]);
      Q(
        o,
        'wood',
        [aa, bb, [bb[0], bb[1], z - side * 0.3], [aa[0], aa[1], z - side * 0.3]],
        [cx - (aa[0] + bb[0]) / 2, cy - (aa[1] + bb[1]) / 2, 0],
      );
    }
    if (lod === 3)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        tube(
          o,
          'wood',
          [cx, cy, z],
          [cx + radius * Math.cos(a), cy + radius * Math.sin(a), z],
          0.045,
          4,
        );
      }
  }
  for (const side of [-1, 1])
    Q(
      o,
      'wood',
      [
        [cx + side * 5, y + 7.9, cz - d * 0.33],
        [cx + side * 5, y + 14, cz - d * 0.33],
        [cx + side * 5, y + 14, cz + d * 0.33],
        [cx + side * 5, y + 7.9, cz + d * 0.33],
      ],
      [side, 0, 0],
    );
  for (const Y of [y + 7.9, y + 14])
    Q(
      o,
      'wood',
      [
        [cx - 5, Y, cz - d * 0.33],
        [cx + 5, Y, cz - d * 0.33],
        [cx + 5, Y, cz + d * 0.33],
        [cx - 5, Y, cz + d * 0.33],
      ],
      [0, Y > y + 10 ? 1 : -1, 0],
    );
}
function gateway(o, cx, cz, w, d, y, lod, stone = false) {
  const k = stone ? 'stone' : 'wood',
    columns = [-0.44, -0.147, 0.147, 0.44];
  for (const t of columns)
    box(o, k, [cx + w * t - 1, y, cz - d / 2], [cx + w * t + 1, y + 8, cz + d / 2]);
  if (stone) {
    for (const [t, h] of [
      [-0.3, 10],
      [0, 14],
      [0.3, 10],
    ]) {
      box(
        o,
        'stone',
        [cx + w * t - w * 0.15, y + h - 1, cz - d / 2],
        [cx + w * t + w * 0.15, y + h, cz + d / 2],
      );
      roof(o, cx + w * t, cz, w * 0.34, d + 1, y + h, 2.5, lod);
    }
  } else {
    roof(o, cx, cz, w + 1, d + 1, y + 8, 4, lod);
    fretTower(o, cx, cz, d, y, lod);
    for (const side of [-1, 1])
      roof(o, cx + side * w * 0.29, cz, w * 0.34, d * 0.8, y + 10.5, 2, lod);
    roof(o, cx, cz, w * 0.34, d * 0.65, y + 14, 2.5, lod);
  }
  if (lod) stairs(o, cx, cz - d / 2, w * 0.7, y - 0.8, 0.8, lod);
  passageEvidence.push({
    component: stone ? 'outer-three-gates' : 'inner-wooden-three-gates',
    origin: P([cx, y + 4, cz - d / 2 - 1]),
    direction: P([0, 0, 1]),
    clearDistance: d + 2,
  });
}
function ancient(o, lod) {
  for (const [i, id] of [5544886521, 11163115162, 11162911005].entries()) {
    const point = f.ancientShrinePoints.find((e) => e.id === `node/${id}`),
      [cx, cz] = uv(point.local),
      w = [9, 5, 8][i],
      d = [6, 4, 5][i],
      y = F.ancientShrines + i * 2,
      r = rect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    if (lod) prism(o, 'stone', r, y - 0.5, y);
    wall(o, 'brick', r, y, y + 3, lod, {
      component: `ancient-original-estimate-${id}`,
      frontOnly: true,
    });
    cap(o, 'wood', r, y + 3);
    roof(o, cx, cz, w + 1, d + 1, y + 3, 2, lod);
    if (lod) stairs(o, cx, cz - d / 2, w * 0.65, y - 0.6, 0.6, lod);
    componentEvidence.push({
      name: `ancient-original-estimate-${id}`,
      center: P([cx, y, cz]),
      height: 5,
      unmappedOriginalPlan: true,
    });
  }
  const point = f.ancientShrinePoints.find((e) => e.id === 'node/11162900606'),
    [cx, cz] = uv(point.local),
    y = F.ancientShrines - 1;
  for (const x of [cx - 1.4, cx + 1.4])
    box(o, 'stone', [x - 0.25, y, cz - 0.25], [x + 0.25, y + 2.8, cz + 0.25]);
  box(o, 'stone', [cx - 1.65, y + 2.8, cz - 0.3], [cx + 1.65, y + 3.2, cz + 0.3]);
}
export function buildBaiDinh(o, _frame, lod = 3) {
  openingEvidence.length = 0;
  passageEvidence.length = 0;
  componentEvidence.length = 0;
  for (const feature of f.features) {
    const r = feature.outline.slice(0, -1).map(uv),
      id = Number(feature.id.slice(4)),
      which =
        id === 449263543
          ? 'phapChu'
          : id === 449263544
            ? 'bell'
            : id === 449263545
              ? 'outerGate'
              : id === 449263547
                ? 'tamThe'
                : id === 449266754
                  ? 'quanAm'
                  : id === 474584441
                    ? 'stupa'
                    : id === 1158512209
                      ? 'smallTower'
                      : null,
      base = (q) => (which ? F[which] : grade(q[1]));
    if (lod) prism(o, 'stone', r, (q) => base(q) - 0.45, base);
    else cap(o, 'stone', r, base);
    if (!lod && !which) cap(o, 'roof', r, (q) => base(q) + 4.5);
  }
  for (const [id, name] of [
    [449263543, 'phapChu'],
    [449263547, 'tamThe'],
    [449266754, 'quanAm'],
  ])
    hall(o, id, name, lod);
  for (const definition of paths) gallery(o, definition, lod);
  bell(o, lod);
  stupa(o, 474584441, 'stupa', 13, 100, lod);
  stupa(o, 1158512209, 'smallTower', 7, 20, lod);
  const b = bounds(native(449263545));
  gateway(
    o,
    (b[0] + b[2]) / 2,
    (b[1] + b[3]) / 2,
    b[2] - b[0],
    b[3] - b[1],
    F.outerGate,
    lod,
    true,
  );
  gateway(o, -60, -531, 32, 13, F.innerGate, lod);
  ancient(o, lod);
}
export const baiDinhSkyline = (o) => buildBaiDinh(o, null, 0),
  baiDinhDistrict = (o) => buildBaiDinh(o, null, 1),
  baiDinhStreet = (o) => buildBaiDinh(o, null, 2),
  baiDinhCloseup = (o) => buildBaiDinh(o, null, 3);
export const baiDinhModel = {
  id: 'bai_dinh_temple',
  key: 'bai_dinh_temple',
  cell: 'w7/w7e',
  title: 'Bái Đính Temple',
  wikidataId: 'Q3360468',
  recipe: 'bai-dinh-temple-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'religious',
  brief:
    'Whole temple architectural ensemble: three large tiered-roof worship halls with recessed timber entrances/round windows/verandas/stone terraces, separate wooden inner and pale stone northern gateways with actual open passages, octagonal three-roof Bell Tower,13-storey100m Bao Thien stupa, small Tu An tower and complete native long stepped galleries/crossgable pavilions. Original small ancient mountain shrine exterior/portal estimates at separately identified native points retain the old part of the site without pretending surveyed plans. Natural mountain/caves, courts/ponds/gardens/roads/parking/convention center/restaurants/neighbors/sculpture/interiors excluded.',
  surfaces,
  build: buildBaiDinh,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: P([180, 145, 150]),
  lookAt: P([-100, 60, 200]),
  portableGroundY: -25,
  mediumFiContext: { scale: '1', groundY: -25 },
  qaCameras: [
    {
      name: 'whole-complex-both-gates-halls-towers-and-galleries',
      position: P([1150, 650, -1050]),
      lookAt: P([-65, 45, -130]),
    },
    {
      name: 'whole-ancient-shrines-and-uphill-halls',
      position: P([-1100, 700, 1150]),
      lookAt: P([-60, 55, -80]),
    },
    {
      name: 'tam-the-three-roofs-porch-and-entry-recesses',
      position: P([42, 82, 217]),
      lookAt: P([-50, 69, 300]),
    },
    {
      name: 'phap-chu-hall-and-stepped-gallery',
      position: P([65, 48, -22]),
      lookAt: P([-55, 39, 45]),
    },
    {
      name: 'inner-gates-and-open-octagonal-bell-tower',
      position: P([60, 42, -470]),
      lookAt: P([-60, 7, -430]),
    },
    {
      name: 'bao-thien-thirteen-storey-stupa-and-small-tu-an-tower',
      position: P([-90, 97, 15]),
      lookAt: P([-233, 87, 120]),
    },
    {
      name: 'whole-native-temple-layout-and-old-shrines',
      position: P([-50, 2000, -50]),
      lookAt: P([-50, 20, -40]),
    },
    {
      name: 'ancient-shrine-point-based-original-exterior-estimates',
      position: P([405, 145, 475]),
      lookAt: P([343, 123, 535]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/bai-dinh-runtime-overlay.mjs',
    level: 'skyline',
    export: 'baiDinhSkyline',
    errorMeters: 4,
    surfaces,
    authoredLevels: {
      district: { export: 'baiDinhDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'baiDinhStreet', errorMeters: 0.5, surfaces },
      closeup: { export: 'baiDinhCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Thirteen independent2017 creatorPD-self/own exact exterior originals accepted after Qualla-first search. Published Qualla PD-labelled originals lack bound local basis and remain unselected; native original X21/X23 show interiors and are unselected. No source rightsmetadata repairs, copied pixels, generated bitmap, sculpture/statue/carved inscription copies or interiors. Ancient mountain shrine plans/roof and door forms are original lower-confidence textual/typological estimates at named native points; accepted exteriors do not certify those hidden components.',
    'Original1600m513x513263169sample field/six raw tiles frozen before floors/sections/geometry. Fixed23.1041m provider-relative datum unchanged; primary official Tam The76m altitude is not a surveyed tie to Terrarium. Other floor/section/hidden elevation/currentfinish/census/crest/ridge estimates are not surveys. Field never fitted/flattened/reacquired; no whole-property slab. All geographic placement stays preview/replacementfalse pending foundations/grade. Review flat ground and procedural context are synthetic fixtures.',
  ],
};
