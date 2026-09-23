import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import { LANDMARK_CATALOG, LANDMARK_DEFINITIONS } from './landmark-catalog';
import type { LandmarkCatalogDoc, LandmarkDefinitions, LandmarkDoc } from './landmark-types';
import { COLOR_RE, REL_PATH_RE } from './schema-common';

const id = z
  .string()
  .regex(/^[a-z][a-z0-9_.]*$/)
  .describe('Stable builtin model name, such as sign.burger_restaurant.');
const color = z.string().regex(COLOR_RE);
const base = {
  format: z.literal('molen/landmark@1'),
  id,
  version: z.int().positive(),
  title: z.string().min(1),
};
const sign = z.strictObject({
  text: z.string().min(1).max(40),
  background: color,
  foreground: color,
  mark: color,
  symbol: z.enum([
    'arches',
    'spark',
    'disc',
    'target',
    'cross',
    'letters',
    'cup',
    'tag',
    'roofline',
    'star',
    'burger',
    'bell',
    'bucket',
    'domino',
  ]),
  letters: z.string().max(3).optional(),
});
const landmarkSchema: z.ZodType<LandmarkDoc> = z.discriminatedUnion('generator', [
  z.strictObject({
    ...base,
    generator: z.literal('sign'),
    sign,
    appearance: z.strictObject({ wall: color, accent: color }),
    storefront: z.strictObject({
      width: z.number().positive().max(100),
      sharedWidth: z.number().positive().max(100),
      style: id
        .optional()
        .describe(
          'Preferred architectural style for a directly identified low-rise host, when the active pack includes it. Tenants never select the host style.',
        ),
    }),
  }),
  z.strictObject({
    ...base,
    generator: z.literal('boxes'),
    parts: z
      .array(
        z.strictObject({
          center: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
          size: z.tuple([z.number().positive(), z.number().positive(), z.number().positive()]),
          color,
          yaw: z.number().finite().optional(),
          tiers: z
            .array(z.union([z.literal(0), z.literal(1), z.literal(2)]))
            .min(1)
            .max(3)
            .optional(),
        }),
      )
      .min(1)
      .max(256)
      .describe('Ordered metric box parts; omitted tiers means all three detail levels.'),
  }),
]);
const catalogSchema: z.ZodType<LandmarkCatalogDoc> = z.strictObject({
  format: z.literal('molen/landmark-catalog@1'),
  version: z.int().positive(),
  models: z
    .record(id, z.string().regex(REL_PATH_RE))
    .describe('Builtin model name to contained catalog-relative JSON manifest path.'),
});
export async function resolveLandmarkCatalogDocuments(
  data: unknown,
  readDocument: (path: string) => Promise<unknown>,
): Promise<LandmarkDefinitions> {
  const catalog = catalogSchema.parse(data);
  const result: Record<string, LandmarkDoc> = Object.create(null);
  for (const [key, path] of Object.entries(catalog.models)) {
    const doc = landmarkSchema.parse(await readDocument(path));
    if (doc.id !== key)
      throw new Error(`Landmark catalog key ${key} does not match ${doc.id} in ${path}`);
    if (doc.generator === 'sign' && !key.startsWith('sign.'))
      throw new Error(`Sign model id must start with sign.: ${key}`);
    result[key] = doc;
  }
  return result;
}
export function registerLandmarkSchemas(): void {
  if (!getSchema('landmark'))
    registerSchema('landmark', landmarkSchema, {
      id: 'molen/landmark@1',
      title: 'Landmark model',
      description:
        'Reusable sign or furniture geometry recipe, with colors, facade appearance and detail levels.',
      examples: [LANDMARK_DEFINITIONS['sign.grocery'] as unknown as JsonValue],
      docsRef: 'guide/recognizable-places.md',
    });
  if (!getSchema('landmark-catalog'))
    registerSchema('landmark-catalog', catalogSchema, {
      id: 'molen/landmark-catalog@1',
      title: 'Landmark catalog',
      description: 'An index of reusable external landmark model manifests.',
      examples: [LANDMARK_CATALOG as unknown as JsonValue],
      docsRef: 'guide/recognizable-places.md',
    });
}
