import { rgb, tri } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../rough-castle-plan.json' with { type: 'json' };
import elevation from '../roughCastle-elevation.json' with { type: 'json' };

export const surfaces = {
  turf: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.97 },
};
const [left, north, right, south] = site.bounds;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const bump = (x, r) => 1 - smooth(Math.abs(x) / r);
const position = (u, v) => site.origin.map((p, i) => p + u * site.east[i] + v * site.south[i]);

function ground(x, z) {
  const { origin, spacing, values } = elevation;
  const u = (x - origin[0]) / spacing,
    v = (z - origin[1]) / spacing;
  const i = Math.max(0, Math.min(values[0].length - 2, Math.floor(u)));
  const j = Math.max(0, Math.min(values.length - 2, Math.floor(v)));
  return mix(
    mix(values[j][i], values[j][i + 1], clamp(u - i)),
    mix(values[j + 1][i], values[j + 1][i + 1], clamp(u - i)),
    clamp(v - j),
  );
}
function segmentDistance(u, v, [ax, az], [bx, bz]) {
  const dx = bx - ax,
    dz = bz - az;
  const t = clamp(((u - ax) * dx + (v - az) * dz) / (dx * dx + dz * dz));
  return Math.hypot(u - ax - t * dx, v - az - t * dz);
}
const fortWalls = site.fortRing.slice(1, -1).map((a, i) => [a, site.fortRing[i + 2]]);
const annexeWall = [
  [85, 10],
  [84, 56],
  [72, 75],
];
const traverses = [...fortWalls, ...annexeWall.slice(0, -1).map((a, i) => [a, annexeWall[i + 1]])];
const trails = site.paths.flatMap((r) => r.slice(0, -1).map((a, i) => [a, r[i + 1]]));
const photosProfile = [
  [-55, 0],
  [-44, 0.16],
  [-37, 0.92],
  [-31, 0.76],
  [-26, -1.23],
  [-22, -2.6],
  [-17, -3.14],
  [-13, -2.81],
  [-9, -1.42],
  [-4, 0.82],
  [1.3, 1.68],
  [5.6, 1.2],
  [11, 0.17],
  [15, 0],
];
function ditch(u, v) {
  const stage = v - 0.57 * Math.sin(u * 0.074) - 0.39 * Math.sin(u * 0.031);
  const bank = photosProfile.findIndex(([x]) => x > stage);
  if (bank < 1) return 0;
  const [a, A] = photosProfile[bank - 1],
    [b, B] = photosProfile[bank];
  const section = mix(A, B, smooth((stage - a) / (b - a)));
  const ravine = smooth((Math.abs(u - site.crossingU) - 4.4) / 25);
  const taper = 0.87 + 0.1 * Math.sin(u * 0.021) + 0.06 * Math.sin(u * 0.13);
  return section * ravine * taper;
}
function sideWorks(u, v) {
  if (v < 6) return 0;
  const d = Math.min(...traverses.map(([a, b]) => segmentDistance(u, v, a, b)));
  const trailDistance = Math.min(...trails.map(([a, b]) => segmentDistance(u, v, a, b)));
  const bank =
    0.88 * bump(d - 1.88, 4.05) - 0.96 * bump(d - 7.9, 3.38) + 0.35 * bump(d - 13.3, 2.8);
  return bank * smooth((v - 9) / 15) * smooth((trailDistance - 0.84) / 2.8);
}
function pits(u, v, level) {
  if (level < 2) return 0;
  const [a, b, A, B] = site.pitBounds;
  if (u < a || u > A || v < b || v > B) return 0;
  let depth = 0;
  for (const [x, z, w, h, cut] of site.pits) {
    const r = Math.hypot((u - x) / w, (v - z) / h);
    if (r < 1) depth = Math.max(depth, cut * (1 - smooth((r - 0.34) / 0.66)));
  }
  return depth;
}
function sample(u, v, level) {
  const [x, z] = position(u, v);
  const border = Math.min(u - left, right - u, v - north, south - v);
  const fit = smooth(border / 21);
  const cut = pits(u, v, level);
  const relief = fit * (ditch(u, v) + sideWorks(u, v));
  const grass = 0.022 * Math.sin(u * 0.79 + v * 1.32) + 0.031 * Math.sin(u * 0.39 - v * 0.34);
  return { p: [x, ground(x, z) + relief - cut + grass * fit, z], cut, relief };
}
const colors = ['818a55', '929565', '687446', '605947'].map(rgb);
function shade(u, v, a, b, c) {
  const m = 0.5 + 0.26 * Math.sin(u * 0.025 + v * 0.047) + 0.19 * Math.sin(v * 0.116 - u * 0.044);
  const phase = m * 0.74 + 0.26 * Math.sin(u * 0.071 - v * 0.09) * Math.sin(v * 0.16);
  const cut = (a.cut + b.cut + c.cut) / 3;
  const y = (a.relief + b.relief + c.relief) / 3;
  const autumn = clamp(phase + 0.065 * Math.sin(6 * u + 3 * v));
  const tone = colors[0].map((q, i) => mix(q, colors[1][i], autumn));
  const mixDitch = clamp(-0.21 * y);
  return tone.map((q, i) => mix(mix(q, colors[2][i], mixDitch), colors[3][i], clamp(cut * 1.73)));
}
const between = (lo, hi, step) =>
  Array.from({ length: Math.ceil((hi - lo) / step) + 1 }, (_, i) => Math.min(hi, lo + i * step));
function makeGrid(level) {
  const ls = [30, 16, 10, 5.9][level],
    cs = [18, 12, 7.9, 4.7][level];
  const us = between(left, right, ls);
  const vs = between(north, south, cs);
  vs.push(...photosProfile.filter((_, i) => level > 0 || i % 2 === 0).map(([d]) => d));
  if (level > 1) {
    const [a, b, A, B] = site.pitBounds;
    us.push(...between(a, A, level === 2 ? 0.55 : 0.29));
    vs.push(...between(b, B, level === 2 ? 0.55 : 0.29));
  }
  const unique = (list) =>
    list.sort((a, b) => a - b).filter((x, i) => i === 0 || x - list[i - 1] > 0.036);
  return [unique(us), unique(vs)];
}
function build(out, level) {
  const [us, vs] = makeGrid(level);
  const geo = vs.map((v) => us.map((u) => sample(u, v, level)));
  for (let j = 0; j < vs.length - 1; j++)
    for (let i = 0; i < us.length - 1; i++) {
      const a = geo[j][i],
        b = geo[j][i + 1],
        c = geo[j + 1][i + 1],
        d = geo[j + 1][i];
      const u = (us[i] + us[i + 1]) * 0.5,
        v = (vs[j] + vs[j + 1]) * 0.5;
      tri(out, 'turf', a.p, d.p, c.p, shade(u, v, a, d, c));
      tri(out, 'turf', a.p, c.p, b.p, shade(u, v, a, c, b));
    }
  // Match the sampled grade at the footprint edge and skirt small provider differences.
  const near = geo[0],
    far = geo.at(-1);
  const edge = [
    ...near,
    ...geo.slice(1, -1).map((row) => row.at(-1)),
    ...far.slice().reverse(),
    ...geo
      .slice(1, -1)
      .reverse()
      .map((row) => row[0]),
  ];
  for (let i = 0; i < edge.length; i++) {
    const { p: a } = edge[i],
      { p: b } = edge[(i + 1) % edge.length];
    const below = ([x, y, z]) => [x, y - 1.58, z];
    tri(out, 'turf', a, b, below(b), colors[0]);
    tri(out, 'turf', a, below(b), below(a), colors[0]);
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
