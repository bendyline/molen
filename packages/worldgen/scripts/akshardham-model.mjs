/** Reproducible Akshardham geometry and explicitly budgeted source-authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { akshardhamCandidateId, buildAkshardham } from './akshardham-mandir-model.mjs';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/tt/ttn/akshardham/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== akshardhamCandidateId) throw Error('Akshardham source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    stone: linear('c7ac91'),
    roof: linear('d4bea2'),
    plinth: linear('c3ad94'),
    metal: linear('c5a967'),
  };
function build(out, d) {
  buildAkshardham(
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
export const buildAkshardhamSkyline = (o) => build(o, 0),
  buildAkshardhamDistrict = (o) => build(o, 1),
  buildAkshardhamStreet = (o) => build(o, 2),
  buildAkshardhamCloseup = (o) => build(o, 3);
export const akshardhamStudy = {
  id: 'akshardham',
  key: 'akshardham',
  title: 'Akshardham',
  category: 'temple',
  wikidataId: 'Q1849858',
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
    'Two shared256-square material graphs, metric UVs and linear tints. Nine domes, twenty quadrangled spires, open porches, stepped plinth, approximate elephant frieze and forecourt pavilions are geometry. No unique atlas or copied photograph is shipped. Two registered recipes rebuild the master and browser levels.',
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
    'Dome and finial allocation, porch bays, sculptural poses, facade niches and forecourt roofs are photo/map-guided medium-fi estimates. Elephant and niche figures are simplified original geometry, not literal copies of individual carvings. Interior murtis, the complete carved inventory, exact surveyed thresholds, exhibition halls and distant gardens are outside scope. Current review status is recorded in qa.json.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    {
      name: 'southwest-main-entrance',
      position: [-44.838363777445615, 25, 81.8139421722328],
      lookAt: [-8.632971422866296, 16, 5.046959917809324],
      fov: 44,
    },
    {
      name: 'nine-domes-and-spires',
      position: [-13.61357181385171, 49, 65.87617674447344],
      lookAt: [-4.143826282975822, 29, 2.4225407605484754],
      fov: 44,
    },
    {
      name: 'elephant-plinth',
      position: [-30.175584263937687, 5, 59.34167266205088],
      lookAt: [-27.452869901167347, 2.8, 46.166437313156194],
      fov: 44,
    },
    {
      name: 'forecourt-pavilion',
      position: [-127.1038104377376, 28, -58.90349202048781],
      lookAt: [-79.2373226507377, 18, -60.2448894026945],
      fov: 44,
    },
    {
      name: 'mapped-mandir-plan',
      position: [0, 340, 0.01],
      lookAt: [0, 0, 0],
      fov: 44,
    },
  ],
};
