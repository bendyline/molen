/** kapaleeshwarar_temple: specific Kapaleeshwarar gateways, shrine roofs and open mandapas. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildKapaliTemple } from './kapali-temple-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/tf/tf3/kapaleeshwarar_temple/',
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
    stone: linear('b9b6aa'),
    wall: linear('dfd7c2'),
    blue: linear('91aabd'),
    rose: linear('b8756f'),
    green: linear('94ae96'),
    roof: linear('c1bbb0'),
    gold: linear('d2b978'),
    door: linear('947969'),
  };

export function sampleKapaliTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Kapali geometry escaped retained grid');
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
  buildKapaliTemple(emit, detail, r, sampleKapaliTerrain);
}
export const buildKapaliSkyline = (o) => build(o, 0),
  buildKapaliDistrict = (o) => build(o, 1),
  buildKapaliStreet = (o) => build(o, 2),
  buildKapaliCloseup = (o) => build(o, 3);
export const kapaliStudy = {
  id: 'kapaleeshwarar_temple',
  key: 'kapaleeshwarar_temple',
  title: 'Kapaleeshwarar Temple',
  category: 'temple',
  wikidataId: 'Q1587164',
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
    'Deterministic twelve-envelope Kapaleeshwarar core, tall seven-tier eastern and smaller western gateways with real passages, original painted sculpture vocabulary, two shrine roof masses, open stone mandapas, striped parapets and brass flagstaff. Five existing shared256-square material graphs, metric UVs, linear tints and four browser levels; no embedded images or copied relief/text.',
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
    'Mapped core roof envelopes establish approximate horizontal fit. Shrine/cella allocation, tower heights and ornaments, hidden roofs, column grid, parapet rhythm, sculpture inventory and exact thresholds remain picture/map approximations. No copied deity/narrative/text atlas or full ritual interior. Open courts, tank water, streets, trees and independent buildings remain host context.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [],
};
