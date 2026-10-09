// Three real runtime recipes in a shared, meter-scale frame. GLBs are local QA artifacts only.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { wildlifeGeometry } from '../../../packages/ambient/dist/client.mjs';
import {
  importAsset,
  inspectAsset,
  screenshotAsset,
  screenshotScene,
} from '../../../packages/tooling/dist/index.mjs';
import { createPlantGeometry } from '../../../packages/worldgen/dist/client.mjs';
import { encodeGlb } from '../../../packages/worldgen/dist/kernel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const brush = process.argv.includes('--brush');
const out = resolve(root, `.artifacts/regional-world/${brush ? 'brush-models' : 'diversity'}`);
await mkdir(out, { recursive: true });
const projectPath = resolve(out, 'project.json');
try {
  await readFile(projectPath);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
  await writeFile(
    projectPath,
    JSON.stringify(
      {
        format: 'molen/project@1',
        name: 'regional-diversity-review',
        scenes: { main: 'scene.json' },
        defaultScene: 'main',
        types: [],
        assets: {},
        reservations: [{ namespace: 'diversity', owner: 'regional-preview' }],
      },
      null,
      2,
    ),
  );
}
const { plants } = JSON.parse(
  await readFile(resolve(root, 'content/ecology/regional.catalog.json'), 'utf8'),
);
const { animals } = JSON.parse(
  await readFile(resolve(root, 'content/wildlife/regional.catalog.json'), 'utf8'),
);
const plantNames = brush
  ? [
      'scrub',
      'dry_scrub',
      'chaparral',
      'grass',
      'fern_colony',
      'shade_shrub',
      'thorn_thicket',
      'bramble',
      'broadleaf_herbs',
      'ground_vine',
      'moss_mat',
      'leaf_litter',
      'fallen_log',
      'liana_canopy',
    ]
  : [
      'oak',
      'spruce',
      'coconut',
      'saguaro',
      'agave',
      'bamboo',
      'banana',
      'grass',
      'fern',
      'reeds',
      'mangrove',
      'snag',
    ];
const animalNames = brush
  ? []
  : [
      'roe_deer',
      'red_fox',
      'red_squirrel',
      'european_hare',
      'red_kangaroo',
      'savanna_elephant',
      'woodland_songbird',
      'warm_ground_lizard',
      'freshwater_fish_group',
      'flower_visiting_insect',
    ];
const requested = process.argv.filter((a) => a.startsWith('--name=')).map((a) => a.slice(7));
const evidence = [];
for (const [kind, catalog, names, suffixes] of [
  ['plant', plants, plantNames, ['', '.spreading', '.slender']],
  ['animal', animals, animalNames, ['', '.compact', '.rangy']],
]) {
  for (const name of names) {
    if (requested.length && !requested.includes(name)) continue;
    const recipes = suffixes.map((suffix) =>
      catalog.find((p) => p.id.endsWith(`.${name}${suffix}`)),
    );
    if (recipes.some((r) => !r)) throw new Error(`Missing triplet: ${name}`);
    const geometries = recipes.map((r) =>
      kind === 'plant' ? createPlantGeometry(r) : wildlifeGeometry(r, 0).geometry,
    );
    const spacing =
      Math.max(
        ...geometries.map((g) => {
          g.computeBoundingBox();
          return Math.max(
            g.boundingBox.max.x - g.boundingBox.min.x,
            g.boundingBox.max.z - g.boundingBox.min.z,
          );
        }),
      ) * 1.55;
    const height = Math.max(...geometries.map((g) => g.boundingBox.max.y));
    const positions = [],
      normals = [],
      colors = [];
    geometries.forEach((g, i) => {
      g.translate((i - 1) * spacing, 0, 0);
      positions.push(...g.getAttribute('position').array);
      normals.push(...g.getAttribute('normal').array);
      colors.push(...g.getAttribute('color').array);
      g.dispose();
    });
    const vertexCount = positions.length / 3;
    const bytes = encodeGlb(
      {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        colors: Uint8Array.from(colors, (v) => Math.round(v * 255)),
        indices: Uint32Array.from({ length: vertexCount }, (_, i) => i),
        uvs: new Float32Array(vertexCount * 2),
        vertexCount,
        triangleCount: vertexCount / 3,
        bytes: 0,
        groups: [{ start: 0, count: vertexCount, slot: 'wall', materialRef: 'palette:#ffffff' }],
      },
      [{ name: `${name} variants`, roughness: 0.92, metallic: 0 }],
      'Molen regional diversity QA',
    );
    const source = resolve(out, `${name}.source.glb`),
      ref = `diversity.${name}`;
    await writeFile(source, bytes);
    const imported = await importAsset({
      path: source,
      id: ref,
      projectPath,
      cwd: out,
      force: true,
      optimize: false,
    });
    if (!imported.ok) throw new Error(imported.error);
    const inspected = await inspectAsset({ ref, projectPath, verify: true });
    if (!inspected.ok) throw new Error(inspected.error);
    const shot = await screenshotAsset({
      ref,
      projectPath,
      outDir: resolve(out, name),
      angles: 2,
      size: [1440, 800],
      reflections: true,
      antialias: true,
      clearColor: '#cbd8dc',
    });
    if (!shot.ok) throw new Error(shot.error);
    if (brush) {
      const scenePath = resolve(out, `${name}.scene.json`);
      await writeFile(
        scenePath,
        JSON.stringify(
          {
            format: 'molen/scene@3',
            name: `${name} brush comparison`,
            seed: 'brush-review',
            tickRate: 30,
            entities: [
              {
                id: 'plants',
                components: {
                  transform: { pos: [0, 0, 0] },
                  renderable: { kind: 'gltf', ref, shadows: { cast: true, receive: true } },
                },
              },
              {
                id: 'ground',
                components: {
                  transform: { pos: [0, -0.1, 0] },
                  renderable: {
                    kind: 'primitive',
                    ref: 'box',
                    primitive: { size: [spacing * 5, 0.2, spacing * 3] },
                    materialRef: 'palette:#b2ac91',
                    shadows: { receive: true },
                  },
                },
              },
              {
                id: 'light',
                components: {
                  environment: {
                    ambient: { sky: '#d0dfeb', ground: '#8b8c6d', intensity: 1.5 },
                    sun: {
                      direction: [-8, 14, 9],
                      color: '#fff5dd',
                      intensity: 2,
                      castShadow: true,
                    },
                    background: '#cbd8dc',
                  },
                },
              },
            ],
          },
          null,
          2,
        ),
      );
      const frames = [];
      for (const [i, side] of [1, -1].entries()) {
        const path = resolve(out, name, `context_${i}.png`);
        const result = await screenshotScene({
          scenePath,
          projectPath,
          outPath: path,
          camera: {
            position: [
              spacing * 0.14 * side,
              height * 0.55 + spacing * 0.25,
              Math.max(height * 1.3, spacing * 2.2) * side,
            ],
            lookAt: [0, height * 0.4, 0],
          },
          size: [1440, 800],
          ticks: 1,
        });
        if (!result.ok) throw new Error(result.error);
        frames.push({ name: `angle_${i}`, path });
      }
      shot.frames = frames;
    }
    const report = {
      name,
      kind,
      family: recipes[0].family ?? recipes[0].body.family,
      recipes: recipes.map((r) => r.id),
      hash: imported.sidecar?.hash,
      triangles: vertexCount / 3,
      frames: shot.frames,
    };
    evidence.push(report);
    await writeFile(resolve(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
    console.log(JSON.stringify({ name, frames: shot.frames?.map((f) => f.path) }));
  }
}
