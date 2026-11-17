/** The two reconstructed M-07 decks at the Hostomel crossing. */
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
  asphalt: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.9 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.19 },
};
const tones = {
  road: [0.234, 0.233, 0.223],
  white: [0.88, 0.868, 0.785],
  plate: [0.43, 0.46, 0.441],
  edge: [0.61, 0.6, 0.55],
  girder: [0.51, 0.5, 0.46],
  underside: [0.37, 0.366, 0.335],
  pier: [0.52, 0.505, 0.463],
  damp: [0.33, 0.32, 0.288],
  guard: [0.61, 0.653, 0.661],
  blue: [0.36, 0.464, 0.522],
  joint: [0.24, 0.251, 0.243],
  lamp: [0.65, 0.716, 0.72],
};
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0],
  down = [0, -1, 0];
const mix = (a, b, t) => a + (b - a) * t;
const ends = layout.routes
  .filter((r) => r.kind === 'road')
  .map((r, i) => [r, layout.routes[i === 0 ? 0 : 3], i === 0 ? -1 : 1]);
function roadAt(road, x) {
  const i = road.rows.findIndex((p) => p[0] >= x);
  if (i <= 0) return road.rows[i === 0 ? 0 : road.rows.length - 1];
  const a = road.rows[i - 1],
    b = road.rows[i],
    t = (x - a[0]) / (b[0] - a[0]);
  return [x, mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
const walkLift = (r, x) => 0.175 * Math.min(1, Math.max(0, (r.b - x) / 7));
const on = (r, x, z, h) => {
  const p = roadAt(r, x);
  return [x, p[1] + h - (r.kind === 'walk' ? 0.175 - walkLift(r, x) : 0), p[2] + z];
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
    out.addTriangle(slot, '', p, n, undefined, tones[tone]);
  }
}
function strip(out, r, slot, tone, a, b, z, h, w, H, n = up) {
  quad(out, slot, tone, [on(r, a, z, h), on(r, b, z, h), on(r, b, w, H), on(r, a, w, H)], n);
}
const select = (r, d) =>
  r.rows.filter((_, i) => d >= 2 || i % (d === 1 ? 4 : 8) === 0).map((row) => row[0]);
function carriageway(out, r, walk, s, d) {
  const outerWidth = (side) => (side === s ? 5.5 : 4.81);
  const rails = select(r, d);
  for (let i = 1; i < rails.length; i++) {
    const a = rails[i - 1],
      b = rails[i];
    strip(out, r, 'asphalt', 'road', a, b, -outerWidth(-1), 0, outerWidth(1), 0);
    strip(
      out,
      r,
      'concrete',
      'underside',
      a,
      b,
      -outerWidth(-1),
      -0.48,
      outerWidth(1),
      -0.48,
      down,
    );
    for (const side of [-1, 1]) {
      const z = outerWidth(side) * side;
      strip(out, r, 'concrete', 'edge', a, b, z, -0.49, z, 0.055, [0, 0, side]);
      if (d >= 1) strip(out, r, 'asphalt', 'white', a, b, side * 3.67, 0.016, side * 3.78, 0.016);
    }
    for (const z of d === 0 ? [-2.48, 2.48] : [-3.35, 0, 3.35]) {
      strip(out, r, 'concrete', 'girder', a, b, z - 0.36, -0.48, z - 0.25, -1.34, [0, 0, -1]);
      strip(out, r, 'concrete', 'girder', a, b, z + 0.36, -0.48, z + 0.25, -1.34, [0, 0, 1]);
      if (d >= 1)
        strip(out, r, 'concrete', 'underside', a, b, z - 0.25, -1.34, z + 0.25, -1.34, down);
    }
  }
  const path = select(walk, d),
    l = -1.1,
    h = 1.1;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1],
      b = path[i],
      z = s * h;
    strip(out, walk, 'concrete', 'edge', a, b, l, 0.175, h, 0.175);
    strip(out, walk, 'concrete', 'girder', a, b, z, -0.43, z, 0.175, [0, 0, s]);
    strip(out, walk, 'concrete', 'underside', a, b, l, -0.43, h, -0.43, down);
  }
  for (const x of [r.a, r.b]) {
    const n = [x === r.a ? -1 : 1, 0, 0];
    quad(
      out,
      'concrete',
      'girder',
      [
        on(r, x, -outerWidth(-1), -0.48),
        on(r, x, outerWidth(1), -0.48),
        on(r, x, outerWidth(1), 0),
        on(r, x, -outerWidth(-1), 0),
      ],
      n,
    );
  }
  if (d === 0) return;
  for (let x = r.a + 2.5; x < r.b - 3.7; x += d === 1 ? 13.2 : 10.4)
    strip(out, r, 'asphalt', 'white', x, x + (d === 1 ? 4.1 : 3.3), -0.058, 0.018, 0.058, 0.018);
  if (d >= 2)
    for (const x of [r.a + 0.43, 0, 31, 63, r.b - 0.4])
      strip(out, r, 'rail', 'joint', x - 0.069, x + 0.069, -4.72, 0.018, 4.72, 0.018);
}
function railings(out, r, walk, s, d) {
  const levels = d === 0 ? [0.79] : d === 1 ? [0.53, 0.91] : [0.38, 0.78, 1.21];
  const blueCenter = (x, h) => on(walk, x, s * 0.99, h + 0.175);
  for (const h of levels) {
    const path = select(walk, d === 0 ? 0 : 1).map((x) => blueCenter(x, h));
    beamPath(out, 'rail', path, h > 1 ? 0.072 : 0.082, h > 1 ? 0.066 : 0.077, tones.blue);
  }
  for (const l of [-4.49 * s, 4.62 * s]) {
    const fixed = select(r, d === 0 ? 0 : 1);
    for (let i = 1; i < fixed.length; i++) {
      const a = fixed[i - 1],
        b = fixed[i];
      strip(out, r, 'rail', 'guard', a, b, l, 0.52, l, 0.76, [0, 0, Math.sign(l)]);
      if (d >= 1) {
        strip(out, r, 'rail', 'plate', a, b, l - 0.072, 0.63, l + 0.072, 0.74);
        strip(out, r, 'rail', 'guard', a, b, l - 0.092, 0.755, l + 0.092, 0.755);
      }
    }
    if (d >= 2)
      for (let x = r.a + 0.7; x < r.b - 0.4; x += d === 2 ? 3.75 : 1.92)
        beam(out, 'rail', on(r, x, l, 0.02), on(r, x, l, 0.825), 0.102, 0.119, tones.guard);
  }
  if (d === 0) return;
  for (
    let x = walk.a + 0.64;
    x < walk.b - 0.4;
    x += d === 1 ? 10.2 : d === 2 ? 2.8 : d === 3 ? 0.8 : 0.53
  )
    beam(out, 'rail', blueCenter(x, 0.011), blueCenter(x, levels.at(-1)), 0.057, 0.067, tones.blue);
}
function foundation(out, row, d) {
  for (const [i, p] of row.half.entries()) {
    const { x, ends } = row,
      { z, base, top } = p;
    const blocks = (tone, args) =>
      loft(
        out,
        'concrete',
        args.map(([h, u, v, ch]) => chamferedRectangle(x, h, z, u, v, ch)),
        tones[tone],
      );
    if (ends) {
      blocks('pier', [
        [base, 4.4, 12.1, 0.49],
        [top, 2.7, 11.8, 0.4],
        [top + 0.83, 2.6, 11.6, 0.26],
      ]);
      if (d >= 1) {
        const zWing = z + (i === 0 ? -1 : 1) * 5.72,
          dir = x < 0 ? -1 : 1;
        beam(
          out,
          'concrete',
          [x, top - 0.28, zWing],
          [x + dir * 5.2, base + 1.04, zWing + (i === 0 ? -0.72 : 0.72)],
          1.02,
          2.24,
          tones.pier,
        );
      }
      continue;
    }
    blocks('damp', [
      [base - 0.8, 3.1, 11.0, 0.4],
      [base + 0.11, 3.1, 11.0, 0.4],
    ]);
    const count = d === 0 ? 1 : 2;
    const spokes = count === 1 ? [z] : [z - 2.94, z + 2.94];
    for (const zz of spokes) {
      const n = d === 0 ? 5 : d === 1 ? 8 : d >= 3 ? 16 : 10;
      loft(
        out,
        'concrete',
        [radialRing(base, 1.08, 1.01, n, [x, zz]), radialRing(top - 0.85, 1.05, 0.94, n, [x, zz])],
        tones.pier,
      );
    }
    blocks('pier', [
      [top - 1.06, 2.29, 11.54, 0.32],
      [top - 0.69, 2.63, 11.82, 0.36],
      [top - 0.12, 2.54, 11.87, 0.35],
    ]);
    if (d >= 2)
      for (const h of [-3.34, 0, 3.34])
        beam(
          out,
          'rail',
          [x, top - 0.115, z + h],
          [x, top + 0.046, z + h],
          1.35,
          1.08,
          tones.joint,
        );
  }
}
function lights(out, r, walk, s, d) {
  if (d === 0) return;
  for (const x of [r.a + 16, r.a + 57, r.a + 98]) {
    const base = on(walk, x, -s * 0.54, 0.19);
    const top = [x, base[1] + 7.63, base[2]],
      tip = [x, top[1] + 0.11, top[2] - s * 1.26];
    if (d === 1) {
      beam(out, 'rail', base, top, 0.125, 0.13, tones.lamp);
      continue;
    }
    beamPath(out, 'rail', [base, [x, top[1] - 0.54, top[2]], top, tip], 0.121, 0.123, tones.lamp);
    beam(out, 'rail', tip, [x, tip[1], tip[2] - s * 0.32], 0.114, 0.139, tones.plate);
    if (d >= 3)
      loft(
        out,
        'rail',
        [
          radialRing(base[1], 0.195, 0.18, 8, [x, base[2]]),
          radialRing(base[1] + 0.44, 0.09, 0.092, 8, [x, base[2]]),
        ],
        tones.plate,
      );
  }
}
export function buildBridgeLevel(out, level) {
  const d = levels[level];
  if (d === undefined) throw Error('Unknown Hostomel detail level');
  for (const [r, w, s] of ends) {
    carriageway(out, r, w, s, d);
    railings(out, r, w, s, d);
    lights(out, r, w, s, d);
  }
  for (const p of layout.piers) foundation(out, p, d);
}
export const buildSkyline = (out) => buildBridgeLevel(out, 'skyline');
export const buildDistrict = (out) => buildBridgeLevel(out, 'district');
export const buildStreet = (out) => buildBridgeLevel(out, 'street');
export const buildCloseup = (out) => buildBridgeLevel(out, 'closeup');
export const buildMaster = (out) => buildBridgeLevel(out, 'master');
