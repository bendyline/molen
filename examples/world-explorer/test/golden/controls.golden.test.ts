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
    // Exercise the real navigation loop with cheap, fixed daylight. Dynamic sky/weather,
    // ground shaders and shadows can stall browser queries on CI's software renderer.
    await page.goto(
      `${url}/?synthetic=1&worldgen=0&mode=bare&ambient=0&audio=0&backend=webgl&quality=low&sky=daylight&ground=flat&shadows=0`,
    );
    const status = page.locator('#navigation-status');
    const position = () =>
      status.evaluate((node): [number, number] => [
        Number((node as HTMLElement).dataset.x),
        Number((node as HTMLElement).dataset.z),
      ]);
    // Poll in the browser so a slow frame does not leave a host-side expect.poll callback
    // waiting on another protocol round trip when its timeout expires.
    const waitForMovement = (origin: [number, number]) =>
      page.waitForFunction(
        ([x, z]) => {
          const node = document.querySelector<HTMLElement>('#navigation-status');
          return Math.hypot(Number(node?.dataset.x) - x, Number(node?.dataset.z) - z) > 2;
        },
        origin,
        { timeout: 10_000 },
      );
    await page.waitForFunction(
      () => {
        const node = document.querySelector<HTMLElement>('#navigation-status');
        return [Number(node?.dataset.x), Number(node?.dataset.z)].every(Number.isFinite);
      },
      undefined,
      { timeout: 60_000 },
    );
    await page.locator('canvas#view').focus();
    const before = await position();
    await page.evaluate(() => {
      (window as unknown as { joystickTestPad: { axes: number[] } }).joystickTestPad.axes[1] =
        -0.56;
    });
    await waitForMovement(before);
    // A visible window can lose focus without browser rAF throttling. The held joystick must
    // stop advancing the view until focus returns.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const unfocused = await position();
    await page.waitForTimeout(650);
    expect(await position()).toEqual(unfocused);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await waitForMovement(unfocused);
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
    await page.waitForFunction(
      () => document.querySelector('#view') === document.activeElement,
      undefined,
      { timeout: 10_000 },
    );
    const resumed = await position();
    await waitForMovement(resumed);
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

it('keeps aircraft controls live after panel clicks without taking keys from typed fields', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
  const status = page.locator('#navigation-status');
  const throttle = async (): Promise<number> =>
    Number((await status.textContent())?.match(/Throttle (\d+)%/)?.[1]);
  const rpm = async (): Promise<number> =>
    Number((await status.textContent())?.match(/RPM (\d+)%/)?.[1]);
  const raiseThrottle = async (): Promise<void> => {
    const before = await throttle();
    await page.keyboard.down('Equal');
    await expect.poll(throttle, { timeout: 60_000 }).toBeGreaterThan(before);
    await page.keyboard.up('Equal');
  };
  try {
    // Noon in Seattle. Left out, the sky takes noon in the browser's own time zone: night there
    // on a UTC machine such as CI's, where software rendering ran half as fast as by day and a
    // panel click outlasted its 30 s.
    await page.goto(
      `${url}/?synthetic=1&worldgen=0&audio=0&backend=webgl&date=2026-11-11T20:00:00Z`,
    );
    await page
      .locator('#aircraft-catalog option[value="cessna_182t"]')
      .waitFor({ state: 'attached', timeout: 120_000 });
    await page.selectOption('#aircraft-catalog', 'cessna_182t');
    await status.filter({ hasText: 'Board Cessna' }).waitFor({ timeout: 180_000 });
    await page.keyboard.press('KeyE');
    await status.filter({ hasText: 'Throttle' }).waitFor({ timeout: 60_000 });
    await page.keyboard.press('KeyI');
    await status.filter({ hasText: 'Engine on' }).waitFor({ timeout: 60_000 });
    // "Engine on" is the switch. The exit is refused once the engine turns over, above 12% RPM
    // (it idles at 18%); clicked before, as slow frames allow, the pilot simply climbs out.
    await expect.poll(rpm, { timeout: 60_000 }).toBeGreaterThan(12);

    // A running engine refuses the exit, so this button stops before its usual focus hand-back.
    await page.locator('button[data-navigation="walk"]').click();
    await status.filter({ hasText: 'before exiting' }).waitFor({ timeout: 60_000 });
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('view');
    await raiseThrottle();

    const raised = await throttle();
    await page.keyboard.down('Minus');
    await expect.poll(throttle, { timeout: 60_000 }).toBeLessThan(raised);
    await page.keyboard.up('Minus');

    // Ctrl is no flight key, so its chords stay with the browser, including zoom on the power keys.
    const notPrevented = await page.evaluate(() =>
      document.getElementById('view')?.dispatchEvent(
        new KeyboardEvent('keydown', {
          code: 'Equal',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(notPrevented).toBe(true);

    // A checkbox keeps focus, which must cost it the flight keys but not its own Space.
    await page.locator('#surface-controls summary').click();
    const streetlights = page.locator('[data-surface-detail="streetlights"]');
    await streetlights.click();
    await raiseThrottle();
    const checked = await streetlights.isChecked();
    await page.keyboard.press('Space');
    expect(await streetlights.isChecked()).toBe(!checked);

    // E is a flight key and part of this number, so a too-broad guard loses it from the field.
    await page.locator('#weather-controls summary').click();
    const cloudBase = page.locator('#weather-base');
    await cloudBase.fill('');
    await cloudBase.focus();
    await page.keyboard.type('1e3');
    expect(await cloudBase.inputValue()).toBe('1e3');
  } finally {
    await page.close();
  }
});

it('takes clicks on the world while the pointer is already locked', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const lockedBy = (): Promise<string | undefined> =>
    page.evaluate(() => document.pointerLockElement?.id);
  try {
    await page.goto(`${url}/?synthetic=1&worldgen=0&audio=0&backend=webgl&navigation=walk`);
    await expect
      .poll(
        async () => {
          await page.mouse.click(800, 360);
          return lockedBy();
        },
        { timeout: 120_000, interval: 500 },
      )
      .toBe('view');
    await page.mouse.click(800, 360);
    expect(await lockedBy()).toBe('view');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
