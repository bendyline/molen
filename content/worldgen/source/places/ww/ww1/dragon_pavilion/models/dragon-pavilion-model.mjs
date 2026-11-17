/** Kaifeng's Dragon Pavilion and imperial stair on the Longting terrace. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const map = read('map-frame');
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const p = map.geometry.outline;
const platform = [p[0], p[1], p[2], p[9], p[10], p[11], p[14], p[15]];
const easternWing = [p[11], p[12], p[13], p[14]];
const {
  baseHeight,
  totalHeight,
  steps,
  rampWidth,
  stairLength,
  stairHalfWidth,
  hallCenter,
  lowerRoofHalf,
  upperRoofHalf,
  wallHalf,
} = plan.dimensions;
const up = [0, 1, 0],
  ref = 'palette:#ffffff';
const surfaces = {
  terrace: { slot: 'wall', graph: 'brick_longformat', roughness: 0.94, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.86, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#eee6d5', roughness: 0.82, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    wall: '994f43',
    plinth: '99584b',
    band: '8e4a40',
    red: 'a85446',
    vermilion: 'aa553f',
    burgundy: '7f413b',
    stone: 'a7a79b',
    chalk: 'c3bdb0',
    slate: '8b8d83',
    stair: 'a4a498',
    ramp: 'b2b4a9',
    relief: 'c2c2b6',
    gold: 'b6944c',
    crest: 'a78244',
    eave: 'be9d54',
    ridge: 'b88d46',
    green: '53685a',
    blue: '687d70',
    trim: 'be9a61',
    glass: '5a4a3b',
    interior: '5d4038',
    wood: '865040',
    dark: '6f493e',
    name: '4b5045',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const point = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(1, v));
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const row = (n) => lerp(terrain.heightsMeters[n][i], terrain.heightsMeters[n][i + 1], u - i);
  return lerp(row(j), row(j + 1), v - j) - terrain.modelDatumElevationMeters;
}
function face(out, slot, points, normalHint, shade) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * normalHint[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, shade);
  else
    out.addTriangle(
      slot,
      ref,
      points,
      n,
      points.map(([x, , z]) => [x, z]),
      shade,
    );
}
function edge(a, b, sign = 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / length,
    dz = (b[1] - a[1]) / length;
  const n = [sign * dz, 0, -sign * dx];
  return {
    length,
    n,
    at(u, y, d = 0) {
      return [a[0] + dx * u + n[0] * d, y, a[1] + dz * u + n[2] * d];
    },
  };
}
function panel(out, f, slot, a, b, y0, y1, y2, y3, d, tint) {
  face(out, slot, [f.at(a, y0, d), f.at(b, y1, d), f.at(b, y2, d), f.at(a, y3, d)], f.n, tint);
}
function cap(out, slot, polygon, y, shade) {
  const map = new MeshBufferBuilder();
  if (
    !map.addCap(
      slot,
      ref,
      polygon,
      [],
      () => y,
      up,
      (q) => q,
      shade,
    )
  )
    throw new Error('Cannot triangulate Dragon Pavilion platform');
  const { positions, indices } = map.finalize();
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      Array.from(indices.slice(i, i + 3), (n) => Array.from(positions.slice(n * 3, n * 3 + 3))),
      up,
      shade,
    );
}
function wallRing(out, polygon, height, lod, shade) {
  const area = polygon.reduce((sum, [x, z], i) => {
    const b = polygon[(i + 1) % polygon.length];
    return sum + x * b[1] - z * b[0];
  }, 0);
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length],
      f = edge(a, b, Math.sign(area));
    const la = Math.min(-0.18, grade(a) - 0.44),
      lb = Math.min(-0.18, grade(b) - 0.44);
    panel(out, f, 'terrace', 0, f.length, la, lb, height, height, 0, shade);
    panel(out, f, 'terrace', 0, f.length, la, lb, la + 0.55, lb + 0.55, 0.07, color.plinth);
    if (lod) {
      panel(
        out,
        f,
        'terrace',
        0,
        f.length,
        height - 0.43,
        height - 0.43,
        height - 0.02,
        height - 0.02,
        0.07,
        color.band,
      );
      if (lod >= 2 && f.length > 8) {
        const n = Math.floor(f.length / 6.2);
        for (let j = 1; j <= n; j++) {
          const u = (f.length * j) / (n + 1),
            y = height - 1.02;
          panel(
            out,
            f,
            'detail',
            u - 0.18,
            u + 0.18,
            y - 0.16,
            y - 0.16,
            y + 0.16,
            y + 0.16,
            0.09,
            color.dark,
          );
          panel(
            out,
            f,
            'stone',
            u - 0.24,
            u + 0.24,
            y + 0.14,
            y + 0.14,
            y + 0.23,
            y + 0.23,
            0.14,
            color.slate,
          );
        }
      }
    }
  }
  cap(out, 'stone', polygon, height, color.slate);
}
function platformMasonry(out, lod) {
  wallRing(out, platform, baseHeight, lod, color.wall);
  wallRing(out, easternWing, 5.32, lod, color.plinth);
  for (const [x0, x1, z, h] of [
    [-34.48, -28.35, -0.23, 10.93],
    [27.46, 32.16, 0.19, 10.9],
    [-34.82, -30.08, -0.42, 7.72],
    [29.26, 32.45, 0.45, 7.78],
  ]) {
    box(out, 'terrace', [x0, -0.42, z - 2.6], [x1, h, z + 1.33], color.plinth);
    if (lod)
      box(out, 'terrace', [x0 - 0.1, h - 0.14, z - 2.7], [x1 + 0.1, h, z + 1.53], color.band);
  }
}

const stairY = (z) => baseHeight * (1 - clamp(z / stairLength));
function stairRamp(out, lod) {
  const n = lod >= 2 ? steps : lod === 1 ? 24 : 1;
  const right = stairHalfWidth - 0.02,
    middle = rampWidth / 2;
  const g = (z) => Math.min(grade([0, z]) - 0.44, -0.27);
  for (const sign of [-1, 1]) {
    const x = sign * right;
    face(
      out,
      'terrace',
      [
        [x, g(0), 0],
        [x, g(stairLength), stairLength],
        [x, 0.065, stairLength],
        [x, baseHeight, 0],
      ],
      [sign, 0, 0],
      color.wall,
    );
  }
  if (n === 1) {
    for (const [a, b] of [
      [-right, -middle],
      [middle, right],
    ])
      face(
        out,
        'stone',
        [
          [a, baseHeight, 0],
          [b, baseHeight, 0],
          [b, 0.09, stairLength],
          [a, 0.09, stairLength],
        ],
        up,
        color.stair,
      );
  } else {
    for (let i = 0; i < n; i++) {
      const z0 = (stairLength * i) / n,
        z1 = (stairLength * (i + 1)) / n;
      const y = Math.max(0.09, stairY(z0) - (baseHeight / n) * 0.85);
      for (const [a, b] of [
        [-right, -middle],
        [middle, right],
      ]) {
        face(
          out,
          'stone',
          [
            [a, y, z0],
            [b, y, z0],
            [b, y, z1],
            [a, y, z1],
          ],
          up,
          color.stair,
        );
        const low = stairY(z1) - (baseHeight / n) * 0.85;
        face(
          out,
          'stone',
          [
            [a, low, z1],
            [b, low, z1],
            [b, y, z1],
            [a, y, z1],
          ],
          [0, 0, 1],
          color.slate,
        );
      }
    }
  }
  for (const [a, b, shade] of [
    [-middle, -middle + 0.31, color.chalk],
    [-middle + 0.31, middle - 0.31, color.ramp],
    [middle - 0.31, middle, color.chalk],
  ]) {
    face(
      out,
      'stone',
      [
        [a, baseHeight + 0.065, 0],
        [b, baseHeight + 0.065, 0],
        [b, 0.13, stairLength],
        [a, 0.13, stairLength],
      ],
      up,
      shade,
    );
  }
  box(
    out,
    'stone',
    [-right, baseHeight - 0.21, -0.36],
    [right, baseHeight + 0.025, 0.68],
    color.chalk,
  );
  box(
    out,
    'stone',
    [-right, -0.28, stairLength - 0.42],
    [right, 0.08, stairLength + 0.36],
    color.stair,
  );
  if (lod >= 2) rampRelief(out, lod);
}
function rampRelief(out, lod) {
  const width = lod === 2 ? 0.13 : 0.16,
    points = lod === 2 ? 26 : 56;
  const control = (i, sign) => {
    const t = i / points,
      z = 1.1 + (stairLength - 2.35) * t;
    const x = sign * 0.65 * Math.sin(6.5 * t * Math.PI) + sign * 0.48 * Math.sin(t * Math.PI);
    return [x, stairY(z) + 0.153, z];
  };
  for (const sign of [-1, 1]) {
    for (let i = 0; i < points; i++)
      beam(
        out,
        'stone',
        control(i, sign),
        control(i + 1, sign),
        width,
        0.062,
        i % 3 ? color.relief : color.chalk,
      );
    if (lod < 3) continue;
    for (let j = 0; j < 14; j++) {
      const z = 1.6 + j * 1.87,
        x = sign * (0.98 + (j % 3) * 0.11),
        y = stairY(z) + 0.142;
      beam(out, 'stone', [x - 0.31, y, z], [x + 0.26, y - 0.12, z + 0.29], 0.1, 0.047, color.chalk);
    }
  }
}

function railing(out, a, b, height, lod) {
  const f = edge(a, b);
  if (!lod) {
    beam(
      out,
      'stone',
      point(a, height(a[1]) + 0.77),
      point(b, height(b[1]) + 0.77),
      0.17,
      0.17,
      color.chalk,
    );
    return;
  }
  const count = Math.max(1, Math.round(f.length / (lod === 1 ? 5.3 : 2.7)));
  const rise = (u) => height(a[1] + (b[1] - a[1]) * (u / f.length));
  const top = (u) => rise(u) + 0.79;
  const span = f.length / count;
  for (let i = 0; i <= count; i++) {
    const u = i * span,
      y = rise(u);
    const [x, , z] = f.at(u, y);
    const half = lod === 0 ? 0.19 : 0.15;
    box(out, 'stone', [x - half, y - 0.065, z - half], [x + half, y + 1.11, z + half], color.stone);
    if (lod >= 2) {
      const sides = lod === 2 ? 6 : 8;
      const rings = [
        radialRing(y + 1.08, 0.16, 0.16, sides, [x, z]),
        radialRing(y + 1.18, 0.19, 0.19, sides, [x, z]),
      ];
      if (lod === 3) rings.push(radialRing(y + 1.35, 0.098, 0.098, sides, [x, z]));
      rings.push(radialRing(y + 1.39, 0.039, 0.039, sides, [x, z]));
      loft(out, 'stone', rings, color.chalk);
    }
    if (i === count) continue;
    const v = u + span;
    beam(out, 'stone', f.at(u, top(u)), f.at(v, top(v)), 0.17, 0.16, color.chalk);
    if (lod >= 2)
      beam(out, 'stone', f.at(u, rise(u) + 0.24), f.at(v, rise(v) + 0.24), 0.14, 0.14, color.stone);
    if (lod >= 2) {
      for (const t of [0.18, 0.51, 0.83]) {
        const x0 = u + span * (t - 0.052),
          x1 = u + span * (t + 0.052);
        panel(
          out,
          f,
          'stone',
          x0,
          x1,
          rise(x0) + 0.18,
          rise(x1) + 0.18,
          top(x0),
          top(x1),
          0.032,
          color.stone,
        );
      }
    }
  }
}
function railings(out, lod) {
  const lines = [
    [p[0], p[1]],
    [p[1], p[2]],
    [p[9], p[10]],
    [p[10], p[11]],
    [p[11], p[14]],
    [p[14], p[15]],
    [p[15], p[0]],
  ];
  for (const [a, b] of lines) railing(out, a, b, () => baseHeight, lod);
  for (const sign of [-1, 1]) {
    const x = sign * (stairHalfWidth - 0.08);
    railing(out, [x, 0.17], [x, stairLength - 0.18], stairY, lod);
  }
}

function timberPost(out, x, z, bottom, top, lod, tint) {
  const r = 0.3,
    s = lod >= 2 ? 10 : lod ? 6 : 5;
  loft(
    out,
    'detail',
    [radialRing(bottom, r, r, s, [x, z]), radialRing(top, r * 0.87, r * 0.87, s, [x, z])],
    tint,
  );
  if (lod)
    box(
      out,
      'stone',
      [x - 0.41, bottom - 0.08, z - 0.41],
      [x + 0.41, bottom + 0.18, z + 0.41],
      color.chalk,
    );
}
function hall(out, lod) {
  const [x, z] = hallCenter;
  const [w, d] = wallHalf;
  const lowerFloor = baseHeight + 0.31;
  const posts = rect(x - w - 2.05, x + w + 2.05, z - d - 2.14, z + d + 2.14);
  box(
    out,
    'stone',
    [x - w - 2.63, baseHeight - 0.03, z - d - 2.49],
    [x + w + 2.63, lowerFloor, z + d + 2.49],
    color.chalk,
  );
  box(out, 'wood', [x - w, lowerFloor, z - d], [x + w, 19.02, z + d], color.wood);
  const ring = rect(x - w, x + w, z - d, z + d);
  for (let i = 0; i < 4; i++) {
    const f = edge(ring[i], ring[(i + 1) % 4]);
    const count = i % 2 ? 5 : 9;
    for (let j = 0; j < count; j++) {
      const width = f.length / count;
      const a = width * (j + 0.15),
        b = width * (j + 0.85);
      const entrance = i === 2 && j >= 3 && j <= 5;
      panel(
        out,
        f,
        'detail',
        a,
        b,
        lowerFloor + (entrance ? 0.12 : 0.83),
        lowerFloor + (entrance ? 0.12 : 0.83),
        17.55,
        17.55,
        0.045,
        entrance ? color.interior : color.glass,
      );
      if (lod >= 2) {
        for (let k = 1; k < 5; k++) {
          const t = lerp(a, b, k / 5),
            y = lowerFloor + (entrance ? 0.14 : 0.95);
          panel(out, f, 'detail', t - 0.031, t + 0.031, y, y, 17.53, 17.53, 0.062, color.red);
        }
        panel(out, f, 'detail', a, b, 16.57, 16.57, 16.66, 16.66, 0.066, color.trim);
      }
    }
  }
  for (let i = 0; i < 4; i++) {
    const f = edge(posts[i], posts[(i + 1) % 4]);
    const count = lod === 0 ? (i % 2 ? 3 : 5) : i % 2 ? 5 : 9;
    for (let j = 0; j < count; j++) {
      const u = (f.length * j) / count;
      const [px, , pz] = f.at(u, lowerFloor);
      timberPost(out, px, pz, lowerFloor, 18.99, lod, color.red);
      if (lod >= 2) {
        const tip = f.at(u, 19.18, 0.22);
        beam(out, 'detail', f.at(u, 18.6, -0.11), tip, 0.36, 0.36, color.green);
        face(
          out,
          'detail',
          [f.at(u - 0.4, 18.92, 0.14), f.at(u + 0.4, 18.92, 0.14), f.at(u, 18.59, 0.14)],
          f.n,
          color.trim,
        );
      }
    }
    panel(out, f, 'detail', 0, f.length, 18.73, 18.73, 19.18, 19.18, 0.08, color.green);
  }
  const u = 17.7,
    v = 6.72;
  box(out, 'wood', [x - u, 20.74, z - v], [x + u, 22.48, z + v], color.burgundy);
  const f = edge([x + u, z + v], [x - u, z + v]);
  panel(out, f, 'detail', 0, f.length, 21.58, 21.58, 22.0, 22.0, 0.06, color.green);
  if (lod) {
    const center = f.length / 2;
    panel(
      out,
      f,
      'detail',
      center - 0.62,
      center + 0.62,
      21.23,
      21.23,
      22.73,
      22.73,
      0.13,
      color.crest,
    );
    panel(
      out,
      f,
      'detail',
      center - 0.5,
      center + 0.5,
      21.34,
      21.34,
      22.62,
      22.62,
      0.15,
      color.name,
    );
    if (lod >= 2) plaque(out, f, center);
  }
}

function plaque(out, f, c) {
  // Stylized marks based on the photographed vertical 龍亭 inscription.
  const glyphs = [
    ['11101', '01011', '11101', '11011', '10101', '11111'],
    ['00100', '11111', '01010', '11111', '00100', '00110'],
  ];
  for (const [g, rows] of glyphs.entries()) {
    const x = c - 0.34,
      top = 22.53 - g * 0.59;
    for (const [r, row] of rows.entries())
      for (const [column, v] of [...row].entries()) {
        if (v === '0') continue;
        const a = x + column * 0.135,
          y = top - r * 0.079;
        panel(out, f, 'detail', a, a + 0.098, y - 0.056, y - 0.056, y, y, 0.173, color.gold);
      }
  }
}

function roofGeometry(out, lod, { w, d, y, rise, swept, shrink, endZ, topRidge = false }) {
  const [x, z] = hallCenter;
  const sections = lod === 0 ? 3 : lod === 1 ? 5 : lod === 2 ? 12 : 18;
  const rings = lod === 0 ? 2 : lod === 1 ? 3 : lod === 2 ? 5 : 7;
  const yawPoint = (side, u, t) => {
    const h = w * lerp(1, shrink, t),
      q = d * lerp(1, endZ, t);
    const v = 2 * u - 1,
      lift = Math.pow(Math.abs(v), 4) * swept * Math.pow(1 - t, 2);
    const high = y + rise * Math.pow(t, 1.51) + lift;
    if (side === 0) return [x + v * h, high, z - q];
    if (side === 1) return [x + h, high, z + v * q];
    if (side === 2) return [x - v * h, high, z + q];
    return [x - h, high, z - v * q];
  };
  for (let side = 0; side < 4; side++) {
    for (let row = 0; row < rings; row++) {
      const a = row / rings,
        b = (row + 1) / rings;
      for (let j = 0; j < sections; j++) {
        const u = j / sections,
          v = (j + 1) / sections;
        const p0 = yawPoint(side, u, a),
          p1 = yawPoint(side, v, a),
          p2 = yawPoint(side, v, b),
          p3 = yawPoint(side, u, b);
        face(out, 'roof', [p0, p1, p2], up, color.gold);
        face(out, 'roof', [p0, p2, p3], up, color.gold);
        if (lod >= 2 && j % (lod === 2 ? 4 : 2) === 0)
          beam(
            out,
            'roof',
            [p0[0], p0[1] + 0.037, p0[2]],
            [p3[0], p3[1] + 0.037, p3[2]],
            0.11,
            0.067,
            color.eave,
          );
      }
    }
    if (lod) {
      for (let j = 0; j < sections; j++) {
        const p = yawPoint(side, j / sections, 0),
          q = yawPoint(side, (j + 1) / sections, 0);
        beam(
          out,
          'roof',
          [p[0], p[1] - 0.035, p[2]],
          [q[0], q[1] - 0.035, q[2]],
          0.21,
          0.17,
          color.crest,
        );
      }
      for (let i = 0; i < rings; i++) {
        const p = yawPoint(side, 0, i / rings),
          q = yawPoint(side, 0, (i + 1) / rings);
        beam(
          out,
          'roof',
          [p[0], p[1] + 0.08, p[2]],
          [q[0], q[1] + 0.08, q[2]],
          0.22,
          0.15,
          color.ridge,
        );
      }
    }
  }
  if (lod >= 2)
    for (let side = 0; side < 4; side++)
      for (let j = 0; j < sections; j++) {
        const u = j / sections,
          v = (j + 1) / sections;
        const outer = [yawPoint(side, u, 0), yawPoint(side, v, 0)].map(([x, y, z]) => [
          x,
          y - 0.09,
          z,
        ]);
        const inner = [yawPoint(side, u, 0.31), yawPoint(side, v, 0.31)].map(([x, , z]) => [
          x,
          y - 0.31,
          z,
        ]);
        face(out, 'detail', [outer[0], outer[1], inner[1], inner[0]], [0, -1, 0], color.dark);
      }
  if (!topRidge) return;
  const h = w * shrink,
    q = d * endZ,
    base = y + rise,
    crest = totalHeight - 0.48;
  const back = [
      [x - h, base, z - q],
      [x + h, base, z - q],
    ],
    front = [
      [x - h, base, z + q],
      [x + h, base, z + q],
    ];
  const ridge = [
    [x - h, crest, z],
    [x + h, crest, z],
  ];
  for (const run of [back, front])
    face(out, 'roof', [run[0], run[1], ridge[1], ridge[0]], up, color.gold);
  for (const [i, s] of [
    [0, -1],
    [1, 1],
  ]) {
    face(out, 'wood', [back[i], front[i], ridge[i]], [s, 0, 0], color.burgundy);
    if (lod)
      for (const part of [back[i], front[i]])
        beam(out, 'roof', part, ridge[i], 0.27, 0.23, color.crest);
  }
  beam(out, 'roof', ridge[0], ridge[1], 0.47, 0.42, color.crest);
  if (lod >= 2) {
    for (const sign of [-1, 1]) {
      const x0 = x + sign * h;
      loft(
        out,
        'roof',
        [
          radialRing(crest - 0.14, 0.29, 0.23, 8, [x0, z]),
          radialRing(totalHeight - 0.12, 0.16, 0.16, 8, [x0 + sign * 0.14, z]),
          radialRing(totalHeight, 0.08, 0.08, 8, [x0 + sign * 0.25, z]),
        ],
        color.crest,
      );
    }
    const tiles = lod === 3 ? 33 : 18;
    for (let i = 0; i <= tiles; i++) {
      const x0 = x - h + (2 * h * i) / tiles;
      for (const s of [-1, 1])
        beam(
          out,
          'roof',
          [x0, base + 0.075, z + s * q],
          [x0, crest + 0.012, z],
          0.12,
          0.067,
          color.eave,
        );
    }
  }
}

function build(out, lod) {
  platformMasonry(out, lod);
  stairRamp(out, lod);
  railings(out, lod);
  hall(out, lod);
  roofGeometry(out, lod, {
    w: lowerRoofHalf[0],
    d: lowerRoofHalf[1],
    y: 19.08,
    rise: 2.41,
    swept: 1.42,
    shrink: 0.76,
    endZ: 0.59,
  });
  roofGeometry(out, lod, {
    w: upperRoofHalf[0],
    d: upperRoofHalf[1],
    y: 22.18,
    rise: 2.06,
    swept: 1.49,
    shrink: 0.68,
    endZ: 0.48,
    topRidge: true,
  });
}
export const dragonSkyline = (out) => build(out, 0);
export const dragonDistrict = (out) => build(out, 1);
export const dragonStreet = (out) => build(out, 2);
export const dragonCloseup = (out) => build(out, 3);

const recipe = 'dragon-pavilion-model.mjs';
const camera = [69, 46, 79],
  lookAt = [0, 11, -4];
export const dragonModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: dragonCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: p,
    minimumCoverage: 0.995,
    basis: 'Mapped pavilion, platform and principal stairs.',
  },
  brief:
    'The standing Dragon Pavilion in Kaifeng, its golden double-eaved roof over red columns, raised masonry platform and 72-step stair with a carved dragon ramp.',
  camera,
  lookAt,
  sunDirection: [-64, 96, 119],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.58,
    cameraYaw: 0.4,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'dragon-pavilion-from-the-south', position: [0, 7.7, 86], lookAt: [0, 13.25, 0] },
    { name: 'carved-stair-and-deep-eaves', position: [0.4, 3.5, 34], lookAt: [0, 14.8, -8.2] },
    { name: 'roof-form-and-terrace-railings', position: [56, 42, -55], lookAt: [-2, 16, -13] },
    {
      name: 'lower-stair-terrace-wall-and-twin-roofs',
      position: [-57, 7.9, 33],
      lookAt: [-5, 12, 2],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'dragon-pavilion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'dragonSkyline',
    errorMeters: 1.03,
    surfaces,
    authoredLevels: {
      district: { export: 'dragonDistrict', errorMeters: 0.48, surfaces },
      street: { export: 'dragonStreet', errorMeters: 0.17, surfaces },
      closeup: { export: 'dragonCloseup', errorMeters: 0.067, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from three exact photographer-released public-domain Qualla originals, the operator’s dimensions, attributed OpenStreetMap geometry and Terrarium elevation.',
};
