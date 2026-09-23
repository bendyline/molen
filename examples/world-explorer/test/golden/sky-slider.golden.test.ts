import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Browser, chromium } from 'playwright';
import { PNG } from 'pngjs';
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: PreviewServer;
let browser: Browser;
let url: string;
const out = join(process.cwd(), 'test/golden/__output__/sky-slider');
// CI sets MOLEN_SKIP_WEBGPU=1: its CPU-only runners lose the SwiftShader WebGPU device on this
// scene, so the WebGPU case skips as if no adapter existed and the WebGL cases still run.
const skipWebGpu = process.env.MOLEN_SKIP_WEBGPU === '1';

beforeAll(async () => {
  await mkdir(out, { recursive: true });
  server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing preview address');
  url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-unsafe-webgpu',
      '--use-webgpu-adapter=swiftshader',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ],
  });
});
afterAll(async () => {
  await browser?.close();
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
});

function skyBrightness(image: Buffer): number {
  const png = PNG.sync.read(image);
  let sum = 0;
  let count = 0;
  for (let y = 80; y < 200; y++) {
    for (let x = 500; x < 1100; x++) {
      const i = (y * png.width + x) * 4;
      sum += ((png.data[i] ?? 0) + (png.data[i + 1] ?? 0) + (png.data[i + 2] ?? 0)) / 3;
      count++;
    }
  }
  return sum / count;
}

describe('browser: sky time slider', () => {
  it('renders the camera and responds to time changes while material workers are still loading', async () => {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.text().startsWith('[molen] worldgen material ')) errors.push(message.text());
    });
    let release = () => {};
    const materialsAllowed = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requested = false;
    // The pack validates graph documents before startup. Hold the expensive baking workers,
    // independently of those metadata fetches, to prove baking cannot gate the first frame.
    await page.route('**/assets/material-worker-*.js', async (route) => {
      requested = true;
      await materialsAllowed;
      await route.continue();
    });
    const timings = () =>
      page.locator('#performance-status').evaluate((element) => {
        return JSON.parse((element as HTMLElement).dataset.startup ?? '{}') as Record<
          string,
          number
        >;
      });
    try {
      await page.goto(`${url}/index.html?synthetic=1&quality=economy&freeze=1&backend=webgl`);
      await page.waitForFunction(
        () => document.querySelector('#location')?.textContent?.includes('Altitude'),
        undefined,
        { timeout: 60000 },
      );
      await page.waitForFunction(
        () => !document.querySelector<HTMLElement>('#worldgen-status')?.hidden,
      );
      await expect.poll(() => requested).toBe(true);
      const pending = await timings();
      expect(pending['first-frame']).toBeGreaterThan(0);
      expect(pending['material-baking-start']).toBeGreaterThan(pending['first-frame'] ?? 0);
      expect(pending['material-baking']).toBeUndefined();
      const camera = await page.locator('#location').textContent();
      const sky = await page.locator('#sky-status').getAttribute('data-utc-ms');
      await page.locator('#sky-time').press('ArrowRight');
      await page.waitForFunction(
        (initial) => document.querySelector<HTMLElement>('#sky-status')?.dataset.utcMs !== initial,
        sky,
      );
      expect(await page.locator('#location').textContent()).toBe(camera);
      expect((await timings())['material-baking']).toBeUndefined();
      release();
      await page.waitForFunction(
        () =>
          !!JSON.parse(
            document.querySelector<HTMLElement>('#performance-status')?.dataset.startup ?? '{}',
          )['material-baking'],
        undefined,
        { timeout: 120000 },
      );
      expect(await page.locator('#worldgen-status').isHidden()).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
      await page.close();
    }
  });

  for (const backend of ['webgl', 'webgpu']) {
    it(`${backend}: seeks a day and changes the date without moving the camera`, async (context) => {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 800 },
        timezoneId: 'America/Los_Angeles',
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.route('**/sky-probe', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
        );
        await page.goto(`${url}/sky-probe`);
        if (
          backend === 'webgpu' &&
          (skipWebGpu ||
            !(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter()))))
        ) {
          expect(process.env.MOLEN_REQUIRE_WEBGPU).not.toBe('1');
          context.skip();
          return;
        }
        await page.goto(
          `${url}/index.html?synthetic=1&level=8&quality=economy&nostyles=1&freeze=1&backend=${backend}&date=2024-03-24T19:00:00Z&yaw=0.59&pitch=0.44`,
        );
        await page.waitForFunction(
          () => document.querySelector('#sky-status')?.textContent?.includes('Moon'),
          undefined,
          { timeout: 60000 },
        );
        const camera = await page.locator('#location').textContent();
        const initial = await page.locator('#sky-status').textContent();
        expect(await page.locator('#sky-time-zone').textContent()).toContain('America/Los_Angeles');
        const day = await page.screenshot({ path: join(out, `${backend}-day.png`) });
        const seek = async (minutes: number): Promise<void> => {
          const expected = await page.locator('#sky-time').evaluate((element, value) => {
            (element as HTMLInputElement).value = String(value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            const instant = new Date(
              `${(document.querySelector('#sky-date') as HTMLInputElement).value}T00:00:00`,
            );
            instant.setMinutes(value);
            return String(instant.getTime());
          }, minutes);
          await page.waitForFunction(
            (stamp) => document.querySelector<HTMLElement>('#sky-status')?.dataset.utcMs === stamp,
            expected,
            { timeout: 60000 },
          );
          expect(errors).toEqual([]);
        };
        await seek(1320);
        expect(await page.locator('#sky-time-label').textContent()).toContain('22:00');
        const nightStatus = await page.locator('#sky-status').textContent();
        expect(nightStatus).not.toBe(initial);
        expect(nightStatus).toContain('100% lit');
        const night = await page.screenshot({ path: join(out, `${backend}-night.png`) });
        expect(skyBrightness(night)).toBeLessThan(skyBrightness(day) * 0.6);
        expect(await page.locator('#location').textContent()).toBe(camera);
        await seek(1440);
        expect(await page.locator('#sky-time-label').textContent()).toContain('next day');
        expect(await page.locator('#sky-status').textContent()).not.toBe(nightStatus);
        await page.locator('#sky-date').fill('2024-04-08');
        await page.locator('#sky-date').press('Tab');
        await seek(720);
        expect(await page.locator('#sky-status').textContent()).toContain('0% lit');
        await page.locator('#sky-time').focus();
        await page.locator('#sky-time').press('ArrowRight');
        expect(await page.locator('#sky-time-label').textContent()).toContain('12:01');
        expect(await page.locator('#location').textContent()).toBe(camera);
        await page.locator('#sky-now').click();
        expect(await page.locator('#sky-date').inputValue()).not.toBe('2024-04-08');
        expect(errors).toEqual([]);
      } finally {
        await page.close();
        expect(errors).toEqual([]);
      }
    });
  }
});
