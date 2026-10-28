/** Complete medium-fi browser derivatives, including all twelve connected guys and mapped foundations. */
import { readFileSync } from 'node:fs';
import {
  beam as fullBeam,
  torus as fullTorus,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  annulus as fullAnnulus,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import {
  box as fullBox,
  tube as fullTube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const map = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
function components(level) {
  const close = level === 'closeup',
    district = level === 'district';
  function box(out, slot, a, b, color) {
    if (!close && b[2] - a[2] < 0.4)
      face(
        out,
        slot,
        [
          [a[0], a[1], b[2]],
          [b[0], a[1], b[2]],
          [b[0], b[1], b[2]],
          [a[0], b[1], b[2]],
        ],
        color,
      );
    else fullBox(out, slot, a, b, color);
  }
  function beam(out, slot, a, b, w, d, color) {
    if (!close && w <= (district ? 0.25 : 0.13)) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        n = Math.hypot(dx, dy);
      if (n > 0.001) {
        const x = (-dy * w) / 2 / n,
          y = (dx * w) / 2 / n;
        face(
          out,
          slot,
          [
            [a[0] + x, a[1] + y, a[2] + d / 2],
            [a[0] - x, a[1] - y, a[2] + d / 2],
            [b[0] - x, b[1] - y, b[2] + d / 2],
            [b[0] + x, b[1] + y, b[2] + d / 2],
          ],
          color,
        );
        return;
      }
    }
    if (!close && Math.abs(b[1] - a[1]) < 0.001) {
      const dx = b[0] - a[0],
        dz = b[2] - a[2],
        n = Math.hypot(dx, dz),
        x = (-dz * w) / 2 / n,
        z = (dx * w) / 2 / n;
      const p = [
        [a[0] + x, a[1], a[2] + z],
        [a[0] - x, a[1], a[2] - z],
        [b[0] - x, b[1], b[2] - z],
        [b[0] + x, b[1], b[2] + z],
      ];
      face(out, slot, p, color);
      face(out, slot, p.toReversed(), color);
      return;
    }
    fullBeam(out, slot, a, b, w, d, color);
  }
  function tube(out, slot, a, b, r, color, n = 6) {
    fullTube(out, slot, a, b, r, color, Math.min(n, close ? 6 : district ? 3 : 4));
  }
  function antenna(out, a, b, r, color) {
    if (close) tube(out, 'metal', a, b, r, color, 6);
    else beam(out, 'metal', a, b, r * 2, r * 2, color);
  }
  function annulus(out, slot, inside, outside, y0, y1, color, n = 64) {
    if (district) {
      n = Math.min(n, outside < 3 ? 4 : 6);
      const p = (r, y, a) => [r * Math.cos(a), y, r * Math.sin(a)];
      for (let i = 0; i < n; i++) {
        const a = (-i * 2 * Math.PI) / n,
          b = (-(i + 1) * 2 * Math.PI) / n,
          top = [p(inside, y1, a), p(outside, y1, a), p(outside, y1, b), p(inside, y1, b)];
        face(out, slot, top, color);
        if (outside < 3 && y1 - y0 < 0.5) {
          face(out, slot, top.toReversed(), color);
          continue;
        }
        face(
          out,
          slot,
          [p(outside, y0, a), p(outside, y0, b), p(outside, y1, b), p(outside, y1, a)],
          color,
        );
        face(
          out,
          slot,
          [p(inside, y0, b), p(outside, y0, b), p(outside, y0, a), p(inside, y0, a)],
          color,
        );
      }
      return;
    }
    fullAnnulus(
      out,
      slot,
      inside,
      outside,
      y0,
      y1,
      color,
      Math.min(n, close ? (inside / outside > 0.93 ? 24 : 48) : outside < 3 ? 6 : 12),
    );
  }
  function disk(out, y, z, r, color) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n;
      triangle(
        out,
        'metal',
        [
          [0, y, z + 0.11],
          [r * Math.cos(a), y + r * Math.sin(a), z + 0.11],
          [r * Math.cos(b), y + r * Math.sin(b), z + 0.11],
        ],
        color,
      );
    }
  }
  const pi = Math.PI;
  const concrete = [0.72, 0.73, 0.69],
    steel = [0.78, 0.81, 0.8];
  const gray = [0.36, 0.4, 0.41],
    dark = [0.12, 0.16, 0.19];
  const red = [0.58, 0.18, 0.11],
    glazing = [0.14, 0.24, 0.28];
  const sides = close ? 48 : district ? 12 : 24;
  function cylinder(out, slot, y0, y1, r, color, count = sides, center = [0, 0]) {
    count = Math.min(
      count,
      !district && slot === 'glass' && r < 6
        ? Math.max(48, sides)
        : r < 0.2
          ? district
            ? 3
            : close
              ? 6
              : 4
          : district
            ? r < 1
              ? 4
              : 6
            : sides,
    );
    if (close && r < 0.05) {
      const p = radialRing(y1, r, r, 6, center);
      for (let i = 1; i < 5; i++) triangle(out, slot, [p[0], p[i], p[i + 1]], color);
      return;
    }
    loft(
      out,
      slot,
      [radialRing(y0, r, r, count, center), radialRing(y1, r, r, count, center)],
      color,
    );
  }
  function rail(out, radius, y, color = red, count = 64) {
    const n = Math.min(count, close ? 32 : district ? (radius < 3 ? 4 : 6) : radius < 3 ? 6 : 12),
      posts = close || district ? n : 6;
    for (const [h, r] of district
      ? [[1.02, 0.035]]
      : [
          [1.02, 0.035],
          [0.52, 0.022],
        ]) {
      if (district) {
        const points = Array.from({ length: n }, (_, i) => {
          const a = (-i * 2 * pi) / n;
          return [
            [Math.cos(a) * (radius - r), y + h, Math.sin(a) * (radius - r)],
            [Math.cos(a) * (radius + r), y + h, Math.sin(a) * (radius + r)],
          ];
        });
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n,
            p = [points[i][0], points[i][1], points[j][1], points[j][0]];
          face(out, 'metal', p, color);
          face(out, 'metal', p.toReversed(), color);
        }
      } else fullTorus(out, 'metal', [0, y + h, 0], radius, r, color, n, 3);
    }
    for (let i = 0; i < posts; i++) {
      const a = (i * 2 * pi) / posts,
        p = [radius * Math.cos(a), y, radius * Math.sin(a)];
      if (district) {
        const t = [-Math.sin(a) * 0.026, 0, Math.cos(a) * 0.026];
        face(
          out,
          'metal',
          [
            [p[0] + t[0], y, p[2] + t[2]],
            [p[0] - t[0], y, p[2] - t[2]],
            [p[0] - t[0], y + 1.05, p[2] - t[2]],
            [p[0] + t[0], y + 1.05, p[2] + t[2]],
          ],
          color,
        );
      } else tube(out, 'metal', p, [p[0], y + 1.05, p[2]], 0.026, color, 4);
    }
  }
  function radial(out, angle) {
    return transform(out, pi / 2 - angle);
  }
  function window(out, angle, y, width, height, r = 5.35) {
    if (close) {
      const g = radial(out, angle),
        half = width / 2,
        outer = [
          [-half - 0.04, y - 0.04],
          [half + 0.04, y - 0.04],
          [half + 0.04, y + height + 0.04],
          [-half - 0.04, y + height + 0.04],
        ],
        inner = [
          [-half + 0.04, y + 0.04],
          [half - 0.04, y + 0.04],
          [half - 0.04, y + height - 0.04],
          [-half + 0.04, y + height - 0.04],
        ],
        p = (v, z) => [v[0], v[1], z];
      face(
        g,
        'glass',
        [
          [-half, y, r - 0.1],
          [half, y, r - 0.1],
          [half, y + height, r - 0.1],
          [-half, y + height, r - 0.1],
        ],
        glazing,
      );
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        face(
          g,
          'metal',
          [
            p(outer[i], r + 0.04),
            p(outer[j], r + 0.04),
            p(inner[j], r + 0.04),
            p(inner[i], r + 0.04),
          ],
          gray,
        );
        face(
          g,
          'metal',
          [
            p(outer[i], r - 0.13),
            p(outer[j], r - 0.13),
            p(outer[j], r + 0.04),
            p(outer[i], r + 0.04),
          ],
          gray,
        );
        face(
          g,
          'metal',
          [
            p(inner[j], r - 0.13),
            p(inner[i], r - 0.13),
            p(inner[i], r + 0.04),
            p(inner[j], r + 0.04),
          ],
          gray,
        );
      }
      fullBox(
        g,
        'concrete',
        [-half - 0.08, y - 0.11, r - 0.08],
        [half + 0.08, y - 0.03, r + 0.16],
        concrete,
      );
      return;
    }
    const g = radial(out, angle),
      half = width / 2;
    box(g, 'glass', [-half, y, r - 0.13], [half, y + height, r - 0.1], glazing);
    for (const x of [-half, half])
      box(g, 'metal', [x - 0.04, y, r - 0.13], [x + 0.04, y + height, r + 0.04], gray);
    for (const yy of [y, y + height])
      box(
        g,
        'metal',
        [-half - 0.04, yy - 0.04, r - 0.13],
        [half + 0.04, yy + 0.04, r + 0.04],
        gray,
      );
    box(
      g,
      'concrete',
      [-half - 0.08, y - 0.11, r - 0.08],
      [half + 0.08, y - 0.03, r + 0.16],
      concrete,
    );
  }
  function shaft(out) {
    if (district) {
      simpleShaft(out);
      return;
    }
    // Build the actual window openings into the shaft rather than painting rectangles over it.
    const yCuts = [0, 1.95, 4.65, 58];
    for (let k = 0; k < 18; k++) yCuts.push(3.5 + k * 3, 4.22 + k * 3);
    const ys = [...new Set(yCuts)].sort((a, b) => a - b);
    const r = 5.35,
      openingHalfAngle = 0.065;
    const openingCenters = [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2];
    const angles = Array.from({ length: sides }, (_, i) => (i * 2 * pi) / sides);
    for (const a of openingCenters) angles.push(a - openingHalfAngle, a + openingHalfAngle);
    const phase = -0.88 + 2 * pi;
    angles.push(phase - 0.14, phase + 0.14);
    angles.sort((a, b) => a - b);
    const angularDistance = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    for (let j = 1; j < ys.length; j++) {
      const y0 = ys[j - 1],
        y1 = ys[j],
        midY = (y0 + y1) / 2;
      const onWindow = Array.from({ length: 18 }, (_, k) => 3.5 + k * 3).some(
        (y) => midY > y && midY < y + 0.72,
      );
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * pi;
        const mid = (a + b) / 2;
        if (
          onWindow &&
          openingCenters.some((c) => Math.abs(angularDistance(mid, c)) < openingHalfAngle)
        )
          continue;
        if (midY > 1.95 && midY < 4.65 && Math.abs(angularDistance(mid, phase)) < 0.14) continue;
        face(
          out,
          'concrete',
          [
            [r * Math.cos(b), y0, r * Math.sin(b)],
            [r * Math.cos(a), y0, r * Math.sin(a)],
            [r * Math.cos(a), y1, r * Math.sin(a)],
            [r * Math.cos(b), y1, r * Math.sin(b)],
          ],
          concrete,
        );
      }
    }
    for (const a of openingCenters)
      for (let k = 0; k < 18; k++) window(out, a, 3.5 + k * 3, 0.64, 0.72);
    const door = radial(out, phase);
    box(door, 'metal', [-0.77, 1.95, 5.17], [0.77, 4.65, 5.21], gray);
    for (const x of [-0.79, 0.79])
      box(door, 'concrete', [x - 0.1, 1.92, 5.2], [x + 0.1, 4.8, 5.56], concrete);
    box(door, 'concrete', [-0.88, 4.66, 5.2], [0.88, 4.85, 5.56], concrete);
    for (let k = 0; k < 10; k++)
      box(
        door,
        'concrete',
        [-1.2, k * 0.195, 5.3],
        [1.2, (k + 1) * 0.195, 8.0 - k * 0.27],
        concrete,
      );
    const upperYs = [57.85, 100];
    for (const y of [64, 70, 76, 82, 92]) upperYs.push(y, y + (y === 92 ? 0.7 : 1.25));
    upperYs.sort((a, b) => a - b);
    for (let j = 1; j < upperYs.length; j++) {
      const y0 = upperYs[j - 1],
        y1 = upperYs[j],
        m = (y0 + y1) / 2;
      const opening = [64, 70, 76, 82, 92].some((y) => m > y && m < y + (y === 92 ? 0.7 : 1.25));
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * pi;
        if (
          opening &&
          openingCenters.some((c) => Math.abs(angularDistance((a + b) / 2, c)) < openingHalfAngle)
        )
          continue;
        face(
          out,
          'concrete',
          [
            [5.05 * Math.cos(b), y0, 5.05 * Math.sin(b)],
            [5.05 * Math.cos(a), y0, 5.05 * Math.sin(a)],
            [5.05 * Math.cos(a), y1, 5.05 * Math.sin(a)],
            [5.05 * Math.cos(b), y1, 5.05 * Math.sin(b)],
          ],
          concrete,
        );
      }
    }
  }
  function glazedRing(out, y0, y1, r, count = 48) {
    count = district ? 6 : r < 6 ? Math.max(48, sides) : Math.min(count, close ? 32 : 12);
    cylinder(out, 'glass', y0, y1, r - 0.08, glazing, count);
    annulus(out, 'concrete', 4.96, r + 0.22, y0 - 0.23, y0, concrete, sides);
    annulus(out, 'concrete', 4.96, r + 0.22, y1, y1 + 0.25, concrete, sides);
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * pi) / count,
        g = radial(out, a);
      box(g, 'metal', [-0.055, y0, r - 0.11], [0.055, y1, r + 0.06], steel);
    }
    if (!district)
      fullTorus(out, 'metal', [0, y0 + 0.85, 0], r, 0.045, steel, sides, close ? 4 : 3);
  }
  function dish(out, angle, y, radius, r = 6.9) {
    const g = radial(out, angle),
      center = [0, y, r];
    beam(g, 'metal', [0, y - 0.65, 5.1], [0, y - 0.65, r], 0.12, 0.12, gray);
    // Closed shallow radome, with a recessed mounting neck behind it.
    tube(g, 'metal', [0, y, r - 0.38], [0, y, r - 0.13], radius * 0.2, gray, 12);
    if (district) {
      disk(g, y, r, radius, steel);
      return;
    }
    const slices = close ? 24 : 8;
    const rings = [0, 0.5, 1].map((t) =>
      Array.from({ length: slices }, (_, i) => {
        const a = (i * 2 * pi) / slices;
        const rr = radius * (0.9 + 0.1 * Math.sin(t * pi));
        return [
          center[0] + rr * Math.cos(a),
          center[1] + rr * Math.sin(a),
          center[2] - 0.11 + t * 0.22,
        ];
      }),
    );
    loft(g, 'metal', rings, steel);
  }
  function decks(out) {
    glazedRing(out, 58.1, 61.0, 8.2);
    glazedRing(out, 86.7, 89.5, 8.1);
    for (const y of [62, 68, 74, 80, 86, 90]) {
      const r = y === 90 ? 7.45 : 7.65;
      annulus(out, 'concrete', 4.97, r, y - 0.28, y, concrete, sides);
      rail(out, r - 0.15, y);
      const braces = close ? 16 : district ? 6 : 8;
      for (let i = 0; i < braces; i++) {
        const a = (i * 2 * pi) / braces;
        beam(
          out,
          'concrete',
          [5 * Math.cos(a), y - 0.8, 5 * Math.sin(a)],
          [(r - 0.4) * Math.cos(a), y - 0.26, (r - 0.4) * Math.sin(a)],
          0.2,
          0.24,
          concrete,
        );
      }
    }
    for (const y of [64, 70, 76, 82, 92])
      for (const a of [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2])
        window(out, a, y, 0.64, y === 92 ? 0.7 : 1.25, 5.06);
    for (const [a, y, r] of [
      [0.1, 65, 0.85],
      [1.0, 66, 0.65],
      [2.3, 71, 0.7],
      [3.5, 73, 0.55],
      [4.3, 77, 0.9],
      [5.0, 79, 0.55],
      [0.7, 83, 1.0],
      [2.8, 84, 0.85],
      [4.7, 84, 0.65],
    ])
      dish(out, a, y, r);
    for (const y of [65, 71, 77, 83])
      for (const a of [0.9, 2.8, 4.6]) {
        const g = radial(out, a);
        box(g, 'metal', [-0.18, y - 1, 6.35], [0.18, y + 1.1, 6.66], steel);
        beam(g, 'metal', [0, y - 0.8, 5.0], [0, y - 0.8, 6.4], 0.08, 0.08, gray);
      }
    glazedRing(out, 97.0, 99.4, 5.15, 32);
    cylinder(out, 'concrete', 99.65, 100, 5.4, concrete);
    rail(out, 5.22, 100, gray, 48);
  }
  function anchorFitting(anchor, index) {
    let best = [0, 0],
      longest = 0;
    for (let i = 0; i < anchor.outline.length; i++) {
      const a = anchor.outline[i],
        b = anchor.outline[(i + 1) % anchor.outline.length];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d > longest) {
        longest = d;
        best = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
      }
    }
    return [
      anchor.center[0] + best[0] * (index - 1.5),
      1.2,
      anchor.center[1] + best[1] * (index - 1.5),
    ];
  }
  function guy(out, anchor, y, index) {
    const [x, z] = anchor.center,
      length = Math.hypot(x, z),
      ux = x / length,
      uz = z / length;
    const start = [ux * 1.55, y, uz * 1.55],
      end = anchorFitting(anchor, index);
    const point = (t) =>
      start.map((v, k) => v + (end[k] - v) * t - (k === 1 ? 1.3 * 4 * t * (1 - t) : 0));
    const segments = close ? 24 : district ? 4 : 12;
    tubePath(
      out,
      'metal',
      Array.from({ length: segments + 1 }, (_, i) => point(i / segments)),
      0.0375,
      gray,
      close ? 6 : 3,
    );
    const t = 0.985;
    tube(out, 'metal', point(t), end, 0.085, steel, 10);
    for (const tt of close ? [0.03, 0.034, 0.038] : [])
      tube(out, 'metal', point(tt), point(tt + 0.0015), 0.08, gray, 8);
  }
  function mast(out) {
    cylinder(out, 'metal', 100, 360, 1, steel, 64);
    for (let y = 104; y < 357; y += close ? 5 : district ? 50 : 20) {
      annulus(out, 'metal', 0.99, 1.055, y, y + 0.08, gray, 64);
      for (let i = 0; i < (close ? 6 : 0); i++) {
        const a = (i * pi) / 3;
        cylinder(out, 'metal', y + 0.08, y + 0.14, 0.042, gray, 6, [
          1.01 * Math.cos(a),
          1.01 * Math.sin(a),
        ]);
      }
    }
    // Four guy height bands share the same three ground anchors; four height bands.
    for (const [index, y] of [122, 226, 302, 350].entries()) {
      annulus(out, 'metal', 0.97, 1.35, y - 0.45, y + 0.45, gray, 48);
      for (const anchor of map.anchors) {
        const [x, z] = anchor.center,
          d = Math.hypot(x, z);
        beam(
          out,
          'metal',
          [x / d, y + 2.5, z / d],
          [(x / d) * 1.7, y, (z / d) * 1.7],
          0.15,
          0.2,
          gray,
        );
        guy(out, anchor, y, index);
      }
      annulus(out, 'metal', 0.99, 2.6, y - 2.1, y - 1.85, gray, 48);
      rail(out, 2.48, y - 1.85, steel, 32);
    }
    for (const y of [128, 212, 270, 309]) {
      annulus(out, 'metal', 0.99, 2.2, y, y + 0.18, gray, 48);
      rail(out, 2.08, y + 0.18, steel, 28);
    }
    // The octagonal reportage cabin documented at approximately 220 m.
    cylinder(out, 'metal', 217.6, 218.0, 4.15, steel, 8);
    cylinder(out, 'glass', 218, 221, 3.92, glazing, 8);
    cylinder(out, 'metal', 221, 221.45, 4.15, steel, 8);
    for (let i = 0; i < 8; i++) {
      const a = pi / 8 + (i * pi) / 4,
        g = radial(out, a);
      for (const x of [-1.48, 1.48])
        box(g, 'metal', [x - 0.065, 218, 3.59], [x + 0.065, 221, 3.72], steel);
      box(g, 'metal', [-1.54, 218, 3.59], [1.54, 218.52, 3.73], steel);
      box(g, 'metal', [-1.54, 220.55, 3.59], [1.54, 221, 3.73], steel);
      beam(
        out,
        'metal',
        [Math.cos(a), 214.5, Math.sin(a)],
        [3.8 * Math.cos(a), 217.65, 3.8 * Math.sin(a)],
        0.12,
        0.16,
        gray,
      );
    }
    // The current four-sided FM/DAB antenna bank: individual dipoles and support frames.
    const rackCount = district ? 7 : 14;
    for (let j = 0; j < rackCount; j++) {
      const y = 311.5 + (j * 33.8) / (rackCount - 1);
      for (let i = 0; i < 4; i++) {
        const a = pi / 8 + (i * pi) / 2,
          g = radial(out, a);
        beam(g, 'metal', [0, y, 1], [0, y, 2.6], 0.1, 0.11, gray);
        beam(g, 'metal', [-1.08, y, 2.5], [1.08, y, 2.5], 0.075, 0.075, steel);
        for (const x of [-0.94, -0.36, 0.36, 0.94])
          antenna(g, [x, y - 0.6, 2.5], [x, y + 0.6, 2.5], 0.043, gray);
        antenna(g, [-1.16, y - 1.1, 1.7], [-1.16, y + 1.1, 1.7], 0.055, steel);
        antenna(g, [1.16, y - 1.1, 1.7], [1.16, y + 1.1, 1.7], 0.055, steel);
      }
    }
    for (const y of [352.5, 356.5])
      for (let i = 0; i < 8; i++) {
        const g = radial(out, (i * pi) / 4);
        beam(g, 'metal', [0, y, 1], [0, y, 2.1], 0.07, 0.07, gray);
        tube(g, 'metal', [0, y - 0.52, 2.1], [0, y + 0.52, 2.1], 0.044, gray, 8);
      }
    cylinder(out, 'metal', 360, 361, 0.72, dark, 32);
    cylinder(out, 'metal', 361, 372, 0.47, steel, 32);
    for (let y = 362; y < 372; y += 1.5) annulus(out, 'metal', 0.46, 0.5, y, y + 0.055, gray, 32);
    for (const y of [150, 225, 300, 350])
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * pi) / 3;
        cylinder(out, 'metal', y, y + 0.35, 0.13, red, 12, [
          1.18 * Math.cos(a),
          1.18 * Math.sin(a),
        ]);
      }
  }
  function buildGerbrandy(out) {
    shaft(out);
    decks(out);
    mast(out);
    for (const anchor of map.anchors) {
      const area = anchor.outline.reduce((sum, p, i) => {
        const q = anchor.outline[(i + 1) % anchor.outline.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      const ring = area > 0 ? anchor.outline.toReversed() : [...anchor.outline];
      loft(
        out,
        'concrete',
        [ring.map(([x, z]) => [x, 0, z]), ring.map(([x, z]) => [x, 1.25, z])],
        concrete,
      );
      const [x, z] = anchor.center,
        d = Math.hypot(x, z);
      for (let i = 0; i < 4; i++) {
        const end = anchorFitting(anchor, i);
        beam(
          out,
          'metal',
          [end[0] + (x / d) * 0.28, 0.55, end[2] + (z / d) * 0.28],
          [end[0] - (x / d) * 0.35, 1.45, end[2] - (z / d) * 0.35],
          0.18,
          0.1,
          gray,
        );
      }
    }
  }

  function simpleShaft(out) {
    const phase = -0.88 + 2 * pi,
      angles = [
        ...Array.from({ length: 12 }, (_, i) => (i * 2 * pi) / 12),
        phase - 0.14,
        phase + 0.14,
      ].sort((a, b) => a - b),
      ys = [0, 1.95, 4.65, 58];
    for (let j = 1; j < ys.length; j++)
      for (let i = 0; i < angles.length; i++) {
        const a = angles[i],
          b = i + 1 < angles.length ? angles[i + 1] : angles[0] + 2 * pi;
        if (
          j === 2 &&
          Math.abs(Math.atan2(Math.sin((a + b) / 2 - phase), Math.cos((a + b) / 2 - phase))) < 0.14
        )
          continue;
        const p = (t) => [5.35 * Math.cos(t), 0, 5.35 * Math.sin(t)];
        face(
          out,
          'concrete',
          [
            [p(b)[0], ys[j - 1], p(b)[2]],
            [p(a)[0], ys[j - 1], p(a)[2]],
            [p(a)[0], ys[j], p(a)[2]],
            [p(b)[0], ys[j], p(b)[2]],
          ],
          concrete,
        );
      }
    cylinder(out, 'concrete', 57.85, 100, 5.05, concrete, 12);
    for (const a of [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2]) {
      const g = radial(out, a);
      for (let k = 0; k < 18; k++)
        box(g, 'glass', [-0.32, 3.5 + k * 3, 5.36], [0.32, 4.22 + k * 3, 5.38], glazing);
      for (const y of [64, 70, 76, 82, 92])
        box(g, 'glass', [-0.32, y, 5.06], [0.32, y + (y === 92 ? 0.7 : 1.25), 5.08], glazing);
    }
    const d = radial(out, phase);
    box(d, 'metal', [-0.77, 1.95, 5.17], [0.77, 4.65, 5.21], gray);
    for (const x of [-0.79, 0.79])
      fullBox(d, 'concrete', [x - 0.1, 1.92, 5.2], [x + 0.1, 4.8, 5.56], concrete);
    fullBox(d, 'concrete', [-0.88, 4.66, 5.2], [0.88, 4.85, 5.56], concrete);
    for (let k = 0; k < 10; k++)
      fullBox(
        d,
        'concrete',
        [-1.2, k * 0.195, 5.3],
        [1.2, (k + 1) * 0.195, 8 - k * 0.27],
        concrete,
      );
  }
  function distant(out) {
    const n = 6,
      tau = 2 * pi;
    function diskFloor(y, r, color, slot = 'metal', normal = 0, segments = n) {
      const p = radialRing(y, r, r, segments);
      for (let i = 1; i < segments - 1; i++) {
        const f = [p[0], p[i], p[i + 1]];
        if (normal >= 0) triangle(out, slot, f, color);
        if (normal <= 0) triangle(out, slot, f.toReversed(), color);
      }
    }
    function band(slot, y0, y1, r, color, segments = n) {
      loft(out, slot, [radialRing(y0, r, r, segments), radialRing(y1, r, r, segments)], color, {
        cap: false,
      });
    }
    band('concrete', 0, 58, 5.35, concrete);
    diskFloor(58, 5.35, concrete, 'concrete', 1);
    cylinder(out, 'concrete', 57.85, 100, 5.05, concrete, n);
    // Four window columns keep their phase and area-weighted coverage at skyline distance.
    const windowMean = concrete.map((v, i) => v * 0.75 + glazing[i] * 0.25);
    for (const a of [0.28, 0.28 + pi / 2, 0.28 + pi, 0.28 + (3 * pi) / 2]) {
      const f = radial(out, a);
      face(
        f,
        'concrete',
        [
          [-0.32, 3.5, 5.38],
          [0.32, 3.5, 5.38],
          [0.32, 55.22, 5.38],
          [-0.32, 55.22, 5.38],
        ],
        windowMean,
      );
      for (const y of [64, 70, 76, 82, 92])
        face(
          f,
          'glass',
          [
            [-0.32, y, 5.08],
            [0.32, y, 5.08],
            [0.32, y + (y === 92 ? 0.7 : 1.25), 5.08],
            [-0.32, y + (y === 92 ? 0.7 : 1.25), 5.08],
          ],
          glazing,
        );
    }
    const door = radial(out, -0.88);
    face(
      door,
      'metal',
      [
        [-0.77, 1.95, 5.38],
        [0.77, 1.95, 5.38],
        [0.77, 4.65, 5.38],
        [-0.77, 4.65, 5.38],
      ],
      gray,
    );
    const step = [
      [-1.2, 0, 8],
      [1.2, 0, 8],
      [1.2, 1.95, 5.3],
      [-1.2, 1.95, 5.3],
    ];
    face(door, 'concrete', step, concrete);
    for (const x of [-1.2, 1.2])
      triangle(
        door,
        'concrete',
        [
          [x, 0, 8],
          [x, 0, 5.3],
          [x, 1.95, 5.3],
        ],
        concrete,
      );
    for (const [y0, y1, r] of [
      [58.1, 61, 8.2],
      [86.7, 89.5, 8.1],
      [97, 99.4, 5.15],
    ]) {
      band('concrete', y0 - 0.23, y0, r + 0.22, concrete);
      band('glass', y0, y1, r - 0.08, glazing);
      band('concrete', y1, y1 + 0.25, r + 0.22, concrete);
      diskFloor(y0 - 0.23, r + 0.22, concrete, 'concrete', -1);
      diskFloor(y1 + 0.25, r + 0.22, concrete, 'concrete', 1);
    }
    for (const y of [62, 68, 74, 80, 86, 90]) {
      const r = y === 90 ? 7.45 : 7.65;
      cylinder(out, 'concrete', y - 0.28, y, r, concrete, n);
      // Thin open rail, with no opaque wall filling the equipment gallery.
      const radius = r - 0.15;
      for (let i = 0; i < n; i++) {
        const a = (-i * tau) / n,
          b = (-(i + 1) * tau) / n,
          p = (r, t) => [Math.cos(t) * r, y + 1.02, Math.sin(t) * r],
          f = [
            p(radius - 0.035, a),
            p(radius + 0.035, a),
            p(radius + 0.035, b),
            p(radius - 0.035, b),
          ];
        face(out, 'metal', f, red);
        face(out, 'metal', f.toReversed(), red);
      }
    }
    cylinder(out, 'metal', 100, 360, 1, steel, n);
    for (const y of [119.9, 223.9, 299.9, 347.9, 128, 212, 270, 309]) {
      const small = [128, 212, 270, 309].includes(y);
      diskFloor(y + (small ? 0.18 : 0.25), small ? 2.2 : 2.6, gray);
    }
    band('metal', 217.6, 218, 4.15, steel, 8);
    band('glass', 218, 221, 3.92, glazing, 8);
    band('metal', 221, 221.45, 4.15, steel, 8);
    diskFloor(217.6, 4.15, steel, 'metal', -1, 8);
    diskFloor(221.45, 4.15, steel, 'metal', 1, 8);
    for (const anchor of map.anchors) {
      const area = anchor.outline.reduce((sum, p, i) => {
        const q = anchor.outline[(i + 1) % anchor.outline.length];
        return sum + p[0] * q[1] - q[0] * p[1];
      }, 0);
      const ring = area > 0 ? anchor.outline.toReversed() : [...anchor.outline];
      loft(
        out,
        'concrete',
        [ring.map(([x, z]) => [x, 0, z]), ring.map(([x, z]) => [x, 1.25, z])],
        concrete,
      );
      const [x, z] = anchor.center,
        d = Math.hypot(x, z);
      for (const [index, y] of [122, 226, 302, 350].entries()) {
        const start = [(x / d) * 1.55, y, (z / d) * 1.55],
          end = anchorFitting(anchor, index),
          points = Array.from({ length: 3 }, (_, i) => {
            const t = i / 2;
            return start.map(
              (v, k) => v + (end[k] - v) * t - (k === 1 ? 1.3 * 4 * t * (1 - t) : 0),
            );
          });
        tubePath(out, 'metal', points, 0.0375, gray, 3);
      }
    }
    // Four complete antenna-bank silhouettes retain their top/bottom extent and compass phase.
    for (let i = 0; i < 4; i++) {
      const f = radial(out, pi / 8 + (i * pi) / 2);
      for (const x of [-1.16, 1.16])
        face(
          f,
          'metal',
          [
            [x - 0.055, 310.4, 2.5],
            [x + 0.055, 310.4, 2.5],
            [x + 0.055, 346.4, 2.5],
            [x - 0.055, 346.4, 2.5],
          ],
          steel,
        );
      for (const y of [311.5, 322.76666666666665, 334.0333333333333, 345.3])
        face(
          f,
          'metal',
          [
            [-1.08, y - 0.04, 2.5],
            [1.08, y - 0.04, 2.5],
            [1.08, y + 0.04, 2.5],
            [-1.08, y + 0.04, 2.5],
          ],
          steel,
        );
    }
    for (const [a, y, r] of [
      [0.1, 65, 0.85],
      [1, 66, 0.65],
      [2.3, 71, 0.7],
      [3.5, 73, 0.55],
      [4.3, 77, 0.9],
      [5, 79, 0.55],
      [0.7, 83, 1],
      [2.8, 84, 0.85],
      [4.7, 84, 0.65],
    ]) {
      const f = radial(out, a),
        points = Array.from({ length: 4 }, (_, i) => {
          const t = (i * tau) / 4;
          return [r * Math.cos(t), y + r * Math.sin(t), 7.01];
        });
      for (let j = 1; j < 3; j++)
        triangle(f, 'metal', [points[0], points[j], points[j + 1]], steel);
    }
    cylinder(out, 'metal', 360, 361, 0.72, dark, n);
    cylinder(out, 'metal', 361, 372, 0.47, steel, n);
    for (const y of [150, 225, 300, 350])
      face(
        out,
        'metal',
        [
          [-0.13, y, 1.31],
          [0.13, y, 1.31],
          [0.13, y + 0.35, 1.31],
          [-0.13, y + 0.35, 1.31],
        ],
        red,
      );
  }
  return { build: buildGerbrandy, distant };
}
export const gerbrandyDistrict = (out) => components('district').build(out);
export const gerbrandyStreet = (out) => components('street').build(out);
export const gerbrandyCloseup = (out) => components('closeup').build(out);
export function gerbrandySkyline(out) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](slot, ref, p, n, uv, slot === 'glass' ? color : color.map((v) => v * 0.65)),
    ]),
  );
  components('skyline').distant(target);
}
