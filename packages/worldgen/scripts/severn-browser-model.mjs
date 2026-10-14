/** Independent browser silhouettes; the original detailed Severn recipe stays unchanged. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const MEANS = {
    wall: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    cable: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    foundation: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    road: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  },
  end = 798.75,
  tower = 493.75;
const white = [0.8, 0.82, 0.79],
  concrete = [0.53, 0.54, 0.5],
  cable = [0.58, 0.63, 0.64];
const deckY = (x) => 37 - 5 * (Math.abs(x) / end) ** 2;
const cableY = (x) => {
  const a = Math.abs(x);
  if (a <= tower) return 43.5 + (135.15 - 43.5) * (a / tower) ** 2;
  const t = (a - tower) / 305;
  return 135.15 + (34 - 135.15) * t - 56 * t * (1 - t);
};
function writer(destination, far) {
  function emit(slot, ref, p, hint, uv, color) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        slot,
        ref,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? color.map((v, j) => v * (MEANS[slot]?.[j] ?? 1)) : color,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function ribbon(o, slot, a, b, width, color) {
  for (const axis of [0, 2]) {
    const delta = [0, 0, 0];
    delta[axis] = width / 2;
    o.addQuad(
      slot,
      'palette:#ffffff',
      [
        a.map((v, i) => v - delta[i]),
        b.map((v, i) => v - delta[i]),
        b.map((v, i) => v + delta[i]),
        a.map((v, i) => v + delta[i]),
      ],
      null,
      null,
      color,
    );
  }
}
function build(out, detail) {
  const o = writer(out, !detail),
    n = detail ? 40 : 16,
    ring = (x) => {
      const y = deckY(x);
      return [
        [x, y, -16],
        [x, y, 16],
        [x, y - 0.6, 16],
        [x, y - 3.048, 7.8],
        [x, y - 3.048, -7.8],
        [x, y - 0.6, -16],
      ];
    };
  loft(
    o,
    'wall',
    Array.from({ length: n + 1 }, (_, i) => ring(-end + (i * 2 * end) / n)),
    white,
  );
  for (let i = 0; i < n; i++) {
    const a = -end + (i * 2 * end) / n,
      b = -end + ((i + 1) * 2 * end) / n;
    o.addQuad(
      'road',
      'palette:#ffffff',
      [
        [a, deckY(a) + 0.04, 9.7],
        [b, deckY(b) + 0.04, 9.7],
        [b, deckY(b) + 0.04, -9.7],
        [a, deckY(a) + 0.04, -9.7],
      ],
      [0, 1, 0],
      null,
      [0.16, 0.175, 0.18],
    );
  }
  for (const x of [-tower, tower]) {
    box(o, 'foundation', [x - 5.75, 0, -20], [x + 5.75, 12, 20], concrete);
    for (const z of [-11.75, 11.75]) {
      box(o, 'wall', [x - 2.35, 12, z - 1.9], [x + 2.35, 136, z + 1.9], white);
      box(o, 'metal', [x - 2, 133, z - 1.6], [x + 2, 136, z + 1.6], white);
    }
    for (const [y, h] of [
      [deckY(x) - 6.15, 3.1],
      [83.5, 4.1],
      [128.8, 4],
    ])
      box(o, 'wall', [x - 1.8, y, -11.75], [x + 1.8, y + h, 11.75], white);
  }
  for (const sign of [-1, 1]) {
    const x = sign * end;
    box(
      o,
      'foundation',
      [x - (sign < 0 ? 20 : 5), 0, -17.5],
      [x + (sign > 0 ? 20 : 5), 33.3, 17.5],
      concrete,
    );
  }
  const cableSteps = detail ? 64 : 32;
  for (let i = 0; i < cableSteps; i++)
    for (const z of [-11.75, 11.75]) {
      const a = -end + (i * 2 * end) / cableSteps,
        b = -end + ((i + 1) * 2 * end) / cableSteps,
        p = [a, cableY(a), z],
        q = [b, cableY(b), z];
      if (detail) beam(o, 'cable', p, q, 0.55, 0.55, cable);
      else ribbon(o, 'cable', p, q, 0.6, cable);
    }
  const hangerSteps = detail ? 40 : 16;
  for (let i = 0; i < hangerSteps; i++)
    for (const z of [-11.75, 11.75]) {
      const x = -end + ((i + 0.5) * 2 * end) / hangerSteps,
        p = [x, cableY(x), z],
        q = [Math.max(-end, Math.min(end, x + (i % 2 ? 9.144 : -9.144))), deckY(x) + 0.3, z];
      if (Math.abs(x - tower) < 5 || Math.abs(x + tower) < 5) continue;
      if (detail) beam(o, 'cable', p, q, 0.12, 0.12, cable);
      else ribbon(o, 'cable', p, q, 0.18, cable);
    }
}
export const buildSevernSkyline = (out) => build(out, false);
export const buildSevernDistrict = (out) => build(out, true);
