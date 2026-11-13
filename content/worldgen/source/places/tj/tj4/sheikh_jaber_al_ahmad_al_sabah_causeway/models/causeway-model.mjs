/** Sheikh Jaber Causeway geometry from the paired Main and Doha link alignments. */
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
  asphalt: '414b50',
  white: 'edece4',
  charcoal: '494c50',
  steel: 'b69b89',
  steelBottom: '9e8577',
  rails: 'b4b9bb',
  lamp: 'b9baba',
  light: 'eee7d2',
  bearing: '555958',
  yellow: 'eeb62f',
  mast: 'e1e2dd',
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
function depth(section, lane, steel) {
  if (steel) return 3.22;
  if (lane.halfWidth < 5) return 1.64;
  return section.kind === 'doha' ? 2.72 : 3.28;
}

function deck(out, section, lane, d) {
  const w = lane.halfWidth;
  const isSteel = (s) => lane.steel.some(([a, b]) => s >= a && s <= b);
  const breaks = [
    lane.from,
    ...lane.steel.flat().filter((s) => s > lane.from + 0.01 && s < lane.to - 0.01),
    lane.to,
  ].sort((a, b) => a - b);
  for (let k = 1; k < breaks.length; k++) {
    const from = breaks[k - 1],
      to = breaks[k],
      steel = isSteel((from + to) / 2);
    if (to - from < 0.01) continue;
    const drop = depth(section, lane, steel),
      slot = steel ? 'steel' : 'concrete';
    const rows = reduceRows(
      [
        at(lane, from),
        ...lane.centerline.filter((p) => p[0] > from + 0.01 && p[0] < to - 0.01),
        at(lane, to),
      ],
      [1.6, 0.48, 0.23, 0.11, 0.045][d],
    );
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i],
        mid = average(a, b);
      sweepFace(out, 'pavement', 'asphalt', a, b, -w, 0, w, 0, UP);
      sweepFace(
        out,
        slot,
        steel ? 'steelBottom' : 'soffit',
        a,
        b,
        -w * 0.52,
        -drop,
        w * 0.52,
        -drop,
        DOWN,
      );
      for (const sign of [-1, 1]) {
        const n = lateral(mid, sign),
          edge = w * sign,
          heel = edge * 0.52;
        if (d === 0) sweepFace(out, slot, steel ? 'steel' : 'side', a, b, edge, 0, heel, -drop, n);
        else {
          sweepFace(out, slot, steel ? 'steel' : 'concrete', a, b, edge, 0, edge * 0.986, -0.39, n);
          sweepFace(
            out,
            slot,
            steel ? 'steelBottom' : 'side',
            a,
            b,
            edge * 0.986,
            -0.39,
            heel,
            -drop,
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
      steel = isSteel(station),
      drop = depth(section, lane, steel);
    face(
      out,
      steel ? 'steel' : 'concrete',
      steel ? 'steelBottom' : 'side',
      [point(a, -w), point(a, w), point(a, w * 0.52, -drop), point(a, -w * 0.52, -drop)],
      [a[4] * sign, 0, a[5] * sign],
    );
  }
}

function pier(out, section, lane, row, d) {
  const [, x, z, y, dx, dz, foundation] = row;
  const steel = lane.steel.some(([a, b]) => row[0] >= a - 0.01 && row[0] <= b + 0.01);
  const small = lane.halfWidth < 5,
    soffit = y - depth(section, lane, steel),
    top = soffit - (d >= 2 ? 0.21 : 0);
  const low = Math.min(top - 0.52, foundation);
  const shaft = small ? 0.89 : 1.43,
    side = small ? 1.96 : 3.48,
    along = small ? 0.99 : 1.42;
  const count = [5, 6, 8, 12, 14][d];
  const angles = Array.from({ length: count }, (_, i) => [
    Math.cos((i * 2 * Math.PI) / count),
    Math.sin((i * 2 * Math.PI) / count),
  ]);
  const ring = (height, long, wide) =>
    angles.map(([u, v]) => [
      x + u * long * dx - v * wide * dz,
      height,
      z + u * long * dz + v * wide * dx,
    ]);
  const flare = top - Math.min(small ? 1.6 : 2.73, (top - low) * 0.64);
  const rows = [
    ring(low, shaft * 1.04, shaft * 1.03),
    ring(flare, shaft, shaft),
    ring(top, along, side),
  ];
  if (d >= 3) rows.splice(2, 0, ring(mix(flare, top, 0.57), along * 0.94, mix(shaft, side, 0.35)));
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count,
        a = rows[j][i],
        b = rows[j][k];
      face(
        out,
        'concrete',
        j === rows.length - 1 ? 'cap' : 'pier',
        [rows[j - 1][i], rows[j - 1][k], b, a],
        [(a[0] + b[0]) / 2 - x, 0, (a[2] + b[2]) / 2 - z],
      );
    }
  const upper = rows.at(-1);
  for (let i = 1; i < count - 1; i++)
    tri(out, 'concrete', 'cap', [upper[0], upper[i], upper[i + 1]], UP);
  if (d >= 2)
    for (const offset of [-side * 0.62, side * 0.62]) {
      beam(
        out,
        'steel',
        point(row, offset, top - y),
        point(row, offset, soffit - y),
        small ? 0.66 : 1.02,
        small ? 0.76 : 1.04,
        color.bearing,
      );
    }
  if (d >= 3 && low < -0.6 && top > 0.52) {
    const a = ring(-0.46, shaft * 1.09, shaft * 1.09),
      b = ring(0.37, shaft * 1.09, shaft * 1.09);
    for (let i = 0; i < count; i++) {
      const k = (i + 1) % count,
        n = [(a[i][0] + a[k][0]) / 2 - x, 0, (a[i][2] + a[k][2]) / 2 - z];
      face(out, 'concrete', 'foot', [a[i], a[k], b[k], b[i]], n);
    }
  }
}

function lightsAndRibs(out, section, lane, d, medianSide) {
  if (d < 2) return;
  const small = lane.halfWidth < 5,
    step = d === 2 ? 96 : 47;
  const offset = (lane.halfWidth - 0.19) * medianSide;
  for (let s = Math.ceil(lane.from / step) * step + 3; s < lane.to - 0.5; s += step) {
    const row = at(lane, s),
      dir = Math.sign(offset);
    const toe = point(row, offset, 0.69),
      head = point(row, offset - dir * 0.31, 9.4),
      lamp = point(row, offset - dir * 1.59, 9.67);
    beam(out, 'steel', toe, head, d === 2 ? 0.19 : 0.14, d === 2 ? 0.19 : 0.14, color.lamp);
    beam(out, 'steel', head, lamp, 0.1, 0.11, color.lamp);
    if (d >= 3)
      beam(out, 'steel', lamp, point(row, offset - dir * 2.12, 9.63), 0.224, 0.109, color.light);
  }
  if (d < 3) return;
  const spacing = d === 3 ? 17.5 : 10.0,
    w = lane.halfWidth;
  for (let s = Math.ceil(lane.from / spacing) * spacing; s < lane.to - 0.38; s += spacing) {
    if (lane.steel.some(([a, b]) => s > a && s < b)) continue;
    const row = at(lane, s),
      drop = depth(section, lane, false);
    for (const sign of [-1, 1]) {
      const n = [row[4], 0, row[5]],
        e = point(row, sign * (w - 0.23), -0.4),
        f = point(row, sign * w * 0.53, -drop + 0.09),
        h = point(row, sign * w * 0.53, -0.47);
      const opposite = (v) => [
        v[0] + n[0] * (small ? 0.16 : 0.23),
        v[1],
        v[2] + n[2] * (small ? 0.16 : 0.23),
      ];
      tri(out, 'concrete', 'cap', [e, f, h], negate(n));
      tri(out, 'concrete', 'cap', [opposite(e), opposite(f), opposite(h)], n);
      face(out, 'concrete', 'soffit', [e, opposite(e), opposite(f), f], DOWN);
    }
  }
}

function towerLeg(out, slot, tint, rows) {
  const normals = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let j = 1; j < rows.length; j++)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4;
      face(out, slot, tint, [rows[j - 1][i], rows[j - 1][k], rows[j][k], rows[j][i]], normals[i]);
    }
  face(out, slot, tint, rows.at(-1), UP);
}

function navigation(out, section, d) {
  const {
    center: [x, z],
    stations,
    height,
    deckHeight,
  } = section.pylon;
  const atTower = (dx, h, dz) => [x + dx, h, z + dz];
  const heightAt = (f) => mix(deckHeight, height, f);
  const whiteX = (f) => -1.7 + 7.4 * f + 33.1 * Math.pow(f, 2.15);
  const yellowX = (f) => 17.2 + 35 * f - 12.8 * f * f;
  const thickness = (f) => 3.1 - 2.05 * f;
  const footing = [
    [-5.3, 3.4],
    [-8.1, 2.0],
    [-8.1, -2.0],
    [-5.3, -3.4],
    [14.3, -3.4],
    [17.4, -2.0],
    [17.4, 2.0],
    [14.3, 3.4],
  ];
  const plinthTop = 6.1;
  for (let i = 0; i < footing.length; i++) {
    const [ax, az] = footing[i],
      [bx, bz] = footing[(i + 1) % footing.length];
    face(
      out,
      'concrete',
      'foot',
      [
        atTower(ax, -1.2, az),
        atTower(bx, -1.2, bz),
        atTower(bx, plinthTop, bz),
        atTower(ax, plinthTop, az),
      ],
      [bz - az, 0, ax - bx],
    );
    tri(
      out,
      'concrete',
      'pier',
      [atTower(3, plinthTop, 0), atTower(ax, plinthTop, az), atTower(bx, plinthTop, bz)],
      UP,
    );
  }
  const rect = (u, h, a, b) =>
    [
      [u - a, -b],
      [u + a, -b],
      [u + a, b],
      [u - a, b],
    ].map(([p, q]) => atTower(p, h, q));
  const yokeTop = rect(0.25, deckHeight - 4.2, 5.35, 3.16);
  towerLeg(out, 'concrete', 'pier', [rect(0.35, plinthTop, 6.15, 3), yokeTop]);
  const towerRows = [yokeTop];
  const count = [7, 10, 14, 21, 26][d];
  for (let i = 0; i <= count; i++) {
    const f = i / count;
    towerRows.push(rect(whiteX(f), heightAt(f), 3.93 - 2.79 * f, thickness(f)));
  }
  towerLeg(out, 'steel', 'mast', towerRows);
  const [a, b] = section.lanes.map((lane, i) => at(lane, stations[i]));
  const tieY = deckHeight - 4.39;
  beam(out, 'concrete', [a[1], tieY, a[2]], [b[1], tieY, b[2]], 6.3, 2.7, color.cap);
  beam(
    out,
    'steel',
    atTower(11.3, plinthTop, 0),
    atTower(yellowX(0), deckHeight, 0),
    2.03,
    3.21,
    color.yellow,
  );
  const lattice = [0, 0.124, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 0.949];
  for (let i = 1; i < lattice.length; i++) {
    const f0 = lattice[i - 1],
      f1 = lattice[i],
      h0 = heightAt(f0),
      h1 = heightAt(f1);
    for (const sign of [-1, 1]) {
      const z0 = sign * thickness(f0),
        z1 = sign * thickness(f1);
      const fore = atTower(yellowX(f0), h0, z0),
        end = atTower(yellowX(f1), h1, z1);
      beam(out, 'steel', fore, end, mix(1.61, 0.74, f1), mix(1.47, 0.66, f1), color.yellow);
      if (d >= 1 || i % 2 === 0)
        beam(
          out,
          'steel',
          atTower(whiteX(f0) + 1.54, h0, z0),
          end,
          d === 0 ? 0.94 : 0.79,
          0.86,
          color.yellow,
        );
      if (d >= 2)
        beam(out, 'steel', fore, atTower(whiteX(f0) + 1.44, h0, z0), 0.59, 0.73, color.yellow);
    }
    if (d >= 1)
      beam(
        out,
        'steel',
        atTower(yellowX(f1), h1, -thickness(f1)),
        atTower(yellowX(f1), h1, thickness(f1)),
        0.6,
        0.63,
        color.yellow,
      );
  }
  const anchors = [-169, -149, -129, -109, -88, -67, -46, -25];
  for (let i = 0; i < anchors.length; i++) {
    if (d === 0 && i % 2 === 1 && i !== 7) continue;
    const rows = section.lanes.map((lane, k) => at(lane, stations[k] + anchors[i]));
    const homes = rows.map((row, k) => {
      const other = rows[1 - k];
      const vx = other[1] - row[1],
        vz = other[2] - row[2],
        len = Math.hypot(vx, vz);
      const inset = Math.min(section.lanes[k].halfWidth + 0.75, len * 0.45);
      return [row[1] + (vx * inset) / len, row[3] + 0.84, row[2] + (vz * inset) / len];
    });
    const f = 0.924 - i * 0.066,
      cable = d === 0 ? 0.58 : d === 1 ? 0.34 : 0.227;
    const under = (p) => [p[0], p[1] - 1.35, p[2]];
    const bearings = rows.map((row) => under([row[1], row[3] + 0.84, row[2]]));
    beam(out, 'steel', bearings[0], bearings[1], 0.97, 0.71, color.steel);
    for (let k = 0; k < 2; k++) {
      const home = homes[k];
      const head = atTower(whiteX(f) - 2.24, heightAt(f), Math.sign(home[2] - z) * thickness(f));
      if (d >= 1) beam(out, 'steel', under(home), home, 0.82, 0.61, color.steel);
      beam(out, 'steel', home, head, cable, cable, color.yellow);
      if (d >= 2)
        beam(
          out,
          'steel',
          home,
          home.map((v, j) => mix(v, head[j], 0.018)),
          0.49,
          0.43,
          color.steel,
        );
    }
  }
}

export function buildCausewaySection(out, level, id) {
  const section = layout.sections.find((s) => s.id === id),
    d = details[level];
  if (!section || d === undefined) throw Error(`Unknown causeway section or LOD ${id} ${level}`);
  for (const [i, lane] of section.lanes.entries()) {
    deck(out, section, lane, d);
    const skylineLimit = section.pylon ? 6 : 16;
    const stride =
      d === 0 ? Math.max(1, Math.ceil(lane.piers.length / skylineLimit)) : d === 1 ? 2 : 1;
    for (let j = 0; j < lane.piers.length; j++) {
      if (j % stride === 0 || j === lane.piers.length - 1)
        pier(out, section, lane, lane.piers[j], d);
    }
    if (d >= 1) parapet(out, lane, d);
    if (d >= 2) marking(out, lane, d);
    const center = at(lane, (lane.from + lane.to) / 2),
      other = section.lanes[1 - i];
    const mate = other ? at(other, (other.from + other.to) / 2) : center;
    const medianSide =
      Math.sign(dot(lateral(center), [mate[1] - center[1], 0, mate[2] - center[2]])) || 1;
    lightsAndRibs(out, section, lane, d, medianSide);
  }
  if (section.pylon) navigation(out, section, d);
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
    buildCausewaySection(shifted, level, section.id);
  }
}
