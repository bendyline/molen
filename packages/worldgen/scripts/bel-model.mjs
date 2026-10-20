/** Reproducible surviving Palmyra Temple of Bel ruin and four authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { belCandidateId, buildBel } from './bel-ruin-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sy/sy5/n0505_temple_of_bel/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== belCandidateId) throw Error('Temple of Bel source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('d6bb91'),
    stone: linear('dac5a3'),
    ground: linear('bba781'),
  };
function build(out, d) {
  buildBel(
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
export const buildBelSkyline = (o) => build(o, 0),
  buildBelDistrict = (o) => build(o, 1),
  buildBelStreet = (o) => build(o, 2),
  buildBelCloseup = (o) => build(o, 3);
export const belStudy = {
  id: 'N0505',
  key: 'temple_of_bel',
  title: 'Temple of Bel',
  category: 'temple',
  wikidataId: 'Q797481',
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
    'Two registered recipes rebuild the surviving precinct and cella doorway. Three common256-square material graphs, metric UVs and linear tints; no embedded images or unique atlas.',
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
    'Post-destruction exterior only. Perimeter column positions, standing sections, damaged profiles, rubble and exact thresholds are picture/map-guided approximations. The lost cella walls, roof and complete surrounding temple colonnade remain absent. The west-gate form uses a pre-destruction photo; exact current damage remains uncertain. Current acceptance is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  // The generator appends review-scope cameras once.
  qaCameras: [],
};
