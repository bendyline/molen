import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone' },
  glazing: { slot: 'trim', graph: 'metal_painted', roughness: 0.41 },
  roof: { slot: 'roof', graph: 'membrane' },
  canvas: { slot: 'trim', graph: 'fabric_canvas' },
  paving: { slot: 'foundation', graph: 'tile_flat' },
  planted: { slot: 'foundation', graph: 'earth_rammed' },
  frame: { slot: 'trim', graph: 'metal_painted' },
};

const ref = 'palette:#ffffff';
const stone = [0.75, 0.69, 0.57];
const lintel = [0.8, 0.746, 0.629];
const terrace = [0.615, 0.597, 0.521];
const roof = [0.48, 0.475, 0.446];
const pane = [0.12, 0.21, 0.265];
const frame = [0.24, 0.285, 0.29];
const burgundy = [0.465, 0.109, 0.128];
const turf = [0.19, 0.3, 0.106];
const hedge = [0.145, 0.255, 0.087];
const water = [0.115, 0.285, 0.368];
const court = [0.194, 0.325, 0.299];
const stripe = [0.79, 0.774, 0.665];
const face = (out, slot, points, color) =>
  out.addQuad(slot, ref, points, normalFor(...points), [], color);
// Reconstructed vertical proportion from the archived garden-facing panorama.
export const heightScale = 1.64;

// Miniature dimensions in metres. +Z is the terraced garden facade in the archive.
const raisedFloor = 0.21;
const mainZ = 0.55;
const endZ = 0.64;
const upperFloorHeights = [0.672, 0.834, 0.997, 1.16, 1.347, 1.513];

function arch(x, bottom, width, height, spring, steps) {
  const shape = [
    [x - width / 2, bottom],
    [x + width / 2, bottom],
  ];
  for (let i = 0; i <= steps; i++) {
    const angle = (i * Math.PI) / steps;
    shape.push([
      x + (width / 2) * Math.cos(angle),
      bottom + height - spring + spring * Math.sin(angle),
    ]);
  }
  return shape;
}

function opening(out, project, x, y, w, h, segments, pilaster) {
  const outline = arch(x, y, w, h, Math.min(0.033, h * 0.31), segments);
  const shape = outline.map(([u, v]) => project(u, v, 0.0026));
  out.addConvexPolygon('glazing', ref, shape, normalFor(...shape.slice(0, 3)), [], pane);
  if (!pilaster) return;
  const outside = arch(x, y - 0.009, w + 0.021, h + 0.018, 0.043, segments);
  for (let i = 0; i < shape.length; i++) {
    const k = (i + 1) % shape.length;
    const a = project(...outside[i], 0.0075);
    const b = project(...outside[k], 0.0075);
    face(out, 'limestone', [a, b, shape[k], shape[i]], lintel);
  }
  const grid = Math.max(0.003, w * 0.042);
  beam(out, 'frame', project(x, y, 0.006), project(x, y + h - 0.012, 0.006), grid, grid, frame);
  beam(
    out,
    'frame',
    project(x - w / 2, y + h * 0.48, 0.006),
    project(x + w / 2, y + h * 0.48, 0.006),
    grid,
    grid,
    frame,
  );
}

function rectangularPane(out, project, u, y, w, h, depth) {
  const p = (x, up) => project(u + x, y + up, depth);
  face(out, 'glazing', [p(-w / 2, 0), p(w / 2, 0), p(w / 2, h), p(-w / 2, h)], pane);
}

function awning(out, u, segments) {
  const spring = 0.485;
  const point = (i, radius, z, rise) => {
    const angle = (i * Math.PI) / segments;
    return [u + radius * Math.cos(angle), spring + rise * Math.sin(angle), z];
  };
  for (let i = 0; i < segments; i++) {
    face(
      out,
      'canvas',
      [
        point(i, 0.098, mainZ + 0.116, 0.053),
        point(i, 0.099, mainZ, 0.075),
        point(i + 1, 0.099, mainZ, 0.075),
        point(i + 1, 0.098, mainZ + 0.116, 0.053),
      ],
      burgundy,
    );
  }
  const end = Array.from({ length: segments + 1 }, (_, i) =>
    point(segments - i, 0.098, mainZ + 0.116, 0.053),
  );
  out.addConvexPolygon('canvas', ref, end, [0, 0, 1], [], burgundy);
}

function balcony(out, x, y, wall, width) {
  box(
    out,
    'limestone',
    [x - width / 2, y - 0.017, wall],
    [x + width / 2, y + 0.003, wall + 0.071],
    lintel,
  );
  box(
    out,
    'limestone',
    [x - width / 2, y + 0.003, wall + 0.057],
    [x + width / 2, y + 0.027, wall + 0.071],
    stone,
  );
}

function hotel(out, detail) {
  box(out, 'limestone', [-2.82, raisedFloor, -0.86], [2.82, 1.674, mainZ], stone);
  box(out, 'paving', [-3.08, 0.129, -1.0], [3.08, raisedFloor, 0.84], terrace);
  box(out, 'roof', [-2.86, 1.656, -0.89], [2.86, 1.688, mainZ + 0.02], roof);

  for (const side of [-1, 1]) {
    const end = side * 2.37;
    box(out, 'limestone', [end - 0.46, raisedFloor, -0.92], [end + 0.46, 1.702, endZ], stone);
    box(out, 'limestone', [end - 0.487, 1.67, -0.946], [end + 0.487, 1.711, endZ + 0.028], lintel);
  }
  for (const [y, height] of [
    [0.306, 0.029],
    [1.295, 0.021],
    [1.637, 0.016],
  ]) {
    box(out, 'limestone', [-2.855, y, -0.883], [2.855, y + height, endZ + 0.015], lintel);
  }
  box(out, 'roof', [-2.71, 1.704, -0.77], [-2.36, 1.786, -0.57], roof);
  box(out, 'roof', [2.29, 1.692, -0.77], [2.65, 1.748, -0.54], roof);

  const front = (u, y, d) => [u, y, mainZ + d];
  const pavilions = (u, y, d) => [u, y, endZ + d];
  for (let bay = 0; bay < 13; bay++) {
    const x = (bay - 6) * 0.284;
    rectangularPane(out, front, x, 0.333, 0.182, 0.185, 0.0025);
    awning(out, x, detail === 0 ? 2 : detail === 1 ? 4 : 7);
    if (detail === 0) continue;
    for (const [i, y] of upperFloorHeights.entries()) {
      if (detail === 1 && i % 2 === 1) continue;
      if (bay === 6) rectangularPane(out, front, x, y, 0.171, 0.11, 0.0026);
      else opening(out, front, x, y, 0.081, 0.109, detail >= 3 ? 9 : 4, detail >= 3);
      if (detail >= 2 && i < 4 && (bay === 6 || Math.abs(bay - 6) === 3))
        balcony(out, x, y, mainZ, bay === 6 ? 0.195 : 0.126);
    }
  }
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    for (const x of [-0.241, 0, 0.241]) {
      for (const [i, y] of [0.44, ...upperFloorHeights].entries()) {
        if (detail === 1 && i % 2 === 1) continue;
        opening(out, pavilions, side * 2.36 + x, y, 0.085, 0.112, detail >= 3 ? 9 : 4, detail >= 3);
        if (detail >= 2 && i > 0 && i <= 4 && x !== 0)
          balcony(out, side * 2.36 + x, y, endZ, 0.123);
      }
    }
    if (detail === 1) continue;
    const end = (u, y, d) => [side * (2.83 + d), y, -side * u];
    for (const x of [-0.325, -0.02, 0.298, 0.619]) {
      for (const y of upperFloorHeights)
        opening(out, end, x, y, 0.082, 0.111, detail >= 3 ? 7 : 4, false);
    }
  }
  if (detail < 3) return;
  const rear = (u, y, d) => [-u, y, -0.86 - d];
  for (let i = -8; i <= 8; i++)
    for (const y of upperFloorHeights) opening(out, rear, i * 0.3, y, 0.08, 0.107, 6, false);
}

function rotunda(out, detail) {
  const count = detail === 0 ? 6 : detail === 1 ? 10 : 18;
  const level = (y, scale) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const a = (i * Math.PI) / count;
      return [0.73 * scale * Math.cos(a), y, 0.775 + 0.397 * scale * Math.sin(a)];
    });
  const band = (y, top, scale, slot, color) => {
    const lower = level(y, scale),
      upper = level(top, scale);
    for (let i = 0; i < count; i++)
      face(out, slot, [lower[i], upper[i], upper[i + 1], lower[i + 1]], color);
  };
  band(raisedFloor, 0.365, 1, 'glazing', pane);
  band(0.361, 0.402, 1.036, 'limestone', lintel);
  const top = level(0.402, 1.036).reverse();
  out.addConvexPolygon('paving', ref, top, normalFor(...top.slice(0, 3)), [], terrace);
  if (detail < 2) return;
  for (const [i, p] of level(raisedFloor, 1.025).entries()) {
    if (detail === 2 && i % 2 !== 0) continue;
    box(
      out,
      'frame',
      [p[0] - 0.005, raisedFloor, p[2] - 0.004],
      [p[0] + 0.005, 0.364, p[2] + 0.006],
      frame,
    );
  }
}

function tennis(out, detail) {
  const x = 1.92,
    z = 2.55;
  box(out, 'paving', [x - 0.64, -0.018, z - 0.37], [x + 0.64, 0.092, z + 0.37], terrace);
  box(out, 'paving', [x - 0.58, 0.092, z - 0.31], [x + 0.58, 0.1, z + 0.31], court);
  if (detail === 0) return;
  for (const dx of [-0.48, 0, 0.48])
    box(
      out,
      'paving',
      [x + dx - 0.006, 0.1, z - 0.255],
      [x + dx + 0.006, 0.103, z + 0.255],
      stripe,
    );
  for (const dz of [-0.252, 0.252])
    box(
      out,
      'paving',
      [x - 0.485, 0.1, z + dz - 0.006],
      [x + 0.485, 0.103, z + dz + 0.006],
      stripe,
    );
  if (detail < 2) return;
  for (const [px, pz] of [
    [-0.61, -0.345],
    [0.61, -0.345],
    [0.61, 0.345],
    [-0.61, 0.345],
  ]) {
    box(
      out,
      'frame',
      [x + px - 0.006, 0.1, z + pz - 0.006],
      [x + px + 0.006, 0.222, z + pz + 0.006],
      frame,
    );
  }
  for (const edge of [-0.345, 0.345])
    beam(
      out,
      'frame',
      [x - 0.61, 0.221, z + edge],
      [x + 0.61, 0.221, z + edge],
      0.007,
      0.007,
      frame,
    );
  if (detail >= 3) {
    for (const dx of [-0.61, 0.61])
      beam(
        out,
        'frame',
        [x + dx, 0.221, z - 0.345],
        [x + dx, 0.221, z + 0.345],
        0.007,
        0.007,
        frame,
      );
    beam(out, 'frame', [x, 0.157, z - 0.26], [x, 0.157, z + 0.26], 0.009, 0.006, frame);
  }
}

function gardens(out, detail) {
  for (const [upper, lower, height] of [
    [0.81, 1.54, 0.11],
    [1.54, 2.23, 0.055],
    [2.23, 3.28, -0.021],
  ]) {
    box(out, 'planted', [-3.01, -0.087, upper], [2.98, height, lower], [0.312, 0.287, 0.186]);
  }
  for (const [x, y, z, width, depth] of [
    [-2.15, 0.175, 1.21, 1.35, 0.51],
    [2.14, 0.175, 1.19, 1.4, 0.46],
    [-1.49, 0.113, 1.87, 1.74, 0.48],
    [1.5, 0.11, 1.87, 1.74, 0.49],
    [0.45, 0.071, 2.5, 1.28, 0.49],
    [-2.41, 0.09, 2.59, 0.67, 0.97],
  ]) {
    box(
      out,
      'paving',
      [x - width / 2 - y, -0.08, z - depth / 2],
      [x + width / 2, y, z + depth / 2],
      terrace,
    );
    box(
      out,
      'planted',
      [x - width / 2 + 0.035, y, z - depth / 2 + 0.035],
      [x + width / 2 - 0.035, y + 0.011, z + depth / 2 - 0.035],
      turf,
    );
    if (detail === 0) continue;
    for (const dx of [-width * 0.33, 0, width * 0.33]) {
      const center = [x + dx, z];
      const foot = radialRing(y + 0.01, 0.068, 0.059, 5, center);
      const belly = radialRing(y + 0.069, 0.1, 0.081, 5, center);
      const top = radialRing(y + 0.128, 0.022, 0.024, 5, center);
      loft(out, 'planted', [foot, belly, top], hedge);
    }
  }
  for (let i = 0; i < 5; i++) {
    const y = raisedFloor - 0.031 * i;
    box(out, 'paving', [-0.23, -0.035, 1.16 + 0.139 * i], [0.23, y, 1.3 + 0.139 * i], terrace);
  }
  const [x, z, w, d] = [-1.27, 2.44, -0.35, 3.196];
  face(
    out,
    'roof',
    [
      [x, 0.023, d],
      [w, 0.023, d],
      [w, 0.023, z],
      [x, 0.023, z],
    ],
    water,
  );
  for (const u of [x, w - 0.036]) box(out, 'paving', [u, -0.04, z], [u + 0.036, 0.076, d], terrace);
  for (const v of [z, d - 0.035]) box(out, 'paving', [x, -0.04, v], [w, 0.076, v + 0.035], terrace);
  loft(
    out,
    'roof',
    [
      radialRing(0.029, 0.172, 0.148, 8, [-1.62, 2.86]),
      radialRing(0.064, 0.193, 0.168, 8, [-1.62, 2.86]),
    ],
    water,
  );
  tennis(out, detail);
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildHotelExhibit(builder, tier) {
  const level = tiers[tier];
  const stretchPoint = ([x, y, z]) => [x, y * heightScale, z];
  const stretchNormal = ([x, y, z]) => {
    const slope = y / heightScale;
    const length = Math.sqrt(x * x + slope * slope + z * z);
    return [x / length, slope / length, z / length];
  };
  const out = {
    addQuad(slot, material, points, normal, uv, color) {
      builder.addQuad(slot, material, points.map(stretchPoint), stretchNormal(normal), uv, color);
    },
    addConvexPolygon(slot, material, points, normal, uv, color) {
      builder.addConvexPolygon(
        slot, material, points.map(stretchPoint), stretchNormal(normal), uv, color,
      );
    },
  };
  hotel(out, level);
  rotunda(out, level);
  gardens(out, level);
}

export const buildSkyline = (out) => buildHotelExhibit(out, 'skyline');
export const buildDistrict = (out) => buildHotelExhibit(out, 'district');
export const buildStreet = (out) => buildHotelExhibit(out, 'street');
export const buildCloseup = (out) => buildHotelExhibit(out, 'closeup');
