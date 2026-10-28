/** Whole surviving hotel: native envelope, original bounded exterior detail. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
  wall: rgb('e5e0d1'),
  trim: rgb('eae8de'),
  foundation: rgb('b9aa93'),
  roof: rgb('a3a9a2'),
  dark: rgb('354331'),
};
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.85, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.72, metallic: 0.42 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.55, metallic: 0.08 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  facadeEvidence = [],
  roofEvidence = [],
  supportEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  triangles = (r, holes = []) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      holes.map((r) => r.map((q) => new Vector2(...q))),
    );
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]],
  ring = () => frame.features[0].outline.slice(0, -1).map((q) => [dot(q, U), dot(q, V)]);
function T(o, k, q, n, col = C[k]) {
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
  if (Math.hypot(...sub(b, a)) > 1e-6) beam(o, k, toWorld(a), toWorld(b), w, d, col);
}
function cap(o, k, r, y, up = true, col = C[k]) {
  for (const ix of triangles(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], bottom = false) {
  const sign = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      k,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], Y, b[1]],
        [a[0], Y, a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      col,
    );
  }
  cap(o, k, r, Y, true, col);
  if (bottom) cap(o, k, r, y, false, col);
}
const rect = (x, X, z, Z) => [
    [x, z],
    [X, z],
    [X, Z],
    [x, Z],
  ],
  native = ring(),
  sign = area(native) > 0 ? 1 : -1;
function panel(a, b) {
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = d.map((v) => v / L),
    n = [sign * u[1], -sign * u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, v = 0) => [a[0] + u[0] * t + n[0] * v, y, a[1] + u[1] * t + n[1] * v],
  };
}
function intersect(a, u, b, v) {
  const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0],
    t = cross2(sub(b, a), v) / cross2(u, v);
  return a.map((x, i) => x + t * u[i]);
}
export const body = native.map((q, i) => {
  const j = (i + native.length - 1) % native.length,
    a = panel(native[j], q),
    b = panel(q, native[(i + 1) % native.length]),
    d = (k) => ([1, 2, 3].includes(k) ? A.verandahDepth : 0);
  return intersect(
    a.a.map((v, k) => v - a.n[k] * d(j)),
    a.u,
    b.a.map((v, k) => v - b.n[k] * d(i)),
    b.u,
  );
});
function plane(o, k, f, l, r, y, Y, v = 0, col = C[k]) {
  Q(o, k, [f.P(l, y, v), f.P(r, y, v), f.P(r, Y, v), f.P(l, Y, v)], [f.n[0], 0, f.n[1]], col);
}
function bar(o, k, f, l, r, y, Y, v, depth, col = C[k]) {
  const a = f.P(l, 0, v),
    b = f.P(r, 0, v),
    c = f.P(r, 0, v - depth),
    d = f.P(l, 0, v - depth);
  solid(
    o,
    k,
    [a, b, c, d].map((q) => [q[0], q[2]]),
    y,
    Y,
    col,
    true,
  );
}
function facade(o, f, holes, top, lod, index) {
  const low = A.verandahPadTop,
    outer = [
      [0, low],
      [f.L, low],
      [f.L, top],
      [0, top],
    ],
    cut = holes.map((h) => [
      [h.center - h.radius, h.bottom],
      [h.center - h.radius, h.top],
      [h.center + h.radius, h.top],
      [h.center + h.radius, h.bottom],
    ]),
    pts = [...outer, ...cut.flat()];
  if (lod === 0) {
    plane(o, 'wall', f, 0, f.L, low, top);
    for (const h of holes)
      plane(o, 'dark', f, h.center - h.radius, h.center + h.radius, h.bottom, h.top, 0.012);
  } else {
    for (const ids of triangles(outer, cut))
      for (const v of [0, -A.wallDepth])
        T(
          o,
          'wall',
          ids.map((i) => f.P(pts[i][0], pts[i][1], v)),
          [f.n[0] * (v === 0 ? 1 : -1), 0, f.n[1] * (v === 0 ? 1 : -1)],
        );
    for (const h of holes) {
      const l = h.center - h.radius,
        r = h.center + h.radius,
        y = h.bottom,
        Y = h.top,
        D = -A.windowDepth;
      Q(o, 'wall', [f.P(l, y), f.P(l, Y), f.P(l, Y, D), f.P(l, y, D)], [f.u[0], 0, f.u[1]]);
      Q(o, 'wall', [f.P(r, y), f.P(r, y, D), f.P(r, Y, D), f.P(r, Y)], [-f.u[0], 0, -f.u[1]]);
      Q(o, 'wall', [f.P(l, y), f.P(l, y, D), f.P(r, y, D), f.P(r, y)], [0, 1, 0]);
      Q(o, 'wall', [f.P(l, Y), f.P(r, Y), f.P(r, Y, D), f.P(l, Y, D)], [0, -1, 0]);
      plane(o, 'dark', f, l, r, y, Y, D, h.kind === 'door' ? C.dark : rgb('263839'));
      const bw = lod === 1 ? 0.14 : 0.17;
      for (const t of [l - bw, r]) bar(o, 'dark', f, t, t + bw, y - 0.08, Y + 0.14, 0.045, 0.09);
      bar(o, 'dark', f, l - bw, r + bw, Y, Y + 0.16, 0.045, 0.09);
      bar(o, 'dark', f, l - bw, r + bw, y - 0.1, y, 0.045, 0.1);
      if (lod > 1) {
        const step = 0.34;
        for (let yy = y; yy < Y - 0.08; yy += step) {
          const ext = Math.round((yy - y) / step) % 2 === 0 ? 0.35 : 0.21;
          bar(o, 'dark', f, l - ext, l - 0.1, yy, Math.min(yy + 0.22, Y), 0.04, 0.07);
          bar(o, 'dark', f, r + 0.1, r + ext, yy, Math.min(yy + 0.22, Y), 0.04, 0.07);
        }
        if (h.kind === 'window') {
          bar(o, 'dark', f, l, r, (y + Y) / 2 - 0.035, (y + Y) / 2 + 0.035, D + 0.035, 0.06);
          bar(o, 'trim', f, l - 0.12, r + 0.12, y - 0.13, y - 0.06, 0.12, 0.17);
        } else {
          bar(o, 'dark', f, l + 0.12, r - 0.12, y + 0.14, y + 0.25, D + 0.025, 0.05);
          bar(o, 'dark', f, l + 0.12, r - 0.12, y + 1.1, y + 1.19, D + 0.025, 0.05);
        }
      }
      openingEvidence.push({
        index,
        a: f.a,
        b: f.b,
        normal: f.n,
        u: f.u,
        ...h,
        depth: A.windowDepth,
      });
    }
  }
  facadeEvidence.push({ index, a: f.a, b: f.b, holes, top });
}
function clip(r, x, greater) {
  const out = [],
    inside = (q) => (greater ? q[0] >= x : q[0] <= x);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      I = inside(a),
      J = inside(b);
    if (I) out.push(a);
    if (I !== J) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out.filter((q, i, a) => !i || Math.hypot(...sub(q, a[i - 1])) > 1e-7);
}
function hip(o, r, y, Y, lod, label) {
  const min = [0, 1].map((k) => Math.min(...r.map((q) => q[k]))),
    max = [0, 1].map((k) => Math.max(...r.map((q) => q[k]))),
    c = min.map((v, k) => (v + max[k]) / 2),
    sz = max.map((v, k) => v - min[k]),
    axis = sz[0] > sz[1] ? 0 : 1,
    half = Math.max(0, (sz[axis] - sz[1 - axis]) / 2),
    ridge = (q) => {
      const v = [...c];
      v[axis] += q[axis] < c[axis] ? -half : half;
      return [v[0], Y, v[1]];
    };
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = [a[0], y, a[1]],
      v = [b[0], y, b[1]],
      R = ridge(a),
      S = ridge(b);
    T(o, 'roof', [u, v, S], [0, 1, 0]);
    T(o, 'roof', [u, S, R], [0, 1, 0]);
    if (lod > 1) {
      const length = Math.hypot(...sub(b, a)),
        edge = sub(b, a).map((v) => v / length),
        face = [u, v, S, R],
        coordinate = (q) => (q[0] - a[0]) * edge[0] + (q[2] - a[1]) * edge[1],
        N = Math.max(1, Math.floor(length / (lod === 2 ? 0.85 : 0.24)));
      for (let j = 1; j < N; j++) {
        const t = (j * length) / N,
          points = [];
        // Parallel sheet seams end at the ridge or hip, rather than fanning into it.
        for (let k = 0; k < face.length; k++) {
          const q = face[k],
            s = face[(k + 1) % face.length],
            x = coordinate(q),
            X = coordinate(s);
          if (Math.abs(X - x) < 1e-8 || t < Math.min(x, X) || t > Math.max(x, X)) continue;
          const f = (t - x) / (X - x),
            point = q.map((v, i) => v + (s[i] - v) * f);
          if (!points.some((p) => Math.hypot(...sub(p, point)) < 1e-7)) points.push(point);
        }
        if (points.length !== 2) continue;
        B(
          o,
          'roof',
          points[0].map((v, k) => v + (k === 1 ? 0.015 : 0)),
          points[1].map((v, k) => v + (k === 1 ? 0.015 : 0)),
          lod === 2 ? 0.025 : 0.018,
          0.025,
          rgb('b0b6af'),
        );
      }
    }
  }
  roofEvidence.push({ label, boundary: r, eave: y, ridge: Y, center: c });
}
const glyph = {
  B: '00 04|00 20|20 21|21 22|22 02|02 23|23 24|24 04',
  I: '00 20|10 14|04 24',
  R: '00 04|00 20|20 22|22 02|02 24',
  D: '00 04|00 20|20 23|23 14|14 04',
  S: '20 00|00 02|02 22|22 24|24 04',
  V: '00 14|14 20',
  L: '00 04|04 24',
  E: '20 00|00 04|04 24|02 22',
  H: '00 04|20 24|02 22',
  O: '00 20|20 24|24 04|04 00',
  T: '00 20|10 14',
};
function lettering(o, f, text, y, height, width, v, lod) {
  if (lod < 2) return;
  const cw = width / text.length;
  for (let i = 0; i < text.length; i++)
    for (const line of (glyph[text[i]] ?? '').split('|').filter(Boolean)) {
      const [a, b] = line.split(' ').map((q) => [Number(q[0]), Number(q[1])]);
      B(
        o,
        'dark',
        f.P((f.L - width) / 2 + cw * (i + a[0] / 3), y + height * (1 - a[1] / 4), v),
        f.P((f.L - width) / 2 + cw * (i + b[0] / 3), y + height * (1 - b[1] / 4), v),
        0.028,
        0.025,
      );
    }
}
function canopy(o, lod) {
  const seen = new Set();
  for (const i of [1, 2, 3]) {
    const outer = panel(native[i], native[(i + 1) % native.length]),
      inner = panel(body[i], body[(i + 1) % body.length]),
      a = outer.P(0, A.awningOuter),
      b = outer.P(outer.L, A.awningOuter),
      c = inner.P(inner.L, A.awningInner),
      d = inner.P(0, A.awningInner);
    Q(o, 'roof', [a, b, c, d], [0, 1, 0]);
    Q(
      o,
      'roof',
      [
        a.map((v, k) => v - (k === 1 ? A.awningThickness : 0)),
        d.map((v, k) => v - (k === 1 ? A.awningThickness : 0)),
        c.map((v, k) => v - (k === 1 ? A.awningThickness : 0)),
        b.map((v, k) => v - (k === 1 ? A.awningThickness : 0)),
      ],
      [0, -1, 0],
    );
    const N = Math.max(1, Math.ceil(outer.L / A.baySpacing));
    for (let j = 0; j <= N; j++) {
      const t = (outer.L * j) / N,
        q = outer.P(t, 0),
        key = `${q[0].toFixed(4)},${q[2].toFixed(4)}`;
      if (!seen.has(key)) {
        seen.add(key);
        B(
          o,
          'trim',
          outer.P(t, A.verandahPadTop),
          outer.P(t, A.awningOuter),
          A.postWidth,
          A.postWidth,
        );
        supportEvidence.push({ point: q, top: A.awningOuter, bottom: A.verandahPadTop });
      }
    }
    if (lod === 0) plane(o, 'trim', outer, 0, outer.L, A.valanceBottom, A.awningOuter, 0.025);
    else {
      const scallops = Math.ceil(outer.L / 0.23),
        M = lod === 1 ? Math.ceil(outer.L / 0.65) : scallops * (lod === 2 ? 4 : 6),
        lower = (t) =>
          A.valanceBottom +
          (lod === 1 ? 0 : (0.08 * (1 + Math.cos((2 * Math.PI * t * scallops) / outer.L))) / 2);
      for (let j = 0; j < M; j++) {
        const l = (outer.L * j) / M,
          r = (outer.L * (j + 1)) / M;
        Q(
          o,
          'trim',
          [
            outer.P(l, lower(l), 0.025),
            outer.P(r, lower(r), 0.025),
            outer.P(r, A.awningOuter, 0.025),
            outer.P(l, A.awningOuter, 0.025),
          ],
          [outer.n[0], 0, outer.n[1]],
        );
      }
    }
    if (lod > 1) {
      B(
        o,
        'dark',
        outer.P(0, A.awningOuter + 0.035, 0.025),
        outer.P(outer.L, A.awningOuter + 0.035, 0.025),
        0.1,
        0.1,
      );
      if (outer.L > 10)
        lettering(
          o,
          outer,
          'BIRDSVILLEHOTEL',
          A.valanceBottom + 0.04,
          0.29,
          Math.min(14, outer.L - 1),
          0.05,
          lod,
        );
    }
  }
}
function parapet(o, lod) {
  for (const i of [1, 2, 3]) {
    const f = panel(body[i], body[(i + 1) % body.length]);
    bar(o, 'wall', f, 0, f.L, A.wallTop, A.parapetTop, 0, A.parapetThickness);
    bar(o, 'dark', f, 0, f.L, A.wallTop + 0.24, A.wallTop + 0.34, 0.055, A.parapetThickness + 0.1);
    if (lod > 0)
      bar(
        o,
        'trim',
        f,
        0,
        f.L,
        A.parapetTop - 0.07,
        A.parapetTop + 0.025,
        0.04,
        A.parapetThickness + 0.08,
      );
  }
  const f = panel(body[2], body[3]),
    w = Math.min(1.8, f.L - 0.08),
    l = (f.L - w) / 2,
    r = l + w,
    bottom = A.parapetTop,
    shoulder = A.cornerTabletTop - w * 0.48,
    profile = [
      [l, bottom],
      [r, bottom],
      [r, shoulder],
    ],
    N = lod === 0 ? 4 : lod === 1 ? 8 : lod === 2 ? 16 : 24;
  for (let j = 0; j <= N; j++) {
    const t = (j * Math.PI) / N;
    profile.push([(l + r) / 2 + w * 0.5 * Math.cos(t), shoulder + w * 0.48 * Math.sin(t)]);
  }
  profile.push([l, shoulder]);
  for (const ix of triangles(profile))
    T(
      o,
      'wall',
      ix.map((i) => f.P(profile[i][0], profile[i][1], 0.04)),
      [f.n[0], 0, f.n[1]],
    );
  if (lod > 0)
    for (let i = 1; i < profile.length; i++)
      B(o, 'dark', f.P(...profile[i - 1], 0.07), f.P(...profile[i], 0.07), 0.08, 0.08);
}
export function buildBirdsvilleHotel(target, _frame, lod = 3) {
  partEvidence.length =
    nativeEvidence.length =
    openingEvidence.length =
    facadeEvidence.length =
    roofEvidence.length =
    supportEvidence.length =
      0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(...a) {
        count += 2;
        target.addQuad(...a);
      },
      addConvexPolygon(...a) {
        count += a[2].length - 2;
        target.addConvexPolygon(...a);
      },
    },
    part = (name, fn) => {
      const n = count;
      fn();
      partEvidence.push({ name, triangles: count - n });
    };
  part('whole-fourteen-control-intrinsic-verandah-foundation', () => {
    solid(o, 'foundation', native, A.foundationBottom, A.verandahPadTop, C.foundation, lod > 0);
    for (const q of native)
      nativeEvidence.push({ id: 631682959, point: toWorld([q[0], A.verandahPadTop, q[1]]) });
  });
  part('whole-native-wall-envelope-recessed-sash-doors-and-stepped-quoins', () => {
    for (let i = 0; i < body.length; i++) {
      const f = panel(body[i], body[(i + 1) % body.length]),
        street = [1, 2, 3].includes(i),
        Y = street ? A.wallTop : A.rearRoofEave,
        holes = [];
      if (i === 2)
        holes.push({
          center: f.L / 2,
          radius: Math.min(A.doorWidth / 2, f.L / 2 - 0.1),
          bottom: A.verandahPadTop,
          top: A.doorTop,
          kind: 'door',
        });
      else if (f.L > 3.2) {
        const n = Math.max(1, Math.floor(f.L / A.baySpacing));
        for (let j = 0; j < n; j++)
          holes.push({
            center: (f.L * (j + 0.5)) / n,
            radius: A.windowWidth / 2,
            bottom: j === n - 1 && street ? A.verandahPadTop : A.windowBottom,
            top: j === n - 1 && street ? A.doorTop : A.windowTop,
            kind: j === n - 1 && street ? 'door' : 'window',
          });
      }
      facade(o, f, holes, Y, lod, i);
    }
    cap(o, 'wall', body, A.rearRoofEave);
  });
  part('complete-main-and-two-attached-rear-hipped-corrugated-roofs', () => {
    hip(
      o,
      clip(body, -4.813, true),
      A.mainRoofEave,
      A.mainRoofRidge,
      lod,
      'whole-main-hipped-roof',
    );
    hip(
      o,
      clip(clip(body, -4.813, false), -15.687, true),
      A.rearRoofEave,
      A.rearRoofRidge,
      lod,
      'attached-rear-bar-hipped-roof',
    );
    hip(
      o,
      clip(body, -15.687, false),
      A.rearRoofEave,
      A.rearRoofRidge,
      lod,
      'attached-rear-end-hipped-roof',
    );
  });
  part('open-wraparound-canopy-white-posts-and-scalloped-valance', () => canopy(o, lod));
  part('street-parapet-dark-band-and-raised-arched-corner-tablet', () => parapet(o, lod));
  part('single-white-roof-chimney', () => {
    solid(o, 'wall', rect(7.8, 8.45, -6.2, -5.55), A.mainRoofEave + 0.5, A.chimneyTop);
    if (lod > 0) {
      solid(o, 'roof', rect(7.74, 8.51, -6.26, -5.49), A.chimneyTop, A.chimneyTop + 0.07);
      cap(o, 'dark', rect(7.93, 8.32, -6.07, -5.68), A.chimneyTop + 0.073);
    }
  });
}
export const birdsvilleHotelSkyline = (o) => buildBirdsvilleHotel(o, null, 0),
  birdsvilleHotelDistrict = (o) => buildBirdsvilleHotel(o, null, 1),
  birdsvilleHotelStreet = (o) => buildBirdsvilleHotel(o, null, 2),
  birdsvilleHotelCloseup = (o) => buildBirdsvilleHotel(o, null, 3);
export const birdsvilleHotelModel = {
  id: 'birdsville_hotel',
  key: 'birdsville_hotel',
  cell: 'r5/r57',
  title: 'Birdsville Hotel',
  wikidataId: 'Q28035358',
  category: p.category,
  recipe: 'birdsville-hotel-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildBirdsvilleHotel,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole surviving BirdsvilleHotel in its actual14-control current mainbuilding envelope: single-storey pale renderedstone, darkgreen steppedquoins/recessed sash/doors, corrugated hippedmainroof and attachedrear roofs, truncated corner entrance/raisedarchedtablet/lowparapet, openwraparound canopy on white timberposts/scallopedvalance and lowconcretepad. Published1927PD original first plus distinct exact2007photographer-ownPD exterior fromlocalcorpus. Hiddenrear roofdivisions/currentfinish/census bounded; separate motel/yard/RoyalHotelruin excluded.',
  camera: toWorld([53, 26, 55]),
  lookAt: toWorld([-1, 2, 0]),
  portableGroundY: F - 0.51,
  mediumFiContext: { scale: '1.3', groundY: F - 0.36, cameraYaw: 0.8 },
  embeddedCanonicalGraphs: ['plaster_lime', 'wood_plain', 'concrete_plain', 'metal_corrugated'],
  qaCameras: [
    {
      name: 'whole-hotel-corner-street-verandah-and-hipped-roofs',
      position: toWorld([52, 24, 54]),
      lookAt: toWorld([-1, 2, 0]),
    },
    {
      name: 'whole-fourteen-control-main-and-attached-rear-roof-plan',
      position: toWorld([-2, 85, 0.2]),
      lookAt: toWorld([-2, 1, 0]),
    },
    {
      name: 'open-verandah-scalloped-valance-recessed-sash-and-quoins',
      position: toWorld([7, 5, 21]),
      lookAt: toWorld([7, 2.1, 10.4]),
    },
    {
      name: 'whole-rear-attached-bars-and-main-hipped-roof',
      position: toWorld([-52, 24, -50]),
      lookAt: toWorld([-2, 2, 0]),
    },
    {
      name: 'truncated-corner-door-and-raised-parapet-tablet',
      position: toWorld([29, 7, 22]),
      lookAt: toWorld([18, 3.2, 10.3]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/birdsville-hotel-runtime-overlay.mjs',
    level: 'skyline',
    export: 'birdsvilleHotelSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'birdsvilleHotelDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'birdsvilleHotelStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'birdsvilleHotelCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Published CliffEveritt1927wholefrontPD original first; distinct StuartEdwards2007ownPD corner/longface original alreadycachedlocally and independentlyboundnative. No imagery pixels embedded, no excluded aerial/QHRCCpicture or source metadata repair.',
    'Rear roof subdivisions/window/door census, current fine repairs/colors, exact parapet/valance profiles and hiddenfaces are bounded original estimates. Plain original lettering omits advertising/artwork. Detached motels/yard/beer garden/tanks/sheds/RoyalHotelruin/street/airport/aircraft/people excluded.',
    'Original independent field/floor/sections fixed before geometry; contact unverified, preview only/replacementfalse. Flatground/synthetic neighborhouses are review fixtures.',
  ],
};
