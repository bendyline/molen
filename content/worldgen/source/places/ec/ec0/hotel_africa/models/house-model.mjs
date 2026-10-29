/** Whole main hotel ruin and attached halls; measurements are read from the later frozen plan. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { local, lowHall, roomWing, serviceCore, tools } from './ruin-mesh.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  core: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  inside: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
const colors = { concrete: rgb('c2b8a5'), core: rgb('ded2b5'), inside: rgb('8d877c') };
export const partEvidence = [];
export function buildHouse(out, _frame, lod = 3) {
  partEvidence.length = 0;
  for (const [index, wing] of P.wings.entries()) {
    const o = tools(local(out, wing.origin, wing.u, wing.v), colors);
    o.box(
      'concrete',
      [0, P.foundationBase, -wing.width / 2],
      [wing.length, P.section.floorYs[0] - P.section.slabThickness, wing.width / 2],
    );
    partEvidence.push({
      part: 'complete-room-wing',
      index,
      ...roomWing(out, colors, wing, P.section, lod),
    });
  }
  for (const [index, core] of P.cores.entries())
    partEvidence.push({
      part: 'complete-service-core',
      index,
      ...serviceCore(out, colors, core, P.section, lod),
    });
  for (const [index, hall] of P.halls.entries())
    partEvidence.push({
      part: 'complete-attached-low-hall',
      index,
      ...lowHall(out, colors, hall, P.section, lod),
    });
  // Intrinsic ground-floor joining lobby/platform; detached resort facilities are outside this model.
  for (const join of P.connectors) {
    const o = tools(local(out, join.origin, join.u, join.v), colors);
    o.box(
      'concrete',
      [0, join.floorY - P.section.slabThickness, -join.width / 2],
      [join.length, join.floorY, join.width / 2],
    );
    const count = lod === 0 ? 2 : Math.ceil(join.length / P.section.lobbyBayWidth);
    for (let i = 0; i <= count; i++)
      for (const z of [-join.width / 2, join.width / 2]) {
        const x = (join.length * i) / count,
          w = P.section.lobbyPostWidth;
        if (lod === 0) {
          o.face(
            'concrete',
            [
              [x - w / 2, join.floorY, z],
              [x + w / 2, join.floorY, z],
              [x + w / 2, join.topY, z],
              [x - w / 2, join.topY, z],
            ],
            [0, 0, z < 0 ? -1 : 1],
          );
          o.face(
            'concrete',
            [
              [x + w / 2, join.floorY, z],
              [x - w / 2, join.floorY, z],
              [x - w / 2, join.topY, z],
              [x + w / 2, join.topY, z],
            ],
            [0, 0, z < 0 ? 1 : -1],
          );
        } else
          o.box('concrete', [x - w / 2, join.floorY, z - w / 2], [x + w / 2, join.topY, z + w / 2]);
      }
    for (const z of [-join.width / 2, join.width / 2 - P.section.hallBeamDepth])
      o.box(
        'concrete',
        [0, join.topY - P.section.hallBeamDepth, z],
        [join.length, join.topY, z + P.section.hallBeamDepth],
      );
  }
  partEvidence.push({
    part: 'whole-main-hotel-ruin',
    wingCount: P.wings.length,
    coreCount: P.cores.length,
    hallCount: P.halls.length,
    floors: P.section.floorYs.length,
    missingRoomRoofs: true,
    detachedResortBuildingsExcluded: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/ec/ec0/hotel_africa',
  span = P.reviewSpan,
  camera = [span * 0.64, span * 0.48, -span * 0.85],
  look = [0, P.section.floorYs.at(-1) * 0.45, 0];
export const houseModel = {
  key: P.model,
  id: P.model,
  title: 'Hotel Africa, Liberia (2025 ruin)',
  wikidataId: 'Q5911160',
  cell: 'ec/ec0',
  category: 'hotel',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  progressLedger: 'qualla-002.PROGRESS.md',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
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
    far: 3000,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain'],
  qaCameras: [
    {
      name: 'whole-main-hotel-open-frame-all-cores-and-attached-halls',
      position: camera,
      lookAt: look,
    },
    {
      name: 'open-room-bays-seven-floor-plates-and-missing-roofs',
      position: [0, P.section.floorYs.at(-1) * 0.62, -span * 0.38],
      lookAt: [0, P.section.floorYs.at(-1) * 0.52, 0],
    },
    {
      name: 'whole-low-halls-curved-open-bays-and-room-block-returns',
      position: [-span * 0.55, span * 0.25, -span * 0.49],
      lookAt: [-span * 0.08, P.section.floorYs.at(-1) * 0.3, 0],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-hotel-africa-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.9, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original authored geometry under repository license. Whole Liberian hotel2025 photograph is exact native own-work Bwoart CC0 original,3840x2160/nativeSHA137abc402e0d85a9d06aafbacedf06228d9b19a22, release and original bytes bound in reference records. Published Qualla corpus screened first; namesake Tunis images and protected Liberia photos unused. Primary LiberianPublicWorks2025 inspection and CCA original2017 fieldwork used as TEXT facts only. Native numeric geography under ODbL; approximate rear/hidden layout and historical registration declared. All floors/main sections chosen only after original source field. No phototextures, plants/pool/detached resort structures/people/graffiti/decorative art or generated bitmap.',
};
