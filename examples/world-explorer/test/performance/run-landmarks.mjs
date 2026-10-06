/** Run after audit-landmarks.mjs. No generation, dependency changes or full engine build. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { output, root } from './audit-landmarks.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const counts = (process.argv.find((arg) => arg.startsWith('--counts='))?.split('=')[1] ?? '1,9,41')
  .split(',')
  .map(Number);
const shadows = process.argv.includes('--shadows');
const mobileViewport = process.argv.includes('--small-viewport');
const synchronous = process.argv.includes('--sync-materials');
const lod = process.argv.find((arg) => arg.startsWith('--lod='))?.slice(6);
const modelPath = process.argv.find((arg) => arg.startsWith('--model-path='))?.slice(13);
const streaming = process.argv.find((arg) => arg.startsWith('--streaming='))?.slice(12);
const serveOnly = process.argv.includes('--serve');
const host = process.argv.find((arg) => arg.startsWith('--host='))?.slice(7) ?? '127.0.0.1';
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  define: { __BENCHMARK_ROOT__: JSON.stringify(root.replaceAll('\\', '/')) },
  server: { host, port: serveOnly ? 5239 : 0, fs: { allow: [root] } },
});
let browser;
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  if (serveOnly) {
    console.log(
      `Open http://${host}:5239/landmarks.html?count=41 (use this computer's LAN address on a phone when --host=0.0.0.0).`,
    );
    await new Promise((accept) => process.once('SIGINT', accept));
    process.exitCode = 0;
  } else {
    // Deliberately do not force SwiftShader. Always record the actual renderer.
    browser = await chromium.launch({
      headless: true,
      args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
    });
    for (const count of counts) {
      const context = await browser.newContext({
        viewport: mobileViewport ? { width: 960, height: 540 } : { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const actualRenderer = await page.evaluate(() => {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) throw new Error('WebGL2 is unavailable');
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        return String(gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER));
      });
      console.log(`Renderer: ${actualRenderer}`);
      if (/swiftshader|llvmpipe|software/i.test(actualRenderer))
        throw new Error('Software renderer detected: refusing to report it as device performance.');
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      console.log(
        `Measuring ${count} ${streaming ? `${streaming} streaming` : (lod ?? 'full-detail')} landmarks${shadows ? ' with shadows' : ''}...`,
      );
      await page.goto(
        `http://127.0.0.1:${server.httpServer.address().port}/landmarks.html?count=${count}&shadows=${shadows ? 1 : 0}&bake=${synchronous ? 'sync' : 'workers'}${lod ? `&lod=${encodeURIComponent(lod)}` : ''}${modelPath ? `&modelPath=${encodeURIComponent(modelPath)}` : ''}${streaming ? `&streaming=${streaming}` : ''}`,
        { waitUntil: 'domcontentloaded' },
      );
      await page
        .waitForFunction(
          () => window.landmarkPerformance?.screenshotReady || window.landmarkPerformance?.done,
          undefined,
          { timeout: 600_000 },
        )
        .catch((cause) => {
          throw new Error(`Benchmark failed: ${errors.join('; ')}`, { cause });
        });
      const name = `landmarks-${count}${synchronous ? '' : '-worker-progressive'}${shadows ? '-shadows' : ''}${mobileViewport ? '-small-viewport' : ''}${lod ? `-${lod}` : ''}${modelPath ? '-pilot' : ''}${streaming ? `-${streaming}` : ''}`;
      await page.screenshot({ path: resolve(output, `${name}.png`) });
      await page.evaluate(() => {
        window.landmarkPerformance.continue = true;
      });
      await page.waitForFunction(() => window.landmarkPerformance.done, undefined, {
        timeout: 60_000,
      });
      const state = await page.evaluate(() => window.landmarkPerformance);
      const report = {
        ...state.result,
        errors,
        error: state.error,
        capturedAt: new Date().toISOString(),
      };
      await writeFile(resolve(output, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
      if (state.error || errors.length)
        throw new Error(JSON.stringify({ error: state.error, errors }));
      console.log(
        JSON.stringify({
          count,
          device: report.device,
          loadMs: report.loadMs,
          visibleGeometry: report.visibleGeometry,
          steady: report.steady,
          pan: report.pan20Degrees,
          unload: report.unload,
        }),
      );
      await context.close();
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
