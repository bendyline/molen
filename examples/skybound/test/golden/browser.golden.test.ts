import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

it('plays the built Worker game under a hosting subpath and restarts cleanly', async () => {
  const base = '/games/skybound/';
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
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${address.port}${base}`);
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.tick) > 3);
    await mkdir('.artifacts', { recursive: true });
    await page.screenshot({ path: '.artifacts/start.png' });
    await page.keyboard.down('KeyD');
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.x) > 1);
    await page.keyboard.down('Space');
    await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.y) > 2);
    await page.keyboard.up('Space');
    await page.keyboard.up('KeyD');
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
