/** 'garden_house_yasnaya_polyana': Garden House — Yasnaya Polyana. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from '../../../../../../../../packages/worldgen/scripts/standard-materials.mjs';
import { buildGardenHouse } from './garden-house-yasnaya-polyana-geometry.mjs';

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
    wall: linear('b6b5a7'),
    upper: linear('aaa99b'),
    roof: linear('a34f4d'),
    trim: linear('817e70'),
    base: linear('797363'),
    wood: linear('827e70'),
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
      ['wall', 'trim', 'base', 'roof', 'wood', 'canvas', 'upper'].includes(role) &&
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
  buildGardenHouse(emit, detail, { ...r, datumMeters: fit.datumMeters });
}
export const buildGardenHouseSkyline = (o) => build(o, 0),
  buildGardenHouseDistrict = (o) => build(o, 1),
  buildGardenHouseStreet = (o) => build(o, 2),
  buildGardenHouseCloseup = (o) => build(o, 3);
export const gardenHouseStudy = {
  id: 'garden_house_yasnaya_polyana',
  key: 'garden_house_yasnaya_polyana',
  title: 'Garden House — Yasnaya Polyana',
  category: 'museum',
  wikidataId: 'Q749556',
  generationCommand:
    'node content/worldgen/source/places/uc/ucd/garden_house_yasnaya_polyana/models/generate-garden-house-yasnaya-polyana.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildGardenHouseCloseup,
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
    'models/generate-garden-house-yasnaya-polyana.mjs',
    'models/garden-house-yasnaya-polyana-model.mjs',
    'models/garden-house-yasnaya-polyana-geometry.mjs',
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
