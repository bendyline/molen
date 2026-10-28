import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../..');
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const out = resolve(root, '.artifacts/night-lighting');
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
  const port = server.httpServer.address().port;
  for (const backend of process.env.MOLEN_SKIP_WEBGPU === '1' ? ['webgl'] : ['webgl', 'webgpu'])
    for (const worker of [false, true]) {
      const page = await browser.newPage({
        viewport: { width: 960, height: 700 },
        deviceScaleFactor: 1,
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
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
        `http://127.0.0.1:${port}/night-lighting.html?backend=${backend}${worker ? '&worker=1' : ''}`,
      );
      await page
        .waitForFunction(() => !!window.nightLightingQA, undefined, { timeout: 45000 })
        .catch((e) => {
          throw Error(`${backend}: ${errors.join('; ')}; ${e.message}`);
        });
      const frames = {};
      let probes;
      for (const [name, altitude, enabled, far, spill = true, beams = true, close = false] of [
        ['day', 30, true, false],
        ['day-off', 30, false, false],
        ['night-off', -20, false, false],
        ['glow-only', -20, true, false, false],
        ['beam-off', -20, true, false, true, false],
        ['night', -20, true, false],
        ['dawn', 30, true, false],
        ['car-night', -20, true, false, true, true, true],
        ['far-night', -20, true, true],
      ]) {
        const state = await page.evaluate(
          ([a, e, f, s, b, c]) => window.nightLightingQA.view(a, e, f, s, b, c),
          [altitude, enabled, far, spill, beams, close],
        );
        if (name === 'night') probes = state.probes;
        assert.equal(state.backend, backend);
        assert(state.lamps > 4);
        const bytes = await page.screenshot({
          path: resolve(out, `${backend}-${worker ? 'worker' : 'direct'}-${name}.png`),
        });
        frames[name] = PNG.sync.read(bytes).data;
      }
      assert(frames.day.equals(frames['day-off']), 'No lighting draw changes in daylight');
      assert(frames.day.equals(frames.dawn), 'Dawn restores the exact daytime image');
      let brighter = 0;
      for (let i = 0; i < frames.night.length; i += 4)
        if (frames.night[i] - frames['night-off'][i] > 25) brighter++;
      for (const [probeIndex, [x, y]] of probes.entries()) {
        const mean = (pixels) => {
          let sum = 0;
          for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
              const i = (Math.round(y + dy) * 960 + Math.round(x + dx)) * 4;
              sum += pixels[i] + pixels[i + 1] + pixels[i + 2];
            }
          return sum / 75;
        };
        const gain = mean(frames.night) - mean(frames[probeIndex === 2 ? 'beam-off' : 'glow-only']);
        console.log(JSON.stringify({ backend, worker, probe: [x, y], gain }));
        assert(gain > 3, `Real light reaches wall/car receiver: ${gain}`);
      }
      assert(brighter > 500, `Visible window and pavement light coverage: ${brighter}`);
      const repeated = await page.screenshot();
      assert(
        PNG.sync.read(repeated).data.equals(frames['far-night']),
        'Static night does not flicker',
      );
      assert.deepEqual(errors, []);
      results.push({ backend, worker, brighter });
      await page.close();
    }
  await writeFile(resolve(out, 'capture.json'), JSON.stringify({ ok: true, results }, null, 2));
  console.log(JSON.stringify({ ok: true, out, results }));
} finally {
  await browser?.close();
  await server.close();
}
