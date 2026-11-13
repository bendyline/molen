/** Riga's Southern Bridge, fitted to the two mapped carriageways and two sidewalks. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.88 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.18 },
};
const palette = {
  asphalt: '4c4c50',
  white: 'eee8d8',
  kerb: 'd1c8b8',
  walk: 'aca79a',
  soffit: 'a6a098',
  wet: '67685e',
  pier: 'a6a095',
  cap: 'c3baa9',
  oxide: 'a24a24',
  orange: 'eb6e30',
  lightOrange: 'f27a33',
  darkOrange: 'c95221',
  galvanized: 'a6b0b0',
  fence: '788384',
  dark: '515759',
  lamp: 'dce4dd',
  joint: '6b6762',
  red: 'ac3533',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, value]) => [
    name,
    value.match(/../g).map((h) => {
      const n = parseInt(h, 16) / 255;
      return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const lod = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { rows, ends, piers, width, walk } = layout,
  half = width / 2,
  edgeRoad = 13.45,
  median = 1.55;
const up = [0, 1, 0],
  down = [0, -1, 0],
  side = (s) => [0, 0, s],
  end = (s) => [s, 0, 0];
const mix = (a, b, t) => a + (b - a) * t;
const at = (x) => {
  const i = rows.findIndex((r) => r[0] >= x);
  if (i <= 0) return rows[i < 0 ? rows.length - 1 : 0][1];
  const [a, b] = rows.slice(i - 1, i + 1);
  return mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
};
const pt = (x, z, lift = 0) => [x, at(x) + lift, z];
function quad(out, slot, color, [a, b, c, d], want) {
  for (let tri of [
    [a, b, c],
    [a, c, d],
  ]) {
    let n = normalFor(...tri);
    if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
      tri = tri.toReversed();
      n = n.map((x) => -x);
    }
    out.addTriangle(slot, '', tri, n, undefined, colors[color]);
  }
}
function strip(out, slot, color, x0, x1, z0, h0, z1, h1, n) {
  quad(out, slot, color, [pt(x0, z0, h0), pt(x1, z0, h0), pt(x1, z1, h1), pt(x0, z1, h1)], n);
}
function tube(out, slot, color, a, b, r0, r1, sides, cap = true) {
  const axis = normalize(b.map((v, i) => v - a[i]));
  const across = normalize(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    other = cross(axis, across);
  const ring = (p, r) =>
    Array.from({ length: sides }, (_, i) => {
      const t = (i * Math.PI * 2) / sides;
      return p.map((v, j) => v + r * (Math.cos(t) * across[j] + Math.sin(t) * other[j]));
    });
  loft(out, slot, [ring(a, r0), ring(b, r1)], colors[color], { cap });
}
function deck(out, d) {
  const stations = rows.filter((_, i) => d > 0 || i % 2 === 0);
  for (let i = 1; i < stations.length; i++) {
    const x0 = stations[i - 1][0],
      x1 = stations[i][0];
    strip(out, 'paving', 'asphalt', x0, x1, -edgeRoad, 0, edgeRoad, 0, up);
    for (const s of [-1, 1]) {
      strip(out, 'paving', 'walk', x0, x1, s * edgeRoad, walk, s * half, walk, up);
      strip(out, 'concrete', 'kerb', x0, x1, s * edgeRoad, 0, s * edgeRoad, walk, side(-s));
    }
    strip(out, 'concrete', 'soffit', x0, x1, -half, -0.59, half, -0.59, down);
    for (const s of [-1, 1]) {
      strip(out, 'concrete', 'kerb', x0, x1, s * half, walk, s * half, -0.59, side(s));
      const outer = s * 12.9,
        inner = s * 2.3;
      strip(out, 'steel', 'oxide', x0, x1, outer, -0.55, s * 11.05, -2.99, side(s));
      strip(out, 'steel', 'oxide', x0, x1, inner, -0.55, s * 3.15, -2.99, side(-s));
      strip(out, 'steel', 'darkOrange', x0, x1, s * 3.15, -2.99, s * 11.05, -2.99, down);
    }
  }
  for (const [i, x] of ends.entries()) {
    const top = walk;
    quad(
      out,
      'concrete',
      'cap',
      [pt(x, -half, -0.59), pt(x, half, -0.59), pt(x, half, top), pt(x, -half, top)],
      end(i === 0 ? -1 : 1),
    );
  }
  if (d < 2) return;
  const spacing = d === 2 ? 33 : d === 3 ? 10 : 6;
  for (let x = ends[0] + 4; x < ends[1] - 1; x += spacing) {
    for (const s of [-1, 1]) {
      const a = pt(x, s * 12.3, -0.65),
        b = pt(x, s * 16.96, -0.31);
      beam(out, 'steel', a, b, 0.29, 0.28, colors.oxide);
    }
    beam(out, 'steel', pt(x, -10.65, -2.85), pt(x, 10.65, -2.85), 0.37, 0.23, colors.dark);
  }
}
function pier(out, p, d) {
  const top = at(p.x) - 3.08,
    h = top - p.bottom;
  if (d === 0) {
    box(out, 'concrete', [p.x - 2.05, p.bottom, -9], [p.x + 2.05, top, 9], colors.pier);
    return;
  }
  const rings = [
    chamferedRectangle(p.x, p.bottom, 0, 4.6, 18.9, 0.57),
    chamferedRectangle(p.x, top - 0.28, 0, 4.3, 18.3, 0.51),
    chamferedRectangle(p.x, top, 0, 4.48, 18.55, 0.44),
  ];
  loft(out, 'concrete', rings, colors.pier);
  if (d >= 2) {
    if (top > layout.waterSurface + 1) {
      const base = p.bottom + 0.025,
        water = layout.waterSurface + 0.44;
      if (water > base)
        loft(
          out,
          'concrete',
          [
            chamferedRectangle(p.x, base, 0, 4.65, 18.94, 0.58),
            chamferedRectangle(p.x, Math.min(water, top - 0.36), 0, 4.54, 18.79, 0.54),
          ],
          colors.wet,
          { cap: false },
        );
    }
    for (const s of [-1, 1]) {
      box(
        out,
        'steel',
        [p.x - 1.2, top - 0.02, s * 6.98 - 0.82],
        [p.x + 1.2, top + 0.25, s * 6.98 + 0.82],
        colors.dark,
      );
      if (d >= 3 && p.pylon && Math.abs(p.x) < 210) {
        const z = s * 9.25,
          y = top - Math.min(3.8, h * 0.34);
        const a = [p.x - 1.02, y, z],
          b = [p.x, y + 0.9, z],
          c = [p.x + 1.02, y, z],
          f = [p.x, y - 0.9, z];
        for (const [points, color] of [
          [[a, b, f], 'red'],
          [[b, c, f], 'white'],
        ]) {
          const n = normalFor(...points);
          const tri = n[2] * s > 0 ? points : points.toReversed();
          out.addTriangle('steel', '', tri, normalFor(...tri), undefined, colors[color]);
        }
      }
    }
  }
}
function tower(out, p, d) {
  const x = p.x,
    y = at(x),
    h = layout.dimensions.pylonHeight;
  const shape =
    d === 0
      ? [
          [0, 2.15, 1.88],
          [h - 0.55, 6.85, 3.7],
          [h, 5.15, 3.1],
        ]
      : [
          [0, 2.15, 1.88],
          [0.56, 2.17, 1.88],
          [3.48, 2.65, 2.06],
          [8.34, 4.82, 3.25],
          [h - 1.12, 6.83, 3.93],
          [h - 0.47, 6.15, 3.7],
          [h, 4.32, 2.88],
        ];
  const rings = shape.map(([offset, w, depth]) =>
    d === 0
      ? [
          [x - w / 2, y + offset, -depth / 2],
          [x - w / 2, y + offset, depth / 2],
          [x + w / 2, y + offset, depth / 2],
          [x + w / 2, y + offset, -depth / 2],
        ]
      : chamferedRectangle(x, y + offset, 0, w, depth, 0.22),
  );
  loft(out, 'steel', rings, colors.orange);
  if (d >= 2) {
    for (const s of [-1, 1])
      beam(
        out,
        'steel',
        [x - 1.12, y + 0.19, s * 0.95],
        [x - 2.83, y + h - 0.68, s * 1.85],
        0.14,
        0.11,
        colors.lightOrange,
      );
  }
  const cablePositions = d === 0 ? [0, 2, 5, 7] : [0, 1, 2, 3, 4, 5, 6, 7];
  for (const s of [-1, 1])
    for (const i of cablePositions) {
      const anchor = x + s * (9.6 + i * 5.22),
        crossing = x + s * (2.35 + i * 0.135);
      const a = [crossing, y + h - 0.88 + i * 0.083, 0],
        b = pt(anchor, 0, 0.78);
      const tint = i % 3 === 0 ? 'lightOrange' : 'orange';
      if (d === 0) {
        tube(out, 'steel', tint, a, b, 0.21, 0.17, 3, false);
        continue;
      }
      tube(out, 'steel', tint, a, b, 0.116, 0.096, d === 1 ? 4 : d === 2 ? 5 : 8, false);
      if (d >= 2) {
        const near = a.map((v, k) => mix(b[k], v, 0.052));
        tube(out, 'steel', 'galvanized', near, b, 0.152, 0.206, d === 2 ? 5 : 8, true);
        const saddle = a.map((v, k) => mix(v, b[k], 0.036));
        tube(out, 'steel', 'dark', a, saddle, 0.151, 0.14, d === 2 ? 5 : 8, false);
        box(
          out,
          'concrete',
          [anchor - 0.49, at(anchor) + 0.006, -0.38],
          [anchor + 0.49, at(anchor) + 0.41, 0.38],
          colors.cap,
        );
      }
    }
}
function roadDetails(out, d) {
  const sections = rows.map((r) => r[0]);
  for (const s of [-1, 1]) {
    const railZ = s * (half - 0.21),
      guardZ = s * (median + 0.01);
    beamPath(
      out,
      'steel',
      sections.map((x) => pt(x, railZ, walk + 1.12)),
      0.09,
      0.09,
      colors.galvanized,
    );
    beamPath(
      out,
      'steel',
      sections.map((x) => pt(x, guardZ, 0.74)),
      0.24,
      0.16,
      colors.galvanized,
    );
    if (d === 1) continue;
    beamPath(
      out,
      'steel',
      sections.map((x) => pt(x, railZ, walk + 0.18)),
      0.06,
      0.08,
      colors.fence,
    );
    for (let i = 1; i < sections.length; i++) {
      const a = sections[i - 1],
        b = sections[i];
      for (const z of [s * 1.99, s * 13.11])
        strip(out, 'paving', 'white', a, b, z - 0.062, 0.009, z + 0.062, 0.009, up);
    }
    for (let x = ends[0] + 2; x < ends[1] - 2; x += 12.5) {
      const b = Math.min(x + 3.8, ends[1]);
      for (const z of [s * 5.52, s * 9.28])
        strip(out, 'paving', 'white', x, b, z - 0.061, 0.012, z + 0.061, 0.012, up);
    }
    const spacing = d === 2 ? 2.6 : d === 3 ? 0.32 : 0.23;
    for (let x = ends[0] + 0.25; x < ends[1] - 0.25; x += spacing) {
      const y = at(x) + walk,
        post = d === 2 ? 0.061 : 0.033;
      if (d === 4)
        box(
          out,
          'steel',
          [x - post / 2, y, railZ - 0.029],
          [x + post / 2, y + 1.09, railZ + 0.029],
          colors.fence,
        );
      else {
        const a = [x - post / 2, y, railZ],
          b = [x + post / 2, y, railZ],
          c = [b[0], y + 1.09, railZ],
          e = [a[0], y + 1.09, railZ];
        for (const sign of [-1, 1])
          quad(
            out,
            'steel',
            'fence',
            [a, b, c, e].map(([x, y, z]) => [x, y, z + sign * 0.003]),
            side(sign),
          );
      }
    }
    for (let x = ends[0] + 2.0; x < ends[1] - 1; x += d === 2 ? 10.5 : 3.75) {
      const a = pt(x, guardZ, 0),
        b = pt(x, guardZ, 0.71);
      beam(out, 'steel', a, b, 0.098, 0.15, colors.dark);
    }
    for (let x = ends[0] + 25 + s * 6; x < ends[1] - 13; x += d === 2 ? 42 : 32) {
      const z = s * 13.81,
        a = pt(x, z, walk),
        b = pt(x, z, walk + 7.38),
        c = pt(x, z - s * 1.16, walk + 8.3),
        e = pt(x, z - s * 2.45, walk + 8.5);
      beamPath(out, 'steel', [a, b, c, e], 0.102, 0.105, colors.dark);
      beam(out, 'steel', e, pt(x + 0.33, z - s * 2.6, walk + 8.49), 0.23, 0.135, colors.lamp);
    }
  }
  if (d >= 3)
    for (const x of [ends[0] + 1.06, ends[1] - 1.06]) {
      strip(out, 'paving', 'joint', x - 0.077, x + 0.077, -edgeRoad, 0.021, edgeRoad, 0.021, up);
    }
}
function abutments(out, d) {
  for (const [i, x] of ends.entries()) {
    const s = i === 0 ? 1 : -1,
      y = at(x);
    const a = Math.min(x, x + s * 3.6),
      b = Math.max(x, x + s * 3.6),
      floor = i === 0 ? 1.9 : -0.35;
    box(out, 'concrete', [a, floor, -half + 0.3], [b, y - 0.51, half - 0.3], colors.pier);
    if (d > 0)
      box(
        out,
        'concrete',
        [a - 0.14, y - 1.36, -half + 0.1],
        [b + 0.14, y - 0.56, half - 0.1],
        colors.cap,
      );
  }
}
export function buildSouthernLevel(out, level) {
  const d = lod[level];
  if (d === undefined) throw new Error(`Unknown Southern Bridge detail level ${level}`);
  deck(out, d);
  abutments(out, d);
  for (const p of piers) {
    pier(out, p, d);
    if (p.pylon) tower(out, p, d);
  }
  if (d > 0) roadDetails(out, d);
}
export const buildMaster = (out) => buildSouthernLevel(out, 'master');
export const buildSkyline = (out) => buildSouthernLevel(out, 'skyline');
export const buildDistrict = (out) => buildSouthernLevel(out, 'district');
export const buildStreet = (out) => buildSouthernLevel(out, 'street');
export const buildCloseup = (out) => buildSouthernLevel(out, 'closeup');
