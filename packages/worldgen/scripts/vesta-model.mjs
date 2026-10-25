/** Reproducible Roman Forum Temple of Vesta ruin and four authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildVesta, vestaCandidateId } from './vesta-ruin-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sr/sr2/temple_of_vesta_rome/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== vestaCandidateId) throw Error('Temple of Vesta source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    marble: linear('cfcbc2'),
    brick: linear('c5b8a5'),
    rubble: linear('b0a28c'),
    ground: linear('b9ae97'),
  };
function build(out, d) {
  buildVesta(
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
export const buildVestaSkyline = (o) => build(o, 0),
  buildVestaDistrict = (o) => build(o, 1),
  buildVestaStreet = (o) => build(o, 2),
  buildVestaCloseup = (o) => build(o, 3);
export const vestaStudy = {
  id: 'temple_of_vesta_rome',
  key: 'temple_of_vesta',
  title: 'Temple of Vesta',
  category: 'temple',
  wikidataId: 'Q753791',
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
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only; no pixels copied.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Two registered recipes rebuild the present-day ruin and four budgeted levels. Four common256-square graphs supply marble, long-format brick, weathered limestone and gravel with metric UVs and linear tints. No embedded images or unique atlas.',
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
    'This represents the surviving Roman Forum ruin, including its partial twentieth-century reconstruction. Missing roof and colonnade remain absent. Fine carvings, exact damage patterns, buried chambers and adjoining Forum ruins are outside scope. Current review status is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'northwest-colonnade', position: [-14, 9, -17], lookAt: [-3.2, 6, -3.5], fov: 44 },
    { name: 'corinthian-capitals', position: [-7, 12, -10], lookAt: [-3.5, 10, -3.8], fov: 40 },
    { name: 'open-cella-and-brick-podium', position: [17, 12, 18], lookAt: [0, 5, 0], fov: 44 },
    { name: 'mapped-ruin-plan', position: [0, 44, 0.01], lookAt: [0, 0, 0], fov: 40 },
  ],
};
