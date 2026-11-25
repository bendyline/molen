import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const site = read('native-map/guinness-brewery-st-james-gate-shape-controls');
const front = facade([0, site.entranceZ], [1, 0]);
const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  brick: { slot: 'foundation', graph: 'brick_flemish', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_granite', roughness: 0.94 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.88 },
  timber: { slot: 'door', graph: 'wood_plain', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#555859', roughness: 0.54 },
};
const colors = {
  render: rgb('d9d5c8'),
  molding: rgb('d2cfc0'),
  brick: rgb('756353'),
  stone: rgb('8d8b7d'),
  stoneLight: rgb('9e9a8a'),
  slate: rgb('545956'),
  timber: rgb('353435'),
  rails: rgb('424143'),
  glass: rgb('505b5c'),
  bronze: rgb('ac8b4e'),
};

function plane(out, slot, face, left, right, bottom, top, depth, shade) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    shade,
  );
}

function stroke(out, slot, F, from, to, width, depth, shade) {
  const [x, y] = from;
  const [u, v] = to;
  const length = Math.hypot(u - x, v - y);
  const nx = ((y - v) * width * 0.5) / length;
  const ny = ((u - x) * width * 0.5) / length;
  quad4(
    out,
    slot,
    F.P(x - nx, y - ny, depth),
    F.P(u - nx, v - ny, depth),
    F.P(u + nx, v + ny, depth),
    F.P(x + nx, y + ny, depth),
    shade,
  );
}

function window(out, face, u, y, width, height, lod, frontBay = false) {
  if (lod < 2) {
    plane(out, 'glass', face, u - width / 2, u + width / 2, y, y + height, 0.042, colors.glass);
    if (lod) {
      fbox(
        out,
        'stone',
        face,
        u - width / 2 - 0.12,
        u + width / 2 + 0.12,
        y - 0.11,
        y,
        0.018,
        0.14,
        colors.stoneLight,
      );
    }
    return;
  }
  opening(out, face, u, y, width, height, {
    glassSlot: 'glass',
    frameSlot: frontBay ? 'render' : 'brick',
    glass: colors.glass,
    frame: frontBay ? colors.molding : colors.brick,
    frameWidth: frontBay ? 0.125 : 0.07,
    frameDepth: 0.12,
    d: 0.055,
  });
  fbox(
    out,
    'render',
    face,
    u - width / 2,
    u + width / 2,
    y + 0.5 * height - 0.03,
    y + 0.5 * height + 0.03,
    0.063,
    0.095,
    colors.molding,
  );
  const dividers = frontBay ? [-0.24, 0, 0.24] : [0];
  for (const p of dividers) {
    const x = u + width * p;
    const bar = p === 0 ? 0.023 : 0.036;
    fbox(out, 'render', face, x - bar, x + bar, y, y + height, 0.063, 0.102, colors.molding);
  }
  if (frontBay) {
    fbox(
      out,
      'render',
      face,
      u - width / 2 - 0.21,
      u + width / 2 + 0.21,
      y + height + 0.05,
      y + height + 0.21,
      -0.015,
      0.24,
      colors.molding,
    );
    if (lod > 2)
      for (let k = -4; k <= 4; k++) {
        const x = u + (k * width) / 8;
        fbox(
          out,
          'render',
          face,
          x - 0.016,
          x + 0.016,
          y + height + 0.055,
          y + height + 0.175,
          0.235,
          0.255,
          colors.render,
        );
      }
  }
}

function lodgeRoof(out, x0, x1, back, frontZ, y, lod, east) {
  const ridge = y + 2.55;
  const mid = (x0 + x1) / 2;
  const backRidge = [mid, ridge, back];
  const frontRidge = [mid, ridge, frontZ - 3.15];
  const rf = [x1, y, frontZ];
  const lf = [x0, y, frontZ];
  const rb = [x1, y, back];
  const lb = [x0, y, back];
  tri(out, 'slate', lf, rf, frontRidge, colors.slate);
  quad4(out, 'slate', rf, rb, backRidge, frontRidge, colors.slate);
  quad4(out, 'slate', lb, lf, frontRidge, backRidge, colors.slate);
  tri(out, 'brick', rb, lb, backRidge, colors.brick);
  if (east) {
    const face = facade([x0, back + 2.1], [1, 0]);
    fbox(out, 'brick', face, 0.85, 1.92, y + 0.42, ridge + 0.55, -1.1, 0, colors.brick);
    fbox(out, 'brick', face, 0.74, 2.02, ridge + 0.52, ridge + 0.78, -1.22, 0.11, colors.brick);
    if (lod > 1)
      for (const k of [1.02, 1.59])
        fbox(
          out,
          'brick',
          face,
          k,
          k + 0.19,
          ridge + 0.74,
          ridge + 1.08,
          -0.66,
          -0.36,
          colors.brick,
        );
  }
}

function lodge(out, mapOutline, east, lod) {
  const outline = outwardRing(mapOutline);
  const x0 = Math.min(...outline.map((p) => p[0]));
  const x1 = Math.max(...outline.map((p) => p[0]));
  const back = east ? -12.32 : -13.98;
  const top = east ? 10.24 : 10.16;
  extrude(out, 'brick', outline, -1.42, top, colors.brick, {
    topSlot: 'slate',
    topColor: colors.slate,
  });
  const [frontLeft, frontRight] = outline
    .filter(([, z]) => z > site.entranceZ - 0.24)
    .sort(([x], [nextX]) => x - nextX);
  const face = wallFace(frontLeft, frontRight);
  fbox(out, 'render', face, 0, face.length, -0.72, top + 0.48, -0.075, 0.043, colors.render);
  fbox(
    out,
    'render',
    face,
    -0.055,
    face.length + 0.055,
    top - 0.025,
    top + 0.22,
    -0.22,
    0.16,
    colors.molding,
  );
  fbox(
    out,
    'stone',
    face,
    -0.08,
    face.length + 0.08,
    top + 0.43,
    top + 0.56,
    -0.22,
    0.21,
    colors.stoneLight,
  );
  lodgeRoof(out, x0 + 0.1, x1 - 0.08, back, site.entranceZ - 0.14, top - 0.025, lod, east);
  if (!lod) return;
  for (const y of [1.17, 4.65, 7.47])
    window(out, face, face.length / 2, y, 2.36, y < 2 ? 1.98 : 1.65, lod, true);
  fbox(out, 'stone', face, 0, face.length, -0.56, 0.31, 0.007, 0.11, colors.stone);
  for (let i = 0; i < 17; i++) {
    const y = 0.38 + i * 0.57;
    const w = 0.43 + (i % 2) * 0.19;
    if (lod < 2 && i % 3 !== 0) continue;
    for (const u of [0, face.length - w])
      fbox(out, 'render', face, u, u + w, y, y + 0.53, 0.04, 0.09, colors.molding);
  }
  for (const [i, point] of outline.entries()) {
    const next = outline[(i + 1) % outline.length];
    if (Math.max(point[1], next[1]) > -0.2 && Math.min(point[1], next[1]) > -0.2) continue;
    const side = wallFace(point, next);
    if (side.length < 5.2) continue;
    const count = side.length > 10 ? (east ? 4 : 3) : 2;
    for (let k = 0; k < count; k++) {
      const u = (side.length * (k + 0.5)) / count;
      for (const y of [1.3, 4.7, 7.58]) window(out, side, u, y, 1.13, 1.56, lod);
      if (lod > 2 && k % 2 === 0)
        lathe(
          out,
          'stone',
          [side.P(u + 0.74, 0, 0.07)[0], side.P(u + 0.74, 0, 0.07)[2]],
          [
            [3.54, 0.082, 0.082],
            [3.63, 0.082, 0.082],
          ],
          6,
          colors.stone,
          { capTop: false },
        );
    }
  }
}

const gateLeft = site.entranceEnds[0][0];
const gateRight = site.entranceEnds[1][0];
const portals = [
  { center: -3.09, radius: 0.57, spring: 1.89, rise: 0.56, band: 0.33 },
  { center: 0.91, radius: 1.99, spring: 3.06, rise: 0.92, band: 0.51, large: true },
  { center: 5.02, radius: 0.61, spring: 1.89, rise: 0.54, band: 0.34 },
];
const glyphs = {
  G: [
    [
      [0.94, 0.86],
      [0.73, 1],
      [0.28, 1],
      [0.06, 0.78],
      [0.06, 0.24],
      [0.27, 0],
      [0.9, 0],
      [0.9, 0.49],
      [0.57, 0.49],
    ],
  ],
  U: [
    [
      [0.05, 1],
      [0.05, 0.24],
      [0.27, 0],
      [0.73, 0],
      [0.95, 0.24],
      [0.95, 1],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.18, 0],
      [0.82, 0],
    ],
    [
      [0.18, 1],
      [0.82, 1],
    ],
  ],
  N: [
    [
      [0.08, 0],
      [0.08, 1],
      [0.92, 0],
      [0.92, 1],
    ],
  ],
  E: [
    [
      [0.91, 1],
      [0.08, 1],
      [0.08, 0],
      [0.91, 0],
    ],
    [
      [0.08, 0.5],
      [0.77, 0.5],
    ],
  ],
  S: [
    [
      [0.91, 0.89],
      [0.74, 1],
      [0.24, 1],
      [0.07, 0.82],
      [0.08, 0.62],
      [0.88, 0.41],
      [0.91, 0.18],
      [0.72, 0],
      [0.25, 0],
      [0.06, 0.12],
    ],
  ],
  0: [
    [
      [0.26, 0],
      [0.07, 0.24],
      [0.07, 0.75],
      [0.29, 1],
      [0.71, 1],
      [0.91, 0.75],
      [0.91, 0.24],
      [0.71, 0],
      [0.26, 0],
    ],
  ],
  1: [
    [
      [0.27, 0.77],
      [0.58, 1],
      [0.58, 0],
    ],
    [
      [0.25, 0],
      [0.85, 0],
    ],
  ],
  2: [
    [
      [0.08, 0.79],
      [0.25, 1],
      [0.7, 1],
      [0.9, 0.81],
      [0.86, 0.62],
      [0.1, 0.15],
      [0.1, 0],
      [0.93, 0],
    ],
  ],
  5: [
    [
      [0.9, 1],
      [0.13, 1],
      [0.12, 0.56],
      [0.73, 0.56],
      [0.92, 0.34],
      [0.87, 0.14],
      [0.66, 0],
      [0.22, 0],
      [0.06, 0.14],
    ],
  ],
  6: [
    [
      [0.88, 0.89],
      [0.72, 1],
      [0.34, 1],
      [0.08, 0.72],
      [0.08, 0.23],
      [0.26, 0],
      [0.68, 0],
      [0.92, 0.21],
      [0.92, 0.39],
      [0.71, 0.58],
      [0.12, 0.58],
    ],
  ],
  7: [
    [
      [0.07, 1],
      [0.93, 1],
      [0.34, 0],
    ],
  ],
  9: [
    [
      [0.15, 0.09],
      [0.38, 0],
      [0.69, 0],
      [0.9, 0.29],
      [0.9, 0.78],
      [0.72, 1],
      [0.29, 1],
      [0.07, 0.81],
      [0.07, 0.62],
      [0.26, 0.48],
      [0.88, 0.48],
    ],
  ],
};

function sign(out, word, center, bottom, width, height, depth, color) {
  const step = width / word.length;
  let x = center - width / 2;
  for (const char of word) {
    for (const points of glyphs[char]) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        stroke(
          out,
          'timber',
          front,
          [x + step * a[0] * 0.77, bottom + height * a[1]],
          [x + step * b[0] * 0.77, bottom + height * b[1]],
          height * 0.115,
          depth,
          color,
        );
      }
    }
    x += step;
  }
}

function entrance(out, lod) {
  const base = -0.5;
  const top = 4.83;
  let position = gateLeft - 0.06;
  for (const p of portals) {
    const { center: u, radius: r, spring, rise, band, large } = p;
    fbox(out, 'render', front, position, u - r, base, top, -1.04, 0.005, colors.render);
    position = u + r;
    fbox(out, 'render', front, u - r, u + r, base, 0.013, -1.04, 0.005, colors.render);
    const arch = roundArch(r, lod > 1 ? (large ? 14 : 9) : large ? 7 : 5);
    const itr = ([x, y], outer, depth) =>
      front.P(
        u + x * (outer ? (r + band) / r : 1),
        spring + (y * (rise + (outer ? band : 0))) / r,
        depth,
      );
    for (let i = 1; i < arch.length; i++) {
      const a = arch[i - 1];
      const b = arch[i];
      const left = itr(a, false, 0.008);
      const right = itr(b, false, 0.008);
      quad4(
        out,
        'render',
        left,
        right,
        front.P(right[0], top, 0.008),
        front.P(left[0], top, 0.008),
        colors.render,
      );
      quad4(
        out,
        'render',
        itr(b, false, -1.04),
        itr(a, false, -1.04),
        front.P(left[0], top, -1.04),
        front.P(right[0], top, -1.04),
        colors.render,
      );
      quad4(
        out,
        'stone',
        itr(b, false, 0.125),
        itr(a, false, 0.125),
        itr(a, false, -1.04),
        itr(b, false, -1.04),
        colors.stone,
      );
      quad4(
        out,
        'stone',
        itr(a, false, 0.131),
        itr(b, false, 0.131),
        itr(b, true, 0.148),
        itr(a, true, 0.148),
        i % 3 ? colors.stoneLight : colors.stone,
      );
      tri(
        out,
        'timber',
        front.P(u, spring, -0.72),
        itr(b, false, -0.72),
        itr(a, false, -0.72),
        colors.timber,
      );
      if (lod)
        tri(
          out,
          'timber',
          front.P(u, spring, -0.75),
          itr(a, false, -0.75),
          itr(b, false, -0.75),
          colors.timber,
        );
      if (lod > 1 && i < arch.length - 1) {
        const x = u + b[0] * ((r + band) / r);
        const y = spring + b[1] * ((rise + band) / r);
        stroke(out, 'stone', front, [right[0], right[1]], [x, y], 0.028, 0.155, colors.stone);
        stroke(
          out,
          'timber',
          front,
          [u, spring + 0.045],
          [right[0], right[1]],
          0.022,
          -0.707,
          colors.rails,
        );
      }
    }
    if (large) {
      fbox(
        out,
        'stone',
        front,
        u - 0.17,
        u + 0.17,
        spring + rise - 0.025,
        spring + rise + 0.52,
        0.116,
        0.211,
        colors.stone,
      );
      if (lod > 1) {
        fbox(
          out,
          'stone',
          front,
          u - 0.115,
          u + 0.115,
          spring + rise + 0.135,
          spring + rise + 0.41,
          0.202,
          0.265,
          colors.stoneLight,
        );
        fbox(
          out,
          'stone',
          front,
          u - 0.043,
          u + 0.043,
          spring + rise + 0.19,
          spring + rise + 0.325,
          0.259,
          0.293,
          colors.stoneLight,
        );
      }
    }
    for (const side of [-1, 1]) {
      const count = lod ? (large ? 8 : 5) : 1;
      for (let i = 0; i < count; i++) {
        const y = Math.max(0, (spring * i) / count + 0.018);
        const end = (spring * (i + 1)) / count - 0.018;
        const w = band * (large || i % 2 ? 1 : 0.7);
        fbox(
          out,
          'stone',
          front,
          side < 0 ? u - r - w : u + r,
          side < 0 ? u - r : u + r + w,
          y,
          end,
          -1.04,
          0.135,
          colors.stoneLight,
        );
      }
    }
    if (large) {
      const leaf = facade([u - r + 0.05, site.entranceZ - 0.74], [0.67, -0.742]);
      fbox(out, 'timber', leaf, 0, r - 0.04, 0.015, spring - 0.036, -0.071, 0.02, colors.timber);
      if (lod > 1) {
        for (let i = 1; i < 10; i++) {
          const x = ((r - 0.08) * i) / 10;
          plane(out, 'timber', leaf, x, x + 0.018, 0.04, spring - 0.075, 0.031, colors.rails);
        }
        stroke(out, 'stone', leaf, [0.86, 1.52], [1.06, 1.27], 0.033, 0.044, colors.bronze);
        stroke(out, 'stone', leaf, [1.06, 1.27], [1.29, 1.58], 0.036, 0.044, colors.bronze);
        stroke(out, 'stone', leaf, [1.29, 1.58], [0.86, 1.52], 0.034, 0.044, colors.bronze);
        for (const k of [0.96, 1.07, 1.18])
          stroke(out, 'stone', leaf, [k, 1.54], [k, 1.41], 0.015, 0.044, colors.bronze);
      }
    } else {
      fbox(
        out,
        'timber',
        front,
        u - r + 0.014,
        u + r - 0.014,
        0.018,
        spring,
        -0.91,
        -0.72,
        colors.timber,
      );
      if (lod > 1)
        fbox(
          out,
          'timber',
          front,
          u - r + 0.018,
          u + r - 0.018,
          spring - 0.07,
          spring,
          -0.72,
          -0.677,
          colors.rails,
        );
    }
  }
  fbox(out, 'render', front, position, gateRight + 0.06, base, top, -1.04, 0.005, colors.render);
  for (const [y, h, d] of [
    [4.64, 0.12, 0.18],
    [4.76, 0.1, 0.25],
    [4.85, 0.12, 0.28],
  ])
    fbox(
      out,
      'render',
      front,
      gateLeft - 0.09,
      gateRight + 0.09,
      y,
      y + h,
      -1.17,
      d,
      colors.molding,
    );
  fbox(out, 'render', front, -1.96, 3.76, 4.92, 5.41, -1.1, 0.075, colors.render);
  if (lod) {
    for (const [x, date] of [
      [-3.1, '1759'],
      [5.0, '2026'],
    ]) {
      fbox(out, 'stone', front, x - 0.7, x + 0.7, 3.38, 4.11, -0.03, 0.163, colors.stoneLight);
      fbox(out, 'render', front, x - 0.56, x + 0.56, 3.52, 3.99, 0.157, 0.174, colors.render);
      for (const k of [-0.58, 0.58])
        fbox(out, 'stone', front, x + k - 0.12, x + k + 0.12, 3.24, 3.43, 0, 0.181, colors.stone);
      if (lod > 1) sign(out, date, x, 3.63, 0.94, 0.26, 0.18, colors.timber);
    }
    sign(out, 'GUINNESS', 0.96, 5.006, 2.34, 0.286, 0.084, colors.timber);
  }
  for (const x of [-1.43, 3.18]) {
    const center = [x, site.entranceZ + 0.9];
    lathe(
      out,
      'stone',
      center,
      [
        [-0.18, 0.25, 0.25],
        [0.42, 0.18, 0.18],
        [0.65, 0.13, 0.13],
        [0.71, 0.067, 0.067],
      ],
      lod > 1 ? 10 : 6,
      colors.stone,
    );
  }
  if (lod > 1) {
    for (const [a, b] of [
      [gateLeft - 0.35, -1.57],
      [3.43, gateRight + 0.2],
    ]) {
      for (const y of [0.41, 0.91])
        fbox(out, 'timber', front, a, b, y, y + 0.029, 1.29, 1.33, colors.rails);
      for (let x = a; x <= b; x += lod > 2 ? 0.18 : 0.34)
        fbox(out, 'timber', front, x, x + 0.03, 0, 1.04, 1.29, 1.33, colors.rails);
    }
  }
}

function build(sink, lod) {
  const out = withFootprintCaps({
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  });
  lodge(out, site.eastLodge, true, lod);
  lodge(out, site.westLodge, false, lod);
  entrance(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'guinness-brewery-st-james-gate-model.mjs';
const camera = [-17, 15.8, 38];
const lookAt = [0.5, 5.5, -2.6];

export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-brewery-gate',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'St. James’s Gate at the Guinness Brewery, with three rusticated granite arches, timber fanlights, the date plaques and two three-storey lodges.',
  camera,
  lookAt,
  sunDirection: [-22, 36, 52],
  mediumFiContext: {
    scale: 0.91,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'thomas-street-front', position: [-1, 4.4, 25], lookAt: [0.65, 5.19, 0] },
    { name: 'three-granite-arches-and-signs', position: [1.4, 3.06, 11.8], lookAt: [1.1, 2.84, 0] },
    { name: 'west-approach-and-lodge', position: [18, 7.5, 20], lookAt: [2, 4.8, 0] },
    { name: 'lodge-roofs-from-brewery-yard', position: [-20, 20, -29], lookAt: [1, 7, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'guinness-st-james-gate-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.22, surfaces },
      street: { export: 'street', errorMeters: 0.088, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces },
    },
  },
};
