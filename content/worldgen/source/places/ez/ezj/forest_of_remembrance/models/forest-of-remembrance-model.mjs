import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { MATERIAL_REPEAT_METERS } from '../../../../../../../../packages/worldgen/scripts/standard-materials.mjs';
import { buildForest } from './forest-of-remembrance-geometry.mjs';

const source = new URL('../', import.meta.url);
const read = (name) => JSON.parse(readFileSync(new URL(name, source), 'utf8'));
const frame = read('map-frame.json');
const site = frame.reconstruction;
const scope = read('review-scope.json');
const means = read('surface-means.json');
const linear = (hex) =>
  hex.match(/../g).map((s) => {
    const v = parseInt(s, 16) / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
const palette = {
  granite: linear('a3a298'),
  gravel: linear('d9c8a9'),
  timber: linear('795345'),
  darkStone: linear('514b49'),
  water: linear('657c72'),
  turf: linear('7d8d57'),
  vegetation: [1, 1, 1],
};

function build(out, level) {
  buildForest(
    (role, vertices, target, shade = 1) => {
      const material = scope.surfaceOverrides[role];
      const repeat = MATERIAL_REPEAT_METERS[material.graph] ?? [1, 1];
      const tint = Array.isArray(shade) ? shade : palette[role].map((c) => Math.min(1, c * shade));
      const color = level ? tint : tint.map((c, k) => c * (means[role]?.[k] ?? 1));
      const uv = ([x, y, z]) =>
        Math.abs(target[1]) > 0.6
          ? [x / repeat[0], z / repeat[1]]
          : [(Math.abs(target[0]) > Math.abs(target[2]) ? z : x) / repeat[0], y / repeat[1]];
      const points = vertices.map((p) => p.map(Math.fround));
      for (let i = 1; i < points.length - 1; i++) {
        let triangle = [points[0], points[i], points[i + 1]];
        let normal = normalFor(...triangle);
        if (Math.hypot(...normal) < 0.5) continue;
        if (normal.reduce((s, v, k) => s + v * target[k], 0) < 0) {
          triangle = triangle.toReversed();
          normal = normal.map((v) => -v);
        }
        out.addTriangle(role, 'palette:#ffffff', triangle, normal, triangle.map(uv), color);
      }
    },
    level,
    site,
  );
}

export const buildForestSkyline = (out) => build(out, 0);
export const buildForestDistrict = (out) => build(out, 1);
export const buildForestStreet = (out) => build(out, 2);
export const buildForestCloseup = (out) => build(out, 3);

export const forestStudy = {
  id: 'forest_of_remembrance',
  key: 'forest_of_remembrance',
  title: 'Forest of Remembrance',
  category: 'monument',
  wikidataId: 'Q833213',
  generationCommand:
    'node content/worldgen/source/places/ez/ezj/forest_of_remembrance/models/generate-forest-of-remembrance.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: buildForestCloseup,
  surfaceOverrides: scope.surfaceOverrides,
  brief: site.scope,
  reconstruction: site,
  sourceFacts: { horizontalBasis: site.identityBasis, landscapeHeights: site.heightBasis },
  scaleBasis: site.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceScripts: [
    'models/generate-forest-of-remembrance.mjs',
    'models/forest-of-remembrance-geometry.mjs',
    'models/forest-of-remembrance-model.mjs',
  ],
  sourceLicense:
    'Original geometry under repository license. Map evidence from © OpenStreetMap contributors, ODbL-1.0. Photographs informed the reconstruction.',
  geometrySource: site.scope,
  importReason:
    'Preserve the individually modeled planting, bank faces, path grades and timber bridge rails.',
  previewGround: scope.previewGround,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: site.terrainBasis,
  limitations: scope.limitations,
  camera: scope.camera,
  qaCameras: [],
};
