/** Bent arcade browser meshes with shared stone/brick, independent of the original masonry master. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const frame = JSON.parse(
    readFileSync(structureSourcePath('n0018_skopje_aqueduct', 'map-frame.json')),
  ),
  line = frame.geometry.centerlines[0],
  stations = [0];
for (let i = 1; i < line.length; i++)
  stations.push(
    stations.at(-1) + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]),
  );
const length = stations.at(-1),
  pitch = length / 54,
  ramp = (385.8 - length) / 2,
  MEANS = {
    rawlimestone: [0.8863538324344638, 0.8863538324344638, 0.8863538324344638],
    brick: [0.904731405734041, 0.904731405734041, 0.904731405734041],
  },
  stone = [0.4, 0.355, 0.285],
  brick = [0.38, 0.17, 0.092];
const normals = line.slice(1).map((b, i) => {
    const a = line[i],
      d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [-(b[1] - a[1]) / d, (b[0] - a[0]) / d];
  }),
  miters = line.map((_, i) => {
    const a = normals[Math.max(0, i - 1)],
      b = normals[Math.min(i, normals.length - 1)],
      d = 1 + a[0] * b[0] + a[1] * b[1];
    return a.map((v, k) => (v + b[k]) / d);
  });
function point([s, y, z]) {
  let i = 1;
  while (i < stations.length - 1 && stations[i] < s) i++;
  const t = (s - stations[i - 1]) / (stations[i] - stations[i - 1]),
    a = line[i - 1],
    b = line[i],
    m = miters[i - 1].map((v, k) => v + (miters[i][k] - v) * t);
  return [
    a[0] + (b[0] - a[0]) * t + m[0] * z,
    y + s / length,
    a[1] + (b[1] - a[1]) * t + m[1] * z,
  ].map(Math.fround);
}
function clip(poly, signed) {
  const r = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      da = signed(a),
      db = signed(b);
    if (da >= 0) r.push(a);
    if (da >= 0 !== db >= 0) r.push(a.map((v, k) => v + ((b[k] - v) * da) / (da - db)));
  }
  return r;
}
function writer(destination, far) {
  function emit(slot, p, color) {
    const split = stations
      .slice(1, -1)
      .find((s) => p.some((v) => v[0] < s - 1e-8) && p.some((v) => v[0] > s + 1e-8));
    if (split !== undefined) {
      emit(
        slot,
        clip(p, (v) => split - v[0]),
        color,
      );
      emit(
        slot,
        clip(p, (v) => v[0] - split),
        color,
      );
      return;
    }
    p = p.map(point);
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]],
        a = cross(
          t[1].map((v, j) => v - t[0][j]),
          t[2].map((v, j) => v - t[0][j]),
        );
      if (Math.hypot(...a) < 1e-10) continue;
      destination.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        t.map((v) => [v[0], v[1]]),
        far ? color.map((v, j) => v * (MEANS[slot]?.[j] ?? 1)) : color,
      );
    }
  }
  return emit;
}
function strip(
  emit,
  a,
  b,
  lo0,
  lo1,
  hi0,
  hi1,
  {
    caps = false,
    top = true,
    bottom = true,
    side0 = -1.05,
    side1 = 1.05,
    slot = 'rawlimestone',
    soffit = slot,
    color = stone,
  } = {},
) {
  const p = [
      [a, lo0],
      [b, lo1],
      [b, hi1],
      [a, hi0],
    ],
    front = p.map(([s, y]) => [s, y, side1]),
    back = p.map(([s, y]) => [s, y, side0]);
  emit(slot, front, color);
  emit(slot, back.toReversed(), color);
  if (bottom)
    emit(
      soffit,
      [
        [a, lo0, side0],
        [b, lo1, side0],
        [b, lo1, side1],
        [a, lo0, side1],
      ],
      soffit === 'brick' ? brick : color,
    );
  if (top)
    emit(
      slot,
      [
        [a, hi0, side1],
        [b, hi1, side1],
        [b, hi1, side0],
        [a, hi0, side0],
      ],
      color,
    );
  if (caps)
    for (const [side, x, lo, hi] of [
      [-1, a, lo0, hi0],
      [1, b, lo1, hi1],
    ]) {
      let q = [
        [x, lo, side0],
        [x, lo, side1],
        [x, hi, side1],
        [x, hi, side0],
      ];
      if (side < 0) q = q.toReversed();
      emit(slot, q, color);
    }
}
function ring(emit, c, rx, sy, ry, n, thickness) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n,
      p = (t, k) => [c - (rx + k) * Math.cos(t), sy + (ry + k) * Math.sin(t)];
    for (const side of [-1, 1]) {
      const points = [p(a, 0), p(b, 0), p(b, thickness), p(a, thickness)].map(([s, y]) => [
        s,
        y,
        side * 1.065,
      ]);
      if (side < 0) points.reverse();
      emit('brick', points, brick);
    }
  }
}
function build(out, detail) {
  const emit = writer(out, detail === 0),
    n = [2, 4, 8, 16][detail],
    rx = (pitch - 2.2) / 2;
  for (let i = 0; i < 54; i++) {
    const c = (i + 0.5) * pitch;
    for (let j = 0; j < n; j++) {
      const a = c - rx * Math.cos((Math.PI * j) / n),
        b = c - rx * Math.cos((Math.PI * (j + 1)) / n),
        ya = 2.55 + 2.62 * Math.sin((Math.PI * j) / n),
        yb = 2.55 + 2.62 * Math.sin((Math.PI * (j + 1)) / n);
      strip(emit, a, b, ya, yb, 6.12, 6.12, { top: false, soffit: 'brick' });
    }
    if (detail >= 2) ring(emit, c, rx, 2.55, 2.62, n, 0.5);
  }
  for (let i = 0; i <= 54; i++) {
    const c = i * pitch,
      a = Math.max(0, c - 1.1),
      b = Math.min(length, c + 1.1),
      relief = detail > 0 && i >= 6 && i <= 47;
    if (!relief)
      strip(emit, a, b, 0, 0, 6.12, 6.12, { top: false, bottom: detail > 0, caps: detail >= 2 });
    else {
      const l = c - 0.54,
        r = c + 0.54;
      strip(emit, a, l, 0, 0, 6.12, 6.12, { top: false, caps: detail >= 2 });
      strip(emit, r, b, 0, 0, 6.12, 6.12, { top: false, caps: detail >= 2 });
      strip(emit, l, r, 0, 0, 4.18, 4.18, { caps: detail >= 2 });
      for (let j = 0; j < n; j++) {
        const x = c - 0.54 * Math.cos((Math.PI * j) / n),
          y = c - 0.54 * Math.cos((Math.PI * (j + 1)) / n);
        strip(
          emit,
          x,
          y,
          4.83 + 0.54 * Math.sin((Math.PI * j) / n),
          4.83 + 0.54 * Math.sin((Math.PI * (j + 1)) / n),
          6.12,
          6.12,
          { top: false, soffit: 'brick' },
        );
      }
      if (detail >= 2) ring(emit, c, 0.54, 4.83, 0.54, n, 0.26);
    }
  }
  // Open trough: floor and two rims, each split where the mapped conduit bends.
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i];
    if (detail === 0)
      emit(
        'rawlimestone',
        [
          [a, 6.12, 1.05],
          [b, 6.12, 1.05],
          [b, 6.12, -1.05],
          [a, 6.12, -1.05],
        ],
        stone,
      );
    else {
      for (const [z0, z1] of [
        [-1.05, -0.7],
        [-0.35, 0.35],
        [0.7, 1.05],
      ])
        emit(
          'rawlimestone',
          [
            [a, 6.12, z1],
            [b, 6.12, z1],
            [b, 6.12, z0],
            [a, 6.12, z0],
          ],
          stone,
        );
      for (const [z0, z1] of [
        [-0.7, -0.35],
        [0.35, 0.7],
      ])
        strip(emit, a, b, 6.12, 6.12, 6.56, 6.56, {
          side0: z0,
          side1: z1,
          slot: 'brick',
          color: brick,
        });
    }
  }
  for (const [a, b] of [
    [-ramp, 0],
    [length, length + ramp],
  ])
    strip(emit, a, b, 0, 0, a < 0 ? 2 : 6.12, b > length ? 2 : 6.12, { caps: true });
}
export const buildSkopjeAqueductSkyline = (out) => build(out, 0);
export const buildSkopjeAqueductDistrict = (out) => build(out, 1);
export const buildSkopjeAqueductStreet = (out) => build(out, 2);
export const buildSkopjeAqueductCloseup = (out) => build(out, 3);
