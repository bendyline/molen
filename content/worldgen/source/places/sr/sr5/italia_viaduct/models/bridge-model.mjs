/** The present A2 Italia Viaduct, its steel gorge spans and its divided approaches. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.1 },
};
const colors = {
  pier: [0.649, 0.633, 0.562],
  pierShadow: [0.541, 0.527, 0.47],
  seat: [0.561, 0.548, 0.491],
  foot: [0.482, 0.47, 0.414],
  edge: [0.675, 0.653, 0.585],
  rust: [0.414, 0.184, 0.131],
  rustEdge: [0.507, 0.223, 0.158],
  rustDark: [0.282, 0.137, 0.104],
  truss: [0.337, 0.173, 0.126],
  asphalt: [0.206, 0.209, 0.205],
  shoulder: [0.312, 0.317, 0.298],
  fill: [0.459, 0.414, 0.337],
  galvanized: [0.542, 0.558, 0.536],
  mark: [0.805, 0.786, 0.722],
  joint: [0.124, 0.125, 0.119],
  reflector: [0.685, 0.192, 0.147],
};
const detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
function face(out, slot, color, points, preferred) {
  points = points.map((p) => p.map(Math.fround));
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, v, i) => sum + v * preferred[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, ref, points, n, undefined, colors[color]);
}
function quad(out, slot, color, a, b, c, d, dir) {
  face(out, slot, color, [a, b, c], dir);
  face(out, slot, color, [a, c, d], dir);
}
const rod = (out, slot, color, a, b, w, d = w) => {
  if (Math.hypot(...a.map((v, i) => v - b[i])) > 0.035) beam(out, slot, a, b, w, d, colors[color]);
};
const ring = (x, y, z, w, d) => [
  [x - w / 2, y, z - d / 2],
  [x - w / 2, y, z + d / 2],
  [x + w / 2, y, z + d / 2],
  [x + w / 2, y, z - d / 2],
];
function rowAt(x) {
  const i = layout.rows.findIndex((p) => p.x >= x);
  if (i <= 0) return layout.rows.at(i);
  const [a, b] = layout.rows.slice(i - 1, i + 1),
    t = (x - a.x) / (b.x - a.x);
  return {
    x,
    y: mix(a.y, b.y, t),
    lanes: a.lanes.map((l, j) => ({
      center: lerp(l.center, b.lanes[j].center, t),
      edges: l.edges.map((p, k) => lerp(p, b.lanes[j].edges[k], t)),
    })),
  };
}
function at(row, i, t, y = 0) {
  const [a, b] = row.lanes[i].edges,
    [x, z] = lerp(a, b, t);
  return [x, row.y + y, z];
}
function rowsFor(tier) {
  const [a, b] = layout.outer,
    required = new Set([...layout.body, ...layout.supports.filter((p) => p.major).map((p) => p.x)]);
  const rows = layout.rows.filter(
    (r, i) =>
      tier > 1 ||
      i % (tier === 0 ? 5 : 2) === 0 ||
      r.x - a < 25 ||
      b - r.x < 25 ||
      required.has(r.x),
  );
  return rows;
}
function strip(out, slot, color, a, b, i, lo, hi, y = 0) {
  quad(out, slot, color, at(a, i, lo, y), at(a, i, hi, y), at(b, i, hi, y), at(b, i, lo, y), up);
}
function girderDepth(x) {
  if (x < layout.body[0] - 0.01 || x > layout.body[1] + 0.01) return 0.25;
  const major =
    x < -259 ? Math.max(0, 1 - (-259 - x) / 19) : x > 166 ? Math.max(0, 1 - (x - 166) / 19) : 1;
  return mix(3.02, 4.25, major);
}
function deck(out, tier) {
  const rows = rowsFor(tier);
  for (let j = 1; j < rows.length; j++) {
    const a = rows[j - 1],
      b = rows[j],
      d0 = girderDepth(a.x),
      d1 = girderDepth(b.x),
      steel = (a.x + b.x) * 0.5 >= layout.body[0] && (a.x + b.x) * 0.5 <= layout.body[1];
    for (const i of [0, 1]) {
      if (tier === 0) strip(out, 'paving', 'asphalt', a, b, i, 0, 1);
      else {
        strip(out, 'paving', 'asphalt', a, b, i, 0.062, 0.938);
        strip(out, 'paving', 'shoulder', a, b, i, 0, 0.062, 0.1);
        strip(out, 'paving', 'shoulder', a, b, i, 0.938, 1, 0.1);
      }
      if (steel) {
        for (const [edge, inside, side] of [
          [0, 0.19, -1],
          [1, 0.81, 1],
        ]) {
          const dir = [0, -0.42, side];
          const y = tier === 0 ? 0 : -0.57;
          if (tier > 0)
            quad(
              out,
              'concrete',
              'edge',
              at(a, i, edge, 0.1),
              at(b, i, edge, 0.1),
              at(b, i, edge, y),
              at(a, i, edge, y),
              [0, 0, side],
            );
          quad(
            out,
            'metal',
            'rust',
            at(a, i, edge, y),
            at(b, i, edge, y),
            at(b, i, inside, -d1),
            at(a, i, inside, -d0),
            dir,
          );
        }
        quad(
          out,
          'metal',
          'rustDark',
          at(a, i, 0.19, -d0),
          at(b, i, 0.19, -d1),
          at(b, i, 0.81, -d1),
          at(a, i, 0.81, -d0),
          [0, -1, 0],
        );
      }
      if (tier > 1) {
        for (const f of [0.081, 0.919])
          strip(out, 'metal', 'mark', a, b, i, f - 0.0043, f + 0.0043, 0.012);
        if (tier > 2 && steel)
          for (const side of [0, 1]) {
            const r = side === 0 ? 0.006 : 0.994,
              dir = [0, 0, side === 0 ? -1 : 1];
            quad(
              out,
              'metal',
              'rustEdge',
              at(a, i, r, -0.6),
              at(b, i, r, -0.6),
              at(b, i, r, -0.76),
              at(a, i, r, -0.76),
              dir,
            );
          }
      }
      for (const [f, dir] of tier === 0
        ? i === 0
          ? [[0.018, [0, 0, -1]]]
          : [[0.982, [0, 0, 1]]]
        : [
            [0.018, [0, 0, -1]],
            [0.982, [0, 0, 1]],
          ]) {
        if (tier < 2)
          quad(
            out,
            'metal',
            'galvanized',
            at(a, i, f, 0.66),
            at(b, i, f, 0.66),
            at(b, i, f, 0.91),
            at(a, i, f, 0.91),
            dir,
          );
        else {
          rod(out, 'metal', 'galvanized', at(a, i, f, 0.91), at(b, i, f, 0.91), 0.105, 0.142);
          if (tier > 2)
            rod(out, 'metal', 'galvanized', at(a, i, f, 0.42), at(b, i, f, 0.42), 0.052, 0.075);
        }
      }
    }
  }
  if (tier > 1) {
    for (let x = layout.outer[0] + 2.5; x < layout.outer[1] - 4; x += 12.5) {
      const a = rowAt(x),
        b = rowAt(x + 4.2);
      for (const i of [0, 1]) strip(out, 'metal', 'mark', a, b, i, 0.493, 0.507, 0.014);
    }
  }
}
function footings(out, tier) {
  for (const p of layout.supports) {
    const { x, z, top, w, d, grade, corners, floor, major, single } = p;
    const concreteBase = Math.min(top - 2.5, grade - layout.datum + 0.46);
    if (tier === 0) {
      loft(
        out,
        'concrete',
        [
          ring(x, Math.min(concreteBase - 0.6, ...floor), z, w, d),
          ring(x, top + 0.1, z, w * 0.85, d * 0.83),
        ],
        colors.pier,
      );
      continue;
    }
    const foundation = corners
      .toReversed()
      .map(([x, z], i) => [x, Math.min(floor[3 - i], concreteBase - 0.32), z]);
    const cap = corners.toReversed().map(([x, z]) => [x, concreteBase, z]);
    loft(out, 'concrete', [foundation, cap], colors.foot);
    const capDepth = major ? 2.3 : 1.28,
      capSpan = single ? 21.3 : 8.15;
    const shaftTop = top - capDepth * 0.8;
    loft(
      out,
      'concrete',
      [ring(x, concreteBase - 0.22, z, w, d), ring(x, shaftTop, z, w * 0.74, d * 0.78)],
      colors.pier,
    );
    loft(
      out,
      'concrete',
      [ring(x, top - capDepth, z, w * 0.78, d * 0.86), ring(x, top + 0.074, z, w * 0.9, capSpan)],
      colors.seat,
    );
    if (tier >= 2) {
      const offsets = single ? [-5.16, 5.16] : [0];
      for (const e of offsets) {
        loft(
          out,
          'metal',
          [ring(x, top + 0.068, z + e, 2.84, 2.69), ring(x, top + 0.16, z + e, 2.84, 2.69)],
          colors.joint,
        );
        if (tier > 2)
          rod(
            out,
            'metal',
            'truss',
            [x - w * 0.43, top - 0.32, z + e],
            [x + w * 0.43, top - 0.32, z + e],
            0.2,
            0.33,
          );
      }
    }
    if (major && tier > 2) {
      const n = tier === 4 ? 11 : 7;
      for (let j = 1; j < n; j++) {
        const t = j / n,
          y = mix(concreteBase - 0.22, shaftTop, t),
          width = mix(w, w * 0.74, t),
          depth = mix(d, d * 0.78, t);
        for (const side of [-1, 1]) {
          const p = z + side * (depth * 0.5 + 0.008);
          quad(
            out,
            'concrete',
            'pierShadow',
            [x - width * 0.5, y, p],
            [x + width * 0.5, y, p],
            [x + width * 0.5, y + 0.075, p],
            [x - width * 0.5, y + 0.075, p],
            [0, 0, side],
          );
        }
      }
    }
  }
  for (const s of layout.seats) {
    loft(
      out,
      'concrete',
      [ring(s.x, s.base, s.z, s.w, s.d), ring(s.x, s.top, s.z, s.w * 0.94, s.d * 0.99)],
      colors.seat,
    );
  }
}
function approaches(out) {
  for (const rows of layout.apron)
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1],
        b = rows[i];
      for (const side of [0, 1]) {
        const top = (r) => [r.edges[side][0], r.top, r.edges[side][1]];
        quad(out, 'paving', 'fill', top(a), a.toe[side], b.toe[side], top(b), [
          0,
          1,
          side === 0 ? -1 : 1,
        ]);
      }
    }
}
function detailRailings(out, tier) {
  if (tier === 0) return;
  const pitch = [0, 18, 7.25, 4.1, 3.46][tier];
  for (let x = layout.outer[0] + pitch / 2; x < layout.outer[1] - 0.35; x += pitch) {
    const row = rowAt(x);
    for (const i of [0, 1])
      for (const f of [0.018, 0.982]) {
        const a = at(row, i, f, 0.1),
          b = at(row, i, f, 0.91);
        if (tier < 3) {
          quad(
            out,
            'metal',
            'galvanized',
            [a[0] - 0.047, a[1], a[2]],
            [a[0] + 0.047, a[1], a[2]],
            [b[0] + 0.047, b[1], b[2]],
            [b[0] - 0.047, b[1], b[2]],
            [0, 0, 1],
          );
        } else {
          rod(out, 'metal', 'galvanized', a, b, 0.071, 0.078);
          if (tier === 4)
            rod(out, 'metal', 'reflector', at(row, i, f, 0.71), at(row, i, f, 0.78), 0.1, 0.083);
        }
      }
  }
  if (tier >= 2) {
    for (const x of [-492, -327, -259, 166, 372, 504]) {
      const a = rowAt(x - 0.105),
        b = rowAt(x + 0.105);
      for (const i of [0, 1]) strip(out, 'metal', 'joint', a, b, i, 0.063, 0.937, 0.021);
    }
  }
  if (tier > 2) {
    for (let x = -230; x < 157; x += 22) {
      const a = rowAt(x),
        b = rowAt(x + 0.36);
      for (const i of [0, 1]) {
        const f = i === 0 ? 0.09 : 0.91;
        rod(out, 'metal', 'truss', at(a, i, f, -1.84), at(b, i, f, -2.34), 0.09, 0.2);
      }
    }
  }
}
export function buildItaliaLevel(out, level) {
  const tier = detail[level];
  deck(out, tier);
  footings(out, tier);
  approaches(out);
  detailRailings(out, tier);
}
export const buildItaliaSkyline = (out) => buildItaliaLevel(out, 'skyline');
export const buildItaliaDistrict = (out) => buildItaliaLevel(out, 'district');
export const buildItaliaStreet = (out) => buildItaliaLevel(out, 'street');
export const buildItaliaCloseup = (out) => buildItaliaLevel(out, 'closeup');
