import { z } from 'zod';
import type { ValidationIssue } from './issues';
import { registerSchema } from './registry';

// Content packs: zip files that carry content (models, documents, catalogs) outside the code
// packages. The manifest describes every logical file; the zip layout (solid blocks, compression)
// is a transport detail the reader hides.

/** Zip member name of the manifest; it is written last, just before the central directory. */
export const PACK_MANIFEST_ENTRY = 'molen-pack.json';
/** Reserved prefix for zip members that are not logical files (solid blocks). */
export const PACK_RESERVED_PREFIX = 'molen-pack/';

const packPath = z
  .string()
  .min(1)
  .regex(/^(?![A-Za-z]:|[/\\])(?!.*\\)(?!.*(?:^|\/)\.\.?(?:\/|$)).+$/);
// Same dotted lower_snake grammar as project asset ids.
const packId = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/);
const assetId = packId;
const sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const role = z.string().regex(/^[a-z][a-z0-9-]*$/);

export interface PackEntry {
  /** Uncompressed size in bytes. */
  size: number;
  sha256: string;
  mediaType: string;
  /** Solid block holding this file; absent when the file is its own zip member. */
  block?: string;
  /** Byte offset inside the block (required with `block`). */
  offset?: number;
  /** Alternative encodings of the same content, e.g. `{ "ktx2": "<path>" }`. */
  variants?: Record<string, string>;
}

export interface PackBlock {
  /** Zip member holding the block. */
  entry: string;
  /** Uncompressed block size in bytes. */
  size: number;
}

/** The manifest inside a built pack. */
export interface PackManifest {
  format: 'molen/pack@1';
  id: string;
  version: string;
  title?: string;
  /** SPDX expression for the pack's content. */
  license?: string;
  /** Path of the entry that carries the pack's attribution notice. */
  notice?: string;
  /** sha256 over every logical file (path and content), independent of the zip layout. */
  contentHash: string;
  /** Role (e.g. `types`, `stylepack`, `stars`) to the entry paths that provide it. */
  provides: Record<string, string[]>;
  /** Asset id to the entry path of its runtime file. */
  ids: Record<string, string>;
  blocks: Record<string, PackBlock>;
  entries: Record<string, PackEntry>;
}

/** Build configuration read from `molen-pack.source.json` in a pack's source directory. */
export interface PackSourceConfig {
  format: 'molen/pack-source@1';
  id: string;
  version: string;
  title?: string;
  license?: string;
  notice?: string;
  /** Globs (`*`, `**`, `?`) of files to include, relative to the source directory. */
  include: string[];
  exclude: string[];
  ids: Record<string, string>;
  provides: Record<string, string | string[]>;
  /** Group small text files into compressed solid blocks (default true). */
  solid: boolean;
}

export interface PackIndexEntry {
  version: string;
  /** Pack file, relative to the index. */
  file: string;
  contentHash: string;
  /** File size in bytes. */
  size: number;
}

/** A directory listing of built packs, for hosts that publish several. */
export interface PackIndex {
  format: 'molen/pack-index@1';
  packs: Record<string, PackIndexEntry>;
}

const entrySchema = z.strictObject({
  size: z.int().nonnegative().describe('Uncompressed size in bytes.'),
  sha256: sha256.describe('sha256 of the uncompressed content.'),
  mediaType: z.string().min(1).describe('Media type, e.g. model/gltf-binary.'),
  block: z
    .string()
    .min(1)
    .describe('Solid block holding this file; absent when it is its own zip member.')
    .optional(),
  offset: z.int().nonnegative().describe('Byte offset inside the block.').optional(),
  variants: z
    .record(z.string().regex(/^[a-z0-9][a-z0-9-]*$/), packPath)
    .describe('Alternative encodings of the same content, variant name to entry path.')
    .optional(),
});

const manifestSchema = z.strictObject({
  format: z.literal('molen/pack@1').describe("Format envelope; always 'molen/pack@1'."),
  id: packId.describe('Stable pack id, e.g. molen.entities.'),
  version: z.string().min(1).describe('Pack version.'),
  title: z.string().min(1).describe('Human-readable pack name.').optional(),
  license: z.string().min(1).describe("SPDX expression for the pack's content.").optional(),
  notice: packPath.describe('Entry that carries the attribution notice.').optional(),
  contentHash: sha256.describe(
    'sha256 over every logical file (path and content), independent of the zip layout.',
  ),
  provides: z
    .record(role, z.array(packPath))
    .describe('Role (e.g. types, stylepack, stars) to the entry paths that provide it.')
    .default({}),
  ids: z
    .record(assetId, packPath)
    .describe('Asset id to the entry path of its runtime file.')
    .default({}),
  blocks: z
    .record(
      z.string().min(1),
      z.strictObject({
        entry: z.string().min(1).describe('Zip member holding the block.'),
        size: z.int().nonnegative().describe('Uncompressed block size in bytes.'),
      }),
    )
    .describe('Solid blocks: many small files compressed together as one zip member.')
    .default({}),
  entries: z.record(packPath, entrySchema).describe('Every logical file in the pack, by path.'),
});

function validateManifest(data: unknown): ValidationIssue[] {
  const manifest = data as PackManifest;
  const issues: ValidationIssue[] = [];
  const known = (path: string): boolean => manifest.entries[path] !== undefined;
  for (const [path, entry] of Object.entries(manifest.entries)) {
    if (path === PACK_MANIFEST_ENTRY || path.startsWith(PACK_RESERVED_PREFIX)) {
      issues.push({
        path: `/entries/${path}`,
        code: 'reserved_pack_path',
        message: `"${path}" is reserved for the pack's own structure`,
      });
    }
    if ((entry.block === undefined) !== (entry.offset === undefined)) {
      issues.push({
        path: `/entries/${path}`,
        code: 'block_offset_pair',
        message: 'block and offset must be given together',
      });
    }
    if (entry.block !== undefined) {
      const block = manifest.blocks[entry.block];
      if (block === undefined) {
        issues.push({
          path: `/entries/${path}/block`,
          code: 'unknown_block',
          message: `block "${entry.block}" is not declared in blocks`,
        });
      } else if ((entry.offset ?? 0) + entry.size > block.size) {
        issues.push({
          path: `/entries/${path}`,
          code: 'block_overrun',
          message: `offset ${entry.offset} + size ${entry.size} runs past block "${entry.block}" (${block.size} bytes)`,
        });
      }
    }
    for (const [variant, target] of Object.entries(entry.variants ?? {})) {
      if (!known(target)) {
        issues.push({
          path: `/entries/${path}/variants/${variant}`,
          code: 'unknown_entry',
          message: `variant "${variant}" points at "${target}", which is not an entry`,
        });
      }
    }
  }
  if (manifest.notice !== undefined && !known(manifest.notice)) {
    issues.push({
      path: '/notice',
      code: 'unknown_entry',
      message: `notice "${manifest.notice}" is not an entry`,
    });
  }
  for (const [id, path] of Object.entries(manifest.ids)) {
    if (!known(path)) {
      issues.push({
        path: `/ids/${id}`,
        code: 'unknown_entry',
        message: `asset "${id}" points at "${path}", which is not an entry`,
      });
    }
  }
  for (const [name, paths] of Object.entries(manifest.provides)) {
    for (const path of paths) {
      if (!known(path)) {
        issues.push({
          path: `/provides/${name}`,
          code: 'unknown_entry',
          message: `"${name}" lists "${path}", which is not an entry`,
        });
      }
    }
  }
  return issues;
}

const sourceSchema = z.strictObject({
  format: z
    .literal('molen/pack-source@1')
    .describe("Format envelope; always 'molen/pack-source@1'."),
  id: packId.describe('Stable pack id, e.g. molen.entities.'),
  version: z.string().min(1).describe('Pack version.'),
  title: z.string().min(1).describe('Human-readable pack name.').optional(),
  license: z.string().min(1).describe("SPDX expression for the pack's content.").optional(),
  notice: packPath.describe('File that carries the attribution notice.').optional(),
  include: z
    .array(z.string().min(1))
    .describe('Globs (*, **, ?) of files to include, relative to the source directory.')
    .default(['**']),
  exclude: z.array(z.string().min(1)).describe('Globs of files to leave out.').default([]),
  ids: z
    .record(assetId, packPath)
    .describe(
      'Extra asset id to file mappings. Ids declared by molen/asset@1 sidecars are added automatically.',
    )
    .default({}),
  provides: z
    .record(role, z.union([packPath, z.array(packPath)]))
    .describe('Role (e.g. types, stylepack, stars) to the file or files that provide it.')
    .default({}),
  solid: z
    .boolean()
    .describe('Group small text files into compressed solid blocks (default true).')
    .default(true),
});

const indexSchema = z.strictObject({
  format: z.literal('molen/pack-index@1').describe("Format envelope; always 'molen/pack-index@1'."),
  packs: z
    .record(
      packId,
      z.strictObject({
        version: z.string().min(1).describe('Pack version.'),
        file: packPath.describe('Pack file, relative to the index.'),
        contentHash: sha256.describe("The pack manifest's contentHash."),
        size: z.int().nonnegative().describe('File size in bytes.'),
      }),
    )
    .describe('Pack id to its current built file.'),
});

const EXAMPLE_HASH = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';

registerSchema('pack', manifestSchema, {
  id: 'molen/pack@1',
  title: 'Content pack manifest',
  description:
    'Manifest inside a content pack: a zip file carrying models, documents and catalogs outside the code packages. It lists every logical file with its size and hash, the asset ids it provides, and the roles (types, stylepack, stars, ...) its files fill.',
  examples: [
    {
      format: 'molen/pack@1',
      id: 'example.vehicles',
      version: '1.0.0',
      license: 'CC0-1.0',
      notice: 'NOTICE.md',
      contentHash: EXAMPLE_HASH,
      provides: { types: ['types/vehicles.types.json'] },
      ids: { 'example.vehicle.roadster': 'models/roadster/model.glb' },
      blocks: { types: { entry: 'molen-pack/blocks/types.blk', size: 2400 } },
      entries: {
        'NOTICE.md': { size: 180, sha256: EXAMPLE_HASH, mediaType: 'text/markdown' },
        'models/roadster/model.glb': {
          size: 88120,
          sha256: EXAMPLE_HASH,
          mediaType: 'model/gltf-binary',
        },
        'types/vehicles.types.json': {
          size: 2400,
          sha256: EXAMPLE_HASH,
          mediaType: 'application/json',
          block: 'types',
          offset: 0,
        },
      },
    },
  ],
  validate: validateManifest,
});

registerSchema('pack-source', sourceSchema, {
  id: 'molen/pack-source@1',
  title: 'Content pack source',
  description:
    'Build settings for a content pack, kept as molen-pack.source.json in the directory `molen pack build` turns into a pack.',
  examples: [
    {
      format: 'molen/pack-source@1',
      id: 'example.vehicles',
      version: '1.0.0',
      license: 'CC0-1.0',
      notice: 'NOTICE.md',
      include: ['**'],
      exclude: ['**/*.psd'],
      ids: {},
      provides: { types: 'types/vehicles.types.json' },
      solid: true,
    },
  ],
});

registerSchema('pack-index', indexSchema, {
  id: 'molen/pack-index@1',
  title: 'Content pack index',
  description:
    'Lists the current built file of each pack in a directory, so a host can publish several packs and clients can find them by id.',
  examples: [
    {
      format: 'molen/pack-index@1',
      packs: {
        'example.vehicles': {
          version: '1.0.0',
          file: 'example.vehicles-0123456789ab.zip',
          contentHash: EXAMPLE_HASH,
          size: 91234,
        },
      },
    },
  ],
});
