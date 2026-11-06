/** Separate northern concrete platform. Plan and sections are explicit original estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  seam: { slot: 'trim', graph: 'concrete_plain', roughness: 1, metallic: 0 },
};
const colors = { concrete: rgb('929c96'), deck: rgb('b4bab2'), seam: rgb('747e77') };
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid concrete cap');
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
function prism(o, k, r, y0, y1) {
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
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'concrete', P.nativeRing, P.foundationBottom, P.floor);
  prism(o, 'deck', rect(P.stepX, -3.5, 5, 3.5), P.floor, P.raisedDeckTop);
  const [x, z] = P.plinthCenter,
    [w, h] = P.plinthSize;
  prism(o, 'deck', rect(x - w / 2, z - h / 2, x + w / 2, z + h / 2), P.floor, P.plinthTop);
  let seams = 0,
    fasteners = 0;
  if (lod > 0) {
    for (const Z of [-1.7, 1.7]) {
      prism(
        o,
        'seam',
        rect(-4.99, Z - 0.012, P.stepX - 0.012, Z + 0.012),
        P.floor,
        P.floor + 0.002,
      );
      prism(
        o,
        'seam',
        rect(P.stepX + 0.012, Z - 0.012, 4.99, Z + 0.012),
        P.raisedDeckTop,
        P.raisedDeckTop + 0.002,
      );
      seams += 2;
    }
  }
  if (lod > 1) {
    prism(
      o,
      'concrete',
      rect(x - w / 2 - 0.08, z - h / 2 - 0.08, x + w / 2 + 0.08, z + h / 2 + 0.08),
      P.floor,
      P.floor + 0.055,
    );
    for (const X of [x - w / 2 + 0.18, x + w / 2 - 0.18])
      for (const Z of [z - h / 2 + 0.18, z + h / 2 - 0.18]) {
        prism(
          o,
          'seam',
          rect(X - 0.03, Z - 0.03, X + 0.03, Z + 0.03),
          P.plinthTop,
          P.plinthTop + 0.035,
        );
        fasteners++;
      }
  }
  componentEvidence.push({
    lod,
    wholeNorthernConcretePlatform: true,
    wholeClosedRetainingBody: true,
    wholeDeck: true,
    adjoiningRaisedDeck: true,
    smallMountingPlinths: 1,
    concretePourSeams: seams,
    fasteners,
    bodyCoordinateSurveyed: false,
    footprintMeasured: false,
    heightMeasured: false,
    programmeNorthPlatformIdentityVerified: false,
    noTemporaryConstruction: true,
    noGraffitiOrPhotoTexture: true,
    noStationOrRadarProxy: true,
    noNaturalHillMesh: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/9q/9q8/hawk_hill_northern_concrete_platform',
  camera = [15, 10, 14],
  look = [0, 0.2, 0];
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
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain'],
  qaCameras: [
    { name: 'whole-northern-stepped-concrete-platform-and-plinth', position: camera, lookAt: look },
    { name: 'opposite-complete-retaining-body-and-deck', position: [-15, 9, -14], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-northern-platform-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Two exact individually NPS-credited public-domain agency originals, bound to official source page and explicit release policy. OSM native summit/footway site context © OpenStreetMap contributors, ODbL-1.0. No mapped body outline. Coordinate, facing, all dimensions and precise2013condition are original estimates. Exact programme North Platform identity unverified. No graffiti, photograph textures, construction equipment or natural-hill geometry.',
};
