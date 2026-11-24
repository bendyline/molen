import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { chromium, type Page } from 'playwright';
import { expect, it } from 'vitest';

/** Coverage (drawn pixels / all) and mean brightness of the drawn pixels of a canvas. */
function canvasStats(page: Page, selector: string): Promise<{ coverage: number; mean: number }> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector(sel) as HTMLCanvasElement | null;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || canvas.width < 2) return { coverage: 0, mean: 0 };
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let drawn = 0;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i + 3] as number) < 128) continue;
      drawn++;
      sum += ((data[i] as number) + (data[i + 1] as number) + (data[i + 2] as number)) / 3;
    }
    return { coverage: drawn / (canvas.width * canvas.height), mean: drawn ? sum / drawn : 0 };
  }, selector);
}

it('designs a character with the mouse and the keyboard, drawn in 3D', async () => {
  const bundle = await build({
    entryPoints: ['test/fixtures/designer.tsx'],
    bundle: true,
    write: false,
    format: 'esm',
    jsx: 'automatic',
    logLevel: 'error',
  });
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
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.setContent('<main><h1>Your character</h1><div id="root"></div></main>');
    await page.addStyleTag({ content: await readFile('src/style.css', 'utf8') });
    await page.addScriptTag({ type: 'module', content: bundle.outputFiles[0]?.text ?? '' });

    // The preview draws the figure: it covers a fair part of the canvas (about 9% at full body).
    const preview = '[data-part="preview"]';
    await page.waitForFunction(
      (sel) => {
        const c = document.querySelector(sel) as HTMLCanvasElement | null;
        const d = c?.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
        return d?.some((v, i) => i % 4 === 3 && v > 128) === true;
      },
      preview,
      { timeout: 30_000 },
    );
    expect((await canvasStats(page, preview)).coverage).toBeGreaterThan(0.03);
    expect(await page.getByRole('img', { name: /^Preview: 1\.\d\d m, / }).count()).toBe(1);

    // Skin tone, seen close up: the lightest tone draws a much brighter face than the deepest.
    await page.getByRole('button', { name: 'Close-up' }).click();
    await page.getByRole('radio', { name: 'Tone 10 of 10' }).check();
    await page.waitForTimeout(400);
    const deep = await canvasStats(page, preview);
    await page.getByRole('radio', { name: 'Tone 1 of 10' }).check();
    await page.waitForTimeout(400);
    const light = await canvasStats(page, preview);
    expect(deep.coverage).toBeGreaterThan(0.1);
    // Observed about 45 apart on SwiftShader; require 15.
    expect(light.mean - deep.mean).toBeGreaterThan(15);
    expect(await page.evaluate(() => window.look.person.skin)).toBe('#f6dcc8');

    // Hair by keyboard: the native radio group moves with the arrow keys.
    const before = await page.evaluate(() => window.look.person.hair);
    await page.getByRole('radio', { name: 'Bun', exact: true }).focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
    const after = await page.evaluate(() => window.look.person.hair);
    expect(after).not.toBe(before);
    expect(after).not.toBe('hair.bun');
    expect(await page.evaluate(() => window.changes.at(-1)?.source)).toBe('hair');

    // Every body shape is listed together, and nothing asks for a presentation first.
    const body = page.locator('fieldset[data-category="body"]');
    expect(await body.locator(':scope > [data-part="options"] [data-part="option"]').count()).toBe(
      9,
    );
    expect(await page.locator('details').count()).toBe(0);

    // Undo goes back one step at a time.
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(await page.evaluate(() => window.look.person.hair)).toBe('hair.bun');

    // "New outfit" keeps the person and follows them: a beard is never drawn a dress or a skirt.
    await body.getByRole('radio', { name: 'Straight' }).check();
    await page.getByRole('radio', { name: 'Beard' }).check();
    const person = await page.evaluate(() => JSON.stringify(window.look.person));
    for (let i = 0; i < 12; i++) {
      await page.getByRole('button', { name: 'New outfit' }).click();
      const outfit = await page.evaluate(() => window.look.outfit);
      expect(outfit.bottom.id).not.toBe('bottom.skirt');
      expect(outfit.top.id).not.toMatch(/dress/);
    }
    expect(await page.evaluate(() => JSON.stringify(window.look.person))).toBe(person);
    expect(await page.evaluate(() => window.changes.at(-1)?.source)).toBe('random');

    // Tabs: arrow keys move between the character and the outfit.
    await page.getByRole('tab', { name: 'Character' }).focus();
    await page.keyboard.press('ArrowRight');
    expect(
      await page.getByRole('tab', { name: 'Clothing & accessories' }).getAttribute('aria-selected'),
    ).toBe('true');
    await page.getByRole('radio', { name: 'Skirt' }).check();
    expect(await page.evaluate(() => window.look.outfit.bottom.id)).toBe('bottom.skirt');

    // Option thumbnails are drawn through the preview's context.
    await page.waitForFunction(() =>
      [...document.querySelectorAll<HTMLCanvasElement>('[data-part="thumbnail"]')].some((c) =>
        c
          .getContext('2d')
          ?.getImageData(0, 0, c.width, c.height)
          .data.some((v) => v > 0),
      ),
    );

    // Phone width: one column, no sideways scrolling.
    await page.setViewportSize({ width: 360, height: 800 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
  }
});
