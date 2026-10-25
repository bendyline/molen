/** towers_of_silence_in_yazd eastern member: roofless Maneckji dakhma, broken pit and supported approach. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildYazdEastDakhma } from './yazd-east-dakhma-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/tj/tjw/east_maneckji_tower_of_silence/',
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
    wall: linear('b8a184'),
    stone: linear('c3b095'),
    foot: linear('9e907d'),
    earth: linear('bb9973'),
    gravel: linear('cab797'),
  };
export function sampleYazdEastTerrain(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = (dx, dz) => g.heights[(j + dz) * g.width + i + dx];
  if (i < 0 || j < 0 || i + 1 >= g.width || j + 1 >= g.height)
    throw Error('Yazd eastern geometry escaped retained terrain');
  return (
    (h(0, 0) * (1 - a) + h(1, 0) * a) * (1 - b) +
    (h(0, 1) * (1 - a) + h(1, 1) * a) * b -
    fit.datumMeters
  );
}
function build(out, detail) {
  const emit = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    // Collapsed dome apex quads can start with a zero-area triangle. Orient from
    // the first real face so the inner cap still has a renderable underside.
    const initial = ps
      .slice(2)
      .map((p, i) => normalFor(ps[0], ps[i + 1], p))
      .find((normal) => Math.hypot(...normal) > 0.5);
    if (!initial) return;
    if (initial.reduce((n, v, i) => n + v * target[i], 0) < 0) ps = ps.toReversed();
    const tint = palette[role],
      color = detail === 0 ? tint.map((v, i) => v * (means[role]?.[i] ?? 1)) : tint;
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
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
  buildYazdEastDakhma(emit, detail, r, sampleYazdEastTerrain);
}
export const buildYazdEastSkyline = (o) => build(o, 0),
  buildYazdEastDistrict = (o) => build(o, 1),
  buildYazdEastStreet = (o) => build(o, 2),
  buildYazdEastCloseup = (o) => build(o, 3);
export const yazdEastStudy = {
  id: 'east_maneckji_tower_of_silence',
  key: 'east_maneckji_tower_of_silence',
  title: 'Maneckji Tower of Silence, Yazd (east)',
  category: 'tower',
  wikidataId: 'Q27702877',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildYazdEastCloseup,
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
    'Ordinary2016 exterior/2010 interior views carried through construction. Native outline/approach fix the eastern member independently. No qualified height; broken masonry, portal, plaster, pit and steps remain explicit approximations. No roof, complete historical exposure-grid, bodies/bones, other dakhma, lower precinct buildings, whole hill or copied image pixels.',
  ],
  camera: scope.camera,
  qaCameras: [],
};
