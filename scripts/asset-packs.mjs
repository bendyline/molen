#!/usr/bin/env node
// Repository GLB snapshots. These tarballs restore authoring/build inputs; the existing
// molen/pack@1 pipeline still builds the geographic packs consumed by applications.
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
import { dirname, join, relative, resolve, sep } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as tar from 'tar';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORMAT = 'molen/repository-assets@1';
const MANIFEST = 'asset-lock.json';
const OUTPUT = '.artifacts/asset-packs';
const ROOTS = ['content', 'assets', 'examples'];
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
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const digest = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => a?.size === b.size && a?.sha256 === b.sha256;
const LEGACY_ARCHIVE = /^molen-glbs-[a-z0-9-]+-[a-f0-9]{64}\.tar\.gz$/;
const READABLE_ARCHIVE = /^[a-z0-9]+(?:-[a-z0-9]+)*-part-[0-9]{3,}\.tar\.gz$/;

async function maybeStat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function safePath(path) {
  if (
    typeof path !== 'string' ||
    !ROOTS.includes(path.split('/')[0]) ||
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
async function localPath(root, path) {
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
  for (const directory of ROOTS) await walk(join(root, directory));
  return paths.sort();
}

export function validateManifest(manifest) {
  if (
    manifest?.format !== FORMAT ||
    !/^[\w.-]+\/[\w.-]+$/.test(manifest.repository) ||
    !/^assets-[a-f0-9]{16}$/.test(manifest.release) ||
    !SHA.test(manifest.snapshot) ||
    !Array.isArray(manifest.archives) ||
    !manifest.archives.length ||
    manifest.archives.length > 990
  ) {
    throw new Error('Invalid repository asset manifest.');
  }
  const paths = new Set();
  const names = new Set();
  for (const archive of manifest.archives) {
    if (
      !(LEGACY_ARCHIVE.test(archive.file) || READABLE_ARCHIVE.test(archive.file)) ||
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
    for (const file of archive.files) {
      safePath(file.path);
      if (
        paths.has(file.path.toLowerCase()) ||
        !SHA.test(file.sha256) ||
        !Number.isSafeInteger(file.size) ||
        file.size < 1 ||
        file.size > MAX_FILE
      )
        throw new Error(`Invalid or duplicate asset: ${file.path}`);
      paths.add(file.path.toLowerCase());
      expanded += file.size;
    }
    if (expanded > MAX_FILE) throw new Error(`Archive expands beyond 1 GiB: ${archive.file}`);
  }
  if (
    manifest.notices?.file !== 'ASSET-NOTICES.txt' ||
    !SHA.test(manifest.notices.sha256) ||
    !Number.isSafeInteger(manifest.notices.size)
  )
    throw new Error('Missing asset license notices.');
  const snapshot = digest(
    JSON.stringify({ archives: manifest.archives, notices: manifest.notices }),
  );
  if (snapshot !== manifest.snapshot || manifest.release !== `assets-${snapshot.slice(0, 16)}`)
    throw new Error('Asset manifest snapshot does not match its contents.');
  return manifest;
}

export async function readManifest(root = ROOT) {
  return validateManifest(JSON.parse(await readFile(join(root, MANIFEST), 'utf8')));
}

function groups(files, budget) {
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

// Public names can repeat between releases. Keep exact archive versions isolated locally.
export function archivePath(directory, archive) {
  return join(directory, archive.sha256, archive.file);
}

async function findArchive(directory, archive) {
  // Also accept old caches and manually downloaded release attachments in a flat directory.
  for (const path of [archivePath(directory, archive), join(directory, archive.file)]) {
    if ((await maybeStat(path))?.isFile() && same(await fileInfo(path), archive)) return path;
  }
}

export async function verifyArchive(path, archive) {
  if (!same(await fileInfo(path), archive))
    throw new Error(`Archive checksum mismatch: ${archive.file}`);
  const expected = new Map(archive.files.map((file) => [file.path, file]));
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

export async function buildAssets({
  root = ROOT,
  outDir = join(root, OUTPUT),
  repository = 'bendyline/molen',
  budget = 256 * 1024 ** 2,
  allowRemoved = false,
  log = console.log,
} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > MAX_FILE)
    throw new Error('Invalid archive budget.');
  await mkdir(outDir, { recursive: true });
  const paths = await inventory(root);
  const previous = (await maybeStat(join(root, MANIFEST))) ? await readManifest(root) : undefined;
  const absent =
    previous?.archives.flatMap((a) => a.files).filter((f) => !paths.includes(f.path)) ?? [];
  if (absent.length && !allowRemoved)
    throw new Error(
      `Restore ${absent.length} missing assets before packing (assets:fetch), or explicitly pass --allow-removed for intentional removals.`,
    );
  const files = [];
  for (const path of paths) {
    const info = await fileInfo(await localPath(root, path));
    if (!info.size || info.size > MAX_FILE)
      throw new Error(`Asset exceeds 1 GiB archive budget: ${path}`);
    files.push({ path, ...info });
  }
  if (!files.length) throw new Error('No GLBs found.');
  const archives = [];
  for (const group of groups(files, budget)) {
    const file = `${group.key}.tar.gz`;
    const old = previous?.archives.find(
      (a) => JSON.stringify(a.files) === JSON.stringify(group.files),
    );
    const oldPath = old && (await findArchive(outDir, old));
    if (oldPath) {
      await verifyArchive(oldPath, old);
      const archive = { ...old, file };
      const destination = archivePath(outDir, archive);
      if (oldPath !== destination) {
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.part`;
        try {
          await copyFile(oldPath, temporary);
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      archives.push(archive);
      log(`Reused ${file}`);
      continue;
    }
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
      const info = await fileInfo(temporary);
      const archive = {
        file,
        ...info,
        files: group.files,
      };
      await verifyArchive(temporary, archive);
      const destination = archivePath(outDir, archive);
      await mkdir(dirname(destination), { recursive: true });
      await rename(temporary, destination);
      archives.push(archive);
      log(
        `Packed ${group.key}: ${group.files.length} GLBs, ${(info.size / 1024 ** 2).toFixed(1)} MiB`,
      );
    } finally {
      await rm(temporary, { force: true });
    }
  }
  const notices = [];
  for (const path of ['LICENSE', 'content/worldgen/NOTICE.md', 'content/entities/NOTICE.md']) {
    if (await maybeStat(join(root, path)))
      notices.push(`--- ${path} ---\n${await readFile(join(root, path), 'utf8')}`);
  }
  if (!notices.length) throw new Error('No asset license notices found.');
  await writeFile(join(outDir, 'ASSET-NOTICES.txt'), notices.join('\n\n'));
  const noticeInfo = {
    file: 'ASSET-NOTICES.txt',
    ...(await fileInfo(join(outDir, 'ASSET-NOTICES.txt'))),
  };
  const snapshot = digest(JSON.stringify({ archives, notices: noticeInfo }));
  const manifest = validateManifest({
    format: FORMAT,
    repository,
    release: `assets-${snapshot.slice(0, 16)}`,
    snapshot,
    notices: noticeInfo,
    archives,
  });
  await writeFile(join(outDir, MANIFEST), json(manifest));
  await writeFile(join(root, MANIFEST), json(manifest));
  log(`${files.length} GLBs in ${archives.length} packs; release ${manifest.release}`);
  return manifest;
}

export async function checkAssets({ root = ROOT, manifest, prefix = '', log = console.log } = {}) {
  manifest ??= await readManifest(root);
  validateManifest(manifest);
  const files = manifest.archives.flatMap((a) => a.files).filter((f) => f.path.startsWith(prefix));
  if (!files.length) throw new Error(`No assets match prefix: ${prefix}`);
  const errors = [];
  for (const file of files) {
    const path = await localPath(root, file.path);
    if (!(await maybeStat(path))) errors.push(`Missing ${file.path}; run pnpm assets:fetch.`);
    else if (!same(await fileInfo(path), file))
      errors.push(`Changed ${file.path}; publish an updated asset snapshot.`);
  }
  const registered = new Set(manifest.archives.flatMap((a) => a.files).map((f) => f.path));
  for (const path of await inventory(root))
    if (path.startsWith(prefix) && !registered.has(path)) errors.push(`Unpublished GLB: ${path}`);
  if (errors.length) throw new Error(errors.join('\n'));
  log(`Verified ${files.length} GLBs against ${manifest.release}.`);
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

async function removeStage(path, parent) {
  if (!resolve(path).startsWith(`${resolve(parent)}${sep}`))
    throw new Error('Invalid staging cleanup path.');
  await rm(path, { recursive: true, force: true });
}

export async function fetchAssets({
  root = ROOT,
  manifest,
  archiveDir = join(root, OUTPUT),
  offline = false,
  force = false,
  prefix = '',
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  manifest ??= await readManifest(root);
  validateManifest(manifest);
  const needed = new Map();
  const conflicts = [];
  let selected = 0;
  for (const archive of manifest.archives) {
    for (const file of archive.files.filter((f) => f.path.startsWith(prefix))) {
      selected++;
      const path = await localPath(root, file.path);
      const existing = await maybeStat(path);
      if (existing && same(await fileInfo(path), file)) continue;
      if (existing && !force) {
        conflicts.push(file.path);
        continue;
      }
      if (!needed.has(archive)) needed.set(archive, []);
      needed.get(archive).push(file);
    }
  }
  if (!selected) throw new Error(`No assets match prefix: ${prefix}`);
  if (conflicts.length)
    throw new Error(
      `Refusing to overwrite modified local GLBs:\n${conflicts.join('\n')}\nPublish your changes, or use --force to explicitly restore the pinned versions.`,
    );
  await mkdir(archiveDir, { recursive: true });
  const staging = join(root, OUTPUT, 'staging');
  await mkdir(staging, { recursive: true });
  for (const [archive, files] of needed) {
    let path = await findArchive(archiveDir, archive);
    if (!path) {
      if (offline) throw new Error(`Offline archive missing or corrupt: ${archive.file}`);
      const url = `https://github.com/${manifest.repository}/releases/download/${manifest.release}/${archive.file}`;
      log(`Downloading ${archive.file}`);
      path = archivePath(archiveDir, archive);
      await mkdir(dirname(path), { recursive: true });
      await download(url, path, archive, fetchImpl);
    }
    await verifyArchive(path, archive);
    const stage = await mkdtemp(join(staging, 'restore-'));
    try {
      const wanted = new Set(files.map((f) => f.path));
      await tar.x({
        file: path,
        cwd: stage,
        strict: true,
        noMtime: true,
        filter: (name, entry) => wanted.has(name) && entry.type === 'File',
      });
      for (const file of files) {
        const source = join(stage, file.path);
        if (!same(await fileInfo(source), file))
          throw new Error(`Extracted checksum mismatch: ${file.path}`);
      }
      for (const file of files) {
        const destination = await localPath(root, file.path);
        // Recheck immediately before installing: a local author may have edited while downloading.
        if (!force && (await maybeStat(destination))) {
          if (same(await fileInfo(destination), file)) continue;
          throw new Error(`Local asset appeared during download: ${file.path}`);
        }
        await mkdir(dirname(destination), { recursive: true });
        const temporary = `${destination}.${randomUUID()}.part`;
        try {
          await copyFile(join(stage, file.path), temporary);
          await rename(temporary, destination);
        } finally {
          await rm(temporary, { force: true });
        }
      }
      log(`Restored ${files.length} GLBs from ${archive.file}`);
    } finally {
      await removeStage(stage, staging);
    }
  }
  log(`Ready: ${selected} pinned GLBs (${needed.size} archives restored).`);
  return selected;
}

export async function publishAssets({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing 40-character GitHub commit SHA>.');
  const manifest = await readManifest(root);
  await checkAssets({ root, manifest, log });
  const archivePaths = new Map();
  for (const archive of manifest.archives) {
    const path = await findArchive(archiveDir, archive);
    if (!path) throw new Error(`Archive missing or corrupt: ${archive.file}; run assets:pack.`);
    await verifyArchive(path, archive);
    archivePaths.set(archive.file, path);
  }
  if (!same(await fileInfo(join(archiveDir, manifest.notices.file)), manifest.notices))
    throw new Error('Asset notices checksum mismatch.');
  if ((await readFile(join(archiveDir, MANIFEST), 'utf8')) !== json(manifest))
    throw new Error('Rebuild archives: staged manifest differs from asset-lock.json.');
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
    gh(['api', '--paginate', '--slurp', `repos/${manifest.repository}/releases?per_page=100`]),
  ).flat();
  let release = releases.find((r) => r.tag_name === manifest.release);
  const notes = join(archiveDir, 'release-notes.md');
  await writeFile(
    notes,
    `Full-detail Molen GLB asset snapshot.\n\n${manifest.archives.flatMap((a) => a.files).length} source and imported GLBs, stored without geometry or texture changes.\n\nRestore these repository inputs with \`pnpm assets:fetch\` using the matching \`asset-lock.json\`. The manifest records exact paths, sizes, SHA-256 hashes and the snapshot identity. Archives are grouped by content role and geographic region.\n\nThese are repository asset archives; applications continue to use Molen's runtime content packs. The tag anchors an existing code commit; the attached manifest identifies the asset snapshot, including assets awaiting the owner's source commit.\n\nSee ASSET-NOTICES.txt for the MIT license and content notices.\n`,
  );
  if (!release) {
    const request = join(archiveDir, 'release-request.json');
    await writeFile(
      request,
      json({
        tag_name: manifest.release,
        target_commitish: target,
        name: `Molen asset packs ${manifest.snapshot.slice(0, 12)}`,
        body: await readFile(notes, 'utf8'),
        draft: true,
        make_latest: 'false',
      }),
    );
    // Use the create response's ID: GitHub's release list can lag behind a new draft.
    release = JSON.parse(
      gh(['api', '--method', 'POST', `repos/${manifest.repository}/releases`, '--input', request]),
    );
    if (!release?.draft) throw new Error('Could not find the newly created draft asset release.');
  }
  const uploads = [
    ...manifest.archives,
    manifest.notices,
    { file: MANIFEST, ...(await fileInfo(join(archiveDir, MANIFEST))) },
  ];
  const remoteAssets = JSON.parse(
    gh([
      'api',
      '--paginate',
      '--slurp',
      `repos/${manifest.repository}/releases/${release.id}/assets?per_page=100`,
    ]),
  ).flat();
  for (const upload of uploads) {
    const existing = remoteAssets.find((a) => a.name === upload.file);
    if (existing) {
      if (existing.size !== upload.size || existing.digest !== `sha256:${upload.sha256}`)
        throw new Error(
          `Release asset already exists with different or unverifiable bytes: ${upload.file}`,
        );
      log(`Already uploaded ${upload.file}`);
      continue;
    }
    if (!release.draft)
      throw new Error(
        `Published snapshot is immutable and missing ${upload.file}; publish a new snapshot.`,
      );
    log(`Uploading ${upload.file}`);
    gh([
      'release',
      'upload',
      manifest.release,
      archivePaths.get(upload.file) ?? join(archiveDir, upload.file),
      '--repo',
      manifest.repository,
    ]);
  }
  const uploaded = JSON.parse(
    gh([
      'api',
      '--paginate',
      '--slurp',
      `repos/${manifest.repository}/releases/${release.id}/assets?per_page=100`,
    ]),
  ).flat();
  for (const file of uploads) {
    const remote = uploaded.find((a) => a.name === file.file);
    if (remote?.size !== file.size || remote?.digest !== `sha256:${file.sha256}`)
      throw new Error(`Uploaded asset integrity check failed: ${file.file}`);
  }
  if (release.draft)
    gh([
      'release',
      'edit',
      manifest.release,
      '--repo',
      manifest.repository,
      '--draft=false',
      '--latest=false',
    ]);
  log(`Published https://github.com/${manifest.repository}/releases/tag/${manifest.release}`);
  return manifest.release;
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
      'allow-removed': { type: 'boolean' },
      target: { type: 'string' },
    },
  });
  const root = resolve(values.root ?? ROOT);
  const archiveDir = resolve(values['archive-dir'] ?? join(root, OUTPUT));
  const options = {
    root,
    archiveDir,
    prefix: values.prefix,
    offline: values.offline,
    force: values.force,
  };
  if (positionals.length !== 1)
    throw new Error('Usage: node scripts/asset-packs.mjs pack|fetch|check|publish [options]');
  switch (positionals[0]) {
    case 'pack':
      await buildAssets({ root, outDir: archiveDir, allowRemoved: values['allow-removed'] });
      break;
    case 'fetch':
      await fetchAssets(options);
      break;
    case 'check':
      await checkAssets(options);
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
