/** Refresh source discovery after authoring; never edits models or runtime placement evidence. */
import { existsSync, readFileSync } from 'node:fs';
import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateFolderLocationEvidence } from './folder-location-evidence.mjs';
import { formatJson } from './format-json.mjs';
import {
  encodeSourceGeohash,
  sourceRepositoryRoot as root,
  structureSourceIndexPath,
  structureSourceRoot,
  validateSourceKey,
} from './structure-source-paths.mjs';

const posix = (path) => path.replaceAll('\\', '/');
const optionalJson = (path) =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
async function discover(directory) {
  if (!existsSync(directory)) return [];
  if (
    existsSync(resolve(directory, 'spec.json')) ||
    existsSync(resolve(directory, 'map-frame.json'))
  )
    return [directory];
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => discover(resolve(directory, entry.name))),
    )
  ).flat();
}

/** Collection members are independent identities even when a spec also names its parent plan. */
export function structureSourceCandidateId(key, spec, frame) {
  if (typeof spec?.id === 'string' && /^N\d{4}(?:_[A-Z0-9_]+)?$/.test(spec.id)) return spec.id;
  return (
    spec?.planId ??
    { 'space-needle': 'A01', 'golden-gate-bridge': 'C01', 'sr-520-floating-bridge': 'C02' }[key] ??
    spec?.id ??
    frame?.candidateId
  );
}

function placeCell(sourcePath, key) {
  const match = sourcePath?.match(
    /^content\/worldgen\/source\/places\/(?:(unlocated)|([0123456789bcdefghjkmnpqrstuvwxyz]{2})\/([0123456789bcdefghjkmnpqrstuvwxyz]{3}))\/([a-z0-9][a-z0-9_-]*)$/,
  );
  if (!match || match[4] !== key || (!match[1] && match[2] !== match[3].slice(0, 2)))
    throw new Error(`${key}: invalid canonical place source path: ${sourcePath}`);
  return match[3];
}

function anchorCell(anchor) {
  if (!Array.isArray(anchor) || anchor.length !== 2)
    throw new Error('Source anchor must contain longitude and latitude');
  return encodeSourceGeohash(anchor[0], anchor[1]);
}

/** Pin the authored cell on first registration; later evidence never silently relocates it. */
export function resolvePlaceSourceLocation({
  key,
  actualPath,
  previous,
  frameAnchor,
  placementAnchor,
  placementStatus,
  specReference,
  catalogReference,
  includeLegacy = false,
}) {
  validateSourceKey(key);
  const candidates = [
    { anchor: frameAnchor, anchorBasis: 'source-map-frame' },
    { anchor: placementAnchor, anchorBasis: `placement:${placementStatus}` },
    {
      anchor: specReference ? [specReference.longitude, specReference.latitude] : undefined,
      anchorBasis: 'research-reference',
    },
    {
      anchor: catalogReference
        ? [catalogReference.longitude, catalogReference.latitude]
        : undefined,
      anchorBasis: 'research-reference',
    },
  ].filter((candidate) => candidate.anchor != null);
  let sourcePath = previous?.sourcePath ?? actualPath;
  let selected;
  if (previous) {
    // Absence is intentional for pinned unlocated bundles, even after coordinates are researched.
    selected = { anchor: previous.anchor, anchorBasis: previous.anchorBasis };
  } else if (includeLegacy) {
    selected = candidates[0];
    const cell = selected ? anchorCell(selected.anchor) : undefined;
    sourcePath = `content/worldgen/source/places/${cell ? `${cell.slice(0, 2)}/${cell}` : 'unlocated'}/${key}`;
  }
  const cell = placeCell(sourcePath, key);
  if (!previous && !includeLegacy && cell)
    selected = candidates.find((candidate) => anchorCell(candidate.anchor) === cell);
  if (cell && (!selected?.anchor || anchorCell(selected.anchor) !== cell))
    throw new Error(`${key}: place cell ${cell} has no supporting organizational anchor`);
  if (!cell && selected?.anchor)
    throw new Error(`${key}: an unlocated source cannot have an organizational anchor`);
  if (!includeLegacy && actualPath !== sourcePath)
    throw new Error(
      `${key}: expected ${sourcePath}, found ${actualPath}; update the registry deliberately to relocate`,
    );
  return {
    sourcePath,
    anchor: selected?.anchor,
    anchorBasis: selected?.anchorBasis,
    geohash2: cell?.slice(0, 2),
    geohash3: cell,
  };
}

export async function buildStructureSourceIndex({ includeLegacy = false } = {}) {
  const prior = optionalJson(structureSourceIndexPath);
  const oldByKey = new Map((prior?.entries ?? []).map((entry) => [entry.key, entry]));
  const catalog = optionalJson(resolve(structureSourceRoot, 'next-1000/candidates.json'));
  const members = optionalJson(
    resolve(structureSourceRoot, 'next-1000/collections.json'),
  ).collections.flatMap((entry) => entry.members);
  const candidates = new Map([...catalog.candidates, ...members].map((entry) => [entry.id, entry]));
  const placements = optionalJson(
    resolve(root, 'content/earth/structures/placements.json'),
  ).entries;
  const directories = ['places', 'reusable', 'map-structures'];
  if (includeLegacy) directories.push('next-1000/models', 'site-structures');
  const bundles = (
    await Promise.all(directories.map((dir) => discover(resolve(structureSourceRoot, dir))))
  ).flat();
  const entries = [];
  for (const dir of bundles) {
    const key = validateSourceKey(basename(dir));
    const previous = oldByKey.get(key);
    const spec = optionalJson(resolve(dir, 'spec.json'));
    const frame = optionalJson(resolve(dir, 'map-frame.json'));
    const candidateId = structureSourceCandidateId(key, spec, frame);
    const candidate = candidates.get(candidateId);
    const assetId = spec?.assetId ?? spec?.id;
    const actualPath = posix(relative(root, dir));
    const isMap = actualPath.includes('/map-structures/');
    const reusable = isMap || /^[DE]\d\d$/.test(candidateId);
    const role = reusable ? 'reusable' : 'place';
    const collection = isMap
      ? 'map-structures'
      : /^N\d{4}/.test(candidateId)
        ? 'next-1000'
        : 'site-structures';
    const placement = placements.find((entry) => entry.asset === assetId);
    const location = reusable
      ? {
          sourcePath:
            previous?.sourcePath ??
            (isMap
              ? actualPath
              : `content/worldgen/source/reusable/${candidateId.startsWith('D') ? 'urban' : 'infrastructure'}/${key}`),
        }
      : resolvePlaceSourceLocation({
          key,
          actualPath,
          previous,
          frameAnchor: frame?.anchor,
          placementAnchor: placement?.anchor,
          placementStatus: placement?.status,
          specReference: spec?.referenceCoordinate,
          catalogReference: candidate?.referenceCoordinate,
          includeLegacy,
        });
    const { sourcePath, anchor, anchorBasis, geohash2, geohash3 } = location;
    if (!includeLegacy && actualPath !== sourcePath)
      throw new Error(
        `${key}: expected ${sourcePath}, found ${actualPath}; update the registry deliberately to relocate`,
      );
    const legacySourcePath =
      previous?.legacySourcePath ?? (actualPath !== sourcePath ? actualPath : undefined);
    entries.push({
      key,
      sourcePath,
      collection,
      candidateId,
      assetId,
      title: spec?.title ?? candidate?.title ?? key,
      role,
      anchor,
      anchorBasis,
      geohash2,
      geohash3,
      legacySourcePath,
      hasModel: existsSync(resolve(dir, 'models/source.glb')),
    });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  for (const field of ['key', 'sourcePath', 'assetId']) {
    const values = entries.map((entry) => entry[field]).filter(Boolean);
    if (new Set(values).size !== values.length) throw new Error(`Duplicate source ${field}`);
  }
  validateFolderLocationEvidence(
    optionalJson(resolve(structureSourceRoot, 'folder-location-evidence.json')),
    entries,
  );
  return {
    format: 'molen/structure-source-index@1',
    coordinateOrder: 'longitude, latitude',
    policy:
      'Geographic sources use places/geohash2/geohash3/key; reusable models use semantic folders. Folder anchors are organizational references, not placement approval. Registered paths stay pinned when placement evidence changes.',
    entries: JSON.parse(JSON.stringify(entries)),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const registry = await buildStructureSourceIndex();
  const text = `${formatJson(registry)}\n`;
  if (process.argv.includes('--check')) {
    if ((await readFile(structureSourceIndexPath, 'utf8')).replaceAll('\r\n', '\n') !== text)
      throw new Error(
        'Structure source index is stale; run node packages/worldgen/scripts/index-structure-sources.mjs',
      );
  } else {
    const temporary = `${structureSourceIndexPath}.${process.pid}.tmp`;
    await writeFile(temporary, text, { flag: 'wx' });
    await rename(temporary, structureSourceIndexPath);
  }
  console.log(`Structure source index: ${registry.entries.length} bundles`);
}
