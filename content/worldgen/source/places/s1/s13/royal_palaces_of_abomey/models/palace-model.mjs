/** Abomey’s earthen museum courts, deep verandas, relief panels and round shelters. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  earth: { slot: 'wall', graph: 'plaster_lime' },
  stone: { slot: 'foundation', graph: 'stone_sandstone' },
  wood: { slot: 'trim', graph: 'wood_plain' },
  roof: { slot: 'roof', graph: 'metal_corrugated' },
  fiber: { slot: 'roof', graph: 'thatch' },
  relief: { slot: 'trim', graph: 'stone_ashlar' },
};
const ochre = [0.58, 0.255, 0.147],
  warm = [0.65, 0.285, 0.157],
  adobe = [0.57, 0.224, 0.129],
  deep = [0.335, 0.131, 0.084];
const lintel = [0.43, 0.166, 0.098],
  roof = [0.39, 0.177, 0.135],
  brown = [0.29, 0.132, 0.089],
  clay = [0.49, 0.276, 0.169],
  ivory = [0.87, 0.694, 0.468];
const umber = [0.243, 0.104, 0.065],
  sand = [0.61, 0.479, 0.29],
  green = [0.427, 0.451, 0.298],
  indigo = [0.27, 0.36, 0.38];

function face(out, k, p, n, color) {
  if (normalFor(...p).reduce((sum, v, i) => sum + v * n[i], 0) < 0) p = [...p].reverse();
  if (p.length === 3) out.addTriangle(k, '', p, normalFor(...p), [], color);
  else out.addQuad(k, '', p, normalFor(...p), [], color);
}
const block = (o, k, x, y, z, w, h, d, t) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], t);
const solid = (o, k, outline, holes, y0, y1, tint) =>
  prism((k, p, n) => face(o, k, p, n, tint), k, { outline, holes }, y0, y1, false);
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
function panel(o, k, x, y, z, w, h, t) {
  face(
    o,
    k,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    t,
  );
}
function roofHip(o, w, d, h, pitch, level, color = roof) {
  const x = w / 2,
    z = d / 2,
    crest = Math.max(x * 0.42, x - d * 0.31);
  const a = [-x, h, -z],
    b = [x, h, -z],
    c = [x, h, z],
    e = [-x, h, z];
  const left = [-crest, h + pitch, 0],
    right = [crest, h + pitch, 0];
  face(o, 'roof', [a, b, right, left], [0, 1, -1], color);
  face(o, 'roof', [e, c, right, left], [0, 1, 1], color);
  face(o, 'roof', [a, e, left], [-1, 1, 0], color);
  face(o, 'roof', [b, c, right], [1, 1, 0], color);
  face(o, 'wood', [a, b, c, e], [0, -1, 0], brown);
  if (level < 2) return;
  beam(o, 'roof', left, right, 0.13, 0.11, color);
  for (const edge of [a, b, c, e]) {
    const peak = edge[0] < 0 ? left : right;
    beam(o, 'roof', edge, peak, 0.087, 0.061, color);
  }
  for (const off of [-1, 1]) {
    block(o, 'wood', 0, h - 0.14, off * z, w + 0.03, 0.095, 0.08, umber);
    const count = Math.min(22, Math.round(w / 1.75));
    for (let i = 1; i < count; i++) {
      const at = (i / count - 0.5) * w;
      beam(
        o,
        'wood',
        [at, h - 0.125, off * (z - 0.74)],
        [at, h - 0.16, off * z],
        0.075,
        0.085,
        umber,
      );
    }
  }
}

function polygon(o, x, y, z, scale, points, color) {
  const positions = points.map(([u, v]) => [x + (u - 0.5) * scale, y + v * scale, z]);
  for (let i = 1; i + 1 < positions.length; i++)
    face(o, 'relief', [positions[0], positions[i], positions[i + 1]], [0, 0, 1], color);
}
function relief(o, x, y, z, scale, kind, level) {
  const u = (a, b) => [x + (a - 0.5) * scale, y + b * scale, z + 0.014];
  const stroke = (a, b, t, color) =>
    beam(o, 'relief', u(...a), u(...b), t * scale, 0.034 * scale, color);
  panel(o, 'relief', x, y - 0.065 * scale, z, scale * 1.08, scale * 1.01, deep);
  panel(o, 'relief', x, y, z + 0.009, scale * 0.93, scale * 0.88, ivory);
  if (level === 1) return;
  const hue = [umber, indigo, green, sand][kind % 4];
  if (kind % 3 === 0) {
    polygon(
      o,
      x,
      y,
      z + 0.017,
      scale,
      [
        [0.15, 0.39],
        [0.29, 0.59],
        [0.62, 0.58],
        [0.77, 0.5],
        [0.72, 0.35],
        [0.31, 0.35],
      ],
      hue,
    );
    polygon(
      o,
      x,
      y,
      z + 0.018,
      scale,
      [
        [0.6, 0.48],
        [0.64, 0.67],
        [0.73, 0.73],
        [0.84, 0.67],
        [0.9, 0.55],
        [0.74, 0.52],
      ],
      hue,
    );
    for (const p of [0.22, 0.36, 0.65, 0.75]) stroke([p, 0.4], [p - 0.05, 0.21], 0.051, hue);
    stroke([0.24, 0.52], [0.1, 0.65], 0.049, hue);
    stroke([0.1, 0.65], [0.13, 0.745], 0.041, hue);
  } else if (kind % 3 === 1) {
    for (const side of [-1, 1]) {
      const cx = 0.5 + side * 0.2;
      polygon(
        o,
        x,
        y,
        z + 0.027,
        scale,
        [
          [cx, 0.65],
          [cx + 0.065, 0.48],
          [cx + 0.073, 0.28],
          [cx - 0.076, 0.27],
          [cx - 0.069, 0.45],
        ],
        hue,
      );
      const pt = u(cx, 0.715);
      sphere(
        o,
        'relief',
        pt,
        [0.065 * scale, 0.073 * scale, 0.03 * scale],
        hue,
        level >= 3 ? 8 : 5,
        4,
      );
      stroke([cx, 0.48], [cx + side * 0.099, 0.62], 0.041, hue);
      stroke([cx, 0.49], [cx - side * 0.11, 0.43], 0.04, hue);
      stroke([cx - 0.044, 0.3], [cx - 0.068, 0.19], 0.038, hue);
      stroke([cx + 0.035, 0.3], [cx + 0.078, 0.19], 0.036, hue);
    }
  } else {
    for (let j = 0; j < 5; j++) {
      const h = 0.48 + (j % 2) * 0.13,
        p = 0.19 + j * 0.153;
      polygon(
        o,
        x,
        y,
        z + 0.02 + j * 0.001,
        scale,
        [
          [p - 0.065, 0.23],
          [p - 0.01, h],
          [p + 0.045, 0.58],
          [p + 0.065, 0.23],
        ],
        hue,
      );
    }
    stroke([0.19, 0.22], [0.83, 0.22], 0.035, hue);
  }
  if (level >= 3)
    for (const s of [-1, 1]) {
      stroke([0.09, 0.43 + s * 0.36], [0.91, 0.43 + s * 0.36], 0.031, clay);
      for (let i = 0; i < 4; i++)
        stroke([0.12 + i * 0.22, 0.43 + s * 0.29], [0.16 + i * 0.22, 0.43 + s * 0.34], 0.024, clay);
    }
}
function doors(o, w, d, h, level, festival) {
  const z = d / 2,
    wide = festival ? Math.min(3.18, w * 0.27) : Math.min(2.4, w * 0.31);
  const doorHeight = Math.min(2.52, h * 0.67),
    side = (w - wide) / 2;
  for (const sign of [-1, 1])
    block(o, 'earth', (sign * (wide + side)) / 2, 0, z - 0.52, side, h, 1.05, warm);
  block(o, 'earth', 0, doorHeight, z - 0.52, wide, h - doorHeight, 1.05, adobe);
  block(o, 'stone', 0, -0.08, z - 0.2, wide + 0.42, 0.18, 1.2, sand);
  if (level > 0) {
    block(o, 'wood', 0, 0, z - 1.08, wide * 0.93, doorHeight * 0.99, 0.16, umber);
    for (let i = 0; i < 5; i++)
      panel(o, 'wood', wide * (i / 5 - 0.38), 0.04, z - 0.994, 0.039, doorHeight - 0.1, brown);
    block(o, 'wood', 0, doorHeight - 0.12, z + 0.043, wide + 0.37, 0.19, 0.21, lintel);
    if (festival) {
      block(o, 'relief', 0, doorHeight + 0.27, z + 0.038, wide * 1.24, 0.65, 0.083, ivory);
      if (level >= 2)
        for (let i = 0; i < 3; i++)
          panel(
            o,
            'relief',
            0,
            doorHeight + 0.37 + i * 0.139,
            z + 0.083,
            wide * (0.96 - i * 0.05),
            0.046,
            brown,
          );
    }
  }
}

function house(out, b, index, level) {
  const [x, z] = b.center,
    { width: w, depth: d, height: h } = b,
    o = front(out, x, b.floor, z, b.angle),
    kind = b.kind;
  const timber = kind === 'gallery' && index % 2 === 0;
  const tint = [ochre, warm, adobe][index % 3];
  solid(out, 'stone', b.outline, b.holes, b.bottom, b.floor, deep);
  if (level === 0) {
    solid(out, 'earth', b.outline, b.holes, b.floor, b.floor + h, tint);
    roofHip(o, w + 0.35, d + 0.28, h, 0.85, 0);
    return;
  }
  if (kind === 'hall') {
    solid(out, 'earth', b.outline, b.holes, b.floor, b.floor + h, tint);
    const fac = d * 0.5 + 0.008;
    panel(o, 'wood', 0, 0.11, fac, Math.min(1.66, w * 0.32), Math.min(h * 0.76, 2.1), umber);
    if (level >= 3) panel(o, 'relief', 0, h * 0.78, fac + 0.016, 0.18, 0.23, deep);
  } else {
    const frontStrip = kind === 'gallery' ? Math.min(d * 0.26, 2.75) : 1.02;
    const center = -frontStrip / 2 - 0.08;
    block(o, 'earth', 0, 0, center, w, h, d - frontStrip - 0.17, tint);
    if (kind === 'museum') doors(o, w, d, h, level, index === 0);
    else {
      const count = index === 1 ? 7 : w > 26 ? 6 : 4;
      const spacing = w / count;
      const wallWidth = spacing * (timber ? 0.155 : 0.213);
      for (let j = 0; j <= count; j++) {
        const u = (j / count - 0.5) * (w - wallWidth);
        block(
          o,
          timber ? 'wood' : 'earth',
          u,
          0,
          d * 0.5 - 0.44,
          wallWidth,
          h - 0.16,
          0.87,
          timber ? brown : adobe,
        );
        if (level >= 2 && j > 0 && j < count && (index === 1 || j % 2 === 1))
          relief(o, u, 1.08, d * 0.5 + 0.018, Math.min(1.02, wallWidth * 0.82), j + index, level);
      }
      block(o, 'earth', 0, h - 0.28, d * 0.5 - 0.4, w, 0.32, 0.87, adobe);
      block(o, 'stone', 0, -0.045, d * 0.5 - frontStrip * 0.52, w, 0.105, frontStrip + 0.095, sand);
    }
    if (level >= 2)
      for (const s of [-1, 1]) {
        const n = Math.max(1, Math.round(w / 12));
        for (let i = 0; i < n; i++) {
          const at = s * w * ((i + 0.5) / n - 0.5);
          if (kind === 'museum' && Math.abs(at) > 2.8)
            panel(o, 'relief', at, h * 0.71, d * 0.5 + 0.019, 0.36, 0.48, deep);
        }
      }
  }
  roofHip(
    o,
    w + 0.83,
    d + 0.9,
    h,
    0.76 + Math.min(d * 0.085, 1.07),
    level,
    kind === 'museum' ? [0.37, 0.145, 0.101] : roof,
  );
}

function shelter(out, b, index, level) {
  const [x, z] = b.center,
    r = Math.sqrt(b.width * b.depth) * 0.49;
  const n = level === 0 ? 6 : level === 1 ? 8 : level === 2 ? 12 : 17;
  const floor = b.floor;
  const circ = (y, u) => radialRing(y, r * u, r * u, n, [x, z]);
  if (level > 0) loft(out, 'earth', [circ(b.bottom, 1), circ(floor + 0.34, 1)], deep);
  else
    block(
      out,
      'earth',
      x,
      b.bottom,
      z,
      r * 1.56,
      floor + b.height - b.bottom - 0.14,
      r * 1.56,
      ochre,
    );
  if (level === 0) {
    // Far silhouettes keep the roof outline and solid shadow.
  } else {
    for (let i = 0; i < n; i++) {
      if (i === Math.floor(n * 0.25)) continue;
      const a = (2 * Math.PI * i) / n;
      block(
        out,
        index % 3 === 1 ? 'wood' : 'earth',
        x + r * 0.8 * Math.cos(a),
        floor,
        z + r * 0.8 * Math.sin(a),
        index % 3 === 1 ? 0.25 : 0.48,
        b.height,
        0.5,
        index % 3 === 1 ? brown : ochre,
      );
    }
  }
  const kind = index % 3 === 1 ? 'roof' : 'fiber',
    tint = kind === 'roof' ? roof : clay;
  const lofts =
    level > 1
      ? [
          [0, 1.06],
          [0.21, 0.83],
          [0.53, 0.49],
          [0.82, 0.2],
          [1, 0.035],
        ]
      : [
          [0, 1.06],
          [1, 0.035],
        ];
  loft(
    out,
    kind,
    lofts.map(([u, v]) => circ(floor + b.height + u * r * 0.59, v)),
    tint,
  );
  if (level >= 2) block(out, 'wood', x, floor + b.height + r * 0.59, z, 0.145, 0.28, 0.145, umber);
}
function compoundWall(out, path, level) {
  if (level === 0 && path.name.endsWith('7')) return;
  for (let i = 1; i < path.points.length; i++) {
    const [x, z, y] = path.points[i - 1],
      [a, b, c] = path.points[i],
      w = 0.57,
      h = path.height;
    const l = Math.hypot(a - x, b - z),
      u = ((b - z) * w) / l,
      v = ((x - a) * w) / l;
    const p = [x + u, y - 0.34, z - v],
      q = [a + u, c - 0.34, b - v],
      r = [a + u, c + h, b - v],
      s = [x + u, y + h, z - v];
    const t = [x - u, y - 0.34, z + v],
      j = [a - u, c - 0.34, b + v],
      k = [a - u, c + h, b + v],
      m = [x - u, y + h, z + v];
    face(out, 'earth', [p, q, r, s], [u, 0, -v], ochre);
    face(out, 'earth', [t, j, k, m], [-u, 0, v], adobe);
    face(out, 'stone', [s, r, k, m], [0, 1, 0], deep);
    face(out, 'earth', [p, s, m, t], [x - a, 0, z - b], deep);
    face(out, 'earth', [q, r, k, j], [a - x, 0, b - z], deep);
    if (level >= 2)
      beam(out, 'stone', [x, y + h + 0.04, z], [a, c + h + 0.04, b], 0.69, 0.105, deep);
  }
}
function build(out, level) {
  for (const [i, b] of layout.buildings.entries()) {
    if (b.kind === 'round') shelter(out, b, i, level);
    else house(out, b, i, level);
  }
  for (const path of layout.court) compoundWall(out, path, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
