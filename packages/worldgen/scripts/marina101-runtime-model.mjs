/** Marina 101: developer plans, fabricator crown, and completed exterior photographs. */

import { readFileSync } from 'node:fs';
import { beam } from './authored-structure-mesh.mjs';
import {
  face,
  mappedCap,
  mappedSolid,
  grid as originalGrid,
  partPlan,
  partsEvidence,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(readFileSync(structureSourcePath('marina_101', 'map-frame.json')));
function render(out, m) {
  const detail = out.detail;
  function grid(out, q, color, dx, dy, width, trim, slot) {
    originalGrid(
      out,
      q,
      color,
      dx * detail.gridStep,
      dy * detail.gridStep,
      detail.frames ? width : 0,
      trim,
      slot,
    );
  }

  const silver = [0.67, 0.69, 0.68],
    warm = [0.55, 0.535, 0.49],
    blue = [0.13, 0.25, 0.29],
    crownBlue = [0.22, 0.4, 0.49];
  const hx = 20.64,
    hz = 19.067;
  const fronts = [
    { n: [0, 0, -1], r: [-1, 0, 0], d: hz, w: hx * 2, sea: true },
    { n: [1, 0, 0], r: [0, 0, -1], d: hx, w: hz * 2 },
    { n: [0, 0, 1], r: [1, 0, 0], d: hz, w: hx * 2 },
    { n: [-1, 0, 0], r: [0, 0, 1], d: hx, w: hz * 2 },
  ];
  function p(f, u, y, depth = 0) {
    return [f.n[0] * (f.d + depth) + f.r[0] * u, y, f.n[2] * (f.d + depth) + f.r[2] * u];
  }
  function panel(out, f, u0, u1, y0, y1, color, depth = 0, slot = 'metal') {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    face(
      out,
      slot,
      [p(f, u0, y0, depth), p(f, u1, y0, depth), p(f, u1, y1, depth), p(f, u0, y1, depth)],
      color,
    );
  }
  function sill(out, f, u0, u1, y, depth = 0.16) {
    if (!detail.sills) return;
    face(
      out,
      'metal',
      [
        p(f, u0, y - 0.055, depth + 0.11),
        p(f, u1, y - 0.055, depth + 0.11),
        p(f, u1, y + 0.055, depth + 0.11),
        p(f, u0, y + 0.055, depth + 0.11),
      ],
      silver,
    );
  }
  function flare(out, f, y) {
    if (detail.skyline) {
      for (const side of [-1, 1])
        tri(
          out,
          'metal',
          [
            p(f, (side * f.w) / 2, y - 6),
            p(f, (side * f.w) / 2, y),
            p(f, (side * f.w) / 2, y, 1.7),
          ],
          warm,
        );
      face(
        out,
        'metal',
        [
          p(f, -f.w / 2, y - 6),
          p(f, f.w / 2, y - 6),
          p(f, f.w / 2, y, 1.7),
          p(f, -f.w / 2, y, 1.7),
        ],
        silver,
      );
      face(
        out,
        'metal',
        [p(f, -f.w / 2, y, 1.7), p(f, f.w / 2, y, 1.7), p(f, f.w / 2, y), p(f, -f.w / 2, y)],
        silver,
      );
      return;
    }
    // Individual flaring piers leave the narrow glazing exposed between the light dishes.
    const count = detail.flareCount,
      bay = f.w / count;
    for (let i = 0; i <= count; i++) {
      const u = -f.w / 2 + i * bay,
        w = i === 0 || i === count ? 0.48 : 0.8;
      const profile = [
        [y - 6, 0],
        [y - 4, 0.12],
        [y - 2, 0.58],
        [y, 1.7],
      ];
      for (let j = 1; j < profile.length; j++) {
        const [a, b] = [profile[j - 1], profile[j]];
        face(
          out,
          'metal',
          [
            p(f, u - w / 2, a[0], a[1]),
            p(f, u + w / 2, a[0], a[1]),
            p(f, u + w / 2, b[0], b[1]),
            p(f, u - w / 2, b[0], b[1]),
          ],
          silver,
        );
        for (const side of [-1, 1])
          face(
            out,
            'metal',
            [
              p(f, u + (side * w) / 2, a[0], 0),
              p(f, u + (side * w) / 2, a[0], a[1] + 0.001),
              p(f, u + (side * w) / 2, b[0], b[1] + 0.001),
              p(f, u + (side * w) / 2, b[0], 0),
            ],
            warm,
          );
      }
    }
    const rim = [
      p(f, -f.w / 2, y, 1.7),
      p(f, f.w / 2, y, 1.7),
      p(f, f.w / 2, y, 0),
      p(f, -f.w / 2, y, 0),
    ];
    face(out, 'metal', rim, silver);
    beam(
      out,
      'metal',
      p(f, -f.w / 2, y - 0.14, 1.7),
      p(f, f.w / 2, y - 0.14, 1.7),
      0.28,
      0.15,
      silver,
    );
  }
  function shaft(out) {
    const plan = [
      [-hx, -hz],
      [-hx, hz],
      [hx, hz],
      [hx, -hz],
    ];
    mappedCap(out, 'metal', plan, 13, silver, [], true);
    mappedCap(out, 'metal', plan, 380, silver);
    const pitch = (370.9 - 13) / 94,
      wing = 13 + 80 * pitch;
    if (detail.skyline) {
      for (const f of fronts) {
        panel(out, f, -f.w / 2, f.w / 2, 13, 380, blue, 0, 'glass');
        const bay = f.w / 14;
        for (let i = 0; i <= 14; i++) {
          const u = -f.w / 2 + i * bay;
          panel(
            out,
            f,
            Math.max(-f.w / 2, u - 0.48),
            Math.min(f.w / 2, u + 0.48),
            13,
            370.9,
            i % 3 === 1 ? silver : warm,
            0.025,
          );
        }
        for (const sign of [-1, 1])
          panel(
            out,
            f,
            sign < 0 ? -f.w / 2 : 9.3,
            sign < 0 ? -9.3 : f.w / 2,
            wing,
            370.9,
            silver,
            0.03,
          );
        for (let row = 0; row < 94; row += detail.rowStep) {
          const y = 13 + row * pitch;
          panel(out, f, -f.w / 2, f.w / 2, y, y + 0.9, warm, 0.035);
        }
        panel(out, f, -f.w / 2, f.w / 2, 370.9, 372, silver, 0.04);
        panel(out, f, -f.w / 2, f.w / 2, 377.5, 380, silver, 0.04);
        for (const y of [61, 232, 316]) flare(out, f, y);
      }
      return;
    }
    for (const f of fronts) {
      const bay = f.w / 14;
      for (let i = 0; i < 14; i++) {
        const u0 = -f.w / 2 + i * bay,
          u1 = u0 + bay,
          g0 = u0 + 0.48,
          g1 = u1 - 0.48,
          color = i % 3 === 1 ? silver : warm;
        const windowTop = Math.abs((u0 + u1) / 2) > 9.3 ? wing : 370.9;
        panel(out, f, u0, g0, 13, windowTop, color);
        panel(out, f, g1, u1, 13, windowTop, color);
        panel(out, f, g0, g1, 13, windowTop, blue, -0.22, 'glass');
        for (const u of [g0, g1])
          face(
            out,
            'metal',
            [p(f, u, 13), p(f, u, windowTop), p(f, u, windowTop, -0.22), p(f, u, 13, -0.22)],
            silver,
          );
        for (const y of [13, windowTop])
          face(
            out,
            'metal',
            [p(f, g0, y), p(f, g1, y), p(f, g1, y, -0.22), p(f, g0, y, -0.22)],
            silver,
          );
        if (windowTop < 370.9) panel(out, f, u0, u1, windowTop, 370.9, silver);
        if (detail.frames) {
          for (const u of [g0, (g0 + g1) / 2, g1])
            panel(out, f, u - 0.045, u + 0.045, 13, windowTop, silver, -0.2);
          panel(out, f, u0 - 0.0325, u0 + 0.0325, 13, 371, silver, 0.04);
        }
        if (detail.bayBands)
          for (let row = 0; row < 94; row++) {
            const lo = 13 + row * pitch,
              hi = lo + pitch;
            if (lo >= windowTop) continue;
            panel(out, f, g0, g1, lo, lo + 0.55, color);
            panel(out, f, g0, g1, hi - 0.35, hi, color);
            for (const y of [lo + 0.55, hi - 0.35])
              face(
                out,
                'metal',
                [p(f, g0, y), p(f, g1, y), p(f, g1, y, -0.22), p(f, g0, y, -0.22)],
                silver,
              );
            if (detail.sills) sill(out, f, g0, g1, lo + 0.55);
          }
      }
      if (!detail.bayBands)
        for (let row = 0; row < 94; row += detail.rowStep) {
          const y = 13 + row * pitch;
          panel(out, f, -f.w / 2, f.w / 2, y, y + 0.55, warm);
          for (const h of [y, y + 0.55])
            face(
              out,
              'metal',
              [
                p(f, -f.w / 2, h),
                p(f, f.w / 2, h),
                p(f, f.w / 2, h, -0.22),
                p(f, -f.w / 2, h, -0.22),
              ],
              silver,
            );
        }
      panel(out, f, -f.w / 2, f.w / 2, 370.9, 372, silver);
      grid(
        out,
        [
          p(f, -f.w / 2, 372, -0.1),
          p(f, f.w / 2, 372, -0.1),
          p(f, f.w / 2, 377.5, -0.1),
          p(f, -f.w / 2, 377.5, -0.1),
        ],
        blue,
        1.45,
        2.75,
        0.05,
        silver,
        'metal',
      );
      panel(out, f, -f.w / 2, f.w / 2, 377.5, 380, silver);
      for (const y of [61, 232, 316]) flare(out, f, y);
      if (detail.wingRibs)
        for (let y = 318; y < 379; y += detail.wingPitch)
          for (const sign of [-1, 1])
            beam(
              out,
              'metal',
              p(f, sign * 9.35, y, 0.09),
              p(f, (sign * f.w) / 2, y, 0.09),
              0.105,
              0.18,
              silver,
            );
    }
  }
  function panoramicLift(out) {
    const x = 2.7,
      z = -hz - 3.05,
      width = 6.6;
    // The developer's SEA-side plan shows the pair projecting from the northeast half.
    box(
      out,
      'metal',
      [x - width / 2 - 0.12, 12.5, z - 0.1],
      [x - width / 2 + 0.12, 378, z + 0.15],
      silver,
    );
    box(
      out,
      'metal',
      [x + width / 2 - 0.12, 12.5, z - 0.1],
      [x + width / 2 + 0.12, 378, z + 0.15],
      silver,
    );
    box(out, 'metal', [x - 0.1, 12.5, z - 0.1], [x + 0.1, 378, z + 0.15], silver);
    grid(
      out,
      [
        [x + width / 2, 12.5, z],
        [x - width / 2, 12.5, z],
        [x - width / 2, 378, z],
        [x + width / 2, 378, z],
      ],
      blue,
      width / 2,
      3.6,
      0.06,
      silver,
      'metal',
    );
    for (const side of [-1, 1])
      grid(
        out,
        [
          [x + (side * width) / 2, 12.5, z],
          [x + (side * width) / 2, 12.5, -hz],
          [x + (side * width) / 2, 378, -hz],
          [x + (side * width) / 2, 378, z],
        ],
        blue,
        1.5,
        3.6,
        0.07,
        silver,
        'metal',
      );
    if (detail.liftBraces)
      for (let y = 13; y < 375; y += 7.2 * detail.braceStep) {
        const top = Math.min(377.5, y + 7.2 * detail.braceStep);
        beam(
          out,
          'metal',
          [x - width / 2, y, z - 0.13],
          [x + width / 2, top, z - 0.13],
          0.13,
          0.15,
          silver,
        );
        beam(
          out,
          'metal',
          [x + width / 2, y, z - 0.13],
          [x - width / 2, top, z - 0.13],
          0.13,
          0.15,
          silver,
        );
        beam(
          out,
          'metal',
          [x - width / 2, y, z - 0.13],
          [x + width / 2, y, z - 0.13],
          0.15,
          0.15,
          silver,
        );
      }
    box(
      out,
      'metal',
      [x - width / 2 - 0.4, 378, z - 0.35],
      [x + width / 2 + 0.4, 381, -hz + 0.15],
      silver,
    );
  }
  function seam(out, a, b, width, color, n) {
    const d = b.map((v, i) => v - a[i]),
      length = Math.hypot(...d);
    if (length < 0.00001) return;
    const v = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]].map(
      (x) => (x * width) / (2 * length),
    );
    const at = (p, side) => p.map((x, i) => x + v[i] * side);
    face(out, 'metal', [at(a, -1), at(b, -1), at(b, 1), at(a, 1)], color);
  }
  function crown(out) {
    // The built crown is a group of folded triangular fins, not occupied setback boxes.
    // Three interleaved L folds in each quadrant form four highest tips and lower shoulders.
    function blade(a, b, peak) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        length = Math.hypot(dx, dz),
        normal = [-dz / length, 0, dx / length];
      const base = [
        [a[0], 380, a[1]],
        [b[0], 380, b[1]],
        [b[0], 384, b[1]],
        [a[0], peak, a[1]],
      ];
      const front = base.map((p) => p.map((v, i) => v + normal[i] * 0.18)),
        back = base.map((p) => p.map((v, i) => v - normal[i] * 0.18));
      face(out, 'metal', front, crownBlue);
      face(out, 'metal', [...back].reverse(), crownBlue);
      for (let i = 0; i < 4; i++)
        face(out, 'metal', [front[i], back[i], back[(i + 1) % 4], front[(i + 1) % 4]], crownBlue);
      if (detail.crownSeams) beam(out, 'metal', base[3], base[2], 0.1, 0.1, [0.46, 0.61, 0.66]);
      if (detail.crownSeams) {
        for (let y = 381.5; y < peak - 0.3; y += 1.5 * detail.seamStep) {
          const t = Math.min(1, (peak - y) / (peak - 384));
          for (const side of [-1, 1])
            seam(
              out,
              [a[0] + normal[0] * side * 0.195, y, a[1] + normal[2] * side * 0.195],
              [
                a[0] + dx * t + normal[0] * side * 0.195,
                y,
                a[1] + dz * t + normal[2] * side * 0.195,
              ],
              0.04,
              [0.4, 0.56, 0.62],
              normal.map((v) => v * side),
            );
        }
        for (let k = 1; k < Math.ceil(length / (1.65 * detail.seamStep)); k++) {
          const t = k / Math.ceil(length / (1.65 * detail.seamStep)),
            height = peak + (384 - peak) * t;
          for (const side of [-1, 1])
            seam(
              out,
              [
                a[0] + dx * t + normal[0] * side * 0.195,
                380,
                a[1] + dz * t + normal[2] * side * 0.195,
              ],
              [
                a[0] + dx * t + normal[0] * side * 0.195,
                height,
                a[1] + dz * t + normal[2] * side * 0.195,
              ],
              0.02,
              [0.31, 0.48, 0.55],
              normal.map((v) => v * side),
            );
        }
      }
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        for (const [r, peak] of [
          [2.7, 425],
          [8.3, 413],
          [13.7, 400],
        ]) {
          blade([sx * r, sz * r], [sx * 19.1, sz * r], peak);
          blade([sx * r, sz * r], [sx * r, sz * 17.8], peak);
        }
        // Ties sit behind the folded cladding; the four pinnacle positions remain distinct.
        if (detail.crownBraces)
          for (let y = 382; y < 411; y += 5 * detail.braceStep) {
            beam(
              out,
              'metal',
              [sx * 2.7, y, sz * 2.7],
              [sx * 8.3, y + 3, sz * 8.3],
              0.1,
              0.1,
              silver,
            );
          }
        beam(
          out,
          'metal',
          [sx * 2.7, 380, sz * 2.7],
          [sx * 2.7, 424.7, sz * 2.7],
          0.22,
          0.22,
          silver,
        );
      }
  }
  function podium(out, m) {
    const plan = partPlan(
      m,
      partsEvidence('marina_101').find((p) => p.id === 1074877791),
    );
    mappedSolid(out, 'stone', plan, 0, 12.5, [0.43, 0.415, 0.39]);
    if (detail.podiumWindows)
      for (let i = 0; i < plan.length; i++) {
        const a = plan[i],
          b = plan[(i + 1) % plan.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          n = [-(b[1] - a[1]) / len, (b[0] - a[0]) / len];
        const at = (t, y, d = 0.04) => [
          a[0] + (b[0] - a[0]) * t + n[0] * d,
          y,
          a[1] + (b[1] - a[1]) * t + n[1] * d,
        ];
        for (let k = 0; k < Math.floor(len / 4.5); k++) {
          const count = Math.floor(len / 4.5),
            t0 = (k + 0.16) / count,
            t1 = (k + 0.84) / count;
          grid(
            out,
            [at(t0, 0.15), at(t1, 0.15), at(t1, 4.8), at(t0, 4.8)],
            blue,
            1.5,
            2.4,
            0.07,
            silver,
            'metal',
          );
          grid(
            out,
            [at(t0, 6), at(t1, 6), at(t1, 10.8), at(t0, 10.8)],
            blue,
            1.5,
            2.4,
            0.065,
            silver,
            'metal',
          );
        }
        if (detail.podiumJoints)
          for (let y = 1; y < 12.4; y += 0.8)
            beam(out, 'metal', at(0, y, 0.045), at(1, y, 0.045), 0.012, 0.014, [0.33, 0.32, 0.3]);
        beam(out, 'metal', at(0, 12.3, 0.15), at(1, 12.3, 0.15), 0.3, 0.4, silver);
      }
    if (!detail.entry) return;
    // Sea-side street portal, with a grounded canopy and separated glazing frames.
    box(out, 'metal', [-8, 4.6, -32], [10, 5.15, -27], silver);
    for (const x of [-7, 9])
      box(out, 'stone', [x - 0.25, 0, -31.3], [x + 0.25, 4.6, -30.8], [0.39, 0.38, 0.36]);
    // Enclose the transparent door leaves in a shallow street vestibule.
    // Its rear overlaps the mapped wall; side glazing, a header and a sill connect it.
    box(out, 'stone', [-4.6, 0, -30.7], [6.6, 0.12, -27.8], [0.38, 0.38, 0.36]);
    box(out, 'metal', [-4.6, 3.8, -30.6], [6.6, 4.05, -27.8], silver);
    face(
      out,
      'glass',
      [
        [-4.6, 3.8, -30.15],
        [6.6, 3.8, -30.15],
        [6.6, 0.12, -30.15],
        [-4.6, 0.12, -30.15],
      ],
      [0.09, 0.15, 0.17],
    );
    for (const x of [-4.6, 6.6]) {
      face(
        out,
        'clear_glass',
        [
          [x, 0.12, -30.48],
          [x, 0.12, -27.8],
          [x, 3.8, -27.8],
          [x, 3.8, -30.48],
        ],
        [0.62, 0.77, 0.79],
      );
      beam(out, 'metal', [x, 0.12, -30.48], [x, 3.8, -30.48], 0.09, 0.09, silver);
    }
    for (const x of [-3, 1, 5]) {
      face(
        out,
        'clear_glass',
        [
          [x - 1.4, 0.12, -30.48],
          [x + 1.4, 0.12, -30.48],
          [x + 1.4, 3.8, -30.48],
          [x - 1.4, 3.8, -30.48],
        ],
        [0.62, 0.77, 0.79],
      );
      beam(out, 'metal', [x, 0.12, -30.56], [x, 3.8, -30.56], 0.055, 0.07, silver);
      if (detail.doorHardware)
        for (const side of [-1, 1])
          beam(
            out,
            'metal',
            [x + side * 0.18, 1.1, -30.66],
            [x + side * 0.18, 2.05, -30.66],
            0.028,
            0.045,
            silver,
          );
    }
  }
  function buildNative(out, m) {
    podium(out, m);
    shaft(out);
    panoramicLift(out);
    crown(out);
  }

  buildNative(out, m);
}
const settings = {
  skyline: {
    skyline: true,
    rowStep: 8,
    flareCount: 1,
    gridStep: 8,
    frames: false,
    sills: false,
    wingRibs: false,
    liftBraces: false,
    crownSeams: false,
    crownBraces: false,
    podiumWindows: false,
    entry: false,
  },
  district: {
    rowStep: 4,
    flareCount: 4,
    gridStep: 6,
    frames: false,
    sills: false,
    wingRibs: false,
    liftBraces: true,
    braceStep: 6,
    crownSeams: false,
    crownBraces: false,
    podiumWindows: true,
    entry: true,
  },
  street: {
    rowStep: 1,
    flareCount: 14,
    gridStep: 2,
    frames: true,
    sills: false,
    wingRibs: true,
    wingPitch: 4.2,
    liftBraces: true,
    braceStep: 2,
    crownSeams: true,
    seamStep: 4,
    crownBraces: true,
    podiumWindows: true,
    entry: true,
  },
  closeup: {
    rowStep: 1,
    bayBands: true,
    flareCount: 14,
    gridStep: 1,
    frames: true,
    sills: true,
    wingRibs: true,
    wingPitch: 2.1,
    liftBraces: true,
    braceStep: 1,
    crownSeams: true,
    seamStep: 1,
    crownBraces: true,
    podiumWindows: true,
    podiumJoints: false,
    entry: true,
    doorHardware: true,
  },
};
function build(out, name) {
  const means = { metal: [0.908889, 0.908889, 0.908889], stone: [0.701109, 0.701109, 0.701109] };
  const target = {
    detail: settings[name],
    ...Object.fromEntries(
      ['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [
        k,
        (slot, r, p, n, uv, c) =>
          name === 'skyline'
            ? out[k](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                means[slot] ? c.map((v, i) => v * means[slot][i]) : c,
              )
            : out[k](slot, r, p, n, uv, c),
      ]),
    ),
  };
  render(target, frame);
}
export const buildMarina101ReviewedMaster = (out) => build(out, 'closeup');
export const buildMarina101Skyline = (out) => build(out, 'skyline');
export const buildMarina101District = (out) => build(out, 'district');
export const buildMarina101Street = (out) => build(out, 'street');
export const buildMarina101Closeup = (out) => build(out, 'closeup');
