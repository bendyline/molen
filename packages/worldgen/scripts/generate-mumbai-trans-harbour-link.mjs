/** Rebuild the Atal Setu master and independently streamed bridge sections. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  buildAssembly,
  buildBridgeSection,
  layout,
  surfaces,
} from '../../../content/worldgen/source/places/te/te7/mumbai_trans_harbour_link/models/bridge-model.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { hashBytes, readOptionalJson, root, writeIndex } from './structure-model-files.mjs';

const folder = 'content/worldgen/source/places/te/te7';
const collection = 'mumbai_trans_harbour_link';
const streamedSections = [
  'mumbai_trans_harbour_link_sewri',
  'mumbai_trans_harbour_link_mudflats',
  'mumbai_trans_harbour_link_tata_channels',
  'mumbai_trans_harbour_link_thane_west',
  'mumbai_trans_harbour_link_thane_channel',
  'mumbai_trans_harbour_link_thane_east',
  'mumbai_trans_harbour_link_panvel_channel',
  'mumbai_trans_harbour_link_nhava_west',
  'mumbai_trans_harbour_link_nhava_east',
  'mumbai_trans_harbour_link_shivaji_nagar',
  'mumbai_trans_harbour_link_chirle',
  'mumbai_trans_harbour_link_ramp_01',
  'mumbai_trans_harbour_link_ramp_02',
  'mumbai_trans_harbour_link_ramp_03',
  'mumbai_trans_harbour_link_ramp_04',
  'mumbai_trans_harbour_link_ramp_05',
  'mumbai_trans_harbour_link_ramp_06',
  'mumbai_trans_harbour_link_ramp_07',
  'mumbai_trans_harbour_link_ramp_08',
  'mumbai_trans_harbour_link_ramp_09',
  'mumbai_trans_harbour_link_ramp_10',
  'mumbai_trans_harbour_link_ramp_11',
  'mumbai_trans_harbour_link_ramp_12',
  'mumbai_trans_harbour_link_ramp_13',
];
const parent = resolve(root, folder, collection);
const check = process.argv.includes('--check');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const buildAll = !selected || selected.includes(collection);
const levels = { skyline: 1.7, district: 0.45, street: 0.27, closeup: 0 };
const levelExport = (level) => `build${level[0].toUpperCase()}${level.slice(1)}`;
const references = await readOptionalJson(resolve(parent, 'reference-observations.json'));
const layoutBytes = await readFile(resolve(parent, 'layout.json'));
const recipeHash = hashBytes(
  Buffer.from(
    [
      hashEvidenceText(layoutBytes),
      hashEvidenceText(await readFile(resolve(parent, 'models/bridge-model.mjs'))),
    ].join('\n'),
  ),
);
assert.deepEqual(
  layout.sections.map(({ id }) => id),
  streamedSections,
);
for (const id of selected ?? [])
  assert(id === collection || streamedSections.includes(id), `Unknown section ${id}`);

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
  const dir = resolve(root, folder, id);
  const draft = await readOptionalJson(resolve(dir, 'placement-draft.json'));
  const frame = await readFile(resolve(dir, 'map-frame.json'));
  assert.equal(draft.asset, assetId);
  assert.deepEqual(draft.anchor, section.anchor);
  assert.equal(draft.heading, section.heading);
  const master = encode(`Molen original ${title} master`, (out) =>
    buildBridgeSection(out, 'master', id),
  );
  const { mesh, bytes, sha256, materials } = master;
  const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  mesh.positions.forEach((value, index) => {
    const axis = index % 3;
    bounds.min[axis] = Math.min(bounds.min[axis], value);
    bounds.max[axis] = Math.max(bounds.max[axis], value);
  });
  const size = bounds.max.map((value, axis) => value - bounds.min[axis]);
  const module = `${folder}/${id}/models/bridge-model.mjs`;
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
    section.kind === 'ramp'
      ? 'The separately mapped elevated interchange ramp has a concrete deck and its own pier row, with parapet openings at connected merges.'
      : 'The two mapped carriageways have separate box girders and piers, striped barriers and median lamps. The channel sections preserve the longer steel spans.';
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
      '+X follows the section chord, +Y is up, +Z is the right side of +X in the placement frame.',
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
      mapIdentity: { maxDistance: section.kind === 'ramp' ? 5 : 20 },
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(frame),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors; Protomaps basemap',
      wikidataId: references.wikidataId,
      source: draft.source,
      notes:
        'Placement follows the authored bounds and paired map axes. Deck elevations, pier stations and steel-span extents are visual estimates.',
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
    limitations: layout.scope.limits,
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
  await emit(resolve(dir, 'models/source.glb'), bytes);
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
          output: `assets/places/te/te7/${id}/asset.json`,
          pipeline: 'import',
          sha256,
        },
      ],
      generators: [{ id, path: 'models/bridge-model.mjs' }],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [...new Set(['map-frame.json', ...(old?.files.documents ?? [])])],
    },
  });
  console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes`);
}

if (buildAll) {
  const { bytes, sha256 } = encode('Molen original Atal Setu assembly master', (out) =>
    buildAssembly(out, 'master'),
  );
  await emit(resolve(parent, 'models/assembly-master.glb'), bytes);
  const path = resolve(parent, 'source.json');
  const manifest = await readOptionalJson(path);
  manifest.files.models = [{ path: 'models/assembly-master.glb', sha256 }];
  await json(path, manifest);
  console.log(`Atal Setu source assembly: ${bytes.length} bytes, ${sha256}`);
}
