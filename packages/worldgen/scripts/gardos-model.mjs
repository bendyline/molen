/** gardos_tower: Gardoš brick shaft, columned gallery and two capped turrets. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildGardosTower } from './gardos-tower-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sr/sry/gardos_tower/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source), 'utf8')),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  fit = read('pmtiles-fit.json'),
  means = read('surface-means.json');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('b47b58'),
    stone: linear('e2dac8'),
    roof: linear('5d6b60'),
    panel: linear('886344'),
    metal: linear('606b62'),
    glass: [1, 1, 1],
  };
export function sampleGardosTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Gardos Tower geometry escaped retained terrain');
  return (
    (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - b) +
    (h(0, 1) * (1 - a) + h(1, 1) * a) * b -
    fit.datumMeters
  );
}
function build(out, detail) {
  const emit = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    // Orient from the first non-degenerate triangle of each supplied face.
    const initial = ps
      .slice(2)
      .map((p, i) => normalFor(ps[0], ps[i + 1], p))
      .find((normal) => Math.hypot(...normal) > 0.5);
    if (!initial) return;
    if (initial.reduce((n, v, i) => n + v * target[i], 0) < 0) ps = ps.toReversed();
    const tint = palette[role],
      color = detail === 0 ? tint.map((v, i) => v * (means[role]?.[i] ?? 1)) : tint;
    const nlen = Math.hypot(...target),
      nx = target[0] / nlen,
      nz = target[2] / nlen;
    const coords = (p) =>
      Math.abs(target[1]) > nlen * 0.8 ? [p[0], p[2]] : [p[0] * nz - p[2] * nx, p[1]];
    const uvPoints = ps.map(coords),
      lo = [0, 1].map((k) => Math.min(...uvPoints.map((p) => p[k]))),
      spans = [0, 1].map((k) => Math.max(...uvPoints.map((p) => p[k])) - lo[k]);
    const uv = (p) =>
      coords(p).map(
        (v, k) =>
          (v - lo[k]) /
          (role === 'glass' && spans[k] < 4 ? spans[k] || 1 : role === 'glass' ? 3.1 : 2),
      );
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
      out.addTriangle(role, 'palette:#ffffff', t, normalFor(...t), t.map(uv), color);
    }
  };
  buildGardosTower(emit, detail, r, sampleGardosTerrain);
}
export const buildGardosSkyline = (o) => build(o, 0),
  buildGardosDistrict = (o) => build(o, 1),
  buildGardosStreet = (o) => build(o, 2),
  buildGardosCloseup = (o) => build(o, 3);
export const gardosStudy = {
  id: 'gardos_tower',
  key: 'gardos_tower',
  title: 'Gardoš Tower',
  category: 'tower',
  wikidataId: 'Q5522644',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildGardosCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map evidence ©OpenStreetMap contributors, ODbL-1.0. Photographs viewed only; no copied pixels or inscriptions.',
  geometrySource: r.scope,
  sourceNotice: r.scope,
  importReason: r.scope,
  previewGround: scope.previewGround,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    'Two ordinary front/opposite photographs inspected. Retained exact-QID outline anchors the connected base, gallery, two turrets and main shaft;36m overall height is unqualified. Fine elevations/roof profile/window inventory and20degree/2m facing remain explicit estimates. No copied heraldry, photo atlas, snow, furnished interior, separate fortress ruins or whole-hill terrain model.',
  ],
  camera: scope.camera,
  qaCameras: [],
};
