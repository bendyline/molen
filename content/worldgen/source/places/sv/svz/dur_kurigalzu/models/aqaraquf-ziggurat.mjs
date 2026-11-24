import { deform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
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
  mudbrick: { slot: 'wall', graph: 'earth_adobe', roughness: 0.98 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.96 },
  courses: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.97 },
};
const sand = rgb('c19f72'),
  plaster = rgb('b5a082'),
  soil = rgb('a79575');
const brick = rgb('b59369'),
  umber = rgb('9b805e'),
  reed = rgb('c4ae85');
const inset = rgb('907858'),
  dust = rgb('aa9271');
const ground = site.foundationBottom,
  base = site.baseHeight;
const frame = facade([0, 0], site.along);

function face(out, slot, f, a, b, y0, y1, d, color) {
  const p = f.P;
  quad4(out, slot, p(a, y0, d), p(b, y0, d), p(b, y1, d), p(a, y1, d), color);
}

function masonry(out, ring, bottom, top, slot = 'brick', color = brick) {
  const r = outwardRing(ring);
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length > 0.011) face(out, slot, f, 0, f.length, bottom, top, 0, color);
  }
  cap(out, slot, r, top, color);
}

function podium(out, detail) {
  const r = outwardRing(site.plan);
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]),
      l = f.length;
    if (l < 0.018) continue;
    if (detail === 0 || l < 3.5) {
      face(out, 'brick', f, 0, l, ground, base, 0, i % 3 === 0 ? sand : brick);
      continue;
    }
    const n = Math.max(1, Math.round(l / [0, 4.25, 3.42, 2.95][detail]));
    face(out, 'brick', f, 0, l, ground, 1.24, 0, brick);
    face(out, 'brick', f, 0, l, base - 0.69, base, 0, sand);
    const w = 0.17,
      gap = l / n;
    for (let j = 0; j < n; j++) {
      const a = j * gap,
        b = a + gap,
        u = (a + b) / 2;
      face(out, 'brick', f, a, u - w, 1.24, base - 0.69, 0, brick);
      face(out, 'brick', f, u + w, b, 1.24, base - 0.69, 0, sand);
      face(out, 'brick', f, u - w, u + w, 1.24, base - 0.69, -0.16, inset);
      if (detail > 1) {
        const p = f.P;
        quad4(
          out,
          'courses',
          p(u - w, 1.24, -0.16),
          p(u - w, 1.24, 0),
          p(u - w, base - 0.69, 0),
          p(u - w, base - 0.69, -0.16),
          umber,
        );
        quad4(
          out,
          'courses',
          p(u + w, 1.24, 0),
          p(u + w, 1.24, -0.16),
          p(u + w, base - 0.69, -0.16),
          p(u + w, base - 0.69, 0),
          dust,
        );
      }
    }
  }
  cap(out, 'brick', r, base, sand);
  for (const { outline, height } of site.solidParts) masonry(out, outline, ground, height);
}

const coreShape = outwardRing([
  [-1, -0.62],
  [-0.7, -0.84],
  [-0.18, -1],
  [0.31, -0.93],
  [0.72, -0.76],
  [0.91, -0.39],
  [1, 0.12],
  [0.86, 0.61],
  [0.59, 0.91],
  [0.11, 1],
  [-0.4, 0.86],
  [-0.76, 0.73],
  [-0.99, 0.35],
  [-0.91, -0.16],
]);
const coreProfile = [
  [base - 0.01, 23.31, 21.64, -12.48, 10.72, 0],
  [22.39, 22.83, 21.26, -12.27, 10.92, 0.8],
  [25.74, 20.64, 20.75, -12.83, 11.26, 1.47],
  [29.23, 20.37, 18.28, -12.39, 10.62, 2.41],
  [32.51, 19.18, 16.66, -12.66, 10.05, 3.35],
  [36.05, 17.13, 14.31, -13.42, 11.07, 4.69],
  [39.85, 16.6, 12.45, -13.66, 11.31, 5.82],
  [43.27, 15.23, 11.22, -14.19, 12.4, 7.64],
  [47.35, 12.04, 8.89, -14.43, 13.07, 9.08],
  [site.peakHeight, 10.38, 7.22, -15.24, 13.72, 10.36],
];

function teeth(detail) {
  const n = [1, 2, 3, 5][detail];
  return coreShape.flatMap(([a, b], i) =>
    Array.from({ length: n }, (_, j) => {
      const [c, d] = coreShape[(i + 1) % coreShape.length],
        t = j / n;
      return [a + (c - a) * t, b + (d - b) * t];
    }),
  );
}

function core(out, detail) {
  const ring = teeth(detail),
    profile = detail === 0 ? [0, 2, 4, 6, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const shape = (row, offset = 0) => {
    const [y, rx, rz, x, z, drop] = coreProfile[row];
    return ring.map(([u, d], i) => {
      const variation =
        0.99 +
        0.037 * Math.sin(0.88 * i + row * 1.29) +
        (detail > 1 ? 0.016 * Math.cos(i * 2.5 - row) : 0);
      const fall = drop * Math.max(0, (u + 0.57) * 0.633);
      const relief =
        row === 9 ? Math.min(0, Math.sin(i * 0.63) * 0.31 - 0.1) : Math.sin(i * 0.73 + row) * 0.34;
      return [
        x + (rx + offset) * u * variation,
        y - fall + relief,
        z + (rz + offset) * d * variation,
      ];
    });
  };
  let previous = shape(profile[0]);
  for (const row of profile.slice(1)) {
    const next = shape(row);
    const count = detail === 0 ? 1 : detail === 1 ? 2 : detail === 2 ? 4 : 6;
    const point = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
    const strip = (lo, hi, slot, shade) => {
      const a = previous.map((p, i) => point(p, next[i], lo)),
        b = previous.map((p, i) => point(p, next[i], hi));
      const width = slot === 'courses' ? 0.112 : 0;
      const extend = ([a, y, b], i) => [a + ring[i][0] * width, y, b + ring[i][1] * width];
      for (let i = 0; i < ring.length; i++) {
        const k = (i + 1) % ring.length;
        const color = slot === 'courses' ? reed : shade[(i + row) % shade.length];
        tri(out, slot, extend(a[i], i), extend(a[k], k), extend(b[k], k), color);
        tri(out, slot, extend(a[i], i), extend(b[k], k), extend(b[i], i), color);
      }
    };
    for (let j = 0; j < count; j++) {
      const a = j / count,
        b = (j + 1) / count;
      strip(a, b, 'mudbrick', [soil, dust, plaster, sand, umber]);
      if (detail > 0 && row >= 2 && j > 0) strip(a, a + 0.023 / count, 'courses', [reed]);
    }
    previous = next;
  }
  const c = [-15.24, 47.9, 13.72];
  for (const [i, p] of previous.entries())
    tri(out, 'mudbrick', p, previous[(i + 1) % previous.length], c, soil);
}

function flights(out, detail) {
  for (const tread of site.flights) {
    if (detail === 3) {
      for (const [i, p] of tread.entries())
        masonry(out, p.outline, ground, p.height, 'brick', i % 3 === 0 ? sand : brick);
      continue;
    }
    // The two ends of each surveyed flight fix its coarse treads.
    const a = tread[0],
      b = tread.at(-1),
      f = wallFace(a.center, b.center);
    const P = f.P;
    const proj = ([x, z], dir) => dir[0] * (x - a.center[0]) + dir[1] * (z - a.center[1]);
    const low = Math.min(...a.outline.map((p) => proj(p, f.along))),
      high = Math.max(...b.outline.map((p) => proj(p, f.along)));
    const half = Math.min(1.57, Math.max(...a.outline.map((p) => Math.abs(proj(p, f.normal)))));
    const n = [4, 9, 24][detail];
    for (let i = 0; i < n; i++) {
      const start = low + ((high - low) * i) / n,
        end = low + ((high - low) * (i + 1)) / n;
      const top = a.height + ((b.height - a.height) * (i + 1)) / n;
      fbox(out, 'brick', f, start, end, ground, top, -half, half, i % 5 === 0 ? sand : brick);
    }
    if (detail > 0) {
      const side = (s) => [
        P(low, a.height, s),
        P(high, b.height, s),
        P(high, b.height + 0.7, s),
        P(low, a.height + 0.7, s),
      ];
      for (const s of [-half, half]) {
        const p = side(s);
        quad4(out, 'courses', ...(s > 0 ? p : p.reverse()), sand);
      }
    }
  }
}

function platform(out, detail) {
  const r = outwardRing(site.platform),
    y = 2.95;
  masonry(out, r, ground, y, 'brick', sand);
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (i === 0) {
      const n = [3, 5, 9, 13][detail],
        u = f.length * 0.5;
      for (let j = 0; j < n; j++)
        fbox(
          out,
          'brick',
          f,
          u - 3.25,
          u + 3.25,
          ground,
          y - (j * (y - 0.08)) / n,
          (j * 4.3) / n,
          ((j + 1) * 4.3) / n,
          brick,
        );
    }
    if (detail > 0) {
      const segments =
        i === 0
          ? [
              [0, f.length * 0.41],
              [f.length * 0.59, f.length],
            ]
          : [[0, f.length]];
      for (const [a, b] of segments) fbox(out, 'mudbrick', f, a, b, y, y + 0.53, -0.63, 0, soil);
    }
  }
}

function build(out, detail) {
  const local = deform(out, ([x, y, z]) => frame.P(x, y, z));
  podium(local, detail);
  core(local, detail);
  flights(local, detail);
  platform(local, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
