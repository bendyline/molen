import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const out = resolve(root, '.artifacts/road-signs');
await mkdir(out, { recursive: true });
// Workers pack normals and colors into normalized bytes before transfer
// (packages/terrain/src/compact-attributes.ts); the direct path keeps them as floats. That rounding
// moves a lit pixel by a level or two in any channel; a missing, moved or misspelled sign moves
// pixels by tens of levels.
const QUANTIZATION_LEVELS = 4;
/** Largest per-channel difference between two RGBA buffers. */
function largestChannelDifference(a, b) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  return worst;
}
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const results = [];
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: [
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
    ],
  });
  for (const backend of process.env.MOLEN_SKIP_WEBGPU === '1' ? ['webgl'] : ['webgl', 'webgpu']) {
    const direct = new Map();
    for (const worker of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 1200, height: 800 },
        deviceScaleFactor: 1,
      });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      if (backend === 'webgpu') {
        await page.route('**/gpu-probe', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<title>GPU probe</title>' }),
        );
        await page.goto(`http://127.0.0.1:${port}/gpu-probe`);
        if (!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) {
          results.push({ backend, worker, skipped: 'No WebGPU adapter' });
          await page.close();
          continue;
        }
      }
      await page.goto(
        `http://127.0.0.1:${port}/road-signs.html?backend=${backend}${worker ? '&worker=1' : ''}`,
      );
      await page
        .waitForFunction(() => !!window.roadSignsQA, undefined, { timeout: 30000 })
        .catch((e) => {
          throw new Error(`${errors.join('; ')}; ${e.message}`);
        });
      for (const name of ['overhead', 'freeway', 'speed', 'exit', 'stops', 'junction']) {
        const state = await page.evaluate((name) => window.roadSignsQA.view(name), name);
        const buffer = await page.screenshot({
          path: resolve(out, `${backend}-${worker ? 'worker' : 'direct'}-${name}.png`),
        });
        const pixels = PNG.sync.read(buffer).data;
        assert(state.stats.roadSigns > 0);
        assert.equal(state.stats.trafficSignals, 0);
        assert.equal(state.backend, backend);
        assert(
          PNG.sync.read(await page.screenshot()).data.equals(pixels),
          'Fixed scene must repeat exactly',
        );
        const result = { backend, worker, name, stats: state.stats };
        if (worker) {
          result.directDifference = largestChannelDifference(pixels, direct.get(name));
          assert(
            result.directDifference <= QUANTIZATION_LEVELS,
            `Worker and direct sign geometry must render alike: ${backend} ${name} differs by ${result.directDifference} levels`,
          );
        } else direct.set(name, pixels);
        results.push(result);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  await writeFile(
    resolve(out, 'capture.json'),
    `${JSON.stringify({ ok: true, results }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ ok: true, out, results }));
} finally {
  await browser?.close();
  await server.close();
}
