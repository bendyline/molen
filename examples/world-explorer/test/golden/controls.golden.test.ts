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

it('moves the explorer from a connected joystick and suspends it while remapping', async () => {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.addInitScript(() => {
      const pad = {
        id: 'Explorer flight stick',
        index: 0,
        connected: true,
        mapping: '',
        axes: [0, 0, 0, 0],
        buttons: [],
      };
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => (pad.connected ? [pad] : []),
      });
      Object.assign(window, { joystickTestPad: pad });
    });
    // Pin local noon: movement is per frame, and the default date is night on UTC CI.
    await page.goto(
      `${url}/?synthetic=1&worldgen=0&mode=bare&ambient=0&audio=0&backend=webgl&quality=low&date=2024-03-24T19:00:00Z`,
    );
    const status = page.locator('#navigation-status');
    const position = () =>
      status.evaluate((node) => [
        Number((node as HTMLElement).dataset.x),
        Number((node as HTMLElement).dataset.z),
      ]);
    await expect
      .poll(async () => (await position()).every(Number.isFinite), { timeout: 60_000 })
      .toBe(true);
    await page.locator('canvas#view').focus();
    const before = await position();
    await page.evaluate(() => {
      (window as unknown as { joystickTestPad: { axes: number[] } }).joystickTestPad.axes[1] =
        -0.56;
    });
    await expect
      .poll(
        async () =>
          Math.hypot(...(await position()).map((value, index) => value - (before[index] ?? 0))),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(2);
    // A visible window can lose focus without browser rAF throttling. The held joystick must
    // stop advancing the view until focus returns.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const unfocused = await position();
    await page.waitForTimeout(650);
    expect(await position()).toEqual(unfocused);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect
      .poll(
        async () =>
          Math.hypot(...(await position()).map((value, index) => value - (unfocused[index] ?? 0))),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(2);
    await page.getByRole('button', { name: 'Controllers (1)', exact: true }).click();
    await page.getByLabel('Profile', { exact: true }).selectOption('fly');
    // Keep holding the stick: opening the editor must stop navigation immediately.
    const paused = await page.locator('#view').evaluate(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      const node = document.querySelector<HTMLElement>('#navigation-status');
      return [node?.dataset.x, node?.dataset.z];
    });
    await page.locator('#view').evaluate(() => new Promise((resolve) => setTimeout(resolve, 650)));
    expect((await position()).map(String)).toEqual(paused?.map((value) => String(Number(value))));
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    // Resumed streaming can delay browser queries beyond the default 1 s on software renderers.
    await expect
      .poll(() => page.locator('#view').evaluate((node) => node === document.activeElement), {
        timeout: 10_000,
      })
      .toBe(true);
    const resumed = await position();
    await expect
      .poll(
        async () =>
          Math.hypot(...(await position()).map((value, index) => value - (resumed[index] ?? 0))),
        { timeout: 10_000 },
      )
      .toBeGreaterThan(2);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
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
