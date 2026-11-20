import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  shell: { slot: 'wall', graph: 'concrete_plain' },
  deck: { slot: 'foundation', graph: 'stone_limestone' },
  windows: { slot: 'window', graph: 'window_grid' },
  trim: { slot: 'trim', graph: 'metal_painted' },
};

const white = [0.8, 0.785, 0.75];
const deck = [0.63, 0.603, 0.548];
const glass = [0.11, 0.15, 0.195];
const atrium = [0.29, 0.176, 0.151];
const pink = [0.59, 0.34, 0.36];
const pool = [0.17, 0.45, 0.61];
const palette = 'palette:#ffffff';

export const dimensions = {
  platform: [-2.49, -1.54, 1.59, 1.74],
  highestRoofWidth: 1.55,
};

function arcade(out, detail) {
  const [left, back, right, front] = dimensions.platform;
  box(out, 'deck', [left, -0.45, back], [right, 0, front], deck);
  const addPier = (x, z, width, depth) =>
    box(out, 'shell', [x, 0, z], [x + width, 0.38, z + depth], white);
  const coreFront = front - 0.29;
  box(out, 'shell', [left + 0.11, 0, back + 0.08], [right - 0.1, 0.81, coreFront], white);
  box(
    out,
    'windows',
    [left + 0.16, 0.048, coreFront - 0.004],
    [right - 0.15, 0.399, coreFront + 0.008],
    glass,
  );
  const bays = detail >= 2 ? 14 : 8;
  const spacing = (right - left - 0.14) / bays;
  for (let bay = 0; bay <= bays; bay++) {
    const x = left + 0.07 + bay * spacing;
    addPier(x - 0.035, front - 0.096, 0.07, 0.096);
    if (bay === bays) continue;
    const next = x + spacing;
    for (const z of [front, front - 0.096]) {
      const crown = [(x + next) / 2, 0.36, z];
      const a = [x + 0.034, 0.255, z];
      const b = [next - 0.034, 0.255, z];
      const upper = [crown[0], 0.39, z];
      for (const section of [
        [a, crown, upper, [a[0], 0.39, z]],
        [crown, b, [b[0], 0.39, z], upper],
      ]) {
        const vertices = z === front ? section : section.toReversed();
        out.addQuad('shell', palette, vertices, normalFor(...vertices), [], white);
      }
    }
  }
  for (const x of [left + 0.03, right - 0.1]) {
    if (detail > 0)
      for (const z of [front - 0.39, front - 0.69, front - 0.99]) addPier(x, z, 0.075, 0.074);
  }
  for (const [bottom, top] of [
    [0.39, 0.443],
    [0.63, 0.68],
    [0.87, 0.947],
  ]) {
    box(
      out,
      'shell',
      [left + 0.015, bottom, back + 0.025],
      [right - 0.02, top, front + 0.012],
      white,
    );
  }
  for (const bottom of [0.443, 0.68]) {
    box(
      out,
      'windows',
      [left + 0.06, bottom, front - 0.064],
      [right - 0.06, bottom + 0.19, front - 0.037],
      glass,
    );
    if (detail === 0) continue;
    for (let bay = 0; bay <= bays; bay++) {
      const x = left + 0.077 + bay * spacing;
      box(
        out,
        'shell',
        [x - 0.033, bottom, front - 0.066],
        [x + 0.033, bottom + 0.19, front + 0.003],
        white,
      );
    }
  }
}

function towerFloor(out, { left, right, back, front, y, rise, tint }, detail) {
  const top = y + rise;
  const dark = tint ?? glass;
  box(out, 'windows', [left + 0.022, y, back + 0.022], [right - 0.022, top, front - 0.022], dark);
  box(out, 'shell', [left, top - 0.035, back], [right, top, front], white);
  if (detail === 0) return;
  const bays = Math.max(1, Math.round((right - left) / (detail === 1 ? 0.35 : 0.21)));
  for (let column = 0; column <= bays; column++) {
    const x = left + ((right - left) * column) / bays;
    for (const z of detail === 1 ? [front - 0.026] : [front - 0.026, back + 0.026]) {
      box(out, 'shell', [x - 0.018, y, z - 0.028], [x + 0.018, top - 0.035, z + 0.028], white);
    }
  }
  if (detail < 2) return;
  const sides = Math.max(2, Math.round((front - back) / 0.22));
  for (let column = 1; column < sides; column++) {
    const z = back + ((front - back) * column) / sides;
    for (const x of [left, right]) {
      box(out, 'shell', [x - 0.008, y, z - 0.018], [x + 0.032, top - 0.035, z + 0.018], white);
    }
  }
}

function towers(out, detail) {
  const first = 0.947;
  const rise = 0.177;
  const roofHalf = dimensions.highestRoofWidth / 2;
  for (let level = 0; level < 19; level++) {
    const left = -2.32 + Math.min(level, 10) * 0.1545;
    const right = level > 10 ? roofHalf : -1.12 + 0.126 * level;
    const y = first + rise * level;
    const combined = detail === 0 && level === 11;
    towerFloor(
      out,
      { left, right, back: -1.43, front: 0.03, y, rise: combined ? 8 * rise : rise },
      detail,
    );
    if (combined) break;
    if (level < 11) {
      const coreStories = detail === 0 ? 3 : 1;
      if (level % coreStories === 0) {
        const coreTop = y + Math.min(coreStories, 11 - level) * rise;
        box(out, 'shell', [right - 0.11, y, -1.28], [roofHalf, coreTop, -0.25], atrium);
      }
      box(
        out,
        'trim',
        [left - 0.046, y + rise - 0.028, -1.45],
        [left + 0.115, y + rise + 0.008, 0.061],
        pink,
      );
      if (detail > 0)
        box(
          out,
          'trim',
          [right - 0.116, y + rise - 0.032, -0.18],
          [right + 0.055, y + rise + 0.005, 0.073],
          pink,
        );
    }
  }
  const top = first + 19 * rise;
  box(
    out,
    'shell',
    [-roofHalf - 0.015, top, -1.444],
    [roofHalf + 0.015, top + 0.055, 0.047],
    white,
  );
  const step = detail === 0 ? 2 : 1;
  for (let level = 0; level < 9; level += step) {
    const right = 1.47 - level * 0.136;
    const y = first + level * rise;
    const height = y + Math.min(step, 9 - level) * rise;
    towerFloor(out, { left: -0.12, right, back: -0.221, front: 1.07, y, rise: height - y }, detail);
    box(
      out,
      'shell',
      [right - 0.17, height - 0.053, -0.24],
      [right + 0.104, height + 0.01, 1.108],
      white,
    );
  }
}

function terrace(out, detail) {
  const skylight = [
    [-0.91, 0.952, 0.66],
    [-0.31, 0.952, 0.66],
    [-0.31, 0.952, 1.32],
    [-0.91, 0.952, 1.32],
  ];
  const apex = [-0.61, 1.27, 0.99];
  for (const [i, point] of skylight.entries()) {
    const face = [point, apex, skylight[(i + 1) % skylight.length]];
    out.addTriangle('windows', palette, face, normalFor(...face), [], [0.34, 0.49, 0.5]);
    if (detail >= 3) beam(out, 'trim', point, apex, 0.018, 0.016, [0.32, 0.34, 0.31]);
  }
  box(out, 'deck', [-1.73, 0.948, 0.51], [-1.07, 0.982, 0.95], white);
  box(out, 'trim', [-1.68, 0.982, 0.56], [-1.12, 0.989, 0.9], pool);
  if (detail >= 2) {
    for (const z of [1.49, 1.66]) {
      box(out, 'deck', [-2.09, 0.947, z], [1.34, 0.974, z + 0.019], deck);
    }
  }
}

function build(out, detail) {
  arcade(out, detail);
  towers(out, detail);
  terrace(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
