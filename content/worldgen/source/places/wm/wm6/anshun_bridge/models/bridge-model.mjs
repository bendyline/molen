/** Anshun Bridge's three masonry vaults, open oculi and timber roofs. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.92 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.83 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.89 },
};
const colors = {
  stone: [0.69, 0.56, 0.4],
  arch: [0.72, 0.61, 0.46],
  soffit: [0.34, 0.28, 0.21],
  darkStone: [0.48, 0.37, 0.26],
  limestone: [0.76, 0.67, 0.52],
  cap: [0.82, 0.72, 0.52],
  pavement: [0.47, 0.42, 0.33],
  red: [0.5, 0.095, 0.044],
  deepRed: [0.28, 0.055, 0.028],
  gold: [0.69, 0.4, 0.14],
  clay: [0.13, 0.118, 0.105],
  tileRib: [0.21, 0.18, 0.15],
  crest: [0.19, 0.16, 0.13],
  shade: [0.14, 0.14, 0.115],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  down = [0, -1, 0],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const rod = (out, slot, tone, a, b, w, d = w) => beam(out, slot, a, b, w, d, colors[tone]);

function triangle(out, slot, tone, points, preferred) {
  let normal = normalFor(...points);
  if (normal.reduce((n, v, i) => n + v * preferred[i], 0) < 0) {
    points = points.toReversed();
    normal = normalFor(...points);
  }
  if (Math.hypot(...normal) > 0.5)
    out.addTriangle(slot, ref, points, normal, undefined, colors[tone]);
}
function quad(out, slot, tone, a, b, c, d, normal) {
  triangle(out, slot, tone, [a, b, c], normal);
  triangle(out, slot, tone, [a, c, d], normal);
}
function panel(out, slot, tone, outline, holes, z, side) {
  const vertices = [...outline, ...holes.flat()],
    offsets = [];
  let i = outline.length;
  for (const hole of holes) {
    offsets.push(i);
    i += hole.length;
  }
  const triangles = earcut(vertices.flat(), offsets);
  for (let i = 0; i < triangles.length; i += 3) {
    const points = triangles.slice(i, i + 3).map((index) => [...vertices[index], z]);
    triangle(out, slot, tone, points, [0, 0, side]);
  }
}
function box(out, slot, tone, x0, x1, y0, y1, z0, z1) {
  const a = [x0, y0, z0],
    b = [x1, y0, z0],
    c = [x1, y0, z1],
    d = [x0, y0, z1];
  const A = [x0, y1, z0],
    B = [x1, y1, z0],
    C = [x1, y1, z1],
    D = [x0, y1, z1];
  quad(out, slot, tone, A, D, C, B, up);
  quad(out, slot, tone, a, b, c, d, down);
  quad(out, slot, tone, a, A, B, b, [0, 0, -1]);
  quad(out, slot, tone, d, c, C, D, [0, 0, 1]);
  quad(out, slot, tone, a, d, D, A, [-1, 0, 0]);
  quad(out, slot, tone, b, B, C, c, [1, 0, 0]);
}
export function deckY(x) {
  const i = layout.deck.findIndex((p) => p[0] >= x);
  if (i === 0) return layout.deck[0][1];
  if (i < 0) return layout.deck.at(-1)[1];
  const [[a, y], [b, h]] = layout.deck.slice(i - 1, i + 1);
  return mix(y, h, (x - a) / (b - a));
}
function arch([x, width, y, rise], n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const angle = (i / n) * Math.PI;
    return [x - width * Math.cos(angle), y + rise * Math.sin(angle)];
  });
}
function ellipse([x, y, rx, ry], n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * Math.PI * 2;
    return [x + rx * Math.cos(angle), y + ry * Math.sin(angle)];
  });
}
function reveal(out, points, close) {
  const [near, far] = layout.sides;
  const edges = close ? points.length : points.length - 1;
  for (let i = 0; i < edges; i++) {
    const [a, b] = points[i],
      [c, d] = points[(i + 1) % points.length];
    const sign = close ? 1 : -1;
    quad(
      out,
      'stone',
      i % 4 ? 'soffit' : 'darkStone',
      [a, b, near],
      [a, b, far],
      [c, d, far],
      [c, d, near],
      [sign * (b - d), sign * (c - a), 0],
    );
  }
}
function border(out, inner, outer, closed, tier) {
  const n = closed ? inner.length : inner.length - 1;
  for (const [i, z] of layout.sides.entries()) {
    const sign = i === 0 ? -1 : 1,
      depth = z + sign * 0.041;
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % inner.length;
      const p = ([x, y]) => [x, y, depth],
        tone = tier > 1 && j % 5 === 2 ? 'limestone' : 'arch';
      quad(out, 'trim', tone, p(inner[j]), p(inner[k]), p(outer[k]), p(outer[j]), [0, 0, sign]);
      if (tier >= 3 && j % 2 === 0) {
        const a = lerp(inner[j], outer[j], 0.12),
          b = lerp(inner[j], outer[j], 0.93);
        rod(out, 'trim', 'darkStone', p(a), p(b), 0.027, 0.021);
      }
    }
  }
}
function masonry(out, tier) {
  const [x0, x1] = layout.body,
    y0 = layout.foundationY,
    [z0, z1] = layout.sides;
  const count = [6, 10, 16, 24, 36][tier],
    round = [8, 12, 20, 32, 40][tier];
  const shells = layout.arches.map((spec) => {
    const crown = arch(spec, count);
    return [[crown[0][0], y0], ...crown, [crown.at(-1)[0], y0]];
  });
  const holes = layout.oculi.map((spec) => ellipse(spec, round));
  const outline = [[x0, y0], ...shells.flat(), [x1, y0], ...layout.deck.toReversed()];
  panel(out, 'stone', 'stone', outline, holes, z0, -1);
  panel(out, 'stone', 'stone', outline, holes, z1, 1);
  for (const [i, x] of layout.body.entries()) {
    const a = [x, y0, z0],
      b = [x, y0, z1],
      c = [x, deckY(x), z1],
      d = [x, deckY(x), z0];
    quad(out, 'stone', 'stone', a, b, c, d, [i === 0 ? -1 : 1, 0, 0]);
  }
  for (const shell of shells) reveal(out, shell, false);
  for (const hole of holes) reveal(out, hole, true);
  if (tier === 0) return;
  for (const [i, [x, w, y, h]] of layout.arches.entries()) {
    border(
      out,
      shells[i].slice(1, -1),
      arch([x, w + 0.31, y + 0.015, h + 0.36], count),
      false,
      tier,
    );
  }
  for (const [i, [x, y, w, h]] of layout.oculi.entries()) {
    border(out, holes[i], ellipse([x, y, w + 0.26, h + 0.26], round), true, tier);
  }
  // Broad, gently projecting pier noses below the circular relief openings.
  for (const [x] of layout.oculi)
    for (const [side, z] of [
      [-1, z0],
      [1, z1],
    ]) {
      const zf = z + side * 0.85,
        yn = 0.44;
      quad(
        out,
        'stone',
        'darkStone',
        [x - 1.5, y0, z],
        [x - 0.92, y0, zf],
        [x - 0.81, yn, zf],
        [x - 1.32, yn, z],
        [-1, 0, side],
      );
      quad(
        out,
        'stone',
        'darkStone',
        [x + 0.92, y0, zf],
        [x + 1.5, y0, z],
        [x + 1.32, yn, z],
        [x + 0.81, yn, zf],
        [1, 0, side],
      );
      quad(
        out,
        'stone',
        'darkStone',
        [x - 0.92, y0, zf],
        [x + 0.92, y0, zf],
        [x + 0.81, yn, zf],
        [x - 0.81, yn, zf],
        [0, 0, side],
      );
      quad(
        out,
        'trim',
        'limestone',
        [x - 1.32, yn, z],
        [x - 0.81, yn, zf],
        [x + 0.81, yn, zf],
        [x + 1.32, yn, z],
        up,
      );
    }
}
function deck(out, tier) {
  const [z0, z1] = layout.sides;
  for (let i = 1; i < layout.deck.length; i++) {
    const [a, y] = layout.deck[i - 1],
      [b, h] = layout.deck[i];
    quad(out, 'paving', 'pavement', [a, y, z0], [a, y, z1], [b, h, z1], [b, h, z0], up);
    for (const [side, z] of [
      [-1, z0],
      [1, z1],
    ]) {
      const p = (x, y, w) => [x, y, z - side * w];
      const lip = tier === 0 ? 0.4 : 0.32;
      quad(
        out,
        'trim',
        'limestone',
        p(a, y - 0.12, 0),
        p(b, h - 0.12, 0),
        p(b, h + lip, 0),
        p(a, y + lip, 0),
        [0, 0, side],
      );
      quad(
        out,
        'trim',
        'cap',
        p(a, y + lip, 0),
        p(b, h + lip, 0),
        p(b, h + lip, 0.36),
        p(a, y + lip, 0.36),
        up,
      );
      if (tier === 0) continue;
      const count = Math.max(1, Math.ceil((b - a) / (tier === 1 ? 3.05 : tier === 2 ? 2.2 : 1.75)));
      const step = (b - a) / count;
      for (let j = 0; j < count; j++) {
        const x = a + step * (j + 0.5),
          y = deckY(x);
        const lo = Math.min(z, z - side * 0.37),
          hi = Math.max(z, z - side * 0.37),
          w = tier === 1 ? 0.26 : 0.34;
        if (tier === 1) {
          quad(
            out,
            'trim',
            'limestone',
            p(x - w / 2, y + 0.18, 0),
            p(x + w / 2, y + 0.18, 0),
            p(x + w / 2, y + 0.99, 0),
            p(x - w / 2, y + 0.99, 0),
            [0, 0, side],
          );
          continue;
        }
        box(out, 'trim', 'limestone', x - w * 0.5, x + w * 0.5, y + 0.18, y + 0.99, lo, hi);
        box(
          out,
          'trim',
          'cap',
          x - w * 0.68,
          x + w * 0.68,
          y + 0.97,
          y + 1.075,
          lo - 0.04,
          hi + 0.04,
        );
        const edge = x + step * 0.5 - 0.15,
          u = edge - step + 0.3,
          f = deckY(u) + 0.75,
          g = deckY(edge) + 0.75;
        quad(
          out,
          'trim',
          'limestone',
          p(u, f, 0),
          p(edge, g, 0),
          p(edge, g + 0.13, 0),
          p(u, f + 0.13, 0),
          [0, 0, side],
        );
      }
    }
  }
  if (tier < 2) return;
  for (const { start, end, steps } of layout.galleryStairs) {
    for (let i = 0; i < steps; i++) {
      const a = mix(start, end, i / steps),
        b = mix(start, end, (i + 1) / steps),
        y = Math.max(deckY(a), deckY(b)) + 0.003;
      quad(
        out,
        'paving',
        'pavement',
        [a, y, z0 + 0.43],
        [a, y, z1 - 0.43],
        [b, y, z1 - 0.43],
        [b, y, z0 + 0.43],
        up,
      );
      const x = start < 0 ? a : b,
        low = deckY(x),
        side = start < 0 ? -1 : 1;
      quad(
        out,
        'trim',
        'limestone',
        [x, low, z0 + 0.43],
        [x, low, z1 - 0.43],
        [x, y, z1 - 0.43],
        [x, y, z0 + 0.43],
        [side, 0, 0],
      );
    }
  }
}

function roof(out, settings, tier) {
  const { x0, x1, z, y, width, rise, hip, lift } = settings;
  const countX = [2, 4, 6, 14, 16][tier],
    countY = [2, 3, 5, 9, 11][tier];
  const at = (u, t, side, offset = 0) => {
    const curl = Math.pow(Math.max(0, Math.abs(2 * u - 1) - 0.58) / 0.42, 2);
    return [
      mix(x0 + hip * t, x1 - hip * t, u),
      y + rise * (0.34 * t + 0.66 * t * t) + lift * curl * (1 - 0.72 * t) + offset,
      z + side * width * (1 - t),
    ];
  };
  for (const side of [-1, 1]) {
    for (let i = 1; i <= countX; i++)
      for (let j = 1; j <= countY; j++) {
        const a = (i - 1) / countX,
          b = i / countX,
          c = (j - 1) / countY,
          d = j / countY;
        quad(
          out,
          'tile',
          'clay',
          at(a, c, side),
          at(b, c, side),
          at(b, d, side),
          at(a, d, side),
          up,
        );
      }
    for (let i = 1; i <= countX; i++) {
      const a = (i - 1) / countX,
        b = i / countX;
      quad(
        out,
        'timber',
        'deepRed',
        at(a, 0, side, -0.19),
        at(b, 0, side, -0.19),
        at(b, 0, side),
        at(a, 0, side),
        [0, 0, side],
      );
      if (tier >= 2)
        quad(
          out,
          'timber',
          'gold',
          at(a, 0, side, -0.205),
          at(b, 0, side, -0.205),
          at(b, 0, side, -0.154),
          at(a, 0, side, -0.154),
          [0, 0, side],
        );
    }
    if (tier >= 3) {
      const rows = Math.ceil((x1 - x0) / (tier === 3 ? 0.39 : 0.29));
      for (let i = 0; i < rows; i++) {
        const u = (i + 0.5) / rows,
          half = 0.052 / (x1 - x0);
        for (let j = 1; j <= countY; j++) {
          const c = (j - 1) / countY,
            d = j / countY;
          quad(
            out,
            'tile',
            i % 3 ? 'tileRib' : 'crest',
            at(u - half, c, side, 0.022),
            at(u + half, c, side, 0.022),
            at(u + half, d, side, 0.022),
            at(u - half, d, side, 0.022),
            up,
          );
        }
      }
    }
  }
  for (const u of [0, 1]) {
    for (let i = 1; i <= countY; i++) {
      const a = (i - 1) / countY,
        b = i / countY,
        side = u === 0 ? -1 : 1;
      for (const zSide of [-1, 1]) {
        const p = at(u, a, zSide),
          q = at(u, b, zSide);
        quad(out, 'timber', 'deepRed', [p[0], y - 0.18, p[2]], [q[0], y - 0.18, q[2]], q, p, [
          side,
          0,
          0,
        ]);
      }
    }
  }
  const ridge = Array.from({ length: countX + 1 }, (_, i) => at(i / countX, 1, 1, 0.09));
  if (tier > 0) beamPath(out, 'tile', ridge, tier < 2 ? 0.24 : 0.32, 0.24, colors.crest);
  if (tier >= 2)
    for (const u of [0, 1]) {
      const [x, ry, z] = at(u, 1, 1),
        d = u === 0 ? -1 : 1;
      const points = [
        [x - 0.26 * d, ry + 0.11, z],
        [x + 0.17 * d, ry + 0.43, z],
        [x + 0.38 * d, ry + 0.81, z],
        [x + 0.16 * d, ry + 1.07, z],
        [x - 0.08 * d, ry + 0.94, z],
      ];
      beamPath(out, 'tile', points, 0.15, 0.17, colors.crest);
    }
}
function gallery(out, tier, { x0, x1, base, z, width, wall = 2.8, main = false, canopy = false }) {
  const outer = width - 1.02,
    y = base + wall,
    windowZ = width * 0.46;
  const cells = Math.max(2, Math.round((x1 - x0) / (main ? 3.45 : 3.06)));
  const cell = (x1 - x0) / cells;
  for (const side of [-1, 1]) {
    const zp = z + side * outer;
    const trim = tier < 2 ? 0.18 : 0.24;
    if (tier === 0)
      quad(
        out,
        'timber',
        'deepRed',
        [x0, y - 0.38, zp],
        [x1, y - 0.38, zp],
        [x1, y - 0.08, zp],
        [x0, y - 0.08, zp],
        [0, 0, side],
      );
    else rod(out, 'timber', 'deepRed', [x0, y - 0.21, zp], [x1, y - 0.21, zp], 0.36, trim);
    if (tier >= 2) rod(out, 'timber', 'gold', [x0, y - 0.51, zp], [x1, y - 0.51, zp], 0.11, 0.16);
    for (let i = 0; i <= cells; i++) {
      const x = x0 + i * cell;
      if (tier === 0 && i > 0 && i < cells && i % 2 !== 0) continue;
      const bottom = canopy ? deckY(x) : base;
      if (tier === 0)
        quad(
          out,
          'timber',
          'red',
          [x - 0.13, bottom, zp],
          [x + 0.13, bottom, zp],
          [x + 0.13, y, zp],
          [x - 0.13, y, zp],
          [0, 0, side],
        );
      else rod(out, 'timber', 'red', [x, bottom, zp], [x, y + 0.02, zp], main ? 0.25 : 0.22);
      if (tier < 2) continue;
      rod(out, 'trim', 'limestone', [x, bottom, zp], [x, bottom + 0.21, zp], 0.41);
      rod(out, 'timber', 'gold', [x, y - 0.43, zp], [x, y - 0.29, zp], 0.43);
      for (const d of [-1, 1]) {
        if ((d === -1 && i === 0) || (d === 1 && i === cells)) continue;
        rod(out, 'timber', 'red', [x, y - 0.75, zp], [x + d * 0.55, y - 0.31, zp], 0.13, 0.12);
        if (tier >= 3)
          rod(
            out,
            'timber',
            'gold',
            [x, y - 0.65, zp + 0.034 * side],
            [x + d * 0.39, y - 0.32, zp + 0.034 * side],
            0.065,
            0.064,
          );
      }
    }
    if (canopy) continue;
    const w = z + side * windowZ;
    const lo = base + 0.64,
      hi = y - 0.34;
    quad(out, 'timber', 'shade', [x0, lo, w], [x1, lo, w], [x1, hi, w], [x0, hi, w], [0, 0, side]);
    quad(
      out,
      'timber',
      'deepRed',
      [x0, base, w],
      [x1, base, w],
      [x1, lo, w],
      [x0, lo, w],
      [0, 0, side],
    );
    if (tier >= 2)
      for (let i = 0; i < cells; i++) {
        const a = x0 + i * cell,
          b = a + cell,
          sz = w + side * 0.027;
        rod(out, 'timber', 'red', [a, lo, sz], [b, lo, sz], 0.1);
        for (let j = 0; j < (tier >= 3 ? 5 : 2); j++) {
          const x = a + (cell * j) / (tier >= 3 ? 5 : 2);
          rod(out, 'timber', 'deepRed', [x, lo, sz], [x, hi, sz], 0.078);
        }
      }
  }
  if (!canopy) {
    const a = z - windowZ,
      b = z + windowZ;
    for (const [x, s] of [
      [x0, -1],
      [x1, 1],
    ])
      quad(
        out,
        'timber',
        'deepRed',
        [x, base, a],
        [x, base, b],
        [x, y - 0.29, b],
        [x, y - 0.29, a],
        [s, 0, 0],
      );
  }
  roof(
    out,
    {
      x0: x0 - 1,
      x1: x1 + 1,
      z,
      y,
      width: width + 0.67,
      rise: main ? 2.73 : 1.52,
      hip: main ? 1.35 : 0.83,
      lift: main ? 0.79 : 0.62,
    },
    tier,
  );
}
function approaches(out, tier) {
  for (const approach of layout.approaches) {
    const { bank, bodyX, x, laneZ, tops, bases } = approach,
      side = bank === 'south' ? -1 : 1,
      high = deckY(bodyX);
    for (const [j, z] of laneZ.entries()) {
      const span = 1.65,
        top = tops[j],
        count = tier === 0 ? 1 : Math.max(2, Math.ceil((high - top) / 0.22));
      const z0 = z - span * 0.5,
        z1 = z + span * 0.5,
        base = bases[j];
      for (let i = 1; i <= count; i++) {
        const a = mix(bodyX, x, (i - 1) / count),
          b = mix(bodyX, x, i / count),
          y = mix(high, top, i / count);
        const startY = tier === 0 ? high : y,
          stepY = mix(high, top, (i - 1) / count);
        quad(
          out,
          'paving',
          'pavement',
          [a, startY, z0],
          [a, startY, z1],
          [b, y, z1],
          [b, y, z0],
          up,
        );
        if (tier > 0)
          quad(
            out,
            'trim',
            'limestone',
            [a, y, z0],
            [a, y, z1],
            [a, stepY, z1],
            [a, stepY, z0],
            [side, 0, 0],
          );
        for (const [sign, p] of [
          [-1, z0],
          [1, z1],
        ])
          quad(
            out,
            'stone',
            'stone',
            [a, base, p],
            [b, base, p],
            [b, y, p],
            [a, startY, p],
            [0, 0, sign],
          );
      }
      if (tier >= 1) {
        for (const p of [z0 + 0.08, z1 - 0.08]) {
          rod(
            out,
            'trim',
            'limestone',
            [bodyX, high + 0.72, p],
            [x - side * 0.2, top + 0.75, p],
            0.12,
          );
          for (const t of [0, 0.45, 0.94]) {
            const a = mix(bodyX, x, t),
              y = mix(high, top, t);
            rod(out, 'trim', 'limestone', [a, y, p], [a, y + 0.76, p], 0.16);
          }
        }
      }
    }
  }
}

export function buildAnshunLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown Anshun Bridge tier ${level}`);
  masonry(out, tier);
  deck(out, tier);
  approaches(out, tier);
  const z = layout.centerZ;
  gallery(out, tier, { x0: -20.05, x1: 20.2, base: 8.39, z, width: 5.4, wall: 2.93 });
  gallery(out, tier, { x0: -16.5, x1: 16.7, base: 11.82, z, width: 3.63, wall: 3.28, main: true });
  gallery(out, tier, { x0: -41.35, x1: -25.74, base: 5.16, z, width: 5.0, wall: 2.38 });
  gallery(out, tier, { x0: 25.6, x1: 39.8, base: 4.68, z, width: 4.97, wall: 2.37 });
  // The corner pavilions mark the raised ends of the lower galleries.
  gallery(out, tier, { x0: -29.54, x1: -24.02, base: 7.98, z, width: 3.53, wall: 1.89 });
  gallery(out, tier, { x0: 23.9, x1: 29.8, base: 7.4, z, width: 3.53, wall: 1.93 });
  if (tier >= 2) {
    gallery(out, tier, {
      x0: -24.7,
      x1: -20.3,
      base: 6.25,
      z,
      width: 4.5,
      wall: 2.65,
      canopy: true,
    });
    gallery(out, tier, {
      x0: 20.2,
      x1: 24.55,
      base: 5.95,
      z,
      width: 4.5,
      wall: 2.69,
      canopy: true,
    });
  }
}
export const buildAnshunSkyline = (out) => buildAnshunLevel(out, 'skyline');
export const buildAnshunDistrict = (out) => buildAnshunLevel(out, 'district');
export const buildAnshunStreet = (out) => buildAnshunLevel(out, 'street');
export const buildAnshunCloseup = (out) => buildAnshunLevel(out, 'closeup');
