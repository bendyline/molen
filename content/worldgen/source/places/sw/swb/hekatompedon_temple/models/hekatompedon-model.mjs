import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { buildPediments } from './hekatompedon-pediments.mjs';

export const surfaces = {
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.92, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.89, metallic: 0 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.77, metallic: 0 },
  clay: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  paint: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
};

export const dimensions = {
  length: 47.2,
  width: 24,
  height: 13.94,
  step: 1.08,
  architrave: 8.25,
  soffit: 10.68,
  pedimentBase: 10.88,
  cornerX: 21.725,
  cornerZ: 10.15,
  flankBays: 11,
  endBays: 5,
};

const limestone = [0.74, 0.65, 0.49];
const lightStone = [0.81, 0.72, 0.57];
const footing = [0.53, 0.465, 0.362];
const marble = [0.84, 0.79, 0.69];
const ironRed = [0.54, 0.126, 0.078];
const indigo = [0.106, 0.191, 0.258];
const shade = [0.29, 0.241, 0.171];
const clay = [0.53, 0.32, 0.187];
const timber = [0.229, 0.133, 0.074];
const ref = 'palette:#ffffff';
const tint = (color, factor) => color.map((value) => value * factor);
const vec = (x, y, z) => [x, y, z];
const plate = (out, material, points, color) =>
  out.addQuad(material, ref, points, normalFor(...points), [], color);
const {
  length,
  width,
  height,
  step,
  architrave,
  soffit,
  pedimentBase,
  cornerX,
  cornerZ,
  flankBays,
  endBays,
} = dimensions;
export const columns = [
  ...[-1, 1].flatMap((side) =>
    Array.from({ length: flankBays + 1 }, (_, i) => [
      -cornerX + (2 * cornerX * i) / flankBays,
      side * cornerZ,
    ]),
  ),
  ...[-1, 1].flatMap((side) =>
    Array.from({ length: endBays - 1 }, (_, i) => [
      side * cornerX,
      -cornerZ + (2 * cornerZ * (i + 1)) / endBays,
    ]),
  ),
];

function platform(out, detail) {
  const treads = [
    [length, width, -0.62, 0.32],
    [46.32, 23.13, 0.32, 0.7],
    [45.48, 22.36, 0.7, step],
  ];
  for (const [i, [dx, dz, y0, y1]] of treads.entries()) {
    box(out, 'base', [-dx / 2, y0, -dz / 2], [dx / 2, y1, dz / 2], tint(footing, 1 + i * 0.08));
    if (detail < 2) continue;
    for (const side of [-1, 1]) {
      const lengthCount = 22;
      for (let index = 1; index < lengthCount; index++) {
        const x = -dx / 2 + ((index + (i === 1 ? 0.33 : 0)) * dx) / lengthCount;
        box(
          out,
          'stone',
          [x - 0.008, Math.max(0.07, y0 + 0.04), (side * dz) / 2 - 0.006],
          [x + 0.008, y1 - 0.04, (side * dz) / 2 + 0.006],
          shade,
        );
      }
      for (let index = 1; index < 11; index++) {
        const z = -dz / 2 + ((index + (i === 1 ? 0.33 : 0)) * dz) / 11;
        box(
          out,
          'stone',
          [(side * dx) / 2 - 0.006, Math.max(0.07, y0 + 0.04), z - 0.008],
          [(side * dx) / 2 + 0.006, y1 - 0.04, z + 0.008],
          shade,
        );
      }
    }
  }
}

function column(out, x, z, detail, porch = false) {
  const radiusScale = porch ? 0.69 : 1;
  const bottom = porch ? 1.39 : step;
  const top = porch ? 7.65 : architrave;
  const center = [x, z];
  const fluteDepth = detail >= 3 ? 0.065 : 0.053;
  const subdivisions = detail >= 3 ? 3 : 2;
  const simpleSides = detail === 0 ? 6 : 12;
  const shaftRing = (y, radius) => {
    if (detail <= 1)
      return radialRing(y, radius * radiusScale, radius * radiusScale, simpleSides, center);
    return Array.from({ length: 20 * subdivisions }, (_, i) => {
      const angle = (-i * Math.PI * 2) / (20 * subdivisions);
      const flute = i % subdivisions;
      const r = (radius - (flute === 0 ? 0 : fluteDepth)) * radiusScale;
      return [x + Math.cos(angle) * r, y, z + Math.sin(angle) * r];
    });
  };
  const shaft = [
    [bottom, 1.02],
    [top - 0.76, 0.71],
  ];
  if (detail >= 3)
    shaft.splice(
      1,
      0,
      [bottom + (top - bottom) * 0.44, 0.902],
      [bottom + (top - bottom) * 0.72, 0.804],
    );
  loft(
    out,
    'stone',
    shaft.map(([y, r]) => shaftRing(y, r)),
    lightStone,
    { cap: false },
  );
  if (detail >= 2) {
    const echinus = [
      [-0.76, 0.72],
      [-0.68, 0.75],
      [-0.56, 0.86],
      [-0.43, 1.05],
      [-0.32, 1.18],
    ];
    const sides = detail >= 3 ? 28 : 12;
    const profile = detail >= 3 ? echinus : [echinus[0], echinus[2], echinus[4]];
    loft(
      out,
      'stone',
      profile.map(([y, r]) => radialRing(top + y, r * radiusScale, r * radiusScale, sides, center)),
      limestone,
      { cap: false },
    );
    if (detail >= 3) {
      for (const y of [-0.745, -0.71, -0.675]) {
        const r = 0.748 * radiusScale;
        loft(
          out,
          'stone',
          [
            radialRing(top + y - 0.006, r, r, 24, center),
            radialRing(top + y + 0.006, r, r, 24, center),
          ],
          shade,
          { cap: false },
        );
      }
    }
  }
  const a = 1.185 * radiusScale;
  if (detail === 0) {
    const ring = (y) => [
      [x - a, y, z - a],
      [x - a, y, z + a],
      [x + a, y, z + a],
      [x + a, y, z - a],
    ];
    loft(out, 'stone', [ring(top - 0.77), ring(top)], limestone, { cap: false });
    return;
  }
  box(
    out,
    'stone',
    [x - a, top - (detail < 2 ? 0.77 : 0.32), z - a],
    [x + a, top, z + a],
    limestone,
  );
}

const ends = [
  { axis: 'x', sign: -1, radius: cornerX, span: cornerZ, bays: endBays },
  { axis: 'x', sign: 1, radius: cornerX, span: cornerZ, bays: endBays },
  { axis: 'z', sign: -1, radius: cornerZ, span: cornerX, bays: flankBays },
  { axis: 'z', sign: 1, radius: cornerZ, span: cornerX, bays: flankBays },
];
function entablature(out, detail) {
  for (const { axis, sign, radius, span, bays } of ends) {
    const point = (along, y, across) =>
      axis === 'x'
        ? vec(sign * (radius + across), y, along)
        : vec(along, y, sign * (radius + across));
    const block = (slot, a, b, y0, y1, d0, d1, color) => {
      const p = point(a, y0, d0),
        q = point(b, y1, d1);
      box(
        out,
        slot,
        p.map((v, i) => Math.min(v, q[i])),
        p.map((v, i) => Math.max(v, q[i])),
        color,
      );
    };
    const reach = span + (axis === 'x' ? 1.15 : 0);
    block('stone', -reach, reach, architrave, 9.25, -0.99, 1.15, limestone);
    block('stone', -reach, reach, 9.25, 10.24, -0.95, 1.12, lightStone);
    block('stone', -reach, reach, 10.24, soffit, -1.02, 1.51, limestone);
    if (detail === 0) continue;
    block('paint', -reach, reach, 9.16, 9.24, 1.145, 1.18, ironRed);
    block('paint', -reach, reach, 10.23, 10.33, 1.13, 1.44, ironRed);
    for (let i = 0; i <= 2 * bays; i++) {
      const along = -span + (span * i) / bays;
      block('paint', along - 0.37, along + 0.37, 9.28, 10.23, 1.13, 1.22, indigo);
      if (detail < 2) continue;
      for (const groove of [-0.185, 0, 0.185]) {
        const a = along + groove - 0.039,
          b = along + groove + 0.039;
        const points = [
          point(a, 9.31, 1.221),
          point(b, 9.31, 1.221),
          point(b, 10.2, 1.221),
          point(a, 10.2, 1.221),
        ];
        plate(
          out,
          'paint',
          sign === (axis === 'x' ? -1 : 1) ? points : points.reverse(),
          tint(indigo, 0.64),
        );
      }
      if (detail < 3) continue;
      block('paint', along - 0.4, along + 0.4, 9.02, 9.13, 1.16, 1.27, ironRed);
      for (const drop of [-0.28, -0.14, 0, 0.14, 0.28])
        block(
          'marble',
          along + drop - 0.036,
          along + drop + 0.036,
          8.931,
          9.02,
          1.174,
          1.245,
          marble,
        );
    }
  }
}

function sanctuary(out, detail) {
  const lo = -15.7,
    hi = 15.4,
    w = 6.64;
  box(out, 'stone', [lo - 1, step, -w - 0.5], [hi + 2.8, 1.39, w + 0.5], lightStone);
  for (const sign of [-1, 1])
    box(out, 'stone', [lo, 1.39, sign * w - 0.44], [hi, 8.9, sign * w + 0.44], limestone);
  if (detail === 0) {
    box(out, 'stone', [lo, 1.39, -w], [hi, 8.88, w], shade);
    return;
  }
  for (const [x, opening] of [
    [lo, 1.58],
    [hi, 2.05],
  ]) {
    box(out, 'stone', [x - 0.46, 1.39, -w], [x + 0.46, 8.89, -opening], limestone);
    box(out, 'stone', [x - 0.46, 1.39, opening], [x + 0.46, 8.89, w], limestone);
    box(out, 'stone', [x - 0.46, 5.55, -opening], [x + 0.46, 8.89, opening], limestone);
    for (const sign of [-1, 1])
      box(
        out,
        'marble',
        [x - 0.63, 1.39, sign * opening - 0.2],
        [x + 0.63, 5.9, sign * opening + 0.2],
        marble,
      );
    box(out, 'marble', [x - 0.65, 5.62, -opening - 0.32], [x + 0.65, 5.91, opening + 0.32], marble);
  }
  for (const z of [-4.28, 4.28]) column(out, 18.01, z, detail, true);
  box(out, 'wood', [14.88, 1.44, 1.85], [15.09, 5.58, 2.03], timber);
  box(out, 'wood', [13.51, 1.44, 1.68], [15.15, 5.49, 1.81], timber);
  if (detail < 2) return;
  for (const z of [-4.45, 4.45]) {
    for (const x of [-9.5, -5, 0, 5, 9.5]) column(out, x, z, detail === 3 ? 2 : 1, true);
    beam(out, 'wood', [-14.62, 7.62, z], [14.62, 7.62, z], 0.53, 0.63, timber);
  }
  if (detail < 3) return;
  for (const z of [-8.2, -6.2, -4.1, -2, 0, 2, 4.1, 6.2, 8.2])
    beam(out, 'wood', [-21.6, 9.98, z], [21.6, 9.98, z], 0.19, 0.23, timber);
}

function roofing(out, detail) {
  const gableX = 23.27;
  const edgeZ = 11.9,
    edgeY = pedimentBase + 0.07;
  box(out, 'stone', [-23.04, 10.59, -11.54], [23.04, 10.9, 11.54], limestone);
  const y = (z) => height - 0.07 - (Math.abs(z) / edgeZ) * (height - 0.07 - edgeY);
  for (const sign of [-1, 1]) {
    const z = sign * edgeZ;
    const face = (a) => [
      [-gableX, y(0) + a, 0],
      [-gableX, edgeY + a, z],
      [gableX, edgeY + a, z],
      [gableX, y(0) + a, 0],
    ];
    plate(out, 'clay', sign > 0 ? face(0) : face(0).reverse(), clay);
    plate(out, 'wood', sign > 0 ? face(-0.16).reverse() : face(-0.16), timber);
    beam(
      out,
      'marble',
      [-gableX, edgeY - 0.025, z],
      [gableX, edgeY - 0.025, z],
      0.34,
      0.25,
      marble,
    );
    if (detail >= 2) {
      const tiles = detail === 3 ? 69 : 36;
      const dx = (2 * gableX) / tiles;
      for (let i = 1; i < tiles; i++) {
        const x = -gableX + dx * i;
        beam(
          out,
          'clay',
          [x, edgeY + 0.025, z - sign * 0.08],
          [x, y(0) + 0.025, 0],
          0.075,
          0.073,
          tint(clay, 1.12),
        );
      }
    }
    if (detail >= 3)
      for (let row = 1; row < 18; row++) {
        const t = (row * edgeZ) / 18,
          z = sign * t;
        beam(
          out,
          'clay',
          [-gableX, y(z) + 0.013, z],
          [gableX, y(z) + 0.013, z],
          0.036,
          0.028,
          tint(clay, 0.86),
        );
      }
  }
  beam(
    out,
    'clay',
    [-gableX - 0.05, height - 0.1, 0],
    [gableX + 0.05, height - 0.1, 0],
    0.24,
    0.2,
    tint(clay, 1.1),
  );
  for (const sign of [-1, 1]) {
    const x = sign * (gableX - 0.12);
    const p = [
      [x, pedimentBase, -edgeZ],
      [x, pedimentBase, edgeZ],
      [x, height - 0.18, 0],
    ];
    const points = sign === -1 ? p : p.reverse();
    out.addTriangle(
      'paint',
      ref,
      points,
      normalFor(...points),
      [],
      detail === 0 ? limestone : shade,
    );
    beam(
      out,
      'marble',
      [sign * gableX, pedimentBase, -edgeZ],
      [sign * gableX, pedimentBase, edgeZ],
      0.37,
      0.28,
      marble,
    );
    for (const z of [-edgeZ, edgeZ]) {
      beam(
        out,
        'marble',
        [sign * gableX, height - 0.14, 0],
        [sign * gableX, edgeY, z],
        0.37,
        0.23,
        marble,
      );
      if (detail >= 2)
        beam(
          out,
          'paint',
          [sign * (gableX + 0.17), height - 0.34, 0],
          [sign * (gableX + 0.17), edgeY - 0.14, z],
          0.09,
          0.09,
          ironRed,
        );
    }
  }
  if (detail < 2) return;
  for (const x of [-gableX, gableX]) {
    for (const z of [-11.3, 0, 11.3]) {
      const spring = z === 0 ? height - 0.13 : y(edgeZ - 0.6);
      sphere(
        out,
        'marble',
        [x, spring + 0.28, z],
        [0.22, 0.37, z === 0 ? 0.52 : 0.31],
        marble,
        8,
        4,
      );
    }
  }
}

function build(out, detail) {
  platform(out, detail);
  for (const [x, z] of columns) column(out, x, z, detail);
  entablature(out, detail);
  sanctuary(out, detail);
  roofing(out, detail);
  if (detail >= 1) buildPediments(out, pedimentBase, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildHekatompedon = buildCloseup;
