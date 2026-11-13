/** Relocated barrel vaults, approach masonry and detached piers at Alconétar. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.96 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.99 },
};
const colors = {
  stone: [0.548, 0.484, 0.388],
  core: [0.371, 0.323, 0.261],
  ring: [0.607, 0.549, 0.457],
  intrados: [0.472, 0.424, 0.352],
  edge: [0.589, 0.529, 0.439],
  earth: [0.395, 0.337, 0.24],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const color = (name, tone = 1) => colors[name].map((v) => v * tone);
const rand = (x, y, k = 0) =>
  (((Math.imul(x + 104, 1664525) ^ Math.imul(y + 73, 1013904223) ^ Math.imul(k + 3, 1609587929)) >>>
    9) %
    10007) /
  10007;
const up = [0, 1, 0];
function face(out, slot, tone, points, direction) {
  points = points.map((p) => p.map(Math.fround));
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, v, i) => sum + v * direction[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, ref, points, n, undefined, tone);
}
function quad(out, slot, tone, a, b, c, d, dir) {
  face(out, slot, tone, [a, b, c], dir);
  face(out, slot, tone, [a, c, d], dir);
}
function boxBand(out, a, b, tone) {
  const dirs = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(out, 'granite', tone, a[i], a[j], b[j], b[i], dirs[i]);
  }
}
function ring(w, t, extra = 0) {
  const taper = w.taper * t - extra,
    lo = w.center - w.half + taper,
    hi = w.center + w.half - taper;
  const a = w.x0 - extra * 0.36,
    b = w.x1 + extra * 0.36;
  const y0 = mix(w.base, w.top0, t),
    y1 = mix(w.base, w.top1, t);
  return [
    [a, y0, lo],
    [b, y1, lo],
    [b, y1, hi],
    [a, y0, hi],
  ];
}
function stoneFace(out, points, dir, tone, depth, bevel) {
  if (depth === 0) {
    quad(out, 'granite', tone, ...points, dir);
    return;
  }
  const center = points.reduce((p, q) => p.map((v, i) => v + q[i] / 4), [0, 0, 0]);
  const back = points.map((p) => p.map((v, i) => v + dir[i] * 0.006));
  const front = points.map((p) => p.map((v, i) => mix(v, center[i], bevel) + dir[i] * depth));
  quad(out, 'granite', tone, ...front, dir);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const outer = lerp(points[i], points[j], 0.5).map((v, i) => v - center[i] + dir[i] * 0.12);
    quad(
      out,
      'granite',
      tone.map((v) => v * 0.86),
      back[i],
      back[j],
      front[j],
      front[i],
      outer,
    );
  }
}
function courses(out, w, k, tier) {
  const long = w.x1 - w.x0,
    height = (w.top0 + w.top1) * 0.5 - w.base;
  const rowCount = Math.ceil(height / (tier === 2 ? 0.65 : tier === 3 ? 0.43 : 0.385)),
    dirs = [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ];
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4,
      faceWidth = side % 2 === 0 ? long : w.half * 2;
    const cells = Math.max(1, Math.round(faceWidth / (tier === 2 ? 1.1 : tier === 3 ? 0.8 : 0.71))),
      dir = dirs[side];
    for (let j = 0; j < rowCount; j++) {
      const inset = 0.022 + 0.013 * rand(j, k, side),
        bottom = ring(w, (j + inset) / rowCount),
        top = ring(w, (j + 1 - inset) / rowCount);
      for (let i = 0; i < cells; i++) {
        const offset = (index) =>
          index === 0
            ? 0
            : index === cells
              ? 1
              : (index + (j % 2 === 1 ? 0.27 : -0.13) + (rand(index, j, k + side) - 0.5) * 0.22) /
                cells;
        const a = offset(i) + 0.023 / cells,
          b = offset(i + 1) - 0.023 / cells;
        const block = [
          lerp(bottom[side], bottom[next], a),
          lerp(bottom[side], bottom[next], b),
          lerp(top[side], top[next], b),
          lerp(top[side], top[next], a),
        ];
        if (tier >= 3)
          block.forEach((p, corner) => {
            p[1] += (rand(i, j, k + side + corner * 11) - 0.5) * 0.055;
          });
        const variation = 0.84 + rand(i, j, k + side) * 0.27;
        const relief = tier === 2 ? 0 : 0.028 + rand(i, j, k) * 0.048;
        if (!relief) for (const p of block) for (let n = 0; n < 3; n++) p[n] += dir[n] * 0.009;
        stoneFace(
          out,
          block,
          dir,
          color('stone', variation),
          relief,
          0.09 + (tier >= 3 ? 0.09 * rand(i, j, side) : 0),
        );
      }
    }
  }
}
function topStones(out, w, k, tier) {
  const top = ring(w, 1),
    count = Math.max(2, Math.ceil((w.x1 - w.x0) / (tier === 4 ? 0.63 : 0.96)));
  for (let i = 0; i < count; i++)
    for (let row = 0; row < 2; row++) {
      const a = (i + 0.025) / count,
        b = (i + 0.975) / count,
        v = row === 0 ? 0.02 : 0.865,
        depth = 0.11;
      const p = (t) => lerp(top[0], top[1], t),
        q = (t) => lerp(top[3], top[2], t);
      if (rand(i, row, k) < 0.21) continue;
      const quad = [
        lerp(p(a), q(a), v),
        lerp(p(b), q(b), v),
        lerp(p(b), q(b), v + depth),
        lerp(p(a), q(a), v + depth),
      ];
      stoneFace(
        out,
        quad,
        up,
        color('stone', 0.86 + 0.24 * rand(i, row, k + 4)),
        0.085 + 0.23 * rand(i, row, k + 7),
        0.13,
      );
    }
}
function wallMesh(out, w, index, tier) {
  if (w.shoreFooting !== undefined) {
    const upper = ring(w, 0),
      foot = upper.map(([x, , z]) => [x, w.shoreFooting, z]);
    boxBand(out, foot, upper, color('core', 0.88));
  }
  boxBand(
    out,
    ring(w, 0),
    ring(w, 1),
    color(tier >= 2 ? 'core' : 'stone', 0.97 + rand(index, 1) * 0.08),
  );
  quad(out, 'earth', color('earth'), ...ring(w, 1), up);
  if (tier > 0 && index > 1) {
    for (const fraction of index < 6 ? [0.23, 0.56] : [0.32]) {
      boxBand(out, ring(w, fraction, 0.07), ring(w, fraction + 0.026, 0.075), color('edge', 0.94));
      quad(out, 'granite', color('edge'), ...ring(w, fraction + 0.026, 0.075), up);
    }
  }
  if (tier >= 2) courses(out, w, index, tier);
  if (tier > 2) topStones(out, w, index, tier);
}
function archMesh(out, a, index, tier) {
  const center = (a.a + a.b) * 0.5,
    h = (a.b - a.a) * 0.5,
    r = (h * h + a.rise * a.rise) / (2 * a.rise),
    y = a.spring + a.rise - r;
  const angle = Math.asin(h / r),
    segments = [7, 13, 18, 21, 25][tier];
  const point = (t, z, d = 0) => {
    const theta = mix(-angle, angle, t);
    return [center + Math.sin(theta) * (r + d), y + Math.cos(theta) * (r + d), z];
  };
  const top = (t, z) => [
    point(t, z)[0],
    mix(a.top[0], a.top[1], t) + 0.065 * Math.sin(t * Math.PI * 4),
    z,
  ];
  const mid = (lo, hi) => mix(lo, hi, 0.5);
  for (let i = 0; i < segments; i++) {
    const lo = i / segments,
      hi = (i + 1) / segments,
      half = a.half,
      theta = mix(-angle, angle, mid(lo, hi));
    const intrados = [-Math.sin(theta), -Math.cos(theta), 0],
      depthRows = tier < 2 ? 1 : tier === 2 ? 4 : 8;
    for (let row = 0; row < depthRows; row++) {
      const z0 = mix(-half, half, row / depthRows),
        z1 = mix(-half, half, (row + 1) / depthRows);
      quad(
        out,
        'granite',
        color('intrados', 0.89 + 0.16 * rand(i, row, index)),
        point(lo, z0),
        point(hi, z0),
        point(hi, z1),
        point(lo, z1),
        intrados,
      );
    }
    quad(
      out,
      'earth',
      color('earth'),
      top(lo, -half),
      top(hi, -half),
      top(hi, half),
      top(lo, half),
      up,
    );
    for (const side of [-1, 1]) {
      const z = side * half,
        dir = [0, 0, side];
      quad(
        out,
        'granite',
        color(tier > 0 ? 'core' : 'stone', 1.04),
        point(lo, z),
        point(hi, z),
        top(hi, z),
        top(lo, z),
        dir,
      );
      if (tier > 0) {
        const margin = tier >= 2 ? 0.051 / segments : 0,
          zFace = z + side * 0.018;
        const f0 = lo + margin,
          f1 = hi - margin,
          tone = color('ring', 0.9 + rand(i, index, side) * 0.21);
        const stone = [
          point(f0, zFace),
          point(f1, zFace),
          point(f1, zFace, a.thickness),
          point(f0, zFace, a.thickness),
        ];
        stoneFace(out, stone, dir, tone, tier >= 3 ? 0.055 + rand(i, index) * 0.041 : 0, 0.052);
      }
      if (tier >= 2) {
        const zl = z + side * 0.009,
          high0 = top(lo, zl),
          high1 = top(hi, zl);
        const low0 = [
          high0[0],
          Math.min(high0[1] - 0.035, point(lo, zl, a.thickness + 0.027)[1]),
          zl,
        ];
        const low1 = [
          high1[0],
          Math.min(high1[1] - 0.035, point(hi, zl, a.thickness + 0.027)[1]),
          zl,
        ];
        const rows = Math.max(
          1,
          Math.round((high0[1] + high1[1] - low0[1] - low1[1]) / (tier === 2 ? 1.15 : 0.88)),
        );
        for (let row = 0; row < rows; row++) {
          const a = (row + 0.025) / rows,
            b = (row + 0.975) / rows;
          const stone = [
            lerp(low0, high0, a),
            lerp(low1, high1, a),
            lerp(low1, high1, b),
            lerp(low0, high0, b),
          ];
          stoneFace(
            out,
            stone,
            dir,
            color('stone', 0.9 + rand(i, row, index + 5) * 0.19),
            tier >= 3 ? 0.036 : 0,
            0.09,
          );
        }
      }
    }
  }
}
function brokenMasonry(out, tier) {
  for (const [k, w] of layout.brokenShoulders.entries()) {
    const steps = tier === 0 ? 2 : w.steps;
    for (let j = 0; j < steps; j++) {
      const t = j / steps,
        b = w.x1 - 0.46 * t,
        a = w.x0 - 0.75 * t,
        z0 = w.z0 + 0.32 * t,
        z1 = w.z1 - 0.52 * t;
      const y0 = mix(w.y0, w.y1, t),
        y1 = mix(w.y0, w.y1, (j + 1) / steps) - 0.019;
      const ring = (y) => [
        [a, y, z0],
        [b, y, z0],
        [b, y, z1],
        [a, y, z1],
      ];
      boxBand(out, ring(y0), ring(y1), color('stone', 0.9 + 0.13 * rand(j, k)));
      quad(out, 'granite', color('edge'), ...ring(y1), up);
    }
  }
}
export function buildAlconetarLevel(out, level) {
  const tier = tiers[level];
  for (const [i, w] of layout.walls.entries()) wallMesh(out, w, i, tier);
  for (const [i, a] of layout.arches.entries()) archMesh(out, a, i, tier);
  brokenMasonry(out, tier);
}
export const buildAlconetarSkyline = (out) => buildAlconetarLevel(out, 'skyline');
export const buildAlconetarDistrict = (out) => buildAlconetarLevel(out, 'district');
export const buildAlconetarStreet = (out) => buildAlconetarLevel(out, 'street');
export const buildAlconetarCloseup = (out) => buildAlconetarLevel(out, 'closeup');
