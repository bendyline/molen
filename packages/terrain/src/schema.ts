import {
  registerLegacySchema,
  registerSchema,
  type ValidationIssue,
} from '@bendyline/molen-schema';
import { z } from 'zod';
import { registerTerrainArchiveSetSchema } from './archive-set-schema';
import { registerTerrainPackageSchema } from './package-schema';

// Every field carries a `.describe()` so the emitted JSON Schema documents units and axes:
// world XZ in meters (Y-up), heights in meters, slope 0..1 (0 = flat, 1 = vertical).

const layer = z.strictObject({
  name: z.string().min(1).describe("Layer name, e.g. 'grass' or 'rock'."),
  materialRef: z
    .string()
    .min(1)
    .describe('Material reference for the layer surface (project material doc id).')
    .optional(),
  /** Flat color used for vertex-color splat banding (v1 shading). */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .describe("Flat '#rrggbb' color used for vertex-color splat banding (v1 shading).")
    .optional(),
  tiling: z
    .number()
    .positive()
    .describe('Texture repeats per chunk edge for the layer material (default 8).')
    .default(8),
  auto: z
    .strictObject({
      heightMin: z
        .number()
        .describe('Lowest height in meters at which the layer applies.')
        .optional(),
      heightMax: z
        .number()
        .describe('Highest height in meters at which the layer applies.')
        .optional(),
      slopeMin: z
        .number()
        .describe('Minimum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies.')
        .optional(),
      slopeMax: z
        .number()
        .describe('Maximum slope 0..1 (0 = flat, 1 = vertical) at which the layer applies.')
        .optional(),
    })
    .describe('Automatic height/slope banding that selects where the layer paints.')
    .optional(),
});

const legacyTerrainSchema = z.strictObject({
  format: z.literal('molen/terrain@1').describe("Format envelope; always 'molen/terrain@1'."),
  name: z.string().min(1).describe('Terrain name.'),
  origin: z
    .array(z.number())
    .length(2)
    .describe('World [x, z] in meters of the corner of chunk (0, 0); default [0, 0].')
    .default([0, 0]),
  chunkSize: z
    .number()
    .positive()
    .describe('Chunk edge length in meters (default 128).')
    .default(128),
  tileResolution: z
    .int()
    .min(2)
    .max(1025)
    .describe('Height samples per chunk edge, borders shared with neighbors (default 129).')
    .default(129),
  gridSize: z
    .array(z.int().positive())
    .length(2)
    .describe('Number of chunks along [x, z]; default [1, 1].')
    .default([1, 1]),
  height: z
    .strictObject({
      min: z.number().describe('Height in meters encoded by sample value 0.'),
      max: z.number().describe('Height in meters encoded by the maximum sample value.'),
    })
    .describe('Height range in meters the PNG16 samples map onto.'),
  tiles: z
    .strictObject({
      heightUrl: z
        .string()
        .min(1)
        .describe(
          "PNG16 height tile URL template with {x}/{z} chunk placeholders, e.g. 'tiles/h_{x}_{z}.png'; relative to the descriptor.",
        ),
      splatUrl: z
        .string()
        .min(1)
        .describe('Optional splat-weight tile URL template with {x}/{z} placeholders.')
        .optional(),
    })
    .describe('Tile sources.'),
  layers: z
    .array(layer)
    .describe('Surface layers painted by splat weights or auto banding, in order.')
    .default([]),
  lod: z
    .strictObject({
      levels: z
        .int()
        .min(1)
        .max(6)
        .describe('Number of LOD levels (each halves the sample density; default 4).')
        .default(4),
      distanceBands: z
        .array(z.number().positive())
        .describe(
          'Camera distances in meters (strictly increasing) beyond which each coarser LOD level applies.',
        )
        .default([256, 512, 1024, 2048]),
      skirts: z
        .boolean()
        .describe('Add vertical skirts along chunk edges to hide LOD cracks (default true).')
        .default(true),
    })
    .describe('Level-of-detail settings.')
    .default({ levels: 4, distanceBands: [256, 512, 1024, 2048], skirts: true }),
  collision: z
    .strictObject({
      enabled: z
        .boolean()
        .describe("Register the heightfield as the scene's ground/collision (default false).")
        .default(false),
    })
    .describe('Headless ground/collision settings.')
    .default({ enabled: false }),
});

const terrainSchema = legacyTerrainSchema.omit({ format: true }).extend({
  format: z.literal('molen/terrain@2').describe("Format envelope; always 'molen/terrain@2'."),
  /** World meters per unit of the source projected space (origin/chunkSize pre-multiplied). */
  metersPerUnit: z
    .number()
    .positive()
    .describe(
      'World meters per unit of the source projected space (origin/chunkSize are pre-multiplied); absent = 1.',
    )
    .optional(),
  streaming: z
    .strictObject({
      loadRadius: z
        .number()
        .positive()
        .describe('Radius around the camera, in chunks, that is kept resident (default 3).')
        .default(3),
      unloadRadius: z
        .number()
        .positive()
        .describe(
          'Hysteresis radius in chunks; resident tiles outside it may be evicted (>= loadRadius; default 4).',
        )
        .default(4),
      maxConcurrentLoads: z
        .int()
        .positive()
        .max(32)
        .describe('Maximum height-tile requests in flight at once (default 4).')
        .default(4),
      maxResidentTiles: z
        .int()
        .positive()
        .max(4096)
        .describe('Hard ceiling on decoded resident tiles and their meshes (default 96).')
        .default(96),
    })
    .describe('Tile residency budgets.')
    .default({
      loadRadius: 3,
      unloadRadius: 4,
      maxConcurrentLoads: 4,
      maxResidentTiles: 96,
    }),
});

function validateTerrain(data: unknown): ValidationIssue[] {
  const terrain = data as {
    tileResolution: number;
    height: { min: number; max: number };
    layers: Array<{
      auto?: { heightMin?: number; heightMax?: number; slopeMin?: number; slopeMax?: number };
    }>;
    lod: { levels: number; distanceBands: number[] };
    streaming: { loadRadius: number; unloadRadius: number };
  };
  const issues: ValidationIssue[] = [];
  if (terrain.height.min >= terrain.height.max) {
    issues.push({
      path: '/height',
      code: 'height_range',
      message: 'height.min must be less than height.max',
    });
  }
  if (terrain.streaming.unloadRadius < terrain.streaming.loadRadius) {
    issues.push({
      path: '/streaming/unloadRadius',
      code: 'streaming_radius_order',
      message: 'streaming.unloadRadius must be greater than or equal to loadRadius',
    });
  }
  for (let i = 1; i < terrain.lod.distanceBands.length; i++) {
    if ((terrain.lod.distanceBands[i] as number) <= (terrain.lod.distanceBands[i - 1] as number)) {
      issues.push({
        path: `/lod/distanceBands/${i}`,
        code: 'lod_band_order',
        message: 'LOD distance bands must be strictly increasing',
      });
      break;
    }
  }
  const maxStep = 2 ** (terrain.lod.levels - 1);
  if (maxStep > terrain.tileResolution - 1) {
    issues.push({
      path: '/lod/levels',
      code: 'lod_resolution',
      message: `LOD level ${terrain.lod.levels} needs tileResolution >= ${maxStep + 1}`,
      hint: 'reduce lod.levels or increase tileResolution',
    });
  }
  terrain.layers.forEach((layer, i) => {
    const auto = layer.auto;
    if (auto === undefined) return;
    if (
      auto.heightMin !== undefined &&
      auto.heightMax !== undefined &&
      auto.heightMin > auto.heightMax
    ) {
      issues.push({
        path: `/layers/${i}/auto`,
        code: 'height_band_order',
        message: 'heightMin must be less than or equal to heightMax',
      });
    }
    if (auto.slopeMin !== undefined && (auto.slopeMin < 0 || auto.slopeMin > 1)) {
      issues.push({
        path: `/layers/${i}/auto/slopeMin`,
        code: 'slope_range',
        message: 'slopeMin must be between 0 and 1',
      });
    }
    if (auto.slopeMax !== undefined && (auto.slopeMax < 0 || auto.slopeMax > 1)) {
      issues.push({
        path: `/layers/${i}/auto/slopeMax`,
        code: 'slope_range',
        message: 'slopeMax must be between 0 and 1',
      });
    }
    if (
      auto.slopeMin !== undefined &&
      auto.slopeMax !== undefined &&
      auto.slopeMin > auto.slopeMax
    ) {
      issues.push({
        path: `/layers/${i}/auto`,
        code: 'slope_band_order',
        message: 'slopeMin must be less than or equal to slopeMax',
      });
    }
  });
  return issues;
}

let registered = false;
/** Register the terrain descriptor schema into the shared registry (idempotent). */
export function registerTerrainSchemas(): void {
  if (registered) return;
  registered = true;
  registerSchema('terrain', terrainSchema, {
    id: 'molen/terrain@2',
    title: 'Terrain descriptor',
    description:
      'Streamed heightmap terrain: tiles, chunk grid, height range, layers, LOD, and residency budgets.',
    examples: [
      {
        format: 'molen/terrain@2',
        name: 'island',
        chunkSize: 128,
        tileResolution: 129,
        gridSize: [4, 4],
        height: { min: 0, max: 200 },
        tiles: { heightUrl: 'tiles/h_{x}_{z}.png' },
        layers: [
          { name: 'grass', tiling: 8 },
          { name: 'rock', tiling: 6, auto: { slopeMin: 0.6 } },
          { name: 'snow', tiling: 4, auto: { heightMin: 150 } },
        ],
      },
    ],
    docsRef: 'schemas/terrain.md',
    validate: validateTerrain,
  });
  registerLegacySchema('terrain', {
    id: 'molen/terrain@1',
    zod: legacyTerrainSchema,
    upgrade: (legacy) => ({
      ...(legacy as Record<string, unknown>),
      format: 'molen/terrain@2',
    }),
    examples: [
      {
        format: 'molen/terrain@1',
        name: 'legacy-island',
        height: { min: 0, max: 200 },
        tiles: { heightUrl: 'tiles/h_{x}_{z}.png' },
      },
    ],
  });
  registerTerrainPackageSchema();
  registerTerrainArchiveSetSchema();
}
