/** Full original mapped pier; deck/support sections are explicit estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  deck: { slot: 'roof', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  support: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.2 },
};
const colors = { deck: rgb('b7b9ad'), support: rgb('a7aaa1'), trim: rgb('647276') };
export const componentEvidence = [];
function face(o, k, p, n) {
  let v = normalFor(...p);
  if (n && v.reduce((s, a, i) => s + a * n[i], 0) < 0) {
    p = [...p].reverse();
    v = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, v, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, R, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      R,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid native pier cap');
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
function solid(o, k, R, y0, y1) {
  const sg = Math.sign(
    R.reduce((s, a, i) => {
      const b = R[(i + 1) % R.length];
      return s + a[0] * b[1] - a[1] * b[0];
    }, 0),
  );
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, R, y0, -1);
  cap(o, k, R, y1, 1);
}
function cylinder(o, k, [x, z], r, y0, y1, n) {
  const R = Array.from({ length: n }, (_, i) => [
    x + r * Math.cos((i * 2 * Math.PI) / n),
    z + r * Math.sin((i * 2 * Math.PI) / n),
  ]);
  solid(o, k, R, y0, y1);
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = [6, 8, 12, 20][lod],
    R = P.nativeRing;
  solid(o, 'deck', R, P.deckBottom, P.deckTop);
  for (const p of P.piles)
    cylinder(o, 'support', p, P.pileRadius, P.foundationBottom, P.deckBottom, n);
  for (const p of P.bollards) {
    cylinder(o, 'trim', p, P.bollardRadius, P.deckTop, P.deckTop + P.bollardHeight, n);
    if (lod > 0)
      beam(
        o,
        'trim',
        [p[0] - 0.32, P.deckTop + 0.36, p[1]],
        [p[0] + 0.32, P.deckTop + 0.36, p[1]],
        0.13,
        0.13,
        colors.trim,
      );
  }
  if (lod > 0)
    for (let i = 0; i < R.length; i++) {
      const a = R[i],
        b = R[(i + 1) % R.length];
      beam(
        o,
        'trim',
        [a[0], P.deckBottom + 0.12, a[1]],
        [b[0], P.deckBottom + 0.12, b[1]],
        0.085,
        0.1,
        colors.trim,
      );
    }
  componentEvidence.push({
    lod,
    wholePier: true,
    closedOriginalDeck: true,
    nativeControls: R.length,
    allOriginalPerimeterProjections: true,
    estimatedPiles: P.piles.length,
    estimatedBollards: P.bollards.length,
    deckHeightIsEstimated: true,
    openWaterAndGroundUnfilled: true,
    notWholeFactoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  span = Math.max(
    15,
    ...[0, 1].map(
      (k) =>
        Math.max(...P.nativeRing.map((p) => p[k])) - Math.min(...P.nativeRing.map((p) => p[k])),
    ),
  ),
  camera = [span * 0.9, span * 0.42, span * 0.75],
  look = [0, 1.4, 0];
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
  portableGroundY: -2.45,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'metal_painted'],
  qaCameras: [
    { name: 'whole-native-pier-deck-and-edge-projections', position: camera, lookAt: look },
    {
      name: 'opposite-pile-supports-and-estimated-mooring-posts',
      position: [-camera[0], camera[1] * 0.7, -camera[2]],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-river-pier-' + reviewLod,
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
      closeup: { export: 'houseCloseup', errorMeters: 0.01, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. OpenStreetMap contributors ODbL-1.0 native closed pier outline retained with credits. Three already-cleared PD U.S.Embassy factory-context originals supply only general concrete/steel material vocabulary. Pier-specific deck section, supports, hardware and condition are unverified estimates; no imagery or photo texture copied.',
};
