/** Rebuild the Bali Mandara Toll Road master and independently streamed bridge sections. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildCausewaySection,
  layout,
  surfaces,
} from '../../../content/worldgen/source/places/qw/qw3/bali_mandara_toll_road/models/causeway-model.mjs';
import { traceVerifiedAssetOutputs } from '../../../scripts/verified-asset-outputs.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { hashBytes, readOptionalJson, root, writeIndex } from './structure-model-files.mjs';
import { encodeSourceGeohash } from './structure-source-paths.mjs';

const folder = 'content/worldgen/source/places/qw/qw3';
const collection = 'bali_mandara_toll_road';
const streamedSections = [
  'bali_mandara_toll_road_benoa_shore',
  'bali_mandara_toll_road_benoa_interchange',
  'bali_mandara_toll_road_northern_viaduct',
  'bali_mandara_toll_road_airport_approach',
  'bali_mandara_toll_road_airport_interchange',
  'bali_mandara_toll_road_north_bay',
  'bali_mandara_toll_road_central_bay',
  'bali_mandara_toll_road_southern_bay',
  'bali_mandara_toll_road_southern_lanes',
  'bali_mandara_toll_road_nusa_dua_viaduct',
  'bali_mandara_toll_road_nusa_dua_shore',
];
assert.deepEqual(
  layout.sections.map(({ id }) => id),
  streamedSections,
);
const parent = resolve(root, folder, collection);
const check = process.argv.includes('--check');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const buildAll = !selected || selected.includes(collection);
const levels = { skyline: 1.3, district: 1.03, street: 0.31, closeup: 0.105 };
const levelExport = (level) => `build${level[0].toUpperCase()}${level.slice(1)}`;
const references = await readOptionalJson(resolve(parent, 'reference-observations.json'));
const layoutBytes = await readFile(resolve(parent, 'layout.json'));
const recipeHash = hashBytes(
  Buffer.from(
    [
      hashEvidenceText(layoutBytes),
      hashEvidenceText(await readFile(resolve(parent, 'models/causeway-model.mjs'))),
    ].join('\n'),
  ),
);
for (const id of selected ?? [])
  assert(id === collection || streamedSections.includes(id), `Unknown section ${id}`);
const verifiedOutputs = [];

async function emit(path, bytes) {
  const old = await readFile(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) assert(old?.equals(bytes), `Stale source output: ${path}`);
  else if (!old?.equals(bytes)) await writeIndex(path, bytes);
}
const json = (path, value) => emit(path, Buffer.from(biomeJson(value, path)));

function encode(name, build) {
  const builder = new MeshBufferBuilder();
  const authoring = createArchitecturalSurfaceAuthoring(surfaces);
  build(authoring.wrap(builder));
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, name);
  const materials = authoring.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, name));
  return { mesh, materials, bytes, sha256: hashBytes(bytes) };
}

for (const section of layout.sections) {
  const { id, title } = section;
  if (!buildAll && !selected.includes(id)) continue;
  const assetId = `molen.worldgen.structure.${id}`;
  const cell = encodeSourceGeohash(...section.anchor);
  const place = `content/worldgen/source/places/${cell.slice(0, 2)}/${cell}`;
  const dir = resolve(root, place, id);
  const draft = await readOptionalJson(resolve(dir, 'placement-draft.json'));
  const frame = await readFile(resolve(dir, 'map-frame.json'));
  assert.equal(draft.asset, assetId);
  assert.deepEqual(draft.anchor, section.anchor);
  assert.equal(draft.heading, section.heading);
  const master = encode(`Molen original ${title} master`, (out) =>
    buildCausewaySection(out, 'master', id),
  );
  const { mesh, bytes, sha256, materials } = master;
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  mesh.positions.forEach((value, index) => {
    const axis = index % 3;
    bounds.min[axis] = Math.min(bounds.min[axis], value);
    bounds.max[axis] = Math.max(bounds.max[axis], value);
  });
  const size = bounds.max.map((value, axis) => value - bounds.min[axis]);
  const module = `${place}/${id}/models/causeway-model.mjs`;
  const camera = {
    position: [
      Math.min(-38, bounds.min[0] * 0.11),
      bounds.max[1] + 32,
      Math.max(66, size[2] * 0.44),
    ],
    lookAt: [0, (bounds.max[1] + bounds.min[1]) / 2, 0],
    fov: 53,
  };
  const visualBrief =
    'Separate asphalt carriageways and motorcycle decks follow the curved Bali Mandara alignment. Twin concrete piles, headstocks, pale parapets and raised interchange lanes carry the roadway across Benoa Bay.';
  const spec = {
    id,
    planId: collection,
    collectionId: collection,
    assetId,
    title: draft.title,
    category: 'bridge',
    quality: 'detailed',
    wikidataId: references.wikidataId,
    referenceCoordinate: { longitude: draft.anchor[0], latitude: draft.anchor[1] },
    visualBrief,
    nativeAxes:
      '+X points east, +Y is up, and +Z points south. Each deck traces its own PMTiles alignment.',
    actualBounds: bounds,
    size,
    geometrySource:
      'Original deterministic exterior geometry from ordinary photographs and OpenStreetMap carriageways via Protomaps PMTiles, with Terrarium terrain samples.',
    materialMethod:
      'Shared board-formed concrete, plain concrete and painted metal with metric UVs and vertex tints.',
    sharedSurfaces: materials.flatMap((material) =>
      material.sharedSurface ? [material.sharedSurface] : [],
    ),
    referencePages: references.pages,
    geographicProposal: {
      status: draft.status === 'preview' ? 'preview-proposal' : 'draft-proposal',
      anchor: draft.anchor,
      heading: draft.heading,
      bounds: draft.bounds,
      minLevel: draft.minLevel,
      elevationMode: 'sea-level',
      elevationMeters: 0,
      orientationPolicy: 'approximate-visualization',
      groundModelY: 0,
      groundContactReviewed: draft.status === 'preview',
      groundContactBasis:
        'The section uses absolute deck and footing heights fitted to standard Terrarium samples.',
      replaceFootprint: false,
      replaceRoads: draft.replaceRoads,
      mapIdentity: draft.mapIdentity,
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(frame),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors; Protomaps basemap',
      wikidataId: references.wikidataId,
      source: draft.source,
      notes:
        'Each section follows its mapped road lines. Lane widths, pier stations, and absolute deck elevations are visual estimates.',
    },
    sourceGeometry: { module, export: 'buildMaster', layoutHash: hashEvidenceText(layoutBytes) },
    runtimeLodOverlay: {
      level: 'skyline',
      module,
      export: levelExport('skyline'),
      inputHash: recipeHash,
      errorMeters: levels.skyline,
      surfaces,
      authoredLevels: Object.fromEntries(
        Object.entries(levels)
          .slice(1)
          .map(([level, errorMeters]) => [
            level,
            { export: levelExport(level), surfaces, errorMeters },
          ]),
      ),
    },
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus: 'Current visual and placement acceptance is recorded separately.',
    limitations: layout.limitations,
    qaCameras: [{ name: 'section', ...camera }],
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
    name: `${draft.title} preview`,
    seed: id,
    tickRate: 30,
    physics: { engine: 'none' },
    camera: { mode: 'fixed', ...camera },
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'water',
        components: {
          transform: { pos: [0, -0.15, 0], rot: [0, 0, 0, 1], scale: [5000, 0.2, 5000] },
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
  const sourcePath = resolve(dir, 'source.json');
  const old = await readOptionalJson(sourcePath);
  if (!check) await mkdir(resolve(dir, 'models'), { recursive: true });
  const glbPath = resolve(dir, 'models/source.glb');
  await emit(glbPath, bytes);
  verifiedOutputs.push(glbPath);
  await json(resolve(dir, 'spec.json'), spec);
  await json(resolve(dir, 'scene.json'), scene);
  await json(sourcePath, {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: draft.title,
    files: {
      definitions: ['spec.json', 'scene.json', 'placement-draft.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: `assets/places/${cell.slice(0, 2)}/${cell}/${id}/asset.json`,
          pipeline: 'import',
          sha256,
        },
      ],
      generators: [{ id, path: 'models/causeway-model.mjs' }],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [...new Set(['README.md', 'map-frame.json', ...(old?.files.documents ?? [])])],
    },
  });
  console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes`);
}
if (!check) await traceVerifiedAssetOutputs(verifiedOutputs);
