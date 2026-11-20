import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  mix,
  opening,
  pairs,
  palette,
  panel,
  pavilion,
  plane,
  rect,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const color = palette({
  wall: 'e6e0cd',
  cream: 'f1e9d8',
  shade: 'beb6a7',
  foundation: 'b7ae9c',
  tile: '985640',
  tileLit: 'a76144',
  tileRidge: '804638',
  glass: '48565b',
  wood: '646f64',
  iron: '4f5049',
});
const surfaces = {
  wall: surface('wall', 'stucco', 0.92),
  trim: surface('trim', 'stucco', 0.88),
  base: surface('foundation', 'stone_limestone_weathered', 0.94),
  tile: surface('roof', 'tile_ceramic', 0.91),
  glass: surface('window', 'storefront', 0.58, 0.04),
  wood: surface('door', 'wood_plain', 0.83),
  iron: surface('trim', 'metal_painted', 0.74, 0.18),
};
const up = [0, 1, 0];
const down = [0, -1, 0];
const wallStyle = { wall: 'wall', color: color.wall };
const archStyle = { inner: 'glass', trim: 'trim' };

function edgeBand(out, points, low, high, width, tint, slot = 'trim') {
  const sign = areaSign(points);
  for (const [a, b] of pairs(closed(points))) {
    const wall = edge(a, b, sign);
    panel(out, slot, wall, 0, wall.length, low, high, width, tint);
    face(
      out,
      slot,
      [
        wall.p(0, high),
        wall.p(wall.length, high),
        wall.p(wall.length, high, width),
        wall.p(0, high, width),
      ],
      up,
      tint,
    );
  }
}

function hip(out, [left, right, front, rear], eaves, rise, lod, overhang = 0.41) {
  const corners = [
    [left - overhang, eaves, front + overhang],
    [right + overhang, eaves, front + overhang],
    [right + overhang, eaves, rear - overhang],
    [left - overhang, eaves, rear - overhang],
  ];
  const z = (front + rear) / 2;
  const inset = Math.min((right - left) * 0.37, (front - rear) * 0.52);
  const a = [left + inset, eaves + rise, z];
  const b = [right - inset, eaves + rise, z];
  face(out, 'tile', [corners[0], corners[1], b, a], up, color.tileLit);
  face(out, 'tile', [corners[1], corners[2], b], up, color.tile);
  face(out, 'tile', [corners[2], corners[3], a, b], up, color.tile);
  face(out, 'tile', [corners[3], corners[0], a], up, color.tileLit);
  if (lod) {
    beam(out, 'tile', a, b, 0.13, 0.19, color.tileRidge);
    if (lod > 1)
      for (const [i, point] of corners.entries())
        beam(out, 'tile', point, i === 0 || i === 3 ? a : b, 0.075, 0.11, color.tileRidge);
  }
}

function column(out, [x, z], base, top, size, lod) {
  if (lod < 1) {
    block(out, 'trim', x - size * 0.5, base, z - size * 0.5, size, top - base, size, color.cream);
    return;
  }
  const radius = size * 0.49;
  const stages = [
    [base, 1.42],
    [base + 0.12, 1.42],
    [base + 0.2, 1.11],
    [base + 0.27, 1.02],
    [top - 0.37, 0.8],
    [top - 0.23, 0.91],
    [top - 0.11, 1.29],
    [top, 1.39],
  ];
  const sides = [4, 5, 8, 12][lod];
  loft(
    out,
    'trim',
    stages.map(([y, r]) => radialRing(y, radius * r, radius * r, sides, [x, z])),
    color.cream,
  );
  if (lod > 1) {
    block(
      out,
      'trim',
      x - radius * 1.38,
      top - 0.075,
      z - radius * 1.38,
      radius * 2.76,
      0.075,
      radius * 2.76,
      color.cream,
    );
    block(
      out,
      'base',
      x - radius * 1.38,
      base,
      z - radius * 1.38,
      radius * 2.76,
      0.095,
      radius * 2.76,
      color.foundation,
    );
  }
}

function recessedSash(out, wall, x, base, spring, wide, lod) {
  const colors = { inner: color.glass, trim: color.cream, width: 0.13 };
  arch(out, wall, x, base, spring, wide, wide * 0.67, 0.026, lod, colors, archStyle);
  if (lod > 0) {
    panel(
      out,
      'wood',
      wall,
      x - wide * 0.46,
      x + wide * 0.46,
      base + 0.035,
      spring - 0.03,
      0.043,
      color.wood,
    );
    panel(
      out,
      'trim',
      wall,
      x - wide - 0.13,
      x + wide + 0.13,
      base - 0.1,
      base + 0.025,
      0.1,
      color.cream,
    );
  }
  if (lod > 1) {
    panel(out, 'trim', wall, x - 0.025, x + 0.025, base, spring + wide * 0.65, 0.078, color.cream);
    for (const dir of [-1, 1]) {
      for (let i = 0; i < (lod === 3 ? 9 : 5); i++) {
        const y = mix(base + 0.12, spring - 0.15, (i + 0.5) / (lod === 3 ? 9 : 5));
        const a = Math.min(x + 0.065 * dir, x + wide * 0.45 * dir);
        const b = Math.max(x + 0.065 * dir, x + wide * 0.45 * dir);
        panel(out, 'wood', wall, a, b, y, y + 0.028, 0.065, color.shade);
      }
    }
  }
}

function ironRail(out, w, low, high, lod) {
  const offset = -0.085;
  panel(out, 'iron', w, 0.045, w.length - 0.045, high - 0.08, high, offset, color.iron);
  if (!lod) return;
  panel(out, 'iron', w, 0.045, w.length - 0.045, low + 0.06, low + 0.11, offset, color.iron);
  const count = Math.ceil(w.length / (lod === 1 ? 0.78 : 0.31));
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) / count) * w.length;
    panel(out, 'iron', w, u - 0.021, u + 0.021, low + 0.085, high - 0.055, offset, color.iron);
    if (lod > 1) {
      const a = w.p(u - 0.1, low + 0.39, offset);
      const b = w.p(u, low + 0.55, offset);
      const c = w.p(u + 0.1, low + 0.39, offset);
      const d = w.p(u, low + 0.23, offset);
      if (lod === 3) {
        beam(out, 'iron', a, b, 0.026, 0.022, color.iron);
        beam(out, 'iron', b, c, 0.026, 0.022, color.iron);
        beam(out, 'iron', c, d, 0.026, 0.022, color.iron);
        beam(out, 'iron', d, a, 0.026, 0.022, color.iron);
      } else {
        face(out, 'iron', [a, b, c, d], w.normal, color.iron);
      }
    }
  }
}

function openArch(out, w, center, left, right, base, upper, rx, spring, rise, lod) {
  const stones = [3, 6, 11, 15][lod];
  const points = Array.from({ length: stones + 1 }, (_, i) => {
    const angle = Math.PI - (Math.PI * i) / stones;
    return [center + rx * Math.cos(angle), spring + rise * Math.sin(angle)];
  });
  for (const [a, b] of [
    [left, center - rx],
    [center + rx, right],
  ]) {
    panel(out, 'wall', w, a, b, base, upper, 0, color.wall);
  }
  if (lod > 0) {
    for (const direction of [-1, 1]) {
      const u = center + rx * direction;
      face(
        out,
        'trim',
        [w.p(u, base), w.p(u, spring), w.p(u, spring, -0.28), w.p(u, base, -0.28)],
        [w.normal[2] * direction, 0, -w.normal[0] * direction],
        color.shade,
      );
    }
  }
  for (const [[a, h], [b, y]] of pairs(points)) {
    face(out, 'wall', [w.p(a, h), w.p(b, y), w.p(b, upper), w.p(a, upper)], w.normal, color.wall);
    if (lod > 0)
      face(
        out,
        'trim',
        [w.p(a, h), w.p(b, y), w.p(b, y, -0.28), w.p(a, h, -0.28)],
        down,
        color.shade,
      );
    if (lod > 0)
      face(
        out,
        'trim',
        [w.p(a, h, 0.052), w.p(b, y, 0.052), w.p(b, y + 0.137, 0.065), w.p(a, h + 0.137, 0.065)],
        w.normal,
        color.cream,
      );
  }
}

function veranda(out, w, floor, gallery, soffit, bays, lod) {
  const step = w.length / bays;
  for (let i = 0; i < bays; i++) {
    const a = step * i;
    const b = step * (i + 1);
    const mid = (a + b) / 2;
    openArch(out, w, mid, a, b, floor, gallery - 0.04, step * 0.386, floor + 2.19, 0.79, lod);
    if (i > 0)
      panel(out, 'trim', w, a - 0.115, a + 0.115, floor + 0.05, gallery - 0.3, 0.095, color.cream);
  }
  panel(out, 'trim', w, 0, w.length, gallery - 0.225, gallery + 0.12, 0.135, color.cream);
  panel(out, 'trim', w, 0, w.length, soffit - 0.18, soffit + 0.025, 0.115, color.cream);
  ironRail(out, w, gallery + 0.15, gallery + 1.05, lod);
  for (let i = 0; i <= bays; i++) {
    const [x, , z] = w.p(Math.max(0.12, Math.min(w.length - 0.12, step * i)), gallery, -0.15);
    column(out, [x, z], gallery + 0.11, soffit - 0.11, 0.42, lod);
  }
}

function carriagePorch(out, d, floor, gallery, eaves, grade, lod) {
  const points = d.porch;
  const z = points[3][1];
  const foot = grade([0.22, z + 0.4]) + 0.15;
  const sign = areaSign(d.villa);
  const deck = points.map((point) => [...point]);
  cap(out, 'base', deck, foot, color.foundation);
  cap(out, 'trim', deck, gallery, color.cream);
  for (const [i, [a, b]] of pairs(points).entries()) {
    const w = edge(a, b, sign);
    const crossing = i === 0 || i === points.length - 2;
    const base = Math.min(floor - 0.21, foot + 0.09);
    const pieces = [2, 3, 5, 8][lod];
    const edgeHeights = Array.from({ length: pieces + 1 }, (_, k) => {
      const t = k / pieces;
      const x = mix(a[0], b[0], t);
      const sideDistance = Math.abs(x - 0.25) / 4.62;
      return [
        w.length * t,
        crossing
          ? base
          : base + 2.46 + 1.68 * Math.sqrt(Math.max(0, 1 - sideDistance * sideDistance)),
      ];
    });
    for (const [[l, ly], [r, ry]] of pairs(edgeHeights)) {
      face(
        out,
        'wall',
        [w.p(l, ly), w.p(r, ry), w.p(r, gallery), w.p(l, gallery)],
        w.normal,
        color.wall,
      );
      if (!crossing) {
        face(
          out,
          'trim',
          [w.p(l, ly), w.p(r, ry), w.p(r, ry, -0.34), w.p(l, ly, -0.34)],
          down,
          color.shade,
        );
        if (lod)
          face(
            out,
            'trim',
            [w.p(l, ly, 0.06), w.p(r, ry, 0.06), w.p(r, ry + 0.17, 0.08), w.p(l, ly + 0.17, 0.08)],
            w.normal,
            color.cream,
          );
      }
    }
    panel(out, 'trim', w, 0, w.length, gallery - 0.19, gallery + 0.12, 0.127, color.cream);
    ironRail(out, w, gallery + 0.15, gallery + 1.12, lod);
  }
  for (const i of [0, 1, 2, 4, 5, 6]) {
    const [x, z] = points[i];
    column(out, [mix(x, 0.24, 0.045), mix(z, 7.3, 0.08)], gallery + 0.12, eaves - 0.12, 0.45, lod);
  }
  const stepCount = lod ? 6 : 3;
  for (let i = 0; i < stepCount; i++) {
    const top = mix(foot, floor + 0.12, (i + 1) / stepCount);
    block(
      out,
      'base',
      -1.6,
      foot - 0.1,
      3.07 + (2.15 * (stepCount - i - 1)) / stepCount,
      3.6,
      top - foot + 0.1,
      2.23 / stepCount,
      color.foundation,
    );
  }
}

function porchRoof(out, points, l, r, eaves, lod) {
  const ordered = [...points].reverse().map(([x, z]) => [mix(x, 0.25, -0.072), z + 0.34]);
  const apex = [0.24, eaves + 1.94, l];
  const ridgeRear = [0.24, eaves + 1.94, r];
  const [a, b] = [ordered[0], ordered.at(-1)];
  const left = [a[0], l - 1.6];
  const right = [b[0], l - 1.6];
  for (const [p, q] of pairs(ordered)) {
    face(out, 'tile', [at(p, eaves), at(q, eaves), apex], up, color.tileLit);
  }
  face(out, 'tile', [at(left, eaves), at(a, eaves), apex, ridgeRear], up, color.tile);
  face(out, 'tile', [at(b, eaves), at(right, eaves), ridgeRear, apex], up, color.tile);
  if (lod > 1) beam(out, 'tile', apex, ridgeRear, 0.12, 0.14, color.tileRidge);
}

function eaveDetail(out, outline, eaves, lod) {
  edgeBand(out, outline, eaves - 0.22, eaves, 0.18, color.cream);
  if (lod < 2) return;
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    const count = Math.max(1, Math.floor(w.length / (lod === 3 ? 0.42 : 0.61)));
    for (let i = 0; i < count; i++) {
      const u = (w.length * (i + 0.5)) / count;
      face(
        out,
        'trim',
        [
          w.p(u - 0.07, eaves - 0.16, 0.185),
          w.p(u + 0.07, eaves - 0.16, 0.185),
          w.p(u, eaves - 0.33, 0.19),
        ],
        w.normal,
        color.shade,
      );
    }
  }
}

function villa(out, d, grade, lod) {
  const y = d.floorY;
  const gallery = y + d.storeyHeight;
  const eaves = y + d.eaveHeight;
  const [l, r, f, b] = d.villaBody;
  const core = rect(l + 2.06, f - 2.34, r - 2.02, b + 0.21);
  const outer = rect(l, f, r, b);
  const rear = edge(outer[2], outer[3], -1);
  shell(out, core, (p) => Math.min(grade(p), y - 0.15) - 0.26, eaves - 0.12, wallStyle);
  cap(out, 'base', outer, y, color.foundation);
  cap(out, 'trim', outer, gallery, color.cream);
  const coreFace = plane(f - 2.34, 1);
  for (const x of [-6.1, -3.0, 0.24, 3.44, 6.55, 9.4]) {
    const tall = Math.abs(x - 0.24) < 0.04;
    recessedSash(out, coreFace, x, y + (tall ? 0.1 : 1.34), y + 2.5, tall ? 0.83 : 0.66, lod);
    recessedSash(out, coreFace, x, gallery + 0.46, gallery + 2.67, 0.72, lod);
  }
  for (const [a, b] of [
    [core[1], core[2]],
    [core[3], core[0]],
  ]) {
    const w = edge(a, b, -1);
    for (const frac of [0.18, 0.5, 0.82]) {
      recessedSash(out, w, w.length * frac, y + 0.97, y + 2.63, 0.68, lod);
      recessedSash(out, w, w.length * frac, gallery + 0.6, gallery + 2.75, 0.71, lod);
    }
  }
  const porchLeft = d.porch.at(-1)[0];
  const porchRight = d.porch[0][0];
  const verandas = [
    [edge([l, f], [porchLeft, f], -1), 2],
    [edge([porchRight, f], [r, f], -1), 2],
    [edge(outer[1], outer[2], -1), 3],
    [edge(outer[3], outer[0], -1), 3],
  ];
  for (const [w, bays] of verandas) {
    const p = w.p(0, 0);
    const q = w.p(w.length, 0);
    face(
      out,
      'base',
      [
        w.p(0, Math.min(grade([p[0], p[2]]), y - 0.04) - 0.17),
        w.p(w.length, Math.min(grade([q[0], q[2]]), y - 0.04) - 0.17),
        w.p(w.length, y),
        w.p(0, y),
      ],
      w.normal,
      color.foundation,
    );
    veranda(out, w, y, gallery, eaves - 0.17, bays, lod);
  }
  panel(out, 'wall', rear, 0, rear.length, y - 0.45, eaves, -0.015, color.wall);
  for (const x of [2.25, 6, rear.length - 2.28])
    recessedSash(out, rear, x, gallery + 0.61, gallery + 2.73, 0.69, lod);
  carriagePorch(out, d, y, gallery, eaves, grade, lod);
  eaveDetail(out, outer, eaves, lod);
  eaveDetail(out, d.porch, eaves, lod);
  hip(out, d.villaBody, eaves + 0.025, d.mainRoofRise, lod, 0.48);
  porchRoof(out, d.porch, f + 1.9, f - 4.3, eaves + 0.019, lod);
}

function rearExtension(out, d, grade, lod) {
  const y = d.floorY;
  const eaves = y + 5.71;
  const roof = y + d.extensionRidgeHeight;
  const outline = d.extension;
  shell(out, outline, (point) => Math.min(grade(point) - 0.22, y - 0.13), eaves, wallStyle);
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    if (w.length < 6.6) continue;
    const bays = Math.max(2, Math.round(w.length / 4.15));
    for (let i = 0; i < bays; i++) {
      const x = ((i + 0.5) / bays) * w.length;
      opening(
        out,
        w,
        x - 0.63,
        x + 0.63,
        y + 2.72,
        y + 4.52,
        'trim',
        color.glass,
        'glass',
        color.cream,
        lod,
        0.025,
      );
    }
  }
  edgeBand(out, outline, eaves - 0.16, eaves + 0.032, 0.08, color.cream);
  hip(out, [-19.86, 13.55, -12.02, -25.57], eaves, roof - eaves, lod);
  hip(out, [-4.42, 5.86, -23.59, -28.76], eaves + 0.018, 1.22, lod, 0.3);
  block(out, 'wall', -2.83, y - 0.35, -12.28, 5.65, 5.1, 2.89, color.wall);
  block(out, 'tile', -2.94, y + 4.74, -12.43, 5.86, 0.15, 3.1, color.tileRidge);
}

function build(out, lod, dimensions, grade) {
  rearExtension(out, dimensions, grade, lod);
  villa(out, dimensions, grade, lod);
}

const asset = pavilion(
  import.meta.url,
  {
    surfaces,
    brief:
      'Conserved Wan Qing Yuan villa with a curved carriage porch, open Corinthian verandas, iron balustrades, terracotta hipped roofs and a connected rear memorial hall extension.',
    camera: [38, 24, 54],
    lookAt: [-1, 4.9, -3],
    yaw: 0.7,
    sun: [-240, 470, 590],
    views: [
      { name: 'carriage-porch-and-upper-gallery', position: [2, 6.5, 38], lookAt: [0.6, 6, 5] },
      { name: 'hipped-terracotta-and-verandas', position: [-29, 26, 33], lookAt: [1, 7, 1] },
      { name: 'rear-memorial-hall-extension', position: [-30, 24, -50], lookAt: [-1, 5.5, -12] },
      { name: 'louvres-and-columned-balustrade', position: [24, 10, 23], lookAt: [6, 7, 4] },
    ],
  },
  build,
);
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
export const { skyline, district, street, closeup } = asset;
export const model = {
  ...asset.model,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis:
      'OpenStreetMap measured joint footprint of the villa and rear extension at 12 Tai Gin Road.',
  },
};
