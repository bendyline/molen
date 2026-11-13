/** Zaporizhzhia's Old Dnipro steel deck arch in its signed map frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.91 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.89 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.69, metallic: 0.18 },
  rock: { slot: 'wall', graph: 'stone_granite', roughness: 0.96 },
};
const tints = {
  pavement: '454a51',
  mark: 'e5e4d8',
  concrete: 'c4bbac',
  facing: 'b6aca1',
  soffit: 'a39b8d',
  rock: '918374',
  cap: 'aea18f',
  rust: '8f7260',
  rib: '775c51',
  girder: '7c756d',
  lattice: '837369',
  rail: 'a5ada9',
  lamps: 'bac3bc',
  glass: 'e5e0c8',
  joint: '6c675e',
  catwalk: '8f8780',
};
const color = Object.fromEntries(
  Object.entries(tints).map(([name, hex]) => [
    name,
    hex.match(/../g).map((pair) => {
      const n = parseInt(pair, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const lods = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const {
  rows,
  ends,
  physicalDeck,
  archEnds,
  archCrown,
  bearingSupports,
  supports,
  footBranch,
  ramps,
} = layout;
const halfRoad = layout.dimensions.roadWidth / 2,
  halfDeck = halfRoad + layout.dimensions.sidewalkWidth;
const up = [0, 1, 0],
  down = [0, -1, 0],
  side = (s) => [0, 0, s],
  front = (s) => [s, 0, 0];
const mix = (a, b, t) => a + (b - a) * t;
function at(x, curve = rows) {
  const j = curve.findIndex((r) => r[0] >= x);
  if (j <= 0) return [x, ...curve[j < 0 ? curve.length - 1 : 0].slice(1, 3)];
  const [a, b] = curve.slice(j - 1, j + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return [x, mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
const p = ([x, y, z], offset = 0, lift = 0) => [x, y + lift, z + offset];
function face(out, slot, tint, [a, b, c, d], want) {
  for (let points of [
    [a, b, c],
    [a, c, d],
  ]) {
    let normal = normalFor(...points);
    if (Math.hypot(...normal) < 0.9) continue;
    if (normal.reduce((n, v, i) => n + v * want[i], 0) < 0) {
      points = points.toReversed();
      normal = normal.map((v) => -v);
    }
    out.addTriangle(slot, '', points, normal, undefined, color[tint]);
  }
}
function strip(out, slot, tint, a, b, z0, y0, z1, y1, n) {
  face(out, slot, tint, [p(a, z0, y0), p(b, z0, y0), p(b, z1, y1), p(a, z1, y1)], n);
}
function run(from, to, d) {
  const stations = [
    from,
    to,
    ...rows.map((r) => r[0]).filter((x) => x > from + 0.015 && x < to - 0.015),
  ];
  return [...new Set(stations)]
    .sort((a, b) => a - b)
    .filter((_, i, a) => d > 0 || i === 0 || i === a.length - 1 || i % 2 === 0)
    .map((x) => at(x));
}
function bridgeDeck(out, d) {
  const samples = run(...ends, d);
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1],
      b = samples[i],
      main = (a[0] + b[0]) / 2 > physicalDeck[0] && (a[0] + b[0]) / 2 < physicalDeck[1];
    strip(out, 'deck', 'pavement', a, b, -halfRoad, 0, halfRoad, 0, up);
    if (main) strip(out, 'concrete', 'soffit', a, b, -halfDeck, -0.49, halfDeck, -0.49, down);
    for (const sign of [-1, 1]) {
      const w = sign * halfDeck,
        inset = sign * halfRoad;
      strip(out, 'deck', 'concrete', a, b, inset, 0.167, w, 0.167, up);
      if (d > 0) strip(out, 'concrete', 'facing', a, b, inset, 0, inset, 0.167, side(-sign));
      strip(out, 'concrete', 'facing', a, b, w, 0.168, w, -0.47, side(sign));
      if (main) {
        const edge = sign * 5.28;
        strip(out, 'steel', 'girder', a, b, edge, -0.49, edge, -1.72, side(sign));
        if (d > 0)
          strip(out, 'steel', 'girder', a, b, edge - sign * 0.38, -1.72, edge, -1.72, down);
      }
    }
  }
  if (d >= 2) {
    const step = d === 2 ? 11.4 : d === 3 ? 5.4 : 3.8;
    for (let x = physicalDeck[0] + 1.8; x < physicalDeck[1] - 0.8; x += step) {
      const a = at(x);
      beam(
        out,
        'steel',
        p(a, -8.97, -0.49),
        p(a, 8.97, -0.49),
        d === 2 ? 0.18 : 0.25,
        0.39,
        color.girder,
      );
    }
  }
}
function approach(out, d, index) {
  const from = index === 0 ? ends[0] : physicalDeck[1],
    to = index === 0 ? physicalDeck[0] : ends[1],
    a = at(from),
    b = at(to);
  const left = ramps[index * 2],
    right = ramps[index * 2 + 1];
  for (const sign of [-1, 1]) {
    const i = sign === -1 ? 0 : 1,
      w = sign * halfDeck,
      base = sign * (halfDeck + 2.6);
    const pa = [a[0], left.outerGround[i], a[2] + base],
      pb = [b[0], right.outerGround[i], b[2] + base];
    face(out, 'rock', 'rock', [pa, pb, p(b, w, -0.48), p(a, w, -0.48)], side(sign));
    if (d >= 1) {
      strip(out, 'concrete', 'cap', a, b, w * 0.999, -0.47, w * 0.999, -0.73, side(sign));
      const end = index === 0 ? b : a,
        s = index === 0 ? 1 : -1,
        h = index === 0 ? right.outerGround[i] : left.outerGround[i];
      face(
        out,
        'concrete',
        'facing',
        [p(end, w, -0.68), p(end, 0, -0.68), [end[0], h, end[2]], [end[0], h, end[2] + base]],
        front(s),
      );
    }
  }
}
function archY(x) {
  const [a, b] = archEnds,
    t = (x - a) / (b - a);
  const low = bearingSupports[0].heelY,
    high = bearingSupports[1].heelY;
  return mix(low, high, t) + (archCrown - (low + high) / 2) * 4 * t * (1 - t);
}
const ribHalf = 4.86;
function ribPoint(x, side) {
  const row = at(x);
  return [x, archY(x), row[2] + side * ribHalf];
}
function plinth(out, foot, d, sign, index) {
  const row = at(foot.x),
    z = row[2] + sign * ribHalf,
    top = foot.heelY - 0.56,
    bottom = foot.floors[index];
  const floor = [
    [foot.x - 3.51, bottom, z - 2.55],
    [foot.x + 3.51, bottom, z - 2.55],
    [foot.x + 3.51, bottom, z + 2.55],
    [foot.x - 3.51, bottom, z + 2.55],
  ];
  const crown = [
    [foot.x - 2.59, top, z - 1.72],
    [foot.x + 2.59, top, z - 1.72],
    [foot.x + 2.59, top, z + 1.72],
    [foot.x - 2.59, top, z + 1.72],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      out,
      'concrete',
      'facing',
      [floor[i], floor[j], crown[j], crown[i]],
      [side(-1), front(1), side(1), front(-1)][i],
    );
  }
  face(out, 'concrete', 'cap', crown, up);
  if (d > 0)
    beam(
      out,
      'steel',
      [foot.x - 1.46, top + 0.14, z],
      [foot.x + 1.46, top + 0.14, z],
      1.96,
      0.47,
      color.girder,
    );
  if (d >= 2)
    beam(
      out,
      'steel',
      [foot.x, top + 0.44, z - 1.02],
      [foot.x, top + 0.44, z + 1.02],
      1.2,
      0.82,
      color.rust,
    );
}
function steelArch(out, d) {
  const [from, to] = archEnds,
    count = [10, 17, 23, 37, 48][d];
  const stations = Array.from({ length: count + 1 }, (_, i) => mix(from, to, i / count));
  for (const sign of [-1, 1]) {
    beamPath(
      out,
      'steel',
      stations.map((x) => ribPoint(x, sign)),
      d === 0 ? 1.12 : 0.96,
      1.55,
      color.rib,
    );
    if (d >= 3) {
      const inner = stations.map((x) => {
        const [u, y, z] = ribPoint(x, sign);
        return [u, y + 0.83, z - sign * 0.32];
      });
      beamPath(out, 'steel', inner, 0.47, 0.093, color.rust);
    }
  }
  const posts = layout.bays.filter((x) => x > from + 0.35 && x < to - 0.35);
  for (const [i, x] of posts.entries()) {
    if (d === 0 && i % 2 === 1) continue;
    const row = at(x),
      top = row[1] - 1.38;
    for (const sign of [-1, 1]) {
      const base = ribPoint(x, sign),
        z = base[2];
      if (top - base[1] > 0.41)
        beam(out, 'steel', base, [x, top, z], d === 0 ? 0.65 : 0.51, 0.57, color.rust);
      if (d >= 2)
        beam(
          out,
          'steel',
          [x, base[1] + 0.53, z],
          [x, base[1] + 1.44, z],
          0.76,
          0.75,
          color.girder,
        );
    }
    if (d >= 1)
      beam(out, 'steel', p(row, -ribHalf, -1.57), p(row, ribHalf, -1.57), 0.58, 0.72, color.girder);
  }
  const bracing = [from, ...posts, to];
  for (let i = 1; i < bracing.length; i++) {
    const a = bracing[i - 1],
      b = bracing[i];
    if (d === 0 && i % 3 !== 0) continue;
    const l = ribPoint(b, -1),
      r = ribPoint(b, 1);
    beam(out, 'steel', l, r, 0.48, 0.42, color.lattice);
    if (d >= 1) {
      const side = i % 2 ? 1 : -1;
      beam(out, 'steel', ribPoint(a, side), ribPoint(b, -side), 0.29, 0.33, color.lattice);
      if (d >= 2)
        beam(out, 'steel', ribPoint(a, -side), ribPoint(b, side), 0.25, 0.28, color.lattice);
    }
    if (d >= 3) {
      const aRow = at(a),
        bRow = at(b),
        z = -ribHalf + 0.64;
      strip(
        out,
        'steel',
        'catwalk',
        [a, archY(a) + 0.91, aRow[2]],
        [b, archY(b) + 0.91, bRow[2]],
        z - 0.37,
        0,
        z + 0.37,
        0,
        up,
      );
    }
  }
  for (const support of bearingSupports)
    for (const [i, side] of [-1, 1].entries()) plinth(out, support, d, side, i);
}
function endPosts(out, d) {
  for (const [i, support] of supports.entries()) {
    if (d === 0 && i % 2 === 1) continue;
    const row = at(support.x),
      top = row[1] - 1.65;
    for (const [index, sign] of [-1, 1].entries()) {
      const z = row[2] + sign * ribHalf,
        low = support.floors[index];
      const baseHeight = Math.min(top - 0.54, low + 1.62);
      beam(out, 'concrete', [row[0], low, z], [row[0], baseHeight, z], 1.81, 1.68, color.concrete);
      beam(
        out,
        'steel',
        [row[0], baseHeight, z],
        [row[0], top, z],
        d === 0 ? 0.78 : 0.58,
        0.72,
        color.girder,
      );
    }
    if (d >= 1) {
      beam(out, 'steel', p(row, -ribHalf, -1.67), p(row, ribHalf, -1.67), 0.82, 0.75, color.girder);
      if (d >= 2) {
        const low = Math.max(...support.floors) + 2.14;
        if (top - low > 4.6) {
          const z = row[2];
          beam(
            out,
            'steel',
            [row[0], low, z - ribHalf],
            [row[0], top - 1.33, z + ribHalf],
            0.22,
            0.28,
            color.lattice,
          );
          beam(
            out,
            'steel',
            [row[0], low, z + ribHalf],
            [row[0], top - 1.33, z - ribHalf],
            0.22,
            0.28,
            color.lattice,
          );
        }
      }
    }
  }
}
function footway(out, d) {
  const width = 1.07;
  for (let i = 1; i < footBranch.length; i++) {
    const a = footBranch[i - 1],
      b = footBranch[i];
    strip(out, 'deck', 'concrete', a, b, -width, 0, width, 0, up);
    for (const sign of [-1, 1]) {
      const w = sign * width;
      strip(out, 'concrete', 'facing', a, b, w, 0, w, -0.39, side(sign));
      if (d >= 1) strip(out, 'steel', 'rail', a, b, w, 0.89, w, 1.0, side(sign));
    }
    if (d >= 1 && i % 2 === 0 && b[1] - b[3] > 1.2)
      beam(out, 'concrete', [b[0], b[3], b[2]], [b[0], b[1] - 0.33, b[2]], 0.69, 0.78, color.cap);
  }
}
function furniture(out, d) {
  if (!d) return;
  const samples = run(...physicalDeck, d);
  for (const sign of [-1, 1]) {
    const z = sign * (halfDeck - 0.092),
      opening = (x) => sign === -1 && x > 122.8 && x < 143;
    const guardRows = [...samples, at(122.8), at(143)].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < guardRows.length; i++) {
      const a = guardRows[i - 1],
        b = guardRows[i];
      if (opening((a[0] + b[0]) / 2)) continue;
      strip(out, 'steel', 'rail', a, b, z, 1.086, z, 1.179, side(sign));
      if (d >= 2) {
        strip(out, 'steel', 'rail', a, b, z - 0.038, 1.18, z + 0.038, 1.18, up);
        strip(out, 'steel', 'rail', a, b, z, 0.349, z, 0.407, side(sign));
        strip(
          out,
          'steel',
          'rail',
          a,
          b,
          z - sign * 0.032,
          1.086,
          z - sign * 0.032,
          1.179,
          side(-sign),
        );
        strip(
          out,
          'steel',
          'rail',
          a,
          b,
          z - sign * 0.022,
          0.349,
          z - sign * 0.022,
          0.407,
          side(-sign),
        );
      }
    }
    if (d >= 2) {
      const balusterStep = d === 2 ? 0.83 : d === 3 ? 0.31 : 0.195;
      for (let x = physicalDeck[0] + 0.17; x < physicalDeck[1] - 0.16; x += balusterStep) {
        if (opening(x)) continue;
        const a = at(x - 0.018),
          b = at(x + 0.018);
        strip(out, 'steel', 'rail', a, b, z, 0.367, z, 1.096, side(sign));
        strip(
          out,
          'steel',
          'rail',
          a,
          b,
          z - sign * 0.022,
          0.367,
          z - sign * 0.022,
          1.096,
          side(-sign),
        );
      }
      const step = d === 2 ? 5.1 : d === 3 ? 1.32 : 0.54;
      for (let x = physicalDeck[0] + 1.3; x < physicalDeck[1] - 0.25; x += step) {
        if (opening(x)) continue;
        const row = at(x),
          width = d === 2 ? 0.109 : 0.061;
        beam(out, 'steel', p(row, z, 0.169), p(row, z, 1.172), width, width, color.rail);
      }
      const lampStep = d === 2 ? 53 : 30;
      for (let x = physicalDeck[0] + 9; x < physicalDeck[1] - 3; x += lampStep) {
        const row = at(x),
          z = sign * 7.57,
          top = p(row, z, 7.77),
          end = p(row, z - sign * 1.28, 8.72);
        beam(out, 'steel', p(row, z, 0.18), top, 0.127, 0.127, color.lamps);
        beam(out, 'steel', top, end, 0.103, 0.103, color.lamps);
        if (d >= 3)
          beam(out, 'steel', end, p(row, z - sign * 1.64, 8.77), 0.162, 0.096, color.glass);
      }
    }
  }
  if (d < 2) return;
  for (const z of [-6.6, 6.6, -0.093, 0.093]) {
    const route = run(...ends, d);
    for (let i = 1; i < route.length; i++)
      strip(out, 'deck', 'mark', route[i - 1], route[i], z - 0.046, 0.021, z + 0.046, 0.021, up);
  }
  const spacing = d === 2 ? 14 : 9;
  for (let x = ends[0] + 2; x < ends[1] - 0.32; x += spacing)
    for (const z of [-3.45, 3.45]) {
      strip(
        out,
        'deck',
        'mark',
        at(x),
        at(Math.min(ends[1], x + (d === 2 ? 4.5 : 3))),
        z - 0.062,
        0.022,
        z + 0.062,
        0.022,
        up,
      );
    }
}
export function buildArcualLevel(out, level) {
  const d = lods[level];
  if (d === undefined) throw Error(`Unknown Zaporizhzhia arch bridge LOD ${level}`);
  bridgeDeck(out, d);
  approach(out, d, 0);
  approach(out, d, 1);
  steelArch(out, d);
  endPosts(out, d);
  footway(out, d);
  furniture(out, d);
}
export const buildSkyline = (out) => buildArcualLevel(out, 'skyline');
export const buildDistrict = (out) => buildArcualLevel(out, 'district');
export const buildStreet = (out) => buildArcualLevel(out, 'street');
export const buildCloseup = (out) => buildArcualLevel(out, 'closeup');
export const buildMaster = (out) => buildArcualLevel(out, 'master');
