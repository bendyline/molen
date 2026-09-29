/** Individually authored skyline exteriors. Dimensions are meters, +Y up. */

import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

export {
  axes,
  bandPlan,
  cap,
  clockwise,
  commonLimit,
  face,
  glazedOutline,
  grid,
  guardrail,
  lerp,
  localGeographic,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  rectangularPlan,
  ringAt,
  rotatedBuilder,
  shift,
  solidPlan,
  tri,
};

const ref = 'palette:#ffffff';
const metal = [0.66, 0.7, 0.72],
  pale = [0.87, 0.86, 0.82],
  dark = [0.075, 0.095, 0.105];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const shift = (p, n, d) => p.map((v, i) => v + n[i] * d);
function tri(out, slot, p, color) {
  out.addTriangle(
    slot,
    ref,
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    color,
  );
}
function face(out, slot, p, color) {
  tri(out, slot, [p[0], p[1], p[2]], color);
  tri(out, slot, [p[0], p[2], p[3]], color);
}
function panel(out, p, color, frame = 0.07, frameColor = metal, slot = 'metal') {
  const n = normalFor(p[0], p[1], p[2]);
  const w = Math.hypot(...p[1].map((v, i) => v - p[0][i]));
  const h = Math.hypot(...p[3].map((v, i) => v - p[0][i]));
  const u = Math.min(0.22, frame / w),
    v = Math.min(0.22, frame / h);
  const a = lerp(p[0], p[1], u),
    b = lerp(p[0], p[1], 1 - u),
    c = lerp(p[3], p[2], 1 - u),
    d = lerp(p[3], p[2], u);
  const inner = [lerp(a, d, v), lerp(b, c, v), lerp(b, c, 1 - v), lerp(a, d, 1 - v)];
  face(out, 'glass', inner, color);
  for (let i = 0; i < 4; i++) {
    const k = (i + 1) % 4;
    face(out, slot, [p[i], p[k], inner[k], inner[i]], frameColor);
  }
  // Real projecting frame sections instead of a coplanar solid underlay.
  if (frame > 0.15)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      beam(out, slot, shift(p[i], n, 0.04), shift(p[k], n, 0.04), 0.08, 0.1, frameColor);
    }
}
function grid(out, p, color, dx = 1.5, dy = 3.4, frame = 0.07, frameColor = metal, slot = 'metal') {
  const nx = Math.max(1, Math.ceil(Math.hypot(...p[1].map((v, i) => v - p[0][i])) / dx));
  const ny = Math.max(1, Math.ceil(Math.hypot(...p[3].map((v, i) => v - p[0][i])) / dy));
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const a = lerp(p[0], p[3], j / ny),
        b = lerp(p[1], p[2], j / ny),
        c = lerp(p[1], p[2], (j + 1) / ny),
        d = lerp(p[0], p[3], (j + 1) / ny);
      panel(
        out,
        [
          lerp(a, b, i / nx),
          lerp(a, b, (i + 1) / nx),
          lerp(d, c, (i + 1) / nx),
          lerp(d, c, i / nx),
        ],
        color,
        frame,
        frameColor,
        slot,
      );
    }
}
function cap(out, slot, ring, color, reverse = false) {
  const center = [
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
    ring[0][1],
    ring.reduce((s, p) => s + p[2], 0) / ring.length,
  ];
  for (let i = 0; i < ring.length; i++) {
    const p = [center, ring[i], ring[(i + 1) % ring.length]];
    tri(out, slot, reverse ? p.toReversed() : p, color);
  }
}
/** Ear clipping for surveyed concave podiums; courtyard holes remain open. */
function mappedCap(out, slot, plan, y, color, holes = [], reverse = false) {
  const contours = [plan, ...holes];
  const points = contours.flat().map(([x, z]) => [x, y, z]);
  for (const indices of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    holes.map((h) => h.map((p) => new Vector2(...p))),
  )) {
    let p = indices.map((i) => points[i]);
    if (normalFor(...p)[1] < 0) p = p.toReversed();
    tri(out, slot, reverse ? p.toReversed() : p, color);
  }
}
function mappedSolid(out, slot, plan, y0, y1, color, holes = []) {
  loft(out, slot, [ringAt(plan, y0), ringAt(plan, y1)], color, { cap: false });
  for (const hole of holes) {
    const h = clockwise(hole).toReversed();
    loft(out, slot, [ringAt(h, y0), ringAt(h, y1)], color, { cap: false });
  }
  mappedCap(out, slot, plan, y0, color, holes, true);
  mappedCap(out, slot, plan, y1, color, holes);
}
function clockwise(points) {
  const area = points.reduce(
    (s, p, i) =>
      s + p[0] * points[(i + 1) % points.length][1] - points[(i + 1) % points.length][0] * p[1],
    0,
  );
  return area > 0 ? points.toReversed() : points;
}
const localOutline = (m) => clockwise(m.geometry.outline.slice(0, -1));
const ringAt = (plan, y) => plan.map(([x, z]) => [x, y, z]);
function partsEvidence(key) {
  return JSON.parse(readFileSync(structureSourcePath(key, 'map-parts.json'), 'utf8')).elements;
}
function localGeographic(m, lon, lat) {
  const east = (lon - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
    south = -(lat - m.anchor[1]) * 111319.490793;
  return [
    east * Math.cos(m.heading) - south * Math.sin(m.heading),
    east * Math.sin(m.heading) + south * Math.cos(m.heading),
  ];
}
const partPlan = (m, p) =>
  clockwise(p.geometry.slice(0, -1).map((g) => localGeographic(m, g.lon, g.lat)));
function curveValue(samples, y) {
  for (let i = 1; i < samples.length; i++) {
    if (y <= samples[i][0]) {
      const [a, b] = [samples[i - 1], samples[i]];
      return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
    }
  }
  return samples.at(-1)[1];
}
function rotatedBuilder(out, heading, offset = [0, 0, 0], tint) {
  const c = Math.cos(heading),
    s = Math.sin(heading);
  const rot = (p) => [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  const result = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    result[method] = (slot, ref, p, n, uv, color) =>
      out[method](
        slot,
        ref,
        p.map((v) => rot(v).map((x, k) => x + offset[k])),
        rot(n),
        uv,
        tint && slot === 'cladding' ? color.map((v, k) => v * tint[k]) : color,
      );
  return result;
}
function facadeClock(
  out,
  center,
  width,
  height,
  front,
  rimColor = [0.81, 0.74, 0.45],
  dialColor = [0.1, 0.22, 0.19],
  numbered = false,
) {
  const right = [front[2], 0, -front[0]],
    at = (x, y, z = 0) => center.map((v, k) => v + right[k] * x + (k === 1 ? y : 0) + front[k] * z);
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2,
      b = ((i + 1) / 96) * Math.PI * 2;
    const ring = (t, r) => at(Math.cos(t) * width * 0.5 * r, Math.sin(t) * height * 0.5 * r);
    face(out, 'metal', [ring(a, 1), ring(b, 1), ring(b, 0.93), ring(a, 0.93)], rimColor);
    tri(out, 'recess', [at(0, 0, -0.03), ring(a, 0.929), ring(b, 0.929)], dialColor);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2,
      r0 = i % 5 === 0 && !numbered ? 0.78 : 0.86;
    beam(
      out,
      'metal',
      at(Math.sin(a) * width * 0.5 * r0, Math.cos(a) * height * 0.5 * r0, 0.06),
      at(Math.sin(a) * width * 0.5 * 0.91, Math.cos(a) * height * 0.5 * 0.91, 0.06),
      i % 5 === 0 ? width * 0.013 : width * 0.004,
      0.06,
      rimColor,
    );
  }
  if (numbered) clockNumerals(out, at, width, height);
  // Fixed representative time, deliberately no unsupported decorative script.
  beam(
    out,
    'metal',
    at(0, 0, 0.14),
    at(-width * 0.23, height * 0.22, 0.14),
    width * 0.018,
    0.16,
    [0.92, 0.9, 0.73],
  );
  beam(
    out,
    'metal',
    at(0, 0, 0.25),
    at(width * 0.25, height * 0.39, 0.25),
    width * 0.012,
    0.14,
    [0.94, 0.92, 0.76],
  );
}
// Original geometric numeral strokes, approximately seven meters high on the
// Makkah dials as documented by their manufacturer. These are modeled strokes,
// not a copied font or an embedded per-model texture.
function clockNumerals(out, at, width, height) {
  const arc = (cx, cy, rx, ry, a, b, count = 22) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const t = a + ((b - a) * i) / count;
      return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
    });
  const pi = Math.PI;
  const paths = {
    0: [arc(0.5, 0.5, 0.42, 0.47, 0, 2 * pi, 40)],
    1: [
      [
        [0.13, 0.77],
        [0.5, 0.97],
        [0.5, 0.03],
      ],
      [
        [0.16, 0.03],
        [0.88, 0.03],
      ],
    ],
    2: [[...arc(0.5, 0.75, 0.43, 0.23, pi, -0.6), [0.1, 0.03], [0.95, 0.03]]],
    3: [
      [...arc(0.45, 0.74, 0.47, 0.24, 2.5, -pi / 2), ...arc(0.45, 0.27, 0.47, 0.25, pi / 2, -2.5)],
    ],
    4: [
      [
        [0.7, 0.96],
        [0.06, 0.34],
        [0.98, 0.34],
      ],
      [
        [0.71, 0.97],
        [0.71, 0.03],
      ],
    ],
    5: [[[0.92, 0.96], [0.13, 0.96], [0.08, 0.54], ...arc(0.46, 0.29, 0.46, 0.27, 2.1, -2.5)]],
    6: [[...arc(0.53, 0.5, 0.46, 0.47, 0.8, pi * 1.1), ...arc(0.52, 0.3, 0.43, 0.28, pi, -pi)]],
    7: [
      [
        [0.06, 0.97],
        [0.97, 0.97],
        [0.26, 0.03],
      ],
    ],
    8: [arc(0.5, 0.75, 0.38, 0.22, 0, 2 * pi, 30), arc(0.5, 0.28, 0.45, 0.26, 0, 2 * pi, 32)],
    9: [[...arc(0.48, 0.72, 0.43, 0.26, 0, 2 * pi), ...arc(0.48, 0.5, 0.43, 0.47, 0.4, -2.2)]],
  };
  const numeralHeight = height * (7 / 43),
    digitWidth = numeralHeight * 0.52;
  for (let hour = 1; hour <= 12; hour++) {
    const label = String(hour),
      a = (hour * pi) / 6;
    const cx = Math.sin(a) * width * 0.335,
      cy = Math.cos(a) * height * 0.335;
    for (let digit = 0; digit < label.length; digit++)
      for (const path of paths[label[digit]])
        for (let i = 1; i < path.length; i++) {
          const point = (p) =>
            at(
              cx + (p[0] + digit * 1.18 - (label.length * 1.18 - 0.18) / 2) * digitWidth,
              cy + (p[1] - 0.5) * numeralHeight,
              0.12,
            );
          beam(
            out,
            'metal',
            point(path[i - 1]),
            point(path[i]),
            numeralHeight * 0.115,
            0.15,
            [0.93, 0.91, 0.75],
          );
        }
  }
}
function glazedOutline(out, plan, y0, y1, dy, color, frameColor = metal, frame = 0.07) {
  for (let i = 0; i < plan.length; i++) {
    const k = (i + 1) % plan.length,
      a = plan[i],
      b = plan[k];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
    grid(
      out,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      color,
      1.6,
      dy,
      frame,
      frameColor,
    );
  }
}
function guardrail(out, ring, height = 1.15, color = metal) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    beam(
      out,
      'metal',
      shift(a, [0, 1, 0], height),
      shift(b, [0, 1, 0], height),
      0.055,
      0.055,
      color,
    );
    const count = Math.ceil(Math.hypot(...b.map((v, j) => v - a[j])) / 1.4);
    for (let k = 0; k < count; k++) {
      const p = lerp(a, b, k / count);
      beam(out, 'metal', p, shift(p, [0, 1, 0], height), 0.045, 0.045, color);
    }
  }
}

function buildGrandeArche(out) {
  const w = 106.9 / 2,
    d = 56,
    h = 110.9,
    inner = 35,
    y0 = 12.5,
    y1 = 98.5;
  for (const s of [-1, 1]) {
    const lo = s < 0 ? -w : inner,
      hi = s < 0 ? -inner : w;
    box(out, 'cladding', [lo, 0, -d], [hi, h, d], pale);
    // Glass office faces sit on the sides of the solid white end frames.
    for (const x of [lo, hi]) {
      const sign = x === lo ? -1 : 1;
      const p = [
        [x + sign * 0.03, 2, -d + 1.6],
        [x + sign * 0.03, 2, d - 1.6],
        [x + sign * 0.03, h - 2, d - 1.6],
        [x + sign * 0.03, h - 2, -d + 1.6],
      ];
      grid(
        out,
        sign < 0 ? p : p.toReversed(),
        [0.28, 0.35, 0.38],
        2.8,
        2.8,
        0.21,
        [0.69, 0.71, 0.7],
      );
    }
  }
  box(out, 'cladding', [-inner, y1, -d], [inner, h, d], pale);
  box(out, 'cladding', [-inner, 0, -d], [inner, y0, d - 27], pale);
  // Individually jointed white granite facing on both ring elevations.
  for (const z of [-d - 0.025, d + 0.025])
    for (let y = 0; y < h; y += 2.8)
      for (let x = -w; x < w; x += 2.8) {
        const xx = Math.min(w, x + 2.8),
          yy = Math.min(h, y + 2.8);
        if (x >= -inner && xx <= inner && y >= y0 && yy <= y1) continue;
        const regions = [];
        if (y < y0 && z < 0) regions.push([x, y, xx, Math.min(yy, y0)]);
        if (y < y0 && z > 0) {
          if (x < -inner) regions.push([x, y, Math.min(xx, -inner), Math.min(yy, y0)]);
          if (xx > inner) regions.push([Math.max(x, inner), y, xx, Math.min(yy, y0)]);
        }
        if (yy > y1) regions.push([x, Math.max(y, y1), xx, yy]);
        if (yy > y0 && y < y1) {
          if (x < -inner)
            regions.push([x, Math.max(y, y0), Math.min(xx, -inner), Math.min(yy, y1)]);
          if (xx > inner) regions.push([Math.max(x, inner), Math.max(y, y0), xx, Math.min(yy, y1)]);
        }
        for (const [a, b, c, e] of regions)
          if (c - a > 0.08 && e - b > 0.08) {
            const p = [
              [a + 0.015, b + 0.015, z],
              [c - 0.015, b + 0.015, z],
              [c - 0.015, e - 0.015, z],
              [a + 0.015, e - 0.015, z],
            ];
            face(
              out,
              'cladding',
              z > 0 ? p : p.toReversed(),
              pale.map(
                (v) =>
                  v *
                  (0.978 + (0.018 * ((Math.round(x * 10) + Math.round(y * 10) + 8000) % 7)) / 6),
              ),
            );
          }
      }
  // Monumental steps are within the structural envelope, reaching the raised central terrace.
  for (let i = 0; i < 50; i++)
    box(
      out,
      'cladding',
      [-inner, 0, d - (i + 1) * 0.54],
      [inner, 0.25 * (i + 1), d - i * 0.54],
      pale,
    );
  // Four panoramic elevator tracks and glass cars, with open lattice tower.
  for (const x of [-5.25, -1.75, 1.75, 5.25]) {
    for (const z of [-3, 0]) beam(out, 'metal', [x, y0, z], [x, y1, z], 0.19, 0.19, metal);
    for (let y = y0; y < y1; y += 3.4) {
      beam(out, 'metal', [x, y, -3], [x, Math.min(y + 3.4, y1), 0], 0.09, 0.09, metal);
      beam(out, 'metal', [x, y, 0], [x, Math.min(y + 3.4, y1), -3], 0.09, 0.09, metal);
    }
    const cy = 26 + (x + 5.25) * 3.7;
    box(out, 'glass', [x - 1.35, cy, -4.4], [x + 1.35, cy + 3.5, -1.8], [0.35, 0.47, 0.5]);
  }
  // The suspended cloud is an explicitly reconstructed multi-lobed tension surface.
  for (const [cx, cz, rx, rz, raise] of [
    [-10, 17, 19, 15, 3],
    [10, 13, 18, 19, 7],
    [-4, -10, 23, 14, 5],
  ]) {
    const n = 48,
      point = (i, r) => {
        const a = (i * Math.PI * 2) / n;
        return [
          cx + rx * r * Math.cos(a),
          24 + raise * r * r + 3 * Math.sin(a * 2) * r,
          cz + rz * r * Math.sin(a),
        ];
      };
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < n; i++) {
        if (j === 0) {
          const p = [point(i, 0), point(i + 1, 0.1), point(i, 0.1)];
          tri(out, 'canvas', p, pale);
          tri(out, 'canvas', p.toReversed(), pale);
        } else {
          const p = [
            point(i, j / 10),
            point(i + 1, j / 10),
            point(i + 1, (j + 1) / 10),
            point(i, (j + 1) / 10),
          ];
          face(out, 'canvas', p, pale);
          face(out, 'canvas', p.toReversed(), pale);
        }
      }
    for (let i = 0; i < n; i++) tube(out, 'metal', point(i, 1), point(i + 1, 1), 0.035, metal, 5);
    for (const i of [3, 15, 27, 39]) {
      const p = point(i, 1);
      tube(out, 'metal', p, [p[0] < 0 ? -inner : inner, 48, p[2]], 0.07, metal, 6);
    }
  }
  guardrail(
    out,
    [
      [-w + 1, h, -d + 1],
      [-w + 1, h, d - 1],
      [w - 1, h, d - 1],
      [w - 1, h, -d + 1],
    ],
    0.8,
  );
}

function gherkinRadius(y) {
  const samples = [
    [0, 22.5],
    [8, 24.2],
    [35, 27.3],
    [67, 28.3],
    [90, 27.7],
    [115, 24.7],
    [138, 19.3],
    [157, 12.6],
    [169, 7.1],
    [176, 3.65],
    [179, 1.5],
    [180, 0.18],
  ];
  let j = 1;
  while (j < samples.length - 1 && y > samples[j][0]) j++;
  const [a, b] = [samples[j - 1], samples[j]];
  const t = (y - a[0]) / (b[0] - a[0]);
  return a[1] + (b[1] - a[1]) * t;
}
function buildGherkin(out) {
  const n = 72,
    levels = [
      0.25,
      8,
      ...Array.from({ length: 38 }, (_, i) => 12 + i * 4.2),
      172,
      176,
      178.2,
      179.3,
      180,
    ].filter((y, i, a) => i === 0 || y > a[i - 1]);
  const p = (y, i) => {
    const a = (-i * Math.PI * 2) / n;
    return [gherkinRadius(y) * Math.cos(a), y, gherkinRadius(y) * Math.sin(a)];
  };
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const y0 = levels[j - 1],
        y1 = levels[j];
      const a = p(y0, i),
        b = p(y0, i + 1),
        c = p(y1, i + 1),
        d = p(y1, i);
      const sector = (i - Math.floor(y0 / 4.2) + 720) % 12,
        tint = sector < 2 ? [0.075, 0.14, 0.18] : [0.27, 0.38, 0.43];
      panel(out, [a, b, c, d], tint, 0.045, [0.49, 0.57, 0.6]);
      // Fine triangular curtain wall grid covers each complete diamond.
      beam(
        out,
        'metal',
        shift(a, [a[0] / gherkinRadius(y0), 0, a[2] / gherkinRadius(y0)], 0.06),
        shift(c, [c[0] / gherkinRadius(y1), 0, c[2] / gherkinRadius(y1)], 0.06),
        0.085,
        0.08,
        metal,
      );
    }
  // Structural diagonals form the six-story spiralling diamond modules.
  for (let start = 0; start < 24; start++)
    for (const sign of [-1, 1])
      for (let y = 8; y < 172; y += 4.2) {
        const a0 = start * 3 + (sign * (y - 8)) / 8.4,
          a1 = start * 3 + (sign * (Math.min(y + 4.2, 172) - 8)) / 8.4;
        const a = p(y, a0),
          b = p(Math.min(y + 4.2, 172), a1);
        beam(
          out,
          'metal',
          shift(a, [a[0] / gherkinRadius(y), 0, a[2] / gherkinRadius(y)], 0.14),
          shift(
            b,
            [
              b[0] / gherkinRadius(Math.min(y + 4.2, 172)),
              0,
              b[2] / gherkinRadius(Math.min(y + 4.2, 172)),
            ],
            0.14,
          ),
          0.17,
          0.18,
          [0.5, 0.57, 0.6],
        );
      }
  for (let i = 0; i < 24; i++) {
    const a = p(0.2, i * 3),
      b = p(8, i * 3 + 1.5);
    tube(out, 'metal', a, b, 0.28, metal, 10);
  }
  loft(out, 'stone', [radialRing(0, 23, 23, 72), radialRing(0.25, 23, 23, 72)], [0.54, 0.54, 0.5]);
  cap(out, 'glass', radialRing(180, 0.18, 0.18, 24), [0.23, 0.35, 0.41]);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const c = [22.7 * Math.cos(a), 0, 22.7 * Math.sin(a)];
    tube(out, 'glass', [c[0], 0.25, c[2]], [c[0], 3.6, c[2]], 1.65, [0.3, 0.4, 0.43], 20);
  }
}

function buildMontparnasse(out, mapped) {
  const plan = localOutline(mapped),
    frame = [0.105, 0.11, 0.115],
    glass = [0.115, 0.14, 0.16];
  loft(out, 'stone', [ringAt(plan, 0), ringAt(plan, 0.5)], [0.24, 0.245, 0.24]);
  glazedOutline(out, plan, 0.5, 196, 3.45, glass, frame, 0.105);
  glazedOutline(out, plan, 196, 206.5, 3.5, [0.17, 0.205, 0.23], frame, 0.13);
  cap(out, 'metal', ringAt(plan, 206.5), [0.28, 0.3, 0.3]);
  const roofPlan = plan.map(([x, z]) => [x * 0.97, z * 0.97]);
  guardrail(out, ringAt(roofPlan, 208.65), 1.35, frame);
  // Continuous glazed parapet with a roof terrace and small central service penthouse.
  glazedOutline(out, roofPlan, 206.5, 208.65, 2.15, [0.25, 0.29, 0.31], frame, 0.09);
  cap(out, 'stone', ringAt(roofPlan, 206.52), [0.57, 0.57, 0.53]);
  box(out, 'metal', [-12, 206.53, -5], [10, 209.2, 5], frame);
  for (let x = -10; x < 8; x += 1.2)
    box(out, 'metal', [x, 209.2, -3.9], [x + 0.12, 209.6, 3.9], [0.23, 0.25, 0.25]);
  for (const z of [-19.4, 19.4])
    for (let x = -17; x <= 17; x += 3.4)
      beam(out, 'metal', [x, 0.5, z], [x, 7, z], 0.27, 0.28, frame);
}

function rectangularPlan(w, d, cx = 0, cz = 0) {
  return [
    [cx - w / 2, cz - d / 2],
    [cx - w / 2, cz + d / 2],
    [cx + w / 2, cz + d / 2],
    [cx + w / 2, cz - d / 2],
  ];
}
function solidPlan(out, slot, plan, y0, y1, color) {
  loft(out, slot, [ringAt(plan, y0), ringAt(plan, y1)], color, { cap: false });
  cap(out, slot, ringAt(plan, y0), color, true);
  cap(out, slot, ringAt(plan, y1), color);
}
function bandPlan(out, plan, y, h, depth, color = pale, slot = 'concrete') {
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    beam(out, slot, [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], depth, h, color);
  }
}
function buildMirante(out, mapped) {
  const plan = localOutline(mapped);
  solidPlan(out, 'stone', plan, 0, 0.55, [0.37, 0.38, 0.37]);
  glazedOutline(out, plan, 0.55, 7, 3.3, [0.18, 0.22, 0.23], [0.53, 0.54, 0.52], 0.17);
  // The thin slab and asymmetrically clipped eastern end follow the actual map perimeter.
  glazedOutline(out, plan, 7, 166.8, 3.33, [0.29, 0.34, 0.35], [0.66, 0.67, 0.63], 0.12);
  for (let y = 7; y < 167; y += 3.33)
    bandPlan(out, plan, y, 0.18, 0.22, [0.58, 0.6, 0.58], 'metal');
  bandPlan(out, plan, 166.8, 1.1, 0.55, [0.64, 0.64, 0.6]);
  solidPlan(out, 'metal', plan, 167.9, 168.1, [0.31, 0.33, 0.33]);
  const inner = plan.map(([x, z]) => [x * 0.91, z * 0.77]);
  solidPlan(out, 'concrete', inner, 168.1, 170, [0.62, 0.62, 0.58]);
  // Exterior AC boxes are attached to the long elevations and have separate louvers.
  for (const z of [-9.33, 9.35])
    for (let floor = 3; floor < 46; floor++)
      for (let bay = 0; bay < 36; bay++)
        if ((floor * 19 + bay * 7 + (z > 0 ? 3 : 0)) % 13 === 0) {
          const x = -29 + bay * 1.65,
            y = 8 + floor * 3.33;
          box(
            out,
            'metal',
            [x - 0.4, y, z - (z < 0 ? 0.42 : 0)],
            [x + 0.4, y + 0.6, z + (z > 0 ? 0.42 : 0)],
            [0.54, 0.55, 0.51],
          );
          for (let k = 1; k < 5; k++)
            beam(
              out,
              'metal',
              [x - 0.35, y + k * 0.115, z + (z > 0 ? 0.43 : -0.43)],
              [x + 0.35, y + k * 0.115, z + (z > 0 ? 0.43 : -0.43)],
              0.022,
              0.025,
              [0.25, 0.28, 0.28],
            );
        }
  // Four current operator-described projecting observation boxes at the42nd-floor deck.
  for (const [x, z, sx, sz] of [
    [0, 10.2, 2.1, 2.5],
    [0, -10.2, 2.1, 2.5],
    [34, 0, 2.5, 2.1],
    [-35, 0, 2.5, 2.1],
  ]) {
    box(
      out,
      'glass',
      [x - sx / 2, 150, z - sz / 2],
      [x + sx / 2, 153, z + sz / 2],
      [0.28, 0.42, 0.45],
    );
    for (const xx of [x - sx / 2, x + sx / 2])
      for (const zz of [z - sz / 2, z + sz / 2])
        beam(out, 'metal', [xx, 150, zz], [xx, 153, zz], 0.05, 0.05, metal);
  }
}

function masonryTier(out, w, d, y0, y1, cx = 0, cz = 0) {
  const plan = rectangularPlan(w, d, cx, cz),
    color = [0.28, 0.31, 0.315];
  solidPlan(out, 'cladding', plan, y0, y1, pale);
  for (let f = 0; f < 4; f++) {
    const a = plan[f],
      b = plan[(f + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len];
    const columns = Math.max(1, Math.floor(len / 2.6)),
      rows = Math.max(1, Math.round((y1 - y0) / 3.8));
    for (let i = 0; i < columns; i++)
      for (let j = 0; j < rows; j++) {
        const u = (i + 0.5) / columns,
          cy = y0 + ((j + 0.5) * (y1 - y0)) / rows,
          center = lerp([a[0], cy, a[1]], [b[0], cy, b[1]], u),
          ww = Math.min(1.15, (len / columns) * 0.52),
          hh = Math.min(2.25, ((y1 - y0) / rows) * 0.66),
          t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
        const p = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) =>
          center.map(
            (x, k) => x + (t[k] * u * ww) / 2 + (k === 1 ? (v * hh) / 2 : 0) + n[k] * 0.035,
          ),
        );
        panel(out, p, color, 0.065, [0.66, 0.66, 0.61], 'cladding');
        beam(
          out,
          'cladding',
          shift(p[0], n, 0.14),
          shift(p[1], n, 0.14),
          0.22,
          0.12,
          [0.81, 0.8, 0.74],
        );
      }
    // Vertical Art Deco pilasters give the tower its ribbed white appearance.
    for (let i = 1; i < columns; i++) {
      const p = lerp([a[0], y0, a[1]], [b[0], y0, b[1]], i / columns);
      beam(
        out,
        'cladding',
        shift(p, n, 0.11),
        shift([p[0], y1, p[2]], n, 0.11),
        0.3,
        0.32,
        [0.83, 0.82, 0.77],
      );
    }
  }
  bandPlan(out, plan, y1 - 0.32, 0.32, 0.6, pale, 'cladding');
  return plan;
}
function buildAltino(out, mapped) {
  const plan = localOutline(mapped);
  solidPlan(out, 'cladding', plan, 0, 12.5, [0.72, 0.72, 0.67]);
  for (const [w, d, y0, y1] of [
    [38, 15.4, 12.5, 91],
    [31, 14, 91, 107],
    [23, 12.5, 107, 122],
    [16, 10.5, 122, 135],
    [10, 8.5, 135, 140.52],
  ]) {
    const ring = masonryTier(out, w, d, y0, y1, 1.7, 0);
    guardrail(
      out,
      ringAt(
        ring.map(([x, z]) => [x * 0.99, z * 0.97]),
        y1,
      ),
      0.8,
      [0.55, 0.55, 0.51],
    );
  }
  // Cylindrical lighthouse crown and the published11.7 m beacon +9 m flag mast.
  for (const [y0, y1, r] of [
    [140.52, 143, 4.2],
    [143, 149.8, 3.5],
    [149.8, 152.22, 2.5],
  ]) {
    const ring = radialRing(y0, r, r, 32, [1.7, 0]);
    loft(
      out,
      y0 === 143 ? 'glass' : 'cladding',
      [ring, radialRing(y1, r, r, 32, [1.7, 0])],
      y0 === 143 ? [0.32, 0.38, 0.39] : pale,
    );
    torus(out, 'cladding', [1.7, y0, 0], r + 0.13, 0.16, pale, 40, 8);
    if (y0 === 143)
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8;
        beam(
          out,
          'cladding',
          [1.7 + r * Math.cos(a), y0, r * Math.sin(a)],
          [1.7 + r * Math.cos(a), y1, r * Math.sin(a)],
          0.16,
          0.16,
          pale,
        );
      }
  }
  tube(out, 'metal', [1.7, 152.22, 0], [1.7, 161.22, 0], 0.12, metal, 12);
  // São Paulo state flag:13 alternating stripes and red canton, static exterior cloth.
  for (let stripe = 0; stripe < 13; stripe++) {
    const y = 158.8 - stripe * 0.18;
    for (let i = 0; i < 12; i++) {
      const x0 = 1.82 + i * 0.34,
        x1 = x0 + 0.34,
        z0 = 0.2 * Math.sin(i * 0.65),
        z1 = 0.2 * Math.sin((i + 1) * 0.65);
      const p = [
          [x0, y - 0.18, z0],
          [x1, y - 0.18, z1],
          [x1, y, z1],
          [x0, y, z0],
        ],
        c = stripe % 2 ? [0.86, 0.86, 0.81] : [0.055, 0.06, 0.06];
      face(out, 'canvas', p, c);
      face(out, 'canvas', p.toReversed(), c);
    }
  }
  const canton = [
    [1.83, 157.72, 0.045],
    [3.32, 157.72, 0.045],
    [3.32, 158.8, 0.045],
    [1.83, 158.8, 0.045],
  ];
  face(out, 'canvas', canton, [0.65, 0.03, 0.04]);
  face(out, 'canvas', canton.toReversed(), [0.65, 0.03, 0.04]);
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      b = ((i + 1) * Math.PI) / 16;
    const p = [
      [2.57, 158.26, 0.055],
      [2.57 + 0.35 * Math.cos(a), 158.26 + 0.35 * Math.sin(a), 0.055],
      [2.57 + 0.35 * Math.cos(b), 158.26 + 0.35 * Math.sin(b), 0.055],
    ];
    tri(out, 'canvas', p, pale);
    tri(out, 'canvas', p.toReversed(), pale);
  }
  // Tall recessed bank entrance along the mapped public frontage.
  box(out, 'recess', [-3, 0.4, 8.31], [6, 8.6, 8.36], dark);
  for (const x of [-3, 6]) box(out, 'cladding', [x - 0.5, 0, 8.38], [x + 0.5, 10.8, 8.88], pale);
}

function buildItalia(out, mapped) {
  const plan = localOutline(mapped);
  solidPlan(out, 'stone', plan, 0, 0.45, [0.4, 0.42, 0.4]);
  glazedOutline(out, plan, 0.45, 10, 3.2, [0.27, 0.32, 0.3], [0.6, 0.6, 0.55], 0.19);
  // Real projecting concrete sunshade cells wrap the curved, asymmetric mapped tower.
  for (let y = 10; y < 150.6; y += 3.2) {
    const y1 = Math.min(y + 3.2, 150.6);
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      const n = [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len];
      const cells = Math.ceil(len / 1.7);
      for (let j = 0; j < cells; j++) {
        const a0 = lerp([a[0], y, a[1]], [b[0], y, b[1]], j / cells),
          b0 = lerp([a[0], y, a[1]], [b[0], y, b[1]], (j + 1) / cells),
          c0 = [b0[0], y1, b0[2]],
          d0 = [a0[0], y1, a0[2]];
        panel(out, [a0, b0, c0, d0], [0.27, 0.3, 0.28], 0.2, [0.69, 0.7, 0.64], 'concrete');
        beam(
          out,
          'concrete',
          shift(a0, n, 0.22),
          shift(d0, n, 0.22),
          0.13,
          0.52,
          [0.75, 0.75, 0.68],
        );
        if ((i + j + Math.floor(y)) % 7 === 0)
          for (let k = 1; k < 5; k++)
            beam(
              out,
              'metal',
              shift(lerp(a0, d0, k / 5), n, 0.1),
              shift(lerp(b0, c0, k / 5), n, 0.1),
              0.085,
              0.16,
              [0.63, 0.63, 0.55],
            );
      }
      beam(
        out,
        'concrete',
        shift([a[0], y, a[1]], n, 0.24),
        shift([b[0], y, b[1]], n, 0.24),
        0.58,
        0.2,
        [0.72, 0.72, 0.66],
      );
    }
  }
  bandPlan(out, plan, 150.6, 0.4, 0.65, pale);
  const top = plan.map(([x, z]) => [x * 0.92, z * 0.88]);
  glazedOutline(out, top, 151, 158.5, 3.75, [0.19, 0.29, 0.3], [0.55, 0.57, 0.53], 0.11);
  solidPlan(out, 'concrete', top, 158.5, 159.3, pale);
  guardrail(out, ringAt(top, 159.3), 1.1, [0.43, 0.46, 0.43]);
  solidPlan(out, 'metal', rectangularPlan(14, 8, 1, 0), 159.3, 164.2, [0.58, 0.6, 0.57]);
  for (let x = -5; x <= 7; x += 1.2)
    box(out, 'metal', [x, 164.2, -3.5], [x + 0.12, 165, 3.5], [0.44, 0.47, 0.45]);
}

const commonLimit =
  'Exterior geometry uses published overall dimensions and map evidence; panel subdivision, connection dimensions and local entrance details are reconstructed. Glazing uses opaque PBR with explicit geometry; no copied facade photograph is embedded.';
const axes = {
  up: '+Y',
  longitudinal: '+X along the mapped building long axis',
  front: '+Z',
  origin: 'Ground-level center of exact-QID mapped footprint frame',
};
export const skylineExpansion = [
  {
    id: 'N0147',
    key: 'grande_arche',
    wikidataId: 'Q216357',
    title: 'Grande Arche',
    height: 110.9,
    build: buildGrandeArche,
    brief:
      'A real open monumental granite cube with office glazing on both piers, jointed white stone end frames, raised terrace and broad stair, four external glass elevators and a suspended three-lobed fabric cloud.',
    sourceFacts: {
      lengthMeters: 112,
      widthMeters: 106.9,
      heightMeters: 110.9,
      officePanelMeters: [2.8, 2.8],
      panoramicElevators: 4,
      completion: 1989,
    },
    reconstruction: {
      openingWidthMeters: 70,
      openingFloorY: 12.5,
      openingCeilingY: 98.5,
      cloud: 'Three reconstructed tension lobes; edge and suspension cables modeled',
      stoneCladding: 'Post-2017 white granite exterior',
    },
    refs: [
      'https://pop.culture.gouv.fr/notice/merimee/ACR0000683',
      'https://www.parisladefense.com/en/district/towers-buildings/grande-arche',
    ],
    nativeAxes: {
      ...axes,
      longitudinal: '+Z along the published 112 m depth',
      front: '+Z toward the southeast historic axis',
    },
    geographic: (m) => ({
      heading: m.heading + Math.PI / 2,
      notes:
        'Native X is the 106.9 m frontage, Z the 112 m depth. Rotate the exact-QID rectangle by 90 degrees so +Z faces southeast along the historic axis. Ground stair and cloud are reconstruction within this frame.',
    }),
    limitations: [
      commonLimit,
      'Cloud membrane shape, opening dimensions, stair count and elevator car elevations are exterior approximations. The internal mural is not reproduced.',
    ],
    camera: { position: [155, 112, 240], lookAt: [0, 52, 0], fov: 44 },
    qaCameras: [
      { name: 'open-cube', position: [0, 61, 175], lookAt: [0, 56, 0] },
      { name: 'cloud-lifts', position: [38, 36, 75], lookAt: [0, 32, 10] },
      { name: 'office-facade', position: [83, 58, 35], lookAt: [53.5, 52, 8] },
      { name: 'roof', position: [125, 163, 131], lookAt: [0, 105, 0] },
      { name: 'far-silhouette', position: [-260, 145, 345], lookAt: [0, 55, 0] },
    ],
  },
  {
    id: 'N0149',
    key: '30_st_mary_axe',
    wikidataId: 'Q191161',
    title: '30 St Mary Axe',
    height: 180,
    build: buildGherkin,
    brief:
      'The curved Gherkin envelope with six dark helical light-well bands, triangular glass subdivisions, external diagonal lattice, narrowed ground colonnade, circular revolving entrance pavilions and rounded glazed crown.',
    sourceFacts: { heightMeters: 180, floors: 41, spirallingLightWells: 6 },
    reconstruction: {
      maximumDiameterMeters: 56.6,
      groundDiameterMeters: 45,
      profile: 'Measured map maximum envelope with reconstructed longitudinal profile',
      facade:
        'Six dark helical bands and independently modeled triangular glazing/structural diagonals',
    },
    refs: [
      'https://thegherkin.com/',
      'https://thegherkin.com/availability/',
      'https://www.arup.com/globalassets/downloads/insights/t/tall-buildings-rising-to-the-net-zero-challenge/tall-buildings-rising-to-the-net-zero-challenge_arupv2-1.pdf',
    ],
    nativeAxes: { ...axes, front: '+Z through one of six repeated entrances' },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The exact-QID circular envelope defines the center and 56.6 m maximum diameter. Rotational facade phase is provisional within six-fold symmetry; mapped height180 and primary engineering source override the inconsistent250 m Wikidata fact.',
    }),
    limitations: [
      commonLimit,
      'Exact longitudinal curvature, facade twist phase and revolving entrance dimensions are reconstructed; the source 180 m envelope has precedence over erroneous aggregated height metadata.',
    ],
    camera: { position: [153, 126, 252], lookAt: [0, 89, 0], fov: 44 },
    qaCameras: [
      { name: 'diagrid', position: [48, 96, 58], lookAt: [8, 84, 18] },
      { name: 'ground', position: [60, 13, 64], lookAt: [0, 6, 0] },
      { name: 'crown', position: [45, 177, 68], lookAt: [0, 160, 0] },
      { name: 'reverse', position: [-139, 116, -214], lookAt: [0, 90, 0] },
      { name: 'far-silhouette', position: [260, 175, 390], lookAt: [0, 90, 0] },
    ],
  },
  {
    id: 'N0151',
    key: 'montparnasse_tower',
    wikidataId: 'Q323767',
    title: 'Montparnasse Tower',
    height: 210,
    build: buildMontparnasse,
    brief:
      'The pre-renovation dark Montparnasse silhouette follows its mapped bowed long facades and recessed ends, with 59-storey facade bands, closely spaced dark mullions, observation glazing, rooftop parapets, railings and service enclosure.',
    sourceFacts: {
      heightMeters: 210,
      floors: 59,
      windowsPublished: 7200,
      observationLevelMeters: 196,
    },
    reconstruction: {
      plan: 'Exact-QID cached perimeter; individual notches retained',
      state:
        'Established exterior before the renovation announced for2026; future facade not anticipated',
      facade:
        'Explicit windows and dark metal borders; published7200 is a reference, not an exact modeled pane count',
    },
    refs: [
      'https://www.tourmontparnasse56.com/fr/la-tour-montparnasse-en-chiffres/',
      'https://www.paris.fr/pages/la-tour-montparnasse-fete-ses-50-ans-24034',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'The authored facade follows the cached exact-QID perimeter including bowed sides and recessed ends, retaining its signed frame. This is the existing dark facade before planned renovation; actual construction staging is not modeled.',
    }),
    limitations: [
      commonLimit,
      'The source intentionally records the established dark exterior, not the planned future renovation. Roof equipment and observation terrace fittings are simplified from their visible envelope.',
    ],
    camera: { position: [185, 147, 312], lookAt: [0, 104, 0], fov: 44 },
    qaCameras: [
      { name: 'bowed-facade', position: [7, 117, 69], lookAt: [0, 103, 18] },
      { name: 'recessed-end', position: [69, 92, 15], lookAt: [29, 90, 0] },
      { name: 'terrace', position: [68, 233, 69], lookAt: [0, 207, 0] },
      { name: 'ground', position: [67, 13, 66], lookAt: [0, 5, 0] },
      { name: 'far-silhouette', position: [-285, 176, 370], lookAt: [0, 105, 0] },
    ],
  },
];

skylineExpansion.push(
  {
    id: 'N0138',
    key: 'mirante_do_vale',
    wikidataId: 'Q42258',
    title: 'Mirante do Vale',
    height: 170,
    build: buildMirante,
    brief:
      'The170 m narrow modernist slab follows the mapped clipped end, with dense metal window grid, projecting floor bands, exterior air-conditioning boxes with louvers and Sampa Sky glass observation boxes at150 m.',
    sourceFacts: { heightMeters: 170, observationDeckMeters: 150, observationFloor: 42 },
    reconstruction: {
      plan: 'Exact-QID mapped thin slab perimeter',
      facade:
        'Individual grid cells, reconstructed dispersed AC equipment and four cardinal observation boxes',
      roof: 'Reconstructed shallow recessed mechanical level',
    },
    refs: [
      'https://www.sampasky.com.br/sobre-nos',
      'https://www.farolsantander.com.br/assets/sites/2/20241204172903/Manual-de-Eventos-Farol-Santander-2025.pdf?_rsc=1mcjp',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Native facade follows exact-QID mapped thin slab perimeter and clipped eastern end. The four box locations represent operator-described cardinal decks; precise bay offsets are approximated.',
    }),
    limitations: [
      commonLimit,
      'Individual AC positions and window tint/opening state are synthesized from the characteristic existing facade pattern. Observation box projections and roof fittings are reconstructed.',
    ],
    camera: { position: [176, 119, 268], lookAt: [0, 85, 0], fov: 44 },
    qaCameras: [
      { name: 'window-ac-grid', position: [9, 103, 47], lookAt: [0, 94, 9] },
      { name: 'sky-boxes', position: [59, 155, 36], lookAt: [12, 151, 0] },
      { name: 'thin-end', position: [80, 103, 19], lookAt: [30, 85, 0] },
      { name: 'roof', position: [78, 194, 62], lookAt: [0, 168, 0] },
      { name: 'far-silhouette', position: [-246, 153, 356], lookAt: [0, 85, 0] },
    ],
  },
  {
    id: 'N0148',
    key: 'edificio_altino_arantes',
    wikidataId: 'Q169420',
    title: 'Edifício Altino Arantes',
    height: 161.22,
    build: buildAltino,
    brief:
      'A white Art Deco stepped tower with individual recessed windows, projecting vertical pilasters, setback cornices and balustrades, cylindrical lighthouse crown, nine-meter flag mast and static São Paulo state flag.',
    sourceFacts: {
      heightMeters: 161.22,
      floors: 35,
      beaconHeightMeters: 11.7,
      flagMastMeters: 9,
      completion: 1947,
    },
    reconstruction: {
      setbackLevelsMeters: [91, 107, 122, 135, 140.52],
      beaconBaseMeters: 140.52,
      beaconTopMeters: 152.22,
      upperCenterLocalXZ: [1.7, 0],
      plan: 'Mapped ground envelope; upper tier dimensions reconstructed',
    },
    refs: [
      'https://www.farolsantander.com.br/sp/sobre-o-farol',
      'https://www.farolsantander.com.br/assets/sites/2/20241204172903/Manual-de-Eventos-Farol-Santander-2025.pdf?_rsc=1mcjp',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID mapped long-axis frame retained, with ground envelope as mapped. Tier depths, center offset and entrance frontage are exterior reconstructions within the frame; the model includes the operator-published beacon and flag mast in its total height.',
    }),
    limitations: [
      commonLimit,
      'Upper setbacks, facade bay spacing and entrance dimensions are reconstructed; the state-flag canton is simplified geometric cloth. The operator161.22 m total includes the mast.',
    ],
    camera: { position: [143, 119, 242], lookAt: [0, 79, 0], fov: 44 },
    qaCameras: [
      { name: 'art-deco-facade', position: [27, 78, 44], lookAt: [1, 70, 6] },
      { name: 'setbacks', position: [50, 138, 62], lookAt: [1, 119, 0] },
      { name: 'beacon-flag', position: [30, 157, 35], lookAt: [2, 148, 0] },
      { name: 'entrance', position: [29, 10, 42], lookAt: [1, 5, 6] },
      { name: 'far-silhouette', position: [-221, 145, 327], lookAt: [1, 80, 0] },
    ],
  },
  {
    id: 'N0150',
    key: 'edificio_italia',
    wikidataId: 'Q170610',
    title: 'Edifício Itália',
    height: 165,
    build: buildItalia,
    brief:
      'The asymmetric curved São Paulo tower follows its mapped perimeter with projecting concrete sunshade cells, inset glazing and selected louvered shutters, a glazed upper restaurant, observation parapet and roof service enclosure.',
    sourceFacts: {
      heightMeters: 165,
      floors: 46,
      observationDeckMeters: 151,
      windowsPublished: 4000,
      completion: 1965,
    },
    reconstruction: {
      plan: 'Exact-QID mapped curved asymmetric tower outline',
      facade: 'Projecting concrete cells and aluminum louvers reconstructed from exterior pattern',
      heightEvidence:
        'Owner home page165 m above street,151 m observation deck; its history subpage reverses these descriptions, so the explicit home-page statement is used',
    },
    refs: [
      'https://www.edificioitalia.com.br/',
      'https://www.edificioitalia.com.br/imprensa',
      'https://www.edificioitalia.com.br/post/roz%C5%A1i%C5%99ujte-svoji-komunitu-na-blogu',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Native curved facade follows the exact-QID tower-part outline and signed frame.165 m follows operator rather than168 m map tag. Adjacent theatre/club buildings are outside this tower source.',
    }),
    limitations: [
      commonLimit,
      'Shutter distribution, individual window state and rooftop service details are reconstructed. The source covers the mapped tower part; neighboring lower blocks are not falsely included in its footprint.',
    ],
    camera: { position: [147, 113, 247], lookAt: [0, 82, 0], fov: 44 },
    qaCameras: [
      { name: 'sunshade-cells', position: [38, 93, 35], lookAt: [13, 87, 9] },
      { name: 'curved-end', position: [60, 110, -13], lookAt: [21, 88, 4] },
      { name: 'restaurant-terrace', position: [59, 179, 48], lookAt: [0, 154, 0] },
      { name: 'ground', position: [48, 13, 43], lookAt: [0, 5, 0] },
      { name: 'far-silhouette', position: [-220, 140, 323], lookAt: [0, 83, 0] },
    ],
  },
);

function tentRoof(out, cx, cz, y, w, d, rise) {
  const center = [cx, y + rise, cz],
    p = rectangularPlan(w, d, cx, cz),
    white = [0.87, 0.86, 0.77];
  for (let edge = 0; edge < 4; edge++) {
    const a = [p[edge][0], y, p[edge][1]],
      b = [p[(edge + 1) % 4][0], y, p[(edge + 1) % 4][1]];
    for (let i = 0; i < 18; i++) {
      const q0 = lerp(a, b, i / 18),
        q1 = lerp(a, b, (i + 1) / 18);
      // Radial subdivisions capture the sagging fabric profile rather than a rigid pyramid.
      for (let j = 0; j < 12; j++) {
        const t = j / 12,
          u = (j + 1) / 12;
        const point = (q, k) => {
          const v = lerp(q, center, k * 0.96);
          v[1] -= Math.sin(k * Math.PI) * rise * 0.18;
          return v;
        };
        face(out, 'canvas', [point(q0, t), point(q1, t), point(q1, u), point(q0, u)], white);
      }
    }
    tube(out, 'metal', a, center, 0.06, [0.65, 0.64, 0.52], 8);
  }
  loft(
    out,
    'glass',
    [
      radialRing(y + rise - 1.1, 1.1, 1.1, 8, [cx, cz]),
      radialRing(y + rise + 2, 1.1, 1.1, 8, [cx, cz]),
      radialRing(y + rise + 4.1, 0.16, 0.16, 8, [cx, cz]),
    ],
    [0.3, 0.43, 0.41],
  );
}

function buildAbraj(out, m) {
  const warm = [1, 0.92, 0.78];
  for (const outline of m.geometry.outlines) {
    const p = clockwise(outline.slice(0, -1));
    mappedSolid(out, 'stone', p, 0, 1, [0.58, 0.54, 0.45]);
    glazedOutline(out, p, 1, 76, 4.5, [0.24, 0.3, 0.3], [0.62, 0.6, 0.52], 0.145);
    mappedCap(out, 'cladding', p, 76, [0.76, 0.71, 0.61]);
    for (let y = 7; y < 76; y += 9) bandPlan(out, p, y, 0.6, 0.65, [0.74, 0.68, 0.56], 'cladding');
  }
  for (const part of partsEvidence('n0142_abraj_al_bait').filter((p) => p.id !== 958867174)) {
    const p = partPlan(m, part),
      top = Number(part.tags.height),
      bottom = Math.max(76, Number(part.tags.min_height));
    glazedOutline(out, p, bottom, top - 2, 3.6, [0.24, 0.3, 0.29], [0.76, 0.7, 0.59], 0.145);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        count = Math.max(1, Math.floor(Math.hypot(a[0] - b[0], a[1] - b[1]) / 2.9));
      for (let j = 0; j < count; j++) {
        const v = lerp(a, b, j / count);
        beam(
          out,
          'cladding',
          [v[0], bottom, v[1]],
          [v[0], top - 2, v[1]],
          0.18,
          0.32,
          [0.78, 0.71, 0.59],
        );
      }
    }
    for (let y = bottom + 3.6; y < top - 2; y += 3.6)
      bandPlan(out, p, y, 0.25, 0.42, [0.73, 0.67, 0.55], 'cladding');
    mappedCap(out, 'cladding', p, top - 2, [0.76, 0.7, 0.58]);
    bandPlan(out, p, top - 2, 2, 1, [0.78, 0.72, 0.6], 'cladding');
    guardrail(out, ringAt(p, top), 1.5, [0.76, 0.7, 0.54]);
    const center = localGeographic(
      m,
      (part.bounds.minlon + part.bounds.maxlon) / 2,
      (part.bounds.minlat + part.bounds.maxlat) / 2,
    );
    // Roof tents align to each real part's long edge, not to the global complex bounding box.
    let longest = 0,
      edge;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        l = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (l > longest) {
        longest = l;
        edge = [a, b];
      }
    }
    const heading = Math.atan2(-(edge[1][1] - edge[0][1]), edge[1][0] - edge[0][0]);
    const roof = rotatedBuilder(out, heading, [center[0], 0, center[1]]);
    const coords = p.map(([x, z]) => {
      x -= center[0];
      z -= center[1];
      return [
        x * Math.cos(heading) - z * Math.sin(heading),
        x * Math.sin(heading) + z * Math.cos(heading),
      ];
    });
    const w = (Math.max(...coords.map((p) => p[0])) - Math.min(...coords.map((p) => p[0]))) * 0.78,
      d = (Math.max(...coords.map((p) => p[1])) - Math.min(...coords.map((p) => p[1]))) * 0.65;
    if (top > 260)
      for (let i = -1; i <= 1; i++) tentRoof(roof, i * w * 0.28, 0, top + 0.5, w * 0.36, d, 9);
    else tentRoof(roof, 0, 0, top + 0.5, w, d, 11);
  }
  // Exact main tower building:part way958867174: cardinal rectangle, not whole-complex centroid.
  const mainAnchor = [39.82553895, 21.41812445],
    east = (mainAnchor[0] - m.anchor[0]) * 111319.490793 * Math.cos((m.anchor[1] * Math.PI) / 180),
    south = -(mainAnchor[1] - m.anchor[1]) * 111319.490793;
  const local = [
    east * Math.cos(m.heading) - south * Math.sin(m.heading),
    0,
    east * Math.sin(m.heading) + south * Math.cos(m.heading),
  ];
  const main = rotatedBuilder(out, -m.heading, local, warm);
  masonryTier(main, 80, 48, 76, 205);
  masonryTier(main, 75, 45, 205, 293);
  masonryTier(main, 67, 43, 293, 347);
  masonryTier(main, 61, 41, 347, 366);
  const gold = [0.79, 0.63, 0.31],
    roofGreen = [0.19, 0.35, 0.28];
  loft(
    main,
    'metal',
    [ringAt(rectangularPlan(62, 42), 366), ringAt(rectangularPlan(49, 38), 399)],
    roofGreen,
  );
  // Four visible V-shaped supports around the lower clock housing.
  for (const z of [-21, 21])
    for (const x of [-25, 25]) {
      beam(
        main,
        'cladding',
        [x, 368, z],
        [Math.sign(x) * 31, 411, z],
        2.4,
        2.8,
        [0.82, 0.76, 0.59],
      );
      beam(main, 'cladding', [x, 368, z], [0, 411, z], 2.1, 2.4, [0.82, 0.76, 0.59]);
    }
  box(main, 'cladding', [-30, 405, -25], [30, 469, 25], [0.79, 0.74, 0.62]);
  for (const sign of [-1, 1]) {
    facadeClock(main, [0, 435, sign * 25.05], 43, 43, [0, 0, sign], gold, undefined, true);
    facadeClock(main, [sign * 30.05, 435, 0], 37, 43, [sign, 0, 0], gold, undefined, true);
    box(
      main,
      'metal',
      [-23, 460, sign > 0 ? 25.07 : -25.4],
      [23, 467, sign > 0 ? 25.4 : -25.07],
      roofGreen,
    );
    for (const x of [-28.5, 28.5])
      beam(main, 'metal', [x, 407, sign * 25.5], [x, 468, sign * 25.5], 0.8, 0.8, gold);
  }
  bandPlan(main, rectangularPlan(62, 52), 469, 2.2, 2, gold, 'metal');
  loft(
    main,
    'metal',
    [ringAt(rectangularPlan(58, 48), 471.2), ringAt(rectangularPlan(31, 29), 498)],
    roofGreen,
  );
  const jewel = [
    [498, 15],
    [512, 25],
    [527, 21],
    [535, 7],
  ];
  for (let j = 1; j < jewel.length; j++) {
    const [y0, r0] = jewel[j - 1],
      [y1, r1] = jewel[j],
      a = radialRing(y0, r0, r0, 8),
      b = radialRing(y1, r1, r1, 8);
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      panel(main, [a[i], a[k], b[k], b[i]], [0.14, 0.33, 0.3], 0.32, gold);
      beam(main, 'metal', a[i], b[i], 0.7, 0.7, gold);
    }
    cap(main, 'metal', b, roofGreen);
  }
  loft(
    main,
    'metal',
    [radialRing(535, 5.3, 5.3, 16), radialRing(573, 1.9, 1.9, 16), radialRing(580, 0.7, 0.7, 16)],
    gold,
  );
  for (let y = 542; y < 574; y += 6)
    torus(
      main,
      'metal',
      [0, y, 0],
      curveValue(
        [
          [535, 5.3],
          [573, 1.9],
        ],
        y,
      ) + 0.25,
      0.24,
      gold,
      32,
      8,
    );
  // Solid crescent with two faces and a closed rim, exactly23 m tall.
  const outer = [],
    inner = [],
    r = 14,
    ri = 13,
    dy = 6,
    cut = (r * r - ri * ri + dy * dy) / (2 * dy),
    a0 = Math.asin(cut / r),
    span = Math.PI + 2 * a0,
    scale = 23 / (r + cut),
    cy = 601 - cut * scale;
  for (let i = 0; i <= 80; i++) {
    const a = Math.PI - a0 + (span * i) / 80,
      x = Math.cos(a) * r,
      yy = Math.sin(a) * r;
    outer.push([x * scale, cy + yy * scale]);
    const t = i / 80,
      innerStart = Math.atan2(cut - dy, -Math.sqrt(r * r - cut * cut)) + Math.PI * 2,
      innerEnd = Math.atan2(cut - dy, Math.sqrt(r * r - cut * cut)) + Math.PI * 2,
      theta = innerStart + (innerEnd - innerStart) * t;
    inner.push([Math.cos(theta) * ri * scale, cy + (dy + Math.sin(theta) * ri) * scale]);
  }
  for (let i = 0; i < 80; i++) {
    const p = [outer[i], outer[i + 1], inner[i + 1], inner[i]];
    // Endpoint strips collapse at the horn; emit only the nondegenerate fan there.
    for (const z of [-1.2, 1.2]) {
      let poly = p.map(([x, y]) => [x, y, z]);
      if (z < 0) poly = poly.toReversed();
      if (i === 0 || i === 79) {
        const unique = poly.filter(
          (v, k) => !poly.slice(0, k).some((q) => Math.hypot(...q.map((x, n) => x - v[n])) < 0.001),
        );
        if (unique.length === 3) tri(main, 'metal', unique, gold);
        else face(main, 'metal', poly, gold);
      } else face(main, 'metal', poly, gold);
    }
    for (const edge of [outer, inner])
      face(
        main,
        'metal',
        [
          [edge[i][0], edge[i][1], -1.2],
          [edge[i + 1][0], edge[i + 1][1], -1.2],
          [edge[i + 1][0], edge[i + 1][1], 1.2],
          [edge[i][0], edge[i][1], 1.2],
        ],
        gold,
      );
  }
}

function merlonCrown(out, w, d, y, cx, cz) {
  const plan = rectangularPlan(w, d, cx, cz);
  for (let i = 0; i < 4; i++) {
    const a = plan[i],
      b = plan[(i + 1) % 4],
      n = Math.floor(Math.hypot(a[0] - b[0], a[1] - b[1]) / 2.2);
    for (let j = 0; j < n; j++) {
      const p = lerp([a[0], y, a[1]], [b[0], y, b[1]], (j + 0.5) / n);
      box(
        out,
        'cladding',
        [p[0] - 0.55, y, p[2] - 0.55],
        [p[0] + 0.55, y + 1.7, p[2] + 0.55],
        pale,
      );
      loft(
        out,
        'cladding',
        [
          ringAt(rectangularPlan(1.25, 1.25, p[0], p[2]), y + 1.7),
          ringAt(rectangularPlan(0.36, 0.36, p[0], p[2]), y + 2.4),
        ],
        pale,
      );
    }
  }
}
function buildPalace(out, m) {
  const surveyed = localOutline(m),
    holes = m.geometry.holes.map((h) => h.slice(0, -1));
  // The entrance footprint includes a roofed portico, not a solid wall beneath it.
  const plan = surveyed
    .map(([x, z]) => [x, Math.abs(x) < 22 && z < -54.2 ? -54.2 : z])
    .filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.002);
  mappedSolid(out, 'cladding', plan, 0, 15.8, [0.75, 0.7, 0.59], holes);
  // Individually paneled windows along the concave ground wings, preserving both courtyards.
  for (let edge = 0; edge < plan.length; edge++) {
    const a = plan[edge],
      b = plan[(edge + 1) % plan.length],
      l = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (l < 3) continue;
    const n = [(a[1] - b[1]) / l, 0, (b[0] - a[0]) / l];
    for (let j = 0; j < Math.floor(l / 3.3); j++)
      for (let y = 3; y < 14; y += 4.8) {
        const p = lerp([a[0], y, a[1]], [b[0], y, b[1]], (j + 0.5) / Math.floor(l / 3.3)),
          t = [(b[0] - a[0]) / l, 0, (b[1] - a[1]) / l];
        const q = [
          [-0.7, 0],
          [0.7, 0],
          [0.7, 2.6],
          [-0.7, 2.6],
        ].map(([x, dy]) => p.map((v, k) => v + t[k] * x + (k === 1 ? dy : 0) + n[k] * 0.08));
        panel(out, q, [0.22, 0.27, 0.27], 0.1, [0.85, 0.8, 0.68], 'cladding');
      }
  }
  for (const cx of [-95.5, 95.5])
    for (const cz of [-85, 50]) {
      masonryTier(out, 66, 33, 15.8, 34, cx, cz);
      merlonCrown(out, 65, 32, 34, cx, cz);
    }
  for (const cx of [-50, 50]) {
    masonryTier(out, 43, 75, 15.8, 43, cx, -17);
    merlonCrown(out, 43, 75, 43, cx, -17);
    for (const cz of [-43, 8]) {
      masonryTier(out, 20, 20, 43, 57, cx, cz);
      merlonCrown(out, 20, 20, 57, cx, cz);
    }
  }
  const cz = -18;
  masonryTier(out, 70, 70, 15.8, 49, 0, cz);
  masonryTier(out, 49, 49, 49, 111, 0, cz);
  solidPlan(out, 'cladding', rectangularPlan(56, 56, 0, cz), 111, 114, [0.78, 0.74, 0.66]);
  guardrail(out, ringAt(rectangularPlan(55, 55, 0, cz), 114), 1.6, [0.62, 0.6, 0.51]);
  masonryTier(out, 36, 36, 114, 149, 0, cz);
  merlonCrown(out, 39, 39, 149, 0, cz);
  masonryTier(out, 27, 27, 151.4, 173, 0, cz);
  merlonCrown(out, 28, 28, 173, 0, cz);
  masonryTier(out, 19.2, 19.2, 175.4, 185, 0, cz);
  for (const sign of [-1, 1]) {
    facadeClock(
      out,
      [0, 166, cz + sign * 13.56],
      6.3,
      6.3,
      [0, 0, sign],
      [0.24, 0.22, 0.18],
      [0.9, 0.86, 0.74],
    );
    facadeClock(
      out,
      [sign * 13.56, 166, cz],
      6.3,
      6.3,
      [sign, 0, 0],
      [0.24, 0.22, 0.18],
      [0.9, 0.86, 0.74],
    );
  }
  const spireRing = (y, half, chamfer) =>
    [
      [-half + chamfer, -half],
      [-half, -half + chamfer],
      [-half, half - chamfer],
      [-half + chamfer, half],
      [half - chamfer, half],
      [half, half - chamfer],
      [half, -half + chamfer],
      [half - chamfer, -half],
    ].map(([x, z]) => [x, y, z + cz]);
  loft(
    out,
    'metal',
    [
      spireRing(185, 10.1, 0.65),
      spireRing(187.68, 6.5, 2.1),
      spireRing(199, 4.7, 2.75),
      spireRing(205, 3.5, 2.05),
      spireRing(231, 0.38, 0.223),
    ],
    [0.32, 0.44, 0.39],
  );
  tube(out, 'metal', [0, 230.8, cz], [0, 237, cz], 0.23, [0.48, 0.52, 0.49], 12);
  torus(out, 'metal', [0, 205, cz], 3.7, 0.23, [0.45, 0.5, 0.41], 32, 8);
  // East-facing monumental entrance on the opposite side from Congress Hall.
  box(out, 'cladding', [-20, 0, -69.9], [20, 1.2, -54.5], [0.74, 0.71, 0.63]);
  box(out, 'cladding', [-20, 17, -69.9], [20, 19, -55.5], [0.81, 0.76, 0.67]);
  for (let x = -17; x <= 17; x += 4.25) {
    tube(out, 'cladding', [x, 1.2, -67.4], [x, 17, -67.4], 0.64, [0.83, 0.79, 0.69], 16);
    box(out, 'cladding', [x - 0.92, 16.4, -68.3], [x + 0.92, 17.1, -66.5], [0.85, 0.81, 0.73]);
  }
  // Semicircular Congress Hall roof follows the mapped northern lobe.
  const hall = clockwise([
    [-39.5, 65],
    [39.5, 65],
    ...Array.from({ length: 47 }, (_, i) => [
      39.5 * Math.cos(((i + 1) / 48) * Math.PI),
      65 + 42 * Math.sin(((i + 1) / 48) * Math.PI),
    ]),
  ]);
  mappedSolid(out, 'cladding', hall, 15.8, 24.5, [0.71, 0.68, 0.59]);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI,
      b = ((i + 1) / 48) * Math.PI;
    beam(
      out,
      'cladding',
      [39.6 * Math.cos(a), 25, 65 + 42.1 * Math.sin(a)],
      [39.6 * Math.cos(b), 25, 65 + 42.1 * Math.sin(b)],
      0.45,
      0.7,
      [0.82, 0.77, 0.66],
    );
  }
}

skylineExpansion.push(
  {
    id: 'N0142',
    key: 'abraj_al_bait',
    wikidataId: 'Q189476',
    title: 'Abraj Al Bait',
    height: 601,
    build: buildAbraj,
    brief:
      'The seven-tower complex includes a mapped stepped podium, warm stone hotel facades, six lower towers with tensioned roof tents and glass lanterns, plus the cardinal clock tower with four differently proportioned dials, V supports, a faceted glass jewel, gold spire and closed solid crescent.',
    sourceFacts: {
      heightMeters: 601,
      clockFacesMeters: { northSouth: [43, 43], eastWest: [37, 43] },
      approximateNumeralHeightMeters: 7,
      crescentHeightMeters: 23,
      spireMeters: 45,
      towers: 7,
      mainShaftPart: 'OSM way958867174, min_height80,height356',
    },
    reconstruction: {
      heightDatum:
        '601 m complex height per SL Rasch Tower Tents; their separate steel-structure page reports607 m, so datum difference is recorded',
      mainTowerAnchor: [39.82553895, 21.41812445],
      mainTowerHeading: 0,
      mainTowerBaseMeters: [80, 48],
      clockCenterMeters: 435,
      crescentTopMeters: 601,
      lowerTowers:
        'Six named mapped building parts:457669754,457669755,457669758,457669759,457669762,457669764; individual plan/heights retained, tent roof form reconstructed',
    },
    refs: [
      'https://www.sl-rasch.com/en/projects/the-makkah-royal-clock-tower/',
      'https://www.sl-rasch.com/en/projects/tower-tents/',
      'https://www.perrot-turmuhren.de/turmuhren-laeuteanlagen-sonderuhren-turmzieren-glockenspiele/besondere-uhren-spezialuhren/groesste-turmuhr-makkah-clock.html',
      'https://www.openstreetmap.org/way/958867174',
      'https://www.openstreetmap.org/relation/12896421',
    ],
    nativeAxes: {
      ...axes,
      origin:
        'Mapped whole-complex frame; clock shaft offset to exact-QID building:part center, faces cardinal directions',
    },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Whole-complex mapped frame retained. Main clock shaft is separately located at[39.82553895,21.41812445] from exact-QID way958867174 and rotated internally so the wider43 m faces point north/south. Six named surrounding tower parts retain their actual mapped plans, signed orientation and heights; source map-parts.json preserves that evidence.',
    }),
    limitations: [
      commonLimit,
      'Clock numerals use original geometric strokes at the manufacturer-described approximate7 m height; exact typographic outlines remain reconstructed. Arabic calligraphy and fine Islamic mosaic motifs are omitted. Roof tents are reconstructed within mapped tower plans. OSM records279 m for the two taller side towers while an older architect roof description says up to250 m; mapped heights are retained. Conflicting601/607 m main-tower datums are documented;601 m is used.',
    ],
    camera: { position: [460, 374, 815], lookAt: [0, 282, 25], fov: 44 },
    qaCameras: [
      { name: 'four-clock-faces', position: [141, 455, 191], lookAt: [8, 438, 72] },
      { name: 'jewel-crescent', position: [128, 602, 186], lookAt: [8, 551, 72] },
      { name: 'tent-roofs', position: [-241, 282, 288], lookAt: [-77, 229, 35] },
      { name: 'hotel-podium', position: [223, 99, 312], lookAt: [0, 77, 33] },
      { name: 'far-silhouette', position: [-639, 444, 1034], lookAt: [0, 287, 30] },
    ],
  },
  {
    id: 'N0146',
    key: 'palace_of_culture_and_science',
    wikidataId: 'Q167566',
    title: 'Palace of Culture and Science',
    height: 237,
    build: buildPalace,
    brief:
      'A mapped, courtyard-preserving palace complex with low ceremonial wings, four corner blocks, Renaissance-style crenellated crowns, a stepped central shaft,114 m terrace, four clock faces, green metal spire and the semicircular Congress Hall.',
    sourceFacts: {
      heightWithAntennaMeters: 237,
      heightWithoutSpireMeters: 187.68,
      terraceMeters: 114,
      floorsIncludingBasements: 46,
      clockDiameterMeters: 6.3,
      completion: 1955,
      antennaExtension: 1994,
    },
    reconstruction: {
      towerCenterLocalXZ: [0, -18],
      primaryTerraceMeters: 114,
      congressHall: 'Mapped rounded lobe at native+Z',
      mainEntrance: 'Native-Z faces the east side of the geographic footprint',
      facade: 'Individual recessed windows, sills, pilasters, merlon crowns and portico columns',
    },
    refs: [
      'https://pkin.pl/informacje-o-pkin/',
      'https://pkin.pl/galeria-zdjec/',
      'https://www.openstreetmap.org/relation/1319250',
    ],
    nativeAxes: { ...axes, front: 'Native-Z ceremonial entrance; Congress Hall at native+Z' },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID concave complex outline and two courtyard holes retained. Congress Hall is on the mapped rounded native+Z lobe, fixing the signed facade axis and east-facing main entrance. Central shaft is reconstructed at native[0,-18] inside that aligned complex.',
    }),
    limitations: [
      commonLimit,
      'Main tier dimensions and window schedules are reconstructed. Sculpture figures in the niches, precise ceramic ornament and clock mermaid emblems are not fabricated; these small facade ornaments remain a fidelity gap. Native ground follows the operator zero datum, while published street-level height datums differ.',
    ],
    camera: { position: [-306, 197, -382], lookAt: [0, 105, -15], fov: 44 },
    qaCameras: [
      { name: 'terrace-crowns', position: [92, 132, 82], lookAt: [0, 119, -18] },
      { name: 'clock-spire', position: [46, 221, 55], lookAt: [0, 183, -18] },
      { name: 'portico', position: [55, 17, -107], lookAt: [0, 11, -64] },
      { name: 'congress-courts', position: [161, 129, 205], lookAt: [0, 27, 39] },
      { name: 'far-silhouette', position: [-448, 278, -561], lookAt: [0, 105, -12] },
    ],
  },
);

function buildAbeno(out, m) {
  const plan = localOutline(m);
  const towerPlan = partPlan(
    m,
    partsEvidence('n0139_abeno_harukas').find((p) => p.id === 488467176),
  );
  mappedSolid(out, 'foundation', plan, 0, 0.5, [0.5, 0.52, 0.51]);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    if ((a[0] + b[0]) / 2 < -48.6) continue;
    grid(
      out,
      [
        [a[0], 0.5, a[1]],
        [b[0], 0.5, b[1]],
        [b[0], 44, b[1]],
        [a[0], 44, a[1]],
      ],
      [0.32, 0.39, 0.41],
      1.6,
      4.3,
      0.11,
      [0.72, 0.74, 0.74],
    );
  }
  mappedCap(out, 'concrete', plan, 44, [0.6, 0.62, 0.61]);
  for (let y = 5; y < 44; y += 4.3) bandPlan(out, plan, y, 0.22, 0.3, [0.72, 0.73, 0.72], 'metal');
  const stages = [
    [-92, 0, 84, 82, 0.5, 80],
    [-89, -7, 78, 66, 80, 190],
    [-88, -18, 76, 42, 190, 287],
  ];
  for (const [cx, cz, w, d, a, b] of stages) {
    const ring = a < 1 ? towerPlan : rectangularPlan(w, d, cx, cz);
    glazedOutline(
      out,
      ring,
      a,
      b,
      a < 1 ? 4.8 : 4.65,
      [0.34, 0.43, 0.47],
      [0.65, 0.71, 0.73],
      0.072,
    );
    for (let y = a + 4.65; y < b; y += 4.65)
      bandPlan(out, ring, y, 0.22, 0.2, [0.67, 0.73, 0.75], 'metal');
    mappedSolid(out, 'metal', ring, b, b + 0.25, [0.54, 0.59, 0.59]);
    guardrail(out, ringAt(ring, b + 0.25), 1.15, [0.56, 0.61, 0.62]);
    // The glass skin includes continuous vertical projecting fins and deep shadow-box strips.
    for (let x = cx - w / 2 + 3; a >= 1 && x < cx + w / 2; x += 3.9)
      for (const z of [cz - d / 2, cz + d / 2])
        beam(out, 'metal', [x, a + 0.1, z], [x, b, z], 0.1, 0.42, [0.67, 0.74, 0.77]);
    if (b < 287) {
      for (let x = cx - w / 2 + 2; x < cx + w / 2 - 4; x += 8)
        box(
          out,
          'concrete',
          [x, b + 0.25, cz + d / 2 - 7],
          [x + 4, b + 1.25, cz + d / 2 - 3],
          [0.34, 0.4, 0.33],
        );
    }
  }
  const top = rectangularPlan(76, 42, -88, -18),
    inner = rectangularPlan(49, 19, -88, -18);
  // Open-air sky garden under the surrounding glazed observation gallery.
  glazedOutline(out, top, 287.25, 299.75, 4.15, [0.37, 0.46, 0.48], [0.7, 0.76, 0.76], 0.095);
  glazedOutline(
    out,
    inner.toReversed(),
    287.25,
    296,
    4.15,
    [0.32, 0.4, 0.42],
    [0.65, 0.7, 0.72],
    0.1,
  );
  mappedCap(out, 'metal', top, 299.75, [0.64, 0.69, 0.68], [inner]);
  bandPlan(out, top, 299.75, 0.25, 0.4, [0.72, 0.75, 0.74], 'metal');
  solidPlan(out, 'concrete', inner, 287, 287.25, [0.49, 0.47, 0.42]);
  for (let bay = 0; bay < 9; bay++)
    for (const z of [-39, 3]) {
      const x = -125.5 + (75 * bay) / 9,
        nextX = -125.5 + (75 * (bay + 1)) / 9;
      beam(out, 'metal', [x, 289, z], [nextX, 298.7, z], 0.33, 0.4, [0.75, 0.79, 0.79]);
      beam(out, 'metal', [nextX, 289, z], [x, 298.7, z], 0.33, 0.4, [0.75, 0.79, 0.79]);
    }
  for (let x = -124; x < -54; x += 10)
    box(out, 'metal', [x, 44.1, 17], [x + 4.5, 47.2, 25], [0.61, 0.65, 0.65]);
}

function buildRyugyong(out, m) {
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
        b = plan[(i + 1) % plan.length],
        n = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / 1.55));
      for (let j = 0; j < n; j++) {
        const p = lerp(a, b, j / n),
          q = lerp(a, b, (j + 1) / n),
          topP = roof(p),
          topQ = roof(q);
        for (let y = 11.8; y < Math.max(topP, topQ) - 0.001; y += 3.12) {
          const yp = Math.min(y + 3.12, topP),
            yq = Math.min(y + 3.12, topQ);
          if (yp <= y + 0.001 || yq <= y + 0.001) {
            const t = (y - topP) / (topQ - topP),
              cut = lerp(p, q, Math.max(0, Math.min(1, t)));
            const points =
              yp <= y + 0.001
                ? [
                    [cut[0], y, cut[1]],
                    [q[0], y, q[1]],
                    [q[0], yq, q[1]],
                  ]
                : [
                    [p[0], y, p[1]],
                    [cut[0], y, cut[1]],
                    [p[0], yp, p[1]],
                  ];
            if (Math.hypot(...normalFor(...points)) > 0.5)
              tri(out, 'glass', points, [0.28, 0.4, 0.46]);
          } else
            panel(
              out,
              [
                [p[0], y, p[1]],
                [q[0], y, q[1]],
                [q[0], yq, q[1]],
                [p[0], yp, p[1]],
              ],
              [0.28, 0.4, 0.46],
              0.045,
              [0.55, 0.64, 0.68],
            );
        }
      }
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
      a = radialRing(y0, r0, r0, 72, center),
      b = radialRing(y1, r1, r1, 72, center);
    for (let i = 0; i < 72; i++)
      grid(
        out,
        [a[i], a[(i + 1) % 72], b[(i + 1) % 72], b[i]],
        [0.3, 0.42, 0.48],
        1.5,
        3.6,
        0.065,
        [0.6, 0.68, 0.7],
      );
    torus(out, 'metal', [center[0], y0, center[1]], r0 + 0.1, 0.13, [0.63, 0.7, 0.72], 72, 6);
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

skylineExpansion.push(
  {
    id: 'N0139',
    key: 'abeno_harukas',
    wikidataId: 'Q16318627',
    title: 'Abeno Harukas',
    height: 300,
    build: buildAbeno,
    brief:
      'A three-stage asymmetric glass tower rising from the western end of the mapped station/department-store podium, with projecting facade fins, horizontal metal courses, terrace gardens and an open sky court inside the glazed observation crown.',
    sourceFacts: {
      heightMeters: 300,
      floorsAboveGround: 60,
      completion: 2014,
      setbacks: 'Approximately100 m vertical sections',
      towerLocation: 'Western former department-store portion per operator construction history',
    },
    reconstruction: {
      towerCenterLocalXZ: [-89, -7],
      towerBase: 'Exact mapped Tower-Kan way488467176 perimeter',
      officeSizeMeters: [78, 66],
      hotelSizeMeters: [76, 42],
      setbackLevelsMeters: [80, 190, 287],
      geographicEvidence:
        'Separate named Tower-Kan way488467176 confirms the western tower plan and center within the whole podium; preserved in map-parts.json',
    },
    refs: [
      'https://www.abenoharukas-300.jp/en/',
      'https://www.takenaka.co.jp/takenaka_e/abeno/design/de-04.html',
      'https://www.takenaka.co.jp/takenaka_e/abeno/h300/h300-02.html',
      'https://www.jisf.or.jp/en/activity/sctt/documents/SCTT38.pdf',
      'https://www.abenoharukas-300.jp/en/observatory/guide.html',
      'https://www.openstreetmap.org/way/488467176',
    ],
    nativeAxes: {
      ...axes,
      origin: 'Center of whole mapped podium ground datum; main tower is at nativeX about -89 m',
    },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Whole station/mall outline fixes the global frame. Separate named Tower-Kan way488467176 supplies the actual western tower perimeter, including its clipped corner and southern entrance notch. Upper tier offsets remain exterior reconstructions inside that measured tower part.',
    }),
    limitations: [
      commonLimit,
      'Ground tower perimeter is independently mapped; upper tier setbacks and facade fins remain reconstructed from exterior references. Individual planting and service units are simplified.',
    ],
    camera: { position: [260, 204, 408], lookAt: [-65, 140, 0], fov: 44 },
    qaCameras: [
      { name: 'setback-gardens', position: [-9, 208, 126], lookAt: [-88, 181, -5] },
      { name: 'fins-glazing', position: [-48, 152, 58], lookAt: [-88, 142, 20] },
      { name: 'sky-court', position: [-18, 326, 54], lookAt: [-88, 290, -18] },
      { name: 'station-podium', position: [100, 66, 163], lookAt: [0, 21, 0] },
      { name: 'far-silhouette', position: [-464, 272, 552], lookAt: [-62, 146, 0] },
    ],
  },
  {
    id: 'N0143',
    key: 'ryugyong_hotel',
    wikidataId: 'Q29272',
    title: 'Ryugyong Hotel',
    height: 330,
    build: buildRyugyong,
    brief:
      'Three narrow radial wings with continuously sloping glazed sides and a small intermediate setback converge into a ringed conical crown. Individual glass panels, edge ribs and a concave mapped podium retain the recognizable Y-plan pyramid.',
    sourceFacts: {
      heightMeters: 330,
      floors: 105,
      form: 'Three inclined wings meeting a conical crown',
      exterior: 'Completed blue-gray glass cladding represented in daylight',
    },
    reconstruction: {
      towerCenterWgs84: [125.7308679, 39.0365178],
      wingCompassDirections: [77, 197, 317],
      wingUpperMeters: 311,
      wingOuterWallMeters: 72,
      crownBaseMeters: 250,
      plan: 'Six mapped outer sloping wings and six mapped ridge parts around mapped central shaft; source map-parts.json',
    },
    refs: [
      'https://koryogroup.com/blog/ryugyong-hotel-special-report',
      'https://www.skyscrapercenter.com/building/wd/377',
      'https://doiserbia.nb.rs/img/doi/0350-3593/2021/0350-35932102117P.pdf',
      'https://www.openstreetmap.org/way/407995272',
      'https://www.openstreetmap.org/way/1279085957',
    ],
    nativeAxes: {
      ...axes,
      origin: 'Mapped podium frame; tower center from separate mapped central shaft',
    },
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Mapped central shaft way407995272 fixes the tower center at[125.7308679,39.0365178]. Separate wing parts supply actual footprints, heights and roof directions77,197,317 degrees. These are transformed into the exact-QID podium frame; none uses the whole podium centroid as its own center.',
    }),
    limitations: [
      commonLimit,
      'Mapped parts resolve wing positions and roof slopes; upper conical crown curvature and pane schedules are reconstructed. LED media facade is represented as static daylight glazing.',
    ],
    camera: { position: [345, 221, 493], lookAt: [0, 150, -12], fov: 44 },
    qaCameras: [
      { name: 'wing-grid', position: [86, 155, 119], lookAt: [24, 139, 38] },
      { name: 'three-wings', position: [-278, 207, 304], lookAt: [0, 150, -12] },
      { name: 'conical-crown', position: [51, 335, 73], lookAt: [0, 307, -12] },
      { name: 'podium', position: [228, 53, 265], lookAt: [0, 11, 0] },
      { name: 'far-silhouette', position: [-524, 315, 694], lookAt: [0, 151, -12] },
    ],
  },
);

function buildCocoon(out) {
  const profile = [
    [0.35, 20.5],
    [12, 22.4],
    [45, 25.6],
    [85, 26.2],
    [125, 24.8],
    [157, 21],
    [181, 15.7],
    [196, 10],
    [202, 6.5],
    [203.65, 5.6],
  ];
  const point = (a, y, offset = 0) => {
    // Three rounded faces, with the three vertical atrium seams recessed.
    const r = curveValue(profile, y) * (1 - 0.043 * Math.cos(3 * a)) + offset;
    return [r * Math.cos(a), y, r * 0.94 * Math.sin(a)];
  };
  const n = 96,
    levels = [
      0.35,
      8,
      ...Array.from({ length: 48 }, (_, i) => 12 + i * 3.85),
      199,
      201.3,
      203.65,
    ].filter((v, i, a) => i === 0 || v > a[i - 1]);
  solidPlan(
    out,
    'foundation',
    radialRing(0, 21.1, 20, 96).map((p) => [p[0], p[2]]),
    0,
    0.35,
    [0.48, 0.49, 0.47],
  );
  for (let j = 1; j < levels.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (-i / n) * Math.PI * 2,
        b = (-(i + 1) / n) * Math.PI * 2,
        y0 = levels[j - 1],
        y1 = levels[j];
      const atrium = (i + 4) % 32 < 8;
      panel(
        out,
        [point(a, y0), point(b, y0), point(b, y1), point(a, y1)],
        atrium ? [0.12, 0.2, 0.27] : [0.26, 0.35, 0.41],
        0.043,
        [0.53, 0.59, 0.61],
      );
      if (j % 3 === 0)
        beam(out, 'metal', point(a, y0, 0.09), point(b, y0, 0.09), 0.17, 0.16, [0.66, 0.7, 0.72]);
    }
  cap(
    out,
    'metal',
    Array.from({ length: n }, (_, i) => point((-i / n) * Math.PI * 2, 203.65)),
    [0.74, 0.77, 0.77],
  );
  // The broad enclosing meridians and the secondary irregular white web are distinct geometry.
  for (let side = 0; side < 3; side++) {
    const center = (side * Math.PI * 2) / 3;
    for (const sign of [-1, 1])
      for (let y = 1; y < 203; y += 1.6) {
        const next = Math.min(203, y + 1.6),
          span = (t) => 0.9 * Math.sin((Math.PI * (t + 9)) / 220);
        beam(
          out,
          'metal',
          point(center + sign * span(y), y, 0.23),
          point(center + sign * span(next), next, 0.23),
          0.53,
          0.29,
          [0.9, 0.91, 0.89],
        );
      }
    for (let strand = 0; strand < 13; strand++)
      for (const sign of [-1, 1]) {
        for (let y = 1; y < 201.5; y += 2) {
          const phase = (t) =>
            center + sign * (0.22 + strand * 0.112 + t * (0.024 + (strand % 3) * 0.0035));
          const y1 = Math.min(201.5, y + 2);
          beam(
            out,
            'metal',
            point(phase(y), y, 0.12),
            point(phase(y1), y1, 0.12),
            strand % 4 === 0 ? 0.36 : 0.23,
            0.18,
            [0.9, 0.91, 0.9],
          );
        }
      }
  }
  for (let side = 0; side < 3; side++) {
    const a = (side * Math.PI * 2) / 3,
      rr = 21.8;
    const center = [Math.cos(a) * rr, 4, Math.sin(a) * rr * 0.94];
    const across = [-Math.sin(a), 0, Math.cos(a)];
    for (let i = -2; i <= 2; i++) {
      const c = center.map((v, k) => v + across[k] * i * 1.25);
      beam(out, 'metal', [c[0], 0.4, c[2]], [c[0], 7, c[2]], 0.14, 0.2, metal);
    }
  }
}

function jinMaoPlan(radius) {
  // Eight corner facets, with a shallow projecting rib on each corner.
  const plan = [];
  for (let side = 0; side < 8; side++) {
    const a = (-side * Math.PI) / 4;
    for (const [delta, r] of [
      [0.17, radius * 0.91],
      [0.065, radius],
      [0, radius * 1.024],
      [-0.065, radius],
      [-0.17, radius * 0.91],
    ])
      plan.push([Math.cos(a + delta) * r, Math.sin(a + delta) * r]);
  }
  return clockwise(plan);
}
function buildJinMao(out, m) {
  const mapped = localOutline(m);
  solidPlan(out, 'stone', mapped, 0, 0.55, [0.54, 0.53, 0.5]);
  glazedOutline(out, mapped, 0.55, 8, 3.7, [0.2, 0.29, 0.34], metal, 0.1);
  cap(out, 'metal', ringAt(mapped, 8), [0.54, 0.57, 0.57]);
  const counts = [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1];
  let y = 8;
  for (let tier = 0; tier < counts.length; tier++) {
    const height = counts[tier] * (332.1 / 88),
      r = 32.8 - tier * 1.18,
      plan = jinMaoPlan(r),
      y1 = y + height;
    glazedOutline(out, plan, y, y1, 332.1 / 88, [0.39, 0.46, 0.48], [0.67, 0.7, 0.69], 0.075);
    for (let floor = 1; floor <= counts[tier]; floor++)
      bandPlan(out, plan, y + floor * (332.1 / 88), 0.14, 0.22, [0.66, 0.69, 0.69], 'metal');
    cap(out, 'metal', ringAt(plan, y1), [0.55, 0.59, 0.59]);
    for (let i = 0; i < 8; i++) {
      const a = (-i * Math.PI) / 4;
      const p = [Math.cos(a) * (r + 0.38), y + 0.1, Math.sin(a) * (r + 0.38)],
        q = [p[0], y1 + 0.26, p[2]];
      beam(out, 'metal', p, q, 0.46, 0.52, [0.78, 0.8, 0.78]);
    }
    for (const dy of [-0.35, 0.15, 0.65])
      bandPlan(out, plan, y1 + dy, 0.16, 0.5, [0.74, 0.76, 0.73], 'metal');
    y = y1;
  }
  const crown = [
    [340.1, 19.82],
    [346, 18],
    [355, 17],
    [365, 13.8],
    [375, 11.7],
    [386, 8.7],
    [397, 5.8],
    [407, 3.1],
    [415, 1.3],
  ];
  for (let j = 1; j < crown.length; j++) {
    const [a, r] = crown[j - 1],
      [b, s] = crown[j];
    const lower = radialRing(a, r, r, 8),
      shoulder = radialRing(b - 1.1, r * 0.985, r * 0.985, 8),
      upper = radialRing(b, s, s, 8);
    for (let i = 0; i < 8; i++) {
      const k = (i + 1) % 8;
      grid(
        out,
        [lower[i], lower[k], shoulder[k], shoulder[i]],
        [0.39, 0.47, 0.48],
        1.8,
        1.8,
        0.12,
        [0.77, 0.78, 0.74],
      );
      face(out, 'metal', [shoulder[i], shoulder[k], upper[k], upper[i]], [0.75, 0.77, 0.72]);
      beam(out, 'metal', lower[i], shoulder[i], 0.55, 0.65, [0.8, 0.81, 0.77]);
      beam(out, 'metal', lower[i], shoulder[k], 0.18, 0.18, [0.71, 0.74, 0.73]);
    }
    bandPlan(
      out,
      shoulder.map((p) => [p[0], p[2]]),
      b - 1.1,
      0.7,
      1.45,
      [0.79, 0.8, 0.76],
      'metal',
    );
    cap(out, 'metal', upper, [0.58, 0.62, 0.6]);
  }
  tube(out, 'metal', [0, 414.6, 0], [0, 420.5, 0], 0.28, [0.78, 0.79, 0.74], 16);
}

skylineExpansion.push(
  {
    id: 'N0137',
    key: 'mode_gakuen_cocoon_tower',
    wikidataId: 'Q1030463',
    title: 'Mode Gakuen Cocoon Tower',
    height: 203.65,
    build: buildCocoon,
    brief:
      'A bulging, tapered three-faced glass cocoon, modeled with individual floor panels, three atrium seams, broad curving white meridians, and the finer crossing aluminum web wrapping its full height.',
    sourceFacts: {
      heightMeters: 203.65,
      floorsAboveGround: 50,
      completion: 2008,
      facade: 'Three linked towers enclosed by a rounded cocoon; three-story school groups',
    },
    reconstruction: {
      envelope:
        'Height-profiled rounded threefold plan, mapped maximum width; facade strands individually modeled',
      annex: 'The separately mapped egg-shaped hall is outside this tower asset',
    },
    refs: [
      'https://www.tangeweb.com/works/works_no-188/',
      'https://www.tangeweb.com/project/modegakuen/',
      'https://www.arup.com/projects/the-arup-journal-2000s/the-arup-journal-2009-issue-2/',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID tower footprint center and signed long axis retained. Threefold facade phase and the reconstructed curved height profile require exterior alignment review; adjacent egg-shaped hall excluded.',
    }),
    limitations: [
      commonLimit,
      'Curved cross-section, exact diagonal strand layout and entrance dimensions are reconstructed from the architect exterior. No false exact strand count or structural fabrication claim.',
    ],
    camera: { position: [181, 127, 283], lookAt: [0, 101, 0], fov: 44 },
    qaCameras: [
      { name: 'web-detail', position: [33, 115, 49], lookAt: [12, 110, 15] },
      { name: 'atrium-seam', position: [-42, 98, 22], lookAt: [-17, 89, 9] },
      { name: 'rounded-crown', position: [47, 210, 59], lookAt: [0, 183, 0] },
      { name: 'entrance', position: [45, 13, 41], lookAt: [0, 6, 0] },
      { name: 'far-silhouette', position: [-265, 165, 396], lookAt: [0, 102, 0] },
    ],
  },
  {
    id: 'N0145',
    key: 'jin_mao_tower',
    wikidataId: 'Q80813',
    title: 'Jin Mao Tower',
    height: 420.5,
    build: buildJinMao,
    brief:
      'A silver pagoda skyscraper with an eightfold ribbed plan, twelve progressively shorter occupied setback zones, dense window grids and horizontal courses, projecting corner fins, and an eight-stage braced lantern tapering to a metal spire.',
    sourceFacts: {
      heightMeters: 420.5,
      floors: 88,
      observationDeckMeters: 340.1,
      completion: 1999,
      form: 'Pagoda-inspired rhythmic setbacks; stainless metal and glass facade',
    },
    reconstruction: {
      occupiedTierFloorCounts: [16, 14, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1],
      observationDatumMeters: 340.1,
      crown: 'Eight reconstructed setback stages and terminal mast',
      base: 'Mapped exact-QID star-shaped tower envelope',
    },
    refs: [
      'https://www.som.com/projects/jin-mao-tower/',
      'https://www.som.com/news/som-and-jin-mao-tower-part-1/',
      'https://www1.hkexnews.hk/listedco/listconews/sehk/2017/0419/ltn20170419629.pdf',
      'https://www.siadr.com/projectdetails/5d9eed58e4d1cc030e241f00/',
    ],
    nativeAxes: axes,
    geographic: (m) => ({
      heading: m.heading,
      notes:
        'Exact-QID mapped star-shaped envelope retained at ground level and its eightfold axes define the tower facade orientation. Occupied setbacks and lantern widths are reconstructed within that mapped frame.',
    }),
    limitations: [
      commonLimit,
      'Individual setback heights, crown ribs and window bays are reconstructed. The separately attached six-story exhibition/retail podium is outside this mapped tower source.',
    ],
    camera: { position: [327, 277, 579], lookAt: [0, 207, 0], fov: 44 },
    qaCameras: [
      { name: 'pagoda-setbacks', position: [97, 261, 127], lookAt: [0, 242, 0] },
      { name: 'curtain-wall', position: [48, 96, 57], lookAt: [12, 87, 15] },
      { name: 'braced-crown', position: [59, 407, 82], lookAt: [0, 372, 0] },
      { name: 'ground', position: [86, 19, 89], lookAt: [0, 7, 0] },
      { name: 'far-silhouette', position: [-491, 320, 706], lookAt: [0, 210, 0] },
    ],
  },
);
