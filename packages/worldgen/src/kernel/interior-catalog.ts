import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import type { InteriorCatalogDoc, InteriorProfile } from './interior-types';
import { COLOR_RE } from './schema-common';

// Documentation example only; interior catalogs are content, carried by a style pack.
const EXAMPLE: InteriorCatalogDoc = {
  format: 'molen/interior-catalog@1',
  fallback: 'generic',
  profiles: [
    {
      id: 'cafe',
      version: 1,
      labels: ['cafe', 'coffee_shop'],
      algorithm: 'dining',
      furnishing: 'table',
      moduleWidth: 1.8,
      moduleDepth: 1.8,
      aisleWidth: 1.4,
      density: 0.9,
      palette: { floor: '#a48569', wall: '#e5d8c2', wood: '#77523b', accent: '#4e746a' },
    },
    {
      id: 'generic',
      version: 1,
      labels: [],
      algorithm: 'hall',
      furnishing: 'sofa',
      moduleWidth: 2.2,
      moduleDepth: 1.2,
      aisleWidth: 1.8,
      density: 0.9,
      palette: { floor: '#b9b2a2', wall: '#e2ddcf', wood: '#856249', accent: '#536b66' },
    },
  ],
};

const color = z.string().regex(COLOR_RE);
const catalogSchema: z.ZodType<InteriorCatalogDoc> = z
  .strictObject({
    format: z.literal('molen/interior-catalog@1'),
    fallback: z.string().min(1),
    profiles: z
      .array(
        z.strictObject({
          id: z.string().regex(/^[a-z][a-z0-9.-]*$/),
          version: z.int().positive(),
          labels: z.array(z.string().min(1)),
          algorithm: z.enum([
            'aisles',
            'dining',
            'rooms',
            'workplace',
            'storage',
            'hall',
            'residential',
          ]),
          residential: z
            .strictObject({
              upstairs: z.boolean(),
              stairWidth: z.number().min(1.2).max(2),
              runPerRise: z.number().min(1.5).max(2),
              minRoomWidth: z.number().min(2.2).max(4),
            })
            .optional(),
          furnishing: z.enum([
            'shelf',
            'checkout',
            'table',
            'counter',
            'bed',
            'sofa',
            'desk',
            'rack',
            'bench',
            'wardrobe',
            'kitchen',
            'vanity',
            'toilet',
            'shower',
            'rug',
            'coffee-table',
            'bookcase',
            'plant',
            'dresser',
          ]),
          aisleWidth: z.number().min(1.2).max(8).describe('Minimum clear route width in meters.'),
          moduleWidth: z.number().min(0.5).max(20),
          moduleDepth: z.number().min(0.5).max(30),
          density: z.number().min(0).max(1),
          palette: z.strictObject({ floor: color, wall: color, wood: color, accent: color }),
        }),
      )
      .min(1)
      .max(128),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();
    doc.profiles.forEach((p, i) => {
      if (ids.has(p.id))
        ctx.addIssue({
          code: 'custom',
          path: ['profiles', i, 'id'],
          message: 'Duplicate profile id',
        });
      ids.add(p.id);
    });
    if (!ids.has(doc.fallback))
      ctx.addIssue({ code: 'custom', path: ['fallback'], message: 'Fallback must name a profile' });
  });

export function validateInteriorCatalog(data: unknown): InteriorCatalogDoc {
  return catalogSchema.parse(data);
}
/** The first profile whose labels match, in catalog order; the fallback profile otherwise. */
export function resolveInteriorProfile(
  labels: readonly string[],
  catalog: InteriorCatalogDoc,
): InteriorProfile {
  // Caller orders evidence: confirmed occupant before building class before surrounding use.
  for (const label of labels) {
    const normalized = label.trim().toLowerCase();
    const match = catalog.profiles.find((p) => p.labels.includes(normalized));
    if (match) return match;
  }
  const fallback = catalog.profiles.find((p) => p.id === catalog.fallback);
  if (!fallback) throw new Error(`Unknown interior fallback: ${catalog.fallback}`);
  return fallback;
}
export function registerInteriorSchema(): void {
  if (getSchema('interior-catalog')) return;
  registerSchema('interior-catalog', catalogSchema, {
    id: 'molen/interior-catalog@1',
    title: 'Interior catalog',
    description:
      'Versioned type-specific layout algorithms, metric clearances and furnishing palettes for inferred interiors, including connected residential storeys.',
    examples: [EXAMPLE as unknown as JsonValue],
    docsRef: 'guide/building-interiors.md',
  });
}
