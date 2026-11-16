/** The cathedral’s historic north portal, chapter room, clock and belfry. */
import {
  face,
  triangle,
  transform,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const stone = rgb('bb9f7d');
const pale = rgb('cfb798');
const aged = rgb('98836c');
const reveal = rgb('75644f');
const dark = rgb('4e4336');
const clock = rgb('b8ad91');

function rect(out, slot, left, right, floor, top, depth, color) {
  face(
    out,
    slot,
    [
      [left, floor, depth],
      [right, floor, depth],
      [right, top, depth],
      [left, top, depth],
    ],
    color,
  );
}

export function portalArch(
  out,
  { x, width, floor, spring, rise, top, z, depth, pointed = false },
  lod,
) {
  const count = [5, 8, 12, 18][lod];
  const half = width * 0.5;
  const profile = (i, rise, half) => {
    const theta = (Math.PI * i) / count;
    const u = -Math.cos(theta);
    const y = pointed
      ? Math.sqrt(Math.max(0, 4 - Math.pow(1 + Math.abs(u), 2))) / Math.sqrt(3)
      : Math.sin(theta);
    return [x + u * half, spring + rise * y];
  };
  const at = (i, offset, outer = false) => {
    const [xx, yy] = profile(i, rise + (outer ? 0.2 : 0), half + (outer ? 0.19 : 0));
    return [xx, yy, z + offset];
  };
  for (let i = 0; i < count; i++) {
    const a = at(i, 0),
      b = at(i + 1, 0),
      p = at(i, 0.043, true),
      q = at(i + 1, 0.043, true);
    face(out, 'dress', [a, b, q, p], lod === 3 && i % 5 === 2 ? stone : pale);
    face(out, 'stone', [p, q, [q[0], top, z + 0.043], [p[0], top, z + 0.043]], stone);
    if (lod > 1 && depth > 0) face(out, 'dress', [a, b, at(i + 1, -depth), at(i, -depth)], reveal);
  }
  if (lod > 1 && depth > 0)
    for (const edge of [x - half, x + half])
      box(
        out,
        'dress',
        [edge - 0.16, floor, z - depth],
        [edge + 0.16, spring + 0.04, z + 0.05],
        stone,
      );
  rect(out, 'shadow', x - half, x + half, floor, spring + rise, z - depth - 0.018, dark);
}

function windowPair(out, floor, lod) {
  for (const sign of [-1, 1]) {
    const x = sign * 2.04;
    rect(out, 'dress', x - 1.24, x + 1.24, floor + 8.53, floor + 10.95, 0.032, pale);
    rect(out, 'shadow', x - 0.86, x + 0.86, floor + 8.83, floor + 10.68, 0.056, dark);
    if (lod > 1)
      box(out, 'dress', [x - 1.32, floor + 8.36, -0.085], [x + 1.32, floor + 8.61, 0.35], stone);
  }
}

function clockFace(out, y, z, lod) {
  const outer = 1.15;
  const sides = [8, 12, 20, 32][lod];
  const xy = (r, i, rise = 0) => {
    const theta = (Math.PI * 2 * i) / sides;
    return [Math.cos(theta) * r, y + Math.sin(theta) * r, z + rise];
  };
  for (let i = 0; i < sides; i++) {
    triangle(out, 'dress', [[0, y, z], xy(outer, i), xy(outer, i + 1)], aged);
    triangle(out, 'shadow', [[0, y, z + 0.028], xy(0.86, i, 0.028), xy(0.86, i + 1, 0.028)], clock);
  }
  if (lod > 1) {
    rect(out, 'shadow', -0.035, 0.035, y - 0.12, y + 0.64, z + 0.038, dark);
    face(
      out,
      'shadow',
      [
        [0, y - 0.035, z + 0.045],
        [0.45, y + 0.24, z + 0.045],
        [0.48, y + 0.3, z + 0.045],
        [0, y + 0.035, z + 0.045],
      ],
      dark,
    );
  }
}

function bellFacade(out, floor, span, lod) {
  const y0 = floor + 15.93,
    top = floor + 18.72;
  const step = span / 3,
    half = step * 0.285;
  for (let j = 0; j < 3; j++) {
    const x = (j - 1) * step;
    portalArch(
      out,
      { x, width: half * 2, floor: y0, spring: y0 + 1.21, rise: 0.67, top, z: 0, depth: 0.47 },
      lod,
    );
    rect(out, 'stone', x - step * 0.5, x - half - 0.13, y0, top, 0.039, stone);
    rect(out, 'stone', x + half + 0.13, x + step * 0.5, y0, top, 0.039, stone);
  }
}

export function buildHistoricNorthPortal(out, { floor }, lod) {
  const w = 6.22;
  box(out, 'stone', [-w, floor - 0.59, -0.91], [w, floor, 0.3], aged);
  rect(out, 'stone', -w, -3.04, floor, floor + 7.74, 0, stone);
  rect(out, 'stone', 3.04, w, floor, floor + 7.74, 0, stone);
  portalArch(
    out,
    {
      x: 0,
      width: 5.8,
      floor,
      spring: floor + 4.42,
      rise: 2.77,
      top: floor + 7.71,
      z: 0.045,
      depth: 0.81,
    },
    lod,
  );
  if (lod > 0)
    for (const sign of [-1, 1])
      portalArch(
        out,
        {
          x: sign * 4.65,
          width: 1.6,
          floor: floor + 1.14,
          spring: floor + 3.07,
          rise: 0.97,
          top: floor + 4.39,
          z: 0.064,
          depth: 0.0,
          pointed: true,
        },
        lod,
      );
  box(out, 'stone', [-w, floor + 7.71, -1.18], [w, floor + 11.8, 0.02], stone);
  box(out, 'dress', [-w - 0.19, floor + 11.8, -1.29], [w + 0.19, floor + 12.23, 0.31], pale);
  if (lod > 0) windowPair(out, floor, lod);
  const offsets = [
    [-4.94, 12.23],
    [-4.94, 13.18],
    [-2.98, 13.61],
    [-1.57, 14.62],
    [1.57, 14.62],
    [2.98, 13.61],
    [4.94, 13.18],
    [4.94, 12.23],
  ];
  for (let i = 1; i + 1 < offsets.length; i++) {
    const verts = [offsets[0], offsets[i + 1], offsets[i]].map(([x, y]) => [x, floor + y, 0.17]);
    triangle(out, 'stone', verts, stone);
  }
  clockFace(out, floor + 13.31, 0.2, lod);
  box(out, 'stone', [-3.37, floor + 11.79, -4.24], [3.37, floor + 15.9, -0.84], stone);
  box(out, 'dress', [-3.52, floor + 15.6, -4.41], [3.52, floor + 15.93, -0.68], pale);
  bellFacade(transform(out, 0, [0, 0, -0.84]), floor, 6.74, lod);
  bellFacade(transform(out, Math.PI, [0, 0, -4.24]), floor, 6.74, lod);
  for (const side of [-1, 1]) {
    const edge = transform(out, (side * Math.PI) / 2, [side * 3.37, 0, -2.54]);
    bellFacade(edge, floor, 3.4, lod);
  }
  box(out, 'stone', [-3.45, floor + 18.71, -4.31], [3.45, floor + 19.08, -0.78], stone);
  box(out, 'dress', [-3.58, floor + 19.08, -4.47], [3.58, floor + 19.34, -0.6], pale);
}
