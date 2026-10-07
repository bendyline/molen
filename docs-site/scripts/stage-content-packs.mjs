// The public site's pack transport matches the shipped world viewer: a small
// worldgen metadata core plus geographic model archives opened only on demand.
// With `modelArchives: false` only the core packs are staged: the archives are
// gigabytes, and a style pack whose archives an index does not list falls back to
// procedural buildings.
import { access, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPack } from '@bendyline/molen-pack/node';
import { buildRegionalPacks } from '../../examples/world-explorer/scripts/build-regional-packs.mjs';

const MODEL_ARCHIVE = /\.models\.(?:g_[0-9a-z]{2}|shared)\.p\d+$/;

/** Remove the landmark model archives from a staged pack directory and its index. */
async function dropModelArchives(outDir) {
  const indexPath = join(outDir, 'index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  let dropped = 0;
  for (const [id, entry] of Object.entries(index.packs)) {
    if (!MODEL_ARCHIVE.test(id)) continue;
    await rm(join(outDir, entry.file), { force: true });
    delete index.packs[id];
    dropped++;
  }
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return dropped;
}

export async function stageContentPacks(
  contentDir,
  outDir,
  { reuseFromDir, modelArchives = true } = {},
) {
  const placements = [];
  let earth;
  try {
    earth = JSON.parse(await readFile(join(contentDir, 'earth/molen-pack.source.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const provided = earth?.provides?.structures ?? [];
  for (const path of Array.isArray(provided) ? provided : [provided]) {
    const doc = JSON.parse(await readFile(join(contentDir, 'earth', path), 'utf8'));
    placements.push(...doc.entries);
  }
  const packs = [];
  const directories = (await readdir(contentDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of directories) {
    const source = join(contentDir, name);
    try {
      await access(join(source, 'molen-pack.source.json'));
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (name === 'worldgen') {
      const built = await buildRegionalPacks(source, { outDir, placements, reuseFromDir });
      const core = JSON.parse(await readFile(join(source, 'molen-pack.source.json'), 'utf8'));
      const archives = Object.keys(built.routes.archives).length;
      packs.push(
        modelArchives
          ? `${core.id}@${core.version} + ${archives} model archives`
          : `${core.id}@${core.version} (${await dropModelArchives(outDir)} model archives left out)`,
      );
    } else {
      const built = await buildPack(source, { outDir });
      packs.push(`${built.manifest.id}@${built.manifest.version}`);
    }
  }
  return packs;
}
