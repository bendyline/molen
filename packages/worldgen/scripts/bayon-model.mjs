/** Reproducible Bayon geometry and explicitly budgeted source-authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { bayonCandidateId, buildBayon } from './bayon-temple-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/w6/w63/n0497_bayon/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== bayonCandidateId) throw Error('Bayon source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = { wall: linear('c8c0ad'), face: linear('c9c1b0'), rubble: linear('b8af9c') };
function build(out, d) {
  buildBayon(
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
export const buildBayonSkyline = (o) => build(o, 0),
  buildBayonDistrict = (o) => build(o, 1),
  buildBayonStreet = (o) => build(o, 2),
  buildBayonCloseup = (o) => build(o, 3);
export const bayonStudy = {
  id: 'N0497',
  key: 'bayon',
  title: 'Bayon',
  category: 'temple',
  wikidataId: 'Q654024',
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
    'Three shared256-square stone graphs, metric UVs and linear tints. Facial relief is original faceted geometry, not a unique texture or copied photograph. Two registered recipes rebuild the master and browser levels.',
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
    'Secondary tower positions, exact face counts, library roofs and damaged gallery sections are visualization estimates. The ordinary modern layout picture has approximate upper-terrace dimensions; it is not a surveyed present inventory. Fine carvings, lichen, inscriptions, individual damaged stones and hidden interiors are omitted. Current visual/site acceptance is pending.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'east-galleries-and-towers', position: [162, 49, 42], lookAt: [20, 15, 3], fov: 45 },
    { name: 'central-stone-faces', position: [44, 35, 28], lookAt: [12, 30, 4], fov: 44 },
    { name: 'face-relief-close', position: [47, 21, 15], lookAt: [31, 17, 4], fov: 44 },
    { name: 'inner-platform-and-courts', position: [-62, 70, 64], lookAt: [14, 8, 4], fov: 45 },
    { name: 'outer-colonnade-and-library', position: [106, 18, 66], lookAt: [68, 7, 36], fov: 46 },
    { name: 'mapped-temple-plan', position: [20, 280, 4], lookAt: [20, 0, 3], fov: 39 },
  ],
};
