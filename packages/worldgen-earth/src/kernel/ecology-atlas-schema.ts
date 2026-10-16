import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { checkEcologyAtlas, type EcologyAtlasDoc } from './ecology-atlas';

const ecologyAtlasSchema = z.strictObject({
  format: z.literal('molen/ecology-atlas@1'),
  id: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/),
  version: z.int().positive(),
  title: z.string().min(1),
  cellDegrees: z.number().min(0.05).max(10).describe('Global equal-angle cell size in degrees.'),
  regions: z
    .array(
      z.strictObject({
        id: z.int().nonnegative(),
        name: z.string().min(1),
        biome: z.int().min(0).max(14),
        realm: z.string().min(1),
      }),
    )
    .max(65534),
  rows: z
    .array(z.array(z.int().nonnegative()).max(14400))
    .max(3600)
    .describe(
      'North-to-south rows: alternating run length and 1-based region index; 0 is uncovered.',
    ),
  source: z.strictObject({
    title: z.string().min(1),
    url: z.url(),
    license: z.string().min(1),
    citation: z.string().min(1),
    sha256: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    interpretation: z.string().min(1),
  }),
});

export const ECOLOGY_ATLAS_EXAMPLE: EcologyAtlasDoc = {
  format: 'molen/ecology-atlas@1',
  id: 'example.ecology',
  version: 1,
  title: 'Coarse habitat geography',
  cellDegrees: 10,
  regions: [{ id: 1, name: 'Example forest', biome: 4, realm: 'Palearctic' }],
  rows: Array.from({ length: 18 }, (_, i) => [36, i === 4 ? 1 : 0]),
  source: {
    title: 'Synthetic schema example',
    url: 'https://example.com/ecology',
    license: 'MIT',
    citation: 'Molen schema example',
    sha256: `sha256:${'0'.repeat(64)}`,
    interpretation: 'Synthetic geography for format demonstration only.',
  },
};

export function registerEcologyAtlasSchema(): void {
  if (getSchema('ecology-atlas') !== undefined) return;
  registerSchema('ecology-atlas', ecologyAtlasSchema, {
    id: 'molen/ecology-atlas@1',
    title: 'Ecological geography atlas',
    docsRef: 'guide/regional-world.md',
    description:
      'Compact global ecological geography with attributed source and run-length encoded rows.',
    examples: [ECOLOGY_ATLAS_EXAMPLE as unknown as JsonValue],
    validate(data) {
      try {
        checkEcologyAtlas(data as EcologyAtlasDoc);
        return [];
      } catch (error) {
        return [{ path: '/', code: 'ecology_grid', message: (error as Error).message }];
      }
    },
  });
}
