// Starting the app consumes prepared content. Generation and packaging are explicit authoring work.
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

/** Check prepared pack entry points, without reading asset sources or hashing model payloads. */
export async function checkDevContent({
  directory = join(root, 'examples/world-explorer/public/packs'),
  log = console.log,
} = {}) {
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
    `Using ${entries.length} prepared content packs. To include asset edits, run pnpm dev:content.`,
  );
  return entries.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  checkDevContent().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
