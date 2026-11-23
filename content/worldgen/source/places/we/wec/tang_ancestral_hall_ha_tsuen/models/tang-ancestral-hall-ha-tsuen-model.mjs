import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrainDatum = read('terrain-grid.json').modelDatumElevationMeters;
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.92 },
  glaze: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.77 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.9 },
};
const gray = rgb('96968b');
const darkGray = rgb('74776e');
const stone = rgb('aaa597');
const threshold = rgb('b5ab93');
const tile = rgb('66675e');
const glaze = rgb('608477');
const tileEdge = rgb('547165');
const timber = rgb('795c4c');
const red = rgb('875147');
const pale = rgb('c8bfa0');
const dark = rgb('48443e');
const blue = rgb('707d79');
const gold = rgb('bea26a');

const left = -8.25;
const right = 6.29;
const front = -11.01;
const back = 15.62;
const center = (left + right) / 2;
const maxRidge = plan.dimensions.buildingTopHkpdM - terrainDatum;
const foundation = plan.dimensions.buildingBaseHkpdM - terrainDatum - 0.19;
const halls = [
  { z0: front, z1: -4.73, eave: 3.85, peak: 6.17 },
  { z0: -1.24, z1: 4.74, eave: 4.03, peak: 6.76 },
  { z0: 8.66, z1: back, eave: 4.37, peak: maxRidge - 0.59 },
];

function box(out, slot, x0, z0, x1, z1, lo, hi, color) {
  abox(out, slot, [x0, lo, z0], [x1, hi, z1], color, { bottom: false });
}

function wallPanel(out, slot, F, x, low, width, h, d, color) {
  quad4(
    out,
    slot,
    F.P(x - width / 2, low, d),
    F.P(x + width / 2, low, d),
    F.P(x + width / 2, low + h, d),
    F.P(x - width / 2, low + h, d),
    color,
  );
}

function column(out, x, z, base, top, lod) {
  box(out, 'stone', x - 0.23, z - 0.23, x + 0.23, z + 0.23, base, base + 0.25, stone);
  const count = lod > 1 ? 8 : 4;
  loft(
    out,
    'stone',
    [
      radialRing(base + 0.19, 0.205, 0.205, count, [x, z], Math.PI / count),
      radialRing(top, 0.17, 0.17, count, [x, z], Math.PI / count),
    ],
    stone,
    { cap: false },
  );
  if (lod > 0) {
    box(out, 'wood', x - 0.28, z - 0.19, x + 0.28, z + 0.19, top - 0.024, top + 0.19, timber);
    if (lod > 1)
      beam(out, 'wood', [x, top - 0.49, z + 0.056], [x, top + 0.12, z + 0.72], 0.18, 0.16, timber);
  }
}

function gabledRoof(out, { z0, z1, eave, peak }, lod) {
  const ridge = (z0 + z1) / 2;
  const L = left - 0.36;
  const R = right + 0.36;
  const profile =
    lod > 0
      ? [
          [0, 0],
          [0.22, 0.09],
          [0.52, 0.35],
          [0.78, 0.66],
          [1, 1],
        ]
      : [
          [0, 0],
          [0.48, 0.31],
          [1, 1],
        ];
  const spans = lod > 0 ? [0, 0.07, 0.21, 0.5, 0.79, 0.93, 1] : [0, 0.15, 0.5, 0.85, 1];
  const lift = (u) => 0.31 * Math.pow(Math.abs(u * 2 - 1), 5);
  for (const sign of [-1, 1]) {
    const edge = sign < 0 ? z0 - 0.47 : z1 + 0.44;
    const point = (u, [pos, height], offset = 0) => {
      const z = edge + (ridge - edge) * pos;
      return [
        L + (R - L) * u,
        eave + (peak - eave) * height + lift(u) * (1 - 0.34 * pos) + offset,
        z,
      ];
    };
    for (let i = 1; i < spans.length; i++) {
      const u = spans[i - 1];
      const v = spans[i];
      for (let j = 1; j < profile.length; j++) {
        const [a, b, c, d] = [
          point(u, profile[j - 1]),
          point(v, profile[j - 1]),
          point(v, profile[j]),
          point(u, profile[j]),
        ];
        const q = sign < 0 ? [d, c, b, a] : [a, b, c, d];
        quad4(out, 'tile', ...q, tile);
      }
      const lo = point(u, profile[0]);
      const hi = point(v, profile[0]);
      const a = [lo[0], lo[1] - 0.22, lo[2]];
      const b = [hi[0], hi[1] - 0.22, hi[2]];
      const path = sign < 0 ? [b, a, lo, hi] : [a, b, hi, lo];
      quad4(out, 'glaze', ...path, glaze);
    }
    const soffit = [
      [L, eave - 0.2, edge],
      [R, eave - 0.2, edge],
      [R, eave - 0.2, ridge],
      [L, eave - 0.2, ridge],
    ];
    quad4(out, 'wood', ...(sign < 0 ? soffit : soffit.reverse()), timber);
    for (const end of [0, 1]) {
      const endProfile = profile.map((item) => point(end, item));
      // Segment the concave gable to keep the full roof profile in each view.
      for (let j = 1; j < endProfile.length; j++) {
        const a = endProfile[j - 1],
          b = endProfile[j];
        const q = [a, b, [b[0], eave - 0.23, b[2]], [a[0], eave - 0.23, a[2]]];
        quad4(out, 'masonry', ...((end === 0) === sign > 0 ? q : q.reverse()), gray);
      }
      if (lod > 0) beamPath(out, 'glaze', endProfile, 0.153, 0.17, tileEdge);
    }
    if (lod > 1) {
      const n = lod === 3 ? 36 : 16;
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const [x, y, z] = point(u, profile[0], 0.019);
        const end = [x, y + 0.018, z + sign * 0.085];
        beam(out, 'glaze', [x, y + 0.04, z - sign * 0.12], end, 0.109, 0.09, glaze);
        if (lod === 3)
          beamPath(
            out,
            'tile',
            profile.map((step) => point(u, step, 0.03)),
            0.09,
            0.055,
            tile,
          );
      }
    }
  }
  const ridges = spans.map((u) => [L + u * (R - L), peak + lift(u) * 0.66 + 0.045, ridge]);
  if (lod > 0) {
    beamPath(out, 'glaze', ridges, 0.22, 0.24, glaze);
    if (lod > 1)
      for (let k = 0; k < (lod === 3 ? 13 : 5); k++) {
        const x = L + ((k + 1) * (R - L)) / (lod === 3 ? 14 : 6);
        const v = (x - L) / (R - L);
        const y = peak + 0.66 * lift(v) + 0.17;
        const F = facade([x, ridge], [1, 0]);
        wallPanel(out, 'glaze', F, 0, y, 0.29, 0.143, 0.015, k % 2 === 0 ? pale : blue);
      }
  }
  for (const u of [0, 1]) {
    const dir = u === 0 ? -1 : 1;
    const end = ridges[u === 0 ? 0 : ridges.length - 1];
    const tail = [end[0] + dir * 0.2, end[1] + 0.198, end[2]];
    beam(out, 'glaze', [end[0] - dir * 0.56, end[1] - 0.1, end[2]], tail, 0.125, 0.19, tileEdge);
    if (lod > 1)
      beam(out, 'glaze', tail, [tail[0] - dir * 0.092, tail[1] + 0.16, tail[2]], 0.096, 0.12, gold);
  }
}

function portal(out, h, lod, open) {
  const z = open ? h.z0 + 1.5 : h.z0 + 0.16;
  const F = facade([center, z], [-1, 0]);
  const span = (right - left) / 2;
  const floor = 0.17;
  const head = h.eave - 0.8;
  const halfGate = open ? 1.3 : 1.55;
  for (const side of [-1, 1]) {
    const bounds = side < 0 ? [-span, -halfGate] : [halfGate, span];
    fbox(out, 'masonry', F, ...bounds, floor, h.eave, -0.19, 0.012, gray);
    fbox(
      out,
      'wood',
      F,
      side * halfGate - 0.137,
      side * halfGate + 0.137,
      floor,
      head + 0.16,
      -0.16,
      0.113,
      red,
    );
    if (lod > 1 && open) {
      wallPanel(out, 'wood', F, side * (halfGate + 0.38), 0.49, 0.38, head - 0.66, 0.039, red);
      for (let i = 0; i < (lod === 3 ? 5 : 3); i++)
        wallPanel(
          out,
          'glaze',
          F,
          side * (halfGate + 0.38),
          0.66 + i * 0.4,
          0.24,
          0.091,
          0.049,
          gold,
        );
    }
  }
  fbox(out, 'wood', F, -halfGate - 0.18, halfGate + 0.18, head, h.eave, -0.18, 0.115, timber);
  if (lod > 1) wallPanel(out, 'glaze', F, 0, head + 0.14, 1.53, 0.28, 0.132, blue);
  if (!open)
    wallPanel(
      out,
      'dark',
      F,
      0,
      floor + 0.05,
      halfGate * 2 - 0.06,
      head - floor - 0.07,
      -0.114,
      dark,
    );
}

function hall(out, h, lod, index) {
  box(out, 'stone', left, h.z0, right, h.z1, foundation, 0.16, stone);
  const first = index === 0;
  portal(out, h, lod, first);
  for (const end of [left, right - 0.34]) {
    box(out, 'masonry', end, h.z0, end + 0.34, h.z1, 0.15, h.eave - 0.15, darkGray);
    if (lod > 0)
      box(
        out,
        'wood',
        end + 0.08,
        h.z0 - 0.015,
        end + 0.3,
        h.z0 + 0.34,
        0.2,
        h.eave - 0.15,
        timber,
      );
  }
  box(out, 'masonry', left, h.z1 - 0.24, right, h.z1, 0.15, h.eave - 0.12, gray);
  if (first) {
    const leftBay = center - 2.26;
    const rightBay = center + 2.26;
    for (const x of [leftBay, rightBay]) column(out, x, h.z0 + 0.19, 0.28, h.eave - 0.28, lod);
    box(
      out,
      'wood',
      left + 0.19,
      h.z0 + 0.075,
      right - 0.19,
      h.z0 + 0.36,
      h.eave - 0.36,
      h.eave - 0.128,
      timber,
    );
    for (const [a, b] of [
      [left + 0.22, leftBay - 0.27],
      [rightBay + 0.27, right - 0.2],
    ]) {
      box(out, 'stone', a, h.z0 - 0.19, b, h.z0 + 1.51, 0.16, 0.54, threshold);
      if (lod > 1) {
        const F = facade([0, h.z0], [-1, 0]);
        for (let u = a + 0.25; u < b - 0.2; u += lod === 3 ? 0.32 : 0.62)
          wallPanel(out, 'glaze', F, -u, h.eave - 0.52, 0.17, 0.17, 0.005, pale);
      }
    }
  }
  gabledRoof(out, h, lod);
}

function courtyards(out, lod) {
  for (const [index, a, b] of [
    [0, halls[0].z1, halls[1].z0],
    [1, halls[1].z1, halls[2].z0],
  ]) {
    box(out, 'stone', left + 0.04, a, right - 0.04, b, -0.17, 0.09, stone);
    for (const x of [left, right - 0.31]) box(out, 'masonry', x, a, x + 0.31, b, 0.08, 2.98, gray);
    if (index === 0) continue;
    for (const [x0, x1, sign] of [
      [left + 0.17, left + 2.51, -1],
      [right - 2.45, right - 0.17, 1],
    ]) {
      const edge = sign < 0 ? x1 : x0;
      const wall = sign < 0 ? 'right' : 'left';
      box(out, 'masonry', x0, a + 0.16, x1, b - 0.2, 0.093, 2.8, gray);
      const F = facade([edge, (a + b) / 2], [0, wall === 'right' ? -1 : 1]);
      wallPanel(out, 'dark', F, 0, 0.22, 0.84, 1.93, 0.019, dark);
      const rim = sign < 0 ? x0 : x1;
      const q = [
        [edge - sign * 0.11, 2.88, a],
        [rim + sign * 0.12, 3.91, a],
        [rim + sign * 0.12, 3.91, b],
        [edge - sign * 0.11, 2.88, b],
      ];
      quad4(out, 'tile', ...(sign < 0 ? q : q.reverse()), tile);
      if (lod > 0)
        beam(
          out,
          'glaze',
          [edge - sign * 0.11, 2.9, a],
          [edge - sign * 0.11, 2.9, b],
          0.12,
          0.14,
          tileEdge,
        );
    }
  }
}

function build(out, lod) {
  for (const [i, h] of halls.entries()) hall(out, h, lod, i);
  courtyards(out, lod);
  box(out, 'stone', center - 1.32, front - 0.61, center + 1.32, front, -0.16, 0.167, threshold);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'tang-ancestral-hall-ha-tsuen-model.mjs';
const camera = [-21, 17, -38];
const lookAt = [-0.7, 3.7, 1.7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'temple',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Ha Tsuen’s three-bay Tang Ancestral Hall, with timber roofs, Cantonese gray brick, stone columns and two open interior courts.',
  camera,
  lookAt,
  sunDirection: [-20, 34, -42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Named Lands Department polygon preserving the extent of the three-hall compound.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_ashlar', 'tile_ceramic', 'wood_vertical'],
  recipeDependencies: ['authored-structure-mesh.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'entry-roof-and-drum-platforms', position: [-10, 4.5, -24], lookAt: [-0.4, 3.5, -9.7] },
    { name: 'three-halls-and-two-courtyards', position: [21, 22, -1], lookAt: [0, 1.9, 1.1] },
    { name: 'middle-and-rear-roofs', position: [17, 12, 26], lookAt: [-1, 3.4, 4.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'ha-tsuen-ancestral-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.82,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.04, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Hong Kong Lands Department. © OpenStreetMap contributors.',
};
