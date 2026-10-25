/** Luxor's specific exterior and source-authored browser levels. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { buildLuxorTemple, luxorCandidateId } from './luxor-temple-model.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/ss/ssx/luxor_temple/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source))),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json');
if (frame.candidateId !== luxorCandidateId) throw Error('Luxor source identity changed');
const linear = (hex) =>
  hex.match(/../g).map((s) => {
    const n = parseInt(s, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  });
const palette = {
  wall: linear('c9ab84'),
  stone: linear('ccb08d'),
  granite: linear('aa8d80'),
  flat: linear('b6a27e'),
  plaster: linear('e9e4d9'),
};
export function luxorGrade(x) {
  const a = r.grade;
  if (x <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++)
    if (x <= a[i][0])
      return a[i - 1][1] + ((a[i][1] - a[i - 1][1]) * (x - a[i - 1][0])) / (a[i][0] - a[i - 1][0]);
  return a.at(-1)[1];
}
function writer(out, d, posed = true) {
  return (role, points, target, tint) => {
    if (d === 0 && target[1] < -0.5) return;
    let p = points.map(([x, y, z]) => [x, y + (posed ? luxorGrade(x) : 0), z].map(Math.fround));
    const n = normalFor(p[0], p[1], p[2]);
    if (n.reduce((n, v, i) => n + v * target[i], 0) < 0) p = p.toReversed();
    const col = tint ?? palette[role],
      color = d === 0 ? col.map((v, i) => v * (means[role]?.[i] ?? 1)) : col;
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
}
function build(out, d) {
  buildLuxorTemple(writer(out, d), d, r);
  const f = writer(out, d, false);
  for (const p of d === 0 ? r.farGroundPanels : r.groundPanels) f('flat', p.points, p.normal);
}
export const buildLuxorSkyline = (o) => build(o, 0),
  buildLuxorDistrict = (o) => build(o, 1),
  buildLuxorStreet = (o) => build(o, 2),
  buildLuxorCloseup = (o) => build(o, 3);
export const luxorStudy = {
  id: 'luxor_temple',
  key: 'luxor_temple',
  title: 'Luxor Temple',
  category: 'temple',
  wikidataId: 'Q319841',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  reconstruction: r,
  scaleBasis: r.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only;no pixels redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  geometrySource:
    'Original source recipe follows specific mapped Luxor ranges and ordinary exterior photographs. Heights,ruin profiles,roof survival and small forms are explicitly estimated.',
  sourceNotice:
    'Four shared256²stone/lime-plaster graphs and one explicit matte floor constant;metricUVs and linear tints. No embedded images,unique atlas,photo textures,reliefs or copied lettering. Source and four browser levels rebuild from two registered recipes and retained source controls.',
  importReason: r.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    r.scope,
    r.identityBasis,
    r.heightBasis,
    r.terrainBasis,
    'Serapis ruin heights and Tripartite Shrine/Tetrastyl envelopes are approximate. Abu el-Haggag retains its independent mapped footprint and an approximate picture-guided raised exterior,dome and two minarets. Other nearby buildings remain native context. No fine sculpture,inscriptions,navigable interiors or surveyed thresholds.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    { name: 'entrance-wings-and-obelisk', position: [-124, 39, 43], lookAt: [-68, 11, -7] },
    { name: 'entrance-open-portal', position: [-108, 6, -5.9], lookAt: [-47, 4, -5.9] },
    { name: 'first-open-court', position: [-38, 42, 61], lookAt: [-35, 5, -3] },
    { name: 'mosque-raised-exterior', position: [-5, 34, 27], lookAt: [-45, 14, -20] },
    { name: 'seven-pair-colonnade', position: [-12, 8, 1.4], lookAt: [53, 12, 1.4] },
    { name: 'colonnade-capitals-and-beams', position: [32, 26, 30], lookAt: [23, 12, 1.4] },
    { name: 'second-court-peristyle', position: [92, 47, 64], lookAt: [84, 4, 1] },
    { name: 'rear-sanctuary-ranges', position: [194, 39, 45], lookAt: [143, 4, 0] },
    { name: 'serapis-open-range', position: [-171, 22, 43], lookAt: [-126, 3, 3] },
    { name: 'tetrastyl-and-forecourt', position: [-66, 21, 88], lookAt: [-33, 3, 61] },
    { name: 'whole-complex-plan', position: [20, 420, 1], lookAt: [20, 0, 0], fov: 43 },
  ].map((c) => {
    if (c.name === 'whole-complex-plan') return c;
    const dy = luxorGrade(c.lookAt[0]);
    return {
      ...c,
      position: [c.position[0], c.position[1] + dy, c.position[2]],
      lookAt: [c.lookAt[0], c.lookAt[1] + dy, c.lookAt[2]],
    };
  }),
};
