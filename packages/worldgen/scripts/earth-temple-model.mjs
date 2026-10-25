/** temple_of_earth: square Fangze altar, Lingxing gateways and mapped Huangqi hall court. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildEarthTempleCeremony } from './earth-temple-ceremony-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/wx/wx4/temple_of_earth/',
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
    stone: linear('c7c3b6'),
    paving: linear('a2a298'),
    brick: linear('ca983e'),
    red: linear('b05843'),
    tile: linear('ca9e4f'),
    wood: linear('984d3f'),
    paint: linear('568b8a'),
    bronze: linear('555b50'),
  };

export function sampleEarthTempleTerrain(x, z) {
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
  buildEarthTempleCeremony(emit, detail, r, sampleEarthTempleTerrain);
}
export const buildEarthTempleSkyline = (o) => build(o, 0),
  buildEarthTempleDistrict = (o) => build(o, 1),
  buildEarthTempleStreet = (o) => build(o, 2),
  buildEarthTempleCloseup = (o) => build(o, 3);
export const earthTempleStudy = {
  id: 'temple_of_earth',
  key: 'temple_of_earth',
  title: 'Temple of Earth',
  category: 'temple',
  wikidataId: 'Q615178',
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
    'A deterministic site recipe and reusable Khmer geometry helpers build the specific square Fangze altar, open white stone gateways, red/yellow enclosures and mapped southern Huangqi hall court. Six reused256-square granite/brick/plaster/tile/wood/bronze graphs, metric UVs, linear tints and four authored browser levels; no embedded images or copied narrative atlas.',
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
    'Inner enclosure and terrace dimensions, gate allocations, ceremonial vessel inventory, hall heights and secondary facades are photo-led approximations within the mapped ceremonial core. Larger Ditan Park, distant park gateways and neighboring compounds remain host context. No copied readable inscriptions or exact ceremonial sculpture/paving survey is claimed.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
