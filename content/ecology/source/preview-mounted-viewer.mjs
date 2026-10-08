/** Run the public mount API on a local real-terrain package, through walk/drive/fly modes. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(resolve(root, 'examples/world-explorer/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const value = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const name = value('name', 'tucson-mount-balanced');
const out = resolve(root, '.artifacts/regional-world/mounted');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root,
  plugins: [
    {
      name: 'regional-mount-review',
      configureServer(server) {
        server.middlewares.use('/__regional_mount', (_req, res) => {
          res.setHeader('Content-Type', 'text/html');
          res.end(
            '<!doctype html><head><link rel="icon" href="data:,"></head><body><script type="module" src="/content/ecology/source/mounted-scene.mjs"></script></body>',
          );
        });
      },
    },
  ],
  optimizeDeps: { entries: ['content/ecology/source/mounted-scene.mjs'] },
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
const evidence = { name, pageErrors: [], cases: [] };
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  const params = new URLSearchParams({
    package: `/${value('package', '.artifacts/regional-world/terrain/tucson/terrain-package.json')}`,
    lat: value('lat', '32.224'),
    lon: value('lon', '-111.094'),
    quality: value('quality', 'balanced'),
  });
  await page.goto(`http://127.0.0.1:${address.port}/__regional_mount?${params}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => window.regionalMount !== undefined, undefined, {
    timeout: 60000,
  });
  const settle = async () => {
    await page.evaluate(() =>
      Promise.race([
        window.regionalMount.whenIdle(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Terrain did not settle')), 120000),
        ),
      ]),
    );
    await page.waitForFunction(
      () => {
        const stats = window.regionalMount.stats();
        return stats.displayedTiles > 0 && stats.loadingTiles === 0 && stats.failedTiles === 0;
      },
      undefined,
      { timeout: 120000 },
    );
  };
  const capture = async (mode) => {
    await settle();
    const state = await page.evaluate(() => ({
      stats: window.regionalMount.stats(),
      camera: window.regionalMount.getCamera(),
      vehicle: window.regionalMount.vehicleStatus(),
    }));
    evidence.cases.push({ mode, ...state });
    await page.screenshot({ path: resolve(out, `${name}-${mode}.png`) });
    console.log(`${name}: ${mode} captured (${state.stats.drawCalls} draws)`);
  };
  await capture('orbit');
  if (!(await page.evaluate(() => window.regionalMount.setMode('walk'))))
    throw new Error('Walk mode unavailable');
  await capture('walk');
  if (!(await page.evaluate(() => window.regionalMount.setMode('drive', { vehicle: true }))))
    throw new Error('Drive mode unavailable');
  await settle();
  await page.locator('canvas').first().focus();
  await page.keyboard.down('KeyW');
  await page.waitForFunction(
    () => Math.abs(window.regionalMount.vehicleStatus()?.speed ?? 0) > 1,
    undefined,
    { timeout: 15000 },
  );
  await page.keyboard.up('KeyW');
  await capture('drive');
  if (
    !(await page.evaluate(() =>
      window.regionalMount.setMode('fly', { force: true, airborne: { altitude: 200, speed: 45 } }),
    ))
  )
    throw new Error('Flight mode unavailable');
  await page.waitForFunction(
    () => window.regionalMount.vehicleStatus()?.kind === 'aircraft',
    undefined,
    { timeout: 60000 },
  );
  await capture('fly');
  evidence.errors = await page.evaluate(() => window.regionalMountErrors);
  evidence.messages = await page.evaluate(() => window.regionalMountMessages);
} catch (error) {
  evidence.error = error.stack ?? String(error);
} finally {
  await browser?.close();
  await server.close();
  await writeFile(resolve(out, `${name}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
}
if (evidence.error || evidence.pageErrors.length || evidence.errors?.length) {
  console.error(JSON.stringify(evidence));
  process.exitCode = 1;
}
