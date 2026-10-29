/** Source-local browser derivatives; original detailed Yser master is preserved. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  radialRing as fullRadialRing,
  sphere as fullSphere,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { yserTower } from '../../../../../../../../packages/worldgen/scripts/yser-tower-model.mjs';

const map = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
function components(tier) {
  const radialRing = (y, rx, rz, n, ...args) => fullRadialRing(y, rx, rz, Math.min(n, 8), ...args);
  const sphere = (out, slot, c, r, color, sides, rows) =>
    fullSphere(out, slot, c, r, color, Math.min(sides, 8), Math.min(rows, 3));
  const brick = [0.53, 0.405, 0.335],
    coping = [0.47, 0.49, 0.48],
    stone = [0.4, 0.4, 0.35];
  const glass = [0.19, 0.25, 0.265],
    metal = [0.49, 0.54, 0.53],
    yellow = [0.95, 0.61, 0.075];
  const dark = [0.08, 0.08, 0.075],
    bronze = [0.33, 0.285, 0.18];
  const tau = Math.PI * 2;
  // Digitised proportions of the measured twelfth-floor plan, management plan p.33.
  const shaft = [
    [286, 259],
    [343, 313],
    [526, 313],
    [581, 259],
    [685, 360],
    [626, 422],
    [711, 506],
    [626, 591],
    [685, 650],
    [581, 752],
    [526, 697],
    [343, 697],
    [286, 752],
    [185, 650],
    [244, 591],
    [159, 506],
    [244, 422],
    [184, 360],
  ].map(([x, z]) => [(x - 435) * 0.028, (z - 506) * 0.028]);
  function cap(out, slot, ring, y, color) {
    const temp = new MeshBufferBuilder();
    if (
      !temp.addCap(
        'roof',
        'palette:#ffffff',
        ring,
        [],
        () => y,
        [0, 1, 0],
        (p) => p,
        color,
      )
    )
      throw Error('Invalid Yser roof outline');
    const mesh = temp.finalize();
    for (let i = 0; i < mesh.indices.length; i += 3) {
      const p = Array.from(mesh.indices.slice(i, i + 3), (j) =>
        Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
      );
      triangle(out, slot, p, color);
    }
  }
  function solid(out, slot, ring, y0, y1, color) {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      face(
        out,
        slot,
        [
          [a[0], y0, a[1]],
          [a[0], y1, a[1]],
          [b[0], y1, b[1]],
          [b[0], y0, b[1]],
        ],
        color,
      );
    }
    cap(out, slot, ring, y1, color);
  }
  function panel(out, slot, a, b, y0, y1, holes = [], color = brick, scale = () => 1) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (b[1] - a[1]) / length,
      nz = -(b[0] - a[0]) / length;
    const point = (t, y, depth = 0) => [
      (a[0] + (b[0] - a[0]) * t) * scale(y) + nx * depth,
      y,
      (a[1] + (b[1] - a[1]) * t) * scale(y) + nz * depth,
    ];
    if (tier === 'district')
      face(out, slot, [point(0, y0), point(0, y1), point(1, y1), point(1, y0)], color);
    else {
      const xs = [...new Set([0, 1, ...holes.flatMap((h) => [h.t0, h.t1])])].sort((a, b) => a - b),
        ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++)
        for (let j = 1; j < ys.length; j++) {
          const l = xs[i - 1],
            r = xs[i],
            lo = ys[j - 1],
            hi = ys[j];
          if (
            holes.some(
              (h) =>
                (l + r) / 2 > h.t0 &&
                (l + r) / 2 < h.t1 &&
                (lo + hi) / 2 > h.y0 &&
                (lo + hi) / 2 < h.y1,
            )
          )
            continue;
          face(out, slot, [point(l, lo), point(l, hi), point(r, hi), point(r, lo)], color);
        }
    }
    for (const h of holes) {
      const d = tier === 'district' ? 0.02 : (h.depth ?? -0.24),
        p = [point(h.t0, h.y0), point(h.t0, h.y1), point(h.t1, h.y1), point(h.t1, h.y0)],
        q = [
          point(h.t0, h.y0, d),
          point(h.t0, h.y1, d),
          point(h.t1, h.y1, d),
          point(h.t1, h.y0, d),
        ];
      if (tier !== 'district')
        for (let i = 0; i < 4; i++)
          face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
      face(out, h.opaque ? 'metal' : 'glass', q, h.opaque ? metal : glass);
      if (tier === 'district' && h.y1 < 65) continue;
      const cols = tier === 'district' ? Math.min(h.cols ?? 1, 4) : (h.cols ?? 1),
        rows = tier === 'district' ? 1 : (h.rows ?? 1),
        dt = 0.0275 / length,
        z = d + 0.055;
      for (let i = 0; i <= cols; i++) {
        const t = h.t0 + ((h.t1 - h.t0) * i) / cols;
        face(
          out,
          'metal',
          [
            point(t - dt, h.y0, z),
            point(t - dt, h.y1, z),
            point(t + dt, h.y1, z),
            point(t + dt, h.y0, z),
          ],
          metal,
        );
      }
      for (let i = 0; i <= rows; i++) {
        const y = h.y0 + ((h.y1 - h.y0) * i) / rows;
        face(
          out,
          'metal',
          [
            point(h.t0, y - 0.0275, z),
            point(h.t0, y + 0.0275, z),
            point(h.t1, y + 0.0275, z),
            point(h.t1, y - 0.0275, z),
          ],
          metal,
        );
      }
    }
  }
  function railing(out, a, b, y) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      count = tier === 'district' ? 1 : Math.ceil(length / 2.4);
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(out, 'metal', [x, y, z], [x, y + 0.85, z], 0.045, 0.045, metal);
    }
    for (const h of tier === 'district' ? [0.85] : [0.4, 0.85])
      beam(out, 'metal', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.045, 0.045, metal);
  }
  function terrace(out, ring, y, slot = 'brick') {
    cap(out, 'concrete', ring, y, [0.52, 0.54, 0.54]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      beam(
        out,
        slot,
        [a[0], y + 0.35, a[1]],
        [b[0], y + 0.35, b[1]],
        0.45,
        0.7,
        slot === 'brick' ? brick : stone,
      );
      beam(
        out,
        'limestone_raw',
        [a[0], y + 0.73, a[1]],
        [b[0], y + 0.73, b[1]],
        0.49,
        0.08,
        coping,
      );
    }
  }
  const glyphs = {
    A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
    D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
    E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
    G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
    I: ['111', '010', '010', '010', '010', '010', '111'],
    J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
    K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
    L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
    M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
    N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
    O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
    P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
    R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
    T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
    U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
    W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  };
  function inscription(out, text) {
    if (tier === 'district') return;
    const columns = [...text].reduce((n, c) => n + (c === ' ' ? 3 : glyphs[c][0].length + 1), 0),
      unit = Math.min(0.045, 6.5 / columns);
    let x = (-columns * unit) / 2;
    for (const c of text) {
      if (c === ' ') {
        x += unit * 3;
        continue;
      }
      const g = glyphs[c];
      for (let row = 0; row < 7; row++)
        for (let col = 0; col < g[row].length; col++)
          if (g[row][col] === '1')
            face(
              out,
              'metal',
              [
                [x + col * unit, 8.75 + (6 - row) * unit, 3.75],
                [x + (col + 1) * unit, 8.75 + (6 - row) * unit, 3.75],
                [x + (col + 1) * unit, 8.75 + (7 - row) * unit, 3.75],
                [x + col * unit, 8.75 + (7 - row) * unit, 3.75],
              ],
              [0.9, 0.9, 0.84],
            );
      x += (g[0].length + 1) * unit;
    }
  }
  function base(out) {
    const ring = map.geometry.outline;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        holes = [];
      if (len > 8)
        for (const t of [0.2, 0.5, 0.8])
          holes.push({ t0: t - 0.027, t1: t + 0.027, y0: 2.1, y1: 3.65 });
      if (i === 6) holes.push({ t0: 0.03, t1: 0.97, y0: 0.05, y1: 2.65, cols: 2 });
      panel(out, 'yser_stone', a, b, 0, 4.8, holes, stone);
      // The irregular Ourthe stone facade is an original small-course relief, not a photo map.
      const nx = (b[1] - a[1]) / len,
        nz = -(b[0] - a[0]) / len;
      for (let row = 0; row < (tier === 'district' ? 0 : 12); row += 3)
        for (let col = 0; col < Math.ceil(len / 0.62); col++) {
          const t0 = Math.max(0, (col * 0.62 + (row % 2) * 0.31) / len),
            t1 = Math.min(1, t0 + 0.595 / len),
            lo = 0.035 + row * 0.393,
            hi = lo + 0.365;
          if (
            t1 - t0 < 0.002 ||
            holes.some((h) => t1 > h.t0 && t0 < h.t1 && hi > h.y0 && lo < h.y1)
          )
            continue;
          const p = (t, y) => [
            a[0] + (b[0] - a[0]) * t + nx * 0.015,
            y,
            a[1] + (b[1] - a[1]) * t + nz * 0.015,
          ];
          const shade =
            0.93 +
            (((Math.imul(row + 13, 73856093) ^ Math.imul(col + 43, 19349663)) >>> 0) % 101) / 720;
          face(
            out,
            'yser_stone',
            [p(t0, lo), p(t0, hi), p(t1, hi), p(t1, lo)],
            stone.map((v) => v * shade),
          );
        }
      if (len > 4) railing(out, a, b, 4.85);
    }
    cap(out, 'concrete', ring, 4.8, [0.6, 0.61, 0.59]);
    // Four diagonal stepped corner pavilions and their actual open roof terraces.
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const o = transform(out, Math.PI / 4, [sx * 8.5, 0, sz * 8.5]);
        box(o, 'brick', [-3.7, 4.8, -3.7], [3.7, 10.1, 3.7], brick);
        terrace(
          o,
          [
            [-3.6, -3.6],
            [3.6, -3.6],
            [3.6, 3.6],
            [-3.6, 3.6],
          ],
          10.1,
        );
        const q = transform(out, Math.PI / 4, [sx * 6.5, 0, sz * 6.5]);
        box(q, 'brick', [-2.6, 10.1, -2.6], [2.6, 13.2, 2.6], brick);
        terrace(
          q,
          [
            [-2.52, -2.52],
            [2.52, -2.52],
            [2.52, 2.52],
            [-2.52, 2.52],
          ],
          13.2,
        );
        for (let side = 0; side < 4; side++) {
          const v = transform(o, (side * Math.PI) / 2);
          for (let r = 0; r < (tier === 'district' ? 0 : 4); r++)
            for (let c = 0; c < 6; c++)
              face(
                v,
                'yser_stone',
                [
                  [-3.15 + c * 1.25, 5.4 + r * 0.98, 3.724],
                  [-2.92 + c * 1.25, 5.4 + r * 0.98, 3.724],
                  [-2.92 + c * 1.25, 5.63 + r * 0.98, 3.724],
                  [-3.15 + c * 1.25, 5.63 + r * 0.98, 3.724],
                ],
                [0.23, 0.25, 0.235],
              );
        }
      }
    for (const [sx, sz, text] of [
      [-1, 1, 'NO MORE WAR'],
      [1, 1, 'PLUS JAMAIS DE GUERRE'],
      [1, -1, 'NIE WIEDER KRIEG'],
      [-1, -1, 'NOOIT MEER OORLOG'],
    ])
      inscription(transform(out, Math.atan2(sx, sz), [sx * 8.5, 0, sz * 8.5]), text);
    // White entrance: sliding doors between two externally accessible stair flights.
    box(out, 'concrete', [-2.9, 0, 17.5], [-1.65, 4.8, 19.45], [0.77, 0.76, 0.71]);
    box(out, 'concrete', [1.65, 0, 17.5], [2.9, 4.8, 19.45], [0.77, 0.76, 0.71]);
    box(out, 'concrete', [-1.65, 2.7, 17.5], [1.65, 4.8, 19.45], [0.77, 0.76, 0.71]);
    panel(
      out,
      'concrete',
      [1.65, 19.45],
      [-1.65, 19.45],
      0.03,
      2.7,
      [{ t0: 0.015, t1: 0.985, y0: 0.08, y1: 2.62, cols: 2 }],
      coping,
    );
    for (const s of [-1, 1]) {
      const o = s === 1 ? out : transform(out, 0, [0, 0, 0]);
      const count = 28;
      for (let j = 0; j < count; j += tier === 'district' ? 4 : 1) {
        const xa = 3 + j * 0.37,
          xb = xa + 0.37 * (tier === 'district' ? 4 : 1),
          y = 4.8 * (1 - j / count);
        box(
          o,
          'concrete',
          [s === 1 ? xa : -xb, 0, 17.6],
          [s === 1 ? xb : -xa, y, 19.35],
          j % 2 ? [0.66, 0.66, 0.63] : [0.76, 0.76, 0.72],
        );
      }
      beam(
        out,
        'concrete',
        [s * 3, 5.05, 19.45],
        [s * 13.36, 0.45, 19.45],
        0.36,
        0.7,
        [0.75, 0.74, 0.7],
      );
      for (let j = 0; j < 29; j += tier === 'district' ? 7 : 2) {
        const x = 3 + j * 0.37,
          y = 4.8 * (1 - j / 28);
        beam(out, 'metal', [s * x, y + 0.32, 19.35], [s * x, y + 1, 19.35], 0.04, 0.04, metal);
      }
      beam(out, 'metal', [s * 3, 5.8, 19.35], [s * 13.36, 1, 19.35], 0.05, 0.05, metal);
    }
    box(out, 'yser_stone', [-0.58, 4.8, 19.46], [0.58, 5.1, 19.55], stone);
    box(out, 'yser_stone', [-0.22, 5.1, 19.46], [0.22, 6.65, 19.55], stone);
    box(out, 'yser_stone', [-0.59, 6.02, 19.46], [0.59, 6.36, 19.55], stone);
  }
  function trunk(out) {
    const scale = (y) => 1.16 - ((y - 13.2) / 53.6) * 0.26;
    for (let i = 0; i < shaft.length; i++) {
      const a = shaft[i],
        b = shaft[(i + 1) % shaft.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        holes = [];
      if ([1, 5, 6, 10, 14, 15].includes(i))
        for (let j = 0; j < 18; j++) {
          const y = 14.6 + j * 2.85;
          holes.push({
            t0: 0.5 - 0.18 / len,
            t1: 0.5 + 0.18 / len,
            y0: y,
            y1: y + 0.9,
            depth: -0.32,
          });
        }
      panel(out, 'brick', a, b, 13.2, 66.8, holes, brick, scale);
    }
    cap(
      out,
      'brick',
      shaft.map(([x, z]) => [x * 0.9, z * 0.9]),
      66.8,
      brick,
    );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const x = sx * 4.2,
          z = sz * 4.35;
        const ring = [
          [x - 1.1, z - 1.2],
          [x + 1.1, z - 1.2],
          [x + 1.1, z + 1.2],
          [x - 1.1, z + 1.2],
        ];
        solid(out, 'brick', ring, 58.5, 60.0, brick);
        terrace(out, ring, 60.0);
        // Short projecting piers and limestone returns below the four balcony corners.
        box(out, 'limestone_raw', [x - 0.2, 56.5, z - 0.2], [x + 0.2, 60.1, z + 0.2], coping);
      }
    const frontZ = shaft[10][1] * scale(64);
    box(out, 'shadow', [-0.38, 63.1, frontZ + 0.015], [0.38, 65.6, frontZ + 0.055], dark);
    for (let i = 0; i < 11; i++)
      box(
        out,
        'concrete',
        [-0.43, 63.1 + i * 0.23, frontZ + 0.06],
        [0.43, 63.17 + i * 0.23, frontZ + 0.19],
        [0.78, 0.77, 0.71],
      );
  }
  function letter(out, ch, cx, cy, z, size = 2.5) {
    const glyph = {
      A: [
        [
          [0, 0],
          [0.5, 1],
        ],
        [
          [0.5, 1],
          [1, 0],
        ],
        [
          [0.23, 0.4],
          [0.77, 0.4],
        ],
      ],
      V: [
        [
          [0, 1],
          [0.5, 0],
        ],
        [
          [0.5, 0],
          [1, 1],
        ],
      ],
      K: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [0, 0.48],
          [1, 1],
        ],
        [
          [0.25, 0.6],
          [1, 0],
        ],
      ],
    }[ch];
    for (const [a, b] of glyph) {
      // The stroke width belongs in the facade plane, including diagonal letters.
      const ax = cx + (a[0] - 0.5) * size,
        ay = cy + a[1] * size,
        bx = cx + (b[0] - 0.5) * size,
        by = cy + b[1] * size,
        length = Math.hypot(bx - ax, by - ay),
        dx = (-(by - ay) / length) * 0.125,
        dy = ((bx - ax) / length) * 0.125;
      const ring = [
        [ax - dx, ay - dy],
        [bx - dx, by - dy],
        [bx + dx, by + dy],
        [ax + dx, ay + dy],
      ];
      face(
        out,
        'metal',
        ring.map(([x, y]) => [x, y, z + 0.0325]),
        yellow,
      );
      face(
        out,
        'metal',
        [...ring].reverse().map(([x, y]) => [x, y, z - 0.0325]),
        yellow,
      );
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i],
          q = ring[(i + 1) % ring.length];
        face(
          out,
          'metal',
          [
            [p[0], p[1], z - 0.0325],
            [q[0], q[1], z - 0.0325],
            [q[0], q[1], z + 0.0325],
            [p[0], p[1], z + 0.0325],
          ],
          yellow,
        );
      }
    }
  }
  function crown(out) {
    // Front/back cross-shaped masonry shells with recessed glazing; neither arm is a floating box.
    const cross = [
      [-3.25, 66.8],
      [3.25, 66.8],
      [3.25, 69.5],
      [7.5, 69.5],
      [7.5, 80.2],
      [3.25, 80.2],
      [3.25, 84],
      [-3.25, 84],
      [-3.25, 80.2],
      [-7.5, 80.2],
      [-7.5, 69.5],
      [-3.25, 69.5],
    ];
    const windows = [
      { x0: -2.3, x1: 2.3, y0: 68.7, y1: 72.35, cols: 4, rows: 2 },
      { x0: -6.25, x1: 6.25, y0: 72.5, y1: 77.15, cols: 12, rows: 2 },
      { x0: -2.3, x1: 2.3, y0: 77.3, y1: 81.2, cols: 4, rows: 2 },
    ];
    for (const sign of [-1, 1]) {
      const o = transform(out, sign === 1 ? 0 : Math.PI);
      for (const [x0, x1, y0, y1] of [
        [-3.25, 3.25, 66.8, 69.5],
        [-7.5, 7.5, 69.5, 80.2],
        [-3.25, 3.25, 80.2, 84],
      ]) {
        const holes = windows
          .filter((h) => h.y1 > y0 && h.y0 < y1)
          .map((h) => ({
            t0: (x1 - h.x1) / (x1 - x0),
            t1: (x1 - h.x0) / (x1 - x0),
            y0: Math.max(y0, h.y0),
            y1: Math.min(y1, h.y1),
            cols: h.cols,
            rows: h.rows,
          }));
        panel(o, 'brick', [x1, 4.5], [x0, 4.5], y0, y1, holes, brick);
      }
      letter(o, 'A', 0, 78.0, 4.62);
      letter(o, 'V', -4.15, 73.45, 4.62);
      letter(o, 'V', 0, 73.45, 4.62);
      letter(o, 'K', 4.15, 73.45, 4.62);
      letter(o, 'V', 0, 69.25, 4.62);
    }
    for (let i = 0; i < cross.length; i++) {
      const a = cross[i],
        b = cross[(i + 1) % cross.length];
      if (a[0] === b[0] && Math.abs(a[0]) === 7.5) {
        const s = Math.sign(a[0]),
          o = transform(out, (s * Math.PI) / 2);
        panel(
          o,
          'brick',
          [4.5, 7.5],
          [-4.5, 7.5],
          69.5,
          80.2,
          [{ t0: 0.15, t1: 0.85, y0: 72.5, y1: 77.15, cols: 8, rows: 4 }],
          brick,
        );
      } else if (!(a[1] === b[1] && (a[1] === 84 || a[1] === 80.2)))
        face(
          out,
          'brick',
          [
            [a[0], a[1], -4.5],
            [b[0], b[1], -4.5],
            [b[0], b[1], 4.5],
            [a[0], a[1], 4.5],
          ],
          brick,
        );
    }
    // Open side terraces above the arms, central higher roof terrace and stair head.
    for (const s of [-1, 1]) {
      const lo = s < 0 ? -7.45 : 3.25,
        hi = s < 0 ? -3.25 : 7.45;
      terrace(
        out,
        [
          [lo, -4.45],
          [hi, -4.45],
          [hi, 4.45],
          [lo, 4.45],
        ],
        79.43,
      );
      for (const z of [-2.1, 2.1])
        box(
          out,
          'metal',
          [s < 0 ? -3.28 : 3.26, 80.2, z - 0.4],
          [s < 0 ? -3.26 : 3.28, 82.25, z + 0.4],
          metal,
        );
    }
    terrace(
      out,
      [
        [-3.2, -4.45],
        [3.2, -4.45],
        [3.2, 4.45],
        [-3.2, 4.45],
      ],
      83.23,
    );
    box(out, 'concrete', [-1.1, 83.24, -1.5], [1.1, 84.15, 1.5], [0.5, 0.52, 0.51]);
    sphere(out, 'glass', [0, 84.15, -0.45], [0.8, 0.25, 0.7], [0.59, 0.64, 0.64], 24, 10);
    beam(out, 'metal', [0.8, 84.15, 0.9], [0.8, 89.8, 0.9], 0.08, 0.08, metal);
    // A small plain flying banner records the variable flag without inventing a heraldic texture.
    const flag = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      flag.push([0.8 + t * 1.9, 88.6 - 0.16 * t, 0.9 + Math.sin(t * tau) * 0.17]);
    }
    for (let i = 1; i < flag.length; i++) {
      const a = flag[i - 1],
        b = flag[i];
      face(out, 'metal', [a, b, [b[0], b[1] - 0.95, b[2]], [a[0], a[1] - 0.95, a[2]]], yellow);
      face(out, 'metal', [[a[0], a[1] - 0.95, a[2]], [b[0], b[1] - 0.95, b[2]], b, a], yellow);
    }
  }
  function carillon(out) {
    const z = 6.6;
    for (const x of [-1.75, 0, 1.75])
      beam(out, 'metal', [x, 14.1, z], [x, 24.1, z], 0.09, 0.09, [0.17, 0.19, 0.17]);
    const counts = [5, 5, 5, 5, 5, 4, 4, 4];
    let id = 0;
    for (let row = 0; row < counts.length; row++) {
      const y = 15 + row * 1.08,
        n = counts[row];
      beam(out, 'metal', [-1.9, y + 0.65, z], [1.9, y + 0.65, z], 0.1, 0.1, [0.17, 0.19, 0.17]);
      for (let col = 0; col < n; col++) {
        const x = (col - (n - 1) / 2) * 0.79,
          r = 0.16 + (0.24 * row) / 7;
        if (tier === 'district') {
          const p = [
            [x - r, y, z + 0.22],
            [x + r, y, z + 0.22],
            [x + r * 0.4, y + 0.55, z + 0.22],
            [x - r * 0.4, y + 0.55, z + 0.22],
          ];
          face(out, 'metal', p, bronze);
          face(out, 'metal', [...p].reverse(), bronze);
        } else
          loft(
            out,
            'metal',
            [
              [y, r],
              [y + 0.07, r * 0.96],
              [y + 0.18, r * 0.75],
              [y + 0.45, r * 0.5],
              [y + 0.55, r * 0.4],
            ].map(([h, r]) => radialRing(h, r, r, 24, [x, z + 0.22])),
            bronze,
            { cap: false },
          );
        if (tier !== 'district')
          beam(out, 'metal', [x, y + 0.55, z + 0.22], [x, y + 0.71, z], 0.05, 0.05, bronze);
        // Tiny clapper tips remain in the close-up master; all37 bell bodies remain at street.
        id++;
      }
    }
    if (id !== 37) throw Error('Yser carillon must contain 37 bells');
  }
  function build(out) {
    base(out);
    trunk(out);
    crown(out);
    carillon(out);
  }

  return { build, base, trunk, crown, carillon, cap, solid, letter, shaft };
}
export const yserStreet = (out) => components('street').build(out);
export const yserDistrict = (out) => components('district').build(out);
export const yserComponents = components;

/** Complete distant landmark; small roof/rail details aggregate without changing the plan. */
export function yserSkyline(out) {
  const target = out;
  out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        target[method](
          slot,
          ref,
          p,
          n,
          uv,
          ['glass', 'shadow'].includes(slot) ? color : color.map((v) => v * 0.65),
        ),
    ]),
  );
  const c = components('district'),
    brick = [0.53, 0.405, 0.335],
    stone = [0.4, 0.4, 0.35],
    coping = [0.47, 0.49, 0.48],
    glass = [0.19, 0.25, 0.265],
    metal = [0.49, 0.54, 0.53],
    yellow = [0.95, 0.61, 0.075];
  function terrace(o, ring, y) {
    c.cap(o, 'concrete', ring, y, [0.52, 0.54, 0.54]);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        p = [
          [a[0], y, a[1]],
          [a[0], y + 0.73, a[1]],
          [b[0], y + 0.73, b[1]],
          [b[0], y, b[1]],
        ];
      face(o, 'brick', p, brick);
      face(o, 'brick', [...p].reverse(), brick);
    }
  }
  c.solid(out, 'yser_stone', map.geometry.outline, 0, 4.8, stone);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const o = transform(out, Math.PI / 4, [sx * 8.5, 0, sz * 8.5]);
      box(o, 'brick', [-3.7, 4.8, -3.7], [3.7, 10.1, 3.7], brick);
      terrace(
        o,
        [
          [-3.6, -3.6],
          [3.6, -3.6],
          [3.6, 3.6],
          [-3.6, 3.6],
        ],
        10.1,
      );
      const q = transform(out, Math.PI / 4, [sx * 6.5, 0, sz * 6.5]);
      box(q, 'brick', [-2.6, 10.1, -2.6], [2.6, 13.2, 2.6], brick);
      terrace(
        q,
        [
          [-2.52, -2.52],
          [2.52, -2.52],
          [2.52, 2.52],
          [-2.52, 2.52],
        ],
        13.2,
      );
    }
  const scale = (y) => 1.16 - ((y - 13.2) / 53.6) * 0.26;
  loft(
    out,
    'brick',
    [
      [...c.shaft].reverse().map(([x, z]) => [x * scale(13.2), 13.2, z * scale(13.2)]),
      [...c.shaft].reverse().map(([x, z]) => [x * 0.9, 66.8, z * 0.9]),
    ],
    brick,
    { cap: false },
  );
  c.cap(
    out,
    'brick',
    c.shaft.map(([x, z]) => [x * 0.9, z * 0.9]),
    66.8,
    brick,
  );
  for (const i of [1, 5, 6, 10, 14, 15]) {
    const a = c.shaft[i],
      b = c.shaft[(i + 1) % c.shaft.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      nx = (b[1] - a[1]) / len,
      nz = -(b[0] - a[0]) / len;
    for (let row = 0; row < 18; row += 3) {
      const y = 14.6 + row * 2.85,
        t0 = 0.5 - 0.18 / len,
        t1 = 0.5 + 0.18 / len,
        p = (t, y) => [
          (a[0] + (b[0] - a[0]) * t) * scale(y) + nx * 0.012,
          y,
          (a[1] + (b[1] - a[1]) * t) * scale(y) + nz * 0.012,
        ];
      face(out, 'glass', [p(t0, y), p(t0, y + 0.9), p(t1, y + 0.9), p(t1, y)], glass);
    }
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 4.2,
        z = sz * 4.35,
        r = [
          [x - 1.1, z - 1.2],
          [x + 1.1, z - 1.2],
          [x + 1.1, z + 1.2],
          [x - 1.1, z + 1.2],
        ];
      c.solid(out, 'brick', r, 58.5, 60, brick);
      terrace(out, r, 60);
      box(out, 'limestone_raw', [x - 0.2, 56.5, z - 0.2], [x + 0.2, 60.1, z + 0.2], coping);
    }
  const cross = [
    [-3.25, 66.8],
    [3.25, 66.8],
    [3.25, 69.5],
    [7.5, 69.5],
    [7.5, 80.2],
    [3.25, 80.2],
    [3.25, 84],
    [-3.25, 84],
    [-3.25, 80.2],
    [-7.5, 80.2],
    [-7.5, 69.5],
    [-3.25, 69.5],
  ];
  for (const sign of [-1, 1]) {
    const f = transform(out, sign === 1 ? 0 : Math.PI);
    for (const [x0, x1, y0, y1] of [
      [-3.25, 3.25, 66.8, 69.5],
      [-7.5, 7.5, 69.5, 80.2],
      [-3.25, 3.25, 80.2, 84],
    ])
      face(
        f,
        'brick',
        [
          [x0, y0, 4.5],
          [x1, y0, 4.5],
          [x1, y1, 4.5],
          [x0, y1, 4.5],
        ],
        brick,
      );
    for (const [x0, x1, y0, y1] of [
      [-2.3, 2.3, 68.7, 72.35],
      [-6.25, 6.25, 72.5, 77.15],
      [-2.3, 2.3, 77.3, 81.2],
    ])
      face(
        f,
        'glass',
        [
          [x0, y0, 4.52],
          [x1, y0, 4.52],
          [x1, y1, 4.52],
          [x0, y1, 4.52],
        ],
        glass,
      );
    // Preserve the actual lettering as flat strokes instead of subpixel extruded side walls.
    const glyph = {
      addQuad: (slot, ref, p, n, uv, color) => {
        if (n[2] > 0.99) f.addQuad(slot, ref, p, n, uv, color);
      },
    };
    c.letter(glyph, 'A', 0, 78, 4.62);
    c.letter(glyph, 'V', -4.15, 73.45, 4.62);
    c.letter(glyph, 'V', 0, 73.45, 4.62);
    c.letter(glyph, 'K', 4.15, 73.45, 4.62);
    c.letter(glyph, 'V', 0, 69.25, 4.62);
  }
  for (let i = 0; i < cross.length; i++) {
    const a = cross[i],
      b = cross[(i + 1) % cross.length];
    if (a[1] === b[1] && (a[1] === 84 || a[1] === 80.2)) continue;
    face(
      out,
      'brick',
      [
        [a[0], a[1], -4.5],
        [b[0], b[1], -4.5],
        [b[0], b[1], 4.5],
        [a[0], a[1], 4.5],
      ],
      brick,
    );
  }
  for (const sign of [-1, 1]) {
    const f = transform(out, (sign * Math.PI) / 2);
    face(
      f,
      'glass',
      [
        [-3.15, 72.5, 7.52],
        [3.15, 72.5, 7.52],
        [3.15, 77.15, 7.52],
        [-3.15, 77.15, 7.52],
      ],
      glass,
    );
    const lo = sign < 0 ? -7.45 : 3.25,
      hi = sign < 0 ? -3.25 : 7.45;
    terrace(
      out,
      [
        [lo, -4.45],
        [hi, -4.45],
        [hi, 4.45],
        [lo, 4.45],
      ],
      79.43,
    );
  }
  terrace(
    out,
    [
      [-3.2, -4.45],
      [3.2, -4.45],
      [3.2, 4.45],
      [-3.2, 4.45],
    ],
    83.23,
  );
  box(out, 'concrete', [-1.1, 83.24, -1.5], [1.1, 84.15, 1.5], [0.5, 0.52, 0.51]);
  box(out, 'metal', [0.76, 84.15, 0.86], [0.84, 89.8, 0.94], metal);
  face(
    out,
    'metal',
    [
      [0.8, 88.6, 0.9],
      [2.7, 88.44, 0.9],
      [2.7, 87.49, 0.9],
      [0.8, 87.65, 0.9],
    ],
    yellow,
  );
  face(
    out,
    'metal',
    [
      [0.8, 87.65, 0.9],
      [2.7, 87.49, 0.9],
      [2.7, 88.44, 0.9],
      [0.8, 88.6, 0.9],
    ],
    yellow,
  );
  for (const x of [-2.9, 1.65])
    box(out, 'concrete', [x, 0, 17.5], [x + 1.25, 4.8, 19.45], [0.77, 0.76, 0.71]);
  box(out, 'concrete', [-1.65, 2.7, 17.5], [1.65, 4.8, 19.45], [0.77, 0.76, 0.71]);
  face(
    out,
    'glass',
    [
      [-1.6, 0.08, 19.46],
      [1.6, 0.08, 19.46],
      [1.6, 2.62, 19.46],
      [-1.6, 2.62, 19.46],
    ],
    glass,
  );
  for (const sign of [-1, 1]) {
    const a = sign * 3,
      b = sign * 13.36;
    for (const z of [17.6, 19.35]) {
      const p = [
        [a, 0, z],
        [b, 0, z],
        [b, 0.17, z],
        [a, 4.8, z],
      ];
      face(out, 'concrete', p, [0.76, 0.76, 0.72]);
      face(out, 'concrete', [...p].reverse(), [0.76, 0.76, 0.72]);
    }
    const tread = [
      [a, 4.8, 17.6],
      [b, 0.17, 17.6],
      [b, 0.17, 19.35],
      [a, 4.8, 19.35],
    ];
    face(out, 'concrete', sign > 0 ? tread.reverse() : tread, [0.76, 0.76, 0.72]);
  }
  // Far carillon retains the full37-bell arrangement as a flat silhouette and rack.
  for (const x of [-1.75, 0, 1.75])
    face(
      out,
      'metal',
      [
        [x - 0.045, 14.1, 6.6],
        [x + 0.045, 14.1, 6.6],
        [x + 0.045, 24.1, 6.6],
        [x - 0.045, 24.1, 6.6],
      ],
      metal,
    );
  for (const [row, count] of [5, 5, 5, 5, 5, 4, 4, 4].entries()) {
    const y = 15 + row * 1.08;
    face(
      out,
      'metal',
      [
        [-1.9, y + 0.6, 6.6],
        [1.9, y + 0.6, 6.6],
        [1.9, y + 0.7, 6.6],
        [-1.9, y + 0.7, 6.6],
      ],
      metal,
    );
    for (let col = 0; col < count; col++) {
      const x = (col - (count - 1) / 2) * 0.79,
        r = 0.16 + (0.24 * row) / 7;
      face(
        out,
        'metal',
        [
          [x - r, y, 6.82],
          [x + r, y, 6.82],
          [x + r * 0.4, y + 0.55, 6.82],
          [x - r * 0.4, y + 0.55, 6.82],
        ],
        [0.33, 0.285, 0.18],
      );
    }
  }
}

/** Preserve detailed near geometry, adding the reverse of its otherwise single-face banner. */
export function yserCloseup(out) {
  const wrapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) => {
        out[method](slot, ref, p, n, uv, color);
        if (
          method === 'addQuad' &&
          slot === 'metal' &&
          p.every((v) => v[1] >= 87.4 && v[1] <= 88.61)
        )
          face(out, slot, [...p].reverse(), color);
      },
    ]),
  );
  yserTower.build(wrapped);
}
