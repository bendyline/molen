/** Emit the researched original Severn Bridge source bundle, without editing any catalog. */

import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { smoothMeshNormals, validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { biomeJson } from './format-json.mjs';
import { buildSevern, severnStudy as study } from './severn-bridge-model.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const check = process.argv.includes('--check');
const key = `${study.id.toLowerCase()}_${study.key}`;
const assetId = `molen.worldgen.structure.${key}`;
const dir = structureSourceDirectory(key);
const modelPath = resolve(dir, 'models/source.glb');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const materials = {
  wall: { name: 'white-painted-steel', roughness: 0.63, metallic: 0.08 },
  foundation: { name: 'pier-and-anchorage-concrete', roughness: 0.91, metallic: 0 },
  metal: { name: 'painted-and-galvanized-fittings', roughness: 0.48, metallic: 0.42 },
  cable: { name: 'wrapped-cable-and-hanger-steel', roughness: 0.51, metallic: 0.42 },
  road: { name: 'asphalt-footways-and-markings', roughness: 0.95, metallic: 0 },
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
      throw new Error(`${path}: stale or missing generated source`);
    return;
  }
  if (previous?.equals(bytes)) return;
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

// A generator is not allowed to discard manual edits to the editable master.
try {
  const source = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
  const current = await readFile(modelPath);
  if (hash(current) !== source.files.models[0].sha256)
    throw new Error(
      `${key}: artist-edited master differs from generator baseline; preserve it before regenerating`,
    );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/next-1000/candidates.json'), 'utf8'),
);
const candidate = catalog.candidates.find((entry) => entry.id === study.id);
if (candidate?.wikidataId !== 'Q1850537')
  throw new Error('N0005 is not the expected original Severn Bridge identity');

const out = new MeshBufferBuilder();
buildSevern(out);
const mesh = out.finalize();
smoothMeshNormals(mesh, ['cable'], 35);
validateAuthoredMesh(mesh, study.id);
const min = [Infinity, Infinity, Infinity],
  max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < mesh.positions.length; i++) {
  min[i % 3] = Math.min(min[i % 3], mesh.positions[i]);
  max[i % 3] = Math.max(max[i % 3], mesh.positions[i]);
}
const glb = Buffer.from(
  encodeGlb(
    mesh,
    mesh.groups.map((group) => materials[group.slot]),
    'Molen original 1966 Severn Bridge',
  ),
);
const qaCameras = [
  { name: 'near-tower', position: [532, 87, 108], lookAt: [493.75, 79, 0] },
  { name: 'near-deck', position: [400, 42, 26], lookAt: [438, 35.5, 11.75] },
  { name: 'near-hangers', position: [36, 44, 27], lookAt: [0, 40, 11.75] },
  { name: 'under-deck', position: [475, 22, 37], lookAt: [493.75, 31, 0] },
  { name: 'far-crossing', position: [50, 440, 1800], lookAt: [0, 70, 0] },
];
const spec = {
  planId: study.id,
  id: study.id,
  assetId,
  title: candidate.title,
  category: 'bridge',
  quality: 'detailed',
  wikidataId: candidate.wikidataId,
  referenceCoordinate: candidate.referenceCoordinate,
  visualBrief: study.brief,
  size: study.size,
  actualBounds: { min, max },
  nativeAxes: study.nativeAxes,
  sourceFacts: study.sourceFacts,
  reconstruction: study.reconstruction,
  referencePages: study.refs,
  scaleBasis:
    'Historic England span dimensions; Severn Bridges Trust technical accounts for steel box, piers, tower spacing and suspension system. Reconstructed dimensions and unresolved datums are listed separately.',
  geometrySource:
    'Original deterministic Molen geometry authored from documented dimensions and construction descriptions. No downloaded mesh or photographic texture is embedded.',
  sourceLicense:
    'Original geometry under the repository license. Reference publications and photographs retain their own rights and are not redistributed.',
  materialMethod:
    'Five restrained vertex-color PBR materials with metallic/roughness values, including distinct painted steel, cables, fittings, concrete and asphalt. No baked shadows or bitmap textures.',
  reviewStatus: 'source-geometry; near/far visual and geographic verification required',
  placementStatus:
    'Reference coordinate only. Original-crossing identity is confirmed; axis, anchorages, road alignment and vertical datum require site-fit review. Do not activate through generic terrain draping.',
  limitations: study.limitations,
  qaCameras,
  importOptions: { optimize: false },
  importReason:
    'A 1,637.5 m envelope with 0.044 m parapet pickets, 0.05 m hangers and narrow markings loses those details under whole-object position quantization. Preserve float positions until measured segmented LOD assets are authored.',
  mesh: {
    triangles: mesh.triangleCount,
    vertices: mesh.vertexCount,
    materials: mesh.groups.length,
    bytes: glb.length,
    sha256: hash(glb),
  },
};
const scene = {
  format: 'molen/scene@3',
  name: 'Original Severn Bridge asset preview',
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
        transform: { pos: [0, -0.15, 0], rot: [0, 0, 0, 1], scale: [1740, 0.2, 800] },
        renderable: {
          kind: 'primitive',
          ref: 'box',
          materialRef: 'palette:#697b80',
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
  camera: { mode: 'fixed', position: [615, 155, 300], lookAt: [400, 75, 0], fov: 42 },
  physics: { engine: 'none' },
};
const optionalReports = (
  await readdir(dir).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  })
)
  .filter((name) => ['import-report.json', 'capture-report.json', 'qa.json'].includes(name))
  .sort();
const source = {
  format: 'molen/source-bundle@1',
  id: assetId,
  kind: 'static-structure',
  title: candidate.title,
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
const readme = `# Severn Bridge — original 1966 crossing\n\n![Lit Molen preview](preview.png)\n\n${study.brief}\n\n## Identity and authored scope\n\nN0005 / Wikidata Q1850537 is the original **M48 Severn suspension bridge**. It is not the M4 Prince of Wales Bridge. The authored suspension span is 1,597.5 m; simplified anchorage exteriors extend the asset to 1,637.5 m. Separate Aust, Beachley and Wye approach structures are outside this asset. +X points toward Aust, +Y is up, and the horizontal origin is the main-span midpoint.\n\n## Evidence and uncertainty\n\nThe [Historic England listing](${study.refs[0]}) gives the 987.5 m main span and two 305 m side spans. [Severn Bridges Trust construction details](${study.refs[2]}) give 23.5 m tower-leg spacing and 40 × 11.5 m cutwater piers. Its [deck account](${study.refs[1]}) describes the 3.048 m deep aerofoil box with corners 22.86 m apart. The [hanger account](${study.refs[3]}) gives 18.288 m clamp spacing and a usual 9.144 m longitudinal offset to each lower eye.\n\nThe detailed hanger account implies 344 hangers, while the general account says 340; this model uses 344 and records the difference. Main cables use a nominal 0.5 m diameter; the [construction account](${study.refs[5]}) gives 0.05 m original hangers. Modern replacement diameters and exact fitting profiles remain unverified. The overall 32 m deck width follows the source's 105 ft figure, whose adjacent 35 m metric conversion is inconsistent.\n\n**The vertical frame is unresolved.** [Stannah's project account](${study.refs[7]}) places tower tops 136 m above mean high water. The [Trust foundation account](${study.refs[6]}) places the deck center 37 m above mean sea level and other text rounds steel tower height to 125 m. These are not a reconciled survey frame. The source has explicit local reconstruction coordinates and must not be terrain-draped into geographic production as though Y=0 were a checked elevation. See \`spec.json\` sourceFacts, reconstruction and limitations for the complete distinction.\n\n## Source and verification\n\nOriginal deterministic geometry from \`packages/worldgen/scripts/severn-bridge-model.mjs\`, with five PBR materials and no third-party mesh or embedded photograph. ${mesh.triangleCount.toLocaleString('en-US')} triangles, ${mesh.vertexCount.toLocaleString('en-US')} vertices, ${glb.length.toLocaleString('en-US')} bytes. Actual AABB: ${min.map((n) => n.toFixed(3)).join(', ')} to ${max.map((n) => n.toFixed(3)).join(', ')} m. SHA-256: \`${hash(glb)}\`.\n\nRegenerate with \`node packages/worldgen/scripts/generate-severn-bridge.mjs\`; verify determinism with \`--check\`. The generator protects artist-edited GLB masters by comparing their baseline hash before any overwrite and validates finite attributes, triangle winding and nondegenerate Float32 geometry. Import using the normal Molen asset workflow and \`--no-optimize\`: whole-crossing position quantization destroys small parapet and cable geometry. Do not handwrite runtime asset sidecars.\n\nRuntime asset ID: \`${assetId}\`. The scene supplies an oblique tower-and-span preview; \`spec.json\` supplies near tower/deck/hanger, under-deck and full-crossing cameras. Valid source geometry is not visual acceptance: import, runtime rendering and inspected captures are separate gates.\n\n## Remaining work\n\n${study.limitations.map((text) => `- ${text}`).join('\n')}\n`;

await emit(modelPath, glb);
for (const [name, data] of [
  ['spec.json', spec],
  ['scene.json', scene],
  ['source.json', source],
])
  await emit(resolve(dir, name), Buffer.from(biomeJson(data, resolve(dir, name))));
await emit(resolve(dir, 'README.md'), Buffer.from(readme));
console.log(
  `${key}: ${mesh.triangleCount} triangles, ${glb.length} bytes, ${hash(glb)}; bounds ${JSON.stringify({ min, max })}`,
);
