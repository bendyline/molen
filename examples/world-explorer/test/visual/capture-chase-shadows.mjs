// Drive the Corolla over plain ground in the chase view with a low sun ahead and measure how its
// ground shadow holds its shape: the camera rides with the car, so every pixel that changes from
// one frame to the next is shadow. Writes the first frames and a picture of where the brightness
// varied to .artifacts/chase-shadows. `CASES=high:100,medium:100` picks the shadow quality and
// speed in km/h; `QUERY=subject=0` adds page parameters and `TAG` a file name prefix.
//
// The worst frame's share of changed pixels at 100 km/h while the car cast into the sun's main
// map (the page's `?subject=0`): 0.15% on High (0.14 m texels), 0.5% on Medium and 1.4% on Low,
// the whole outline of the shadow from frame to frame. From a map of its own
// (`Renderer.setShadowSubject`), 0.003% on all three: eight pixels. The limit is 0.05%. `LIMIT=1`
// lifts it to measure the former, and `TIMING=1` adds main-thread milliseconds per frame (0.02 to
// 0.07 ms more with the map).
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
const out = resolve(root, '.artifacts/chase-shadows');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  logLevel: 'warn',
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
const png = (url) => Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
const limit = Number(process.env.LIMIT ?? 0.0005);
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
  const query = process.env.QUERY ? `&${process.env.QUERY}` : '';
  const tag = process.env.TAG ? `${process.env.TAG}-` : '';
  const results = [];
  for (const entry of (process.env.CASES ?? 'high:100,medium:100').split(',')) {
    const [quality, kmh] = entry.split(':');
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(
      `http://127.0.0.1:${port}/chase-shadows.html?quality=${quality}&kmh=${kmh}${query}`,
    );
    await page.waitForFunction(() => !!window.chaseShadowsQA, undefined, { timeout: 120000 });
    const { shots, flicker, ...stats } = await page.evaluate(() => window.chaseShadowsQA.drive(60));
    const frameMs = process.env.TIMING
      ? await page.evaluate(() => window.chaseShadowsQA.time(600))
      : undefined;
    for (const [i, shot] of shots.entries())
      await writeFile(resolve(out, `${tag}${quality}-${kmh}kmh-frame${i}.png`), png(shot));
    await writeFile(resolve(out, `${tag}${quality}-${kmh}kmh-flicker.png`), png(flicker));
    results.push({ quality, kmh: Number(kmh), ...stats, frameMs, errors });
    await page.close();
  }
  await writeFile(resolve(out, `${tag}capture.json`), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  for (const result of results) {
    assert.deepEqual(result.errors, [], `errors at ${result.quality}`);
    assert(
      result.maxChanged < limit,
      `shadow changes shape at ${result.quality}, ${result.kmh} km/h: ${result.maxChanged}`,
    );
  }
} finally {
  await browser?.close();
  await server.close();
}
