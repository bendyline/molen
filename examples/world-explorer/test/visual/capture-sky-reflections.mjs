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
const out = resolve(root, '.artifacts/sky-reflections-smoke');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const results = [];
const mean = (buffer) => {
  const image = PNG.sync.read(buffer);
  let sum = 0,
    count = 0;
  for (let y = 160; y < 320; y++)
    for (let x = 240; x < 400; x++) {
      const p = (y * image.width + x) * 4;
      sum += image.data[p] * 0.2126 + image.data[p + 1] * 0.7152 + image.data[p + 2] * 0.0722;
      count++;
    }
  return sum / count;
};
try {
  await server.listen();
  const port = server.httpServer.address().port;
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: [
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
  for (const backend of process.env.MOLEN_SKIP_WEBGPU === '1' ? ['webgl'] : ['webgl', 'webgpu']) {
    const page = await browser.newPage({
      viewport: { width: 640, height: 480 },
      deviceScaleFactor: 1,
    });
    if (backend === 'webgpu') {
      await page.route('**/reflection-probe', (route) =>
        route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><title>GPU probe</title>',
        }),
      );
      await page.goto(`http://127.0.0.1:${port}/reflection-probe`);
      const available = await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()));
      if (!available) {
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
    await page.goto(`http://127.0.0.1:${port}/sky-reflections.html?backend=${backend}`);
    await page
      .waitForFunction(() => !!window.skyReflectionsQA, undefined, { timeout: 30000 })
      .catch((error) => {
        throw new Error(`${backend}: ${errors.join('; ')}; ${error.message}`);
      });
    const frames = [];
    for (const mode of ['unlit', 'day', 'moved', 'cloudy', 'night']) {
      const state = await page.evaluate((mode) => window.skyReflectionsQA.view(mode), mode);
      const image = await page.screenshot({ path: resolve(out, `${backend}-${mode}.png`) });
      frames.push({ mode, ...state, brightness: mean(image) });
      assert.equal(state.backend, backend);
      assert(state.uuid, 'PBR scene needs a filtered environment');
    }
    const byName = Object.fromEntries(frames.map((f) => [f.mode, f]));
    assert(
      byName.day.brightness > byName.unlit.brightness + 20,
      'Day sky must illuminate pure metal',
    );
    assert(byName.night.brightness < byName.day.brightness * 0.5, 'Night radiance must be darker');
    assert.equal(
      new Set(frames.map((f) => f.uuid)).size,
      1,
      'One reused PMREM texture across lighting changes',
    );
    const stable = await page.evaluate(() => window.skyReflectionsQA.stable());
    assert.equal(stable.before, stable.after, 'Unchanged lighting must not allocate GPU textures');
    assert.equal(stable.uuid, stable.afterUuid);
    assert.equal(
      (await page.evaluate(() => window.skyReflectionsQA.dispose())).environmentCleared,
      true,
    );
    assert.deepEqual(errors, []);
    results.push({ backend, frames, stable, errors });
    await page.close();
  }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
  await browser?.close();
  await server.close();
}
