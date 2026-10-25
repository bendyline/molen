/** Whole four-court palace with its native axial entrance passages. Original medium-fi exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/66/66j/la_moneda_palace/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  c = Math.cos(A.workingHeading),
  s = Math.sin(A.workingHeading),
  local = (q) => [c * q[0] - s * q[1], s * q[0] + c * q[1]],
  world = (q) => [c * q[0] + s * q[2], q[1], -s * q[0] + c * q[2]],
  ring = (P) =>
    Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-6 ? P.slice(0, -1) : P,
  outer = ring(p.outline).map(local),
  holes = p.holes.map((P) => ring(P).map(local)),
  C = {
    wall: rgb('d9d6c9'),
    trim: rgb('e4e1d5'),
    roof: rgb('8b6e5b'),
    base: rgb('acaaa0'),
    glass: rgb('526775'),
    door: rgb('444e50'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'stucco', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.96, metallic: 0 },
    base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.4, metallic: 0.14 },
    door: { slot: 'door', graph: 'metal_painted', roughness: 0.87, metallic: 0.2 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]];
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((sum, v, k) => sum + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function small(P, tol) {
  if (!tol) return P;
  const dist = (q, a, b) => {
      const v = sub(b, a),
        L = v[0] * v[0] + v[1] * v[1],
        t = Math.max(0, Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / L));
      return Math.hypot(q[0] - a[0] - v[0] * t, q[1] - a[1] - v[1] * t);
    },
    rdp = (P) => {
      if (P.length <= 2) return P;
      let best = 0,
        k = 0;
      for (let i = 1; i < P.length - 1; i++) {
        const v = dist(P[i], P[0], P.at(-1));
        if (v > best) {
          best = v;
          k = i;
        }
      }
      return best > tol
        ? [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp(P.slice(k))]
        : [P[0], P.at(-1)];
    };
  let k = 1;
  for (let i = 2; i < P.length; i++)
    if (Math.hypot(...sub(P[i], P[0])) > Math.hypot(...sub(P[k], P[0]))) k = i;
  return [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp([...P.slice(k), P[0]]).slice(0, -1)];
}
function faces(P, inside = false) {
  P = ring(P);
  const area = P.reduce(
    (s, v, k) => s + v[0] * P[(k + 1) % P.length][1] - P[(k + 1) % P.length][0] * v[1],
    0,
  );
  if (area < 0) P = P.toReversed();
  return P.map((a, k) => {
    const b = P[(k + 1) % P.length],
      v = sub(b, a),
      w = Math.hypot(...v),
      u = v.map((x) => x / w),
      n = [u[1], 0, -u[0]].map((x) => x * (inside ? -1 : 1));
    return { a, b, w, u, n };
  }).filter((f) => f.w > 0.005);
}
const pt = (f, x, y, depth = 0) => [
  f.a[0] + x * f.u[0] + depth * f.n[0],
  y,
  f.a[1] + x * f.u[1] + depth * f.n[2],
];
function patch(o, k, f, x0, x1, y0, y1, off = 0) {
  Q(
    o,
    k,
    [
      pt(f, x0, typeof y0 === 'function' ? y0(x0) : y0, off),
      pt(f, x1, typeof y0 === 'function' ? y0(x1) : y0, off),
      pt(f, x1, typeof y1 === 'function' ? y1(x1) : y1, off),
      pt(f, x0, typeof y1 === 'function' ? y1(x0) : y1, off),
    ],
    f.n,
  );
}
function flat(o, k, P, y, col = C[k], down = false) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [P[j][0], typeof y === 'function' ? y(...P[j]) : y, P[j][1]]),
      [0, down ? -1 : 1, 0],
      col,
    );
}
function prism(o, k, P, y0, y1, col = C[k]) {
  for (const f of faces(P))
    Q(o, k, [pt(f, 0, y0), pt(f, f.w, y0), pt(f, f.w, y1), pt(f, 0, y1)], f.n, col);
  flat(o, k, P, y1, col);
  flat(o, k, P, y0, col, true);
}
function box(o, k, x, y, z, w, h, l, col = C[k]) {
  prism(
    o,
    k,
    [
      [x - w / 2, z - l / 2],
      [x + w / 2, z - l / 2],
      [x + w / 2, z + l / 2],
      [x - w / 2, z + l / 2],
    ],
    y,
    y + h,
    col,
  );
}
function domain(P, H) {
  const points = [...P, ...H.flat()],
    starts = [];
  let n = P.length;
  for (const h of H) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(points.flat(), starts);
  return Array.from({ length: ids.length / 3 }, (_, i) =>
    ids.slice(i * 3, i * 3 + 3).map((j) => points[j]),
  );
}
function surface(o, k, triangles, Y, depth = 0) {
  const divide = (P, n) => {
    if (n === 0) {
      T(
        o,
        k,
        P.map((q) => [q[0], typeof Y === 'function' ? Y(...q) : Y, q[1]]),
        [0, 1, 0],
      );
      return;
    }
    const [a, b, c] = P,
      mid = (a, b) => a.map((v, k) => (v + b[k]) / 2),
      ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    for (const q of [
      [a, ab, ca],
      [ab, b, bc],
      [ca, bc, c],
      [ab, bc, ca],
    ])
      divide(q, n - 1);
  };
  for (const t of triangles) divide(t, depth);
}
function distance(q, P) {
  return Math.min(
    ...P.map((a, k) => {
      const b = P[(k + 1) % P.length],
        v = sub(b, a),
        t = Math.max(
          0,
          Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
        );
      return Math.hypot(q[0] - a[0] - v[0] * t, q[1] - a[1] - v[1] * t);
    }),
  );
}
function portalFor(f, d) {
  if (Math.abs(f.n[2]) < 0.9) return [];
  return A.doors.flatMap((door) => {
    const q = door.local,
      x = (q[0] - f.a[0]) * f.u[0] + (q[1] - f.a[1]) * f.u[1],
      normal = (q[0] - f.a[0]) * f.n[0] + (q[1] - f.a[1]) * f.n[2];
    const r = A.portalWidth / 2;
    // A mapped entrance can lie on a native wall vertex: cut its arch in both adjacent faces.
    if (x < -r || x > f.w + r || Math.abs(normal) > (d === 0 ? 1.4 : 0.4)) return [];
    return [
      {
        x0: Math.max(0, x - r),
        x1: Math.min(f.w, x + r),
        y0: A.baseY - 0.1,
        top: (u) =>
          F +
          A.portalSpring +
          A.portalRise * Math.sqrt(Math.max(0, 1 - ((u - x) / r) * ((u - x) / r))),
        center: x,
        portal: true,
      },
    ];
  });
}
function wallWithHoles(o, k, f, bottom, top, H, d, off = 0) {
  const xs = [0, f.w, ...H.flatMap((h) => [h.x0, h.x1])];
  for (const h of H.filter((h) => h.portal))
    for (let i = 1; i < [4, 6, 10, 16][d]; i++)
      xs.push(h.x0 + ((h.x1 - h.x0) * i) / [4, 6, 10, 16][d]);
  const X = [...new Set(xs)].sort((a, b) => a - b);
  for (let i = 0; i < X.length - 1; i++) {
    const a = X[i],
      b = X[i + 1],
      mid = (a + b) / 2,
      hs = H.filter((h) => mid > h.x0 - 1e-7 && mid < h.x1 + 1e-7).toSorted((a, b) => a.y0 - b.y0);
    let lo = bottom;
    for (const h of hs) {
      const lowAtMid = typeof lo === 'function' ? lo(mid) : lo;
      if (h.y0 > lowAtMid && lowAtMid < top) patch(o, k, f, a, b, lo, Math.min(top, h.y0), off);
      lo = h.top;
      if ((typeof lo === 'function' ? lo(mid) : lo) >= top) break;
    }
    if (typeof lo === 'function') {
      if (lo(mid) < top) patch(o, k, f, a, b, lo, top, off);
    } else if (lo < top) patch(o, k, f, a, b, lo, top, off);
  }
}
function window(o, f, h, d, guard) {
  const a = h.x0,
    b = h.x1,
    y = h.y0,
    top = h.top,
    depth = d > 1 ? -A.reveal : 0.025;
  patch(o, 'glass', f, a, b, y, top, depth);
  if (d < 2) return;
  Q(
    o,
    'trim',
    [pt(f, a, y), pt(f, a, y, depth), pt(f, a, top, depth), pt(f, a, top)],
    [f.u[0], 0, f.u[1]],
  );
  Q(
    o,
    'trim',
    [pt(f, b, y), pt(f, b, top), pt(f, b, top, depth), pt(f, b, y, depth)],
    [-f.u[0], 0, -f.u[1]],
  );
  Q(o, 'trim', [pt(f, a, y), pt(f, b, y), pt(f, b, y, depth), pt(f, a, y, depth)], [0, 1, 0]);
  Q(
    o,
    'trim',
    [pt(f, a, top), pt(f, a, top, depth), pt(f, b, top, depth), pt(f, b, top)],
    [0, -1, 0],
  );
  patch(o, 'trim', f, a - 0.12, b + 0.12, top, top + 0.14, 0.05);
  if (d === 3) {
    patch(o, 'trim', f, (a + b) / 2 - 0.035, (a + b) / 2 + 0.035, y, top, depth + 0.04);
    patch(o, 'trim', f, a, b, (y + top) / 2 - 0.035, (y + top) / 2 + 0.035, depth + 0.04);
    patch(o, 'trim', f, a - 0.1, a, y, top, 0.025);
    patch(o, 'trim', f, b, b + 0.1, y, top, 0.025);
    if (guard) {
      patch(o, 'door', f, a - 0.12, b + 0.12, y + 0.6, y + 0.68, 0.22);
      for (let j = 0; j < 5; j++) {
        const x = a + ((b - a) * j) / 4;
        patch(o, 'door', f, x - 0.025, x + 0.025, y, y + 0.65, 0.2);
      }
    }
  }
}
function facades(o, P, H, d) {
  for (const [shape, inside] of [[P, false], ...H.map((h) => [h, true])])
    for (const f of faces(shape, inside)) {
      const portals = portalFor(f, d),
        wins = [],
        south = !inside && f.n[2] > 0.9,
        rows = south ? A.southRows : A.northRows;
      if (d > 0 && f.w > 2.5) {
        const count = Math.max(1, Math.round(f.w / (inside ? 5.5 : south ? 6.0 : 6.8)));
        for (const [y0, y1] of rows)
          for (let i = 0; i < count; i++) {
            const u = (f.w * (i + 0.5)) / count,
              w = Math.min(A.windowWidth, (f.w / count) * 0.5);
            if (portals.some((h) => y0 < 5 && u + w / 2 > h.x0 - 0.25 && u - w / 2 < h.x1 + 0.25))
              continue;
            wins.push({ x0: u - w / 2, x1: u + w / 2, y0: F + y0, top: F + y1 });
          }
      }
      wallWithHoles(o, 'wall', f, A.baseY, A.bodyTop, [...portals, ...(d > 1 ? wins : [])], d);
      if (d > 0) wallWithHoles(o, 'base', f, A.baseY, F + 0.65, portals, d, 0.025);
      for (const h of wins) window(o, f, h, d, !inside && f.n[2] < -0.9 && h.y0 > 6);
      if (d > 0) {
        patch(o, 'trim', f, 0, f.w, 5.7, 5.9, 0.055);
        patch(o, 'trim', f, 0, f.w, A.bodyTop - 0.3, A.bodyTop, 0.09);
      }
      // Native narrow projecting pier faces carry paired giant pilaster shafts.
      if (d > 1 && !inside && f.w > 1.5 && f.w < 2.5) {
        for (const u of [f.w * 0.24, f.w * 0.76]) {
          patch(o, 'trim', f, u - 0.18, u + 0.18, F + 0.7, A.bodyTop - 0.55, 0.14);
          patch(o, 'trim', f, u - 0.27, u + 0.27, F + 0.6, F + 0.85, 0.18);
          patch(o, 'trim', f, u - 0.28, u + 0.28, A.bodyTop - 0.65, A.bodyTop - 0.4, 0.18);
        }
      }
    }
}
function rails(o, P, d) {
  const R = small(P, d === 3 ? 0.8 : 1.2);
  for (const f of faces(R)) {
    const y = A.corniceTop;
    patch(o, 'trim', f, 0, f.w, A.bodyTop - 0.05, y, 0.15);
    if (d > 1) {
      patch(o, 'trim', f, 0, f.w, A.bodyTop - 0.25, A.bodyTop - 0.05, 0.24);
      patch(o, 'trim', f, 0, f.w, y - 0.15, y + 0.05, 0.25);
    }
    const strip = (bottom, top, depth) => {
      const a = pt(f, 0, bottom, -0.12),
        b = pt(f, f.w, bottom, -0.12),
        c = pt(f, f.w, bottom, depth),
        e = pt(f, 0, bottom, depth),
        R = [
          [a[0], a[2]],
          [b[0], b[2]],
          [c[0], c[2]],
          [e[0], e[2]],
        ];
      prism(o, 'trim', R, bottom, top);
    };
    strip(y + 0.08, y + 0.26, 0.25);
    strip(A.balustradeTop - 0.16, A.balustradeTop, 0.25);
    const pitch = [1000, 5.6, 1.65, A.balusterPitch][d],
      N = Math.max(1, Math.floor(f.w / pitch));
    for (let i = 0; i <= N; i++) {
      const u = (f.w * i) / N,
        x = pt(f, u, y + 0.26, 0.05);
      if (d < 3)
        box(
          o,
          'trim',
          x[0],
          y + 0.26,
          x[2],
          d === 0 ? 0.7 : 0.21,
          A.balustradeTop - y - 0.42,
          0.24,
        );
      else spindle(o, [x[0], x[2]], y + 0.26, A.balustradeTop - y - 0.42, 6);
    }
    const urnPitch = [1000, 26, 13.5, 6.8][d],
      U = Math.max(1, Math.round(f.w / urnPitch));
    if (Math.abs(f.n[2]) > 0.9 || d === 3)
      for (let i = 0; i <= U; i++) {
        const u = (f.w * i) / U,
          x = pt(f, u, A.balustradeTop, 0.02);
        urn(o, [x[0], x[2]], A.balustradeTop, d);
      }
  }
}
function spindle(o, c, y, h, n) {
  const profile = [
      [0.13, 0],
      [0.1, 0.12],
      [0.19, 0.42],
      [0.12, 0.67],
      [0.08, 0.89],
      [0.13, 1],
    ],
    P = profile.map(([r, t]) =>
      Array.from({ length: n }, (_, i) => [
        c[0] + r * Math.cos((2 * Math.PI * i) / n),
        y + h * t,
        c[1] + r * Math.sin((2 * Math.PI * i) / n),
      ]),
    );
  for (let k = 0; k < P.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(
        o,
        'trim',
        [P[k][i], P[k][j], P[k + 1][j], P[k + 1][i]],
        [P[k][i][0] - c[0], 0, P[k][i][2] - c[1]],
      );
    }
  flat(
    o,
    'trim',
    P.at(-1).map((v) => [v[0], v[2]]),
    y + h,
  );
}
function urn(o, c, y, d) {
  const n = [4, 4, 6, 8][d],
    profile =
      d < 2
        ? [
            [0.25, 0],
            [0.3, 0.45],
            [0.07, 1.1],
          ]
        : [
            [0.3, 0],
            [0.25, 0.2],
            [0.18, 0.35],
            [0.34, 0.7],
            [0.24, 0.95],
            [0.15, 1.1],
            [0.05, 1.25],
          ],
    rings = profile.map(([r, h]) =>
      Array.from({ length: n }, (_, i) => [
        c[0] + r * Math.cos((2 * Math.PI * i) / n),
        y + h,
        c[1] + r * Math.sin((2 * Math.PI * i) / n),
      ]),
    );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      Q(
        o,
        'trim',
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [rings[k][i][0] - c[0], 0, rings[k][i][2] - c[1]],
      );
    }
  flat(
    o,
    'trim',
    rings.at(-1).map((v) => [v[0], v[2]]),
    y + profile.at(-1)[1],
  );
}
function tunnels(o, d) {
  for (const [ia, ib] of A.tunnelPairs) {
    const a = A.doors[ia].local,
      b = A.doors[ib].local,
      x = (a[0] + b[0]) / 2,
      z0 = Math.min(a[1], b[1]) - 0.04,
      z1 = Math.max(a[1], b[1]) + 0.04,
      r = A.portalWidth / 2,
      cy = F + A.portalSpring,
      N = [4, 6, 10, 16][d];
    for (const side of [-1, 1])
      Q(
        o,
        'wall',
        [
          [x + side * r, F, z0],
          [x + side * r, F, z1],
          [x + side * r, cy, z1],
          [x + side * r, cy, z0],
        ],
        [-side, 0, 0],
      );
    for (let i = 0; i < N; i++) {
      const aa = (Math.PI * i) / N,
        bb = (Math.PI * (i + 1)) / N,
        q = (t) => [x + r * Math.cos(t), cy + A.portalRise * Math.sin(t)],
        u = q(aa),
        v = q(bb);
      Q(
        o,
        'trim',
        [
          [u[0], u[1], z0],
          [u[0], u[1], z1],
          [v[0], v[1], z1],
          [v[0], v[1], z0],
        ],
        [-Math.cos((aa + bb) / 2), -Math.sin((aa + bb) / 2), 0],
      );
    }
  }
}
function build(o, _f, d = 3) {
  const tol = [1.5, 0.65, 0.08, 0][d],
    P = small(outer, tol),
    H = holes.map((h) => small(h, tol)),
    D = domain(P, H),
    Y = (x, z) =>
      A.roofEaves +
      Math.min(A.roofRise, A.roofSlope * Math.min(...[P, ...H].map((R) => distance([x, z], R))));
  facades(o, P, H, d);
  surface(o, 'roof', D, Y, Math.max(0, d - 1));
  surface(o, 'base', D, F - 0.08);
  for (const h of H) flat(o, 'base', h, A.courtyardFloorY);
  rails(o, outer, d);
  tunnels(o, d);
}
export const monedaSkyline = (o, f) => build(o, f, 0),
  monedaDistrict = (o, f) => build(o, f, 1),
  monedaStreet = (o, f) => build(o, f, 2),
  monedaCloseup = (o, f) => build(o, f, 3);
const camera = (name, pos, look) => ({ name, position: world(pos), lookAt: world(look) });
export const laMonedaPalaceModel = {
  id: 'la_moneda_palace',
  key: 'la_moneda_palace',
  cell: '66/66j',
  recipe: 'structure-la-moneda-palace.mjs',
  title: 'La Moneda Palace',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([160, 105, -185]),
  lookAt: world([0, 7, 0]),
  portableGroundY: -0.24,
  mediumFiContext: { scale: 1.3, groundY: -0.1 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera(
      'whole-palace-north-front-pierced-parapets-and-all-four-courts',
      [160, 105, -185],
      [0, 7, 0],
    ),
    camera('opposite-south-three-storey-front-and-native-side-wings', [-160, 85, 180], [0, 7, 0]),
    camera(
      'north-front-tall-two-storey-pilasters-windows-and-open-main-portal',
      [6, 9, -125],
      [0, 7, -54],
    ),
    camera('south-front-three-window-storeys-and-covered-exit', [10, 10, 125], [0, 7, 55]),
    camera(
      'whole-large-courtyard-and-both-intrinsic-north-projecting-wing-masses',
      [66, 60, 90],
      [0, 3, 18],
    ),
    camera('central-court-and-both-smaller-side-courtyard-voids', [-70, 75, -60], [0, 5, -25]),
    camera('covered-main-axis-passage-under-genuine-vault', [0, 1.8, -65], [0, 2.1, -30]),
    camera('east-native-wall-setbacks-and-pilaster-capital-details', [95, 15, -16], [45, 8, -15]),
    camera('pierced-roof-balusters-original-vases-and-low-roofs', [16, 24, -70], [0, 13, -52]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-la-moneda-palace.mjs',
    level: 'skyline',
    export: 'monedaSkyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'monedaDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'monedaStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'monedaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole surviving palace uses actual207-unique-vertex outer native envelope/four true open inner courts, all exterior/court wings, two-storey north and three-storey south rhythm, repeated native pilaster projections/belts/cornice/pierced roof balustrade/original vase finials and three covered axial passages from six actual entrance nodes. No facade-only or closed full-block substitute.',
    'Exact640x480 cleared Qualla TomasVivanco2007 own/PD-self facade original individually inspected/nativeSHA1matched; primary government/2022 original architectural study text only. No attribution-only/uncertain imagery, protected figure/plan/photo-gallery pixels, generated bitmap/borrowed mesh or licensing-policy changes. Foreground event and neighboring buildings excluded.',
    'Body/cornice/parapet/finial sections, low hidden hipped roof ridges/materials, facade window/rail/vase census, courtyard-side details and portal/vault widths/heights are bounded original medium-fi estimates. Current hidden maintenance details/precise private rooms/structural survey not claimed. Actual native door positions and four courtyard voids retained; no public-gallery/room interior reconstruction.',
    'Original400m/16641-value independent urban field/two raw tiles/PNG frozen before floor/geometry, unchanged. Floor+.05 independent; building/urban source artifacts may disagree with threshold/court/foundation levels. Default isolated/shared-flat appearance and separate unchanged source-field evidence; exact host contact unverified/replacementfalse. No terrain fitting/flattening/reacquisition, full-plaza floor, independent monuments/61mflagpole/underground cultural center/city/trees/events/people/text.',
  ],
};
