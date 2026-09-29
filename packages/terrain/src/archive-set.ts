// molen/archive-set@1: one logical tile pyramid split across many PMTiles archives.
//
// Planet-scale archives outgrow what CDNs cache as a single object (Cloudflare edge-caches objects
// up to 512 MB, for example), so producers cut them into a coarse `base` archive plus detail
// archives partitioned by the tile at a fixed `partitionLevel`. Every detail tile belongs to exactly
// one archive: the one whose `partitions` list contains the index `y * 2^partitionLevel + x` of its
// ancestor at that level. This module holds the format types, the run-length partition codec and a
// pure router; the client half opens the archives (`createTerrainArchiveSetArchive`).

import type { TerrainArchiveSetTileType } from './archive-set-schema';

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

export interface TerrainArchiveSetDescriptor {
  format: 'molen/archive-set@1';
  name: string;
  /** Payload type shared by every archive in the set. */
  tileType: TerrainArchiveSetTileType;
  /** Level whose tiles partition the detail archives (at most 10: a 1M-cell lookup). */
  partitionLevel: number;
  base?: TerrainArchiveSetBase;
  archives: TerrainArchiveSetEntry[];
}

/** Which archive serves a tile: the base, or one detail entry. */
export type TerrainArchiveSetRoute =
  | { kind: 'base'; base: TerrainArchiveSetBase }
  | { kind: 'archive'; entry: TerrainArchiveSetEntry };

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

/** Build the tile → archive router. Throws when two archives claim one partition cell. */
export function createTerrainArchiveSetRouter(
  descriptor: TerrainArchiveSetDescriptor,
): TerrainArchiveSetRouter {
  const { partitionLevel } = descriptor;
  if (!Number.isSafeInteger(partitionLevel) || partitionLevel < 0 || partitionLevel > 10) {
    throw new Error(`archive-set partitionLevel must be an integer 0-10, got ${partitionLevel}`);
  }
  const cells = 4 ** partitionLevel;
  const lookup = new Int32Array(cells).fill(-1);
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

  const levels = [
    ...(descriptor.base !== undefined ? [descriptor.base] : []),
    ...descriptor.archives,
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
      if (level < partitionLevel) return undefined;
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
