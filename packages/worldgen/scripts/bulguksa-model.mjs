/** Reproducible Bulguksa geometry and explicitly budgeted source-authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildBulguksa, bulguksaCandidateId } from './bulguksa-compound-model.mjs';

const source = new URL('../../../content/worldgen/source/places/wy/wy7/bulguksa/', import.meta.url),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== bulguksaCandidateId) throw Error('Bulguksa source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wood: linear('b58a7d'),
    trim: linear('a8baa5'),
    roof: linear('b7bdbe'),
    stone: linear('c5bfae'),
    panel: linear('bba878'),
    ground: linear('b5aa93'),
  };
function build(out, d) {
  buildBulguksa(
    (role, ps, target) => {
      let p = ps.map((a) => a.map(Math.fround));
      if (normalFor(p[0], p[1], p[2]).reduce((n, v, i) => n + v * target[i], 0) < 0)
        p = p.toReversed();
      const color =
        d === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
      for (let i = 1; i < p.length - 1; i++) {
        const t = [p[0], p[i], p[i + 1]];
        if (
          Math.hypot(
            ...cross(
              t[1].map((v, k) => v - t[0][k]),
              t[2].map((v, k) => v - t[0][k]),
            ),
          ) < 1e-7
        )
          continue;
        out.addTriangle(
          role,
          'palette:#ffffff',
          t,
          normalFor(...t),
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          color,
        );
      }
    },
    d,
    r,
  );
}
export const buildBulguksaSkyline = (o) => build(o, 0),
  buildBulguksaDistrict = (o) => build(o, 1),
  buildBulguksaStreet = (o) => build(o, 2),
  buildBulguksaCloseup = (o) => build(o, 3);
export const bulguksaStudy = {
  id: 'bulguksa',
  key: 'bulguksa',
  title: 'Bulguksa',
  category: 'temple',
  wikidataId: 'Q408318',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only; no copied pixels.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Four shared256-square material graphs, metric UVs and linear tints. Timber bays, bracket bands, roof curvature, stone bridges and distinct pagodas are geometry. No unique atlas or copied photograph is shipped. Two registered recipes rebuild the master and browser levels.',
  importReason: r.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    'Building heights, floor levels, curved hip-and-gable roofs, bracket bays, stair dimensions, rail profiles and stone pagoda sculptures are picture/map-guided medium-fi approximations. Fine dancheong painting, inscriptions, exact carved reliefs, deity figures, navigable interiors and the wider religious park are outside scope. Current review status is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    {
      name: 'daeungjeon-roof-and-timber',
      position: [25, 16, 17],
      lookAt: [-14, 5, -17],
      fov: 44,
    },
    {
      name: 'paired-courtyard-pagodas',
      position: [24, 13, 32],
      lookAt: [-10, 5, 2],
      fov: 44,
    },
    {
      name: 'main-stone-vault',
      position: [-14.5684407164109, -2.1622866864550763, 34.032004900783875],
      lookAt: [-5.696405058126659, -2.462286686455076, 32.51972738718627],
      fov: 45,
    },
    {
      name: 'western-court-and-stairs',
      position: [-110, 18, 64],
      lookAt: [-58, -1, 8],
      fov: 44,
    },
    {
      name: 'higher-terrace-halls',
      position: [20, 39, -123],
      lookAt: [-34, 7, -74],
      fov: 44,
    },
    {
      name: 'mapped-compound-plan',
      position: [-35, 270, -24],
      lookAt: [-35, 0, -23],
      fov: 40,
    },
  ],
};
