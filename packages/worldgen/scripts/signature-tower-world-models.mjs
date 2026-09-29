/** Individual researched tower exteriors N0176 onward. Meter units, +Y up. */
import { beam, loft, normalFor, radialRing, sphere, torus } from './authored-structure-mesh.mjs';
import { threeWtcStudy } from './signature-tower-3wtc-model.mjs';
import { park432Study } from './signature-tower-432-park-model.mjs';
import { atlantaStudy } from './signature-tower-atlanta-model.mjs';
import { cayanStudy } from './signature-tower-cayan-model.mjs';
import { buildCctv } from './signature-tower-cctv-model.mjs';
import { centerStudy } from './signature-tower-center-model.mjs';
import { citicorpStudy } from './signature-tower-citicorp-model.mjs';
import { emiratesStudies } from './signature-tower-emirates-models.mjs';
import {
  axes,
  bandPlan,
  clockwise,
  commonLimit,
  face,
  grid,
  guardrail,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { buildFlame } from './signature-tower-flame-model.mjs';
import { buildGuangzhouIfc } from './signature-tower-guangzhou-ifc-model.mjs';
import { luxorStudy } from './signature-tower-luxor-model.mjs';
import { marina101Study } from './signature-tower-marina101-model.mjs';
import { buildMetlife } from './signature-tower-metlife-model.mjs';
import { buildMetropolitan } from './signature-tower-metropolitan-model.mjs';
import { moeveStudy } from './signature-tower-moeve-model.mjs';
import { build70Pine } from './signature-tower-pine-model.mjs';
import { buildPingAn } from './signature-tower-pingan-model.mjs';
import { princessStudy } from './signature-tower-princess-model.mjs';
import { buildRockefeller } from './signature-tower-rockefeller-model.mjs';
import { buildRose } from './signature-tower-rose-model.mjs';
import { seagramStudy } from './signature-tower-seagram-model.mjs';
import { telekomStudy } from './signature-tower-telekom-model.mjs';
import { buildYokohama } from './signature-tower-yokohama-model.mjs';
import { box, tube } from './structure-mesh.mjs';

const metal = [0.62, 0.66, 0.67];
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
/** Granite and glazing both follow the actual projecting triangular bay, rather
 * than laying a folded window into an otherwise flat stone grid. */
function stoneBay(out, a, b, n, low, high, stone, glass) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    inset = Math.min(0.17, 0.36 / len);
  const peak = Math.min(0.62, len * 0.19);
  const profile = (u) => peak * (1 - Math.abs(u * 2 - 1));
  const point = (u, y, recess = 0) => [
    a[0] + (b[0] - a[0]) * u + n[0] * (profile(u) + recess),
    y,
    a[1] + (b[1] - a[1]) * u + n[2] * (profile(u) + recess),
  ];
  const strip = (u0, u1, y0, y1, slot = 'cladding', color = stone, recess = 0) => {
    const cuts = [u0, ...(u0 < 0.5 && u1 > 0.5 ? [0.5] : []), u1];
    for (let k = 1; k < cuts.length; k++)
      face(
        out,
        slot,
        [
          point(cuts[k - 1], y0, recess),
          point(cuts[k], y0, recess),
          point(cuts[k], y1, recess),
          point(cuts[k - 1], y1, recess),
        ],
        color,
      );
  };
  const y0 = low + 0.5,
    y1 = high - 0.72;
  if (y1 - y0 < 0.25) {
    strip(0, 1, low, high);
    return;
  }
  for (const [u0, u1, v0, v1] of [
    [0, inset, low, high],
    [1 - inset, 1, low, high],
    [inset, 1 - inset, low, y0],
    [inset, 1 - inset, y1, high],
  ])
    strip(u0, u1, v0, v1);
  strip(inset, 1 - inset, y0, y1, 'glass', glass, -0.13);
  for (const [u0, u1] of [
    [inset, 0.5],
    [0.5, 1 - inset],
  ])
    for (const y of [y0, y1]) {
      beam(
        out,
        'metal',
        point(u0, y, -0.12),
        point(u1, y, -0.12),
        0.045,
        0.055,
        [0.32, 0.35, 0.34],
      );
      const reveal = [point(u0, y), point(u1, y), point(u1, y, -0.13), point(u0, y, -0.13)];
      face(out, 'cladding', y === y0 ? reveal : reveal.toReversed(), stone);
    }
  for (const u of [inset, 0.5, 1 - inset])
    beam(out, 'metal', point(u, y0, -0.12), point(u, y1, -0.12), 0.045, 0.055, [0.31, 0.35, 0.34]);
  for (const u of [inset, 1 - inset]) {
    const points = [point(u, y0), point(u, y1), point(u, y1, -0.13), point(u, y0, -0.13)];
    face(out, 'cladding', u === inset ? points : points.toReversed(), stone);
  }
  for (const [u0, u1] of [
    [0, 0.5],
    [0.5, 1],
  ])
    beam(
      out,
      'recess',
      point(u0, high - 0.025, 0.009),
      point(u1, high - 0.025, 0.009),
      0.018,
      0.018,
      [0.38, 0.37, 0.34],
    );
  for (const u of [0.14, 0.86])
    beam(
      out,
      'recess',
      point(u, low, 0.009),
      point(u, high, 0.009),
      0.016,
      0.016,
      [0.45, 0.43, 0.4],
    );
}

function buildUsBank(out, m) {
  const key = 'n0176_u_s_bank_tower',
    base = localOutline(m),
    evidence = partsEvidence(key);
  const stone = [0.76, 0.73, 0.69],
    glass = [0.16, 0.29, 0.32];
  const blocks = evidence
    .filter((p) => p.tags['building:part'])
    .map((p) => ({
      id: p.id,
      plan: partPlan(m, p),
      top: p.id === 495115500 ? 295 : Number(p.tags.height),
    }));
  mappedSolid(out, 'foundation', base, 0, 0.22, [0.55, 0.53, 0.5]);
  // The renewed entrance is a two-level clear glazed enclosure with broad stone
  // piers. Its30ft lobby datum is given by the present owner.
  const lobby = base.map((p) => [p[0] * 0.965, p[1] * 0.965]);
  for (const { a, b, n, len } of edges(lobby)) {
    grid(
      out,
      [
        [a[0], 0.22, a[1]],
        [b[0], 0.22, b[1]],
        [b[0], 9.144, b[1]],
        [a[0], 9.144, a[1]],
      ],
      [0.22, 0.31, 0.31],
      2.1,
      4.572,
      0.065,
      [0.67, 0.66, 0.62],
    );
    if (len > 1.5) {
      const p = [a[0], 0.22, a[1]],
        q = [a[0], 9.144, a[1]];
      beam(out, 'cladding', shift(p, n, 0.2), shift(q, n, 0.2), 0.42, 0.7, stone);
    }
  }
  mappedCap(out, 'cladding', base, 9.144, stone);
  for (const block of blocks) {
    for (const { a, b, n, bottom, top } of exposedEdges(block, blocks, 9.144)) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        bays = Math.max(1, Math.round(len / 2.75));
      const levels = [
        bottom,
        ...Array.from({ length: 76 }, (_, i) => 9.144 + i * 4.08).filter(
          (y) => y > bottom + 0.01 && y < top - 0.01,
        ),
        top,
      ];
      for (let row = 1; row < levels.length; row++)
        for (let col = 0; col < bays; col++) {
          const tint = glass.map(
            (v, i) => v * (0.96 + ((col * 7 + row * 3) % 9) * 0.008) + (i === 2 ? 0.005 : 0),
          );
          stoneBay(
            out,
            lerp(a, b, col / bays),
            lerp(a, b, (col + 1) / bays),
            n,
            levels[row - 1],
            levels[row],
            stone,
            tint,
          );
        }
      // Three broad mechanical/terrace belts visible in the architect's elevation.
      for (const y of [195, 250, 291])
        if (y > bottom && y < top) {
          face(
            out,
            'glass',
            [
              [a[0] + n[0] * 0.28, y - 1.8, a[1] + n[2] * 0.28],
              [b[0] + n[0] * 0.28, y - 1.8, b[1] + n[2] * 0.28],
              [b[0] + n[0] * 0.28, y - 0.3, b[1] + n[2] * 0.28],
              [a[0] + n[0] * 0.28, y - 0.3, a[1] + n[2] * 0.28],
            ],
            [0.15, 0.25, 0.27],
          );
          beam(
            out,
            'cladding',
            [a[0] + n[0] * 0.3, y, a[1] + n[2] * 0.3],
            [b[0] + n[0] * 0.3, y, b[1] + n[2] * 0.3],
            0.35,
            0.45,
            stone,
          );
        }
    }
    mappedCap(out, 'metal', block.plan, block.top, [0.55, 0.55, 0.52]);
    // Setback coping follows the exposed part perimeter; neighboring taller
    // volumes contain the inner edges and hide the roof seams.
    for (const { a, b, n } of exposedEdges({ ...block, top: block.top + 0.3 }, blocks, block.top))
      beam(
        out,
        'cladding',
        [a[0] + n[0] * 0.08, block.top - 0.1, a[1] + n[2] * 0.08],
        [b[0] + n[0] * 0.08, block.top - 0.1, b[1] + n[2] * 0.08],
        0.2,
        0.25,
        stone,
      );
  }
  const core = blocks.find((b) => b.id === 495115500).plan;
  const center = [
    (Math.min(...core.map((p) => p[0])) + Math.max(...core.map((p) => p[0]))) / 2,
    (Math.min(...core.map((p) => p[1])) + Math.max(...core.map((p) => p[1]))) / 2,
  ];
  // Sixteen folded vertical bays form the illuminated crown. A stone face and
  // an angled green-glass return alternate around its scalloped circular plan.
  const phase = Math.atan2(1.58, 8.83),
    count = 16;
  const crown = clockwise(
    Array.from({ length: count * 2 }, (_, i) => {
      const a = phase + (i * Math.PI) / count,
        r = i % 2 ? 12.8 : 16.8;
      return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
    }),
  );
  for (const [i, { a, b, n }] of edges(crown).entries()) {
    if (i % 2)
      grid(
        out,
        [
          [a[0], 296.1, a[1]],
          [b[0], 296.1, b[1]],
          [b[0], 310.3, b[1]],
          [a[0], 310.3, a[1]],
        ],
        [0.2, 0.37, 0.4],
        20,
        1.55,
        0.12,
        [0.22, 0.3, 0.3],
      );
    else {
      face(
        out,
        'cladding',
        [
          [a[0], 296.1, a[1]],
          [b[0], 296.1, b[1]],
          [b[0], 310.3, b[1]],
          [a[0], 310.3, a[1]],
        ],
        stone,
      );
      for (let y = 297; y < 310; y += 1.5)
        beam(
          out,
          'recess',
          [a[0] + n[0] * 0.008, y, a[1] + n[2] * 0.008],
          [b[0] + n[0] * 0.008, y, b[1] + n[2] * 0.008],
          0.02,
          0.02,
          [0.48, 0.47, 0.43],
        );
    }
    beam(out, 'metal', [a[0], 296.1, a[1]], [a[0], 310.3, a[1]], 0.085, 0.085, [0.43, 0.48, 0.47]);
  }
  // Round open glazing collar joins the crown to the highest offices.
  const collar = radialRing(295, 16.4, 16.4, 96, center);
  for (let i = 0; i < collar.length; i++) {
    const p = collar[i],
      q = collar[(i + 1) % collar.length];
    face(
      out,
      'glass',
      [p, q, shift(q, [0, 1, 0], 1.3), shift(p, [0, 1, 0], 1.3)],
      [0.18, 0.29, 0.31],
    );
    beam(out, 'metal', p, shift(p, [0, 1, 0], 1.3), 0.04, 0.04, metal);
  }
  mappedCap(out, 'metal', crown, 296.1, [0.54, 0.55, 0.52], [], true);
  mappedCap(out, 'metal', crown, 309.9, [0.54, 0.55, 0.52]);
  for (const { a, b } of edges(crown))
    beam(out, 'metal', [a[0], 310.25, a[1]], [b[0], 310.25, b[1]], 0.09, 0.1, [0.43, 0.48, 0.47]);
  // Present owner's rooftop photo shows a red/white circular helipad surface.
  const landing = radialRing(309.92, 12.3, 12.3, 96, center);
  mappedCap(
    out,
    'metal',
    landing.map((p) => [p[0], p[2]]),
    309.92,
    [0.66, 0.2, 0.17],
  );
  torus(out, 'metal', [center[0], 309.95, center[1]], 10.8, 0.1, [0.9, 0.9, 0.85], 96, 6);
  const h = (x, z) => [center[0] + x, 309.96, center[1] + z];
  for (const x of [-2.2, 2.2])
    beam(out, 'metal', h(x, -3.5), h(x, 3.5), 0.48, 0.025, [0.9, 0.9, 0.85]);
  beam(out, 'metal', h(-2.2, 0), h(2.2, 0), 0.48, 0.025, [0.9, 0.9, 0.85]);
  // Entry canopy follows Fifth Street, at the southwest side of the signed map frame.
  const direction = ((211 - 90) * Math.PI) / 180 + m.heading;
  const entrance = (angle, r, y) => [Math.cos(angle) * r, y, Math.sin(angle) * r];
  for (let i = 0; i <= 6; i++) {
    const a = direction - 0.57 + i * 0.19;
    beam(out, 'cladding', entrance(a, 28.7, 0.22), entrance(a, 28.7, 9.144), 0.95, 0.85, stone);
  }
  for (let i = 0; i < 18; i++) {
    const a = direction - 0.59 + i * 0.065,
      b = direction - 0.59 + (i + 1) * 0.065;
    const p = entrance(a, 30.4, 3.3),
      q = entrance(b, 30.4, 3.3);
    face(out, 'metal', [entrance(a, 25.3, 3.3), entrance(b, 25.3, 3.3), q, p], [0.46, 0.43, 0.38]);
    beam(out, 'metal', p, q, 0.2, 0.25, [0.61, 0.58, 0.53]);
    if (i % 3 === 0)
      beam(
        out,
        'metal',
        entrance(a, 30, 0.02),
        entrance(a, 30, 3.3),
        0.16,
        0.16,
        [0.58, 0.57, 0.51],
      );
  }
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
function reliefRoundel(out, at, x, y, r, stone, sun = false) {
  const point = (a, rr, d) => at(x + Math.cos(a) * rr, y + Math.sin(a) * rr, d);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      b = ((i + 1) * Math.PI) / 16;
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
function masonryBay(out, a, b, n, low, high, { upper = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    at = frameAt(a, b, n),
    width = Math.max(0.12, len * 0.58),
    left = (len - width) / 2,
    right = (len + width) / 2;
  const stone = [0.79, 0.755, 0.65],
    brick = upper ? [0.43, 0.36, 0.28] : [0.67, 0.62, 0.49],
    spandrel = [0.54, 0.49, 0.37];
  const bottom = low + 0.48,
    top = high - 0.53;
  const wall = (x0, x1, y0, y1, color, slot = 'brick', d = 0) =>
    face(out, slot, [at(x0, y0, d), at(x1, y0, d), at(x1, y1, d), at(x0, y1, d)], color);
  if (len < 0.9 || top - bottom < 0.5) {
    wall(0, len, low, high, brick);
    return;
  }
  wall(0, left, low, high, brick);
  wall(right, len, low, high, brick);
  wall(left, right, low, bottom, spandrel, 'brick', -0.09);
  wall(left, right, top, high, spandrel, 'brick', -0.09);
  wall(left, right, bottom, top, [0.14, 0.185, 0.185], 'glass', -0.17);
  for (const x of [left, right]) {
    const q = [at(x, bottom), at(x, top), at(x, top, -0.17), at(x, bottom, -0.17)];
    face(out, 'brick', x === left ? q : q.toReversed(), brick);
    beam(out, 'metal', at(x, bottom, -0.14), at(x, top, -0.14), 0.065, 0.06, [0.46, 0.47, 0.44]);
  }
  for (const y of [bottom, top]) {
    const q = [at(left, y), at(right, y), at(right, y, -0.17), at(left, y, -0.17)];
    face(out, 'brick', y === bottom ? q : q.toReversed(), brick);
    beam(out, 'metal', at(left, y, -0.14), at(right, y, -0.14), 0.065, 0.06, [0.46, 0.47, 0.44]);
  }
  beam(
    out,
    'metal',
    at(left, (bottom + top) / 2, -0.14),
    at(right, (bottom + top) / 2, -0.14),
    0.05,
    0.05,
    [0.43, 0.45, 0.42],
  );
  beam(
    out,
    'cladding',
    at(left - 0.1, bottom - 0.045, 0.045),
    at(right + 0.1, bottom - 0.045, 0.045),
    0.13,
    0.16,
    stone,
  );
  if (low >= 188 && high < 221) {
    wall(left - 0.09, right + 0.09, top - 0.01, high, stone, 'cladding', 0.08);
    if (high - top > 0.22) {
      const w = Math.min(0.5, width * 0.37),
        yc = (top + high) / 2;
      const diamond = [
        at(len / 2 - w / 2, yc, 0.1),
        at(len / 2, yc - w * 0.38, 0.1),
        at(len / 2 + w / 2, yc, 0.1),
        at(len / 2, yc + w * 0.38, 0.1),
      ];
      face(out, 'recess', diamond, [0.44, 0.41, 0.33]);
      for (let k = 0; k < 4; k++)
        beam(out, 'cladding', diamond[k], diamond[(k + 1) % 4], 0.055, 0.08, stone);
    }
    if (low >= 207)
      beam(out, 'cladding', at(0.12, low, 0.12), at(0.12, high, 0.12), 0.32, 0.26, stone);
  }
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
  for (let i = 0; i < p.length; i++)
    beam(out, 'cladding', p[i], p[(i + 1) % p.length], 0.14, 0.21, stone);
}
function build40Wall(out, m) {
  const key = 'n0177_40_wall_street',
    base = cleanPlan(localOutline(m)),
    evidence = partsEvidence(key);
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
    if (!street) {
      face(out, 'cladding', [at(0, 0.2), at(len, 0.2), at(len, 30), at(0, 30)], limestone);
      continue;
    }
    const bays = Math.max(1, Math.round(len / (n[2] > 0 ? 5.0 : 6.25))),
      bw = len / bays;
    for (let i = 0; i < bays; i++) {
      const x = i * bw;
      grid(
        out,
        [
          at(x + 0.55, 0.2, -0.2),
          at(x + bw - 0.55, 0.2, -0.2),
          at(x + bw - 0.55, 25.4, -0.2),
          at(x + 0.55, 25.4, -0.2),
        ],
        [0.12, 0.17, 0.17],
        (bw - 1.1) / 3,
        4.2,
        0.065,
        [0.42, 0.44, 0.42],
      );
      for (let yy = 4.1; yy < 25; yy += 4.2)
        face(
          out,
          'metal',
          [
            at(x + 0.55, yy, -0.15),
            at(x + bw - 0.55, yy, -0.15),
            at(x + bw - 0.55, yy + 0.9, -0.15),
            at(x + 0.55, yy + 0.9, -0.15),
          ],
          [0.28, 0.32, 0.33],
        );
      for (const xx of [x, x + bw - 0.55])
        face(
          out,
          'cladding',
          [
            at(xx, 0.2, 0.12),
            at(xx + 0.55, 0.2, 0.12),
            at(xx + 0.55, 25.4, 0.12),
            at(xx, 25.4, 0.12),
          ],
          limestone,
        );
      for (const xx of [x + 0.11, x + 0.3, x + 0.48])
        beam(out, 'cladding', at(xx, 5, 0.2), at(xx, 24.4, 0.2), 0.07, 0.13, [0.72, 0.69, 0.6]);
      // Limestone capitals, entablature and seventh-floor roundel frieze.
      for (const [yy, h, depth] of [
        [5, 0.35, 0.3],
        [24.5, 0.55, 0.4],
        [25.5, 0.55, 0.3],
        [29.55, 0.4, 0.4],
      ])
        beam(out, 'cladding', at(x, yy, depth), at(x + bw, yy, depth), 0.34, h, limestone);
      face(
        out,
        'cladding',
        [at(x, 25.65), at(x + bw, 25.65), at(x + bw, 30), at(x, 30)],
        limestone,
      );
      for (const u of [0.2, 0.8])
        grid(
          out,
          [
            at(x + bw * u - 0.5, 26.2, 0.035),
            at(x + bw * u + 0.5, 26.2, 0.035),
            at(x + bw * u + 0.5, 28.65, 0.035),
            at(x + bw * u - 0.5, 28.65, 0.035),
          ],
          [0.12, 0.17, 0.16],
          2,
          2.5,
          0.06,
          [0.37, 0.39, 0.36],
        );
      reliefRoundel(out, at, x + bw / 2, 27.55, 0.74, limestone, true);
      if (i % 2 === 1)
        tube(
          out,
          'metal',
          at(x + bw / 2, 17, 0.45),
          at(x + bw / 2, 20, 5.4),
          0.065,
          [0.68, 0.67, 0.6],
          8,
        );
    }
  }
  mappedCap(out, 'cladding', base, 30, limestone);
  // Each mapped part gives an actual setback, rather than a symmetric stack.
  // Exposed edges exclude walls buried by an adjoining taller volume.
  for (const p of parts) {
    if (p.top <= 30) continue;
    for (const { a, b, n, bottom, top } of exposedEdges(p, parts, Math.max(30, p.bottom))) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.round(len / 2.25));
      const levels = [
        bottom,
        ...Array.from({ length: 54 }, (_, i) => 30 + i * 3.84615).filter(
          (y) => y > bottom + 0.1 && y < top - 0.1,
        ),
        top,
      ];
      for (let j = 1; j < levels.length; j++)
        for (let i = 0; i < count; i++)
          masonryBay(
            out,
            lerp(a, b, i / count),
            lerp(a, b, (i + 1) / count),
            n,
            levels[j - 1],
            levels[j],
            { upper: levels[j - 1] >= 221 },
          );
      if (top >= 212 && top <= 225) {
        const at = frameAt(a, b, n),
          start = Math.max(bottom, top === 212 ? 191 : 212);
        if (top > start + 0.1)
          for (let i = 0; i <= count; i++) {
            const x = (i * len) / count;
            beam(
              out,
              'cladding',
              at(x, start, 0.14),
              at(x, top + 0.45, 0.14),
              0.4,
              0.32,
              limestone,
            );
            for (const dx of [-0.1, 0.1])
              beam(
                out,
                'cladding',
                at(x + dx, start, 0.32),
                at(x + dx, top + 0.1, 0.32),
                0.075,
                0.1,
                [0.7, 0.665, 0.565],
              );
            beam(
              out,
              'cladding',
              at(x - 0.29, top - 0.35, 0.22),
              at(x + 0.29, top - 0.35, 0.22),
              0.4,
              0.3,
              limestone,
            );
          }
      }
    }
    mappedCap(out, 'metal', p.plan, p.top, [0.43, 0.44, 0.4]);
    for (const { a, b, n } of exposedEdges({ ...p, top: p.top + 0.35 }, parts, p.top))
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
  const roofPart = evidence.find((p) => p.id === 286057109),
    roof = cleanPlan(partPlan(m, roofPart));
  const cx = roof.reduce((v, p) => v + p[0], 0) / roof.length,
    cz = roof.reduce((v, p) => v + p[1], 0) / roof.length;
  const small = roof.map((p) => [cx + (p[0] - cx) * 0.205, cz + (p[1] - cz) * 0.205]);
  const bottomRing = roof.map((p) => [p[0], 230, p[1]]),
    upperRing = small.map((p) => [p[0], 262, p[1]]);
  loft(out, 'metal', [bottomRing, upperRing], copper);
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
    for (let i = 0; i <= 30; i++)
      beam(out, 'metal', on(i / 30, 0.002), on(i / 30, 0.997), 0.055, 0.07, [0.37, 0.58, 0.49]);
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
        grid(
          out,
          [on(u - w, v), on(u + w, v), on(u + w, v + h), on(u - w, v + h)],
          [0.1, 0.15, 0.145],
          4,
          4,
          0.075,
          [0.38, 0.57, 0.48],
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
    for (const yy of [221.5, 225.2])
      grid(
        out,
        [
          at(mid - 1.35, yy, 0.22),
          at(mid + 1.35, yy, 0.22),
          at(mid + 1.35, yy + 2.4, 0.22),
          at(mid - 1.35, yy + 2.4, 0.22),
        ],
        [0.11, 0.16, 0.155],
        1.3,
        2.8,
        0.11,
        [0.65, 0.64, 0.55],
        'cladding',
      );
    for (const x of [-1.26, 0, 1.26]) lancet(out, at, mid + x, 230.2, 0.8, 3.3, limestone);
    for (const x of [-wide / 2, wide / 2]) {
      beam(out, 'cladding', at(mid + x, 221, 0.3), at(mid + x, 235.1, 0.3), 0.32, 0.45, limestone);
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
    // Fine pointed parapet ornament between the center dormer and corners.
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
    if (y1 - y0 > 3)
      for (let i = 0; i < 8; i++) {
        const a = Math.PI / 8 - (i * Math.PI) / 4,
          b = Math.PI / 8 - ((i + 1) * Math.PI) / 4;
        const p = [cx + Math.cos(a) * r0, y0, cz + Math.sin(a) * r0],
          q = [cx + Math.cos(b) * r0, y0, cz + Math.sin(b) * r0];
        if (y0 < 270) {
          const n = [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)];
          grid(
            out,
            [p, q, [q[0], y1, q[2]], [p[0], y1, p[2]]].map((v) => shift(v, n, 0.045)),
            [0.12, 0.2, 0.17],
            8,
            8,
            0.16,
            [0.4, 0.59, 0.48],
          );
        }
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
  sphere(out, 'glass', [cx, 278.6, cz], [0.34, 0.34, 0.34], [0.61, 0.72, 0.69], 24, 12);
  tube(out, 'metal', [cx, 278, cz], [cx, 282.5496, cz], 0.055, [0.64, 0.66, 0.59], 12);
}

/** Clip a convex facade polygon in horizontal facade-coordinate / elevation space. */
function slicePlane(poly, axis, value, keepGreater) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = (a[axis] - value) * (keepGreater ? 1 : -1),
      db = (b[axis] - value) * (keepGreater ? 1 : -1);
    if (da >= -1e-8) result.push(a);
    if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
      result.push(lerp(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i) =>
      Math.hypot(
        p[0] - result[(i + result.length - 1) % result.length][0],
        p[1] - result[(i + result.length - 1) % result.length][1],
      ) > 1e-6,
  );
}
/** Plane-preserving panes on a triangular architectural facet. Mullion strips are
 * real surfaces around each clipped pane; there is no overlapping whole-wall skin. */
function glazedFacet(out, points, color, pitch = 1.55, floorPitch = 4.15) {
  const n = normalFor(...points),
    hd = Math.hypot(n[0], n[2]);
  if (hd < 0.01) return;
  const u = [n[2] / hd, 0, -n[0] / hd],
    d = points[0].reduce((s, v, i) => s + v * n[i], 0);
  const project = (p) => [p[0] * u[0] + p[2] * u[2], p[1]],
    p2 = points.map(project);
  const restore = ([s, y]) => {
    const normalDistance = (d - n[1] * y) / hd;
    return [u[0] * s + (n[0] / hd) * normalDistance, y, u[2] * s + (n[2] / hd) * normalDistance];
  };
  const lo = [Math.min(...p2.map((p) => p[0])), Math.min(...p2.map((p) => p[1]))];
  const hi = [Math.max(...p2.map((p) => p[0])), Math.max(...p2.map((p) => p[1]))];
  const emit = (slot, poly, tint) => {
    for (let k = 1; k < poly.length - 1; k++) {
      const triangle = [poly[0], poly[k], poly[k + 1]],
        a = triangle[0],
        b = triangle[1],
        c = triangle[2];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.00015)
        continue;
      const xyz = triangle.map(restore);
      if (normalFor(...xyz).reduce((s, v, i) => s + v * n[i], 0) < 0) xyz.reverse();
      tri(out, slot, xyz, tint);
    }
  };
  for (let row = Math.floor(lo[1] / floorPitch); row < Math.ceil(hi[1] / floorPitch); row++) {
    let strip = slicePlane(p2, 1, row * floorPitch, true);
    strip = slicePlane(strip, 1, (row + 1) * floorPitch, false);
    if (strip.length < 3) continue;
    const min = Math.min(...strip.map((p) => p[0])),
      max = Math.max(...strip.map((p) => p[0]));
    for (let col = Math.floor(min / pitch); col < Math.ceil(max / pitch); col++) {
      let poly = slicePlane(strip, 0, col * pitch, true);
      poly = slicePlane(poly, 0, (col + 1) * pitch, false);
      if (poly.length < 3) continue;
      const center = poly.reduce(
        (a, p) => [a[0] + p[0] / poly.length, a[1] + p[1] / poly.length],
        [0, 0],
      );
      const shortest = Math.min(
        ...poly.map((p, i) =>
          Math.hypot(p[0] - poly[(i + 1) % poly.length][0], p[1] - poly[(i + 1) % poly.length][1]),
        ),
      );
      const tint = color.map((v) => v * (0.977 + (Math.abs(row * 13 + col * 7) % 7) * 0.007));
      if (shortest < 0.09) {
        emit('glass', poly, tint);
        continue;
      }
      const scale = Math.min(0.095, 0.055 / Math.max(0.3, shortest));
      const inset = poly.map((p) => lerp(p, center, scale));
      emit('glass', inset, tint);
      for (let k = 0; k < poly.length; k++)
        emit(
          'metal',
          [poly[k], poly[(k + 1) % poly.length], inset[(k + 1) % poly.length], inset[k]],
          [0.34, 0.44, 0.49],
        );
    }
  }
}

function buildMerdeka(out, m) {
  const base = cleanPlan(localOutline(m));
  const silver = [0.69, 0.74, 0.77],
    deep = [0.15, 0.32, 0.43],
    cyan = [0.36, 0.58, 0.66],
    pale = [0.52, 0.67, 0.71];
  mappedSolid(out, 'foundation', base, 0, 0.24, [0.53, 0.52, 0.48]);
  // The minimum rectangle frame is aligned to an edge of the diamond, not to
  // its long diagonal. Coordinates retain that OSM frame and the separate mast.
  // Completed architect/engineer plans clip both acute ends of the diamond.
  const plans = [
    [
      [-22, -20.94],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-10.21, 20.94],
      [-27.96, -11.71],
    ],
    [
      [-25, -20.2],
      [13.11, -15.68],
      [32.98, 10.35],
      [26.31, 20.82],
      [-6.88, 15.73],
      [-23.5, -5.2],
    ],
    [
      [-17.2, -17.6],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-10.21, 20.94],
      [-16.94, 2.87],
    ],
    [
      [-3.42, -18.25],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-6.88, 15.73],
      [-16.94, 2.87],
    ],
    [
      [-3.1, -10.58],
      [23.05, -2.67],
      [32.98, 10.35],
      [26.31, 20.82],
      [9.72, 18.28],
      [-1.84, 7.81],
    ],
  ].map(clockwise);
  const ys = [18, 122, 247, 372, 488];
  const rings = plans.map((p, i) => p.map(([x, z]) => [x, ys[i], z]));
  const facets = [];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 6; i++) {
      const k = (i + 1) % 6,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        d = rings[j][i];
      const flip = (i + j) % 2 === 0;
      const triangles = flip
        ? [
            [a, b, d],
            [b, c, d],
          ]
        : [
            [a, b, c],
            [a, c, d],
          ];
      for (let t = 0; t < 2; t++)
        facets.push({
          points: triangles[t],
          color: [deep, cyan, pale, deep, cyan, pale][(i + (flip ? t : 1 - t)) % 6],
        });
    }
  for (const { points, color } of facets) {
    glazedFacet(out, points, color);
    // The blade-like diagonal junctions are thin framed folds in the envelope.
    const n = normalFor(...points);
    for (let i = 0; i < 3; i++)
      if (Math.abs(points[i][1] - points[(i + 1) % 3][1]) > 40)
        beam(
          out,
          'stainless',
          shift(points[i], n, 0.035),
          shift(points[(i + 1) % 3], n, 0.035),
          0.1,
          0.12,
          [0.68, 0.77, 0.79],
        );
  }
  // The actual completed crown has a flat upper glass face with diagonal return
  // planes and a lower viewing terrace, as shown in PAM's2025 close photograph.
  const topPlan = clockwise([
    [7.76, -7.29],
    [23.05, -2.67],
    [32.98, 10.35],
    [26.31, 20.82],
    [9.72, 18.28],
    [-1.84, 7.81],
  ]);
  const topYs = [509.5, 518.5, 518.5, 518.5, 518.5, 509.5].toReversed();
  const crown = topPlan.map(([x, z], i) => [x, topYs[i], z]);
  for (let i = 0; i < 6; i++) {
    const k = (i + 1) % 6,
      a = rings.at(-1)[i],
      b = rings.at(-1)[k],
      c = crown[k],
      d = crown[i];
    for (const p of [
      [a, b, c],
      [a, c, d],
    ])
      glazedFacet(out, p, i % 2 ? deep : pale, 1.45, 3.4);
    beam(out, 'metal', c, d, 0.16, 0.22, silver);
  }
  // The upper skin is a parapet around a lower maintenance roof. A fan to the
  // high parapet would bury the actual mechanical deck and its plant enclosure.
  mappedCap(out, 'metal', topPlan, 509.2, [0.49, 0.54, 0.56]);
  for (let i = 0; i < 6; i++) {
    const k = (i + 1) % 6,
      a = crown[i],
      b = crown[k];
    face(out, 'metal', [[b[0], 509.2, b[2]], [a[0], 509.2, a[2]], a, b], [0.48, 0.55, 0.58]);
  }
  const plant = clockwise([
    [7, 1],
    [20, 1],
    [20, 11],
    [7, 11],
  ]);
  mappedSolid(out, 'metal', plant, 509.2, 511.1, [0.43, 0.48, 0.5]);
  for (let k = 0; k < 10; k++)
    beam(
      out,
      'metal',
      [7.2 + k * 1.26, 511.13, 1.2],
      [7.2 + k * 1.26, 511.13, 10.8],
      0.16,
      0.15,
      [0.65, 0.69, 0.7],
    );
  for (const yy of [478.8, 482.2]) {
    // Paired upper plant/observation bands are inset inside the south glass face.
    const p = plans[3].map((a, i) => lerp(a, plans[4][i], (yy - 372) / (488 - 372))),
      a = p[0],
      b = p[5],
      n = edges(p)[5].n;
    for (let k = 0; k < 19; k++) {
      const q = lerp(a, b, (k + 0.5) / 19);
      beam(
        out,
        'metal',
        [q[0] + n[0] * 0.08, yy, q[1] + n[2] * 0.08],
        [q[0] + n[0] * 0.08, yy + 1.2, q[1] + n[2] * 0.08],
        0.24,
        0.14,
        [0.16, 0.24, 0.28],
      );
    }
  }
  //160.4 m external spire, at the independently mapped north-eastern corner.
  // Its skin is an angular taper with an off-axis crease, not a circular mast.
  const center = [30.18, 15.74],
    spireYs = [509.8, 518.5, 551, 578, 619, 653, 678.9];
  const widths = [
    [3.6, 4.4],
    [3.6, 4.4],
    [3.05, 3.7],
    [2.35, 2.9],
    [1.3, 1.65],
    [0.61, 0.83],
    [0.09, 0.1],
  ];
  const spireRings = spireYs.map((y, j) => {
    const [w, d] = widths[j],
      skew = j === 2 ? -0.65 : j === 3 ? 0.25 : 0;
    return clockwise([
      [-w * 0.5, -d * 0.5],
      [w * 0.5, -d * 0.5],
      [w * 0.5 + skew, d * 0.15],
      [w * 0.15, d * 0.5],
      [-w * 0.5, d * 0.5],
    ]).map(([x, z]) => [center[0] + x, y, center[1] + z]);
  });
  for (let j = 1; j < spireRings.length; j++)
    for (let i = 0; i < 5; i++) {
      const k = (i + 1) % 5,
        a = spireRings[j - 1][i],
        b = spireRings[j - 1][k],
        c = spireRings[j][k],
        d = spireRings[j][i];
      face(out, 'metal', [a, b, c, d], i % 2 ? [0.28, 0.47, 0.55] : [0.6, 0.69, 0.72]);
      beam(out, 'stainless', a, d, 0.075, 0.07, silver);
      const divisions = Math.ceil((c[1] - b[1]) / 2.2);
      for (let level = 1; level < divisions; level++)
        beam(
          out,
          'metal',
          lerp(a, d, level / divisions),
          lerp(b, c, level / divisions),
          0.035,
          0.045,
          [0.5, 0.59, 0.61],
        );
    }
  // Shared open-air crown rail along the lower end of the stepped roof.
  for (const i of [0, 4, 5]) {
    const k = (i + 1) % 6,
      a = crown[i],
      b = crown[k];
    beam(out, 'stainless', a, b, 0.08, 0.07, silver);
    const count = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.35);
    for (let j = 0; j <= count; j++) {
      const q = lerp(a, b, j / count);
      beam(out, 'stainless', q, [q[0], q[1] + 1.1, q[2]], 0.055, 0.055, silver);
    }
    beam(out, 'stainless', [a[0], a[1] + 1.1, a[2]], [b[0], b[1] + 1.1, b[2]], 0.07, 0.065, silver);
  }
  // Glazed low atrium, warm stone piers and the continuous faceted metal canopy.
  const lobby = plans[0];
  for (const { a, b, n, len } of edges(lobby)) {
    grid(
      out,
      [
        [a[0], 0.24, a[1]],
        [b[0], 0.24, b[1]],
        [b[0], 18, b[1]],
        [a[0], 18, a[1]],
      ],
      [0.26, 0.39, 0.42],
      2,
      3.55,
      0.085,
      [0.33, 0.39, 0.39],
    );
    const divisions = Math.max(1, Math.floor(len / 8));
    for (let j = 0; j <= divisions; j++) {
      const q = lerp(a, b, j / divisions),
        at = (y, o = 0) => [q[0] + n[0] * o, y, q[1] + n[2] * o];
      beam(out, 'cladding', at(0.3, -0.16), at(15, -0.16), 0.56, 0.62, [0.74, 0.68, 0.56]);
    }
    if (len > 20) {
      const c = lerp(a, b, 0.5),
        tip = [c[0] + n[0] * 10.5, 12.7, c[1] + n[2] * 10.5];
      const q0 = [a[0], 17.4, a[1]],
        q1 = [b[0], 17.4, b[1]];
      const left = [a[0] + n[0] * 6, 8.5, a[1] + n[2] * 6],
        right = [b[0] + n[0] * 6, 8.5, b[1] + n[2] * 6];
      for (const points of [
        [q0, left, tip],
        [q0, tip, q1],
        [q1, tip, right],
      ]) {
        const p = normalFor(...points)[1] < 0 ? points.toReversed() : points;
        tri(out, 'metal', p, [0.5, 0.59, 0.62]);
        tri(out, 'metal', p.map((v) => [v[0], v[1] - 0.34, v[2]]).toReversed(), [0.72, 0.7, 0.61]);
        for (let i = 0; i < 3; i++) {
          const k = (i + 1) % 3;
          face(
            out,
            'metal',
            [p[i], p[k], [p[k][0], p[k][1] - 0.34, p[k][2]], [p[i][0], p[i][1] - 0.34, p[i][2]]],
            [0.6, 0.63, 0.62],
          );
          beam(out, 'stainless', p[i], p[k], 0.07, 0.055, silver);
        }
      }
      const foot = [c[0] + n[0] * 4.2, 0.42, c[1] + n[2] * 4.2];
      for (const t of [0.31, 0.69]) {
        const q = lerp(q0, q1, t);
        beam(
          out,
          'metal',
          foot,
          [q[0] + n[0] * 2.7, 15.6, q[2] + n[2] * 2.7],
          0.53,
          0.66,
          [0.63, 0.65, 0.62],
        );
      }
      // Glass door banks below the sheltered center, with stainless pull bars.
      for (const t of [0.43, 0.5, 0.57]) {
        const q = lerp(a, b, t),
          tangent = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
        beam(
          out,
          'stainless',
          [q[0] + n[0] * 0.12, 0.7, q[1] + n[2] * 0.12],
          [q[0] + n[0] * 0.12, 2.15, q[1] + n[2] * 0.12],
          0.045,
          0.045,
          silver,
        );
        beam(
          out,
          'metal',
          [q[0] - tangent[0] * 1.1, 3.1, q[1] - tangent[2] * 1.1],
          [q[0] + tangent[0] * 1.1, 3.1, q[1] + tangent[2] * 1.1],
          0.08,
          0.15,
          [0.37, 0.4, 0.39],
        );
      }
    }
  }
}

function tuntexBay(out, a, b, n, low, high, { bright = false, pink = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const depth = bright ? 0.58 : 0;
  const at = (t, y, d = 0) => [
    a[0] + (b[0] - a[0]) * t + n[0] * (depth + d),
    y,
    a[1] + (b[1] - a[1]) * t + n[2] * (depth + d),
  ];
  const trim = pink ? [0.54, 0.46, 0.42] : [0.2, 0.31, 0.3],
    glass = bright ? [0.26, 0.45, 0.44] : [0.12, 0.26, 0.26];
  const inset = Math.min(0.22, (pink ? 0.23 : 0.085) / len),
    y0 = low + 0.72,
    y1 = high - 0.34;
  const quad = (u0, u1, v0, v1, color, slot = 'metal', d = 0) =>
    face(out, slot, [at(u0, v0, d), at(u1, v0, d), at(u1, v1, d), at(u0, v1, d)], color);
  if (y1 - y0 < 0.2) {
    quad(0, 1, low, high, trim);
    return;
  }
  quad(0, inset, low, high, trim);
  quad(1 - inset, 1, low, high, trim);
  quad(inset, 1 - inset, low, y0, trim);
  quad(inset, 1 - inset, y1, high, trim);
  quad(inset, 1 - inset, y0, y1, glass, 'glass', -0.08);
  for (const t of [inset, 1 - inset]) {
    const p = [at(t, y0), at(t, y1), at(t, y1, -0.08), at(t, y0, -0.08)];
    face(out, 'metal', t === inset ? p : p.toReversed(), trim);
  }
  for (const y of [y0, y1]) {
    const p = [at(inset, y), at(1 - inset, y), at(1 - inset, y, -0.08), at(inset, y, -0.08)];
    face(out, 'metal', y === y0 ? p : p.toReversed(), trim);
  }
  beam(
    out,
    'metal',
    at(inset, high - 0.06, 0.025),
    at(1 - inset, high - 0.06, 0.025),
    0.035,
    0.055,
    [0.41, 0.49, 0.46],
  );
}
function buildTuntex(out, m) {
  const key = 'n0179_tuntex_sky_tower',
    ev = partsEvidence(key),
    base = cleanPlan(localOutline(m));
  const plan = (id) =>
    cleanPlan(
      partPlan(
        m,
        ev.find((p) => p.id === id),
      ),
    );
  const legs = [plan(344740871), plan(344740872)],
    shaft = plan(344740874),
    stone = [0.72, 0.57, 0.49],
    trim = [0.39, 0.5, 0.47],
    dark = [0.13, 0.24, 0.24];
  mappedSolid(out, 'foundation', base, 0, 0.25, [0.48, 0.46, 0.43]);
  // Pink raised podium, including the independently described ground passage.
  for (const { a, b, n, len } of edges(base)) {
    const bays = Math.max(1, Math.round(len / 3.3));
    for (let j = 0; j < 12; j++)
      for (let i = 0; i < bays; i++) {
        const aa = lerp(a, b, i / bays),
          bb = lerp(a, b, (i + 1) / bays),
          middle = lerp(aa, bb, 0.5),
          lo = 0.25 + (j * 49.75) / 12,
          hi = 0.25 + ((j + 1) * 49.75) / 12;
        if (Math.abs(n[2]) > 0.9 && Math.abs(middle[0]) < 6.5 && hi < 8.7) continue;
        const p = (v, y, o = 0) => [v[0] + n[0] * o, y, v[1] + n[2] * o];
        if (j < 2)
          grid(
            out,
            [p(aa, lo), p(bb, lo), p(bb, hi), p(aa, hi)],
            [0.19, 0.31, 0.32],
            1.5,
            4,
            0.16,
            stone,
            'cladding',
          );
        else {
          face(out, 'cladding', [p(aa, lo), p(bb, lo), p(bb, hi - 0.85), p(aa, hi - 0.85)], stone);
          face(
            out,
            'glass',
            [
              p(aa, hi - 0.85, -0.09),
              p(bb, hi - 0.85, -0.09),
              p(bb, hi - 0.24, -0.09),
              p(aa, hi - 0.24, -0.09),
            ],
            [0.16, 0.22, 0.23],
          );
          beam(out, 'cladding', p(aa, hi - 0.16), p(bb, hi - 0.16), 0.25, 0.3, [0.78, 0.63, 0.54]);
        }
      }
    const count = Math.max(1, Math.round(len / 15));
    for (let i = 0; i <= count; i++) {
      const q = lerp(a, b, i / count);
      if (Math.abs(q[0]) < 7 && Math.abs(n[2]) > 0.9) continue;
      beam(
        out,
        'cladding',
        [q[0] + n[0] * 0.12, 0.4, q[1] + n[2] * 0.12],
        [q[0] + n[0] * 0.12, 49.8, q[1] + n[2] * 0.12],
        0.65,
        0.48,
        [0.8, 0.64, 0.55],
      );
    }
  }
  mappedCap(out, 'cladding', base, 50, stone);
  // Tunnel reveals and ceiling, deliberately leaving its middle open.
  for (const x of [-6.55, 6.55]) {
    const p = [
      [x, 0.25, -33.82],
      [x, 0.25, 33.82],
      [x, 8.3, 33.82],
      [x, 8.3, -33.82],
    ];
    face(out, 'cladding', x < 0 ? p.toReversed() : p, [0.66, 0.55, 0.47]);
  }
  face(
    out,
    'cladding',
    [
      [-6.55, 8.3, -33.82],
      [6.55, 8.3, -33.82],
      [6.55, 8.3, 33.82],
      [-6.55, 8.3, 33.82],
    ],
    [0.61, 0.53, 0.46],
  );
  const body = (poly, low, high, kind) => {
    for (const { a, b, n, len } of edges(poly)) {
      const count = Math.max(1, Math.round(len / 2.25)),
        rows = Math.max(1, Math.round((high - low) / 4.02));
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < count; i++) {
          const aa = lerp(a, b, i / count),
            bb = lerp(a, b, (i + 1) / count),
            mid = lerp(aa, bb, 0.5);
          const y0 = low + ((high - low) * j) / rows,
            y1 = low + ((high - low) * (j + 1)) / rows;
          const front = Math.abs(n[2]) > 0.9;
          if (kind === 'leg') {
            if (y0 >= 145 && (Math.abs(mid[0]) < 27.3 || (!front && Math.abs(mid[0]) < 8)))
              continue;
          } else if (kind === 'shaft' && !front && y1 <= 190) continue;
          const bright =
            kind === 'leg' &&
            front &&
            Math.abs(mid[0]) > 13 &&
            Math.abs(mid[0]) < 59 &&
            y0 >= 58 &&
            y1 <= 146;
          const pink = kind === 'shaft' && front && Math.abs(mid[0]) < 18.5 && y0 > 185;
          tuntexBay(out, aa, bb, n, y0, y1, { bright, pink });
        }
      if (kind === 'shaft' && Math.abs(n[2]) > 0.9)
        for (const y of [196, 261, 312]) {
          beam(
            out,
            'cladding',
            [a[0] + n[0] * 0.2, y, a[1] + n[2] * 0.2],
            [b[0] + n[0] * 0.2, y, b[1] + n[2] * 0.2],
            0.55,
            0.38,
            stone,
          );
          for (let k = 1; k < 16; k++) {
            const q = lerp(a, b, k / 16);
            beam(
              out,
              'cladding',
              [q[0] + n[0] * 0.34, y - 3.3, q[1] + n[2] * 0.34],
              [q[0] + n[0] * 0.34, y - 0.18, q[1] + n[2] * 0.34],
              0.56,
              0.55,
              [0.67, 0.58, 0.51],
            );
          }
        }
    }
  };
  // Three explicit ranges keep the bridge aperture and eliminate hidden
  // overlapping facade skins where the central tower joins the two prongs.
  for (const poly of legs) {
    body(poly, 50, 145, 'leg');
    body(poly, 145, 185, 'leg');
  }
  body(shaft, 145, 190, 'shaft');
  body(shaft, 190, 327, 'shaft');
  mappedCap(out, 'metal', shaft, 145, dark, [], true);
  mappedCap(out, 'metal', shaft, 327, trim);
  const lowCenter = plan(344740873);
  for (const { a, b, n } of edges(lowCenter))
    for (let j = 0; j < 4; j++) {
      const y = 50 + j * 5;
      grid(
        out,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + 5, b[1]],
          [a[0], y + 5, a[1]],
        ],
        [0.19, 0.29, 0.28],
        3.4,
        5,
        0.6,
        stone,
        'cladding',
      );
    }
  mappedCap(out, 'cladding', lowCenter, 70, stone);
  // Decorative raised piers and a low saddle on the aperture sill.
  for (const z of [-33.84, 33.84])
    for (const x of [-6.6, 6.1]) {
      box(out, 'cladding', [x - 0.6, 68, z - 0.55], [x + 0.6, 76, z + 0.55], stone);
      const ring = clockwise([
        [x - 0.85, z - 0.85],
        [x + 0.85, z - 0.85],
        [x + 0.85, z + 0.85],
        [x - 0.85, z + 0.85],
      ]);
      loft(
        out,
        'cladding',
        [
          ring.map((p) => [p[0], 76, p[1]]),
          ring.map((p) => [x + (p[0] - x) * 0.28, 78, p[1] > z ? z + 0.24 : z - 0.24]),
        ],
        stone,
      );
    }
  for (let i = 0; i < 7; i++) {
    const z = -29 + i * 9.5;
    beam(out, 'metal', [-7.3, 143.8, z], [7.0, 143.8, z], 0.48, 1.05, dark);
    beam(out, 'metal', [-7.3, 143.3, z], [0, 145, z], 0.24, 0.32, trim);
    beam(out, 'metal', [0, 145, z], [7.0, 143.3, z], 0.24, 0.32, trim);
  }
  // Pale framed projections on each lower prong; vertical relief and short
  // brackets below their sills are visible in the architect's harbor views.
  for (const sign of [-1, 1])
    for (const z of [-33.85, 33.85]) {
      const x0 = sign < 0 ? -59 : 13,
        x1 = sign < 0 ? -13 : 59,
        nz = Math.sign(z);
      for (const x of [x0, x1])
        beam(
          out,
          'cladding',
          [x, 59, z + nz * 0.8],
          [x, 146.5, z + nz * 0.8],
          0.4,
          0.55,
          [0.63, 0.58, 0.51],
        );
      for (const y of [59, 146.5])
        beam(
          out,
          'cladding',
          [x0, y, z + nz * 0.8],
          [x1, y, z + nz * 0.8],
          0.5,
          0.56,
          [0.68, 0.6, 0.53],
        );
      for (let j = 0; j < 15; j++) {
        const x = x0 + ((j + 0.5) * (x1 - x0)) / 15;
        beam(out, 'cladding', [x, 55.5, z + nz * 0.4], [x, 58.8, z + nz * 0.8], 0.45, 0.55, stone);
      }
    }
  const crown = (poly, y, height) => {
    for (const { a, b, n, len } of edges(poly)) {
      const segments = Math.max(12, Math.ceil(len / 1.4));
      const rise = (t) =>
        y +
        1.3 +
        height * Math.pow(Math.abs(2 * t - 1), 5) +
        1.4 * Math.exp(-(((t - 0.5) / 0.11) ** 2));
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments,
          t1 = (i + 1) / segments,
          p = lerp(a, b, t0),
          q = lerp(a, b, t1);
        face(
          out,
          'metal',
          [
            [p[0], y, p[1]],
            [q[0], y, q[1]],
            [q[0], rise(t1), q[1]],
            [p[0], rise(t0), p[1]],
          ],
          dark,
        );
        face(
          out,
          'metal',
          [
            [p[0] - n[0] * 0.4, y, p[1] - n[2] * 0.4],
            [p[0] - n[0] * 0.4, rise(t0), p[1] - n[2] * 0.4],
            [q[0] - n[0] * 0.4, rise(t1), q[1] - n[2] * 0.4],
            [q[0] - n[0] * 0.4, y, q[1] - n[2] * 0.4],
          ],
          trim,
        );
        beam(out, 'cladding', [p[0], rise(t0), p[1]], [q[0], rise(t1), q[1]], 0.2, 0.32, stone);
      }
    }
  };
  for (const sign of [-1, 1]) {
    const outer = clockwise(
      sign < 0
        ? [
            [-65, -33.8],
            [-27.4, -33.8],
            [-27.4, 33.8],
            [-65, 33.8],
          ]
        : [
            [26.5, -33.8],
            [63.8, -33.8],
            [63.8, 33.8],
            [26.5, 33.8],
          ],
    );
    mappedCap(out, 'metal', outer, 185, [0.27, 0.38, 0.34]);
    crown(outer, 185, 3.6);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const x = sign * (36 + i * 8.1),
          z = -11 + j * 22;
        box(out, 'metal', [x - 2.8, 185, z - 4.2], [x + 2.8, 188, z + 4.2], [0.58, 0.59, 0.54]);
        for (let k = 0; k < 7; k++)
          beam(
            out,
            'metal',
            [x - 2.6, 188.05, z - 3.8 + k * 1.16],
            [x + 2.6, 188.05, z - 3.8 + k * 1.16],
            0.09,
            0.07,
            [0.27, 0.31, 0.3],
          );
      }
  }
  crown(shaft, 327, 4.1);
  const hip = plan(345038766),
    center = hip.reduce((a, p) => [a[0] + p[0] / hip.length, a[1] + p[1] / hip.length], [0, 0]);
  body(hip, 327, 335, 'roof');
  const roofRings = [
    [335, 1],
    [336, 1.04],
    [339, 0.82],
    [343.4, 0.46],
    [347.5, 0.14],
  ].map(([y, s]) =>
    hip.map((p) => [center[0] + (p[0] - center[0]) * s, y, center[1] + (p[1] - center[1]) * s]),
  );
  loft(out, 'metal', roofRings, [0.2, 0.39, 0.35]);
  for (let j = 1; j < roofRings.length; j++)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4,
        a = roofRings[j - 1][i],
        b = roofRings[j - 1][k],
        c = roofRings[j][k],
        d = roofRings[j][i];
      beam(out, 'cladding', a, d, 0.25, 0.28, stone);
      for (let col = 1; col < 15; col++)
        beam(
          out,
          'metal',
          lerp(a, b, col / 15),
          lerp(d, c, col / 15),
          0.07,
          0.075,
          [0.36, 0.51, 0.43],
        );
      beam(out, 'metal', d, c, 0.15, 0.16, [0.4, 0.55, 0.47]);
    }
  const mast = plan(345038767),
    mc = mast.reduce((a, p) => [a[0] + p[0] / mast.length, a[1] + p[1] / mast.length], [0, 0]);
  loft(
    out,
    'stainless',
    [
      radialRing(346.8, 1.4, 1.4, 16, mc),
      radialRing(352, 1.16, 1.16, 16, mc),
      radialRing(360, 0.72, 0.72, 16, mc),
      radialRing(373, 0.25, 0.25, 16, mc),
      radialRing(378, 0.055, 0.055, 16, mc),
    ],
    [0.87, 0.89, 0.85],
  );
  for (const [y, r] of [
    [350, 1.65],
    [353, 1.4],
    [357, 1.1],
    [361, 0.88],
    [368, 0.54],
  ])
    torus(out, 'stainless', [mc[0], y, mc[1]], r, 0.1, [0.84, 0.87, 0.82], 24, 6);
}

/** Intersection of a ray with a60m filleted square. The envelope stays fixed;
 * only the missing southern quadrant moves fromSW toSE, as SOM's five sections show. */
function hamraOuter(angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    hx = 30,
    hz = 29.3,
    r = 8.4;
  let low = 0,
    high = 44;
  for (let k = 0; k < 38; k++) {
    const d = (low + high) / 2,
      x = Math.abs(c * d),
      z = Math.abs(s * d);
    const dx = Math.max(x - (hx - r), 0),
      dz = Math.max(z - (hz - r), 0);
    if (x <= hx && z <= hz && dx * dx + dz * dz <= r * r) low = d;
    else high = d;
  }
  return [c * low, s * low].map((v) => Math.round(v * 1e7) / 1e7);
}
function hamraCleanPlan(plan) {
  return plan.filter((b, i) => {
    const a = plan[(i + plan.length - 1) % plan.length],
      c = plan[(i + 1) % plan.length];
    return Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-5;
  });
}
function hamraCut(y) {
  return (Math.PI / 2) * (1 - Math.min(1, Math.max(0, y / 350)));
}
function hamraGlassPoint(u, y) {
  const p = hamraOuter(hamraCut(y) - u * Math.PI * 1.5);
  return [p[0], y, p[1]];
}
function hamraWingPoint(side, u, y) {
  const angle = hamraCut(y) + (side < 0 ? Math.PI / 2 : 0),
    outer = hamraOuter(angle);
  const core = [side * 17, 2.1];
  // A ruled sheet between the fixed core edge and moving rounded-square edge.
  return [lerp(core, outer, u)[0], y, lerp(core, outer, u)[1]];
}
function hamraRoofHeight(u) {
  return 412.49 - 55.8 * u;
}
function hamraClippedPane(out, polygon, glass, trim) {
  // Clip a fixed-angle curtain-wall cell against the two moving courtyard edges.
  // The glazing mullions stay vertical while only the cut edge sweeps across them.
  for (const distance of [
    (p) => hamraCut(p[1]) - p[0],
    (p) => p[0] - hamraCut(p[1]) + Math.PI * 1.5,
  ]) {
    const clipped = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length],
        da = distance(a),
        db = distance(b);
      if (da >= -1e-10) clipped.push(a);
      if ((da > 0 && db < 0) || (da < 0 && db > 0)) clipped.push(lerp(a, b, da / (da - db)));
    }
    polygon = clipped.filter(
      (p, i) =>
        Math.hypot(...p.map((v, k) => v - clipped[(i + clipped.length - 1) % clipped.length][k])) >
        1e-7,
    );
    if (polygon.length < 3) return;
  }
  const p = polygon.map(([angle, y]) => {
    const q = hamraOuter(angle);
    return [q[0], y, q[1]];
  });
  if (p.length === 4) {
    grid(out, p, glass, 2, 4.3, 0.055, trim);
    return;
  }
  const center = [0, 1, 2].map((k) => p.reduce((sum, q) => sum + q[k], 0) / p.length);
  const inset = p.map((q) =>
    lerp(
      q,
      center,
      Math.min(0.22, 0.065 / Math.max(0.01, Math.hypot(...q.map((v, k) => v - center[k])))),
    ),
  );
  for (let i = 1; i < inset.length - 1; i++)
    tri(out, 'glass', [inset[0], inset[i], inset[i + 1]], glass);
  for (let i = 0; i < p.length; i++) {
    const k = (i + 1) % p.length;
    face(out, 'metal', [p[i], p[k], inset[k], inset[i]], trim);
  }
}
function buildHamra(out, m) {
  const limestone = [0.79, 0.735, 0.62],
    glass = [0.23, 0.35, 0.42],
    trim = [0.68, 0.7, 0.67];
  const segments = 132,
    occupiedTop = 351.2;
  const levels = [
    0,
    4,
    8,
    12,
    16,
    20,
    24,
    ...Array.from({ length: 77 }, (_, i) => 24 + (i + 1) * 4.2).filter((y) => y < 350),
    350,
    occupiedTop,
  ];
  const plan = [];
  for (let i = 0; i <= segments; i++) {
    const p = hamraGlassPoint(i / segments, 0);
    plan.push([p[0], p[2]]);
  }
  plan.push([-17, 2.1], [17, 2.1]);
  mappedSolid(out, 'foundation', clockwise(hamraCleanPlan(plan)), 0, 0.16, [0.6, 0.57, 0.5]);
  const lobby = {
    ...out,
    addTriangle(slot, ...args) {
      out.addTriangle(slot === 'glass' ? 'clear_glass' : slot, ...args);
    },
    addQuad(slot, ...args) {
      out.addQuad(slot === 'glass' ? 'clear_glass' : slot, ...args);
    },
  };
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < 176; i++) {
      const y0 = levels[j - 1],
        y1 = levels[j],
        a0 = -Math.PI * 1.5 + (i * Math.PI * 2) / 176,
        a1 = a0 + (Math.PI * 2) / 176;
      hamraClippedPane(
        y1 <= 24 ? lobby : out,
        [
          [a1, y0],
          [a0, y0],
          [a0, y1],
          [a1, y1],
        ],
        glass,
        trim,
      );
    }
  // The limestone flares are separate continuous ruled surfaces, never windowed.
  for (const side of [-1, 1])
    for (let j = 1; j < levels.length; j++)
      for (let i = 0; i < 18; i++) {
        const p = [
          hamraWingPoint(side, i / 18, levels[j - 1]),
          hamraWingPoint(side, (i + 1) / 18, levels[j - 1]),
          hamraWingPoint(side, (i + 1) / 18, levels[j]),
          hamraWingPoint(side, i / 18, levels[j]),
        ];
        face(out, 'limestone', side < 0 ? p.toReversed() : p, limestone);
      }
  // Each south core window is cut through the stone plane with an angled deep reveal.
  // There is no full wall laid over the glass. Alternate bevels produce the photographed
  // changing shadows without baking the lighting into textures.
  const columns = 12,
    rows = 80,
    z = 2.1;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const x0 = -17 + (34 * col) / columns,
        x1 = -17 + (34 * (col + 1)) / columns,
        y0 = 0.16 + ((occupiedTop - 0.16) * row) / rows,
        y1 = 0.16 + ((occupiedTop - 0.16) * (row + 1)) / rows;
      const l = x0 + 0.84,
        r = x1 - 0.84,
        b = y0 + 0.97,
        t = y1 - 1.3;
      const outer = [
        [l, b, z],
        [r, b, z],
        [r, t, z],
        [l, t, z],
      ];
      const inset = (col + row) % 2 === 0 ? 0.23 : -0.23;
      const inner = [
        [l + 0.12 + inset, b + 0.15, z - 1.02],
        [r - 0.12 + inset, b + 0.15, z - 1.02],
        [r - 0.12 + inset, t - 0.1, z - 1.02],
        [l + 0.12 + inset, t - 0.1, z - 1.02],
      ];
      for (const [a, c, d, e] of [
        [x0, x1, y0, b],
        [x0, x1, t, y1],
        [x0, l, b, t],
        [r, x1, b, t],
      ])
        face(
          out,
          'limestone',
          [
            [a, d, z],
            [c, d, z],
            [c, e, z],
            [a, e, z],
          ],
          limestone,
        );
      for (let k = 0; k < 4; k++) {
        const n = (k + 1) % 4;
        face(out, 'limestone', [outer[k], outer[n], inner[n], inner[k]], limestone);
      }
      face(out, 'glass', inner, [0.12, 0.2, 0.23]);
      // Vertical joints split the broad stone strip around each aperture; metric stone
      // texture supplies fine grain and the smaller panel coursing.
      beam(
        out,
        'recess',
        [x0 + 0.025, y0, z + 0.006],
        [x0 + 0.025, y1, z + 0.006],
        0.017,
        0.017,
        [0.59, 0.55, 0.47],
      );
    }
  // Sloping crown: the east blade reaches412.6m while the western glass edge is lower.
  // No imaginary cylindrical cap or centered spire is added.
  const roofPlan = [],
    roofHeights = [];
  for (let i = 0; i <= segments; i++) {
    const p = hamraGlassPoint(i / segments, occupiedTop);
    roofPlan.push([p[0], p[2]]);
    roofHeights.push(hamraRoofHeight(i / segments));
    if (i === segments) break;
    const q = hamraGlassPoint((i + 1) / segments, occupiedTop),
      h0 = hamraRoofHeight(i / segments),
      h1 = hamraRoofHeight((i + 1) / segments);
    grid(out, [p, q, [q[0], h1, q[2]], [p[0], h0, p[2]]], glass, 1.8, 4.2, 0.055, trim);
  }
  const westTop = 351.2,
    eastTop = 368.2;
  for (const side of [-1, 1])
    for (let i = 0; i < 18; i++) {
      const p = hamraWingPoint(side, i / 18, occupiedTop),
        q = hamraWingPoint(side, (i + 1) / 18, occupiedTop),
        innerHeight = side < 0 ? westTop : eastTop;
      const outerHeight = hamraRoofHeight(side < 0 ? 1 : 0);
      const a = [p[0], innerHeight + ((outerHeight - innerHeight) * i) / 18, p[2]],
        b = [q[0], innerHeight + ((outerHeight - innerHeight) * (i + 1)) / 18, q[2]];
      const quad = [p, q, b, a];
      // The first western corner intentionally meets the core at351.2m; omit its
      // zero-length edge while retaining the triangular start of the rising parapet.
      if (i === 0 && side < 0) tri(out, 'limestone', [p, b, q], limestone);
      else face(out, 'limestone', side < 0 ? quad.toReversed() : quad, limestone);
    }
  tri(
    out,
    'limestone',
    [
      [-17, occupiedTop, 2.1],
      [17, occupiedTop, 2.1],
      [17, eastTop, 2.1],
    ],
    limestone,
  );
  // Tessellate the same concave roof outline in plan, then lift its vertices to the
  // local sloping datum. A thin exposed coping gives the stone blade a real edge.
  roofPlan.push([-17, 2.1], [17, 2.1]);
  roofHeights.push(westTop, eastTop);
  const roofProxy = {
    ...out,
    addTriangle(slot, ref, p, n, uv, color) {
      const lifted = p.map((v) => {
        let best = 0,
          d = Infinity;
        roofPlan.forEach((q, i) => {
          const e = Math.hypot(q[0] - v[0], q[1] - v[2]);
          if (e < d) {
            d = e;
            best = i;
          }
        });
        return [v[0], roofHeights[best] - 0.22, v[2]];
      });
      tri(out, slot, lifted, color);
    },
  };
  mappedCap(roofProxy, 'metal', hamraCleanPlan(roofPlan), 0, [0.62, 0.63, 0.6]);
  for (let i = 0; i < roofPlan.length; i++) {
    const k = (i + 1) % roofPlan.length,
      a = [roofPlan[i][0], roofHeights[i], roofPlan[i][1]],
      b = [roofPlan[k][0], roofHeights[k], roofPlan[k][1]];
    beam(out, 'limestone', a, b, 0.16, 0.22, limestone);
    face(out, 'limestone', [a, b, [b[0], b[1] - 0.28, b[2]], [a[0], a[1] - 0.28, a[2]]], limestone);
  }
  //24m north lobby lamella: inclined paired columns, nested diamond lattice and
  // horizontal ties sit behind the transparent facade, visible from outside.
  for (let x = -14; x <= 14; x += 7)
    for (const sign of [-1, 1]) {
      const end = x + sign * 7.6;
      beam(out, 'limestone', [x, 0.45, -27.5], [end, 12, -28.2], 0.66, 0.82, [0.84, 0.81, 0.72]);
      beam(
        out,
        'limestone',
        [end, 12, -28.2],
        [x + sign * 3.7, 23.8, -27.7],
        0.64,
        0.82,
        [0.84, 0.81, 0.72],
      );
    }
  for (const y of [6, 12, 18, 23.8])
    beam(out, 'limestone', [-24, y, -27.6], [24, y, -27.6], 0.25, 0.34, [0.84, 0.81, 0.72]);
  // Two rising curved metal branches carry the rectangular entrance canopy.
  for (const x of [-7.8, 7.8]) {
    box(out, 'stainless', [x, 0.13, -29], [1.3, 0.26, 1.8], [0.69, 0.66, 0.6]);
    for (let i = 1; i <= 28; i++) {
      const point = (t) => [x, 0.4 + 7.6 * (1 - (1 - t) ** 2), -29 - 12 * t];
      beam(out, 'stainless', point((i - 1) / 28), point(i / 28), 0.75, 1.05, [0.69, 0.66, 0.6]);
    }
  }
  for (const zc of [-31, -34, -37, -40.5])
    beam(out, 'stainless', [-13, 8.15, zc], [13, 8.15, zc], 0.21, 0.42, [0.7, 0.68, 0.62]);
  for (const x of [-13, 13])
    beam(out, 'stainless', [x, 8.15, -29], [x, 8.15, -41], 0.36, 0.58, [0.7, 0.68, 0.62]);
  face(
    out,
    'clear_glass',
    [
      [-13, 8.1, -29],
      [13, 8.1, -29],
      [13, 8.1, -41],
      [-13, 8.1, -41],
    ],
    [0.82, 0.87, 0.88],
  );
  for (const x of [-9, -3, 3, 9]) {
    for (const side of [-1, 1])
      beam(
        out,
        'metal',
        [x + side * 1.1, 0.18, -29.32],
        [x + side * 1.1, 3.6, -29.32],
        0.1,
        0.13,
        [0.42, 0.45, 0.43],
      );
    beam(
      out,
      'metal',
      [x - 1.1, 3.6, -29.32],
      [x + 1.1, 3.6, -29.32],
      0.1,
      0.13,
      [0.42, 0.45, 0.43],
    );
  }
}

function plazaFacade(
  out,
  plan,
  y0,
  y1,
  { gold = [0.49, 0.445, 0.34], scratch = false, step = 3.6 } = {},
) {
  for (const { a, b, len, n } of edges(plan)) {
    const nx = Math.max(1, Math.round(len / 1.53)),
      ny = Math.max(1, Math.round((y1 - y0) / step));
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const l = lerp(a, b, i / nx),
          r = lerp(a, b, (i + 1) / nx),
          lo = y0 + ((y1 - y0) * j) / ny,
          hi = y0 + ((y1 - y0) * (j + 1)) / ny;
        let color = len < 15 ? [0.5, 0.56, 0.58] : gold;
        const center = (i + 0.5) / nx - 0.5;
        // The owner's ceramic-frit 'cat scratches' form three separate vertical
        // compositions, and terminate at staggered heights in the top composition.
        if (scratch && len > 35) {
          const y = (lo + hi) / 2;
          const stripeCenters =
            y < 92 ? [0] : y < 171 ? [-0.057, 0, 0.057] : [-0.114, -0.057, 0, 0.057, 0.114];
          const inZone =
            (y > 43 && y < 88) ||
            (y > 102 && y < 159) ||
            (y > 188 && y < 249 - Math.abs(center) * 110);
          if (inZone && stripeCenters.some((u) => Math.round((u + 0.5) * nx - 0.5) === i))
            color = [0.74, 0.72, 0.63];
          else if (Math.abs(center) > 0.38) color = [0.53, 0.58, 0.59];
        }
        grid(
          out,
          [
            [l[0], lo, l[1]],
            [r[0], lo, r[1]],
            [r[0], hi, r[1]],
            [l[0], hi, l[1]],
          ],
          color,
          2,
          4,
          0.052,
          [0.64, 0.62, 0.53],
        );
        // Small gold reveal at every third pane, with an exposed projecting edge.
        if (i % 3 === 0)
          beam(
            out,
            'metal',
            shift([l[0], lo, l[1]], n, 0.035),
            shift([l[0], hi, l[1]], n, 0.035),
            0.11,
            0.15,
            [0.64, 0.57, 0.39],
          );
      }
    // Continuous silver spandrels remain separate from the narrower gold mullions.
    for (let j = 1; j <= ny; j++) {
      const y = y0 + ((y1 - y0) * j) / ny;
      face(
        out,
        'glass',
        [
          [a[0], y - 0.49, a[1]],
          [b[0], y - 0.49, b[1]],
          [b[0], y - 0.1, b[1]],
          [a[0], y - 0.1, a[1]],
        ].map((p) => shift(p, n, 0.035)),
        [0.63, 0.66, 0.63],
      );
    }
  }
}
function plazaGlazedTriangle(out, a, b, tip) {
  const rows = 17;
  for (let row = 0; row < rows; row++) {
    const l0 = lerp(a, tip, row / rows),
      r0 = lerp(b, tip, row / rows),
      l1 = lerp(a, tip, (row + 1) / rows),
      r1 = lerp(b, tip, (row + 1) / rows);
    const cols = Math.max(1, Math.ceil(Math.hypot(...r0.map((v, k) => v - l0[k])) / 2));
    for (let i = 0; i < cols; i++) {
      const p = [
        lerp(l0, r0, i / cols),
        lerp(l0, r0, (i + 1) / cols),
        lerp(l1, r1, (i + 1) / cols),
        lerp(l1, r1, i / cols),
      ];
      if (row === rows - 1) {
        const center = [0, 1, 2].map((k) => (p[0][k] + p[1][k] + tip[k]) / 3),
          outer = [p[0], p[1], tip],
          inner = outer.map((q) => lerp(q, center, 0.12));
        tri(out, 'glass', inner, [0.61, 0.66, 0.67]);
        for (let j = 0; j < 3; j++) {
          const k = (j + 1) % 3;
          face(out, 'metal', [outer[j], outer[k], inner[k], inner[j]], [0.69, 0.66, 0.52]);
        }
      } else grid(out, p, [0.61, 0.66, 0.67], 2.1, 2, 0.06, [0.69, 0.66, 0.52]);
    }
  }
}
function buildCentralPlaza(out, m) {
  const pieces = partsEvidence('n0181_central_plaza'),
    plan = localOutline(m),
    part = (id) =>
      partPlan(
        m,
        pieces.find((p) => p.id === id),
      );
  const center = [-0.01329, 4.79924],
    scale = (p, s) =>
      p.map(([x, z]) => [center[0] + (x - center[0]) * s, center[1] + (z - center[1]) * s]);
  const green = [0.19, 0.27, 0.225],
    gold = [0.67, 0.57, 0.36],
    silver = [0.68, 0.7, 0.65];
  mappedSolid(out, 'foundation', plan, 0, 0.18, [0.58, 0.57, 0.5]);
  // At the public base the36 upper columns transfer onto18 circular columns.
  // The inset glazed lobby preserves the open circulation outside those columns.
  const lobby = scale(plan, 0.73),
    clear = {
      ...out,
      addTriangle(slot, ...args) {
        out.addTriangle(slot === 'glass' ? 'clear_glass' : slot, ...args);
      },
      addQuad(slot, ...args) {
        out.addQuad(slot === 'glass' ? 'clear_glass' : slot, ...args);
      },
    };
  plazaFacade(clear, lobby, 0.18, 23.6, { gold: [0.51, 0.59, 0.55], step: 4.1 });
  for (const { a, b, len } of edges(plan).filter((e) => e.len > 35)) {
    for (let i = 0; i < 5; i++) {
      const p = lerp(a, b, 0.12 + i * 0.19),
        x = center[0] + (p[0] - center[0]) * 0.96,
        z = center[1] + (p[1] - center[1]) * 0.96;
      loft(
        out,
        'cladding',
        [
          radialRing(0.18, 1.51, 1.51, 32, [x, z]),
          radialRing(0.72, 1.51, 1.51, 32, [x, z]),
          radialRing(0.86, 1.4, 1.4, 32, [x, z]),
          radialRing(23.6, 1.4, 1.4, 32, [x, z]),
          radialRing(24.8, 1.56, 1.56, 32, [x, z]),
        ],
        green,
      );
      for (const y of [0.78, 23.6]) torus(out, 'stainless', [x, y, z], 1.45, 0.055, silver, 32, 8);
    }
  }
  // Three additional corner columns flank the recessed corner entry bays.
  for (const p of [
    [0, -24.3],
    [-25.25, 19.35],
    [25.25, 19.35],
  ]) {
    loft(
      out,
      'cladding',
      [radialRing(0.18, 1.5, 1.5, 32, p), radialRing(24.8, 1.4, 1.4, 32, p)],
      green,
    );
  }
  mappedSolid(out, 'cladding', plan, 24.8, 30.5, [0.28, 0.31, 0.275]);
  for (const y of [24.9, 26.65, 28.4, 30.25])
    bandPlan(out, plan, y, 0.13, 0.075, silver, 'stainless');
  // Recessed first-floor circulation balcony and its exposed edge/guardrails.
  const balcony = scale(plan, 0.82);
  mappedSolid(out, 'cladding', balcony, 6.35, 7.05, green);
  guardrail(
    out,
    balcony.map(([x, z]) => [x, 7.05, z]),
    1.1,
    [0.6, 0.6, 0.52],
  );
  plazaFacade(out, plan, 30.5, 165.3, { scratch: true });
  plazaFacade(out, plan, 165.3, 172.3, { gold: [0.22, 0.27, 0.28], step: 3.5 });
  bandPlan(out, plan, 171.6, 0.7, 0.12, silver, 'stainless');
  plazaFacade(out, plan, 172.3, 265.9, { scratch: true });
  // Mechanical crown contracts in independently mapped steps, then reaches the
  // glazed observation gallery at292.5mPD−4.1mPD=288.4m above ground.
  const tiers = [
    { plan: part(1047690916), y0: 265.9, y1: 275 },
    { plan: part(1047690915), y0: 275, y1: 282 },
    { plan: part(1047690914), y0: 282, y1: 288.4 },
  ];
  mappedCap(out, 'metal', plan, 265.85, [0.46, 0.47, 0.4]);
  for (const t of tiers) {
    plazaFacade(out, t.plan, t.y0, t.y1, { gold: [0.4, 0.46, 0.47], step: 3.2 });
    for (const y of [t.y0 + 0.15, t.y1 - 0.6]) bandPlan(out, t.plan, y, 0.32, 0.11, gold, 'metal');
    mappedCap(out, 'metal', t.plan, t.y1 - 0.08, [0.49, 0.51, 0.47]);
    if (t.y1 === 275)
      for (const { a, b, n } of edges(t.plan))
        for (let j = 0; j < 7; j++) {
          const y = 266.6 + j * 0.36;
          face(
            out,
            'recess',
            [
              [a[0], y, a[1]],
              [b[0], y, b[1]],
              [b[0], y + 0.15, b[1]],
              [a[0], y + 0.15, a[1]],
            ].map((p) => shift(p, n, 0.07)),
            [0.16, 0.195, 0.19],
          );
        }
  }
  const roof = part(1047690914),
    apex = [center[0], 310.3, center[1]];
  for (const { a, b } of edges(roof))
    plazaGlazedTriangle(out, [a[0], 288.4, a[1]], [b[0], 288.4, b[1]], apex);
  // Gold-clad concrete feature frame: three legs at the truncated corners,
  // sloping roof struts and an open Vierendeel mast support (not a solid box).
  const feet = part(1047690915),
    tops = [];
  for (const p of feet) {
    const d = Math.hypot(p[0] - center[0], p[1] - center[1]),
      q = [center[0] + ((p[0] - center[0]) * 2.4) / d, center[1] + ((p[1] - center[1]) * 2.4) / d];
    tops.push(q);
    beam(out, 'metal', [p[0], 265.9, p[1]], [p[0], 288.4, p[1]], 0.95, 1.15, gold);
    beam(out, 'metal', [p[0], 288.4, p[1]], [q[0], 314.3, q[1]], 1.02, 1.22, gold);
    beam(out, 'metal', [q[0], 314.3, q[1]], [q[0], 330.05, q[1]], 0.68, 0.8, gold);
  }
  for (const y of [314.3, 318.25, 322.2, 326.15, 330.05])
    for (const { a, b } of edges(tops)) {
      beam(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.66, 1.2, gold);
      // Static daylight representation of Lightime's four illuminated bands.
      if (y < 330)
        face(
          out,
          'glass',
          [
            [a[0], y + 0.28, a[1]],
            [b[0], y + 0.28, b[1]],
            [b[0], y + 0.63, b[1]],
            [a[0], y + 0.63, a[1]],
          ],
          [0.74, 0.79, 0.75],
        );
    }
  loft(
    out,
    'metal',
    [
      radialRing(310.3, 0.8, 0.8, 32, center),
      radialRing(333.2, 0.66, 0.66, 32, center),
      radialRing(352.5, 0.43, 0.43, 32, center),
      radialRing(365.8, 0.2, 0.2, 32, center),
      radialRing(374.3, 0.035, 0.035, 32, center),
    ],
    gold,
  );
  for (let y = 331.5; y < 364; y += 3.8)
    torus(
      out,
      'metal',
      [center[0], y, center[1]],
      0.66 - (y - 331.5) * 0.013,
      0.043,
      [0.74, 0.71, 0.58],
      24,
      8,
    );
  // Bronze/glass door frames occupy all three recessed corner entry fronts.
  for (const { a, b, len, n } of edges(lobby).filter((e) => e.len > 3 && e.len < 8)) {
    const p = lerp(a, b, 0.5),
      d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    for (const u of [-1.05, 0, 1.05])
      beam(
        out,
        'metal',
        [p[0] + d[0] * u, 0.2, p[1] + d[1] * u],
        [p[0] + d[0] * u, 3.45, p[1] + d[1] * u],
        0.09,
        0.12,
        gold,
      );
    beam(
      out,
      'metal',
      [p[0] - d[0] * 1.05, 3.45, p[1] - d[1] * 1.05],
      [p[0] + d[0] * 1.05, 3.45, p[1] + d[1] * 1.05],
      0.1,
      0.12,
      gold,
    );
  }
}

function marinaGlazing(out, plan, y0, y1, step, white) {
  for (const { a, b, len, n } of edges(plan)) {
    grid(
      out,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [0.12, 0.28, 0.42],
      1.45,
      step,
      0.045,
      [0.68, 0.74, 0.75],
    );
    const floors = Math.max(1, Math.round((y1 - y0) / step));
    for (let j = 1; j <= floors; j++) {
      const y = y0 + ((y1 - y0) * j) / floors;
      beam(
        out,
        'metal',
        shift([a[0], y, a[1]], n, 0.07),
        shift([b[0], y, b[1]], n, 0.07),
        0.2,
        0.26,
        white,
      );
    }
    // Lower residential zones have two additional tall white subdivisions.
    if (y0 < 214)
      for (const u of [1 / 3, 2 / 3]) {
        const p = lerp(a, b, u);
        beam(
          out,
          'metal',
          shift([p[0], y0, p[1]], n, 0.075),
          shift([p[0], y1, p[1]], n, 0.075),
          0.35,
          0.3,
          white,
        );
      }
    beam(out, 'metal', [a[0], y0, a[1]], [a[0], y1, a[1]], 0.72, 0.78, white);
  }
}
function marinaScreen(out, at, width) {
  // Six interlocking circular petals reconstruct the photographed podium screen.
  // The white fan ribs are modeled separately in front of this continuous lattice.
  for (let x = 0.42; x < width - 0.25; x += 0.67)
    for (let y = 4.15; y < 11.45; y += 0.7)
      for (let petal = 0; petal < 6; petal++) {
        const theta = (petal * Math.PI) / 3,
          cx = x + 0.14 * Math.cos(theta),
          cy = y + 0.14 * Math.sin(theta);
        for (let k = 0; k < 12; k++) {
          const a = (k * Math.PI) / 6,
            b = ((k + 1) * Math.PI) / 6,
            r = 0.22,
            w = 0.027;
          face(
            out,
            'metal',
            [
              at(cx + Math.cos(a) * (r + w), cy + Math.sin(a) * (r + w), 0.055),
              at(cx + Math.cos(b) * (r + w), cy + Math.sin(b) * (r + w), 0.055),
              at(cx + Math.cos(b) * (r - w), cy + Math.sin(b) * (r - w), 0.055),
              at(cx + Math.cos(a) * (r - w), cy + Math.sin(a) * (r - w), 0.055),
            ],
            [0.83, 0.82, 0.74],
          );
        }
      }
}
function build23Marina(out, m) {
  const parts = partsEvidence('n0182_23_marina'),
    plan = partPlan(
      m,
      parts.find((p) => p.id === 907717855),
    ),
    podium = localOutline(m),
    mast = partPlan(
      m,
      parts.find((p) => p.id === 186351102),
    );
  const center = mast.reduce(
      (a, p) => [a[0] + p[0] / mast.length, a[1] + p[1] / mast.length],
      [0, 0],
    ),
    white = [0.88, 0.88, 0.84],
    stone = [0.66, 0.66, 0.62];
  mappedSolid(out, 'foundation', podium, 0, 0.22, [0.56, 0.55, 0.51]);
  mappedSolid(out, 'recess', podium, 0.22, 12.6, [0.2, 0.22, 0.215]);
  mappedCap(out, 'cladding', podium, 12.63, stone);
  // Meter-scale stone piers, carved-looking patterned screens and splayed fan ribs
  // follow the owner's architect's detailed street photograph of the low podium.
  for (const { a, b, len, n } of edges(podium)) {
    const d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      at = (u, y, depth = 0.1) => [
        a[0] + d[0] * u + n[0] * depth,
        y,
        a[1] + d[1] * u + n[2] * depth,
      ];
    const count = Math.max(2, Math.round(len / 6)),
      bay = len / count;
    for (let i = 0; i < count; i++) {
      const left = i * bay,
        right = (i + 1) * bay,
        entry = n[2] < -0.8 && i === Math.floor(count / 2);
      beam(out, 'cladding', at(left, 0.25), at(left, 12.6), 0.75, 0.72, stone);
      if (entry) {
        grid(
          out,
          [
            at(left + 0.5, 0.25, 0.12),
            at(right - 0.5, 0.25, 0.12),
            at(right - 0.5, 11.5, 0.12),
            at(left + 0.5, 11.5, 0.12),
          ],
          [0.37, 0.46, 0.45],
          1.3,
          2.7,
          0.065,
          [0.56, 0.55, 0.49],
        );
        for (const u of [left + bay * 0.3, left + bay * 0.5, left + bay * 0.7])
          beam(
            out,
            'stainless',
            at(u, 0.25, 0.18),
            at(u, 3.2, 0.18),
            0.095,
            0.13,
            [0.65, 0.66, 0.62],
          );
      } else {
        const local = (x, y, z) => at(left + 0.4 + x, y, z);
        marinaScreen(out, local, bay - 0.8);
        for (const t of [0.08, 0.26, 0.43, 0.57, 0.74, 0.92]) {
          beam(
            out,
            'metal',
            at(left + bay * 0.5, 3.8, 0.26),
            at(left + bay * t, 11.75, 0.26),
            0.18,
            0.18,
            white,
          );
        }
        for (let y = 0.65; y < 3.55; y += 0.13)
          beam(
            out,
            'metal',
            at(left + 0.48, y, 0.17),
            at(right - 0.48, y, 0.17),
            0.05,
            0.09,
            [0.66, 0.69, 0.65],
          );
      }
      beam(out, 'cladding', at(left, 12.05, 0.17), at(right, 12.05, 0.17), 0.85, 1.1, stone);
      beam(out, 'metal', at(left, 3.75, 0.17), at(right, 3.75, 0.17), 0.16, 0.22, white);
    }
  }
  // Six-storey entrance volume: slanted lower glazing and a screened structural
  // transfer storey. The outer white W braces stay above the landscaped podium.
  for (const { a, b, len, n } of edges(plan)) {
    const lowA = shift([a[0], 12.7, a[1]], n, 0.9),
      lowB = shift([b[0], 12.7, b[1]], n, 0.9),
      hiA = [a[0], 18.4, a[1]],
      hiB = [b[0], 18.4, b[1]];
    grid(out, [lowA, lowB, hiB, hiA], [0.18, 0.37, 0.49], 1.4, 1.9, 0.05, [0.72, 0.75, 0.73]);
    face(out, 'recess', [hiA, hiB, [b[0], 26, b[1]], [a[0], 26, a[1]]], [0.32, 0.33, 0.31]);
    for (let y = 18.5; y < 25.6; y += 0.2)
      beam(
        out,
        'metal',
        shift([a[0], y, a[1]], n, 0.08),
        shift([b[0], y, b[1]], n, 0.08),
        0.07,
        0.065,
        [0.59, 0.58, 0.52],
      );
    for (const u of [0, 0.25, 0.5, 0.75, 1]) {
      const p = lerp(a, b, u),
        q = lerp(a, b, Math.min(1, u + 0.25));
      if (u < 1)
        beam(
          out,
          'metal',
          [p[0], u % 0.5 === 0 ? 25.5 : 18.3, p[1]],
          [q[0], u % 0.5 === 0 ? 18.3 : 25.5, q[1]],
          0.86,
          0.55,
          white,
        );
    }
    beam(out, 'cladding', [a[0], 12.65, a[1]], [a[0], 26, a[1]], 0.8, 0.9, stone);
    beam(out, 'cladding', [a[0], 26, a[1]], [b[0], 26, b[1]], 0.9, 1.05, stone);
  }
  marinaGlazing(out, plan, 26.6, 118, 3.6, white);
  marinaGlazing(out, plan, 118, 126, 2.66, white);
  marinaGlazing(out, plan, 126, 214, 3.67, white);
  marinaGlazing(out, plan, 214, 223, 3, white);
  marinaGlazing(out, plan, 223, 317.3, 3.93, white);
  for (const y of [118, 121.3, 125.5, 214, 217.5, 222.5, 316.5])
    bandPlan(out, plan, y, 0.74, 0.52, white, 'metal');
  // Four cardinal facets carry twelve real triangular duplex balconies each:
  //48 open terraces, with separate slab, glass guard and shallow plunge basin.
  for (const { a, b, len, n } of edges(plan).filter(
    (e) => Math.abs(e.n[0]) > 0.95 || Math.abs(e.n[2]) > 0.95,
  )) {
    const l = lerp(a, b, 0.22),
      r = lerp(a, b, 0.78),
      mid = lerp(a, b, 0.5),
      tip = [mid[0] + n[0] * 5.2, mid[1] + n[2] * 5.2],
      balcony = clockwise([l, r, tip]);
    for (let floor = 0; floor < 12; floor++) {
      const y = 225.9 + 7.6 * floor;
      mappedSolid(out, 'metal', balcony, y - 0.34, y, white);
      for (const { a: p, b: q, n: bn } of edges(balcony).filter(
        (e) => Math.abs(e.n[0] * n[0] + e.n[2] * n[2]) < 0.995,
      )) {
        face(
          out,
          'clear_glass',
          [
            [p[0], y + 0.13, p[1]],
            [q[0], y + 0.13, q[1]],
            [q[0], y + 1.1, q[1]],
            [p[0], y + 1.1, p[1]],
          ],
          [0.48, 0.68, 0.7],
        );
        beam(
          out,
          'metal',
          [p[0], y + 1.13, p[1]],
          [q[0], y + 1.13, q[1]],
          0.075,
          0.08,
          [0.74, 0.77, 0.73],
        );
      }
      const water = balcony.map((p) => [
        mid[0] + (p[0] - mid[0]) * 0.53 + n[0] * 0.45,
        mid[1] + (p[1] - mid[1]) * 0.53 + n[2] * 0.45,
      ]);
      mappedSolid(out, 'metal', water, y + 0.04, y + 0.15, [0.72, 0.77, 0.72]);
      mappedCap(out, 'glass', water, y + 0.165, [0.15, 0.53, 0.59]);
    }
    for (const u of [0.16, 0.84]) {
      const p = lerp(a, b, u);
      beam(out, 'metal', [p[0], 223, p[1]], [p[0], 317.3, p[1]], 0.72, 0.7, white);
    }
  }
  mappedCap(out, 'metal', plan, 317.3, [0.64, 0.68, 0.67]);
  const crownAt = (p, y) => {
    const s = 1 - ((y - 317.3) / (369 - 317.3)) * 0.9;
    return [center[0] + (p[0] - center[0]) * s, y, center[1] + (p[1] - center[1]) * s];
  };
  // The four broad triangular canopies alternate with open mast/bracing slots.
  // This is deliberately an open crown, not an unbroken octagonal pyramid.
  for (const { a, b, len, n } of edges(plan)) {
    const upper = !(Math.abs(n[0]) > 0.95 || Math.abs(n[2]) > 0.95);
    grid(
      out,
      [crownAt(a, 317.3), crownAt(b, 317.3), crownAt(b, 331.3), crownAt(a, 331.3)],
      [0.12, 0.29, 0.43],
      1.4,
      3.3,
      0.06,
      [0.75, 0.77, 0.73],
    );
    beam(out, 'metal', crownAt(a, 317.3), crownAt(a, 367.5), 0.78, 0.94, white);
    if (upper) {
      const lowA = crownAt(a, 331.3),
        lowB = crownAt(b, 331.3),
        topA = crownAt(a, 367.5),
        topB = crownAt(b, 367.5);
      face(out, 'metal', [lowA, lowB, topB, topA], [0.78, 0.8, 0.75]);
      // Narrow horizontal louvre relief follows the sloping canopy, with a real
      // base/side thickness so the pale triangular skin never reads as a card.
      const side = [lowA, lowB, topB, topA],
        normal = normalFor(...side);
      for (let k = 0; k < 4; k++) {
        const j = (k + 1) % 4;
        face(
          out,
          'metal',
          [side[k], side[j], shift(side[j], normal, -0.22), shift(side[k], normal, -0.22)],
          white,
        );
      }
      for (let row = 0; row < 35; row++) {
        const t = (row + 0.5) / 35,
          p = shift(lerp(lowA, topA, t), normal, 0.025),
          q = shift(lerp(lowB, topB, t), normal, 0.025);
        beam(out, 'metal', p, q, 0.04, 0.07, [0.59, 0.64, 0.64]);
      }
    } else
      for (let row = 0; row < 5; row++) {
        const y = 331.3 + row * 6.7;
        beam(out, 'metal', crownAt(a, y), crownAt(b, y + 6.7), 0.22, 0.25, [0.57, 0.63, 0.64]);
        beam(out, 'metal', crownAt(b, y), crownAt(a, y + 6.7), 0.22, 0.25, [0.57, 0.63, 0.64]);
      }
  }
  const rings = [
    [321, 1.45],
    [355, 1.27],
    [381.5, 0.89],
    [389.8, 0.62],
  ].map(([y, r]) => radialRing(y, r, r, 32, center));
  loft(out, 'metal', rings, white);
  for (let y = 333; y < 387; y += 3.2)
    torus(
      out,
      'metal',
      [center[0], y, center[1]],
      1.39 - (y - 333) * 0.012,
      0.045,
      [0.69, 0.72, 0.68],
      32,
      6,
    );
  loft(
    out,
    'metal',
    [
      radialRing(389.8, 1.25, 1.25, 8, center),
      radialRing(390.4, 1.25, 1.25, 8, center),
      radialRing(392.4, 0.025, 0.025, 8, center),
    ],
    white,
  );
}

/** Curved tower sections are reconstructed from independently mapped level
 * contours. Their vertical datums follow the completed exterior/section rather
 * than treating old OSM skillion roof tags as several-hundred-meter roofs. */
function buildLotte(out, m) {
  const block = (slot, center, size, color) =>
    box(
      out,
      slot,
      center.map((v, i) => v - size[i] / 2),
      center.map((v, i) => v + size[i] / 2),
      color,
    );
  const white = [0.86, 0.89, 0.88],
    silver = [0.64, 0.69, 0.71],
    glass = [0.35, 0.51, 0.58];
  const base = localOutline(m),
    parts = m.elements;
  const plan = (id) =>
    partPlan(
      m,
      parts.find((e) => e.id === id),
    );
  const sections = [
    [0, 914963586],
    [164, 879571752],
    [175, 888605473],
    [214, 879571750],
    [332, 888605472],
    [451, 888605471],
    [489, 879798716],
    [505, 888605470],
  ].map(([y, id]) => ({ y, plan: plan(id) }));
  const ray = (p, a) => {
    const d = [Math.cos(a), Math.sin(a)],
      hits = [];
    for (let i = 0; i < p.length; i++) {
      const q = p[i],
        r = p[(i + 1) % p.length],
        e = [r[0] - q[0], r[1] - q[1]];
      const det = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(det) < 1e-9) continue;
      const t = (q[0] * e[1] - q[1] * e[0]) / det,
        u = (q[0] * d[1] - q[1] * d[0]) / det;
      if (t > 0 && u >= 0 && u <= 1) hits.push(t);
    }
    if (!hits.length) throw new Error(`Lotte contour has no radial intersection at ${a}`);
    return Math.max(...hits);
  };
  const at = (a, y, offset = 0) => {
    let i = 1;
    while (i < sections.length - 1 && y > sections[i].y) i++;
    const p = sections[i - 1],
      q = sections[i],
      t = Math.max(0, Math.min(1, (y - p.y) / (q.y - p.y)));
    const radius = ray(p.plan, a) * (1 - t) + ray(q.plan, a) * t + offset;
    return [radius * Math.cos(a), y, radius * Math.sin(a)];
  };
  const count = 160,
    angles = Array.from({ length: count }, (_, i) => (-i / count) * Math.PI * 2);
  const rows = Array.from({ length: 124 }, (_, i) => 0.22 + i * (504.78 / 123));
  mappedSolid(out, 'foundation', base, 0, 0.22, [0.57, 0.6, 0.59]);
  const ventBands = [
    [86, 93],
    [163, 172],
    [235, 243],
    [292, 300],
    [326, 335],
    [404, 414],
    [450, 461],
  ];
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < count; i++) {
      const a = angles[i],
        b = (-(i + 1) / count) * Math.PI * 2,
        y0 = rows[j - 1],
        y1 = rows[j];
      const p = at((a + b) / 2, (y0 + y1) / 2),
        seam = Math.abs(p[2]) < 2.5;
      const vent = seam && ventBands.some(([lo, hi]) => y0 < hi && y1 > lo);
      const inset = seam && y0 > 14 ? -0.7 : 0;
      const quad = [at(a, y0, inset), at(b, y0, inset), at(b, y1, inset), at(a, y1, inset)];
      const tint = vent
        ? [0.13, 0.19, 0.22]
        : seam
          ? [0.24, 0.35, 0.4]
          : glass.map((v, k) => v + (i % 4 === 0 ? 0.025 : 0) + (y1 < 34 && k === 1 ? 0.04 : 0));
      face(out, y1 < 12 ? 'clear_glass' : vent ? 'recess' : 'glass', quad, tint);
      beam(out, 'metal', at(a, y1, inset + 0.018), at(b, y1, inset + 0.018), 0.045, 0.065, silver);
      if (vent)
        for (let y = y0 + 0.32; y < y1; y += 0.42)
          beam(
            out,
            'metal',
            at(a, y, inset + 0.06),
            at(b, y, inset + 0.06),
            0.085,
            0.13,
            [0.47, 0.52, 0.54],
          );
    }
  // Real projecting ceramic-white aluminium fins; each follows the changing
  // footprint instead of a straight cylinder or a texture stripe.
  for (const a of angles)
    for (let j = 1; j < rows.length; j++) {
      const p = at(a, (rows[j - 1] + rows[j]) / 2),
        seam = Math.abs(p[2]) < 2.15;
      if (seam) continue;
      beam(
        out,
        'metal',
        at(a, rows[j - 1] + 0.035, 0.21),
        at(a, rows[j] - 0.035, 0.21),
        0.145,
        0.5,
        white,
      );
    }
  // The eight supercolumns are visible behind the lower transparent lobby.
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2,
      p = at(a, 0, -7);
    block('concrete', [p[0], 16, p[2]], [3.3, 32, 3.3], [0.78, 0.8, 0.78]);
  }
  mappedCap(out, 'concrete', plan(888605470), 505, [0.39, 0.44, 0.45]);
  // Narrow glass-and-metal entry doors occupy the two ends of the seam.
  for (const side of [-1, 1]) {
    const x = side * (side > 0 ? 46.4 : 46.5);
    for (let k = -2; k <= 2; k++) {
      const z = k * 1.05;
      beam(out, 'stainless', [x, 0.22, z], [x, 4.45, z], 0.065, 0.09, [0.72, 0.74, 0.73]);
      if (k < 2)
        face(
          out,
          'clear_glass',
          side < 0
            ? [
                [x, 0.22, z],
                [x, 0.22, z + 1.05],
                [x, 4.45, z + 1.05],
                [x, 4.45, z],
              ]
            : [
                [x, 0.22, z + 1.05],
                [x, 0.22, z],
                [x, 4.45, z],
                [x, 4.45, z + 1.05],
              ],
          [0.65, 0.78, 0.78],
        );
    }
    beam(out, 'stainless', [x, 4.45, -2.3], [x, 4.45, 2.3], 0.15, 0.23, silver);
  }
  const ears = [plan(635073469), plan(635073470)];
  for (const [index, outline] of ears.entries()) {
    const sign = index === 0 ? 1 : -1;
    // The mapped ear plan contains real folded returns at the inner edges.
    // Its base is broader than its end; the top stays flat, not a cone apex.
    const point = (p, y) => [
      p[0] * (1 + (554.5 - y) * 0.0045),
      y,
      p[1] * (1 + (554.5 - y) * 0.0014),
    ];
    const levels = [505, 513, 522, 531, 541, 549, 554.5];
    for (const e of edges(outline)) {
      const n = Math.max(1, Math.ceil(e.len / 0.72));
      for (let k = 0; k < n; k++) {
        const p = lerp(e.a, e.b, k / n),
          q = lerp(e.a, e.b, (k + 1) / n);
        // Crown glazing is open above the occupied lantern. Every fin is a
        // physical white blade, so the diagrid and access steel remain visible.
        for (let j = 1; j < levels.length; j++) {
          beam(
            out,
            'metal',
            point(p, levels[j - 1] + 0.03),
            point(p, levels[j] - 0.03),
            0.14,
            0.33,
            white,
          );
          beam(out, 'metal', point(p, levels[j]), point(q, levels[j]), 0.075, 0.12, white);
        }
      }
      for (let j = 1; j < levels.length - 1; j++) {
        const y0 = levels[j - 1],
          y1 = levels[j],
          a = point(e.a, y0),
          b = point(e.b, y1);
        if (e.len > 2.5) tube(out, 'metal', a, b, 0.27, white, 10);
      }
      beam(out, 'metal', point(e.a, 554.32), point(e.b, 554.32), 0.3, 0.32, white);
    }
    // Repeated maintenance platforms and paired zig-zag stairs occupy the
    // narrow inner return; no solid cap fills the open lantern.
    const x = -0.6,
      z = sign * 5.25;
    for (let j = 0; j < 6; j++) {
      const y = 505 + j * 7.5;
      block('metal', [x, y, z], [3.8, 0.16, 1.2], [0.48, 0.53, 0.53]);
      guardrail(
        out,
        [
          [x - 1.85, y + 0.09, z - sign * 0.54],
          [x + 1.85, y + 0.09, z - sign * 0.54],
        ],
        1.1,
        silver,
      );
      if (j < 5) {
        const steps = 42;
        for (let k = 0; k < steps; k++) {
          const t = k / steps,
            xx = x + (j % 2 ? 1 : -1) * (1.55 - 3.1 * t);
          block(
            'metal',
            [xx, y + t * 7.5 + 0.08, z + sign * 0.25],
            [0.11, 0.1, 0.64],
            [0.61, 0.66, 0.65],
          );
        }
        for (const dz of [-0.32, 0.82])
          beam(
            out,
            'metal',
            [x + (j % 2 ? 1 : -1) * 1.55, y + 0.09, z + sign * dz],
            [x - (j % 2 ? 1 : -1) * 1.55, y + 7.5, z + sign * dz],
            0.065,
            0.07,
            silver,
          );
      }
    }
    for (const p of [outline[2], outline[Math.floor(outline.length * 0.65)]]) {
      const q = point(p, 554.5);
      tube(out, 'stainless', q, [q[0], 555.7, q[2]], 0.055, silver, 8);
      torus(out, 'metal', [q[0], 555.2, q[2]], 0.11, 0.025, silver, 12, 6);
    }
  }
  // KPF gives an11m undercurved suspension bridge at541m. Its deck is flat;
  // the under-slung cables sag below it, with individual vertical hangers.
  for (let k = 0; k < 44; k++)
    block('metal', [0, 540.95, -5.5 + (k + 0.5) * 0.25], [1.25, 0.1, 0.225], [0.57, 0.62, 0.63]);
  for (const x of [-0.69, 0.69]) {
    for (let k = 0; k < 44; k++) {
      const z0 = -5.5 + k * 0.25,
        z1 = z0 + 0.25;
      const cable = (z) => 539.25 + 1.7 * (z / 5.5) ** 2;
      tube(out, 'stainless', [x, cable(z0), z0], [x, cable(z1), z1], 0.035, silver, 6);
      tube(out, 'stainless', [x, 542.25, z0], [x, 542.25, z1], 0.025, silver, 6);
      if (k % 2 === 0)
        tube(out, 'stainless', [x, cable(z0), z0], [x, 542.25, z0], 0.018, silver, 6);
      for (let j = 1; j < 5; j++)
        tube(out, 'stainless', [x, 541 + j * 0.23, z0], [x, 541 + j * 0.23, z1], 0.009, silver, 4);
    }
  }
}

export const skylineWorld = [
  atlantaStudy,
  centerStudy,
  seagramStudy,
  luxorStudy,
  moeveStudy,
  cayanStudy,
  telekomStudy,
  marina101Study,
  park432Study,
  citicorpStudy,
  princessStudy,
  threeWtcStudy,
  ...emiratesStudies,
  {
    id: 'N0193',
    key: 'metropolitan_life_insurance_company_tower',
    wikidataId: 'Q652452',
    title: 'Metropolitan Life Insurance Company Tower',
    height: 213.36,
    build: buildMetropolitan,
    mapFrame: 'map-frame.json',
    brief:
      'The restored1909 campanile: subtly narrowing limestone/marble shaft with triple windows, four decorated mosaic clocks, five open arches on each gallery, dormered lattice pyramid, bronze bells, octagonal cupola and gilded lantern.',
    sourceFacts: {
      architecturalHeightFeet: 700,
      architecturalHeightMeters: 213.36,
      baseFeet: [85, 75],
      baseMeters: [25.908, 22.86],
      stories: 50,
      originalArchitect: 'Napoleon LeBrun & Sons',
      originalStructuralEngineer: 'Purdy & Henderson',
      modernization: 'Morgan & Meroni,1960–1964; original proportions and entasis retained',
      shortAxisEntasisFeet: 1.5,
      longAxisEntasisFeet: 2,
      clocks: 4,
      dialDiameterFeet: 26.5,
      numeralHeightFeet: 4,
      minuteMarkerDiameterInches: 10.5,
      handTotalLengthFeet: { minute: 17, hour: 13 + 4 / 12 },
      dials: 'White and turquoise vitreous mosaic; copper-edged numerals and glazed minute marks',
      arcade: 'Five arches per elevation; three-story openings around a smaller setback core',
      roofDormers: { northSouth: [4, 3, 2, 1], eastWest: [3, 2, 1, 1] },
      bellsPounds: { west: 7000, east: 3000, north: 2000, south: 1500 },
      domeRestoration:
        'BCA documents23.75karat Italian gold-leaf gilding during the2001 exterior restoration',
      presentUse: 'The New York EDITION hotel',
    },
    reconstruction: {
      facade:
        'Published85×75ft rectangular foot and slight entasis replace a mistaken full-block envelope. Three groups of three windows, alternate projecting sills, paired clock-level windows, modern simplified stone and lower granite water table follow LPC plates.',
      clocks:
        'Four independently modeled dials carry original Arabic numeral strokes,60 minute discs, a turquoise corona/border, fixed10:10 hands, individually folded fruit/leaf wreaths and stylized shell/dolphin spandrel scrolls.',
      capital:
        'Actual openings through the five-arch masonry screens reveal a separately windowed inner core. Open balustrades, the smaller four-story plinth and slender cornices reproduce the restored planar profile.',
      crown:
        'Four rows of round-hooded dormers and raised diamond lattice follow the pyramidal stone roof. Modeled brackets, balustraded platform, octagonal colonnade, four sized bronze bells, gold dome with eight dormers, upper guard and glazed lantern remain separate geometry.',
    },
    refs: [
      'https://s-media.nyc.gov/agencies/lpc/lp/1530.pdf',
      'https://www.bcausa.com/portfolio?catid=19&id=162%3Aone-madison-avenue&view=article',
      'https://graciano.com/project/metlife-building/',
      'https://www.editionhotels.com/new-york/',
      'https://www.editionhotels.com/new-york/gallery/',
      'https://www.kpf.com/project/one-madison-avenue',
      'https://www.openstreetmap.org/way/158404390',
    ],
    nativeAxes: { up: '+Y', front: '+X toward Madison Avenue', north: '+Z toward East24th Street' },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Source-local exact-QID tower way158404390 and concentric roof parts establish the corner anchor; whole-block way109280428 describes the adjacent office wing and is deliberately excluded. Native+X faces Madison Avenue west and+Z faces East24th Street north. Published85×75ft proportions differ from mapped outline by about0.2–0.34m; the primary dimensions govern. Largest bell is west, next largest east, smaller bells north/south. GroundY0 is the street entry datum.',
    }),
    limitations: [
      commonLimit,
      'Intermediate floor elevations, crown stage heights, dormer proportions, numeral outlines, sculpted fruit/shell/dolphin detail and bell profiles are original reconstructions from the LPC measured description and photographs. The clocks are static at10:10; the lantern is a daytime exterior. The independently redeveloped One Madison office wing, off-site streets, hotel interiors and transient signs are excluded. No historic removed ornament is restored to the current facade.',
    ],
    camera: { position: [165, 130, 165], lookAt: [0, 106, 0], fov: 40 },
    qaCameras: [
      { name: 'madison-and-24th', position: [85, 100, 80], lookAt: [0, 103, 0] },
      { name: 'triple-window-entasis', position: [40, 72, 13], lookAt: [12, 65, 0] },
      { name: 'four-mosaic-clocks', position: [35, 113, 34], lookAt: [0, 111, 0] },
      { name: 'numerals-and-wreath', position: [27, 112, 3], lookAt: [13, 111, 0] },
      { name: 'open-five-arch-gallery', position: [39, 138, 27], lookAt: [0, 137, 0] },
      { name: 'gallery-intrados', position: [17, 135, 5], lookAt: [8, 135, 0] },
      { name: 'setback-and-balustrades', position: [29, 157, 31], lookAt: [0, 152, 0] },
      { name: 'lattice-roof-dormers', position: [30, 181, 26], lookAt: [0, 176, 0] },
      { name: 'cupola-and-gold-dome', position: [23, 204, 19], lookAt: [0, 199, 0] },
      { name: 'western-bronze-bell', position: [12, 193, 5], lookAt: [4, 191, 0] },
      { name: 'gilded-lantern', position: [9, 213, 8], lookAt: [0, 209.5, 0] },
      { name: 'street-entrance', position: [30, 5, 4], lookAt: [12.8, 3, 0] },
      { name: 'far-madison-square', position: [260, 81, 180], lookAt: [0, 107, 0] },
    ],
  },
  {
    id: 'N0192',
    key: 'metlife_building',
    wikidataId: 'Q464482',
    title: 'MetLife Building',
    height: 246.3,
    build: buildMetlife,
    brief:
      'The broad octagonal 200 Park Avenue tower, with projecting quartz-aggregate precast window fins, two deeply recessed mechanical floors, roof lettering, aluminum-clad eighth/ninth floors and the renewed travertine north arcade.',
    sourceFacts: {
      architecturalHeightMeters: 246.3,
      floors: 59,
      completed: 1963,
      architects: 'Emery Roth & Sons; Walter Gropius and Pietro Belluschi consulting',
      facade:
        'Eggshell precast concrete with exposed quartz aggregate; floor-to-floor tower units and separate base spandrels/mullions',
      facadePrimaryEvidence:
        'Architectural Forum, February 1962, printed page 10: Concrete Curtain; present facade restoration by Hoffmann Architects',
      lowerAluminumFloors: [8, 9],
      firstPrecastTowerFloor: 10,
      renewedNorthEntry:
        'MdeAS 2022 renovation: travertine arcade columns, bronze frames and large glazing',
      terrace:
        'Current owner brochure describes an eighth-floor open-air Skyline Terrace and Lounge',
    },
    reconstruction: {
      plan: 'Independent mapped twelve-point tower ring is cleaned only at near-collinear vertices to retain its long octagonal shape. The much wider full ground podium, setback eighth/ninth-floor block and four separate support columns retain their own footprints.',
      facade:
        'Individual recessed blue-gray windows have projecting triangular cast fins, thick precast spandrels, dark transoms and fine construction seams. Mechanical levels have actual setback glass and outer columns, not painted stripes.',
      crown:
        'Physical vertical fins stand before a recessed louver screen; original white polygonal MetLife lettering faces the broad north/south walls. Flat roof and modest cornice retain the architectural height; no active helipad is depicted.',
      entry:
        'Current north-side colonnade is recessed behind travertine-clad piers, with bronze-framed tall glazing, three revolving doors and soffit lights. The separate podium terrace has glass guards and simple planter beds.',
    },
    refs: [
      'https://www.hoffarch.com/project/metlife-building/',
      'https://usmodernist.org/AF/AF-1962-02.pdf',
      'https://www.irvinecompanyoffice.com/content/dam/office/3-readytopublish/portfolio/newyork/midtown/properties/200parkavenue/brochures/200ParkAvenue-Brochure.pdf',
      'https://www.mdeas.com/200park',
      'https://old.skyscraper.org/EXHIBITIONS/BIG_BUILDINGS/CONTENT/jumbos/j_02.htm',
      'https://awards-api.skyscrapercenter.com/building/metlife-building/909',
      'https://www.openstreetmap.org/way/137564641',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID map frame preserves the narrower tower across the larger podium. Native+X points toward the north 45th Street entrance, -X toward Grand Central Terminal, +Z toward east Depew Place and -Z toward Vanderbilt Avenue. The independently mapped entrance and four elevated support columns retain their signed positions. GroundY0 is the street entry datum; adjoining terminal and street grade are excluded.',
    }),
    limitations: [
      commonLimit,
      'Facade module pitch, recess-floor heights, precast fin section, wordmark outlines, terrace furniture and entrance details are reconstructed from the current owner, restoration engineer and architect photographs; no original facade shop drawing is claimed. The mapped lower30/38m elevations are approximate. The wordmark is original polygonal geometry; exact font outlines, rooftop small plant, tenant displays and interiors are excluded.',
    ],
    camera: { position: [330, 175, 330], lookAt: [-5, 115, 0], fov: 42 },
    qaCameras: [
      { name: 'park-avenue-octagon', position: [-170, 156, 130], lookAt: [-10, 140, 0] },
      { name: 'north-slab-and-podium', position: [170, 102, -100], lookAt: [0, 110, 0] },
      { name: 'precast-fins-and-returns', position: [45, 130, 22], lookAt: [9, 124, 8] },
      { name: 'lower-recess-floor', position: [57, 89, -18], lookAt: [9, 86, -2] },
      { name: 'upper-recess-floor', position: [-75, 196, 40], lookAt: [-32, 190, 7] },
      { name: 'crown-fins-and-wordmark', position: [80, 244, 18], lookAt: [9, 237, 0] },
      { name: 'south-crown-wordmark', position: [-102, 251, -15], lookAt: [-32, 238, 0] },
      { name: 'roof-and-octagonal-plan', position: [100, 317, 127], lookAt: [-10, 237, 0] },
      { name: 'north-travertine-arcade', position: [87, 10, 0], lookAt: [53, 6, 0] },
      { name: 'bronze-revolving-doors', position: [67, 5, -3], lookAt: [52, 2.4, 0] },
      { name: 'eighth-floor-terrace', position: [53, 52, 80], lookAt: [20, 33, 37] },
      { name: 'far-park-avenue', position: [-450, 138, 35], lookAt: [-8, 122, 0] },
    ],
  },
  {
    id: 'N0191',
    key: 'flame_towers',
    wikidataId: 'Q80499',
    title: 'Flame Towers',
    height: 182,
    build: buildFlame,
    mapFrame: 'map-frame.json',
    brief:
      'Three independent curved triangular glazed flames, with unequal heights, pointed swept crowns, unitized facade panels, dark maintenance slots, pale stepped retail pavilions and a glazed central atrium.',
    sourceFacts: {
      architecturalHeightsMeters: { southResidential: 182, northHotel: 165, westOffice: 161 },
      heightPrecision:
        'Rounded whole meters published by the Council on Tall Buildings and Urban Habitat; independent engineer above-ground approximations differ with local entry datum.',
      architect: 'HOK',
      facadeAndSpecialStructures: 'Werner Sobek',
      facadeDetailConsultant: 'Priedemann',
      facadeAreaSquareMeters: 64000,
      facadeSystem:
        'Four-corner story-height unitized glazing, curved surfaces optimized from the original NURBS geometry',
      podiumFloors: 3,
      primaryIdentityOverride:
        'HOK identifies south residential, north hotel and west office; inconsistent OSM hotel/commercial tags are retained in evidence, not used to swap these roles.',
      facadePose: 'Daytime; behind-glass LED media is inactive',
    },
    reconstruction: {
      plan: 'Each curved triangular tower has its own attributed mapped ring and outward crown axis. Three unequal heights and native cardinal frame retain the ensemble arrangement, without replacing the complex with a single bounding-box tower.',
      facade:
        'Dense quadrilateral panes with physical narrow metal mullions follow the curved shell. Paired dark upper maintenance slots and partial lower slots are reconstructed from completed engineer photographs. No visible diagonal triangulation or animated flame texture is baked into the geometry.',
      crown:
        'Curved pointed flicks follow a smooth vertical contraction of the mapped wing plan, with an outward apex. Their exact NURBS definition is not published in the available primary references, so sectional curvature and pane pitch remain explicit reconstructions.',
      podium:
        'The mapped common retail base has individually glazed fronts; eastern stepped stone pavilions, central barrel-glazed atrium, small curved terrace pool, west-central red cinema and north hotel canopy follow the engineer aerial photograph. Fine dimensions and elevations are photograph-derived.',
    },
    refs: [
      'https://www.hok.com/projects/view/baku-flame-towers/',
      'https://www.wernersobek.com/de/projekte/baku-flame-towers-hochhauskomplex/',
      'https://www.skyscrapercenter.com/complex/618',
      'https://global.ctbuh.org/resources/papers/download/985-innovative-and-sustainable-high-rise-facade-systems-in-asia.pdf',
      'https://priedemann.net/en/cases/stormy-windows.html',
      'https://www.dlubal.com/en/downloads-and-information/references/customer-projects/000682',
      'https://www.openstreetmap.org/way/687226634',
    ],
    nativeAxes: { up: '+Y', east: '+X', south: '+Z', front: '+X toward the eastern city frontage' },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Source-local separately mapped south residential, north hotel and west office rings retain their own centers and flame axes. The shared podium centroid is the ensemble anchor; its outline alone is not mistaken for all three tower feet. Cardinal+X east/+Z south retains HOK identities over contradictory raw map function tags. GroundY0 is a common entry reference; real hillside entry offsets and plaza grading are outside this exterior model.',
    }),
    limitations: [
      commonLimit,
      'The primary engineer describes the three shells as related NURBS/developable surfaces, but the exact control points are not available; sectional curves, unitized pane pitch, maintenance-slot levels, podium pavilion details and roof furnishings are original reconstructions from completed HOK and Werner Sobek photographs. Heights are rounded published values. The media facade is a static daytime exterior; changing LED programs, signs, interior fit-out and sloping off-site landscaping are excluded.',
    ],
    camera: { position: [340, 222, 340], lookAt: [-20, 77, -26], fov: 42 },
    qaCameras: [
      { name: 'three-distinct-flames', position: [225, 150, 185], lookAt: [-15, 85, -23] },
      { name: 'west-office-profile', position: [-238, 98, 88], lookAt: [-66, 83, -31] },
      { name: 'north-hotel-profile', position: [112, 111, -224], lookAt: [0, 84, -112] },
      { name: 'south-residential-flick', position: [85, 171, 141], lookAt: [30, 149, 66] },
      { name: 'four-corner-glazing', position: [93, 83, 72], lookAt: [30, 81, 53] },
      { name: 'paired-maintenance-slots', position: [79, 139, 98], lookAt: [31, 135, 65] },
      { name: 'shared-retail-podium', position: [125, 53, -20], lookAt: [11, 15, -23] },
      { name: 'barrel-atrium-and-pool', position: [34, 59, 14], lookAt: [-9, 13, -25] },
      { name: 'red-cinema-pavilion', position: [2, 38, -65], lookAt: [-40, 19, -66] },
      { name: 'hotel-arrival-canopy', position: [67, 14, -93], lookAt: [24, 6, -103] },
      { name: 'crown-from-above', position: [114, 233, 66], lookAt: [24, 169, 76] },
      { name: 'far-caspian-skyline', position: [485, 160, 340], lookAt: [-20, 84, -26] },
    ],
  },
  {
    id: 'N0190',
    key: '30_rockefeller_plaza',
    wikidataId: 'Q680614',
    title: '30 Rockefeller Plaza',
    height: 259.08,
    build: buildRockefeller,
    brief:
      'The 1933 RCA slab and west/NBC wings, with separately mapped elevator setbacks, recessed paired sash, ribbed aluminum spandrels, open Gothic leaf parapets, polychrome entrance reliefs and three-tier Top of the Rock crown.',
    sourceFacts: {
      architecturalHeightFeet: 850,
      architecturalHeightMeters: 259.08,
      floors: 70,
      typicalSlabToSlabMeters: 3.5052,
      architect: 'Reinhard & Hofmeister; Corbett, Harrison & MacMurray; Hood & Fouilhoux',
      exterior: 'Shot-sawn Indiana buff limestone with cast aluminum spandrels',
      centralPortalMeters: [4.2672, 11.2776],
      sidePortalMeters: [3.9624, 8.2296],
      observationGlassMeters: { width: 1.524, heightAboveDeck: 2.5908, thickness: 0.047625 },
      skyliftTravelMeters: 9.144,
      skyliftPose: 'Lowered; static exterior representation',
      beamPose: 'Lowered; seven empty seats',
    },
    reconstruction: {
      massing:
        'The exact-QID full ground outline and fourteen individual building parts preserve the eastern tall slab, elevator-bank setbacks, low midblock NBC studios and sixteen-story RCA West block. Rounded map260m height is replaced by the published850ft architectural crown.',
      facade:
        'Deep paired sash, continuous pale limestone piers and three raised ribs on each gray cast-metal spandrel follow owner and LPC photographs. Lower ridged parapets, two-eyelet east-setback leaves and four-eyelet crown leaves retain actual openings and pointed back rails.',
      entrance:
        'Three recessed eastern portals retain their different measured heights. Original faceted reconstructions represent Wisdom, Sound and Light, cloud/gold contours, the cast-glass field and bronze revolving doors. Sculpted anatomy and relief strokes are interpreted geometry, not scans.',
      roof: 'Three reconstructed observation levels have independent deck slabs, published-height clear glass guards, leaf parapets, connecting exterior steps, paired nautical vent stacks, lowered2024 west Skylift and north69F Beam. Exact equipment offsets and tier extents are photo reconstruction.',
    },
    refs: [
      'https://s-media.nyc.gov/agencies/lpc/lp/1446.pdf',
      'https://www.rockefellercenter.com/leasing/30-rockefeller-plaza',
      'https://www.rockefellercenter.com/documents/TopoftheRockTeachersGuide.pdf',
      'https://siny.org/wp-content/uploads/2008/11/ttr.pdf',
      'https://www.rockefellercenter.com/tickets/top-of-the-rock-observation-deck/skylift',
      'https://www.rockefellercenter.com/the-beam/',
      'https://thgcreative.com/thg-gallery/top-of-the-rock/',
      'https://www.openstreetmap.org/way/487519790',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact signed full ground and individual slab parts retain native+X toward eastern Rockefeller Plaza, +Z toward49th Street and -Z toward50th Street. West low block is toward Sixth Avenue. Main three portals face east; lowered Skylift sits on west70F and Beam on north69F. GroundY0 is the entry datum; adjacent rink/plaza and other Rockefeller Center buildings are excluded.',
    }),
    limitations: [
      commonLimit,
      'Intermediate map-part heights, facade bay pitch, ornamental leaf proportions, three figurative reliefs and fine rooftop equipment are reconstructed from primary photographs and documentation. Rooftop tier dimensions and equipment offsets are approximate; lowered attractions are static and unoccupied. Current tenant lettering, precise relief inscriptions, the separate rink/Prometheus complex, flagpoles and interiors are excluded.',
    ],
    camera: { position: [410, 215, 395], lookAt: [15, 126, 0], fov: 42 },
    qaCameras: [
      { name: 'east-elevator-setbacks', position: [240, 155, 112], lookAt: [30, 143, 0] },
      { name: 'north-slab-and-studios', position: [-90, 122, -218], lookAt: [0, 115, 0] },
      { name: 'recessed-ribbed-spandrels', position: [41, 150, 50], lookAt: [32, 147, 15] },
      { name: 'two-eyelet-parapets', position: [104, 194, 30], lookAt: [76, 188, 0] },
      { name: 'three-eastern-portals', position: [111, 9, 0.4], lookAt: [81, 7, 0.4] },
      { name: 'wisdom-relief-and-glass', position: [95, 9, 0.3], lookAt: [81, 7, 0.3] },
      { name: 'nbc-low-roofs', position: [-100, 76, 100], lookAt: [-35, 36, 0] },
      { name: 'three-observation-decks', position: [107, 281, 69], lookAt: [34, 252, 0] },
      { name: 'open-leaf-crown', position: [38, 258, 20], lookAt: [35, 256, 5] },
      { name: 'skylift-and-vents', position: [-2, 270, 16], lookAt: [22, 258, 0] },
      { name: 'beam-and-deck-guards', position: [30, 262, -24], lookAt: [28, 255, -6] },
      { name: 'far-rockefeller-plaza', position: [590, 150, 110], lookAt: [20, 129, 0] },
    ],
  },
  {
    id: 'N0189',
    key: 'yokohama_landmark_tower',
    wikidataId: 'Q587108',
    title: 'Yokohama Landmark Tower',
    height: 296.3,
    build: buildYokohama,
    mapFrame: 'map-frame.json',
    brief:
      'The 1993 four-corner granite tower: gently narrowing square shaft with deep recessed ribbons, creased triangular transition panels, glazed upper hotel, projecting crown piers and a recessed mechanical roof.',
    sourceFacts: {
      architecturalHeightMeters: 296.3,
      ownerRoundedHeightMeters: 296,
      occupiedFloors: 70,
      penthouseFloors: 3,
      completed: 1993,
      twentiethFloorPlanWidthMeters: 66.32,
      twentiethFloorStructuralGridMeters: [19.66, 27, 19.66],
      architect: 'The Stubbins Associates and Mitsubishi Estate (now Mitsubishi Jisho Design)',
    },
    reconstruction: {
      massing:
        'The separately mapped exact-QID tower way64891750 establishes the approximately74.9m ground envelope, excluding the adjacent mall. Mitsubishi Estate measured20F plan gives66.32m width. Original Stubbins section and architect photographs constrain the gentle taper, three transition zones and four extended corner piers.',
      facade:
        'Individual inset horizontal glazing ribbons turn through chamfered recessed sides. Heavy granite corner piers contain small slit windows; upper hotel panes and thin white bands contrast with projecting lower office spandrels. Creased triangular folded panels stand in front of modeled horizontal louvers.',
      crown:
        'Four L-shaped granite piers extend above the recessed central mechanical roof. Three thick horizontal bars bridge each recessed face below the tip. Small visible roof plant and antenna rods stay below the architectural crown height.',
      entry:
        'Tower-only glazed entries and supported shallow glass canopies sit inside the mapped tower frame; the adjacent low-rise mall and separate castle-like pavilion building are not incorporated into this asset.',
    },
    refs: [
      'https://www.mjd.co.jp/en/projects/29294/?lang=en',
      'https://office.mec.co.jp/en/search/detail/011701',
      'https://office.mec.co.jp/storage/buildings/011701/figure/011701_std_plan_01_org_a.jpg',
      'https://www.usmodernist.org/WORLD/WA-1997-61.pdf',
      'https://www.skyscrapercenter.com/yokohama/landmark-tower/547/',
      'https://www.openstreetmap.org/way/64891750',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Source-local exact-QID tower way64891750 replaces the incorrectly selected adjacent mall. Native+X points southeast and+Z southwest, matching the owner20F north arrow toward upper-left. Symmetric tower ground envelope is fitted to the four measured facade directions; narrow recess details and entries are photo reconstruction. GroundY0 is tower entry.',
    }),
    limitations: [
      commonLimit,
      'Intermediate vertical levels, smooth taper, granite panel joints, tiny slit windows, fold projection and roof plant are reconstructed from the original architect section/model and completed photographs; the measured20F plan is preserved as a separate shaft constraint. No whole-mall, adjacent pavilion, interior fit-out or survey-grade facade claim is made. Changing tenant signs and lights are excluded.',
    ],
    camera: { position: [380, 205, 400], lookAt: [0, 145, 0], fov: 42 },
    qaCameras: [
      { name: 'tapered-ribbon-facade', position: [65, 118, 105], lookAt: [0, 116, 0] },
      { name: 'granite-pier-slits', position: [64, 103, 70], lookAt: [29, 99, 29] },
      { name: 'lower-folded-panels', position: [0, 29, 67], lookAt: [0, 28, 29] },
      { name: 'middle-folded-transition', position: [0, 128, 67], lookAt: [0, 125, 25] },
      { name: 'hotel-lantern', position: [68, 245, 80], lookAt: [0, 242, 0] },
      { name: 'upper-three-folds', position: [0, 205, 59], lookAt: [0, 205, 21] },
      { name: 'four-crown-piers', position: [87, 319, 90], lookAt: [0, 286, 0] },
      { name: 'recessed-roof-plant', position: [43, 319, 39], lookAt: [0, 287, 0] },
      { name: 'ground-entry', position: [0, 12, 65], lookAt: [0, 7, 31] },
      { name: 'harbor-silhouette', position: [520, 154, 430], lookAt: [0, 145, 0] },
    ],
  },
  {
    id: 'N0188',
    key: '70_pine_street',
    wikidataId: 'Q262041',
    title: '70 Pine Street',
    height: 290.1696,
    build: build70Pine,
    brief:
      'The1932 Cities Service Building: asymmetric mapped Art Deco setbacks, individually recessed sash windows and brick spandrels, monumental portals with miniature tower portraits, decorative terrace railings and tiered glass lantern below the stainless spire.',
    sourceFacts: {
      architecturalHeightFeet: 952,
      architecturalHeightMeters: 290.1696,
      constructionYears: [1930, 1932],
      architect: 'Clinton & Russell, Holton & George',
      lanternHeightFeet: 27,
      stainlessSpireHeightFeet: 97,
      baseStreetNames: ['Pine Street', 'Cedar Street', 'Pearl Street'],
    },
    reconstruction: {
      massing:
        'Exact-QID trapezoidal base and58 separately mapped masonry/lantern/spire components preserve the asymmetric setbacks and eastern tower center. Primary LPC photographs corroborate their orientation. Map lantern datums252–264m are reduced to the primary27ft glass lantern and97ft steel spire below the952ft tip.',
      facade:
        'Inset double-hung sash, brick piers, raised vertical-over-horizontal spandrel motifs, limestone sill courses and pale upper panels follow LPC exterior photographs. The small stepped tower portraits, sunflower-like reliefs and fanned terrace rails are original geometric reconstructions.',
      entry:
        'Pine and Cedar are the long southern and northern facades; their eastern portals are taller than the western portals. The Pearl Street entrance is on the eastern short facade. Fine offsets are reconstructed around the independently mapped doors.',
    },
    refs: [
      'https://s-media.nyc.gov/agencies/lpc/lp/2441.pdf',
      'https://70pine.com/',
      'https://www.dthcapital.com/properties/70-pine-street',
      'https://www.openstreetmap.org/way/278069587',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The signed trapezoidal base and independent stepped shaft/lantern/spire positions place the tower toward Pearl Street at native+X. Native+Z is Pine Street, -Z Cedar Street. Lower entrances are represented at localY0; street slope and adjoining developments are not fabricated. The current exterior retains the1932 tower silhouette.',
    }),
    limitations: [
      commonLimit,
      'Intermediate map-part heights, individual pane pitch, fine portal relief shapes, brick colors and terrace grille rhythm are reconstructions from primary exterior documentation. Ground follows a single entry datum; the street slope, separate enclosed Pine Street footbridge, adjacent buildings, tenant signs and interior spaces are excluded. Source landmark report is2011; later replacement sash is approximated within the same openings.',
    ],
    camera: { position: [335, 208, 385], lookAt: [3, 138, 0], fov: 42 },
    qaCameras: [
      { name: 'asymmetric-setbacks', position: [-118, 101, 117], lookAt: [-13, 83, 0] },
      { name: 'mapped-shaft', position: [67, 170, 82], lookAt: [6, 170, 0] },
      { name: 'recessed-brick-bays', position: [16, 153, 48], lookAt: [6, 147, 11] },
      { name: 'terrace-fan-railings', position: [35, 236, 40], lookAt: [15, 226, 6] },
      { name: 'stepped-stone-crown', position: [35, 255, 33], lookAt: [5, 240, 0] },
      { name: 'tiered-glass-lantern', position: [24, 266, 21], lookAt: [5, 255, 0] },
      { name: 'stainless-pinnacle', position: [25, 279, 26], lookAt: [5, 276, 0] },
      { name: 'pine-east-portal', position: [6, 9, 40], lookAt: [6, 8, 18] },
      { name: 'cedar-east-portal', position: [7, 10, -41], lookAt: [6, 8, -19] },
      { name: 'pearl-street-entry', position: [68, 8, 0], lookAt: [39, 7, 0] },
      { name: 'far-east-river', position: [520, 193, 370], lookAt: [5, 137, 0] },
    ],
  },
  {
    id: 'N0176',
    key: 'u_s_bank_tower',
    wikidataId: 'Q57900',
    title: 'U.S. Bank Tower',
    height: 310.3,
    build: buildUsBank,
    brief:
      'The Los Angeles granite-and-glass tower with mapped concentric and orthogonal setbacks, individually modeled projecting triangular window bays, broad terrace belts, a sixteen-fold stone/glass crown, circular helipad and renewed glazed lobby.',
    sourceFacts: {
      heightMeters: 310.3,
      ownerStories: 72,
      architectStories: 73,
      lobbyHeightMeters: 9.144,
      architect: 'Pei Cobb Freed & Partners; Henry N. Cobb',
      structuralSetbackLevels: [47, 56, 60, 68, 72],
    },
    reconstruction: {
      massing:
        'Exact-QID whole outline and eleven independent mapped tower parts determine the signed overlapping circular/orthogonal volumes. Architect structural isometric corroborates setback sequence.',
      facade:
        'Original granite window surrounds with paired projecting glass panes and physical joints; fine bay spacing reconstructed from architect close photograph.',
      crown:
        'Sixteen folded bays and circular landing roof reconstructed from architect axonometric and close photographs; current owner establishes rooftop use and new entrance.',
    },
    refs: [
      'https://www.pcf-p.com/projects/us-bank-tower-formerly-library-tower/',
      'https://www.silversteinproperties.com/portfolio-properties/us-bank-tower',
      'https://www.skyscrapercenter.com/building/id/445',
      'https://www.openstreetmap.org/way/23973401',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Signed mapped whole outline and all eleven adjoining tower parts retain the different setback directions, including the long eastern/western curves. Fifth Street entrance is on the southwest side toward the library. GroundY0 is the lower Fifth Street entry; surrounding Bunker Hill Steps and uphill terrain remain separate site context.',
    }),
    limitations: [
      commonLimit,
      'Individual granite panel pitch, triangular window projection and entrance canopy are reconstructed from primary photographs. Tenant lettering, current rooftop branding and rooftop service furniture are omitted. Separate Bunker Hill stairs/landscape are outside the tower footprint; interior spaces are not modeled.',
    ],
    camera: { position: [258, 222, 445], lookAt: [0, 145, 0], fov: 44 },
    qaCameras: [
      { name: 'folded-crown', position: [51, 324, 63], lookAt: [0, 298, 0] },
      { name: 'triangular-bays', position: [54, 118, 51], lookAt: [18, 110, 11] },
      { name: 'stepped-volumes', position: [-90, 257, 114], lookAt: [0, 238, 0] },
      { name: 'fifth-street-lobby', position: [-72, 16, -6], lookAt: [-24, 6, -1.5] },
      { name: 'helipad', position: [36, 354, 46], lookAt: [0, 309, 0] },
      { name: 'far-silhouette', position: [-365, 280, 610], lookAt: [0, 149, 0] },
    ],
  },
  {
    id: 'N0177',
    key: '40_wall_street',
    wikidataId: 'Q218305',
    title: '40 Wall Street',
    height: 282.5496,
    build: build40Wall,
    brief:
      'The Manhattan Company tower with its mapped L-shaped base and asymmetric setbacks, great limestone street colonnades, buff-brick window piers, ornamental upper stories, four Gothic wall dormers, standing-seam green copper pyramid and octagonal spire.',
    sourceFacts: {
      heightFeet: 927,
      heightMeters: 282.5496,
      landmarkStories: 71,
      completionYear: 1930,
      architect: 'H.Craig Severance, Yasuo Matsui and Shreve & Lamb',
      wallStreetSetbackFloors: [17, 19, 21, 26, 33, 35],
      pineStreetSetbackFloors: [12, 19, 23, 26, 28, 29],
      roofStories: 7,
    },
    reconstruction: {
      massing:
        'Exact-QID L-shaped outline and twenty-four separately mapped building parts preserve the unequal pavilions, recessed light courts and stepped shaft. Mapped copper-roof geometry provides its signed rectangular orientation.',
      facade:
        'LPC measured drawings and close exterior photographs establish the giant limestone colonnades, fluted piers, seventh-floor roundels, darker brick spandrels and contrasting upper terracotta decoration.',
      roof: 'Four standing-seam pyramid faces with small roof windows, two-story central Gothic wall dormers, parapet pinnacles and two-stage copper lantern are reconstructed from the LPC roof/spire photograph.',
    },
    refs: [
      'https://s-media.nyc.gov/agencies/lpc/lp/1936.pdf',
      'https://40wallstreet.com/',
      'https://www.openstreetmap.org/way/278042253',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID L-shaped footprint and separate building parts preserve the Wall Street south facade, longer asymmetric Pine Street pavilion and shaft east of the overall plot center. Roof part286057109 determines the signed square copper-pyramid frame. GroundY0 follows the street-level bank base.',
    }),
    limitations: [
      commonLimit,
      'The exterior geometry follows mapped setback heights and LPC original elevations/photos. Fine terracotta relief, window replacement variation, roof seams and spire profiles are reconstructed; tenant lettering, individual mechanical fittings and flags are omitted. Published927ft height includes the final finial/pole envelope.',
    ],
    camera: { position: [280, 230, 430], lookAt: [4, 133, 0], fov: 43 },
    qaCameras: [
      { name: 'copper-pyramid', position: [55, 259, 73], lookAt: [11.65, 250, -0.27] },
      { name: 'gothic-dormers', position: [48, 226, 63], lookAt: [12, 224, 0] },
      { name: 'brick-setbacks', position: [-92, 130, 86], lookAt: [-5, 105, 0] },
      { name: 'wall-street-colonnade', position: [14, 21, 82], lookAt: [12, 17, 28] },
      { name: 'pine-street-colonnade', position: [-18, 23, -92], lookAt: [-9, 17, -28] },
      { name: 'spire-lantern', position: [28, 278, 33], lookAt: [11.65, 269, -0.27] },
      { name: 'far-silhouette', position: [-370, 265, 530], lookAt: [2, 133, 0] },
    ],
  },
  {
    id: 'N0178',
    key: 'merdeka_118',
    wikidataId: 'Q7969454',
    title: 'Merdeka118',
    height: 678.9,
    build: buildMerdeka,
    brief:
      'The Kuala Lumpur crystalline supertall with its clipped diamond plan, independently glazed triangular facade planes, offset angular160.4m spire, stepped observation crown, dense floor/panel grid and folded metal atrium canopies with V supports.',
    sourceFacts: {
      heightMeters: 678.9,
      externalSpireMeters: 160.4,
      structuralSpireMeters: 169,
      externalSpireBaseMeters: 518.5,
      storeys: 118,
      officeLevels: [8, 96],
      hotelLevels: [98, 112],
      observationLevels: [115, 116],
      architect: 'Fender Katsalidis with RSP Architects',
      engineer: 'Leslie E.Robertson Associates; Arup; Robert Bird Group',
      outriggerLevels: [
        [40, 43],
        [75, 78],
        [113, 116],
      ],
      completionYear: 2023,
    },
    reconstruction: {
      plan: 'The exact-QID mapped rhombus retains its signed frame. Completed architect sky-lobby and engineer typical-floor plans corroborate the clipped diamond and distinguish its long diagonal from the minimum-rectangle edge axis. Both acute ends are clipped in the occupied shaft; the separately mapped mast fixes the north-eastern crown corner.',
      facade:
        'Large inclined triangular planes, alternating blue/cyan glass facets, physical mullion strips and continuous diagonal edge ribs reconstruct the architect’s completed-building north elevation and daytime close photographs. Old construction-era OSM125/250/375/500/550/635m tags are deliberately not used as final vertical dimensions.',
      crown:
        'Completed PAM2025 close views establish the asymmetric flat glass upper face, diagonal returns, lower observation terrace and slender angular metal spire. Published678.9m total and160.4m external spire set the current vertical envelope;169m structural spire includes embedded structure.',
      entry:
        'Glazed low atrium, warm stone columns, broad folded metal canopy and paired V struts follow the architect’s current exterior photograph. Canopy projection and exact pane schedule are photo reconstructions.',
    },
    refs: [
      'https://www.pam.org.my/images/publications/am2025/37-1/AM37.1.pdf',
      'https://revistaalconpat.org/index.php/RA/article/download/808/2360/',
      'https://www.arup.com/en-us/projects/merdeka-118/',
      'https://news.samsungcnt.com/en/features/engineering-construction/2024-09-merdeka-118-an-engineering-marvel-and-the-worlds-second-tallest-building/',
      'https://www.openstreetmap.org/way/645604854',
      'https://www.openstreetmap.org/way/629116778',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID whole outline and independently mapped north-eastern mast preserve the signed site frame. Native+X follows the minimum rectangle edge, not the diamond’s long diagonal. The primary architect plan and southward/northward photographs corroborate the diamond geometry, StadiumNegara east and StadiumMerdeka south. Completed678.9m height replaces obsolete construction-era map heights. SourceY0 is tower entry level; separate mall and podium landscaping remain separate site context.',
    }),
    limitations: [
      commonLimit,
      'Fine facade fold offsets, pane pitch, canopy dimensions, maintenance plant and mast skin divisions are reconstructed from completed architect/engineer exterior references. The geometric glass facade is an opaque PBR approximation; separate118Mall, park, service roads, below-grade spaces and rooftop moving equipment are excluded. The mapped2021 building-part heights are retained as attributed history and are not treated as as-built measurements.',
    ],
    camera: { position: [590, 400, 850], lookAt: [5, 322, 0], fov: 43 },
    qaCameras: [
      { name: 'crystal-crown', position: [108, 533, 144], lookAt: [17, 489, 8] },
      { name: 'angular-spire', position: [91, 625, 119], lookAt: [30, 607, 16] },
      { name: 'diagonal-facets', position: [-106, 289, 155], lookAt: [-4, 268, 7] },
      { name: 'north-facade', position: [165, 263, -81], lookAt: [12, 263, -2] },
      { name: 'folded-atrium', position: [-64, 21, -77], lookAt: [-13, 13, -17] },
      { name: 'roof-plant', position: [78, 578, 96], lookAt: [16, 511, 8] },
      { name: 'mast-corner', position: [61, 529, 59], lookAt: [29, 523, 15] },
      { name: 'stadium-approach', position: [-310, 100, -185], lookAt: [2, 210, 1] },
      { name: 'far-silhouette', position: [-910, 553, 960], lookAt: [4, 321, 0] },
    ],
  },
  {
    id: 'N0179',
    key: 'tuntex_sky_tower',
    wikidataId: 'Q337631',
    title: '85 Sky Tower (Tuntex)',
    height: 378,
    build: buildTuntex,
    brief:
      'Kaohsiung’s two-pronged tower with its real through-aperture, raised pink podium and ground passage, pale projecting glazed panels, main elevated shaft, curved Chinese crown lines, layered hip roof and ringed white antenna.',
    sourceFacts: {
      architecturalHeightMeters: 347.5,
      tipHeightMeters: 378,
      occupiedHeightMeters: 341,
      storeys: 85,
      basementStoreys: 5,
      completionYear: 1997,
      architect: 'C.Y.Lee & Partners with HOK',
      engineer: 'Evergreen Consulting Engineering; T.Y.Lin International',
      mappedPodiumMeters: 50,
      mappedApertureSillMeters: 70,
      mappedApertureSoffitMeters: 145,
      mappedProngEnvelopeMeters: 190,
    },
    reconstruction: {
      massing:
        'Exact-QID rectangular podium and six independently mapped parts establish the two lower legs, central70m sill, elevated145m main shaft and separate hip roof and mast. The middle is genuinely open from the aperture sill to the transfer soffit, with no full-height central extrusion.',
      facade:
        'Six original architect photographs establish dark teal primary glazing, paler projecting lower rectangles, pink relief frames, horizontal service bands, repeated narrow panes and framed upper-shaft panels. The podium retains horizontal ribbon windows and a central ground passage.',
      crown:
        'Upturned/scalloped parapet edges, layered green hip roof and white ringed antenna are reconstructed from the architect’s harbor and elevated photographs.347.5m architectural roof and378m antenna tip remain separate measurements.',
    },
    refs: [
      'https://www.cylee.com/project/T-C-Tower?lang=tw',
      'https://www.skyscrapercenter.com/building/85/338',
      'https://www.openstreetmap.org/way/34170948',
      'https://www.openstreetmap.org/way/344740874',
      'https://www.openstreetmap.org/way/345038767',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      featureIds: [
        'way/34170948',
        'way/344740871',
        'way/344740872',
        'way/344740873',
        'way/344740874',
        'way/345038766',
        'way/345038767',
      ],
      notes:
        'Signed exact-QID podium and independently mapped two prongs, raised central shaft, sill, roof and antenna retain the harbor-facing wide aperture. Native+X is the long podium/prong-separation axis; opposite broad faces retain the architect-photographed matching facade composition. GroundY0 is street entry; mapped component heights are distinguished from CTBUH’s347.5m roof and378m tip.',
    }),
    limitations: [
      commonLimit,
      'Curved parapet profile, individual mullion spacing, projecting panel relief, canopy/door details and roof plant are reconstructed from six architect photographs. Mapped lower-part heights are approximate. Tenant lettering, the precise roof equipment inventory, illumination animation and interior atria are excluded.',
    ],
    camera: { position: [260, 270, 515], lookAt: [0, 180, 0], fov: 43 },
    qaCameras: [
      { name: 'central-aperture', position: [0, 121, 158], lookAt: [0, 116, 0] },
      { name: 'pagoda-crown', position: [77, 360, 94], lookAt: [0, 338, 0] },
      { name: 'lower-prongs', position: [98, 189, 148], lookAt: [25, 165, 4] },
      { name: 'projecting-glass', position: [66, 116, 104], lookAt: [35, 106, 34] },
      { name: 'pink-podium', position: [92, 38, 133], lookAt: [24, 25, 24] },
      { name: 'ground-passage', position: [0, 9, 82], lookAt: [0, 4, 12] },
      { name: 'roof-service', position: [-94, 238, 113], lookAt: [-43, 186, 4] },
      { name: 'far-harbor-face', position: [0, 221, 750], lookAt: [0, 174, 0] },
    ],
  },
  {
    id: 'N0180',
    key: 'al_hamra_tower',
    wikidataId: 'Q557933',
    title: 'Al Hamra Tower',
    height: 412.6,
    build: buildHamra,
    brief:
      'Kuwait’s sculpted tower with a fixed rounded glass envelope, southwest-to-southeast moving courtyard cut, two continuous limestone flares, deep angled south-wall windows, sloping east blade and24m lamella-framed north entrance.',
    sourceFacts: {
      heightMeters: 412.6,
      occupiedHeightMeters: 351.2,
      completionYear: 2011,
      architect: 'Skidmore, Owings & Merrill',
      designDirector: 'Aybars Asci',
      engineer: 'Skidmore, Owings & Merrill',
      designerStoreys: 74,
      ctbuhStoreys: 80,
      typicalFloorHeightMeters: 4.2,
      lobbyHeightMeters: 24,
      topHallHeightMeters: 40,
      cladding: 'Jura limestone and trencadis',
      primaryDiagramCutLevelsMeters: [0, 75, 150, 225, 300],
    },
    reconstruction: {
      massing:
        'The architect’s published five sections establish a fixed filleted square with the removed quarter moving from southwest at ground level to southeast at the top. The model reconstructs that moving cut and its two ruled stone walls rather than rotating the entire tower.',
      facade:
        'Completed SOM exterior photographs establish blue north/east/west glazing, thin horizontal metal rails, a warm limestone south wall and small deeply splayed openings. The eighty-row aperture schedule and detailed reveal depths are photograph reconstructions.',
      crown:
        'The east-facing blade reaches412.6m while the western edge is lower. A closed inclined roof follows the same concave outline; the40m upper hall is represented by its exterior envelope.',
      entry:
        'Primary lobby plan and photographs establish the northern entrance,24m inclined lamella structure and curved metal canopy supports. The separate southern shopping mall and eastern parking block are excluded.',
    },
    refs: [
      'https://www.som.com/projects/al-hamra-tower/',
      'https://efficiencylab.org/media/EL-Portfolio-1.pdf',
      'https://usmodernist.org/AR/AR-2012-05.pdf',
      'https://www.skyscrapercenter.com/building/building/208',
      'https://www.openstreetmap.org/way/188381326',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The exact-QID OSM rectangle fixes the60.019×58.619m envelope and signed frame. The north arrows in the architect-credited lobby/site plans match this frame: native+Z is the southern stone/courtyard side, +X the east side with the high blade. The primary five-section sequence independently fixes the southwest-to-southeast cut phase. SourceY0 is tower entry; adjoining mall and parking structure remain separate assets.',
    }),
    limitations: [
      commonLimit,
      'The coarse mapped rectangle is an envelope, not a curved occupied floor plate. Fillet radii, intermediate cut curves, roof slope, individual stone/glass panel schedule and canopy dimensions are reconstructed from primary plans and completed photographs. Fine trencadis mosaic tesserae use the shared limestone surface at physical scale; tenant lettering, interiors and the separate retail/parking complex are excluded. The architect counts74 floors while CTBUH counts80; exterior height follows their shared412.6m figure.',
    ],
    camera: { position: [300, 290, 530], lookAt: [0, 198, 0], fov: 43 },
    qaCameras: [
      { name: 'south-courtyard', position: [0, 205, 180], lookAt: [0, 194, 6] },
      { name: 'angled-stone-windows', position: [21, 193, 68], lookAt: [4, 188, 2] },
      { name: 'western-flare', position: [-86, 123, 92], lookAt: [-17, 126, 9] },
      { name: 'eastern-blade', position: [90, 391, 106], lookAt: [18, 380, 7] },
      { name: 'sloping-crown', position: [-93, 467, 121], lookAt: [0, 384, -3] },
      { name: 'north-lamella', position: [-32, 17, -88], lookAt: [-3, 12, -28] },
      { name: 'curved-canopy', position: [29, 12, -65], lookAt: [0, 6, -36] },
      { name: 'glass-perimeter', position: [-95, 213, -116], lookAt: [-13, 208, -22] },
      { name: 'far-silhouette', position: [-520, 300, 675], lookAt: [0, 194, 0] },
    ],
  },
  {
    id: 'N0181',
    key: 'central_plaza',
    wikidataId: 'Q112640',
    title: 'Central Plaza',
    height: 374.3,
    build: buildCentralPlaza,
    brief:
      'Hong Kong’s three-sided gold-and-silver tower with mapped reentrant corners, an open base of green granite columns, ceramic-frit cat-scratch facade patterns, stepped mechanical crown, triangular glazed observation pyramid and open three-legged mast support.',
    sourceFacts: {
      heightMeters: 374.3,
      operatorHeightFeet: 1228,
      completionYear: 1992,
      architect: 'Ng Chun Man & Associates',
      engineer: 'Ove Arup & Partners',
      groundDatumMetersPD: 4.1,
      baseHeightMeters: 30.5,
      skyLobbyTopMeters: 172.3,
      mainTowerTopMeters: 265.9,
      observationGalleryMeters: 288.4,
      roofApexMeters: 310.3,
      featureFrameTopMeters: 330.65,
      mastAboveRoofMeters: 64,
      mastMaximumDiameterMeters: 1.6,
      baseColumnDiameterMeters: 2.8,
      typicalFloorMeters: 3.6,
      roofGlassPaneMeters: [2, 1.5],
      operatorStoreys: 75,
    },
    reconstruction: {
      massing:
        'Exact-QID whole footprint and eight separate mapped crown/roof/mast parts preserve the triangular shaft, reentrant corner offices and three smaller top terraces. Arup’s elevation supplies ground-relative heights by subtracting4.1mPD; map height309m is a roof-era envelope and does not set the final mast tip.',
      facade:
        'Owner specification and original engineer photographs establish gold and silver coated glass, ceramic-frit cat scratches, metallic horizontal spandrels and green granite columns. Fine pane spacing and scratch-zone heights are reconstructed from those photographs.',
      crown:
        'Three independently mapped triangular glass roof faces meet at the separately mapped central mast. The feature frame has three corner legs, sloping upper struts and an open Vierendeel support with four daylight Lightime band housings. Engineer64m mast above the roof and maximum1.6m base diameter determine its proportions.',
      entry:
        'Eighteen green-granite round base columns support the transfer band around an inset glazed lobby and first-floor circulation balcony. The separately adjoining30.5m podium, landscape and external pedestrian bridges are outside this tower asset.',
    },
    refs: [
      'https://www.centralplaza.com.hk/wp-content/uploads/2025/07/Technical-Fitting-out-Guides-CP-MK-FRD010-Rev.8.pdf',
      'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-1993-issue-4.pdf',
      'https://www.centralplaza.com.hk/',
      'https://www.openstreetmap.org/way/27087018',
      'https://www.openstreetmap.org/way/1047690918',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      featureIds: ['way/27087018', ...Array.from({ length: 8 }, (_, i) => `way/${1047690911 + i}`)],
      notes:
        'The exact signed truncated-triangular footprint and separate crown, roof and central mast parts preserve its compass phase. The owner explicitly places the broad southern face toward Gloucester Road, northwest face toward Central and northeast face toward TsimShaTsui; this corroborates native+Z southern frontage and northern clipped corner. SourceY0 is the published4.1mPD street datum, not sea level. Final tip378.4mPD−4.1mPD=374.3m follows the original engineer.',
    }),
    limitations: [
      commonLimit,
      'Individual glass-pane pitch, ceramic-frit stripe proportions, bronze edge sizes, lobby glazing, mast taper and antenna collars are reconstructed from owner/engineer references. Four Lightime housings are represented in daylight without time-driven lighting. The adjoining podium, gardens, external pedestrian bridges, interior artwork and fine tenant lettering are excluded. Published owner1228ft is rounded; the engineer’s explicit ground/tip datums yield374.3m.',
    ],
    camera: { position: [280, 240, 515], lookAt: [0, 173, 4.8], fov: 43 },
    qaCameras: [
      { name: 'observation-pyramid', position: [55, 317, 86], lookAt: [0, 297, 5] },
      { name: 'three-legged-frame', position: [30, 338, 42], lookAt: [0, 316, 4.8] },
      { name: 'lightime-mast', position: [20, 354, 29], lookAt: [0, 338, 4.8] },
      { name: 'cat-scratch-facade', position: [0, 218, 128], lookAt: [0, 215, 27.4] },
      { name: 'corner-offices', position: [-90, 110, 89], lookAt: [-25, 101, 18] },
      { name: 'green-granite-columns', position: [67, 18, 88], lookAt: [9, 14, 23] },
      { name: 'open-lobby', position: [0, 10, 71], lookAt: [0, 9, 17] },
      { name: 'mechanical-steps', position: [-66, 281, 98], lookAt: [0, 276, 4] },
      { name: 'far-harbor-silhouette', position: [-415, 260, -560], lookAt: [0, 173, 4.8] },
    ],
  },
  {
    id: 'N0182',
    key: '23_marina',
    wikidataId: 'Q216264',
    title: '23 Marina',
    height: 392.4,
    build: build23Marina,
    brief:
      'Dubai’s white-and-blue octagonal residential tower with mapped offset shaft, three facade zones,48 triangular duplex balconies with plunge basins, an open four-canopy crown, slender capped mast and decorated fan/lattice podium.',
    sourceFacts: {
      architecturalHeightMeters: 392.4,
      architectRoundedHeightMeters: 393,
      occupiedHeightMeters: 313.5,
      aboveGroundFloors: 88,
      basements: 4,
      completionYear: 2012,
      architect: 'Architect Hafeez Contractor; KEO International Consultants',
      engineer: 'CBM Engineers; KEO International Consultants',
      owner: 'Hircon International',
      duplexApartments: 48,
      lobbyStoreys: 6,
    },
    reconstruction: {
      massing:
        'Exact-QID podium plus independent exact-QID octagonal tower and circular mast outlines preserve the shaft’s offset within its base. Current CVU392.4m architectural/tip and313.5m occupied heights override inconsistent39/393/395m map values; the architect rounds total height to393m.',
      facade:
        'Eight original architect photographs establish white vertical frames, deep blue glazing, broad intermediate belts and the different upper-duplex facade. Four cardinal facets each carry twelve triangular projecting terraces with physical slabs, glass guards and shallow static plunge basins.',
      crown:
        'The completed architect close photographs show four pale triangular canopies alternating with open steel-braced slots, above a blue glazed lower taper. The model preserves those openings around the central slender white mast and its small pyramidal cap.',
      entry:
        'The architect’s close street photograph establishes the gray stone frame, interlocking rosette screens, large white fan ribs, slanted blue glazing and upper W braces. Lobby fit-out, planting and signage are outside the exterior geometry.',
    },
    refs: [
      'https://www.hafeezcontractor.com/projects/23-marina-dubai',
      'https://www.skyscrapercenter.com/building/23-marina/247',
      'https://www.openstreetmap.org/way/186351097',
      'https://www.openstreetmap.org/way/907717855',
      'https://www.openstreetmap.org/way/186351102',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      featureIds: ['way/186351097', 'way/907717855', 'way/186351102'],
      notes:
        'Signed exact-QID podium and independent octagonal shaft/mast retain their offset and compass frame. The diagonal broad glazed facets alternate with cardinal balcony facets as in the completed architect photographs. The street entry is reconstructed on the northern native podium frontage; exact door position is photo-based, not separately mapped. SourceY0 is street level and392.4m final height follows the current CVU record.',
    }),
    limitations: [
      commonLimit,
      'Intermediate belts, crown heights, balcony depth, individual pane schedule, podium rosette/fan spacing and mast collars are reconstructed from the architect’s completed exterior photographs. The tiny plunge pools are static shallow exterior basins; no pool simulation, interiors, lettering or landscape is included. Street-door position is a photograph reconstruction. The architect’s introductory380m wording is an early figure; its final factbox says393m and current CVU records392.4m.',
    ],
    camera: { position: [260, 250, 520], lookAt: [-4.6, 187, -1.5], fov: 43 },
    qaCameras: [
      { name: 'open-canopy-crown', position: [63, 371, 87], lookAt: [-4.6, 346, -1.5] },
      { name: 'mast-cap', position: [11, 399, 20], lookAt: [-4.6, 383, -1.5] },
      { name: 'duplex-triangles', position: [-4.6, 272, 91], lookAt: [-4.6, 260, 20] },
      { name: 'plunge-balconies', position: [-22, 294, 59], lookAt: [-4.6, 286, 23] },
      { name: 'facade-belts', position: [74, 163, 97], lookAt: [2, 164, 11] },
      { name: 'podium-fan-screens', position: [8, 8, -61], lookAt: [1, 7, -27] },
      { name: 'slanted-lobby', position: [54, 22, -55], lookAt: [9, 19, -14] },
      { name: 'rosette-detail', position: [15, 8, -38], lookAt: [15, 8, -27] },
      { name: 'far-silhouette', position: [-440, 280, 630], lookAt: [-4.6, 188, -1.5] },
    ],
  },
  {
    id: 'N0183',
    key: 'lotte_world_tower',
    wikidataId: 'Q494895',
    title: 'Lotte World Tower',
    height: 555.7,
    build: buildLotte,
    mapFrame: 'map-frame.json',
    brief:
      'Seoul’s curved pale-glass tower with independently mapped taper contours, twin recessed seams, physical projecting white fins, open split diagrid ears, maintenance platforms and the11m Sky Bridge at541m.',
    sourceFacts: {
      architecturalHeightMeters: 554.5,
      tipHeightMeters: 555.7,
      occupiedHeightMeters: 497.6,
      storeys: 123,
      basements: 6,
      completionYear: 2017,
      architect: 'Kohn Pedersen Fox Associates',
      engineer: 'Leslie E.Robertson Associates',
      skyBridgeMeters: 11,
      skyBridgeHeightMeters: 541,
      baseSupercolumnCount: 8,
      baseSupercolumnMeters: [3.3, 3.3],
    },
    reconstruction: {
      massing:
        'A separately mapped tower base and seven independent level contours reconstruct the curved changing plan. Their floor tags establish relative taper sequence; approximate vertical section datums are reconstructed from the completed architect section and photographs rather than applying obsolete skillion roof tags.',
      facade:
        'Architect daytime close views establish pale blue glazing, dense projecting white fins and recessed seams with horizontal mechanical louvres. Physical panes, mullions, fins and vent strips follow each changing contour.',
      crown:
        'The two independent554.5m ear footprints preserve the open split and folded inner returns. Completed architect close photographs establish white open fins, large tubular diagonals, service platforms and access stairs. The architect gives an11m bridge at541m; its flat grating deck and undercurved suspension cables remain separate geometry.',
      entry:
        'The eight3.3m square supercolumns follow the engineer’s published dimensions behind the lower glazed enclosure. Fine entrance-door spacing is reconstructed; the adjacent mall is excluded.',
    },
    refs: [
      'https://www.kpf.com/project/lotte-world-tower',
      'https://www.structuremag.org/article/structural-innovations-of-lotte-world-tower/',
      'https://www.skyscrapercenter.com/building/lotte-world-tower/88',
      'https://www.kpf.com/news/sky-bridge-opens-at-lotte-world-tower-541-meters-above-seoul',
      'https://seoulsky.lotteworld.com/enjoy/skyBridge',
      'https://cablebridge.com/portfolio/item/lotte-tower-skybridge/',
      'https://www.openstreetmap.org/way/914963586',
      'https://www.openstreetmap.org/way/635073469',
      'https://www.openstreetmap.org/way/635073470',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The named containing tower relation and exact-QID node establish identity despite the parent relation’s erroneous mall QID. Source-local base and separate crown ears retain their signed frame: native+X follows the northwest seam toward historic Seoul, as KPF states; +Z is the northeastern ear. The large neighboring mall is excluded. SourceY0 is the tower ground entrance. Fine taper heights are photo/section reconstructions;554.5m architectural skin and555.7m small antenna tips follow the current CVU record.',
    }),
    limitations: [
      commonLimit,
      'Intermediate section heights, fine fin/pane pitch, vent schedule, service-platform/diagrid arrangements and entry-door spacing are reconstructed from completed primary exterior photographs and the architect section. Mapped2021 parts preserve plan evidence but their absent lower datums and exaggerated skillion roof heights are not as-built measurements. The adjacent mall, landscape, interiors and changing signage are excluded. Sky Bridge is static and its safety cables are simplified exterior geometry.',
    ],
    camera: { position: [485, 350, 760], lookAt: [0, 268, 0], fov: 43 },
    qaCameras: [
      { name: 'split-crown', position: [95, 547, 17], lookAt: [0, 530, 0] },
      { name: 'sky-bridge', position: [29, 547, 9], lookAt: [0, 541, 0] },
      { name: 'open-diagrid', position: [-39, 535, 41], lookAt: [-1, 532, 9] },
      { name: 'crown-catwalks', position: [27, 524, -2], lookAt: [0, 522, -5] },
      { name: 'white-fins', position: [76, 252, 59], lookAt: [26, 250, 24] },
      { name: 'mechanical-seam', position: [104, 334, 8], lookAt: [33, 330, 0] },
      { name: 'curved-glass-base', position: [91, 17, 83], lookAt: [21, 12, 26] },
      { name: 'ground-entry', position: [89, 8, 10], lookAt: [44, 3, 0] },
      { name: 'ear-tips', position: [28, 579, 31], lookAt: [0, 551, 1] },
      { name: 'far-seoul-seam', position: [885, 415, 85], lookAt: [0, 266, 0] },
    ],
  },
  {
    id: 'N0184',
    key: 'rose_tower',
    wikidataId: 'Q648338',
    title: 'Rose Rayhaan by Rotana',
    height: 333,
    build: buildRose,
    brief:
      'Dubai’s slender four-lobed blue-glass hotel with silver vertical recesses, physical gold eye rings and cornices, four curved silver crown petals, crossing tip ribbons, a sphere and offset northeast spire.',
    sourceFacts: {
      architecturalHeightMeters: 333,
      occupiedHeightMeters: 237.1,
      operatorStoreys: 72,
      cvuStoreys: 71,
      architect: 'Khatib & Alami',
      engineer: 'Khatib & Alami',
      contractor: 'Arabian Construction Company',
      completionYear: 2007,
    },
    reconstruction: {
      massing:
        'The exact-QID footprint supplies the narrow rectangular site envelope. Four intersecting convex glass lobes reconstruct the paired curved bays visible in the operator’s completed-building aerial photograph; the map rectangle is not extruded as the tower facade.',
      facade:
        'Operator daytime photographs and the facade-access contractor establish blue/silver mirrored glass, narrow gold rings and gold cornices. Repeated glass panes, thin physical frames, inset strips and elliptical gold ornament remain geometry at metric scale.',
      crown:
        'The current operator aerial establishes four silver tapering petals bordered by pale ribs, neighboring black/white horizontal bands, interlaced tip ribbons, a sphere and offset mast. Intermediate crown heights and curve profiles are photo reconstructions within the verified333m final envelope.',
      entry:
        'The southwest road-facing entry has a small canopy and glazed door bays. Fine canopy/door dimensions are approximate; adjacent neighboring towers and rear parking remain separate map context.',
    },
    refs: [
      'https://www.rotana.com/rayhaanhotelandresorts/unitedarabemirates/dubai/roserayhaanbyrotana',
      'https://www.manntech.com/project/the-rose-rayhaan-by-rotana/',
      'https://gxulighting.com/product/rose-rayhaan-hotel-by-rotana-2/',
      'https://www.skyscrapercenter.com/building/wd/369',
      'https://www.openstreetmap.org/way/64890199',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The exact-QID footprint retains its signed frame. Native-X faces southwest to Sheikh Zayed Road; +X is northeast. The operator aerial looks southeast along the road with Burj Khalifa beyond, fixing the offset mast behind the northeast crown petal. SourceY0 is the street entry;333m follows the operator and CVU rather than the map’s315m roof envelope. Fine mast offset and entry canopy are reconstructed from exterior imagery.',
    }),
    limitations: [
      commonLimit,
      'The map provides a rectangular envelope rather than a surveyed lobed plan. Curve radii, petal shapes, intermediate roof heights, fine glazing schedule, gold rings and entry canopy are reconstructed from operator/contractor exterior references. Moving facade access equipment, animated lighting, hotel branding and interiors are excluded. CVU counts71 floors while the operator describes72; the model follows their shared333m architectural height.',
    ],
    camera: { position: [-245, 218, -465], lookAt: [0, 157, 0], fov: 42 },
    qaCameras: [
      { name: 'silver-petal-crown', position: [-45, 287, -73], lookAt: [0, 278, 0] },
      { name: 'crown-sphere', position: [22, 323, -30], lookAt: [0, 311, 0] },
      { name: 'offset-spire', position: [25, 332, 20], lookAt: [5.7, 319, 0] },
      { name: 'gold-cornice', position: [-41, 247, -44], lookAt: [-7, 243, -7] },
      { name: 'gold-eye-rings', position: [39, 135, 6], lookAt: [11, 132, 0] },
      { name: 'paired-convex-bays', position: [48, 168, 53], lookAt: [5, 166, 5] },
      { name: 'street-entry', position: [-38, 9, -18], lookAt: [-13, 3, 0] },
      { name: 'lower-ribbon-glass', position: [-40, 27, 38], lookAt: [-7, 20, 8] },
      { name: 'far-sheikh-zayed', position: [-530, 236, -260], lookAt: [0, 157, 0] },
    ],
  },
  {
    id: 'N0185',
    key: 'china_media_group_guanghua_road_office_area',
    wikidataId: 'Q754321',
    title: 'CCTV Headquarters',
    height: 234,
    build: buildCctv,
    brief:
      'Beijing’s continuous cranked loop: two independently leaning towers, opposite ground and suspended L connections, sloped crown, irregular physical diagonal bracing, dense curtain wall, viewing portholes, broadcast dishes and helipad.',
    sourceFacts: {
      heightMeters: 234,
      towerLeanDegreesEachAxis: 6,
      overhangUndersideMeters: 162,
      architectCantileverMeters: 75,
      engineer: 'Arup',
      architect: 'OMA',
      completionYear: 2012,
    },
    reconstruction: {
      massing:
        'Two 6-degree lean components in opposite directions are united with the northeastern ground L and southwestern upper L. The upper connection starts at the engineer’s162m underside. Exact-QID map projection establishes the signed axes and outer envelope, but its simplified projected tower rectangles are not treated as ground footprints.',
      roof: 'Completed OMA photographs establish a continuous roof slope descending from northwest to southeast. A reconstructed plane retains the234m overall envelope including helipad; the short tower has approximately194–210m sloping roof elevations. The differing reported short-tower datums are retained as a limit rather than flattening the whole roof.',
      facade:
        'Physical blue-grey glass panes and fine vertical/horizontal joints are overlaid with continuous dark diamond braces. Selected cells at base and cantilever junctions are subdivided to reflect the denser structural grid shown in the original engineer elevation and completed photographs; this is a reconstructed pattern, not a structural member schedule.',
      equipment:
        'OMA photographs establish the circular helipad, podium satellite dishes and circular glass viewing windows underneath the overhang. Equipment dimensions and precise counts/offsets are photographed reconstructions; no interior rooms are included.',
    },
    refs: [
      'https://www.oma.com/projects/cctv-headquarters',
      'https://www.arup.com/en-us/projects/china-central-television-headquarters/',
      'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2005-issue-2.pdf',
      'https://www.arup.com/globalassets/downloads/arup-journal/the-arup-journal-2008-issue-2.pdf',
      'https://www.istructe.org/structural-awards/projects/2013/china-central-television-new-headquarters/',
      'https://www.openstreetmap.org/relation/7820447',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID projected outer envelope supplies the signed frame: +X north, +Z east. Independent map parts place the tall tower northwest, the lower tower southeast, ground L northeast and elevated L southwest. Only reconstructed tower feet and northeastern podium touch Y0; the projected cantilever is kept at162m. The mapped60m-square tower rectangles are approximate projections, not surveyed contact footprints. Ground contacts are reconstructed within the mapped overall envelope using the primary lean and exterior drawings.',
    }),
    limitations: [
      commonLimit,
      'Footprint contact rectangles, common sloping roof plane, curtain-wall bay pitch, fine diagonal density schedule, entry canopy and equipment locations are reconstructed from primary completed photographs and engineer diagrams. The cached map parts are coarse projected envelopes. The separate TVCC, media park, landscape and below-grade studios are excluded. The underside glass windows are opaque exterior glazing without interior rooms.',
    ],
    camera: { position: [-365, 190, -390], lookAt: [0, 112, 0], fov: 43 },
    qaCameras: [
      { name: 'suspended-loop', position: [-250, 138, -250], lookAt: [-20, 156, -20] },
      { name: 'northwest-tower', position: [195, 155, -240], lookAt: [30, 128, -42] },
      { name: 'southeast-tower', position: [-220, 135, 235], lookAt: [-44, 116, 43] },
      { name: 'cantilever-soffit', position: [-100, 110, -115], lookAt: [-40, 162, -38] },
      { name: 'viewing-portholes', position: [-37, 147, -68], lookAt: [-36, 162, -42] },
      { name: 'dense-corner-braces', position: [-83, 180, -119], lookAt: [-42, 179, -60] },
      { name: 'glass-panel-joints', position: [112, 113, -83], lookAt: [68, 105, -57] },
      { name: 'podium-dishes', position: [112, 88, 120], lookAt: [25, 47, 46] },
      { name: 'sloping-roof', position: [-176, 335, -160], lookAt: [-1, 207, -6] },
      { name: 'helipad', position: [89, 258, -88], lookAt: [48, 233, -46] },
      { name: 'ground-entry', position: [64, 14, -133], lookAt: [52, 4, -79] },
      { name: 'far-loop', position: [440, 285, 450], lookAt: [0, 114, 0] },
    ],
  },
  {
    id: 'N0186',
    key: 'guangzhou_international_finance_center',
    wikidataId: 'Q1043438',
    title: 'Guangzhou International Finance Center',
    height: 438.6,
    build: buildGuangzhouIfc,
    brief:
      'Guangzhou’s curved triangular blue-glass West Tower, gently swelling lower shaft, fine visible diagrid, dense curtain-wall seals, dark mechanical bands, triangular roof glazing and raised circular helipad.',
    sourceFacts: {
      architecturalHeightMeters: 438.6,
      occupiedHeightMeters: 415.1,
      helipadHeightMeters: 437.5,
      architectRoundedHeightMeters: 440,
      architectStoreys: 103,
      cvuStoreys: 101,
      completionYear: 2010,
      architect: 'WilkinsonEyre',
      engineer: 'Arup',
      diagridModuleHeightMeters: 27,
      diagridBaseTubeDiameterMeters: 1.8,
      diagridTopTubeDiameterMeters: 0.95,
      hotelAtriumStoreys: 33,
    },
    reconstruction: {
      plan: 'The exact-QID mapped rounded triangle preserves its signed footprint. A smooth interpolated trace removes long flat map segments while retaining the three unequal rounded corners. A continuous large-radius section widens near the lower third and tapers to the roof, following the architect’s elevation.',
      facade:
        'Physical pane borders and repeated dark mechanical courses follow the curved glass. The engineer’s 27m diagrid stage and 1.8m-to0.95m tube width control the subtle diagonal traces. The built tubes are behind the glazing: tinted conformal strips reproduce their visible daylight appearance over opaque blue glass rather than rendering an exposed white exoskeleton.',
      roof: 'The architect plan/section establishes the triangular glazed roof and raised circular helipad at one edge. CVU supplies the437.5m landing plane and438.6m architectural top. Fine rooftop supports, netting and stairs are photographed reconstructions.',
      ground:
        'A narrow glazed entry and flat canopy reconstruct the tower frontage. The separately mapped mall and apartment annex remain separate map context, preserving this asset’s tower identity.',
    },
    refs: [
      'https://wilkinsoneyre.com/projects/guangzhou-international-finance-center',
      'https://www.skyscrapercenter.com/building/guangzhou-international-finance-center/174',
      'https://global.ctbuh.org/resources/papers/download/3310-engineering-of-guangzhou-international-finance-centre.pdf',
      'https://www.researchgate.net/publication/316893174_Engineering_of_Guangzhou_International_Finance_Centre',
      'https://www.openstreetmap.org/way/184738716',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The signed exact-QID rounded triangular footprint fixes the unequal corners and anchor. The west-side raised helipad is inferred from the architect’s Opera House photograph and elevation; its exact center is reconstructed. Street contactY0 and current CVU438.6m tip override the map’s rounded440.2m. Separate mall and residential annex are excluded.',
    }),
    limitations: [
      commonLimit,
      'Fine curved section, pane pitch, mechanical belt datums, transmitted diagrid contrast, rooftop equipment and entry dimensions are reconstructions from the architect’s completed exterior photographs and published diagrams. Opaque daylight glazing represents visible diagrid tubes using conformal tinted geometry; it does not simulate transmission through occupied interiors. The engineer paper’s indexed text is available, while its direct PDF URL returned404 during authoring. Exact helipad center and IFC lettering outlines are photo reconstructions. Separate mall, apartment annex, landscape and interiors are excluded.',
    ],
    camera: { position: [330, 278, 620], lookAt: [0, 211, -3], fov: 43 },
    qaCameras: [
      { name: 'curved-triangular-shaft', position: [153, 223, 245], lookAt: [0, 207, -4] },
      { name: 'subtle-diagrid', position: [47, 188, 81], lookAt: [10, 176, 20] },
      { name: 'mechanical-bands', position: [-103, 228, -91], lookAt: [-20, 219, -20] },
      { name: 'fine-curtain-wall', position: [51, 82, 63], lookAt: [19, 81, 13] },
      { name: 'raised-helipad', position: [-66, 465, -49], lookAt: [-17, 437.5, -7] },
      { name: 'roof-triangle', position: [43, 493, 42], lookAt: [0, 432, -3] },
      { name: 'helipad-net-stairs', position: [-28, 444, 13], lookAt: [-12, 436, -7] },
      { name: 'ifc-lettering', position: [75, 427, 78], lookAt: [12, 421, 14] },
      { name: 'ground-entry', position: [7, 12, -67], lookAt: [0, 4, -27] },
      { name: 'far-pearl-river', position: [-450, 345, 790], lookAt: [0, 212, -3] },
    ],
  },
  {
    id: 'N0187',
    key: 'ping_an_finance_centre',
    wikidataId: 'Q1077308',
    title: 'Ping An Finance Center',
    height: 599.1,
    build: buildPingAn,
    brief:
      'Shenzhen’s stainless-clad North Tower, tapering double-notched square sections, paired supercolumns, recessed braced corners, fine pointed facade piers, folded eastern canopy and genuinely open four-legged crown below its small glass pyramid.',
    sourceFacts: {
      architecturalHeightMeters: 599.1,
      occupiedHeightMeters: 555.6,
      observatoryHeightMeters: 562.2,
      aboveGroundStoreys: 115,
      basements: 5,
      completionYear: 2017,
      architect: 'Kohn Pedersen Fox Associates',
      engineer: 'Thornton Tomasetti with CCDI',
      supercolumns: 8,
      exteriorBeltTrusses: 7,
      steelGrade: 'Outokumpu Supra316L',
      facadeFinish: 'Deco Linen',
    },
    reconstruction: {
      massing:
        'The exact-QID double-notched plan plus54 separately mapped facade/crown patches constrain lower narrowing, disappearing corner projections and upper taper. Their skillion tags encode sloped facade surfaces rather than solid occupied roof volumes. Completed KPF photographs establish the final599.1m design without the abandoned tall spire.',
      facade:
        'Eight broad stainless column casings frame the recessed corner bays. Four broad glazed faces retain repeated pointed vertical piers, pane seals and horizontal floor courses; corner louvres and large diagonal bands remain physical geometry. The shared stainless surface approximates the supplied embossed linen finish at world-viewer scale.',
      crown:
        'A glazed sloping roof closes the upper occupied volume, then four separate stainless legs continue around large open apertures. The small square cap starts near590m and converges to599.1m, following the completed architect close aerial and mapped roof patches.',
      entry:
        'The eastern Yitian Road facade uses the architect’s completed street photograph: splayed braces, low folded canopy, dark granite feet and three round revolving door enclosures. Fine dimensions and door offsets are photograph reconstructions.',
    },
    refs: [
      'https://www.kpf.com/project/ping-an-finance-centre',
      'https://www.thorntontomasetti.com/project/ping-international-finance-centre-north-tower',
      'https://www.skyscrapercenter.com/building/ping-an-finance-center/54',
      'https://www.outokumpu.com/en/expertise/2016/megatall-with-iconic-steel-facade',
      'https://global.ctbuh.org/resources/papers/download/1997-anything-goes.pdf',
      'https://www.openstreetmap.org/way/535860513',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID double-notched footprint and separately mapped facade/roof parts retain the nearly cardinal signed frame. Native+X is east, toward Yitian Road and the architect-photographed entry; +Z is south. The tower’s roughly76m lower envelope tapers within its own footprint, with no separate retail wing or South Tower substitution. SourceY0 is the open-air entry.599.1m is the completed current CVU architectural tip.',
    }),
    limitations: [
      commonLimit,
      'Fine cladding seams, seven mechanical belt datums, pointed pier profiles, exterior cross-brace sections, revolving doors and crown access details are photograph reconstructions within mapped sectional evidence. The shared stainless graph approximates the fine Deco Linen embossing, without copying a vendor texture. Separate retail podium, South Tower, landscape, moving maintenance rigs and interior fit-out are excluded. The earlier660m antenna design is not modeled.',
    ],
    camera: { position: [680, 380, 730], lookAt: [0, 288, 0], fov: 42 },
    qaCameras: [
      { name: 'paired-column-shaft', position: [145, 282, 166], lookAt: [20, 273, 20] },
      { name: 'notched-corner-braces', position: [82, 238, 83], lookAt: [27, 236, 27] },
      { name: 'pointed-stainless-piers', position: [11, 178, 82], lookAt: [8, 175, 30] },
      { name: 'corner-louvres', position: [56, 74, 62], lookAt: [28, 77, 29] },
      { name: 'upper-taper', position: [152, 511, 154], lookAt: [10, 511, 10] },
      { name: 'open-crown', position: [73, 584, 69], lookAt: [0, 576, 0] },
      { name: 'crown-aperture', position: [1, 579, 41], lookAt: [0, 578, 0] },
      { name: 'small-pyramid-cap', position: [22, 613, 29], lookAt: [0, 593, 0] },
      { name: 'folded-entry-canopy', position: [91, 11, 29], lookAt: [40, 5, 0] },
      { name: 'revolving-doors', position: [58, 5, 9], lookAt: [39, 2, 0] },
      { name: 'far-yitian-road', position: [1010, 418, 310], lookAt: [0, 288, 0] },
    ],
  },
];
