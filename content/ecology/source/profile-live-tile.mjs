/** Reproducible CPU profiling of real local terrain tiles with the regional catalogs. */
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { Session } from 'node:inspector/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as terrain from '../../../packages/terrain/dist/client.mjs';
import {
  terrainPyramidTileOrigin,
  terrainPyramidTileSize,
  wgs84ToWebMercatorTile,
} from '../../../packages/terrain/dist/kernel.mjs';
import { resolveStylePackDocuments } from '../../../packages/worldgen/dist/kernel.mjs';
import {
  createRegionalEnvironment,
  createRegionResolver,
  generateWorldgenTile,
  worldgenTileBudgetForQuality,
} from '../../../packages/worldgen-earth/dist/kernel.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const { PMTiles } = createRequire(resolve(root, 'packages/tooling/package.json'))('pmtiles');
function openNodePmtiles(path) {
  const handle = open(path, 'r');
  return {
    archive: new PMTiles({
      getKey: () => path,
      async getBytes(offset, length) {
        const buffer = new Uint8Array(length);
        const { bytesRead } = await (await handle).read(buffer, 0, length, offset);
        return { data: buffer.buffer.slice(0, bytesRead) };
      },
    }),
    close: async () => (await handle).close(),
  };
}
const value = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const packageDir = value(
  'package-dir',
  'examples/world-explorer/public/terrain/seattle-bellevue-sammamish',
);
const pkg = await json(`${packageDir}/terrain-package.json`);
const elevation = openNodePmtiles(resolve(root, packageDir, pkg.elevation.source.path));
const features = openNodePmtiles(resolve(root, packageDir, pkg.features.source.path));
const reports = [];
const session = new Session();
session.connect();
try {
  const pyramid = await terrain.openTerrainPackagePyramid(pkg, { archive: elevation.archive });
  const decoder = terrain.createProtomapsTerrainMvtDecoder();
  const source = terrain.createTerrainPackageCombinedSemanticSource(
    pkg,
    features.archive,
    decoder,
    { minLevel: pkg.tileMatrix.minLevel, maxLevel: pkg.tileMatrix.maxLevel },
  );
  const pack = await resolveStylePackDocuments(
    await json('content/worldgen/stylepack.json'),
    (path) => json(`content/worldgen/${path}`),
  );
  const atlas = await json('content/earth/world.atlas.json');
  const metersPerUnit = pyramid.descriptor.metersPerUnit ?? 1;
  const regions = createRegionResolver(atlas, { metersPerUnit });
  const environment = createRegionalEnvironment(
    {
      atlas: await json('content/ecology/ecoregions.json'),
      catalogs: [
        await json('content/ecology/regional.catalog.json'),
        await json('content/worldgen/regional.catalog.json'),
      ],
    },
    metersPerUnit,
    regions,
  );
  const quality = value('quality', 'high');
  await session.post('Profiler.enable');
  await session.post('Profiler.start');
  for (const level of [15, 14, 13]) {
    const xyz = wgs84ToWebMercatorTile(
      Number(value('lon', '-122.010')),
      Number(value('lat', '47.568')),
      level,
    );
    const address = { level, x: xyz.x, z: xyz.y };
    const signal = new AbortController().signal;
    const tile = await source.load(address, signal);
    const ground = await pyramid.source.load(address, signal);
    if (!tile || !ground) throw new Error(`Missing local tile ${JSON.stringify(address)}`);
    const [originX, originZ] = terrainPyramidTileOrigin(pyramid.descriptor, address);
    const geom = {
      ...address,
      originX,
      originZ,
      size: terrainPyramidTileSize(pyramid.descriptor, level),
      metersPerUnit,
      levelBelowMax: pkg.tileMatrix.maxLevel - level,
    };
    for (const mode of ['scatter', 'buildings']) {
      const start = performance.now();
      const output = generateWorldgenTile({
        tile,
        geom,
        ground,
        pack,
        atlas,
        regions,
        environment,
        budgets: worldgenTileBudgetForQuality(quality, geom.levelBelowMax),
        features: {
          buildings: mode === 'buildings',
          scatter: mode === 'scatter',
          interiors: false,
        },
        tierOffset: quality === 'economy' ? 1 : 0,
      });
      const report = {
        ecology: environment.ecology?.resolve(originX + geom.size / 2, originZ + geom.size / 2),
        vegetation: environment.scatterAt(originX + geom.size / 2, originZ + geom.size / 2)?.id,
        landcover: [
          ...new Set(tile.landcover.map((feature) => `${feature.class}/${feature.subclass ?? ''}`)),
        ],
        level,
        mode,
        ms: performance.now() - start,
        hash: output.hash,
        stats: output.stats,
      };
      reports.push(report);
      console.log(JSON.stringify(report));
    }
  }
  const { profile } = await session.post('Profiler.stop');
  const out = resolve(root, '.artifacts/regional-world/profiles');
  await mkdir(out, { recursive: true });
  const name = value('name', `seattle-${quality}`);
  await writeFile(resolve(out, `${name}.cpuprofile`), JSON.stringify(profile));
  await writeFile(resolve(out, `${name}.json`), JSON.stringify(reports, null, 2));
  const samples = new Map();
  for (let i = 0; i < profile.samples.length; i++)
    samples.set(profile.samples[i], (samples.get(profile.samples[i]) ?? 0) + profile.timeDeltas[i]);
  console.log(
    JSON.stringify(
      profile.nodes
        .map((node) => ({
          name: node.callFrame.functionName,
          url: node.callFrame.url,
          ms: (samples.get(node.id) ?? 0) / 1000,
        }))
        .sort((a, b) => b.ms - a.ms)
        .slice(0, 20),
      null,
      2,
    ),
  );
} finally {
  session.disconnect();
  await elevation.close();
  await features.close();
}
