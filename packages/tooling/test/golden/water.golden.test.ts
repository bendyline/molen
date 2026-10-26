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
