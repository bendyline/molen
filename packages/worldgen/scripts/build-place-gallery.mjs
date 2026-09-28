/** Build the canonical offline geographic source gallery without touching model bundles. */
import { mkdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertSourceRegistryCurrent,
  content,
  readOptionalJson,
  root,
  writeIndex,
} from './structure-model-files.mjs';
import { knownSourceEntries, structureSourceDirectory } from './structure-source-paths.mjs';

export function renderPlaceGallery(entries) {
  const data = JSON.stringify(entries).replaceAll('<', '\\u003c');
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Molen · geographic structure sources</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif}body{margin:0;background:#111b25;color:#e9f1f5}
header{position:sticky;top:0;z-index:1;padding:1rem 1.5rem;background:#1a2b39;border-bottom:1px solid #456071}
h1{margin:0 0 .5rem;font-size:1.45rem}p{color:#bdd0dc;max-width:76rem}.filters{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
input,select{padding:.6rem;background:#112330;color:inherit;border:1px solid #648095;border-radius:.35rem;font:inherit}
input{width:min(90%,28rem)}main{padding:1rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:1rem}
article{background:#1d3040;border:1px solid #415c70;border-radius:.4rem;overflow:hidden}img{display:block;width:100%;aspect-ratio:4/3;object-fit:contain;background:#b7cdd7}
article div{padding:.8rem}h2{font-size:1.05rem;margin:0 0 .4rem}article p{margin:.35rem 0;font-size:.88rem}a{color:#9cdcff}.links{display:flex;gap:1rem;flex-wrap:wrap}#count{color:#a5d9ed}
</style>
<header><h1>Geographic structure sources</h1>
<p>Editable model bundles grouped by geohash, alongside reusable urban and infrastructure assets. Stable asset IDs and current review status are separate from folder location. Unlocated places have no recorded geographic anchor.</p>
<div class="filters"><input id="search" type="search" placeholder="Search name, ID or coordinates" aria-label="Search models"><select id="gh2" aria-label="Geohash region"><option value="">All geohash regions</option></select><select id="gh3" aria-label="Geohash cell"><option value="">All geohash cells</option></select><select id="bucket" aria-label="Asset category"><option value="">All categories</option></select><span id="count"></span></div></header>
<main id="gallery"></main>
<script>
const entries = ${data};
const search=document.getElementById('search'), gh2=document.getElementById('gh2'), gh3=document.getElementById('gh3'), bucket=document.getElementById('bucket'), gallery=document.getElementById('gallery'), count=document.getElementById('count');
function addOptions(select, values){for(const value of [...new Set(values)].sort()){const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option);}}
const region=e=>e.geohash2||(e.reusable?'reusable':'unlocated'), cell=e=>e.geohash3||(e.reusable?'reusable':'unlocated');
addOptions(gh2,entries.map(region));addOptions(bucket,entries.map(e=>e.bucket));
function cells(){const prior=gh3.value;gh3.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='All geohash cells';gh3.append(all);addOptions(gh3,entries.filter(e=>!gh2.value||region(e)===gh2.value).map(cell));if([...gh3.options].some(o=>o.value===prior))gh3.value=prior;}
function render(){const q=search.value.trim().toLowerCase();const matches=entries.filter(e=>(!gh2.value||region(e)===gh2.value)&&(!gh3.value||cell(e)===gh3.value)&&(!bucket.value||e.bucket===bucket.value)&&(!q||[e.id,e.asset,e.title,...(e.anchor||[])].join(' ').toLowerCase().includes(q)));count.textContent=matches.length+' / '+entries.length+' models';gallery.replaceChildren();for(const e of matches){const card=document.createElement('article'),imageLink=document.createElement('a'),image=document.createElement('img');imageLink.href=e.preview;image.src=e.preview;image.alt=e.title;image.loading='lazy';imageLink.append(image);const body=document.createElement('div'),title=document.createElement('h2');title.textContent=e.title;body.append(title);for(const text of [e.id+' · '+cell(e)+' · '+e.bucket,e.review,e.anchor?'Lon '+e.anchor[0].toFixed(5)+' · Lat '+e.anchor[1].toFixed(5):'Geographic anchor pending']){const p=document.createElement('p');p.textContent=text;body.append(p);}const links=document.createElement('p');links.className='links';for(const [label,url] of [['Source notes',e.readme],['GLB master',e.model]]){const a=document.createElement('a');a.href=url;a.textContent=label;links.append(a);}body.append(links);card.append(imageLink,body);gallery.append(card);}}
gh2.addEventListener('change',()=>{cells();render();});for(const control of [gh3,bucket])control.addEventListener('change',render);search.addEventListener('input',render);cells();render();
</script></html>
`;
}

export async function buildPlaceGallery() {
  await assertSourceRegistryCurrent();
  const directory = resolve(content, 'source/places');
  const ledger = await readOptionalJson(resolve(root, 'content/earth/structures/readiness.json'));
  const project = await readOptionalJson(resolve(content, 'project.json'));
  const reviews = new Map();
  for (const record of ledger?.candidates ?? []) {
    for (const model of record.collection?.members ?? [record]) reviews.set(model.asset, model);
  }
  const entries = [];
  for (const entry of knownSourceEntries()) {
    const dir = structureSourceDirectory(entry.key);
    const spec = await readOptionalJson(resolve(dir, 'spec.json'));
    const source = await readOptionalJson(resolve(dir, 'source.json'));
    if (!spec || !source?.files?.models?.length) continue;
    const asset = spec.assetId ?? spec.id;
    const sidecarPath = project?.assets?.[asset];
    if (!sidecarPath) continue;
    const sidecar = await readOptionalJson(resolve(content, sidecarPath));
    if (sidecar?.id !== asset) continue;
    const reviewed = reviews.get(asset);
    const link = (path) => relative(directory, resolve(dir, path)).replaceAll('\\', '/');
    entries.push({
      id: entry.candidateId ?? spec.planId ?? spec.id,
      asset,
      title: spec.title,
      collection: entry.collection,
      reusable: entry.role === 'reusable',
      bucket: entry.sourcePath.includes('/source/reusable/')
        ? `Reusable ${entry.sourcePath.split('/source/reusable/')[1].split('/')[0]}`
        : entry.role === 'reusable'
          ? 'Reusable map structures'
          : entry.geohash2
            ? 'Place'
            : 'Unlocated place',
      anchor: entry.anchor,
      geohash2: entry.geohash2,
      geohash3: entry.geohash3,
      review:
        reviewed?.readiness === 'ready'
          ? 'Exterior, rendering and placement reviewed'
          : reviewed?.geographic?.activePlacement
            ? 'World-viewer preview · further review pending'
            : 'Imported model · review pending',
      preview: link(
        reviewed?.sharedSurfaceQa?.hashBoundReviewPassed
          ? 'shots/shared/angle-0.png'
          : 'preview.png',
      ),
      readme: link('README.md'),
      model: link(source.files.models[0].path),
    });
  }
  entries.sort(
    (a, b) => (a.geohash3 ?? '~').localeCompare(b.geohash3 ?? '~') || a.id.localeCompare(b.id),
  );
  const html = renderPlaceGallery(entries);
  const path = resolve(directory, 'gallery.html');
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== html)
      throw new Error('Geographic source gallery is stale');
  } else {
    await mkdir(directory, { recursive: true });
    await writeIndex(path, html);
  }
  console.log(
    `${process.argv.includes('--check') ? 'Verified' : 'Wrote'} geographic gallery with ${entries.length} imported source bundles`,
  );
  return entries;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await buildPlaceGallery();
