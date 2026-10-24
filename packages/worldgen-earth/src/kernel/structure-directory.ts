import { getSchema, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';

export interface StructureShard {
  /** Pack-relative path; independently readable in a ZIP or directory pack. */
  path: string;
  bytes: number;
  count: number;
  minLevel: number;
}

export interface StructureDirectory {
  format: 'molen/structure-placement-index@1';
  shards: Record<string, StructureShard>;
  /** Geohash2 coverage -> owning shards, including cross-boundary extents and identity searches. */
  cells: Record<string, string[]>;
}

const cell = z.string().regex(/^[0123456789bcdefghjkmnpqrstuvwxyz]{2}$/);
const shardId = z.string().regex(/^[0123456789bcdefghjkmnpqrstuvwxyz]{2,12}$/);
const directorySchema = z
  .strictObject({
    format: z.literal('molen/structure-placement-index@1'),
    shards: z.record(
      shardId,
      z.strictObject({
        path: z.string().regex(/^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$)).+\.json$/),
        bytes: z.int().positive(),
        count: z.int().positive(),
        minLevel: z.int().min(0).max(26),
      }),
    ),
    cells: z.record(cell, z.array(shardId).min(1)),
  })
  .superRefine((doc, context) => {
    const referenced = new Set<string>();
    const paths = new Set<string>();
    for (const [key, ids] of Object.entries(doc.cells)) {
      if (new Set(ids).size !== ids.length)
        context.addIssue({
          code: 'custom',
          path: ['cells', key],
          message: 'duplicate shard reference',
        });
      for (const id of ids) {
        if (!doc.shards[id])
          context.addIssue({
            code: 'custom',
            path: ['cells', key],
            message: `unknown shard ${id}`,
          });
        referenced.add(id);
      }
    }
    for (const [id, shard] of Object.entries(doc.shards)) {
      if (!referenced.has(id))
        context.addIssue({ code: 'custom', path: ['shards', id], message: 'unreachable shard' });
      if (paths.has(shard.path))
        context.addIssue({ code: 'custom', path: ['shards', id], message: 'duplicate shard path' });
      paths.add(shard.path);
    }
  });

export function parseStructureDirectory(value: unknown): StructureDirectory {
  return directorySchema.parse(value);
}

export function registerStructureDirectorySchema(): void {
  if (getSchema('structure-placement-index')) return;
  registerSchema('structure-placement-index', directorySchema, {
    id: 'molen/structure-placement-index@1',
    title: 'Regional structure placement directory',
    description: 'Spatial coverage and pack paths for lazily loaded placement regions.',
    docsRef: 'guide/earth-view.md',
    examples: [{ format: 'molen/structure-placement-index@1', shards: {}, cells: {} }],
  });
}

/** Geohash2 cell bounds, independent of the current camera or loaded records. */
export function structureRegionBounds(cell: string): [number, number, number, number] {
  if (!/^[0123456789bcdefghjkmnpqrstuvwxyz]{2}$/.test(cell))
    throw new Error('Invalid structure region cell');
  const alphabet = '0123456789bcdefghjkmnpqrstuvwxyz';
  const bounds: [number, number, number, number] = [-180, -90, 180, 90];
  let bitIndex = 0;
  for (const char of cell) {
    const value = alphabet.indexOf(char);
    for (let bit = 4; bit >= 0; bit--) {
      const axis = bitIndex++ % 2;
      const low = bounds[axis] as number,
        high = bounds[axis + 2] as number;
      bounds[axis + (value & (1 << bit) ? 0 : 2)] = (low + high) / 2;
    }
  }
  return bounds;
}
