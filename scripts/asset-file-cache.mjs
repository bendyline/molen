// Local build hints only. Release/download integrity checks always hash the actual bytes.
import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const FORMAT = 'molen/asset-file-cache@1';

function fingerprint(path) {
  const info = statSync(path, { bigint: true });
  if (!info.isFile()) throw Object.assign(new Error(`Not a file: ${path}`), { code: 'EISDIR' });
  // ctime and file identity catch replacement or same-size writes with restored mtimes too.
  return [info.size, info.mtimeNs, info.ctimeNs, info.dev, info.ino].join(':');
}

export async function createAssetFileCache(root, { force = false } = {}) {
  root = resolve(root);
  const file = join(root, '.artifacts/asset-build/file-hashes.json');
  let saved;
  if (!force) {
    try {
      saved = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
    }
  }
  const entries = new Map(
    saved?.format === FORMAT && Array.isArray(saved.entries)
      ? saved.entries.filter((entry) => Array.isArray(entry) && entry.length === 2)
      : [],
  );
  const stats = { reused: 0, hashed: 0 };
  const start = (path, kind) => {
    path = resolve(path);
    const local = relative(root, path).split(sep).join('/');
    if (!local || isAbsolute(local) || local.split('/').includes('..'))
      throw new Error(`File hash cache path is outside the workspace: ${path}`);
    const key = `${kind}:${local}`;
    let stamp;
    try {
      stamp = fingerprint(path);
    } catch (error) {
      entries.delete(key);
      throw error;
    }
    const previous = entries.get(key);
    const current = previous?.stamp === stamp;
    stats[current ? 'reused' : 'hashed']++;
    return { key, stamp, current, value: previous?.value };
  };
  const finish = (path, entry, value) => {
    // A file edited during the read must be checked again next time.
    if (fingerprint(path) === entry.stamp) entries.set(entry.key, { stamp: entry.stamp, value });
    else entries.delete(entry.key);
    return value;
  };
  return {
    stats,
    async get(path, kind, calculate) {
      const entry = start(path, kind);
      return entry.current ? entry.value : finish(path, entry, await calculate());
    },
    getSync(path, kind, calculate) {
      const entry = start(path, kind);
      return entry.current ? entry.value : finish(path, entry, calculate());
    },
    async save() {
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify({ format: FORMAT, entries: [...entries] })}\n`);
      await rename(temporary, file);
    },
  };
}
