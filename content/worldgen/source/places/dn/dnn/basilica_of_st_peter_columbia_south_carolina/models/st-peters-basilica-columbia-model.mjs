/** Whole native Columbia church compound; original Gothic exterior and bounded modern wing. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters,
  TAU = Math.PI * 2;
const C = {
  brick: rgb('986655'),
  wing: rgb('a67f6d'),
  stone: rgb('ddd8c7'),
  roof: rgb('71807b'),
  glass: rgb('657e79'),
  door: rgb('756244'),
  metal: rgb('738471'),
  dark: rgb('48534e'),
};
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ffffff',
    roughness: 0.3,
    metallic: 0.07,
    alphaMode: 'OPAQUE',
  },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.12 },
};
export const nativeEvidence = [],
  recessEvidence = [],
  roofEvidence = [],
  partEvidence = [],
  spireEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  mean = (q) => q[0].map((_, i) => q.reduce((s, v) => s + v[i], 0) / q.length),
  clamp = (x) => Math.max(0, Math.min(1, x));
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], q[1] + F, U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
const R = frame.geometry.outline
  .slice(0, -1)
  .map(([x, z]) => [x * U[0] + z * U[1], x * V[0] + z * V[1]]);
function T(o, k, q, n, col = C[k] ?? C.stone) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-9) return;
  if (n && dot(cr, direction(n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => [v[0] + v[2], v[1]]),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
const area = (r) =>
  r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function triangles(r) {
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
      if (cr(r[a], r[b], r[c]) < 1e-8) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-8 &&
            cr(r[b], r[c], r[k]) >= -1e-8 &&
            cr(r[c], r[a], r[k]) >= -1e-8,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid compound polygon');
  }
  if (Math.abs(cr(...ids.map((i) => r[i]))) > 1e-8) out.push(ids);
  return out;
}
function cap(o, k, r, y, up, col) {
  for (const ids of triangles(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y0, y1, col) {
  const rr = area(r) > 0 ? r : r.slice().reverse();
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length];
    Q(
      o,
      k,
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
  cap(o, k, r, y0, false, col);
  cap(o, k, r, y1, true, col);
}
const rect = (x, X, z, Z) => [
  [x, z],
  [X, z],
  [X, Z],
  [x, Z],
];
function box(o, k, x, X, y, Y, z, Z, col) {
  solid(o, k, rect(x, X, z, Z), y, Y, col);
}
function external(a, b) {
  return R.some((q, i) => {
    const r = R[(i + 1) % R.length],
      v = sub(r, q),
      L = Math.hypot(...v),
      test = (s) =>
        Math.abs(v[0] * (s[1] - q[1]) - v[1] * (s[0] - q[0])) / L < 1e-5 &&
        dot(sub(s, q), v) > -1e-5 &&
        dot(sub(s, r), v) < 1e-5;
    return test(a) && test(b);
  });
}
function curve(t) {
  return (
    Math.sqrt(Math.max(0, 1 - (1 - Math.min(t, 1 - t)) * (1 - Math.min(t, 1 - t)))) /
    Math.sqrt(0.75)
  );
}
/** A wall whose actual openings have closed recessed backs, returns and original simple tracery. */
function wall(o, a, b, y0, y1, holes, lod, k = 'brick', col = C[k]) {
  // Separate stacked opening rows before cutting horizontal spans, so upper masonry cannot
  // cover a lower doorway or window. Repeated windows within one row share the same band.
  const rows = [];
  for (const h of holes.slice().sort((a, b) => a.bottom - b.bottom)) {
    const top = h.bottom + h.height;
    if (h.bottom <= y0 || top >= y1) continue;
    if (rows.length && h.bottom <= rows.at(-1)[1]) rows.at(-1)[1] = Math.max(top, rows.at(-1)[1]);
    else rows.push([h.bottom, top]);
  }
  if (rows.length > 1) {
    const cuts = [y0, ...rows.slice(0, -1).map((r, i) => (r[1] + rows[i + 1][0]) / 2), y1];
    for (let i = 0; i < cuts.length - 1; i++)
      wall(
        o,
        a,
        b,
        cuts[i],
        cuts[i + 1],
        holes.filter((h) => h.bottom > cuts[i] && h.bottom + h.height < cuts[i + 1]),
        lod,
        k,
        col,
      );
    return;
  }
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    u = [dx / L, 0, dz / L],
    n = [dz / L, 0, -dx / L],
    P = (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[2] * t + n[2] * d];
  const list = holes
      .filter(
        (h) =>
          h.center - h.width / 2 > 0.02 &&
          h.center + h.width / 2 < L - 0.02 &&
          h.bottom > y0 + 0.02 &&
          h.bottom + h.height < y1 - 0.02,
      )
      .sort((a, b) => a.center - b.center),
    patch = (l, r, lo, hi) => {
      if (r - l > 0.00001 && hi - lo > 0.00001)
        Q(o, k, [P(l, lo), P(r, lo), P(r, hi), P(l, hi)], n, col);
    };
  if (lod === 0) {
    patch(0, L, y0, y1);
    for (const h of list) {
      const l = h.center - h.width / 2,
        r = h.center + h.width / 2,
        top = h.bottom + h.height;
      Q(
        o,
        'glass',
        [
          P(l, h.bottom, 0.025),
          P(r, h.bottom, 0.025),
          P(r, top - (h.shape === 'rect' ? 0 : h.width * 0.45), 0.025),
          P(l, top - (h.shape === 'rect' ? 0 : h.width * 0.45), 0.025),
        ],
        n,
        h.door ? C.door : h.louver ? C.dark : C.glass,
      );
      if (h.shape !== 'rect')
        T(
          o,
          'glass',
          [
            P(l, top - h.width * 0.45, 0.025),
            P(r, top - h.width * 0.45, 0.025),
            P(h.center, top, 0.025),
          ],
          n,
          h.louver ? C.dark : C.glass,
        );
    }
    return;
  }
  let left = 0;
  for (const h of list) {
    const l = h.center - h.width / 2,
      r = h.center + h.width / 2,
      N = h.shape === 'rect' ? 1 : h.shape === 'circle' && lod === 1 ? 4 : [2, 2, 8, 16][lod],
      rise = h.width * 0.68,
      shoulder = h.bottom + h.height - rise,
      ys = (t) =>
        h.shape === 'circle'
          ? [
              h.bottom +
                h.height / 2 -
                Math.sqrt(
                  Math.max(
                    0,
                    (h.width / 2) * (h.width / 2) - (t - 0.5) * h.width * ((t - 0.5) * h.width),
                  ),
                ),
              h.bottom +
                h.height / 2 +
                Math.sqrt(
                  Math.max(
                    0,
                    (h.width / 2) * (h.width / 2) - (t - 0.5) * h.width * ((t - 0.5) * h.width),
                  ),
                ),
            ]
          : [h.bottom, h.shape === 'rect' ? h.bottom + h.height : shoulder + rise * curve(t)];
    patch(left, l, y0, y1);
    left = r;
    const top = [],
      bottom = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        x = l + h.width * t,
        [lo, hi] = ys(t);
      top.push([x, hi]);
      bottom.push([x, lo]);
    }
    for (let i = 0; i < N; i++) {
      const a = top[i],
        b = top[i + 1],
        c = bottom[i],
        d = bottom[i + 1];
      Q(o, k, [P(c[0], y0), P(d[0], y0), P(d[0], d[1]), P(c[0], c[1])], n, col);
      Q(o, k, [P(a[0], a[1]), P(b[0], b[1]), P(b[0], y1), P(a[0], y1)], n, col);
    }
    const polygon = [...bottom, ...top.slice().reverse()].filter(
      (q, i, a) => !i || Math.hypot(q[0] - a[i - 1][0], q[1] - a[i - 1][1]) > 1e-7,
    );
    if (Math.hypot(...sub(polygon[0], polygon.at(-1))) < 1e-7) polygon.pop();
    const centre = mean(polygon),
      depth = h.depth ?? A.windowDepth;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        v = [P(a[0], a[1]), P(b[0], b[1]), P(b[0], b[1], -depth), P(a[0], a[1], -depth)];
      Q(o, 'stone', v, sub(P(centre[0], centre[1]), mean([v[0], v[1]])), C.stone);
      T(
        o,
        'glass',
        [P(centre[0], centre[1], -depth), P(a[0], a[1], -depth), P(b[0], b[1], -depth)],
        n,
        h.door ? C.door : h.louver ? C.dark : C.glass,
      );
      const radial = (q) => [
          q[0] + Math.sign(q[0] - centre[0]) * 0.115,
          q[1] + Math.sign(q[1] - centre[1]) * 0.115,
        ],
        aa = radial(a),
        bb = radial(b);
      Q(
        o,
        'stone',
        [
          P(a[0], a[1], 0.035),
          P(b[0], b[1], 0.035),
          P(bb[0], bb[1], 0.035),
          P(aa[0], aa[1], 0.035),
        ],
        n,
        C.stone,
      );
    }
    if (lod > 1 && !h.louver) {
      if (h.shape === 'circle') {
        const count = lod === 2 ? 8 : 12;
        for (let i = 0; i < count; i++) {
          const a = (i * TAU) / count;
          B(
            o,
            'stone',
            P(centre[0] + 0.22 * Math.cos(a), centre[1] + 0.22 * Math.sin(a), -0.17),
            P(
              centre[0] + h.width * 0.47 * Math.cos(a),
              centre[1] + h.width * 0.47 * Math.sin(a),
              -0.17,
            ),
            0.055,
            0.07,
            C.stone,
          );
        }
      } else {
        const count = h.width > 1.6 ? 2 : 1;
        for (let i = 1; i <= count; i++) {
          const t = l + (h.width * i) / (count + 1),
            top = h.shape === 'rect' ? h.bottom + h.height - 0.06 : shoulder + 0.08;
          B(
            o,
            h.door ? 'metal' : 'stone',
            P(t, h.bottom + 0.03, -0.17),
            P(t, top, -0.17),
            h.door ? 0.045 : 0.07,
            0.07,
            h.door ? C.door : C.stone,
          );
        }
        if (!h.door && h.shape !== 'rect')
          for (const s of [-1, 1])
            B(
              o,
              'stone',
              P(h.center, shoulder - h.width * 0.6, -0.17),
              P(h.center + s * h.width * 0.31, shoulder + h.width * 0.15, -0.17),
              0.06,
              0.07,
              C.stone,
            );
        if (lod === 3)
          for (let j = 1; j <= 2; j++)
            B(
              o,
              'metal',
              P(l + 0.07, h.bottom + (h.height * j) / 3, -0.18),
              P(r - 0.07, h.bottom + (h.height * j) / 3, -0.18),
              0.027,
              0.035,
              h.door ? C.door : C.dark,
            );
      }
    }
    if (h.louver) {
      const count = [0, 4, 10, 18][lod];
      for (let i = 0; i < count; i++) {
        const y = h.bottom + 0.16 + ((h.height - 0.35) * i) / count,
          t = clamp((y + 0.12 - shoulder) / rise);
        let a = 0,
          b = 0.5;
        for (let j = 0; j < 12; j++) {
          const m = (a + b) / 2;
          if (curve(m) < t) a = m;
          else b = m;
        }
        const hw = h.width * (0.5 - (a + b) / 2) - 0.08;
        if (hw > 0.05) {
          const width = 0.15;
          Q(
            o,
            'metal',
            [
              P(h.center - hw, y, -0.13),
              P(h.center + hw, y, -0.13),
              P(h.center + hw, y + width, -0.25),
              P(h.center - hw, y + width, -0.25),
            ],
            [n[0] * 0.5, 0.6, n[2] * 0.5],
            C.dark,
          );
          if (lod > 1)
            Q(
              o,
              'metal',
              [
                P(h.center - hw, y, -0.13),
                P(h.center + hw, y, -0.13),
                P(h.center + hw, y - 0.035, -0.13),
                P(h.center - hw, y - 0.035, -0.13),
              ],
              n,
              C.dark,
            );
        }
      }
    }
    recessEvidence.push({
      label: h.label ?? 'original-estimated-window',
      normal: n,
      front: P(centre[0], centre[1]),
      probe: P(
        h.center + h.width * 0.19,
        h.shape === 'circle' ? centre[1] + h.height * 0.13 : h.bottom + h.height * 0.29,
      ),
      depth,
      door: !!h.door,
      louver: !!h.louver,
      shape: h.shape ?? 'pointed',
    });
  }
  patch(left, L, y0, y1);
}
function polyWalls(o, r, y0, y1, lod, { windows = false, wing = false, label = 'church' } = {}) {
  const rr = area(r) > 0 ? r : r.slice().reverse();
  for (let i = 0; i < rr.length; i++) {
    const a = rr[i],
      b = rr[(i + 1) % rr.length],
      L = Math.hypot(...sub(b, a)),
      holes = [];
    // The entrance tower authors these three exterior faces, including its real door recess.
    if (
      label === 'church' &&
      y0 === 0 &&
      [15, 16, 17].some((j) => {
        const c = R[j],
          d = R[j + 1];
        return (a === c && b === d) || (a === d && b === c);
      })
    )
      continue;
    if (windows && external(a, b) && L > 3) {
      const spacing = wing ? [16, 10, 4.5, 3.8][lod] : [9, 7, 4, 3.5][lod],
        count = Math.max(1, Math.floor(L / spacing));
      for (let j = 0; j < count; j++)
        for (const y of wing && lod > 1 ? [1.1, 4.3] : [wing ? 2.2 : 1.7])
          holes.push({
            center: (L * (j + 0.5)) / count,
            width: wing ? 1.25 : 1.1,
            bottom: y,
            height: wing ? 1.6 : 4.4,
            shape: wing ? 'rect' : 'pointed',
            label: label + (wing ? '-wing-rectangle' : '-lower-lancet'),
          });
    }
    wall(o, a, b, y0, y1, holes, lod, 'brick', wing ? C.wing : C.brick);
  }
  cap(o, 'brick', r, y0, false, wing ? C.wing : C.brick);
  cap(o, 'brick', r, y1, true, wing ? C.wing : C.brick);
}
function clip(r, axis, value, less) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = (q) => (less ? q[axis] <= value + 1e-9 : q[axis] >= value - 1e-9),
      A = inside(a),
      B = inside(b);
    if (A) out.push(a);
    if (A !== B) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      out.push(a.map((v, j) => v + (b[j] - v) * t));
    }
  }
  return out;
}
function gable(o, x, X, z, Z, eave, ridge, axis = 'x') {
  const P = axis === 'x' ? (q) => q : (q) => [q[2], q[1], q[0]],
    a = axis === 'x' ? x : z,
    b = axis === 'x' ? X : Z,
    c = axis === 'x' ? z : x,
    d = axis === 'x' ? Z : X,
    m = (c + d) / 2;
  for (const sign of [-1, 1]) {
    const side = sign < 0 ? c : d;
    Q(
      o,
      'roof',
      [
        [a, eave, side],
        [b, eave, side],
        [b, ridge, m],
        [a, ridge, m],
      ].map(P),
      axis === 'x' ? [0, 0.5, sign] : [sign, 0.5, 0],
    );
  }
  for (const [u, sign] of [
    [a, -1],
    [b, 1],
  ])
    T(
      o,
      'brick',
      [
        [u, eave, c],
        [u, eave, d],
        [u, ridge, m],
      ].map(P),
      axis === 'x' ? [sign, 0, 0] : [0, 0, sign],
      C.brick,
    );
  Q(
    o,
    'roof',
    [
      [a, eave, c],
      [b, eave, c],
      [b, eave, d],
      [a, eave, d],
    ].map(P),
    [0, -1, 0],
  );
  roofEvidence.push({ type: 'gable', axis, x0: x, x1: X, z0: z, z1: Z, eave, ridge });
}
function loft(o, k, c, profile, N, col) {
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const [y, r] = profile[j],
        [Y, R] = profile[j + 1],
        a = (i * TAU) / N + Math.PI / 8,
        b = ((i + 1) * TAU) / N + Math.PI / 8,
        P = (a, y, r) => [c[0] + r * Math.cos(a), y, c[1] + r * Math.sin(a)];
      Q(
        o,
        k,
        [P(a, y, r), P(b, y, r), P(b, Y, R), P(a, Y, R)],
        [Math.cos((a + b) / 2), (r - R) / (Y - y || 1), Math.sin((a + b) / 2)],
        col,
      );
    }
  for (const [j, up] of [
    [0, -1],
    [profile.length - 1, 1],
  ]) {
    const [y, r] = profile[j];
    for (let i = 0; i < N; i++)
      T(
        o,
        k,
        [
          [c[0], y, c[1]],
          [
            c[0] + r * Math.cos((i * TAU) / N + Math.PI / 8),
            y,
            c[1] + r * Math.sin((i * TAU) / N + Math.PI / 8),
          ],
          [
            c[0] + r * Math.cos(((i + 1) * TAU) / N + Math.PI / 8),
            y,
            c[1] + r * Math.sin(((i + 1) * TAU) / N + Math.PI / 8),
          ],
        ],
        [0, up, 0],
        col,
      );
  }
}
function pinnacle(o, c, y, h, lod) {
  loft(
    o,
    'stone',
    c,
    [
      [y, 0.28],
      [y + 0.35, 0.28],
      [y + h - 0.3, 0.07],
      [y + h, 0.015],
    ],
    lod === 0 ? 4 : 8,
    C.stone,
  );
  if (lod > 1)
    for (let j = 0; j < (lod === 2 ? 2 : 4); j++)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2,
          r = 0.22 * (1 - j / 5),
          cy = y + 0.8 + (j * (h - 1.2)) / (lod === 2 ? 2 : 4);
        loft(
          o,
          'stone',
          [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)],
          [
            [cy, 0.085],
            [cy + 0.18, 0.015],
          ],
          4,
          C.stone,
        );
      }
}
function body(o, lod) {
  solid(o, 'brick', R, A.foundationBottom, 0, C.brick);
  nativeEvidence.push(...R.map((q) => [q[0], A.foundationBottom, q[1]]));
  const Z = R[36][1],
    E = [R[18][0], Z],
    v = R[20][1],
    t = (v - R[33][1]) / (R[34][1] - R[33][1]),
    S = [R[33][0] + (R[34][0] - R[33][0]) * t, v],
    church = [...R.slice(0, 19), E, ...R.slice(36)],
    wing = [...R.slice(20, 34), S],
    connector = [S, ...R.slice(34, 37), E, ...R.slice(19, 21)];
  for (const [name, r, h] of [
    ['church', church, A.aisleEave],
    ['north-wing', wing, A.northWingEave],
    ['east-connector', connector, A.connectorEave],
  ]) {
    polyWalls(o, r, 0, h, lod, { windows: true, wing: name !== 'church', label: name });
    partEvidence.push({ name, outline: r, top: h, originalPartitionEstimate: true });
  }
  cap(o, 'roof', wing, A.northWingEave + 0.04, true, C.roof);
  for (let i = 0; i < wing.length; i++)
    if (external(wing[i], wing[(i + 1) % wing.length])) {
      const a = wing[i],
        b = wing[(i + 1) % wing.length];
      B(
        o,
        'stone',
        [a[0], A.northWingParapet, a[1]],
        [b[0], A.northWingParapet, b[1]],
        0.18,
        0.24,
        C.stone,
      );
    }
  cap(o, 'roof', connector, A.connectorEave + 0.04, true, C.roof);
  const cuts = [
      -100,
      A.naveCenterZ - 10.6,
      A.naveCenterZ - A.naveHalfWidth,
      A.naveCenterZ + A.naveHalfWidth,
      A.naveCenterZ + 10.6,
      100,
    ],
    height = (q) =>
      A.aisleEave +
      (A.aisleHigh - A.aisleEave) *
        clamp((10.6 - Math.abs(q[1] - A.naveCenterZ)) / (10.6 - A.naveHalfWidth));
  for (let i = 0; i < cuts.length - 1; i++) {
    const r = clip(clip(church, 1, cuts[i], false), 1, cuts[i + 1], true);
    if (r.length > 2) cap(o, 'roof', r, (q) => height(q) + 0.045, true, C.roof);
  }
  const z = A.naveCenterZ,
    h = A.naveHalfWidth,
    upper = rect(A.naveStartX, A.naveEndX, z - h, z + h);
  for (let i = 0; i < 4; i++) {
    const a = upper[i],
      b = upper[(i + 1) % 4],
      holes = [];
    if (i === 0 || i === 2)
      for (let j = 0; j < 5; j++) {
        const x = 8.7 + j * 3.58,
          t = i === 0 ? x - a[0] : a[0] - x;
        holes.push({
          center: t,
          width: 1.17,
          bottom: 10.45,
          height: 2.43,
          label: 'five-bay-clerestory',
        });
      }
    wall(o, a, b, A.aisleEave, A.naveEave, holes, lod);
  }
  cap(o, 'brick', upper, A.naveEave, true, C.brick);
  gable(o, A.naveStartX, A.naveEndX, z - h, z + h, A.naveEave, A.naveRidge);
  const tx = A.transeptWestX,
    TX = A.transeptEastX,
    tz = A.transeptNorthZ,
    TZ = A.transeptSouthZ,
    tc = (tx + TX) / 2;
  const rr = rect(tx, TX, tz, TZ);
  for (let i = 0; i < 4; i++) {
    const a = rr[i],
      b = rr[(i + 1) % 4],
      holes = [];
    if (i === 0 || i === 2)
      holes.push({
        center: (TX - tx) / 2,
        width: A.roseRadius * 2,
        bottom: 11.2 - A.roseRadius,
        height: A.roseRadius * 2,
        shape: 'circle',
        label: 'twelve-foot-transept-rose',
      });
    wall(o, a, b, A.aisleEave, A.transeptEave, holes, lod);
  }
  cap(o, 'brick', rr, A.transeptEave, true, C.brick);
  gable(o, tx, TX, tz, TZ, A.transeptEave, A.transeptRidge, 'z');
  const N = lod === 0 ? 4 : lod === 1 ? 6 : 12,
    arc = Array.from({ length: N + 1 }, (_, i) => [
      A.apseCenterX - A.apseRadius * Math.sin((i * Math.PI) / N),
      z + A.apseRadius * Math.cos((i * Math.PI) / N),
    ]);
  polyWalls(o, arc, A.aisleEave, A.apseEave, lod, { windows: false });
  for (let i = 0; i < arc.length - 1; i++)
    T(
      o,
      'roof',
      [
        [arc[i][0], A.apseEave, arc[i][1]],
        [arc[i + 1][0], A.apseEave, arc[i + 1][1]],
        [A.apseCenterX, A.apseCrown, z],
      ],
      [arc[i][0] - A.apseCenterX, 0.6, arc[i][1] - z],
      C.roof,
    );
  if (lod > 0) {
    for (const s of [-1, 1]) {
      const zz = z + s * h;
      B(
        o,
        'stone',
        [A.naveStartX, A.naveEave, zz],
        [A.naveEndX, A.naveEave, zz],
        0.15,
        0.24,
        C.stone,
      );
      if (lod > 1)
        for (let i = 0; i < 6; i++) {
          const x = 7.2 + i * 3.58;
          box(
            o,
            'brick',
            x - 0.18,
            x + 0.18,
            A.aisleHigh,
            A.naveEave,
            zz - 0.16,
            zz + 0.16,
            C.brick,
          );
        }
    }
    for (const zz of [tz, TZ]) {
      B(o, 'stone', [tx, A.transeptEave, zz], [tc, A.transeptRidge, zz], 0.15, 0.18, C.stone);
      B(o, 'stone', [tc, A.transeptRidge, zz], [TX, A.transeptEave, zz], 0.15, 0.18, C.stone);
    }
    if (lod > 1)
      for (const sign of [-1, 1])
        for (let i = 0; i < 6; i++) {
          const x = 8.1 + i * 3.58,
            ints = [];
          for (let j = 0; j < church.length; j++) {
            const a = church[j],
              b = church[(j + 1) % church.length];
            if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
              ints.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
          }
          if (!ints.length) continue;
          const zz = sign < 0 ? Math.min(...ints) : Math.max(...ints);
          if (
            recessEvidence.some(
              (e) =>
                e.label === 'church-lower-lancet' &&
                Math.abs(e.front[0] - x) < 1.02 &&
                Math.abs(e.front[2] - zz) < 0.1,
            )
          )
            continue;
          box(o, 'brick', x - 0.3, x + 0.3, 0, 6.1, zz - 0.38, zz + 0.38, C.brick);
          box(o, 'stone', x - 0.35, x + 0.35, 6.1, 6.32, zz - 0.41, zz + 0.41, C.stone);
          box(o, 'brick', x - 0.2, x + 0.2, 6.32, 7.7, zz - 0.26, zz + 0.26, C.brick);
        }
    if (lod === 3)
      for (const s of [-1, 1])
        for (let i = 0; i < 44; i++) {
          const x = 7.3 + i * 0.44,
            zz = z + s * (h + 0.04),
            r = 0.15,
            cy = A.naveEave - 0.35;
          for (let j = 0; j < 4; j++) {
            const a = (j * Math.PI) / 4,
              b = ((j + 1) * Math.PI) / 4;
            B(
              o,
              'brick',
              [x + r * Math.cos(a), cy + r * Math.sin(a), zz],
              [x + r * Math.cos(b), cy + r * Math.sin(b), zz],
              0.055,
              0.07,
              C.brick,
            );
          }
        }
  }
}
export function towerFace(face, t, y, d = 0) {
  const x = A.towerCenterX,
    z = A.towerCenterZ,
    h = A.towerHalfWidth;
  return [
    [x + h + d, y, z + t],
    [x - t, y, z + h + d],
    [x - h - d, y, z - t],
    [x + t, y, z - h - d],
  ][face];
}
const towerNormal = (face) =>
  [
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
    [0, 0, -1],
  ][face];
function tower(o, lod) {
  const x = A.towerCenterX,
    z = A.towerCenterZ,
    h = A.towerHalfWidth;
  for (let face = 0; face < 4; face++) {
    const a = towerFace(face, -h, 0),
      b = towerFace(face, h, 0),
      holes = [];
    if (face === 0) {
      holes.push({
        center: h,
        width: 2.65,
        bottom: 0.35,
        height: 6.4,
        door: true,
        depth: 0.5,
        label: 'deep-pointed-main-oak-entrance',
      });
      holes.push({
        center: h,
        width: 3.6,
        bottom: 11,
        height: 6.5,
        label: 'front-tripartite-gothic-window',
      });
    }
    for (const t of [-2.12, 0, 2.12])
      holes.push({
        center: h + t,
        width: 0.9,
        bottom: 20.1,
        height: 4.9,
        label: 'three-upper-tower-lancets-per-face',
      });
    wall(o, [a[0], a[2]], [b[0], b[2]], 0, A.towerBelfryBase, holes, lod);
    wall(
      o,
      [a[0], a[2]],
      [b[0], b[2]],
      A.towerBelfryBase,
      A.spireBase,
      [
        {
          center: h,
          width: 2.9,
          bottom: 27.15,
          height: 5.65,
          louver: true,
          depth: 0.48,
          label: 'physical-gabled-belfry-louver',
        },
      ],
      lod,
      'stone',
      C.stone,
    );
    T(
      o,
      'stone',
      [
        towerFace(face, -h, A.spireBase),
        towerFace(face, h, A.spireBase),
        towerFace(face, 0, A.towerGableTop),
      ],
      towerNormal(face),
      C.stone,
    );
    if (lod > 0) {
      for (const t of [-h, h])
        B(
          o,
          'stone',
          towerFace(face, t, A.spireBase, 0.05),
          towerFace(face, 0, A.towerGableTop, 0.05),
          0.18,
          0.22,
          C.stone,
        );
    }
  }
  cap(o, 'brick', rect(x - h, x + h, z - h, z + h), 0, false, C.brick);
  cap(o, 'stone', rect(x - h, x + h, z - h, z + h), A.spireBase, true, C.stone);
  for (const y of lod === 0
    ? [A.towerBelfryBase]
    : [A.towerSecondBase, A.towerThirdBase, A.towerBelfryBase])
    box(
      o,
      'stone',
      x - h - 0.12,
      x + h + 0.12,
      y - 0.12,
      y + 0.13,
      z - h - 0.12,
      z + h + 0.12,
      C.stone,
    );
  if (lod > 0) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const cx = x + sx * (h - 0.17),
          cz = z + sz * (h - 0.17);
        box(o, 'stone', cx - 0.19, cx + 0.19, 18.6, 26.5, cz - 0.19, cz + 0.19, C.stone);
        pinnacle(o, [cx, cz], 26.2, 6.5, lod);
      }
    if (lod > 1) {
      for (let face = 0; face < 4; face++)
        for (const t of [-1.88, 1.88]) {
          const c = towerFace(face, t, A.spireBase, 0.14);
          pinnacle(o, [c[0], c[2]], 31.7, 3.15, lod);
        }
    }
    for (const sz of [-1, 1]) {
      const cz = z + sz * (h + 0.2);
      box(o, 'brick', x + h - 0.9, x + h + 0.2, 0, 9.8, cz - 0.28, cz + 0.28, C.brick);
      box(o, 'stone', x + h - 1, x + h + 0.3, 9.8, 10.05, cz - 0.33, cz + 0.33, C.stone);
    }
    const count = lod === 1 ? 1 : 3;
    for (let j = 0; j < count; j++) {
      const w = 1.6 + j * 0.17,
        baseY = 6.9 + j * 0.16,
        peak = 9.55 + j * 0.22,
        dep = 0.12 + j * 0.16;
      B(o, 'stone', towerFace(0, -w, baseY, dep), towerFace(0, 0, peak, dep), 0.13, 0.14, C.stone);
      B(o, 'stone', towerFace(0, 0, peak, dep), towerFace(0, w, baseY, dep), 0.13, 0.14, C.stone);
    }
    if (lod > 1) {
      for (let i = 0; i < 4; i++)
        box(
          o,
          'stone',
          x + h + 0.08 + i * 0.28,
          x + h + 0.35 + i * 0.28,
          0,
          0.35 - i * 0.11,
          z - 1.7,
          z + 1.7,
          C.stone,
        );
    }
  }
  const rows = [1, 4, 16, 48][lod];
  for (let j = 0; j < rows; j++) {
    const t = j / rows,
      u = (j + 1) / rows,
      y = A.spireBase + (A.spireTop - A.spireBase) * t,
      Y = A.spireBase + (A.spireTop - A.spireBase) * u,
      r = A.spireBaseRadius + (A.spireTopRadius - A.spireBaseRadius) * t,
      R = A.spireBaseRadius + (A.spireTopRadius - A.spireBaseRadius) * u;
    for (let i = 0; i < 8; i++) {
      const a = (i * TAU) / 8 + Math.PI / 8,
        b = ((i + 1) * TAU) / 8 + Math.PI / 8,
        P = (a, y, r) => [x + r * Math.cos(a), y, z + r * Math.sin(a)],
        col = C.roof.map((v) => v * (0.98 + (j % 5) * 0.008));
      Q(
        o,
        'roof',
        [P(a, y, r), P(b, y, r), P(b, Y, R), P(a, Y, R)],
        [Math.cos((a + b) / 2), 0.2, Math.sin((a + b) / 2)],
        col,
      );
    }
  }
  loft(
    o,
    'metal',
    [x, z],
    [
      [A.spireTop, 0.18],
      [A.spireTop + 0.25, 0.22],
      [A.finialTop, 0.055],
    ],
    lod === 0 ? 4 : 8,
    C.metal,
  );
  B(o, 'metal', [x, A.finialTop - 0.02, z], [x, A.crossTop, z], 0.085, 0.085, C.metal);
  B(
    o,
    'metal',
    [x - 0.36, A.crossTop - 0.44, z],
    [x + 0.36, A.crossTop - 0.44, z],
    0.075,
    0.085,
    C.metal,
  );
  spireEvidence.push({
    base: [x, A.spireBase, z],
    top: [x, A.crossTop, z],
    octagonal: true,
    allFourGables: true,
  });
}
export function buildStPetersBasilicaColumbia(o, _frame, lod = 3) {
  for (const a of [nativeEvidence, recessEvidence, roofEvidence, partEvidence, spireEvidence])
    a.length = 0;
  body(o, lod);
  tower(o, lod);
}
export const stPetersBasilicaColumbiaSkyline = (o) => buildStPetersBasilicaColumbia(o, null, 0),
  stPetersBasilicaColumbiaDistrict = (o) => buildStPetersBasilicaColumbia(o, null, 1),
  stPetersBasilicaColumbiaStreet = (o) => buildStPetersBasilicaColumbia(o, null, 2),
  stPetersBasilicaColumbiaCloseup = (o) => buildStPetersBasilicaColumbia(o, null, 3);
export const stPetersBasilicaColumbiaModel = {
  id: 'basilica_of_st_peter_columbia_south_carolina',
  key: 'basilica_of_st_peter_columbia_south_carolina',
  cell: 'dn/dnn',
  title: 'Basilica of Saint Peter, Columbia',
  wikidataId: 'Q7591423',
  category: p.category,
  recipe: 'st-peters-basilica-columbia-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildStPetersBasilicaColumbia,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole actual native39-control Columbia basilica/connectedwing/corridor compound: dark red brick high nave/low sideaisles/shallow transepts/polygonalapse/ambulatory, physical lancet/rose/entrance recesses with original plain tinted glazing/tracery, stepped buttresses/corbel cornices, central entrance tower/tripartite window/twelve upper lancets/four actual louver recesses/white Gothic gables and pinnacles/slate octagonal spire/LatinCross. Whole northern attached brick wing and eastconnector retained with original bounded sections/fenestration. Exact cleared published Qualla2009KudzuVine ownPD photo first; no copied stainedglass/art/photo pixels. Primary historic163ft=49.6824m ground-to-cross; whole compound exceeds church-only dimensions. Hidden front/wing/currentfinish/exactgradecontact original estimates.',
  camera: [115, F + 64, 125],
  lookAt: [0, F + 17, 0],
  portableGroundY: F - 0.7,
  sunDirection: [-8, 14, 9],
  mediumFiContext: { scale: '1.1', groundY: F - 0.6 },
  embeddedCanonicalGraphs: ['brick', 'stone_limestone', 'slate', 'metal_painted'],
  qaCameras: [
    {
      name: 'whole-opposite-church-wing-and-connector',
      position: [-112, F + 62, -125],
      lookAt: [0, F + 16, 0],
    },
    {
      name: 'tower-deep-door-tripartite-window-and-lancets',
      position: toWorld([63, 20, 36]),
      lookAt: toWorld([26, 16, 20]),
    },
    {
      name: 'gabled-louvered-belfry-pinnacles-and-slate-spire',
      position: toWorld([45, 37, 39]),
      lookAt: toWorld([26.275, 34, 20.1365]),
    },
    {
      name: 'transept-rose-sideaisle-and-five-bay-clerestory',
      position: toWorld([1, 17, 58]),
      lookAt: toWorld([7, 9, 23]),
    },
    {
      name: 'whole-modern-attached-wing-and-open-courtyard',
      position: toWorld([-52, 23, -43]),
      lookAt: toWorld([-2, 5, -4]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/st-peters-basilica-columbia-runtime-overlay.mjs',
    level: 'skyline',
    export: 'stPetersBasilicaColumbiaSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'stPetersBasilicaColumbiaDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'stPetersBasilicaColumbiaStreet', errorMeters: 0.18, surfaces },
      closeup: { export: 'stPetersBasilicaColumbiaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Cleared published Qualla2009KudzuVine own/PD-self original individually inspected/nativeSHA1matched and unchanged policy guard passed. Abductive conflictedhero, attribution/sharealike photos, uncertain historical postcard and Flickr some-rights-reserved source excluded unchanged without source/rights repair or same-image bypass. Primary architect/committee NationalRegister text factual dimensions/details only; no nomination photographs or protected stained-glass/figure art copied. Roof/part joins/hidden facade/large northern wing height-flat roof/fenestration/fine tracery/currentfinish original estimates. Generic plain glazing/original tracery, no interior/art/cemetery/separate school/grounds/trees/sourcepixels.',
    'Original independent256m129x12916641samples/one rawtile/fixedSW93.0425m provider-relative source datum frozen before all floors/sections/geometry. Floor.7179m fixed once from original eastern entry sample before geometry; nativebbox frame unchanged/no terrainfit/flatten/reacquisition/modelraising. Exact grades/threshold/constructioncontact unverified; geographicpreview/replaceFootprint=false. Flat reviewground/syntheticneighbors are fixtures.',
  ],
};
