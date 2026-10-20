/** Reproducible Roman Forum Temple of Antoninus ruin and four authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { antoninusCandidateId, buildAntoninus } from './antoninus-temple-model.mjs';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sr/sr2/n0504_temple_of_antoninus_and_faustina/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== antoninusCandidateId)
  throw Error('Temple of Antoninus source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    stone: linear('cbc8b9'),
    body: linear('b2b0a4'),
    brick: linear('c1a588'),
    roof: linear('b6987d'),
    glass: linear('657174'),
    metal: linear('5e7769'),
  };
function build(out, d) {
  buildAntoninus(
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
export const buildAntoninusSkyline = (o) => build(o, 0),
  buildAntoninusDistrict = (o) => build(o, 1),
  buildAntoninusStreet = (o) => build(o, 2),
  buildAntoninusCloseup = (o) => build(o, 3);
export const antoninusStudy = {
  id: 'N0504',
  key: 'temple_of_antoninus_and_faustina',
  title: 'Temple of Antoninus and Faustina',
  category: 'temple',
  wikidataId: 'Q752555',
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
    'Two registered recipes rebuild the present temple porch and San Lorenzo in Miranda. Six common256-square material graphs, metric UVs and linear tints; no embedded images or unique atlas.',
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
    'Present-day exterior only. Columns, Corinthian leaf masses, dedication lettering, side carving, split pediment, roof pitch, buttresses and raised door are picture/map-guided medium-fi approximations. The ancient porch roof and full antique pediment remain absent. Complete interiors, exact masonry courses and neighboring structures are outside scope. Shared marble approximates cipollino; common window-grid and ceramic graphs stand in for glazing and roof tiles. Current acceptance is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  // The generator appends review-scope cameras once.
  qaCameras: [],
};
