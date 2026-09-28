/** Reproducible original tower sources, with shared metric material bindings. */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { agathaTower } from './agatha-tower-model.mjs';
import { aljazTower } from './aljaz-tower-model.mjs';
import { alphabeticTower } from './alphabetic-tower-model.mjs';
import { aonLosAngeles } from './aon-los-angeles-model.mjs';
import { cross, normalize, validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { avicennaMausoleum } from './avicenna-mausoleum-model.mjs';
import { bierpinsel } from './bierpinsel-model.mjs';
import { calahorraTower } from './calahorra-tower-model.mjs';
import { civicTowers } from './civic-tower-models.mjs';
import { civicTowersMore } from './civic-tower-more-models.mjs';
import { finalHeritageTowers } from './final-heritage-tower-models.mjs';
import { gerbrandyTower } from './gerbrandy-tower-model.mjs';
import { gothicHeritageTowers } from './gothic-heritage-tower-models.mjs';
import { grosHorloge } from './gros-horloge-model.mjs';
import { heritageTowers } from './heritage-tower-models.mjs';
import { heritageTowers580 } from './heritage-towers-580-models.mjs';
import { heritageTowers580More } from './heritage-towers-580-more-models.mjs';
import { hidirlikTower } from './hidirlik-tower-model.mjs';
import { laboeMemorial } from './laboe-memorial-model.mjs';
import { lambertiTower } from './lamberti-tower-model.mjs';
import { lotusTower } from './lotus-tower-model.mjs';
import { nextHeritageTowers } from './next-heritage-tower-models.mjs';
import { moreHeritageTowers } from './next-heritage-tower-more-models.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';
import { sukharevTower } from './sukharev-tower-model.mjs';
import { torreDeiConti } from './torre-dei-conti-model.mjs';
import { torreDelMangia } from './torre-del-mangia-model.mjs';
import { torunLeaningTower } from './torun-leaning-tower-model.mjs';
import { turtleTower } from './turtle-tower-model.mjs';
import { tyholtTower } from './tyholt-tower-model.mjs';
import { vijayaStambha } from './vijaya-stambha-model.mjs';
import { wattsTowers } from './watts-towers-model.mjs';
import { wiesghaTower } from './wiesgha-tower-model.mjs';
import { yserTower } from './yser-tower-model.mjs';

const check = process.argv.includes('--check');
const filter = process.argv.find((arg) => /^N\d{4}$/.test(arg));
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const surfaces = {
  marble: { graph: 'stone_marble', slot: 'wall', roughness: 0.6 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.94 },
  limestone_raw: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.94 },
  limestone_round: {
    graph: 'stone_limestone',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [-4.782, 0.011], radius: 8.25 },
  },
  darkstone: { graph: 'stone_basalt', slot: 'trim', roughness: 0.88 },
  avicenna_granite: { graph: 'stone_basalt_raw', slot: 'wall', roughness: 0.96 },
  laboe_granite: { graph: 'stone_basalt_raw', slot: 'wall', roughness: 0.91 },
  yser_stone: { graph: 'stone_sandstone_raw', slot: 'wall', roughness: 0.96 },
  brick: { graph: 'brick', slot: 'wall', roughness: 0.94 },
  riga_brick: {
    graph: 'brick',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [0, 0], radius: 7.1 },
  },
  riga_stone: {
    graph: 'stone_limestone',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [0, 0], radius: 7.15 },
  },
  tughrul_upper: {
    graph: 'brick',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [0, 0], radius: 8.22 },
  },
  tughrul_inner: {
    graph: 'brick',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [0, 0], radius: 5.23 },
  },
  beyazit_stone: {
    graph: 'stone_limestone',
    slot: 'wall',
    roughness: 0.94,
    cylinder: { center: [0, 0], radius: 4.04 },
  },
  brickroof: { graph: 'brick', slot: 'roof', roughness: 0.91 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.84 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.65 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.88 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.93 },
  copper: { graph: 'metal_copper', slot: 'roof', roughness: 0.76 },
  concrete: { graph: 'concrete_plain', slot: 'wall', roughness: 0.91 },
  turf: { slot: 'roof', roughness: 1 },
  glass: { slot: 'wall', roughness: 0.22 },
  shadow: { slot: 'wall', roughness: 1 },
  carvedstone: { slot: 'trim', roughness: 0.94 },
};
function wrap(builder, used, componentMap = {}) {
  function prepare(component, points, normal, fallback) {
    const surface = surfaces[componentMap[component] ?? component];
    if (!surface) throw new Error(`Missing component material: ${component}`);
    const materialRef = surface.graph
      ? `matgraph:molen.worldgen.material.${surface.graph}`
      : 'palette:#ffffff';
    used.set(`${surface.slot}:${materialRef}`, surface);
    let uv = fallback;
    if (surface.graph) {
      const n = normalize(normal),
        u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
        v = normalize(cross(n, u));
      const repeat = MATERIAL_REPEAT_METERS[surface.graph];
      if (!repeat) throw new Error(`Missing shared repeat: ${surface.graph}`);
      uv = (p) => [
        p.reduce((s, n, i) => s + n * u[i], 0) / repeat[0],
        (Math.abs(n[1]) < 0.98 ? p[1] : p.reduce((s, n, i) => s + n * v[i], 0)) / repeat[1],
      ];
      if (surface.cylinder && Math.abs(n[1]) < 0.98) {
        // Unwrap each polygon across the atan2 seam; one continuous metric U around the tower
        // keeps mortar joints from restarting at each curved wall facet.
        const { center, radius } = surface.cylinder;
        const angle = (p) => Math.atan2(p[2] - center[1], p[0] - center[0]);
        const base = angle(points[0]);
        uv = (p) => {
          let a = angle(p);
          while (a - base > Math.PI) a -= 2 * Math.PI;
          while (a - base < -Math.PI) a += 2 * Math.PI;
          return [(a * radius) / repeat[0], p[1] / repeat[1]];
        };
      }
    }
    return { surface, materialRef, uv };
  }
  return {
    addQuad(component, _ref, points, normal, uv, color) {
      const s = prepare(component, points, normal, (p) => uv[points.indexOf(p)]);
      builder.addQuad(s.surface.slot, s.materialRef, points, normal, points.map(s.uv), color);
    },
    addTriangle(component, _ref, points, normal, uv, color) {
      const s = prepare(component, points, normal, (p) => uv[points.indexOf(p)]);
      builder.addTriangle(s.surface.slot, s.materialRef, points, normal, points.map(s.uv), color);
    },
    addConvexPolygon(component, _ref, points, normal, uv, color) {
      const s = prepare(component, points, normal, uv);
      builder.addConvexPolygon(s.surface.slot, s.materialRef, points, normal, s.uv, color);
    },
  };
}
async function emit(path, bytes) {
  let existing;
  try {
    existing = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (check) {
    if (
      !existing ||
      (!existing.equals(bytes) &&
        existing.toString('utf8').replaceAll('\r\n', '\n') !== bytes.toString('utf8'))
    )
      throw new Error(`${path}: stale generated source`);
    return;
  }
  if (existing?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

for (const asset of [
  ...heritageTowers,
  ...nextHeritageTowers,
  ...moreHeritageTowers,
  ...gothicHeritageTowers,
  ...finalHeritageTowers,
  ...heritageTowers580,
  ...heritageTowers580More,
  alphabeticTower,
  ...civicTowers,
  ...civicTowersMore,
  aonLosAngeles,
  lotusTower,
  torreDeiConti,
  torunLeaningTower,
  aljazTower,
  calahorraTower,
  torreDelMangia,
  wiesghaTower,
  laboeMemorial,
  avicennaMausoleum,
  yserTower,
  lambertiTower,
  tyholtTower,
  turtleTower,
  agathaTower,
  hidirlikTower,
  vijayaStambha,
  grosHorloge,
  wattsTowers,
  sukharevTower,
  bierpinsel,
  gerbrandyTower,
].filter((asset) => !filter || asset.planId === filter)) {
  const dir = structureSourceDirectory(asset.id);
  const assetId = `molen.worldgen.structure.${asset.id}`;
  const modelPath = resolve(dir, 'models/source.glb');
  try {
    const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    if (hash(await readFile(modelPath)) !== source.files.models[0].sha256)
      throw new Error(
        `${asset.id}: source master changed outside generator; preserve artist edits before regenerating`,
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const builder = new MeshBufferBuilder(),
    used = new Map();
  asset.build(wrap(builder, used, asset.componentMap));
  const mesh = builder.finalize();
  asset.decorateMesh?.(mesh);
  if (asset.groundNormalize) {
    let base = Infinity;
    for (let i = 1; i < mesh.positions.length; i += 3) base = Math.min(base, mesh.positions[i]);
    for (let i = 1; i < mesh.positions.length; i += 3) mesh.positions[i] -= base;
  }
  validateAuthoredMesh(mesh, asset.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((n, i) => {
    min[i % 3] = Math.min(min[i % 3], n);
    max[i % 3] = Math.max(max[i % 3], n);
  });
  const glb = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((group) => {
        const surface = used.get(`${group.slot}:${group.materialRef}`);
        return {
          name: `${surface.graph ?? 'recess'}-${surface.slot}`,
          roughness: surface.roughness,
          metallic: 0,
          ...(surface.graph
            ? { sharedSurface: { ref: group.materialRef, slot: group.slot, uv: 'repeats' } }
            : {}),
        };
      }),
      `Molen original researched ${asset.title}`,
    ),
  );
  const gltf = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
  for (const [i, group] of mesh.groups.entries())
    if (
      group.materialRef.startsWith('matgraph:') &&
      gltf.materials[i]?.extras?.molenSurface?.ref !== group.materialRef
    )
      throw new Error('Built GLB encoder lacks required shared-surface metadata');
  const spec = {
    id: asset.planId,
    planId: asset.planId,
    assetId,
    title: asset.title,
    category: 'tower',
    quality: 'detailed',
    identity: { wikidata: asset.wikidata },
    wikidataId: asset.wikidata,
    visualBrief: asset.brief,
    size: asset.size,
    actualBounds: { min, max },
    nativeAxes: { up: '+Y', front: asset.front, origin: asset.origin },
    scaleBasis: asset.scaleBasis,
    ...(asset.appearance ? { appearance: asset.appearance } : {}),
    geographicProposal: {
      ...asset.geographicProposal,
      status: asset.geographicProposal.status ?? 'preview-proposal',
      elevationMode: asset.geographicProposal.elevationMode ?? 'terrain-contact',
      notes: `${asset.geographicProposal.evidence} ${asset.geographicProposal.limitations}`,
    },
    sourceFacts: asset.facts,
    referencePages: asset.refs,
    geometrySource:
      'Original deterministic geometry informed by cited dimensions, measured plans and photographs. No downloaded mesh or photographic texture is embedded.',
    sourceLicense:
      'Original geometry under repository license. Map-derived outline information is attributed to OpenStreetMap contributors, ODbL-1.0. Reference publications retain their own rights.',
    materialMethod:
      'Shared material graphs with metric repeat UV0 and original vertex tints; GLB PBR fallback remains self-contained. No per-model texture duplication.',
    sharedSurfaces: [...used.values()]
      .filter((s) => s.graph)
      .map((s) => ({
        ref: `matgraph:molen.worldgen.material.${s.graph}`,
        slot: s.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
      })),
    limitations: [
      ...asset.limits,
      'Near/far visual QA, shared-material inspection and maximum-fidelity approval remain pending.',
    ],
    reviewStatus: 'source-geometry; visual verification required',
    importOptions: { optimize: false },
    qaCameras: asset.cameras,
  };
  const h = max[1],
    extent = Math.max(h, max[0] - min[0], max[2] - min[2]);
  const scene = {
    format: 'molen/scene@3',
    name: `${asset.title} asset preview`,
    seed: asset.id,
    tickRate: 30,
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
          transform: {
            pos: [0, -0.15, 0],
            rot: [0, 0, 0, 1],
            scale: [extent * 1.3, 0.2, extent * 1.3],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#858779',
            shadows: { receive: true },
          },
        },
      },
      {
        id: 'environment',
        components: {
          environment: {
            ambient: { sky: '#e3e7eb', ground: '#73756b', intensity: 1.15 },
            sun: { direction: [-8, 14, 9], color: '#fff1d3', intensity: 2.2, castShadow: true },
            background: '#b5d2df',
            toneMapping: 'agx',
            exposure: 1.08,
            shadows: 'high',
          },
        },
      },
    ],
    camera: {
      mode: 'fixed',
      position: [extent * 0.65, h * 0.65, extent * 1.9],
      lookAt: [0, h * 0.48, 0],
      fov: 38,
    },
    physics: { engine: 'none' },
  };
  const optionalReports = (
    await readdir(dir).catch((error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    })
  )
    .filter((name) =>
      [
        'import-report.json',
        'capture-report.json',
        'shared-capture-report.json',
        'placement-report.json',
        'qa.json',
        'reference-metadata.json',
        'map-evidence.json',
        'map-frame.json',
        'reconstruction-brief.json',
      ].includes(name),
    )
    .sort();
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: asset.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: structureAssetSidecarPath(assetId),
          pipeline: 'import',
          sha256: hash(glb),
        },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png', ...optionalReports],
    },
  };
  const readme = `# ${asset.title}\n\n![Lit Molen preview](preview.png)\n\n${asset.brief}\n\n## Identity and geometry\n\nCatalog ${asset.planId}, [${asset.wikidata}](https://www.wikidata.org/wiki/${asset.wikidata}). ${asset.scaleBasis}\n\n${asset.origin}. ${asset.front}; +Y is up. The geographic proposal identifies its anchor and orientation evidence separately from remaining terrain and azimuth uncertainty.\n\nSource facts and measured references are recorded in spec.json. References: ${asset.refs.map((url, i) => `[${i + 1}](${url})`).join(', ')}. Reference pages and images are not redistributed.\n\n## Original source and shared materials\n\nGeometry is authored in \`packages/worldgen/scripts/${asset.authoringFile ?? (nextHeritageTowers.includes(asset) ? 'next-heritage-tower-models.mjs' : 'heritage-tower-models.mjs')}\`. ${spec.materialMethod} No third-party mesh or photograph is embedded.\n\n${mesh.triangleCount.toLocaleString('en-US')} triangles; ${mesh.vertexCount.toLocaleString('en-US')} vertices; ${mesh.groups.length} material groups; ${glb.length.toLocaleString('en-US')} source bytes. Source hash: \`${hash(glb)}\`. Geometry validation checks finite Float32 coordinates, indices, triangle area and winding before export.\n\nRegenerate with \`node packages/worldgen/scripts/generate-heritage-towers.mjs ${asset.planId}\`; add \`--check\` for reproducibility. The generator refuses to overwrite a master whose hash differs from source.json. Import uses \`--no-optimize\` to preserve facade recesses.\n\n## Remaining detail and review\n\n${spec.limitations.map((s) => `- ${s}`).join('\n')}\n\nNamed near/far cameras are included for lit visual review. A valid export is not maximum-fidelity certification.\n`;
  await emit(modelPath, glb);
  for (const [name, value] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    `${asset.planId}: ${mesh.triangleCount} triangles, ${glb.length} bytes, ${JSON.stringify({ min, max })}`,
  );
}
