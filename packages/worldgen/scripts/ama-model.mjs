/** N0527: reproducible granite entrance, red arch hall and pagoda compound. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildAmaTemple } from './ama-temple-model.mjs';
import { cross, normalFor } from './authored-structure-mesh.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/we/web/n0527_a_ma_temple/',
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
    stone: linear('ccc7b8'),
    plaster: linear('b2736c'),
    timber: linear('a85e51'),
    roof: linear('6d9982'),
    grayRoof: linear('8d9489'),
    gold: linear('c9ad60'),
    lantern: linear('c95c51'),
  };

export function sampleAmaTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Ama geometry escaped retained grid');
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
  buildAmaTemple(emit, detail, r);
}
export const buildAmaSkyline = (o) => build(o, 0),
  buildAmaDistrict = (o) => build(o, 1),
  buildAmaStreet = (o) => build(o, 2),
  buildAmaCloseup = (o) => build(o, 3);
export const amaStudy = {
  id: 'N0527',
  key: 'a_ma_temple',
  title: 'A-Ma Temple',
  category: 'temple',
  wikidataId: 'Q2149114',
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
    'Two registered recipes build the mapped main compound and northern entrance: red round-arch hall, lattice openings, upturned green/grey roofs, slender tiered pagoda, granite gate, ridge figures/pearl, lanterns, lions and separate hillside approaches. Five reused256² graphs, metric UVs, linear tints, no embedded images or unique atlas. Internal hall/terrace allocations and fine decoration are explicit approximations.',
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
    'Main compound and northern entrance controls are retained; hall/court subdivisions, terrace levels, pagoda tier dimensions and fine carvings are picture-led approximations. Exact lettering, porcelain sculpture, guardian anatomy, dense interior furnishings and temporary event trussing are omitted.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
