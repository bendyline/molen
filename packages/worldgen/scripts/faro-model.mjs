/** N0635: El Faro compound, two separately angled shafts and connecting bridges. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildFaroTowers } from './faro-twin-towers-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/69/69y/n0635_el_faro_towers/',
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
    wall: linear('e1dfd4'),
    glass: [1, 1, 1],
    roof: linear('bbbcb4'),
    metal: linear('a2a8aa'),
  };
export function sampleFaroTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Faro Tower geometry escaped retained terrain');
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
  buildFaroTowers(emit, detail, r, sampleFaroTerrain);
}
export const buildFaroSkyline = (o) => build(o, 0),
  buildFaroDistrict = (o) => build(o, 1),
  buildFaroStreet = (o) => build(o, 2),
  buildFaroCloseup = (o) => build(o, 3);
export const faroStudy = {
  id: 'N0635',
  key: 'el_faro_towers',
  title: 'El Faro Towers',
  category: 'tower',
  wikidataId: 'Q526622',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildFaroCloseup,
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
    'Two ordinary front/reverse pictures were inspected. PMTiles160m/147..153m values have unqualified height provenance; lower bridge levels, floor rhythm, crowns and hidden reverse details are visualization estimates. Live OSM tags were rate limited. No exact-tag or surveyed height claim, copied photo atlas, neighboring tower or whole-block podium.',
  ],
  camera: scope.camera,
  qaCameras: [],
};
