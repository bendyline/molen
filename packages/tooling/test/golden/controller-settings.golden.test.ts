import { build } from 'esbuild';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';

it('discovers a raw flight stick, saves remaps, resumes play and releases disconnected axes', async () => {
  const bundle = await build({
    stdin: {
      contents: `
        import { NavigationInputSource, createNavigationControls } from '@bendyline/molen-client/navigation';
        window.pad = { id: 'Test flight stick', index: 0, connected: true, mapping: '', axes: [0, 0, 0.56, -1], buttons: [{pressed:false,value:0}] };
        const canvas = document.querySelector('canvas');
        const source = new NavigationInputSource({ element: canvas, profile: 'pilot', getGamepads: () => window.pad.connected ? [window.pad] : [] });
        createNavigationControls(source, {container: document.querySelector('nav'), focusTarget: canvas, storageKey: 'test-controls'});
        function frame() {
          const input = source.read(1/60);
          canvas.dataset.yaw = String(input.pilot.yaw);
          canvas.dataset.power = String(input.pilot.power);
          canvas.dataset.engine = String(input.pilot.engine);
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
    const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
    await page.route('http://controller.test/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<main><canvas tabindex="0" aria-label="World view"></canvas><nav></nav></main>',
      }),
    );
    const load = async () => {
      await page.goto('http://controller.test/');
      await page.addScriptTag({ type: 'module', content: bundle.outputFiles[0]?.text ?? '' });
    };
    await load();
    const canvas = page.locator('canvas');
    await page.getByRole('button', { name: 'Controllers (1)', exact: true }).click();
    expect(await page.getByRole('status').first().textContent()).toContain('1 controller');
    await page.getByLabel('Axis', { exact: true }).selectOption('2');
    await page.getByLabel('Axis action').selectOption({ label: 'Rudder (positive = right)' });
    await page.getByRole('button', { name: 'Assign axis', exact: true }).click();
    await page.getByLabel('Axis', { exact: true }).selectOption('3');
    await page.getByLabel('Axis action').selectOption('power');
    await page.getByLabel('Reverse axis').check();
    await page.getByRole('button', { name: 'Assign axis', exact: true }).click();
    await page.getByLabel('Button', { exact: true }).selectOption('0');
    await page.getByLabel('Button action').selectOption('nav-engine');
    await page.getByRole('button', { name: 'Assign button', exact: true }).click();
    // Editing never moves the aircraft or forces the throttle to zero.
    expect(await canvas.getAttribute('data-yaw')).toBe('0');
    expect(await canvas.getAttribute('data-power')).toBe('undefined');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.screenshot({ path: '../../.artifacts/joystick-controls.png' });
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await expect.poll(async () => Number(await canvas.getAttribute('data-yaw'))).toBeCloseTo(0.5);
    await expect.poll(() => canvas.getAttribute('data-power')).toBe('1');
    expect(await canvas.evaluate((element) => element === document.activeElement)).toBe(true);
    await load();
    await expect.poll(() => canvas.getAttribute('data-power')).toBe('1');
    await page.evaluate(() => {
      (window as unknown as { pad: { connected: boolean } }).pad.connected = false;
    });
    await expect.poll(() => canvas.getAttribute('data-yaw')).toBe('0');
    await expect.poll(() => canvas.getAttribute('data-power')).toBe('undefined');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Controllers (0)', exact: true }).click();
    await expect
      .poll(() => page.getByRole('status').first().textContent())
      .toContain('No controller');
    expect(await page.getByRole('button', { name: 'Assign axis', exact: true }).isDisabled()).toBe(
      true,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.keyboard.press('Escape');
    await expect.poll(() => page.getByRole('dialog').isVisible()).toBe(false);
  } finally {
    await browser.close();
  }
});
