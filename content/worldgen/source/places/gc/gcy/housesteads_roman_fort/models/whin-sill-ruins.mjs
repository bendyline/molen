import {
  abox,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98 },
  rubble: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.98 },
  coping: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.95 },
};
const stones = ['a99d83', 'b1a78d', 'a39c87', 'b0a38b', 'a9a18d'].map(rgb);
const colorBase = rgb('958e7b'),
  capstone = rgb('b5ac96'),
  inset = rgb('9c957f');
const lerp = (a, b, t) => a + (b - a) * t;

function approx(points, tolerance) {
  if (points.length < 3 || !tolerance) return points;
  const a = points[0],
    b = points.at(-1);
  const v = b.map((x, i) => x - a[i]),
    dot = v.reduce((s, x) => s + x * x, 0);
  let best = tolerance,
    index = 0;
  for (let j = 1; j < points.length - 1; j++) {
    const delta = points[j].map((x, i) => x - a[i]);
    const ratio =
      dot === 0 ? 0 : Math.max(0, Math.min(1, delta.reduce((s, x, i) => s + x * v[i], 0) / dot));
    const e = Math.hypot(...delta.map((x, i) => x - ratio * v[i]));
    if (e > best) {
      best = e;
      index = j;
    }
  }
  if (!index) return [a, b];
  return [
    ...approx(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...approx(points.slice(index), tolerance),
  ];
}

function normal(a, b) {
  const x = b[0] - a[0],
    z = b[1] - a[1],
    length = Math.hypot(x, z) || 1;
  return [-z / length, x / length];
}

function run(out, detail, path) {
  const tolerance =
    detail === 0 ? (path.kind === 'rampart' ? 0.34 : 0.74) : detail === 1 ? 0.24 : 0.036;
  const points = approx(path.points, tolerance);
  if (points.length < 2) return;
  const closed =
    points.length > 3 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
  const stations = points.map(([x, z, y], i) => {
    const p = points[i],
      prev = points[i - 1] ?? (closed ? points.at(-2) : p);
    const next = points[i + 1] ?? (closed ? points[1] : p);
    const n = normal(prev, p),
      m = normal(p, next);
    const s =
      i === 0 && !closed ? m : i === points.length - 1 && !closed ? n : [n[0] + m[0], n[1] + m[1]];
    const factor =
      closed || (i > 0 && i < points.length - 1)
        ? Math.min(0.81, 0.5 / Math.max(0.55, 1 + n[0] * m[0] + n[1] * m[1]))
        : 0.5;
    const crest = y + path.crest + 0.11 * Math.sin(x * 0.43 + z * 0.21 + (path.id % 13));
    const position = (direction, width, height) => [
      x + direction * s[0] * factor * width,
      height,
      z + direction * s[1] * factor * width,
    ];
    return {
      front: position(1, path.width, y - 0.92),
      frontTop: position(1, path.width * 0.84, crest),
      backTop: position(-1, path.width * 0.84, crest),
      back: position(-1, path.width, y - 0.92),
    };
  });
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    const length = Math.hypot(a.front[0] - b.front[0], a.front[2] - b.front[2]);
    if (length < 0.019) continue;
    const tone = stones[(i + path.id) % stones.length];
    quad4(out, 'wall', a.front, b.front, b.frontTop, a.frontTop, tone);
    quad4(out, 'wall', b.back, a.back, a.backTop, b.backTop, tone);
    quad4(out, 'coping', a.frontTop, b.frontTop, b.backTop, a.backTop, capstone);
    if (detail < 2 || length < 1.08) continue;
    for (const [near, far, nt, ft] of [
      [a.front, b.front, a.frontTop, b.frontTop],
      [b.back, a.back, b.backTop, a.backTop],
    ]) {
      const matrix = (u, t) =>
        near.map((v, j) => lerp(lerp(v, far[j], u), lerp(nt[j], ft[j], u), t));
      const x = far[0] - near[0],
        z = far[2] - near[2],
        step = Math.hypot(x, z) || 1;
      const seam = (u, t) => {
        const p = matrix(u, t);
        return [p[0] - (0.014 * z) / step, p[1], p[2] + (0.014 * x) / step];
      };
      const rows = detail === 2 ? 2 : path.kind === 'rampart' ? 5 : 3;
      for (let j = 1; j < rows; j++) {
        const y = 0.44 + (0.53 * j) / rows;
        quad4(out, 'rubble', seam(0, y), seam(1, y), seam(1, y + 0.03), seam(0, y + 0.03), inset);
        if (detail !== 3 || length < 1.75) continue;
        const n = Math.ceil(length / 1.52);
        for (let k = 1; k < n; k++) {
          const u = (k + (j % 2 ? 0.24 : -0.19)) / n;
          quad4(
            out,
            'rubble',
            seam(u, y),
            seam(u + 0.024 / length, y),
            seam(u + 0.024 / length, y + 0.45 / rows),
            seam(u, y + 0.45 / rows),
            colorBase,
          );
        }
      }
    }
  }
  if (!closed) {
    const a = stations[0],
      b = stations.at(-1);
    quad4(out, 'wall', a.back, a.front, a.frontTop, a.backTop, colorBase);
    quad4(out, 'wall', b.front, b.back, b.backTop, b.frontTop, colorBase);
  }
}

function gateJamb(out, p, detail) {
  const r = outwardRing(p.outline),
    y = p.base + p.height;
  for (const [i, a] of r.entries()) {
    const f = wallFace(a, r[(i + 1) % r.length]);
    if (f.length < 0.021) continue;
    const G = f.P;
    quad4(
      out,
      'wall',
      G(0, p.base - 0.72),
      G(f.length, p.base - 0.72),
      G(f.length, y),
      G(0, y),
      stones[(p.id + i) % 5],
    );
    if (detail > 1)
      quad4(
        out,
        'rubble',
        G(0, p.base + 0.29, 0.015),
        G(f.length, p.base + 0.29, 0.015),
        G(f.length, p.base + 0.34, 0.015),
        G(0, p.base + 0.34, 0.015),
        inset,
      );
  }
  cap(out, 'coping', r, y, capstone);
}

function granarySupports(out, detail) {
  const stride = [7, 2, 1, 1][detail];
  for (let i = 0; i < site.supports.length; i += stride) {
    const { x, z, base } = site.supports[i],
      r = 0.29 + (i % 3) * 0.028;
    abox(
      out,
      'rubble',
      [x - r, base - 0.41, z - r],
      [x + r, base + 0.43 + (i % 4) * 0.053, z + r],
      stones[i % stones.length],
      { bottom: false },
    );
    if (detail === 3)
      abox(
        out,
        'coping',
        [x - r * 0.93, base + 0.43 + (i % 4) * 0.053, z - r * 0.92],
        [x + r * 0.93, base + 0.55 + (i % 4) * 0.053, z + r * 0.92],
        capstone,
        { bottom: false },
      );
  }
}

function build(out, detail) {
  for (const p of site.outer) run(out, detail, p);
  for (const p of site.rooms) {
    if (detail > 0 || ['granary', 'headquarters', 'hospital', 'latrines'].includes(p.kind))
      run(out, detail, p);
  }
  if (detail > 0)
    for (const p of site.small) {
      const a = p.points[0],
        b = p.points.at(-1);
      if (detail > 1 || Math.hypot(a[0] - b[0], a[1] - b[1]) > 3.3) run(out, detail, p);
    }
  for (const p of site.jambs) gateJamb(out, p, detail);
  granarySupports(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
