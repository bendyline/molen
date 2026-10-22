/** HartRAO26m principal radio telescope: native instrument identity, NASA staff photographs. */
import './install-deterministic-math.mjs';
import { beam, cross, normalFor, normalize } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const pale = rgb('d2d5cc'),
  panel = rgb('cdd1c7'),
  frame = rgb('a7afa6'),
  dark = rgb('66716d'),
  concrete = rgb('aaa795');
const surfaces = {
  reflector: { slot: 'wall', graph: 'metal_painted', roughness: 0.86, metallic: 0.13 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.19 },
  dark: { slot: 'trim', graph: 'metal_painted', roughness: 0.9, metallic: 0.18 },
  base: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const ref = 'palette:#ffffff',
  add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s),
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  X = [1, 0, 0],
  elevation = (50 * Math.PI) / 180,
  N = [0, Math.sin(elevation), Math.cos(elevation)],
  V = [0, Math.cos(elevation), -Math.sin(elevation)],
  vertex = [0, 15.2, 0],
  focal = 10.5;
const dish = (r, a, depth = 0) =>
  add(add(add(vertex, X, r * Math.cos(a)), V, r * Math.sin(a)), N, (r * r) / (4 * focal) + depth);
function tri(out, slot, p, c) {
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    c,
  );
}
function cap(out, slot, r, c, reverse = false) {
  const ps = reverse ? [...r].reverse() : r;
  for (let i = 1; i < ps.length - 1; i++) tri(out, slot, [ps[0], ps[i], ps[i + 1]], c);
}
function ring(c, u, v, r, n) {
  return Array.from({ length: n }, (_, i) =>
    add(add(c, u, r * Math.cos((i / n) * Math.PI * 2)), v, r * Math.sin((i / n) * Math.PI * 2)),
  );
}
function tube(out, slot, c, axis, r, length, n, color) {
  const u =
      Math.abs(axis[0]) < 0.95
        ? normalize(cross([1, 0, 0], axis))
        : normalize(cross([0, 1, 0], axis)),
    v = cross(axis, u),
    a = ring(c, u, v, r, n),
    b = ring(add(c, axis, length), u, v, r, n);
  for (let i = 0; i < n; i++) {
    const k = (i + 1) % n,
      p = [a[i], a[k], b[k], b[i]];
    quad(out, slot, p, normalFor(...p), color);
  }
  cap(out, slot, a, color, true);
  cap(out, slot, b, color);
}
function truss(out, a, b, width, d, color = frame, slot = 'frame') {
  if (d === 0) {
    beam(out, slot, a, b, width * 0.35, width * 0.35, color);
    return;
  }
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    offsets =
      d === 1
        ? [
            [-0.5, 0],
            [0.5, 0],
          ]
        : [
            [-0.5, -0.289],
            [0.5, -0.289],
            [0, 0.577],
          ],
    p = (t, i) => add(add(mix(a, b, t), u, width * offsets[i][0]), v, width * offsets[i][1]),
    section = d === 3 ? 0.14 : 0.17,
    steps = [1, 3, 5, 8][d];
  for (let i = 0; i < offsets.length; i++)
    beam(out, slot, p(0, i), p(1, i), section, section, color);
  const faces = d === 1 ? 1 : offsets.length;
  for (let side = 0; side < faces; side++) {
    const next = (side + 1) % offsets.length;
    for (let j = 0; j < steps; j++) {
      const t0 = j / steps,
        t1 = (j + 1) / steps;
      beam(
        out,
        slot,
        p(t0, j % 2 ? next : side),
        p(t1, j % 2 ? side : next),
        section * 0.68,
        section * 0.68,
        color,
      );
    }
  }
}
function reflector(out, d) {
  const n = [12, 24, 48, 80][d],
    bands = [2, 4, 6, 10][d],
    radii = Array.from({ length: bands + 1 }, (_, i) => 1.25 + ((13 - 1.25) * i) / bands);
  for (let j = 0; j < bands; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        front = [
          dish(radii[j], a),
          dish(radii[j + 1], a),
          dish(radii[j + 1], b),
          dish(radii[j], b),
        ],
        rear = [
          dish(radii[j], a, -0.22),
          dish(radii[j], b, -0.22),
          dish(radii[j + 1], b, -0.22),
          dish(radii[j + 1], a, -0.22),
        ];
      quad(out, 'reflector', front, normalFor(...front), d > 1 && (i + j) % 7 === 0 ? panel : pale);
      quad(out, 'frame', rear, normalFor(...rear), frame);
    }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    for (const r of [1.25, 13]) {
      const ps =
        r === 13
          ? [dish(r, a), dish(r, a, -0.22), dish(r, b, -0.22), dish(r, b)]
          : [dish(r, a), dish(r, b), dish(r, b, -0.22), dish(r, a, -0.22)];
      quad(out, 'frame', ps, normalFor(...ps), frame);
    }
  }
  const ribs = [6, 10, 16, 24][d],
    rs = d < 2 ? [3, 13] : [3, 6.5, 9.5, 13];
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2,
      back = (r, outer = false) => dish(r, a, outer ? -0.35 : -(3.1 - r * 0.16));
    for (let j = 1; j < rs.length; j++) {
      beam(out, 'frame', back(rs[j - 1]), back(rs[j]), 0.16, 0.19, frame);
      if (d > 0) {
        beam(out, 'frame', back(rs[j - 1], true), back(rs[j], true), 0.15, 0.18, frame);
        beam(out, 'frame', back(rs[j - 1]), back(rs[j], true), 0.11, 0.12, frame);
        if (d > 1) beam(out, 'frame', back(rs[j - 1], true), back(rs[j]), 0.1, 0.1, frame);
      }
    }
  }
  if (d > 0)
    for (const r of [d === 1 ? 10 : 7.5, 12.7])
      for (let i = 0; i < n; i++)
        beam(
          out,
          'frame',
          dish(r, (i / n) * Math.PI * 2, -0.5),
          dish(r, ((i + 1) / n) * Math.PI * 2, -0.5),
          0.14,
          0.16,
          frame,
        );
}
function feed(out, d) {
  const apex = add(vertex, N, 9.6),
    n = [8, 12, 20, 32][d];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    truss(out, dish(11.6, a, 0.1), apex, 0.7, d, frame);
  }
  tube(out, 'reflector', add(vertex, N, -0.1), N, 1.18, 4.9, n, pale);
  tube(out, 'dark', add(vertex, N, 4.8), N, 1.05, 0.12, n, dark);
  tube(out, 'frame', add(vertex, N, 4.91), N, 1.24, 0.12, n, frame);
  tube(out, 'dark', add(apex, N, -0.25), N, 1.15, 0.45, n, dark);
  if (d > 0) {
    const bottom = ring(add(vertex, N, 0.25), X, V, 1.55, d === 1 ? 6 : 12),
      top = ring(add(vertex, N, 4.55), X, V, 1.55, d === 1 ? 6 : 12);
    for (let i = 0; i < bottom.length; i++) {
      beam(out, 'frame', bottom[i], top[i], 0.075, 0.075, frame);
      if (d > 1) {
        const k = (i + 1) % bottom.length;
        beam(out, 'frame', bottom[i], bottom[k], 0.09, 0.09, frame);
        beam(out, 'frame', top[i], top[k], 0.09, 0.09, frame);
      }
    }
  }
}
function polarMount(out, d) {
  const latitude = (25.8897 * Math.PI) / 180,
    axis = [0, Math.sin(latitude), Math.cos(latitude)],
    v = [0, Math.cos(latitude), -Math.sin(latitude)],
    center = [0, 8.3, -0.5],
    n = [8, 12, 20, 32][d],
    depth = d === 0 ? [0] : [-0.65, 0.65],
    hoops = depth.map((off) => ring(add(center, axis, off), X, v, 4.7, n));
  for (const r of hoops)
    for (let i = 0; i < n; i++) beam(out, 'dark', r[i], r[(i + 1) % n], 0.31, 0.29, dark);
  if (d > 0)
    for (let i = 0; i < n; i++) {
      beam(out, 'frame', hoops[0][i], hoops[1][i], 0.15, 0.15, frame);
      beam(out, 'frame', hoops[0][i], hoops[1][(i + 1) % n], 0.13, 0.13, frame);
    }
  const feet = [
      [-7.5, 0.2, -6],
      [7.5, 0.2, -6],
      [-7.5, 0.2, 6],
      [7.5, 0.2, 6],
    ],
    bearings = [
      [-2.6, 7.8, -1.5],
      [2.6, 7.8, -1.5],
    ];
  for (let i = 0; i < feet.length; i++) {
    const a = feet[i],
      b = bearings[i % 2];
    B(out, 'base', a[0], -0.35, a[2], 1.8, 0.6, 1.8, concrete);
    truss(out, a, b, 0.8, d, frame);
    if (d > 0) {
      const m = mix(a, b, 0.48),
        other = mix(feet[i ^ 1], bearings[(i ^ 1) % 2], 0.48);
      if (i % 2 === 0) truss(out, m, other, 0.55, Math.min(d, 2), frame);
    }
  }
  beam(out, 'frame', bearings[0], bearings[1], 0.6, 0.7, frame);
  tube(out, 'dark', add(center, axis, -3.2), axis, 0.56, 6.4, [6, 10, 16, 24][d], dark);
  for (const sign of [-1, 1]) {
    const a = add(add(center, X, sign * 3.32), v, 3.32),
      b = add(add(vertex, N, -1.6), X, sign * 2.4);
    truss(out, a, b, 0.65, d, frame);
    beam(out, 'dark', bearings[sign === -1 ? 0 : 1], add(center, X, sign * 2.0), 0.45, 0.5, dark);
  }
  if (d > 1) {
    const a = [8.05, 0.5, 6.2],
      b = [2.85, 7.9, -1.05],
      across = [0.7, 0, 0];
    for (const sign of [-1, 1])
      beam(out, 'frame', add(a, across, sign / 2), add(b, across, sign / 2), 0.1, 0.1, frame);
    if (d === 3)
      for (let j = 0; j <= 22; j++) {
        const p = mix(a, b, j / 22);
        beam(out, 'frame', add(p, across, -0.5), add(p, across, 0.5), 0.08, 0.08, frame);
      }
  }
}
function build(out, _frame, d = 3) {
  reflector(out, d);
  polarMount(out, d);
  feed(out, d);
}
export const hartraoSkyline = (o, f) => build(o, f, 0);
export const hartraoDistrict = (o, f) => build(o, f, 1);
export const hartraoStreet = (o, f) => build(o, f, 2);
export const hartrao26mModel = {
  id: 'hartrao_26m_antenna',
  key: 'hartrao_26m_antenna',
  recipe: 'structure-hartrao-26m-antenna.mjs',
  cell: 'ke/ke7',
  title: 'HartRAO26m Radio Telescope',
  category: 'scientific-instrument',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief:
    'Principal26m HartRAO reflector at its specifically named native location: shallow white parabolic shell with central receiver, three open triangular feed trusses, rear radial webs/rings, inclined open polar/hour-axis framework and four splayed lattice legs with bounded concrete footings and an access ladder. Movable antenna shown in an illustrative observing pose; detached instruments and campus structures excluded.',
  camera: [35, 28, 46],
  lookAt: [0, 15, 0],
  portableGroundY: -0.18,
  mediumFiContext: { scale: 0.6 },
  qaCameras: [
    { name: 'parabolic-reflector-and-feed', position: [27, 30, 34], lookAt: [0, 20, 4] },
    { name: 'rear-ribs-and-polar-frame', position: [-27, 19, -25], lookAt: [0, 11, -1] },
    { name: 'open-lattice-feet-and-axis', position: [18, 8, 18], lookAt: [0, 7, -1] },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original named26m telescope way220662077 and explicit26m diameter establish the physical instrument identity/center. A fixed open pad point south of the native reflector extent defines the approximate foundation datum before terrain sampling. Movable dish pose is illustrative, not a permanent azimuth.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hartrao-26m-antenna.mjs',
    level: 'skyline',
    export: 'hartraoSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'hartraoDistrict', errorMeters: 0.45, surfaces },
      street: { export: 'hartraoStreet', errorMeters: 0.14, surfaces },
    },
  },
  limitations: [
    'Native way220662077 explicitly identifies the26m IVS/VLBI telescope; its original polygon fixes the instrument center rather than the general campus/story point.26m diameter is retained. Surface focal ratio/depth,50degree display elevation, receiver, polar framework, truss sections and small fittings are photographic medium-fi estimates; this is not an engineering or tracking simulation.',
    'Two inspected NASA GSFC photographs by named civil servant Frank Lemoine show the principal instrument during the2016VLBI meeting. Both exact offered900x550renditions, primary staff-role report and NASA government-work policy are hash-bound after a Qualla-first search. Original pixels are visual references and are not textures.',
    'Principal26m structure only. Separate15m/XDM/C-BASS dishes, HIRAX array, laser-ranging equipment, campus buildings, containers, fences, landscape and branded labels are excluded. Fine webs/cage/ladder detail retires in lower LODs; the open mount and main feed/reflector silhouettes remain.',
    'Footings extend0.35m below a fixed dry-pad datum. Source terrain, local foundation/pad attachment and ground slope remain approximate; no whole-site platform, blanket ground opening or source-height fitting is introduced.',
  ],
};
