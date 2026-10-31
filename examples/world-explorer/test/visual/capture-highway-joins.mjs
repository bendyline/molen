import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const out = resolve(root, '.artifacts/highway-joins');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const direct = new Map(),
    results = [];
  for (const worker of [false, true]) {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/highway-joins.html${worker ? '?worker=1' : ''}`,
    );
    await page
      .waitForFunction(() => !!window.highwayQA, undefined, { timeout: 30000 })
      .catch((error) => {
        throw new Error(`${errors.join('; ')}; ${error.message}`);
      });
    for (const name of ['overview', 'approach', 'merge']) {
      const stats = await page.evaluate((name) => window.highwayQA.view(name), name);
      const png = await page.screenshot({
        path: resolve(out, `${worker ? 'worker' : 'direct'}-${name}.png`),
      });
      const pixels = PNG.sync.read(png).data;
      assert(stats.roads > 5);
      assert(
        pixels.equals(PNG.sync.read(await page.screenshot()).data),
        'Stationary frame repeats',
      );
      if (worker) assert(pixels.equals(direct.get(name)), 'Worker and direct renderer agree');
      else direct.set(name, pixels);
      results.push({ worker, name, stats });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  await writeFile(
    resolve(out, 'capture.json'),
    `${JSON.stringify({ ok: true, results }, null, 2)}\n`,
  );
  console.log(JSON.stringify({ ok: true, out }));
} finally {
  await browser?.close();
  await server.close();
}
