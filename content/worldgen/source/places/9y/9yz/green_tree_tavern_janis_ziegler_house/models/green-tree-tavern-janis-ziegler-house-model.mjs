import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');

const paint = rgb('e8e3d2');
const board = rgb('d6d3c3');
const interiorBoard = rgb('d4c9b6');
const dressedTimber = rgb('9b8b73');
const lintel = rgb('766555');
const darkWood = rgb('4b4c45');
const glazing = rgb('526063');
const roofTone = rgb('5d615d');
const brickTone = rgb('896656');
const stoneTone = rgb('a69c87');
const mortar = rgb('8f8778');
const capStone = rgb('b3a993');

const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.95 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.89 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.63 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.94 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.94 },
};

const halfLength = plan.dimensions.porchLengthM / 2;
const halfWidth = plan.dimensions.porchWidthM / 2;
const floor = 1.77;
const eave = floor + plan.dimensions.mainWallHeightM;
const ridge = eave + plan.dimensions.roofRiseM;
const core = [
  [-8.76, 3.66],
  [11.1, 3.66],
  [11.1, -5.96],
  [6.58, -5.96],
  [6.58, -3.65],
  [-8.76, -3.65],
];
const roofSection = [
  [-halfWidth - 0.19, eave],
  [-1.26, ridge - 1.13],
  [0, ridge],
  [1.26, ridge - 1.13],
  [halfWidth + 0.19, eave],
];

function facePanel(out, slot, face, start, end, bottom, top, color, depth = 0) {
  if (end - start < 0.012 || top - bottom < 0.012) return;
  quad4(
    out,
    slot,
    face.P(start, bottom, depth),
    face.P(end, bottom, depth),
    face.P(end, top, depth),
    face.P(start, top, depth),
    color,
  );
}

function roof(out, level) {
  const xLeft = -halfLength - 0.52;
  const xRight = halfLength + 0.31;
  for (let i = 1; i < roofSection.length; i++) {
    const [za, ya] = roofSection[i - 1];
    const [zb, yb] = roofSection[i];
    quad4(
      out,
      'roof',
      [xLeft, yb, zb],
      [xRight, yb, zb],
      [xRight, ya, za],
      [xLeft, ya, za],
      roofTone,
    );
    quad4(
      out,
      'timber',
      [xLeft, ya - 0.13, za],
      [xRight, ya - 0.13, za],
      [xRight, yb - 0.13, zb],
      [xLeft, yb - 0.13, zb],
      board,
    );
    for (const x of [xLeft, xRight]) {
      beam(out, 'trim', [x, ya - 0.044, za], [x, yb - 0.044, zb], 0.105, 0.145, paint);
    }
  }
  for (const z of [-halfWidth - 0.18, halfWidth + 0.18]) {
    beam(out, 'trim', [xLeft, eave - 0.09, z], [xRight, eave - 0.09, z], 0.14, 0.19, paint);
  }

  for (const [x, direction] of [
    [-halfLength, -1],
    [halfLength, 1],
  ]) {
    for (let i = 1; i < roofSection.length; i++) {
      const [za, ya] = roofSection[i - 1];
      const [zb, yb] = roofSection[i];
      const edgeA = [x, eave - 0.15, za];
      const edgeB = [x, eave - 0.15, zb];
      const face = [edgeB, edgeA, [x, ya - 0.055, za], [x, yb - 0.055, zb]];
      quad4(out, 'siding', ...(direction === 1 ? face : face.reverse()), board);
    }
    if (level >= 2) {
      const gable = facade([x, 0], [0, -direction]);
      opening(out, gable, 0.24, eave + 0.2, 0.53, 0.92, {
        frame: paint,
        glass: glazing,
        frameWidth: 0.062,
        frameDepth: 0.06,
        mullions: 1,
        transoms: 1,
        sill: false,
      });
    }
  }
  // Three stacks are visible in the HABS site plan. The northwest stack
  // retains the triangular section documented for the original fireplace.
  for (const [x, z, height, width] of [
    [-5.24, -0.94, 8.73, 0.89],
    [-0.34, -0.96, 8.58, 0.65],
    [5.72, 0.72, 8.41, 0.67],
  ]) {
    if (x === -5.24) {
      const ring = [
        [x - 0.46, z - 0.38],
        [x + 0.46, z - 0.38],
        [x, z + 0.43],
      ];
      for (let i = 0; i < ring.length; i++) {
        const f = wallFace(ring[i], ring[(i + 2) % ring.length]);
        facePanel(out, 'brick', f, 0, f.length, 6.6, height, brickTone);
      }
    } else {
      abox(
        out,
        'brick',
        [x - width / 2, 6.6, z - 0.33],
        [x + width / 2, height, z + 0.33],
        brickTone,
      );
    }
    if (level >= 1) {
      abox(
        out,
        'brick',
        [x - width / 2 - 0.07, height - 0.12, z - 0.4],
        [x + width / 2 + 0.07, height, z + 0.43],
        brickTone,
      );
      abox(
        out,
        'trim',
        [x - 0.17, height, z - 0.18],
        [x + 0.17, height + 0.024, z + 0.18],
        darkWood,
      );
    }
  }
}

const breaks = [
  [
    [-5.73, 'window'],
    [-3.5, 'window'],
    [-0.04, 'door'],
    [2.25, 'window'],
    [4.68, 'door'],
    [6.92, 'window'],
    [9.1, 'door'],
  ],
  [
    [-1.13, 'window'],
    [1.77, 'window'],
  ],
  [[9.11, 'window']],
  [],
  [
    [-5.67, 'window'],
    [-3.63, 'window'],
    [-0.18, 'door'],
    [2.21, 'window'],
    [4.02, 'window'],
    [5.56, 'window'],
  ],
  [
    [-1.5, 'window'],
    [1.16, 'window'],
  ],
];

function cladWall(out, face, openings, level) {
  const features = openings
    .map(([coord, kind]) => {
      const u =
        Math.abs(face.along[0]) > 0.5
          ? (coord - face.origin[0]) * face.along[0]
          : (coord - face.origin[1]) * face.along[1];
      const door = kind === 'door';
      return {
        u,
        width: door ? 0.96 : 0.77,
        y: floor + (door ? 0.02 : 0.91),
        height: door ? 2.14 : 1.26,
        door,
      };
    })
    .sort((a, b) => a.u - b.u);
  if (!level) {
    facePanel(out, 'siding', face, 0, face.length, floor, eave - 0.18, board);
    return;
  }
  let start = 0;
  for (const { u, width, y, height, door } of features) {
    const left = u - width / 2;
    const right = u + width / 2;
    facePanel(out, 'siding', face, start, left, floor, eave - 0.18, board);
    facePanel(out, 'siding', face, left, right, floor, y, board);
    facePanel(out, 'siding', face, left, right, y + height, eave - 0.18, board);
    opening(out, face, u, y, width, height, {
      d: -0.016,
      glassSlot: door ? 'timber' : 'glass',
      glass: door ? darkWood : glazing,
      frame: paint,
      frameWidth: level >= 2 ? 0.069 : 0,
      frameDepth: 0.05,
      sill: false,
      mullions: level >= 2 && !door ? 1 : 0,
      transoms: level >= 2 && !door ? 1 : 0,
    });
    if (level >= 2 && !door) {
      const shutter = width * 0.42;
      for (const [a, b] of [
        [left - shutter - 0.1, left - 0.095],
        [right + 0.095, right + shutter + 0.1],
      ]) {
        fbox(
          out,
          'timber',
          face,
          Math.max(0, a),
          Math.min(face.length, b),
          y - 0.014,
          y + height + 0.03,
          0.023,
          0.065,
          darkWood,
        );
        if (level === 3) {
          for (let h = y + 0.12; h < y + height - 0.05; h += 0.099) {
            facePanel(
              out,
              'trim',
              face,
              Math.max(0, a + 0.025),
              Math.min(face.length, b - 0.025),
              h,
              h + 0.015,
              dressedTimber,
              0.067,
            );
          }
        }
      }
    }
    if (level === 3 && door) {
      for (const h of [y + 0.24, y + 1.05]) {
        fbox(out, 'trim', face, u - 0.35, u + 0.35, h, h + 0.046, -0.01, 0.027, lintel);
      }
    }
    start = right;
  }
  facePanel(out, 'siding', face, start, face.length, floor, eave - 0.18, board);
  fbox(out, 'timber', face, 0, face.length, eave - 0.33, eave - 0.15, -0.016, 0.059, lintel);
}

function gallery(out, level) {
  const front = [-11.17, -8.84, -6.96, -4.97, -2.78, -0.99, 0.59, 3.39, 6.23];
  const rear = [-11.17, -8.83, -6.62, -4.33, -1.2, 0.85, 3.47, 5.8, 8.29, 9.61];
  const west = [-5.98, -3.64, -1.2, 1.22, 3.6, 5.98];
  abox(
    out,
    'timber',
    [-halfLength, floor - 0.21, -halfWidth],
    [halfLength, floor - 0.005, halfWidth],
    dressedTimber,
  );
  abox(
    out,
    'trim',
    [-halfLength, eave - 0.25, -halfWidth],
    [halfLength, eave - 0.18, halfWidth],
    interiorBoard,
  );
  for (const [posts, normalAxis, fixed] of [
    [front, 'z', -5.98],
    [rear, 'z', 5.98],
    [west, 'x', -11.17],
  ]) {
    const point = (u, y, spread = 0) =>
      normalAxis === 'x' ? [fixed + spread, y, u] : [u, y, fixed + spread];
    for (const u of level || posts === front ? posts : posts.filter((_, i) => i % 2 === 0)) {
      const [x, , z] = point(u, floor);
      abox(
        out,
        'trim',
        [x - 0.08, floor - 0.04, z - 0.08],
        [x + 0.08, eave - 0.22, z + 0.08],
        paint,
      );
      if (level >= 2) {
        for (const y of [floor + 0.05, eave - 0.36]) {
          abox(out, 'trim', [x - 0.108, y, z - 0.108], [x + 0.108, y + 0.105, z + 0.108], paint);
        }
      }
    }
    for (let i = 1; i < posts.length; i++) {
      const a = posts[i - 1];
      const b = posts[i];
      if (posts === front && a === -0.99) continue;
      for (const y of level ? [0.24, 0.44, 0.64, 0.86] : [0.83]) {
        beam(
          out,
          'trim',
          point(a + 0.075, floor + y),
          point(b - 0.075, floor + y),
          0.064,
          0.105,
          paint,
        );
      }
    }
  }
  const lattice = facade([-11.19, -5.87], [0, 1]);
  if (level >= 2) {
    const width = 2.06;
    const height = 1.18;
    const matrixY = eave - 1.46;
    for (const sign of [-1, 1]) {
      for (let offset = -height + 0.025; offset < width; offset += 0.145) {
        const u0 = Math.max(offset, 0);
        const u1 = Math.min(offset + height, width);
        if (u1 - u0 < 0.055) continue;
        const h = (u) => matrixY + (sign === 1 ? u - offset : height - (u - offset));
        beam(
          out,
          'trim',
          lattice.P(u0, h(u0), sign * 0.014),
          lattice.P(u1, h(u1), sign * 0.014),
          0.035,
          0.035,
          paint,
        );
      }
    }
    fbox(out, 'trim', lattice, 0, width, matrixY - 0.02, matrixY + 0.035, -0.046, 0.03, paint);
  }

  function stair(origin, along, base) {
    const f = facade(origin, along);
    const run = 1.85;
    const steps = level >= 2 ? 8 : 4;
    const rise = (floor - base) / steps;
    for (let i = 0; i < steps; i++) {
      fbox(
        out,
        'timber',
        f,
        -0.78,
        0.78,
        base + i * rise - 0.065,
        base + (i + 1) * rise,
        run - ((i + 1) * run) / steps,
        run - (i * run) / steps,
        board,
        { bottom: true },
      );
    }
    if (!level) return;
    for (const u of [-0.86, 0.86]) {
      for (const [d, y] of [
        [0.02, floor],
        [run - 0.02, base + 0.08],
      ]) {
        beam(out, 'trim', f.P(u, y - 0.13, d), f.P(u, y + 0.87, d), 0.085, 0.085, paint);
      }
      beam(
        out,
        'trim',
        f.P(u, floor + 0.85, 0.02),
        f.P(u, base + 0.93, run - 0.02),
        0.074,
        0.097,
        paint,
      );
    }
  }
  stair([-0.2, -halfWidth], [-1, 0], 0.05);
  stair([halfLength, 4.72], [0, -1], 0.28);
}

function stoneWall(out, face, base, top, level, depth = 0.31) {
  fbox(out, 'stone', face, 0, face.length, base, top, -depth, 0, stoneTone);
  if (level < 2) return;
  const rows = Math.max(1, Math.round((top - Math.max(base, -0.8)) / 0.24));
  const start = Math.max(base, -0.8);
  const course = (top - start) / rows;
  const stoneColors = [rgb('a69c88'), rgb('b0a694'), rgb('b7ae9b'), rgb('9b9483')];
  for (let row = 0; row < rows; row++) {
    const y = start + row * course;
    facePanel(out, 'trim', face, 0.02, face.length - 0.02, y, y + 0.024, mortar, 0.009);
    if (level < 3) continue;
    let offset = row % 2 ? -0.35 : 0;
    let stone = 0;
    while (offset < face.length - 0.043) {
      const end = offset + 0.48 + ((stone + 2 * row) % 5) * 0.12;
      const left = Math.max(0.012, offset + 0.02);
      const right = Math.min(face.length - 0.01, end - 0.02);
      const color = stoneColors[(row + stone) % stoneColors.length];
      facePanel(
        out,
        'stone',
        face,
        left,
        right,
        y + 0.034,
        y + course - 0.011,
        color,
        0.013 + ((stone + row) % 3) * 0.009,
      );
      offset = end;
      stone++;
    }
  }
}

function foundation(out, level) {
  for (let i = 0; i < core.length; i++) {
    const face = wallFace(core[i], core[(i + 1) % core.length]);
    stoneWall(out, face, floor - plan.dimensions.fullBasementHeightM, floor - 0.1, level, 0.38);
  }
  for (const [a, b] of [
    [
      [6.35, -6.02],
      [0.62, -6.02],
    ],
    [
      [-1.02, -6.02],
      [-11.1, -6.02],
    ],
    [
      [-11.1, -6.02],
      [-11.1, 5.93],
    ],
    [
      [-11.1, 5.93],
      [9.55, 5.93],
    ],
  ]) {
    const face = wallFace(a, b);
    fbox(out, 'siding', face, 0, face.length, 0.04, floor - 0.19, -0.045, 0, board);
  }
  // The HABS section places a low limestone wall between the gallery and road.
  for (const [a, b] of [
    [
      [-15.4, -9.64],
      [-13.3, -10.04],
    ],
    [
      [-13.3, -10.04],
      [-1.1, -10.04],
    ],
    [
      [0.67, -10.04],
      [12.25, -10.04],
    ],
    [
      [12.25, -10.04],
      [13.63, -9.45],
    ],
  ]) {
    const face = wallFace(b, a);
    stoneWall(out, face, -1.02, 0.16, level, 0.61);
    fbox(out, 'stone', face, -0.025, face.length + 0.025, 0.16, 0.265, -0.65, 0.043, capStone, {
      bottom: true,
    });
  }
}

function build(out, level) {
  roof(out, level);
  foundation(out, level);
  gallery(out, level);
  for (let i = 0; i < core.length; i++) {
    cladWall(out, wallFace(core[i], core[(i + 1) % core.length]), breaks[i], level);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'green-tree-tavern-janis-ziegler-house-model.mjs';
const camera = [-26, 13, -34];
const lookAt = [0, 3.35, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Green Tree Tavern (Janis-Ziegler House)',
  wikidataId: plan.wikidataId,
  category: 'historic_house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Nicolas Janis House in Ste. Genevieve, with raised wraparound galleries, a flared roof, walnut construction, and a limestone street wall.',
  camera,
  lookAt,
  sunDirection: [-24, 25, -29],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Historic American Buildings Survey measured perimeter of the covered galleries.',
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'wood_plain',
    'stone_limestone_weathered',
    'shingle_cedar',
    'brick',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'front-gallery-and-street-wall', position: [-14, 3.8, -23], lookAt: [-1, 3.8, -2] },
    { name: 'west-return-and-roof-detail', position: [-21, 7.2, -7.5], lookAt: [-3.5, 4.05, -1.5] },
    { name: 'rear-gallery-and-chimneys', position: [19, 15, 24], lookAt: [2, 4.0, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'green-tree-tavern-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.135, surfaces },
      street: { export: 'street', errorMeters: 0.056, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.017, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. National Park Service HABS public-domain survey. Mapzen open terrain.',
};
