/** Whole, explicit browser representations; the detailed fabrication-like master is retained. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  helixFrame as frame,
  helixClearsWalk,
  helixDeckPoint as p,
  helixStroke as stroke,
} from '../../../../../../../../packages/worldgen/scripts/helix-bridge-model.mjs';
import {
  helixCurrentPoint as helixPoint,
  helixCurrentPodStations as pods,
} from '../../../../../../../../packages/worldgen/scripts/helix-current-model.mjs';

const half = 135.7,
  white = [0.88, 0.9, 0.91],
  polished = [0.96, 0.97, 0.98],
  paving = [0.66, 0.67, 0.62],
  glass = [0.6, 0.73, 0.75],
  start = -Math.acos(1.5 / 6);
const means = {
  concrete: [0.710816, 0.710816, 0.681928],
  paving: [0.701109, 0.701109, 0.701109],
  steel: [0.81896, 0.822889, 0.822889],
};
function writer(out, far) {
  const emit = (slot, ref, points, hint, _uv, color) => {
    points = points.map((v) => v.map(Math.fround));
    for (let i = 1; i < points.length - 1; i++) {
      let t = [points[0], points[i], points[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((sum, v, j) => sum + v * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      out.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? color.map((v, j) => v * (means[slot]?.[j] ?? 1)) : color,
      );
    }
  };
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function face(o, slot, points, color, hint) {
  o.addQuad(slot, 'palette:#ffffff', points, hint ?? normalFor(...points), null, color);
}
function triangle(o, slot, points, color, hint) {
  o.addTriangle(slot, 'palette:#ffffff', points, hint ?? normalFor(...points), null, color);
}
function stations(a, b, step, knots = []) {
  const n = Math.ceil((b - a) / step);
  return [
    ...new Set([
      a,
      b,
      ...Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n),
      ...knots.filter((x) => x > a && x < b),
    ]),
  ].sort((a, b) => a - b);
}
function ribbon(o, a, b, width, color = white) {
  const d = b.map((v, i) => v - a[i]),
    n = Math.hypot(d[0], d[2]),
    u = n > 0.001 ? [((-d[2] / n) * width) / 2, 0, ((d[0] / n) * width) / 2] : [width / 2, 0, 0],
    v = [0, width / 2, 0];
  for (const delta of [u, v])
    face(
      o,
      'steel',
      [
        a.map((x, i) => x - delta[i]),
        b.map((x, i) => x - delta[i]),
        b.map((x, i) => x + delta[i]),
        a.map((x, i) => x + delta[i]),
      ],
      color,
    );
}
function rail(o, points, radius, far = false) {
  if (far) for (let i = 1; i < points.length; i++) ribbon(o, points[i - 1], points[i], radius * 2);
  else stroke(o, 'steel', points, radius, white, 6);
}
function platform(o, x, level) {
  const near = ['street', 'closeup'].includes(level),
    close = level === 'closeup',
    count = { skyline: 8, district: 10, street: 16, closeup: 32 }[level],
    n = frame(x).across.map((v) => -v),
    t = frame(x).tangent,
    center = p(x, 6, -10.7),
    at = (a) => center.map((v, k) => v + t[k] * 6 * Math.cos(a) + n[k] * 4.5 * Math.sin(a));
  const ring = [
      p(x + 1.5, 6, -3.03),
      ...Array.from({ length: count + 1 }, (_, i) =>
        at(start + (i * (Math.PI - 2 * start)) / count),
      ),
      p(x - 1.5, 6, -3.03),
    ],
    under = center.map((v, i) => v - (i === 1 ? 0.32 : 0));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      A = a.map((v, k) => v - (k === 1 ? 0.32 : 0)),
      B = b.map((v, k) => v - (k === 1 ? 0.32 : 0));
    triangle(o, 'paving', [center, a, b], paving, [0, 1, 0]);
    triangle(o, 'steel', [under, B, A], white, [0, -1, 0]);
    face(o, 'steel', [b, a, A, B], white);
    if (i === ring.length - 1 || level === 'skyline') continue;
    const topA = a.map((v, k) => v + (k === 1 ? 1.3 : 0)),
      topB = b.map((v, k) => v + (k === 1 ? 1.3 : 0));
    if (near) {
      beam(o, 'steel', a, topA, 0.068, 0.068, white);
      face(o, 'glass', [a, b, topB, topA], glass);
    }
    rail(o, [topA, topB], 0.04, !near);
  }
  if (near)
    for (let i = -4; i <= 4; i += close ? 1 : 2) {
      const z = -10.7 - 4.5 * Math.sqrt(Math.max(0, 1 - ((i * 1.25) / 6) ** 2));
      beam(o, 'steel', p(x + i * 1.25, 5.72, -1.8), p(x + i * 1.25, 5.72, z), 0.15, 0.32, white);
    }
}
function supports(o, level) {
  const far = level === 'skyline',
    sides = far ? 4 : 8;
  for (const x of pods) {
    const cap = Array.from({ length: sides }, (_, i) =>
      p(
        x + 2.8 * Math.cos((-i * Math.PI * 2) / sides),
        0,
        4.8 * Math.sin((-i * Math.PI * 2) / sides),
      ),
    );
    loft(o, 'concrete', [cap, cap.map((q) => [q[0], 0.8, q[2]])], [0.66, 0.66, 0.61]);
    for (const side of [-1, 1])
      for (const [dx, z] of [
        [-2.5, side * 4.3],
        [2.5, side * 4.3],
        [0, side * 0.8],
      ]) {
        const a = p(x, 0.8, side * 3.1),
          b = p(x + dx, 5.6, z);
        if (far) ribbon(o, a, b, 0.5);
        else stroke(o, 'steel', [a, b], (t) => 0.3 - t * 0.1, white, level === 'closeup' ? 10 : 6);
      }
  }
  for (const x of [-half, half]) {
    const a = x < 0 ? x : x - 2,
      b = x < 0 ? x + 2 : x,
      ring = (s, y) => [p(s, y, -3.4), p(s, y, 3.4), p(s, 0, 3.4), p(s, 0, -3.4)];
    loft(o, 'concrete', [ring(a, 1), ring(b, 1)], [0.62, 0.63, 0.59]);
    for (const side of [-1, 1]) {
      const s = x < 0 ? x + 1 : x - 1,
        A = p(s, 1, side * 1.5),
        B = p(s, 5.58, side * 3.2);
      if (far) ribbon(o, A, B, 0.4);
      else stroke(o, 'steel', [A, B], (t) => 0.22 - 0.06 * t, white, 6);
    }
  }
}
function canopy(o, level) {
  if (level === 'skyline') return;
  const near = level === 'street' || level === 'closeup',
    close = level === 'closeup',
    step = level === 'district' ? 16 : 7;
  for (let x = -110; x < 110; x += step) {
    const end = Math.min(110, x + step - 0.2),
      leaves = close ? 3 : 1;
    for (const side of [-1, 1])
      for (let leaf = 0; leaf < leaves; leaf++) {
        const za = side * (0.12 + (leaf * 3.579) / leaves),
          zb = side * (0.12 + ((leaf + 1) * 3.579) / leaves - 0.018),
          Y = (z) => 7.7 + Math.sqrt(4.5 ** 2 - z ** 2),
          points = [p(x, Y(za), za), p(end, Y(za), za), p(end, Y(zb), zb), p(x, Y(zb), zb)];
        face(
          o,
          Math.floor((x + half) / step) % 3 === 0 ? 'mesh' : 'glass',
          points,
          Math.floor((x + half) / step) % 3 === 0 ? [0.66, 0.69, 0.66] : [0.52, 0.66, 0.68],
        );
        if (near) rail(o, [points[0], points[3]], 0.027, level === 'street');
      }
  }
}
function build(out, level) {
  const far = level === 'skyline',
    near = ['street', 'closeup'].includes(level),
    close = level === 'closeup',
    o = writer(out, far),
    xs = stations(
      -half,
      half,
      { skyline: 18, district: 10, street: 4, closeup: 2 }[level],
      pods.flatMap((x) => [x - 1.5, x + 1.5]),
    );
  loft(
    o,
    'concrete',
    xs.map((x) => [p(x, 5.94, -3), p(x, 5.94, 3), p(x, 5.58, 3), p(x, 5.58, -3)]),
    [0.45, 0.49, 0.49],
  );
  for (let i = 1; i < xs.length; i++)
    face(
      o,
      'paving',
      [p(xs[i - 1], 6, -3), p(xs[i], 6, -3), p(xs[i], 6, 3), p(xs[i - 1], 6, 3)],
      paving,
      [0, 1, 0],
    );
  const step = { skyline: 14, district: 5.6, street: 6, closeup: 2.4 }[level],
    stationsHelix = stations(-half, half, step, [
      -123.35,
      -111,
      111,
      123.35,
      ...(near ? pods : []),
    ]);
  for (const [count, r, cy, pitch, hand, color] of [
    [6, 5.4, 8.4, 73.6, 1, white],
    [5, 4.7, 7.7, 51.4, -1, polished],
  ])
    for (const j of far ? [0, Math.floor(count / 2)] : Array.from({ length: count }, (_, i) => i)) {
      const points = stationsHelix.map((x) => helixPoint(x, j, count, r, cy, pitch, hand));
      if (far || level === 'district')
        for (let i = 1; i < points.length; i++) ribbon(o, points[i - 1], points[i], 0.273, color);
      else stroke(o, 'steel', points, 0.1365, color, close ? 12 : 6);
      if (near)
        for (let x = -half + 2; x < half - 2; x += close ? 10 : 40) {
          const a = helixPoint(x, j, count, r, cy, pitch, hand),
            b = helixPoint(x, j + 1, count, r, cy, pitch, hand);
          if (helixClearsWalk(a, b, x, pods)) beam(o, 'steel', a, b, 0.052, 0.052, white);
          if (close && Math.round((x + half - 2) / 10) % 2 === 0) {
            const t = frame(x).tangent;
            stroke(
              o,
              'steel',
              [a.map((v, k) => v - t[k] * 0.1), a.map((v, k) => v + t[k] * 0.1)],
              0.18,
              polished,
              6,
            );
          }
        }
    }
  if (!far)
    for (const side of [-1, 1]) {
      const cuts =
        side < 0 ? [-half, ...pods.flatMap((x) => [x - 1.5, x + 1.5]), half] : [-half, half];
      for (let i = 0; i < cuts.length - 1; i += 2) {
        const a = cuts[i],
          b = cuts[i + 1],
          ss = stations(a, b, close ? 2 : near ? 8 : 18);
        for (const y of near ? [6.04, 7.34] : [7.34])
          rail(
            o,
            ss.map((x) => p(x, y, side * 3.03)),
            0.037,
            !near,
          );
        if (near)
          for (let x = a; x < b; x += close ? 1.5 : 6) {
            const end = Math.min(b, x + (close ? 1.5 : 6));
            beam(o, 'steel', p(x, 6.02, side * 3.03), p(x, 7.34, side * 3.03), 0.064, 0.064, white);
            face(
              o,
              'glass',
              [
                p(x + 0.035, 6.15, side * 3.03),
                p(end - 0.035, 6.15, side * 3.03),
                p(end - 0.035, 7.27, side * 3.03),
                p(x + 0.035, 7.27, side * 3.03),
              ],
              glass,
            );
          }
      }
    }
  canopy(o, level);
  for (const x of pods) platform(o, x, level);
  supports(o, level);
}
export const buildHelixSkyline = (out) => build(out, 'skyline');
export const buildHelixDistrict = (out) => build(out, 'district');
export const buildHelixStreet = (out) => build(out, 'street');
export const buildHelixCloseup = (out) => build(out, 'closeup');
