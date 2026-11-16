/** Hansaray in local east/south meters. Roof lines and ornament follow the visible palace. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  roofMetal: { slot: 'roof', graph: 'metal_copper' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47 },
  metal: { slot: 'trim', graph: 'metal_stainless', metallic: 0.67, roughness: 0.5 },
};
const pale = [0.86, 0.803, 0.69],
  chalk = [0.91, 0.874, 0.79],
  ochre = [0.655, 0.487, 0.28],
  ash = [0.64, 0.58, 0.45];
const red = [0.355, 0.105, 0.063],
  clay = [0.46, 0.208, 0.132],
  amber = [0.68, 0.385, 0.18],
  walnut = [0.208, 0.105, 0.072];
const green = [0.137, 0.27, 0.2],
  jade = [0.236, 0.367, 0.27],
  indigo = [0.162, 0.255, 0.362],
  gold = [0.713, 0.486, 0.178];
const milk = [0.805, 0.78, 0.71],
  glass = [0.129, 0.185, 0.207],
  charcoal = [0.195, 0.181, 0.161],
  watered = [0.172, 0.365, 0.39];

function face(out, slot, points, direction, color) {
  if (normalFor(...points).reduce((sum, n, i) => sum + n * direction[i], 0) < 0)
    points = [...points].reverse();
  if (points.length === 3) out.addTriangle(slot, '', points, normalFor(...points), [], color);
  else out.addQuad(slot, '', points, normalFor(...points), [], color);
}
const block = (o, k, x, y, z, w, h, d, color) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color);
const solid = (o, k, outline, holes, y0, y1, color) =>
  prism((slot, p, n) => face(o, slot, p, n, color), k, { outline, holes }, y0, y1, false);
const rect = (w, d) => [
  [-w / 2, d / 2],
  [w / 2, d / 2],
  [w / 2, -d / 2],
  [-w / 2, -d / 2],
];
function front(out, x, y, z, a = 0) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const n = ([u, v, w]) => [c * u - s * w, v, s * u + c * w];
  const p = (v) => n(v).map((value, i) => value + [x, y, z][i]);
  return {
    addTriangle: (k, r, v, m, u, t) => out.addTriangle(k, r, v.map(p), n(m), u, t),
    addQuad: (k, r, v, m, u, t) => out.addQuad(k, r, v.map(p), n(m), u, t),
    addConvexPolygon: (k, r, v, m, u, t) => out.addConvexPolygon(k, r, v.map(p), n(m), u, t),
  };
}
function panel(o, slot, x, y, z, w, h, color) {
  face(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    color,
  );
}
function wallFrame(o, b, a, c) {
  return front(
    o,
    (a[0] + c[0]) / 2,
    b.floor,
    (a[1] + c[1]) / 2,
    Math.atan2(c[1] - a[1], c[0] - a[0]) + Math.PI,
  );
}
function profile(o, slot, x, z, rings, sides, color) {
  loft(
    o,
    slot,
    rings.map(([y, r]) => radialRing(y, r, r, sides, [x, z], Math.PI / 8)),
    color,
  );
}
function hip(o, w, d, y, rise, level, color = clay) {
  const proportion = Math.max(0.14, 1 - d / (w * 1.23));
  loft(
    o,
    'tile',
    [
      rect(w, d).map(([x, z]) => [x, y, z]),
      rect(w * proportion, 0.112).map(([x, z]) => [x, y + rise, z]),
    ],
    color,
  );
  if (level === 0) return;
  block(o, 'timber', 0, y - 0.165, d / 2 - 0.04, w, 0.16, 0.14, red);
  block(o, 'timber', 0, y - 0.166, -d / 2 + 0.04, w, 0.16, 0.14, red);
  block(o, 'tile', 0, y + rise - 0.045, 0, w * proportion + 0.23, 0.14, 0.18, clay);
  if (level < 2) return;
  for (const side of [-1, 1]) {
    const interval = level === 2 ? 0.88 : 0.49,
      count = Math.max(2, Math.floor(w / interval));
    for (let i = 0; i < count; i++) {
      const x = w * ((i + 0.5) / count - 0.5);
      block(o, 'timber', x, y - 0.26, side * (d / 2 - 0.15), 0.11, 0.19, 0.27, walnut);
      if (level === 4) {
        const tip = [x * proportion, y + rise + 0.025, side * 0.043];
        beam(
          o,
          'tile',
          [x, y + 0.033, (side * d) / 2],
          tip,
          0.056,
          0.054,
          i % 4 === 0 ? amber : clay,
        );
      }
    }
  }
}
function taperedHip(o, b, rise, level) {
  const {
    outline,
    center: [x, z],
    floor,
    height,
  } = b;
  const y = floor + height,
    area = outline.reduce(
      (sum, p, i) =>
        sum +
        p[0] * outline[(i + 1) % outline.length][1] -
        p[1] * outline[(i + 1) % outline.length][0],
      0,
    );
  const facing = area > 0 ? [...outline].reverse() : outline;
  const ring = level === 0 && facing.length > 12 ? facing.filter((_, i) => i % 2 === 0) : facing;
  const c = Math.cos(b.angle),
    s = Math.sin(b.angle);
  const ridge = ring.map(([u, v]) => {
    const a = c * (u - x) + s * (v - z),
      d = -s * (u - x) + c * (v - z);
    return [x + c * a * 0.58 - s * d * 0.19, y + rise, z + s * a * 0.58 + c * d * 0.19];
  });
  const lower = ring.map(([u, v]) => [x + (u - x) * 1.055, y, z + (v - z) * 1.055]);
  loft(o, 'tile', [lower, ridge], clay, { cap: false });
  if (level === 0) {
    const outline = ridge.map(([u, , v]) => [u, v]);
    prism(
      (slot, p, n) => {
        if (n[1] > 0) face(o, slot, p, n, clay);
      },
      'tile',
      { outline },
      y + rise - 0.01,
      y + rise,
      false,
    );
  } else
    solid(
      o,
      'tile',
      ridge.map(([u, , v]) => [u, v]),
      [],
      y + rise - 0.009,
      y + rise,
      clay,
    );
  if (level < 2) return;
  for (const [i, a] of ring.entries()) {
    const c = ring[(i + 1) % ring.length];
    beam(
      o,
      'timber',
      [x + (a[0] - x) * 1.017, y - 0.13, z + (a[1] - z) * 1.017],
      [x + (c[0] - x) * 1.017, y - 0.13, z + (c[1] - z) * 1.017],
      0.18,
      0.16,
      red,
    );
  }
}
function diamond(o, slot, x, y, z, w, h, color) {
  face(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x, y - h / 2, z],
      [x + w / 2, y, z],
      [x, y + h / 2, z],
    ],
    [0, 0, 1],
    color,
  );
}
function rosette(o, x, y, z, r, level, color = gold) {
  const n = level < 2 ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    const q = (k, r) => [x + Math.cos(k) * r, y + Math.sin(k) * r, z];
    face(
      o,
      'plaster',
      [q(a, r * 0.67), q(a, r), q(b, r), q(b, r * 0.67)],
      [0, 0, 1],
      i % 2 ? amber : color,
    );
  }
  diamond(o, 'plaster', x, y, z + 0.001, r * 0.77, r * 0.77, indigo);
  if (level >= 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      diamond(
        o,
        'plaster',
        x + Math.cos(a) * r * 0.52,
        y + Math.sin(a) * r * 0.52,
        z + 0.003,
        r * 0.23,
        r * 0.21,
        jade,
      );
    }
    diamond(o, 'plaster', x, y, z + 0.004, r * 0.31, r * 0.31, pale);
  }
}
function lattice(o, x, y, z, w, h, level, ornate = false, frameColor = red) {
  panel(o, 'timber', x, y, z, w + 0.14, h + 0.16, frameColor);
  panel(o, 'glass', x, y + 0.074, z + 0.012, w, h, glass);
  if (level >= 1) {
    if (level >= 2)
      for (const k of [-1, 1])
        panel(o, 'timber', x + k * w * 0.51, y + 0.013, z + 0.021, 0.044, h + 0.039, ochre);
    panel(o, 'timber', x, y + h * 0.48, z + 0.025, w, 0.049, frameColor);
    if (level >= 2) panel(o, 'timber', x, y + h * 0.57, z + 0.026, w, 0.041, ochre);
  }
  if (level >= 2) {
    for (const k of [-0.255, 0, 0.255])
      panel(o, 'timber', x + k * w, y + 0.08, z + 0.025, 0.033, h * 0.98, frameColor);
    for (const k of [0.245, 0.79]) panel(o, 'timber', x, y + h * k, z + 0.028, w, 0.029, ochre);
    if (ornate) {
      diamond(o, 'plaster', x, y - 0.31, z - 0.001, w * 0.59, 0.32, iColor(x));
      if (level >= 3) rosette(o, x, y + h + 0.26, z - 0.001, 0.17, level);
    }
  }
}
const iColor = (x) => (Math.round(Math.abs(x)) % 2 ? indigo : ochre);

function archPoints(w, spring, rise, steps, pointed) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps - 0.5) * 2;
    const u = Math.abs(t);
    const k = pointed
      ? Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.32 * u)
      : Math.sqrt(Math.max(0, 1 - t * t));
    return [(t * w) / 2, spring + rise * (i === 0 || i === steps ? 0 : k)];
  });
}
function archWall(
  o,
  x,
  half,
  w,
  spring,
  rise,
  top,
  z0,
  z1,
  bottom,
  level,
  pointed = false,
  color = pale,
) {
  const a = archPoints(w, spring, rise, level === 0 ? 4 : level === 1 ? 6 : 12, pointed);
  const depth = z1 - z0,
    z = (z0 + z1) / 2;
  for (const side of [-1, 1]) {
    block(
      o,
      'stone',
      x + (side * (half + w / 2)) / 2,
      bottom,
      z,
      half - w / 2,
      top - bottom,
      depth,
      color,
    );
  }
  for (let i = 1; i < a.length; i++) {
    const [u, h] = a[i - 1],
      [v, k] = a[i],
      topFront = [
        [x + u, h, z1],
        [x + v, k, z1],
        [x + v, top, z1],
        [x + u, top, z1],
      ];
    face(o, 'plaster', topFront, [0, 0, 1], color);
    face(
      o,
      'plaster',
      topFront.map(([a, b]) => [a, b, z0]),
      [0, 0, -1],
      color,
    );
    face(
      o,
      'stone',
      [
        [x + u, h, z0],
        [x + v, k, z0],
        [x + v, k, z1],
        [x + u, h, z1],
      ],
      [0, -1, 0],
      ash,
    );
    if (level >= 2) {
      const band = (u, h) => [
        x + u * 1.036,
        h + 0.145 * Math.max(0.25, (h - spring) / rise),
        z1 + 0.018,
      ];
      face(
        o,
        'stone',
        [[x + u, h, z1 + 0.018], [x + v, k, z1 + 0.018], band(v, k), band(u, h)],
        [0, 0, 1],
        i % 3 === 0 ? ash : milk,
      );
    }
  }
  face(
    o,
    'stone',
    [
      [x - w / 2, top, z0],
      [x + w / 2, top, z0],
      [x + w / 2, top, z1],
      [x - w / 2, top, z1],
    ],
    [0, 1, 0],
    pale,
  );
}
function gate(out, b, level) {
  const {
    width: w,
    depth: d,
    height: h,
    center: [x, z],
    floor,
    angle,
  } = b;
  const o = front(out, x, floor, z, angle + Math.PI);
  const opening = 4.32,
    offset = -0.33;
  archWall(
    o,
    offset,
    w / 2 - 0.39,
    opening,
    2.43,
    1.42,
    4.57,
    -d / 2,
    d / 2,
    b.bottom - floor,
    level,
    true,
  );
  block(o, 'stone', 0, b.bottom - floor, 0, w - 0.87, 0.81, d, ash);
  block(o, 'plaster', 0, 4.56, 0, w - 0.48, h - 4.56, d - 0.1, chalk);
  hip(front(o, 0, 0, 0), w + 0.91, d + 1.13, h, 1.52, level);
  if (level === 0) return;
  const zf = d / 2 - 0.035;
  // Match the darker decorated face and the three pointed windows in the gate photograph.
  panel(o, 'plaster', 0, 4.66, zf, w - 0.6, 3.66, ochre);
  panel(o, 'plaster', 0, 4.78, zf + 0.012, w - 0.89, 3.42, pale);
  for (const k of [-1, 0, 1]) {
    const u = k * 1.03;
    lattice(o, u, 4.98, zf + 0.033, 0.86, 2.26, level, false, red);
    const p = archPoints(0.95, 7.22, k === 0 ? 0.71 : 0.56, level === 1 ? 5 : 9, true);
    for (let i = 1; i < p.length; i++)
      face(
        o,
        'glass',
        [
          [u + p[i - 1][0], 7.19, zf + 0.047],
          [u + p[i][0], 7.19, zf + 0.047],
          [u + p[i][0], p[i][1], zf + 0.047],
          [u + p[i - 1][0], p[i - 1][1], zf + 0.047],
        ],
        [0, 0, 1],
        glass,
      );
  }
  for (const k of [-1, 1]) {
    rosette(o, k * 3.05, 6.44, zf + 0.039, 0.85, level);
    if (level >= 2)
      for (let i = 0; i < 4; i++) {
        diamond(
          o,
          'plaster',
          k * (2.18 + i * 0.52),
          7.74,
          zf + 0.043,
          0.36,
          0.52,
          i % 2 === 0 ? amber : indigo,
        );
        diamond(
          o,
          'plaster',
          k * (2.18 + i * 0.52),
          5.06,
          zf + 0.046,
          0.38,
          0.32,
          i % 2 === 0 ? ochre : jade,
        );
      }
  }
  block(o, 'timber', 0, 8.29, zf + 0.113, w - 0.48, 0.29, 0.32, red);
}

function ordinaryWalls(out, b, level) {
  const { outline, holes, bottom, floor, height, kind } = b;
  const north = kind === 'north',
    main = ['main', 'apartments', 'arbor', 'harem'].includes(kind);
  if (level >= 2) solid(out, 'stone', outline, holes, bottom, floor + 0.24, north ? chalk : ash);
  solid(
    out,
    'plaster',
    outline,
    holes,
    level >= 2 ? floor + 0.239 : bottom,
    floor + height,
    north ? pale : chalk,
  );
  taperedHip(out, b, north ? 1.42 : main ? 2.47 : 1.68, level);
  if (level === 0) return;
  for (const [i, a] of outline.entries()) {
    const c = outline[(i + 1) % outline.length],
      w = Math.hypot(c[0] - a[0], c[1] - a[1]);
    if (w < 3.1) continue;
    const o = wallFrame(out, b, a, c),
      stories = level > 1 && (kind === 'main' || kind === 'apartments' || kind === 'arbor') ? 2 : 1;
    if (level === 1 && ((!main && !north) || w < 6)) continue;
    if (level === 2 && w < 6.7) continue;
    const n = Math.max(
      1,
      Math.min(9, Math.round(w / (level === 1 ? 6.7 : level === 2 ? 5.5 : 3.0))),
    );
    const aperture = Math.min((w / n) * 0.57, 1.14);
    for (let j = 0; j < n; j++) {
      const x = w * ((j + 0.5) / n - 0.5);
      for (let k = 0; k < stories; k++) {
        const y = k === 0 ? (north ? height * 0.4 : 1.15) : height * 0.59;
        const ornament = north || main;
        const frame = north ? red : green;
        lattice(o, x, y, 0.021, aperture, Math.min(height * 0.27, 1.76), level, ornament, frame);
        if (ornament && level >= 3) {
          const above = y + Math.min(height * 0.27, 1.76) + 0.36;
          diamond(o, 'plaster', x, above, 0.018, aperture * 0.46, 0.26, amber);
          diamond(o, 'plaster', x + aperture * 0.71, y + 0.58, 0.018, 0.22, 0.42, jade);
        }
      }
    }
  }
}
function balcony(o, b, level) {
  const side = b.kind === 'arbor' ? -1 : 1;
  const court = b.kind === 'north';
  const faceEdge = b.outline.reduce((best, p, i) => {
    const q = b.outline[(i + 1) % b.outline.length],
      len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const normal = (court ? p[0] - q[0] : side * (q[1] - p[1])) / Math.max(0.01, len);
    return len > 5.0 && normal > 0.5 && (!best || len > best.len) ? { p, q, len } : best;
  }, null);
  if (!faceEdge) return;
  const { p, q, len } = faceEdge,
    w = len * 0.89,
    local = wallFrame(o, b, p, q);
  const deck = b.kind === 'arbor' ? 2.75 : court ? 2.29 : 3.21,
    d = 1.73,
    y = b.height - 0.21;
  block(local, 'timber', 0, deck, 0.83, w, 0.24, 1.78, red);
  const roof = front(local, 0, 0, 0.62);
  hip(roof, w + 0.65, 2.43, y, 0.86, level);
  if (level === 0) {
    block(local, 'timber', 0, deck + 0.25, 1.71, w, 0.43, 0.062, green);
    return;
  }
  const n = Math.max(3, Math.round(w / 2.2));
  block(local, 'timber', 0, deck + 0.39, d, w, 0.08, 0.085, green);
  block(local, 'timber', 0, deck + 1.11, d, w, 0.085, 0.115, green);
  for (let i = 0; i <= n; i++) {
    const x = (i / n - 0.5) * w;
    block(local, 'timber', x, deck + 0.11, d, 0.128, y - deck - 0.04, 0.162, green);
    if (level < 2) continue;
    for (const k of [-1, 1]) {
      if ((k === -1 && i === 0) || (k === 1 && i === n)) continue;
      beam(local, 'timber', [x, y - 0.64, d], [x + k * 0.31, y - 0.021, d], 0.073, 0.07, amber);
    }
    if (i < n)
      for (let j = 1; j < 5; j++)
        block(local, 'timber', x + (j * w) / (n * 5), deck + 0.42, d, 0.037, 0.71, 0.049, jade);
  }
}

function mosque(out, b, level) {
  const { outline, holes, bottom, floor, height } = b;
  solid(out, 'stone', outline, holes, bottom, floor + 0.35, ash);
  solid(out, 'plaster', outline, holes, floor + 0.349, floor + height, chalk);
  taperedHip(out, b, 3.24, level);
  // The west court façade is a shallow roofed arcade in front of a recessed window wall.
  const o = front(out, 30.24, floor, -29.19, Math.PI / 2),
    w = 27.1;
  block(o, 'stone', 0, -0.22, 1.75, w + 0.34, 0.38, 3.86, ash);
  const count = level === 0 ? 2 : level === 1 ? 3 : 5,
    span = w / count;
  for (let i = 0; i < count; i++) {
    const x = (i + 0.5 - count / 2) * span;
    archWall(o, x, span / 2, span * 0.8, 2.15, 1.08, 3.72, 3.18, 3.81, 0.159, level, false, pale);
    if (level > 0) {
      lattice(o, x, 1.08, -0.17, Math.min(1.28, span * 0.57), 1.72, level, false, green);
      lattice(o, x, 5.3, 0.035, 0.91, 1.49, level, true, green);
      if (level >= 2) {
        for (const side of [-1, 1])
          diamond(o, 'plaster', x + side * 1.01, 6.04, 0.042, 0.68, 0.73, jade);
      }
    }
  }
  hip(front(o, 0, 0, 2.06), w + 0.58, 4.15, 3.72, 0.99, level);
  if (level >= 2) {
    const u = 10.5,
      landing = front(o, u, 0, 3.4);
    for (let i = 0; i < 12; i++)
      block(landing, 'stone', 1.85 - i * 0.31, 0.15 + i * 0.175, 0.84, 1.47, 0.18, 1.33, milk);
    block(landing, 'stone', -2.6, 2.06, 0.62, 1.6, 0.2, 1.95, pale);
    for (const side of [-1, 1]) {
      beam(
        landing,
        'timber',
        [2.53, 1.18, 0.84 + side * 0.66],
        [-2.14, 3.14, 0.84 + side * 0.66],
        0.095,
        0.082,
        red,
      );
      for (let i = 0; i < 6; i++)
        block(
          landing,
          'timber',
          2.38 - i * 0.79,
          0.1 + i * 0.32,
          0.84 + side * 0.65,
          0.061,
          1.15,
          0.071,
          green,
        );
    }
    for (const u of [-3.16, -1.94])
      block(landing, 'timber', u, 2.24, 1.58, 0.115, 1.47, 0.138, green);
  }
  for (const [i, t] of layout.minarets.entries()) minaret(out, t, level, i);
}
function minaret(out, { center: [x, z], floor: y }, level, i) {
  const h = i === 0 ? 24.2 : 24.95,
    sides = [5, 6, 10, 14, 20][level];
  const shaft =
    level === 0
      ? [
          [0, 1],
          [0.62, 0.68],
          [h * 0.66, 0.61],
          [h * 0.705, 1.02],
          [h * 0.75, 0.61],
          [h * 0.88, 0.57],
        ]
      : [
          [0, 1.22],
          [0.29, 1.22],
          [0.57, 0.82],
          [h * 0.65, 0.61],
          [h * 0.676, 0.7],
          [h * 0.688, 0.91],
          [h * 0.726, 1.02],
          [h * 0.75, 0.98],
          [h * 0.751, 0.61],
          [h * 0.88, 0.57],
        ];
  profile(
    out,
    'stone',
    x,
    z,
    shaft.map(([u, r]) => [u + y, r]),
    sides,
    milk,
  );
  profile(
    out,
    'roofMetal',
    x,
    z,
    [
      [y + h * 0.876, 0.65],
      [y + h * 0.985, 0.096],
      [y + h, 0.036],
    ],
    sides,
    walnut,
  );
  if (level === 0) return;
  profile(
    out,
    'metal',
    x,
    z,
    [
      [y + h - 0.03, 0.072],
      [y + h + 0.47, 0.046],
      [y + h + 0.54, 0.016],
    ],
    6,
    gold,
  );
  if (level < 2) return;
  for (let j = 0; j < sides; j++) {
    const a = ((j + 0.5) * 2 * Math.PI) / sides;
    const o = front(out, x + Math.sin(a) * 0.921, y, z + Math.cos(a) * 0.921, -a);
    diamond(o, 'stone', 0, h * 0.724, 0.03, 0.22, 0.23, ash);
  }
  if (level >= 3) {
    const a = y + h + 0.49,
      r = 0.185;
    const arc = Array.from({ length: 9 }, (_, j) => {
      const t = 0.64 + (j * 4.99) / 8;
      return [x + Math.sin(t) * r, a + Math.cos(t) * r, z + 0.008];
    });
    for (let j = 1; j < arc.length; j++) beam(out, 'metal', arc[j - 1], arc[j], 0.028, 0.03, gold);
  }
}
function falcon(out, b, level) {
  const {
      center: [x, z],
      bottom,
      floor,
      width,
      height,
    } = b,
    n = level === 0 ? 6 : 12,
    r = width * 0.46;
  profile(
    out,
    'plaster',
    x,
    z,
    [
      [bottom, r],
      [floor + 0.48, r],
      [floor + height * 0.68, r * 0.89],
    ],
    n,
    chalk,
  );
  const y = floor + height * 0.67;
  profile(
    out,
    'timber',
    x,
    z,
    [
      [y, r * 0.925],
      [y + 0.43, r * 0.925],
      [y + height * 0.294, r * 0.865],
    ],
    8,
    walnut,
  );
  profile(
    out,
    'tile',
    x,
    z,
    [
      [floor + height - 0.13, r * 0.99],
      [floor + height + 2.7, r * 0.18],
      [floor + height + 3.18, r * 0.057],
    ],
    8,
    clay,
  );
  if (level === 0) return;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    const o = front(out, x + Math.sin(a) * r * 0.821, y, z + Math.cos(a) * r * 0.821, -a);
    lattice(o, 0, 0.74, 0.024, r * 0.54, height * 0.193, level, false, jade);
    if (level >= 2) {
      for (const k of [-1, 1])
        block(o, 'timber', k * r * 0.273, 0.48, 0.078, 0.086, height * 0.224, 0.096, red);
    }
  }
}
function tomb(out, t, level) {
  const {
      center: [x, z],
      radius: r,
      height: h,
      floor: y,
      kind,
    } = t,
    n = level === 0 ? 6 : 8;
  if (kind === 'arcaded' && level > 0) {
    for (let j = 0; j < n; j++) {
      const a = (j * Math.PI) / 4,
        k = r * 0.87;
      block(
        out,
        'stone',
        x + k * Math.sin(a),
        y - 0.451,
        z + k * Math.cos(a),
        0.225,
        h * 0.9,
        0.225,
        ash,
      );
    }
    profile(
      out,
      'stone',
      x,
      z,
      [
        [y + h * 0.72, r * 0.94],
        [y + h * 0.84, r * 0.98],
        [y + h, r * 0.9],
      ],
      n,
      ash,
    );
  } else
    profile(
      out,
      'stone',
      x,
      z,
      [
        [y - 0.49, r * 1.035],
        [y + 0.32, r * 1.035],
        [y + 0.36, r],
        [y + h, r],
      ],
      n,
      milk,
    );
  const count = level === 0 ? 2 : level <= 2 ? 5 : 9;
  const roof = Array.from({ length: count + 1 }, (_, j) => {
    const a = (j / count) * Math.PI * 0.485;
    return [y + h + Math.sin(a) * r * 0.67, Math.cos(a) * r];
  });
  profile(out, 'roofMetal', x, z, roof, n, charcoal);
  if (kind === 'arcaded' || level === 0) return;
  for (const k of [0, 2, 4, 6]) {
    const a = (k * Math.PI) / 4;
    const f = front(out, x + Math.sin(a) * r * 0.925, y, z + Math.cos(a) * r * 0.925, -a);
    lattice(f, 0, h * 0.26, 0.076, 0.91, 1.1, level, false, walnut);
    if (level >= 2) {
      block(f, 'stone', 0, h * 0.23, 0.175, 1.12, 0.12, 0.25, ochre);
    }
  }
}
function courtDetails(out, level) {
  const { courtyard } = layout;
  for (const [strips, color] of [
    [courtyard.approach, milk],
    [courtyard.pavedCourt, ash],
  ]) {
    if (level === 0 && strips === courtyard.pavedCourt) continue;
    for (let i = 1; i < strips.length; i++) {
      const [a, b] = strips[i - 1],
        [c, d] = strips[i];
      face(out, 'stone', [a, b, d], [0, 1, 0], color);
      face(out, 'stone', [a, d, c], [0, 1, 0], color);
    }
  }
  if (level < 1) return;
  const f = courtyard.fountain,
    [x, z] = f.point;
  const o = front(out, x, f.floor, z, -Math.PI / 2);
  block(o, 'stone', 0, -0.45, 0, 1.36, 0.54, 0.81, ash);
  block(o, 'stone', 0, 0.06, 0, 0.93, 1.73, 0.31, milk);
  block(o, 'stone', 0, 1.74, 0, 1.03, 0.14, 0.38, milk);
  for (let j = 0; j < 5; j++) {
    const y = 0.37 + j * 0.22,
      shift = j === 0 || j === 4 ? 0 : j % 2 === 0 ? 0.19 : -0.19;
    block(o, 'stone', shift, y, 0.239, j === 0 ? 0.63 : 0.3, 0.09, 0.33, ochre);
    if (level >= 2)
      panel(o, 'glass', shift, y + 0.091, 0.274, j === 0 ? 0.57 : 0.25, 0.055, watered);
  }
  if (level >= 2) {
    const side = 0.375;
    for (const k of [-1, 1]) block(o, 'stone', k * side, 0.153, 0.197, 0.042, 1.54, 0.06, pale);
    rosette(o, 0, 1.56, 0.193, 0.19, level, ochre);
  }
  if (level < 2) return;
  const [poolX, poolZ] = courtyard.pool;
  const pool = front(out, poolX, 0.89, poolZ);
  profile(
    pool,
    'stone',
    0,
    0,
    [
      [-0.39, 2.67],
      [0.14, 2.67],
      [0.19, 2.55],
    ],
    level >= 3 ? 24 : 12,
    pale,
  );
  profile(
    pool,
    'glass',
    0,
    0,
    [
      [0.193, 2.28],
      [0.2, 2.28],
    ],
    level >= 3 ? 24 : 12,
    watered,
  );
  profile(
    pool,
    'stone',
    0,
    0,
    [
      [0.2, 0.43],
      [0.42, 0.31],
      [0.52, 0.232],
    ],
    8,
    milk,
  );
  // Low markers in the Khan Cemetery, oriented along terrain-fitted local paths.
  for (const mark of level >= 3 ? layout.courtyard.graves : []) {
    const {
      center: [x, z],
      floor: y,
      height: h,
    } = mark;
    const f = front(out, x, y, z, 0.08);
    block(f, 'stone', 0, -0.28, 0, 0.61, 0.44, 1.44, ash);
    block(f, 'stone', 0, 0.14, -0.63, 0.31, h, 0.18, milk);
    block(f, 'stone', 0, 0.12, 0.61, 0.27, h * 0.68, 0.15, ochre);
  }
}
function build(out, level) {
  for (const b of layout.buildings) {
    if (
      level === 0 &&
      (b.kind === 'garden' ||
        b.kind === 'side' ||
        b.kind === 'arbor' ||
        b.kind === 'harem' ||
        (b.kind === 'north' && b.featureId !== 52776561231872 && b.featureId !== 52776561231877))
    )
      continue;
    if (b.kind === 'gate') gate(out, b, level);
    else if (b.kind === 'mosque') mosque(out, b, level);
    else if (b.kind === 'falcon') falcon(out, b, level);
    else {
      ordinaryWalls(out, b, level);
      if (
        b.kind === 'arbor' ||
        b.kind === 'harem' ||
        b.kind === 'main' ||
        (level >= 3 && b.featureId === 52776561231872)
      )
        balcony(out, b, level);
    }
  }
  for (const b of layout.tombs)
    if (level > 0 || b.name === 'Devlet I Giray' || b.name === 'İslâm III Giray')
      tomb(out, b, level);
  courtDetails(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
