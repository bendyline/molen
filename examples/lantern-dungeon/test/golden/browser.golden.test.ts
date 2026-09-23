import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';
import { verifyAssets } from '../../tools/verify-assets.mjs';

it('plays the built Worker game under a hosting subpath and restarts cleanly', async () => {
  expect((await verifyAssets({ builtDir: 'dist' })).errors).toEqual([]);
  const base = '/games/lantern-dungeon/';
  const server = await preview({
    base,
    root: resolve('.'),
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0 },
  });
  const address = server.httpServer.address();
  if (address === null || typeof address === 'string') throw new Error('No preview address');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
    ],
  });
  try {
    // A software rasterizer cannot drive 1280x800 and still leave the main thread responsive:
    // starved frames stall both the 80ms HUD interval and Playwright's polling, so scripted play
    // burns game ticks it should not and the sentinels win. The later resize covers wide layout.
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    // Playwright's page waits default to 30s, independent of vitest's budget. Booting this game
    // under a software rasterizer measured ~24s on its own, so the default left almost no headroom
    // and the boot wait timed out whenever the golden suites ran alongside each other. Like the
    // explorer's budgets, this is a "definitely wedged" threshold, not an expected duration.
    page.setDefaultTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const models = new Set<string>();
    page.on('response', (response) => {
      if (!response.url().endsWith('/model.glb')) return;
      if (response.ok()) models.add(response.url());
      else errors.push(`Asset HTTP ${response.status()}: ${response.url()}`);
    });
    await page.goto(`http://127.0.0.1:${address.port}${base}`);
    // The worker boots paused, so assets land first and the vault only then starts ticking —
    // waiting in this order also proves the page's resume control reached the kernel.
    await page.waitForFunction(
      () => document.querySelector('canvas')?.dataset.assetsReady === 'true',
    );
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.tick) > 3);
    expect(models.size).toBe(28);
    await mkdir('.artifacts', { recursive: true });
    await page.screenshot({ path: '.artifacts/start.png' });
    // Every wait below assumes a live run; a dead player freezes the gameplay systems and would
    // otherwise surface as an opaque 30s timeout rather than a legible failure.
    expect(await page.evaluate(() => document.querySelector('canvas')?.dataset.status)).toBe(
      'playing',
    );
    // Retreat into the safe spawn area instead of walking toward sentinel0. The simulation runs
    // in a Worker, so under parallel golden-test load it can keep advancing while the renderer
    // and Playwright's polling are starved; approaching the sentinel would then turn this input-
    // plumbing test into a race against its combat AI. Combat is covered by the headless test.
    await page.keyboard.down('KeyS');
    // Polling on a timer, not rAF: observation must not be hostage to the renderer's frame rate.
    await page.waitForFunction(
      () => Number(document.querySelector('canvas')?.dataset.z) > 12.5,
      null,
      { polling: 50 },
    );
    await page.keyboard.up('KeyS');
    await page.keyboard.down('ArrowLeft');
    await page.waitForFunction(
      () => Number(document.querySelector('canvas')?.dataset.yaw) > 0.2,
      null,
      { polling: 50 },
    );
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => Number(document.querySelector('canvas')?.dataset.attackTick) >= 0,
      null,
      { polling: 50 },
    );
    await page.screenshot({ path: '.artifacts/playing.png' });
    await page.keyboard.press('KeyR');
    await page.waitForFunction(
      () =>
        Math.abs(Number(document.querySelector('canvas')?.dataset.x)) < 0.01 &&
        document.querySelector('canvas')?.dataset.status === 'playing',
    );
    expect(await page.locator('#diagnostic').innerText()).toBe('');
    expect(errors).toEqual([]);
    // Resize exercises follow-camera projection and the responsive HUD.
    await page.setViewportSize({ width: 720, height: 900 });
    await page.screenshot({ path: '.artifacts/narrow.png' });
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : done())),
    );
  }
});
