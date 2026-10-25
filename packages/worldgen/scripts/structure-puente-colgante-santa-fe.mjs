/** Santa Fe's rebuilt red lattice-tower/cable/water-pipe crossing, in the actual mapped frame. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/6d/6dk/puente_colgante_de_santa_fe/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  H = A.length / 2,
  D = A.deckY,
  ref = 'palette:#ffffff',
  C = {
    steel: rgb('963e2e'),
    cable: rgb('66716b'),
    road: rgb('565b59'),
    pier: rgb('b2af9f'),
    accent: rgb('d9d8c7'),
  },
  surfaces = {
    steel: { slot: 'wall', graph: 'metal_painted', roughness: 0.83, metallic: 0.25 },
    cable: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.5 },
    road: { slot: 'roof', graph: 'gravel', roughness: 0.98, metallic: 0 },
    pier: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    accent: { slot: 'door', localRef: 'palette:#fffffe', roughness: 0.8, metallic: 0 },
  };
const tint = (c, s) => c.map((v) => Math.min(1, v * s)),
  add = (a, b) => a.map((x, k) => x + b[k]),
  sub = (a, b) => a.map((x, k) => x - b[k]),
  scale = (a, s) => a.map((x) => x * s),
  unit = (a) => scale(a, 1 / Math.hypot(...a)),
  deck = (x) => D + 0.16 * (1 - Math.pow(x / H, 2));
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((v, x, k) => v + x * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    b = a.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, a.toReversed(), [0, -1, 0], col);
  Q(o, s, b, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]], col);
  }
}
function rod(o, s, a, b, r, d, col = C[s], shape) {
  const v = unit(sub(b, a)),
    u = unit(cross(v, Math.abs(v[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    w = cross(v, u),
    N = shape ?? [0, 3, 4, 6][d];
  if (N === 0) {
    for (const q of [u, w])
      Q(
        o,
        s,
        [add(a, scale(q, -r)), add(b, scale(q, -r)), add(b, scale(q, r)), add(a, scale(q, r))],
        null,
        col,
      );
    return;
  }
  const ring = (q) =>
      Array.from({ length: N }, (_, i) =>
        add(
          q,
          add(
            scale(u, r * Math.cos((i * 2 * Math.PI) / N)),
            scale(w, r * Math.sin((i * 2 * Math.PI) / N)),
          ),
        ),
      ),
    aa = ring(a),
    bb = ring(b);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    Q(o, s, [aa[i], aa[j], bb[j], bb[i]], sub(aa[i], a), col);
  }
  for (let i = 1; i < N - 1; i++) {
    T(o, s, [aa[0], aa[i + 1], aa[i]], scale(v, -1), col);
    T(o, s, [bb[0], bb[i], bb[i + 1]], v, col);
  }
}
function profile(o, P, z, depth) {
  const ids = earcut(P.flat()),
    V = (q, zz) => [q[0], q[1], zz];
  for (let i = 0; i < ids.length; i += 3) {
    const a = ids.slice(i, i + 3).map((k) => P[k]);
    T(
      o,
      'steel',
      a.map((q) => V(q, z)),
      [0, 0, -1],
    );
    T(
      o,
      'steel',
      a.toReversed().map((q) => V(q, z + depth)),
      [0, 0, 1],
    );
  }
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    Q(o, 'steel', [V(P[i], z), V(P[j], z), V(P[j], z + depth), V(P[i], z + depth)], null);
  }
}
function concretePier(o, x, z, d) {
  const shape = (w, l) => [
      [-w + 0.65, -l],
      [w - 0.65, -l],
      [w, -l + 0.65],
      [w, l - 0.65],
      [w - 0.65, l],
      [-w + 0.65, l],
      [-w, l - 0.65],
      [-w, -l + 0.65],
    ],
    a = shape(4.0, 7.5).map(([u, v]) => [x + u, A.pierBaseY, z + v]),
    b = shape(3.5, 7.0).map(([u, v]) => [x + u, A.pierCapY, z + v]);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    Q(o, 'pier', [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  for (let i = 1; i < 7; i++) T(o, 'pier', [b[0], b[i], b[i + 1]], [0, 1, 0]);
  if (d > 0) box(o, 'pier', x, A.pierCapY - 0.22, z, 7.2, 0.22, 14.2);
}
function towers(o, d) {
  for (const [cx, cz] of A.pylonCentres) {
    concretePier(o, cx, cz, d);
    for (const side of [-1, 1]) {
      const z = cz + side * 5.05,
        x = cx,
        w = 0.72,
        l = 1.45,
        y = A.pierCapY,
        top = A.pylonTopY;
      if (d < 2) box(o, 'steel', x, y, z, w, top - y, l);
      else
        for (const u of [-w / 2, w / 2])
          for (const v of [-l / 2, l / 2]) box(o, 'steel', x + u, y, z + v, 0.13, top - y, 0.13);
      if (d > 0) {
        const M = [0, 4, 8, 12][d];
        for (let k = 0; k < M; k++) {
          const a = y + ((top - y) * k) / M,
            b = y + ((top - y) * (k + 1)) / M;
          for (const f of d === 1 ? [-1, 1] : [-1, 1, 2, 3]) {
            let P, Qq, R, S;
            if (Math.abs(f) === 1) {
              P = [x + (f * w) / 2, a, z - l / 2];
              Qq = [x + (f * w) / 2, b, z + l / 2];
              R = [x + (f * w) / 2, a, z + l / 2];
              S = [x + (f * w) / 2, b, z - l / 2];
            } else {
              const zz = z + (f === 2 ? -l / 2 : l / 2);
              P = [x - w / 2, a, zz];
              Qq = [x + w / 2, b, zz];
              R = [x + w / 2, a, zz];
              S = [x - w / 2, b, zz];
            }
            rod(o, 'steel', P, Qq, 0.055, d);
            rod(o, 'steel', R, S, 0.055, d);
          }
        }
      }
      if (d > 1)
        for (const yy of [y + 0.25, deck(cx) - 0.6, A.pylonTopY - 0.5])
          box(o, 'steel', x, yy, z, 1.05, 0.35, 1.8);
    }
    // Each real tower is transverse to the road; three arched crossbeam openings.
    for (const yy of [D + 6.8, D + 14.2, A.pylonTopY - 0.6]) {
      if (d === 0) box(o, 'steel', cx - 0.65, yy, cz, 1.3, 0.7, 10.8);
      else {
        const N = d === 1 ? 4 : d === 2 ? 10 : 16,
          poly = [
            [-5.5, yy + 0.6],
            [5.5, yy + 0.6],
            [5.5, yy - 1.55],
          ];
        for (let k = 0; k <= N; k++) {
          const t = (k * Math.PI) / N;
          poly.push([4.75 * Math.cos(t), yy - 1.55 + 1.5 * Math.sin(t)]);
        }
        poly.push([-5.5, yy - 1.55]);
        const proxy = {
          addTriangle(s, _r, vs, n, _uv, col) {
            const q = vs.map((v) => [cx + v[2], v[1], cz + v[0]]);
            T(o, s, q, [n[2], n[1], n[0]], col);
          },
        };
        profile(proxy, poly, -0.7, 1.4);
        if (d > 1)
          for (let k = 0; k < 6; k++) {
            const z0 = cz - 4.8 + k * 1.6,
              z1 = z0 + 1.6;
            rod(o, 'steel', [cx - 0.74, yy - 0.05, z0], [cx - 0.74, yy + 0.5, z1], 0.055, d);
            rod(o, 'steel', [cx + 0.74, yy + 0.5, z0], [cx + 0.74, yy - 0.05, z1], 0.055, d);
          }
      }
    }
  }
}
function roadAndPipes(o, d) {
  const N = d === 0 ? 2 : d === 1 ? 4 : 12;
  for (let i = 0; i < N; i++) {
    const x = -H + (i * A.length) / N,
      xx = -H + ((i + 1) * A.length) / N,
      y = deck(x),
      yy = deck(xx);
    Q(
      o,
      'road',
      [
        [x, y, -3.25],
        [xx, yy, -3.25],
        [xx, yy, 3.25],
        [x, y, 3.25],
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const z = side * 4.25;
      Q(
        o,
        'pier',
        [
          [x, y + 0.13, z - side],
          [xx, yy + 0.13, z - side],
          [xx, yy + 0.13, z + side],
          [x, y + 0.13, z + side],
        ],
        [0, 1, 0],
      );
      box(o, 'steel', (x + xx) / 2, (y + yy) / 2 - 0.48, side * 4.8, xx - x, 0.4, 0.26);
      rod(
        o,
        'steel',
        [x, y - 0.77, side * 5.4],
        [xx, yy - 0.77, side * 5.4],
        A.waterPipeDiameterEstimate / 2,
        d,
        C.steel,
        d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12,
      );
    }
    Q(
      o,
      'steel',
      [
        [x, y - 0.6, -4.9],
        [x, y - 0.6, 4.9],
        [xx, yy - 0.6, 4.9],
        [xx, yy - 0.6, -4.9],
      ],
      [0, -1, 0],
    );
  }
  for (const side of [-1, 1]) {
    const N = d === 0 ? 1 : d === 1 ? 3 : 12;
    for (let i = 0; i < N; i++) {
      const x = -H + (i * A.length) / N,
        xx = -H + ((i + 1) * A.length) / N;
      rod(
        o,
        'steel',
        [x, deck(x) + 1.25, side * 5.12],
        [xx, deck(xx) + 1.25, side * 5.12],
        0.065,
        d,
      );
      if (d > 0)
        rod(
          o,
          'steel',
          [x, deck(x) + 0.62, side * 5.12],
          [xx, deck(xx) + 0.62, side * 5.12],
          0.045,
          d,
        );
    }
    if (d > 0) {
      const K = Math.round(A.length / (d === 1 ? 5 : d === 2 ? 2 : 1.25));
      for (let i = 0; i <= K; i++) {
        const x = -H + (i * A.length) / K,
          y = deck(x) + 0.15,
          z = side * 5.12;
        if (d < 3)
          Q(
            o,
            'steel',
            [
              [x - 0.04, y, z],
              [x + 0.04, y, z],
              [x + 0.04, y + 1.1, z],
              [x - 0.04, y + 1.1, z],
            ],
            [0, 0, side],
          );
        else box(o, 'steel', x, y, z, 0.075, 1.1, 0.075);
      }
    }
    if (d > 0)
      for (let x = -H + 3; x < H - 1; x += d === 1 ? 24 : d === 2 ? 12 : 6) {
        const y = deck(x) - 0.77,
          z = side * 5.4;
        rod(
          o,
          'steel',
          [x - 0.06, y, z],
          [x + 0.06, y, z],
          0.48,
          d,
          tint(C.steel, 0.83),
          d === 3 ? 12 : 4,
        );
      }
  }
  if (d > 1) {
    const K = Math.ceil(A.length / 8);
    for (let i = 0; i < K; i++) {
      const x = -H + (i * A.length) / K,
        xx = -H + ((i + 1) * A.length) / K;
      rod(o, 'steel', [x, deck(x) - 0.5, -4.7], [xx, deck(xx) - 0.5, 4.7], 0.07, d);
      rod(o, 'steel', [x, deck(x) - 0.5, 4.7], [xx, deck(xx) - 0.5, -4.7], 0.07, d);
    }
  }
  if (d > 0)
    for (let x = -H + 4; x < H - 3; x += 9)
      Q(
        o,
        'accent',
        [
          [x, deck(x) + 0.012, -0.06],
          [x + 3, deck(x + 3) + 0.012, -0.06],
          [x + 3, deck(x + 3) + 0.012, 0.06],
          [x, deck(x) + 0.012, 0.06],
        ],
        [0, 1, 0],
      );
  for (const x of [-H, H]) {
    box(o, 'pier', x, -3.5, 0, 4.0, D + 3.0, 13.2);
    box(o, 'pier', x, D - 0.5, 0, 4.8, 0.5, 13.8);
    if (d > 0)
      for (const side of [-1, 1]) {
        box(o, 'pier', x + Math.sign(x) * 1.5, D - 0.5, side * 5.4, 4.0, 1.4, 2.0);
        box(o, 'steel', x, D + 0.05, side * 4.7, 0.45, 0.35, 0.9);
      }
  }
}
function cableSystem(o, d) {
  const xs = [-H, ...A.towerX, H],
    zs = [-4.62, 4.62],
    M = [4, 10, 23, 48][d],
    curve = (i, t) => {
      const a = xs[i],
        b = xs[i + 1],
        y0 = i === 0 ? D + 0.45 : A.pylonTopY,
        y1 = i === 2 ? D + 0.45 : A.pylonTopY,
        sag = i === 1 ? A.cableSagEstimate : 2.4;
      return [a + (b - a) * t, y0 + (y1 - y0) * t - 4 * sag * t * (1 - t)];
    };
  for (const z of zs) {
    for (let i = 0; i < 3; i++)
      for (const offset of [-0.16, 0.16])
        for (let j = 0; j < M; j++) {
          const a = curve(i, j / M),
            b = curve(i, (j + 1) / M);
          rod(
            o,
            'cable',
            [a[0], a[1] + offset, z],
            [b[0], b[1] + offset, z],
            d === 0 ? 0.105 : 0.07,
            d,
          );
        }
    // Intrinsic fan stays from each tower toward its side span and half central span.
    const K = [4, 7, 10, 12][d];
    for (let k = 0; k < 2; k++)
      for (const sign of [-1, 1]) {
        const x = A.towerX[k],
          end =
            sign < 0
              ? k === 0
                ? -H
                : (A.towerX[0] + A.towerX[1]) / 2
              : k === 1
                ? H
                : (A.towerX[0] + A.towerX[1]) / 2;
        for (let j = 1; j <= K; j++) {
          const xx = x + ((end - x) * j) / K;
          rod(
            o,
            'cable',
            [x, A.pylonTopY - 0.25, z],
            [xx, deck(xx) + 0.55, z],
            d === 0 ? 0.11 : 0.065,
            d,
          );
        }
      }
    for (let i = 0; i < 3; i++) {
      const K = d === 0 ? 4 : d === 1 ? 7 : d === 2 ? 12 : 20;
      for (let j = 1; j < K; j++) {
        const a = curve(i, j / K);
        rod(
          o,
          'cable',
          [a[0], a[1] - 0.16, z],
          [a[0], deck(a[0]) + 0.3, z],
          d === 0 ? 0.09 : 0.04,
          d,
        );
        if (d > 1) {
          rod(o, 'cable', [a[0] - 0.35, a[1], z], [a[0] + 0.35, a[1], z], 0.055, d);
          if (d === 3) box(o, 'cable', a[0], a[1] - 0.25, z, 0.18, 0.5, 0.2);
        }
      }
    }
  }
}
function lamps(o, d) {
  const K = [4, 7, 18, 25][d];
  for (const side of [-1, 1])
    for (let i = 0; i < K; i++) {
      const x = -H + ((i + 0.5) * A.length) / K,
        z = side * 4.62,
        y = deck(x) + 0.12,
        points = [
          [x, y, z],
          [x, y + 4.4, z],
          [x, y + 4.9, z - side * 0.35],
          [x, y + 4.95, z - side * 0.95],
        ];
      if (d === 0) {
        rod(o, 'cable', points[0], points.at(-1), 0.06, 0);
        Q(
          o,
          'accent',
          [
            [x - 0.12, y + 4.85, z - side * 1.0],
            [x + 0.12, y + 4.85, z - side * 1.0],
            [x + 0.12, y + 4.85, z - side * 0.6],
            [x - 0.12, y + 4.85, z - side * 0.6],
          ],
          [0, 1, 0],
        );
        continue;
      }
      const N = d === 1 ? 1 : d === 2 ? 2 : 3;
      for (let j = 0; j < N; j++) {
        const a = points[Math.floor((j * 3) / N)],
          b = points[Math.floor(((j + 1) * 3) / N)];
        rod(o, 'cable', a, b, 0.045, d);
      }
      box(o, 'accent', x, y + 4.87, z - side * 0.95, 0.2, 0.12, 0.55);
    }
}
function build(o, _frame, d = 3) {
  towers(o, d);
  roadAndPipes(o, d);
  cableSystem(o, d);
  lamps(o, d);
}
export function santaFeSuspensionCounts(d) {
  const c = {};
  for (const fn of [towers, roadAndPipes, cableSystem, lamps]) {
    let n = 0;
    fn(
      {
        addTriangle() {
          n++;
        },
      },
      d,
    );
    c[fn.name] = n;
  }
  return c;
}
export const santaFeSuspensionSkyline = (o, f) => build(o, f, 0),
  santaFeSuspensionDistrict = (o, f) => build(o, f, 1),
  santaFeSuspensionStreet = (o, f) => build(o, f, 2),
  santaFeSuspensionCloseup = (o, f) => build(o, f, 3);
export const santaFeSuspensionModel = {
  id: 'puente_colgante_de_santa_fe',
  key: 'puente_colgante_de_santa_fe',
  cell: '6d/6dk',
  recipe: 'structure-puente-colgante-santa-fe.mjs',
  title: 'Puente Colgante de Santa Fe',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [225, 100, 230],
  lookAt: [0, 8, 0],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  mediumFiContext: { scale: 2.4 },
  qaCameras: [
    {
      name: 'whole-three-span-red-towers-cables-water-pipes-and-abutments',
      position: [225, 100, 230],
      lookAt: [0, 8, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'south-elevation-two-native-pylons-fan-and-sagging-cable-system',
      position: [10, 15, 210],
      lookAt: [10, 10, 0],
    },
    {
      name: 'eastern-red-lattice-tower-three-arched-openings-and-concrete-pier',
      position: [A.towerX[1] + 24, 12, 30],
      lookAt: [A.towerX[1], 10, 0],
    },
    {
      name: 'road-through-western-tower-open-portals-sidewalks-and-rails',
      position: [A.towerX[0] - 25, D + 2, 0],
      lookAt: [A.towerX[0] + 30, D + 3, 0],
    },
    {
      name: 'main-cable-clamps-suspenders-and-fan-stays',
      position: [25, 20, 19],
      lookAt: [25, 14, 4.6],
    },
    {
      name: 'large-water-pipes-underdeck-cross-girders-and-iron-railings',
      position: [A.towerX[1] - 20, 2, 18],
      lookAt: [A.towerX[1] - 30, D - 0.7, 4.5],
    },
    {
      name: 'western-abutment-cable-anchors-and-full-side-span',
      position: [-H - 20, 15, 29],
      lookAt: [-H + 23, 7, 0],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-puente-colgante-santa-fe.mjs',
    level: 'skyline',
    export: 'santaFeSuspensionSkyline',
    errorMeters: 2.0,
    surfaces,
    authoredLevels: {
      district: { export: 'santaFeSuspensionDistrict', errorMeters: 0.8, surfaces },
      street: { export: 'santaFeSuspensionStreet', errorMeters: 0.22, surfaces },
      closeup: { export: 'santaFeSuspensionCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole current mapped crossing/both explicit native pylon positions, paired red lattice columns/three stacked arched crossbeams/concrete piers, full side and middle spans/fan+sagging cable/suspender system, large longitudinal water pipes, two-lane road/sidewalks/open rails/lamps/bounded end abutments and anchors. Separate parallel concrete bridge, shore promenades/city/water/boats/people/cars/signs/holiday stars and light strings excluded.',
    'One exact cleared native2006 Alegsa original individually inspected with named own/PD-self release, current rebuilt2002 bridge; no doubtful assumed-author night image or unknown-author historic photographs used, no source media/article repair, generated bitmap or borrowed mesh. Current exact lighting installation/fine maintenance details not reproduced from old photographs.',
    'Gisclard-type fan/sagging cable arrangement follows the clear reference, with bounded interpreted wire/cross-clamp/suspender/lattice/lamp census. It is recognizable exterior geometry, not engineering force design. Native current pylon centres and full mapped bridge-road extent retained, including short western connectors; width/height/cable/anchor/underwater sections remain estimated.',
    'Five actual canonical slots/three shared graphs plus one local pale accent for lamp/road markings: red painted steel, gray cable metal, coarse asphalt-like gravel roadway, concrete piers/sidewalks and pale marks. No active illumination/water rendering/physics, flag/holiday strings or parallel road-deck substitution. Skyline preserves full bridge/towers/cable families/water pipes; near levels add real four-face column lacing/arch knee plates/underdeck cross girders/pipe joints/rail posts/clamps.',
    'Independent16641value512m source field/raw tile/PNG frozen before geometry and unchanged. Approximate shared water/deck/pier/shore datum chosen beforehand; provider field not bathymetry or surveyed water stage. Foundations partly embedded and abutment contact approximate; geographic preview/replacementfalse, no flattening/fitting/source-field alteration.',
  ],
};
