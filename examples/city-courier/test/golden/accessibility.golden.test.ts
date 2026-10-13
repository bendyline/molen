import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { expect, it } from 'vitest';

/** Public controls against a real Worker, with no world mutation or privileged game commands. */
const name = 'city-courier' as string;
const action = 'Accelerate';
const axis = 'z';
it('supports paused text play, reduced motion and simultaneous touch input', async () => {
  const base = `/games/${name}/`;
  const server = await preview({
    base,
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
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${address.port}${base}`);
    await page.locator('#pause-playback').waitFor();
    const canvas = page.locator('#view');
    expect(await canvas.getAttribute('data-paused')).toBe('true');
    // The initial ResizeObserver schedules one still redraw after the mount sizes its buffer.
    await page.waitForFunction(
      () => Number(document.querySelector<HTMLCanvasElement>('#view')?.dataset.renderFrames) >= 2,
    );
    const frozen = await canvas.getAttribute('data-render-frames');
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute('data-render-frames')).toBe(frozen);
    expect(await canvas.getAttribute('data-tick')).toBe('0');
    await page.setViewportSize({ width: 390, height: 850 });
    await page.waitForFunction(
      (previous) =>
        Number(document.querySelector<HTMLCanvasElement>('#view')?.dataset.renderFrames) >
        Number(previous),
      frozen,
    );
    const resized = await canvas.getAttribute('data-render-frames');
    await page.waitForTimeout(100);
    expect(await canvas.getAttribute('data-render-frames')).toBe(resized);
    await page.getByRole('button', { name: 'Text play', exact: true }).click();
    expect(await page.locator('#text-summary').innerText()).not.toContain('Loading');
    const start = Number(await canvas.getAttribute(`data-${axis}`));
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: action, exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector('.text-actions')?.hasAttribute('aria-busy'),
      );
    }
    await page.waitForFunction(
      ({ axis, start }) =>
        Math.abs(
          Number(document.querySelector<HTMLCanvasElement>('#view')?.dataset[axis]) - start,
        ) > 0.5,
      { axis, start },
    );
    const tick = await canvas.getAttribute('data-tick');
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute('data-tick')).toBe(tick);
    expect(await page.locator('#text-surroundings li').count()).toBeGreaterThan(0);
    expect(await canvas.getAttribute('aria-hidden')).toBe('true');
    // Text mode must scroll on a small screen, including controls below the initial viewport.
    await page.getByRole('button', { name: 'Restart game', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('.text-actions')?.hasAttribute('aria-busy'),
    );
    // Follow the road grid using only the position, speed and heading exposed in text.
    // Start the final inside turn early enough for the car's turning radius.
    await page.getByLabel('Precise actions').check();
    const route = [
      [0, -24],
      [24, -24],
      [24, 24],
      [4, 24],
      [0, 0],
    ] as const;
    let waypoint = 0;
    for (let n = 0; n < 700; n++) {
      const summary = await page.locator('#text-summary').innerText();
      if (!summary.startsWith('playing.')) break;
      const match = summary.match(
        /Position: east (-?[\d.]+), south (-?[\d.]+).*? (\d+) degrees clockwise.*?Speed ([\d.]+)/,
      );
      if (!match) throw new Error(summary);
      const x = Number(match[1]),
        z = Number(match[2]),
        yaw = (Number(match[3]) * Math.PI) / 180,
        speed = Number(match[4]);
      let target = route[waypoint] as readonly [number, number];
      if (Math.hypot(target[0] - x, target[1] - z) < 1.7 && waypoint < route.length - 1)
        target = route[++waypoint] as readonly [number, number];
      const desired = Math.atan2(target[0] - x, -(target[1] - z));
      const error = Math.atan2(Math.sin(desired - yaw), Math.cos(desired - yaw));
      const targetSpeed = Math.abs(error) > 0.5 ? 3.8 : 7;
      const direction = error > 0 ? 'right' : 'left';
      const next =
        speed > targetSpeed + 1
          ? 'Brake'
          : Math.abs(error) > 0.035
            ? speed < targetSpeed
              ? `Accelerate and steer ${direction}`
              : `Steer ${direction} while coasting`
            : speed < targetSpeed
              ? 'Accelerate'
              : 'Coast briefly';
      await page.getByRole('button', { name: next, exact: true }).click();
      await page.waitForFunction(
        () => !document.querySelector('.text-actions')?.hasAttribute('aria-busy'),
      );
    }
    expect(await page.locator('#text-summary').innerText()).toContain('won.');
    expect(await page.locator('#text-summary').innerText()).toContain('5 of 5 deliveries');
    await mkdir('.artifacts', { recursive: true });
    await page.screenshot({ path: '.artifacts/text-play.png', fullPage: true });
    await page.getByRole('button', { name: 'Restart game', exact: true }).click();
    await page.waitForFunction(
      () => !document.querySelector('.text-actions')?.hasAttribute('aria-busy'),
    );
    await page.getByRole('button', { name: 'Return to visual play' }).click();
    await page.getByRole('button', { name: 'Resume animation' }).click();
    const move = page.locator(
      `.touch-controls [data-action="${name === 'skybound' ? 'right' : 'up'}"]`,
    );
    const second = page.locator(
      `.touch-controls [data-action="${name === 'skybound' ? 'jump' : name === 'city-courier' ? 'right' : 'turnRight'}"]`,
    );
    const m = await move.boundingBox(),
      s = await second.boundingBox();
    if (!m || !s) throw new Error('Missing touch controls');
    const cdp = await page.context().newCDPSession(page);
    const points = [
      { x: m.x + m.width / 2, y: m.y + m.height / 2, id: 1 },
      { x: s.x + s.width / 2, y: s.y + s.height / 2, id: 2 },
    ];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    expect(await page.locator('.touch-controls [data-held]').count()).toBe(2);
    await page.waitForTimeout(200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
    expect(await page.locator('.touch-controls [data-held]').count()).toBe(0);
    await page.getByRole('button', { name: 'Pause animation' }).click();
    await page.waitForTimeout(150);
    const pausedTick = await canvas.getAttribute('data-tick');
    const pausedFrames = await canvas.getAttribute('data-render-frames');
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute('data-tick')).toBe(pausedTick);
    expect(await canvas.getAttribute('data-render-frames')).toBe(pausedFrames);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await page.locator('#diagnostic').innerText()).toBe('');
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((done, reject) =>
      server.httpServer.close((error) => (error ? reject(error) : done())),
    );
  }
}, 180000);
