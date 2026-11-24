import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  pointedArch,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor } = plan.dimensions;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_board_batten', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
  spire: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
};
const boards = rgb('9c9a84');
const blush = rgb('9d7064');
const bright = rgb('bf9381');
const shingles = rgb('554c45');
const copper = rgb('9d5c47');
const base = rgb('81766a');
const glass = rgb('615c61');
const voidColor = rgb('3c3934');
const plinth = rgb('9f8b76');

const east = (x, z) => facade([x, z], [0, -1]);
const north = (x, z) => facade([x, z], [-1, 0]);
function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function bargeboards(out, F, cy, width, eave, ridge, lod) {
  const peak = F.P(cy, ridge, 0.16);
  for (const s of [-1, 1]) {
    const p = F.P(cy + (s * width) / 2, eave, 0.16);
    beam(out, 'trim', p, peak, 0.205, 0.22, blush);
    if (lod > 2)
      for (let i = 1; i <= 9; i++) {
        const t = i / 10;
        const position = p.map((v, index) => v + t * (peak[index] - v));
        beam(
          out,
          'trim',
          F.P(cy + (s * width * (1 - t)) / 2, position[1] - 0.29, 0.19),
          position,
          0.073,
          0.083,
          bright,
        );
      }
  }
}

function window(
  out,
  F,
  u,
  y,
  w,
  h,
  lod,
  { head = 'pointed', color = glass, louvres = false } = {},
) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: blush,
    d: 0.037,
    frameWidth: lod > 1 ? 0.095 : 0,
    frameDepth: 0.11,
    sill: lod > 1,
    head,
    mullions: lod > 2 && !louvres ? 1 : 0,
    transoms: lod > 2 && !louvres ? 2 : 0,
  });
  if (louvres && lod > 1)
    for (let j = 0; j < 6; j++) {
      const y0 = y + 0.15 + j * h * 0.095;
      fbox(out, 'trim', F, u - w * 0.43, u + w * 0.43, y0, y0 + 0.105, 0.06, 0.11, boards);
    }
}

function roundWindow(out, F, u, y, r, lod) {
  const steps = lod === 0 ? 10 : lod === 1 ? 16 : 24;
  for (let i = 0; i < steps; i++) {
    const a = (i * 2 * Math.PI) / steps,
      b = ((i + 1) * 2 * Math.PI) / steps;
    const p = (theta, d) => F.P(u + Math.cos(theta) * d, y + Math.sin(theta) * d, 0.072);
    tri(out, 'glass', F.P(u, y, 0.069), p(a, r), p(b, r), glass);
    quad4(out, 'trim', p(a, r), p(a, r + 0.12), p(b, r + 0.12), p(b, r), blush);
  }
  if (lod > 1) {
    fbox(out, 'trim', F, u - 0.035, u + 0.035, y - r, y + r, 0.07, 0.14, bright);
    fbox(out, 'trim', F, u - r, u + r, y - 0.039, y + 0.039, 0.07, 0.14, bright);
  }
}

function louvredGable(out, F, u, eave, ridge, lod) {
  const base = eave + (ridge - eave) * 0.53;
  const apex = ridge - 0.49;
  const w = (ridge - base) * 0.88;
  tri(
    out,
    'glass',
    F.P(u - w / 2, base, 0.065),
    F.P(u + w / 2, base, 0.065),
    F.P(u, apex, 0.065),
    voidColor,
  );
  const count = lod === 0 ? 0 : lod === 1 ? 3 : 6;
  for (let i = 0; i < count; i++) {
    const t = i / count,
      y = base + (apex - base) * t;
    const half = (w / 2) * (1 - t);
    fbox(out, 'trim', F, u - half, u + half, y, y + 0.075, 0.07, 0.13, boards);
  }
}

function nave(out, lod) {
  block(out, 'siding', -11.74, 1.54, -13.9, 13.18, floor, 9.9, boards);
  const F = north(-4.04, -18.67);
  block(out, 'siding', -9.62, 1.54, -18.67, -13.7, floor, 10.14, boards);
  gableRoof(out, 'roof', [-4.04, -18.67], [-4.04, 13.2], 11.18, 10.14, 17.93, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.37,
  });
  for (const end of [F, facade([-4.04, 13.19], [1, 0])]) {
    bargeboards(out, end, 0, 11.92, 9.86, 17.93, lod);
    louvredGable(out, end, 0, 9.9, 17.93, lod);
    roundWindow(out, end, 0, 12.24, 1.37, lod);
    window(out, end, 0, 2.1, 1.86, 6.45, lod);
    for (const u of [-3.01, 3.01]) window(out, end, u, 2.3, 0.98, 4.12, lod);
  }
  block(out, 'siding', -12.15, -9.55, -13.88, 12.9, floor, 6.84, boards);
  gableRoof(out, 'roof', [-10.82, -13.9], [-10.82, 12.94], 2.75, 6.84, 8.34, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.22,
  });
  const west = facade([-12.14, 0], [0, 1]);
  for (const z of lod > 0 ? [-10.6, -6.2, -1.65, 2.9, 7.28, 10.83] : [-6.2, 2.9, 10.83])
    window(out, west, z, 2.35, 1.05, 3.26, lod);
  extrude(
    out,
    'siding',
    [
      [-12.01, -10.72],
      [-14.46, -8.36],
      [-14.63, -1.97],
      [-11.69, 0.19],
    ],
    floor,
    7.52,
    boards,
    { top: false },
  );
  tri(out, 'roof', [-12.04, 9.61, -6.4], [-14.67, 7.56, -1.84], [-14.52, 7.56, -8.4], shingles);
  tri(out, 'roof', [-12.04, 9.61, -6.4], [-14.52, 7.56, -8.4], [-12.04, 7.56, -10.79], shingles);
  tri(out, 'roof', [-12.04, 9.61, -6.4], [-11.69, 7.56, 0.15], [-14.67, 7.56, -1.84], shingles);
  block(out, 'siding', -6.76, -2.02, 12.89, 15.52, floor, 5.35, boards);
  gableRoof(out, 'roof', [-4.39, 13.0], [-4.39, 15.52], 4.72, 5.35, 7.88, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.19,
  });
}

function porch(out, F, xFront, localZ, lod) {
  const w = 3.73,
    h = 5.21;
  gableRoof(out, 'roof', [xFront - 2.3, localZ], [xFront, localZ], w, 4.14, 7.08, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.21,
  });
  bargeboards(out, F, 0, w + 0.46, 3.92, 7.12, lod);
  for (const side of [-1, 1]) {
    const u = side * 1.62;
    fbox(out, 'trim', F, u - 0.18, u + 0.18, 1.19, 4.35, -0.17, 0.17, blush);
    const openingEdge = side * 1.0;
    for (const x of lod > 0 ? [xFront - 1.82, xFront - 0.84] : []) {
      fbox(out, 'trim', east(x, localZ), u - 0.085, u + 0.085, 1.3, 3.71, -0.085, 0.088, bright);
    }
    fbox(
      out,
      'trim',
      F,
      Math.min(u, openingEdge),
      Math.max(u, openingEdge),
      0.93,
      1.39,
      -0.24,
      0.17,
      bright,
    );
  }
  const arch = pointedArch(1.59, 1.73, lod === 0 ? 3 : lod === 1 ? 5 : 9);
  for (let i = 0; i < arch.length - 1; i++) {
    const p = ([u, y]) => F.P(u, h - 1.73 + y, 0.22);
    beam(out, 'trim', p(arch[i]), p(arch[i + 1]), 0.19, 0.24, bright);
  }
  for (let i = 0; i < 5; i++) {
    const y = 0.16 + i * 0.206;
    block(
      out,
      'stone',
      xFront - 1.85,
      xFront + 1.66 - i * 0.34,
      localZ - 1.97,
      localZ + 1.97,
      -0.61,
      y,
      plinth,
    );
  }
}

function entranceWing(out, lod) {
  block(out, 'siding', 0.22, 12.09, -7.72, 3.74, floor, 10.56, boards);
  gableRoof(out, 'roof', [0.35, -2.02], [12.1, -2.02], 11.45, 10.55, 17.29, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.32,
  });
  const F = east(12.09, -2.02);
  bargeboards(out, F, 0, 12.09, 10.25, 17.29, lod);
  louvredGable(out, F, 0, 10.45, 17.29, lod);
  for (const u of [-3.85, 3.66]) window(out, F, u, 3.19, 1.24, 4.17, lod);
  window(out, F, 0.1, 10.67, 1.42, 2.67, lod);
  window(out, east(12.09, -4.67), 0, 0.93, 1.88, 3.32, lod, { color: voidColor });
  porch(out, east(14.19, -4.67), 14.19, -4.67, lod);
  block(out, 'siding', 8.39, 12.08, 0.55, 16.39, floor, 6.61, boards);
  gableRoof(out, 'roof', [10.2, 0.55], [10.2, 16.39], 3.69, 6.6, 9.48, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.19,
  });
  for (const z of lod > 0 ? [4.12, 7.22, 10.36, 13.76] : [7.22, 13.76])
    window(out, east(12.08, z), 0, 2.37, 0.88, 2.82, lod);
  block(out, 'siding', 1.25, 8.42, 0.56, 3.74, floor, 7.5, boards);
  block(out, 'siding', 1.41, 5.6, -13.88, -7.66, floor, 8.14, boards);
  gableRoof(out, 'roof', [1.43, -10.83], [5.61, -10.83], 6.21, 8.13, 10.86, shingles, {
    endSlot: 'siding',
    endColor: boards,
    overhang: 0.19,
  });
}

function tower(out, lod) {
  const x = 7.55,
    z = -8.36,
    w = 4.45,
    r = w / 2,
    head = 21.75;
  block(out, 'siding', x - r, x + r, z - r, z + r, floor, head, boards);
  for (const F of [
    east(x + r, z),
    north(x, z - r),
    facade([x - r, z], [0, 1]),
    facade([x, z + r], [1, 0]),
  ]) {
    for (const u of lod > 0 ? [-r + 0.09, r - 0.25] : [])
      fbox(out, 'trim', F, u, u + 0.16, 0.61, head, 0, 0.12, bright);
    for (const y of lod > 0 ? [8.55, 13.57, 17.02, 21.19] : [21.19])
      fbox(out, 'trim', F, -r - 0.14, r + 0.14, y, y + 0.21, 0, 0.19, blush);
    for (const u of [-0.91, 0.91])
      window(out, F, u, 17.81, 1.22, 3.13, lod, { color: voidColor, louvres: true });
    window(out, F, 0, 11.05, 1.07, 1.49, lod, { head: 'flat' });
  }
  const roofPoints = [
    [x - r - 0.15, z + r + 0.15],
    [x + r + 0.15, z + r + 0.15],
    [x + r + 0.15, z - r - 0.15],
    [x - r - 0.15, z - r - 0.15],
  ];
  for (let i = 0; i < roofPoints.length; i++) {
    const a = roofPoints[i],
      b = roofPoints[(i + 1) % roofPoints.length];
    tri(out, 'spire', [a[0], head, a[1]], [b[0], head, b[1]], [x, 35.28, z], copper);
    block(out, 'trim', a[0] - 0.13, a[0] + 0.13, a[1] - 0.13, a[1] + 0.13, 21.02, 22.77, bright);
  }
  beam(out, 'trim', [x, 35.18, z], [x, 36.36, z], 0.087, 0.09, bright);
  beam(out, 'trim', [x - 0.34, 35.98, z], [x + 0.34, 35.98, z], 0.07, 0.071, bright);
}

function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor, base, { top: false });
  nave(out, lod);
  entranceWing(out, lod);
  tower(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'trinity-episcopal-cathedral-san-jose-california-model.mjs';
const camera = [57, 23, -54];
const lookAt = [0, 15, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1863 Carpenter Gothic cathedral on St. James Square in San Jose, with steep redwood gables, stained glass, and the corner spire.',
  camera,
  lookAt,
  sunDirection: [32, 45, -21],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The historic cathedral building as individually mapped.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cathedral-and-corner-spire', position: camera, lookAt },
    { name: 'north-second-street-carved-porch', position: [38, 9, -2], lookAt: [12, 9.0, -3] },
    { name: 'saint-john-street-stained-glass', position: [-19, 15, -48], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'trinity-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
