import { build } from 'esbuild';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

it('keeps navigation usable after HUD focus and releases a hidden or cancelled joystick', async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import { NavigationInputSource, createTouchJoystick } from '@bendyline/molen-client/navigation';
        const canvas = document.querySelector('canvas');
        const source = new NavigationInputSource({ element: canvas });
        const joystick = createTouchJoystick(document.querySelector('main'), source.map, { focusTarget: canvas });
        document.querySelector('button').onclick = () => joystick.setVisible(false);
        function frame() {
          canvas.dataset.forward = String(source.read(0).move.forward);
          requestAnimationFrame(frame);
        }
        frame();
      `,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <main style="position:relative;height:500px">
        <canvas tabindex="0" aria-label="World view"></canvas>
        <button>Hide joystick</button>
      </main><div style="height:1500px"></div>
    `);
    await page.addScriptTag({ type: 'module', content: bundle.outputFiles[0]?.text ?? '' });
    const canvas = page.locator('canvas');
    await canvas.focus();
    await page.getByRole('button').focus();
    const stick = page.locator('.molen-touch-joystick');
    const box = await stick.boundingBox();
    if (!box) throw new Error('Missing joystick');
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY - 50);
    await expect.poll(() => canvas.getAttribute('data-forward')).not.toBe('0');
    expect(await canvas.evaluate((element) => document.activeElement === element)).toBe(true);
    await stick.dispatchEvent('lostpointercapture', { pointerId: 1 });
    await expect.poll(() => canvas.getAttribute('data-forward')).toBe('0');
    await page.mouse.up();
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX, centerY - 50);
    await expect.poll(() => canvas.getAttribute('data-forward')).not.toBe('0');
    await page.getByRole('button').press('Enter');
    await page.mouse.up();
    await expect.poll(() => canvas.getAttribute('data-forward')).toBe('0');
    expect(await stick.isVisible()).toBe(false);
    await canvas.press('ArrowDown');
    expect(await page.evaluate(() => scrollY)).toBe(0);
  } finally {
    await browser.close();
  }
});
