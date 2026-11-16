import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const {
  footprint: [[left, right], [front, back]],
  floor,
  eave,
  roofPitchRise,
} = plan.dimensions;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.73, metallic: 0.4 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.96, metallic: 0 },
  finish: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
};
const palette = {
  clapboard: rgb('e4b69d'),
  inside: rgb('7c6353'),
  fascia: rgb('735146'),
  roof: rgb('57545a'),
  foundation: rgb('68635e'),
  deck: rgb('58514a'),
  sign: rgb('eee4d6'),
  letters: rgb('30241e'),
  seating: rgb('9dbaba'),
  trim: rgb('776052'),
};

function face(out, slot, points, tint) {
  quad(out, slot, points, normalFor(...points), tint);
}

const glyphs = {
  K: [
    [0, 0, 0, 1],
    [0, 0.46, 0.78, 1],
    [0.18, 0.56, 0.82, 0],
  ],
  E: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 1],
    [0, 0.52, 0.62, 0.52],
    [0, 0, 0.72, 0],
  ],
  I: [
    [0.08, 0, 0.72, 0],
    [0.4, 0, 0.4, 1],
    [0.08, 1, 0.72, 1],
  ],
  T: [
    [0, 1, 0.8, 1],
    [0.4, 1, 0.4, 0],
  ],
  H: [
    [0, 0, 0, 1],
    [0, 0.5, 0.78, 0.5],
    [0.78, 0, 0.78, 1],
  ],
  P: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 1],
    [0.72, 1, 0.72, 0.5],
    [0.72, 0.5, 0, 0.5],
  ],
  A: [
    [0, 0, 0.4, 1],
    [0.4, 1, 0.8, 0],
    [0.15, 0.36, 0.65, 0.36],
  ],
  R: [
    [0, 0, 0, 1],
    [0, 1, 0.72, 1],
    [0.72, 1, 0.72, 0.54],
    [0.72, 0.54, 0, 0.54],
    [0.28, 0.54, 0.79, 0],
  ],
};

function lettering(out, center, height, z) {
  const word = 'KEITH PARK';
  for (const [index, letter] of [...word].entries()) {
    const x = center + (word.length / 2 - index - 0.15) * 0.172;
    for (const [x0, y0, x1, y1] of glyphs[letter] ?? []) {
      const dx = -0.172 * (x1 - x0);
      const dy = 0.178 * (y1 - y0);
      const length = Math.hypot(dx, dy);
      const px = (-dy / length) * 0.0145;
      const py = (dx / length) * 0.0145;
      const a = [x - x0 * 0.172, height + y0 * 0.178];
      const b = [a[0] + dx, a[1] + dy];
      face(
        out,
        'finish',
        [
          [a[0] - px, a[1] - py, z],
          [a[0] + px, a[1] + py, z],
          [b[0] + px, b[1] + py, z],
          [b[0] - px, b[1] - py, z],
        ],
        palette.letters,
      );
    }
  }
}

function bench(out, detail) {
  const x0 = -2.23,
    x1 = -0.58,
    z = front - 0.37;
  const seat = floor + 0.43;
  for (const x of [x0 + 0.14, x1 - 0.14]) {
    box(out, 'finish', [x - 0.035, floor, z - 0.35], [x + 0.035, seat, z - 0.28], palette.trim);
    beam(out, 'finish', [x, floor, z + 0.06], [x, seat + 0.5, z + 0.16], 0.075, 0.06, palette.trim);
  }
  if (detail < 2) {
    box(out, 'finish', [x0, seat, z - 0.46], [x1, seat + 0.06, z + 0.1], palette.seating);
    box(out, 'finish', [x0, seat + 0.14, z + 0.08], [x1, seat + 0.52, z + 0.15], palette.seating);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const depth = z - 0.45 + i * 0.131;
    const y = seat + 0.15 + i * 0.1;
    box(out, 'finish', [x0, seat, depth], [x1, seat + 0.055, depth + 0.11], palette.seating);
    box(out, 'finish', [x0, y, z + 0.09], [x1, y + 0.082, z + 0.14], palette.seating);
  }
  if (detail === 3)
    for (const x of [x0 + 0.14, x1 - 0.14])
      box(
        out,
        'finish',
        [x - 0.05, seat - 0.055, z - 0.44],
        [x + 0.05, seat, z + 0.13],
        palette.trim,
      );
}

function draw(out, detail) {
  const z0 = front - 0.24,
    z1 = back + 0.15;
  const roofY = (z) => eave + roofPitchRise + ((z - z0) / (z1 - z0)) * (0.06 - roofPitchRise);
  const wallTop = (z) => roofY(z) - 0.105;
  const w = 0.14;
  const doorLeft = -0.69,
    doorRight = 0.51,
    doorTop = floor + 2.09;
  box(
    out,
    'concrete',
    [left - 0.09, -0.43, front - 0.05],
    [right + 0.09, floor, back + 0.1],
    palette.foundation,
  );
  box(out, 'concrete', [-4.42, -0.36, -4.12], [4.42, floor - 0.03, front - 0.045], palette.deck);
  box(
    out,
    'finish',
    [-4.42, floor - 0.03, -4.12],
    [4.42, floor - 0.025, front - 0.045],
    palette.deck,
  );
  box(out, 'siding', [left, floor, back - w], [right, wallTop(back), back], palette.clapboard);
  for (const [x0, x1] of [
    [left, left + w],
    [right - w, right],
  ]) {
    const far = back - w;
    const near = front + w;
    face(
      out,
      'siding',
      [
        [x0, floor, near],
        [x0, floor, far],
        [x0, wallTop(far), far],
        [x0, wallTop(near), near],
      ],
      palette.clapboard,
    );
    face(
      out,
      'siding',
      [
        [x1, floor, far],
        [x1, floor, near],
        [x1, wallTop(near), near],
        [x1, wallTop(far), far],
      ],
      palette.clapboard,
    );
  }
  for (const [x0, x1, y0] of [
    [left, doorLeft, floor],
    [doorRight, right, floor],
    [doorLeft, doorRight, doorTop],
  ])
    box(out, 'siding', [x0, y0, front], [x1, wallTop(front), front + w], palette.clapboard);
  box(
    out,
    'finish',
    [doorLeft - 0.06, floor, front + 0.88],
    [doorRight + 0.05, doorTop + 0.07, front + 0.92],
    palette.inside,
  );
  for (const x of [doorLeft, doorRight - 0.044])
    box(
      out,
      'finish',
      [x, floor, front - 0.025],
      [x + 0.044, doorTop, front + 0.035],
      palette.trim,
    );
  box(
    out,
    'finish',
    [doorLeft, doorTop - 0.053, front - 0.025],
    [doorRight, doorTop, front + 0.035],
    palette.trim,
  );
  box(
    out,
    'finish',
    [-1.34, doorTop + 0.08, front - 0.034],
    [1.16, doorTop + 0.41, front - 0.001],
    palette.sign,
  );
  const roof = [
    [left - 0.19, roofY(z0), z0],
    [left - 0.19, roofY(z1), z1],
    [right + 0.19, roofY(z1), z1],
    [right + 0.19, roofY(z0), z0],
  ];
  face(out, 'roof', roof, palette.roof);
  const underside = roof.map(([x, y, z]) => [x, y - 0.13, z]);
  face(out, 'finish', [...underside].reverse(), palette.fascia);
  for (let i = 0; i < roof.length; i++) {
    const next = (i + 1) % roof.length;
    face(out, 'finish', [roof[next], roof[i], underside[i], underside[next]], palette.fascia);
  }
  bench(out, detail);
  if (detail >= 1) {
    for (const x of [left, right - 0.081])
      box(
        out,
        'finish',
        [x, floor, front - 0.026],
        [x + 0.081, wallTop(front) - 0.028, front + 0.075],
        palette.fascia,
      );
    for (const x of [-3.7, -2.4, -1, 0.5, 1.8, 3.4])
      box(out, 'finish', [x, -0.24, -4.16], [x + 0.055, floor - 0.047, -4.12], palette.trim);
  }
  if (detail >= 2) lettering(out, -0.15, doorTop + 0.153, front - 0.037);
  if (detail === 3)
    for (const x of [-1.25, 1.07])
      box(
        out,
        'finish',
        [x, doorTop + 0.223, front - 0.043],
        [x + 0.022, doorTop + 0.248, front - 0.035],
        palette.trim,
      );
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [8.8, 5.9, -11.3];
const lookAt = [0, 1.27, -1.55];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.geometryBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: plan.sectionBasis,
  camera,
  lookAt,
  sunDirection: [-45, 70, -80],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['wood_weatherboard', 'metal_corrugated', 'concrete_boardformed'],
  mediumFiContext: {
    scale: 0.7,
    cameraYaw: 2.47,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'rail-facing-shelter', position: [1.5, 4.1, -12], lookAt },
    { name: 'station-name-and-bench', position: [0.2, 2.7, -6.2], lookAt: [-0.55, 1.46, front] },
    { name: 'rear-wall-and-roof', position: [-7.3, 5.9, 8.6], lookAt },
    { name: 'platform-edge-and-terrain', position: [6.4, 2.5, -8], lookAt: [0, 0.45, front] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.12,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.064, surfaces },
      street: { export: 'street', errorMeters: 0.034, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.016, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original exterior reconstruction from the public-domain Qualla photograph and attributed open footprint and terrain data.',
};
