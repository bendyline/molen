/** Complete authored distance geometry; the detailed exterior master is preserved. */
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  buildSkopjeBridge,
  buildSkopjeNicheMedium,
  skopjeDeck as deck,
  skopjeArchPoint as point,
  skopjeStudy,
  skopjeSolid as solid,
} from '../../../../../../../../packages/worldgen/scripts/skopje-bridge-exterior.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const half = 109.458947,
  stone = [0.79, 0.765, 0.685],
  pale = [0.87, 0.85, 0.78],
  brick = [0.66, 0.4, 0.27],
  arches = skopjeStudy.reconstruction.arches;
// Preserve each asymmetric mapped projection, including the unpaired low restored piers.
const piers = [
  {
    p: [
      [-48.84, -3.06],
      [-48.8, -7.45],
      [-44.29, -11.88],
      [-39.82, -7.34],
      [-39.72, -2.95],
    ],
    h: 4.8,
    cap: 'pyramid',
  },
  {
    p: [
      [-30.66, -3.14],
      [-30.76, -7.83],
      [-26.87, -11.88],
      [-22.84, -8.01],
      [-22.77, -3.08],
    ],
    h: 4.8,
    cap: 'pyramid',
  },
  {
    p: [
      [-11.97, -3.21],
      [-12.03, -7.32],
      [-8.34, -11.14],
      [-4.44, -7.38],
      [-4.43, -3.07],
    ],
    h: 4.8,
    cap: 'pyramid',
  },
  {
    p: [
      [-47.69, 2.73],
      [-47.74, 7.44],
      [-43.12, 11.88],
      [-38.68, 7.27],
      [-38.65, 2.88],
    ],
    h: 2.55,
    cap: 'well',
  },
  {
    p: [
      [-30.15, 2.93],
      [-30.18, 7.06],
      [-21.45, 7.02],
      [-21.41, 3.15],
    ],
    h: 2.6,
    cap: 'flat',
  },
  {
    p: [
      [-11.93, 3.24],
      [-11.97, 6.98],
      [-7.69, 10.88],
      [-4.12, 6.97],
      [-4.14, 3.26],
    ],
    h: 2.55,
    cap: 'well',
  },
  {
    p: [
      [-61.12, 2.47],
      [-61.14, 4.81],
      [-56.69, 4.85],
      [-56.67, 2.66],
    ],
    h: 6.3,
    cap: 'pyramid',
  },
  {
    p: [
      [-61.9, -3.36],
      [-61.89, -5.1],
      [-55.78, -5.04],
      [-55.79, -3.11],
    ],
    h: 6.1,
    cap: 'flat',
  },
];
const wedge = (out, a, b, loA, loB, hiA, hiB, z0, z1, tint, slot = 'stone') =>
  solid(
    out,
    [
      [a, loA],
      [b, loB],
      [b, hiB],
      [a, hiA],
    ],
    z0,
    z1,
    tint,
    slot,
  );
function pier(out, { p, h, cap }, far) {
  const area = p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + a[0] * b[1] - b[0] * a[1];
  }, 0);
  if (area > 0) p = [...p].reverse();
  const cx = p.reduce((n, v) => n + v[0], 0) / p.length,
    cz = p.reduce((n, v) => n + v[1], 0) / p.length;
  const ring = (y, s = 1) => p.map(([x, z]) => [cx + (x - cx) * s, y, cz + (z - cz) * s]);
  if (far) {
    loft(
      out,
      'stone',
      [ring(0, 1.1), ring(h), ...(cap === 'pyramid' ? [ring(h + 2.3, 0.14)] : [])],
      stone,
    );
    return;
  }
  loft(
    out,
    'stone',
    [ring(0, 1.1), ring(0.85, 1.1), ring(1.12, 1.025), ring(1.12), ring(h)],
    stone,
  );
  if (cap === 'pyramid') loft(out, 'stone', [ring(h, 1.025), ring(h + 2.3, 0.14)], pale);
  if (cap === 'well') {
    // Low open walls stay open; do not turn the restored well into a tall mirrored cutwater.
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length,
        a = ring(h)[i],
        b = ring(h)[j],
        c = ring(h + 0.75)[j],
        d = ring(h + 0.75)[i],
        A = ring(h + 0.75, 0.8)[i],
        B = ring(h + 0.75, 0.8)[j],
        aa = ring(h, 0.8)[i],
        bb = ring(h, 0.8)[j];
      quad(out, 'stone', [a, b, c, d], normalFor(a, b, c), pale);
      quad(out, 'stone', [d, c, B, A], [0, 1, 0], pale);
      quad(out, 'stone', [A, B, bb, aa], normalFor(A, B, bb), stone);
    }
  }
}
function parapets(out, far) {
  const cuts = [-half, -59, 4.8, 8.7, 11.6, 12, 14.2, half];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1],
      mid = (a + b) / 2;
    for (const side of [-1, 1]) {
      if ((side > 0 && mid > 4.8 && mid < 11.6) || (side < 0 && mid > 8.7 && mid < 14.2)) continue;
      const z = side * 2.99;
      wedge(out, a, b, deck(a), deck(b), deck(a) + 1.02, deck(b) + 1.02, z - 0.23, z + 0.23, pale);
      if (!far)
        wedge(
          out,
          a,
          b,
          deck(a) - 0.38,
          deck(b) - 0.38,
          deck(a) - 0.19,
          deck(b) - 0.19,
          side < 0 ? -3.39 : 3.07,
          side < 0 ? -3.07 : 3.39,
          pale,
        );
    }
  }
}
function farNiche(out) {
  box(out, 'stone', [4.98, 0.8, 3.13], [11.42, 11.26, 4.99], stone);
  box(out, 'stone', [6.85, 11.2, 4.27], [9.55, 15.6, 4.86], stone);
  for (const x of [6.84, 9.56])
    box(out, 'stone', [x - 0.3, 11.2, 3.13], [x + 0.3, 14.75, 4.3], pale);
  loft(
    out,
    'stone',
    [
      [
        [6.72, 15.6, 3.01],
        [6.72, 15.6, 4.99],
        [9.68, 15.6, 4.99],
        [9.68, 15.6, 3.01],
      ],
      [
        [8.18, 16.55, 4.02],
        [8.18, 16.55, 4.06],
        [8.22, 16.55, 4.06],
        [8.22, 16.55, 4.02],
      ],
    ],
    pale,
  );
  box(out, 'stone', [8.995, 10.88, -5.44], [14.043, 11.2, -3.03], pale);
  for (const [a, b, c, d] of [
    [8.995, 9.3, -5.44, -3.12],
    [13.74, 14.043, -5.44, -3.12],
    [9.3, 13.74, -5.44, -5.1],
  ])
    box(out, 'stone', [a, 11.2, c], [b, 12.11, d], pale);
}
function build(out, far) {
  let cursor = -half;
  for (const a of arches) {
    const margin = a.brick && !far ? 0.62 : 0,
      left = a.x - a.span / 2 - margin,
      right = a.x + a.span / 2 + margin,
      parts = far ? 3 : 10;
    if (left > cursor) wedge(out, cursor, left, 0, 0, deck(cursor), deck(left), -3.19, 3.19, stone);
    for (let i = 0; i < parts; i++) {
      const u = point(a, i / parts),
        v = point(a, (i + 1) / parts);
      if (a.brick && !far) {
        const U = point(a, i / parts, 0.62),
          V = point(a, (i + 1) / parts, 0.62);
        solid(out, [u, v, V, U], -3.2, 3.2, brick, 'brick');
        wedge(out, U[0], V[0], U[1], V[1], deck(U[0]), deck(V[0]), -3.19, 3.19, stone);
      } else wedge(out, u[0], v[0], u[1], v[1], deck(u[0]), deck(v[0]), -3.19, 3.19, stone);
    }
    if (margin)
      for (const side of [-1, 1]) {
        const x = a.x + (side * a.span) / 2;
        box(
          out,
          'stone',
          [side < 0 ? x - margin : x, 0, -3.19],
          [side < 0 ? x : x + margin, a.spring, 3.19],
          stone,
        );
      }
    cursor = right;
  }
  wedge(out, cursor, half, 0, 0, deck(cursor), deck(half), -3.19, 3.19, stone);
  parapets(out, far);
  for (const p of piers) pier(out, p, far);
  if (far) farNiche(out);
  else buildSkopjeNicheMedium(out);
}
export function buildSkopjeSkyline(out) {
  build(out, true);
}
export function buildSkopjeDistrict(out) {
  build(out, false);
}
function near(out, level) {
  buildSkopjeBridge(out, { runtimeLevel: level });
  parapets(out, false);
  // One closed walk surface follows the actual three-piece deck grade. Fine masonry lives
  // in shared surfaces; do not retain a field of collapsed individual paving side faces.
  const cuts = [-half, -59, 12, half];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i],
      b = cuts[i + 1];
    wedge(out, a, b, deck(a) - 0.11, deck(b) - 0.11, deck(a), deck(b), -2.78, 2.78, pale, 'paving');
  }
}
export function buildSkopjeStreet(out) {
  near(out, 'street');
}
export function buildSkopjeCloseup(out) {
  near(out, 'closeup');
}
