/** temple_of_augustus_in_ankara: surviving Ankara cella, open portal, low rear remnants and steel conservation frame. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildAnkaraRuins } from './ankara-ruins-model.mjs';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sx/sxp/temple_of_augustus_in_ankara/',
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
    stone: linear('cac4b8'),
    trim: linear('d0c8b8'),
    rubble: linear('a39c8b'),
    brick: linear('aa7e67'),
    steel: linear('676e6b'),
  };

export function sampleAnkaraTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Ankara geometry escaped retained grid');
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
  buildAnkaraRuins(emit, detail, r, sampleAnkaraTerrain);
}
export const buildAnkaraSkyline = (o) => build(o, 0),
  buildAnkaraDistrict = (o) => build(o, 1),
  buildAnkaraStreet = (o) => build(o, 2),
  buildAnkaraCloseup = (o) => build(o, 3);
export const ankaraStudy = {
  id: 'temple_of_augustus_in_ankara',
  key: 'temple_of_augustus_in_ankara',
  title: 'Temple of Augustus in Ankara',
  category: 'temple',
  wikidataId: 'Q1640233',
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
    'A deterministic site recipe and reusable Khmer geometry helpers build the specific surviving open cella, portal and rear remnants with photo-led steel supports inside the mapped archaeological site. Four shared256-square stone/brick/painted-metal graphs, metric UVs, linear tints and four authored browser levels; no embedded images or copied narrative atlas.',
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
    'Cella, vestibule, rear remnants, broken drums and steel support subdivisions, heights and individual damage are picture-led approximations within the mapped archaeological site. Standard urban DEM does not resolve excavation floors or thresholds. The modern neighboring mosque stays independent native context. No intact ancient roof/colonnade, engineering survey, copied readable inscription or sculpture is claimed.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
