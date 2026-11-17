/** The prison yard and standing Coote Road entrance in Napier, New Zealand. */
import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const terrain = read('terrain-grid');
const { outline, centerlines } = map.geometry;
const [stoneLine, boundaryLine, steps] = centerlines;
const gate = steps[0];
const up = [0, 1, 0];
const palette = 'palette:#ffffff';
const surfaces = {
  sandstone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
  boards: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.88, metallic: 0 },
  battens: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.73, metallic: 0.14 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  detail: { slot: 'trim', localRef: 'palette:#e9e4dc', roughness: 0.79, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    block: '8d8478',
    darkStone: '6f6c64',
    coping: '686966',
    stoneEdge: 'a59c90',
    stoneLight: '958d81',
    stoneMuted: '827b70',
    stoneWarm: '8d8273',
    chalk: 'e0dcd1',
    chalkDark: 'c7c1b4',
    step: '7d7971',
    foot: '77766a',
    plank: '785542',
    lightPlank: '967655',
    darkPlank: '543d31',
    seam: '443631',
    cream: 'cfc6b1',
    batten: 'b9ad98',
    house: '874f3f',
    roof: '676c6a',
    roofRidge: '82837b',
    redRoof: '786058',
    iron: '4d4941',
    glass: '545951',
    mortar: '797870',
    plaque: 'd7d0c3',
  }).map(([key, hex]) => [key, rgb(hex)]),
);

function grade([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const h = (k) =>
    terrain.heightsMeters[k][i] * (1 - u + i) + terrain.heightsMeters[k][i + 1] * (u - i);
  return h(j) * (1 - v + j) + h(j + 1) * (v - j) - terrain.modelDatumElevationMeters;
}

const point = ([x, z], y) => [x, y, z];
const lerp = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);
const clamp = (t) => Math.min(1, Math.max(0, t));

function face(out, slot, points, direction, shade) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, axis) => sum + value * direction[axis], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, shade);
  else
    out.addTriangle(
      slot,
      palette,
      points,
      normal,
      points.map(([x, , z]) => [x, z]),
      shade,
    );
}

function edge(a, b, invert = false) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / width;
  const dz = (b[1] - a[1]) / width;
  const nx = invert ? -dz : dz;
  const nz = invert ? dx : -dx;
  return {
    width,
    n: [nx, 0, nz],
    map(u, depth = 0) {
      return [a[0] + dx * u + nx * depth, a[1] + dz * u + nz * depth];
    },
    at(u, y, depth = 0) {
      return point(this.map(u, depth), y);
    },
  };
}

function panel(out, f, slot, u, v, y0, y1, y2, y3, depth, shade, reverse = false) {
  face(
    out,
    slot,
    [f.at(u, y0, depth), f.at(v, y1, depth), f.at(v, y2, depth), f.at(u, y3, depth)],
    reverse ? f.n.map((n) => -n) : f.n,
    shade,
  );
}

function wall(out, f, u, v, bottom, top, half, slot, shade, ends = false) {
  const b0 = bottom(u),
    b1 = bottom(v),
    t0 = top(u),
    t1 = top(v);
  panel(out, f, slot, u, v, b0, b1, t1, t0, half, shade);
  panel(out, f, slot, u, v, b0, b1, t1, t0, -half, shade, true);
  face(
    out,
    slot,
    [f.at(u, t0, -half), f.at(v, t1, -half), f.at(v, t1, half), f.at(u, t0, half)],
    up,
    shade,
  );
  if (ends) {
    quad(
      out,
      slot,
      [f.at(u, b0, -half), f.at(u, b0, half), f.at(u, t0, half), f.at(u, t0, -half)],
      normalFor(f.at(u, b0, -half), f.at(u, b0, half), f.at(u, t0, half)),
      shade,
    );
    quad(
      out,
      slot,
      [f.at(v, b1, half), f.at(v, b1, -half), f.at(v, t1, -half), f.at(v, t1, half)],
      normalFor(f.at(v, b1, half), f.at(v, b1, -half), f.at(v, t1, -half)),
      shade,
    );
  }
}

function relief(out, f, u, v, base, top, lod) {
  if (lod < 2) return;
  const n = Math.ceil((v - u) / 0.86);
  const rows = 13;
  const shades = [color.block, color.stoneLight, color.stoneMuted, color.stoneWarm];
  for (let row = 0; row < rows; row++) {
    const stagger = row % 2 ? 0.48 : 0;
    for (let col = stagger ? -1 : 0; col < n; col++) {
      const start = Math.max(u, u + ((v - u) * (col + stagger + 0.025)) / n);
      const end = Math.min(v, u + ((v - u) * (col + stagger + 0.978)) / n);
      if (end - start < 0.034) continue;
      const y = (p, k) => base(p) + (top(p) - base(p)) * k;
      const low = (row + 0.036) / rows;
      const high = (row + 0.966) / rows;
      const shade = shades[Math.abs(col * 53 + row * 13 + Math.floor(start / 2)) % shades.length];
      panel(
        out,
        f,
        'sandstone',
        start,
        end,
        y(start, low),
        y(end, low),
        y(end, high),
        y(start, high),
        lod >= 3 ? 0.264 + ((col + row + 3) % 3) * 0.008 : 0.259,
        shade,
      );
    }
  }
}

function buttress(out, f, u, ground, height, lod) {
  const width = lod ? 0.46 : 0.56;
  const toe = Math.min(ground, grade(f.map(u - width, 1.06)), grade(f.map(u + width, 1.06))) - 0.24;
  const head = ground + height * 0.68;
  const u0 = u - width,
    u1 = u + width;
  const a = f.at(u0, toe, 1.06),
    b = f.at(u1, toe, 1.06);
  const c = f.at(u0, head, 0.59),
    d = f.at(u1, head, 0.59);
  face(out, 'sandstone', [a, b, d, c], f.n, color.block);
  for (const [t, outer, upper] of [
    [u0, a, c],
    [u1, b, d],
  ]) {
    const corners = [f.at(t, toe, 0.23), outer, upper, f.at(t, head, 0.23)];
    if (t === u0) corners.reverse();
    quad(out, 'sandstone', corners, normalFor(...corners), color.darkStone);
  }
  face(
    out,
    'detail',
    [c, d, f.at(u1, head + 0.15, 0.23), f.at(u0, head + 0.15, 0.23)],
    up,
    color.coping,
  );
}

const main = edge(stoneLine[5], stoneLine[7], true);
const gateU = Math.hypot(gate[0] - stoneLine[5][0], gate[1] - stoneLine[5][1]);
const gateFloor = 1.54;
const thresholdOffset = gateFloor - 1.31;
const archHalf = 1.37;
const archCrown = gateFloor + 2.98;
const wallHeight = 5.5;
const springY = archCrown - 0.35;
const archTop = (du, half = archHalf) => springY + 0.35 * (1 - (du / half) ** 2);
const streetProfile = (u) => {
  const x = (u - gateU) / (u < gateU ? gateU : main.width - gateU);
  return gateFloor - 0.21 + x * (u < gateU ? 6.45 : 2.02);
};
const wallTop = (u) => streetProfile(u) + wallHeight;

const plaqueGlyphs = {
  H: ['101', '101', '111', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
  P: ['110', '101', '110', '100', '100'],
  R: ['110', '101', '110', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  S: ['111', '100', '111', '001', '111'],
  O: ['111', '101', '101', '101', '111'],
  N: ['101', '111', '111', '111', '101'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  6: ['111', '100', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'],
};

function plaqueLettering(out) {
  for (const [label, top, unit] of [
    ['H.M.', 5.22, 0.027],
    ['PRISON', 5.035, 0.023],
    ['1906', 4.88, 0.024],
  ]) {
    const start = gateU - ((label.length * 4 - 1) * unit) / 2;
    for (const [i, letter] of Array.from(label).entries()) {
      for (const [r, row] of plaqueGlyphs[letter].entries()) {
        for (const [c, value] of Array.from(row).entries()) {
          if (value === '0') continue;
          const x = start + (i * 4 + c) * unit;
          const y = top + thresholdOffset - (r + 1) * unit;
          panel(out, main, 'detail', x, x + unit, y, y, y + unit, y + unit, 0.326, color.iron);
        }
      }
    }
  }
}

function entrance(out, lod) {
  const left = gateU - archHalf,
    right = gateU + archHalf;
  const edges = [
    [0, left],
    [right, main.width],
  ];
  for (const [a, b] of edges) {
    const count = lod === 0 ? 1 : Math.ceil((b - a) / 5.7);
    for (let i = 0; i < count; i++) {
      const u = a + ((b - a) * i) / count;
      const v = a + ((b - a) * (i + 1)) / count;
      wall(
        out,
        main,
        u,
        v,
        (p) => streetProfile(p) - 0.66,
        wallTop,
        0.25,
        'sandstone',
        color.block,
      );
      wall(
        out,
        main,
        u,
        v,
        (p) => wallTop(p) - 0.085,
        (p) => wallTop(p) + 0.035,
        0.299,
        'detail',
        color.coping,
      );
      relief(out, main, u, v, streetProfile, wallTop, lod);
    }
  }
  const segments = lod === 0 ? 4 : lod === 1 ? 8 : 12;
  for (let j = 0; j < segments; j++) {
    const a = -archHalf + (2 * archHalf * j) / segments;
    const b = -archHalf + (2 * archHalf * (j + 1)) / segments;
    const u = gateU + a,
      v = gateU + b;
    const low = (p) => archTop(p - gateU);
    wall(out, main, u, v, low, wallTop, 0.25, 'sandstone', color.block);
    wall(
      out,
      main,
      u,
      v,
      (p) => wallTop(p) - 0.085,
      (p) => wallTop(p) + 0.035,
      0.299,
      'detail',
      color.coping,
    );
    panel(
      out,
      main,
      'detail',
      u,
      v,
      gateFloor,
      gateFloor,
      archTop(b) - 0.018,
      archTop(a) - 0.018,
      0.055,
      j < segments / 2 ? color.plank : color.darkPlank,
    );
    face(
      out,
      'sandstone',
      [
        main.at(u, low(u), -0.25),
        main.at(v, low(v), -0.25),
        main.at(v, low(v), 0.25),
        main.at(u, low(u), 0.25),
      ],
      [0, -1, 0],
      color.darkStone,
    );
  }
  const voussoirs = lod === 0 ? 4 : 9;
  for (let i = 0; i < voussoirs; i++) {
    const a = -1 + (2 * i) / voussoirs;
    const b = -1 + (2 * (i + 0.97)) / voussoirs;
    const innerA = a * archHalf,
      innerB = b * archHalf;
    const outerA = a * (archHalf + 0.31),
      outerB = b * (archHalf + 0.31);
    face(
      out,
      'detail',
      [
        main.at(gateU + innerA, archTop(innerA), 0.304),
        main.at(gateU + innerB, archTop(innerB), 0.304),
        main.at(gateU + outerB, archTop(innerB) + 0.29, 0.306),
        main.at(gateU + outerA, archTop(innerA) + 0.29, 0.306),
      ],
      main.n,
      i % 3 ? color.chalk : color.chalkDark,
    );
  }
  const courses = lod === 0 ? 3 : 6;
  for (let i = 0; i < courses; i++) {
    const h = (springY - gateFloor) / courses,
      w = i % 2 ? 0.36 : 0.51;
    for (const [u, v] of [
      [left - w, left],
      [right, right + w],
    ]) {
      panel(
        out,
        main,
        'detail',
        u,
        v,
        gateFloor + h * i,
        gateFloor + h * i,
        gateFloor + h * (i + 1) - 0.017,
        gateFloor + h * (i + 1) - 0.017,
        0.309,
        color.chalk,
      );
    }
  }
  const plaqueWidth = 0.38;
  panel(
    out,
    main,
    'detail',
    gateU - plaqueWidth,
    gateU + plaqueWidth,
    4.69 + thresholdOffset,
    4.69 + thresholdOffset,
    5.28 + thresholdOffset,
    5.28 + thresholdOffset,
    0.31,
    color.plaque,
  );
  if (lod >= 2) {
    for (const d of [-1.18, -0.045, 0.045, 1.18]) {
      panel(
        out,
        main,
        'detail',
        gateU + d - 0.032,
        gateU + d + 0.032,
        gateFloor + 0.025,
        gateFloor + 0.025,
        archTop(d) - 0.048,
        archTop(d) - 0.048,
        0.088,
        color.seam,
      );
    }
    for (let j = 0; j < 6; j++) {
      const top = gateFloor + 0.31 + j * 0.405;
      for (const [a, b] of [
        [left + 0.14, gateU - 0.07],
        [gateU + 0.07, right - 0.14],
      ]) {
        panel(
          out,
          main,
          'detail',
          a,
          b,
          top - 0.044,
          top - 0.044,
          top,
          top,
          0.099,
          j % 2 ? color.lightPlank : color.darkPlank,
        );
      }
    }
    for (const side of [-1, 1]) {
      beam(
        out,
        'detail',
        main.at(gateU - 0.11, 4.48 + thresholdOffset + side * 0.105, 0.337),
        main.at(gateU + 0.11, 4.48 + thresholdOffset - side * 0.105, 0.337),
        0.036,
        0.027,
        color.iron,
      );
      if (lod < 3) continue;
      for (const y of [gateFloor + 0.37, gateFloor + 1.37, gateFloor + 2.25])
        panel(
          out,
          main,
          'detail',
          gateU + side * 0.96 - 0.13,
          gateU + side * 0.96 + 0.13,
          y,
          y,
          y + 0.075,
          y + 0.075,
          0.115,
          color.iron,
        );
    }
  }
  if (lod >= 3) plaqueLettering(out);
  for (const u of [2.2, 8.2, 14.2, 20.2, 26.2, 32.15, 36.95, 44.3, 48.85])
    buttress(out, main, u, streetProfile(u), wallHeight, lod);
}

function approach(out, lod) {
  const z = gate[1];
  const x = gate[0];
  const n = lod ? 7 : 3;
  const from = 18.03,
    to = z + 0.29;
  for (let i = 0; i < n; i++) {
    const low = from - ((from - to) * i) / n;
    const high = from - ((from - to) * (i + 1)) / n;
    const height = 0.53 + ((gateFloor - 0.53) * i) / (n - 1);
    box(out, 'concrete', [x - 2.17, -0.52, high], [x + 2.17, height, low], color.step);
    if (lod >= 3)
      box(
        out,
        'detail',
        [x - 1.96, height - 0.034, low - 0.026],
        [x + 1.96, height + 0.008, low + 0.039],
        color.stoneEdge,
      );
  }
  for (const side of [-1, 1]) {
    const f = edge([x + side * 2.15, from + 0.07], [x + side * 2.15, to - 0.1]);
    const top = (u) => 0.52 + (gateFloor * u) / f.width;
    wall(
      out,
      f,
      0,
      f.width,
      (u) => (u * 0.35) / f.width - 0.25,
      top,
      0.19,
      'concrete',
      color.coping,
      true,
    );
    wall(
      out,
      f,
      0,
      f.width,
      (u) => top(u) - 0.055,
      (u) => top(u) + 0.07,
      0.225,
      'detail',
      color.step,
      true,
    );
  }
}

function enclosure(out, lod) {
  for (const [line, slot, sideHeight, width, shade] of [
    [stoneLine.slice(0, 6), 'sandstone', 3.9, 0.25, color.darkStone],
    [boundaryLine, 'concrete', 3.05, 0.16, color.mortar],
  ]) {
    for (let i = 1; i < line.length; i++) {
      const f = edge(line[i - 1], line[i]);
      const count = Math.ceil(f.width / (lod ? 6 : 18));
      const ground = (u) => grade(f.map(u));
      for (let j = 0; j < count; j++) {
        const u = (j * f.width) / count,
          v = ((j + 1) * f.width) / count;
        wall(
          out,
          f,
          u,
          v,
          (p) => ground(p) - 0.56,
          (p) => ground(p) + sideHeight,
          width,
          slot,
          shade,
        );
      }
    }
  }
}

const eave = ([x, z]) => 4.66 + 0.205 * (x + 11) + 0.026 * Math.max(0, 4 - z);
const profile = ([x, z]) => {
  const north = 1.9 * clamp(1 - Math.abs(z - 7.4) / 4.4) * clamp((-7.5 - x) / 3.3);
  const east = 2.1 * clamp(1 - Math.abs(x + 29.05) / 7.4) * clamp((4 - z) / 3.5);
  const south = 1.85 * clamp(1 - Math.abs(z + 18.7) / 6.4) * clamp((x + 27.5) / 5.3);
  const services = 1.15 * clamp(1 - Math.abs(z - 2.45) / 5.4) * clamp((x + 4) / 6);
  const house = 1.35 * clamp(1 - Math.abs(x + 25.1) / 3.75) * clamp((-z - 18) / 4);
  return eave([x, z]) + Math.max(north, east, south, services, house);
};

const cap = new MeshBufferBuilder();
if (
  !cap.addCap(
    'roof',
    palette,
    outline,
    [],
    () => 0,
    up,
    (p) => p,
    color.roof,
  )
)
  throw new Error('Could not triangulate the mapped Napier Prison footprint');
const capMesh = cap.finalize();
const roofTriangles = Array.from({ length: capMesh.indices.length / 3 }, (_, i) =>
  Array.from(capMesh.indices.slice(i * 3, i * 3 + 3), (j) => [
    capMesh.positions[j * 3],
    capMesh.positions[j * 3 + 2],
  ]),
);
const eaveRuns = [7.4, -18.7, 2.45];
const ridgeRuns = [-29.05, -25.1];

function splitAt(ring, axis, value, sign) {
  const clipped = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const aSide = sign * (a[axis] - value),
      bSide = sign * (b[axis] - value);
    if (aSide >= 0) clipped.push(a);
    if (aSide * bSide < 0) clipped.push(lerp(a, b, (value - a[axis]) / (b[axis] - a[axis])));
  }
  return clipped;
}

function roof(out) {
  let tiles = roofTriangles;
  for (const [axis, runs] of [
    [0, ridgeRuns],
    [1, eaveRuns],
  ]) {
    for (const value of runs) {
      tiles = tiles
        .flatMap((ring) => [splitAt(ring, axis, value, 1), splitAt(ring, axis, value, -1)])
        .filter((ring) => ring.length >= 3);
    }
  }
  for (const tile of tiles) {
    for (let i = 1; i < tile.length - 1; i++) {
      const triangle = [tile[0], tile[i], tile[i + 1]];
      const area = Math.abs(
        (triangle[1][0] - triangle[0][0]) * (triangle[2][1] - triangle[0][1]) -
          (triangle[1][1] - triangle[0][1]) * (triangle[2][0] - triangle[0][0]),
      );
      if (area < 0.00003) continue;
      const house = triangle.every(([x, z]) => x < -20.8 && z < -23);
      face(
        out,
        'roof',
        triangle.map((p) => point(p, profile(p))),
        up,
        house ? color.redRoof : color.roof,
      );
    }
  }
}

function wings(out, lod) {
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    const f = edge(a, b);
    const center = lerp(a, b, 0.5);
    const yard = a[1] < 1.8 && a[1] > -16 && b[1] < 1.8 && b[1] > -16 && center[0] > -23.5;
    const house = center[0] < -20.8 && center[1] < -24.0;
    const slot = yard ? 'battens' : 'boards';
    const shade = house ? color.house : yard ? color.batten : color.cream;
    const ground = (u) => Math.min(grade(f.map(u)) - 0.22, eave(f.map(u)) - 2);
    const plinth = (u) => ground(u) + 0.54;
    const count = Math.ceil(f.width / (lod ? 1.65 : 5.8));
    for (let j = 0; j < count; j++) {
      const u = (j * f.width) / count,
        v = ((j + 1) * f.width) / count;
      const roofA = profile(f.map(u)),
        roofB = profile(f.map(v));
      panel(
        out,
        f,
        'concrete',
        u,
        v,
        ground(u),
        ground(v),
        plinth(v),
        plinth(u),
        0.015,
        color.foot,
      );
      panel(out, f, slot, u, v, plinth(u), plinth(v), roofB, roofA, 0, shade);
      if (lod >= 2)
        panel(
          out,
          f,
          'detail',
          u,
          v,
          roofA - 0.14,
          roofB - 0.14,
          roofB,
          roofA,
          0.017,
          color.roofRidge,
        );
    }
    if (!lod || f.width < 2.5) continue;
    const openings = Math.max(1, Math.floor(f.width / (yard ? 2.22 : 3.8)));
    for (let j = 0; j < openings; j++) {
      const u = (f.width * (j + 1)) / (openings + 1);
      const y = Math.max(ground(u) + 1.18, eave(f.map(u)) - 1.55);
      const w = house ? 0.39 : yard ? 0.32 : 0.29;
      panel(
        out,
        f,
        'detail',
        u - w - 0.08,
        u + w + 0.08,
        y - 0.075,
        y - 0.075,
        y + 0.72,
        y + 0.72,
        0.024,
        color.chalkDark,
      );
      panel(out, f, 'detail', u - w, u + w, y, y, y + 0.65, y + 0.65, 0.038, color.glass);
      if (lod < 2) continue;
      for (const step of [-0.17, 0, 0.17]) {
        panel(
          out,
          f,
          'detail',
          u + step - 0.018,
          u + step + 0.018,
          y,
          y,
          y + 0.65,
          y + 0.65,
          0.054,
          color.iron,
        );
      }
    }
  }
}

function build(out, lod) {
  enclosure(out, lod);
  entrance(out, lod);
  approach(out, lod);
  wings(out, lod);
  roof(out);
}

export const napierSkyline = (out) => build(out, 0);
export const napierDistrict = (out) => build(out, 1);
export const napierStreet = (out) => build(out, 2);
export const napierCloseup = (out) => build(out, 3);

const recipe = 'napier-prison-model.mjs';
const camera = [47, 49, 73];
const lookAt = [-7, 2.1, -8];
export const napierModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe,
  surfaces,
  build: napierCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline,
    minimumCoverage: 0.995,
    basis: 'Named roofed footprint behind the retained perimeter walls.',
  },
  brief:
    'The former Napier Prison, its long rusticated sandstone wall, white-quoined stepped entrance, timber wings and enclosed yard.',
  camera,
  lookAt,
  sunDirection: [48, 87, 101],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 1.67,
    cameraYaw: 0.46,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'coote-road-gate-and-approach', position: [9.9, 3.7, 28.5], lookAt: [4.9, 3.1, 14.1] },
    { name: 'sandstone-wall-and-north-wing', position: [-18, 12.4, 49], lookAt: [-8, 1, 12.5] },
    { name: 'yard-and-timber-service-wings', position: [41, 30, -49], lookAt: [-13, 2.9, -10] },
    { name: 'east-wall-and-southern-wing', position: [-62, 19, -35], lookAt: [-24, 1.5, -14] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'napier-prison-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'napierSkyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: {
      district: { export: 'napierDistrict', errorMeters: 0.43, surfaces },
      street: { export: 'napierStreet', errorMeters: 0.17, surfaces },
      closeup: { export: 'napierCloseup', errorMeters: 0.067, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on an exact verified public-domain Qualla photograph, published written Heritage New Zealand evidence, OpenStreetMap ODbL geometry and attributed Terrarium elevation.',
};
