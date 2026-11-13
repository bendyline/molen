/** New Darnytskyi Bridge. Coordinates are meters in the signed PMTiles bridge frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.87 },
  paved: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.61, metallic: 0.15 },
};
const colors = {
  fascia: 'c0bdb1',
  concrete: 'b8b3a7',
  pier: 'b6af9f',
  base: '998e80',
  asphalt: '454954',
  marking: 'e9e7d9',
  arch: 'c8d2d5',
  bracing: 'afbec5',
  tie: 'a1a8a6',
  rails: '697477',
  hardware: '72797e',
  ballast: '82786b',
  sleepers: '746c5f',
  wire: '686c65',
  insulator: 'a8997c',
  light: 'dfded3',
};
const color = Object.fromEntries(
  Object.entries(colors).map(([k, hex]) => [
    k,
    hex.match(/../g).map((byte) => {
      const n = parseInt(byte, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const detail = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  front = [1, 0, 0],
  back = [-1, 0, 0];
const side = (s) => [0, 0, s];
const mix = (a, b, t) => a + (b - a) * t;
const [northRoad, southRoad, northRail, southRail] = layout.lanes;

function face(out, slot, tint, points, normal) {
  for (const idx of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    let p = idx.map((i) => points[i]),
      n = normalFor(...p);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
      p = p.toReversed();
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', p, n, undefined, color[tint]);
  }
}
function at(lane, x) {
  const rows = lane.rows;
  const i = rows.findIndex((r) => r[0] >= x);
  if (i <= 0) return rows[i < 0 ? rows.length - 1 : 0];
  const [a, b] = rows.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return [x, mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
const offset = ([x, y, z], dz, dy = 0) => [x, y + dy, z + dz];
function sample(lane, tolerance) {
  const rows = lane.rows,
    keep = new Set([0, rows.length - 1]),
    todo = [[0, rows.length - 1]];
  while (todo.length) {
    const [lo, hi] = todo.pop(),
      a = rows[lo],
      b = rows[hi];
    let index = -1,
      worst = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const row = rows[i],
        t = (row[0] - a[0]) / (b[0] - a[0]),
        e = Math.hypot(row[1] - mix(a[1], b[1], t), row[2] - mix(a[2], b[2], t));
      if (e > worst) {
        index = i;
        worst = e;
      }
    }
    if (index >= 0) {
      keep.add(index);
      todo.push([lo, index], [index, hi]);
    }
  }
  return rows.filter((_, i) => keep.has(i));
}
function run(out, slot, tint, a, b, z0, y0, z1, y1, n) {
  face(
    out,
    slot,
    tint,
    [offset(a, z0, y0), offset(b, z0, y0), offset(b, z1, y1), offset(a, z1, y1)],
    n,
  );
}
function slab(out, rows, w, depth, top, lip, d) {
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    run(out, 'paved', top, a, b, -w, 0, w, 0, up);
    run(out, 'concrete', 'concrete', a, b, -w * lip, -depth, w * lip, -depth, down);
    for (const s of [-1, 1]) {
      if (d >= 1) run(out, 'concrete', 'fascia', a, b, s * w, 0, s * w, -0.38, side(s));
      run(
        out,
        'concrete',
        'concrete',
        a,
        b,
        s * w,
        d >= 1 ? -0.38 : 0,
        s * w * lip,
        -depth,
        side(s),
      );
    }
  }
  if (d >= 1)
    for (const [a, n] of [
      [rows[0], back],
      [rows.at(-1), front],
    ])
      face(
        out,
        'concrete',
        'fascia',
        [offset(a, -w), offset(a, w), offset(a, w * lip, -depth), offset(a, -w * lip, -depth)],
        n,
      );
}
const apertures = [
  [[592, 711]],
  [
    [595, 683],
    [777, 854],
  ],
];
function road(out, lane, d, index) {
  const w = lane.halfWidth,
    rows = sample(lane, [1.2, 0.4, 0.16, 0.075, 0.035][d]),
    from = rows[0][0],
    to = rows.at(-1)[0];
  slab(out, rows, w, 2.26, 'asphalt', 0.69, d);
  if (!d) return;
  const window = apertures[index];
  for (const s of [-1, 1]) {
    const isOutside = s === (index === 0 ? -1 : 1);
    const openings = isOutside ? window : [];
    const blocked = (x) => openings.some(([lo, hi]) => x > lo && x < hi);
    const guardRows = [...rows, ...openings.flatMap(([a, b]) => [at(lane, a), at(lane, b)])]
      .sort((a, b) => a[0] - b[0])
      .filter((r, i, a) => !i || r[0] - a[i - 1][0] > 0.02);
    for (let j = 1; j < guardRows.length; j++) {
      const a = guardRows[j - 1],
        b = guardRows[j],
        z = s * (w - 0.14);
      if (blocked((a[0] + b[0]) / 2)) continue;
      run(out, 'concrete', 'fascia', a, b, z - s * 0.2, 0, z - s * 0.2, 0.45, side(-s));
      run(out, 'concrete', 'fascia', a, b, z + s * 0.04, 0, z + s * 0.04, 0.45, side(s));
      run(out, 'concrete', 'fascia', a, b, z - s * 0.2, 0.45, z + s * 0.04, 0.45, up);
      if (d >= 2) {
        run(out, 'steel', 'rails', a, b, z, 0.79, z, 0.87, side(s));
        run(out, 'steel', 'rails', a, b, z - 0.044, 0.87, z + 0.044, 0.87, up);
      }
    }
    if (d >= 2) {
      for (let x = Math.ceil(from / 12) * 12; x < to - 0.3; x += d >= 3 ? 12 : 24) {
        if (blocked(x)) continue;
        const row = at(lane, x),
          z = s * (w - 0.14);
        beam(out, 'steel', offset(row, z, 0.44), offset(row, z, 0.83), 0.105, 0.118, color.rails);
      }
      const z = s * (w - 0.59);
      for (let i = 1; i < rows.length; i++)
        run(out, 'paved', 'marking', rows[i - 1], rows[i], z - 0.073, 0.021, z + 0.073, 0.021, up);
    }
  }
  if (d < 2) return;
  const dashStep = d === 2 ? 24 : 12;
  for (const z of [-1.7, 1.8])
    for (let x = Math.ceil(from / dashStep) * dashStep; x < to - 0.25; x += dashStep) {
      run(
        out,
        'paved',
        'marking',
        at(lane, x),
        at(lane, Math.min(to, x + (d === 2 ? 6.8 : 3.9))),
        z - 0.069,
        0.025,
        z + 0.069,
        0.025,
        up,
      );
    }
  const step = d === 2 ? 91 : d === 3 ? 44 : 38;
  for (let x = Math.ceil(from / step) * step + 4; x < to - 3; x += step) {
    if (window.some(([a, b]) => x > a && x < b)) continue;
    const z = (index === 0 ? -1 : 1) * (w - 0.23),
      s = Math.sign(z),
      row = at(lane, x),
      top = offset(row, z, 0.52),
      arm = offset(row, z - s * 0.56, 9.1);
    beam(out, 'steel', top, arm, 0.177, 0.177, color.bracing);
    const lamp = offset(row, z - s * 2.04, 9.28);
    beam(out, 'steel', arm, lamp, 0.104, 0.11, color.bracing);
    if (d >= 3)
      beam(out, 'steel', lamp, offset(row, z - s * 2.66, 9.25), 0.234, 0.123, color.light);
  }
}

const trackFrom = Math.min(northRail.rows[0][0], southRail.rows[0][0]),
  trackTo = Math.max(northRail.rows.at(-1)[0], southRail.rows.at(-1)[0]);
function centerTrack(x) {
  const a = at(northRail, x),
    b = at(southRail, x);
  return [x, mix(a[1], b[1], 0.5), mix(a[2], b[2], 0.5)];
}
function tracks(out, d) {
  const inputs = [
    trackFrom,
    trackTo,
    ...northRail.rows.map((r) => r[0]),
    ...southRail.rows.map((r) => r[0]),
  ];
  const track = {
    rows: [...new Set(inputs)]
      .sort((a, b) => a - b)
      .filter((x) => x >= trackFrom && x <= trackTo)
      .map(centerTrack),
  };
  slab(out, sample(track, [1.2, 0.42, 0.19, 0.08, 0.04][d]), 6.62, 2.67, 'ballast', 0.88, d);
  if (d === 0) return;
  for (const lane of [northRail, southRail]) {
    const rows = sample(lane, [1, 0.48, 0.16, 0.065, 0.04][d]),
      from = rows[0][0],
      to = rows.at(-1)[0];
    for (let j = 1; j < rows.length; j++) {
      const a = rows[j - 1],
        b = rows[j];
      for (const z of [-0.76, 0.76]) {
        run(out, 'steel', 'rails', a, b, z - 0.067, 0.254, z + 0.067, 0.254, up);
        if (d >= 2) {
          run(out, 'steel', 'hardware', a, b, z - 0.062, 0.126, z - 0.062, 0.255, side(-1));
          run(out, 'steel', 'hardware', a, b, z + 0.062, 0.126, z + 0.062, 0.255, side(1));
        }
      }
    }
    if (d < 2) continue;
    const step = d === 2 ? 4.5 : d === 3 ? 1.35 : 0.62;
    for (let x = Math.ceil(from / step) * step; x < to - 0.15; x += step) {
      const a = at(lane, x),
        b = at(lane, Math.min(to, x + (d === 2 ? 0.29 : 0.235)));
      run(out, 'paved', 'sleepers', a, b, -1.26, 0.138, 1.26, 0.138, up);
      if (d >= 3)
        for (const s of [-1, 1])
          run(out, 'paved', 'sleepers', a, b, s * 1.26, 0.028, s * 1.26, 0.138, side(s));
    }
  }
  if (d < 2) return;
  const step = d === 2 ? 84 : d === 3 ? 53 : 46;
  for (let x = Math.ceil(trackFrom / step) * step; x < trackTo - 5; x += step) {
    if (layout.archSpans.some((a) => Math.abs(a.from - x) < 5 || Math.abs(a.to - x) < 5)) continue;
    const row = centerTrack(x),
      foot = offset(row, 4.65, 0.07),
      upper = offset(row, 4.65, 7.0);
    beam(out, 'steel', foot, upper, 0.215, 0.26, color.hardware);
    beam(out, 'steel', upper, offset(row, -1.9, 6.37), 0.105, 0.135, color.hardware);
    if (d >= 3) {
      beam(
        out,
        'steel',
        offset(row, 4.65, 4.7),
        offset(row, 0.4, 6.53),
        0.091,
        0.097,
        color.hardware,
      );
      beam(
        out,
        'steel',
        offset(row, -0.83, 6.0),
        offset(row, -0.83, 6.58),
        0.134,
        0.14,
        color.insulator,
      );
    }
  }
  if (d >= 3) {
    const rows = sample(track, 0.15);
    for (const z of [-2.3, 2.25])
      for (let i = 1; i < rows.length; i++) {
        const a = rows[i - 1],
          b = rows[i];
        run(out, 'steel', 'wire', a, b, z, 5.88, z, 5.931, side(1));
      }
  }
}

function supports(out, d) {
  const piers = layout.piers;
  for (const [i, pier] of piers.entries()) {
    if (d === 0 && i % 4 !== 0 && !pier.arch) continue;
    const { x, floor, arch } = pier;
    const columns = layout.lanes.filter(
      (l) => l.kind === 'road' && x > l.rows[0][0] + 0.5 && x < l.rows.at(-1)[0] - 0.5,
    );
    const hasTrack = x > trackFrom && x < trackTo;
    const seats = columns.map((l) => at(l, x));
    if (hasTrack) seats.push(centerTrack(x));
    for (const [index, [, deck, z]] of seats.entries()) {
      if (d === 0 && index > 0 && !arch) continue;
      const pierWidth = arch ? 5.1 : 2.02,
        pierDepth = arch ? 5.8 : 3.7,
        bottom = Math.min(deck - 3.4, floor),
        top = deck - 2.17;
      if (top - bottom < 0.38) continue;
      const ring = (y, a, b) => [
        [x - a, y, z - b],
        [x + a, y, z - b],
        [x + a, y, z + b],
        [x - a, y, z + b],
      ];
      const rows = [
        ring(bottom, pierWidth * 0.51, pierDepth * 0.51),
        ring(top, pierWidth * 0.43, pierDepth * 0.46),
      ];
      if (d >= 2)
        rows.splice(
          1,
          0,
          ring(top - Math.min((top - bottom) * 0.32, 1.65), pierWidth * 0.41, pierDepth * 0.42),
        );
      for (let j = 1; j < rows.length; j++)
        for (let k = 0; k < 4; k++) {
          const l = (k + 1) % 4;
          face(
            out,
            'concrete',
            'pier',
            [rows[j - 1][k], rows[j - 1][l], rows[j][l], rows[j][k]],
            [side(-1), front, side(1), back][k],
          );
        }
      face(out, 'concrete', 'fascia', rows.at(-1), up);
      if (d >= 2) {
        const capW = arch ? 5.88 : 3.42;
        beam(
          out,
          'concrete',
          [x - capW / 2, top + 0.04, z],
          [x + capW / 2, top + 0.04, z],
          arch ? 8.7 : 5.34,
          0.69,
          color.fascia,
        );
      }
    }
    if (d >= 1 && hasTrack && columns.length === 2) {
      const a = at(columns[0], x),
        b = at(columns[1], x),
        y = Math.min(a[1], b[1], centerTrack(x)[1]) - 2.43;
      beam(
        out,
        'concrete',
        [x, y, a[2]],
        [x, y, b[2]],
        arch ? 5.7 : 3.14,
        arch ? 1.55 : 1.04,
        color.concrete,
      );
    }
  }
}
function arch(out, span, d) {
  const { from, to, rise, center, ribHalfSeparation } = span;
  const y = (t) => {
    const x = mix(from, to, t);
    return centerTrack(x)[1] + 0.65 + rise * Math.pow(Math.max(0, 4 * t * (1 - t)), 0.83);
  };
  const rib = (t, s) => [
    mix(from, to, t),
    y(t),
    center + s * (ribHalfSeparation - 0.19 * 4 * t * (1 - t)),
  ];
  const segments = [7, 13, 23, 36, 48][d];
  for (const s of [-1, 1]) {
    const points = Array.from({ length: segments + 1 }, (_, i) => rib(i / segments, s));
    beamPath(out, 'steel', points, 1.47, 2.2, color.arch);
    const count = d === 0 ? 3 : d === 1 ? 7 : 11;
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1),
        head = rib(t, s),
        lean = (t - 0.5) * (d === 0 ? 7.9 : 9.5);
      const x = head[0] + lean,
        y0 = centerTrack(x)[1],
        base = [x, y0 + 0.32, head[2]];
      beam(
        out,
        'steel',
        base,
        [head[0], head[1] - 0.76, head[2]],
        d === 0 ? 0.59 : 0.41,
        d === 0 ? 0.51 : 0.5,
        color.bracing,
      );
      if (d >= 3) {
        beam(
          out,
          'steel',
          [x, y0 + 0.1, head[2]],
          [x + lean * 0.14, y0 + 1.87, head[2]],
          0.72,
          0.74,
          color.arch,
        );
        const p0 = [head[0], head[1] - 1.04, head[2] - 0.31],
          p1 = [head[0], head[1] - 1.04, head[2] + 0.31];
        beam(out, 'steel', p0, p1, 0.68, 0.12, color.hardware);
      }
    }
    if (d >= 2)
      for (const t of [0, 1]) {
        const [x, y, z] = rib(t, s);
        beam(out, 'steel', [x - 2.45, y - 0.25, z], [x + 2.45, y - 0.25, z], 2.2, 1.19, color.arch);
        beam(
          out,
          'steel',
          [x - 1.65, y + 0.72, z],
          [x + 1.65, y + 0.72, z],
          1.88,
          0.31,
          color.bracing,
        );
      }
  }
  const bridges = d === 0 ? [0.5] : [0.18, 0.29, 0.4, 0.5, 0.6, 0.71, 0.82];
  for (const t of bridges) {
    const a = rib(t, -1),
      b = rib(t, 1);
    beam(out, 'steel', a, b, d === 0 ? 1.28 : 1.51, 0.93, color.arch);
    if (d >= 3) {
      beam(out, 'steel', offset(a, 0, 0.64), offset(b, 0, 0.64), 0.83, 0.21, color.bracing);
    }
  }
}
export function buildDarnytskyiLevel(out, level) {
  const d = detail[level];
  if (d === undefined) throw Error(`Unknown Darnytskyi Bridge LOD ${level}`);
  road(out, northRoad, d, 0);
  road(out, southRoad, d, 1);
  tracks(out, d);
  supports(out, d);
  for (const span of layout.archSpans) arch(out, span, d);
}
export const buildSkyline = (out) => buildDarnytskyiLevel(out, 'skyline');
export const buildDistrict = (out) => buildDarnytskyiLevel(out, 'district');
export const buildStreet = (out) => buildDarnytskyiLevel(out, 'street');
export const buildCloseup = (out) => buildDarnytskyiLevel(out, 'closeup');
export const buildMaster = (out) => buildDarnytskyiLevel(out, 'master');
