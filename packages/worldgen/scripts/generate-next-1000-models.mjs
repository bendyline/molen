/** Build individually authored, original GLBs from the next-1000 candidate catalog. */

import './install-deterministic-math.mjs';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeGlb, MeshBufferBuilder } from '../dist/kernel.mjs';
import { validateAuthoredMesh } from './authored-structure-mesh.mjs';
import { buildNormandie, normandieStudy } from './pont-de-normandie-model.mjs';
import { structureAssetSidecarPath } from './structure-asset-paths.mjs';
import { box, colors, gable, prism, profile } from './structure-mesh.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const catalogPath = resolve(root, 'content/worldgen/source/next-1000/candidates.json');
const check = process.argv.includes('--check');
const selectedIds = process.argv
  .find((arg) => arg.startsWith('--ids='))
  ?.slice(6)
  .split(',');
const C = colors;
const stone = [0.73, 0.69, 0.58];
const pale = [0.84, 0.81, 0.71];
const brick = [0.52, 0.29, 0.25];

const studies = [
  normandieStudy,
  {
    id: 'N0796',
    key: 'tokyo_station',
    size: [335, 32, 31],
    brief: 'Long red-brick Marunouchi frontage, paired domes and repeated gabled roof bays',
    refs: ['https://www.syougai.metro.tokyo.lg.jp/bunkazai/heritagemap/chuo/'],
  },
  {
    id: 'N0946',
    key: 'stonehenge',
    size: [38, 8, 38],
    brief: 'Incomplete outer sarsen ring with surviving lintels, inner trilithons and bluestones',
    refs: [
      'https://www.english-heritage.org.uk/visit/places/stonehenge/history-and-stories/history/',
    ],
  },
];

function buildTokyoStation(out) {
  box(out, 'wall', [-167.5, 0, -14], [167.5, 21, 14], brick);
  box(out, 'foundation', [-170, 0, -15], [170, 2.2, 15], C.stone);
  gable(out, -169, 169, -15, 15, 21, 6, C.roof);
  for (const x of [-116, 116]) {
    box(out, 'wall', [x - 22, 0, -16], [x + 22, 23, 16], brick);
    profile(
      out,
      [
        [23, 17, 17],
        [26, 17, 17, 'roof', pale],
        [30, 10, 10, 'roof', C.roof],
        [32, 0.3, 0.3, 'roof', C.copper],
      ],
      16,
      [x, 0],
    );
    for (const z of [-16.1, 16.1])
      box(out, 'trim', [x - 6, 3, z - 0.2], [x + 6, 15, z + 0.2], pale);
  }
  for (let i = 0; i < 72; i++) {
    const x = -162 + i * 4.55;
    if (Math.abs(Math.abs(x) - 116) < 22) continue;
    for (const z of [-14.07, 14.02])
      for (const y of [5.2, 13])
        box(out, 'window', [x - 1.15, y, z], [x + 1.15, y + 3.8, z + 0.05], C.dark);
    if (i % 4 === 0) box(out, 'trim', [x - 2.15, 2.2, 14.08], [x - 1.8, 21, 14.25], pale);
  }
  for (const x of [-68, 0, 68]) {
    box(out, 'trim', [x - 10, 0, 14.12], [x + 10, 18, 14.5], pale);
    box(out, 'window', [x - 7.4, 2.2, 14.51], [x + 7.4, 15.6, 14.57], C.dark);
  }
}

function rectangle(cx, cz, width, depth, angle) {
  const ca = Math.cos(angle),
    sa = Math.sin(angle);
  return [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [width / 2, depth / 2],
    [-width / 2, depth / 2],
  ].map(([x, z]) => [cx + x * ca - z * sa, cz + x * sa + z * ca]);
}

function buildStonehenge(out) {
  const missingUprights = new Set([2, 4, 9, 12, 18, 19, 22, 25]);
  const missingLintels = new Set([1, 2, 4, 7, 9, 11, 12, 15, 18, 19, 22, 25, 27]);
  const point = (i, radius, total) => {
    const t = (i * 2 * Math.PI) / total;
    return [radius * Math.cos(t), radius * Math.sin(t), t];
  };
  for (let i = 0; i < 30; i++) {
    const [x, z, t] = point(i, 15, 30);
    if (!missingUprights.has(i))
      prism(
        out,
        'wall',
        rectangle(x, z, 2.0, 1.12, t),
        0,
        5.5 + (i % 4) * 0.13,
        i % 3 === 0 ? pale : stone,
      );
    if (!missingLintels.has(i) && !missingUprights.has(i) && !missingUprights.has((i + 1) % 30)) {
      const [nx, nz] = point(i + 0.5, 15, 30);
      prism(out, 'roof', rectangle(nx, nz, 3.4, 1.55, t + Math.PI / 2), 5.42, 6.35, stone);
    }
  }
  for (let i = 0; i < 5; i++) {
    const t = Math.PI * (0.2 + i * 0.2);
    const x = 8 * Math.cos(t),
      z = 8 * Math.sin(t);
    const h = i === 2 ? 7.5 : 6.4;
    for (const side of [-1, 1])
      prism(
        out,
        'wall',
        rectangle(
          x + side * 1.5 * Math.cos(t + Math.PI / 2),
          z + side * 1.5 * Math.sin(t + Math.PI / 2),
          1.55,
          1.15,
          t,
        ),
        0,
        h,
        pale,
      );
    prism(out, 'roof', rectangle(x, z, 4.6, 1.7, t + Math.PI / 2), h - 0.1, h + 0.8, stone);
  }
  for (let i = 0; i < 17; i++) {
    const [x, z, t] = point(i, 10.3, 17);
    prism(out, 'wall', rectangle(x, z, 0.85, 0.55, t), 0, 2.3 + (i % 4) * 0.35, C.concrete);
  }
  prism(out, 'foundation', rectangle(0, -2, 2.6, 1.1, 0.12), 0, 1.15, pale);
}

const builders = {
  N0002: buildNormandie,
  N0796: buildTokyoStation,
  N0946: buildStonehenge,
};
const materials = {
  wall: { name: 'masonry-or-cladding', roughness: 0.83, metallic: 0.02 },
  foundation: { name: 'foundation-stone', roughness: 0.91, metallic: 0.01 },
  trim: { name: 'structural-detail', roughness: 0.63, metallic: 0.2 },
  roof: { name: 'roof-and-lintel', roughness: 0.76, metallic: 0.08 },
  window: { name: 'glazing', roughness: 0.25, metallic: 0.16 },
};

function sceneFor(spec) {
  const [w, h, d] = spec.size;
  const tall = h > w * 1.5;
  const far = tall ? h * 1.75 : Math.max(w * 1.15, h * 1.5, 42);
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
          renderable: { kind: 'gltf', ref: spec.assetId, shadows: { cast: true, receive: true } },
        },
      },
      {
        id: 'ground',
        components: {
          transform: { pos: [0, -0.14, 0], rot: [0, 0, 0, 1], scale: [w + 16, 0.2, d + 16] },
          renderable: {
            kind: 'primitive',
            ref: 'box',
            materialRef: 'palette:#777b72',
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
    camera:
      spec.id === 'N0002'
        ? {
            mode: 'fixed',
            position: [-710, 160, 330],
            lookAt: [-390, 97, 0],
            fov: 42,
          }
        : {
            mode: 'fixed',
            position: [
              far * (tall ? 0.22 : 0.25),
              Math.max(h * (tall ? 0.65 : 0.75), 15),
              far * (tall ? 0.9 : 0.85),
            ],
            lookAt: [0, h * (tall ? 0.48 : 0.4), 0],
            fov: 38,
          },
    physics: { engine: 'none' },
  };
}

async function emit(path, bytes) {
  if (check) {
    const old = await readFile(path);
    if (
      !old.equals(bytes) &&
      old.toString('utf8').replaceAll('\r\n', '\n') !== bytes.toString('utf8')
    )
      throw new Error(`${path}: stale source`);
  } else {
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, bytes);
  }
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
for (const study of studies) {
  if (selectedIds && !selectedIds.includes(study.id)) continue;
  const candidate = catalog.candidates.find((entry) => entry.id === study.id);
  if (!candidate) throw new Error(`${study.id}: missing catalog candidate`);
  const key = `${study.id.toLowerCase()}_${study.key}`;
  const assetId = `molen.worldgen.structure.${key}`;
  const spec = {
    planId: study.id,
    id: study.id,
    assetId,
    title: candidate.title,
    visualBrief: study.brief,
    size: study.size,
    referenceCoordinate: candidate.referenceCoordinate,
    referencePages: study.refs,
    scaleBasis:
      'Selected published dimensions where cited; remaining lengths and details are provisional artistic values.',
    geometrySource:
      'Original deterministic Molen mesh generator; no third-party model or bitmap texture.',
    placementStatus:
      'Reference coordinate only. Feature identity, footprint, orientation and bridge sectioning are unverified.',
    ...(study.id === 'N0002'
      ? {
          quality: 'detailed',
          reviewStatus: 'source-geometry; visual and geographic verification required',
          nativeAxes: study.nativeAxes,
          qaCameras: [
            { name: 'near-pylon', position: [-625, 105, 180], lookAt: [-428, 113, 0] },
            { name: 'near-deck', position: [-402, 64, 16], lookAt: [-350, 63.4, 9.5] },
            { name: 'far-crossing', position: [100, 490, 1900], lookAt: [-95, 80, 0] },
          ],
          sourceFacts: study.sourceFacts,
          limitations: study.limitations,
          sourceLicense:
            'Original Molen geometry. Referenced operator documents are consulted, not copied or redistributed.',
          importOptions: { optimize: false },
          importReason:
            'Whole-crossing position quantization destroys 0.13 m road stripes and 0.11–0.168 m cables over a 2,141 m envelope. Preserve float positions until a segmented/LOD import is authored.',
          scaleBasis:
            'Main dimensions and construction systems follow the cited CCI Seine Estuaire technical sheet. Approach allocation, exact road curvature and fittings remain reconstructed; see limitations.',
          placementStatus:
            'Main-span midpoint and longitudinal axis have OSM evidence; CMH vertical datum conversion and road fit remain unresolved. Do not activate as a terrain-draped point landmark.',
        }
      : {}),
  };
  const out = new MeshBufferBuilder();
  builders[study.id](out);
  const mesh = out.finalize();
  if (study.id === 'N0002') validateAuthoredMesh(mesh, study.id);
  if (mesh.triangleCount < 100) throw new Error(`${study.id}: mesh too small`);
  const glb = Buffer.from(
    encodeGlb(
      mesh,
      mesh.groups.map((group) => materials[group.slot] ?? { name: group.slot }),
      `molen ${study.id}`,
    ),
  );
  const sha256 = `sha256:${createHash('sha256').update(glb).digest('hex')}`;
  const dir = structureSourceDirectory(key);
  // The source manifest pins the generator baseline, independent of later runtime imports.
  // Do not silently replace an artist's edited master when updating generator details.
  try {
    const previousSource = JSON.parse(await readFile(resolve(dir, 'source.json'), 'utf8'));
    const previousModel = await readFile(resolve(dir, 'models/source.glb'));
    const previousHash = `sha256:${createHash('sha256').update(previousModel).digest('hex')}`;
    if (previousHash !== previousSource.files.models[0].sha256) {
      throw new Error(
        `${study.id}: artist-edited master differs from generator baseline; preserve it before regenerating`,
      );
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
          sha256,
        },
      ],
      scripts: [],
      textures: [],
      sounds: [],
      documents: ['README.md', 'preview.png', ...optionalReports],
    },
  };
  let readme = `# ${candidate.title} — ${study.id}\n\n![Lit Molen preview](preview.png)\n\nOriginal stylized geometry generated by \`packages/worldgen/scripts/generate-next-1000-models.mjs\`. ${study.brief}.\n\nWorking dimensions: ${study.size.join(' × ')} meters (X × Y × Z). ${spec.scaleBasis} +Y is up; origin is at ground or bridge datum. Asset ID: \`${assetId}\`.\n\nReference pages: ${study.refs.map((url) => `[source](${url})`).join(', ')}. [Catalog identity](${candidate.source}). Coordinates are reference points, not verified placement anchors. No third-party mesh or bitmap texture is included.\n\nThe editable master is \`models/source.glb\`; \`source.json\` pins its hash. The imported runtime GLB and sidecar live under \`content/worldgen/${structureAssetSidecarPath(assetId).replace(/\/asset\.json$/, '')}\`. Regenerate with \`node packages/worldgen/scripts/generate-next-1000-models.mjs\`, import with \`node packages/worldgen/scripts/import-next-1000-models.mjs\`, and verify with both scripts' \`--check\` mode and \`node scripts/check-source-bundles.mjs\`.\n\nThis is a visual study. Surveyed placement, facade detail, LOD and static collision refinement are pending.\n`;
  if (study.id === 'N0002')
    readme += `\n## Construction evidence and remaining review\n\n${study.nativeAxes.origin}. The authored +X direction is south; the north approach is longer. The operator technical sheet, pages 15–24, supplies pylon levels and section drawings, 184 stays, the 21.2 m steel box section, 624 m central steel section, 26 approach piers, and 6% maximum approach grade. The public overall width is 23.6 m including aerodynamic edges. Geometry includes separate stays, anchor sleeves, clevis plates, bolts, cross ties, expansion joints, road markings, pedestrian margins, rail posts, blue aerofoil cornices, pylon recesses and formwork joints. No reference illustrations are redistributed.\n\n${study.limitations.map((line) => `- ${line}`).join('\n')}\n\nImport with \`--no-optimize\`: ${spec.importReason}\n`;
  await emit(resolve(dir, 'models/source.glb'), glb);
  await emit(resolve(dir, 'spec.json'), Buffer.from(`${JSON.stringify(spec, null, 2)}\n`));
  await emit(
    resolve(dir, 'scene.json'),
    Buffer.from(`${JSON.stringify(sceneFor(spec), null, 2)}\n`),
  );
  await emit(resolve(dir, 'source.json'), Buffer.from(`${JSON.stringify(source, null, 2)}\n`));
  await emit(resolve(dir, 'README.md'), Buffer.from(readme));
  console.log(`${study.id}: ${mesh.triangleCount} triangles, ${glb.length} source bytes`);
}
