import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, rectangle, solid } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  roof: { slot: 'roof', graph: 'slate' },
};

const slate = [0.24, 0.25, 0.27];
const timber = [0.138, 0.094, 0.064];
const stone = [0.544, 0.522, 0.478];
const soffit = [0.098, 0.075, 0.056];

function platform(out, level) {
  solid(out, 'stone', rectangle(3.25, 3.18), -0.18, 0.29, stone);
  box(out, 'stone', [-1.59, 0.105, 1.47], [1.59, 0.28, 1.9], stone);
  if (level > 0) box(out, 'stone', [-1.24, 0.02, 1.88], [1.28, 0.141, 2.14], stone);
}

function roof(out, level) {
  const widths = level === 0 ? [2.16, 1.13, 0.08] : [2.16, 1.92, 1.46, 0.96, 0.43, 0.08];
  const samples = level < 2 ? [-1, 0, 1] : [-1, -0.67, -0.33, 0, 0.33, 0.67, 1];
  const below = ([x, y, z]) => [x, y - 0.126, z];
  for (let side = 0; side < 4; side++) {
    const outward = [
      [0, 0, 1],
      [1, 0, 0],
      [0, 0, -1],
      [-1, 0, 0],
    ][side];
    const point = (width, along) => {
      const rise = 1 - width / widths[0];
      const lift = 0.72 * rise * (0.32 + 0.68 * rise);
      const corner = 0.19 * Math.pow(Math.abs(along), 4) * (1 - rise);
      const run = width * along;
      const [x, z] = [
        [run, width],
        [width, -run],
        [-run, -width],
        [-width, run],
      ][side];
      return [x, 2.96 + lift + corner, z];
    };
    for (let i = 1; i < widths.length; i++) {
      for (let j = 1; j < samples.length; j++) {
        const outer = widths[i - 1],
          inner = widths[i];
        const left = samples[j - 1],
          right = samples[j];
        const coordinates = [
          [outer, left],
          [outer, right],
          [inner, right],
          [inner, left],
        ];
        const panel = coordinates.map(([width, along]) => point(width, along));
        const uv = coordinates.map(([width, along]) => [width * along, widths[0] - width]);
        out.addQuad('roof', 'metric:uv', panel, normalFor(...panel), uv, slate);
        face(out, 'timber', panel.map(below), soffit, [0, -1, 0]);
      }
    }
    for (let i = 1; i < samples.length; i++) {
      const start = point(widths[0], samples[i - 1]),
        end = point(widths[0], samples[i]);
      face(out, 'timber', [start, end, below(end), below(start)], soffit, outward);
    }
    if (level < 2) continue;
    for (let i = 1; i < widths.length; i++) {
      beam(out, 'roof', point(widths[i - 1], -1), point(widths[i], -1), 0.1, 0.12, slate);
    }
    for (let i = 1; i < 23; i++) {
      const along = (2 * i) / 23 - 1;
      const outer = point(widths[0], along),
        inner = point(widths[0] - 0.16, along);
      beam(out, 'roof', outer, inner, 0.072, 0.065, slate);
    }
  }
  for (const [base, span, height] of [
    [3.64, 0.29, 0.14],
    [3.78, 0.2, 0.18],
    [3.96, 0.27, 0.074],
  ]) {
    box(
      out,
      'roof',
      [-span * 0.5, base, -span * 0.5],
      [span * 0.5, base + height, span * 0.5],
      slate,
    );
  }
}

const posts = [
  [-1.32, 1.26],
  [1.32, 1.26],
  [1.32, -1.26],
  [-1.32, -1.26],
];

function frame(out, level) {
  for (const [x, z] of posts) {
    box(out, 'stone', [x - 0.155, 0.28, z - 0.155], [x + 0.155, 0.375, z + 0.155], stone);
    const facets = [4, 8, 10, 12][level];
    loft(
      out,
      'timber',
      [
        radialRing(0.365, 0.111, 0.111, facets, [x, z]),
        radialRing(2.92, 0.101, 0.101, facets, [x, z]),
      ],
      timber,
    );
  }
  for (let i = 0; i < posts.length; i++) {
    const [x, z] = posts[i],
      [a, b] = posts[(i + 1) % posts.length];
    const rail = (height, width, depth) =>
      beam(out, 'timber', [x, height, z], [a, height, b], width, depth, timber);
    rail(2.88, 0.19, 0.31);
    if (level === 0) continue;
    rail(2.48, 0.07, 0.083);
    rail(2.65, 0.068, 0.08);
    for (let j = 1; j < 10; j++) {
      const t = j / 10;
      const p = x + (a - x) * t,
        q = z + (b - z) * t;
      beam(out, 'timber', [p, 2.48, q], [p, 2.68, q], 0.052, 0.052, timber);
    }
    if (i === 0) continue;
    rail(0.8, 0.3, 0.105);
    const midX = (x + a) * 0.5,
      midZ = (z + b) * 0.5;
    beam(out, 'timber', [midX, 0.29, midZ], [midX, 0.75, midZ], 0.155, 0.155, timber);
  }
}

function build(out, level) {
  platform(out, level);
  frame(out, level);
  roof(out, level);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
