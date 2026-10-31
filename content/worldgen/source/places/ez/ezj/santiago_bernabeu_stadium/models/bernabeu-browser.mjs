/** Browser geometry derived from the retained individual Bernabeu recipe; master is unchanged. */

import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { bernabeuGroundOutline as outline } from '../../../../../../../../packages/worldgen/scripts/bernabeu-model.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const bernabeuBrowserSurfaces = {
  far: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.8 },
  silver: { slot: 'wall', graph: 'metal_stainless', roughness: 0.33, metallic: 0.92 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.62 },
  membrane: { slot: 'roof', graph: 'membrane', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.24, metallic: 0.14 },
  plastic: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.68 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 1 },
};
const T = Math.PI * 2,
  col = {
    silver: [0.71, 0.73, 0.73],
    concrete: [0.6, 0.62, 0.61],
    white: [0.84, 0.86, 0.84],
    glass: [0.09, 0.13, 0.15],
    dark: [0.04, 0.05, 0.055],
    blue: [0.055, 0.22, 0.46],
    turf: [0.19, 0.335, 0.086],
  };
export function bernabeuRounded(a, hx, hz, r) {
  const x = Math.sin(a),
    z = Math.cos(a),
    ax = Math.abs(x),
    az = Math.abs(z);
  let t = Math.min(hx / (ax || 1e-12), hz / (az || 1e-12));
  if (t * ax > hx - r && t * az > hz - r) {
    const cx = hx - r,
      cz = hz - r,
      d = ax * cx + az * cz;
    t = d + Math.sqrt(Math.max(0, d * d - cx * cx - cz * cz + r * r));
  }
  return [x * t, z * t];
}
export function bernabeuBoundary(a) {
  const dx = Math.sin(a),
    dz = Math.cos(a);
  let best = Infinity;
  for (let i = 1; i < outline.length; i++) {
    const p = outline[i - 1],
      q = outline[i],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-10) continue;
    const t = (p[0] * ez - p[1] * ex) / den,
      u = (p[0] * dz - p[1] * dx) / den;
    if (t > 0 && u >= 0 && u <= 1) best = Math.min(best, t);
  }
  if (!Number.isFinite(best)) throw Error('Mapped Bernabeu outline missed');
  return [best * dx, best * dz];
}
const native = (p, y) => [p[0], y, p[1]],
  radial = (a) => [Math.sin(a), 0, Math.cos(a)];
function face(o, slot, ps, c, hint) {
  let n = normalFor(...ps.slice(0, 3));
  if (hint && n.reduce((s, v, i) => s + v * hint[i], 0) < 0) {
    ps = [...ps].reverse();
    n = normalFor(...ps.slice(0, 3));
  }
  const major = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),
    axes = major === 0 ? [2, 1] : major === 1 ? [0, 2] : [0, 1];
  o.addQuad(
    slot,
    'palette:#ffffff',
    ps,
    n,
    ps.map((p) => axes.map((i) => p[i])),
    c,
  );
}
const bandY = (a, t) =>
  7 +
  t * 38.5 +
  Math.sin(a * 2 + 0.55) * 3.7 * Math.sin(Math.PI * t) +
  Math.sin(a - 0.3) * 1.65 * t;
function facadePoint(a, t, offset = 0) {
  const p = bernabeuBoundary(a),
    s = 0.936 + 0.061 * Math.sin(Math.PI * t * 0.85),
    d = offset / Math.hypot(...p);
  return [p[0] * (s + d), bandY(a, t), p[1] * (s + d)];
}
function roofPoint(a, t) {
  const p = bernabeuRounded(a, 37.5, 55, 5.8),
    b = bernabeuBoundary(a),
    q = [b[0] * 0.951, b[1] * 0.963];
  return [
    p[0] + (q[0] - p[0]) * t,
    48.1 + 7.3 * (1 - Math.pow(t, 4)) + 1.25 * Math.sin(a - 0.3) * t,
    p[1] + (q[1] - p[1]) * t,
  ];
}
function field(o, S) {
  box(o, 'turf', [-42, -9.2, -61], [42, -9.188, 61], [0.15, 0.31, 0.1]);
  face(
    o,
    'turf',
    [
      [-34, -9.184, -52.5],
      [34, -9.184, -52.5],
      [34, -9.184, 52.5],
      [-34, -9.184, 52.5],
    ],
    col.turf,
    [0, 1, 0],
  );
  const line = (ps) => {
    for (let i = 1; i < ps.length; i++) {
      const a = ps[i - 1],
        b = ps[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        L = Math.hypot(dx, dz),
        nx = (-dz * 0.1) / L,
        nz = (dx * 0.1) / L;
      face(
        o,
        'plastic',
        [
          [a[0] + nx, -9.174, a[1] + nz],
          [b[0] + nx, -9.174, b[1] + nz],
          [b[0] - nx, -9.174, b[1] - nz],
          [a[0] - nx, -9.174, a[1] - nz],
        ],
        col.white,
        [0, 1, 0],
      );
    }
  };
  line([
    [-34, -52.5],
    [34, -52.5],
    [34, 52.5],
    [-34, 52.5],
    [-34, -52.5],
  ]);
  line([
    [-34, 0],
    [34, 0],
  ]);
  line(
    Array.from({ length: S.circle + 1 }, (_, i) => [
      9.15 * Math.cos((T * i) / S.circle),
      9.15 * Math.sin((T * i) / S.circle),
    ]),
  );
  if (S.detail)
    for (const sign of [-1, 1]) {
      line([
        [-20.16, 52.5 * sign],
        [-20.16, 36 * sign],
        [20.16, 36 * sign],
        [20.16, 52.5 * sign],
      ]);
      line([
        [-9.16, 52.5 * sign],
        [-9.16, 47 * sign],
        [9.16, 47 * sign],
        [9.16, 52.5 * sign],
      ]);
    }
}
const tierControls = [
  { hx: 41.5, hz: 59.6, r: 9.3, y: -8.6, rows: 28, step: 0.38, run: 0.82 },
  { hx: 63, hz: 77.6, r: 24, y: 5.3, rows: 13, step: 0.44, run: 0.72 },
  { hx: 72.1, hz: 84.9, r: 31, y: 15.1, rows: 18, step: 0.49, run: 0.71 },
  { hx: 86.2, hz: 96, r: 39, y: 29, rows: 23, step: 0.55, run: 0.7 },
];
function coarseBowl(o, S) {
  for (const t of tierControls)
    for (let i = 0; i < S.n; i++) {
      const a = (T * i) / S.n,
        b = (T * (i + 1)) / S.n,
        p = bernabeuRounded(a, t.hx, t.hz, t.r),
        q = bernabeuRounded(b, t.hx, t.hz, t.r),
        u = bernabeuRounded(
          a,
          t.hx + t.rows * t.run,
          t.hz + t.rows * t.run * 0.72,
          t.r + t.rows * t.run * 0.5,
        ),
        v = bernabeuRounded(
          b,
          t.hx + t.rows * t.run,
          t.hz + t.rows * t.run * 0.72,
          t.r + t.rows * t.run * 0.5,
        ),
        top = t.y + (t.rows - 1) * t.step + 0.5;
      face(
        o,
        'plastic',
        [native(p, t.y + 0.35), native(q, t.y + 0.35), native(v, top), native(u, top)],
        col.blue,
        [0, 1, 0],
      );
      if (S.detail)
        face(
          o,
          'metal',
          [
            native(p, t.y - 0.48),
            native(q, t.y - 0.48),
            native(q, t.y + 0.18),
            native(p, t.y + 0.18),
          ],
          [0.09, 0.2, 0.36],
          radial(a).map((v) => -v),
        );
    }
}
function bowl(o, S) {
  if (!S.steps) return coarseBowl(o, S);
  for (const [k, t] of tierControls.entries()) {
    const groups = S.steps[k];
    for (let j = 0; j < groups; j++) {
      const row = (j * t.rows) / groups,
        next = ((j + 1) * t.rows) / groups,
        hx = t.hx + row * t.run,
        hz = t.hz + row * t.run * 0.72,
        r = t.r + row * t.run * 0.5,
        outer = t.hx + next * t.run,
        oz = t.hz + next * t.run * 0.72,
        or = t.r + next * t.run * 0.5,
        y = t.y + row * t.step,
        dy = (t.rows / groups) * t.step;
      for (let i = 0; i < S.n; i++) {
        const a = (T * i) / S.n,
          b = (T * (i + 1)) / S.n,
          p = bernabeuRounded(a, hx, hz, r),
          q = bernabeuRounded(b, hx, hz, r),
          u = bernabeuRounded(a, outer, oz, or),
          v = bernabeuRounded(b, outer, oz, or);
        face(
          o,
          'plastic',
          [native(p, y + 0.35), native(q, y + 0.35), native(v, y + 0.35), native(u, y + 0.35)],
          col.blue,
          [0, 1, 0],
        );
        face(
          o,
          'concrete',
          [native(p, y - dy), native(q, y - dy), native(q, y + 0.35), native(p, y + 0.35)],
          col.concrete,
          radial(a).map((v) => -v),
        );
      }
    }
    for (let i = 0; i < S.n; i++) {
      const a = (T * i) / S.n,
        b = (T * (i + 1)) / S.n,
        p = bernabeuRounded(a, t.hx, t.hz, t.r),
        q = bernabeuRounded(b, t.hx, t.hz, t.r);
      face(
        o,
        'metal',
        [
          native(p, t.y - 0.48),
          native(q, t.y - 0.48),
          native(q, t.y + 0.18),
          native(p, t.y + 0.18),
        ],
        [0.09, 0.2, 0.36],
        radial(a).map((v) => -v),
      );
    }
  }
}
function skin(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n,
      pa = bernabeuBoundary(a).map((v) => v * 0.902),
      pb = bernabeuBoundary(b).map((v) => v * 0.902);
    face(
      o,
      'glass',
      [native(pa, 0.05), native(pb, 0.05), native(pb, 43.4), native(pa, 43.4)],
      col.glass,
      radial(a),
    );
    for (let j = 0; j < S.rows; j++) {
      const lo = S.detail ? (j + 0.06) / S.rows : j / S.rows,
        hi = S.detail ? (j + 0.88) / S.rows : (j + 1) / S.rows;
      face(
        o,
        'silver',
        [
          facadePoint(a, lo, 0.09),
          facadePoint(b, lo, 0.09),
          facadePoint(b, hi, 0.32),
          facadePoint(a, hi, 0.32),
        ],
        col.silver,
        radial(a),
      );
      if (S.returns && j % 3 === 0) {
        const p = facadePoint(a, lo, 0.09),
          q = facadePoint(b, lo, 0.09);
        face(
          o,
          'silver',
          [
            p,
            q,
            q.map((v, k) => (k === 1 ? v + 0.13 : v * 0.996)),
            p.map((v, k) => (k === 1 ? v + 0.13 : v * 0.996)),
          ],
          col.silver,
          [0, -1, 0],
        );
      }
    }
    if (S.detail && i % 4 === 0) {
      const p = roofPoint(a, 1);
      beam(
        o,
        'metal',
        [p[0] * 0.965, 44.8, p[2] * 0.965],
        [p[0], p[1], p[2]],
        0.23,
        0.23,
        col.white,
      );
    }
  }
}
function roof(o, S) {
  for (let i = 0; i < S.n; i++) {
    const a = (T * i) / S.n,
      b = (T * (i + 1)) / S.n;
    for (let j = 0; j < S.radial; j++) {
      const t = j / S.radial,
        u = (j + 1) / S.radial,
        ps = [roofPoint(a, t), roofPoint(b, t), roofPoint(b, u), roofPoint(a, u)];
      face(o, 'silver', ps, col.silver, [0, 1, 0]);
      face(
        o,
        'metal',
        ps.map((p) => [p[0], p[1] - 0.28, p[2]]),
        col.white,
        [0, -1, 0],
      );
    }
    const p = bernabeuRounded(a, 38.5, 56.1, 6.3),
      q = bernabeuRounded(b, 38.5, 56.1, 6.3);
    face(
      o,
      'glass',
      [native(p, 44.6), native(q, 44.6), native(q, 49.5), native(p, 49.5)],
      col.dark,
      radial(a).map((v) => -v),
    );
    if (S.detail) {
      const x = roofPoint(a, 1),
        y = roofPoint(b, 1);
      face(
        o,
        'metal',
        [
          [x[0] * 0.974, 45.65, x[2] * 0.974],
          [y[0] * 0.974, 45.65, y[2] * 0.974],
          [y[0] * 0.974, 46.7, y[2] * 0.974],
          [x[0] * 0.974, 46.7, x[2] * 0.974],
        ],
        col.white,
        radial(a),
      );
    }
  }
  if (S.detail) {
    for (const side of [-1, 1])
      for (let j = 0; j < 4; j++) {
        const x = side * (39.6 + j * 1.5),
          dy = j % 2 ? 0.4 : 1.12;
        face(
          o,
          'membrane',
          [
            [x, 55.7, -53.9],
            [x, 55.7, 53.9],
            [x + side * 1.44, 55.7 + dy, 53.9],
            [x + side * 1.44, 55.7 + dy, -53.9],
          ],
          col.white,
          [0, 1, 0],
        );
      }
    for (let i = 0; i < (S.supports ?? 12); i++) {
      const a = (T * i) / (S.supports ?? 12),
        p = roofPoint(a, 0),
        q = roofPoint(a, 1),
        foot = native(bernabeuRounded(a, 86, 99, 34), 40.9),
        v = roofPoint(a + 0.018, 0.43),
        w = roofPoint(a - 0.018, 0.73);
      beam(o, 'metal', [p[0], p[1] - 0.8, p[2]], [q[0], q[1] - 0.8, q[2]], 0.6, 0.65, col.white);
      beam(o, 'metal', foot, [v[0], v[1] - 0.9, v[2]], 0.6, 0.6, col.white);
      beam(o, 'metal', foot, [w[0], w[1] - 0.9, w[2]], 0.6, 0.6, col.white);
    }
  }
}
function concourse(o) {
  for (let i = 1; i < outline.length; i++) {
    const p = outline[i - 1],
      q = outline[i],
      u = bernabeuRounded(Math.atan2(p[0], p[1]), 62, 75, 23),
      v = bernabeuRounded(Math.atan2(q[0], q[1]), 62, 75, 23);
    face(
      o,
      'concrete',
      [native(u, 0.01), native(v, 0.01), native(q, 0.01), native(p, 0.01)],
      col.concrete,
      [0, 1, 0],
    );
  }
}
function entrances(o, S) {
  if (!S.detail) return;
  for (let i = 0; i < 16; i++) {
    const a = (T * (i + 0.5)) / 16,
      p = bernabeuBoundary(a),
      co = Math.cos(a),
      si = Math.sin(a),
      P = ([x, y, z]) => [co * x + si * z + p[0] * 0.938, y, -si * x + co * z + p[1] * 0.938];
    face(
      o,
      'glass',
      [
        [-2.27, 0.45, -0.2],
        [2.27, 0.45, -0.2],
        [2.27, 6.3, -0.2],
        [-2.27, 6.3, -0.2],
      ].map(P),
      col.glass,
      radial(a),
    );
    for (const x of [-2.43, 2.43])
      beam(o, 'concrete', P([x, 0.4, 0]), P([x, 6.45, 0]), 0.32, 0.6, col.white);
  }
}
function goals(o, S) {
  if (!S.steps) return;
  for (const sign of [-1, 1]) {
    const z = sign * 52.5,
      y = -9.2;
    for (const x of [-3.66, 3.66])
      beam(o, 'metal', [x, y, z], [x, y + 2.44, z], 0.12, 0.12, col.white);
    beam(o, 'metal', [-3.66, y + 2.44, z], [3.66, y + 2.44, z], 0.12, 0.12, col.white);
    if (S.returns)
      for (const x of [-3.66, 3.66])
        beam(o, 'metal', [x, y + 2.44, z], [x, y + 0.03, z + sign * 2], 0.06, 0.06, col.white);
  }
}
function vip(o, S) {
  if (!S.steps) return;
  const count = S.returns ? 16 : 8,
    step = 72 / count;
  for (let i = 0; i < count; i++) {
    const z = -34 + i * step;
    box(o, 'metal', [-68.5, 5.7, z - step * 0.44], [-64.7, 9.5, z + step * 0.44], col.white);
    face(
      o,
      'glass',
      [
        [-64.68, 5.86, z - step * 0.42],
        [-64.68, 9.27, z - step * 0.42],
        [-64.68, 9.27, z + step * 0.42],
        [-64.68, 5.86, z + step * 0.42],
      ],
      col.glass,
      [1, 0, 0],
    );
  }
}
export function buildBernabeuBrowser(target, level = 'skyline') {
  const detail = level !== 'skyline',
    S = {
      skyline: { n: 32, rows: 2, radial: 2, circle: 8, detail: false },
      district: { n: 48, rows: 8, radial: 3, circle: 24, detail: true },
      street: {
        n: 80,
        rows: 24,
        radial: 4,
        circle: 32,
        detail: true,
        steps: [6, 4, 5, 6],
        supports: 12,
      },
      closeup: {
        n: 112,
        rows: 60,
        radial: 8,
        circle: 48,
        detail: true,
        steps: [28, 13, 18, 23],
        supports: 44,
        returns: true,
      },
    }[level];
  if (!S) throw Error(level);
  const o = detail
    ? target
    : Object.fromEntries(
        ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
          k,
          (slot, ref, ...args) => target[k](slot === 'silver' ? 'silver' : 'far', ref, ...args),
        ]),
      );
  field(o, S);
  bowl(o, S);
  skin(o, S);
  roof(o, S);
  concourse(o);
  entrances(o, S);
  goals(o, S);
  vip(o, S);
}
export const buildBernabeuSkyline = (o) => buildBernabeuBrowser(o, 'skyline');
export const buildBernabeuDistrict = (o) => buildBernabeuBrowser(o, 'district');

export const buildBernabeuStreet = (o) => buildBernabeuBrowser(o, 'street');
export const buildBernabeuCloseup = (o) => buildBernabeuBrowser(o, 'closeup');
