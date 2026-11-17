/** The stone enclosure and upper terrace of the Temple Mount / Haram al-Sharif. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  column,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const geometryRequire = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = geometryRequire('earcut');
const read = (name) => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { profiles, arcadeBays, arcadeSpanMeters } = plan.section;
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  oldStone: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
  dressed: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
};
const tint = Object.fromEntries(
  Object.entries({
    foundation: '989184',
    east: 'bcb094',
    south: 'bcaa8e',
    west: 'c1b39a',
    north: 'c1b79f',
    bevel: 'baa786',
    pale: 'dbcfb2',
    edge: 'a99b80',
    soundStone: 'c7b99e',
    shadow: '8b7961',
    warm: 'c7aa80',
    fill: 'ae987a',
    terrace: 'c7bfac',
    terraceEdge: 'af9f86',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const mix = (a, b, u) => a + (b - a) * u;
const lerp = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function topAt(side, [x, z]) {
  const axis = side === 'south' || side === 'north' ? x : z;
  const values = profiles[side];
  if (axis <= values[0][0]) return values[0][1];
  const index = values.findIndex(([a]) => a >= axis);
  if (index < 0) return values.at(-1)[1];
  const [a, u] = values[index - 1],
    [b, v] = values[index];
  return mix(u, v, (axis - a) / (b - a));
}

function oriented([x, z], [p, q]) {
  const length = Math.hypot(p - x, q - z);
  return { length, normal: [(z - q) / length, (p - x) / length], yaw: -Math.atan2(q - z, p - x) };
}

function rectangle(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function band(out, slot, a, b, low0, low1, high0, high1, z, color) {
  face(
    out,
    slot,
    [
      [a, low0, z],
      [b, low1, z],
      [b, high1, z],
      [a, high0, z],
    ],
    color,
  );
}

function stoneCourses(out, length, lo0, lo1, hi0, hi1, z, slot, lod, side) {
  const oldCourses = side === 'south' || side === 'west';
  const pitch = oldCourses ? 1.02 : 0.64;
  const width = oldCourses ? 2.75 : 1.22;
  const low = Math.floor(Math.min(lo0, lo1) / pitch);
  const high = Math.ceil(Math.max(hi0, hi1) / pitch);
  for (let row = low; row < high; row++) {
    const fromY = row * pitch,
      toY = fromY + pitch - 0.085;
    const yRange = (t) => {
      const low = mix(lo0, lo1, t),
        high = mix(hi0, hi1, t);
      return [Math.max(fromY, low), Math.min(toY, high)];
    };
    for (
      let center = width * (row % 2 ? 0.21 : 0.52);
      center < length + width * 0.5;
      center += width
    ) {
      const a = Math.max(0.028, center - width * 0.48);
      const b = Math.min(length - 0.028, center + width * 0.48);
      if (b - a < 0.43) continue;
      const [a0, a1] = yRange(a / length),
        [b0, b1] = yRange(b / length);
      if (Math.min(a1 - a0, b1 - b0) < 0.16) continue;
      const alternate = (row + Math.round(center / width)) % 5;
      const tone = alternate === 0 ? tint.pale : alternate === 1 ? tint.edge : tint.soundStone;
      band(out, slot, a, b, a0, b0, a1, b1, z, tone);
      if (lod === 3 && oldCourses && a1 - a0 > 0.55 && b1 - b0 > 0.55 && b - a > 1.05)
        band(
          out,
          slot,
          a + 0.075,
          b - 0.075,
          a0 + 0.073,
          b0 + 0.073,
          a1 - 0.072,
          b1 - 0.072,
          z + 0.025,
          tint.bevel,
        );
    }
  }
}

function retainingWalls(out, lod) {
  const spacing = [68, 35, 15, 11][lod];
  for (const [side, controls] of Object.entries(frame.walls)) {
    const line =
      lod === 0
        ? controls.filter((p, i) => {
            if (i === 0 || i === controls.length - 1) return true;
            const a = controls[i - 1],
              b = controls[i + 1];
            return locate([a, b], p).distance > 1.15;
          })
        : controls;
    const thickness = side === 'south' || side === 'west' ? 2.32 : 1.73;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i];
      const { length, normal, yaw } = oriented(a, b);
      const local = transform(out, yaw, [a[0], 0, a[1]]);
      const parts = Math.max(1, Math.ceil(length / spacing));
      for (let j = 0; j < parts; j++) {
        const f = j / parts,
          g = (j + 1) / parts;
        const p = lerp(a, b, f),
          q = lerp(a, b, g);
        const l = length * f,
          r = length * g;
        const [nx, nz] = normal;
        const outer = (x, z) => ground(x + nx * 2.3, z + nz * 2.3);
        const base = (u) => Math.min(topAt(side, u) - 0.9, outer(u[0], u[1]) - 0.62);
        const b0 = base(p),
          b1 = base(q),
          t0 = topAt(side, p),
          t1 = topAt(side, q);
        const toe = j % 3 === 1 ? 0.09 : 0.025;
        const curtain = (t, b) => Math.min(t - 0.63, b + (t - b) * 0.65);
        const c0 = curtain(t0, b0),
          c1 = curtain(t1, b1);
        if (lod === 0) band(local, 'ashlar', l, r, b0, b1, t0, t1, 0, tint[side]);
        else {
          band(local, 'ashlar', l, r, b0, b1, c0, c1, 0, tint[side]);
          band(local, 'ashlar', l, r, c0, c1, t0, t1, 0, tint.soundStone);
        }
        face(
          local,
          'oldStone',
          [
            [r, b1, -thickness],
            [l, b0, -thickness],
            [l, t0, -thickness],
            [r, t1, -thickness],
          ],
          tint.edge,
        );
        face(
          local,
          'dressed',
          [
            [l, t0, 0.12],
            [r, t1, 0.12],
            [r, t1, -thickness - 0.11],
            [l, t0, -thickness - 0.11],
          ],
          tint.soundStone,
        );
        if (lod > 0) band(local, 'dressed', l, r, t0 - 0.29, t1 - 0.29, t0, t1, 0.125, tint.pale);
        if (lod > 1 && ((side === 'west' && p[1] > 85) || side === 'south'))
          stoneCourses(
            transform(local, 0, [l, 0, 0]),
            r - l,
            b0,
            b1,
            c0,
            c1,
            toe,
            'oldStone',
            lod,
            side,
          );
        if (lod === 3 && side === 'east' && q[1] < -65 && p[1] > -160)
          stoneCourses(
            transform(local, 0, [l, 0, 0]),
            r - l,
            c0,
            c1,
            t0 - 0.32,
            t1 - 0.32,
            0.05,
            'dressed',
            lod,
            side,
          );
      }
    }
  }
}

// The photographed closed gates retain their blocking, with voussoirs over stone infill.
function archProfile(u, rise, pointed) {
  const a = Math.abs(u);
  return rise * (pointed ? Math.sqrt(Math.max(0, 1 - a)) : Math.sqrt(Math.max(0, 1 - a * a)));
}
function archBand(out, center, spring, half, rise, depth, z, n, color, pointed = false) {
  const outer = half + depth;
  for (let i = 0; i < n; i++) {
    const a0 = (2 * i) / n - 1,
      a1 = (2 * (i + 1)) / n - 1;
    const lower = (a) => spring + archProfile(a, rise, pointed);
    const upper = (a) => spring + archProfile(a, rise + depth, pointed);
    face(
      out,
      'dressed',
      [
        [center + half * a0, lower(a0), z],
        [center + half * a1, lower(a1), z],
        [center + outer * a1, upper(a1), z],
        [center + outer * a0, upper(a0), z],
      ],
      color,
    );
  }
}

function gateInfill(out, x, base, half, spring, rise, z, lod, color = tint.fill) {
  const n = [4, 8, 12, 16][lod];
  rectangle(out, 'ashlar', x - half, x + half, base, spring, z, color);
  for (let i = 0; i < n; i++) {
    const a = (2 * i) / n - 1,
      b = (2 * (i + 1)) / n - 1;
    const y0 = spring + archProfile(a, rise, false),
      y1 = spring + archProfile(b, rise, false);
    if (i === 0)
      triangle(
        out,
        'ashlar',
        [
          [x + a * half, spring, z],
          [x + b * half, spring, z],
          [x + b * half, y1, z],
        ],
        color,
      );
    else if (i === n - 1)
      triangle(
        out,
        'ashlar',
        [
          [x + a * half, spring, z],
          [x + b * half, spring, z],
          [x + a * half, y0, z],
        ],
        color,
      );
    else band(out, 'ashlar', x + a * half, x + b * half, spring, spring, y0, y1, z, color);
  }
  archBand(out, x, spring, half, rise, 0.36, z + 0.048, n, tint.warm);
  if (lod > 1) archBand(out, x, spring, half + 0.39, rise + 0.39, 0.16, z + 0.071, n, tint.pale);
}

function locate(line, point) {
  let best = { distance: Infinity };
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1],
      b = line[i],
      info = oriented(a, b);
    const along =
      ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) /
      (info.length * info.length);
    const p = lerp(a, b, Math.max(0, Math.min(1, along)));
    const distance = Math.hypot(p[0] - point[0], p[1] - point[1]);
    if (distance < best.distance) best = { ...info, point: p, distance };
  }
  return best;
}

function southGates(out, lod) {
  for (const [name, offsets, half] of [
    ['hulda-double', [-2.45, 2.45], 1.95],
    ['hulda-triple', [-5.25, 0, 5.25], 2.38],
    ['single-gate', [0], 1.96],
  ]) {
    const feature = frame.gates[name];
    const {
      point: [x, z],
      normal: [nx, nz],
      yaw,
    } = locate(frame.walls.south, feature.point);
    const local = transform(out, yaw, [x, 0, z]);
    const grade = ground(x + nx * 3.2, z + nz * 3.2);
    const floor = grade + 0.48;
    for (const cx of offsets)
      gateInfill(local, cx, floor, half, floor + 2.82, half * 0.73, 0.185, lod);
    if (name === 'hulda-triple') {
      const n = lod === 0 ? 3 : lod === 1 ? 6 : 10;
      const approach = ground(x + nx * 12, z + nz * 12);
      const step = Math.max(0.12, (floor - approach) / n);
      for (let i = 0; i < n; i++)
        box(
          local,
          'dressed',
          [-10.3, Math.min(approach, floor) - 0.8, 0.17 + i * 0.74],
          [10.3, floor - i * step, 0.96 + i * 0.74],
          tint.pale,
        );
    }
  }
  const {
    point: [x, z],
    yaw,
    normal: [nx, nz],
  } = locate(frame.walls.west, frame.gates['robinsons-arch'].point);
  const local = transform(out, yaw, [x, 0, z]);
  const y = ground(x + nx * 6, z + nz * 6) + 7.18;
  for (let i = 0; i < 4; i++) {
    const depth = [0.61, 1.11, 1.77, 2.24][i];
    box(
      local,
      'oldStone',
      [-6.4 + i * 0.25, y + i * 0.68, -0.11],
      [6.38 - i * 0.24, y + 0.65 + i * 0.68, depth],
      i % 2 ? tint.warm : tint.bevel,
    );
    if (lod > 1)
      for (let j = -2; j < 3; j++) {
        const a = j * 2.16;
        box(
          local,
          'dressed',
          [a - 1.04, y + i * 0.68 + 0.11, depth - 0.095],
          [a + 1.04, y + i * 0.68 + 0.58, depth + 0.065],
          tint.soundStone,
        );
      }
  }
  const loose = lod === 0 ? 0 : lod === 1 ? 9 : 15;
  for (let i = 0; i < loose; i++) {
    const a = ((i % 5) - 2) * 2.64 + Math.sin(i * 3) * 0.76,
      b = 10.1 + Math.floor(i / 5) * 2.2;
    const gx = x + Math.cos(yaw) * a + nx * b,
      gz = z - Math.sin(yaw) * a + nz * b;
    const block = transform(local, i * 0.47, [a, ground(gx, gz), b]);
    box(
      block,
      'oldStone',
      [-0.76, -0.32, -0.57],
      [0.69, 0.92 + (i % 3) * 0.19, 0.65],
      i % 2 ? tint.soundStone : tint.foundation,
    );
  }
}

function mercyGate(out, lod) {
  const place = frame.gates['gate-of-mercy'];
  const center = [0, 1].map(
    (k) => place.footprint.reduce((a, p) => a + p[k], 0) / place.footprint.length,
  );
  const {
    point: [x, z],
    yaw,
    normal: [nx, nz],
  } = locate(frame.walls.east, center);
  const local = transform(out, yaw, [x, 0, z]);
  const sx = Math.cos(yaw),
    sz = -Math.sin(yaw);
  const across = place.footprint.map((p) => (p[0] - x) * sx + (p[1] - z) * sz);
  const back = Math.min(...place.footprint.map((p) => (p[0] - x) * nx + (p[1] - z) * nz));
  const a = Math.min(...across),
    b = Math.max(...across);
  const cx = (a + b) / 2,
    width = b - a;
  const base = ground(x + nx * 7, z + nz * 7) - 0.42;
  const top = Math.max(topAt('east', [x, z]) + 4.6, base + 15.1);
  box(local, 'ashlar', [a, base, back], [b, top, 1.22], tint.soundStone);
  box(
    local,
    'dressed',
    [a - 0.23, top - 0.52, back - 0.17],
    [b + 0.23, top + 0.04, 1.42],
    tint.pale,
  );
  for (const sign of [-1, 1]) {
    const mid = cx + sign * width * 0.2,
      half = width * 0.158,
      spring = base + 5.35;
    gateInfill(local, mid, base + 0.46, half, spring, half * 0.87, 1.29, lod, tint.warm);
    if (lod > 0) {
      rectangle(
        local,
        'dressed',
        mid - 1.26,
        mid + 1.26,
        base + 10.4,
        base + 11.75,
        1.32,
        tint.bevel,
      );
      rectangle(
        local,
        'oldStone',
        mid - 0.11,
        mid + 0.11,
        base + 11.38,
        base + 13.08,
        1.38,
        tint.shadow,
      );
      gateInfill(local, mid - 0.34, base + 0.7, 0.72, base + 2.61, 0.7, 1.335, lod, tint.bevel);
    }
  }
  if (lod > 1)
    for (const edge of [a + 0.47, cx, b - 0.48])
      for (const y of [base + 4.76, base + 5.12])
        box(local, 'dressed', [edge - 0.58, y, 1.18], [edge + 0.58, y + 0.25, 1.56], tint.bevel);
}

function terraceHeight(x, z) {
  const plane = 10.45 - 0.016 * (x + 30) + 0.018 * (z + 12);
  return Math.max(plane, ground(x, z) + 0.42);
}

function upperTerrace(out, lod) {
  const ring = frame.rockSquare;
  const hole = frame.independentModels['dome-of-the-rock'].buildingOutline;
  const points = [...ring, ...hole];
  const triangles = earcut(points.flat(), [ring.length]);
  const lift = ([x, z]) => [x, terraceHeight(x, z), z];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((j) => points[j]);
    const winding = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const patch = (p, q, r, depth) => {
      if (depth === 0) {
        const corners = (winding > 0 ? [p, r, q] : [p, q, r]).map(lift);
        triangle(out, 'paving', corners, tint.terrace);
        return;
      }
      const d = lerp(p, q, 0.5),
        e = lerp(q, r, 0.5),
        f = lerp(r, p, 0.5);
      patch(p, d, f, depth - 1);
      patch(d, q, e, depth - 1);
      patch(f, e, r, depth - 1);
      patch(d, e, f, depth - 1);
    };
    patch(a, b, c, lod);
  }
  for (let i = 0; lod > 0 && i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const { yaw, length } = oriented(b, a);
    const wall = transform(out, yaw, [b[0], 0, b[1]]);
    const y0 = terraceHeight(...b),
      y1 = terraceHeight(...a);
    band(
      wall,
      'ashlar',
      0,
      length,
      ground(...b) - 0.63,
      ground(...a) - 0.63,
      y0,
      y1,
      0,
      tint.terraceEdge,
    );
  }
}

function qanatir(out, lod) {
  for (const [name, step] of Object.entries(frame.steps)) {
    const [a, b] = step.points;
    const aDist = locate([...frame.rockSquare, frame.rockSquare[0]], a).distance;
    const bDist = locate([...frame.rockSquare, frame.rockSquare[0]], b).distance;
    const [top, foot] = aDist < bDist ? [a, b] : [b, a];
    const run = Math.max(4.4, Math.hypot(foot[0] - top[0], foot[1] - top[1]));
    const yaw = Math.atan2(foot[0] - top[0], foot[1] - top[1]);
    const arch = transform(out, yaw, [top[0], 0, top[1]]);
    const width = arcadeSpanMeters[name];
    const bays = arcadeBays[name];
    const platform = terraceHeight(...top) + 0.12;
    const low = Math.max(platform - 4.55, Math.min(platform - 1.42, ground(...foot) + 0.15));
    const n = [1, 4, 12, 16][lod];
    for (let i = 0; i < n; i++)
      box(
        arch,
        'dressed',
        [-width * 0.49, low - 0.86, (i * run) / n],
        [width * 0.49, mix(platform, low, i / n), ((i + 1) * run) / n + 0.03],
        tint.soundStone,
      );
    if (lod > 0)
      for (const sign of [-1, 1]) {
        const x = sign * width * 0.51;
        face(
          arch,
          'ashlar',
          [
            [x, low - 0.5, run],
            [x, low + 0.53, run],
            [x, platform + 0.78, 0],
            [x, platform - 0.7, 0],
          ],
          tint.terraceEdge,
        );
      }
    const pitch = width / bays,
      spring = platform + 2.59,
      rise = Math.min(pitch * 0.47, 1.89),
      roof = spring + rise + 0.73;
    for (let i = 0; i <= bays; i++) {
      const x = (i - bays / 2) * pitch;
      if (lod === 0)
        rectangle(
          arch,
          'dressed',
          x - 0.32,
          x + 0.32,
          platform,
          i === 0 || i === bays ? roof : spring + 0.34,
          0.04,
          tint.pale,
        );
      else if (i === 0 || i === bays)
        box(arch, 'ashlar', [x - 0.39, platform - 0.17, -0.47], [x + 0.39, roof, 0.46], tint.pale);
      else if (lod === 1)
        box(
          arch,
          'dressed',
          [x - 0.24, platform, -0.26],
          [x + 0.24, spring + 0.13, 0.26],
          tint.pale,
        );
      else {
        column(arch, 'dressed', x, 0, platform, spring + 0.02, 0.23, tint.pale, 10);
      }
    }
    for (let i = 0; i < bays; i++) {
      const x = (i - (bays - 1) / 2) * pitch;
      const segments = [2, 5, 9, 12][lod];
      const half = pitch * 0.49;
      for (let j = 0; j < segments; j++) {
        const a = (j * 2) / segments - 1,
          b = ((j + 1) * 2) / segments - 1;
        const y0 = spring + archProfile(a, rise, true),
          y1 = spring + archProfile(b, rise, true);
        const l = x + a * half,
          r = x + b * half;
        band(arch, 'ashlar', l, r, y0, y1, roof, roof, 0.46, tint.pale);
        if (lod === 0) continue;
        face(
          arch,
          'ashlar',
          [
            [r, y1, -0.44],
            [l, y0, -0.44],
            [l, roof, -0.44],
            [r, roof, -0.44],
          ],
          tint.soundStone,
        );
        face(
          arch,
          'dressed',
          [
            [l, y0, -0.44],
            [r, y1, -0.44],
            [r, y1, 0.46],
            [l, y0, 0.46],
          ],
          tint.bevel,
        );
      }
      if (lod > 0) archBand(arch, x, spring, half, rise, 0.145, 0.49, segments, tint.bevel, true);
    }
    box(
      arch,
      'dressed',
      [-width * 0.511, roof - 0.18, -0.54],
      [width * 0.511, roof + 0.14, 0.54],
      tint.soundStone,
    );
  }
}

function build(out, lod) {
  retainingWalls(out, lod);
  upperTerrace(out, lod);
  southGates(out, lod);
  mercyGate(out, lod);
  qanatir(out, lod);
}
export const templeMountSkyline = (out) => build(out, 0);
export const templeMountDistrict = (out) => build(out, 1);
export const templeMountStreet = (out) => build(out, 2);
export const templeMountCloseup = (out) => build(out, 3);
const recipe = 'temple-mount-model.mjs';
const camera = [405, 178, 410],
  lookAt = [0, 3, 36];
export const templeMountModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: templeMountCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  buildingCutout: {
    outline: frame.westernWall,
    minimumCoverage: 0.995,
    basis:
      'Named OpenStreetMap way/817206833. Replace the mapped duplicate of the Western Wall within its own outline.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The limestone Temple Mount / Haram al-Sharif enclosure, with its long retaining walls, Gate of Mercy, blocked southern gates, surviving Robinson’s Arch masonry and the stepped arcades of the Rock Square.',
  camera,
  lookAt,
  sunDirection: [65, 81, 52],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_weathered',
    'stone_limestone_raw',
    'stone_ashlar',
  ],
  qaCameras: [
    { name: 'stone-enclosure-from-the-southeast', position: camera, lookAt },
    { name: 'southern-wall-and-hulda-gates', position: [25, 1, 289], lookAt: [22, -2.9, 232] },
    { name: 'west-plaza-and-robinsons-arch', position: [-186, 9, 250], lookAt: [-137, 3, 211] },
    {
      name: 'gate-of-mercy-and-east-retaining-wall',
      position: [224, 10, -86],
      lookAt: [161, 3, -92],
    },
    { name: 'rock-square-southwestern-arcade', position: [-112, 16, 74], lookAt: [-83, 12, 33] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `temple-mount-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'templeMountSkyline',
    errorMeters: 2.1,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeMountDistrict', 0.72],
        ['street', 'templeMountStreet', 0.23],
        ['closeup', 'templeMountCloseup', 0.068],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, based on public-domain exterior photographs. Mapped OpenStreetMap outlines are ODbL 1.0.',
};
