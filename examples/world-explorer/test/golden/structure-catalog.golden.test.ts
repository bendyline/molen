import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

it('opens and filters structures before offscreen previews render', async () => {
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
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Hold thumbnail encoding long enough to exercise a detail view during a pending preview.
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.toBlob;
      let first = true;
      HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
        if (first) {
          first = false;
          document.body.dataset.encoding = 'true';
          setTimeout(() => callback(null), 500);
          return;
        }
        original.call(this, (blob) => setTimeout(() => callback(blob), 500), ...args);
      };
    });
    await page.goto(`http://127.0.0.1:${address.port}/structures.html`);
    await page.locator('.card').first().waitFor();
    expect(await page.locator('.card').count()).toBe(120);
    expect(await page.locator('.card:disabled').count()).toBe(0);
    expect(await page.locator('.card[data-preview="ready"]').count()).toBeLessThan(120);
    const title = await page.locator('.card h2').first().innerText();
    await page.waitForFunction(() => document.body.dataset.encoding === 'true');
    await page.locator('.card').first().click();
    expect(await page.locator('#detail-title').innerText()).toBe(title);
    await page.waitForFunction(() =>
      document.querySelector('#detail-stats')?.textContent?.includes('triangles'),
    );
    await page.locator('#width').fill('30');
    await page.locator('#width').dispatchEvent('input');
    await page.waitForFunction(
      () =>
        document.querySelector('#width-value')?.textContent === '30 m' &&
        document.querySelector('#detail-stats')?.textContent?.includes('triangles'),
    );
    expect(await page.locator('.card[data-preview="error"]').count()).toBe(1);
    await page.keyboard.press('Escape');
    expect(await page.locator('#detail').isVisible()).toBe(false);
    await page.locator('#search').fill('brownstone');
    await page.waitForFunction(() => document.querySelectorAll('.card:not([hidden])').length === 1);
    await page.locator('.card:not([hidden])').press('Enter');
    expect(await page.locator('#detail-title').innerText()).toContain('brownstone');
    await page.waitForFunction(() =>
      document.querySelector('#detail-stats')?.textContent?.includes('triangles'),
    );
    expect(await page.locator('.card[data-preview="ready"]').count()).toBeLessThan(15);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : done())),
    );
  }
}, 120000);
