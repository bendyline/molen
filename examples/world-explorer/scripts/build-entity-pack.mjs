// Keep the downloadable archive, but serve entity models individually even on hosts without Range.
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  buildPack,
  hostedVersionDir,
  openFilePack,
  writeDirectoryPack,
} from '@bendyline/molen-pack/node';

async function readIndexEntries(outDir) {
  try {
    return JSON.parse(await readFile(join(outDir, 'index.json'), 'utf8')).packs ?? {};
  } catch {
    return {};
  }
}

/**
 * Remove the build a new one replaced: its unzipped directory and its archive (the zip with the
 * replaced contentHash). The index never lists that archive, so nothing else removes it.
 */
async function removeReplaced(outDir, previous, built, directory) {
  if (!previous?.contentHash || previous.contentHash === built.manifest.contentHash) return;
  if (typeof previous.file === 'string' && previous.file.endsWith('/molen-pack.json')) {
    const old = dirname(previous.file);
    // A leftover is only disk space, so a failed removal is not a failed build.
    if (old !== directory && old.startsWith(`${built.manifest.id}/`))
      await rm(resolve(outDir, old), { recursive: true, force: true }).catch(() => {});
  }
  for (const name of await readdir(outDir)) {
    if (name === built.file || !name.startsWith(`${built.manifest.id}-`) || !name.endsWith('.zip'))
      continue;
    let replaced = false;
    try {
      const pack = await openFilePack(join(outDir, name));
      replaced = pack.manifest.contentHash === previous.contentHash;
      pack.close();
    } catch {
      // Not a readable pack: leave it alone.
    }
    if (replaced) await rm(join(outDir, name), { force: true }).catch(() => {});
  }
}

export async function buildEntityPack(source, options) {
  const before = await readIndexEntries(options.outDir);
  const built = await buildPack(source, options);
  const version = hostedVersionDir(built.manifest.contentHash);
  const directory = `${built.manifest.id}/${version}`;
  const pack = await openFilePack(built.path);
  let manifestBytes;
  try {
    ({ manifestBytes } = await writeDirectoryPack(pack, join(options.outDir, directory)));
  } finally {
    pack.close();
  }
  const index = JSON.parse(await readFile(built.indexPath, 'utf8'));
  index.packs[built.manifest.id] = {
    version: built.manifest.version,
    contentHash: built.manifest.contentHash,
    file: `${directory}/molen-pack.json`,
    size: manifestBytes,
  };
  await writeFile(built.indexPath, `${JSON.stringify(index, null, 2)}\n`);
  await removeReplaced(options.outDir, before[built.manifest.id], built, directory);
  return built;
}
