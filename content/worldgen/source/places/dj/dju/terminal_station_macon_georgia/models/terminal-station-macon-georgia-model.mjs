import { readFileSync } from 'node:fs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import {
  arch,
  areaSign,
  bands,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  pairs,
  palette,
  panel,
  plane,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const outline = d.outline;
const floor = d.principalFloor;
const cornice = d.facadeHeight;
const facade = plane(14.21, 1);

const tone = palette({
  stone: 'c2b49b',
  pale: 'd4c6ab',
  shadow: '9f937d',
  plinth: 'aaa290',
  roof: '655849',
  raisedRoof: '5a6151',
  flashing: '8a7861',
  brick: '8a6656',
  glazing: '435155',
  door: '524f42',
  frame: '9c8d75',
  bronze: '5f5546',
});
const surfaces = {
  ashlar: surface('wall', 'stone_ashlar', 0.91),
  detail: surface('trim', 'stone_limestone', 0.9),
  ground: surface('foundation', 'concrete_plain', 0.96),
  roof: surface('roof', 'tile_flat', 0.89),
  window: surface('window', 'window_grid', 0.48),
  bronze: surface('trim', 'metal_bronze_cast', 0.8, 0.2),
};

function hippedRoof(out, left, right, rear, front, y, rise, color) {
  const ridgeInset = (front - rear) * 0.32;
  const z = (front + rear) * 0.5;
  const a = [left, y, rear],
    b = [right, y, rear],
    c = [right, y, front],
    f = [left, y, front];
  const p = [left + ridgeInset, y + rise, z],
    q = [right - ridgeInset, y + rise, z];
  for (const side of [
    [a, b, q, p],
    [b, c, q],
    [f, p, q, c],
    [a, p, f],
  ]) {
    face(out, 'roof', side, up, color);
  }
}

function gabledHall(out) {
  const rear = -11.45,
    front = 14.53,
    x = 13.55,
    y = 20.03;
  const ridge = d.centralPedimentHeight;
  const highBack = [0, ridge, rear],
    highFront = [0, ridge, front];
  for (const sign of [-1, 1]) {
    face(
      out,
      'roof',
      [[sign * x, y, rear], highBack, highFront, [sign * x, y, front]],
      up,
      tone.raisedRoof,
    );
  }
  face(out, 'ashlar', [[-x, y, front], [x, y, front], highFront], facade.normal, tone.stone);
  const slope = plane(front + 0.025, 1);
  for (const sign of [-1, 1]) {
    face(
      out,
      'detail',
      [
        [0, ridge + 0.18],
        [sign * (x + 0.15), y],
        [sign * x, y - 0.28],
        [0, ridge - 0.22],
      ].map(([u, v]) => slope.p(u, v)),
      slope.normal,
      tone.pale,
    );
  }
  face(
    out,
    'ashlar',
    [
      [-x, y, rear],
      [0, ridge, rear],
      [x, y, rear],
    ],
    [0, 0, -1],
    tone.stone,
  );
  trimBlock(out, 'detail', slope, -x, x, y - 0.34, y - 0.05, -0.15, 0.16, tone.pale);
  return slope;
}

function stationMassing(out, lod) {
  shell(out, outline, (p) => Math.min(grade(p) - 0.42, -1), floor, {
    wall: 'ground',
    color: tone.plinth,
  });
  shell(out, outline, () => floor - 0.035, cornice, { wall: 'ashlar', color: tone.stone });
  cap(out, 'ashlar', outline, cornice, tone.stone);
  hippedRoof(out, -90.02, 87.62, -27.38, 6.87, cornice, 2.7, tone.roof);
  hippedRoof(out, -42.9, 45.68, -18.65, 14.05, cornice + 0.05, 2.95, tone.raisedRoof);
  block(out, 'ashlar', -13.9, floor, 13.06, 27.8, 20.01 - floor, 1.15, tone.stone);
  gabledHall(out);
  for (const [x, z, h] of [
    [-63.9, -0.2, 4.9],
    [63.3, -12.3, 4.2],
    [32.6, -8.9, 3.35],
  ]) {
    block(out, 'ashlar', x - 0.72, 19.2, z - 0.68, 1.44, h, 1.36, tone.brick);
    if (lod > 0) block(out, 'detail', x - 0.83, 19.14 + h, z - 0.77, 1.66, 0.34, 1.54, tone.shadow);
  }
}

function tallBay(out, w, x, width, y0, y1, lod) {
  opening(
    out,
    w,
    x - width / 2,
    x + width / 2,
    y0,
    y1,
    'detail',
    tone.glazing,
    'window',
    tone.frame,
    lod,
    0.038,
  );
  if (lod < 2) return;
  const h = y1 - y0;
  panel(
    out,
    'bronze',
    w,
    x - width / 2,
    x + width / 2,
    y0 + h * 0.72,
    y0 + h * 0.72 + 0.1,
    0.074,
    tone.bronze,
  );
  for (const delta of lod === 2 ? [-0.19, 0.19] : [-0.24, 0, 0.24]) {
    const u = x + width * delta;
    panel(out, 'bronze', w, u - 0.044, u + 0.044, y0, y1, 0.079, tone.frame);
  }
}

function wreath(out, w, x, y, lod) {
  const n = lod === 3 ? 12 : 8;
  const point = (i, r) => {
    const a = (2 * Math.PI * i) / n;
    return w.p(x + r * Math.cos(a), y + r * Math.sin(a), 0.15);
  };
  for (let i = 0; i < n; i++) {
    face(
      out,
      'detail',
      [point(i, 0.48), point(i + 1, 0.48), point(i + 1, 0.61), point(i, 0.61)],
      w.normal,
      i % 2 ? tone.shadow : tone.pale,
    );
  }
}

function wallBays(out, lod) {
  const wallEdges = pairs(closed(outline));
  const sign = areaSign(outline);
  for (const [index, [a, b]] of wallEdges.entries()) {
    const w = edge(a, b, sign),
      length = w.length;
    const street = w.normal[2] > 0.8;
    const centralSection = index === 5;
    bands(
      out,
      w,
      0,
      length,
      [
        [0.5, 1.0],
        [10.74, 11.08],
        [11.23, 11.64],
        [16.9, 17.64],
      ],
      'detail',
      tone.pale,
      0.085,
    );
    if (lod > 1) {
      bands(
        out,
        w,
        0,
        length,
        [
          [1.16, 1.26],
          [5.91, 6.1],
          [10.96, 11.08],
          [12.06, 12.21],
          [16.44, 16.55],
        ],
        'detail',
        tone.shadow,
        0.098,
      );
    }
    if (length < 10) continue;
    const count = Math.max(2, Math.round(length / (street ? 8.83 : 9.5)));
    const spacing = length / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * spacing;
      const x = mix(a[0], b[0], u / length);
      if (centralSection && Math.abs(x) < 16.6) continue;
      const width = Math.min(3.5, spacing * 0.51);
      tallBay(out, w, u, width, 1.67, 5.77, lod);
      if (lod > 0) {
        tallBay(out, w, u, width * 0.78, 7.04, 10.05, lod);
        tallBay(out, w, u - spacing * 0.18, width * 0.48, 12.37, 15.4, lod);
        tallBay(out, w, u + spacing * 0.18, width * 0.48, 12.37, 15.4, lod);
      }
      if (lod > 1 && street) {
        const pier = Math.min(length, u + spacing / 2 - 0.18);
        trimBlock(out, 'detail', w, pier - 0.47, pier + 0.47, 1.04, 10.76, 0.09, 0.39, tone.pale);
        trimBlock(out, 'detail', w, pier - 0.68, pier + 0.68, 10.22, 10.99, 0.09, 0.51, tone.pale);
        if (lod === 3 && i % 2 === 0) wreath(out, w, pier, 13.91, lod);
      }
    }
  }
}

function clock(out, w, lod) {
  const points = Array.from({ length: lod === 3 ? 16 : 10 }, (_, i) => {
    const n = lod === 3 ? 16 : 10,
      t = (2 * Math.PI * i) / n;
    return w.p(0.61 * Math.cos(t), 12.33 + 0.61 * Math.sin(t), 0.205);
  });
  face(out, 'bronze', points, w.normal, tone.flashing);
  panel(out, 'detail', w, -0.035, 0.035, 12.32, 12.7, 0.223, tone.pale);
  face(
    out,
    'detail',
    [
      [0, 12.36],
      [-0.33, 12.52],
      [-0.35, 12.46],
      [0, 12.29],
    ].map(([x, y]) => w.p(x, y, 0.225)),
    w.normal,
    tone.pale,
  );
}

function pedimentEagles(out, w) {
  for (const side of [-1, 1]) {
    const x = side * 9.18,
      y = 17.08;
    const pt = ([u, v]) => w.p(x + u, y + v, 0.275);
    const head = [
      [0, 1.56],
      [0.39, 1.45],
      [0.51, 1.19],
      [0.17, 1.16],
      [0.11, 0.64],
      [-0.19, 0.65],
      [-0.25, 1.26],
    ];
    const plumes = [
      [0.07, 1.03],
      [0.31, 1.3],
      [0.61, 1.66],
      [0.93, 1.48],
      [0.69, 1.02],
      [0.22, 0.6],
    ];
    face(out, 'detail', head.map(pt), w.normal, tone.pale);
    for (const sign of [-1, 1]) {
      face(
        out,
        'detail',
        plumes.map(([u, v]) => pt([u * sign, v])),
        w.normal,
        tone.pale,
      );
    }
    trimBlock(out, 'detail', w, x - 0.54, x + 0.54, y + 0.43, y + 0.6, 0.17, 0.29, tone.pale);
  }
}

function entryFront(out, lod) {
  const w = facade,
    rx = d.centralArchHalfWidth,
    spring = 10.16,
    ry = 4.45;
  const gables = plane(14.58, 1);
  arch(
    out,
    w,
    0,
    3.6,
    spring,
    rx,
    ry,
    0.095,
    lod,
    { width: 0.52, trim: tone.pale, inner: tone.glazing },
    { inner: 'window', trim: 'detail' },
  );
  arch(
    out,
    gables,
    0,
    20.12,
    20.185,
    4.18,
    2.22,
    0.024,
    lod,
    { width: 0.2, trim: tone.shadow, inner: tone.glazing },
    { inner: 'window', trim: 'detail' },
  );
  bands(
    out,
    w,
    -13.9,
    13.9,
    [
      [15.57, 16.27],
      [16.67, 17.12],
      [19.47, 19.98],
    ],
    'detail',
    tone.pale,
    0.29,
  );
  trimBlock(out, 'detail', w, -14.08, 14.08, 0.79, 1.29, 0.02, 0.31, tone.plinth);
  panel(out, 'bronze', w, -4.23, 4.23, 0.97, 3.67, 0.106, tone.door);
  for (const sign of [-1, 1]) {
    for (const x of [sign * 6.8, sign * 11.82]) {
      trimBlock(out, 'detail', w, x - 0.47, x + 0.47, 1.21, 15.64, 0.12, 0.58, tone.pale);
      trimBlock(out, 'detail', w, x - 0.74, x + 0.74, 14.72, 15.8, 0.13, 0.68, tone.pale);
      trimBlock(out, 'detail', w, x - 0.7, x + 0.7, 1.17, 2.37, 0.13, 0.61, tone.shadow);
    }
    tallBay(out, w, sign * 9.4, 1.7, 1.42, 4.78, lod);
  }
  if (lod === 0) return;
  const columns = lod === 1 ? [-2.4, 0, 2.4] : [-3.27, -2.17, -1.09, 0, 1.09, 2.17, 3.27];
  for (const x of columns) {
    const y = spring + ry * Math.sqrt(1 - Math.pow(x / rx, 2)) - 0.07;
    panel(out, 'bronze', w, x - 0.056, x + 0.056, 3.68, y, 0.145, tone.frame);
  }
  for (const y of [5.53, 7.9, 10.11, 12.0]) {
    const dx = y > spring ? rx * Math.sqrt(1 - Math.pow((y - spring) / ry, 2)) - 0.05 : rx - 0.05;
    panel(out, 'bronze', w, -dx, dx, y, y + 0.095, 0.147, tone.frame);
  }
  for (const x of [-3.22, -1.61, 0, 1.61, 3.22]) {
    panel(out, 'detail', w, x - 0.062, x + 0.062, 1.03, 3.65, 0.152, tone.frame);
  }
  for (const [label, y, width] of [
    ['TERMINAL', 18.44, 8.44],
    ['STATION', 17.24, 7.21],
  ]) {
    lettering(out, label, {
      width,
      height: 0.85,
      y,
      z: 14.42,
      stroke: 0.105,
      color: tone.bronze,
      slot: 'bronze',
    });
  }
  if (lod < 2) return;
  clock(out, w, lod);
  pedimentEagles(out, w);
  for (const x of [-3.08, -2.05, -1.02, 0, 1.02, 2.05, 3.08]) {
    const y = 20.185 + 2.22 * Math.sqrt(1 - Math.pow(x / 4.18, 2)) - 0.03;
    panel(out, 'bronze', gables, x - 0.04, x + 0.04, 20.16, y, 0.061, tone.frame);
  }
  if (lod === 3) {
    for (const x of [-3.45, -1.72, 1.72, 3.45]) {
      panel(out, 'bronze', w, x - 0.04, x + 0.04, 1.18, 3.42, 0.19, tone.pale);
    }
  }
}

function build(out, lod) {
  stationMassing(out, lod);
  wallBays(out, lod);
  entryFront(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'terminal-station-macon-georgia-model.mjs';
const camera = [91, 43, 197],
  lookAt = [0, 9, 1];
export const terminalStationModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'transport',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The Cherry Street forecourt supplies the independent geographic height datum. The plinth extends down to the original terrain.',
  brief:
    'The 1916 Macon Terminal Station, with its three-story Beaux-Arts wings, central arched window and lettered stone pediment at the foot of Cherry Street.',
  camera,
  lookAt,
  sunDirection: [-45, 59, 66],
  mediumFiContext: {
    scale: 1,
    groundY: -0.16,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis:
      'Suppresses ordinary generated massing within the exact named OpenStreetMap station outline.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'stadium-lettering.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'cherry-street-station-front', position: [0, 28, 168], lookAt: [0, 9, 5] },
    { name: 'arched-entrance-and-pediment', position: [12, 8.0, 44], lookAt: [0, 12, 14] },
    { name: 'limestone-wings-and-low-roofs', position: [-135, 34, 105], lookAt: [-10, 8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'terminal-station-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Reference scans are public domain in the United States by the Digital Library of Georgia archive determination. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};
