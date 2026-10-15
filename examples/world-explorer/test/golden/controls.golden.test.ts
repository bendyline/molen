import { type Browser, chromium } from 'playwright';
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let browser: Browser;
let server: PreviewServer;
let url: string;
beforeAll(async () => {
  server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing preview address');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});
afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.httpServer.close(() => resolve()));
});

it('offers a scrollable mobile control panel with keyboard dismissal and restored focus', async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let release = (): void => {};
  const loading = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    // No rendering needed: panel navigation must work even while terrain is still loading.
    await page.route('**/packs/**', async (route) => {
      await loading;
      await route.abort();
    });
    await page.goto(`${url}/?synthetic=1&worldgen=0&audio=0&backend=webgl`);
    const toggle = page.locator('#hud-toggle');
    await expect.poll(() => toggle.isVisible()).toBe(true);
    expect(await page.locator('#hud').isVisible()).toBe(false);
    await toggle.press('Enter');
    expect(await toggle.getAttribute('aria-expanded')).toBe('true');
    expect(await page.locator('#hud').isVisible()).toBe(true);
    await page.locator('#quality').focus();
    await page.keyboard.press('Escape');
    expect(await page.locator('#hud').isVisible()).toBe(false);
    expect(await toggle.evaluate((element) => document.activeElement === element)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.setViewportSize({ width: 1280, height: 720 });
    expect(await page.locator('#hud').isVisible()).toBe(true);
    expect(await toggle.isVisible()).toBe(false);
  } finally {
    release();
    await page.close();
  }
});
