// Keep the downloadable archive, but serve entity models individually even on hosts without Range.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildPack,
  hostedVersionDir,
  openFilePack,
  writeDirectoryPack,
} from '@bendyline/molen-pack/node';

export async function buildEntityPack(source, options) {
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
  return built;
}
