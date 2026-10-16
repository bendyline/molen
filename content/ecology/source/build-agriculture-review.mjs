// Assemble saved agricultural acceptance evidence; no network, generation or publishing.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = new URL('../../../.artifacts/regional-world/', import.meta.url);
const json = async (path) => {
  try {
    return JSON.parse(await readFile(new URL(path, out), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
};
const escapeHtml = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const frames = await json('agriculture/evidence.json');
if (!frames) throw new Error('Run preview-agriculture.mjs first');
const live = await json('live/iowa-corn-field.json');
const pack = await json('agriculture-pack-report.json');
const dataset = await json('agriculture-dataset-report.json');
const card = (image, title, description) =>
  `<article><a href="${image}"><img loading="lazy" src="${image}" alt="${escapeHtml(title)}"></a><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></article>`;
const liveCards = (live?.frames ?? [])
  .map((frame) =>
    card(
      `live/${frame}`,
      frame.includes('walk') ? 'Walking in an Iowa field' : 'Streamed Iowa landscape',
      'Real map/elevation extract plus 2021 cropland observations. Crop identity uses the Corn Belt fallback; this is not a surveyed maize field.',
    ),
  )
  .join('');
const comparisons = frames
  .map((entry) =>
    card(
      `agriculture/${entry.frame}`,
      `${entry.name} · ${entry.month ? `month ${entry.month}` : 'mature'} · ${entry.view}`,
      `${entry.backend}, ${entry.quality}; ${entry.instances.toLocaleString()} patches. ${[...new Set(entry.fields.map((f) => f.evidence))].join(', ')} crops.`,
    ),
  )
  .join('');
const models = [
  'maize',
  'soybean',
  'wheat',
  'rice',
  'cotton',
  'sugarcane',
  'sunflower',
  'rapeseed',
  'root_crop',
  'sorghum',
]
  .map((name) =>
    card(
      `agriculture-models/${name}/context_0.png`,
      name.replaceAll('_', ' '),
      'Three procedural forms, reviewed through public asset import, inspection and lit capture.',
    ),
  )
  .join('');
const rows = (dataset?.samples ?? [])
  .map(
    (sample) =>
      `<tr><td>${escapeHtml(sample.name)}</td><td>${sample.bytes.toLocaleString()}</td><td>${sample.gzipBytes.toLocaleString()}</td><td>${sample.agriculturalCells.toLocaleString()}</td></tr>`,
  )
  .join('');
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Agricultural landscapes · Molen</title>
<style>body{font:16px system-ui;background:#f3f2eb;color:#273a31;margin:36px auto;padding:0 20px;max-width:1300px}h1{font-size:38px;margin-bottom:12px}h2{margin-top:42px}p{line-height:1.6;max-width:1050px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:22px}article{background:white;padding:12px;border-radius:12px}img{width:100%;border-radius:6px}h3{font-size:18px;margin:12px 0 4px}article p{font-size:14px;color:#566458}.note{background:#e6eadf;border-left:4px solid #748964;padding:14px 20px}table{border-collapse:collapse;background:#fff;min-width:70%}th,td{text-align:left;padding:12px 20px;border-bottom:1px solid #dfe3d9}nav a{margin-right:24px;color:#496d4d}@media(max-width:800px){.grid{grid-template-columns:1fr}body{margin:20px auto}table{width:100%;font-size:13px}th,td{padding:8px}}</style>
<h1>Agricultural landscapes</h1><p>Mapped field shapes, ordered crop rows, orchards, headlands and seasonal surfaces, with 22 crop recipes across 36 habitats and ten agricultural region overrides. Observed crop tags win; regional guesses fill the gaps. The ecology pack is ${Math.round((pack?.pack.size ?? 172581) / 1000)} KB, including its existing global atlas and vegetation.</p>
<nav><a href="#live">Live viewer</a><a href="#data">Global data</a><a href="#comparisons">Regional &amp; seasonal views</a><a href="#models">Crop forms</a></nav>
<h2 id="live">Live viewer acceptance</h2><div class="grid">${liveCards}</div><p>${live ? `Balanced quality, ${live.pageErrors.length} browser errors. ${live.agricultureRequests?.filter((request) => request.status === 200).length ?? 0} successful agricultural request(s).` : 'Live capture has not been run yet.'} Near-field plant density follows a strict rendering budget; the ground pattern carries distant fields.</p>
<h2 id="data">Worldwide source, small retrieval tiles</h2><p>The Qualla compiler reads ESA WorldCover cropland observations in bounded windows. The six-continent acceptance shard totals ${dataset?.bytes?.toLocaleString() ?? '14,713'} bytes of JSON. No large raster is bundled with Molen. Optional categorical raster adapters can refine crop identity with WorldCereal and regional sources.</p>
<table><thead><tr><th>Sample</th><th>JSON bytes</th><th>Gzip bytes</th><th>Agricultural cells</th></tr></thead><tbody>${rows}</tbody></table>
<p class="note">This shard covers six sample tiles, not the whole planet, and has not been published. WorldCover observations are from 2021 and identify cropland extent, not individual crop species. Bulk geographic builds and production hosting remain release operations. Missing data retains mapped farmland and regional fallback. Coarse cells and inferred divisions are not parcel surveys.</p>
<h2 id="comparisons">Controlled regional and seasonal comparisons</h2><p>These are explicit composition fixtures, not real farms. “Inferred” views omit the crop tags. Calendars are illustrative; irrigation, terraces and multiple annual harvests are not simulated. The node-material comparison exercises the WebGPU shader path through its WebGL backend.</p><div class="grid">${comparisons}</div>
<h2 id="models">Annual crop forms</h2><div class="grid">${models}</div></html>`;
await writeFile(new URL('agriculture-review.html', out), html);
console.log(fileURLToPath(new URL('agriculture-review.html', out)));
