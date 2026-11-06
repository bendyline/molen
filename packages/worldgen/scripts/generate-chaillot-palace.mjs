/** Reconstitute Chaillot Palace entirely from checked-in controls and geometry. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildChaillotLevel } from '../../../content/worldgen/source/places/u0/u09/chaillot_palace/models/chaillot-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'chaillot_palace',
  assetId = 'molen.worldgen.structure.chaillot_palace',
  dir = structureSourceDirectory(id);
const selected = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selected && !selected.includes(id)) throw Error('Unknown Chaillot Palace selection');
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
buildChaillotLevel(authoring.wrap(builder), 'master');
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
  category: 'palace',
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
    elevationMeters: 66,
    groundContactReviewed: true,
    groundContactBasis: brief.heightPolicy,
    groundModelY: 0,
    replaceFootprint: true,
    buildingCutout: placement.buildingCutout,
    groundCutout: placement.groundCutout,
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
    'Five existing shared256px limestone,granite,gravel,painted metal andwindow grid graphs. No private or embedded images.',
  sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
  runtimeLodOverlay: brief.runtimeLodOverlay,
  mediumFiContext: brief.mediumFiContext,
  qaLodCameras: brief.qaLodCameras,
  limitations: brief.limitations,
  qaCameras: brief.cameras.slice(1),
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
        transform: { pos: [0, -4.55, 0], scale: [700, 0.2, 500], rot: [0, 0, 0, 1] },
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
    generators: [{ id: 'chaillot_palace', path: 'models/chaillot-model.mjs' }],
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
        'reference-observations.json',
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
  .concat(terrain.tiles.map((t) => 'terrain/' + t.path))
  .sort();
await mkdir(resolve(dir, 'models'), { recursive: true });
await emit(resolve(dir, 'models/source.glb'), bytes);
await json(resolve(dir, 'spec.json'), spec);
await json(resolve(dir, 'scene.json'), scene);
await json(resolve(dir, 'source.json'), source);
await emit(
  resolve(dir, 'README.md'),
  Buffer.from(
    '# Chaillot Palace\n\n![Molen preview](preview.png)\n\n' +
      brief.visualBrief +
      '\n\nRebuild: `node packages/worldgen/scripts/generate-chaillot-palace.mjs`;append `--check` for exact source bytes. Select import/LOD/placement with `--ids=chaillot_palace`. Detailed source and four browser tiers are separate ignored GLB outputs.\n\n' +
      brief.limitations.join('\n\n') +
      '\n\nOriginal geometry:repository license. Map:© OpenStreetMap contributors,ODbL-1.0;Protomaps. Standard terrain:terrain-grid.json. Ordinary pictures stay local and are not redistributed or used as textures. Current acceptance:qa.json.\n',
  ),
);
console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes; ${sourceHash}`);
