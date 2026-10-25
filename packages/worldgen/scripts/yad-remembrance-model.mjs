/** 'hall_of_remembrance_yad_vashem': Hall of Remembrance fieldstone base and floating roof. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildYadRemembrance } from './yad-remembrance-geometry.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sv/sv9/hall_of_remembrance_yad_vashem/',
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
    joint: linear('77776f'),
    stone0: linear('aaa69b'),
    stone1: linear('b1a595'),
    stone2: linear('96978f'),
    stone3: linear('b6aea0'),
    concrete: linear('d8d5ce'),
    roof: linear('bfbfb5'),
    floor: linear('c7c3b9'),
    metal: linear('555e60'),
    bronze: linear('7c7461'),
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
    if (
      detail &&
      ps.length === 4 &&
      ['wall', 'floor', 'render', 'stone', 'roof'].includes(role) &&
      Math.hypot(...normalFor(ps[0], ps[1], ps[2])) > 0.5 &&
      Math.hypot(...normalFor(ps[0], ps[2], ps[3])) > 0.5
    ) {
      const nx = target[0] * r.xAxis[0] + target[2] * r.xAxis[1],
        nz = target[0] * r.zAxis[0] + target[2] * r.zAxis[1];
      out.addQuad(
        role,
        'metric:uv',
        ps,
        normalFor(...ps.slice(0, 3)),
        ps.map((p) => {
          const x = p[0] * r.xAxis[0] + p[2] * r.xAxis[1],
            z = p[0] * r.zAxis[0] + p[2] * r.zAxis[1];
          return Math.abs(target[1]) > 0.5
            ? [x * 1.5, z * 1.5]
            : [(Math.abs(nx) > Math.abs(nz) ? z : x) * 1.5, p[1] * 1.5];
        }),
        color,
      );
      return;
    }
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
        t.map((p) =>
          Math.abs(target[1]) > 0.5
            ? [
                (p[0] * r.xAxis[0] + p[2] * r.xAxis[1]) * 1.5,
                (p[0] * r.zAxis[0] + p[2] * r.zAxis[1]) * 1.5,
              ]
            : Math.abs(target[0]) > Math.abs(target[2])
              ? [p[2], p[1]]
              : [p[0], p[1]],
        ),
        color,
      );
    }
  };
  buildYadRemembrance(emit, detail, r);
}
export const buildYadRemembranceSkyline = (o) => build(o, 0),
  buildYadRemembranceDistrict = (o) => build(o, 1),
  buildYadRemembranceStreet = (o) => build(o, 2),
  buildYadRemembranceCloseup = (o) => build(o, 3);
export const yadRemembranceStudy = {
  id: 'hall_of_remembrance_yad_vashem',
  key: 'remembrance',
  title: 'Hall of Remembrance, Yad Vashem',
  category: 'museum',
  wikidataId: 'Q6826871',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildYadRemembranceCloseup,
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
