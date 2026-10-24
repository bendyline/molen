/** Whole-complex browser recipes and reviewed portals; original detailed recipe remains intact. */
import { readFileSync } from 'node:fs';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
} from './signature-tower-expansion-models.mjs';
import { buildRockefeller } from './signature-tower-rockefeller-model.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = '30_rockefeller_plaza';
const frameMap = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8'));
const scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8'));
const stone = [0.73, 0.71, 0.66],
  silver = [0.19, 0.215, 0.225],
  glass = [0.13, 0.185, 0.2],
  bronze = [0.51, 0.35, 0.14];
function clean(plan) {
  let p = plan;
  for (let k = 0; k < 4; k++)
    p = p.filter((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length];
      const l = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        l < 0.02 ||
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / l > 0.028
      );
    });
  return clockwise(p);
}
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.04);
}
function inside([x, z], plan) {
  let hit = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}
function exposed(block, blocks, start) {
  const result = [];
  for (const { a, b, len, n } of edges(block.plan)) {
    const d = [b[0] - a[0], b[1] - a[1]],
      cuts = [0, 1];
    for (const other of blocks) {
      if (other === block) continue;
      for (const { a: p, b: q } of edges(other.plan)) {
        const e = [q[0] - p[0], q[1] - p[1]],
          den = d[0] * e[1] - d[1] * e[0];
        if (Math.abs(den) > 1e-8) {
          const t = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / den,
            u = ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / den;
          if (t > 1e-7 && t < 1 - 1e-7 && u >= -1e-6 && u <= 1 + 1e-6) cuts.push(t);
        }
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (len * len),
          distance = Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len;
        if (distance < 0.09 && t > 1e-7 && t < 1 - 1e-7) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      if ((cuts[k] - cuts[k - 1]) * len < 0.065) continue;
      const aa = lerp(a, b, cuts[k - 1]),
        bb = lerp(a, b, cuts[k]),
        mid = lerp(aa, bb, 0.5),
        outside = [mid[0] + n[0] * 0.065, mid[1] + n[2] * 0.065],
        insidePoint = [mid[0] - n[0] * 0.065, mid[1] - n[2] * 0.065],
        coincident = blocks.filter(
          (o) => o !== block && inside(insidePoint, o.plan) && !inside(outside, o.plan),
        );
      // Nested map parts often repeat the same outward edge. Only its tallest
      // owner emits the facade; otherwise every low part stacks a duplicate skin.
      if (
        coincident.some(
          (o) =>
            o.top > block.top + 0.01 || (Math.abs(o.top - block.top) < 0.01 && o.id < block.id),
        )
      )
        continue;
      const bottom = Math.max(
        start,
        ...blocks.filter((o) => o !== block && inside(outside, o.plan)).map((o) => o.top),
      );
      if (bottom < block.top - 0.03) result.push({ a: aa, b: bb, n, bottom, top: block.top });
    }
  }
  return result;
}
function frame(a, b, n) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / l, 0, (b[1] - a[1]) / l];
  return (x, y, d = 0) => [a[0] + u[0] * x + n[0] * d, y, a[1] + u[2] * x + n[2] * d];
}
function panel(out, at, x0, x1, y0, y1, slot, color, depth = 0) {
  if (x1 - x0 < 0.005 || y1 - y0 < 0.005) return;
  face(
    out,
    slot,
    [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    color,
  );
}
function raised(out, at, x0, x1, y0, y1, depth, color = stone, slot = 'limestone') {
  const p = [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    q = [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)];
  face(out, slot, p, color);
  for (let i = 0; i < 4; i++) face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
}

export const rockefellerParts = partsEvidence(key)
  .filter((p) => p.type === 'way' && p.tags?.['building:part'])
  .map((p) => ({
    id: p.id,
    plan: clean(partPlan(frameMap, p)),
    bottom: Number(p.tags.min_height || 0),
    top: p.id === 145341259 ? 248.1 : Number(p.tags.height),
  }));
const base = clean(localOutline(frameMap)),
  highest = rockefellerParts.find((p) => p.id === 145341259);
const rectangle = (a, b, c, d) =>
  clockwise([
    [a, c],
    [b, c],
    [b, d],
    [a, d],
  ]);
const portalEdge = edges(base).find((e) => e.n[0] > 0.98 && e.len > 18 && e.len < 22);
const portalAt = frame(portalEdge.a, portalEdge.b, portalEdge.n);
export const eastDoorCenters = [-6.2, 0, 6.2].flatMap((offset) =>
  [-0.93, 0.93].map((side) => portalAt(portalEdge.len / 2 + offset + side, 0, -0.35)),
);
function casing(out, at, c, depth, level) {
  const r = 0.77,
    sides = level === 'closeup' ? 24 : 12;
  const center = at(c, 0, depth);
  for (const y of [0.06, 2.55])
    loft(
      out,
      'metal',
      [
        radialRing(y, r, r, sides, [center[0], center[2]]),
        radialRing(y + 0.1, r, r, sides, [center[0], center[2]]),
      ],
      bronze,
    );
  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides,
      b = ((i + 1) * Math.PI * 2) / sides;
    if (Math.cos((a + b) / 2) < -0.1) continue;
    face(
      out,
      'clear_glass',
      [
        at(c + r * Math.sin(a), 0.16, depth + r * Math.cos(a)),
        at(c + r * Math.sin(b), 0.16, depth + r * Math.cos(b)),
        at(c + r * Math.sin(b), 2.55, depth + r * Math.cos(b)),
        at(c + r * Math.sin(a), 2.55, depth + r * Math.cos(a)),
      ],
      [0.62, 0.74, 0.77],
    );
  }
  tube(out, 'metal', at(c, 0.16, depth), at(c, 2.55, depth), 0.045, bronze, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.2;
    face(
      out,
      'clear_glass',
      [
        at(c, 0.16, depth),
        at(c + r * Math.sin(a), 0.16, depth + r * Math.cos(a)),
        at(c + r * Math.sin(a), 2.55, depth + r * Math.cos(a)),
        at(c, 2.55, depth),
      ],
      [0.67, 0.74, 0.75],
    );
  }
}
function eastDoors(out, level) {
  for (const offset of [-6.2, 0, 6.2])
    for (const side of [-0.93, 0.93])
      casing(out, portalAt, portalEdge.len / 2 + offset + side, -0.35, level);
}
function westPortal(out, level) {
  const at = (x, y, d = 0) => [-81.48 - d, y, x],
    front = level === 'closeup';
  // Three portals on the western wing: restrained historical relief field and bronze casings.
  for (const c of [-6.2, 0, 6.2]) {
    const h = c === 0 ? 12.2 : 10.2;
    panel(out, at, c - 2.15, c + 2.15, 0, h, 'glass', glass, 0.035);
    for (const [a, b] of [
      [c - 2.55, c - 2.15],
      [c + 2.15, c + 2.55],
    ])
      raised(out, at, a, b, 0, h + 0.4, 0.2);
    raised(out, at, c - 2.55, c + 2.55, h, h + 0.4, 0.2);
    panel(out, at, c - 2.05, c + 2.05, 6.8, h - 0.2, 'carved', [0.58, 0.57, 0.52], 0.075);
    if (front)
      for (let i = 0; i < 3; i++)
        raised(
          out,
          at,
          c - 1.2 + i * 0.8,
          c - 0.8 + i * 0.8,
          7.3,
          h - 0.55,
          0.16,
          [0.65, 0.62, 0.54],
          'carved',
        );
    casing(out, at, c, 0.35, level);
  }
}
export function buildRockefellerReviewedMaster(out, m) {
  buildRockefeller(
    {
      addQuad(slot, ref, p, ...a) {
        if (!oldDoor(slot, p)) out.addQuad(slot, ref, p, ...a);
      },
      addTriangle(slot, ref, p, ...a) {
        if (!oldDoor(slot, p)) out.addTriangle(slot, ref, p, ...a);
      },
      addConvexPolygon(slot, ref, p, ...a) {
        if (!oldDoor(slot, p)) out.addConvexPolygon(slot, ref, p, ...a);
      },
    },
    m,
  );
  eastDoors(out, 'closeup');
  westPortal(out, 'closeup');
}
function oldDoor(slot, p) {
  return (
    ['clear_glass', 'metal', 'stainless', 'glass'].includes(slot) &&
    p.every((q) => q[0] > 80 && q[1] <= 2.651 && Math.abs(q[2]) <= 10.5)
  );
}
function facade(out, { a, b, n, bottom: lo, top: hi }, level, ground = false) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    count = Math.max(1, Math.round(len / (ground ? 3.7 : 2.42))),
    bw = len / count;
  const openingRatio = Math.min(ground ? 2.9 : 1.38, bw * 0.68) / bw,
    glassRatio = openingRatio * (1 - (ground ? 0.88 / 5 : 1.57 / 3.5052)),
    average = stone.map(
      (v, i) =>
        v * scope.sourceFacts.surfaceMeans.stone_limestone[i] * (1 - openingRatio) +
        silver[i] * scope.sourceFacts.surfaceMeans.metal_painted[i] * (openingRatio - glassRatio) +
        glass[i] * glassRatio,
    );
  if (level === 'skyline') {
    panel(out, at, 0, len, lo, hi, 'limestone', average);
    return;
  }
  if (level === 'district') {
    const p = [at(0, lo), at(len, lo), at(len, hi), at(0, hi)];
    out.addQuad(
      'facade',
      'metric:uv',
      p,
      normalFor(...p),
      [
        [0, (lo - 10) / 3.5052],
        [count, (lo - 10) / 3.5052],
        [count, (hi - 10) / 3.5052],
        [0, (hi - 10) / 3.5052],
      ],
      average.map((v, i) => Math.min(1, v / scope.sourceFacts.surfaceMeans.window_punched[i])),
    );
    return;
  }
  const cuts = [
    lo,
    ...Array.from({ length: 72 }, (_, i) => 10 + i * 3.5052).filter(
      (y) => y > lo + 0.08 && y < hi - 0.08,
    ),
    hi,
  ];
  panel(out, at, 0, len, lo, hi, 'glass', glass, -0.17);
  const w = Math.min(ground ? 2.9 : 1.38, bw * 0.68),
    gap = (bw - w) / 2;
  for (let col = 0; col <= count; col++) {
    const c = col * bw,
      left = Math.max(0, c - gap),
      right = Math.min(len, c + gap);
    panel(out, at, left, right, lo, hi, 'limestone', stone);
    if (left > 0)
      face(
        out,
        'limestone',
        [at(left, lo), at(left, hi), at(left, hi, -0.17), at(left, lo, -0.17)],
        stone,
      );
    if (right < len)
      face(
        out,
        'limestone',
        [at(right, hi), at(right, lo), at(right, lo, -0.17), at(right, hi, -0.17)],
        stone,
      );
  }
  if (level === 'closeup')
    for (let col = 0; col < count; col++) {
      const c = (col + 0.5) * bw;
      // One continuous sash strip, hidden by the nearer spandrel bands between panes.
      panel(out, at, c - 0.023, c + 0.023, lo, hi, 'metal', silver, -0.14);
    }
  for (let row = 1; row < cuts.length; row++) {
    const y0 = cuts[row - 1],
      y1 = cuts[row],
      low = y0 + (ground ? 0.38 : 0.42),
      high = y1 - (ground ? 0.5 : 1.15);
    if (high <= low) {
      panel(out, at, 0, len, y0, y1, 'limestone', stone, 0.002);
      continue;
    }
    const depth = level === 'closeup' ? -0.13 : -0.169;
    panel(out, at, 0, len, y0, low, 'metal', silver, depth);
    panel(out, at, 0, len, high, y1, 'metal', silver, depth);
    if (level !== 'closeup') continue;
    face(
      out,
      'metal',
      [at(0, low, -0.13), at(len, low, -0.13), at(len, low, -0.17), at(0, low, -0.17)],
      silver,
    );
    face(
      out,
      'metal',
      [at(0, high, -0.17), at(len, high, -0.17), at(len, high, -0.13), at(0, high, -0.13)],
      silver,
    );
    panel(
      out,
      at,
      0,
      len,
      low + (high - low) * 0.54 - 0.023,
      low + (high - low) * 0.54 + 0.023,
      'metal',
      silver,
      -0.135,
    );
  }
}
function crownSimple(out, level) {
  const lower = 248.1,
    mid = 254.4,
    upper = 257.55,
    core = rectangle(6, 65, -6.4, 7.1),
    top = rectangle(11, 60, -4.4, 5.1);
  mappedCap(out, 'concrete', highest.plan, lower, [0.56, 0.52, 0.46]);
  mappedSolid(out, 'limestone', core, lower, mid, stone);
  mappedSolid(out, 'limestone', top, mid, upper, stone);
  for (const [plan, y] of [
    [highest.plan, lower],
    [core, mid],
    [top, upper],
  ]) {
    mappedCap(out, 'concrete', plan, y, [0.56, 0.52, 0.46]);
    for (const { a, b, n } of edges(plan)) {
      const at = frame(a, b, n),
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      panel(
        out,
        at,
        0,
        len,
        y,
        y + (y === upper ? 1.52 : 2.59),
        level === 'skyline' ? 'glass' : 'clear_glass',
        level === 'skyline' ? [0.37, 0.43, 0.44] : [0.67, 0.8, 0.81],
        0.02,
      );
    }
  }
  for (const x of [19, 48])
    loft(
      out,
      'metal',
      [
        radialRing(upper, 1.1, 0.76, level === 'skyline' ? 6 : 12, [x, 0]),
        radialRing(upper + 0.82, 1.3, 0.88, level === 'skyline' ? 6 : 12, [x, 0]),
      ],
      silver,
    );
  // Lowered Skylift deck, central support and north Beam survive all browser levels.
  loft(
    out,
    'metal',
    [
      radialRing(upper + 0.08, 2.26, 2.26, level === 'skyline' ? 8 : 16, [15, 0.3]),
      radialRing(upper + 0.64, 2.26, 2.26, level === 'skyline' ? 8 : 16, [15, 0.3]),
    ],
    bronze,
  );
  box(out, 'metal', [25, mid + 0.1, -6.3], [30.2, mid + 0.88, -5.75], silver);
  for (const [lo, hi, tx, bx] of [
    [lower, mid, 65, 71.5],
    [mid, upper, 60, 64.5],
  ]) {
    // Solid stair flight envelope at distant levels; full treads retained in source and closeup.
    const p = [
      [bx, lo, -0.9],
      [tx, hi, -0.9],
      [tx, hi, 1.5],
      [bx, lo, 1.5],
    ];
    face(out, 'concrete', p, [0.61, 0.59, 0.53]);
  }
}
function preserveDetails(out) {
  // Consume the preserved source recipe directly, not a binary or a download. Only the portal
  // and roof subsets are retained; repeated facade cells have their own merged browser recipe.
  buildRockefellerReviewedMaster(
    {
      addQuad(slot, ref, p, ...args) {
        if (detailRegion(p)) out.addQuad(slot, ref, p, ...args);
      },
      addTriangle(slot, ref, p, ...args) {
        if (detailRegion(p)) out.addTriangle(slot, ref, p, ...args);
      },
      addConvexPolygon(slot, ref, p, ...args) {
        if (detailRegion(p)) out.addConvexPolygon(slot, ref, p, ...args);
      },
    },
    frameMap,
  );
}
const detailRegion = (p) =>
  p.every((q) => q[1] >= 248.08) ||
  p.every((q) => q[0] > 80 && q[1] <= 15.001 && Math.abs(q[2]) <= 10.5);
function setbackParapet(out, edge, y) {
  const len = Math.hypot(edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]),
    at = frame(edge.a, edge.b, edge.n),
    count = Math.max(1, Math.round(len / 2.42)),
    bw = len / count,
    pointed = y > 230 || (edge.n[0] > 0.9 && y > 100),
    height = y > 230 ? 2.1 : 1.28;
  panel(out, at, 0, len, y - 0.22, y + 0.05, 'limestone', stone, 0.1);
  for (let col = 0; col < count; col++) {
    const c = (col + 0.5) * bw,
      w = Math.min(1.38, bw * 0.68);
    if (pointed) {
      for (const sign of [-1, 1]) {
        const x = c + sign * w * 0.245;
        const ring = [
          [x - w * 0.225, y - 0.75],
          [x + w * 0.225, y - 0.75],
          [x + w * 0.225, y - 0.75 + height * 0.72],
          [x, y - 0.75 + height],
          [x - w * 0.225, y - 0.75 + height * 0.72],
        ];
        for (let i = 1; i < ring.length - 1; i++) {
          const p = [ring[0], ring[i], ring[i + 1]].map(([x, y]) => at(x, y, 0.17));
          out.addTriangle(
            'metal',
            'palette:#ffffff',
            p,
            normalFor(...p),
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            silver,
          );
          const q = p
            .toReversed()
            .map((v) => [v[0] - edge.n[0] * 0.11, v[1], v[2] - edge.n[2] * 0.11]);
          out.addTriangle(
            'metal',
            'palette:#ffffff',
            q,
            normalFor(...q),
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            silver,
          );
        }
      }
    } else
      panel(out, at, c - w / 2, c + w / 2, y - 0.8, y + 0.13, 'metal', [0.39, 0.43, 0.43], 0.08);
    // Angular back rails retain the .59m profile without microscopic tube rings.
    for (const sign of [-1, 1]) {
      const a = at(c + sign * bw * 0.44, y + 0.08, -0.2),
        b = at(c, y + 0.59, -0.2);
      face(out, 'metal', [a, b, [b[0], b[1] + 0.05, b[2]], [a[0], a[1] + 0.05, a[2]]], silver);
    }
  }
}
function build(out, level) {
  mappedSolid(out, 'foundation', base, 0, 0.1, [0.35, 0.34, 0.3]);
  for (const e of edges(base)) {
    if (e === portalEdge || (e.n[0] > 0.98 && e.len > 18 && e.len < 22)) {
      if (level !== 'closeup') {
        const at = frame(e.a, e.b, e.n),
          cuts = [0];
        for (const offset of [-6.2, 0, 6.2]) {
          const c = e.len / 2 + offset;
          cuts.push(c - 2.1, c + 2.1);
        }
        cuts.push(e.len);
        for (let i = 1; i < cuts.length; i += 2) raised(out, at, cuts[i - 1], cuts[i], 0, 15, 0.18);
        for (const offset of [-6.2, 0, 6.2]) {
          const c = e.len / 2 + offset,
            h = offset === 0 ? 11.2776 : 8.2296;
          panel(out, at, c - 2.1, c + 2.1, 0, h, 'glass', glass, -0.7);
          panel(out, at, c - 2.1, c + 2.1, h, 15, 'limestone', stone, 0.18);
        }
        if (level === 'street') eastDoors(out, level);
      }
    } else {
      facade(out, { ...e, bottom: 0.1, top: 5 }, level, true);
      facade(out, { ...e, bottom: 5, top: 10 }, level, true);
    }
  }
  mappedCap(out, 'concrete', base, 10, [0.47, 0.44, 0.38]);
  for (const p of rockefellerParts) {
    if (p.top <= 10) continue;
    for (const edge of exposed(p, rockefellerParts, Math.max(10, p.bottom))) {
      if (edge.n[0] > 0.97 && (edge.a[0] + edge.b[0]) / 2 > 80)
        edge.bottom = Math.max(15, edge.bottom);
      facade(out, edge, level);
      if (level === 'closeup' && p !== highest) setbackParapet(out, edge, p.top);
    }
    if (p !== highest) mappedCap(out, 'concrete', p.plan, p.top, [0.49, 0.47, 0.42]);
  }
  for (const [x, z, w, d, y] of [
    [-39, -18, 14, 7, 43],
    [-39, 18, 14, 7, 43],
    [-69, 0, 12, 13, 70],
  ])
    box(out, 'metal', [x - w / 2, y + 0.12, z - d / 2], [x + w / 2, y + 1.8, z + d / 2], silver);
  if (level === 'closeup') {
    preserveDetails(out);
    westPortal(out, level);
  } else {
    crownSimple(out, level);
    if (level === 'street') westPortal(out, level);
  }
}
export const buildRockefellerSkyline = (out) => build(out, 'skyline');
export const buildRockefellerDistrict = (out) => build(out, 'district');
export const buildRockefellerStreet = (out) => build(out, 'street');
export const buildRockefellerCloseup = (out) => build(out, 'closeup');
