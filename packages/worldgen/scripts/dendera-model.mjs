/** Primary Hathor temple draft; the Dendera complex remains incomplete. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildDenderaComplex } from './dendera-complex-model.mjs';
import { buildDenderaRoof } from './dendera-roof-model.mjs';
import { buildDenderaTemple, denderaCandidateId } from './dendera-temple-model.mjs';

const source = new URL(
    '../../../content/worldgen/source/places/ss/ssx/dendera_temple_complex/',
    import.meta.url,
  ),
  read = (n) => JSON.parse(readFileSync(new URL(n, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== denderaCandidateId)
  throw Error('Temple of Dendera source identity changed');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    stone: linear('cdb88c'),
    carved: linear('ab9875'),
    ceiling: linear('7799a2'),
    metal: linear('737974'),
    adobe: linear('bfa780'),
  };
function build(out, d) {
  const emit = (role, ps, target) => {
    let p = ps.map((a) => a.map(Math.fround));
    if (normalFor(p[0], p[1], p[2]).reduce((n, v, i) => n + v * target[i], 0) < 0)
      p = p.toReversed();
    const color =
      d === 0 ? palette[role].map((v, i) => v * (means[role]?.[i] ?? 1)) : palette[role];
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
  const templeEmit = (role, ps, n) =>
    emit(
      role,
      ps.map(([x, y, z]) => [x, y + (r.templeBaseY ?? 0), z]),
      n,
    );
  buildDenderaTemple(templeEmit, d, r);
  buildDenderaRoof(templeEmit, d, r);
  buildDenderaComplex(emit, d, r);
}
export const buildDenderaSkyline = (o) => build(o, 0),
  buildDenderaDistrict = (o) => build(o, 1),
  buildDenderaStreet = (o) => build(o, 2),
  buildDenderaCloseup = (o) => build(o, 3);
export const denderaStudy = {
  id: 'dendera_temple_complex',
  key: 'dendera_temple_complex',
  title: 'Dendera Temple complex',
  category: 'temple',
  wikidataId: 'Q735254',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only; no pixels copied.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  geometrySource: r.scope,
  sourceNotice:
    'Four registered recipes rebuild the complete exterior complex. Reused256-square material graphs, metric UVs and linear tints; no embedded images or unique atlas.',
  importReason: r.scope,
  previewGround: true,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    r.componentBasis,
    'Exterior medium-fi visualization. Exact individual reliefs, inscriptions, damage patterns, inner chambers and crypts are not reconstructed. Current render and site checks are required before acceptance.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  // The generator appends review-scope cameras once.
  qaCameras: [],
};
