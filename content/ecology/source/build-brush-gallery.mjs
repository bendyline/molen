/** Before/after views use identical cameras and the real Earth scatter budgets. */
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = resolve(root, '.artifacts/regional-world');
const json = async (name) => JSON.parse(await readFile(resolve(out, name), 'utf8'));
const esc = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const path = (value) => encodeURI(relative(out, value).replaceAll('\\', '/'));
const before = await json('landscape-diversity/evidence.json');
const after = await json('landscape-brush/evidence.json');
const models = await json('brush-models/evidence.json');
const cards = [];
for (const report of after) {
  const previous = before.find((p) => p.name === report.name && p.quality === report.quality);
  for (const [i, frame] of report.frames.entries()) {
    const view = ['walk', 'drive', 'fly'][i];
    cards.push(
      `<figure data-group="${report.quality}" data-title="${esc(`${report.name} ${view}`)}"><div class="compare"><img src="${path(frame)}" alt="${esc(report.name)} after"><div class="before"><img src="${path(previous.frames[i])}" alt="${esc(report.name)} before"></div><span class="label old">Before</span><span class="label new">Brush milestone</span></div><figcaption><strong>${esc(report.name.replaceAll('_', ' '))} · ${report.quality} · ${view}</strong><label>Compare <input type="range" min="0" max="100" value="50" aria-label="${esc(report.name)} comparison"></label><small>Controlled flat habitat fixture, actual region selection and quality budgets.</small></figcaption></figure>`,
    );
  }
}
for (const report of models)
  for (const frame of report.frames)
    cards.push(
      `<figure data-group="models" data-title="${esc(report.name)}"><a href="${path(frame.path)}"><img src="${path(frame.path)}" alt="${esc(report.name)}"></a><figcaption><strong>${esc(report.name.replaceAll('_', ' '))}</strong><small>${report.family} · base/spreading/slender forms · ${report.triangles} triangles across the three models</small></figcaption></figure>`,
    );
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Molen · layered brush</title><style>
*{box-sizing:border-box}body{margin:0;padding:28px;background:#eeeadd;color:#283f32;font:16px/1.5 system-ui}h1{font-size:36px;margin:0}p{max-width:1000px}nav{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}button,input[type=search]{padding:9px 14px;font:inherit;border:1px solid #a0ae95;background:white;color:inherit}button[aria-pressed=true]{background:#345a3b;color:white}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,530px),1fr));gap:24px}figure{margin:0;background:#fff;border:1px solid #c3cabd}figure[hidden]{display:none}img{width:100%;display:block}.compare{position:relative;aspect-ratio:1.6;overflow:hidden}.compare>img,.before{position:absolute;inset:0;width:100%;height:100%}.before{clip-path:inset(0 50% 0 0)}.label{position:absolute;top:12px;background:#233b2bcc;color:white;padding:4px 8px}.old{left:12px}.new{right:12px}figcaption{padding:14px}strong,small{display:block}small{color:#5d6d5f}label{display:flex;gap:12px;align-items:center}input[type=range]{flex:1;min-width:0;accent-color:#41674a}a{color:inherit}
</style></head><body><h1>Nature between the trees</h1><p>234 plant presets across 18 procedural families. New multi-stem shrubs, thickets, herb and fern colonies, ground runners, moss, litter, fallen wood and supported tree vines. Forests now have an independently budgeted shrub layer. Ground patches share broad clearings and finer clumps.</p><p>Drag each comparison to reveal the previous scene. Economy retains broad brush; High adds low detail. Managed parks and crops stay clear of wild overgrowth. These fixtures show composition, not measured real-world plant occupancy or live frame rate.</p><nav><button data-group="all" aria-pressed="true">All</button><button data-group="high" aria-pressed="false">High</button><button data-group="economy" aria-pressed="false">Economy</button><button data-group="models" aria-pressed="false">Models</button><input type="search" aria-label="Find habitat or plant" placeholder="Find habitat or plant"></nav><p id="count" aria-live="polite"></p><main>${cards.join('\n')}</main><script>
const cards=[...document.querySelectorAll('figure')],buttons=[...document.querySelectorAll('button')],search=document.querySelector('input[type=search]');let group='all';function update(){let count=0;for(const card of cards){card.hidden=(group!=='all'&&card.dataset.group!==group)||!card.dataset.title.includes(search.value.trim().toLowerCase().replaceAll(' ','_'));if(!card.hidden)count++;}document.getElementById('count').textContent=count+' views';}for(const b of buttons)b.onclick=()=>{group=b.dataset.group;for(const other of buttons)other.setAttribute('aria-pressed',String(other===b));update();};search.oninput=update;for(const input of document.querySelectorAll('input[type=range]'))input.oninput=()=>{input.closest('figure').querySelector('.before').style.clipPath='inset(0 '+(100-input.value)+'% 0 0)';};update();
</script></body></html>`;
await writeFile(resolve(out, 'brush-review.html'), html);
console.log(
  JSON.stringify({ views: cards.length, captures: after.length * 3 + models.length * 2 }),
);
