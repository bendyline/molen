/** Rebuild the independently placed Summer Palace structures from their mapped controls. */
import './install-deterministic-math.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as causeway from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-causeway-model.mjs';
import * as courtsAndMonument from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-courts-and-monument-model.mjs';
import * as easternCourts from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-eastern-courts-model.mjs';
import * as entrance from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-entrance-model.mjs';
import * as farmingGarden from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-farming-garden-model.mjs';
import * as farmingStele from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-farming-stele-model.mjs';
import * as hillCourts from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-hill-courts-model.mjs';
import * as court from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-model.mjs';
import * as northSlope from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-north-slope-model.mjs';
import * as ruyiGates from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-ruyi-gates-model.mjs';
import * as silkwormTemple from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-silkworm-temple-model.mjs';
import * as sumeruEntrance from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-sumeru-model.mjs';
import * as visitorSites from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-visitor-sites-model.mjs';
import * as waterfront from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-waterfront-model.mjs';
import * as westGate from '../../../content/worldgen/source/places/wx/wx4/summer_palace/models/summer-palace-west-gate-model.mjs';
import { traceVerifiedAssetOutputs } from '../../../scripts/verified-asset-outputs.mjs';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { biomeJson } from './format-json.mjs';
import { hashBytes, readOptionalJson, root, writeIndex } from './structure-model-files.mjs';
import { encodeSourceGeohash } from './structure-source-paths.mjs';

const collection = 'summer_palace';
const authoredMembers = new Set([
  'summer_palace_benevolence_and_longevity',
  'summer_palace_binfeng_bridge',
  'summer_palace_bronze_ox',
  'summer_palace_bronze_pavilion',
  'summer_palace_dispelling_clouds',
  'summer_palace_duobao_pagoda',
  'summer_palace_east_palace_gate',
  'summer_palace_farming_garden',
  'summer_palace_four_great_regions',
  'summer_palace_harmonious_pleasures',
  'summer_palace_heralding_spring',
  'summer_palace_incense_tower',
  'summer_palace_jade_belt_bridge',
  'summer_palace_jade_ripples',
  'summer_palace_jiehu_bridge',
  'summer_palace_jingming_pavilion',
  'summer_palace_joyful_longevity',
  'summer_palace_kuoru_pavilion',
  'summer_palace_lian_bridge',
  'summer_palace_listening_to_orioles',
  'summer_palace_long_corridor',
  'summer_palace_marble_boat',
  'summer_palace_mirror_bridge',
  'summer_palace_new_palace_gate',
  'summer_palace_north_palace_gate',
  'summer_palace_north_ruyi_gate',
  'summer_palace_picture_scroll',
  'summer_palace_purple_cloud_gate',
  'summer_palace_revolving_archive',
  'summer_palace_seventeen_arch_bridge',
  'summer_palace_south_lake_island',
  'summer_palace_south_ruyi_gate',
  'summer_palace_sumeru_entrance',
  'summer_palace_west_gate',
  'summer_palace_silkworm_temple',
  'summer_palace_farming_stele',
  'summer_palace_suzhou_street',
  'summer_palace_virtue_and_harmony',
  'summer_palace_wenchang_gallery',
  'summer_palace_wenchang_tower',
  'summer_palace_willow_bridge',
  'summer_palace_xiuyi_bridge',
  'summer_palace_yiyun_hall',
  'summer_palace_yelu_chucai_shrine',
]);
const parent = resolve(root, 'content/worldgen/source/places/wx/wx4/summer_palace');
const inventory = await readOptionalJson(resolve(parent, 'site-inventory.json'));
const all = process.argv
  .find((value) => value.startsWith('--ids='))
  ?.slice(6)
  .split(',');
for (const id of all ?? [])
  assert(
    id === collection || authoredMembers.has(id),
    `Unknown authored Summer Palace member: ${id}`,
  );
const check = process.argv.includes('--check');
const outputs = [];
const levels = { skyline: 3.2, district: 1.3, street: 0.48, closeup: 0.15 };
const levelExport = (name) => `build${name[0].toUpperCase()}${name.slice(1)}`;
const courtRecipe = await readFile(resolve(parent, 'models/summer-palace-model.mjs'));
const causewayRecipe = await readFile(resolve(parent, 'models/summer-palace-causeway-model.mjs'));
const courtsAndMonumentRecipe = await readFile(
  resolve(parent, 'models/summer-palace-courts-and-monument-model.mjs'),
);
const entranceRecipe = await readFile(resolve(parent, 'models/summer-palace-entrance-model.mjs'));
const farmingGardenRecipe = await readFile(
  resolve(parent, 'models/summer-palace-farming-garden-model.mjs'),
);
const hillCourtsRecipe = await readFile(
  resolve(parent, 'models/summer-palace-hill-courts-model.mjs'),
);
const easternCourtsRecipe = await readFile(
  resolve(parent, 'models/summer-palace-eastern-courts-model.mjs'),
);
const northSlopeRecipe = await readFile(
  resolve(parent, 'models/summer-palace-north-slope-model.mjs'),
);
const visitorSitesRecipe = await readFile(
  resolve(parent, 'models/summer-palace-visitor-sites-model.mjs'),
);
const ruyiGatesRecipe = await readFile(
  resolve(parent, 'models/summer-palace-ruyi-gates-model.mjs'),
);
const sumeruEntranceRecipe = await readFile(
  resolve(parent, 'models/summer-palace-sumeru-model.mjs'),
);
const westGateRecipe = await readFile(resolve(parent, 'models/summer-palace-west-gate-model.mjs'));
const silkwormTempleRecipe = await readFile(
  resolve(parent, 'models/summer-palace-silkworm-temple-model.mjs'),
);
const farmingSteleRecipe = await readFile(
  resolve(parent, 'models/summer-palace-farming-stele-model.mjs'),
);
const waterfrontRecipe = await readFile(
  resolve(parent, 'models/summer-palace-waterfront-model.mjs'),
);

async function emit(path, bytes) {
  const old = await readFile(path).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (check) assert(old?.equals(bytes), `Stale source output: ${path}`);
  else if (!old?.equals(bytes)) await writeIndex(path, bytes);
}
const json = (path, value) => emit(path, Buffer.from(biomeJson(value, path)));

for (const { id, assetId, wikidataId, referenceCoordinate } of inventory.members) {
  if (!authoredMembers.has(id)) continue;
  if (all && !all.includes(collection) && !all.includes(id)) continue;
  const { longitude, latitude } = referenceCoordinate;
  const cell = encodeSourceGeohash(longitude, latitude);
  const place = `places/${cell.slice(0, 2)}/${cell}/${id}`;
  const dir = resolve(root, 'content/worldgen/source', place);
  const layoutBytes = await readFile(resolve(dir, 'layout.json'));
  const layout = JSON.parse(layoutBytes);
  let builderModule = court;
  let recipe = courtRecipe;
  if (waterfront.forms.has(layout.form)) {
    builderModule = waterfront;
    recipe = Buffer.concat([courtRecipe, waterfrontRecipe]);
  } else if (causeway.forms.has(layout.form)) {
    builderModule = causeway;
    recipe = Buffer.concat([courtRecipe, causewayRecipe]);
  } else if (courtsAndMonument.forms.has(layout.form)) {
    builderModule = courtsAndMonument;
    recipe = Buffer.concat([courtRecipe, courtsAndMonumentRecipe]);
  } else if (northSlope.forms.has(layout.form)) {
    builderModule = northSlope;
    recipe = Buffer.concat([courtRecipe, northSlopeRecipe]);
  } else if (entrance.forms.has(layout.form)) {
    builderModule = entrance;
    recipe = Buffer.concat([courtRecipe, entranceRecipe]);
  } else if (easternCourts.forms.has(layout.form)) {
    builderModule = easternCourts;
    recipe = Buffer.concat([courtRecipe, entranceRecipe, easternCourtsRecipe]);
  } else if (hillCourts.forms.has(layout.form)) {
    builderModule = hillCourts;
    recipe = Buffer.concat([courtRecipe, hillCourtsRecipe]);
  } else if (visitorSites.forms.has(layout.form)) {
    builderModule = visitorSites;
    recipe = Buffer.concat([courtRecipe, visitorSitesRecipe]);
  } else if (farmingGarden.forms.has(layout.form)) {
    builderModule = farmingGarden;
    recipe = Buffer.concat([courtRecipe, farmingGardenRecipe]);
  } else if (ruyiGates.forms.has(layout.form)) {
    builderModule = ruyiGates;
    recipe = Buffer.concat([courtRecipe, ruyiGatesRecipe]);
  } else if (sumeruEntrance.forms.has(layout.form)) {
    builderModule = sumeruEntrance;
    recipe = Buffer.concat([courtRecipe, sumeruEntranceRecipe]);
  } else if (westGate.forms.has(layout.form)) {
    builderModule = westGate;
    recipe = Buffer.concat([courtRecipe, entranceRecipe, westGateRecipe]);
  } else if (silkwormTemple.forms.has(layout.form)) {
    builderModule = silkwormTemple;
    recipe = Buffer.concat([courtRecipe, silkwormTempleRecipe]);
  } else if (farmingStele.forms.has(layout.form)) {
    builderModule = farmingStele;
    recipe = Buffer.concat([courtRecipe, farmingSteleRecipe]);
  }
  const { buildSummerPalaceMember, surfaces } = builderModule;
  const [draft, observations, sourceFrame, previous] = await Promise.all([
    readOptionalJson(resolve(dir, 'placement-draft.json')),
    readOptionalJson(resolve(dir, 'reference-observations.json')),
    readFile(resolve(dir, 'map-frame.json')),
    readOptionalJson(resolve(dir, 'source.json')),
  ]);
  assert.equal(draft.asset, assetId);
  assert.deepEqual(layout.anchor, [longitude, latitude]);
  assert.deepEqual(draft.anchor, layout.anchor);
  assert.equal(draft.heading, layout.heading);
  const builder = new MeshBufferBuilder();
  const authoring = createArchitecturalSurfaceAuthoring(surfaces);
  buildSummerPalaceMember(authoring.wrap(builder), layout, 'master');
  const mesh = builder.finalize();
  validateAuthoredMesh(mesh, id);
  const materials = authoring.materials(mesh.groups);
  const bytes = Buffer.from(encodeGlb(mesh, materials, `Molen original ${layout.title} master`));
  const sha256 = hashBytes(bytes);
  const module = `content/worldgen/source/${place}/models/member-model.mjs`;
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
    planId: collection,
    collectionId: collection,
    assetId,
    wikidataId,
    referenceCoordinate,
    title: layout.title,
    category: layout.category,
    quality: 'detailed',
    visualBrief: observations.visualBrief,
    nativeAxes: observations.nativeAxes,
    actualBounds,
    size: actualBounds.max.map((value, i) => value - actualBounds.min[i]),
    geometrySource:
      'Original deterministic exterior geometry from photographs, mapped PMTiles features and standard Terrarium samples.',
    materialMethod:
      'Shared stone, timber, tile, plaster, glass and paint graphs with metric UVs and vertex tints.',
    sharedSurfaces: materials.flatMap((m) => (m.sharedSurface ? [m.sharedSurface] : [])),
    referencePages: observations.references.map((r) => r.url),
    geographicProposal: {
      status: draft.status === 'preview' ? 'preview-proposal' : 'draft-proposal',
      anchor: draft.anchor,
      heading: draft.heading,
      bounds: draft.bounds,
      minLevel: draft.minLevel,
      elevationMode: 'sea-level',
      elevationMeters: draft.elevation,
      orientationPolicy: 'approximate-visualization',
      groundModelY: 0,
      groundContactReviewed: draft.status === 'preview',
      groundContactBasis:
        'The local absolute datum and below-grade plinth or footings are set relative to standard site terrain.',
      replaceFootprint: draft.replaceFootprint,
      ...(draft.buildingCutout ? { buildingCutout: draft.buildingCutout } : {}),
      ...(draft.groundCutout ? { groundCutout: draft.groundCutout } : {}),
      ...(draft.waterCutout ? { waterCutout: draft.waterCutout } : {}),
      ...(draft.replaceRoads ? { replaceRoads: draft.replaceRoads } : {}),
      mapIdentity: draft.mapIdentity,
      mapGeometrySource: 'map-frame.json',
      mapGeometryHash: hashEvidenceText(sourceFrame),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors; Protomaps basemap',
      source: draft.source,
      wikidataId,
      notes: layout.limitations.join(' '),
    },
    sourceGeometry: { module, export: 'buildMaster', layoutHash: hashEvidenceText(layoutBytes) },
    runtimeLodOverlay: {
      level: 'skyline',
      module,
      export: 'buildSkyline',
      errorMeters: levels.skyline,
      surfaces,
      inputHash: hashBytes(
        Buffer.from(`${hashEvidenceText(layoutBytes)}\n${hashEvidenceText(recipe)}`),
      ),
      authoredLevels: Object.fromEntries(
        Object.entries(levels)
          .slice(1)
          .map(([level, errorMeters]) => [
            level,
            { export: levelExport(level), errorMeters, surfaces },
          ]),
      ),
    },
    fidelityTarget: 'medium-fi',
    fidelityStatus: 'pending',
    reviewStatus: 'Visual and geographic acceptance is recorded in qa.json.',
    limitations: layout.limitations,
    qaCameras: observations.cameras,
    importOptions: { optimize: false },
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: mesh.groups.length,
      bytes: bytes.length,
      sha256,
    },
  };
  const [camera] = observations.cameras;
  const scene = {
    format: 'molen/scene@3',
    name: spec.title,
    seed: id,
    tickRate: 30,
    physics: { engine: 'none' },
    camera: { mode: 'fixed', position: camera.position, lookAt: camera.lookAt, fov: camera.fov },
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'gltf', ref: assetId, shadows: { cast: true, receive: true } },
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
  const glb = resolve(dir, 'models/source.glb');
  await emit(glb, bytes);
  outputs.push(glb);
  await json(resolve(dir, 'spec.json'), spec);
  await json(resolve(dir, 'scene.json'), scene);
  await json(resolve(dir, 'source.json'), {
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
          output: `assets/${place}/asset.json`,
          pipeline: 'import',
          sha256,
        },
      ],
      generators: [{ id, path: 'models/member-model.mjs' }],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          'README.md',
          'placement-draft.json',
          'map-fit.json',
          'map-frame.json',
          'reference-observations.json',
          ...(previous?.files.documents ?? []),
        ]),
      ],
    },
  });
  console.log(`${id}: ${mesh.triangleCount} triangles, ${bytes.length} bytes, ${sha256}`);
}
if (!check && outputs.length) await traceVerifiedAssetOutputs(outputs);
