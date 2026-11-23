import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, floor, eave, domeTop, minaretTop } = plan.dimensions;
const white = rgb('dedaca');
const trim = rgb('ece3ce');
const darkBand = rgb('717771');
const inset = rgb('857c6c');
const dark = rgb('4b5753');
const gold = rgb('cba54d');
const goldShade = rgb('b69548');
const terrace = rgb('a6a097');
const roof = rgb('b7ada0');
const surfaces = {
  walls: { slot: 'wall', graph: 'stucco', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9 },
  dark: { slot: 'trim', graph: 'stone_marble', roughness: 0.83 },
  gold: { slot: 'roof', graph: 'metal_painted', roughness: 0.57 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
  flooring: { slot: 'foundation', graph: 'stone_marble', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94 },
};
const center = [3.4, 0.5];
const towers = [
  [-7.2, -11.35],
  [13.95, -11.35],
  [-7.2, 12.35],
  [13.95, 12.35],
];
function box(out, slot, x, y, z, w, h, d, color) {
  abox(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color, {
    bottom: false,
  });
}
function cap(out, ring, y, slot, color) {
  const faces = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3);
    tri(out, slot, p(a), p(c), p(b), color);
  }
}
function octagon(x, z, r) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI * (i / 4 + 1 / 8);
    return [x + r * Math.cos(a), z + r * Math.sin(a)];
  });
}
function ringProfile(out, slot, x, z, n, profile, color, cap = false) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, [x, z], Math.PI / 8)),
    color,
    { cap },
  );
}
function arches(out, F, y, upper, lod, wide) {
  const width = Math.min(wide ? 3.04 : 2.27, F.length * 0.64);
  const count = Math.max(1, Math.round(F.length / (wide ? 4.3 : 3.65)));
  for (let k = 0; k < count; k++) {
    const u = (F.length * (k + 0.5)) / count;
    opening(out, F, u, y, width, upper - y, {
      head: 'pointed',
      rise: width * 0.52,
      glassSlot: 'glass',
      frameSlot: 'trim',
      glass: dark,
      frame: trim,
      d: 0.029,
      frameDepth: 0.16,
      frameWidth: lod > 1 ? 0.12 : 0,
      sill: false,
      mullions: lod === 3 && !wide ? 1 : 0,
    });
    if (lod > 1 && (k > 0 || wide)) {
      const x = u - width / 2 - 0.23;
      fbox(out, 'trim', F, x - 0.11, x + 0.11, y - 0.34, upper - 0.35, -0.06, 0.24, white);
    }
  }
}
function outerRanges(out, lod) {
  const h = 6.51;
  extrude(out, 'flooring', outline, foundation, floor, terrace, { top: false });
  extrude(out, 'walls', outline, floor, h, white, { top: false });
  cap(out, outline, h, 'roof', roof);
  const ring = outwardRing(outline);
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (F.length < 3 || lod === 0) continue;
    fbox(out, 'trim', F, 0.05, F.length - 0.045, h - 0.34, h + 0.26, -0.06, 0.32, trim);
    if (lod > 0) arches(out, F, floor + 0.29, h - 0.81, lod, true);
    if (lod < 2 || F.length < 6) continue;
    const count = Math.max(3, Math.round(F.length / 1.24));
    for (let k = 0; k < count; k++) {
      const u = (F.length * (k + 0.5)) / count;
      fbox(out, 'trim', F, u - 0.078, u + 0.078, h + 0.23, h + 0.62, 0.05, 0.17, white);
    }
  }
  const F = facade([-17.06, 1.03], [0, 1]);
  const lintel = 7.09;
  fbox(out, 'trim', F, -7.14, 7.14, lintel - 0.28, lintel + 0.34, -1.78, 0.28, trim);
  for (const u of [-6.74, -2.29, 2.29, 6.74]) {
    fbox(out, 'walls', F, u - 0.19, u + 0.19, floor, lintel - 0.18, -0.88, 0.27, white);
  }
  if (lod > 0) {
    for (let j = 0; j < 4; j++)
      fbox(
        out,
        'flooring',
        F,
        -5.47 + j * 0.21,
        5.47 - j * 0.21,
        -0.1,
        floor + (j + 1) * 0.12,
        -0.57,
        2.14 - j * 0.32,
        terrace,
      );
  }
}
function prayerHall(out, lod) {
  const [x, z] = center;
  const ring = octagon(x, z, 10.12);
  extrude(out, 'walls', ring, 6.48, eave, white, { top: false });
  cap(out, ring, eave, 'roof', roof);
  const r = outwardRing(ring);
  for (let i = 0; i < r.length; i++) {
    const F = wallFace(r[i], r[(i + 1) % r.length]);
    if (lod > 0) arches(out, F, 7.09, 8.95, lod, false);
  }
  ringProfile(
    out,
    'trim',
    x,
    z,
    8,
    [
      [eave - 0.15, 9.36],
      [10.38, 9.23],
      [11, 8.12],
    ],
    trim,
  );
  ringProfile(
    out,
    'walls',
    x,
    z,
    lod === 0 ? 12 : 20,
    [
      [10.94, 7.92],
      [13.82, 7.49],
    ],
    white,
  );
  ringProfile(
    out,
    'dark',
    x,
    z,
    lod === 0 ? 12 : 20,
    [
      [13.36, 7.51],
      [13.52, 7.54],
    ],
    darkBand,
  );
  const dome = [
    [13.8, 7.36],
    [15.62, 7.72],
    [18.34, 7.92],
    [21.14, 7.54],
    [23.63, 6.42],
    [25.95, 4.43],
    [27.74, 2.34],
    [28.41, 0.59],
    [30.15, 0.14],
    [domeTop, 0.075],
  ];
  ringProfile(
    out,
    'gold',
    x,
    z,
    [12, 20, 32, 44][lod],
    lod === 0 ? dome.filter((_p, i) => [0, 2, 4, 6, 7, 9].includes(i)) : dome,
    gold,
    true,
  );
  if (lod < 2) return;
  for (let j = 0; j < 12; j++) {
    const a = (j * Math.PI) / 6;
    const o = [x + 7.51 * Math.cos(a), z + 7.51 * Math.sin(a)];
    const F = facade(o, [Math.sin(a), -Math.cos(a)]);
    opening(out, F, 0, 11.27, 0.83, 1.66, {
      head: 'pointed',
      rise: 0.53,
      glassSlot: 'glass',
      frameSlot: 'trim',
      glass: dark,
      frame: trim,
      d: 0.055,
      frameWidth: lod === 3 ? 0.11 : 0,
      sill: false,
    });
  }
}

function turret(out, lod, x, z, low, r) {
  const n = lod === 0 ? 6 : lod === 1 ? 8 : 12;
  ringProfile(
    out,
    'walls',
    x,
    z,
    n,
    [
      [low, r],
      [low + 2.9, r],
    ],
    white,
  );
  ringProfile(
    out,
    'trim',
    x,
    z,
    n,
    [
      [low + 2.61, r * 1.04],
      [low + 2.94, r * 1.19],
    ],
    trim,
  );
  ringProfile(
    out,
    'gold',
    x,
    z,
    n,
    [
      [low + 2.92, r * 1.03],
      [low + 4.2, r * 0.94],
      [low + 5.18, r * 0.51],
      [low + 5.59, 0.18],
      [low + 6.09, 0.06],
    ],
    goldShade,
    true,
  );
  if (lod < 2) return;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const F = facade([x + r * Math.cos(a), z + r * Math.sin(a)], [Math.sin(a), -Math.cos(a)]);
    opening(out, F, 0, low + 0.72, r * 0.86, 1.44, {
      head: 'pointed',
      glassSlot: 'glass',
      glass: dark,
      frameSlot: 'trim',
      frame: trim,
      d: 0.045,
      frameWidth: lod === 3 ? 0.11 : 0,
      sill: false,
    });
  }
}
function minaret(out, lod, x, z) {
  const n = lod === 0 ? 4 : 8;
  const shaft = [
    [foundation, 1.37],
    [floor, 1.53],
    [7.53, 1.47],
    [15.7, 1.21],
    [23.66, 1.105],
    [28.94, 0.96],
  ];
  const simple = [shaft[0], shaft[2], shaft[5]];
  ringProfile(out, 'walls', x, z, n, lod === 0 ? simple : shaft, white);
  const balconies = lod === 0 ? [28.93] : [16.18, 23.84, 28.91];
  for (const y of balconies)
    ringProfile(
      out,
      'trim',
      x,
      z,
      n,
      [
        [y - 0.46, 1.05],
        [y - 0.06, 1.62],
        [y + 0.33, 1.59],
      ],
      trim,
    );
  const stripes =
    lod === 0 ? [10.72, 20.56, 26.25] : [4.19, 7.86, 10.68, 13.29, 18.32, 20.92, 25.12, 27.33];
  for (const y of stripes) {
    const r = 1.6 - y * 0.021;
    ringProfile(
      out,
      'dark',
      x,
      z,
      n,
      [
        [y, r],
        [y + 0.42, r - 0.014],
      ],
      darkBand,
    );
  }
  const top = 31.98;
  if (lod === 0) {
    ringProfile(
      out,
      'walls',
      x,
      z,
      n,
      [
        [29.22, 0.87],
        [top, 0.87],
      ],
      white,
    );
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * i) / 3;
      const tx = x + 0.91 * Math.cos(a),
        tz = z + 0.91 * Math.sin(a);
      box(out, 'trim', tx, 29.17, tz, 0.19, top - 29.17, 0.19, white);
    }
  }
  ringProfile(
    out,
    'trim',
    x,
    z,
    n,
    [
      [top - 0.16, 1.24],
      [top + 0.35, 1.53],
    ],
    trim,
  );
  ringProfile(
    out,
    'gold',
    x,
    z,
    n,
    [
      [top + 0.35, 1.16],
      [top + 1.27, 1.2],
      [top + 2.28, 0.42],
      [top + 2.91, 0.115],
      [minaretTop, 0.065],
    ],
    goldShade,
    true,
  );
}
function build(out, lod) {
  outerRanges(out, lod);
  prayerHall(out, lod);
  for (const [x, z] of towers) minaret(out, lod, x, z);
  for (const [x, z, low, r] of [
    [-14.7, -7.81, 6.24, 2.02],
    [-14.7, 8.74, 6.24, 2.02],
    [14.85, -5.72, 9.24, 1.25],
    [14.85, 6.81, 9.24, 1.25],
  ]) {
    if (lod === 0 && x > 0) continue;
    turret(out, lod, x, z, low, r);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'ubudiah-mosque-model.mjs';
const camera = [-80, 43, 61];
const lookAt = [0, 15, 1];
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
    'Masjid Ubudiah with its golden onion dome, pointed arcades and four white, banded minarets at Bukit Chandan.',
  camera,
  lookAt,
  sunDirection: [-58, 59, 41],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Individually named mosque body and attached ranges.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'four-minarets-and-golden-onion-dome', position: camera, lookAt },
    { name: 'western-arcade-and-cupolas', position: [-45, 10, 16], lookAt: [-8, 12, 1] },
    { name: 'banded-shafts-and-upper-galleries', position: [57, 43, -42], lookAt: [2, 18, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ubudiah-mosque-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.15,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};
