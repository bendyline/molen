import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// The facade end to end in a real browser (software WebGL): terrain, worldgen buildings and
// workers stream for real data, the marker and credits appear, and walking lands on the ground.
// It records screenshots for review but asserts behaviour, not pixels, so it holds on any host.

let server: PreviewServer;
let browser: Browser;
let url: string;
const out = join(process.cwd(), 'test/golden/__output__/earth-view');

beforeAll(async () => {
  await mkdir(out, { recursive: true });
  server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
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
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
});

async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__earthView !== undefined, null, { timeout: 90_000 });
  await page.evaluate(() => window.__earthView?.whenIdle());
  await page.waitForFunction(() => (window.__earthView?.stats().frames ?? 0) > 10, null, {
    timeout: 60_000,
  });
}

describe('browser: earth view', () => {
  it('mounts real terrain with buildings, a marker and credits, then walks on the ground', async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${url}/`);
    await settled(page);

    const stats = await page.evaluate(() => window.__earthView?.stats());
    expect(stats?.displayedTiles).toBeGreaterThan(0);
    expect(stats?.failedTiles).toBe(0);
    expect(stats?.maxDisplayedLevel).toBeGreaterThanOrEqual(13);
    expect(stats?.markers).toBe(1);
    // Tiles batch into few draw calls; buildings and terrain still add up to real geometry.
    expect(stats?.drawCalls).toBeGreaterThan(0);
    expect(stats?.triangles).toBeGreaterThan(20_000);
    expect(await page.locator('#credit').textContent()).toContain('OpenStreetMap');
    await page.screenshot({ path: join(out, '01-orbit.png') });

    const walking = await page.evaluate(() => window.__earthView?.setMode('walk'));
    expect(walking).toBe(true);
    await page.waitForFunction(
      () => {
        const view = window.__earthView;
        const camera = view?.getCamera();
        return camera?.mode === 'walk' && (view?.stats().frames ?? 0) > 0;
      },
      null,
      { timeout: 60_000 },
    );
    await page.evaluate(() => window.__earthView?.whenIdle());
    await page.waitForTimeout(1_000);
    const camera = await page.evaluate(() => window.__earthView?.getCamera());
    expect(camera?.mode).toBe('walk');
    // Sammamish plateau ground is 100-200 m; the eye sits 1.7 m above it.
    expect(camera?.altitude).toBeGreaterThan(20);
    expect(camera?.altitude).toBeLessThan(400);
    await page.screenshot({ path: join(out, '02-walk.png') });
    expect(errors).toEqual([]);
    await page.close();
  });
});
