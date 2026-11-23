import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const d = plan.dimensions;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  rubble: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  painted: { slot: 'trim', graph: 'wood_painted_shingle', roughness: 0.9 },
  cap: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.74 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const rose = rgb('96584b');
const brickShade = rgb('814a40');
const stone = rgb('8a8275');
const mortar = rgb('a69c8c');
const paint = rgb('d4d0be');
const beamPaint = rgb('c1bdad');
const slate = rgb('a1a49d');
const roofShade = rgb('888d85');
const cutStone = rgb('b1aa9b');
const glass = rgb('596160');
const glassShadow = rgb('434742');
const door = rgb('6f6256');
const length = d.mainBrickLength;
const end = length / 2;
const back = 7.52;
const front = back - d.mainBrickDepth;
const first = 1.38;
const second = 5.41;
const north = -8.55;
const south = 9.78;
const towerCenter = [0, -5.34];
const radius = d.towerDiameter / 2;
const eave = d.hallEaveEstimate;

function box(out, slot, x0, x1, z0, z1, low, high, tone) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], tone, { bottom: false });
}

function panel(out, slot, F, u, width, y, height, depth, color) {
  const lo = u - width / 2;
  const hi = u + width / 2;
  quad4(
    out,
    slot,
    F.P(lo, y, depth),
    F.P(hi, y, depth),
    F.P(hi, y + height, depth),
    F.P(lo, y + height, depth),
    color,
  );
}

function sash(out, F, u, y, w, h, lod) {
  panel(out, 'painted', F, u, w + 0.2, y - 0.11, h + 0.22, 0.032, paint);
  panel(out, 'glass', F, u, w, y, h, 0.047, glass);
  if (lod === 0) return;
  panel(out, 'painted', F, u, 0.07, y, h, 0.06, paint);
  for (let i = 1; i < (lod === 3 ? 6 : 3); i++)
    panel(out, 'painted', F, u, w, y + (i * h) / (lod === 3 ? 6 : 3), 0.056, 0.06, paint);
  if (lod > 1) {
    fbox(
      out,
      'cap',
      F,
      u - w / 2 - 0.17,
      u + w / 2 + 0.17,
      y + h + 0.12,
      y + h + 0.28,
      -0.02,
      0.17,
      cutStone,
    );
    fbox(
      out,
      'cap',
      F,
      u - w / 2 - 0.17,
      u + w / 2 + 0.17,
      y - 0.16,
      y - 0.05,
      -0.018,
      0.15,
      cutStone,
    );
    if (lod === 3)
      for (const offset of [-0.29, 0.29])
        panel(out, 'painted', F, u + offset * w, 0.038, y, h, 0.062, paint);
  }
}

function doorway(out, F, u, y, width, height, lod) {
  panel(out, 'painted', F, u, width + 0.27, y - 0.07, height + 0.29, 0.09, paint);
  panel(out, 'door', F, u, width, y, height, 0.11, door);
  if (lod > 0) {
    panel(out, 'glass', F, u, width * 0.89, y + height - 0.55, 0.44, 0.124, glassShadow);
    for (const offset of [-0.25, 0, 0.25])
      panel(out, 'painted', F, u + width * offset, 0.044, y + height - 0.55, 0.43, 0.132, paint);
  }
}

function hall(out, lod) {
  box(out, 'rubble', -end, end, front, back, -1.52, first, stone);
  box(out, 'brick', -end, end, front, back, first, eave, rose);
  gableRoof(
    out,
    'roof',
    [-end, (front + back) / 2],
    [end, (front + back) / 2],
    d.mainBrickDepth,
    eave,
    12.27,
    slate,
    { overhang: 0.37, endSlot: 'brick', endColor: rose },
  );
  for (const x of [-17.5, -11.62, 11.62, 17.5]) {
    const y = Math.abs(x) > 15 ? 12.62 : 13.01;
    box(out, 'brick', x - 0.44, x + 0.44, 0.48, 1.26, 11.4, y, brickShade);
    box(out, 'cap', x - 0.51, x + 0.51, 0.41, 1.32, y, y + 0.15, cutStone);
  }
  const northWall = facade([0, front], [-1, 0]);
  const southWall = facade([0, back], [1, 0]);
  for (const F of [northWall, southWall]) {
    for (const x of [-15.9, -11.55, -7.21, 7.33, 11.61, 15.9]) {
      sash(out, F, x, 2.08, 1.11, 2.22, lod);
      sash(out, F, x, 6.11, 1.1, 2.3, lod);
    }
    if (lod > 0)
      for (const x of [-15.85, -11.55, -7.29, 7.18, 11.57, 15.91])
        panel(out, 'glass', F, x, 0.68, 0.42, 0.54, 0.048, glassShadow);
  }
  doorway(out, southWall, 0, first, 1.47, 3.12, lod);
  sash(out, southWall, -2.58, 6.08, 1.0, 2.13, lod);
  sash(out, southWall, 2.58, 6.08, 1.0, 2.13, lod);
  for (const x of [-end, end]) {
    const F = x > 0 ? facade([x, back], [0, -1]) : facade([x, front], [0, 1]);
    for (const u of [2.12, d.mainBrickDepth - 2.14])
      for (const y of [2.08, 6.12]) sash(out, F, u, y, 1.16, 2.16, lod);
    if (lod > 0) {
      opening(out, F, d.mainBrickDepth / 2, 10.37, 2.06, 1.18, {
        head: 'round',
        glassSlot: 'glass',
        frameSlot: 'painted',
        glass,
        frame: paint,
        frameWidth: 0.12,
        frameDepth: 0.1,
        mullions: lod > 1 ? 3 : 1,
        sill: true,
      });
      fbox(out, 'painted', F, -0.13, d.mainBrickDepth + 0.13, 9.71, 9.95, 0.01, 0.14, paint);
    }
  }
}

function rampSteps(out, F, center, width, deck, lod) {
  const count = lod === 0 ? 2 : 8;
  for (let i = 0; i < count; i++) {
    const rise = (deck * (i + 1)) / count;
    fbox(
      out,
      'rubble',
      F,
      center - width / 2,
      center + width / 2,
      -0.55,
      rise,
      0.14,
      0.48 + ((count - i) / count) * 2.32,
      stone,
    );
  }
  if (lod > 1)
    for (const u of [center - width / 2 - 0.02, center + width / 2 + 0.02]) {
      const a = F.P(u, 0.78, 2.74);
      const b = F.P(u, deck + 0.75, 0.27);
      beam(out, 'painted', a, b, 0.076, 0.084, beamPaint);
      for (const t of [0, 0.42, 0.83]) {
        const d = 2.74 - t * 2.47;
        beam(
          out,
          'painted',
          F.P(u, t * deck, d),
          F.P(u, t * deck + 0.73, d),
          0.059,
          0.059,
          beamPaint,
        );
      }
    }
}

function tower(out, lod) {
  const ring = (y, r) => radialRing(y, r, r, 8, towerCenter, Math.PI / 8);
  const shell = (slot, limits, tone, cap = false) =>
    loft(
      out,
      slot,
      limits.map(([y, r]) => ring(y, r)),
      tone,
      { cap },
    );
  shell(
    'rubble',
    [
      [-1.51, radius + 0.035],
      [first, radius + 0.035],
    ],
    stone,
  );
  shell(
    'brick',
    [
      [first, radius],
      [d.towerParapetEstimate - 0.5, radius],
    ],
    rose,
  );
  const lip = d.towerParapetEstimate - 0.5;
  shell(
    'cap',
    [
      [lip - 0.11, radius + 0.085],
      [lip + 0.03, radius + 0.11],
    ],
    cutStone,
    true,
  );
  const points = ring(0, radius + 0.06).map(([x, , z]) => [x, z]);
  for (let i = 0; i < points.length; i++) {
    const F = wallFace(points[i], points[(i + 1) % points.length]);
    const u = F.length / 2;
    fbox(out, 'cap', F, 0.26, F.length - 0.26, lip, lip + 0.32, -0.39, 0.04, cutStone);
    if (lod > 0)
      for (const y of [first + 0.11, 5.3, 9.46, 13.1])
        fbox(out, 'brick', F, -0.036, F.length + 0.036, y, y + 0.15, -0.15, 0.048, brickShade);
    // The four back faces overlap the main hall below the cornice.
    if (F.normal[1] < 0.1) {
      if (F.normal[1] < -0.95) {
        doorway(out, F, u, first, 1.12, 2.88, lod);
        rampSteps(out, F, u, 1.63, first, lod);
        if (lod > 0) fbox(out, 'cap', F, u - 0.7, u + 0.7, 4.52, 5.01, -0.02, 0.105, mortar);
      } else if (F.normal[1] < -0.3) sash(out, F, u, 2.02, 0.86, 2.28, lod);
      if (F.normal[1] < -0.3 || lod > 0) sash(out, F, u, 6.22, 0.94, 2.35, lod);
    }
    sash(out, F, u, 10.38, 0.96, 2.38, lod);
  }
}

function gallery(out, x0, x1, z, wallZ, levels, lod) {
  const near = Math.min(z, wallZ);
  const far = Math.max(z, wallZ);
  const facing = z < wallZ ? -1 : 1;
  const decks = levels === 2 ? [first, second] : [first];
  for (const floor of decks) box(out, 'painted', x0, x1, near, far, floor - 0.16, floor, beamPaint);
  const ceiling = levels === 2 ? 9.82 : 5.22;
  const F = facade([0, z], [facing, 0]);
  const span = far - near;
  const faceLo = facing < 0 ? -x1 : x0;
  const faceHi = facing < 0 ? -x0 : x1;
  const edge = F.P(faceLo, ceiling, 0.28);
  const end = F.P(faceHi, ceiling, 0.28);
  const wallA = F.P(faceLo, ceiling + 0.78, -span - 0.06);
  const wallB = F.P(faceHi, ceiling + 0.78, -span - 0.06);
  quad4(out, 'roof', edge, end, wallB, wallA, roofShade);
  const below = ([x, y, z]) => [x, y - 0.15, z];
  quad4(out, 'painted', below(end), below(edge), below(wallA), below(wallB), beamPaint);
  fbox(
    out,
    'painted',
    F,
    faceLo - 0.26,
    faceHi + 0.26,
    ceiling - 0.18,
    ceiling + 0.11,
    -0.21,
    0.32,
    paint,
  );
  const bays = levels === 2 ? 3 : 7;
  const margin = 0.19;
  for (let i = 0; i <= bays; i++) {
    const u = faceLo + margin + ((faceHi - faceLo - 2 * margin) * i) / bays;
    fbox(out, 'rubble', F, u - 0.24, u + 0.24, -0.58, first - 0.055, -0.28, 0.27, brickShade);
    fbox(out, 'painted', F, u - 0.153, u + 0.153, first - 0.05, ceiling, -0.18, 0.18, paint);
    if (lod > 0)
      for (const y of [...decks, ceiling - 0.25])
        fbox(out, 'painted', F, u - 0.236, u + 0.236, y, y + 0.15, -0.225, 0.222, paint);
  }
  for (const floor of decks) {
    for (const dy of [0.13, 0.89])
      fbox(out, 'painted', F, faceLo, faceHi, floor + dy, floor + dy + 0.105, -0.09, 0.095, paint);
    if (lod > 0) {
      const step = [0.8, 0.42, 0.235, 0.158][lod];
      for (let u = faceLo + 0.28; u < faceHi - 0.2; u += step) {
        const h = lod === 3 ? 0.043 : 0.038;
        if (lod === 1) panel(out, 'painted', F, u, 0.085, floor + 0.23, 0.65, 0.07, paint);
        else
          fbox(out, 'painted', F, u - h, u + h, floor + 0.17, floor + 0.94, -0.047, 0.049, paint);
      }
    }
  }
}

function build(out, lod) {
  hall(out, lod);
  tower(out, lod);
  gallery(out, -end, -3.23, north, front, 2, lod);
  gallery(out, 3.23, end, north, front, 2, lod);
  gallery(out, -end + 0.14, end - 0.14, south, back, 1, lod);
  const rear = facade([0, south], [1, 0]);
  rampSteps(out, rear, 0, 1.42, first, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'tower-building-of-the-little-rock-arsenal-model.mjs';
const camera = [40, 21, -53];
const lookAt = [0, 6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The surviving Little Rock Arsenal with its crenellated octagonal brick tower, open double veranda and stone basement.',
  camera,
  lookAt,
  sunDirection: [-24, 46, -39],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Native footprint of the former arsenal, now the MacArthur Museum.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_ashlar',
    'metal_standing_seam',
    'wood_painted_shingle',
    'stone_limestone_weathered',
  ],
  recipeDependencies: ['authored-structure-mesh.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-veranda-and-tower', position: [-20, 7.1, -42], lookAt: [0, 7, -5] },
    { name: 'octagonal-brick-tower', position: [12, 12.6, -22], lookAt: [0, 8.7, -6] },
    { name: 'rear-gallery-and-gables', position: [-31, 16.4, 35], lookAt: [0, 6.5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'little-rock-arsenal-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.38, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};
