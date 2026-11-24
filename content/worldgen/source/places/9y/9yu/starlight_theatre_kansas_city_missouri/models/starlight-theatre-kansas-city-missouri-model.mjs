import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const site = read('native-map/starlight-site-controls').plan;
const terrain = read('terrain-grid');
const dimensions = plan.dimensions;
const colors = {
  brick: rgb('895d49'),
  trim: rgb('b5aea0'),
  roof: rgb('777970'),
  olderCopper: rgb('577e71'),
  copper: rgb('666b67'),
  truss: rgb('5e7971'),
  shadow: rgb('363a3c'),
  gallery: rgb('59615f'),
  paving: rgb('b5afa1'),
  shutDoor: rgb('adb4b3'),
  glass: rgb('515854'),
  seat: rgb('334740'),
  seatBack: rgb('405249'),
  slab: rgb('9b968b'),
};
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.85 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84 },
};
const square = (x0, z0, x1, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const expand = (points, ratio) => {
  const [a, b] = points.reduce(
    ([x, z], p) => [x + p[0] / points.length, z + p[1] / points.length],
    [0, 0],
  );
  return points.map(([x, z]) => [a + (x - a) * ratio, b + (z - b) * ratio]);
};
const atHeight = ([x, z], y) => [x, y, z];
const pointMix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
function volume(out, slot, outline, bottom, top, color, capColor = color, capSlot = slot) {
  const corners = outwardRing(outline);
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    const corners3d = [
      atHeight(a, bottom),
      atHeight(b, bottom),
      atHeight(b, top),
      atHeight(a, top),
    ];
    if (slot === 'masonry') {
      const face = wallFace(a, b);
      const u = face.length / 2.1;
      const v = (top - bottom) / 1.55;
      out.addQuad(
        slot,
        'palette:#ffffff',
        corners3d,
        [face.normal[0], 0, face.normal[1]],
        [
          [0, 0],
          [u, 0],
          [u, v],
          [0, v],
        ],
        color,
      );
    } else {
      quad4(out, slot, ...corners3d, color);
    }
  }
  const triangles = earcut(corners.flat());
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3).map((index) => atHeight(corners[index], top));
    tri(out, capSlot, a, c, b, capColor);
  }
}

function tower(out, outline, cornice, tip, copper, level) {
  const ring = outwardRing(outline);
  volume(out, 'masonry', ring, -0.45, cornice, colors.brick);
  const eave = expand(ring, 1.13);
  volume(out, 'masonry', eave, cornice - 0.33, cornice, colors.brick);
  const sections =
    level === 0
      ? [
          [0, 1],
          [0.82, 0.23],
        ]
      : [
          [0, 1],
          [0.16, 0.77],
          [0.39, 0.51],
          [0.69, 0.29],
          [0.84, 0.21],
        ];
  const roof = [...sections, [0.94, 0.14]].map(([fraction, scale]) => ({
    height: cornice + (tip - cornice) * fraction,
    ring: expand(eave, scale),
  }));
  for (let j = 0; j < roof.length - 1; j++) {
    const lower = roof[j];
    const upper = roof[j + 1];
    for (let i = 0; i < ring.length; i++) {
      const k = (i + 1) % ring.length;
      quad4(
        out,
        'copper',
        atHeight(lower.ring[i], lower.height),
        atHeight(lower.ring[k], lower.height),
        atHeight(upper.ring[k], upper.height),
        atHeight(upper.ring[i], upper.height),
        copper,
      );
    }
  }
  volume(out, 'copper', roof.at(-1).ring, roof.at(-1).height - 0.04, tip, copper);
  if (level === 0) return;
  for (let i = 0; i < ring.length; i++) {
    const edge = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (edge.normal[1] > 0.6 || edge.length < 1.9) continue;
    const mid = edge.length / 2;
    const bottom = cornice - 4.2;
    const top = cornice - 1.65;
    const width = edge.length * 0.52;
    fbox(
      out,
      'trim',
      edge,
      mid - width / 2,
      mid + width / 2,
      bottom,
      top,
      0.005,
      0.027,
      colors.glass,
    );
    fbox(
      out,
      'concrete',
      edge,
      mid - width / 2 - 0.1,
      mid + width / 2 + 0.1,
      bottom - 0.16,
      bottom,
      0.003,
      0.16,
      colors.trim,
    );
    fbox(
      out,
      'concrete',
      edge,
      mid - width / 2 - 0.1,
      mid + width / 2 + 0.1,
      top,
      top + 0.13,
      0.003,
      0.1,
      colors.trim,
    );
    if (level >= 2) {
      fbox(out, 'trim', edge, mid - 0.042, mid + 0.042, bottom, top, 0.032, 0.072, colors.brick);
      fbox(
        out,
        'trim',
        edge,
        mid - width / 2,
        mid + width / 2,
        (top + bottom) / 2 - 0.035,
        (top + bottom) / 2 + 0.035,
        0.032,
        0.07,
        colors.brick,
      );
    }
  }
}

function stage(out, level) {
  const ring = frame.geometry.outline;
  const lowerStage = [...ring.slice(0, 14), ...ring.slice(18, 22), ...ring.slice(28)];
  volume(out, 'masonry', lowerStage, -1.25, 8.15, colors.brick, colors.slab, 'roof');
  const front = site.mainRoof;
  const mainStage = [front[0], front[1], [15.15, 22.37], [-17.35, 22.28]];
  volume(out, 'masonry', mainStage, 8.03, dimensions.stageHouseRoofM - 0.33, colors.brick);
  volume(
    out,
    'roof',
    expand(mainStage, 1.035),
    dimensions.stageHouseRoofM - 0.34,
    dimensions.stageHouseRoofM,
    colors.roof,
  );
  const tall = [square(-22.98, 0.32, -16.65, 6.9), square(13.81, 0.6, 20.14, 7.22)];
  const historic = [ring.slice(13, 19), ring.slice(21, 29)];
  for (const outline of tall)
    tower(
      out,
      outline,
      dimensions.tallTowerCorniceM,
      dimensions.tallTowerFinialM,
      colors.copper,
      level,
    );
  for (const outline of historic)
    tower(
      out,
      outline,
      dimensions.historicTowerCorniceM,
      dimensions.historicTowerFinialM,
      colors.olderCopper,
      level,
    );

  abox(out, 'concrete', [-16.75, -0.39, -3.57], [16.09, 0.6, 0.16], colors.slab);
  const floor = 0.61;
  const doorTop = dimensions.stageOpeningM;
  abox(out, 'trim', [-15.3, floor, -0.26], [14.85, doorTop, 0.02], colors.shutDoor);
  abox(out, 'trim', [-16.83, doorTop, -0.06], [14.95, 24.68, 0.17], colors.gallery);
  const rearDock = wallFace(ring[5], ring[0]);
  for (const distance of [9.55, 14.3, 21.6]) {
    fbox(
      out,
      'trim',
      rearDock,
      distance - 1.7,
      distance + 1.7,
      0.63,
      4.64,
      0.015,
      0.035,
      colors.gallery,
    );
    if (level >= 2) {
      for (let y = 0.96; y < 4.44; y += 0.36) {
        fbox(
          out,
          'trim',
          rearDock,
          distance - 1.62,
          distance + 1.62,
          y,
          y + 0.018,
          0.039,
          0.06,
          colors.trim,
        );
      }
    }
  }
  const supports = [-16.6, -10.77, -5.25, 0.18, 5.61, 11.08, 14.86];
  const floors = [8.82, 13.08, 17.42, 21.31, 24.72];
  for (const y of floors) {
    abox(
      out,
      'trim',
      [supports[0], y - 0.19, -1.06],
      [supports.at(-1), y + 0.12, 0.09],
      colors.truss,
    );
  }
  for (const x of supports) {
    abox(out, 'trim', [x - 0.13, floors[0], -1.06], [x + 0.13, floors.at(-1), -0.8], colors.truss);
  }
  if (level === 0) return;
  for (let i = 0; i < supports.length - 1; i++) {
    for (let j = 0; j < floors.length - 1; j++) {
      const a = [supports[i], floors[j] + 0.16, -0.82];
      const b = [supports[i + 1], floors[j + 1] - 0.08, -0.82];
      beam(out, 'trim', a, b, 0.12, 0.12, colors.truss);
      if (level >= 2)
        beam(
          out,
          'trim',
          [b[0], a[1], a[2] + 0.025],
          [a[0], b[1], b[2] + 0.025],
          0.1,
          0.1,
          colors.truss,
        );
    }
  }
  if (level >= 2) {
    for (let y = floor + 0.41; y < doorTop - 0.09; y += 0.48) {
      abox(out, 'trim', [-15.22, y, -0.284], [14.77, y + 0.018, -0.256], colors.trim);
    }
    for (const x of [-11.4, -0.2, 11.3]) {
      abox(out, 'trim', [x, 9.17, -1.19], [x + 0.75, 10.42, -0.94], colors.shadow);
    }
  }
}

function grade([x, z]) {
  const [x0, z0] = terrain.origin;
  const step = terrain.stepMeters;
  const i = Math.floor((x - x0) / step);
  const j = Math.floor((z - z0) / step);
  const a = (x - x0) / step - i;
  const b = (z - z0) / step - j;
  const field = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * field[j][i] + a * field[j][i + 1]) +
    b * ((1 - a) * field[j + 1][i] + a * field[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function bowlSlab(out, bands, subdivisions) {
  const surface = (a, b, c, d, u, v) => {
    const p = pointMix(pointMix(a, b, u), pointMix(d, c, u), v);
    return atHeight(p, grade(p) + 0.055);
  };
  for (let j = 0; j < bands.length - 1; j++) {
    for (let i = 0; i < bands[j].length - 1; i++) {
      const a = bands[j][i],
        b = bands[j + 1][i];
      const c = bands[j + 1][i + 1],
        d = bands[j][i + 1];
      for (let k = 0; k < subdivisions; k++) {
        const u = k / subdivisions,
          next = (k + 1) / subdivisions;
        for (let m = 0; m < 3; m++) {
          const v = m / 3,
            right = (m + 1) / 3;
          const p = surface(a, b, c, d, u, v);
          const q = surface(a, b, c, d, u, right);
          const r = surface(a, b, c, d, next, right);
          const s = surface(a, b, c, d, next, v);
          tri(out, 'concrete', p, q, r, colors.paving);
          tri(out, 'concrete', p, r, s, colors.paving);
        }
      }
    }
  }
}

function seats(out, level) {
  const front = [
    [-21, -9],
    [-11, -11.2],
    [0, -12],
    [11, -11.1],
    [21, -9],
  ];
  const bands = [front, ...site.auditoriumBands];
  const rows = [2, 4, 8, 12][level];
  bowlSlab(out, bands, rows);
  const pitch = [8, 5, 1.35, 0.85][level];
  for (let band = 0; band < bands.length - 1; band++) {
    for (let row = 0; row < rows; row++) {
      const u = (row + 0.23) / rows;
      const line = bands[band].map((p, i) => pointMix(p, bands[band + 1][i], u));
      for (let i = 0; i < line.length - 1; i++) {
        const facade = wallFace(line[i], line[i + 1]);
        const trim = band === 2 ? 0.84 : 0.9;
        const count = Math.max(1, Math.floor((facade.length - 2 * trim) / pitch));
        const stride = (facade.length - 2 * trim) / count;
        for (let j = 0; j < count; j++) {
          const mid = trim + (j + 0.5) * stride;
          const width = stride * (level < 2 ? 0.98 : 0.78);
          const [x, , z] = facade.P(mid, 0);
          const bottom = grade([x, z]);
          const a = mid - width / 2,
            b = mid + width / 2;
          quad4(
            out,
            'trim',
            facade.P(a, bottom + 0.11),
            facade.P(b, bottom + 0.11),
            facade.P(b, bottom + 0.92, -0.12),
            facade.P(a, bottom + 0.92, -0.12),
            colors.seatBack,
          );
          quad4(
            out,
            'trim',
            facade.P(b, bottom + 0.11, -0.025),
            facade.P(a, bottom + 0.11, -0.025),
            facade.P(a, bottom + 0.92, -0.15),
            facade.P(b, bottom + 0.92, -0.15),
            colors.seat,
          );
          if (level >= 2) {
            quad4(
              out,
              'trim',
              facade.P(a, bottom + 0.48),
              facade.P(a, bottom + 0.46, 0.5),
              facade.P(b, bottom + 0.46, 0.5),
              facade.P(b, bottom + 0.48),
              colors.seat,
            );
          }
        }
      }
    }
  }
}

function build(out, level) {
  stage(out, level);
  seats(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'starlight-theatre-kansas-city-missouri-model.mjs';
const camera = [-78, 44, -96];
const lookAt = [0, 10, -19];
const appearance = {
  kind: 'historical',
  currentWorldEligible: false,
  representedDate: '2022-06-29',
  validFrom: '2022-01-01',
  validUntil: '2024-10-01',
};

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Starlight Theatre (Kansas City, Missouri)',
  wikidataId: plan.wikidataId,
  category: 'outdoor-theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  appearance,
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Swope Park’s outdoor theatre, with the four copper-roofed brick towers and the Cohen Community Stage as they stood in 2022.',
  camera,
  lookAt,
  sunDirection: [-59, 63, -62],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'The native stage house perimeter, independent of the graded audience bowl.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'concrete_plain',
    'metal_standing_seam',
    'metal_copper',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cohen-stage-and-front-towers', position: [-40, 10.4, -43], lookAt: [0, 13, 0] },
    { name: 'elevated-open-seating-bowl', position: [44, 42, -72], lookAt: [0, 8, -24] },
    { name: 'stage-house-backstage', position: [-49, 29, 60], lookAt: [0, 11, 11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'starlight-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. OpenStreetMap outlines under ODbL. USGS/USDA survey data in the public domain.',
};
