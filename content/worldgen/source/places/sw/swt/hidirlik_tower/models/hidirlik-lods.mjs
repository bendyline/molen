/** Complete medium-fi browser levels with a vector national flag and shared stone/metal. */
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam as fullBeam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box as fullBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const tau = Math.PI * 2;
function cap(out, slot, outer, holes, point, color, both = false, maxEdge = Infinity) {
  const temp = new MeshBufferBuilder();
  if (
    !temp.addCap(
      slot,
      'palette:#ffffff',
      outer,
      holes,
      () => 0,
      [0, 1, 0],
      (p) => p,
      color,
    )
  )
    throw new Error('Hidirlik polygon triangulation failed');
  const mesh = temp.finalize(),
    emit = (p) => {
      const lengths = p.map((a, i) =>
          Math.hypot(a[0] - p[(i + 1) % 3][0], a[1] - p[(i + 1) % 3][1]),
        ),
        n = Math.max(...lengths),
        i = lengths.indexOf(n);
      if (n > maxEdge) {
        const a = p[i],
          b = p[(i + 1) % 3],
          c = p[(i + 2) % 3],
          m = a.map((v, j) => (v + b[j]) / 2);
        emit([a, m, c]);
        emit([m, b, c]);
        return;
      }
      const points = p.map(point);
      triangle(out, slot, points, color);
      if (both) triangle(out, slot, [...points].reverse(), color);
    };
  for (let i = 0; i < mesh.indices.length; i += 3)
    emit(
      Array.from(mesh.indices.slice(i, i + 3), (j) => [
        mesh.positions[j * 3],
        mesh.positions[j * 3 + 2],
      ]),
    );
}
function flag(out, n, maxEdge) {
  const R = 0.3,
    r = 0.242,
    d = 0.1,
    x = (R * R - r * r + d * d) / (2 * d),
    a = Math.acos(x / R),
    b = Math.acos((x - d) / r),
    crescent = [
      ...Array.from({ length: n + 1 }, (_, i) => {
        const t = a + ((tau - 2 * a) * i) / n;
        return [0.61 + R * Math.cos(t), 0.55 + R * Math.sin(t)];
      }),
      ...Array.from({ length: n - 1 }, (_, i) => {
        const t = -b - ((tau - 2 * b) * (i + 1)) / n;
        return [0.71 + r * Math.cos(t), 0.55 + r * Math.sin(t)];
      }),
    ],
    star = Array.from({ length: 10 }, (_, i) => {
      const a = (i * Math.PI) / 5,
        r = i % 2 ? 0.069 : 0.172;
      return [0.99 + Math.cos(a) * r, 0.55 + Math.sin(a) * r];
    }),
    target = transform(out, 0, [-0.5, 15.82, -0.5]),
    point = ([u, v]) => [
      u,
      1.12 - v,
      maxEdge === Infinity ? 0 : 0.09 * Math.sin(u * 3.5 - v * 1.4),
    ];
  cap(
    target,
    'turf',
    [
      [0, 0],
      [1.65, 0],
      [1.65, 1.1],
      [0, 1.1],
    ],
    [crescent, star],
    point,
    [0.66, 0.028, 0.035],
    true,
    maxEdge,
  );
  for (const poly of [crescent, star])
    cap(target, 'turf', poly, [], point, [0.88, 0.88, 0.81], true, maxEdge);
}
function flatWall(out, width, y0, y1, z, holes, color) {
  const xs = [
      ...new Set([-width / 2, width / 2, ...holes.flatMap((h) => [h.x - h.w / 2, h.x + h.w / 2])]),
    ].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y, h.y + h.h])])].sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const x = (xs[i] + xs[i - 1]) / 2,
        y = (ys[j] + ys[j - 1]) / 2;
      if (holes.some((h) => Math.abs(x - h.x) < h.w / 2 && y > h.y && y < h.y + h.h)) continue;
      face(
        out,
        'limestone_raw',
        [
          [xs[i - 1], ys[j - 1], z],
          [xs[i], ys[j - 1], z],
          [xs[i], ys[j], z],
          [xs[i - 1], ys[j], z],
        ],
        color,
      );
    }
  for (const h of holes) {
    const x = h.x,
      w = h.w / 2,
      y = h.y,
      t = y + h.h;
    face(
      out,
      'shadow',
      [
        [x - w, y, z - 0.5],
        [x + w, y, z - 0.5],
        [x + w, t, z - 0.5],
        [x - w, t, z - 0.5],
      ],
      [0.055, 0.06, 0.055],
    );
    for (const p of [
      [
        [x - w, y, z],
        [x - w, t, z],
        [x - w, t, z - 0.51],
        [x - w, y, z - 0.51],
      ],
      [
        [x + w, y, z - 0.51],
        [x + w, t, z - 0.51],
        [x + w, t, z],
        [x + w, y, z],
      ],
      [
        [x - w, t, z],
        [x + w, t, z],
        [x + w, t, z - 0.51],
        [x - w, t, z - 0.51],
      ],
    ])
      face(out, 'limestone_raw', p, color);
  }
}
function components(level) {
  const skyline = level === 'skyline',
    district = level === 'district' || skyline,
    close = level === 'closeup';
  function box(out, slot, a, b, color) {
    if (
      district &&
      slot === 'limestone_raw' &&
      b[2] - a[2] < 0.12 &&
      (b[0] - a[0] < 0.4 || b[1] - a[1] < 0.2)
    )
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
    if (district && slot === 'limestone_raw')
      face(
        out,
        slot,
        [
          [a[0] - w / 2, a[1], a[2] + d / 2],
          [a[0] + w / 2, a[1], a[2] + d / 2],
          [b[0] + w / 2, b[1], b[2] + d / 2],
          [b[0] - w / 2, b[1], b[2] + d / 2],
        ],
        color,
      );
    else fullBeam(out, slot, a, b, w, d, color);
  }
  const stone = [0.65, 0.59, 0.46],
    mortar = [0.43, 0.42, 0.35];
  const noise = (x) => {
    let v = Math.imul(Math.round(x * 1024) + 137, 0x45d9f3b);
    v = Math.imul(v ^ (v >>> 16), 0x45d9f3b);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
  };
  const tint = (key, base = stone) =>
    base.map((c, k) => c * (0.88 + noise(key * 3.1) * 0.18) + (k === 0 ? noise(key) * 0.035 : 0));

  /** Individually beveled ashlar face with shallow weathered joints. */
  function ashlar(out, x0, x1, y0, y1, z, seed, color = tint(seed), depth = 0.025) {
    if (x1 - x0 < 0.025 || y1 - y0 < 0.025) return;
    if (!close) {
      face(
        out,
        'limestone_raw',
        [
          [x0, y0, z],
          [x1, y0, z],
          [x1, y1, z],
          [x0, y1, z],
        ],
        color,
      );
      return;
    }
    const bevel = Math.min(0.012 + noise(seed) * 0.009, (x1 - x0) / 8, (y1 - y0) / 8);
    const outer = [
      [x0, y0, z - depth],
      [x1, y0, z - depth],
      [x1, y1, z - depth],
      [x0, y1, z - depth],
    ];
    const inner = [
      [x0 + bevel, y0 + bevel, z],
      [x1 - bevel, y0 + bevel, z],
      [x1 - bevel, y1 - bevel, z],
      [x0 + bevel, y1 - bevel, z],
    ];
    face(out, 'limestone_raw', inner, color);
    for (let i = 0; i < 4; i++)
      face(
        out,
        'limestone_raw',
        [outer[i], outer[(i + 1) % 4], inner[(i + 1) % 4], inner[i]],
        color,
      );
  }
  function wall(out, width, y0, y1, depth, seed, openings = []) {
    if (district) {
      flatWall(out, width, y0, y1, depth, openings, stone);
      return;
    }
    const levels = [y0];
    let y = y0,
      row = 0;
    while (y < y1 - 0.01) {
      y = Math.min(y1, y + 0.44 + noise(seed + row * 7) * 0.18);
      levels.push(y);
      row++;
    }
    for (let j = 0; j < levels.length - 1; j++) {
      let x = -width / 2,
        k = 0;
      while (x < width / 2 - 0.01) {
        const end = Math.min(width / 2, x + 0.78 + noise(seed + j * 53 + k * 13) * 0.72);
        const xs = [
          x,
          end,
          ...openings
            .flatMap((o) => [o.x - o.w / 2, o.x + o.w / 2])
            .filter((v) => v > x && v < end),
        ].sort((a, b) => a - b);
        const ys = [
          levels[j],
          levels[j + 1],
          ...openings
            .flatMap((o) => [o.y, o.y + o.h])
            .filter((v) => v > levels[j] && v < levels[j + 1]),
        ].sort((a, b) => a - b);
        for (let a = 1; a < xs.length; a++)
          for (let b = 1; b < ys.length; b++) {
            const cx = (xs[a - 1] + xs[a]) / 2,
              cy = (ys[b - 1] + ys[b]) / 2;
            if (openings.some((o) => Math.abs(cx - o.x) < o.w / 2 && cy > o.y && cy < o.y + o.h))
              continue;
            ashlar(
              out,
              xs[a - 1] + 0.006,
              xs[a] - 0.006,
              ys[b - 1] + 0.006,
              ys[b] - 0.006,
              depth + noise(seed + j * 53 + k) * 0.025,
              seed + j * 53 + k,
            );
          }
        x = end;
        k++;
      }
    }
    for (const o of openings) {
      const x = o.x,
        w = o.w / 2,
        y = o.y,
        t = y + o.h;
      face(
        out,
        'shadow',
        [
          [x - w, y, depth - 0.5],
          [x + w, y, depth - 0.5],
          [x + w, t, depth - 0.5],
          [x - w, t, depth - 0.5],
        ],
        [0.055, 0.06, 0.055],
      );
      for (const p of [
        [
          [x - w, y, depth],
          [x - w, t, depth],
          [x - w, t, depth - 0.51],
          [x - w, y, depth - 0.51],
        ],
        [
          [x + w, y, depth - 0.51],
          [x + w, t, depth - 0.51],
          [x + w, t, depth],
          [x + w, y, depth],
        ],
        [
          [x - w, t, depth],
          [x + w, t, depth],
          [x + w, t, depth - 0.51],
          [x - w, t, depth - 0.51],
        ],
      ])
        face(out, 'limestone_raw', p, stone);
    }
  }
  function squareProfile(out, y, profile, seed) {
    for (let j = 1; j < profile.length; j++) {
      const [dy0, r0] = profile[j - 1],
        [dy1, r1] = profile[j];
      for (let s = 0; s < 4; s++) {
        const o = transform(out, (s * Math.PI) / 2),
          half = s % 2 ? 8.65 : 8.6,
          other = s % 2 ? 8.6 : 8.65,
          n = close ? 24 : district ? 1 : 6;
        for (let i = 0; i < n; i++) {
          const u0 = -1 + (2 * i) / n,
            u1 = -1 + (2 * (i + 1)) / n;
          face(
            o,
            'limestone_raw',
            [
              [u0 * (half + r0), y + dy0, other + r0],
              [u1 * (half + r0), y + dy0, other + r0],
              [u1 * (half + r1), y + dy1, other + r1],
              [u0 * (half + r1), y + dy1, other + r1],
            ],
            tint(seed + s * 41 + i),
          );
        }
      }
    }
  }
  function podium(out) {
    box(out, 'limestone_raw', [-8.0, 0, -8.0], [8.0, 6.12, 8.0], mortar);
    // A true entrance recess is placed in front of the continuous enclosed core.
    for (let s = 0; s < 4; s++) {
      const o = transform(out, (s * Math.PI) / 2),
        width = s % 2 ? 17.3 : 17.2,
        depth = s % 2 ? 8.6 : 8.65;
      const openings =
        s === 0
          ? [{ x: 0, w: 1.55, y: 0.64, h: 2.05 }]
          : s === 1
            ? [{ x: 0, w: 1.36, y: 0.67, h: 2.08 }]
            : [];
      wall(o, width, 0.62, 6.05, depth + 0.12, s * 193, openings);
      // Small breathing slits on the three chamber walls, including the blocked northwest entry.
      if (s !== 0)
        box(
          o,
          'shadow',
          [-0.11, 2.75, depth + 0.146],
          [0.11, 3.23, depth + 0.15],
          [0.085, 0.08, 0.063],
        );
    }
    squareProfile(
      out,
      0,
      [
        [0, 0.28],
        [0.17, 0.28],
        [0.17, 0.17],
        [0.28, 0.13],
        [0.36, 0.07],
        [0.46, 0.07],
        [0.57, 0.15],
        [0.64, 0.15],
      ],
      401,
    );
    squareProfile(
      out,
      5.96,
      [
        [0, 0.05],
        [0.11, 0.05],
        [0.14, 0.2],
        [0.21, 0.23],
        [0.27, 0.34],
        [0.38, 0.43],
        [0.49, 0.43],
        [0.51, 0.19],
        [0.68, 0.19],
      ],
      502,
    );
    // Modillions support the eroded projecting Roman podium cornice.
    for (let s = 0; s < 4; s++) {
      const o = transform(out, (s * Math.PI) / 2),
        half = s % 2 ? 8.65 : 8.6,
        depth = s % 2 ? 8.6 : 8.65;
      for (let i = 0; i < 20; i += district ? 4 : 1) {
        const x = -half + 0.48 + (i * (2 * half - 0.96)) / 19;
        box(
          o,
          'limestone_raw',
          [x - 0.15, 5.71, depth + 0.05],
          [x + 0.15, 6.09, depth + 0.32],
          tint(710 + s * 37 + i),
        );
        box(
          o,
          'limestone_raw',
          [x - 0.22, 6.0, depth + 0.04],
          [x + 0.22, 6.16, depth + 0.43],
          tint(910 + s * 37 + i),
        );
      }
    }
    // Exposed corner paving between the square podium and the drum.
    cap(
      out,
      'limestone_raw',
      [
        [-8.6, -8.65],
        [8.6, -8.65],
        [8.6, 8.65],
        [-8.6, 8.65],
      ],
      [
        Array.from({ length: close ? 96 : district ? 24 : 48 }, (_, i) => [
          Math.cos((i * tau) / (close ? 96 : district ? 24 : 48)) * 7.9,
          Math.sin((i * tau) / (close ? 96 : district ? 24 : 48)) * 7.9,
        ]),
      ],
      ([x, z]) => [x, 6.635, z],
      stone,
    );
    const z = 8.81;
    for (const x of [-0.96, 0.96])
      box(
        out,
        'limestone_raw',
        [x - 0.18, 0.64, z - 0.13],
        [x + 0.18, 2.83, z + 0.08],
        tint(1200 + x),
      );
    box(out, 'limestone_raw', [-1.2, 2.68, z - 0.12], [1.2, 2.9, z + 0.17], tint(1210));
    box(out, 'limestone_raw', [-1.34, 2.9, z - 0.12], [1.34, 3.03, z + 0.24], tint(1211));
    // Shallow relief: six bound rod bundles on either side of the Ionic doorway.
    for (const s of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const x = s * (1.64 + i * 0.8),
          y = 1.08 + (i % 2) * 0.035;
        for (let k = 0; k < 5; k++)
          beam(
            out,
            'limestone_raw',
            [x + (k - 2) * 0.051, y, z + 0.028],
            [x + (k - 2) * 0.051, y + 1.75, z + 0.028],
            0.04,
            0.055,
            tint(1300 + i * 7 + k + s),
          );
        for (const yy of [y + 0.22, y + 0.69, y + 1.18, y + 1.56])
          box(
            out,
            'limestone_raw',
            [x - 0.153, yy, z + 0.009],
            [x + 0.153, yy + 0.085, z + 0.065],
            stone,
          );
        face(
          out,
          'limestone_raw',
          [
            [x + 0.12, y + 1.62, z + 0.065],
            [x + 0.34, y + 1.75, z + 0.065],
            [x + 0.34, y + 1.43, z + 0.065],
            [x + 0.12, y + 1.48, z + 0.065],
          ],
          stone,
        );
      }
    // Northwest doorway retains the documented irregular rubble infill.
    const blocked = transform(out, Math.PI / 2, [0, 0, 0]);
    for (let j = 0; j < 7; j++)
      for (let k = 0; k < 3; k++)
        ashlar(
          blocked,
          -0.65 + k * 0.43,
          -0.24 + k * 0.43,
          0.68 + j * 0.29,
          0.945 + j * 0.29,
          8.65,
          1700 + j * 7 + k,
          tint(1700 + j * 7 + k),
          0.07,
        );
  }

  function wedge(out, a, b, y0, y1, r0, r1, key, color = tint(key), bevel = 0.018) {
    const p = (r, y, t) => [Math.cos(t) * r, y, Math.sin(t) * r];
    const n = Math.max(
      1,
      Math.ceil((b - a) / (close ? 0.035 : skyline ? 0.45 : district ? 0.2 : 0.1)),
    );
    if (!close && key >= 2200 && key < 2650) {
      for (let i = 0; i < n; i++) {
        const aa = a + ((b - a) * i) / n,
          bb = a + ((b - a) * (i + 1)) / n;
        face(
          out,
          'limestone_raw',
          [p(r1, y0, bb), p(r1, y0, aa), p(r1, y1, aa), p(r1, y1, bb)],
          color,
        );
      }
      return;
    }
    if (!close) bevel = 0;
    for (let i = 0; i < n; i++) {
      const aa = a + ((b - a) * i) / n,
        bb = a + ((b - a) * (i + 1)) / n;
      face(
        out,
        'limestone_raw',
        [p(r1, y0, bb), p(r1, y0, aa), p(r1, y1, aa), p(r1, y1, bb)],
        color,
      );
      face(
        out,
        'limestone_raw',
        [p(r0, y0, aa), p(r0, y0, bb), p(r0, y1, bb), p(r0, y1, aa)],
        color,
      );
      face(
        out,
        'limestone_raw',
        [p(r0, y1, bb), p(r1, y1, bb), p(r1, y1, aa), p(r0, y1, aa)],
        color,
      );
      face(
        out,
        'limestone_raw',
        [p(r0, y0, aa), p(r1, y0, aa), p(r1, y0, bb), p(r0, y0, bb)],
        color,
      );
    }
    face(out, 'limestone_raw', [p(r0, y0, a), p(r0, y1, a), p(r1, y1, a), p(r1, y0, a)], color);
    face(out, 'limestone_raw', [p(r1, y0, b), p(r1, y1, b), p(r0, y1, b), p(r0, y0, b)], color);
    if (bevel > 0) {
      const rim = bevel;
      for (let i = 0; i < n; i++) {
        const aa = a + ((b - a) * i) / n,
          bb = a + ((b - a) * (i + 1)) / n;
        face(
          out,
          'limestone_raw',
          [p(r1, y0, aa), p(r1 + rim, y0 + rim, aa), p(r1 + rim, y0 + rim, bb), p(r1, y0, bb)],
          color,
        );
        face(
          out,
          'limestone_raw',
          [p(r1 + rim, y1 - rim, aa), p(r1, y1, aa), p(r1, y1, bb), p(r1 + rim, y1 - rim, bb)],
          color,
        );
      }
    }
  }
  function drum(out) {
    loft(
      out,
      'limestone_raw',
      [
        radialRing(
          6.63,
          district ? 7.9 : 7.86,
          district ? 7.9 : 7.86,
          close ? 160 : district ? 24 : 48,
        ),
        radialRing(
          12.12,
          district ? 7.9 : 7.86,
          district ? 7.9 : 7.86,
          close ? 160 : district ? 24 : 48,
        ),
      ],
      district ? stone : mortar,
    );
    for (let j = 0; !district && j < 10; j++) {
      const y0 = 6.65 + j * 0.526,
        y1 = y0 + 0.513,
        n = 34 + (j % 3),
        shift = (j % 2) * 0.45;
      for (let i = 0; i < n; i++) {
        const a = ((i + shift) * tau) / n + 0.001,
          b = ((i + 1 + shift) * tau) / n - 0.001;
        wedge(out, a, b, y0, y1, 7.78, 7.9 + noise(2200 + j * 41 + i) * 0.012, 2200 + j * 41 + i);
      }
    }
    // Continuous moulded drum cornice, divided into individual large stone blocks.
    const profile = [
      [11.91, 7.9],
      [12.0, 7.97],
      [12.08, 8.11],
      [12.18, 8.14],
      [12.26, 8.23],
      [12.36, 8.23],
      [12.4, 8.0],
    ];
    for (let j = 1; j < profile.length; j++)
      for (let i = 0; i < (close ? 64 : district ? 24 : 32); i++) {
        const a = (-i * tau) / (close ? 64 : district ? 24 : 32),
          b = (-(i + 1) * tau) / (close ? 64 : district ? 24 : 32),
          p = (r, y, t) => [Math.cos(t) * r, y, Math.sin(t) * r];
        face(
          out,
          'limestone_raw',
          [
            p(profile[j - 1][1], profile[j - 1][0], a),
            p(profile[j - 1][1], profile[j - 1][0], b),
            p(profile[j][1], profile[j][0], b),
            p(profile[j][1], profile[j][0], a),
          ],
          tint(2700 + i),
        );
      }
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8 + Math.PI / 2,
        o = transform(out, Math.PI / 2 - a);
      box(o, 'limestone_raw', [-0.21, 10.4, 7.86], [0.21, 10.98, 8.22], tint(2880 + i));
      box(o, 'limestone_raw', [-0.32, 10.91, 7.84], [0.32, 11.08, 8.42], tint(2900 + i));
    }
    // Open roof terrace: paving surrounds the documented central square monument pedestal.
    loft(
      out,
      'limestone_raw',
      [
        radialRing(12.08, 7.8, 7.8, close ? 160 : district ? 24 : 48),
        radialRing(12.24, 7.8, 7.8, close ? 160 : district ? 24 : 48),
      ],
      tint(3001),
    );
    box(out, 'limestone_raw', [-2.28, 12.23, -2.28], [2.28, 12.98, 2.28], mortar);
    for (let s = 0; s < 4; s++)
      wall(transform(out, (s * Math.PI) / 2), 4.56, 12.24, 12.98, 2.29, 3020 + s * 17);
    box(out, 'limestone_raw', [-2.31, 12.97, -2.31], [2.31, 13.12, 2.31], tint(3090));
    // Monolithic crenellation bases survive at the northeast/north side.
    if (!close) wedge(out, 0, tau, 12.4, 12.84, 7.48, 7.98, 3200, stone, 0);
    for (let i = 0; close && i < 48; i++)
      wedge(
        out,
        (i * tau) / 48 + 0.002,
        ((i + 1) * tau) / 48 - 0.002,
        12.4,
        12.84,
        7.48,
        7.98,
        3200 + i,
      );
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.2) * Math.PI) / 12,
        b = ((i + 0.73) * Math.PI) / 12;
      const h = 13.55 + noise(3300 + i) * 0.13;
      wedge(out, a, b, 12.84, h, 7.48, 7.98, 3300 + i);
      wedge(out, a - 0.009, b + 0.009, h, h + 0.12, 7.44, 8.03, 3350 + i);
    }
    // Later defensive infill survives on the southwest/south/southeast half.
    if (!close) {
      for (const [a, b, y0] of [
        [-Math.PI, -2.78, 12.84],
        [-2.78, -2.61, 13.72],
        [-2.61, 0, 12.84],
      ])
        wedge(out, a, b, y0, 14.03, 7.47, 7.995, 3500, stone, 0);
      wedge(out, -Math.PI, 0, 14.03, 14.065, 7.46, 8.01, 4000, stone, 0);
    }
    for (let j = 0; close && j < 5; j++) {
      const y0 = 12.84 + j * 0.232,
        y1 = y0 + 0.223,
        n = 44;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI + ((i + (j % 2) * 0.23) * Math.PI) / n + 0.002,
          b = Math.min(0, -Math.PI + ((i + 1 + (j % 2) * 0.23) * Math.PI) / n - 0.002);
        if (b <= a) continue;
        // A rectangular opening near the southeast end remains visible in city/photographer views.
        const angles = [a, b, ...[-2.78, -2.61].filter((v) => v > a && v < b)].sort(
          (a, b) => a - b,
        );
        const levels = [y0, y1, ...[13.72].filter((v) => v > y0 && v < y1)].sort((a, b) => a - b);
        for (let ai = 1; ai < angles.length; ai++)
          for (let yi = 1; yi < levels.length; yi++) {
            const ca = (angles[ai - 1] + angles[ai]) / 2,
              cy = (levels[yi - 1] + levels[yi]) / 2;
            if (ca > -2.78 && ca < -2.61 && cy < 13.72) continue;
            wedge(
              out,
              angles[ai - 1],
              angles[ai],
              levels[yi - 1],
              levels[yi],
              7.47,
              7.98 + noise(3500 + j * 51 + i) * 0.035,
              3500 + j * 51 + i,
              tint(3500 + j * 51 + i),
              0,
            );
          }
      }
    }
    for (let i = 0; close && i < 32; i++)
      wedge(
        out,
        -Math.PI + (i * Math.PI) / 32 + 0.001,
        -Math.PI + ((i + 1) * Math.PI) / 32 - 0.001,
        13.99,
        14.03 + noise(4000 + i) * 0.035,
        7.46,
        8.01,
        4000 + i,
      );
    // A slender national flagpole survives in current2026 photographs.
    beam(out, 'metal', [-0.5, 13.1, -0.5], [-0.5, 17.2, -0.5], 0.045, 0.045, [0.6, 0.6, 0.55]);
    flag(out, district ? 8 : close ? 24 : 16, district ? Infinity : close ? 0.4 : 0.75);
  }

  function build(out) {
    podium(out);
    drum(out);
  }

  function distant(out) {
    box(out, 'limestone_raw', [-8, 0, -8], [8, 6.12, 8], stone);
    for (let side = 0; side < 4; side++) {
      const o = transform(out, (side * Math.PI) / 2),
        w = side % 2 ? 17.3 : 17.2,
        z = (side % 2 ? 8.6 : 8.65) + 0.12;
      flatWall(
        o,
        w,
        0.62,
        6.05,
        z,
        side === 0
          ? [{ x: 0, w: 1.55, y: 0.64, h: 2.05 }]
          : side === 1
            ? [{ x: 0, w: 1.36, y: 0.67, h: 2.08 }]
            : [],
        stone,
      );
      if (side === 1)
        face(
          o,
          'limestone_raw',
          [
            [-0.65, 0.68, 8.65],
            [0.65, 0.68, 8.65],
            [0.65, 2.7, 8.65],
            [-0.65, 2.7, 8.65],
          ],
          stone,
        );
    }
    squareProfile(
      out,
      0,
      [
        [0, 0.28],
        [0.17, 0.28],
        [0.36, 0.07],
        [0.64, 0.15],
      ],
      401,
    );
    squareProfile(
      out,
      5.96,
      [
        [0, 0.05],
        [0.27, 0.34],
        [0.49, 0.43],
        [0.68, 0.19],
      ],
      502,
    );
    cap(
      out,
      'limestone_raw',
      [
        [-8.6, -8.65],
        [8.6, -8.65],
        [8.6, 8.65],
        [-8.6, 8.65],
      ],
      [
        Array.from({ length: 12 }, (_, i) => [
          Math.cos((i * tau) / 12) * 7.9,
          Math.sin((i * tau) / 12) * 7.9,
        ]),
      ],
      ([x, z]) => [x, 6.635, z],
      stone,
    );
    loft(
      out,
      'limestone_raw',
      [radialRing(6.63, 7.9, 7.9, 12), radialRing(12.12, 7.9, 7.9, 12)],
      stone,
    );
    loft(
      out,
      'limestone_raw',
      [
        [11.91, 7.9],
        [12.26, 8.23],
        [12.4, 8],
      ].map(([y, r]) => radialRing(y, r, r, 12)),
      stone,
      { cap: false },
    );
    loft(
      out,
      'limestone_raw',
      [radialRing(12.08, 7.8, 7.8, 12), radialRing(12.24, 7.8, 7.8, 12)],
      stone,
    );
    box(out, 'limestone_raw', [-2.31, 12.23, -2.31], [2.31, 13.12, 2.31], stone);
    wedge(out, 0, tau, 12.4, 12.84, 7.48, 7.98, 3200, stone, 0);
    for (let i = 0; i < 12; i++) {
      const a = ((i + 0.2) * Math.PI) / 12,
        b = ((i + 0.73) * Math.PI) / 12,
        h = 13.67 + noise(3300 + i) * 0.13;
      wedge(out, a, b, 12.84, h, 7.44, 8.03, 3300 + i, stone, 0);
    }
    for (const [a, b, y] of [
      [-Math.PI, -2.78, 12.84],
      [-2.78, -2.61, 13.72],
      [-2.61, 0, 12.84],
    ])
      wedge(out, a, b, y, 14.03, 7.47, 7.995, 3500, stone, 0);
    wedge(out, -Math.PI, 0, 14.03, 14.065, 7.46, 8.01, 4000, stone, 0);
    const z = 8.81;
    for (const x of [-0.96, 0.96])
      box(out, 'limestone_raw', [x - 0.18, 0.64, z - 0.13], [x + 0.18, 2.83, z + 0.08], stone);
    box(out, 'limestone_raw', [-1.2, 2.68, z - 0.12], [1.2, 2.9, z + 0.17], stone);
    box(out, 'limestone_raw', [-1.34, 2.9, z - 0.12], [1.34, 3.03, z + 0.24], stone);
    for (const sign of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const x = sign * (1.64 + i * 0.8),
          y = 1.08 + (i % 2) * 0.035;
        face(
          out,
          'limestone_raw',
          [
            [x - 0.13, y, 8.866],
            [x + 0.13, y, 8.866],
            [x + 0.13, y + 1.75, 8.866],
            [x - 0.13, y + 1.75, 8.866],
          ],
          stone,
        );
      }
    fullBeam(out, 'metal', [-0.5, 13.1, -0.5], [-0.5, 17.2, -0.5], 0.045, 0.045, [0.6, 0.6, 0.55]);
    flag(out, 6, Infinity);
  }
  return { build, distant };
}
export const hidirlikDistrict = (out) => components('district').build(out);
export const hidirlikStreet = (out) => components('street').build(out);
export const hidirlikCloseup = (out) => components('closeup').build(out);
export function hidirlikSkyline(out) {
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) =>
        out[method](
          slot,
          ref,
          p,
          n,
          uv,
          ['turf', 'shadow'].includes(slot) ? color : color.map((v) => v * 0.65),
        ),
    ]),
  );
  components('skyline').distant(target);
}
