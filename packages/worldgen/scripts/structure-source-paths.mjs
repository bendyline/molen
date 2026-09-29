/** Source-only addressing. Runtime model IDs and the Earth placement index remain independent. */
import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceRepositoryRoot = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../..',
);
export const structureSourceRoot = resolve(sourceRepositoryRoot, 'content/worldgen/source');
export const structureSourceIndexPath = resolve(structureSourceRoot, 'structure-index.json');
const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
let registryCache;
let registryStamp;

/** Standard WGS84 geohash. Arguments are (longitude, latitude); Qualla's API reverses them. */
export function encodeSourceGeohash(longitude, latitude, length = 3) {
  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > 12
  )
    throw new Error('invalid geohash coordinate or length');
  let west = -180,
    east = 180,
    south = -90,
    north = 90;
  let value = 0,
    bits = 0,
    hash = '';
  while (hash.length < length) {
    const longitudeBit = (hash.length * 5 + bits) % 2 === 0;
    const midpoint = longitudeBit ? (west + east) / 2 : (south + north) / 2;
    const high = (longitudeBit ? longitude : latitude) >= midpoint;
    value = (value << 1) | Number(high);
    if (longitudeBit) {
      if (high) west = midpoint;
      else east = midpoint;
    } else if (high) south = midpoint;
    else north = midpoint;
    if (++bits === 5) {
      hash += alphabet[value];
      bits = 0;
      value = 0;
    }
  }
  return hash;
}

export function validateSourceKey(key) {
  if (typeof key !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/.test(key))
    throw new Error(`Invalid structure source key: ${key}`);
  return key;
}

export function sourcePathWithin(directory, ...segments) {
  if (
    segments.some(
      (segment) =>
        typeof segment !== 'string' ||
        segment.includes('\0') ||
        isAbsolute(segment) ||
        win32.isAbsolute(segment) ||
        segment.split(/[\\/]/).includes('..'),
    )
  )
    throw new Error('Structure source paths must be relative');
  const path = resolve(directory, ...segments);
  const rel = relative(directory, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
    throw new Error('Structure source path escapes its directory');
  return path;
}

export function knownSourceEntries() {
  const stamp = statSync(structureSourceIndexPath).mtimeMs;
  if (registryCache && registryStamp === stamp) return registryCache;
  const registry = JSON.parse(readFileSync(structureSourceIndexPath, 'utf8'));
  if (registry.format !== 'molen/structure-source-index@1' || !Array.isArray(registry.entries))
    throw new Error('Invalid structure source index');
  const keys = new Set(),
    paths = new Set(),
    assets = new Set();
  for (const entry of registry.entries) {
    validateSourceKey(entry.key);
    if (!entry.sourcePath?.startsWith('content/worldgen/source/'))
      throw new Error(`Invalid source path for ${entry.key}`);
    sourcePathWithin(
      structureSourceRoot,
      entry.sourcePath.slice('content/worldgen/source/'.length),
    );
    if (
      keys.has(entry.key) ||
      paths.has(entry.sourcePath) ||
      (entry.assetId && assets.has(entry.assetId))
    )
      throw new Error(`Duplicate structure source: ${entry.key}`);
    keys.add(entry.key);
    paths.add(entry.sourcePath);
    if (entry.assetId) assets.add(entry.assetId);
    if (entry.anchor) Object.freeze(entry.anchor);
    Object.freeze(entry);
  }
  registryStamp = stamp;
  registryCache = Object.freeze(registry.entries);
  return registryCache;
}

/** Unknown authoring keys use research coordinates; this does not create a runtime placement. */
export function proposedStructureSourcePath(key) {
  validateSourceKey(key);
  const catalog = JSON.parse(
    readFileSync(resolve(structureSourceRoot, 'next-1000/candidates.json'), 'utf8'),
  );
  const collections = JSON.parse(
    readFileSync(resolve(structureSourceRoot, 'next-1000/collections.json'), 'utf8'),
  );
  const member = collections.collections
    .flatMap((collection) => collection.members)
    .find((entry) => entry.sourceKey === key);
  const candidateId = key.match(/^(n\d{4})(?:_|$)/)?.[1].toUpperCase();
  const candidate = member ?? catalog.candidates.find((entry) => entry.id === candidateId);
  // A collection parent is not a single geographic object. Require a member key.
  const coordinate =
    !member && collections.collections.some((entry) => entry.id === candidateId)
      ? undefined
      : candidate?.referenceCoordinate;
  const geohash3 = coordinate
    ? encodeSourceGeohash(coordinate.longitude, coordinate.latitude)
    : undefined;
  return `content/worldgen/source/places/${geohash3 ? `${geohash3.slice(0, 2)}/${geohash3}` : 'unlocated'}/${key}`;
}

/** Registered bundles stay pinned if placement coordinates are refined across a cell boundary. */
export function structureSourceDirectory(key) {
  validateSourceKey(key);
  const path =
    knownSourceEntries().find((entry) => entry.key === key)?.sourcePath ??
    proposedStructureSourcePath(key);
  return sourcePathWithin(structureSourceRoot, path.slice('content/worldgen/source/'.length));
}

export function structureSourcePath(key, ...segments) {
  return sourcePathWithin(structureSourceDirectory(key), ...segments);
}
