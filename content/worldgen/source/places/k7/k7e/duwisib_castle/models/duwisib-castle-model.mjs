import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { mappedRing } = read('native-map/duwisib-castle-shape-controls');
const outside = outwardRing(mappedRing);
const rectangle = (x0, x1, z0, z1) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
];
const court = rectangle(-8.4, 8.35, -7.4, 7.05);
const courtRecess = rectangle(-9.05, 9.0, -8.05, 7.7);
const wallTop = 5.82;
const turretTop = 7.32;
const keepTop = 11.7;
const roofBase = 4.5;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  cap: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.95 },
  roof: { slot: 'roof', localRef: 'palette:#675c50', roughness: 0.87 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  glazing: { slot: 'window', localRef: 'palette:#514943', roughness: 0.43 },
};
const colors = {
  sandstone: rgb('9e7560'),
  masonry: rgb('8e6654'),
  sill: rgb('9f7963'),
  sand: rgb('b69373'),
  crown: rgb('a98166'),
  foot: rgb('806453'),
  roof: rgb('77675a'),
  gate: rgb('4f392e'),
  glass: rgb('433f39'),
  frame: rgb('857260'),
};
const mainCorners = [0, 5, 6, 7];
const cornerRectangles = mainCorners.map((index) => {
  const [x, z] = mappedRing[index];
  const xInside = x - Math.sign(x) * 5.85;
  const zInside = z - Math.sign(z) * 5.3;
  return rectangle(
    Math.min(x, xInside),
    Math.max(x, xInside),
    Math.min(z, zInside),
    Math.max(z, zInside),
  );
});
const towerBase = [
  mappedRing[2],
  mappedRing[3],
  [mappedRing[4][0], 10.4],
  [mappedRing[1][0], 10.4],
];
const highTower = rectangle(-4.47, 2.34, 12.5, 17.58);

function along(ring, visit) {
  for (const [i, point] of ring.entries()) {
    visit(wallFace(point, ring[(i + 1) % ring.length]), i);
  }
}

function crown(out, face, from, to, y, level, tower) {
  const length = to - from;
  if (length < 0.3) return;
  const height = tower ? 0.62 : 0.47;
  const depth = tower ? 0.45 : 0.34;
  const count = Math.max(
    2,
    Math.round(length / (level === 0 ? 2.55 : level === 1 ? 1.36 : tower ? 0.86 : 1.06)),
  );
  fbox(out, 'cap', face, from, to, y - 0.29, y, -depth, 0.08, colors.crown);
  for (let i = 0; i < count; i++) {
    const start = from + ((i + 0.098) / count) * length;
    const end = from + ((i + 0.645) / count) * length;
    if (level === 0) {
      quad4(
        out,
        'cap',
        face.P(start, y, 0.07),
        face.P(end, y, 0.07),
        face.P(end, y + height, 0.07),
        face.P(start, y + height, 0.07),
        colors.crown,
      );
    } else {
      fbox(out, 'cap', face, start, end, y, y + height, -depth, 0.075, colors.crown);
    }
    if (level >= (tower ? 2 : 3)) {
      const mid = (start + end) / 2;
      fbox(
        out,
        'cap',
        face,
        mid - 0.11,
        mid + 0.11,
        y - 0.91,
        y - 0.24,
        -0.025,
        0.22,
        colors.crown,
      );
      if (level === 3) {
        fbox(out, 'cap', face, mid - 0.14, mid + 0.14, y - 0.44, y - 0.25, 0.04, 0.28, colors.sill);
      }
    }
  }
}

function aperture(out, face, u, bottom, width, height, level, gate = false, depth = 0.035) {
  opening(out, face, u, bottom, width, height, {
    head: 'round',
    glassSlot: gate ? 'wood' : 'glazing',
    frameSlot: 'cap',
    glass: gate ? colors.gate : colors.glass,
    frame: gate ? colors.sill : colors.crown,
    frameWidth: level >= 2 ? (gate ? 0.24 : 0.12) : gate && level === 1 ? 0.18 : 0,
    frameDepth: depth + 0.07,
    sill: false,
    mullions: !gate && level >= 2 && width > 0.6 ? 1 : 0,
    d: depth,
  });
  if (level >= 2 && !gate) {
    fbox(
      out,
      'cap',
      face,
      u - width / 2 - 0.07,
      u + width / 2 + 0.07,
      bottom - 0.11,
      bottom + 0.025,
      depth - 0.02,
      depth + 0.22,
      colors.sill,
    );
  }
}

function outerDetails(out, face, edge, level) {
  if ([1, 2, 3].includes(edge)) return;
  const n = face.length;
  const square = n > 25;
  const atEnds = edge !== 0 && edge !== 4;
  const from = atEnds ? 5.78 : edge === 0 ? 5.85 : 0.15;
  const to = atEnds ? n - 5.78 : edge === 4 ? n - 5.85 : n - 0.15;
  crown(out, face, from, to, wallTop, level, false);

  const windows = square ? [0.2, 0.5, 0.8] : [0.42, 0.72];
  for (const [i, f] of windows.entries()) {
    const narrow = square && i === 1;
    const width = narrow ? 0.42 : 0.72;
    const bottom = narrow ? 1.38 : 1.02;
    aperture(out, face, f * n, bottom, width, narrow ? 1.04 : 1.58, level);
  }
  if (level >= 2 && square && edge !== 6) {
    const u = n * 0.49;
    fbox(out, 'stone', face, u - 0.92, u + 0.92, 3.01, wallTop + 0.52, -0.06, 0.28, colors.masonry);
    aperture(out, face, u, 3.73, 0.63, 1.19, level, false, 0.31);
    fbox(
      out,
      'cap',
      face,
      u - 1.01,
      u + 1.01,
      wallTop + 0.43,
      wallTop + 0.65,
      0,
      0.35,
      colors.crown,
    );
  }
}

function entrance(out, level) {
  extrude(out, 'stone', towerBase, -1.65, 7.6, colors.masonry, {
    topSlot: 'roof',
    topColor: colors.roof,
  });
  extrude(out, 'stone', highTower, 7.58, keepTop, colors.sandstone, {
    topSlot: 'roof',
    topColor: colors.roof,
  });
  const front = wallFace(towerBase[0], towerBase[1]);
  const middle = front.length / 2;
  aperture(out, front, middle, 0.2, 2.43, 3.05, level, true);
  fbox(
    out,
    'foundation',
    front,
    middle - 1.41,
    middle + 1.41,
    -0.19,
    0.17,
    0.012,
    0.43,
    colors.foot,
  );

  // The entrance has a corbelled oriel above its arched gate.
  fbox(out, 'stone', front, middle - 1.38, middle + 1.38, 4.14, 6.86, -0.09, 0.66, colors.masonry);
  fbox(out, 'cap', front, middle - 1.52, middle + 1.52, 6.8, 7.08, -0.06, 0.71, colors.crown);
  for (const offset of [-0.48, 0.48]) {
    aperture(out, front, middle + offset, 4.6, 0.69, 1.63, level, false, 0.67);
  }
  if (level >= 2) {
    for (const x of [-1.04, -0.53, 0, 0.53, 1.04]) {
      fbox(
        out,
        'cap',
        front,
        middle + x - 0.12,
        middle + x + 0.12,
        3.78,
        4.24,
        0.1,
        0.57,
        colors.sill,
      );
    }
  }

  along(towerBase, (face, i) => {
    crown(out, face, 0.1, face.length - 0.1, 7.64, level, i === 0);
  });
  along(highTower, (face, i) => {
    crown(out, face, 0.12, face.length - 0.12, keepTop, level, true);
    const m = face.length / 2;
    if (i === 0) {
      for (const offset of [-0.39, 0.39]) {
        aperture(out, face, m + offset, 8.64, 0.51, 1.43, level);
      }
    } else {
      aperture(out, face, m, 8.98, 0.35, 1.13, level);
    }
  });
}

function courtyard(out, level) {
  abox(out, 'foundation', [-9.05, -0.67, -8.05], [9.0, 0.58, 7.7], colors.foot);
  const interior = court.slice().reverse();
  along(interior, (face, edge) => {
    const count = edge % 2 === 0 ? 5 : 4;
    const width = face.length / count;
    if (level === 0) {
      fbox(out, 'stone', face, 0, face.length, 0.16, 3.63, -0.04, 0.05, colors.sandstone);
      return;
    }

    // Recess the inner doors behind the visible stone arcade.
    const wall = wallFace(
      face.P(0, 0, -0.63).filter((_, i) => i !== 1),
      face.P(face.length, 0, -0.63).filter((_, i) => i !== 1),
    );
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * width;
      const radius = width / 2 - 0.27;
      aperture(out, wall, u, 0.47, 2 * radius, 2.8, Math.max(0, level - 1), true, 0.1);
      const points = roundArch(radius, level === 3 ? 9 : 5);
      const spring = 3.25 - radius;
      for (let segment = 1; segment < points.length; segment++) {
        const [ax, ay] = points[segment - 1];
        const [bx, by] = points[segment];
        quad4(
          out,
          'stone',
          face,
          face.P(u + ax, spring + ay, 0.19),
          face.P(u + bx, spring + by, 0.19),
          face.P(u + bx, 3.58, 0.19),
          face.P(u + ax, 3.58, 0.19),
          colors.sandstone,
        );
      }
      fbox(
        out,
        'stone',
        face,
        i * width,
        i * width + 0.265,
        0.14,
        3.58,
        -0.105,
        0.31,
        colors.sandstone,
      );
      fbox(
        out,
        'stone',
        face,
        (i + 1) * width - 0.265,
        (i + 1) * width,
        0.14,
        3.58,
        -0.105,
        0.31,
        colors.sandstone,
      );
      if (level >= 2) {
        fbox(out, 'cap', face, i * width, i * width + 0.32, 0.13, 0.34, -0.11, 0.36, colors.sill);
        fbox(
          out,
          'cap',
          face,
          (i + 1) * width - 0.32,
          (i + 1) * width,
          0.13,
          0.34,
          -0.11,
          0.36,
          colors.sill,
        );
      }
    }
    fbox(out, 'cap', face, 0, face.length, 3.55, 3.74, -0.15, 0.28, colors.crown);
    fbox(
      out,
      'stone',
      face,
      0,
      face.length,
      3.72,
      roofBase + 0.018,
      -0.68,
      0.06,
      colors.sandstone,
      { bottom: true },
    );
  });
}

function build(sink, level) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  extrude(out, 'foundation', outside, -1.75, 0.19, colors.foot, {
    holes: [courtRecess],
    top: false,
  });
  extrude(out, 'stone', outside, 0.19, roofBase, colors.sandstone, {
    holes: [courtRecess],
    topSlot: 'roof',
    topColor: colors.roof,
  });
  extrude(out, 'stone', outside, roofBase - 0.06, wallTop - 0.15, colors.sandstone, { top: false });
  along(outside, (face, index) => {
    // Use the original map sequence for the façade controls, independently of cap winding.
    const edge = mappedRing.indexOf(outside[index]);
    outerDetails(out, face, edge, level);
  });

  for (const ring of cornerRectangles) {
    extrude(out, 'stone', ring, wallTop - 0.24, turretTop, colors.masonry, {
      topSlot: 'roof',
      topColor: colors.roof,
    });
    along(ring, (face) => {
      crown(out, face, 0.095, face.length - 0.095, turretTop, level, true);
    });
  }
  entrance(out, level);
  courtyard(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'duwisib-castle-model.mjs';
const camera = [-34, 17, 48];
const lookAt = [0, 5.1, 1.3];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'palace-castle-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'Duwisib Castle in local red sandstone, with four square crenellated corners, a tall oriel entrance and an arcaded central courtyard.',
  camera,
  lookAt,
  sunDirection: [-26, 57, 37],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outside,
    minimumCoverage: 0.95,
    basis:
      'Named OpenStreetMap way 187024367 maps the four stone ranges and projecting gate tower.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-footprint-caps.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-oriel-gate', position: [-3, 6, 40], lookAt: [-1, 5.6, 16] },
    { name: 'west-sandstone-corners', position: [-43, 10, 17], lookAt: [-11, 4.3, 3] },
    { name: 'open-court', position: [18, 36, 30], lookAt: [0, 1.8, -1] },
    { name: 'north-parapet', position: [27, 12, -40], lookAt: [0, 5, -7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'duwisib-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.08, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.024, surfaces },
    },
  },
};
