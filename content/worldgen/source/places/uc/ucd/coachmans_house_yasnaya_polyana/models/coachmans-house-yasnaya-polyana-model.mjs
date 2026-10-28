/** 'coachmans_house_yasnaya_polyana': Coachman’s House — Yasnaya Polyana. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from '../../../../../../../../packages/worldgen/scripts/standard-materials.mjs';
import { buildCoachman } from './coachmans-house-yasnaya-polyana-geometry.mjs';

const source = new URL('../', import.meta.url),
  read = (n) => JSON.parse(readFileSync(new URL(n, source), 'utf8')),
  frame = read('map-frame.json'),
  r = frame.reconstruction,
  scope = read('review-scope.json'),
  means = read('surface-means.json'),
  fit = read('pmtiles-fit.json');
const linear = (hex) =>
    hex.match(/../g).map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  palette = {
    wall: linear('b0a084'),
    trim: linear('a28c6d'),
    base: linear('c9bfa4'),
    roof: linear('b7a17a'),
    glass: linear('758980'),
    chimney: linear('f4ecdc'),
    wood: linear('74614c'),
  };

function build(out, detail) {
  const emit = (role, points, target) => {
    let ps = points.map((p) => p.map(Math.fround));
    const first = ps
      .slice(2)
      .map((p, i) => normalFor(ps[0], ps[i + 1], p))
      .find((n) => Math.hypot(...n) > 0.5);
    if (!first) return;
    if (first.reduce((n, v, k) => n + v * target[k], 0) < 0) ps = ps.toReversed();
    const repeat = MATERIAL_REPEAT_METERS[scope.surfaceOverrides[role].graph],
      tile = 1 / repeat[0],
      verticalTile = 1 / repeat[1],
      tint = palette[role],
      color = detail === 0 ? tint.map((v, k) => v * (means[role]?.[k] ?? 1)) : tint;
    if (
      detail &&
      ps.length === 4 &&
      ['wall', 'trim', 'base', 'roof', 'wood', 'canvas', 'chimney'].includes(role) &&
      Math.hypot(...normalFor(ps[0], ps[1], ps[2])) > 0.5 &&
      Math.hypot(...normalFor(ps[0], ps[2], ps[3])) > 0.5
    ) {
      const nx = target[0] * r.xAxis[0] + target[2] * r.xAxis[1],
        nz = target[0] * r.zAxis[0] + target[2] * r.zAxis[1];
      out.addQuad(
        role,
        'palette:#ffffff',
        ps,
        normalFor(...ps.slice(0, 3)),
        ps.map((p) => {
          const x = p[0] * r.xAxis[0] + p[2] * r.xAxis[1],
            z = p[0] * r.zAxis[0] + p[2] * r.zAxis[1];
          return Math.abs(target[1]) > 0.5
            ? [x * tile, z * tile]
            : [(Math.abs(nx) > Math.abs(nz) ? z : x) * tile, p[1] * verticalTile];
        }),
        color,
      );
      return;
    }
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
        t.map((p) => {
          const x = p[0] * r.xAxis[0] + p[2] * r.xAxis[1],
            z = p[0] * r.zAxis[0] + p[2] * r.zAxis[1],
            nx = target[0] * r.xAxis[0] + target[2] * r.xAxis[1],
            nz = target[0] * r.zAxis[0] + target[2] * r.zAxis[1];
          return Math.abs(target[1]) > 0.5
            ? [x * tile, z * tile]
            : [(Math.abs(nx) > Math.abs(nz) ? z : x) * tile, p[1] * verticalTile];
        }),
        color,
      );
    }
  };
  buildCoachman(emit, detail, { ...r, datumMeters: fit.datumMeters });
}
export const buildCoachmanSkyline = (o) => build(o, 0),
  buildCoachmanDistrict = (o) => build(o, 1),
  buildCoachmanStreet = (o) => build(o, 2),
  buildCoachmanCloseup = (o) => build(o, 3);
export const coachmanStudy = {
  id: 'coachmans_house_yasnaya_polyana',
  key: 'coachmans_house_yasnaya_polyana',
  title: 'Coachman’s House — Yasnaya Polyana',
  category: 'museum',
  wikidataId: 'Q749556',
  generationCommand:
    'node content/worldgen/source/places/uc/ucd/coachmans_house_yasnaya_polyana/models/generate-coachmans-house-yasnaya-polyana.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildCoachmanCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  brief: r.scope,
  reconstruction: r,
  sourceFacts: { horizontalBasis: r.identityBasis, architecturalHeights: r.heightBasis },
  scaleBasis: r.heightBasis,
  refs: [
    ...new Set(read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page)),
  ],
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceScripts: [
    'models/generate-coachmans-house-yasnaya-polyana.mjs',
    'models/coachmans-house-yasnaya-polyana-model.mjs',
    'models/coachmans-house-yasnaya-polyana-geometry.mjs',
  ],
  sourceLicense:
    'Original geometry under repository license; map evidence ©OpenStreetMap contributors, ODbL-1.0. Ordinary photographs viewed only; no copied pixels, event artwork or inscriptions.',
  geometrySource: r.scope,
  sourceNotice: r.scope,
  importReason: r.scope,
  previewGround: scope.previewGround,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: r.terrainBasis,
  limitations: [r.scope, r.identityBasis, r.heightBasis, r.terrainBasis],
  camera: scope.camera,
  qaCameras: [],
};
