/** 'N0742_YEREVAN': Faceted blue chamber, pointed portico, broad lead canopy and garden stair. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildTopkapiYerevan } from './topkapi-yerevan-geometry.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sx/sxk/n0742_yerevan/',
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
    wall: linear('d8d3c8'),
    floor: linear('d5d3c7'),
    trim: linear('dedfd6'),
    column: linear('bdc5bc'),
    roof: linear('a8b2ac'),
    wood: linear('baa66b'),
    edge: linear('af796a'),
    tile: linear('88a9c3'),
    gold: linear('c5ad6c'),
    dark: linear('4f6266'),
    brick: linear('b48774'),
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
      ['wall', 'floor', 'brick', 'roof', 'tile'].includes(role) &&
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
  buildTopkapiYerevan(emit, detail, r);
}
export const buildTopkapiYerevanSkyline = (o) => build(o, 0),
  buildTopkapiYerevanDistrict = (o) => build(o, 1),
  buildTopkapiYerevanStreet = (o) => build(o, 2),
  buildTopkapiYerevanCloseup = (o) => build(o, 3);
export const topkapiYerevanStudy = {
  id: 'N0742_YEREVAN',
  key: 'yerevan',
  title: 'Yerevan Kiosk, Topkapi Palace',
  category: 'castle',
  wikidataId: 'Q6040439',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildTopkapiYerevanCloseup,
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
