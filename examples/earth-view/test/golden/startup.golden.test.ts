import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

it('explains a failed startup and offers a keyboard-accessible retry on a narrow screen', async () => {
  const server = await preview({ configFile: false, preview: { host: '127.0.0.1', port: 0 } });
  const browser = await chromium.launch({ headless: true });
  try {
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Missing preview address');
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });
    let attempts = 0;
    await page.route('**/packs/index.json', async (route) => {
      attempts++;
      await route.fulfill({ status: 503, body: 'Unavailable' });
    });
    await page.goto(`http://127.0.0.1:${address.port}/`);
    const retry = page.getByRole('button', { name: 'Retry loading' });
    await retry.waitFor();
    expect(await page.getByRole('status').textContent()).toContain('could not load');
    expect(await page.getByRole('button', { name: 'Orbit', exact: true }).isEnabled()).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await retry.press('Enter');
    await expect.poll(() => attempts).toBe(2);
    await retry.waitFor();
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});
