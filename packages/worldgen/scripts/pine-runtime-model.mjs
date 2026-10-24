/** Complete58-part browser tower and corrected street entries; original master recipe retained. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { build70Pine } from './signature-tower-pine-model.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = '70_pine_street',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8')),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8'));
const stone = [0.71, 0.685, 0.62],
  silver = [0.61, 0.64, 0.63],
  glass = [0.14, 0.18, 0.17],
  shifted = (p, n, d) => p.map((v, i) => v + n[i] * d);
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
function plaque(out, at, x, y, w, h, color, slot = 'limestone', depth = 0.06) {
  const p = [
    [x - w / 2, y - h / 2],
    [x + w / 2, y - h / 2],
    [x + w / 2, y + h / 2],
    [x - w / 2, y + h / 2],
  ];
  face(
    out,
    slot,
    p.map(([u, v]) => at(u, v, depth)),
    color,
  );
}
function reliefBox(out, at, x, y, w, h, depth, color = stone, slot = 'limestone') {
  const corners = [
    [x - w / 2, y - h / 2],
    [x + w / 2, y - h / 2],
    [x + w / 2, y + h / 2],
    [x - w / 2, y + h / 2],
  ];
  const front = corners.map(([u, v]) => at(u, v, depth)),
    back = corners.map(([u, v]) => at(u, v, 0));
  face(out, slot, front, color);
  for (let i = 0; i < 4; i++)
    face(out, slot, [front[i], back[i], back[(i + 1) % 4], front[(i + 1) % 4]], color);
}
function rosette(out, at, x, y, r, slot = 'limestone', color = stone) {
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      b = a + Math.PI / 12,
      c = a + Math.PI / 6;
    const pp = [
      [x + r * 0.31 * Math.cos(a), y + r * 0.31 * Math.sin(a)],
      [x + r * Math.cos(b), y + r * Math.sin(b)],
      [x + r * 0.31 * Math.cos(c), y + r * 0.31 * Math.sin(c)],
    ];
    tri(
      out,
      slot,
      pp.map(([u, v]) => at(u, v, 0.12)),
      color,
    );
  }
  for (let i = 0; i < 20; i++) {
    const a = (i * Math.PI) / 10,
      b = ((i + 1) * Math.PI) / 10;
    tri(
      out,
      slot,
      [
        at(x, y, 0.16),
        at(x + 0.25 * r * Math.cos(a), y + 0.25 * r * Math.sin(a), 0.16),
        at(x + 0.25 * r * Math.cos(b), y + 0.25 * r * Math.sin(b), 0.16),
      ],
      color,
    );
  }
}
function masonry(out, a, b, n, low, high, slot = 'brick') {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    h = high - low;
  const color =
    slot === 'brick' ? [0.63 + low * 0.00013, 0.59 + low * 0.0001, 0.51 + low * 0.0001] : stone;
  if (len < 1.35 || h < 2.1) {
    face(out, slot, [at(0, low), at(len, low), at(len, high), at(0, high)], color);
    return;
  }
  const w = Math.min(1.34, len * 0.66),
    cx = len / 2,
    left = cx - w / 2,
    right = cx + w / 2,
    y0 = low + 0.65,
    y1 = Math.min(high - 0.52, y0 + 2.45),
    recess = -0.18;
  // Open wall ring and inset sash: no solid wall directly behind glazing.
  for (const [x0, x1, bottom, top] of [
    [0, left, low, high],
    [right, len, low, high],
    [left, right, low, y0],
    [left, right, y1, high],
  ])
    if (x1 - x0 > 0.01 && top - bottom > 0.01)
      face(out, slot, [at(x0, bottom), at(x1, bottom), at(x1, top), at(x0, top)], color);
  const p = [at(left, y0), at(right, y0), at(right, y1), at(left, y1)],
    inner = p.map((v) => shifted(v, n, recess));
  for (let i = 0; i < 4; i++)
    face(out, slot, [p[i], inner[i], inner[(i + 1) % 4], p[(i + 1) % 4]], color);
  grid(out, inner, glass, w + 1, (y1 - y0) / 2, 0.045, silver, 'metal');
  // Layered brick spandrel and projecting vertical arrises.
  for (let i = 0; i < 4; i++)
    plaque(out, at, cx, low + 0.16 + i * 0.105, w, 0.052, [0.57, 0.54, 0.47], slot, 0.032);
  for (const x of [cx - w * 0.18, cx + w * 0.18])
    plaque(out, at, x, low + 0.33, 0.072, 0.55, [0.66, 0.62, 0.55], slot, 0.062);
  plaque(out, at, cx, y0 - 0.065, w + 0.12, 0.13, [0.73, 0.7, 0.63], 'limestone', 0.07);
  if (slot === 'brick')
    for (const x of [0.12, len - 0.12])
      reliefBox(out, at, x, (low + high) / 2, 0.2, h, 0.095, color, 'brick');
}
function portal(out, at, cx, big = true) {
  const w = big ? 8.7 : 6.2,
    h = big ? 15.2 : 8.7;
  const extent = big ? 6 : 4.65;
  for (const [left, right, bottom, top] of [
    [-extent, -w / 2, 0, 16.5],
    [w / 2, extent, 0, 16.5],
    [-w / 2, w / 2, h, big ? 16.5 : 10.15],
  ])
    face(
      out,
      'limestone',
      [
        [left, bottom],
        [right, bottom],
        [right, top],
        [left, top],
      ].map(([x, y]) => at(cx + x, y)),
      stone,
    );
  // Stepped lintels and jambs; recessed window fields carry the true opening.
  for (let i = 0; i < 3; i++) {
    const ww = w + 1.04 * i,
      top = h + 0.42 * i;
    for (const x of [-ww / 2, ww / 2])
      reliefBox(out, at, cx + x, top / 2, 0.36, top, 0.25 + i * 0.22);
    reliefBox(out, at, cx, top, ww + 0.36, 0.4, 0.25 + i * 0.22);
  }
  grid(
    out,
    [
      at(cx - w / 2, 0, -0.28),
      at(cx + w / 2, 0, -0.28),
      at(cx + w / 2, h, -0.28),
      at(cx - w / 2, h, -0.28),
    ],
    glass,
    w / 6,
    3.3,
    0.065,
    silver,
    'metal',
  );
  for (const yy of [3.2, 7.2, 11.2].filter((v) => v < h)) {
    plaque(out, at, cx, yy, w, 0.88, [0.44, 0.47, 0.46], 'metal', -0.08);
    for (let j = 0; j < 6; j++) {
      const x = cx - w / 2 + ((j + 0.5) * w) / 6;
      rosette(out, at, x, yy, 0.28, 'metal', [0.68, 0.71, 0.69]);
      for (let k = 0; k < 5; k++) {
        const dx = (k - 2) * 0.16;
        beam(
          out,
          'metal',
          at(x, yy - 0.25, 0.14),
          at(x + dx, yy + 0.32, 0.14),
          0.034,
          0.035,
          silver,
        );
      }
    }
  }
  if (big) {
    reliefBox(out, at, cx, 3.5, 0.8, 7, 0.35);
    // The portal's 14 ft stone portrait repeats this building's stepped silhouette.
    for (const [bottom, top, width, depth] of [
      [3.7, 4.6, 0.92, 0.6],
      [4.6, 5.3, 0.76, 0.58],
      [5.3, 6.1, 0.59, 0.55],
      [6.1, 7.3, 0.4, 0.51],
      [7.3, 7.8, 0.24, 0.46],
      [7.8, 8, 0.15, 0.4],
    ]) {
      const p = [
        at(cx - width / 2, bottom, depth),
        at(cx + width / 2, bottom, depth),
        at(cx + width / 2, top, depth),
        at(cx - width / 2, top, depth),
      ];
      face(out, 'limestone', p, [0.8, 0.77, 0.7]);
      for (const x of [-0.22, 0.22])
        if (width > 0.2)
          beam(
            out,
            'limestone',
            at(cx + width * x, bottom, depth + 0.02),
            at(cx + width * x, top, depth + 0.02),
            0.025,
            0.03,
            [0.61, 0.58, 0.52],
          );
    }
    tube(out, 'stainless', at(cx, 8, 0.4), at(cx, 8.9, 0.35), 0.037, silver, 6);
    for (const sign of [-1, 1])
      for (let j = 0; j < 5; j++)
        rosette(out, at, cx + sign * (w / 2 + 0.42), 2.5 + j * 2.32, 0.25);
  }
  if (!big)
    for (let col = 0; col < 3; col++) {
      const left = cx - w / 2 + (col * w) / 3,
        right = left + w / 3,
        a = at(left, 0),
        b = at(right, 0),
        n = normalFor(at(left, 0), at(right, 0), at(right, 1));
      for (const [lo, hi] of [
        [10.15, 12.415],
        [12.415, 16.5],
      ])
        masonry(out, [a[0], a[2]], [b[0], b[2]], n, lo, hi, 'limestone');
    }
}

const evidence = partsEvidence(key).filter((p) => p.type === 'way' && p.tags?.['building:part']);
export const pineParts = evidence
  .filter((p) => Number(p.tags.height) <= 252)
  .map((p) => ({
    id: p.id,
    plan: clean(partPlan(map, p)),
    bottom: Number(p.tags.min_height || 0),
    top: Number(p.tags.height),
  }));
const base = clean(localOutline(map));
export const pinePortalEdges = edges(base).map((e) => ({
  ...e,
  portals:
    Math.abs(e.n[2]) > 0.92
      ? [
          { x: 5.9, big: true },
          { x: e.n[2] > 0 ? -13.873888306167334 : -23, big: false },
        ]
          .map((p) => ({ ...p, c: ((p.x - e.a[0]) / (e.b[0] - e.a[0])) * e.len }))
          .filter((p) => p.c > (p.big ? 6 : 4.65) && p.c < e.len - (p.big ? 6 : 4.65))
      : e.n[0] > 0.92 && e.len > 20
        ? [{ c: e.len / 2, big: false }]
        : [],
}));
export const pineRevolvingCenters = pinePortalEdges.flatMap((e) =>
  e.portals
    .filter((p) => !p.big)
    .map((p) => ({ point: frame(e.a, e.b, e.n)(p.c, 0, -0.28), normal: e.n })),
);
function pane(out, at, x0, x1, y0, y1, slot, color, d = 0) {
  if (x1 - x0 > 0.001 && y1 - y0 > 0.001)
    face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
}
function casing(out, e, c, level) {
  const at = frame(e.a, e.b, e.n),
    n = level === 'street' ? 12 : 24,
    r = 0.86;
  const center = at(c, 0, -0.28),
    local = [center[0], center[2]];
  for (const y of [0.06, 2.55])
    loft(
      out,
      'metal',
      [radialRing(y, r, r, n, local), radialRing(y + 0.1, r, r, n, local)],
      silver,
    );
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    if (Math.cos((a + b) / 2) < -0.05) continue;
    face(
      out,
      'glass',
      [
        at(c + r * Math.sin(a), 0.16, -0.28 + r * Math.cos(a)),
        at(c + r * Math.sin(b), 0.16, -0.28 + r * Math.cos(b)),
        at(c + r * Math.sin(b), 2.55, -0.28 + r * Math.cos(b)),
        at(c + r * Math.sin(a), 2.55, -0.28 + r * Math.cos(a)),
      ],
      [0.3, 0.39, 0.38],
    );
  }
  tube(out, 'metal', at(c, 0.16, -0.28), at(c, 2.55, -0.28), 0.045, silver, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + 0.2;
    face(
      out,
      'glass',
      [
        at(c, 0.16, -0.28),
        at(c + r * Math.sin(a), 0.16, -0.28 + r * Math.cos(a)),
        at(c + r * Math.sin(a), 2.55, -0.28 + r * Math.cos(a)),
        at(c, 2.55, -0.28),
      ],
      [0.29, 0.37, 0.35],
    );
  }
}
function baseDetailed(out) {
  mappedSolid(out, 'foundation', base, 0, 0.16, [0.35, 0.31, 0.27]);
  for (const e of pinePortalEdges) {
    const { a, b, n, len, portals } = e,
      at = frame(a, b, n);
    if (!portals.length) {
      pane(out, at, 0, len, 0.16, 16.5, 'limestone', stone);
      continue;
    }
    const cuts = [
      0,
      len,
      ...portals.flatMap((p) => [p.c - (p.big ? 6 : 4.65), p.c + (p.big ? 6 : 4.65)]),
    ].sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const left = cuts[k - 1],
        right = cuts[k],
        mid = (left + right) / 2;
      if (portals.some((p) => Math.abs(mid - p.c) < (p.big ? 6 : 4.65))) continue;
      const count = Math.max(1, Math.round((right - left) / 2.4)),
        bw = (right - left) / count;
      for (let i = 0; i < count; i++) {
        const aa = lerp(a, b, (left + i * bw) / len),
          bb = lerp(a, b, (left + (i + 1) * bw) / len),
          x = left + (i + 0.5) * bw;
        for (let j = 0; j < 4; j++)
          masonry(out, aa, bb, n, 0.16 + j * 4.085, 0.16 + (j + 1) * 4.085, 'limestone');
        plaque(out, at, x, 1.1, bw, 2.2, [0.15, 0.095, 0.08], 'stone', 0.04);
        rosette(out, at, x, 11.65, 0.37);
      }
    }
    for (const p of portals) {
      portal(out, at, p.c, p.big);
      if (!p.big) casing(out, e, p.c, 'closeup');
    }
  }
  mappedCap(out, 'limestone', base, 16.5, stone);
}
export function buildPineReviewedMaster(out, m) {
  build70Pine(
    {
      addTriangle(slot, ref, p, ...a) {
        if (!p.every((q) => q[1] <= 16.50001)) out.addTriangle(slot, ref, p, ...a);
      },
      addQuad(slot, ref, p, ...a) {
        if (!p.every((q) => q[1] <= 16.50001)) out.addQuad(slot, ref, p, ...a);
      },
      addConvexPolygon(slot, ref, p, ...a) {
        if (!p.every((q) => q[1] <= 16.50001)) out.addConvexPolygon(slot, ref, p, ...a);
      },
    },
    m,
  );
  baseDetailed(out);
}
function average(color, graph, glassRatio = 0.36) {
  return color.map(
    (v, i) =>
      v * scope.sourceFacts.surfaceMeans[graph][i] * (1 - glassRatio) + glass[i] * glassRatio,
  );
}
function facade(out, e, level, slot = 'brick') {
  const { a, b, n, bottom: lo, top: hi } = e,
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frame(a, b, n),
    count = Math.max(1, Math.round(len / (slot === 'brick' ? 2.18 : 2.4))),
    bw = len / count;
  const color =
    slot === 'brick' ? [0.63 + lo * 0.00013, 0.59 + lo * 0.0001, 0.51 + lo * 0.0001] : stone;
  const w = Math.min(1.34, bw * 0.66),
    ratio = ((w / bw) * 2.45) / 3.9,
    mean = average(color, slot === 'brick' ? 'brick' : 'stone_limestone', ratio);
  if (level === 'skyline') {
    pane(out, at, 0, len, lo, hi, slot, mean);
    return;
  }
  if (level === 'district') {
    const p = [at(0, lo), at(len, lo), at(len, hi), at(0, hi)];
    // One canonical graphic repeat per interpreted2.18m by3.9m bay, not a surveyed photograph.
    out.addQuad(
      'facade',
      'metric:uv',
      p,
      normalFor(...p),
      [
        [0, (lo - 16.5) / 3.9],
        [count, (lo - 16.5) / 3.9],
        [count, (hi - 16.5) / 3.9],
        [0, (hi - 16.5) / 3.9],
      ],
      mean.map((v, i) => Math.min(1, v / scope.sourceFacts.surfaceMeans.window_punched[i])),
    );
    return;
  }
  if (len < 1.35 || hi - lo < 2.1) {
    pane(out, at, 0, len, lo, hi, slot, color);
    return;
  }
  const gap = (bw - w) / 2,
    baseFacade = slot === 'limestone' && lo < 16.5,
    origin = baseFacade ? 0.16 : 16.5,
    pitch = baseFacade ? 4.085 : 3.9,
    levels = [
      lo,
      ...Array.from({ length: 65 }, (_, i) => origin + i * pitch).filter(
        (y) => y > lo + 0.08 && y < hi - 0.08,
      ),
      hi,
    ];
  pane(out, at, 0, len, lo, hi, 'glass', glass, -0.18);
  for (let col = 0; col <= count; col++) {
    const c = col * bw,
      left = Math.max(0, c - gap),
      right = Math.min(len, c + gap);
    pane(out, at, left, right, lo, hi, slot, color);
    if (level === 'closeup') {
      if (left > 0)
        face(
          out,
          slot,
          [at(left, lo), at(left, hi), at(left, hi, -0.18), at(left, lo, -0.18)],
          color,
        );
      if (right < len)
        face(
          out,
          slot,
          [at(right, hi), at(right, lo), at(right, lo, -0.18), at(right, hi, -0.18)],
          color,
        );
      if (slot === 'brick' && col > 0 && col < count)
        for (const sign of [-1, 1])
          pane(out, at, c + sign * gap - 0.1, c + sign * gap + 0.1, lo, hi, 'brick', color, 0.095);
    }
  }
  if (level === 'closeup')
    for (let col = 0; col < count; col++) {
      const c = (col + 0.5) * bw;
      // Continuous sash strips are hidden behind each nearer masonry spandrel.
      for (const x of [c - w / 2, c + w / 2])
        pane(out, at, x - 0.023, x + 0.023, lo, hi, 'metal', silver, -0.16);
    }
  for (let row = 1; row < levels.length; row++) {
    const low = levels[row - 1],
      high = levels[row],
      y0 = low + 0.65,
      y1 = Math.min(high - 0.52, y0 + 2.45);
    if (y1 <= y0) {
      pane(out, at, 0, len, low, high, slot, color, 0.003);
      continue;
    }
    pane(out, at, 0, len, low, y0, slot, color, 0.003);
    pane(out, at, 0, len, y1, high, slot, color, 0.003);
    if (level === 'closeup') {
      for (const [y, reverse] of [
        [y0, false],
        [y1, true],
      ]) {
        const p = [at(0, y), at(len, y), at(len, y, -0.18), at(0, y, -0.18)];
        face(out, slot, reverse ? p.toReversed() : p, color);
      }
      pane(out, at, 0, len, y0 - 0.13, y0, 'limestone', [0.73, 0.7, 0.63], 0.07);
      pane(out, at, 0, len, (y0 + y1) / 2 - 0.025, (y0 + y1) / 2 + 0.025, 'metal', silver, -0.158);
      for (const i of [0, 3])
        pane(
          out,
          at,
          0,
          len,
          low + 0.134 + i * 0.105,
          low + 0.186 + i * 0.105,
          slot,
          [0.57, 0.54, 0.47],
          0.032,
        );
      for (let col = 0; col < count; col++) {
        const c = (col + 0.5) * bw;
        for (const sign of low >= 210 ? [-1, 1] : [])
          pane(
            out,
            at,
            c + sign * w * 0.18 - 0.036,
            c + sign * w * 0.18 + 0.036,
            low + 0.055,
            low + 0.605,
            slot,
            [0.66, 0.62, 0.55],
            0.062,
          );
      }
    }
  }
}
function rail(out, e, y, level) {
  if (level === 'skyline') return;
  const { a, b, n } = e,
    at = frame(a, b, n),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  pane(out, at, 0, len, y + 0.9, y + 0.97, 'metal', silver, -0.11);
  if (level === 'district') return;
  const count = Math.max(1, Math.round(len / 1.65)),
    bw = len / count;
  for (let j = 0; j <= count; j++)
    pane(
      out,
      at,
      Math.max(0, j * bw - 0.035),
      Math.min(len, j * bw + 0.035),
      y,
      y + 1.15,
      'metal',
      silver,
      -0.11,
    );
  if (level !== 'closeup') return;
  for (let j = 0; j < count; j++) {
    const c = (j + 0.5) * bw;
    for (let k = 0; k < 3; k++) {
      const a = Math.PI * 0.1 + (Math.PI * 0.8 * k) / 2;
      const x = c + bw * 0.48 * Math.cos(a),
        yy = y + 0.22 + 0.87 * Math.sin(a),
        p = at(c, y + 0.18, -0.11),
        q = at(x, yy, -0.11);
      // Flat front/back strips retain the fan outline; microscopic round tube walls omitted.
      const dx = q[0] - p[0],
        dz = q[2] - p[2],
        dy = q[1] - p[1],
        l = Math.hypot(dx, dy, dz),
        u = [-n[2] * 0.022, n[0] * 0, n[0] * 0.022];
      if (l > 0.03) {
        const pp = [
          p.map((v, i) => v - u[i]),
          q.map((v, i) => v - u[i]),
          q.map((v, i) => v + u[i]),
          p.map((v, i) => v + u[i]),
        ];
        face(out, 'metal', pp, silver);
      }
    }
  }
}
function simplePortal(out, e, p, level) {
  if (level === 'closeup') {
    portal(out, frame(e.a, e.b, e.n), p.c, p.big);
    if (!p.big) casing(out, e, p.c, level);
    return;
  }
  const at = frame(e.a, e.b, e.n),
    w = p.big ? 8.7 : 6.2,
    h = p.big ? 15.2 : 8.7,
    extent = p.big ? 6 : 4.65,
    c = p.c;
  pane(out, at, c - extent, c - w / 2, 0, 16.5, 'limestone', stone);
  pane(out, at, c + w / 2, c + extent, 0, 16.5, 'limestone', stone);
  pane(out, at, c - w / 2, c + w / 2, h, p.big ? 16.5 : 10.15, 'limestone', stone);
  if (!p.big) {
    const a = at(c - w / 2, 0),
      b = at(c + w / 2, 0);
    facade(
      out,
      { a: [a[0], a[2]], b: [b[0], b[2]], n: e.n, bottom: 10.15, top: 16.5 },
      level,
      'limestone',
    );
  }
  grid(
    out,
    [
      at(c - w / 2, 0, -0.28),
      at(c + w / 2, 0, -0.28),
      at(c + w / 2, h, -0.28),
      at(c - w / 2, h, -0.28),
    ],
    glass,
    w / 6,
    3.3,
    0.065,
    silver,
    'metal',
  );
  for (let i = 0; i < 3; i++) {
    const ww = w + 1.04 * i,
      top = h + 0.42 * i;
    for (const x of [-ww / 2, ww / 2])
      reliefBox(out, at, c + x, top / 2, 0.36, top, 0.25 + i * 0.22);
    reliefBox(out, at, c, top, ww + 0.36, 0.4, 0.25 + i * 0.22);
  }
  if (p.big) {
    reliefBox(out, at, c, 3.5, 0.8, 7, 0.35);
    for (const [lo, hi, width] of [
      [3.7, 4.6, 0.92],
      [4.6, 5.3, 0.76],
      [5.3, 6.1, 0.59],
      [6.1, 7.3, 0.4],
      [7.3, 7.8, 0.24],
      [7.8, 8, 0.15],
    ])
      reliefBox(out, at, c, (lo + hi) / 2, width, hi - lo, 0.55, [0.8, 0.77, 0.7]);
  } else casing(out, e, c, level);
}
function baseSimple(out, level) {
  mappedSolid(
    out,
    'foundation',
    base,
    0,
    0.16,
    level === 'skyline' ? average([0.35, 0.31, 0.27], 'stone_granite', 0) : [0.35, 0.31, 0.27],
  );
  for (const e of pinePortalEdges) {
    const at = frame(e.a, e.b, e.n);
    if (level === 'skyline' || level === 'district') {
      facade(out, { ...e, bottom: 0.16, top: 16.5 }, level, 'limestone');
      continue;
    }
    const cuts = [
      0,
      e.len,
      ...e.portals.flatMap((p) => [p.c - (p.big ? 6 : 4.65), p.c + (p.big ? 6 : 4.65)]),
    ].sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const l = cuts[k - 1],
        r = cuts[k],
        mid = (l + r) / 2;
      if (e.portals.some((p) => Math.abs(mid - p.c) < (p.big ? 6 : 4.65))) continue;
      facade(
        out,
        {
          a: lerp(e.a, e.b, l / e.len),
          b: lerp(e.a, e.b, r / e.len),
          n: e.n,
          bottom: 0.16,
          top: 16.5,
        },
        level,
        'limestone',
      );
      pane(out, at, l, r, 0, 2.2, 'stone', [0.15, 0.095, 0.08], 0.04);
    }
    for (const p of e.portals) simplePortal(out, e, p, level);
  }
  mappedCap(
    out,
    'limestone',
    base,
    16.5,
    level === 'skyline' ? average(stone, 'stone_limestone', 0) : stone,
  );
}
function crown(out, level) {
  const spireBase = 290.1696 - 97 * 0.3048,
    scale = (spireBase - 252) / 12;
  for (const p of evidence.filter(
    (p) => Number(p.tags.height) > 252 && Number(p.tags.height) <= 264,
  )) {
    const plan = clean(partPlan(map, p)),
      lo = 252 + (Number(p.tags.min_height) - 252) * scale,
      hi = 252 + (Number(p.tags.height) - 252) * scale;
    for (const e of edges(plan)) {
      const at = frame(e.a, e.b, e.n);
      if (level === 'skyline' || level === 'district')
        pane(out, at, 0, e.len, lo, hi, 'glass', [0.41, 0.53, 0.5]);
      else
        grid(
          out,
          [
            [e.a[0], lo, e.a[1]],
            [e.b[0], lo, e.b[1]],
            [e.b[0], hi, e.b[1]],
            [e.a[0], hi, e.a[1]],
          ],
          [0.41, 0.53, 0.5],
          1.2,
          1.4,
          0.09,
          silver,
          'stainless',
        );
    }
    mappedCap(
      out,
      'metal',
      plan,
      hi,
      level === 'skyline' ? average([0.42, 0.47, 0.43], 'metal_painted', 0) : [0.42, 0.47, 0.43],
    );
  }
  const mast = clean(
      partPlan(
        map,
        evidence.find((p) => p.id === 286032722),
      ),
    ),
    center = [0, 1].map((i) => mast.reduce((s, p) => s + p[i], 0) / mast.length),
    heights = level === 'skyline' ? [0, 9, 29.5656] : [0, 3.3, 5.2, 9, 18, 26.5, 29.5656];
  loft(
    out,
    'stainless',
    heights.map((h) =>
      radialRing(
        spireBase + h,
        Math.max(0.032, 0.83 * (1 - h / 29.7)),
        Math.max(0.032, 0.64 * (1 - h / 29.7)),
        8,
        center,
        Math.PI / 8,
      ),
    ),
    level === 'skyline' ? average(silver, 'metal_stainless', 0) : silver,
  );
}
function build(out, level) {
  baseSimple(out, level);
  for (const p of pineParts) {
    if (p.top <= 16.5) continue;
    for (const e of exposed(p, pineParts, Math.max(16.5, p.bottom))) {
      facade(out, e, level);
      if (p.top < 252) rail(out, e, p.top + 0.11, level);
    }
    mappedCap(
      out,
      'concrete',
      p.plan,
      p.top,
      level === 'skyline' ? average([0.46, 0.44, 0.38], 'stone_limestone', 0) : [0.46, 0.44, 0.38],
    );
  }
  crown(out, level);
}
export const buildPineSkyline = (out) => build(out, 'skyline');
export const buildPineDistrict = (out) => build(out, 'district');
export const buildPineStreet = (out) => build(out, 'street');
export const buildPineCloseup = (out) => build(out, 'closeup');
