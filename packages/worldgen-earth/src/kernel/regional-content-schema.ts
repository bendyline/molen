import { wildlifeSpeciesSchema } from '@bendyline/molen-ambient/kernel';
import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import {
  plantPresetSchema,
  scatterSchema,
  styleRuleSchema,
} from '@bendyline/molen-worldgen/kernel';
import { z } from 'zod';
import { agricultureCropSchema, agricultureProfileSchema } from './agriculture-types';
import type { RegionalCatalogDoc } from './regional-content';

const id = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
const strings = z.array(z.string().min(1)).min(1);
const regionalMatchSchema = z.strictObject({
  biomes: z.array(z.int().min(0).max(14)).min(1).optional(),
  realms: strings.optional(),
  ecoregions: z.array(z.int().nonnegative()).min(1).optional(),
  regions: strings.optional(),
});
export const regionalCatalogSchema: z.ZodType<RegionalCatalogDoc> = z.strictObject({
  format: z.literal('molen/regional-catalog@1'),
  id,
  version: z.int().positive(),
  title: z.string().min(1),
  requires: z.array(z.strictObject({ id, version: z.int().positive() })),
  overrides: z.array(id),
  profiles: z.array(
    z.strictObject({
      id,
      title: z.string().min(1),
      priority: z.int(),
      match: regionalMatchSchema,
      scatter: id.optional(),
      buildings: z.array(styleRuleSchema).optional(),
      wildlife: id.optional(),
      agriculture: agricultureProfileSchema.optional(),
    }),
  ),
  scatters: z.array(scatterSchema),
  plants: z.array(plantPresetSchema).optional(),
  crops: z.array(agricultureCropSchema).optional(),
  animals: z.array(wildlifeSpeciesSchema).optional(),
  populations: z
    .array(
      z.strictObject({
        id,
        title: z.string().min(1),
        rules: z.array(
          z.strictObject({
            animal: id,
            density: z.number().min(0).max(100),
            habitats: strings,
            match: regionalMatchSchema,
            nearWater: z.number().min(0).max(500).optional(),
            protectedOnly: z.boolean().optional(),
          }),
        ),
      }),
    )
    .optional(),
  stylePack: z.string().min(1).optional(),
});

export function registerRegionalCatalogSchema(): void {
  if (getSchema('regional-catalog') !== undefined) return;
  registerSchema('regional-catalog', regionalCatalogSchema, {
    id: 'molen/regional-catalog@1',
    title: 'Regional content catalog',
    docsRef: 'guide/regional-world.md',
    description:
      'Composable ecological and architectural channels with explicit dependency versions and replacements. Resolve catalogs together to check cross-document references and selector ambiguity.',
    examples: [
      {
        format: 'molen/regional-catalog@1',
        id: 'example.regional',
        version: 1,
        title: 'Regional content',
        requires: [],
        overrides: [],
        profiles: [],
        scatters: [],
      } as JsonValue,
    ],
  });
}
