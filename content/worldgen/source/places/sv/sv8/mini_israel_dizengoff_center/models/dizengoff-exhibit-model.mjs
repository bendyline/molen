import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  box,
  prism as solid,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  base: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'wall', graph: 'stone_limestone' },
  windows: { slot: 'window', graph: 'window_grid' },
  rails: { slot: 'trim', graph: 'metal_painted' },
};

const fit = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
const dx = fit.towerSpacing;
const ivory = [0.71, 0.68, 0.59];
const plinth = [0.52, 0.51, 0.46];
const cream = [0.8, 0.797, 0.742];
const steel = [0.59, 0.6, 0.58];
const paleGlass = [0.28, 0.32, 0.33];
const darkGlass = [0.195, 0.212, 0.208];
const rustGlass = [0.37, 0.217, 0.19];
const warmMetal = [0.67, 0.605, 0.53];
const red = [0.47, 0.29, 0.25];

function ellipticalStrip(out, slot, center, radius, levels, segments, color) {
  loft(
    out,
    slot,
    levels.map(([y, scale]) =>
      radialRing(y, radius[0] * scale, radius[1] * scale, segments, center),
    ),
    color,
  );
}

function podium(out, detail) {
  const deck = [
    [-1.41, -1.04],
    [-0.92, -1.49],
    [dx + 0.78, -1.48],
    [dx + 1.52, -0.81],
    [dx + 1.18, 0.89],
    [dx + 0.23, 1.27],
    [0.65, 1.41],
    [-1.28, 1.27],
  ];
  solid(out, 'base', deck, -1.03, 0.095, plinth);
  solid(
    out,
    'base',
    deck.map(([x, z]) => [x * 1.01 - 0.026, z * 1.035]),
    0.095,
    0.152,
    ivory,
  );
  const southWing = [
    [-1.12, -0.76],
    [0.73, -1.18],
    [1.91, -0.67],
    [1.7, 0.6],
    [-1.04, 1.03],
  ];
  const northWing = [
    [1.36, -0.93],
    [dx + 0.86, -1.11],
    [dx + 1.16, -0.38],
    [dx + 0.83, 0.91],
    [2.02, 0.98],
  ];
  for (const wing of [southWing, northWing]) {
    solid(out, 'stone', wing, 0.152, 0.529, ivory);
    solid(
      out,
      'stone',
      wing.map(([x, z]) => [x, z * 1.055]),
      0.529,
      0.565,
      cream,
    );
  }
  box(out, 'windows', [-0.77, 0.24, 0.987], [0.12, 0.379, 1.046], darkGlass);
  box(out, 'windows', [2.22, 0.245, 0.918], [dx + 0.71, 0.413, 0.966], darkGlass);
  box(out, 'stone', [1.37, 0.439, 0.31], [2.2, 0.583, 0.606], cream);
  if (detail < 2) return;
  for (let i = 0; i < 4; i++)
    box(
      out,
      'base',
      [1.38 - i * 0.026, 0.146, 0.91 + i * 0.071],
      [2.0 + i * 0.026, 0.318 - i * 0.04, 0.979 + i * 0.071],
      plinth,
    );
  for (const x of [-0.93, 1.58, dx + 0.7]) {
    box(out, 'stone', [x - 0.086, 0.55, -0.77], [x + 0.086, 0.664, -0.47], ivory);
    box(out, 'rails', [x - 0.067, 0.664, -0.75], [x + 0.067, 0.682, -0.49], warmMetal);
  }
}

function greyTower(out, detail) {
  const count = [10, 16, 24, 32][detail];
  const ring = (y, r) => radialRing(y, r, r * 0.9, count);
  const radius = 0.884;
  loft(out, 'stone', [ring(0.496, 0.53), ring(0.808, 0.55)], ivory);
  loft(out, 'stone', [ring(0.791, 0.842), ring(0.827, radius)], cream);
  loft(out, 'windows', [ring(0.815, radius), ring(3.3, radius)], paleGlass);
  loft(out, 'windows', [ring(3.3, radius), ring(3.67, radius * 0.89)], darkGlass);
  loft(out, 'stone', [ring(3.67, radius * 0.91), ring(3.715, radius * 0.9)], cream);
  for (let i = 0; i < (detail ? 8 : 4); i++) {
    const a = (i * Math.PI) / (detail ? 4 : 2);
    const toe = [0.615 * Math.cos(a), 0.541, 0.554 * Math.sin(a)];
    const shoulder = [0.853 * Math.cos(a + 0.2), 0.808, 0.766 * Math.sin(a + 0.2)];
    beam(out, 'stone', toe, shoulder, 0.037, 0.049, ivory);
  }
  box(out, 'stone', [-0.18, 3.71, -0.322], [0.21, 3.97, 0.02], cream);
  box(out, 'stone', [0.12, 3.71, -0.239], [0.332, 4.085, -0.026], ivory);
  if (!detail) return;
  const rows = detail === 1 ? 7 : 15;
  const steps = detail === 1 ? 10 : count;
  for (let row = 0; row <= rows; row++) {
    const level = 0.823 + ((3.27 - 0.823) * row) / rows;
    const front = radialRing(level, radius + 0.014, radius * 0.9 + 0.014, steps);
    const outer = radialRing(level + 0.012, radius + 0.109, radius * 0.9 + 0.108, steps);
    for (let i = 0; i < steps; i++) {
      const n = (i + 1) % steps;
      // Paired balcony segments alternate between adjacent floors on the visitor side.
      const projecting = i >= steps / 2 && (detail === 1 || (i + (row % 2) * 2) % 4 < 2);
      const offset = projecting ? outer : front;
      beam(out, 'rails', offset[i], offset[n], projecting ? 0.026 : 0.014, 0.035, steel);
      if (!projecting || detail < 2) continue;
      const terrace = [front[n], front[i], outer[i], outer[n]];
      out.addQuad('stone', '', terrace, normalFor(...terrace), undefined, cream);
      const lip = [
        outer[i],
        outer[n],
        ...[outer[n], outer[i]].map(([x, y, z]) => [x, y + 0.053, z]),
      ];
      out.addQuad('rails', '', lip, normalFor(...lip), undefined, steel);
    }
  }
  if (detail < 2) return;
  for (const i of [-2, -1, 0, 1, 2]) {
    box(
      out,
      'windows',
      [i * 0.054 - 0.014, 3.795, 0.02],
      [i * 0.054 + 0.014, 3.922, 0.026],
      darkGlass,
    );
  }
}

function rustTower(out, detail) {
  const sides = [8, 12, 18, 24][detail];
  const center = [dx, 0];
  const radius = [0.804, 0.717];
  ellipticalStrip(
    out,
    'stone',
    center,
    radius,
    [
      [0.533, 0.71],
      [0.755, 0.93],
    ],
    sides,
    ivory,
  );
  ellipticalStrip(
    out,
    'rails',
    center,
    radius,
    [
      [0.755, 0.984],
      [3.036, 1],
    ],
    sides,
    rustGlass,
  );
  ellipticalStrip(
    out,
    'stone',
    center,
    radius,
    [
      [3.036, 1],
      [3.245, 0.961],
    ],
    sides,
    red,
  );
  const blank = radius[1] + 0.012;
  box(out, 'stone', [dx - 0.258, 0.767, blank - 0.058], [dx + 0.258, 3.185, blank], red);
  box(out, 'stone', [dx - 0.258, 0.767, -blank], [dx + 0.258, 3.185, -blank + 0.058], red);
  if (!detail) return;
  const rows = detail === 1 ? 6 : 12;
  const ring = radialRing(0, radius[0] * 1.009, radius[1] * 1.009, sides, center);
  for (let i = 0; i < sides; i++) {
    const [x, , z] = ring[i];
    if (Math.abs(x - dx) < 0.252) continue;
    beam(out, 'rails', [x, 0.758, z], [x, 3.047, z], 0.016, 0.021, warmMetal);
    const [nx, , nz] = ring[(i + 1) % sides];
    if (Math.abs((x + nx) / 2 - dx) < 0.315) continue;
    for (let j = 0; j <= rows; j++) {
      const y = 0.76 + ((3.04 - 0.76) * j) / rows;
      beam(out, 'rails', [x, y, z], [nx, y, nz], 0.018, 0.02, warmMetal);
    }
  }
  if (detail < 3) return;
  for (const offset of [-0.22, 0.22])
    box(out, 'stone', [dx + offset - 0.027, 3.182, -0.49], [dx + offset + 0.027, 3.242, 0.49], red);
}

function build(out, detail) {
  podium(out, detail);
  greyTower(out, detail);
  rustTower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
