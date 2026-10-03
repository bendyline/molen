/** Shared-material source bundles for individually researched bridges; runtime import is separate. */
import './install-deterministic-math.mjs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { archevecheStudy } from './archeveche-bridge-model.mjs';
import {
  cross,
  normalize,
  smoothMeshNormals,
  validateAuthoredMesh,
} from './authored-structure-mesh.mjs';
import { blueBridgeStudy } from './blue-bridge-model.mjs';
import { circleBridgeStudy } from './circle-bridge-model.mjs';
import { cordobaStudy } from './cordoba-roman-bridge-model.mjs';
import { dragonBridgeStudy } from './dragon-bridge-model.mjs';
import { dyavolskiStudy } from './dyavolski-most-model.mjs';
import { eshimaStudy } from './eshima-ohashi-model.mjs';
import { hashEvidenceText } from './evidence-text-hash.mjs';
import { gandhiSetuStudy } from './gandhi-setu-model.mjs';
import { haghtanakStudy } from './haghtanak-bridge-model.mjs';
import { helixStudy } from './helix-bridge-model.mjs';
import { jamunaStudy } from './jamuna-bridge-model.mjs';
import { kazarmaStudy } from './kazarma-bridge-model.mjs';
import { kievyanStudy } from './kievyan-bridge-model.mjs';
import { kyivMetroStudy } from './kyiv-metro-bridge-model.mjs';
import { kyrkbronStudy } from './kyrkbron-model.mjs';
import { mesStudy } from './mes-bridge-model.mjs';
import { monnowStudy } from './monnow-bridge-model.mjs';
import { poniatowskiStudy } from './poniatowski-bridge-model.mjs';
import { pontAvalStudy } from './pont-aval-model.mjs';
import { pontDelDiableStudy } from './pont-del-diable-model.mjs';
import { redYerevanStudy } from './red-yerevan-bridge-model.mjs';
import { sanjoOhashiStudy } from './sanjo-ohashi-model.mjs';
import { skopjeAqueductStudy } from './skopje-aqueduct-model.mjs';
import { skopjeStudy } from './skopje-bridge-exterior.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { stariMostStudy } from './stari-most-model.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { hashBytes, root } from './structure-model-files.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';
import { tolbiacStudy } from './tolbiac-bridge-model.mjs';
import { yiSunSinStudy } from './yi-sun-sin-bridge-model.mjs';

const check = process.argv.includes('--check');
const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json')),
);
const mapBytes = await readFile(resolve(root, 'content/earth/structures/georeferencing.json'));
const evidence = JSON.parse(mapBytes);
const surfaces = {
  steel: { graph: 'metal_stainless', slot: 'trim', roughness: 0.31, metallic: 1 },
  copper: { graph: 'metal_copper', slot: 'trim', roughness: 0.64, metallic: 0.7 },
  bronze: { graph: 'metal_bronze_cast', slot: 'trim', roughness: 0.65, metallic: 0.65 },
  concrete: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.9, metallic: 0 },
  paving: { graph: 'stone_granite', slot: 'wall', roughness: 0.8, metallic: 0 },
  stone: { graph: 'stone_granite', slot: 'wall', roughness: 0.9, metallic: 0 },
  basalt: { graph: 'stone_basalt_raw', slot: 'wall', roughness: 0.93, metallic: 0 },
  sandstone: { graph: 'stone_sandstone_raw', slot: 'wall', roughness: 0.95, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.94, metallic: 0 },
  timber: { graph: 'wood_plain', slot: 'trim', roughness: 0.85, metallic: 0 },
  roughstone: { graph: 'stone_drywall', slot: 'foundation', roughness: 0.98, metallic: 0 },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.95, metallic: 0 },
  rawlimestone: { graph: 'stone_limestone_raw', slot: 'wall', roughness: 0.95, metallic: 0 },
  weatheredlimestone: {
    graph: 'stone_limestone_weathered',
    slot: 'wall',
    roughness: 0.96,
    metallic: 0,
  },
  aggregate: { graph: 'gravel', slot: 'foundation', roughness: 0.98, metallic: 0 },
  brick: { graph: 'clay_fired', slot: 'wall', roughness: 0.92, metallic: 0 },
  travertine: { graph: 'stone_travertine', slot: 'wall', roughness: 0.92, metallic: 0 },
  iron: { graph: 'metal_painted', slot: 'trim', roughness: 0.65, metallic: 0.35 },
  glass: { slot: 'window', roughness: 0.17, metallic: 0, opacity: 0.32 },
  mesh: { slot: 'roof', roughness: 0.65, metallic: 0.7, opacity: 0.48 },
  road: { slot: 'wall', roughness: 0.97, metallic: 0 },
  marking: { slot: 'trim', roughness: 0.87, metallic: 0 },
};
const mapper = (builder, used, overrides = {}) => {
  const prepare = (component, n) => {
    const s = surfaces[overrides[component] ?? component];
    if (!s) throw new Error(`Unmapped bridge surface ${component}`);
    const ref = s.graph
      ? `matgraph:molen.worldgen.material.${s.graph}`
      : `palette:${{ glass: '#feffff', mesh: '#fffffe', road: '#fffefe', marking: '#fffeff' }[component]}`;
    used.set(`${s.slot}:${ref}`, s);
    n = normalize(n);
    const u = Math.abs(n[1]) < 0.98 ? normalize([n[2], 0, -n[0]]) : [1, 0, 0],
      v = normalize(cross(n, u)),
      repeat = s.graph ? MATERIAL_REPEAT_METERS[s.graph] : [1, 1];
    return {
      s,
      ref,
      uv: (p) => [
        p.reduce((sum, n, i) => sum + n * u[i], 0) / repeat[0],
        p.reduce((sum, n, i) => sum + n * v[i], 0) / repeat[1],
      ],
    };
  };
  return {
    addQuad(c, _ref, p, n, _uv, color) {
      const { s, ref, uv } = prepare(c, n);
      builder.addQuad(s.slot, ref, p, n, p.map(uv), color);
    },
    addTriangle(c, _ref, p, n, _uv, color) {
      const { s, ref, uv } = prepare(c, n);
      builder.addTriangle(s.slot, ref, p, n, p.map(uv), color);
    },
    addConvexPolygon(c, _ref, p, n, _uv, color) {
      const { s, ref, uv } = prepare(c, n);
      builder.addConvexPolygon(s.slot, ref, p, n, uv, color);
    },
    addCap(c, _ref, outer, holes, heightOf, n, _uv, color) {
      const { s, ref, uv } = prepare(c, n);
      return builder.addCap(
        s.slot,
        ref,
        outer,
        holes,
        heightOf,
        n,
        (p) => uv([p[0], heightOf(p), p[1]]),
        color,
      );
    },
  };
};
async function emit(path, bytes) {
  let old;
  try {
    old = await readFile(path);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (check) {
    if (
      !old ||
      (!old.equals(bytes) && old.toString().replaceAll('\r\n', '\n') !== bytes.toString())
    )
      throw new Error(`${path}: stale generated source`);
    return;
  }
  if (old?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}
for (const study of [
  stariMostStudy,
  helixStudy,
  skopjeStudy,
  eshimaStudy,
  kyivMetroStudy,
  cordobaStudy,
  kyrkbronStudy,
  mesStudy,
  kazarmaStudy,
  haghtanakStudy,
  monnowStudy,
  dyavolskiStudy,
  redYerevanStudy,
  skopjeAqueductStudy,
  archevecheStudy,
  gandhiSetuStudy,
  sanjoOhashiStudy,
  dragonBridgeStudy,
  jamunaStudy,
  kievyanStudy,
  yiSunSinStudy,
  pontAvalStudy,
  blueBridgeStudy,
  tolbiacStudy,
  poniatowskiStudy,
  circleBridgeStudy,
  pontDelDiableStudy,
].filter((s) => !ids || ids.includes(s.id))) {
  const candidate = catalog.candidates.find((c) => c.id === study.id),
    mapped = evidence.candidates.find((c) => c.candidateId === study.id);
  if (candidate?.wikidataId !== study.wikidataId || mapped?.wikidataId !== study.wikidataId)
    throw new Error(`Bridge identity changed: ${study.id}`);
  const key = `${study.id.toLowerCase()}_${study.key}`,
    assetId = `molen.worldgen.structure.${key}`,
    dir = structureSourceDirectory(key);
  const modelPath = resolve(dir, 'models/source.glb');
  const sourceFrame = study.mapFrameDocument
    ? await readFile(resolve(dir, study.mapFrameDocument))
    : undefined;
  let priorDocs = [];
  try {
    const src = JSON.parse(await readFile(resolve(dir, 'source.json')));
    priorDocs = src.files.documents;
    if (hashBytes(await readFile(modelPath)) !== src.files.models[0].sha256)
      throw new Error(`${study.id}: preserve artist-edited source before regenerating`);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  const out = new MeshBufferBuilder(),
    used = new Map();
  study.build(mapper(out, used, study.surfaceOverrides), mapped);
  const mesh = out.finalize();
  smoothMeshNormals(mesh, ['trim'], 45);
  if (study.normalSmoothing)
    smoothMeshNormals(mesh, study.normalSmoothing.slots, study.normalSmoothing.angle);
  validateAuthoredMesh(mesh, study.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3], v);
    max[i % 3] = Math.max(max[i % 3], v);
  });
  const glb = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((g) => {
        const s = used.get(`${g.slot}:${g.materialRef}`);
        return {
          name: s.graph ?? g.slot,
          roughness: s.roughness,
          metallic: s.metallic,
          ...(s.graph
            ? { sharedSurface: { ref: g.materialRef, slot: s.slot, uv: 'repeats' } }
            : {}),
          ...(s.opacity !== undefined
            ? { baseColorFactor: [1, 1, 1, s.opacity], alphaMode: 'BLEND', doubleSided: true }
            : {}),
        };
      }),
      `Molen original ${study.title}`,
    ),
  );
  const size = max.map((v, i) => v - min[i]);
  const spec = {
    planId: study.id,
    id: study.id,
    assetId,
    title: study.title,
    category: 'bridge',
    quality: 'detailed',
    wikidataId: study.wikidataId,
    referenceCoordinate: candidate.referenceCoordinate,
    visualBrief: study.brief,
    size,
    actualBounds: { min, max },
    nativeAxes: study.nativeAxes,
    sourceFacts: study.sourceFacts,
    reconstruction: study.reconstruction,
    referencePages: study.refs,
    geographicProposal: {
      status: 'preview-proposal',
      ground: 'terrain',
      groundModelY: 0,
      wikidataId: study.wikidataId,
      featureIds: mapped.featureIds,
      source: mapped.featureSources?.[0],
      mapGeometrySource: 'content/earth/structures/georeferencing.json',
      mapGeometryHash: hashEvidenceText(mapBytes),
      mapGeometryLicense: 'ODbL-1.0',
      attribution: '© OpenStreetMap contributors',
      ...study.geographic(mapped),
      ...(sourceFrame
        ? {
            mapGeometrySource: study.mapFrameDocument,
            mapGeometryHash: hashEvidenceText(sourceFrame),
          }
        : {}),
    },
    geometrySource:
      'Original deterministic exterior geometry. No downloaded meshes or embedded photographs.',
    sourceLicense:
      'Repository license for original geometry; map-derived plan © OpenStreetMap contributors ODbL-1.0; reference publications retain their own rights.',
    materialMethod:
      'Canonical shared material graphs with metric UV repeats and per-component vertex tints; separate transparent glazing; no model-specific bitmap textures.',
    sharedSurfaces: [...used.entries()]
      .filter(([, s]) => s.graph)
      .map(([, s]) => ({
        ref: `matgraph:molen.worldgen.material.${s.graph}`,
        slot: s.slot,
        uv: 'repeats',
        repeatMeters: MATERIAL_REPEAT_METERS[s.graph],
      })),
    reviewStatus: 'source-geometry; current renders and geographic fit require review',
    fidelityTarget: 'maximum',
    fidelityStatus: 'pending',
    limitations: study.limitations,
    qaCameras: study.qaCameras,
    importOptions: { optimize: false },
    importReason:
      'Preserve thin cables, rail frames and hardware across the full crossing; whole-object quantization loses these details.',
    mesh: {
      triangles: mesh.triangleCount,
      vertices: mesh.vertexCount,
      materials: mesh.groups.length,
      bytes: glb.length,
      sha256: hashBytes(glb),
    },
  };
  const scene = {
    format: 'molen/scene@3',
    name: `${study.title} asset preview`,
    seed: study.id,
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
            scale: [size[0] * 1.15, 0.2, Math.max(100, size[2] * 1.5)],
          },
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
    camera: { mode: 'fixed', ...study.camera },
    physics: { engine: 'none' },
  };
  const optional = (
    await readdir(dir).catch((e) => {
      if (e.code === 'ENOENT') return [];
      throw e;
    })
  ).filter((n) => n.endsWith('-report.json') || n === 'qa.json');
  const source = {
    format: 'molen/source-bundle@1',
    id: assetId,
    kind: 'static-structure',
    title: study.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId,
          output: structureAssetSidecarPath(assetId),
          pipeline: 'import',
          sha256: hashBytes(glb),
        },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: [
        ...new Set([
          ...priorDocs,
          'README.md',
          'preview.png',
          ...(study.mapFrameDocument ? [study.mapFrameDocument] : []),
          ...optional,
        ]),
      ],
    },
  };
  const readme = `# ${study.title}\n\n![Molen preview](preview.png)\n\n${study.brief}\n\n## Evidence\n\n${study.refs.map((u) => `- [Primary reference](${u})`).join('\n')}\n\nPublished dimensions and reconstruction assumptions are separated in spec.json. Source photos were consulted; no photos or third-party geometry are embedded. Map plan attribution: © OpenStreetMap contributors, ODbL-1.0.\n\n## Source\n\n${mesh.triangleCount} triangles; ${glb.length} bytes; ${mesh.groups.length} material groups. SHA256: ${hashBytes(glb)}.\n\nShared surfaces (${[...new Set([...used.values()].filter((surface) => surface.graph).map((surface) => surface.graph))].join(', ')}) are loaded through the central library; any transparent materials use local PBR parameters. Axis and provisional vertical datum are in spec.json.\n\nRegenerate with node packages/worldgen/scripts/generate-researched-bridges.mjs --ids=${study.id}; append --check to verify. Import and capture through the standard next-1000 scripts. Geometry validation does not substitute for current-frame visual review.\n\n## Reconstruction limits\n\n${study.limitations.map((s) => `- ${s}`).join('\n')}\n`;
  await emit(modelPath, glb);
  for (const [name, data] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(data, null, 2)}\n`));
  await emit(
    resolve(dir, 'README.md'),
    Buffer.from(
      study.letteringNotice
        ? readme.replace(
            'no photos or third-party geometry are embedded.',
            `no photographs or third-party architecture meshes are embedded. ${study.letteringNotice}`,
          )
        : readme,
    ),
  );
  console.log(
    `${study.id}: ${mesh.triangleCount} triangles, ${glb.length} bytes, ${hashBytes(glb)}`,
  );
}
