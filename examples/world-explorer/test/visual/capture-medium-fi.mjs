/** Targeted, hash-bound medium-fi context captures; inspect images before approving. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { structureSourceDirectory } from '../../../../packages/worldgen/scripts/structure-source-paths.mjs';

const here = dirname(fileURLToPath(import.meta.url)),
  root = resolve(here, '../../../..');
const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length)
  throw new Error(
    'Usage: node examples/world-explorer/test/visual/capture-medium-fi.mjs --ids=n0259_shanhai_pass',
  );
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const fixtureHash = hash(
  Buffer.concat(
    await Promise.all(['medium-fi.ts', 'medium-fi.html'].map((p) => readFile(resolve(here, p)))),
  ),
);
const server = await createServer({
  configFile: false,
  root: here,
  publicDir: false,
  optimizeDeps: { noDiscovery: true },
  define: { __REVIEW_ROOT__: JSON.stringify(root.replaceAll('\\', '/')) },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  for (const id of ids) {
    const dir = structureSourceDirectory(id),
      out = resolve(dir, 'medium-fi'),
      spec = JSON.parse(await readFile(resolve(dir, 'spec.json'))),
      errors = [];
    await mkdir(out, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1200, height: 760 } });
    page.on('pageerror', (e) => errors.push(e.message));
    const context = new URLSearchParams(spec.mediumFiContext ?? {});
    await page.goto(
      `http://127.0.0.1:${server.httpServer.address().port}/medium-fi.html?id=${encodeURIComponent(id)}&${context}`,
    );
    await page
      .waitForFunction(() => !!window.mediumFi, undefined, { timeout: 60000 })
      .catch((e) => {
        throw new Error(errors.join('; ') || e.message);
      });
    const frames = [];
    async function shot(name, options) {
      const state = await page.evaluate((o) => window.mediumFi.view(o), options);
      await page.screenshot({ path: resolve(out, `${name}.png`) });
      frames.push({
        path: `medium-fi/${name}.png`,
        hash: hash(await readFile(resolve(out, `${name}.png`))),
        state,
      });
    }
    for (const distance of ['street', 'block', 'skyline'])
      for (const time of ['noon', 'late'])
        for (const mode of ['economy', 'high'])
          await shot(`${distance}-${time}-${mode}`, { distance, time, mode });
    await shot('silhouette', { distance: 'skyline', mode: 'economy', silhouette: true });
    for (const camera of spec.qaCameras)
      await shot(camera.name, { position: camera.position, lookAt: camera.lookAt });
    for (const level of ['skyline', 'district', 'street', 'closeup'])
      await shot(`transition-${level}`, { distance: 'block', level });
    const pack = JSON.parse(await readFile(resolve(root, 'content/worldgen/stylepack.json'))),
      sidecar = JSON.parse(
        await readFile(resolve(root, 'content/worldgen', pack.assets[spec.assetId])),
      );
    const report = {
      format: 'molen/medium-fi-review@1',
      assetId: spec.assetId,
      sourceHash: spec.mesh.sha256,
      runtimeHash: sidecar.hash,
      fixtureHash,
      rig: await page.evaluate(() => window.mediumFi.rig),
      neighborTriangles: await page.evaluate(() => window.mediumFi.neighborTriangles),
      runtimeLods: sidecar.runtimeLods.levels,
      context: 'Synthetic procedural neighbors at Y=0; not evidence of geographic fit.',
      status: 'captures-pending-inspection',
      frames,
      errors,
    };
    if (errors.length) throw new Error(errors.join('; '));
    await writeFile(resolve(dir, 'medium-fi-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    await page.close();
    console.log(`${id}: ${frames.length} medium-fi frames`);
  }
} finally {
  await browser?.close();
  await server.close();
}
