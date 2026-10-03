import { registerSchema, type ValidationIssue } from '@bendyline/molen-schema';
import { z } from 'zod';

/** Payload type shared by every archive in a set. */
export type TerrainArchiveSetTileType = 'png' | 'mvt';

const level = z.int().min(0).max(30);
const sha256 = z
  .string()
  .regex(/^[0-9a-f]{64}$/i)
  .describe('Hex sha256 of the archive.');

// Every field carries a `.describe()` so the emitted JSON Schema documents units and axes.
const archiveSetSchema = z.strictObject({
  format: z
    .literal('molen/archive-set@1')
    .describe("Format envelope; always 'molen/archive-set@1'."),
  name: z.string().min(1).describe('Archive set name.'),
  tileType: z
    .enum(['png', 'mvt'])
    .describe("Payload type shared by every archive: 'png' (e.g. PNG16 elevation) or 'mvt'."),
  partitionLevel: z
    .int()
    .min(0)
    .max(10)
    .describe(
      'Level whose tiles partition the detail archives; a detail tile belongs to the archive listing its ancestor at this level. Required when archives is not empty.',
    )
    .optional(),
  base: z
    .strictObject({
      url: z
        .string()
        .min(1)
        .describe('Archive URL, relative to this document or absolute (http/https).'),
      minLevel: level.describe('Coarsest level the base archive serves.'),
      maxLevel: level.describe('Finest level the base archive serves.'),
      bytes: z.int().nonnegative().describe('Archive size in bytes.').optional(),
      sha256: sha256.optional(),
    })
    .describe('Optional coarse archive serving every level up to its maxLevel.')
    .optional(),
  archives: z
    .array(
      z.strictObject({
        id: z.string().min(1).describe('Unique archive id, e.g. "pacific-northwest-02".'),
        url: z
          .string()
          .min(1)
          .describe('Archive URL, relative to this document or absolute (http/https).'),
        minLevel: level.describe('Coarsest level the archive serves (at least partitionLevel).'),
        maxLevel: level.describe('Finest level the archive serves.'),
        partitions: z
          .string()
          .regex(/^(\d+(-\d+)?(,\d+(-\d+)?)*)?$/)
          .describe(
            'Run-length list of partition cells it owns, as indices y * 2^partitionLevel + x (e.g. "40-44,60").',
          ),
        bounds: z
          .array(z.number().finite())
          .length(4)
          .describe('Informational [west, south, east, north] in degrees.')
          .optional(),
        bytes: z.int().nonnegative().describe('Archive size in bytes.').optional(),
        sha256: sha256.optional(),
      }),
    )
    .describe('Detail archives, each owning a disjoint set of partition cells.'),
  geohash: z
    .array(
      z.strictObject({
        precision: z
          .int()
          .min(1)
          .max(6)
          .describe('Geohash length of a cell (3: 1.40625° square, about 156 km at the equator).'),
        minLevel: level.describe('Coarsest level the tier serves.'),
        maxLevel: level.describe('Finest level the tier serves.'),
        url: z
          .string()
          .min(1)
          .regex(/\{cell\}/)
          .describe(
            'Archive URL template, relative to this document or absolute; {cell} becomes the cell geohash.',
          ),
        cells: z
          .string()
          .regex(/^(\d+(-\d+)?(,\d+(-\d+)?)*)?$/)
          .describe(
            'Run-length list of the cells that have an archive, as geohash indices (the characters read as one base-32 number).',
          ),
      }),
    )
    .describe(
      'Geohash-partitioned tiers: per band of levels, one archive per cell; a tile belongs to the cell holding its center.',
    )
    .optional(),
});

function expand(ranges: string): number[] {
  const indices: number[] = [];
  if (ranges === '') return indices;
  for (const part of ranges.split(',')) {
    const [start, end] = part.split('-').map(Number) as [number, number | undefined];
    for (let index = start; index <= (end ?? start); index++) indices.push(index);
  }
  return indices;
}

function validateArchiveSet(data: unknown): ValidationIssue[] {
  const set = data as z.infer<typeof archiveSetSchema>;
  const issues: ValidationIssue[] = [];
  const partitionLevel = set.partitionLevel ?? 0;
  const cells = 4 ** partitionLevel;
  if (set.archives.length > 0 && set.partitionLevel === undefined) {
    issues.push({
      path: '/partitionLevel',
      code: 'missing_partition_level',
      message: 'partitionLevel is required when archives is not empty',
    });
  }
  if (set.base !== undefined && set.base.minLevel > set.base.maxLevel) {
    issues.push({
      path: '/base',
      code: 'level_order',
      message: 'base.minLevel must be less than or equal to base.maxLevel',
    });
  }
  if (set.base === undefined && set.archives.length === 0 && (set.geohash ?? []).length === 0) {
    issues.push({
      path: '/archives',
      code: 'empty_set',
      message: 'an archive set needs a base, an archive or a geohash tier',
    });
  }
  const tiers = set.geohash ?? [];
  tiers.forEach((tier, index) => {
    const path = `/geohash/${index}`;
    if (tier.minLevel > tier.maxLevel) {
      issues.push({ path, code: 'level_order', message: 'minLevel must not exceed maxLevel' });
    }
    if (set.base !== undefined && tier.minLevel <= set.base.maxLevel) {
      issues.push({
        path,
        code: 'base_overlap',
        message: `tier minLevel ${tier.minLevel} overlaps the base (through level ${set.base.maxLevel}); the base wins`,
      });
    }
    for (const other of tiers.slice(index + 1)) {
      if (tier.minLevel <= other.maxLevel && other.minLevel <= tier.maxLevel) {
        issues.push({
          path,
          code: 'tier_overlap',
          message: `tiers ${tier.minLevel}-${tier.maxLevel} and ${other.minLevel}-${other.maxLevel} share levels`,
        });
      }
    }
    const limit = 32 ** tier.precision;
    const outside = expand(tier.cells).find((cell) => cell >= limit);
    if (outside !== undefined) {
      issues.push({
        path: `${path}/cells`,
        code: 'cell_range',
        message: `cell ${outside} is outside the ${limit} geohash cells of precision ${tier.precision}`,
      });
    }
  });
  const ids = new Set<string>();
  const owners = new Map<number, string>();
  set.archives.forEach((archive, index) => {
    const path = `/archives/${index}`;
    if (ids.has(archive.id)) {
      issues.push({ path, code: 'duplicate_id', message: `archive id "${archive.id}" repeats` });
    }
    ids.add(archive.id);
    if (archive.minLevel > archive.maxLevel || archive.minLevel < partitionLevel) {
      issues.push({
        path,
        code: 'level_order',
        message: `archive levels must satisfy partitionLevel (${partitionLevel}) <= minLevel <= maxLevel`,
      });
    }
    if (set.base !== undefined && archive.minLevel <= set.base.maxLevel) {
      issues.push({
        path,
        code: 'base_overlap',
        message: `archive minLevel ${archive.minLevel} overlaps the base (through level ${set.base.maxLevel}); the base wins`,
      });
    }
    for (const cell of expand(archive.partitions)) {
      if (cell >= cells) {
        issues.push({
          path: `${path}/partitions`,
          code: 'partition_range',
          message: `partition ${cell} is outside the ${cells} cells of level ${partitionLevel}`,
        });
        break;
      }
      const owner = owners.get(cell);
      if (owner !== undefined) {
        issues.push({
          path: `${path}/partitions`,
          code: 'partition_overlap',
          message: `partition ${cell} is already owned by "${owner}"`,
        });
        break;
      }
      owners.set(cell, archive.id);
    }
  });
  return issues;
}

export function registerTerrainArchiveSetSchema(): void {
  registerSchema('archive-set', archiveSetSchema, {
    id: 'molen/archive-set@1',
    title: 'Archive set',
    description:
      'One tile pyramid split across PMTiles archives: a coarse base plus detail archives partitioned by the tile at a fixed level or by geohash cell.',
    examples: [
      {
        format: 'molen/archive-set@1',
        name: 'world-features',
        tileType: 'mvt',
        partitionLevel: 7,
        base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 7 },
        archives: [
          {
            id: 'pacific-northwest-01',
            url: '2026-09/pacific-northwest-01.pmtiles',
            minLevel: 8,
            maxLevel: 13,
            partitions: '2600-2603,2728-2731',
          },
        ],
      },
      {
        format: 'molen/archive-set@1',
        name: 'world-elevation',
        tileType: 'png',
        base: { url: 'base.pmtiles', minLevel: 0, maxLevel: 5 },
        archives: [],
        geohash: [
          { precision: 2, minLevel: 6, maxLevel: 8, url: 'g2/{cell}.pmtiles', cells: '320-330' },
          {
            precision: 3,
            minLevel: 9,
            maxLevel: 13,
            url: 'g3/{cell}.pmtiles',
            cells: '12866-12870',
          },
        ],
      },
    ],
    docsRef: 'schemas/archive-set.md',
    validate: validateArchiveSet,
  });
}
