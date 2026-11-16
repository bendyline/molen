/** Main gates, floodgate, towers and selected ramparts of Suwon's Hwaseong Fortress. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildChineseHipRoof } from '../../../../../../../../packages/worldgen/scripts/chinese-roof-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite' },
  ashlar: { slot: 'wall', graph: 'stone_ashlar' },
  brick: { slot: 'wall', graph: 'brick_stack' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  timber: { slot: 'door', graph: 'wood_plain' },
  paint: { slot: 'trim', graph: 'metal_painted' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  walk: { slot: 'foundation', graph: 'gravel' },
};
const stone = [0.67, 0.65, 0.6],
  baseStone = [0.59, 0.58, 0.55],
  dark = [0.3, 0.31, 0.31],
  red = [0.56, 0.22, 0.13];
const brick = [0.34, 0.31, 0.29],
  green = [0.3, 0.48, 0.36],
  gold = [0.72, 0.55, 0.3],
  tile = [0.14, 0.175, 0.207];
const warm = [0.77, 0.7, 0.59];
const mix = (a, b, t) => a + (b - a) * t;
function face(out, slot, p, n, color) {
  const actual = normalFor(...p);
  const q = actual.reduce((sum, v, i) => sum + v * n[i], 0) < 0 ? [...p].reverse() : p;
  const normal = normalFor(...q);
  if (q.length === 3) out.addTriangle(slot, '', q, normal, [], color);
  else if (q.length === 4) out.addQuad(slot, '', q, normal, [], color);
  else for (let i = 1; i < q.length - 1; i++) face(out, slot, [q[0], q[i], q[i + 1]], n, color);
}
function frame(out, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    n = ([u, v, w]) => [c * u - s * w, v, s * u + c * w];
  const p = (v) => n(v).map((v, i) => v + [x, y, z][i]);
  return {
    addTriangle: (k, r, v, m, uv, t) => out.addTriangle(k, r, v.map(p), n(m), uv, t),
    addQuad: (k, r, v, m, uv, t) => out.addQuad(k, r, v.map(p), n(m), uv, t),
    addConvexPolygon: (k, r, v, m, uv, t) => out.addConvexPolygon(k, r, v.map(p), n(m), uv, t),
  };
}
const block = (o, k, x, y, z, w, h, d, c) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c);
function panel(out, k, x, y, z, w, h, c, s = 1) {
  face(
    out,
    k,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, s],
    c,
  );
}
function roof(out, w, d, y, h, level) {
  buildChineseHipRoof(
    (k, p, n) => face(out, k, p, n, k === 'tile' ? tile : green),
    { x: 0, z: 0, width: w - 0.8, depth: d - 0.8, low: y, rise: h },
    level <= 1 ? 0 : level === 2 ? 1 : 2,
    'tile',
  );
  if (level >= 3) {
    const n = Math.min(55, Math.floor(w / (level === 4 ? 0.39 : 0.73)));
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        const x = w * ((i + 0.5) / n - 0.5) * 0.96,
          z = side * (d / 2 + 0.04);
        block(out, 'tile', x, y - 0.025, z, 0.082, 0.11, 0.14, tile);
      }
  }
}
function pavilion(out, w, d, h, bays, level, { upper = false, open = true } = {}) {
  const x = w * 0.4,
    z = d * 0.34;
  if (!open) {
    if (level > 0) block(out, 'plaster', 0, 0, 0, x * 2, h, z * 2, warm);
    else for (const side of [-1, 1]) panel(out, 'plaster', 0, 0, side * z, x * 2, h, warm, side);
  }
  for (const side of [-1, 1]) {
    if (level >= 2) block(out, 'paint', 0, h - 0.19, side * z, x * 2 + 0.3, 0.21, 0.22, green);
    for (let i = 0; i <= bays; i++) {
      const px = 2 * x * (i / bays - 0.5);
      if (level <= 1) panel(out, 'timber', px, 0, side * z, 0.34, h, red, side);
      else block(out, 'timber', px, 0, side * z, 0.32, h, 0.32, red);
      if (level >= 2) {
        block(out, 'paint', px, h - 0.44, side * z, 0.51, 0.18, 0.46, green);
        block(out, 'paint', px, h - 0.26, side * z * 1.04, 0.65, 0.14, 0.53, gold);
        block(out, 'granite', px, -0.09, side * z, 0.51, 0.16, 0.52, stone);
      }
    }
    if (level >= 2 && !open) {
      for (let i = 0; i < bays; i++) {
        const px = 2 * x * ((i + 0.5) / bays - 0.5),
          zz = side * (z + 0.036),
          ww = (w * 0.63) / bays;
        panel(out, 'paint', px, h * 0.17, zz, ww, h * 0.58, green, side);
        if (level >= 3)
          for (let j = 0; j < 5; j++)
            panel(
              out,
              'timber',
              px + ww * (j / 5 - 0.4),
              h * 0.29,
              zz + side * 0.018,
              0.044,
              h * 0.39,
              warm,
              side,
            );
      }
    }
  }
  const peak = Math.min(h * 0.76, d * 0.26);
  roof(out, w, d, h, peak, level);
  if (upper) {
    const y = h + peak * 0.61;
    pavilion(frame(out, 0, y, 0, 0), w * 0.77, d * 0.72, h * 0.61, bays, level, { open: false });
  }
}
function parapet(out, a, b, width, level, material = 'ashlar') {
  const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
  if (l < 0.13) return;
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    nx = -dz / l,
    nz = dx / l;
  const at = (p, v, y) => [p[0] + nx * v, p[1] + y, p[2] + nz * v];
  for (const s of [-1, 1]) {
    face(
      out,
      material,
      [
        at(a, (s * width) / 2, 0),
        at(b, (s * width) / 2, 0),
        at(b, (s * width) / 2, 0.67),
        at(a, (s * width) / 2, 0.67),
      ],
      [s * nx, 0, s * nz],
      stone,
    );
  }
  face(
    out,
    material,
    [
      at(a, -width / 2, 0.67),
      at(b, -width / 2, 0.67),
      at(b, width / 2, 0.67),
      at(a, width / 2, 0.67),
    ],
    [0, 1, 0],
    stone,
  );
  if (level < 2) return;
  const n = Math.max(1, Math.floor(l / (level === 2 ? 8.8 : level === 3 ? 4.1 : 2.35)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n,
      p = a.map((v, j) => mix(v, b[j], t));
    if (level <= 2)
      panel(
        frame(out, p[0], p[1], p[2], Math.atan2(dz, dx)),
        material,
        0,
        0.63,
        0,
        0.68,
        0.42,
        stone,
      );
    else
      block(
        frame(out, p[0], p[1], p[2], Math.atan2(dz, dx)),
        material,
        0,
        0.64,
        0,
        0.75,
        0.46,
        width * 0.93,
        stone,
      );
  }
}
function vault(out, x, y, z, w, h, d, level, top, slot = 'ashlar') {
  const n = level === 0 ? 2 : level === 1 ? 5 : level === 2 ? 8 : 11;
  const p = (t) => [x + w * (t - 0.5), y + h * (0.57 + 0.43 * Math.sin(t * Math.PI))];
  for (let i = 0; i < n; i++) {
    const a = p(i / n),
      b = p((i + 1) / n);
    for (const s of [-1, 1]) {
      const zz = z + (s * d) / 2;
      face(
        out,
        slot,
        [
          [a[0], a[1], zz],
          [b[0], b[1], zz],
          [b[0], top(b[0]), zz],
          [a[0], top(a[0]), zz],
        ],
        [0, 0, s],
        stone,
      );
      if (level >= 3)
        face(
          out,
          'granite',
          [
            [a[0], a[1] + 0.016, zz + s * 0.033],
            [b[0], b[1] + 0.016, zz + s * 0.033],
            [b[0], b[1] + 0.19, zz + s * 0.033],
            [a[0], a[1] + 0.19, zz + s * 0.033],
          ],
          [0, 0, s],
          baseStone,
        );
    }
    face(
      out,
      slot,
      [
        [a[0], a[1], z - d / 2],
        [b[0], b[1], z - d / 2],
        [b[0], b[1], z + d / 2],
        [a[0], a[1], z + d / 2],
      ],
      [0, -1, 0],
      baseStone,
    );
  }
}
function wallStrip(out, a, b, width, level, material = 'ashlar') {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    l = Math.hypot(dx, dz),
    nx = -dz / l,
    nz = dx / l;
  const at = (p, d, y) => [p[0] + nx * d, p[1] + y, p[2] + nz * d];
  for (const sign of [-1, 1]) {
    face(
      out,
      material,
      [
        at(a, (sign * width) / 2, -2.0),
        at(b, (sign * width) / 2, -2.0),
        at(b, (sign * width) / 2, 2.3),
        at(a, (sign * width) / 2, 2.3),
      ],
      [sign * nx, 0, sign * nz],
      stone,
    );
  }
  const h = (p) => [p[0], p[1] + 2.3, p[2]];
  if (level > 0)
    face(
      out,
      'walk',
      [
        at(a, -width / 2, 2.3),
        at(b, -width / 2, 2.3),
        at(b, width / 2, 2.3),
        at(a, width / 2, 2.3),
      ],
      [0, 1, 0],
      [0.53, 0.47, 0.38],
    );
  if (level > 0) parapet(out, h(a), h(b), 0.44, level);
}
function ramparts(out, level) {
  for (const row of layout.ramparts) {
    const step = level === 0 ? 4 : 1;
    const pts = row.points.filter((_, i) => i % step === 0 || i === row.points.length - 1);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        p = ([x, z, y]) => [x, y, z];
      wallStrip(out, p(a), p(b), 1.84, level);
    }
  }
}
function barbican(out, b, level) {
  const [cx, cz, r, w, h] = b.barb;
  const a = b.angle + Math.PI / 2;
  const n = level === 0 ? 3 : level === 1 ? 8 : 19;
  // Two separated arc segments preserve the offset side entrance.
  for (const [start, end] of [
    [-0.22, 0.43],
    [0.64, 1.36],
  ]) {
    for (let i = 0; i < n; i++) {
      const pt = (t) => {
        const u = a + Math.PI * mix(start, end, t);
        return [cx + r * Math.cos(u), b.floor, cz + r * Math.sin(u)];
      };
      const p = pt(i / n),
        q = pt((i + 1) / n);
      for (const sign of [-1, 1]) {
        const n = ([x, y, z], e) => [
          x + ((x - cx) * sign * w) / (2 * r),
          y + e,
          z + ((z - cz) * sign * w) / (2 * r),
        ];
        face(
          out,
          'granite',
          [n(p, -0.52), n(q, -0.52), n(q, h), n(p, h)],
          [(p[0] - cx) * sign, 0, (p[2] - cz) * sign],
          stone,
        );
      }
      if (level > 0) {
        const at = (a, b) => [
          a[0] + ((a[0] - cx) * b * w) / (2 * r),
          a[1] + h,
          a[2] + ((a[2] - cz) * b * w) / (2 * r),
        ];
        face(out, 'ashlar', [at(p, 1), at(q, 1), at(q, -1), at(p, -1)], [0, 1, 0], stone);
      }
      if (level >= 2 && i % 2 === 0)
        block(
          out,
          'ashlar',
          mix(p[0], q[0], 0.5),
          p[1] + h,
          mix(p[2], q[2], 0.5),
          0.55,
          0.5,
          0.55,
          baseStone,
        );
    }
  }
}
function gate(out, b, level) {
  const p = frame(out, b.center[0], b.floor, b.center[1], b.angle);
  const big = b.kind === 'largeGate',
    deck = big ? 4.97 : 3.83,
    opening = big ? 5.62 : 3.52;
  const d = b.d * 0.96,
    h = big ? 3.94 : 3.1;
  vault(p, 0, -0.1, 0, opening, h, d, level, () => deck, 'granite');
  const half = (b.w - opening) / 2;
  for (const sign of [-1, 1]) {
    block(p, 'granite', (sign * (opening + half)) / 2, -1.95, 0, half, deck + 1.95, d, stone);
    if (level >= 1)
      block(
        p,
        'ashlar',
        (sign * (opening + half)) / 2,
        deck - 0.34,
        0,
        half,
        0.36,
        d * 1.04,
        baseStone,
      );
  }
  block(p, 'granite', 0, deck - 0.065, 0, b.w, 0.21, d, stone);
  if (level > 0)
    for (const side of [-1, 1])
      parapet(
        p,
        [-b.w / 2, deck + 0.13, side * d * 0.49],
        [b.w / 2, deck + 0.13, side * d * 0.49],
        0.31,
        level,
      );
  pavilion(frame(p, 0, deck + 0.16, 0, 0), b.w * 0.94, b.d * 0.9, big ? 4.9 : 3.82, b.bay, level, {
    upper: big,
    open: true,
  });
  if (level >= 2) {
    const e = big ? 4.79 : 3.6;
    block(p, 'timber', 0, deck + e - 0.42, d * 0.42, big ? 2.8 : 1.91, 0.42, 0.21, dark);
    panel(p, 'paint', 0, deck + e - 0.24, d * 0.43, big ? 2.48 : 1.57, 0.066, gold);
  }
  if (level > 0 || big) barbican(out, b, level);
}
function tower(out, b, level) {
  const [x, z] = b.center,
    p = frame(out, x, b.floor, z, b.angle),
    round = b.kind === 'roundTower';
  if (!round) {
    block(p, 'granite', 0, -1.55, 0, b.w, b.h * 0.35 + 1.55, b.d, stone);
    block(p, 'brick', 0, b.h * 0.35, 0, b.w * 0.86, b.h * 0.66, b.d * 0.87, brick);
    if (level >= 1)
      for (const side of [-1, 1]) {
        const q = frame(p, 0, 0, b.d * 0.441 * side, side === 1 ? 0 : Math.PI);
        for (let j = 0; j < 3; j++)
          for (const yy of [b.h * 0.51, b.h * 0.73, b.h * 0.89])
            panel(q, 'timber', (j - 1) * b.w * 0.21, yy, 0.007, 0.19, 0.46, dark);
      }
    pavilion(frame(p, 0, b.h, 0, 0), b.w * 1.04, b.d * 1.04, 2.95, 3, level, { open: true });
    return;
  }
  const n = level === 0 ? 8 : level < 3 ? 17 : 28;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      c = (2 * Math.PI * (i + 1)) / n;
    const pt = (t, y, r) => [Math.cos(t) * r * b.w * 0.5, y, Math.sin(t) * r * b.d * 0.5];
    const normal = [Math.cos((a + c) / 2), 0.0, Math.sin((a + c) / 2)];
    face(
      p,
      'granite',
      [pt(a, -1.27, 1.04), pt(c, -1.27, 1.04), pt(c, 1.75, 1.01), pt(a, 1.75, 1.01)],
      normal,
      stone,
    );
    face(
      p,
      'brick',
      [pt(a, 1.74, 1.01), pt(c, 1.74, 1.01), pt(c, b.h, 0.88), pt(a, b.h, 0.88)],
      normal,
      brick,
    );
    if (level >= 2 && i % 3 === 1) {
      for (const y of [3.15, 5.2, 7.35])
        face(
          p,
          'timber',
          [
            pt(mix(a, c, 0.38), y, 0.978),
            pt(mix(a, c, 0.62), y, 0.978),
            pt(mix(a, c, 0.62), y + 0.45, 0.978),
            pt(mix(a, c, 0.38), y + 0.45, 0.978),
          ],
          normal,
          dark,
        );
    }
  }
  pavilion(frame(p, 0, b.h, 0, 0), b.w * 0.78, b.d * 0.77, 2.68, 3, level, { open: true });
}
function watergate(out, level) {
  const g = layout.waterGate,
    { west, east, length, width: w, y0, y1 } = g;
  const p = frame(out, west[0], 0, west[1], Math.atan2(east[1] - west[1], east[0] - west[0]));
  const deck = (x) => {
    const t = x / length;
    return mix(y0, y1, t) + 1.73 * t * (1 - t);
  };
  const y = (x) => deck(x) - 2.93,
    draft = deck(length / 2) - 0.35;
  const span = length / 7,
    opening = span * 0.725;
  for (let i = 0; i < 7; i++) {
    const x = span * (i + 0.5);
    vault(p, x, y(x), 0, opening, 1.77, w, level, (v) => deck(v) - 0.11, 'granite');
    if (i < 6) {
      const u = span * (i + 1);
      block(p, 'granite', u, y(u) - 1.18, 0, span - opening, 4.05, w, stone);
    }
  }
  for (const x of [(span - opening) / 4, length - (span - opening) / 4])
    block(p, 'granite', x, y(x) - 1.26, 0, (span - opening) / 2, 4.12, w, stone);
  const n = level === 0 ? 4 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i * length) / n,
      b = ((i + 1) * length) / n;
    face(
      p,
      'granite',
      [
        [a, deck(a), -w / 2],
        [b, deck(b), -w / 2],
        [b, deck(b), w / 2],
        [a, deck(a), w / 2],
      ],
      [0, 1, 0],
      stone,
    );
    if (level >= 2)
      for (const side of [-1, 1])
        face(
          p,
          'ashlar',
          [
            [a, deck(a), (side * w) / 2],
            [b, deck(b), (side * w) / 2],
            [b, deck(b) + 0.63, (side * w) / 2],
            [a, deck(a) + 0.63, (side * w) / 2],
          ],
          [0, 0, side],
          baseStone,
        );
    if (level >= 3)
      for (const side of [-1, 1])
        block(p, 'granite', a, deck(a) + 0.59, side * w * 0.49, 0.28, 0.39, 0.32, stone);
  }
  const [rx, rz] = g.roofFrame;
  pavilion(frame(out, rx, draft + 0.16, rz, 0), 14.66, 8.92, 3.2, 5, level, { open: false });
}
function build(out, level) {
  ramparts(out, level);
  watergate(out, level);
  for (const b of layout.buildings) {
    if (['largeGate', 'smallGate'].includes(b.kind)) {
      gate(out, b, level);
      continue;
    }
    if (b.kind.endsWith('Tower')) {
      tower(out, b, level);
      continue;
    }
    const p = frame(out, b.center[0], b.floor, b.center[1], b.angle);
    if (b.kind === 'beacon') {
      block(p, 'granite', 0, -2.2, 0, b.w, 4.6, b.d, stone);
      if (level > 0) block(p, 'brick', 0, 2.4, 0, b.w, 0.33, b.d * 0.93, brick);
      for (let i = 0; i < 5; i++) {
        const x = b.w * ((i + 0.5) / 5 - 0.5);
        if (level === 0) {
          panel(p, 'brick', x, 2.38, 0.73, 1.5, 2.55, brick);
          panel(p, 'brick', x, 2.38, -0.73, 1.5, 2.55, brick, -1);
        } else block(p, 'brick', x, 2.69, 0, 1.5, 2.38, 1.41, brick);
        if (level >= 2) block(p, 'ashlar', x, 5.03, 0, 1.67, 0.34, 1.62, baseStone);
      }
      continue;
    }
    if (level === 0 && b.name !== 'Seojangdae') continue;
    block(
      p,
      'granite',
      0,
      b.bottom - b.floor,
      0,
      b.w * 0.85,
      b.floor - b.bottom,
      b.d * 0.81,
      stone,
    );
    pavilion(p, b.w, b.d, b.h, b.bay, level, { upper: b.kind === 'doublePavilion', open: true });
  }
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
