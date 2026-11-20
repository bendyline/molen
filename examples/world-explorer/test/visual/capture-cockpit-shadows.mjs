// Fly an aircraft straight and level with the sun behind it and measure cockpit flicker from the
// seat: the share of pixels whose brightness jumps from one frame to the next. Writes the first
// frames to .artifacts/cockpit-shadows. `AIRCRAFT=f15c,oh6` picks the aircraft (both by default),
// `AGL=20,400,772` the heights above the ground (each aircraft's own by default), and `QUERY=` adds
// page parameters: `subject=0` leaves the aircraft to the main map as on WebGPU, `spin=0` holds a
// rotor still.
//
// The worst frame's share of changed pixels: the F-15C in cruise (772 m, the shadow map's texels
// 1.6 m) 7.3% while the aircraft shadowed itself in the main map, then 0 out of it; at 20 m 1.3%
// while its glass shaded the cockpit, then 0.3% (the aircraft's own fine shadows crossing a 5 cm
// texel grid). The OH-6 at 32 m (7 cm texels): 6.1% while its turning rotor cast hard shadows, a
// different spot of the cabin each frame, and 1.4 to 1.6% from the main map's grid alone. With a
// map of the aircraft's own (`Renderer.setShadowSubject`) and a fast rotor out of the shadow pass,
// the F-15C is 0 at both heights and the OH-6 0.008%: its blades passing the top of the frame.
// The limit is 0.6%.
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
const HEIGHTS = { f15c: '772,20', oh6: '32' };
const cases = (process.env.AIRCRAFT ?? 'f15c,oh6')
  .split(',')
  .flatMap((aircraft) =>
    (process.env.AGL ?? HEIGHTS[aircraft])
      .split(',')
      .map((agl) => ({ aircraft, agl: Number(agl) })),
  );
const query = process.env.QUERY ? `&${process.env.QUERY}` : '';
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
  for (const { aircraft, agl } of cases) {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(
      `http://127.0.0.1:${port}/cockpit-shadows.html?aircraft=${aircraft}&agl=${agl}${query}`,
    );
    await page.waitForFunction(() => !!window.cockpitShadowsQA, undefined, { timeout: 120000 });
    const { shots, ...stats } = await page.evaluate(() => window.cockpitShadowsQA.fly(40));
    for (const [i, shot] of shots.entries())
      await writeFile(
        resolve(out, `${aircraft}-agl${agl}-frame${i}.png`),
        Buffer.from(shot.slice(shot.indexOf(',') + 1), 'base64'),
      );
    results.push({ aircraft, agl, ...stats, errors });
    await page.close();
  }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  if (process.env.LIMIT !== '0')
    for (const result of results) {
      assert.deepEqual(result.errors, [], `errors: ${result.aircraft} at ${result.agl} m`);
      assert(
        result.maxChanged < 0.006,
        `cockpit flickers: ${result.aircraft} at ${result.agl} m: ${result.maxChanged}`,
      );
    }
} finally {
  await browser?.close();
  await server.close();
}
