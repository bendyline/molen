/** 'po_nagar': four specific Po Nagar brick tower forms and unroofed mandapa. */
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, prepareOpening } from './authored-wall-openings.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildPoNagarTemples(face, detail, r, sampleTerrain) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    grade = (x, z) => sampleTerrain(c * x - s * z, s * x + c * z),
    f = (role, ps, n) => {
      if (detail === 0 && n[1] < -0.5) return;
      face(
        role,
        ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      );
    };
  const low = (p) =>
    Math.min(
      ...p.polygon.outline.flatMap((a, i) => {
        const b = p.polygon.outline[(i + 1) % p.polygon.outline.length],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2);
        return Array.from({ length: n + 1 }, (_, k) =>
          grade(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n),
        );
      }),
    ) - 0.6;
  function round(role, x, z, profile, sides = 8) {
    loft(f, role, x, z, profile, false, (w) =>
      Array.from({ length: sides }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / sides) * w) / 2,
        (Math.sin((i * Math.PI * 2) / sides) * w) / 2,
      ]),
    );
  }
  function solid(p, role, lo, hi, holes = []) {
    const cut = openingBuilder(
        { addTriangle: (slot, _ref, ps, n) => f(slot, ps, n) },
        holes.map((h) => prepareOpening(h, 0, detail)),
      ),
      emit = (role, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) {
          const t = [ps[0], ps[i], ps[i + 1]];
          if (Math.hypot(...normalFor(...t)) > 0.5)
            cut.addTriangle(role, 'palette:#ffffff', t, n, [], []);
        }
      };
    prism(emit, role, p, lo, hi);
  }
  function leaf(x, z, y, width, height, depth, role = 'wall') {
    const profile =
        detail === 0
          ? [
              [-0.5, 0],
              [0.5, 0],
              [0, 1],
            ]
          : [
              [-0.5, 0],
              [0.49, 0],
              [0.48, 0.32],
              [0.34, 0.69],
              [0, 1],
              [-0.34, 0.69],
              [-0.48, 0.32],
            ],
      ix = earcut(profile.flat()),
      front = profile.map(([u, v]) => [x + depth / 2, y + v * height, z + u * width]),
      back = front.map((p) => [p[0] - depth, p[1], p[2]]);
    for (let i = 0; i < ix.length; i += 3) {
      f(
        role,
        ix.slice(i, i + 3).map((k) => front[k]),
        [1, 0, 0],
      );
      f(
        role,
        ix.slice(i, i + 3).map((k) => back[k]),
        [-1, 0, 0],
      );
    }
    for (let i = 0; i < front.length; i++) {
      const j = (i + 1) % front.length;
      f(
        role,
        [front[i], front[j], back[j], back[i]],
        [0, front[j][2] - front[i][2], front[i][1] - front[j][1]],
      );
    }
  }
  function miniature(x, z, y, w, h) {
    loft(
      f,
      'trim',
      x,
      z,
      [
        [y, w],
        [y + 0.1 * h, w * 1.15],
        [y + 0.25 * h, w * 0.78],
        [y + 0.65 * h, w * 0.72],
        [y + 0.72 * h, w * 0.88],
        [y + h, w * 0.15],
      ],
      false,
    );
    if (detail >= 2) leaf(x + w * 0.4, z, y + 0.3 * h, w * 0.55, h * 0.6, w * 0.18);
  }
  function saddle(x, z, y, w, d, rise, endUp) {
    const nx = detail === 0 ? 2 : 4,
      nz = detail === 0 ? 4 : 8,
      at = (i, j) => {
        const u = (i / nx) * 2 - 1,
          v = (j / nz) * 2 - 1;
        return [
          x + (u * w) / 2,
          y + Math.sqrt(Math.max(0, 1 - v * v)) * rise + Math.pow(Math.abs(u), 4) * endUp,
          z + (v * d) / 2,
        ];
      };
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < nz; j++)
        f('wall', [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)], [0, 1, 0]);
    for (const i of [0, nx]) {
      const ring = Array.from({ length: nz + 1 }, (_, j) => at(i, j));
      f(
        'trim',
        [...ring, [ring.at(-1)[0], y - 0.25, ring.at(-1)[2]], [ring[0][0], y - 0.25, ring[0][2]]],
        [i === 0 ? -1 : 1, 0, 0],
      );
    }
    if (detail > 0)
      for (const i of [0, nx])
        for (let j = 0; j < nz; j++) {
          const A = at(i, j),
            B = at(i, j + 1);
          f(
            'trim',
            [
              A,
              B,
              [B[0] + (i === 0 ? -0.13 : 0.13), B[1] + 0.16, B[2]],
              [A[0] + (i === 0 ? -0.13 : 0.13), A[1] + 0.16, A[2]],
            ],
            [0, 1, 0],
          );
        }
  }
  for (const p of r.towers) {
    const F = p.floorY,
      [x0, , x1] = p.bounds,
      z = p.center[1],
      depth = p.depth,
      coreW = Math.min(p.width * 0.83, depth),
      cx = x0 + coreW / 2,
      body = {
        outline: rect(cx, z, coreW, depth).outline,
        holes: [rect(cx, z, coreW - 0.9, depth - 0.9).outline],
      },
      front = x1,
      porchDepth = x1 - (x0 + coreW) + 0.55,
      porchW = Math.min(depth * 0.52, p.kind === 'main' ? 5.4 : 3.0),
      doorW = p.kind === 'main' ? 2.1 : p.kind === 'south' ? 1.55 : 1.1,
      doorH = p.kind === 'main' ? 3.7 : p.kind === 'south' ? 2.75 : 2.15,
      porchH = p.kind === 'main' ? 5.2 : p.kind === 'south' ? 4.5 : 3.4,
      hole = {
        center: [front - porchDepth / 2, z],
        axis: [0, -1],
        depth: porchDepth + 2,
        shape: 'rect',
        width: doorW,
        bottom: F + 0.14,
        height: doorH,
      };
    prism(f, 'wall', p.polygon, low(p), F + 0.12);
    solid(
      detail <= 1 ? rect(cx, z, coreW, depth) : body,
      'wall',
      F + 0.12,
      F + p.wallHeight,
      detail <= 1 ? [] : [hole],
    );
    if (detail === 0) {
      const side = (porchW - doorW) / 2;
      for (const sign of [-1, 1])
        box(
          f,
          'wall',
          front - porchDepth / 2,
          F + 0.12,
          z + sign * (doorW / 2 + side / 2),
          porchDepth,
          porchH,
          side,
        );
      box(
        f,
        'wall',
        front - porchDepth / 2,
        F + 0.12 + doorH,
        z,
        porchDepth,
        porchH - doorH,
        doorW,
      );
    } else
      solid(rect(front - porchDepth / 2, z, porchDepth, porchW), 'wall', F + 0.12, F + porchH, [
        hole,
      ]);
    box(
      f,
      'inset',
      detail <= 1 ? x0 + coreW + 0.025 : front - porchDepth - 0.65,
      F + 0.15,
      z,
      0.06,
      doorH,
      doorW * 0.98,
    );
    for (const sign of [-1, 1])
      box(
        f,
        'stone',
        front + 0.05,
        F + 0.12,
        z + sign * (doorW / 2 + 0.18),
        0.45,
        doorH + 0.15,
        0.36,
      );
    box(f, 'stone', front + 0.05, F + doorH + 0.12, z, 0.55, 0.45, doorW + 0.72);
    leaf(front - porchDepth * 0.48, z, F + porchH, porchW, porchH * 0.46, porchDepth * 0.98);
    if (detail > 0) {
      for (let k = 0; k < (detail === 1 ? 1 : 3); k++)
        leaf(
          front + 0.12 + k * 0.035,
          z,
          F + doorH + 0.55 + k * 0.1,
          doorW + 0.9 + k * 0.42,
          porchH * 0.45,
          0.11,
          'trim',
        );
      for (const y of [0.4, 0.7, p.wallHeight - 0.4, p.wallHeight - 0.05]) {
        box(f, 'trim', cx, F + y, z, coreW + 0.25, 0.13, depth + 0.25);
      }
      // Brick pilasters and three blind side doors distinguish the tall plain wall mass.
      const count = detail === 1 ? 2 : p.kind === 'main' ? 5 : 3;
      for (const sign of [-1, 1])
        for (let k = 0; k < count; k++) {
          const x = x0 + 0.45 + (k * (coreW - 0.9)) / (count - 1);
          box(
            f,
            'trim',
            x,
            F + 0.8,
            z + sign * (depth / 2 + 0.035),
            0.22,
            p.wallHeight - 1.1,
            0.18,
          );
          const zz = z - depth / 2 + 0.45 + (k * (depth - 0.9)) / (count - 1);
          box(
            f,
            'trim',
            cx + sign * (coreW / 2 + 0.035),
            F + 0.8,
            zz,
            0.18,
            p.wallHeight - 1.1,
            0.22,
          );
        }
      for (const side of detail >= 2 ? [-1, 1] : []) {
        const q = (role, ps, n) =>
          f(
            role,
            ps.map(([u, v, w]) => [cx + w * side, v, z + u]),
            [n[2] * side, n[1], n[0]],
          );
        const y = F + 1.05;
        box(q, 'wall', 0, y, coreW / 2, 0.5 * depth, p.wallHeight * 0.58, 0.38);
      }
    }
    if (p.kind === 'main') {
      const profiles =
        detail <= 1
          ? [
              [11.2, coreW + 1],
              [11.65, coreW + 1],
              [12.4, coreW * 0.9],
              [14.3, coreW * 0.96],
              [14.6, coreW * 0.79],
              [16.9, coreW * 0.73],
              [17.2, coreW * 0.58],
              [19.3, coreW * 0.56],
              [19.6, coreW * 0.42],
              [21.8, coreW * 0.36],
              [22.3, 2.8],
              [22.7, 0.2],
            ]
          : [
              [11.2, coreW + 0.6],
              [11.55, coreW + 1],
              [12.0, coreW + 0.5],
              [12.4, coreW * 0.9],
              [14, coreW * 0.9],
              [14.3, coreW * 0.96],
              [14.6, coreW * 0.79],
              [16.6, coreW * 0.68],
              [16.9, coreW * 0.73],
              [17.2, coreW * 0.58],
              [19.0, coreW * 0.51],
              [19.3, coreW * 0.56],
              [19.6, coreW * 0.42],
              [21.5, coreW * 0.31],
              [21.8, coreW * 0.36],
              [22.3, 2.8],
              [22.7, 0.2],
            ];
      loft(
        f,
        'wall',
        cx,
        z,
        profiles.map(([y, w]) => [F + y, w]),
        false,
      );
      if (detail > 0)
        for (let tier = 0; tier < (detail === 1 ? 1 : 4); tier++) {
          const y = F + [11.65, 14.45, 17.05, 19.45][tier],
            w = coreW * [0.98, 0.78, 0.6, 0.43][tier],
            size = [1.8, 1.45, 1.1, 0.85][tier];
          for (const i of [-1, 1])
            for (const j of [-1, 1])
              miniature(
                cx + i * (w / 2 - size * 0.08),
                z + j * (w / 2 - size * 0.08),
                y,
                size,
                size * 1.55,
              );
          if (detail >= 2)
            for (const sign of [-1, 1]) {
              leaf(cx + w / 2 + 0.02, z, y + 0.35, size * 1.35, size * 1.6, 0.28);
              const rotated = (role, ps, n) =>
                f(
                  role,
                  ps.map(([u, v, w]) => [cx + u, v, z + sign * w]),
                  [n[0], n[1], n[2] * sign],
                );
              box(rotated, 'trim', 0, y + 0.3, w / 2, 0.7 * size, size * 0.9, 0.2);
            }
        }
      if (detail >= 2) {
        // Original shallow bilateral figure/leaf motif in the stone tympanum; no copied deity relief.
        leaf(front + 0.3, z, F + doorH + 0.8, doorW + 0.3, 1.7, 0.12, 'stone');
        round(
          'stone',
          front + 0.42,
          z,
          [
            [F + doorH + 1.03, 0.65],
            [F + doorH + 1.8, 0.36],
            [F + doorH + 2.12, 0.2],
          ],
          6,
        );
        for (const sign of [-1, 1])
          box(f, 'stone', front + 0.52, F + doorH + 1.15, z + sign * 0.37, 0.13, 0.25, 0.64);
      }
    } else if (p.kind === 'south') {
      loft(
        f,
        'wall',
        cx,
        z,
        [
          [F + 6, coreW + 0.5],
          [F + 6.3, coreW + 0.8],
          [F + 6.5, coreW + 0.3],
          [F + 13.8, 0.8],
          [F + 14.4, 0.36],
        ],
        false,
      );
      round(
        'stone',
        cx,
        z,
        [
          [F + 14.4, 0.6],
          [F + 14.65, 0.6],
          [F + 15, 0.1],
        ],
        detail === 0 ? 4 : 8,
      );
    } else if (p.kind === 'northwest') {
      loft(
        f,
        'wall',
        cx,
        z,
        [
          [F + 4.5, coreW + 0.5],
          [F + 4.8, coreW + 0.7],
          [F + 5.2, coreW + 0.2],
          [F + 5.7, coreW * 0.8],
        ],
        false,
      );
      if (detail >= 2)
        for (const i of [-1, 1])
          for (const j of [-1, 1])
            miniature(cx + i * coreW * 0.42, z + j * depth * 0.42, F + 5.05, 0.8, 1.6);
      box(f, 'wall', cx, F + 5.7, z, coreW * 0.82, 1.9, depth * 0.78);
      if (detail > 0)
        for (const y of [6.05, 6.6, 7.3])
          box(f, 'trim', cx, F + y, z, coreW * 0.89, 0.16, depth * 0.85);
      saddle(cx, z, F + 7.6, coreW * 0.95, depth * 0.84, 1.65, 0.65);
    } else {
      loft(
        f,
        'wall',
        cx,
        z,
        [
          [F + 4.1, coreW + 0.3],
          [F + 4.45, coreW + 0.6],
          [F + 4.7, coreW + 0.1],
          [F + 5.3, coreW * 0.85],
        ],
        false,
        (w) => rect(0, 0, w, depth * 0.94).outline,
      );
      box(f, 'wall', cx, F + 5.3, z, coreW * 0.85, 0.65, depth * 0.94);
      saddle(cx, z, F + 5.95, coreW * 0.98, depth * 0.98, 1.25, 0.5);
    }
    const count = detail === 0 ? 1 : detail === 1 ? 2 : 4;
    for (let k = 0; k < count; k++) {
      const x = front + 0.25 + k * 0.4,
        top = F + 0.15 - k * 0.12,
        bottom = Math.min(top - 0.15, grade(x, z) - 0.25);
      box(f, 'wall', x, bottom, z, 0.42, top - bottom, doorW + 1.1);
    }
  }
  // Lower mandapa retains open sky and all20 picture-led surviving pillar stations.
  const m = r.mandapa,
    M = m.floorY;
  prism(f, 'wall', m.polygon, low(m), M + 0.14);
  for (let j = 0; j < 4; j++)
    for (let i = 0; i < m.pillarColumns; i++) {
      const x = m.bounds[0] + 1.6 + (i * (m.width - 3.2)) / (m.pillarColumns - 1),
        z = m.center[1] + m.pillarRows[j],
        inner = j === 1 || j === 2,
        h = inner ? m.innerHeight : m.outerHeight,
        w = inner ? 1.55 : 0.9,
        profile =
          detail === 0
            ? [
                [M + 0.14, w],
                [M + h, w * 0.9],
              ]
            : detail === 1
              ? [
                  [M + 0.14, w],
                  [M + h - 0.27, w * 0.9],
                  [M + h, w * 1.3],
                ]
              : [
                  [M + 0.14, w * 1.2],
                  [M + 0.4, w * 1.25],
                  [M + 0.6, w],
                  [M + h - 0.35, w * 0.85],
                  [M + h - 0.27, w * 1.3],
                  [M + h, w * 1.3],
                ];
      round('wall', x, z, profile, detail === 0 ? 4 : detail === 1 ? 6 : detail === 2 ? 8 : 10);
    }
  // A narrow native-grade approach preserves the coarse terrain rather than inventing a level hill slab.
  const main = r.towers[0],
    start = [main.bounds[2] + 0.3, main.center[1]],
    end = [m.bounds[0] - 0.5, m.center[1]],
    n = detail === 0 ? 2 : 24;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n,
      x = start[0] + (end[0] - start[0]) * t,
      z = start[1] + (end[1] - start[1]) * t,
      linear = main.floorY * (1 - t) + M * t + 0.13,
      top = Math.max(grade(x, z) + 0.08, linear),
      bottom = Math.min(top - 0.15, grade(x, z) - 0.3),
      length = (end[0] - start[0]) / n + 0.02;
    box(f, 'wall', x, bottom, z, length, top - bottom, 2.25);
    if (detail > 0)
      for (const sign of [-1, 1])
        box(f, 'wall', x, bottom, z + sign * 1.4, length, top - bottom + 0.65, 0.42);
  }
}
