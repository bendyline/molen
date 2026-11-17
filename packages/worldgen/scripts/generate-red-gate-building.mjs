import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildMaster,
  surfaces,
} from '../../../content/worldgen/source/places/uc/ucf/red_gate_building/models/red-gate-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'red_gate_building';
const title = 'Red Gate Building';
const assetId = `molen.worldgen.structure.${id}`;
const recipe = 'models/red-gate-model.mjs';
const module = `content/worldgen/source/places/uc/ucf/red_gate_building/${recipe}`;
const directory = structureSourceDirectory(id);
const check = process.argv.includes('--check');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selection && !selection.includes(id)) throw new Error('Unknown Red Gate Building selection');

const mapPath = 'map-frame.json';
const [mapBytes, recipeBytes, previous] = await Promise.all([
  readFile(resolve(directory, mapPath)),
  readFile(resolve(directory, recipe)),
  readOptionalJson(resolve(directory, 'source.json')),
]);
const map = JSON.parse(mapBytes);
const authoring = createArchitecturalSurfaceAuthoring(surfaces);
const builder = new MeshBufferBuilder();
buildMaster(authoring.wrap(builder));
const mesh = builder.finalize();
validateAuthoredMesh(mesh, id);
const materials = authoring.materials(mesh.groups);
const bytes = Buffer.from(encodeGlb(mesh, materials, title));
const sha256 = hashBytes(bytes);
const actualBounds = {
  min: [Infinity, Infinity, Infinity],
  max: [-Infinity, -Infinity, -Infinity],
};
mesh.positions.forEach((value, i) => {
  actualBounds.min[i % 3] = Math.min(actualBounds.min[i % 3], value);
  actualBounds.max[i % 3] = Math.max(actualBounds.max[i % 3], value);
});

const main = { name: 'square-elevation', position: [71, 59, 180], lookAt: [0, 66, -20], fov: 50 };
const cameras = [
  { name: 'rear-courtyard', position: [7, 37, -128], lookAt: [0, 62, -7], fov: 60 },
  { name: 'entrance-and-masonry', position: [-13, 8, 45], lookAt: [0, 9.7, 14], fov: 51 },
  { name: 'spire-and-limestone-crown', position: [38, 112, 49], lookAt: [0, 107, 0], fov: 47 },
  { name: 'metro-doors', position: [67, 2, -47], lookAt: [43, -2.4, -60], fov: 50 },
];
const levels = {
  skyline: { export: 'buildSkyline', errorMeters: 1.2, surfaces },
  district: { export: 'buildDistrict', errorMeters: 0.38, surfaces },
  street: { export: 'buildStreet', errorMeters: 0.16, surfaces },
  closeup: { export: 'buildCloseup', errorMeters: 0.045, surfaces },
};
const { skyline, ...authoredLevels } = levels;
const spec = {
  id,
  planId: id,
  collectionId: 'seven_sisters',
  assetId,
  title,
  category: 'tower',
  quality: 'detailed',
  wikidataId: 'Q1992056',
  referenceCoordinate: { longitude: 37.64953442, latitude: 55.7693928 },
  nativeAxes: map.axis,
  visualBrief:
    'A limestone high-rise with a brown granite Garden Ring portico, paired long residential wings around an open rear court, four corner loggias, tiered stone pinnacles, and a bronze star spire. The east wing carries the northern Metro door bank.',
  size: actualBounds.max.map((value, axis) => value - actualBounds.min[axis]),
  actualBounds,
  referencePages: [...map.references, map.sourceUrl],
  geometrySource:
    'Original deterministic geometry on the mapped parent and 27 parts. Photos govern the facade, height schedule and ornament.',
  materialMethod:
    'Metric shared limestone, granite, painted metal, copper and wood with locally colored inset glass. No embedded images.',
  sharedSurfaces: materials.flatMap((material) =>
    material.sharedSurface ? [material.sharedSurface] : [],
  ),
  sourceGeometry: { module, export: 'buildMaster' },
  runtimeLodOverlay: {
    level: 'skyline',
    module,
    inputHash: hashEvidenceText(recipeBytes),
    ...skyline,
    authoredLevels,
  },
  geographicProposal: {
    status: 'preview-proposal',
    anchor: map.anchor,
    heading: map.heading,
    bounds: map.bounds,
    source: map.sourceUrl,
    notes:
      'The mapped wings establish the Garden Ring front and the long court behind it. The east wing Metro entrances follow two PMTiles points along Kalanchevskaya.',
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis: map.terrainReference.basis,
    terrainReference: map.terrainReference,
    replaceFootprint: false,
    buildingCutout: {
      outline: map.geometry.outline,
      outlines: [
        map.geometry.outline,
        ...map.parts
          .filter(({ id }) => id === 35184577095033 || id === 35184577095052)
          .map(({ outline }) => outline),
      ],
      minimumCoverage: 0.93,
      basis:
        'Mapped U-shaped parent and the two eastern rear parts that extend outside it. The independent Metro pavilion and neighboring buildings retain their own geometry.',
    },
    mapGeometrySource: mapPath,
    mapGeometryHash: hashEvidenceText(mapBytes),
    mapGeometryLicense: map.license,
    mapGeometryAttribution: map.attribution,
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'pending',
  reviewStatus: 'Visual and geographic evidence is tracked in qa.json.',
  limitations: [
    'Window profiles, the stone crest, and bronze star are photo-proportioned exterior reconstructions.',
    'Standard viewer terrain controls the sidewalk and retaining base. The Metro model covers the exterior door bank.',
  ],
  mediumFiContext: { groundY: 0, scale: 1, focus: { center: [0, 60, -18] } },
  qaCameras: cameras,
  qaLodCameras: Object.keys(levels).map((level) => ({
    ...main,
    name: `${id.replaceAll('_', '-')}-${level}`,
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
        transform: { pos: [0, -0.1, 0], scale: [340, 0.2, 320], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#9ca09a',
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
    documents: [...new Set([mapPath, 'README.md', ...(previous?.files?.documents ?? [])])],
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
