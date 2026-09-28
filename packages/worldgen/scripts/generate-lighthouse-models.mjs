/** Reproducible source-only authoring for three researched lighthouse identities. */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { createArchitecturalSurfaceAuthoring } from './architectural-surface-authoring.mjs';
import { smoothMeshNormals, validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { lighthouseAmericasStudies } from './lighthouse-americas-models.mjs';
import { lighthouseAtlanticStudies } from './lighthouse-atlantic-models.mjs';
import { lighthouseBalticIronStudies } from './lighthouse-baltic-iron-models.mjs';
import { lighthouseBalticNextStudies } from './lighthouse-baltic-next-models.mjs';
import { lighthouseBlackseaStudies } from './lighthouse-blacksea-models.mjs';
import { lighthouseCoastalStudies } from './lighthouse-coastal-models.mjs';
import { lighthouseExpansionStudies } from './lighthouse-expansion-models.mjs';
import { lighthouseFinalCoastalStudies } from './lighthouse-final-coastal-models.mjs';
import { hatterasStudies } from './lighthouse-hatteras-model.mjs';
import { lighthouseKullenLizardStudies } from './lighthouse-kullen-lizard-models.mjs';
import { lighthouseLatticeStudies } from './lighthouse-lattice-models.mjs';
import { lighthouseStudies } from './lighthouse-models.mjs';
import { lighthouseNorthernStudies } from './lighthouse-northern-models.mjs';
import { lighthouseNorthseaStudies } from './lighthouse-northsea-models.mjs';
import { lighthouseOffshoreStudies } from './lighthouse-offshore-models.mjs';
import { rodsherStudies } from './lighthouse-rodsher-model.mjs';
import { rumeliStudies } from './lighthouse-rumeli-model.mjs';
import { lighthouseSouthBalticStudies } from './lighthouse-south-baltic-models.mjs';
import { lighthouseSwedishStudies } from './lighthouse-swedish-models.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';
import { wisloujscieStudies } from './wisloujscie-model.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const check = process.argv.includes('--check');
const selected = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
for (const arg of process.argv.slice(2))
  if (arg !== '--check' && !arg.startsWith('--ids=')) throw new Error(`Unknown argument ${arg}`);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const candidates = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
).candidates;
const studies = [
  ...lighthouseStudies,
  ...lighthouseExpansionStudies,
  ...lighthouseCoastalStudies,
  ...lighthouseOffshoreStudies,
  ...lighthouseLatticeStudies,
  ...lighthouseNorthernStudies,
  ...lighthouseAtlanticStudies,
  ...lighthouseBalticIronStudies,
  ...lighthouseBalticNextStudies,
  ...lighthouseSouthBalticStudies,
  ...lighthouseKullenLizardStudies,
  ...lighthouseNorthseaStudies,
  ...lighthouseFinalCoastalStudies,
  ...lighthouseSwedishStudies,
  ...lighthouseAmericasStudies,
  ...lighthouseBlackseaStudies,
  ...hatterasStudies,
  ...rumeliStudies,
  ...rodsherStudies,
  ...wisloujscieStudies,
];
const surfaces = {
  brick: { graph: 'brick', slot: 'wall', roughness: 0.92, metallic: 0 },
  ground: { graph: 'gravel', slot: 'foundation', roughness: 1, metallic: 0 },
  canvas: { graph: 'fabric_canvas', slot: 'trim', roughness: 0.94, metallic: 0 },
  ashlar: { graph: 'stone_ashlar', slot: 'wall', roughness: 0.9, metallic: 0 },
  granite: { graph: 'stone_granite', slot: 'trim', roughness: 0.88, metallic: 0 },
  plaster: { graph: 'plaster_lime', slot: 'wall', roughness: 0.94, metallic: 0 },
  concrete: { graph: 'concrete_plain', slot: 'foundation', roughness: 0.92, metallic: 0 },
  metal: { graph: 'metal_painted', slot: 'trim', roughness: 0.62, metallic: 0 },
  wood: { graph: 'wood_plain', slot: 'trim', roughness: 0.86, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.24, metallic: 0.14 },
  glassClear: {
    slot: 'window',
    localRef: 'palette:#efffff',
    name: 'clear-lantern-glass',
    roughness: 0.16,
    metallic: 0.04,
    baseColorFactor: [1, 1, 1, 0.22],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  limestone: { graph: 'stone_limestone', slot: 'wall', roughness: 0.9, metallic: 0 },
  rubble: { graph: 'stone', slot: 'wall', roughness: 0.94, metallic: 0 },
  tiles: { graph: 'tile_ceramic', slot: 'roof', roughness: 0.85, metallic: 0 },
  lap: { graph: 'wood_painted_lap', slot: 'wall', roughness: 0.86, metallic: 0 },
  slate: { graph: 'slate', slot: 'roof', roughness: 0.88, metallic: 0 },
};
async function emit(path, bytes) {
  let previous;
  try {
    previous = await readFile(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (check) {
    if (
      !previous ||
      (!previous.equals(bytes) &&
        previous.toString('utf8').replaceAll('\r\n', '\n') !== bytes.toString('utf8'))
    )
      throw new Error(`${path}: stale or missing source`);
    return;
  }
  if (previous?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}
for (const id of selected ?? [])
  if (!studies.some((study) => study.id === id)) throw new Error(`Unknown lighthouse id ${id}`);
for (const asset of studies.filter((study) => !selected || selected.includes(study.id))) {
  if (candidates.find((candidate) => candidate.id === asset.id)?.wikidataId !== asset.wikidataId)
    throw new Error(`${asset.id}: catalog identity changed`);
  const key = `${asset.id.toLowerCase()}_${asset.key}`,
    assetId = `molen.worldgen.structure.${key}`,
    dir = structureSourceDirectory(key),
    modelPath = resolve(dir, 'models/source.glb');
  try {
    const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    if (hash(await readFile(modelPath)) !== source.files.models[0].sha256)
      throw new Error(
        `${asset.id}: source master differs from generator baseline; preserve artist edits before regenerating`,
      );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const out = new MeshBufferBuilder();
  const authoring = createArchitecturalSurfaceAuthoring(surfaces, {
    metricTriangleUv: asset.metricTriangleUv,
    defaultLocalName: 'lantern-glass-and-dark-recess',
    legacyAlphaFields: true,
  });
  asset.build(authoring.wrap(out));
  const mesh = out.finalize();
  smoothMeshNormals(mesh, asset.smoothNormalSlots ?? ['trim', 'foundation'], 32);
  if (asset.normalAt)
    for (const group of mesh.groups)
      for (let index = group.start; index < group.start + group.count; index++) {
        const vertex = mesh.indices[index],
          p = Array.from(mesh.positions.slice(vertex * 3, vertex * 3 + 3)),
          normal = asset.normalAt(
            p,
            group.slot,
            group.materialRef,
            Array.from(mesh.normals.slice(vertex * 3, vertex * 3 + 3)),
          );
        if (normal) mesh.normals.set(normal, vertex * 3);
      }
  validateAuthoredMesh(mesh, asset.id);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < mesh.positions.length; i++) {
    min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
    max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
  }
  const materials = authoring.materials(mesh.groups);
  const glb = Buffer.from(encodeGlb(mesh, materials, `Molen original ${asset.title}`));
  const { build, normalAt, ...data } = asset;
  void normalAt;
  const spec = {
    ...data,
    assetId,
    category: 'lighthouse',
    quality: 'detailed',
    actualBounds: { min, max },
    geometrySource:
      'Original component-authored exterior mesh using cited dimensional evidence and separately described photo/map reconstructions. No downloaded mesh, texture or reference image is embedded.',
    sourceLicense:
      'Original geometry under the repository license. Cited sources retain their own rights; OSM-derived axes/footprint evidence © OpenStreetMap contributors, ODbL 1.0.',
    materialMethod:
      'Shared canonical material graphs with metric UV repeats in extras.molenSurface; portable glTF PBR factors and vertex colors remain. Dark recesses/lantern panels retain local fallback materials.',
    sharedSurfaces: materials
      .filter((material) => material.sharedSurface)
      .map((material) => ({
        ref: material.sharedSurface.ref,
        slot: material.sharedSurface.slot,
        repeatMeters: MATERIAL_REPEAT_METERS[material.name],
      })),
    reviewStatus:
      'Source geometry ready; fallback/shared renders, maximum fidelity and geographic fit require separate review.',
    importOptions: { optimize: false },
    importReason:
      'Keep thin gallery rails, lightning conductors, window reveals and small anchors until a measured LOD chain is reviewed.',
  };
  const h = max[1],
    extent = Math.max(max[0] - min[0], h, max[2] - min[2]);
  const scene = {
    format: 'molen/scene@3',
    name: `${asset.title} asset preview`,
    seed: key,
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
            pos: [0, asset.previewGroundY ?? -0.14, 0],
            rot: [0, 0, 0, 1],
            scale: [extent * 1.6, 0.2, extent * 1.6],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: asset.id === 'N0643' ? 'palette:#4c6e77' : 'palette:#858878',
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
    camera: {
      mode: 'fixed',
      position: [extent * 0.68, h * 0.64, extent * 1.2],
      lookAt: [0, h * 0.47, 0],
      fov: 38,
      ...asset.previewCamera,
    },
    physics: { engine: 'none' },
  };
  const optional = (
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
      generators: [],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png', ...optional],
    },
  };
  const readme = `# ${asset.title} — ${asset.id}\n\n![Lit Molen preview](preview.png)\n\n${asset.visualBrief}\n\n## Identity and evidence\n\nExact catalog identity **${asset.wikidataId}**. Source facts: \`${JSON.stringify(asset.sourceFacts)}\`. The source specification keeps published dimensions separate from reconstructed details.\n\n${asset.referencePages.map((url) => `- ${url}`).join('\n')}\n\n${asset.referenceRights}\n\n## Authored geometry and materials\n\n${mesh.triangleCount.toLocaleString('en-US')} triangles, ${mesh.vertexCount.toLocaleString('en-US')} vertices, ${mesh.groups.length} surface groups; ${glb.length.toLocaleString('en-US')} source bytes. SHA-256: \`${hash(glb)}\`. Actual bounds: ${min.map((n) => n.toFixed(3)).join(', ')} to ${max.map((n) => n.toFixed(3)).join(', ')} m.\n\n${spec.materialMethod} Shared references: ${spec.sharedSurfaces.map((surface) => `\`${surface.ref}\` (${surface.repeatMeters.join(' × ')} m)`).join(', ')}. Model-native axes: ${JSON.stringify(asset.nativeAxes)}.\n\n## Placement proposal\n\n${asset.geographicProposal.notes} Proposed anchor ${asset.geographicProposal.anchor.join(', ')} (longitude, latitude), heading ${asset.geographicProposal.heading} radians. Elevation policy: **${asset.geographicProposal.elevationMode}**. This is a reviewable proposal, not a completed site-fit certification. Ordinary ground models use terrain contact; Kiipsaare requires an offshore water/base-height check.\n\n## Limitations and review\n\n${asset.limitations.map((note) => `- ${note}`).join('\n')}\n\nNear/far fixtures are in \`spec.qaCameras\`. Float32 finite geometry, triangle degeneracy and winding are checked by the generator. Rendering, shared-material alignment, maximum-fidelity and geographic reviews remain pending until their hash-bound reports exist.\n\nRegenerate with \`node packages/worldgen/scripts/generate-lighthouse-models.mjs --ids=${asset.id}\`; add \`--check\` for reproducibility. Editable component recipes are in \`packages/worldgen/scripts/lighthouse-models.mjs\`. The generator protects artist-edited master hashes and preserves import/capture/shared-capture/QA documents.\n`;
  await emit(modelPath, glb);
  for (const [name, value] of [
    ['spec.json', spec],
    ['scene.json', scene],
    ['source.json', source],
  ])
    await emit(resolve(dir, name), Buffer.from(`${JSON.stringify(value, null, 2)}\n`));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    `${asset.id} ${assetId}: ${mesh.triangleCount} triangles, ${glb.length} bytes; bounds ${JSON.stringify({ min, max })}`,
  );
}
