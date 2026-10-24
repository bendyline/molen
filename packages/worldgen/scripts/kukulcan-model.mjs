/** Reproducible Kukulcan geometry and explicitly budgeted source-authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildKukulcan, kukulcanCandidateId } from './kukulcan-pyramid-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/d5/d59/temple_of_kukulcan/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== kukulcanCandidateId) throw Error('Kukulcan source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = { wall: linear('c9c6b9'), trim: linear('d0cabb'), ground: linear('b8b29f') };
function build(out, d) {
  buildKukulcan(
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
export const buildKukulcanSkyline = (o) => build(o, 0),
  buildKukulcanDistrict = (o) => build(o, 1),
  buildKukulcanStreet = (o) => build(o, 2),
  buildKukulcanCloseup = (o) => build(o, 3);
export const kukulcanStudy = {
  id: 'temple_of_kukulcan',
  key: 'temple_of_kukulcan',
  title: 'Temple of Kukulcan',
  category: 'temple',
  wikidataId: 'Q1128327',
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
    'Three shared256-square stone graphs, metric UVs and linear tints. Stair treads, shallow panel recesses and serpent profiles are geometry, not copied photographs. Two registered recipes rebuild the master and browser levels.',
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
    'Panel layouts, sloped face inset, serpent-head sculpture, round columns and damaged edges remain picture-guided approximations. Fine carvings, exact stone inventories, hidden earlier pyramids, buried chambers and internal artifacts are omitted. Current review status is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    {
      name: 'north-stair-and-facade',
      position: [25.36352827106292, 26.19368508012816, -75.12030090390893],
      lookAt: [-3.1305810396192433, 22.19368508012816, -11.182160998286895],
      fov: 44,
    },
    {
      name: 'summit-north-openings',
      position: [4.603534344708772, 36.19368508012816, -28.53679897267002],
      lookAt: [-1.5023462218659769, 32.19368508012816, -14.835768992893868],
      fov: 44,
    },
    {
      name: 'north-serpent-heads',
      position: [6.251609853137792, 9.693685080128159, -51.88811257851491],
      lookAt: [7.473786114626163, 7.193685080128159, -45.54096477923889],
      fov: 42,
    },
    {
      name: 'recessed-tier-panels',
      position: [-27.97116349209078, 20.19368508012816, -46.338177032842964],
      lookAt: [-11.33135833680918, 16.19368508012816, -34.54339494946966],
      fov: 44,
    },
    {
      name: 'summit-roof-and-cornice',
      position: [30.18871065229546, 49.19368508012816, -26.988008054016113],
      lookAt: [-3.1305810396192433, 33.19368508012816, -11.182160998286895],
      fov: 44,
    },
    {
      name: 'mapped-pyramid-plan',
      position: [-3.2119927805069066, 171.19368508012815, -10.999480598556547],
      lookAt: [-3.1305810396192433, 6.193685080128159, -11.182160998286895],
      fov: 39,
    },
  ],
};
