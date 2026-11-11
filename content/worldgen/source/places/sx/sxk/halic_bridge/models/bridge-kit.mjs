/** Authored Haliç motorway, Metrobus and flanking deck geometry. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const site = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const componentControls = site.models;
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94 },
  roadway: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.08 },
};
const shades = {
  concrete: [0.6, 0.592, 0.544],
  edge: [0.646, 0.641, 0.595],
  pier: [0.565, 0.554, 0.507],
  wet: [0.382, 0.384, 0.354],
  seat: [0.342, 0.34, 0.311],
  fascia: [0.469, 0.479, 0.452],
  girder: [0.299, 0.327, 0.332],
  soffit: [0.329, 0.345, 0.328],
  asphalt: [0.222, 0.23, 0.23],
  bus: [0.174, 0.186, 0.183],
  walk: [0.472, 0.462, 0.435],
  rail: [0.506, 0.519, 0.488],
  mesh: [0.221, 0.324, 0.282],
  white: [0.766, 0.755, 0.694],
  yellow: [0.759, 0.579, 0.205],
  joint: [0.108, 0.112, 0.114],
  glass: [0.75, 0.745, 0.642],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  ref = 'palette:#ffffff',
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
function face(out, slot, color, points, preferred) {
  points = points.map((p) => p.map(Math.fround));
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.5) return;
  if (n.reduce((sum, v, i) => sum + v * preferred[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, ref, points, n, undefined, shades[color]);
}
function quad(out, slot, color, a, b, c, d, dir) {
  face(out, slot, color, [a, b, c], dir);
  face(out, slot, color, [a, c, d], dir);
}
const rod = (out, slot, color, a, b, w, d = w) => {
  if (Math.hypot(...a.map((v, i) => v - b[i])) > 0.04) beam(out, slot, a, b, w, d, shades[color]);
};
const ring = (x, y, z, w, d) => [
  [x - w / 2, y, z - d / 2],
  [x - w / 2, y, z + d / 2],
  [x + w / 2, y, z + d / 2],
  [x + w / 2, y, z - d / 2],
];
function profile(model, x) {
  const i = model.profile.findIndex((p) => p[0] >= x);
  if (i <= 0) return model.profile.at(i).slice(1);
  const [a, b] = model.profile.slice(i - 1, i + 1),
    t = (x - a[0]) / (b[0] - a[0]);
  return [mix(a[1], b[1], t), mix(a[2], b[2], t)];
}
function sectionEdges(outline, x) {
  return outline
    .flatMap((p, i) => {
      const q = outline[(i + 1) % outline.length];
      if (!((p[0] <= x && x < q[0]) || (q[0] <= x && x < p[0]))) return [];
      return [(v) => mix(p[1], q[1], (v - p[0]) / (q[0] - p[0]))];
    })
    .sort((a, b) => a(x) - b(x));
}
function deckCells(model, tier) {
  const xs = [
    ...new Set([
      ...model.outline.map((p) => p[0]),
      ...model.profile.flatMap((p, i) =>
        tier >= 2 || i % 4 === 0 || p[0] < model.ends[0] + 30 || p[0] > model.ends[1] - 30
          ? [p[0]]
          : [],
      ),
    ]),
  ].sort((a, b) => a - b);
  const cells = [];
  for (let i = 1; i < xs.length; i++) {
    const a = xs[i - 1],
      b = xs[i];
    if (b - a < 0.00002) continue;
    const cross = sectionEdges(model.outline, (a + b) * 0.5),
      [ya] = profile(model, a),
      [yb] = profile(model, b);
    for (let j = 1; j < cross.length; j += 2) {
      const lo = cross[j - 1],
        hi = cross[j],
        za = [lo(a), hi(a)],
        zb = [lo(b), hi(b)];
      cells.push({ a: [a, ya, ...za], b: [b, yb, ...zb], isBranch: cross.length > 2 && j > 1 });
    }
  }
  return cells;
}
const corner = (row, t, y = 0) => [row[0], row[1] + y, mix(row[2], row[3], t)];
function strip(out, slot, color, { a, b }, lo, hi, y = 0) {
  quad(
    out,
    slot,
    color,
    corner(a, lo, y),
    corner(a, hi, y),
    corner(b, hi, y),
    corner(b, lo, y),
    up,
  );
}
function deckMesh(out, model, cells, tier) {
  const main = model.kind === 'main',
    depth = main ? 2.47 : 1.99;
  for (const cell of cells) {
    const { a, b, isBranch } = cell;
    if (tier === 0) strip(out, 'roadway', 'asphalt', cell, 0, 1);
    else {
      const bus = main && !isBranch;
      if (bus) {
        strip(out, 'roadway', 'asphalt', cell, 0.047, 0.36);
        strip(out, 'roadway', 'bus', cell, 0.36, 0.64);
        strip(out, 'roadway', 'asphalt', cell, 0.64, 0.953);
      } else strip(out, 'roadway', 'asphalt', cell, 0.047, 0.953);
      strip(out, 'roadway', 'walk', cell, 0, 0.047, 0.12);
      strip(out, 'roadway', 'walk', cell, 0.953, 1, 0.12);
    }
    for (const [t, inner, side] of [
      [0, 0.16, -1],
      [1, 0.84, 1],
    ]) {
      if (tier > 0)
        quad(
          out,
          'concrete',
          'fascia',
          corner(a, t, 0.12),
          corner(b, t, 0.12),
          corner(b, t, -0.59),
          corner(a, t, -0.59),
          [0, 0, side],
        );
      const shoulder = tier === 0 ? 0 : -0.59;
      quad(
        out,
        'concrete',
        'girder',
        corner(a, t, shoulder),
        corner(b, t, shoulder),
        corner(b, inner, -depth),
        corner(a, inner, -depth),
        [0, -0.48, side],
      );
    }
    quad(
      out,
      'concrete',
      'soffit',
      corner(a, 0.16, -depth),
      corner(b, 0.16, -depth),
      corner(b, 0.84, -depth),
      corner(a, 0.84, -depth),
      [0, -1, 0],
    );
    if (tier >= 2) {
      const w = (a[3] - a[2] + (b[3] - b[2])) * 0.5;
      if (w < 2.75) continue;
      const fractions = main ? [0.064, 0.353, 0.647, 0.936] : [0.081, 0.919];
      for (const t of fractions)
        strip(out, 'steel', 'white', cell, t - 0.043 / w, t + 0.043 / w, 0.013);
      if (main && tier > 2)
        for (const t of [0.37, 0.63])
          strip(out, 'steel', 'yellow', cell, t - 0.034 / w, t + 0.034 / w, 0.015);
    }
  }
  for (const [i, p] of model.outline.entries()) {
    const q = model.outline[(i + 1) % model.outline.length];
    if (Math.abs(p[0] - q[0]) > Math.abs(p[1] - q[1]) * 0.65) continue;
    const [yp] = profile(model, p[0]),
      [yq] = profile(model, q[0]),
      sign = p[0] < 0 ? -1 : 1;
    quad(
      out,
      'concrete',
      'fascia',
      [p[0], yp, p[1]],
      [q[0], yq, q[1]],
      [q[0], yq - 0.6, q[1]],
      [p[0], yp - 0.6, p[1]],
      [sign, 0, 0],
    );
  }
}
function pierMesh(out, model, tier) {
  const main = model.kind === 'main';
  for (const p of model.supports) {
    const { x, z, top, base, deckWidth } = p;
    if (tier === 0) {
      loft(
        out,
        'concrete',
        [
          ring(x, base, z, 3.4, Math.min(deckWidth * 0.6, main ? 14 : 6.3)),
          ring(x, top + 0.06, z, 3.4, Math.min(deckWidth * 0.6, main ? 14 : 6.3)),
        ],
        shades.pier,
      );
      continue;
    }
    const capWidth = Math.max(1.5, deckWidth * 0.76),
      capDepth = main ? 1.31 : 1.02;
    const row = main ? [-0.22, 0.22] : deckWidth > 12.6 ? [-0.2, 0.2] : [0];
    loft(
      out,
      'concrete',
      [ring(x, top - capDepth, z, 3.49, capWidth * 0.92), ring(x, top + 0.035, z, 4.42, capWidth)],
      shades.pier,
    );
    for (const offset of row) {
      const cz = z + offset * deckWidth,
        w = main ? 3.3 : 2.85,
        d = main ? 3.84 : 3.12,
        cap = top - capDepth + 0.07;
      loft(
        out,
        'concrete',
        [ring(x, base, cz, w * 1.19, d * 1.16), ring(x, cap, cz, w, d)],
        shades.pier,
      );
      if (tier >= 2) {
        const h = Math.min(cap - 0.2, p.wet ? 0.9 : base + 1.8);
        loft(
          out,
          'concrete',
          [ring(x, base - 0.025, cz, w * 1.35, d * 1.43), ring(x, h, cz, w * 1.35, d * 1.43)],
          shades[p.wet ? 'wet' : 'seat'],
        );
        loft(
          out,
          'concrete',
          [ring(x, top + 0.022, cz, 0.9, 1.43), ring(x, top + 0.086, cz, 0.9, 1.43)],
          shades.seat,
        );
      }
    }
  }
  for (const p of model.abutments) {
    loft(
      out,
      'concrete',
      [ring(p.x, p.base, p.z, 3.82, p.width * 0.91), ring(p.x, p.top, p.z, 3.35, p.width * 0.86)],
      shades.pier,
    );
  }
}
function interpolatedRow({ a, b }, x) {
  const t = (x - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => mix(v, b[i], t));
}
function furniture(out, model, cells, tier) {
  const main = model.kind === 'main';
  for (const cell of cells) {
    const { a, b } = cell,
      length = b[0] - a[0],
      outer = [
        [0.019, -1],
        [0.981, 1],
      ];
    if (length < 0.045) continue;
    for (const [f, sign] of outer) {
      const dir = [0, 0, sign],
        h = main ? 0.98 : 1.29;
      if (tier < 2) {
        quad(
          out,
          'steel',
          'rail',
          corner(a, f, h - 0.19),
          corner(b, f, h - 0.19),
          corner(b, f, h),
          corner(a, f, h),
          dir,
        );
      } else {
        rod(out, 'steel', 'rail', corner(a, f, h), corner(b, f, h), 0.075, 0.073);
        if (tier > 2)
          rod(out, 'steel', 'mesh', corner(a, f, 0.54), corner(b, f, 0.54), 0.045, 0.044);
      }
      if (tier > 0) {
        const pitch = tier === 1 ? 13 : tier === 2 ? 6.8 : tier === 3 ? 3.9 : 3.4;
        for (let x = Math.ceil((a[0] + 0.015) / pitch) * pitch; x < b[0] - 0.015; x += pitch) {
          const row = interpolatedRow(cell, x);
          if (tier > 2)
            rod(out, 'steel', 'mesh', corner(row, f, 0.12), corner(row, f, h), 0.069, 0.066);
          else {
            const p = corner(row, f, 0.12),
              q = corner(row, f, h);
            quad(
              out,
              'steel',
              'mesh',
              [p[0] - 0.048, p[1], p[2]],
              [p[0] + 0.048, p[1], p[2]],
              [q[0] + 0.048, q[1], q[2]],
              [q[0] - 0.048, q[1], q[2]],
              dir,
            );
          }
        }
      }
    }
    if (main && tier >= 1) {
      for (const f of [0.36, 0.64]) {
        if (tier === 1)
          quad(
            out,
            'steel',
            'rail',
            corner(a, f, 0.47),
            corner(b, f, 0.47),
            corner(b, f, 0.69),
            corner(a, f, 0.69),
            [0, 0, 1],
          );
        else rod(out, 'steel', 'rail', corner(a, f, 0.65), corner(b, f, 0.65), 0.12, 0.17);
      }
    }
    if (tier >= 2) {
      const lineFractions = main ? [0.149, 0.252, 0.5, 0.748, 0.851] : [0.49];
      for (let x = Math.ceil(a[0] / 13) * 13; x < b[0]; x += 13) {
        const end = Math.min(b[0], x + 4.9);
        if (end - x < 0.09) continue;
        const c = { a: interpolatedRow(cell, x), b: interpolatedRow(cell, end) },
          w = (c.a[3] - c.a[2] + c.b[3] - c.b[2]) * 0.5;
        if (w < 3) continue;
        for (const t of lineFractions)
          strip(out, 'steel', 'white', c, t - 0.05 / w, t + 0.05 / w, 0.017);
      }
    }
  }
  const pitch = main ? 46 : 61;
  for (
    let x = Math.ceil((model.ends[0] + 18) / pitch) * pitch;
    x < model.ends[1] - 11;
    x += pitch
  ) {
    const cell = cells.find((c) => c.a[0] <= x && x < c.b[0] && !c.isBranch);
    if (!cell || tier < 1) continue;
    const row = interpolatedRow(cell, x),
      f = main ? 0.639 : 0.972,
      base = corner(row, f, 0.15),
      pole = corner(row, f, 8.35);
    if (tier === 1) {
      quad(
        out,
        'steel',
        'rail',
        [base[0] - 0.1, base[1], base[2]],
        [base[0] + 0.1, base[1], base[2]],
        [pole[0] + 0.07, pole[1], pole[2]],
        [pole[0] - 0.07, pole[1], pole[2]],
        [0, 0, 1],
      );
      continue;
    }
    loft(out, 'steel', [ring(...base, 0.195, 0.195), ring(...pole, 0.105, 0.105)], shades.rail);
    const directions = main ? [-1, 1] : [-1];
    for (const sign of directions) {
      const a = [pole[0], pole[1] + 0.62, pole[2] + sign * 1.08],
        b = [pole[0], pole[1] + 0.73, pole[2] + sign * 2.18];
      rod(out, 'steel', 'rail', pole, a, 0.107);
      rod(out, 'steel', 'rail', a, b, 0.081);
      rod(out, 'steel', 'rail', b, [b[0], b[1], b[2] + sign * 0.64], 0.27, 0.15);
      if (tier > 2)
        rod(
          out,
          'steel',
          'glass',
          [b[0], b[1] - 0.08, b[2] + sign * 0.11],
          [b[0], b[1] - 0.08, b[2] + sign * 0.6],
          0.2,
          0.024,
        );
    }
  }
}
function seamDetails(out, model, cells, tier) {
  if (tier < 2) return;
  for (const p of model.supports.filter((_, i) => i % 4 === 1)) {
    const x = p.x,
      cell = cells.find((c) => c.a[0] < x && c.b[0] > x + 0.18);
    if (!cell) continue;
    strip(
      out,
      'steel',
      'joint',
      { a: interpolatedRow(cell, x), b: interpolatedRow(cell, x + 0.15) },
      0.048,
      0.952,
      0.022,
    );
    if (tier > 2)
      for (const sign of [-1, 1]) {
        const z = p.z + sign * Math.min(3.7, p.deckWidth * 0.35);
        rod(
          out,
          'steel',
          'girder',
          [x - 2.65, p.top - 0.09, z],
          [x + 2.65, p.top - 0.09, z],
          0.24,
          0.17,
        );
      }
  }
}
export function buildHalicComponent(out, level, id) {
  const model = componentControls.find((c) => c.id === id),
    tier = tiers[level],
    cells = deckCells(model, tier);
  deckMesh(out, model, cells, tier);
  pierMesh(out, model, tier);
  furniture(out, model, cells, tier);
  seamDetails(out, model, cells, tier);
}
