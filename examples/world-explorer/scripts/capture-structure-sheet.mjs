// Render the actual default resource pack and exercise regeneration in the built world app.
// Build first. Run from any directory: node examples/world-explorer/scripts/capture-structure-sheet.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { formatJson } from '../../../packages/worldgen/scripts/format-json.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../..');
const dist = resolve(app, 'dist');
const out = resolve(root, 'artifacts/building-diversity');
await mkdir(out, { recursive: true });
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.glb': 'model/gltf-binary',
};
const server = createServer(async (req, res) => {
  try {
    const path = resolve(
      dist,
      `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`,
    );
    if (!path.startsWith(`${dist}${sep}`)) {
      res.writeHead(403).end();
      return;
    }
    const data = await readFile(path);
    res
      .writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' })
      .end(data);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-gpu-sandbox',
  ],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1100 },
    deviceScaleFactor: 1,
  });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/structures.html`);
  await page.waitForFunction(
    () => window.__structureSheet?.ready || window.__structureSheet?.errors?.length,
    {},
    { timeout: 180000 },
  );
  const report = await page.evaluate(() => {
    const { count, errors, materialFailures, metrics, entries } = window.__structureSheet;
    return { count, errors, materialFailures, metrics, entries };
  });
  if (report.count !== 120 || report.errors.length || report.materialFailures.length)
    throw new Error(JSON.stringify(report));
  console.log('Rendered all 120 structures with no material failures.');
  await page.screenshot({ path: resolve(out, 'gallery.png') });
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadEvent;
  await download.saveAs(resolve(out, 'model-sheet.png'));
  await page.setViewportSize({ width: 2400, height: 1200 });
  await page.evaluate(() => document.body.classList.add('capture'));
  await page.screenshot({ path: resolve(out, 'model-sheet-labeled.png'), fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.evaluate(() => {
    document.getElementById('collection').style.gridTemplateColumns = 'repeat(4,minmax(0,1fr))';
  });
  for (const tax of [...new Set(report.entries.map((entry) => entry.taxonomy))]) {
    await page.evaluate((tax) => {
      const select = document.getElementById('taxonomy');
      select.value = tax;
      select.dispatchEvent(new Event('change'));
      document.querySelector('h1').textContent = select.selectedOptions[0].textContent;
    }, tax);
    const expected = report.entries.filter((entry) => entry.taxonomy === tax).length;
    const visible = await page.locator('.card:visible').count();
    if (visible !== expected)
      throw new Error(`Taxonomy ${tax}: expected ${expected} visible cards, got ${visible}`);
    await page.screenshot({ path: resolve(out, `taxonomy-${tax}.png`), fullPage: true });
  }
  await page.evaluate(() => {
    document.body.classList.remove('capture');
    document.getElementById('collection').style.gridTemplateColumns = '';
    document.querySelector('h1').textContent = 'Atlas of structures';
    const select = document.getElementById('taxonomy');
    select.value = '';
    select.dispatchEvent(new Event('change'));
  });
  await page.setViewportSize({ width: 1500, height: 1000 });
  const checks = [];
  for (const id of [
    'cape_cod',
    'german_fachwerk',
    'moroccan_riad',
    'hanok',
    'queenslander',
    'modern_apartments',
  ]) {
    const style = `molen.worldgen.catalog.${id}`;
    const entry = report.entries.find((e) => e.style === style);
    await page.evaluate((style) => window.__structureSheet.open(style), style);
    await page.screenshot({ path: resolve(out, `detail-${id}.png`) });
    for (const angle of ['front', 'rear']) {
      await page.evaluate((angle) => window.__structureSheet.view(angle), angle);
      await page.locator('#detail-view').screenshot({ path: resolve(out, `${id}-${angle}.png`) });
    }
    await page.evaluate(
      ({ width, depth, levels }) =>
        window.__structureSheet.resize(width * 1.45, depth * 0.7, Math.min(12, levels + 1)),
      entry,
    );
    await page.screenshot({ path: resolve(out, `resized-${id}.png`) });
    await page.locator('#textures').uncheck();
    await page.waitForTimeout(150);
    await page.locator('#detail-view').screenshot({ path: resolve(out, `untextured-${id}.png`) });
    await page.locator('#textures').check();
    await page.selectOption('#tier', '2');
    await page.waitForTimeout(150);
    await page.locator('#detail-view').screenshot({ path: resolve(out, `distant-${id}.png`) });
    await page.selectOption('#tier', '0');
    await page.locator('#close').click();
    checks.push({
      style,
      width: entry.width * 1.45,
      depth: entry.depth * 0.7,
      levels: entry.levels + 1,
      views: ['quarter', 'front', 'rear', 'resized', 'untextured', 'distant'],
    });
  }
  report.resizeChecks = checks;
  report.pageErrors = pageErrors;
  await writeFile(resolve(out, 'render-report.json'), `${formatJson(report)}\n`);
  if (pageErrors.length) throw new Error(pageErrors.join('\n'));
  console.log(`Saved 120-model sheet, 13 taxonomy sheets and 36 inspection frames to ${out}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
