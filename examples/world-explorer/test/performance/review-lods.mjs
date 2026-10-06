import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  define: { __BENCHMARK_ROOT__: JSON.stringify(root.replaceAll('\\', '/')) },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
const ids = (
  process.argv.find((arg) => arg.startsWith('--ids='))?.slice(6) ??
  'n0229_istanbul_sapphire,n0001_stari_most,sr_520_floating_bridge,n0695_mordovia_arena'
).split(',');
let browser;
try {
  await server.listen();
  await mkdir(resolve(root, '.artifacts/landmark-lods/review'), { recursive: true });
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  for (const id of ids) {
    const page = await browser.newPage({ viewport: { width: 2000, height: 700 } }),
      errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/lod-review.html?id=${id}`,
    );
    await page
      .waitForFunction(() => window.lodReviewReady, undefined, { timeout: 180000 })
      .catch((error) => {
        throw new Error(`${id}: ${errors.join('; ')}`, { cause: error });
      });
    await page.screenshot({ path: resolve(root, `.artifacts/landmark-lods/review/${id}.png`) });
    console.log(`Reviewed ${id}`);
    await page.close();
  }
} finally {
  await browser?.close();
  await server.close();
}
