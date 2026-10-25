import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const WINDOWS_FILE_LOCKS = new Set(['EBUSY', 'EPERM', 'EACCES', 'EUNKNOWN', 'UNKNOWN']);

async function replace(temporary, path) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(temporary, path);
      return;
    } catch (error) {
      if (process.platform !== 'win32' || attempt >= 20 || !WINDOWS_FILE_LOCKS.has(error.code))
        throw error;
      await setTimeout(Math.min(25 * 2 ** attempt, 250));
    }
  }
}

export async function writeNavigation(path, next, { check = false } = {}) {
  const current = await readFile(path, 'utf8').catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return undefined;
  });
  if (current === next) return;
  if (check) {
    throw new Error('docs site navigation is stale — run `pnpm docs:site:gen` and commit.');
  }

  // VitePress or an editor may still have the old file mapped on Windows. Publish a complete
  // replacement instead of truncating that file, and leave identical navigation untouched.
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, next, { flag: 'wx' });
    await replace(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}
