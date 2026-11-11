/** Rebuild the Southern Bridge master and describe its four authored detail levels. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildMaster,
  layout,
  surfaces,
} from '../../../content/worldgen/source/places/ud/ud1/southern_bridge/models/bridge-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'southern_bridge';
const assetId = `molen.worldgen.structure.${id}`;
const dir = structureSourceDirectory(id);
const module = 'content/worldgen/source/places/ud/ud1/southern_bridge/models/bridge-model.mjs';
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selection && !selection.includes(id)) throw Error('Unknown Southern Bridge selection');
const check = process.argv.includes('--check');

const [brief, placement, frame, layoutBytes, recipeBytes, previous] = await Promise.all([
  readOptionalJson(resolve(dir, 'reference-observations.json')),
  readOptionalJson(resolve(dir, 'placement-draft.json')),
  readFile(resolve(dir, 'map-frame.json')),
  readFile(resolve(dir, 'layout.json')),
  readFile(resolve(dir, 'models/bridge-model.mjs')),
  readOptionalJson(resolve(dir, 'source.json')),
]);
assert.equal(layout.id, id);
assert.equal(placement.asset, assetId);
assert.deepEqual(placement.anchor, layout.anchor);
assert.equal(placement.heading, layout.heading);

const builder = new MeshBufferBuilder();
const authoring = createArchitecturalSurfaceAuthoring(surfaces);
buildMaster(authoring.wrap(builder));
const mesh = builder.finalize();
validateAuthoredMesh(mesh, id);
const materials = authoring.materials(mesh.groups);
const bytes = Buffer.from(encodeGlb(mesh, materials, `Molen original ${layout.title} master`));
const sha256 = hashBytes(bytes);
assert.equal(sha256, brief.expectedMasterHash);
const actualBounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};
mesh.positions.forEach((value, i) => {
  const axis = i % 3;
  actualBounds.min[axis] = Math.min(actualBounds.min[axis], value);
  actualBounds.max[axis] = Math.max(actualBounds.max[axis], value);
});

const camera = { position: [35, 122, 492], lookAt: [0, 17, 0], fov: 61 };
const spec = {
  id,
  planId: id,
  assetId,
  title: layout.title,
  category: 'bridge',
  quality: 'detailed',
  wikidataId: brief.wikidataId,
  referenceCoordinate: { longitude: layout.anchor[0], latitude: layout.anchor[1] },
  visualBrief: brief.visualBrief,
  nativeAxes:
    '+X runs northeast along the Daugava crossing, +Y is up, +Z is to the right looking northeast.',
  actualBounds,
  size: actualBounds.max.map((value, axis) => value - actualBounds.min[axis]),
  geometrySource:
    'Original deterministic geometry from mapped road and sidewalk axes, public exterior photos and standard Terrarium elevations.',
  materialMethod:
    'Shared board-formed concrete, plain concrete and painted metal with metric UVs and vertex tints.',
  sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
  referencePages: [...brief.photos.map((r) => r.page), brief.dimensionSource],
  geographicProposal: {
    status: 'preview-proposal',
    anchor: placement.anchor,
    heading: placement.heading,
    bounds: placement.bounds,
    minLevel: placement.minLevel,
    elevationMode: 'sea-level',
    elevationMeters: 0,
    orientationPolicy: 'approximate-visualization',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis:
      'Meter-scale elevations follow the Terrarium datum. Pier bases extend below the sampled river and bank terrain.',
    replaceFootprint: false,
    replaceRoads: placement.replaceRoads,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: hashEvidenceText(frame),
    mapGeometryLicense: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors; Protomaps basemap',
    source: placement.source,
    wikidataId: brief.wikidataId,
    notes: layout.limitations.join(' '),
  },
  sourceGeometry: { module, export: 'buildMaster', layoutHash: hashEvidenceText(layoutBytes) },
  runtimeLodOverlay: {
    level: 'skyline',
    module,
    export: 'buildSkyline',
    inputHash: hashBytes(
      Buffer.from(`${hashEvidenceText(layoutBytes)}\n${hashEvidenceText(recipeBytes)}`),
    ),
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'buildDistrict', errorMeters: 0.48, surfaces },
      street: { export: 'buildStreet', errorMeters: 0.19, surfaces },
      closeup: { export: 'buildCloseup', errorMeters: 0.08, surfaces },
    },
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'pending',
  reviewStatus: 'Current visual and geographic acceptance is recorded separately in qa.json.',
  limitations: layout.limitations,
  qaCameras: [{ name: 'daugava-crossing', ...camera }],
  importOptions: { optimize: false },
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: mesh.groups.length,
    bytes: bytes.length,
    sha256,
  },
};
const scene = {
  format: 'molen/scene@3',
  name: `${layout.title} preview`,
  seed: id,
  tickRate: 30,
  physics: { engine: 'none' },
  camera: { mode: 'fixed', ...camera },
  entities: [
    {
      id: 'bridge',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
      },
    },
    {
      id: 'river',
      components: {
        transform: {
          pos: [0, layout.waterSurface - 0.08, 0],
          scale: [1900, 0.15, 1500],
          rot: [0, 0, 0, 1],
        },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#53777c',
          shadows: { receive: true },
        },
      },
    },
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
};
const source = {
  format: 'molen/source-bundle@1',
  id: assetId,
  kind: 'static-structure',
  title: layout.title,
  files: {
    definitions: ['spec.json', 'scene.json', 'layout.json'],
    models: [
      {
        path: 'models/source.glb',
        assetId,
        output: structureAssetSidecarPath(assetId),
        pipeline: 'import',
        sha256,
      },
    ],
    generators: [{ id, path: 'models/bridge-model.mjs' }],
    scripts: [],
    textures: [],
    sounds: [],
    documents: [
      ...new Set([
        'README.md',
        'map-frame.json',
        'placement-draft.json',
        'map-fit.json',
        'reference-observations.json',
        ...(previous?.files.documents ?? []),
      ]),
    ],
  },
};
async function emit(path, data) {
  const old = await readFile(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) assert(old?.equals(data), `Stale source output: ${path}`);
  else if (!old?.equals(data)) await writeIndex(path, data);
}
if (!check) await mkdir(resolve(dir, 'models'), { recursive: true });
await emit(resolve(dir, 'models/source.glb'), bytes);
for (const [name, value] of [
  ['spec.json', spec],
  ['scene.json', scene],
  ['source.json', source],
]) {
  const path = resolve(dir, name);
  await emit(path, Buffer.from(biomeJson(value, path)));
}
console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${sha256}`);
