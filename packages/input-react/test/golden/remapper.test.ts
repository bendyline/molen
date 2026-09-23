import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

it('edits, learns, persists and resets mappings while gameplay is suspended', async () => {
  const bundle = await build({
    entryPoints: ['test/fixtures/remapper.tsx'],
    bundle: true,
    write: false,
    format: 'esm',
    jsx: 'automatic',
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent('<main><h1>Controls</h1><div id="root"></div></main>');
    await page.addStyleTag({ content: await readFile('src/style.css', 'utf8') });
    await page.addScriptTag({ type: 'module', content: bundle.outputFiles[0]?.text ?? '' });
    await page.getByRole('button', { name: 'Learn input', exact: true }).click();
    await page.keyboard.press('k');
    expect(await page.getByLabel('KeyK action').inputValue()).toBe('flaps.up');
    await page.getByLabel('KeyF action').selectOption('flaps.fullUp');
    await page.getByRole('button', { name: 'Learn input', exact: true }).click();
    await page.evaluate(() => {
      const pad = window.pads[0];
      if (pad) pad.buttons = [{ pressed: true, value: 1 }];
    });
    await page.waitForFunction(
      () => window.controls.getProfile().buttons?.[0]?.action === 'flaps.up',
    );
    expect(await page.evaluate(() => window.controls.getProfile().buttons?.length)).toBe(1);
    expect(await page.evaluate(() => window.controls.isActive('flaps.up'))).toBe(false);
    await page.getByLabel('Action to bind').selectOption('pitch');
    await page.getByRole('button', { name: 'Learn input', exact: true }).click();
    await page.evaluate(() => {
      const pad = window.pads[0];
      if (pad) pad.axes = [0, 0, 0, 0, 0, 0, 0, 0.8];
    });
    await page.waitForFunction(() => window.controls.getProfile().axes?.length === 2);
    expect(await page.evaluate(() => window.controls.getProfile().axes?.[1])).toMatchObject({
      axis: 7,
      action: 'pitch',
      device: { id: 'Test flight stick', index: 2 },
    });
    expect(await page.evaluate(() => window.controls.value('pitch'))).toBe(0);
    const zone = page.getByLabel('Dead zone', { exact: true }).first();
    await zone.fill('0.05');
    await zone.press('Enter');
    expect(await page.evaluate(() => window.controls.getProfile().axes?.[0]?.deadZone)).toBe(0.05);
    await page.getByRole('button', { name: 'Save controls' }).click();
    expect(await page.evaluate(() => window.saved?.bindings)).toMatchObject({
      KeyK: 'flaps.up',
      KeyF: 'flaps.fullUp',
    });
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    expect(await page.getByLabel('KeyK action').count()).toBe(0);
    await zone.fill('1');
    await zone.press('Enter');
    expect(await page.getByRole('alert').count()).toBe(1);
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByRole('alert').waitFor({ state: 'detached' });
    expect(await zone.inputValue()).toBe('0.12');
    expect(await page.getByRole('alert').count()).toBe(0);
    await page.setViewportSize({ width: 480, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
