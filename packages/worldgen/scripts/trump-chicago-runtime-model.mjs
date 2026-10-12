/** Chicago Trump tower: mapped setbacks, continuous curtain walls and an attached spire. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0174_trump_international_hotel_and_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  skyline: { tolerance: 0.1, step: 0, bays: 0, sides: 8, canopy: 0, rails: false, trees: false },
  district: {
    tolerance: 0.08,
    step: 6,
    bays: 18,
    sides: 12,
    canopy: 8,
    rails: false,
    trees: false,
  },
  street: { tolerance: 0.02, step: 2, bays: 6, sides: 20, canopy: 16, rails: true, trees: true },
  closeup: { tolerance: 0.02, step: 1, bays: 6, sides: 24, canopy: 24, rails: true, trees: true },
};
const silver = [0.73, 0.76, 0.77],
  blue = [0.32, 0.43, 0.49];
const part = (id) => map.elements.find((p) => p.id === id);
function cleanPlan(plan, tolerance = 0.12) {
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
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.03);
}
function insidePlan([x, z], plan) {
  let inside = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function stroke(out, a, b, width) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    d = [((-dy / len) * width) / 2, ((dx / len) * width) / 2, 0];
  face(
    out,
    'stainless',
    [
      a.map((v, i) => v - d[i]),
      b.map((v, i) => v - d[i]),
      b.map((v, i) => v + d[i]),
      a.map((v, i) => v + d[i]),
    ],
    [0.78, 0.8, 0.81],
  );
}
function strip(out, slot, a, b, lo, hi, offset, color) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len];
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
function build(out, level) {
  const c = settings[level],
    blocks = [
      [64594680, 0.22, 60, 16],
      [188338549, 60, 120, 13],
      [188338550, 120, 200, 22],
      [188338548, 200, 345, 41],
    ].map(([id, lo, hi, floors]) => ({
      id,
      lo,
      hi,
      floors,
      plan: cleanPlan(partPlan(map, part(id)), c.tolerance),
    }));
  mappedSolid(out, 'foundation', blocks[0].plan, 0, 0.22, [0.4, 0.43, 0.42]);
  for (const { id, plan, lo, hi, floors } of blocks) {
    const pitch = (hi - lo) / floors;
    for (const { a, b, len } of edges(plan)) {
      strip(out, 'glass', a, b, lo, hi, 0, blue);
      if (c.step) {
        for (let f = c.step; f <= floors; f += c.step) {
          const y = lo + f * pitch;
          if (id !== 64594680 || y >= 11)
            strip(out, 'stainless', a, b, y - 0.3 * c.step, y, 0.045, silver);
        }
        // Preserve the broad dark mechanical floor beneath each intermediate terrace.
        if (hi < 345) {
          strip(out, 'glass', a, b, hi - pitch, hi - 0.35, 0.055, [0.23, 0.28, 0.29]);
          for (let y = hi - pitch + 0.55; y < hi - 0.3; y += c.step * 0.84)
            strip(out, 'stainless', a, b, y, y + 0.08 * c.step, 0.07, [0.49, 0.54, 0.56]);
        }
      }
      if (c.bays) {
        const bays = Math.max(1, Math.round(len / c.bays));
        for (let j = 0; j <= bays; j++) {
          const t = j / bays,
            half = 0.065 / len,
            u = lerp(a, b, Math.max(0, t - half)),
            v = lerp(a, b, Math.min(1, t + half));
          if (Math.hypot(v[0] - u[0], v[1] - u[1]) > 0.001)
            strip(out, 'stainless', u, v, lo + 0.15, hi - 0.2, 0.045, silver);
        }
      }
    }
    mappedCap(out, 'metal', plan, hi, [0.46, 0.5, 0.51]);
    for (const { a, b } of edges(plan))
      strip(out, 'stainless', a, b, hi - 0.25, hi + 0.15, 0.1, silver);
    if (c.rails && hi < 345)
      for (const { a, b } of edges(plan.map(([x, z]) => [x * 0.992, z * 0.982])))
        strip(out, 'glass', a, b, hi + 0.08, hi + 1.05, 0.015, [0.44, 0.55, 0.58]);
  }
  const crown = cleanPlan(partPlan(map, part(188338859)), c.tolerance);
  for (const { a, b } of edges(crown)) {
    strip(out, 'glass', a, b, 345, 357, 0, [0.29, 0.36, 0.39]);
    if (c.step)
      for (let y = 348; y < 357; y += c.step * 3)
        strip(out, 'stainless', a, b, y - 0.15, y, 0.035, silver);
  }
  mappedCap(out, 'metal', crown, 357, [0.39, 0.45, 0.47]);
  for (const [id, y0, y1, fraction] of [
    [188356529, 357, 380, 0.92],
    [284773992, 380, 400, 0.88],
    [284773991, 400, 423.2, 0.1],
  ]) {
    const plan = partPlan(map, part(id)),
      center = plan.reduce(
        (s, p) => [s[0] + p[0] / plan.length, s[1] + p[1] / plan.length],
        [0, 0],
      ),
      radius = Math.max(...plan.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1])));
    loft(
      out,
      'stainless',
      [
        radialRing(y0, radius, radius, c.sides, center),
        radialRing(y1, radius * fraction, radius * fraction, c.sides, center),
      ],
      [0.76, 0.79, 0.8],
    );
    if (level === 'closeup' || level === 'street')
      for (let y = y0 + 1; y < y1; y += level === 'closeup' ? 4.6 : 9.2) {
        const r = radius * (1 - ((1 - fraction) * (y - y0)) / (y1 - y0));
        loft(
          out,
          'stainless',
          [
            radialRing(y, r + 0.035, r + 0.035, c.sides, center),
            radialRing(y + 0.1, r + 0.035, r + 0.035, c.sides, center),
          ],
          silver,
        );
      }
  }
  if (c.canopy) {
    const center = [-45.5, -9.5],
      P = (a, r, y) => [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    for (let i = 0; i < c.canopy; i++) {
      const a = Math.PI * 0.35 + (i / c.canopy) * Math.PI * 1.3,
        b = Math.PI * 0.35 + ((i + 1) / c.canopy) * Math.PI * 1.3;
      const pane = [P(a, 3.3, 9.2), P(a, 10, 9.8), P(b, 10, 9.8), P(b, 3.3, 9.2)];
      face(out, 'glass', pane, [0.7, 0.84, 0.87]);
      face(out, 'glass', pane.map(([x, y, z]) => [x, y + 0.04, z]).reverse(), [0.7, 0.84, 0.87]);
      if (c.rails) beam(out, 'stainless', P(a, 3.3, 9.16), P(a, 10, 9.76), 0.13, 0.18, silver);
    }
  }
  if (c.trees)
    for (const x of [38, 43, 48])
      for (const z of [-10, 9]) {
        const p = [x, z];
        if (
          insidePlan(p, blocks[0].plan) &&
          !insidePlan(p, blocks[1].plan) &&
          edges(blocks[0].plan).every(({ a, b, len }) => {
            const t = Math.max(
              0,
              Math.min(1, ((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / (len * len)),
            );
            return Math.hypot(x - a[0] - t * (b[0] - a[0]), z - a[1] - t * (b[1] - a[1])) > 1.8;
          })
        ) {
          box(out, 'stone', [x - 1, 60, z - 1], [x + 1, 60.55, z + 1], [0.59, 0.59, 0.53]);
          loft(
            out,
            'foundation',
            [
              [60.55, 1.1],
              [63.2, 1.4],
              [64.3, 0.1],
            ].map(([y, r]) => radialRing(y, r, r, 6, [x, z])),
            [0.22, 0.36, 0.16],
          );
        }
      }
  if (level === 'skyline')
    strip(out, 'glass', [-31, 21.83], [12, 21.83], 51.8, 58, 0, [0.44, 0.5, 0.52]);
  else sign(out, level);
}
function sign(out, level) {
  // Original serif stroke geometry for the installer-documented140ft-wide riverfront sign.
  const glyphs = [
    [
      [
        [0, 1],
        [1, 1],
      ],
      [
        [0.5, 1],
        [0.5, 0],
      ],
      [
        [0.2, 0],
        [0.8, 0],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.62, 1],
        [0.86, 0.9],
        [0.95, 0.76],
        [0.87, 0.58],
        [0.62, 0.5],
        [0, 0.5],
      ],
      [
        [0.48, 0.5],
        [1, 0],
      ],
      [
        [-0.1, 0],
        [0.25, 0],
      ],
      [
        [0.78, 0],
        [1.12, 0],
      ],
    ],
    [
      [
        [0, 1],
        [0, 0.25],
        [0.1, 0.09],
        [0.3, 0],
        [0.65, 0],
        [0.9, 0.1],
        [1, 0.28],
        [1, 1],
      ],
      [
        [-0.15, 1],
        [0.2, 1],
      ],
      [
        [0.8, 1],
        [1.15, 1],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.5, 0.28],
        [1, 1],
        [1, 0],
      ],
      [
        [-0.15, 0],
        [0.18, 0],
      ],
      [
        [0.82, 0],
        [1.15, 0],
      ],
    ],
    [
      [
        [0, 0],
        [0, 1],
        [0.64, 1],
        [0.88, 0.88],
        [1, 0.69],
        [0.87, 0.52],
        [0.63, 0.45],
        [0, 0.45],
      ],
      [
        [-0.1, 0],
        [0.28, 0],
      ],
    ],
  ];
  const width = 42.672,
    letter = 6.7,
    gap = (width - letter * 5) / 4;
  glyphs.forEach((paths, index) => {
    for (const path of paths)
      for (let i = 0; i < path.length - 1; i++) {
        const P = (p) => [
          -9.5 - width / 2 + index * (letter + gap) + p[0] * letter,
          51.8 + p[1] * 6.2,
          21.83,
        ];
        stroke(out, P(path[i]), P(path[i + 1]), level === 'district' ? 0.6 : 0.55);
      }
  });
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
export const buildTrumpChicagoSkyline = (out) => build(skylineOutput(out), 'skyline');
export const buildTrumpChicagoDistrict = (out) => build(out, 'district');
export const buildTrumpChicagoStreet = (out) => build(out, 'street');
export const buildTrumpChicagoCloseup = (out) => build(out, 'closeup');
export const buildTrumpChicagoReviewedMaster = buildTrumpChicagoCloseup;
