// Starting the app serves prepared content packs, first repackaging any whose content/ source
// changed (see examples/world-explorer/scripts/refresh-content-packs.mjs). Fetching and generating
// models stays explicit authoring work: pnpm dev:prepare, pnpm assets:build.
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'molen.entities',
  'molen.worldgen.default',
  'molen.earth',
  'molen.ecology',
  'molen.wildlife',
  'molen.sky',
  'molen.sounds',
];

async function readIndex(directory) {
  let index;
  try {
    index = JSON.parse(await readFile(join(directory, 'index.json'), 'utf8'));
  } catch (error) {
    throw new Error(
      'Development content is not prepared. Run pnpm dev:prepare from the repository root once, then pnpm dev. Startup does not generate models.',
      { cause: error },
    );
  }
  if (
    index?.format !== 'molen/pack-index@1' ||
    !index.packs ||
    typeof index.packs !== 'object' ||
    Array.isArray(index.packs)
  )
    throw new Error('Invalid development pack index. Run pnpm dev:content to refresh it.');
  return index;
}

/**
 * Check prepared pack entry points. With `refresh`, first repackage the packs whose content/
 * sources changed since they were built; without it, nothing is read beyond the index and stats.
 */
export async function checkDevContent({
  directory = join(root, 'examples/world-explorer/public/packs'),
  log = console.log,
  refresh = false,
} = {}) {
  let index = await readIndex(directory);
  if (refresh) {
    const { refreshContentPacks } = await import(
      '../examples/world-explorer/scripts/refresh-content-packs.mjs'
    );
    await refreshContentPacks({ outDir: directory, log });
    index = await readIndex(directory);
  }
  const missing = required.filter((id) => !index.packs[id]);
  const entries = Object.entries(index.packs);
  await Promise.all(
    entries.map(async ([id, entry]) => {
      if (typeof entry?.file !== 'string' || !entry.file) {
        missing.push(id);
        return;
      }
      const file = resolve(directory, entry.file);
      const within = relative(resolve(directory), file);
      if (!within || isAbsolute(within) || within === '..' || within.startsWith(`..${sep}`)) {
        missing.push(id);
        return;
      }
      const info = await stat(file).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
      if (!info?.isFile() || info.size !== entry.size) missing.push(id);
    }),
  );
  if (missing.length)
    throw new Error(
      `Development content is incomplete: ${missing.sort().slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ''}. Run pnpm dev:content to package existing local assets, or pnpm dev:prepare to restore assets first.`,
    );
  log(
    refresh
      ? `Using ${entries.length} content packs.`
      : `Using ${entries.length} prepared content packs, as built. To include content edits, run pnpm dev:content.`,
  );
  return entries.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // MOLEN_DEV_PACKS=reuse starts on the packs as built, without checking them against content/.
  checkDevContent({ refresh: process.env.MOLEN_DEV_PACKS !== 'reuse' }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
