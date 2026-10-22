/** Atsuta Hongu: four whole native physical plans and intrinsic wooden palisades. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, tube } from './structure-mesh.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xn1/atsuta_shrine/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wood: rgb('a18a6c'),
    dark: rgb('584635'),
    roof: rgb('626970'),
    gold: rgb('c4ae64'),
    stone: rgb('a8a499'),
  },
  surfaces = {
    wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
    dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', localRef: 'palette:#fefefe', roughness: 0.71, metallic: 0.3 },
    gold: { slot: 'trim', localRef: 'palette:#fffeff', roughness: 0.51, metallic: 0.64 },
    stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  };
const area = (r) =>
    r.reduce((s, a, i) => s + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
function T(o, s, q, n, col = C[s]) {
  q = q.map((a) => a.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) q = [q[0], q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.6 ? [v[0], v[2]] : Math.abs(N[0]) > 0.6 ? [v[2], v[1]] : [v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function B(o, s, x, y, z, w, h, l, col = C[s]) {
  box(o, s, [x - w / 2, y, z - l / 2], [x + w / 2, y + h, z + l / 2], col);
}
function flat(o, s, a, b, w, u, col) {
  const q = [
    a.map((v, k) => v - (u[k] * w) / 2),
    a.map((v, k) => v + (u[k] * w) / 2),
    b.map((v, k) => v + (u[k] * w) / 2),
    b.map((v, k) => v - (u[k] * w) / 2),
  ];
  Q(o, s, q, null, col);
  Q(o, s, [...q].reverse(), null, col);
}
function board(o, s, q, u, n, w, t, y0, y1, col) {
  const r = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([a, b]) => [
    q[0] + (u[0] * w * a) / 2 + (n[0] * t * b) / 2,
    q[1] + (u[1] * w * a) / 2 + (n[2] * t * b) / 2,
  ]);
  prism(o, s, r, y0, y1, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  if (r.length < 3) return;
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], typeof y === 'function' ? y(r[k]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, r, lo, hi, col = C[s]) {
  if (r.length < 3 || Math.abs(area(r)) < 0.001) return;
  cap(o, s, r, hi, true, col);
  const sg = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
      col,
    );
  }
}
function cut(r, k, value, greater) {
  const result = [],
    ok = (a) => (greater ? a[k] >= value : a[k] <= value);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (ok(a)) result.push(a);
    if (ok(a) !== ok(b)) result.push(mix(a, b, (value - a[k]) / (b[k] - a[k])));
  }
  return result.filter(
    (a, i) => !i || Math.hypot(a[0] - result[i - 1][0], a[1] - result[i - 1][1]) > 1e-6,
  );
}
function bounded(r, x0, x1, z0 = -Infinity, z1 = Infinity) {
  for (const [k, v, g] of [
    [0, x0, true],
    [0, x1, false],
    [1, z0, true],
    [1, z1, false],
  ])
    if (Number.isFinite(v)) r = cut(r, k, v, g);
  return r;
}
function bounds(r) {
  return [0, 1].map((k) => [Math.min(...r.map((a) => a[k])), Math.max(...r.map((a) => a[k]))]);
}
function shrink(r, n) {
  const c = r.reduce((a, b) => [a[0] + b[0] / r.length, a[1] + b[1] / r.length], [0, 0]);
  return r.map((a) => mix(c, a, n));
}
// All roof partition lines/heights below are explicit photo estimates within unchanged native plans.
function gable(o, r, eave, ridge, axis, d, { open = false, ornament = false } = {}) {
  if (r.length < 3 || Math.abs(area(r)) < 0.01) return;
  const bb = bounds(r),
    crossAxis = 1 - axis,
    mid = (bb[crossAxis][0] + bb[crossAxis][1]) / 2,
    half = (bb[crossAxis][1] - bb[crossAxis][0]) / 2,
    Y = (q) => eave + (ridge - eave) * (1 - Math.min(1, Math.abs(q[crossAxis] - mid) / half)),
    V = (u, v, y) => (axis === 0 ? [u, y, v] : [v, y, u]);
  for (const halfRing of [cut(r, crossAxis, mid, false), cut(r, crossAxis, mid, true)]) {
    cap(o, 'roof', halfRing, Y);
    cap(o, 'dark', halfRing, (q) => Y(q) - 0.16, false);
  }
  const sg = Math.sign(area(r));
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])];
    Q(
      o,
      'dark',
      [
        [a[0], Y(a) - 0.16, a[1]],
        [b[0], Y(b) - 0.16, b[1]],
        [b[0], Y(b), b[1]],
        [a[0], Y(a), a[1]],
      ],
      n,
    );
    if (!open)
      Q(
        o,
        'wood',
        [
          [a[0], eave, a[1]],
          [b[0], eave, b[1]],
          [b[0], Y(b) - 0.17, b[1]],
          [a[0], Y(a) - 0.17, a[1]],
        ],
        n,
      );
    if (d > 1)
      beam(o, 'wood', [a[0], Y(a) - 0.26, a[1]], [b[0], Y(b) - 0.26, b[1]], 0.2, 0.24, C.dark);
  }
  const lo = bb[axis][0],
    hi = bb[axis][1],
    length = hi - lo;
  if (!open) {
    const body = shrink(r, 0.88);
    prism(o, 'wood', body, 0.32, eave);
    if (d > 1) {
      for (let i = 0; i < body.length; i++) {
        const a = body[i],
          b = body[(i + 1) % body.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = [(sg * (b[1] - a[1])) / len, (sg * (a[0] - b[0])) / len],
          count = Math.max(1, Math.round(len / [1, 1, 1.45, 0.42][d]));
        for (let k = 0; k < count; k++) {
          const q = mix(a, b, (k + 0.5) / count);
          beam(
            o,
            'wood',
            [q[0] + n[0] * 0.025, 0.4, q[1] + n[1] * 0.025],
            [q[0] + n[0] * 0.025, eave - 0.1, q[1] + n[1] * 0.025],
            0.045,
            0.045,
            C.dark,
          );
        }
      }
    }
  } else {
    const rr = shrink(r, 0.88),
      n = [4, 4, 6, 8][d];
    for (let i = 0; i < n; i++) {
      const q = rr[Math.floor((i * rr.length) / n) % rr.length];
      if (d > 0)
        tube(o, 'wood', [q[0], 0.18, q[1]], [q[0], eave, q[1]], 0.22, C.wood, [4, 4, 10, 14][d]);
      else {
        flat(o, 'wood', [q[0], 0.18, q[1]], [q[0], eave, q[1]], 0.38, [1, 0, 0], C.wood);
        flat(o, 'wood', [q[0], 0.18, q[1]], [q[0], eave, q[1]], 0.38, [0, 0, 1], C.wood);
      }
      if (d > 1) B(o, 'stone', q[0], 0.02, q[1], 0.62, 0.16, 0.62);
    }
    if (d)
      for (const u of [lo + 0.65, hi - 0.65]) {
        beam(
          o,
          'wood',
          V(u, bb[crossAxis][0] + 0.5, eave - 0.55),
          V(u, bb[crossAxis][1] - 0.5, eave - 0.55),
          0.34,
          0.34,
          C.dark,
        );
        beam(
          o,
          'wood',
          V(u, bb[crossAxis][0] + 0.7, eave - 0.45),
          V(u, mid, ridge - 0.35),
          0.17,
          0.17,
          C.wood,
        );
        beam(
          o,
          'wood',
          V(u, mid, ridge - 0.35),
          V(u, bb[crossAxis][1] - 0.7, eave - 0.45),
          0.17,
          0.17,
          C.wood,
        );
      }
  }
  if (d)
    beam(
      o,
      'dark',
      V(lo - 0.45, mid, ridge + 0.06),
      V(hi + 0.45, mid, ridge + 0.06),
      0.24,
      0.28,
      C.dark,
    );
  if (d > 1) {
    const count = Math.max(2, Math.floor(length / [1, 1, 2.3, 0.72][d]));
    for (let i = 0; i <= count; i++) {
      const u = lo + (length * i) / count;
      for (const side of [-1, 1])
        beam(
          o,
          'wood',
          V(u, mid, ridge - 0.26),
          V(u, mid + side * half, eave - 0.26),
          0.085,
          0.085,
          C.wood,
        );
    }
  }
  if (d > 2) {
    const n = Math.max(1, Math.floor((ridge - eave) / 0.25));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      for (const side of [-1, 1]) {
        const v = mid + side * half * t;
        beam(
          o,
          'roof',
          V(lo + 0.03, v, Y(axis === 0 ? [0, v] : [v, 0]) + 0.015),
          V(hi - 0.03, v, Y(axis === 0 ? [0, v] : [v, 0]) + 0.015),
          0.012,
          0.012,
          rgb('747a7c'),
        );
      }
    }
  }
  if (ornament) {
    const sideCount = [4, 6, 10, 16][d],
      count = [2, 2, 6, 8][d];
    for (let i = 0; i < count; i++) {
      const u = lo + (length * (i + 0.5)) / count,
        a = V(u, mid - 0.83, ridge + 0.33),
        b = V(u, mid + 0.83, ridge + 0.33);
      tube(o, 'dark', a, b, 0.2, C.dark, sideCount);
      if (d) {
        tube(o, 'gold', a, V(u, mid - 0.79, ridge + 0.33), 0.205, C.gold, sideCount);
        tube(o, 'gold', V(u, mid + 0.79, ridge + 0.33), b, 0.205, C.gold, sideCount);
      } else {
        const vv = V(u, mid + 0.84, ridge + 0.33);
        flat(
          o,
          'gold',
          [vv[0], vv[1] - 0.12, vv[2]],
          [vv[0], vv[1] + 0.12, vv[2]],
          0.27,
          [1, 0, 0],
          C.gold,
        );
      }
    }
    for (const u of [lo + 0.2, hi - 0.2])
      for (const side of [-1, 1]) {
        const a = V(u, mid - side * 0.27, ridge - 0.35),
          b = V(u, mid + side * 1.3, ridge + 2.65);
        if (d) beam(o, 'dark', a, b, 0.16, 0.22, C.dark);
        else flat(o, 'dark', a, b, 0.22, axis === 0 ? [1, 0, 0] : [0, 0, 1], C.dark);
        const end = mix(a, b, 0.91);
        if (d) beam(o, 'gold', end, b, 0.17, 0.23, C.gold);
        if (d > 2)
          for (const t of [0.35, 0.55, 0.75]) {
            const q = mix(a, b, t);
            B(o, 'gold', q[0], q[1], q[2], 0.19, 0.07, 0.08);
          }
      }
  }
}
function main(o, d) {
  const r = p.parts[0].outline;
  prism(o, 'stone', r, -0.12, 0.28);
  const x0 = -9.055,
    x1 = 8.85,
    z1 = 3.38;
  gable(o, bounded(r, -Infinity, x0), 3, 6.7, 0, d, { ornament: d > 2 });
  gable(o, bounded(r, x1, Infinity), 3, 6.7, 0, d, { ornament: d > 2 });
  gable(o, bounded(r, x0, x1, -Infinity, z1), 4.5, 10.2, 0, d, { ornament: true });
  gable(o, bounded(r, x0, x1, z1, Infinity), 3.2, 6.3, 1, d);
  // Simple closed timber pair on the small southern projecting hall; no sacred interior or crest art.
  if (d) {
    const z = Math.max(...r.map((a) => a[1]));
    for (const x of [-0.95, 0.65]) B(o, 'dark', x, 0.45, z - 0.42, 1.52, 2.2, 0.13);
    if (d > 1)
      for (const x of [-1.45, -0.45, 0.15, 1.15]) B(o, 'gold', x, 1.5, z - 0.5, 0.06, 0.08, 0.035);
  }
}
function gates(o, d) {
  for (const [i, eave, ridge] of [
    [1, 3, 7.2],
    [2, 3.4, 8.4],
  ]) {
    const r = p.parts[i].outline;
    prism(o, 'stone', r, -0.12, 0.14);
    gable(o, r, eave, ridge, 0, d, { open: true, ornament: true });
    if (d > 1) {
      const bb = bounds(r),
        z = bb[1][1] - 0.5;
      for (const side of [-1, 1]) {
        const x = side < 0 ? bb[0][0] + 0.7 : bb[0][1] - 0.7;
        B(o, 'dark', x, 0.22, z, 1.2, 2.3, 0.14);
        for (const y of [0.8, 1.8]) B(o, 'gold', x, y, z + 0.085, 0.07, 0.08, 0.04);
      }
    }
  }
}
function worship(o, d) {
  const r = p.parts[3].outline;
  prism(o, 'stone', r, -0.12, 0.14);
  const L = -9.45,
    R = 6.98;
  gable(o, bounded(r, L, R), 4.2, 9.5, 1, d, { open: true });
  gable(o, bounded(r, -Infinity, L), 2.8, 4.8, 0, d, { open: true });
  gable(o, bounded(r, R, Infinity), 2.8, 4.8, 0, d, { open: true });
  const bb = bounds(r),
    front = bb[1][1];
  if (d)
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? bb[0][0] : 3,
        x1 = side < 0 ? -3 : bb[0][1];
      beam(o, 'wood', [x0, 1.15, front - 0.25], [x1, 1.15, front - 0.25], 0.12, 0.12, C.wood);
      const n = Math.max(1, Math.floor((x1 - x0) / [1, 2, 0.7, 0.35][d]));
      for (let i = 0; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n;
        B(o, 'wood', x, 0.2, front - 0.25, 0.1, 1.45, 0.12);
      }
    }
  // Intrinsic central threshold and compact approach steps only, no precinct or yard floor.
  const steps = [1, 3, 5, 6][d];
  for (let i = 0; i < steps; i++)
    B(
      o,
      'stone',
      (L + R) / 2,
      -0.12,
      front + 0.12 + (steps - i) * 0.19,
      6,
      0.12 + ((i + 1) * 0.14) / steps,
      0.21,
    );
}
function fences(o, d) {
  for (const f of p.fences) {
    for (let i = 1; i < f.points.length; i++) {
      const a = f.points[i - 1],
        b = f.points[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        outer = f.id === 'way/57016853',
        h = outer ? 2.5 : 2.25,
        n = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len];
      if (d < 2) {
        Q(
          o,
          'dark',
          [
            [a[0], 0.08, a[1]],
            [b[0], 0.08, b[1]],
            [b[0], h, b[1]],
            [a[0], h, a[1]],
          ],
          n,
        );
        Q(
          o,
          'dark',
          [
            [a[0], 0.08, a[1]],
            [b[0], 0.08, b[1]],
            [b[0], h, b[1]],
            [a[0], h, a[1]],
          ],
          n.map((v) => -v),
        );
        if (d) {
          const c = Math.max(1, Math.round(len / 8));
          for (let k = 0; k <= c; k++) {
            const q = mix(a, b, k / c);
            B(o, 'wood', q[0], 0.02, q[1], 0.16, h + 0.05, 0.16);
          }
        }
        continue;
      }
      for (const y of [0.3, h - 0.3])
        beam(o, 'wood', [a[0], y, a[1]], [b[0], y, b[1]], 0.09, 0.09, C.dark);
      const spacing = [1, 2.9, 1.1, 0.29][d],
        count = Math.max(1, Math.ceil(len / spacing)),
        width = (len / count) * [0, 0.82, 0.72, 0.62][d];
      for (let k = 0; k <= count; k++) {
        const q = mix(a, b, k / count),
          u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
        board(o, 'wood', q, u, n, width, 0.1, 0.04, h, C.wood);
        if (d > 2 && k % 12 === 0)
          beam(
            o,
            'dark',
            [q[0] + n[0] * 0.12, 0.02, q[1] + n[2] * 0.12],
            [q[0] + n[0] * 0.12, h + 0.15, q[1] + n[2] * 0.12],
            0.19,
            0.19,
            C.dark,
          );
        if (!u.every(Number.isFinite)) throw Error('Invalid native fence');
      }
    }
  }
}
function build(o, _f, d = 3) {
  main(o, d);
  gates(o, d);
  worship(o, d);
  fences(o, d);
}
export const atsutaShrineSkyline = (o, f) => build(o, f, 0),
  atsutaShrineDistrict = (o, f) => build(o, f, 1),
  atsutaShrineStreet = (o, f) => build(o, f, 2),
  atsutaShrineCloseup = (o, f) => build(o, f, 3);
export const atsutaShrineModel = {
  id: 'atsuta_shrine',
  key: 'atsuta_shrine',
  cell: 'xn/xn1',
  recipe: 'structure-atsuta-shrine.mjs',
  title: 'Atsuta Shrine',
  category: 'religious',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-105, 78, 151],
  lookAt: [0, 3, 32],
  portableGroundY: -0.14,
  mediumFiContext: { scale: 1, groundY: -0.14 },
  qaCameras: [
    {
      name: 'whole-four-hongu-structures-and-native-palisades',
      position: [-87, 80, 128],
      lookAt: [0, 3, 30],
      reviewLod: 'skyline',
    },
    {
      name: 'main-sanctuary-steep-gables-chigi-and-gold-ended-katsuogi',
      position: [-33, 18, 27],
      lookAt: [0, 6, -2],
    },
    {
      name: 'open-front-and-middle-inner-gates-native-gaps',
      position: [-12, 5, 52],
      lookAt: [0, 4, 22],
    },
    { name: 'complete-outer-worship-hall-and-wings', position: [-42, 18, 106], lookAt: [0, 4, 70] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-atsuta-shrine.mjs',
    level: 'skyline',
    export: 'atsutaShrineSkyline',
    errorMeters: 3,
    surfaces,
    authoredLevels: {
      district: { export: 'atsutaShrineDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'atsutaShrineStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'atsutaShrineCloseup', errorMeters: 0, surfaces },
    },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent384m raw field frozen before geometry;15.3161m provider south approach datum is not a surveyed threshold. Actual forest/urban host contact unverified.',
  limitations: [
    p.geometryBasis,
    'Whole main16-point sanctuary/two6-point inner gates/24-point outer worshiphall and all4original open palisade traces retained. No whole religious parcel/yard/natural-ground slab. Precise roof subdivisions and main10.2m/flank6.7m/middle7.2m/front8.4m/worship9.5m ridges, chigi tips, wall/platform/fence/section dimensions and current patina are bounded photo estimates, not native engineering measurements.',
    'Qualla-first51families/zero conflicts. Two exact creator-CC0 published originals inspected but unused: named Kagura-den and Doyoden are separate buildings. One supplemental exact4804x2830SaigenJiro main Hongu original inspected, own-work self-CC0 grant/nativeSHA1/revision bound; unchanged inventory policy passed. No attribution-only pixels, official map/photos, postcard reconstruction or media-metadata/policy changes.',
    'Steep dark copper-gray gables, wood post/panel/eave/gable framing, projecting ridges/paired chigi/cylindrical gold-ended katsuogi, open inner gate passages/complete worship wings/thin wood palisades. Native outer worshiphall front/rear and exact roof split/fence/ornament census are bounded; near detail coarsens at distance. Plain doors/metal fittings omit crests/letters and sacred interior contents. Separate Kagura-den/Doyoden/other shrines/treasure hall/park/trees/people/torii elsewhere excluded.',
    'Independent384m129x129field/all16641values/two raw Terrarium tiles frozen before geometry unchanged without fit/flatten/reacquisition.15.3161m provider-relative south approach and0.2277..23.1913m absolute field are not surveyed building/forest/street grades. Native placement is preview/replaceFootprint=false; actual host contact unverified. Portable/shared/context flat fixtures separate.',
  ],
};
