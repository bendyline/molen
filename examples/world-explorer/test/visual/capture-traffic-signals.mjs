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
const out = resolve(root, '.artifacts/traffic-signals');
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
        `http://127.0.0.1:${port}/traffic-signals.html?backend=${backend}${worker ? '&worker=1' : ''}`,
      );
      await page
        .waitForFunction(() => !!window.trafficSignalsQA, undefined, { timeout: 30000 })
        .catch((error) => {
          throw new Error(`${backend}: ${errors.join('; ')}; ${error.message}`);
        });
      const frames = [];
      for (const [name, time, night, close] of [
        ['day', 0, false, false],
        ['night-green', 0, true, false],
        ['night-amber', 24, true, false],
        ['night-red', 27, true, false],
        ['close-day', 0, false, true],
        ['close-night', 0, true, true],
      ]) {
        const state = await page.evaluate(
          ([time, night, close]) => window.trafficSignalsQA.view(time, night, close),
          [time, night, close],
        );
        const buffer = await page.screenshot({
          path: resolve(out, `${backend}-${worker ? 'worker' : 'direct'}-${name}.png`),
        });
        const pixels = PNG.sync.read(buffer).data;
        const counts = { red: 0, amber: 0, green: 0 };
        for (let i = 0; i < pixels.length; i += 4) {
          const [r, g, b] = pixels.subarray(i, i + 3);
          if (r > 150 && g < r * 0.5 && b < r * 0.5) counts.red++;
          if (r > 150 && g > 110 && b < 70) counts.amber++;
          if (g > 150 && r < g * 0.5 && b < g * 0.8) counts.green++;
        }
        assert.equal(state.backend, backend);
        assert.equal(state.heads, 6);
        // Observed 5–12 green/red pixels and 6–9 amber across software WebGL/WebGPU.
        // Stay well inside these values to tolerate driver-specific edge coverage.
        if (name === 'night-green')
          assert(counts.green > 1 && counts.red > 1, 'Night must show bright green and red lenses');
        if (name === 'night-amber')
          assert(counts.amber > 1 && counts.green === 0, 'Amber must replace green at night');
        if (name === 'night-red')
          assert(
            counts.red > 3 && counts.green === 0 && counts.amber === 0,
            'Clearance must show only red',
          );
        const repeated = await page.screenshot();
        assert(
          PNG.sync.read(repeated).data.equals(pixels),
          'A fixed signal state must render identically',
        );
        frames.push({ name, ...counts });
      }
      assert.deepEqual(errors, []);
      results.push({ backend, worker, frames });
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
