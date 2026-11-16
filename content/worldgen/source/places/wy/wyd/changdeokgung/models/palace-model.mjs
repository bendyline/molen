/** Changdeokgung palace and garden exteriors in the mapped site's east/south frame, in meters. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  roof: { slot: 'roof', graph: 'tile_ceramic' },
  blue: { slot: 'roof', graph: 'tile_flat' },
  wood: { slot: 'door', graph: 'wood_plain' },
  paint: { slot: 'trim', graph: 'metal_painted' },
  granite: { slot: 'foundation', graph: 'stone_granite' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  lime: { slot: 'foundation', graph: 'stone_limestone_weathered' },
  court: { slot: 'foundation', graph: 'gravel' },
};

const red = [0.58, 0.22, 0.14];
const green = [0.29, 0.51, 0.4];
const mint = [0.47, 0.57, 0.41];
const indigo = [0.26, 0.4, 0.61];
const ochre = [0.77, 0.59, 0.32];
const paper = [0.63, 0.69, 0.58];
const plainWood = [0.42, 0.3, 0.22];
const wall = [0.79, 0.74, 0.63];
const gray = [0.69, 0.68, 0.64];
const tile = [0.12, 0.16, 0.22];
const blue = [0.12, 0.34, 0.57];
const lining = [0.38, 0.39, 0.34];

const base = (out, slot, x, y, z, w, h, d, color) =>
  box(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color);
function face(out, slot, points, color, outward) {
  const normal = normalFor(points[0], points[1], points[2]);
  const p =
    normal.reduce((sum, a, i) => sum + a * outward[i], 0) < 0 ? [...points].reverse() : points;
  const n = normalFor(p[0], p[1], p[2]);
  if (p.length === 3) out.addTriangle(slot, '', p, n, [], color);
  else out.addQuad(slot, '', p, n, [], color);
}
function frame(out, center, angle, floor) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const point = ([x, y, z]) => [center[0] + x * c - z * s, y + floor, center[1] + x * s + z * c];
  const normal = ([x, y, z]) => [x * c - z * s, y, x * s + z * c];
  return {
    addQuad: (slot, r, p, n, uv, color) => out.addQuad(slot, r, p.map(point), normal(n), uv, color),
    addTriangle: (slot, r, p, n, uv, color) =>
      out.addTriangle(slot, r, p.map(point), normal(n), uv, color),
    addConvexPolygon: (slot, r, p, n, uv, color) =>
      out.addConvexPolygon(slot, r, p.map(point), normal(n), uv, color),
  };
}

function hip(out, slot, w, d, eave, rise, level, major) {
  const tone = slot === 'blue' ? blue : tile;
  const ridge = Math.max(w * 0.16, w / 2 - d * 0.35);
  const gable = Math.min(d * 0.2, w * 0.13);
  const lift = Math.min(1.34, d * 0.083);
  const section =
    level <= 1 ? [0, 0.68, 1] : level === 2 ? [0, 0.3, 0.68, 1] : [0, 0.2, 0.44, 0.68, 0.86, 1];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const upper = (t) =>
    t <= 0.68
      ? [w / 2 + ((ridge - w / 2) * t) / 0.68, d / 2 + ((gable - d / 2) * t) / 0.68]
      : [ridge, (gable * (1 - t)) / 0.32];
  const surfacePoint = (side, u, t) => {
    const [x, z] = upper(t);
    const a = corners[side],
      b = corners[(side + 1) % 4];
    const [nx, nz] = a.map((v, i) => v + (b[i] - v) * u);
    const sag = t * t * 0.82 + t * 0.18;
    return [
      nx * x,
      eave + rise * sag + lift * Math.pow(1 - t, 2) * Math.pow(Math.abs(nx * nz), 3),
      nz * z,
    ];
  };
  for (let side = 0; side < 4; side++) {
    const end = side % 2 === 1;
    const segments = level < 3 ? 1 : major ? 3 : 2;
    const direction = [
      corners[side][0] + corners[(side + 1) % 4][0],
      1,
      corners[side][1] + corners[(side + 1) % 4][1],
    ];
    const last = end ? 0.68 : 1;
    const levels = section.filter((t) => t < last).concat(last);
    for (let j = 0; j < segments; j++) {
      const a = j / segments,
        b = (j + 1) / segments;
      for (let k = 1; k < levels.length; k++) {
        const t = levels[k - 1],
          u = levels[k];
        face(
          out,
          slot,
          [
            surfacePoint(side, a, t),
            surfacePoint(side, b, t),
            surfacePoint(side, b, u),
            surfacePoint(side, a, u),
          ],
          tone,
          direction,
        );
      }
      if (level > 1) {
        const p = surfacePoint(side, a, 0),
          q = surfacePoint(side, b, 0);
        face(out, slot, [p, q, [q[0], eave - 0.16, q[2]], [p[0], eave - 0.16, p[2]]], tone, [
          direction[0],
          0,
          direction[2],
        ]);
      }
    }
    if (end)
      face(
        out,
        'wood',
        [surfacePoint(side, 0, 0.68), surfacePoint(side, 1, 0.68), surfacePoint(side, 0, 1)],
        lining,
        [direction[0], 0, 0],
      );
    if (level >= 2 && major) {
      beam(out, slot, surfacePoint(side, 0, 0), surfacePoint(side, 0, 0.68), 0.14, 0.14, tone);
      if (level >= 3 && !end && w >= 16) {
        const rolls = Math.min(80, Math.max(8, Math.floor(w / (level === 4 ? 0.46 : 1.12))));
        for (let i = 1; i < rolls; i++) {
          const a = i / rolls;
          for (const [j, k] of level === 4
            ? [
                [0, 0.3],
                [0.3, 0.68],
                [0.68, 1],
              ]
            : [
                [0, 0.4],
                [0.4, 0.76],
                [0.76, 1],
              ]) {
            const v = surfacePoint(side, a, j),
              p = surfacePoint(side, a, k);
            v[1] += 0.04;
            p[1] += 0.04;
            beam(
              out,
              slot,
              v,
              p,
              0.087,
              0.07,
              tone.map((n) => n * 1.09),
            );
          }
        }
      }
    }
  }
  if (level > 1) base(out, slot, 0, eave - 0.18, 0, w, 0.12, d, tone);
  if (level > 1)
    base(out, slot, 0, eave + rise - 0.045, 0, ridge * 2 + 0.23, major ? 0.21 : 0.14, 0.22, tone);
  if (level >= 2 && major)
    for (const sign of [-1, 1]) {
      beam(
        out,
        slot,
        [sign * ridge * 0.86, eave + rise + 0.07, 0],
        [sign * (ridge + 0.22), eave + rise + 0.34, 0],
        0.22,
        0.2,
        tone,
      );
      for (const side of [0, 2])
        for (let k = 0; k < (level >= 3 ? 5 : 2); k++) {
          const p = surfacePoint(side, sign === 1 ? 0.95 : 0.05, 0.18 + k * 0.085);
          base(out, slot, p[0], p[1], p[2], 0.17, 0.2, 0.19, tone);
        }
    }
}

function roundPost(out, x, y, z, r, h, level, tone) {
  if (level < 2) return base(out, 'wood', x, y, z, r * 2, h, r * 2, tone);
  const n = level >= 3 ? 10 : 5;
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n,
      b = (2 * Math.PI * (i + 1)) / n;
    const p = [x + r * Math.cos(a), y, z + r * Math.sin(a)],
      q = [x + r * Math.cos(b), y, z + r * Math.sin(b)];
    face(out, 'wood', [p, q, [q[0], y + h, q[2]], [p[0], y + h, p[2]]], tone, [
      Math.cos((a + b) / 2),
      0,
      Math.sin((a + b) / 2),
    ]);
  }
}
function frontPanel(out, x, y, z, w, h, side, tone, level, lattice) {
  const rectangle = (slot, xx, yy, ww, hh, color) => {
    const thickness = slot === 'paint' ? 0.14 : slot === 'plaster' ? 0.072 : 0.026;
    const front = z + side * thickness;
    face(
      out,
      slot,
      [
        [xx - ww / 2, yy, front],
        [xx + ww / 2, yy, front],
        [xx + ww / 2, yy + hh, front],
        [xx - ww / 2, yy + hh, front],
      ],
      color,
      [0, 0, side],
    );
  };
  const rail = Math.min(0.14, w * 0.071);
  rectangle('wood', x, y, w, h, tone);
  if (!lattice) return;
  rectangle('plaster', x, y + h * 0.25, w * 0.83, h * 0.67, paper);
  if (level < 2) return;
  const panes = level >= 3 ? 6 : 3;
  for (let i = 1; i < panes; i++)
    rectangle(
      'paint',
      x + w * 0.83 * (i / panes - 0.5),
      y + h * 0.25,
      rail * 0.54,
      h * 0.67,
      green,
    );
  for (let j = 1; j < 4; j++)
    rectangle('paint', x, y + h * (0.25 + j * 0.16), w * 0.83, rail * 0.55, green);
  rectangle('paint', x, y + h * 0.235, w * 0.87, rail, green);
  rectangle('paint', x, y + h * 0.91, w * 0.87, rail, green);
}
function stair(out, x, z, w, drop, run, sign, level) {
  const local = frame(out, [x, 0], 0, 0);
  const count =
    level < 2 ? 2 : Math.max(3, Math.min(level === 2 ? 7 : 13, Math.ceil(drop / 0.195)));
  const depth = run / count;
  for (let i = 0; i < count; i++)
    base(
      local,
      'granite',
      0,
      (-drop * (i + 1)) / count - 0.32,
      z + sign * (i + 0.5) * depth,
      w,
      0.32,
      depth + 0.018,
      gray,
    );
}

function stage(out, part, style, level, w, d) {
  const foundation = Math.max(0.2, -part.bottom + part.floor);
  if (style === 'gate' || style === 'donhwa') {
    // Lower gate thresholds sit at the mapped grade in all four representations.
    base(out, 'granite', 0, -0.4, 0, w * 0.92, 0.39, d * 0.82, gray);
    if (style === 'donhwa' && level > 0) {
      for (const side of [-1, 1]) stair(out, 0, side * d * 0.41, w * 0.59, 0.4, 2.35, side, level);
    }
    return;
  }
  if (style === 'throne') {
    const sizes = [
      [w, d, 0],
      [w * 0.95, d * 0.91, 0.77],
      [w * 0.88, d * 0.82, 1.48],
    ];
    for (const [width, depth, y] of sizes)
      base(out, 'granite', 0, y - foundation - 0.45, 0, width, foundation + 0.45, depth, gray);
    for (const x of [-w * 0.22, 0, w * 0.22]) {
      const shoulder = frame(out, [x, 0], 0, 1.48);
      stair(shoulder, 0, d * 0.39, w * 0.13, 2.45, d * 0.31, 1, level);
      if (level >= 3)
        for (const sign of [-1, 1])
          beam(
            shoulder,
            'granite',
            [sign * w * 0.078, -0.03, d * 0.38],
            [sign * w * 0.078, -2.42, d * 0.7],
            0.46,
            0.32,
            gray,
          );
    }
    if (level >= 3)
      for (const side of [-1, 1]) {
        base(out, 'lime', 0, 1.5, side * d * 0.38, w * 0.86, 0.18, 0.27, gray);
        for (let i = 0; i < 12; i++)
          base(
            out,
            'lime',
            w * 0.81 * (i / 11 - 0.5),
            1.52,
            side * d * 0.38,
            0.23,
            0.27,
            0.34,
            gray,
          );
      }
    return;
  }
  if (level > 0 || foundation > 0.75)
    base(out, 'granite', 0, -foundation, 0, w * 0.89, foundation, d * 0.82, gray);
  if (
    level >= 2 &&
    ['residence', 'blue', 'library', 'pavilion', 'porch', 'plain'].includes(style)
  ) {
    const rise = Math.min(foundation, 0.8);
    stair(out, 0, d * 0.41, Math.min(w * 0.53, 5.5), rise, rise * 1.6, 1, level);
    if (level >= 3) base(out, 'lime', 0, -0.12, 0, w * 0.9, 0.12, d * 0.83, gray);
  }
}

function bayLevel(out, w, d, y, h, bayCount, kind, level, major) {
  const open = ['gate', 'donhwa', 'pavilion', 'porch'].includes(kind);
  const plastered = kind === 'wall';
  const plain = kind === 'plain';
  const wood = plain ? plainWood : red;
  const rows = major ? bayCount : Math.max(2, Math.min(bayCount, Math.round(w / 5)));
  const cols = major ? 3 : 2;
  const spacing = w / rows;
  const post = Math.min(0.38, spacing * 0.075);
  if (!open) {
    base(out, plastered ? 'plaster' : 'wood', 0, y, 0, w, h, d, plastered ? wall : wood);
  }
  if (level === 0) {
    if (open)
      for (let i = 0; i <= rows; i++)
        base(out, 'wood', spacing * (i - rows / 2), y, 0, post * 2, h, d, wood);
    return;
  }
  for (const sign of [-1, 1]) {
    const z = sign * d * 0.5;
    base(
      out,
      kind === 'plain' ? 'wood' : 'paint',
      0,
      y + h - 0.26,
      z,
      w + 0.5,
      0.26,
      0.36,
      plain ? plainWood : green,
    );
    if (level >= 2) base(out, 'wood', 0, y + 0.03, z, w, 0.14, 0.25, wood);
    if (open || level >= 2)
      for (let i = 0; i <= rows; i++) {
        const x = spacing * (i - rows / 2);
        roundPost(out, x, y + 0.05, z, post, h - 0.2, level, wood);
        if (level >= 2) {
          base(out, 'granite', x, y, z, post * 2.45, 0.16, post * 2.45, gray);
          if (!plain) {
            const tiers = level >= 3 && major ? 3 : 1;
            for (let t = 0; t < tiers; t++) {
              const width = post * (2.2 + t * 0.65);
              base(
                out,
                'paint',
                x,
                y + h - 0.48 + t * 0.15,
                z + sign * 0.11 * t,
                width,
                0.13,
                post * (2.6 + t * 0.8),
                t % 2 === 0 ? green : ochre,
              );
            }
          }
        }
      }
    if (!open && level >= 2)
      for (let i = 0; i < rows; i++) {
        const x = spacing * (i + 0.5 - rows / 2);
        if (plastered) {
          frontPanel(out, x, y + 0.64, z, spacing * 0.77, h * 0.54, sign, red, level, false);
        } else
          frontPanel(
            out,
            x,
            y + 0.19,
            z,
            spacing * 0.76,
            h * 0.7,
            sign,
            plain ? plainWood : green,
            level,
            true,
          );
      }
    if (level >= 3 && major && !plain) {
      base(out, 'paint', 0, y + h - 0.58, z + sign * 0.3, w + 0.04, 0.14, 0.16, ochre);
      const brackets = Math.max(rows * 2, Math.floor(w / 1.45));
      for (let i = 0; i < brackets; i++) {
        const x = w * ((i + 0.5) / brackets - 0.5);
        base(
          out,
          'paint',
          x,
          y + h - 0.17,
          z + sign * 0.43,
          0.2,
          0.22,
          0.55,
          i % 3 === 0 ? indigo : mint,
        );
        base(
          out,
          'paint',
          x,
          y + h + 0.03,
          z + sign * 0.55,
          0.15,
          0.13,
          0.67,
          i % 3 === 0 ? ochre : green,
        );
      }
    }
    if (level >= 2 && !open && major) {
      const sideOut = frame(out, [(sign * w) / 2, 0], (sign * Math.PI) / 2, 0);
      for (let i = 0; i <= cols; i++)
        roundPost(sideOut, d * (i / cols - 0.5), y + 0.05, 0, post * 0.83, h - 0.2, level, wood);
      if (major && level >= 3)
        for (let i = 0; i < cols; i++)
          frontPanel(
            sideOut,
            d * ((i + 0.5) / cols - 0.5),
            y + 0.23,
            0,
            (d / cols) * 0.7,
            h * 0.55,
            -1,
            wood,
            level,
            true,
          );
    }
  }
  if (
    level >= 2 &&
    (kind === 'gate' || kind === 'donhwa' || kind === 'porch' || kind === 'throne')
  ) {
    base(out, 'wood', 0, y + h - 0.39, d * 0.51, Math.min(w * 0.2, 3.15), 0.49, 0.21, lining);
    base(out, 'paint', 0, y + h - 0.22, d * 0.515, Math.min(w * 0.17, 2.82), 0.08, 0.24, ochre);
  }
}

function hall(out, b, p, level) {
  const { width: w, depth: d, center, angle, floor } = p,
    { style, bays, story } = b;
  const local = frame(out, center, angle, floor);
  const major = ['throne', 'donhwa', 'gate', 'residence', 'blue', 'library', 'porch'].includes(
    style,
  );
  const slot = style === 'blue' ? 'blue' : 'roof';
  const stand = style === 'throne' ? 1.48 : 0;
  const bodyW = w * (style === 'throne' ? 0.83 : 0.82);
  const bodyD = d * (style === 'throne' ? 0.72 : 0.69);
  const h = Math.min(story, 0.4 * d + (major ? 1.15 : 0.48));
  const top = stand + h;
  const low = major ? level : Math.min(Math.max(0, level - 2), w > 13 ? 1 : 0);
  stage(local, p, style, low, w, d);
  if (level >= 2 && style === 'throne') {
    const apron = frame(local, [0, d * 0.64], 0, -2.18);
    for (let j = 0; j < 3; j++)
      base(apron, 'court', 0, -j * 0.3, j * 5, w * 0.56, 0.26, 5.015, [0.67, 0.63, 0.53]);
    if (level >= 3)
      for (const side of [-1, 1])
        for (let j = 0; j < 7; j++) {
          const x = side * (w * 0.26 + j * 0.19);
          const stone = frame(local, [x, d * 0.7 + j * 2.4], 0, -2.39 - j * 0.185);
          base(stone, 'granite', 0, 0, 0, 0.58, 0.17, 0.39, gray);
          base(stone, 'lime', 0, 0.17, 0, 0.36, 0.56, 0.22, gray);
          base(stone, 'granite', 0, 0.73, 0, 0.46, 0.08, 0.27, gray);
        }
  }
  bayLevel(local, bodyW, bodyD, stand, h, bays, style, low, major);
  hip(local, slot, w, d, top, Math.min(5.2, d * (style === 'wall' ? 0.25 : 0.23)), low, major);
  if (['throne', 'donhwa', 'library'].includes(style)) {
    const lift = top + d * 0.137;
    const joint = style === 'throne' ? 1.5 : 1.0;
    const upperW = w * (style === 'library' ? 0.9 : 0.75),
      upperD = d * (style === 'library' ? 0.91 : 0.72);
    const upperH = style === 'throne' ? 2.65 : style === 'donhwa' ? 1.95 : 2.2;
    bayLevel(
      local,
      upperW * 0.76,
      upperD * 0.65,
      lift - joint,
      upperH + joint,
      bays,
      'residence',
      low,
      major,
    );
    hip(local, slot, upperW, upperD, lift + upperH, Math.min(4.4, upperD * 0.27), low, major);
  }
  if (level >= 3 && style === 'porch') {
    const stairs = frame(local, [0, d * 0.41], 0, 0);
    stair(stairs, 0, 0, w * 0.33, 0.85, 2.9, 1, level);
  }
}

function gardenRoof(out, ring, peak, level) {
  const n = ring.length,
    stoneY = 0;
  const postTop = peak * 0.59;
  const crest = level === 0 ? [0, 1] : level === 1 ? [0, 0.6, 1] : [0, 0.29, 0.62, 1];
  for (let i = 0; i < n; i++) {
    const [x, z] = ring[i],
      [xx, zz] = ring[(i + 1) % n];
    const mid = [x + xx, 1, z + zz];
    const p = (a, b, t) => [
      a * (1 - t),
      postTop + (peak - postTop) * t * t + 0.2 * (1 - t),
      b * (1 - t),
    ];
    for (let k = 1; k < crest.length; k++) {
      const a = crest[k - 1],
        b = crest[k];
      const ps = [p(x, z, a), p(xx, zz, a), p(xx, zz, b), p(x, z, b)];
      face(out, 'roof', b === 1 ? ps.slice(0, 3) : ps, tile, mid);
    }
    const a = [x * 0.68, stoneY, z * 0.68],
      b = [xx * 0.68, stoneY, zz * 0.68];
    if (level > 0 || i % 2 === 0) roundPost(out, a[0], 0, a[2], 0.14, postTop, level, red);
    if (level >= 2) {
      beam(out, 'wood', [a[0], 0.5, a[2]], [b[0], 0.5, b[2]], 0.18, 0.15, red);
      beam(out, 'roof', p(x, z, 0), p(x, z, 0.62), 0.13, 0.12, tile);
    }
    face(out, 'granite', [[0, -0.01, 0], a, b], gray, [0, 1, 0]);
    if (level > 0)
      face(out, 'granite', [a, b, [b[0], -0.64, b[2]], [a[0], -0.64, a[2]]], gray, [
        mid[0],
        0,
        mid[2],
      ]);
  }
  if (level >= 2) base(out, 'paint', 0, peak - 0.03, 0, 0.18, 0.34, 0.18, green);
}
function garden(out, b, p, level) {
  const local = frame(out, p.center, p.angle, p.floor);
  const w = p.width / 2,
    d = p.depth / 2;
  if (b.style === 'cross' && level > 0)
    for (const x of [-0.41, 0.41])
      for (const z of [-0.43, 0.43])
        base(
          local,
          'granite',
          x * w,
          p.bottom - p.floor,
          z * d,
          0.29,
          p.floor - p.bottom,
          0.28,
          gray,
        );
  else base(local, 'granite', 0, p.bottom - p.floor, 0, w, p.floor - p.bottom, d, gray);
  if (b.style === 'cross') {
    const ring = [
      [-0.39, -1],
      [0.39, -1],
      [0.39, -0.39],
      [1, -0.39],
      [1, 0.39],
      [0.39, 0.39],
      [0.39, 1],
      [-0.39, 1],
      [-0.39, 0.39],
      [-1, 0.39],
      [-1, -0.39],
      [-0.39, -0.39],
    ];
    gardenRoof(
      local,
      ring.map(([x, z]) => [x * w, z * d]),
      4.8,
      level,
    );
    return;
  }
  // Jondeokjeong is hexagonal. Gwallamjeong opens toward its pond under a fan-shaped eave.
  const n = b.style === 'hex' ? 6 : 7;
  const angles =
    b.style === 'hex'
      ? Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n)
      : [-2.65, -2.06, -1.55, -1.04, -0.47, 0.28, 2.65];
  const ring = angles.map((a) => [Math.cos(a) * w, Math.sin(a) * d]);
  gardenRoof(local, ring, b.style === 'hex' ? 4.65 : 3.95, level);
  if (b.style === 'hex' && level >= 1)
    gardenRoof(
      frame(local, [0, 0], 0, 2.45),
      ring.map((p) => p.map((n) => n * 0.69)),
      3.0,
      level,
    );
}

function bridge(out, level) {
  const { start, end, heights, width } = layout.bridge;
  const dx = end[0] - start[0],
    dz = end[1] - start[1],
    span = Math.hypot(dx, dz);
  const local = frame(
    out,
    [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2],
    Math.atan2(dz, dx),
    (heights[0] + heights[1]) / 2,
  );
  const deck = (x) =>
    ((heights[1] - heights[0]) * x) / span + 1.02 * (1 - (4 * x * x) / (span * span));
  const crossfall = 0.025;
  const n = level < 2 ? 4 : level === 2 ? 8 : 18;
  const radius = 2.15;
  if (level === 0) {
    const x = span / 2,
      z = width / 2;
    for (const sign of [-1, 1]) {
      const a = sign * x,
        b = sign * 1.95;
      face(
        local,
        'granite',
        [
          [a, -2.4, -z],
          [b, -0.31, -z],
          [b, deck(b), -z],
          [a, deck(a), -z],
        ],
        gray,
        [0, 0, -1],
      );
      face(
        local,
        'granite',
        [
          [a, -2.4, z],
          [b, -0.31, z],
          [b, deck(b), z],
          [a, deck(a), z],
        ],
        gray,
        [0, 0, 1],
      );
    }
    for (const zz of [-z, z])
      face(
        local,
        'granite',
        [
          [-1.95, -0.31, zz],
          [1.95, -0.31, zz],
          [1.95, deck(1.95), zz],
          [-1.95, deck(-1.95), zz],
        ],
        gray,
        [0, 0, Math.sign(zz)],
      );
    for (const [a, b] of [
      [-x, 0],
      [0, x],
    ])
      face(
        local,
        'granite',
        [
          [a, deck(a), -z],
          [b, deck(b), -z],
          [b, deck(b), z],
          [a, deck(a), z],
        ],
        gray,
        [0, 1, 0],
      );
    return;
  }
  for (const sign of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / n,
        b = a + Math.PI / n;
      const x = sign * 2.55 + Math.sin(a) * radius,
        xx = sign * 2.55 + Math.sin(b) * radius;
      const y = -1.55 + Math.cos(a) * 1.28,
        yy = -1.55 + Math.cos(b) * 1.28;
      for (const z of [-width / 2, width / 2]) {
        const stone = gray.map((v) => v * (1 + ((i % 4) - 1.5) * 0.029));
        face(
          local,
          'granite',
          [
            [x, y, z],
            [xx, yy, z],
            [xx, deck(xx), z],
            [x, deck(x), z],
          ],
          stone,
          [0, 0, Math.sign(z)],
        );
        if (level >= 2)
          face(
            local,
            'lime',
            [
              [x, y - 0.023, z * 1.026],
              [xx, yy - 0.023, z * 1.026],
              [xx, yy + 0.18, z * 1.026],
              [x, y + 0.18, z * 1.026],
            ],
            stone,
            [0, 0, Math.sign(z)],
          );
      }
      face(
        local,
        'granite',
        [
          [x, y, -width / 2],
          [x, y, width / 2],
          [xx, yy, width / 2],
          [xx, yy, -width / 2],
        ],
        gray,
        [0, -1, 0],
      );
    }
  }
  for (const [a, b] of [
    [-span / 2, -4.7],
    [-0.4, 0.4],
    [4.7, span / 2],
  ])
    base(
      local,
      'granite',
      (a + b) / 2,
      -2.2,
      0,
      b - a,
      2.2 + Math.min(deck(a), deck(b)),
      width,
      gray,
    );
  const count = level < 2 ? 8 : 18;
  for (let i = 0; i < count; i++) {
    const x = span * (i / count - 0.5),
      xx = span * ((i + 1) / count - 0.5);
    face(
      local,
      'granite',
      [
        [x, deck(x), -width / 2],
        [xx, deck(xx), -width / 2],
        [xx, deck(xx) - crossfall, width / 2],
        [x, deck(x) - crossfall, width / 2],
      ],
      gray,
      [0, 1, 0],
    );
    if (level > 0)
      for (const side of [-1, 1]) {
        const z = side * width * 0.46;
        const rails = level >= 2 ? [0.39, 0.77] : [0.66];
        for (const y of rails)
          beam(local, 'lime', [x, deck(x) + y, z], [xx, deck(xx) + y, z], 0.14, 0.15, gray);
      }
  }
  if (level >= 2)
    for (const side of [-1, 1])
      for (let i = 0; i <= 8; i++) {
        const x = span * (i / 8 - 0.5) * 0.985,
          z = side * width * 0.46;
        base(local, 'granite', x, deck(x), z, 0.25, 0.94, 0.27, gray);
        if (level >= 2) base(local, 'lime', x, deck(x) + 0.88, z, 0.34, 0.11, 0.36, gray);
      }
}
function shell(out, part, building) {
  const { width: w, depth: d, floor, bottom } = part;
  const { style, bays, story } = building;
  const local = frame(out, part.center, part.angle, floor);
  const major = ['throne', 'donhwa', 'gate', 'residence', 'blue', 'library', 'porch'].includes(
    style,
  );
  const open = ['gate', 'donhwa', 'pavilion', 'porch'].includes(style);
  const h = Math.min(story, 0.4 * d + (major ? 1.15 : 0.48));
  const roof = (width, depth, top, slot, rise) => {
    const x = width / 2,
      z = depth / 2;
    const ridge = Math.max(width * 0.16, x - depth * 0.35);
    const a = [-x, top + 0.34, -z],
      b = [x, top + 0.34, -z],
      c = [x, top + 0.34, z],
      e = [-x, top + 0.34, z];
    const u = [-ridge, top + rise, 0],
      v = [ridge, top + rise, 0];
    const tone = slot === 'blue' ? blue : tile;
    face(local, slot, [a, b, v, u], tone, [0, 1, -1]);
    face(local, slot, [e, c, v, u], tone, [0, 1, 1]);
    face(local, slot, [a, e, u], tone, [-1, 1, 0]);
    face(local, slot, [b, c, v], tone, [1, 1, 0]);
  };
  const walls = (xmin, xmax, ymin, ymax, z, slot, tone) => {
    const a = [xmin, ymin, -z],
      b = [xmax, ymin, -z],
      c = [xmax, ymin, z],
      d = [xmin, ymin, z];
    const p = (v) => [v[0], ymax, v[2]];
    face(local, slot, [a, b, p(b), p(a)], tone, [0, 0, -1]);
    face(local, slot, [b, c, p(c), p(b)], tone, [1, 0, 0]);
    face(local, slot, [c, d, p(d), p(c)], tone, [0, 0, 1]);
    face(local, slot, [d, a, p(a), p(d)], tone, [-1, 0, 0]);
  };
  if (open) {
    const spacing = (w * 0.82) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = spacing * (i - bays / 2);
      for (const sign of [-1, 1]) {
        const edge = x + sign * 0.27,
          z = d * 0.345;
        face(
          local,
          'wood',
          [
            [edge, 0, -z],
            [edge, 0, z],
            [edge, h, z],
            [edge, h, -z],
          ],
          red,
          [sign, 0, 0],
        );
      }
    }
    if (style === 'gate' || style === 'donhwa')
      face(
        local,
        'granite',
        [
          [-w * 0.46, 0, -d * 0.41],
          [w * 0.46, 0, -d * 0.41],
          [w * 0.46, 0, d * 0.41],
          [-w * 0.46, 0, d * 0.41],
        ],
        gray,
        [0, 1, 0],
      );
  } else {
    const x = w * (style === 'throne' ? 0.415 : 0.41),
      z = d * (style === 'throne' ? 0.36 : 0.345);
    walls(
      -x,
      x,
      style === 'throne' ? 1.48 : bottom - floor,
      h + (style === 'throne' ? 1.48 : 0),
      z,
      style === 'wall' ? 'plaster' : 'wood',
      style === 'wall' ? wall : style === 'plain' ? plainWood : red,
    );
  }
  if (style === 'throne') {
    base(local, 'granite', 0, bottom - floor, 0, w, floor - bottom, d, gray);
    base(local, 'granite', 0, -0.1, 0, w * 0.89, 1.58, d * 0.81, gray);
  }
  const top = h + (style === 'throne' ? 1.48 : 0);
  roof(w, d, top, style === 'blue' ? 'blue' : 'roof', Math.min(5.2, d * 0.23));
  if (['donhwa', 'throne', 'library'].includes(style)) {
    const top2 = top + d * 0.137 + (style === 'throne' ? 2.65 : style === 'donhwa' ? 1.95 : 2.2);
    const wide = w * (style === 'library' ? 0.9 : 0.75),
      deep = d * (style === 'library' ? 0.91 : 0.72);
    walls(-wide * 0.38, wide * 0.38, top + d * 0.07, top2, deep * 0.325, 'wood', red);
    roof(wide, deep, top2, 'roof', Math.min(4.4, deep * 0.27));
  }
}
function build(out, level) {
  for (const building of layout.buildings)
    for (const part of building.parts) {
      if (['cross', 'fan', 'hex'].includes(building.style)) garden(out, building, part, level);
      else if (
        level === 0 ||
        (level === 1 &&
          !['throne', 'donhwa', 'gate', 'blue', 'library', 'residence', 'porch'].includes(
            building.style,
          ))
      ) {
        if (
          level > 0 ||
          part.width * part.depth > 90 ||
          ['gate', 'pavilion'].includes(building.style)
        )
          shell(out, part, building);
      } else hall(out, building, part, level);
    }
  bridge(out, level);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
