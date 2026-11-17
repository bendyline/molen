/** Almería's three enclosures and the Jayrán wall, in local east/south meters. */
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
  ashlar: { slot: 'wall', graph: 'stone_ashlar' },
  lime: { slot: 'wall', graph: 'plaster_lime' },
  rubble: { slot: 'foundation', graph: 'stone_sandstone_raw' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  foliage: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.98 },
  wood: { slot: 'trim', graph: 'wood_plain' },
};
const sand = [0.61, 0.447, 0.294],
  beige = [0.69, 0.56, 0.4],
  earth = [0.55, 0.377, 0.25],
  clay = [0.52, 0.294, 0.17];
const chalk = [0.77, 0.698, 0.52],
  black = [0.115, 0.101, 0.079],
  brick = [0.36, 0.189, 0.12];

function face(out, slot, points, direction, color) {
  if (normalFor(...points).reduce((sum, n, i) => sum + n * direction[i], 0) < 0)
    points = [...points].reverse();
  if (points.length === 3) out.addTriangle(slot, '', points, normalFor(...points), [], color);
  else out.addQuad(slot, '', points, normalFor(...points), [], color);
}
const block = (o, k, x, y, z, w, h, d, c) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c);
const solid = (o, k, outline, holes, y0, y1, c) =>
  prism((slot, p, n) => face(o, slot, p, n, c), k, { outline, holes }, y0, y1, false);
function front(o, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const n = ([u, v, w]) => [c * u - s * w, v, s * u + c * w],
    p = (v) => n(v).map((t, i) => t + [x, y, z][i]);
  return {
    addTriangle: (k, r, v, m, u, t) => o.addTriangle(k, r, v.map(p), n(m), u, t),
    addQuad: (k, r, v, m, u, t) => o.addQuad(k, r, v.map(p), n(m), u, t),
    addConvexPolygon: (k, r, v, m, u, t) => o.addConvexPolygon(k, r, v.map(p), n(m), u, t),
  };
}
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function strip(out, slot, a, b, topA, topB, width, color) {
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]),
    nx = -(b[2] - a[2]) / len,
    nz = (b[0] - a[0]) / len;
  const p = (v, y, d) => [v[0] + width * 0.5 * d * nx, y, v[2] + width * 0.5 * d * nz];
  const loA = a[1] - 1.24,
    loB = b[1] - 1.24;
  const frontP = [p(a, loA, 1), p(b, loB, 1), p(b, topB, 1), p(a, topA, 1)];
  const rearP = [p(a, loA, -1), p(b, loB, -1), p(b, topB, -1), p(a, topA, -1)];
  face(out, slot, frontP, [nx, 0, nz], color);
  face(out, slot, rearP, [-nx, 0, -nz], color);
  face(out, slot, [frontP[3], frontP[2], rearP[2], rearP[3]], [0, 1, 0], beige);
  return { len, nx, nz };
}
function merlon(o, x, y, z, w, d, h, level, pointed, slot, color) {
  if (level <= 1) {
    block(o, slot, x, y, z, w, h, d, color);
    return;
  }
  block(o, slot, x, y, z, w, h * 0.7, d, color);
  if (!pointed) {
    block(o, slot, x, y + h * 0.7, z, w * 0.92, h * 0.29, d * 0.96, color);
    return;
  }
  const a = [x - w / 2, y + h * 0.7, z + d / 2],
    b = [x + w / 2, y + h * 0.7, z + d / 2],
    p = [x, y + h, z + d / 2];
  const back = (q) => [q[0], q[1], q[2] - d];
  face(o, slot, [a, b, p], [0, 0, 1], color);
  face(o, slot, [back(a), back(b), back(p)], [0, 0, -1], color);
  face(o, slot, [a, p, back(p), back(a)], [-1, 1, 0], color);
  face(o, slot, [b, p, back(p), back(b)], [1, 1, 0], color);
}
function wall(out, w, level) {
  const { points, width, height, side, kind } = w,
    slot = kind === 'ashlar' ? 'ashlar' : 'lime',
    color = kind === 'ashlar' ? sand : earth;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      angle = Math.atan2(b[2] - a[2], b[0] - a[0]);
    const topA = a[1] + height,
      topB = b[1] + height;
    const { len, nx, nz } = strip(
      out,
      slot,
      [a[0], a[1] - w.reachDepths[i - 1], a[2]],
      [b[0], b[1] - w.reachDepths[i - 1], b[2]],
      topA,
      topB,
      width,
      color,
    );
    if (level === 0 || (level === 1 && i % 2 === 0)) continue;
    const c = front(out, a[0], 0, a[2], angle),
      count = Math.max(1, Math.floor(len / (level === 1 ? 10.5 : level === 2 ? 5.42 : 2.12)));
    const z = side * (width * 0.5 - 0.2),
      d = 0.39;
    if (level >= 3) {
      const pointAt = (v, h) => [v[0] + nx * z, h, v[2] + nz * z];
      beam(out, slot, pointAt(a, topA - 0.32), pointAt(b, topB - 0.32), 0.41, 0.34, color);
      if (kind === 'ridge' && level >= 3) {
        const risers = Math.max(1, Math.round(Math.abs(b[1] - a[1]) / 0.65));
        for (let j = 0; j < risers; j++) {
          const t = (j + 0.5) / risers,
            p = lerp(a, b, t);
          block(
            front(out, p[0], p[1] + height, p[2], angle),
            'ashlar',
            0,
            -0.24,
            -side * width * 0.19,
            len / risers + 0.22,
            0.27,
            width * 0.45,
            beige,
          );
        }
      }
    }
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        y = topA + (topB - topA) * t - 0.045;
      merlon(
        c,
        len * t,
        y,
        z,
        Math.min(level === 1 ? 1.75 : 1.05, len * 0.56),
        d,
        kind === 'ashlar' ? 0.77 : 0.91,
        level,
        kind !== 'ashlar',
        slot,
        color,
      );
    }
  }
}
function roundTower(o, b, level) {
  const {
      radius: r,
      bottom,
      top,
      center: [x, z],
    } = b,
    n = [5, 8, 12, 16, 24][level],
    slot = 'ashlar';
  const base = radialRing(bottom, r, r, n, [x, z], 0.11),
    lip = radialRing(top, r, r, n, [x, z], 0.11);
  if (level === 0) {
    loft(o, slot, [base, lip], sand);
    return;
  }
  if (r >= 5.4) {
    loft(o, slot, [base, lip], sand, { cap: false });
    const recessed = radialRing(top - 1.08, r - 0.53, r - 0.53, n, [x, z], 0.11);
    const inner = radialRing(top, r - 0.53, r - 0.53, n, [x, z], 0.11);
    const floor = recessed.map(([x, , z]) => [x, z]);
    solid(o, 'ashlar', floor, [], top - 1.21, top - 1.08, earth);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      face(o, slot, [lip[i], lip[j], inner[j], inner[i]], [0, 1, 0], beige);
      face(
        o,
        slot,
        [inner[j], inner[i], recessed[i], recessed[j]],
        [x - (inner[i][0] + inner[j][0]) * 0.5, 0, z - (inner[i][2] + inner[j][2]) * 0.5],
        sand,
      );
    }
  } else loft(o, slot, [base, lip], sand);
  const step = Math.max(1, Math.floor(n / (level === 1 ? 2 : level === 2 ? 4 : 1)));
  for (let i = 0; i < n; i += step) {
    const a = 0.11 - (i * 2 * Math.PI) / n,
      [px, , pz] = lip[i];
    const f = front(o, px, top, pz, Math.PI / 2 + a);
    const width = Math.min(1.02, ((2 * Math.PI * r) / n) * 0.55);
    merlon(f, 0, -0.03, -0.13, width, 0.52, 0.83, level, false, slot, sand);
    if (level >= 3 && i % 3 === 0) {
      const k = front(
        o,
        x + Math.cos(a) * (r - 0.08),
        top,
        z + Math.sin(a) * (r - 0.08),
        a - Math.PI / 2,
      );
      block(k, 'rubble', 0, -2.72, 0.14, 0.2, 0.84, 0.1, black);
    }
  }
}
function squareTower(o, b, level) {
  const {
      radius: r,
      bottom,
      top,
      center: [x, z],
      angle,
      kind,
    } = b,
    slot = kind === 'mud' ? 'lime' : 'ashlar';
  const f = front(o, x, 0, z, angle),
    color = kind === 'mud' ? sand : beige;
  block(f, slot, 0, bottom, 0, 2 * r, top - bottom, 2 * r, color);
  if (level === 0) return;
  if (level >= 2)
    block(
      f,
      'ashlar',
      0,
      bottom + 0.06,
      0,
      2 * r + 0.18,
      Math.min(1.47, top - bottom - 0.01),
      2 * r + 0.18,
      beige,
    );
  for (let s = 0; s < 4; s += level === 1 ? 2 : 1) {
    const a = (s * Math.PI) / 2,
      l = front(f, -Math.sin(a) * r, 0, Math.cos(a) * r, a);
    const n = level === 1 ? 1 : Math.max(2, Math.floor((2 * r) / (level === 2 ? 2.9 : 2.01)));
    for (let i = 0; i < n; i++) {
      const p = ((i + 0.5) / n) * 2 * r - r;
      merlon(
        l,
        p,
        top - 0.06,
        -0.15,
        Math.min(1.1, (1.13 * r) / n),
        0.38,
        kind === 'mud' ? 0.92 : 0.82,
        level,
        kind === 'mud',
        slot,
        color,
      );
    }
    if (level >= 2) {
      block(l, 'ashlar', 0, top - 0.51, -0.034, 2 * r + 0.09, 0.28, 0.145, beige);
      block(l, 'rubble', 0, top - 3.4, 0.03, 0.27, 0.93, 0.059, black);
      if (kind === 'keep') {
        for (const side of [-1, 1])
          block(l, 'rubble', side * r * 0.41, top - 5.85, 0.049, 0.39, 1.19, 0.061, black);
      }
    }
    if (level >= 3 && kind === 'mud') {
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 3; j++) {
          const y = top - 2.95 - i * 0.69;
          block(
            l,
            'lime',
            (j - 1) * r * 0.53 + (i % 2 ? 0.15 : 0),
            y,
            0.013,
            0.068,
            0.064,
            0.028,
            earth,
          );
        }
    }
  }
}
function passGate(o, g, level) {
  const {
    center: [x, z],
    angle,
    width: w,
    depth: d,
    opening,
    ground: y,
    height: h,
  } = g;
  const f = front(o, x, y, z, angle);
  const spring = 1.84,
    rise = 1.64;
  const cap = Array.from({ length: level === 0 ? 4 : level === 1 ? 7 : 15 }, (_, i) => i);
  const last = cap.length - 1;
  const curve = cap.map((i) => {
    const u = (2 * i) / last - 1;
    return [
      u * opening * 0.5,
      spring + rise * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.3 * Math.abs(u)),
    ];
  });
  for (const side of [-1, 1])
    block(f, 'ashlar', side * (w + opening) * 0.25, -1.42, 0, (w - opening) / 2, h + 1.42, d, sand);
  const crown = h - 0.03;
  for (let i = 1; i < curve.length; i++) {
    const [[a, p], [b, q]] = curve.slice(i - 1, i + 1);
    const ring = [
      [-d / 2, -1],
      [d / 2, 1],
    ];
    for (const [z, n] of ring) {
      face(
        f,
        'lime',
        [
          [a, p, z],
          [b, q, z],
          [b, crown, z],
          [a, crown, z],
        ],
        [0, 0, n],
        earth,
      );
      if (level > 1) {
        const g = z + n * 0.026;
        face(
          f,
          'ashlar',
          [
            [a, p, g],
            [b, q, g],
            [b * 1.18, q + 0.26, g],
            [a * 1.18, p + 0.26, g],
          ],
          [0, 0, n],
          i % 3 === 0 ? beige : sand,
        );
      }
    }
    face(
      f,
      'ashlar',
      [
        [a, p, -d / 2],
        [b, q, -d / 2],
        [b, q, d / 2],
        [a, p, d / 2],
      ],
      [0, -1, 0],
      sand,
    );
  }
  block(f, 'ashlar', 0, h - 0.1, 0, w + 0.18, 0.2, d + 0.14, beige);
  if (level > 0)
    for (const side of [-1, 1])
      for (const a of [-0.33, 0, 0.33]) {
        merlon(f, w * a, h + 0.09, side * d * 0.42, 0.69, 0.33, 0.9, level, true, 'lime', earth);
      }
}
function chapel(o, level) {
  const {
      center: [x, z],
      floor,
      width: w,
      depth: d,
      heading,
    } = layout.chapel,
    f = front(o, x, floor, z, heading),
    y = 5.7,
    rise = 2.1;
  block(f, 'lime', 0, -1, 0, w, y + 1, d, chalk);
  const rect = (ww, dd, h) => [
    [-ww / 2, h, dd / 2],
    [ww / 2, h, dd / 2],
    [ww / 2, h, -dd / 2],
    [-ww / 2, h, -dd / 2],
  ];
  loft(f, 'tile', [rect(w + 0.6, d + 0.6, y), rect(w * 0.71, 0.112, y + rise)], clay);
  if (level >= 1) block(f, 'wood', 0, -0.02, d * 0.51, 1.32, 2.43, 0.085, brick);
  if (level >= 2) {
    for (const u of [-0.31, -0.12, 0.13, 0.32])
      block(f, 'wood', w * u, 2.42, d * 0.502, 0.52, 1.19, 0.043, black);
    block(f, 'ashlar', 0, y + 0.05, 0, 0.91, 0.75, 0.5, beige);
    block(f, 'ashlar', 0, y + rise + 0.15, 0, 1.3, 0.29, 0.4, chalk);
  }
}
function monument(o, level) {
  const {
      center: [x, z],
      floor,
      heading,
    } = layout.shrine,
    f = front(o, x, floor, z, heading);
  block(f, 'ashlar', 0, -0.82, 0, 5.2, 1.32, 4.66, sand);
  for (const s of [-1, 1]) block(f, 'ashlar', s * 1.52, 0.48, 0, 1.23, 4.63, 2.06, chalk);
  block(f, 'ashlar', 0, 4.64, 0, 4.1, 1.42, 2.09, chalk);
  block(f, 'ashlar', 0, 5.9, 0, 1.4, 0.78, 1.55, beige);
  if (level === 0) return;
  const statue = [
    [6.58, 0.37],
    [7.43, 0.3],
    [8.17, 0.28],
    [8.36, 0.19],
    [8.65, 0.19],
    [8.75, 0.093],
  ];
  loft(
    f,
    'ashlar',
    statue.map(([y, r]) => radialRing(y, r, r, level >= 3 ? 10 : 6)),
    chalk,
  );
  for (const s of [-1, 1])
    beam(f, 'ashlar', [0, 8.11, 0.02], [0.57 * s, 8.23, 0.018], 0.173, 0.19, chalk);
}
function ruins(out, level) {
  if (level < 2) return;
  for (const [i, b] of layout.ruins.entries()) {
    const {
        center: [x, z],
        w,
        d,
        ground,
      } = b,
      f = front(out, x, ground, z, 0.35),
      h = 0.53 + (i % 4) * 0.19;
    for (const s of [-1, 1]) {
      block(f, 'rubble', 0, -0.71, (s * d) / 2, w + 0.41, h + 0.71, 0.59, beige);
      block(f, 'rubble', (s * w) / 2, -0.7, 0, 0.52, h + 0.7, d - 0.6, sand);
    }
    if (level > 2)
      for (let j = 0; j < 6; j++)
        block(
          f,
          'rubble',
          w * (j / 5 - 0.5),
          h + 0.01,
          d / 2,
          0.39,
          0.21 + (j % 4) * 0.11,
          0.53,
          sand,
        );
    if (level === 4)
      for (let j = 0; j < 7; j++)
        block(
          f,
          'rubble',
          -w * 0.5,
          h + 0.03,
          d * (j / 6 - 0.5),
          0.49,
          0.17 + (j % 3) * 0.043,
          0.37,
          beige,
        );
  }
}
function pool(out, level) {
  if (level === 0) return;
  const ring = layout.pool,
    y = layout.pool.reduce((s, p) => s + p[1], 0) / 4 + 0.53;
  const center = [0, 2].map((axis) => ring.reduce((s, p) => s + p[axis], 0) / 4);
  const footprint = ring.map(([x, , z]) => [x, z]);
  const inner = footprint.map((p) => lerp(center, p, 0.82));
  solid(out, 'ashlar', footprint, [inner], y - 1.4, y, beige);
}
function garden(out, level) {
  if (level < 2) return;
  for (const line of layout.gardenPaths) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1],
        b = line[i],
        length = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const ox = (-(b[2] - a[2]) / length) * 0.85,
        oz = ((b[0] - a[0]) / length) * 0.85;
      const p = [a[0] + ox, a[1], a[2] + oz],
        q = [b[0] + ox, b[1], b[2] + oz],
        r = [b[0] - ox, b[1], b[2] - oz],
        t = [a[0] - ox, a[1], a[2] - oz];
      face(out, 'rubble', [p, q, r, t], [0, 1, 0], beige);
    }
  }
  const shrubs =
    level === 2 ? layout.gardenFeatures.filter((_, i) => i % 2 === 0) : layout.gardenFeatures;
  for (const {
    center: [x, z],
    height: y,
    r,
    h,
  } of shrubs) {
    const n = level === 2 ? 4 : 7;
    const foliage = [
      [y - 0.51, r * 0.68],
      [y + 0.2, r * 0.94],
      [y + h * 0.68, r],
      [y + h, r * 0.28],
    ];
    loft(
      out,
      'foliage',
      foliage.map(([y, r]) => radialRing(y, r, r, n, [x, z])),
      [0.24, 0.3, 0.135],
    );
  }
}
function build(out, level) {
  for (const b of layout.walls) wall(out, b, level);
  for (const [i, b] of layout.towers.entries()) {
    if (level === 0 && i >= 7 && (i % 2 === 0 || i === 21 || i === 23 || i === 33)) continue;
    if (b.kind === 'round') roundTower(out, b, level);
    else squareTower(out, b, level);
  }
  for (const g of layout.gates) passGate(out, g, level);
  chapel(out, level);
  monument(out, level);
  ruins(out, level);
  garden(out, level);
  pool(out, level);
}
export const buildSkyline = (o) => build(o, 0);
export const buildDistrict = (o) => build(o, 1);
export const buildStreet = (o) => build(o, 2);
export const buildCloseup = (o) => build(o, 3);
export const buildMaster = (o) => build(o, 4);
