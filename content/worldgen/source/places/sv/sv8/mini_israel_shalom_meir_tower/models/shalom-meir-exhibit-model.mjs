import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  shell: { slot: 'wall', graph: 'concrete_plain' },
  paving: { slot: 'foundation', graph: 'stone_limestone' },
  glazing: { slot: 'window', graph: 'window_grid' },
  metal: { slot: 'trim', graph: 'metal_painted' },
};

const facade = [0.79, 0.784, 0.746];
const crown = [0.84, 0.834, 0.778];
const podium = [0.66, 0.657, 0.625];
const shade = [0.3, 0.32, 0.34];
const glass = [0.32, 0.36, 0.39];
const tar = [0.21, 0.222, 0.226];
const paint = [0.87, 0.858, 0.796];
const steel = [0.63, 0.654, 0.659];

function buildPodium(out, detail) {
  const add = (slot, x0, y0, z0, x1, y1, z1, tint) =>
    box(out, slot, [x0, y0, z0], [x1, y1, z1], tint);

  add('paving', -2.47, -0.11, -1.59, 2.47, 0, 1.82, podium);
  add('shell', -0.75, 0.001, -1.58, 0.75, 0.012, 1.81, tar);

  // Wings and roof slabs surround a real drive-through and an open light well.
  for (const side of [-1, 1]) {
    const [outer, inner] = side < 0 ? [-2.35, -0.63] : [0.63, 2.35];
    add('shell', outer, 0, -1.42, inner, 0.342, 1.58, podium);
    add('shell', outer, 0.342, -1.47, inner, 0.48, 1.64, facade);
    for (const z of [-1.427, 1.586]) {
      add('glazing', outer + 0.06, 0.069, z - 0.007, inner - 0.045, 0.319, z + 0.007, shade);
      if (detail >= 2) {
        for (let i = 1; i < 8; i++) {
          const x = outer + ((inner - outer) * i) / 8;
          add('metal', x - 0.008, 0.069, z - 0.009, x + 0.008, 0.319, z + 0.009, steel);
        }
      }
    }
    const hatch = side * 1.55;
    add('shell', hatch - 0.19, 0.48, 0.88, hatch + 0.19, 0.503, 1.21, crown);
  }
  add('shell', -0.63, 0.342, -1.47, 0.63, 0.48, 0.715, facade);
  add('shell', -0.63, 0.342, 1.435, 0.63, 0.48, 1.64, facade);
  add('shell', -0.63, 0.342, 0.715, -0.477, 0.48, 1.435, facade);
  add('shell', 0.477, 0.342, 0.715, 0.63, 0.48, 1.435, facade);

  for (const x of [-0.477, 0.477]) {
    add('metal', x - 0.012, 0.48, 0.715, x + 0.012, 0.522, 1.435, steel);
  }
  for (const z of [0.715, 1.435]) {
    add('metal', -0.477, 0.48, z - 0.012, 0.477, 0.522, z + 0.012, steel);
  }
  if (detail < 2) return;
  for (let i = 0; i < 8; i++) {
    const x = -0.46 + i * 0.13;
    add('shell', x, 0.012, 1.662, x + 0.047, 0.014, 1.792, paint);
  }
  for (let i = 0; i < 7; i++) {
    const z = -1.46 + i * 0.42;
    add('shell', -0.01, 0.012, z, 0.01, 0.014, z + 0.215, paint);
  }
  if (detail < 3) return;
  for (const side of [-1, 1]) {
    for (let i = 1; i < 6; i++) {
      const z = 0.715 + i * 0.12;
      const x = side * 0.477;
      add('metal', x - 0.006, 0.509, z - 0.006, x + 0.006, 0.559, z + 0.006, steel);
    }
    const x = side * 0.477;
    add('metal', x - 0.005, 0.554, 0.715, x + 0.005, 0.564, 1.435, steel);
  }
  for (const z of [0.715, 1.435]) {
    for (let i = 0; i <= 8; i++) {
      const x = -0.477 + (i * 0.954) / 8;
      add('metal', x - 0.006, 0.509, z - 0.006, x + 0.006, 0.559, z + 0.006, steel);
    }
    add('metal', -0.483, 0.554, z - 0.005, 0.483, 0.564, z + 0.005, steel);
  }
}

function buildTower(out, detail) {
  const add = (slot, x0, y0, z0, x1, y1, z1, tint) =>
    box(out, slot, [x0, y0, z0], [x1, y1, z1], tint);
  add('shell', -1.346, 0.48, -0.803, 1.346, 4.816, 0.161, facade);
  add('shell', -1.352, 4.816, -0.809, 1.352, 5.019, 0.17, crown);
  add('glazing', -1.28, 5.019, -0.755, 1.28, 5.143, 0.119, shade);
  add('shell', -1.371, 5.143, -0.833, 1.371, 5.199, 0.191, facade);
  add('shell', -1.392, 5.199, -0.855, 1.392, 5.224, 0.205, crown);

  const floorCount = 29;
  const interval = 0.14;
  for (let floor = 0; floor < floorCount; floor++) {
    const lower = 0.659 + floor * interval;
    const upper = lower + 0.069;
    for (const side of [-1, 1]) {
      const z = side < 0 ? -0.81 : 0.169;
      const tint = floor === 14 || floor === 15 ? shade : glass;
      const [left, right] = [-1.27 * side, 1.27 * side];
      quad(
        out,
        'glazing',
        [
          [left, lower, z],
          [right, lower, z],
          [right, upper, z],
          [left, upper, z],
        ],
        [0, 0, side],
        tint,
      );
      if (detail > 0) {
        add('shell', -1.298, upper, z - 0.028, 1.298, upper + 0.019, z + 0.028, facade);
      }
      if (detail < 2) continue;
      const divisions = detail === 3 ? 32 : 16;
      for (let pair = 1; pair < divisions; pair++) {
        const x = -1.27 + (2.54 * pair) / divisions;
        add('metal', x - 0.004, lower, z - 0.01, x + 0.004, upper, z + 0.01, steel);
      }
    }
  }

  const roofRing = [
    [-1.34, -0.8, 1.34, -0.768],
    [-1.34, 0.132, 1.34, 0.168],
    [-1.34, -0.768, -1.304, 0.132],
    [1.304, -0.768, 1.34, 0.132],
  ];
  add('paving', -1.327, 5.224, -0.78, 1.327, 5.23, 0.143, podium);
  for (const [x0, z0, x1, z1] of roofRing) {
    add('shell', x0, 5.23, z0, x1, 5.268, z1, crown);
  }
  if (detail < 2) return;
  add('shell', -0.44, 5.23, -0.633, 0.46, 5.299, -0.317, podium);
  add('metal', -0.432, 5.299, -0.624, 0.452, 5.315, -0.327, steel);
  if (detail < 3) return;
  for (const side of [-1, 1]) {
    const x = side * 1.346;
    for (const z of [-0.625, -0.32, -0.015]) {
      add('shell', x - 0.012, 0.483, z - 0.014, x + 0.012, 4.81, z + 0.014, crown);
    }
  }
}

function build(out, detail) {
  buildPodium(out, detail);
  buildTower(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;
