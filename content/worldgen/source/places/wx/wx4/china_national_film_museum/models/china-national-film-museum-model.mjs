import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  plane,
  shell,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  charcoal: '484d50',
  side: '41464b',
  seam: '555b5e',
  cut: '30373d',
  returnA: '343c43',
  returnB: '252c31',
  glazing: '687478',
  rose: '875659',
  mutedRose: '705157',
  mullion: '373e42',
  roof: '555a5d',
  mechanical: '65696a',
  silver: 'b3b9b7',
  paving: '908477',
  border: '77736d',
  screen: '575b60',
});
const surfaces = {
  cladding: surface('wall', 'metal_painted', 0.71, 0.32),
  folded: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.69, metallic: 0.28 },
  roof: surface('roof', 'membrane', 0.86),
  trim: surface('trim', 'metal_painted', 0.68, 0.36),
  seam: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.36, metallic: 0.14 },
  doors: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.54, metallic: 0.2 },
  paving: surface('foundation', 'stone_ashlar', 0.92),
};

function filled(out, slot, polygon, position, color) {
  const indices = earcut(polygon.flat());
  for (let i = 0; i < indices.length; i += 3) {
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => position(polygon[j])),
      [0, 0, 1],
      color,
    );
  }
}

function clippedRuns(polygon, sample, axis) {
  const other = 1 - axis;
  const hits = [];
  for (const [a, b] of pairs(closed(polygon))) {
    const low = Math.min(a[axis], b[axis]);
    const high = Math.max(a[axis], b[axis]);
    if (low <= sample && sample < high) {
      hits.push(mix(a[other], b[other], (sample - a[axis]) / (b[axis] - a[axis])));
    }
  }
  hits.sort((a, b) => a - b);
  return hits.flatMap((start, i) =>
    i % 2 === 0 && hits[i + 1] - start > 0.11 ? [[start, hits[i + 1]]] : [],
  );
}

const facade = plane(d.wallFront, 1);
const portalRecess = 4.9;
const innerPortal = d.opening.map(([x, y], i) => [
  x + [3.9, 7.1, 2.2, 1.6, -0.8, -6.5, -2.1, -3.2][i],
  y + [0, 0.7, -1.0, -2.1, -0.9, -3.5, 0.4, 0][i],
]);
const portalPane = ([x, y]) => facade.p(x, y, -portalRecess);
const apertureRim = ([x, y]) => facade.p(x, y);

function clipVertical(polygon, x, direction) {
  if (!polygon.length) return polygon;
  const clipped = [];
  for (const [a, b] of pairs(closed(polygon))) {
    const aInside = (a[0] - x) * direction >= 0;
    const bInside = (b[0] - x) * direction >= 0;
    if (aInside) clipped.push(a);
    if (aInside !== bInside) clipped.push([x, mix(a[1], b[1], (x - a[0]) / (b[0] - a[0]))]);
  }
  return clipped;
}

function glazing(out, level) {
  const panes = earcut(innerPortal.flat());
  const tones = [
    [-110, -83, colors.mutedRose],
    [-83, -77, colors.glazing],
    [-77, -64, colors.rose],
    [-64, -56, colors.mutedRose],
    [-56, -49, colors.glazing],
    [-49, -10, colors.rose],
  ];
  for (let i = 0; i < panes.length; i += 3) {
    const triangle = panes.slice(i, i + 3).map((key) => innerPortal[key]);
    for (const [left, right, color] of tones) {
      const band = clipVertical(clipVertical(triangle, left, 1), right, -1);
      if (band.length >= 3) {
        filled(out, 'glass', band, portalPane, color);
      }
    }
  }
  const tint = [
    colors.cut,
    colors.returnA,
    colors.returnB,
    colors.returnA,
    colors.cut,
    colors.returnA,
    colors.returnB,
  ];
  for (let i = 0; i < d.opening.length - 1; i++) {
    const ring = [
      apertureRim(d.opening[i]),
      apertureRim(d.opening[i + 1]),
      portalPane(innerPortal[i + 1]),
      portalPane(innerPortal[i]),
    ];
    for (const ids of [
      [0, 1, 2],
      [0, 2, 3],
    ]) {
      face(
        out,
        'folded',
        ids.map((j) => ring[j]),
        [0, 0, 1],
        tint[i],
      );
    }
  }
  panel(out, 'folded', facade, -76.8, -44, 2.85, 3.48, -portalRecess + 0.18, colors.cut);
  panel(out, 'doors', facade, -75.7, -45, 0.38, 2.85, -portalRecess + 0.16, colors.glazing);
  if (level >= 1) {
    const step = [0, 8.2, 4.1, 2.15][level];
    for (let x = -90; x < -20; x += step) {
      for (const [a, b] of clippedRuns(innerPortal, x, 0)) {
        if (b <= 3.55) continue;
        beam(
          out,
          'trim',
          facade.p(x, Math.max(a, 3.48), -portalRecess + 0.044),
          facade.p(x, b, -portalRecess + 0.044),
          0.072,
          0.084,
          colors.mullion,
        );
      }
    }
    for (let y = 3.51; y < 23; y += step * 0.54) {
      for (const [a, b] of clippedRuns(innerPortal, y, 1)) {
        beam(
          out,
          'trim',
          facade.p(a, y, -portalRecess + 0.048),
          facade.p(b, y, -portalRecess + 0.048),
          0.052,
          0.061,
          colors.mullion,
        );
      }
    }
    const leaves = level === 1 ? 5 : 11;
    for (let k = 0; k <= leaves; k++) {
      const x = mix(-75.7, -45, k / leaves);
      beam(
        out,
        'trim',
        facade.p(x, 0.4, -portalRecess + 0.21),
        facade.p(x, 2.85, -portalRecess + 0.21),
        0.09,
        0.07,
        colors.silver,
      );
    }
  }
}

// Single-stroke outlines for the seven characters on the public façade.
const inscription = [
  [
    [0.14, 0.27, 0.14, 0.75, 0.86, 0.75, 0.86, 0.27, 0.14, 0.27],
    [0.5, 0.05, 0.5, 0.95],
  ],
  [
    [0.09, 0.09, 0.09, 0.91, 0.91, 0.91, 0.91, 0.09, 0.09, 0.09],
    [0.26, 0.73, 0.75, 0.73],
    [0.31, 0.55, 0.7, 0.55],
    [0.24, 0.3, 0.78, 0.3],
    [0.5, 0.73, 0.5, 0.3],
    [0.61, 0.48, 0.7, 0.39],
  ],
  [
    [0.14, 0.35, 0.14, 0.79, 0.76, 0.79, 0.76, 0.35, 0.14, 0.35],
    [0.14, 0.58, 0.76, 0.58],
    [0.44, 0.92, 0.44, 0.17, 0.51, 0.1, 0.84, 0.1, 0.91, 0.23],
  ],
  [
    [0.12, 0.61, 0.12, 0.91, 0.56, 0.91, 0.56, 0.61, 0.12, 0.61],
    [0.12, 0.76, 0.56, 0.76],
    [0.34, 0.61, 0.34, 0.49],
    [0.05, 0.48, 0.64, 0.48],
    [0.14, 0.4, 0.56, 0.4, 0.56, 0.25, 0.14, 0.25, 0.14, 0.4],
    [0.34, 0.25, 0.34, 0.09, 0.24, 0.09],
    [0.22, 0.2, 0.1, 0.09],
    [0.46, 0.2, 0.57, 0.1],
    [0.87, 0.89, 0.66, 0.69],
    [0.91, 0.66, 0.7, 0.47],
    [0.93, 0.42, 0.68, 0.15],
  ],
  [
    [0.05, 0.65, 0.33, 0.65],
    [0.19, 0.93, 0.19, 0.06],
    [0.34, 0.77, 0.91, 0.77],
    [0.58, 0.91, 0.58, 0.3],
    [0.75, 0.9, 0.86, 0.82],
    [0.39, 0.68, 0.39, 0.34],
    [0.39, 0.68, 0.84, 0.68, 0.84, 0.35],
    [0.39, 0.56, 0.84, 0.56],
    [0.39, 0.45, 0.84, 0.45],
    [0.31, 0.27, 0.9, 0.27],
    [0.7, 0.36, 0.7, 0.08, 0.59, 0.08],
    [0.44, 0.22, 0.54, 0.11],
  ],
  [
    [0.14, 0.89, 0.08, 0.52],
    [0.1, 0.73, 0.37, 0.73],
    [0.29, 0.94, 0.29, 0.06],
    [0.06, 0.42, 0.41, 0.56],
    [0.55, 0.94, 0.44, 0.55],
    [0.48, 0.77, 0.92, 0.77, 0.87, 0.21, 0.83, 0.11, 0.67, 0.11],
    [0.65, 0.76, 0.58, 0.46, 0.46, 0.3],
    [0.8, 0.76, 0.72, 0.44, 0.55, 0.15],
  ],
  [
    [0.19, 0.93, 0.07, 0.65, 0.25, 0.65],
    [0.16, 0.54, 0.16, 0.1, 0.36, 0.24],
    [0.52, 0.67, 0.52, 0.84, 0.91, 0.84, 0.91, 0.67],
    [0.7, 0.94, 0.75, 0.85],
    [0.62, 0.72, 0.62, 0.09],
    [0.62, 0.71, 0.84, 0.71, 0.84, 0.51, 0.62, 0.51],
    [0.62, 0.4, 0.89, 0.4, 0.89, 0.13, 0.62, 0.13],
  ],
];

function sign(out) {
  for (const [i, glyph] of inscription.entries()) {
    const x = -95.7 + i * 10.92;
    for (const stroke of glyph) {
      const points = [];
      for (let k = 0; k < stroke.length; k += 2) {
        points.push(facade.p(x + 3.55 * stroke[k], 26.72 + 2.47 * stroke[k + 1], 0.072));
      }
      for (const [a, b] of pairs(points)) {
        beam(out, 'seam', a, b, 0.41, 0.15, colors.silver);
      }
    }
  }
}

function entry(out, level) {
  const [left, right] = [d.outline[7][0], d.outline[6][0]];
  const a = d.opening[0],
    b = d.opening.at(-1);
  const y = d.facadeHeight;
  const front = [
    [left, -1.6],
    [a[0], -1.6],
    ...d.opening,
    [b[0], -1.6],
    [right, -1.6],
    [right, y],
    [left, y],
  ];
  filled(out, 'cladding', front, apertureRim, colors.charcoal);
  panel(out, 'folded', facade, a[0], b[0], -1.2, a[1], -portalRecess, colors.cut);
  glazing(out, level);
  panel(out, 'trim', facade, left, right, y - 0.21, y, 0.031, colors.side);
  if (level >= 2) {
    sign(out);
    const spacing = level === 2 ? 4.25 : 2.08;
    for (let h = spacing; h < 26; h += spacing * 0.67) {
      for (const [lo, hi] of clippedRuns(front, h, 1)) {
        panel(out, 'seam', facade, lo, hi, h, h + 0.021, 0.017, colors.seam);
      }
    }
    for (let x = left + spacing; x < right; x += spacing) {
      for (const [lo, hi] of clippedRuns(front, x, 0)) {
        beam(
          out,
          'seam',
          facade.p(x, Math.max(0, lo), 0.019),
          facade.p(x, hi, 0.019),
          0.026,
          0.021,
          colors.seam,
        );
      }
    }
  }
}

function building(out, level) {
  const style = { wall: 'cladding', roof: 'roof', color: colors.side, roofColor: colors.roof };
  shell(
    out,
    d.outline,
    ([x, z]) => Math.min(-1.6, grade([x, z]) - 0.33),
    d.topDeck,
    style,
    (i) => i !== d.facadeEdge,
  );
  const sign = areaSign(d.outline);
  for (const [[a, b], i] of pairs(closed(d.outline)).map((pair, i) => [pair, i])) {
    if (i === d.facadeEdge) continue;
    const w = edge(a, b, sign);
    panel(out, 'trim', w, 0, w.length, d.topDeck - 0.07, d.facadeHeight, 0.013, colors.side);
    if (level >= 1) {
      for (const y of level > 1 ? [1.25, 6.4, 12.1, 18, 24.2] : [1.25, 11.9, 22.9]) {
        panel(out, 'seam', w, 0, w.length, y, y + 0.057, 0.017, colors.seam);
      }
    }
    if (level >= 2 && (i === 0 || i === 1 || i === 3 || i === 7)) {
      for (let x = 6; x + 3.15 < w.length; x += 8.1) {
        panel(out, 'glass', w, x, x + 3.15, 4.1, 5.05, 0.028, colors.mullion);
      }
    }
  }
  block(out, 'roof', -82, d.topDeck, -32, 42, 1.35, 16, colors.mechanical);
  block(out, 'roof', -23, d.topDeck, -41, 30, 1.15, 9, colors.mechanical);
  if (level >= 2) {
    for (let i = 0; i < 7; i++) {
      block(out, 'trim', -77 + i * 5.12, d.topDeck + 1.35, -28, 2.8, 0.23, 3.6, colors.side);
    }
  }
  entry(out, level);
}

function plaza(out, level) {
  for (const { outline, height } of d.forecourt) {
    const [x, z] = outline.reduce(([x, z], p) => [x + p[0] / 4, z + p[1] / 4], [0, 0]);
    const datum = grade([x, z]);
    const ys = [height * 0.74, height * 0.74, height, height].map((h) => h + datum);
    const points = outline.map(([x, z], i) => [x, ys[i], z]);
    const order = areaSign(outline);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      const a = outline[j],
        b = outline[k];
      const w = edge(a, b, order);
      face(
        out,
        'cladding',
        [[a[0], grade(a) - 0.17, a[1]], [b[0], grade(b) - 0.17, b[1]], points[k], points[j]],
        w.normal,
        colors.charcoal,
      );
    }
    face(out, 'trim', points, [0, 1, 0], colors.seam);
  }
  const screenLeft = -3,
    screenRight = 42,
    screenZ = 89;
  const screen = plane(screenZ, -1);
  const base = grade([19, screenZ]);
  block(
    out,
    'cladding',
    screenLeft,
    base - 0.4,
    screenZ,
    screenRight - screenLeft,
    12.0,
    1.8,
    colors.charcoal,
  );
  panel(
    out,
    'folded',
    screen,
    screenLeft + 1.5,
    screenRight - 1.5,
    base + 1.25,
    base + 10.4,
    0.035,
    colors.screen,
  );
  const front = d.wallFront;
  const start = level === 0 ? 1 : level === 1 ? 3 : 5;
  for (let i = 0; i < start; i++) {
    const z0 = mix(front - 4.6, front + 20, i / start);
    const z1 = mix(front - 4.6, front + 20, (i + 1) / start);
    const apron = [
      [-109, z0],
      [11, z0],
      [11, z1],
      [-109, z1],
    ];
    face(
      out,
      'paving',
      apron.map(([x, z]) => [x, grade([x, z]) + 0.105, z]),
      [0, 1, 0],
      i % 2 === 0 ? colors.paving : colors.border,
    );
  }
}

function build(out, level) {
  plaza(out, level);
  building(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'china-national-film-museum-model.mjs';
const camera = [112, 67, 175],
  lookAt = [-30, 9, 8];
const errors = { district: 0.49, street: 0.16, closeup: 0.06 };
export const chinaNationalFilmMuseumAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  category: 'museum-library',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'NW entrance and stepped southwest flank follow the named museum outline. Use the original public plaza grade for the metal pavilions and glass doors.',
  brief:
    'China National Film Museum with its black metal origami façade, recessed rose glazing, pale Chinese inscription and clapperboard forecourt.',
  camera,
  lookAt,
  sunDirection: [20, 115, 145],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Named native outline of the China National Film Museum.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'membrane', 'stone_ashlar'],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'folded-metal-entry', position: [-61, 10.5, 110], lookAt: [-61, 12.5, 19.4] },
    {
      name: 'recessed-glazing-and-inscription',
      position: [-33, 8.6, 70],
      lookAt: [-59, 13.8, 18.5],
    },
    { name: 'clapperboard-walls-and-plaza', position: [83, 54, 127], lookAt: [-31, 10, 38] },
    { name: 'angular-side-and-back', position: [120, 48, -114], lookAt: [-21, 10, -17] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'china-national-film-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.99,
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
    'Original mesh under repository license. Geographic vectors © OpenStreetMap contributors and Overture Maps Foundation, ODbL 1.0.',
};
