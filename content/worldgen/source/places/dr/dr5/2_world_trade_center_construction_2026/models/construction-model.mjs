import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import layout from '../layout.json' with { type: 'json' };

export const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.88, metallic: 0 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.19 },
  duct: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.64, metallic: 0.23 },
};

const slab = [0.46, 0.45, 0.4];
const fill = [0.24, 0.235, 0.219];
const plywood = [0.56, 0.457, 0.298];
const timber = [0.37, 0.29, 0.207];
const orange = [0.61, 0.149, 0.071];
const white = [0.72, 0.734, 0.693];
const galvanized = [0.45, 0.49, 0.49];
const steel = [0.25, 0.28, 0.28];
const frameYellow = [0.63, 0.53, 0.19];
const silver = [0.62, 0.65, 0.66];
const dark = [0.105, 0.126, 0.132];

function block(out, material, [x0, z0, x1, z1], y0, y1, color) {
  box(out, material, [x0, y0, z0], [x1, y1, z1], color);
}

function rail(out, a, b, base, tint, detailed, spacing) {
  const height = 1.08;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const count = Math.ceil(length / spacing);
  const y = base + height;
  beam(out, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.083, 0.083, tint);
  if (detailed) {
    beam(out, 'steel', [a[0], base + 0.51, a[1]], [b[0], base + 0.51, b[1]], 0.047, 0.048, tint);
  }
  for (let index = 0; index <= count; index++) {
    const t = index / count;
    const [x, z] = a.map((value, axis) => value + (b[axis] - value) * t);
    beam(out, 'steel', [x, base, z], [x, y, z], 0.063, 0.07, tint);
  }
}

function workDeck(out, deck, detail, sparseScaffold) {
  const { rect, y, openSide } = deck;
  block(out, 'wood', rect, y - 0.21, y, plywood);
  const [x0, z0, x1, z1] = rect;
  const edges = [
    [
      [x0, z0],
      [x1, z0],
    ],
    [
      [x1, z0],
      [x1, z1],
    ],
    [
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0, z1],
      [x0, z0],
    ],
  ];
  const railSpacing = sparseScaffold ? [0, 13.5, 2.8, 1.65] : [0, 8.5, 1.65, 1.65];
  for (const [side, [a, b]] of edges.entries()) {
    if (side !== openSide && detail > 0)
      rail(out, a, b, y, orange, detail > 1, railSpacing[detail]);
  }
  const alongX = x1 - x0 > z1 - z0;
  const [start, end, near, far] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const spacing = (sparseScaffold ? [end - start, 13.5, 5.4, 1.85] : [end - start, 7.2, 3.4, 1.85])[
    detail
  ];
  const bays = Math.ceil((end - start) / spacing);
  const map = (along, across, elevation) =>
    alongX ? [along, elevation, across] : [across, elevation, along];
  const faces = detail === 0 ? [(near + far) / 2] : [near + 0.13, far - 0.13];
  for (const face of faces) {
    beam(out, 'steel', map(start, face, y - 0.3), map(end, face, y - 0.3), 0.14, 0.13, steel);
    for (let index = 0; index <= bays; index++) {
      const a = start + ((end - start) * index) / bays;
      beam(out, 'steel', map(a, face, 0.19), map(a, face, y - 0.22), 0.105, 0.105, galvanized);
      if (detail < 1 || index === bays || (detail === 1 && face > (near + far) / 2)) continue;
      const b = start + ((end - start) * (index + 1)) / bays;
      const bracingBands = detail > 2 ? Math.ceil(y / 2.25) : detail === 2 ? 2 : 1;
      for (let level = 0; level < bracingBands; level++) {
        const lower = 0.22 + ((y - 0.51) * level) / bracingBands;
        const upper = 0.22 + ((y - 0.51) * (level + 1)) / bracingBands;
        beam(out, 'steel', map(a, face, lower), map(b, face, upper), 0.062, 0.062, galvanized);
        if (detail > 2) {
          beam(out, 'steel', map(a, face, upper), map(b, face, lower), 0.054, 0.054, galvanized);
          beam(out, 'steel', map(a, face, upper), map(b, face, upper), 0.072, 0.067, steel);
        }
      }
    }
  }
}

function core(out, { rect, y, cap }, detail) {
  const [x0, z0, x1, z1] = rect;
  const width = 0.59;
  const walls = [
    [x0, z0, x1, z0 + width],
    [x0, z1 - width, x1, z1],
    [x0, z0 + width, x0 + width, z1 - width],
    [x1 - width, z0 + width, x1, z1 - width],
  ];
  for (const [index, wall] of walls.entries()) {
    block(out, 'concrete', wall, 0.1, y, slab);
    const [a, b, c, d] = wall;
    if (detail > 0 || index === 2) {
      block(out, 'wood', [a - 0.06, b - 0.06, c + 0.06, d + 0.06], y - 0.74, y + 0.08, orange);
    }
    if (detail < 2) continue;
    const alongX = c - a > d - b;
    const span = alongX ? c - a : d - b;
    for (let offset = 0.22; offset < span; offset += detail === 2 ? 1.19 : 0.83) {
      const x = alongX ? a + offset : a - 0.075;
      const z = alongX ? b - 0.075 : b + offset;
      block(out, 'steel', [x, z, x + 0.1, z + 0.1], y - 0.82, y + 0.22, steel);
      if (detail > 2) {
        const x2 = alongX ? x : c + 0.028;
        const z2 = alongX ? d + 0.028 : z;
        block(out, 'steel', [x2, z2, x2 + 0.087, z2 + 0.087], y - 0.82, y + 0.07, galvanized);
      }
    }
  }
  if (cap && detail > 0) {
    const [a, b, c, d] = cap;
    for (const side of [a, c - 0.38]) {
      block(out, 'wood', [side, b, side + 0.38, d], y + 0.08, y + 0.22, timber);
    }
    const count = detail > 1 ? 12 : 4;
    for (let i = 0; i < count; i++) {
      const z = b + ((d - b - 0.27) * i) / (count - 1);
      block(out, 'wood', [a, z, c, z + 0.27], y + 0.19, y + 0.36, i % 3 ? plywood : orange);
    }
  }
}

function hoarding(out, detail, layout) {
  const { hoarding: fence, hoardingGround } = layout;
  for (const [index, a] of fence.entries()) {
    if (layout.openEntrance && index === 0) continue;
    const next = (index + 1) % fence.length;
    const b = fence[next];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const gate = index === 0;
    const height = gate ? 2.16 : 2.68;
    const panelWidth = detail > 1 ? 2.6 : length;
    const count = Math.ceil(length / panelWidth);
    for (let i = 0; i < count; i++) {
      const ground = (t) =>
        hoardingGround[index] + (hoardingGround[next] - hoardingGround[index]) * t;
      const point = (t, lift) => [
        a[0] + (b[0] - a[0]) * t,
        ground(t) + lift,
        a[1] + (b[1] - a[1]) * t,
      ];
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const tint = i % 3 === 1 ? [0.66, 0.68, 0.645] : white;
      beam(out, 'wood', point(t0, height / 2), point(t1, height / 2), 0.145, height, tint);
      if (detail > 0) {
        beam(out, 'concrete', point(t0, 0.05), point(t1, 0.05), 0.46, 0.54, slab);
      }
      if (detail > 1) {
        beam(out, 'steel', point(t0, 0.25), point(t0, height + 0.07), 0.11, 0.11, galvanized);
      }
    }
  }
}

function siteServices(out, detail, layout) {
  block(out, 'concrete', [15.5, -13.6, 36.8, 15], 0.04, 2.55, slab);
  block(out, 'concrete', [31.6, 5.2, 37, 15], 2.55, 4.28, white);
  for (const z of [8.35, 12.5]) {
    const profiles = [
      [36.1, z, 4.1],
      [35.8, z, 7.1],
      [34.95, z, 8.5],
      [33.65, z, 9.2],
    ];
    loft(
      out,
      'duct',
      profiles.map(([x, tz, y]) =>
        radialRing(y, 0.81, 0.78, detail > 1 ? 12 : detail === 1 ? 6 : 4, [x, tz]),
      ),
      z > 10 ? [0.5, 0.66, 0.54] : [0.51, 0.62, 0.72],
    );
  }
  for (const [min, max] of [
    [-11.9, -7.1],
    [-5.2, -0.25],
    [2.15, 5.5],
    [7.3, 10.2],
  ]) {
    if (!layout.sparseScaffold || detail > 0)
      block(out, 'duct', [18.5, min, 30.8, max], 2.51, 3.46, silver);
    if (!layout.sparseScaffold || detail > 0)
      block(out, 'duct', [28.5, min, 30.8, max], 3.44, 4.14, galvanized);
    if (detail > 1) {
      for (const x of [20.5, 23.2, 26, 28.4]) {
        block(out, 'steel', [x, min, x + 0.09, max], 3.46, 3.55, steel);
      }
    }
  }
  if (detail === 0) return;
  for (const [rect, tint] of [
    [
      [-41.2, -3.2, -37.4, 7.6],
      [0.57, 0.528, 0.42],
    ],
    [[-41.2, 8.4, -37.1, 18], white],
    [layout.northOffice ?? [-36.6, -20.3, -29.2, -16.9], [0.445, 0.492, 0.498]],
  ]) {
    block(out, 'wood', rect, -1.96, 2.89, tint);
    block(out, 'duct', rect, 2.89, 3.02, silver);
    if (detail < 2) continue;
    const [x0, z0, x1, z1] = rect;
    for (let z = z0 + 1.1; z + 1 < z1; z += 2.3) {
      block(out, 'steel', [x0 - 0.028, z, x0 + 0.03, z + 0.91], 1.42, 2.17, dark);
    }
    block(out, 'steel', [x1 - 0.02, z1 - 1.3, x1 + 0.03, z1 - 0.45], 0.23, 2.23, dark);
  }
}

function towerCrane(out, detail, layout) {
  const { x, z, y, tip, tail } = layout.crane;
  const corners = [
    [-0.83, -0.83],
    [0.83, -0.83],
    [0.83, 0.83],
    [-0.83, 0.83],
  ];
  block(out, 'concrete', [x - 1.9, z - 1.8, x + 1.9, z + 1.8], -2.21, 1.22, slab);
  for (const [u, v] of corners) {
    beam(out, 'steel', [x + u, 1.21, z + v], [x + u, y, z + v], 0.165, 0.162, white);
  }
  const step = detail > 1 ? 2.25 : detail > 0 ? 5.8 : y;
  const sections = Math.ceil((y - 1.22) / step);
  for (let index = 0; index < sections; index++) {
    const a = 1.22 + ((y - 1.22) * index) / sections;
    const b = 1.22 + ((y - 1.22) * (index + 1)) / sections;
    for (const [i, [u, v]] of corners.entries()) {
      const [s, t] = corners[(i + 1) % corners.length];
      const from = [x + u, a, z + v];
      const to = [x + s, b, z + t];
      beam(out, 'steel', from, to, 0.11, 0.11, white);
      if (detail > 1) beam(out, 'steel', [x + u, b, z + v], to, 0.114, 0.117, white);
    }
  }
  block(out, 'steel', [x - 1.04, z - 1.04, x + 1.04, z + 1.04], y - 0.22, y + 0.72, galvanized);
  block(out, 'wood', [x - 0.9, z + 0.91, x + 1.62, z + 2.39], y + 0.46, y + 2.2, white);
  if (detail > 0)
    block(out, 'steel', [x - 0.72, z + 2.39, x + 1.53, z + 2.44], y + 1.03, y + 1.96, dark);
  function jib(end, rise, color) {
    const dx = end[0] - x;
    const dz = end[1] - z;
    const length = Math.hypot(dx, dz);
    const cross = [dz / length, -dx / length];
    const count = Math.ceil(length / (detail > 1 ? 2.8 : detail > 0 ? 5.5 : length));
    const top = (t) => [x + dx * t, y + 1.8 + rise * t, z + dz * t];
    const chord = (t, side) => [
      x + dx * t + side * cross[0] * 0.54,
      y + 0.56 + rise * t,
      z + dz * t + side * cross[1] * 0.54,
    ];
    beam(out, 'steel', top(0), top(1), 0.15, 0.15, color);
    for (const s of [-1, 1]) {
      beam(out, 'steel', chord(0, s), chord(1, s), 0.16, 0.16, color);
      for (let i = 0; i < count; i++) {
        beam(out, 'steel', chord(i / count, s), top((i + 1) / count), 0.095, 0.095, color);
        if (detail > 0) {
          beam(out, 'steel', chord((i + 1) / count, s), top((i + 1) / count), 0.086, 0.086, color);
        }
      }
    }
  }
  jib(tip, 3.42, frameYellow);
  jib(tail, -0.08, white);
  block(
    out,
    'concrete',
    [tail[0] - 1.4, tail[1] - 1.1, tail[0] + 1.4, tail[1] + 1.1],
    y - 0.37,
    y + 1.15,
    slab,
  );
}

export function buildConstruction(out, detail, layout) {
  if (layout.constructionAccess) {
    const { west, east, north, south, northGrade, southGrade } = layout.constructionAccess;
    block(out, 'concrete', [-40.5, -19.3, east, north], -2.3, 0.19, slab);
    block(out, 'concrete', [-40.5, south, east, 16.45], -2.3, 0.19, slab);
    block(out, 'concrete', [east, -19.3, 38.2, 16.45], -2.3, 0.19, slab);
    loft(
      out,
      'concrete',
      [
        [
          [west, -2.3, north],
          [west, northGrade, north],
          [west, southGrade, south],
          [west, -2.3, south],
        ],
        [
          [east, -2.3, north],
          [east, 0.19, north],
          [east, 0.19, south],
          [east, -2.3, south],
        ],
      ],
      fill,
    );
  } else {
    block(out, 'concrete', [-40.5, -19.3, 38.2, 16.45], -2.3, 0.19, slab);
  }
  block(out, 'concrete', [-32.7, -14.1, 13.4, 16.1], 0.189, 0.66, fill);
  hoarding(out, detail, layout);
  for (const deck of layout.decks) workDeck(out, deck, detail, layout.sparseScaffold);
  for (const chamber of layout.core) core(out, chamber, detail);
  siteServices(out, detail, layout);
  towerCrane(out, detail, layout);
  if (detail > 1) {
    for (const [i, { rect, y }] of layout.deckStock.entries()) {
      for (let j = 0; j < (detail > 2 ? 4 : 2); j++) {
        const [x0, z0, x1, z1] = rect;
        const z = z0 + ((z1 - z0) * j) / 4;
        block(
          out,
          i % 2 ? 'steel' : 'wood',
          [x0, z, x1, z + 0.23],
          y,
          y + 0.15,
          i % 2 ? galvanized : timber,
        );
      }
    }
  }
}

export const buildSkyline = (out) => buildConstruction(out, 0, layout);
export const buildDistrict = (out) => buildConstruction(out, 1, layout);
export const buildStreet = (out) => buildConstruction(out, 2, layout);
export const buildCloseup = (out) => buildConstruction(out, 3, layout);
export const buildMaster = buildCloseup;
