/** Podilskyi's 344 m twin arch, suspended double deck and 64 m side spans. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  abutment: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.88 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.21 },
};
const color = {
  asphalt: [0.235, 0.233, 0.221],
  walk: [0.57, 0.55, 0.51],
  white: [0.88, 0.88, 0.77],
  steel: [0.61, 0.66, 0.66],
  dark: [0.32, 0.37, 0.36],
  shadow: [0.21, 0.25, 0.25],
  silver: [0.66, 0.69, 0.67],
  cement: [0.62, 0.6, 0.54],
  weathered: [0.37, 0.37, 0.32],
  amber: [0.64, 0.45, 0.21],
  cable: [0.4, 0.44, 0.43],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0],
  down = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const { a, b, halfSpan, deck, piers } = layout,
  halfWidth = 17.9,
  metro = -5.5;
function row(x) {
  const i = deck.findIndex((r) => r[0] >= x);
  if (i <= 0) return deck[i === 0 ? 0 : deck.length - 1];
  const p = deck[i - 1],
    q = deck[i],
    t = (x - p[0]) / (q[0] - p[0]);
  return p.map((v, j) => mix(v, q[j], t));
}
const on = (x, z, dy = 0) => {
  const [, y, p, q] = row(x);
  return [x, y + dy, (p + q) / 2 + z];
};
function quad(out, slot, tone, [a, b, c, d], want) {
  for (let p of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...p);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
      p = p.toReversed();
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, '', p, n, undefined, color[tone]);
  }
}
function strip(out, slot, tone, x, X, z, h, w, H, n = up) {
  quad(out, slot, tone, [on(x, z, h), on(X, z, h), on(X, w, H), on(x, w, H)], n);
}
function stations(count) {
  return Array.from({ length: count + 1 }, (_, i) => mix(a, b, i / count));
}
function roadDeck(out, d) {
  const rows = d === 0 ? stations(8) : d === 1 ? stations(16) : deck.map((r) => r[0]);
  for (let i = 1; i < rows.length; i++) {
    const x = rows[i - 1],
      X = rows[i];
    strip(out, 'deck', 'asphalt', x, X, -14.2, 0, 14.2, 0);
    strip(out, 'deck', 'walk', x, X, -halfWidth, 0.19, -14.2, 0.19);
    strip(out, 'deck', 'walk', x, X, 14.2, 0.19, halfWidth, 0.19);
    strip(out, 'steel', 'shadow', x, X, -halfWidth, -0.83, halfWidth, -0.83, down);
    strip(out, 'steel', 'shadow', x, X, -9.2, metro - 0.4, 9.2, metro - 0.4, down);
    strip(out, 'steel', 'dark', x, X, -9.2, metro, 9.2, metro);
    for (const s of [-1, 1]) {
      const n = [0, 0, s],
        z = s * halfWidth,
        inside = s * 14.2;
      strip(out, 'steel', 'steel', x, X, z, -0.83, z, 0.19, n);
      strip(out, 'steel', 'dark', x, X, s * 9.2, metro - 0.4, s * 9.2, metro, n);
      if (d >= 1) {
        strip(out, 'deck', 'walk', x, X, inside, 0, inside, 0.19, [0, 0, -s]);
        strip(out, 'deck', 'white', x, X, s * 13.68, 0.016, s * 13.79, 0.016);
        strip(out, 'deck', 'walk', x, X, -0.55, 0.14, 0.55, 0.14);
        if (d >= 3)
          for (const h of [-4.32, -0.78])
            strip(out, 'steel', 'steel', x, X, s * 16.5, h, s * 16.5, h + 0.39, n);
      }
    }
  }
  if (d >= 1)
    for (let x = a + 1.5; x < b - 10; x += d === 1 ? 19 : 12) {
      for (const z of [-10.1, -6.35, 6.35, 10.1])
        strip(out, 'deck', 'white', x, x + (d === 1 ? 6 : 4), z - 0.054, 0.015, z + 0.054, 0.015);
    }
  for (const x of [a, b]) {
    const n = [x === a ? -1 : 1, 0, 0];
    quad(
      out,
      'steel',
      'dark',
      [
        on(x, -halfWidth, -0.83),
        on(x, halfWidth, -0.83),
        on(x, halfWidth, 0.19),
        on(x, -halfWidth, 0.19),
      ],
      n,
    );
    quad(
      out,
      'steel',
      'dark',
      [on(x, -9.2, metro - 0.4), on(x, 9.2, metro - 0.4), on(x, 9.2, metro), on(x, -9.2, metro)],
      n,
    );
  }
}
function arches(out, d) {
  const span = halfSpan,
    rise = 66.1,
    R = (span * span + rise * rise) / (2 * rise),
    arc = (x) => Math.sqrt(R * R - x * x) - R + rise;
  const point = (x, s, h = 0) => {
    const y = arc(x),
      z = s * (17.2 - (2.65 * y) / rise);
    return on(x, z, y - 1.65 + h);
  };
  const count = [12, 23, 42, 58, 76][d];
  const ribs = Array.from({ length: count + 1 }, (_, i) => mix(-span, span, i / count));
  for (const s of [-1, 1]) {
    const outer = ribs.map((x) => point(x, s));
    beamPath(out, 'steel', outer, 2.52, 2.57, color.steel);
    if (d >= 3)
      for (const t of [-0.95, 0.95])
        beamPath(
          out,
          'steel',
          outer.map((p) => [p[0], p[1] + t, p[2] + s * 1.18]),
          0.15,
          0.13,
          color.silver,
        );
    const gap = d === 0 ? 40 : d === 1 ? 16 : 8;
    for (let x = -span + gap; x < span - gap / 2; x += gap) {
      const p = point(x, s, -1.02),
        base = on(x, s * 16.95, -0.38);
      beam(
        out,
        'steel',
        base,
        p,
        d === 0 ? 0.24 : d === 1 ? 0.145 : 0.1,
        d === 0 ? 0.24 : d === 1 ? 0.145 : 0.1,
        color.cable,
      );
      if (d >= 3) {
        beam(out, 'steel', base, on(x, s * 16.95, 0.61), 0.35, 0.31, color.dark);
        beam(out, 'steel', p, [p[0], p[1] - 1.02, p[2]], 0.24, 0.24, color.silver);
      }
    }
  }
  const spacing = d === 0 ? 58 : d === 1 ? 28 : 16;
  for (let x = -span + spacing; x < span - spacing / 2; x += spacing) {
    beam(out, 'steel', point(x, -1, -0.33), point(x, 1, -0.33), 0.79, 0.7, color.silver);
    if (d === 0) continue;
    const next = x + spacing * 0.85;
    const s = Math.round((x + span) / spacing) % 2 === 0 ? 1 : -1;
    beam(out, 'steel', point(x, s, -0.42), point(next, -s, -0.42), 0.6, 0.59, color.dark);
    if (d >= 3)
      beam(out, 'steel', point(x, -s, -0.58), point(next, s, -0.58), 0.42, 0.42, color.steel);
  }
}
function lowerWorks(out, d) {
  if (d === 0) {
    for (const s of [-1, 1])
      for (const pair of [
        [a, -65],
        [-65, 95],
        [95, b],
      ])
        strip(out, 'steel', 'dark', ...pair, s * 9.2, metro, s * 16.5, -0.72, [0, 0, s]);
    return;
  }
  const spacing = d === 1 ? 25 : d === 2 ? 16 : 7.75;
  for (let x = a + 2; x < b - 4; x += spacing) {
    const end = Math.min(x + spacing, b),
      sideDy = metro + 0.28;
    for (const s of [-1, 1]) {
      const peak = on(x, s * 16.7, -0.72),
        foot = on(end, s * 9.12, sideDy);
      const left = on(x, s * 9.1, sideDy);
      beam(out, 'steel', peak, foot, 0.59, 0.62, color.dark);
      if (d >= 2) beam(out, 'steel', on(end, s * 16.7, -0.72), foot, 0.5, 0.58, color.steel);
      else beam(out, 'steel', peak, left, 0.53, 0.57, color.steel);
      if (d >= 3) beam(out, 'steel', left, foot, 0.55, 0.47, color.dark);
    }
    if (d >= 3)
      beam(
        out,
        'steel',
        on(x, -9.5, metro - 0.32),
        on(x, 9.5, metro - 0.32),
        0.56,
        0.69,
        color.shadow,
      );
  }
  if (d < 2) return;
  const runs = d === 2 ? stations(25) : deck.map((r) => r[0]);
  for (const g of [-4.15, 4.15]) {
    for (const z of [g - 0.76, g + 0.76])
      beamPath(
        out,
        'steel',
        runs.map((x) => on(x, z, metro + 0.33)),
        0.091,
        0.095,
        color.silver,
      );
    if (d >= 3)
      for (let x = a + 1; x < b; x += d === 4 ? 0.84 : 1.46)
        beam(
          out,
          'steel',
          on(x, g - 1.23, metro + 0.11),
          on(x, g + 1.23, metro + 0.11),
          0.19,
          0.18,
          color.shadow,
        );
  }
  for (const z of [-7.15, 7.15])
    beamPath(
      out,
      'steel',
      runs.map((x) => on(x, z, metro + 0.87)),
      1.11,
      1.15,
      color.cement,
    );
}
function supports(out, d) {
  for (const p of piers) {
    const { x, z, base, main } = p,
      top = row(x)[1] + metro - 0.25,
      w = main ? 13.2 : 4.95;
    if (d === 0) {
      loft(
        out,
        'abutment',
        [
          [base, w, 25],
          [top, w * 0.78, 21],
        ].map(([h, u, v]) => chamferedRectangle(x, h, z, u, v, 0.4)),
        color.cement,
      );
      continue;
    }
    loft(
      out,
      'abutment',
      [
        [base, w + 3.7, 32],
        [base + 2.6, w + 1.9, 31],
      ].map(([h, u, v]) => chamferedRectangle(x, h, z, u, v, 0.8)),
      color.weathered,
    );
    for (const s of [-1, 1]) {
      const y = top - 0.15,
        Z = z + s * (main ? 12.6 : 7.42);
      loft(
        out,
        'abutment',
        [
          [base + 1.7, w + 1.36, 6.25],
          [y - 2.7, w * 0.71, 5.75],
          [y, w * 0.77, 7.4],
        ].map(([h, u, v]) => chamferedRectangle(x, h, Z, u, v, 0.52)),
        color.cement,
      );
      if (main) {
        const p = on(x, s * 17.2, -2.75),
          foot = [x + (x < 0 ? -5.3 : 5.3), top - 0.3, Z];
        beam(out, 'abutment', foot, p, 4.18, 5.67, color.cement);
        if (d >= 2) beam(out, 'steel', p, on(x, s * 17.23, -0.66), 2.65, 2.35, color.shadow);
      }
    }
    beam(
      out,
      'abutment',
      [x, top - 1.3, z - 14.9],
      [x, top - 1.3, z + 14.9],
      2.12,
      w * 0.87,
      color.cement,
    );
  }
}
function furniture(out, d) {
  if (d === 0) return;
  const runs = d === 1 ? stations(16) : d === 2 ? stations(26) : deck.map((r) => r[0]);
  for (const s of [-1, 1]) {
    const position = s * 17.8;
    const rail = runs.map((x) => on(x, position, 1.2));
    beamPath(out, 'steel', rail, 0.13, 0.14, color.silver);
    if (d === 0) continue;
    if (d === 1) continue;
    const stride = d === 2 ? 8 : 4.1;
    for (let x = a + 2; x < b - 1; x += stride)
      beam(out, 'steel', on(x, position, 0.19), on(x, position, 1.19), 0.1, 0.1, color.steel);
    for (const h of d === 2 ? [0.7] : [0.53, 0.86])
      beamPath(
        out,
        'steel',
        runs.map((x) => on(x, position, h)),
        0.066,
        0.071,
        color.steel,
      );
  }
  if (d < 2) return;
  for (let x = a + 14; x < b - 7; x += 29.6)
    for (const s of [-1, 1]) {
      const z = s * 15.48;
      const points = [on(x, z, 0.18), on(x, z, 7.08), on(x, z - s * 1.3, 8.25)];
      beamPath(out, 'steel', points, 0.16, 0.18, color.silver);
      beam(out, 'steel', points.at(-1), on(x, z - s * 1.95, 8.32), 0.35, 0.174, color.amber);
    }
  if (d >= 3)
    for (const x of [-halfSpan, halfSpan, a + 2, b - 2]) {
      for (const s of [-1, 1]) {
        const [x0, y, z] = on(x, s * 16.4, -0.41);
        loft(
          out,
          'steel',
          [radialRing(y, 0.45, 0.56, 8, [x0, z]), radialRing(y + 0.43, 0.56, 0.61, 8, [x0, z])],
          color.dark,
        );
      }
    }
}
export function buildBridgeLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error('Unknown Podilskyi Bridge detail level');
  roadDeck(out, d);
  arches(out, d);
  lowerWorks(out, d);
  supports(out, d);
  furniture(out, d);
}
export const buildSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildStreet = (out) => buildBridgeLevel(out, 'street');
export const buildCloseup = (out) => buildBridgeLevel(out, 'closeup');
export const buildMaster = (out) => buildBridgeLevel(out, 'master');
