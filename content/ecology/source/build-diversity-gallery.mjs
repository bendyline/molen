/** Local comparison gallery; these are real recipe renders, not generated concept images. */
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world');
const read = async (path) => JSON.parse(await readFile(resolve(out, path), 'utf8'));
const text = (v) =>
  String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const cards = [];
const add = (group, title, note, image) =>
  cards.push({ group, title, note, image: relative(out, image).replaceAll('\\', '/') });
for (const report of await read('diversity/evidence.json'))
  for (const frame of report.frames)
    add(
      report.kind === 'plant' ? 'Plants' : 'Wildlife',
      report.name.replaceAll('_', ' '),
      `${report.family} · ${frame.name === 'angle_0' ? 'left to right' : 'right to left'}: base, ${report.kind === 'plant' ? 'spreading, slender' : 'compact, rangy'} · ${frame.name}`,
      frame.path,
    );
for (const report of await read('architecture-diversity/evidence.json'))
  for (const frame of report.frames)
    add(
      'Buildings',
      report.family.replaceAll('_', ' '),
      'Seven uses across columns · rows: base, compact facade, open facade · shared regional materials',
      frame.path,
    );
for (const report of await read('landscape-diversity/evidence.json'))
  for (const frame of report.frames)
    add(
      'Habitats',
      `${report.name.replaceAll('_', ' ')} · ${report.quality}`,
      `Actual scatter and budgets · controlled flat fixture · ${frame.match(/-(walk|drive|fly)\.png$/)?.[1] ?? ''}`,
      frame,
    );
const motion = await read('wildlife-motion-diversity/evidence.json');
if (motion.errors.length) throw new Error('Wildlife motion capture failed');
for (const frame of motion.cases)
  add(
    'Motion',
    `${frame.name.replaceAll('_', ' ')} · tick ${frame.ticks}`,
    'Actual skinned renderer and deterministic movement · one finite posed animal',
    resolve(out, 'wildlife-motion-diversity', `${frame.name}-${frame.ticks}.png`),
  );
const groups = [...new Set(cards.map((c) => c.group))];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Molen regional diversity</title><style>
*{box-sizing:border-box}body{margin:0;padding:32px;background:#f3efe6;color:#293d32;font:16px/1.5 system-ui}h1{font-size:36px;margin:0}p{max-width:980px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}button,input{padding:8px 14px;border:1px solid #acb3a4;background:white;color:inherit;font:inherit}button[aria-pressed=true]{background:#3d4d3a;color:white}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,500px),1fr));gap:20px}figure{margin:0;background:white;border:1px solid #cbd0c4}figure[hidden]{display:none}img{width:100%;display:block}figcaption{padding:12px}strong,small{display:block}a{color:inherit}
</style></head><body><h1>Three forms, every regional family</h1><p>174 plant presets across 12 procedural families and 36 habitats, 90 wildlife recipes, and 273 building recipes across 13 regional construction families. Including seasonal plant appearances: 264. Compact ecology and wildlife packs: 144 KB and 40 KB.</p><p>Geographic eligibility, species weighting, mapped dimensions and density limits stay intact. Extra plant forms use spare model slots; restricted budgets fall back to base forms. Wildlife triplets split their original visual density. These are visual variants, not added species or surveyed local building identities.</p><nav><button data-group="all" aria-pressed="true">All</button>${groups.map((g) => `<button data-group="${g}" aria-pressed="false">${g}</button>`).join('')}<input type="search" aria-label="Filter variants" placeholder="Find a family or habitat"></nav><p id="count" aria-live="polite"></p><main>${cards.map((c) => `<figure data-group="${c.group}" data-title="${text(c.title)}"><a href="${encodeURI(c.image)}"><img loading="lazy" src="${encodeURI(c.image)}" alt="${text(c.title)}"></a><figcaption><strong>${text(c.title)}</strong><small>${text(c.note)}</small></figcaption></figure>`).join('\n')}</main><script>
const cards=[...document.querySelectorAll('figure')],buttons=[...document.querySelectorAll('button')],search=document.querySelector('input');let group='all';function update(){let count=0;for(const card of cards){card.hidden=(group!=='all'&&card.dataset.group!==group)||!card.dataset.title.includes(search.value.trim().toLowerCase());if(!card.hidden)count++;}document.getElementById('count').textContent=count+' captures shown';}for(const b of buttons)b.onclick=()=>{group=b.dataset.group;for(const other of buttons)other.setAttribute('aria-pressed',String(other===b));update();};search.oninput=update;update();
</script></body></html>`;
await writeFile(resolve(out, 'diversity-review.html'), html);
console.log(JSON.stringify({ frames: cards.length, groups }));
