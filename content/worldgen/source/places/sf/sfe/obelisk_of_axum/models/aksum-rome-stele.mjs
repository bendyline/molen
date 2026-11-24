import {
  facade,
  fbox,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.99 },
  base: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98 },
};

const granite = rgb('b8b29f'),
  edge = rgb('bfb9a8'),
  scour = rgb('aca493'),
  dark = rgb('8a8174'),
  plinth = rgb('a8a092');
const broad = facade([0, 0], site.along),
  side = facade([0, 0], broad.normal);
const faces = [
  { face: broad, width: site.baseWidth, depth: site.baseDepth, front: true },
  { face: side, width: site.baseDepth, depth: site.baseWidth },
  {
    face: facade(
      [0, 0],
      site.along.map((q) => -q),
    ),
    width: site.baseWidth,
    depth: site.baseDepth,
  },
  {
    face: facade(
      [0, 0],
      broad.normal.map((q) => -q),
    ),
    width: site.baseDepth,
    depth: site.baseWidth,
  },
];
const scale = (y) => 1 - (0.162 * Math.max(0, y)) / site.capStart;

function place(face, u, y, depth = 0) {
  return face.face.P(u * scale(y), y, face.depth * 0.5 * scale(y) + depth);
}
function patch(out, face, a, b, y, Y, d, color) {
  quad4(
    out,
    'granite',
    place(face, a, y, d),
    place(face, b, y, d),
    place(face, b, Y, d),
    place(face, a, Y, d),
    color,
  );
}
function groove(out, face, a, b, y, Y, detail) {
  patch(out, face, a, b, y, Y, 0.013, dark);
  if (detail === 0) return;
  patch(out, face, a - 0.048, a, y - 0.042, Y + 0.044, 0.038, edge);
  patch(out, face, b, b + 0.048, y - 0.042, Y + 0.044, 0.038, edge);
  patch(out, face, a - 0.041, b + 0.041, Y, Y + 0.043, 0.037, granite);
  patch(out, face, a - 0.041, b + 0.041, y - 0.048, y, 0.037, edge);
  if (detail > 1) {
    const c = (a + b) * 0.5;
    patch(out, face, c - 0.019, c + 0.019, y, Y, 0.031, scour);
    patch(out, face, a, b, y + 0.15 * (Y - y), y + 0.15 * (Y - y) + 0.024, 0.026, edge);
  }
}
function carving(out, face, detail) {
  const half = face.width * 0.5;
  patch(out, face, -half, half, -0.45, site.capStart, 0, granite);
  if (face.front) {
    groove(out, face, -0.47, 0.47, 0.23, 2.12, detail);
    patch(out, face, -0.66, 0.64, 2.18, 2.23, 0.027, scour);
  }
  const windows = face.width > 2 ? 3 : 2;
  const carveWidth = face.width * 0.74;
  for (let stage = 0; stage < site.storeys; stage++) {
    const floor = site.firstStorey + stage * site.storeyPitch;
    patch(out, face, -half + 0.009, half - 0.009, floor, floor + 0.063, 0.039, edge);
    patch(out, face, -half + 0.015, half - 0.015, floor + 0.06, floor + 0.101, 0.016, dark);
    if (detail === 0 && stage % 2) continue;
    for (let i = 0; i < windows; i++) {
      const u = -carveWidth * 0.5 + (carveWidth * (i + 0.5)) / windows,
        w = (carveWidth * 0.252) / windows;
      groove(out, face, u - w, u + w, floor + 0.97, floor + 1.53, detail);
    }
    if (detail === 0) continue;
    const beams = face.width > 2 ? 8 : 4;
    for (let i = 0; i < beams; i++) {
      const u = face.width * ((i + 0.5) / beams - 0.5);
      patch(out, face, u - 0.055, u + 0.055, floor + 0.32, floor + 0.43, 0.041, scour);
      if (detail > 1)
        patch(out, face, u - 0.048, u + 0.048, floor + 0.66, floor + 0.72, 0.034, edge);
    }
    patch(out, face, -half + 0.018, half - 0.018, floor + 1.63, floor + 1.688, 0.027, dark);
  }
}
function crown(out, detail) {
  const y = site.capStart,
    d = site.baseDepth * scale(y) * 0.5,
    r = site.baseWidth * scale(y) * 0.5;
  const steps = [8, 12, 16, 20][detail];
  const outline = [
    [-r, y],
    [-0.71 * r, 22.44],
    [-0.59 * r, 22.81],
    [-r, 22.86],
  ];
  for (let i = 1; i < steps; i++) {
    const a = Math.PI * (1 - i / steps);
    outline.push([r * Math.cos(a), 22.86 + (site.height - 22.86) * Math.sin(a)]);
  }
  outline.push([r, 22.86], [r * 0.64, 22.73], [r * 0.72, 22.4], [r, y]);
  const P = (u, yy, depth) => broad.P(u, yy, depth);
  const center = [0, 22.765];
  for (const [i, [u, Y]] of outline.entries()) {
    const [v, Z] = outline[(i + 1) % outline.length];
    quad4(out, 'granite', P(u, Y, -d), P(u, Y, d), P(v, Z, d), P(v, Z, -d), edge);
    tri(out, 'granite', P(...center, d), P(v, Z, d), P(u, Y, d), granite);
    tri(out, 'granite', P(...center, -d), P(u, Y, -d), P(v, Z, -d), granite);
  }
  if (detail > 0) {
    const cy = 23.21;
    for (let i = 0; i < steps; i++) {
      const a = (2 * Math.PI * i) / steps,
        b = (2 * Math.PI * (i + 1)) / steps;
      const at = (th) => P(0.258 * Math.cos(th), cy + 0.194 * Math.sin(th), d + 0.012);
      tri(out, 'granite', P(0, cy, d + 0.013), at(a), at(b), dark);
    }
  }
}
function build(out, detail) {
  fbox(out, 'base', broad, -2.01, 2.01, -0.54, 0.075, -1.63, 1.63, plinth);
  for (const face of faces) carving(out, face, detail);
  crown(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
