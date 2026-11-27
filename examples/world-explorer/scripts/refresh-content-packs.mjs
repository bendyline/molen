// Repackage the content packs whose files changed since public/packs was built, so `pnpm dev`
// serves what content/ holds. Checking is cheap: a listing and a stat of every source (about 2 s
// in all, mostly worldgen's 20k files) and the staged manifests. A file is hashed only when it was
// modified after its pack was built, and a pack is rebuilt only when a file's bytes differ, a file
// was added or removed, or its molen-pack.source.json settings changed, so switching branches
// does not repackage 21 GB of unchanged models. Fetching or generating models (pnpm assets:fetch,
// pnpm assets:build) and generating placement catalogs stay explicit: pnpm dev:content does all.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, utimes } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack, listPackSource, openFilePack } from '@bendyline/molen-pack/node';
import { readStructurePlacements } from '../../../packages/worldgen-earth/scripts/placement-sources.mjs';
import { buildEntityPack } from './build-entity-pack.mjs';
import { buildRegionalPacks, ROUTES } from './build-regional-packs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_ROOT = resolve(root, '../../content');
export const PACKS_DIR = resolve(root, 'public/packs');

/**
 * content/ directories the explorer serves, one pack each, in build order. `entities` is also
 * written unzipped; `worldgen` (packaged separately) is split into regional model archives.
 */
export const CONTENT_PACKS = [
  'entities',
  'earth',
  'ecology',
  'wildlife',
  'sky',
  'sounds',
  'glyphs-kyoto',
];
export const REGIONAL_PACKS = 'worldgen';

// A build reads its sources before it writes the pack, so a file edited during the build can be
// older than the pack yet missing from it. Files this much older than their pack are hashed too.
const BUILD_SLACK_MS = 10 * 60_000;

function sha256File(path) {
  return new Promise((done, fail) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('error', fail)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => done(`sha256:${hash.digest('hex')}`));
  });
}

async function eachLimit(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function inside(directory, file) {
  const within = relative(resolve(directory), file);
  return !!within && !isAbsolute(within) && within !== '..' && !within.startsWith(`..${sep}`);
}

/** A staged pack's manifest and when it was written, or undefined when it is not usable. */
async function readStaged(directory, entry) {
  if (typeof entry?.file !== 'string') return undefined;
  const path = resolve(directory, entry.file);
  if (!inside(directory, path)) return undefined;
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile() || info.size !== entry.size) return undefined;
  try {
    if (entry.file.endsWith('molen-pack.json'))
      return { path, builtMs: info.mtimeMs, manifest: JSON.parse(await readFile(path, 'utf8')) };
    const pack = await openFilePack(path);
    try {
      return { path, builtMs: info.mtimeMs, manifest: pack.manifest };
    } finally {
      pack.close();
    }
  } catch {
    return undefined;
  }
}

/** The first pack setting that differs from the staged manifest, or undefined. */
function changedSetting(config, manifest, regional) {
  for (const field of ['id', 'version', 'title', 'license', 'notice'])
    if (config[field] !== manifest[field]) return field;
  const want = Object.entries(config.provides).map(([role, paths]) => [role, [paths].flat()]);
  if (regional) want.push(['model-archives', [ROUTES]]);
  const have = manifest.provides ?? {};
  if (want.length !== Object.keys(have).length) return 'provides';
  for (const [role, paths] of want)
    if (JSON.stringify(paths) !== JSON.stringify(have[role])) return 'provides';
  // Regional model ids move into the core's routes, so only a whole pack's ids compare directly.
  if (!regional)
    for (const [id, path] of Object.entries(config.ids))
      if (manifest.ids?.[id] !== path) return 'ids';
  return undefined;
}

function sample(paths) {
  const shown = paths.slice(0, 3).join(', ');
  return paths.length > 3 ? `${shown}, +${paths.length - 3} more` : shown;
}

/**
 * Compare one content source with the packs staged from it. Returns why it needs repackaging, or
 * undefined when the staged packs hold exactly its files (stamping them as checked).
 */
export async function packStaleness(sourceDir, outDir, index, { regional = false } = {}) {
  const startedMs = Date.now();
  const source = await listPackSource(sourceDir);
  const { config } = source;
  const ids = Object.keys(index.packs).filter(
    (id) => id === config.id || (regional && id.startsWith(`${config.id}.models.`)),
  );
  if (!ids.includes(config.id)) return 'not packaged yet';
  const staged = [];
  for (const id of ids) {
    const pack = await readStaged(outDir, index.packs[id]);
    if (!pack) return `${id} is missing or unreadable`;
    staged.push(pack);
  }
  const core = staged[ids.indexOf(config.id)];
  const setting = changedSetting(config, core.manifest, regional);
  if (setting) return `its ${setting} setting changed`;
  const entries = new Map();
  for (const pack of staged)
    for (const [path, entry] of Object.entries(pack.manifest.entries))
      if (!(regional && path === ROUTES)) entries.set(path, { ...entry, builtMs: pack.builtMs });
  const present = new Set(source.paths);
  const added = source.paths.filter((path) => !entries.has(path));
  const removed = [...entries.keys()].filter((path) => !present.has(path));
  const changed = [];
  let hashed = 0;
  await eachLimit(
    source.paths.filter((path) => entries.has(path)),
    16,
    async (path) => {
      const entry = entries.get(path);
      const file = join(source.dir, path);
      const info = await stat(file);
      if (info.size !== entry.size) changed.push(path);
      else if (info.mtimeMs > entry.builtMs - BUILD_SLACK_MS) {
        hashed++;
        if ((await sha256File(file)) !== entry.sha256) changed.push(path);
      }
    },
  );
  const reasons = [];
  if (changed.length) reasons.push(`${changed.length} changed (${sample(changed.sort())})`);
  if (added.length) reasons.push(`${added.length} added (${sample(added)})`);
  if (removed.length) reasons.push(`${removed.length} removed (${sample(removed.sort())})`);
  if (reasons.length) return `files ${reasons.join(', ')}`;
  // Touched but identical (a branch switch, a regenerated file with the same bytes): mark the
  // packs as checked now, so the next start does not hash the same files again.
  if (hashed > 0) {
    const when = new Date(startedMs);
    await Promise.all(staged.map((pack) => utimes(pack.path, when, when).catch(() => {})));
  }
  return undefined;
}

async function readIndex(outDir) {
  return JSON.parse(await readFile(join(outDir, 'index.json'), 'utf8'));
}

const megabytes = (bytes) => `${Math.round(bytes / 1048576)} MB`;
const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;

/**
 * Repackage every stale pack into `outDir`. A pack that fails to build is reported and its
 * previous build kept, so the app still starts. Returns the ids rebuilt and the failures.
 */
export async function refreshContentPacks({
  contentRoot = CONTENT_ROOT,
  outDir = PACKS_DIR,
  packs = CONTENT_PACKS,
  regional = REGIONAL_PACKS,
  compression = process.env.MOLEN_PACK_COMPRESSION === 'store' ? 'store' : undefined,
  log = console.log,
} = {}) {
  const startedMs = Date.now();
  const rebuilt = [];
  const failed = [];
  const names = regional ? [...packs, regional] : [...packs];
  for (const name of names) {
    const sourceDir = join(contentRoot, name);
    const isRegional = name === regional;
    let reason;
    try {
      reason = await packStaleness(sourceDir, outDir, await readIndex(outDir), {
        regional: isRegional,
      });
    } catch (error) {
      failed.push({ name, error });
      log(`content/${name}: cannot check it, serving its previous build. ${error.message}`);
      continue;
    }
    if (!reason) continue;
    log(`content/${name}: repackaging, ${reason}.`);
    const buildStartedMs = Date.now();
    try {
      if (isRegional) {
        const placements = (await readStructurePlacements()).entries;
        const { core } = await buildRegionalPacks(sourceDir, { outDir, placements, compression });
        log(`  ${core.file} and its regional archives in ${seconds(Date.now() - buildStartedMs)}`);
      } else {
        const build = name === 'entities' ? buildEntityPack : buildPack;
        const built = await build(sourceDir, { outDir, compression });
        log(
          `  ${built.file} (${megabytes(built.size)}) in ${seconds(Date.now() - buildStartedMs)}`,
        );
      }
      rebuilt.push(name);
    } catch (error) {
      failed.push({ name, error });
      log(`  failed, serving the previous build: ${error.message}`);
      // Sidecars arrive with commits; their models are build outputs restored separately.
      if (/model/i.test(error.message))
        log(
          '  Models missing or stale for committed sidecars? pnpm dev:prepare fetches them (pnpm assets:build regenerates them).',
        );
    }
  }
  if (rebuilt.length === 0 && failed.length === 0)
    log(`Content packs match content/ (checked in ${seconds(Date.now() - startedMs)}).`);
  return { rebuilt, failed };
}
