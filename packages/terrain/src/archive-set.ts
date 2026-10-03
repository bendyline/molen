// molen/archive-set@1: one logical tile pyramid split across many PMTiles archives.
//
// Planet-scale archives outgrow what CDNs cache as a single object (Cloudflare edge-caches objects
// up to 512 MB, for example), so producers cut them into a coarse `base` archive plus detail
// archives. Detail archives are partitioned one of two ways:
//
// - by the tile at a fixed `partitionLevel`: every detail tile belongs to the archive whose
//   `partitions` list contains the index `y * 2^partitionLevel + x` of its ancestor at that level;
// - by geohash, in `geohash` tiers: each tier covers a band of levels with one archive per geohash
//   cell of its `precision`, named by a URL template, and every tile belongs to the cell holding
//   its center (`terrainTileGeohash`). Only the cells listed in `cells` have archives, so open
//   ocean or empty land costs no requests. Equal-angle cells match data organized by geohash and
//   make archive names readable (`g3/c23.pmtiles`); a set can stack tiers, e.g. two-character
//   cells for mid levels and three-character cells for detail.
//
// This module holds the format types, the run-length list codec and a pure router; the client
// half opens the archives (`createTerrainArchiveSetArchive`).

import type { TerrainArchiveSetTileType } from './archive-set-schema';
import { geohashFromIndex, geohashIndex, terrainTileGeohash } from './geohash';

export type { TerrainArchiveSetTileType } from './archive-set-schema';

/** The coarse archive serving every level from `minLevel` through `maxLevel`. */
export interface TerrainArchiveSetBase {
  /** Archive URL, relative to the archive-set document or absolute. */
  url: string;
  minLevel: number;
  maxLevel: number;
  bytes?: number;
  sha256?: string;
}

/** One detail archive and the partition cells it owns. */
export interface TerrainArchiveSetEntry {
  id: string;
  /** Archive URL, relative to the archive-set document or absolute. */
  url: string;
  minLevel: number;
  maxLevel: number;
  /** Run-length list of partition indices (`y * 2^partitionLevel + x`), e.g. `"40-44,60"`. */
  partitions: string;
  /** Informational `[west, south, east, north]` in degrees. */
  bounds?: [number, number, number, number];
  bytes?: number;
  sha256?: string;
}

/** One archive per geohash cell for a band of levels. */
export interface TerrainArchiveSetGeohashTier {
  /** Geohash length of a cell, 1-6 (3 is 1.40625° square, about 156 km at the equator). */
  precision: number;
  minLevel: number;
  maxLevel: number;
  /** Archive URL template, relative to the document or absolute; `{cell}` becomes the geohash. */
  url: string;
  /** Run-length list of the cells that have an archive, as geohash indices (`geohashIndex`). */
  cells: string;
}

export interface TerrainArchiveSetDescriptor {
  format: 'molen/archive-set@1';
  name: string;
  /** Payload type shared by every archive in the set. */
  tileType: TerrainArchiveSetTileType;
  /**
   * Level whose tiles partition the `archives` (at most 10: a 1M-cell lookup). Required when
   * `archives` is not empty.
   */
  partitionLevel?: number;
  base?: TerrainArchiveSetBase;
  archives: TerrainArchiveSetEntry[];
  /** Geohash-partitioned tiers, each over its own band of levels. */
  geohash?: TerrainArchiveSetGeohashTier[];
}

/** Which archive serves a tile: the base, one detail entry, or one geohash cell's archive. */
export type TerrainArchiveSetRoute =
  | { kind: 'base'; base: TerrainArchiveSetBase }
  | { kind: 'archive'; entry: TerrainArchiveSetEntry }
  | { kind: 'cell'; tier: TerrainArchiveSetGeohashTier; cell: string; id: string; url: string };

export interface TerrainArchiveSetRouter {
  readonly descriptor: TerrainArchiveSetDescriptor;
  /** Coarsest and finest levels any archive in the set serves. */
  readonly minLevel: number;
  readonly maxLevel: number;
  /** The archive holding XYZ tile `level/x/y`, or undefined when no archive covers it. */
  resolve(level: number, x: number, y: number): TerrainArchiveSetRoute | undefined;
}

/** Parse a run-length partition list (`"3-5,9"` → `[3, 4, 5, 9]`). */
export function parseTerrainArchiveSetPartitions(ranges: string): number[] {
  const indices: number[] = [];
  if (ranges.trim() === '') return indices;
  for (const part of ranges.split(',')) {
    const match = /^\s*(\d+)(?:-(\d+))?\s*$/.exec(part);
    if (match === null) throw new Error(`invalid partition range "${part}"`);
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (end < start) throw new Error(`invalid partition range "${part}" (end before start)`);
    for (let index = start; index <= end; index++) indices.push(index);
  }
  return indices;
}

/** Encode partition indices as a sorted run-length list (`[9, 3, 4, 5]` → `"3-5,9"`). */
export function encodeTerrainArchiveSetPartitions(indices: Iterable<number>): string {
  const sorted = [...new Set(indices)].sort((left, right) => left - right);
  const runs: string[] = [];
  for (let start = 0; start < sorted.length; ) {
    let end = start;
    while (end + 1 < sorted.length && sorted[end + 1] === (sorted[end] as number) + 1) end++;
    const first = sorted[start] as number;
    const last = sorted[end] as number;
    runs.push(first === last ? String(first) : `${first}-${last}`);
    start = end + 1;
  }
  return runs.join(',');
}

/** Sorted, merged `[start, end]` runs of a run-length list, for binary search. */
function parseRuns(ranges: string): Array<[number, number]> {
  const runs: Array<[number, number]> = [];
  if (ranges.trim() === '') return runs;
  for (const part of ranges.split(',')) {
    const match = /^\s*(\d+)(?:-(\d+))?\s*$/.exec(part);
    if (match === null) throw new Error(`invalid range "${part}"`);
    const start = Number(match[1]);
    const end = match[2] === undefined ? start : Number(match[2]);
    if (end < start) throw new Error(`invalid range "${part}" (end before start)`);
    runs.push([start, end]);
  }
  runs.sort((left, right) => left[0] - right[0]);
  const merged: Array<[number, number]> = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last !== undefined && run[0] <= last[1] + 1) last[1] = Math.max(last[1], run[1]);
    else merged.push([run[0], run[1]]);
  }
  return merged;
}

function inRuns(runs: ReadonlyArray<[number, number]>, value: number): boolean {
  let low = 0;
  let high = runs.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const [start, end] = runs[middle] as [number, number];
    if (value < start) high = middle - 1;
    else if (value > end) low = middle + 1;
    else return true;
  }
  return false;
}

/** The cells of a geohash tier, as geohashes (expands the run-length list). */
export function terrainArchiveSetTierCells(tier: TerrainArchiveSetGeohashTier): string[] {
  return parseTerrainArchiveSetPartitions(tier.cells).map((index) =>
    geohashFromIndex(index, tier.precision),
  );
}

/** Encode geohash cells (all of one precision) as a tier's run-length `cells` list. */
export function encodeTerrainArchiveSetCells(cells: Iterable<string>): string {
  return encodeTerrainArchiveSetPartitions([...cells].map((cell) => geohashIndex(cell)));
}

/**
 * Build the tile → archive router. Throws when two archives claim one partition cell, when a
 * quadtree-partitioned set has no `partitionLevel`, or when geohash tiers overlap.
 */
export function createTerrainArchiveSetRouter(
  descriptor: TerrainArchiveSetDescriptor,
): TerrainArchiveSetRouter {
  const partitionLevel = descriptor.partitionLevel ?? 0;
  if (
    descriptor.archives.length > 0 &&
    (descriptor.partitionLevel === undefined ||
      !Number.isSafeInteger(partitionLevel) ||
      partitionLevel < 0 ||
      partitionLevel > 10)
  ) {
    throw new Error(
      `archive-set partitionLevel must be an integer 0-10, got ${descriptor.partitionLevel}`,
    );
  }
  const cells = 4 ** partitionLevel;
  const lookup = new Int32Array(descriptor.archives.length > 0 ? cells : 0).fill(-1);
  descriptor.archives.forEach((entry, archiveIndex) => {
    if (entry.minLevel < partitionLevel || entry.maxLevel < entry.minLevel) {
      throw new Error(
        `archive "${entry.id}" levels ${entry.minLevel}-${entry.maxLevel} must start at or below partitionLevel ${partitionLevel}`,
      );
    }
    for (const index of parseTerrainArchiveSetPartitions(entry.partitions)) {
      if (index >= cells) {
        throw new Error(`archive "${entry.id}" partition ${index} is outside ${cells} cells`);
      }
      const owner = lookup[index] as number;
      if (owner !== -1) {
        const other = descriptor.archives[owner]?.id;
        throw new Error(`partition ${index} is claimed by both "${other}" and "${entry.id}"`);
      }
      lookup[index] = archiveIndex;
    }
  });

  const tiers = (descriptor.geohash ?? []).map((tier) => {
    if (
      !Number.isSafeInteger(tier.precision) ||
      tier.precision < 1 ||
      tier.precision > 6 ||
      tier.maxLevel < tier.minLevel ||
      !tier.url.includes('{cell}')
    ) {
      throw new Error(
        `geohash tier ${tier.precision}/${tier.minLevel}-${tier.maxLevel} needs precision 1-6, ordered levels and a {cell} URL`,
      );
    }
    const runs = parseRuns(tier.cells);
    const last = runs[runs.length - 1];
    if (last !== undefined && last[1] >= 32 ** tier.precision) {
      throw new Error(`geohash tier cell ${last[1]} is outside ${32 ** tier.precision} cells`);
    }
    return { tier, runs };
  });
  for (let index = 0; index < tiers.length; index++) {
    for (let other = index + 1; other < tiers.length; other++) {
      const a = (tiers[index] as { tier: TerrainArchiveSetGeohashTier }).tier;
      const b = (tiers[other] as { tier: TerrainArchiveSetGeohashTier }).tier;
      if (a.minLevel <= b.maxLevel && b.minLevel <= a.maxLevel) {
        throw new Error(
          `geohash tiers ${a.minLevel}-${a.maxLevel} and ${b.minLevel}-${b.maxLevel} share levels`,
        );
      }
    }
  }

  const levels = [
    ...(descriptor.base !== undefined ? [descriptor.base] : []),
    ...descriptor.archives,
    ...(descriptor.geohash ?? []),
  ];
  if (levels.length === 0) throw new Error('an archive set needs a base or at least one archive');
  const minLevel = Math.min(...levels.map((entry) => entry.minLevel));
  const maxLevel = Math.max(...levels.map((entry) => entry.maxLevel));

  return {
    descriptor,
    minLevel,
    maxLevel,
    resolve(level, x, y) {
      const base = descriptor.base;
      if (base !== undefined && level >= base.minLevel && level <= base.maxLevel) {
        return { kind: 'base', base };
      }
      for (const { tier, runs } of tiers) {
        if (level < tier.minLevel || level > tier.maxLevel) continue;
        const count = 2 ** level;
        if (x < 0 || y < 0 || x >= count || y >= count) return undefined;
        const cell = terrainTileGeohash(level, x, y, tier.precision);
        if (!inRuns(runs, geohashIndex(cell))) return undefined;
        return {
          kind: 'cell',
          tier,
          cell,
          id: `g${tier.precision}:${cell}`,
          url: tier.url.split('{cell}').join(cell),
        };
      }
      if (descriptor.archives.length === 0 || level < partitionLevel) return undefined;
      const shift = level - partitionLevel;
      const cellX = Math.floor(x / 2 ** shift);
      const cellY = Math.floor(y / 2 ** shift);
      const side = 2 ** partitionLevel;
      if (cellX < 0 || cellY < 0 || cellX >= side || cellY >= side) return undefined;
      const archiveIndex = lookup[cellY * side + cellX] as number;
      if (archiveIndex === -1) return undefined;
      const entry = descriptor.archives[archiveIndex] as TerrainArchiveSetEntry;
      if (level < entry.minLevel || level > entry.maxLevel) return undefined;
      return { kind: 'archive', entry };
    },
  };
}
