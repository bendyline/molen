/** The Bogotá cathedral's retained lower front and rebuilt stone belfries. */
import fs from 'node:fs';
import {
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box as boxFromBounds,
  profile,
  quad,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const { outline } = read('map-frame').geometry;
const d = plan.dimensions;
const c = Object.fromEntries(
  Object.entries({
    stone: 'b4a481',
    stoneLight: 'c8b693',
    trim: 'bcaa83',
    shadow: '85755b',
    foundation: '918675',
    plaster: 'd1c8b3',
    tile: '995a42',
    dome: '786a54',
    ribs: 'a18f70',
    dark: '3c362f',
    wood: '5f4135',
    metal: '504841',
  }).map(([name, tint]) => [name, rgb(tint)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  dark: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.96 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const up = [0, 1, 0];
const west = [-1, 0, 0];

function box(out, slot, x, y, z, width, height, depth, tint) {
  boxFromBounds(
    out,
    slot,
    [x - width / 2, y - height / 2, z - depth / 2],
    [x + width / 2, y + height / 2, z + depth / 2],
    tint,
  );
}

function face(out, slot, points, direction, color) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, n, i) => sum + n * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

function planar(out, slot, points, normal, color) {
  const axes = normal[0] ? [2, 1] : normal[1] ? [0, 2] : [0, 1];
  const triangles = earcut(points.flatMap((p) => axes.map((axis) => p[axis])));
  for (let i = 0; i < triangles.length; i += 3)
    face(
      out,
      slot,
      triangles.slice(i, i + 3).map((index) => points[index]),
      normal,
      color,
    );
}

function boundary(out, slot, ring, low, high, tint) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - nx * z;
  }, 0);
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i];
    const [nx, nz] = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [
        [x, low, z],
        [nx, low, nz],
        [nx, high, nz],
        [x, high, z],
      ],
      [(nz - z) * Math.sign(area), 0, (x - nx) * Math.sign(area)],
      tint,
    );
  }
  planar(
    out,
    slot,
    ring.map(([x, z]) => [x, high, z]),
    up,
    tint,
  );
  planar(
    out,
    slot,
    ring.map(([x, z]) => [x, low, z]),
    [0, -1, 0],
    tint,
  );
}

function gableRoof(out, x0, x1, z0, z1, eaves, ridge, tint = c.tile) {
  const middle = (z0 + z1) / 2;
  const high = [
    [x0, ridge, middle],
    [x1, ridge, middle],
  ];
  for (const z of [z0, z1]) {
    face(out, 'tiles', [[x0, eaves, z], [x1, eaves, z], high[1], high[0]], up, tint);
  }
  face(out, 'plaster', [[x0 + 0.04, eaves, z0], [x0 + 0.04, eaves, z1], high[0]], west, c.plaster);
  face(
    out,
    'plaster',
    [[x1 - 0.04, eaves, z0], [x1 - 0.04, eaves, z1], high[1]],
    [1, 0, 0],
    c.plaster,
  );
}

function body(out, detail) {
  // This mapped perimeter includes the attached low ranges behind the three-portal front.
  const ring =
    detail === 0
      ? outline.filter((_, index) =>
          [0, 41, 43, 48, 49, 56, 57, 59, 60, 64, 68, 78, 79, 93, 110].includes(index),
        )
      : outline;
  boundary(out, 'plaster', ring, -2.6, d.wallHeight, c.plaster);
  box(out, 'plaster', 18.9, 15.6, -2.9, 105.9, 4.8, 24.4, c.plaster);
  gableRoof(out, -34.1, 72.22, -15.54, 9.7, 18.02, 25.2);
  gableRoof(out, -34.7, 72.08, -26.15, -15.66, 13.91, 16.9);
  gableRoof(out, -34.7, 36.9, 9.8, 28.94, 13.91, 17.2);
  gableRoof(out, -6.52, 12.83, 38.95, 45.43, 13.91, 16.3);
  gableRoof(out, -34.73, 12.76, 28.99, 38.93, 13.91, 17.6);
  gableRoof(out, 37.02, 72.04, 9.8, 14.1, 13.91, 15.65);
  if (detail === 0) return;
  const z = -26.98;
  for (const x of [-22, -14.7, -7.4, 4.2, 15.8, 27.4, 39, 50.6, 62.2, 69.1]) {
    box(out, 'trim', x, 10.7, z + 0.37, 1.88, 3.6, 0.35, c.trim);
    box(out, 'dark', x, 10.75, z + 0.13, 1.36, 2.73, 0.38, c.dark);
    if (detail >= 2) {
      box(out, 'detail', x, 10.75, z - 0.075, 0.085, 2.62, 0.095, c.shadow);
      box(out, 'detail', x, 10.85, z - 0.078, 1.29, 0.095, 0.1, c.shadow);
    }
  }
  if (detail >= 2) {
    for (const x of [-19, -9, 1, 11, 21, 31, 41, 51, 61]) {
      for (const z of [-15.19, 9.39]) {
        box(out, 'trim', x, 17.08, z, 1.32, 1.5, 0.28, c.trim);
        box(out, 'dark', x, 17.08, z < 0 ? z - 0.15 : z + 0.15, 0.95, 1.13, 0.04, c.dark);
      }
    }
  }
  const entryHeight = 3.18;
  const stairTreads = detail === 1 ? 4 : 8;
  for (let i = 0; i < stairTreads; i++) {
    const x0 = d.facadeX - 5.48 + (4.22 * i) / stairTreads;
    const y = 0.37 + ((entryHeight - 0.37) * (i + 1)) / stairTreads;
    box(
      out,
      'trim',
      (x0 + d.facadeX) / 2,
      y - 3.4,
      d.centerZ,
      d.facadeX - x0,
      6.8,
      59.1,
      i === stairTreads - 1 ? c.trim : c.foundation,
    );
  }
}

function archCurve(center, half, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const theta = Math.PI * (1 - i / segments);
    return [center + half * Math.cos(theta), spring + rise * Math.sin(theta)];
  });
}

function westArch(out, x, z, width, bottom, spring, rise, detail, tint) {
  const segments = [4, 4, 10, 14][detail];
  const curve = archCurve(z, width / 2, spring, rise, segments);
  const contour = [[z - width / 2, bottom], ...curve, [z + width / 2, bottom]];
  planar(
    out,
    'dark',
    contour.map(([u, y]) => [x, y, u]),
    west,
    tint,
  );
  if (detail > 0) {
    beamPath(
      out,
      'trim',
      contour.map(([u, y]) => [x - 0.06, y, u]),
      0.23,
      0.36,
      c.stoneLight,
    );
  }
}

function trimBand(out, centerX, y, z, widthX, widthZ, thin = false) {
  const thickness = thin ? 0.37 : 0.64;
  box(out, 'stone', centerX, y, z, widthX, thickness, widthZ, c.trim);
  box(
    out,
    'trim',
    centerX,
    y + thickness * 0.68,
    z,
    widthX + 0.21,
    thickness * 0.44,
    widthZ + 0.21,
    c.stoneLight,
  );
}

function pilaster(out, x, z, bottom, top, width, detail) {
  box(out, 'stone', x, (bottom + top) / 2, z, 0.8, top - bottom, width, c.trim);
  if (detail === 0) return;
  for (const [y, depth, enlargement] of [
    [bottom + 0.38, 0.58, 1.43],
    [top - 0.37, 0.46, 1.48],
  ]) {
    box(out, 'trim', x - 0.08, y, z, 0.94, depth, width * enlargement, c.stoneLight);
  }
}

function finial(out, x, z, base, height, radius, detail) {
  profile(
    out,
    [
      [base, radius, radius],
      [base + height * 0.14, radius * 1.08, radius * 1.08, 'trim', c.stoneLight],
      [base + height * 0.31, radius * 0.69, radius * 0.69, 'stone', c.trim],
      [base + height, radius * 0.07, radius * 0.07, 'stone', c.trim],
    ],
    detail >= 2 ? 8 : 4,
    [x, z],
  );
}

function facade(out, detail) {
  const x = d.facadeX;
  const z = d.centerZ;
  const firstCornice = 19.45;
  box(out, 'stone', x + 1.03, 8.7, z, 3.14, 21.4, 62.6, c.stone);
  trimBand(out, x + 0.98, 16.55, z, 3.67, 62.9, true);
  trimBand(out, x + 1.02, firstCornice, z, 4.12, 63.62);
  for (const offset of detail > 0 ? [-29.7, -22.6, -18.2, -6.43, 6.43, 18.2, 22.6, 29.7] : []) {
    pilaster(out, x - 0.63, z + offset, 4.15, 16.3, 0.9, detail);
    if (detail >= 2) {
      pilaster(out, x - 0.98, z + offset + 0.16, 4.4, 16.1, 0.36, detail);
    }
  }
  if (detail > 0) {
    const stride = detail === 1 ? 3.1 : 1.2;
    for (let u = -30; u <= 30; u += stride)
      box(out, 'trim', x - 0.84, 18.96, z + u, 0.72, 1.03, 0.44, c.stoneLight);
    for (const [offset, width, spring, rise] of [
      [-14, 4.72, 10, 2.25],
      [0, 5.8, 10.6, 2.65],
      [14, 4.72, 10, 2.25],
    ]) {
      westArch(out, x - 0.66, z + offset, width, 3.18, spring, rise, detail, c.wood);
      box(
        out,
        'trim',
        x - 0.79,
        spring + rise + 0.97,
        z + offset,
        0.55,
        0.45,
        width + 1.46,
        c.trim,
      );
      if (detail >= 2) {
        box(
          out,
          'detail',
          x - 0.73,
          (3.18 + spring) / 2,
          z + offset,
          0.11,
          spring - 3.19,
          0.11,
          c.dark,
        );
        for (const side of [-1, 1]) {
          for (const y of [5.53, 8.1])
            box(
              out,
              'detail',
              x - 0.73,
              y,
              z + offset + side * width * 0.25,
              0.1,
              1.65,
              width / 2 - 0.45,
              c.wood,
            );
        }
      }
    }
  }

  // The shoulder curves connect the belfries to the central second order.
  const midWidth = 11.85;
  const atticBase = 19.7;
  const atticTop = 27.77;
  box(
    out,
    'stone',
    x + 1.25,
    (atticBase + atticTop) / 2,
    z,
    3.4,
    atticTop - atticBase,
    2 * midWidth,
    c.stone,
  );
  trimBand(out, x + 1.21, atticTop, z, 3.9, 2 * midWidth + 0.6, true);
  for (const side of [-1, 1]) {
    const points = [
      [midWidth, 26.95],
      [12.35, 23.22],
      [14.15, 21.95],
      [16.13, 22.19],
      [17.87, 23.39],
      [18.65, 24.91],
    ];
    const edge = points.map(([u, y]) => [x - 0.69, y, z + u * side]);
    planar(
      out,
      'stone',
      [
        [x - 0.69, atticBase, z + midWidth * side],
        ...edge,
        [x - 0.69, atticBase, z + 18.65 * side],
      ],
      west,
      c.stone,
    );
    if (detail > 0) {
      beamPath(out, 'trim', edge, 0.56, 0.53, c.trim);
      finial(out, x - 0.29, z + 17.95 * side, 23.8, 2.2, 0.47, detail);
    }
    for (const u of [7.25, 10.18]) pilaster(out, x - 0.74, z + u * side, 20, 27.55, 0.96, detail);
  }
  const gable = [
    [x - 0.77, 27.92, z - 12.35],
    [x - 0.77, 31.55, z],
    [x - 0.77, 27.92, z + 12.35],
  ];
  face(out, 'stone', gable, west, c.stone);
  const back = gable.map(([, y, u]) => [x + 3.7, y, u]);
  face(out, 'stone', back, [1, 0, 0], c.stone);
  for (const i of [0, 1])
    face(out, 'stone', [gable[i], back[i], back[i + 1], gable[i + 1]], up, c.stone);
  beamPath(out, 'trim', gable, 0.5, 0.66, c.stoneLight, true);
  finial(out, x - 0.34, z, 31.38, d.pedimentCrest - 31.38, 0.74, detail);
  if (detail > 0) {
    westArch(out, x - 0.57, z, 3.35, 21.78, 25, 1.25, detail, c.shadow);
    box(out, 'trim', x - 0.69, 22.14, z, 0.47, 0.41, 2.51, c.stoneLight);
    finial(out, x - 0.75, z, 22.37, 1.95, 0.5, detail);
  }
}

function belfry(out, x, z, start, end, depth, width, detail) {
  if (detail === 0) {
    box(out, 'stone', x, (start + end) / 2, z, depth, end - start, width, c.stone);
    const spring = start + (end - start) * 0.57;
    westArch(
      out,
      x - depth / 2 - 0.015,
      z,
      width * 0.476,
      start + 0.82,
      spring,
      end - spring - 0.83,
      detail,
      c.dark,
    );
    return;
  }
  const opening = width * 0.238;
  const spring = start + (end - start) * 0.57;
  const top = end - 0.83;
  const segments = [4, 4, 10, 14][detail];
  for (let side = 0; side < 4; side++) {
    const theta = (side * Math.PI) / 2;
    const nx = Math.round(Math.cos(theta));
    const nz = Math.round(Math.sin(theta));
    const normal = [nx, 0, nz];
    const outer = nx ? depth / 2 : width / 2;
    const half = nx ? width / 2 : depth / 2;
    const at = (u, y, offset = 0) => [
      x + nx * (outer + offset) - nz * u,
      y,
      z + nz * (outer + offset) + nx * u,
    ];
    const curve = archCurve(0, opening, spring, top - spring, segments);
    const sill = start + 0.82;
    const arch = [[-opening, sill], ...curve, [opening, sill]];
    const wall = [
      [-half, start],
      [half, start],
      [half, end],
      [-half, end],
    ];
    // True cut-out arch with corner piers, spandrel and a shallow inner reveal.
    const jambs = [
      [
        [-half, sill],
        [-opening, sill],
        [-opening, end],
        [-half, end],
      ],
      [
        [opening, sill],
        [half, sill],
        [half, end],
        [opening, end],
      ],
      [wall[0], wall[1], [half, sill], [-half, sill]],
    ];
    for (const panel of jambs)
      face(
        out,
        'stone',
        panel.map(([u, y]) => at(u, y)),
        normal,
        c.stone,
      );
    planar(
      out,
      'stone',
      [...curve, [opening, end], [-opening, end]].map(([u, y]) => at(u, y)),
      normal,
      c.stone,
    );
    arch.push(arch[0]);
    for (let i = 1; i < arch.length; i++) {
      const [a, b] = [arch[i - 1], arch[i]];
      const centerY = (sill + spring) / 2;
      face(
        out,
        'stone',
        [at(...a), at(...b), at(...b, -0.72), at(...a, -0.72)],
        [nz * (a[0] + b[0]), 2 * centerY - a[1] - b[1], -nx * (a[0] + b[0])],
        c.shadow,
      );
    }
    if (detail >= 2) {
      beamPath(
        out,
        'trim',
        arch.slice(0, -1).map(([u, y]) => at(u, y, 0.1)),
        0.22,
        0.33,
        c.stoneLight,
        true,
      );
      for (const u of [-half + 0.7, half - 0.7]) {
        const p = at(u, (start + end) / 2, 0.16);
        box(out, 'trim', ...p, nx ? 0.54 : 0.53, end - start - 0.82, nz ? 0.54 : 0.53, c.trim);
      }
    }
  }
  if (detail >= 1)
    profile(
      out,
      [
        [start + 2.07, 0.86, 0.86],
        [start + 2.32, 0.93, 0.93, 'detail', c.metal],
        [start + 3.08, 0.53, 0.53, 'detail', c.metal],
        [start + 3.49, 0.41, 0.41, 'detail', c.metal],
      ],
      detail >= 2 ? 10 : 6,
      [x, z],
    );
}

function tower(out, z, detail) {
  const x = d.facadeX + 4.14;
  const base = 19.8;
  const belfryBreak = 29.01;
  const width = d.towerWidth;
  const dep = d.towersDepth;
  box(out, 'stone', x, (base + 3.4) / 2, z, dep, base - 3.4, width, c.stone);
  belfry(out, x, z, base, 28.22, dep - 0.25, width - 0.34, detail);
  trimBand(out, x, 28.25, z, dep + 0.97, width + 0.97);
  trimBand(out, x, belfryBreak, z, dep + 0.38, width + 0.3, true);
  belfry(out, x, z, belfryBreak + 0.16, d.belfryHeight, dep * 0.91, width * 0.9, detail);
  trimBand(out, x, d.belfryHeight, z, dep + 0.12, width - 0.06);
  if (detail >= 2) {
    const center = x - dep * 0.53;
    // Clock boss on the plaza face of the intermediate cornice.
    const clockSegments = detail >= 2 ? 16 : 8;
    const loop = Array.from({ length: clockSegments }, (_, i) => {
      const angle = (i * Math.PI * 2) / clockSegments;
      return [
        center - 0.22,
        belfryBreak + 0.3 + Math.sin(angle) * 0.85,
        z + Math.cos(angle) * 0.85,
      ];
    });
    planar(out, 'trim', loop, west, c.shadow);
    beamPath(out, 'trim', loop, 0.14, 0.15, c.stoneLight, true);
    for (const corner of [-1, 1]) {
      finial(out, x - dep * 0.49, z + corner * (width / 2 - 0.27), 29.05, 1.21, 0.42, detail);
      finial(out, x + dep * 0.44, z + corner * (width / 2 - 0.32), 36.01, 1.08, 0.36, detail);
    }
  }
  const sides = detail === 0 ? 8 : 16;
  const dome = [
    [35.98, 3.75, 4.26],
    [36.66, 3.82, 4.37, 'stone', c.trim],
    [37.08, 3.49, 4.01, 'trim', c.ribs],
    [38.17, 3.16, 3.62, 'stone', c.dome],
    [39.32, 2.42, 2.8, 'stone', c.dome],
    [40.34, 1.43, 1.72, 'stone', c.dome],
    [d.cupolaHeight, 0.93, 1.18, 'trim', c.ribs],
  ];
  profile(out, dome, sides, [x, z]);
  if (detail >= 2) {
    for (let section = 0; section < 8; section++) {
      const angle = (section * Math.PI) / 4;
      const rib = dome
        .slice(2)
        .map(([y, rx, rz]) => [
          x + Math.cos(angle) * (rx + 0.045),
          y,
          z + Math.sin(angle) * (rz + 0.045),
        ]);
      beamPath(out, 'trim', rib, 0.12, 0.12, c.ribs);
    }
  }
  profile(
    out,
    [
      [d.cupolaHeight, 0.97, 1.11],
      [41.31, 1.02, 1.15, 'trim', c.stoneLight],
      [42.43, 0.82, 0.92, 'detail', c.dome],
      [42.73, 1.01, 1.11, 'trim', c.trim],
      [43.24, 0.42, 0.46, 'stone', c.ribs],
      [45.15, 0.12, 0.12, 'trim', c.trim],
    ],
    detail === 0 ? 6 : 8,
    [x, z],
  );
  if (detail > 0) {
    for (let i = 0; i < 8; i++) {
      const theta = (i * Math.PI) / 4;
      box(
        out,
        'trim',
        x + Math.cos(theta) * 0.83,
        41.87,
        z + Math.sin(theta) * 0.96,
        0.21,
        1.09,
        0.21,
        c.stoneLight,
      );
    }
  }
  box(
    out,
    'detail',
    x,
    (d.overallHeight + 45.12) / 2,
    z,
    0.12,
    d.overallHeight - 45.12,
    0.12,
    c.metal,
  );
  box(out, 'detail', x, 45.69, z, 0.12, 0.11, 0.56, c.metal);
}

function draw(out, detail) {
  body(out, detail);
  facade(out, detail);
  for (const z of d.towerCentersZ) tower(out, z, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-127, 58, -86];
const lookAt = [0, 18.5, 7.5];
const module =
  'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs';

export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q2942872',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The stone Primatial Cathedral of Bogotá faces the plaza with three doors, a pediment and twin belfries surmounted by ribbed domes.',
  camera,
  lookAt,
  sunDirection: [-68, 105, -60],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone', 'plaster_lime', 'tile_ceramic'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -2.1,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'three-plaza-doors-and-pediment', position: [-110, 22, 8], lookAt: [-31, 19.5, 6] },
    { name: 'twin-belfries-and-domes', position: [-76, 39, -36], lookAt: [-29, 32, 4] },
    { name: 'nave-roofs-and-east-wings', position: [107, 67, 79], lookAt: [18, 12, 12] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.58, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.08, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry informed by the public-domain Qualla watercolor, creator-released recent photograph, local heritage records, native mapping and original terrain.',
};
