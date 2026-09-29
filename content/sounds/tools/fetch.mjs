#!/usr/bin/env node
// Download every origin named in sources.json into .cache/<origin>/ (in the engine repository).
// Kenney packs and OpenGameArt files are fetched by URL; archives are unpacked with `unzip`.
// Only CC0-1.0 origins are accepted: the pack is public domain end to end.
//
//   node content/sounds/tools/fetch.mjs [origin…]

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const only = new Set(process.argv.slice(2));
const OGA_FILES = 'https://opengameart.org/sites/default/files/';

async function download(url, dest) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

for (const [id, origin] of Object.entries(sources.origins)) {
  if (only.size > 0 && !only.has(id)) continue;
  if (origin.license !== 'CC0-1.0')
    throw new Error(`${id}: only CC0-1.0 origins belong in molen.sounds`);
  const dir = join(cache, id);
  const stamp = join(dir, '.fetched');
  if (existsSync(stamp)) {
    console.log(`= ${id}`);
    continue;
  }
  const urls = origin.download
    ? [origin.download]
    : origin.files.map((f) => OGA_FILES + encodeURIComponent(f).replace(/%2F/g, '/'));
  for (const url of urls) {
    const file = join(dir, decodeURIComponent(basename(new URL(url).pathname)));
    await download(url, file);
    if (file.endsWith('.zip')) execFileSync('unzip', ['-q', '-o', file, '-d', dir]);
  }
  writeFileSync(stamp, `${new Date().toISOString()}\n`);
  console.log(`✓ ${id} (${origin.title}, ${origin.author}, ${origin.license})`);
}
