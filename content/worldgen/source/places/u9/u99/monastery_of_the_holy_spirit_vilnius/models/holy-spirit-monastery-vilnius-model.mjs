/** West front, crossing dome and apses of the Orthodox Holy Spirit church in Vilnius. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.79, metallic: 0.16 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.59, metallic: 0.05 },
};
const t = Object.fromEntries(
  Object.entries({
    yellow: 'dbc59a',
    yellowShadow: 'cdb58e',
    cream: 'dedbd1',
    creamShadow: 'bebdb3',
    base: '987d73',
    roof: '83716a',
    cupola: '9a756b',
    iron: '7c6b59',
    gold: 'b99a5a',
    door: '66493d',
    frame: '8e7259',
    black: '4a3d36',
    glass: '566060',
    blue: '85959d',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function panel(out, slot, l, r, b, h, z, color) {
  face(
    out,
    slot,
    [
      [l, b, z],
      [r, b, z],
      [r, h, z],
      [l, h, z],
    ],
    color,
  );
}

function opening(out, x, z, y, w, h, lod, door = false) {
  const half = w / 2,
    rise = door ? 0 : Math.min(0.6, h * 0.15),
    spring = y + h - rise;
  panel(out, 'trim', x - half - 0.14, x + half + 0.14, y - 0.13, y + h + 0.11, z, t.creamShadow);
  panel(
    out,
    door ? 'wood' : 'glass',
    x - half,
    x + half,
    y,
    spring,
    z + 0.025,
    door ? t.door : t.glass,
  );
  if (!lod) {
    if (door) return;
    panel(
      out,
      door ? 'wood' : 'glass',
      x - half,
      x + half,
      spring,
      y + h,
      z + 0.025,
      door ? t.door : t.glass,
    );
    return;
  }
  const count = lod > 1 ? 9 : 4;
  for (let i = 0; rise > 0 && i < count; i++) {
    const a = (i * Math.PI) / count,
      b = ((i + 1) * Math.PI) / count,
      p = (c) => [x + half * Math.cos(c), spring + rise * Math.sin(c), z + 0.025];
    triangle(
      out,
      door ? 'wood' : 'glass',
      [[x, spring, z + 0.025], p(a), p(b)],
      door ? t.door : t.glass,
    );
  }
  if (lod) {
    for (let i = 1; i <= (door ? 1 : 3); i++) {
      const v = x - half + (w * i) / (door ? 2 : 4);
      panel(out, 'wood', v - 0.028, v + 0.028, y, spring, z + 0.041, t.frame);
    }
    if (lod > 1)
      for (let i = 1; i <= (door ? 3 : 4); i++) {
        const b = y + ((spring - y) * i) / 5;
        panel(out, 'wood', x - half, x + half, b, b + 0.034, z + 0.045, t.frame);
      }
  }
}

function walls(out, bounds, ground, eave) {
  const [left, right, back, front] = bounds;
  box(out, 'plaster', [left, ground - 2.2, back], [right, ground + 0.58, front], t.base);
  box(out, 'plaster', [left, ground + 0.58, back], [right, eave, front], t.yellow);
  box(
    out,
    'trim',
    [left - 0.14, eave - 0.25, back - 0.14],
    [right + 0.14, eave + 0.07, front + 0.14],
    t.cream,
  );
}

function roof(out, bounds, eave, top, longitudinal = true) {
  const [l, r, b, f] = bounds,
    x = (l + r) / 2,
    z = (b + f) / 2;
  const [a, c, d, e] = [
    [l, eave, b],
    [r, eave, b],
    [r, eave, f],
    [l, eave, f],
  ];
  const ra = longitudinal ? [x, top, b] : [l, top, z],
    rb = longitudinal ? [x, top, f] : [r, top, z];
  if (longitudinal) {
    face(out, 'roof', [e, rb, ra, a], t.roof);
    face(out, 'roof', [ra, rb, d, c], t.roof);
    triangle(out, 'plaster', [c, a, ra], t.yellowShadow);
    triangle(out, 'plaster', [e, d, rb], t.yellow);
  } else {
    face(out, 'roof', [ra, rb, c, a], t.roof);
    face(out, 'roof', [d, rb, ra, e], t.roof);
    triangle(out, 'plaster', [a, e, ra], t.yellowShadow);
    triangle(out, 'plaster', [d, c, rb], t.yellow);
  }
}

function roundSections(out, x, z, points, sides) {
  const ring = (y, rx, rz) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = (-i * Math.PI * 2) / sides;
      return [x + rx * Math.cos(angle), y, z + rz * Math.sin(angle)];
    });
  for (let i = 1; i < points.length; i++) {
    const [low, rx, rz] = points[i - 1],
      [high, topX, topZ, slot, color] = points[i];
    loft(out, slot, [ring(low, rx, rz), ring(high, topX, topZ)], color, {
      cap: i === points.length - 1,
    });
  }
}

function cross(out, x, y, z, r, lod) {
  const z0 = z - 0.08,
    z1 = z + 0.08;
  box(out, 'wood', [x - 0.071, y, z0], [x + 0.071, y + 1.59 * r, z1], t.gold);
  box(out, 'wood', [x - 0.42 * r, y + 0.97 * r, z0], [x + 0.42 * r, y + 1.1 * r, z1], t.gold);
  if (lod) {
    box(out, 'wood', [x - 0.22 * r, y + 1.28 * r, z0], [x + 0.22 * r, y + 1.39 * r, z1], t.gold);
    beam(
      out,
      'wood',
      [x - 0.27 * r, y + 0.53 * r, z],
      [x + 0.27 * r, y + 0.39 * r, z],
      0.11,
      0.09,
      t.gold,
    );
  }
}

function cornice(out, l, r, y, z, lod) {
  box(out, 'trim', [l, y, z - 0.38], [r, y + 0.59, z + 0.24], t.creamShadow);
  if (lod)
    box(out, 'trim', [l - 0.08, y + 0.54, z - 0.39], [r + 0.08, y + 0.75, z + 0.36], t.cream);
}

function monumentFront(out, lod) {
  const layers = [
    { left: -13.72, right: 13.74, front: -11.45, back: -19.35, eave: 13.89 },
    { left: -9.07, right: 9.15, front: -7.96, back: -18.46, eave: 22.4 },
  ];
  for (const { left, right, front, back, eave } of layers) {
    walls(out, [left, right, back, front], 0.2, eave);
    cornice(out, left, right, eave - 0.35, front, lod);
  }
  const z = -8.12;
  opening(out, 0, z + 0.25, 14.2, 3.7, 5.56, lod);
  for (const x of [-6.52, 6.49]) {
    box(out, 'trim', [x - 0.66, 0.46, z - 0.37], [x + 0.66, 22.27, z + 0.34], t.cream);
    if (lod) {
      box(out, 'trim', [x - 0.8, 0.46, z - 0.37], [x + 0.8, 1.02, z + 0.5], t.creamShadow);
      box(out, 'trim', [x - 0.81, 21.52, z - 0.37], [x + 0.81, 22.18, z + 0.46], t.cream);
      for (const y of [4.26, 9.0, 16.31, 19.18])
        opening(out, x * 1.22, z + 0.19, y, 0.49, 0.74, lod);
    }
  }
  cornice(out, -9.16, 9.26, 12.5, z, lod);
  cornice(out, -9.18, 9.25, 22.1, z, lod);
  const { porchWidth, westPorchRidge, frontTowers, frontTurretTop } = plan.dimensions;
  const half = porchWidth / 2;
  walls(out, [-half, half, -8.03, 0.015], 0.13, 10.22);
  roof(out, [-half - 0.35, half + 0.35, -8.14, 0.17], 10.29, westPorchRidge);
  triangle(
    out,
    'glass',
    [
      [-half + 0.37, 10.42, 0.198],
      [half - 0.37, 10.42, 0.198],
      [0, westPorchRidge - 0.49, 0.198],
    ],
    t.blue,
  );
  for (const dir of [-1, 1]) {
    beam(
      out,
      'trim',
      [0, westPorchRidge + 0.01, 0.219],
      [dir * (half + 0.39), 10.27, 0.219],
      0.29,
      0.37,
      t.cream,
    );
    box(
      out,
      'trim',
      [dir * (half - 0.65) - 0.47, 0.54, -0.18],
      [dir * (half - 0.65) + 0.47, 10.2, 0.23],
      t.cream,
    );
  }
  cornice(out, -half - 0.31, half + 0.31, 9.96, 0.13, lod);
  opening(out, 0, 0.239, 0.29, 2.18, 4.54, lod, true);
  if (lod)
    for (const x of [-2.22, 2.22]) {
      beam(out, 'wood', [x, 2.88, 0.18], [x, 3.44, 0.52], 0.08, 0.08, t.black);
      box(out, 'glass', [x - 0.146, 3.44, 0.39], [x + 0.146, 3.91, 0.66], t.black);
      box(out, 'wood', [x - 0.184, 3.91, 0.36], [x + 0.184, 4.03, 0.69], t.black);
    }
  if (lod) {
    panel(out, 'trim', -0.94, 0.94, 6.12, 7.32, 0.28, t.creamShadow);
    panel(out, 'glass', -0.83, 0.83, 6.25, 7.2, 0.3, t.blue);
    for (const x of [-0.54, 0, 0.54]) {
      box(out, 'wood', [x - 0.107, 6.46, 0.303], [x + 0.107, 6.98, 0.311], t.door);
      box(out, 'trim', [x - 0.105, 6.92, 0.305], [x + 0.105, 7.075, 0.313], t.gold);
    }
    for (let i = 0; i < 4; i++)
      box(
        out,
        'trim',
        [-2.61 - i * 0.1, -0.33, 0.16],
        [2.61 + i * 0.1, 0.39 - i * 0.13, 0.48 + i * 0.29],
        t.creamShadow,
      );
  }
  for (const x of frontTowers) {
    const z0 = -10.59,
      r = 2.4;
    walls(out, [x - r, x + r, z0 - r, z0 + r], 0.18, 27.11);
    box(
      out,
      'trim',
      [x - r - 0.31, 26.9, z0 - r - 0.31],
      [x + r + 0.31, 27.57, z0 + r + 0.31],
      t.cream,
    );
    roundSections(
      out,
      x,
      z0,
      [
        [27.52, 2.44, 2.44],
        [28.0, 2.42, 2.42, 'roof', t.cupola],
        [28.89, 1.83, 1.83, 'roof', t.cupola],
        [29.38, 0.79, 0.79, 'roof', t.cupola],
        [29.58, 0.33, 0.33, 'trim', t.creamShadow],
      ],
      [5, 8, 12, 16][lod],
    );
    cross(out, x, 29.58, z0, (frontTurretTop - 29.58) / 1.59 + 0.41, lod);
    opening(out, x, z0 + r + 0.018, 23.45, 0.99, 1.84, lod);
    if (lod)
      for (const side of [-1, 1]) {
        box(
          out,
          'trim',
          [x + side * 1.78 - 0.32, 22.36, z0 + r - 0.2],
          [x + side * 1.78 + 0.32, 26.92, z0 + r + 0.14],
          t.cream,
        );
      }
  }
}

function nave(out, lod) {
  const volumes = [
    {
      bounds: [-13.8, 13.8, -28.61, -11.48],
      floor: 0.35,
      eave: 13.3,
      ridge: 21.69,
      longitudinal: true,
    },
    {
      bounds: [-15.43, 16.02, -44.68, -27.93],
      floor: 1.02,
      eave: 15.55,
      ridge: 21.69,
      longitudinal: false,
    },
    {
      bounds: [-14.36, 15.03, -49.96, -43.93],
      floor: 1.36,
      eave: 13.68,
      ridge: 20.48,
      longitudinal: true,
    },
  ];
  for (const { bounds, floor, eave, ridge, longitudinal } of volumes) {
    walls(out, bounds, floor, eave);
    roof(
      out,
      [bounds[0] - 0.2, bounds[1] + 0.2, bounds[2] - 0.13, bounds[3] + 0.13],
      eave,
      ridge,
      longitudinal,
    );
    if (lod)
      for (const side of [-1, 1]) {
        const x = side < 0 ? bounds[0] - 0.022 : bounds[1] + 0.022;
        const offset = (bounds[2] + bounds[3]) / 2;
        const wall = transform(out, (side * Math.PI) / 2, [x, 0, offset]);
        for (const u of [-0.26, 0.18]) {
          const windowX = (bounds[3] - bounds[2]) * u;
          opening(wall, windowX, 0, 6.33 + floor, 1.36, 3.84, lod);
          if (lod)
            box(
              wall,
              'trim',
              [windowX - 1.26, floor + 0.35, -0.05],
              [windowX - 0.99, eave - 0.2, 0.13],
              t.cream,
            );
        }
      }
  }
  const sides = [5, 10, 14, 18][lod];
  for (const [x, z, rx, rz, eave] of [
    [0.16, -51.89, 8.54, 6.91, 14.2],
    [-10.57, -49.26, 3.57, 5.95, 10.23],
    [11.56, -49.0, 3.68, 5.32, 10.72],
  ]) {
    roundSections(
      out,
      x,
      z,
      [
        [-0.25, rx, rz],
        [2.67, rx, rz, 'plaster', t.base],
        [eave - 0.28, rx, rz, 'plaster', t.yellowShadow],
        [eave, rx + 0.14, rz + 0.14, 'trim', t.cream],
        [eave + 3.0, rx * 0.44, rz * 0.44, 'roof', t.roof],
        [eave + 3.42, 0.2, 0.3, 'roof', t.roof],
      ],
      sides,
    );
    if (lod) opening(transform(out, Math.PI, [x, 0, z - rz]), 0, 0.021, 4.61, 0.95, 2.77, lod);
  }
  const [x, z] = plan.dimensions.crossing,
    height = plan.dimensions.crossingCrossTop;
  roundSections(
    out,
    x,
    z,
    [
      [17.52, 7.25, 7.25],
      [19.58, 7.25, 7.25, 'plaster', t.yellow],
      [20.15, 7.47, 7.47, 'trim', t.cream],
      [25.39, 6.37, 6.37, 'plaster', t.yellow],
      [25.78, 6.66, 6.66, 'trim', t.cream],
      [27.91, 6.18, 6.18, 'roof', t.cupola],
      [30.66, 4.43, 4.43, 'roof', t.cupola],
      [32.28, 1.78, 1.78, 'roof', t.cupola],
      [33.74, 1.51, 1.51, 'plaster', t.yellowShadow],
      [34.05, 1.64, 1.64, 'trim', t.cream],
      [34.72, 1.27, 1.27, 'roof', t.cupola],
      [34.96, 0.21, 0.21, 'roof', t.cupola],
    ],
    sides,
  );
  if (lod)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const p = transform(out, a, [x + 6.79 * Math.sin(a), 0, z + 6.79 * Math.cos(a)]);
      opening(p, 0, 0.011, 21.15, 0.98, 3.22, Math.min(lod, 2));
    }
  cross(out, x, 34.88, z, (height - 34.88) / 1.59, lod);
}

function build(out, lod) {
  nave(out, lod);
  monumentFront(out, lod);
}
export const spiritSkyline = (out) => build(out, 0);
export const spiritDistrict = (out) => build(out, 1);
export const spiritStreet = (out) => build(out, 2);
export const spiritCloseup = (out) => build(out, 3);

const recipe = 'holy-spirit-monastery-vilnius-model.mjs';
const camera = [26, 28, 44],
  lookAt = [0, 14, -20];
export const spiritModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: spiritCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The historic Orthodox monastery church on Aušros Vartų Street, with a low pedimented porch, tall cream pilasters, paired western cupolas and a central dome.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-27, 44, 41],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.polygons[0],
    minimumCoverage: 0.94,
    basis: 'Mapped occupied footprint of the monastery church around its west frontage and apses.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'wood_plain', 'metal_standing_seam'],
  qaCameras: [
    { name: 'west-porch-and-cream-pilasters', position: [9, 10, 28], lookAt: [0, 11, -2] },
    { name: 'red-cupolas-and-silhouette', position: [37, 35, 21], lookAt: [0, 19, -16] },
    { name: 'three-apses-and-central-dome', position: [25, 24, -82], lookAt: [0, 17, -40] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'vilnius-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'spiritSkyline',
    errorMeters: 0.57,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'spiritDistrict', 0.26],
        ['street', 'spiritStreet', 0.1],
        ['closeup', 'spiritCloseup', 0.052],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap data under ODbL. The exact Qualla reference photograph was dedicated to the public domain by Alma Pater.',
};
