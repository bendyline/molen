import {
  facade,
  fbox,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  timber: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  plinth: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  sash: { slot: 'trim', graph: 'metal_painted', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
};

const timber = rgb('e4d4ae'),
  cream = rgb('eee0bb'),
  shade = rgb('bbab8c');
const sash = rgb('7c6251'),
  glazing = rgb('5d696c'),
  lintel = rgb('e8dbb9');
const metal = rgb('a19787'),
  roofShade = rgb('857b70'),
  stone = rgb('a39e8e'),
  base = rgb('bdb39a');
const F = facade(site.facade.origin, site.facade.along);
const rings = outwardRing(site.wings),
  eaves = site.eaves,
  foundation = site.foundation;
const edges = (ring) => ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
const rear = ([x, z]) => (x - F.origin[0]) * F.normal[0] + (z - F.origin[1]) * F.normal[1];

function panel(out, slot, f, u, v, y, Y, d, color) {
  quad4(out, slot, f.P(u, y, d), f.P(v, y, d), f.P(v, Y, d), f.P(u, Y, d), color);
}
function windowFace(out, f, lo, hi, y, Y, story, detail) {
  const d = -0.19,
    mid = (lo + hi) * 0.5;
  const arched = story === 0;
  const spring = arched ? Y - 0.63 : Y;
  panel(out, 'glass', f, lo, hi, y, spring, d, glazing);
  if (arched) {
    const n = detail === 3 ? 7 : 4;
    const radius = (hi - lo) * 0.5;
    for (let i = 0; i < n; i++) {
      const t = (Math.PI * i) / n,
        T = (Math.PI * (i + 1)) / n;
      const u = mid - radius * Math.cos(t),
        v = mid - radius * Math.cos(T);
      const P = f.P(u, spring + 0.63 * Math.sin(t)),
        Q = f.P(v, spring + 0.63 * Math.sin(T));
      tri(out, 'glass', f.P(mid, spring, d), f.P(v, Q[1], d), f.P(u, P[1], d), glazing);
      if (P[1] < Y - 0.00001 && Q[1] < Y - 0.00001)
        quad4(out, 'timber', P, Q, f.P(v, Y), f.P(u, Y), timber);
      else if (P[1] < Y - 0.00001) tri(out, 'timber', P, Q, f.P(u, Y), timber);
      else if (Q[1] < Y - 0.00001) tri(out, 'timber', P, Q, f.P(v, Y), timber);
      if (detail === 3) {
        const a = f.P(u, P[1], 0.07),
          b = f.P(v, Q[1], 0.07);
        const outer0 = f.P(
          mid - (radius + 0.105) * Math.cos(t),
          spring + 0.745 * Math.sin(t),
          0.075,
        );
        const outer1 = f.P(
          mid - (radius + 0.105) * Math.cos(T),
          spring + 0.745 * Math.sin(T),
          0.075,
        );
        quad4(out, 'trim', a, b, outer1, outer0, cream);
      }
    }
  }
  if (detail < 2) return;
  if (detail === 2) {
    panel(out, 'trim', f, lo - 0.11, hi + 0.11, y - 0.09, y, 0.089, shade);
    if (!arched) panel(out, 'trim', f, lo - 0.13, hi + 0.13, Y, Y + 0.12, 0.09, cream);
    return;
  }
  fbox(out, 'trim', f, lo - 0.096, lo, y, spring, d, 0.045, cream);
  fbox(out, 'trim', f, hi, hi + 0.098, y, spring, d, 0.045, cream);
  fbox(out, 'trim', f, lo - 0.138, hi + 0.138, y - 0.085, y, d, 0.12, shade);
  fbox(
    out,
    'sash',
    f,
    lo,
    hi,
    y + (spring - y) * 0.49,
    y + (spring - y) * 0.49 + 0.045,
    d,
    0.009,
    sash,
  );
  if (!arched) {
    fbox(out, 'trim', f, lo - 0.12, hi + 0.12, Y, Y + 0.1, d, 0.095, cream);
    if (story === 1)
      tri(
        out,
        'trim',
        f.P(lo - 0.16, Y + 0.113, 0.115),
        f.P(hi + 0.16, Y + 0.113, 0.115),
        f.P(mid, Y + 0.33, 0.115),
        lintel,
      );
  }
}
function fenestration(out, f, a, b, detail, hasDoor = false) {
  const rows = [
    [0.84, 3.53],
    [4.6, 6.86],
    [8.0, 10.19],
    [11.58, 13.54],
  ];
  const width = b - a;
  const bays = Math.max(1, Math.round(width / [1, 6.1, 3.18, 2.86][detail]));
  let last = foundation;
  for (const [i, [y, Y]] of rows.entries()) {
    panel(out, 'timber', f, a, b, last, y, 0, timber);
    if (detail === 0 || width < 1.42) {
      panel(
        out,
        detail === 0 && width >= 1.42 ? 'glass' : 'timber',
        f,
        a,
        b,
        y,
        Y,
        0,
        detail === 0 && width >= 1.42 ? glazing : timber,
      );
    } else {
      for (let j = 0; j < bays; j++) {
        const u = a + (j * width) / bays,
          v = a + ((j + 1) * width) / bays;
        const lo = u + (v - u) * 0.235,
          hi = v - (v - u) * 0.235;
        panel(out, 'timber', f, u, lo, y, Y, 0, timber);
        panel(out, 'timber', f, hi, v, y, Y, 0, timber);
        if (
          hasDoor &&
          i === 0 &&
          (j === Math.floor(bays * 0.5) || j === Math.floor((bays - 1) * 0.5))
        ) {
          panel(out, 'sash', f, lo, hi, y, Y, -0.16, sash);
          if (detail > 1)
            fbox(out, 'trim', f, lo - 0.07, hi + 0.07, Y, Y + 0.17, -0.19, 0.11, cream);
        } else windowFace(out, f, lo, hi, y, Y, i, detail);
      }
    }
    last = Y;
  }
  panel(out, 'timber', f, a, b, last, eaves, 0, timber);
}
function walls(out, detail) {
  for (const f of edges(rings)) {
    const width = f.length;
    const isEntrance =
      Math.abs(rear(f.origin)) < 0.11 &&
      Math.abs(f.normal[0] * F.normal[0] + f.normal[1] * F.normal[1] - 1) < 0.01;
    fenestration(out, f, 0, width, detail, isEntrance);
    panel(out, 'plinth', f, 0, width, foundation, 0.39, 0.025, base);
    if (detail > 0) {
      for (const [y, Y, d] of [
        [3.78, 4.1, 0.14],
        [7.26, 7.51, 0.13],
        [10.82, 11.08, 0.135],
        [14.14, 14.49, 0.19],
      ]) {
        panel(out, 'trim', f, 0, width, y, Y, d, cream);
      }
    }
    if (detail === 3 && width >= 4.6) {
      for (const u of [0.25, width - 0.25])
        for (let j = 0; j < 13; j++) {
          const y = 0.59 + j * 0.478;
          panel(
            out,
            'trim',
            f,
            u - 0.145,
            u + (j % 2 ? 0.16 : 0.32),
            y,
            y + 0.075,
            0.071,
            j % 2 ? shade : lintel,
          );
        }
    }
  }
  cap(out, 'roof', site.wings, eaves, metal);
}
function hip(out, a, b, d, D, y, Y) {
  const h = Math.min((b - a) * 0.44, (D - d) * 0.42),
    mid = (a + b) * 0.5;
  const p = F.P;
  quad4(out, 'roof', p(a, y, D), p(b, y, D), p(mid, Y, D - h), p(mid - 0.17, Y, D - h), metal);
  quad4(out, 'roof', p(b, y, d), p(a, y, d), p(mid - 0.17, Y, d + h), p(mid, Y, d + h), roofShade);
  quad4(
    out,
    'roof',
    p(a, y, d),
    p(a, y, D),
    p(mid - 0.17, Y, D - h),
    p(mid - 0.17, Y, d + h),
    roofShade,
  );
  quad4(out, 'roof', p(b, y, D), p(b, y, d), p(mid, Y, d + h), p(mid, Y, D - h), metal);
  quad4(
    out,
    'roof',
    p(mid - 0.17, Y, D - h),
    p(mid, Y, D - h),
    p(mid, Y, d + h),
    p(mid - 0.17, Y, d + h),
    metal,
  );
}
function rooftop(out, detail) {
  hip(out, -39.5, -22.1, -43.28, 7.86, eaves, 18.44);
  hip(out, 24.12, 40.59, -42.76, 8.52, eaves, 18.11);
  const p = F.P;
  quad4(
    out,
    'roof',
    p(-22.5, eaves, -4.93),
    p(24.8, eaves, -4.93),
    p(24.8, 17.01, -12.8),
    p(-22.5, 17.01, -12.8),
    metal,
  );
  quad4(
    out,
    'roof',
    p(24.8, eaves, -20.56),
    p(-22.5, eaves, -20.56),
    p(-22.5, 17.01, -12.8),
    p(24.8, 17.01, -12.8),
    roofShade,
  );
  quad4(
    out,
    'roof',
    p(-7.55, eaves, 0.09),
    p(7.72, eaves, 0.09),
    p(7.72, 17.64, -7.69),
    p(-7.55, 17.64, -7.69),
    metal,
  );
  fbox(out, 'trim', F, -7.6, 7.8, 14.43, 14.68, -0.04, 0.18, cream);
  if (detail > 0) {
    for (const [u, d] of [
      [-31.0, -24.8],
      [-31.0, -5.1],
      [-14.2, -13.5],
      [13.6, -13.5],
      [32.1, -23.2],
      [33.4, -4.9],
    ]) {
      fbox(out, 'trim', F, u - 0.43, u + 0.43, 16.18, 19.23, d - 0.37, d + 0.37, cream);
      fbox(out, 'trim', F, u - 0.54, u + 0.54, 19.15, 19.34, d - 0.47, d + 0.47, shade);
    }
  }
}
function column(out, face, u, d, low, top, r, detail) {
  const [x, , z] = face.P(u, 0, d);
  const profile =
    detail === 0
      ? [
          [low, r, r],
          [top, r * 0.88, r * 0.88],
        ]
      : [
          [low, r * 1.19, r * 1.19],
          [low + 0.135, r, r],
          [top - 0.21, r * 0.84, r * 0.84],
          [top, r * 1.13, r * 1.13],
        ];
  lathe(out, 'trim', [x, z], profile, detail < 2 ? 6 : 10, cream, { capTop: true });
}
function porches(out, detail) {
  for (const { id, outline } of site.shadedPorches) {
    const ring = outwardRing(outline),
      main = id === 832078469;
    const y = main ? 4.61 : 3.84;
    for (const face of edges(ring)) panel(out, 'trim', face, 0, face.length, y - 0.37, y, 0, cream);
    cap(out, 'roof', ring, y, metal);
    if (main) {
      const n = detail === 0 ? 3 : 7;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        fbox(
          out,
          'plinth',
          F,
          -3.76,
          3.77,
          -1.4,
          -0.38 + t * (site.threshold + 0.38),
          -0.12,
          6.1 - 2.42 * t,
          stone,
        );
      }
      for (const u of [-3.02, -1.71, 1.71, 3.02])
        column(out, F, u, 3.22, site.threshold, y - 0.37, 0.238, detail);
    } else {
      const front = edges(ring).reduce((a, b) => (b.length > a.length ? b : a));
      for (const u of [0.17, 0.84])
        column(out, front, front.length * u, -0.12, 0.24, y - 0.38, 0.166, detail);
    }
  }
}
function build(out, detail) {
  walls(out, detail);
  rooftop(out, detail);
  porches(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
