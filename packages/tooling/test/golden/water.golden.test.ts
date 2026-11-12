import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'esbuild';
import { type Browser, chromium, type Page } from 'playwright';
import { PNG } from 'pngjs';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type CaptureServer, startCaptureServer } from '../../src/capture-server';
import type {} from '../fixtures/water-harness';

const OUT = join(process.cwd(), 'test/golden/__output__/water');
let browser: Browser;
let server: CaptureServer;

beforeAll(async () => {
  await mkdir(OUT, { recursive: true });
  await build({
    entryPoints: ['test/fixtures/water-harness.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    external: ['@resvg/resvg-wasm', 'node:module', 'node:fs/promises'],
    outfile: join(OUT, 'harness.js'),
  });
  await writeFile(
    join(OUT, 'capture.html'),
    '<!doctype html><html><head><link rel="icon" href="data:,"><style>body{margin:0}canvas{display:block}</style></head><body><canvas></canvas><script type="module" src="./harness.js"></script></body></html>',
  );
  server = await startCaptureServer(OUT);
  browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(query = ''): Promise<{ page: Page; errors: string[] }> {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${server.url}?${query}`);
  await page.waitForFunction(() => !!window.waterQA);
  return { page, errors };
}

async function capture(page: Page, name: string): Promise<Buffer> {
  return page.locator('canvas').screenshot({ path: join(OUT, `${name}.png`) });
}

/** Mean RGB change in the water, excluding the sky and horizon. */
function difference(first: Buffer, second: Buffer): number {
  const a = PNG.sync.read(first);
  const b = PNG.sync.read(second);
  let sum = 0;
  let count = 0;
  for (let y = 300; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      for (let c = 0; c < 3; c++) {
        const i = (y * a.width + x) * 4 + c;
        sum += Math.abs((a.data[i] ?? 0) - (b.data[i] ?? 0));
        count++;
      }
    }
  }
  return sum / count;
}

it.each([
  'swells',
  'noSwells',
])('moves ripple reflections smoothly with %s, repeats a time exactly, and survives origin rebasing', async (mode) => {
  const { page, errors } = await open(mode);
  try {
    await page.evaluate(() => window.waterQA.frame(0));
    const first = await capture(page, 'near');
    await page.evaluate(() => window.waterQA.frame(0.05));
    const step = await capture(page, 'step');
    await page.evaluate(() => window.waterQA.frame(1));
    const moving = await capture(page, 'moving');
    // Require moving reflections; subtle diffuse tint alone is insufficient.
    // The ripple normals change about 13 levels over a second, without a frame-sized jump.
    expect(difference(first, moving)).toBeGreaterThan(3);
    expect(difference(first, step)).toBeGreaterThan(0.1);
    expect(difference(first, step)).toBeLessThan(difference(first, moving) * 0.4);
    await page.evaluate(() => window.waterQA.frame(0));
    expect(first.equals(await capture(page, 'repeat'))).toBe(true);
    await page.evaluate(() => window.waterQA.frame(0, false, [1000, -2000]));
    expect(difference(first, await capture(page, 'rebased'))).toBeLessThan(0.5);
    await page.evaluate(() => window.waterQA.frame(0, true));
    await capture(page, 'far');
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});

/** Mean luminance step between neighbouring water pixels: blocks and streaks raise it. */
function roughness(image: Buffer): number {
  const png = PNG.sync.read(image);
  const lum = (x: number, y: number): number => {
    const i = (y * png.width + x) * 4;
    return (
      (png.data[i] ?? 0) * 0.2126 +
      (png.data[i + 1] ?? 0) * 0.7152 +
      (png.data[i + 2] ?? 0) * 0.0722
    );
  };
  let sum = 0;
  let count = 0;
  for (let y = 300; y < png.height - 1; y++) {
    for (let x = 0; x < png.width - 1; x++) {
      sum += Math.abs(lum(x, y) - lum(x + 1, y)) + Math.abs(lum(x, y) - lum(x, y + 1));
      count++;
    }
  }
  return sum / count;
}

it('keeps ripples as fine far from the world origin as beside it', async () => {
  // The explorer's floating origin over Seattle, in its metric frame. Added to positions in
  // 32-bit floats there, X rounds to whole metres: ripples broke into flickering blocks.
  const seattle: [number, number] = [-9_178_687.42, -4_074_173.34];
  const { page, errors } = await open();
  try {
    await page.evaluate(() => window.waterQA.frame(7));
    const home = roughness(await capture(page, 'home'));
    await page.evaluate((at) => window.waterQA.frame(7, false, at, at), seattle);
    const away = roughness(await capture(page, 'seattle'));
    expect(away).toBeLessThan(home * 1.25);
    expect(away).toBeGreaterThan(home * 0.75);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});

it.each(['still', 'flat'])('keeps %s water stable with no authored swells', async (setting) => {
  const { page, errors } = await open(`noSwells&${setting}`);
  try {
    await page.evaluate(() => window.waterQA.frame(0));
    const first = await capture(page, `${setting}-start`);
    await page.evaluate(() => window.waterQA.frame(10));
    expect(first.equals(await capture(page, `${setting}-end`))).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await page.close();
  }
});
