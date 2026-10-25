/** Placement authoring storage. Runtime catalogs are generated separately. */

import { readdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const earthRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/earth');
export const placementSourceRoot = resolve(earthRoot, 'source/placements');
export const placementPreviewPath = resolve(earthRoot, 'structures/placements/authoring.json');

// This organizational geohash does not establish or approve geographic placement.
export function placementCell([longitude, latitude], length = 3) {
  if (
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90
  )
    throw new Error('Invalid placement anchor');
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  const ranges = [
    [-180, 180],
    [-90, 90],
  ];
  let hash = '',
    value = 0;
  for (let bit = 0; bit < length * 5; bit++) {
    const axis = bit % 2,
      range = ranges[axis],
      mid = (range[0] + range[1]) / 2;
    const high = [longitude, latitude][axis] >= mid;
    value = value * 2 + Number(high);
    range[high ? 0 : 1] = mid;
    if (bit % 5 === 4) {
      hash += alphabet[value];
      value = 0;
    }
  }
  return hash;
}

export function placementSourcePath(entry, root = placementSourceRoot) {
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(entry.id)) throw new Error('Invalid placement id');
  const cell = placementCell(entry.anchor);
  return resolve(root, cell.slice(0, 2), cell, `${entry.id}.json`);
}

function* sourceFiles(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    const path = resolve(dir, item.name);
    if (item.isDirectory()) yield* sourceFiles(path);
    else if (item.isFile() && item.name.endsWith('.json')) yield path;
  }
}

function collectSources(records, root) {
  const entries = [],
    paths = new Map();
  for (const [path, entry] of records) {
    if (paths.has(entry.id)) throw new Error(`Duplicate placement ${entry.id}`);
    if (placementSourcePath(entry, root) !== path) throw new Error(`Misplaced source: ${path}`);
    entries.push(entry);
    paths.set(entry.id, path);
  }
  entries.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    catalog: {
      format: 'molen/structure-placements@1',
      title: 'Well-known structure placements',
      entries,
    },
    paths,
  };
}

export async function readPlacementSources(root = placementSourceRoot) {
  const records = [];
  for (const path of sourceFiles(root))
    records.push([path, JSON.parse(await readFile(path, 'utf8'))]);
  return collectSources(records, root);
}

/** For synchronous discovery ledgers; reads the same authoritative records without a build. */
export function readPlacementSourcesSync(root = placementSourceRoot) {
  return collectSources(
    [...sourceFiles(root)].map((path) => [path, JSON.parse(readFileSync(path, 'utf8'))]),
    root,
  );
}

export async function readStructurePlacements() {
  return (await readPlacementSources()).catalog;
}

export async function writePlacementFile(path, text) {
  await mkdir(dirname(path), { recursive: true });
  try {
    if ((await readFile(path, 'utf8')) === text) return;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, text, { flag: 'wx' });
  try {
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
}

/** Writes one authoritative record; unrelated placements are never rewritten. */
export async function writeStructurePlacement(entry) {
  const { paths } = await readPlacementSources();
  const path = placementSourcePath(entry);
  await writePlacementFile(path, `${JSON.stringify(entry, null, 2)}\n`);
  const previous = paths.get(entry.id);
  if (previous && previous !== path) await unlink(previous);
  await writePlacementPreview();
}

/** Local-only aggregate for geographic review fixtures; never included in an Earth pack. */
export async function writePlacementPreview() {
  const catalog = await readStructurePlacements();
  await writePlacementFile(placementPreviewPath, `${JSON.stringify(catalog, null, 2)}\n`);
  return catalog;
}
