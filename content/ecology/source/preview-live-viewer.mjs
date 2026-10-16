/** Live streamed Earth acceptance capture; reports measured browser timing separately from fixtures. */
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const explorer = resolve(root, 'examples/world-explorer');
const require = createRequire(resolve(explorer, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium } = createRequire(resolve(root, 'packages/tooling/package.json'))('playwright');
const value = (key, fallback) =>
  process.argv.find((arg) => arg.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const quality = value('quality', 'economy'),
  name = value('name', `seattle-forest-${quality}`);
const out = resolve(root, '.artifacts/regional-world/live');
await mkdir(out, { recursive: true });
const server = await createServer({
  root: explorer,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
const evidence = {
  name,
  quality,
  pageErrors: [],
  warnings: [],
  frames: [],
  agricultureRequests: [],
};
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    args: process.platform === 'win32' ? ['--use-angle=d3d11'] : [],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('/agriculture/'))
      evidence.agricultureRequests.push({
        url: response.url(),
        status: response.status(),
      });
  });
  page.on('console', (message) => {
    if (['warning', 'error'].includes(message.type()) && evidence.warnings.length < 60)
      evidence.warnings.push(message.text());
  });
  const params = new URLSearchParams({
    quality,
    backend: 'webgl',
    sky: 'daylight',
    month: '7',
    ambient: '1',
    materialWorker: '0',
    hud: '0',
    lon: value('lon', '-122.010'),
    lat: value('lat', '47.568'),
    alt: value('alt', '210'),
    yaw: '-1.57',
    pitch: '-0.18',
    ...(value('package', '')
      ? { package: `/@fs/${resolve(root, value('package', '')).replaceAll('\\', '/')}` }
      : {}),
    ...JSON.parse(value('params', '{}')),
  });
  const address = server.httpServer.address();
  if (typeof address === 'string' || address === null) throw new Error('Missing live server port');
  evidence.url = `http://127.0.0.1:${address.port}/?${params}`;
  await page.goto(evidence.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#navigation-status[data-state="fly"]', { timeout: 60000 });
  await page.locator('button[data-mode="human"]').click();
  const waitQuiet = () =>
    page.waitForFunction(
      () => {
        const text = document.querySelector('#status')?.textContent ?? '';
        const ready =
          /tiles [1-9]\d* resident/.test(text) &&
          text.includes('0 loading terrain') &&
          text.includes('0 loading layers');
        const state = window;
        if (!ready) state.__regionalQuietSince = undefined;
        else state.__regionalQuietSince ??= performance.now();
        return ready && performance.now() - state.__regionalQuietSince > 2500;
      },
      undefined,
      { timeout: 180000 },
    );
  try {
    await waitQuiet();
  } catch (error) {
    evidence.loadTimeout = error.message;
  }
  await page.screenshot({ path: resolve(out, `${name}-arrival.png`), timeout: 30000 });
  evidence.frames.push(`${name}-arrival.png`);
  evidence.arrival = await page.evaluate(() => ({
    status: document.querySelector('#status, #error')?.textContent,
    source: document.querySelector('#source')?.textContent,
    navigation: document.querySelector('#navigation-status')?.textContent,
  }));
  if (!evidence.loadTimeout) {
    await page.locator('button[data-navigation="walk"]').click();
    try {
      await page.waitForFunction(
        () => document.querySelector('#navigation-status')?.textContent?.includes('On ground'),
        undefined,
        { timeout: 45000 },
      );
    } catch (error) {
      evidence.walkTimeout = error.message;
    }
    try {
      await waitQuiet();
    } catch (error) {
      evidence.walkLoadingTimeout = error.message;
    }
    await page.screenshot({ path: resolve(out, `${name}-walk.png`), timeout: 30000 });
    evidence.frames.push(`${name}-walk.png`);
    evidence.walk = await page.evaluate(() => ({
      status: document.querySelector('#status, #error')?.textContent,
      navigation: document.querySelector('#navigation-status')?.textContent,
      data: { ...document.querySelector('#navigation-status')?.dataset },
    }));
    if (!evidence.walk.navigation?.includes('On ground'))
      throw new Error('Walking capture was invalidated before the screenshot');
    evidence.timing = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const deltas = [];
          let last,
            finished = false;
          const finish = () => {
            if (finished) return;
            finished = true;
            const sorted = [...deltas].sort((a, b) => a - b);
            resolve({
              frames: deltas.length,
              medianMs: sorted[Math.floor(sorted.length / 2)],
              p95Ms: sorted[Math.floor(sorted.length * 0.95)],
              note: 'Headless Chromium on this machine; not a hardware-independent target.',
            });
          };
          const timer = setTimeout(finish, 20000);
          const sample = (now) => {
            if (finished) return;
            if (last !== undefined) deltas.push(now - last);
            last = now;
            if (deltas.length >= 90) {
              clearTimeout(timer);
              finish();
            } else requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        }),
    );
    evidence.downloads = await page.evaluate(() =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/packs/'))
        .map((entry) => ({
          url: entry.name.split('/packs/')[1],
          bytes: entry.encodedBodySize,
          durationMs: entry.duration,
        })),
    );
  }
} catch (error) {
  evidence.error = error.stack ?? error.message;
} finally {
  await browser?.close();
  await server.close();
}
await writeFile(resolve(out, `${name}.json`), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence));
if (
  evidence.error ||
  evidence.loadTimeout ||
  evidence.walkTimeout ||
  evidence.walkLoadingTimeout ||
  evidence.pageErrors.length
)
  process.exitCode = 1;
