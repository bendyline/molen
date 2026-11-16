/** The connected northern archives and study buildings at Yad Vashem. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box, quad } from './structure-mesh.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sv/sv9/northern_archives_and_study_range_yad_vashem/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source), 'utf8'));
const { structures } = read('layout.json');
const { pictures } = read('reference-metadata.json');
const scope = read('review-scope.json');
const palette = {
  stone: [0.68, 0.64, 0.55],
  base: [0.48, 0.44, 0.36],
  gravel: [0.41, 0.39, 0.34],
  glass: [0.13, 0.25, 0.31],
  frame: [0.33, 0.36, 0.37],
};

function face(out, role, points, preferred) {
  const normal = normalFor(...points);
  const reverse = preferred && normal.reduce((dot, n, axis) => dot + n * preferred[axis], 0) < 0;
  quad(
    out,
    role,
    reverse ? points.toReversed() : points,
    reverse ? normal.map((v) => -v) : normal,
    palette[role],
  );
}

function horizontal(out, role, outline, y) {
  const ring = outline.map((p) => p.map(Math.fround));
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const points = indices.slice(i, i + 3).map((index) => {
      const [x, z] = ring[index];
      return [x, y, z];
    });
    const normal = normalFor(...points)[1];
    if (normal === 0) continue;
    if (normal < 0) points.reverse();
    out.addTriangle(
      role,
      'palette:#ffffff',
      points,
      [0, 1, 0],
      points.map(([x, , z]) => [x, z]),
      palette[role],
    );
  }
}

function elevation(out, a, b) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / length, 0, (b[1] - a[1]) / length];
  const normal = [tangent[2], 0, -tangent[0]];
  const point = (s, y, depth = 0) => [
    a[0] + s * tangent[0] - depth * normal[0],
    y,
    a[1] + s * tangent[2] - depth * normal[2],
  ];
  const panel = (role, left, right, low, high, recess = 0) => {
    if (right - left < 0.0001 || high - low < 0.0001) return;
    face(
      out,
      role,
      [
        point(left, low, recess),
        point(left, high, recess),
        point(right, high, recess),
        point(right, low, recess),
      ],
      normal,
    );
  };
  return { length, normal, tangent, point, panel };
}

/** Solid stone around an opening. Only the glazing and jambs extend inwards. */
function opening(
  out,
  edge,
  left,
  right,
  low,
  high,
  { detail, mullions = 0, transoms = 0, vent = false },
) {
  const { point, panel, tangent } = edge;
  const recess = detail ? (vent ? 0.15 : 0.28) : 0;
  panel(vent ? 'base' : 'glass', left, right, low, high, recess);
  if (!detail) return;
  face(
    out,
    'stone',
    [point(left, low), point(left, low, recess), point(left, high, recess), point(left, high)],
    tangent,
  );
  face(
    out,
    'stone',
    [point(right, low), point(right, low, recess), point(right, high, recess), point(right, high)],
    tangent.map((n) => -n),
  );
  face(
    out,
    'stone',
    [point(left, low), point(right, low), point(right, low, recess), point(left, low, recess)],
    [0, 1, 0],
  );
  face(
    out,
    'stone',
    [point(left, high), point(right, high), point(right, high, recess), point(left, high, recess)],
    [0, -1, 0],
  );
  if (vent || detail < 2) return;
  if (detail > 3) {
    panel('frame', left, right, low, low + 0.055, recess - 0.069);
    panel('frame', left, right, high - 0.055, high, recess - 0.065);
    panel('frame', left, left + 0.055, low + 0.055, high - 0.055, recess - 0.063);
    panel('frame', right - 0.055, right, low + 0.055, high - 0.055, recess - 0.063);
  }
  const width = detail > 2 ? 0.037 : 0.053;
  for (let i = 1; i <= mullions; i++) {
    const x = left + ((right - left) * i) / (mullions + 1);
    panel('frame', x - width, x + width, low, high, recess - 0.035);
  }
  for (let i = 1; i <= transoms; i++) {
    const y = low + ((high - low) * i) / (transoms + 1);
    panel('frame', left, right, y - width, y + width, recess - 0.05);
  }
}

function row(out, edge, low, high, count, pier, options) {
  const { length, panel } = edge;
  const gap = Math.min(pier, (length / count) * 0.56);
  let end = 0;
  for (let bay = 0; bay < count; bay++) {
    const a = (length * bay) / count + gap * 0.5;
    const b = (length * (bay + 1)) / count - gap * 0.5;
    panel('stone', end, a, low, high);
    opening(out, edge, a, b, low, high, options);
    end = b;
  }
  panel('stone', end, length, low, high);
}

function roofEdge(out, edge, y, projection) {
  const { point, length, panel } = edge;
  panel('stone', 0, length, y - 0.24, y + 0.18, -projection);
  face(
    out,
    'stone',
    [
      point(0, y + 0.18, -projection),
      point(length, y + 0.18, -projection),
      point(length, y + 0.18, 0.19),
      point(0, y + 0.18, 0.19),
    ],
    [0, 1, 0],
  );
  if (projection > 0.1) {
    face(
      out,
      'stone',
      [
        point(0, y - 0.24, -projection),
        point(length, y - 0.24, -projection),
        point(length, y - 0.24),
        point(0, y - 0.24),
      ],
      [0, -1, 0],
    );
  }
}

function projection(out, edge, role, left, right, low, high, depth) {
  const { point, panel, tangent } = edge;
  panel(role, left, right, low, high, -depth);
  face(
    out,
    role,
    [point(left, high, -depth), point(right, high, -depth), point(right, high), point(left, high)],
    [0, 1, 0],
  );
  face(
    out,
    role,
    [point(left, low, -depth), point(right, low, -depth), point(right, low), point(left, low)],
    [0, -1, 0],
  );
  for (const [s, sign] of [
    [left, -1],
    [right, 1],
  ]) {
    face(
      out,
      role,
      [point(s, low, -depth), point(s, high, -depth), point(s, high), point(s, low)],
      tangent.map((v) => sign * v),
    );
  }
}

function wall(out, a, b, role, roof, detail) {
  const edge = elevation(out, a, b);
  const { length, normal, panel } = edge;
  const north = normal[2] < -0.6 && length > 2;
  const south = normal[2] > 0.8 && length > 11;
  const rows = [];
  if (north) {
    if (role === 'library') {
      const bays = Math.max(1, Math.round(length / 8.2));
      rows.push(
        [-8.1, -6.1, detail ? bays * 4 : bays, 1.07, 0, 0],
        [-5.05, -1.46, bays, 1.65, 3, 2],
      );
      if (detail >= 2) rows.push([-0.94, -0.36, bays * 5, 1.24, 0, 0, true]);
    } else if (role === 'seminars') {
      rows.push([-7.8, -5.35, 1, 3.6, 13, 1], [-4.72, -2.35, 1, 3.6, 17, 1]);
    } else if (role === 'school') {
      const bays = Math.max(1, Math.round(length / 5.5));
      rows.push(
        [-9.22, -6.22, bays, 0.93, 3, 2],
        [-5.65, -2.58, bays, 0.93, 3, 2],
        [-1.96, -0.82, 1, 1.59, 11, 0],
      );
    } else {
      rows.push([-10.6, -1.25, Math.max(1, Math.round(length / 6.8)), 1.65, 2, 7]);
    }
  } else if (south) {
    rows.push([
      -4.9,
      -3.0,
      Math.max(1, Math.round(length / (role === 'library' ? 3.15 : 5.7))),
      2.2,
      1,
      0,
    ]);
  }
  const base = roof - 12.0;
  panel('base', 0, length, 0, base);
  let y = base;
  for (const [low, high, count, pier, mullions, transoms, vent] of rows) {
    panel('stone', 0, length, y, roof + low);
    row(out, edge, roof + low, roof + high, count, pier, { detail, mullions, transoms, vent });
    y = roof + high;
  }
  const overhang = north && role === 'seminars' ? 0.46 : 0.055;
  panel('stone', 0, length, y, overhang > 0.1 ? roof - 0.24 : roof + 0.18);
  roofEdge(out, edge, roof, overhang);
  if (detail < 3 || !north || length < 9) return;
  if (role === 'school') {
    const bays = Math.round(length / 5.5);
    for (let i = 1; i < bays; i++) {
      const s = (length * i) / bays;
      projection(out, edge, 'stone', s - 0.3, s + 0.3, roof - 9.6, roof - 2.38, 0.31);
    }
    const posts = Math.round(length / 3.5);
    for (let i = 0; i < posts; i++) {
      const s = (length * (i + 0.5)) / posts;
      panel('frame', s - 0.035, s + 0.035, roof + 0.18, roof + 0.77, 0.008);
    }
    panel('frame', 0.18, length - 0.18, roof + 0.74, roof + 0.8, 0.012);
  }
  if (role === 'seminars')
    projection(out, edge, 'stone', 1.8, length - 1.8, roof - 5.32, roof - 5.02, 0.28);
}

function build(out, detail) {
  for (const { role, roofY, outline } of structures) {
    horizontal(out, 'gravel', outline, roofY);
    for (const [i, a] of outline.entries())
      wall(out, a, outline[(i + 1) % outline.length], role, roofY, detail);
  }
  if (detail < 2) return;
  for (const [x, z, y, width] of [
    [-68, 7.5, 18.25, 11],
    [-26, 4, 19.1, 6.2],
    [9, -7.1, 19.6, 9.4],
    [40, -7.2, 20.65, 5.0],
    [83, -10.5, 18.75, 5.5],
  ]) {
    box(out, 'stone', [x, y, z], [x + width, y + 0.27, z + 2.15], palette.stone);
    box(
      out,
      'frame',
      [x + 0.31, y + 0.27, z + 0.22],
      [x + width - 0.31, y + 0.58, z + 1.93],
      palette.frame,
    );
  }
}

export const buildYadNorthernRangeSkyline = (out) => build(out, 0);
export const buildYadNorthernRangeDistrict = (out) => build(out, 1);
export const buildYadNorthernRangeStreet = (out) => build(out, 2);
export const buildYadNorthernRangeCloseup = (out) => build(out, 3);

export const yadNorthernRangeStudy = {
  id: 'northern_archives_and_study_range_yad_vashem',
  title: 'Northern archives and study range, Yad Vashem',
  category: 'museum',
  wikidataId: 'Q156591',
  mapFrame: 'map-frame.json',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  build: (out) => build(out, 4),
  scaleBasis:
    'The retained PMTiles footprint supplies scale and plan. Exterior photos supply the approximate roof steps, proportions and opening rhythm.',
  refs: pictures.map((p) => p.page),
  geometrySource:
    'Footprint-matched exterior authored with original mesh geometry and shared limestone, glazing, metal and roof materials.',
  sourceLicense:
    'Original geometry under repository license. Map evidence © OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only.',
  camera: scope.camera,
  qaCameras: [],
};
