import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildMaster,
  surfaces,
} from '../../../content/worldgen/source/places/tn/tn8/mameyand/models/bridge-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'mameyand';
const title = 'Mameyand Bridge';
const assetId = `molen.worldgen.structure.${id}`;
const recipe = 'models/bridge-model.mjs';
const module = `content/worldgen/source/places/tn/tn8/mameyand/${recipe}`;
const directory = structureSourceDirectory(id);
const check = process.argv.includes('--check');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selection && !selection.includes(id)) throw new Error('Unknown Mameyand Bridge selection');

const references = 'reference-observations.json';
const [observations, input, previous] = await Promise.all([
  readOptionalJson(resolve(directory, references)),
  readFile(resolve(directory, recipe)),
  readOptionalJson(resolve(directory, 'source.json')),
]);
const authoring = createArchitecturalSurfaceAuthoring(surfaces);
const geometry = new MeshBufferBuilder();
buildMaster(authoring.wrap(geometry));
const mesh = geometry.finalize();
validateAuthoredMesh(mesh, id);
const materials = authoring.materials(mesh.groups);
const bytes = Buffer.from(encodeGlb(mesh, materials, title));
const sha256 = hashBytes(bytes);
const actualBounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};
mesh.positions.forEach((value, i) => {
  const axis = i % 3;
  actualBounds.min[axis] = Math.min(actualBounds.min[axis], value);
  actualBounds.max[axis] = Math.max(actualBounds.max[axis], value);
});

const main = { name: 'river-elevation', position: [7.2, 2.9, 27], lookAt: [0, 3.5, 0], fov: 48 };
const cameras = [
  { name: 'opposite-elevation', position: [-5, 3.5, -26], lookAt: [0, 3.7, 0], fov: 48 },
  { name: 'deck-and-towers', position: [16, 11.7, 11], lookAt: [0, 5.3, 0], fov: 55 },
  { name: 'ashlar-and-arch-ring', position: [2.6, 2, 10.3], lookAt: [-1, 3, 0], fov: 57 },
];
const levels = {
  skyline: { export: 'buildSkyline', errorMeters: 0.36, surfaces },
  district: { export: 'buildDistrict', errorMeters: 0.16, surfaces },
  street: { export: 'buildStreet', errorMeters: 0.07, surfaces },
  closeup: { export: 'buildCloseup', errorMeters: 0.028, surfaces },
};
const { skyline, ...authoredLevels } = levels;
const spec = {
  id,
  planId: id,
  assetId,
  title,
  category: 'bridge',
  quality: 'detailed',
  wikidataId: 'Q5794125',
  referenceCoordinate: observations.villageReference,
  nativeAxes:
    '+X follows the deck and +Z faces the photographed elevation. Geographic heading remains unresolved.',
  visualBrief:
    'A compact three-vault brick bridge with a steep pointed central opening, two low side openings, pale squared-stone piers, a humped paved path and four tapered round marker towers.',
  size: actualBounds.max.map((value, axis) => value - actualBounds.min[axis]),
  actualBounds,
  referencePages: observations.references.map(({ url }) => url),
  geometrySource:
    'Original deterministic geometry based on published overall dimensions and photo-based profiles.',
  materialMethod:
    'Metric shared brick, ashlar, and rough stone with restrained vertex tint and no embedded images.',
  sharedSurfaces: materials.flatMap((material) =>
    material.sharedSurface ? [material.sharedSurface] : [],
  ),
  sourceGeometry: { module, export: 'buildMaster' },
  runtimeLodOverlay: {
    level: 'skyline',
    module,
    inputHash: hashEvidenceText(input),
    ...skyline,
    authoredLevels,
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'pending',
  reviewStatus: 'Visual and geographic evidence is tracked in qa.json.',
  limitations: [
    'The arch stations, tapered tower courses and ramp profiles are photo-based approximations.',
    'The candidate reference coordinate is the village. A matching crossing centerline, bearing and abutment grade are required for live placement.',
  ],
  mediumFiContext: { groundY: -0.36, scale: 1, focus: { center: [0, 3.7, 0] } },
  qaCameras: cameras,
  qaLodCameras: Object.keys(levels).map((level) => ({
    ...main,
    name: `${id}-${level}`,
    reviewLod: level,
  })),
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
  name: `${title} preview`,
  seed: id,
  tickRate: 30,
  camera: { mode: 'fixed', position: main.position, lookAt: main.lookAt, fov: main.fov },
  physics: { engine: 'none' },
  entities: [
    {
      id: 'structure',
      components: {
        transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
        renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
      },
    },
    {
      id: 'review-ground',
      components: {
        transform: { pos: [0, -0.46, 0], scale: [74, 0.2, 68], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#87918a',
          shadows: { receive: true },
        },
      },
    },
    {
      id: 'environment',
      components: {
        environment: {
          ambient: { sky: '#dce5ed', ground: '#716d62', intensity: 1.11 },
          sun: { direction: [-8, 14, 11], color: '#fff1d8', intensity: 2.03, castShadow: true },
          background: '#b5cdd9',
          toneMapping: 'agx',
          exposure: 1.03,
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
  title,
  files: {
    definitions: ['spec.json', 'scene.json'],
    models: [
      {
        path: 'models/source.glb',
        assetId,
        output: structureAssetSidecarPath(assetId),
        pipeline: 'import',
        sha256,
      },
    ],
    generators: [{ id, path: recipe }],
    scripts: [],
    textures: [],
    sounds: [],
    documents: [...new Set([references, ...(previous?.files?.documents ?? [])])],
  },
};

async function emit(name, value) {
  const path = resolve(directory, name);
  const data = Buffer.isBuffer(value) ? value : Buffer.from(biomeJson(value, path));
  if (check) assert.deepEqual(await readFile(path), data, `Stale source output: ${name}`);
  else await writeIndex(path, data);
}
await emit('models/source.glb', bytes);
await emit('spec.json', spec);
await emit('scene.json', scene);
await emit('source.json', source);
console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes; ${sha256}`);
