/** The late Hudson’s Bay Company forge at Obadjiwan Point. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { width, length, floor, eaves, ridge, chimneyTop, fireplace } = plan.dimensions;
const halfWidth = width / 2;
const halfLength = length / 2;
const sillThickness = 0.22;
const trim = rgb('694e35');
const dark = rgb('422d22');
const roof = rgb('6c6250');
const stone = rgb('918476');
const logTints = ['9c7b53', 'a28259', '916e48', '9a7651', '8d6d49'].map(rgb);
const rubbleTints = ['918478', 'a29480', '86796b', 'a09687', '8a8177'].map(rgb);
const surfaces = {
  logs: { slot: 'wall', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  recess: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86, metallic: 0 },
};
const door = { start: -0.61, end: 0.61, top: floor + 2.06 };
const window = { start: 1.22, end: 2.0, bottom: floor + 1.08, top: floor + 1.84 };
const mortar = rgb('817767');

function panel(out, slot, alongZ, fixed, start, end, bottom, top, thickness, tint) {
  if (alongZ)
    box(out, slot, [fixed - thickness / 2, bottom, start], [fixed + thickness / 2, top, end], tint);
  else
    box(out, slot, [start, bottom, fixed - thickness / 2], [end, top, fixed + thickness / 2], tint);
}

function polygon(out, slot, points, tint) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, ([x, y, z]) => [x + z, y], tint);
}

function timbers(out, detail) {
  box(
    out,
    'stone',
    [-halfWidth + 0.14, -0.64, -halfLength + 0.14],
    [halfWidth - 0.14, floor - sillThickness, halfLength - 0.14],
    mortar,
  );
  box(
    out,
    'trim',
    [-halfWidth, floor - sillThickness, -halfLength],
    [halfWidth, floor, halfLength],
    trim,
  );

  const courses = [5, 9, 11, 12][detail];
  for (let i = 0; i < courses; i++) {
    const height = (eaves - floor) / courses;
    const low = floor + height * i;
    const high = low + height;
    const tint = logTints[i % logTints.length];
    const wall = (zAxis, fixed, start, end, y0 = low, y1 = high) => {
      panel(out, 'logs', zAxis, fixed, start, end, y0, y1 - 0.002, 0.2, tint);
      if (detail >= 2)
        panel(
          out,
          'logs',
          zAxis,
          fixed,
          start + 0.018,
          end - 0.018,
          y0 + 0.027,
          y1 - 0.018,
          0.236,
          tint,
        );
    };
    const extension = i % 2 === 0 ? 0.13 : 0.05;
    for (const end of [-1, 1]) {
      wall(false, end * (halfLength - 0.11), -halfWidth - extension, halfWidth + extension);
    }
    wall(true, halfWidth - 0.11, -halfLength - 0.14 + extension, halfLength + 0.14 - extension);
    // Continuous courses are clipped around the west openings, including courses crossing a lintel.
    wall(true, -halfWidth + 0.11, -halfLength - 0.14 + extension, door.start);
    wall(true, -halfWidth + 0.11, door.end, window.start);
    wall(true, -halfWidth + 0.11, window.end, halfLength + 0.14 - extension);
    if (door.top < high - 0.024)
      wall(true, -halfWidth + 0.11, door.start, door.end, Math.max(low, door.top), high);
    if (window.bottom > low + 0.024)
      wall(true, -halfWidth + 0.11, window.start, window.end, low, Math.min(high, window.bottom));
    if (window.top < high - 0.024)
      wall(true, -halfWidth + 0.11, window.start, window.end, Math.max(low, window.top), high);
  }

  const eave = eaves - 0.008;
  const cap = ridge - 0.098;
  for (const side of [-1, 1]) {
    const z = side * (halfLength - 0.013);
    const points = [
      [-halfWidth, eave, z],
      [halfWidth, eave, z],
      [0, cap, z],
    ];
    polygon(out, 'logs', side === 1 ? points : points.reverse(), logTints[1]);
    if (detail >= 1) {
      for (let course = 1; course < 8; course++) {
        const y = eave + ((cap - eave) * course) / 8;
        const end = halfWidth * (1 - course / 8) - 0.025;
        panel(out, 'logs', false, z, -end, end, y, y + 0.024, 0.022, logTints[4]);
      }
    }
  }
}

function openings(out, detail) {
  const x = -halfWidth + 0.082;
  panel(out, 'recess', true, x, door.start, door.end, floor, door.top, 0.045, dark);
  panel(
    out,
    'recess',
    true,
    x,
    window.start,
    window.end,
    window.bottom,
    window.top,
    0.046,
    rgb('373e38'),
  );
  for (const [start, end, low, high] of [
    [door.start, door.end, floor, door.top],
    [window.start, window.end, window.bottom, window.top],
  ]) {
    for (const z of [start, end]) {
      panel(
        out,
        'trim',
        true,
        -halfWidth - 0.027,
        z - 0.064,
        z + 0.064,
        low,
        high + 0.073,
        0.125,
        trim,
      );
    }
    for (const y of [low, high]) {
      panel(
        out,
        'trim',
        true,
        -halfWidth - 0.028,
        start - 0.084,
        end + 0.084,
        y - 0.018,
        y + 0.073,
        0.138,
        trim,
      );
    }
  }
  if (detail >= 1) {
    const mid = (window.start + window.end) / 2;
    panel(
      out,
      'trim',
      true,
      x - 0.052,
      mid - 0.021,
      mid + 0.021,
      window.bottom,
      window.top,
      0.046,
      trim,
    );
    for (const j of [1, 2]) {
      const y = window.bottom + ((window.top - window.bottom) * j) / 3;
      panel(
        out,
        'trim',
        true,
        x - 0.058,
        window.start,
        window.end,
        y - 0.019,
        y + 0.019,
        0.046,
        trim,
      );
    }
    for (const z of [-0.4, -0.2, 0, 0.2, 0.4])
      panel(
        out,
        'trim',
        true,
        x - 0.026,
        z - 0.012,
        z + 0.012,
        floor + 0.04,
        door.top - 0.04,
        0.024,
        logTints[4],
      );
  }
  for (const [i, y] of [0.22, 0.46, 0.7, 0.94, floor - 0.015].entries())
    box(
      out,
      'trim',
      [-halfWidth - 1.53 + i * 0.269, Math.max(-0.22, y - 0.265), -0.77],
      [-halfWidth + 0.015, y, 0.77],
      trim,
    );
}

function roofSlab(out, corners) {
  const lower = corners.map(([x, y, z]) => [x, y - 0.1, z]);
  polygon(out, 'roof', corners, roof);
  polygon(out, 'trim', [...lower].reverse(), dark);
  for (let i = 0; i < corners.length; i++) {
    const next = (i + 1) % corners.length;
    polygon(out, 'trim', [corners[next], corners[i], lower[i], lower[next]], trim);
  }
}

function roofAndCanopy(out, detail) {
  const widthAtEave = halfWidth + 0.32;
  const z = halfLength + 0.32;
  const eave = eaves - 0.16;
  for (const direction of [-1, 1]) {
    const x = widthAtEave * direction;
    const upper = [
      [0, ridge, -z],
      [0, ridge, z],
      [x, eave, z],
      [x, eave, -z],
    ];
    roofSlab(out, direction === 1 ? upper : upper.reverse());
    for (const end of [-1, 1])
      beam(out, 'trim', [x, eave - 0.06, end * z], [0, ridge - 0.074, end * z], 0.09, 0.155, trim);
    beam(out, 'trim', [x, eave - 0.066, -z], [x, eave - 0.066, z], 0.1, 0.14, trim);
  }
  beam(out, 'roof', [0, ridge, -z - 0.018], [0, ridge, z + 0.018], 0.17, 0.093, roof);
  const outer = -halfWidth - 0.97;
  const top = door.top + 0.29;
  const low = top - 0.28;
  roofSlab(out, [
    [outer, low, -0.93],
    [outer, low, 0.93],
    [-halfWidth, top, 0.93],
    [-halfWidth, top, -0.93],
  ]);
  for (const side of [-0.77, 0.77]) {
    beam(
      out,
      'trim',
      [outer + 0.04, low - 0.06, side],
      [-halfWidth + 0.04, top - 0.058, side],
      0.092,
      0.102,
      trim,
    );
    if (detail >= 1)
      beam(
        out,
        'trim',
        [-halfWidth - 0.087, top - 0.68, side],
        [outer + 0.12, low - 0.087, side],
        0.084,
        0.084,
        trim,
      );
  }
  beam(out, 'trim', [outer, low - 0.058, -0.94], [outer, low - 0.058, 0.94], 0.095, 0.12, trim);
}

function chimney(out, detail) {
  const center = halfLength - 0.27;
  const rings = [
    [-0.64, fireplace.width, fireplace.depth],
    [floor - 0.04, fireplace.width, fireplace.depth],
    [floor + 1.43, fireplace.width, fireplace.depth],
    [floor + 2.27, 1.28, 0.94],
    [eaves + 0.58, 0.93, 0.72],
    [chimneyTop - 0.22, 0.71, 0.66],
  ];
  loft(
    out,
    'stone',
    rings.map(([y, w, d]) => chamferedRectangle(0, y, center, w, d, 0.14)),
    stone,
  );
  const cap = [0.42, 0.38];
  for (const sign of [-1, 1]) {
    const [x0, x1] = sign < 0 ? [-cap[0], -0.22] : [0.22, cap[0]];
    const [z0, z1] = sign < 0 ? [center - cap[1], center - 0.16] : [center + 0.16, center + cap[1]];
    box(
      out,
      'stone',
      [x0, chimneyTop - 0.223, center - cap[1]],
      [x1, chimneyTop, center + cap[1]],
      stone,
    );
    box(out, 'stone', [-0.22, chimneyTop - 0.223, z0], [0.22, chimneyTop, z1], stone);
  }
  box(
    out,
    'recess',
    [-0.23, chimneyTop - 0.199, center - 0.17],
    [0.23, chimneyTop - 0.185, center + 0.17],
    dark,
  );
  if (detail < 2) return;
  // The exposed south face has staggered block faces following the stack taper.
  for (let i = 0; i < 15; i++) {
    const bottom = floor + 0.07 + i * 0.287;
    const top = bottom + 0.245;
    const ringFor = (height) => {
      const index = rings.findIndex(([y]) => y >= height);
      const after = rings[index < 0 ? rings.length - 1 : index];
      const before = rings[Math.max(0, rings.indexOf(after) - 1)];
      const t = Math.min(1, (height - before[0]) / (after[0] - before[0]));
      return [before[1] + (after[1] - before[1]) * t, before[2] + (after[2] - before[2]) * t];
    };
    const [baseWidth, baseDepth] = ringFor(bottom);
    const [topWidth, topDepth] = ringFor(top);
    const count = i < 7 ? 4 : 3;
    for (let j = 0; j < count; j++) {
      const shift = j === 0 || j === count - 1 ? 0 : i % 2 === 0 ? 0.024 : -0.024;
      const from = -0.37 + (j * 0.74) / count + 0.012 + shift;
      const to = -0.37 + ((j + 1) * 0.74) / count - 0.012 + shift;
      polygon(
        out,
        'stone',
        [
          [from * baseWidth, bottom, center + baseDepth / 2 + 0.018],
          [to * baseWidth, bottom, center + baseDepth / 2 + 0.019],
          [to * topWidth, top, center + topDepth / 2 + 0.022],
          [from * topWidth, top, center + topDepth / 2 + 0.02],
        ],
        rubbleTints[(i + j * 2) % rubbleTints.length],
      );
    }
  }
}

function build(out, detail) {
  timbers(out, detail);
  openings(out, detail);
  roofAndCanopy(out, detail);
  chimney(out, detail);
}

export const forgeSkyline = (out) => build(out, 0);
export const forgeDistrict = (out) => build(out, 1);
export const forgeStreet = (out) => build(out, 2);
export const forgeCloseup = (out) => build(out, 3);

const recipe = 'fort-temiscamingue-blacksmith-forge-model.mjs';
const position = [-16, 10, 17];
const lookAt = [0, 2.75, 0];
export const fortTemiscamingueForgeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: forgeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'A reconstruction of the late Hudson’s Bay Company blacksmith forge, with squared timber courses, west entry canopy and south masonry fireplace.',
  camera: position,
  lookAt,
  sunDirection: [-64, 106, 57],
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  embeddedCanonicalGraphs: ['wood_plain', 'shingle_cedar', 'stone_limestone_raw'],
  mediumFiContext: {
    scale: 0.68,
    cameraYaw: 3.94,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'shore-side-and-west-entrance', position: [-16, 7, 12], lookAt: [0, 2.9, 0] },
    { name: 'west-awning-and-window', position: [-10.5, 4.6, 0.2], lookAt: [-3.0, 2.65, 0.35] },
    { name: 'south-chimney-and-gable', position: [-5.7, 6.4, 13], lookAt: [0, 3.36, 3] },
    { name: 'eastern-grade-and-timber-courses', position: [13, 8.4, -11], lookAt: [0, 2.8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-temiscamingue-blacksmith-forge-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'forgeSkyline',
    errorMeters: 0.12,
    surfaces,
    authoredLevels: {
      district: { export: 'forgeDistrict', errorMeters: 0.056, surfaces },
      street: { export: 'forgeStreet', errorMeters: 0.025, surfaces },
      closeup: { export: 'forgeCloseup', errorMeters: 0.009, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model using archaeological text, a public-domain Qualla photograph, mapped controls and public elevation data.',
};
