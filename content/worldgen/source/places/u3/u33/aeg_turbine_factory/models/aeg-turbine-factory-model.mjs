import fs from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const site = JSON.parse(
  fs.readFileSync(new URL('../native-map/aeg-turbine-site-controls.json', import.meta.url)),
);
const {
  foundation,
  historicMainRoofY,
  historicMainEaveY,
  rearWingRoofEstimate,
  westAisleRoofEstimate,
} = plan.dimensions;
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.95 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.13 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73, metallic: 0.12 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.92 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  inscription: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const stone = rgb('a69577');
const stoneLight = rgb('b4a283');
const base = rgb('999487');
const steel = rgb('66705c');
const grid = rgb('697365');
const roofColor = rgb('7c8178');
const brick = rgb('876e5c');
const glaze = ['58635e', '5e6763', '616b65', '556360', '626a63', '5b635f'].map(rgb);
const centerX = 6.39;
const west = -7.0;
const east = 19.786;
const front = 123.09;
const join = -3.146;
const rear = -122.9;
const eave = historicMainEaveY;

function box(out, slot, [x0, z0, x1, z1], floor, top, tint) {
  abox(out, slot, [x0, floor, z0], [x1, top, z1], tint, { bottom: false });
}

function panel(out, slot, a, b, c, d, color, flip = false) {
  if (flip) quad4(out, slot, d, c, b, a, color);
  else quad4(out, slot, a, b, c, d, color);
}

function floorPlate(out) {
  const ring = frame.geometry.outline;
  extrude(out, 'base', ring, foundation, 0.93, base, { top: false });
  const ids = earcut(ring.flat(), [], 2);
  const pts = ring.map(([x, z]) => [x, 0.93, z]);
  for (let i = 0; i < ids.length; i += 3)
    tri(out, 'base', pts[ids[i]], pts[ids[i + 2]], pts[ids[i + 1]], base);
}

const profile = (x0, x1, y0, yMax) => {
  const span = x1 - x0;
  const rise = yMax - y0;
  return [
    [x0, y0],
    [x0 + span * 0.12, y0 + rise * 0.53],
    [x0 + span * 0.31, y0 + rise * 0.83],
    [x0 + span * 0.5, yMax],
    [x0 + span * 0.69, y0 + rise * 0.83],
    [x0 + span * 0.88, y0 + rise * 0.53],
    [x1, y0],
  ];
};

function roof(out, x0, x1, z0, z1, eave, crest, lod) {
  const shape = profile(x0, x1, eave, crest);
  const frontRim = shape.map(([x, y]) => [x, y, z1]);
  const backRim = shape.map(([x, y]) => [x, y, z0]);
  for (let i = 1; i < shape.length; i++) {
    quad4(out, 'roof', backRim[i - 1], frontRim[i - 1], frontRim[i], backRim[i], roofColor);
    if (lod >= 2)
      beam(
        out,
        'steel',
        [shape[i][0], shape[i][1] + 0.041, z0],
        [shape[i][0], shape[i][1] + 0.041, z1],
        0.082,
        0.078,
        steel,
      );
  }
  beamPath(out, 'steel', frontRim, 0.19, 0.24, steel);
  if (lod >= 1) beamPath(out, 'steel', backRim, 0.19, 0.24, steel);
}

function glassGrid(out, p, width, height, cols, rows, flip, materialOffset, lod) {
  const bays = lod === 0 ? 1 : cols;
  const courses = lod <= 1 ? 1 : rows;
  for (let j = 0; j < courses; j++) {
    for (let i = 0; i < bays; i++) {
      const a = (width * i) / bays,
        b = (width * (i + 1)) / bays;
      const c = (height * j) / courses,
        d = (height * (j + 1)) / courses;
      panel(
        out,
        'pane',
        p(a, c, 0),
        p(b, c, 0),
        p(b, d, 0),
        p(a, d, 0),
        glaze[(Math.floor(i / 3) + j + materialOffset) % glaze.length],
        flip,
      );
    }
  }
  if (lod === 0) return;
  for (let i = 0; i <= bays; i++) {
    const u = (i * width) / bays;
    const w = i === 0 || i === bays ? 0.098 : 0.055;
    panel(
      out,
      'steel',
      p(u - w, 0, 0.026),
      p(u + w, 0, 0.026),
      p(u + w, height, 0.026),
      p(u - w, height, 0.026),
      grid,
      flip,
    );
  }
  for (let j = 0; j <= courses; j++) {
    const y = (j * height) / courses;
    const h = j % 3 === 0 ? 0.094 : 0.049;
    panel(
      out,
      'steel',
      p(0, y - h, 0.029),
      p(width, y - h, 0.029),
      p(width, y + h, 0.029),
      p(0, y + h, 0.029),
      grid,
      flip,
    );
  }
}

function longFacade(out, start, end, x, wallTop, count, lod, legacy = false) {
  const pitch = (end - start) / count;
  const inset = legacy ? 0.88 : 0.35;
  const paneBottom = 2.04;
  const paneTop = wallTop - 0.54;
  const cap = legacy ? steel : roofColor;
  box(out, 'concrete', [x - 0.45, start, x + 0.054, end], 0.65, paneBottom, stone);
  box(
    out,
    'steel',
    [x - 0.91, start - 0.16, x + 0.38, end + 0.16],
    wallTop - 0.52,
    wallTop + 0.07,
    cap,
  );
  for (let i = 0; i < count; i++) {
    const z = end - pitch * i;
    const pane = (u, v, d) => [
      x - (inset * v) / (paneTop - paneBottom) + d,
      paneBottom + v,
      z - 0.2 - u,
    ];
    glassGrid(
      out,
      pane,
      pitch - 0.37,
      paneTop - paneBottom,
      [1, 3, 6, 10][lod],
      [1, 1, 4, 9][lod],
      false,
      i,
      lod,
    );
    const stairTop = x - inset + 0.055;
    beam(
      out,
      'steel',
      [x + 0.105, 0.89, z],
      [stairTop, wallTop - 0.08, z],
      legacy ? 0.43 : 0.34,
      0.47,
      steel,
    );
    if (lod >= 2) {
      box(out, 'trim', [x - 0.32, z - 0.39, x + 0.28, z + 0.37], 0.89, 1.47, base);
    }
  }
  beam(
    out,
    'steel',
    [x + 0.06, 0.92, start],
    [x - inset + 0.04, wallTop, start],
    0.39,
    0.43,
    steel,
  );
}

function concreteCorner(out, left, lod) {
  const x = left ? west : east;
  const s = left ? 1 : -1;
  const start = front - 4.96;
  const rim = [
    [x, start],
    [x, front - 1.42],
    [x + s * 0.21, front - 0.37],
    [x + s * 0.58, front + 0.005],
    [x + s * 1.06, front + 0.12],
    [x + s * 3.56, front + 0.12],
    [x + s * 3.56, start],
  ];
  const n = [1, 4, 8, 11][lod];
  for (let i = 0; i < n; i++) {
    const y = 0.91 + ((eave - 0.91) * i) / n;
    const top = 0.91 + ((eave - 0.91) * (i + 1)) / n - 0.034;
    extrude(out, 'concrete', rim, y, top, i % 3 === 0 ? stoneLight : stone, { top: false });
    if (lod >= 2 && i < n - 1)
      extrude(
        out,
        'trim',
        rim.map(([x, z]) => [x + s * 0.035, z - 0.062]),
        top,
        top + 0.035,
        base,
        { top: false },
      );
  }
}

const lettering = {
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.15],
      [0.22, 0],
      [0.78, 0],
      [1, 0.15],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.78, 1],
      [1, 0.84],
      [1, 0.65],
      [0.78, 0.53],
      [0, 0.53],
    ],
    [
      [0.56, 0.53],
      [1, 0],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
      [0.74, 1],
      [1, 0.82],
      [0.82, 0.54],
      [0, 0.54],
    ],
    [
      [0.82, 0.54],
      [1, 0.31],
      [0.87, 0.07],
      [0.68, 0],
      [0, 0],
    ],
  ],
  I: [
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.53],
      [0.8, 0.53],
    ],
  ],
  F: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
    ],
    [
      [0, 0.53],
      [0.8, 0.53],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.5, 1],
      [1, 0],
    ],
    [
      [0.22, 0.43],
      [0.78, 0.43],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.99, 1],
      [0, 0.44],
      [1, 0],
    ],
  ],
  G: [
    [
      [1, 0.84],
      [0.78, 1],
      [0.22, 1],
      [0, 0.78],
      [0, 0.22],
      [0.22, 0],
      [0.83, 0],
      [1, 0.17],
      [1, 0.48],
      [0.58, 0.48],
    ],
  ],
};

function label(out, word, y, scale, z) {
  const span = word.length * 1.28 * scale;
  for (const [i, letter] of [...word].entries())
    for (const line of lettering[letter]) {
      beamPath(
        out,
        'inscription',
        line.map(([x, v]) => [centerX - span / 2 + (i * 1.28 + x) * scale, y + v * scale, z]),
        scale * 0.076,
        scale * 0.052,
        stoneLight,
      );
    }
}

function southFacade(out, lod) {
  concreteCorner(out, true, lod);
  concreteCorner(out, false, lod);
  const width = east - west - 7.12;
  const p = (u, v, d) => [west + 3.56 + u, 1.97 + v, front - 0.25 + d];
  glassGrid(out, p, width, eave - 2.18, [1, 8, 15, 26][lod], [1, 1, 6, 13][lod], false, 0, lod);
  box(out, 'base', [west + 3.54, front - 0.64, east - 3.54, front - 0.16], 0.83, 2.01, base);
  const outline = profile(west - 0.43, east + 0.42, eave, historicMainRoofY);
  const points = outline.map(([x, y]) => [x, y, front + 0.38]);
  const anchor = [centerX, eave + 0.005, front + 0.38];
  for (let i = 1; i < points.length; i++) {
    tri(out, 'concrete', anchor, points[i], points[i - 1], stone);
  }
  beam(
    out,
    'steel',
    [west - 0.65, eave, front + 0.44],
    [east + 0.65, eave, front + 0.44],
    0.22,
    0.42,
    steel,
  );
  if (lod >= 2) {
    label(out, 'TURBINENFABRIK', 19.98, 0.86, front + 0.402);
    label(out, 'AEG', 22.11, 0.81, front + 0.408);
    const clip = [
      [centerX - 2.03, 22.47],
      [centerX - 1.0, 21.1],
      [centerX + 1.0, 21.1],
      [centerX + 2.03, 22.47],
      [centerX + 1.0, 23.83],
      [centerX - 1.0, 23.83],
    ];
    beamPath(
      out,
      'inscription',
      clip.map(([x, y]) => [x, y, front + 0.43]),
      0.086,
      0.07,
      stoneLight,
      true,
    );
  }
}

function westAisle(out, lod) {
  const x = -19.7;
  const end = site.serviceLocal[2][1];
  const bounds = [x, rear, -6.95, end];
  const top = westAisleRoofEstimate;
  box(out, 'brick', bounds, 0.82, top, brick);
  box(out, 'roof', [x - 0.21, rear - 0.02, -6.72, end + 0.17], top - 0.35, top + 0.18, roofColor);
  if (lod === 0) return;
  const length = end - rear;
  const side = facade([x, rear], [0, 1]);
  const bays = Math.round(length / 7.9);
  for (let i = 0; i < bays; i++) {
    const u = ((i + 0.5) * length) / bays;
    const span = lod === 1 ? 3.65 : 3.3;
    for (const [floor, head] of [
      [2.02, 4.28],
      [6.11, 9.72],
    ]) {
      fbox(
        out,
        'pane',
        side,
        u - span / 2,
        u + span / 2,
        floor,
        head,
        0.005,
        0.012,
        glaze[i % glaze.length],
      );
      if (lod >= 2)
        for (const dx of [-1.15, 0, 1.15])
          fbox(out, 'steel', side, u + dx - 0.049, u + dx + 0.049, floor, head, 0.012, 0.042, grid);
    }
    if (lod >= 2)
      fbox(
        out,
        'trim',
        side,
        u - span / 2 - 0.18,
        u + span / 2 + 0.18,
        5.91,
        6.11,
        0.008,
        0.14,
        base,
      );
  }
}

function northExtension(out, lod) {
  const y = rearWingRoofEstimate;
  const nextEave = 17.49;
  roof(out, west - 0.23, east + 0.21, rear - 0.18, join + 0.19, nextEave, y, lod);
  longFacade(out, rear, join, east, nextEave, lod === 0 ? 5 : 14, lod, false);
  box(out, 'brick', [west - 0.04, rear - 0.08, east + 0.05, rear + 0.33], 0.92, nextEave, brick);
  const f = facade([centerX, rear - 0.082], [-1, 0]);
  if (lod >= 1) {
    for (const z of [-9.65, -4.82, 0, 4.82, 9.65]) {
      fbox(out, 'pane', f, z - 1.84, z + 1.84, 6.46, 14.88, 0.01, 0.032, glaze[2]);
      if (lod >= 2)
        for (const w of [-1.22, 0, 1.22])
          fbox(out, 'steel', f, z + w - 0.061, z + w + 0.061, 6.42, 14.89, 0.03, 0.071, grid);
    }
  }
  const shape = profile(west - 0.22, east + 0.2, nextEave, y).map(([x, y]) => [x, y, rear - 0.22]);
  for (let i = 1; i < shape.length; i++)
    tri(out, 'brick', [centerX, nextEave, rear - 0.22], shape[i - 1], shape[i], brick);
}

function build(out, lod) {
  floorPlate(out);
  roof(out, west - 0.42, east + 0.48, join - 0.13, front + 0.43, eave, historicMainRoofY, lod);
  const joinZ = join - 0.065;
  const step = profile(west - 0.4, east + 0.46, eave, historicMainRoofY).map(([x, y]) => [
    x,
    y,
    joinZ,
  ]);
  for (let i = 1; i < step.length; i++) {
    tri(out, 'concrete', [centerX, eave, joinZ], step[i - 1], step[i], stone);
  }
  longFacade(out, join, front - 4.98, east, eave, lod === 0 ? 8 : 15, lod, true);
  box(out, 'concrete', [west - 0.22, join, west + 0.05, front - 0.02], 0.91, eave, stone);
  if (lod >= 1) box(out, 'concrete', [west - 0.19, rear, west + 0.045, join], 0.9, 17.44, stone);
  westAisle(out, lod);
  northExtension(out, lod);
  southFacade(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'aeg-turbine-factory-model.mjs';
const camera = [117, 58, 213];
const lookAt = [2, 10, 11];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Berlin’s AEG Turbine Hall with a polygonal main roof, sloping street glazing and an attached aisle and north extension.',
  camera,
  lookAt,
  sunDirection: [48, 63, 78],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.95,
    basis: 'Mapped whole hall form and attached north extension.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'huttenstrasse-gable-and-glazing', position: [61, 16, 164], lookAt: [6.0, 14, 109] },
    { name: 'berlichingenstrasse-frame-bays', position: [104, 20, 83], lookAt: [13, 12, 27] },
    { name: 'north-addition-and-west-aisle', position: [-94, 62, -173], lookAt: [-4, 11, -55] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'aeg-turbine-factory-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.05,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.46, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.048, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
