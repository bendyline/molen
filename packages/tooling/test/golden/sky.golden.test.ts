import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EarthSkyData, SkyData } from '@bendyline/molen-client';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type CaptureServer, startCaptureServer } from '../../src/capture-server';
import type { SkyCaptureOptions } from '../fixtures/sky-harness';

// Behavioral pixel checks in the browser lane; deliberately no platform-specific reference PNGs.
const OUT = join(process.cwd(), 'test/golden/__output__/sky');
// MOLEN_SKIP_WEBGPU=1 (set by CI) skips the WebGPU case as if no adapter existed.
const SKIP_WEBGPU = process.env.MOLEN_SKIP_WEBGPU === '1';
let server: CaptureServer;
let browser: Browser;
let gpu = false;
const day: EarthSkyData = {
  mode: 'earth',
  observer: { latitude: 0, longitude: 0 },
  time: { epochMs: Date.parse('2024-03-20T12:00:00Z'), scale: 1 },
};

beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
  await build({
    entryPoints: ['test/fixtures/sky-harness.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    outfile: join(OUT, 'harness.js'),
  });
  await copyFile(join(process.cwd(), '../../content/sky/stars.bin'), join(OUT, 'stars.bin'));
  await writeFile(
    join(OUT, 'capture.html'),
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style></head><body><canvas></canvas><script type="module" src="./harness.js"></script></body></html>',
  );
  server = await startCaptureServer(OUT);
  browser = await chromium.launch({
    headless: true,
    args: process.env.MOLEN_WEBGPU_ARGS
      ? JSON.parse(process.env.MOLEN_WEBGPU_ARGS)
      : [
          '--enable-unsafe-webgpu',
          '--use-webgpu-adapter=swiftshader',
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
        ],
    ...(process.env.MOLEN_WEBGPU_CHANNEL ? { channel: process.env.MOLEN_WEBGPU_CHANNEL } : {}),
  });
  const page = await browser.newPage();
  await page.goto(server.url);
  gpu = await page.evaluate(async () => (await navigator.gpu?.requestAdapter()) != null);
  await page.close();
}, 60000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function capture(
  page: Page,
  options: SkyCaptureOptions,
  name: string,
): Promise<{ pixels: PNG; stats: Awaited<ReturnType<Window['__skyCapture']['render']>> }> {
  const stats = await page.evaluate((data) => window.__skyCapture.render(data), options);
  const pixels = PNG.sync.read(
    await page.locator('canvas').screenshot({ path: join(OUT, `${name}.png`) }),
  );
  return { pixels, stats };
}
function luminance(png: PNG): number {
  let total = 0;
  for (let i = 0; i < png.data.length; i += 4)
    total += ((png.data[i] ?? 0) + (png.data[i + 1] ?? 0) + (png.data[i + 2] ?? 0)) / 3;
  return total / (png.width * png.height);
}
function difference(a: PNG, b: PNG): number {
  let total = 0;
  for (let i = 0; i < a.data.length; i++) total += Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0));
  return total / a.data.length;
}

describe('sky rendering and clock integration', () => {
  for (const backend of ['webgl', 'webgpu'] as const)
    it(`${backend}: renders day, night, lunar phase, stars, rebasing and environment removal`, async (context) => {
      if (backend === 'webgpu' && (SKIP_WEBGPU || !gpu)) {
        expect(process.env.MOLEN_REQUIRE_WEBGPU).not.toBe('1');
        context.skip();
        return;
      }
      const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      try {
        await page.goto(server.url);
        await page.waitForFunction(() => window.__skyCapture !== undefined);
        const noon = await capture(page, { backend, sky: day }, `${backend}-day`);
        const midnight = await capture(
          page,
          { backend, sky: day, tick: 30 * 43200 },
          `${backend}-night`,
        );
        expect(noon.stats.sun).toBeGreaterThan(2.9);
        expect(midnight.stats.sun).toBe(0);
        expect(midnight.stats.utcMs).toBe(day.time.epochMs + 43200000);
        expect(luminance(noon.pixels)).toBeGreaterThan(luminance(midnight.pixels) * 5);
        expect(midnight.stats.drawCalls).toBeGreaterThanOrEqual(2);
        const translated = await capture(
          page,
          { backend, sky: day, tick: 30 * 43200, position: [1e7, 5000, -1e7] },
          `${backend}-translated`,
        );
        expect(difference(midnight.pixels, translated.pixels)).toBeLessThan(0.01);
        const ortho = await capture(page, { backend, sky: day, ortho: true }, `${backend}-ortho`);
        expect(luminance(ortho.pixels)).toBeGreaterThan(80);
        const foreground = await capture(
          page,
          { backend, sky: day, foreground: true },
          `${backend}-foreground`,
        );
        const middle = (200 * 640 + 320) * 4;
        expect(
          Array.from(foreground.pixels.data.subarray(middle, middle + 3)),
          'world geometry must cover the background sky',
        ).toEqual([204, 51, 119]);

        const night: SkyData = {
          mode: 'custom',
          sunBody: { direction: [0, -1, 1] },
          moonBody: { direction: [0, 1, -1], angularDiameterDeg: 8 },
          stars: { intensity: 2 },
        };
        const full = await capture(page, { backend, sky: night, aim: 'moon' }, `${backend}-full`);
        const noStars = await capture(
          page,
          { backend, sky: { ...night, stars: { enabled: false } }, aim: 'moon' },
          `${backend}-no-stars`,
        );
        expect(
          difference(full.pixels, noStars.pixels),
          'catalog stars must affect pixels',
        ).toBeGreaterThan(0.005);
        const quarter = await capture(
          page,
          { backend, sky: { ...night, sunBody: { direction: [-1, 0, 0] } }, aim: 'moon' },
          `${backend}-quarter`,
        );
        const center = (png: PNG, dx: number): number => {
          const p = (Math.floor(png.height / 2) * png.width + Math.floor(png.width / 2) + dx) * 4;
          return png.data[p] ?? 0;
        };
        expect(center(full.pixels, -12)).toBeGreaterThan(150);
        expect(center(full.pixels, 12)).toBeGreaterThan(150);
        expect(
          Math.abs(center(quarter.pixels, -12) - center(quarter.pixels, 12)),
          'quarter moon has a directional terminator',
        ).toBeGreaterThan(70);
        expect(await page.evaluate(() => window.__skyCapture.remove())).toBe(true);
        const reset = PNG.sync.read(await page.locator('canvas').screenshot());
        expect(Array.from(reset.data.subarray(0, 3))).toEqual([18, 52, 86]);
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }, 60000);
});
