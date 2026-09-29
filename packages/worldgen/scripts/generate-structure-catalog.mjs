/** Generate the 97 planned Molen structure masters. The three reference assets have their own
 * hand-tuned generator in generate-site-structures.mjs. This script reads the 100-item design
 * brief, emits one editable source bundle per remaining entry, and never imports runtime assets.
 */

import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { biomeJson } from './format-json.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { buildBridge } from './structure-bridges.mjs';
import { buildLandmark } from './structure-landmarks.mjs';
import { buildInfrastructure, buildUrban } from './structure-recipes.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const packageRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const planPath = resolve(packageRoot, 'examples/world-explorer/STRUCTURE-EXPANSION-PLAN.md');
const check = process.argv.includes('--check');
const referenceIds = new Set(['A01', 'C01', 'C02']);
const materials = {
  wall: { name: 'structure-cladding', roughness: 0.67, metallic: 0.16 },
  roof: { name: 'roof-or-deck', roughness: 0.78, metallic: 0.1 },
  trim: { name: 'structural-trim', roughness: 0.55, metallic: 0.42 },
  foundation: { name: 'structural-foundation', roughness: 0.9, metallic: 0.02 },
  window: { name: 'glazing-or-reflective-panel', roughness: 0.28, metallic: 0.13 },
};

const pacificHeights = [
  184, 147, 284, 58, 35, 23, 34, 50, 48, 42, 55, 46, 46, 168, 75, 260, 326, 64, 52, 93,
];
const globalHeights = [
  381, 319, 541, 87, 88, 169, 553, 330, 50, 96, 38, 48, 172, 67, 333, 634, 508, 452, 632, 828,
];
const bridgeLengths = [
  1966, 2350, 2020, 1900, 2400, 1800, 2200, 1600, 1830, 1850, 2100, 244, 2500, 1150, 2000, 2460,
  135, 52, 520, 1550,
];
const bridgeWidths = [
  27, 40, 32, 33, 28, 30, 33, 34, 26, 31, 32, 25, 34, 49, 33, 28, 15, 17, 11, 29,
];
const urbanHeights = [
  80, 110, 42, 31, 95, 28, 45, 24, 38, 36, 19, 27, 25, 24, 31, 15, 10, 34, 23, 24,
];
const infrastructureHeights = [
  40, 42, 12, 40, 26, 8, 48, 100, 9, 52, 34, 64, 42, 34, 30, 16, 17, 12, 14, 44,
];

function slug(title) {
  return title
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 48)
    .replaceAll(/_+$/g, '');
}

function sizeFor(code) {
  const index = Number(code.slice(1)) - 1;
  switch (code[0]) {
    case 'A':
      return [
        index === 10 ? 70 : index === 7 || index === 8 ? 150 : index === 6 ? 140 : 65,
        pacificHeights[index],
        index === 7 || index === 8 ? 110 : 55,
      ];
    case 'B':
      return [
        index === 11 ? 120 : index === 13 ? 145 : 60,
        globalHeights[index],
        index === 11 ? 95 : 58,
      ];
    case 'C':
      return [bridgeLengths[index], index === 11 ? 72 : 170, bridgeWidths[index]];
    case 'D':
      return [
        index === 14 || index === 18 ? 140 : index === 13 ? 110 : 70,
        urbanHeights[index],
        index === 14 || index === 18 ? 60 : 48,
      ];
    case 'E':
      return [
        index === 14 ? 300 : index === 3 ? 170 : index === 8 ? 110 : 60,
        infrastructureHeights[index],
        index === 14 ? 26 : index === 3 ? 28 : 45,
      ];
    default:
      throw new Error(`Unknown plan code ${code}`);
  }
}

function previewScene(spec) {
  const [width, height, depth] = spec.size;
  const bridge = spec.planId.startsWith('C');
  const far = bridge
    ? Math.max(190, width * 0.48)
    : Math.max(Math.max(width, depth) * 1.9, height * 1.35);
  const camera = bridge
    ? { position: [width * 0.08, height * 1.4, far], lookAt: [0, height * 0.29, 0], fov: 45 }
    : { position: [far * 0.62, height * 0.8, far], lookAt: [0, height * 0.46, 0], fov: 42 };
  return {
    format: 'molen/scene@3',
    name: `${spec.title} asset preview`,
    seed: spec.id,
    tickRate: 30,
    entities: [
      {
        id: 'structure',
        components: {
          transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
          renderable: { kind: 'gltf', ref: spec.id, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: {
            pos: [0, -0.14, 0],
            rot: [0, 0, 0, 1],
            scale: [width + (bridge ? 100 : 80), 0.2, depth + (bridge ? 200 : 80)],
          },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: bridge ? 'palette:#63899d' : 'palette:#777b72',
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
    camera: { mode: 'fixed', ...camera },
    physics: { engine: 'none' },
  };
}

async function emit(path, bytes) {
  if (check) {
    const old = await readFile(path);
    const same =
      old.equals(bytes) ||
      old.toString('utf8').replaceAll('\r\n', '\n') ===
        bytes.toString('utf8').replaceAll('\r\n', '\n');
    if (!same) throw new Error(`${path}: generated structure source is stale`);
  } else {
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, bytes);
  }
}

// JSON sources are compared by value: --check runs on every build, and formatting 291 documents
// through biome there would dominate it. Only writes pay for biome.
async function emitJson(path, value) {
  if (check) {
    const old = JSON.parse(await readFile(path, 'utf8'));
    if (JSON.stringify(old) !== JSON.stringify(value))
      throw new Error(`${path}: generated structure source is stale`);
  } else {
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, biomeJson(value, path));
  }
}

const plan = await readFile(planPath, 'utf8');
const entries = [...plan.matchAll(/^\| ([A-E]\d{2}) \| ([^|]+) \| ([^|]+) \|$/gm)].map(
  ([, planId, title, brief]) => ({ planId, title: title.trim(), brief: brief.trim() }),
);
if (entries.length !== 100 || new Set(entries.map((e) => e.planId)).size !== 100)
  throw new Error(`Expected 100 distinct plan entries, found ${entries.length}`);
const pending = entries.filter((e) => !referenceIds.has(e.planId));
if (pending.length !== 97)
  throw new Error(`Expected 97 remaining entries, found ${pending.length}`);

for (const entry of pending) {
  const key = `${entry.planId.toLowerCase()}_${slug(entry.title)}`;
  const id = `molen.worldgen.structure.${key}`;
  const spec = {
    planId: entry.planId,
    id,
    title: entry.title,
    visualBrief: entry.brief,
    size: sizeFor(entry.planId),
    scaleBasis:
      'Stylized provisional dimensions in meters, pending measured site geometry and orientation.',
    geometrySource:
      'Original deterministic Molen mesh generator; no third-party model or bitmap texture.',
  };
  const out = new MeshBufferBuilder();
  switch (entry.planId[0]) {
    case 'A':
    case 'B':
      buildLandmark(out, entry.planId, spec);
      break;
    case 'C':
      buildBridge(out, entry.planId, spec);
      break;
    case 'D':
      buildUrban(out, entry.planId, spec);
      break;
    case 'E':
      buildInfrastructure(out, entry.planId, spec);
      break;
    default:
      throw new Error(`No builder for ${entry.planId}`);
  }
  const buffers = out.finalize();
  if (buffers.triangleCount < 50) throw new Error(`${entry.planId}: suspiciously empty mesh`);
  const glb = Buffer.from(
    encodeGlb(
      buffers,
      buffers.groups.map((g) => materials[g.slot] ?? { name: g.slot }),
      `molen ${entry.planId}`,
    ),
  );
  const hash = `sha256:${createHash('sha256').update(glb).digest('hex')}`;
  const dir = structureSourceDirectory(key);
  const source = {
    format: 'molen/source-bundle@1',
    id,
    kind: 'static-structure',
    title: entry.title,
    files: {
      definitions: ['spec.json', 'scene.json'],
      models: [
        {
          path: 'models/source.glb',
          assetId: id,
          output: structureAssetSidecarPath(id),
          pipeline: 'import',
          sha256: hash,
        },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png'],
    },
  };
  const readme = `# ${entry.title} — ${entry.planId} structure asset\n\n![Lit Molen preview](preview.png)\n\nOriginal stylized geometry generated from the [100-structure plan](${relative(dir, planPath).replaceAll('\\', '/')}) by \`packages/worldgen/scripts/generate-structure-catalog.mjs\`. Visual brief: ${entry.brief}.\n\nProvisional dimensions: ${spec.size[0]} × ${spec.size[1]} × ${spec.size[2]} meters (X × Y × Z). These dimensions are artistic working values and require measured terrain/footprint alignment before geographic placement. +Y is up; the model is centered at ground or water datum. The runtime asset ID is \`${id}\`.\n\nSource: \`spec.json\`, \`models/source.glb\`; the imported runtime GLB and sidecar are under \`content/worldgen/${structureAssetSidecarPath(id).replace(/\/asset\.json$/, '')}\`. \`source.json\` pins the source hash. There are no third-party meshes, bitmap textures or texture-generation prompts. The preview is rendered by Molen from \`scene.json\`.\n\nRebuild and re-import from the repository root using \`node packages/worldgen/scripts/generate-structure-catalog.mjs\` and \`node packages/worldgen/scripts/import-structure-catalog.mjs\`. Verify with \`node packages/worldgen/scripts/generate-structure-catalog.mjs --check\`, \`node scripts/check-source-bundles.mjs\`, and \`molen asset inspect ${id} --project content/worldgen/project.json --verify\`.\n\n${entry.planId[0] === 'C' ? 'The full-span design master needs tile-sized sections, measured approach transitions and segmented driveable collision before Earth placement.' : 'Site anchor, exact facade detail, LOD and collision refinement remain to be completed before in-place Earth-viewer release.'}\n`;
  await emit(resolve(dir, 'models/source.glb'), glb);
  await emitJson(resolve(dir, 'spec.json'), spec);
  await emitJson(resolve(dir, 'scene.json'), previewScene(spec));
  await emitJson(resolve(dir, 'source.json'), source);
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(
    `${entry.planId} ${key}: ${buffers.triangleCount} triangles, ${glb.length} source bytes`,
  );
}
