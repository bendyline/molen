/** Whole native Chatham Manor; original bounded exterior geometry. */
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
    wall: rgb('a46d52'),
    trim: rgb('e5e3d9'),
    foundation: rgb('b6b2a2'),
    roof: rgb('565f62'),
    dark: rgb('344749'),
  },
  colors = ['d8d8d0', 'dfded6', 'd4d5cb'].map(rgb);
export const surfaces = {
  wall: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0 },
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
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) < 1e-6) return;
  beam(o, k, toWorld(a), toWorld(b), w, d, col);
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
const rect = (x, X, z, Z) => [
  [x, z],
  [X, z],
  [X, Z],
  [x, Z],
];
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
const archTop = (h, x) =>
  h.spring +
  (h.top - h.spring) *
    Math.sqrt(Math.max(0, 1 - ((x - h.center) * (x - h.center)) / (h.radius * h.radius)));
/** Genuine through-openings, with inward returns and closed masonry around each arch. */
function wall(o, k, a, b, depth, y, Y, holes, lod, col = C[k] ?? C.wall, courses = false) {
  const L = Math.hypot(...sub(b, a)),
    N = [2, 2, 8, 16][lod],
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
  xs = native.map((q) => q[0]),
  zs = native.map((q) => q[1]),
  x = Math.min(...xs),
  X = Math.max(...xs),
  z = Math.min(...zs),
  Z = Math.max(...zs),
  H = A.coreHalfLength;
export const physicalPlan = {
  whole: native,
  bounds: [x, z, X, Z],
  main: [-H, z, H, Z],
  wings: [
    [x, z, -H, Z],
    [H, z, X, Z],
  ],
};
function panel(a, b) {
  const L = Math.hypot(...sub(b, a)),
    u = sub(b, a).map((q) => q / L),
    n = [u[1], -u[0]];
  return {
    a,
    b,
    L,
    u,
    n,
    P: (t, y, d = 0) => [a[0] + u[0] * t + n[0] * d, y, a[1] + u[1] * t + n[1] * d],
  };
}
function plane(o, k, p, l, r, y, Y, d = 0, col = C[k]) {
  Q(o, k, [p.P(l, y, d), p.P(r, y, d), p.P(r, Y, d), p.P(l, Y, d)], [p.n[0], 0, p.n[1]], col);
}
function bar(o, k, p, l, r, y, Y, d = 0.05, depth = 0.07, col = C[k]) {
  const q = (t, v) => {
    const a = p.P(t, 0, v);
    return [a[0], a[2]];
  };
  solid(o, k, [q(l, d), q(r, d), q(r, d - depth), q(l, d - depth)], y, Y, col, false, true);
}
function border(o, p, h, lod) {
  const l = h.center - h.radius,
    r = h.center + h.radius,
    y = h.bottom,
    Y = h.top,
    d = -A.windowDepth;
  plane(o, 'dark', p, l, r, y, Y, d, C.dark);
  if (lod === 0) return;
  const b = lod === 1 ? 0.075 : 0.09;
  const add = (l, r, y, Y) =>
    lod === 1
      ? plane(o, 'trim', p, l, r, y, Y, d + 0.035)
      : bar(o, 'trim', p, l, r, y, Y, d + 0.055, 0.07);
  add(l, l + b, y, Y);
  add(r - b, r, y, Y);
  add(l, r, y, y + b);
  add(l, r, Y - b, Y);
  if (h.kind === 'basement') {
    if (lod > 1)
      for (let i = 1; i < 7; i++) {
        const t = l + ((r - l) * i) / 7;
        add(t - 0.018, t + 0.018, y, Y);
      }
    return;
  }
  if (h.kind === 'door') {
    add(l, r, Y - 0.48, Y - 0.42);
    add(h.center - 0.025, h.center + 0.025, y, Y - 0.48);
    if (lod > 1)
      for (const t of [l + 0.14, h.center + 0.12])
        for (const yy of [y + 0.25, y + 0.93])
          plane(o, 'trim', p, t, t + 0.38, yy, yy + 0.52, d + 0.006, rgb('d7d9cd'));
    return;
  }
  add(l, r, (y + Y) / 2 - 0.045, (y + Y) / 2 + 0.045);
  if (lod > 1) {
    for (const t of [l + (r - l) / 3, l + (2 * (r - l)) / 3]) add(t - 0.018, t + 0.018, y, Y);
    for (const yy of [y + (Y - y) / 4, y + (3 * (Y - y)) / 4]) add(l, r, yy - 0.017, yy + 0.017);
  } else add(h.center - 0.016, h.center + 0.016, y, Y);
  const sw = (r - l) * 0.46;
  for (const side of [-1, 1]) {
    const a = side < 0 ? l - sw - 0.08 : r + 0.08,
      b = a + sw;
    if (lod === 1) plane(o, 'dark', p, a, b, y, Y, 0.06, rgb('202b28'));
    else {
      bar(o, 'dark', p, a, b, y, Y, 0.075, 0.065, rgb('202b28'));
      if (lod === 3) {
        for (let yy = y + 0.11; yy < Y - 0.07; yy += 0.135)
          plane(
            o,
            'dark',
            p,
            a + 0.055,
            b - 0.055,
            yy,
            Math.min(Y - 0.045, yy + 0.05),
            0.084,
            rgb('303c35'),
          );
      }
    }
  }
  if (lod > 1) {
    bar(o, 'trim', p, l - 0.07, r + 0.07, y - 0.07, y, 0.08, 0.22);
    bar(o, 'wall', p, l - 0.06, r + 0.06, Y + 0.025, Y + 0.21, 0.035, 0.09, rgb('ba8567'));
  }
}
function facade(o, p, holes, top, lod, label, bottom = A.plinthTop) {
  if (lod === 0) {
    plane(o, 'wall', p, 0, p.L, bottom, top);
    for (const h of holes) {
      plane(o, 'dark', p, h.center - h.radius, h.center + h.radius, h.bottom, h.top, 0.018);
      if (h.kind === 'window')
        for (const side of [-1, 1]) {
          const l = h.center + side * (h.radius + 0.35) - 0.25;
          plane(o, 'dark', p, l, l + 0.5, h.bottom, h.top, 0.022, rgb('202b28'));
        }
    }
  } else {
    wall(o, 'wall', p.a, p.b, A.wallDepth, bottom, top, holes, lod);
    for (const h of holes) border(o, p, h, lod);
  }
  facadeEvidence.push({ label, a: p.a, b: p.b, holes, top, bottom });
}
function mainFacades(o, lod) {
  for (const side of [-1, 1]) {
    const v = side < 0 ? z : Z,
      p = side > 0 ? panel([H, v], [-H, v]) : panel([-H, v], [H, v]),
      t = (q) => (side > 0 ? H - q : q + H),
      holes = [];
    for (const q of A.mainBays) {
      if (q === 0)
        holes.push({
          center: t(q),
          radius: 0.69,
          bottom: A.entryThreshold,
          top: 4.23,
          kind: 'door',
        });
      else
        holes.push({
          center: t(q),
          radius: 0.57,
          bottom: A.firstWindowsBottom,
          top: A.firstWindowsTop,
          kind: 'window',
        });
      holes.push({
        center: t(q),
        radius: 0.57,
        bottom: A.upperWindowsBottom,
        top: A.upperWindowsTop,
        kind: 'window',
      });
    }
    facade(
      o,
      p,
      holes,
      A.mainEave,
      lod,
      side > 0 ? 'river-front-seven-bay-two-storey' : 'garden-side-seven-bay-two-storey',
    );
    const basement = A.mainBays
      .filter((q) => q !== 0)
      .map((q) => ({
        center: t(q),
        radius: 0.56,
        bottom: A.basementWindowsBottom,
        top: A.basementWindowsTop,
        kind: 'basement',
      }));
    facade(o, p, basement, A.plinthTop, lod, 'main-basement', A.foundationBottom);
    entry(o, p, t(0), lod, true);
  }
  for (const end of [-1, 1]) {
    const u = end * H,
      p = end > 0 ? panel([u, z], [u, Z]) : panel([u, Z], [u, z]),
      holes = [{ center: p.L / 2, radius: 0.52, bottom: 5.1, top: 7.3, kind: 'window' }];
    facade(o, p, holes, A.mainEave, lod, 'upper-gable-end-above-wing', A.wingEave);
  }
  for (const end of [-1, 1]) {
    const l = end < 0 ? x : H,
      r = end < 0 ? -H : X;
    for (const side of [-1, 1]) {
      const v = side < 0 ? z : Z,
        p = side > 0 ? panel([r, v], [l, v]) : panel([l, v], [r, v]),
        t = (q) => (side > 0 ? r - q : q - l),
        holes = [];
      for (let i = 0; i < A.wingBays.length; i++) {
        const q = end * A.wingBays[i];
        holes.push({
          center: t(q),
          radius: i === 0 ? 0.61 : 0.57,
          bottom: i === 0 ? A.entryThreshold : A.wingWindowsBottom,
          top: i === 0 ? 4.17 : A.wingWindowsTop,
          kind: i === 0 ? 'door' : 'window',
        });
      }
      facade(o, p, holes, A.wingEave, lod, 'attached-wing');
      const bs = A.wingBays.map((q) => ({
        center: t(end * q),
        radius: 0.54,
        bottom: 0.16,
        top: 0.92,
        kind: 'basement',
      }));
      facade(o, p, bs, A.plinthTop, lod, 'wing-basement', A.foundationBottom);
      entry(o, p, t(end * A.wingBays[0]), lod, false);
    }
    const q = end < 0 ? x : X,
      p = end > 0 ? panel([q, z], [q, Z]) : panel([q, Z], [q, z]);
    facade(
      o,
      p,
      [{ center: p.L / 2, radius: 0.54, bottom: 1.8, top: 4.05, kind: 'window' }],
      A.wingEave,
      lod,
      'wing-short-end',
      A.foundationBottom,
    );
  }
}
function entry(o, p, t, lod, main) {
  const width = main ? 2.1 : 1.3,
    d = main ? 2.5 : 1.7,
    N = lod === 0 ? 1 : 7;
  for (let i = 0; i < N; i++) {
    const a = p.P(t - width / 2, 0, 0),
      b = p.P(t + width / 2, 0, 0),
      c = p.P(t + width / 2, 0, d * (1 - i / N)),
      e = p.P(t - width / 2, 0, d * (1 - i / N));
    solid(
      o,
      'foundation',
      [a, b, c, e].map((q) => [q[0], q[2]]),
      A.foundationBottom,
      (A.entryThreshold * (i + 1)) / N,
      C.foundation,
      false,
      true,
    );
  }
  if (lod === 0) return;
  bar(o, 'trim', p, t - 0.8, t + 0.8, 4.17, 4.42, 0.18, 0.27);
  for (const side of [-1, 1]) {
    bar(
      o,
      'trim',
      p,
      t + side * 0.78 - 0.09,
      t + side * 0.78 + 0.09,
      A.entryThreshold,
      4.32,
      0.19,
      0.22,
    );
    if (main && lod > 1) {
      bar(o, 'trim', p, t + side * 0.9 - 0.12, t + side * 0.9 + 0.12, 1.4, 4.4, 0.2, 0.26);
    }
  }
  if (main) {
    const N = lod === 1 ? 6 : lod === 2 ? 12 : 24,
      R = 1.0,
      inner = 0.79;
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI) / N,
        b = ((i + 1) * Math.PI) / N;
      Q(
        o,
        'trim',
        [
          p.P(t + R * Math.cos(a), 4.48 + R * Math.sin(a), 0.21),
          p.P(t + R * Math.cos(b), 4.48 + R * Math.sin(b), 0.21),
          p.P(t + inner * Math.cos(b), 4.48 + inner * Math.sin(b), 0.21),
          p.P(t + inner * Math.cos(a), 4.48 + inner * Math.sin(a), 0.21),
        ],
        [p.n[0], 0, p.n[1]],
      );
    }
    // Original simplified central tablet, no copied coat-of-arms or sculptural relief.
    bar(o, 'trim', p, t - 0.17, t + 0.17, 4.46, 5.22, 0.24, 0.12);
  }
  if (!main && lod > 1)
    for (const side of [-1, 1]) {
      const a = p.P(t + side * 0.79, 1.36, 0.1),
        b = p.P(t + side * 0.79, 0.8, d);
      B(o, 'dark', a, b, 0.045, 0.045, rgb('252c28'));
      for (let i = 0; i < 5; i++) {
        const dd = (d * i) / 4,
          yy = 1.3 * (1 - i / 4) + 0.85;
        B(
          o,
          'dark',
          p.P(t + side * 0.79, Math.max(0, yy - 0.75), dd),
          p.P(t + side * 0.79, yy, dd),
          0.025,
          0.025,
          rgb('252c28'),
        );
      }
    }
}
function roof(o, l, r, eave, ridge, lod, label) {
  const over = lod === 0 ? 0.12 : 0.22,
    zz = z - over,
    ZZ = Z + over,
    mid = (z + Z) / 2,
    ll = l - over,
    rr = r + over;
  Q(
    o,
    'roof',
    [
      [ll, eave, zz],
      [rr, eave, zz],
      [rr, ridge, mid],
      [ll, ridge, mid],
    ],
    [0, 1, -1],
  );
  Q(
    o,
    'roof',
    [
      [ll, ridge, mid],
      [rr, ridge, mid],
      [rr, eave, ZZ],
      [ll, eave, ZZ],
    ],
    [0, 1, 1],
  );
  for (const end of [-1, 1]) {
    const u = end < 0 ? l : r;
    T(
      o,
      'wall',
      [
        [u, eave, z],
        [u, eave, Z],
        [u, ridge, mid],
      ],
      [end, 0, 0],
    );
    if (lod > 0) {
      B(o, 'trim', [u, eave, z - 0.09], [u, ridge + 0.025, mid], 0.12, 0.12);
      B(o, 'trim', [u, ridge + 0.025, mid], [u, eave, Z + 0.09], 0.12, 0.12);
    }
  }
  for (const side of [-1, 1]) {
    const v = side < 0 ? z : Z,
      pp = side > 0 ? panel([r, v], [l, v]) : panel([l, v], [r, v]);
    bar(o, 'trim', pp, 0, pp.L, eave - 0.33, eave - 0.22, 0.1, 0.2);
    bar(o, 'trim', pp, 0, pp.L, eave - 0.13, eave + 0.015, 0.22, 0.32);
    if (lod > 1) {
      const step = lod === 2 ? 0.65 : 0.3;
      for (let t = 0.2; t < pp.L - 0.2; t += step)
        bar(o, 'trim', pp, t, t + 0.1, eave - 0.23, eave - 0.12, 0.14, 0.17);
    }
    if (lod === 3)
      for (const t of [0.22, pp.L - 0.22]) {
        const q = pp.P(t, 0, 0.2);
        B(o, 'trim', [q[0], eave - 0.12, q[2]], [q[0], 0.15, q[2]], 0.065, 0.065);
      }
  }
  roofEvidence.push({ label, range: [l, r], eave, ridge });
}
function chimneys(o, lod) {
  for (const end of [-1, 1]) {
    const u = end * (H - 0.85),
      body = rect(u - 0.62, u + 0.62, -0.48, 0.48),
      outer = rect(u - 0.71, u + 0.71, -0.57, 0.57),
      inner = rect(u - 0.48, u + 0.48, -0.34, 0.34);
    solid(o, 'wall', body, A.mainRidge - 0.9, A.chimneyTop - 0.2, C.wall, false, false);
    solid(o, 'wall', outer, A.chimneyTop - 0.2, A.chimneyTop, C.wall, false, false);
    if (lod === 0) {
      cap(o, 'dark', outer, A.chimneyTop, true, rgb('202724'));
      continue;
    }
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4,
        a = inner[i],
        b = inner[j];
      Q(
        o,
        'wall',
        [
          [outer[i][0], A.chimneyTop, outer[i][1]],
          [outer[j][0], A.chimneyTop, outer[j][1]],
          [b[0], A.chimneyTop, b[1]],
          [a[0], A.chimneyTop, a[1]],
        ],
        [0, 1, 0],
      );
      Q(
        o,
        'wall',
        [
          [a[0], A.chimneyTop - 0.45, a[1]],
          [b[0], A.chimneyTop - 0.45, b[1]],
          [b[0], A.chimneyTop, b[1]],
          [a[0], A.chimneyTop, a[1]],
        ],
        [-(b[1] - a[1]), 0, b[0] - a[0]],
        rgb('58443b'),
      );
    }
    cap(o, 'dark', inner, A.chimneyTop - 0.45, true, rgb('242c28'));
  }
}
export function buildChathamManor(target, _frame, lod = 3) {
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
  part('whole-four-native-footprint-foundation', () => {
    solid(o, 'wall', native, A.foundationBottom - 0.06, A.foundationBottom, C.wall, lod > 0);
    for (const q of native)
      nativeEvidence.push({ id: 812997620, point: toWorld([q[0], A.foundationBottom, q[1]]) });
  });
  part('seven-bay-two-storey-manor-and-both-attached-wings-recessed-sash-shutters-entries', () =>
    mainFacades(o, lod),
  );
  part('whole-three-gabled-roofs-cornices-dentils-and-gutters', () => {
    roof(o, -H, H, A.mainEave, A.mainRidge, lod, 'whole-main-core');
    roof(o, x, -H, A.wingEave, A.wingRidge, lod, 'attached-northwest-wing');
    roof(o, H, X, A.wingEave, A.wingRidge, lod, 'attached-southeast-wing');
  });
  part('two-main-end-chimneys-open-flues', () => chimneys(o, lod));
}
export const chathamManorSkyline = (o) => buildChathamManor(o, null, 0),
  chathamManorDistrict = (o) => buildChathamManor(o, null, 1),
  chathamManorStreet = (o) => buildChathamManor(o, null, 2),
  chathamManorCloseup = (o) => buildChathamManor(o, null, 3);
export const chathamManorModel = {
  id: 'chatham_manor',
  key: 'chatham_manor',
  cell: 'dq/dqb',
  title: 'Chatham Manor',
  wikidataId: 'Q5087675',
  category: p.category,
  recipe: 'chatham-manor-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildChathamManor,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole Chatham Manor: seven-bay two-storey Georgian redbrick centralhouse and both attached single-storey wings in the native four-control envelope, three slate gabledroofs/tall endchimneys/white cornice and dentils/blackshutters/recessed sash and entry doors, simplified segmental pediment doorcase/stone stairs and basementgrilles. Cleared published Qualla creator-public-domain wholehouse photograph first, distinct Highsmith garden-side publicdomain supplement. Original bounded exterior, no entireestate or separate outbuildings.',
  camera: toWorld([48, 25, 64]),
  lookAt: toWorld([0, 5, 0]),
  portableGroundY: F - 0.68,
  mediumFiContext: { scale: '1.3', groundY: F - 0.58, cameraYaw: 0.4 },
  embeddedCanonicalGraphs: ['brick_flemish', 'wood_plain', 'stone_limestone_raw', 'slate'],
  qaCameras: [
    {
      name: 'whole-river-facing-house-and-both-attached-wings',
      position: toWorld([42, 22, 57]),
      lookAt: toWorld([0, 5, 0]),
    },
    {
      name: 'whole-four-control-manor-three-roofs-plan',
      position: toWorld([0, 90, 0.2]),
      lookAt: toWorld([0, 1, 0]),
    },
    {
      name: 'seven-bay-sash-shutters-segmental-entry-and-stairs',
      position: toWorld([14, 8, 23]),
      lookAt: toWorld([1, 4, 4.6]),
    },
    {
      name: 'whole-garden-face-main-house-and-attached-wings',
      position: toWorld([-41, 22, -59]),
      lookAt: toWorld([0, 5, 0]),
    },
    {
      name: 'wing-door-stairs-cornice-and-main-gable-chimney',
      position: toWorld([35, 12, 22]),
      lookAt: toWorld([15, 5, 0]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/chatham-manor-runtime-overlay.mjs',
    level: 'skyline',
    export: 'chathamManorSkyline',
    errorMeters: 2.6,
    surfaces,
    authoredLevels: {
      district: { export: 'chathamManorDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'chathamManorStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'chathamManorCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.nativePlanInterpretation,
    p.sectionBasis,
    'Exact published Rutke4212008 PD-user-en wholehouse original first and distinct explicit LOC Highsmith PD garden-side original. No photo pixels embedded. No estate gardens, pavilions, statue, outbuildings, people, vehicles or furnishings.',
    'Roof/centralcore-wing subdivisions, heights, rear openings/shutter census, fine cornice/pediment profiles and current finishes are bounded original estimates. No copied relief; opaque glazing omits interiors.',
    'Original terrain/floor/sections frozen before geometry, contact unverified, preview only and replacement false. Flatground/context neighboring houses are review fixtures.',
  ],
};
