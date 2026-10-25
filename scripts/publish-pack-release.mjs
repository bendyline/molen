#!/usr/bin/env node
// Publish Molen's runtime content packs — the `molen/pack@1` zips and their `molen/pack-index@1`
// index — as the assets of one rolling GitHub release, tag `packs`, so
//
//   npx molen pack fetch https://github.com/<repo>/releases/download/packs/index.json [ids…]
//
// installs any of them, the worldgen pack's landmark model archives included. molen.dev/packs
// carries only the core packs (GitHub Pages publishes at most 1 GB), and browsers read the unzipped
// copy at https://qualla.com/_a/ instead: release downloads send no CORS headers.
//
// Pack files are named by a hash of their bytes, so an unchanged pack is never uploaded again. A
// run uploads the packs the release lacks, then replaces index.json, then deletes the packs the
// new index no longer lists, so the published index never names a missing file. Every attachment's
// size and SHA-256 digest is checked against the local file before a new release is published.
// Release assets are flat, so a pack the build serves unzipped (`<id>/<version>/molen-pack.json`,
// see examples/world-explorer/scripts/build-entity-pack.mjs) is published as its zip, which the
// build keeps beside the index, and the release's index.json names that zip.
// The Release workflow runs this after building the docs site; `--dry-run` lists what would change.
//
// Usage: node scripts/publish-pack-release.mjs --target <commit sha> [--index <path>]
//          [--repo owner/name] [--tag packs] [--dry-run]

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_INDEX = join(ROOT, 'examples/world-explorer/public/packs/index.json');
const INDEX = 'index.json';
const MANIFEST = 'molen-pack.json';

const sha256File = (path) =>
  new Promise((resolvePromise, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolvePromise(hash.digest('hex')));
  });

/** A built pack zip's contentHash, read with the workspace's built pack package. */
async function packContentHash(path) {
  const { openFilePack } = await import('../packages/pack/dist/node.mjs');
  const pack = await openFilePack(path);
  try {
    return pack.manifest.contentHash;
  } finally {
    pack.close();
  }
}

async function inTempDir(use) {
  const dir = await mkdtemp(join(tmpdir(), 'molen-pack-release-'));
  try {
    return await use(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** The release's description: what it is and how to use it. */
function releaseNotes(repo, tag, target, count) {
  const url = `https://github.com/${repo}/releases/download/${tag}/${INDEX}`;
  return [
    `Molen's runtime content packs: ${count} \`molen/pack@1\` zips and the \`molen/pack-index@1\` index that lists them, from ${target}. Each Molen release replaces them.`,
    '',
    `Install them into a project with \`npx molen pack fetch ${url} [ids…]\` (all of them, landmark model archives included, is several GB; name the ids you need).`,
    '',
    "Browsers can't read these downloads directly: GitHub sends no CORS headers. Serve the packs from your own host, or read the unzipped copy at https://qualla.com/_a/index.json. https://molen.dev/packs/index.json lists the core packs only.",
    '',
  ].join('\n');
}

/**
 * The index entry of the zip beside the index that holds the same pack as an unzipped entry.
 * Several zips can hold it (a `MOLEN_PACK_COMPRESSION=store` build leaves one behind); any of them
 * is that pack, so the smallest is published.
 */
async function zippedEntry(dir, id, entry, contentHashOf) {
  const zips = [];
  for (const name of await readdir(dir)) {
    if (!name.startsWith(`${id}-`) || !/^[0-9a-f]{12}\.zip$/.test(name.slice(id.length + 1)))
      continue;
    if ((await contentHashOf(join(dir, name))) !== entry.contentHash) continue;
    zips.push({ name, size: (await stat(join(dir, name))).size });
  }
  zips.sort((a, b) => a.size - b.size || (a.name < b.name ? -1 : 1));
  if (zips.length === 0)
    throw new Error(
      `${id}: ${entry.file} is unzipped, and no ${id}-*.zip beside the index has its contentHash.`,
    );
  return { ...entry, file: zips[0].name, size: zips[0].size };
}

/** The pack files an index lists, checked against the files beside it, and the release's index. */
async function localFiles(indexPath, contentHashOf) {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  if (index?.format !== 'molen/pack-index@1' || typeof index.packs !== 'object')
    throw new Error(`${indexPath} is not a molen/pack-index@1 document.`);
  const dir = dirname(indexPath);
  const files = [];
  const packs = {};
  for (const [id, listed] of Object.entries(index.packs)) {
    const entry =
      typeof listed?.file === 'string' && listed.file.endsWith(`/${MANIFEST}`)
        ? await zippedEntry(dir, id, listed, contentHashOf)
        : listed;
    // Release assets are flat: a file must sit beside the index.
    if (typeof entry?.file !== 'string' || !/^[A-Za-z0-9._-]+$/.test(entry.file))
      throw new Error(`${id}: "${entry?.file}" is not a plain file name beside the index.`);
    const path = join(dir, entry.file);
    const size = (await stat(path).catch(() => undefined))?.size;
    if (size !== entry.size)
      throw new Error(
        `${id}: ${entry.file} is ${size ?? 'missing'}, the index says ${entry.size} bytes.`,
      );
    files.push({ name: entry.file, path, size, sha256: await sha256File(path) });
    packs[id] = entry;
  }
  const bytes = Buffer.from(`${JSON.stringify({ ...index, packs }, null, 2)}\n`);
  return {
    packs: files,
    index: {
      name: INDEX,
      bytes,
      size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  };
}

const matches = (asset, file) =>
  asset?.size === file.size && asset?.digest === `sha256:${file.sha256}`;

/** Publish the packs an index lists to the rolling release; returns what changed. */
export async function publishPackRelease({
  indexPath = DEFAULT_INDEX,
  repo,
  tag = 'packs',
  target,
  dryRun = false,
  runGh,
  contentHashOf = packContentHash,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error(
      'Publishing requires --target <the 40-character commit SHA the packs came from>.',
    );
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo ?? ''))
    throw new Error(`--repo must be owner/name, not ${repo}`);
  const gh =
    runGh ??
    ((args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 64 * 1024 ** 2,
      }));
  const { packs, index } = await localFiles(resolve(indexPath), contentHashOf);
  const notes = releaseNotes(repo, tag, target, packs.length);

  // List releases rather than treating arbitrary authentication/network failures as "not found".
  const releases = JSON.parse(
    gh(['api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`]),
  ).flat();
  let release = releases.find((r) => r.tag_name === tag);
  const listAssets = () =>
    release === undefined
      ? []
      : JSON.parse(
          gh([
            'api',
            '--paginate',
            '--slurp',
            `repos/${repo}/releases/${release.id}/assets?per_page=100`,
          ]),
        ).flat();
  const remote = listAssets();
  const uploads = packs.filter(
    (file) =>
      !matches(
        remote.find((a) => a.name === file.name),
        file,
      ),
  );
  const replaceIndex = !matches(
    remote.find((a) => a.name === INDEX),
    index,
  );
  const expected = new Set([...packs.map((f) => f.name), INDEX]);
  const stale = remote.filter((asset) => !expected.has(asset.name));
  log(
    `${tag}: ${packs.length} packs; ${uploads.length} to upload, ${packs.length - uploads.length} already there; ` +
      `index ${replaceIndex ? 'changes' : 'unchanged'}; ${stale.length} stale to delete`,
  );
  if (dryRun) {
    for (const file of uploads)
      log(`  would upload ${file.name} (${(file.size / 1e6).toFixed(1)} MB)`);
    for (const asset of stale) log(`  would delete ${asset.name}`);
    return { uploaded: [], deleted: [], created: false, dryRun: true };
  }

  let created = false;
  if (release === undefined) {
    release = await inTempDir(async (dir) => {
      const request = join(dir, 'release-request.json');
      await writeFile(
        request,
        JSON.stringify({
          tag_name: tag,
          target_commitish: target,
          name: 'Molen content packs',
          body: notes,
          draft: true,
          make_latest: 'false',
        }),
      );
      // Use the create response's ID: GitHub's release list can lag behind a new draft.
      return JSON.parse(
        gh(['api', '--method', 'POST', `repos/${repo}/releases`, '--input', request]),
      );
    });
    if (!release?.draft) throw new Error(`Could not create the draft ${tag} release.`);
    created = true;
  }

  for (const file of uploads) {
    const existing = remote.find((a) => a.name === file.name);
    // Same name, different bytes: an interrupted upload. Names are content hashes, so replace it.
    if (existing) gh(['api', '--method', 'DELETE', `repos/${repo}/releases/assets/${existing.id}`]);
    log(`Uploading ${file.name} (${(file.size / 1e6).toFixed(1)} MB)`);
    gh(['release', 'upload', tag, file.path, '--repo', repo]);
  }
  // The index goes up only once every pack it names is there.
  if (replaceIndex) {
    log(`Uploading ${INDEX}`);
    await inTempDir(async (dir) => {
      const path = join(dir, INDEX);
      await writeFile(path, index.bytes);
      gh(['release', 'upload', tag, path, '--repo', repo, '--clobber']);
    });
  }
  for (const asset of stale) {
    log(`Deleting ${asset.name}`);
    gh(['api', '--method', 'DELETE', `repos/${repo}/releases/assets/${asset.id}`]);
  }

  const published = listAssets();
  const extra = published.filter((a) => !expected.has(a.name)).map((a) => a.name);
  if (extra.length > 0) throw new Error(`${tag} has unexpected attachments: ${extra.join(', ')}`);
  for (const file of [...packs, index]) {
    if (
      !matches(
        published.find((a) => a.name === file.name),
        file,
      )
    )
      throw new Error(`Uploaded asset integrity check failed: ${file.name}`);
  }
  gh(['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest=false', '--notes', notes]);
  log(`Published https://github.com/${repo}/releases/tag/${tag}`);
  return {
    uploaded: uploads.map((f) => f.name),
    deleted: stale.map((a) => a.name),
    created,
    dryRun: false,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      index: { type: 'string' },
      repo: { type: 'string' },
      tag: { type: 'string' },
      target: { type: 'string' },
      'dry-run': { type: 'boolean' },
    },
  });
  await publishPackRelease({
    indexPath: values.index ?? DEFAULT_INDEX,
    repo: values.repo ?? process.env.GITHUB_REPOSITORY ?? 'bendyline/molen',
    tag: values.tag ?? 'packs',
    target: values.target,
    dryRun: values['dry-run'] ?? false,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
