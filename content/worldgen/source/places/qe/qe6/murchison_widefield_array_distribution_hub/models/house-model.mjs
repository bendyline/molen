/** Whole two-plinth MWA distribution hub; written arrangement, estimated sections. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  cabinet: { slot: 'wall', graph: 'metal_painted', roughness: 0.83, metallic: 0.25 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.35 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
  trim: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.65, metallic: 0.7 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.99, metallic: 0 },
  vent: { slot: 'trim', graph: 'metal_painted', roughness: 0.94, metallic: 0.2 },
};
const col = {
  cabinet: rgb('718077'),
  roof: rgb('64766b'),
  door: rgb('84938a'),
  trim: rgb('adb5ad'),
  foundation: rgb('aaa58e'),
  vent: rgb('3e4c46'),
};
export const componentEvidence = [];
function box(o, k, x, y, z, w, h, d) {
  for (const [n, p] of [
    [
      [0, -1, 0],
      [
        [x - w / 2, y, z + d / 2],
        [x - w / 2, y, z - d / 2],
        [x + w / 2, y, z - d / 2],
        [x + w / 2, y, z + d / 2],
      ],
    ],
    [
      [0, 1, 0],
      [
        [x - w / 2, y + h, z - d / 2],
        [x - w / 2, y + h, z + d / 2],
        [x + w / 2, y + h, z + d / 2],
        [x + w / 2, y + h, z - d / 2],
      ],
    ],
    [
      [0, 0, 1],
      [
        [x - w / 2, y, z + d / 2],
        [x + w / 2, y, z + d / 2],
        [x + w / 2, y + h, z + d / 2],
        [x - w / 2, y + h, z + d / 2],
      ],
    ],
    [
      [0, 0, -1],
      [
        [x + w / 2, y, z - d / 2],
        [x - w / 2, y, z - d / 2],
        [x - w / 2, y + h, z - d / 2],
        [x + w / 2, y + h, z - d / 2],
      ],
    ],
    [
      [1, 0, 0],
      [
        [x + w / 2, y, z + d / 2],
        [x + w / 2, y, z - d / 2],
        [x + w / 2, y + h, z - d / 2],
        [x + w / 2, y + h, z + d / 2],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [x - w / 2, y, z - d / 2],
        [x - w / 2, y, z + d / 2],
        [x - w / 2, y + h, z + d / 2],
        [x - w / 2, y + h, z - d / 2],
      ],
    ],
  ])
    o.addConvexPolygon(k, 'palette:#ffffff', p, n, (q) => [q[0], q[1]], col[k]);
}
const rod = (o, a, b, w = 0.025) => beam(o, 'trim', a, b, w, w, col.trim);
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  for (const p of P.plinths)
    box(
      o,
      'foundation',
      p.center[0],
      P.foundationBottom,
      p.center[1],
      p.width,
      P.floor - P.foundationBottom,
      p.depth,
    );
  for (const c of [P.kiosk, P.fibreCabinet]) {
    const [x, z] = c.center;
    box(o, 'cabinet', x, P.floor, z, c.width, c.height, c.depth);
    box(o, 'roof', x, P.floor + c.height, z, c.width + 0.08, 0.055, c.depth + 0.08);
  }
  const k = P.kiosk,
    front = k.depth / 2 + 0.014;
  for (const [x, w] of [
    [-2.55, 1.82],
    [-0.62, 1.82],
  ])
    box(o, 'door', x, P.floor + 0.06, front, w, k.height - 0.12, 0.025);
  box(o, 'door', 2.4, P.floor + 0.06, P.fibreCabinet.depth / 2 + 0.014, 0.96, 1.33, 0.025);
  // Whole weather housings remain closed; vent recesses, slats and doors are exterior estimates.
  for (const [x, z, w, h] of [
    [-2.55, front + 0.022, 1.5, 0.85],
    [-3.61, 0, 0.025, 1.0],
  ]) {
    if (w > 0.1) box(o, 'vent', x, 0.65, z, w, h, 0.014);
    else box(o, 'vent', x, 0.55, z, w, h, 1.3);
  }
  if (lod >= 1) {
    for (const x of [-1.77, 0.15, 2.77]) {
      const z = x > 2 ? 0.48 : front + 0.048;
      rod(o, [x, 0.8, z], [x, 1.1, z], 0.035);
    }
    for (const c of [P.kiosk, P.fibreCabinet])
      for (const s of [-1, 1])
        rod(
          o,
          [c.center[0] + (s * c.width) / 2, P.floor + 0.025, c.depth / 2 + 0.02],
          [c.center[0] + (s * c.width) / 2, P.floor + c.height - 0.02, c.depth / 2 + 0.02],
          0.018,
        );
  }
  const slats = [0, 4, 8, 14][lod];
  for (let i = 0; i < slats; i++) {
    const y = 0.68 + (i * 0.78) / Math.max(1, slats - 1);
    box(o, 'roof', -2.55, y, front + 0.037, 1.47, 0.028, 0.028);
    box(o, 'roof', -3.63, y, 0, 0.028, 0.028, 1.25);
  }
  if (lod >= 2) {
    for (const x of [-3.42, -1.68, -1.48, 0.25, 1.98, 2.82]) {
      const z = x > 1 ? 0.48 : front + 0.04;
      for (const y of [0.42, 1.35]) box(o, 'trim', x, y, z, 0.025, 0.025, 0.018);
    }
    for (const x of [-2.8, -0.5, 2.4]) box(o, 'trim', x, 0.21, -0.3, 0.1, 0.14, 0.11);
  }
  componentEvidence.push({
    lod,
    wholeDistributionHub: true,
    separateConcretePlinths: 2,
    compactSubstationKiosk: true,
    transformerAndLVSwitchboardContained: true,
    separateFibrePatchCabinet: true,
    allCabinetWallsAndRoofsClosed: true,
    allWholeBodiesAtEveryLod: true,
    undergroundCableRoutesExcluded: true,
    externalDimensionsAndFinishEstimated: true,
    nativeHubPointVerified: false,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/' + P.model,
  camera = [10, 6.5, 11],
  look = [-0.2, 1, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.43,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_stainless_beadblasted', 'concrete_plain'],
  qaCameras: [
    { name: 'whole-two-plinth-hub-with-kiosk-and-fibre-cabinet', position: camera, lookAt: look },
    {
      name: 'opposite-closed-housings-two-foundations-and-vent-detail',
      position: [-9, 5, -9],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-distribution-hub-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.12,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.08, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.035, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.005, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Originaldeterministicproceduralgeometryunderrepositorylicense. Primaryengineeringwritten2plinth/kiosk/separatefibrebox/approx200msouthandnumericarrayorigin only. Allsourceimagery/figures/graphicpaths/photos/plans unused. Externaldimensions/facing/finish/2013continuityestimated.',
};
