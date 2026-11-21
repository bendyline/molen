import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box as meshBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.94, metallic: 0 },
  facing: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  stonework: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.93,
    metallic: 0,
  },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.23 },
  glazing: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.17 },
};

const limestone = [0.74, 0.624, 0.445];
const roughStone = [0.65, 0.483, 0.265];
const dressStone = [0.79, 0.647, 0.425];
const warmConcrete = [0.66, 0.625, 0.541];
const cap = [0.76, 0.729, 0.65];
const castSteel = [0.275, 0.287, 0.27];
const aluminum = [0.61, 0.615, 0.56];
const glass = [0.188, 0.272, 0.284];
const terracePaving = [0.72, 0.613, 0.443];
const paintedBank = [0.128, 0.387, 0.57];
const whiteRef = 'palette:#ffffff';
const tint = (color, intensity) => color.map((value) => value * intensity);
const box = (out, slot, x0, y0, z0, x1, y1, z1, color) =>
  meshBox(out, slot, [x0, y0, z0], [x1, y1, z1], color);

// +Z faces the roundabout. The stepped x/z ranges follow PMTiles footprint 35184664900211.
const blocks = [
  [-38.1, -35.1, 2.25, 23.72, 4.43, 3.2],
  [-35.1, -18.45, -1.18, 23.72, 4.43, 3.2],
  [-18.45, -16.06, 1.77, 23.72, 4.43, 2.12],
  [-16.06, -15.13, 1.77, 29.33, 4.43, 2.12],
  [-15.13, -10.57, 7.99, 29.33, 4.43, 2.12],
  [-10.57, -1.7, 14.55, 29.33, 4.76, 1.58],
  [-1.7, 2.68, -3.02, 26.77, 5.25, 0.78],
  [2.68, 14.98, -6.78, 26.77, 5.25, 0.78],
  [14.98, 22.49, -6.78, 14.78, 5.25, 0],
  [22.49, 25.1, -6.78, 15.77, 5.12, -0.52],
  [25.1, 31.85, -2.38, 15.77, 5.12, -0.52],
];

function building(out, details) {
  for (const [x0, x1, z0, z1, wallHeight, grade] of blocks) {
    const height = wallHeight + grade;
    box(out, 'ashlar', x0, grade - 1.95, z0, x1, height, z1, limestone);
    box(
      out,
      'stonework',
      x0 - 0.018,
      grade - 1.93,
      z0 - 0.018,
      x1 + 0.018,
      grade + 0.39,
      z1 + 0.018,
      tint(limestone, 0.83),
    );
    box(out, 'roof', x0, height, z0, x1, height + 0.095, z1, warmConcrete);
    if (details < 1) continue;
    for (const z of [z0, z1 - 0.17]) {
      box(out, 'ashlar', x0, height, z, x1, height + 0.5, z + 0.17, limestone);
      box(
        out,
        'roof',
        x0 - 0.032,
        height + 0.5,
        z - 0.034,
        x1 + 0.032,
        height + 0.58,
        z + 0.204,
        cap,
      );
    }
  }
}

const gate = { minX: 14.98, maxX: 22.49, face: 24.1, spring: 2.82, top: 6.3 };
const arches = [
  { center: 16.86, halfSpan: 1.1, rise: 2.27 },
  { center: 20.58, halfSpan: 1.18, rise: 2.27 },
];

const archY = ({ center, halfSpan, rise }, x) => {
  const t = Math.abs(x - center) / halfSpan;
  return gate.spring + rise * (1 - t) * (1 + t * 0.44);
};

function quad(out, slot, points, color) {
  for (const indices of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    const p = indices.map((i) => points[i]);
    out.addTriangle(slot, whiteRef, p, normalFor(...p), [], color);
  }
}

function portal(out, details) {
  const back = gate.face - 0.49;
  function upperWall(a, ya, b, yb) {
    quad(
      out,
      'facing',
      [
        [a, ya, gate.face],
        [b, yb, gate.face],
        [b, gate.top, gate.face],
        [a, gate.top, gate.face],
      ],
      roughStone,
    );
    quad(
      out,
      'facing',
      [
        [b, yb, back],
        [a, ya, back],
        [a, gate.top, back],
        [b, gate.top, back],
      ],
      tint(roughStone, 0.91),
    );
    quad(
      out,
      'ashlar',
      [
        [b, yb, gate.face],
        [a, ya, gate.face],
        [a, ya, back],
        [b, yb, back],
      ],
      dressStone,
    );
  }
  let left = gate.minX;
  const steps = [6, 10, 18, 28, 44][details];
  for (const arch of arches) {
    const start = arch.center - arch.halfSpan;
    upperWall(left, gate.spring, start, gate.spring);
    for (let i = 0; i < steps; i++) {
      const a = start + ((2 * arch.halfSpan) / steps) * i;
      const b = start + ((2 * arch.halfSpan) / steps) * (i + 1);
      const ya = archY(arch, a);
      const yb = archY(arch, b);
      upperWall(a, ya, b, yb);
      if (details > 0)
        quad(
          out,
          'ashlar',
          [
            [a, ya, gate.face + 0.028],
            [b, yb, gate.face + 0.028],
            [b, yb + 0.16, gate.face + 0.028],
            [a, ya + 0.16, gate.face + 0.028],
          ],
          dressStone,
        );
    }
    left = arch.center + arch.halfSpan;
  }
  upperWall(left, gate.spring, gate.maxX, gate.spring);
  for (const x of [gate.minX, gate.maxX]) {
    const side = [
      [x, gate.spring, back],
      [x, gate.spring, gate.face],
      [x, gate.top, gate.face],
      [x, gate.top, back],
    ];
    quad(out, 'facing', x === gate.minX ? side : side.reverse(), roughStone);
  }
  box(
    out,
    'ashlar',
    gate.minX - 0.035,
    gate.top - 0.082,
    back - 0.035,
    gate.maxX + 0.035,
    gate.top + 0.044,
    gate.face + 0.035,
    dressStone,
  );
  for (const x of [15.1, 18.72, 22.38]) {
    const sides = details >= 2 ? 12 : 8;
    const center = [x, gate.face - 0.2];
    loft(
      out,
      'metal',
      [
        radialRing(-0.26, 0.137, 0.137, sides, center),
        radialRing(gate.spring + 0.04, 0.137, 0.137, sides, center),
      ],
      aluminum,
    );
    if (details > 1) {
      box(
        out,
        'stonework',
        x - 0.22,
        -0.21,
        gate.face - 0.42,
        x + 0.22,
        0.115,
        gate.face + 0.02,
        warmConcrete,
      );
      box(
        out,
        'metal',
        x - 0.19,
        2.69,
        gate.face - 0.382,
        x + 0.19,
        2.84,
        gate.face - 0.026,
        aluminum,
      );
    }
  }
}

function courtyard(out, details) {
  const canopy = { x0: 15.03, x1: 22.46, z0: 14.79, z1: 23.64, y: 4.99 };
  const { x0, x1, z0, z1, y } = canopy;
  for (const x of [x0 + 0.14, (x0 + x1) / 2, x1 - 0.14])
    beam(out, 'metal', [x, y, z0], [x, y + 0.28, z1], 0.2, 0.235, castSteel);
  const members = details > 1 ? 11 : 5;
  for (let i = 0; i < members; i++) {
    const f = i / (members - 1);
    const z = z0 + (z1 - z0) * f;
    beam(out, 'metal', [x0, y + f * 0.28, z], [x1, y + f * 0.28, z], 0.14, 0.21, castSteel);
    if (details < 1 || i >= members - 1 || i % 2 === 0) continue;
    const nextZ = z + (z1 - z0) / (members - 1);
    const nextY = y + (f + 1 / (members - 1)) * 0.28;
    quad(
      out,
      'glazing',
      [
        [x0, y + f * 0.28 + 0.15, z],
        [x0, nextY + 0.15, nextZ],
        [x1, nextY + 0.15, nextZ],
        [x1, y + f * 0.28 + 0.15, z],
      ],
      tint(glass, 1.53),
    );
  }
  box(out, 'roof', x0 - 0.16, -0.63, z0, x1 + 0.16, 0.19, z1 + 1.34, cap);
  box(out, 'glazing', 15.26, 0.063, 14.796, 22.23, 2.68, 14.879, glass);
  if (details > 0) {
    for (let i = 0; i < 6; i++) {
      const x = 15.26 + (6.97 * i) / 5;
      box(out, 'metal', x - 0.035, 0.064, 14.87, x + 0.035, 2.72, 14.91, aluminum);
    }
    box(out, 'metal', 15.22, 2.65, 14.868, 22.27, 2.75, 14.93, aluminum);
  }
}

function glazedPavilion(out, details) {
  const x0 = 4.25,
    x1 = 13.35,
    z0 = 15.52,
    z1 = 22.6,
    floor = 6.03,
    top = 8.94;
  box(out, 'roof', x0 - 0.19, floor, z0 - 0.19, x1 + 0.19, floor + 0.2, z1 + 0.19, cap);
  box(out, 'glazing', x0, floor + 0.2, z0, x1, top, z1, glass);
  box(out, 'roof', x0 - 0.27, top, z0 - 0.27, x1 + 0.27, top + 0.28, z1 + 0.27, cap);
  if (details === 0) return;
  const bays = details >= 2 ? 8 : 5;
  for (let i = 0; i <= bays; i++) {
    const x = x0 + ((x1 - x0) * i) / bays;
    const z = z0 + ((z1 - z0) * i) / bays;
    for (const side of [z0, z1])
      box(
        out,
        'metal',
        x - 0.045,
        floor + 0.19,
        side - 0.047,
        x + 0.045,
        top + 0.01,
        side + 0.047,
        aluminum,
      );
    for (const side of [x0, x1])
      box(
        out,
        'metal',
        side - 0.048,
        floor + 0.19,
        z - 0.045,
        side + 0.048,
        top + 0.01,
        z + 0.045,
        aluminum,
      );
  }
}

function workshopTrim(out, details) {
  if (details < 1) return;
  const bays = details > 1 ? 10 : 5;
  for (let i = 0; i < bays; i++) {
    const x = -34 + (17 * i) / (bays - 1);
    box(out, 'glazing', x - 0.52, 4.62, 23.726, x + 0.52, 7.12, 23.78, glass);
    box(out, 'ashlar', x - 0.62, 4.58, 23.751, x + 0.62, 4.74, 23.87, dressStone);
  }
  if (details < 2) return;
  for (const [x, z] of [
    [-30, 10],
    [-25.8, 15.4],
    [-11.88, 23],
    [-5.6, 18.4],
    [4.0, 4.2],
    [9.14, 7.64],
    [21.2, 0.4],
    [29.2, 2.76],
  ]) {
    const [, , , , wallHeight, grade] = blocks.find(([left, right]) => x > left && x < right);
    const height = wallHeight + grade;
    box(out, 'roof', x - 1.26, height + 0.085, z - 0.84, x + 1.26, height + 0.31, z + 0.84, cap);
    box(out, 'metal', x - 1.1, height + 0.31, z - 0.7, x + 1.1, height + 0.94, z + 0.7, aluminum);
    if (details >= 3) {
      for (let i = 0; i < 5; i++) {
        const y = height + 0.4 + 0.095 * i;
        box(out, 'metal', x - 0.91, y, z + 0.697, x + 0.91, y + 0.032, z + 0.747, castSteel);
      }
    }
  }
}

function parkFrontage(out, details) {
  // Cafe windows sit below a pale limestone header on the exhibit side.
  for (const [x0, x1, z, grade, count] of [
    [-34.45, -19.22, -1.18, 3.2, 5],
    [3.25, 14.52, -6.78, 0.78, 4],
    [15.26, 22.12, -6.78, 0, 2],
  ]) {
    const bay = (x1 - x0) / count;
    const base = grade + 0.39;
    if (details === 0) {
      box(out, 'glazing', x0, base + 0.09, z - 0.11, x1, base + 2.58, z, glass);
      continue;
    }
    for (let i = 0; i < count; i++) {
      const left = x0 + i * bay + 0.17;
      const right = left + bay - 0.34;
      box(out, 'metal', left - 0.07, base, z - 0.09, right + 0.07, base + 2.69, z, castSteel);
      box(out, 'glazing', left, base + 0.09, z - 0.11, right, base + 2.58, z - 0.088, glass);
      if (details > 1) {
        const mid = (left + right) * 0.5;
        box(
          out,
          'metal',
          mid - 0.035,
          base + 0.09,
          z - 0.134,
          mid + 0.035,
          base + 2.58,
          z,
          castSteel,
        );
      }
    }
  }
  if (details === 0) return;
  for (const x of [-32.8, -29.65, -26.5]) {
    const sides = details > 1 ? 12 : 8;
    const ring = radialRing(0, 0.225, 0.225, sides);
    const points = ring.map(([u, , v]) => [x + u, 6.88 + v, -1.221]);
    for (let i = 0; i < sides; i++) {
      const p = [[x, 6.88, -1.221], points[i], points[(i + 1) % sides]];
      out.addTriangle('metal', whiteRef, p, normalFor(...p), [], castSteel);
    }
  }
}

// The curved edge follows the landward bank of the mapped display water.
// Section grades in metres are sampled relative to the entrance datum.
const terraceSections = [
  [-29, -7, 5.16, -1.22, 5.05],
  [-25, -10.9, 4.66, -1.22, 4.49],
  [-20, -17, 4.32, -2, 3.81],
  [-15, -21.4, 4.16, -10, 3.27],
  [-8, -21.5, 3.55, -7, 2.35],
  [-3, -18.25, 2.78, -5, 1.86],
  [2, -15.5, 2.02, -6.86, 1.54],
  [9, -10.6, 0.97, -6.86, 0.89],
  [16, -9.3, 0.18, -6.86, 0.12],
];

function terraceRail(out, details, [x0, z0, y0], [x1, z1, y1], endPost) {
  beam(
    out,
    'metal',
    [x0, y0 + 1.02, z0 + 0.16],
    [x1, y1 + 1.02, z1 + 0.16],
    0.048,
    0.056,
    castSteel,
  );
  if (details === 0) return;
  const divisions = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (details > 1 ? 1.16 : 2.65));
  for (let j = 0; j < divisions + Number(endPost); j++) {
    const t = j / divisions;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const z = z0 + (z1 - z0) * t;
    beam(out, 'metal', [x, y - 0.018, z + 0.3], [x, y + 1.02, z + 0.16], 0.047, 0.048, castSteel);
  }
  if (details < 2) return;
  for (const lift of [0.24, 0.44, 0.64, 0.84]) {
    const z = 0.3 - 0.14 * lift;
    beam(out, 'metal', [x0, y0 + lift, z0 + z], [x1, y1 + lift, z1 + z], 0.018, 0.023, castSteel);
  }
}

function watersideTerrace(out, details) {
  const rings = terraceSections.map(([x, zOuter, yOuter, zInner, yInner]) => [
    [x, yOuter - 0.84, zOuter],
    [x, yOuter, zOuter],
    [x, yInner, zInner],
    [x, yInner - 0.84, zInner],
  ]);
  loft(out, 'roof', rings, terracePaving);
  for (let i = 1; i < terraceSections.length; i++) {
    const [x0, z0, y0] = terraceSections[i - 1];
    const [x1, z1, y1] = terraceSections[i];
    quad(
      out,
      'roof',
      [
        [x0, y0 - 0.52, z0 - 0.018],
        [x0, y0 - 0.085, z0 - 0.018],
        [x1, y1 - 0.085, z1 - 0.018],
        [x1, y1 - 0.52, z1 - 0.018],
      ],
      paintedBank,
    );
    // The mapped footbridge crosses the terrace edge near local X = -3.85.
    const gap = [-5.35, -2.38];
    const pointAt = (x) => {
      const t = (x - x0) / (x1 - x0);
      return [x, z0 + (z1 - z0) * t, y0 + (y1 - y0) * t];
    };
    if (x0 < gap[0])
      terraceRail(out, details, pointAt(x0), pointAt(Math.min(x1, gap[0])), x1 >= gap[0]);
    if (x1 > gap[1])
      terraceRail(
        out,
        details,
        pointAt(Math.max(x0, gap[1])),
        pointAt(x1),
        i === terraceSections.length - 1,
      );
  }
}

function build(out, details) {
  building(out, details);
  portal(out, details);
  courtyard(out, details);
  glazedPavilion(out, details);
  workshopTrim(out, details);
  parkFrontage(out, details);
  watersideTerrace(out, details);
}

export const buildEntrance = (out) => build(out, 4);
export const buildCloseup = (out) => build(out, 3);
export const buildStreet = (out) => build(out, 2);
export const buildDistrict = (out) => build(out, 1);
export const buildSkyline = (out) => build(out, 0);
