#!/usr/bin/env node
// Find, inspect and add CC0 recordings for molen.sounds (in the engine repository).
//
//   node content/sounds/tools/survey.mjs fs <query> [--pages=2] [--min=4] [--max=900]
//   node content/sounds/tools/survey.mjs bsb <query>
//   node content/sounds/tools/survey.mjs show fs:<id> | bsb:<page-slug>
//   node content/sounds/tools/survey.mjs get fs:<id> | bsb:<page-slug> [origin-id] [--bytes=N]
//   node content/sounds/tools/survey.mjs add fs:<id> | bsb:<page-slug> [origin-id] [--bytes=N]
//   node content/sounds/tools/survey.mjs steady <origin-id> <seconds> [--from=S] [--to=S]
//   node content/sounds/tools/survey.mjs measure <origin-id>
//
// `fs` searches Freesound with the Creative Commons 0 filter; `bsb` searches BigSoundBank, whose
// recordings are all CC0. `show` prints what a choice needs: author, license, place, tags and the
// description, which is where a recording says whether it was made by the uploader. `add` reads
// the page again, refuses anything whose license block is not CC0 1.0, downloads the recording
// into .cache/<origin>/ (BigSoundBank's FLAC original; Freesound's high-quality preview, since the
// originals need an account), and writes the origin into sources.json with the page, author,
// license URL, today's date and the SHA-256 of the bytes. `get` downloads the same way without
// writing sources.json (safe to run several at once). `steady` names the start of the
// quietest-varying window of a downloaded clip, for a loop's `start`; `measure` prints its
// loudness over time and how bright it is, to tell a steady bed from a pass-by.
//
// Choosing is still a person's job: listen before a recording ships. Leave out recordings with
// music, intelligible speech, or a description that says the uploader did not make them.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache');
const sourcesPath = join(root, 'sources.json');
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const AGENT = 'molen-sounds-survey (sound pack curation)';

const [command, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(
  rest
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v] = a.slice(2).split('=');
      return [k, v ?? 'true'];
    }),
);
const args = rest.filter((a) => !a.startsWith('--'));

async function page(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (res.ok) return (await res.text()).replace(/\s+/g, ' ');
    if (attempt >= 2 || res.status === 404) throw new Error(`${url}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
}

const text = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
const attr = (html, name) => new RegExp(`${name}="([^"]*)"`).exec(html)?.[1];

// --- Freesound ---

async function freesoundSearch(query) {
  const pages = Number(flags.pages ?? 2);
  const min = Number(flags.min ?? 4);
  const max = Number(flags.max ?? 900);
  const seen = new Set();
  for (let p = 1; p <= pages; p++) {
    const url = `https://freesound.org/search/?q=${encodeURIComponent(query)}&f=license:%22Creative+Commons+0%22&page=${p}`;
    const html = await page(url);
    const results = html.split('<div class="bw-search__result"').slice(1);
    if (results.length === 0) break;
    for (const r of results) {
      const id = attr(r, 'data-sound-id');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const duration = Number(attr(r, 'data-duration') ?? 0);
      if (duration < min || duration > max) continue;
      const license = /title="License: ([^"]+)"/.exec(r)?.[1] ?? '?';
      if (license !== 'Creative Commons 0') continue;
      const snippet = text(/<p class="text-grey[^"]*"[^>]*>(.*?)<\/p>/.exec(r)?.[1] ?? '').slice(
        0,
        110,
      );
      console.log(
        [
          `fs:${id}`,
          `${duration.toFixed(0)}s`,
          `${Math.round(Number(attr(r, 'data-samplerate') ?? 0) / 1000)}k`,
          `dl ${attr(r, 'data-num-downloads') ?? '?'}`,
          attr(r, 'data-username'),
          text(attr(r, 'data-title') ?? ''),
          snippet,
        ].join(' | '),
      );
    }
  }
}

async function freesoundShow(id) {
  const html = await page(`https://freesound.org/s/${id}/`);
  const canonical = /<meta property="og:url" content="([^"]+)"/.exec(html)?.[1];
  const author = /<meta property="og:audio:artist" content="([^"]+)"/.exec(html)?.[1];
  const title = text(/<meta property="og:audio:title" content="([^"]+)"/.exec(html)?.[1] ?? '');
  const licenseHref = /title="Go to the full license text" href="([^"]+)"/.exec(html)?.[1] ?? '';
  const preview = /https:\/\/cdn\.freesound\.org\/previews\/[^"]+-hq\.mp3/.exec(html)?.[0];
  const geotag = /title="Geotag: ([^"]+)"/.exec(html)?.[1];
  const description = text(/<div id="soundDescriptionSection">(.*?)<\/div>/.exec(html)?.[1] ?? '');
  const tags = [...html.matchAll(/href="\/browse\/tags\/([^/"]+)\/"/g)].map((m) => m[1]);
  const duration = Number(/data-duration="([\d.]+)"/.exec(html)?.[1] ?? 0);
  return {
    site: 'freesound',
    id,
    title,
    author,
    page: canonical ?? `https://freesound.org/s/${id}/`,
    download: preview,
    cc0: /creativecommons\.org\/publicdomain\/zero\/1\.0/.test(licenseHref),
    license: licenseHref,
    duration,
    geotag,
    tags: [...new Set(tags)],
    description,
  };
}

// --- BigSoundBank ---

async function bigSoundBankSearch(query) {
  const html = await page(`https://bigsoundbank.com/search?q=${encodeURIComponent(query)}`);
  const seen = new Set();
  for (const m of html.matchAll(/href='\/([a-z0-9-]+-s(\d+))\.html'>([^<]+)</g)) {
    if (seen.has(m[2]) || m[3].startsWith('more')) continue;
    seen.add(m[2]);
    console.log(`bsb:${m[1]} | ${text(m[3])}`);
  }
}

async function bigSoundBankShow(slug) {
  const url = `https://bigsoundbank.com/${slug}.html`;
  const html = await page(url);
  const id = /-s(\d+)$/.exec(slug)?.[1];
  const license = text(
    /<h2 class='h_centree'[^>]*>License<\/h2><p[^>]*><strong>(.*?)<\/strong>/.exec(html)?.[1] ?? '',
  );
  const title = text(/<h1[^>]*>(.*?)<\/h1>/.exec(html)?.[1] ?? '');
  const author = text(
    /<strong>Author<\/strong>: (?:<a[^>]*>)?(.*?)(?:<\/a>)?<br>/.exec(html)?.[1] ?? '',
  );
  const description = text(/<meta name='description' content="([^"]*)"/.exec(html)?.[1] ?? '');
  const details = text(/<strong>Sound number<\/strong>.*?<\/p>/.exec(html)?.[0] ?? '');
  const times = [...html.matchAll(/>(\d+:\d\d)</g)].map((m) => m[1]);
  return {
    site: 'bigsoundbank',
    id,
    title,
    author,
    page: url,
    download: id ? `https://bigsoundbank.com/UPLOAD/flac/${id}.flac` : undefined,
    cc0: /^CC0 \(public domain\)/.test(license),
    license,
    duration: times.length ? times[times.length - 1] : undefined,
    description,
    details,
  };
}

async function show(ref) {
  const [site, id] = ref.split(':');
  if (site === 'fs') return freesoundShow(id);
  if (site === 'bsb') return bigSoundBankShow(id);
  throw new Error(`Unknown reference ${ref}; use fs:<id> or bsb:<page-slug>`);
}

async function get(ref, originId, bytes) {
  const info = await show(ref);
  if (!info.cc0) throw new Error(`${ref}: license is "${info.license}", not CC0 1.0`);
  if (!info.download) throw new Error(`${ref}: no download link on the page`);
  const id = originId ?? `${ref.startsWith('fs:') ? 'fs' : 'bsb'}-${info.id}`;
  const dir = join(cache, id);
  const headers = { 'User-Agent': AGENT, ...(bytes ? { Range: `bytes=0-${bytes - 1}` } : {}) };
  let res = await fetch(info.download, { headers });
  // Some BigSoundBank sounds have no FLAC upload; their MP3 is always there.
  if (res.status === 404 && info.site === 'bigsoundbank') {
    info.download = info.download
      .replace('/UPLOAD/flac/', '/UPLOAD/mp3/')
      .replace(/\.flac$/, '.mp3');
    res = await fetch(info.download, { headers });
  }
  if (!res.ok) throw new Error(`${info.download}: HTTP ${res.status}`);
  let data = Buffer.from(await res.arrayBuffer());
  if (bytes) data = data.subarray(0, bytes);
  const file = join(dir, decodeURIComponent(basename(new URL(info.download).pathname)));
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, data);
  writeFileSync(join(dir, '.fetched'), `${new Date().toISOString()}\n`);
  return { id, info, file, data };
}

async function add(ref, originId, bytes) {
  const { id, info, file, data } = await get(ref, originId, bytes);
  const sources = JSON.parse(readFileSync(sourcesPath, 'utf8'));
  sources.origins[id] = {
    site: info.site,
    title: info.title,
    author: info.author,
    page: info.page,
    download: info.download,
    ...(bytes ? { downloadBytes: bytes } : {}),
    license: 'CC0-1.0',
    licenseUrl: CC0,
    verified: new Date().toISOString().slice(0, 10),
    hash: `sha256:${createHash('sha256').update(data).digest('hex')}`,
  };
  writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
  console.log(JSON.stringify({ origin: id, file: basename(file), ...sources.origins[id] }));
}

function downloaded(originId) {
  const dir = join(cache, originId);
  const file = existsSync(dir) ? readdirSync(dir).find((f) => !f.startsWith('.')) : undefined;
  if (!file) throw new Error(`${originId}: nothing downloaded; run get first`);
  return { file, path: join(dir, file) };
}

/** Short-term loudness (LUFS) every 0.1 s. */
function loudnessCurve(path) {
  const r = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      path,
      '-af',
      'ebur128=metadata=1,ametadata=print:key=lavfi.r128.S:file=-',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  return [...r.stdout.matchAll(/pts_time:([\d.]+)\s+lavfi\.r128\.S=(-?[\d.]+|-?inf)/g)].map((m) => [
    Number(m[1]),
    m[2].endsWith('inf') ? -70 : Math.max(-70, Number(m[2])),
  ]);
}

/** Loudness every few seconds and the spectral centroid, to tell a steady bed from a pass-by. */
function measure(originId) {
  const { file, path } = downloaded(originId);
  const points = loudnessCurve(path);
  const end = points.length ? points[points.length - 1][0] : 0;
  const step = Math.max(2, Math.round(end / 30));
  const rows = [];
  for (let t = 0; t < end; t += step) {
    const w = points.filter(([x]) => x >= t && x < t + step).map(([, s]) => s);
    if (w.length) rows.push(`${t}s:${Math.round(w.reduce((a, b) => a + b, 0) / w.length)}`);
  }
  const stats = spawnSync(
    'ffmpeg',
    [
      '-hide_banner',
      '-nostdin',
      '-i',
      path,
      '-af',
      'aspectralstats=measure=centroid+flatness,ametadata=print:file=-',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 },
  );
  const centroids = [...stats.stdout.matchAll(/centroid=([\d.]+)/g)].map((m) => Number(m[1]));
  const flat = [...stats.stdout.matchAll(/flatness=([\d.]+)/g)].map((m) => Number(m[1]));
  const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
  console.log(
    JSON.stringify({
      origin: originId,
      file,
      length: Math.round(end * 10) / 10,
      centroidHz: Math.round(median(centroids)),
      flatness: Math.round(median(flat) * 1000) / 1000,
      loudness: rows.join(' '),
    }),
  );
}

/** Start (s) of the window whose short-term loudness varies least: a loop that will not pump. */
function steady(originId, seconds) {
  const { file, path } = downloaded(originId);
  const points = loudnessCurve(path);
  if (points.length === 0) throw new Error(`${originId}: ffmpeg measured nothing`);
  const end = points[points.length - 1][0];
  const from = Number(flags.from ?? 0.5);
  const to = Math.min(Number(flags.to ?? end), end);
  let best;
  for (let start = from; start + seconds <= to; start += 0.5) {
    const window = points.filter(([t]) => t >= start + 3 && t <= start + seconds).map(([, s]) => s);
    if (window.length < 4) continue;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const spread = Math.sqrt(window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length);
    const peak = Math.max(...window) - mean;
    const score = spread + 0.35 * Math.max(0, peak - 3);
    if (!best || score < best.score) best = { start, score, mean, spread, peak };
  }
  if (!best) throw new Error(`${originId}: shorter than ${seconds} s (${end.toFixed(1)} s)`);
  console.log(
    JSON.stringify({
      origin: originId,
      file,
      length: Math.round(end * 10) / 10,
      start: best.start,
      duration: seconds,
      loudness: Math.round(best.mean * 10) / 10,
      spreadLU: Math.round(best.spread * 100) / 100,
      peakAboveLU: Math.round(best.peak * 10) / 10,
    }),
  );
}

if (command === 'fs') await freesoundSearch(args.join(' '));
else if (command === 'bsb') await bigSoundBankSearch(args.join(' '));
else if (command === 'show')
  for (const ref of args) console.log(JSON.stringify(await show(ref), null, 1));
else if (command === 'get') {
  const { id, file } = await get(args[0], args[1], flags.bytes ? Number(flags.bytes) : undefined);
  console.log(JSON.stringify({ origin: id, file }));
} else if (command === 'add')
  await add(args[0], args[1], flags.bytes ? Number(flags.bytes) : undefined);
else if (command === 'steady') steady(args[0], Number(args[1] ?? 20));
else if (command === 'measure') measure(args[0]);
else {
  console.log(
    readFileSync(fileURLToPath(import.meta.url), 'utf8')
      .split('\n')
      .slice(1, 27)
      .join('\n'),
  );
  process.exitCode = command ? 1 : 0;
}
