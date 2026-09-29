// The public site's pack transport matches the shipped world viewer: a small
// worldgen metadata core plus geographic model archives opened only on demand.
import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPack } from '@bendyline/molen-pack/node';
import { buildRegionalPacks } from '../../examples/world-explorer/scripts/build-regional-packs.mjs';

export async function stageContentPacks(contentDir, outDir, { reuseFromDir } = {}) {
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
      packs.push(
        `${core.id}@${core.version} + ${Object.keys(built.routes.archives).length} model archives`,
      );
    } else {
      const built = await buildPack(source, { outDir });
      packs.push(`${built.manifest.id}@${built.manifest.version}`);
    }
  }
  return packs;
}
