/** N0540: specific Metekhi stone church, triple apses, twelve-sided drum and pointed north porch. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildMetekhiChurch } from './metekhi-church-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/sz/szr/n0540_metekhi_church/',
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
    wall: linear('d3c1a4'),
    trim: linear('d8c7a8'),
    brick: linear('b89a82'),
    roof: linear('b3b7af'),
    inset: linear('6b6d68'),
    door: linear('74624f'),
    gold: linear('bdac82'),
  };

export function sampleMetekhiTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Metekhi geometry escaped retained grid');
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
  buildMetekhiChurch(emit, detail, r, sampleMetekhiTerrain);
}
export const buildMetekhiSkyline = (o) => build(o, 0),
  buildMetekhiDistrict = (o) => build(o, 1),
  buildMetekhiStreet = (o) => build(o, 2),
  buildMetekhiCloseup = (o) => build(o, 3);
export const metekhiStudy = {
  id: 'N0540',
  key: 'metekhi_church',
  title: 'Metekhi church',
  category: 'temple',
  wikidataId: 'Q20577625',
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
    'Deterministic specific Metekhi church geometry from seven matching parent/body/porch/apse/drum controls. Cross gables, three apses, real recessed apertures, twelve-sided arcaded drum, grey metal cone/cross and pointed north porch. Six existing shared256-square stone/brick/metal/wood graphs, metric UVs, linear tints and four browser levels; no embedded images or copied stone/text inventory.',
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
    'Roof/gable/apse heights, window stations, blind drum arcade, northern side-arch geometry, opposite porch side, archivolts, masonry patching and exact thresholds are ordinary-picture/map approximations. No full ritual interior or copied inscription/stone inventory. Natural river cliff, terrace, monument, water and independent buildings remain host context.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
