/** Budgeted Palace of Culture exterior, with both real courtyard openings retained. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor, torus } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  panel as fullPanel,
  guardrail,
  lerp,
  localOutline,
  mappedSolid,
  rectangularPlan,
  ringAt,
  solidPlan,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(
    readFileSync(structureSourcePath('palace_of_culture_and_science', 'map-frame.json')),
  ),
  MEANS = {
    cladding: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
    recess: [1, 1, 1],
  };
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    if (far && normalFor(...p)[1] < -0.98) return;
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
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    m =
      tier === 3
        ? map
        : {
            ...map,
            geometry: {
              ...map.geometry,
              outline: closed(map.geometry.outline, [3, 0.75, 0.3][tier]),
              holes: map.geometry.holes.map((p) => closed(p, [1.2, 0.5, 0.2][tier])),
            },
          },
    hallSegments = [6, 12, 24, 48][tier],
    clockSteps = [6, 16, 32, 48][tier],
    pale = [0.87, 0.86, 0.82];
  function bandPlan(o, p, y, h, depth, color, slot = 'cladding') {
    if (tier === 0) return;
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.04) continue;
      const n = [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
      face(
        o,
        slot,
        [
          [a[0] + n[0] * depth, y, a[1] + n[1] * depth],
          [b[0] + n[0] * depth, y, b[1] + n[1] * depth],
          [b[0] + n[0] * depth, y + h, b[1] + n[1] * depth],
          [a[0] + n[0] * depth, y + h, a[1] + n[1] * depth],
        ],
        color,
      );
    }
  }
  function masonryTier(out, w, d, y0, y1, cx = 0, cz = 0) {
    const p = rectangularPlan(w, d, cx, cz);
    solidPlan(out, 'cladding', p, y0, y1, [0.8, 0.73, 0.61]);
    if (tier === 0) return;
    for (let f = 0; f < 4; f++) {
      const a = p[f],
        b = p[(f + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len],
        cols = Math.max(1, Math.floor(len / [100, 16, 9, 3.6][tier])),
        rows = Math.max(1, Math.round((y1 - y0) / [100, 30.4, 15.2, 3.8][tier]));
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const center = lerp(
              [a[0], y0 + ((j + 0.5) * (y1 - y0)) / rows, a[1]],
              [b[0], y0 + ((j + 0.5) * (y1 - y0)) / rows, b[1]],
              (i + 0.5) / cols,
            ),
            ww = (len / cols) * 0.5,
            hh = ((y1 - y0) / rows) * 0.66,
            t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
            cell = [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ].map(([u, v]) =>
              center.map(
                (x, k) => x + (t[k] * u * ww) / 2 + (k === 1 ? (v * hh) / 2 : 0) + n[k] * 0.055,
              ),
            );
          face(out, 'glass', cell, [0.28, 0.31, 0.315]);
          if (tier > 1)
            face(
              out,
              'cladding',
              [
                cell[0],
                cell[1],
                cell[1].map((v, k) => v + (k === 1 ? 0.22 : 0)),
                cell[0].map((v, k) => v + (k === 1 ? 0.22 : 0)),
              ],
              [0.81, 0.8, 0.74],
            );
        }
      if (tier > 0)
        for (let i = 1; i < cols; i++) {
          const q = lerp([a[0], y0, a[1]], [b[0], y0, b[1]], i / cols);
          beam(out, 'cladding', q, [q[0], y1, q[2]], 0.3, 0.32, [0.83, 0.82, 0.77]);
        }
    }
    bandPlan(out, p, y1 - 0.32, 0.32, 0.6, [0.87, 0.86, 0.82], 'cladding');
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
      at = (x, y, z = 0) =>
        center.map((v, k) => v + right[k] * x + (k === 1 ? y : 0) + front[k] * z);
    for (let i = 0; i < clockSteps; i++) {
      const a = (i / clockSteps) * Math.PI * 2,
        b = ((i + 1) / clockSteps) * Math.PI * 2;
      const ring = (t, r) => at(Math.cos(t) * width * 0.5 * r, Math.sin(t) * height * 0.5 * r);
      face(out, 'metal', [ring(a, 1), ring(b, 1), ring(b, 0.93), ring(a, 0.93)], rimColor);
      tri(out, 'recess', [at(0, 0, -0.03), ring(a, 0.929), ring(b, 0.929)], dialColor);
    }
    for (let i = 0; tier > 1 && i < 60; i += tier === 3 ? 1 : 5) {
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
    if (numbered && tier === 3) void 0;
    if (tier === 0) return;
    // Fixed representative time, deliberately no unsupported decorative script.
    if (tier > 0)
      beam(
        out,
        'metal',
        at(0, 0, 0.14),
        at(-width * 0.23, height * 0.22, 0.14),
        width * 0.018,
        0.16,
        [0.08, 0.1, 0.09],
      );
    beam(
      out,
      'metal',
      at(0, 0, 0.25),
      at(width * 0.25, height * 0.39, 0.25),
      width * 0.012,
      0.14,
      [0.08, 0.1, 0.09],
    );
  }

  function panel(o, p, color, frame, fc, slot) {
    if (tier < 3) face(o, 'glass', p, color);
    else fullPanel(o, p, color, frame, fc, slot);
  }
  function merlonCrown(o, w, d, y, cx, cz) {
    if (tier < 2) {
      solidPlan(o, 'cladding', rectangularPlan(w, d, cx, cz), y, y + 2.4, pale);
      return;
    }
    const p = rectangularPlan(w, d, cx, cz);
    for (let i = 0; i < 4; i++) {
      const a = p[i],
        b = p[(i + 1) % 4],
        n = Math.floor(Math.hypot(a[0] - b[0], a[1] - b[1]) / (tier === 3 ? 2.2 : 12));
      for (let j = 0; j < n; j++) {
        const q = lerp([a[0], y, a[1]], [b[0], y, b[1]], (j + 0.5) / n);
        box(
          o,
          'cladding',
          [q[0] - 0.55, y, q[2] - 0.55],
          [q[0] + 0.55, y + 1.7, q[2] + 0.55],
          pale,
        );
        loft(
          o,
          'cladding',
          [
            ringAt(rectangularPlan(1.25, 1.25, q[0], q[2]), y + 1.7),
            ringAt(rectangularPlan(0.36, 0.36, q[0], q[2]), y + 2.4),
          ],
          pale,
        );
      }
    }
  }

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
    if (tier === 0 || l < 3) continue;
    const n = [(a[1] - b[1]) / l, 0, (b[0] - a[0]) / l];
    for (let j = 0; j < Math.floor(l / [100, 12, 6.6, 3.3][tier]); j++)
      for (let y = 3; y < 14; y += [100, 9.6, 4.8, 4.8][tier]) {
        const p = lerp(
            [a[0], y, a[1]],
            [b[0], y, b[1]],
            (j + 0.5) / Math.floor(l / [100, 12, 6.6, 3.3][tier]),
          ),
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
  if (tier > 1) guardrail(out, ringAt(rectangularPlan(55, 55, 0, cz), 114), 1.6, [0.62, 0.6, 0.51]);
  masonryTier(out, 36, 36, 114, 149, 0, cz);
  merlonCrown(out, 39, 39, 149, 0, cz);
  if (tier > 1) {
    solidPlan(out, 'cladding', rectangularPlan(27, 27, 0, cz), 149, 151.4, pale);
    solidPlan(out, 'cladding', rectangularPlan(19.2, 19.2, 0, cz), 173, 175.4, pale);
  }
  masonryTier(out, 27, 27, 151.4, 173, 0, cz);
  merlonCrown(out, 28, 28, 173, 0, cz);
  masonryTier(out, 19.2, 19.2, 175.4, 185, 0, cz);
  for (const sign of [-1, 1]) {
    facadeClock(
      out,
      [0, 166, cz + sign * 13.8],
      6.3,
      6.3,
      [0, 0, sign],
      [0.24, 0.22, 0.18],
      [0.9, 0.86, 0.74],
    );
    facadeClock(
      out,
      [sign * 13.8, 166, cz],
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
  if (tier > 1) torus(out, 'metal', [0, 205, cz], 3.7, 0.23, [0.45, 0.5, 0.41], 32, 8);
  // East-facing monumental entrance on the opposite side from Congress Hall.
  box(out, 'cladding', [-20, 0, -69.9], [20, 1.2, -54.5], [0.74, 0.71, 0.63]);
  box(out, 'cladding', [-20, 17, -69.9], [20, 19, -55.5], [0.81, 0.76, 0.67]);
  for (let x = -17; x <= 17; x += tier < 2 ? 17 : 4.25) {
    tube(
      out,
      'cladding',
      [x, 1.2, -67.4],
      [x, 17, -67.4],
      0.64,
      [0.83, 0.79, 0.69],
      tier < 2 ? 6 : 16,
    );
    box(out, 'cladding', [x - 0.92, 16.4, -68.3], [x + 0.92, 17.1, -66.5], [0.85, 0.81, 0.73]);
  }
  // Semicircular Congress Hall roof follows the mapped northern lobe.
  const hall = clockwise([
    [-39.5, 65],
    [39.5, 65],
    ...Array.from({ length: hallSegments - 1 }, (_, i) => [
      39.5 * Math.cos(((i + 1) / hallSegments) * Math.PI),
      65 + 42 * Math.sin(((i + 1) / hallSegments) * Math.PI),
    ]),
  ]);
  mappedSolid(out, 'cladding', hall, 15.8, 24.5, [0.71, 0.68, 0.59]);
  for (let i = 0; tier > 0 && i < hallSegments; i++) {
    const a = (i / hallSegments) * Math.PI,
      b = ((i + 1) / hallSegments) * Math.PI;
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

export const buildPalaceSkyline = (o) => build(o, 0),
  buildPalaceDistrict = (o) => build(o, 1),
  buildPalaceStreet = (o) => build(o, 2),
  buildPalaceCloseup = (o) => build(o, 3);

function simplify(points, error) {
  const p = points.slice();
  if (Math.hypot(...p.at(-1).map((v, i) => v - p[0][i])) < 0.001) p.pop();
  const rdp = (ps) => {
    if (ps.length < 3) return ps;
    const a = ps[0],
      b = ps.at(-1),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = dx * dx + dz * dz;
    let max = error,
      index = -1;
    for (let i = 1; i < ps.length - 1; i++) {
      const q = ps[i],
        t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (len || 1))),
        d = Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    return index < 0
      ? [a, b]
      : [...rdp(ps.slice(0, index + 1)).slice(0, -1), ...rdp(ps.slice(index))];
  };
  let k = 1;
  for (let i = 2; i < p.length; i++)
    if (
      Math.hypot(...p[i].map((v, j) => v - p[0][j])) >
      Math.hypot(...p[k].map((v, j) => v - p[0][j]))
    )
      k = i;
  return [...rdp(p.slice(0, k + 1)).slice(0, -1), ...rdp([...p.slice(k), p[0]]).slice(0, -1)];
}

function closed(p, error) {
  const q = simplify(p, error);
  return [...q, q[0]];
}
