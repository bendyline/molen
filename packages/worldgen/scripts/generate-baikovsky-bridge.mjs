/** Rebuild the dated, public-source Baikovsky Bridge model and its authoring metadata. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as model from '../../../content/worldgen/source/places/ub/ubk/baikovsky_bridge/models/bridge-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, readOptionalJson, writeIndex } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const id = 'baikovsky_bridge';
const assetId = `molen.worldgen.structure.${id}`;
const directory = structureSourceDirectory(id);
const recipe = 'models/bridge-model.mjs';
const mapPath = 'map-frame.json';
const module = `content/worldgen/source/places/ub/ubk/${id}/${recipe}`;
const [mapBytes, recipeBytes, previous] = await Promise.all([
  readFile(resolve(directory, mapPath)),
  readFile(resolve(directory, recipe)),
  readOptionalJson(resolve(directory, 'source.json')),
]);
const frame = JSON.parse(mapBytes);
const { title, evidence, design } = frame;
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

const main = { name: 'historic-crossing', position: [-26, 13, 43], lookAt: [0, -0.25, 9], fov: 61 };
const cameras = [
  { name: 'west-portal', position: [-6, -1.65, 28.5], lookAt: [0, -2.15, 20.8], fov: 67 },
  { name: 'barrel-interior', position: [0.7, -2.7, 17.5], lookAt: [-0.27, -2.27, 2.4], fov: 64 },
  { name: 'avenue-and-lanterns', position: [-18, 5.2, 10], lookAt: [3, 0.25, 17], fov: 64 },
];
const authoredLevels = {
  district: { export: 'buildDistrict', errorMeters: 0.45, surfaces: model.surfaces },
  street: { export: 'buildStreet', errorMeters: 0.15, surfaces: model.surfaces },
  closeup: { export: 'buildCloseup', errorMeters: 0.045, surfaces: model.surfaces },
};
const spec = {
  id,
  planId: id,
  assetId,
  title,
  category: 'bridge',
  quality: 'detailed',
  wikidataId: frame.mappedIdentity.wikidataId,
  referenceCoordinate: { longitude: frame.anchor[0], latitude: frame.anchor[1] },
  appearance: frame.appearance,
  nativeAxes: frame.axis,
  size: actualBounds.max.map((v, i) => v - actualBounds.min[i]),
  actualBounds,
  visualBrief:
    'A broad, shallow roadway crossing above a single brick barrel, with two sidewalks, iron railings, oil lanterns and curved return walls.',
  referencePages: [
    evidence.photograph.page,
    evidence.commemorativeRelief.page,
    evidence.openingSource,
    evidence.dimensionsSource,
    frame.sourceUrl,
  ],
  geometrySource:
    'The historic photograph and recorded widths define the deck and arch. The plaque relief informs the portal trim. PMTiles and standard terrain align the reconstructed avenue and grade.',
  materialMethod:
    'Metric UVs use shared brick, weathered limestone, granite, gravel and painted iron. Lamp panes use a small color material. No images are embedded.',
  sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
  sourceGeometry: { module, export: 'buildMaster' },
  runtimeLodOverlay: {
    level: 'skyline',
    module,
    inputHash: hashEvidenceText(recipeBytes),
    export: 'buildSkyline',
    errorMeters: 0.85,
    surfaces: model.surfaces,
    authoredLevels,
  },
  geographicProposal: {
    status: 'historical-proposal',
    anchor: frame.anchor,
    heading: frame.heading,
    bounds: frame.bounds,
    source: frame.sourceUrl,
    notes:
      'Mid-1870s reconstruction placed on the PMTiles avenue. Local cutouts reveal its two mouths while the historic model is resident.',
    orientationPolicy: 'approximate-visualization',
    elevationMode: 'terrain-contact',
    groundModelY: 0,
    terrainReference: {
      anchor: frame.anchor,
      modelHeight: 0,
      basis: 'The center of the mapped avenue defines the shared local grade datum.',
    },
    groundContactReviewed: true,
    groundContactBasis:
      'Three-metre bilinear fixture from the standard Terrarium terrain tiles. The model uses the anchor grade and per-section approach samples.',
    replaceFootprint: false,
    minLevel: 15,
    groundCutout: {
      outline: design.groundCutout,
      preservePaving: true,
      minHeight: design.floorY - 0.15,
      pavingOutlines: [
        [
          [-11.98, -design.barrelHalfLength + 0.02],
          [11.98, -design.barrelHalfLength + 0.02],
          [11.98, design.barrelHalfLength - 0.02],
          [-11.98, design.barrelHalfLength - 0.02],
        ],
      ],
      basis:
        'Open the barrel and apron areas. Mask present-day paving only under the historical road surface and sidewalks.',
    },
    buildingCutout: {
      outline: design.buildingCutout,
      basis:
        'Trim the intersecting mapped volume only inside the reconstructed east culvert mouth and its approach. This mask is dated to the historic placement.',
    },
    mapGeometrySource: mapPath,
    mapGeometryHash: hashEvidenceText(mapBytes),
    mapGeometryLicense: frame.license,
    mapGeometryAttribution: frame.attribution,
  },
  fidelityTarget: 'medium-fi',
  fidelityStatus: 'pending',
  reviewStatus: 'Current visual and location evidence is recorded in qa.json after review.',
  limitations: [
    'The date slot represents the mid-1870s photograph. The exact exposure date and original culvert portal positions, masonry section and grade are approximate.',
    'Surroundings use the host basemap. The analysis fits present terrain, with localized dated cutouts to show the lost ravine crossing.',
  ],
  mediumFiContext: { surface: 'urban', groundY: -4.18, scale: 1, focus: { center: [0, -0.65, 0] } },
  qaCameras: cameras,
  qaLodCameras: ['skyline', ...Object.keys(authoredLevels)].map((level) => ({
    ...main,
    name: `baikovsky-bridge-${level}`,
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
      id: 'review-floor',
      components: {
        transform: { pos: [0, -4.27, 0], scale: [95, 0.14, 104], rot: [0, 0, 0, 1] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#9c9280',
          shadows: { receive: true },
        },
      },
    },
    {
      id: 'environment',
      components: {
        environment: {
          ambient: { sky: '#dfebf0', ground: '#83715e', intensity: 1.12 },
          sun: { direction: [-8, 14, 11], color: '#fff0d5', intensity: 2.13, castShadow: true },
          background: '#b6cdd9',
          toneMapping: 'agx',
          exposure: 1.01,
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
  if (process.argv.includes('--check'))
    assert.deepEqual(await readFile(path), data, `Stale source output: ${name}`);
  else await writeIndex(path, data);
}
console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${sha256}`);
