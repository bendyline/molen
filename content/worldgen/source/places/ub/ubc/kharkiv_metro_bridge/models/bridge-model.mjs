/** Saltivska Line enclosed metro viaduct in its signed PMTiles frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  structure: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.88 },
  finish: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  panel: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.68, metallic: 0.12 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.68, metallic: 0.18 },
};
const colors = {
  deck: 'b5afa3',
  column: 'bcb6aa',
  cap: 'a49d91',
  soffit: 'a0998c',
  joint: '969189',
  roof: 'adb7ba',
  skirt: '8fc5cf',
  wall: 'e3e2d8',
  shade: 'bfc8c7',
  rim: 'a9b7b4',
  rails: '6f7674',
  ballast: '847c6d',
  sleepers: '938a7d',
  portal: 'b3ada1',
  interior: '999d95',
  gravel: '9b9484',
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
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { rows, roofFrom, roofTo, bays, piers, ends } = layout;
const up = [0, 1, 0],
  down = [0, -1, 0],
  side = (s) => [0, 0, s],
  cross = (s) => [s, 0, 0];
const mix = (a, b, t) => a + (b - a) * t;
const roofEave = 3.58,
  roofPeak = 5.46,
  shoulder = 4.77,
  halfDeck = 6.74,
  wallZ = 4.94;
function at(x, curve = rows) {
  const i = curve.findIndex((row) => row[0] >= x);
  if (i <= 0) return [x, ...curve[i < 0 ? curve.length - 1 : 0].slice(1)];
  const [a, b] = curve.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return [x, mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
const p = (row, z, y) => [row[0], row[1] + y, row[2] + z];
function face(out, slot, tint, [a, b, c, d], want) {
  for (let points of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...points);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((acc, v, i) => acc + v * want[i], 0) < 0) {
      points = points.toReversed();
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', points, n, undefined, color[tint]);
  }
}
function strip(out, slot, tint, a, b, z0, y0, z1, y1, n) {
  face(out, slot, tint, [p(a, z0, y0), p(b, z0, y0), p(b, z1, y1), p(a, z1, y1)], n);
}
function sample(from, to, step) {
  const points = [from, to, ...rows.map((r) => r[0]).filter((x) => x > from && x < to)];
  if (step > 0) for (let x = from + step; x < to - 0.02; x += step) points.push(x);
  return [...new Set(points)]
    .sort((a, b) => a - b)
    .filter((x, i, a) => !i || x - a[i - 1] > 0.025)
    .map((x) => at(x));
}
function deck(out, d) {
  const run = sample(roofFrom, roofTo, 0);
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1],
      b = run[i];
    strip(out, 'finish', 'deck', a, b, -halfDeck, 0, halfDeck, 0, up);
    strip(out, 'structure', 'soffit', a, b, -halfDeck, -0.49, halfDeck, -0.49, down);
    for (const s of [-1, 1]) {
      const w = halfDeck * s;
      strip(out, 'structure', 'deck', a, b, w, 0, w, -0.5, side(s));
      if (d === 1) strip(out, 'structure', 'cap', a, b, s * 4.37, -0.48, s * 4.19, -1.36, side(s));
      if (d >= 1) {
        strip(out, 'structure', 'cap', a, b, w * 0.96, -0.52, w * 0.88, -1.37, side(s));
        strip(out, 'structure', 'soffit', a, b, w * 0.88, -1.37, w * 0.82, -1.37, down);
      }
    }
    if (d === 1) strip(out, 'structure', 'soffit', a, b, -4.19, -1.36, 4.19, -1.36, down);
    if (d >= 2)
      for (const z of [-4.12, -2.06, 0, 2.06, 4.12]) {
        strip(out, 'structure', 'soffit', a, b, z - 0.32, -1.35, z + 0.32, -1.35, down);
        for (const s of [-1, 1])
          strip(out, 'structure', 'deck', a, b, z + s * 0.32, -0.48, z + s * 0.32, -1.36, side(s));
      }
  }
}
function pier(out, d, index, { x, floor }) {
  if (d === 0 && index % 4 !== 0) return;
  const row = at(x),
    top = row[1] - (d === 0 ? 0.46 : 1.79),
    bottom = Math.min(top - 0.46, floor),
    sides = [4, 6, 8, 10, 14][d];
  const offsets = d === 0 ? [0] : [-3.43, 3.43];
  for (const z of offsets) {
    const radial = Array.from({ length: sides }, (_, i) => [
      Math.cos((i * 2 * Math.PI) / sides),
      Math.sin((i * 2 * Math.PI) / sides),
    ]);
    const ring = (y, r) => radial.map(([u, v]) => [x + r * u, y, row[2] + z + r * v]);
    const low = ring(bottom, 0.68),
      high = ring(top, 0.61);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      face(
        out,
        'structure',
        'column',
        [low[i], low[j], high[j], high[i]],
        [radial[i][0] + radial[j][0], 0, radial[i][1] + radial[j][1]],
      );
    }
    if (d >= 3) {
      const lip = ring(top - 0.22, 0.64);
      for (let i = 0; i < sides; i++) {
        const j = (i + 1) % sides;
        face(
          out,
          'structure',
          'joint',
          [lip[i], lip[j], high[j], high[i]],
          [radial[i][0] + radial[j][0], 0, radial[i][1] + radial[j][1]],
        );
      }
    }
  }
  if (d > 0) {
    beam(
      out,
      'structure',
      [x, top + 0.25, row[2] - 5.83],
      [x, top + 0.25, row[2] + 5.83],
      1.86,
      0.72,
      color.cap,
    );
    if (d >= 2)
      for (const z of [-4.43, -2.25, 0, 2.25, 4.43]) {
        beam(out, 'steel', p(row, z, -1.43), p(row, z, -1.29), 0.48, 0.52, color.joint);
      }
  }
}
function roof(out, d) {
  const run = sample(roofFrom, roofTo, 0);
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1],
      b = run[i];
    for (const s of [-1, 1]) {
      const w = wallZ * s;
      strip(out, 'steel', 'wall', a, b, w, 0, w, roofEave, side(s));
      const eave = s * 5.15;
      if (d === 0) strip(out, 'panel', 'roof', a, b, 0, roofPeak, eave, roofEave, up);
      else {
        strip(out, 'panel', 'roof', a, b, 0, roofPeak, s * 3.05, shoulder, up);
        strip(out, 'panel', 'roof', a, b, s * 3.05, shoulder, eave, roofEave, up);
      }
      if (d >= 2) {
        strip(out, 'steel', 'rim', a, b, eave, roofEave - 0.03, eave, roofEave + 0.084, side(s));
        strip(
          out,
          'steel',
          'rim',
          a,
          b,
          s * 0.013,
          roofPeak + 0.035,
          s * 0.121,
          roofPeak - 0.01,
          up,
        );
      }
      if (d >= 3) {
        strip(
          out,
          'steel',
          'interior',
          a,
          b,
          s * (wallZ - 0.08),
          0,
          s * (wallZ - 0.08),
          roofEave - 0.15,
          side(-s),
        );
        strip(out, 'panel', 'interior', a, b, 0, roofPeak - 0.17, s * 3.03, shoulder - 0.17, down);
        strip(
          out,
          'panel',
          'interior',
          a,
          b,
          s * 3.03,
          shoulder - 0.17,
          s * (wallZ - 0.08),
          roofEave - 0.15,
          down,
        );
      }
    }
  }
}
const profiles = [
  [
    [0, 0.23],
    [0.23, 2.88],
    [0.77, 2.88],
    [1, 0.23],
  ],
  [
    [0, 0.23],
    [0.09, 1.56],
    [0.24, 2.86],
    [0.5, 3.21],
    [0.76, 2.86],
    [0.91, 1.56],
    [1, 0.23],
  ],
  [
    [0, 0.23],
    [0.068, 1.46],
    [0.206, 2.66],
    [0.355, 3.14],
    [0.5, 3.29],
    [0.645, 3.14],
    [0.794, 2.66],
    [0.932, 1.46],
    [1, 0.23],
  ],
];
const edgeWidth = (y) => 5.15 + (roofEave - y) * 0.323;
function skirt(out, d) {
  const profile = profiles[Math.min(d, 2)];
  for (let i = 1; i < bays.length; i++) {
    const from = bays[i - 1],
      to = bays[i],
      width = to - from;
    for (const s of [-1, 1]) {
      for (let j = 1; j < profile.length; j++) {
        const [f, h] = profile[j - 1],
          [g, k] = profile[j],
          a = at(mix(from, to, f)),
          b = at(mix(from, to, g));
        const eave = 5.15 * s,
          za = edgeWidth(h) * s,
          zb = edgeWidth(k) * s;
        face(
          out,
          'panel',
          'skirt',
          [p(a, za, h), p(b, zb, k), p(b, eave, roofEave), p(a, eave, roofEave)],
          side(s),
        );
        if (d >= 2) {
          face(
            out,
            'steel',
            'rim',
            [p(a, za, h - 0.075), p(b, zb, k - 0.075), p(b, zb, k + 0.01), p(a, za, h + 0.01)],
            side(s),
          );
          face(
            out,
            'steel',
            'shade',
            [
              p(a, za, h - 0.075),
              p(b, zb, k - 0.075),
              p(b, wallZ * s, k - 0.075),
              p(a, wallZ * s, h - 0.075),
            ],
            down,
          );
        }
      }
      if (d >= 3) {
        for (const y of [0.63, 1.3, 1.97, 2.64]) {
          const z = s * (wallZ + 0.004),
            a = at(from),
            b = at(to);
          strip(out, 'steel', 'shade', a, b, z, y - 0.008, z, y + 0.009, side(s));
        }
        for (const t of [0.205, 0.5, 0.795]) {
          const row = at(from + t * width),
            z = s * (wallZ + 0.028);
          beam(out, 'steel', p(row, z, 0.02), p(row, z, roofEave - 0.014), 0.034, 0.033, color.rim);
        }
      }
    }
  }
}
function portal(out, d, end) {
  const isWest = end === 0,
    x = ends[end],
    other = isWest ? roofFrom : roofTo,
    s = isWest ? -1 : 1;
  const a = at(x),
    b = at(other),
    width = halfDeck - 0.06,
    ceiling = isWest ? 4.46 : 4.43;
  strip(out, 'structure', 'portal', a, b, -width, ceiling, width, ceiling, up);
  strip(out, 'structure', 'soffit', a, b, -width, ceiling - 0.39, width, ceiling - 0.39, down);
  strip(out, 'finish', 'ballast', a, b, -width, 0.018, width, 0.018, up);
  for (const h of [-1, 1]) {
    const z = h * width;
    strip(out, 'structure', 'portal', a, b, z, -0.68, z, ceiling, side(h));
    strip(
      out,
      'structure',
      'interior',
      a,
      b,
      z - h * 0.46,
      -0.65,
      z - h * 0.46,
      ceiling - 0.36,
      side(-h),
    );
    face(
      out,
      'structure',
      'portal',
      [p(a, z, -0.64), p(a, z - h * 0.47, -0.64), p(a, z - h * 0.47, ceiling), p(a, z, ceiling)],
      cross(s),
    );
  }
  const [endX, grade] = layout.portalGrades[end],
    buried = [endX, grade, a[2]],
    outer = width * 0.87;
  face(
    out,
    'structure',
    'portal',
    [p(a, -width, ceiling), p(buried, -outer, 0), p(buried, outer, 0), p(a, width, ceiling)],
    up,
  );
  for (const h of [-1, 1]) {
    const eaveIntersection = 3.05 + ((5.15 - 3.05) * (shoulder - ceiling)) / (shoulder - roofEave);
    face(
      out,
      'structure',
      'portal',
      [
        p(b, 0, roofPeak),
        p(b, h * 3.05, shoulder),
        p(b, h * eaveIntersection, ceiling),
        p(b, 0, ceiling),
      ],
      cross(s),
    );
    face(
      out,
      'structure',
      'portal',
      [
        p(a, h * width, -1.16),
        p(buried, h * outer, -1.22),
        p(buried, h * outer, 0),
        p(a, h * width, ceiling),
      ],
      side(h),
    );
  }
  face(
    out,
    'structure',
    'portal',
    [p(buried, -outer, -1.2), p(buried, outer, -1.2), p(buried, outer, 0), p(buried, -outer, 0)],
    cross(s),
  );
  if (d >= 2)
    for (const h of [-1, 1]) {
      const wallA = at(x + s * 8.7),
        wallB = at(other - s * 2.1),
        z = h * 6.88;
      const topA = isWest ? 0.75 : 1.04,
        topB = 2.05;
      face(
        out,
        'structure',
        'portal',
        [p(wallA, z, -1.88), p(wallB, z, -1.88), p(wallB, z, topB), p(wallA, z, topA)],
        side(h),
      );
      face(
        out,
        'structure',
        'cap',
        [
          p(wallA, z - h * 0.37, topA),
          p(wallB, z - h * 0.37, topB),
          p(wallB, z, topB),
          p(wallA, z, topA),
        ],
        up,
      );
      face(
        out,
        'structure',
        'interior',
        [
          p(wallA, z - h * 0.37, -1.88),
          p(wallB, z - h * 0.37, -1.88),
          p(wallB, z - h * 0.37, topB),
          p(wallA, z - h * 0.37, topA),
        ],
        side(-h),
      );
    }
}
function hardware(out, d) {
  if (d < 2) return;
  const run = sample(roofFrom, roofTo, 0),
    railHeights = d === 2 ? [0.91] : [0.52, 0.91];
  for (const s of [-1, 1]) {
    const z = s * (halfDeck - 0.16);
    for (const h of railHeights)
      for (let i = 1; i < run.length; i++) {
        const a = run[i - 1],
          b = run[i];
        strip(out, 'steel', 'rails', a, b, z, h - 0.047, z, h + 0.047, side(s));
        strip(out, 'steel', 'rails', a, b, z - 0.035, h + 0.047, z + 0.035, h + 0.047, up);
      }
    const step = d === 2 ? 14 : d === 3 ? 6.3 : 4.25;
    for (let x = roofFrom + 2; x < roofTo - 0.6; x += step) {
      const row = at(x);
      beam(out, 'steel', p(row, z, 0.035), p(row, z, 0.936), 0.062, 0.069, color.rails);
    }
  }
  if (d < 3) return;
  for (let i = 1; i < run.length; i++) {
    const a = run[i - 1],
      b = run[i];
    strip(out, 'steel', 'rails', a, b, 0.42, roofPeak + 0.51, 0.42, roofPeak + 0.563, side(1));
  }
  for (let x = roofFrom + 3; x < roofTo - 2; x += d === 3 ? 12.4 : 8.4) {
    const row = at(x);
    beam(
      out,
      'steel',
      p(row, 0.42, roofPeak - 0.04),
      p(row, 0.42, roofPeak + 0.55),
      0.063,
      0.055,
      color.rails,
    );
  }
}
function tracks(out, d) {
  if (d < 3) return;
  for (const lane of layout.lanes) {
    const first = lane.rows[0][0],
      last = lane.rows.at(-1)[0];
    const railAt = (x) => {
      const [, , z] = at(x, lane.rows);
      return [x, at(x)[1], z];
    };
    const run = sample(first, last, 0).map((r) => railAt(r[0]));
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1],
        b = run[i];
      strip(out, 'finish', 'ballast', a, b, -1.52, 0.027, 1.52, 0.027, up);
      for (const z of [-0.76, 0.76]) {
        strip(out, 'steel', 'rails', a, b, z - 0.051, 0.193, z + 0.051, 0.193, up);
        strip(out, 'steel', 'rails', a, b, z + 0.046, 0.085, z + 0.046, 0.193, side(1));
        strip(out, 'steel', 'rails', a, b, z - 0.046, 0.085, z - 0.046, 0.193, side(-1));
      }
      strip(out, 'steel', 'rails', a, b, 1.33, 0.23, 1.385, 0.23, up);
    }
    const step = d === 4 ? 0.66 : 2.25;
    for (let x = first + 0.4; x < last - 0.33; x += step)
      strip(out, 'finish', 'sleepers', railAt(x), railAt(x + 0.23), -1.22, 0.09, 1.22, 0.09, up);
  }
}
export function buildKharkivLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error(`Unknown Kharkiv Metro Bridge level ${level}`);
  deck(out, d);
  roof(out, d);
  skirt(out, d);
  for (const [i, s] of piers.entries()) pier(out, d, i, s);
  for (const end of [0, 1]) portal(out, d, end);
  hardware(out, d);
  tracks(out, d);
}
export const buildSkyline = (out) => buildKharkivLevel(out, 'skyline');
export const buildDistrict = (out) => buildKharkivLevel(out, 'district');
export const buildStreet = (out) => buildKharkivLevel(out, 'street');
export const buildCloseup = (out) => buildKharkivLevel(out, 'closeup');
export const buildMaster = (out) => buildKharkivLevel(out, 'master');
