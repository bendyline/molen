#!/usr/bin/env node
// Download every origin named in sources.json into .cache/<origin>/ (in the engine repository).
// Kenney packs and OpenGameArt files are fetched by URL; archives use Windows tar or POSIX unzip.
// Only CC0-1.0 origins are accepted: the pack is public domain end to end.
//
//   node content/sounds/tools/fetch.mjs [origin…]

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cache = join(root, '.cache');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const only = new Set(process.argv.slice(2));
const OGA_FILES = 'https://opengameart.org/sites/default/files/';

async function download(url, dest, maxBytes) {
  const res = await fetch(url, {
    redirect: 'follow',
    ...(maxBytes ? { headers: { Range: `bytes=0-${maxBytes - 1}` } } : {}),
  });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  mkdirSync(dirname(dest), { recursive: true });
  if (maxBytes) {
    const chunks = [];
    let size = 0;
    for await (const chunk of res.body) {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= maxBytes) break;
    }
    writeFileSync(dest, Buffer.concat(chunks).subarray(0, maxBytes));
  } else writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

for (const [id, origin] of Object.entries(sources.origins)) {
  if (only.size > 0 && !only.has(id)) continue;
  if (origin.license !== 'CC0-1.0')
    throw new Error(`${id}: only CC0-1.0 origins belong in molen.sounds`);
  const dir = join(cache, id);
  const stamp = join(dir, '.fetched');
  const pinnedFile = origin.download
    ? join(dir, decodeURIComponent(basename(new URL(origin.download).pathname)))
    : undefined;
  const matchesHash = () =>
    !origin.hash ||
    (pinnedFile &&
      existsSync(pinnedFile) &&
      `sha256:${createHash('sha256').update(readFileSync(pinnedFile)).digest('hex')}` ===
        origin.hash);
  if (existsSync(stamp) && matchesHash()) {
    console.log(`= ${id}`);
    continue;
  }
  const urls = origin.download
    ? [origin.download]
    : origin.files.map((f) => OGA_FILES + encodeURIComponent(f).replace(/%2F/g, '/'));
  for (const url of urls) {
    const file = join(dir, decodeURIComponent(basename(new URL(url).pathname)));
    await download(url, file, origin.downloadBytes);
    if (file.endsWith('.zip')) {
      if (process.platform === 'win32') execFileSync('tar', ['-xf', file, '-C', dir]);
      else execFileSync('unzip', ['-q', '-o', file, '-d', dir]);
    }
  }
  if (!matchesHash())
    throw new Error(`${id}: downloaded bytes do not match the verified source hash`);
  writeFileSync(stamp, `${new Date().toISOString()}\n`);
  console.log(`✓ ${id} (${origin.title}, ${origin.author}, ${origin.license})`);
}
