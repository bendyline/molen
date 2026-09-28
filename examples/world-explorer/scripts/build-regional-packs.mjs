// Keep only one region's payload in memory while building. Source JSON stays in the core so
// styles, material graphs, catalogs and asset bounds are available before a model is requested.
import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createPack, describePack, sha256 } from '@bendyline/molen-pack';
import { listPackSource, openFilePack } from '@bendyline/molen-pack/node';
import { encodeStructureGeohash } from '@bendyline/molen-worldgen-earth/kernel';

const MiB = 1024 * 1024;
const ROUTES = 'model-archives.json';

/** Deterministic assignment; a model bundle is never split across archives. */
export function groupRegionalModels(
  models,
  { id, maxShardBytes = 256 * MiB, maxSingleModelBytes = maxShardBytes } = {},
) {
  if (!Number.isSafeInteger(maxShardBytes) || maxShardBytes < 1024 || maxShardBytes > 512 * MiB)
    throw new Error('maxShardBytes must be between 1 KiB and 512 MiB');
  if (
    !Number.isSafeInteger(maxSingleModelBytes) ||
    maxSingleModelBytes < maxShardBytes ||
    maxSingleModelBytes > 512 * MiB
  )
    throw new Error('maxSingleModelBytes must be between maxShardBytes and 512 MiB');
  const budget = Math.floor(maxShardBytes * 0.95); // ZIP/manifest overhead, even for incompressible data.
  const groups = new Map();
  for (const model of [...models].sort((a, b) => a.path.localeCompare(b.path, 'en'))) {
    if (model.size > Math.floor(maxSingleModelBytes * 0.95))
      throw new Error(`Model bundle exceeds the shard budget: ${model.path}`);
    const region = model.anchor ? `g_${encodeStructureGeohash(...model.anchor, 2)}` : 'shared';
    if (!groups.has(region)) groups.set(region, []);
    groups.get(region).push(model);
  }
  const shards = [];
  for (const [region, group] of [...groups].sort(([a], [b]) => a.localeCompare(b, 'en'))) {
    let part = 0;
    let current;
    for (const model of group) {
      if (!current || current.size + model.size > budget) {
        current = {
          id: `${id}.models.${region}.p${String(++part).padStart(3, '0')}`,
          region,
          size: 0,
          models: [],
        };
        shards.push(current);
      }
      current.models.push(model);
      current.size += model.size;
      if (model.size > budget) current.maxArchiveBytes = maxSingleModelBytes;
    }
  }
  return shards;
}

function includedRelative(base, relative, selected) {
  // Only source-selected paths may become routes. No lexical '..', backslash, drive or URI paths.
  if (
    typeof relative !== 'string' ||
    /[\\:]/.test(relative) ||
    [...relative].some((character) => character.charCodeAt(0) < 32) ||
    relative.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    throw new Error(`Invalid model member: ${relative}`);
  const path = base ? `${base}/${relative}` : relative;
  if (!selected.has(path)) throw new Error(`Model member is not an included source file: ${path}`);
  return path;
}

async function writeArchive(outDir, built, maxBytes) {
  if (built.bytes.length > maxBytes)
    throw new Error(`Built archive exceeds limit: ${built.manifest.id}`);
  const digest = await sha256(built.bytes);
  const file = `${built.manifest.id}-${digest.slice(7, 19)}.zip`;
  await writeFile(join(outDir, file), built.bytes);
  return {
    version: built.manifest.version,
    file,
    size: built.bytes.length,
    contentHash: built.manifest.contentHash,
  };
}

/** Build worldgen's small style core plus lazily opened geographic model archives. */
export async function buildRegionalPacks(
  sourceDir,
  {
    outDir,
    placements = [],
    maxShardBytes = 256 * MiB,
    maxSingleModelBytes = 512 * MiB,
    reuseFromDir,
    onBuilt = () => {},
  } = {},
) {
  const source = await listPackSource(sourceDir);
  const { config } = source;
  const selected = new Set(source.paths);
  if (selected.has(ROUTES)) throw new Error(`Source already includes reserved ${ROUTES}`);
  const anchors = new Map();
  for (const entry of placements) {
    if (!entry.asset || !Array.isArray(entry.anchor)) continue;
    const previous = anchors.get(entry.asset);
    // A reusable model occurring in several distant regions belongs in the shared archive.
    if (previous === null) continue;
    if (
      previous &&
      encodeStructureGeohash(...previous, 2) !== encodeStructureGeohash(...entry.anchor, 2)
    )
      anchors.set(entry.asset, null);
    else anchors.set(entry.asset, entry.anchor);
  }
  const models = [];
  const moved = new Set();
  const aliasIds = {};
  for (const path of source.paths.filter(
    (path) => path.endsWith('/asset.json') || path === 'asset.json',
  )) {
    const sidecar = JSON.parse(await readFile(join(source.dir, path), 'utf8'));
    if (sidecar.format !== 'molen/asset@1' || sidecar.kind !== 'model') continue;
    const base = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const main = includedRelative(base, sidecar.files?.main, selected);
    const payload = new Set([main]);
    for (const variant of Object.values(sidecar.files?.variants ?? {}))
      payload.add(includedRelative(base, variant, selected));
    // External buffers and texture images remain beside glTF files, even when the current
    // built-in catalog happens to use self-contained GLBs exclusively.
    for (const candidate of source.paths)
      if (candidate.startsWith(`${base}/`) && !candidate.endsWith('.json')) payload.add(candidate);
    const paths = [...payload].sort();
    let size = 0;
    for (const member of paths) {
      if (moved.has(member)) throw new Error(`Model payload is claimed twice: ${member}`);
      moved.add(member);
      size += (await stat(join(source.dir, member))).size;
    }
    if (Object.hasOwn(aliasIds, sidecar.id)) throw new Error(`Duplicate model id: ${sidecar.id}`);
    aliasIds[sidecar.id] = main;
    models.push({ path: main, paths, size, anchor: anchors.get(sidecar.id) ?? undefined });
  }
  const shards = groupRegionalModels(models, { id: config.id, maxShardBytes, maxSingleModelBytes });
  const target = resolve(outDir);
  await mkdir(target, { recursive: true });
  let index = { format: 'molen/pack-index@1', packs: {} };
  try {
    index = JSON.parse(await readFile(join(target, 'index.json'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (index.format !== 'molen/pack-index@1' || !index.packs)
    throw new Error('Invalid existing pack index');
  let reuseIndex;
  if (reuseFromDir && resolve(reuseFromDir) !== target) {
    try {
      const candidate = JSON.parse(await readFile(join(reuseFromDir, 'index.json'), 'utf8'));
      if (candidate.format === 'molen/pack-index@1' && candidate.packs) reuseIndex = candidate;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const routes = { format: 'molen/model-archives@1', archives: {}, files: {}, ids: aliasIds };
  const entries = {};
  const modelHashes = new Map();
  const read = async (path) => ({
    path,
    bytes: new Uint8Array(await readFile(join(source.dir, path))),
  });
  for (const shard of shards) {
    const archiveLimit = shard.maxArchiveBytes ?? maxShardBytes;
    const files = [];
    for (const model of shard.models)
      for (const path of model.paths) {
        files.push(await read(path));
        routes.files[path] = shard.id;
      }
    if (config.notice && !files.some((file) => file.path === config.notice))
      files.push(await read(config.notice));
    const packOptions = {
      id: shard.id,
      version: config.version,
      title: `${config.title ?? config.id}: ${shard.region}`,
      ...(config.license ? { license: config.license } : {}),
      ...(config.notice ? { notice: config.notice } : {}),
    };
    const described = await describePack(files, packOptions);
    for (const [path, entry] of Object.entries(described.entries))
      modelHashes.set(path, entry.sha256);
    let entry;
    for (const [directory, previous] of [
      [target, index.packs[shard.id]],
      [reuseFromDir, reuseIndex?.packs[shard.id]],
    ]) {
      if (!directory || entry) continue;
      if (
        previous?.contentHash === described.contentHash &&
        previous.version === config.version &&
        previous.size <= archiveLimit &&
        /^[a-zA-Z0-9_.-]+\.zip$/.test(previous.file) &&
        previous.file.startsWith(`${shard.id}-`)
      ) {
        let cached;
        try {
          const archive = join(directory, previous.file);
          if ((await stat(archive)).size !== previous.size) continue;
          cached = await openFilePack(archive, {
            expect: { contentHash: described.contentHash },
          });
          if (
            ['id', 'version', 'title', 'license', 'notice'].every(
              (field) => cached.manifest[field] === described[field],
            )
          ) {
            if (resolve(directory) !== target) await copyFile(archive, join(target, previous.file));
            entry = previous;
          }
        } catch {
          /* Missing or invalid cached archives are rebuilt below. */
        } finally {
          cached?.close();
        }
      }
    }
    if (!entry)
      entry = await writeArchive(target, await createPack(files, packOptions), archiveLimit);
    entries[shard.id] = entry;
    routes.archives[shard.id] = { contentHash: entry.contentHash };
    onBuilt(shard.id, entry);
  }
  const core = [];
  for (const path of source.paths) if (!moved.has(path)) core.push(await read(path));
  // A concurrent asset import must not publish metadata referring to absent or stale bytes.
  const latest = await listPackSource(sourceDir);
  if (JSON.stringify(latest.paths) !== JSON.stringify(source.paths))
    throw new Error(
      'Content source file list changed during regional build; rerun after imports finish',
    );
  const corePaths = new Set(core.map((file) => file.path));
  for (const file of core) {
    if (!file.path.endsWith('.json')) continue;
    const doc = JSON.parse(new TextDecoder().decode(file.bytes));
    if (doc.format === 'molen/asset@1' && doc.kind === 'model' && doc.hash) {
      const base = file.path.slice(0, file.path.lastIndexOf('/') + 1);
      if (modelHashes.get(`${base}${doc.files.main}`) !== doc.hash)
        throw new Error(`Model changed during regional build: ${file.path}`);
    }
    if (doc.format === 'molen/stylepack@1') {
      const base = file.path.slice(0, file.path.lastIndexOf('/') + 1);
      for (const ref of [...Object.values(doc.materials ?? {}), ...Object.values(doc.assets ?? {})])
        if (!corePaths.has(`${base}${ref}`)) throw new Error(`Style core is missing ${ref}`);
    }
  }
  core.push({ path: ROUTES, bytes: new TextEncoder().encode(`${JSON.stringify(routes)}\n`) });
  const coreIds = {};
  for (const [id, path] of Object.entries(config.ids)) {
    if (moved.has(path)) routes.ids[id] = path;
    else coreIds[id] = path;
  }
  // Explicit source ids may supplement sidecar ids, so serialize after adding them.
  core[core.length - 1].bytes = new TextEncoder().encode(`${JSON.stringify(routes)}\n`);
  const built = await createPack(core, {
    ...config,
    ids: coreIds,
    provides: { ...config.provides, 'model-archives': ROUTES },
  });
  entries[config.id] = await writeArchive(target, built, 512 * MiB);
  onBuilt(config.id, entries[config.id]);
  for (const id of Object.keys(index.packs))
    if (id === config.id || id.startsWith(`${config.id}.models.`)) delete index.packs[id];
  Object.assign(index.packs, entries);
  index.packs = Object.fromEntries(
    Object.entries(index.packs).sort(([a], [b]) => a.localeCompare(b, 'en')),
  );
  const temporary = join(target, `.index-regional-${process.pid}.json`);
  await writeFile(temporary, `${JSON.stringify(index, null, 2)}\n`);
  await rename(temporary, join(target, 'index.json'));
  // Retain old hash-named archives: already-open viewers may still request ranges from them.
  return { index, routes, core: entries[config.id], shards: entries };
}
