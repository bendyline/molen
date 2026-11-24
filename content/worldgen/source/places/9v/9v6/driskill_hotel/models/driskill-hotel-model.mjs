import fs from 'node:fs';
import {
  beam,
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const plan = read('../plan-controls.json');
const frame = read('../map-frame.json');
const terrain = read('../terrain-grid.json');
const { baseElevationMeters } = read('../native-map/driskill-urban-survey-controls.json');
const { foundation, annexMeasuredHeight, historicEave, historicPediment } = plan.dimensions;
const annexHeight = baseElevationMeters + annexMeasuredHeight - terrain.modelDatumElevationMeters;
const outline = frame.geometry.outline;
const historic = outwardRing([
  [-24.53, 39.57],
  [-20.5, 43.49],
  [19.59, 43.76],
  [23.45, 39.59],
  [23.82, -6.14],
  [19.76, -9.82],
  [-20.94, -9.11],
  [-24.55, -5.74],
]);
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  annex: { slot: 'wall', graph: 'brick', roughness: 0.93 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.57 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8 },
};
const brick = rgb('946f60');
const annexBrick = rgb('aa967f');
const stone = rgb('d7ccba');
const stoneShade = rgb('b7a58f');
const granite = rgb('9b8a81');
const steel = rgb('655d50');
const glass = rgb('585b57');
const roof = rgb('646968');

function box(out, slot, x0, x1, z0, z1, y0, y1, c) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], c, { bottom: false });
}
function cap(out, slot, ring, y, color) {
  const p = ring.map(([x, z]) => [x, y, z]);
  const index = earcut(ring.flat(), [], 2);
  for (let i = 0; i < index.length; i += 3)
    tri(out, slot, p[index[i]], p[index[i + 2]], p[index[i + 1]], color);
}
function cornice(out, f, u0, u1, y, width, depth, artist = stone) {
  fbox(out, 'stone', f, u0, u1, y - width / 2, y + width / 2, -0.22, depth, artist);
}
function aperture(out, f, u, y, width, height, rise, lod, border = 0.22, tint = glass) {
  const r = width / 2;
  const spring = y + height - rise;
  const steps = lod >= 3 ? 12 : lod === 2 ? 8 : 5;
  const shape = (w, rr, bottom, depth) => {
    const pts = [f.P(u - w, bottom, depth), f.P(u + w, bottom, depth)];
    if (rr === 0) return [...pts, f.P(u + w, spring, depth), f.P(u - w, spring, depth)];
    for (let i = 0; i <= steps; i++) {
      const a = (Math.PI * i) / steps;
      pts.push(f.P(u + w * Math.cos(a), spring + rr * Math.sin(a), depth));
    }
    return pts;
  };
  if (border > 0)
    fan(
      out,
      'stone',
      shape(r + border, rise === 0 ? 0 : rise + border, y - border * 0.56, 0.06),
      stone,
    );
  fan(out, 'glass', shape(r, rise, y, 0.096), tint);
  if (lod >= 2 && width > 1.4) {
    quad4(
      out,
      'metal',
      f.P(u - 0.048, y, 0.108),
      f.P(u + 0.048, y, 0.108),
      f.P(u + 0.048, spring + rise * 0.55, 0.108),
      f.P(u - 0.048, spring + rise * 0.55, 0.108),
      steel,
    );
    const m = y + (spring - y) * 0.64;
    quad4(
      out,
      'metal',
      f.P(u - r, m - 0.055, 0.108),
      f.P(u + r, m - 0.055, 0.108),
      f.P(u + r, m + 0.055, 0.108),
      f.P(u - r, m + 0.055, 0.108),
      steel,
    );
  }
  if (lod === 3 && width >= 2.9 && rise > 0)
    cornice(out, f, u - r - 0.21, u + r + 0.21, y - 0.13, 0.14, 0.24, stoneShade);
}

function column(out, f, u, base, top, d, radius, lod) {
  if (lod === 1) {
    fbox(out, 'stone', f, u - radius, u + radius, base, top, d - radius, d + radius, stone);
    return;
  }

  const n = lod > 1 ? 12 : 8;
  const xz = f.P(u, 0, d);
  const rings = [
    [base, radius * 1.37],
    [base + 0.28, radius * 1.37],
    [base + 0.42, radius],
    [top - 0.47, radius * 0.83],
    [top - 0.32, radius * 1.32],
    [top, radius * 1.31],
  ];
  loft(
    out,
    'stone',
    rings.map(([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (Math.PI * 2 * i) / n;
        return [xz[0] + Math.sin(a) * r, y, xz[2] + Math.cos(a) * r];
      }),
    ),
    stone,
  );
}
function balcony(out, f, center, y, width, depth, lod) {
  const xl = center - width / 2,
    xr = center + width / 2;
  fbox(out, 'stone', f, xl - 0.16, xr + 0.16, y - 0.58, y - 0.29, -0.48, depth - 0.11, stoneShade);
  fbox(out, 'stone', f, xl - 0.2, xr + 0.2, y - 0.29, y, -0.29, depth + 0.15, stone);
  fbox(out, 'stone', f, xl, xr, y + 0.65, y + 0.84, depth - 0.11, depth + 0.13, stone);
  for (const u of [xl + 0.16, xr - 0.16])
    fbox(out, 'stone', f, u - 0.12, u + 0.12, y + 0.65, y + 0.84, 0.12, depth + 0.12, stone);
  if (lod === 0) return;
  const n = Math.max(2, Math.floor(width / (lod === 3 ? 0.39 : lod === 2 ? 0.61 : 1.14)));
  for (let i = 0; i < n; i++) {
    const u = xl + ((i + 0.5) * width) / n;
    fbox(out, 'stone', f, u - 0.069, u + 0.069, y, y + 0.67, depth - 0.084, depth + 0.083, stone);
  }
}

const goldSouth = facade([-0.45, 43.68], [1, 0]);
const brazos = facade([23.77, 14.05], [0, -1]);
function gable(out, f, u, width, eave, ridge, depth, lod) {
  const w = width / 2;
  const front = [f.P(u + w, eave, depth), f.P(u, ridge, depth), f.P(u - w, eave, depth)];
  const behind = [f.P(u + w, eave, -4.66), f.P(u, ridge, -4.66), f.P(u - w, eave, -4.66)];
  tri(out, 'brick', ...front, brick);
  quad4(out, 'roof', behind[0], behind[1], front[1], front[0], roof);
  quad4(out, 'roof', front[2], front[1], behind[1], behind[2], roof);
  if (width > 10 && lod >= 1) {
    const low = eave + 0.68;
    const high = eave + (ridge - eave) * 0.55;
    quad4(
      out,
      'stone',
      f.P(u - w * 0.73, low, depth + 0.016),
      f.P(u + w * 0.73, low, depth + 0.016),
      f.P(u + w * 0.37, high, depth + 0.016),
      f.P(u - w * 0.37, high, depth + 0.016),
      stoneShade,
    );
    beam(
      out,
      'stone',
      f.P(u, eave + 0.71, depth + 0.21),
      f.P(u, ridge - 0.12, depth + 0.21),
      0.18,
      0.18,
      stone,
    );
  }
  if (lod >= 1) {
    beamPath(out, 'stone', front, 0.25, 0.24, stone);
    cornice(out, f, u - w, u + w, eave, 0.3, depth + 0.19);
    fbox(
      out,
      'stone',
      f,
      u - 0.135,
      u + 0.135,
      ridge - 0.13,
      ridge + 0.58,
      depth - 0.12,
      depth + 0.12,
      stoneShade,
    );
  }
}

const letterRows = {
  T: ['111', '010', '010', '010', '010'],
  H: ['101', '101', '111', '101', '101'],
  E: ['111', '100', '110', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  R: ['110', '101', '110', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  S: ['111', '100', '111', '001', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
};
function lettering(out, f, d, y) {
  const size = 0.139;
  for (const [i, ch] of [...'THE DRISKILL'].entries()) {
    const lines = letterRows[ch] ?? [];
    for (const [j, row] of lines.entries()) {
      for (const [k, filled] of [...row].entries()) {
        if (filled !== '1') continue;
        const u = (i * 4 + k - 23) * size;
        const v = y + (4 - j) * size;
        quad4(
          out,
          'metal',
          f.P(u, v, d),
          f.P(u + size, v, d),
          f.P(u + size, v + size, d),
          f.P(u, v + size, d),
          rgb('645349'),
        );
      }
    }
  }
}

function centralLoggia(out, f, depth, lod) {
  const half = 6.68;
  gable(out, f, 0, 13.87, historicEave - 0.2, historicPediment - 0.32, 0.49, lod);
  for (const [y, d] of [
    [6.12, depth],
    [12.6, depth * 0.9],
    [18.8, depth * 0.72],
  ]) {
    balcony(out, f, 0, y, half * 2, d, lod);
  }
  if (lod === 0) return;
  aperture(out, f, 0, 0.9, 4.33, 4.79, 1.63, lod, 0.31, rgb('554941'));
  for (const u of [-6.32, -2.79, 2.79, 6.32]) {
    column(out, f, u, 0.75, 6.8, depth - 0.26, 0.29, lod);
    column(out, f, u, 6.85, 12.46, depth - 0.67, 0.26, lod);
    column(out, f, u, 13.18, 18.55, depth - 0.98, 0.23, lod);
  }
  for (const [u, y, w, h, rise] of [
    [0, 19.59, 4.73, 3.62, 1.82],
    [-4.45, 19.55, 2.03, 2.85, 0.91],
    [4.45, 19.55, 2.03, 2.85, 0.91],
    [0, 13.16, 5.11, 4.64, 0.15],
    [0, 7.0, 4.87, 4.62, 0.15],
  ])
    aperture(out, f, u, y, w, h, rise, lod, 0.26, rgb('64584d'));
  fbox(out, 'stone', f, -6.81, 6.81, 23.52, 24.32, -0.14, 0.65, stone);
  if (lod >= 2) lettering(out, f, 0.663, 23.56);
}
function facadeBays(out, f, lod) {
  for (const y of [6.31, 12.02, 17.57, 22.9])
    cornice(out, f, -20.21, 20.21, y, y === 6.31 ? 0.36 : 0.2, 0.18);
  for (const side of [-1, 1]) {
    const center = side * 12.8;
    gable(out, f, center, 6.12, historicEave - 1.08, historicEave + 2.25, 0.34, lod);
    if (lod === 0) continue;
    for (const u of [side * 9.3, center, side * 17.05]) {
      aperture(out, f, u, 0.64, 3.06, 5.48, 1.51, lod, 0.29);
      aperture(out, f, u, 7.8, 2.16, 3.88, 0.53, lod, 0.23);
      if (lod === 1) aperture(out, f, u, 13.02, 2.18, 3.98, 0.7, lod, 0.21);
      else {
        for (const x of [u - 0.64, u + 0.64])
          aperture(out, f, x, 13.05, 1.03, 4.01, 0.51, lod, 0.17);
      }
      for (const x of [u - 0.91, u, u + 0.91])
        aperture(out, f, x, 18.32, 0.68, 3.82, 0.35, lod, 0.16);
    }
    if (lod >= 2) {
      const u = center;
      for (const x of [u - 2.19, u + 2.19]) {
        fbox(out, 'stone', f, x - 0.16, x + 0.16, 6.36, 22.82, -0.045, 0.32, stone);
        for (const y of [7.1, 12.2, 18.02, 22.33])
          fbox(out, 'stone', f, x - 0.24, x + 0.24, y - 0.13, y + 0.14, 0.22, 0.42, stoneShade);
      }
      aperture(out, f, u, 19.08, 2.31, 3.45, 1.16, lod, 0.31);
    }
  }
}
function clippedCorners(out, lod) {
  const faces = [wallFace(historic[0], historic[1]), wallFace(historic[2], historic[3])];
  for (const face of faces) {
    const u = face.length / 2;
    gable(out, face, u, face.length - 0.09, historicEave - 0.7, historicEave + 2.85, 0.28, lod);
    for (const y of [6.52, 12.37, 18.16]) balcony(out, face, u, y, face.length - 0.53, 1.8, lod);
    if (lod < 1) continue;
    for (const [bottom, height] of [
      [0.68, 5.36],
      [7.15, 4.43],
      [13.04, 4.35],
      [18.98, 3.55],
    ])
      aperture(out, face, u, bottom, 2.34, height, 1.02, lod, 0.28);
    if (lod >= 2) {
      aperture(out, face, u, 24.28, 0.83, 0.88, 0.385, lod, 0.17);
      for (const x of [u - 1.55, u + 1.55]) column(out, face, x, 0.61, 23.05, 0.22, 0.17, lod);
    }
  }
}
function originalHotel(out, lod) {
  extrude(out, 'granite', historic, foundation, 1.27, granite, { top: false });
  extrude(out, 'brick', historic, 1.27, historicEave - 0.43, brick, { top: false });
  cap(out, 'roof', historic, historicEave - 0.43, roof);
  gableRoof(
    out,
    'roof',
    [-22.26, 15.28],
    [21.05, 15.28],
    46.43,
    historicEave - 0.52,
    historicEave + 2.6,
    roof,
    { overhang: 0.29, endSlot: 'brick', endColor: brick },
  );
  for (const [f, depth] of [
    [goldSouth, 3.48],
    [brazos, 2.18],
  ]) {
    facadeBays(out, f, lod);
    centralLoggia(out, f, depth, lod);
  }
  clippedCorners(out, lod);
}
function annexShell(out, lod) {
  const base = outwardRing([
    [-25.31, -41.88],
    [-25.69, -9.18],
    [11.93, -9.93],
    [11.98, -12.8],
    [23.78, -12.7],
    [24, -41.39],
  ]);
  extrude(out, 'granite', base, foundation, 3.76, granite, { top: false });
  extrude(out, 'annex', base, 3.76, 10.01, annexBrick, { top: false });
  cap(out, 'roof', base, 10.01, roof);
  const body = outwardRing([
    [-25.18, -41.8],
    [-25.46, -12.39],
    [-18.83, -12.28],
    [-18.77, -10.97],
    [5.08, -10.93],
    [5.21, -41.46],
  ]);
  extrude(out, 'annex', body, 9.97, annexHeight - 0.83, annexBrick, { top: false });
  cap(out, 'roof', body, annexHeight - 0.83, roof);
  box(out, 'annex', -19.79, -8.15, -34.03, -20.52, annexHeight - 0.87, annexHeight, annexBrick);
  for (let i = 0; i < body.length; i++) {
    const face = wallFace(body[i], body[(i + 1) % body.length]);
    cornice(out, face, -0.17, face.length + 0.17, annexHeight - 1.43, 0.53, 0.22);
    if (face.length < 8.75 || lod === 0) continue;
    const n = Math.round(face.length / 4.36);
    const pitch = face.length / n;
    for (let b = 0; b < n; b++) {
      const u = (b + 0.5) * pitch;
      if (lod >= 2 && b % 2 === 0 && b > 0)
        fbox(
          out,
          'annex',
          face,
          u - pitch / 2 - 0.12,
          u - pitch / 2 + 0.15,
          10.06,
          annexHeight - 1.68,
          -0.12,
          0.16,
          rgb('b4a188'),
        );
      for (let floor = 0; floor < 10; floor++) {
        if (lod === 1 && (floor % 2 === 1 || b % 2 === 1)) continue;
        const y = 11.15 + floor * 3.98;
        aperture(out, face, u, y, 1.57, 2.32, floor === 9 ? 0.31 : 0, lod, lod >= 2 ? 0.115 : 0);
        if (lod >= 2 && floor >= 8 && b % 2 === 0)
          cornice(out, face, u - 0.95, u + 0.95, y - 0.16, 0.16, 0.21);
      }
    }
  }
  if (lod >= 1) {
    const f = facade([23.93, -41.51], [-1, 0]);
    for (const u of [4.94, 10.25, 15.76, 21.37, 27.1, 33.02, 39.2, 45.32])
      aperture(out, f, u, 3.48, 2.85, 4.29, 0.95, lod, 0.27);
    cornice(out, f, 0, 49, 9.8, 0.43, 0.27);
  }
}
function build(out, lod) {
  originalHotel(out, lod);
  annexShell(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'driskill-hotel-model.mjs';
const camera = [89, 42, 130];
const lookAt = [-2, 20, 5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1886 brick and limestone Driskill, with gabled loggias and its taller historic Seventh Street annex.',
  camera,
  lookAt,
  sunDirection: [41, 60, 45],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'City of Austin planimetry for the original hotel and adjoining tower.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'whole-driskill-and-seventh-street-tower', position: camera, lookAt },
    {
      name: 'sixth-street-arcades-and-gabled-loggia',
      position: [-2, 25, 96],
      lookAt: [-1, 15.2, 40],
    },
    { name: 'brazos-corner-balconies-and-annex', position: [94, 24, 58], lookAt: [15, 16.4, 15] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'driskill-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.106, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.042, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Footprint and height from City of Austin planimetry. © OpenStreetMap contributors. Mapzen open elevation.',
};
