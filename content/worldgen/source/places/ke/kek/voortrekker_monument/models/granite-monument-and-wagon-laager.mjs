import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_granite', roughness: 0.95 },
  podium: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  relief: { slot: 'trim', graph: 'stone_granite', roughness: 0.9 },
  plaza: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.97 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.93 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74 },
};

const F = facade(site.frame.origin, site.frame.along);
const { grade: g, height: H } = site;
const W = site.frame.width,
  D = site.frame.depth,
  mid = W * 0.5;
const xz = ([x, , z]) => [x, z];
const X = (u, d) => xz(F.P(u, 0, d));
const brown = rgb('998777');
const sand = rgb('aa9985');
const light = rgb('c5b7a5');
const dark = rgb('665c54');
const rail = rgb('79716c');
const rose = rgb('ad8f78');
const ash = rgb('aaa092');
const glass = rgb('585854');
const tau = 2 * Math.PI;
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const panel = (out, slot, f, u, U, y, Y, d, c) =>
  quad4(out, slot, f.P(u, y, d), f.P(U, y, d), f.P(U, Y, d), f.P(u, Y, d), c);
function slab(out, slot, ring, y, Y, c) {
  extrude(out, slot, ring, y, Y, c, { top: false });
  cap(out, slot, ring, Y, c);
}

function archFace(out, f, detail, entry) {
  const width = f.length,
    u = width * 0.5;
  const half = 8.56,
    sill = g + 5.44,
    spring = g + 15.68,
    rise = 8.21;
  const r0 = u - half,
    r1 = u + half,
    top = g + 29.8;
  for (const [a, b] of [
    [0, r0],
    [r1, width],
  ])
    fbox(out, 'masonry', f, a, b, g - 0.13, top, -1.85, 0.01, brown);
  const door = 0.95;
  if (entry) {
    fbox(out, 'masonry', f, r0, u - door, g - 0.13, sill, -1.74, 0.01, brown);
    fbox(out, 'masonry', f, u + door, r1, g - 0.13, sill, -1.74, 0.01, brown);
    fbox(out, 'masonry', f, u - door, u + door, g + 2.83, sill, -1.73, 0.011, sand);
    panel(out, 'window', f, u - door, u + door, g + 0.015, g + 2.83, -1.16, glass);
    if (detail > 0) {
      for (const x of [u - door - 0.29, u + door + 0.29])
        fbox(out, 'relief', f, x - 0.165, x + 0.165, g + 0.01, g + 2.97, -0.011, 0.193, light);
      fbox(
        out,
        'relief',
        f,
        u - door - 0.46,
        u + door + 0.46,
        g + 2.97,
        g + 3.29,
        -0.016,
        0.189,
        light,
      );
    }
  } else fbox(out, 'masonry', f, r0, r1, g - 0.12, sill, -1.85, 0.011, brown);
  const arc = (a, w, y, d) => f.P(u + w * Math.cos(a), spring + y * Math.sin(a), d);
  const n = [6, 9, 16, 24][detail];
  for (let i = 0; i < n; i++) {
    const t = (i * Math.PI) / n,
      q = ((i + 1) * Math.PI) / n;
    const A = arc(t, half, rise, 0),
      B = arc(q, half, rise, 0);
    quad4(
      out,
      'masonry',
      B,
      A,
      f.P(u + half * Math.cos(t), top, 0),
      f.P(u + half * Math.cos(q), top, 0),
      brown,
    );
    quad4(out, 'relief', A, B, arc(q, half, rise, -1.47), arc(t, half, rise, -1.47), dark);
    quad4(
      out,
      'relief',
      arc(q, half, rise, 0.019),
      arc(t, half, rise, 0.019),
      arc(t, half + 1.02, rise + 1.18, 0.058),
      arc(q, half + 1.02, rise + 1.18, 0.058),
      sand,
    );
    if (detail === 3)
      quad4(
        out,
        'relief',
        arc(q - 0.015, half + 0.89, rise + 1.03, 0.067),
        arc(t + 0.015, half + 0.89, rise + 1.03, 0.067),
        arc(t + 0.015, half + 1.02, rise + 1.19, 0.072),
        arc(q - 0.015, half + 1.02, rise + 1.19, 0.072),
        light,
      );
    const b = f.P(u, spring - 0.27, -1.505);
    tri(out, 'window', b, arc(t, half, rise, -1.505), arc(q, half, rise, -1.505), glass);
  }
  panel(out, 'window', f, r0, r1, sill, spring, -1.505, glass);
  for (const x of [r0, r1]) {
    fbox(out, 'relief', f, x - 0.22, x + 0.22, sill - 0.04, spring + 0.126, -1.48, 0.13, sand);
  }
  const beamEnds = (a, b, w, c, d = -0.76) => {
    if (detail > 1) {
      beam(out, 'relief', f.P(a[0], a[1], d), f.P(b[0], b[1], d), w, 0.2, c);
      return;
    }
    const sign = Math.sign(b[0] - a[0]);
    const q = (p, offset) => f.P(p[0], p[1] + offset * sign, d);
    quad4(out, 'relief', q(a, -w), q(b, -w), q(b, w), q(a, w), c);
  };
  const cols = 5,
    w = (2 * half) / cols;
  const archTop = (x) =>
    spring + rise * Math.sqrt(Math.max(0, 1 - ((x - u) * (x - u)) / (half * half)));
  for (let i = 1; i < cols; i++) {
    const x = r0 + w * i;
    fbox(out, 'relief', f, x - 0.18, x + 0.19, sill, archTop(x) - 0.12, -1.4, -0.47, light);
  }
  if (detail > 0)
    for (let i = 0; i < cols; i++) {
      const a = r0 + w * i + 0.29,
        b = r0 + w * (i + 1) - 0.29;
      const max = Math.min(archTop(a), archTop(b)) - 0.22;
      const side = detail === 3 ? 1.32 : detail === 2 ? 1.75 : 3.2;
      for (let y = sill + 0.18; y + side * 0.92 < max; y += side) {
        const cy = y + side * 0.47;
        const m = (a + b) / 2;
        const tone = detail === 1 ? sand : light;
        beamEnds([a, y], [b, y + side * 0.9], 0.13, tone);
        beamEnds([b, y], [a, y + side * 0.9], 0.13, tone);
        if (detail > 1) {
          beamEnds([a, cy], [b, cy], 0.099, tone);
          if (detail === 3) beamEnds([m, y], [m, y + side * 0.9], 0.094, tone);
        }
      }
    }
  if (detail > 0) {
    for (const x of [3.57, width - 3.57])
      for (const y of [g + 4.0, g + 8.6, g + 13.53, g + 18.64, g + 23.2]) {
        panel(out, 'window', f, x - 0.29, x + 0.29, y, y + 1.02, 0.054, glass);
      }
    for (const y of [g + 3.7, g + 5.03, g + 26.58, g + 29.0])
      fbox(out, 'relief', f, 0.013, width - 0.013, y, y + 0.21, 0.032, 0.256, sand);
  }
}

function crown(out, detail) {
  const ring = (t, y) => [
    F.P(t, y, -t),
    F.P(W - t, y, -t),
    F.P(W - t, y, -D + t),
    F.P(t, y, -D + t),
  ];
  const stages = [
    [0, 29.78],
    [0.13, 31.6],
    [2.17, 33.6],
    [4.05, 36.28],
    [4.39, 38.4],
    [7.12, 38.46],
    [7.12, 39.03],
    [11.77, 39.09],
    [11.77, 40],
  ];
  const used = detail === 0 ? stages.filter((_, i) => i !== 1 && i !== 3) : stages;
  for (let j = 1; j < used.length; j++) {
    const a = ring(used[j - 1][0], g + used[j - 1][1]),
      b = ring(used[j][0], g + used[j][1]);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      quad4(out, 'masonry', a[i], a[k], b[k], b[i], j % 2 === 0 ? sand : brown);
    }
  }
  const top = ring(11.77, g + H);
  quad4(out, 'podium', ...top, ash);
  if (detail === 0) return;
  const s = ring(0, g + 36.1).map(xz);
  for (const [i, a] of s.entries()) {
    const f = wallFace(a, s[(i + 1) % s.length]);
    const n = 8,
      dx = (f.length - 8.5) / (n + 1);
    for (let j = 1; j <= n; j++) {
      const u = 4.25 + dx * j;
      quad4(
        out,
        'window',
        f.P(u - 0.38, g + 34.1, -2.45),
        f.P(u + 0.38, g + 34.1, -2.45),
        f.P(u + 0.38, g + 36.28, -3.96),
        f.P(u - 0.38, g + 36.28, -3.96),
        glass,
      );
      quad4(
        out,
        'window',
        f.P(u - 0.38, g + 36.28, -3.96),
        f.P(u + 0.38, g + 36.28, -3.96),
        f.P(u + 0.38, g + 37.85, -4.23),
        f.P(u - 0.38, g + 37.85, -4.23),
        glass,
      );
    }
  }
}

function steps(out, f, half, y, Y, start, end, n) {
  for (let i = 0; i < n; i++) {
    const d = mix(start, end, i / n),
      high = mix(y, Y, (i + 1) / n);
    fbox(out, 'podium', f, -half, half, y - 0.54, high, end - 0.07, d, i % 6 === 0 ? ash : rose);
  }
}

function approach(out, detail) {
  const n = [4, 7, 14, 28][detail];
  const f = facade(X(site.entry[0], 0), F.along);
  fbox(out, 'podium', f, -15.2, 15.2, -2.4, g, -0.2, 3.13, brown);
  steps(out, f, 13.25, -0.73, g, 14.68, 3.01, n);
  steps(out, f, 7.65, -2.21, -0.73, 41.44, 33.71, [2, 5, 9, 13][detail]);
  if (detail > 1)
    for (const x of [-13, 13]) {
      beam(out, 'metal', f.P(x, 0.372, 14.67), f.P(x, g + 1.03, 3.02), 0.041, 0.042, rail);
      for (let j = 0; j < 5; j++) {
        const t = j / 4,
          d = mix(14.67, 3.02, t),
          y = mix(-0.63, g, t);
        beam(out, 'metal', f.P(x, y, d), f.P(x, y + 1.02, d), 0.043, 0.043, rail);
      }
    }
}

function curvedLength(path) {
  return path
    .slice(1)
    .reduce((acc, b, i) => acc + Math.hypot(b[0] - path[i][0], b[1] - path[i][1]), 0);
}

function wallPoles(out, detail) {
  const path =
    detail === 0
      ? site.laager.filter((_, i) => i % 3 === 0 || i === site.laager.length - 1)
      : site.laager;
  const length = curvedLength(path);
  let distance = 0;
  let cart = 0;
  for (let i = 1; i < path.length; i++) {
    const f = wallFace(path[i], path[i - 1]);
    fbox(out, 'masonry', f, 0, f.length, -3.6, 1.1, -0.48, 0.56, brown);
    if (detail > 0) fbox(out, 'relief', f, 0, f.length, 1.1, 1.27, -0.54, 0.64, sand);
    while (cart < 64 && ((cart + 0.5) * length) / 64 < distance + f.length) {
      const u = f.length - (((cart + 0.5) * length) / 64 - distance);
      cart++;
      if (detail === 0) continue;
      const w = Math.min((length / 64) * 0.39, 1.61),
        y = 0.17;
      fbox(out, 'relief', f, u - w, u + w, y - 0.2, y + 0.16, 0.49, 0.87, sand);
      for (let j = 0, n = detail === 1 ? 3 : detail === 2 ? 5 : 8; j < n; j++) {
        const a = -Math.PI / 2 + (j * Math.PI) / n,
          b = -Math.PI / 2 + ((j + 1) * Math.PI) / n;
        quad4(
          out,
          'relief',
          f.P(u + w * Math.sin(a), y + 0.164, 0.872),
          f.P(u + w * Math.sin(b), y + 0.164, 0.872),
          f.P(u + w * Math.sin(b), y + 0.164 + 0.69 * Math.cos(b), 0.87),
          f.P(u + w * Math.sin(a), y + 0.164 + 0.69 * Math.cos(a), 0.87),
          light,
        );
      }
      // Each wagon retains two distinct stone wheels at street and close range.
      if (detail > 1)
        for (const edge of [-1, 1]) {
          const c = u + edge * w * 0.59;
          const n = detail === 3 ? 10 : 7;
          const a = (r, j) =>
            f.P(c + r * Math.cos((j * tau) / n), y - 0.35 + r * Math.sin((j * tau) / n), 0.912);
          for (let j = 0; j < n; j++)
            quad4(out, 'relief', a(0.345, j), a(0.345, j + 1), a(0.23, j + 1), a(0.23, j), sand);
          if (detail === 3)
            for (const j of [0, 1, 2, 3]) {
              const angle = (j * Math.PI) / 4;
              const dx = 0.237 * Math.cos(angle),
                dy = 0.237 * Math.sin(angle);
              beam(
                out,
                'relief',
                f.P(c - dx, y - 0.35 - dy, 0.894),
                f.P(c + dx, y - 0.35 + dy, 0.894),
                0.05,
                0.051,
                light,
              );
            }
        }
    }
    distance += f.length;
  }
}

function build(out, detail) {
  const area =
    detail === 0
      ? site.laager.filter((_, i) => i % 2 === 0 || i === site.laager.length - 1)
      : site.laager;
  slab(out, 'plaza', area, -4.6, -0.84, ash);
  const rect = [X(0, 0), X(W, 0), X(W, -D), X(0, -D)];
  slab(out, 'podium', site.outline, -3.68, g + 0.015, brown);
  for (let j = 0; j < 4; j++) archFace(out, wallFace(rect[j], rect[(j + 1) % 4]), detail, j === 0);
  crown(out, detail);
  approach(out, detail);
  wallPoles(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
