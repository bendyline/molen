/** Whole Arkansas State Capitol: native podium, dimensional main body, peristyle and stone dome. */
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
  F = p.parameters.floorY,
  raw = f.geometry.outline.slice(0, -1),
  TAU = 2 * Math.PI;
const area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  R = area(raw) > 0 ? raw : raw.slice().reverse(),
  B = R.map((q) => q.map((x, i) => x * p.parameters.bodyScale[i])),
  C = { stone: rgb('d5d0bc'), roof: rgb('777e7b'), glass: rgb('62777b'), gold: rgb('b88a34') };
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.88, metallic: 0.08 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.015 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.5, metallic: 0.75 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  G = (q) => [q[0], F + q[1], q[2]];
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-8) throw Error('Collapsed Capitol face');
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    q.map((v) => (Math.abs(n?.[1] ?? 0) > 0.8 ? [v[0], v[2]] : [v[0] + v[2], v[1]])),
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
    if (!found) throw Error('Invalid Capitol ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], y, r[i][1]]),
      [0, up ? 1 : -1, 0],
    );
}
function poly(o, k, r, y0, y1) {
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
    );
  }
  cap(o, k, r, y0, false);
  cap(o, k, r, y1);
}
function box(o, k, lo, hi, M = (q) => q) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi,
    ds = [
      [
        [x, y, z],
        [X, y, z],
        [X, Y, z],
        [x, Y, z],
      ],
      [
        [x, y, Z],
        [X, y, Z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [
        [x, y, z],
        [x, y, Z],
        [x, Y, Z],
        [x, Y, z],
      ],
      [
        [X, y, z],
        [X, y, Z],
        [X, Y, Z],
        [X, Y, z],
      ],
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
    ],
    ns = [
      [0, 0, -1],
      [0, 0, 1],
      [-1, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
    ],
    O = M([0, 0, 0]);
  for (let i = 0; i < 6; i++) Q(o, k, ds[i].map(M), sub(M(ns[i]), O));
}
function beam(o, k, a, b, r, N = 4) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    P = (q, t) => q.map((x, i) => x + r * (u[i] * Math.cos(t) + v[i] * Math.sin(t)));
  for (let i = 0; i < N; i++) {
    const t = (i * TAU) / N,
      s = ((i + 1) * TAU) / N,
      n = u.map((x, j) => x * Math.cos((s + t) / 2) + v[j] * Math.sin((s + t) / 2));
    Q(o, k, [P(a, t), P(a, s), P(b, s), P(b, t)], n);
    T(
      o,
      k,
      [a, P(a, s), P(a, t)],
      d.map((x) => -x),
    );
    T(o, k, [b, P(b, t), P(b, s)], d);
  }
}
function lathe(o, k, centre, profile, N, closed = true, phase = 0) {
  const P = ([r, y], t) => [centre[0] + r * Math.cos(t), y, centre[1] + r * Math.sin(t)];
  for (let j = 0; j < profile.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const a = phase + (i * TAU) / N,
        b = phase + ((i + 1) * TAU) / N,
        r = profile[j],
        s = profile[j + 1];
      Q(
        o,
        k,
        [P(r, a), P(r, b), P(s, b), P(s, a)],
        [Math.cos((a + b) / 2), (r[0] - s[0]) / (s[1] - r[1]), Math.sin((a + b) / 2)],
      );
    }
  if (closed)
    for (const [j, up] of [
      [0, false],
      [profile.length - 1, true],
    ]) {
      const ring = Array.from({ length: N }, (_, i) => {
        const q = P(profile[j], phase + (i * TAU) / N);
        return [q[0], q[2]];
      });
      cap(o, k, ring, profile[j][1], up);
    }
}
function facade(a, b, name) {
  const u = unit(sub(b, a)),
    n = [u[1], -u[0]],
    L = Math.hypot(...sub(b, a)),
    M = ([x, y, z]) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[1] * z];
  return { a, b, u, n, L, M, name };
}
export const recessEvidence = [],
  columnEvidence = [],
  nativeEvidence = raw,
  bodyEvidence = B;
function rectWall(o, fa, y0, y1, holes, lod) {
  const xs = [
      ...new Set([
        0,
        fa.L,
        ...holes.flatMap((h) => [Math.max(0, h.x - h.w / 2), Math.min(fa.L, h.x + h.w / 2)]),
      ]),
    ].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])])].sort((a, b) => a - b),
    normal = [fa.n[0], 0, fa.n[1]],
    M = fa.M;
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const a = xs[i - 1],
        b = xs[i],
        c = ys[j - 1],
        d = ys[j];
      if (
        b - a < 1e-6 ||
        d - c < 1e-6 ||
        holes.some(
          (h) =>
            (a + b) / 2 > h.x - h.w / 2 &&
            (a + b) / 2 < h.x + h.w / 2 &&
            (c + d) / 2 > h.y &&
            (c + d) / 2 < h.y + h.h,
        )
      )
        continue;
      Q(
        o,
        'stone',
        [
          [a, c, 0],
          [b, c, 0],
          [b, d, 0],
          [a, d, 0],
        ].map(M),
        normal,
      );
    }
  for (const h of holes) {
    const l = Math.max(0, h.x - h.w / 2),
      r = Math.min(fa.L, h.x + h.w / 2),
      bot = h.y,
      top = h.y + h.h,
      dep = h.depth ?? 0.38,
      k = h.kind === 'door' ? 'gold' : 'glass';
    if (r - l < 1e-5) continue;
    const q = [
      [l, bot, -dep],
      [r, bot, -dep],
      [r, top, -dep],
      [l, top, -dep],
    ].map(M);
    Q(o, k, q, normal);
    for (const [points, n] of [
      [
        [
          [l, bot, 0],
          [l, top, 0],
          [l, top, -dep],
          [l, bot, -dep],
        ],
        [1, 0, 0],
      ],
      [
        [
          [r, bot, 0],
          [r, top, 0],
          [r, top, -dep],
          [r, bot, -dep],
        ],
        [-1, 0, 0],
      ],
      [
        [
          [l, bot, 0],
          [r, bot, 0],
          [r, bot, -dep],
          [l, bot, -dep],
        ],
        [0, 1, 0],
      ],
      [
        [
          [l, top, 0],
          [r, top, 0],
          [r, top, -dep],
          [l, top, -dep],
        ],
        [0, -1, 0],
      ],
    ])
      Q(o, 'stone', points.map(M), sub(M(n), M([0, 0, 0])));
    recessEvidence.push({
      label: h.kind ?? 'window',
      centre: M([(l + r) / 2, (bot + top) / 2, 0.04]),
      normal,
      depth: dep,
      facade: fa.name,
    });
    if (lod >= 2) {
      for (const x of [l - 0.1, r])
        Q(
          o,
          'stone',
          [
            [x, bot - 0.1, 0.04],
            [x + 0.1, bot - 0.1, 0.04],
            [x + 0.1, top + 0.1, 0.04],
            [x, top + 0.1, 0.04],
          ].map(M),
          normal,
        );
      if (lod >= 3)
        box(
          o,
          k,
          [(l + r) / 2 - 0.035, bot, -dep + 0.01],
          [(l + r) / 2 + 0.035, top, -dep + 0.08],
          M,
        );
      else
        Q(
          o,
          h.kind === 'door' ? 'gold' : 'roof',
          [
            [(l + r) / 2 - 0.035, bot, -dep + 0.08],
            [(l + r) / 2 + 0.035, bot, -dep + 0.08],
            [(l + r) / 2 + 0.035, top, -dep + 0.08],
            [(l + r) / 2 - 0.035, top, -dep + 0.08],
          ].map(M),
          normal,
        );
      if (lod >= 3) {
        box(o, 'stone', [l - 0.14, bot - 0.16, -0.02], [r + 0.14, bot - 0.02, 0.2], M);
        for (const t of h.kind === 'door' ? [0.25, 0.68, 0.84] : [0.25, 0.72])
          box(o, k, [l, bot + h.h * t, -dep + 0.02], [r, bot + h.h * t + 0.05, -dep + 0.08], M);
      }
    }
  }
}
function column(o, [x, z], y0, y1, r, lod, n = [1, 0], label = 'column') {
  const N = [4, 4, 6, 12][lod],
    prof =
      lod === 0
        ? [
            [r, y0],
            [r * 0.86, y1],
          ]
        : lod <= 2
          ? [
              [r * 1.2, y0],
              [r, y0 + 0.5],
              [r * 0.88, y1 - 0.3],
              [r * 1.16, y1],
            ]
          : [
              [r * 1.2, y0],
              [r * 1.2, y0 + 0.25],
              [r, y0 + 0.5],
              [r * 0.88, y1 - 0.55],
              [r * 1.16, y1 - 0.3],
              [r * 1.16, y1],
            ];
  lathe(o, 'stone', [x, z], prof, N);
  columnEvidence.push({ label, centre: [x, z], y0, y1, r, lod });
  if (lod >= 2) {
    const tangent = [-n[1], n[0]],
      M = ([a, y, b]) => [x + tangent[0] * a + n[0] * b, y, z + tangent[1] * a + n[1] * b];
    if (lod >= 3 || label === 'entrance')
      box(o, 'stone', [-r * 1.35, y1 - 0.05, -r * 1.1], [r * 1.35, y1 + 0.22, r * 1.1], M);
    if (lod >= 3 || label === 'entrance')
      for (const side of [-1, 1]) {
        const segments = lod >= 3 ? 10 : 7;
        let last;
        for (let i = 0; i <= segments; i++) {
          const t = i / segments,
            angle = TAU * 1.18 * t,
            rad = r * 0.47 * (1 - 0.8 * t),
            q = M([
              side * r * 0.84 + side * Math.cos(angle) * rad,
              y1 - 0.12 + Math.sin(angle) * rad,
              r * 0.96,
            ]);
          if (last) beam(o, 'stone', last, q, r * 0.09, lod >= 3 ? 4 : 3);
          last = q;
        }
      }
  }
}
function cornice(o, fa, y, lod) {
  if (lod === 0) return;
  box(o, 'stone', [-0.12, y - 0.18, -0.08], [fa.L + 0.12, y + 0.22, 0.38], fa.M);
  if (lod >= 2) {
    box(o, 'stone', [-0.18, y + 0.22, -0.08], [fa.L + 0.18, y + 0.52, 0.62], fa.M);
    if (lod >= 3) {
      const n = Math.floor(fa.L / 0.72);
      for (let i = 0; i < n; i++)
        box(
          o,
          'stone',
          [((i + 0.2) * fa.L) / n, y - 0.45, 0.04],
          [((i + 0.6) * fa.L) / n, y - 0.18, 0.3],
          fa.M,
        );
    }
  }
}
function balustrade(o, fa, lod) {
  const y = A.entablatureTop;
  if (lod === 0) return;
  box(o, 'stone', [0, y, -0.22], [fa.L, y + 0.35, 0.28], fa.M);
  box(o, 'stone', [0, A.parapetTop - 0.2, -0.22], [fa.L, A.parapetTop, 0.28], fa.M);
  if (lod >= 2) {
    const n = Math.max(1, Math.floor(fa.L / (lod >= 3 ? 1.6 : 2.3)));
    for (let i = 0; i <= n; i++) {
      const q = fa.M([(fa.L * i) / n, y + 0.35, 0]),
        w = lod === 3 ? 0.18 : 0.12;
      lathe(
        o,
        'stone',
        [q[0], q[2]],
        lod === 3
          ? [
              [w, y + 0.35],
              [w * 0.65, y + 0.58],
              [w * 1.2, y + 0.82],
              [w * 0.6, A.parapetTop - 0.4],
              [w, A.parapetTop - 0.2],
            ]
          : [
              [w, y + 0.35],
              [w, A.parapetTop - 0.2],
            ],
        lod === 3 ? 6 : 4,
      );
    }
  }
}
function body(o, lod) {
  poly(o, 'stone', R, 0, A.podiumTop);
  cap(o, 'roof', B, A.entablatureTop);
  cap(o, 'stone', B, A.podiumTop, false);
  for (let i = 0; i < B.length; i++) {
    const fa = facade(B[i], B[(i + 1) % B.length], `body-${i}`),
      mid = (fa.a[1] + fa.b[1]) / 2,
      front = fa.n[0] > 0.7,
      central = front && Math.abs(mid) < 17,
      holes = [];
    if (central) {
      for (const z of [-6, 0, 6]) {
        const t = (z - fa.a[1]) / fa.u[1];
        if (t + 1.5 > 0 && t - 1.5 < fa.L) {
          holes.push({ x: t, w: 3, y: A.landingY, h: 3.048, kind: 'door', depth: 0.5 });
          if (lod > 0) holes.push({ x: t, w: 2.2, y: 16, h: 3.2, kind: 'portico-upper-window' });
        }
      }
    } else if (lod > 0 && fa.L > 8) {
      const count = Math.max(1, Math.floor(fa.L / (lod === 1 ? 12 : lod === 2 ? 8 : 6))),
        pitch = fa.L / count;
      for (let j = 0; j < count; j++) {
        const x = pitch * (j + 0.5);
        for (const [y, h] of lod === 1
          ? [[8, 13.7]]
          : [
              [1.6, 3.8],
              [7.5, 6.3],
              [15.2, 7.3],
            ])
          holes.push({ x, w: Math.min(2.25, pitch * 0.48), y, h });
      }
    }
    rectWall(o, fa, A.podiumTop, A.entablatureTop, holes, lod);
    cornice(o, fa, A.entablatureTop, lod);
    if (fa.L > 8) balustrade(o, fa, lod);
    if (lod >= 2 && fa.L > 12)
      for (const y of [6.6, 14.5])
        box(o, 'stone', [0, y - 0.12, -0.02], [fa.L, y + 0.12, 0.15], fa.M);
    if (front && fa.L > 20 && lod > 0) {
      const count = lod === 1 ? 3 : 6;
      for (let j = 0; j < count; j++) {
        const q = fa.M([(fa.L * (j + 0.5)) / count, 0, 0.95]);
        column(o, [q[0], q[2]], 6.8, 23.25, 0.66, lod, fa.n, 'wing');
      }
    }
  }
}
const frontX = 25,
  porticoX = 32.1,
  frontM = ([s, y, d]) => [frontX + d, y, s];
function circlePanel(o, M, w, y0, y1, r, centreY, lod) {
  const N = [4, 8, 12, 20][lod],
    dep = 0.3,
    P = (rad, t, z) => M([rad * Math.cos(t), centreY + rad * Math.sin(t), z]),
    normal = sub(M([0, 0, 1]), M([0, 0, 0]));
  // Include every rectangular corner: a regular angular fan alone cuts them off.
  const angles = [
    ...Array.from({ length: N }, (_, i) => (i * TAU) / N),
    ...[-w / 2, w / 2].flatMap((x) =>
      [y0 - centreY, y1 - centreY].map((y) => (Math.atan2(y, x) + TAU) % TAU),
    ),
  ].sort((a, b) => a - b);
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = i + 1 === angles.length ? TAU : angles[i + 1],
      outer = (t) => {
        const dx = Math.cos(t),
          dy = Math.sin(t),
          scale = Math.min(
            w / 2 / Math.max(1e-9, Math.abs(dx)),
            (dy >= 0 ? y1 - centreY : centreY - y0) / Math.max(1e-9, Math.abs(dy)),
          );
        return M([dx * scale, centreY + dy * scale, 0]);
      };
    Q(o, 'stone', [outer(a), outer(b), P(r, b, 0), P(r, a, 0)], normal);
    Q(
      o,
      'stone',
      [P(r, a, 0), P(r, b, 0), P(r, b, -dep), P(r, a, -dep)],
      sub(M([-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0]), M([0, 0, 0])),
    );
    T(o, 'glass', [M([0, centreY, -dep]), P(r, a, -dep), P(r, b, -dep)], normal);
  }
}
function pediment(o, M, width, base, peak, depth) {
  const a = M([-width / 2, base, -depth]),
    b = M([width / 2, base, -depth]),
    c = M([0, peak, -depth]),
    A0 = M([-width / 2, base, 0.3]),
    B0 = M([width / 2, base, 0.3]),
    C0 = M([0, peak, 0.3]);
  T(o, 'stone', [A0, B0, C0], sub(M([0, 0, 1]), M([0, 0, 0])));
  T(o, 'stone', [a, b, c], sub(M([0, 0, -1]), M([0, 0, 0])));
  Q(o, 'stone', [a, b, B0, A0], [0, -1, 0]);
  Q(o, 'stone', [a, c, C0, A0], sub(M([-1, 1, 0]), M([0, 0, 0])));
  Q(o, 'stone', [c, b, B0, C0], sub(M([1, 1, 0]), M([0, 0, 0])));
}
function portico(o, lod) {
  box(o, 'stone', [-13.5, A.landingY, -0.4], [13.5, A.landingY + 0.35, 7.8], frontM);
  for (const s of [-14.5, 14.5])
    box(o, 'stone', [s - 2.5, A.landingY, -1.7], [s + 2.5, A.centralBlockTop, 4.8], frontM);
  for (let j = 0; j < 6; j++)
    column(
      o,
      [porticoX, -11 + (22 * j) / 5],
      A.landingY + 0.35,
      23.55,
      0.78,
      lod,
      [1, 0],
      'entrance',
    );
  box(o, 'stone', [-13.5, 23.55, -0.4], [13.5, 25.4, 7.8], frontM);
  if (lod >= 1) {
    for (let j = 0; j < 5; j++)
      circlePanel(
        o,
        (q) => frontM([q[0] + (j - 2) * 4.9, q[1], q[2] + 7.8]),
        4.9,
        25.4,
        29.6,
        0.78,
        27.45,
        lod,
      );
  } else box(o, 'stone', [-12.3, 25.4, 7.1], [12.3, 29.6, 7.8], frontM);
  pediment(o, (q) => frontM([q[0], q[1], q[2] + 7.8]), 27, 29.6, A.pedimentPeak, 8.4);
  const count = [4, 12, 35, 35][lod];
  for (let j = 0; j < count; j++) {
    const y = (A.landingY * (j + 1)) / count,
      d = ((count - j) * 11.55) / count;
    box(o, 'stone', [-13.5, 0, 7.8 + d - 11.55 / count], [13.5, y, 7.8 + d], frontM);
  }
  if (lod >= 2)
    for (const s of [-14.2, 14.2]) {
      const a = frontM([s, A.landingY + 0.9, 7.8]),
        b = frontM([s, 0.9, 19.35]);
      beam(o, 'stone', a, b, 0.2, 4);
      for (let j = 0; j <= 9; j++) {
        const t = j / 9,
          q = a.map((x, i) => x + (b[i] - x) * t);
        beam(o, 'stone', [q[0], q[1] - 0.8, q[2]], q, 0.11, 4);
      }
    }
}
function drumAndDome(o, lod) {
  const centre = A.domeCentre,
    N = [8, 12, 24, 48][lod],
    drumN = [8, 12, 24, 24][lod],
    r = A.drumRadius;
  lathe(
    o,
    'stone',
    centre,
    [
      [15.8, A.drumBottom],
      [15.8, 32.5],
    ],
    N,
  );
  if (lod === 0)
    lathe(
      o,
      'stone',
      centre,
      [
        [r, 32.5],
        [r, 44.2],
      ],
      N,
    );
  else {
    const ring = Array.from({ length: drumN }, (_, i) => [
      centre[0] + r * Math.cos((i * TAU) / drumN),
      centre[1] + r * Math.sin((i * TAU) / drumN),
    ]);
    for (let i = 0; i < drumN; i++) {
      const fa = facade(ring[i], ring[(i + 1) % drumN], `drum-${i}`);
      rectWall(
        o,
        fa,
        32.5,
        44.2,
        [
          {
            x: fa.L / 2,
            w: Math.min(1.65, fa.L * 0.65),
            y: 34.5,
            h: 8.2,
            kind: 'drum-window',
            depth: 0.3,
          },
        ],
        lod,
      );
    }
    cap(o, 'stone', ring, 32.5, false);
    cap(o, 'stone', ring, 44.2);
  }
  const cols = [8, 12, 24, 24][lod];
  for (let i = 0; i < cols; i++) {
    const t = (i * TAU) / cols,
      n = [Math.cos(t), Math.sin(t)];
    column(
      o,
      [centre[0] + A.peristyleRadius * n[0], centre[1] + A.peristyleRadius * n[1]],
      A.columnBottom,
      A.columnTop,
      0.58,
      lod,
      n,
      'drum',
    );
  }
  lathe(
    o,
    'stone',
    centre,
    lod === 0
      ? [
          [16.7, 44.2],
          [16.7, 46.5],
          [14.8, 48.2],
        ]
      : [
          [16.8, 44.2],
          [16.8, 44.7],
          [17.1, 45.1],
          [17.1, 45.7],
          [16.6, 46.5],
          [14.8, 48.2],
        ],
    N,
  );
  const rings = [4, 6, 10, 16][lod],
    profile = [];
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    profile.push([
      A.domeRadius * Math.sqrt(Math.max(0.012, 1 - t * t * 0.988)),
      A.domeBase + (A.domeTop - A.domeBase) * t,
    ]);
  }
  lathe(o, 'stone', centre, profile, N);
  if (lod >= 2)
    for (let i = 0; i < (lod === 2 ? 8 : 16); i++) {
      const t = (i * TAU) / (lod === 2 ? 8 : 16);
      for (let j = 0; j < profile.length - 1; j++) {
        const [r, y] = profile[j],
          [R, Y] = profile[j + 1];
        beam(
          o,
          'stone',
          [centre[0] + (r + 0.09) * Math.cos(t), y, centre[1] + (r + 0.09) * Math.sin(t)],
          [centre[0] + (R + 0.09) * Math.cos(t), Y, centre[1] + (R + 0.09) * Math.sin(t)],
          0.08,
          lod === 3 ? 4 : 3,
        );
      }
    }
  lathe(
    o,
    'stone',
    centre,
    [
      [2.15, 58.5],
      [2.15, 59.2],
    ],
    N,
  );
  const lanternColumns = [4, 6, 8, 8][lod];
  for (let i = 0; i < lanternColumns; i++) {
    const t = (i * TAU) / lanternColumns;
    beam(
      o,
      'stone',
      [centre[0] + 1.65 * Math.cos(t), 59.2, centre[1] + 1.65 * Math.sin(t)],
      [centre[0] + 1.65 * Math.cos(t), 62.3, centre[1] + 1.65 * Math.sin(t)],
      0.18,
      [3, 4, 6, 8][lod],
    );
  }
  lathe(
    o,
    'gold',
    centre,
    [
      [2.2, 62.3],
      [2.2, 62.7],
      [0.5, 63.45],
      [0.4, 64.02],
    ],
    N,
  );
  const ballN = [4, 8, 12, 16][lod];
  lathe(
    o,
    'gold',
    centre,
    [
      [0.04, 64.0224],
      [0.35, 64.1724],
      [0.45, 64.4724],
      [0.35, 64.7724],
      [0.04, A.finialTop],
    ],
    ballN,
  );
}
function sidePavilions(o, lod) {
  for (const z of [-53, 53]) {
    const centre = [3, z],
      fac = facade([25, z - 11], [25, z + 11], 'side-pavilion');
    if (lod >= 1) {
      box(o, 'stone', [-11, 25.5, -13], [11, 28.3, 0.8], (q) => [25 + q[2], q[1], z + q[0]]);
      pediment(o, (q) => [26 + q[2], q[1], z + q[0]], 24, 28.3, 32.1, 12);
    }
    if (lod >= 1) {
      const N = lod === 1 ? 8 : 16,
        prof = [
          [8.5, 27.2],
          [8.5, 27.8],
          [7.2, 29.4],
          [3.5, 31.2],
          [0.2, 31.6],
        ];
      lathe(o, 'glass', centre, prof, N);
      if (lod >= 2)
        for (let i = 0; i < N; i++) {
          const t = (i * TAU) / N;
          for (let j = 0; j < prof.length - 1; j++) {
            const [r, y] = prof[j],
              [R, Y] = prof[j + 1];
            beam(
              o,
              'roof',
              [centre[0] + r * Math.cos(t), y, centre[1] + r * Math.sin(t)],
              [centre[0] + R * Math.cos(t), Y, centre[1] + R * Math.sin(t)],
              0.08,
              4,
            );
          }
        }
    } else
      lathe(
        o,
        'roof',
        centre,
        [
          [8, 27],
          [0.2, 30],
        ],
        4,
      );
    if (lod >= 2) cornice(o, fac, 28, lod);
  }
}
export function buildArkansasCapitol(o, _frame, lod = 3) {
  recessEvidence.length = 0;
  columnEvidence.length = 0;
  body(o, lod);
  box(o, 'stone', [-16.8, A.entablatureTop, -18], [15.8, A.drumBottom, 18]);
  portico(o, lod);
  drumAndDome(o, lod);
  sidePavilions(o, lod);
}
export const arkansasCapitolSkyline = (o) => buildArkansasCapitol(o, null, 0),
  arkansasCapitolDistrict = (o) => buildArkansasCapitol(o, null, 1),
  arkansasCapitolStreet = (o) => buildArkansasCapitol(o, null, 2),
  arkansasCapitolCloseup = (o) => buildArkansasCapitol(o, null, 3);
export const arkansasCapitolModel = {
  id: 'arkansas_state_capitol',
  key: 'arkansas_state_capitol',
  cell: '9y/9yn',
  title: 'Arkansas State Capitol',
  wikidataId: 'Q673076',
  category: p.category,
  recipe: 'arkansas-state-capitol-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildArkansasCapitol,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole ArkansasStateCapitol with native30control lowpodium and official134.112x59.7408m mainbody/64.9224m cupola, both long limestonewings/physicalwindowrecesses/giantcolumns/entablature/roofbalustrades/endpavilions/roofskylights, sixIoniccolumn mainportico/three closedbronzedoors/upperoculi/pediment/flankingblocks/broadintrinsicstairs, circularperistyledrum/closedopaquewindows/ribbedpaleIndiana-limestone dome/openlantern/gildedcapandball. Two exactpublished2021DsduganCC0 front originals; officialdimensions factual only. Native envelope/podiuminterpretation/hiddenrear/roof/domecentre/census/sections currentfinefinish estimated. No copied glassart/crests/inscriptions/sculpture/flags/lamps/grounds/interior/photo pixels; mainstone dome stayspale.',
  camera: [210, 125, 180],
  lookAt: [0, 28, 0],
  portableGroundY: F - 0.18,
  sunDirection: [10, 16, 7],
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  embeddedCanonicalGraphs: ['stone_limestone', 'metal_painted', 'metal_bronze_cast'],
  qaCameras: [
    {
      name: 'whole-rear-wings-native-podium-and-roof-lanterns',
      position: [-175, 112, -160],
      lookAt: [0, 25, 0],
    },
    {
      name: 'six-ionic-columns-three-bronze-doors-oculi-and-stairs',
      position: [95, 23, 10],
      lookAt: [28, 17, 0],
    },
    {
      name: 'columned-drum-ribbed-stone-dome-open-lantern-and-gold-finial',
      position: [78, 61, 60],
      lookAt: [-1, 46, 0],
    },
    {
      name: 'wing-window-reveals-ionic-capitals-and-roof-balustrade',
      position: [78, 27, -45],
      lookAt: [25, 18, -42],
    },
    {
      name: 'whole-native-podium-dimensional-body-and-roof-plan',
      position: [1, 250, 3],
      lookAt: [0, 20, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/arkansas-state-capitol-runtime-overlay.mjs',
    level: 'skyline',
    export: 'arkansasCapitolSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'arkansasCapitolDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'arkansasCapitolStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'arkansasCapitolCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Two exactpublished2021Dsduganown/selfCC0 front originals only. Conflictedhero/oldproposal/MontanaCapitol/assumedauthor/archivalunboundphotos excluded, no supplemental/source repair/reclassification/guardchange. OfficialSecretaryofState dimensions and limestone/goldcupolafinish used asfacts only, no officialbook imagery. Larger nativeenvelope retained as lowpodium around officialdimension mainbody; podiumextent and surveyed mapfit unresolved. Hiddenrear/roof/roomplan/windowcensus/domecentre/capitalprofiles/currentfinefinish are original estimates; no copied glassart/sculpture/crests/inscriptions/flags/lamps/grounds/interior/sourcepixels.',
    'Original600m129x12916641sample field/one rawtile/fixedSW101.7668m providerrelative datum frozen before floors/sections/geometry. No terrainfit/flatten/reacquire/modelraising. Exactthreshold/footing/entrancestreet contact unresolved; geographicpreview/replaceFootprint=false. Flatground/syntheticneighbors are fixtures only.',
  ],
};
