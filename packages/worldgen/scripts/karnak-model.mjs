/** Karnak Amun core and eastern temples. Wider precinct remains an explicit draft. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildKarnakEast, karnakEastCandidateId } from './karnak-east-model.mjs';
import { buildKarnakMut, karnakMutCandidateId } from './karnak-mut-model.mjs';
import { buildKarnakNorth, karnakNorthCandidateId } from './karnak-north-model.mjs';
import {
  buildKarnakPtahTaharqa,
  karnakPtahTaharqaCandidateId,
} from './karnak-ptah-taharqa-model.mjs';
import { buildKarnakSouth, karnakSouthCandidateId } from './karnak-south-model.mjs';
import { buildKarnakWest, karnakWestCandidateId } from './karnak-west-model.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/ss/ssx/n0489_karnak_temple_complex/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  rec = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  fit = read('pmtiles-fit.json');
let foundations;
if (frame.candidateId !== karnakEastCandidateId) throw new Error('Karnak source identity changed');
if (frame.candidateId !== karnakSouthCandidateId)
  throw new Error('Karnak southern identity changed');
if (frame.candidateId !== karnakWestCandidateId) throw new Error('Karnak western identity changed');
if (frame.candidateId !== karnakPtahTaharqaCandidateId)
  throw new Error('Karnak small-temple identity changed');
if (frame.candidateId !== karnakNorthCandidateId)
  throw new Error('Karnak northern identity changed');
if (frame.candidateId !== karnakMutCandidateId) throw new Error('Karnak Mut identity changed');
const linear = (hex) =>
  hex.match(/../g).map((v) => {
    const q = parseInt(v, 16) / 255;
    return q <= 0.04045 ? q / 12.92 : Math.pow((q + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: linear('c9ab84'),
  stone: linear('ccb08d'),
  granite: linear('aa8d80'),
  water: linear('3b696b'),
  flat: linear('b6a27e'),
};
export function karnakGrade(name, x, z) {
  const grade = rec.integrationGrades?.groups[name];
  if (!grade) return 0;
  if (grade.terrain) return karnakGround(x, z);
  if (!grade.stations) return grade.offset;
  if (grade.axis) z = (x - grade.origin[0]) * grade.axis[0] + (z - grade.origin[1]) * grade.axis[1];
  const stations = grade.stations;
  if (z <= stations[0][0]) return stations[0][1];
  for (let i = 1; i < stations.length; i++)
    if (z <= stations[i][0]) {
      const [a, h] = stations[i - 1],
        [b, k] = stations[i];
      return h + ((k - h) * (z - a)) / (b - a);
    }
  return stations.at(-1)[1];
}
export function karnakGround(x, z) {
  const c = Math.cos(rec.axisAngleRadians),
    s = Math.sin(rec.axisAngleRadians),
    g = fit.grid,
    p = [fit.modelOrigin[0] + x * c - z * s, fit.modelOrigin[1] + x * s + z * c],
    u = (p[0] - g.origin[0]) / g.stepMeters,
    v = (p[1] - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  if (i < 0 || j < 0 || i >= g.width - 1 || j >= g.height - 1)
    throw Error('Karnak grade outside retained DEM');
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, detail, posed = true, grade = 'core') {
  const face = (role, points, target, tint) => {
    // At skyline distance omit buried slab skirts as well as their bottom caps.
    if (detail === 0 && target?.[1] <= 0 && points.every((p) => p[1] <= rec.floorY + 0.02)) return;
    if (
      target?.[1] < -0.5 &&
      (detail === 0 || (detail < 3 && points.every((p) => p[1] <= rec.floorY + 0.02)))
    )
      return;
    const baseY = Math.min(...points.map((p) => p[1])),
      topY = Math.max(...points.map((p) => p[1]));
    const seatSkirt =
      posed &&
      detail > 0 &&
      detail < 3 &&
      Math.abs(target?.[1] ?? 1) < 0.1 &&
      baseY < rec.floorY - 0.05 &&
      topY >= rec.floorY - 0.00001 &&
      topY <= rec.floorY + 1.36 &&
      // Extend flat slab bottoms without moving stair/ramp top vertices.
      points.every((p) => Math.abs(p[1] - baseY) < 1e-8 || Math.abs(p[1] - topY) < 1e-8);
    let p = points.map(([x, y, z]) => {
      let height = y + (posed ? karnakGrade(grade, x, z) : 0);
      if (seatSkirt && Math.abs(y - baseY) < 1e-8)
        height = Math.min(height, karnakGround(x, z) - 0.2);
      return [x, height, z].map(Math.fround);
    });
    const col = tint ?? palette[role],
      color = detail === 0 ? col.map((v, k) => v * (means[role]?.[k] ?? 1)) : col;
    for (let i = 1; i < p.length - 1; i++) {
      const n = normalFor(p[0], p[i], p[i + 1]);
      if (Math.hypot(...n) < 0.5) continue;
      if (target && n.reduce((s, v, k) => s + v * target[k], 0) < 0) p = p.toReversed();
      break;
    }
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        role,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
  face.withGrade = (name) => writer(out, detail, posed, name);
  return face;
}
function box(f, role, x, y, z, w, h, d, tint) {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - d / 2,
    e = z + d / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, c],
        [a, t, c],
        [a, t, e],
        [a, y, e],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, c],
        [b, t, c],
        [b, t, e],
        [b, y, e],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, t, c],
        [a, t, c],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, e],
        [b, y, e],
        [b, t, e],
        [a, t, e],
      ],
      [0, 0, 1],
    ],
    [
      [
        [a, t, c],
        [b, t, c],
        [b, t, e],
        [a, t, e],
      ],
      [0, 1, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, y, e],
        [a, y, e],
      ],
      [0, -1, 0],
    ],
  ])
    f(role, p, n, tint);
}
/** Watertight battered wing with a picture-guided broken top, not carved micro-blocks. */
function pylon(f, x, z0, z1, depth, heights, d) {
  const floor = rec.floorY,
    bottom = floor - 0.8,
    count = d <= 1 ? 1 : heights.length - 1;
  const p = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      h = heights[Math.round(t * (heights.length - 1))],
      z = z0 + (z1 - z0) * t;
    return { z, h };
  });
  const front = (z, h) => [x - depth / 2 + h * 0.055, floor + h, z],
    back = (z, h) => [x + depth / 2 - h * 0.055, floor + h, z];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i];
    f(
      'wall',
      [
        [x - depth / 2, bottom, a.z],
        [x - depth / 2, bottom, b.z],
        front(b.z, b.h),
        front(a.z, a.h),
      ],
      [-1, 0, 0],
    );
    f(
      'wall',
      [[x + depth / 2, bottom, a.z], [x + depth / 2, bottom, b.z], back(b.z, b.h), back(a.z, a.h)],
      [1, 0, 0],
    );
    f('stone', [front(a.z, a.h), front(b.z, b.h), back(b.z, b.h), back(a.z, a.h)], [0, 1, 0]);
    f(
      'wall',
      [
        [x - depth / 2, bottom, a.z],
        [x + depth / 2, bottom, a.z],
        [x + depth / 2, bottom, b.z],
        [x - depth / 2, bottom, b.z],
      ],
      [0, -1, 0],
    );
  }
  for (const [q, n] of [
    [p[0], [0, 0, -1]],
    [p.at(-1), [0, 0, 1]],
  ])
    f(
      'wall',
      [[x - depth / 2, bottom, q.z], [x + depth / 2, bottom, q.z], back(q.z, q.h), front(q.z, q.h)],
      n,
    );
  if (d >= 3) {
    // Four shallow flagstaff recess strips per wing; broad color differences only.
    const tint = palette.wall.map((v) => v * 0.83),
      h = Math.min(...heights) * 0.72;
    for (let i = 1; i <= 4; i++) {
      const z = z0 + ((z1 - z0) * i) / 5,
        b = floor + 0.8,
        t = floor + h;
      f(
        'stone',
        [
          [x - depth / 2 + 0.055 * 0.8 - 0.018, b, z - 0.38],
          [x - depth / 2 + 0.055 * 0.8 - 0.018, b, z + 0.38],
          [x - depth / 2 + 0.055 * h - 0.018, t, z + 0.38],
          [x - depth / 2 + 0.055 * h - 0.018, t, z - 0.38],
        ],
        [-1, 0, 0],
        tint,
      );
    }
  }
}
function lathe(f, x, z, profile, n, role = 'stone', tint) {
  // Small remote shafts remain distinct; their radius error stays below the street allowance.
  if (n === 4) n = 3;
  const point = (i, p) => [
    x + Math.cos((i * Math.PI * 2) / n) * p[1],
    rec.floorY + p[0],
    z + Math.sin((i * Math.PI * 2) / n) * p[1],
  ];
  for (let k = 1; k < profile.length; k++)
    for (let i = 0; i < n; i++)
      f(
        role,
        [
          point(i, profile[k - 1]),
          point(i + 1, profile[k - 1]),
          point(i + 1, profile[k]),
          point(i, profile[k]),
        ],
        [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
        tint,
      );
  for (const [k, sign] of [
    [0, -1],
    [profile.length - 1, 1],
  ]) {
    if (n <= 8) {
      // Planar distant caps need n-2 triangles, rather than a redundant center fan.
      f(
        role,
        Array.from({ length: n }, (_, i) => point(i, profile[k])),
        [0, sign, 0],
        tint,
      );
      continue;
    }
    for (let i = 0; i < n; i++)
      f(
        role,
        [[x, rec.floorY + profile[k][0], z], point(i, profile[k]), point(i + 1, profile[k])],
        [0, sign, 0],
        tint,
      );
  }
}
function column(f, x, z, tall, d, index = 0) {
  const n = d === 2 && !tall ? 4 : [4, 6, 6, 12, 16][d],
    h = tall ? 21.5 : 12.8,
    r = tall ? 2.08 : 1.42,
    top = tall ? 3.25 : 1.92;
  const tint = palette.stone.map((v) => v * (0.94 + (index % 5) * 0.022));
  if (d === 1) {
    box(f, 'stone', x, rec.floorY, z, tall ? 5.5 : 3.5, h, tall ? 5.5 : 3.5, tint);
    return;
  }
  const profile =
    d < 3
      ? [
          [0, r],
          [h * 0.88, r * 0.9],
          [h, top],
        ]
      : [
          [0, r * 1.18],
          [0.45, r * 1.18],
          [0.65, r],
          [h * 0.72, r * 0.91],
          [h * 0.86, r * 0.93],
          [h * 0.96, top],
          [h, top],
        ];
  lathe(f, x, z, profile, n, 'stone', tint);
  if (d >= 3 && tall) box(f, 'stone', x, rec.floorY + h, z, 5.1, 0.55, 5.1, tint);
}
function hall(f, d) {
  const y = rec.floorY;
  // Open axial passage stays clear; these are the two broken enclosing pylon wings.
  pylon(f, -29.4, -66.9, -17.2, 10.8, [14, 17, 16, 18, 17.5, 15.7], d);
  pylon(f, -29.7, -7.8, 31.1, 10.3, [16.5, 18, 19.1, 17.8, 15.4, 13.8], d);
  pylon(f, 35.8, -57.7, -13.4, 9.3, [14.2, 15.8, 15.2, 13.5, 15, 12], d);
  pylon(f, 35.5, -6.3, 34.4, 9.3, [12.7, 15, 15.5, 14.7, 12.5], d);
  box(f, 'wall', 2.5, y - 0.5, -60.2, 57, 7.3, 2.8);
  box(f, 'wall', 2.5, y - 0.5, 35.1, 57, 7.7, 2.8);
  const xs = Array.from({ length: 9 }, (_, i) => -20 + i * 5.65),
    north = Array.from({ length: 7 }, (_, j) => -54 + j * 4.65),
    south = Array.from({ length: 7 }, (_, j) => 2 + j * 4.65);
  if (d === 0) {
    for (const zs of [north, south]) box(f, 'stone', 2.6, y, zs[3], 49, 12.8, 3.3);
    for (const x of [21]) for (const z of [-17.1, -4.7]) box(f, 'stone', x, y, z, 4.1, 21.5, 4.1);
    return;
  }
  for (let side = 0; side < 2; side++)
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 9; i++) {
        if (((j === 0 && side === 0) || (j === 6 && side === 1)) && (i === 0 || i === 8)) continue;
        // District keeps alternate lines while preserving the main aisle and forest depth.
        if (d === 1 && (![0, 6].includes(j) || ![0, 4, 8].includes(i))) continue;
        column(f, xs[i], (side ? south : north)[j], false, d, i + j * 9 + side * 63);
      }
  const main = Array.from({ length: 6 }, (_, i) => -19 + i * 8.8);
  for (let i = 0; i < main.length; i++) {
    if (d === 1 && ![0, 4].includes(i)) continue;
    for (const z of [-17.1, -4.7]) column(f, main[i], z, true, d);
  }
  for (const z of [-17.1, -4.7]) box(f, 'stone', 3, y + 21.5, z, 49, 1.6, 3.5);
  if (d >= 2) {
    // Selected extant cross-beams/roof strips; no solid roof above the entire hall.
    for (let j = 0; j < 7; j++) {
      const z = south[j];
      box(f, 'stone', 8.2, y + 12.8, z, 38.5, 1.15, 2.7);
      if (j === 0 || j === 3 || j === 6) box(f, 'stone', 7.2, y + 12.8, north[j], 25, 1.15, 2.7);
    }
    for (let i = 1; i < 9; i += 2) box(f, 'stone', xs[i], y + 13.95, 16, 2.4, 0.8, 31);
    for (let i = 0; i < 6; i++) {
      const x = main[i];
      box(f, 'stone', x, y + 23.1, -10.9, 3.2, 1.25, 15.7);
      for (const z of [-22, -0.1]) box(f, 'stone', x, y + 14, z, 2.3, 6.8, 1.5);
    }
    for (let i = 0; i < 5; i++)
      for (const z of [-22, -0.1])
        box(f, 'stone', (main[i] + main[i + 1]) / 2, y + 20.8, z, 8.8, 1.2, 1.7);
  }
}
function shrine(f, d) {
  const y = rec.floorY;
  if (d === 0) {
    return;
  }
  // Three shrine door openings remain real geometry gaps, at the mapped 5m height.
  box(f, 'wall', -116.4, y, -42.4, 2.4, 5, 15.8);
  box(f, 'wall', -107.1, y, -50, 19, 5, 1.7);
  box(f, 'wall', -107.1, y, -34.9, 19, 5, 1.7);
  for (const z of [-47.5, -42.4, -37.3]) {
    box(f, 'wall', -97.8, y, z - 1.85, 1.8, 4.5, 1.1);
    box(f, 'wall', -97.8, y, z + 1.85, 1.8, 4.5, 1.1);
    box(f, 'stone', -97.8, y + 3.25, z, 2, 1.75, 4.6);
  }
  box(f, 'stone', -107.5, y + 5, -42.4, 21, 0.7, 17);
  if (d >= 2) for (const z of [-45, -39.8]) box(f, 'wall', -107.5, y, z, 17, 4.8, 1);
}
function ramesses(f, d) {
  const y = rec.floorY,
    x = -68;
  if (d === 0) {
    for (const a of [-76, -60]) box(f, 'wall', a, y, 23, 8.9, 9.4, 4.3);
    box(f, 'wall', x, y, 65.7, 23, 7, 28.4);
    return;
  }
  // South chapel: entrance pylon, open peristyle court, roofed rear sanctuary ranges.
  box(f, 'wall', -80.1, y, 52.4, 1.8, 6.3, 60);
  box(f, 'wall', -55.6, y, 52.4, 1.8, 6.3, 60);
  box(f, 'wall', -68, y, 80.7, 24.8, 7, 1.8);
  for (const a of [-76, -60]) box(f, 'wall', a, y, 23, 8.9, 9.4, 4.3);
  box(f, 'stone', x, y + 7.1, 23, 6.8, 2.3, 4.4);
  box(f, 'wall', x, y, 65.7, 23, 7, 28.4);
  // Open door through the rear mass is represented by a recessed portico, not an interior.
  for (const a of [-75, -61]) box(f, 'stone', a, y, 50.5, 7.4, 6.4, 2.2);
  box(f, 'stone', x, y + 4.6, 50.5, 7, 1.8, 2.2);
  if (d >= 1) {
    const count = d === 1 ? 3 : 5;
    for (let i = 0; i < count; i++)
      for (const a of [-76.2, -59.7]) {
        const z = 29 + i * (17 / (count - 1));
        if (d === 1) {
          box(f, 'stone', a, y, z, 2.5, 6.4, 2.5);
          continue;
        }
        lathe(
          f,
          a,
          z,
          [
            [0, 1.12],
            [5.7, 0.95],
            [6.4, 1.4],
          ],
          [4, 6, 4, 12, 12][d],
        );
        if (d >= 2) {
          // Coarse standing Osiride piers, original uninscribed silhouette.
          box(f, 'stone', a + (a < x ? 1 : -1), y + 0.3, z, 1.25, 3.8, 1.35);
          box(f, 'stone', a + (a < x ? 1 : -1), y + 4.1, z, 1.1, 1.1, 1.15);
        }
      }
    for (const a of [-76.2, -59.7]) box(f, 'stone', a, y + 6.4, 37.5, 3, 1, 20);
  }
}
function court(f, d) {
  const y = rec.floorY;
  pylon(f, -125.2, -73.6, -18.2, 11.1, [18.5, 20.5, 23, 25.4, 24.7, 26], d);
  pylon(f, -126.9, -10.9, 39.8, 11.2, [31.8, 32.7, 33.1, 32.6, 32.5, 31.7], d);
  box(f, 'wall', -76.5, y, -67.4, 84, 9.8, 4.6);
  box(f, 'wall', -98.1, y, 32.4, 31.7, 7.7, 3.6);
  shrine(f, d);
  ramesses(f, d);
  if (d === 0) {
    box(f, 'stone', -75, y, -58.7, 67, 8.7, 2.7);
    box(f, 'stone', -63, y, -0.8, 4.1, 21.5, 4.1);
    return;
  }
  const n = d === 1 ? 5 : 13;
  for (let i = 0; i < n; i++) {
    const x = -111 + (i * 73) / (n - 1);
    if (d === 1) {
      box(f, 'stone', x, y, -58.2, 2.7, 8.6, 2.7);
      continue;
    }
    lathe(
      f,
      x,
      -58.2,
      [
        [0, 1.2],
        [7.6, 0.95],
        [8.6, 1.65],
      ],
      [4, 6, 4, 12, 12][d],
    );
  }
  box(f, 'stone', -74.5, y + 8.6, -58.2, 75, 1, 3.4);
  for (let i = 0; i < (d === 1 ? 3 : 6); i++) {
    const x = -112 + (i * 30) / (d === 1 ? 2 : 5);
    if (d === 1) {
      box(f, 'stone', x, y, 26.8, 2.6, 7.4, 2.6);
      continue;
    }
    lathe(
      f,
      x,
      26.8,
      [
        [0, 1.15],
        [6.4, 0.92],
        [7.4, 1.6],
      ],
      [4, 6, 4, 12, 12][d],
    );
  }
  box(f, 'stone', -97, y + 7.4, 26.8, 32, 1, 3.4);
  // Ten approximate Taharqa column positions; one tall survivor, nine broad low remnants.
  for (let i = 0; i < 5; i++)
    for (const z of [-24, -0.8]) {
      const x = -96 + i * 11;
      if (i === 3 && z === -0.8) column(f, x, z, true, d);
      else if (d === 1) box(f, 'stone', x, y, z, 4.5, 1.6, 4.5);
      else
        lathe(
          f,
          x,
          z,
          [
            [0, 2.25],
            [0.55, 2.25],
            [i % 2 ? 1.5 : 2.3, 1.75],
          ],
          [4, 6, 4, 12, 12][d],
        );
    }
  if (d >= 2) {
    // Colossal statue beside the second-pylon entrance: original coarse sandstone form.
    box(f, 'granite', -38, y, -21.7, 4.2, 0.8, 4);
    box(f, 'stone', -38, y + 0.8, -21.7, 2.6, 7.2, 2.3);
    box(f, 'stone', -38, y + 8, -21.7, 2.05, 2.2, 2.1);
    // Low surviving bases/rubble along the southern exterior; no random loose triangles.
    for (let i = 0; i < 7; i++)
      box(f, 'stone', -112 + i * 4.3, y, 45.8 + (i % 2) * 2.5, 2.8, 0.7 + (i % 3) * 0.45, 2.6);
  }
}
function build(out, d, posed = true, groundJoin = true) {
  const f = writer(out, d, posed),
    y = rec.floorY;
  // Only occupied connected core/chapel floors; no slab for the entire archaeological area.
  box(f, 'stone', -44.5, y - 0.5, -11.3, 175, 0.5, 104);
  box(f, 'stone', -68, y - 0.5, 59, 28, 0.5, 48);
  court(f, d);
  hall(f, d);
  buildKarnakEast(f, d === 1 ? 0 : d, { box, lathe, pylon }, rec);
  buildKarnakSouth(f, d, { box, lathe, pylon }, rec);
  buildKarnakWest(f, d, { box, lathe, pylon }, rec);
  buildKarnakPtahTaharqa(f, d, { box, lathe, pylon }, rec);
  buildKarnakNorth(f, d === 1 ? 0 : d, { box, lathe, pylon }, rec);
  buildKarnakMut(f, d, { box, lathe, pylon }, rec);
  if (posed && groundJoin && d > 0) {
    const face = writer(out, d, false),
      name = ['skyline', 'district', 'street', 'closeup', 'source'][d];
    foundations ??= read('grade-foundations.json');
    for (const facet of foundations.levels[name]) face('flat', facet.points, facet.normal);
  }
}
export const buildKarnakSkyline = (o) => build(o, 0),
  buildKarnakDistrict = (o) => build(o, 1),
  buildKarnakStreet = (o) => build(o, 2),
  buildKarnakCloseup = (o) => build(o, 3);
/** Reconstruct the complete detailed master before geographic vertical poses. */
export const buildKarnakUnposed = (o) => build(o, 4, false);
/** Authoring tools derive ground joins from the graded body, avoiding a circular dependency. */
export const buildKarnakBody = (o, detail) => build(o, detail, true, false);
export const karnakStudy = {
  id: 'N0489',
  key: 'karnak_temple_complex',
  title: 'Karnak Temple Complex',
  category: 'temple',
  wikidataId: 'Q522862',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only;no pixels redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Three existing 256-square shared stone graphs, plus flat ground and still-water materials. Metric UVs and linear vertex tints. No embedded images, unique atlas, copied reliefs or lettering. Source master and four LODs reconstruct from the registered recipes and source controls.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.scope,
    rec.identityBasis,
    rec.heightBasis,
    rec.terrainBasis,
    ...rec.pendingComponents,
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'mut-three-temples-and-lake', position: [-75, 245, 990], lookAt: [123, 0, 778] },
    { name: 'mut-open-courts-and-porches', position: [58, 72, 684], lookAt: [110, 1, 760] },
    { name: 'mut-porch-fragments', position: [104, 10, 689], lookAt: [114, 1.5, 731] },
    { name: 'mut-crescent-dry-peninsula', position: [225, 115, 945], lookAt: [100, -0.2, 820] },
    { name: 'mut-ramesses-iii', position: [-48, 48, 803], lookAt: [5, 1, 851] },
    { name: 'mut-temple-a', position: [157, 40, 657], lookAt: [211, 1, 708] },
    { name: 'mut-northern-propylon', position: [110, 13, 642], lookAt: [123, 2, 668] },
    { name: 'entrance-wings', position: [-220, 65, 83], lookAt: [-125, 15, -14] },
    { name: 'open-great-court', position: [-100, 85, 104], lookAt: [-78, 3, -13] },
    { name: 'hypostyle-central-aisle', position: [-21, 5, -10.9], lookAt: [26, 15, -10.9] },
    { name: 'column-capitals-and-beams', position: [-11, 30, 48], lookAt: [3, 16, -11] },
    { name: 'south-chapel', position: [-103, 24, 94], lookAt: [-68, 4, 52] },
    { name: 'north-shrine', position: [-83, 13, -25], lookAt: [-107, 2.5, -42] },
    { name: 'eastern-pylons-and-obelisks', position: [20, 60, 65], lookAt: [72, 14, -12] },
    { name: 'obelisk-pyramidions', position: [84, 34, -48], lookAt: [60, 22, -27] },
    { name: 'central-bark-shrine', position: [93, 15, 10], lookAt: [112, 3, -8] },
    { name: 'middle-kingdom-court', position: [128, 35, 60], lookAt: [151, 2, -8] },
    { name: 'akhmenu-west-portico', position: [158, 20, 3], lookAt: [188, 5, -3] },
    { name: 'akhmenu-roof-and-rooms', position: [213, 35, 54], lookAt: [198, 5, -5] },
    { name: 'eastern-temples', position: [322, 34, 39], lookAt: [266, 5, -4] },
    { name: 'sacred-lake-and-banks', position: [269, 66, 224], lookAt: [159, -1, 127] },
    { name: 'lake-north-stairs', position: [178, 7, 103], lookAt: [178, -1, 84] },
    { name: 'southern-processional-axis', position: [56, 82, 405], lookAt: [36, 8, 154] },
    { name: 'seventh-eighth-pylons', position: [-30, 34, 181], lookAt: [35, 9, 125] },
    { name: 'ninth-tenth-pylons', position: [113, 35, 361], lookAt: [53, 8, 285] },
    { name: 'amenhotep-open-shell', position: [136, 23, 321], lookAt: [96, 3, 280] },
    { name: 'khonsu-opet-group', position: [-212, 67, 361], lookAt: [-119, 5, 272] },
    { name: 'khonsu-pylon', position: [-91, 18, 322], lookAt: [-98, 7, 284] },
    { name: 'khonsu-open-court', position: [-108, 33, 287], lookAt: [-96, 3, 266] },
    { name: 'opet-west-entrance', position: [-184, 17, 312], lookAt: [-147, 5, 290] },
    { name: 'bab-el-amara-passage', position: [-101, 8, 366], lookAt: [-99, 8, 337] },
    { name: 'ptah-temple-group', position: [58, 31, -159], lookAt: [108, 4, -193] },
    { name: 'ptah-open-door-sequence', position: [74, 3, -201], lookAt: [124, 3, -193] },
    { name: 'ptah-eastern-range', position: [147, 19, -166], lookAt: [125, 4, -190] },
    { name: 'taharqa-lakeside-remnant', position: [76, 21, 85], lookAt: [102, 0, 57] },
    { name: 'taharqa-open-lower-pockets', position: [90, 8, 65], lookAt: [105, -1, 55] },
    { name: 'northern-chapel-group', position: [-206, 47, -106], lookAt: [-132, 3, -182] },
    { name: 'white-chapel-open-piers', position: [-137, 8, -147], lookAt: [-151, 3, -159] },
    { name: 'red-chapel-axial-door', position: [-111, 5, -164], lookAt: [-112, 3, -189] },
    { name: 'alabaster-chapels', position: [-173, 14, -155], lookAt: [-151, 2, -184] },
    { name: 'peristyle-open-ranges', position: [-195, 26, -191], lookAt: [-130, 3, -229] },
    { name: 'osiris-northern-chapels', position: [-8, 24, -101], lookAt: [21, 2, -139] },
    { name: 'montu-open-precinct', position: [79, 75, -184], lookAt: [170, 2, -293] },
    { name: 'montu-jamb-remnants', position: [185, 8, -339], lookAt: [170, 2, -313] },
    { name: 'entrance-small-chapels', position: [-245, 45, 76], lookAt: [-169, 2, 18] },
    { name: 'component-plan', position: [60, 2100, 300], lookAt: [60, 0, 300.1] },
  ]
    .filter((c) => !scope.activeReviewCameras || scope.activeReviewCameras.includes(c.name))
    .map((c) => ({ ...c, fov: 48 })),
};
