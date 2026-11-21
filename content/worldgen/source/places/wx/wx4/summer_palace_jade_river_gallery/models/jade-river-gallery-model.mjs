import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, frame, solid, up } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  masonry: { slot: 'wall', graph: 'brick_longformat' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
};

const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
const stone = [0.55, 0.54, 0.48];
const step = [0.63, 0.62, 0.55];
const tile = [0.29, 0.285, 0.265];
const red = [0.48, 0.19, 0.135];
const darkRed = [0.33, 0.125, 0.09];
const soffit = [0.22, 0.174, 0.137];
const paintedPost = [0.17, 0.255, 0.177];
const warmWhite = [0.73, 0.715, 0.65];
const ochre = [0.5, 0.29, 0.135];
const jade = [0.18, 0.36, 0.31];
const blue = [0.13, 0.26, 0.37];
const gold = [0.61, 0.48, 0.215];
const relief = [0.61, 0.599, 0.555];
const incised = [0.485, 0.473, 0.425];

function galleryFrame(out, start, end) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  return { length, mesh: frame(out, start, 0, Math.atan2(dz, dx)) };
}

function plinth(out, length, detail) {
  box(out, 'stone', [0.07, -1.18, -1.21], [length - 0.07, 0.13, 1.21], stone);
  box(out, 'stone', [0.05, 0.13, -1.28], [length - 0.05, 0.24, 1.28], step);
  box(out, 'stone', [0.05, -0.11, 1.21], [length - 0.05, 0.06, 1.55], step);
  if (detail < 2) return;
  const count = Math.ceil(length / 0.74);
  for (let i = 0; i < count; i++) {
    const x0 = Math.max(0.05, (i * length) / count) + 0.009;
    const x1 = Math.min(length - 0.05, ((i + 1) * length) / count) - 0.009;
    const shade = 1 - (i % 4) * 0.018;
    box(
      out,
      'stone',
      [x0, 0.24, -1.273],
      [x1, 0.262, 1.275],
      step.map((v) => v * shade),
    );
  }
}

function roof(out, length, width, detail) {
  const half = width / 2;
  const eave = 2.8;
  const ridge = 0.92;
  const profile = detail ? [0, 0.36, 0.68, 1] : [0, 1];
  const point = (x, t, side) => [x, eave + ridge * t * (0.48 + 0.52 * t), side * half * (1 - t)];
  for (const side of [-1, 1]) {
    for (let i = 1; i < profile.length; i++) {
      const a = profile[i - 1];
      const b = profile[i];
      const course = [
        point(0, a, side),
        point(length, a, side),
        point(length, b, side),
        point(0, b, side),
      ];
      face(out, 'tile', course, tile, up);
      face(
        out,
        'timber',
        course.map(([x, y, z]) => [x, y - 0.065, z]),
        soffit,
        [0, -1, 0],
      );
      if (detail)
        for (const x of [0.045, length - 0.045])
          beam(out, 'tile', point(x, a, side), point(x, b, side), 0.11, 0.12, tile);
    }
    box(
      out,
      'timber',
      [0, eave - 0.117, side * half - 0.064],
      [length, eave - 0.024, side * half + 0.064],
      darkRed,
    );
    if (detail < 2) continue;
    const count = Math.ceil(length / (detail >= 3 ? 0.2 : 0.34));
    for (let i = 0; i < count; i++) {
      const x = ((i + 0.5) * length) / count;
      const stops = detail >= 3 ? profile : [0, 0.17];
      for (let j = 1; j < stops.length; j++)
        beam(
          out,
          'tile',
          point(x, stops[j - 1], side),
          point(x, stops[j], side),
          0.074,
          0.064,
          tile,
        );
      if (detail >= 3)
        tube(out, 'tile', point(x, 0.019, side), point(x, -0.018, side), 0.042, tile, 6);
    }
  }
  beam(out, 'tile', point(0, 1, 1), point(length, 1, 1), 0.16, 0.19, tile);
}

function paintedBeam(out, left, right, z, detail) {
  box(out, 'timber', [left, 2.485, z - 0.069], [right, 2.775, z + 0.069], jade);
  if (detail < 2) return;
  const center = (left + right) / 2;
  const run = right - left;
  box(out, 'timber', [left + 0.14, 2.54, z + 0.07], [right - 0.14, 2.72, z + 0.092], blue);
  for (const end of [-1, 1]) {
    const x = center + end * (run / 2 - 0.245);
    face(
      out,
      'timber',
      [
        [x, 2.566, z + 0.094],
        [x + end * 0.1, 2.619, z + 0.094],
        [x, 2.686, z + 0.094],
        [x - end * 0.18, 2.619, z + 0.094],
      ],
      gold,
      [0, 0, 1],
    );
  }
  if (detail >= 3) {
    for (const y of [2.533, 2.722])
      box(out, 'timber', [left + 0.118, y, z + 0.074], [right - 0.118, y + 0.013, z + 0.096], gold);
  }
}

function displayPanel(out, x, width, detail, index) {
  const low = 1.035,
    high = 1.835,
    z = -0.978;
  box(out, 'timber', [x - width / 2, low, -1.052], [x + width / 2, high, z], ochre);
  if (detail < 2) return;
  const left = x - width / 2 + 0.029,
    right = x + width / 2 - 0.029;
  box(out, 'stone', [left, low + 0.048, z - 0.009], [right, high - 0.048, z + 0.005], relief);
  if (detail < 3) return;
  // Represent the incised surface without reproducing the individual designs.
  for (let row = 0; row < 4; row++) {
    const y = 1.17 + row * 0.107;
    const shift = ((index % 3) - 1) * 0.047;
    beam(
      out,
      'stone',
      [left + 0.015, y, z + 0.006],
      [right - 0.015, y + shift, z + 0.006],
      0.009,
      0.006,
      incised,
    );
  }
}

function paintedCrossbeam(out, x, width, detail) {
  box(out, 'timber', [x - 0.125, 2.433, -1.104], [x + 0.125, 2.735, 1.205], jade);
  if (detail < 2) return;
  // Inset cartouche, gold framing and blue shoulders appear on both approaches.
  for (const sign of [-1, 1]) {
    const panel = (offset, y0, y1, z0, z1, color) => {
      const side = x + sign * offset;
      face(
        out,
        'timber',
        [
          [side, y0, -z0],
          [side, y0, z0],
          [side, y1, z1],
          [side, y1, -z1],
        ],
        color,
        [sign, 0, 0],
      );
    };
    panel(0.126, 2.458, 2.706, 0.62, 0.67, blue);
    panel(0.128, 2.485, 2.679, 0.46, 0.53, gold);
    panel(0.13, 2.516, 2.648, 0.39, 0.45, warmWhite);
  }
  if (detail < 3) return;
  for (const side of [-1, 1])
    beam(out, 'timber', [x, 2.722, side * width * 0.47], [x, 3.49, 0], 0.103, 0.117, darkRed);
}

function galleryRail(out, x, end, detail) {
  const left = x + 0.095,
    right = end - 0.095;
  box(out, 'timber', [left, 0.562, 0.98], [right, 0.64, 1.195], jade);
  if (detail < 2) return;
  const z0 = 1.028,
    z1 = 1.097;
  box(out, 'timber', [left, 0.333, z0], [right, 0.388, z1], darkRed);
  for (let i = 1; i <= 5; i++) {
    const t = left + ((right - left) * i) / 6;
    box(out, 'timber', [t - 0.019, 0.388, z0], [t + 0.019, 0.567, z1], red);
  }
  box(out, 'timber', [left, 2.205, z0], [right, 2.25, z1], red);
  if (detail < 3) return;
  box(out, 'timber', [left, 2.364, z0], [right, 2.404, z1], red);
  for (let i = 1; i <= 8; i++) {
    const t = left + ((right - left) * i) / 9;
    box(out, 'timber', [t - 0.017, 2.243, z0], [t + 0.017, 2.486, z1], i % 3 ? jade : red);
  }
}

function gallery(out, span, detail) {
  const { mesh, length } = galleryFrame(out, span.start, span.end);
  const spacing = (length - 0.28) / span.bays;
  plinth(mesh, length, detail);
  roof(mesh, length, span.width, detail);
  box(mesh, 'masonry', [0.14, 0.24, -1.221], [length - 0.14, 0.956, -1.047], [0.425, 0.425, 0.387]);
  box(mesh, 'plaster', [0.14, 0.956, -1.218], [length - 0.14, 2.755, -1.051], warmWhite);
  for (let i = 0; i <= span.bays; i++) {
    const x = 0.14 + i * spacing;
    const post = i === 0 || i === span.bays ? red : paintedPost;
    if (detail > 1) tube(mesh, 'stone', [x, 0.24, 1.02], [x, 0.423, 1.02], 0.155, stone, 8);
    box(
      mesh,
      'timber',
      [x - 0.105, detail > 1 ? 0.421 : 0.24, 0.915],
      [x + 0.105, 2.7, 1.125],
      post,
    );
    if (detail > 0) {
      box(mesh, 'timber', [x - 0.171, 2.43, 0.866], [x + 0.171, 2.601, 1.174], jade);
      paintedCrossbeam(mesh, x, span.width, detail);
    }
    if (i === span.bays) continue;
    paintedBeam(mesh, x + 0.005, x + spacing - 0.005, 1.02, detail);
    if (!detail) continue;
    galleryRail(mesh, x, x + spacing, detail);
    const count = span.threePanelBays.includes(i) ? 3 : 4;
    for (let j = 0; j < count; j++)
      displayPanel(mesh, x + ((j + 0.5) * spacing) / count, (spacing / count) * 0.85, detail, i);
  }
}

function pavilion(out, { center, roofRadius, plinthRadius }, detail) {
  const ring = (h, r) => radialRing(h, r, r, 8, center, Math.PI / 8);
  const outline = (r) => ring(0, r).map(([x, , z]) => [x, z]);
  solid(out, 'stone', outline(plinthRadius), -1.18, 0.17, stone);
  solid(out, 'stone', outline(plinthRadius + 0.11), 0.17, 0.276, step);
  const col = ring(0, 2.6);
  for (let i = 0; i < col.length; i++) {
    const [x, , z] = col[i];
    const [u, , v] = col[(i + 1) % col.length];
    if (detail) {
      tube(out, 'stone', [x, 0.276, z], [x, 0.455, z], 0.215, step, 8);
      tube(out, 'timber', [x, 0.425, z], [x, 3.19, z], 0.142, red, detail >= 2 ? 12 : 6);
    } else {
      box(out, 'timber', [x - 0.13, 0.276, z - 0.13], [x + 0.13, 3.19, z + 0.13], red);
    }
    beam(out, 'timber', [x, 3.01, z], [u, 3.01, v], 0.22, 0.24, jade);
    if (detail < 1) continue;
    beam(out, 'timber', [x, 3.13, z], [u, 3.13, v], 0.28, 0.09, blue);
    // The openings on the side facing the covered gallery remain clear.
    if (i === 0 || i === 6 || i === 7) continue;
    beam(out, 'timber', [x, 0.79, z], [u, 0.79, v], 0.08, 0.11, darkRed);
    beam(out, 'timber', [x, 0.49, z], [u, 0.49, v], 0.063, 0.08, darkRed);
    if (detail >= 2)
      for (let j = 1; j < 7; j++) {
        const t = j / 7;
        const sx = x + (u - x) * t;
        const sz = z + (v - z) * t;
        beam(out, 'timber', [sx, 0.49, sz], [sx, 0.79, sz], 0.036, 0.042, red);
      }
  }
  const profiles = detail
    ? [
        [3.26, roofRadius],
        [3.45, roofRadius * 0.73],
        [3.88, roofRadius * 0.42],
        [4.66, 0.17],
      ]
    : [
        [3.26, roofRadius],
        [3.6, roofRadius * 0.62],
        [4.66, 0.17],
      ];
  const rings = profiles.map(([height, radius], index) =>
    ring(height, radius).map(([x, y, z]) => [x, y + (index === 0 ? 0.175 : 0), z]),
  );
  const ceiling = ring(3.24, roofRadius * 0.89);
  for (let i = 0; i < 8; i++) {
    face(
      out,
      'timber',
      [[center[0], 3.24, center[1]], ceiling[i], ceiling[(i + 1) % 8]],
      soffit,
      [0, -1, 0],
    );
  }
  // Put a lower eave point between corners to describe the roof's upturned tips.
  const eave = rings[0];
  const point = (poly, i, t) => {
    const a = poly[i];
    const b = poly[(i + 1) % 8];
    return a.map((v, axis) => v + t * (b[axis] - v));
  };
  const roofPoint = (row, edge, t) => {
    const p = point(rings[row], edge, t);
    if (!row) p[1] -= Math.sin(Math.PI * t) * 0.175;
    return p;
  };
  for (let i = 0; i < 8; i++) {
    const subdivisions = detail >= 2 ? 4 : 2;
    for (let j = 0; j < subdivisions; j++)
      for (let row = 1; row < rings.length; row++) {
        const a = j / subdivisions;
        const b = (j + 1) / subdivisions;
        face(
          out,
          'tile',
          [
            roofPoint(row - 1, i, a),
            roofPoint(row - 1, i, b),
            roofPoint(row, i, b),
            roofPoint(row, i, a),
          ],
          tile,
          up,
        );
      }
    if (detail)
      for (let row = 1; row < rings.length; row++)
        beam(out, 'tile', rings[row - 1][i], rings[row][i], 0.13, 0.135, tile);
    if (detail >= 2) {
      const count = detail >= 3 ? 14 : 8;
      for (let j = 1; j < count; j++)
        for (let row = 1; row < (detail >= 3 ? rings.length : 2); row++)
          beam(
            out,
            'tile',
            roofPoint(row - 1, i, j / count),
            roofPoint(row, i, j / count),
            0.071,
            0.06,
            tile,
          );
    }
    if (detail) {
      for (let j = 1; j <= subdivisions; j++)
        beam(
          out,
          'timber',
          roofPoint(0, i, (j - 1) / subdivisions),
          roofPoint(0, i, j / subdivisions),
          0.12,
          0.12,
          darkRed,
        );
      beam(
        out,
        'timber',
        [col[i][0], 3.225, col[i][2]],
        [eave[i][0], 3.335, eave[i][2]],
        0.115,
        0.125,
        darkRed,
      );
    }
  }
  const finial = [
    [4.57, 0.18],
    [4.7, 0.2],
    [4.79, 0.155],
    [4.85, 0.092],
    [4.97, 0.137],
    [5.07, 0.078],
    [5.15, 0.026],
  ];
  loft(
    out,
    'tile',
    finial.map(([y, r]) => ring(y, r)),
    tile,
  );
}

function build(out, detail) {
  for (const span of layout.spans) gallery(out, span, detail);
  pavilion(out, layout.pavilion, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
