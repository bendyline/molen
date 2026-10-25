/** Four whole-tower browser recipes; the original detailed master remains unchanged. */
import { readFileSync } from 'node:fs';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  guardrail,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rotatedBuilder,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = '432_park_avenue';
const frame = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8'));
const parts = partsEvidence(key),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8'));
const shaftPlan = partPlan(
  frame,
  parts.find((p) => p.id === 463593207),
);
export const park432Center = [0, 1].map(
  (i) => (Math.min(...shaftPlan.map((p) => p[i])) + Math.max(...shaftPlan.map((p) => p[i]))) / 2,
);
const [cx, cz] = park432Center,
  half = 14.25,
  top = 425.5,
  pitch = 4.7244,
  base = top - 90 * pitch,
  cell = 4.75;
const pale = [0.79, 0.785, 0.755],
  blue = [0.14, 0.24, 0.265],
  metal = [0.2, 0.23, 0.235];
const means = scope.sourceFacts.surfaceMeans;
const faces = [
  { n: [1, 0, 0], r: [0, 0, -1] },
  { n: [0, 0, 1], r: [1, 0, 0] },
  { n: [-1, 0, 0], r: [0, 0, 1] },
  { n: [0, 0, -1], r: [-1, 0, 0] },
];
const rows = [20, 34, 48, 62, 76],
  bands = [
    [0, 20],
    [22, 34],
    [36, 48],
    [50, 62],
    [64, 76],
    [78, 90],
  ];
const rect = (a, b, c, d) => [
  [a, b],
  [a, d],
  [c, d],
  [c, b],
];
const at = (f, u, y, d = 0) => [
  f.n[0] * (half + d) + f.r[0] * u,
  y,
  f.n[2] * (half + d) + f.r[2] * u,
];
function pane(out, f, u0, u1, y0, y1, slot = 'concrete', color = pale, d = 0, back = false) {
  const p = [at(f, u0, y0, d), at(f, u1, y0, d), at(f, u1, y1, d), at(f, u0, y1, d)];
  face(out, slot, back ? p.toReversed() : p, color);
}
function facade(out, f, lo, hi) {
  const p = [at(f, -half, lo), at(f, half, lo), at(f, half, hi), at(f, -half, hi)];
  // One reusable graphic motif per geometric bay. These are motif repeats, not 1m windows.
  out.addQuad(
    'facade',
    'metric:uv',
    p,
    normalFor(...p),
    [
      [0, (lo - base) / pitch],
      [6, (lo - base) / pitch],
      [6, (hi - base) / pitch],
      [0, (hi - base) / pitch],
    ],
    [0.79, 0.785, 0.755],
  );
}
function closedBands(out, level) {
  for (const [a, b] of bands) {
    const lo = a === 0 ? 0 : base + a * pitch,
      hi = base + b * pitch;
    if (level === 'skyline') {
      const wall = pale.map((v, i) => v * means.concrete_plain[i]),
        ratio = (3.048 / cell) * (3.048 / pitch);
      const average = wall.map((v, i) => v * (1 - ratio) + blue[i] * ratio);
      mappedSolid(out, 'concrete', rect(-half, -half, half, half), lo, hi, average);
    } else if (level === 'district') {
      for (const f of faces) facade(out, f, lo, hi);
    } else {
      for (const f of faces) {
        const start = Math.max(1, a),
          finish = b;
        for (let j = 0; j <= 6; j++) {
          const u = -half + j * cell,
            w = 1.702,
            left = Math.max(-half, u - w / 2),
            right = Math.min(half, u + w / 2),
            low = Math.max(lo, base + start * pitch);
          pane(
            out,
            f,
            Math.max(-half, u - w / 2),
            Math.min(half, u + w / 2),
            Math.max(lo, base + start * pitch),
            hi,
          );
          // Continuous reveal strips join each window edge; hidden parts stay behind spandrels.
          if (left > -half)
            face(
              out,
              'concrete',
              [
                at(f, left, low),
                at(f, left, hi),
                at(f, left, hi, -0.1016),
                at(f, left, low, -0.1016),
              ],
              pale,
            );
          if (right < half)
            face(
              out,
              'concrete',
              [
                at(f, right, hi),
                at(f, right, low),
                at(f, right, low, -0.1016),
                at(f, right, hi, -0.1016),
              ],
              pale,
            );
        }
        for (let row = start; row < finish; row++) {
          const y = base + row * pitch,
            low = y + (pitch - 3.048) / 2,
            high = low + 3.048;
          // Lift matching-color horizontal strips by2mm, avoiding coplanar overdraw seams.
          pane(out, f, -half, half, y, low, 'concrete', pale, 0.002);
          pane(out, f, -half, half, high, y + pitch, 'concrete', pale, 0.002);
          face(
            out,
            'concrete',
            [
              at(f, -half, low),
              at(f, half, low),
              at(f, half, low, -0.1016),
              at(f, -half, low, -0.1016),
            ],
            pale,
          );
          face(
            out,
            'concrete',
            [
              at(f, -half, high, -0.1016),
              at(f, half, high, -0.1016),
              at(f, half, high),
              at(f, -half, high),
            ],
            pale,
          );
          for (let col = 0; col < 6; col++) {
            const u = -half + (col + 0.5) * cell,
              left = u - 1.524,
              right = u + 1.524;
            const q = [
              at(f, left, low, -0.1016),
              at(f, right, low, -0.1016),
              at(f, right, high, -0.1016),
              at(f, left, high, -0.1016),
            ];
            const shade = 0.88 + ((row * 13 + col * 7 + faces.indexOf(f) * 3) % 11) * 0.012;
            face(
              out,
              'glass',
              q,
              blue.map((c) => c * shade),
            );
            if (level === 'closeup') {
              outlineFrame(out, f, left, right, low, high, 0.048, -0.0986);
              outlineFrame(out, f, left + 0.22, right - 0.22, low + 0.18, low + 1.07, 0.028, -0.07);
            }
          }
        }
        if (a === 0) {
          pane(out, f, -half, half, 0, base + pitch, 'glass', blue, -0.7);
          for (let j = 0; j <= 6; j++) {
            const u = -half + j * cell;
            pane(out, f, Math.max(-half, u - 0.56), Math.min(half, u + 0.56), 0, base + pitch);
          }
          pane(out, f, -half, half, 0, 0.28);
        }
      }
    }
    mappedCap(
      out,
      'concrete',
      rect(-half, -half, half, half),
      hi,
      level === 'skyline' ? pale.map((v, i) => v * means.concrete_plain[i]) : pale,
    );
    if (a !== 0)
      mappedCap(
        out,
        'concrete',
        rect(-half, -half, half, half),
        lo,
        level === 'skyline' ? pale.map((v, i) => v * means.concrete_plain[i]) : pale,
        [],
        true,
      );
  }
}
function outlineFrame(out, f, left, right, low, high, w, d) {
  for (const [a, b, c, e] of [
    [left - w / 2, right + w / 2, low - w / 2, low + w / 2],
    [left - w / 2, right + w / 2, high - w / 2, high + w / 2],
    [left - w / 2, left + w / 2, low, high],
    [right - w / 2, right + w / 2, low, high],
  ])
    pane(out, f, a, b, c, e, 'metal', metal, d);
}
function openDrums(out, level) {
  const color = level === 'skyline' ? pale.map((v, i) => v * means.concrete_plain[i]) : pale;
  const coreColor =
    level === 'skyline'
      ? [0.62, 0.63, 0.61].map((v, i) => v * means.metal_painted[i])
      : [0.62, 0.63, 0.61];
  for (const row of rows) {
    const lo = base + row * pitch,
      hi = lo + 2 * pitch;
    for (const f of faces) {
      for (let j = 0; j <= 6; j++) {
        const u = -half + j * cell,
          w = cell - 3.58;
        const a = Math.max(-half, u - w / 2),
          b = Math.min(half, u + w / 2);
        const intervals =
          level === 'skyline'
            ? [[lo, hi]]
            : [0, 1].map((r) => [
                lo + r * pitch + (pitch - 3.58) / 2,
                lo + r * pitch + (pitch + 3.58) / 2,
              ]);
        for (const [low, high] of intervals) {
          pane(out, f, a, b, low, high, 'concrete', color);
          pane(out, f, a, b, low, high, 'concrete', color, -1.35, true);
        }
      }
      for (const [i, j] of [
        [lo, lo + (pitch - 3.58) / 2],
        [lo + pitch - (pitch - 3.58) / 2, lo + pitch + (pitch - 3.58) / 2],
        [hi - (pitch - 3.58) / 2, hi],
      ]) {
        pane(out, f, -half, half, i, j, 'concrete', color);
        if (i > lo && j < hi) pane(out, f, -half, half, i, j, 'concrete', color, -1.35, true);
      }
      if (level !== 'skyline')
        for (let r = 0; r < 2; r++)
          for (let col = 0; col < 6; col++) {
            const u = -half + (col + 0.5) * cell,
              left = u - 1.79,
              right = u + 1.79,
              y = lo + r * pitch,
              low = y + (pitch - 3.58) / 2,
              high = low + 3.58;
            const p = [at(f, left, low), at(f, right, low), at(f, right, high), at(f, left, high)],
              q = [
                at(f, left, low, -1.35),
                at(f, right, low, -1.35),
                at(f, right, high, -1.35),
                at(f, left, high, -1.35),
              ];
            for (let j = 0; j < 4; j++)
              face(out, 'concrete', [p[j], p[(j + 1) % 4], q[(j + 1) % 4], q[j]], pale);
          }
    }
    const n = { skyline: 12, district: 12, street: 24, closeup: 48 }[level];
    loft(out, 'metal', [radialRing(lo, 7.25, 7.25, n), radialRing(hi, 7.25, 7.25, n)], coreColor, {
      cap: false,
    });
    if (level === 'closeup') {
      for (let j = 0; j < 24; j++) {
        const a = (j * Math.PI) / 12;
        tube(
          out,
          'metal',
          [7.27 * Math.cos(a), lo, 7.27 * Math.sin(a)],
          [7.27 * Math.cos(a), hi, 7.27 * Math.sin(a)],
          0.018,
          [0.38, 0.4, 0.39],
          4,
        );
      }
      for (const y of [lo + 2.35, lo + 4.7, lo + 7.05])
        for (let j = 0; j < 24; j++) {
          const a = (j * 2 * Math.PI) / 24,
            b = ((j + 1) * 2 * Math.PI) / 24;
          tube(
            out,
            'metal',
            [7.27 * Math.cos(a), y, 7.27 * Math.sin(a)],
            [7.27 * Math.cos(b), y, 7.27 * Math.sin(b)],
            0.018,
            [0.38, 0.4, 0.39],
            4,
          );
        }
    }
  }
}
function arrival(out, level) {
  const color = level === 'skyline' ? pale.map((v, i) => v * means.concrete_plain[i]) : pale;
  box(out, 'concrete', [-half - 3.6, 4.14, -6.4], [-half + 0.1, 4.46, 6.4], color);
  for (const z of [-5.9, 5.9])
    box(out, 'concrete', [-half - 3.45, 0, z - 0.18], [-half - 3.05, 4.14, z + 0.18], color);
  if (level === 'skyline') return;
  mappedCap(out, 'stone', rect(-half - 3.5, -6.3, -half, 6.3), 0.012, [0.52, 0.51, 0.47]);
  for (const z of [-2.2, 2.2]) {
    const x = -half - 0.2,
      n = level === 'district' ? 8 : level === 'street' ? 16 : 32;
    loft(
      out,
      'clear_glass',
      [
        radialRing(0, 1.1, 1.1, n).map((p) => [p[0] + x, p[1], p[2] + z]),
        radialRing(3.3, 1.1, 1.1, n).map((p) => [p[0] + x, p[1], p[2] + z]),
      ],
      [0.7, 0.77, 0.77],
      { cap: false },
    );
    loft(
      out,
      'metal',
      [
        radialRing(3.3, 1.2, 1.2, n).map((p) => [p[0] + x, p[1], p[2] + z]),
        radialRing(3.48, 1.2, 1.2, n).map((p) => [p[0] + x, p[1], p[2] + z]),
      ],
      [0.43, 0.43, 0.4],
    );
    if (level !== 'district') {
      tube(out, 'metal', [x, 0, z], [x, 3.3, z], 0.045, metal, 6);
      for (let j = 0; j < 3; j++) {
        const a = (j * 2 * Math.PI) / 3,
          p = [x + 1.1 * Math.cos(a), 0, z + 1.1 * Math.sin(a)],
          q = [p[0], 3.3, p[2]];
        face(out, 'clear_glass', [[x, 0, z], p, q, [x, 3.3, z]], [0.6, 0.73, 0.73]);
      }
    }
  }
}
function liftedFace(out, slot, points, color) {
  const n = normalFor(...points);
  face(
    out,
    slot,
    points.map((p) => p.map((v, i) => v + n[i] * 0.03)),
    color,
  );
}
function podium(out, level) {
  const plan = partPlan(
    frame,
    parts.find((p) => p.id === 463386820),
  );
  const x0 = Math.min(...plan.map((p) => p[0])),
    x1 = Math.max(...plan.map((p) => p[0])),
    z0 = Math.min(...plan.map((p) => p[1])),
    z1 = Math.max(...plan.map((p) => p[1]));
  const color = level === 'skyline' ? pale.map((v, i) => v * means.concrete_plain[i]) : pale;
  for (const p of [rect(cx + half, z0, x1, z1), rect(x0, z0, cx + half, cz - half)]) {
    if (Math.max(...p.map((p) => p[0])) - Math.min(...p.map((p) => p[0])) < 0.1) continue;
    if (level === 'skyline') mappedSolid(out, 'concrete', p, 0, 30, color);
    else {
      for (let k = 0; k < 4; k++) {
        const a = p[k],
          b = p[(k + 1) % 4],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (
          Math.abs(a[0] - cx - half) < 0.02 &&
          Math.abs(b[0] - cx - half) < 0.02 &&
          Math.min(a[1], b[1]) >= cz - half - 0.02
        )
          continue;
        const count = Math.max(1, Math.round(len / 4.75));
        face(
          out,
          'glass',
          [
            [a[0], 0.05, a[1]],
            [b[0], 0.05, b[1]],
            [b[0], 29.4, b[1]],
            [a[0], 29.4, a[1]],
          ],
          blue,
        );
        for (let j = 0; j <= count; j++) {
          const t = j / count,
            w = 0.3 / len,
            left = Math.max(0, t - w),
            right = Math.min(1, t + w);
          liftedFace(
            out,
            'concrete',
            [
              [a[0] + (b[0] - a[0]) * left, 0, a[1] + (b[1] - a[1]) * left],
              [a[0] + (b[0] - a[0]) * right, 0, a[1] + (b[1] - a[1]) * right],
              [a[0] + (b[0] - a[0]) * right, 29.4, a[1] + (b[1] - a[1]) * right],
              [a[0] + (b[0] - a[0]) * left, 29.4, a[1] + (b[1] - a[1]) * left],
            ],
            pale,
          );
        }
        for (let j = 0; j <= 6; j++) {
          const y = j * 4.9;
          liftedFace(
            out,
            'concrete',
            [
              [a[0], Math.max(0, y - 0.3), a[1]],
              [b[0], Math.max(0, y - 0.3), b[1]],
              [b[0], Math.min(29.4, y + 0.3), b[1]],
              [a[0], Math.min(29.4, y + 0.3), a[1]],
            ],
            pale,
          );
        }
      }
      mappedSolid(out, 'concrete', p, 29.4, 30, pale);
      mappedCap(out, 'concrete', p, 30, pale);
    }
    if (level === 'closeup')
      guardrail(
        out,
        p.map(([x, z]) => [x, 30.02, z]),
        0.9,
        [0.45, 0.47, 0.45],
      );
    const a = Math.min(...p.map((p) => p[0])),
      b = Math.max(...p.map((p) => p[0]));
    // Planters are below the skyline's1.6m error and disappear only at that level.
    for (let x = a + 2.1; level !== 'skyline' && x < b - 1.3; x += 4.8) {
      box(
        out,
        'concrete',
        [x - 0.7, 30, z0 + 1.1],
        [x + 0.7, 30.5, z0 + 2.2],
        level === 'skyline'
          ? [0.5, 0.51, 0.48].map((v, i) => v * means.concrete_plain[i])
          : [0.5, 0.51, 0.48],
      );
      box(
        out,
        'foliage',
        [x - 0.6, 30.5, z0 + 1.2],
        [x + 0.6, 31.05, z0 + 2.1],
        [0.18, 0.26, 0.13],
      );
    }
  }
}
function build(out, level) {
  const shaft = rotatedBuilder(out, 0, [cx, 0, cz]);
  closedBands(shaft, level);
  openDrums(shaft, level);
  arrival(shaft, level);
  podium(out, level);
}
export const buildPark432Skyline = (out) => build(out, 'skyline');
export const buildPark432District = (out) => build(out, 'district');
export const buildPark432Street = (out) => build(out, 'street');
export const buildPark432Closeup = (out) => build(out, 'closeup');
