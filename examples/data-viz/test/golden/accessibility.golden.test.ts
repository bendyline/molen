import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

it('starts with a still chart for reduced motion and exposes the source values', async () => {
  const server = await preview({
    root: resolve('.'),
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0 },
  });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('No preview address');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--no-sandbox',
    ],
  });
  try {
    const page = await browser.newPage({
      reducedMotion: 'reduce',
      viewport: { width: 800, height: 600 },
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.getByRole('button', { name: 'Resume animation' }).waitFor();
    await page.getByText('Chart values', { exact: true }).click();
    expect(await page.getByRole('table').innerText()).toContain('jun\t11');
    expect(await page.getByRole('row').count()).toBe(8);
    await page.waitForTimeout(100);
    const frozen = await page.locator('#view').screenshot();
    const frames = await page.locator('#view').getAttribute('data-render-frames');
    await page.waitForTimeout(300);
    expect(await page.locator('#view').getAttribute('data-render-frames')).toBe(frames);
    expect(Buffer.compare(frozen, await page.locator('#view').screenshot())).toBe(0);
    await page.getByRole('button', { name: 'Resume animation' }).click();
    await page.waitForFunction(
      (previous) =>
        Number(document.querySelector<HTMLCanvasElement>('#view')?.dataset.renderFrames) >
        Number(previous) + 5,
      frames,
    );
    await page.getByRole('button', { name: 'Pause animation' }).click();
    const paused = await page.locator('#view').getAttribute('data-render-frames');
    await page.waitForTimeout(200);
    expect(await page.locator('#view').getAttribute('data-render-frames')).toBe(paused);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : done())),
    );
  }
});
