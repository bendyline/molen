/** Local review artifact. Only completed captures are included; no generated image claims. */
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world');
const read = async (path) => JSON.parse(await readFile(resolve(out, path), 'utf8'));
const htmlText = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const href = (path) =>
  relative(out, path).replaceAll('\\', '/').split('/').map(encodeURIComponent).join('/');
const cards = [];
const add = (group, title, note, path) => cards.push({ group, title, note, image: href(path) });
for (const name of [
  'seattle-forest-high-optimized',
  'tucson-desert-high-fixed',
  'manaus-forest-high',
  'kyoto-hills-high-daylight',
  'suva-gardens-high',
  'catania-city-economy',
]) {
  const report = await read(`live/${name}.json`);
  if (
    report.error ||
    report.loadTimeout ||
    report.walkTimeout ||
    report.walkLoadingTimeout ||
    report.pageErrors.length
  )
    throw new Error(`Incomplete live review: ${name}`);
  for (const frame of report.frames)
    add(
      'Live terrain',
      frame.replace(/\.png$/, '').replaceAll('-', ' '),
      `Actual mapped terrain · ${report.quality} · measured p95 ${report.timing?.p95Ms?.toFixed(1) ?? '?'} ms on the review machine`,
      resolve(out, 'live', frame),
    );
}
for (const report of await read('landscapes/evidence.json'))
  for (const frame of report.frames)
    add(
      'Landscape fixtures',
      `${report.name.replaceAll('_', ' ')} · ${report.quality} · ${frame.match(/-(walk|drive|fly)\.png$/)?.[1] ?? ''}`,
      'Controlled flat fixture · actual regional scatter · placements baked for capture',
      frame,
    );
for (const report of await read('architecture/evidence.json'))
  for (const frame of report.frames)
    add(
      'Building families',
      report.family.replaceAll('_', ' '),
      'Seven ordinary uses · actual material pipeline · source footprint and heights retained',
      frame.path,
    );
const motion = await read('wildlife-motion/evidence.json');
if (motion.errors.length) throw new Error('Wildlife capture errors');
for (const animal of [
  'roe_deer',
  'red_fox',
  'red_kangaroo',
  'savanna_elephant',
  'woodland_songbird',
  'waterfowl_group',
  'wading_bird_group',
  'warm_ground_lizard',
  'freshwater_fish_group',
  'flower_visiting_insect',
  'red_squirrel',
  'european_hare',
])
  add(
    'Wildlife motion',
    animal.replaceAll('_', ' '),
    'Pose at tick 11 · actual deterministic movement and skinned renderer',
    resolve(out, 'wildlife-motion', `${animal}-11.png`),
  );
const modes = await read('mounted/tucson-mount-balanced.json');
if (modes.error || modes.pageErrors.length || modes.errors.length)
  throw new Error('Public mount capture errors');
for (const mode of modes.cases)
  add(
    'Public Earth API',
    `Tucson · ${mode.mode}`,
    mode.mode === 'drive'
      ? 'Known adjacent issue: sedan partly below sloped road. Regional terrain rendered correctly.'
      : 'Real terrain · public mountEarthView API · balanced quality',
    resolve(out, 'mounted', `${modes.name}-${mode.mode}.png`),
  );

const groups = [...new Set(cards.map((card) => card.group))];
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Molen regional world review</title>
<style>
:root{font:16px/1.5 system-ui,sans-serif;color:#253d35;background:#f4f4ee}body{max-width:1500px;margin:0 auto;padding:32px}h1{font-size:36px;line-height:1.1;margin:0 0 16px}p{max-width:950px}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}button,input{font:inherit;padding:8px 12px;border:1px solid #a2b3a6;border-radius:4px;background:white;color:inherit}button[aria-pressed=true]{background:#284e3d;color:white}input{min-width:200px;flex:1}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:24px}figure{margin:0;background:white;border:1px solid #ccd6ca}figure[hidden]{display:none}img{width:100%;display:block;aspect-ratio:1.6;object-fit:contain;background:#dfe8de}figcaption{padding:14px}strong{display:block}small{display:block;color:#52675c}a{color:inherit}details{max-width:1050px;margin:18px 0}#count{font-size:14px}footer{margin:30px 0;color:#52675c}
</style></head><body>
<h1>Molen regional world</h1>
<p>58 plant presets in 12 procedural families, 36 habitat profiles, 91 building recipes in 13 construction families, and 30 wildlife recipes. Ecology and wildlife data arrive as small independent packs; authored landmarks retain lazy regional archives.</p>
<details><summary>Evidence and fidelity limits</summary><p>The ecology grid describes potential habitat at a quarter degree; actual mapped cover, crops, trees and building dimensions govern placement. Mammal country membership is a coarse range limit, not a presence claim. Building families are visual priors. Fine habitat boundaries, species occupancy, migration and detailed city surveys require further evidence. Live captures use small attributed map extracts; fixture captures are controlled compositions and do not measure streaming performance. Headless frame timings describe this machine only.</p><p>The driving capture exposes a separate sloped-road vehicle-grounding issue. Other captured camera modes show the regional content without that vehicle issue.</p></details>
<nav aria-label="Review filters"><button type="button" data-group="all" aria-pressed="true">All</button>${groups.map((group) => `<button type="button" data-group="${htmlText(group)}" aria-pressed="false">${htmlText(group)}</button>`).join('')}<input id="search" type="search" aria-label="Find a region, family or model" placeholder="Find a region, family or model"></nav><p id="count" aria-live="polite"></p>
<main>${cards.map((card) => `<figure data-group="${htmlText(card.group)}" data-title="${htmlText(card.title.toLowerCase())}"><a href="${card.image}"><img loading="lazy" src="${card.image}" alt="${htmlText(card.title)}"></a><figcaption><strong>${htmlText(card.title)}</strong><small>${htmlText(card.note)}</small></figcaption></figure>`).join('\n')}</main>
<footer>Local acceptance artifacts · source credits remain visible in live screenshots · full evidence and checks are recorded in content/ecology/coverage-plan.json and docs-src/guide/regional-world.md.</footer>
<script>
const cards=[...document.querySelectorAll('figure')],buttons=[...document.querySelectorAll('button')],search=document.getElementById('search');let group='all';
function update(){let count=0;for(const card of cards){card.hidden=(group!=='all'&&card.dataset.group!==group)||!card.dataset.title.includes(search.value.trim().toLowerCase());if(!card.hidden)count++;}document.getElementById('count').textContent=count+' captures shown';}
for(const button of buttons)button.addEventListener('click',()=>{group=button.dataset.group;for(const item of buttons)item.setAttribute('aria-pressed',String(item===button));update();});search.addEventListener('input',update);update();
</script></body></html>`;
await writeFile(resolve(out, 'review.html'), html);
console.log(`Regional review: ${cards.length} captures -> ${resolve(out, 'review.html')}`);
