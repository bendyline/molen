/** Reconstitute 4 Times Square / One Five One entirely from checked-in controls and geometry. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFourTimesSquareLevel } from '../../../content/worldgen/source/places/dr/dr5/4_times_square/models/four-times-square-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = '4_times_square',
  assetId = 'molen.worldgen.structure.4_times_square',
  dir = structureSourceDirectory(id);
const selected = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selected && !selected.includes(id))
  throw Error('Unknown 4 Times Square / One Five One selection');
const check = process.argv.includes('--check'),
  brief = JSON.parse(await readFile(resolve(dir, 'model-brief.json'))),
  placement = JSON.parse(await readFile(resolve(dir, 'placement-draft.json'))),
  frame = await readFile(resolve(dir, 'map-frame.json'));
async function emit(path, bytes) {
  const old = await readFile(path).catch((e) => {
    if (e.code !== 'ENOENT') throw e;
  });
  if (check) assert(old?.equals(bytes), `Stale source output: ${path}`);
  else if (!old?.equals(bytes)) await writeIndex(path, bytes);
}
const json = (path, value) => emit(path, Buffer.from(biomeJson(value, path)));
const builder = new MeshBufferBuilder(),
  authoring = createArchitecturalSurfaceAuthoring(brief.surfaces);
buildFourTimesSquareLevel(authoring.wrap(builder), 'master');
const mesh = builder.finalize();
validateAuthoredMesh(mesh, id);
const materials = authoring.materials(mesh.groups),
  bytes = Buffer.from(encodeGlb(mesh, materials, brief.exportLabel)),
  sourceHash = hashBytes(bytes);
assert.equal(
  sourceHash,
  brief.expectedDraftMasterHash,
  'Preserve the explicitly pinned source master',
);
const oldManifest = await readOptionalJson(resolve(dir, 'source.json'));
const previous = await readFile(resolve(dir, 'models/source.glb')).catch((e) => {
  if (e.code !== 'ENOENT') throw e;
});
if (previous && oldManifest)
  assert.equal(hashBytes(previous), oldManifest.files.models[0].sha256, 'Preserve edited source');
const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
mesh.positions.forEach((v, i) => {
  bounds.min[i % 3] = Math.min(bounds.min[i % 3], v);
  bounds.max[i % 3] = Math.max(bounds.max[i % 3], v);
});
const size = bounds.max.map((v, i) => v - bounds.min[i]);
const spec = {
  planId: id,
  id,
  assetId,
  title: brief.title,
  category: 'skyscraper',
  quality: 'detailed',
  wikidataId: brief.wikidataId,
  referenceCoordinate: brief.referenceCoordinate,
  visualBrief: brief.visualBrief,
  size,
  actualBounds: bounds,
  nativeAxes: brief.nativeAxes,
  sourceFacts: brief.sourceFacts,
  referencePages: brief.references.map((r) => r.url),
  geographicProposal: {
    status: 'preview-proposal',
    anchor: placement.anchor,
    heading: placement.heading,
    elevationMode: 'sea-level',
    elevationMeters: 17,
    groundContactReviewed: true,
    groundContactBasis:
      'Complete low-parent foundation samples native terrain.17m rounded datum andoriginal curb/entry/accessibility levels are approximate,not surveyed.',
    groundModelY: 0,
    replaceFootprint: true,
    replaceRoads: placement.replaceRoads,
    bounds: placement.bounds,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frame),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors; Protomaps basemap',
    source: placement.source,
    wikidataId: brief.wikidataId,
    notes: placement.note,
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'pending',
  reviewStatus:
    'Generated source; current visual and geographic acceptance is recorded separately in qa.json.',
  geometrySource:
    'Original deterministic geometry from checked-in ordinary-picture observations, attributed map alignment and standard terrain samples; no downloaded meshes.',
  materialMethod:
    'Four existing shared window-grid,painted-metal,membrane andgranite graphs with metric UVs. No private or embedded image copies.',
  sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
  runtimeLodOverlay: brief.runtimeLodOverlay,
  mediumFiContext: brief.mediumFiContext,
  qaLodCameras: brief.qaLodCameras,
  limitations: brief.limitations,
  qaCameras: brief.cameras,
  importOptions: { optimize: false },
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: mesh.groups.length,
    bytes: bytes.length,
    sha256: sourceHash,
  },
};
const scene = {
  format: 'molen/scene@3',
  name: brief.title + ' preview',
  seed: id,
  tickRate: 30,
  entities: [
    {
      id: 'structure',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
      },
    },
    {
      id: 'ground',
      components: {
        transform: { pos: [0, -0.15, 0], scale: [256, 0.2, 256], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#6b929a',
          shadows: { receive: true },
        },
      },
    },
    ...(brief.reviewEntities ?? []),
    {
      id: 'environment',
      components: {
        environment: {
          ambient: { sky: '#dce5ed', ground: '#6c7473', intensity: 1.15 },
          sun: { direction: [-8, 14, 9], color: '#fff1d3', intensity: 2.2, castShadow: true },
          background: '#b5d2df',
          toneMapping: 'agx',
          exposure: 1.08,
          shadows: 'high',
        },
      },
    },
  ],
  camera: {
    mode: 'fixed',
    position: brief.cameras[0].position,
    lookAt: brief.cameras[0].lookAt,
    fov: brief.cameras[0].fov,
  },
  physics: { engine: 'none' },
};
const source = {
  format: 'molen/source-bundle@1',
  id: assetId,
  kind: 'static-structure',
  title: brief.title,
  files: {
    definitions: ['spec.json', 'scene.json', 'model-brief.json'],
    models: [
      {
        path: 'models/source.glb',
        assetId,
        output: structureAssetSidecarPath(assetId),
        pipeline: 'import',
        sha256: sourceHash,
      },
    ],
    generators: [{ id: 'four-times-square', path: 'models/four-times-square-model.mjs' }],
    scripts: [],
    textures: [],
    sounds: [],
    documents: [
      ...new Set([
        'README.md',
        'preview.png',
        'map-frame.json',
        'placement-draft.json',
        'layout.json',
        'mapped-parts.json',
        'pmtiles-map.json',
        'terrain-samples.json',
        'terrain-grid.json',
        'review-scope.json',
        'terrain-review.height.png',
        'terrain-review.terrain.json',
        ...(oldManifest?.files.documents ?? []),
      ]),
    ],
  },
};
// Terrain input names are declared from the preserved sampling record, never guessed.
const terrain = JSON.parse(await readFile(resolve(dir, 'terrain-grid.json')));
source.files.documents = source.files.documents
  .filter((p) => !p.startsWith('terrain/'))
  .concat(terrain.tiles.map((t) => 'terrain/' + t.path));
await mkdir(resolve(dir, 'models'), { recursive: true });
await emit(resolve(dir, 'models/source.glb'), bytes);
await json(resolve(dir, 'spec.json'), spec);
await json(resolve(dir, 'scene.json'), scene);
await json(resolve(dir, 'source.json'), source);
await emit(
  resolve(dir, 'README.md'),
  Buffer.from(
    '# 4 Times Square / One Five One\n\n![Molen preview](preview.png)\n\n' +
      brief.visualBrief +
      '\n\nRebuild original checked-in source with `node packages/worldgen/scripts/generate-four-times-square.mjs`;append `--check` for exact bytes. Import/LOD select `--ids=4_times_square`. GLBs are ignored outputs. Native Q687413 whole parent andindividual tower/corner/roof/mast parts fix orientation andscale. Independent One Bryant Park andcity context are excluded.\n\nFour existing shared256px graphs;no private/embedded textures. Detailed master andfour browser tiers remain separate. Native17m datum andall curb/entry/accessibility levels are approximate. Facade,door,sign,roof,mast/communications inventories are original photo-proportional reconstructions,not as-built verification;ads/branding/night lighting are not copied. Full scope/limits inmodel-brief.json andqa.json.\n\nOriginal geometry uses repository license. Maps:© OpenStreetMap contributors,ODbL-1.0;Protomaps. Terrain attribution/hashes:terrain-grid.json. Linked photographs are references only,not redistributed orused as textures.\n',
  ),
);
console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes; ${sourceHash}`);
