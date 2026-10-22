/** Complete photograph-directed historical marble monument, including static carved anatomy. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  evaluatePose,
  generateFigureBody,
  poseModelSpace,
  resolveFigureDescriptor,
  rigBindModel,
  solveTwoBoneIk,
} from '../../figures/dist/kernel.mjs';
import {
  quatConjugate,
  quatFromEuler,
  quatFromTo,
  quatMul,
  quatRotateVec3,
} from '../../kernel/dist/determinism.mjs';
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const plan = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../content/worldgen/source/places/dd/dds/statue_of_the_empress_josephine/plan-controls.json',
      import.meta.url,
    ),
  ),
);
const white = rgb('e3e0d6'),
  light = rgb('eeeae0'),
  relief = rgb('d1cdbf'),
  dark = rgb('313632'),
  iron = rgb('323b36');
const surfaces = {
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.94, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  plaque: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.88, metallic: 0.12 },
};
const ref = 'palette:#ffffff';
function tri(o, s, ps, col = white, normal) {
  if (normal && normalFor(...ps).reduce((v, a, i) => v + a * normal[i], 0) < 0)
    ps = [ps[0], ps[2], ps[1]];
  o.addTriangle(
    s,
    ref,
    ps,
    normalFor(...ps),
    ps.map((p) => [p[0], p[2]]),
    col,
  );
}
function B(o, s, x, y, z, w, h, dep, col = white) {
  box(o, s, [x - w / 2, y, z - dep / 2], [x + w / 2, y + h, z + dep / 2], col);
}
function square(y, w) {
  return [
    [-w / 2, y, w / 2],
    [w / 2, y, w / 2],
    [w / 2, y, -w / 2],
    [-w / 2, y, -w / 2],
  ];
}
function profile(o, s, levels, col = white) {
  loft(
    o,
    s,
    levels.map(([y, w]) => square(y, w)),
    col,
  );
}
function tubePath(o, s, points, r, col = white, n = 6) {
  let previousAcross;
  const rings = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    const axis = normalize(b.map((v, k) => v - a[k]));
    let u;
    if (previousAcross) {
      const dot = previousAcross.reduce((sum, x, k) => sum + x * axis[k], 0);
      u = normalize(previousAcross.map((x, k) => x - dot * axis[k]));
    } else u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]));
    previousAcross = u;
    const v = cross(axis, u);
    return Array.from({ length: n }, (_, j) =>
      p.map(
        (x, k) =>
          x + r * (Math.cos((j * 2 * Math.PI) / n) * u[k] + Math.sin((j * 2 * Math.PI) / n) * v[k]),
      ),
    );
  });
  // Curved cloth/iron tubes need a normal for each triangle, rather than a shared nonplanar quad normal.
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        d = rings[j][i];
      tri(o, s, [a, b, c], col);
      tri(o, s, [a, c, d], col);
    }
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n;
    tri(o, s, [points[0], rings[0][k], rings[0][i]], col);
    tri(o, s, [points.at(-1), rings.at(-1)[i], rings.at(-1)[k]], col);
  }
}

function pedestal(o, d) {
  profile(
    o,
    'base',
    [
      [-0.28, 3.5],
      [0.14, 3.5],
      [0.22, 3.28],
      [0.34, 3.28],
      [0.5, 2.96],
      [0.62, 2.96],
      [0.76, 2.48],
    ],
    white,
  );
  B(o, 'marble', 0, 0.73, 0, 2.22, 1.42, 2.22, white);
  profile(
    o,
    'marble',
    [
      [2.12, 2.28],
      [2.2, 2.45],
      [2.28, 2.45],
      [2.38, 2.8],
      [2.51, 2.8],
      [2.56, 2.55],
    ],
    light,
  );
  profile(
    o,
    'marble',
    [
      [2.55, 2.12],
      [2.65, 1.97],
      [2.98, 2.08],
      [3.04, 2.23],
      [3.12, 2.23],
    ],
    white,
  );
  loft(
    o,
    'marble',
    [
      radialRing(3.12, 0.83, 0.76, d === 0 ? 8 : 24),
      radialRing(3.24, 0.83, 0.76, d === 0 ? 8 : 24),
    ],
    light,
  );
  if (d === 0) {
    B(o, 'plaque', 0, 0.91, 1.118, 1.38, 0.94, 0.012, dark);
    return;
  }
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      P = (x, y, z) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
    const q = new Proxy(o, {
      get(t, k) {
        if (k === 'addQuad')
          return (s, m, ps, n, uv, c) =>
            t.addQuad(
              s,
              m,
              ps.map((p) => P(...p)),
              P(n[0], n[1], n[2]),
              uv,
              c,
            );
        const v = t[k];
        return typeof v === 'function' ? v.bind(t) : v;
      },
    });
    B(q, 'plaque', 0, 0.89, 1.12, 1.32, 1.02, 0.018, dark);
    for (const x of [-0.76, 0.76]) B(q, 'marble', x, 0.82, 1.15, 0.13, 1.2, 0.11, light);
    for (const y of [0.81, 1.99]) B(q, 'marble', 0, y, 1.15, 1.65, 0.1, 0.11, light);
    if (d > 1) {
      for (const x of [-0.96, 0.96]) B(q, 'marble', x, 0.79, 1.14, 0.11, 1.3, 0.08, relief);
      for (let j = 0; j < 7; j++)
        B(q, 'marble', -0.96 + j * 0.32, 2.26, 1.28, 0.11, 0.08, 0.1, relief);
    }
    const n = d === 1 ? 6 : d === 2 ? 12 : 22,
      points = Array.from({ length: n + 1 }, (_, j) => {
        const t = j / n;
        return P(
          -0.94 + 1.88 * t,
          2.96 - 0.3 * Math.sin(Math.PI * t),
          1.055 + 0.03 * Math.sin(Math.PI * t),
        );
      });
    tubePath(o, 'marble', points, d === 1 ? 0.055 : 0.07, light, d === 3 ? 6 : 4);
    if (d === 3) {
      for (let j = 0; j <= 18; j++) {
        const t = j / 18,
          p = P(-0.94 + 1.88 * t, 2.96 - 0.3 * Math.sin(Math.PI * t), 1.09);
        sphere(o, 'marble', p, [0.055, 0.043, 0.04], j % 2 ? white : relief, 6, 3);
      }
      for (const x of [-0.93, 0.93]) {
        const p = P(x, 2.97, 1.08);
        sphere(o, 'marble', p, [0.1, 0.1, 0.065], light, 8, 4);
      }
    }
  }
}
const anatomyCache = new Map();
function anatomy(d) {
  if (anatomyCache.has(d)) return anatomyCache.get(d);
  const body = generateFigureBody(
    resolveFigureDescriptor({
      preset: 'human.adult',
      height: 2.8,
      build: -0.2,
      features: {
        hair: 'none',
        hands: d === 3 ? 'fingers' : 'mitten',
        sleeves: 'none',
        legs: 'shorts',
      },
      proportions: { headScale: 0.87, shoulderWidth: 0.95, hipWidth: 1.05 },
      seed: 'statue_of_the_empress_josephine',
    }),
    d > 1 ? 0 : 1,
  );
  const pose = evaluatePose(
      body.rig,
      { mode: 'custom', speed: 0, strideRate: 0, phaseAt: 0, phaseAtTick: 0, modeAtTick: 0 },
      0,
      {
        tickRate: 60,
        overrides: { chest: quatFromEuler(0, -0.035, 0.025) },
      },
    ),
    model = poseModelSpace(pose),
    buf = body.buffers,
    bind = rigBindModel(body.rig);
  // The stock locomotion pole bends elbows behind the torso. The carved pose needs them outside/front.
  for (const [side, sign, goal] of [
    ['l', 1, [-0.035, 1.99, 0.34]],
    ['r', -1, [0.025, 1.96, 0.4]],
  ]) {
    const u = body.rig.index['upperArm.' + side],
      l = body.rig.index['foreArm.' + side],
      e = body.rig.index['hand.' + side];
    const upper = body.rig.joints[u],
      lower = body.rig.joints[l],
      end = body.rig.joints[e];
    const root = Array.from(model.subarray(u * 7, u * 7 + 3)),
      parent = Array.from(model.subarray(upper.parent * 7 + 3, upper.parent * 7 + 7));
    const solved = solveTwoBoneIk(
      root,
      goal,
      [sign, -0.8, 0.8],
      Math.hypot(...lower.bindPos),
      Math.hypot(...end.bindPos),
    );
    const upperModel = quatFromTo(normalize(lower.bindPos), solved.upperDir),
      lowerModel = quatFromTo(normalize(end.bindPos), solved.lowerDir);
    pose.local.set(quatMul(quatConjugate(parent), upperModel), u * 7 + 3);
    pose.local.set(quatMul(quatConjugate(upperModel), lowerModel), l * 7 + 3);
  }
  poseModelSpace(pose, model);
  const vertex = (i) => {
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
    return [out[0], out[1] + 3.24, out[2]];
  };
  const vertices = Array.from({ length: buf.vertexCount }, (_, i) => vertex(i)),
    segments = [];
  for (let j = 1; j < body.rig.joints.length; j++) {
    const p = body.rig.joints[j].parent;
    if (p >= 0)
      segments.push([
        Array.from(bind.subarray(p * 7, p * 7 + 3)),
        Array.from(bind.subarray(j * 7, j * 7 + 3)),
      ]);
  }
  const result = [];
  for (const g of buf.groups) {
    if (g.region !== 'skin') continue;
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const ids = Array.from(buf.indices.subarray(i, i + 3));
      // Only exposed arms/neck: dress covers the lower body; a directed carved head replaces the kernel head.
      if (
        ids.every((j) => buf.positions[j * 3 + 1] < 1.72) ||
        ids.some((j) => buf.positions[j * 3 + 1] > 2.43)
      )
        continue;
      const p = ids.map((j) => Array.from(buf.positions.subarray(j * 3, j * 3 + 3))),
        c = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);
      let near,
        dist = Infinity;
      for (const [a, b] of segments) {
        const axis = b.map((v, k) => v - a[k]),
          len = axis.reduce((s, x) => s + x * x, 0),
          t = len
            ? Math.max(0, Math.min(1, axis.reduce((s, x, k) => s + x * (c[k] - a[k]), 0) / len))
            : 0,
          q = a.map((x, k) => x + t * axis[k]),
          dd = q.reduce((s, x, k) => s + (x - c[k]) * (x - c[k]), 0);
        if (dd < dist) {
          dist = dd;
          near = q;
        }
      }
      if (normalFor(...p).reduce((s, x, k) => s + x * (c[k] - near[k]), 0) < 0)
        [ids[1], ids[2]] = [ids[2], ids[1]];
      result.push(ids.map((j) => vertices[j]));
    }
  }
  anatomyCache.set(d, result);
  return result;
}
function dress(o, d) {
  const n = [8, 20, 40, 72][d],
    m = [4, 9, 16, 28][d],
    rings = [];
  for (let j = 0; j <= m; j++) {
    const t = j / m,
      y = 1.86 * t,
      rx = 0.6 - 0.39 * t,
      rz = 0.4 - 0.22 * t,
      fold = [0.025, 0.045, 0.055, 0.06][d] * (1 - 0.6 * t);
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          f = fold * (Math.cos(16 * a + 1.5 * t) + 0.4 * Math.cos(9 * a - 2 * t)),
          s = Math.sin(a),
          c = Math.cos(a);
        return [
          0.045 * Math.sin(t * Math.PI) + (rx + f) * s,
          3.24 + y,
          (rz + f) * c - 0.07 * (1 - t),
        ];
      }),
    );
  }
  loft(o, 'marble', rings, white);
  // Fitted Empire bodice, broad low neckline and raised high waist seam.
  loft(
    o,
    'marble',
    [
      [1.79, 0.23, 0.19],
      [1.91, 0.24, 0.2],
      [2.06, 0.31, 0.225],
      [2.17, 0.28, 0.2],
    ].map(([y, x, z]) => radialRing(3.24 + y, x, z, d === 0 ? 8 : d === 1 ? 12 : 24)),
    light,
  );
  if (d > 0)
    loft(
      o,
      'marble',
      [radialRing(5.035, 0.245, 0.208, n), radialRing(5.085, 0.245, 0.208, n)],
      relief,
    );
  // Long left/back robe, fluted down its length; asymmetric skirt/train survives in every LOD.
  const train = [];
  for (let j = 0; j <= m; j++) {
    const t = j / m,
      y = 2.19 * t,
      x = -0.26 - 0.14 * (1 - t),
      z = -0.13 - 0.17 * (1 - t),
      width = 0.23 - 0.075 * t;
    train.push(
      Array.from({ length: d === 0 ? 6 : n / 2 }, (_, i) => {
        const a = (i * 2 * Math.PI) / (d === 0 ? 6 : n / 2),
          f = 0.035 * Math.cos(8 * a + 2 * t) * (1 - 0.3 * t);
        return [x + (width + f) * Math.sin(a), 3.24 + y, z + (0.21 + f) * Math.cos(a)];
      }),
    );
  }
  loft(o, 'marble', train, relief);
  for (const x of [-0.31, 0.31]) {
    sphere(
      o,
      'marble',
      [x, 5.405, -0.015],
      [0.15, 0.13, 0.16],
      light,
      d === 0 ? 6 : d === 1 ? 8 : 12,
      d > 1 ? 6 : 3,
    );
    if (d > 1)
      for (let k = 0; k < 3; k++) {
        const pts = Array.from({ length: 9 }, (_, j) => {
          const a = (j * Math.PI) / 8;
          return [x - 0.1 + 0.1 * k, 5.4 + 0.13 * Math.sin(a), -0.02 + 0.16 * Math.cos(a)];
        });
        tubePath(o, 'marble', pts, 0.012, relief, 4);
      }
  }
  // Gathered narrow right-side drape, falling from the hands into a rolled fabric loop.
  const pts = Array.from({ length: d > 1 ? 22 : 8 }, (_, j) => {
    const t = j / (d > 1 ? 21 : 7);
    return [0.08 + 0.53 * t, 5.22 - 1.0 * t, 0.29 - 0.03 * t + 0.04 * Math.sin(Math.PI * t)];
  });
  tubePath(o, 'marble', pts, d === 0 ? 0.06 : 0.045, white, d > 1 ? 8 : 4);
  if (d > 0) {
    const roll = Array.from({ length: d === 3 ? 29 : 13 }, (_, j) => {
      const t = j / (d === 3 ? 28 : 12),
        a = t * 2 * Math.PI;
      return [0.55 + 0.12 * Math.sin(a), 4.06 + 0.19 * Math.cos(a), 0.21 + 0.07 * Math.sin(a)];
    });
    tubePath(o, 'marble', roll, 0.08, white, d === 3 ? 8 : 4);
  }
}
function head(o, d) {
  const n = [6, 16, 32, 48][d],
    m = [5, 10, 18, 26][d],
    yaw = -0.36;
  const P = ([x, y, z]) => [
    x * Math.cos(yaw) + z * Math.sin(yaw),
    y + 3.24,
    -x * Math.sin(yaw) + z * Math.cos(yaw),
  ];
  const prof = [
    [2.34, 0.055, 0.06],
    [2.39, 0.082, 0.09],
    [2.43, 0.112, 0.125],
    [2.48, 0.14, 0.143],
    [2.55, 0.151, 0.151],
    [2.63, 0.154, 0.151],
    [2.7, 0.135, 0.13],
    [2.755, 0.095, 0.09],
    [2.775, 0.025, 0.025],
  ];
  const rings = [];
  for (let j = 0; j <= m; j++) {
    const y = 2.34 + ((2.775 - 2.34) * j) / m;
    let k = 0;
    while (k < prof.length - 2 && prof[k + 1][0] < y) k++;
    const t = (y - prof[k][0]) / (prof[k + 1][0] - prof[k][0]),
      rx = prof[k][1] * (1 - t) + prof[k + 1][1] * t,
      rz = prof[k][2] * (1 - t) + prof[k + 1][2] * t;
    rings.push(
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n,
          s = Math.sin(a),
          c = Math.cos(a),
          front = Math.max(0, c),
          x = rx * s;
        const nose = 0.067 * Math.exp(-Math.pow((y - 2.565) / 0.055, 2)) * Math.pow(front, 28),
          mouth = 0.018 * Math.exp(-Math.pow((y - 2.465) / 0.018, 2)) * Math.pow(front, 18),
          eyes =
            0.018 *
            Math.exp(-Math.pow((y - 2.622) / 0.021, 2)) *
            (Math.exp(-Math.pow((x - 0.058) / 0.024, 2)) +
              Math.exp(-Math.pow((x + 0.058) / 0.024, 2))) *
            Math.pow(front, 8);
        return P([x, y, rz * c + nose + mouth - eyes]);
      }),
    );
  }
  loft(o, 'marble', rings, light);
  loft(
    o,
    'marble',
    [
      radialRing(5.43, 0.08, 0.085, d === 0 ? 6 : 12),
      radialRing(5.66, 0.075, 0.08, d === 0 ? 6 : 12),
    ],
    white,
  );
  if (d === 0) return;
  for (const x of [-0.15, 0.15])
    sphere(o, 'marble', P([x, 2.59, -0.01]), [0.035, 0.06, 0.035], white, d === 3 ? 10 : 6, 4);
  // Carved curls and wreath follow the head; no colored pupils or painted portrait features.
  sphere(
    o,
    'marble',
    P([0, 2.72, -0.045]),
    [0.145, 0.08, 0.125],
    relief,
    d === 3 ? 16 : 10,
    d === 3 ? 6 : 4,
  );
  const count = d === 1 ? 8 : d === 2 ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      p = P([0.133 * Math.sin(a), 2.735 + 0.025 * Math.cos(a), 0.13 * Math.cos(a)]);
    sphere(o, 'marble', p, [0.04, 0.038, 0.038], i % 2 ? white : light, d === 3 ? 8 : 6, 3);
  }
  if (d > 1) {
    for (let i = 0; i < 6; i++)
      sphere(
        o,
        'marble',
        P([0.1 * Math.sin(i * 1.6), 2.72 + 0.03 * (i % 2), -0.11 - 0.018 * i]),
        [0.06, 0.045, 0.045],
        white,
        8,
        4,
      );
    for (const sign of [-1, 1]) {
      const lid = Array.from({ length: 7 }, (_, j) =>
        P([
          sign * 0.06 - 0.028 + (j * 0.056) / 6,
          2.626 + 0.012 * Math.sin((j * Math.PI) / 6),
          0.143,
        ]),
      );
      tubePath(o, 'marble', lid, 0.006, relief, 4);
    }
  }
}
function fence(o, d) {
  const half = 3.3,
    y0 = 0.05,
    y1 = 1.05;
  // Intrinsic enclosure curb only: no park paving slab or added terrain platform.
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      P = (x, y, z) => [Math.cos(a) * x + Math.sin(a) * z, y, -Math.sin(a) * x + Math.cos(a) * z];
    beam(o, 'base', P(-half, -0.16, half), P(half, -0.16, half), 0.24, 0.24, relief);
    const count = d === 0 ? 4 : 6;
    beam(o, 'iron', P(-half, y1, half), P(half, y1, half), 0.045, 0.045, iron);
    if (d > 0) beam(o, 'iron', P(-half, 0.22, half), P(half, 0.22, half), 0.045, 0.045, iron);
    for (let j = 0; j <= count; j++) {
      const x = -half + (j * 2 * half) / count;
      beam(
        o,
        'iron',
        P(x, y0, half),
        P(x, y1 + 0.06, half),
        d === 0 ? 0.04 : 0.035,
        d === 0 ? 0.04 : 0.035,
        iron,
      );
      if (d > 1) sphere(o, 'iron', P(x, y1 + 0.09, half), [0.04, 0.065, 0.04], iron, 6, 3);
      if (j === count || d === 0) continue;
      const width = (2 * half) / count,
        cx = x + width / 2;
      if (d === 1) {
        for (const s of [-1, 1])
          beam(
            o,
            'iron',
            P(cx, 0.25, half),
            P(cx + s * width * 0.46, 1.02, half),
            0.025,
            0.025,
            iron,
          );
        continue;
      }
      // Mirrored open scrolls and diagonal stems in each photographed ornamental panel.
      for (const sign of [-1, 1]) {
        const n = d === 3 ? 20 : 10,
          pts = Array.from({ length: n + 1 }, (_, k) => {
            const t = k / n,
              ang = 0.15 + t * 2 * Math.PI * 1.22,
              r = 0.24 * (1 - 0.8 * t);
            return P(cx + sign * (0.23 + r * Math.cos(ang)), 0.8 + r * Math.sin(ang), half);
          });
        tubePath(o, 'iron', pts, 0.018, iron, d === 3 ? 6 : 4);
        beam(o, 'iron', P(cx, 0.26, half), P(cx + sign * 0.45, 0.99, half), 0.024, 0.024, iron);
        if (d === 3) {
          const lo = Array.from({ length: 17 }, (_, k) => {
            const t = k / 16,
              a = t * 2 * Math.PI * 1.2,
              r = 0.16 * (1 - 0.75 * t);
            return P(cx + sign * (0.18 + r * Math.cos(a)), 0.35 + r * Math.sin(a), half);
          });
          tubePath(o, 'iron', lo, 0.015, iron, 4);
        }
      }
    }
  }
}
function build(o, _frame, d = 3) {
  pedestal(o, d);
  dress(o, d);
  for (const ps of anatomy(d)) tri(o, 'marble', ps);
  head(o, d);
  fence(o, d);
}
export const josephineSkyline = (o, f) => build(o, f, 0);
export const josephineDistrict = (o, f) => build(o, f, 1);
export const josephineStreet = (o, f) => build(o, f, 2);
export const josephineModel = {
  id: 'statue_of_the_empress_josephine',
  key: 'statue_of_the_empress_josephine',
  recipe: 'structure-statue-of-the-empress-josephine.mjs',
  cell: 'dd/dds',
  title: 'Statue of the Empress Joséphine (1899)',
  category: 'monument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  appearance: plan.appearance,
  brief:
    'Complete historical1899marble Josephine monument: intact head turned aside beneath carved curls/wreath, coherently posed exposed arms/hands gathered in front, fitted low-necked Empire bodice/puffed sleeves, fluted floor-length gown and asymmetric long draped robe/rolled side cloth. Stepped square paneled pedestal with dark plaques, raised moldings/cornice, upper festoons and low ornamental iron scroll enclosure. Exact native demolished-monument point anchors location; estimated photographic dimensions/bearing/hidden sculpture. Historical1899only; excluded from present.',
  camera: [9.8, 7.0, 12.0],
  lookAt: [0, 2.9, 0],
  portableGroundY: 0,
  mediumFiContext: { scale: 0.35 },
  qaCameras: [
    {
      name: 'intact-turned-head-gathered-arms-and-folded-dress',
      position: [2.4, 5.7, 4.2],
      lookAt: [0, 4.75, 0],
    },
    {
      name: 'decorated-pedestal-festoons-and-iron-scrollwork',
      position: [4.6, 3.2, 6],
      lookAt: [0, 1.75, 0],
    },
    { name: 'rear-long-robe-and-full-monument', position: [-7, 5.8, -8], lookAt: [0, 3, 0] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  groundContactBasis:
    plan.geometryBasis +
    ' Fixed southern approach datum is approximate; current park relief is not an1899grade survey.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-statue-of-the-empress-josephine.mjs',
    level: 'skyline',
    export: 'josephineSkyline',
    errorMeters: 0.28,
    surfaces,
    authoredLevels: {
      district: { export: 'josephineDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'josephineStreet', errorMeters: 0.025, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    'Historical1899intact appearance only. The local story records1991beheading and2020toppling; native point is tagged demolished. Explicit1899-01-01to1900-01-01appearance interval represents only the dated photograph year. No current-world statue, later paint or beheaded state is inferred.',
    'Estimated3.5mpedestal foot/3.24mupper base,2.8mfigure and6.6miron enclosure; no measured survey or documented original bearing. Hidden back, exact anatomy/fingers, fine facial/floral carving, lettering and iron scroll repeats are bounded original medium-fi interpretations. The complete visible pose, intact head/wreath, fluted gown/asymmetric robe, decorated pedestal and enclosure are included; no pedestal-only substitute.',
    'Exposed anatomy is deterministically posed/baked from the public Molen figures kernel, with original photo-directed cloth, carved head/nose/eyelid contours/curls and marble ornament geometry. No runtime actor, imported sculpture, photo pixels or photographic texture. Neutral warm marble/dark iron palette is inferred from monochrome evidence.',
    'Exact1200x1608published Qualla1899Salles/BNF/Gallicaoriginal controls the appearance. Source native SHA1and explicit expired-copyright releases are recorded. Anonymous/unrelated and modern attribution photographs unused. Palm trees, spiral lamp, park vegetation/roads/paving, people and neighboring buildings excluded.',
    'Intrinsic narrow enclosure curb is retained; no whole-site platform or terrain flattening. Fixed southern approach point was chosen before terrain acquisition. Footing extends.28m beneath approximate datum; exact1899grade/foundation/host-terrain contact remain unverified. Wreath curls/face, cloth folds, pedestal relief and fence scroll detail simplify with distance.',
  ],
};
