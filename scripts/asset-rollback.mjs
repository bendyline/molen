// An asset build rewrites committed metadata while it runs (replayed import sidecars, generator
// indexes, LOD sidecars) and settles it when it ends (reconcileText in build-assets.mjs). A build
// that never gets there because it was killed, its terminal closed or the machine went down would
// leave those intermediate rewrites behind, and the next build would snapshot them as if they had
// been committed. So before a build process first changes a committed text file, it copies the
// original into this journal. The next build (or `pnpm assets:build --recover`) puts the
// originals back before it reads anything.
//
// The rollback preload imports this module, so it captures the fs functions it uses before the
// preload (or the job tracer after it) patches them: backups are neither guarded nor traced.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  constants,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  realpathSync,
  rmSync,
  utimesSync,
} = fs;

/** What a build snapshots as committed text below its asset roots (see readText). */
export const TEXT_SKIP = new Set([
  'node_modules',
  'dist',
  'dist-types',
  '.git',
  '.artifacts',
  '.tmp',
  'packs',
]);
export const TEXT = /\.(json|md)$/i;

const DIRECTORY = '.artifacts/asset-build/rollback';
const FORMAT = 'molen/asset-rollback@1';
const HEARTBEAT_MS = 2000;
// A build writes a file at most one heartbeat after the journal's last touch. A file changed
// later than this was edited after the build stopped, and recovery leaves it alone.
const SLACK_MS = 5000;
// A journal touched more recently than this belongs to a build that may still be running.
const LIVE_MS = 10000;

const WINDOWS_LOCKS = new Set(['EBUSY', 'EPERM', 'EACCES', 'EUNKNOWN', 'UNKNOWN']);

/** Repository-relative POSIX path of a committed text file, or undefined for anything else. */
export function committedTextPath(root, roots, value) {
  if (value instanceof URL) value = fileURLToPath(value);
  if (Buffer.isBuffer(value)) value = value.toString();
  if (typeof value !== 'string') return undefined;
  const absolute = resolve(value);
  let path = relative(root, absolute);
  // A root reached through a symlink (macOS's /var → /private/var) must match its real form too.
  if (isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) {
    try {
      path = relative(realpathSync.native(root), absolute);
    } catch {
      return undefined;
    }
  }
  const parts = path.split(sep);
  if (
    !roots.includes(parts[0]) ||
    parts.some((part) => part === '..' || TEXT_SKIP.has(part)) ||
    !TEXT.test(path)
  )
    return undefined;
  return parts.join('/');
}

/**
 * A synchronous `backup(path)` for one process: the first time the process is about to change
 * a committed text file, keep its current bytes unless some process already has.
 */
export function createBackup({ root, directory, roots }) {
  const seen = new Set();
  return (value) => {
    const path = committedTextPath(root, roots, value);
    if (!path || seen.has(path)) return;
    const target = join(directory, 'files', path);
    if (!existsSync(target)) {
      mkdirSync(dirname(target), { recursive: true });
      const temporary = `${target}.${randomUUID()}.tmp`;
      try {
        copyFileSync(join(root, path), temporary);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        // A new file has no original. Like a failed build, recovery leaves it in place.
        seen.add(path);
        return;
      }
      // Concurrent jobs can rewrite the same index. Every process copies before it writes, and
      // the first copy linked in place was finished before any of those writes began.
      try {
        linkSync(temporary, target);
      } catch (error) {
        if (['EPERM', 'ENOTSUP', 'ENOSYS', 'EXDEV'].includes(error.code)) {
          // No hard links on this volume: an exclusive copy is the next best thing.
          try {
            copyFileSync(temporary, target, constants.COPYFILE_EXCL);
          } catch (copyError) {
            if (copyError.code !== 'EEXIST') throw copyError;
          }
        } else if (error.code !== 'EEXIST') throw error;
      } finally {
        rmSync(temporary, { force: true });
      }
    }
    seen.add(path);
  };
}

async function retry(operation) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (process.platform !== 'win32' || attempt >= 20 || !WINDOWS_LOCKS.has(error.code))
        throw error;
      await new Promise((done) => setTimeout(done, Math.min(25 * 2 ** attempt, 250)));
    }
  }
}

async function replaceFile(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await retry(() => rename(temporary, path));
  } finally {
    await rm(temporary, { force: true });
  }
}

async function backupPaths(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const paths = [];
  for (const entry of entries) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) paths.push(...(await backupPaths(join(directory, entry.name), path)));
    else if (entry.isFile() && !entry.name.endsWith('.tmp')) paths.push(path);
  }
  return paths.sort();
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * Put back every committed text file an interrupted build changed, then drop its journal.
 * Files edited after that build stopped are reported and kept.
 */
export async function recoverInterruptedBuild(root, { log = console.log } = {}) {
  const directory = join(root, DIRECTORY);
  const journalPath = join(directory, 'journal.json');
  let heartbeat;
  try {
    heartbeat = (await stat(journalPath)).mtimeMs;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // The journal is written before any process receives it, so there are no backups.
    await rm(directory, { recursive: true, force: true });
    return { restored: [], kept: [] };
  }
  let journal;
  try {
    journal = JSON.parse(await readFile(journalPath, 'utf8'));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
  if (
    journal &&
    !journal.released &&
    journal.pid !== process.pid &&
    Date.now() - heartbeat < LIVE_MS &&
    alive(journal.pid)
  )
    throw new Error(
      `Another asset build (process ${journal.pid}) is running in this checkout. Let it finish or stop it first.`,
    );
  const restored = [];
  const kept = [];
  const files = join(directory, 'files');
  for (const path of await backupPaths(files)) {
    const original = await readFile(join(files, path));
    const target = join(root, path);
    const current = await readFile(target).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (current?.equals(original)) continue;
    if (current && (await stat(target)).mtimeMs > heartbeat + SLACK_MS) {
      kept.push(path);
      continue;
    }
    await replaceFile(target, original);
    restored.push(path);
  }
  const when = journal?.started ? ` (started ${journal.started})` : '';
  if (restored.length) {
    log(
      `Restored ${restored.length} committed files that an interrupted asset build${when} had changed:`,
    );
    for (const path of restored.slice(0, 20)) log(`  ${path}`);
    if (restored.length > 20) log(`  … and ${restored.length - 20} more`);
  }
  if (kept.length) {
    log(`Kept ${kept.length} files that were edited after that build stopped:`);
    for (const path of kept.slice(0, 20)) log(`  ${path}`);
    if (kept.length > 20) log(`  … and ${kept.length - 20} more`);
  }
  await rm(directory, { recursive: true, force: true });
  return { restored, kept };
}

/**
 * Recover any interrupted build, then open this build's journal. Pass `env` to every process
 * the build starts, and call `backup` before the build itself changes a committed text file.
 * `discard` once the committed text is settled; `release` when the build ends either way.
 */
export async function beginRollback(root, { roots, log = console.log } = {}) {
  await recoverInterruptedBuild(root, { log });
  const directory = join(root, DIRECTORY);
  const journalPath = join(directory, 'journal.json');
  await mkdir(directory, { recursive: true });
  const journal = { format: FORMAT, pid: process.pid, started: new Date().toISOString() };
  try {
    await writeFile(journalPath, `${JSON.stringify(journal)}\n`, { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Another asset build started in this checkout at the same time.`);
  }
  // Recovery tells a running build from a dead one by this heartbeat.
  const timer = setInterval(() => {
    const now = new Date();
    try {
      utimesSync(journalPath, now, now);
    } catch {
      /* Discarded meanwhile, or briefly locked; the next beat will do. */
    }
  }, HEARTBEAT_MS);
  timer.unref();
  const options = { root, directory, roots };
  const backup = createBackup(options);
  return {
    env: { MOLEN_ASSET_ROLLBACK: JSON.stringify(options) },
    backup,
    /** Back up every committed text file below these directories (for non-Node jobs). */
    async backupTrees(paths) {
      async function walk(path) {
        const entries = await readdir(path, { withFileTypes: true }).catch((error) => {
          if (error.code === 'ENOENT') return [];
          throw error;
        });
        for (const entry of entries) {
          if (TEXT_SKIP.has(entry.name)) continue;
          const child = join(path, entry.name);
          if (entry.isDirectory()) await walk(child);
          else if (entry.isFile()) backup(child);
        }
      }
      for (const path of paths) await walk(join(root, path));
    },
    async discard() {
      clearInterval(timer);
      await rm(directory, { recursive: true, force: true });
    },
    async release() {
      clearInterval(timer);
      if (!existsSync(journalPath)) return;
      if (!(await backupPaths(join(directory, 'files'))).length) {
        await rm(directory, { recursive: true, force: true });
        return;
      }
      // Committed text was not settled (restoring it failed): the next build recovers it.
      await writeFile(journalPath, `${JSON.stringify({ ...journal, released: true })}\n`);
    },
  };
}
