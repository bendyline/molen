import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildMaster,
  surfaces,
} from '../../../content/worldgen/source/places/uc/ucf/hotel_ukraina/models/ukraina-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'hotel_ukraina';
const title = 'Hotel Ukraina';
const assetId = `molen.worldgen.structure.${id}`;
const recipe = 'models/ukraina-model.mjs';
const module = `content/worldgen/source/places/uc/ucf/hotel_ukraina/${recipe}`;
const directory = structureSourceDirectory(id);
const check = process.argv.includes('--check');
const selection = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selection && !selection.includes(id)) throw new Error('Unknown Hotel Ukraina selection');

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

const main = { name: 'square-elevation', position: [76, 71, 265], lookAt: [0, 90, -10], fov: 50 };
const cameras = [
  { name: 'rear-courtyard', position: [-66, 79, -221], lookAt: [0, 82, -17], fov: 52 },
  { name: 'entrance-and-masonry', position: [-19, 6.7, 72], lookAt: [0, 13.1, 34], fov: 54 },
  { name: 'octagonal-lantern-and-spire', position: [31, 148, 100], lookAt: [0, 161, 0], fov: 50 },
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
  wikidataId: 'Q2570624',
  referenceCoordinate: { longitude: 37.56420345, latitude: 55.75157853 },
  nativeAxes: map.axis,
  visualBrief:
    'A cream ashlar tower and paired long residential wings around a rear court, with arched bays, roof urns, a long graphite spire and star, and a low open steel canopy spanning the sloped arrival drive.',
  size: actualBounds.max.map((value, axis) => value - actualBounds.min[axis]),
  actualBounds,
  referencePages: [...map.references, map.sourceUrl],
  geometrySource:
    'Original deterministic geometry from the mapped hotel and residential ranges. Photographs govern the pavilion urns, crown profile, canopy frame and facade details.',
  materialMethod:
    'Metric shared limestone, granite, painted metal and copper with locally colored inset glass. No embedded images.',
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
      'The central lantern fixes the anchor. The entrance canopy faces the river, with a fitted sloped arrival driveway. The courtyard remains open between the residential ranges.',
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    groundContactReviewed: true,
    groundContactBasis: map.terrainReference.basis,
    terrainReference: map.terrainReference,
    replaceFootprint: false,
    buildingCutout: {
      outline: map.geometry.outline,
      outlines: map.parts.flatMap((p) => p.polygons.map((q) => q[0])),
      minimumCoverage: 0.93,
      basis:
        'Matched hotel and courtyard-wing polygons retain the adjacent buildings, waterfront and rear passage.',
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
    'The canopy frame, urns, window profiles and star are photo-proportioned.',
    'Standard viewer terrain supplies the entrance drive profile. The model depicts the permanent exterior.',
  ],
  mediumFiContext: { groundY: 0, scale: 1, focus: { center: [0, 92, -12] } },
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
