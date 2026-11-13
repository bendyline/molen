#!/usr/bin/env node
// Reference material (scripts/reference-material.mjs) lives outside Git. reference-lock.json pins
// every file's bytes and the release archive that holds it; `fetch` restores them, all or one
// place at a time. No build, check or CI job needs them.
//
// Packing is incremental. Files are archived by place (geohash prefix), and an archive whose
// files are unchanged keeps pointing at the release that already holds it, so a new place
// uploads only its own references. Each archive therefore names its own release.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as tar from 'tar';
import { fileInfo, verifyArchive } from './asset-packs.mjs';
import { isReferenceMaterial, trackedReferenceMaterial } from './reference-material.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = 'reference-lock.json';
const FORMAT = 'molen/reference-bundle@1';
const OUTPUT = '.artifacts/reference-packs';
const RELEASE = /^references-[a-f0-9]{16}$/;
const ARCHIVE = /^references-[a-z0-9]+(?:-[a-z0-9]+)*-part-[0-9]{3,}\.tar$/;
const SHA = /^[a-f0-9]{64}$/;
const MAX_FILE = 512 * 1024 ** 2;
const MAX_ARCHIVE = 2 * 1024 ** 3 - 1;
const SKIP = new Set(['node_modules', 'dist', '.git', '.artifacts', '.tmp', 'shots', 'medium-fi']);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const same = (a, b) => a?.size === b?.size && a?.sha256 === b?.sha256;
const releaseName = (files) =>
  `references-${createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16)}`;

async function stat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function safePath(path) {
  if (
    !isReferenceMaterial(path) ||
    path
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          /[\\:<>"|?*]/.test(p) ||
          /[. ]$/.test(p) ||
          [...p].some((c) => c.charCodeAt(0) < 32) ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p),
      )
  )
    throw new Error(`Unsafe reference path: ${path}`);
}

async function localPath(root, path) {
  safePath(path);
  let current = resolve(root);
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await stat(current))?.isSymbolicLink())
      throw new Error(`Reference path is a symlink: ${current}`);
  }
  return current;
}

/** The archive family a file belongs to: its place's geohash cell, else its content area. */
export function referenceGroup(path) {
  const place = path.match(/^content\/worldgen\/source\/places\/([^/]+)\//);
  const parts = path.split('/');
  const label = place
    ? `places-${place[1]}`
    : parts.slice(1, Math.min(3, parts.length - 1)).join('-');
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'content'
  );
}

export function validateReferenceLock(lock) {
  if (
    lock?.format !== FORMAT ||
    !/^[\w.-]+\/[\w.-]+$/.test(lock.repository ?? '') ||
    !RELEASE.test(lock.release ?? '') ||
    !Array.isArray(lock.files) ||
    !lock.files.length ||
    !Array.isArray(lock.archives) ||
    !lock.archives.length
  )
    throw new Error('Invalid reference lock.');
  const paths = new Set();
  let previous = '';
  for (const file of lock.files) {
    safePath(file.path);
    if (
      paths.has(file.path.toLowerCase()) ||
      file.path <= previous ||
      !SHA.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > MAX_FILE
    )
      throw new Error(`Invalid reference file: ${file.path}`);
    previous = file.path;
    paths.add(file.path.toLowerCase());
  }
  if (lock.release !== releaseName(lock.files))
    throw new Error('Reference release does not match files.');
  const expected = new Set(lock.files.map((file) => file.path));
  const covered = new Set(),
    names = new Set();
  for (const archive of lock.archives) {
    const name = `${archive.release}/${archive.file}`;
    if (
      !ARCHIVE.test(archive.file ?? '') ||
      !RELEASE.test(archive.release ?? '') ||
      names.has(name) ||
      !SHA.test(archive.sha256) ||
      !Number.isSafeInteger(archive.size) ||
      archive.size < 1 ||
      archive.size > MAX_ARCHIVE ||
      !Array.isArray(archive.files) ||
      !archive.files.length
    )
      throw new Error(`Invalid reference archive: ${name}`);
    names.add(name);
    for (const path of archive.files) {
      if (!expected.has(path) || covered.has(path))
        throw new Error(`Invalid archive member: ${path}`);
      covered.add(path);
    }
  }
  if (covered.size !== expected.size)
    throw new Error('Reference archives do not cover every file.');
  return lock;
}

export async function readReferenceLock(root = ROOT) {
  const path = join(root, LOCK);
  return (await stat(path))
    ? validateReferenceLock(JSON.parse(await readFile(path, 'utf8')))
    : undefined;
}

/** Every reference file under content/ on disk, tracked or not. */
export async function referenceFiles(root) {
  const paths = [];
  async function walk(directory) {
    if (!(await stat(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const child = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Reference inventory does not follow symlinks: ${child}`);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) {
        const name = relative(root, child).split(sep).join('/');
        if (isReferenceMaterial(name)) paths.push(name);
      }
    }
  }
  await walk(join(root, 'content'));
  const files = [];
  for (const path of paths.sort())
    files.push({ path, ...(await fileInfo(await localPath(root, path))) });
  return files;
}

/** Files in archive-sized runs, by group, in path order. */
function chunks(files, budget) {
  const groups = new Map();
  for (const file of files) {
    const group = referenceGroup(file.path);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(file);
  }
  const result = [];
  for (const [group, entries] of [...groups].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let chunk = [],
      size = 0,
      index = 1;
    const flush = () => {
      if (chunk.length)
        result.push({
          file: `references-${group}-part-${String(index++).padStart(3, '0')}.tar`,
          files: chunk,
        });
      chunk = [];
      size = 0;
    };
    for (const file of entries) {
      if (size + file.size > budget) flush();
      chunk.push(file);
      size += file.size;
    }
    flush();
  }
  return result;
}

export async function packReferences({
  root = ROOT,
  outDir = join(root, OUTPUT),
  repository,
  budget = 256 * 1024 ** 2,
  prune = false,
  log = console.log,
} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 1024 ** 3)
    throw new Error('Invalid reference archive budget.');
  repository ??= JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8')).repository;
  const previous = await readReferenceLock(root);
  const files = await referenceFiles(root);
  const present = new Set(files.map((file) => file.path));
  const missing = (previous?.files ?? []).filter((file) => !present.has(file.path));
  // A partly restored checkout must not silently drop pinned references from the lock.
  if (missing.length && !prune)
    throw new Error(
      `${missing.length} pinned reference files are not on disk, e.g. ${missing[0].path}.\nRestore them (pnpm references:fetch), or pass --prune to remove them from the lock.`,
    );
  if (!files.length) throw new Error('No reference material found under content/.');
  const release = releaseName(files);
  const byPath = new Map(files.map((file) => [file.path, file]));
  const pinned = new Map((previous?.files ?? []).map((file) => [file.path, file]));
  const earlier = new Map((previous?.archives ?? []).map((archive) => [archive.file, archive]));
  const archives = [];
  let created = 0;
  for (const chunk of chunks(files, budget)) {
    const old = earlier.get(chunk.file);
    if (
      old &&
      old.files.length === chunk.files.length &&
      chunk.files.every(
        (file, i) => old.files[i] === file.path && same(pinned.get(file.path), file),
      )
    ) {
      archives.push(old);
      continue;
    }
    const directory = join(outDir, release);
    await mkdir(directory, { recursive: true });
    const path = join(directory, chunk.file),
      temporary = `${path}.${randomUUID()}.part`;
    try {
      const members = chunk.files.map((file) => file.path);
      // Photos, scans and PDFs are compressed already; a plain tar keeps packing fast.
      await tar.c(
        { cwd: root, file: temporary, portable: true, mtime: new Date(0), noDirRecurse: true },
        members,
      );
      const archive = { file: chunk.file, release, ...(await fileInfo(temporary)), files: members };
      await verifyArchive(temporary, archive, byPath);
      await rename(temporary, path);
      archives.push(archive);
      created++;
      log(`Packed ${chunk.file}: ${members.length} files.`);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const lock = validateReferenceLock({ format: FORMAT, repository, release, files, archives });
  if (created) await writeFile(join(outDir, release, LOCK), json(lock));
  await writeFile(join(root, LOCK), json(lock));
  const bytes = files.reduce((sum, file) => sum + file.size, 0);
  log(
    `Pinned ${files.length} reference files (${(bytes / 1024 ** 2).toFixed(0)} MiB) in ${archives.length} archives: ${created} new for ${release}, ${archives.length - created} unchanged.${missing.length ? ` Pruned ${missing.length}.` : ''}`,
  );
  if (created) log(`Publish the new archives: pnpm references:publish --target <commit SHA>`);
  return lock;
}

async function download(lock, archive, path, fetchImpl) {
  const url = `https://github.com/${lock.repository}/releases/download/${archive.release}/${archive.file}`;
  const temporary = `${path}.${randomUUID()}.part`;
  await mkdir(dirname(path), { recursive: true });
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`Reference download failed: HTTP ${response.status} ${url}`);
    let size = 0;
    await pipeline(
      Readable.fromWeb(response.body),
      new Transform({
        transform(chunk, _encoding, done) {
          size += chunk.length;
          done(
            size > archive.size ? new Error('Reference download exceeds its declared size.') : null,
            chunk,
          );
        },
      }),
      createWriteStream(temporary, { flags: 'wx' }),
    );
    if (!same(await fileInfo(temporary), archive))
      throw new Error(`Reference archive checksum mismatch: ${archive.release}/${archive.file}`);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function removeStage(stage, parent) {
  if (!resolve(stage).startsWith(`${resolve(parent)}${sep}`))
    throw new Error('Invalid reference staging path.');
  await rm(stage, { recursive: true, force: true });
}

/** Restore pinned references (those under `prefix`). Local edits stay unless `force`. */
export async function fetchReferences({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  offline = false,
  force = false,
  prefix = '',
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const lock = await readReferenceLock(root);
  if (!lock) throw new Error(`No ${LOCK}; nothing is pinned.`);
  const files = lock.files.filter((file) => file.path.startsWith(prefix));
  if (!files.length) throw new Error(`No references match prefix: ${prefix}`);
  const wanted = new Set();
  let preserved = 0;
  for (const file of files) {
    const path = await localPath(root, file.path);
    if (!(await stat(path))) wanted.add(file.path);
    else if (!same(await fileInfo(path), file)) {
      if (force) wanted.add(file.path);
      else preserved++;
    }
  }
  const byPath = new Map(lock.files.map((file) => [file.path, file]));
  const staging = join(root, OUTPUT, 'staging');
  await mkdir(staging, { recursive: true });
  let restored = 0;
  for (const archive of lock.archives) {
    const members = archive.files.filter((path) => wanted.has(path));
    if (!members.length) continue;
    const path = join(archiveDir, archive.release, archive.file);
    if (!(await stat(path)) || !same(await fileInfo(path), archive)) {
      if (offline) throw new Error(`Offline reference archive missing or corrupt: ${path}`);
      log(`Downloading ${archive.release}/${archive.file}`);
      await download(lock, archive, path, fetchImpl);
    }
    await verifyArchive(path, archive, byPath);
    const stage = await mkdtemp(join(staging, 'restore-'));
    try {
      const names = new Set(members);
      await tar.x({
        file: path,
        cwd: stage,
        strict: true,
        noMtime: true,
        filter: (name, entry) => names.has(name) && entry.type === 'File',
      });
      for (const name of members)
        if (!same(await fileInfo(join(stage, name)), byPath.get(name)))
          throw new Error(`Reference checksum mismatch: ${name}`);
      for (const name of members) {
        const destination = await localPath(root, name);
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.part`;
        try {
          await copyFile(join(stage, name), temporary);
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
        restored++;
      }
    } finally {
      await removeStage(stage, staging);
    }
  }
  log(`References: ${restored} restored, ${preserved} local edits kept (${files.length} pinned).`);
  return { restored, preserved };
}

/** Every pinned reference is on disk with its pinned bytes, and nothing on disk is unpinned. */
export async function checkReferences({ root = ROOT, log = console.log } = {}) {
  const lock = await readReferenceLock(root);
  if (!lock) throw new Error(`Missing ${LOCK}.`);
  const problems = [];
  for (const file of lock.files) {
    const path = await localPath(root, file.path);
    if (!(await stat(path))) problems.push(`Missing ${file.path}`);
    else if (!same(await fileInfo(path), file)) problems.push(`Changed ${file.path}`);
  }
  const pinned = new Set(lock.files.map((file) => file.path));
  for (const { path } of await referenceFiles(root))
    if (!pinned.has(path)) problems.push(`Unpinned ${path}`);
  if (problems.length)
    throw new Error(
      `${problems.slice(0, 40).join('\n')}${problems.length > 40 ? `\n… ${problems.length - 40} more` : ''}\nRestore with pnpm references:fetch, or pin local changes with pnpm references:pack.`,
    );
  log(`Verified ${lock.files.length} reference files (${lock.release}).`);
}

/**
 * Upload the archives this lock added (those in its own release) and the lock itself, after
 * checking that every older release it points at is published. Never replaces an attachment
 * outside a draft.
 */
export async function publishReferences({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing GitHub commit SHA>.');
  const lock = await readReferenceLock(root);
  if (!lock) throw new Error('Run references:pack first.');
  const { repository, release } = lock,
    directory = join(archiveDir, release);
  const gh =
    runGh ?? ((args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 8 * 1024 ** 2 }));
  const request = (args) => JSON.parse(gh(args));
  const releases = request([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repository}/releases?per_page=100`,
  ]).flat();
  const listAssets = (id) =>
    request([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/releases/${id}/assets?per_page=100`,
    ]).flat();
  // Archives kept from earlier locks must already be downloadable from their own releases.
  for (const older of new Set(
    lock.archives.map((a) => a.release).filter((name) => name !== release),
  )) {
    const found = releases.find((item) => item.tag_name === older && !item.draft);
    if (!found)
      throw new Error(`${older} is not published; publish the lock that created it first.`);
    const assets = listAssets(found.id);
    for (const archive of lock.archives.filter((a) => a.release === older)) {
      const asset = assets.find((item) => item.name === archive.file);
      if (asset?.size !== archive.size || asset.digest !== `sha256:${archive.sha256}`)
        throw new Error(`${older}/${archive.file} is missing or differs from the lock.`);
    }
  }
  const added = lock.archives.filter((archive) => archive.release === release);
  if (!added.length) {
    log(`Nothing new to publish: every archive is already in an earlier release.`);
    return release;
  }
  const lockPath = join(directory, LOCK);
  if (!same(await fileInfo(lockPath), await fileInfo(join(root, LOCK))))
    throw new Error('Packed reference lock differs from the checkout; run references:pack.');
  const byPath = new Map(lock.files.map((file) => [file.path, file]));
  for (const archive of added) await verifyArchive(join(directory, archive.file), archive, byPath);
  const uploads = [...added, { file: LOCK, ...(await fileInfo(lockPath)) }];
  let published = releases.find((item) => item.tag_name === release);
  if (!published) {
    const body = join(directory, 'release-request.json');
    await writeFile(
      body,
      json({
        tag_name: release,
        target_commitish: target,
        name: `Molen reference material ${release.slice(11)}`,
        draft: true,
        make_latest: 'false',
        body: `${added.reduce((n, a) => n + a.files.length, 0)} reference files in ${added.length} archives (of ${lock.files.length} pinned). Restore them with \`pnpm references:fetch\`.\n\n\`${LOCK}\` pins every file and the release holding its archive. These are research references, not build inputs or a software release.\n`,
      }),
    );
    published = request([
      'api',
      '--method',
      'POST',
      `repos/${repository}/releases`,
      '--input',
      body,
    ]);
  }
  const remote = listAssets(published.id);
  for (const file of uploads) {
    const existing = remote.find((asset) => asset.name === file.file);
    if (existing?.size === file.size && existing.digest === `sha256:${file.sha256}`) continue;
    if (existing || !published.draft)
      throw new Error(`Release attachment differs; refusing to replace it: ${file.file}`);
    log(`Uploading ${file.file}`);
    gh(['release', 'upload', release, join(directory, file.file), '--repo', repository]);
  }
  const uploaded = listAssets(published.id);
  for (const file of uploads) {
    const asset = uploaded.find((item) => item.name === file.file);
    if (asset?.size !== file.size || asset.digest !== `sha256:${file.sha256}`)
      throw new Error(`Uploaded reference checksum mismatch: ${file.file}`);
  }
  if (published.draft)
    gh(['release', 'edit', release, '--repo', repository, '--draft=false', '--latest=false']);
  log(`Published https://github.com/${repository}/releases/tag/${release}`);
  return release;
}

/**
 * Write the tracked reference files to a pathspec list and print the `git rm --cached` command
 * that untracks them (the files stay on disk). Refuses until every one is pinned.
 */
export async function untrackReferences({ root = ROOT, log = console.log } = {}) {
  const tracked = trackedReferenceMaterial(root);
  if (!tracked.length) {
    log('No reference material is tracked in Git.');
    return [];
  }
  const lock = await readReferenceLock(root);
  const pinned = new Map((lock?.files ?? []).map((file) => [file.path, file]));
  const unpinned = [];
  for (const path of tracked) {
    const local = await stat(await localPath(root, path));
    if (!pinned.has(path) || (local && !same(await fileInfo(join(root, path)), pinned.get(path))))
      unpinned.push(path);
  }
  if (unpinned.length)
    throw new Error(
      `${unpinned.length} tracked reference files are not pinned with their current bytes, e.g. ${unpinned[0]}; run pnpm references:pack first.`,
    );
  const list = join(root, OUTPUT, 'untrack.txt');
  await mkdir(dirname(list), { recursive: true });
  await writeFile(list, `${tracked.join('\n')}\n`);
  log(
    `${tracked.length} tracked reference files are pinned in ${LOCK}. Untrack them (the files stay on disk):\n  git rm --cached --quiet --pathspec-from-file=${relative(root, list).split(sep).join('/')}`,
  );
  return tracked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      'archive-dir': { type: 'string' },
      offline: { type: 'boolean' },
      force: { type: 'boolean' },
      prune: { type: 'boolean' },
      prefix: { type: 'string' },
      target: { type: 'string' },
    },
  });
  const root = resolve(values.root ?? ROOT);
  const options = {
    root,
    archiveDir: resolve(values['archive-dir'] ?? join(root, OUTPUT)),
    offline: values.offline,
    force: values.force,
    prune: values.prune,
    prefix: values.prefix,
    target: values.target,
  };
  const commands = {
    pack: () => packReferences({ ...options, outDir: options.archiveDir }),
    fetch: () => fetchReferences(options),
    check: () => checkReferences(options),
    publish: () => publishReferences(options),
    untrack: () => untrackReferences(options),
    key: async () => console.log((await readReferenceLock(root))?.release ?? 'none'),
  };
  Promise.resolve()
    .then(() => {
      if (positionals.length !== 1 || !Object.hasOwn(commands, positionals[0]))
        throw new Error(
          'Usage: node scripts/reference-packs.mjs pack|fetch|check|publish|untrack|key [options]',
        );
      return commands[positionals[0]]();
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
