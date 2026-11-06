/** Long elevated Fray Bentos conveyor; photo-based silhouette and explicit dimensional estimates. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
    steel: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.72, metallic: 0.55 },
    clad: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.78, metallic: 0.25 },
    belt: { slot: 'trim', graph: 'metal_painted', roughness: 0.97, metallic: 0 },
    foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  },
  colors = {
    steel: rgb('a3b0b2'),
    clad: rgb('9fa8a9'),
    belt: rgb('485254'),
    foundation: rgb('b2afa5'),
  };
export const componentEvidence = [];
export const deck = (x) => P.startDeck + ((P.endDeck - P.startDeck) * (x + P.span / 2)) / P.span;
const bar = (o, k, a, b, w, d = w) => beam(o, k, a, b, w, d, colors[k]);
const box = (o, k, x, y, z, w, h, d) => B(o, k, x, y, z, w, h, d, colors[k]);
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const a = -P.span / 2,
    b = P.span / 2;
  // Closed belt housing and continuous service walkway persist at every distance.
  bar(o, 'clad', [a, deck(a) + 1.2, 0], [b, deck(b) + 1.2, 0], 3.8, 1.6);
  bar(o, 'steel', [a, deck(a) - 0.15, 2.5], [b, deck(b) - 0.15, 2.5], 1.2, 0.22);
  for (const s of P.supports) {
    const y = deck(s.x) - 1.7;
    for (const p of s.feet) {
      box(o, 'foundation', s.x, p.ground - 0.45, p.z, 1.8, 0.85, 1.8);
      bar(
        o,
        'steel',
        [s.x, p.ground + 0.4, p.z],
        [s.x, y, Math.sign(p.z) * 1.5],
        lod === 0 ? 0.85 : 0.65,
      );
      if (lod >= 2)
        bar(o, 'steel', [s.x, p.ground + 2, p.z], [s.x, y * 0.55 + p.ground * 0.45, 0], 0.16);
    }
    bar(o, 'steel', [s.x, y, -1.8], [s.x, y, 1.8], 0.45);
    if (lod >= 1)
      bar(
        o,
        'steel',
        [s.x, y * 0.55 + s.feet[0].ground * 0.45, -4],
        [s.x, y * 0.55 + s.feet[0].ground * 0.45, 4],
        0.2,
      );
  }
  const bays = [8, 12, 30, 36][lod];
  for (const z of [-1.8, 1.8]) {
    bar(o, 'steel', [a, deck(a) - 1.6, z], [b, deck(b) - 1.6, z], lod === 0 ? 0.4 : 0.23);
    if (lod >= 1) {
      bar(o, 'steel', [a, deck(a), z], [b, deck(b), z], 0.2);
      for (let i = 0; i < bays; i++) {
        const x = a + ((b - a) * i) / bays,
          x1 = a + ((b - a) * (i + 1)) / bays;
        bar(o, 'steel', [x, deck(x) - 1.6, z], [x1, deck(x1), z], lod >= 2 ? 0.11 : 0.17);
        if (lod >= 2) bar(o, 'steel', [x, deck(x), z], [x, deck(x) - 1.6, z], 0.11);
      }
    }
  }
  if (lod >= 1) {
    for (const z of [1.95, 3.05]) {
      bar(o, 'steel', [a, deck(a) + 1.1, z], [b, deck(b) + 1.1, z], 0.09);
      if (lod >= 2) bar(o, 'steel', [a, deck(a) + 0.55, z], [b, deck(b) + 0.55, z], 0.065);
      for (let i = 0; i <= bays; i++) {
        const x = a + ((b - a) * i) / bays;
        bar(o, 'steel', [x, deck(x), z], [x, deck(x) + 1.1, z], 0.065);
      }
    }
    for (let i = 0; i <= bays; i++) {
      const x = a + ((b - a) * i) / bays;
      bar(o, 'steel', [x, deck(x) - 1.6, -1.8], [x, deck(x) - 1.6, 3.05], 0.15);
    }
  }
  // Compact conveyor head/return hoods are equipment casings, not another factory building.
  box(o, 'clad', a, deck(a) - 0.1, 0, 5, 4.1, 5);
  box(o, 'belt', a - 2.51, deck(a) + 0.45, 0, 0.025, 1.5, 3.4);
  box(o, 'clad', b, deck(b) + 0.25, 0, 3, 2.8, 4.4);
  if (lod >= 2) {
    for (let i = 0; i < 60; i++) {
      const x = a + 1 + (i * (P.span - 2)) / 60;
      bar(o, 'belt', [x, deck(x) + 0.25, -1.3], [x, deck(x) + 0.25, 1.3], 0.12);
    }
    for (const s of P.supports.slice(0, 4)) {
      const ground = s.feet[1].ground,
        top = deck(s.x),
        z = 3.25;
      for (const x of [s.x - 0.3, s.x + 0.3])
        bar(o, 'steel', [x, ground + 0.4, z], [x, top, z], 0.08);
      const rungs = Math.ceil((top - ground) / 0.38);
      for (let i = 0; i < rungs; i++) {
        const y = ground + 0.4 + i * 0.38;
        bar(o, 'steel', [s.x - 0.3, y, z], [s.x + 0.3, y, z], 0.045);
      }
    }
  }
  if (lod === 3) {
    for (let i = 1; i < 36; i++) {
      const x = a + (i * P.span) / 36;
      bar(o, 'steel', [x, deck(x) + 2.02, -1.9], [x, deck(x) + 2.02, 1.9], 0.055);
    }
    for (const s of P.supports) {
      const y = deck(s.x) - 0.15;
      box(o, 'steel', s.x, y, 3.4, 2, 0.14, 2);
      bar(o, 'steel', [s.x - 1, y + 1.1, 4.35], [s.x + 1, y + 1.1, 4.35], 0.07);
      for (const x of [s.x - 1, s.x + 1]) bar(o, 'steel', [x, y, 4.35], [x, y + 1.1, 4.35], 0.07);
    }
  }
  componentEvidence.push({
    lod,
    wholeEnclosedConveyor: true,
    continuousWalkway: true,
    aFrames: P.supports.length,
    originalGroundFootingValuesRetained: true,
    spanMeters: P.span,
    estimatedDimensions: true,
    notMappedCenterline: true,
    transferCasings: 2,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/' + P.cell + '/' + P.model,
  camera = [155, 83, 150],
  look = [0, 16, 0];
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
  brief:
    'Complete photo-based elevated wood conveyor with a closed trough, exposed lower lattice, continuous maintenance walkway, A-frame supports and concrete pads. Dimensions, orientation and within-mill placement are explicit reconstruction estimates.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: P.foundationBottom - 0.16,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_stainless_beadblasted',
    'metal_corrugated',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    { name: 'whole-long-span-walkway-and-a-frames', position: [-130, 45, 120], lookAt: [0, 17, 0] },
    { name: 'underside-lattice-and-support-footings', position: [55, 8, 46], lookAt: [0, 14, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-wood-conveyor-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.16, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original geometry under repository license. Already-cleared public-domain U.S. Embassy Commons originals; original numeric OSM factory identity and open Mapzen terrain attributed. No new imagery or photographic textures. All missing architectural measurements are original estimates.',
};
