/** Whole native Kashmiri Gate; original bounded exterior geometry. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  { floorY: F, axisU: U, axisV: V, architecturalSections: A } = p.parameters;
const C = {
    wall: rgb('91816d'),
    trim: rgb('b4a388'),
    foundation: rgb('877b68'),
    roof: rgb('8c7c64'),
    dark: rgb('344749'),
  },
  colors = ['d8d8d0', 'dfded6', 'd4d5cb'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.83, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_sandstone_raw', roughness: 0.9, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34, metallic: 0.12 },
};
export const partEvidence = [],
  nativeEvidence = [],
  openingEvidence = [],
  facadeEvidence = [],
  roofEvidence = [];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
export const toWorld = (q) => [U[0] * q[0] + V[0] * q[2], F + q[1], U[1] * q[0] + V[1] * q[2]],
  direction = (q) => [U[0] * q[0] + V[0] * q[2], q[1], U[1] * q[0] + V[1] * q[2]];
export const ring = () =>
  frame.features[0].outline
    .slice(0, -1)
    .map((q) => [q[0] * U[0] + q[1] * U[1], q[0] * V[0] + q[1] * V[1]]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => toWorld(v).map(Math.fround));
  if (!q.flat().every(Number.isFinite)) throw Error(JSON.stringify({ k, q, n }));
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
function triangles(r) {
  return ShapeUtils.triangulateShape(
    r.map((q) => new Vector2(...q)),
    [],
  );
}
function cap(o, k, r, y, up, col = C[k]) {
  for (const ix of triangles(r))
    T(
      o,
      k,
      ix.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function solid(o, k, r, y, Y, col = C[k], bottom = false, top = true) {
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
  if (bottom) cap(o, k, r, y, false, col);
  if (top) cap(o, k, r, Y, true, col);
}
function piece(o, k, a, b, depth, r, col = C[k] ?? C.wall) {
  r = r.filter((v, i) => i === 0 || Math.hypot(...sub(v, r[i - 1])) > 1e-7);
  if (r.length < 3 || Math.abs(area(r)) < 1e-7) return;
  const d = sub(b, a),
    L = Math.hypot(...d),
    u = [d[0] / L, d[1] / L],
    n = [u[1], -u[0]],
    P = (q, v) => [a[0] + u[0] * q[0] + n[0] * v, q[1], a[1] + u[1] * q[0] + n[1] * v];
  for (const ids of triangles(r))
    for (const v of [0, -depth])
      T(
        o,
        k,
        ids.map((i) => P(r[i], v)),
        [n[0] * (v === 0 ? 1 : -1), 0, n[1] * (v === 0 ? 1 : -1)],
        col,
      );
}
export const archTop = (h, x) => {
  const t = Math.abs(x - h.center),
    rise = h.top - h.spring,
    c = (rise * rise - h.radius * h.radius) / (2 * h.radius),
    R = h.radius + c;
  return h.spring + Math.sqrt(Math.max(0, R * R - (t + c) * (t + c)));
};
/** Genuine through-openings, with inward returns and closed masonry around each arch. */
function wall(o, k, a, b, depth, y, Y, holes, lod, col = C[k] ?? C.wall, courses = false) {
  const L = Math.hypot(...sub(b, a)),
    N = [6, 12, 24, 48][lod],
    list = holes.filter((h) => h.center - h.radius > 0.02 && h.center + h.radius < L - 0.02),
    cuts = [0, L];
  for (const h of list)
    for (let i = 0; i <= (h.arch ? N : 1); i++)
      cuts.push(h.center - h.radius + (2 * h.radius * i) / (h.arch ? N : 1));
  const cs = [...new Set(cuts)].sort((a, b) => a - b);
  for (let i = 1; i < cs.length; i++) {
    const l = cs[i - 1],
      r = cs[i],
      mid = (l + r) / 2,
      hs = list
        .filter((h) => mid > h.center - h.radius && mid < h.center + h.radius)
        .sort((a, b) => a.bottom - b.bottom);
    let bottomL = y,
      bottomR = y;
    for (const h of hs) {
      piece(
        o,
        k,
        a,
        b,
        depth,
        [
          [l, bottomL],
          [r, bottomR],
          [r, h.bottom],
          [l, h.bottom],
        ],
        col,
      );
      bottomL = h.arch ? archTop(h, l) : h.top;
      bottomR = h.arch ? archTop(h, r) : h.top;
    }
    piece(
      o,
      k,
      a,
      b,
      depth,
      [
        [l, bottomL],
        [r, bottomR],
        [r, Y],
        [l, Y],
      ],
      col,
    );
  }
  const u = sub(b, a).map((v) => v / L),
    normal = [u[1], -u[0]],
    P = (q, d) => [a[0] + u[0] * q[0] + normal[0] * d, q[1], a[1] + u[1] * q[0] + normal[1] * d];
  const edge = (q, t, sign) => {
    const dx = t[0] - q[0],
      dy = t[1] - q[1];
    Q(
      o,
      k,
      [P(q, 0), P(t, 0), P(t, -depth), P(q, -depth)],
      [sign * u[0] * dy, -sign * dx, sign * u[1] * dy],
      col,
    );
  };
  const border = [
    [0, y],
    [L, y],
    [L, Y],
    [0, Y],
  ];
  for (let i = 0; i < 4; i++) if (lod > 0 || i === 2) edge(border[i], border[(i + 1) % 4], 1);
  for (const h of list) {
    const a = h.center - h.radius,
      b = h.center + h.radius,
      ring = [
        [a, h.bottom],
        [b, h.bottom],
      ];
    if (h.arch)
      for (let i = 0; i <= N; i++) {
        const x = b - ((b - a) * i) / N;
        ring.push([x, archTop(h, x)]);
      }
    else ring.push([b, h.top], [a, h.top]);
    for (let i = 0; i < ring.length; i++) edge(ring[i], ring[(i + 1) % ring.length], -1);
  }
  for (const h of list) openingEvidence.push({ kind: k, a, b, depth, ...h });
  if (!courses || lod < 2) return;
  const n = [u[1], -u[0]],
    row = lod === 2 ? 0.84 : 0.42,
    w = lod === 2 ? 4.8 : 1.9;
  for (let j = 0; j < Math.ceil((Y - y) / row); j++) {
    const yy = y + j * row + 0.018,
      YY = Math.min(Y - 0.012, yy + row - 0.034);
    if (YY <= yy) continue;
    for (let i = -1; i < Math.ceil(L / w); i++) {
      const l = Math.max(0.012, (i + (j % 2) * 0.5) * w + 0.016),
        r = Math.min(L - 0.012, (i + 1 + (j % 2) * 0.5) * w - 0.016);
      if (r <= l) continue;
      if (
        list.some(
          (h) =>
            r > h.center - h.radius - 0.1 &&
            l < h.center + h.radius + 0.1 &&
            YY > h.bottom - 0.04 &&
            yy < (h.arch ? h.spring + h.radius : h.top) + 0.04,
        )
      )
        continue;
      const P = (t, h, d) => [a[0] + u[0] * t + n[0] * d, h, a[1] + u[1] * t + n[1] * d],
        col2 = colors[(j * 7 + i * 13 + 600) % colors.length],
        dd = lod === 3 ? 0.035 : 0.012;
      Q(o, k, [P(l, yy, dd), P(r, yy, dd), P(r, YY, dd), P(l, YY, dd)], [n[0], 0, n[1]], col2);
      if (lod === 3) {
        Q(o, k, [P(l, YY, 0), P(l, YY, dd), P(r, YY, dd), P(r, YY, 0)], [0, 1, 0], col2);
        Q(o, k, [P(r, yy, 0), P(r, yy, dd), P(r, YY, dd), P(r, YY, 0)], [u[0], 0, u[1]], col2);
      }
    }
  }
}
const native = ring(),
  front = { a: native[1], b: native[2] },
  back = { a: native[3], b: native[4] };
export const physicalPlan = { whole: native, front, back, passageCenters: A.passageCenters };
function panel(a, b) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((v) => v / L),
    n = [u[1], -u[0]];
  return {
    a,
    b,
    u,
    n,
    L,
    P: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[1] * t + n[1] * d],
  };
}
function strip(o, k, p, l, r, y, Y, d, depth, col = C[k]) {
  const points = [p.P(l, 0, d), p.P(r, 0, d), p.P(r, 0, d - depth), p.P(l, 0, d - depth)].map(
    (q) => [q[0], q[2]],
  );
  solid(o, k, points, y, Y, col, false, true);
}
function polyExtruded(o, k, p, r, depth, d = 0, col = C[k]) {
  for (const ids of triangles(r))
    for (const side of [d, d - depth])
      T(
        o,
        k,
        ids.map((i) => p.P(r[i][0], r[i][1], side)),
        [p.n[0] * (side === d ? 1 : -1), 0, p.n[1] * (side === d ? 1 : -1)],
        col,
      );
  const s = area(r) > 0 ? 1 : -1;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [s * p.u[0] * (b[1] - a[1]), s * (a[0] - b[0]), s * p.u[1] * (b[1] - a[1])];
    Q(
      o,
      k,
      [
        p.P(a[0], a[1], d),
        p.P(b[0], b[1], d),
        p.P(b[0], b[1], d - depth),
        p.P(a[0], a[1], d - depth),
      ],
      n,
      col,
    );
  }
}
function facade(o, p, lod, label) {
  const holes = A.passageCenters.map((c) => ({
    center: (c - p.a[0]) / p.u[0],
    radius: A.archRadius / Math.abs(p.u[0]),
    bottom: A.passageFloor,
    spring: A.archSpring,
    top: A.archApex,
    arch: true,
  }));
  wall(o, 'wall', p.a, p.b, A.wallDepth, A.passageFloor, A.wallTop, holes, lod);
  facadeEvidence.push({ label, a: p.a, b: p.b, holes });
  const N = [6, 12, 24, 48][lod];
  for (const h of holes) {
    const outer = { ...h, radius: A.outerArchRadius / Math.abs(p.u[0]), top: A.outerArchApex };
    for (let i = 0; i < N; i++) {
      const t = -1 + (2 * i) / N,
        T = -1 + (2 * (i + 1)) / N,
        l = h.center + t * h.radius,
        r = h.center + T * h.radius,
        L = outer.center + t * outer.radius,
        R = outer.center + T * outer.radius;
      Q(
        o,
        'trim',
        [
          p.P(l, archTop(h, l), 0.12),
          p.P(r, archTop(h, r), 0.12),
          p.P(R, archTop(outer, R), 0.12),
          p.P(L, archTop(outer, L), 0.12),
        ],
        [p.n[0], 0, p.n[1]],
      );
    }
    for (const side of [-1, 1]) {
      const l = h.center + side * (h.radius + 0.25) - 0.25;
      strip(o, 'trim', p, l, l + 0.5, A.passageFloor, A.archSpring, 0.12, 0.22);
    }
    if (lod > 0) {
      const l = outer.center - outer.radius - 0.55,
        r = outer.center + outer.radius + 0.55;
      strip(o, 'trim', p, l, r, A.outerArchApex + 0.18, A.outerArchApex + 0.32, 0.075, 0.1);
      for (const t of [l, r - 0.09])
        strip(o, 'trim', p, t, t + 0.09, A.passageFloor, A.outerArchApex + 0.3, 0.07, 0.1);
    }
    if (lod > 1) {
      const h2 = { ...h, radius: h.radius + 0.18, top: h.top + 0.22 };
      for (let i = 0; i < N; i++) {
        const t = -1 + (2 * i) / N,
          T = -1 + (2 * (i + 1)) / N,
          l = h.center + t * h.radius,
          r = h.center + T * h.radius,
          L = h.center + t * h2.radius,
          R = h.center + T * h2.radius;
        Q(
          o,
          'trim',
          [
            p.P(l, archTop(h, l), 0.17),
            p.P(r, archTop(h, r), 0.17),
            p.P(R, archTop(h2, R), 0.17),
            p.P(L, archTop(h2, L), 0.17),
          ],
          [p.n[0], 0, p.n[1]],
          rgb('c8b79a'),
        );
      }
    }
  }
  strip(o, 'trim', p, 0, p.L, A.corniceBottom, A.corniceBottom + 0.12, 0.12, 0.25);
  strip(o, 'wall', p, 0, p.L, A.corniceTop - 0.17, A.corniceTop, 0.27, 0.43);
  if (lod > 1) {
    const step = lod === 2 ? 1.2 : 0.6;
    for (let t = 0.25; t < p.L - 0.2; t += step)
      strip(o, 'wall', p, t, t + 0.14, A.corniceBottom + 0.15, A.corniceTop - 0.18, 0.18, 0.24);
  }
}
const backV = (u) =>
    back.a[1] + ((u - back.a[0]) * (back.b[1] - back.a[1])) / (back.b[0] - back.a[0]),
  frontV = (u) =>
    front.a[1] + ((u - front.a[0]) * (front.b[1] - front.a[1])) / (front.b[0] - front.a[0]);
function vaults(o, lod) {
  const N = [6, 12, 24, 48][lod];
  for (const c of A.passageCenters) {
    const h = { center: c, radius: A.archRadius, spring: A.archSpring, top: A.archApex };
    for (let i = 0; i < N; i++) {
      const l = c - A.archRadius + (2 * A.archRadius * i) / N,
        r = c - A.archRadius + (2 * A.archRadius * (i + 1)) / N,
        y = archTop(h, l),
        Y = archTop(h, r);
      Q(
        o,
        'wall',
        [
          [l, y, frontV(l)],
          [r, Y, frontV(r)],
          [r, Y, backV(r)],
          [l, y, backV(l)],
        ],
        [0, -1, 0],
        rgb('827562'),
      );
    }
    for (const side of [-1, 1]) {
      const u = c + side * A.archRadius;
      Q(
        o,
        'wall',
        [
          [u, A.passageFloor, frontV(u)],
          [u, A.archSpring, frontV(u)],
          [u, A.archSpring, backV(u)],
          [u, A.passageFloor, backV(u)],
        ],
        [-side, 0, 0],
      );
    }
    roofEvidence.push({
      kind: 'pointed-through-vault',
      center: c,
      clearHalfWidth: A.archRadius,
      spring: A.archSpring,
      apex: A.archApex,
    });
  }
}
function merlons(o, p, lod, label) {
  const N = Math.max(2, Math.round(p.L / [2.5, 1.65, 1.25, 1.25][lod])),
    pitch = p.L / N,
    w = pitch * 0.77,
    depth = A.parapetDepth;
  strip(o, 'wall', p, 0, p.L, A.wallTop, A.parapetBase + 0.13, 0, depth);
  for (let i = 0; i < N; i++) {
    const center = (i + 0.5) * pitch,
      lo = center - w / 2,
      hi = center + w / 2,
      drop = lod === 0 ? 0 : i % 7 === 2 ? 0.2 : 0,
      shoulder = A.merlonShoulder - drop,
      top = A.merlonCrown - drop;
    if (lod === 0) {
      strip(o, 'wall', p, lo, hi, A.parapetBase, top, 0, depth);
      continue;
    }
    const head = [
        [lo, shoulder],
        [hi, shoulder],
      ],
      n = lod === 1 ? 4 : lod === 2 ? 6 : 10;
    for (let k = 0; k <= n; k++) {
      const a = (k * Math.PI) / n;
      head.push([center + (w / 2) * Math.cos(a), shoulder + (top - shoulder) * Math.sin(a)]);
    }
    polyExtruded(o, 'wall', p, head, depth);
    wall(
      o,
      'wall',
      p.P(lo, 0).filter((_, i) => i !== 1),
      p.P(hi, 0).filter((_, i) => i !== 1),
      depth,
      A.parapetBase,
      shoulder,
      [
        {
          center: w / 2,
          radius: 0.045,
          bottom: A.parapetBase + 0.18,
          top: shoulder - 0.08,
          kind: 'slit',
        },
      ],
      lod,
    );
  }
  partEvidence.push({ name: `${label}-parapet-merlon-census-original-bounded`, count: N });
}
function masonry(o, p, lod) {
  if (lod < 2) return;
  const ww = lod === 2 ? 1.9 : 0.85,
    row = lod === 2 ? 0.7 : 0.35;
  for (let j = 0; j < Math.floor(A.wallTop / row); j++) {
    const yy = j * row + 0.025,
      Y = yy + row - 0.05;
    for (let i = -1; i < Math.ceil(p.L / ww); i++) {
      const l = Math.max(0.01, (i + (j % 2) * 0.5) * ww + 0.02),
        r = Math.min(p.L - 0.01, (i + 1 + (j % 2) * 0.5) * ww - 0.02);
      if (r <= l) continue;
      const mid = (l + r) / 2,
        U = p.a[0] + p.u[0] * mid;
      const blocked = A.passageCenters.some((c) => {
        const h = {
          center: c,
          radius: A.outerArchRadius + 0.2,
          spring: A.archSpring,
          top: A.outerArchApex + 0.4,
        };
        return Math.abs(U - c) < h.radius && yy < archTop(h, U) + 0.2;
      });
      if (blocked) continue;
      const color = ['998875', '94816d', '8e806c', 'a08c74'][(j * 7 + i * 13 + 500) % 4];
      Q(
        o,
        'wall',
        [p.P(l, yy, 0.016), p.P(r, yy, 0.016), p.P(r, Y, 0.016), p.P(l, Y, 0.016)],
        [p.n[0], 0, p.n[1]],
        rgb(color),
      );
    }
  }
}
export function buildKashmiriGateDelhi(target, _frame, lod = 3) {
  for (const a of [partEvidence, nativeEvidence, openingEvidence, facadeEvidence, roofEvidence])
    a.length = 0;
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
  };
  const part = (name, fn) => {
    const n = count;
    fn();
    partEvidence.push({ name, triangles: count - n });
  };
  part('whole-five-native-footprint-and-passage-floor', () => {
    solid(o, 'foundation', native, A.foundationBottom, A.passageFloor, C.foundation, lod > 0);
    for (const q of native)
      nativeEvidence.push({ id: 464312292, point: toWorld([q[0], A.passageFloor, q[1]]) });
  });
  part('both-pointed-portal-faces-and-original-bounded-framed-surrounds', () => {
    facade(o, panel(front.a, front.b), lod, 'southwest-double-portal');
    facade(o, panel(back.a, back.b), lod, 'northeast-double-portal');
  });
  part('actual-short-end-walls-and-original-bounded-flat-roof', () => {
    for (const i of [0, 2, 4]) {
      const p = panel(native[i], native[(i + 1) % native.length]);
      wall(o, 'wall', p.a, p.b, A.wallDepth, A.passageFloor, A.wallTop, [], lod);
    }
    cap(o, 'roof', native, A.wallTop, true);
  });
  part('two-unblocked-through-vaults-with-inward-soffits', () => vaults(o, lod));
  part('slit-crenellated-parapets-and-coping', () => {
    merlons(o, panel(front.a, front.b), lod, 'southwest');
    merlons(o, panel(back.a, back.b), lod, 'northeast');
    for (const i of [0, 2, 4]) {
      const p = panel(native[i], native[(i + 1) % native.length]);
      if (p.L < 3) strip(o, 'wall', p, 0, p.L, A.wallTop, A.parapetBase + 0.6, 0, A.parapetDepth);
      else merlons(o, p, lod, 'bounded-side');
    }
  });
  part('original-bounded-masonry-course-relief', () => {
    masonry(o, panel(front.a, front.b), lod);
    masonry(o, panel(back.a, back.b), lod);
  });
}
export const kashmiriGateDelhiSkyline = (o) => buildKashmiriGateDelhi(o, null, 0),
  kashmiriGateDelhiDistrict = (o) => buildKashmiriGateDelhi(o, null, 1),
  kashmiriGateDelhiStreet = (o) => buildKashmiriGateDelhi(o, null, 2),
  kashmiriGateDelhiCloseup = (o) => buildKashmiriGateDelhi(o, null, 3);
export const kashmiriGateDelhiModel = {
  id: 'kashmiri_gate_delhi',
  key: 'kashmiri_gate_delhi',
  cell: 'tt/ttn',
  title: 'Kashmiri Gate, Delhi',
  wikidataId: 'Q1196073',
  category: p.category,
  recipe: 'kashmiri-gate-delhi-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildKashmiriGateDelhi,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole surviving Kashmiri Gate physical five-control block: two pointed through-vaulted passages, framed recessed surrounds, masonry shell/cornice/coping and slotted scalloped parapets. Cleared published Bourne1860s/Beato1858 expired originals first, current native gate outline. Original bounded enduring shell/current hidden profiles, excluding archaeological gardens/cityfortifications/moat/old timberbridge/metro.',
  camera: toWorld([27, 20, -36]),
  lookAt: toWorld([0, 4.8, 0]),
  portableGroundY: F - 0.75,
  mediumFiContext: { scale: '1.3', groundY: F - 0.65, cameraYaw: 0.2 },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_limestone',
    'stone_limestone_raw',
    'stone_sandstone_raw',
  ],
  qaCameras: [
    {
      name: 'whole-gate-two-pointed-passages-and-parapet',
      position: toWorld([22, 14, -30]),
      lookAt: toWorld([0, 5, 0]),
    },
    {
      name: 'whole-five-native-control-gate-roof-plan',
      position: toWorld([0, 54, 0.15]),
      lookAt: toWorld([0, 1, 0]),
    },
    {
      name: 'physical-through-passages-and-pointed-vault-soffits',
      position: toWorld([-4.8, 3, -17]),
      lookAt: toWorld([-4.8, 3, 0]),
    },
    {
      name: 'whole-opposite-double-portal-and-scalloped-parapet',
      position: toWorld([-25, 15, 34]),
      lookAt: toWorld([0, 5, 0]),
    },
    {
      name: 'original-bounded-cornice-merlons-and-deep-portal-surrounds',
      position: toWorld([14, 11, -18]),
      lookAt: toWorld([5, 7, -3]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/kashmiri-gate-delhi-runtime-overlay.mjs',
    level: 'skyline',
    export: 'kashmiriGateDelhiSkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'kashmiriGateDelhiDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'kashmiriGateDelhiStreet', errorMeters: 0.25, surfaces },
      closeup: { export: 'kashmiriGateDelhiCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Two exact cleared published named-photographer expired originals, Bourne1860s and Beato1858, personally inspected. No source pixels embedded; modern CC photos unselected. Enduring gateway shape, not exact1858 wartime damage, infilled portal or old timberbridge reconstruction.',
    'Original bounded height/passages/hidden roof-vault profiles/parapet and slit census/current repairs and neutral masonry colors. No exact restoration survey or present-condition claim. Simplified original architectural recesses omit copied inscriptions and sculptural relief.',
    'Original field/floor/sections frozen before geometry, exact contact unverified, preview/replacementfalse; synthetic neighboring houses/flatground are review fixtures.',
  ],
};
