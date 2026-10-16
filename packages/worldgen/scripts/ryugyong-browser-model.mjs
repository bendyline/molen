/** Ryugyong derivatives keep all mapped wings and the separate conical crown. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, cross, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  cap,
  face,
  grid as fullGrid,
  localGeographic,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('n0143_ryugyong_hotel', 'map-frame.json'))),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  };
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function slopedCurtain(out, a, b, y0, topA, topB, color, dx, dy, frame, frameColor) {
  if (Math.max(topA, topB) <= y0 + 0.001) return;
  const n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / dx));
  const top = (s) => topA + (topB - topA) * s;
  const corner = (s, y) => [a[0] + (b[0] - a[0]) * s, y, a[1] + (b[1] - a[1]) * s];
  const wall = [
    corner(0, y0),
    corner(1, y0),
    corner(1, Math.max(y0, topB)),
    corner(0, Math.max(y0, topA)),
  ];
  if (topA <= y0 + 0.001 || topB <= y0 + 0.001) {
    // The roof meets the floor line inside the edge: the wall is a triangle.
    const cut = (y0 - topA) / (topB - topA);
    const points =
      topA <= y0 + 0.001
        ? [corner(cut, y0), corner(1, y0), corner(1, topB)]
        : [corner(0, y0), corner(cut, y0), corner(0, topA)];
    if (Math.hypot(...normalFor(...points)) > 0.5) tri(out, 'glass', points, color);
  } else face(out, 'glass', wall, color);
  const normal = normalFor(wall[0], wall[1], wall[2]);
  const lift = (p) => shift(p, normal, 0.02);
  const strip = (points) => {
    if (Math.hypot(...normalFor(...points)) > 1e-9)
      face(out, 'metal', points.map(lift), frameColor);
  };
  const u = Math.min(0.22, frame / (Math.hypot(a[0] - b[0], a[1] - b[1]) / n)) / n;
  for (let j = 0; j <= n; j++) {
    const s0 = Math.max(0, j / n - u),
      s1 = Math.min(1, j / n + u);
    const t0 = top(s0),
      t1 = top(s1);
    if (Math.min(t0, t1) <= y0) continue;
    strip([corner(s0, y0), corner(s1, y0), corner(s1, t1), corner(s0, t0)]);
  }
  // Floor lines run only where the wall stands above them; the roof edge has its own strip.
  for (let y = y0; y < Math.max(topA, topB) - 0.001; y += dy) {
    const lo = y - (y > y0 ? frame : 0),
      hi = y + frame;
    let s0 = 0,
      s1 = 1;
    if (topA !== topB) {
      const s = (hi - topA) / (topB - topA);
      if (topB > topA) s0 = Math.max(0, s);
      else s1 = Math.min(1, s);
    } else if (topA < hi) continue;
    if (s1 - s0 < 1e-6) continue;
    strip([corner(s0, lo), corner(s1, lo), corner(s1, hi), corner(s0, hi)]);
  }
  if (topA > y0 + frame && topB > y0 + frame)
    strip([corner(0, topA - frame), corner(1, topB - frame), corner(1, topB), corner(0, topA)]);
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    m = map,
    segments = [8, 16, 32, 72][tier];
  const grid = (o, p, color, dx, dy, frame, fc) =>
    fullGrid(
      o,
      p,
      color,
      dx * [30, 12, 4, 1][tier],
      dy * [20, 14, 4, 1][tier],
      tier < 2 ? 0 : frame,
      fc,
    );
  const glazedOutline = (o, p, lo, hi, dy, color, fc, fr) => {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
      grid(
        o,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        color,
        1.6,
        dy,
        fr,
        fc,
      );
    }
  };
  const podium = localOutline(m);
  mappedSolid(out, 'stone', podium, 0, 0.5, [0.58, 0.59, 0.56]);
  glazedOutline(out, podium, 0.5, 11.8, 5.9, [0.24, 0.34, 0.38], [0.58, 0.63, 0.65], 0.12);
  mappedCap(out, 'concrete', podium, 11.8, [0.52, 0.56, 0.57]);
  for (const part of partsEvidence('n0143_ryugyong_hotel')) {
    const plan = partPlan(m, part),
      height = +part.tags.height,
      rise = +(part.tags['roof:height'] ?? 0),
      bearing = (+(part.tags['roof:direction'] ?? 0) * Math.PI) / 180;
    const east = Math.sin(bearing),
      south = -Math.cos(bearing),
      dir = [
        east * Math.cos(m.heading) - south * Math.sin(m.heading),
        east * Math.sin(m.heading) + south * Math.cos(m.heading),
      ];
    const projection = plan.map((p) => p[0] * dir[0] + p[1] * dir[1]),
      lo = Math.min(...projection),
      hi = Math.max(...projection);
    const roof = (p) =>
      height - (rise ? (rise * (p[0] * dir[0] + p[1] * dir[1] - lo)) / (hi - lo) : 0);
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      slopedCurtain(
        out,
        a,
        b,
        11.8,
        roof(a),
        roof(b),
        [0.28, 0.4, 0.46],
        1.55 * [30, 12, 4, 1][tier],
        3.12 * [20, 14, 4, 1][tier],
        tier === 0 ? 0 : 0.045,
        [0.55, 0.64, 0.68],
      );
      if (tier > 0)
        beam(
          out,
          'metal',
          [a[0], roof(a), a[1]],
          [b[0], roof(b), b[1]],
          0.14,
          0.16,
          [0.67, 0.74, 0.76],
        );
    }
    for (const indices of ShapeUtils.triangulateShape(
      plan.map((p) => new Vector2(...p)),
      [],
    )) {
      let points = indices.map((i) => [plan[i][0], roof(plan[i]), plan[i][1]]);
      if (normalFor(...points)[1] < 0) points = points.toReversed();
      tri(out, 'glass', points, [0.34, 0.44, 0.5]);
    }
  }
  const center = localGeographic(m, 125.7308679, 39.0365178);
  const crown = [
    [250, 25.5],
    [278.5, 17.5],
    [286, 14.8],
    [294, 12.2],
    [302, 9.2],
    [311, 6.3],
    [318, 4.1],
    [326, 2.0],
    [329.8, 0.18],
  ];
  for (let j = 1; j < crown.length; j++) {
    const [y0, r0] = crown[j - 1],
      [y1, r1] = crown[j],
      a = radialRing(y0, r0, r0, segments, center),
      b = radialRing(y1, r1, r1, segments, center);
    for (let i = 0; i < segments; i++)
      grid(
        out,
        [a[i], a[(i + 1) % segments], b[(i + 1) % segments], b[i]],
        [0.3, 0.42, 0.48],
        1.5,
        3.6,
        0.065,
        [0.6, 0.68, 0.7],
      );
    if (tier > 1)
      torus(
        out,
        'metal',
        [center[0], y0, center[1]],
        r0 + 0.1,
        0.13,
        [0.63, 0.7, 0.72],
        segments,
        6,
      );
    else {
      const lower = radialRing(y0 - 0.13, r0 + 0.1, r0 + 0.1, segments, center),
        upper = radialRing(y0 + 0.13, r0 + 0.1, r0 + 0.1, segments, center);
      for (let i = 0; i < segments; i++) {
        const k = (i + 1) % segments;
        face(out, 'metal', [lower[i], lower[k], upper[k], upper[i]], [0.63, 0.7, 0.72]);
      }
    }
    if (j === crown.length - 1) cap(out, 'metal', b, [0.6, 0.67, 0.7]);
  }
  tube(
    out,
    'metal',
    [center[0], 329.5, center[1]],
    [center[0], 330, center[1]],
    0.12,
    [0.64, 0.69, 0.71],
    12,
  );
}

export const buildRyugyongSkyline = (o) => build(o, 0),
  buildRyugyongDistrict = (o) => build(o, 1),
  buildRyugyongStreet = (o) => build(o, 2),
  buildRyugyongCloseup = (o) => build(o, 3);
