/** Compile independent authoring records to compact, independently loadable geographic regions. */
import { readdir, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSchema } from '../../schema/dist/index.mjs';
import {
  createStructureIndex,
  parseStructureDirectory,
  structurePlacementBounds,
  structureRegionBounds,
} from '../dist/kernel.mjs';
import {
  earthRoot,
  placementCell,
  readStructurePlacements,
  writePlacementFile,
  writePlacementPreview,
} from './placement-sources.mjs';

/** Retain source identity evidence verbatim on disk; only defined matching fields reach runtime. */
export function runtimePlacement(entry) {
  const result = JSON.parse(
    JSON.stringify(entry, (key, value) => (key === 'basis' || key === 'note' ? undefined : value)),
  );
  if (entry.mapIdentity) {
    const { wikidata, names, maxDistance } = entry.mapIdentity;
    if (wikidata || names?.length)
      result.mapIdentity = {
        ...(wikidata ? { wikidata } : {}),
        ...(names?.length ? { names } : {}),
        ...(maxDistance !== undefined ? { maxDistance } : {}),
      };
    else {
      if (entry.orientation === 'mapped')
        throw new Error(`${entry.id}: mapped orientation has no runtime identity`);
      delete result.mapIdentity;
    }
  }
  return result;
}

export function compilePlacementCatalog(catalog, { maxShardBytes = 192 * 1024 } = {}) {
  // Retain authoring evidence requirements; the compact schema checks every emitted numeric field.
  createStructureIndex(catalog);
  const document = {
    ...catalog,
    format: 'molen/structure-placement-data@1',
    entries: catalog.entries
      .map(runtimePlacement)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
  };
  getSchema('structure-placement-data').zod.parse(document);
  createStructureIndex(document);
  const files = new Map(),
    owners = new Map();
  const shards = {};
  function emit(entries, length = 2) {
    const groups = new Map();
    for (const entry of entries) {
      const key = placementCell(entry.anchor, length);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }
    for (const [id, group] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const text = `${JSON.stringify({ format: document.format, title: id, entries: group })}\n`;
      const bytes = Buffer.byteLength(text);
      if (bytes > maxShardBytes && group.length > 1 && length < 12) {
        emit(group, length + 1);
        continue;
      }
      const path = `structures/placements/cells/${id}.json`;
      shards[id] = {
        path,
        bytes,
        count: group.length,
        minLevel: Math.min(...group.map((entry) => entry.minLevel ?? 11)),
      };
      files.set(path, text);
      for (const entry of group) owners.set(entry.id, id);
    }
  }
  emit(document.entries);
  const cells = new Map();
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  const regions = [...alphabet].flatMap((a) =>
    [...alphabet].map((b) => ({ key: a + b, bounds: structureRegionBounds(a + b) })),
  );
  for (const entry of document.entries)
    for (const box of structurePlacementBounds(entry)) {
      for (const { key, bounds } of regions) {
        if (bounds[0] > box[2] || bounds[2] < box[0] || bounds[1] > box[3] || bounds[3] < box[1])
          continue;
        if (!cells.has(key)) cells.set(key, new Set());
        cells.get(key).add(owners.get(entry.id));
      }
    }
  const directory = {
    format: 'molen/structure-placement-index@1',
    shards,
    cells: Object.fromEntries(
      [...cells].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, ids]) => [key, [...ids].sort()]),
    ),
  };
  parseStructureDirectory(directory);
  files.set('structures/placements/index.json', `${JSON.stringify(directory)}\n`);
  return { directory, files, document };
}

export async function buildPlacementCatalogs({ check = false } = {}) {
  const catalog = await readStructurePlacements();
  const project = JSON.parse(
    await readFile(resolve(earthRoot, '../worldgen/project.json'), 'utf8'),
  );
  for (const entry of catalog.entries)
    if (!project.assets[entry.asset]) throw new Error(`${entry.id}: unknown asset ${entry.asset}`);
  const { files, directory } = compilePlacementCatalog(catalog);
  const cellsRoot = resolve(earthRoot, 'structures/placements/cells');
  const oldFiles = await readdir(cellsRoot).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const name of oldFiles)
    if (name.endsWith('.json') && !files.has(`structures/placements/cells/${name}`)) {
      if (check) throw new Error(`Obsolete placement shard ${name}`);
      await unlink(resolve(cellsRoot, name));
    }
  for (const [path, text] of files) {
    if (check) {
      if ((await readFile(resolve(earthRoot, path), 'utf8')) !== text)
        throw new Error(`Stale placement output ${path}`);
    } else await writePlacementFile(resolve(earthRoot, path), text);
  }
  if (!check) await writePlacementPreview();
  console.log(
    `placements: ${catalog.entries.length} sources, ${Object.keys(directory.shards).length} runtime regions`,
  );
  return directory;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildPlacementCatalogs({ check: process.argv.includes('--check') });
