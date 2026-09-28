/** Generate an offline browsable view of the next-1000 planning catalog. */
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authoredModelDirectories,
  readOptionalJson,
  writeIndex,
} from './structure-model-files.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const dir = resolve(root, 'content/worldgen/source/next-1000');
const catalog = JSON.parse(await readFile(resolve(dir, 'candidates.json'), 'utf8'));
const ledger = JSON.parse(
  await readFile(resolve(root, 'content/earth/structures/readiness.json'), 'utf8'),
);
const readiness = new Map(ledger.candidates.map((entry) => [entry.candidateId, entry]));
const previewPath = (asset, shared) =>
  relative(
    dir,
    structureSourcePath(
      asset.split('.').at(-1),
      shared ? 'shots/shared/angle-0.png' : 'preview.png',
    ),
  ).replaceAll('\\', '/');
const reusable = (
  await Promise.all(
    (
      await authoredModelDirectories()
    )
      .filter((dir) => dir.replaceAll('\\', '/').includes('/source/map-structures/'))
      .map((dir) => readOptionalJson(resolve(dir, 'spec.json'))),
  )
)
  .filter(Boolean)
  .map((spec) => ({
    id: spec.id,
    title: spec.title,
    quality: spec.quality ?? 'study',
    preview: `../map-structures/${spec.assetId.split('.').at(-1)}/preview.png`,
  }));
const reusableData = JSON.stringify(reusable).replaceAll('<', '\\u003c');
const data = JSON.stringify(
  catalog.candidates.map(
    ({ id, title, category, source, referenceCoordinate, sitelinks, status, modelRef }) => ({
      id,
      title,
      category,
      source,
      referenceCoordinate,
      sitelinks,
      status,
      quality:
        catalog.candidates.find((candidate) => candidate.id === id)?.modelQuality ??
        (modelRef ? 'study' : null),
      blockers: readiness.get(id)?.blockers ?? [],
      verified: readiness.get(id)?.readiness === 'ready',
      mapEvidence: readiness.get(id)?.geographic.orientationEvidence ?? 'unresolved',
      visualReviewed: readiness.get(id)?.visualQa.hashBoundReviewPassed ?? false,
      previewPlacement: Boolean(readiness.get(id)?.geographic.activePlacement),
      sharedReviewed: readiness.get(id)?.sharedSurfaceQa?.hashBoundReviewPassed ?? false,
      collection: readiness.get(id)?.collection
        ? {
            requiredCount: readiness.get(id).collection.requiredCount,
            readyCount: readiness.get(id).collection.readyCount,
            members: readiness
              .get(id)
              .collection.members.filter((member) => member.model.source.present)
              .map((member) => ({
                id: member.candidateId,
                title: member.title,
                quality: member.model.quality,
                preview: previewPath(member.asset, member.sharedSurfaceQa.hashBoundReviewPassed),
              })),
          }
        : null,
      preview: modelRef
        ? previewPath(modelRef, readiness.get(id)?.sharedSurfaceQa?.hashBoundReviewPassed)
        : null,
    }),
  ),
).replaceAll('<', '\\u003c');
const html = `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Molen · next 1,000 structure candidates</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; }
  body { margin: 0; background: #101923; color: #eaf0f4; }
  header { position: sticky; top: 0; z-index: 2; padding: 1rem 1.5rem; background: #172635; border-bottom: 1px solid #3b5265; }
  h1 { margin: 0 0 .5rem; font-size: 1.5rem; }
  p { margin: .3rem 0 .8rem; color: #bfd0dc; max-width: 75rem; }
  .controls { display: flex; flex-wrap: wrap; gap: .6rem; align-items: center; }
  input, select { padding: .55rem .7rem; color: inherit; background: #0b1620; border: 1px solid #5b7080; border-radius: .35rem; font: inherit; }
  input { width: min(100%, 28rem); }
  #count { color: #87d5ee; font-variant-numeric: tabular-nums; }
  main { padding: 1rem 1.5rem 3rem; }
  h2 { margin: .3rem 0 .8rem; font-size: 1.1rem; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .8rem; margin-bottom: 1.6rem; }
  .card { overflow: hidden; background: #1d2d3b; border: 1px solid #3b5265; border-radius: .5rem; }
  .card img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: contain; background: #bfd1df; }
  .card div { padding: .55rem .7rem; }
  a { color: #94dbfa; }
  table { border-collapse: collapse; width: 100%; font-size: .9rem; }
  th, td { border-bottom: 1px solid #344959; padding: .45rem .5rem; text-align: left; }
  th { position: sticky; top: 135px; background: #172635; }
  tr:nth-child(even) { background: #14212d; }
  .modeled { color: #9ee6b7; }
  .coord { color: #a9bdc9; font-variant-numeric: tabular-nums; }
</style>
<header><h1>Next 1,000 significant structure candidates</h1>
<p>1,000 named candidates across 14 structure classes. ${ledger.counts.runtimeModels} imported models · ${ledger.counts.visualReviews} visually reviewed · ${ledger.counts.sharedSurfaceReviews} shared-material reviews · ${ledger.counts.previewPlacements} world-viewer previews · ${ledger.counts.ready} maximum-fidelity completions. Reference coordinates and mapped axes are research evidence.</p>
<div class="controls"><input id="search" type="search" placeholder="Search title or ID" aria-label="Search candidates"><select id="category" aria-label="Category"><option value="">All categories</option></select><select id="status" aria-label="Status"><option value="">All statuses</option><option value="modeled">Modeled</option><option value="in-progress">Collection in progress</option><option value="candidate">Candidate</option></select><span id="count"></span></div></header>
<main><h2>Authored models</h2><div class="cards" id="cards"></div><h2>Reusable map structures</h2><div class="cards" id="reusable"></div><h2>Candidate inventory</h2>
<table><thead><tr><th>ID</th><th>Structure</th><th>Class</th><th>Visibility score</th><th>Model / review</th><th>Placement evidence</th><th>Reference point</th></tr></thead><tbody id="rows"></tbody></table></main>
<script>
const entries = ${data};
const search = document.getElementById('search');
const category = document.getElementById('category');
const status = document.getElementById('status');
const count = document.getElementById('count');
const rows = document.getElementById('rows');
const cards = document.getElementById('cards');
for (const name of [...new Set(entries.map(e => e.category))]) { const o = document.createElement('option'); o.value = name; o.textContent = name.replaceAll('_', ' '); category.append(o); }
for (const e of [...entries.flatMap(e => e.collection?.members ?? (e.preview ? [e] : [])), ...${reusableData}.map(e => ({...e, reusable: true}))]) {
  const card = document.createElement('article'); card.className = 'card';
  const img = document.createElement('img'); img.src = e.preview; img.alt = e.title; img.loading = 'lazy';
  const imageLink = document.createElement('a'); imageLink.href = e.preview; imageLink.title = 'Open full-size review image'; imageLink.append(img);
  const caption = document.createElement('div'); caption.textContent = e.id + ' · ' + e.title + ' · ' + e.quality;
  card.append(imageLink, caption); (e.reusable ? document.getElementById('reusable') : cards).append(card);
}
function render() {
  const q = search.value.trim().toLowerCase();
  const matches = entries.filter(e => (!category.value || e.category === category.value) && (!status.value || e.status === status.value) && (!q || (e.id + ' ' + e.title).toLowerCase().includes(q)));
  count.textContent = matches.length + ' / ' + entries.length;
  rows.replaceChildren();
  for (const e of matches) {
    const tr = document.createElement('tr');
    const id = document.createElement('td'); id.textContent = e.id;
    const title = document.createElement('td'); const link = document.createElement('a'); link.href = e.source; link.textContent = e.title; link.target = '_blank'; link.rel = 'noopener'; title.append(link);
    const group = document.createElement('td'); group.textContent = e.category.replaceAll('_', ' ');
    const score = document.createElement('td'); score.textContent = e.sitelinks;
    const state = document.createElement('td'); state.textContent = e.collection ? e.collection.readyCount + ' / ' + e.collection.requiredCount + ' independent members complete' : e.quality ? e.quality + (e.visualReviewed ? ' · reviewed' : ' · review pending') : 'Source model pending'; if (e.visualReviewed) state.className = 'modeled';
    const placement = document.createElement('td'); placement.textContent = e.verified ? 'Verified placement' : e.previewPlacement ? 'World-viewer preview' : e.mapEvidence; placement.title = e.blockers.join('\\n');
    const coord = document.createElement('td'); coord.className = 'coord'; coord.textContent = e.referenceCoordinate.latitude.toFixed(4) + ', ' + e.referenceCoordinate.longitude.toFixed(4);
    tr.append(id, title, group, score, state, placement, coord); rows.append(tr);
  }
}
search.addEventListener('input', render); category.addEventListener('change', render); status.addEventListener('change', render); render();
</script></html>
`;
if (process.argv.includes('--check')) {
  if ((await readFile(resolve(dir, 'gallery.html'), 'utf8')).replaceAll('\r\n', '\n') !== html)
    throw new Error('The next-1000 gallery is stale');
} else await writeIndex(resolve(dir, 'gallery.html'), html);
console.log(
  `${process.argv.includes('--check') ? 'Verified' : 'Wrote'} gallery with ${catalog.candidates.length} candidates`,
);
