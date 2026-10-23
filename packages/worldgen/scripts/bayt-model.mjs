/** N0720: Al Bayt's peaked tent, striped fabric and red-lined burgundy bowl. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildBaytStadium } from './bayt-tent-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/th/ths/n0720_al_bayt_stadium/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source), 'utf8')),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('c4c4b6'),
    metal: linear('bfc6c0'),
    seat: linear('8e5053'),
    seatPale: linear('d5c9b4'),
    service: linear('b8b9ab'),
    entry: linear('424f50'),
    mark: linear('e6e3d2'),
    screen: linear('3d4d57'),
    tent: linear('d7d0b7'),
    stripe: linear('3f4546'),
    portal: linear('a54e50'),
    liningRed: linear('9d5b58'),
    liningDark: linear('444d4c'),
    liningPale: linear('c9b99f'),
    roof: linear('d7d0b7'),
    roofPale: linear('e0d9c1'),
    turf: linear('8da86f'),
    glass: [1, 1, 1],
  };

function build(out, detail) {
  const emit = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    const first = ps
      .slice(2)
      .map((p, i) => normalFor(ps[0], ps[i + 1], p))
      .find((n) => Math.hypot(...n) > 0.5);
    if (!first) return;
    if (first.reduce((n, v, k) => n + v * target[k], 0) < 0) ps = ps.toReversed();
    const tint = palette[role],
      color = detail === 0 ? tint.map((v, k) => v * (means[role]?.[k] ?? 1)) : tint;
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
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
        t.map((p) => [p[0], p[2]]),
        color,
      );
    }
  };
  buildBaytStadium(emit, detail, r);
}
export const buildBaytSkyline = (o) => build(o, 0),
  buildBaytDistrict = (o) => build(o, 1),
  buildBaytStreet = (o) => build(o, 2),
  buildBaytCloseup = (o) => build(o, 3);
export const baytStudy = {
  id: 'N0720',
  key: 'al_bayt_stadium',
  title: 'Al Bayt Stadium',
  category: 'stadium',
  wikidataId: 'Q1050220',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildBaytCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: [
    ...new Set(read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page)),
  ],
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map evidence Â©OpenStreetMap contributors, ODbL-1.0. Ordinary photographs viewed only; no copied pixels, event artwork or inscriptions.',
  geometrySource: r.scope,
  sourceNotice: r.scope,
  importReason: r.scope,
  previewGround: scope.previewGround,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [r.scope, r.identityBasis, r.heightBasis, r.terrainBasis],
  camera: scope.camera,
  qaCameras: [],
};
