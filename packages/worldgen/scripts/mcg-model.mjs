/** melbourne_cricket_ground: Melbourne Cricket Ground, four tiers, two roof systems and six light towers. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildMcgStadium } from './mcg-stadium-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/r1/r1r/melbourne_cricket_ground/',
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
    wall: linear('cdcfc3'),
    service: linear('b9c2b9'),
    metal: linear('cbd4ce'),
    teal: linear('5d827d'),
    seatGreen: linear('91aa9b'),
    seatPale: linear('c2cec4'),
    mark: linear('e5e6d8'),
    screen: linear('3d4d57'),
    pitch: linear('b4aa82'),
    pitchPale: linear('c8bb93'),
    turf: linear('8da86f'),
    roof: linear('c4cec8'),
    glass: [1, 1, 1],
    roofGlass: [1, 1, 1],
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
  buildMcgStadium(emit, detail, r);
}
export const buildMcgSkyline = (o) => build(o, 0),
  buildMcgDistrict = (o) => build(o, 1),
  buildMcgStreet = (o) => build(o, 2),
  buildMcgCloseup = (o) => build(o, 3);
export const mcgStudy = {
  id: 'melbourne_cricket_ground',
  key: 'melbourne_cricket_ground',
  title: 'Melbourne Cricket Ground',
  category: 'stadium',
  wikidataId: 'Q330136',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildMcgCloseup,
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
    'Original geometry under repository license; map evidence ©OpenStreetMap contributors, ODbL-1.0. Ordinary photographs viewed only; no copied pixels, event artwork or inscriptions.',
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
