/** Component-derived browser levels. Original detailed master remains unchanged. */
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade as detailedFacade,
  face,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { wiesghaTower } from '../../../../../../../../packages/worldgen/scripts/wiesgha-tower-model.mjs';

function builder(cfg) {
  const facade = (out, slot, width, y0, y1, z, holes, color) => {
    if (!cfg.squareArches) return detailedFacade(out, slot, width, y0, y1, z, holes, color);
    const xs = [
        ...new Set([
          -width / 2,
          width / 2,
          ...holes.flatMap((q) => [q.x - q.w / 2, q.x + q.w / 2]),
        ]),
      ].sort((a, b) => a - b),
      ys = [...new Set([y0, y1, ...holes.flatMap((q) => [q.y, q.spring + q.rise])])].sort(
        (a, b) => a - b,
      );
    const panel = (points, tint = color) => face(out, slot, points, tint);
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (
          holes.some(
            (q) => x > q.x - q.w / 2 && x < q.x + q.w / 2 && y > q.y && y < q.spring + q.rise,
          )
        )
          continue;
        panel([
          [xs[i], ys[j], z],
          [xs[i + 1], ys[j], z],
          [xs[i + 1], ys[j + 1], z],
          [xs[i], ys[j + 1], z],
        ]);
      }
    for (const q of holes) {
      const a = q.x - q.w / 2,
        b = q.x + q.w / 2,
        t = q.spring + q.rise,
        back = z - (q.depth ?? 0.45);
      panel([
        [a, q.y, z],
        [a, q.y, back],
        [a, t, back],
        [a, t, z],
      ]);
      panel([
        [b, q.y, back],
        [b, q.y, z],
        [b, t, z],
        [b, t, back],
      ]);
      panel([
        [a, t, back],
        [b, t, back],
        [b, t, z],
        [a, t, z],
      ]);
      if (q.back !== false)
        face(
          out,
          'shadow',
          [
            [a, q.y, back],
            [b, q.y, back],
            [b, t, back],
            [a, t, back],
          ],
          [0.1, 0.11, 0.1],
        );
    }
  };
  const pale = [0.83, 0.76, 0.58],
    old = [0.68, 0.61, 0.46],
    joint = [0.56, 0.51, 0.4],
    dark = [0.1, 0.11, 0.1];
  const baseHalf = 4.245,
    upperHalf = 3.67,
    batterTop = 4.06,
    roof = 8.7,
    parapetTop = 9.78;
  const halfAt = (y) => baseHalf - (baseHalf - upperHalf) * Math.min(1, y / batterTop);
  function ring(y, r) {
    return [
      [-r, y, -r],
      [-r, y, r],
      [r, y, r],
      [r, y, -r],
    ];
  }

  // Block depth is real, but the continuous wall behind it keeps mortar joints closed.
  function course(out, x0, x1, y0, y1, z0, z1, color) {
    if (!cfg.courses) return;
    if (cfg.flatCourses) {
      face(
        out,
        'limestone_raw',
        [
          [x0, y0, z0 + 0.038],
          [x1, y0, z0 + 0.038],
          [x1, y1, z1 + 0.038],
          [x0, y1, z1 + 0.038],
        ],
        color,
      );
      return;
    }
    const d = 0.022,
      back = 0.016;
    const p = [
      [x0, y0, z0 + back],
      [x1, y0, z0 + back],
      [x1, y1, z1 + back],
      [x0, y1, z1 + back],
    ];
    face(
      out,
      'limestone_raw',
      p.map(([x, y, z]) => [x, y, z + d]),
      color,
    );
    face(
      out,
      'limestone_raw',
      [p[0], p[1], [p[1][0], p[1][1], p[1][2] + d], [p[0][0], p[0][1], p[0][2] + d]],
      color,
    );
    face(
      out,
      'limestone_raw',
      [p[1], p[2], [p[2][0], p[2][1], p[2][2] + d], [p[1][0], p[1][1], p[1][2] + d]],
      color,
    );
    face(
      out,
      'limestone_raw',
      [p[2], p[3], [p[3][0], p[3][1], p[3][2] + d], [p[2][0], p[2][1], p[2][2] + d]],
      color,
    );
    face(
      out,
      'limestone_raw',
      [p[3], p[0], [p[0][0], p[0][1], p[0][2] + d], [p[3][0], p[3][1], p[3][2] + d]],
      color,
    );
  }
  function blockwork(out, a, y0, y1, holes = [], flat = false) {
    if (!cfg.courses) return;
    const f = transform(out, a),
      rows = Math.max(1, Math.round((y1 - y0) / cfg.courseHeight)),
      h = (y1 - y0) / rows;
    for (let row = 0; row < rows; row++) {
      const lo = y0 + row * h + 0.009,
        hi = y0 + (row + 1) * h - 0.009,
        r0 = flat ? upperHalf : halfAt(lo),
        r1 = flat ? upperHalf : halfAt(hi),
        r = Math.min(r0, r1);
      let x = -r,
        j = 0;
      while (x < r - 0.02) {
        const width = cfg.blockWidth + ((row * 17 + j * 7) % 7) * 0.063,
          x1 = Math.min(r, x + width),
          mid = (lo + hi) / 2;
        const inHole = holes.some(
          (q) =>
            x < q.x + q.w / 2 + 0.13 &&
            x1 > q.x - q.w / 2 - 0.13 &&
            lo < q.top + 0.12 &&
            hi > q.y - 0.12,
        );
        if (!inHole && x1 - x > 0.03) {
          const variance = ((row * 31 + j * 19) % 13) / 130;
          // Pale stepped repairs on the inland face are visible after the 2008/09 restoration.
          const repair =
            a === 0 &&
            ((mid > 4.25 && Math.abs((x + x1) / 2) < Math.max(0.9, 2.5 - (mid - 4.25) * 0.24)) ||
              (mid < 2.4 && mid > 1.3));
          const tint = (repair ? pale : old).map((v) => Math.min(0.95, v + variance));
          course(f, x + 0.008, x1 - 0.008, lo, hi, r0, r1, tint);
        }
        x = x1;
        j++;
      }
    }
  }
  function apertures(out) {
    const front = {
      x: -0.08,
      y: 4.5,
      w: 0.9,
      spring: 6.64,
      rise: 0.18,
      top: 6.84,
      depth: 0.34,
      trim: 0.045,
    };
    const sea = {
      x: 0,
      y: 5.42,
      w: 0.73,
      spring: 6.46,
      rise: 0.15,
      top: 6.63,
      depth: 0.65,
      trim: 0,
    };
    const loop = {
      x: -0.95,
      y: 5.83,
      w: 0.17,
      spring: 6.18,
      rise: 0,
      top: 6.18,
      depth: 0.34,
      trim: 0,
    };
    for (const [a, holes] of [
      [0, [front]],
      [Math.PI, [sea]],
      [-Math.PI / 2, [loop]],
      [Math.PI / 2, []],
    ]) {
      const f = transform(out, a);
      facade(f, 'limestone_raw', upperHalf * 2, 4.15, 8.67, upperHalf, holes, joint);
      blockwork(out, a, 4.15, 8.67, holes, true);
    }
    // Closed pale door sits deep within the small elevated inland entry.
    box(
      out,
      'wood',
      [-0.495, 4.52, upperHalf - 0.31],
      [0.335, 6.61, upperHalf - 0.27],
      [0.5, 0.53, 0.47],
    );
    for (const x of [-0.475, 0.31])
      box(
        out,
        'wood',
        [x, 4.53, upperHalf - 0.258],
        [x + 0.045, 6.58, upperHalf - 0.22],
        [0.62, 0.62, 0.52],
      );
    for (const y of [4.6, 5.02, 6.43])
      box(
        out,
        'wood',
        [-0.46, y, upperHalf - 0.26],
        [0.31, y + 0.07, upperHalf - 0.22],
        [0.61, 0.61, 0.52],
      );
    for (const y of [4.95, 6.22])
      box(
        out,
        'metal',
        [-0.48, y, upperHalf - 0.21],
        [-0.14, y + 0.037, upperHalf - 0.18],
        [0.18, 0.19, 0.16],
      );
    box(
      out,
      'metal',
      [0.21, 5.35, upperHalf - 0.21],
      [0.26, 5.56, upperHalf - 0.17],
      [0.16, 0.18, 0.15],
    );
    box(
      out,
      'limestone_raw',
      [-0.66, 4.38, upperHalf - 0.04],
      [0.51, 4.51, upperHalf + 0.17],
      pale,
    );
    // A thin landing repair forms the broad ledge below the doorway; no permanent staircase is present.
    loft(
      out,
      'limestone_raw',
      [
        [
          [-3.88, 0, 3.9],
          [-3.88, 0, 4.67],
          [3.88, 0, 4.67],
          [3.88, 0, 3.9],
        ],
        [
          [-3.75, 1.5, 3.88],
          [-3.75, 1.5, 4.5],
          [3.75, 1.5, 4.5],
          [3.75, 1.5, 3.88],
        ],
      ],
      pale,
    );
  }
  function bands(out) {
    for (const y of [4.06, 8.62]) {
      loft(out, 'limestone_raw', [ring(y, 3.73), ring(y + 0.19, 3.77), ring(y + 0.23, 3.73)], pale);
      for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const f = transform(out, a);
        for (let j = 0; j < (cfg.bandCourses ? 13 : 0); j++) {
          const x = -3.7 + (j * 7.4) / 13;
          box(
            f,
            'limestone_raw',
            [x + 0.007, y + 0.01, 3.73],
            [x + 7.4 / 13 - 0.007, y + 0.185, 3.774],
            j % 3 === 0 ? old : pale,
          );
        }
      }
    }
  }
  function roofscape(out) {
    box(out, 'limestone_raw', [-3.55, 8.57, -3.55], [3.55, roof, 3.55], [0.76, 0.7, 0.57]);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const f = transform(out, a),
        low = parapetTop - 0.22;
      box(f, 'limestone_raw', [-3.67, roof, 3.15], [3.67, low, 3.67], pale);
      box(f, 'limestone_raw', [-3.67, low, 3.15], [-0.38, parapetTop, 3.67], pale);
      box(f, 'limestone_raw', [0.38, low, 3.15], [3.67, parapetTop, 3.67], pale);
      for (let row = 0; row < 4; row++)
        for (let j = 0; j < 13; j++) {
          const x0 = -3.65 + (j * 7.3) / 13,
            x1 = x0 + 7.3 / 13,
            lo = roof + row * 0.265 + 0.008,
            hi = Math.min(parapetTop - 0.01, lo + 0.25);
          if (row === 3 && x0 < 0.4 && x1 > -0.4) continue;
          course(
            f,
            x0 + 0.008,
            x1 - 0.008,
            lo,
            hi,
            3.67,
            3.67,
            pale.map((v) => v + (j % 3) * 0.012),
          );
        }
    }
    // Restored staircase shelter occupies the western inland corner, matching the inventory photo.
    const cx = -2.69,
      cz = 2.69,
      rx = 0.98,
      rz = 0.98,
      y0 = 8.7,
      y1 = 11.25;
    for (const [a, w, z, holes] of [
      [
        0,
        rx * 2,
        rz,
        [
          { x: -0.4, y: 9.65, w: 0.16, spring: 9.98, rise: 0, top: 9.98, depth: 0.35, trim: 0 },
          { x: 0.38, y: 9.65, w: 0.12, spring: 9.94, rise: 0, top: 9.94, depth: 0.35, trim: 0 },
        ],
      ],
      [Math.PI, rx * 2, rz, []],
      [
        Math.PI / 2,
        rz * 2,
        rx,
        [
          {
            x: 0,
            y: y0,
            w: 0.84,
            spring: 10.84,
            rise: 0,
            top: 10.84,
            depth: 0.33,
            back: false,
            trim: 0,
          },
        ],
      ],
      [
        -Math.PI / 2,
        rz * 2,
        rx,
        [{ x: 0.16, y: 10.09, w: 0.22, spring: 10.43, rise: 0, top: 10.43, depth: 0.34, trim: 0 }],
      ],
    ]) {
      const f = transform(out, a, [cx, 0, cz]);
      facade(f, 'limestone_raw', w, y0, y1, z, holes, pale);
      for (let row = 0; row < 9; row++)
        for (let j = 0; j < 4; j++) {
          const x = -w / 2 + (j * w) / 4,
            lo = y0 + (row * (y1 - y0)) / 9 + 0.008,
            hi = y0 + ((row + 1) * (y1 - y0)) / 9 - 0.008;
          if (
            holes.some(
              (q) =>
                x < q.x + q.w / 2 + 0.06 &&
                x + w / 4 > q.x - q.w / 2 - 0.06 &&
                lo < q.top + 0.03 &&
                hi > q.y - 0.03,
            )
          )
            continue;
          course(f, x + 0.008, x + w / 4 - 0.008, lo, hi, z, z, pale);
        }
    }
    box(out, 'limestone_raw', [cx - rx, 11.25, cz - rz], [cx + rx, 11.4, cz + rz], pale);
    box(out, 'shadow', [cx - 0.61, 8.6, cz - 0.61], [cx + 0.61, 8.72, cz + 0.61], dark);
    // Drain outlet and small ventilation opening, both visible from the shore.
    box(out, 'limestone_raw', [-0.2, 8.07, -4.15], [0.2, 8.27, -3.6], pale);
    box(out, 'shadow', [-0.115, 8.08, -4.165], [0.115, 8.19, -4.153], dark);
    box(out, 'limestone_raw', [0.86, 8.7, -0.26], [1.54, 8.93, 0.36], pale);
    box(out, 'shadow', [0.97, 8.934, -0.15], [1.43, 8.944, 0.25], dark);
    loft(
      out,
      'metal',
      [
        radialRing(8.7, 0.05, 0.05, cfg.poleSides, [-1.4, 2.38]),
        radialRing(13.8, 0.025, 0.025, cfg.poleSides, [-1.4, 2.38]),
      ],
      [0.79, 0.78, 0.67],
    );
  }
  function build(out) {
    loft(out, 'limestone_raw', [ring(0, baseHalf), ring(batterTop, upperHalf)], joint);
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) blockwork(out, a, 0, batterTop);
    apertures(out);
    bands(out);
    roofscape(out);
  }

  return build;
}
export const wiesghaSkyline = builder({
  courses: false,
  flatCourses: true,
  courseHeight: 1,
  blockWidth: 1,
  bandCourses: false,
  poleSides: 6,
  squareArches: true,
});
export const wiesghaDistrict = builder({
  courses: true,
  flatCourses: true,
  courseHeight: 0.56,
  blockWidth: 0.82,
  bandCourses: false,
  poleSides: 8,
});
export const wiesghaStreet = builder({
  courses: true,
  flatCourses: true,
  courseHeight: 0.28,
  blockWidth: 0.41,
  bandCourses: true,
  poleSides: 12,
});
export const wiesghaCloseup = wiesghaTower.build;
