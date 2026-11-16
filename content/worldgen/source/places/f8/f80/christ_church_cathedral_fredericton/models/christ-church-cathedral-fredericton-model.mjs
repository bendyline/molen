/** Fredericton's Christ Church Cathedral with its post-1911 crossing spire. */
import fs from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) =>
  JSON.parse(fs.readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { outline, tower: spireRing } = frame.geometry;
const d = plan.dimensions;
const colors = Object.fromEntries(
  Object.entries({
    body: '9b8e7c',
    stone: 'a69984',
    shadow: '827463',
    pale: 'c9bb9e',
    masonry: 'a4927a',
    green: '698c81',
    greenRib: '78988b',
    slate: '545653',
    slateRib: '6a6e68',
    glass: '383e3c',
    glassLight: '51554c',
    louvre: '474343',
    wood: '5e4b3d',
    iron: '625b50',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const c = colors;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.82, metallic: 0.08 },
  dark: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.91 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
};
const as3 = ([x, z], y) => [x, y, z];
const up = [0, 1, 0];
function orientedFace(out, slot, points, target, tint) {
  let n = normalFor(...points);
  if (n.reduce((v, p, i) => v + p * target[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [dz * sign, 0, -dx * sign];
  return {
    length,
    n,
    at: (u, y, p = 0) => [a[0] + dx * u + n[0] * p, y, a[1] + dz * u + n[2] * p],
  };
}

function panel(out, slot, e, x1, x2, y1, y2, p, tint) {
  orientedFace(
    out,
    slot,
    [e.at(x1, y1, p), e.at(x2, y1, p), e.at(x2, y2, p), e.at(x1, y2, p)],
    e.n,
    tint,
  );
}

function rectangle(x1, x2, z1, z2) {
  return [
    [x1, z1],
    [x2, z1],
    [x2, z2],
    [x1, z2],
  ];
}

function prism(out, slot, ring, bottom, top, tint, roof = true) {
  const area = ring.reduce((sum, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const e = edge(ring[i], ring[(i + 1) % ring.length], Math.sign(area));
    panel(out, slot, e, 0, e.length, bottom, top, 0, tint);
  }
  const indices = earcut(ring.flat());
  for (const [y, n] of [[bottom, [0, -1, 0]], ...(roof ? [[top, up]] : [])]) {
    for (let i = 0; i < indices.length; i += 3)
      orientedFace(
        out,
        slot,
        indices.slice(i, i + 3).map((k) => as3(ring[k], y)),
        n,
        tint,
      );
  }
}

// A two-centred Gothic arch retains the cusp with a low number of curve segments.
function archCurve(mid, half, spring, head, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const u = (2 * i) / segments - 1;
    const height = Math.sqrt(Math.max(0, 3.25 - 2.25 * Math.abs(u) - u * u) / 3.25);
    return [mid + u * half, spring + (head - spring) * height];
  });
}

function windowArch(out, e, mid, width, sill, spring, head, detail, options = {}) {
  const { door = false, ornate = false, depth = 0.03 } = options;
  const half = width / 2;
  const cnt = [4, 6, 10, 14][detail];
  const profile = archCurve(mid, half, spring, head, cnt);
  const arch = (p, offset = depth) => e.at(p[0], p[1], offset);
  const trimWidth = ornate ? 0.23 : 0.12;
  panel(out, 'dark', e, mid - half, mid + half, sill, spring, depth, door ? c.wood : c.glass);
  for (let i = 1; i < profile.length; i++)
    orientedFace(
      out,
      'dark',
      [e.at(mid, spring - 0.015, depth), arch(profile[i - 1]), arch(profile[i])],
      e.n,
      door ? c.wood : c.glass,
    );
  if (detail === 0) return;
  const outerProfile = archCurve(mid, half + trimWidth, spring, head + trimWidth, cnt);
  for (let i = 1; i < profile.length; i++) {
    orientedFace(
      out,
      'trim',
      [
        arch(profile[i - 1], depth + 0.025),
        arch(profile[i], depth + 0.025),
        arch(outerProfile[i], depth + 0.047),
        arch(outerProfile[i - 1], depth + 0.047),
      ],
      e.n,
      c.pale,
    );
  }
  for (const side of [-1, 1]) {
    const x = mid + half * side;
    const outer = x + trimWidth * side;
    panel(
      out,
      'trim',
      e,
      Math.min(x, outer),
      Math.max(x, outer),
      sill,
      spring,
      depth + 0.043,
      c.pale,
    );
  }
  panel(
    out,
    'trim',
    e,
    mid - half - trimWidth,
    mid + half + trimWidth,
    sill - 0.13,
    sill + 0.025,
    depth + 0.085,
    c.pale,
  );
  if (detail === 1 || door) return;
  const bars = ornate ? 3 : 1;
  for (let i = 0; i < bars; i++) {
    const x = mid - width / 2 + ((i + 1) * width) / (bars + 1);
    panel(out, 'trim', e, x - 0.035, x + 0.035, sill + 0.04, spring + 0.38, depth + 0.084, c.pale);
  }
  if (ornate) {
    const y = spring + (head - spring) * 0.42;
    const r = Math.min(0.97, width * 0.24, (head - spring) * 0.31);
    const path = [];
    for (let i = 0; i <= 24; i++) {
      const a = (Math.PI * i) / 12;
      const radius = r * (1 + 0.19 * Math.cos(4 * a));
      path.push(e.at(mid + radius * Math.cos(a), y + radius * Math.sin(a), depth + 0.075));
    }
    beamPath(out, 'trim', path, 0.084, 0.056, c.pale);
    if (detail === 3)
      for (const side of [-1, 1]) {
        const x = mid + side * width * 0.23;
        const h = spring + (head - spring) * 0.35;
        const wire = archCurve(x, width * 0.19, spring - 0.61, h, 8).map((p) =>
          arch(p, depth + 0.091),
        );
        beamPath(out, 'trim', wire, 0.075, 0.061, c.pale);
      }
  }
}

function louvre(out, e, y, detail) {
  const mid = e.length / 2;
  const width = 2.24;
  windowArch(out, e, mid, width, y, y + 3.48, y + 5.05, detail, { ornate: true });
  if (detail < 2) return;
  const slats = detail === 3 ? 13 : 8;
  for (let i = 0; i < slats; i++) {
    const z = y + 0.225 + (i * 2.98) / slats;
    panel(out, 'detail', e, mid - width * 0.45, mid + width * 0.45, z, z + 0.045, 0.091, c.louvre);
  }
}

function gable(out, alongX, longA, longB, acrossA, acrossB, eave, ridge, tint, detail) {
  const center = (acrossA + acrossB) / 2;
  const p = (u, y, v) => (alongX ? [u, y, v] : [v, y, u]);
  for (const end of [longA, longB]) {
    const n = alongX ? [end === longA ? -1 : 1, 0, 0] : [0, 0, end === longA ? -1 : 1];
    orientedFace(
      out,
      'wall',
      [p(end, eave, acrossA), p(end, eave, acrossB), p(end, ridge, center)],
      n,
      c.body,
    );
    if (detail >= 1) {
      const ext = end === longA ? end - 0.08 : end + 0.08;
      beamPath(
        out,
        'trim',
        [p(ext, eave, acrossA), p(ext, ridge, center), p(ext, eave, acrossB)],
        0.18,
        0.21,
        c.pale,
      );
    }
  }
  for (const side of [acrossA, acrossB]) {
    orientedFace(
      out,
      'roof',
      [
        p(longA - 0.09, eave, side),
        p(longB + 0.09, eave, side),
        p(longB + 0.09, ridge, center),
        p(longA - 0.09, ridge, center),
      ],
      up,
      tint,
    );
    if (detail >= 2) {
      const n = Math.floor(Math.abs(longB - longA) / (detail === 3 ? 0.72 : 1.59));
      for (let i = 0; i < n; i++) {
        const t = longA + ((longB - longA) * (i + 0.6)) / (n + 0.2);
        beam(
          out,
          'roof',
          p(t, eave + 0.025, side),
          p(t, ridge + 0.025, center),
          0.034,
          0.035,
          c.greenRib,
        );
      }
    }
  }
}

function buttress(out, x, z, height, normal, detail) {
  const nx = normal[0],
    nz = normal[1];
  const faceWidth = detail === 0 ? 0.67 : 0.55;
  const p = (outside, u, y) => [x + nx * outside - nz * u, y, z + nz * outside + nx * u];
  const stages = [
    [-0.42, 0.83, 1],
    [height * 0.41, 0.83, 1],
    [height * 0.72, 0.52, 0.91],
    [height - 0.43, 0.38, 0.8],
    [height, 0.21, 0.67],
  ];
  const rings = stages.map(([y, a, s]) => [
    p(-0.19, -faceWidth * s, y),
    p(a, -faceWidth * s, y),
    p(a, faceWidth * s, y),
    p(-0.19, faceWidth * s, y),
  ]);
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      const expected = [
        (rings[i][j][0] + rings[i][k][0]) / 2 - x,
        0,
        (rings[i][j][2] + rings[i][k][2]) / 2 - z,
      ];
      orientedFace(
        out,
        'wall',
        [rings[i - 1][j], rings[i - 1][k], rings[i][k], rings[i][j]],
        expected,
        j === 1 ? c.stone : c.body,
      );
    }
  }
  orientedFace(out, 'trim', rings.at(-1), up, c.pale);
  if (detail >= 2) {
    const y = height * 0.42;
    beam(out, 'trim', p(0.86, -faceWidth, y), p(0.86, faceWidth, y), 0.13, 0.15, c.pale);
  }
}

function cathedral(out, detail) {
  const west = -29.85,
    east = 14.11,
    low = d.aisleEaves;
  prism(out, 'base', outline, d.baseY, 1.0, c.shadow);
  prism(out, 'wall', outline, 0.985, low, c.body);
  prism(out, 'wall', rectangle(west, east, -4.66, 4.62), low - 0.1, d.naveEaves, c.body);
  gable(out, true, west, east, -4.75, 4.72, d.naveEaves, d.naveRidge, c.green, detail);
  for (const side of [-1, 1]) {
    orientedFace(
      out,
      'roof',
      [
        [west, low + 0.015, side * 9.82],
        [7.1, low + 0.015, side * 9.82],
        [7.1, 9.88, side * 4.6],
        [west, 9.88, side * 4.6],
      ],
      up,
      c.green,
    );
    orientedFace(
      out,
      'roof',
      [
        [7.1, low + 0.013, side * 9.14],
        [east, low + 0.013, side * 9.14],
        [east, 9.85, side * 4.58],
        [7.1, 9.85, side * 4.58],
      ],
      up,
      c.green,
    );
    for (const [x, zOuter, zInner, eave, sign] of [
      [west, 9.82, 4.6, 9.88, -1],
      [7.1, 9.82, 4.6, 9.88, 1],
      [east, 9.14, 4.58, 9.85, 1],
    ]) {
      orientedFace(
        out,
        'wall',
        [
          [x, low, zOuter * side],
          [x, eave, zInner * side],
          [x, low, zInner * side],
        ],
        [sign, 0, 0],
        c.body,
      );
    }
  }
  prism(out, 'wall', rectangle(-4.12, 4.12, -9.82, 9.73), low - 0.12, 10.85, c.body);
  gable(out, false, -9.82, 9.75, -4.16, 4.15, 10.85, 15.82, c.green, detail);
  gable(out, false, 9.68, 13.54, -24.86, -18.23, low, 10.5, c.slate, detail);
  const vestibule = [
    [-31.79, 6.52, -4.75],
    [-31.79, 6.52, 4.52],
    [-29.8, 8.28, 4.52],
    [-29.8, 8.28, -4.75],
  ];
  orientedFace(out, 'roof', vestibule, up, c.green);
  for (const [z, side] of [
    [-4.75, -1],
    [4.52, 1],
  ])
    orientedFace(
      out,
      'wall',
      [
        [-31.79, 6.51, z],
        [-29.8, 8.28, z],
        [-29.8, 6.51, z],
      ],
      [0, 0, side],
      c.body,
    );
  const chancel = edge([east, -9.1], [east, 9.16]);
  const westEnd = edge([-31.79, 4.51], [-31.79, -4.7]);
  const eSouth = edge([4.11, 9.77], [-4.09, 9.77]);
  const eNorth = edge([-4.09, -9.82], [4.12, -9.82]);
  windowArch(out, chancel, chancel.length / 2, 5.35, 3.7, 9.1, 14.9, detail, { ornate: true });
  windowArch(out, westEnd, westEnd.length / 2, 2.12, 0.22, 3.65, 5.46, detail, { door: true });
  for (const e of [eSouth, eNorth])
    windowArch(out, e, e.length / 2, 3.08, 2.4, 7.42, 12.9, detail, { ornate: true });
  const porch = edge([-18.24, 13.55], [-24.84, 13.55]);
  windowArch(out, porch, porch.length / 2, 2.14, 0.26, 3.36, 5.77, detail, { door: true });
  for (const sign of [-1, 1]) {
    const north = sign === -1;
    const row = north ? edge([west, -9.82], [-8.69, -9.82]) : edge([-8.69, 9.7], [-18.19, 9.7]);
    const windows = north ? [3.15, 7.08, 11.05, 15.0, 18.96] : [2.14, 6.24];
    for (const u of windows) windowArch(out, row, u, 1.33, 2.04, 4.4, 5.82, detail);
    const wing = north ? edge([4.12, -9.13], [east, -9.13]) : edge([east, 9.17], [4.11, 9.17]);
    for (const u of [2.19, 6.14]) windowArch(out, wing, u, 1.36, 2.04, 4.23, 5.76, detail);
    const clear = north ? edge([west, -4.67], [east, -4.67]) : edge([east, 4.63], [west, 4.63]);
    if (detail >= 1)
      for (const x of [7, 14, 20, 27, 37, 41])
        windowArch(out, clear, x, 0.81, 8.0, 9.32, 10.42, detail);
  }

  const supports =
    detail === 0
      ? [
          [east, 4.54, 15.33, [1, 0.3]],
          [east, -4.63, 15.33, [1, -0.3]],
        ]
      : [
          [east, 4.58, 15.62, [1, 0.35]],
          [east, -4.62, 15.62, [1, -0.35]],
          [east, 8.51, 6.62, [0.8, 0.57]],
          [east, -8.59, 6.62, [0.8, -0.57]],
          [-29.66, 9.59, 7.21, [-0.7, 0.7]],
          [-29.72, -9.72, 7.21, [-0.7, -0.7]],
          [-11.11, 9.71, 8.21, [0, 1]],
          [-11.12, -9.78, 8.21, [0, -1]],
          [4.08, 9.71, 11.04, [0.71, 0.71]],
          [4.08, -9.83, 11.04, [0.71, -0.71]],
          [-4.1, 9.71, 11.04, [-0.71, 0.71]],
          [-4.1, -9.83, 11.04, [-0.71, -0.71]],
        ];
  for (const [x, z, height, n] of supports) buttress(out, x, z, height, n, detail);
  const steps = [1, 3, 4, 5][detail];
  for (let i = 0; i < steps; i++)
    box(
      out,
      'base',
      -31.85 - 0.41 * (i + 1),
      -0.34,
      -0.06,
      0.44,
      0.68 - (0.58 * i) / steps,
      3.08,
      c.shadow,
    );
}

function taperedSpire(out, detail) {
  const layers = [
    [d.towerTop - 0.1, 1.05],
    [d.spireShoulderY, 1],
    [32.55, 0.83],
    [d.spireCapY, 0.06],
  ];
  for (let layer = 1; layer < layers.length; layer++) {
    const [y, s] = layers[layer - 1];
    const [top, shrink] = layers[layer];
    for (let i = 0; i < spireRing.length; i++) {
      const a = spireRing[i],
        b = spireRing[(i + 1) % spireRing.length];
      const n = [a[0] + b[0], 0, a[1] + b[1]];
      const p = (v, h, q) => [v[0] * q, h, v[1] * q];
      orientedFace(
        out,
        'roof',
        [p(a, y, s), p(b, y, s), p(b, top, shrink), p(a, top, shrink)],
        n,
        c.slate,
      );
      if (detail >= 1)
        beam(out, 'detail', p(a, y, s * 1.003), p(a, top, shrink * 1.03), 0.036, 0.039, c.slateRib);
    }
  }
  if (detail >= 1) {
    const y = 43.2;
    const s = 0.83 + ((0.06 - 0.83) * (y - 32.55)) / (d.spireCapY - 32.55);
    for (const direction of [-1, 1]) {
      const x = direction * (3.225 * s + 0.073);
      const e = edge([x, -1.28 * s], [x, 1.29 * s], direction);
      const mid = e.length / 2;
      const r = 0.42;
      const points = Array.from({ length: 17 }, (_, i) =>
        e.at(mid + r * Math.cos((i * Math.PI) / 8), y + r * Math.sin((i * Math.PI) / 8), 0.012),
      );
      if (detail >= 2) beamPath(out, 'trim', points, 0.072, 0.056, c.pale);
      for (let i = 1; i < points.length; i++)
        orientedFace(out, 'dark', [e.at(mid, y, 0.02), points[i - 1], points[i]], e.n, c.glass);
    }
  }
  const y = d.crossTopY;
  profile(
    out,
    [
      [d.spireCapY - 0.03, 0.22, 0.22],
      [d.spireCapY + 0.34, 0.15, 0.15, 'detail', c.iron],
    ],
    detail === 0 ? 4 : 8,
    [0, 0],
  );
  beam(out, 'detail', [0, d.spireCapY + 0.25, 0], [0, y, 0], 0.11, 0.12, c.iron);
  beam(out, 'detail', [-0.47, y - 0.4, 0], [0.47, y - 0.4, 0], 0.102, 0.122, c.iron);
}

function tower(out, detail) {
  const [ax, bx, az, bz] = d.towerBounds;
  const base = rectangle(ax, bx, az, bz);
  prism(out, 'wall', base, 12.45, d.towerTop, c.body);
  for (let i = 0; i < base.length; i++) {
    const p = base[i],
      q = base[(i + 1) % base.length];
    const e = edge(p, q);
    louvre(out, e, 20.56, detail);
    if (detail >= 1) {
      panel(out, 'trim', e, -0.08, e.length + 0.08, 19.87, 20.08, 0.125, c.pale);
      panel(
        out,
        'trim',
        e,
        -0.08,
        e.length + 0.08,
        d.towerTop - 0.39,
        d.towerTop - 0.12,
        0.23,
        c.pale,
      );
    }
    const mid = e.length / 2;
    const a = e.at(mid - 2.66, d.towerTop - 0.12, 0.065);
    const b = e.at(mid + 2.66, d.towerTop - 0.12, 0.065);
    const peak = e.at(mid, d.towerTop + 3.21, 0.065);
    orientedFace(out, 'wall', [a, b, peak], e.n, c.body);
    const rearA = e.at(mid - 2.66, d.towerTop - 0.12, -0.88);
    const rearB = e.at(mid + 2.66, d.towerTop - 0.12, -0.88);
    const rearPeak = e.at(mid, d.towerTop + 2.85, -1.72);
    orientedFace(out, 'roof', [a, peak, rearPeak, rearA], up, c.slate);
    orientedFace(out, 'roof', [peak, b, rearB, rearPeak], up, c.slate);
    orientedFace(
      out,
      'wall',
      [rearA, rearPeak, rearB],
      e.n.map((n) => -n),
      c.body,
    );
    if (detail >= 1) {
      beamPath(out, 'trim', [a, peak, b], 0.19, 0.18, c.pale);
      windowArch(
        out,
        e,
        mid,
        1.08,
        d.towerTop + 0.015,
        d.towerTop + 1.08,
        d.towerTop + 2.14,
        detail,
        { depth: 0.096 },
      );
    }
  }
  for (const [x, z] of base) {
    const s = Math.sign(x),
      t = Math.sign(z);
    const lower = d.towerTop - 1.97;
    const p = [x - s * 0.23, z - t * 0.21];
    profile(
      out,
      [
        [lower, 0.67, 0.67],
        [d.towerTop + 0.74, 0.45, 0.45, 'wall', c.stone],
        [d.towerTop + 1.03, 0.49, 0.49, 'trim', c.pale],
        [d.towerTop + 3.69, 0.064, 0.064, 'trim', c.pale],
      ],
      detail === 0 ? 4 : 8,
      p,
    );
  }
  taperedSpire(out, detail);
}

function draw(out, detail) {
  cathedral(out, detail);
  tower(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [70, 40, 61];
const lookAt = [-5, 24, 1];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q5108777',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The sandstone Christ Church Cathedral in Fredericton has steep oxidized metal roofs, Gothic tracery and a dark 198-foot crossing spire.',
  camera,
  lookAt,
  sunDirection: [60, 105, -45],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_sandstone_raw',
    'stone_limestone',
    'metal_standing_seam',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.75,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'east-window-and-spire', position: [67, 27, 40], lookAt: [1, 27, 0] },
    { name: 'west-door-and-side-porch', position: [-58, 10, 29], lookAt: [-18, 7, 1] },
    { name: 'crossing-tower-and-clock', position: [25, 44, -24], lookAt: [0, 35, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.77,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.155, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry informed by the exact public-domain Qualla photograph, native mapping, original terrain and local heritage records.',
};
