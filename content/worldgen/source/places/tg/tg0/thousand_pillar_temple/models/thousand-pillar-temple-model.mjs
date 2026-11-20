import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  wall: '777263',
  wallShade: '6b6659',
  cut: '8e8674',
  edge: 'a89e86',
  root: '756e5e',
  dark: '49453b',
  column: '605a49',
  stone: '918773',
  roof: '9d9278',
  deep: '38352b',
  carving: '7c725e',
  figure: '908675',
});
const surfaces = {
  wall: surface('wall', 'stone_granite', 0.95),
  podium: surface('foundation', 'stone_ashlar', 0.96),
  architrave: surface('roof', 'stone_sandstone_raw', 0.95),
  trim: surface('trim', 'stone_basalt', 0.91),
  opening: surface('trim', 'stone_basalt_raw', 0.96),
};
const floor = d.podium;
const gallery = d.porchFloor;
const roofBottom = d.eave;
const regions = [
  {
    outline: [
      [-1.93, -14.19],
      [2.8, -14.19],
      [2.8, -7.01],
      [-1.93, -7.01],
    ],
    doorSide: 2,
  },
  {
    outline: [
      [-13.26, -2.8],
      [-4.03, -2.8],
      [-4.03, 3.24],
      [-13.26, 3.24],
    ],
    doorSide: 1,
  },
  {
    outline: [
      [4.07, -2.81],
      [14.42, -2.81],
      [14.42, 3.22],
      [4.07, 3.22],
    ],
    doorSide: 3,
  },
];
const podiumOutline = [
  [-5.47, 12.69],
  [7.81, 12.69],
  [7.81, 6.59],
  [17.96, 6.59],
  [17.96, -6.52],
  [7.68, -6.52],
  [6.03, -8.27],
  [6.03, -17.97],
  [-5.05, -17.97],
  [-5.05, -9.25],
  [-7.45, -6.56],
  [-17.08, -6.56],
  [-17.08, 6.88],
  [-8.02, 6.88],
  [-8.02, 10.71],
  [-5.47, 10.71],
];
const center = [0.55, -0.45];
const resize = (outline, ratio) =>
  outline.map(([x, z]) => [mix(center[0], x, ratio), mix(center[1], z, ratio)]);

function profile(outline, delta) {
  const signed = areaSign(outline);
  return outline.map((point, index) => {
    const prior = edge(
      outline[(index + outline.length - 1) % outline.length],
      point,
      signed,
    ).normal;
    const next = edge(point, outline[(index + 1) % outline.length], signed).normal;
    const scale = delta / (1 + prior[0] * next[0] + prior[2] * next[2]);
    return [point[0] + scale * (prior[0] + next[0]), point[1] + scale * (prior[2] + next[2])];
  });
}

function band(out, outline, low, high, slot, color) {
  shell(out, outline, typeof low === 'function' ? low : () => low, high, { wall: slot, color });
}

function layeredPodium(out, lod) {
  const bottom = (p) => Math.min(-0.02, grade(p) - 0.34);
  if (lod === 0) {
    band(out, podiumOutline, bottom, 0.4, 'podium', colors.root);
    band(out, resize(podiumOutline, 0.96), 0.4, 0.87, 'podium', colors.stone);
    band(out, resize(podiumOutline, 0.988), 0.87, floor, 'podium', colors.edge);
  } else {
    band(out, podiumOutline, bottom, 0.245, 'podium', colors.root);
    band(out, resize(podiumOutline, 0.985), 0.245, 0.395, 'podium', colors.edge);
    band(out, resize(podiumOutline, 0.954), 0.395, 0.628, 'podium', colors.wallShade);
    band(out, resize(podiumOutline, 0.986), 0.628, 0.807, 'podium', colors.cut);
    band(out, resize(podiumOutline, 0.961), 0.807, 1.013, 'podium', colors.stone);
    band(out, resize(podiumOutline, 0.988), 1.013, floor, 'podium', colors.edge);
  }
  stairs(out, grade, 'podium', -1.12, 3.45, 14.43, 12.52, floor, lod === 0 ? 3 : 5, colors.cut);
  const inner = rect(-4.36, 9.39, 5.45, -7.82);
  band(out, inner, floor - 0.02, gallery - 0.21, 'podium', colors.wallShade);
  band(out, profile(inner, 0.15), gallery - 0.21, gallery, 'podium', colors.cut);
  stairs(
    out,
    () => floor,
    'podium',
    -0.82,
    3.31,
    11.31,
    9.29,
    gallery,
    lod === 0 ? 3 : 5,
    colors.stone,
  );
  if (lod < 2) return;
  for (const [[a, b], index] of pairs(closed(podiumOutline)).map((x, i) => [x, i])) {
    const w = edge(a, b, areaSign(podiumOutline));
    const count = Math.max(1, Math.round(w.length / 0.86));
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.18 + (index % 2) * 0.15) * w.length) / count;
      panel(out, 'podium', w, u, u + 0.019, 0.035, 0.22, 0.006, colors.cut);
    }
  }
}

function column(out, x, z, base, top, lod, s = 1) {
  const width = 0.74 * s;
  const p = (h) => base + (top - base) * h;
  const blockAt = (slot, y, t, w) =>
    block(out, slot, x - w / 2, y, z - w / 2, w, t - y, w, colors.cut);
  blockAt('podium', base, p(0.12), width);
  blockAt('trim', p(0.86), top, width * 1.09);
  if (lod === 0) {
    block(
      out,
      'trim',
      x - width * 0.31,
      p(0.12),
      z - width * 0.31,
      width * 0.62,
      p(0.86) - p(0.12),
      width * 0.62,
      colors.column,
    );
    return;
  }
  const shape =
    lod === 1
      ? [
          [0.12, 0.39],
          [0.27, 0.31],
          [0.38, 0.29],
          [0.69, 0.24],
          [0.86, 0.36],
        ]
      : [
          [0.12, 0.39],
          [0.2, 0.36],
          [0.22, 0.4],
          [0.27, 0.32],
          [0.32, 0.31],
          [0.35, 0.24],
          [0.39, 0.3],
          [0.62, 0.27],
          [0.69, 0.23],
          [0.71, 0.36],
          [0.73, 0.37],
          [0.78, 0.31],
          [0.82, 0.31],
          [0.86, 0.42],
        ];
  ring(
    out,
    'trim',
    [x, z],
    shape.map(([h, r]) => [p(h), r * s]),
    lod === 1 ? 6 : lod === 2 ? 8 : 10,
    colors.column,
  );
  if (lod < 2) return;
  blockAt('trim', p(0.9), p(0.95), width * 1.22);
}

function figure(out, x, z, y, lod) {
  const layers = lod === 3 ? 8 : 6;
  const body = [
    [y, 0.3],
    [y + 0.19, 0.43],
    [y + 0.44, 0.5],
    [y + 0.67, 0.38],
    [y + 0.78, 0.2],
    [y + 0.83, 0.04],
  ];
  ring(out, 'wall', [x, z], body, layers, colors.figure);
  ring(
    out,
    'wall',
    [x, z + 0.36],
    [
      [y + 0.08, 0.12],
      [y + 0.33, 0.104],
      [y + 0.57, 0.177],
      [y + 0.69, 0.26],
      [y + 0.73, 0.13],
    ],
    layers,
    colors.figure,
  );
  const legs = [-0.25, 0.25];
  for (const offset of legs)
    for (const depth of [-0.24, 0.22]) {
      ring(
        out,
        'wall',
        [x + offset, z + depth],
        [
          [y, 0.127],
          [y + 0.27, 0.139],
          [y + 0.39, 0.165],
        ],
        layers,
        colors.figure,
      );
    }
  band(out, rect(x - 0.51, z + 0.57, x + 0.51, z - 0.45), y - 0.012, y + 0.1, 'podium', colors.cut);
  const earSide = plane(z + 0.425, 1);
  for (const s of [-1, 1])
    panel(
      out,
      'trim',
      earSide,
      x + s * 0.21 - 0.1,
      x + s * 0.21 + 0.1,
      y + 0.37,
      y + 0.63,
      0.018,
      colors.carving,
    );
  cap(out, 'wall', rect(x - 0.12, z + 0.49, x + 0.12, z + 0.69), y + 0.14, colors.cut);
}

function shrineWall(out, outline, inner, lod) {
  const s = areaSign(outline),
    y = gallery,
    shaftTop = roofBottom - 0.35;
  band(out, profile(outline, 0.48), floor, y - 0.43, 'podium', colors.root);
  band(out, profile(outline, 0.39), y - 0.43, y - 0.25, 'wall', colors.edge);
  band(out, profile(outline, 0.22), y - 0.25, y - 0.06, 'wall', colors.wallShade);
  band(out, profile(outline, 0.29), y - 0.06, y + 0.15, 'wall', colors.cut);
  band(out, outline, y + 0.15, roofBottom - 0.17, 'wall', colors.wall);
  band(out, profile(outline, 0.24), roofBottom - 0.56, roofBottom - 0.39, 'wall', colors.cut);
  band(
    out,
    profile(outline, 0.4),
    roofBottom - 0.39,
    roofBottom - 0.18,
    'architrave',
    colors.wallShade,
  );
  if (lod === 0) return;
  for (const [[a, b], sideIndex] of pairs(closed(outline)).map((p, i) => [p, i])) {
    if (sideIndex === inner) continue;
    const w = edge(a, b, s),
      n = Math.max(4, Math.round(w.length / 0.87));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * w.length) / n;
      for (const [low, top, width, o, tone] of [
        [y + 0.14, shaftTop, 0.24, 0.11, colors.wallShade],
        [y + 0.32, shaftTop - 0.18, 0.119, 0.16, colors.cut],
        [shaftTop - 0.36, shaftTop, 0.36, 0.17, colors.cut],
        [y + 0.33, y + 0.62, 0.34, 0.16, colors.carving],
      ]) {
        if (lod === 1 && o > 0.12) continue;
        trimBlock(out, 'wall', w, x - width / 2, x + width / 2, low, top, 0.012, o, tone);
      }
      if (lod > 1 && i % 2 === 0) {
        const center = x + (w.length / n) * 0.5;
        if (center + 0.14 < w.length)
          panel(
            out,
            'trim',
            w,
            center - 0.129,
            center + 0.129,
            y + 1.27,
            y + 1.99,
            0.068,
            colors.dark,
          );
      }
      if (lod === 3)
        for (const offset of [-0.072, 0.072])
          panel(
            out,
            'trim',
            w,
            x + offset - 0.014,
            x + offset + 0.014,
            y + 0.37,
            shaftTop - 0.29,
            0.168,
            colors.edge,
          );
    }
  }
}

function entrance(out, lod) {
  const landing = [
    [-3.16, 7.51],
    [5, 7.51],
    [5.05, 9.55],
    [-2.77, 9.55],
  ];
  cap(out, 'podium', landing, gallery + 0.016, colors.stone);
  for (const [x, z] of [
    [-1.96, 9.28],
    [4.34, 9.28],
    [-3.78, 6.04],
    [4.93, 6.01],
    [-3.93, 2.93],
    [4.92, 2.93],
    [-1.71, 5.73],
    [3.91, 5.73],
    [-1.71, 2.77],
    [3.91, 2.77],
  ]) {
    column(out, x, z, gallery, roofBottom - 0.09, lod, z > 8 ? 1.22 : 1);
  }
  const threshold = plane(1.37, 1);
  panel(
    out,
    'opening',
    threshold,
    -3.7,
    4.7,
    gallery + 0.21,
    roofBottom - 0.27,
    0.007,
    colors.deep,
  );
  panel(
    out,
    'trim',
    threshold,
    0.12,
    2.36,
    gallery + 0.02,
    roofBottom - 0.12,
    0.032,
    colors.carving,
  );
  panel(
    out,
    'opening',
    threshold,
    0.46,
    2.05,
    gallery + 0.08,
    roofBottom - 0.64,
    0.071,
    colors.deep,
  );
  if (lod > 0) {
    for (const [a, b] of [
      [-3.67, -0.98],
      [3.51, 4.83],
    ]) {
      const w = plane(9.17, 1);
      panel(out, 'wall', w, a, b, gallery, gallery + 0.8, 0.04, colors.wallShade);
      panel(
        out,
        'architrave',
        w,
        a - 0.06,
        b + 0.06,
        gallery + 0.63,
        gallery + 0.86,
        0.076,
        colors.cut,
      );
      if (lod > 1)
        for (let x = a + 0.27; x < b - 0.15; x += 0.28)
          panel(
            out,
            'trim',
            w,
            x - 0.034,
            x + 0.034,
            gallery + 0.17,
            gallery + 0.59,
            0.093,
            colors.carving,
          );
    }
    for (const [x, z] of [
      [-1.91, 10.88],
      [4.31, 10.88],
    ])
      figure(out, x, z, floor, lod);
  }
}

function roof(out, lod) {
  const outline = d.outline;
  if (lod === 0) {
    band(out, outline, roofBottom - 0.24, roofBottom + 0.14, 'architrave', colors.cut);
    band(out, profile(outline, -0.13), roofBottom + 0.14, d.roofCap, 'architrave', colors.roof);
    return;
  }
  const low = profile(outline, -0.27),
    high = profile(outline, 0.06);
  band(out, low, roofBottom - 0.33, roofBottom - 0.15, 'architrave', colors.wallShade);
  band(out, outline, roofBottom - 0.15, roofBottom + 0.05, 'architrave', colors.cut);
  band(out, high, roofBottom + 0.05, roofBottom + 0.15, 'architrave', colors.edge);
  band(
    out,
    profile(outline, -0.04),
    roofBottom + 0.15,
    roofBottom + 0.27,
    'architrave',
    colors.carving,
  );
  band(out, profile(outline, -0.18), roofBottom + 0.27, d.roofCap, 'architrave', colors.roof);
  if (lod < 2) return;
  const signed = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, signed),
      n = Math.round(w.length / (lod === 2 ? 0.39 : 0.26));
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) * w.length) / n;
      panel(
        out,
        'trim',
        w,
        x - 0.035,
        x + 0.035,
        roofBottom - 0.07,
        roofBottom + 0.047,
        0.018,
        colors.wallShade,
      );
      if (lod === 3)
        panel(
          out,
          'trim',
          w,
          x - 0.024,
          x + 0.024,
          roofBottom + 0.165,
          roofBottom + 0.247,
          0.017,
          colors.cut,
        );
    }
  }
}

function build(out, lod) {
  layeredPodium(out, lod);
  band(
    out,
    rect(-4.04, 1.35, 5.08, -7.1),
    gallery - 0.12,
    roofBottom - 0.14,
    'wall',
    colors.wallShade,
  );
  for (const region of regions) shrineWall(out, region.outline, region.doorSide, lod);
  entrance(out, lod);
  roof(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'thousand-pillar-temple-model.mjs';
const camera = [-34, 14, 41],
  lookAt = [0, 2.3, -1.2];
export const thousandPillarModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The southern approach and aligned roof outline orient the shrine. The plinth meets the independent site relief.',
  brief:
    'Low Kakatiya granite triple shrine in Hanumakonda with a star-stepped podium, sculpted walls, and an open entrance porch supported by carved columns.',
  surfaces,
  build: closeup,
  camera,
  lookAt,
  sunDirection: [-34, 41, 52],
  limitations: plan.limitations,
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.91,
    basis: 'The standing triple shrine roof outline defines the replacement footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'south-porch-and-stepped-podium', position: [-21, 7.6, 29], lookAt: [0.9, 2.43, 5.6] },
    { name: 'east-shrine-granite-mouldings', position: [24, 8.4, 13], lookAt: [6, 2.8, 2] },
    { name: 'three-shrines-and-south-porch', position: [22, 25, 28], lookAt: [0, 2.5, -0.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'thousand-pillar-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.47, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
};
