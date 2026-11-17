/** The surviving Temple of the Inscriptions, Palenque. Dimensions in metres. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const { tiers, sanctuary, stairCenter, flights, doorWidths, friezeBase, friezeTop, crest } =
  plan.section;
const palette = Object.fromEntries(
  Object.entries({
    block: 'a39b8a',
    face: 'b2a998',
    faded: 'bdb2a1',
    highlight: 'c9c0b0',
    shade: '938b7c',
    depth: '7d776d',
    seam: '8d8371',
    mortar: 'a79b88',
    moss: '7e856c',
    plaster: 'beb29d',
    relief: 'c8bba2',
    door: '656052',
    floor: '9b917f',
    chink: '83796a',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  block: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  weather: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  shadow: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};

const corners = (x0, x1, z0, z1, y) => [
  [x0, y, z1],
  [x1, y, z1],
  [x1, y, z0],
  [x0, y, z0],
];
const blend = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function ledge(out, lower, upper, slot, colors) {
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, slot, [lower[i], lower[j], upper[j], upper[i]], colors[i]);
  }
}

function rubble(out, lower, upper, tier, lod) {
  if (lod < 2) return;
  // Shallow irregular stones accent the coursed backdrop. Leave the long
  // platform ledge continuous at distances where the joints become subpixel.
  for (let side = 0; side < 4; side++) {
    const j = (side + 1) % 4;
    const n = lod === 2 ? 16 : 25;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.15) / n,
        b = a + (0.28 + 0.12 * (i % 4)) / n;
      const base = 0.12 + ((i * 7 + tier * 13) % 61) / 100;
      const high = Math.min(0.97, base + 0.14 + ((i + tier) % 3) * 0.047);
      const edge = (u, v) =>
        blend(blend(lower[side], lower[j], u), blend(upper[side], upper[j], u), v);
      const normal = [
        [0, 0, 1],
        [1, 0, 0],
        [0, 0, -1],
        [-1, 0, 0],
      ][side];
      const shift = (point) => point.map((v, k) => v + normal[k] * (0.037 + (i % 3) * 0.017));
      const baseColor = tier < 3 ? palette.shade : palette.block;
      const tints = [0.91, 1.06, 0.98, 1.03, 1.0].map((factor) =>
        baseColor.map((value) => value * factor),
      );
      const tone = tier < 3 && i % 7 === 0 ? palette.moss : tints[(i + tier) % tints.length];
      face(
        out,
        'block',
        [
          shift(edge(a, base)),
          shift(edge(b, base + 0.024)),
          shift(edge(b - 0.004, high)),
          shift(edge(a + 0.005, high)),
        ],
        tone,
      );
    }
  }
}

function pyramid(out, lod) {
  for (let i = 0; i < tiers.length; i++) {
    const [x0, x1, z0, z1, y0, y1] = tiers[i];
    const inset = i === 8 ? 0.82 : i < 2 ? 1.09 : 0.66;
    const foot = corners(x0, x1, z0, z1, y0);
    const slope = corners(x0 + inset, x1 - inset, z0 + inset, z1 - inset, y1 - 0.25);
    const lip = corners(
      x0 + inset - 0.13,
      x1 - inset + 0.13,
      z0 + inset - 0.13,
      z1 - inset + 0.13,
      y1,
    );
    const slot = i < 4 ? 'weather' : 'ashlar';
    const colors =
      i < 3
        ? [palette.shade, palette.block, palette.depth, palette.block]
        : [palette.block, palette.face, palette.shade, palette.face];
    ledge(out, foot, slope, slot, colors);
    if (lod) {
      ledge(out, slope, lip, 'block', [
        palette.faded,
        palette.highlight,
        palette.block,
        palette.faded,
      ]);
    }
    face(out, 'block', lip, palette.block);
    rubble(out, foot, slope, i, lod);
    if (i === 0) {
      const bottom = corners(x0, x1, z0, z1, -3.22);
      ledge(out, bottom, foot, 'weather', colors);
    }
  }
}

function stepBlock(out, left, right, z0, z1, y0, y1, lod, index) {
  let tone = index % 6 === 0 ? palette.faded : palette.block;
  if (lod > 1 && index % 7 === 2) tone = palette.face;
  face(
    out,
    'block',
    [
      [left, y1, z1],
      [right, y1, z1],
      [right, y1, z0],
      [left, y1, z0],
    ],
    tone,
  );
  face(
    out,
    'ashlar',
    [
      [left, y0, z1],
      [right, y0, z1],
      [right, y1, z1],
      [left, y1, z1],
    ],
    palette.shade,
  );
  if (lod < 2) return;
  const count = lod === 3 ? 5 : 3;
  for (let i = 1; i < count; i++) {
    const x = left + (right - left) * (i / count) + Math.sin(i * 1.8 + index * 0.94) * 0.18;
    face(
      out,
      'block',
      [
        [x - 0.025, y0 + 0.035, z1 + 0.012],
        [x + 0.013, y0 + 0.028, z1 + 0.012],
        [x + 0.037, y1 - 0.028, z1 + 0.012],
        [x + 0.003, y1 - 0.021, z1 + 0.012],
      ],
      palette.seam,
    );
  }
}

function stairway(out, lod) {
  for (let f = 0; f < flights.length; f++) {
    const [near, far, bottom, top, width0, width1, actual] = flights[f];
    const steps = lod === 0 ? 3 : lod === 1 ? Math.ceil(actual / 2) : actual;
    for (let i = 0; i < steps; i++) {
      const start = i / steps,
        end = (i + 1) / steps;
      const wide = (width0 + ((width1 - width0) * (start + end)) / 2) / 2;
      const z1 = near + (far - near) * start,
        z0 = near + (far - near) * end;
      const y0 = bottom + (top - bottom) * start,
        y1 = bottom + (top - bottom) * end;
      stepBlock(out, stairCenter - wide, stairCenter + wide, z0, z1, y0, y1, lod, i + f * 20);
    }
    // Keep cheek walls continuous over the front of the battered masonry,
    // including between the landing ledges.
    const foundation = [bottom - 0.62, top - 1.1];
    for (const side of [-1, 1]) {
      const x0 = stairCenter + (width0 / 2) * side,
        x1 = stairCenter + (width1 / 2) * side;
      const rim = [
        [x0, foundation[0], near],
        [x1, foundation[1], far],
        [x1, top, far],
        [x0, bottom, near],
      ];
      face(out, 'weather', side === 1 ? rim : rim.reverse(), palette.shade);
      if (f === 4) {
        const slope = [
          [x0 + side * 0.04, bottom + 0.05, near],
          [x0 + side * 1.43, bottom + 0.05, near],
          [x1 + side * 1.3, top + 0.43, far],
          [x1 + side * 0.04, top + 0.43, far],
        ];
        face(out, 'block', side === 1 ? slope : slope.reverse(), palette.highlight);
        const outside = [slope[1], slope[2]];
        if (lod) beam(out, 'block', outside[0], outside[1], 0.2, 0.16, palette.faded);
      }
    }
    if (f + 1 < flights.length) {
      const start = flights[f + 1][0],
        w = Math.min(width1, flights[f + 1][4]) / 2;
      face(
        out,
        'block',
        [
          [stairCenter - w, top, far],
          [stairCenter + w, top, far],
          [stairCenter + w, top, start],
          [stairCenter - w, top, start],
        ],
        palette.block,
      );
    }
  }
}

function panelFragment(out, x, y, z, lod, index) {
  if (lod < 2) return;
  const height = index % 2 === 0 ? 1.39 : 1.08;
  const width = 0.36 + (index % 3) * 0.1;
  const points = [
    [x - width, y, z],
    [x + width, y + 0.1, z + 0.028],
    [x + width * 0.89, y + height * 0.63, z + 0.025],
    [x + width * 0.15, y + height, z + 0.028],
    [x - width * 0.85, y + height * 0.48, z + 0.043],
  ];
  for (let i = 1; i < points.length - 1; i++) {
    triangle(out, 'plaster', [points[0], points[i], points[i + 1]], palette.relief);
  }
  if (lod > 2) {
    for (const shift of [-0.18, 0.14]) {
      beam(
        out,
        'block',
        [x + shift, y + 0.19, z + 0.041],
        [x + shift * 0.59, y + height * 0.52, z + 0.068],
        0.068,
        0.057,
        palette.highlight,
      );
    }
  }
}

function sanctuaryWalls(out, lod) {
  const [left, right, rear, front] = sanctuary;
  const floor = 24,
    high = friezeBase - 0.26;
  const rearWallZ = rear + 0.18;
  const westWall = [
    [left, floor, rear],
    [left, floor, front],
    [left, high, front],
    [left, high, rear],
  ];
  const eastWall = [
    [right, floor, front],
    [right, floor, rear],
    [right, high, rear],
    [right, high, front],
  ];
  face(out, 'ashlar', westWall, palette.faded);
  face(out, 'ashlar', eastWall, palette.face);
  face(
    out,
    'ashlar',
    [
      [right, floor, rear],
      [left, floor, rear],
      [left, high, rear],
      [right, high, rear],
    ],
    palette.block,
  );
  const depth = 1.16;
  const centers = [-8.6, -4.16, 0.4, 4.95, 9.39];
  const spans = centers.map((x, i) => [x - doorWidths[i] / 2, x + doorWidths[i] / 2]);
  const piers = [
    [left, spans[0][0]],
    ...spans.slice(1).map(([x], i) => [spans[i][1], x]),
    [spans.at(-1)[1], right],
  ];
  for (const [i, [a, b]] of piers.entries()) {
    box(out, 'ashlar', [a, floor, front - depth], [b, high, front], palette.faded);
    if (i > 0 && i < 5) panelFragment(out, (a + b) / 2, floor + 0.68, front + 0.037, lod, i);
    if (lod > 1) {
      box(
        out,
        'block',
        [a - 0.032, floor + 0.08, front - 0.02],
        [b + 0.032, floor + 0.31, front + 0.11],
        palette.highlight,
      );
    }
  }
  const lintelY = floor + 2.63;
  for (const [i, [a, b]] of spans.entries()) {
    const lintel = lintelY + (i === 2 ? 0.18 : 0.03);
    box(out, 'block', [a, lintel, front - depth], [b, high, front], palette.highlight);
  }
  face(
    out,
    'shadow',
    [
      [left, floor, rearWallZ],
      [right, floor, rearWallZ],
      [right, high, rearWallZ],
      [left, high, rearWallZ],
    ],
    palette.door,
  );
  face(out, 'block', corners(left, right, rear, front, floor), palette.floor);
  if (lod > 1) {
    const divider = front - 3.01;
    for (const dx of [-6.15, 6.8]) {
      box(
        out,
        'ashlar',
        [dx - 0.43, floor, divider],
        [dx + 0.43, high, front - depth - 0.4],
        palette.shade,
      );
    }
  }
}

function sanctuaryRoof(out, lod) {
  const [left, right, rear, front] = sanctuary;
  box(
    out,
    'block',
    [left - 0.44, friezeBase - 0.27, rear - 0.36],
    [right + 0.44, friezeBase + 0.11, front + 0.37],
    palette.highlight,
  );
  const eave = corners(left - 0.81, right + 0.81, rear - 0.46, front + 0.45, friezeBase - 0.17);
  const base = corners(left - 0.73, right + 0.72, rear - 0.36, front + 0.38, friezeBase + 0.22);
  const crown = corners(left + 0.53, right - 0.58, rear + 1.0, front - 1.29, friezeTop - 0.25);
  const cornice = corners(left + 0.44, right - 0.48, rear + 0.9, front - 1.18, friezeTop + 0.05);
  const mounts = [palette.highlight, palette.highlight, palette.shade, palette.faded];
  ledge(out, eave, base, 'block', mounts);
  ledge(out, base, crown, 'ashlar', [palette.faded, palette.face, palette.shade, palette.faded]);
  ledge(out, crown, cornice, 'block', mounts);
  face(out, 'block', cornice, palette.highlight);
  if (lod) {
    const count = [0, 6, 9, 15][lod];
    const span = right - left - 3.8;
    for (let i = 0; i < count; i++) {
      const x = left + 1.9 + ((i + 0.52) * span) / count;
      const height = 0.08 + (i % 4) * 0.086;
      box(
        out,
        'block',
        [x - 0.24, friezeTop + 0.045, -5.56],
        [x + 0.23, Math.min(crest, friezeTop + height + 0.055), -5.14],
        palette.shade,
      );
    }
    rubble(out, base, crown, 8, lod);
  }
}

function build(out, lod) {
  pyramid(out, lod);
  stairway(out, lod);
  sanctuaryWalls(out, lod);
  sanctuaryRoof(out, lod);
}
export const inscriptionsSkyline = (out) => build(out, 0);
export const inscriptionsDistrict = (out) => build(out, 1);
export const inscriptionsStreet = (out) => build(out, 2);
export const inscriptionsCloseup = (out) => build(out, 3);
const recipe = 'temple-of-the-inscriptions-model.mjs';
const camera = [-30, 33, 77],
  lookAt = [-2, 13, 5];
export const inscriptionsModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  surfaces,
  category: 'landmark',
  build: inscriptionsCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The surviving stepped Temple of the Inscriptions at Palenque. Limestone terraces, the north stair, five-opening sanctuary, and surviving roof crest stubs.',
  camera,
  lookAt,
  sunDirection: [-25, 59, 82],
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_raw',
    'stone_limestone_weathered',
    'plaster_lime',
  ],
  groundCutout: {
    outline: [
      [-33.87, -17.22],
      [19.95, -17.22],
      [19.95, 17.28],
      [5.8, 17.28],
      [5.8, 24.4],
      [-5.0, 24.4],
      [-5.0, 17.28],
      [-33.87, 17.28],
    ],
    basis:
      'Under the measured lower temple platform and main stair. Retains the independent original hill and the adjacent Temple XIII footprint outside the mask.',
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    basis:
      'The exact named standing pyramid in the local map. Replace directly overlapping generated geometry for this ruin.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'north-pyramid-and-stair', position: [-19, 8.8, 55], lookAt: [0.7, 14.8, 2.5] },
    {
      name: 'five-openings-and-roof-comb',
      position: [-17.7, 29.6, 24.7],
      lookAt: [0.2, 26.1, -4.7],
    },
    { name: 'east-terraces-and-hill-contact', position: [-62, 22, -12], lookAt: [-2, 15, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'inscriptionsSkyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'inscriptionsDistrict', 0.33],
        ['street', 'inscriptionsStreet', 0.13],
        ['closeup', 'inscriptionsCloseup', 0.055],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Tbachner and Candiderm released the two exact reference photographs to the public domain. OpenStreetMap outline under ODbL 1.0.',
};
