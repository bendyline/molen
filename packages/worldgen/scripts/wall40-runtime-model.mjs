/** 40 Wall Street: mapped asymmetric setbacks, continuous masonry and closed Gothic crown. */
import { readFileSync } from 'node:fs';
import { beam, beamPath, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = '40_wall_street',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  skyline: { step: 0, bay: 0, relief: 0, seams: 0, windows: false },
  district: { step: 8, bay: 6.75, relief: 0, seams: 0, windows: true },
  street: { step: 3, bay: 2.25, relief: 8, seams: 0, windows: true },
  closeup: { step: 1, bay: 2.25, relief: 16, seams: 16, windows: true },
};
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.035);
}
function inside([x, z], plan) {
  let result = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      result = !result;
  }
  return result;
}
/** Split a mapped edge at adjoining part boundaries, then find its lowest exposed height. */
function exposedEdges(block, blocks, start) {
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
          const t = ((p[0] - a[0]) * e[1] - (p[1] - a[1]) * e[0]) / den;
          const u = ((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / den;
          if (t > 1e-7 && t < 1 - 1e-7 && u >= -1e-6 && u <= 1 + 1e-6) cuts.push(t);
        }
        const t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / (len * len);
        const distance = Math.abs((p[0] - a[0]) * d[1] - (p[1] - a[1]) * d[0]) / len;
        if (distance < 0.09 && t > 1e-7 && t < 1 - 1e-7) cuts.push(t);
      }
    }
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      if ((cuts[k] - cuts[k - 1]) * len < 0.06) continue;
      const aa = lerp(a, b, cuts[k - 1]),
        bb = lerp(a, b, cuts[k]);
      const mid = lerp(aa, bb, 0.5),
        outside = [mid[0] + n[0] * 0.06, mid[1] + n[2] * 0.06];
      const bottom = Math.max(
        start,
        ...blocks.filter((o) => o !== block && inside(outside, o.plan)).map((o) => o.top),
      );
      if (bottom < block.top - 0.01) result.push({ a: aa, b: bb, n, bottom, top: block.top });
    }
  }
  return result;
}
function cleanPlan(plan) {
  let points = plan;
  for (let pass = 0; pass < 4; pass++) {
    const next = points.filter((p, i) => {
      const a = points[(i + points.length - 1) % points.length],
        b = points[(i + 1) % points.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return (
        len < 0.05 ||
        Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / len > 0.045
      );
    });
    if (next.length === points.length || next.length < 3) break;
    points = next;
  }
  return clockwise(points);
}
function frameAt(a, b, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
  return (x, y, d = 0) => [a[0] + t[0] * x + n[0] * d, y, a[1] + t[2] * x + n[2] * d];
}
function reliefRoundel(out, at, x, y, r, stone, sun = false, sides = 16) {
  const point = (a, rr, d) => at(x + Math.cos(a) * rr, y + Math.sin(a) * rr, d);
  for (let i = 0; i < sides; i++) {
    const a = (i * 2 * Math.PI) / sides,
      b = ((i + 1) * 2 * Math.PI) / sides;
    tri(
      out,
      'recess',
      [at(x, y, 0.035), point(a, r, 0.035), point(b, r, 0.035)],
      [0.32, 0.31, 0.27],
    );
    face(
      out,
      'cladding',
      [point(a, r, 0.08), point(b, r, 0.08), point(b, r * 0.79, 0.13), point(a, r * 0.79, 0.13)],
      stone,
    );
  }
  if (sun)
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      tri(
        out,
        'cladding',
        [point(a - 0.1, r * 0.35, 0.08), point(a, r * 0.72, 0.14), point(a + 0.1, r * 0.35, 0.08)],
        stone,
      );
    }
  else
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const pts = [
        point(a - 0.3, r * 0.15, 0.07),
        point(a - 0.15, r * 0.66, 0.11),
        point(a, r * 0.75, 0.14),
        point(a + 0.15, r * 0.66, 0.11),
        point(a + 0.3, r * 0.15, 0.07),
      ];
      for (let j = 1; j < pts.length - 1; j++)
        tri(out, 'cladding', [pts[0], pts[j], pts[j + 1]], stone);
    }
  for (let i = 0; i < 24; i++)
    tri(
      out,
      'cladding',
      [
        at(x, y, 0.15),
        point((i * Math.PI) / 12, r * 0.28, 0.15),
        point(((i + 1) * Math.PI) / 12, r * 0.28, 0.15),
      ],
      stone,
    );
}
function lancet(out, at, x, y, w, h, stone) {
  const p = [
    at(x - w / 2, y, 0.32),
    at(x + w / 2, y, 0.32),
    at(x + w / 2, y + h * 0.72, 0.32),
    at(x, y + h, 0.32),
    at(x - w / 2, y + h * 0.72, 0.32),
  ];
  for (let i = 1; i < p.length - 1; i++)
    tri(out, 'glass', [p[0], p[i], p[i + 1]], [0.1, 0.15, 0.145]);
  beamPath(out, 'cladding', p.slice(0, p.length), 0.14, 0.21, stone, true);
}

function strip(out, at, x0, x1, y0, y1, color, slot = 'brick', depth = 0) {
  face(
    out,
    slot,
    [at(x0, y0, depth), at(x1, y0, depth), at(x1, y1, depth), at(x0, y1, depth)],
    color,
  );
}
function masonryField(out, a, b, n, low, high, cfg) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frameAt(a, b, n),
    upper = low >= 221,
    brick = upper ? [0.43, 0.36, 0.28] : [0.67, 0.62, 0.49],
    spandrel = [0.54, 0.49, 0.37],
    glass = [0.14, 0.185, 0.185];
  if (!cfg.step) {
    const mean = scope.sourceFacts.surfaceMeans.brick,
      coverage = 0.42 + 0.58 / 3.84615;
    strip(
      out,
      at,
      0,
      len,
      low,
      high,
      brick.map((v, i) => v * mean[i] * coverage + glass[i] * (1 - coverage)),
    );
    return;
  }
  strip(out, at, 0, len, low, high, glass, 'glass', -0.025);
  const count = Math.max(1, Math.round(len / cfg.bay)),
    bw = len / count,
    half = bw * 0.21;
  for (let i = 0; i <= count; i++) {
    const x = i * bw;
    strip(out, at, Math.max(0, x - half), Math.min(len, x + half), low, high, brick);
  }
  const cuts = [
    low,
    ...Array.from({ length: 54 }, (_, i) => 30 + i * 3.84615).filter(
      (y) => y > low + 0.1 && y < high - 0.1,
    ),
    high,
  ];
  for (let j = 1; j < cuts.length; j += cfg.step) {
    const y = cuts[j - 1],
      end = cuts[Math.min(j + cfg.step - 1, cuts.length - 1)];
    strip(out, at, 0, len, y, Math.min(y + 0.48, end), spandrel, 'brick', 0.006);
    strip(out, at, 0, len, Math.max(y, end - 0.53), end, spandrel, 'brick', 0.006);
    if (y >= 188 && end < 221)
      strip(out, at, 0, len, Math.max(y, end - 0.53), end, [0.79, 0.755, 0.65], 'cladding', 0.08);
  }
  if (high >= 212 && high <= 225) {
    for (let i = 0; i <= count; i++) {
      const x = i * bw;
      strip(
        out,
        at,
        Math.max(0, x - 0.2),
        Math.min(len, x + 0.2),
        Math.max(low, high === 212 ? 191 : 212),
        high + 0.45,
        [0.77, 0.735, 0.635],
        'cladding',
        0.14,
      );
    }
  }
}
function buildWall40(out, m, level) {
  const cfg = settings[level],
    base = cleanPlan(localOutline(m)),
    evidence = map.elements.filter((p) => p.id !== 278042253);
  const limestone = [0.77, 0.735, 0.635],
    copper = [0.245, 0.48, 0.415];
  const parts = evidence
    .filter((p) => Number(p.tags.height) <= 230)
    .map((p) => ({
      id: p.id,
      plan: cleanPlan(partPlan(m, p)),
      bottom: Number(p.tags.min_height || 0),
      top: Number(p.tags.height),
    }));
  mappedSolid(out, 'foundation', base, 0, 0.2, [0.42, 0.4, 0.35]);
  // L-shaped bank base. The two street elevations have the landmark's great
  // limestone colonnades; party walls retain the footprint, without invented doors.

  for (const { a, b, n, len } of edges(base)) {
    const at = frameAt(a, b, n),
      street = Math.abs(n[2]) > 0.94 && Math.abs((a[1] + b[1]) / 2) > 22;
    if (!street || !cfg.step) {
      strip(out, at, 0, len, 0.2, 30, limestone, 'cladding');
      continue;
    }
    strip(out, at, 0, len, 0.2, 30, [0.12, 0.17, 0.17], 'glass', -0.025);
    const bays = Math.max(1, Math.round(len / (n[2] > 0 ? 5 : 6.25))),
      bw = len / bays;
    for (let i = 0; i <= bays; i++) {
      const x = i * bw;
      strip(
        out,
        at,
        Math.max(0, x - 0.55),
        Math.min(len, x + 0.55),
        0.2,
        25.4,
        limestone,
        'cladding',
        0.12,
      );
    }
    for (const [yy, h, depth] of [
      [5, 0.35, 0.3],
      [24.5, 0.55, 0.4],
      [25.5, 0.55, 0.3],
      [29.55, 0.4, 0.4],
    ])
      beam(out, 'cladding', at(0, yy, depth), at(len, yy, depth), 0.34, h, limestone);
    strip(out, at, 0, len, 25.65, 30, limestone, 'cladding');
    for (let i = 0; i < bays; i++) {
      const x = i * bw;
      for (let yy = 4.1; yy < 25; yy += cfg.step === 8 ? 8.4 : 4.2)
        strip(out, at, x + 0.55, x + bw - 0.55, yy, yy + 0.9, [0.28, 0.32, 0.33], 'metal', -0.015);
      for (const u of [0.2, 0.8])
        strip(
          out,
          at,
          x + bw * u - 0.5,
          x + bw * u + 0.5,
          26.2,
          28.65,
          [0.12, 0.17, 0.16],
          'glass',
          0.035,
        );
      if (cfg.relief) reliefRoundel(out, at, x + bw / 2, 27.55, 0.74, limestone, true, cfg.relief);
      if (level === 'closeup')
        for (const xx of [x + 0.11, x + 0.3, x + 0.48])
          beam(out, 'cladding', at(xx, 5, 0.2), at(xx, 24.4, 0.2), 0.07, 0.13, [0.72, 0.69, 0.6]);
    }
  }
  mappedCap(out, 'cladding', base, 30, limestone);
  // Each mapped part gives an actual setback, rather than a symmetric stack.
  // Exposed edges exclude walls buried by an adjoining taller volume.
  for (const p of parts) {
    if (p.top <= 30) continue;
    for (const { a, b, n, bottom, top } of exposedEdges(p, parts, Math.max(30, p.bottom))) {
      masonryField(out, a, b, n, bottom, top, cfg);
    }
    mappedCap(out, 'metal', p.plan, p.top, [0.43, 0.44, 0.4]);
    if (cfg.step)
      for (const { a, b, n } of exposedEdges({ ...p, top: p.top + 0.35 }, parts, p.top)) {
        if (level === 'district') {
          const at = frameAt(a, b, n);
          strip(
            out,
            at,
            0,
            Math.hypot(b[0] - a[0], b[1] - a[1]),
            p.top - 0.37,
            p.top + 0.13,
            limestone,
            'cladding',
            0.09,
          );
          continue;
        }
        beam(
          out,
          'cladding',
          [a[0] + n[0] * 0.09, p.top - 0.12, a[1] + n[2] * 0.09],
          [b[0] + n[0] * 0.09, p.top - 0.12, b[1] + n[2] * 0.09],
          0.35,
          0.5,
          limestone,
        );
      }
  }
  const roofPart = evidence.find((p) => p.id === 286057109),
    roof = cleanPlan(partPlan(m, roofPart));
  const cx = roof.reduce((v, p) => v + p[0], 0) / roof.length,
    cz = roof.reduce((v, p) => v + p[1], 0) / roof.length;
  const small = roof.map((p) => [cx + (p[0] - cx) * 0.205, cz + (p[1] - cz) * 0.205]);
  const bottomRing = roof.map((p) => [p[0], 230, p[1]]),
    upperRing = small.map((p) => [p[0], 262, p[1]]);
  loft(out, 'metal', [bottomRing, upperRing], copper);
  mappedCap(out, 'metal', small, 262, copper);
  for (let side = 0; side < 4; side++) {
    const k = (side + 1) % 4,
      a = bottomRing[side],
      b = bottomRing[k],
      c = upperRing[k],
      d = upperRing[side];
    const n = edges(roof)[side].n,
      roofAt = frameAt(roof[side], roof[k], n),
      at = (x, y, d = 0) => roofAt(x, y, d + 1.05),
      length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const slopeNormal = [n[0] * 0.97, 0.243, n[2] * 0.97],
      on = (u, v) => shift(lerp(lerp(a, b, u), lerp(d, c, u), v), slopeNormal, 0.14);
    if (cfg.seams)
      for (let i = 0; i <= cfg.seams; i++)
        beam(
          out,
          'metal',
          on(i / cfg.seams, 0.002),
          on(i / cfg.seams, 0.997),
          0.055,
          0.07,
          [0.37, 0.58, 0.49],
        );
    if (cfg.windows)
      for (const [v, count] of [
        [0.1, 9],
        [0.25, 7],
        [0.4, 5],
        [0.55, 3],
        [0.7, 1],
      ])
        for (let i = 0; i < count; i++) {
          const u = 0.5 + (i - (count - 1) / 2) * 0.092,
            w = 0.022,
            h = 0.043;
          face(
            out,
            'glass',
            [on(u - w, v), on(u + w, v), on(u + w, v + h), on(u - w, v + h)],
            [0.1, 0.15, 0.145],
          );
        }
    // Central two-story wall dormer rises into each copper roof face. Its
    // three pointed openings and paired pinnacles are visible in LPC closeups.
    const mid = length / 2,
      wide = 4.2;
    face(
      out,
      'cladding',
      [
        at(mid - wide / 2, 221, 0.13),
        at(mid + wide / 2, 221, 0.13),
        at(mid + wide / 2, 234.6, 0.13),
        at(mid - wide / 2, 234.6, 0.13),
      ],
      limestone,
    );

    for (const sign of [-1, 1]) {
      const x = mid + (sign * wide) / 2,
        pts = [at(x, 221, -1.5), at(x, 221, 0.13), at(x, 234.6, 0.13), at(x, 234.6, -1.5)];
      face(out, 'cladding', sign === 1 ? pts.toReversed() : pts, limestone);
    }
    face(
      out,
      'cladding',
      [
        at(mid - wide / 2, 234.6, 0.13),
        at(mid + wide / 2, 234.6, 0.13),
        at(mid + wide / 2, 234.6, -1.5),
        at(mid - wide / 2, 234.6, -1.5),
      ],
      limestone,
    );
    if (cfg.windows) {
      for (const yy of [221.5, 225.2])
        face(
          out,
          'glass',
          [
            at(mid - 1.35, yy, 0.22),
            at(mid + 1.35, yy, 0.22),
            at(mid + 1.35, yy + 2.4, 0.22),
            at(mid - 1.35, yy + 2.4, 0.22),
          ],
          [0.11, 0.16, 0.155],
        );
      for (const x of [-1.26, 0, 1.26]) lancet(out, at, mid + x, 230.2, 0.8, 3.3, limestone);
      for (const x of [-wide / 2, wide / 2]) {
        beam(
          out,
          'cladding',
          at(mid + x, 221, 0.3),
          at(mid + x, 235.1, 0.3),
          0.32,
          0.45,
          limestone,
        );
        const q = at(mid + x, 235.1, 0.3);
        loft(
          out,
          'cladding',
          [
            radialRing(q[1], 0.2, 0.2, 8, [q[0], q[2]]),
            radialRing(q[1] + 1.1, 0.035, 0.035, 8, [q[0], q[2]]),
          ],
          limestone,
        );
      }
      for (const sign of [-1, 1])
        beam(
          out,
          'cladding',
          at(mid + sign * 1.8, 228.5, 0.39),
          at(mid, 230, 0.39),
          0.24,
          0.32,
          limestone,
        );
    }
    // Fine pointed parapet ornament between the center dormer and corners.
    if (level === 'closeup')
      for (let i = 0; i < 19; i++) {
        const x = ((i + 0.5) * length) / 19;
        if (Math.abs(x - mid) < 2.3) continue;
        beam(out, 'cladding', at(x, 229.8, 0.16), at(x, 230.6, 0.16), 0.17, 0.2, limestone);
        const q = at(x, 230.6, 0.16);
        loft(
          out,
          'cladding',
          [
            radialRing(q[1], 0.13, 0.13, 6, [q[0], q[2]]),
            radialRing(q[1] + 0.42, 0.015, 0.015, 6, [q[0], q[2]]),
          ],
          limestone,
        );
      }
  }
  // Copper lanterns, narrowed octagonal belfry, finial and flagpole. The LPC
  // recorded height927ft is used as the authoring envelope, including pole.
  for (const [y0, y1, r0, r1] of [
    [261.8, 264.0, 2.4, 2.4],
    [264, 269, 1.55, 1.55],
    [269, 272, 1.25, 0.82],
    [272, 278, 0.82, 0.1],
  ]) {
    loft(
      out,
      'metal',
      [
        radialRing(y0, r0, r0, 8, [cx, cz], Math.PI / 8),
        radialRing(y1, r1, r1, 8, [cx, cz], Math.PI / 8),
      ],
      copper,
    );
    if (cfg.windows && y1 - y0 > 3)
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 - (i * Math.PI) / 4,
          b = Math.PI / 8 - ((i + 1) * Math.PI) / 4;
        const p = [cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0],
          q = [cx + Math.cos(b) * r0, y0, cz + Math.sin(b) * r0];
        if (y0 < 270) {
          const n = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
          face(
            out,
            'glass',
            [p, q, [q[0], y1, q[2]], [p[0], y1, p[2]]].map((v) => shift(v, n, 0.045)),
            [0.12, 0.2, 0.17],
          );
        }
        if (level === 'closeup')
          tube(
            out,
            'metal',
            p,
            [cx + Math.cos(a) * r1, y1, cz + Math.sin(a) * r1],
            0.075,
            [0.39, 0.58, 0.46],
            8,
          );
      }
  }
  if (level === 'street' || level === 'closeup')
    for (const [y, r, h] of [
      [261.8, 2.46, 3.1],
      [264, 1.62, 5.4],
    ])
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 - (i * Math.PI) / 4,
          b = Math.PI / 8 - ((i + 1) * Math.PI) / 4;
        const point = (angle, yy, rr = r) => [
          cx + Math.cos(angle) * rr,
          yy,
          cz + Math.sin(angle) * rr,
        ];
        const mid = (a + b) / 2;
        for (const angle of [a, b])
          beam(out, 'metal', point(angle, y), point(angle, y + h), 0.11, 0.14, [0.41, 0.58, 0.46]);
        beam(
          out,
          'metal',
          point(a, y + h - 0.55),
          point(mid, y + h + 0.36, r * 0.94),
          0.1,
          0.15,
          [0.42, 0.6, 0.48],
        );
        beam(
          out,
          'metal',
          point(mid, y + h + 0.36, r * 0.94),
          point(b, y + h - 0.55),
          0.1,
          0.15,
          [0.42, 0.6, 0.48],
        );
        beam(out, 'metal', point(a, y + 0.22), point(b, y + 0.22), 0.12, 0.14, [0.42, 0.6, 0.48]);
      }
  if (level === 'street' || level === 'closeup')
    sphere(
      out,
      'glass',
      [cx, 278.6, cz],
      [0.34, 0.34, 0.34],
      [0.61, 0.72, 0.69],
      level === 'closeup' ? 12 : 8,
      6,
    );
  tube(out, 'metal', [cx, 278, cz], [cx, 282.5496, cz], 0.055, [0.64, 0.66, 0.59], 8);
}

function build(out, level) {
  const target =
    level === 'skyline'
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
            name,
            (slot, _ref, points, normal, uv, color) => {
              const mean =
                slot === 'metal'
                  ? scope.sourceFacts.surfaceMeans.metal_painted
                  : slot === 'brick'
                    ? null
                    : scope.sourceFacts.surfaceMeans.stone_limestone;
              out[name](
                'silhouette',
                'palette:#ffffff',
                points,
                normal,
                uv,
                mean ? color.map((v, i) => v * mean[i]) : color,
              );
            },
          ]),
        )
      : out;
  buildWall40(target, map, level);
}
export const buildWall40ReviewedMaster = (out) => build(out, 'closeup');
export const buildWall40Skyline = (out) => build(out, 'skyline');
export const buildWall40District = (out) => build(out, 'district');
export const buildWall40Street = (out) => build(out, 'street');
export const buildWall40Closeup = (out) => build(out, 'closeup');
