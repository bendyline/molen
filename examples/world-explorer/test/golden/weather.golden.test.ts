import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { type Browser, chromium } from 'playwright';
import { PNG } from 'pngjs';
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: PreviewServer, browser: Browser, url: string;
const out = join(process.cwd(), 'test/golden/__output__/weather');
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
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : resolve())),
    );
});

function difference(a: Buffer, b: Buffer): number {
  const first = PNG.sync.read(a),
    second = PNG.sync.read(b);
  let sum = 0,
    count = 0;
  for (let y = 70; y < 500; y++)
    for (let x = 480; x < first.width; x++) {
      const i = (y * first.width + x) * 4;
      for (let c = 0; c < 3; c++) {
        sum += Math.abs((first.data[i + c] ?? 0) - (second.data[i + c] ?? 0));
        count++;
      }
    }
  return sum / count;
}

describe('weather profiles in the explorer', () => {
  for (const backend of ['webgl', 'webgpu'])
    it(`${backend}: renders clouds, precipitation and custom independent parameters`, async (context) => {
      const page = await browser.newPage({
        viewport: { width: 1100, height: 720 },
        timezoneId: 'America/Los_Angeles',
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      try {
        await page.route('**/weather-probe', (route) =>
          route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }),
        );
        await page.goto(`${url}/weather-probe`);
        if (
          backend === 'webgpu' &&
          !(await page.evaluate(async () => !!(await navigator.gpu?.requestAdapter())))
        ) {
          expect(process.env.MOLEN_REQUIRE_WEBGPU).not.toBe('1');
          context.skip();
          return;
        }
        await page.goto(
          `${url}/index.html?synthetic=1&level=8&nostyles=1&quality=economy&freeze=1&backend=${backend}&date=2024-06-21T19:00:00Z&alt=400&pitch=0.3`,
        );
        await page.waitForFunction(
          () => !!document.querySelector<HTMLElement>('#weather-status')?.dataset.effects,
          undefined,
          { timeout: 60000 },
        );
        const camera = await page.locator('#location').textContent();
        const initial = await page.screenshot({ path: join(out, `${backend}-sunny.png`) });
        for (const profile of ['partly-cloudy', 'overcast', 'rain', 'snow', 'fog']) {
          await page.locator('#weather-profile').selectOption(profile);
          await page.waitForFunction((expected) => {
            const status = document.querySelector<HTMLElement>('#weather-status');
            const w = JSON.parse(status?.dataset.weather ?? '{}');
            const effects = JSON.parse(status?.dataset.effects ?? '{}');
            return (
              effects.cloudLayers === 2 &&
              (expected === 'rain' || expected === 'snow'
                ? effects.particles > 0 && w.precipitation?.kind === expected
                : effects.particles === 0)
            );
          }, profile);
          const shot = await page.screenshot({ path: join(out, `${backend}-${profile}.png`) });
          expect(difference(initial, shot), profile).toBeGreaterThan(2);
          expect(await page.locator('#location').textContent()).toBe(camera);
        }
        await page.getByText('Weather details', { exact: true }).click();
        await page.locator('#weather-precipitation').selectOption('snow');
        await page.locator('#weather-intensity').evaluate((element) => {
          (element as HTMLInputElement).value = '65';
          element.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.locator('#weather-coverage').evaluate((element) => {
          (element as HTMLInputElement).value = '0';
          element.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.locator('#weather-temperature').fill('25');
        await page.locator('#weather-temperature').press('Tab');
        await page.waitForFunction(() => {
          const status = document.querySelector<HTMLElement>('#weather-status');
          const w = JSON.parse(status?.dataset.weather ?? '{}'),
            effects = JSON.parse(status?.dataset.effects ?? '{}');
          return (
            w.atmosphere?.temperatureK === 298.15 &&
            w.precipitation?.kind === 'snow' &&
            effects.cloudLayers === 0 &&
            effects.particles > 0
          );
        });
        expect(await page.locator('#weather-profile').inputValue()).toBe('custom');
        await page.locator('#weather-profile').selectOption('overcast');
        await page.locator('#sky-time').evaluate((element) => {
          (element as HTMLInputElement).value = '0';
          element.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.waitForFunction(() =>
          document.querySelector('#sky-time-label')?.textContent?.includes('00:00'),
        );
        await page.screenshot({ path: join(out, `${backend}-night.png`) });
        await page.locator('#weather-profile').selectOption('sunny');
        await page.waitForFunction(
          () =>
            document.querySelector<HTMLElement>('#weather-status')?.dataset.effects ===
            '{"cloudLayers":0,"particles":0}',
        );
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    });
});
