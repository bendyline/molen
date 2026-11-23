import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  at,
  cap,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { features } = read('native-map/ben-hill-native-stadium-parts');
const grade = floorSampler(read('terrain-grid'));
const colors = Object.fromEntries(
  Object.entries({
    slab: 'b8b5ad',
    pale: 'ceccc1',
    aisle: 'a6a9ab',
    plinth: 'aba99a',
    warmBrick: '934f40',
    weatheredBrick: '895245',
    dark: '565e61',
    orange: 'cb4e21',
    turfA: '678751',
    turfB: '6c8d55',
    turfVerge: '617a50',
    ink: 'dce0cf',
    goal: 'e8bd45',
    blue: '305b93',
    deepBlue: '26496d',
    glazing: '5c747b',
    windowDark: '475d66',
    steel: '7e8c8a',
    screen: '252f31',
    zone: 'a36b45',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  bleacher: { slot: 'trim', graph: 'metal_painted', roughness: 0.91 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88 },
  turf: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.32, metallic: 0.08 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.28 },
};
const up = [0, 1, 0];
const turfY = 0.07;

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function patch(out, slot, x0, x1, z0, z1, y, color) {
  if (x0 < x1 && z0 < z1)
    quad4(out, slot, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], color);
}
function pathWall(out, slot, a, b, lowA, lowB, highA, highB, sign, color) {
  const w = edge(a, b, sign);
  face(out, slot, [at(a, lowA), at(b, lowB), at(b, highB), at(a, highA)], w.normal, color);
}
function lerp(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t)];
}
function stadiumRing(west, east, north, south, corner) {
  return [
    [west + corner, north],
    [0, north],
    [east - corner, north],
    [east, north + corner],
    [east, 0],
    [east, south - corner],
    [east - corner, south],
    [0, south],
    [west + corner, south],
    [west, south - corner],
    [west, 0],
    [west, north + corner],
  ];
}
const inner = stadiumRing(-33.5, 33.5, -60.5, 62.2, 7);
const lowerRim = stadiumRing(-59.6, 60.6, -84.1, 83.3, 17);
const lowerHeights = [17.6, 17.4, 17.6, 18.0, 18.7, 18.0, 17.1, 16.5, 17.1, 18.0, 18.8, 18.0];
const coveredTerrace = [
  [-54, -67],
  [0, -73],
  [54, -67],
];
const upperNorthOuter = [
  [-68, -101],
  [-47, -109],
  [0, -109],
  [47, -109],
  [68, -101],
];
const northPairs = [
  [[-51, -79], [-34, -83], upperNorthOuter[0], upperNorthOuter[1]],
  [[-34, -83], [0, -83], upperNorthOuter[1], upperNorthOuter[2]],
  [[0, -83], [34, -83], upperNorthOuter[2], upperNorthOuter[3]],
  [[34, -83], [51, -79], upperNorthOuter[3], upperNorthOuter[4]],
];

function seating(out, a, b, c, d, lo, hi, subdiv, rows, lod, bleachers = colors.pale) {
  for (let lane = 0; lane < subdiv; lane++) {
    const first = lane / subdiv,
      last = (lane + 1) / subdiv;
    const aa = lerp(a, b, first),
      bb = lerp(a, b, last),
      cc = lerp(c, d, first),
      dd = lerp(c, d, last);
    const y0a = mix(lo[0], lo[1], first),
      y0b = mix(lo[0], lo[1], last);
    const y1a = mix(hi[0], hi[1], first),
      y1b = mix(hi[0], hi[1], last);
    const tint = lane % 4 === 2 ? colors.aisle : bleachers;
    for (let row = 0; row < rows; row++) {
      const t0 = row / rows,
        t1 = (row + 1) / rows;
      const e = lerp(aa, cc, t0),
        f = lerp(bb, dd, t0),
        g = lerp(bb, dd, t1),
        h = lerp(aa, cc, t1);
      const a0 = mix(y0a, y1a, t0),
        b0 = mix(y0b, y1b, t0),
        a1 = mix(y0a, y1a, t1),
        b1 = mix(y0b, y1b, t1);
      if (lod === 0) {
        quad4(out, 'bleacher', at(e, a0), at(f, b0), at(g, b1), at(h, a1), tint);
      } else {
        face(out, 'bleacher', [at(e, a1), at(f, b1), at(g, b1), at(h, a1)], up, tint);
        pathWall(out, 'concrete', e, f, a0, b0, a1, b1, -1, colors.slab);
      }
    }
    if (lod >= 1 && (lane === 0 || lane % 3 === 1)) {
      const a = lerp(aa, bb, 0.047),
        b = lerp(aa, bb, 0.079);
      const c = lerp(cc, dd, 0.047),
        d = lerp(cc, dd, 0.079);
      const baseA = mix(y0a, y0b, 0.0568),
        baseB = mix(y1a, y1b, 0.0568);
      const shift = (Math.max(y1a - y0a, y1b - y0b) / rows) * 0.82 + 0.013;
      face(
        out,
        'detail',
        [at(a, baseA + shift), at(b, baseA + shift), at(d, baseB + shift), at(c, baseB + shift)],
        up,
        colors.orange,
      );
    }
  }
}

function lowerBowl(out, lod) {
  const lanes = [1, 2, 3, 4][lod],
    rows = [1, 4, 15, 25][lod];
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    const a = inner[i],
      b = inner[j],
      c = lowerRim[i],
      d = lowerRim[j],
      ya = lowerHeights[i],
      yb = lowerHeights[j];
    const centerZ = (a[1] + b[1]) * 0.5;
    const tint = Math.abs(centerZ) > 22 ? colors.pale : colors.slab;
    seating(out, a, b, c, d, [1.0, 1.0], [ya, yb], lanes, rows, lod, tint);
    pathWall(out, 'detail', a, b, 0, 0, 1.3, 1.3, -1, i % 3 === 0 ? colors.blue : colors.orange);
    if (lod >= 1) {
      const s = lerp(c, a, 0.04),
        t = lerp(d, b, 0.04);
      pathWall(out, 'detail', s, t, ya - 0.48, yb - 0.48, ya + 0.33, yb + 0.33, 1, colors.orange);
    }
  }
}
const highStrip = [
  [[-61, 70], [-60, 0], [-75, 84], [-73, 0], 18.1, [31.3, 31.3]],
  [[-60, 0], [-61, -63], [-73, 0], [-74, -77], 18.1, [31.3, 31.3]],
  [[61, -64], [60, 0], [84, -76], [87, 0], 17.3, [31.5, 31.5]],
  [[60, 0], [61, 68], [87, 0], [86, 83], 17.3, [31.5, 31.5]],
  [[61, 68], [50, 82], [86, 83], [64, 110], 17.4, [31.5, 35.4]],
  [[50, 82], [0, 83], [64, 110], [0, 113], 17.4, [35.4, 35.4]],
  [[0, 83], [-50, 82], [0, 113], [-64, 110], 17.4, [35.4, 35.4]],
  [[-50, 82], [-61, 70], [-64, 110], [-75, 84], 17.4, [35.4, 31.3]],
];

function upperBowl(out, lod) {
  for (const [a, b, c, d, y0, [y1, y2]] of highStrip) {
    seating(
      out,
      a,
      b,
      c,
      d,
      [y0, y0],
      [y1, y2],
      [1, 3, 5, 7][lod],
      [1, 5, 13, 21][lod],
      lod,
      colors.pale,
    );
    pathWall(
      out,
      'concrete',
      c,
      d,
      Math.min(grade(c) - 0.75, y1 - 7),
      Math.min(grade(d) - 0.75, y2 - 7),
      y1 + 0.32,
      y2 + 0.32,
      1,
      colors.plinth,
    );
    if (lod >= 1) {
      pathWall(out, 'detail', a, b, y0 - 0.62, y0 - 0.62, y0 + 0.39, y0 + 0.39, 1, colors.orange);
      const f = facade(c, [d[0] - c[0], d[1] - c[1]]);
      const span = Math.hypot(d[0] - c[0], d[1] - c[1]);
      for (let u = 1.5; u < span - 0.65; u += lod >= 2 ? 5.2 : 9.1)
        fbox(
          out,
          'concrete',
          f,
          u - 0.4,
          u + 0.4,
          10.0,
          mix(y1, y2, u / span) + 0.57,
          -0.19,
          0.47,
          colors.pale,
        );
    }
  }
  for (const [a, b] of pairs(coveredTerrace)) {
    const A = [a[0], a[1] - 11],
      B = [b[0], b[1] - 11];
    seating(
      out,
      a,
      b,
      A,
      B,
      [17.8, 17.8],
      [22.9, 22.9],
      [1, 3, 5, 6][lod],
      [1, 4, 8, 13][lod],
      lod,
      colors.orange,
    );
    pathWall(out, 'detail', a, b, 16.6, 16.6, 18.5, 18.5, -1, colors.orange);
  }
  for (const [a, b, c, d] of northPairs) {
    seating(
      out,
      a,
      b,
      c,
      d,
      [24.2, 24.2],
      [37.1, 37.1],
      [1, 3, 5, 7][lod],
      [1, 5, 13, 20][lod],
      lod,
      colors.pale,
    );
    pathWall(out, 'concrete', c, d, grade(c) - 0.64, grade(d) - 0.64, 37.85, 37.85, 1, colors.slab);
    pathWall(out, 'detail', a, b, 22.8, 22.8, 24.8, 24.8, -1, colors.orange);
    if (lod >= 2) {
      const len = Math.hypot(d[0] - c[0], d[1] - c[1]);
      const F = facade(c, [d[0] - c[0], d[1] - c[1]]);
      for (let u = 2.5; u < len - 0.4; u += 5.4)
        fbox(out, 'brick', F, u - 0.61, u + 0.61, 9, 36.9, -0.1, 0.67, colors.warmBrick);
    }
  }
}

function grassAndField(out, lod) {
  const x = plan.dimensions.pitchWidthM / 2,
    z = plan.dimensions.pitchLengthM / 2;
  cap(out, 'turf', inner, turfY - 0.01, colors.turfVerge);
  for (let i = 0; i < 20; i++) {
    const a = -z + (z * i) / 10,
      b = -z + (z * (i + 1)) / 10;
    patch(out, 'turf', -x, x, a, b, turfY, i % 2 ? colors.turfA : colors.turfB);
  }
  const end = 9.144;
  for (const side of [-1, 1]) {
    const A = side * z,
      B = side * (z - end);
    patch(out, 'turf', -x, x, Math.min(A, B), Math.max(A, B), turfY + 0.015, colors.zone);
    const poleZ = side * (z + 1.2);
    beam(out, 'steel', [0, 0.12, poleZ + side * 1.2], [0, 3.1, poleZ], 0.21, 0.23, colors.goal);
    beam(out, 'steel', [-2.83, 3.1, poleZ], [2.83, 3.1, poleZ], 0.13, 0.14, colors.goal);
    for (const u of [-2.83, 2.83])
      beam(out, 'steel', [u, 3.1, poleZ], [u, 9.24, poleZ], 0.13, 0.16, colors.goal);
  }
  if (lod === 0) return;
  for (const sign of [-1, 1])
    patch(out, 'detail', sign * x - 0.105, sign * x + 0.105, -z, z, turfY + 0.022, colors.ink);
  for (let i = 0; i <= 20; i++) {
    const Z = -z + (z * i) / 10;
    const width = i === 0 || i === 20 || i === 10 ? 0.155 : 0.081;
    patch(out, 'detail', -x, x, Z - width, Z + width, turfY + 0.024, colors.ink);
  }
  if (lod >= 2) {
    for (let i = 15; i < 106; i += 2) {
      const z = i * 0.9144 - 54.864;
      for (const x of [-6.11, 6.11])
        patch(out, 'detail', x - 0.29, x + 0.29, z - 0.061, z + 0.061, turfY + 0.026, colors.ink);
    }
    for (const side of [-1, 1]) lettering(out, side);
  }
}

const letters = {
  F: ['111', '100', '110', '100', '100'],
  L: ['100', '100', '100', '100', '111'],
  O: ['111', '101', '101', '101', '111'],
  R: ['110', '101', '110', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  D: ['110', '101', '101', '101', '110'],
  A: ['010', '101', '111', '101', '101'],
  G: ['111', '100', '101', '101', '111'],
  T: ['111', '010', '010', '010', '010'],
  S: ['111', '100', '111', '001', '111'],
};
function lettering(out, side) {
  const word = side === 1 ? 'FLORIDA' : 'GATORS',
    w = 1.2,
    h = 0.89,
    shift = 2 * (word.length - 1) * w + 1.5 * w;
  for (const [i, l] of [...word].entries())
    for (const [j, row] of letters[l].entries())
      for (const [k, on] of [...row].entries()) {
        if (on !== '1') continue;
        const x = side * ((4 * i + k) * w - shift),
          z = side * (50.6 + (j - 2) * h);
        patch(
          out,
          'detail',
          x - w * 0.51,
          x + w * 0.51,
          z - h * 0.51,
          z + h * 0.51,
          turfY + 0.034,
          colors.deepBlue,
        );
      }
}

function tower(out, lod) {
  const native = features.westSkybox.points;
  const outline = [0, 2, 4, 5, 7, 8, 11, 13, 16, 20, 25, 29, 31].map((i) => native[i]);
  const form = outline.map(([x, z]) => [-99 + (x + 99) * 0.978, z * 0.985]);
  const mid = outline;
  cap(out, 'concrete', form, 27.2, colors.slab);
  cap(out, 'concrete', mid, 50.4, colors.pale);
  const levels = [30.2, 34.5, 38.8, 43.0, 47.7];
  for (let i = 0; i < form.length; i++) {
    const j = (i + 1) % form.length,
      a = form[i],
      b = form[j],
      c = mid[i],
      d = mid[j];
    const F = facade(c, [d[0] - c[0], d[1] - c[1]]);
    const length = Math.hypot(d[0] - c[0], d[1] - c[1]);
    const part = (c[0] + d[0]) * 0.5;
    const inset = part < -105 ? colors.glazing : colors.windowDark;
    pathWall(out, 'brick', a, b, grade(a) - 0.9, grade(b) - 0.9, 27.5, 27.5, 1, colors.warmBrick);
    pathWall(out, 'glass', c, d, 27.2, 27.2, 48.8, 48.8, 1, inset);
    quad4(
      out,
      'concrete',
      F.P(length, 48.8, 0.07),
      F.P(0, 48.8, 0.07),
      F.P(0, 50.4, 0.07),
      F.P(length, 50.4, 0.07),
      colors.pale,
    );
    if (lod >= 1) {
      for (const y of levels)
        fbox(out, 'concrete', F, -0.2, length + 0.2, y - 0.25, y + 0.25, -0.37, 0.48, colors.pale);
      if (lod >= 2)
        for (let u = 1.1; u < length - 0.3; u += 4.4)
          fbox(out, 'concrete', F, u - 0.09, u + 0.09, 28, 48.75, -0.03, 0.25, colors.slab);
    }
    if (lod >= 1 && part < -108)
      for (let u = 0.9; u < length - 0.2; u += lod >= 2 ? 5.3 : 10.6)
        fbox(
          out,
          'concrete',
          F,
          u - 0.46,
          u + 0.46,
          grade(lerp(c, d, u / length)) - 0.6,
          27.45,
          -1.9,
          1.18,
          colors.pale,
        );
  }
  for (const x of [-119, -99, -79])
    for (const z of [-59, 0, 63])
      block(out, 'concrete', x - 2.7, x + 2.7, z - 3.7, z + 3.7, 50.38, 51.9, colors.aisle);
}

function northRamps(out, lod) {
  for (const center of [-37.2, 36.8]) {
    const steps = [12, 20, 32, 44][lod],
      circles = lod === 0 ? 2 : 3;
    const radial = (r, t, y) => [center + r * Math.cos(t), y, -121.3 + r * Math.sin(t)];
    for (let n = 0; n < steps; n++) {
      const t0 = (2 * Math.PI * n) / steps,
        t1 = (2 * Math.PI * (n + 1)) / steps;
      const P = (r, y) => radial(r, t0, y),
        Q = (r, y) => radial(r, t1, y);
      const r = 13.7;
      face(
        out,
        'concrete',
        [P(r, 8.55), Q(r, 8.55), Q(r, 30.1), P(r, 30.1)],
        [Math.cos(t0), 0, Math.sin(t0)],
        colors.slab,
      );
      for (let k = 0; k < circles; k++) {
        const base = 10.1 + 6.4 * k,
          low = base + (3.1 * n) / steps,
          high = base + (3.1 * (n + 1)) / steps;
        face(
          out,
          'concrete',
          [P(7.7, low), P(r + 0.82, low), Q(r + 0.82, high), Q(7.7, high)],
          up,
          colors.pale,
        );
        if (lod >= 2)
          beam(
            out,
            'steel',
            P(r + 0.79, low + 0.76),
            Q(r + 0.79, high + 0.76),
            0.083,
            0.093,
            colors.steel,
          );
      }
      face(
        out,
        'concrete',
        [P(7.2, 30.12), P(r, 30.12), Q(r, 30.12), Q(7.2, 30.12)],
        up,
        colors.pale,
      );
    }
  }
  block(out, 'brick', -18, 18, -132, -110, 7.92, 21.0, colors.warmBrick);
  block(out, 'concrete', -18.4, 18.4, -132.3, -109.7, 21.0, 21.5, colors.pale);
}
function southConcourse(out, lod) {
  block(
    out,
    'brick',
    -50,
    49,
    110.1,
    126.8,
    Math.min(grade([0, 119]) - 0.7, 1.0),
    19.6,
    colors.warmBrick,
  );
  block(out, 'concrete', -52, 51, 109.9, 128.45, 19.4, 20.1, colors.pale);
  if (lod >= 1) {
    const F = facade([0, 126.9], [1, 0]);
    for (let x = -48; x < 48; x += 4.5) {
      fbox(out, 'concrete', F, x - 0.31, x + 0.31, 2.4, 19.4, -0.21, 0.94, colors.slab);
      if (lod >= 2)
        fbox(out, 'glass', F, x + 0.4, x + 3.5, 6.15, 9.6, -0.025, 0.029, colors.windowDark);
    }
  }
  block(out, 'brick', 56.2, 77.8, -125, -88, 7.38, 13.3, colors.weatheredBrick);
  block(out, 'concrete', 55.9, 78.1, -125.3, -87.8, 13.3, 13.86, colors.pale);
}
function boards(out, lod) {
  for (const [sign, width, location, foot, top] of [
    [-1, 21.73, 108.3, 37.3, 45.0],
    [1, 41.7, 114.7, 35.4, 42.1],
  ]) {
    const F = facade([0, sign * location], [-sign, 0]);
    fbox(out, 'steel', F, -width * 0.5, width * 0.5, foot, top, -1.26, 0.02, colors.deepBlue);
    fbox(
      out,
      'detail',
      F,
      -width * 0.464,
      width * 0.464,
      foot + 0.83,
      top - 0.48,
      0.041,
      0.094,
      colors.screen,
    );
    for (const side of [-1, 1])
      fbox(
        out,
        'steel',
        F,
        side * width * 0.39 - 0.36,
        side * width * 0.39 + 0.36,
        foot - 4.07,
        foot,
        -0.92,
        -0.21,
        colors.steel,
      );
    if (lod >= 1)
      for (const u of [-width * 0.46, -width * 0.28, 0, width * 0.28, width * 0.46])
        fbox(
          out,
          'steel',
          F,
          u - 0.38,
          u + 0.38,
          top - 0.105,
          top + 0.17,
          -0.31,
          0.3,
          colors.steel,
        );
  }
}
function build(out, lod) {
  grassAndField(out, lod);
  lowerBowl(out, lod);
  upperBowl(out, lod);
  tower(out, lod);
  northRamps(out, lod);
  southConcourse(out, lod);
  boards(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ben-hill-griffin-stadium-model.mjs';
const camera = [207, 132, -207],
  lookAt = [-13, 13, 0];
const cutout = stadiumRing(-32.95, 33.0, -59.4, 61.6, 7);
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'stadium',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Ben Hill Griffin Stadium’s recessed grass field, asymmetrical seating decks, west glass skybox, video boards and spiral entry towers.',
  camera,
  lookAt,
  sunDirection: [-53, 59, 42],
  mediumFiContext: {
    scale: 1.95,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: cutout,
    minHeight: -0.24,
    basis: 'Restricts any raised surrounding ground to the native open playing bowl.',
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'documented-bowl-and-northern-spiral-entry', position: camera, lookAt },
    { name: 'west-skybox-and-south-concourse', position: [-174, 71, 134], lookAt: [-26, 18, 0] },
    {
      name: 'north-sunshine-seats-from-playing-field',
      position: [28, 10, 54],
      lookAt: [-13, 18, -48],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ben-hill-griffin-stadium-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.7, surfaces },
      street: { export: 'street', errorMeters: 0.34, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.12, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on public-domain photography, native ODbL features and USDA/USGS open geospatial data.',
};
