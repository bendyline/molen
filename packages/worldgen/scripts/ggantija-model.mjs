/** Reproducible Ġgantija source and explicitly authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildGgantija, ggantijaCandidateId } from './ggantija-temple-model.mjs';

const source = new URL('../../../content/worldgen/source/places/sq/sq6/ggantija/', import.meta.url),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== ggantijaCandidateId) throw Error('Ggantija source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = { rubble: linear('d7ccb1'), blocks: linear('e5dcc3'), ground: linear('b7aa8b') };
function build(out, detail) {
  buildGgantija(
    (role, points, target) => {
      let ps = points.map((p) => p.map(Math.fround));
      if (normalFor(ps[0], ps[1], ps[2]).reduce((n, v, i) => n + v * target[i], 0) < 0)
        ps = ps.toReversed();
      let color = palette[role];
      if (detail === 0) {
        color = color.map((v, i) => v * (means[role]?.[i] ?? 1));
        if (role === 'rubble')
          color = color.map((v, i) => v * 0.65 + palette.blocks[i] * means.blocks[i] * 0.35);
      }
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
export const buildGgantijaSkyline = (o) => build(o, 0),
  buildGgantijaDistrict = (o) => build(o, 1),
  buildGgantijaStreet = (o) => build(o, 2),
  buildGgantijaCloseup = (o) => build(o, 3);
export const ggantijaStudy = {
  id: 'ggantija',
  key: 'ggantija',
  title: 'Ġgantija',
  category: 'temple',
  wikidataId: 'Q216862',
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
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors, ODbL-1.0. Reference picture viewed only; no copied pixels.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource:
    'Specific paired roofless temple wall mass from its 75-vertex mapped outline and one ordinary aerial exterior photograph. Large limestone faces and upper rubble groups are estimates; open chambers and southeast entrance corridors retain their mapped layout.',
  sourceNotice:
    'Two shared 256-square limestone/dry-stone graphs, metric UVs and linear tints; an explicit earthen-ground constant follows the original grid. No embedded images or unique atlas. Two registered recipes reconstruct the master and four browser levels.',
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
    'Large stone positions, surviving wall heights, individual portal stones, smaller rubble and soil colour are visualization estimates. The original park outline is not used as the temple footprint. Complete roofs, exact stone inventories, visitors, modern walkway engineering and hidden interiors are omitted.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'southeast-entrances', position: [42, 13, 34], lookAt: [-4, 1.5, -5], fov: 47 },
    { name: 'southern-open-apses', position: [-2, 52, 23], lookAt: [-11, 1, 0], fov: 43 },
    { name: 'northern-open-chambers', position: [25, 28, -8], lookAt: [3, 1.4, -17], fov: 46 },
    { name: 'curving-west-megaliths', position: [-42, 10, -7], lookAt: [-20, 2, -3], fov: 47 },
    { name: 'interior-lower-stones', position: [-9, 5.5, 4], lookAt: [-13, 1.7, -1], fov: 55 },
    { name: 'paired-temple-plan', position: [-4, 105, -6.9], lookAt: [-4, 0, -7], fov: 39 },
  ],
};
