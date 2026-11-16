/** The chief factor’s dwelling and back wing at the late Hudson’s Bay Company post. */
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
const { main, rear, connector, porch } = plan.dimensions;
const siding = rgb('d4cbb6');
const mutedSiding = rgb('c1b59f');
const light = rgb('ded3b9');
const trim = rgb('8a745b');
const dark = rgb('494138');
const glass = rgb('333b38');
const shingle = rgb('665749');
const stone = rgb('897764');
const mortared = rgb('a09484');
const white = 'palette:#ffffff';
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  panel: { slot: 'trim', localRef: white, roughness: 0.84, metallic: 0 },
};

function panel(out, slot, points, tint) {
  const norm = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, norm, tint);
  else out.addConvexPolygon(slot, white, points, norm, ([x, y, z]) => [x + z, y], tint);
}

function roofPanel(out, points, fascia) {
  const bottom = points.map(([x, y, z]) => [x, y - 0.12, z]);
  panel(out, 'roof', points, shingle);
  panel(out, 'wood', [...bottom].reverse(), dark);
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    panel(out, 'wood', [points[next], points[i], bottom[i], bottom[next]], fascia);
  }
}

function houseBlock(out, section, tint, detail) {
  const [west, north, east, south] = section.bounds;
  const { floor, eaves, ridge } = section;
  const middle = (west + east) / 2;
  box(out, 'stone', [west + 0.1, -0.63, north + 0.1], [east - 0.1, floor, south - 0.1], stone);
  box(out, 'siding', [west, floor, north], [east, eaves, south], tint);
  box(
    out,
    'wood',
    [west - 0.02, floor - 0.09, north - 0.02],
    [east + 0.02, floor + 0.06, south + 0.02],
    trim,
  );
  for (const [z, sign] of [
    [north, -1],
    [south, 1],
  ]) {
    const corners = [
      [west, eaves, z],
      [east, eaves, z],
      [middle, ridge - 0.1, z],
    ];
    panel(out, 'siding', sign === 1 ? corners : corners.reverse(), tint);
  }
  const endN = north - 0.32;
  const endS = south + 0.32;
  const shoulder = eaves - 0.14;
  roofPanel(
    out,
    [
      [west - 0.36, shoulder, endN],
      [west - 0.36, shoulder, endS],
      [middle, ridge, endS],
      [middle, ridge, endN],
    ],
    trim,
  );
  roofPanel(
    out,
    [
      [middle, ridge, endN],
      [middle, ridge, endS],
      [east + 0.36, shoulder, endS],
      [east + 0.36, shoulder, endN],
    ],
    trim,
  );
  beam(out, 'roof', [middle, ridge, endN], [middle, ridge, endS], 0.2, 0.084, shingle);
  if (detail >= 1) {
    for (const x of [west, east])
      for (const z of [north, south])
        box(out, 'wood', [x - 0.069, floor, z - 0.069], [x + 0.069, eaves, z + 0.069], light);
  }
}

function facePanel(out, slot, side, face, u0, u1, y0, y1, inset, tint) {
  if (side === 'south') box(out, slot, [u0, y0, face + 0.003], [u1, y1, face + inset], tint);
  else if (side === 'east') box(out, slot, [face + 0.003, y0, u0], [face + inset, y1, u1], tint);
  else box(out, slot, [face - inset, y0, u0], [face - 0.003, y1, u1], tint);
}

function window(out, side, face, center, sill, w, h, detail) {
  const start = center - w / 2;
  const end = center + w / 2;
  facePanel(out, 'panel', side, face, start, end, sill, sill + h, 0.039, glass);
  if (detail === 0) return;
  const jamb = 0.076;
  for (const u of [start, end])
    facePanel(
      out,
      'wood',
      side,
      face,
      u - jamb,
      u + jamb,
      sill - 0.05,
      sill + h + 0.085,
      0.072,
      light,
    );
  facePanel(
    out,
    'wood',
    side,
    face,
    start - jamb,
    end + jamb,
    sill - 0.071,
    sill + 0.005,
    0.1,
    light,
  );
  facePanel(
    out,
    'wood',
    side,
    face,
    start - jamb,
    end + jamb,
    sill + h - 0.009,
    sill + h + 0.085,
    0.078,
    light,
  );
  facePanel(out, 'wood', side, face, center - 0.02, center + 0.02, sill, sill + h, 0.05, light);
  const middle = sill + h * 0.51;
  facePanel(out, 'wood', side, face, start, end, middle - 0.022, middle + 0.022, 0.065, light);
  if (detail < 2) return;
  for (const fraction of [0.25, 0.76]) {
    const y = sill + h * fraction;
    facePanel(out, 'wood', side, face, start, end, y - 0.014, y + 0.014, 0.049, light);
  }
  if (detail === 3)
    facePanel(
      out,
      'wood',
      side,
      face,
      start - 0.115,
      end + 0.115,
      sill - 0.083,
      sill - 0.043,
      0.122,
      light,
    );
}

function elevations(out, detail) {
  const [mainWest, , mainEast, mainSouth] = main.bounds;
  for (const z of [-3.85, -1.06, 2.0, 4.84]) {
    window(out, 'west', mainWest, z, main.floor + 0.79, 0.94, 1.17, detail);
    window(out, 'west', mainWest, z, main.floor + 2.72, 0.76, 0.94, detail);
  }
  for (const x of [-3.46, 4.51])
    window(out, 'south', mainSouth, x, main.floor + 0.87, 0.87, 1.16, detail);
  window(out, 'south', mainSouth, 0.37, main.eaves + 0.32, 0.68, 0.92, detail);
  for (const z of [-11.25, -8.41])
    window(out, 'west', rear.bounds[0], z, rear.floor + 1.0, 0.82, 1.08, detail);
  for (const z of [-3.72, 2.68, 4.82])
    window(out, 'east', mainEast, z, main.floor + 0.96, 0.87, 1.12, detail);
  window(out, 'east', rear.bounds[2], -10.6, rear.floor + 1.1, 0.71, 0.88, detail);
  const center = (porch.bounds[0] + porch.bounds[2]) / 2;
  facePanel(
    out,
    'panel',
    'south',
    mainSouth,
    center - 0.52,
    center + 0.52,
    main.floor,
    main.floor + 2.13,
    0.035,
    dark,
  );
  for (const edge of [center - 0.53, center + 0.53])
    facePanel(
      out,
      'wood',
      'south',
      mainSouth,
      edge - 0.063,
      edge + 0.063,
      main.floor,
      main.floor + 2.24,
      0.055,
      light,
    );
  facePanel(
    out,
    'wood',
    'south',
    mainSouth,
    center - 0.59,
    center + 0.59,
    main.floor + 2.13,
    main.floor + 2.25,
    0.066,
    light,
  );
}

function southPorch(out, detail) {
  const [left, back, right, front] = porch.bounds;
  const { floor, eaves } = porch;
  const height = 0.18;
  box(out, 'wood', [left, floor - height, back], [right, floor, front], trim);
  for (const x of [left + 0.095, right - 0.095]) {
    box(
      out,
      'stone',
      [x - 0.15, -0.25, front - 0.3],
      [x + 0.15, floor - height, front - 0.02],
      stone,
    );
    box(
      out,
      'wood',
      [x - 0.072, floor, front - 0.23],
      [x + 0.072, eaves - 0.07, front - 0.082],
      light,
    );
    if (detail >= 1)
      beam(
        out,
        'wood',
        [x, floor + 2.03, front - 0.16],
        [x, eaves - 0.1, front - 0.63],
        0.066,
        0.073,
        trim,
      );
  }
  roofPanel(
    out,
    [
      [left - 0.19, eaves - 0.23, front + 0.16],
      [right + 0.19, eaves - 0.23, front + 0.16],
      [right + 0.19, eaves + 0.57, back - 0.13],
      [left - 0.19, eaves + 0.57, back - 0.13],
    ],
    light,
  );
  const center = (left + right) / 2;
  for (const [i, y] of [floor - 0.12, floor - 0.31, floor - 0.5, floor - 0.69].entries())
    box(
      out,
      'wood',
      [center - 0.81, y - 0.2, front],
      [center + 0.81, y, front + 0.35 + i * 0.3],
      trim,
    );
}

function chimney(out, detail) {
  const x = 5.37;
  const z = -0.86;
  const top = 8.9;
  const sections = [
    [-0.61, 1.73, 2.14],
    [3.04, 1.73, 2.14],
    [4.75, 1.26, 1.51],
    [5.54, 1.08, 1.29],
    [8.67, 0.78, 1.0],
    [8.75, 0.98, 1.19],
    [top, 0.98, 1.19],
  ];
  loft(
    out,
    'stone',
    sections.map(([y, w, d]) => chamferedRectangle(x, y, z, w, d, 0.1)),
    mortared,
  );
  box(out, 'panel', [x - 0.21, top + 0.001, z - 0.31], [x + 0.21, top + 0.015, z + 0.31], dark);
  if (detail >= 2)
    for (const y of [6.0, 6.41, 6.81, 7.23, 7.62, 8.03, 8.39]) {
      const depth = 1.29 - ((y - 5.54) * 0.29) / 3.13;
      const width = 1.08 - ((y - 5.54) * 0.3) / 3.13;
      box(
        out,
        'stone',
        [x - width / 2, y, z - depth / 2 - 0.006],
        [x + width / 2, y + 0.022, z + depth / 2 + 0.006],
        stone,
      );
    }
}

function build(out, detail) {
  houseBlock(out, connector, mutedSiding, detail);
  houseBlock(out, rear, mutedSiding, detail);
  houseBlock(out, main, siding, detail);
  southPorch(out, detail);
  elevations(out, detail);
  chimney(out, detail);
}
export const houseSkyline = (out) => build(out, 0);
export const houseDistrict = (out) => build(out, 1);
export const houseStreet = (out) => build(out, 2);
export const houseCloseup = (out) => build(out, 3);

const recipe = 'fort-temiscamingue-chief-factors-house-model.mjs';
const position = [-25, 16, 26];
const lookAt = [0, 4, -1.5];
export const fortTemiscamingueHouseModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: houseCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The late Hudson’s Bay Company Chief Factor’s House, with a covered link to the rear annex and a masonry chimney.',
  camera: position,
  lookAt,
  sunDirection: [-65, 108, 55],
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
    scale: 0.79,
    cameraYaw: 3.88,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'shore-and-main-residence', position: [-25, 11, 19], lookAt: [0, 4, -1.55] },
    { name: 'north-annex-and-covered-link', position: [-22, 12, -23], lookAt: [0, 4, -7.3] },
    { name: 'south-porch-and-windows', position: [-9, 9, 24], lookAt: [0, 4, 5.32] },
    { name: 'uphill-masonry-stack-and-roofline', position: [22, 15, 9], lookAt: [0, 4.5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-temiscamingue-chief-factors-house-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.23,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.022, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original historical reconstruction from the 1876 public-domain Qualla photograph, source elevation and published archaeology.',
};
