import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fbox,
  gableRoof,
  lathe,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const { wingEaveM, wingRidgeM, towerEaveM, towerRidgeM, courtyardWidthM, courtyardDepthM } =
  plan.dimensions;
const tones = {
  lime: rgb('dbca8c'),
  inset: rgb('c2b985'),
  white: rgb('dddacf'),
  oldWhite: rgb('bcb3a0'),
  foot: rgb('78736a'),
  band: rgb('e7ddbe'),
  tile: rgb('a45438'),
  tileDark: rgb('8c4a33'),
  glass: rgb('475451'),
  skyGlass: rgb('667d80'),
  iron: rgb('57625c'),
  gray: rgb('848b84'),
  wood: rgb('59534a'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.92 },
  roofMetal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.81 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79 },
};
const in3d = ([x, z], y) => [x, y, z];
const square = ([x0, z0], [x1, z1]) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const ground = -1.45;
function pane(out, slot, f, u0, u1, y0, y1, d, color) {
  quad4(out, slot, f.P(u0, y0, d), f.P(u1, y0, d), f.P(u1, y1, d), f.P(u0, y1, d), color);
}

function window(out, face, u, base, width, top, arch, level) {
  const half = width / 2;
  const shoulder = top - (arch ? half : 0);
  fbox(
    out,
    'detail',
    face,
    u - half - 0.09,
    u + half + 0.09,
    base,
    shoulder,
    0,
    0.046,
    tones.white,
  );
  pane(
    out,
    'detail',
    face,
    u - half * 0.81,
    u + half * 0.81,
    base + 0.13,
    shoulder,
    0.052,
    tones.glass,
  );
  fbox(
    out,
    'stone',
    face,
    u - half - 0.16,
    u + half + 0.16,
    base - 0.08,
    base + 0.02,
    -0.005,
    0.17,
    tones.oldWhite,
  );
  if (arch) {
    const n = [5, 7, 12, 16][level];
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI) / n,
        b = ((i + 1) * Math.PI) / n;
      const point = (angle, radius, d) =>
        face.P(u + Math.cos(angle) * radius, shoulder + Math.sin(angle) * radius, d);
      quad4(
        out,
        'detail',
        point(a, half + 0.095, 0.051),
        point(b, half + 0.095, 0.051),
        point(b, half * 0.81, 0.052),
        point(a, half * 0.81, 0.052),
        tones.white,
      );
      tri(
        out,
        'detail',
        face.P(u, shoulder - 0.005, 0.054),
        point(a, half * 0.813, 0.054),
        point(b, half * 0.813, 0.054),
        tones.glass,
      );
    }
  }
  if (level >= 2) {
    pane(out, 'detail', face, u - 0.042, u + 0.042, base + 0.09, top - 0.07, 0.061, tones.white);
    pane(
      out,
      'detail',
      face,
      u - half + 0.06,
      u + half - 0.06,
      base + 0.6 * (shoulder - base),
      base + 0.6 * (shoulder - base) + 0.07,
      0.061,
      tones.white,
    );
  }
}

function wallBand(out, corners, y0, y1, depth, slot, color) {
  const ring = outwardRing(corners);
  for (let i = 0; i < ring.length; i++) {
    const f = wallFace(ring[i], ring[(i + 1) % ring.length]);
    fbox(out, slot, f, -depth * 0.88, f.length + depth * 0.88, y0, y1, -0.03, depth, color);
  }
}

function outerWalls(out, level) {
  const path = outwardRing(frame.geometry.outline);
  for (let i = 0; i < path.length; i++) {
    const a = path[i],
      b = path[(i + 1) % path.length];
    const f = wallFace(a, b);
    const y0 = level === 0 ? wingEaveM : wingEaveM - 0.31;
    pane(out, 'wall', f, 0, f.length, ground, y0, 0, tones.lime);
    pane(out, 'stone', f, 0, f.length, ground, 0.67, 0.025, tones.foot);
    if (level >= 1) {
      fbox(out, 'stone', f, -0.09, f.length + 0.09, y0, wingEaveM, -0.035, 0.13, tones.band);
      if (f.length < 4.1) continue;
      const count = Math.max(1, Math.round((f.length - 1.05) / 4.4));
      for (let j = 0; j < count; j++) {
        const u = ((j + 0.5) * f.length) / count;
        const inEastTower = f.P(u, 0)[0] > 11.95 && f.P(u, 0)[2] > 8.1;
        if (inEastTower) continue;
        window(out, f, u, 2.25, 1.22, 5.63, f.normal[1] > -0.55, level);
        if (level >= 2) window(out, f, u, 7.25, 1.02, 8.84, false, level);
      }
    }
  }
}

const roofCorners = square([-12.02, -17.58], [22.02, 16.88]);
const courtCenter = [4.64, -0.39];
const courtyard = square(
  [courtCenter[0] - courtyardWidthM / 2, courtCenter[1] - courtyardDepthM / 2],
  [courtCenter[0] + courtyardWidthM / 2, courtCenter[1] + courtyardDepthM / 2],
);

function surroundingRoofs(out, level) {
  const ridges = roofCorners.map((p, i) => [
    p[0] * 0.48 + courtyard[i][0] * 0.52,
    p[1] * 0.48 + courtyard[i][1] * 0.52,
  ]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad4(
      out,
      'roof',
      in3d(roofCorners[i], wingEaveM),
      in3d(roofCorners[j], wingEaveM),
      in3d(ridges[j], wingRidgeM),
      in3d(ridges[i], wingRidgeM),
      tones.tile,
    );
    quad4(
      out,
      'roof',
      in3d(ridges[i], wingRidgeM),
      in3d(ridges[j], wingRidgeM),
      in3d(courtyard[j], wingEaveM + 0.49),
      in3d(courtyard[i], wingEaveM + 0.49),
      tones.tileDark,
    );
    if (level >= 1) {
      beam(
        out,
        'roof',
        in3d(ridges[i], wingRidgeM + 0.043),
        in3d(ridges[j], wingRidgeM + 0.043),
        0.21,
        0.2,
        tones.tile,
      );
      beam(
        out,
        'roof',
        in3d(roofCorners[i], wingEaveM + 0.024),
        in3d(ridges[i], wingRidgeM + 0.056),
        0.24,
        0.16,
        tones.tile,
      );
    }
  }
  const [x, z] = courtCenter;
  gableRoof(
    out,
    'detail',
    [x, z - courtyardDepthM / 2],
    [x, z + courtyardDepthM / 2],
    courtyardWidthM,
    wingEaveM + 0.62,
    wingEaveM + 2.14,
    tones.skyGlass,
    { overhang: 0.02, endSlot: 'detail', endColor: tones.skyGlass },
  );
  if (level >= 2) {
    for (let z0 = z - courtyardDepthM / 2 + 0.21; z0 < z + courtyardDepthM / 2; z0 += 1.55) {
      for (const sign of [-1, 1]) {
        beam(
          out,
          'detail',
          [x, wingEaveM + 2.192, z0],
          [x + (sign * courtyardWidthM) / 2, wingEaveM + 0.676, z0],
          0.11,
          0.11,
          tones.iron,
        );
      }
    }
  }
  gableRoof(
    out,
    'roof',
    [20.82, -7.78],
    [28.75, -7.78],
    7.85,
    wingEaveM - 0.06,
    wingRidgeM - 1.23,
    tones.tile,
    { overhang: 0.39, endSlot: 'wall', endColor: tones.lime },
  );
  const stacks = [
    [-6.7, -11.5, 14.8],
    [1.8, 10.75, 15.5],
    [15.2, -11.7, 15.7],
  ];
  for (const [px, pz, y] of stacks) {
    abox(out, 'wall', [px - 0.52, y - 2.25, pz - 0.42], [px + 0.52, y, pz + 0.42], tones.white);
    if (level >= 1)
      abox(
        out,
        'roofMetal',
        [px - 0.58, y - 0.12, pz - 0.48],
        [px + 0.58, y + 0.04, pz + 0.48],
        tones.gray,
      );
  }
}

function blindArch(out, f, center, level) {
  const spring = 14.56;
  const radius = 2.32;
  const width = 0.74;
  const bottom = 10.43;
  for (const side of [-1, 1]) {
    const a = center + side * radius,
      b = center + side * (radius + width);
    const [lo, hi] = [Math.min(a, b), Math.max(a, b)];
    const rows = level >= 2 ? 9 : 1;
    for (let i = 0; i < rows; i++) {
      const step = (spring - bottom) / rows;
      pane(
        out,
        'detail',
        f,
        lo,
        hi,
        bottom + i * step,
        bottom + (i + 1) * step - 0.022,
        0.052,
        tones.white,
      );
    }
  }
  pane(out, 'wall', f, center - radius, center + radius, bottom, spring, 0.024, tones.inset);
  pane(
    out,
    'detail',
    f,
    center - radius,
    center + radius,
    spring - 0.15,
    spring + 0.16,
    0.056,
    tones.white,
  );
  const n = [5, 7, 15, 19][level];
  const p = (a, r, d) => f.P(center + r * Math.cos(a), spring + r * Math.sin(a), d);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI) / n + 0.005,
      b = ((i + 1) * Math.PI) / n - 0.005;
    quad4(
      out,
      'detail',
      p(a, radius + width, 0.052),
      p(b, radius + width, 0.052),
      p(b, radius, 0.052),
      p(a, radius, 0.052),
      tones.white,
    );
    tri(
      out,
      'wall',
      f.P(center, spring - 0.003, 0.024),
      p(a - 0.005, radius + 0.004, 0.024),
      p(b + 0.005, radius + 0.004, 0.024),
      tones.inset,
    );
  }
}

function keep(out, level) {
  const outline = square([12.71, 6.6], [22.73, 16.61]);
  const corners = outwardRing(outline);
  const portal = wallFace([20.67, 3.69], [20.67, 1.66]);
  window(out, portal, 1.08, 0.12, 1.66, 3.1, true, level);
  pane(out, 'detail', portal, 0.27, 1.89, 0.12, 2.36, 0.081, tones.wood);
  for (let i = 0; i < corners.length; i++) {
    const f = wallFace(corners[i], corners[(i + 1) % corners.length]);
    pane(out, 'wall', f, 0, f.length, 9.72, towerEaveM, 0, tones.lime);
    if (level >= 1) {
      blindArch(out, f, f.length / 2, level);
      if (f.normal[0] > 0.9 || f.normal[1] > 0.9) {
        const shift = ([x, z]) => [x + 0.053 * f.normal[0], z + 0.053 * f.normal[1]];
        const lowerFace = wallFace(shift(corners[i]), shift(corners[(i + 1) % corners.length]));
        window(out, lowerFace, lowerFace.length / 2, 7.19, 1.23, 9.61, false, level);
        window(out, lowerFace, lowerFace.length / 2 - 1.08, 2.42, 1.47, 4.48, false, level);
      }
      for (const off of [-1.03, 0, 1.03]) {
        window(out, f, f.length / 2 + off, 18.16, 0.72, 19.73, false, level);
      }
    }
  }
  wallBand(out, outline, 10.0, 10.35, 0.15, 'stone', tones.band);
  wallBand(out, outline, towerEaveM - 0.46, towerEaveM - 0.2, 0.22, 'stone', tones.band);
  if (level >= 1)
    wallBand(out, outline, towerEaveM - 0.21, towerEaveM + 0.1, 0.38, 'stone', tones.white);
  const outer = square([12.14, 6.02], [23.34, 17.17]);
  const apex = [17.74, towerRidgeM, 11.62];
  for (let i = 0; i < 4; i++) {
    const a = in3d(outer[i], towerEaveM + 0.09);
    const b = in3d(outer[(i + 1) % 4], towerEaveM + 0.09);
    tri(out, 'roof', a, b, apex, tones.tile);
    if (level >= 2) beam(out, 'roof', a, apex, 0.23, 0.17, tones.tileDark);
  }
  if (level >= 1) {
    lathe(
      out,
      'detail',
      [apex[0], apex[2]],
      [
        [towerRidgeM - 0.02, 0.42, 0.42],
        [towerRidgeM + 0.77, 0.1, 0.1],
        [towerRidgeM + 0.95, 0, 0],
      ],
      12,
      tones.iron,
    );
    beam(
      out,
      'detail',
      [apex[0], towerRidgeM + 0.8, apex[2]],
      [apex[0], towerRidgeM + 2.29, apex[2]],
      0.04,
      0.04,
      tones.iron,
    );
    if (level >= 2) {
      const vane = wallFace([apex[0], apex[2]], [apex[0] + 0.6, apex[2] + 0.095]);
      fbox(
        out,
        'detail',
        vane,
        0.02,
        0.6,
        towerRidgeM + 1.88,
        towerRidgeM + 2.24,
        -0.021,
        0.022,
        tones.iron,
      );
    }
  }
}

function enclosingWall(out, level) {
  const points = frame.features[1].points;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const f = wallFace(a, b);
    fbox(out, 'wall', f, 0, f.length, ground, 2.03, -0.19, 0.2, tones.oldWhite);
    gableRoof(out, 'roof', a, b, 0.49, 2.03, 2.29, tones.tile, { overhang: 0.055 });
    if (level >= 1) {
      const count = Math.floor(f.length / 4.35);
      for (let k = 0; k <= count; k++) {
        const x = (f.length * k) / count;
        fbox(out, 'stone', f, x - 0.2, x + 0.2, ground, 2.31, -0.32, 0.34, tones.white);
      }
    }
  }
}

function build(out, level) {
  outerWalls(out, level);
  surroundingRoofs(out, level);
  keep(out, level);
  enclosingWall(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ventspils-castle-model.mjs';
const camera = [61, 43, 67];
const lookAt = [-4, 10, 5];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Ventspils Castle',
  wikidataId: plan.wikidataId,
  category: 'historic-castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The ochre four-wing Livonian castle with tiled roofs, white blind arches, southeast tower and adjoining heritage wall.',
  camera,
  lookAt,
  sunDirection: [48, 62, 70],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Mapped existing castle perimeter, tower and chapel.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'clay_fired', 'metal_standing_seam'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'tower-from-southeast', position: [47, 8, 48], lookAt: [16, 13, 11] },
    { name: 'chapel-and-courtyard-roofs', position: [39, 48, -45], lookAt: [5, 13, 0] },
    { name: 'museum-wings-and-bailey', position: [-54, 20, 67], lookAt: [0, 10, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ventspils-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.09, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.035, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Latvian national terrain and OSM geometry under their published open data terms.',
};
