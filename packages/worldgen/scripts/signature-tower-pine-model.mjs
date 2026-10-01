/** 70 Pine Street: independently mapped setbacks and original exterior ornament. */
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
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
import { tube } from './structure-mesh.mjs';

const stone = [0.71, 0.685, 0.62],
  silver = [0.61, 0.64, 0.63],
  glass = [0.14, 0.18, 0.17];
const shifted = (p, n, d) => p.map((v, i) => v + n[i] * d);
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
        bottom = Math.max(
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
function decorativeRail(out, a, b, n, y) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.35) return;
  const at = frame(a, b, n),
    count = Math.max(1, Math.round(len / 1.65)),
    bw = len / count;
  for (const yy of [0.12, 0.94])
    tube(out, 'metal', at(0, y + yy, -0.11), at(len, y + yy, -0.11), 0.033, silver, 6);
  for (let j = 0; j <= count; j++)
    tube(out, 'metal', at(j * bw, y, -0.11), at(j * bw, y + 1.15, -0.11), 0.037, silver, 6);
  for (let j = 0; j < count; j++) {
    const cx = (j + 0.5) * bw;
    for (let k = 0; k < 5; k++) {
      const angle = Math.PI * 0.1 + (Math.PI * 0.8 * k) / 4;
      tube(
        out,
        'metal',
        at(cx, y + 0.18, -0.11),
        at(cx + bw * 0.48 * Math.cos(angle), y + 0.22 + 0.87 * Math.sin(angle), -0.11),
        0.022,
        silver,
        5,
      );
    }
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 12,
        b = ((k + 1) * Math.PI) / 12;
      tube(
        out,
        'metal',
        at(cx + bw * 0.48 * Math.cos(a), y + 0.22 + 0.87 * Math.sin(a), -0.11),
        at(cx + bw * 0.48 * Math.cos(b), y + 0.22 + 0.87 * Math.sin(b), -0.11),
        0.021,
        silver,
        5,
      );
    }
  }
}
function portal(out, at, cx, big = true) {
  const w = big ? 8.7 : 6.2,
    h = big ? 15.2 : 8.7;
  const extent = big ? 6 : 4.65;
  for (const [left, right, bottom, top] of [
    [-extent, -w / 2, 0, 16.5],
    [w / 2, extent, 0, 16.5],
    [-w / 2, w / 2, h, 16.5],
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
}
export function build70Pine(out, m) {
  const evidence = partsEvidence('n0188_70_pine_street').filter(
    (p) => p.type === 'way' && p.tags?.['building:part'],
  );
  const parts = evidence
    .filter((p) => Number(p.tags.height) <= 252)
    .map((p) => ({
      id: p.id,
      plan: clean(partPlan(m, p)),
      bottom: Number(p.tags.min_height || 0),
      top: Number(p.tags.height),
    }));
  const base = clean(localOutline(m));
  mappedSolid(out, 'foundation', base, 0, 0.16, [0.35, 0.31, 0.27]);
  // Four street portals: native +Z is Pine, -Z Cedar, +X Pearl.
  for (const { a, b, len, n } of edges(base)) {
    const at = frame(a, b, n),
      street = Math.abs(n[2]) > 0.92 || n[0] > 0.92;
    if (!street) {
      face(out, 'limestone', [at(0, 0.16), at(len, 0.16), at(len, 16.5), at(0, 16.5)], stone);
      continue;
    }
    const portalX = Math.abs(n[2]) > 0.92 ? [5.9, -23] : [];
    const centers = portalX
      .map((x) => ({ c: ((x - a[0]) / (b[0] - a[0])) * len, big: x === 5.9 }))
      .filter(({ c, big }) => c > (big ? 6 : 4.65) && c < len - (big ? 6 : 4.65));
    if (n[0] > 0.92 && len > 20) centers.push({ c: len / 2, big: false });
    // All perimeter subsegments are retained; openings only where a portal fits.
    const cuts = [
      0,
      len,
      ...centers.flatMap(({ c, big }) => [c - (big ? 6 : 4.65), c + (big ? 6 : 4.65)]),
    ].sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const left = cuts[k - 1],
        right = cuts[k],
        mid = (left + right) / 2;
      if (centers.some(({ c, big }) => Math.abs(mid - c) < (big ? 6 : 4.65))) continue;
      const counts = Math.max(1, Math.round((right - left) / 2.4)),
        bw = (right - left) / counts;
      for (let i = 0; i < counts; i++) {
        const x = left + (i + 0.5) * bw;
        const aa = lerp(a, b, (left + i * bw) / len),
          bb = lerp(a, b, (left + (i + 1) * bw) / len);
        for (let j = 0; j < 4; j++)
          masonry(out, aa, bb, n, 0.16 + j * 4.085, 0.16 + (j + 1) * 4.085, 'limestone');
        plaque(out, at, x, 1.1, bw, 2.2, [0.15, 0.095, 0.08], 'stone', 0.04);
        rosette(out, at, x, 11.65, 0.37);
      }
    }
    for (const { c, big } of centers) portal(out, at, c, big);
  }
  mappedCap(out, 'limestone', base, 16.5, stone);
  for (const p of parts) {
    if (p.top <= 16.5) continue;
    const visible = exposed(p, parts, Math.max(16.5, p.bottom));
    for (const { a, b, n, bottom, top } of visible) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.round(len / 2.18)),
        levels = [
          bottom,
          ...Array.from({ length: 65 }, (_, i) => 16.5 + i * 3.9).filter(
            (y) => y > bottom + 0.08 && y < top - 0.08,
          ),
          top,
        ];
      for (let j = 1; j < levels.length; j++)
        for (let i = 0; i < count; i++)
          masonry(
            out,
            lerp(a, b, i / count),
            lerp(a, b, (i + 1) / count),
            n,
            levels[j - 1],
            levels[j],
          );
      if (top < 252) decorativeRail(out, a, b, n, top + 0.11);
      const at = frame(a, b, n);
      plaque(out, at, len / 2, top - 0.14, len, 0.26, stone, 'limestone', 0.065);
      if (top >= 210)
        for (let i = 0; i < count; i++) {
          const cx = ((i + 0.5) * len) / count;
          for (let k = -2; k <= 2; k++)
            plaque(
              out,
              at,
              cx + k * 0.15,
              top - 0.25 - Math.abs(k) * 0.04,
              0.08,
              0.28,
              [0.76, 0.76, 0.69],
              'metal',
              0.08,
            );
        }
    }
    mappedCap(out, 'concrete', p.plan, p.top, [0.46, 0.44, 0.38]);
  }
  const lantern = evidence
    .filter((p) => Number(p.tags.height) > 252 && Number(p.tags.height) <= 264)
    .sort((a, b) => Number(a.tags.height) - Number(b.tags.height));
  const spireBase = 290.1696 - 97 * 0.3048,
    scale = (spireBase - 252) / 12;
  for (const p of lantern) {
    const plan = clean(partPlan(m, p)),
      lo = 252 + (Number(p.tags.min_height) - 252) * scale,
      hi = 252 + (Number(p.tags.height) - 252) * scale;
    for (const { a, b, n } of edges(plan)) {
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        [0.41, 0.53, 0.5],
        1.2,
        1.4,
        0.09,
        silver,
        'stainless',
      );
      beam(out, 'stainless', [a[0], hi, a[1]], [b[0], hi, b[1]], 0.16, 0.16, silver);
      if (hi < 258) decorativeRail(out, a, b, n, hi + 0.06);
    }
    mappedCap(out, 'metal', plan, hi, [0.42, 0.47, 0.43]);
  }
  const mast = clean(
      partPlan(
        m,
        evidence.find((p) => p.id === 286032722),
      ),
    ),
    center = [
      mast.reduce((s, p) => s + p[0], 0) / mast.length,
      mast.reduce((s, p) => s + p[1], 0) / mast.length,
    ];
  const rings = [0, 3.3, 5.2, 9, 18, 26.5, 29.5656].map((h) =>
    radialRing(
      spireBase + h,
      Math.max(0.032, 0.83 * (1 - h / 29.7)),
      Math.max(0.032, 0.64 * (1 - h / 29.7)),
      8,
      center,
      Math.PI / 8,
    ),
  );
  loft(out, 'stainless', rings, silver);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    tube(
      out,
      'stainless',
      [center[0] + 0.88 * Math.cos(a), spireBase, center[1] + 0.69 * Math.sin(a)],
      [center[0] + 0.48 * Math.cos(a), spireBase + 9, center[1] + 0.38 * Math.sin(a)],
      0.038,
      [0.76, 0.77, 0.74],
      6,
    );
  }
  // Enclosed1979 bridge is a separate adjoining building relationship; excluded.
}
