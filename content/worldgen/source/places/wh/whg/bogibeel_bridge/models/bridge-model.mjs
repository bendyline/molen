/** Bogibeel Bridge's upper highway, twin lower tracks, steel trusses and paired piers. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.08 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  road: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  ballast: { slot: 'foundation', graph: 'gravel', roughness: 0.95 },
  tie: { slot: 'foundation', graph: 'wood_plain', roughness: 0.95 },
};
const tones = {
  steel: [0.48, 0.55, 0.58],
  lower: [0.33, 0.38, 0.4],
  shadow: [0.26, 0.3, 0.32],
  bright: [0.62, 0.68, 0.69],
  concrete: [0.66, 0.67, 0.62],
  wet: [0.37, 0.42, 0.4],
  base: [0.49, 0.52, 0.48],
  asphalt: [0.105, 0.111, 0.114],
  shoulder: [0.15, 0.157, 0.154],
  white: [0.82, 0.82, 0.73],
  black: [0.08, 0.086, 0.085],
  roadMark: [0.8, 0.79, 0.69],
  ballast: [0.39, 0.36, 0.31],
  tie: [0.33, 0.29, 0.24],
  rail: [0.61, 0.63, 0.61],
  railSide: [0.31, 0.32, 0.3],
  joint: [0.19, 0.2, 0.195],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  white = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, tones[tone]);
const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a - b);
function triangle(out, slot, tone, points, direction) {
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * direction[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) > 0.5) out.addTriangle(slot, white, points, n, undefined, tones[tone]);
}
function quad(out, slot, tone, a, b, c, d, n) {
  triangle(out, slot, tone, [a, b, c], n);
  triangle(out, slot, tone, [a, c, d], n);
}
function rowAt(rows, x) {
  const i = rows.findIndex((p) => p[0] >= x);
  if (i === 0) return rows[0].slice(1);
  if (i < 0) return rows.at(-1).slice(1);
  const [a, b] = rows.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, k) => mix(v, b[k + 1], t));
}
export const roadAt = (x) => rowAt(layout.road, x);
export const railAt = (x, i) => rowAt(layout.railRows[i], x);
const P = (x, y, z) => [x, y, z];
const upper = (x, z = 0, y = 0) => {
  const [h, c] = roadAt(x);
  return [x, h + y, c + z];
};
const lower = (x, z = 0, y = 0) => {
  const [h] = railAt(x, 0),
    [, c] = roadAt(x);
  return [x, h + y, c + z];
};
const track = (x, index, z = 0, y = 0) => {
  const [h, c] = railAt(x, index);
  return [x, h + y, c + z];
};
function strip(out, slot, tone, point, a, b, z0, z1, dy = 0) {
  quad(out, slot, tone, point(a, z0, dy), point(a, z1, dy), point(b, z1, dy), point(b, z0, dy), up);
}
function side(out, slot, tone, point, a, b, z, y0, y1, normal) {
  quad(out, slot, tone, point(a, z, y0), point(b, z, y0), point(b, z, y1), point(a, z, y1), normal);
}
function deck(out, tier) {
  const w = layout.half,
    xs = sortedUnique(layout.road.map((p) => p[0]));
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = xs.slice(i - 1, i + 1);
    strip(out, 'road', 'asphalt', upper, a, b, -w, w);
    for (const s of [-1, 1]) {
      if (tier === 0) {
        side(out, 'concrete', 'concrete', upper, a, b, s * w, -0.68, 1.03, [0, 0, s]);
        continue;
      }
      side(out, 'concrete', 'concrete', upper, a, b, s * w, -0.68, 0.06, [0, 0, s]);
      strip(out, 'concrete', 'concrete', upper, a, b, s * w - 0.23, s * w + 0.23, 1.03);
      side(out, 'concrete', 'concrete', upper, a, b, s * (w + 0.23), 0.05, 1.03, [0, 0, s]);
      if (tier < 2)
        side(out, 'concrete', 'white', upper, a, b, s * (w - 0.22), 0.08, 1.03, [0, 0, -s]);
      if (tier > 0)
        strip(out, 'concrete', 'roadMark', upper, a, b, s * 5.92 - 0.052, s * 5.92 + 0.052, 0.015);
    }
    if (tier > 0)
      quad(
        out,
        'steel',
        'shadow',
        upper(a, -w, -0.68),
        upper(a, w, -0.68),
        upper(b, w, -0.68),
        upper(b, -w, -0.68),
        down,
      );
  }
  if (tier < 2) return;
  const [a, b] = layout.roadEnds;
  const spacing = tier === 2 ? 13 : tier === 3 ? 4.5 : 3.65;
  for (let i = 0, x = a; x < b - 0.14; i++, x = a + i * spacing) {
    const end = Math.min(x + spacing, b),
      tone = i % 2 ? 'black' : 'white';
    for (const s of [-1, 1])
      side(out, 'concrete', tone, upper, x, end, s * (w - 0.23), 0.076, 1.025, [0, 0, -s]);
  }
  const dashes = tier === 2 ? 26 : tier === 3 ? 14 : 12;
  for (let x = a + 5; x < b - 5; x += dashes) {
    for (const z of [-1.97, 1.97])
      strip(out, 'concrete', 'roadMark', upper, x, x + 3.4, z - 0.055, z + 0.055, 0.016);
  }
  for (let x = a + 28, i = 0; x < b - 10; x += tier === 2 ? 114 : 53, i++) {
    const s = i % 2 === 0 ? 1 : -1,
      z = s * (w + 0.06),
      tip = [x, roadAt(x)[0] + 8.1, roadAt(x)[1] + z - s * 2.07];
    rod(out, 'steel', 'shadow', upper(x, z, 0.87), upper(x, z, 7.77), 0.12, 0.14);
    rod(out, 'steel', 'shadow', upper(x, z, 7.77), tip, 0.086, 0.09);
    if (tier >= 3)
      rod(
        out,
        'steel',
        'bright',
        [tip[0], tip[1] - 0.11, tip[2] + s * 0.31],
        [tip[0], tip[1] - 0.11, tip[2] - s * 0.18],
        0.22,
        0.14,
      );
  }
}
function tracks(out, tier) {
  for (const [index, rows] of layout.railRows.entries()) {
    const at = (x, z, y) => track(x, index, z, y);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1][0],
        b = rows[i][0];
      strip(out, 'ballast', 'ballast', at, a, b, -1.79, 1.79, 0);
      if (tier === 0) continue;
      for (const s of [-1, 1]) {
        side(out, 'ballast', 'ballast', at, a, b, s * 1.79, -0.24, 0, [0, 0, s]);
        const z = s * 0.824;
        strip(out, 'steel', 'rail', at, a, b, z - 0.048, z + 0.048, 0.148);
        if (tier >= 2)
          side(out, 'steel', 'railSide', at, a, b, z + s * 0.039, 0.047, 0.148, [0, 0, s]);
      }
    }
    const [a, b] = layout.railEnds,
      step = tier === 0 ? 950 : tier === 1 ? 72 : tier === 2 ? 17 : tier === 3 ? 2.8 : 0.91;
    for (let x = a + 0.4; x < b - 0.4; x += step)
      strip(out, 'tie', 'tie', at, x, x + 0.2, -1.29, 1.29, 0.057);
  }
}
function lowDeck(out) {
  const [start, end] = layout.body,
    w = layout.half - 0.13;
  const xs = sortedUnique([
    start,
    end,
    ...layout.railRows[0].map((p) => p[0]).filter((x) => x > start && x < end),
  ]);
  for (let i = 1; i < xs.length; i++) {
    const [a, b] = xs.slice(i - 1, i + 1);
    strip(out, 'steel', 'shadow', lower, a, b, -w, w, -0.27);
    for (const s of [-1, 1])
      side(out, 'steel', 'lower', lower, a, b, s * w, -1.06, -0.28, [0, 0, s]);
    quad(
      out,
      'steel',
      'shadow',
      lower(a, -w, -1.06),
      lower(a, w, -1.06),
      lower(b, w, -1.06),
      lower(b, -w, -1.06),
      down,
    );
  }
}
function diagonal(out, a, b, tier, sideSign) {
  if (tier >= 3) {
    rod(out, 'steel', 'steel', a, b, 0.68, 0.51);
    return;
  }
  const w = tier === 0 ? 0.92 : 0.61,
    dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy),
    shift = [(-dy * w) / l, (dx * w) / l, 0];
  const offset = (p, s) => p.map((v, i) => v + shift[i] * s * 0.5);
  quad(out, 'steel', 'steel', offset(a, -1), offset(b, -1), offset(b, 1), offset(a, 1), [
    0,
    0,
    sideSign,
  ]);
  if (tier === 2) {
    const back = (p) => p.map((v, i) => (i === 2 ? v - sideSign * 0.29 : v));
    quad(
      out,
      'steel',
      'steel',
      back(offset(a, -1)),
      back(offset(b, -1)),
      back(offset(b, 1)),
      back(offset(a, 1)),
      [0, 0, -sideSign],
    );
  }
}
function trusses(out, tier) {
  const [start, end] = layout.body,
    w = layout.half - 0.26;
  const station = sortedUnique([
    start,
    end,
    ...layout.road.map((p) => p[0]).filter((x) => x > start && x < end),
  ]);
  for (let i = 1; i < station.length; i++) {
    const [a, b] = station.slice(i - 1, i + 1);
    for (const s of [-1, 1]) {
      side(out, 'steel', 'bright', upper, a, b, s * w, -1.55, -0.58, [0, 0, s]);
      side(out, 'steel', 'steel', lower, a, b, s * w, -0.46, 0.72, [0, 0, s]);
    }
  }
  for (let i = 1; i < layout.piers.length; i++) {
    const a = layout.piers[i - 1].x,
      b = layout.piers[i].x,
      pad = Math.min(1.2, (b - a) * 0.044);
    const count = tier === 0 ? 1 : tier === 1 ? 7 : 10;
    for (const s of [-1, 1]) {
      const z = s * w,
        low = (x) => lower(x, z, 0.36),
        high = (x) => upper(x, z, -1.03);
      for (let j = 0; j < count; j++) {
        const x = mix(a + pad, b - pad, j / count),
          y = mix(a + pad, b - pad, (j + 1) / count);
        const lo = (j % 2 === 0) === (i % 2 === 0);
        diagonal(out, lo ? low(x) : high(x), lo ? high(y) : low(y), tier, s);
      }
      if (tier >= 2) {
        rod(out, 'steel', 'lower', low(a + pad), high(a + pad), 0.74, 0.63);
        if (tier >= 3) rod(out, 'steel', 'lower', low(b - pad), high(b - pad), 0.74, 0.63);
      }
    }
    if (tier >= 2) {
      const count = tier === 2 ? 4 : tier === 3 ? 6 : 9;
      for (let j = 1; j < count; j++) {
        const x = mix(a, b, j / count),
          u = lower(x, -w, -0.28),
          v = lower(x, w, -0.28);
        rod(out, 'steel', 'shadow', u, v, 0.57, 0.58);
        if (tier >= 3) {
          const xx = mix(a, b, (j + 0.8) / count);
          rod(out, 'steel', 'lower', upper(x, -w, -1.44), upper(xx, w, -1.44), 0.21, 0.23);
          rod(out, 'steel', 'lower', upper(x, w, -1.44), upper(xx, -w, -1.44), 0.21, 0.23);
        }
      }
    }
  }
}
function billboard(out, tone, x, y0, y1, z, width, depth, longOnly = false) {
  quad(
    out,
    'concrete',
    tone,
    [x - width * 0.5, y0, z],
    [x + width * 0.5, y0, z],
    [x + width * 0.5, y1, z],
    [x - width * 0.5, y1, z],
    [0, 0, 1],
  );
  quad(
    out,
    'concrete',
    tone,
    [x - width * 0.5, y0, z],
    [x + width * 0.5, y0, z],
    [x + width * 0.5, y1, z],
    [x - width * 0.5, y1, z],
    [0, 0, -1],
  );
  if (!longOnly) {
    quad(
      out,
      'concrete',
      tone,
      [x, y0, z - depth * 0.5],
      [x, y0, z + depth * 0.5],
      [x, y1, z + depth * 0.5],
      [x, y1, z - depth * 0.5],
      [1, 0, 0],
    );
    quad(
      out,
      'concrete',
      tone,
      [x, y0, z - depth * 0.5],
      [x, y0, z + depth * 0.5],
      [x, y1, z + depth * 0.5],
      [x, y1, z - depth * 0.5],
      [-1, 0, 0],
    );
  }
}
function piers(out, tier) {
  for (const [i, { x, y, z, bed, wet }] of layout.piers.entries()) {
    const shoulder = Math.max(bed + 1.15, wet ? 1.86 : y - 4.1),
      head = y - 1.12;
    if (tier === 0) {
      billboard(out, 'base', x, bed, shoulder, z, 5.7, 12.7, true);
      billboard(out, 'concrete', x, shoulder, head, z, 3.08, 10.4, true);
      continue;
    }
    const n = tier <= 2 ? 6 : tier === 3 ? 14 : 18,
      rings = [
        [bed, 2.92, 6.21],
        [shoulder - 0.16, 2.9, 6.19],
        [shoulder + 0.16, 2.8, 6.07],
      ];
    loft(
      out,
      'concrete',
      (tier <= 2 ? [rings[0], rings[2]] : rings).map(([h, w, d]) => radialRing(h, w, d, n, [x, z])),
      tones[wet ? 'wet' : 'base'],
      { cap: tier >= 2 },
    );
    for (const o of [-3.54, 3.54]) {
      if (tier === 1) {
        billboard(out, 'concrete', x, shoulder, head, z + o, 3.08, 3.08);
        continue;
      }
      const profile = [
        [shoulder, 1.56],
        [head - 0.39, 1.49],
        [head - 0.14, 1.78],
        [head + 0.08, 1.71],
      ];
      loft(
        out,
        'concrete',
        (tier === 2 ? [profile[0], profile[3]] : profile).map(([h, r]) =>
          radialRing(h, r, r, n, [x, z + o]),
        ),
        tones.concrete,
        { cap: false },
      );
    }
    if (tier >= 3) {
      rod(
        out,
        'steel',
        'shadow',
        P(x, head + 0.1, z - 4.93),
        P(x, head + 0.1, z + 4.93),
        0.35,
        2.31,
      );
      if (i > 0 && i < layout.piers.length - 1)
        for (const s of [-1, 1]) {
          const z0 = z + s * 5.9,
            n = [0, 0, s];
          quad(
            out,
            'steel',
            'bright',
            P(x - 1.35, head - 0.62, z0),
            P(x + 1.35, head - 0.62, z0),
            P(x + 0.96, y + 0.15, z0),
            P(x - 0.96, y + 0.15, z0),
            n,
          );
        }
    }
  }
}
function bankApproaches(out, tier) {
  for (const bank of layout.embankments) {
    const rows =
      tier === 0 ? bank.filter((_, i) => i === 0 || i === bank.length - 1 || i % 3 === 0) : bank;
    const at = (p, i) => [p.x, p.top[i], p.crest[i]],
      base = (p, i) => [p.x, p.base[i], p.toe[i]];
    for (let i = 1; i < rows.length; i++) {
      const [a, b] = rows.slice(i - 1, i + 1);
      for (let j = 1; j < a.top.length; j++)
        quad(out, 'ballast', 'ballast', at(a, j - 1), at(a, j), at(b, j), at(b, j - 1), up);
      for (const j of [0, 1])
        quad(out, 'ballast', 'base', base(a, j), base(b, j), at(b, j * 3), at(a, j * 3), [
          0,
          0,
          j ? 1 : -1,
        ]);
    }
    for (const [a, normal] of [
      [rows[0], [-1, 0, 0]],
      [rows.at(-1), [1, 0, 0]],
    ]) {
      quad(out, 'ballast', 'base', base(a, 0), base(a, 1), at(a, 3), at(a, 0), normal);
    }
  }
  for (const sign of [-1, 1]) {
    const sideIndex = sign === -1 ? 0 : 1,
      x = layout.body[sideIndex],
      y = railAt(x, 0)[0],
      z = roadAt(x)[1];
    if (tier === 0) continue;
    rod(
      out,
      'concrete',
      'base',
      [x, y - 4.0, z - layout.half],
      [x, y - 4.0, z + layout.half],
      2.65,
      5.35,
    );
    const road = layout.road.filter((p) => sign * p[0] > sign * x);
    for (const [i, [x, h, z]] of road.entries()) {
      if (i % 2 !== 0 || Math.abs(x - layout.roadEnds[sideIndex]) < 18) continue;
      for (const s of [-1, 1]) {
        const [railY] = railAt(x, 0);
        rod(
          out,
          'concrete',
          'concrete',
          [x, Math.min(railY - 1.75, h - 4.5), z + s * 4.91],
          [x, h - 0.67, z + s * 4.91],
          2.19,
          2.07,
        );
      }
    }
  }
}
export function buildBogibeelLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Bogibeel Bridge tier ${level}`);
  deck(out, tier);
  tracks(out, tier);
  lowDeck(out);
  trusses(out, tier);
  piers(out, tier);
  bankApproaches(out, tier);
}
export const buildBogibeelSkyline = (out) => buildBogibeelLevel(out, 'skyline');
export const buildBogibeelDistrict = (out) => buildBogibeelLevel(out, 'district');
export const buildBogibeelStreet = (out) => buildBogibeelLevel(out, 'street');
export const buildBogibeelCloseup = (out) => buildBogibeelLevel(out, 'closeup');
