/** Reproducible photographic foundation draft; geographic activation remains disabled. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildJupiterFoundations, jupiterCandidateId } from './jupiter-foundation-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sr/sr2/temple_of_jupiter_optimus_maximus/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== jupiterCandidateId)
  throw Error('Temple of Jupiter source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = { tuff: linear('b5af9a') };
function build(out, d) {
  buildJupiterFoundations(
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
export const buildJupiterSkyline = (o) => build(o, 0),
  buildJupiterDistrict = (o) => build(o, 1),
  buildJupiterStreet = (o) => build(o, 2),
  buildJupiterCloseup = (o) => build(o, 3);
export const jupiterStudy = {
  id: 'temple_of_jupiter_optimus_maximus',
  key: 'temple_of_jupiter_optimus_maximus',
  title: 'Temple of Jupiter Optimus Maximus',
  category: 'temple',
  wikidataId: 'Q586468',
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
    'Two registered recipes rebuild the photographic foundation draft. One reused256-square raw stone graph, metric UVs and linear tints; no embedded images or unique atlas.',
  importReason: r.scope,
  previewGround: true,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    'Unfinished photographic foundation draft. Entire surviving scope, exact block courses, underground depth, location and orientation remain unverified. No geographic or fidelity acceptance exists. The modern museum is independent and automatic placement stays disabled.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  // The generator appends review-scope cameras once.
  qaCameras: [],
};
