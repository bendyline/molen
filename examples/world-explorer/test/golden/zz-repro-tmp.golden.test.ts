// TEMPORARY repro for CI run 40384379073; delete after investigation.
import { appendFileSync } from 'node:fs';
import { type Browser, chromium } from 'playwright';
const log = (s: string) => appendFileSync(process.env.REPRO_LOG ?? 'repro.log', `${s}
`);
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: PreviewServer;
let browser: Browser;
let url: string;
const cores = Number(process.env.REPRO_CORES ?? 4);
const throttle = Number(process.env.REPRO_THROTTLE ?? 1);
const hold = process.env.REPRO_HOLD !== '0';

beforeAll(async () => {
  server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing preview address');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
});
afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
});

it('repro', async () => {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  await page.addInitScript((n) => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => n });
  }, cores);
  if (throttle > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  }
  page.on('console', (m) => {
    const t = m.text();
    if (/molen|error|warn/i.test(t)) log(`[console:${m.type()}] ${t.slice(0, 300)}`);
  });
  page.on('pageerror', (e) => log(`[pageerror] ${e.message}`));
  const workers: string[] = [];
  page.on('worker', (w) => workers.push(w.url().replace(url, '')));
  let release = () => {};
  const allowed = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (hold)
    await page.route('**/assets/material-worker-*.js', async (route) => {
      await allowed;
      await route.continue();
    });
  const t0 = Date.now();
  await page.goto(`${url}/index.html?synthetic=1&quality=economy&freeze=1&backend=webgl`);
  await page.waitForFunction(
    () => document.querySelector('#location')?.textContent?.includes('Altitude'),
    undefined,
    { timeout: 300000 },
  );
  log(`altitude after ${Date.now() - t0}ms; workers so far: ${workers.join(', ')}`);
  await page.locator('button[data-mode="human"]').click();
  const t1 = Date.now();
  let found = false;
  while (Date.now() - t1 < 240000) {
    const status = (await page.locator('#status').textContent()) ?? '';
    const worldgen = status.match(/worldgen[^\n]*?MiB|worldgen off[^\n]*/)?.[0] ?? '(none)';
    const tiles = status.match(/tiles \d+ resident[^l]*loading terrain · \d+ loading layers/)?.[0];
    const perf = await page.locator('#performance-status').evaluate((e) => ({
      frame: (e.textContent ?? '').match(/frame [^\n·]*/)?.[0],
      graphics: (e as HTMLElement).dataset.graphics,
    }));
    log(`+${Date.now() - t1}ms ${worldgen} | ${tiles} | ${perf.frame}`);
    if (/worldgen [1-9]\d* buildings/.test(status) || Date.now() - t1 > 30000) {
      const g = JSON.parse(perf.graphics ?? '{}') as {
        stages?: Record<string, { count: number; mean: number; max: number }>;
      };
      for (const [k, v] of Object.entries(g.stages ?? {}))
        log(`  ${k}: n=${v.count} mean=${v.mean.toFixed(1)} max=${v.max.toFixed(0)}`);
    }
    if (/worldgen [1-9]\d* buildings/.test(status)) {
      found = true;
      break;
    }
    await page.waitForTimeout(3000);
  }
  log(`workers: ${workers.join(', ')}`);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await page.close();
  expect(found).toBe(true);
});
