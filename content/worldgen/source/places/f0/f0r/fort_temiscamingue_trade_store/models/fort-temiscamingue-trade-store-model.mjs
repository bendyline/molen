/** The western Hudson’s Bay Company trade store on Obadjiwan’s shore terrace. */
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { width, length, floor, eaves, ridge } = plan.dimensions;
const x = width / 2;
const z = length / 2;
const siding = rgb('a9a18a');
const finish = rgb('9d8c72');
const door = rgb('6b5540');
const cedar = rgb('6d6250');
const foot = rgb('8c8174');
const dark = rgb('4b4436');
const trim = rgb('806b52');
const surfaces = {
  timber: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.94, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
};
function surface(out, slot, points, tint) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addConvexPolygon(slot, 'palette:#ffffff', points, normal, ([a, b, c]) => [a + c, b], tint);
}

function envelope(out, detail) {
  box(out, 'stone', [-x + 0.14, -0.7, -z + 0.12], [x - 0.14, floor - 0.19, z - 0.12], foot);
  box(
    out,
    'trim',
    [-x - 0.015, floor - 0.21, -z - 0.015],
    [x + 0.015, floor + 0.02, z + 0.015],
    trim,
  );
  box(out, 'timber', [-x, floor, -z], [x, eaves, z], siding);
  for (const sign of [-1, 1]) {
    const gable = [
      [-x, eaves, z * sign],
      [x, eaves, z * sign],
      [0, ridge - 0.092, z * sign],
    ];
    surface(out, 'timber', sign > 0 ? gable : gable.reverse(), siding);
    const tail = z + 0.36;
    const edge = x + 0.34;
    const shoulder = eaves - 0.14;
    const upper = [
      [0, ridge, -tail],
      [0, ridge, tail],
      [edge * sign, shoulder, tail],
      [edge * sign, shoulder, -tail],
    ];
    if (sign < 0) upper.reverse();
    const lower = upper.map(([a, b, c]) => [a, b - 0.115, c]);
    surface(out, 'roof', upper, cedar);
    surface(out, 'trim', [...lower].reverse(), dark);
    for (let i = 0; i < upper.length; i++) {
      const next = (i + 1) % upper.length;
      surface(out, 'trim', [upper[next], upper[i], lower[i], lower[next]], trim);
    }
    if (detail >= 1) {
      box(
        out,
        'trim',
        [sign * x - 0.062, floor, -z - 0.063],
        [sign * x + 0.062, eaves, -z + 0.063],
        finish,
      );
      box(
        out,
        'trim',
        [sign * x - 0.062, floor, z - 0.063],
        [sign * x + 0.062, eaves, z + 0.063],
        finish,
      );
    }
  }
  beam(out, 'roof', [0, ridge, -z - 0.37], [0, ridge, z + 0.37], 0.19, 0.095, cedar);
}

function doubleDoor(out, side, center, w, h, detail) {
  const gable = side === 'gable';
  const face = gable ? z : -x;
  const start = center - w / 2;
  const end = center + w / 2;
  const y1 = floor + h;
  const panel = (slot, left, right, bottom, top, depth, tint) => {
    if (gable) box(out, slot, [left, bottom, face + 0.004], [right, top, face + depth], tint);
    else box(out, slot, [face - depth, bottom, left], [face - 0.004, top, right], tint);
  };
  const xyz = (u, y) => (gable ? [u, y, face + 0.11] : [face - 0.11, y, u]);
  panel('trim', start, end, floor, y1, 0.062, door);
  for (const u of [start, center, end])
    panel('trim', u - 0.055, u + 0.055, floor, y1 + 0.074, 0.125, dark);
  panel('trim', start - 0.09, end + 0.09, y1 - 0.016, y1 + 0.106, 0.138, finish);
  if (detail >= 1) {
    for (const u of [start + 0.12, end - 0.12]) {
      const inner = u < center ? center - 0.09 : center + 0.09;
      beam(out, 'trim', xyz(u, floor + 0.27), xyz(inner, y1 - 0.23), 0.088, 0.045, trim);
    }
    for (const y of [floor + 0.27, y1 - 0.23])
      panel('trim', start + 0.085, end - 0.085, y - 0.042, y + 0.042, 0.117, trim);
  }
  if (detail >= 2) {
    for (let j = 1; j < 10; j++) {
      const u = start + (w * j) / 10;
      panel('trim', u - 0.009, u + 0.009, floor + 0.065, y1 - 0.068, 0.066, dark);
    }
  }
  if (detail === 3) {
    for (const u of [center - 0.18, center + 0.18])
      beam(out, 'trim', xyz(u, floor + 1.18), xyz(u, floor + 1.31), 0.039, 0.038, dark);
  }
}

function landing(out) {
  const [left, right] = [-1.68, 1.68];
  const end = z + 1.42;
  box(out, 'trim', [left, floor - 0.22, z - 0.08], [right, floor, end], trim);
  for (const a of [left + 0.16, right - 0.16])
    box(out, 'trim', [a - 0.09, -0.55, end - 0.26], [a + 0.09, floor - 0.2, end - 0.08], dark);
  const front = end + 1.85;
  const rampY = -0.44;
  surface(
    out,
    'trim',
    [
      [left, rampY, front],
      [right, rampY, front],
      [right, floor, end],
      [left, floor, end],
    ],
    door,
  );
  for (const a of [left, right])
    beam(out, 'trim', [a, rampY - 0.043, front], [a, floor - 0.075, end], 0.14, 0.17, trim);
}

function build(out, detail) {
  envelope(out, detail);
  doubleDoor(out, 'gable', 0, 2.69, 2.63, detail);
  doubleDoor(out, 'shore', 0.87, 1.74, 2.19, detail);
  for (const offset of [-5.34, 5.89]) {
    box(
      out,
      'trim',
      [-x - 0.061, floor + 1.41, offset - 0.42],
      [-x + 0.002, floor + 2.11, offset + 0.42],
      door,
    );
    if (detail >= 1)
      box(
        out,
        'trim',
        [-x - 0.105, floor + 1.36, offset - 0.51],
        [-x + 0.002, floor + 1.43, offset + 0.51],
        finish,
      );
  }
  landing(out);
}
export const storeSkyline = (out) => build(out, 0);
export const storeDistrict = (out) => build(out, 1);
export const storeStreet = (out) => build(out, 2);
export const storeCloseup = (out) => build(out, 3);

const recipe = 'fort-temiscamingue-trade-store-model.mjs';
const position = [-20, 13.8, 25.3];
const lookAt = [0, 2.7, 0];
export const fortTemiscamingueTradeStoreModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: storeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The western trade store at Fort Témiscamingue, with a long light timber shell and simple cargo openings.',
  camera: position,
  lookAt,
  sunDirection: [-68, 104, 55],
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  embeddedCanonicalGraphs: [
    'wood_weatherboard',
    'wood_plain',
    'shingle_cedar',
    'stone_limestone_raw',
  ],
  mediumFiContext: {
    scale: 0.75,
    cameraYaw: 3.94,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'shore-facing-timber-elevation', position: [-25, 10, 17], lookAt: [0, 3, 0] },
    { name: 'south-freight-landing', position: [-8, 7.5, 20], lookAt: [0, 2.8, 7.8] },
    { name: 'north-return-and-ridge', position: [-15, 12, -25], lookAt: [0, 3.4, -2] },
    { name: 'uphill-grade', position: [19, 10, -13], lookAt: [0, 2.4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-temiscamingue-trade-store-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'storeSkyline',
    errorMeters: 0.22,
    surfaces,
    authoredLevels: {
      district: { export: 'storeDistrict', errorMeters: 0.095, surfaces },
      street: { export: 'storeStreet', errorMeters: 0.044, surfaces },
      closeup: { export: 'storeCloseup', errorMeters: 0.015, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry based on the exact public-domain Qualla original, primary historical records and mapped terrain context.',
};
