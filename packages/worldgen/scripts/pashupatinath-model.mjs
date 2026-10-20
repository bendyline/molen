/** Reproducible principal pagoda and four shared-material browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildPashupatinath, pashupatinathCandidateId } from './pashupatinath-temple-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/tu/tuu/n0496_pashupatinath_temple/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== pashupatinathCandidateId)
  throw Error('Pashupatinath source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    timber: linear('6b5844'),
    gold: linear('e3bf62'),
    silver: linear('c7c8bd'),
    stone: linear('c9bdac'),
  };
function build(out, d) {
  buildPashupatinath(
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
export const buildPashupatinathSkyline = (o) => build(o, 0),
  buildPashupatinathDistrict = (o) => build(o, 1),
  buildPashupatinathStreet = (o) => build(o, 2),
  buildPashupatinathCloseup = (o) => build(o, 3);
export const pashupatinathStudy = {
  id: 'N0496',
  key: 'pashupatinath_temple',
  title: 'Pashupatinath Temple',
  category: 'temple',
  wikidataId: 'Q380384',
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
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only; no copied pixels.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Four common256-square timber, metal and stone graphs; metric UVs and linear tints. No embedded images or unique atlas. Two registered recipes reconstruct the master and browser levels.',
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
    'This model represents the principal pagoda, not every independent temple in the broader precinct. Exact carvings, deity figures, door reliefs, inscriptions and interior rooms are omitted. Pinnacle details and foundation thresholds are visualization estimates.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'gold-roof-tiers', position: [32, 25, 39], lookAt: [2, 13, 3], fov: 44 },
    { name: 'lower-door-and-timber', position: [22, 6, 20], lookAt: [7, 4.5, 7], fov: 46 },
    { name: 'roof-struts-and-eaves', position: [-16, 14, 22], lookAt: [-3, 10, 8], fov: 48 },
    { name: 'upper-storey-and-pinnacle', position: [22, 26, -13], lookAt: [2, 18, 3], fov: 44 },
    { name: 'rear-doors-and-platform', position: [-32, 14, -25], lookAt: [2, 7, 3], fov: 43 },
    { name: 'mapped-roof-plan', position: [2, 70, 3.1], lookAt: [2, 0, 3], fov: 39 },
  ],
};
