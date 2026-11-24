import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  iron: { slot: 'roof', graph: 'metal_painted', roughness: 0.83 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.81 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.6 },
};
const brick = rgb('9d6451');
const newBrick = rgb('986752');
const stone = rgb('d0c5a9');
const ivory = rgb('e4dac0');
const roof = rgb('9a5445');
const roofDark = rgb('744e45');
const roofUtility = rgb('787970');
const dark = rgb('404b44');
const grey = rgb('7d7a69');
const copper = rgb('695449');
const floor = 3.05;
const facadeZ = 17.34;
const entryX = -6.3;

function box(out, material, outline, y0, y1, color) {
  abox(out, material, [outline[0], y0, outline[2]], [outline[1], y1, outline[3]], color, {
    bottom: false,
  });
}

function hip(out, outline, eave, ridge, inset, color = roof) {
  const [x0, x1, z0, z1] = outline;
  const corners = [
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
    [x0, eave, z0],
  ];
  if (z1 - z0 > x1 - x0) corners.push(corners.shift());
  const [a, b, c, d] = corners;
  const l = [
    a[0] + inset * (b[0] - a[0]) + (d[0] - a[0]) / 2,
    ridge,
    a[2] + inset * (b[2] - a[2]) + (d[2] - a[2]) / 2,
  ];
  const r = [
    b[0] + inset * (a[0] - b[0]) + (c[0] - b[0]) / 2,
    ridge,
    b[2] + inset * (a[2] - b[2]) + (c[2] - b[2]) / 2,
  ];
  quad4(out, 'iron', a, b, r, l, color);
  tri(out, 'iron', b, c, r, color);
  quad4(out, 'iron', c, d, l, r, color);
  tri(out, 'iron', d, a, l, color);
}

function sash(out, F, u, y, w, h, level, wide = false) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    glass: dark,
    frameSlot: 'trim',
    frame: ivory,
    frameWidth: level >= 2 ? 0.1 : 0,
    frameDepth: 0.07,
    sill: level >= 2,
    d: 0.015,
    mullions: level >= 2 ? (wide ? 2 : 1) : 0,
    transoms: level >= 2 ? 1 : 0,
    mullionColor: ivory,
  });
}

function sashRow(out, F, positions, levels, level) {
  for (const [y, h, w] of levels) for (const u of positions) sash(out, F, u, y, w, h, level);
}

function stack(out, x, z, base, top, level) {
  box(out, 'brick', [x - 0.51, x + 0.51, z - 0.44, z + 0.44], base, top - 0.14, brick);
  box(out, 'plaster', [x - 0.59, x + 0.59, z - 0.53, z + 0.53], top - 0.16, top, stone);
  if (level >= 2) {
    for (const u of [-0.27, 0.27])
      box(out, 'brick', [x + u - 0.13, x + u + 0.13, z - 0.13, z + 0.13], top, top + 0.29, copper);
  }
}

function dormer(out, x, z, orientation, bottom, width, level) {
  const r = width / 2;
  const zStart = Math.min(z, z - 2.5 * orientation);
  const zEnd = Math.max(z, z - 2.5 * orientation);
  box(out, 'plaster', [x - r, x + r, zStart, zEnd], bottom, bottom + 2.07, stone);
  hip(
    out,
    [x - r - 0.1, x + r + 0.1, zStart - 0.12, zEnd + 0.12],
    bottom + 1.96,
    bottom + 2.58,
    0.3,
    roofDark,
  );
  if (level >= 1)
    sash(
      out,
      facade([x, z], [orientation, 0]),
      0,
      bottom + 0.19,
      width - 0.21,
      1.46,
      level,
      width > 1.3,
    );
}

function wing(out, outline, form, level) {
  const { eave, ridge, wainscot = 2.62, utility = false, faces = [] } = form;
  const [x0, x1, z0, z1] = outline;
  box(out, 'concrete', outline, -2.85, wainscot, stone);
  box(out, utility ? 'plaster' : 'brick', outline, wainscot, eave, utility ? stone : newBrick);
  const cornice = [x0 - 0.18, x1 + 0.18, z0 - 0.17, z1 + 0.17];
  box(out, utility ? 'concrete' : 'plaster', cornice, eave - 0.23, eave, utility ? grey : ivory);
  hip(
    out,
    [x0 - 0.38, x1 + 0.38, z0 - 0.38, z1 + 0.38],
    eave,
    ridge,
    0.25,
    utility ? roofUtility : roof,
  );
  if (level === 0) return;
  for (const { position, along, openings, rows } of faces) {
    const F = facade(position, along);
    sashRow(out, F, openings, rows, level);
  }
}

function portico(out, level) {
  const left = entryX - 4.18,
    right = entryX + 4.17;
  const porchFront = 24.5;
  const lower = [left - 0.15, right + 0.13, facadeZ, porchFront];
  box(out, 'concrete', lower, -1.46, floor, stone);
  box(
    out,
    'plaster',
    [left - 0.25, right + 0.24, facadeZ, porchFront + 0.1],
    floor - 0.23,
    floor + 0.11,
    ivory,
  );
  box(out, 'plaster', [left - 0.07, right + 0.07, facadeZ, porchFront - 0.22], 6.55, 7.32, stone);
  box(out, 'plaster', [left - 0.24, right + 0.24, facadeZ, porchFront - 0.045], 7.19, 7.49, ivory);
  const beamFront = porchFront - 0.07;
  const beamLeft = left - 0.09,
    beamRight = right + 0.09;
  const edge = facade([0, beamFront], [1, 0]);
  fbox(out, 'plaster', edge, beamLeft, beamRight, 7.47, 7.76, -0.26, 0.04, ivory);
  fbox(out, 'concrete', edge, beamLeft, beamRight, 7.73, 7.99, -0.29, 0.09, stone);
  for (const sign of [-1, 1]) {
    const x = entryX + sign * 4.16;
    const F = facade([x, (facadeZ + beamFront) / 2], [0, -sign]);
    fbox(out, 'plaster', F, -3.56, 3.56, 7.46, 7.99, -0.24, 0.017, ivory);
  }
  const columns = [0.42, 1.89, 3.42, 4.97, 6.51, 7.9];
  const sides = level === 0 ? 6 : level === 1 ? 8 : level === 2 ? 12 : 16;
  const locations = columns.map((u) => [left + u, porchFront - 0.74]);
  locations.push([left + 0.42, 20.12], [right - 0.45, 20.12]);
  for (const [x, z] of locations) {
    box(out, 'plaster', [x - 0.285, x + 0.285, z - 0.285, z + 0.285], 3.1, 3.31, stone);
    const profile =
      level === 0
        ? [
            [3.27, 0.225, 0.225],
            [6.46, 0.19, 0.19],
          ]
        : [
            [3.27, 0.225, 0.225],
            [3.53, 0.204, 0.204],
            [6.31, 0.164, 0.164],
            [6.46, 0.233, 0.233],
          ];
    lathe(out, 'plaster', [x, z], profile, sides, ivory, { capTop: false });
    box(out, 'plaster', [x - 0.25, x + 0.25, z - 0.25, z + 0.25], 6.44, 6.59, ivory);
  }
  const openings = facade([entryX, porchFront + 0.012], [1, 0]);
  if (level >= 1) {
    for (const u of [-2.72, 0, 2.72]) sash(out, openings, u, 0.6, 1.97, 1.89, level, true);
    for (const u of [-3.89, -1.22, 1.19, 3.82])
      fbox(
        out,
        'plaster',
        edge,
        entryX + u - 0.115,
        entryX + u + 0.115,
        7.49,
        8.04,
        -0.27,
        0.09,
        ivory,
      );
    const door = facade([entryX, facadeZ + 0.011], [1, 0]);
    for (const u of [-1.64, 0, 1.64]) sash(out, door, u, floor + 0.04, 1.24, 2.73, level);
  }
  if (level >= 2) {
    for (let i = 0; i < 23; ++i) {
      const u = left + 0.31 + i * 0.348;
      fbox(out, 'plaster', edge, u - 0.039, u + 0.039, 7.49, 7.82, -0.18, 0.084, paleStone);
    }
  }
}
const paleStone = rgb('d6cbb0');

function centralHotel(out, level) {
  const body = [-21.14, 13.09, -10.48, facadeZ];
  box(out, 'concrete', body, -3.7, 3.05, stone);
  box(out, 'plaster', body, 3.05, 6.5, stone);
  box(out, 'brick', body, 6.5, 13.14, brick);
  box(out, 'plaster', [-21.38, 13.32, -10.72, facadeZ + 0.25], 6.26, 6.59, ivory);
  box(out, 'plaster', [-21.45, 13.39, -10.82, facadeZ + 0.33], 12.82, 13.2, ivory);
  hip(out, [-21.72, 13.65, -11.08, facadeZ + 0.54], 13.15, 19.51, 0.27);
  stack(out, -15.5, 4.8, 17.82, 20.19, level);
  stack(out, 5.22, 2.01, 17.18, 19.58, level);
  for (const x of [-15.55, -11.97, -7.84, -3.66, 0.38, 4.7, 8.57])
    dormer(out, x, 14.31, 1, 14.25, 1.21, level);
  if (level >= 1)
    for (const x of [-15.5, -10.29, -5.0, 0.29, 5.56, 9.33])
      dormer(out, x, -7.47, -1, 14.24, 1.24, level);
  const street = facade([0, facadeZ], [1, 0]),
    back = facade([0, -10.49], [-1, 0]);
  if (level >= 1) {
    sashRow(
      out,
      street,
      [-18.75, -15.37, -11.89, -8.44, -4.91, -1.46, 1.99, 5.44, 8.94, 11.7],
      [
        [7.03, 2.31, 1.19],
        [10.18, 2.19, 1.17],
      ],
      level,
    );
    sashRow(
      out,
      street,
      [-19.03, -16.12, -13.25, -11.61, -0.55, 2.87, 6.16, 9.9],
      [
        [0.45, 1.76, 1.68],
        [3.81, 2.03, 1.8],
      ],
      level,
    );
    sashRow(
      out,
      back,
      [-10.63, -6.6, -2.4, 1.9, 6.16, 10.22, 14.21, 18.52],
      [
        [7.06, 2.25, 1.27],
        [10.23, 2.16, 1.22],
      ],
      level,
    );
    sashRow(
      out,
      facade([body[0] - 0.008, 0], [0, 1]),
      [-7.15, -3.8, -0.4, 3.0, 6.54, 10.17, 13.72],
      [
        [7.03, 2.31, 1.19],
        [10.18, 2.19, 1.17],
      ],
      level,
    );
  }
  portico(out, level);
  if (level >= 3) {
    for (let x = -20.3; x <= 12.6; x += 0.62)
      fbox(out, 'plaster', street, x - 0.086, x + 0.086, 12.77, 12.98, 0.12, 0.32, ivory);
  }
}

function build(out, level) {
  centralHotel(out, level);
  const hotelRows = [
    [4.66, 2.0, 1.3],
    [7.99, 2.18, 1.4],
    [11.12, 1.98, 1.31],
  ];
  const lowerRows = [
    [2.67, 2.12, 1.39],
    [5.73, 1.85, 1.18],
  ];
  wing(
    out,
    [-19.97, 3.81, -24.08, -10.3],
    {
      eave: 12.79,
      ridge: 19.69,
      faces: [
        {
          position: [0, -24.09],
          along: [-1, 0],
          openings: [-1.3, 2.7, 6.3, 10.1, 14.2, 17.9],
          rows: hotelRows,
        },
        {
          position: [-19.97, 0],
          along: [0, 1],
          openings: [-21.19, -16.91, -12.98],
          rows: hotelRows,
        },
      ],
    },
    level,
  );
  wing(
    out,
    [2.25, 13.03, 12.91, 28.03],
    {
      eave: 13.48,
      ridge: 20.53,
      faces: [
        { position: [0, 28.04], along: [1, 0], openings: [4.24, 7.64, 10.9], rows: hotelRows },
        { position: [2.24, 0], along: [0, 1], openings: [20.31, 24.36], rows: hotelRows },
      ],
    },
    level,
  );
  wing(
    out,
    [2.44, 12.76, 27.73, 30.63],
    {
      eave: 8.18,
      ridge: 9.86,
      utility: true,
      faces: [
        { position: [0, 30.64], along: [1, 0], openings: [4.61, 7.58, 10.53], rows: lowerRows },
      ],
    },
    level,
  );
  wing(
    out,
    [8.47, 23.41, -36.26, -10.19],
    {
      eave: 13.84,
      ridge: 20.66,
      faces: [
        {
          position: [23.42, 0],
          along: [0, -1],
          openings: [13.16, 16.32, 19.55, 22.88, 26.01, 29.23, 32.87],
          rows: hotelRows,
        },
        {
          position: [0, -36.27],
          along: [-1, 0],
          openings: [-21.4, -18.5, -15.61, -12.8, -10.07],
          rows: hotelRows,
        },
      ],
    },
    level,
  );
  wing(
    out,
    [-46.8, -20.86, -10.52, 3.64],
    {
      eave: 5.92,
      ridge: 8.3,
      utility: true,
      faces: [
        {
          position: [0, 3.65],
          along: [1, 0],
          openings: [-43.3, -38.9, -34.6, -30.3, -25.5],
          rows: [[1.99, 1.67, 1.48]],
        },
      ],
    },
    level,
  );
  wing(
    out,
    [13.12, 36.21, 0.6, 17.34],
    {
      eave: 7.1,
      ridge: 9.73,
      utility: true,
      faces: [
        {
          position: [36.21, 0],
          along: [0, -1],
          openings: [-3.8, -7.6, -11.0, -14.8],
          rows: [[3.42, 1.87, 1.52]],
        },
      ],
    },
    level,
  );
  wing(
    out,
    [12.89, 30.34, 17.12, 27.77],
    {
      eave: 7.01,
      ridge: 9.68,
      utility: true,
      faces: [
        {
          position: [0, 27.78],
          along: [1, 0],
          openings: [16.42, 20.35, 24.32, 28.04],
          rows: [[2.61, 2.02, 1.49]],
        },
      ],
    },
    level,
  );
  wing(out, [-8.94, -2.77, -27.58, -23.92], { eave: 8.2, ridge: 9.53, utility: true }, level);
  wing(out, [3.83, 8.37, -26.34, -15.4], { eave: 8.1, ridge: 10.36, utility: true }, level);
  if (level >= 1) {
    dormer(out, 7.66, 27.27, 1, 15.1, 2.19, level);
    for (const x of [-16.6, -13.0, -9.2, -5.64, -1.51])
      dormer(out, x, -21.77, -1, 13.69, 1.19, level);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'chateau-tongariro-model.mjs';
const camera = [-69, 21, 87],
  lookAt = [-6, 8.45, 3.6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-hotel',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Chateau Tongariro with the raised loggia and Doric portico, a red dormered roof and attached later hotel wings.',
  camera,
  lookAt,
  sunDirection: [-40, 52, 64],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.88,
    basis: 'Use named OSM way 37662690 to replace the generic Chateau geometry.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whakapapa-bruce-road', position: camera, lookAt },
    {
      name: 'doric-portico-and-basement',
      position: [-16.0, 10.8, 44.8],
      lookAt: [-6.28, 6.17, 21.2],
    },
    { name: 'mapped-east-and-service-wings', position: [67, 32, -70], lookAt: [2, 8.3, -4.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'chateau-tongariro-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.63,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.115, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.046, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by public-domain photographs from the Ian Matheson City Archives and Te Papa, OpenStreetMap and open LINZ numeric terrain.',
};
