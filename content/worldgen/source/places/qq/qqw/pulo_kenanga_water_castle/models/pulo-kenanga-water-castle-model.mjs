/** The intact Gedhong Panggung and its terraces from the measured plan and the 1859 plate. */
import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  archBay,
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { rooms, terraces, levels } = plan;
const surfaces = {
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88, metallic: 0 },
  frame: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 1, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    base: '9b846c',
    tread: 'b8a794',
    plaster: 'e7d5b6',
    edge: 'd8bea1',
    recess: '574330',
    shadow: '443728',
    tile: 'a06a43',
    tileLight: 'b78352',
    tileDark: '805338',
    board: '655039',
  }).map(([name, color]) => [name, rgb(color)]),
);

function ring(width, depth, y) {
  return [
    [-width, y, -depth],
    [-width, y, depth],
    [width, y, depth],
    [width, y, -depth],
  ];
}

function roof(out, w, d, eave, rise, ridge, lod) {
  const rings = [
    ring(w + 0.34, d + 0.34, eave - 0.14),
    ring(w + 0.34, d + 0.34, eave),
    ring(w * 0.74, Math.max(d * 0.79, ridge + 0.24), eave + rise * 0.21),
    ring(0, ridge, eave + rise),
  ];
  if (lod === 0) rings.splice(2, 1);
  for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4;
    face(
      out,
      'frame',
      [rings[0][side], rings[0][next], rings[1][next], rings[1][side]],
      tone.board,
    );
    if (lod > 0)
      face(
        out,
        'tile',
        [rings[1][side], rings[1][next], rings[2][next], rings[2][side]],
        tone.tileLight,
      );
    const top = rings.length - 1;
    const [a, b, c, e] = [
      rings[top - 1][side],
      rings[top - 1][next],
      rings[top][next],
      rings[top][side],
    ];
    if (c[2] === e[2]) triangle(out, 'tile', [a, b, c], tone.tileLight);
    else face(out, 'tile', [a, b, c, e], tone.tile);
    if (lod < 2) continue;
    const seams = Math.max(2, Math.round((side % 2 ? w : d) * (lod === 3 ? 2 : 1)));
    for (let i = 1; i < seams; i++) {
      const u = i / seams;
      const path = rings
        .slice(1)
        .map((points) => [
          points[side][0] * (1 - u) + points[next][0] * u,
          points[side][1] + 0.034,
          points[side][2] * (1 - u) + points[next][2] * u,
        ]);
      beamPath(out, 'tile', path, 0.05, 0.045, tone.tileDark);
    }
  }
  face(out, 'frame', [...rings[0]].reverse(), tone.board);
  if (lod === 0) return;
  if (ridge) {
    beamPath(
      out,
      'tile',
      [
        [0, eave + rise + 0.17, -ridge - 0.12],
        [0, eave + rise + 0.09, -ridge * 0.78],
        [0, eave + rise + 0.09, ridge * 0.78],
        [0, eave + rise + 0.17, ridge + 0.12],
      ],
      0.2,
      0.2,
      tone.tileDark,
    );
  } else {
    box(
      out,
      'tile',
      [-0.14, eave + rise - 0.08, -0.14],
      [0.14, eave + rise + 0.27, 0.14],
      tone.tileDark,
    );
  }
}

function wall(out, width, front, y0, y1, holes, lod) {
  const depth = front - 0.58;
  const segment = (x0, y0, x1, y1, color = tone.plaster) =>
    box(out, 'plaster', [x0, y0, depth], [x1, y1, front], color);
  if (!holes.length || lod === 0) {
    segment(-width / 2, y0, width / 2, y1);
    return;
  }
  const sill = y0 + holes[0].sill;
  const lintel = sill + holes[0].height;
  if (lod === 1) {
    segment(-width / 2, y0, width / 2, y1);
    const z = front + 0.009;
    for (const { center, opening } of holes) {
      const left = center - opening / 2;
      const right = center + opening / 2;
      face(
        out,
        'shadow',
        [
          [left, sill, z],
          [right, sill, z],
          [right, lintel, z],
          [left, lintel, z],
        ],
        tone.shadow,
      );
    }
    return;
  }
  if (sill > y0) segment(-width / 2, y0, width / 2, sill);
  segment(-width / 2, lintel, width / 2, y1);
  let start = -width / 2;
  for (const { center, opening } of holes) {
    const left = center - opening / 2;
    const right = center + opening / 2;
    segment(start, sill, left, lintel);
    box(out, 'shadow', [left, sill, depth - 0.06], [right, lintel, depth + 0.06], tone.shadow);
    if (lod > 1 && sill > y0) {
      box(
        out,
        'plaster',
        [left - 0.13, sill - 0.09, front - 0.12],
        [right + 0.13, sill + 0.05, front + 0.14],
        tone.edge,
      );
      box(
        out,
        'plaster',
        [left - 0.14, lintel - 0.06, front - 0.12],
        [right + 0.14, lintel + 0.11, front + 0.12],
        tone.edge,
      );
    }
    if (lod === 3 && sill > y0) {
      box(
        out,
        'frame',
        [center - 0.036, sill, depth + 0.065],
        [center + 0.036, lintel, depth + 0.105],
        tone.board,
      );
    }
    start = right;
  }
  segment(start, sill, width / 2, lintel);
}

function cornice(out, w, d, y, color) {
  box(out, 'plaster', [-w - 0.07, y - 0.15, -d - 0.07], [w + 0.07, y + 0.025, d + 0.07], color);
}

function buildingRoom(out, room, lod) {
  const { x0, x1, depth, name } = room;
  const w = (x1 - x0) / 2;
  const d = depth / 2;
  const local = transform(out, 0, [(x0 + x1) / 2, 0, 0]);
  const gallery = name.endsWith('gallery');
  const tower = name === 'central-pavilion';
  const base = terraces.at(-1).top;
  box(local, 'base', [-w, base - 0.02, -d], [w, base + 0.24, d], tone.tread);
  const storeys = tower ? levels.tower : levels.wings;
  if (lod === 0) box(local, 'plaster', [-w, base, -d], [w, base + storeys.at(-1), d], tone.plaster);
  for (let i = 0; lod && i < storeys.length - 1; i++) {
    const y0 = base + storeys[i];
    const y1 = base + storeys[i + 1];
    const door = tower && i === 0;
    const window = { sill: i === 2 ? 0.7 : 1.64, height: i === 2 ? 0.73 : 1.38, opening: 1.02 };
    const front = gallery ? [-w * 0.58, 0, w * 0.58] : [0];
    const sides = tower ? [0] : [-d * 0.48, d * 0.43];
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const parallel = angle === 0 || angle === Math.PI;
      const length = parallel ? w : d;
      const offset = parallel ? d : w;
      const firstFloorDoor = tower && i === 1 && angle === Math.PI;
      const holes =
        door || firstFloorDoor
          ? [{ center: 0, opening: 1.45, sill: 0.01, height: firstFloorDoor ? 2.03 : 2.91 }]
          : (parallel ? front : sides).map((center) => ({ center, ...window }));
      wall(transform(local, angle), length * 2 - 0.045, offset, y0, y1, holes, lod);
    }
    cornice(local, w, d, y1, tone.edge);
  }
  const eave = base + storeys.at(-1);
  if (gallery) roof(transform(local, Math.PI / 2), d, w, eave, 2.67, w - 0.56, lod);
  else if (tower) roof(local, w, d, eave, 5.45, 0, lod);
  else roof(local, w, d, eave, 5.25, d - 0.64, lod);
}

function stairs(out, x0, x1, from, to, upper, lower, lod) {
  const count = Math.max(1, Math.round((upper - lower) / [2.8, 0.71, 0.27, 0.21][lod]));
  const length = (to - from) / count;
  for (let i = 0; i < count; i++) {
    const at = from + i * length;
    const top = upper - (upper - lower) * (i / count);
    box(out, 'base', [x0, lower - 0.15, at], [x1, top, at + length + 0.01], tone.tread);
  }
  for (const x of lod > 1 ? [x0, x1] : [])
    beamPath(
      out,
      'plaster',
      [
        [x, upper + 0.46, from],
        [x, lower + 0.46, to],
      ],
      0.25,
      0.32,
      tone.edge,
    );
}

function sentry(out, x, z, y, lod) {
  const local = transform(out, 0, [x, y, z]);
  if (lod)
    for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
      wall(
        transform(local, angle),
        2.43,
        1.22,
        0,
        2.35,
        [{ center: 0, opening: 0.57, sill: 0.91, height: 0.43 }],
        lod,
      );
  else box(local, 'plaster', [-1.22, 0, -1.22], [1.22, 2.35, 1.22], tone.plaster);
  roof(local, 1.22, 1.22, 2.35, 1.62, 0, Math.min(lod, 1));
}

function approach(out, lod) {
  for (let i = 0; i < terraces.length; i++) {
    const {
      size: [width, depth],
      top,
    } = terraces[i];
    const bottom = i ? terraces[i - 1].top - 0.1 : -5.2;
    box(out, 'base', [-width / 2, bottom, -depth / 2], [width / 2, top, depth / 2], tone.base);
    box(
      out,
      'plaster',
      [-width / 2 - 0.13, top - 0.22, -depth / 2 - 0.13],
      [width / 2 + 0.13, top + 0.015, depth / 2 + 0.13],
      tone.tread,
    );
  }
  for (const angle of [0, Math.PI]) {
    const approach = transform(out, angle);
    stairs(approach, -1.5, 1.5, 23.55, 28.15, 3.3, 0, lod);
    stairs(approach, -1.5, 1.5, 17.51, 23.5, 5, 3.3, lod);
    stairs(approach, -1.52, 1.52, 11.52, 17.48, 6.98, 5, lod);
    for (const x of [-4.11, 4.11]) sentry(approach, x, 20, 3.31, lod);
  }
  for (const angle of [Math.PI / 2, -Math.PI / 2]) {
    stairs(transform(out, angle), -1.5, 1.5, 42.51, 49, 5, 3.3, lod);
  }
  const north = transform(out, Math.PI);
  for (const x of [-6.13, 6.13]) {
    const upper = terraces.at(-1).top + 4.7;
    stairs(north, x - 0.9, x + 0.9, 4.9, 11.32, upper, 6.98, lod);
    const inner = x < 0 ? -0.72 : 0.72;
    box(
      north,
      'base',
      [Math.min(inner, x - 0.88), upper - 0.27, 3.73],
      [Math.max(inner, x + 0.88), upper, 4.95],
      tone.tread,
    );
    if (lod > 1) {
      const center = x > 0 ? 4.5 : -4.5;
      const guard = transform(north, 0, [center, 6.98, 3.51]);
      archBay(guard, 'plaster', 0, 1.37, 0, 1.12, 0.78, 2.38, 1.14, 0.58, tone.plaster, {
        trim: lod > 1 ? 0.09 : 0,
        back: false,
      });
    }
  }
}

function build(out, lod) {
  approach(out, lod);
  for (const room of rooms) buildingRoom(out, room, lod);
}
export const castleSkyline = (out) => build(out, 0);
export const castleDistrict = (out) => build(out, 1);
export const castleStreet = (out) => build(out, 2);
export const castleCloseup = (out) => build(out, 3);

const recipe = 'pulo-kenanga-water-castle-model.mjs';
const camera = [31, 28, -82];
const lookAt = [0, 9, 0];
export const castleModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: null,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: castleCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Gedhong Panggung, the intact five-part palace on Pulo Kenanga in Yogyakarta, with tall reddish earthen tile roofs, pale walls and stepped approaches circa 1859.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-38, 55, -28],
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'plaster_lime', 'tile_ceramic', 'wood_plain'],
  qaCameras: [
    { name: 'five-block-north-frontage', position: [22, 15.5, -65], lookAt: [0, 9.8, 0] },
    { name: 'central-roof-and-paired-stairs', position: [-14, 18, -36], lookAt: [0, 12.4, -1.5] },
    { name: 'south-terraces-and-end-gable', position: [61, 23, 44], lookAt: [4, 7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'pulo-kenanga-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'castleSkyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'castleDistrict', 0.25],
        ['street', 'castleStreet', 0.09],
        ['closeup', 'castleCloseup', 0.04],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Exact public-domain 1859 S. A. Buddingh plate. OpenStreetMap geometry under ODbL 1.0.',
};
