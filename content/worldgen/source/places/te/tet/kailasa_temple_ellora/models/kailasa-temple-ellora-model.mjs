/** Kailasa, Ellora Cave 16. Carved sanctuary, raised processional axis and its enclosing rock court. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  normalFor,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const terrain = read('terrain-grid.json');
const d = plan.dimensions;
const y = d.courtFloorY;
const z = d.templeCenterZ;
const west = d.courtEntranceX;
const east = d.courtRearX;
const north = d.courtNorthZ;
const south = d.courtSouthZ;
const surfaces = {
  rock: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_basalt_raw', roughness: 0.94, metallic: 0 },
  carving: { slot: 'trim', graph: 'stone_basalt_raw', roughness: 0.96, metallic: 0 },
  court: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.98, metallic: 0 },
  shadow: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.98, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    dark: '585247',
    rock: '868178',
    floor: '878781',
    weathered: '9b8b70',
    stone: '92826b',
    band: '796f5f',
    relief: '97876e',
    deep: '504a43',
    shadow: '322d25',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const rockLayer = ['827c70', '837d72', '827b70', '898375', '837e74', '807970', '878175'].map(rgb);

const solid = (out, slot, x, z0, y0, w, depth, rise, color) =>
  box(out, slot, [x - w / 2, y0, z0 - depth / 2], [x + w / 2, y0 + rise, z0 + depth / 2], color);
const mix = (a, b, t) => a + (b - a) * t;
const range = (n) => Array.from({ length: n }, (_, i) => i);

function face(out, slot, points, want, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * want[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  quad(out, slot, points, normal, color);
}

function ground(x, z0) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z0 - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    mix(mix(a[i], a[i + 1], u - i), mix(b[i], b[i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function courtFloor(out, level) {
  solid(
    out,
    'court',
    (west + east) / 2,
    (north + south) / 2,
    y - 0.91,
    east - west + 0.72,
    south - north + 0.72,
    0.91,
    c.floor,
  );
  if (!level) return;
  const step = level === 1 ? 11.7 : 6.88;
  for (let i = 1; west + i * step < east - 1; i++) {
    const x = west + i * step;
    face(
      out,
      'court',
      [
        [x, y + 0.006, north],
        [x + 0.043, y + 0.006, north],
        [x + 0.043, y + 0.006, south],
        [x, y + 0.006, south],
      ],
      [0, 1, 0],
      c.band,
    );
  }
  if (level < 2) return;
  for (let i = 1; i <= 6; i++) {
    const cross = north + ((south - north) * i) / 7;
    face(
      out,
      'court',
      [
        [west, y + 0.009, cross],
        [east, y + 0.009, cross],
        [east, y + 0.009, cross + 0.034],
        [west, y + 0.009, cross + 0.034],
      ],
      [0, 1, 0],
      c.band,
    );
  }
}

function cliff(out, run, level) {
  const { a, b, inside, back } = run;
  const columns = back ? [4, 8, 13, 22][level] : [6, 12, 19, 32][level];
  const layers = [2, 3, 5, 7][level];
  const sample = range(columns + 1).map((i) => {
    const t = i / columns;
    const x = mix(a[0], b[0], t),
      z0 = mix(a[1], b[1], t);
    const wave = (((i * 7 + run.side * 3) % 9) - 4) * 0.079;
    const outer = [x - inside[0] * 2.38, z0 - inside[2] * 2.38];
    const surface = ground(...outer);
    const line = back ? y + d.rearScarpHeight + wave : Math.max(y + 3.3, surface + 0.85 + wave);
    return { x, z: z0, line, outer, surface: surface - 0.3 };
  });
  const profile = (s, i, j) => {
    const t = j / layers;
    const lean =
      Math.sin(t * Math.PI) * 0.19 +
      (level > 0 ? (((i * 3 + j * 7 + run.side) % 9) - 4) * 0.052 * Math.sin(t * Math.PI) : 0);
    return [s.x + inside[0] * lean, mix(y - 0.22, s.line, t), s.z + inside[2] * lean];
  };
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < layers; j++) {
      const p = [
        profile(sample[i], i, j),
        profile(sample[i + 1], i + 1, j),
        profile(sample[i + 1], i + 1, j + 1),
        profile(sample[i], i, j + 1),
      ];
      // Non-coplanar rock strata benefit from two independently lit faces.
      for (const vertex of [
        [p[0], p[1], p[2]],
        [p[0], p[2], p[3]],
      ]) {
        let n = normalFor(...vertex);
        if (n[0] * inside[0] + n[2] * inside[2] < 0) {
          vertex.reverse();
          n = normalFor(...vertex);
        }
        out.addTriangle(
          'rock',
          'palette:#ffffff',
          vertex,
          n,
          vertex.map(([x, y0, z0]) => [x + z0, y0]),
          rockLayer[(j * 3 + Math.floor(i / 3) + run.side) % rockLayer.length],
        );
      }
    }
    const lo = sample[i],
      hi = sample[i + 1];
    face(
      out,
      'rock',
      [
        [lo.x, lo.line, lo.z],
        [hi.x, hi.line, hi.z],
        [hi.outer[0], hi.surface, hi.outer[1]],
        [lo.outer[0], lo.surface, lo.outer[1]],
      ],
      [0, 1, 0],
      c.rock,
    );
  }
}

function post(out, x, z0, lo, hi, width, level) {
  if (level === 0) {
    solid(out, 'stone', x, z0, lo, width, width, hi - lo, c.stone);
    return;
  }
  solid(out, 'stone', x, z0, lo, width * 1.21, width * 1.21, (hi - lo) * 0.16, c.band);
  solid(
    out,
    'stone',
    x,
    z0,
    lo + (hi - lo) * 0.14,
    width * 0.75,
    width * 0.75,
    (hi - lo) * 0.7,
    c.stone,
  );
  solid(
    out,
    'carving',
    x,
    z0,
    hi - (hi - lo) * 0.2,
    width * 1.16,
    width * 1.16,
    (hi - lo) * 0.2,
    c.relief,
  );
}

function gallery(out, level) {
  if (level === 0) return;
  const ledges = [
    { x: 18, z0: north + 1.12, sign: 1, len: 53, bottom: 2.2 },
    { x: 29.5, z0: south - 1.1, sign: -1, len: 47, bottom: 3.7 },
  ];
  for (const { x, z0, sign, len, bottom } of ledges) {
    const lo = y + bottom,
      hi = lo + 4.6;
    solid(out, 'stone', x, z0, lo - 0.39, len, 2.35, 0.4, c.band);
    solid(out, 'stone', x, z0, hi, len, 2.7, 0.64, c.weathered);
    const count = level === 1 ? 8 : level === 2 ? 13 : 16;
    const stride = len / count;
    const line = z0 + 0.42 * sign;
    const recess = z0 - 0.23 * sign;
    const f = sign > 0 ? 1 : -1;
    face(
      out,
      'shadow',
      [
        [x - len / 2 + 0.24, lo + 0.08, recess],
        [x + len / 2 - 0.24, lo + 0.08, recess],
        [x + len / 2 - 0.24, hi - 0.06, recess],
        [x - len / 2 + 0.24, hi - 0.06, recess],
      ],
      [0, 0, f],
      c.deep,
    );
    for (let i = 0; i <= count; i++)
      post(out, x - len / 2 + stride * i, line, lo, hi, 0.64, level === 1 ? 0 : 1);
  }
}

function moulding(out, x, z0, y0, w, l, level) {
  solid(out, 'stone', x, z0, y0, w, l, 0.3, c.weathered);
  solid(out, 'carving', x, z0, y0 + 0.3, w + 0.63, l + 0.63, 0.28, c.band);
  if (level > 1) solid(out, 'carving', x, z0, y0 + 0.59, w + 0.25, l + 0.25, 0.17, c.relief);
}

function tapered(out, x, z0, lo, hi, w, l, sw, sl, color) {
  const ring = (h, a, b) => [
    [x - a / 2, h, z0 - b / 2],
    [x + a / 2, h, z0 - b / 2],
    [x + a / 2, h, z0 + b / 2],
    [x - a / 2, h, z0 + b / 2],
  ];
  const bottom = ring(lo, w, l),
    top = ring(hi, sw, sl);
  const dirs = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, 'stone', [bottom[i], bottom[j], top[j], top[i]], dirs[i], color);
  }
  face(out, 'stone', top, [0, 1, 0], color);
}

function falseNiche(out, x, z0, w, l, lo, hi, alongX, side, level) {
  const plane = alongX ? z0 + (side * l) / 2 : x + (side * w) / 2;
  const u = alongX ? x : z0;
  const width = (alongX ? w : l) * 0.61;
  const p = (t, h, o) => (alongX ? [u + t, h, plane + o * side] : [plane + o * side, h, u + t]);
  const n = alongX ? [0, 0, side] : [side, 0, 0];
  face(
    out,
    'shadow',
    [
      p(-width / 2, lo, 0.03),
      p(width / 2, lo, 0.03),
      p(width / 2, hi, 0.03),
      p(-width / 2, hi, 0.03),
    ],
    n,
    c.dark,
  );
  if (level < 2) return;
  for (const v of [-width / 2, width / 2]) {
    face(
      out,
      'carving',
      [
        p(v - 0.13, lo, 0.085),
        p(v + 0.13, lo, 0.085),
        p(v + 0.29, hi, 0.085),
        p(v - 0.29, hi, 0.085),
      ],
      n,
      c.relief,
    );
  }
  face(
    out,
    'carving',
    [
      p(-width / 2, hi, 0.06),
      p(width / 2, hi, 0.06),
      p(width / 2 + 0.22, hi + 0.23, 0.17),
      p(-width / 2 - 0.22, hi + 0.23, 0.17),
    ],
    n,
    c.weathered,
  );
}

function tieredTower(out, x, z0, base, top, w, l, tiers, level) {
  const usable = top - base - 1.28;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const width = w * (1 - t * 0.68),
      depth = l * (1 - t * 0.68);
    const lo = base + t * usable,
      next = lo + usable / tiers;
    solid(out, 'stone', x, z0, lo, width, depth, 0.42, c.band);
    tapered(
      out,
      x,
      z0,
      lo + 0.42,
      next - 0.47,
      width - 0.34,
      depth - 0.35,
      width * 0.85,
      depth * 0.85,
      c.stone,
    );
    moulding(out, x, z0, next - 0.66, width * 0.91, depth * 0.91, level);
    if (level === 0) continue;
    const count = i === 0 ? 4 : 3;
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) / count - 0.5;
      for (const side of [-1, 1]) {
        const cap = next - 0.76;
        const bas = lo + 0.55;
        solid(
          out,
          'carving',
          x + u * width * 0.84,
          z0 + side * depth * 0.43,
          bas,
          width * 0.125,
          0.85,
          Math.max(0.31, cap - bas),
          c.relief,
        );
        solid(
          out,
          'carving',
          x + side * width * 0.43,
          z0 + u * depth * 0.84,
          bas,
          0.85,
          depth * 0.125,
          Math.max(0.31, cap - bas),
          c.relief,
        );
      }
    }
    if (level > 1)
      for (const side of [-1, 1]) {
        falseNiche(
          out,
          x,
          z0,
          width * 0.84,
          depth * 0.87,
          lo + 0.93,
          next - 0.81,
          true,
          side,
          level,
        );
        falseNiche(
          out,
          x,
          z0,
          width * 0.87,
          depth * 0.84,
          lo + 0.93,
          next - 0.81,
          false,
          side,
          level,
        );
      }
  }
  const r = w * 0.153;
  loft(
    out,
    'stone',
    [
      radialRing(top - 1.46, r, r, 8, [x, z0]),
      radialRing(top - 0.58, r * 0.75, r * 0.75, 8, [x, z0]),
      radialRing(top - 0.24, r * 0.41, r * 0.41, 8, [x, z0]),
      radialRing(top, r * 0.24, r * 0.24, 8, [x, z0]),
    ],
    c.weathered,
  );
}

function elephant(out, x, z0, level, side) {
  if (level === 0) return;
  const f = side;
  if (level === 1) {
    solid(out, 'carving', x, z0, 2.45, 1.45, 1.25, 1.54, c.relief);
    face(
      out,
      'carving',
      [
        [x - 0.37, 2.45, z0 + f * 0.64],
        [x + 0.37, 2.45, z0 + f * 0.64],
        [x + 0.33, 2.01, z0 + f * 0.9],
        [x - 0.22, 1.89, z0 + f * 0.93],
      ],
      [0, 0, f],
      c.relief,
    );
    return;
  }
  const p = (a, b) => z0 + side * a * b;
  const rings = level === 2 ? 4 : 5;
  const faces = level === 2 ? 6 : 8;
  sphere(out, 'carving', [x, 3.28, z0], [0.8, 0.93, 0.77], c.relief, rings, faces);
  sphere(out, 'carving', [x, 3.27, p(0.49, 1)], [0.56, 0.59, 0.57], c.weathered, rings, faces);
  sphere(out, 'carving', [x, 2.76, p(0.91, 1)], [0.23, 0.58, 0.23], c.relief, rings, faces);
  for (const a of [-0.49, 0.49]) {
    solid(out, 'carving', x + a, z0, 2.1, 0.35, 0.61, 1.08, c.stone);
    if (level === 3)
      sphere(out, 'carving', [x + a, 3.35, p(0.35, 1)], [0.31, 0.44, 0.27], c.relief, 3, 6);
  }
}

function carvedPlinth(out, level) {
  const x = 17;
  const w = d.templeMainLength,
    depth = d.templeMainWidth;
  solid(out, 'stone', x, z, y, w, depth, 1.97, c.band);
  solid(out, 'stone', x, z, y + 1.94, w - 0.88, depth - 0.89, 4.05, c.stone);
  solid(out, 'carving', x, z, y + 5.94, w - 0.29, depth - 0.22, 0.44, c.weathered);
  solid(out, 'stone', x, z, y + 6.37, w - 1.27, depth - 1.26, 1.62, c.stone);
  if (level === 0) return;
  for (const row of [0.31, 0.94, 1.49, 4.47, 5.46, 6.83, 7.45]) {
    solid(
      out,
      'carving',
      x,
      z,
      y + row,
      w - 0.63,
      depth - 0.55,
      0.14,
      row % 2 > 1 ? c.weathered : c.band,
    );
  }
  const count = [0, 8, 13, 15][level];
  for (const side of [-1, 1])
    for (let j = 0; j < count; j++)
      elephant(
        out,
        x - w * 0.44 + ((j + 0.5) * w * 0.88) / count,
        z + side * (depth / 2 - 0.56),
        level,
        side,
      );
}

function mandapa(out, level) {
  const by = y + d.plinthHeight;
  const towerX = 30.8;
  const hallX = 8.25;
  solid(out, 'stone', towerX, z, by, 16.8, 17.9, 8.0, c.stone);
  solid(out, 'stone', 13.03, z, by, 18.1, 15.68, 7.78, c.stone);
  moulding(out, hallX, z, by + 7.8, 27.8, 19.5, level);
  solid(out, 'stone', hallX, z, by + 8.53, 26.25, 17.88, 0.63, c.band);
  tieredTower(out, towerX, z, by + 7.82, y + d.mainTowerHeight, 17.55, 18.48, 3, level);
  if (level === 0) return;
  const n = level === 1 ? 3 : 4;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      post(
        out,
        hallX - 11.54 + i * 3.66,
        z - 8.4 + j * 5.59,
        by + 0.18,
        by + 7.78,
        0.92,
        level === 1 ? 0 : 1,
      );
  for (const side of [-1, 1]) {
    const line = z + side * 10.1;
    for (const xx of [0.6, 7.4, 13.1, 19.2]) {
      solid(out, 'carving', xx, line, by + 0.2, 3.0, 1.38, 4.67, c.weathered);
      moulding(out, xx, line, by + 4.87, 3.21, 1.72, level);
      falseNiche(out, xx, line, 2.93, 1.39, by + 0.89, by + 4.12, true, side, level);
    }
  }
}

function frontAxis(out, level) {
  solid(out, 'stone', west - 0.52, z - 7.21, y, 6.51, 8.86, 6.02, c.stone);
  solid(out, 'stone', west - 0.52, z + 7.21, y, 6.51, 8.86, 6.02, c.stone);
  solid(out, 'stone', west - 0.59, z, y + 5.75, 7.68, 25.54, 1.3, c.weathered);
  tapered(out, west - 0.52, z, y + 7.03, y + 11.1, 8.85, 23.4, 5.61, 17.9, c.stone);
  moulding(out, west - 0.55, z, y + 8.32, 8.24, 22.55, level);
  if (level > 1)
    for (let j = 0; j < 7; j++)
      falseNiche(
        out,
        west - 4.84,
        z - 8.1 + j * 2.7,
        0.35,
        2.31,
        y + 7.44,
        y + 8.22,
        false,
        -1,
        level,
      );
  const cx = -13.27;
  solid(out, 'stone', cx, z, y, 9.63, 10.9, 6.03, c.stone);
  solid(out, 'stone', cx, z, y + 5.76, 10.36, 11.67, 0.74, c.weathered);
  solid(out, 'stone', -5.78, z, y + 6.42, 7.31, 4.38, 1.78, c.stone);
  for (const dx of [-3.65, 3.65])
    for (const dz of [-3.83, 3.83])
      post(out, cx + dx, z + dz, y + 6.45, y + 10.65, 0.82, level === 0 ? 0 : 1);
  tapered(out, cx, z, y + 10.55, y + 13.85, 10.91, 12.28, 6.75, 7.4, c.stone);
  moulding(out, cx, z, y + 10.49, 11.03, 12.31, level);
  if (level > 0)
    for (const side of [-1, 1]) {
      const cz = z + side * 9.9;
      solid(out, 'carving', cx - 1.33, cz, y, 2.58, 2.52, 1.08, c.weathered);
      solid(out, 'stone', cx - 1.33, cz, y + 1.0, 1.89, 1.89, 0.74, c.band);
      tapered(out, cx - 1.33, cz, y + 1.76, y + 13.35, 1.49, 1.49, 0.81, 0.83, c.stone);
      moulding(out, cx - 1.33, cz, y + 13.35, 1.61, 1.61, level);
      solid(out, 'stone', cx - 1.33, cz, y + 14.01, 1.17, 1.22, 0.64, c.weathered);
      if (level > 1) elephant(out, cx - 3.9, cz + 3.88 * side, level, -side);
    }
}

function smallShrines(out, level) {
  const by = y + d.plinthHeight;
  for (const [x, z0] of [
    [23.6, 4.5],
    [35.5, 4.55],
    [40, 16.75],
    [35.3, 29.05],
    [23.7, 29.05],
  ]) {
    solid(out, 'stone', x, z0, by, 4.42, 4.72, 2.75, c.stone);
    if (level < 2) {
      tapered(out, x, z0, by + 2.62, by + 6.22, 4.82, 5.12, 2.08, 2.19, c.weathered);
    } else {
      tieredTower(out, x, z0, by + 2.62, by + 6.5, 4.82, 5.12, 1, level);
    }
  }
  if (level > 0) {
    const x = 46.33,
      z0 = z + 16.1;
    solid(out, 'stone', x, z0, y, 8.1, 7.35, 4.6, c.stone);
    tapered(out, x, z0, y + 4.21, y + 7.02, 8.4, 7.85, 5.45, 5.16, c.weathered);
    for (const offset of [-2.6, 0, 2.6])
      falseNiche(out, x + offset, z0, 2.15, 7.44, y + 0.55, y + 3.82, true, -1, level);
  }
}

function accessStairs(out, level) {
  const count = [2, 9, 20, 29][level];
  const top = y + d.plinthHeight + 0.05;
  for (const side of [-1, 1]) {
    const edge = z + side * 13.78;
    const width = 3.02;
    for (let i = 0; i < count; i++) {
      const lo = i / count;
      const dz0 = edge + side * (1 - lo) * 6.2;
      solid(
        out,
        'stone',
        6.13,
        dz0,
        y - 0.08,
        width,
        6.2 / count + 0.025,
        (top - y) * lo + 0.22,
        c.weathered,
      );
    }
  }
}

function draw(out, level) {
  courtFloor(out, level);
  cliff(out, { a: [west, north], b: [east, north], inside: [0, 0, 1], side: 0 }, level);
  cliff(out, { a: [east, south], b: [west, south], inside: [0, 0, -1], side: 1 }, level);
  cliff(
    out,
    { a: [east, north], b: [east, south], inside: [-1, 0, 0], side: 2, back: true },
    level,
  );
  gallery(out, level);
  carvedPlinth(out, level);
  frontAxis(out, level);
  mandapa(out, level);
  smallShrines(out, level);
  accessStairs(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-92, 64, 103];
const lookAt = [15, 9.3, 17.0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  groundCutout: plan.groundCutout,
  brief:
    'Kailasa Temple carved from the cliff at Ellora, with the main Dravidian tower, rock court, low western gate, Nandi pavilion and the elephant plinth.',
  camera,
  lookAt,
  sunDirection: [-141, 168, 85],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stone_basalt_raw'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.78,
    groundY: y - 0.1,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'rock-court-and-sanctuary', position: [-43, 46, 61], lookAt: [14, 9, 18] },
    { name: 'western-entrance-and-nandi', position: [-53, 15, 17], lookAt: [0, 11, 16] },
    { name: 'elephant-plinth-and-tiered-shrine', position: [6, 6.2, 37.3], lookAt: [16, 5.55, 20] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.1, surfaces },
      street: { export: 'street', errorMeters: 0.42, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.13, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction from exact CC0 Qualla photos, mapped Cave 16 site, original composite elevation and the State Party conservation report.',
};
