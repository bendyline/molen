import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import type { LandmarkDefinitions } from '@bendyline/molen-worldgen/kernel';
import { z } from 'zod';

export type BusinessCategory =
  | 'grocery'
  | 'restaurant'
  | 'cafe'
  | 'pharmacy'
  | 'shop'
  | 'mall'
  | 'department_store'
  | 'outlet_mall'
  | 'strip_mall';
export interface BusinessCatalogDoc {
  format: 'molen/business-catalog@1';
  version: number;
  profiles: Array<{
    id: string;
    aliases: string[];
    brandIds: string[];
    categories: string[];
    landmark: string;
  }>;
  categories: Array<{ id: BusinessCategory; kinds: string[]; landmark: string }>;
}
const word = z.string().min(1);
const landmark = word.regex(/^sign\.[a-z][a-z0-9_.]*$/);
const businessCatalogSchema: z.ZodType<BusinessCatalogDoc> = z.strictObject({
  format: z.literal('molen/business-catalog@1'),
  version: z.int().positive(),
  profiles: z.array(
    z.strictObject({
      id: word,
      aliases: z.array(word).min(1),
      brandIds: z.array(word),
      categories: z.array(word).min(1),
      landmark,
    }),
  ),
  categories: z.array(
    z.strictObject({
      id: z.enum([
        'grocery',
        'restaurant',
        'cafe',
        'pharmacy',
        'shop',
        'mall',
        'department_store',
        'outlet_mall',
        'strip_mall',
      ]),
      kinds: z.array(word).min(1),
      landmark,
    }),
  ),
});
/** Validate a catalog and check that every sign it names is a sign in `definitions`. */
export function validateBusinessCatalogDocuments(
  data: unknown,
  definitions: LandmarkDefinitions,
): BusinessCatalogDoc {
  const doc = businessCatalogSchema.parse(data);
  const ids = new Set<string>(),
    brandIds = new Set<string>(),
    kinds = new Set<string>(),
    categories = new Set<string>();
  for (const entry of [...doc.profiles, ...doc.categories]) {
    const visual = Object.hasOwn(definitions, entry.landmark)
      ? definitions[entry.landmark]
      : undefined;
    if (visual?.generator !== 'sign')
      throw new Error(`Business ${entry.id} references unknown sign ${entry.landmark}`);
  }
  for (const profile of doc.profiles) {
    if (ids.has(profile.id)) throw new Error(`Duplicate business identity: ${profile.id}`);
    ids.add(profile.id);
    for (const id of new Set(profile.brandIds)) {
      if (brandIds.has(id)) throw new Error(`Brand ID assigned more than once: ${id}`);
      brandIds.add(id);
    }
  }
  for (const category of doc.categories) {
    if (categories.has(category.id)) throw new Error(`Duplicate business category: ${category.id}`);
    categories.add(category.id);
    for (const kind of category.kinds) {
      if (kinds.has(kind)) throw new Error(`Business kind assigned more than once: ${kind}`);
      kinds.add(kind);
    }
  }
  return doc;
}
// Documentation example only; the business catalog is content (the molen.earth pack).
const EXAMPLE: BusinessCatalogDoc = {
  format: 'molen/business-catalog@1',
  version: 1,
  profiles: [
    {
      id: 'neighborhood_grocery',
      aliases: ['Neighborhood Grocery'],
      brandIds: ['Q0000001'],
      categories: ['supermarket', 'grocery'],
      landmark: 'sign.neighborhood_grocery',
    },
  ],
  categories: [
    { id: 'grocery', kinds: ['supermarket', 'grocery'], landmark: 'sign.grocery' },
    { id: 'cafe', kinds: ['cafe', 'coffee_shop'], landmark: 'sign.cafe' },
  ],
};
export function registerBusinessCatalogSchema(): void {
  if (getSchema('business-catalog')) return;
  registerSchema('business-catalog', businessCatalogSchema, {
    id: 'molen/business-catalog@1',
    title: 'Business identity catalog',
    description:
      'Map source brand IDs, aliases and place categories onto reusable landmark manifests.',
    examples: [EXAMPLE as unknown as JsonValue],
    docsRef: 'guide/recognizable-places.md',
  });
}
