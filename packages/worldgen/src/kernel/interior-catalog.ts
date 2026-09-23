import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import type { InteriorCatalogDoc, InteriorProfile } from './interior-types';
import { COLOR_RE } from './schema-common';

const palette: InteriorProfile['palette'] = {
  floor: '#b9b2a2',
  wall: '#e2ddcf',
  wood: '#856249',
  accent: '#536b66',
};
const palettes: Record<string, InteriorProfile['palette']> = {
  house: { floor: '#a98a67', wall: '#ddd5c5', wood: '#816047', accent: '#597b77' },
  grocery: { floor: '#d0cec5', wall: '#eeeae0', wood: '#b8b6aa', accent: '#54785b' },
  'fast-food': { floor: '#c7beb0', wall: '#f0e5d3', wood: '#b48654', accent: '#a64e36' },
  cafe: { floor: '#a48569', wall: '#e5d8c2', wood: '#77523b', accent: '#4e746a' },
  office: { floor: '#78848c', wall: '#e0e4e1', wood: '#b8a17c', accent: '#4e6379' },
  clinic: { floor: '#becfc9', wall: '#ecf1ec', wood: '#cbd2ca', accent: '#5b8c95' },
  warehouse: { floor: '#969892', wall: '#c5c7be', wood: '#987143', accent: '#bb8a39' },
};
function profile(
  id: string,
  labels: string[],
  algorithm: InteriorProfile['algorithm'],
  furnishing: InteriorProfile['furnishing'],
  width: number,
  depth: number,
  aisle = 1.5,
): InteriorProfile {
  return {
    id,
    version: id === 'house' ? 2 : 1,
    ...(algorithm === 'residential'
      ? { residential: { upstairs: true, stairWidth: 1.3, runPerRise: 1.65, minRoomWidth: 2.4 } }
      : {}),
    labels,
    algorithm,
    furnishing,
    moduleWidth: width,
    moduleDepth: depth,
    aisleWidth: aisle,
    density: 0.9,
    palette: { ...(palettes[id] ?? palette) },
  };
}

/** Ordered matching, specific uses before broad uses. Changing one profile only rerolls that use. */
export const DEFAULT_INTERIOR_CATALOG: InteriorCatalogDoc = {
  format: 'molen/interior-catalog@1',
  fallback: 'generic',
  profiles: [
    profile('grocery', ['supermarket', 'grocery'], 'aisles', 'shelf', 1.1, 6, 2.4),
    profile('fast-food', ['fast_food', 'fast-food'], 'dining', 'table', 2.3, 2.3, 1.6),
    profile('restaurant', ['restaurant', 'food_court'], 'dining', 'table', 2.5, 2.5, 1.5),
    profile('cafe', ['cafe', 'coffee_shop'], 'dining', 'table', 1.8, 1.8, 1.4),
    profile('pharmacy', ['pharmacy', 'chemist'], 'aisles', 'shelf', 0.9, 3, 1.8),
    profile(
      'retail',
      ['retail', 'shop', 'department_store', 'commercial'],
      'aisles',
      'shelf',
      1.1,
      3.5,
      1.8,
    ),
    profile(
      'house',
      [
        'house',
        'detached',
        'residential',
        'bungalow',
        'terrace',
        'semidetached_house',
        'semidetached',
        'townhouse',
        'townhouses',
        'cabin',
        'hut',
        'farm',
      ],
      'residential',
      'bed',
      4.2,
      4.5,
      1.4,
    ),
    profile('apartments', ['apartments', 'hotel', 'dormitory'], 'rooms', 'bed', 4.4, 5, 1.8),
    profile('office', ['office', 'offices'], 'workplace', 'desk', 2.4, 2.1, 1.5),
    profile('school', ['school', 'university', 'college'], 'rooms', 'desk', 6, 7, 2.4),
    profile('clinic', ['clinic', 'hospital', 'doctors'], 'rooms', 'bed', 4.2, 4.8, 2),
    profile(
      'warehouse',
      ['warehouse', 'industrial', 'storage', 'hangar'],
      'storage',
      'rack',
      1.8,
      5,
      3,
    ),
    profile('library', ['library', 'books'], 'aisles', 'shelf', 0.8, 4, 1.8),
    profile(
      'assembly',
      ['church', 'place_of_worship', 'theatre', 'community_centre'],
      'hall',
      'bench',
      3.2,
      1,
      1.5,
    ),
    profile('generic', [], 'hall', 'sofa', 2.2, 1.2, 1.8),
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
export function resolveInteriorProfile(
  labels: readonly string[],
  catalog: InteriorCatalogDoc = DEFAULT_INTERIOR_CATALOG,
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
    examples: [DEFAULT_INTERIOR_CATALOG as unknown as JsonValue],
    docsRef: 'guide/building-interiors.md',
  });
}
