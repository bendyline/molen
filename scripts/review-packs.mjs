// Optional historical capture archives. Normal model builds and CI never fetch these.
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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCK = 'review-lock.json';
const FORMAT = 'molen/review-bundle@1';
const OUTPUT = '.artifacts/review-packs';
const BASES = ['places', 'reusable', 'map-structures'].map((p) => `content/worldgen/source/${p}`);
const SHA = /^[a-f0-9]{64}$/;
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const same = (a, b) => a?.size === b.size && a?.sha256 === b.sha256;
const releaseName = (files) =>
  `reviews-${createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 16)}`;

export function isReviewPath(path) {
  return (
    typeof path === 'string' &&
    BASES.some((base) => path.startsWith(`${base}/`)) &&
    /\/(shots|medium-fi)\/.+\.(png|jpe?g|webp)$/i.test(path)
  );
}

function safePath(path) {
  if (
    !isReviewPath(path) ||
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
    throw new Error(`Unsafe review path: ${path}`);
}

async function stat(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function localPath(root, path) {
  safePath(path);
  let current = resolve(root);
  for (const part of path.split('/')) {
    current = join(current, part);
    if ((await stat(current))?.isSymbolicLink())
      throw new Error(`Review path is a symlink: ${current}`);
  }
  return current;
}

async function removeStage(stage, parent) {
  if (!resolve(stage).startsWith(`${resolve(parent)}${sep}`))
    throw new Error('Invalid review staging path.');
  await rm(stage, { recursive: true, force: true });
}

export function validateReviewLock(lock) {
  if (
    lock?.format !== FORMAT ||
    !/^[\w.-]+\/[\w.-]+$/.test(lock.repository ?? '') ||
    !Array.isArray(lock.files) ||
    !lock.files.length ||
    !Array.isArray(lock.archives) ||
    !lock.archives.length ||
    lock.archives.length > 990
  )
    throw new Error('Invalid review lock.');
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
      file.size > 128 * 1024 ** 2
    )
      throw new Error(`Invalid review file: ${file.path}`);
    previous = file.path;
    paths.add(file.path.toLowerCase());
  }
  if (lock.release !== releaseName(lock.files))
    throw new Error('Review release does not match files.');
  const expected = new Set(lock.files.map((file) => file.path));
  const covered = new Set(),
    names = new Set();
  for (const archive of lock.archives) {
    if (
      !/^reviews-part-[0-9]{3,}\.tar$/.test(archive.file) ||
      names.has(archive.file) ||
      !SHA.test(archive.sha256) ||
      !Number.isSafeInteger(archive.size) ||
      archive.size < 1 ||
      archive.size >= 2 * 1024 ** 3 ||
      !Array.isArray(archive.files) ||
      !archive.files.length
    )
      throw new Error(`Invalid review archive: ${archive.file}`);
    names.add(archive.file);
    for (const path of archive.files) {
      if (!expected.has(path) || covered.has(path))
        throw new Error(`Invalid archive member: ${path}`);
      covered.add(path);
    }
  }
  if (covered.size !== expected.size) throw new Error('Review archives do not cover every file.');
  return lock;
}

export async function readReviewLock(root = ROOT) {
  const path = join(root, LOCK);
  return (await stat(path))
    ? validateReviewLock(JSON.parse(await readFile(path, 'utf8')))
    : undefined;
}

async function reviewFiles(root) {
  const paths = [];
  async function walk(path) {
    if (!(await stat(path))) return;
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`Review inventory does not follow symlinks: ${child}`);
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) {
        const name = relative(root, child).split(sep).join('/');
        if (isReviewPath(name)) paths.push(name);
      }
    }
  }
  for (const base of BASES) await walk(join(root, base));
  const files = [];
  for (const path of paths.sort())
    files.push({ path, ...(await fileInfo(await localPath(root, path))) });
  return files;
}

export async function packReviews({
  root = ROOT,
  outDir = join(root, OUTPUT),
  repository,
  budget = 256 * 1024 ** 2,
  log = console.log,
} = {}) {
  if (!Number.isSafeInteger(budget) || budget < 1 || budget > 1024 ** 3)
    throw new Error('Invalid review archive budget.');
  repository ??= JSON.parse(await readFile(join(root, 'asset-build.json'), 'utf8')).repository;
  const files = await reviewFiles(root);
  if (!files.length) throw new Error('No review images found. Restore reviews before packing.');
  // Do not silently discard evidence simply because a checkout was only partly hydrated.
  const previous = await readReviewLock(root);
  const present = new Set(files.map((file) => file.path));
  for (const file of previous?.files ?? []) {
    if (!present.has(file.path))
      throw new Error(`Missing previous review: ${file.path}; restore it before packing.`);
  }
  const lock = { format: FORMAT, repository, release: releaseName(files), files, archives: [] };
  const directory = join(outDir, lock.release);
  await mkdir(directory, { recursive: true });
  const chunks = [];
  let chunk = [],
    size = 0;
  for (const file of files) {
    if (size + file.size > budget && chunk.length) {
      chunks.push(chunk);
      chunk = [];
      size = 0;
    }
    chunk.push(file.path);
    size += file.size;
  }
  if (chunk.length) chunks.push(chunk);
  const byPath = new Map(files.map((file) => [file.path, file]));
  for (const members of chunks) {
    const file = `reviews-part-${String(lock.archives.length + 1).padStart(3, '0')}.tar`;
    const path = join(directory, file),
      temporary = `${path}.${randomUUID()}.part`;
    try {
      await tar.c(
        { cwd: root, file: temporary, portable: true, mtime: new Date(0), noDirRecurse: true },
        members,
      );
      const archive = { file, ...(await fileInfo(temporary)), files: members };
      await verifyArchive(temporary, archive, byPath);
      await rename(temporary, path);
      lock.archives.push(archive);
      log(`Packed ${file}: ${members.length} review images.`);
    } finally {
      await rm(temporary, { force: true });
    }
  }
  validateReviewLock(lock);
  await writeFile(join(directory, LOCK), json(lock));
  await writeFile(join(root, LOCK), json(lock));
  log(`Packed ${files.length} review images as ${lock.release}.`);
  return lock;
}

async function download(lock, archive, path, fetchImpl) {
  const url = `https://github.com/${lock.repository}/releases/download/${lock.release}/${archive.file}`;
  const temporary = `${path}.${randomUUID()}.part`;
  await mkdir(dirname(path), { recursive: true });
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(600_000) });
    if (!response.ok || !response.body)
      throw new Error(`Review download failed: HTTP ${response.status} ${url}`);
    let size = 0;
    await pipeline(
      Readable.fromWeb(response.body),
      new Transform({
        transform(chunk, _encoding, done) {
          size += chunk.length;
          done(
            size > archive.size ? new Error('Review download exceeds its declared size.') : null,
            chunk,
          );
        },
      }),
      createWriteStream(temporary, { flags: 'wx' }),
    );
    if (!same(await fileInfo(temporary), archive))
      throw new Error(`Review archive checksum mismatch: ${archive.file}`);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function fetchReviews({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  offline = false,
  force = false,
  prefix = '',
  fetchImpl = fetch,
  log = console.log,
} = {}) {
  const lock = await readReviewLock(root);
  if (!lock) return { restored: 0, preserved: 0 };
  const files = lock.files.filter((file) => file.path.startsWith(prefix));
  if (!files.length) throw new Error(`No reviews match prefix: ${prefix}`);
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
    const path = join(archiveDir, lock.release, archive.file);
    if (!(await stat(path)) || !same(await fileInfo(path), archive)) {
      if (offline) throw new Error(`Offline review archive missing or corrupt: ${path}`);
      log(`Downloading ${archive.file}`);
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
      for (const name of members) {
        if (!same(await fileInfo(join(stage, name)), byPath.get(name)))
          throw new Error(`Review checksum mismatch: ${name}`);
      }
      for (const name of members) {
        const destination = await localPath(root, name);
        // A capture may have been created while the archive was being downloaded.
        if (!force && (await stat(destination))) {
          preserved++;
          continue;
        }
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
  log(
    `Reviews: ${restored} restored, ${preserved} locally changed images preserved (${lock.release}).`,
  );
  return { restored, preserved };
}

export async function checkReviews({ root = ROOT, log = console.log } = {}) {
  const lock = await readReviewLock(root);
  if (!lock) throw new Error('Missing review-lock.json.');
  for (const file of lock.files) {
    const path = await localPath(root, file.path);
    if (!(await stat(path)) || !same(await fileInfo(path), file))
      throw new Error(`Missing or changed review: ${file.path}`);
  }
  log(`Verified ${lock.files.length} review images (${lock.release}).`);
}

export async function publishReviews({
  root = ROOT,
  archiveDir = join(root, OUTPUT),
  target,
  runGh,
  log = console.log,
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(target ?? ''))
    throw new Error('Publishing requires --target <existing GitHub commit SHA>.');
  const lock = await readReviewLock(root);
  if (!lock) throw new Error('Run reviews:pack first.');
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
  let published = releases.find((item) => item.tag_name === release);
  const uploads = [...lock.archives, { file: LOCK, ...(await fileInfo(join(directory, LOCK))) }];
  if (
    !validateReviewLock(JSON.parse(await readFile(join(directory, LOCK), 'utf8'))) ||
    !same(await fileInfo(join(root, LOCK)), uploads.at(-1))
  )
    throw new Error('Packed review lock differs from checkout.');
  for (const archive of lock.archives)
    await verifyArchive(
      join(directory, archive.file),
      archive,
      new Map(lock.files.map((file) => [file.path, file])),
    );
  if (!published) {
    const body = join(directory, 'release-request.json');
    await writeFile(
      body,
      json({
        tag_name: release,
        target_commitish: target,
        name: `Molen review evidence ${release.slice(8)}`,
        draft: true,
        make_latest: 'false',
        body: `${lock.files.length} model review images. Restore the exact bytes with \`pnpm reviews:fetch\`.\n\n\`review-lock.json\` pins every file and archive. These are review captures, not source textures or a software release.\n`,
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
  const listAssets = () =>
    request([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/releases/${published.id}/assets?per_page=100`,
    ]).flat();
  const remote = listAssets();
  for (const file of uploads) {
    const existing = remote.find((asset) => asset.name === file.file);
    if (existing?.size === file.size && existing.digest === `sha256:${file.sha256}`) continue;
    if (existing || !published.draft)
      throw new Error(`Release attachment differs; refusing to replace it: ${file.file}`);
    log(`Uploading ${file.file}`);
    gh(['release', 'upload', release, join(directory, file.file), '--repo', repository]);
  }
  const uploaded = listAssets();
  for (const file of uploads) {
    const asset = uploaded.find((item) => item.name === file.file);
    if (asset?.size !== file.size || asset.digest !== `sha256:${file.sha256}`)
      throw new Error(`Uploaded review checksum mismatch: ${file.file}`);
  }
  if (published.draft)
    gh(['release', 'edit', release, '--repo', repository, '--draft=false', '--latest=false']);
  log(`Published https://github.com/${repository}/releases/tag/${release}`);
  return release;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      'archive-dir': { type: 'string' },
      offline: { type: 'boolean' },
      force: { type: 'boolean' },
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
    prefix: values.prefix,
    target: values.target,
  };
  const commands = {
    pack: () => packReviews({ ...options, outDir: options.archiveDir }),
    fetch: () => fetchReviews(options),
    check: () => checkReviews(options),
    publish: () => publishReviews(options),
    key: async () => console.log((await readReviewLock(root))?.release ?? 'none'),
  };
  Promise.resolve()
    .then(() => {
      if (positionals.length !== 1 || !Object.hasOwn(commands, positionals[0]))
        throw new Error(
          'Usage: node scripts/review-packs.mjs pack|fetch|check|publish|key [options]',
        );
      return commands[positionals[0]]();
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
