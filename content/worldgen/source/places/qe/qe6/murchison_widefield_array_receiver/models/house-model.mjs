/** Whole original MWA RF receiver weatherhousing; estimated exterior and inferred positions. */
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
  cabinet: rgb('b5bbb7'),
  roof: rgb('929e99'),
  door: rgb('a8b4ae'),
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
  for (const [x, z] of P.feet)
    box(
      o,
      'foundation',
      x,
      P.foundationBottom,
      z,
      P.padWidth,
      P.padTop - P.foundationBottom,
      P.padWidth,
    );
  for (const z of [-0.48, 0.48])
    beam(o, 'trim', [-0.78, 0.225, z], [0.78, 0.225, z], 0.15, 0.15, col.trim);
  box(o, 'cabinet', 0, P.floor, 0, P.cabinetWidth, P.cabinetHeight, P.cabinetDepth);
  box(
    o,
    'roof',
    0,
    P.floor + P.cabinetHeight,
    0,
    P.cabinetWidth + 0.07,
    0.055,
    P.cabinetDepth + 0.07,
  );
  const front = P.cabinetDepth / 2 + 0.014,
    rear = -P.cabinetDepth / 2 - 0.014;
  box(o, 'door', 0, P.floor + 0.07, front, 1.44, P.cabinetHeight - 0.14, 0.025);
  box(o, 'door', 0, P.floor + 0.2, rear, 0.95, 1.62, 0.025);
  box(o, 'vent', 0, 0.65, rear - 0.024, 0.77, 0.62, 0.018);
  box(o, 'vent', 0.815, 1.7, 0, 0.02, 0.37, 0.75);
  box(o, 'cabinet', 0.855, 0.38, -0.22, 0.11, 0.2, 0.3);
  if (lod >= 1) {
    rod(o, [0.58, 1.05, front + 0.045], [0.58, 1.34, front + 0.045], 0.035);
    for (const x of [-0.72, 0.72])
      rod(
        o,
        [x, P.floor + 0.08, front + 0.027],
        [x, P.floor + P.cabinetHeight - 0.08, front + 0.027],
        0.018,
      );
  }
  const slats = [0, 4, 7, 12][lod];
  for (let i = 0; i < slats; i++) {
    const y = 0.68 + (i * 0.54) / Math.max(1, slats - 1);
    box(o, 'roof', 0, y, rear - 0.04, 0.74, 0.025, 0.025);
    box(o, 'roof', 0.83, 1.72 + (i * 0.31) / Math.max(1, slats - 1), 0, 0.025, 0.02, 0.72);
  }
  if (lod >= 2) {
    for (const x of [-0.67, 0.67])
      for (const y of [0.48, 2.16]) box(o, 'trim', x, y, front + 0.034, 0.024, 0.024, 0.012);
    for (const x of [-0.7, 0.7])
      for (const z of [-0.48, 0.48]) box(o, 'trim', x, 0.312, z, 0.055, 0.035, 0.055);
  }
  componentEvidence.push({
    lod,
    wholeOriginalMWAReceiver: true,
    closedWeatherHousing: true,
    integratedRefrigerationRepresented: true,
    closedCoolingAccessCover: true,
    closedDoorAndRoof: true,
    steelSkid: true,
    wholeIndependentFootings: 4,
    allWholeBodiesAtEveryLod: true,
    internalRackAndMechanismExcluded: true,
    externalDimensionsAndFinishEstimated: true,
    nativeReceiverPointVerified: false,
    conditionalRegionIsSurveyErrorBound: false,
    originalReceiverIdentities: 16,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/' + P.model,
  camera = [5.5, 3.6, 6],
  look = [0, 1.15, 0];
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
    {
      name: 'whole-receiver-weatherhousing-cooling-cover-skid-four-feet',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-refrigeration-cover-and-service-entry',
      position: [-5, 3.5, -5],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-receiver-' + reviewLod,
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
    'Originaldeterministicproceduralgeometryunderrepositorylicense. Primaryengineeringwrittenweather-tightRFenclosure/rack/integratedrefrigeration andactual2013operator16receiverIDs/eighttiles each only. Everyreceiverpositionisexplicitlyinferredfromconditionalrangeconstraints,notoperatorreceivercoordinatesorsurveyederrorbounds. Allsourceimagery/figures/graphicpaths/photos/plans unused. Externaldimensions/facing/finish/2013continuityestimated.',
};
