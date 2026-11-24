import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { floorSampler } from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grade = floorSampler(read('terrain-grid.json'));
const surfaces = {
  white: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  ashlar: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87 },
  lacquer: { slot: 'trim', graph: 'wood_painted_shingle', roughness: 0.86 },
  gold: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.58, metallic: 0.23 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.91 },
};
const white = rgb('e9e1cc');
const stone = rgb('92918b');
const paving = rgb('bbb6a9');
const grass = rgb('788461');
const tile = rgb('a95d44');
const tileShade = rgb('8c4439');
const red = rgb('74392f');
const brass = rgb('b68b40');
const gold = rgb('d5ac51');
const paleGold = rgb('ead17d');
const shade = rgb('49413c');

const deck = plan.dimensions.terraceDeckAboveApproachDatumM;
const eave = deck + 5.91;
const hall = 3.79;
const sides = [
  facade([0, 0], [1, 0]),
  facade([0, 0], [0, 1]),
  facade([0, 0], [-1, 0]),
  facade([0, 0], [0, -1]),
];

function box(out, slot, x0, z0, x1, z1, low, high, color) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}

function molding(out, slot, x, z, profile, sides, color) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z], Math.PI / sides)),
    color,
    { cap: false },
  );
}

function terrace(out, lod) {
  const outline = frame.geometry.outline;
  extrude(out, 'ashlar', outline, -0.45, deck - 0.15, stone, { top: false });
  const coping = outline.map(([x, z]) => [x * 1.015, z * 1.014]);
  extrude(out, 'ashlar', coping, deck - 0.15, deck, paving, { top: false });
  const corners = outwardRing([coping[0], coping[1], coping[2], coping[4]]);
  quad4(out, 'ashlar', ...corners.map(([x, z]) => [x, deck, z]), paving);
  // Render the documented raised plot as a planted embankment below the stone terrace.
  const bankTop = outwardRing([
    [-8.12, -7.03],
    [8.12, -7.03],
    [8.12, 7.03],
    [1.34, 7.03],
    [-2.24, 7.03],
    [-8.12, 7.03],
  ]);
  const bankFoot = bankTop.map(([x, z]) => [x * 1.4, z < 0 ? z * 1.22 : z * 1.94]);
  for (let i = 0; i < bankTop.length; i++) {
    const next = (i + 1) % bankTop.length;
    const [x0, z0] = bankFoot[i];
    const [x1, z1] = bankFoot[next];
    const [a, b] = [bankTop[i], bankTop[next]];
    const low = (x, z) => [x, Math.min(deck - 1.55, grade([x, z]) - 0.07), z];
    const high = ([x, z]) => [x, deck - 1.38, z];
    quad4(out, 'grass', low(x0, z0), low(x1, z1), high(b), high(a), grass);
  }
  const stair = facade([-0.45, 7.11], [1, 0]);
  const run = 6.54;
  const start = deck - 0.09;
  const end = grade([-0.45, 7.11 + run]) + 0.18;
  const count = [4, 10, 21, 25][lod];
  for (let i = 0; i < count; i++) {
    const near = (run * i) / count;
    const far = (run * (i + 1)) / count;
    const top = Math.max(start + ((end - start) * i) / count, grade([-0.45, 7.11 + far]) + 0.19);
    fbox(
      out,
      'ashlar',
      stair,
      -1.78,
      1.78,
      Math.min(-0.48, end - 0.26),
      top,
      near - 0.03,
      far,
      paving,
    );
  }
  if (lod > 0)
    for (const side of [-1, 1]) {
      const x = side * 1.88 - 0.45;
      beam(out, 'ashlar', [x, deck + 0.13, 6.99], [x, end + 0.33, 7.11 + run], 0.28, 0.28, stone);
    }
}

function column(out, x, z, lod) {
  if (lod > 0)
    box(out, 'ashlar', x - 0.25, z - 0.25, x + 0.25, z + 0.25, deck, deck + 0.17, paving);
  box(out, 'white', x - 0.173, z - 0.173, x + 0.173, z + 0.173, deck + 0.16, eave - 0.83, white);
  if (lod === 0) {
    box(out, 'gold', x - 0.235, z - 0.235, x + 0.235, z + 0.235, eave - 0.86, eave - 0.18, gold);
    return;
  }
  molding(
    out,
    'gold',
    x,
    z,
    [
      [eave - 1.48, 0.189],
      [eave - 1.08, 0.27],
      [eave - 0.83, 0.223],
      [eave - 0.55, 0.315],
      [eave - 0.2, 0.386],
    ],
    lod === 1 ? 4 : 8,
    brass,
  );
  if (lod > 1)
    for (const dir of sides) {
      const [a, b] = dir.normal;
      beamPath(
        out,
        'gold',
        [
          [x + a * 0.2, eave - 1.25, z + b * 0.2],
          [x + a * 0.28, eave - 0.88, z + b * 0.28],
          [x + a * 0.4, eave - 0.43, z + b * 0.4],
        ],
        0.079,
        0.064,
        paleGold,
      );
    }
}

function openings(out, F, width, height, base, lod) {
  const threshold = base + 0.13;
  const upper = threshold + height;
  const left = -width / 2;
  const right = width / 2;
  if (lod > 0)
    fbox(out, 'lacquer', F, left - 0.12, right + 0.12, threshold, upper + 0.12, 0, 0.045, red);
  fbox(out, 'dark', F, left, right, threshold + 0.02, upper, 0.049, 0.073, shade);
  const corner = (u, y) => F.P(u, y, 0.104);
  const peak = corner(0, upper + 1.35);
  tri(
    out,
    'gold',
    corner(left - 0.17, upper + 0.09),
    corner(right + 0.17, upper + 0.09),
    peak,
    brass,
  );
  if (lod > 0) {
    beamPath(
      out,
      'gold',
      [
        corner(left - 0.17, threshold),
        corner(left - 0.17, upper + 0.07),
        peak,
        corner(right + 0.17, upper + 0.07),
        corner(right + 0.17, threshold),
      ],
      0.112,
      0.092,
      paleGold,
    );
    if (lod > 1)
      for (const u of [-0.38, 0.38]) {
        const ornament = corner(u * width, upper + 0.16);
        const top = corner(u * width * 0.68, upper + 0.56);
        beam(out, 'gold', ornament, top, 0.09, 0.073, paleGold);
      }
  }
}

function enclosure(out, lod) {
  box(out, 'white', -hall, -hall, hall, hall, deck, eave + 0.1, white);
  for (const side of sides) {
    const [a, b] = side.normal;
    const [c, d] = side.along;
    openings(out, facade([hall * a, hall * b], [c, d]), 1.32, 2.52, deck, lod);
    for (const u of [-3.03, 3.03]) {
      const [x, , z] = side.P(u, deck, 5.34);
      column(out, x, z, lod);
    }
    const [x, , z] = side.P(0, deck, 5.32);
    if (lod > 0) {
      const F = facade([x, z], [c, d]);
      fbox(out, 'lacquer', F, -3.79, 3.79, eave - 0.35, eave - 0.14, -0.45, 0.36, red);
    }
  }
  for (const [x, z] of [
    [-4.44, -4.44],
    [-4.44, 4.44],
    [4.44, -4.44],
    [4.44, 4.44],
  ])
    column(out, x, z, lod);
}

function roof(out, { base, height, width, arm, color, decorated }, lod) {
  const profile =
    lod > 0
      ? [
          [0, 0],
          [0.22, 0.105],
          [0.5, 0.33],
          [0.74, 0.63],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.5, 0.33],
          [1, 1],
        ];
  for (const side of sides) {
    const end = side.normal[0] === 0 ? arm[0] : arm[1];
    const P = (signed, step, depth, lift = 0) =>
      side.P(
        signed * width * (1 - profile[step][0]),
        base + height * profile[step][1] + lift,
        depth,
      );
    for (const sign of [-1, 1]) {
      for (let j = 1; j < profile.length; j++) {
        const valley0 = width * (1 - profile[j - 1][0]);
        const valley1 = width * (1 - profile[j][0]);
        const face = [
          P(sign, j - 1, valley0),
          P(sign, j - 1, end),
          P(sign, j, end),
          P(sign, j, valley1),
        ];
        quad4(out, 'tile', ...(sign > 0 ? face.reverse() : face), sign > 0 ? color : tileShade);
        const toe = P(sign, j - 1, end - 0.045);
        const tip = P(sign, j, end - 0.045);
        const ground = [toe[0], base - 0.12, toe[2]];
        const inner = [tip[0], base - 0.12, tip[2]];
        const panel = [toe, tip, inner, ground];
        quad4(out, 'lacquer', ...(sign > 0 ? panel : panel.reverse()), red);
        if (lod > 1 && decorated)
          beam(out, 'gold', P(sign, j, end + 0.08), P(sign, j - 1, end + 0.08), 0.12, 0.082, brass);
      }
      const fascia = facade(side.origin, side.along);
      const outline = profile.map((_, j) => P(sign, j, end, 0.075));
      if (lod > 0) beamPath(out, 'gold', outline, 0.16, 0.135, gold);
      else
        for (let j = 1; j < outline.length; j++) {
          const a = outline[j - 1];
          const b = outline[j];
          const c = [b[0], b[1] - 0.15, b[2]];
          const d = [a[0], a[1] - 0.15, a[2]];
          const face = [a, b, c, d];
          quad4(out, 'gold', ...(sign > 0 ? face : face.reverse()), gold);
        }
      const u = sign * width;
      if (lod > 0)
        beam(
          out,
          'lacquer',
          side.P(u, base + 0.008, width),
          side.P(u, base + 0.008, end),
          0.18,
          0.24,
          red,
        );
      if (lod > 0 && decorated)
        beamPath(
          out,
          'gold',
          [
            fascia.P(u - sign * 0.66, base + 0.19, end),
            fascia.P(u - sign * 0.26, base + 0.07, end + 0.03),
            fascia.P(u, base + 0.52, end + 0.13),
            fascia.P(u - sign * 0.06, base + 0.79, end + 0.095),
          ],
          0.13,
          0.105,
          gold,
        );
    }
    if (decorated) {
      const top = base + height;
      if (lod > 0)
        beamPath(
          out,
          'gold',
          [
            side.P(0, top - 0.04, end - 0.38),
            side.P(0, top + 0.56, end + 0.05),
            side.P(0, top + 1.08, end + 0.17),
            side.P(0, top + 1.27, end + 0.38),
          ],
          0.12,
          0.105,
          paleGold,
        );
      else
        beam(
          out,
          'gold',
          side.P(0, top - 0.15, end - 0.09),
          side.P(0, top + 1.12, end + 0.17),
          0.14,
          0.14,
          paleGold,
        );
      if (lod > 1) {
        for (const u of [-0.25, 0.25, -0.48, 0.48, -0.68, 0.68]) {
          const y = base + height * (1 - Math.abs(u)) * 0.72;
          const a = side.P(u * width, base + 0.13, end + 0.012);
          const b = side.P(u * width * 0.89, y, end + 0.033);
          beam(out, 'gold', a, b, 0.074, lod > 1 ? 0.066 : 0.038, brass);
        }
        if (lod > 1)
          for (const u of [-1, 1]) {
            const a = side.P(0, base + 0.22, end + 0.09);
            const b = side.P(u * width * 0.41, base + 0.7, end + 0.08);
            const c = side.P(u * width * 0.58, base + 0.4, end + 0.04);
            beamPath(out, 'gold', [a, b, c], 0.127, 0.085, paleGold);
          }
      }
    }
  }
  // Closing soffit under the projecting wings reads red from the lower approach.
  const z = arm[0];
  const x = arm[1];
  const w = width;
  extrude(
    out,
    'lacquer',
    [
      [-w, -z],
      [w, -z],
      [w, -w],
      [x, -w],
      [x, w],
      [w, w],
      [w, z],
      [-w, z],
      [-w, w],
      [-x, w],
      [-x, -w],
      [-w, -w],
    ],
    base - 0.21,
    base - 0.045,
    red,
    { top: false },
  );
  // Use the nonoverlapping center and four wings for horizontal soffit faces.
  for (const [x0, z0, x1, z1] of [
    [-w, -w, w, w],
    [-w, -z, w, -w],
    [-w, w, w, z],
    [-x, -w, -w, w],
    [w, -w, x, w],
  ]) {
    const bottom = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    if (lod > 0) quad4(out, 'lacquer', ...bottom.map(([x, z]) => [x, base - 0.21, z]), red);
    quad4(out, 'lacquer', ...bottom.reverse().map(([x, z]) => [x, base - 0.045, z]), red);
  }
}

function steeple(out, lod) {
  const base = deck + 10.58;
  const sides = lod === 0 ? 4 : 8;
  const stages = [
    [0, 3.18, 0.32, 2.22],
    [1.12, 2.62, 0.38, 1.73],
    [2.33, 2.07, 0.39, 1.34],
    [3.62, 1.64, 0.34, 1.04],
    [4.8, 1.29, 0.28, 0.84],
  ];
  for (const [y, broad, lip, neck] of stages) {
    const low = base + y;
    molding(
      out,
      'gold',
      0,
      0,
      [
        [low, broad * 0.92],
        [low + lip, broad],
        [low + 1.03, neck],
      ],
      sides,
      gold,
    );
    if (lod > 0) {
      molding(
        out,
        'gold',
        0,
        0,
        [
          [low + lip - 0.07, broad + 0.02],
          [low + lip + 0.06, broad + 0.025],
        ],
        sides,
        paleGold,
      );
      const pins = radialRing(
        low + 0.23,
        broad * 0.92,
        broad * 0.92,
        sides,
        [0, 0],
        Math.PI / sides,
      );
      for (const [x, y, z] of lod === 1 ? pins.filter((_, i) => i % 2 === 0) : pins) {
        const bottom = [x * 0.93, y - 0.21, z * 0.93];
        const top = [x * 1.03, y + 0.68, z * 1.03];
        if (lod > 1)
          beamPath(
            out,
            'gold',
            [bottom, [x * 1.08, y + 0.31, z * 1.08], top],
            0.104,
            0.088,
            paleGold,
          );
        else beam(out, 'gold', bottom, top, 0.104, 0.088, paleGold);
      }
      if (lod > 1)
        for (const [x, y, z] of radialRing(low + 0.55, broad * 0.78, broad * 0.78, 16)) {
          beam(
            out,
            'gold',
            [x * 1.15, y - 0.13, z * 1.15],
            [x * 0.91, y + 0.29, z * 0.91],
            0.074,
            0.066,
            brass,
          );
        }
    }
  }
  molding(
    out,
    'gold',
    0,
    0,
    [
      [base - 0.6, 2.2],
      [base + 1.2, 2.14],
      [base + 5.74, 0.79],
    ],
    sides,
    brass,
  );
  const tip = deck + plan.dimensions.documentedArchitecturalHeightM;
  const spire = [
    [base + 5.43, 0.84],
    [base + 6.15, 0.93],
    [base + 6.81, 0.71],
    [base + 7.38, 0.59],
    [base + 8.84, 0.394],
    [base + 10.33, 0.292],
    [base + 11.56, 0.177],
    [base + 12.64, 0.115],
    [tip - 1.76, 0.092],
    [tip - 0.87, 0.117],
    [tip - 0.62, 0.27],
    [tip - 0.38, 0.131],
    [tip, 0.018],
  ];
  molding(out, 'gold', 0, 0, spire, sides, gold);
  if (lod > 0)
    for (let j = 3; j < 9; j++) {
      const [y, r] = spire[j];
      molding(
        out,
        'gold',
        0,
        0,
        [
          [y - 0.075, r + 0.05],
          [y + 0.041, r + 0.055],
        ],
        8,
        paleGold,
      );
    }
  if (lod > 2)
    for (const [y, r] of spire.slice(2, 7))
      for (const [x, , z] of radialRing(y, r, r, 8, [0, 0], Math.PI / 8))
        beam(
          out,
          'gold',
          [x * 1.01, y - 0.14, z * 1.01],
          [x * 0.95, y + 0.23, z * 0.95],
          0.071,
          0.056,
          paleGold,
        );
}

function build(out, lod) {
  terrace(out, lod);
  enclosure(out, lod);
  roof(
    out,
    { base: eave, height: 4.13, width: 4.45, arm: [6.49, 7.23], color: tile, decorated: true },
    lod,
  );
  roof(
    out,
    {
      base: eave + 1.72,
      height: 3.83,
      width: 3.45,
      arm: [4.74, 5.36],
      color: tile,
      decorated: true,
    },
    lod,
  );
  steeple(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'king-chulalongkorn-memorial-building-model.mjs';
const camera = [-36, 25, 44];
const lookAt = [0, 16.6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'monument',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Utanede’s royal Thai pavilion with its stone terrace, white colonnade, red cross-gables and gilt spire.',
  camera,
  lookAt,
  sunDirection: [-20, 40, 29],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Named native outline of the memorial pavilion and plinth.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_ashlar', 'tile_ceramic', 'wood_painted_shingle'],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'approach-colonnade', position: [-22, 7.4, 27], lookAt: [0, 14, 0] },
    { name: 'cross-gables-and-spire', position: [23, 20, 27], lookAt: [0, 20, 0] },
    { name: 'upper-roof-and-terrace', position: [25, 30, -29], lookAt: [0, 15.2, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'utanede-pavilion-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.93,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
