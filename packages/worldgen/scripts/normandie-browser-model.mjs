/** Budgeted crossing silhouette and a shared-texture derivative of the unchanged detailed master. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor } from './authored-structure-mesh.mjs';
import { buildNormandie } from './pont-de-normandie-model.mjs';
import { box } from './structure-mesh.mjs';

const MEANS = {
    wall: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    foundation: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
    trim: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    roof: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
  },
  shift = -4.4,
  north = -1165.625,
  south = 975.625,
  concrete = [0.74, 0.75, 0.71],
  blue = [0.075, 0.32, 0.5],
  cable = [0.62, 0.66, 0.65],
  deckY = (x) =>
    Math.abs(x) <= 428 ? 59 + 12.84 * (1 - (x / 428) ** 2) : 59 - (Math.abs(x) - 428) * 0.06;
function writer(destination, far = false) {
  function emit(s, r, p, hint, uv, c) {
    p = p.map((v) => [Math.fround(v[0]), Math.fround(v[1] + shift), Math.fround(v[2])]);
    for (let i = 1; i < p.length - 1; i++) {
      let t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      if (hint && n.reduce((v, x, j) => v + x * hint[j], 0) < 0) {
        t = [t[0], t[2], t[1]];
        n = normalFor(...t);
      }
      destination.addTriangle(
        s,
        r,
        t,
        n,
        t.map((v) => [v[0], v[2]]),
        far ? c.map((v, j) => v * (MEANS[s]?.[j] ?? 1)) : c,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function feet(o) {
  for (const x of [-428, 428])
    box(o, 'foundation', [x - 9, -0.5 - shift, -23.5], [x + 9, 9.8, 23.5], [0.55, 0.57, 0.54]);
  for (const [sign, n, end] of [
    [-1, 15, north],
    [1, 11, south],
  ])
    for (let i = 1; i <= n; i++) {
      const start = sign * 428,
        x = start + ((end - start) * i) / (n + 1);
      box(o, 'foundation', [x - 4, -0.5 - shift, -8], [x + 4, 6, 8], [0.55, 0.57, 0.54]);
    }
}
export function buildNormandieSharedMaster(out) {
  const o = writer(out);
  buildNormandie(o);
  feet(o);
}
function buildFar(out, detail) {
  const o = writer(out, !detail),
    n = detail ? 48 : 18,
    ring = (x) => {
      const y = deckY(x);
      return [
        [x, y, -10.6],
        [x, y, 10.6],
        [x, y - 0.91, 10.6],
        [x, y - 3, 4.7],
        [x, y - 3, -4.7],
        [x, y - 0.91, -10.6],
      ];
    };
  loft(
    o,
    'roof',
    Array.from({ length: n + 1 }, (_, i) => ring(north + ((south - north) * i) / n)),
    [0.3, 0.32, 0.34],
  );
  for (let i = 0; i < n; i++) {
    const a = north + ((south - north) * i) / n,
      b = north + ((south - north) * (i + 1)) / n;
    for (const z of [-11.8, 11.8])
      o.addQuad(
        'trim',
        'palette:#ffffff',
        [
          [a, deckY(a), z],
          [b, deckY(b), z],
          [b, deckY(b) - 0.9, z],
          [a, deckY(a) - 0.9, z],
        ],
        [0, 0, Math.sign(z)],
        null,
        blue,
      );
  }
  for (const [sign, count, end] of [
    [-1, 15, north],
    [1, 11, south],
  ])
    for (let i = 1; i <= count; i++) {
      const start = sign * 428,
        x = start + ((end - start) * i) / (count + 1);
      box(o, 'wall', [x - 1.9, -0.5 - shift, -4.6], [x + 1.9, deckY(x) - 3.3, 4.6], concrete);
    }
  for (const x of [-428, 428]) {
    for (const s of [-1, 1])
      beam(o, 'wall', [x, 12, s * 15], [x, 139, s * 0.1], 8.5, 5.47, concrete);
    box(o, 'wall', [x - 3.8, 139, -2.735], [x + 3.8, 214, 2.735], concrete);
    box(o, 'foundation', [x - 9, -0.5 - shift, -23.5], [x + 9, 12, 23.5], concrete);
    const stayCount = detail ? 23 : 5;
    for (const dir of [-1, 1])
      for (let i = 0; i < stayCount; i++)
        for (const side of detail ? [-1, 1] : [0]) {
          const t = i / (stayCount - 1),
            distance = 20 + t * 398,
            tx = x + dir * distance;
          beam(
            o,
            'trim',
            [x + dir * 3.75, 145 + t * 63, side],
            [tx, deckY(tx) + 0.36, side * 10],
            detail ? 0.3 : 0.5,
            detail ? 0.3 : 0.5,
            cable,
          );
        }
  }
}
export const buildNormandieSkyline = (out) => buildFar(out, false);
export const buildNormandieDistrict = (out) => buildFar(out, true);
