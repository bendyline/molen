/** Original sculpted exterior, using cleared photographs and separate native podium outlines. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/te/teu/statue_of_unity/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  base = plan.estimatedParameters.pedestalAboveLocalEntry;
const C = {
  bronze: rgb('897760'),
  recess: rgb('706450'),
  stone: rgb('b9a68d'),
  cap: rgb('c3b297'),
  glass: rgb('59686a'),
};
const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.81, metallic: 0.48 },
  recess: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.88, metallic: 0.4 },
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  cap: { slot: 'roof', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  glass: { slot: 'window', localRef: ref, roughness: 0.45, metallic: 0.1 },
};
function T(o, s, p, want) {
  p = p.map((q) => q.map(Math.fround));
  let n = normalFor(...p);
  if (n.every((v) => v === 0)) return;
  if (want && n.reduce((v, q, i) => v + q * want[i], 0) < 0) p = [p[0], p[2], p[1]];
  n = normalFor(...p);
  o.addTriangle(
    s,
    ref,
    p,
    n,
    p.map((q) => [q[0], q[1]]),
    C[s],
  );
}
function Q(o, s, p, n) {
  T(o, s, p.slice(0, 3), n);
  T(o, s, [p[0], p[2], p[3]], n);
}
const U = (p) => [p[0] * 100, p[1] * 100 + base, p[2] * 100];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function profile(rows, y) {
  if (y <= rows[0][0]) return rows[0].slice(1);
  for (let i = 1; i < rows.length; i++)
    if (y <= rows[i][0])
      return mix(
        rows[i - 1].slice(1),
        rows[i].slice(1),
        (y - rows[i - 1][0]) / (rows[i][0] - rows[i - 1][0]),
      );
  return rows.at(-1).slice(1);
}
const G = (v, c, r) => Math.exp(-((v - c) * (v - c)) / (r * r));
function skin(o, s, fn, N, J, y0, y1) {
  const rings = Array.from({ length: J + 1 }, (_, j) =>
    Array.from({ length: N }, (_, i) => U(fn(y0 + ((y1 - y0) * j) / J, (i * 2 * Math.PI) / N))),
  );
  loft(o, s, rings, C[s]);
}
function blob(o, s, center, radii, N, J) {
  skin(
    o,
    s,
    (v, a) => {
      const t = (v + 0.5) * Math.PI,
        sn = Math.sin(t);
      return [
        center[0] + radii[0] * sn * Math.sin(a),
        center[1] - radii[1] * Math.cos(t),
        center[2] + radii[2] * sn * Math.cos(a),
      ];
    },
    N,
    J,
    -0.4999,
    0.4999,
  );
}
function rod(o, s, a, b, r, N = 4) {
  const v = normalize(b.map((x, i) => x - a[i])),
    u = normalize(cross(v, Math.abs(v[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    w = cross(v, u),
    rings = [a, b].map((p) =>
      Array.from({ length: N }, (_, i) =>
        p.map(
          (q, k) =>
            q +
            r * (u[k] * Math.cos((i * 2 * Math.PI) / N) + w[k] * Math.sin((i * 2 * Math.PI) / N)),
        ),
      ),
    );
  loft(o, s, rings, C[s]);
}
function podium(o, d) {
  const outer = plan.rings[1],
    upper = plan.rings[2],
    support = plan.rings[4];
  function prism(ring, y0, y1, portals = false) {
    const winding = Math.sign(
      ring.reduce((sum, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0),
    );
    const idx = earcut(ring.flat());
    for (let i = 0; i < idx.length; i += 3)
      T(
        o,
        'cap',
        idx.slice(i, i + 3).map((i) => [ring[i][0], y1, ring[i][1]]),
        [0, 1, 0],
      );
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        p = (t, y) => [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t],
        n = normalize([winding * (b[1] - a[1]), 0, winding * (a[0] - b[0])]);
      if (portals && len > 18) {
        const bays = d === 0 ? 1 : Math.max(1, Math.round(len / 10)),
          w = 0.62 / bays;
        for (let k = 0; k < bays; k++) {
          const l = (k + 0.5) / bays - w / 2,
            r = l + w;
          Q(o, 'stone', [p(k / bays, y0), p(l, y0), p(l, y1), p(k / bays, y1)], n);
          Q(o, 'stone', [p(r, y0), p((k + 1) / bays, y0), p((k + 1) / bays, y1), p(r, y1)], n);
          Q(o, 'stone', [p(l, y1 - 1.6), p(r, y1 - 1.6), p(r, y1), p(l, y1)], n);
          const inward = n.map((v) => -v * 1.1),
            q = (t, y) => p(t, y).map((v, i) => v + inward[i]);
          Q(
            o,
            'stone',
            [p(l, y0), q(l, y0), q(l, y1 - 1.6), p(l, y1 - 1.6)],
            [b[0] - a[0], 0, b[1] - a[1]],
          );
          Q(
            o,
            'stone',
            [p(r, y0), p(r, y1 - 1.6), q(r, y1 - 1.6), q(r, y0)],
            [-(b[0] - a[0]), 0, -(b[1] - a[1])],
          );
          Q(o, 'glass', [q(l, y0), q(r, y0), q(r, y1 - 1.6), q(l, y1 - 1.6)], n);
        }
      } else Q(o, 'stone', [p(0, y0), p(1, y0), p(1, y1), p(0, y1)], n);
    }
  }
  prism(outer, 0, 7.5, d > 0);
  prism(upper, 7.5, 11);
  prism(support, 11, base - 0.7, d > 1);
  prism(support, base - 0.7, base);
  if (d > 0) {
    const a = support[4],
      b = support[0],
      A = [a[0], base - 2, a[1]],
      B = [b[0], base - 2, b[1]],
      center = mix(A, B, 0.5),
      v = normalize([A[2] - B[2], 0, B[0] - A[0]]),
      loA = A.map((q, i) => q + v[i] * 19),
      loB = B.map((q, i) => q + v[i] * 19);
    loA[1] = loB[1] = 11;
    const rows = [2, 2, 4, 8][d],
      cols = [2, 3, 6, 9][d],
      P = (u, t) => mix(mix(A, B, u), mix(loA, loB, u), t);
    for (const [x, y] of [
      [A, B],
      [A, loA],
      [B, loB],
      [loA, loB],
    ])
      rod(o, 'cap', x, y, 0.48, 4);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const u = i / cols,
          t = j / rows,
          h = 1 / rows,
          w = 1 / cols,
          count = d === 1 ? 8 : 16,
          star = Array.from({ length: count }, (_, k) => {
            const a = (k * 2 * Math.PI) / count,
              r = k % 2 === 0 ? 1 : 0.58;
            return P(u + w / 2 + Math.cos(a) * w * 0.5 * r, t + h / 2 + Math.sin(a) * h * 0.5 * r);
          });
        for (let k = 0; k < count; k++) rod(o, 'cap', star[k], star[(k + 1) % count], 0.25, 3);
      }
    const stairs = [-1, 1];
    for (const side of stairs) {
      const u = side < 0 ? -0.1 : 1.1;
      for (let j = 0; j < rows * 2; j++) {
        const x = P(u, (j + 0.5) / (rows * 2));
        box(
          o,
          'stone',
          [x[0] - 1.3, x[1] - 0.7, x[2] - 1.2],
          [x[0] + 1.3, x[1], x[2] + 1.2],
          C.stone,
        );
      }
    }
    void center;
  }
}
function statue(o, d) {
  const [N, J] = [
    [8, 7],
    [14, 12],
    [30, 25],
    [52, 44],
  ][d];
  const body = [
    [0.65, 0.176, 0.128, 0.105],
    [0.69, 0.194, 0.145, 0.11],
    [0.81, 0.184, 0.143, 0.116],
    [0.96, 0.164, 0.138, 0.112],
    [1.12, 0.155, 0.139, 0.108],
    [1.28, 0.164, 0.131, 0.105],
    [1.4, 0.183, 0.118, 0.1],
    [1.48, 0.187, 0.095, 0.092],
    [1.53, 0.12, 0.069, 0.075],
    [1.565, 0.052, 0.045, 0.048],
  ];
  skin(
    o,
    'bronze',
    (y, a) => {
      const [rx, front, back] = profile(body, y),
        ca = Math.cos(a),
        sa = Math.sin(a),
        x = rx * sa,
        face = Math.max(0, ca),
        bow =
          0.014 * Math.sin(42 * y + 6 * x + 70 * x * x) * G(y, 0.88, 0.22) +
          0.008 * Math.sin(48 * x + 3 * y) * G(y, 1.2, 0.32),
        shawl =
          0.015 *
          (G(x, -0.1 + 0.09 * (y - 1), 0.016) + G(x, 0.09 - 0.08 * (y - 1), 0.017)) *
          G(y, 1.18, 0.4);
      return [x, y, (ca >= 0 ? front : back) * ca + face * (bow + shawl) - 0.017];
    },
    N,
    J,
    0.65,
    1.565,
  );
  skin(
    o,
    'bronze',
    (y, a) => [0.04 * Math.sin(a) - 0.006, y, 0.039 * Math.cos(a) + 0.004],
    d < 2 ? 6 : 20,
    d < 2 ? 2 : 8,
    1.55,
    1.61,
  );
  if (d > 0) {
    const rows = [0, 6, 14, 24][d],
      columns = d === 1 ? 4 : 12;
    const P = (u, t, back = false) =>
      U([
        -0.035 - 0.065 * Math.sin((t * Math.PI) / 2) + 0.065 * u,
        1.5 - 0.65 * t + 0.025 * (1 - u * u) * Math.sin(t * Math.PI),
        0.1 +
          0.055 * Math.sin(t * Math.PI) +
          0.012 * Math.sin(u * 8 + t * 7) * Math.sin(t * Math.PI) -
          (back ? 0.012 : 0),
      ]);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < columns; i++) {
        const u = -1 + (2 * i) / columns,
          v = u + 2 / columns,
          t = j / rows,
          s = t + 1 / rows;
        Q(o, 'bronze', [P(u, t), P(v, t), P(v, s), P(u, s)], [0, 0, 1]);
        Q(o, 'bronze', [P(u, t, true), P(u, s, true), P(v, s, true), P(v, t, true)], [0, 0, -1]);
      }
    for (const u of [-1, 1])
      for (let j = 0; j < rows; j++) {
        const t = j / rows,
          s = (j + 1) / rows;
        Q(o, 'bronze', [P(u, t), P(u, s), P(u, s, true), P(u, t, true)], [u, 0, 0]);
      }
  }
  const head = [
    [1.575, 0.036, 0.039, -0.006],
    [1.603, 0.046, 0.054, 0.011],
    [1.628, 0.064, 0.064, 0.011],
    [1.66, 0.074, 0.065, 0.005],
    [1.69, 0.078, 0.064, -0.003],
    [1.725, 0.078, 0.065, -0.007],
    [1.755, 0.079, 0.067, -0.009],
    [1.785, 0.068, 0.058, -0.008],
    [1.805, 0.046, 0.042, -0.006],
    [1.82, 0.001, 0.001, -0.006],
  ];
  skin(
    o,
    'bronze',
    (y, a) => {
      const [rx, rz, cz] = profile(head, y),
        x = rx * Math.sin(a),
        ca = Math.cos(a),
        f = Math.max(0, ca);
      let z = rz * ca + cz;
      if (ca > 0) {
        const nose =
            0.028 * G(x, 0, 0.019) * G(y, 1.691, 0.039) +
            0.013 * G(x, 0, 0.023) * G(y, 1.674, 0.01),
          eyes = -0.012 * (G(x, -0.035, 0.021) + G(x, 0.035, 0.021)) * G(y, 1.716, 0.012),
          brows = 0.008 * (G(x, -0.035, 0.027) + G(x, 0.035, 0.027)) * G(y, 1.734, 0.007),
          cheeks = 0.007 * (G(x, -0.047, 0.023) + G(x, 0.047, 0.023)) * G(y, 1.675, 0.026),
          mouth =
            0.005 * G(x, 0, 0.035) * G(y, 1.644, 0.011) -
            0.004 * G(x, 0, 0.031) * G(y, 1.647, 0.003),
          chin = 0.008 * G(x, 0, 0.032) * G(y, 1.618, 0.017),
          fold = -0.004 * (G(x, -0.032, 0.004) + G(x, 0.032, 0.004)) * G(y, 1.653, 0.024);
        z += (nose + eyes + brows + cheeks + mouth + chin + fold) * f;
      }
      return [x - 0.006, y, z + 0.018];
    },
    N,
    d === 0 ? 6 : J,
    1.575,
    1.82,
  );
  if (d > 0)
    for (const side of [-1, 1]) {
      blob(
        o,
        'bronze',
        [side * 0.079 - 0.006, 1.704, 0.003],
        [0.018, 0.035, 0.019],
        Math.max(6, N / 2),
        Math.max(5, J / 3),
      );
      blob(
        o,
        'recess',
        [side * 0.088 - 0.006, 1.705, 0.016],
        [0.006, 0.022, 0.005],
        Math.max(4, N / 3),
        Math.max(4, J / 4),
      );
    }
  for (const side of [-1, 1]) {
    const step = side > 0 ? 0.045 : -0.055,
      leg = [
        [0.105, 0.06, 0.032, 0.034],
        [0.16, 0.065, 0.047, 0.05],
        [0.26, 0.069, 0.055, 0.059],
        [0.4, 0.075, 0.065, 0.064],
        [0.52, 0.076, 0.072, 0.069],
        [0.65, 0.078, 0.084, 0.077],
        [0.76, 0.078, 0.083, 0.074],
      ];
    skin(
      o,
      'bronze',
      (y, a) => {
        const [cx, rx, rz] = profile(leg, y),
          fold = 0.007 * Math.sin(a * 5 + y * 14) + 0.004 * Math.sin(a * 9 - y * 24);
        return [
          side * cx + (rx + fold) * Math.sin(a),
          y,
          step + (rz + fold) * Math.cos(a) + 0.016 * Math.sin(y * 6),
        ];
      },
      Math.max(6, Math.round(N * 0.65)),
      Math.max(5, Math.round(J * 0.7)),
      0.105,
      0.76,
    );
    skin(
      o,
      'bronze',
      (y, a) => [side * 0.06 + 0.029 * Math.sin(a), y, step + 0.03 * Math.cos(a)],
      Math.max(5, Math.round(N * 0.5)),
      d === 0 ? 2 : 5,
      0.035,
      0.15,
    );
    const foot = [
      [0, 0.055, 0.124, 0.06],
      [0.014, 0.056, 0.125, 0.06],
      [0.036, 0.053, 0.103, 0.048],
      [0.065, 0.038, 0.07, 0.024],
      [0.1, 0.029, 0.031, 0],
    ];
    skin(
      o,
      'bronze',
      (y, a) => {
        const [rx, rz, cz] = profile(foot, y);
        return [side * 0.061 + rx * Math.sin(a), y, step + cz + rz * Math.cos(a)];
      },
      Math.max(6, Math.round(N * 0.7)),
      d === 0 ? 3 : Math.round(J * 0.35),
      0,
      0.1,
    );
    if (d > 0) {
      for (let i = 0; i < 5; i++)
        blob(
          o,
          'bronze',
          [side * (0.018 + i * 0.021), 0.026, step + 0.178 - i * 0.008],
          [0.015 - i * 0.0011, 0.025 - i * 0.002, 0.034 - i * 0.003],
          d === 1 ? 4 : d === 2 ? 8 : 12,
          d === 1 ? 3 : d === 2 ? 5 : 8,
        );
      for (const z of d === 1 ? [step + 0.04] : [step + 0.025, step + 0.075]) {
        const segments = d === 1 ? 4 : d === 2 ? 6 : 8;
        const band = Array.from({ length: segments + 1 }, (_, k) => {
          const a = (k * Math.PI) / segments;
          return U([side * 0.061 - 0.054 * Math.cos(a), 0.025 + 0.05 * Math.sin(a), z]);
        });
        for (let k = 0; k < segments; k++)
          rod(o, 'bronze', band[k], band[k + 1], 0.65, d === 1 ? 3 : 4);
      }
    }
    const arm = [
      [0.79, 0.195, 0.02, 0.026, 0.02],
      [0.89, 0.211, 0.035, 0.041, 0.006],
      [1.04, 0.221, 0.048, 0.049, -0.015],
      [1.18, 0.222, 0.056, 0.057, -0.027],
      [1.32, 0.21, 0.06, 0.06, -0.033],
      [1.43, 0.177, 0.065, 0.064, -0.03],
      [1.49, 0.155, 0.055, 0.055, -0.015],
    ];
    skin(
      o,
      'bronze',
      (y, a) => {
        const [x, rx, rz, z] = profile(arm, y),
          wrinkle = 0.004 * Math.sin(6 * a + y * 25);
        return [side * x + (rx + wrinkle) * Math.sin(a), y, z + (rz + wrinkle) * Math.cos(a)];
      },
      Math.max(6, Math.round(N * 0.55)),
      Math.max(5, Math.round(J * 0.6)),
      0.79,
      1.49,
    );
    const palmZ = side < 0 ? 0.03 : 0.007;
    blob(
      o,
      'bronze',
      [side * 0.193, 0.765, palmZ],
      [0.03, 0.073, 0.031],
      d === 0 ? 4 : Math.max(8, Math.round(N * 0.45)),
      d === 0 ? 3 : Math.max(6, Math.round(J * 0.4)),
    );
    if (d > 1)
      for (let i = 0; i < 4; i++)
        blob(
          o,
          'bronze',
          [side * (0.174 + i * 0.013), 0.711 + Math.abs(i - 1.4) * 0.006, palmZ + 0.012],
          [0.009, 0.028, 0.013],
          d === 2 ? 6 : 10,
          d === 2 ? 5 : 8,
        );
  }
}
function build(o, _frame, d = 3) {
  podium(o, d);
  statue(o, d);
}
export const unitySkyline = (o, f) => build(o, f, 0);
export const unityDistrict = (o, f) => build(o, f, 1);
export const unityStreet = (o, f) => build(o, f, 2);
export const unityCloseup = (o, f) => build(o, f, 3);
export const statueOfUnityModel = {
  id: 'statue_of_unity',
  key: 'statue_of_unity',
  recipe: 'structure-statue-of-unity.mjs',
  cell: 'te/teu',
  title: 'Statue of Unity',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: plan.authoringDirection,
  camera: [-240, 130, 320],
  lookAt: [0, 99, 0],
  portableGroundY: -0.2,
  mediumFiContext: { scale: 3, groundY: -0.2 },
  qaCameras: [
    {
      name: 'complete-sculpture-and-native-intrinsic-podium',
      position: [-220, 130, 310],
      lookAt: [-15, 100, 10],
    },
    {
      name: 'patel-head-facial-profile-ears-and-draped-shoulders',
      position: [-35, 195, 58],
      lookAt: [0, 191, 0],
    },
    { name: 'dhoti-walking-leg-gap-sandals-and-toes', position: [-43, 65, 80], lookAt: [0, 48, 8] },
    {
      name: 'geometric-podium-panel-and-entrance-voids',
      position: [-100, 36, 30],
      lookAt: [-20, 15, 0],
    },
    {
      name: 'rear-drapery-and-independent-podium-shape',
      position: [100, 105, -200],
      lookAt: [0, 95, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Independent520m65x65terrain field frozen before geometry; no fitted island/river slab. Exact host podium contact and completed vertical datum unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-statue-of-unity.mjs',
    level: 'skyline',
    export: 'unitySkyline',
    errorMeters: 2.8,
    surfaces,
    authoredLevels: {
      district: { export: 'unityDistrict', errorMeters: 1.4, surfaces },
      street: { export: 'unityStreet', errorMeters: 0.7, surfaces },
      closeup: { export: 'unityCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Exact five published CC0 originals individually inspected and native SHA1 matched, no external imagery or photographic/AI bitmap textures. Redscale/monochrome images govern shape; bronze palette is a bounded material interpretation.',
    'Original sculpted cross sections and facial displacements establish bald head/nose/brow/cheeks/ears/chin, draped coat and dhoti, lowered hands, real separated walking legs, sandals/toes. Fine facial likeness/wrinkles, back and exact fold/casting-panel census are simplified medium-fi estimates; no scan or engineering replica claim.',
    'Primary182m controls toe-to-crown sculpture height. Intrinsic podium vertical section26.5m is an explicit above-local-entry estimate; old promotional240m/58m figures are not adopted as a surveyed completed local section. Inner partitions, slab depths, portal census, canopy/ramp/lattice geometry and concealed supports estimated.',
    'Native mapped statue outline is a footprint proxy around the feet, not the full upper-body projected silhouette. Shoulder overhang is original photo-based reconstruction. Four intrinsic native podium/entry outlines retained. Separate long river bridges/mainland buildings, island/river/landscape/people/signs/interiors omitted.',
    'Independent520mfield/4225samples/4rawTerrariumtiles frozen before geometry, unchanged. Urban/vegetation/water returns do not establish surveyed thresholds. Preview replaceFootprint=false and compatible actual host ground contact unverified.',
  ],
};
