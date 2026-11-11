/** October 2006 exterior of the Minaret of Jam, with original geometric brick relief. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  loft,
  normalFor,
  beam,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.92, metallic: 0 },
  relief: { slot: 'trim', graph: 'brick_flemish', roughness: 0.89, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_mosaic', roughness: 0.73, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.95, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const colors = {
  brick: rgb('ba8b55'),
  relief: rgb('d4a66d'),
  tile: rgb('579991'),
  stone: rgb('ae8e65'),
  timber: rgb('70563c'),
  recess: rgb('705036'),
};
const tau = 2 * Math.PI;
const angle = (plan.leanAzimuthDegrees * Math.PI) / 180;
const lean = [
  (Math.sin(angle) * plan.topLeanOffsetMeters) / plan.towerHeight,
  (-Math.cos(angle) * plan.topLeanOffsetMeters) / plan.towerHeight,
];
const octagonRotation = Math.PI / 8;
const turquoiseBacking = rgb('718b72'),
  tileBright = rgb('51aaab'),
  medium = rgb('b98c58');
function point(a, y, r) {
  return [
    Math.cos(a) * r + Math.max(0, y) * lean[0],
    y,
    Math.sin(a) * r + Math.max(0, y) * lean[1],
  ];
}
function profile(o, material, layers, sides, offset = 0, color = colors[material], cap = true) {
  const rings = layers.map(([y, r]) =>
    Array.from({ length: sides }, (_, i) => point(offset - (i * tau) / sides, y, r)),
  );
  loft(o, material, rings, color, { cap });
}
function face(o, k, vertices, outward, color) {
  let n = normalFor(...vertices);
  if (n.reduce((sum, v, i) => sum + v * outward[i], 0) < 0) {
    vertices = [...vertices].reverse();
    n = normalFor(...vertices);
  }
  quad(o, k, vertices, n, color);
}
function radiusAt(profile, y) {
  for (let i = 1; i < profile.length; i++) {
    const [[y0, r0], [y1, r1]] = profile.slice(i - 1, i + 1);
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return profile.at(-1)[1];
}
function motifFace(o, k, form, coords, offset, color = colors[k]) {
  const a = coords.reduce((sum, [v]) => sum + v, 0) / coords.length;
  face(
    o,
    k,
    coords.map(([t, y]) => point(t, y, radiusAt(form, y) + offset)),
    [Math.cos(a), 0, Math.sin(a)],
    color,
  );
}
function patch(o, k, form, a, b, y0, y1, offset, color) {
  motifFace(
    o,
    k,
    form,
    [
      [a, y0],
      [b, y0],
      [b, y1],
      [a, y1],
    ],
    offset,
    color,
  );
}
function strip(o, k, form, y0, y1, width, facets, color) {
  profile(
    o,
    k,
    [
      [y0, radiusAt(form, y0) + width],
      [y1, radiusAt(form, y1) + width],
    ],
    facets,
    0,
    color,
    false,
  );
}
function fret(o, form, a, y, width, height, color) {
  const d = 0.15;
  patch(o, 'relief', form, a - width / 2, a - width * 0.35, y, y + height, d, color);
  patch(o, 'relief', form, a + width * 0.35, a + width / 2, y, y + height, d, color);
  patch(o, 'relief', form, a - width / 2, a + width / 2, y + height - 0.13, y + height, d, color);
  patch(o, 'relief', form, a - width / 2, a + width / 2, y, y + 0.13, d, color);
  const middle = y + height * 0.4;
  motifFace(
    o,
    'relief',
    form,
    [
      [a - width * 0.23, middle],
      [a, middle - 0.33],
      [a + width * 0.23, middle],
      [a, middle + 0.33],
    ],
    d + 0.018,
    color,
  );
}
function rosettes(o, form, y, count, lod) {
  const n = lod > 2 ? 10 : 6;
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) * tau) / count;
    const orbit = 0.34;
    const circumferenceRadius = radiusAt(form, y);
    for (let j = 0; j < n; j++) {
      const u = (j * tau) / n,
        v = ((j + 1) * tau) / n;
      const ring = (t, r) => [a + (Math.cos(t) * r) / circumferenceRadius, y + Math.sin(t) * r];
      motifFace(
        o,
        'relief',
        form,
        [ring(u, orbit - 0.065), ring(u, orbit), ring(v, orbit), ring(v, orbit - 0.065)],
        0.09,
      );
    }
    if (lod > 2) {
      const w = 0.035,
        h = 0.18;
      motifFace(
        o,
        'relief',
        form,
        [
          [a - w, y],
          [a, y - h],
          [a + w, y],
          [a, y + h],
        ],
        0.106,
      );
    }
  }
}
function turquoise(o, form, facets, lod) {
  if (!lod) {
    strip(o, 'tile', form, 25.85, 29.1, 0.055, facets, turquoiseBacking);
    return;
  }
  const count = lod === 1 ? 24 : 42;
  const step = tau / count;
  for (const y of [25.87, 28.84]) {
    strip(o, 'tile', form, y, y + 0.21, 0.104, facets, tileBright);
    strip(o, 'relief', form, y - 0.105, y - 0.036, 0.13, facets, colors.relief);
  }
  for (let i = 0; i < count; i++) {
    const a = i * step,
      base = 26.34 + (i % 3) * 0.11;
    const top = 27.1 + (i % 5) * 0.31;
    patch(o, 'tile', form, a, a + step * 0.19, base, top, 0.11, tileBright);
    patch(o, 'tile', form, a, a + step * 0.81, base, base + 0.18, 0.112, tileBright);
    patch(o, 'tile', form, a + step * 0.65, a + step * 0.81, base, base + 0.43, 0.114, tileBright);
    if (lod > 1) {
      patch(
        o,
        'tile',
        form,
        a + step * 0.46,
        a + step * 0.61,
        28.15,
        28.32 + (i % 4) * 0.07,
        0.109,
      );
      patch(o, 'tile', form, a + step * 0.66, a + step * 0.83, 27.21, 27.35, 0.111);
    }
  }
}
function balcony(o, form, y, lod) {
  const count = [10, 16, 24, 30][lod],
    step = tau / count;
  for (let i = 0; i < count; i++) {
    const a = i * step,
      r = radiusAt(form, y);
    const extent = 0.35 + (i % 4) * 0.11;
    beam(
      o,
      'relief',
      point(a, y - 0.61, r - 0.06),
      point(a, y + 0.23, r + extent),
      0.27,
      0.42,
      medium,
    );
    if (lod > 1 && i % 3 !== 1) {
      beam(
        o,
        'timber',
        point(a + 0.04, y + 0.16, r - 0.17),
        point(a + 0.05, y + 0.27, r + extent + 0.37),
        0.13,
        0.16,
        colors.timber,
      );
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  const { baseRadius, foundationBottom, lower, middle, upper } = plan;
  const facets = [12, 20, 36, 48][lod];
  profile(
    o,
    'stone',
    [
      [foundationBottom, baseRadius],
      [0.22, baseRadius],
    ],
    8,
    octagonRotation,
  );
  profile(
    o,
    'brick',
    [
      [0.22, baseRadius],
      [2.36, baseRadius],
      [2.76, 4.32],
    ],
    8,
    octagonRotation,
  );
  profile(o, 'brick', lower, facets);
  profile(o, 'brick', middle, facets);
  profile(o, 'brick', upper, facets);
  profile(
    o,
    'relief',
    [
      [36.36, 3.29],
      [36.61, 3.61],
      [36.86, 3.66],
      [36.98, 2.71],
    ],
    facets,
  );
  profile(
    o,
    'relief',
    [
      [53.63, 2.29],
      [53.93, 2.46],
      [54.13, 2.49],
      [54.21, 2.06],
    ],
    facets,
  );
  profile(
    o,
    'relief',
    [
      [60.83, 1.78],
      [61.1, 2.0],
      [61.37, 2.03],
      [61.48, 1.68],
    ],
    facets,
  );
  profile(
    o,
    'brick',
    [
      [61.45, 1.65],
      [63.72, 1.6],
      [64.3, 1.44],
      [65, 1.11],
    ],
    facets,
  );
  turquoise(o, lower, facets, lod);
  const crown = [
    [61.45, 1.65],
    [63.72, 1.6],
    [64.3, 1.44],
  ];
  for (let i = 0; i < 6; i++) {
    const a = ((i + 0.5) * tau) / 6;
    patch(o, 'recess', crown, a - 0.115, a + 0.115, 61.83, 63.48, 0.035);
    if (lod) {
      patch(o, 'relief', crown, a - 0.16, a - 0.115, 61.79, 63.6, 0.068);
      patch(o, 'relief', crown, a + 0.115, a + 0.16, 61.79, 63.6, 0.068);
    }
  }
  if (!lod) return;
  balcony(o, lower, 35.9, lod);
  balcony(o, middle, 53.3, Math.min(lod, 2));
  const rows = [
    [lower, [4.25, 8.0, 13.4, 18.2, 22.3, 24.05, 30.0, 32.95, 34.43]],
    [middle, [39.18, 43.95, 48.4, 51.75]],
    [upper, [55.32, 58.73]],
  ];
  for (const [form, ys] of rows)
    for (const y of ys) {
      strip(o, 'relief', form, y, y + 0.14, 0.095, facets, medium);
    }
  for (const [form, bands, count] of [
    [
      lower,
      [
        [5.5, 4.95],
        [11.3, 5.35],
        [17.75, 3.66],
        [30.3, 2.13],
      ],
      lod > 1 ? 12 : 9,
    ],
    [
      middle,
      [
        [39.64, 3.35],
        [45.02, 3.09],
        [49.18, 2.19],
      ],
      lod > 1 ? 10 : 8,
    ],
  ]) {
    for (const [y, h] of bands)
      for (let i = 0; i < count; i++) {
        fret(o, form, ((i + 0.5) * tau) / count, y, (tau / count) * 0.75, h, colors.relief);
      }
  }
  for (const y of [22.82, 30.75, 33.48]) rosettes(o, lower, y, lod > 1 ? 22 : 14, lod);
  for (const y of [42.8, 50.8]) rosettes(o, middle, y, lod > 1 ? 12 : 8, lod);
  const doorway = -1.01;
  patch(o, 'recess', lower, doorway - 0.104, doorway + 0.104, 3.12, 4.64, 0.036);
  if (lod > 1) {
    for (const [form, y, count] of [
      [lower, 24.5, 32],
      [lower, 34.1, 34],
      [middle, 51.88, 24],
    ]) {
      for (let i = 0; i < count; i++) {
        const a = (i * tau) / count,
          w = (tau / count) * 0.43;
        motifFace(
          o,
          'relief',
          form,
          [
            [a - w, y],
            [a, y - 0.2],
            [a + w, y],
            [a, y + 0.2],
          ],
          0.101,
        );
      }
    }
  }
}
export const houseSkyline = (mesh, frame) => buildHouse(mesh, frame, 0);
export const houseDistrict = (mesh, frame) => buildHouse(mesh, frame, 1);
export const houseStreet = (mesh, frame) => buildHouse(mesh, frame, 2);
export const houseCloseup = (mesh, frame) => buildHouse(mesh, frame, 3);
const camera = [71, 47, 91],
  lookAt = [0, 32, 0];
const modelPath = 'content/worldgen/source/places/tq/tqj/minaret_of_jam';
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
    'Leaning medieval brick minaret with an octagonal base, four tapering shafts, geometric relief and a turquoise tile register.',
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
  embeddedCanonicalGraphs: [
    'brick_longformat',
    'brick_flemish',
    'tile_mosaic',
    'stone_sandstone',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'leaning-tower-on-valley-floor', position: [62, 41, 95], lookAt: [0, 31, 0] },
    { name: 'turquoise-register-and-brick-relief', position: [-14, 30, 20], lookAt: [0, 28.8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-minaret-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: modelPath + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.16, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.075, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.03, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Published Qualla photographs by David Adamec were dedicated to the public domain. The generalized footprint is attributed to OpenStreetMap contributors under ODbL.',
};
