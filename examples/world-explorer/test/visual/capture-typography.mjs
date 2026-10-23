import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const out = resolve(root, '.artifacts/typography');
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
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/typography.html`);
  await page
    .waitForFunction(() => window.typographyQA?.ready, undefined, { timeout: 30000 })
    .catch((error) => {
      throw new Error(`${errors.join('; ')}; ${error.message}`);
    });
  const state = await page.evaluate(() => window.typographyQA);
  assert(state.triangles > 2000);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(out, 'font-signs.png') });
  console.log(JSON.stringify({ ok: true, out, ...state }));
} finally {
  await browser?.close();
  await server.close();
}
