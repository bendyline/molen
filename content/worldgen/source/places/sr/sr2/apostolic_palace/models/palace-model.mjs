import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { volodymyrDeckTriangles as triangulate } from '../../../../../../../../packages/worldgen/scripts/volodymyr-deck-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.88 },
  stone: { slot: 'trim', graph: 'stone_travertine', roughness: 0.81 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.73, metallic: 0.22 },
  window: { slot: 'window', graph: 'window_grid', roughness: 0.34, metallic: 0.12 },
};

const umber = [0.68, 0.47, 0.3];
const honey = [0.77, 0.559, 0.369];
const travertine = [0.8, 0.73, 0.61];
const tile = [0.62, 0.377, 0.253];
const copper = [0.34, 0.506, 0.459];
const glazed = [0.44, 0.56, 0.59];
const deepGlass = [0.29, 0.365, 0.375];
const up = [0, 1, 0];

function triangle(out, slot, points, color, toward) {
  const normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.9) return;
  const forward = normal.reduce((n, v, i) => n + v * toward[i], 0) >= 0;
  out.addTriangle(
    slot,
    '',
    forward ? points : points.toReversed(),
    forward ? normal : normal.map((v) => -v),
    undefined,
    color,
  );
}

function quad(out, slot, [a, b, c, d], color, side) {
  triangle(out, slot, [a, b, c], color, side);
  triangle(out, slot, [a, c, d], color, side);
}

function frame(a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  const u = dx / length;
  const v = dz / length;
  return {
    length,
    normal: [v, 0, -u],
    p: (x, y, outward = 0) => [a[0] + u * x + v * outward, y, a[1] + v * x - u * outward],
  };
}

function panel(out, slot, f, from, to, bottom, top, depth, color) {
  const { p, normal } = f;
  quad(
    out,
    slot,
    [p(from, bottom, depth), p(to, bottom, depth), p(to, top, depth), p(from, top, depth)],
    color,
    normal,
  );
}

function cornice(out, f, y, depth = 0.27, height = 0.27) {
  beam(out, 'stone', f.p(0, y, depth / 2), f.p(f.length, y, depth / 2), depth, height, travertine);
}

function archWindow(out, f, position, bottom, height, width, detail, loggia) {
  const { p, normal } = f;
  const half = width / 2;
  const left = position - half;
  const right = position + half;
  const spring = bottom + height - Math.min(width * 0.46, height * 0.32);
  const rise = bottom + height - spring;
  const depth = 0.085;
  const color = loggia ? glazed : deepGlass;
  panel(out, 'window', f, left, right, bottom, spring, depth, color);
  const segments = detail >= 3 ? 10 : 5;
  const arch = (i, radius, rise, offset) =>
    p(
      position + radius * Math.cos((Math.PI * i) / segments),
      spring + rise * Math.sin((Math.PI * i) / segments),
      offset,
    );
  for (let i = 0; i < segments; i++) {
    const a = arch(i, half, rise, depth);
    const b = arch(i + 1, half, rise, depth);
    triangle(out, 'window', [p(position, spring, depth), a, b], color, normal);
    if (detail >= 2)
      quad(
        out,
        'stone',
        [
          a,
          b,
          arch(i + 1, half + 0.14, rise + 0.14, depth + 0.075),
          arch(i, half + 0.14, rise + 0.14, depth + 0.075),
        ],
        travertine,
        normal,
      );
  }
  if (detail < 2) return;
  for (const edge of [left, right])
    panel(out, 'stone', f, edge - 0.11, edge + 0.11, bottom, spring, depth + 0.075, travertine);
  panel(
    out,
    'stone',
    f,
    left - 0.18,
    right + 0.18,
    bottom - 0.21,
    bottom,
    depth + 0.13,
    travertine,
  );
  if (detail >= 3 && loggia) {
    for (const t of [-0.63, -0.31, 0, 0.31, 0.63])
      beam(
        out,
        'stone',
        p(position + t * half, bottom, depth + 0.05),
        p(position + t * half, spring, depth + 0.05),
        0.045,
        0.045,
        travertine,
      );
    for (const t of [0.33, 0.66, 1])
      panel(
        out,
        'stone',
        f,
        left,
        right,
        bottom + (spring - bottom) * t,
        bottom + (spring - bottom) * t + 0.046,
        depth + 0.05,
        travertine,
      );
    for (const i of [2, 4, 6, 8])
      beam(
        out,
        'stone',
        p(position, spring, depth + 0.05),
        arch(i, half, rise, depth + 0.05),
        0.045,
        0.045,
        travertine,
      );
  }
}

function façade(out, f, detail, type, base, top) {
  if (detail === 0 || f.length < 4.6 || type === 'cover') return;
  const loggia = type === 'loggia';
  const chapel = type === 'chapel';
  cornice(out, f, top - 0.34, 0.5, 0.52);
  if (detail >= 2) {
    cornice(out, f, base + 0.75, 0.28, 0.54);
    cornice(out, f, base + (loggia ? 8.83 : 5.65), 0.25);
    if (loggia) cornice(out, f, base + 15.07, 0.44, 0.47);
  }
  const step = chapel ? 6.8 : loggia ? 5.15 : detail === 1 ? 9.4 : 5.9;
  const count = Math.max(1, Math.floor(f.length / step + 0.4));
  const spacing = f.length / count;
  for (let i = 0; i < count; i++) {
    const center = spacing * (i + 0.5);
    if (loggia && detail >= 2) {
      const x = i * spacing + 0.51;
      beam(
        out,
        'stone',
        f.p(x, base + 0.78, 0.16),
        f.p(x, top - 0.57, 0.16),
        0.4,
        0.52,
        travertine,
      );
    }
    const width = Math.min(spacing * 0.66, loggia ? 3.85 : chapel ? 2.0 : 1.42);
    const bands = chapel
      ? [[top - 10.35, 4.8]]
      : loggia
        ? [
            [base + 3.21, 5.17],
            [base + 9.21, 5.36],
            [base + 16.0, 3.34],
          ]
        : detail === 1
          ? [[top - 5.66, 2.12]]
          : [
              [base + 1.8, 2.06],
              [top - 15.55, 2.27],
              [top - 10.69, 2.44],
              [top - 5.66, 2.3],
            ];
    for (const [j, [bottom, height]] of bands.entries()) {
      if (loggia && j === 2) {
        panel(
          out,
          'window',
          f,
          center - width / 2,
          center + width / 2,
          bottom,
          bottom + height,
          0.11,
          glazed,
        );
        if (detail >= 2)
          for (const dx of [-0.5, -0.25, 0, 0.25, 0.5])
            panel(
              out,
              'stone',
              f,
              center + width * dx - 0.035,
              center + width * dx + 0.035,
              bottom,
              bottom + height,
              0.17,
              travertine,
            );
      } else if (chapel || loggia || (detail >= 3 && j === 1)) {
        archWindow(out, f, center, bottom, height, width, detail, loggia);
      } else {
        const left = center - width / 2;
        const right = center + width / 2;
        if (detail >= 2)
          panel(
            out,
            'stone',
            f,
            left - 0.14,
            right + 0.14,
            bottom - 0.18,
            bottom + height + 0.15,
            0.07,
            travertine,
          );
        panel(out, 'window', f, left, right, bottom, bottom + height, 0.12, deepGlass);
      }
    }
    if (chapel && detail >= 2 && i > 0) {
      const x = i * spacing;
      beam(out, 'brick', f.p(x, base + 1, 0.39), f.p(x, top - 1.75, 0.39), 0.93, 1.14, honey);
    }
  }
}

function shell(out, part, detail, bottom, top, finish) {
  for (const [index, ring] of part.rings.entries()) {
    const isLoggia = finish === 'palace' && index === 1;
    const color = isLoggia ? travertine : finish === 'chapel' ? honey : umber;
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length];
      const f = frame(a, b);
      panel(out, isLoggia ? 'stone' : 'brick', f, 0, f.length, bottom, top, 0, color);
      const interiorBase = index > 0 ? 0.1 : (a[0] + b[0]) * 0.037 * -1;
      façade(
        out,
        f,
        detail,
        isLoggia ? 'loggia' : finish,
        finish === 'chapel' ? 10.4 : interiorBase,
        top,
      );
    }
  }
  const [outer, ...holes] = part.rings;
  const roofColor = finish === 'chapel' ? tile : [0.48, 0.381, 0.314];
  for (const corners of triangulate(outer, holes))
    triangle(
      out,
      'tile',
      corners.map(([x, z]) => [x, top, z]),
      roofColor,
      up,
    );
}

function pitchedRoof(out, a, b, c, d, y, rise, slot, detail, hip = 0.14) {
  const at = ([x, z], h) => [x, h, z];
  const color = slot === 'copper' ? copper : tile;
  const ends = [
    [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2],
    [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2],
  ];
  const ridge = ends.map(([x, z], i) =>
    at([x + (ends[1 - i][0] - x) * hip, z + (ends[1 - i][1] - z) * hip], y + rise),
  );
  const [p, q, r, s] = [a, b, c, d].map((pt) => at(pt, y));
  quad(out, slot, [p, q, ridge[1], ridge[0]], color, up);
  quad(out, slot, [s, r, ridge[1], ridge[0]], color, up);
  triangle(out, hip > 0 ? slot : 'brick', [p, s, ridge[0]], hip > 0 ? color : honey, [
    a[0] - b[0],
    0,
    a[1] - b[1],
  ]);
  triangle(out, hip > 0 ? slot : 'brick', [q, r, ridge[1]], hip > 0 ? color : honey, [
    b[0] - a[0],
    0,
    b[1] - a[1],
  ]);
  if (detail >= 2) beam(out, slot, ridge[0], ridge[1], 0.19, 0.23, color);
  if (detail >= 3 && slot === 'copper') {
    const blend = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
    for (let i = 1; i < 14; i++) {
      beam(out, slot, blend(p, q, i / 14), blend(ridge[0], ridge[1], i / 14), 0.039, 0.084, color);
      beam(out, slot, blend(s, r, i / 14), blend(ridge[0], ridge[1], i / 14), 0.039, 0.084, color);
    }
  }
}

const ranges = [
  [[12, -24], [52, -10], [56, -18], [15, -32], 22.55, 2.85, 'copper'],
  [[12, -24], [-7, 34], [-17, 29], [3, -26], 22.54, 2.53, 'copper'],
  [[33, 49], [-7, 35], [-15, 41], [31, 56], 22.35, 2.82, 'tile'],
  [[53, -9], [33, 48], [42, 51], [62, -6], 22.41, 3.59, 'tile'],
  [[108, -4], [93, 39], [86, 36], [101, -6], 23.02, 3.35, 'tile'],
  [[95, -20], [61, -32], [57, -24], [92, -11], 22.39, 3.62, 'tile'],
  [[20, -30], [-30, -49], [-33, -41], [15, -22], 22.42, 3.15, 'tile'],
  [[-79, -19], [-43, 12], [-35, 4], [-71, -27], 22.4, 3.25, 'tile'],
  [[-87, -47], [-48, -10], [-45, -16], [-78, -50], 22.38, 2.31, 'copper'],
];

function build(out, detail) {
  const [palace, chapel, passage, annex, lantern, enclosure] = layout.parts;
  shell(out, palace, detail, -12.5, 22.35, 'palace');
  shell(out, chapel, detail, 6.5, 25.45, 'chapel');
  shell(out, passage, detail, 4.2, 19.05, 'cover');
  shell(out, annex, detail, -0.5, 20.6, 'palace');
  shell(out, lantern, detail, 22.33, 24.15, 'cover');
  shell(out, enclosure, detail, 22.33, 23.61, 'cover');
  const [a, b, c, d] = chapel.rings[0];
  pitchedRoof(out, b, c, d, a, 25.46, 5.2, 'tile', detail, 0);
  pitchedRoof(out, ...passage.rings[0], 19.08, 2.7, 'tile', detail);
  for (const [a, b, c, d, y, rise, slot] of ranges)
    pitchedRoof(out, a, b, c, d, y, rise, slot, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
