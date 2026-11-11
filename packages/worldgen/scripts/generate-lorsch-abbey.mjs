/** Rebuild the two independently placed Lorsch World Heritage source masters. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as early from '../../../content/worldgen/source/places/u0/u0y/altenmunster_lorsch/models/model.mjs';
import * as abbey from '../../../content/worldgen/source/places/u0/u0y/lorsch_abbey_torhalle_and_church/models/model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const recipes = new Map([
  ['lorsch_abbey_torhalle_and_church', abbey],
  ['altenmunster_lorsch', early],
]);
const collection = 'abbey_and_altenmunster_of_lorsch';
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (selected?.some((id) => id !== collection && !recipes.has(id)))
  throw new Error('Unknown Lorsch member selection');
const check = process.argv.includes('--check');

async function emit(path, data) {
  const current = await readFile(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) assert(current?.equals(data), `Stale source output: ${path}`);
  else if (!current?.equals(data)) await writeIndex(path, data);
}
for (const [id, { layout, surfaces, buildMaster }] of recipes) {
  if (selected && !selected.includes(id) && !selected.includes(collection)) continue;
  const assetId = `molen.worldgen.structure.${id}`;
  const dir = structureSourceDirectory(id);
  const module = `content/worldgen/source/places/u0/u0y/${id}/models/model.mjs`;
  const [brief, placement, frame, layoutBytes, recipeBytes, previous] = await Promise.all([
    readOptionalJson(resolve(dir, 'reference-observations.json')),
    readOptionalJson(resolve(dir, 'placement-draft.json')),
    readFile(resolve(dir, 'map-frame.json')),
    readFile(resolve(dir, 'layout.json')),
    readFile(resolve(dir, 'models/model.mjs')),
    readOptionalJson(resolve(dir, 'source.json')),
  ]);
  assert.equal(layout.id, id);
  assert.equal(layout.collectionId, collection);
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
  assert.equal(sha256, brief.expectedDraftMasterHash);
  const actualBounds = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  mesh.positions.forEach((value, i) => {
    const axis = i % 3;
    actualBounds.min[axis] = Math.min(actualBounds.min[axis], value);
    actualBounds.max[axis] = Math.max(actualBounds.max[axis], value);
  });

  const spec = {
    id,
    planId: id,
    assetId,
    title: layout.title,
    category: 'museum',
    quality: 'detailed',
    collectionId: collection,
    mapFeatureId: layout.featureId,
    wikidataId: layout.wikidataId,
    referenceCoordinate: { longitude: layout.anchor[0], latitude: layout.anchor[1] },
    visualBrief: brief.visualBrief,
    nativeAxes: JSON.parse(frame).axis,
    actualBounds,
    size: actualBounds.max.map((value, i) => value - actualBounds.min[i]),
    geometrySource:
      'Original deterministic geometry from PMTiles, exterior photography and standard Terrarium elevations.',
    materialMethod: 'Shared architectural material graphs use metric UVs and vertex colors.',
    sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
    referencePages: brief.references.map((r) => r.url),
    geographicProposal: {
      status: 'preview-proposal',
      anchor: placement.anchor,
      heading: placement.heading,
      bounds: placement.bounds,
      minLevel: placement.minLevel,
      elevationMode: 'sea-level',
      elevationMeters: placement.elevation,
      orientationPolicy: 'approximate-visualization',
      mapIdentity: { maxDistance: layout.key === 'abbey' ? 70 : 45 },
      groundModelY: 0,
      groundContactReviewed: true,
      groundContactBasis:
        'The site datum and foundations follow sampled native Terrarium grades and the fitted model approaches.',
      replaceFootprint: placement.replaceFootprint,
      ...(placement.buildingCutout ? { buildingCutout: placement.buildingCutout } : {}),
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(frame),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors; Protomaps basemap',
      source: placement.source,
      wikidataId: layout.wikidataId,
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
      errorMeters: 0.65,
      surfaces,
      authoredLevels: {
        district: { export: 'buildDistrict', errorMeters: 0.24, surfaces },
        street: { export: 'buildStreet', errorMeters: 0.1, surfaces },
        closeup: { export: 'buildCloseup', errorMeters: 0.03, surfaces },
      },
    },
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus: 'Current visual and geographic acceptance is recorded in qa.json.',
    limitations: layout.limitations,
    qaCameras: brief.cameras,
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
    camera: { mode: 'fixed', ...brief.cameras[0] },
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
          transform: { pos: [0, -1.3, -22], scale: [115, 0.15, 170], rot: [0, 0, 0, 1] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#858c6f',
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
      generators: [{ id, path: 'models/model.mjs' }],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          'README.md',
          'map-frame.json',
          'placement-draft.json',
          'map-fit.json',
          'map-z15.json',
          'terrain-grid.json',
          'reference-observations.json',
          ...(previous?.files.documents ?? []),
        ]),
      ],
    },
  };
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
}
