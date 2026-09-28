/** Import or verify every generated A02–E20 GLB in the worldgen content asset repository. */
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importAsset, inspectAsset } from '../../tooling/dist/index.mjs';
import { biomeJson } from './format-json.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const content = resolve(root, 'content/worldgen');
const source = resolve(content, 'source/site-structures');
const projectPath = resolve(content, 'project.json');
const stylepackPath = resolve(content, 'stylepack.json');
const biome = resolve(root, 'packages/worldgen/node_modules/@biomejs/biome/bin/biome');
const check = process.argv.includes('--check');
const dirs = (await readdir(source, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && /^[a-e]\d{2}_/.test(entry.name))
  .map((entry) => entry.name)
  .sort();
if (dirs.length !== 97) throw new Error(`Expected 97 new source directories, found ${dirs.length}`);

const pack = JSON.parse(await readFile(stylepackPath, 'utf8'));
const catalog = [];
for (const key of dirs) {
  const spec = JSON.parse(await readFile(resolve(source, key, 'spec.json'), 'utf8'));
  if (!spec.id.endsWith(`.${key}`) || !key.startsWith(spec.planId.toLowerCase()))
    throw new Error(`${key}: source key does not match asset id`);
  const sidecarRelative = `assets/${spec.id.replaceAll('.', '/')}/asset.json`;
  const sourcePath = resolve(source, key, 'models/source.glb');
  if (!check) {
    const imported = await importAsset({
      path: sourcePath,
      id: spec.id,
      outDir: resolve(content, 'assets'),
      projectPath,
      force: true,
    });
    if (!imported.ok || imported.registered !== true)
      throw new Error(`${key}: ${imported.error ?? 'not registered'}`);
    // importAsset writes 2-space JSON; the content repository is linted by biome.
    const sidecarPath = resolve(content, sidecarRelative);
    const sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
    await writeFile(sidecarPath, biomeJson(sidecar, sidecarPath));
  }
  const inspected = await inspectAsset({ ref: spec.id, projectPath, verify: true });
  if (!inspected.ok || inspected.sidecar === undefined)
    throw new Error(`${key}: ${inspected.error ?? 'inspection failed'}`);
  if (pack.assets[spec.id] !== undefined && pack.assets[spec.id] !== sidecarRelative)
    throw new Error(`${key}: conflicting style pack registration`);
  pack.assets[spec.id] = sidecarRelative;
  catalog.push({
    planId: spec.planId,
    id: spec.id,
    title: spec.title,
    triangles: inspected.sidecar.stats.triangles,
    bytes: inspected.sidecar.stats.sizeBytes,
    source: `source/site-structures/${key}`,
    preview: `source/site-structures/${key}/preview.png`,
  });
  console.log(
    `${spec.planId}: ${inspected.sidecar.stats.triangles} triangles, ${inspected.sidecar.stats.sizeBytes} runtime bytes`,
  );
}

const galleryEntries = [
  { planId: 'A01', title: 'Space Needle', preview: 'space-needle/preview.png' },
  { planId: 'C01', title: 'Golden Gate Bridge', preview: 'golden-gate-bridge/preview.png' },
  { planId: 'C02', title: 'SR 520 floating bridge', preview: 'sr-520-floating-bridge/preview.png' },
  ...catalog.map((entry) => ({
    planId: entry.planId,
    title: entry.title,
    preview: entry.preview.replace('source/site-structures/', ''),
  })),
].sort((a, b) => a.planId.localeCompare(b.planId));
const gallery = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Molen structure asset gallery</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; background: #121922; color: #ecf1f5; }
  header { position: sticky; top: 0; z-index: 1; padding: 1rem 1.5rem; background: #18222e; border-bottom: 1px solid #344455; }
  h1 { margin: 0 0 .45rem; font-size: 1.3rem; }
  p { margin: 0 0 .7rem; color: #b7c4cf; }
  input { box-sizing: border-box; width: min(100%, 32rem); padding: .65rem .8rem; color: inherit; background: #0f1720; border: 1px solid #526476; border-radius: .4rem; font: inherit; }
  main { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; padding: 1rem; }
  article { overflow: hidden; border: 1px solid #344455; border-radius: .5rem; background: #202c39; }
  img { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: #b5d2df; }
  article div { padding: .7rem .85rem; }
  strong { color: #83cef5; margin-right: .45rem; }
</style>
<header><h1>100 Molen structure assets</h1><p>Lit Molen previews of the imported GLBs. Dimensions and geographic placement are provisional.</p><input id="filter" type="search" placeholder="Filter by ID or name" aria-label="Filter assets"></header>
<main id="gallery"></main>
<script>
const entries = ${JSON.stringify(galleryEntries)};
const gallery = document.getElementById('gallery');
const filter = document.getElementById('filter');
function render() {
  gallery.replaceChildren();
  const term = filter.value.trim().toLowerCase();
  for (const entry of entries.filter((e) => [e.planId, e.title].join(' ').toLowerCase().includes(term))) {
    const card = document.createElement('article');
    const image = document.createElement('img');
    image.src = entry.preview; image.alt = entry.title; image.loading = 'lazy';
    const caption = document.createElement('div');
    const id = document.createElement('strong'); id.textContent = entry.planId;
    caption.append(id, document.createTextNode(entry.title));
    card.append(image, caption); gallery.append(card);
  }
}
filter.addEventListener('input', render);
render();
</script></html>
`;

if (check) {
  const current = JSON.parse(await readFile(stylepackPath, 'utf8'));
  for (const item of catalog) {
    const expected = `assets/${item.id.replaceAll('.', '/')}/asset.json`;
    if (current.assets[item.id] !== expected)
      throw new Error(`${item.planId}: missing style pack entry`);
  }
  const currentIndex = JSON.parse(await readFile(resolve(source, 'asset-index.json'), 'utf8'));
  if (JSON.stringify(currentIndex) !== JSON.stringify(catalog))
    throw new Error('The 97-entry source asset index is stale');
  if (
    (await readFile(resolve(source, 'gallery.html'), 'utf8')).replaceAll('\r\n', '\n') !== gallery
  )
    throw new Error('The 100-asset preview gallery is stale');
} else {
  const formatted = execFileSync(
    process.execPath,
    [biome, 'format', '--stdin-file-path', stylepackPath],
    {
      input: JSON.stringify(pack),
      encoding: 'utf8',
    },
  );
  await writeFile(stylepackPath, formatted);
  await writeFile(resolve(source, 'asset-index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  await writeFile(resolve(source, 'gallery.html'), gallery);
}
console.log(`Verified ${catalog.length} imported structure assets.`);
