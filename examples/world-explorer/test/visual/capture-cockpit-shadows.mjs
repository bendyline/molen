// Fly the F-15C straight and level with the sun behind it and measure cockpit flicker from the
// seat: the share of pixels whose brightness jumps from one frame to the next. Writes the first
// frames to .artifacts/cockpit-shadows. `AGL=20,400,772` picks the heights above the ground.
//
// The worst frame's share of changed pixels: in cruise (772 m, the shadow map's texels 1.6 m)
// 7.3% while the aircraft shadowed itself, now 0; at 20 m 1.3% while its glass shaded the
// cockpit, now 0.3% (the aircraft's own fine shadows crossing a 5 cm texel grid). The limit is 0.6%.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const require = createRequire(resolve(root, 'packages/tooling/package.json'));
const { chromium } = require('playwright');
const out = resolve(root, '.artifacts/cockpit-shadows');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  logLevel: 'warn',
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  const port = server.httpServer.address().port;
  const channel = process.env.MOLEN_TEST_BROWSER_CHANNEL;
  browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : {}),
    args: channel ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const results = [];
  for (const agl of (process.env.AGL ?? '772,20').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${port}/cockpit-shadows.html?agl=${agl}`);
    await page.waitForFunction(() => !!window.cockpitShadowsQA, undefined, { timeout: 120000 });
    const { shots, ...stats } = await page.evaluate(() => window.cockpitShadowsQA.fly(40));
    for (const [i, shot] of shots.entries())
      await writeFile(
        resolve(out, `agl${agl}-frame${i}.png`),
        Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64'),
      );
    results.push({ agl, ...stats, errors });
    await page.close();
  }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  for (const result of results) {
    assert.deepEqual(result.errors, [], `errors at ${result.agl} m`);
    assert(result.maxChanged < 0.006, `cockpit flickers at ${result.agl} m: ${result.maxChanged}`);
  }
} finally {
  await browser?.close();
  await server.close();
}
