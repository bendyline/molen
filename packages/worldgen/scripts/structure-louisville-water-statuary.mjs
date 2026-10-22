/** Original medium-fi zinc statuary: posed anatomy and draped/attribute forms, never photo textures. */
import './install-deterministic-math.mjs';
import {
  evaluatePose,
  generateFigureBody,
  poseModelSpace,
  resolveFigureDescriptor,
  solveTwoBoneIk,
} from '../../figures/dist/kernel.mjs';
import {
  quatConjugate,
  quatFromEuler,
  quatFromTo,
  quatMul,
  quatRotateVec3,
} from '../../kernel/dist/determinism.mjs';
import { loft, normalFor, normalize, radialRing, sphere } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box, tube } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  white = rgb('d9ddd3'),
  relief = rgb('c8cec4'),
  cache = new Map();
function tri(o, p, col = white, n) {
  if (n && normalFor(...p).reduce((s, v, k) => s + v * n[k], 0) < 0) p = [p[0], p[2], p[1]];
  o.addTriangle(
    'statue',
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    col,
  );
}
function transformed(o, at, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    P = (p) => [at[0] + c * p[0] + s * p[2], at[1] + p[1], at[2] - s * p[0] + c * p[2]],
    N = (n) => [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]];
  return new Proxy(o, {
    get(t, k) {
      if (k === 'addTriangle')
        return (slot, r, p, n, uv, col) => t.addTriangle(slot, r, p.map(P), N(n), uv, col);
      if (k === 'addQuad')
        return (slot, r, p, n, uv, col) => t.addQuad(slot, r, p.map(P), N(n), uv, col);
      if (k === 'addConvexPolygon')
        return (slot, r, p, n, uv, col) =>
          t.addConvexPolygon(
            slot,
            r,
            p.map(P),
            N(n),
            (q) => uv([q[0] - at[0], q[1] - at[1], q[2] - at[2]]),
            col,
          );
      const v = t[k];
      return typeof v === 'function' ? v.bind(t) : v;
    },
  });
}
const goals = (kind) =>
  kind === 1
    ? [
        [0.09, 2.1, 0.08],
        [-0.26, 1.1, 0.16],
      ]
    : kind === 2
      ? [
          [0.34, 1.0, 0.47],
          [0.11, 0.95, 0.51],
        ]
      : kind === 3
        ? [
            [0.28, 1.1, 0.28],
            [-0.32, 1.02, 0.22],
          ]
        : [
            [0.13, 1.12, 0.29],
            [-0.12, 1.15, 0.31],
          ];
function anatomy(kind, d) {
  const key = `${kind}:${d}`;
  if (cache.has(key)) return cache.get(key);
  const body = generateFigureBody(
      resolveFigureDescriptor({
        preset: 'human.adult',
        height: 2.0,
        build: kind === 3 ? 0.05 : -0.2,
        features: {
          hair: 'none',
          hands: d > 2 ? 'fingers' : 'mitten',
          sleeves: 'none',
          legs: 'shorts',
        },
        proportions: { headScale: 0.9, shoulderWidth: 0.94, hipWidth: 1.03 },
        seed: `louisville-zinc-figure-${kind}`,
      }),
      d > 2 ? 0 : 1,
    ),
    pose = evaluatePose(
      body.rig,
      { mode: 'custom', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 },
      0,
      {
        tickRate: 60,
        overrides: {
          chest: quatFromEuler(kind === 2 ? 0.15 : 0, kind * 0.05, 0.025 * (kind % 2 ? -1 : 1)),
          head: quatFromEuler(0, kind === 1 ? -0.15 : 0.1, 0),
        },
      },
    ),
    model = poseModelSpace(pose),
    buf = body.buffers;
  for (const [side, sign, goal] of [
    ['l', 1, goals(kind)[0]],
    ['r', -1, goals(kind)[1]],
  ]) {
    const u = body.rig.index[`upperArm.${side}`],
      l = body.rig.index[`foreArm.${side}`],
      e = body.rig.index[`hand.${side}`],
      upper = body.rig.joints[u],
      lower = body.rig.joints[l],
      end = body.rig.joints[e],
      root = Array.from(model.subarray(u * 7, u * 7 + 3)),
      parent = Array.from(model.subarray(upper.parent * 7 + 3, upper.parent * 7 + 7)),
      solved = solveTwoBoneIk(
        root,
        goal,
        [sign, -0.6, 0.8],
        Math.hypot(...lower.bindPos),
        Math.hypot(...end.bindPos),
      ),
      uq = quatFromTo(normalize(lower.bindPos), solved.upperDir),
      lq = quatFromTo(normalize(end.bindPos), solved.lowerDir);
    pose.local.set(quatMul(quatConjugate(parent), uq), u * 7 + 3);
    pose.local.set(quatMul(quatConjugate(uq), lq), l * 7 + 3);
  }
  poseModelSpace(pose, model);
  const vertices = Array.from({ length: buf.vertexCount }, (_, i) => {
    const p = Array.from(buf.positions.subarray(i * 3, i * 3 + 3)),
      out = [0, 0, 0];
    for (let n = 0; n < 4; n++) {
      const j = buf.joints[i * 4 + n],
        w = buf.weights[i * 4 + n];
      if (!w) continue;
      const m = body.inverseBind.subarray(j * 16, j * 16 + 16),
        a = [
          m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
          m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
          m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
        ],
        q = j * 7,
        r = quatRotateVec3(Array.from(model.subarray(q + 3, q + 7)), a);
      for (let k = 0; k < 3; k++) out[k] += w * (r[k] + model[q + k]);
    }
    return out;
  });
  const triangles = [];
  for (let i = 0; i < buf.indices.length; i += 3) {
    const ids = Array.from(buf.indices.subarray(i, i + 3));
    const covered = ids.every((j) => {
      const [x, y, z] = vertices[j],
        short = kind === 3,
        lo = short ? 0.72 : 0.03,
        hi = short ? 1.05 : 1.53;
      if (y < lo || y > hi) return false;
      const t = (y - lo) / (hi - lo),
        rx = (short ? 0.27 : 0.34 - 0.15 * t) + 0.01,
        rz = (short ? 0.18 : 0.25 - 0.09 * t) + 0.01;
      return (x * x) / (rx * rx) + (z * z) / (rz * rz) < 0.94;
    });
    if (covered) continue;
    const bind = ids.map((j) => Array.from(buf.positions.subarray(j * 3, j * 3 + 3))),
      n = ids
        .map((j) => Array.from(buf.normals.subarray(j * 3, j * 3 + 3)))
        .reduce((s, n) => s.map((v, k) => v + n[k]), [0, 0, 0]);
    if (normalFor(...bind).reduce((s, v, k) => s + v * n[k], 0) < 0)
      [ids[1], ids[2]] = [ids[2], ids[1]];
    triangles.push(ids.map((j) => vertices[j]));
  }
  cache.set(key, triangles);
  return triangles;
}
function robe(o, kind, d) {
  const n = d > 2 ? 24 : d > 1 ? 8 : 4,
    m = d > 2 ? 10 : d > 1 ? 3 : 2,
    short = kind === 3,
    top = short ? 1.05 : 1.53,
    bottom = short ? 0.72 : 0.03,
    rings = [];
  for (let j = 0; j <= m; j++) {
    const t = j / m,
      y = bottom + (top - bottom) * t,
      rx = short ? 0.27 : 0.34 - 0.15 * t,
      rz = short ? 0.18 : 0.25 - 0.09 * t;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2,
          fold =
            (d > 1 ? 0.027 : 0.01) *
            (Math.cos(10 * a + t * 1.2) + 0.3 * Math.cos(7 * a - 2 * t)) *
            (1 - 0.45 * t);
        return [
          (rx + fold) * Math.sin(a) + 0.025 * Math.sin(t * Math.PI),
          y,
          (rz + fold) * Math.cos(a) - 0.03 * (1 - t),
        ];
      }),
    );
  }
  loft(o, 'statue', rings, white);
  if (d > 1 && kind !== 3) {
    const rings = Array.from({ length: 6 }, (_, j) => {
      const t = j / 5;
      return radialRing(0.12 + t * 1.46, 0.1 + 0.03 * Math.sin(t * Math.PI), 0.13, n / 2, [
        -0.26,
        0.02 - 0.08 * t,
      ]);
    });
    loft(o, 'statue', rings, relief);
  }
}
function coarse(o, kind) {
  robe(o, kind, 1);
  loft(
    o,
    'statue',
    [
      radialRing(1.22, 0.19, 0.14, 4),
      radialRing(1.57, 0.3, 0.17, 4),
      radialRing(1.68, 0.1, 0.1, 4),
    ],
    white,
  );
  sphere(o, 'statue', [0, 1.85, 0.015], [0.13, 0.18, 0.13], white, 4, 2);
  for (const [sg, goal] of [
    [1, goals(kind)[0]],
    [-1, goals(kind)[1]],
  ]) {
    const shoulder = [sg * 0.25, 1.55, 0],
      elbow = [sg * 0.36, (1.55 + goal[1]) / 2, 0.12];
    tube(o, 'statue', shoulder, elbow, 0.065, white, 3);
    tube(o, 'statue', elbow, goal, 0.055, white, 3);
  }
  if (kind === 3)
    for (const x of [-0.12, 0.12])
      tube(o, 'statue', [x, 0.75, 0], [x, 0.03, 0.08], 0.075, white, 4);
}
function silhouette(o) {
  loft(o, 'statue', [radialRing(0, 0.19, 0.15, 3), radialRing(1.55, 0.26, 0.15, 3)], white);
  const r = [
    [0.14, 1.82, 0],
    [0, 1.82, 0.14],
    [-0.14, 1.82, 0],
    [0, 1.82, -0.14],
  ];
  for (let i = 0; i < 4; i++) {
    tri(o, [[0, 2.03, 0], r[i], r[(i + 1) % 4]]);
    tri(o, [[0, 1.54, 0], r[(i + 1) % 4], r[i]]);
  }
}
function attributes(o, kind, d) {
  if (!d) return;
  if (kind === 2) {
    loft(
      o,
      'statue',
      [
        [0.83, 0.08],
        [0.88, 0.13],
        [1.04, 0.15],
        [1.12, 0.09],
      ].map(([y, r]) => radialRing(y, r, r, d > 1 ? 12 : 6, [-0.05, 0.42])),
      white,
    );
    if (d > 1) tube(o, 'statue', [-0.05, 0.91, 0.54], [-0.13, 0.63, 0.67], 0.025, relief, 5);
  }
  if (kind === 3) {
    tube(o, 'statue', [0.29, 1.01, 0.28], [-0.34, 0.78, 0.42], 0.023, relief, d > 1 ? 7 : 4);
    box(o, 'statue', [-0.4, 0.75, 0.38], [-0.21, 0.86, 0.47], white);
    sphere(o, 'statue', [0.4, 0.26, 0.2], [0.13, 0.13, 0.32], white, d > 1 ? 10 : 6, 4);
    sphere(o, 'statue', [0.4, 0.4, 0.43], [0.1, 0.12, 0.13], white, d > 1 ? 10 : 6, 4);
    for (const z of [-0.01, 0.36])
      for (const x of [0.33, 0.47])
        tube(o, 'statue', [x, 0.25, z], [x, 0.03, z + 0.02], 0.025, white, 4);
    tube(o, 'statue', [0.42, 0.38, 0.43], [0.3, 1.02, 0.24], 0.014, relief, 4);
    if (d > 1) {
      loft(
        o,
        'statue',
        [radialRing(1.95, 0.145, 0.15, 12), radialRing(2.01, 0.1, 0.13, 12)],
        relief,
      );
      for (let i = 0; i < 4; i++)
        sphere(o, 'statue', [0.025, 2.04 + i * 0.04, -0.07], [0.025, 0.05, 0.09], white, 6, 3);
    }
  }
  if (kind === 4) {
    loft(
      o,
      'statue',
      [
        radialRing(1.94, 0.21, 0.2, d > 1 ? 12 : 6),
        radialRing(1.97, 0.21, 0.2, d > 1 ? 12 : 6),
        radialRing(2.05, 0.08, 0.1, d > 1 ? 12 : 6),
      ],
      white,
    );
  }
}
export function waterTowerStatue(out, index, d, position, angle) {
  const o = transformed(out, position, angle),
    kind = index % 5;
  if (!d) {
    silhouette(o);
    return;
  }
  if (d === 1) coarse(o, kind);
  else {
    for (const p of anatomy(kind, d)) tri(o, p);
    robe(o, kind, d);
  }
  attributes(o, kind, d);
}
