/** NYSE1903 block: photo-directed dual colonnades, graded podium and figurative pediment. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import nativeFrame from '../../../content/worldgen/source/places/dr/dr5/new_york_stock_exchange/map-frame.json' with {
  type: 'json',
};
import {
  evaluatePose,
  generateFigureBody,
  poseModelSpace,
  resolveFigureDescriptor,
  rigBindModel,
} from '../../figures/dist/kernel.mjs';
import { quatFromEuler, quatRotateVec3 } from '../../kernel/dist/determinism.mjs';
import { simplifyStaticSculpture } from '../../tooling/scripts/static-sculpture-lod.mjs';
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff',
  marble = rgb('d7d2c4'),
  pale = rgb('e1ddd0'),
  carving = rgb('c9c7ba'),
  stone = rgb('b3b4ac'),
  bronze = rgb('514d40'),
  glass = rgb('35484a'),
  iron = rgb('454b46'),
  roof = rgb('92958c'),
  gold = rgb('c9b47c'),
  cache = new Map();
const state = {
  mode: 'custom',
  speed: 0,
  strideRate: 0,
  phaseAt: 0,
  phaseAtTick: 0,
  modeAtTick: 0,
};
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    p = (q) => {
      const r = v(q);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, q, n, u, col) => o.addTriangle(s, r, q.map(p), v(n), u, col),
    addQuad: (s, r, q, n, u, col) => o.addQuad(s, r, q.map(p), v(n), u, col),
    addConvexPolygon: (s, r, q, n, u, col) => {
      const pp = q.map(p),
        uv = q.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], col);
    },
  };
}
function face(o, s, x, y, z, w, h, col) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    col,
  );
}
function tri(o, s, p, col) {
  o.addTriangle(
    s,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[1]]),
    col,
  );
}
function polygon(o, s, ring, y, col, up = true) {
  const idx = earcut(ring.flat());
  for (let i = 0; i < idx.length; i += 3) {
    const q = [idx[i], idx[i + 1], idx[i + 2]].map((k) => [ring[k][0], y, ring[k][1]]);
    if (up) q.reverse();
    o.addTriangle(
      s,
      ref,
      q,
      [0, up ? 1 : -1, 0],
      q.map((p) => [p[0], p[2]]),
      col,
    );
  }
}
function line(o, s, a, b, w, col, d) {
  if (d === 3) beam(o, s, a, b, w, w, col);
  else {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy),
      v = [((-dy / l) * w) / 2, ((dx / l) * w) / 2, 0];
    quad(
      o,
      s,
      [
        a.map((n, i) => n - v[i]),
        b.map((n, i) => n - v[i]),
        b.map((n, i) => n + v[i]),
        a.map((n, i) => n + v[i]),
      ],
      [0, 0, 1],
      col,
    );
  }
}
function staticSkin(body, pose, k, offsetY, headAxis, exclude = []) {
  const buf = body.buffers,
    model = poseModelSpace(pose);
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
      for (let t = 0; t < 3; t++) out[t] += w * (r[t] + model[q + t]);
    }
    return [out[0] * k, out[1] * k + offsetY, out[2] * k];
  };
  const vertices = Array.from({ length: buf.vertexCount }, (_, i) => vertex(i)),
    triangles = [];
  // Static export uses glTF front faces. Orient closed body surfaces away from the bind skeleton.
  const bind = rigBindModel(body.rig),
    segments = [];
  for (let j = 1; j < body.rig.joints.length; j++) {
    const parent = body.rig.joints[j].parent;
    if (parent >= 0)
      segments.push([
        Array.from(bind.subarray(parent * 7, parent * 7 + 3)),
        Array.from(bind.subarray(j * 7, j * 7 + 3)),
      ]);
  }
  const hj = body.rig.index.head * 7,
    hp = Array.from(bind.subarray(hj, hj + 3));
  segments.push([hp, hp.map((v, i) => v + headAxis[i])]);
  const outward = (ids) => {
    const p = ids.map((i) => Array.from(buf.positions.subarray(i * 3, i * 3 + 3))),
      c = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + p[2][k]) / 3);
    let near,
      dist = Infinity;
    for (const [a, b] of segments) {
      const axis = b.map((v, i) => v - a[i]),
        length = axis.reduce((s, x) => s + x * x, 0),
        t = length
          ? Math.max(0, Math.min(1, axis.reduce((s, x, i) => s + x * (c[i] - a[i]), 0) / length))
          : 0,
        q = a.map((v, i) => v + t * axis[i]),
        dd = q.reduce((s, x, i) => s + (x - c[i]) * (x - c[i]), 0);
      if (dd < dist) {
        dist = dd;
        near = q;
      }
    }
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]),
      n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return n.reduce((s, x, i) => s + x * (c[i] - near[i]), 0) >= 0;
  };
  for (const g of buf.groups) {
    if (exclude.includes(g.region)) continue;
    for (let i = g.start; i < g.start + g.count; i += 3) {
      const ids = Array.from(buf.indices.subarray(i, i + 3));
      if (!outward(ids)) [ids[1], ids[2]] = [ids[2], ids[1]];
      triangles.push(ids.map((j) => vertices[j]));
    }
  }
  return {
    triangles,
    joints: Object.fromEntries(
      Object.entries(body.rig.index).map(([name, j]) => [
        name,
        [model[j * 7] * k, model[j * 7 + 1] * k + offsetY, model[j * 7 + 2] * k],
      ]),
    ),
  };
}
function figureGeometry(d, kind) {
  const key = `${d}:${kind}`;
  if (cache.has(key)) return cache.get(key);
  const female = kind === 'integrity' || kind === 'wife',
    seated = ['farmer', 'mechanic', 'mining', 'science', 'child-l', 'child-r'].includes(kind),
    reclined = kind === 'left-end' || kind === 'right-end',
    H = kind.startsWith('child') ? 1.8 : 4.5,
    descriptor = resolveFigureDescriptor({
      preset: 'human.adult',
      height: H,
      build: female ? -0.12 : 0.1,
      features: {
        hair: 'none',
        hands: d === 3 ? 'fingers' : 'mitten',
        sleeves: 'none',
        legs: 'shorts',
      },
      proportions: {
        headScale: kind.startsWith('child') ? 1.1 : 0.87,
        shoulderWidth: female ? 0.96 : 1.08,
        hipWidth: female ? 1.07 : 0.96,
      },
      seed: 'new_york_stock_exchange',
    }),
    body = generateFigureBody(descriptor, d === 3 ? 0 : 1),
    ik = {};
  if (kind === 'integrity') {
    ik['hand.l'] = [H * 0.41, H * 0.76, H * 0.06];
    ik['hand.r'] = [-H * 0.41, H * 0.76, H * 0.06];
  } else if (kind === 'wife') {
    ik['hand.l'] = [H * 0.27, H * 0.66, H * 0.15];
    ik['hand.r'] = [-H * 0.25, H * 0.48, H * 0.19];
  } else {
    ik['hand.l'] = [H * 0.18, H * 0.5, H * 0.28];
    ik['hand.r'] = [-H * 0.25, H * 0.4, H * 0.2];
  }
  const overrides = {
    chest: quatFromEuler(
      seated ? -0.15 : reclined ? -0.35 : 0,
      0,
      kind === 'wife' ? 0.12 : kind === 'power' ? -0.12 : 0,
    ),
    head: quatFromEuler(0.05, kind === 'farmer' ? 0.2 : kind === 'mechanic' ? -0.25 : 0, 0),
  };
  if (seated || reclined) {
    overrides['upperLeg.l'] = quatFromEuler(-1.1, 0, -0.22);
    overrides['upperLeg.r'] = quatFromEuler(-0.9, 0, 0.25);
    overrides['lowerLeg.l'] = quatFromEuler(1.6, 0, 0);
    overrides['lowerLeg.r'] = quatFromEuler(1.45, 0, 0);
  }
  const pose = evaluatePose(body.rig, state, 0, {
      tickRate: 60,
      ik,
      overrides,
      ...(seated || reclined ? { anchor: 'pelvis' } : {}),
    }),
    b = staticSkin(body, pose, 1, 0, [0, body.rig.metrics.headLen, 0], ['eyes', 'brow', 'hair']),
    rot = reclined ? (kind === 'left-end' ? -1 : 1) * 1.0 : 0,
    c = Math.cos(rot),
    s = Math.sin(rot),
    transform = (p) => [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]],
    t = b.triangles.map((q) => q.map(transform)),
    ys = t.flat().map((p) => p[1]),
    lo = Math.min(...ys),
    hi = Math.max(...ys),
    heights = {
      integrity: 4.8768,
      'child-l': 1.6,
      'child-r': 1.7,
      farmer: 3.5,
      wife: 3.8,
      mechanic: 3.6,
      power: 3.55,
      mining: 2.65,
      science: 2.7,
      'left-end': 1.45,
      'right-end': 1.5,
    },
    scale = heights[kind] / (hi - lo),
    result = {
      triangles: t.map((q) =>
        q.map((p) => [p[0] * scale, (p[1] - lo) * scale, p[2] * scale * 0.62]),
      ),
      height: heights[kind],
    };
  if (d === 2) result.triangles = simplifyStaticSculpture(result.triangles, 400, 0.08);
  cache.set(key, result);
  return result;
}
function unfittedStatue(o, x, kind, d) {
  const y = 31.1,
    z = 0.28;
  if (d < 2) {
    const H = {
        integrity: 4.88,
        'child-l': 1.6,
        'child-r': 1.7,
        farmer: 3.5,
        wife: 3.8,
        mechanic: 3.6,
        power: 3.55,
        mining: 2.65,
        science: 2.7,
        'left-end': 1.45,
        'right-end': 1.5,
      }[kind],
      w = kind.includes('end') ? 2.0 : kind === 'integrity' ? 1.3 : 0.92;
    if (d === 0) {
      tri(
        o,
        'marble',
        [
          [x - w / 2, y, z],
          [x + w / 2, y, z],
          [x, y + H * 0.85, z],
        ],
        carving,
      );
      tri(
        o,
        'marble',
        [
          [x - 0.2, y + H * 0.75, z],
          [x + 0.2, y + H * 0.75, z],
          [x, y + H, z],
        ],
        carving,
      );
      if (kind === 'integrity')
        for (const sign of [-1, 1])
          tri(
            o,
            'marble',
            [
              [x, y + 3.4, z],
              [x + sign * 2, y + 3.8, z],
              [x + sign * 0.6, y + 3, z],
            ],
            carving,
          );
      return;
    }
    loft(
      o,
      'marble',
      [
        radialRing(y, w * 0.45, 0.25, 4, [x, z]),
        radialRing(y + H * 0.55, w * 0.35, 0.3, 4, [x, z]),
        radialRing(y + H * 0.8, w * 0.28, 0.23, 4, [x, z]),
      ],
      carving,
    );
    sphere(o, 'marble', [x, y + H * 0.9, z], [H * 0.09, H * 0.1, 0.2], carving, 4, 3);
    if (kind === 'integrity')
      for (const sign of [-1, 1])
        beam(
          o,
          'marble',
          [x + sign * 0.45, y + H * 0.72, z],
          [x + sign * 1.8, y + H * 0.81, z + 0.1],
          0.22,
          0.25,
          carving,
        );
    return;
  }
  const b = figureGeometry(d, kind);
  for (const q of b.triangles)
    tri(
      o,
      'marble',
      q.map((p) => [p[0] + x, p[1] + y, p[2] + z]),
      carving,
    );
  if (['integrity', 'wife', 'farmer'].includes(kind)) {
    const H = b.height,
      n = d === 3 ? 32 : 12,
      rings = [0, 0.45, 0.7].map((t) =>
        Array.from({ length: n }, (_, i) => {
          const a = (-i * Math.PI * 2) / n,
            r = (0.48 - (0.23 * t) / 0.7) * (1 + (d === 3 ? 0.1 : 0.04) * Math.cos(a * 12));
          return [x + r * Math.cos(a), y + 0.05 + H * t, z + r * 0.65 * Math.sin(a) + 0.03];
        }),
      );
    loft(o, 'marble', rings, pale);
  }
}
/** Keep every complete posed figure below both slopes of the pediment cornice. */
export function newYorkStockExchangePedimentStatue(o, x, kind, d) {
  const calls = [],
    collector = Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((name) => [
        name,
        (...args) => calls.push({ name, args }),
      ]),
    ),
    origin = [x, 31.1, 0.28],
    slope = (37.4 - 30.65) / 16.7;
  unfittedStatue(collector, x, kind, d);
  let scale = 1;
  for (const { args } of calls)
    for (const p of args[2])
      for (const sign of [-1, 1]) {
        const rise = p[1] - origin[1] + sign * slope * (p[0] - x),
          room = 37.4 - 0.6 - origin[1] - sign * slope * x;
        if (rise > 0) scale = Math.min(scale, room / rise);
      }
  if (!(scale > 0)) throw new Error(`No pediment clearance for ${kind}`);
  for (const { name, args } of calls) {
    args[2] = args[2].map((p) => p.map((v, i) => origin[i] + (v - origin[i]) * scale));
    o[name](...args);
  }
}
function leaf(o, x, y, z, a, d) {
  const c = Math.cos(a),
    s = Math.sin(a),
    p = (u, v, t) => [x + c * u + s * t, y + v, z - s * u + c * t],
    w = 0.25,
    h = 0.75,
    q = [
      p(-w, 0, 0),
      p(w, 0, 0),
      p(w * 0.65, h * 0.7, 0.15),
      p(0, h, 0.26),
      p(-w * 0.65, h * 0.7, 0.15),
    ],
    center = p(0, h * 0.42, 0.18);
  for (let i = 0; i < q.length; i++)
    tri(o, 'marble', [q[i], q[(i + 1) % q.length], center], carving);
  if (d === 3)
    for (let i = 0; i < q.length; i++)
      tri(o, 'marble', [q[(i + 1) % q.length], q[i], p(0, h * 0.42, 0.06)], marble);
}
function column(o, x, z, d, fluted = true) {
  const y = 11.3,
    H = 16.002,
    n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? (fluted ? 48 : 16) : fluted ? 144 : 32,
    r = 0.8382;
  const ring = (yy, rr) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n,
        f = fluted && d >= 2 ? 1 - 0.035 * (1 + Math.cos(a * 24)) : 1;
      return [x + rr * f * Math.cos(a), yy, z + rr * f * Math.sin(a)];
    });
  loft(o, 'marble', [ring(y + 0.55, r), ring(y + H - 1.45, r * 0.86)], marble);
  const k = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 24;
  const baseProfile =
    d === 0
      ? [
          [y, 1.08],
          [y + 0.55, r],
        ]
      : d === 1
        ? [
            [y, 1.08],
            [y + 0.2, 1.08],
            [y + 0.55, r],
          ]
        : d === 2
          ? [
              [y, 1.08],
              [y + 0.16, 1.08],
              [y + 0.48, 0.97],
              [y + 0.55, r],
            ]
          : [
              [y, 1.08],
              [y + 0.16, 1.08],
              [y + 0.32, 0.96],
              [y + 0.48, 0.97],
              [y + 0.55, r],
            ];
  loft(
    o,
    'marble',
    baseProfile.map(([yy, rr]) => radialRing(yy, rr, rr, k, [x, z])),
    pale,
  );
  const capProfile =
    d < 2
      ? [
          [y + H - 1.45, r * 0.86],
          [y + H, 1.18],
        ]
      : [
          [y + H - 1.45, r * 0.86],
          [y + H - 0.9, 0.94],
          [y + H - 0.35, 1.18],
          [y + H, 1.18],
        ];
  loft(
    o,
    'marble',
    capProfile.map(([yy, rr]) => radialRing(yy, rr, rr, k, [x, z])),
    marble,
  );
  if (d) {
    const count = d === 1 ? 4 : d === 2 ? 8 : 12;
    for (let tier = 0; tier < (d === 1 ? 1 : 2); tier++)
      for (let i = 0; i < count; i++) {
        const a = ((i + 0.5 * tier) * Math.PI * 2) / count,
          rr = tier ? 1.02 : 0.85;
        leaf(o, x + rr * Math.sin(a), y + H - 1.48 + tier * 0.5, z + rr * Math.cos(a), a, d);
      }
    if (d >= 2)
      for (const sign of [-1, 1]) {
        const cx = x + sign * 0.72,
          cy = y + H - 0.32;
        let previous;
        for (let i = 0; i <= 10; i++) {
          const t = (i / 10) * Math.PI * 3,
            rr = 0.22 * (1 - i / 13),
            p = [cx + rr * Math.cos(t), cy + rr * Math.sin(t), z + 1.27];
          if (previous) line(o, 'marble', previous, p, 0.08, pale, d);
          previous = p;
        }
      }
  }
}
function archWindow(o, x, y, z, w, h, d) {
  const r = w / 2,
    spring = y + h - r,
    n = [3, 5, 10, 18][d];
  face(o, 'glass', x, y, z, w, h - r, glass);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n,
      b = ((i + 1) * Math.PI) / n;
    tri(
      o,
      'glass',
      [
        [x, spring, z],
        [x + r * Math.cos(a), spring + r * Math.sin(a), z],
        [x + r * Math.cos(b), spring + r * Math.sin(b), z],
      ],
      glass,
    );
    if (d) {
      const pt = (t, rr) => [x + rr * Math.cos(t), spring + rr * Math.sin(t), z + 0.12];
      quad(o, 'marble', [pt(a, r), pt(a, r + 0.14), pt(b, r + 0.14), pt(b, r)], [0, 0, 1], marble);
    }
  }
  if (d) {
    for (const sign of [-1, 1]) face(o, 'bronze', x + sign * r, y, z + 0.08, 0.055, h - r, bronze);
    face(o, 'bronze', x, spring, z + 0.08, w, 0.06, bronze);
    if (d >= 2) face(o, 'bronze', x, y, z + 0.09, 0.06, h, bronze);
  }
}
function balustrade(o, w, y, z, d, metal = false) {
  const slot = metal ? 'iron' : 'marble',
    col = metal ? iron : pale;
  if (!d) {
    face(o, slot, 0, y + 0.6, z, w, 0.14, col);
    return;
  }
  for (const yy of [0, 0.82]) {
    if (d === 3) B(o, slot, 0, y + yy, z, w, 0.13, 0.25, col);
    else face(o, slot, 0, y + yy, z, w, 0.12, col);
  }
  const count = Math.max(2, Math.floor(w / (d === 1 ? 0.68 : metal ? 0.38 : 0.26)));
  for (let i = 0; i <= count; i++) {
    const x = -w / 2 + (i * w) / count;
    if (d === 3 && !metal)
      loft(
        o,
        'marble',
        [
          [y + 0.13, 0.055],
          [y + 0.32, 0.1],
          [y + 0.5, 0.06],
          [y + 0.82, 0.05],
        ].map(([yy, r]) => radialRing(yy, r, r, 6, [x, z])),
        pale,
      );
    else face(o, slot, x, y + 0.12, z, 0.07, 0.7, col);
  }
}
const glyph = {
  N: [
    [
      [0, 0],
      [0, 1],
      [0.7, 0],
      [0.7, 1],
    ],
  ],
  E: [
    [
      [0.7, 0],
      [0, 0],
      [0, 1],
      [0.7, 1],
    ],
    [
      [0, 0.5],
      [0.55, 0.5],
    ],
  ],
  W: [
    [
      [0, 1],
      [0.16, 0],
      [0.4, 0.62],
      [0.64, 0],
      [0.8, 1],
    ],
  ],
  Y: [
    [
      [0, 1],
      [0.4, 0.5],
      [0.8, 1],
    ],
    [
      [0.4, 0.5],
      [0.4, 0],
    ],
  ],
  O: [
    [
      [0.12, 0],
      [0, 0.2],
      [0, 0.8],
      [0.12, 1],
      [0.6, 1],
      [0.72, 0.8],
      [0.72, 0.2],
      [0.6, 0],
      [0.12, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
      [0.72, 0.8],
      [0.6, 0.55],
      [0, 0.55],
    ],
    [
      [0.3, 0.55],
      [0.75, 0],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.75, 1],
      [0, 0.45],
      [0.75, 0],
    ],
  ],
  S: [
    [
      [0.72, 0.95],
      [0.12, 1],
      [0, 0.8],
      [0.1, 0.6],
      [0.62, 0.4],
      [0.72, 0.2],
      [0.6, 0],
      [0, 0.05],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.8, 1],
    ],
    [
      [0.4, 1],
      [0.4, 0],
    ],
  ],
  C: [
    [
      [0.72, 0.9],
      [0.6, 1],
      [0.15, 1],
      [0, 0.8],
      [0, 0.2],
      [0.15, 0],
      [0.7, 0],
    ],
  ],
  X: [
    [
      [0, 0],
      [0.75, 1],
    ],
    [
      [0, 1],
      [0.75, 0],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.75, 0],
      [0.75, 1],
    ],
    [
      [0, 0.5],
      [0.75, 0.5],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.38, 1],
      [0.76, 0],
    ],
    [
      [0.18, 0.42],
      [0.58, 0.42],
    ],
  ],
  G: [
    [
      [0.72, 0.88],
      [0.55, 1],
      [0.15, 1],
      [0, 0.8],
      [0, 0.2],
      [0.15, 0],
      [0.72, 0],
      [0.72, 0.48],
      [0.42, 0.48],
    ],
  ],
};
function inscription(o, d) {
  if (d < 2) return;
  const text = 'NEW YORK STOCK EXCHANGE',
    cw = 0.69,
    total = text.length * cw;
  for (let i = 0; i < text.length; i++)
    for (const path of glyph[text[i]] ?? [])
      for (let j = 1; j < path.length; j++) {
        const pt = (p) => [-total / 2 + i * cw + p[0] * 0.72, 28.65 + p[1] * 0.57, 0.81];
        line(o, 'bronze', pt(path[j - 1]), pt(path[j]), 0.038, gold, d);
      }
}
function podium(o, w, d, rear = false) {
  const y0 = -1.2;
  // Documentary street slope changes the exposed basement height; no terrain is modified.
  face(o, 'marble', 0, y0, -0.25, w, 12.5, marble);
  const count = 7,
    pitch = 4.65;
  for (let i = 0; i < count; i++) {
    const x = (i - 3) * pitch,
      threshold = (rear ? 1.9 : 0.2) + x * 0.036;
    archWindow(o, x, 6.3, -0.12, 1.7, 3.25, d);
    if (d) {
      const r = 0.85,
        spring = 8.7,
        top = 11.3,
        n = d === 1 ? 3 : d === 2 ? 10 : 18,
        pw = (pitch - 1.7) / 2;
      for (const sign of [-1, 1])
        face(o, 'marble', x + sign * (r + pw / 2), 5.5, 0, pw, top - 5.5, marble);
      face(o, 'marble', x, 5.5, 0, 1.7, 0.8, marble);
      for (let j = 0; j < n; j++) {
        const a = (j * Math.PI) / n,
          b = ((j + 1) * Math.PI) / n,
          A = [x + r * Math.cos(a), spring + r * Math.sin(a), 0],
          B1 = [x + r * Math.cos(b), spring + r * Math.sin(b), 0];
        quad(o, 'marble', [B1, A, [A[0], top, 0], [B1[0], top, 0]], [0, 0, 1], marble);
      }
    }
    if (!rear) {
      face(o, 'glass', x, threshold, 0.014, 2.2, 4.9 - threshold, glass);
      if (i === 2 || i === 3) face(o, 'marble', x, threshold, 0.03, 2.2, 4.9 - threshold, marble);
    }
    if (d) {
      if (d === 1) face(o, 'marble', x, 5.28, 1.2, 3.1, 0.2, pale);
      else B(o, 'marble', x, 5.28, 0.45, 3.1, 0.2, 1.5, pale);
      balustrade(facing(o, 0, x, 1.12), 2.9, 5.48, 0, d);
      if (d >= 2)
        for (const sign of [-1, 1]) {
          B(o, 'marble', x + sign * 1.04, 4.4, 0.31, 0.36, 0.9, 0.74, marble);
          if (d === 3)
            sphere(o, 'marble', [x + sign * 1.04, 4.9, 0.67], [0.22, 0.24, 0.2], carving, 8, 5);
        }
      B(o, 'marble', x, 9.45, 0.04, 0.4, 0.5, 0.32, carving);
    }
  }
  if (rear) {
    const x = 3 * pitch;
    face(o, 'glass', x, 3.0, 0.015, 2.0, 2.7, glass);
  }
  face(o, 'granite', 0, y0, 0.01, w, 1.5, stone);
  for (const [y, h, depth] of [
    [10.8, 0.2, 0.3],
    [11.08, 0.22, 0.65],
  ]) {
    if (d >= 2) B(o, 'marble', 0, y, depth / 2, w, h, depth, pale);
    else face(o, 'marble', 0, y, depth, w, h, pale);
  }
}
function pediment(o, d) {
  const y = 30.65,
    half = 16.7,
    top = 37.4,
    z = 0.78;
  tri(
    o,
    'marble',
    [
      [-half, y, z - 0.7],
      [half, y, z - 0.7],
      [0, top, z - 0.7],
    ],
    carving,
  );
  B(o, 'marble', 0, 30.3, -0.17, 34.1, 0.35, 2.1, marble);
  for (const [a, b] of [
    [
      [-half, y, z],
      [0, top, z],
    ],
    [
      [0, top, z],
      [half, y, z],
    ],
  ]) {
    beam(o, 'marble', a, b, d === 0 ? 0.4 : 0.52, d === 0 ? 0.5 : 0.82, pale);
    if (d >= 2) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.floor(length / 0.65);
      for (let i = 1; i < n; i++) {
        const t = i / n,
          x = a[0] + (b[0] - a[0]) * t,
          yy = a[1] + (b[1] - a[1]) * t;
        B(o, 'marble', x, yy - 0.28, z - 0.02, 0.22, 0.25, 0.6, carving);
      }
    }
  }
  const statues = [
    [-13.5, 'left-end'],
    [-10.6, 'mining'],
    [-7.2, 'wife'],
    [-4.7, 'farmer'],
    [-2.1, 'child-l'],
    [0, 'integrity'],
    [2.2, 'child-r'],
    [4.7, 'mechanic'],
    [7.4, 'power'],
    [10.6, 'science'],
    [13.6, 'right-end'],
  ];
  for (const [x, kind] of statues) newYorkStockExchangePedimentStatue(o, x, kind, d);
}
function portico(o, d, rear = false) {
  const w = 33.6;
  podium(o, w, d, rear);
  face(o, 'glass', 0, 11.65, -2.75, 29.2608, 15.24, glass);
  if (d) {
    const nx = d === 1 ? 7 : 14,
      ny = d === 1 ? 4 : 10;
    for (let i = 0; i <= nx; i++)
      face(o, 'bronze', -14.63 + (i * 29.26) / nx, 11.65, -2.7, 0.08, 15.24, bronze);
    for (let j = 0; j <= ny; j++)
      face(o, 'bronze', 0, 11.65 + (j * 15.24) / ny, -2.69, 29.26, 0.075, bronze);
  }
  for (const x of [-12.7, -7.62, -2.54, 2.54, 7.62, 12.7]) column(o, x, -0.88, d, !rear);
  for (const sign of [-1, 1]) {
    B(o, 'marble', sign * 15.9, 11.3, -0.94, 1.6, 16.002, 1.85, marble);
    if (d >= 2) for (let i = 0; i < 5; i++) leaf(o, sign * 15.9 + (i - 2) * 0.3, 25.7, 0.04, 0, d);
  }
  if (d)
    for (let i = 0; i < 7; i++)
      balustrade(facing(o, 0, (i - 3) * 4.9, 0.3), 3.45, 11.5, 0, d, true);
  for (const [y, h, depth] of [
    [27.302, 0.28, 1.5],
    [27.58, 0.5, 1.2],
    [28.08, 1.45, 1.05],
    [29.53, 0.35, 1.55],
    [29.88, 0.42, 2],
  ]) {
    if (d >= 2) B(o, 'marble', 0, y, depth / 2 - 0.3, w, h, depth, pale);
    else face(o, 'marble', 0, y, depth - 0.3, w, h, pale);
  }
  if (d >= 2) {
    const n = d === 2 ? 36 : 51;
    for (let i = 0; i < n; i++)
      B(o, 'marble', -16 + (i * 32) / (n - 1), 29.88, 0.8, 0.23, 0.3, 0.65, carving);
  }
  if (!rear) {
    face(o, 'marble', 0, 30.3, -0.35, w, 7, marble);
    inscription(o, d);
    pediment(o, d);
  } else {
    face(o, 'marble', 0, 30.3, -0.3, w, 7, marble);
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 4.55;
      face(o, 'glass', x, 31, -0.27, 2.3, 5.3, glass);
      if (d) {
        face(o, 'bronze', x, 33.7, -0.2, 2.3, 0.08, bronze);
        face(o, 'marble', x + 2.05, 30.3, 0.05, 0.45, 6.8, pale);
        balustrade(facing(o, 0, x, 0.22), 2.6, 33.5, 0, d, true);
      }
    }
  }
}
function southBay(o, w, d) {
  face(o, 'marble', 0, -1.2, 0, w, 38.7, marble);
  archWindow(o, 0, 0.15, 0.02, 4.0, 9.3, d);
  if (d >= 1) {
    B(o, 'marble', 0, 3.3, 0.12, 3.55, 0.3, 0.45, pale);
    face(o, 'glass', 0, -0.2, 0.05, 2.5, 3.45, glass);
    B(o, 'marble', 0, 5.4, 0.45, 4.1, 0.2, 1.2, pale);
    balustrade(facing(o, 0, 0, 1), 3.9, 5.6, 0, d);
  }
  for (let f = 0; f < 6; f++)
    for (const x of [-1.05, 1.05]) {
      face(o, 'glass', x, 11.7 + f * 3.8, 0.02, 1.35, 2.6, f === 0 ? stone : glass);
      if (d >= 2) face(o, 'bronze', x, 13 + f * 3.8, 0.04, 1.35, 0.06, bronze);
    }
}
export function newYorkStockExchange(out, frame = nativeFrame, d = 3) {
  const ring = frame.geometry.outline.slice(0, -1),
    frontZ = ring[0][1],
    cx = (ring[0][0] + ring[1][0]) / 2 + 3.8,
    rearA = ring[2],
    rearB = ring[3],
    rearX = (rearA[0] + rearB[0]) / 2,
    rearZ = (rearA[1] + rearB[1]) / 2,
    rearAngle = Math.PI - Math.atan2(rearA[1] - rearB[1], rearA[0] - rearB[0]);
  polygon(out, 'granite', ring, -1.2, stone, false);
  polygon(out, 'roof', ring, 37.3, roof);
  // Opaque interior backing behind the two airy colonnades, without constructing a navigable interior.
  face(out, 'marble', cx, -1.2, frontZ - 3, 33.6, 38.5, marble);
  face(
    facing(out, rearAngle, rearX, rearZ + 3),
    'marble',
    0,
    -1.2,
    0,
    Math.hypot(rearA[0] - rearB[0], rearA[1] - rearB[1]),
    38.5,
    marble,
  );
  for (const i of [1, 3, 4, 5]) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = Math.hypot(dx, dz),
      q = facing(out, Math.atan2(-dz, dx), (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    face(q, 'marble', 0, -1.2, 0, len, 38.5, marble);
    if (i !== 1 && len > 6 && d)
      for (let f = 0; f < 7; f++)
        for (let j = 0; j < Math.floor(len / 3.5); j++)
          face(
            q,
            'glass',
            -len / 2 + ((j + 0.5) * len) / Math.floor(len / 3.5),
            8 + f * 3.8,
            0.02,
            1.2,
            2.4,
            glass,
          );
  }
  portico(facing(out, 0, cx, frontZ), d);
  const left = cx - 16.8,
    sw = left - ring[0][0];
  southBay(facing(out, 0, (left + ring[0][0]) / 2, frontZ), sw, d);
  portico(facing(out, rearAngle, rearX, rearZ), d, true);
  // Continuous façade parapets, then conservative upper office/plant envelope set back from both public fronts.
  for (const [o, w] of [
    [facing(out, 0, (ring[0][0] + ring[1][0]) / 2, frontZ), ring[1][0] - ring[0][0]],
    [facing(out, rearAngle, rearX, rearZ), Math.hypot(rearA[0] - rearB[0], rearA[1] - rearB[1])],
  ]) {
    if (d >= 2) B(o, 'marble', 0, 37.3, -0.12, w, 0.25, 0.65, pale);
    else face(o, 'marble', 0, 37.3, 0.22, w, 0.25, pale);
    balustrade(o, w, 37.55, -0.2, d);
  }
  B(out, 'marble', 1, 37.3, -1, 28, 7.5, 28, marble);
  B(out, 'roof', 1, 44.8, -1, 28.6, 0.3, 28.6, roof);
  if (d) {
    for (const sign of [-1, 1]) {
      const q = facing(out, sign < 0 ? Math.PI : 0, 1, -1 + sign * 14.02);
      for (let f = 0; f < 2; f++)
        for (let i = 0; i < 7; i++) {
          const x = (i - 3) * 3.65;
          face(q, 'glass', x, 38.1 + f * 3.4, 0.02, 1.65, 2.4, glass);
          if (d >= 2) face(q, 'bronze', x, 39.3 + f * 3.4, 0.04, 1.65, 0.06, bronze);
        }
    }
  }
  B(out, 'roof', 2, 45.1, -2, 10, 2.4488, 8, roof);
  if (d >= 2) for (let i = 0; i < 9; i++) face(out, 'iron', -2 + i, 45.5, 2.015, 0.2, 1.4, iron);
}
export const newYorkStockExchangeSkyline = (o) => newYorkStockExchange(o, nativeFrame, 0);
export const newYorkStockExchangeDistrict = (o) => newYorkStockExchange(o, nativeFrame, 1);
export const newYorkStockExchangeStreet = (o) => newYorkStockExchange(o, nativeFrame, 2);
const surfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.86, metallic: 0 },
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.95, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.68, metallic: 0.45 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.1 },
  glass: { slot: 'window', localRef: ref, roughness: 0.43, metallic: 0.04 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
};
export const newYorkStockExchangeModel = {
  id: 'new_york_stock_exchange',
  key: 'new_york_stock_exchange',
  recipe: 'structure-new-york-stock-exchange.mjs',
  cell: 'dr/dr5',
  title: 'New York Stock Exchange',
  build: newYorkStockExchange,
  surfaces,
  brief:
    '1903Broad Street block only: native exterior edges with explicit inferred north interface, six tall fluted Corinthian front columns and six smooth rear columns, bronze-grid recessed glass, seven podium arches/balconies, asymmetric south entrance, triangular pediment with11posed figures and permanent inscription, parapets and conservative upper office/plant roof envelope. Neighboring Wall Street office tower,20Broad,temporary flags/banners,street scenery and trading-floor interiors excluded.',
  camera: [77, 54, 89],
  lookAt: [0, 21, 0],
  portableGroundY: -0.5,
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  quality: 'medium-fi-exterior',
  reviewStatus: 'medium-fi-exterior-source-preview-reviewed-in-qa',
  geographicStatus: 'bounded-preview',
  groundContactBasis:
    'Native parent vertices and photo/document-directed1903scope fixed before locked USGS NY_CMPG_2013raster30939 and geometry. Datum5.3501m,original1mexport independently reproduced. Documentary slopingstreet produces varying basement exposure; architecture wallfoot-1.2m and two-storeypodium11.3m are not a terrain pad. No ground changes or generic parent-footprint replacement; anotherDEM needs contact review.',
  qaCameras: [
    { name: 'broad-street-front', position: [5, 19, 75], lookAt: [1.5, 19, 21] },
    { name: 'fluted-columns', position: [-11, 18, 31], lookAt: [1.5, 19, 20] },
    { name: 'pediment-sculpture', position: [4, 36, 45], lookAt: [1.5, 33.5, 22] },
    { name: 'podium-balconies', position: [6, 6, 37], lookAt: [1.5, 6, 21] },
    { name: 'south-entrance', position: [-34, 7, 40], lookAt: [-19, 5, 21] },
    { name: 'new-street-front', position: [-5, 20, -76], lookAt: [2, 20, -23] },
    { name: 'smooth-rear-columns', position: [9, 18, -35], lookAt: [2, 20, -23] },
    { name: 'roof-envelope', position: [-46, 68, -35], lookAt: [0, 39, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-new-york-stock-exchange.mjs',
    level: 'skyline',
    export: 'newYorkStockExchangeSkyline',
    errorMeters: 2.2,
    surfaces,
    authoredLevels: {
      district: { export: 'newYorkStockExchangeDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'newYorkStockExchangeStreet', errorMeters: 0.5, surfaces },
    },
    caps: { closeup: { triangles: 64000, errorMeters: 0.04, prune: true } },
  },
  limitations: [
    'Photographic medium-fi1903exterior with bounded independent source-ground preview, not surveyed facade/foundation or navigable trading floor.',
    'Nativeparentcombines18Broad/11Wall; ownnorthinterface joins retained parentvertices by explicit scope inference. Quantized map and historical architectural dimensions do not establish cadastral accuracy.',
    'Exact capital leaves,figurative relief,upper roofsetbacks/currentplant and unseen side/back details are estimates. Original47.55mheight controls upper envelope; omit taller11Walloffice tower.',
    'Source-specific USGS NY_CMPG_2013ground unchanged;1msampling does not establish surveyaccuracy or defaultEarthterraincompatibility.',
    'Original photo pixels are not model textures. Ordinary catalog shared graphs, opaque exterior glass, no full-site terrain pad/cutout/generic parent-footprint replacement.',
  ],
};
