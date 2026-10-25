/** Reproducible Edfu source master and four explicitly authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildEdfu, edfuCandidateId } from './edfu-temple-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/ss/ssr/temple_of_edfu/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== edfuCandidateId) throw Error('Edfu source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('dbc29e'),
    stone: linear('dec5a0'),
    granite: linear('85827c'),
    ground: linear('b7aa8b'),
  };
function build(out, d) {
  buildEdfu(
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
export const buildEdfuSkyline = (o) => build(o, 0),
  buildEdfuDistrict = (o) => build(o, 1),
  buildEdfuStreet = (o) => build(o, 2),
  buildEdfuCloseup = (o) => build(o, 3);
export const edfuStudy = {
  id: 'temple_of_edfu',
  key: 'temple_of_edfu',
  title: 'Temple of Edfu',
  category: 'temple',
  wikidataId: 'Q613037',
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
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Ordinary photograph viewed only; no copied pixels.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Three shared256-square stone graphs,metric UVs,linear tints and an explicit earth constant. No embedded images or unique atlas. Two registered recipes reconstruct the master and four browser levels.',
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
    'Fine relief,inscriptions,exact carving inventories,navigable interiors and surveyed thresholds are omitted. Southern roof/column heights are approximations from normal-map controls; this is not an archaeological reconstruction. Synthetic partial residency exposes the existing terrain-excavation sky-sliver limitation at temporary clipped boundaries; full-site contact does not approve those temporary edges.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'south-pylons-and-gateway', position: [20, 24, 152], lookAt: [15, 17, 42], fov: 47 },
    { name: 'open-central-gateway', position: [15.3, 7, 83], lookAt: [15.3, 7, 13], fov: 52 },
    { name: 'forecourt-and-peristyle', position: [90, 78, 37], lookAt: [16, 7, 5], fov: 46 },
    { name: 'columned-hall-front', position: [17, 31, 7], lookAt: [17, 14, -23], fov: 48 },
    { name: 'rear-roof-ranges', position: [-90, 66, -105], lookAt: [17, 10, -52], fov: 45 },
    {
      name: 'southern-colonnaded-building',
      position: [-74, 24, 149],
      lookAt: [-30, 4, 112],
      fov: 44,
    },
  ],
};
