/** Pyramid of the Sun: reproducible master and four explicitly authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildSunPyramid, sunPyramidCandidateId } from './sun-pyramid-geometry.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/9g/9g9/pyramid_of_the_sun/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== sunPyramidCandidateId) throw Error('Pyramid source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    masonry: linear('aaa59b'),
    coping: linear('b7b0a4'),
    steps: linear('b4aea3'),
    ground: linear('a9a28f'),
  };
function build(out, detail) {
  buildSunPyramid(
    (role, points, target) => {
      let ps = points.map((p) => p.map(Math.fround));
      if (normalFor(ps[0], ps[1], ps[2]).reduce((n, v, i) => n + v * target[i], 0) < 0)
        ps = ps.toReversed();
      const color =
        detail === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
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
    },
    detail,
    r,
  );
}
export const buildSunPyramidSkyline = (o) => build(o, 0),
  buildSunPyramidDistrict = (o) => build(o, 1),
  buildSunPyramidStreet = (o) => build(o, 2),
  buildSunPyramidCloseup = (o) => build(o, 3);
export const sunPyramidStudy = {
  id: 'pyramid_of_the_sun',
  key: 'pyramid_of_the_sun',
  title: 'Pyramid of the Sun',
  category: 'temple',
  wikidataId: 'Q29238',
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
    'Original geometry under repository license;mapped geometry©OpenStreetMap contributors,ODbL-1.0. Reference photo viewed only;no redistributed pixels.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  geometrySource:
    'Specific deterministic Pyramid of the Sun from its mapped principal footprint,24 terrace/platform controls and one ordinary frontal photograph. Regularized terrace bounds,stair subdivisions,cheek heights and summit inset are approximate.',
  sourceNotice:
    'Two common256² volcanic masonry/grain graphs with metric UVs and linear tints. No embedded image,unique atlas or photo pixels. Two registered recipes reconstruct the master and four explicit browser levels.',
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
    'The standard DEM smooths the original mound and cannot establish surveyed footing/summit elevations. Bounded joins retain coarse edge heights;fine stonework,visitors,landscaping,hidden chambers and historical temple reconstructions are omitted.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'west-stair-and-platform', position: [-265, 65, 10], lookAt: [-36, 25, 0], fov: 46 },
    { name: 'terraces-southeast', position: [255, 155, 250], lookAt: [5, 23, 0], fov: 45 },
    { name: 'lower-platform-cheeks', position: [-158, 25, 63], lookAt: [-99, 8, 0], fov: 47 },
    { name: 'principal-stair-landings', position: [-90, 63, 47], lookAt: [-39, 38, 0], fov: 48 },
    { name: 'flat-summit-no-temple', position: [-25, 91, 34], lookAt: [5.5, 62, 0], fov: 47 },
    { name: 'mapped-pyramid-plan', position: [5.5, 375, 1], lookAt: [5.5, 0, 0], fov: 42 },
  ],
};
