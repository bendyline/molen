/** February 2025 exterior of the mapped Akhisar Museum exhibition hall. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  cream: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91, metallic: 0 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.74, metallic: 0 },
  white: { slot: 'trim', graph: 'concrete_plain', roughness: 0.86, metallic: 0 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.27, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.46, metallic: 0.12 },
};
const tints = Object.fromEntries(
  Object.entries({
    cream: 'dfd1a5',
    bronze: '88664f',
    white: 'efede3',
    stone: 'a5a093',
    glass: '424b47',
    metal: '3d352e',
  }).map(([key, color]) => [key, rgb(color)]),
);
const [northwest, northeast, southeast, southwest] = plan.nativeRing;
const width = Math.hypot(northeast[0] - northwest[0], northeast[1] - northwest[1]);
const length = Math.hypot(southwest[0] - northwest[0], southwest[1] - northwest[1]);

// Bilinear interpolation retains all four source corners and the mild plan skew.
function point(x, z) {
  const u = x / width,
    v = z / length;
  return northwest.map(
    (n, axis) =>
      (1 - v) * ((1 - u) * n + u * northeast[axis]) +
      v * ((1 - u) * southwest[axis] + u * southeast[axis]),
  );
}
function face(mesh, material, corners, outward, tint = tints[material]) {
  let normal = normalFor(...corners);
  if (normal.reduce((dot, value, axis) => dot + value * outward[axis], 0) < 0) {
    corners.reverse();
    normal = normalFor(...corners);
  }
  mesh.addConvexPolygon(material, 'palette:#ffffff', corners, normal, ([x, y]) => [x, y], tint);
}
function prism(mesh, material, ring, low, high, tint) {
  for (let i = 0; i < ring.length; i++) {
    const [x, z] = ring[i],
      [nextX, nextZ] = ring[(i + 1) % ring.length];
    face(
      mesh,
      material,
      [
        [x, low, z],
        [nextX, low, nextZ],
        [nextX, high, nextZ],
        [x, high, z],
      ],
      [nextZ - z, 0, x - nextX],
      tint,
    );
  }
  face(
    mesh,
    material,
    ring.map(([x, z]) => [x, low, z]),
    [0, -1, 0],
    tint,
  );
  face(
    mesh,
    material,
    ring.map(([x, z]) => [x, high, z]),
    [0, 1, 0],
    tint,
  );
}
function block(mesh, material, left, front, right, back, low, high, tint) {
  prism(
    mesh,
    material,
    [
      [left, front],
      [right, front],
      [right, back],
      [left, back],
    ].map((p) => point(...p)),
    low,
    high,
    tint,
  );
}
function column(mesh, x, z, radius, low, high, facets) {
  const ring = Array.from({ length: facets }, (_, i) => {
    const theta = (i * 2 * Math.PI) / facets;
    return point(x + Math.cos(theta) * radius, z + Math.sin(theta) * radius);
  });
  prism(mesh, 'cream', ring, low, high);
}
const caption = {
  M: ['10001', '11011', '10101', '10001', '10001', '10001', '10001'],
  U: ['10001', '00000', '10001', '10001', '10001', '10001', '01110'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
};

export function buildHouse(mesh, _frame, lod = 3) {
  const {
    floor,
    foundationBottom,
    entryRecess,
    canopyProjection,
    canopySpan,
    canopyUnderside,
    canopyHeight,
  } = plan;
  const entryCenter = width * 0.395;
  const left = entryCenter - canopySpan / 2,
    right = entryCenter + canopySpan / 2;
  const wallTop = floor + plan.wallHeight,
    parapet = wallTop + plan.upperBandHeight;
  const roofY = parapet - 0.23;
  block(mesh, 'stone', 0, 0, width, length, foundationBottom, floor);
  block(mesh, 'cream', 0, entryRecess, width, length, floor, wallTop);
  block(mesh, 'cream', 0, 0, left + 0.27, entryRecess, floor, wallTop);
  block(mesh, 'cream', right - 0.27, 0, width, entryRecess, floor, wallTop);
  block(mesh, 'cream', left + 0.27, 0, right - 0.27, entryRecess, floor + canopyHeight, wallTop);
  block(mesh, 'bronze', 0, 0, width, length, wallTop, roofY);
  for (const ring of [
    [0, 0, width, 0.2],
    [0, length - 0.2, width, length],
    [0, 0.2, 0.2, length - 0.2],
    [width - 0.2, 0.2, width, length - 0.2],
  ]) {
    block(mesh, 'bronze', ...ring, roofY, parapet);
    if (lod > 0) block(mesh, 'white', ...ring, parapet, parapet + 0.045);
  }
  block(
    mesh,
    'stone',
    0.2,
    0.2,
    width - 0.2,
    length - 0.2,
    roofY - 0.06,
    roofY + 0.003,
    rgb('90867a'),
  );

  block(
    mesh,
    'stone',
    left - 0.12,
    -canopyProjection - 0.48,
    right + 0.12,
    entryRecess,
    foundationBottom,
    floor - 0.14,
  );
  block(mesh, 'stone', left, -canopyProjection - 0.22, right, entryRecess, floor - 0.14, floor);
  block(
    mesh,
    'white',
    left,
    -canopyProjection,
    right,
    0.12,
    floor + canopyUnderside,
    floor + canopyHeight,
  );
  if (lod > 0) {
    block(
      mesh,
      'white',
      left - 0.04,
      -canopyProjection - 0.04,
      right + 0.04,
      0.15,
      floor + canopyHeight,
      floor + canopyHeight + 0.045,
    );
  }
  const facets = [6, 8, 12, 16][lod];
  for (const x of [left + 0.42, right - 0.42])
    column(mesh, x, -canopyProjection + 0.35, 0.21, floor, floor + canopyUnderside, facets);

  const doorLeft = entryCenter - 1.35,
    doorRight = entryCenter + 1.35;
  block(
    mesh,
    'glass',
    doorLeft,
    entryRecess - 0.06,
    doorRight,
    entryRecess + 0.01,
    floor + 0.045,
    floor + 2.63,
  );
  if (lod > 0) {
    for (const x of [doorLeft, entryCenter, doorRight]) {
      block(
        mesh,
        'metal',
        x - 0.034,
        entryRecess - 0.085,
        x + 0.034,
        entryRecess + 0.01,
        floor + 0.045,
        floor + 2.65,
      );
    }
    block(
      mesh,
      'metal',
      doorLeft,
      entryRecess - 0.085,
      doorRight,
      entryRecess + 0.01,
      floor + 2.59,
      floor + 2.67,
    );
    block(
      mesh,
      'metal',
      doorLeft,
      entryRecess - 0.085,
      doorRight,
      entryRecess + 0.01,
      floor + 2.24,
      floor + 2.29,
    );
  }

  if (lod > 1) {
    const seam = rgb('c6b88e');
    for (let y = floor + 0.54; y < wallTop - 0.18; y += 0.55) {
      block(mesh, 'cream', 0, -0.012, left + 0.27, 0.003, y, y + 0.019, seam);
      block(mesh, 'cream', right - 0.27, -0.012, width, 0.003, y, y + 0.019, seam);
      block(mesh, 'cream', width - 0.003, 0, width + 0.012, length, y, y + 0.019, seam);
      if (lod === 3)
        block(mesh, 'cream', 0, length - 0.003, width, length + 0.012, y, y + 0.019, seam);
    }
    const seamColor = rgb('715542');
    for (let y = wallTop + 0.27; y < parapet - 0.08; y += 0.27) {
      block(mesh, 'bronze', 0, -0.008, width, 0.002, y, y + 0.013, seamColor);
      block(mesh, 'bronze', width - 0.002, 0, width + 0.008, length, y, y + 0.013, seamColor);
    }
    block(
      mesh,
      'bronze',
      width - 0.022,
      length * 0.68,
      width + 0.023,
      length * 0.72,
      floor,
      wallTop,
    );
  }
  if (lod === 3) {
    const pixel = 0.028,
      baseY = floor + canopyUnderside + 0.09;
    for (const [letter, rows] of Object.entries(caption).entries()) {
      for (const [row, glyph] of rows[1].entries()) {
        for (let start = 0; start < glyph.length; ) {
          if (glyph[start] === '0') {
            start++;
            continue;
          }
          let end = start + 1;
          while (glyph[end] === '1') end++;
          const x = entryCenter + 12 * pixel - (letter * 6 + end) * pixel;
          block(
            mesh,
            'metal',
            x,
            -canopyProjection - 0.012,
            x + (end - start) * pixel,
            -canopyProjection - 0.003,
            baseY + (6 - row) * pixel,
            baseY + (7 - row) * pixel,
          );
          start = end;
        }
      }
    }
  }
}

export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [36, 22, -40];
const lookAt = [0, 2.4, -1];
const modelPath = 'content/worldgen/source/places/sw/swg/akhisar_museum';
export const houseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Single-storey exhibition hall with cream walls, a brown upper band and a white two-column portico.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'north-portico-and-recessed-glazed-entrance',
      position: [8, 5, -25],
      lookAt: [-3, 2.3, -13],
    },
    { name: 'garden-wall-and-parapet', position: [33, 16, 25], lookAt: [4, 2, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.18,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic reconstruction under the repository license. Published Qualla photos by Pragdon are used as CC0 reference. The independent building outline is attributed to OpenStreetMap contributors under ODbL.',
};
