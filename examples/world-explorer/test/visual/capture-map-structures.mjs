/** Run after workspace build: node examples/world-explorer/test/visual/capture-map-structures.mjs */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { modelInputHash } from '../../../../packages/worldgen/scripts/structure-model-files.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'), 'utf8'));
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const outputIndex = process.argv.indexOf('--out-dir');
const outputDirectory = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
if (outputIndex >= 0 && !outputDirectory) throw new Error('--out-dir needs a directory');
const out = outputDirectory
  ? resolve(outputDirectory)
  : resolve(root, 'examples/world-explorer/captures/map-structures');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  define: {
    __MAP_STRUCTURE_CONTENT_ROOT__: JSON.stringify(resolve(root, 'content').replaceAll('\\', '/')),
  },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const errors = [];
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address === 'object');
  browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${address.port}/map-structures.html`, {
    waitUntil: 'networkidle',
  });
  await page.waitForFunction(() => !!window.mapStructuresQA, undefined, { timeout: 120000 });
  const frames = [];
  for (const name of [
    'overview',
    'windmill',
    'mill-materials',
    'mill-gallery',
    'turbine',
    'turbine-base',
    'turbine-nacelle',
    'missing-tags',
  ]) {
    const state = await page.evaluate((view) => window.mapStructuresQA.view(view), name);
    assert.equal(state.structures.length, name === 'missing-tags' ? 0 : 2);
    assert.equal(state.generatedBuildings, name === 'missing-tags' ? 2 : 1);
    assert.deepEqual(state.loads.sort(), [
      'molen.worldgen.structure.map_smock_windmill',
      'molen.worldgen.structure.map_wind_turbine',
    ]);
    if (name !== 'missing-tags') {
      const mill = state.structures.find((item) => Math.abs(item.position[0] - 140) < 0.01);
      const turbine = state.structures.find((item) => Math.abs(item.position[0] - 260) < 0.01);
      assert(mill && turbine, 'Models must be placed at mapped positions');
      assert(
        Math.abs(mill.position[2] - 220) < 0.01 && Math.abs(mill.heading - Math.PI / 4) < 1e-6,
      );
      assert(
        Math.abs(turbine.position[2] - 120) < 0.01 &&
          Math.abs(turbine.heading + Math.PI / 3) < 1e-6,
      );
      assert.equal(
        mill.triangles,
        state.assetTriangles['molen.worldgen.structure.map_smock_windmill'],
      );
      assert.equal(
        turbine.triangles,
        state.assetTriangles['molen.worldgen.structure.map_wind_turbine'],
      );
      assert(mill.materials > 1 && turbine.materials > 1, 'Expected original material groups');
      assert(Object.keys(mill.surfaces).length >= 3, 'Mill components must use shared surfaces');
      assert(
        Object.keys(turbine.surfaces).length >= 2,
        'Turbine must use shared paint and concrete',
      );
      const sharedPaint = 'worldgen:matgraph:molen.worldgen.material.metal_painted';
      assert(
        mill.surfaces[sharedPaint],
        'Windmill ironwork must resolve its shared painted surface',
      );
      assert.equal(
        mill.surfaces[sharedPaint],
        turbine.surfaces[sharedPaint],
        'Two different GLBs share one texture object',
      );
      assert(
        Object.values(state.surfaceReads).every((count) => count === 1),
        'One graph read/bake per shared surface',
      );
      assert(
        Object.values(state.surfaceTextureCounts).every((count) => count === 1),
        'No duplicate textures across models',
      );
      assert(
        mill.position[1] === 0 && turbine.position[1] === 0,
        'Models must contact the sampled terrain',
      );
    }
    assert(state.draws > 0 && state.triangles > 0);
    const path = resolve(out, `${name}.png`);
    await page.screenshot({ path });
    frames.push({ name, path, hash: hash(await readFile(path)), state });
  }
  assert.deepEqual(errors, []);
  const assets = {};
  for (const id of ['map_smock_windmill', 'map_wind_turbine']) {
    const ref = `molen.worldgen.structure.${id}`;
    assert(pack.assets[ref], `${ref}: runtime asset is not registered`);
    assets[ref] = {
      inputHash: await modelInputHash(
        resolve(root, `content/worldgen/source/map-structures/${id}`),
        ref,
      ),
    };
  }
  const materialGraphs = {};
  for (const ref of Object.keys(frames[0].state.surfaceReads)) {
    const path = `content/worldgen/${pack.materials[ref]}`;
    materialGraphs[ref] = { path, hash: hash(await readFile(resolve(root, path))) };
  }
  await writeFile(
    resolve(out, 'capture.json'),
    JSON.stringify({ ok: true, assets, materialGraphs, frames, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ ok: true, frames: frames.map(({ name, path }) => ({ name, path })) }, null, 2),
  );
} finally {
  await browser?.close();
  await server.close();
}
