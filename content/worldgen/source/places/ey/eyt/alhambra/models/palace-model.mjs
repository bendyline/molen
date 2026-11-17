/** The Alcazaba, Nasrid courts and Charles V Palace, fitted to Granada’s ridge. */
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
  masonry: { slot: 'wall', graph: 'stone_ashlar' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  marble: { slot: 'trim', graph: 'stone_marble' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  mosaic: { slot: 'trim', graph: 'tile_mosaic' },

  pool: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.2, metallic: 0.23 },
};
const ochre = [0.68, 0.432, 0.29],
  red = [0.64, 0.335, 0.226],
  chalk = [0.88, 0.793, 0.622],
  light = [0.84, 0.764, 0.63];
const trim = [0.66, 0.536, 0.378],
  stone = [0.57, 0.465, 0.369],
  deep = [0.26, 0.167, 0.111],
  tile = [0.53, 0.235, 0.164];
const wood = [0.25, 0.164, 0.113],
  door = [0.21, 0.15, 0.115],
  pool = [0.2, 0.39, 0.358],
  green = [0.24, 0.38, 0.24],
  blue = [0.26, 0.42, 0.52];

function face(o, k, p, n, color) {
  if (normalFor(...p).reduce((sum, v, i) => sum + v * n[i], 0) < 0) p = [...p].reverse();
  if (p.length === 3) o.addTriangle(k, '', p, normalFor(...p), [], color);
  else o.addQuad(k, '', p, normalFor(...p), [], color);
}
const block = (o, k, x, y, z, w, h, d, t) =>
  box(o, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], t);
const solid = (o, k, outline, holes, y0, y1, tint) =>
  prism((k, p, n) => face(o, k, p, n, tint), k, { outline, holes }, y0, y1, false);

function frame(out, x, y, z, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    n = ([a, b, d]) => [a * c - d * s, b, a * s + d * c];
  const p = (v) => n(v).map((value, i) => value + [x, y, z][i]);
  return {
    addTriangle: (k, r, v, m, u, t) => out.addTriangle(k, r, v.map(p), n(m), u, t),
    addQuad: (k, r, v, m, u, t) => out.addQuad(k, r, v.map(p), n(m), u, t),
    addConvexPolygon: (k, r, v, m, u, t) => out.addConvexPolygon(k, r, v.map(p), n(m), u, t),
  };
}
function panel(o, k, x, y, z, w, h, color) {
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
    color,
  );
}
function loftRect(o, k, w, d, y, steps, color) {
  loft(
    o,
    k,
    steps.map(([h, a, b]) => [
      [(-w * a) / 2, y + h, (d * b) / 2],
      [(w * a) / 2, y + h, (d * b) / 2],
      [(w * a) / 2, y + h, (-d * b) / 2],
      [(-w * a) / 2, y + h, (-d * b) / 2],
    ]),
    color,
  );
}
function bars(o, x, y, z, w, h, level, slots) {
  if (level <= 1) return;
  for (let i = 1; i < slots; i++)
    panel(o, 'timber', x + w * (i / slots - 0.5), y, z, 0.045, h, wood);
  if (level >= 3) for (const f of [0.32, 0.65]) panel(o, 'timber', x, y + h * f, z, w, 0.042, wood);
}
function window(o, x, y, z, w, h, level, kind = 'timber') {
  const steps = level >= 3 ? 11 : level >= 2 ? 7 : 4;
  panel(o, 'marble', x, y - 0.13, z - 0.003, w + 0.2, h * 0.64, trim);
  panel(o, kind, x, y, z + 0.013, w, h * 0.66, door);
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * i) / steps,
      b = (Math.PI * (i + 1)) / steps;
    const u = [x + Math.cos(a) * w * 0.5, y + h * 0.66 + Math.sin(a) * h * 0.34, z + 0.012];
    const v = [x + Math.cos(b) * w * 0.5, y + h * 0.66 + Math.sin(b) * h * 0.34, z + 0.012];
    face(o, kind, [[x, y + h * 0.66, z + 0.012], u, v], [0, 0, 1], door);
  }
  bars(o, x, y, z + 0.04, w, h * 0.67, level, 4);
}
function arch(o, x, y, z, w, rise, spring, depth, level, slot = 'plaster', color = chalk) {
  const count = level >= 3 ? 15 : level >= 2 ? 7 : level === 1 ? 5 : 3;
  const outer = y + spring + rise + 0.29;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * i) / count,
      b = (Math.PI * (i + 1)) / count;
    const p = [x - (Math.cos(a) * w) / 2, y + spring + Math.sin(a) * rise],
      q = [x - (Math.cos(b) * w) / 2, y + spring + Math.sin(b) * rise];
    for (const side of [-1, 1]) {
      const k = z + (side * depth) / 2;
      face(
        o,
        slot,
        [
          [p[0], p[1], k],
          [q[0], q[1], k],
          [q[0], outer, k],
          [p[0], outer, k],
        ],
        [0, 0, side],
        color,
      );
      if (level >= 3 && side === 1)
        face(
          o,
          'marble',
          [
            [p[0], p[1] + 0.06, k + 0.016],
            [q[0], q[1] + 0.06, k + 0.016],
            [q[0], q[1] + 0.13, k + 0.016],
            [p[0], p[1] + 0.13, k + 0.016],
          ],
          [0, 0, 1],
          trim,
        );
    }
    face(
      o,
      slot,
      [
        [p[0], p[1], z - depth / 2],
        [q[0], q[1], z - depth / 2],
        [q[0], q[1], z + depth / 2],
        [p[0], p[1], z + depth / 2],
      ],
      [0, -1, 0],
      trim,
    );
  }
}
function column(o, x, y, z, h, r, level) {
  if (level === 1) return block(o, 'marble', x, y, z, r * 1.65, h, r * 1.65, light);
  const n = level >= 3 ? 9 : 6;
  loft(
    o,
    'marble',
    [
      [0, 1.32],
      [0.075, 1.15],
      [0.13, 0.91],
      [0.86, 0.81],
      [0.92, 1.18],
      [1, 1.38],
    ].map(([v, k]) => radialRing(y + h * v, r * k, r * k, n, [x, z])),
    light,
  );
}

function tower(out, b, level) {
  const top = b.floor + b.height,
    [x, z] = b.center,
    { width: w, depth: d } = b,
    o = frame(out, x, b.floor, z, b.angle);
  solid(out, 'masonry', b.outline, b.holes, b.bottom, top, b.kind === 'comares' ? ochre : red);
  if (level === 0) {
    if (b.name === 'Torre de la Vela') block(o, 'masonry', 0, b.height, 0, 4.7, 3.3, 1.7, ochre);
    return;
  }
  if (level === 1 && b.name !== 'Torre de la Vela' && b.kind !== 'comares') return;
  if (
    level === 2 &&
    b.name !== 'Torre de la Vela' &&
    b.kind !== 'comares' &&
    b.width * b.depth < 130
  )
    return;
  block(o, 'masonry', 0, b.height - 0.52, 0, w + 0.44, 0.33, d + 0.46, ochre);
  for (const s of [-1, 1]) {
    const positions = level >= 3 ? Math.max(3, Math.round(w / 2.0)) : level === 1 ? 3 : 5;
    for (let i = 0; i < positions; i++) {
      const a = w * ((i + 0.5) / positions - 0.5);
      block(o, 'masonry', a, b.height, s * d * 0.468, 0.76, 1.12, 0.62, ochre);
    }
    const g = frame(o, 0, 0, s * d * 0.5, s === 1 ? 0 : Math.PI);
    for (const f of b.kind === 'comares' ? [0.47, 0.71] : level >= 3 ? [0.55] : [])
      for (const a of level >= 3 ? [-0.23, 0, 0.23] : [0])
        window(
          g,
          w * a,
          b.height * f,
          0.06,
          b.kind === 'comares' ? 0.7 : Math.min(0.42, w * 0.07),
          b.kind === 'comares' ? 2.12 : 1.45,
          level,
        );
    if (level >= 3)
      for (let i = 0; i < 3; i++)
        block(
          o,
          'masonry',
          s * w * 0.468,
          b.height,
          d * ((i + 0.5) / 3 - 0.5),
          0.62,
          1.12,
          0.85,
          ochre,
        );
  }
  if (b.name === 'Torre de la Vela') {
    block(o, 'masonry', 0, b.height - 0.02, 0, 4.84, 3.75, 1.83, ochre);
    arch(o, 0, b.height + 0.04, 0.94, 2.76, 0.68, 1.57, 0.2, level, 'masonry', ochre);
    block(o, 'timber', 0, b.height + 0.41, 0.96, 2.25, 1.5, 0.12, wood);
    if (level >= 2) {
      loft(
        o,
        'timber',
        [
          [0, 0.3],
          [0.2, 0.44],
          [0.48, 0.26],
          [0.61, 0.22],
        ].map(([y, r]) => radialRing(b.height + 0.87 + y, r, r, 10, [0, 1.015])),
        wood,
      );
      beam(o, 'timber', [0, b.height + 3.61, 0.34], [0, b.height + 6.84, 0.34], 0.06, 0.06, wood);
    }
  } else if (b.name === 'Peinador de la Reina')
    loftRect(
      o,
      'tile',
      w * 0.9,
      d * 0.95,
      b.height - 0.27,
      [
        [0, 1, 1],
        [1.85, 0.71, 0.13],
      ],
      tile,
    );
}
function house(out, b, level) {
  const top = b.floor + b.height,
    [x, z] = b.center,
    { width: w, depth: d } = b,
    o = frame(out, x, b.floor, z, b.angle);
  solid(
    out,
    'plaster',
    b.outline,
    b.holes,
    b.bottom,
    top,
    b.kind === 'church' ? [0.68, 0.51, 0.39] : [0.74, 0.6, 0.448],
  );
  loftRect(
    o,
    'tile',
    w * 0.93,
    d * 0.87,
    b.height - 0.07,
    [
      [0, 1, 1],
      [Math.min(3.75, 1 + d * 0.1), 0.76, 0.035],
    ],
    tile,
  );
  if (level === 0) return;
  for (const s of [-1, 1]) {
    const p = frame(o, 0, 0, s * d * 0.487, s === 1 ? 0 : Math.PI);
    block(p, 'timber', 0, b.height - 0.46, 0.012, w * 0.89, 0.18, 0.23, wood);
    if (level >= 2) {
      const n = Math.min(9, Math.max(2, Math.round(w / 4.1)));
      for (let i = 0; i < n; i++)
        window(
          p,
          w * 0.86 * ((i + 0.5) / n - 0.5),
          b.height * 0.46,
          0.059,
          Math.min(1.15, (w / n) * 0.55),
          b.height * 0.25,
          level,
        );
    }
  }
  if (b.kind === 'church') {
    const y = b.height;
    block(o, 'masonry', w * 0.26, y - 4.2, 0, 6.2, 10.4, 6.4, ochre);
    loftRect(
      frame(o, w * 0.26, 0, 0),
      'tile',
      6.54,
      6.76,
      y + 6.16,
      [
        [0, 1, 1],
        [3.91, 0.045, 0.05],
      ],
      tile,
    );
    if (level >= 2) {
      window(o, w * 0.26, y + 2.1, 3.22, 1.54, 2.98, level);
      beam(o, 'timber', [w * 0.26, y + 9.85, 0], [w * 0.26, y + 11.34, 0], 0.11, 0.1, wood);
      beam(
        o,
        'timber',
        [w * 0.26 - 0.49, y + 10.8, 0],
        [w * 0.26 + 0.49, y + 10.8, 0],
        0.09,
        0.09,
        wood,
      );
    }
  }
}

function wall(out, run, level) {
  const dx = run.b[0] - run.a[0],
    dz = run.b[1] - run.a[1],
    length = Math.hypot(dx, dz);
  const width = run.hi[0] - run.lo[0] > 16 ? 1.47 : 1.06,
    ux = ((-dz / length) * width) / 2,
    uz = ((dx / length) * width) / 2;
  const [aa, ab] = run.a,
    [ba, bb] = run.b,
    [ya, yb] = run.lo,
    [ha, hb] = run.hi;
  const a = [aa + ux, ya, ab + uz],
    b = [ba + ux, yb, bb + uz],
    c = [ba + ux, hb, bb + uz],
    d = [aa + ux, ha, ab + uz];
  const e = [aa - ux, ya, ab - uz],
    f = [ba - ux, yb, bb - uz],
    g = [ba - ux, hb, bb - uz],
    h = [aa - ux, ha, ab - uz];
  face(out, 'masonry', [a, b, c, d], [ux, 0, uz], ochre);
  face(out, 'masonry', [e, f, g, h], [-ux, 0, -uz], red);
  face(out, 'masonry', [d, c, g, h], [0, 1, 0], trim);
  face(out, 'masonry', [a, d, h, e], [-dx, 0, -dz], red);
  face(out, 'masonry', [b, f, g, c], [dx, 0, dz], red);
  if (level >= 1) {
    const n = Math.min(38, Math.round(length / (level === 1 ? 8.2 : 2.55)));
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n,
        x = aa + dx * u,
        z = ab + dz * u,
        y = ha + (hb - ha) * u;
      const o = frame(out, x, y, z, Math.atan2(dz, dx));
      block(o, 'masonry', 0, -0.06, 0, 0.88, 1.08, width * 0.88, ochre);
    }
  }
}
function gate(out, g, level) {
  const { width: w, depth: d, height: h } = g,
    [x, z] = g.center;
  const o = frame(out, x, g.floor, z, g.angle),
    opening = Math.min(w * 0.41, 4.35),
    spring = h * 0.208,
    rise = opening * 0.48;
  arch(o, 0, 0, 0, opening, rise, spring, d, level >= 2 ? level : 0, 'masonry', ochre);
  for (const s of [-1, 1])
    block(o, 'masonry', s * (w + opening) * 0.25, -0.63, 0, (w - opening) / 2, h + 0.63, d, red);
  block(o, 'masonry', 0, spring + rise + 0.28, 0, w, h - (spring + rise + 0.28), d, ochre);
  if (level === 0) return;
  block(o, 'masonry', 0, h - 0.28, 0, w + 0.52, 0.28, d + 0.52, trim);
  for (const s of [-1, 1]) {
    const q = frame(o, 0, 0, s * (d * 0.5 + 0.032), s === 1 ? 0 : Math.PI);

    for (const u of [-1, 1])
      block(q, 'marble', u * (opening / 2 + 0.125), 0.01, 0, 0.21, spring + 0.16, 0.4, trim);
    if (level >= 3)
      for (const u of [-1, 0, 1]) window(q, u * w * 0.225, h * 0.59, 0.036, 0.32, 1.05, level);
    if (g.name === 'Puerta del Vino') {
      panel(q, 'mosaic', 0, spring + rise + 0.62, 0.046, opening * 0.89, 0.32, blue);
      loftRect(
        o,
        'tile',
        w + 0.52,
        d + 0.52,
        h,
        [
          [0, 1, 1],
          [1.36, 0.72, 0.04],
        ],
        tile,
      );
    } else if (level >= 2) {
      panel(q, 'marble', 0, spring + rise + 0.84, 0.025, 0.92, 0.57, light);
      beam(
        q,
        'mosaic',
        [-0.32, spring + rise + 1.12, 0.048],
        [0.32, spring + rise + 1.12, 0.048],
        0.058,
        0.044,
        blue,
      );
    }
    if (level >= 3 && g.name === 'Puerta de la Justicia')
      for (let j = 0; j < 6; j++)
        block(q, 'masonry', w * ((j + 0.5) / 6 - 0.5), h - 0.045, 0, 0.71, 0.92, 1.0, ochre);
  }
}

function arcades(o, width, z, count, level, depth = 1.9) {
  const spacing = width / count;
  const h = level >= 2 ? 2.43 : 2.51;
  for (let i = 0; i <= count; i++) {
    const x = width * (i / count - 0.5);
    column(o, x, 0, z, h, 0.14, level <= 2 ? 1 : level);
    if (level >= 3 && i % 3 === 0) column(o, x + 0.38, 0, z, h, 0.1, level);
    if (i === count) continue;
    const a = x + spacing * 0.5;
    if (level === 1) block(o, 'plaster', a, h - 0.12, z, spacing + 0.1, 0.42, 0.42, chalk);
    else arch(o, a, 0.02, z, spacing - 0.22, 0.76, h - 0.12, 0.42, level === 2 ? 1 : level);
    const color = i % 3 === 0 ? ochre : trim;
    if (level >= 2) {
      panel(o, 'mosaic', a, h + 0.91, z + 0.23, spacing * 0.53, 0.085, color);
      block(o, 'timber', a, h + 0.94, z, spacing + 0.02, 0.13, 0.54, wood);
    }
  }
  const p = frame(o, 0, 0, z - Math.sign(z) * depth * 0.46);
  loftRect(
    p,
    'tile',
    width + 0.57,
    depth,
    3.45,
    [
      [0, 1, 1],
      [0.88, 0.96, 0.07],
    ],
    tile,
  );
}
function lionsCourt(out, level) {
  const c = layout.lions,
    [x, z] = c.center,
    o = frame(out, x, c.floor, z, c.angle),
    w = c.width,
    d = c.depth;
  const base = level === 0 ? 0.07 : 0.17;
  solid(out, 'marble', c.outline, [], c.floor - 0.67, c.floor + base, light);
  if (level === 0) return;
  for (const s of [-1, 1]) {
    const row = frame(o, 0, 0.16, s * (d * 0.5 - 0.44), s === 1 ? Math.PI : 0);
    arcades(row, w - 1.54, 0, level === 1 ? 4 : level === 2 ? 7 : 14, level, 2.12);
    const edge = frame(o, s * (w * 0.5 - 2.51), 0.17, 0, (-s * Math.PI) / 2);
    arcades(edge, d - 2.38, 0, level === 1 ? 2 : level === 2 ? 4 : 8, level, 2.41);
    const pavilion = frame(o, s * (w * 0.5 - 1.45), 0, 0, (-s * Math.PI) / 2);
    loftRect(
      pavilion,
      'tile',
      5.63,
      5.58,
      3.36,
      [
        [0, 1, 1],
        [2.01, 0.68, 0.05],
      ],
      tile,
    );
    for (const u of [-1, 1])
      for (const v of [-1, 1])
        column(pavilion, u * 2.3, 0.15, v * 2.2, 3.19, 0.137, level <= 2 ? 1 : level);
  }
  const [fx, fz] = c.fountain;
  const n = level >= 3 ? 24 : level === 2 ? 10 : 6;
  const ring = (h, r) => radialRing(c.floor + h, r, r, n, [fx, fz]);
  loft(
    out,
    'marble',
    [
      [0.16, 1.91],
      [0.31, 1.91],
      [0.43, 1.65],
      [0.49, 1.5],
    ].map(([h, r]) => ring(h, r)),
    trim,
  );
  loft(
    out,
    'marble',
    [
      [0.42, 0.61],
      [0.68, 0.54],
      [0.85, 1.17],
      [1.03, 1.59],
      [1.16, 1.76],
      [1.22, 1.77],
    ].map(([h, r]) => ring(h, r)),
    light,
  );
  loft(out, 'pool', [ring(1.231, 1.62), ring(1.238, 1.62)], pool);
  if (level >= 2) {
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        p = frame(out, fx, c.floor + 0.2, fz, a),
        radius = 1.41;
      const n = level >= 3 ? 10 : 6;
      sphere(p, 'marble', [0, 0.39, radius], [0.19, 0.25, 0.46], light, n, 5);
      sphere(p, 'marble', [0, 0.49, radius + 0.31], [0.19, 0.23, 0.22], chalk, n, 5);
      for (const s of [-1, 1])
        for (const t of [-1, 1])
          block(p, 'marble', s * 0.124, 0.06, radius + t * 0.27, 0.13, 0.3, 0.12, light);
      if (level >= 3) {
        for (const s of [-1, 1])
          sphere(p, 'marble', [s * 0.12, 0.64, radius + 0.32], [0.083, 0.099, 0.063], light, 7, 4);
        block(p, 'marble', 0, 0.35, radius + 0.45, 0.21, 0.13, 0.15, trim);
      }
    }
    for (const [dx, dz, len] of [
      [0, -5.38, 5.28],
      [0, 5.38, 5.28],
      [-8.98, 0, 9.18],
      [8.98, 0, 9.18],
    ])
      block(
        o,
        'pool',
        dx,
        0.176,
        dz,
        Math.abs(dx) > 1 ? len : 0.16,
        0.022,
        Math.abs(dz) > 1 ? len : 0.16,
        pool,
      );
  }
}

function myrtlesCourt(out, level) {
  const c = layout.myrtles,
    [x, z] = c.center,
    w = c.width,
    d = c.depth,
    o = frame(out, x, c.floor, z, c.angle);
  solid(out, 'marble', c.outline, [c.water], c.floor - 0.77, c.floor + 0.18, trim);
  solid(out, 'pool', c.water, [], c.floor - 0.32, c.floor + 0.037, pool);
  const mx = (c.water[0][0] + c.water[2][0]) / 2,
    mz = (c.water[0][1] + c.water[2][1]) / 2;
  for (const s of [-1, 1]) {
    block(out, 'marble', mx + s * 3.92, c.floor + 0.04, mz, 0.31, 0.21, 34.3, light);
    block(out, 'marble', mx, c.floor + 0.04, mz + s * 17.16, 7.88, 0.18, 0.31, light);
    block(out, 'mosaic', mx + s * 5.15, c.floor + 0.19, mz, 1.32, 0.57, 28.7, green);
    if (level >= 3)
      for (let i = 0; i < 15; i++) {
        const z = mz + 28 * ((i + 0.5) / 15 - 0.5);
        sphere(
          out,
          'mosaic',
          [mx + s * 5.15, c.floor + 0.73, z],
          [0.7, 0.32, 0.99],
          green,
          level >= 3 ? 8 : 5,
          4,
        );
      }
    if (level > 0) {
      const p = frame(o, s * (w * 0.5 - 0.82), 0.18, 0, (-s * Math.PI) / 2);
      arcades(p, d - 0.9, 0, level === 1 ? 2 : level === 2 ? 4 : 7, level, 2.05);
    }
  }
}
function charlesPalace(out, level) {
  const c = layout.carlos,
    { width: w, depth: d, height: h } = c,
    [x, z] = c.center,
    o = frame(out, x, c.floor, z, c.angle);
  const n = level === 0 ? 14 : level === 1 ? 16 : level === 2 ? 24 : 52;
  const circle = (r) =>
    Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * Math.PI * 2) / n) + x,
      r * Math.sin((i * Math.PI * 2) / n) + z,
    ]);
  const lower = 15.64,
    upper = 19.84;
  solid(out, 'masonry', c.outline, [circle(upper)], c.floor - 0.42, c.floor + h, stone);
  solid(out, 'marble', circle(upper), [], c.floor - 0.82, c.floor + 0.09, trim);
  if (level >= 2)
    solid(
      out,
      'masonry',
      circle(upper + 0.16),
      [circle(lower)],
      c.floor + 7.48,
      c.floor + 8.18,
      light,
    );
  if (level >= 2)
    solid(
      out,
      'masonry',
      circle(upper + 0.16),
      [circle(lower)],
      c.floor + h - 0.12,
      c.floor + h + 0.42,
      trim,
    );
  if (level === 0) return;
  const columns = level === 1 ? 5 : level === 2 ? 12 : 32;
  for (let i = 0; i < columns; i++) {
    const t = (Math.PI * 2 * i) / columns,
      a = -Math.sin(t),
      b = Math.cos(t),
      cx = x + lower * Math.cos(t),
      cz = z + lower * Math.sin(t);
    const p = frame(out, cx, c.floor, cz, Math.atan2(b, a));
    column(p, 0, 0.13, 0, 7.43, 0.47, level === 2 ? 1 : level);
    column(p, 0, 8.12, 0, 8.85, 0.415, level === 2 ? 1 : level);
    if (level >= 2) {
      const theta = (Math.PI * 2 * (i + 0.5)) / columns;
      const wall = frame(
        out,
        x + upper * Math.cos(theta),
        c.floor,
        z + upper * Math.sin(theta),
        Math.atan2(Math.cos(theta), -Math.sin(theta)) + Math.PI,
      );
      window(wall, 0, 0.15, 0.062, 2.05, 4.46, level);
      window(wall, 0, 8.26, 0.057, 1.95, 4.04, level);
    }
  }
  if (level <= 2) return;
  for (const [a, width, depth] of [
    [0, w, d],
    [Math.PI / 2, d, w],
    [Math.PI, w, d],
    [-Math.PI / 2, d, w],
  ]) {
    const p = frame(o, 0, 0, 0, a),
      k = frame(p, 0, 0, depth * 0.5);
    block(k, 'marble', 0, 7.54, 0, width + 0.29, 0.32, 0.66, trim);
    block(k, 'marble', 0, h - 0.8, 0, width + 0.48, 0.62, 0.79, trim);
    const bays = level >= 3 ? 9 : 4;
    for (let i = 0; i < bays; i++) {
      const u = width * 0.92 * ((i + 0.5) / bays - 0.5);
      window(k, u, 1.32, 0.049, 2.15, 4.35, level);
      window(k, u, 9.5, 0.052, 2.36, 5.0, level);
      if (level >= 3) {
        block(k, 'marble', u, 14.4, 0.11, 3.15, 0.38, 0.37, light);
        block(k, 'masonry', u + 2.93, 0.24, 0.02, 0.61, 7.1, 0.35, trim);
        for (let j = 1; j < 5; j++)
          panel(k, 'masonry', u, 1.24 * j, 0.021, (width / bays) * 0.68, 0.043, deep);
      }
    }
  }
}
function build(out, level) {
  for (const b of layout.buildings) {
    if (
      level <= 1 &&
      b.width * b.depth < (level === 0 ? 78 : 40) &&
      !['Torre de Machuca', 'Torre de las Damas'].includes(b.name)
    )
      continue;
    if (b.kind === 'tower' || b.kind === 'comares') tower(out, b, level);
    else if (level > 0 || b.width > 21) house(out, b, level);
  }
  for (const wallLine of layout.walls)
    for (const run of wallLine.runs)
      if (
        level >= 3 ||
        run.b.some((n, i) => Math.abs(n - run.a[i]) > (level === 0 ? 27 : level === 1 ? 13 : 5.0))
      )
        wall(out, run, level);
  for (const g of layout.gates) gate(out, g, level);
  charlesPalace(out, level);
  lionsCourt(out, level);
  myrtlesCourt(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
