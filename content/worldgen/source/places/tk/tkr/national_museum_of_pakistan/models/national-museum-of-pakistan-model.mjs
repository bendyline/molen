import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { lettering } from '../../../../../../../../packages/worldgen/scripts/stadium-lettering.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const { outline, holes } = read('map-frame.json').geometry;
const {
  frontScreenSpan: [left, right],
  frontZ,
  finishedFloorY: floor,
  foundationBaseY: base,
  canopyY,
  screenTopY,
  frontFasciaTopY: fasciaY,
  upperPavilionRoofY: pavilionY,
  foldedCrownY: crownY,
  courtyardRoofY: roofY,
  courtyardFloorY: courtY,
} = plan.dimensions;

const surfaces = {
  plaster: { slot: 'wall', graph: 'concrete_plain', roughness: 0.84 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.71, metallic: 0.14 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.03 },
  glass: { slot: 'window', localRef: 'palette:#edf8ff', roughness: 0.31, metallic: 0.14 },
};
const colors = {
  stucco: rgb('c5ac84'),
  shaded: rgb('a58d68'),
  concrete: rgb('d4bd92'),
  cream: rgb('eee0bd'),
  light: rgb('f1eadd'),
  recess: rgb('423831'),
  dark: rgb('463d32'),
  red: rgb('b74539'),
  roof: rgb('b5a58a'),
  roofEdge: rgb('a28e6f'),
  glass: rgb('373e3a'),
  lobby: rgb('303631'),
  sign: rgb('423a31'),
  apron: rgb('d8c3a4'),
};
const v3 = ([x, z], y) => [x, y, z];

function face(out, slot, points, color) {
  quad(out, slot, points, normalFor(...points), color);
}

function front(out, slot, x0, x1, y0, y1, z, color) {
  face(
    out,
    slot,
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    color,
  );
}

function wall(out, ring, y0, y1, color) {
  for (let i = 0; i < ring.length; ++i) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    face(out, 'plaster', [v3(a, y0), v3(b, y0), v3(b, y1), v3(a, y1)], color);
  }
}

function deck(out, shell, openings, y, color, slot = 'roof') {
  const vertices = [...shell];
  const starts = [];
  for (const ring of openings) {
    starts.push(vertices.length);
    vertices.push(...ring);
  }
  const indices = earcut(vertices.flat(), starts);
  for (let i = 0; i < indices.length; i += 3) {
    const corners = indices.slice(i, i + 3).map((index) => v3(vertices[index], y));
    if (normalFor(...corners)[1] < 0) corners.reverse();
    out.addTriangle(
      slot,
      'palette:#ffffff',
      corners,
      [0, 1, 0],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
  }
}

function section(ring, z, frontSide) {
  const out = [];
  for (let i = 0; i < ring.length; ++i) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const aIn = a[1] >= z === frontSide;
    const bIn = b[1] >= z === frontSide;
    if (aIn) out.push(a);
    if (aIn !== bIn) out.push([a[0] + ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]), z]);
  }
  return out;
}

function rear(out, detail) {
  const transition = 18.7;
  const frontDeck = section(outline, transition, true);
  const backDeck = section(outline, transition, false);
  wall(out, outline, base, fasciaY, colors.stucco);
  wall(out, backDeck, fasciaY, roofY, colors.stucco);
  deck(out, frontDeck, [], fasciaY, colors.roof);
  deck(out, backDeck, holes, roofY, colors.roof);
  wall(out, backDeck, roofY, roofY + 0.28, colors.roofEdge);
  for (const inner of holes) {
    wall(out, inner, courtY, roofY + 0.26, colors.shaded);
    deck(out, inner, [], courtY, colors.apron, 'plaster');
  }
  if (detail === 0) return;
  for (let i = 0; i < backDeck.length; ++i) {
    const a = backDeck[i];
    const b = backDeck[(i + 1) % backDeck.length];
    if (a[1] === transition && b[1] === transition) continue;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const count = Math.max(1, Math.round(length / 4.5));
    const shift = [(-0.025 * dz) / length, (0.025 * dx) / length];
    const at = (t, y) => [a[0] + dx * t + shift[0], y, a[1] + dz * t + shift[1]];
    for (let j = 0; j < count; ++j) {
      const u = (j + 0.18) / count;
      const v = (j + 0.81) / count;
      face(out, 'glass', [at(u, 14.18), at(v, 14.18), at(v, 15.36), at(u, 15.36)], colors.glass);
      if (detail >= 2)
        face(
          out,
          'trim',
          [at(u, 13.96), at(v, 13.96), at(v, 14.16), at(u, 14.16)],
          colors.concrete,
        );
    }
  }
}

function foldedRoof(out, x0, x1, frontZ, backZ, baseY, rise, bays, wallTop) {
  const width = (x1 - x0) / bays;
  let a = [x0, baseY];
  const segment = (b) => {
    face(
      out,
      'roof',
      [
        [a[0], a[1], frontZ],
        [b[0], b[1], frontZ],
        [b[0], b[1], backZ],
        [a[0], a[1], backZ],
      ],
      colors.roof,
    );
    face(
      out,
      'trim',
      [
        [a[0], wallTop, frontZ],
        [b[0], wallTop, frontZ],
        [b[0], b[1], frontZ],
        [a[0], a[1], frontZ],
      ],
      colors.concrete,
    );
    face(
      out,
      'trim',
      [
        [b[0], b[1] - 0.18, backZ],
        [a[0], a[1] - 0.18, backZ],
        [a[0], a[1], backZ],
        [b[0], b[1], backZ],
      ],
      colors.roofEdge,
    );
    face(
      out,
      'plaster',
      [
        [b[0], wallTop, backZ + 0.16],
        [a[0], wallTop, backZ + 0.16],
        [a[0], a[1], backZ + 0.16],
        [b[0], b[1], backZ + 0.16],
      ],
      colors.shaded,
    );
    a = b;
  };
  for (let i = 0; i < bays; ++i) {
    segment([x0 + (i + 0.5) * width, baseY + rise]);
    segment([x0 + (i + 1) * width, baseY]);
  }
}

function pavilion(out, detail) {
  const frontWall = frontZ - 0.48;
  const back = 15.8;
  const x0 = left + 0.16;
  const x1 = right - 0.16;
  const bays = 11;
  const width = (x1 - x0) / bays;
  const fin = (left, right, depth, top) => {
    if (detail === 0)
      front(out, 'trim', left, right, fasciaY, top, frontWall + depth, colors.concrete);
    else
      box(
        out,
        'trim',
        [left, fasciaY, frontWall - 0.03],
        [right, top, frontWall + depth],
        colors.concrete,
      );
  };
  box(out, 'plaster', [x0, fasciaY - 0.03, back], [x1, pavilionY - 0.24, frontWall], colors.stucco);
  const upperRows = [
    [13.12, 14.75],
    [16.68, 18.28],
  ];
  for (let i = 0; i < bays; ++i) {
    const a = x0 + i * width;
    const mid = a + width / 2;
    const b = a + width;
    face(
      out,
      'plaster',
      [
        [a, pavilionY - 0.48, frontWall + 0.09],
        [mid, pavilionY - 0.48, frontWall + 0.17],
        [mid, pavilionY + 0.58, frontWall + 0.17],
        [a, pavilionY - 0.07, frontWall + 0.09],
      ],
      colors.concrete,
    );
    face(
      out,
      'plaster',
      [
        [mid, pavilionY - 0.48, frontWall + 0.17],
        [b, pavilionY - 0.48, frontWall + 0.09],
        [b, pavilionY - 0.07, frontWall + 0.09],
        [mid, pavilionY + 0.58, frontWall + 0.17],
      ],
      colors.stucco,
    );
    for (const [low, high] of upperRows) {
      front(out, 'glass', a + 0.15, b - 0.13, low, high, frontWall + 0.025, colors.glass);
      if (detail >= 2) {
        front(out, 'trim', a + 0.12, b - 0.12, low - 0.1, low, frontWall + 0.11, colors.concrete);
        for (const fraction of [0.29, 0.54, 0.78])
          front(
            out,
            'trim',
            a + width * fraction,
            a + width * fraction + 0.06,
            low,
            high,
            frontWall + 0.055,
            colors.shaded,
          );
      }
    }
    fin(a - 0.07, a + 0.1, 0.33, pavilionY - 0.02);
    fin(mid - 0.058, mid + 0.058, 0.25, pavilionY + 0.53);
  }
  fin(x1 - 0.08, x1 + 0.08, 0.33, pavilionY - 0.02);
  foldedRoof(
    out,
    x0 - 0.09,
    x1 + 0.09,
    frontWall + 0.41,
    back - 0.16,
    pavilionY - 0.01,
    0.67,
    bays,
    pavilionY - 0.27,
  );
  const crownWidth = 0.72 * (x1 - x0);
  const crownCenter = (x0 + x1) / 2;
  const crownFront = 26.2;
  const crownBack = 16.02;
  box(
    out,
    'plaster',
    [crownCenter - crownWidth / 2 + 0.48, pavilionY - 0.3, crownBack + 0.45],
    [crownCenter + crownWidth / 2 - 0.48, crownY - 0.12, crownFront - 0.55],
    colors.shaded,
  );
  foldedRoof(
    out,
    crownCenter - crownWidth / 2,
    crownCenter + crownWidth / 2,
    crownFront,
    crownBack,
    crownY,
    0.55,
    8,
    crownY - 0.33,
  );
}

function screenSegment(out, a, b, z, width) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const x = (-(b[1] - a[1]) * width) / (2 * d);
  const y = ((b[0] - a[0]) * width) / (2 * d);
  face(
    out,
    'trim',
    [
      [a[0] - x, a[1] - y, z],
      [b[0] - x, b[1] - y, z],
      [b[0] + x, b[1] + y, z],
      [a[0] + x, a[1] + y, z],
    ],
    colors.cream,
  );
}

function canopyInscription(out) {
  const text = 'NATIONAL MUSEUM OF PAKISTAN';
  const measures = {
    width: 14.8,
    height: 0.31,
    y: canopyY - 0.42,
    z: frontZ + 2.17,
    color: colors.sign,
    slot: 'trim',
    stroke: 0.033,
  };
  lettering(out, text, measures);
  const roundedGlyphs = {
    O: [
      [0.22, 0],
      [0, 0.22],
      [0, 0.78],
      [0.22, 1],
      [0.78, 1],
      [1, 0.78],
      [1, 0.22],
      [0.78, 0],
      [0.22, 0],
    ],
    U: [
      [0, 1],
      [0, 0.23],
      [0.23, 0],
      [0.77, 0],
      [1, 0.23],
      [1, 1],
    ],
  };
  const advance = measures.width / text.length;
  for (const [i, letter] of [...text].entries()) {
    const line = roundedGlyphs[letter];
    if (!line) continue;
    const points = line.map(([x, y]) => [
      (i - text.length / 2 + 0.75 * x) * advance,
      measures.y + y * measures.height,
      measures.z,
    ]);
    for (let p = 1; p < points.length; ++p)
      beam(
        out,
        measures.slot,
        points[p - 1],
        points[p],
        measures.stroke,
        measures.stroke,
        measures.color,
      );
  }
}

function entrance(out, detail) {
  const fasciaZ = frontZ + 0.11;
  const width = (right - left) / 9;
  front(out, 'trim', -23.7, 23.8, screenTopY, fasciaY, fasciaZ, colors.red);
  front(out, 'trim', left, right, floor + 0.02, screenTopY, frontZ + 0.03, colors.recess);
  box(
    out,
    'plaster',
    [left - 1.22, canopyY - 0.53, frontZ + 0.04],
    [right + 1.22, canopyY, frontZ + 2.13],
    colors.light,
  );
  box(
    out,
    'plaster',
    [left - 1.32, floor - 0.28, frontZ - 0.05],
    [right + 1.32, floor, frontZ + 2.65],
    colors.apron,
  );
  for (let i = 0; i < 9; ++i) {
    const a = left + i * width;
    const b = a + width;
    const z = frontZ + 0.18;
    front(
      out,
      'glass',
      a + 0.18,
      b - 0.18,
      floor + 0.05,
      canopyY - 0.55,
      frontZ + 0.05,
      colors.lobby,
    );
    box(
      out,
      'trim',
      [a - 0.05, floor, z - 0.04],
      [a + 0.15, screenTopY, z + 0.11],
      colors.concrete,
    );
    front(out, 'trim', a + 0.12, b - 0.07, canopyY + 0.03, canopyY + 0.15, z, colors.cream);
    const lo = canopyY + 0.25;
    const hi = screenTopY - 0.16;
    const mid = (b + a) / 2;
    const rows = [3, 6, 9, 11][detail];
    const h = (hi - lo) / rows;
    for (const edge of [a + 0.31, a + 0.5, b - 0.61, b - 0.43]) {
      if (detail === 0 && (edge === a + 0.5 || edge === b - 0.61)) continue;
      front(out, 'trim', edge, edge + 0.055, lo, hi, z, colors.cream);
    }
    for (let row = 0; row < rows; ++row) {
      const y = lo + (row + 0.5) * h;
      const rowWidth = row === 0 || row === rows - 1 ? 0.6 : 1;
      const inset = 0.5 * (width - width * rowWidth) + 0.58;
      const borderL = a + inset;
      const borderR = b - inset;
      const corners = [
        [borderL, y],
        [mid, y + h * 0.45],
        [borderR, y],
        [mid, y - h * 0.45],
      ];
      for (let j = 0; j < 4; ++j)
        screenSegment(out, corners[j], corners[(j + 1) % 4], z, detail === 0 ? 0.11 : 0.065);
      if (detail === 3 && row > 0) {
        screenSegment(out, [a + 0.5, y - h * 0.46], [mid, y], z + 0.015, 0.044);
        screenSegment(out, [mid, y], [b - 0.55, y - h * 0.46], z + 0.015, 0.044);
      }
    }
    if (detail >= 2)
      for (const fraction of [0.26, 0.5, 0.75])
        front(
          out,
          'trim',
          a + width * fraction,
          a + width * fraction + 0.065,
          floor + 0.03,
          canopyY - 0.45,
          frontZ + 0.12,
          colors.shaded,
        );
  }
  box(
    out,
    'trim',
    [right - 0.09, floor, frontZ + 0.11],
    [right + 0.09, screenTopY, frontZ + 0.31],
    colors.concrete,
  );
  if (detail >= 2) canopyInscription(out);
  if (detail === 3)
    for (let i = 0; i < 3; ++i)
      box(
        out,
        'plaster',
        [-8.3, floor - 0.86, frontZ + 2.6 + i * 0.43],
        [8.3, floor - 0.16 - i * 0.16, frontZ + 3.03 + i * 0.43],
        colors.apron,
      );
}

function draw(out, detail) {
  rear(out, detail);
  pavilion(out, detail);
  entrance(out, detail);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [43, 33, 104];
const lookAt = [0, 9, 3];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q1967486',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: plan.sectionBasis,
  camera,
  lookAt,
  sunDirection: [31, 62, 70],
  recipeDependencies: [
    'generate-motat-building.mjs',
    'polygon-triangulation.mjs',
    'stadium-lettering.mjs',
  ],
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_standing_seam'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 2.62,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'burns-garden-front', position: [1, 6.7, 71], lookAt: [1, 12, 25] },
    { name: 'entry-screens-and-canopy', position: [13.8, 5.5, 51.5], lookAt: [1.8, 6.7, 30.5] },
    { name: 'side-elevation-and-folds', position: [62, 25, 63], lookAt: [7, 12, 11] },
    { name: 'courtyard-roofs', position: [-59, 77, -59], lookAt: [0, 13, -5] },
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
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.068, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original exterior geometry based on the verified public-domain Qualla facade photograph, mapped outlines, and the National Museum’s institutional records.',
};
