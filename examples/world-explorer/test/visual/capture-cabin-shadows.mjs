// Drive the Silverado down a straight road with the sun low behind it and measure cabin flicker
// from the driver's seat: the share of pixels whose brightness jumps from one frame to the next.
// Writes the first frames to .artifacts/cabin-shadows. `CASES=high:28,medium:28` picks the shadow
// quality and speed in km/h.
//
// The worst frame's share of changed pixels at 28 km/h: 4.1% on High (0.14 m texels) and 4.0% on
// Medium while the truck's roof, pillars and doors shaded its own dashboard from the sun's main
// map (the page's `?subject=0&selfShadow=always`). Now 0: the truck casts from a map of its own
// (`Renderer.setShadowSubject`), which keeps the roof's shade, and without one (`?subject=0`, as
// on WebGPU) it casts nothing from the driver's seat. The limit is 0.6%, as for the aircraft
// cockpit.
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
const out = resolve(root, '.artifacts/cabin-shadows');
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
  for (const entry of (process.env.CASES ?? 'high:28,medium:28').split(',')) {
    const [quality, kmh] = entry.split(':');
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:${port}/cabin-shadows.html?quality=${quality}&kmh=${kmh}`);
    await page.waitForFunction(() => !!window.cabinShadowsQA, undefined, { timeout: 120000 });
    const { shots, ...stats } = await page.evaluate(() => window.cabinShadowsQA.drive(40));
    for (const [i, shot] of shots.entries())
      await writeFile(
        resolve(out, `${quality}-${kmh}kmh-frame${i}.png`),
        Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64'),
      );
    results.push({ quality, kmh: Number(kmh), ...stats, errors });
    await page.close();
  }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  for (const result of results) {
    assert.deepEqual(result.errors, [], `errors at ${result.quality}`);
    assert(
      result.maxChanged < 0.006,
      `cabin flickers at ${result.quality}, ${result.kmh} km/h: ${result.maxChanged}`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
