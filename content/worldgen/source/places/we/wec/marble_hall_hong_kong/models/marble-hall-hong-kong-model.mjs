import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const geometry = read('native-map/marble-hall-plan-geometry');
const { basementFloor, verandahFloor, upperVerandahFloor, entablatureTop, highestFinial } =
  geometry.relativeLevelsM;

const surface = (slot, graph, roughness = 0.92) => ({ slot, graph, roughness });
const surfaces = {
  lime: surface('wall', 'plaster_lime'),
  dressed: surface('trim', 'stone_limestone', 0.87),
  marble: surface('trim', 'stone_marble', 0.83),
  granite: surface('foundation', 'stone_granite', 0.96),
  roof: surface('roof', 'slate'),
  teak: surface('door', 'wood_plain', 0.89),
  light: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};
const wall = rgb('c3b59b');
const shadowWall = rgb('a99b86');
const lightStone = rgb('d9ceba');
const moulding = rgb('c3bba7');
const stepStone = rgb('9c9588');
const granite = rgb('7d7670');
const shadow = rgb('4f4134');
const mutedGreen = rgb('454d4a');
const slate = rgb('66666a');
const turn = Math.PI * 2;

function pilaster(out, f, x, bottom, top, level, width = 0.39) {
  if (level < 2) {
    fbox(out, 'dressed', f, x - width / 2, x + width / 2, bottom, top, -0.22, 0.14, lightStone);
    return;
  }
  const [px, , pz] = f.P(x, bottom, -0.05);
  const radius = width / 2;
  const ring = (y, r) => [y, r, r];
  const tiers = [
    ring(bottom, radius * 1.44),
    ring(bottom + 0.18, radius * 1.44),
    ring(bottom + 0.29, radius),
    ring(top - 0.32, radius * 0.83),
    ring(top - 0.16, radius * 1.36),
    ring(top, radius * 1.44),
  ];
  lathe(out, 'dressed', [px, pz], tiers, level === 2 ? 6 : 8, lightStone, {
    capTop: false,
  });
  if (level === 3) {
    fbox(
      out,
      'marble',
      f,
      x - radius * 1.5,
      x + radius * 1.5,
      top - 0.12,
      top,
      -radius * 1.72,
      radius * 1.4,
      moulding,
    );
  }
}

function archTrim(out, f, mid, spring, width, level, thickness = 0.22, material = 'dressed') {
  const r = width / 2;
  const count = level >= 3 ? 12 : level === 2 ? 8 : 5;
  const point = (angle, radius) =>
    f.P(mid + radius * Math.cos(angle), spring + radius * Math.sin(angle), 0.025);
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count;
    quad4(
      out,
      material,
      point(a, r),
      point(a, r + thickness),
      point(b, r + thickness),
      point(b, r),
      lightStone,
    );
  }
}

function rail(out, f, a, b, y, level) {
  if (level < 2) {
    quad4(
      out,
      'dressed',
      f.P(a, y + 0.1, -0.13),
      f.P(b, y + 0.1, -0.13),
      f.P(b, y + 0.77, -0.13),
      f.P(a, y + 0.77, -0.13),
      moulding,
    );
    return;
  }
  fbox(out, 'dressed', f, a, b, y + 0.075, y + 0.19, -0.14, 0.01, moulding);
  fbox(out, 'dressed', f, a, b, y + 0.66, y + 0.79, -0.18, 0.05, lightStone);
  const n = Math.ceil((b - a) / (level === 2 ? 0.58 : 0.38));
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * (i + 0.5)) / n;
    if (level === 2) {
      quad4(
        out,
        'dressed',
        f.P(x - 0.05, y + 0.17, -0.055),
        f.P(x + 0.05, y + 0.17, -0.055),
        f.P(x + 0.05, y + 0.67, -0.055),
        f.P(x - 0.05, y + 0.67, -0.055),
        lightStone,
      );
      continue;
    }
    const [bx, , bz] = f.P(x, y, -0.064);
    lathe(
      out,
      'dressed',
      [bx, bz],
      [
        [y + 0.17, 0.067, 0.067],
        [y + 0.27, 0.058, 0.058],
        [y + 0.41, 0.077, 0.077],
        [y + 0.57, 0.048, 0.048],
        [y + 0.67, 0.061, 0.061],
      ],
      4,
      lightStone,
      { capTop: false },
    );
  }
}

function gallery(out, a, b, bays, level, arched) {
  const f = wallFace(a, b);
  const length = f.length;
  fbox(out, 'granite', f, 0, length, basementFloor, verandahFloor - 0.14, -0.31, -0.07, granite);
  fbox(
    out,
    'marble',
    f,
    0,
    length,
    verandahFloor - 0.16,
    verandahFloor + 0.1,
    -3.25,
    0.12,
    lightStone,
  );
  fbox(
    out,
    'marble',
    f,
    0,
    length,
    upperVerandahFloor - 0.44,
    upperVerandahFloor + 0.09,
    -3.25,
    0.23,
    moulding,
  );
  fbox(out, 'dressed', f, 0, length, entablatureTop - 0.38, entablatureTop, -3.25, 0.2, lightStone);
  if (level > 0) {
    fbox(
      out,
      'dressed',
      f,
      0,
      length,
      entablatureTop - 0.03,
      entablatureTop + 0.49,
      -0.22,
      0.18,
      lightStone,
    );
    fbox(
      out,
      'marble',
      f,
      0,
      length,
      upperVerandahFloor - 0.17,
      upperVerandahFloor - 0.03,
      -0.01,
      0.32,
      lightStone,
    );
    fbox(
      out,
      'marble',
      f,
      0,
      length,
      entablatureTop - 0.15,
      entablatureTop + 0.09,
      -0.02,
      0.34,
      moulding,
    );
  }
  const width = length / bays;
  for (let i = 0; i < bays; i++) {
    const offset = i * width;
    for (const [base, top] of [
      [verandahFloor, upperVerandahFloor - 0.43],
      [upperVerandahFloor, entablatureTop - 0.36],
    ])
      pilaster(out, f, offset + 0.1, base, top, level);
    if (level > 0) {
      rail(out, f, offset + 0.31, offset + width - 0.13, verandahFloor, level);
      rail(out, f, offset + 0.31, offset + width - 0.13, upperVerandahFloor, level);
      if (arched) archTrim(out, f, offset + width / 2, verandahFloor + 3.37, width - 0.65, level);
      if (level >= 2)
        opening(out, f, offset + width / 2, 0.3, Math.min(1.1, width / 2), 1.38, {
          d: -0.036,
          head: 'round',
          frameSlot: 'dressed',
          glassSlot: 'light',
          glass: shadow,
          frame: lightStone,
          frameWidth: 0.13,
          frameDepth: 0.045,
          sill: false,
        });
    }
  }
  for (const [base, top] of [
    [verandahFloor, upperVerandahFloor - 0.43],
    [upperVerandahFloor, entablatureTop - 0.36],
  ])
    pilaster(out, f, length - 0.1, base, top, level, 0.47);
}

function windowWall(out, f, length, bays, level, depth = 0) {
  const step = length / bays;
  for (const floor of [verandahFloor, upperVerandahFloor]) {
    for (let j = 0; j < bays; j++) {
      const width = Math.min(step * 0.63, 2.42);
      opening(
        out,
        f,
        (j + 0.5) * step,
        floor + 0.42,
        width,
        floor === verandahFloor ? 3.39 : 3.12,
        {
          glassSlot: 'light',
          frameSlot: 'teak',
          glass: mutedGreen,
          frame: shadow,
          d: depth + 0.015,
          frameWidth: level === 3 ? 0.11 : 0,
          frameDepth: depth + 0.043,
          head: 'flat',
          sill: level === 3,
          mullions: level > 1 ? 1 : 0,
          transoms: level === 3 ? 1 : 0,
        },
      );
    }
  }
}

function primaryWalls(out, level) {
  abox(out, 'granite', [-22.98, basementFloor, -8.3], [22.98, verandahFloor, 10.05], granite);
  abox(out, 'lime', [-22.85, verandahFloor, -8.3], [22.85, entablatureTop, 2.42], shadowWall);
  abox(out, 'lime', [-16.25, verandahFloor, 2.4], [16.25, entablatureTop, 10.08], wall);
  abox(out, 'lime', [-16.7, -0.4, -16.16], [10.75, 7.1, -8.3], shadowWall);
  abox(out, 'lime', [-14.1, 7.1, -13.95], [10.75, 10.64, -8.3], wall);
  gableRoof(out, 'roof', [-17.0, -11.98], [11.05, -11.98], 8.34, 10.52, 11.83, slate, {
    overhang: 0.29,
    endSlot: 'lime',
    endColor: wall,
  });
  gableRoof(out, 'roof', [-22.88, -1.78], [22.88, -1.78], 13.75, 11.78, 13.0, slate, {
    overhang: 0.12,
    endSlot: 'lime',
    endColor: wall,
  });
  gableRoof(out, 'roof', [-16.33, 5.62], [16.33, 5.62], 9.18, 11.81, 12.98, slate, {
    overhang: 0.12,
    endSlot: 'lime',
    endColor: wall,
  });
  if (level === 0) return;
  const sides = [
    [[-16.24, 10.1], [16.24, 10.1], 8],
    [[16.26, 10.1], [16.26, 2.43], 2],
    [[16.26, 2.43], [22.87, 2.43], 2],
    [[22.87, 2.43], [22.87, -8.31], 3],
    [[22.87, -8.31], [11, -8.31], 3],
    [[-16.8, -8.31], [-22.87, -8.31], 2],
    [[-22.87, -8.31], [-22.87, 2.43], 3],
    [[-22.87, 2.43], [-16.26, 2.43], 2],
    [[-16.26, 2.43], [-16.26, 10.1], 2],
  ];
  for (const [a, b, n] of sides) {
    const f = wallFace(a, b);
    windowWall(out, f, f.length, n, level);
  }
  const back = wallFace([10.75, -16.19], [-16.7, -16.19]);
  for (let i = 0; i < 6; i++)
    opening(out, back, ((i + 0.5) * back.length) / 6, 2.2, 1.23, 1.96, {
      frameSlot: 'teak',
      glassSlot: 'light',
      glass: mutedGreen,
      frame: shadow,
      frameWidth: 0.1,
      frameDepth: 0.06,
      sill: level >= 2,
    });
}

function curvedArrival(out, side, level) {
  const c = [side * 3.25, 21.16];
  const count = [3, 6, 10, 12][level];
  const low = verandahFloor - 1.97;
  const point = (a, r, h) => [c[0] + side * r * Math.cos(a), h, c[1] - r * Math.sin(a)];
  const face = (slot, a, b, c, d, color) => {
    if (side > 0) quad4(out, slot, a, b, c, d, color);
    else quad4(out, slot, b, a, d, c, color);
  };
  for (let i = 0; i < count; i++) {
    const a = 0.04 + (i * 1.53) / count,
      b = 0.04 + ((i + 1) * 1.53) / count;
    const y = low + ((verandahFloor - low) * (i + 1)) / count;
    const prev = low + ((verandahFloor - low) * i) / count;
    const inner = 3.75,
      outer = 6.66;
    face(
      'marble',
      point(a, inner, y),
      point(a, outer, y),
      point(b, outer, y),
      point(b, inner, y),
      lightStone,
    );
    face(
      'granite',
      point(a, inner, prev),
      point(a, outer, prev),
      point(a, outer, y),
      point(a, inner, y),
      stepStone,
    );
    face(
      'granite',
      point(a, outer, -0.24),
      point(b, outer, -0.24),
      point(b, outer, y),
      point(a, outer, y),
      granite,
    );
    if (level > 0) {
      const A = point(a, outer, y),
        B = point(b, outer, y);
      const railFace = wallFace([A[0], A[2]], [B[0], B[2]]);
      if (railFace.length > 0.29) rail(out, railFace, 0.02, railFace.length - 0.02, y, level);
      if (i === 0 || i === count - 1) {
        const [px, , pz] = point(i === 0 ? a : b, outer, y);
        abox(
          out,
          'marble',
          [px - 0.27, y, pz - 0.27],
          [px + 0.27, y + 0.89, pz + 0.27],
          lightStone,
        );
      }
    }
  }
}

function rotunda(out, x, z, radius, tall, level) {
  const axes = [x, z];
  const n = level === 0 ? 6 : 10;
  const ring = (y, r) => [y, r, r];
  for (const floor of [verandahFloor, upperVerandahFloor, entablatureTop]) {
    lathe(
      out,
      'marble',
      axes,
      [ring(floor - 0.18, radius), ring(floor + 0.02, radius + 0.08)],
      n,
      lightStone,
    );
  }
  const corners = Array.from({ length: n }, (_, i) => {
    const a = (turn * i) / n;
    return [x + radius * Math.cos(a), z + radius * Math.sin(a)];
  });
  if (level > 0) {
    lathe(
      out,
      'granite',
      axes,
      [ring(basementFloor, radius - 0.12), ring(verandahFloor - 0.15, radius - 0.12)],
      n,
      granite,
      { capTop: false },
    );
    for (let i = 0; i < n; i++) {
      // Hide the inner half of each round gallery within the adjoining wing.
      if (x * (corners[i][0] - x) < -0.2) continue;
      const f = wallFace(corners[i], corners[(i + n - 1) % n]);
      pilaster(out, f, 0.04, verandahFloor, upperVerandahFloor - 0.18, level, 0.43);
      pilaster(out, f, 0.04, upperVerandahFloor, entablatureTop - 0.18, level, 0.42);
      rail(out, f, 0.26, f.length - 0.16, verandahFloor, level);
      rail(out, f, 0.26, f.length - 0.16, upperVerandahFloor, level);
    }
  } else {
    lathe(
      out,
      'lime',
      axes,
      [ring(verandahFloor, radius - 0.35), ring(entablatureTop, radius - 0.35)],
      n,
      shadowWall,
      { capTop: false },
    );
  }
  if (tall) {
    const r = radius * 0.8;
    const phase = Math.PI / 8;
    const lo = entablatureTop + 0.19,
      crown = 16.0;
    lathe(out, 'lime', axes, [ring(lo, r * 0.93), ring(crown, r * 0.93)], 8, shadowWall);
    for (let i = 0; i < 8; i++) {
      const a = (i * turn) / 8;
      const points = [a - phase, a + phase].map((phi) => [
        x + r * Math.sin(phi),
        z + r * Math.cos(phi),
      ]);
      const f = wallFace(points[0], points[1]);
      opening(out, f, f.length / 2, lo + 0.45, f.length * 0.61, crown - lo - 0.62, {
        head: 'round',
        glassSlot: 'light',
        glass: shadow,
        frameSlot: 'dressed',
        frame: lightStone,
        d: -0.064,
        frameWidth: level >= 2 ? 0.14 : 0,
        frameDepth: 0.066,
        sill: false,
      });
      if (level > 0) pilaster(out, f, 0.045, lo, crown, level, 0.32);
    }
    lathe(
      out,
      'marble',
      axes,
      [ring(crown - 0.08, r + 0.02), ring(crown + 0.1, r + 0.17), ring(crown + 0.31, r + 0.12)],
      n,
      lightStone,
    );
    lathe(
      out,
      'roof',
      axes,
      [
        ring(crown + 0.23, r + 0.11),
        ring(crown + 0.53, r * 0.9),
        ring(crown + 0.83, r * 0.63),
        ring(crown + 1.11, 0.13),
      ],
      n,
      slate,
    );
    lathe(
      out,
      'dressed',
      axes,
      [ring(crown + 1.07, 0.24), ring(crown + 1.25, 0.18), ring(highestFinial, 0.025)],
      6,
      lightStone,
    );
  } else {
    lathe(
      out,
      'roof',
      axes,
      [ring(entablatureTop, radius), ring(entablatureTop + 0.81, 0.18)],
      n,
      slate,
    );
    lathe(
      out,
      'marble',
      axes,
      [
        ring(entablatureTop + 0.74, 0.29),
        ring(entablatureTop + 1.1, 0.11),
        ring(entablatureTop + 1.17, 0.04),
      ],
      6,
      lightStone,
    );
  }
}

function decorativeCrest(out, f, mid, base, width, rise, level) {
  const half = width / 2;
  const cuts = level > 1 ? 10 : 5;
  const p = (x, y, d) => f.P(mid + x, base + y, d);
  for (let i = 0; i < cuts; i++) {
    const a = -half + (2 * half * i) / cuts,
      b = -half + (2 * half * (i + 1)) / cuts;
    const h = (x) => 0.17 + rise * Math.sqrt(Math.max(0, 1 - (x / half) ** 2));
    quad4(
      out,
      'dressed',
      p(a, 0, 0.05),
      p(b, 0, 0.05),
      p(b, h(b), 0.05),
      p(a, h(a), 0.05),
      lightStone,
    );
    quad4(
      out,
      'marble',
      p(b, h(b), 0.05),
      p(a, h(a), 0.05),
      p(a, h(a), -0.24),
      p(b, h(b), -0.24),
      moulding,
    );
  }
  if (level >= 2) {
    const [x, , z] = p(0, 0, 0.07);
    lathe(
      out,
      'marble',
      [x, z],
      [
        [base + rise + 0.13, 0.16, 0.16],
        [base + rise + 0.42, 0.12, 0.12],
        [base + rise + 0.66, 0.026, 0.026],
      ],
      6,
      lightStone,
    );
  }
}

function mainPorch(out, level) {
  const f = facade([0, 17.43], [1, 0]);
  fbox(
    out,
    'marble',
    f,
    -3.33,
    3.33,
    verandahFloor - 0.28,
    verandahFloor + 0.08,
    -4.55,
    0.16,
    lightStone,
  );
  fbox(
    out,
    'marble',
    f,
    -3.52,
    3.52,
    upperVerandahFloor - 0.34,
    upperVerandahFloor + 0.18,
    -4.48,
    0.3,
    lightStone,
  );
  fbox(
    out,
    'dressed',
    f,
    -3.49,
    3.49,
    entablatureTop - 0.54,
    entablatureTop,
    -4.51,
    0.28,
    moulding,
  );
  for (const x of [-2.67, 2.67]) {
    pilaster(out, f, x, verandahFloor, upperVerandahFloor - 0.4, level, 0.78);
    pilaster(out, f, x, upperVerandahFloor, entablatureTop - 0.55, level, 0.61);
    if (level >= 2) {
      pilaster(out, f, x * 1.15, verandahFloor, upperVerandahFloor - 0.42, level, 0.37);
      pilaster(out, f, x * 1.15, upperVerandahFloor, entablatureTop - 0.55, level, 0.34);
    }
  }
  archTrim(out, f, 0, verandahFloor + 2.16, 4.55, level, 0.42, 'marble');
  if (level > 0) rail(out, f, -2.42, 2.42, upperVerandahFloor, level);
  decorativeCrest(out, f, 0, entablatureTop - 0.06, 5.65, 1.02, level);
  for (const side of [-1, 1]) curvedArrival(out, side, level);
}

function build(out, level) {
  primaryWalls(out, level);
  if (level === 0) {
    extrude(
      out,
      'granite',
      geometry.architecturalOutlineModel,
      basementFloor,
      verandahFloor,
      granite,
      { top: false },
    );
    for (const side of [-1, 1]) {
      abox(
        out,
        'lime',
        [side * 21.15 - 4.85, verandahFloor, -8.98],
        [side * 21.15 + 4.85, entablatureTop, 3.0],
        shadowWall,
      );
      abox(
        out,
        'marble',
        [side * 10.85 - 8.38, upperVerandahFloor - 0.27, 10.02],
        [side * 10.85 + 8.38, upperVerandahFloor, 13.2],
        lightStone,
      );
    }
  }
  const runs =
    level === 0
      ? [
          [[-19.2, 13.12], [-3.45, 13.12], 3, true],
          [[3.45, 13.12], [19.2, 13.12], 3, true],
        ]
      : [
          [[-19.2, 13.12], [-3.45, 13.12], 4, true],
          [[3.45, 13.12], [19.2, 13.12], 4, true],
          [[19.2, 13.12], [19.2, 5.07], 2, true],
          [[19.2, 5.07], [24, 5.07], 1, true],
          [[26.01, 2.0], [26.01, -9.07], 3, false],
          [[26.01, -9.07], [10.88, -9.07], 4, false],
          [[-17.0, -9.07], [-26.01, -9.07], 2, false],
          [[-26.01, -9.07], [-26.01, 2.0], 3, false],
          [[-24, 5.07], [-19.2, 5.07], 1, true],
          [[-19.2, 5.07], [-19.2, 13.12], 2, true],
        ];
  for (const [a, b, n, arch] of runs) gallery(out, a, b, n, level, arch);
  mainPorch(out, level);
  rotunda(out, 23.38, 3.38, 3.21, true, level);
  rotunda(out, -23.38, 3.38, 3.21, false, level);
  if (level > 0)
    for (const side of [-1, 1]) {
      const corner = facade([side * 17.2, 13.04], [1, 0]);
      decorativeCrest(out, corner, 0, entablatureTop, 3.95, 1.68, level);
      const f = facade([side * 19.4, 12.85], [0, -side]);
      decorativeCrest(out, f, -side * 1.79, entablatureTop, 3.57, 1.6, level);
      for (const z of [-8.4, 2.36]) {
        const x = side * 24.9;
        lathe(
          out,
          'dressed',
          [x, z],
          [
            [entablatureTop - 0.01, 0.27, 0.27],
            [entablatureTop + 0.26, 0.24, 0.24],
            [entablatureTop + 0.86, 0.04, 0.04],
          ],
          6,
          lightStone,
        );
      }
    }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'marble-hall-hong-kong-model.mjs';
const camera = [42, 24, 64],
  lookAt = [0, 7.3, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-residence',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: plan.representedDate,
    validFrom: '1906-01-01',
    validUntil: '1946-05-01',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Sir Paul Chater’s hilltop Marble Hall at 1 Conduit Road, with two levels of verandahs, the split curved entrance stair, stone basement, and the western cupola.',
  camera,
  lookAt,
  sunDirection: [-20, 63, 56],
  mediumFiContext: {
    scale: 0.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: geometry.presentSiteControl.footprint,
    minimumCoverage: 0.93,
    basis: 'Suppress the mapped successor flats while the earlier residence is visible.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'harbour-facade-and-cupola', position: camera, lookAt },
    { name: 'curved-arrival-stair-and-verandahs', position: [-11, 8.6, 38], lookAt: [0, 5, 10] },
    { name: 'gallery-layout-from-above', position: [-37, 46, 48], lookAt: [0, 3, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'marble-hall-hong-kong-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.12,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction from public-domain 1906 and 1908 publications, OpenStreetMap positional control and an open Hong Kong Lands Department terrain grid.',
};
