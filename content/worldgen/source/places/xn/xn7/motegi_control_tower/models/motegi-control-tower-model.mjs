import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');

const colors = {
  silver: [rgb('b4b4ad'), rgb('bfc0ba'), rgb('b8bab2'), rgb('aeb1aa')],
  roof: rgb('505955'),
  blue: rgb('657b80'),
  corrugation: rgb('52676a'),
  soffit: rgb('66534a'),
  steel: rgb('515653'),
  railing: rgb('777f79'),
  dark: rgb('333b3a'),
  glazing: [rgb('506162'), rgb('596b69'), rgb('65716d'), rgb('576767')],
  base: rgb('9a9b90'),
  brick: rgb('887461'),
};
const surfaces = {
  silver: { slot: 'wall', graph: 'metal_painted', roughness: 0.82, metallic: 0.11 },
  blue: { slot: 'trim', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.10 },
  frame: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.33, metallic: 0.12 },
  masonry: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.93 },
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.9 },
};

function box(out, slot, x0, x1, z0, z1, y0, y1, tint) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tint, { bottom: false });
}

function pane(out, f, x0, x1, y0, y1, depth, tint) {
  quad4(out, 'glass', f.P(x0, y0, depth), f.P(x1, y0, depth), f.P(x1, y1, depth),
    f.P(x0, y1, depth), tint);
}

function brace(out, a, b, size, tint = colors.steel) {
  beam(out, 'frame', a, b, size, size, tint);
}

function rail(out, a, b, level) {
  const count = level === 1 ? 2 : 4;
  const vertex = (t, y) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + y,
    a[2] + (b[2] - a[2]) * t];
  brace(out, vertex(0, 0.96), vertex(1, 0.96), 0.047, colors.railing);
  if (level > 1) brace(out, vertex(0, 0.48), vertex(1, 0.48), 0.031, colors.railing);
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    brace(out, vertex(t, 0.015), vertex(t, 0.96), 0.046, colors.railing);
  }
}

function wallModules(out, f, extents, level) {
  const [left, right, bottom, top] = extents;
  const floors = [[bottom, 9.44], [9.45, 10.33], [10.35, 12.28], [12.29, top]];
  if (level === 0) {
    pane(out, f, left + 0.12, right - 0.14, 9.45, 10.33, 0.026, colors.glazing[0]);
    return;
  }
  const bays = level > 1 ? 6 : 4;
  const pitch = (right - left) / bays;
  for (let i = 0; i < bays; i++) {
    const a = left + i * pitch + 0.012;
    const b = a + pitch - 0.029;
    for (const [j, [y0, y1]] of floors.entries()) {
      if (j === 1) pane(out, f, a, b, y0, y1, 0.033, colors.glazing[i % 4]);
      else fbox(out, 'silver', f, a, b, y0, y1, 0.005, 0.065, colors.silver[(i + j) % 4]);
    }
    if (level > 1 && i > 0)
      fbox(out, 'frame', f, a - 0.015, a + 0.010, bottom, top, 0.017, 0.024, colors.steel);
  }
}

function observationBlock(out, level) {
  const upper = plan.dimensions.mainObservationBlockTopM;
  box(out, 'masonry', -18.4, 18.25, -5.28, 5.37, -0.55, 0.16, colors.base);
  box(out, 'blue', -18.36, 9.84, -5.50, 4.88, 0.16, 5.98, colors.corrugation);
  box(out, 'silver', -18.43, 5.86, -5.53, 5.57, 5.62, upper, colors.silver[0]);
  wallModules(out, facade([0, 5.57], [1, 0]), [-18.43, 5.86, 5.64, upper], level);
  wallModules(out, facade([0, -5.53], [-1, 0]), [-5.86, 18.43, 5.64, upper], level);
  wallModules(out, facade([-18.43, 0], [0, 1]), [-5.53, 5.57, 5.64, upper], level);

  const lower = facade([0, 4.9], [1, 0]);
  pane(out, lower, -6.86, 5.78, 0.82, 3.42, 0.024, colors.glazing[1]);
  if (level > 0) {
    const bays = level > 1 ? 11 : 6;
    for (let i = 0; i < bays; i++) {
      const a = -6.84 + i * 12.56 / bays;
      pane(out, lower, a, a + 12.56 / bays - 0.074, 0.84, 3.38, 0.050, colors.glazing[i % 4]);
    }
  }
  box(out, 'blue', 5.88, 10.72, -5.31, 5.57, 0.16, upper - 0.08, colors.blue);
  const turn = facade([0, 5.575], [1, 0]);
  for (const [y, h] of [[1.02, 2.04], [5.38, 2.30], [11.46, 1.0]]) {
    pane(out, turn, 6.15, 10.28, y, y + h, 0.035, colors.glazing[0]);
    if (level > 0) {
      for (let i = 1; i <= 4; i++) {
        const x = 6.13 + i * 0.818;
        fbox(out, 'frame', turn, x - 0.022, x + 0.022, y, y + h, 0.038, 0.069, colors.steel);
      }
    }
  }
  box(out, 'brick', 9.9, 18.34, -5.36, 0.41, 0.10, upper - 0.94, colors.brick);
  const bay = facade([0, 0.42], [1, 0]);
  for (const [lo, hi] of [[0.39, 2.93], [4.32, 7.07], [8.31, 11.33]]) {
    pane(out, bay, 11.72, 14.63, lo, hi, 0.024, colors.dark);
  }
}

function roofTerrace(out, level) {
  const y = plan.dimensions.mainObservationBlockTopM;
  const roof = plan.dimensions.roofCanopyM;
  box(out, 'silver', -18.52, 6.00, -5.53, 5.63, y - 0.1, y + 0.11, colors.silver[2]);
  box(out, 'frame', -17.98, 2.30, -5.33, 4.94, roof - 0.63, roof, colors.roof);
  abox(out, 'frame', [-17.95, roof - 0.67, -5.32], [2.28, roof - 0.62, 4.92], colors.soffit);
  box(out, 'blue', -5.9, 3.91, -4.86, -1.74, y + 0.03, roof - 0.71, colors.corrugation);
  for (const x of [-16.24, -9.03, 0.82]) {
    for (const z of [-4.5, 4.22]) {
      brace(out, [x, y + 0.08, z], [x, roof - 0.65, z], 0.18);
    }
  }
  if (level > 0) {
    rail(out, [-17.76, y + 0.1, 5.20], [5.22, y + 0.1, 5.20], level);
    rail(out, [5.22, y + 0.1, 5.20], [5.22, y + 0.1, -5.24], level);
    if (level > 1) {
      for (const x of [7.1, 8.2, 9.3]) {
        brace(out, [x, y, 2.11], [x, y + 3.65, 2.11], 0.038, colors.railing);
      }
    }
  }
}

function staircase(out, level) {
  const lx = 10.92;
  const rx = 18.28;
  const back = 0.38;
  const front = 5.74;
  const heights = [0.25, 4.12, 7.91, 11.77];
  const crown = plan.dimensions.stairPortalTopM;
  for (const x of [lx, rx]) {
    for (const z of [back, front]) {
      brace(out, [x, -0.14, z], [x, crown, z], 0.28);
    }
    brace(out, [x, crown, back], [x, crown, front], 0.24);
  }
  for (const z of [back, front]) brace(out, [lx, crown, z], [rx, crown, z], 0.24);
  for (let i = 0; i < heights.length; i++) {
    const y = heights[i];
    const stepUp = i % 2 === 0 ? 1 : -1;
    const edge = stepUp > 0 ? lx : rx;
    const far = stepUp > 0 ? rx : lx;
    const z0 = i % 2 === 0 ? 1.1 : 3.32;
    const z1 = z0 + 1.82;
    const dx = stepUp * 0.8;
    box(out, 'frame', lx, rx, back, front, y - 0.18, y, colors.steel);
    if (i === heights.length - 1) {
      if (level > 0) rail(out, [lx, y, front - 0.17], [rx, y, front - 0.17], level);
      continue;
    }
    const next = heights[i + 1];
    const from = edge + dx;
    const to = far - dx;
    if (level < 2) {
      quad4(out, 'frame', [from, y, z0], [from, y, z1], [to, next, z1], [to, next, z0],
        colors.steel);
    } else {
      const steps = level === 2 ? 11 : 17;
      for (let j = 0; j < steps; j++) {
        const a = from + (to - from) * j / steps;
        const b = from + (to - from) * (j + 1) / steps;
        const h = y + (next - y) * (j + 1) / steps;
        box(out, 'frame', Math.min(a, b), Math.max(a, b), z0, z1, h - 0.16, h, colors.steel);
      }
    }
    if (level > 0) {
      rail(out, [from, y, z1], [to, next, z1], level);
      rail(out, [lx, y, front - 0.14], [rx, y, front - 0.14], level);
    }
  }
}

function build(out, level) {
  observationBlock(out, level);
  roofTerrace(out, level);
  staircase(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'motegi-control-tower-model.mjs';
const camera = [-46, 26, 48];
const lookAt = [0, 7.3, 0.1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Motegi Control Tower',
  wikidataId: plan.wikidataId,
  category: 'motorsport-building',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief: 'Motegi paddock control building with silver curtain wall, dark blue stair bay and open roof shelter.',
  camera,
  lookAt,
  sunDirection: [-36, 62, 52],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Mapped paddock control building with its exterior stairs.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_standing_seam', 'concrete_panel', 'brick_longformat'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'paddock-stair-and-roof-shelter', position: [-32, 6.1, 39], lookAt: [3.5, 8.6, 1.7] },
    { name: 'paddock-exterior-switchback-stairs', position: [29, 13, 26], lookAt: [13, 7.2, 2.75] },
    { name: 'track-elevation-and-roof-deck', position: [-19, 23, -30], lookAt: [-1, 7.9, -0.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'motegi-control-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.106, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.043, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense: 'Original 3D work under the repository license, map footprint under ODbL and native GSI elevations under source attribution terms.',
};
