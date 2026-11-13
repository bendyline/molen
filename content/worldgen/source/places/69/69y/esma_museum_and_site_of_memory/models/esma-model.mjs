/** Former ESMA Officers' Quarters, Buenos Aires, July 2013. */
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  poly as meshPolygon,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const outline = read('map-frame').geometry.polygons[0];
const ground = read('terrain-grid');
const {
  foundationBottom,
  threshold,
  mainEaves,
  mainRoofRise,
  towerEaves,
  towerRoofRise,
  lowEaves,
  portico,
  mainBreaks,
} = plan.section;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92, metallic: 0 },
  brick: { slot: 'trim', graph: 'brick_flemish', roughness: 0.89, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.86, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.83, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.38, metallic: 0 },
};
const palette = Object.fromEntries(
  Object.entries({
    plaster: 'e5e2d7',
    brick: 'a56d56',
    tile: 'ae6c50',
    concrete: '9f9b89',
    wood: '645445',
    glazing: '394442',
    shutter: '5c6558',
    sill: 'cec8b5',
    flatRoof: '7a7469',
    cap: 'd4cabb',
    ridge: 'ab674d',
  }).map(([key, value]) => [key, rgb(value)]),
);
const [
  southFront,
  southBack,
  southCourtBack,
  southCourtFront,
  middleSouthFront,
  ,
  middleNorthBack,
  middleNorthFront,
  northCourtFront,
  ,
  northBack,
  northFront,
] = outline;
const westEdge = northFront[0],
  eastEdge = southFront[0],
  avenue = southFront[1];
const arms = [
  {
    bounds: [westEdge, northCourtFront[0], northBack[1], northCourtFront[1]],
    eaves: mainEaves,
    rise: 1.92,
  },
  {
    bounds: [middleNorthFront[0], middleSouthFront[0], middleNorthBack[1], middleSouthFront[1]],
    eaves: mainEaves,
    rise: 2.08,
  },
  {
    bounds: [southCourtFront[0], southBack[0], southCourtBack[1], southCourtFront[1]],
    eaves: lowEaves,
    rise: 0,
  },
];
const [centerLeft, centerRight] = mainBreaks;
const spine = [
  {
    bounds: [westEdge, centerLeft, northCourtFront[1], avenue],
    eaves: mainEaves,
    rise: mainRoofRise,
  },
  {
    bounds: [centerLeft, centerRight, middleSouthFront[1], avenue],
    eaves: towerEaves,
    rise: towerRoofRise,
  },
  {
    bounds: [centerRight, eastEdge, southCourtFront[1], avenue],
    eaves: mainEaves,
    rise: mainRoofRise,
  },
];

function block(out, slot, [x0, x1, z0, z1], y0, y1, color = palette[slot]) {
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
}
function face(out, slot, points, direction, color = palette[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, value, i) => dot + value * direction[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function foundation(out) {
  const builder = new MeshBufferBuilder();
  meshPolygon(builder, 'concrete', outline, foundationBottom, threshold, palette.concrete);
  const { indices, normals, positions } = builder.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, 'concrete', points, normal);
  }
}
function hip(out, [x0, x1, z0, z1], eaves, rise, longAxis, lod) {
  const overhang = 0.27;
  const [u0, u1, v0, v1] =
    longAxis === 'x'
      ? [z0 - overhang, z1 + overhang, x0 - overhang, x1 + overhang]
      : [x0 - overhang, x1 + overhang, z0 - overhang, z1 + overhang];
  const point = (u, y, v) => (longAxis === 'x' ? [v, y, u] : [u, y, v]);
  const inset = Math.min((u1 - u0) * 0.48, (v1 - v0) * 0.36);
  const apexA = point((u0 + u1) / 2, eaves + rise, v0 + inset);
  const apexB = point((u0 + u1) / 2, eaves + rise, v1 - inset);
  const a = point(u0, eaves, v0),
    b = point(u0, eaves, v1);
  const c = point(u1, eaves, v1),
    d = point(u1, eaves, v0);
  for (const slope of [
    [a, b, apexB, apexA],
    [c, d, apexA, apexB],
    [d, a, apexA],
    [b, c, apexB],
  ])
    face(out, 'tile', slope, [0, 1, 0]);
  if (lod >= 2) beam(out, 'tile', apexA, apexB, 0.15, 0.12, palette.ridge);
  if (lod === 3) {
    for (const [corner, apex] of [
      [a, apexA],
      [d, apexA],
      [b, apexB],
      [c, apexB],
    ])
      beam(out, 'tile', corner, apex, 0.105, 0.086, palette.ridge);
  }
}
function volume(out, { bounds, eaves, rise }, axis, lod) {
  const [x0, x1, z0, z1] = bounds;
  block(out, 'plaster', bounds, threshold, eaves - 0.14);
  block(
    out,
    'plaster',
    [x0 - 0.15, x1 + 0.15, z0 - 0.15, z1 + 0.15],
    eaves - 0.29,
    eaves,
    palette.cap,
  );
  if (rise) hip(out, bounds, eaves, rise, axis, lod);
  else
    block(
      out,
      'concrete',
      [x0 - 0.17, x1 + 0.17, z0 - 0.17, z1 + 0.17],
      eaves - 0.08,
      eaves + 0.14,
      palette.flatRoof,
    );
}

const side = (axis, coordinate, sign) => ({
  at: (u, y, offset) =>
    axis === 'z' ? [u, y, coordinate + sign * offset] : [coordinate + sign * offset, y, u],
  normal: axis === 'z' ? [0, 0, sign] : [sign, 0, 0],
});
function panel(out, slot, wall, a, b, low, high, offset, color = palette[slot]) {
  face(
    out,
    slot,
    [
      wall.at(a, low, offset),
      wall.at(b, low, offset),
      wall.at(b, high, offset),
      wall.at(a, high, offset),
    ],
    wall.normal,
    color,
  );
}
function opening(out, wall, u, y, width, height, lod, shuttered) {
  const a = u - width / 2,
    b = u + width / 2,
    top = y + height;
  panel(out, 'glazing', wall, a, b, y, top, 0.026);
  if (lod)
    panel(out, 'plaster', wall, a - 0.11, b + 0.11, y - 0.092, y - 0.027, 0.073, palette.sill);
  if (lod >= 2) {
    for (const [x0, x1] of [
      [a, a + 0.072],
      [b - 0.072, b],
      [u - 0.036, u + 0.036],
    ])
      panel(out, 'wood', wall, x0, x1, y, top, 0.041);
    panel(out, 'wood', wall, a, b, y + height * 0.52, y + height * 0.52 + 0.058, 0.043);
    if (shuttered) {
      const shutterBase = top - height * 0.31;
      panel(
        out,
        'wood',
        wall,
        a + 0.069,
        b - 0.069,
        shutterBase,
        top - 0.052,
        0.051,
        palette.shutter,
      );
      if (lod === 3)
        for (const fraction of [0.09, 0.18, 0.26])
          panel(
            out,
            'wood',
            wall,
            a + 0.081,
            b - 0.081,
            top - height * fraction,
            top - height * fraction + 0.025,
            0.061,
          );
    }
  }
}
function bays(out, wall, from, to, count, lod, kind = 'full') {
  const low = kind === 'low';
  const floors = low ? [2.08] : [2.39, 5.74, 8.98];
  const spacing = (to - from) / count;
  for (let i = 0; i < count; i += lod ? 1 : 2) {
    const u = from + spacing * (i + 0.5);
    for (const y of floors)
      opening(out, wall, u, y, low ? 0.93 : 1.12, low ? 2.86 : 1.54, lod, !low);
    if (low && lod >= 2) panel(out, 'glazing', wall, u - 0.37, u + 0.37, 1.61, 1.93, 0.023);
  }
}
function facade(out, lod) {
  const front = side('z', avenue, 1);
  bays(out, front, westEdge + 1, centerLeft - 0.3, 6, lod);
  bays(out, front, centerRight + 0.3, eastEdge - 1, 6, lod);
  for (const x of [-5.9, -3.08, 2.36, 5.18]) {
    if (Math.abs(x - portico.center) > 4.7) opening(out, front, x, 2.39, 1.12, 1.54, lod, true);
    for (const y of [6.0, 9.44]) opening(out, front, x, y, 1.26, 1.62, lod, true);
  }
  const rear = side('z', northCourtFront[1], -1);
  const southRear = side('z', southCourtFront[1], -1);
  bays(out, rear, northCourtFront[0] + 0.36, middleNorthFront[0] - 0.45, 4, lod);
  bays(out, southRear, middleSouthFront[0] + 0.34, southCourtFront[0] - 0.3, 4, lod);
  for (const x of mainBreaks) {
    block(
      out,
      'brick',
      [x - 0.51, x + 0.51, avenue - 0.24, avenue + 0.19],
      threshold,
      towerEaves - 0.23,
    );
    block(
      out,
      'brick',
      [x - 0.51, x + 0.51, middleSouthFront[1] - 0.18, middleSouthFront[1] + 0.25],
      x < 0 ? threshold : mainEaves,
      towerEaves - 0.23,
    );
  }
  bays(out, side('x', westEdge, -1), northCourtFront[1] + 0.3, avenue - 0.52, 3, lod);
  bays(out, side('x', eastEdge, 1), southCourtFront[1] + 0.3, avenue - 0.52, 3, lod);
}
function courtElevations(out, lod) {
  for (const [index, arm] of arms.entries()) {
    const [x0, x1, z0, z1] = arm.bounds;
    const kind = index === 2 ? 'low' : 'full';
    bays(out, side('z', z0, -1), x0 + 0.33, x1 - 0.33, 4, lod, kind);
    for (const [x, sign] of [
      [x0, -1],
      [x1, 1],
    ])
      bays(out, side('x', x, sign), z0 + 0.48, z1 - 0.48, index === 2 ? 8 : 6, lod, kind);
    if (lod >= 2 && index !== 2)
      panel(out, 'plaster', side('z', z0, -1), x0 + 0.2, x1 - 0.2, 4.52, 4.61, 0.033, palette.cap);
  }
}
function entrance(out, lod) {
  const { center, width, frontZ, cap } = portico;
  const left = center - width / 2,
    right = center + width / 2;
  block(
    out,
    'concrete',
    [left - 0.08, right + 0.08, avenue - 0.08, frontZ + 0.48],
    foundationBottom,
    threshold,
  );
  for (const x of [left + 0.58, right - 0.58]) {
    block(out, 'brick', [x - 0.49, x + 0.49, frontZ - 0.91, frontZ + 0.03], threshold, cap - 0.28);
    if (lod)
      block(
        out,
        'concrete',
        [x - 0.56, x + 0.56, frontZ - 0.98, frontZ + 0.1],
        threshold,
        threshold + 0.19,
        palette.sill,
      );
  }
  block(
    out,
    'plaster',
    [left - 0.23, right + 0.23, avenue - 0.17, frontZ + 0.31],
    cap - 0.31,
    cap,
    palette.cap,
  );
  block(
    out,
    'concrete',
    [left - 0.19, right + 0.19, avenue - 0.12, frontZ + 0.28],
    cap - 0.02,
    cap + 0.1,
    palette.flatRoof,
  );
  const front = side('z', avenue, 1);
  panel(
    out,
    'plaster',
    front,
    center - 1.69,
    center + 1.69,
    threshold,
    threshold + 2.94,
    0.043,
    palette.sill,
  );
  panel(
    out,
    'wood',
    front,
    center - 1.42,
    center + 1.42,
    threshold + 0.02,
    threshold + 2.68,
    0.068,
  );
  if (lod) {
    panel(
      out,
      'glazing',
      front,
      center - 1.19,
      center + 1.19,
      threshold + 2.03,
      threshold + 2.52,
      0.078,
    );
    panel(
      out,
      'wood',
      front,
      center - 0.043,
      center + 0.043,
      threshold + 0.02,
      threshold + 2.64,
      0.088,
    );
  }
  const contact = (x, z) =>
    ground.heightsMeters[z - ground.origin[1]][x - ground.origin[0]] -
    ground.modelDatumElevationMeters;
  const bottom = Math.min(contact(-4, 27), contact(4, 27)) - 0.04;
  const stepCount = 9,
    stairStart = frontZ + 0.41;
  for (let i = 0; i < stepCount; i++) {
    const top = threshold - ((threshold - bottom) * (i + 1)) / (stepCount + 1);
    block(
      out,
      'concrete',
      [left + 0.43, right - 0.43, stairStart + i * 0.32, stairStart + (i + 1) * 0.32],
      bottom - 0.21,
      top,
      palette.sill,
    );
  }
}
function build(out, _frame, lod = 3) {
  foundation(out);
  for (const part of spine) volume(out, part, 'x', lod);
  for (const part of arms) volume(out, part, 'z', lod);
  facade(out, lod);
  courtElevations(out, lod);
  entrance(out, lod);
}
export const esmaSkyline = (out) => build(out, undefined, 0);
export const esmaDistrict = (out) => build(out, undefined, 1);
export const esmaStreet = (out) => build(out, undefined, 2);
export const esmaCloseup = (out) => build(out, undefined, 3);

const recipe = 'esma-model.mjs';
const camera = [79, 37, 88],
  lookAt = [0, 6, 3];
export const esmaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The former ESMA Officers’ Quarters in July 2013, with brick-pier porch, tile roofs and open courts.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis:
      'The named twelve-corner mapped Officers’ Quarters outline identifies the dated replacement.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'brick_flemish',
    'tile_ceramic',
    'concrete_plain',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'avenue-and-brick-entrance', position: [7, 13, 65], lookAt: [0, 6, 17] },
    { name: 'two-open-rear-courts', position: [39, 38, -56], lookAt: [0, 6, 2] },
    { name: 'low-wing-and-courtyard-windows', position: [12, 8, -33], lookAt: [10, 6, 6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-officers-quarters-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'esmaSkyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'esmaDistrict', 0.22],
        ['street', 'esmaStreet', 0.09],
        ['closeup', 'esmaCloseup', 0.032],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Named footprint from OpenStreetMap. Two independently matched CC0 photographs by Mauricio V. Genta inform the exterior. Photo pixels are not baked into the model.',
};
