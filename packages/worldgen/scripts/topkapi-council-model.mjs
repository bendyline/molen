/** 'imperial_council_hall_topkapi_palace': Council hall, lead domes, open portico and shared window screens. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildTopkapiCouncil } from './topkapi-council-geometry.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sx/sxk/imperial_council_hall_topkapi_palace/',
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
    wall: linear('dedbc8'),
    trim: linear('e0d4b4'),
    floor: linear('c3bba9'),
    roof: linear('7b868b'),
    wood: linear('ac9172'),
    panel: linear('65705e'),
    gold: linear('c4aa65'),
    column: linear('b7c4bf'),
    glazing: linear('56655e'),
    screen: linear('c7ae70'),
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
      if (role === 'screen' && detail > 0) {
        const q = [t[0], t[1], t[1].map((v, k) => (v + t[2][k]) / 2), t[2]];
        out.addQuad(
          role,
          'metric:uv',
          q,
          normalFor(...t),
          q.map((p) => [(p[0] * r.xAxis[0] + p[2] * r.xAxis[1]) * 4, p[1] * 4]),
          color,
        );
        continue;
      }
      out.addTriangle(
        role,
        'palette:#ffffff',
        t,
        normalFor(...t),
        t.map((p) =>
          Math.abs(target[1]) > 0.5
            ? [p[0], p[2]]
            : Math.abs(target[0]) > Math.abs(target[2])
              ? [p[2], p[1]]
              : [p[0], p[1]],
        ),
        color,
      );
    }
  };
  buildTopkapiCouncil(emit, detail, r);
}
export const buildTopkapiCouncilSkyline = (o) => build(o, 0),
  buildTopkapiCouncilDistrict = (o) => build(o, 1),
  buildTopkapiCouncilStreet = (o) => build(o, 2),
  buildTopkapiCouncilCloseup = (o) => build(o, 3);
export const topkapiCouncilStudy = {
  id: 'imperial_council_hall_topkapi_palace',
  key: 'council',
  title: 'Imperial Council Hall, Topkapi Palace',
  category: 'castle',
  wikidataId: 'Q170495',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildTopkapiCouncilCloseup,
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
