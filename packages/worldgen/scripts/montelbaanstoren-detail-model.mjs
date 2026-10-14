/** N0622 reviewed source-local reconstruction. The original measured-section draft remains unchanged. */
import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  loft,
  normalize,
  radialRing,
  sphere as sourceSphere,
} from './authored-structure-mesh.mjs';
import {
  face,
  frame,
  column as sourceColumn,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { shell as sourceShell } from './lighthouse-expansion-models.mjs';
import { lathe as sourceLathe } from './lighthouse-models.mjs';
import { box, tube as sourceTube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const footprint = JSON.parse(
  readFileSync(structureSourcePath('n0622_montelbaanstoren', 'map-frame.json')),
).geometry.outline;
function detail(out, mode) {
  const select = (master, close, street, district) =>
    mode === 'master' ? master : mode === 'closeup' ? close : mode === 'street' ? street : district;
  const curveSides = select(12, 6, 3, 3),
    scrollSteps = select(12, 4, 2, 1),
    archSteps = select(32, 12, 3, 3),
    clockSegments = select(120, 40, 16, 16);
  const sphere = (o, s, p, r, c, n, m) =>
    sourceSphere(
      o,
      s,
      p,
      r,
      c,
      select(n, Math.min(n, 16), Math.min(n, 6), 6),
      select(m, Math.min(m, 8), Math.min(m, 3), 3),
    );
  const tube = (o, s, a, b, r, c, n) =>
    sourceTube(o, s, a, b, r, c, select(n, Math.min(n, 8), Math.min(n, 4), 4));
  const column = (o, s, x, z, a, b, r, c, n) =>
    sourceColumn(o, s, x, z, a, b, r, c, select(n, 8, 3, 3));
  const lathe = (o, s, p, c, n, center) => sourceLathe(o, s, p, c, select(n, 24, 12, 8), center);
  const reviewedShell = (o, def) => {
    if (mode !== 'district') {
      sourceShell(o, def);
      return;
    }
    sourceShell(o, { ...def, holes: [] });
    for (const h of def.holes) {
      const t = transform(o, h.angle ?? 0),
        z = 4.4;
      face(
        t,
        'glass',
        [
          [-h.w / 2, h.y, z],
          [h.w / 2, h.y, z],
          [h.w / 2, h.y + h.h, z],
          [-h.w / 2, h.y + h.h, z],
        ],
        dark,
      );
      for (const x of [-h.w / 2, h.w / 2])
        face(
          t,
          'limestone',
          [
            [x - 0.065, h.y, z + 0.015],
            [x + 0.065, h.y, z + 0.015],
            [x + 0.065, h.y + h.h, z + 0.015],
            [x - 0.065, h.y + h.h, z + 0.015],
          ],
          pale,
        );
      // The paired canal windows retain their identifying stone crosses at district distance.
      if (h.y === 4) {
        face(
          t,
          'limestone',
          [
            [-0.06, h.y, z + 0.02],
            [0.06, h.y, z + 0.02],
            [0.06, h.y + h.h, z + 0.02],
            [-0.06, h.y + h.h, z + 0.02],
          ],
          pale,
        );
        const y = h.y + h.h * 0.64;
        face(
          t,
          'limestone',
          [
            [-h.w / 2, y - 0.06, z + 0.025],
            [h.w / 2, y - 0.06, z + 0.025],
            [h.w / 2, y + 0.06, z + 0.025],
            [-h.w / 2, y + 0.06, z + 0.025],
          ],
          pale,
        );
      }
    }
  };
  const archY = (x, radius, rise, pointed) =>
    rise *
    (pointed
      ? Math.sqrt(Math.max(0, 4 - (Math.abs(x) / radius + 1) ** 2)) / Math.sqrt(3)
      : Math.sqrt(Math.max(0, 1 - (x / radius) ** 2)));
  /** A true arch opening cut out of a rectangular wall, with jamb/soffit reveals. */
  function archBay(
    out,
    slot,
    x,
    width,
    y0,
    spring,
    rise,
    top,
    z,
    thickness,
    color = stone,
    { pointed = false, back = true, trim = 0.12 } = {},
  ) {
    const r = width / 2,
      n = archSteps;
    if (back)
      box(
        out,
        'shadow',
        [x - r, y0, z - thickness - 0.1],
        [x + r, spring + rise, z - thickness],
        dark,
      );
    for (let i = 0; i < n; i++) {
      const a = -r + (width * i) / n,
        b = -r + (width * (i + 1)) / n;
      const ya = spring + archY(a, r, rise, pointed),
        yb = spring + archY(b, r, rise, pointed);
      if (top > Math.max(ya, yb))
        face(
          out,
          slot,
          [
            [x + a, ya, z],
            [x + b, yb, z],
            [x + b, top, z],
            [x + a, top, z],
          ],
          color,
        );
      face(
        out,
        slot,
        [
          [x + a, ya, z - thickness],
          [x + b, yb, z - thickness],
          [x + b, yb, z],
          [x + a, ya, z],
        ],
        color,
      );
      if (trim) beam(out, slot, [x + a, ya, z + 0.025], [x + b, yb, z + 0.025], trim, trim, color);
    }
    if (spring > y0) {
      face(
        out,
        slot,
        [
          [x - r, y0, z],
          [x - r, y0, z - thickness],
          [x - r, spring, z - thickness],
          [x - r, spring, z],
        ],
        color,
      );
      face(
        out,
        slot,
        [
          [x + r, y0, z - thickness],
          [x + r, y0, z],
          [x + r, spring, z],
          [x + r, spring, z - thickness],
        ],
        color,
      );
      if (trim)
        for (const sign of [-1, 1])
          box(
            out,
            slot,
            [x + sign * r - trim / 2, y0, z],
            [x + sign * r + trim / 2, spring, z + trim],
            color,
          );
    }
  }
  function facade(out, slot, width, y0, y1, z, windows, color = stone) {
    const xs = [
      ...new Set([
        -width / 2,
        width / 2,
        ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]),
      ]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort(
      (a, b) => a - b,
    );
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
          continue;
        face(
          out,
          slot,
          [
            [xs[i], ys[j], z],
            [xs[i + 1], ys[j], z],
            [xs[i + 1], ys[j + 1], z],
            [xs[i], ys[j + 1], z],
          ],
          color,
        );
      }
    for (const w of windows)
      archBay(out, slot, w.x, w.w, w.y, w.spring, w.rise, w.top, z, w.depth ?? 0.45, color, w);
  }

  const tau = Math.PI * 2;
  const brick = [0.49, 0.4, 0.31],
    pale = [0.88, 0.85, 0.76];
  const stone = [0.67, 0.64, 0.54],
    dark = [0.035, 0.048, 0.045],
    gold = [0.83, 0.64, 0.25];
  const octagon = (y, r) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8);

  function molding(out, y, r, height = 0.28) {
    if (mode === 'district') {
      loft(out, 'metal', [octagon(y, r), octagon(y + height, r + 0.09)], pale);
      return;
    }
    loft(
      out,
      'metal',
      [
        octagon(y, r - 0.08),
        octagon(y + height * 0.3, r),
        octagon(y + height * 0.7, r + 0.09),
        octagon(y + height, r + 0.09),
      ],
      pale,
    );
  }

  function curvedStrip(out, points, width, color = pale) {
    let normal;
    const rings = points.map((point, i) => {
      const before = points[Math.max(0, i - 1)],
        after = points[Math.min(points.length - 1, i + 1)];
      const tangent = normalize(after.map((v, axis) => v - before[axis]));
      if (!normal)
        normal = normalize(cross(tangent, Math.abs(tangent[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0]));
      else {
        const along = normal.reduce((sum, v, axis) => sum + v * tangent[axis], 0);
        normal = normalize(normal.map((v, axis) => v - along * tangent[axis]));
      }
      const binormal = cross(tangent, normal);
      return Array.from({ length: curveSides }, (_, j) =>
        point.map(
          (v, axis) =>
            v +
            width *
              (normal[axis] * Math.cos((j * tau) / curveSides) +
                binormal[axis] * Math.sin((j * tau) / curveSides)),
        ),
      );
    });
    loft(out, 'metal', rings, color);
  }

  function scroll(out, x, y, z, width, height) {
    // Profile of the lead-clad Renaissance counter-curves, reconstructed from the elevation.
    const points = [
      [0, 0],
      [0.34, 0.06],
      [0.46, 0.27],
      [0.44, 0.61],
      [0.26, 0.88],
      [0.05, 1],
      [-0.2, 0.94],
      [-0.23, 0.72],
      [-0.1, 0.66],
    ];
    const curve = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)],
        p1 = points[i];
      const p2 = points[i + 1],
        p3 = points[Math.min(points.length - 1, i + 2)];
      for (let j = 0; j <= scrollSteps; j++) {
        if (i > 0 && j === 0) continue;
        const t = j / scrollSteps;
        const p = p1.map(
          (v, k) =>
            0.5 *
            (2 * v +
              (-p0[k] + p2[k]) * t +
              (2 * p0[k] - 5 * v + 4 * p2[k] - p3[k]) * t * t +
              (-p0[k] + 3 * v - 3 * p2[k] + p3[k]) * t * t * t),
        );
        curve.push([x + p[0] * width, y + p[1] * height, z]);
      }
    }
    curvedStrip(out, curve, 0.065);
    sphere(out, 'metal', [x - width * 0.1, y + height * 0.66, z], [0.1, 0.1, 0.085], pale, 12, 8);
  }

  function clock(out, angle, y, z, radius = 1.06) {
    if (mode === 'district') {
      const t = transform(out, angle);
      face(
        t,
        'metal',
        [
          [-1.19, y - 1.19, z],
          [1.19, y - 1.19, z],
          [1.19, y + 1.19, z],
          [-1.19, y + 1.19, z],
        ],
        dark,
      );
      for (let j = 0; j < 12; j++) {
        const a = (j * tau) / 12,
          b = ((j + 1) * tau) / 12;
        face(
          t,
          'metal',
          [
            [Math.sin(a) * radius, y + Math.cos(a) * radius, z + 0.035],
            [Math.sin(b) * radius, y + Math.cos(b) * radius, z + 0.035],
            [Math.sin(b) * (radius - 0.04), y + Math.cos(b) * (radius - 0.04), z + 0.035],
            [Math.sin(a) * (radius - 0.04), y + Math.cos(a) * (radius - 0.04), z + 0.035],
          ],
          gold,
        );
      }
      for (const [a, l] of [
        [-Math.PI / 3, 0.62],
        [Math.PI / 3, 0.86],
      ])
        face(
          t,
          'metal',
          [
            [-0.025, y, z + 0.06],
            [0.025, y, z + 0.06],
            [Math.sin(a) * l + 0.02, y + Math.cos(a) * l, z + 0.06],
            [Math.sin(a) * l - 0.02, y + Math.cos(a) * l, z + 0.06],
          ],
          gold,
        );
      return;
    }
    const wall = transform(out, angle);
    box(wall, 'metal', [-1.19, y - 1.19, z - 0.05], [1.19, y + 1.19, z + 0.03], dark);
    frame(wall, 'metal', 0, y - 1.19, 2.38, 2.38, z + 0.04, 0.065, pale);
    const p = (r, t, depth = 0.085) => [Math.sin(t) * r, y + Math.cos(t) * r, z + depth];
    for (let i = 0; i < clockSegments; i++) {
      const a = (i * tau) / clockSegments,
        b = ((i + 1) * tau) / clockSegments;
      triangle(wall, 'metal', [[0, y, z + 0.07], p(radius, b, 0.07), p(radius, a, 0.07)], dark);
      tube(wall, 'metal', p(radius, a), p(radius, b), 0.025, gold, 8);
      if (mode !== 'district' && i % 2 === 0)
        beam(wall, 'metal', p(radius * 0.96, a), p(radius * 0.89, a), 0.014, 0.025, gold);
    }
    const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    const strokes = {
      I: [[0, 0, 0, 1]],
      V: [
        [-0.5, 1, 0, 0],
        [0, 0, 0.5, 1],
      ],
      X: [
        [-0.5, 0, 0.5, 1],
        [-0.5, 1, 0.5, 0],
      ],
    };
    for (let i = 0; mode !== 'district' && i < 12; i++) {
      const a = (i * tau) / 12,
        label = numerals[i];
      const at = (x, v) => [
        Math.sin(a) * (0.7 + v * 0.18) + Math.cos(a) * x,
        y + Math.cos(a) * (0.7 + v * 0.18) - Math.sin(a) * x,
        z + 0.11,
      ];
      for (let j = 0; j < label.length; j++)
        for (const [x, v, xx, vv] of strokes[label[j]]) {
          const offset = (j - (label.length - 1) / 2) * 0.068;
          beam(
            wall,
            'metal',
            at(offset + x * 0.057, v),
            at(offset + xx * 0.057, vv),
            0.022,
            0.022,
            gold,
          );
        }
    }
    for (const [a, length, width] of [
      [-Math.PI / 3, 0.62, 0.06],
      [Math.PI / 3, 0.86, 0.045],
    ]) {
      beam(wall, 'metal', [0, y, z + 0.15], p(length, a, 0.15), width, 0.045, gold);
      sphere(wall, 'metal', p(length * 0.67, a, 0.15), [0.07, 0.07, 0.03], gold, 12, 6);
    }
    sphere(wall, 'metal', [0, y, z + 0.17], [0.08, 0.08, 0.035], gold, 16, 8);
  }

  function bell(out, x, y, z, radius) {
    lathe(
      out,
      'metal',
      [
        [y, radius],
        [y + 0.1, radius * 0.95],
        [y + 0.25, radius * 0.7],
        [y + 0.68, radius * 0.48],
        [y + 0.86, radius * 0.3],
      ],
      [0.28, 0.24, 0.15],
      64,
      [x, z],
    );
    tube(out, 'metal', [x, y - 0.05, z], [x, y + 0.67, z], 0.045, dark, 12);
    sphere(out, 'metal', [x, y + 0.06, z], [0.085, 0.11, 0.085], dark, 16, 8);
    box(
      out,
      'wood',
      [x - 0.5, y + 0.83, z - 0.13],
      [x + 0.5, y + 1.03, z + 0.13],
      [0.24, 0.19, 0.12],
    );
  }

  function openStage(out, y0, spring, rise, top, r, width, corniceRadius = r) {
    const z = r * Math.cos(Math.PI / 8),
      halfFace = r * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const angle = (i * tau) / 8,
        wall = transform(out, angle);
      for (const side of [-1, 1]) {
        const lo = side < 0 ? -halfFace : width / 2,
          hi = side < 0 ? -width / 2 : halfFace;
        box(wall, 'metal', [lo, y0, z - 0.22], [hi, top, z], pale);
      }
      archBay(wall, 'metal', 0, width, y0, spring, rise, top, z, 0.22, pale, {
        back: false,
        trim: 0,
      });
      if (mode !== 'district')
        curvedStrip(
          wall,
          Array.from({ length: archSteps + 1 }, (_, j) => {
            const a = -Math.PI / 2 + (j * Math.PI) / archSteps;
            return [(Math.sin(a) * width) / 2, spring + Math.cos(a) * rise, z + 0.028];
          }),
          0.027,
        );
      // Reverse inner face keeps the genuine openings solid when seen through the opposite arch.
      const inside = transform(out, angle + Math.PI);
      archBay(inside, 'metal', 0, width, y0, spring, rise, top, -z + 0.22, 0.22, pale, {
        back: false,
        trim: 0,
      });
      for (const side of mode === 'district' ? [] : [-1, 1])
        column(
          wall,
          'metal',
          side * (halfFace - 0.08),
          z + 0.07,
          y0 + 0.08,
          spring,
          0.11,
          pale,
          20,
        );
      box(wall, 'metal', [-halfFace, y0, z - 0.2], [halfFace, y0 + 0.12, z + 0.1], pale);
      for (const x of mode === 'district' ? [] : [-width / 3, 0, width / 3])
        column(wall, 'metal', x, z + 0.02, y0 + 0.15, y0 + 0.8, 0.028, pale, 10);
      beam(
        wall,
        'metal',
        [-width / 2, y0 + 0.78, z + 0.04],
        [width / 2, y0 + 0.78, z + 0.04],
        0.09,
        0.09,
        pale,
      );
    }
    molding(out, top, corniceRadius, 0.24);
  }

  function buildMontelbaanstoren(out) {
    // Section ground-to-tip: (1629 - 69) / (371 px / 10 m) = 42.05 m.
    // The broad 1610 buttressing foot is an original geometric interpretation, not the buried foundation.
    const points =
      mode === 'district'
        ? footprint.filter((_, i) => i % 4 === 0 || i === 21 || i === 22 || i === 24)
        : footprint;
    const broad = points.map(([x, z]) => [x, 0, z]),
      shoulder = points.map(([x, z]) => [x, 0.68, z]),
      top = points.map(([x, z]) => {
        const r = Math.hypot(x, z);
        return [(x * 4.6) / r, 1.24, (z * 4.6) / r];
      });
    loft(out, 'brick', [broad, shoulder, top], brick);
    const holes = [
      ...[-0.28, 0.28, Math.PI / 2, -Math.PI / 2].map((angle) => ({
        angle,
        y: 4.0,
        h: 1.86,
        w: 1.07,
        depth: 0.34,
        trimSlot: 'limestone',
        trimColor: stone,
        grid: true,
      })),
      ...[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((angle) => ({
        angle,
        y: 11.83,
        h: 1.36,
        w: 0.72,
        depth: 0.28,
        trimSlot: 'limestone',
        trimColor: stone,
        grid: true,
      })),
    ];
    reviewedShell(out, {
      profile: [
        [1.2, 4.36],
        [14.1, 4.29],
      ],
      holes: holes.map((h) => ({ ...h, grid: false })),
      slot: 'round_brick',
      color: brick,
      segments: select(192, 64, 32, 16),
    });
    for (const h of mode === 'district' ? [] : holes.filter((h) => h.grid)) {
      const wall = transform(out, h.angle),
        r = 4.36 + ((4.29 - 4.36) * (h.y + h.h / 2 - 1.2)) / 12.9,
        z = r * Math.cos(Math.asin(h.w / (2 * r))) - h.depth + 0.06;
      box(wall, 'limestone', [-0.07, h.y, z - 0.02], [0.07, h.y + h.h, z + 0.11], pale);
      box(
        wall,
        'limestone',
        [-h.w / 2, h.y + h.h * 0.64 - 0.07, z - 0.02],
        [h.w / 2, h.y + h.h * 0.64 + 0.07, z + 0.11],
        pale,
      );
    }
    const land = transform(out, Math.PI, [-2.036, 0, 0]);
    const opening = [
      {
        x: 0,
        w: 1.04,
        y: 0.12,
        spring: 2.32,
        rise: 0,
        top: 2.32,
        depth: 0.055,
        trim: 0,
        back: false,
      },
      { x: 0, w: 1.9, y: 3.4, spring: 5.55, rise: 0, top: 5.55, depth: 0.17, trim: 0, back: false },
    ];
    facade(land, 'brick', 3.4, 0, 7.6, 5.6, opening, brick);
    box(land, 'brick', [-1.7, 0, 2.8], [-1.6, 7.6, 5.6], brick);
    box(land, 'brick', [1.6, 0, 2.8], [1.7, 7.6, 5.6], brick);
    box(land, 'brick', [-1.7, 7.5, 2.8], [1.7, 7.6, 5.6], brick);
    box(land, 'wood', [-0.52, 0.12, 5.535], [0.52, 2.32, 5.545], [0.33, 0.34, 0.3]);
    frame(land, 'limestone', 0, 0.12, 1.04, 2.2, 5.62, 0.12, stone);
    box(land, 'glass', [-0.95, 3.4, 5.4], [0.95, 5.55, 5.43], dark);
    frame(land, 'limestone', 0, 3.4, 1.9, 2.15, 5.63, 0.1, stone);
    box(land, 'limestone', [-0.06, 3.4, 5.43], [0.06, 5.55, 5.61], pale);
    box(land, 'limestone', [-0.95, 4.69, 5.43], [0.95, 4.82, 5.61], pale);
    const water = transform(out, 0);
    box(water, 'wood', [-0.38, 1.25, 4.33], [0.38, 2.55, 4.4], dark);
    frame(water, 'limestone', 0, 1.25, 0.76, 1.3, 4.44, 0.07, pale);
    // Upper masonry is eight-sided, with round-headed shallow recesses and stone dressings.
    const r = 4.45,
      z = r * Math.cos(Math.PI / 8),
      w = 2 * r * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const wall = transform(out, (i * tau) / 8);
      const nicheWidth = w - 0.58;
      facade(
        wall,
        'brick',
        w,
        14.1,
        19,
        z,
        [
          {
            x: 0,
            w: nicheWidth,
            y: 16.55,
            spring: 17.6,
            rise: 1.07,
            top: 18.82,
            depth: 0.18,
            trim: 0,
            back: false,
          },
        ],
        brick,
      );
      box(
        wall,
        'brick',
        [-nicheWidth / 2, 16.55, z - 0.22],
        [nicheWidth / 2, 18.67, z - 0.185],
        brick,
      );
      // The filled niche is brick, not an invented black glazed opening.
      for (let j = 0; mode !== 'district' && j < 5; j++) {
        const a = -Math.PI / 2 + (j * Math.PI) / 5,
          b = a + Math.PI / 10;
        beam(
          wall,
          'limestone',
          [(Math.sin(a) * nicheWidth) / 2, 17.6 + Math.cos(a) * 1.07, z + 0.018],
          [(Math.sin(b) * nicheWidth) / 2, 17.6 + Math.cos(b) * 1.07, z + 0.018],
          0.11,
          0.065,
          stone,
        );
      }
      box(
        wall,
        'limestone',
        [-nicheWidth / 2 - 0.04, 16.44, z - 0.02],
        [nicheWidth / 2 + 0.04, 16.57, z + 0.08],
        stone,
      );
      frame(wall, 'brick', 0, 14.38, nicheWidth, 1.55, z + 0.04, 0.1, brick);
      box(wall, 'limestone', [-nicheWidth / 2, 14.32, z], [nicheWidth / 2, 14.41, z + 0.07], stone);
      if (i % 2 === 0) {
        box(wall, 'glass', [-0.22, 15.91, z + 0.041], [0.22, 16.33, z + 0.055], dark);
        frame(wall, 'limestone', 0, 15.91, 0.44, 0.42, z + 0.063, 0.035, pale);
      }
      for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
        box(wall, 'brick', [x - 0.065, 14.2, z], [x + 0.065, 18.9, z + 0.09], brick);
      // Small masonry anchor plates and their fasteners are geometry shared with no private maps.
      for (const y of mode === 'district' ? [] : [14.4, 18.02]) {
        beam(
          wall,
          'metal',
          [-0.18, y - 0.18, z + 0.09],
          [0.18, y + 0.18, z + 0.09],
          0.04,
          0.025,
          dark,
        );
        beam(
          wall,
          'metal',
          [0.18, y - 0.18, z + 0.09],
          [-0.18, y + 0.18, z + 0.09],
          0.04,
          0.025,
          dark,
        );
      }
    }
    molding(out, 18.75, 4.5, 0.25);
    const clockProfile = [
      [19, 4.58],
      [19.25, 4.5],
      [19.6, 3.85],
      [20.25, 2.81],
      [23.35, 2.81],
    ];
    loft(
      out,
      'metal',
      clockProfile.map(([y, r]) => octagon(y, r)),
      pale,
    );
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * tau) / 8;
      if (mode !== 'district')
        curvedStrip(
          out,
          clockProfile.map(([y, r]) => [Math.cos(a) * (r + 0.015), y, Math.sin(a) * (r + 0.015)]),
          0.023,
        );
    }
    for (let i = 0; i < 4; i++)
      clock(out, (i * Math.PI) / 2, 21.92, 2.81 * Math.cos(Math.PI / 8) + 0.035);
    molding(out, 23.32, 3.08, 0.25);
    openStage(out, 23.57, 27.15, 0.67, 28.32, 2.55, 1.22, 2.85);
    // Curving lower lantern roof, intermediate ornaments and the narrower upper open stage.
    const transition = [
      [28.56, 2.8],
      [28.8, 2.76],
      [29.1, 2.45],
      [29.55, 1.96],
      [30.4, 1.64],
      [30.8, 1.59],
    ];
    loft(
      out,
      'metal',
      transition.map(([y, r]) => octagon(y, r)),
      pale,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        wall = transform(out, a);
      if (mode !== 'district') scroll(wall, 0, 28.9, 2.12, 1.15, 1.48);
      const corner = transform(out, a + Math.PI / 8);
      for (const [y, r] of mode === 'district'
        ? []
        : [
            [23.57, 3],
            [28.56, 2.85],
            [30.98, 1.72],
          ]) {
        column(corner, 'metal', 0, r, y, y + 0.58, 0.06, pale, 24);
        sphere(corner, 'metal', [0, y + 0.64, r], [0.09, 0.13, 0.09], pale, 24, 12);
      }
    }
    molding(out, 30.78, 1.81, 0.2);
    openStage(out, 30.98, 34.12, 0.41, 35.06, 1.52, 0.63);
    loft(
      out,
      'metal',
      [
        [35.3, 1.67],
        [35.52, 1.58],
        [35.9, 1.12],
        [36.32, 0.69],
        [36.72, 0.46],
        [37.13, 0.45],
        [37.73, 0.55],
        [38.2, 0.37],
        [38.6, 0.095],
      ].map(([y, r]) => octagon(y, r)),
      pale,
    );
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        points = [];
      for (let j = 0; j <= scrollSteps * 2; j++) {
        const t = j / (scrollSteps * 2),
          r = 0.12 + 0.48 * Math.sin(Math.PI * t);
        points.push([Math.cos(a) * r, 36.75 + t * 1.5, Math.sin(a) * r]);
      }
      if (mode !== 'district') curvedStrip(out, points, 0.025);
    }
    tube(out, 'metal', [0, 38.48, 0], [0, 42.05, 0], 0.032, dark, 16);
    sphere(out, 'metal', [0, 40.17, 0], [0.37, 0.37, 0.37], gold, 48, 24);
    tube(out, 'metal', [-0.89, 41.12, 0], [0.89, 41.12, 0], 0.026, dark, 12);
    tube(out, 'metal', [0, 41.12, -0.55], [0, 41.12, 0.55], 0.023, dark, 12);
    // Two exposed striking bells, with independent yokes and clappers.
    bell(out, -0.52, 25.9, 0, 0.48);
    bell(out, 0.43, 32.3, 0, 0.3);
    beam(out, 'wood', [-1.8, 26.93, 0], [1.8, 26.93, 0], 0.17, 0.2, [0.27, 0.22, 0.15]);
  }

  buildMontelbaanstoren(out);
}
export function buildMontelbaanReviewed(out) {
  detail(out, 'master');
}
export function buildMontelbaanCloseup(out) {
  detail(out, 'closeup');
}
export function buildMontelbaanStreet(out) {
  detail(out, 'street');
}
export function buildMontelbaanDistrict(out) {
  detail(out, 'district');
}
