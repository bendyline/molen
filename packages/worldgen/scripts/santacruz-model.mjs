/** 'N0541': specific Santa Cruz west facade, pinnacles, nave and open cloister. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildSantaCruzMonastery } from './santacruz-monastery-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/ez/ez4/n0541_monastery_of_santa_cruz/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
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
    wall: linear('c8b18f'),
    trim: linear('f5eddd'),
    plaster: linear('e5e1d5'),
    roof: linear('b66e51'),
    inset: linear('4d5859'),
    door: linear('6c5840'),
    tile: linear('92a7bc'),
  };

export function sampleSantaCruzTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('SantaCruz geometry escaped retained grid');
  return (
    (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - b) +
    (h(0, 1) * (1 - a) + h(1, 1) * a) * b -
    fit.datumMeters
  );
}
function build(out, detail) {
  const emit = (role, ps, target) => {
    let p = ps.map((a) => a.map(Math.fround));
    if (normalFor(p[0], p[1], p[2]).reduce((n, v, i) => n + v * target[i], 0) < 0)
      p = p.toReversed();
    const color =
      detail === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
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
  };
  buildSantaCruzMonastery(emit, detail, r, sampleSantaCruzTerrain);
}
export const buildSantaCruzSkyline = (o) => build(o, 0),
  buildSantaCruzDistrict = (o) => build(o, 1),
  buildSantaCruzStreet = (o) => build(o, 2),
  buildSantaCruzCloseup = (o) => build(o, 3);
export const santacruzStudy = {
  id: 'N0541',
  key: 'monastery_of_santa_cruz',
  title: 'Monastery of Santa Cruz',
  category: 'temple',
  wikidataId: 'Q2499524',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 3),
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only; no pixels copied.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Deterministic specific Santa Cruz stone church facade, actual mapped nave and monastery with open cloister court. Faceted tower pinnacles, arched sculptural portal/grilled window, original simplified figures, open pointed cloister tracery and tiered fountain. Six existing shared256-square stone/plaster/tile/metal/wood graphs, metric UVs, linear tints and four browser levels; no embedded images or copied narrative tile/text atlas.',
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
    'Heights, hidden roofs, cloister bay counts/upper window grids, sculptural screen inventory, fountain details and exact thresholds are ordinary-picture/map approximations. No full ritual interior, copied inscription or narrative tile pictures. Town Hall, Cafe Santa Cruz, independent buildings, plaza fountain, separate Manga monument and native court/plaza ground remain host context.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
