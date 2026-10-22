/** Buffalo Trace main campus: native building/part controls and clear published exteriors. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dn/dng/buffalo_trace_distillery/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('986650'),
    stone: rgb('b0aaa0'),
    roof: rgb('3b4140'),
    metal: rgb('46534b'),
    glass: rgb('546b69'),
    concrete: rgb('b9b7ac'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.98, metallic: 0 },
    stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98, metallic: 0 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.95, metallic: 0.12 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.18 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.05 },
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  };
export function buffaloTraceGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
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
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function ring(o, s, x, z, y, r0, r1, h, n = 16, col = C[s]) {
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n,
      P = (r, t, h) => [x + Math.cos(t) * r, h, z + Math.sin(t) * r];
    Q(
      o,
      s,
      [P(r0, a, y), P(r0, b, y), P(r1, b, y + h), P(r1, a, y + h)],
      [Math.cos(a), 0, Math.sin(a)],
      col,
    );
    T(o, s, [[x, y + h, z], P(r1, a, y + h), P(r1, b, y + h)], [0, 1, 0], col);
    T(o, s, [[x, y, z], P(r0, b, y), P(r0, a, y)], [0, -1, 0], col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const area = (P) =>
    P.reduce((s, a, i) => {
      const b = P[(i + 1) % P.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  ccw = (P) => (area(P) > 0 ? P : [...P].reverse()),
  centre = (P) => [0, 1].map((k) => P.reduce((s, v) => s + v[k], 0) / P.length),
  parts = new Map(p.parts.map((v) => [v.id, v]));
function triangles(P) {
  const ix = P.map((_, i) => i),
    out = [],
    side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    inside = (q, a, b, c) =>
      side(a, b, q) >= -1e-8 && side(b, c, q) >= -1e-8 && side(c, a, q) >= -1e-8;
  let attempts = 0;
  while (ix.length > 3 && attempts++ < P.length * P.length) {
    let cut = false;
    for (let k = 0; k < ix.length; k++) {
      const a = ix[(k + ix.length - 1) % ix.length],
        b = ix[k],
        c = ix[(k + 1) % ix.length];
      if (side(P[a], P[b], P[c]) < 1e-8) continue;
      if (ix.some((i) => i !== a && i !== b && i !== c && inside(P[i], P[a], P[b], P[c]))) continue;
      out.push([P[a], P[b], P[c]]);
      ix.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) {
      const k = ix.findIndex(
        (b, k) =>
          Math.abs(side(P[ix[(k + ix.length - 1) % ix.length]], P[b], P[ix[(k + 1) % ix.length]])) <
          1e-6,
      );
      if (k < 0) throw Error('Native polygon cannot triangulate');
      ix.splice(k, 1);
    }
  }
  if (ix.length === 3) out.push(ix.map((i) => P[i]));
  return out;
}
function axes(P) {
  let best = { l: 0 };
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > best.l) best = { l, u: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] };
  }
  const u = best.u,
    v = [-u[1], u[0]],
    ext = (n) => [
      Math.min(...P.map((q) => q[0] * n[0] + q[1] * n[1])),
      Math.max(...P.map((q) => q[0] * n[0] + q[1] * n[1])),
    ],
    U = ext(u),
    V = ext(v),
    point = (a, b) => [u[0] * a + v[0] * b, u[1] * a + v[1] * b];
  return {
    u,
    v,
    U,
    V,
    point,
    rect: ccw([point(U[0], V[0]), point(U[1], V[0]), point(U[1], V[1]), point(U[0], V[1])]),
  };
}
function face(o, s, P, Y, n, col = C[s]) {
  for (const q of triangles(ccw(P)))
    T(
      o,
      s,
      q.map((v) => [v[0], typeof Y === 'function' ? Y(v) : Y, v[1]]),
      n,
      col,
    );
}
function prism(o, s, P, y0, y1, col = C[s], cap = true) {
  P = ccw(P);
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length];
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
  if (cap) face(o, s, P, y1, [0, 1, 0], col);
}
function clip(P, n, v, sign) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      da = (a[0] * n[0] + a[1] * n[1] - v) * sign,
      db = (b[0] * n[0] + b[1] * n[1] - v) * sign;
    if (da >= -1e-8) out.push(a);
    if ((da > 0 && db < 0) || (da < 0 && db > 0)) {
      const t = da / (da - db);
      out.push(a.map((q, k) => q + (b[k] - q) * t));
    }
  }
  return out.filter(
    (a, i) => i === 0 || Math.hypot(a[0] - out[i - 1][0], a[1] - out[i - 1][1]) > 1e-6,
  );
}
function roof(o, P, y, rise, shape = 'gabled', slot = 'roof') {
  if (rise === 0 || shape === 'flat') {
    face(o, slot, P, y, [0, 1, 0]);
    return;
  }
  if (shape === 'hipped' || shape === 'pyramidal') {
    const B = axes(P),
      R = B.rect,
      v = (B.V[0] + B.V[1]) / 2,
      span = Math.min((B.V[1] - B.V[0]) / 2, (B.U[1] - B.U[0]) / 2),
      a = B.point(B.U[0] + span, v),
      b = B.point(B.U[1] - span, v),
      L = [a[0], y + rise, a[1]],
      H = [b[0], y + rise, b[1]],
      q = R.map((v) => [v[0], y, v[1]]);
    Q(o, slot, [q[0], q[1], H, L], [0, 1, 0]);
    T(o, slot, [q[1], q[2], H], [0, 1, 0]);
    Q(o, slot, [q[2], q[3], L, H], [0, 1, 0]);
    T(o, slot, [q[3], q[0], L], [0, 1, 0]);
    return;
  }
  const B = axes(P),
    mid = (B.V[0] + B.V[1]) / 2,
    half = (B.V[1] - B.V[0]) / 2,
    Y = (q) => y + rise * (1 - Math.abs((q[0] * B.v[0] + q[1] * B.v[1] - mid) / half));
  for (const sign of [-1, 1]) {
    const side = clip(P, B.v, mid, sign);
    if (side.length > 2) face(o, slot, side, Y, [0, 1, 0]);
  }
  P = ccw(P);
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      D = (a[0] * B.v[0] + a[1] * B.v[1] - mid) * (b[0] * B.v[0] + b[1] * B.v[1] - mid),
      qs =
        D < 0
          ? [
              a,
              ...clip([a, b, m], B.v, mid, 1)
                .filter((q) => Math.abs(q[0] * B.v[0] + q[1] * B.v[1] - mid) < 1e-5)
                .slice(0, 1),
              b,
            ]
          : [a, b];
    for (let j = 1; j < qs.length; j++) {
      const a = qs[j - 1],
        b = qs[j];
      Q(
        o,
        'brick',
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], Y(b), b[1]],
          [a[0], Y(a), a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
}
const height = (t) =>
    Number.parseFloat(t.height) || Number.parseFloat(t['building:levels']) * 3 || 0,
  minimum = (t) =>
    Number.parseFloat(t.min_height) || Number.parseFloat(t['building:min_level']) * 3 || 0;
const roofClasses = {
    576870116: 'gabled',
    577223656: 'gabled',
    576870117: 'gabled',
    577223658: 'gabled',
    577225682: 'gabled',
    577225683: 'gabled',
    581301469: 'gabled',
    576865351: 'gabled',
    581301471: 'gabled',
    577225685: 'gabled',
    576872213: 'gabled',
    577223655: 'gabled',
    924820142: 'gabled',
    577223653: 'gabled',
    576870118: 'gabled',
    578169715: 'gabled',
    577225680: 'hipped',
  },
  mainHeights = {
    576870116: 18,
    577223656: 18,
    576870117: 15,
    577223658: 27,
    577225682: 18,
    577225683: 20.7,
    581301469: 20.7,
    576865351: 27,
    581301471: 18,
    577223662: 27,
    581301470: 27,
    576865353: 27,
    576865360: 27,
    581301472: 27,
    584933023: 27,
    580932914: 10.8,
    922855047: 15,
    922855043: 11.2,
    923389891: 0,
    576870118: 6,
    580932918: 10.5,
  },
  rowsById = {
    576870116: 4,
    577223656: 7,
    576870117: 4,
    577223658: 9,
    577225682: 6,
    577225683: 5,
    581301469: 5,
    576865351: 5,
    581301471: 5,
    577223662: 5,
    581301470: 5,
  };
export const buffaloTraceBuildings = p.buildings.map((b) => {
  const P = ccw(b.outline),
    c = centre(P),
    h = mainHeights[b.id] ?? height(b.tags) ?? 0,
    H = h || (/Warehouse/.test(b.tags.name || '') ? 21 : b.tags.building === 'office' ? 4.2 : 5.8),
    shape = roofClasses[b.id] || b.tags['roof:shape'] || 'flat',
    slot =
      b.tags['building:material'] === 'metal' || b.id === 576870117
        ? 'metal'
        : b.tags['building:material'] === 'stone' || b.tags.building === 'cabin'
          ? 'stone'
          : b.tags['building:material'] === 'plaster' || b.tags['building:material'] === 'concrete'
            ? 'concrete'
            : 'brick';
  return {
    ...b,
    outline: P,
    centre: c,
    base: buffaloTraceGround(...c) - 0.12,
    eave: H,
    shape,
    slot,
    rows: rowsById[b.id] || Math.max(1, Math.round(H / 4.5)),
  };
});
const at = (b, h) => b.base + h;
function component(o, b, q, d) {
  const t = q.tags;
  if (t.man_made === 'silo' || b.id === 923389891) return;
  const h =
      q.id === 922160348
        ? A.stillHeight
        : q.id === 925243203
          ? A.mashHeight
          : q.id === 923734981
            ? A.dryhouseHeight
            : height(t),
    lo = minimum(t);
  if (h <= lo + 0.01) return;
  const material = t['building:material'],
    slot =
      material === 'concrete'
        ? 'concrete'
        : material === 'stone'
          ? 'stone'
          : material === 'metal' || material === 'wood'
            ? 'metal'
            : 'brick',
    col =
      material === 'metal' && t.colour
        ? rgb(t.colour.slice(1))
        : material === 'wood'
          ? rgb('ddded3')
          : C[slot];
  prism(o, slot, q.outline, at(b, lo), at(b, h), col);
  const sh = t['roof:shape'];
  if (sh) {
    const rise =
      Number.parseFloat(t['roof:height']) ||
      Number.parseFloat(t['roof:levels']) * 3 ||
      (sh === 'flat' ? 0 : 1.2);
    roof(o, q.outline, at(b, h) + 0.025, rise, sh);
  }
  if (d > 1 && q.id === 922160348) industrialTower(o, b, q, d);
}
function rectangleWindow(o, a, u, n, w, h, y, b, d, arched = false) {
  const P = (x, yy, depth = 0.035) => [
      a[0] + u[0] * x + n[0] * depth,
      b.base + y + yy,
      a[1] + u[1] * x + n[1] * depth,
    ],
    n3 = [n[0], 0, n[1]],
    head = arched
      ? Array.from({ length: d === 3 ? 7 : 3 }, (_, i) => {
          const t = Math.PI - (i * Math.PI) / (d === 3 ? 6 : 2);
          return P((Math.cos(t) * w) / 2, h - w * 0.18 + Math.sin(t) * w * 0.18);
        })
      : [P(-w / 2, h), P(w / 2, h)],
    poly = [P(-w / 2, 0), P(w / 2, 0), ...head.reverse()];
  for (let k = 1; k < poly.length - 1; k++) T(o, 'glass', [poly[0], poly[k], poly[k + 1]], n3);
  if (d < 2) return;
  const strip = (x0, x1, y0, y1, col = C.metal) =>
    Q(o, 'metal', [P(x0, y0, 0.14), P(x1, y0, 0.14), P(x1, y1, 0.14), P(x0, y1, 0.14)], n3, col);
  if (d === 3 || [576870116, 577223658, 580932914, 577223656, 576870117].includes(b.id))
    strip(-w / 2 - 0.09, w / 2 + 0.09, -0.11, 0.01, C.stone);
  if (d === 3) {
    strip(-w / 2 - 0.08, -w / 2 + 0.015, 0, h);
    strip(w / 2 - 0.015, w / 2 + 0.08, 0, h);
    strip(-w / 2, w / 2, h - 0.05, h + 0.04);
    strip(-0.025, 0.025, 0, h);
    for (let j = 1; j < (h > 4 ? 8 : 2); j++) {
      const yy = (j * h) / (h > 4 ? 8 : 2);
      strip(-w / 2, w / 2, yy - 0.02, yy + 0.02);
    }
    if (arched) {
      for (let i = 0; i < 8; i++) {
        const aa = Math.PI - (i * Math.PI) / 8,
          bb = Math.PI - ((i + 1) * Math.PI) / 8,
          Q0 = (t, r) => P(Math.cos(t) * r, h - w * 0.18 + Math.sin(t) * w * 0.18, 0.13);
        Q(
          o,
          'brick',
          [Q0(aa, w / 2 + 0.12), Q0(bb, w / 2 + 0.12), Q0(bb, w / 2), Q0(aa, w / 2)],
          n3,
        );
      }
    }
  }
}
function windows(o, b, d) {
  if (d === 0 || b.id === 923389891) return;
  const core = [
    576870116, 577223658, 577223656, 576870117, 924820142, 580932914, 577223655, 576865351,
  ].includes(b.id);
  if (d === 1 && !core) return;
  const P = b.outline;
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      e = P[(i + 1) % P.length],
      len = Math.hypot(e[0] - a[0], e[1] - a[1]);
    if (len < 4) continue;
    const u = [(e[0] - a[0]) / len, (e[1] - a[1]) / len],
      n = [u[1], -u[0]],
      isC = b.id === 576870116,
      nrow = isC ? 4 : b.rows,
      cols = isC
        ? Math.max(1, Math.round(len / 5.2))
        : Math.max(1, Math.floor(len / (core ? 5.7 : 8))),
      skip = d === 1 ? 3 : d === 2 && !core ? 2 : 1;
    for (let r = 0; r < nrow; r += skip) {
      const rowH = b.eave / nrow,
        yy = isC ? [0.45, 4.3, 8.9, 13.5][r] : r * rowH + rowH * 0.25,
        hh = isC ? (r === 0 ? 1.55 : 3.0) : Math.min(2.1, rowH * 0.5);
      for (let k = 0; k < cols; k += skip) {
        const pos = [
            a[0] + (u[0] * len * (k + 0.5)) / cols,
            a[1] + (u[1] * len * (k + 0.5)) / cols,
          ],
          w = isC ? 1.28 : Math.min(1.35, (len / cols) * 0.42);
        rectangleWindow(o, pos, u, n, w, hh, yy, b, d, isC);
      }
    }
    if (d > 1 && isC) {
      for (let k = 0; k <= cols; k++) {
        const z = (len * k) / cols,
          q = [a[0] + u[0] * z, a[1] + u[1] * z],
          P0 = (x, y, dep) => [
            q[0] + u[0] * x + n[0] * dep,
            at(b, y),
            q[1] + u[1] * x + n[1] * dep,
          ];
        Q(
          o,
          'brick',
          [P0(-0.18, 3, 0.16), P0(0.18, 3, 0.16), P0(0.18, 17.7, 0.16), P0(-0.18, 17.7, 0.16)],
          [n[0], 0, n[1]],
        );
        if (d === 3 && (k === 0 || k === cols))
          for (let j = 0; j < 14; j++) {
            const y = 3 + j * 1.04;
            Q(
              o,
              'stone',
              [
                P0(-0.27, y, 0.19),
                P0(0.27, y, 0.19),
                P0(0.27, y + 0.23, 0.19),
                P0(-0.27, y + 0.23, 0.19),
              ],
              [n[0], 0, n[1]],
            );
          }
      }
    }
  }
}
function industrialTower(o, b, q, d) {
  const B = axes(q.outline),
    P = B.rect;
  for (let i = 0; i < 4; i++) {
    const a = P[i],
      e = P[(i + 1) % 4],
      l = Math.hypot(e[0] - a[0], e[1] - a[1]),
      u = [(e[0] - a[0]) / l, (e[1] - a[1]) / l],
      n = [u[1], -u[0]],
      cols = l > 8 ? 3 : 2;
    for (let j = 0; j < cols; j++) {
      const c = [a[0] + (u[0] * l * (j + 0.5)) / cols, a[1] + (u[1] * l * (j + 0.5)) / cols];
      rectangleWindow(o, c, u, n, (l / cols) * 0.6, 5.4, 10.9, b, d);
      rectangleWindow(o, c, u, n, (l / cols) * 0.6, 8.3, 17.2, b, d);
    }
    if (d === 3)
      for (let j = 0; j <= cols; j++) {
        const c = [a[0] + (u[0] * l * j) / cols, a[1] + (u[1] * l * j) / cols];
        box(o, 'brick', c[0], at(b, 10.7), c[1], 0.32, 15.7, 0.32);
      }
  }
}
function rustic(o, b, d) {
  const B = axes(b.outline),
    outer = B.rect,
    c = b.centre,
    inner = outer.map((q) => {
      const v = q.map((x, k) => x - c[k]),
        l = Math.hypot(...v);
      return q.map((x, k) => x - (v[k] * 1.7) / l);
    }),
    col = rgb('6e4f38');
  prism(o, 'metal', inner, b.base, at(b, 6), col, false);
  roof(o, inner, at(b, 6), 1.6);
  for (let i = 0; i < 4; i++) {
    const a = outer[i],
      z = outer[(i + 1) % 4],
      aa = inner[i],
      zz = inner[(i + 1) % 4],
      len = Math.hypot(z[0] - a[0], z[1] - a[1]),
      n = [z[1] - a[1], a[0] - z[0]],
      steps = Math.max(1, Math.round(len / 4));
    if (n[0] < -0.1) continue;
    for (const yy of [0.12, 3.05]) {
      Q(
        o,
        'metal',
        [
          [a[0], at(b, yy), a[1]],
          [z[0], at(b, yy), z[1]],
          [zz[0], at(b, yy), zz[1]],
          [aa[0], at(b, yy), aa[1]],
        ],
        [0, 1, 0],
        col,
      );
      if (d > 1)
        for (const h of [0.58, 1.0])
          axial(
            o,
            'metal',
            [a[0], at(b, yy + h), a[1]],
            [z[0], at(b, yy + h), z[1]],
            0.04,
            4,
            0.04,
            col,
          );
    }
    for (let k = 0; k <= steps; k++) {
      const q = a.map((v, j) => v + ((z[j] - v) * k) / steps);
      axial(
        o,
        'metal',
        [q[0], b.base, q[1]],
        [q[0], at(b, 6), q[1]],
        0.09,
        d === 1 ? 3 : 4,
        0.09,
        col,
      );
    }
  }
  if (d > 1)
    for (let i = 0; i < 4; i++) {
      const a = inner[i],
        z = inner[(i + 1) % 4];
      for (let y = 0.28; y < 6; y += d === 2 ? 0.8 : 0.28)
        axial(o, 'metal', [a[0], at(b, y), a[1]], [z[0], at(b, y), z[1]], 0.045, 4, 0.045, col);
    }
}
function buildings(o, d) {
  for (const b of buffaloTraceBuildings) {
    if (b.id === 923389891) continue;
    if (b.id === 576870118 && d > 0) {
      rustic(o, b, d);
      continue;
    }
    let P = d === 0 ? axes(b.outline).rect : b.outline;
    if (d > 1 && b.parts.length) {
      const c = b.centre;
      P = P.map((q) => q.map((v, k) => v + (c[k] - v) * 0.001));
    }
    prism(
      o,
      b.slot,
      P,
      b.base,
      at(b, b.eave),
      b.tags.building === 'cabin' ? rgb('6e4f38') : C[b.slot],
      false,
    );
    const rise =
      b.shape === 'flat' || (d === 0 && b.eave < 12)
        ? 0
        : Math.min(2.0, Math.min(axes(P).U[1] - axes(P).U[0], axes(P).V[1] - axes(P).V[0]) * 0.1);
    if (
      d < 2 ||
      !b.parts.some(
        (id) =>
          parts.get(id).tags['roof:shape'] &&
          Math.abs(area(parts.get(id).outline)) > Math.abs(area(b.outline)) * 0.5,
      )
    )
      roof(o, P, at(b, b.eave) + 0.02, rise, b.shape);
    if (d > 1) for (const id of b.parts) component(o, b, parts.get(id), d);
    else if (b.id === 580932914) {
      const q = parts.get(922160348);
      prism(
        o,
        'brick',
        d === 0 ? axes(q.outline).rect : q.outline,
        at(b, 10.8),
        at(b, A.stillHeight),
      );
    } else if (b.id === 576870116) {
      const q = parts.get(922614066);
      prism(o, 'brick', d === 0 ? axes(q.outline).rect : q.outline, b.base, at(b, 24));
    }
    windows(o, b, d);
  }
}
function grains(o, d) {
  const b = buffaloTraceBuildings.find((b) => b.id === 923389891),
    silos = p.parts.filter(
      (q) => q.parent === b.id && (q.tags.man_made === 'silo' || q.id === 922855046),
    );
  for (const q of silos) {
    const c = centre(q.outline),
      r = Math.sqrt(Math.abs(area(q.outline)) / Math.PI);
    ring(o, 'concrete', c[0], c[1], b.base, r, r, 21, [3, 8, 16, 24][d]);
    if (d > 1) ring(o, 'concrete', c[0], c[1], at(b, 20.7), r + 0.08, r + 0.08, 0.3, 16);
  }
  for (const id of [923388823, 922855042]) {
    const q = parts.get(id);
    prism(
      o,
      'concrete',
      d === 0 ? axes(q.outline).rect : q.outline,
      at(b, minimum(q.tags)),
      at(b, height(q.tags)),
    );
  }
  if (d > 1) {
    const c = centre(silos[0].outline);
    axial(o, 'metal', [c[0], at(b, 0), c[1] - 2.6], [c[0], at(b, 25), c[1] - 2.6], 0.06, 4);
  }
}
const tower = p.infrastructure.find((q) => q.id === 921723732),
  tc = centre(tower.outline),
  tb = buffaloTraceGround(...tc) - 0.12;
export const buffaloTraceTank = { centre: tc, base: tb, top: tb + A.waterTowerHeight };
function tank(o, d) {
  const n = [4, 12, 24, 40][d],
    P = (r, y, a) => [tc[0] + Math.cos(a) * r, tb + y, tc[1] + Math.sin(a) * r];
  ring(o, 'concrete', tc[0], tc[1], tb + 29.2, 4.7, 4.7, 5.8, n);
  ring(o, 'concrete', tc[0], tc[1], tb + 27, 0.6, 3.3, 0.8, n);
  ring(o, 'concrete', tc[0], tc[1], tb + 27.8, 3.3, 4.7, 1.4, n);
  ring(o, 'concrete', tc[0], tc[1], tb + 35, 5.0, 4.65, 0.5, n);
  if (d > 0) ring(o, 'concrete', tc[0], tc[1], tb, 0.48, 0.48, 27, 8);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4,
      lo = P(6.2, 0, a),
      hi = P(4.8, 29.2, a);
    if (d === 0) {
      for (const v of [
        [0.18, 0, 0],
        [0, 0, 0.18],
      ])
        Q(
          o,
          'metal',
          [
            lo.map((x, k) => x - v[k]),
            lo.map((x, k) => x + v[k]),
            hi.map((x, k) => x + v[k]),
            hi.map((x, k) => x - v[k]),
          ],
          [1, 0, 1],
        );
    } else axial(o, 'metal', lo, hi, 0.15, 6);
    if (d > 0) ring(o, 'concrete', lo[0], lo[2], tb - 0.12, 0.52, 0.52, 0.3, 8);
    if (d > 0)
      for (let j = 0; j < 3; j++) {
        const y = j * 9,
          a0 = P(6.2 - (y / 29.2) * 1.4, y, a),
          a1 = P(6.2 - ((y + 9) / 29.2) * 1.4, y + 9, a),
          bb = ((i + 1) * Math.PI) / 2 + Math.PI / 4,
          b0 = P(6.2 - (y / 29.2) * 1.4, y, bb),
          b1 = P(6.2 - ((y + 9) / 29.2) * 1.4, y + 9, bb);
        axial(o, 'metal', a0, b1, 0.035, d === 1 ? 3 : 4);
        axial(o, 'metal', b0, a1, 0.035, d === 1 ? 3 : 4);
        axial(o, 'metal', a1, b1, 0.07, d === 1 ? 3 : 4);
      }
  }
  if (d > 1) {
    for (let i = 0; i < (d === 2 ? 12 : 24); i++) {
      const a = (i * 2 * Math.PI) / (d === 2 ? 12 : 24),
        b = ((i + 1) * 2 * Math.PI) / (d === 2 ? 12 : 24);
      axial(o, 'metal', P(5.1, 29.2, a), P(5.1, 30.2, a), 0.027, 4);
      for (const y of [29.2, 29.7, 30.2]) axial(o, 'metal', P(5.1, y, a), P(5.1, y, b), 0.025, 4);
    }
    for (const x of [-0.22, 0.22])
      axial(
        o,
        'metal',
        [tc[0] + x, tb, tc[1] + 4.85],
        [tc[0] + x, tb + 35.3, tc[1] + 4.85],
        0.025,
        4,
      );
    for (let y = 0.3; y < 35; y += d === 2 ? 1.4 : 0.35)
      axial(
        o,
        'metal',
        [tc[0] - 0.22, tb + y, tc[1] + 4.85],
        [tc[0] + 0.22, tb + y, tc[1] + 4.85],
        0.02,
        4,
      );
  }
}
function links(o, d) {
  if (d === 0) return;
  for (const [a, b] of [
    [
      [-186, 59],
      [-111, 27],
    ],
    [
      [-204, 84],
      [-180, 52],
    ],
    [
      [-262, 99],
      [-333, 127],
    ],
    [
      [-242, 92],
      [-252, 57],
    ],
    [
      [-111, 27],
      [-41, 49],
    ],
  ]) {
    const y = Math.max(buffaloTraceGround(...a), buffaloTraceGround(...b)) + 6;
    axial(o, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.23, d === 1 ? 3 : 8);
    if (d > 1)
      for (const q of [a, b]) {
        axial(o, 'metal', [q[0], buffaloTraceGround(...q), q[1]], [q[0], y + 0.4, q[1]], 0.07, 4);
        for (const off of [-0.5, 0.5])
          axial(o, 'metal', [q[0] + off, y + 0.2, q[1]], [q[0] + off, y + 1, q[1]], 0.025, 4);
      }
  }
  if (d > 0)
    for (const q of p.infrastructure.filter((q) => q.tags.man_made === 'chimney')) {
      const c = centre(q.outline),
        r = Math.sqrt(Math.abs(area(q.outline)) / Math.PI),
        y = buffaloTraceGround(...c);
      ring(o, 'brick', c[0], c[1], y, r, r * 0.85, Number(q.tags.height), d === 1 ? 4 : 12);
    }
}
function build(o, _f, d = 3) {
  buildings(o, d);
  grains(o, d);
  tank(o, d);
  links(o, d);
}
export const buffaloTraceDistillerySkyline = (o, f) => build(o, f, 0),
  buffaloTraceDistilleryDistrict = (o, f) => build(o, f, 1),
  buffaloTraceDistilleryStreet = (o, f) => build(o, f, 2),
  buffaloTraceDistilleryCloseup = (o, f) => build(o, f, 3);
export const buffaloTraceDistilleryModel = {
  id: 'buffalo_trace_distillery',
  key: 'buffalo_trace_distillery',
  cell: 'dn/dng',
  recipe: 'structure-buffalo-trace-distillery.mjs',
  title: 'Buffalo Trace Distillery',
  category: 'industrial-complex',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [680, 510, 800],
  lookAt: [0, 12, 0],
  mediumFiContext: { scale: 1.8 },
  qaCameras: [
    {
      name: 'whole-maincampus-riverside-process-warehouses-and-distribution',
      position: [680, 510, 800],
      lookAt: [0, 12, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'warehouse-c-stone-base-three-arched-brick-rows-and-stairtower',
      position: [-63, 23, 165],
      lookAt: [-108, 12, 89],
    },
    {
      name: 'stillhouse-industrial-glazing-silos-and-connected-processcore',
      position: [-234, 35, 245],
      lookAt: [-310, 18, 166],
    },
    {
      name: 'water-tank-open-fourleg-braced-frame-and-historic-rickhouses',
      position: [-74, 35, 73],
      lookAt: [-111, 20, 20],
    },
    {
      name: 'concrete-tile-paired-warehouse-groups-native-campus-plan',
      position: [142, 100, -233],
      lookAt: [49, 17, -70],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Everybuildingbase samplesunchangedindependentfield atitscentre beforeanyvisualtuning; constructiongrade/providerdatum not survey, actualhostcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-buffalo-trace-distillery.mjs',
    level: 'skyline',
    export: 'buffaloTraceDistillerySkyline',
    errorMeters: 1.8,
    surfaces,
    authoredLevels: {
      district: { export: 'buffaloTraceDistilleryDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'buffaloTraceDistilleryStreet', errorMeters: 0.24, surfaces },
      closeup: { export: 'buffaloTraceDistilleryCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.selectionNotes,
    'Whole68nativebuildingmaincampus,166nativeparts near; skyline usesorientedrectangles/mergedparts andomitssmallfacadewindows. Primarytextgivesstructure/material/roofclasses, clearpublishedphotossupportCarchbays/stonelowlevel,Imanysmallwindows/stair/whitefourlegwatertower/stillglazing. Hiddennewblocks/windowcensus/finehardware/roofridges andnativelevels3mheightproxy arearchitecturalestimates,notas-builtsurvey. Partialnativeparts sitoverinsetfullparentmasses toavoidfloatinginfill/omittedunmappedfabric; mainflat/gableridgegeometryapproximate.',
    'Onewholemodelrepresentsthecontiguousmainproduction/visitorcampus, not allBuffaloTraceownedland/remote northernwarehousefarms. No industriallanduseparcel extrusion, isolatedwatertower substitution, publicroads/river/landscape/artworks/logos/signlettering/interiors/operatingmachinery.',
    'Four exactpublishedAcdixon2017Own/selfCC0originals individuallyinspected/nativeSHA1bound, unchangedpolicy passes. NativeOSMcontrolsinODbL; primaryNRHP2000inventorytextfacts only. No protectedPDFphotos/plans/ownerpromotionalimages adopted, no Quallamedia/body/category/policy edits, photographictextures/downloadedmesh/generatedbitmap.',
    'Independent1024m129square8m16641samplefield/fouroriginaltiles frozenbeforegeometry; allvalues/PNG/tilebytes preserved. Everyparentbase is preexistingfieldcentre elevation, not fabricated flatcampus floor. This mayembedcorners oncoarsecomposite terrain; no sourceflattening/fitting/reacquisition. Provider152.1041m fixedapproachdatum/actualhostgrade/footingcontact unverified; ordinarygeographicpreview/replacementdisabled.',
  ],
};
