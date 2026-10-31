import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

it('keeps centimeter-scale High shadows after boarding an aircraft in the explorer', async () => {
  const out = resolve('test/golden/__output__/aircraft-shadows');
  await mkdir(out, { recursive: true });
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing preview address');
  const channel = process.env.MOLEN_TEST_BROWSER_CHANNEL;
  const browser = await chromium.launch({
    headless: true,
    ...(channel ? { channel } : {}),
    args: channel
      ? ['--enable-unsafe-webgpu']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    for (const backend of channel ? ['webgl', 'webgpu'] : ['webgl']) {
      // The projection assertion is independent of viewport resolution; keep CI rasterization
      // small while retaining full-size evidence when checking native graphics backends.
      const width = channel ? 1600 : 800;
      const height = channel ? 1100 : 550;
      const page = await browser.newPage({ viewport: { width, height } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        // Use the real explorer and aircraft boarding path; a renderer-only fixture cannot
        // catch the shared Mounted.vehicle field accidentally selecting driving shadows.
        await page.goto(
          `http://127.0.0.1:${address.port}/?synthetic=1&style=none&ground=flat&ambient=0&wildlife=0&airportTraffic=0&audio=0&quality=high&backend=${backend}&aircraft=p51d&freeze=1&date=2026-10-30T20:00:00Z&weather=sunny&hud=0`,
        );
        await page.locator('#navigation-status[data-state=grounded]').waitFor({
          state: 'attached',
          timeout: 120_000,
        });
        await page.locator('canvas#view').focus();
        await page.keyboard.press('e');
        await page.locator('#navigation-status[data-aircraft=p51d]').waitFor({
          state: 'attached',
          timeout: 30_000,
        });
        await page.keyboard.press('v');
        await page
          .locator('#navigation-status[data-view=chase][data-shadow-map="4096"]')
          .waitFor({ state: 'attached', timeout: 30_000 });
        await page.mouse.move(width * 0.8, height * 0.5);
        await page.mouse.down();
        await page.mouse.move(width * 0.8, height * 0.5 + 77, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        const state = await page.locator('#navigation-status').evaluate((node) => ({
          ...(node as HTMLElement).dataset,
        }));
        await page.screenshot({ path: resolve(out, `${backend}.png`) });
        await writeFile(
          resolve(out, `${backend}.json`),
          JSON.stringify({ state, errors }, null, 2),
        );
        expect(errors).toEqual([]);
        expect(state.aircraft).toBe('p51d');
        expect(state.vehicle).toBe('aircraft-p51d');
        expect(state.shadowMode).toBe('fly');
        expect(Number(state.shadowMap)).toBe(4096);
        // Check the applied projection, not just the selected quality or requested radius.
        expect(Number(state.shadowSpan) / Number(state.shadowMap)).toBeLessThan(0.025);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((done) => server.httpServer.close(() => done()));
  }
});
