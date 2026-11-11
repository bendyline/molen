/** Atal Setu, authored from the two mapped carriageways and the elevated interchange ramps. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.89 },
  pavement: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.15 },
};
const palette = {
  concrete: 'c4beb1',
  side: 'b6b1a4',
  soffit: 'a39f96',
  pier: 'c1bdb1',
  cap: 'b9b4aa',
  foot: 'a49d8d',
  asphalt: '42474c',
  white: 'edece4',
  charcoal: '494c50',
  steel: 'b69b89',
  steelBottom: '9e8577',
  rails: '90958c',
  lamp: '66716e',
  light: 'e0d9c1',
  joint: '636765',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, value]) => [
    k,
    value.match(/../g).map((hex) => {
      const n = parseInt(hex, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const details = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  UP = [0, 1, 0],
  DOWN = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const average = (a, b) => a.map((v, i) => (v + b[i]) / 2);
const negate = (v) => v.map((x) => -x);

function tri(out, slot, tint, points, normal) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.9) return;
  if (dot(n, normal) < 0) {
    points = points.toReversed();
    n = negate(n);
  }
  out.addTriangle(slot, '', points, n, undefined, color[tint]);
}
function face(out, slot, tint, [a, b, c, d], normal) {
  tri(out, slot, tint, [a, b, c], normal);
  tri(out, slot, tint, [a, c, d], normal);
}
function at(lane, station) {
  const { centerline: rows } = lane;
  if (station <= rows[0][0]) return rows[0];
  if (station >= rows.at(-1)[0]) return rows.at(-1);
  let lo = 0,
    hi = rows.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (rows[mid][0] < station) lo = mid;
    else hi = mid;
  }
  const a = rows[lo],
    b = rows[hi],
    t = (station - a[0]) / (b[0] - a[0]),
    value = a.map((x, i) => mix(x, b[i], t));
  const length = Math.hypot(value[4], value[5]);
  value[4] /= length;
  value[5] /= length;
  return value;
}
function point(row, offset, lift = 0, along = 0) {
  const [, x, z, y, dx, dz] = row;
  return [x - dz * offset + dx * along, y + lift, z + dx * offset + dz * along];
}
const lateral = (row, sign = 1) => [-row[5] * sign, 0, row[4] * sign];
function reduceRows(rows, tolerance) {
  const keep = new Set([0, rows.length - 1]);
  const groups = [[0, rows.length - 1]];
  while (groups.length) {
    const [lo, hi] = groups.pop();
    const a = rows[lo],
      b = rows[hi];
    let worst = tolerance,
      idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const p = rows[i],
        t = (p[0] - a[0]) / (b[0] - a[0]);
      const error = Math.hypot(
        p[1] - mix(a[1], b[1], t),
        p[2] - mix(a[2], b[2], t),
        p[3] - mix(a[3], b[3], t),
      );
      if (error > worst) {
        idx = i;
        worst = error;
      }
    }
    if (idx >= 0) {
      keep.add(idx);
      groups.push([lo, idx], [idx, hi]);
    }
  }
  return rows.filter((_, i) => keep.has(i));
}
function sweepFace(out, slot, tint, a, b, offset0, lift0, offset1, lift1, n) {
  face(
    out,
    slot,
    tint,
    [
      point(a, offset0, lift0),
      point(b, offset0, lift0),
      point(b, offset1, lift1),
      point(a, offset1, lift1),
    ],
    n,
  );
}
function deck(out, lane, d) {
  const w = lane.halfWidth,
    rows = lane.centerline;
  const boundaries = [
    ...new Set([
      lane.from,
      lane.to,
      ...lane.steel.flatMap(([start, end]) =>
        [start, end].filter((station) => station > lane.from && station < lane.to),
      ),
    ]),
  ].sort((a, b) => a - b);
  for (let i = 1; i < boundaries.length; i++) {
    const [start, end] = boundaries.slice(i - 1, i + 1),
      middle = (start + end) / 2;
    const steel = lane.steel.some(([a, b]) => middle >= a && middle <= b);
    const depth = steel ? 3.21 : w < 5 ? 1.52 : 2.49,
      slot = steel ? 'steel' : 'concrete';
    const section = [
      at(lane, start),
      ...rows.filter((p) => p[0] > start + 0.005 && p[0] < end - 0.005),
      at(lane, end),
    ];
    const stations =
      d === 0
        ? reduceRows(section, 1.7)
        : d === 1
          ? reduceRows(section, 0.4)
          : d === 2
            ? reduceRows(section, 0.2)
            : section;
    for (let j = 1; j < stations.length; j++) {
      const a = stations[j - 1],
        b = stations[j],
        middle = average(a, b);
      sweepFace(out, 'pavement', 'asphalt', a, b, -w, 0, w, 0, UP);
      sweepFace(
        out,
        slot,
        steel ? 'steelBottom' : 'soffit',
        a,
        b,
        -w * 0.54,
        -depth,
        w * 0.54,
        -depth,
        DOWN,
      );
      for (const sign of [-1, 1]) {
        const n = lateral(middle, sign),
          outer = sign * w,
          heel = sign * w * 0.54;
        if (d === 0)
          sweepFace(out, slot, steel ? 'steel' : 'side', a, b, outer, 0, heel, -depth, n);
        else {
          sweepFace(
            out,
            slot,
            steel ? 'steel' : 'concrete',
            a,
            b,
            outer,
            0,
            outer * 0.982,
            -0.43,
            n,
          );
          sweepFace(
            out,
            slot,
            steel ? 'steelBottom' : 'side',
            a,
            b,
            outer * 0.982,
            -0.43,
            heel,
            -depth,
            n,
          );
        }
      }
    }
  }
  for (const [station, sign] of [
    [lane.from, -1],
    [lane.to, 1],
  ]) {
    const a = at(lane, station),
      n = [a[4] * sign, 0, a[5] * sign],
      steel = lane.steel.some(([p, q]) => station > p && station < q);
    const depth = steel ? 3.21 : w < 5 ? 1.52 : 2.49;
    face(
      out,
      steel ? 'steel' : 'concrete',
      steel ? 'steelBottom' : 'side',
      [point(a, -w, 0), point(a, w, 0), point(a, w * 0.54, -depth), point(a, -w * 0.54, -depth)],
      n,
    );
  }
}
function support(out, row, d, halfWidth, steel) {
  const [, x, z, y, dx, dz, foundation] = row;
  const depth = steel ? 3.22 : halfWidth < 5 ? 1.54 : 2.5;
  const top = y - depth;
  const low = Math.min(top - 0.8, foundation),
    small = halfWidth < 5;
  const ring = (a, b, h) =>
    [
      [-a, -b],
      [a, -b],
      [a, b],
      [-a, b],
    ].map(([u, v]) => [x + u * dx - v * dz, h, z + u * dz + v * dx]);
  const rows =
    d === 0
      ? [
          ring(small ? 0.86 : 1.32, small ? 0.94 : 1.75, low),
          ring(small ? 0.99 : 1.45, small ? 2.32 : 3.98, top),
        ]
      : [
          ring(small ? 0.91 : 1.34, small ? 1.05 : 1.81, low),
          ring(small ? 0.85 : 1.22, small ? 0.85 : 1.52, Math.max(low + 0.25, top - 2.65)),
          ring(small ? 1.06 : 1.49, small ? 2.34 : 3.83, top - 0.45),
          ring(small ? 1.07 : 1.51, small ? 2.4 : 4.02, top),
        ];
  const n = [
    [dz, 0, -dx],
    [dx, 0, dz],
    [-dz, 0, dx],
    [-dx, 0, -dz],
  ];
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(
        out,
        'concrete',
        j === rows.length - 1 ? 'cap' : 'pier',
        [rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]],
        n[i],
      );
    }
  face(out, 'concrete', 'cap', rows.at(-1), UP);
  face(out, 'concrete', 'foot', rows[0], DOWN);
  if (d >= 2 && low < -1.5 && top > 2.3) {
    const a = ring(small ? 1.03 : 1.51, small ? 1.04 : 1.78, -0.61),
      b = ring(small ? 1.02 : 1.49, small ? 1.03 : 1.74, 0.54);
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(out, 'concrete', 'foot', [a[i], a[k], b[k], b[i]], n[i]);
    }
  }
}
function parapet(out, lane, d) {
  const w = lane.halfWidth;
  const baseRows = d < 3 ? reduceRows(lane.centerline, d === 1 ? 0.45 : 0.2) : lane.centerline;
  for (const sign of [-1, 1]) {
    const openings = lane.barrierOpenings?.filter((opening) => opening[0] === sign) ?? [];
    const blocked = (station) => openings.some(([, from, to]) => station > from && station < to);
    const rows = [...baseRows, ...openings.flatMap(([, a, b]) => [at(lane, a), at(lane, b)])]
      .sort((a, b) => a[0] - b[0])
      .filter((row, i, all) => i === 0 || row[0] - all[i - 1][0] > 0.01);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        middle = average(a, b);
      if (blocked(middle[0])) continue;
      const inside = (w - 0.37) * sign,
        outside = (w - 0.06) * sign,
        n = lateral(middle, sign);
      sweepFace(out, 'concrete', 'side', a, b, inside, 0.0, inside, 0.69, negate(n));
      sweepFace(out, 'concrete', 'concrete', a, b, outside, 0.0, outside, 0.69, n);
      sweepFace(out, 'concrete', 'concrete', a, b, inside, 0.69, outside, 0.69, UP);
      if (d >= 2) {
        const rail = (w - 0.2) * sign;
        sweepFace(out, 'steel', 'rails', a, b, rail - 0.051, 0.96, rail + 0.051, 0.96, UP);
        sweepFace(out, 'steel', 'rails', a, b, rail, 0.88, rail, 0.96, n);
        if (d >= 3)
          sweepFace(out, 'steel', 'rails', a, b, rail + 0.003, 0.88, rail + 0.003, 0.96, negate(n));
      }
    }
    if (d >= 2) {
      const spacing = d === 2 ? 25 : d === 3 ? 9 : 6.8;
      for (let s = Math.ceil(lane.from / spacing) * spacing; s < lane.to - 0.25; s += spacing) {
        if (blocked(s)) continue;
        const row = at(lane, s),
          offset = (w - 0.2) * sign;
        beam(
          out,
          'steel',
          point(row, offset, 0.66),
          point(row, offset, 0.93),
          0.086,
          0.094,
          color.rails,
        );
      }
    }
    if (d >= 3) {
      const interval = 1.7;
      for (let s = Math.ceil(lane.from / interval) * interval; s < lane.to; s += interval) {
        const a = at(lane, s),
          b = at(lane, Math.min(s + 0.8, lane.to)),
          side = (w - 0.38) * sign;
        if (b[0] - a[0] < 0.03 || blocked((a[0] + b[0]) / 2)) continue;
        sweepFace(
          out,
          'pavement',
          'white',
          a,
          b,
          side,
          0.045,
          side,
          0.665,
          lateral(average(a, b), -sign),
        );
      }
    }
  }
}
function marking(out, lane, d) {
  const w = lane.halfWidth,
    ramp = w < 5;
  const segments = d === 2 ? 22 : d === 3 ? 12 : 10,
    length = d === 2 ? 6 : 3.7;
  for (const x of ramp ? [0] : [-2.36, 1.16]) {
    for (let s = Math.ceil(lane.from / segments) * segments; s < lane.to; s += segments) {
      const a = at(lane, s),
        b = at(lane, Math.min(s + length, lane.to));
      if (b[0] - a[0] > 0.03)
        sweepFace(out, 'pavement', 'white', a, b, x - 0.07, 0.016, x + 0.07, 0.016, UP);
    }
  }
  const rows = d === 2 ? reduceRows(lane.centerline, 0.27) : lane.centerline;
  for (const x of [-w + 0.61, w - 0.73])
    for (let i = 1; i < rows.length; i++) {
      sweepFace(
        out,
        'pavement',
        'white',
        rows[i - 1],
        rows[i],
        x - 0.066,
        0.016,
        x + 0.066,
        0.016,
        UP,
      );
    }
  if (d >= 3)
    for (let i = 0; i < lane.piers.length; i += 6) {
      const s = lane.piers[i][0];
      const a = at(lane, s),
        b = at(lane, Math.min(lane.to, s + 0.23));
      if (b[0] - a[0] > 0.03)
        sweepFace(out, 'pavement', 'joint', a, b, -w + 0.25, 0.018, w - 0.25, 0.018, UP);
    }
}
function lamps(out, lane, d) {
  if (d < 2 || lane.halfWidth < 5 || lane.direction !== 'eastbound') return;
  const interval = d === 2 ? 83 : d === 3 ? 42 : 36,
    offset = lane.halfWidth - 0.18;
  for (let s = Math.ceil(lane.from / interval) * interval + 2; s < lane.to; s += interval) {
    const a = at(lane, s);
    beam(out, 'steel', point(a, offset, 0.69), point(a, offset, 9.4), 0.157, 0.157, color.lamp);
    for (const sign of [-1, 1]) {
      const mid = point(a, offset + sign * 1.25, 9.53);
      const end = point(a, offset + sign * 2.37, 9.53);
      if (d === 2) beam(out, 'steel', point(a, offset, 9.13), end, 0.13, 0.13, color.lamp);
      else {
        beam(out, 'steel', point(a, offset, 9.13), mid, 0.078, 0.093, color.lamp);
        beam(out, 'steel', mid, end, 0.085, 0.082, color.lamp);
        beam(
          out,
          'steel',
          point(a, offset + sign * 2.27, 9.49),
          point(a, offset + sign * 2.79, 9.48),
          0.235,
          0.118,
          color.light,
        );
      }
    }
    if (d >= 3) {
      const ring = Array.from({ length: 8 }, (_, i) =>
        point(
          a,
          offset + Math.cos((i * Math.PI) / 4) * 0.45,
          8.76 + Math.sin((i * Math.PI) / 4) * 0.45,
        ),
      );
      for (let i = 0; i < 8; i++)
        beam(out, 'steel', ring[i], ring[(i + 1) % 8], 0.039, 0.042, color.rails);
    }
  }
}
export function buildBridgeSection(out, level, id) {
  const section = layout.sections.find((s) => s.id === id),
    d = details[level];
  if (!section || d === undefined) throw Error(`Unknown Atal Setu section or level ${id} ${level}`);
  const pierDetail = d === 1 && section.lanes.length > 2 ? 0 : d;
  const skylinePiersPerLane = Math.min(21, Math.floor(42 / section.lanes.length));
  for (const lane of section.lanes) {
    deck(out, lane, d);
    const stride =
      d === 0
        ? Math.max(1, Math.ceil(lane.piers.length / skylinePiersPerLane))
        : d === 1 && lane.roadId
          ? 2
          : 1;
    for (let i = 0; i < lane.piers.length; i++) {
      if (i % stride !== 0 && i !== lane.piers.length - 1) continue;
      const p = lane.piers[i];
      support(
        out,
        p,
        pierDetail,
        lane.halfWidth,
        lane.steel.some(([a, b]) => p[0] > a - 0.01 && p[0] < b + 0.01),
      );
    }
    if (d >= 1) parapet(out, lane, d);
    if (d >= 2) marking(out, lane, d);
    lamps(out, lane, d);
  }
}

/** Preserve one source master in the common world-aligned assembly frame. */
export function buildAssembly(out, level) {
  for (const section of layout.sections) {
    const c = Math.cos(section.heading);
    const s = Math.sin(section.heading);
    const rotate = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
    const place = (p) => {
      const [x, y, z] = rotate(p);
      return [x + section.origin[0], y, z + section.origin[1]];
    };
    const shifted = {
      addTriangle: (role, ref, p, n, u, color) =>
        out.addTriangle(role, ref, p.map(place), rotate(n), u, color),
      addQuad: (role, ref, p, n, u, color) =>
        out.addQuad(role, ref, p.map(place), rotate(n), u, color),
      addConvexPolygon: (role, ref, p, n, u, color) =>
        out.addConvexPolygon(role, ref, p.map(place), rotate(n), u, color),
    };
    buildBridgeSection(shifted, level, section.id);
  }
}
