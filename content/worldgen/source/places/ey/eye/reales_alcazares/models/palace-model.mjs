/** Real Alcázar exterior, Mudéjar courts, and east garden galleries. Meter-scale. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_ashlar' },
  lime: { slot: 'wall', graph: 'plaster_lime' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  marble: { slot: 'foundation', graph: 'stone_marble' },
  mosaic: { slot: 'trim', graph: 'tile_mosaic' },
  timber: { slot: 'door', graph: 'wood_plain' },
  garden: { slot: 'foundation', graph: 'gravel' },
  water: { slot: 'foundation', graph: 'stone_limestone_weathered' },
};
const buff = [0.74, 0.57, 0.38],
  plaster = [0.79, 0.69, 0.53],
  red = [0.55, 0.19, 0.122],
  cream = [0.83, 0.78, 0.67];
const shaded = [0.44, 0.34, 0.224],
  orange = [0.49, 0.23, 0.14],
  green = [0.25, 0.44, 0.31],
  water = [0.18, 0.3, 0.275];
const brown = [0.22, 0.14, 0.085],
  blue = [0.2, 0.37, 0.51];
function face(out, slot, p, n, color) {
  const a = normalFor(...p);
  const q = a.reduce((s, v, i) => s + v * n[i], 0) < 0 ? [...p].reverse() : p;
  const m = normalFor(...q);
  if (q.length === 3) out.addTriangle(slot, '', q, m, [], color);
  else out.addQuad(slot, '', q, m, [], color);
}
function solid(out, slot, outline, holes, lo, hi, color) {
  prism((role, p, n) => face(out, role, p, n, color), slot, { outline, holes }, lo, hi, false);
}
const block = (out, k, x, y, z, w, h, d, c) =>
  box(out, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], c);
function frame(out, x, y, z, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  const n = ([u, v, w]) => [c * u - s * w, v, s * u + c * w];
  const p = (v) => n(v).map((v, i) => v + [x, y, z][i]);
  return {
    addTriangle: (k, r, v, m, uv, t) => out.addTriangle(k, r, v.map(p), n(m), uv, t),
    addQuad: (k, r, v, m, uv, t) => out.addQuad(k, r, v.map(p), n(m), uv, t),
    addConvexPolygon: (k, r, v, m, uv, t) => out.addConvexPolygon(k, r, v.map(p), n(m), uv, t),
  };
}
function panel(out, slot, x, y, z, w, h, color) {
  face(
    out,
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
function hip(out, w, d, y, h, level, color = orange) {
  const x = w / 2,
    z = d / 2,
    p = [
      [-x, y, -z],
      [x, y, -z],
      [x, y, z],
      [-x, y, z],
    ];
  const ridge = Math.max(x * 0.3, x - d * 0.37),
    a = [-ridge, y + h, 0],
    b = [ridge, y + h, 0];
  face(out, 'tile', [p[0], p[1], b, a], [0, 1, -1], color);
  face(out, 'tile', [p[3], p[2], b, a], [0, 1, 1], color);
  face(out, 'tile', [p[0], p[3], a], [-1, 1, 0], color);
  face(out, 'tile', [p[1], p[2], b], [1, 1, 0], color);
  if (level > 1) block(out, 'tile', 0, y + h - 0.02, 0, ridge * 2 + 0.17, 0.14, 0.23, color);
}
function arch(
  out,
  x,
  y,
  z,
  w,
  h,
  d,
  level,
  { slot = 'lime', color = plaster, scalloped = false } = {},
) {
  const count =
    level === 0 ? 3 : level === 1 ? 5 : scalloped ? (level === 4 ? 35 : level === 3 ? 24 : 12) : 9;
  const sample = (t) => {
    const a = Math.PI * t,
      u = Math.cos(a);
    const fluting =
      scalloped && level >= 2 ? 0.047 * Math.abs(Math.sin(a * (level === 4 ? 19 : 11))) : 0;
    return [x - w * 0.5 * u, y + h * (0.59 + Math.sin(a) * (0.41 - fluting))];
  };
  const crown = y + h + 0.28;
  for (let i = 0; i < count; i++) {
    const a = sample(i / count),
      b = sample((i + 1) / count);
    for (const side of [-1, 1]) {
      const q = z + (side * d) / 2;
      face(
        out,
        slot,
        [
          [a[0], a[1], q],
          [b[0], b[1], q],
          [b[0], crown, q],
          [a[0], crown, q],
        ],
        [0, 0, side],
        color,
      );
      if (level >= 3 && scalloped) {
        face(
          out,
          'mosaic',
          [
            [a[0], a[1] + 0.024, q + side * 0.014],
            [b[0], b[1] + 0.024, q + side * 0.014],
            [b[0], b[1] + 0.077, q + side * 0.014],
            [a[0], a[1] + 0.077, q + side * 0.014],
          ],
          [0, 0, side],
          buff,
        );
      }
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
      shaded,
    );
  }
}
function cornice(out, x, y, z, w, d, color) {
  block(out, 'lime', x, y, z, w, 0.18, d, color);
}
function column(out, x, y, z, h, r, level) {
  if (level < 2) return block(out, 'marble', x, y, z, r * 2, h, r * 2, cream);
  const n = level >= 3 ? 9 : 5;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    const p = [x + r * Math.cos(a), y, z + r * Math.sin(a)],
      q = [x + r * Math.cos(b), y, z + r * Math.sin(b)];
    face(
      out,
      'marble',
      [p, q, [q[0], y + h, q[2]], [p[0], y + h, p[2]]],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
      cream,
    );
  }
  if (level >= 3)
    for (const v of [y, y + h - 0.14])
      block(out, 'marble', x, v, z, r * 2.86, 0.14, r * 2.86, buff);
}
function crenels(out, w, d, y, level) {
  if (level === 0) return;
  const count = Math.round(w / (level >= 3 ? 1.04 : 1.55));
  for (let i = 0; i < count; i++) {
    const x = w * ((i + 0.5) / count - 0.5);
    block(out, 'masonry', x, y, d / 2, 0.51, 0.64, 0.57, buff);
  }
}
function lion(out, level) {
  const g = layout.lion;
  const [x, z] = g.point;
  const local = frame(out, x + 2.1, g.base, z + 0.4, Math.PI);
  const w = g.portalWidth,
    d = g.portalDepth,
    op = 2.85,
    h = 8.45;
  arch(local, 0, 0, 0, op, 4.05, d, level, { slot: 'masonry', color: buff });
  const side = (w - op) / 2;
  for (const sign of [-1, 1]) {
    block(local, 'lime', (sign * (op + side)) / 2, -0.8, 0, side, h + 0.8, d, red);
    if (level >= 1)
      block(local, 'masonry', sign * (w / 2 + 0.92), -0.55, 0, 1.92, 10.4, d + 0.36, buff);
  }
  block(local, 'lime', 0, 4.33, 0, w, 4.12, d, red);
  cornice(local, 0, h - 0.16, 0, w + 0.47, d + 0.38, buff);
  crenels(local, w, d, h, level);
  if (level >= 1) {
    panel(local, 'marble', 0, 5.04, d / 2 + 0.036, 1.41, 0.96, cream);
    panel(local, 'mosaic', 0, 5.16, d / 2 + 0.048, 1.16, 0.71, buff);
    panel(local, 'mosaic', 0.2, 5.32, d / 2 + 0.06, 0.68, 0.14, brown);
    panel(local, 'mosaic', -0.22, 5.46, d / 2 + 0.061, 0.2, 0.37, brown);
  }
  for (const f of g.flanks) {
    const {
      center: [xx, zz],
      width,
      depth,
      angle,
    } = f.box;
    const p = frame(out, xx, g.base, zz, angle);
    block(p, 'masonry', 0, -1.15, 0, width, 10.9, depth, buff);
    if (level >= 1) {
      cornice(p, 0, 9.58, 0, width + 0.2, depth + 0.2, plaster);
      crenels(p, width, depth, 9.75, level);
    }
  }
  // Historic flanking walls meet the red gate wings beyond the opening.
  const wall = frame(out, x - 8.1, g.base, z + 2.0, 0.13);
  block(wall, 'masonry', 0, -1.0, 0, 6.05, 10.0, 6.04, buff);
  crenels(wall, 6.05, 6.04, 9, level);
}
function building(out, b, level) {
  const high = b.floor + b.height;
  const slot = b.kind === 'wall' ? 'masonry' : 'lime';
  const tone = b.kind === 'justice' ? [0.66, 0.49, 0.3] : b.kind === 'wall' ? buff : plaster;
  if (level === 0 && ['residence', 'wall', 'justice'].includes(b.kind)) {
    if (b.outline.length > 11) solid(out, slot, b.outline, [], b.floor - 0.6, high, tone);
    return;
  }
  solid(out, slot, b.outline, b.holes, b.bottom, high, tone);
}
function portal(out, b, level) {
  const { w, h, d } = b,
    opening = w * 0.23;
  arch(out, 0, 0, 0, opening, h * 0.52, d, level, { scalloped: true, color: plaster });
  for (const sign of [-1, 1])
    block(out, 'lime', (sign * (w + opening)) / 4, 0, 0, (w - opening) / 2, h, d, plaster);
  block(out, 'lime', 0, h * 0.52 + 0.28, 0, w, h * 0.48 - 0.28, d, plaster);
  if (level > 0) {
    const z = d / 2 + 0.028;
    panel(out, 'mosaic', 0, h * 0.69, z, w * 0.54, h * 0.19, blue);
    panel(out, 'mosaic', 0, h * 0.63, z + 0.015, w * 0.62, h * 0.042, green);
    for (const sign of [-1, 1]) {
      panel(out, 'mosaic', sign * w * 0.388, h * 0.39, z, w * 0.19, h * 0.41, [0.59, 0.52, 0.33]);
      panel(out, 'marble', sign * w * 0.32, 0.23, z + 0.023, w * 0.18, h * 0.2, cream);
    }
    block(out, 'timber', 0, h - 0.23, 0, w + 0.78, 0.26, d + 0.78, brown);
    if (level >= 2)
      for (let i = 0; i <= 18; i++) {
        const x = w * (i / 18 - 0.5);
        block(out, 'timber', x, h - 0.35, d / 2 + 0.24, 0.16, 0.36, 0.56, brown);
      }
  }
}
function details(out, level) {
  for (const b of layout.detailParts) {
    if (level === 0 && ['facade', 'roof'].includes(b.kind) && b.w < 24) continue;
    const p = frame(out, b.x, b.y, b.z, b.angle);
    if (b.kind === 'portal') portal(p, b, level);
    else if (b.kind === 'tower') {
      block(p, 'lime', 0, 4.9, 0, b.w, b.h - 4.9, b.d, plaster);
      hip(p, b.w + 0.52, b.d + 0.55, b.h, 1.88, level);
      if (level > 0) cornice(p, 0, b.h - 0.24, 0, b.w + 0.54, b.d + 0.54, buff);
    } else if (b.kind === 'wallGate') {
      const width = b.w * 0.24;
      arch(p, 0, 0, 0, width, b.h * 0.71, b.d, level, { slot: 'masonry', color: buff });
      for (const sign of [-1, 1])
        block(
          p,
          'masonry',
          (sign * (b.w + width)) / 4,
          -0.45,
          0,
          (b.w - width) / 2,
          b.h + 0.45,
          b.d,
          buff,
        );
      block(p, 'masonry', 0, b.h * 0.71 + 0.28, 0, b.w, b.h * 0.29 - 0.28, b.d, buff);
      crenels(p, b.w, b.d, b.h, level);
    } else {
      hip(p, b.w, b.d, b.h, Math.min(2.3, b.d * 0.2), level);
      if (b.kind === 'facade' && level >= 1) {
        const q = frame(p, 0, 0, -b.d / 2 - 0.075, Math.PI);
        panel(q, 'lime', 0, b.h * 0.44, 0.01, b.w, b.h * 0.41, plaster);
        const columns = Math.max(3, Math.floor(b.w / 2.9));
        for (let i = 0; i < columns; i++) {
          const x = b.w * ((i + 0.5) / columns - 0.5),
            w = (b.w / columns) * 0.47,
            y = b.h * 0.45;
          panel(q, 'timber', x, y, 0.034, w, 1.28, brown);
          if (level >= 2) arch(q, x, y, 0.098, w * 1.21, 1.48, 0.17, 2, { scalloped: true });
        }
        cornice(q, 0, b.h * 0.38, 0.1, b.w, 0.3, buff);
      }
    }
  }
}

function gallery(out, span, z, bays, level, major) {
  const bay = span / bays;
  for (const [tier, y, h] of [
    [0, 0, 3.28],
    [1, 4.17, 2.42],
  ]) {
    if (tier === 1 && !major) continue;
    block(out, 'timber', 0, y + h + 0.12, z, span, 0.29, 0.67, brown);
    const stride = level === 0 ? 2 : 1;
    if (level > 0) {
      block(out, 'mosaic', 0, y + h + 0.38, z, span, 0.22, 0.41, major ? buff : green);
      if (tier === 1) block(out, 'marble', 0, y + 0.08, z, span, 0.27, 0.34, cream);
    }
    for (let i = 0; i < bays; i += stride) {
      const x = bay * (i + 0.5 - bays / 2);
      if (level < 2) {
        panel(out, 'lime', x, y + h * 0.76, z, bay * 0.99, h * 0.24, plaster);
        panel(out, 'marble', x - bay * 0.5, y, z, 0.22, h * 0.76, cream);
      } else {
        arch(out, x, y + 0.28, z, bay * 0.83, h * 0.86, 0.34, level, {
          scalloped: major && tier === 0,
          color: plaster,
        });
        for (const dx of major && tier === 0 ? [-0.055, 0.16] : [0.02])
          column(out, x - bay * 0.5 + dx, y, z, h * 0.59, 0.09, level);
        if (level >= 2 && tier === 0 && major) {
          panel(out, 'mosaic', x, y + h * 0.825, z + 0.209, bay * 0.8, 0.19, buff);
          if (level >= 3)
            for (const dx of [-0.32, 0.32]) {
              panel(
                out,
                'mosaic',
                x + bay * dx,
                y + h * 0.53,
                z + 0.211,
                bay * 0.105,
                0.42,
                [0.59, 0.51, 0.33],
              );
            }
        }
        if (level >= 3 && tier === 1)
          for (let j = 0; j < 6; j++)
            column(out, x + bay * (j / 6 - 0.5), y + 0.26, z - 0.22, 0.4, 0.025, 2);
      }
    }
  }
}
function patios(out, level) {
  const p = layout.patios;
  if (level > 0)
    solid(
      out,
      'garden',
      p.monteria.outline,
      [],
      p.monteria.floor - 0.38,
      p.monteria.floor,
      [0.64, 0.59, 0.5],
    );
  for (const [key, name] of [
    ['maidens', 'palace'],
    ['yeso', 'plaster'],
    ['crucero', 'gothic'],
  ]) {
    const b = p[key],
      {
        center: [x, z],
        width: w,
        depth: d,
        angle,
        floor,
      } = b,
      major = name === 'palace';
    const q = frame(out, x, floor, z, angle);
    if (level > 0) block(q, 'garden', 0, -0.34, 0, w * 0.98, 0.34, d * 0.96, [0.57, 0.37, 0.24]);
    if (!major && level === 0) continue;
    for (const sign of [-1, 1]) {
      const side = frame(q, 0, 0, sign * d * 0.45, sign === -1 ? 0 : Math.PI);
      gallery(side, w * 0.89, 0, major ? 7 : 5, level, major);
      if (key !== 'yeso' && level > 0)
        gallery(
          frame(q, sign * w * 0.455, 0, 0, (sign * Math.PI) / 2),
          d * 0.92,
          0,
          major ? 5 : 7,
          level,
          major,
        );
    }
    if (major) {
      block(q, 'marble', 0, 0.016, 0, w * 0.73, 0.23, 1.66, cream);
      block(q, 'water', 0, 0.249, 0, w * 0.7, 0.017, 1.31, water);
      for (const sign of [-1, 1]) {
        block(
          q,
          'garden',
          0,
          -0.01,
          sign * d * 0.217,
          w * 0.71,
          0.07,
          d * 0.24,
          [0.24, 0.34, 0.19],
        );
        if (level >= 2) block(q, 'mosaic', 0, 0.01, sign * d * 0.346, w * 0.71, 0.16, 0.17, green);
      }
    } else if (key === 'yeso') {
      block(q, 'marble', 0, 0.03, 0, w * 0.44, 0.16, 1.65, cream);
      block(q, 'water', 0, 0.19, 0, w * 0.415, 0.018, 1.41, water);
    }
  }
}
function gardens(out, level) {
  const sections = layout.gardenWall.sections;
  for (let i = 1; i < sections.length; i++) {
    const [x, z, y] = sections[i - 1],
      [xx, zz, yy] = sections[i];
    const length = Math.hypot(xx - x, zz - z);
    const p = frame(out, (x + xx) / 2, (y + yy) / 2, (z + zz) / 2, Math.atan2(zz - z, xx - x));
    block(p, 'masonry', 0, -2.65, 0, length + 0.13, 5.55, 2.34, buff);
    if (level === 0) continue;
    const bays = Math.max(2, Math.round(length / 3.05));
    for (let j = 0; j < bays; j++) {
      const k = length * ((j + 0.5) / bays - 0.5),
        bw = length / bays;
      if (level >= 2) {
        arch(p, k, 0.38, 1.26, bw * 0.65, 2.29, 0.25, Math.min(level, 2), {
          slot: 'masonry',
          color: buff,
        });
        panel(p, 'timber', k, 0.57, 1.25, bw * 0.51, 1.52, shadowColor);
        block(p, 'lime', k - bw * 0.45, 0.09, 1.31, 0.32, 2.27, 0.43, plaster);
      } else panel(p, 'lime', k, 0.61, 1.2, bw * 0.54, 1.51, plaster);
    }
    cornice(p, 0, 2.87, 0, length + 0.15, 2.53, plaster);
  }
  const p = frame(out, 16, -0.86, 103, -0.07);
  // PMTiles place the fountain at a point. The pool rim and still surface follow photographs.
  block(p, 'water', 0, 0.7, 0, 11.68, 0.046, 11.33, water);
  for (const side of [-1, 1]) {
    block(p, 'marble', side * 6.1, 0, 0, 0.54, 0.99, 11.9, cream);
    block(p, 'marble', 0, 0, side * 5.9, 12.7, 0.99, 0.54, cream);
    if (level >= 2) {
      for (let i = 0; i <= 7; i++) {
        const v = (i / 7 - 0.5) * 11.5;
        column(p, side * 6.1, 0.95, v, 0.72, 0.054, 3);
        column(p, v, 0.95, side * 5.9, 0.72, 0.054, 3);
      }
      beam(p, 'timber', [side * 6.1, 1.65, -5.9], [side * 6.1, 1.65, 5.9], 0.07, 0.095, brown);
      beam(p, 'timber', [-6.1, 1.65, side * 5.9], [6.1, 1.65, side * 5.9], 0.07, 0.095, brown);
    }
  }
  if (level > 1) {
    column(p, 0, 0.22, 0, 1.63, 0.25, level);
    block(p, 'marble', 0, 0, 0, 1.05, 0.25, 0.94, cream);
    block(p, 'timber', 0, 1.8, 0, 0.21, 0.58, 0.2, [0.28, 0.23, 0.15]);
  }
}
const shadowColor = [0.28, 0.28, 0.195];
function build(out, level) {
  for (const b of layout.buildings) building(out, b, level);
  details(out, level);
  lion(out, level);
  patios(out, level);
  gardens(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
