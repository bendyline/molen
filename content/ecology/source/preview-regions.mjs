// Controlled landscape composition fixtures, not photographs or performance benchmarks.
// Placements come from the actual Earth adapter, ecological data, scatter rules and budgets.
// They are baked for portable Molen scene captures; the live viewer uses shared instances.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EARTH_EXPOSURE,
  EARTH_LIGHTING,
  EARTH_SKY_PALETTE,
  EARTH_TONE_MAPPING,
} from '../../../packages/earth/dist/client.mjs';
import {
  createEmptyTerrainSemanticTile,
  wgs84ToWorld,
} from '../../../packages/terrain/dist/kernel.mjs';
import {
  importAsset,
  inspectAsset,
  runSimulation,
  screenshotScene,
} from '../../../packages/tooling/dist/index.mjs';
import { createPlantGeometry } from '../../../packages/worldgen/dist/client.mjs';
import {
  encodeGlb,
  FLAT_GROUND,
  resolveStylePackDocuments,
} from '../../../packages/worldgen/dist/kernel.mjs';
import {
  createRegionalEnvironment,
  createRegionResolver,
  generateWorldgenTile,
  worldgenTileBudgetForQuality,
} from '../../../packages/worldgen-earth/dist/kernel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world/landscapes');
await mkdir(out, { recursive: true });
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const pack = await resolveStylePackDocuments(
  await json('content/worldgen/stylepack.json'),
  (path) => json(`content/worldgen/${path}`),
);
const atlas = await json('content/earth/world.atlas.json');
const ecology = await json('content/ecology/ecoregions.json');
const catalog = await json('content/ecology/regional.catalog.json');
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
        name: 'regional-landscape-qa',
        scenes: { main: 'scene.json' },
        defaultScene: 'main',
        types: [],
        assets: {},
        reservations: [{ namespace: 'ecology', owner: 'regional-landscape-qa' }],
      },
      null,
      2,
    ),
  );
}
const sites = [
  ['sonoran', -111.05, 32.25, 'scrub'],
  ['amazon', -60.1, -3.1, 'forest'],
  ['mediterranean', 15, 37.5, 'forest'],
  ['pacific_coast', -122.33, 47.6, 'forest'],
  ['siberian', 100, 62, 'forest'],
  ['tropical_park', 178.4, -18.1, 'park'],
  ['temperate', 8.4, 48.9, 'forest'],
  ['olive_orchard', 15, 37.5, 'orchard', 'olives'],
  ['date_grove', 5.73, 34.85, 'orchard', 'dates'],
  ['banana_grove', -84.1, 10.1, 'orchard', 'bananas'],
  ['east_african_savanna', 34.8, -2.3, 'grassland'],
  ['australian_forest', 151, -33.5, 'forest'],
  ['sundarbans_mangrove', 89.6, 21.9, 'mangrove'],
  ['tibetan_alpine', 90, 32, 'grassland'],
  ['sahara_scrub', 12, 24, 'scrub'],
  ['arctic_tundra', -110, 68, 'grassland'],
];
const monthArg = process.argv.find((arg) => arg.startsWith('--month='));
const vegetationMonth = monthArg ? Number(monthArg.slice(8)) : undefined;
const requested = process.argv
  .filter((arg) => arg.startsWith('--site='))
  .map((arg) => arg.slice(7));
const qualities = process.argv.includes('--high-only') ? ['high'] : ['economy', 'high'];
const size = 160,
  evidence = [];
for (const [site, lon, lat, label, crop] of sites) {
  if (requested.length && !requested.includes(site)) continue;
  const name = vegetationMonth === undefined ? site : `${site}_month${vegetationMonth}`;
  const scale = Math.cos((lat * Math.PI) / 180),
    center = wgs84ToWorld(scale, lon, lat);
  const regions = createRegionResolver(atlas, { metersPerUnit: scale });
  const environment = createRegionalEnvironment(
    {
      atlas: ecology,
      catalogs: [catalog],
      ...(vegetationMonth === undefined ? {} : { vegetationMonth }),
    },
    scale,
    regions,
  );
  const geom = {
    level: 16,
    x: 0,
    z: 0,
    originX: center[0] - size / 2,
    originZ: center[1] - size / 2,
    size,
    metersPerUnit: scale,
    levelBelowMax: 0,
  };
  const tile = createEmptyTerrainSemanticTile();
  tile.landcover.push({
    id: 'habitat',
    class: label,
    ...(crop === undefined ? {} : { crop }),
    polygons: [
      {
        outer: [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
      },
    ],
  });
  tile.transportation.push({
    id: 'viewing-path',
    class: 'path',
    width: 5,
    lines: [
      [
        [0.5, 0],
        [0.5, 1],
      ],
    ],
  });
  const selection = environment.at(...center);
  if (!selection.scatter) throw new Error(`Missing habitat at ${name}`);
  const groundColor = selection.scatter.surface.colors[label] ?? selection.scatter.surface.default;
  for (const quality of qualities) {
    const output = generateWorldgenTile({
      tile,
      geom,
      ground: FLAT_GROUND,
      pack,
      atlas,
      regions,
      environment,
      budgets: worldgenTileBudgetForQuality(quality, 0),
      tierOffset: quality === 'economy' ? 1 : 0,
      features: { buildings: false, scatter: true },
    });
    const positions = [],
      normals = [],
      colors = [];
    for (const set of output.placements) {
      const preset = environment.library.plants[set.modelRef];
      if (!preset) throw new Error(`Unexpected fixture model ${set.modelRef}`);
      const geometry = createPlantGeometry(preset, quality === 'economy');
      const p = geometry.getAttribute('position'),
        n = geometry.getAttribute('normal'),
        c = geometry.getAttribute('color');
      for (let instance = 0; instance < set.count; instance++) {
        const at = instance * 10;
        const [x, y, z, yaw, sx, sy, sz, red, green, blue] = set.data.slice(at, at + 10);
        const cos = Math.cos(yaw),
          sin = Math.sin(yaw);
        for (let v = 0; v < p.count; v++) {
          const px = p.getX(v) * sx,
            pz = p.getZ(v) * sz;
          positions.push(
            x - size / 2 + cos * px + sin * pz,
            y + p.getY(v) * sy,
            z - size / 2 - sin * px + cos * pz,
          );
          const nx = n.getX(v) / sx,
            ny = n.getY(v) / sy,
            nz = n.getZ(v) / sz;
          const length = Math.hypot(nx, ny, nz);
          normals.push(
            (cos * nx + sin * nz) / length,
            ny / length,
            (-sin * nx + cos * nz) / length,
          );
          colors.push(
            Math.round(c.getX(v) * red * 255),
            Math.round(c.getY(v) * green * 255),
            Math.round(c.getZ(v) * blue * 255),
          );
        }
      }
      geometry.dispose();
    }
    const vertexCount = positions.length / 3,
      id = `ecology.${name}_${quality}`;
    const source = resolve(out, `${name}-${quality}.source.glb`);
    // Economy intentionally omits low ground cover; an empty scene is a valid bare habitat.
    if (vertexCount > 0) {
      await writeFile(
        source,
        encodeGlb(
          {
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            colors: new Uint8Array(colors),
            uvs: new Float32Array(vertexCount * 2),
            indices: Uint32Array.from({ length: vertexCount }, (_, i) => i),
            vertexCount,
            triangleCount: vertexCount / 3,
            bytes: 0,
            groups: [
              { start: 0, count: vertexCount, slot: 'wall', materialRef: 'palette:#ffffff' },
            ],
          },
          [{ name: `${name} plants`, roughness: 0.92 }],
        ),
      );
      const imported = await importAsset({
        path: source,
        id,
        projectPath,
        cwd: out,
        optimize: false,
        force: true,
      });
      if (!imported.ok) throw new Error(imported.error);
      const inspected = await inspectAsset({ ref: id, projectPath, verify: true });
      if (!inspected.ok) throw new Error(inspected.error);
    }
    const scenePath = resolve(out, `${name}-${quality}.scene.json`);
    const scene = {
      format: 'molen/scene@3',
      name: `${name} ${quality} habitat fixture`,
      seed: 'regional-qa-v1',
      tickRate: 30,
      entities: [
        ...(vertexCount > 0
          ? [
              {
                id: 'plants',
                components: {
                  transform: { pos: [0, 0, 0] },
                  renderable: { kind: 'gltf', ref: id, shadows: { cast: true, receive: true } },
                },
              },
            ]
          : []),
        {
          id: 'ground',
          components: {
            transform: { pos: [0, -0.25, 0] },
            renderable: {
              kind: 'primitive',
              ref: 'box',
              primitive: { size: [220, 0.5, 220] },
              materialRef: `palette:${groundColor}`,
              shadows: { receive: true },
            },
          },
        },
        {
          id: 'path',
          components: {
            transform: { pos: [0, 0.025, 0] },
            renderable: {
              kind: 'primitive',
              ref: 'box',
              primitive: { size: [5, 0.025, 220] },
              materialRef: 'palette:#b4a285',
              shadows: { receive: true },
            },
          },
        },
        {
          id: 'lighting',
          components: {
            environment: {
              ambient: {
                sky: EARTH_SKY_PALETTE.dayHorizon,
                ground: EARTH_SKY_PALETTE.ground,
                intensity: EARTH_LIGHTING.dayAmbient,
              },
              sun: {
                direction: [-8, 14, 9],
                color: EARTH_SKY_PALETTE.sun,
                intensity: EARTH_LIGHTING.sunIntensity,
                castShadow: true,
              },
              shadows: 'high',
              background: EARTH_SKY_PALETTE.dayZenith,
              toneMapping: EARTH_TONE_MAPPING,
              exposure: EARTH_EXPOSURE,
            },
          },
        },
      ],
    };
    await writeFile(scenePath, `${JSON.stringify(scene, null, 2)}\n`);
    const simulation = await runSimulation({ scenePath, projectPath, ticks: 30 });
    if (!simulation.ok) throw new Error(simulation.error);
    const frames = [];
    for (const [view, position, lookAt] of [
      ['walk', [0, 1.7, 64], [5, 8, -5]],
      ['drive', [0, 5, 83], [0, 7, -10]],
      ['fly', [115, 95, 125], [0, 8, 0]],
    ]) {
      const shot = await screenshotScene({
        scenePath,
        projectPath,
        ticks: 30,
        camera: { position, lookAt },
        size: [1280, 800],
        outPath: resolve(out, `${name}-${quality}-${view}.png`),
        reflections: true,
        antialias: true,
        fitShadows: true,
      });
      if (!shot.ok) throw new Error(shot.error);
      frames.push(shot.imagePath);
    }
    const report = {
      name,
      quality,
      syntheticFixture: true,
      bakedForCapture: true,
      regional: output.regional,
      placements: output.stats.placementsByModel,
      generationHash: output.hash,
      triangles: vertexCount / 3,
      frames,
    };
    evidence.push(report);
    console.log(JSON.stringify(report));
  }
}
await writeFile(resolve(out, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
