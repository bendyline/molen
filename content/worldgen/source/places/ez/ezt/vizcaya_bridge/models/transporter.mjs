import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  truss: { slot: 'wall', graph: 'metal_painted', roughness: 0.9, metallic: 0.1 },
  wire: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.83, metallic: 0.17 },
  pier: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  floor: { slot: 'roof', graph: 'wood_vertical', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.81, metallic: 0.09 },
};
const iron = rgb('a45f53'),
  darkIron = rgb('835447'),
  plate = rgb('995c4f'),
  cable = rgb('66564f');
const stone = rgb('9f9583'),
  dock = rgb('8e8779'),
  walkway = rgb('938372'),
  white = rgb('c5c5b9');
const smoke = rgb('4d605f'),
  blue = rgb('576b6c'),
  steel = rgb('979b94');
const angle = (site.planAngleDegrees * Math.PI) / 180,
  c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
const d = site.deck,
  half = d.width / 2;
const up = [0, 1, 0];

function face(out, slot, coords, color, dir) {
  const p = coords.map((q) => world(q).map(Math.fround));
  const normal = dir && world(dir);
  for (let i = 1; i < p.length - 1; i++) {
    const a = [p[0], p[i], p[i + 1]],
      n = normalFor(...a);
    if (Math.hypot(...n) < 0.9) continue;
    if (normal && n.reduce((sum, v, i) => sum + v * normal[i], 0) < 0)
      out.addTriangle(
        slot,
        '',
        [a[0], a[2], a[1]],
        n.map((v) => -v),
        [],
        color,
      );
    else out.addTriangle(slot, '', a, n, [], color);
  }
}

function solid(out, slot, outline, low, high, color) {
  const area = outline.reduce((sum, [x, z], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - z * u;
  }, 0);
  const ring = area < 0 ? outline : outline.toReversed();
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [u, v] = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [
        [x, low, z],
        [u, low, v],
        [u, high, v],
        [x, high, z],
      ],
      color,
    );
  }
  for (const [y, sign] of [
    [low, -1],
    [high, 1],
  ])
    face(
      out,
      slot,
      ring.map(([x, z]) => [x, y, z]),
      color,
      [0, sign, 0],
    );
}
const box = (x, X, z, Z) => [
  [x, z],
  [x, Z],
  [X, Z],
  [X, z],
];
const prism = (out, slot, x, X, z, Z, y, Y, color) =>
  solid(out, slot, box(x, X, z, Z), y, Y, color);
const bar = (out, a, b, w, h = w, color = iron, slot = 'truss') =>
  beam(out, slot, world(a), world(b), w, h, color);

function strut(out, a, b, w, axis, detail, color = iron, slot = 'truss') {
  if (detail >= 2) {
    bar(out, a, b, w, w * 0.9, color, slot);
    return;
  }
  const u = b[0] - a[0],
    v = b[1] - a[1],
    z = b[2] - a[2];
  const len = axis === 'x' ? Math.hypot(u, v) : Math.hypot(z, v);
  const offset = axis === 'x' ? [v / len, -u / len, 0] : [0, -z / len, v / len];
  const p = (a, s) => a.map((v, i) => v + (offset[i] * w * s) / 2);
  const quad = [p(a, -1), p(b, -1), p(b, 1), p(a, 1)];
  face(out, slot, quad, color);
  face(out, slot, quad.toReversed(), color);
}

function tower(out, point, detail) {
  const [x, z] = point.center,
    b = point.base;
  solid(out, 'pier', point.shape, b - 2.9, b + 0.44, stone);
  const span = [point.footSize[0] * 0.363, point.footSize[1] * 0.36];
  const at = (u, dx, dz) => [
    x + dx * (1 - u * 0.42) * span[0],
    b + 0.26 + u * (d.towerHeight - 0.26),
    z * (1 - 0.347 * u) + dz * (1 - u * 0.48) * span[1],
  ];
  const corners = [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ];
  for (const [dx, dz] of corners)
    bar(out, at(0, dx, dz), at(1, dx, dz), detail ? 0.32 : 0.41, 0.34, iron);
  const steps = detail === 0 ? 3 : detail === 1 ? 8 : 13;
  for (let i = 0; i < steps; i++) {
    const low = i / steps,
      high = (i + 1) / steps;
    for (let j = 0; j < corners.length; j++) {
      const a = corners[j],
        p = corners[(j + 1) % 4];
      const axis = a[0] === p[0] ? 'z' : 'x';
      if (detail === 0 && axis === 'z') continue;
      strut(out, at(low, ...a), at(high, ...p), detail >= 2 ? 0.157 : 0.21, axis, detail, plate);
      if (detail)
        strut(out, at(low, ...p), at(high, ...a), detail >= 2 ? 0.151 : 0.205, axis, detail, plate);
      if (detail >= 2 && i % 3 === 0) bar(out, at(low, ...a), at(low, ...p), 0.15, 0.12, darkIron);
    }
  }
  for (const u of detail ? [0.028, 0.331, 0.681, 0.975] : [0.331, 0.681]) {
    const y = at(u, 0, 0)[1],
      zMid = at(u, 0, 0)[2],
      xSpan = span[0] * (1 - u * 0.42),
      zSpan = span[1] * (1 - u * 0.48);
    prism(
      out,
      'truss',
      x - xSpan - 0.13,
      x + xSpan + 0.13,
      zMid - zSpan - 0.13,
      zMid + zSpan + 0.13,
      y,
      y + 0.28,
      iron,
    );
  }
}

function portalLegs(out, towers, detail) {
  const x = towers.reduce((sum, t) => sum + t.center[0] / 2, 0);
  const z0 = Math.min(...towers.map((t) => t.center[1])),
    z1 = Math.max(...towers.map((t) => t.center[1]));
  const h = towers.reduce((sum, t) => sum + t.base / 2, 0) + d.towerHeight - 0.45;
  for (const [y, size] of [
    [d.clearance - 0.47, 0.56],
    [d.clearance + d.height + 0.15, 0.41],
    [h - 0.36, 0.65],
  ]) {
    const factor = 1 - 0.347 * Math.max(0, Math.min(1, (y - towers[0].base) / d.towerHeight));
    prism(out, 'truss', x - size, x + size, z0 * factor, z1 * factor, y, y + size, iron);
  }
  const a = z0 * 0.66,
    b = z1 * 0.66,
    n = detail >= 2 ? 14 : 6;
  for (const front of detail ? [-1, 1] : [0]) {
    const faceX = x + front * 0.88;
    for (let i = 0; i < n; i++) {
      const from = a + ((b - a) * i) / n,
        to = a + ((b - a) * (i + 1)) / n;
      const arch = (z) => h - 3.61 + 2.37 * Math.sqrt(1 - Math.pow((2 * (z - a)) / (b - a) - 1, 2));
      strut(out, [faceX, arch(from), from], [faceX, arch(to), to], 0.17, 'z', detail, darkIron);
      if (detail >= 2) {
        const z = (from + to) / 2;
        bar(out, [faceX, arch(z), z], [faceX, h - 0.38, z], 0.117, 0.13, darkIron);
      }
    }
  }
}

function deck(out, detail) {
  const { start, end, clearance, height } = d,
    y = clearance + 0.19,
    Y = clearance + height;
  prism(out, 'floor', start - 0.98, end + 0.98, -2.71, 2.71, clearance, clearance + 0.24, walkway);
  const n = detail === 0 ? 10 : detail === 1 ? 25 : detail === 2 ? 38 : 47;
  for (const z of [-half, half]) {
    for (const spanY of [y, Y])
      bar(out, [start - 1, spanY, z], [end + 1, spanY, z], 0.24, 0.24, iron);
    for (let i = 0; i < n; i++) {
      const a = start + ((end - start) * i) / n,
        b = start + ((end - start) * (i + 1)) / n;
      strut(out, [a, y, z], [b, Y, z], 0.17, 'x', detail, plate);
      if (detail || i % 2 === 0) strut(out, [a, Y, z], [b, y, z], 0.18, 'x', detail, plate);
      if (detail >= 2) bar(out, [a, y, z], [a, Y, z], 0.16, 0.17, darkIron);
    }
  }
  if (!detail) return;
  for (const z of [-2.47, 2.47]) {
    bar(out, [start, y + 0.92, z], [end, y + 0.92, z], 0.071, 0.072, plate);
    bar(out, [start, y + 1.31, z], [end, y + 1.31, z], 0.082, 0.083, plate);
  }
  for (let i = 0; i <= n; i++) {
    const x = start + ((end - start) * i) / n;
    bar(out, [x, y, -half], [x, y, half], 0.17, 0.21, iron);
    if (detail >= 2) {
      const a = start + (end - start) * Math.min(1, (i + 1) / n);
      if (i < n) bar(out, [x, y, -half], [a, y, half], 0.11, 0.14, darkIron);
      for (const z of [-2.47, 2.47]) bar(out, [x, y, z], [x, y + 1.38, z], 0.063, 0.063, plate);
    }
  }
}

function suspension(out, detail) {
  const { start, end, clearance, height } = d,
    n = detail === 0 ? 5 : detail === 1 ? 18 : 35;
  const h = clearance + height;
  const y = (t) => h + 0.79 + 14.65 * Math.pow(2 * t - 1, 2);
  for (const sign of [-1, 1]) {
    const z = (half + 0.16) * sign - 0.26;
    const t0 = [start, y(0), z],
      t1 = [end, y(1), z];
    for (let i = 0; i < n; i++) {
      const a = i / n,
        b = (i + 1) / n,
        x = start + (end - start) * a,
        X = start + (end - start) * b;
      strut(out, [x, y(a), z], [X, y(b), z], detail ? 0.13 : 0.22, 'x', detail, cable, 'wire');
      if (detail >= 2)
        strut(
          out,
          [x, y(a) - 0.26, z + 0.36 * sign],
          [X, y(b) - 0.26, z + 0.36 * sign],
          0.094,
          'x',
          detail,
          cable,
          'wire',
        );
      if (i > 0)
        strut(out, [x, h, z], [x, y(a), z], detail >= 2 ? 0.041 : 0.09, 'x', detail, cable, 'wire');
    }
    for (const a of site.cableAnchors) {
      const t = a.side < 0 ? t0 : t1;
      const low = [a.x, a.y, (sign * a.w) / 2];
      bar(out, t, low, detail ? 0.155 : 0.2, 0.125, cable, 'wire');
      if (detail) {
        bar(
          out,
          [t[0], t[1] - 0.46, t[2] + sign * 0.44],
          [low[0], low[1], low[2] + sign * 0.62],
          0.083,
          0.084,
          cable,
          'wire',
        );
        prism(
          out,
          'pier',
          low[0] - 1.3,
          low[0] + 1.3,
          low[2] - 0.62,
          low[2] + 0.62,
          low[1] - 1.34,
          low[1] + 0.04,
          stone,
        );
        const floor = a.side < 0 ? (sign < 0 ? 2.86 : 4.47) : sign < 0 ? 8.51 : 6.47;
        bar(out, [t[0], t[1] - 13.8, t[2]], [t[0], floor, sign * 60], 0.094, 0.093, cable, 'wire');
      }
    }
  }
}

function gondola(out, detail) {
  const g = site.gondola,
    x = g.station,
    L = g.length / 2,
    w = g.width / 2,
    y = g.deck;
  prism(out, 'truss', x - L - 0.22, x + L + 0.22, -w, w, y - 0.33, y, blue);
  prism(out, 'floor', x - L, x + L, -w, w, y, y + 0.11, walkway);
  for (const side of [-1, 1]) {
    const z0 = side < 0 ? -w : -w + g.width - 1.33,
      z1 = z0 + 1.33;
    const glassZ = side < 0 ? z0 - 0.018 : z1 + 0.018;
    prism(out, 'truss', x - L + 0.05, x + L - 0.05, z0, z1, y + 0.13, y + 2.62, white);
    const panel = (a, b, c, d) =>
      face(
        out,
        'glass',
        [
          [a, c, glassZ],
          [b, c, glassZ],
          [b, d, glassZ],
          [a, d, glassZ],
        ],
        smoke,
        [0, 0, side],
      );
    panel(x - L + 0.44, x + L - 0.45, y + 1.05, y + 2.27);
    if (detail >= 2) {
      for (let i = 0; i < 10; i++) {
        const p = x - L + 0.44 + ((2 * L - 0.89) * i) / 9;
        bar(
          out,
          [p, y + 1.04, glassZ + side * 0.028],
          [p, y + 2.27, glassZ + side * 0.028],
          0.051,
          0.095,
          white,
        );
      }
    }
  }
  prism(out, 'truss', x - 4.85, x + 4.85, -2.55, 2.55, 44.04, 45.13, darkIron);
  for (const z of [-w + 0.5, w - 0.5]) {
    for (const dx of detail ? [L - 0.7, 2.3] : [L - 0.7]) {
      for (const sign of [-1, 1]) {
        const a = [x + sign * dx, y + 2.58, z],
          b = [x + sign * (dx * 0.49), 44.35, z * 0.73];
        strut(out, a, b, detail ? 0.053 : 0.116, 'x', detail, cable, 'wire');
      }
    }
  }
  if (!detail) return;
  for (const sign of [-1, 1]) {
    const u = x + sign * (L - 0.09);
    bar(out, [u, y + 0.93, -2.52], [u, y + 0.93, 2.52], 0.068, 0.072, steel, 'wire');
    for (let j = 0; j <= 10; j++) {
      const z = -2.52 + (5.04 * j) / 10;
      bar(out, [u, y + 0.12, z], [u, y + 0.93, z], 0.045, 0.048, white, 'wire');
    }
  }
}

function transporter(out, detail) {
  for (const p of site.towers) tower(out, p, detail);
  portalLegs(out, site.towers.slice(0, 2), detail);
  portalLegs(out, site.towers.slice(2), detail);
  deck(out, detail);
  suspension(out, detail);
  gondola(out, detail);
  for (const [x, top] of [
    [d.start, 3.59],
    [d.end, 3.29],
  ]) {
    prism(out, 'pier', x - 3.56, x + 3.56, -3.83, 3.83, top - 0.79, top, dock);
  }
}

export const buildSkyline = (out) => transporter(out, 0);
export const buildDistrict = (out) => transporter(out, 1);
export const buildStreet = (out) => transporter(out, 2);
export const buildCloseup = (out) => transporter(out, 3);
export const buildMaster = buildCloseup;
