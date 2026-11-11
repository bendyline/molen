/** Marble horseshoe and sunken track in the signed Athens map frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  normalize,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const stadiumSurfaces = {
  marble: { slot: 'wall', graph: 'stone_marble', roughness: 0.75 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.86 },
  track: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99 },
  sand: { slot: 'foundation', graph: 'gravel', roughness: 0.99 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.52 },
  cloth: { slot: 'wall', graph: 'fabric_canvas', roughness: 0.91, doubleSided: true },
};
const palette = {
  marble: 'ded4c1',
  marblePale: 'e8dfcd',
  marbleWarm: 'd9cbb4',
  marbleSide: 'c5b397',
  shadow: 'ac9e83',
  stair: 'c2b59e',
  ledge: 'ccbea6',
  wall: 'c8b79e',
  dark: '594f3b',
  plaza: 'b8ac9b',
  plazaPale: 'bcb1a0',
  plazaDark: 'b2a592',
  track: '333432',
  line: 'a39f8c',
  sand: 'ba9d64',
  sandLight: 'c2a572',
  metal: 'd1c9af',
  railing: 'a8a390',
  blue: '2f5d94',
  white: 'e9e4d6',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([k, hex]) => [
    k,
    hex.match(/../g).map((c) => {
      const n = Number.parseInt(c, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const ranks = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  down = [0, -1, 0],
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const yAt = ([x, z], y) => [x, y, z];
function face(out, slot, tint, ps, toward) {
  let n = normalFor(...ps);
  if (toward && n.reduce((s, v, i) => s + v * toward[i], 0) < 0) {
    ps = ps.toReversed();
    n = normalFor(...ps);
  }
  out.addTriangle(slot, ref, ps, n, undefined, color[tint]);
}
function quad(out, slot, tint, [a, b, c, d], toward) {
  face(out, slot, tint, [a, b, c], toward);
  face(out, slot, tint, [a, c, d], toward);
}
function slab(out, slot, tint, poly, triangles, y) {
  for (const t of triangles) {
    const [[x, z], [a, b], [c, d]] = t.map((i) => poly[i]);
    if (Math.abs((a - x) * (d - z) - (b - z) * (c - x)) < 0.001) continue;
    face(
      out,
      slot,
      tint,
      t.map((i) => yAt(poly[i], y)),
      up,
    );
  }
}
function block(out, slot, tint, x, z, w, d, y0, y1, bevel = 0.042) {
  const ring = (y) =>
    bevel
      ? chamferedRectangle(x, y, z, w, d, bevel)
      : [
          [x - w / 2, y, z - d / 2],
          [x - w / 2, y, z + d / 2],
          [x + w / 2, y, z + d / 2],
          [x + w / 2, y, z - d / 2],
        ];
  loft(out, slot, [ring(y0), ring(y1)], color[tint]);
}
function vertical(out, slot, tint, a, b, lowA, lowB, highA, highB, normal) {
  if (highA - lowA < 0.001 && highB - lowB < 0.001) return;
  quad(out, slot, tint, [yAt(a, lowA), yAt(b, lowB), yAt(b, highB), yAt(a, highA)], normal);
}

const point = (s, v) => mix(s.inner, s.outer, v);
const aisleAt = (t) => layout.aisles.some((s, k) => Math.abs(t - s) < layout.widths[k]);
const along = (a, b, v0, v1, y0, y1) => [
  yAt(point(a, v0), y0),
  yAt(point(b, v0), y0),
  yAt(point(b, v1), y1),
  yAt(point(a, v1), y1),
];
const facing = (a, b) => normalize([b.inner[1] - a.inner[1], 0, a.inner[0] - b.inner[0]]);
function span(out, a, b, v0, v1, y0, y1, tint) {
  quad(out, 'marble', tint, along(a, b, v0, v1, y0, y1), up);
}
function riser(out, a, b, v, y0, y1, tint) {
  if (y1 - y0 < 0.001) return;
  vertical(out, 'marble', tint, point(a, v), point(b, v), y0, y0, y1, y1, facing(a, b));
}

const lowerStart = 0.014,
  lowerEnd = 0.47,
  walkEnd = 0.535,
  outerEnd = 0.994,
  footY = 0.045,
  lowerY = 1.02,
  walkY = 10.46,
  tunnelRows = 8;
const tunnelEnd = lowerStart + ((lowerEnd - lowerStart) * tunnelRows) / 24;
function rowSpecs(tier) {
  const rows = [];
  const bank = (v0, v1, y0, dy, total, stop) => {
    const size = tier === 0 ? total : tier === 1 ? 8 : tier === 2 ? 3 : 1;
    let i = 0;
    while (i < total) {
      const end = Math.min(total, i + size, stop && i < stop ? stop : total);
      rows.push({
        a: v0 + ((v1 - v0) * i) / total,
        b: v0 + ((v1 - v0) * end) / total,
        lo: y0 + i * dy,
        hi: y0 + end * dy,
        slope: tier === 0,
        endsAtOpening: stop !== undefined && end <= stop,
      });
      i = end;
    }
  };
  bank(lowerStart, lowerEnd, lowerY, (walkY - lowerY) / 24, 24, tunnelRows);
  bank(walkEnd, outerEnd, walkY, (layout.towerY - walkY) / 23, 23);
  return rows;
}
function seats(out, stations, tier) {
  const rows = rowSpecs(tier),
    [holeStart, holeEnd] = layout.turns;
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1],
      t = (a.u + b.u) * 0.5;
    const aisle = tier >= 2 && aisleAt(t);
    const hole = t > holeStart && t < holeEnd;
    const n = facing(a, b),
      outward = n.map((v) => -v),
      rim = layout.towerY;
    if (!hole) {
      riser(out, a, b, 0, footY, lowerY, 'marbleSide');
      span(out, a, b, 0, lowerStart, lowerY, lowerY, 'ledge');
    }
    for (const [j, r] of rows.entries()) {
      if (hole && r.endsAtOpening) continue;
      const shade = aisle
        ? 'stair'
        : ['marble', 'marblePale', 'marble', 'marbleWarm'][(i + j * 3) % 4];
      if (r.slope) span(out, a, b, r.a, r.b, r.lo, r.hi, shade);
      else if (aisle && tier >= 3) {
        const mid = (r.a + r.b) / 2,
          y = (r.lo + r.hi) / 2;
        riser(out, a, b, r.a, r.lo, y, 'shadow');
        span(out, a, b, r.a, mid, y, y, shade);
        riser(out, a, b, mid, y, r.hi, 'shadow');
        span(out, a, b, mid, r.b, r.hi, r.hi, shade);
      } else {
        riser(out, a, b, r.a, r.lo, r.hi, aisle ? 'shadow' : 'marbleSide');
        span(out, a, b, r.a, r.b, r.hi, r.hi, shade);
      }
    }
    span(out, a, b, lowerEnd, walkEnd, walkY, walkY, 'ledge');
    span(out, a, b, outerEnd, 1, rim, rim, 'marblePale');
    vertical(out, 'marble', 'wall', a.outer, b.outer, a.foot, b.foot, rim, rim, outward);
    if (tier >= 1) {
      span(out, a, b, 0.984, 1, rim + 0.62, rim + 0.62, 'marble');
      vertical(
        out,
        'marble',
        'marbleSide',
        point(a, 0.984),
        point(b, 0.984),
        rim,
        rim,
        rim + 0.62,
        rim + 0.62,
        n,
      );
      vertical(out, 'marble', 'wall', a.outer, b.outer, rim, rim, rim + 0.62, rim + 0.62, outward);
    }
    if ((tier >= 3 && (i % 2 === 0 || aisle)) || (tier === 2 && i % 3 === 0)) {
      const a0 = point(a, 0.513),
        a1 = point(b, 0.513);
      beam(out, 'metal', yAt(a0, walkY + 0.97), yAt(a1, walkY + 0.97), 0.035, 0.04, color.railing);
      beam(out, 'metal', yAt(a0, walkY + 0.02), yAt(a0, walkY + 0.98), 0.042, 0.046, color.railing);
    }
  }
  if (tier >= 3)
    for (let i = 1; i < stations.length - 1; i++) {
      const p = stations[i - 1],
        s = stations[i],
        q = stations[i + 1];
      const previous = aisleAt((p.u + s.u) / 2),
        next = aisleAt((s.u + q.u) / 2);
      if (previous === next) continue;
      const neighbor = next ? q : p,
        n = normalize([neighbor.inner[0] - s.inner[0], 0, neighbor.inner[1] - s.inner[1]]);
      for (const r of rows) {
        const mid = (r.a + r.b) / 2,
          y = (r.lo + r.hi) / 2;
        vertical(out, 'marble', 'shadow', point(s, r.a), point(s, mid), y, y, r.hi, r.hi, n);
      }
    }
  const court = tier < 2 ? layout.farCourt : layout.court;
  for (const s of [stations[0], stations.at(-1)]) {
    const front = [-1, 0, 0],
      base = (v) => {
        const z = point(s, v)[1];
        const i = Math.max(
          1,
          court.findIndex((p) => p.end[2] >= z - 1e-6),
        );
        const a = court[i - 1].end,
          b = court[i].end;
        return a[1] + (b[1] - a[1]) * ((z - a[2]) / (b[2] - a[2])) - 0.48;
      };
    vertical(
      out,
      'marble',
      'wall',
      s.inner,
      point(s, lowerStart),
      base(0),
      base(lowerStart),
      lowerY,
      lowerY,
      front,
    );
    for (const r of rows)
      vertical(
        out,
        'marble',
        'wall',
        point(s, r.a),
        point(s, r.b),
        base(r.a),
        base(r.b),
        r.slope ? r.lo : r.hi,
        r.hi,
        front,
      );
    vertical(
      out,
      'marble',
      'wall',
      point(s, lowerEnd),
      point(s, walkEnd),
      base(lowerEnd),
      base(walkEnd),
      walkY,
      walkY,
      front,
    );
    vertical(
      out,
      'marble',
      'wall',
      point(s, outerEnd),
      s.outer,
      base(outerEnd),
      base(1),
      layout.towerY,
      layout.towerY,
      front,
    );
    if (tier >= 2)
      for (const [v, lo, hi] of [
        [0.027, 1.0, 2.9],
        [0.513, walkY - 0.3, walkY + 0.8],
        [0.982, layout.towerY - 3.1, layout.towerY + 0.64],
      ]) {
        const [x, z] = point(s, v);
        block(out, 'marble', 'marblePale', x - 0.18, z, 1.04, 1.01, lo, hi, 0.08);
      }
  }
}

function forecourt(out, tier) {
  const court = tier < 2 ? layout.farCourt : layout.court;
  const slices =
    tier === 0
      ? [['toe', 'end']]
      : [
          ['toe', 'mid'],
          ['mid', 'end'],
        ];
  for (let i = 0; i < court.length - 1; i++) {
    const a = court[i],
      b = court[i + 1];
    for (const [j, [pre, key]] of slices.entries()) {
      const p = a[pre],
        q = b[pre],
        r = b[key],
        s = a[key];
      if (tier < 2) quad(out, 'paving', 'plaza', [p, q, r, s], up);
      else {
        const divisions = Math.ceil(Math.abs(q[2] - p[2]) / 3.7);
        for (let k = 0; k < divisions; k++) {
          const u = k / divisions,
            v = (k + 1) / divisions;
          quad(
            out,
            'paving',
            ['plaza', 'plazaPale', 'plaza', 'plazaDark'][(k + j + i) % 4],
            [mix(p, q, u), mix(p, q, v), mix(s, r, v), mix(s, r, u)],
            up,
          );
        }
      }
    }
    quad(
      out,
      'paving',
      'plazaDark',
      [a.toe, b.toe, [b.toe[0], b.foot, b.toe[2]], [a.toe[0], a.foot, a.toe[2]]],
      [-1, 0, 0],
    );
  }
  for (const a of [court[0], court.at(-1)]) {
    const dir = [0, 0, Math.sign(a.toe[2])];
    for (const [pre, key] of slices) {
      const p = a[pre],
        q = a[key];
      quad(out, 'paving', 'plazaDark', [p, q, [q[0], a.foot, q[2]], [p[0], a.foot, p[2]]], dir);
    }
  }
}

function oval([centerA, centerB], z, rx, rz, n) {
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const t = -Math.PI / 2 + (Math.PI * i) / n;
    ring.push([centerB + Math.cos(t) * rx, z + Math.sin(t) * rz]);
  }
  for (let i = 0; i <= n; i++) {
    const t = Math.PI / 2 + (Math.PI * i) / n;
    ring.push([centerA + Math.cos(t) * rx, z + Math.sin(t) * rz]);
  }
  return ring;
}
function fan(out, slot, tint, ring, y) {
  const center = ring.reduce((p, q) => p.map((v, i) => v + q[i] / ring.length), [0, 0]);
  for (let i = 0; i < ring.length; i++)
    face(
      out,
      slot,
      tint,
      [yAt(center, y), yAt(ring[i], y), yAt(ring[(i + 1) % ring.length], y)],
      up,
    );
}
function arena(out, level, tier) {
  slab(out, 'paving', 'plaza', level.arena, level.triangles, 0.028);
  const { rim, triangles, track, lanes } = layout.pitch;
  slab(out, 'track', 'track', rim, triangles, 0.052);
  const { left, right, turn, half, z } = track,
    centers = [left + turn, right - turn],
    n = [10, 14, 23, 33, 45][tier];
  const course = (offset) => oval(centers, z, turn - offset, half - offset, n);
  const lane = 0.78,
    fieldWidth = lanes * lane;
  fan(out, 'sand', 'sand', course(fieldWidth), 0.062);
  if (tier > 0)
    for (let j = 0; j <= lanes; j++) {
      const offset = j * lane + 0.043,
        edge = course(offset),
        inset = course(offset + 0.026),
        y = 0.071;
      for (let i = 0; i < edge.length; i++) {
        const k = (i + 1) % edge.length;
        quad(
          out,
          'track',
          'line',
          [yAt(edge[i], y), yAt(edge[k], y), yAt(inset[k], y), yAt(inset[i], y)],
          up,
        );
      }
    }
  if (tier >= 2) {
    for (const sign of [-1, 1]) {
      for (const x of [-99, -88, -76, 58, 65]) {
        quad(
          out,
          'track',
          'line',
          [
            [x, 0.074, z + sign * (half - 0.11)],
            [x + 0.045, 0.074, z + sign * (half - 0.11)],
            [x + 0.045, 0.074, z + sign * (half - fieldWidth + 0.13)],
            [x, 0.074, z + sign * (half - fieldWidth + 0.13)],
          ],
          up,
        );
      }
    }
    const x = -20;
    quad(
      out,
      'track',
      'track',
      [
        [x - 14, 0.074, -2.42],
        [x + 12, 0.074, -2.42],
        [x + 12, 0.074, -0.45],
        [x - 14, 0.074, -0.45],
      ],
      up,
    );
    block(out, 'marble', 'marblePale', -81, 2.6, 1.38, 1.01, 0.063, 0.49, 0.1);
  }
}

function tunnel(out, stations, tier) {
  const [low, high] = layout.turns,
    a = stations.find((s) => s.u === low),
    b = stations.find((s) => s.u === high);
  if (!a || !b) throw Error('Missing mapped tunnel shoulders');
  const forward = facing(a, b),
    wallY = lowerY + ((walkY - lowerY) * tunnelRows) / 24;
  const frame = (u, y, d = 0) => yAt(mix(point(a, tunnelEnd * d), point(b, tunnelEnd * d), u), y);
  const n = [5, 8, 12, 20, 24][tier],
    spring = 1.69,
    archHeight = 1.32,
    side0 = 0.132,
    side1 = 0.868;
  const arch = Array.from({ length: n + 1 }, (_, i) => {
    const t = (Math.PI * i) / n;
    return [0.5 - 0.368 * Math.cos(t), spring + archHeight * Math.sin(t)];
  });
  const frontY = footY - 0.023;
  quad(
    out,
    'marble',
    'wall',
    [frame(0, frontY), frame(side0, frontY), frame(side0, wallY), frame(0, wallY)],
    forward,
  );
  quad(
    out,
    'marble',
    'wall',
    [frame(side1, frontY), frame(1, frontY), frame(1, wallY), frame(side1, wallY)],
    forward,
  );
  for (let i = 0; i < n; i++) {
    const [u, y] = arch[i],
      [v, w] = arch[i + 1];
    quad(
      out,
      'marble',
      'marblePale',
      [frame(u, y), frame(v, w), frame(v, wallY), frame(u, wallY)],
      forward,
    );
    quad(
      out,
      'marble',
      i % 2 ? 'shadow' : 'dark',
      [frame(u, y), frame(v, w), frame(v, w, 1), frame(u, y, 1)],
      down,
    );
    if (tier >= 2) {
      const expand = (x) => 0.5 + (x - 0.5) * 1.1;
      quad(
        out,
        'marble',
        'marbleWarm',
        [
          frame(u, y, -0.014),
          frame(v, w, -0.014),
          frame(expand(v), w + 0.175, -0.014),
          frame(expand(u), y + 0.175, -0.014),
        ],
        forward,
      );
    }
  }
  for (const [u, sign] of [
    [side0, 1],
    [side1, -1],
  ]) {
    const normal = normalize(frame(0.51, 0.1).map((v, i) => sign * (v - frame(0.49, 0.1)[i])));
    quad(
      out,
      'marble',
      'wall',
      [frame(u, frontY), frame(u, spring), frame(u, spring, 1), frame(u, frontY, 1)],
      normal,
    );
  }
  for (const u of [0, 1]) {
    const normal = normalize(frame(u, 0.1).map((v, i) => v - frame(0.5, 0.1)[i]));
    quad(
      out,
      'marble',
      'wall',
      [frame(u, frontY), frame(u, wallY), frame(u, wallY, 1), frame(u, frontY, 1)],
      normal,
    );
  }
  quad(
    out,
    'paving',
    'plazaDark',
    [frame(side0, frontY), frame(side1, frontY), frame(side1, frontY, 1), frame(side0, frontY, 1)],
    up,
  );
  quad(
    out,
    'marble',
    'dark',
    [
      frame(side0, frontY, 1),
      frame(side1, frontY, 1),
      frame(side1, spring, 1),
      frame(side0, spring, 1),
    ],
    forward,
  );
  for (let i = 0; i < n; i++) {
    const [u, y] = arch[i],
      [v, w] = arch[i + 1];
    face(out, 'marble', 'dark', [frame(0.5, spring, 1), frame(u, y, 1), frame(v, w, 1)], forward);
  }
  quad(
    out,
    'marble',
    'ledge',
    [frame(0, wallY), frame(1, wallY), frame(1, wallY, 1), frame(0, wallY, 1)],
    up,
  );
}

function flag(out, x, z, y, tier) {
  const strips = tier < 2 ? 3 : 9,
    segments = tier < 2 ? 2 : 6,
    w = 2.13,
    h = 1.23;
  const p = (i, j) => {
    const t = i / segments;
    return [
      x - 0.043 - 0.34 * t,
      y - (h * j) / strips + 0.11 * Math.sin(t * 7),
      z + w * t + 0.12 * Math.sin(t * 10 + j * 0.07) * t,
    ];
  };
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < strips; j++) {
      const q = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
      const canton = i < Math.floor(segments / 2) && j < Math.ceil(strips * 0.55);
      const whiteCross = canton && (i === 1 || j === 2) && tier >= 2;
      quad(out, 'cloth', whiteCross || (!canton && j % 2) ? 'white' : 'blue', q, [-1, 0, 0]);
    }
}
function flagpole(out, x, z, h, tier, withFlag) {
  const sides = tier < 2 ? 4 : 7;
  loft(
    out,
    'metal',
    [radialRing(0.22, 0.062, 0.062, sides, [x, z]), radialRing(h, 0.035, 0.035, sides, [x, z])],
    color.metal,
  );
  if (withFlag) flag(out, x, z, h - 0.09, tier);
}
function entrance(out, tier) {
  const x = -121.52;
  for (const sign of [-1, 1]) {
    const width = sign === -1 ? 9.17 : 7.72,
      edge = sign === -1 ? 19.4 : 15.9;
    block(
      out,
      'marble',
      'marbleWarm',
      x,
      sign * (edge - width / 2),
      0.75,
      width,
      0.065,
      1.29,
      tier === 0 ? 0 : 0.09,
    );
    block(
      out,
      'marble',
      'marblePale',
      x,
      sign * (edge - width + 0.13),
      1.02,
      0.87,
      0.02,
      1.83,
      tier === 0 ? 0 : 0.07,
    );
    if (tier > 0)
      block(out, 'marble', 'marblePale', x, sign * (edge - 0.21), 0.94, 0.82, 0.035, 1.61, 0.06);
    const n = [1, 5, 8, 11, 13][tier];
    for (let i = 0; i < n; i++)
      flagpole(
        out,
        x + 0.31,
        sign * (edge - 1.01 - ((width - 2.06) * i) / Math.max(1, n - 1)),
        8.75 + (i % 2) * 0.08,
        tier,
        i === 0 || (i === n - 1 && tier >= 2),
      );
  }
  const intervals = tier === 0 ? 3 : tier === 1 ? 11 : tier === 2 ? 24 : 44;
  for (const y of tier === 0 ? [1.55] : [0.12, 0.91, 1.55])
    beam(out, 'metal', [x, y, -9.86], [x, y, 7.7], 0.051, 0.043, color.railing);
  for (let i = 0; i <= intervals; i++) {
    const z = -9.86 + (17.56 * i) / intervals;
    beam(out, 'metal', [x, 0.09, z], [x, 1.61, z], i % 4 === 0 ? 0.049 : 0.03, 0.031, color.metal);
  }
  if (tier >= 2) {
    for (const z of [-9.94, -1.08, 7.76])
      block(out, 'marble', 'marblePale', x, z, 0.85, 0.69, 0.024, 1.78, 0.08);
    for (const z of [-8.11, 5.67])
      for (const [i, h] of [0.06, 0.12, 0.18].entries()) {
        const xf = x - 0.54 + 0.125 * i;
        block(out, 'marble', 'marbleWarm', xf, z, 0.36, 2.4, 0.013, h, 0.035);
      }
  }
}

function crownLamps(out, stations, tier) {
  if (tier < 2) return;
  const desired = [0.05, 0.31, 0.57, 0.84, 1.26, 1.69, 2.15, 2.41, 2.69, 2.94];
  for (const u of desired) {
    const station = stations.reduce((best, s) =>
      Math.abs(s.u - u) < Math.abs(best.u - u) ? s : best,
    );
    const [x, z] = point(station, 0.985),
      y = layout.towerY + 0.61;
    const h = y + 3.24;
    beam(out, 'metal', [x, y, z], [x, h, z], 0.071, 0.071, color.railing);
    beam(out, 'metal', [x, h, z - 0.48], [x, h, z + 0.48], 0.064, 0.065, color.railing);
    for (const sign of [-1, 1])
      block(out, 'metal', 'metal', x, z + sign * 0.34, 0.22, 0.26, h - 0.11, h + 0.16, 0.035);
  }
}

export function buildStadiumLevel(out, level) {
  const tier = ranks[level];
  if (tier === undefined) throw Error(`Unknown Panathenaic Stadium level ${level}`);
  const detail = layout.levels[level === 'master' ? 'closeup' : level];
  seats(out, detail.stations, tier);
  forecourt(out, tier);
  arena(out, detail, tier);
  tunnel(out, detail.stations, tier);
  entrance(out, tier);
  crownLamps(out, detail.stations, tier);
}
export const buildStadiumSkyline = (out) => buildStadiumLevel(out, 'skyline');
export const buildStadiumDistrict = (out) => buildStadiumLevel(out, 'district');
export const buildStadiumStreet = (out) => buildStadiumLevel(out, 'street');
export const buildStadiumCloseup = (out) => buildStadiumLevel(out, 'closeup');
