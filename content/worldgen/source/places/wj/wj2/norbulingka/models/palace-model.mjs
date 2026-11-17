/** Norbulingka summer palace and lake pavilion, in meters east/south from the garden anchor. */
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
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  copper: { slot: 'roof', graph: 'metal_copper' },
  gold: { slot: 'trim', graph: 'metal_stainless', metallic: 0.84, roughness: 0.42 },
  textile: { slot: 'trim', graph: 'fabric_canvas' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', metallic: 0.12, roughness: 0.45 },
};
const chalk = [0.88, 0.81, 0.67],
  sandstone = [0.64, 0.54, 0.39],
  brick = [0.42, 0.18, 0.142],
  oxblood = [0.33, 0.075, 0.055],
  wine = [0.29, 0.113, 0.1];
const saffron = [0.76, 0.426, 0.083],
  maize = [0.94, 0.66, 0.2],
  gold = [0.83, 0.6, 0.19],
  jade = [0.31, 0.49, 0.41],
  soot = [0.085, 0.092, 0.093];
const muslin = [0.87, 0.87, 0.78],
  indigo = [0.074, 0.16, 0.31],
  obscured = [0.13, 0.18, 0.17],
  glazing = [0.32, 0.4, 0.37];

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

function hip(o, { w, d, z, y, rise, crest = 0.57, kind = 'tile', color = wine }, level) {
  const wraps =
    level === 0
      ? [
          [0, 1, 1],
          [1, crest, 0.3],
        ]
      : [
          [0, 1, 1],
          [0.33, 0.85, 0.74],
          [0.73, 0.7, 0.42],
          [1, crest, 0.25],
        ];
  loft(
    o,
    kind,
    wraps.map(([h, u, v]) => [
      [(-w * u) / 2, y + h * rise, z + (d * v) / 2],
      [(w * u) / 2, y + h * rise, z + (d * v) / 2],
      [(w * u) / 2, y + h * rise, z - (d * v) / 2],
      [(-w * u) / 2, y + h * rise, z - (d * v) / 2],
    ]),
    color,
  );
  block(o, 'gold', 0, y - 0.07, z + d / 2, w + 0.12, 0.16, 0.14, gold);
  block(o, 'gold', 0, y + rise - 0.05, z, w * crest + 0.17, 0.15, 0.23, gold);
  if (level >= 2) {
    const n = Math.max(8, Math.round(w / (level >= 3 ? 0.78 : 1.3)));
    for (let i = 0; i <= n; i++) {
      const x = (i / n - 0.5) * w;
      for (let j = 1; j < wraps.length; j++) {
        const [a, b, c] = wraps[j - 1],
          [u, v, vz] = wraps[j];
        beam(
          o,
          kind,
          [x * b, y + a * rise + 0.026, z + (d * c) / 2],
          [x * v, y + u * rise + 0.026, z + (d * vz) / 2],
          0.042,
          0.053,
          color,
        );
      }
    }
  }
}

function finial(o, x, y, z, h, level) {
  const profile = [
    [0, 0.27],
    [0.14, 0.29],
    [0.24, 0.18],
    [0.35, 0.24],
    [0.46, 0.17],
    [0.56, 0.18],
    [0.67, 0.11],
    [0.79, 0.13],
    [1, 0.015],
  ];
  loft(
    o,
    'gold',
    profile.map(([a, r]) => radialRing(y + a * h, r * h, r * h, level >= 3 ? 12 : 6, [x, z])),
    gold,
  );
}
function wheel(o, x, y, z, r, level, slot = 'gold', color = gold) {
  const n = level >= 3 ? 24 : 10,
    spokes = 8;
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n,
      b = ((i + 1) * Math.PI * 2) / n;
    beam(
      o,
      slot,
      [x + r * Math.cos(a), y + r * Math.sin(a), z],
      [x + r * Math.cos(b), y + r * Math.sin(b), z],
      0.14 * r,
      0.12 * r,
      color,
    );
  }
  for (let i = 0; i < spokes; i++) {
    const a = (i * Math.PI * 2) / spokes;
    beam(
      o,
      slot,
      [x, y, z],
      [x + 0.91 * r * Math.cos(a), y + 0.91 * r * Math.sin(a), z],
      0.09 * r,
      0.085 * r,
      color,
    );
  }
  sphere(o, slot, [x, y, z], [r * 0.23, r * 0.23, r * 0.15], color, n, 6);
}
function valance(o, w, y, z, d, level) {
  const count = 3;
  for (let i = 0; i < count; i++) {
    const x = w * (i / count - 1 / 3),
      width = w / count;
    block(o, 'textile', x, y, z, width - 0.041, d, 0.045, muslin);
    block(o, 'textile', x, y, z + 0.028, width - 0.025, d * 0.076, 0.04, indigo);
    block(o, 'textile', x, y + d * 0.82, z + 0.029, width - 0.025, d * 0.18, 0.047, indigo);
    if (level < 2) continue;
    const y0 = y + d * 0.46;
    if (i === 1) {
      wheel(o, x, y0, z + 0.056, d * 0.25, level, 'textile', indigo);
      continue;
    }
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) {
        const c = x + (j - 1) * d * 0.145,
          cy = y0 + (k - 1) * d * 0.145,
          s = d * 0.1;
        const ring = [
          [c - s, cy, z + 0.062],
          [c, cy + s, z + 0.062],
          [c + s, cy, z + 0.062],
          [c, cy - s, z + 0.062],
        ];
        for (let m = 0; m < 4; m++)
          beam(o, 'textile', ring[m], ring[(m + 1) % 4], d * 0.042, d * 0.024, indigo);
      }
  }
}

function screen(o, x, y, z, w, h, level, ornate = false) {
  panel(o, 'timber', x, y, z, w + 0.13, h + 0.16, oxblood);
  const slots = ornate ? 5 : 3;
  for (let s = 0; s < slots; s++) {
    const u = x + w * ((s + 0.5) / slots - 0.5),
      width = w / slots - 0.045;
    panel(o, 'textile', u, y + 0.1, z + 0.025, width, h * 0.49, saffron);
    if (ornate && level >= 2) {
      const r = Math.min(width * 0.44, h * 0.2),
        c = y + h * 0.735,
        n = level >= 3 ? 16 : 9;
      for (let p = 0; p < n; p++) {
        const a = (Math.PI * 2 * p) / n,
          b = (Math.PI * 2 * (p + 1)) / n;
        face(
          o,
          'glass',
          [
            [u, c, z + 0.033],
            [u + r * Math.cos(a), c + r * 1.05 * Math.sin(a), z + 0.033],
            [u + r * Math.cos(b), c + r * 1.05 * Math.sin(b), z + 0.033],
          ],
          [0, 0, 1],
          s % 4 === 0 ? obscured : glazing,
        );
      }
    } else
      panel(
        o,
        'glass',
        u,
        y + h * 0.56,
        z + 0.035,
        width,
        h * 0.34,
        s % 3 === 0 ? obscured : glazing,
      );
    if (level >= 2) {
      for (const v of [-0.48, 0.48])
        panel(o, 'timber', u + v * width, y + 0.08, z + 0.053, 0.045, h * 0.91, soot);
      if (!ornate)
        for (const v of [-0.25, 0, 0.25])
          panel(o, 'timber', u + v * width, y + h * 0.57, z + 0.058, 0.021, h * 0.32, sandstone);
    }
  }
  if (level >= 2) panel(o, 'timber', x, y + h * 0.504, z + 0.06, w, 0.086, soot);
}
function beamEnds(o, width, y, z, level) {
  const count = Math.round(width / (level >= 3 ? 0.68 : 1.3));
  for (let i = 0; i < count; i++)
    block(o, 'plaster', width * ((i + 0.5) / count - 0.5), y, z, 0.105, 0.105, 0.096, chalk);
}

function summerPalace(out, b, level) {
  const [x, z] = b.center,
    { width: w, depth: d } = b,
    local = front(out, x, b.floor, z, b.angle);
  const doorZ = d * 0.5 + 0.09;
  solid(out, 'stone', b.outline, [], b.bottom, b.floor, chalk);
  solid(out, 'plaster', b.outline, [], b.floor, b.floor + 8.45, chalk);
  block(local, 'timber', 0, 7.83, 0, w + 0.41, 1.14, d + 0.38, wine);
  block(local, 'stone', 0, 8.95, 0, w + 0.74, 0.19, d + 0.67, chalk);
  if (level > 0) {
    const spacing = w / 7;
    for (let i = 0; i < 7; i++) {
      const u = (i - 3) * spacing;
      for (const y of [0.96, 4.67]) {
        if (i !== 3) screen(local, u, y, doorZ, spacing * 0.79, 2.56, level);
      }
      if (i !== 3) {
        block(local, 'gold', u, 3.74, doorZ + 0.24, spacing * 0.91, 0.19, 1.2, maize);
        block(local, 'gold', u, 7.4, doorZ + 0.24, spacing * 0.91, 0.2, 1.16, maize);
        if (level >= 2)
          sphere(local, 'gold', [u, 8.21, doorZ + 0.199], [0.18, 0.19, 0.068], gold, 8, 4);
      }
    }
    screen(local, 0, 4.5, doorZ + 0.78, w * 0.32, 3.09, level, true);
    beamEnds(local, w, 8.48, doorZ + 0.135, level);
    block(local, 'timber', 0, 0.08, doorZ + 0.031, 2.54, 3.28, 0.14, soot);
    block(local, 'gold', 0, 3.77, doorZ + 0.86, w * 0.39, 0.19, 2.21, gold);
    for (const a of [-0.17, -0.056, 0.056, 0.17]) {
      block(local, 'timber', a * w, 0, doorZ + 1.55, 0.24, 3.74, 0.24, oxblood);
      if (level >= 2) block(local, 'gold', a * w, 3.41, doorZ + 1.55, 0.37, 0.19, 0.37, maize);
    }
    valance(local, w * 0.36, 2.83, doorZ + 1.68, 0.89, level);
    for (let i = 0; i < 4; i++)
      block(local, 'stone', 0, -0.59 + i * 0.147, doorZ + 2.68 - i * 0.25, 6.6, 0.17, 0.92, chalk);
    if (level >= 2) {
      for (const s of [-1, 1]) {
        block(local, 'stone', s * w * 0.345, 0.01, doorZ + 0.87, w * 0.28, 0.49, 0.2, chalk);
        for (let k = 0; k < 7; k++)
          block(
            local,
            'stone',
            s * w * 0.345 + (k - 3) * w * 0.039,
            0.44,
            doorZ + 0.87,
            0.114,
            0.28,
            0.17,
            chalk,
          );
      }
      for (const s of [-1, 1])
        for (let i = 0; i < 5; i++)
          screen(
            front(local, s * (w / 2 + 0.03), 0, 0, (-s * Math.PI) / 2),
            (i - 2) * d * 0.173,
            4.5,
            0.012,
            d * 0.102,
            1.952,
            1,
          );
    }
  }
  hip(
    local,
    {
      w: w * 0.44,
      d: d * 0.31,
      y: 8.1,
      z: doorZ - 0.64,
      rise: 2.02,
      crest: 0.68,
      kind: 'gold',
      color: gold,
    },
    level,
  );
  block(local, 'gold', 0, 10.04, doorZ - 0.64, w * 0.3, 0.48, 1.52, gold);
  if (level > 0) {
    for (const s of [-1, 1]) {
      finial(local, s * w * 0.153, 10.49, doorZ - 0.73, level > 1 ? 1.33 : 0.8, level);
      if (level > 1) {
        const a = s * w * 0.064;
        sphere(local, 'gold', [a, 10.88, doorZ - 0.33], [0.33, 0.19, 0.13], gold, 10, 5);
        beam(
          local,
          'gold',
          [a - s * 0.19, 10.92, doorZ - 0.34],
          [a - s * 0.3, 11.19, doorZ - 0.35],
          0.15,
          0.15,
          gold,
        );
        finial(local, s * w * 0.207, 8.09, doorZ + 2.37, 0.43, level);
      }
    }
    if (level === 1) block(local, 'gold', 0, 10.54, doorZ - 0.12, 0.59, 1.14, 0.24, gold);
    else wheel(local, 0, 11.28, doorZ - 0.11, 0.51, level);
  }
}

function range(out, b, level) {
  solid(
    out,
    'plaster',
    b.outline,
    b.holes,
    b.bottom,
    b.floor + b.height,
    b.kind === 'westCourt' ? sandstone : chalk,
  );
  for (const [i, [x, z]] of b.outline.entries()) {
    const [a, c] = b.outline[(i + 1) % b.outline.length],
      w = Math.hypot(a - x, c - z);
    if (w < 0.2 || level === 0) continue;
    const local = front(out, (x + a) / 2, b.floor, (z + c) / 2, Math.atan2(c - z, a - x) + Math.PI);
    block(local, 'timber', 0, b.height - 0.83, 0, w + 0.19, 0.57, 0.4, wine);
    block(local, 'stone', 0, b.height - 0.23, 0, w + 0.21, 0.18, 0.51, chalk);
    if (
      w < 4 ||
      (level === 1 && b.kind !== 'court') ||
      (level < 3 && Math.sin(b.angle + Math.PI - Math.atan2(c - z, a - x)) < -0.4)
    )
      continue;
    if (level >= 3 && b.kind === 'court') beamEnds(local, w, b.height - 0.48, 0.23, level);
    const n = Math.max(1, Math.round(w / (level <= 2 ? 10.6 : 6.25)));
    for (let j = 0; j < n; j++) {
      const u = w * ((j + 0.5) / n - 0.5);
      screen(local, u, b.height * 0.36, 0.023, Math.min(2.36, (w / n) * 0.64), b.height * 0.28, 1);
      if (level >= 3 && b.kind === 'court')
        screen(local, u, 0.72, 0.037, Math.min(1.81, (w / n) * 0.57), 1.84, 1);
    }
  }
  if (b.kind === 'court' && level !== 0) {
    const local = front(out, ...[b.center[0], b.floor, b.center[1]], b.angle);
    const z = b.depth * 0.5;
    hip(
      local,
      {
        w: Math.min(b.width * 0.51, 19),
        d: Math.min(b.depth * 0.32, 10),
        y: b.height - 0.38,
        z: z - 3.1,
        rise: 1.73,
      },
      level >= 3 ? 2 : 0,
    );
  }
}

function gardenGate(out, b, level) {
  const [x, z] = b.center,
    local = front(out, x, b.floor, z, 0);
  solid(out, 'plaster', b.outline, [], b.bottom, b.floor + 3.8, sandstone);
  hip(
    local,
    { w: 9.4, d: 5.4, z: 4.2, y: 3.59, rise: 0.85, crest: 0.74, kind: 'gold', color: maize },
    level < 3 ? 0 : 2,
  );
  if (level === 0) return;
  block(local, 'timber', 0, 0.03, 3.35, 2.84, 2.76, 0.21, oxblood);
  for (const side of [-1, 1]) {
    block(local, 'timber', side * 3.35, 0, 6.25, 0.22, 3.51, 0.21, oxblood);
    block(local, 'stone', side * 3.35, -0.04, 6.25, 0.38, 0.17, 0.37, chalk);
  }
  valance(local, 8.36, 2.01, 6.26, 1.31, level);
}

function lakePavilion(out, lake, level) {
  const [x, z] = lake.pavilion,
    w = lake.width,
    d = lake.depth;
  solid(out, 'stone', lake.island, [], lake.floor - 3.25, lake.floor, chalk);
  const p = front(out, x, lake.floor, z),
    back = front(out, x, lake.floor, z, Math.PI);
  block(p, 'timber', 0, 0.02, 0, w * 0.69, 2.95, d * 0.66, brick);
  block(p, 'plaster', 0, 2.96, 0, w * 0.77, 1.96, d * 0.79, oxblood);
  block(p, 'gold', 0, 2.74, 0, w + 0.25, 0.21, d + 0.33, maize);
  hip(
    p,
    {
      w: w * 0.98,
      d: d * 1.01,
      y: 4.88,
      z: 0,
      rise: 2.91,
      crest: 0.44,
      kind: 'copper',
      color: jade,
    },
    level,
  );
  if (level >= 1) {
    for (const local of [p, back]) {
      for (const a of [-0.41, -0.15, 0.15, 0.41]) {
        block(local, 'timber', a * w, 0, d * 0.45, 0.24, 2.74, 0.23, brick);
        block(local, 'stone', a * w, 0, d * 0.45, 0.34, 0.21, 0.31, chalk);
      }
      valance(local, w * 0.86, 1.53, d * 0.48, 1.2, level);
      beamEnds(local, w * 0.73, 4.61, d * 0.4, level);
    }
    finial(p, 0, 7.75, 0.12, 1.32, level);
  }
  const cx = lake.bank[0],
    landZ = lake.bank[1],
    start = z + d * 0.41,
    end = landZ + 0.52;
  // The platform and short access ramp form a continuous shore connection above the native water.
  const yNear = lake.floor - 0.12,
    yLand = lake.floor - 1.22,
    half = 1.18;
  const a = [cx - half, yNear, start],
    b = [cx + half, yNear, start],
    c = [cx + half, yLand, end],
    e = [cx - half, yLand, end];
  face(out, 'stone', [a, b, c, e], [0, 1, 0], sandstone);
  for (const [u, v, s] of [
    [a, e, -1],
    [b, c, 1],
  ])
    face(
      out,
      'stone',
      [u, v, [v[0], v[1] - 0.36, v[2]], [u[0], u[1] - 0.36, u[2]]],
      [s, 0, 0],
      sandstone,
    );
  if (level > 0)
    for (const s of [-1, 1]) {
      const x = cx + half * s;
      beam(out, 'stone', [x, yNear + 0.69, start], [x, yLand + 0.69, end], 0.14, 0.17, chalk);
      const n = level >= 3 ? 22 : level === 2 ? 12 : 5;
      for (let i = 0; i <= n; i++) {
        const t = i / n,
          y = yNear + (yLand - yNear) * t,
          z = start + (end - start) * t;
        block(out, 'stone', x, y, z, 0.19, 0.69, 0.18, chalk);
      }
    }
}
function build(out, level) {
  for (const b of layout.buildings) {
    if (b.kind === 'newPalace') summerPalace(out, b, level);
    else if (b.kind === 'gate') gardenGate(out, b, level);
    else range(out, b, level);
  }
  lakePavilion(out, layout.lake, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
