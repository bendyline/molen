import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const {
  facadeCorniceM,
  canalRoofEaveM,
  mainRoofRidgeM,
  roofLanternTopM,
  stageTowerTopM,
  rearAnnexHeightM,
} = plan.dimensions;
const plaster = rgb('d3ccbc');
const pale = rgb('e3dac5');
const base = rgb('90918a');
const contrast = rgb('aaa69b');
const dark = rgb('495559');
const bronze = rgb('9d8253');
const rails = rgb('3f4948');
const roof = rgb('647b87');
const brick = rgb('8c7469');
const panelGray = rgb('a5a4a0');
const red = rgb('88544f');
const surfaces = {
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  molded: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91 },
  rusticated: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
  zinc: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.56 },
  canopy: {
    slot: 'roof',
    localRef: 'palette:#ffffff',
    roughness: 0.43,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.57],
    doubleSided: true,
  },
};
const x0 = -15.018;
const x1 = 22.259;
const zf = 28.829;
const center = 3.62;
const street = facade([center, zf], [1, 0]);
const landing = facade([center, 30.665], [1, 0]);
const groundStreet = facade([center, zf + 0.175], [1, 0]);
const groundLanding = facade([center, 30.831], [1, 0]);

function box(out, slot, lo, hi, tint) {
  abox(out, slot, lo, hi, tint, { bottom: false });
}

function panel(out, slot, f, u, y, width, height, d, tint) {
  const l = u - width / 2;
  const r = u + width / 2;
  quad4(out, slot, f.P(l, y, d), f.P(r, y, d), f.P(r, y + height, d), f.P(l, y + height, d), tint);
}

function window(out, f, u, y, w, h, level, arch = false) {
  if (level === 0) {
    panel(out, 'dark', f, u, y, w, h - (arch ? w * 0.26 : 0), 0.048, dark);
    return;
  }
  opening(out, f, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'dark',
    frameSlot: 'molded',
    glass: dark,
    frame: arch ? contrast : pale,
    frameWidth: arch ? 0.25 : 0.16,
    frameDepth: 0.12,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 2 ? 1 : 0,
    mullionColor: rails,
  });
}

function shell(out, level) {
  const outline = frame.geometry.outline;
  const skylineVertices = [
    0, 9, 10, 11, 15, 21, 26, 31, 37, 43, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68,
    69,
  ];
  const ring = level === 0 ? skylineVertices.map((i) => outline[i]) : outline;
  extrude(out, 'brick', ring, -0.56, 5.69, brick, { top: false });
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => ring[index]);
    const p = ([x, z]) => [x, 5.69, z];
    if ((b[1] - a[1]) * (c[0] - a[0]) > (b[0] - a[0]) * (c[1] - a[1]))
      tri(out, 'zinc', p(a), p(b), p(c), roof);
    else tri(out, 'zinc', p(a), p(c), p(b), roof);
  }
  box(out, 'stucco', [x0, -0.39, -7.37], [x1, canalRoofEaveM, zf], plaster);
  box(out, 'stucco', [-0.431, -0.39, zf - 0.06], [7.682, facadeCorniceM, 30.661], plaster);
  box(out, 'brick', [-18.47, -0.38, -8.13], [x0, 12.96, 13.98], brick);
  box(out, 'brick', [-23.71, -0.39, -26.46], [x0, 8.86, 5.02], brick);
  box(out, 'stucco', [-16.84, -0.39, -23.28], [22.39, stageTowerTopM, -7.25], panelGray);
  box(out, 'brick', [-23.74, -0.37, -26.52], [-16.85, rearAnnexHeightM, -7.31], brick);
  box(out, 'brick', [-16.96, -0.37, -29.46], [22.38, rearAnnexHeightM + 0.63, -23.18], brick);
  box(
    out,
    'zinc',
    [-17.02, stageTowerTopM - 0.15, -23.45],
    [22.52, stageTowerTopM + 0.08, -7.31],
    roof,
  );
  box(
    out,
    'zinc',
    [-23.78, rearAnnexHeightM - 0.11, -26.57],
    [-16.84, rearAnnexHeightM + 0.06, -7.24],
    roof,
  );
}

const rounded = (l, r, b, f, cut, y) => [
  [l + cut, y, b],
  [l, y, b + cut],
  [l, y, f - cut],
  [l + cut, y, f],
  [r - cut, y, f],
  [r, y, f - cut],
  [r, y, b + cut],
  [r - cut, y, b],
];

function auditoriumRoof(out, level) {
  const layers = [
    [x0 - 0.26, x1 + 0.23, -8.11, zf + 0.17, 0.95, canalRoofEaveM],
    [-14.16, 21.4, -8.12, 27.3, 2.6, 22.97],
    [-11.27, 18.92, -8.08, 24.31, 3.74, 25.51],
    [-7.58, 15.42, -8.05, 20.5, 4.32, 27.47],
    [-3.66, 11.51, -7.98, 16.92, 4.12, 28.57],
    [-1.4, 9.14, -7.9, 15.23, 3.32, mainRoofRidgeM],
  ];
  const rows = (level === 0 ? layers.filter((_, i) => i % 2 === 0 || i === 5) : layers).map((p) =>
    rounded(...p),
  );
  for (let j = 0; j + 1 < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const n = (i + 1) % rows[j].length;
      const [a, b, c, d] = [rows[j][i], rows[j][n], rows[j + 1][n], rows[j + 1][i]];
      tri(out, 'zinc', a, b, c, roof);
      tri(out, 'zinc', a, c, d, roof);
    }
  }
  fan(out, 'zinc', rows.at(-1), roof);
  const roofFloor = mainRoofRidgeM - 0.18;
  box(out, 'stucco', [-1.37, roofFloor, -1.28], [9.02, roofLanternTopM - 0.48, 5.86], panelGray);
  box(out, 'zinc', [-1.62, roofLanternTopM - 0.52, -1.54], [9.31, roofLanternTopM, 6.13], roof);
  const crown = facade([3.82, 5.863], [1, 0]);
  for (const u of [-4.08, -2.73, -1.36, 0, 1.36, 2.73, 4.08]) {
    panel(out, 'molded', crown, u, roofFloor + 0.58, 0.91, 1.57, 0.043, red);
    if (level > 0) panel(out, 'dark', crown, u, roofFloor + 0.85, 0.67, 1.12, 0.059, dark);
  }
  if (level > 1) {
    for (let u = -12.05; u < 22.4; u += 1.47) {
      box(
        out,
        'stucco',
        [u, 14.35, -29.715],
        [u + 0.16, rearAnnexHeightM + 0.52, -29.43],
        panelGray,
      );
    }
  }
}

function pediment(out, f, u, bottom, width, rise, d, tint) {
  const l = f.P(u - width / 2, bottom, d);
  const r = f.P(u + width / 2, bottom, d);
  const t = f.P(u, bottom + rise, d);
  tri(out, 'molded', l, r, t, tint);
  for (const [a, b] of [
    [l, t],
    [t, r],
    [l, r],
  ])
    beam(out, 'molded', a, b, 0.14, 0.19, pale);
}

function front(out, level) {
  fbox(out, 'rusticated', street, -18.62, 18.63, -0.42, 5.64, 0.015, 0.17, base);
  fbox(out, 'rusticated', landing, -4.08, 4.08, -0.42, 5.65, -0.022, 0.16, base);
  for (const [y, h, depth] of [
    [0.51, 0.38, 0.22],
    [5.18, 0.24, 0.31],
    [5.48, 0.28, 0.58],
    [14.32, 0.25, 0.27],
    [15.3, 0.29, 0.4],
    [15.68, 0.23, 0.52],
    [19.15, 0.35, 0.48],
    [19.55, 0.28, 0.68],
  ]) {
    if (level === 0 && [0.51, 5.18, 14.32, 15.3].includes(y)) continue;
    for (const [f, l, r] of [
      [street, -18.78, -4.09],
      [street, 4.09, 18.76],
      [landing, -4.17, 4.17],
    ]) {
      fbox(out, 'molded', f, l, r, y, y + h, -0.034, depth, y < 5.5 ? contrast : pale);
    }
  }
  const bays = [-16.45, -12.77, -9.19, -5.7, 5.7, 9.27, 12.82, 16.36];
  for (const u of bays) {
    window(out, groundStreet, u, 0.92, 1.89, 3.71, level, true);
    window(out, street, u, 6.23, 1.54, 3.15, level);
    window(out, street, u, 10.63, 1.53, 3, level);
    window(out, street, u, 16.29, 1.7, 2.13, level);
    if (level > 1) {
      pediment(out, street, u, 9.46, 2.2, 0.55, 0.16, plaster);
      for (const y of [6.01, 10.37, 16.13]) {
        fbox(out, 'molded', street, u - 0.96, u + 0.96, y, y + 0.13, 0.014, 0.22, pale);
      }
    }
  }
  for (const u of [-2.45, 0, 2.45]) {
    window(out, groundLanding, u, 0.68, 1.94, 3.89, level, true);
    if (level) window(out, landing, u, 8.39, 1.46, 3.69, level);
  }
  for (const u of [-17.93, -14.54, -10.94, -7.41, 7.46, 11.08, 14.63, 18.01]) {
    fbox(out, 'stucco', street, u - 0.14, u + 0.14, 5.92, 14.28, 0, 0.18, pale);
  }
  for (const u of [-3.76, -2.84, 2.84, 3.76]) {
    const x = center + u;
    const z = 30.99;
    box(out, 'molded', [x - 0.41, 5.73, z - 0.39], [x + 0.41, 6.32, z + 0.39], contrast);
    lathe(
      out,
      'molded',
      [x, z],
      [
        [6.31, 0.35, 0.35],
        [6.49, 0.34, 0.34],
        [13.94, 0.276, 0.276],
        [14.36, 0.39, 0.39],
      ],
      [5, 6, 10, 14][level],
      pale,
      { capTop: false },
    );
    if (level > 1)
      box(out, 'molded', [x - 0.43, 14.19, z - 0.42], [x + 0.43, 14.43, z + 0.42], plaster);
  }
  pediment(out, landing, 0, 19.71, 9.33, 3.06, 0.4, plaster);
  if (level > 0) {
    const cy = 20.63;
    const ring = Array.from({ length: 14 }, (_, i) => {
      const a = (i * Math.PI) / 7;
      return landing.P(Math.cos(a) * 0.43, cy + Math.sin(a) * 0.5, 0.452);
    });
    fan(out, 'molded', ring, red);
  }
}

function balconyAndCanopy(out, level) {
  const tint = rgb('6e7776');
  const canopyFront = 33.23;
  const left = center - 5.65;
  const right = center + 5.65;
  const a = [left, 4.94, canopyFront];
  const b = [right, 4.94, canopyFront];
  const c = [right, 5.13, 30.72];
  const d = [left, 5.13, 30.72];
  quad4(out, 'canopy', a, b, c, d, tint);
  beam(out, 'metal', a, b, 0.14, 0.17, rails);
  for (const u of [-5.65, 5.65]) {
    beam(
      out,
      'metal',
      [center + u, 5.13, 30.68],
      [center + u, 4.94, canopyFront],
      0.11,
      0.13,
      rails,
    );
    if (level > 0)
      beam(
        out,
        'metal',
        [center + u, 5.68, 30.72],
        [center + u, 4.94, canopyFront],
        0.075,
        0.1,
        rails,
      );
  }
  for (const [l, r, z] of [
    [x0, center - 4.12, 29.37],
    [center - 4.12, center + 4.12, 31.22],
    [center + 4.12, x1, 29.37],
  ]) {
    for (const y of [5.72, 6.65]) {
      beam(out, 'metal', [l, y, z], [r, y, z], 0.081, 0.091, rails);
    }
    if (level > 0) {
      for (let x = l + 0.12; x < r; x += [2, 0.93, 0.49, 0.34][level]) {
        beam(out, 'metal', [x, 5.69, z], [x, 6.69, z], 0.041, 0.052, rails);
      }
    }
  }
}

function sides(out, level) {
  const walls = [facade([x1, 6.28], [0, -1]), facade([x0, 14.9], [0, 1])];
  for (const f of walls) {
    for (const u of [-9.6, -6.2, -2.8, 0.6, 4, 7.4, 10.8]) {
      for (const y of [6.9, 11.13, 16.48])
        window(out, f, u, y, 1.39, y > 16 ? 1.94 : 2.34, level === 1 ? 0 : level);
    }
  }
  const side = facade([22.405, -15.4], [0, -1]);
  const back = facade([2.58, -29.466], [-1, 0]);
  if (level > 0) {
    for (const u of [-6, -3, 0, 3, 6]) {
      for (const y of [5.59, 9.36, 13.23, 17.62])
        panel(out, 'dark', side, u, y, 0.74, 1.71, 0.038, dark);
    }
    for (const u of [-17, -13, -9, -5, 0, 5, 9, 13, 17]) {
      for (const y of [5.15, 9.44, 13.68, 17.43])
        panel(out, 'dark', back, u, y, 0.94, 1.58, 0.044, dark);
    }
  }
  if (level > 1) {
    for (const u of [-5.85, -2.95, 0, 2.95, 5.85, 7.9]) {
      fbox(out, 'stucco', side, u - 0.14, u + 0.14, 17.9, stageTowerTopM, 0.013, 0.27, panelGray);
    }
  }
}

const letters = {
  C: [
    [1, 1, 0.18, 1],
    [0.18, 1, 0, 0.8],
    [0, 0.8, 0, 0.2],
    [0, 0.2, 0.18, 0],
    [0.18, 0, 1, 0],
  ],
  A: [
    [0, 0, 0.5, 1],
    [0.5, 1, 1, 0],
    [0.2, 0.43, 0.8, 0.43],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.84, 1],
    [0.84, 1, 0.84, 0.53],
    [0.84, 0.53, 0, 0.53],
    [0.5, 0.53, 1, 0],
  ],
  É: [
    [1, 1, 0, 1],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0.52, 0.76, 0.52],
    [0.49, 1.15, 0.78, 1.35],
  ],
};

function lettering(out) {
  for (const [i, ch] of [...'CARRÉ'].entries()) {
    for (const [a, b, c, d] of letters[ch]) {
      beam(
        out,
        'molded',
        landing.P((i - 2) * 0.88 + (a - 0.5) * 0.56, 14.71 + b * 0.46, 0.31),
        landing.P((i - 2) * 0.88 + (c - 0.5) * 0.56, 14.71 + d * 0.46, 0.31),
        0.043,
        0.019,
        bronze,
      );
    }
  }
}

function build(out, level) {
  shell(out, level);
  auditoriumRoof(out, level);
  front(out, level);
  balconyAndCanopy(out, level);
  sides(out, level);
  if (level > 1) lettering(out);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const streetLevel = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
export { streetLevel as street };

const recipe = 'royal-theater-carre-model.mjs';
const camera = [-47, 29, 89];
const lookAt = [3, 13.25, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Royal Theatre Carré',
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Amsterdam’s Royal Theatre Carré with its plastered Neo-Renaissance Amstel facade and bowed zinc roof.',
  camera,
  lookAt,
  sunDirection: [-31, 57, 86],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Matched BAG building outline with the adjoining houses outside the placement.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_raw',
    'stone_ashlar',
    'brick_flemish',
    'metal_painted',
    'metal_standing_seam',
  ],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'amstel-canal-elevation', position: [-33, 15, 83], lookAt: [3, 13.8, 23] },
    { name: 'street-portico-and-windows', position: [16.5, 8.8, 61], lookAt: [2.3, 9.65, 27.5] },
    { name: 'zinc-roof-and-stage-tower', position: [52, 48, -40], lookAt: [1, 15.07, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'carre-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.38, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.056, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain. Survey measurements: © 3DBAG by tudelft3d and 3DGI, https://docs.3dbag.nl/en/copyright/.',
};
