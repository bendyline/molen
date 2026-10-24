/** nelson_mandela_bay_stadium: Nelson Mandela Bay petal roof, galleries and three red seating bands. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildMandelaStadium } from './mandela-petal-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/k9/k9f/nelson_mandela_bay_stadium/',
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
    wall: linear('c6c2b3'),
    metal: linear('d5d7ca'),
    roof: linear('d5d7cd'),
    membrane: linear('e4e4d6'),
    seat: linear('af675c'),
    seatWarm: linear('bc8065'),
    service: linear('b5ac98'),
    entry: linear('4b5b59'),
    mark: linear('e5e2d3'),
    screen: linear('3c4c54'),
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
  buildMandelaStadium(emit, detail, r);
}
export const buildMandelaSkyline = (o) => build(o, 0),
  buildMandelaDistrict = (o) => build(o, 1),
  buildMandelaStreet = (o) => build(o, 2),
  buildMandelaCloseup = (o) => build(o, 3);
export const mandelaStudy = {
  id: 'nelson_mandela_bay_stadium',
  key: 'nelson_mandela_bay_stadium',
  title: 'Nelson Mandela Bay Stadium',
  category: 'stadium',
  wikidataId: 'Q181445',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildMandelaCloseup,
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
