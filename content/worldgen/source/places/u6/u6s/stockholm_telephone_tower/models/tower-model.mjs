/** The 1887 Brunkeberg exchange and its lattice crown in the telephone-wire era. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92 },
  trim: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.86 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.81, metallic: 0.2 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.48 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
};
const tone = {
  brick: [0.57, 0.34, 0.268],
  darkBrick: [0.435, 0.268, 0.218],
  redBrick: [0.67, 0.43, 0.32],
  sand: [0.73, 0.59, 0.44],
  sandLight: [0.87, 0.73, 0.55],
  iron: [0.245, 0.232, 0.212],
  deep: [0.185, 0.174, 0.166],
  edge: [0.31, 0.296, 0.259],
  blue: [0.195, 0.266, 0.274],
  glaze: [0.26, 0.333, 0.342],
  roof: [0.36, 0.38, 0.355],
  slate: [0.26, 0.278, 0.268],
  pale: [0.68, 0.69, 0.635],
  gold: [0.58, 0.43, 0.24],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const roofY = 23.65,
  top = roofY + 22.5,
  halfX = 14.3 / 2,
  halfZ = 16.5 / 2,
  tau = 2 * Math.PI;
const up = [0, 1, 0],
  mix = (a, b, t) => a + (b - a) * t;
function triangle(out, slot, color, points, normal) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.9) return;
  if (n.reduce((s, x, i) => s + x * normal[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((x) => -x);
  }
  out.addTriangle(slot, '', points, n, undefined, tone[color]);
}
function quad(out, slot, color, [a, b, c, d], normal) {
  triangle(out, slot, color, [a, b, c], normal);
  triangle(out, slot, color, [a, c, d], normal);
}
function cap(out, slot, color, x, z, a, b, n, rings) {
  loft(
    out,
    slot,
    rings.map(([h, rx, rz]) => radialRing(h, rx, rz, n, [x, z], a)),
    tone[color],
    { cap: b },
  );
}
function sheet(out, s, slot, color, x, y, w, h, back) {
  const p = (a, b) => [x + a, y + b, s * back],
    N = [0, 0, s];
  quad(out, slot, color, [p(-w / 2, 0), p(w / 2, 0), p(w / 2, h), p(-w / 2, h)], N);
}
function facade(out, s, d, half, depth) {
  const N = [0, 0, s],
    Z = s * depth;
  const h = s === 1 ? 18.82 : 18.65;
  sheet(out, s, 'brick', 'brick', 0, -2.1, 2 * half, h + 2.1, depth);
  for (const [y, height, ext] of [
    [0.47, 0.45, 0.17],
    [4.5, 0.22, 0.14],
    [8.84, 0.18, 0.18],
    [13.04, 0.47, 0.24],
    [18.34, 0.39, 0.29],
  ]) {
    const y1 = y + height;
    sheet(out, s, 'trim', 'sand', 0, y, 2 * (half + ext), height, depth + ext);
    quad(
      out,
      'trim',
      'sandLight',
      [
        [-half - ext, y1, Z],
        [-half - ext, y1, s * (depth + ext)],
        [half + ext, y1, s * (depth + ext)],
        [half + ext, y1, Z],
      ],
      up,
    );
  }
  const portal = (x, y, w, H, distance) => {
    const rowCount = d >= 3 ? 11 : d >= 2 ? 7 : 4,
      p = (x, y) => [x, y, s * distance],
      base = y + H * 0.78,
      r = H * 0.22;
    sheet(out, s, 'glass', 'blue', x, y, w, H * 0.78, distance);
    let previous = p(x + w / 2, base);
    for (let i = 1; i <= rowCount; i++) {
      const theta = (Math.PI * i) / rowCount,
        next = p(x + (w / 2) * Math.cos(theta), base + r * Math.sin(theta));
      triangle(out, 'glass', 'glaze', [p(x, base), previous, next], N);
      if (d >= 2) {
        const t = (Math.PI * (i - 1)) / rowCount;
        quad(
          out,
          'trim',
          i % 2 ? 'sand' : 'sandLight',
          [
            previous,
            next,
            p(x + (w / 2 + 0.16) * Math.cos(theta), base + (r + 0.15) * Math.sin(theta)),
            p(x + (w / 2 + 0.16) * Math.cos(t), base + (r + 0.15) * Math.sin(t)),
          ],
          N,
        );
      }
      previous = next;
    }
    if (d >= 1) {
      for (const u of [-0.5, 0, 0.5])
        sheet(
          out,
          s,
          'trim',
          'sand',
          x + u * w,
          y,
          0.079,
          H * (u === 0 ? 0.95 : 0.78),
          distance + 0.014,
        );
      sheet(out, s, 'trim', 'sand', x, y + H * 0.65, w, 0.068, distance + 0.014);
      sheet(out, s, 'trim', 'sandLight', x, y - 0.16, w + 0.24, 0.13, distance + 0.12);
    }
  };
  const bays = s === 1 ? 7 : 8;
  for (let i = 0; i < bays; i++) {
    const x = mix(-half + 1.4, half - 1.4, i / (bays - 1)),
      door = i === (s === 1 ? 0 : 7) || i === (s === 1 ? 6 : 1);
    for (const [y, h, w] of [
      [1.12, 2.9, 1.76],
      [5.22, 2.8, 1.61],
      [9.74, 2.53, 1.49],
    ]) {
      if (d === 0) sheet(out, s, 'glass', 'blue', x, y, w, h * 0.91, depth + 0.012);
      else
        portal(
          x,
          y === 1.12 && door ? 0.23 : y,
          w,
          y === 1.12 && door ? h + 0.77 : h,
          depth + 0.012,
        );
    }
  }
  for (const x of [-half * 0.74, 0, half * 0.74]) {
    const w = x === 0 ? 3.4 : 2.86,
      z = depth + 0.39;
    sheet(out, s, 'brick', 'darkBrick', x, 12.24, w, 5.6, z);
    triangle(
      out,
      'brick',
      'redBrick',
      [
        [x - w * 0.56, 17.84, s * z],
        [x + w * 0.56, 17.84, s * z],
        [x, 20.04 + (x === 0 ? 0.54 : 0), s * z],
      ],
      N,
    );
    if (d === 0) sheet(out, s, 'glass', 'blue', x, 13.64, 1.65, 3.12, z + 0.023);
    else portal(x, 13.64, 1.65, 3.12, z + 0.023);
    if (d >= 1) {
      const p = [x, 20.1 + (x === 0 ? 0.58 : 0), s * (z + 0.07)],
        a = [x - w * 0.58, 17.82, p[2]],
        b = [x + w * 0.58, 17.82, p[2]];
      beam(out, 'trim', a, p, 0.18, 0.16, tone.sandLight);
      beam(out, 'trim', p, b, 0.18, 0.16, tone.sandLight);
      beam(out, 'trim', p, [x, p[1] + 0.71, p[2]], 0.14, 0.13, tone.sand);
    }
  }
  if (d >= 1)
    for (let j = 0; j < (d === 1 ? 15 : 30); j++) {
      const x = mix(-half + 0.19, half - 0.19, j / (d === 1 ? 14 : 29));
      box(out, 'trim', [x - 0.106, 12.89, Z - 0.21], [x + 0.106, 13.17, Z + 0.21], tone.sand);
    }
}
function exchange(out, d) {
  const { width, back, front, zCenter } = layout.house,
    west = width / 2;
  const e = 18.8;
  facade(out, 1, d, west, front);
  facade(out, -1, d, back / 2, -zCenter + front);
  // Two shallow light wells in the long side walls, visible in the Åskslaget lot plan.
  for (const s of [-1, 1]) {
    const n = [s, 0, 0],
      p = (x, y, z) => [s * x, y, z];
    const zmin = zCenter - front,
      zmax = front;
    const segments = [
      [zmin, zmin + 13.7, west],
      [zmin + 13.7, zmin + 19.9, west - 3.85],
      [zmin + 19.9, zmax, west],
    ];
    for (const [a, b, x] of segments) {
      quad(out, 'brick', 'brick', [p(x, -2.1, a), p(x, -2.1, b), p(x, e, b), p(x, e, a)], n);
      for (const [y, h] of [
        [0.5, 0.27],
        [4.6, 0.2],
        [9.05, 0.18],
        [13.1, 0.21],
        [18.3, 0.37],
      ])
        quad(
          out,
          'trim',
          'sand',
          [p(x + 0.12, y, a), p(x + 0.12, y, b), p(x + 0.12, y + h, b), p(x + 0.12, y + h, a)],
          n,
        );
      if (d >= 1) {
        const count = Math.floor((b - a) / 2.7);
        for (let j = 0; j < count; j++)
          for (const y of [2, 6, 10, 14.15]) {
            const q = mix(a + 0.45, b - 0.45, (j + 0.5) / count);
            quad(
              out,
              'glass',
              'blue',
              [
                p(x + 0.018, y, q - 0.49),
                p(x + 0.018, y, q + 0.49),
                p(x + 0.018, y + 1.88, q + 0.49),
                p(x + 0.018, y + 1.88, q - 0.49),
              ],
              n,
            );
            if (d >= 2)
              quad(
                out,
                'trim',
                'sandLight',
                [
                  p(x + 0.04, y, q - 0.036),
                  p(x + 0.04, y, q + 0.036),
                  p(x + 0.04, y + 1.88, q + 0.036),
                  p(x + 0.04, y + 1.88, q - 0.036),
                ],
                n,
              );
          }
      }
    }
    for (const [z, n] of [
      [zmin + 13.7, 1],
      [zmin + 19.9, -1],
    ]) {
      quad(
        out,
        'brick',
        'darkBrick',
        [p(west - 3.85, -2.1, z), p(west, -2.1, z), p(west, e, z), p(west - 3.85, e, z)],
        [0, 0, n],
      );
    }
    const z0 = zmin - 0.23,
      z1 = front + 0.23,
      x = s * (west + 0.18),
      h = 23.4;
    quad(
      out,
      'roof',
      'slate',
      [
        [x, e, z0],
        [x, e, z1],
        [0, h, z1 - 4.1],
        [0, h, z0 + 4.1],
      ],
      up,
    );
    if (d >= 2)
      for (let i = 0; i < 23; i++) {
        const t = i / 22,
          z = mix(z0, z1, t);
        beam(
          out,
          'roof',
          [x, e + 0.035, z],
          [0, h + 0.045, mix(z0 + 4.1, z1 - 4.1, t)],
          0.034,
          0.039,
          tone.roof,
        );
      }
  }
  for (const s of [-1, 1]) {
    const z = s === 1 ? front + 0.23 : zCenter - front - 0.23,
      r = z + (s === 1 ? -4.1 : 4.1);
    triangle(
      out,
      'roof',
      'roof',
      [
        [-west - 0.18, e, z],
        [west + 0.18, e, z],
        [0, 23.4, r],
      ],
      up,
    );
  }
  // The tower bears on a rectangular raised iron platform above the apparatus hall.
  box(
    out,
    'roof',
    [-halfX - 0.25, 22.72, -halfZ - 0.24],
    [halfX + 0.25, roofY, halfZ + 0.24],
    tone.slate,
  );
  for (const x of [-halfX, halfX])
    for (const z of [-halfZ, halfZ]) {
      box(out, 'brick', [x - 0.5, 18.49, z - 0.49], [x + 0.5, 22.78, z + 0.49], tone.darkBrick);
      box(out, 'trim', [x - 0.61, 22.49, z - 0.59], [x + 0.61, 22.76, z + 0.59], tone.sand);
    }
  if (d >= 1)
    for (const [x, z] of [
      [-4.5, -13.7],
      [4.8, -14.5],
      [-5.3, 12.0],
      [5.33, 10.96],
    ]) {
      box(out, 'brick', [x - 0.49, 21.45, z - 0.48], [x + 0.49, 25.73, z + 0.48], tone.darkBrick);
      box(out, 'trim', [x - 0.58, 25.57, z - 0.58], [x + 0.58, 25.87, z + 0.58], tone.sand);
    }
}
function facadePoint(side, u, y) {
  return side === 0
    ? [u, y, halfZ]
    : side === 1
      ? [halfX, y, -u]
      : side === 2
        ? [-u, y, -halfZ]
        : [-halfX, y, u];
}
function lattice(out, d) {
  const sections = [0, 3.82, 6.66, 9.46, 12.28, 15.1, 17.94, 20.72, 22.5].map((y) => y + roofY);
  for (let side = 0; side < 4; side++) {
    const w = side % 2 ? halfZ : halfX,
      P = (x, y) => facadePoint(side, x, y);
    const strut = (x, y, u, v, width, color = 'iron') => {
      if (d >= 2) beam(out, 'iron', P(x, y), P(u, v), width, width, tone[color]);
      else {
        const len = Math.hypot(u - x, v - y),
          dx = ((v - y) * width) / len / 2,
          dy = ((x - u) * width) / len / 2;
        const normal =
          side === 0 ? [0, 0, 1] : side === 1 ? [1, 0, 0] : side === 2 ? [0, 0, -1] : [-1, 0, 0];
        const p = [P(x - dx, y - dy), P(u - dx, v - dy), P(u + dx, v + dy), P(x + dx, y + dy)];
        quad(out, 'iron', color, p, normal);
        quad(
          out,
          'iron',
          color,
          p,
          normal.map((v) => -v),
        );
      }
    };
    const columns = d === 0 ? 3 : 5;
    for (let i = 0; i < columns; i++) {
      const u = mix(-w, w, i / (columns - 1));
      if (i === columns - 1) continue;
      strut(u, roofY, u, top, i === 0 || i === columns - 1 ? 0.234 : 0.155);
    }
    for (const [j, y] of sections.entries()) {
      const low = j === 0 ? roofY : sections[j - 1];
      strut(-w, y, w, y, d === 0 ? 0.22 : 0.205, 'edge');
      if (j === 0) continue;
      const bays = d === 0 ? 1 : d === 1 ? 2 : 4;
      for (let i = 0; i < bays; i++) {
        const a = mix(-w, w, i / bays),
          b = mix(-w, w, (i + 1) / bays);
        strut(a, low, b, y, 0.101, 'iron');
        if (d > 0 || j % 2 === 0) strut(b, low, a, y, 0.096, 'iron');
      }
      if (d >= 2 && j >= 2) {
        const bars = d === 2 ? 2 : 4;
        for (let i = 1; i <= bars; i++)
          strut(-w, mix(low, y, i / (bars + 1)), w, mix(low, y, i / (bars + 1)), 0.045, 'iron');
        if (d >= 3) {
          for (let i = 0; i < 16; i++) {
            const u = mix(-w, w, i / 16),
              v = mix(-w, w, (i + 1) / 16),
              m = (u + v) / 2;
            strut(u, y, m, y - 0.29, 0.04, 'edge');
            strut(m, y - 0.29, v, y, 0.04, 'edge');
          }
        }
      }
    }
    const rail = top + 0.82;
    strut(-w, rail, w, rail, 0.095, 'edge');
    if (d >= 1)
      for (let i = 0; i < 9; i++) {
        const x = mix(-w + 0.25, w - 0.25, i / 8),
          r = 0.285;
        strut(x, top, x, rail + 0.35, 0.083);
        if (d >= 3)
          beamPath(
            out,
            'iron',
            Array.from({ length: 13 }, (_, i) =>
              P(x + r * Math.cos((tau * i) / 12), top + 0.41 + r * Math.sin((tau * i) / 12)),
            ),
            0.041,
            0.049,
            tone.edge,
          );
      }
    if (d >= 2)
      for (let j = 2; j < sections.length - 1; j++) {
        const low = sections[j - 1],
          high = sections[j],
          n = d === 4 ? 22 : d === 3 ? 13 : 5;
        for (let i = 0; i < n; i++) {
          const u = mix(-w + 0.36, w - 0.36, i / (n - 1)),
            y = mix(low, high, 0.59);
          const p = P(u, y),
            q = P(u, y + 0.115);
          beam(out, 'iron', p, q, 0.063, 0.055, tone.pale);
          if (d >= 3 && j >= 5 && i % 2 === 0) {
            const along = P(u, y + 0.126),
              r = P(u, y + 0.066);
            along[0] *= 1 + (d === 4 ? 0.16 : 0.095);
            along[2] *= 1 + (d === 4 ? 0.16 : 0.095);
            beam(out, 'iron', r, along, 0.022, 0.025, tone.edge);
          }
        }
      }
  }
}
function crown(out, d) {
  for (const x of [-halfX, halfX])
    for (const z of [-halfZ, halfZ]) {
      const n = d === 0 ? 6 : d === 1 ? 6 : d === 2 ? 9 : 14;
      const base = top - 6.5,
        end = top + 2.8;
      const profile = [
        [base, 0.25, 0.25],
        [base + 0.34, 0.51, 0.51],
        [base + 0.61, 0.72, 0.72],
        [top + 1.9, 0.71, 0.71],
        [end - 0.46, 1.01, 1.01],
        [end, 1.09, 1.09],
      ];
      if (d <= 1) {
        cap(
          out,
          'iron',
          'deep',
          x,
          z,
          0,
          true,
          n,
          d === 0 ? [profile[0], profile[2], profile[3], profile.at(-1)] : profile,
        );
      } else {
        for (const [y, r] of [
          [base + 0.61, 0.72],
          [top - 0.24, 0.76],
          [top + 1.83, 0.73],
          [end - 0.39, 1.01],
          [end, 1.09],
        ]) {
          const spiral = Array.from({ length: n + 1 }, (_, i) => [
            x + r * Math.cos((tau * i) / n),
            y,
            z + r * Math.sin((tau * i) / n),
          ]);
          beamPath(out, 'iron', spiral, 0.085, 0.082, tone.edge);
        }
        for (let i = 0; i < n; i++) {
          const a = (tau * i) / n,
            c = Math.cos(a),
            s = Math.sin(a);
          beamPath(
            out,
            'iron',
            [
              [x + 0.7 * c, base + 0.52, z + 0.7 * s],
              [x + 0.72 * c, top + 1.65, z + 0.72 * s],
              [x + 1.04 * c, end, z + 1.04 * s],
            ],
            0.068,
            0.074,
            tone.iron,
          );
          if (d >= 2)
            beam(
              out,
              'iron',
              [x + 1.03 * c, end, z + 1.03 * s],
              [x + 1.24 * c, end + 0.38, z + 1.24 * s],
              0.063,
              0.064,
              tone.edge,
            );
        }
        cap(out, 'iron', 'deep', x, z, 0, true, n, [
          [base - 0.49, 0.145, 0.145],
          [base - 0.13, 0.22, 0.22],
          [base + 0.08, 0.42, 0.42],
          [base + 0.45, 0.12, 0.12],
        ]);
      }
      const mast = end + 6.15;
      beam(
        out,
        'iron',
        [x, end - 0.08, z],
        [x, mast, z],
        d === 0 ? 0.132 : 0.102,
        0.109,
        tone.iron,
      );
      if (d >= 1) {
        cap(out, 'iron', 'edge', x, z, 0, true, n, [
          [end + 1.06, 0.18, 0.18],
          [end + 1.28, 0.25, 0.25],
          [end + 1.54, 0.087, 0.087],
        ]);
        cap(out, 'iron', 'edge', x, z, 0, true, n, [
          [mast - 0.61, 0.084, 0.084],
          [mast - 0.48, 0.21, 0.21],
          [mast - 0.38, 0.22, 0.22],
          [mast - 0.2, 0.077, 0.077],
        ]);
      }
      if (d >= 2)
        for (const [u, v] of [
          [-0.32, 0],
          [0.32, 0],
          [0, -0.32],
          [0, 0.32],
        ])
          beam(
            out,
            'iron',
            [x + u, end + 0.04, z + v],
            [x, end + 1.03, z],
            0.055,
            0.055,
            tone.iron,
          );
    }
}
export function buildTowerLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error('Unknown telephone tower detail level');
  exchange(out, d);
  lattice(out, d);
  crown(out, d);
}
export const buildSkyline = (out) => buildTowerLevel(out, 'skyline');
export const buildDistrict = (out) => buildTowerLevel(out, 'district');
export const buildStreet = (out) => buildTowerLevel(out, 'street');
export const buildCloseup = (out) => buildTowerLevel(out, 'closeup');
export const buildMaster = (out) => buildTowerLevel(out, 'master');
