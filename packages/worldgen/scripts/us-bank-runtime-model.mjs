/** U.S. Bank Tower: mapped compound setbacks and continuous projecting facade bays. */
import { readFileSync } from 'node:fs';
import { beam, radialRing } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'us_bank_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const stone = [0.76, 0.73, 0.69],
  glass = [0.16, 0.29, 0.32];
const settings = {
  skyline: { tolerance: 0.25, step: 0, fold: false, sides: 16, canopy: 0 },
  district: { tolerance: 0.04, step: 6, fold: false, sides: 24, canopy: 6 },
  street: { tolerance: 0.02, step: 3, fold: true, sides: 40, canopy: 12 },
  closeup: { tolerance: 0.02, step: 1, fold: true, sides: 64, canopy: 18 },
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

function cleanPlan(plan, tolerance) {
  const p = plan.map((q) => q.slice());
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (
        d > 0 &&
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d < tolerance &&
        (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) >= 0
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function band(out, a, b, lo, hi, n, color, offset = 0.03, slot = 'cladding') {
  face(
    out,
    slot,
    [
      [a[0], lo, a[1]],
      [b[0], lo, b[1]],
      [b[0], hi, b[1]],
      [a[0], hi, a[1]],
    ].map((p) => shift(p, n, offset)),
    color,
  );
}
function foldedBay(out, a, b, n, low, high, step) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    inset = Math.min(0.17, 0.36 / len),
    peak = Math.min(0.62, len * 0.19),
    P = (u, y, offset = 0) => [
      a[0] + (b[0] - a[0]) * u + n[0] * (peak * (1 - Math.abs(u * 2 - 1)) + offset),
      y,
      a[1] + (b[1] - a[1]) * u + n[2] * (peak * (1 - Math.abs(u * 2 - 1)) + offset),
    ];
  const panel = (u0, u1, y0, y1, slot, color, offset = 0) => {
    const cuts = [u0, ...(u0 < 0.5 && u1 > 0.5 ? [0.5] : []), u1];
    for (let i = 1; i < cuts.length; i++)
      face(
        out,
        slot,
        [
          P(cuts[i - 1], y0, offset),
          P(cuts[i], y0, offset),
          P(cuts[i], y1, offset),
          P(cuts[i - 1], y1, offset),
        ],
        color,
      );
  };
  // A continuous folded backing closes all windows; shared granite piers run full height.
  panel(0, 1, low, high, 'glass', glass, -0.025);
  panel(0, inset, low, high, 'cladding', stone);
  panel(1 - inset, 1, low, high, 'cladding', stone);
  for (const u of step === 1 ? [inset, 1 - inset] : []) {
    const p = [P(u, low), P(u, high), P(u, high, -0.025), P(u, low, -0.025)];
    face(out, 'cladding', u === inset ? p : p.toReversed(), stone);
  }
  const levels = [
    low,
    ...Array.from({ length: 76 }, (_, i) => 9.144 + i * 4.08).filter(
      (y) => y > low + 0.01 && y < high - 0.01,
    ),
    high,
  ];
  for (let i = 1; i < levels.length; i += step) {
    const lo = levels[i - 1],
      hi = levels[Math.min(levels.length - 1, i + step - 1)],
      width = 1.22 * step;
    panel(inset, 1 - inset, lo, Math.min(hi, lo + width / 2), 'cladding', stone, 0.002);
    panel(inset, 1 - inset, Math.max(lo, hi - width / 2), hi, 'cladding', stone, 0.002);
    // Shallow horizontal reveals merge into the backing at medium-fi distances.
  }
}
function build(out, level) {
  const c = settings[level],
    base = cleanPlan(localOutline(map), c.tolerance),
    blocks = map.elements
      .filter((p) => p.tags['building:part'])
      .map((p) => ({
        id: p.id,
        plan: cleanPlan(partPlan(map, p), c.tolerance),
        top: p.id === 495115500 ? 295 : Number(p.tags.height),
      }));
  mappedSolid(out, 'foundation', base, 0, 0.22, [0.55, 0.53, 0.5]);
  const lobby = base.map((p) => [p[0] * 0.965, p[1] * 0.965]);
  for (const { a, b, n, len } of edges(lobby)) {
    band(out, a, b, 0.22, 9.144, n, [0.22, 0.31, 0.31], 0, 'glass');
    if (c.step) {
      band(out, a, b, 4.48, 4.63, n, [0.67, 0.66, 0.62]);
      if (len > 1.5)
        beam(
          out,
          'cladding',
          shift([a[0], 0.22, a[1]], n, 0.2),
          shift([a[0], 9.144, a[1]], n, 0.2),
          0.42,
          0.7,
          stone,
        );
    }
  }
  mappedCap(out, 'cladding', base, 9.144, stone);
  for (const block of blocks) {
    for (const { a, b, n, bottom, top } of exposedEdges(block, blocks, 9.144)) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (c.fold) {
        const bays = Math.max(1, Math.round(len / 2.75));
        for (let i = 0; i < bays; i++)
          foldedBay(out, lerp(a, b, i / bays), lerp(a, b, (i + 1) / bays), n, bottom, top, c.step);
      } else {
        const average = stone.map(
          (v, i) => v * scope.sourceFacts.surfaceMeans.stone_granite[i] * 0.48 + glass[i] * 0.52,
        );
        band(out, a, b, bottom, top, n, average, 0.18, 'glass');
        if (c.step) {
          for (let y = 9.144 + c.step * 4.08; y < top; y += c.step * 4.08)
            if (y - 1.22 * c.step > bottom) band(out, a, b, y - 1.22 * c.step, y, n, stone, 0.22);
          const bays = Math.max(1, Math.round(len / 5.5));
          for (let j = 0; j <= bays; j++) {
            const u = Math.max(0, j / bays - 0.3 / len),
              v = Math.min(1, j / bays + 0.3 / len);
            if (v > u) band(out, lerp(a, b, u), lerp(a, b, v), bottom, top, n, stone, 0.23);
          }
        }
      }
      for (const y of [195, 250, 291])
        if (y > bottom && y < top) {
          band(out, a, b, y - 1.8, y - 0.3, n, [0.15, 0.25, 0.27], 0.28, 'glass');
          band(out, a, b, y - 0.15, Math.min(top, y + 0.225), n, stone, 0.4);
        }
    }
    mappedCap(out, 'metal', block.plan, block.top, [0.55, 0.55, 0.52]);
    if (c.step)
      for (const { a, b, n } of exposedEdges({ ...block, top: block.top + 0.3 }, blocks, block.top))
        band(out, a, b, block.top - 0.1, block.top + 0.1, n, stone, 0.12);
  }
  const core = blocks.find((b) => b.id === 495115500).plan,
    center = [
      (Math.min(...core.map((p) => p[0])) + Math.max(...core.map((p) => p[0]))) / 2,
      (Math.min(...core.map((p) => p[1])) + Math.max(...core.map((p) => p[1]))) / 2,
    ],
    phase = Math.atan2(1.58, 8.83),
    crown = clockwise(
      Array.from({ length: 32 }, (_, i) => {
        const a = phase + (i * Math.PI) / 16,
          r = i % 2 ? 12.8 : 16.8;
        return [center[0] + r * Math.cos(a), center[1] + r * Math.sin(a)];
      }),
    );
  for (const [i, { a, b, n }] of edges(crown).entries()) {
    band(
      out,
      a,
      b,
      296.1,
      310.3,
      n,
      i % 2 ? [0.2, 0.37, 0.4] : stone,
      0,
      i % 2 ? 'glass' : 'cladding',
    );
    if (c.step && i % 2)
      for (let y = 297.65; y < 310.3; y += 1.55 * c.step)
        band(out, a, b, y - 0.12 * c.step, y, n, [0.22, 0.3, 0.3], 0.025, 'metal');
  }
  const collar = radialRing(295, 16.4, 16.4, c.sides, center).map((p) => [p[0], p[2]]);
  for (const { a, b, n } of edges(collar))
    band(out, a, b, 295, 296.3, n, [0.18, 0.29, 0.31], 0, 'glass');
  mappedCap(out, 'metal', crown, 296.1, [0.54, 0.55, 0.52], [], true);
  mappedCap(out, 'metal', crown, 309.9, [0.54, 0.55, 0.52]);
  const landing = radialRing(309.92, 12.3, 12.3, c.sides, center).map((p) => [p[0], p[2]]);
  mappedCap(out, 'metal', landing, 309.92, [0.66, 0.2, 0.17]);
  if (c.step) {
    for (let i = 0; i < c.sides; i++) {
      const a = (-i * Math.PI * 2) / c.sides,
        b = (-(i + 1) * Math.PI * 2) / c.sides,
        P = (a, r) => [center[0] + r * Math.cos(a), 309.96, center[1] + r * Math.sin(a)];
      face(
        out,
        'metal',
        [P(a, 10.7), P(b, 10.7), P(b, 10.9), P(a, 10.9)].reverse(),
        [0.9, 0.9, 0.85],
      );
    }
    const h = (x, z) => [center[0] + x, 309.97, center[1] + z];
    for (const x of [-2.2, 2.2])
      face(
        out,
        'metal',
        [h(x - 0.24, -3.5), h(x - 0.24, 3.5), h(x + 0.24, 3.5), h(x + 0.24, -3.5)],
        [0.9, 0.9, 0.85],
      );
    face(
      out,
      'metal',
      [h(-2.2, -0.24), h(-2.2, 0.24), h(2.2, 0.24), h(2.2, -0.24)],
      [0.9, 0.9, 0.85],
    );
  }
  // Opaque canopy needs upward faces as well as the visible underside.
  if (c.canopy) {
    const direction = ((211 - 90) * Math.PI) / 180 + map.heading,
      P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
    for (let i = 0; i <= 6; i++) {
      const a = direction - 0.57 + i * 0.19;
      beam(out, 'cladding', P(a, 28.7, 0.22), P(a, 28.7, 9.144), 0.95, 0.85, stone);
    }
    for (let i = 0; i < c.canopy; i++) {
      const a = direction - 0.59 + (i * 1.17) / c.canopy,
        b = direction - 0.59 + ((i + 1) * 1.17) / c.canopy,
        panel = [P(a, 25.3, 3.3), P(b, 25.3, 3.3), P(b, 30.4, 3.3), P(a, 30.4, 3.3)];
      face(out, 'metal', panel.toReversed(), [0.46, 0.43, 0.38]);
      face(
        out,
        'metal',
        panel.map(([x, y, z]) => [x, y + 0.035, z]),
        [0.46, 0.43, 0.38],
      );
      if (c.fold)
        beam(out, 'metal', P(a, 30.4, 3.3), P(b, 30.4, 3.3), 0.2, 0.25, [0.61, 0.58, 0.53]);
    }
  }
}
function skylineOutput(out) {
  const result = {};
  for (const name of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    result[name] = (slot, _ref, p, n, uv, color) => {
      const mean = scope.sourceFacts.surfaceMeans[scope.surfaceOverrides[slot]?.graph] ?? [1, 1, 1];
      out[name](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    };
  return result;
}
export const buildUsBankSkyline = (out) => build(skylineOutput(out), 'skyline');
export const buildUsBankDistrict = (out) => build(out, 'district');
export const buildUsBankStreet = (out) => build(out, 'street');
export const buildUsBankCloseup = (out) => build(out, 'closeup');
export const buildUsBankReviewedMaster = buildUsBankCloseup;
