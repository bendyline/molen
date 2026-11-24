import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  mud: { slot: 'wall', graph: 'plaster_lime', roughness: 0.99 },
  terrace: { slot: 'roof', graph: 'earth_rammed', roughness: 0.99 },
  palms: { slot: 'trim', graph: 'wood_log', roughness: 0.96 },
  plinth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.99 },
};

const F = facade(site.frame.origin, site.frame.along);
const P = F.P;
const xz = ([x, , z]) => [x, z];
const muds = ['a68e70', 'aa9173', 'b29a7a', 'a18a6d', 'b39a7c'].map(rgb);
const umber = rgb('594a3b');
const sand = rgb('a99779');
const timber = ['7b674f', '836e58', '685846'].map(rgb);
const g = site.grade,
  W = site.frame.width,
  D = site.frame.depth;
const cx = W * 0.5,
  cz = D * 0.5;
const tiers = [
  [
    [0.02, W * 0.496, D * 0.496, 0],
    [2.43, 5.1, 5.81, 0.035],
    [5.67, 4.56, 5.38, 0.12],
  ],
  [
    [5.67, 4.19, 4.88, 0.07],
    [8.81, 3.78, 4.38, 0.19],
    [9.52, 3.63, 4.23, 0.24],
    [11.43, 3.26, 3.87, 0.38],
  ],
  [
    [11.43, 2.79, 3.45, 0.33],
    [14.83, 2.24, 2.77, 0.42],
    [16.6, 1.68, 2.22, 0.5],
    [17, 1.44, 1.99, 0.54],
  ],
];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((x, i) => lerp(x, b[i], t));
const plan = ([y, u, d, s]) => [
  P(cx + s - u, g + y, cz + d),
  P(cx + s + u, g + y, cz + d),
  P(cx + s + u, g + y, cz - d),
  P(cx + s - u, g + y, cz - d),
];

function slab(out, slot, ring, a, b, c) {
  extrude(out, slot, ring, a, b, c, { top: false });
  cap(out, slot, ring, b, c);
}

function batteredCourse(out, A, B, tint, recess) {
  for (const [i, a] of A.entries()) {
    const k = (i + 1) % 4,
      b = A[k],
      c = B[k],
      d = B[i];
    if (i !== 3 || !recess) {
      quad4(out, 'mud', a, b, c, d, tint);
      continue;
    }
    const l = 0.56,
      r = 0.72;
    const O = [mix(a, b, l), mix(a, b, r), mix(d, c, r), mix(d, c, l)];
    const inset = O.map(([x, y, z]) => [x + F.along[0] * 0.56, y, z + F.along[1] * 0.56]);
    quad4(out, 'mud', a, O[0], O[3], d, tint);
    quad4(out, 'mud', O[1], b, c, O[2], tint);
    quad4(out, 'mud', ...inset, umber);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      quad4(out, 'mud', O[j], O[k], inset[k], inset[j], muds[3]);
    }
  }
}

function palmCourses(out, detail) {
  const sides = detail === 0 ? 2 : 4,
    steps = [4, 7, 11, 14][detail];
  for (let j = 0; j < steps; j++) {
    const h = 1.12 + (j * 14.9) / steps;
    const stack = tiers.find((t) => t.at(-1)[0] >= h);
    const i = stack.findIndex((s) => s[0] >= h);
    const bounds = mix(
      stack[i - 1],
      stack[i],
      (h - stack[i - 1][0]) / (stack[i][0] - stack[i - 1][0]),
    );
    const ring = outwardRing(plan(bounds).map(xz));
    for (let k = 0; k < sides; k++) {
      const v = (k + (detail === 0 ? 1 : 0)) % 4;
      const f = wallFace(ring[v], ring[(v + 1) % 4]);
      const n =
        detail === 0
          ? 2
          : Math.max(2, Math.round(f.length / (detail === 3 ? 1.16 : detail === 2 ? 1.56 : 2.45)));
      for (let p = 0; p < n; p++) {
        const q = ((p + 0.52 + 0.12 * Math.sin(p * 1.83 + j)) * f.length) / n;
        if (v === 3 && h > 9.42 && h < 11.49 && q / f.length > 0.53 && q / f.length < 0.76)
          continue;
        const dy = 0.14 + 0.17 * Math.sin(j * 2.1 + p * 2.0 + v * 0.63);
        const len = 0.41 + 0.36 * (0.5 + 0.5 * Math.cos(j * 2.71 + p * 4.36 + v));
        const w = 0.124 + 0.05 * Math.cos(p * 4.21 + j);
        const a = f.P(q, g + h + dy, -0.18);
        const b = f.P(q + 0.12 * Math.sin(j + p), g + h + dy + 0.09, len * 0.51);
        const c = f.P(q + 0.21 * Math.sin(j + p), g + h + dy + 0.12 + 0.1 * Math.sin(j), len);
        if (detail === 3) {
          beam(out, 'palms', a, b, w, w * 0.83, timber[(p + j + 1) % 3]);
          beam(out, 'palms', b, c, w * 0.79, w * 0.68, timber[(p + j + 1) % 3]);
        } else beam(out, 'palms', a, c, w, w * 0.82, timber[(p + j + 1) % 3]);
      }
    }
  }
}

function westernStair(out, detail) {
  const stairs = [
    { x: 1.03, y: g + 0.06, Y: g + 5.7, a: 11.65, b: 2.34 },
    { x: 2.42, y: g + 5.68, Y: g + 10.49, a: 2.35, b: 8.74 },
  ];
  for (const { x, y, Y, a, b } of stairs) {
    const n = [3, 7, 12, 23][detail];
    for (let i = 0; i < n; i++) {
      const t = i / n,
        q = (i + 1) / n;
      const d = lerp(a, b, t),
        D = lerp(a, b, q);
      const x0 = x + 0.45 * t;
      fbox(
        out,
        'terrace',
        F,
        x0 - 0.71,
        x0 + 0.78,
        y - 0.045,
        lerp(y, Y, q),
        Math.min(d, D) - 0.018,
        Math.max(d, D) + 0.021,
        muds[(i + 1) % 5],
      );
      if (detail > 1) {
        fbox(
          out,
          'mud',
          F,
          x0 - 0.75,
          x0 - 0.53,
          lerp(y, Y, t) - 0.011,
          lerp(y, Y, q) + 0.73,
          Math.min(d, D) - 0.015,
          Math.max(d, D) + 0.019,
          muds[2],
        );
      }
    }
  }
}

function tomb(out, detail) {
  slab(out, 'plinth', site.terrace, g - 2.6, g + 0.024, sand);
  for (const [j, stack] of tiers.entries()) {
    for (const [k, B] of stack.entries()) {
      if (k > 0)
        batteredCourse(
          out,
          plan(stack[k - 1]),
          plan(B),
          muds[(j * 2 + k) % 5],
          j === 1 && k === stack.length - 1,
        );
    }
    const top = stack.at(-1);
    cap(out, 'terrace', plan(top).map(xz), g + top[0], muds[j]);
  }
  westernStair(out, detail);
  palmCourses(out, detail);
}

function mosque(out, part, detail) {
  const { outline, grade: g, height: h } = part;
  const ring = outwardRing(outline);
  const facingCourtyard = part.role === 'west hall' ? 1 : -1;
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    const long = f.length > 25,
      isFront = long && f.normal[0] * facingCourtyard > 0.45;
    const pad = 0.095 * Math.min(f.length, 5.6);
    const run = (u, U) => fbox(out, 'mud', f, u, U, g - 2.32, g + h - 0.52, -0.48, 0, muds[i % 5]);
    if (!isFront) {
      run(0, f.length);
      continue;
    }
    const bays = detail === 0 ? 3 : 6,
      d = f.length / bays;
    for (let j = 0; j < bays; j++) {
      const x = j * d,
        u = x + 0.54 * d;
      const r = 0.54 + 0.078 * (j % 3);
      run(x, u - r);
      run(u + r, x + d);
      fbox(out, 'mud', f, u - r, u + r, g + 2.08, g + h - 0.52, -0.46, 0, muds[1]);
      fbox(out, 'mud', f, u - r, u + r, g - 0.55, g + 2.06, -1.05, -0.51, umber);
      if (detail > 0)
        fbox(
          out,
          'mud',
          f,
          x + pad - 0.35,
          x + pad + 0.35,
          g - 0.86,
          g + h - 0.63,
          -0.12,
          0.52,
          muds[2],
        );
      if (detail > 1)
        for (let k = 0; k < 3; k++) {
          const q = x + 0.97 + ((k + 1) * (d - 1.09)) / 4;
          beam(
            out,
            'palms',
            f.P(q, g + h - 0.65, -0.14),
            f.P(q, g + h - 0.58, 0.38),
            0.108,
            0.103,
            timber[(k + j) % 3],
          );
        }
    }
  }
  cap(out, 'terrace', outline, g + h - 0.53, muds[2]);
  for (const [i, a] of ring.entries()) {
    const f = wallFace(a, ring[(i + 1) % ring.length]);
    fbox(out, 'mud', f, 0, f.length, g + h - 0.74, g + h - 0.04, -0.29, 0.052, muds[i % 5]);
    if (detail > 0)
      for (let j = 0, n = Math.ceil(f.length / (detail === 3 ? 2.22 : 3.46)); j < n; j++) {
        const q = ((j + 0.5) * f.length) / n;
        tri(
          out,
          'mud',
          f.P(q - 0.28, g + h - 0.049, 0.057),
          f.P(q + 0.27, g + h - 0.049, 0.057),
          f.P(q + 0.022, g + h + 0.28, 0.058),
          muds[3],
        );
      }
  }
}

function courtWalls(out, detail) {
  const [north, south] = site.wallRuns;
  for (const [i, [a, b]] of [north, south].entries()) {
    const f = wallFace(a, b),
      m = f.length * (i === 0 ? 0.72 : 0.24);
    for (const [x, X] of [
      [0, m - 1.19],
      [m + 1.19, f.length],
    ]) {
      fbox(out, 'mud', f, x, X, -2.18, 2.13, -0.34, 0.39, muds[2]);
      if (detail > 0) {
        fbox(out, 'terrace', f, x, X, 2.11, 2.27, -0.42, 0.49, muds[0]);
        for (let j = 0, n = Math.ceil((X - x) / 4.68); j < n; j++) {
          const u = x + ((j + 0.5) * (X - x)) / n;
          fbox(out, 'mud', f, u - 0.26, u + 0.27, -1.3, 2.06, -0.69, 0.68, muds[2]);
        }
      }
    }
  }
}

function build(out, detail) {
  tomb(out, detail);
  for (const part of site.mosques) mosque(out, part, detail);
  courtWalls(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
