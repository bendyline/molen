import { type Browser, chromium, type Page } from 'playwright';
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
  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
    ],
  });
});
afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => server?.httpServer.close(() => resolve()));
});

// Cheap, fixed daylight over bare ground, in a small window at economy quality: CI draws the page
// in software, and nothing here depends on what the world looks like. Landing the walker took 18 s
// of a developer machine's software rendering (40 s at `quality=low`, 1000 by 700).
const WALK =
  '/?synthetic=1&worldgen=0&mode=bare&ambient=0&audio=0&backend=webgl&quality=economy&sky=daylight&ground=flat&shadows=0&navigation=walk';

/** Wait for `#navigation-status` (written a few times a second) to report every given value. */
const status = async (page: Page, expected: Record<string, string>): Promise<void> => {
  await page.waitForFunction(
    (values) => {
      const data = document.querySelector<HTMLElement>('#navigation-status')?.dataset;
      return Object.entries(values).every(([key, value]) => data?.[key] === value);
    },
    expected,
    { timeout: 600_000 },
  );
};

it('walks with a figure behind the camera, which the designer dresses and remembers', async () => {
  const page = await browser.newPage({ viewport: { width: 720, height: 480 } });
  // Clicks wait for the page between software-rendered frames.
  page.setDefaultTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const saved = (): Promise<string | null> =>
    page.evaluate(() => localStorage.getItem('molen.world-explorer.figure'));
  const source = (): Promise<string | undefined> =>
    page.evaluate(() => document.getElementById('figure-controls')?.dataset.source);
  try {
    await page.goto(`${url}${WALK}`);
    await status(page, { state: 'grounded', walkView: 'third', figure: 'true' });
    expect(await source()).toBe('random');
    expect(await saved()).toBeNull();
    await page.locator('canvas#view').focus();
    // V steps on from behind the walker to the flyby view beside the way ahead, then their eyes.
    await page.keyboard.press('v');
    await status(page, { walkView: 'flyby', figure: 'true' });
    await page.keyboard.press('v');
    await status(page, { walkView: 'first', figure: 'false' });
    await page.keyboard.press('v');
    await status(page, { walkView: 'third', figure: 'true' });

    // React and the designer load when they are asked for, in a dialog.
    await page.locator('#figure-design').click();
    const dialog = page.locator('#figure-dialog');
    await dialog.getByRole('tab', { name: 'Clothing' }).waitFor({ timeout: 240_000 });
    // The page's own bare `button` and `label` rules stay out of it.
    expect(
      await dialog
        .locator('[data-part="option"]')
        .first()
        .evaluate((option) => getComputedStyle(option).display),
    ).toBe('grid');
    await dialog.getByRole('button', { name: 'Surprise me' }).click();
    expect(await source()).toBe('saved');
    const designed = await saved();
    expect(JSON.parse(designed ?? '{}').format).toBe('molen/figure-look@1');
    await dialog.getByRole('button', { name: 'Done' }).click();
    await page.waitForFunction(
      () => document.querySelector('#view') === document.activeElement,
      undefined,
      { timeout: 120_000 },
    );
    await status(page, { figure: 'true' });

    await page.reload();
    await status(page, { state: 'grounded', figure: 'true' });
    expect(await source()).toBe('saved');
    expect(await saved()).toBe(designed);
    // Someone new for this visit leaves the design where it is.
    await page.locator('#figure-random').click();
    expect(await source()).toBe('visit');
    expect(await saved()).toBe(designed);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
