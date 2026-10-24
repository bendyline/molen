/** Lotus Temple source master and explicit browser levels, in mapped east/south axes. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildLotusTemple, lotusCandidateId } from './lotus-temple-model.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/tt/ttn/lotus_temple/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== lotusCandidateId) throw Error('Lotus Temple source identity changed');
const linear = (hex) =>
  hex.match(/../g).map((s) => {
    const v = parseInt(s, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  white: linear('e8e4da'),
  red: linear('b87b65'),
  glass: linear('667b8a'),
  stone: linear('c8c4b8'),
  water: linear('286d83'),
};
function writer(out, d) {
  return (role, points, target) => {
    if (d === 0 && target[1] < -0.5) return;
    let ps = points.map((p) => p.map(Math.fround));
    const candidate = normalFor(ps[0], ps[1], ps[2]);
    if (candidate.reduce((n, v, i) => n + v * target[i], 0) < 0) ps = ps.toReversed();
    const color =
      d === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
    for (let i = 1; i < ps.length - 1; i++) {
      const tri = [ps[0], ps[i], ps[i + 1]];
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, k) => v - tri[0][k]),
            tri[2].map((v, k) => v - tri[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        role,
        'palette:#ffffff',
        tri,
        normalFor(...tri),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
const build = (out, detail) => buildLotusTemple(writer(out, detail), detail, r);
export const buildLotusSkyline = (o) => build(o, 0),
  buildLotusDistrict = (o) => build(o, 1),
  buildLotusStreet = (o) => build(o, 2),
  buildLotusCloseup = (o) => build(o, 3);
const view = (name, theta, distance, height, lookAt = [0, 14, 0]) => ({
  name,
  position: [Math.cos(theta) * distance, height, Math.sin(theta) * distance],
  lookAt,
});
export const lotusStudy = {
  id: 'lotus_temple',
  key: 'lotus_temple',
  title: 'Lotus Temple',
  category: 'temple',
  wikidataId: 'Q940843',
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
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Reference picture viewed only; no redistributed pixels.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  geometrySource:
    'Specific deterministic27-shell Lotus Temple model from the independently mapped principal building/roof parts,nine pools and one ordinary exterior picture. Heights,curvature and exact entry designation are estimates.',
  sourceNotice:
    'Four common256² marble,sandstone,limestone and storefront graphs; metric UVs and linear tints. Water is an explicit matte/reflection constant. No embedded images,unique atlas or copied photo pixels. Two registered recipes reconstruct the master and four authored browser levels.',
  importReason: r.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    r.poolLevelBasis,
    'The broad southwest stair and eight secondary entries follow related mapped radial corridors; exact entry designation is approximate. Fine shell joints,glazing mullions,hidden interiors,landscaping and surveyed thresholds are omitted.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    view('front-petals-and-main-stair', r.primaryApproach, 103, 30, [0, 15, 0]),
    view('three-shell-families', r.petalPhase + 0.18, 78, 28, [0, 16, 0]),
    view('porch-open-arches', r.primaryApproach, 43, 7, [
      Math.cos(r.primaryApproach) * 20,
      7,
      Math.sin(r.primaryApproach) * 20,
    ]),
    view('raised-base-and-bands', r.primaryApproach + 0.3, 68, 10, [0, 3, 0]),
    { name: 'nine-pools-and-plan', position: [0, 190, 1], lookAt: [0, 0, 0], fov: 43 },
    view('shell-ridges-and-crown', r.petalPhase + 1.0, 55, 43, [0, 22, 0]),
  ],
};
