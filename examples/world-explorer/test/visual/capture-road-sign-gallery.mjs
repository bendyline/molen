import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const example = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const root = resolve(example, '../..');
const out = resolve(root, '.artifacts/road-sign-gallery');
await mkdir(out, { recursive: true });
const server = await createServer({
  configFile: false,
  root: example,
  publicDir: false,
  server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {}),
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/road-signs.html`);
  await page
    .waitForFunction(() => window.roadSignGalleryQA?.ready, undefined, { timeout: 45000 })
    .catch((error) => {
      throw new Error(`${errors.join('; ')}; ${error.message}`);
    });
  const state = await page.evaluate(() => window.roadSignGalleryQA);
  assert.equal(new Set(state.patterns.map((p) => p.id)).size, 10);
  assert.equal(state.patterns.find((p) => p.id === 'all-way-stop').count, 4);
  assert(state.patterns.every((p) => p.count > 0 && p.evidence.length));
  assert(
    await page
      .locator('.card img')
      .evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0)),
  );
  await page.screenshot({ path: resolve(out, 'gallery.png'), fullPage: true });
  const initialImages = await page
    .locator('.card img')
    .evaluateAll((images) => images.map((img) => img.src));
  await page.locator('#filters button[data-family="speed"]').click();
  assert.equal(await page.locator('.card:visible').count(), 2);
  await page.locator('#filters button[data-family="all"]').click();
  await page.locator('#search').fill('destination:colour');
  assert.equal(await page.locator('.card:visible').count(), 1);
  await page.getByRole('button', { name: 'Inspect Attractions & recreation' }).click();
  await page.locator('dialog[open]').waitFor();
  assert.match(await page.locator('#record').textContent(), /destination:colour=brown/);
  await page.screenshot({ path: resolve(out, 'attraction-detail.png') });
  // Exercise interactive rendering and native modal dismissal, not just page load.
  const bounds = await page.locator('#preview canvas').boundingBox();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.4, {
    steps: 8,
  });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog[open]').count(), 0);
  await page.locator('#search').fill('');
  const regions = [];
  const comparison = [];
  for (const id of ['us', 'gb', 'de', 'fr', 'it', 'ch', 'generic']) {
    await page.locator('#region').selectOption(id);
    if (id === 'us')
      assert.deepEqual(
        await page.locator('.card img').evaluateAll((images) => images.map((img) => img.src)),
        initialImages,
      );
    const regional = await page.evaluate(() => window.roadSignGalleryQA);
    assert.equal(regional.profile, id);
    assert.equal(regional.patterns.length, id === 'us' ? 10 : 9);
    assert(regional.patterns.every((pattern) => pattern.appearance === id && pattern.count > 0));
    assert.equal(
      regional.patterns.find((p) => p.id === 'street-speed').shape,
      id === 'us' ? 'rectangle' : 'circle',
    );
    assert.equal(
      regional.patterns.find((p) => p.id === 'all-way-stop').source,
      id === 'us' ? 'inferred' : 'mapped',
    );
    assert.equal(new URL(page.url()).searchParams.get('region'), id);
    regions.push(regional);
    if (id !== 'generic')
      comparison.push(
        await page.evaluate(() => ({
          title: document.querySelector('#region').selectedOptions[0].textContent,
          images: ['highway-overhead', 'street-speed', 'yield'].map((id) => ({
            src: document.querySelector(`[data-pattern="${id}"] img`).src,
            id,
          })),
        })),
      );
    if (id === 'gb')
      await page.screenshot({ path: resolve(out, 'gallery-gb.png'), fullPage: true });
  }
  await page.locator('#region').selectOption('gb');
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.getByRole('button', { name: 'Inspect Highway overhead', exact: true }).click();
  await page.locator('#preview canvas').waitFor();
  await page.screenshot({ path: resolve(out, 'mobile-detail.png') });
  assert.deepEqual(errors, []);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  // A review sheet made from the production renderer's card images, not alternate sign artwork.
  await page.evaluate((rows) => {
    const sheet = document.createElement('section');
    sheet.id = 'comparison';
    sheet.style.cssText =
      'position:absolute;inset:0 auto auto 0;width:1400px;padding:32px;background:#f5f3ea;z-index:1000;color:#243c36;';
    const heading = document.createElement('h1');
    heading.textContent = 'Global patterns · regional appearances';
    const note = document.createElement('p');
    note.textContent =
      'Production sign meshes · Synthetic destinations · Overpass lettering fallback';
    sheet.append(heading, note);
    for (const row of rows) {
      const line = document.createElement('div');
      line.style.cssText =
        'display:grid;grid-template-columns:180px 2fr 1fr 1fr;align-items:center;border-top:1px solid #d6d6c9;';
      const label = document.createElement('strong');
      label.textContent = row.title;
      line.append(label);
      for (const image of row.images) {
        const img = document.createElement('img');
        img.src = image.src;
        img.alt = image.id;
        img.style.cssText = 'width:100%;height:180px;object-fit:contain;';
        line.append(img);
      }
      sheet.append(line);
    }
    document.body.append(sheet);
  }, comparison);
  await page
    .locator('#comparison img')
    .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await page.locator('#comparison').screenshot({ path: resolve(out, 'regional-comparison.png') });
  await page.locator('#comparison').evaluate((element) => element.remove());
  await page.locator('#view').selectOption('states');
  const states = await page.evaluate(() => window.roadSignGalleryQA);
  assert.equal(states.patterns.length, 50);
  assert.equal(new Set(states.patterns.map((p) => p.appearance)).size, 50);
  assert.equal(new Set(states.patterns.map((p) => p.routeShield.network)).size, 50);
  assert(states.patterns.every((p) => p.source === 'mapped' && p.routeShield.ref === '28'));
  assert(await page.locator('#region').isDisabled());
  await page.locator('#search').fill('Washington');
  assert.equal(await page.locator('.card:visible').count(), 1);
  await page.getByRole('button', { name: 'Inspect Washington', exact: true }).click();
  assert.match(await page.locator('#record').textContent(), /US:WA/);
  await page.screenshot({ path: resolve(out, 'washington-detail.png') });
  await page.keyboard.press('Escape');
  await page.locator('#search').fill('');
  // Compact review sheet uses the production thumbnails, with no alternate artwork.
  await page.evaluate(() => {
    const sheet = document.createElement('section');
    sheet.id = 'states-sheet';
    sheet.style.cssText =
      'position:absolute;inset:0 auto auto 0;width:1400px;padding:24px;background:#f5f3ea;z-index:1000;color:#243c36';
    const title = document.createElement('h1');
    title.textContent = '50 states · route marker library';
    const note = document.createElement('p');
    note.textContent =
      'Production geometry · Synthetic route 28 · Shared U.S. regulatory signs · CC0 Americana artwork + authored shapes';
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:8px';
    for (const card of document.querySelectorAll('.card')) {
      const item = document.createElement('div');
      item.style.cssText = 'text-align:center;background:#e8ecdf;padding:8px';
      const img = card.querySelector('img').cloneNode();
      img.style.cssText = 'width:100%;height:155px;object-fit:cover';
      const label = document.createElement('strong');
      label.textContent = card.querySelector('h2').textContent;
      item.append(img, label);
      grid.append(item);
    }
    sheet.append(title, note, grid);
    document.body.append(sheet);
  });
  await page
    .locator('#states-sheet img')
    .evaluateAll((images) => Promise.all(images.map((img) => img.decode())));
  await page.locator('#states-sheet').screenshot({ path: resolve(out, 'us-states.png') });
  await page.locator('#states-sheet').evaluate((element) => element.remove());
  await page.locator('#view').selectOption('patterns');
  await page.locator('#region').selectOption('us-ca');
  assert.equal(
    (await page.evaluate(() => window.roadSignGalleryQA)).patterns.find(
      (p) => p.id === 'route-marker',
    ).routeShield.network,
    'US:CA',
  );
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, 'capture.json'),
    JSON.stringify({ ok: true, ...state, regions, states }, null, 2),
  );
  console.log(
    JSON.stringify({ ok: true, patterns: state.patterns.length, regions: regions.length, out }),
  );
} finally {
  await browser?.close();
  await server.close();
}
