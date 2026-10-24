/** Budgeted seven-tower Abraj complex; original detailed master stays independent. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  cap,
  clockwise,
  face,
  panel as fullPanel,
  partPlan as fullPartPlan,
  grid,
  guardrail,
  lerp,
  localGeographic,
  mappedCap,
  mappedSolid,
  partsEvidence,
  rectangularPlan,
  ringAt,
  rotatedBuilder,
  solidPlan,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box, tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('abraj_al_bait', 'map-frame.json'))),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    cladding: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    canvas: [0.9158639837962037, 0.9158639837962037, 0.9158639837962037],
    glass: [1, 1, 1],
    recess: [1, 1, 1],
  };
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
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
    m = {
      ...map,
      geometry: {
        ...map.geometry,
        outlines: map.geometry.outlines.map((p) => {
          const q = simplify(p, [4, 2, 1, 0.4][tier]);
          return [...q, q[0]];
        }),
      },
    },
    tentEdges = [1, 2, 6, 8][tier],
    tentRows = [1, 2, 4, 6][tier],
    clockSteps = [8, 16, 32, 48][tier],
    crescentSteps = [8, 16, 32, 48][tier];
  const partPlan = (m, p) => simplify(fullPartPlan(m, p), [4, 2, 1, 0.4][tier]);
  const panel = (o, p, color, frame, fc) =>
    tier === 0 ? face(o, 'glass', p, color) : fullPanel(o, p, color, Math.min(frame, 0.14), fc);
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
  function glazedOutline(out, p, lo, hi, dy, color, frameColor, frame) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        color,
        [100, 48, 12, 3.2][tier],
        dy * [30, 24, 8, 2][tier],
        tier === 0 ? 0 : frame,
        frameColor,
      );
    }
  }
  function masonryTier(out, w, d, y0, y1) {
    const p = rectangularPlan(w, d);
    solidPlan(out, 'cladding', p, y0, y1, [0.8, 0.73, 0.61]);
    for (let f = 0; f < 4; f++) {
      const a = p[f],
        b = p[(f + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len],
        cols = Math.max(1, Math.floor(len / [100, 12, 6, 3.6][tier])),
        rows = Math.max(1, Math.round((y1 - y0) / [100, 22.8, 11.4, 3.8][tier]));
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
    if (numbered && tier === 3) clockNumerals(out, at, width, height);
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
    const arc = (cx, cy, rx, ry, a, b, count = 7) =>
      Array.from({ length: count + 1 }, (_, i) => {
        const t = a + ((b - a) * i) / count;
        return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
      });
    const pi = Math.PI;
    const paths = {
      0: [arc(0.5, 0.5, 0.42, 0.47, 0, 2 * pi, 12)],
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
        [
          ...arc(0.45, 0.74, 0.47, 0.24, 2.5, -pi / 2),
          ...arc(0.45, 0.27, 0.47, 0.25, pi / 2, -2.5),
        ],
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
      8: [arc(0.5, 0.75, 0.38, 0.22, 0, 2 * pi, 10), arc(0.5, 0.28, 0.45, 0.26, 0, 2 * pi, 10)],
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

  function tentRoof(out, cx, cz, y, w, d, rise) {
    const center = [cx, y + rise, cz],
      p = rectangularPlan(w, d, cx, cz),
      white = [0.87, 0.86, 0.77];
    for (let edge = 0; edge < 4; edge++) {
      const a = [p[edge][0], y, p[edge][1]],
        b = [p[(edge + 1) % 4][0], y, p[(edge + 1) % 4][1]];
      for (let i = 0; i < tentEdges; i++) {
        const q0 = lerp(a, b, i / tentEdges),
          q1 = lerp(a, b, (i + 1) / tentEdges);
        // Radial subdivisions capture the sagging fabric profile rather than a rigid pyramid.
        for (let j = 0; j < tentRows; j++) {
          const t = j / tentRows,
            u = (j + 1) / tentRows;
          const point = (q, k) => {
            const v = lerp(q, center, k * 0.96);
            v[1] -= Math.sin(k * Math.PI) * rise * 0.18;
            return v;
          };
          face(out, 'canvas', [point(q0, t), point(q1, t), point(q1, u), point(q0, u)], white);
        }
      }
      if (tier > 1) tube(out, 'metal', a, center, 0.06, [0.65, 0.64, 0.52], 6);
    }
    if (tier > 1)
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

  const warm = [1, 0.92, 0.78];
  for (const outline of m.geometry.outlines) {
    const p = clockwise(outline.slice(0, -1));
    mappedSolid(out, 'stone', p, 0, 1, [0.58, 0.54, 0.45]);
    glazedOutline(out, p, 1, 76, 4.5, [0.24, 0.3, 0.3], [0.62, 0.6, 0.52], 0.145);
    mappedCap(out, 'cladding', p, 76, [0.76, 0.71, 0.61]);
    for (let y = 7; y < 76; y += [100, 72, 36, 18][tier])
      bandPlan(out, p, y, 0.6, 0.65, [0.74, 0.68, 0.56], 'cladding');
  }
  for (const part of partsEvidence('abraj_al_bait').filter((p) => p.id !== 958867174)) {
    const p = partPlan(m, part),
      top = Number(part.tags.height),
      bottom = Math.max(76, Number(part.tags.min_height));
    glazedOutline(out, p, bottom, top - 2, 3.6, [0.24, 0.3, 0.29], [0.76, 0.7, 0.59], 0.145);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        count = Math.max(
          1,
          Math.floor(Math.hypot(a[0] - b[0], a[1] - b[1]) / [100, 40, 20, 6][tier]),
        );
      for (let j = 0; tier > 1 && j < count; j++) {
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
    for (let y = bottom + 3.6; y < top - 2; y += [100, 100, 28.8, 7.2][tier])
      bandPlan(out, p, y, 0.25, 0.42, [0.73, 0.67, 0.55], 'cladding');
    mappedCap(out, 'cladding', p, top - 2, [0.76, 0.7, 0.58]);
    bandPlan(out, p, top - 2, 2, 1, [0.78, 0.72, 0.6], 'cladding');
    if (tier === 3) guardrail(out, ringAt(p, top), 1.5, [0.76, 0.7, 0.54]);
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
    if (tier > 1)
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
  // Distant levels merge the thin V supports into an eight-triangle connector.
  if (tier < 2) {
    const lower = ringAt(rectangularPlan(49, 38), 399);
    const upper = ringAt(rectangularPlan(60, 50), 405);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(main, 'cladding', [lower[i], lower[k], upper[k], upper[i]], [0.79, 0.74, 0.62]);
    }
  }
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
      if (tier > 1) beam(main, 'metal', a[i], b[i], 0.7, 0.7, gold);
    }
    cap(main, 'metal', b, roofGreen);
  }
  loft(
    main,
    'metal',
    [radialRing(535, 5.3, 5.3, 16), radialRing(573, 1.9, 1.9, 16), radialRing(580, 0.7, 0.7, 16)],
    gold,
  );
  for (let y = 542; tier > 1 && y < 574; y += 6)
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
      [8, 12, 16, 24][tier],
      4,
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
  for (let i = 0; i <= crescentSteps; i++) {
    const a = Math.PI - a0 + (span * i) / crescentSteps,
      x = Math.cos(a) * r,
      yy = Math.sin(a) * r;
    outer.push([x * scale, cy + yy * scale]);
    const t = i / crescentSteps,
      innerStart = Math.atan2(cut - dy, -Math.sqrt(r * r - cut * cut)) + Math.PI * 2,
      innerEnd = Math.atan2(cut - dy, Math.sqrt(r * r - cut * cut)) + Math.PI * 2,
      theta = innerStart + (innerEnd - innerStart) * t;
    inner.push([Math.cos(theta) * ri * scale, cy + (dy + Math.sin(theta) * ri) * scale]);
  }
  for (let i = 0; i < crescentSteps; i++) {
    const p = [outer[i], outer[i + 1], inner[i + 1], inner[i]];
    // Endpoint strips collapse at the horn; emit only the nondegenerate fan there.
    for (const z of [-1.2, 1.2]) {
      let poly = p.map(([x, y]) => [x, y, z]);
      if (z < 0) poly = poly.toReversed();
      if (i === 0 || i === crescentSteps - 1) {
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
export const buildAbrajSkyline = (o) => build(o, 0),
  buildAbrajDistrict = (o) => build(o, 1),
  buildAbrajStreet = (o) => build(o, 2),
  buildAbrajCloseup = (o) => build(o, 3);

function curveValue(points, y) {
  for (let i = 1; i < points.length; i++)
    if (y <= points[i][0]) {
      const [a, u] = points[i - 1],
        [b, v] = points[i];
      return u + ((v - u) * (y - a)) / (b - a);
    }
  return points.at(-1)[1];
}

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
