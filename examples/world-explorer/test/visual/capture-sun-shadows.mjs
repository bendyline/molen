import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const out = resolve(root, '.artifacts/sun-shadows-smoke');
await mkdir(out, { recursive: true });
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
  const channel = process.env.MOLEN_TEST_BROWSER_CHANNEL;
  browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : {}),
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: channel
      ? ['--enable-unsafe-webgpu']
      : [
          '--enable-unsafe-webgpu',
          '--use-webgpu-adapter=swiftshader',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
        ],
  });
  for (const backend of process.env.MOLEN_SKIP_WEBGPU === '1' ? ['webgl'] : ['webgl', 'webgpu']) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    if (backend === 'webgpu') {
      await page.route('**/gpu-probe', (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>GPU probe</title>' }),
      );
      await page.goto(`http://127.0.0.1:${port}/gpu-probe`);
      if (!(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))) {
        results.push({ backend, skipped: 'WebGPU reported no adapter for this device' });
        await page.close();
        continue;
      }
    }
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${port}/sun-shadows.html?backend=${backend}`);
    await page.waitForFunction(() => !!window.sunShadowsQA, undefined, { timeout: 30000 });
    const frames = [];
    const images = [];
    for (const quality of ['off', 'high', 'low', 'off', 'high']) {
      const state = await page.evaluate((q) => window.sunShadowsQA.quality(q), quality);
      const buffer = await page.screenshot({
        path: resolve(out, `${backend}-${frames.length}-${quality}.png`),
      });
      images.push(PNG.sync.read(buffer));
      frames.push({ quality, ...state });
      assert.equal(state.backend, backend);
      if (quality === 'high') {
        assert.equal(state.mapSize, 4096, 'High must allocate the full-resolution depth target');
        assert(state.texel <= 0.02, 'Close flight shadows need centimeter-scale detail');
      }
    }
    let shadowPixels = 0;
    let changedPixels = 0;
    for (let p = 0; p < images[0].data.length; p += 4) {
      if (images[0].data[p] - images[1].data[p] > 30) shadowPixels++;
      if (Math.abs(images[1].data[p] - images[4].data[p]) > 8) changedPixels++;
    }
    assert(shadowPixels > 1500, 'Shadows must become visible after the parked startup warm-up');
    assert(changedPixels < 100, 'High must recover the same shadow after Low / Off / High');
    assert.deepEqual(errors, []);
    results.push({ backend, frames, shadowPixels, changedPixels, errors });
    await page.evaluate(() => window.sunShadowsQA.dispose());
    await page.close();
  }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
