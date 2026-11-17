/** Rebuild the separately georeferenced Chongar bridge assets. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as highway from '../../../content/worldgen/source/places/ub/ub0/chongar_e105_road_bridge/models/bridge-model.mjs';
import * as olderRoad from '../../../content/worldgen/source/places/ub/ub0/chongar_old_road_bridge/models/bridge-model.mjs';
import * as railway from '../../../content/worldgen/source/places/ub/ub0/chongar_railway_bridge/models/bridge-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const models = new Map([
  ['chongar_e105_road_bridge', highway],
  ['chongar_old_road_bridge', olderRoad],
  ['chongar_railway_bridge', railway],
]);
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',') ?? [...models.keys()];
const check = process.argv.includes('--check');
const recipe = 'models/bridge-model.mjs';
const mapPath = 'map-frame.json';

for (const id of selected) {
  const model = models.get(id);
  if (!model) throw Error(`Unknown Chongar bridge: ${id}`);
  const assetId = `molen.worldgen.structure.${id}`;
  const directory = structureSourceDirectory(id);
  const module = `content/worldgen/source/places/ub/ub0/${id}/${recipe}`;
  const [mapBytes, recipeBytes, previous] = await Promise.all([
    readFile(resolve(directory, mapPath)),
    readFile(resolve(directory, recipe)),
    readOptionalJson(resolve(directory, 'source.json')),
  ]);
  const frame = JSON.parse(mapBytes);
  const { title, design, appearance } = frame;
  const author = createArchitecturalSurfaceAuthoring(model.surfaces);
  const builder = new MeshBufferBuilder();
  model.buildMaster(author.wrap(builder));
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, id);
  const materials = author.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, title));
  const sha256 = hashBytes(bytes);
  const actualBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  mesh.positions.forEach((v, index) => {
    const axis = index % 3;
    actualBounds.min[axis] = Math.min(actualBounds.min[axis], v);
    actualBounds.max[axis] = Math.max(actualBounds.max[axis], v);
  });

  const first = design.stations[0][0],
    len = design.replaceRoads.length;
  const main = {
    name: 'shore-to-shore',
    position: [-len * 0.44, 26, len * 0.62],
    lookAt: [0, 1.5, 0],
    fov: 49,
  };
  const cameras = [
    {
      name: 'pier-and-girder',
      position: [-12, 2.55, design.width * 1.65 + 17],
      lookAt: [5, 2, 0],
      fov: 64,
    },
    {
      name: 'deck-and-approach',
      position: [first - 5, 7, 5.5],
      lookAt: [first + 43, 3.4, 0],
      fov: 57,
    },
    { name: 'channel-side', position: [39, 12, -len * 0.4], lookAt: [5, 3.25, 0], fov: 51 },
  ];
  const authoredLevels = {
    district: { export: 'buildDistrict', errorMeters: 0.75, surfaces: model.surfaces },
    street: { export: 'buildStreet', errorMeters: 0.23, surfaces: model.surfaces },
    closeup: { export: 'buildCloseup', errorMeters: 0.065, surfaces: model.surfaces },
  };
  const spec = {
    id,
    planId: id,
    collectionId: 'chongar_bridges',
    assetId,
    title,
    category: 'bridge',
    quality: 'detailed',
    wikidataId: 'Q30889174',
    mapFeatureId: frame.mappedIdentity.featureIds[0],
    referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
    appearance,
    nativeAxes: frame.axis,
    visualBrief: design.visualBrief,
    size: actualBounds.max.map((v, i) => v - actualBounds.min[i]),
    actualBounds,
    referencePages: [...frame.references, frame.sourceUrl],
    geometrySource:
      'Deterministic bridge geometry from independent mapped centerlines, shoreline elevation samples and dated exterior photographs.',
    materialMethod:
      'Metric UVs use shared concrete and painted metal. The railway adds shared ballast and timber. There are no embedded images.',
    sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
    sourceGeometry: { module, export: 'buildMaster' },
    runtimeLodOverlay: {
      level: 'skyline',
      module,
      inputHash: hashEvidenceText(recipeBytes),
      export: 'buildSkyline',
      errorMeters: 1.35,
      surfaces: model.surfaces,
      authoredLevels,
    },
    geographicProposal: {
      status: 'historical-proposal',
      reviewSurface: 'water',
      anchor: frame.anchor,
      heading: frame.heading,
      bounds: design.bounds,
      source: frame.sourceUrl,
      notes: design.placementNotes,
      orientationPolicy: 'approximate-visualization',
      mapIdentity: { maxDistance: 12 },
      elevationMode: 'sea-level',
      elevationMeters: 0,
      groundModelY: 0,
      groundContactReviewed: true,
      groundContactBasis: design.terrainBasis,
      replaceFootprint: false,
      replaceRoads: design.replaceRoads,
      mapGeometrySource: mapPath,
      mapGeometryHash: hashEvidenceText(mapBytes),
      mapGeometryLicense: frame.license,
      mapGeometryAttribution: frame.attribution,
      minLevel: 13,
    },
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus: 'Current visual and location evidence is recorded in qa.json.',
    limitations: [
      'Pier spacing, underside profiles and precise clearance are visual reconstructions. Terrain and water levels depend on the host data.',
      'This is a reconstruction at the dated exterior reference. Present-day use, damage and traffic are outside its scope.',
    ],
    mediumFiContext: { surface: 'water', groundY: 0, scale: 1, focus: { center: [0, 3, 0] } },
    qaCameras: cameras,
    qaLodCameras: ['skyline', ...Object.keys(authoredLevels)].map((level) => ({
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
        id: 'review-water',
        components: {
          transform: { pos: [0, -0.07, 0], scale: [270, 0.1, 190], rot: [0, 0, 0, 1] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#68979c',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#dce8eb', ground: '#817967', intensity: 1.1 },
            sun: { direction: [-9, 13, 8], color: '#fff2da', intensity: 2.12, castShadow: true },
            background: '#b5cdd9',
            toneMapping: 'agx',
            exposure: 1.02,
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
  for (const [name, value] of [
    ['models/source.glb', bytes],
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ]) {
    const path = resolve(directory, name),
      data = Buffer.isBuffer(value) ? value : Buffer.from(biomeJson(value, path));
    if (check) assert.deepEqual(await readFile(path), data, `Stale source output: ${name}`);
    else await writeIndex(path, data);
  }
  console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${sha256}`);
}
