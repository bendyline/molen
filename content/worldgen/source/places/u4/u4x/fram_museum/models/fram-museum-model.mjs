import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  pairs,
  palette,
  panel,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  green: '7b845d',
  side: '737c5e',
  wing: '706f51',
  foot: '8a897b',
  ridge: '535f4c',
  roof: '74816b',
  roofShade: '6b7862',
  roofLight: '7f8971',
  seam: '526051',
  glass: '536b73',
  glassLighter: '718087',
  lowerGlass: '596458',
  trim: '6a7060',
  screen: '333c38',
  letters: '282d25',
  pavement: '949387',
});
const surfaces = {
  roof: surface('roof', 'metal_standing_seam', 0.68, 0.14),
  base: surface('foundation', 'concrete_panel', 0.9),
  trim: surface('trim', 'metal_painted', 0.69, 0.12),
  gable: { slot: 'wall', localRef: 'palette:#fffffe', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.39, metallic: 0.08 },
};
const roofColors = [colors.roof, colors.roofLight, colors.roof, colors.roofShade, colors.roof];
const panes = [colors.glass, colors.glassLighter, colors.glass, colors.glass];

function endWall(x, center, direction) {
  return {
    normal: [direction, 0, 0],
    p: (u, y, d = 0) => [x + direction * d, y, center - direction * u],
  };
}
function gable(out, h, x, direction, color) {
  const center = (h.near + h.far) / 2;
  const y0 = Math.min(grade([x, h.near]), grade([x, h.far]), 0) - 0.53;
  const points = [
    [x, y0, h.near],
    [x, y0, h.far],
    [x, h.eave, h.far],
    [x, h.ridge, center],
    [x, h.eave, h.near],
  ];
  face(out, 'gable', points, [direction, 0, 0], color);
  return endWall(x, center, direction);
}
function foundation(out, outline, eave) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, sign);
    const bottom = Math.min(grade(a), grade(b), 0) - 0.58;
    panel(out, 'base', wall, 0, wall.length, bottom, eave, 0, colors.foot);
  }
}
function copperSlope(out, h, side, level, lightStrip) {
  const center = (h.near + h.far) / 2;
  const z = side < 0 ? h.near : h.far;
  const inRoof = (x, t, lift = 0) => [x, mix(h.eave, h.ridge, t) + lift, mix(z, center, t)];
  const patch = (slot, x0, x1, t0, t1, lift, color) =>
    face(
      out,
      slot,
      [inRoof(x0, t0, lift), inRoof(x1, t0, lift), inRoof(x1, t1, lift), inRoof(x0, t1, lift)],
      up,
      color,
    );
  const start = h.start - 0.19;
  const end = h.end + 0.19;
  const count = Math.ceil((end - start) / [15.5, 5.8, 2.45, 1.14][level]);
  const bay = (i) => mix(start, end, i / count);
  for (let i = 0; i < count; i++) {
    patch(
      'roof',
      bay(i),
      bay(i + 1),
      0,
      1,
      0.1,
      roofColors[(i + (side < 0 ? 2 : 0)) % roofColors.length],
    );
  }
  if (lightStrip) {
    const lo = h.start + 9.5;
    const hi = h.end - 10.2;
    patch('glass', lo, hi, 0.46, 0.69, 0.145, colors.glassLighter);
    if (level >= 1) {
      for (const t of [0.46, 0.69]) patch('trim', lo, hi, t - 0.003, t + 0.003, 0.19, colors.trim);
    }
  }
  patch('trim', start, end, 0.984, 1, 0.19, colors.ridge);
  patch('trim', start, end, 0, 0.009, 0.16, colors.ridge);
  for (const lip of [start, end - 0.15]) patch('trim', lip, lip + 0.15, 0, 1, 0.165, colors.ridge);
  if (level === 0) return;
  for (let i = 1; i < count; i++) {
    patch('trim', bay(i) - 0.018, bay(i) + 0.018, 0.014, 0.984, 0.195, colors.seam);
    if (level === 3) {
      for (const t of [0.31, 0.61]) {
        const x0 = bay(i - 1) + 0.04;
        const x1 = bay(i) - 0.04;
        if (lightStrip && t > 0.46 && x1 > h.start + 9.5 && x0 < h.end - 10.2) continue;
        patch('trim', x0, x1, t, t + 0.001, 0.16, colors.roofShade);
      }
    }
  }
}
function glazedGable(out, w, floor, rows, level) {
  const half = (i) => rows[i][1];
  for (let i = 0; i < rows.length - 1; i++) {
    const [low] = rows[i];
    const [high] = rows[i + 1];
    const b = half(i);
    const top = half(i + 1);
    const panelFace = (slot, corners, offset, color) =>
      face(
        out,
        slot,
        corners.map(([u, y]) => w.p(u, y, offset)),
        w.normal,
        color,
      );
    const bays = [1, 4, 6, 8][level];
    for (let j = 0; j < bays; j++) {
      const t = j / bays,
        s = (j + 1) / bays;
      panelFace(
        'glass',
        [
          [mix(-b, b, t), low],
          [mix(-b, b, s), low],
          [mix(-top, top, s), high],
          [mix(-top, top, t), high],
        ],
        0.025,
        i === 0 ? floor : panes[(i + j) % panes.length],
      );
    }
    panel(out, 'trim', w, -b, b, low - 0.064, low + 0.064, 0.07, colors.trim);
    if (level === 0) continue;
    for (let j = 0; j <= bays; j++) {
      const t = j / bays,
        x = mix(-b, b, t),
        u = mix(-top, top, t);
      panelFace(
        'trim',
        [
          [x - 0.038, low],
          [x + 0.038, low],
          [u + 0.038, high],
          [u - 0.038, high],
        ],
        0.083,
        colors.trim,
      );
    }
  }
  const [hi, width] = rows.at(-1);
  panel(out, 'trim', w, -width, width, hi - 0.064, hi + 0.064, 0.07, colors.trim);
}
const glyphs = {
  F: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.57, 1],
    ],
    [
      [0, 0.53],
      [0.47, 0.53],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.49, 1],
    ],
    [
      [0.49, 1],
      [0.6, 0.91],
    ],
    [
      [0.6, 0.91],
      [0.6, 0.67],
    ],
    [
      [0.6, 0.67],
      [0.47, 0.56],
    ],
    [
      [0.47, 0.56],
      [0, 0.56],
    ],
    [
      [0.28, 0.56],
      [0.65, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.32, 1],
    ],
    [
      [0.32, 1],
      [0.65, 0],
    ],
    [
      [0.15, 0.4],
      [0.51, 0.4],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0, 1],
      [0.34, 0.39],
    ],
    [
      [0.34, 0.39],
      [0.68, 1],
    ],
    [
      [0.68, 1],
      [0.68, 0],
    ],
  ],
};
function framLetters(out, w) {
  for (const [i, char] of [...'FRAM'].entries()) {
    for (const [[x0, y0], [x1, y1]] of glyphs[char]) {
      const a = (x0 + i * 0.85 - 1.57) * 1.25,
        b = (x1 + i * 0.85 - 1.57) * 1.25;
      const c = 15.06 + y0 * 1.25,
        d = 15.06 + y1 * 1.25;
      const m = 0.079 / Math.hypot(b - a, d - c),
        u = (d - c) * m,
        v = (a - b) * m;
      face(
        out,
        'trim',
        [
          [a - u, c - v],
          [b - u, d - v],
          [b + u, d + v],
          [a + u, c + v],
        ].map(([x, y]) => w.p(x, y, 0.075)),
        w.normal,
        colors.letters,
      );
    }
  }
}
function hall(out, h, outline, index, level) {
  foundation(out, outline, h.eave - 0.07);
  const color = index === 1 ? colors.wing : colors.green;
  const front = gable(out, h, h.end, 1, color);
  const back = gable(out, h, h.start, -1, colors.side);
  copperSlope(out, h, -1, level, false);
  copperSlope(out, h, 1, level, index === 0);
  if (index === 0) {
    glazedGable(
      out,
      front,
      colors.lowerGlass,
      [
        [5.12, 7.05],
        [7.57, 6.17],
        [11, 4.44],
        [13.85, 3.04],
      ],
      level,
    );
    panel(out, 'trim', front, -7.25, 7.25, 4.91, 5.18, 0.24, colors.trim);
    panel(out, 'glass', front, -0.54, 0.54, 19.7, 20.35, 0.025, colors.glass);
    if (level >= 1) framLetters(out, front);
    glazedGable(
      out,
      back,
      colors.lowerGlass,
      [
        [14.6, 5.15],
        [17.7, 3.77],
        [21.38, 2.11],
      ],
      level,
    );
  } else {
    const tall = index === 1 ? 13.05 : 14.01;
    glazedGable(
      out,
      front,
      colors.lowerGlass,
      [
        [1.6, 7.05],
        [4.2, 6.31],
        [7.1, 4.8],
        [10.0, 3.29],
        [tall, 1.52],
      ],
      level,
    );
    glazedGable(
      out,
      back,
      colors.lowerGlass,
      [
        [3.7, 6.03],
        [7.15, 4.62],
        [11.1, 2.68],
      ],
      level,
    );
    if (index === 2) {
      opening(
        out,
        back,
        -1.75,
        1.75,
        0.14,
        2.75,
        'trim',
        colors.glass,
        'glass',
        colors.trim,
        level,
        0.035,
      );
    }
  }
}
function entrance(out, level) {
  const h = dimensions.entry;
  const wall = gable(out, h, h.start, -1, colors.side);
  copperSlope(out, h, -1, level, false);
  copperSlope(out, h, 1, level, false);
  glazedGable(
    out,
    wall,
    colors.lowerGlass,
    [
      [3.33, 5.87],
      [5.75, 4.62],
      [8.27, 3.22],
      [11.2, 1.5],
    ],
    level,
  );
  opening(out, wall, -2.9, 2.9, 0.1, 3.26, 'trim', colors.glass, 'glass', colors.trim, level, 0.04);
  if (level >= 1) {
    for (const u of [-1.45, 0, 1.45])
      panel(out, 'trim', wall, u - 0.041, u + 0.041, 0.1, 3.26, 0.08, colors.trim);
  }
  block(out, 'base', h.start - 1.24, -0.42, -3.25, 1.25, 0.52, 7.75, colors.pavement);
  block(out, 'trim', h.start - 0.95, 3.28, -2.5, 1.01, 0.14, 6.2, colors.trim);
}
function build(out, level) {
  dimensions.halls.forEach((h, i) => {
    hall(out, h, dimensions.polygons[i], i, level);
  });
  entrance(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'fram-museum-model.mjs';
const camera = [123, 56, 113];
const lookAt = [2, 9, -13.5];
const errors = { district: 0.58, street: 0.24, closeup: 0.075 };
export const framMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum-library',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Kartverket bare-earth height outside the mapped main entrance.',
  brief:
    'Fram Museum at Bygdøynes with three copper A-frame halls, the glazed waterfront gable and the lower triangular entrance.',
  camera,
  lookAt,
  sunDirection: [82, 95, 57],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: dimensions.outline,
    outlines: dimensions.polygons,
    minimumCoverage: 0.92,
    basis:
      'The three individual mapped museum envelopes, preserving the spaces between halls and the neighbouring museums.',
  },
  embeddedCanonicalGraphs: ['metal_standing_seam', 'concrete_panel', 'metal_painted'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'waterfront-fram-gable', position: [96, 16, 37], lookAt: [18, 9, 9] },
    { name: 'roadward-public-entrance', position: [-81, 17, -11], lookAt: [-22, 7, -3] },
    { name: 'gjoa-hall', position: [66, 21, -93], lookAt: [8, 8, -50] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fram-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.09,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Kartverket terrain and surface height CC BY 4.0.',
};
