#!/usr/bin/env node
// Repository GLB snapshots. Every GLB pinned by asset-lock.json is a build output of checked-in
// source (scripts/build-assets.mjs). The Assets workflow builds them from a clean checkout and
// publishes the snapshot as a GitHub release; `fetch` restores that release as a download cache
// and falls back to building from source when the snapshot is not published yet. These archives
// restore repository build inputs; the molen/pack@1 pipeline still builds the runtime packs.
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
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
import { availableParallelism } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as tar from 'tar';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = 'asset-lock.json';
const LOCK_FORMAT = 'molen/asset-lock@2';
const RELEASE_MANIFEST = 'asset-manifest.json';
const RELEASE_FORMAT = 'molen/asset-release@1';
const NOTICES = 'ASSET-NOTICES.txt';
const OUTPUT = '.artifacts/asset-packs';
// Content hashes of GLBs this tool installed; a local GLB matching its entry is safe to replace.
const INSTALLED = 'installed.json';
export const ASSET_ROOTS = ['content', 'assets', 'examples'];
const SKIP = new Set([
  'node_modules',
  'dist',
  'dist-types',
  '.git',
  '.artifacts',
  '.tmp',
  'test-results',
  '__output__',
  '__goldens__',
  'packs',
]);
const SHA = /^[a-f0-9]{64}$/;
const MAX_FILE = 1024 ** 3;
const MAX_ARCHIVE = 2 * 1024 ** 3 - 1;
const ARCHIVE_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*-part-[0-9]{3,}\.tar\.gz$/;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => a?.size === b.size && a?.sha256 === b.sha256;
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** The release for a lock is not on GitHub yet; the caller may build from source instead. */
export class ReleaseMissingError extends Error {}

async function maybeStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function safePath(path) {
  if (
    typeof path !== 'string' ||
    !ASSET_ROOTS.includes(path.split('/')[0]) ||
    !path.endsWith('.glb') ||
    path
      .split('/')
      .some(
        (p) =>
          !p ||
          p === '.' ||
          p === '..' ||
          /[\\:<>"|?*]/.test(p) ||
          [...p].some((character) => character.charCodeAt(0) < 32) ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p),
      )
  ) {
    throw new Error(`Unsafe asset path: ${path}`);
  }
}

// Check every ancestor, including an existing destination; never hydrate through links.
export async function localPath(root, path) {
  safePath(path);
  let current = resolve(root);
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await maybeStat(current))?.isSymbolicLink())
      throw new Error(`Asset path is a symlink: ${current}`);
  }
  return current;
}

export async function fileInfo(path) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { size, sha256: hash.digest('hex') };
}

export async function inventory(root = ROOT) {
  const paths = [];
  async function walk(directory) {
    if (!(await maybeStat(directory))) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Asset inventory does not follow symlinks: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb'))
        paths.push(relative(root, path).split(sep).join('/'));
    }
  }
  for (const directory of ASSET_ROOTS) await walk(join(root, directory));
  return paths.sort();
}

/** Committed binary masters: authored GLBs with no generator. They live in Git, not the lock. */
export async function readMasters(root = ROOT) {
  const plan = JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8'));
  if (!Array.isArray(plan.masters)) throw new Error('asset-build.json must list its masters.');
  for (const path of plan.masters) safePath(path);
  return new Set(plan.masters);
}

// ---------------------------------------------------------------------------------------------
// asset-lock.json: the exact bytes the checked-in source builds to. Nothing in it depends on
// archive bytes, so a lock can be committed before its release exists and CI can publish it.

export function snapshotOf(files) {
  return digest(JSON.stringify(files.map((f) => [f.path, f.size, f.sha256])));
}

export function createLock(files, repository = 'bendyline/molen') {
  const sorted = files.map(({ path, size, sha256 }) => ({ path, size, sha256 })).sort(byPath);
  const snapshot = snapshotOf(sorted);
  return validateLock({
    format: LOCK_FORMAT,
    repository,
    release: `assets-${snapshot.slice(0, 16)}`,
    snapshot,
    files: sorted,
  });
}

export function validateLock(lock) {
  if (
    lock?.format !== LOCK_FORMAT ||
    !/^[\w.-]+\/[\w.-]+$/.test(lock.repository) ||
    !/^assets-[a-f0-9]{16}$/.test(lock.release) ||
    !SHA.test(lock.snapshot) ||
    !Array.isArray(lock.files) ||
    !lock.files.length
  )
    throw new Error(`Invalid ${LOCK}; rebuild it with pnpm assets:build --update-lock.`);
  const seen = new Set();
  let previous;
  for (const file of lock.files) {
    safePath(file.path);
    const key = file.path.toLowerCase();
    if (
      seen.has(key) ||
      !SHA.test(file.sha256) ||
      !Number.isSafeInteger(file.size) ||
      file.size < 1 ||
      file.size > MAX_FILE
    )
      throw new Error(`Invalid or duplicate asset: ${file.path}`);
    if (previous !== undefined && previous >= file.path)
      throw new Error(`${LOCK} is not sorted by path at ${file.path}`);
    seen.add(key);
    previous = file.path;
  }
  const snapshot = snapshotOf(lock.files);
  if (snapshot !== lock.snapshot || lock.release !== `assets-${snapshot.slice(0, 16)}`)
    throw new Error(`${LOCK} snapshot does not match its files.`);
  return lock;
}

export async function readLock(root = ROOT) {
  return validateLock(JSON.parse(await readFile(join(root, LOCK), 'utf8')));
}

export async function writeLock(root, lock) {
  await writeFile(join(root, LOCK), json(validateLock(lock)));
}

// ---------------------------------------------------------------------------------------------
// asset-manifest.json: a release attachment describing its archives. Every file it names must be
// exactly the lock's set; member bytes are checked against the committed lock, never the manifest.

export function validateReleaseManifest(manifest, lock) {
  if (
    manifest?.format !== RELEASE_FORMAT ||
    manifest.repository !== lock.repository ||
    manifest.release !== lock.release ||
    manifest.snapshot !== lock.snapshot ||
    !Array.isArray(manifest.archives) ||
    !manifest.archives.length ||
    manifest.archives.length > 990
  )
    throw new Error(`Release manifest does not describe ${lock.release}.`);
  if (
    manifest.notices?.file !== NOTICES ||
    !SHA.test(manifest.notices.sha256) ||
    !Number.isSafeInteger(manifest.notices.size)
  )
    throw new Error('Missing asset license notices.');
  const sizes = new Map(lock.files.map((f) => [f.path, f.size]));
  const covered = new Set();
  const names = new Set();
  for (const archive of manifest.archives) {
    if (
      !ARCHIVE_NAME.test(archive.file) ||
      names.has(archive.file) ||
      !SHA.test(archive.sha256) ||
      !Number.isSafeInteger(archive.size) ||
      archive.size < 1 ||
      archive.size > MAX_ARCHIVE ||
      !Array.isArray(archive.files) ||
      !archive.files.length
    )
      throw new Error(`Invalid archive: ${archive.file}`);
    names.add(archive.file);
    let expanded = 0;
    for (const path of archive.files) {
      if (!sizes.has(path) || covered.has(path))
        throw new Error(`Release archive ${archive.file} lists an unexpected asset: ${path}`);
      covered.add(path);
      expanded += sizes.get(path);
    }
    if (expanded > MAX_FILE) throw new Error(`Archive expands beyond 1 GiB: ${archive.file}`);
  }
  if (covered.size !== sizes.size)
    throw new Error(`Release ${lock.release} is missing ${sizes.size - covered.size} assets.`);
  return manifest;
}

export function groups(files, budget) {
  const buckets = new Map();
  for (const file of files) {
    const parts = file.path.split('/');
    const place = file.path.match(/^content\/worldgen\/(assets|source)\/places\/([^/]+)\//);
    const role = parts[2] === 'assets' ? 'models' : parts[2] === 'source' ? 'sources' : parts[2];
    const label = place
      ? `worldgen-${role}-${place[2]}`
      : parts[0] === 'content'
        ? `${parts[1]}-${parts[3] === 'reusable' ? 'reusable-' : ''}${role}`
        : parts[0] === 'examples'
          ? `${parts[1]}-${parts[2] === 'asset-src' ? 'sources' : parts[2] === 'public' ? 'models' : parts[2]}`
          : parts.slice(0, Math.min(3, parts.length - 1)).join('-');
    const key = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(file);
  }
  const result = [];
  for (const [key, entries] of [...buckets].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    let chunk = [],
      size = 0,
      index = 1;
    const flush = () => {
      if (chunk.length)
        result.push({ key: `${key}-part-${String(index++).padStart(3, '0')}`, files: chunk });
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

// Public names repeat between releases. Keep exact archive versions isolated locally.
export function archivePath(directory, archive) {
  return join(directory, archive.sha256, archive.file);
}

async function findArchive(directory, archive) {
  // Also accept manually downloaded release attachments in a flat directory.
  for (const path of [archivePath(directory, archive), join(directory, archive.file)]) {
    if ((await maybeStat(path))?.isFile() && same(await fileInfo(path), archive)) return path;
  }
}

/** Check an archive's own hash, then every member against the committed lock. */
export async function verifyArchive(path, archive, lockFiles) {
  if (!same(await fileInfo(path), archive))
    throw new Error(`Archive checksum mismatch: ${archive.file}`);
  const expected = new Map(archive.files.map((p) => [p, lockFiles.get(p)]));
  const seen = new Set();
  const errors = [];
  await tar.t({
    file: path,
    strict: true,
    onReadEntry(entry) {
      const file = expected.get(entry.path);
      if (!file || entry.type !== 'File' || entry.size !== file.size || seen.has(entry.path)) {
        errors.push(`Unexpected archive entry: ${entry.path} (${entry.type})`);
        return;
      }
      seen.add(entry.path);
      const hash = createHash('sha256');
      let size = 0;
      entry.on('data', (bytes) => {
        hash.update(bytes);
        size += bytes.length;
      });
      entry.on('end', () => {
        if (size !== file.size || hash.digest('hex') !== file.sha256)
          errors.push(`Asset checksum mismatch: ${entry.path}`);
      });
    },
  });
  if (seen.size !== expected.size) errors.push('Archive has missing files.');
  if (errors.length) throw new Error(errors.join('\n'));
}

async function pool(items, concurrency, work) {
  const queue = [...items];
  const results = [];
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, async () => {
      while (queue.length) results.push(await work(queue.shift()));
    }),
  );
  return results;
}

export async function readInstalled(root) {
  try {
    return JSON.parse(await readFile(join(root, OUTPUT, INSTALLED), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

/** Record GLBs whose bytes came from this tooling (a release or a build that matched the lock). */
export async function recordInstalled(root, files) {
  const installed = await readInstalled(root);
  for (const file of files) installed[file.path] = file.sha256;
  await mkdir(join(root, OUTPUT), { recursive: true });
  await writeFile(join(root, OUTPUT, INSTALLED), json(installed));
}

/** Archive the locked GLBs, exactly as they are on disk, as a publishable release. */
export async function packAssets({
  root = ROOT,
  outDir = join(root, OUTPUT),
  budget = 256 * 1024 ** 2,
  concurrency = Math.min(4, availableParallelism()),
  log = console.log,
} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > MAX_FILE)
    throw new Error('Invalid archive budget.');
  const lock = await readLock(root);
  await checkAssets({ root, lock, log: () => {} });
  const lockFiles = new Map(lock.files.map((f) => [f.path, f]));
  await mkdir(outDir, { recursive: true });
  const archives = await pool(groups(lock.files, budget), concurrency, async (group) => {
    const file = `${group.key}.tar.gz`;
    const temporary = join(outDir, `${randomUUID()}.part`);
    try {
      await tar.c(
        {
          file: temporary,
          cwd: root,
          gzip: { level: 6 },
          portable: true,
          noMtime: true,
          follow: false,
          noDirRecurse: true,
          onWriteEntry(entry) {
            entry.stat.mode = 0o644;
          },
        },
        group.files.map((f) => f.path),
      );
      const archive = {
        file,
        ...(await fileInfo(temporary)),
        files: group.files.map((f) => f.path),
      };
      await verifyArchive(temporary, archive, lockFiles);
      const destination = archivePath(outDir, archive);
      await mkdir(dirname(destination), { recursive: true });
      await rename(temporary, destination);
      log(
        `Packed ${file}: ${group.files.length} GLBs, ${(archive.size / 1024 ** 2).toFixed(1)} MiB`,
      );
      return archive;
    } finally {
      await rm(temporary, { force: true });
    }
  });
  archives.sort((a, b) => (a.file < b.file ? -1 : 1));
  const releaseDir = join(outDir, lock.release);
  await mkdir(releaseDir, { recursive: true });
  const notices = [];
  for (const path of ['LICENSE', 'content/worldgen/NOTICE.md', 'content/entities/NOTICE.md']) {
    if (await maybeStat(join(root, path)))
      notices.push(`--- ${path} ---\n${await readFile(join(root, path), 'utf8')}`);
  }
  if (!notices.length) throw new Error('No asset license notices found.');
  await writeFile(join(releaseDir, NOTICES), notices.join('\n\n'));
  const manifest = validateReleaseManifest(
    {
      format: RELEASE_FORMAT,
      repository: lock.repository,
      release: lock.release,
      snapshot: lock.snapshot,
      notices: { file: NOTICES, ...(await fileInfo(join(releaseDir, NOTICES))) },
      archives,
    },
    lock,
  );
  await writeFile(join(releaseDir, RELEASE_MANIFEST), json(manifest));
  log(`${lock.files.length} GLBs in ${archives.length} archives for release ${lock.release}`);
  return manifest;
}

export async function checkAssets({ root = ROOT, lock, prefix = '', log = console.log } = {}) {
  lock ??= await readLock(root);
  validateLock(lock);
  const files = lock.files.filter((f) => f.path.startsWith(prefix));
  if (!files.length) throw new Error(`No assets match prefix: ${prefix}`);
  const errors = [];
  for (const file of files) {
    const path = await localPath(root, file.path);
    if (!(await maybeStat(path)))
      errors.push(`Missing ${file.path}; run pnpm assets:fetch (or pnpm assets:build).`);
    else if (!same(await fileInfo(path), file))
      errors.push(
        `Changed ${file.path}; rebuild with pnpm assets:build, and --update-lock to accept it.`,
      );
  }
  const registered = new Set(lock.files.map((f) => f.path));
  const masters = await readMasters(root);
  for (const path of await inventory(root))
    if (path.startsWith(prefix) && !registered.has(path) && !masters.has(path))
      errors.push(`Unlocked GLB: ${path}; build it from source, or list an authored master.`);
  if (errors.length) throw new Error(errors.join('\n'));
  log(`Verified ${files.length} GLBs against ${lock.release}.`);
  return files.length;
}

async function download(url, path, expected, fetchImpl) {
  const temporary = `${path}.${randomUUID()}.part`;
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`Asset download failed: HTTP ${response.status} ${url}`);
    let count = 0;
    await pipeline(
      Readable.fromWeb(response.body),
      new Transform({
        transform(chunk, _encoding, done) {
          count += chunk.length;
          done(
            count > expected.size ? new Error('Asset download exceeds its declared size.') : null,
            chunk,
          );
        },
      }),
      createWriteStream(temporary, { flags: 'wx' }),
    );
    if (!same(await fileInfo(temporary), expected))
      throw new Error(`Archive checksum mismatch: ${url}`);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

const releaseUrl = (lock, file) =>
  `https://github.com/${lock.repository}/releases/download/${lock.release}/${file}`;

async function releaseManifest(lock, archiveDir, offline, fetchImpl) {
  // The published manifest is cached apart from a local `pack`: archives are not byte-reproducible,
  // so a local packing only stands in for the release when working offline.
  const cached = join(archiveDir, 'published', `${lock.release}.json`);
  const packed = join(archiveDir, lock.release, RELEASE_MANIFEST);
  for (const path of offline ? [cached, packed] : [cached]) {
    if (await maybeStat(path))
      return validateReleaseManifest(JSON.parse(await readFile(path, 'utf8')), lock);
  }
  if (offline)
    throw new ReleaseMissingError(`Offline and ${lock.release} is not cached in ${archiveDir}.`);
  const response = await fetchImpl(releaseUrl(lock, RELEASE_MANIFEST), {
    signal: AbortSignal.timeout(60_000),
  });
  if (response.status === 404)
    throw new ReleaseMissingError(
      `Release ${lock.release} is not published yet. The Assets workflow publishes it once this asset-lock.json reaches main.`,
    );
  if (!response.ok) throw new Error(`Release manifest download failed: HTTP ${response.status}`);
  const text = await response.text();
  const manifest = validateReleaseManifest(JSON.parse(text), lock);
  await mkdir(dirname(cached), { recursive: true });
  await writeFile(cached, text);
  return manifest;
}

async function removeStage(path, parent) {
  if (!resolve(path).startsWith(`${resolve(parent)}${sep}`))
    throw new Error('Invalid staging cleanup path.');
  await rm(path, { recursive: true, force: true });
}

export async function fetchAssets({
  root = ROOT,
  lock,
  archiveDir = join(root, OUTPUT),
  offline = false,
  force = false,
  prefix = '',
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  lock ??= await readLock(root);
  validateLock(lock);
  const lockFiles = new Map(lock.files.map((f) => [f.path, f]));
  const installed = await readInstalled(root);
  const wanted = [];
  const conflicts = [];
  let selected = 0;
  for (const file of lock.files.filter((f) => f.path.startsWith(prefix))) {
    selected++;
    const path = await localPath(root, file.path);
    if (!(await maybeStat(path))) {
      wanted.push(file);
      continue;
    }
    const info = await fileInfo(path);
    if (same(info, file)) continue;
    // A GLB this tooling installed is a stale build output; anything else is local work.
    if (force || installed[file.path] === info.sha256) wanted.push(file);
    else conflicts.push(file.path);
  }
  if (!selected) throw new Error(`No assets match prefix: ${prefix}`);
  if (conflicts.length)
    throw new Error(
      `Refusing to overwrite locally built GLBs that differ from ${LOCK}:\n${conflicts.join('\n')}\nRebuild them with pnpm assets:build, or pass --force to restore the pinned versions.`,
    );
  if (!wanted.length) {
    log(`Ready: ${selected} pinned GLBs (nothing to restore).`);
    return selected;
  }
  const manifest = await releaseManifest(lock, archiveDir, offline, fetchImpl);
  const needed = new Set(wanted.map((f) => f.path));
  const staging = join(root, OUTPUT, 'staging');
  await mkdir(staging, { recursive: true });
  let restored = 0;
  for (const archive of manifest.archives) {
    const files = archive.files.filter((path) => needed.has(path)).map((p) => lockFiles.get(p));
    if (!files.length) continue;
    let path = await findArchive(archiveDir, archive);
    if (!path) {
      if (offline) throw new Error(`Offline archive missing or corrupt: ${archive.file}`);
      log(`Downloading ${archive.file}`);
      path = archivePath(archiveDir, archive);
      await mkdir(dirname(path), { recursive: true });
      await download(releaseUrl(lock, archive.file), path, archive, fetchImpl);
    }
    await verifyArchive(path, archive, lockFiles);
    const stage = await mkdtemp(join(staging, 'restore-'));
    try {
      const members = new Set(files.map((f) => f.path));
      await tar.x({
        file: path,
        cwd: stage,
        strict: true,
        noMtime: true,
        filter: (name, entry) => members.has(name) && entry.type === 'File',
      });
      for (const file of files) {
        if (!same(await fileInfo(join(stage, file.path)), file))
          throw new Error(`Extracted checksum mismatch: ${file.path}`);
      }
      for (const file of files) {
        const destination = await localPath(root, file.path);
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.part`;
        try {
          await copyFile(join(stage, file.path), temporary);
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      await recordInstalled(root, files);
      restored += files.length;
      log(`Restored ${files.length} GLBs from ${archive.file}`);
    } finally {
      await removeStage(stage, staging);
    }
  }
  log(`Ready: ${selected} pinned GLBs (${restored} restored from ${lock.release}).`);
  return selected;
}

/**
 * Publish the lock's snapshot as the immutable release it names, packing the local GLBs first.
 * An already published snapshot is left alone: its archives were verified when they went up.
 */
export async function publishAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing 40-character GitHub commit SHA>.');
  const lock = await readLock(root);
  const gh =
    runGh ??
    ((args) =>
      execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 8 * 1024 ** 2,
      }));
  // List releases rather than treating arbitrary authentication/network failures as "not found".
  const releases = JSON.parse(
    gh(['api', '--paginate', '--slurp', `repos/${lock.repository}/releases?per_page=100`]),
  ).flat();
  let release = releases.find((r) => r.tag_name === lock.release);
  if (release && !release.draft) {
    log(`Already published https://github.com/${lock.repository}/releases/tag/${lock.release}`);
    return lock.release;
  }
  const releaseDir = join(archiveDir, lock.release);
  const manifestPath = join(releaseDir, RELEASE_MANIFEST);
  if (!(await maybeStat(manifestPath))) await packAssets({ root, outDir: archiveDir, log });
  const manifest = validateReleaseManifest(JSON.parse(await readFile(manifestPath, 'utf8')), lock);
  const paths = new Map();
  for (const archive of manifest.archives) {
    const path = await findArchive(archiveDir, archive);
    if (!path) throw new Error(`Archive missing or corrupt: ${archive.file}; run assets:pack.`);
    paths.set(archive.file, path);
  }
  if (!same(await fileInfo(join(releaseDir, NOTICES)), manifest.notices))
    throw new Error('Asset notices checksum mismatch.');
  paths.set(NOTICES, join(releaseDir, NOTICES));
  paths.set(RELEASE_MANIFEST, manifestPath);
  const uploads = [
    ...manifest.archives,
    manifest.notices,
    { file: RELEASE_MANIFEST, ...(await fileInfo(manifestPath)) },
  ];
  if (!release) {
    const request = join(releaseDir, 'release-request.json');
    await writeFile(
      request,
      json({
        tag_name: lock.release,
        target_commitish: target,
        name: `Molen asset snapshot ${lock.snapshot.slice(0, 12)}`,
        body: `${lock.files.length} GLBs built from source at ${target} by the Assets workflow.\n\nRestore them in a checkout whose \`asset-lock.json\` names \`${lock.release}\` with \`pnpm assets:fetch\`, or rebuild them from source with \`pnpm assets:build\`: the lock pins the exact bytes either way. \`${RELEASE_MANIFEST}\` lists the archives; see ${NOTICES} for licenses.\n\nThese are repository build outputs. Applications use Molen's runtime content packs.\n`,
        draft: true,
        make_latest: 'false',
      }),
    );
    // Use the create response's ID: GitHub's release list can lag behind a new draft.
    release = JSON.parse(
      gh(['api', '--method', 'POST', `repos/${lock.repository}/releases`, '--input', request]),
    );
    if (!release?.draft) throw new Error('Could not create the draft asset release.');
  }
  const listAssets = () =>
    JSON.parse(
      gh([
        'api',
        '--paginate',
        '--slurp',
        `repos/${lock.repository}/releases/${release.id}/assets?per_page=100`,
      ]),
    ).flat();
  const remote = listAssets();
  for (const upload of uploads) {
    const existing = remote.find((a) => a.name === upload.file);
    if (existing?.size === upload.size && existing.digest === `sha256:${upload.sha256}`) {
      log(`Already uploaded ${upload.file}`);
      continue;
    }
    if (existing) {
      // An interrupted run's draft may hold another packing of the same files. Drafts are not
      // public, and every attachment is verified again below before the release is published.
      log(`Replacing draft attachment ${upload.file}`);
      gh(['api', '--method', 'DELETE', `repos/${lock.repository}/releases/assets/${existing.id}`]);
    }
    log(`Uploading ${upload.file}`);
    gh(['release', 'upload', lock.release, paths.get(upload.file), '--repo', lock.repository]);
  }
  const uploaded = listAssets();
  const expected = new Set(uploads.map((u) => u.file));
  const extra = uploaded.filter((a) => !expected.has(a.name)).map((a) => a.name);
  if (extra.length) throw new Error(`Draft ${lock.release} has unexpected attachments: ${extra}`);
  for (const file of uploads) {
    const asset = uploaded.find((a) => a.name === file.file);
    if (asset?.size !== file.size || asset?.digest !== `sha256:${file.sha256}`)
      throw new Error(`Uploaded asset integrity check failed: ${file.file}`);
  }
  gh([
    'release',
    'edit',
    lock.release,
    '--repo',
    lock.repository,
    '--draft=false',
    '--latest=false',
  ]);
  log(`Published https://github.com/${lock.repository}/releases/tag/${lock.release}`);
  return lock.release;
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      'archive-dir': { type: 'string' },
      prefix: { type: 'string' },
      offline: { type: 'boolean' },
      force: { type: 'boolean' },
      'no-build': { type: 'boolean' },
      target: { type: 'string' },
    },
  });
  const root = resolve(values.root ?? ROOT);
  const archiveDir = resolve(values['archive-dir'] ?? join(root, OUTPUT));
  if (positionals.length !== 1)
    throw new Error('Usage: node scripts/asset-packs.mjs pack|fetch|check|publish [options]');
  switch (positionals[0]) {
    case 'pack':
      await packAssets({ root, outDir: archiveDir });
      break;
    case 'fetch':
      try {
        await fetchAssets({
          root,
          archiveDir,
          prefix: values.prefix,
          offline: values.offline,
          force: values.force,
        });
      } catch (error) {
        if (error instanceof ReleaseMissingError && (values['no-build'] || values.prefix)) {
          // Distinct status so CI can build from source instead of failing.
          console.error(error.message);
          process.exitCode = 3;
          return;
        }
        if (!(error instanceof ReleaseMissingError)) throw error;
        console.log(`Warning: ${error.message}\nBuilding the pinned GLBs locally.`);
        const { buildAssetsFromSource } = await import('./build-assets.mjs');
        await buildAssetsFromSource({ root, compile: true, allowUnlocked: true });
      }
      break;
    case 'check':
      await checkAssets({ root, prefix: values.prefix });
      break;
    case 'publish':
      await publishAssets({ root, archiveDir, target: values.target });
      break;
    default:
      throw new Error('Expected pack, fetch, check or publish.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
