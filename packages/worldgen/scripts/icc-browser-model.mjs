/** ICC budgeted glass tower keeps re-entrant corners and all mapped entrance splays. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(
    readFileSync(structureSourcePath('n0154_international_commerce_centre', 'map-frame.json')),
  ),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    glass: [1, 1, 1],
  },
  metal = [0.67, 0.72, 0.75],
  glass = [0.34, 0.46, 0.52];
let tier = 3;
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
    addTriangle(s, r, p, n, u, c) {
      tri(s, p, c);
    },
    addQuad(s, r, p, n, u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, r, p, n, u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function edgeFrames(p) {
  return p
    .map((a, i) => {
      const b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.04);
}
function grid(o, p, color, dx, dy, frame, fc) {
  face(o, 'glass', p, color);
  if (tier === 0) return;
  const n = normalFor(...p.slice(0, 3)),
    at = (u, v) => shift(lerp(lerp(p[0], p[1], u), lerp(p[3], p[2], u), v), n, 0.045),
    len = Math.hypot(...p[1].map((x, i) => x - p[0][i])),
    h = Math.hypot(...p[3].map((x, i) => x - p[0][i])),
    cols = Math.max(1, Math.ceil(len / [100, 40, 6, 3.2][tier])),
    rows = Math.max(1, Math.ceil(h / (dy * [100, 16, 4, 1][tier]))),
    wu = 0.055 / Math.max(len, 1),
    wv = 0.055 / Math.max(h, 1);
  for (let i = 1; i < cols; i++) {
    const u = i / cols;
    face(o, 'metal', [at(u - wu, 0), at(u + wu, 0), at(u + wu, 1), at(u - wu, 1)], fc);
  }
  for (let j = 1; j <= rows; j++) {
    const v = j / rows;
    face(
      o,
      'metal',
      [at(0, Math.max(0, v - wv)), at(1, Math.max(0, v - wv)), at(1, v), at(0, v)],
      fc,
    );
  }
}
function floorCurtain(o, p, lo, hi, floors, color, trim) {
  for (const { a, b } of edgeFrames(p))
    grid(
      o,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      color,
      1.52,
      (hi - lo) / floors,
      0.065,
      trim,
    );
}
function partRoof(m, p, plan, offset = 0) {
  const bearing = (+(p.tags['roof:direction'] ?? 0) * Math.PI) / 180;
  const east = Math.sin(bearing),
    south = -Math.cos(bearing),
    dir = [
      east * Math.cos(m.heading) - south * Math.sin(m.heading),
      east * Math.sin(m.heading) + south * Math.cos(m.heading),
    ];
  const projection = plan.map((q) => q[0] * dir[0] + q[1] * dir[1]),
    lo = Math.min(...projection),
    hi = Math.max(...projection);
  return (q) =>
    +p.tags.height +
    offset -
    (+(p.tags['roof:height'] ?? 0) * (q[0] * dir[0] + q[1] * dir[1] - lo)) / (hi - lo || 1);
}
function slopedGlass(
  out,
  plan,
  roof,
  bottom = 0,
  color = glass,
  megaFrame = false,
  closeRoof = true,
  glassSlot = 'glass',
) {
  for (const { a, b, n, len } of edgeFrames(plan)) {
    const nx = Math.ceil(len / [100, 36, 8, 3.4][tier]),
      top = Math.max(roof(a), roof(b));
    for (let i = 0; i < nx; i++)
      for (let y = bottom; y < top - 0.01; y += [100, 33.2, 16.6, 5.5][tier]) {
        const pa = lerp(a, b, i / nx),
          pb = lerp(a, b, (i + 1) / nx);
        let poly = [
            [0, y],
            [1, y],
            [1, y + [100, 33.2, 16.6, 5.5][tier]],
            [0, y + [100, 33.2, 16.6, 5.5][tier]],
          ],
          clipped = [];
        const limit = (q) => q[1] - roof(lerp(pa, pb, q[0]));
        for (let j = 0; j < poly.length; j++) {
          const p = poly[j],
            q = poly[(j + 1) % poly.length],
            f = limit(p),
            g = limit(q);
          if (f <= 0) clipped.push(p);
          if ((f < 0 && g > 0) || (f > 0 && g < 0)) clipped.push(lerp(p, q, f / (f - g)));
        }
        clipped = clipped.filter(
          (p, j, arr) => j === 0 || Math.hypot(...p.map((v, k) => v - arr[j - 1][k])) > 0.0001,
        );
        if (clipped.length < 3) continue;
        const points = clipped.map(([t, y]) => {
          const q = lerp(pa, pb, t);
          return [q[0], y, q[1]];
        });
        const center = points.reduce(
          (s, p) => s.map((v, k) => v + p[k] / points.length),
          [0, 0, 0],
        );
        const inset = points.map((p) => lerp(p, center, 0.035));
        for (let j = 1; j < inset.length - 1; j++)
          if (Math.hypot(...normalFor(inset[0], inset[j], inset[j + 1])) > 0.5)
            tri(out, glassSlot, [inset[0], inset[j], inset[j + 1]], color);
        for (let j = 0; j < points.length; j++)
          face(
            out,
            'metal',
            [points[j], points[(j + 1) % points.length], inset[(j + 1) % points.length], inset[j]],
            [0.69, 0.74, 0.76],
          );
      }
    if (tier > 0)
      beam(
        out,
        'metal',
        [a[0], bottom, a[1]],
        [a[0], roof(a), a[1]],
        megaFrame ? 0.95 : 0.16,
        megaFrame ? 1.1 : 0.18,
        [0.72, 0.76, 0.77],
      );
    if (tier > 0)
      beam(
        out,
        'metal',
        [a[0], roof(a), a[1]],
        [b[0], roof(b), b[1]],
        megaFrame ? 0.9 : 0.14,
        megaFrame ? 1 : 0.17,
        [0.75, 0.79, 0.79],
      );
    if (megaFrame) {
      const clippedDiagonal = (p, q) => {
        const f = p[1] - roof([p[0], p[2]]) + 0.4,
          g = q[1] - roof([q[0], q[2]]) + 0.4;
        if (f >= 0 && g >= 0) return;
        if (f > 0) p = lerp(p, q, f / (f - g));
        else if (g > 0) q = lerp(q, p, g / (g - f));
        if (Math.hypot(...q.map((v, k) => v - p[k])) > 0.5)
          beam(out, 'metal', shift(p, n, 0.18), shift(q, n, 0.18), 0.72, 0.9, [0.76, 0.8, 0.81]);
      };
      for (let y = 8; y < top; y += 52) {
        clippedDiagonal([a[0], y, a[1]], [b[0], y + 52, b[1]]);
        clippedDiagonal([b[0], y, b[1]], [a[0], y + 52, a[1]]);
      }
    }
  }
  if (!closeRoof) return;
  for (const t of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    let points = t.map((i) => [plan[i][0], roof(plan[i]), plan[i][1]]);
    if (normalFor(...points)[1] < 0) points = points.toReversed();
    tri(
      out,
      'glass',
      points,
      color.map((v) => v * 1.08),
    );
  }
  // Project real mullion lines onto the inclined roof, clipped to its polygon.
  // A plain cap loses the glass scale completely on the large ICC splays.
  for (let axis = 0; axis < 2; axis++) {
    const other = 1 - axis;
    const low = Math.min(...plan.map((p) => p[axis]));
    const high = Math.max(...plan.map((p) => p[axis]));
    const step = (axis ? 3.3 : 1.65) * [100, 8, 3, 1][tier];
    for (let a = low + step; a < high - 0.1; a += step) {
      const hits = [];
      for (let j = 0; j < plan.length; j++) {
        const p = plan[j],
          q = plan[(j + 1) % plan.length];
        if ((p[axis] <= a && q[axis] > a) || (q[axis] <= a && p[axis] > a))
          hits.push(lerp(p, q, (a - p[axis]) / (q[axis] - p[axis])));
      }
      hits.sort((p, q) => p[other] - q[other]);
      for (let j = 1; j < hits.length; j += 2) {
        const p = hits[j - 1],
          q = hits[j];
        if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.15)
          if (tier > 0)
            beam(
              out,
              'metal',
              [p[0], roof(p) + 0.035, p[1]],
              [q[0], roof(q) + 0.035, q[1]],
              0.075,
              0.095,
              metal,
            );
      }
    }
  }
}

function build(target, level) {
  tier = level;
  const out = writer(target, tier === 0),
    m = map;
  const key = 'n0154_international_commerce_centre',
    plan = localOutline(m);
  mappedSolid(out, 'stone', plan, 0, 0.35, [0.45, 0.48, 0.49]);
  floorCurtain(out, plan, 0.35, 20, 4, [0.26, 0.37, 0.44], [0.54, 0.61, 0.66], 0.65);
  // The re-entrant corners sharpen gently with height while the broad faces
  // remain almost vertical. Four face fins terminate independently at the crown.
  const stages = [
    20,
    50,
    85,
    110,
    ...Array.from(
      { length: Math.ceil(88 / [100, 16, 4, 1][tier]) },
      (_, i) => 114 + i * 4.1 * [100, 16, 4, 1][tier],
    ),
    475,
    480,
    484,
  ];
  const upper = (p, y) => {
    const f = 1 - (0.035 * Math.max(0, y - 110)) / 374;
    return [p[0] * f, y, p[1] * f];
  };
  for (let j = 1; j < stages.length; j++) {
    const y0 = stages[j - 1],
      y1 = stages[j];
    if (y1 <= y0) continue;
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      grid(
        out,
        [upper(a, y0), upper(b, y0), upper(b, y1), upper(a, y1)],
        [0.34, 0.45, 0.51],
        1.52,
        4.1,
        0.065,
        [0.66, 0.71, 0.73],
      );
    }
  }
  mappedCap(
    out,
    'concrete',
    plan.map((p) => {
      const q = upper(p, 484);
      return [q[0], q[2]];
    }),
    484,
    [0.6, 0.63, 0.64],
  );
  for (const { a, b, len } of edgeFrames(plan))
    if (len > 40) {
      for (let i = 0; tier > 1 && i <= Math.ceil(len / [100, 24, 9, 3][tier]); i++) {
        const p = lerp(a, b, i / Math.ceil(len / [100, 24, 9, 3][tier]));
        beam(out, 'metal', upper(p, 30), upper(p, 483.7), 0.14, 0.22, [0.72, 0.77, 0.79]);
      }
      for (const y of tier === 0 ? [] : [199, 303, 388, 430])
        beam(out, 'metal', upper(a, y), upper(b, y), 0.45, 0.65, [0.62, 0.68, 0.71]);
    }
  // Exact mapped glass splay/atrium strips preserve the pronounced long north
  // entrance rather than choosing a quarter-turn from a nearly square plan.
  for (const p of partsEvidence(key).filter((p) => p.id !== 25590249)) {
    const q = partPlan(m, p),
      roof = partRoof(m, p, q);
    // These roofs sit on the elevated retail podium. Include the local support
    // beneath each mapped strip so the standalone landmark remains grounded.
    mappedCap(out, 'concrete', q, 0, [0.54, 0.56, 0.55], [], true);
    mappedCap(out, 'concrete', q, 20, [0.54, 0.56, 0.55]);
    floorCurtain(out, q, 0, 20, 4, [0.27, 0.36, 0.4], [0.5, 0.57, 0.6], 0.7);
    slopedGlass(out, q, roof, 20, [0.31, 0.44, 0.49]);
  }
}

export const buildIccSkyline = (o) => build(o, 0),
  buildIccDistrict = (o) => build(o, 1),
  buildIccStreet = (o) => build(o, 2),
  buildIccCloseup = (o) => build(o, 3);
