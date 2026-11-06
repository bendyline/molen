/** Entire independently placed MRO control building; numerical plan and written facts only. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  R = P.nativeRing;
export const surfaces = {
  wall: { slot: 'wall', graph: 'metal_painted', roughness: 0.81, metallic: 0.18 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.74, metallic: 0.28 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.28 },
  door: { slot: 'door', graph: 'metal_painted', roughness: 0.77, metallic: 0.32 },
  equipment: { slot: 'window', graph: 'metal_painted', roughness: 0.88, metallic: 0.14 },
};
const colors = {
  wall: rgb('c5cac6'),
  roof: rgb('858f91'),
  foundation: rgb('98998d'),
  trim: rgb('6f7c7e'),
  door: rgb('647272'),
  equipment: rgb('394448'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole house cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const xmin = Math.min(...R.map((p) => p[0])),
  xmax = Math.max(...R.map((p) => p[0])),
  zmin = Math.min(...R.map((p) => p[1])),
  zmax = Math.max(...R.map((p) => p[1]));
function box(o, k, x, z, w, d, y0, y1) {
  polygon(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1);
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  polygon(o, 'foundation', R, P.foundationBottom, P.floor);
  polygon(o, 'wall', R, P.floor, P.roofTop);
  cap(o, 'roof', R, P.roofTop + 0.015, 1);
  const edges = [
    [xmin, xmax, zmin, zmin],
    [xmin, xmax, zmax, zmax],
  ];
  for (const [a, b, z] of edges)
    box(o, 'trim', (a + b) / 2, z, b - a, 0.18, P.roofTop, P.parapetTop);
  for (const x of [xmin, xmax])
    box(o, 'trim', x, (zmin + zmax) / 2, 0.18, zmax - zmin, P.roofTop, P.parapetTop);
  // Closed exterior of the airlock; the second, interior shielding door is unexposed.
  for (const s of [-1, 1])
    box(o, 'door', -8 + s * 0.64, zmax + 0.075, 1.23, 0.16, P.floor + 0.02, P.floor + 2.75);
  box(o, 'trim', -8, zmax + 0.12, 2.85, 0.18, P.floor + 2.72, P.floor + 2.92);
  for (const x of [-9.39, -6.61])
    box(o, 'trim', x, zmax + 0.1, 0.12, 0.18, P.floor, P.floor + 2.83);
  box(o, 'door', 8, zmax + 0.06, 3.8, 0.15, P.floor, P.floor + 3.3);
  box(o, 'trim', 8, zmax + 0.1, 4.12, 0.16, P.floor + 3.3, P.floor + 3.48);
  box(o, 'foundation', -8, zmax + 0.6, 3.7, 1.2, -0.08, P.floor);
  box(o, 'foundation', 8, zmax + 0.6, 4.5, 1.2, -0.08, P.floor);
  for (const x of [-5, 5]) {
    box(o, 'foundation', x, zmin - 1.1, 3.8, 1.8, -0.1, P.floor);
    box(o, 'wall', x, zmin - 1.05, 3.4, 1.45, P.floor, P.floor + 1.65);
    box(o, 'equipment', x, zmin - 1.81, 2.85, 0.08, P.floor + 0.25, P.floor + 1.35);
    box(o, 'trim', x, zmin - 1.05, 3.5, 1.55, P.floor + 1.62, P.floor + 1.72);
    if (lod > 0)
      for (let i = 0; i < [0, 3, 6, 10][lod]; i++)
        box(
          o,
          'trim',
          x,
          zmin - 1.87,
          2.88,
          0.07,
          P.floor + 0.28 + (i * 1.03) / [1, 3, 6, 10][lod],
          P.floor + 0.31 + (i * 1.03) / [1, 3, 6, 10][lod],
        );
  }
  if (lod > 0) {
    const n = [0, 8, 12, 18][lod];
    for (let i = 1; i < n; i++) {
      const x = xmin + ((xmax - xmin) * i) / n;
      for (const z of [zmin - 0.016, zmax + 0.016])
        box(o, 'trim', x, z, 0.027, 0.045, P.floor + 0.15, P.roofTop - 0.1);
    }
    for (const x of [xmin - 0.016, xmax + 0.016])
      for (let i = 1; i < [1, 6, 9, 12][lod]; i++)
        box(
          o,
          'trim',
          x,
          zmin + ((zmax - zmin) * i) / [1, 6, 9, 12][lod],
          0.04,
          0.027,
          P.floor + 0.15,
          P.roofTop - 0.1,
        );
    for (const s of [-1, 1])
      box(o, 'trim', -8 + s * 0.12, zmax + 0.205, 0.045, 0.1, P.floor + 1.1, P.floor + 1.45);
    const rows = [0, 3, 8, 13][lod];
    for (let i = 1; i < rows; i++)
      box(
        o,
        'trim',
        8,
        zmax + 0.15,
        3.55,
        0.03,
        P.floor + 0.12 + (3.02 * i) / rows,
        P.floor + 0.15 + (3.02 * i) / rows,
      );
    for (let i = 1; i < [1, 7, 12, 18][lod]; i++)
      box(
        o,
        'trim',
        xmin + ((xmax - xmin) * i) / [1, 7, 12, 18][lod],
        0,
        0.045,
        zmax - zmin - 0.4,
        P.roofTop + 0.016,
        P.roofTop + 0.055,
      );
  }
  componentEvidence.push({
    kind: 'whole-independent-control-building',
    nativeControls: 4,
    allFourElevations: true,
    wholeRoofAndParapet: true,
    closedExteriorAirlockDoor: true,
    interiorAirlockUnexposed: true,
    workshopServiceDoor: true,
    twoEstimatedChillerCabinets: true,
    notWholeObservatoryProxy: true,
    lod,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_control_building',
  camera = [44, 29, 48],
  look = [0, 2, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'Murchison Radio-astronomy Observatory control building',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole independentMROcontrolbuilding, completeactualnativefourcornerplan/allwalls/fullflatmetalroof/parapet/base/closedexteriorsteelairlockentry/workshopdoor/twoestimatedintrinsicchillercabinets. Primarywrittenfacts and numericalfootprint only; everyimageunused. Roof/height/sections/facade/doors/finish/plantcensus estimates explicit. Separategeographicasset, not a completionproxy forwholeobservatory.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.53,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted', 'concrete_plain'],
  qaCameras: [
    {
      name: 'whole-control-building-airlock-and-workshop',
      position: [-29, 10, 31],
      lookAt: [-2, 2, 0],
    },
    { name: 'whole-roof-and-intrinsic-rear-chillers', position: [31, 25, -33], lookAt: [0, 2, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-control-building-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.15,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. OriginalOSMnumericdataODbL; primarywrittenCSIROconstructionfacts only. Everyimage/plan/photo/figureunused. Externalform/height/sections/details/finish/grade estimates explicit.',
};
