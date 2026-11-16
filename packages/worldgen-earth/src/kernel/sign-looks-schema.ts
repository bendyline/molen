import { getSchema, type JsonValue, registerSchema } from '@bendyline/molen-schema';
import { z } from 'zod';
import type { BusinessCategory } from './business-catalog-schema';

/**
 * How a sign sets a name: plate and letter colors, an optional accent band, a font role and
 * case. Never a mark, emblem or brand typeface: a look gives a place the colors of its real
 * counterpart, and the name is always set in the host's own faces.
 */
export interface SignLook {
  plate: string;
  ink: string;
  /** Accent band along the plate's lower edge. */
  stripe?: string;
  /** A glyph atlas role (`bold`, `sans`, `serif`) or face id; default the atlas's default face. */
  font?: string;
  /** `upper` capitalizes the name; default as mapped. */
  case?: 'as-is' | 'upper';
  /** Extra advance between letters, em. */
  letterSpacing?: number;
}

export interface SignLooksDoc {
  format: 'molen/sign-looks@1';
  version: number;
  /**
   * Looks for named places by category. A place takes one by a hash of its normalized name, so
   * every branch of a local chain the catalog does not know still matches the others.
   */
  families: Partial<Record<BusinessCategory, SignLook[]>>;
  /**
   * Catalog identities (business-catalog profile ids). A chain's look starts from its descriptor
   * sign's palette (plate = background, letters = foreground, band = mark); `look` overrides any
   * of it and `display` the name shown (default the profile's first alias, or a non-Latin alias
   * the map matched, such as マクドナルド).
   */
  chains?: Record<string, { display?: string; look?: Partial<SignLook> }>;
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const color = z.string().regex(COLOR);
const lookFields = {
  plate: color,
  ink: color,
  stripe: color.optional(),
  font: z.string().min(1).max(100).optional(),
  case: z.enum(['as-is', 'upper']).optional(),
  letterSpacing: z.number().min(-0.1).max(0.5).optional(),
};
const lookSchema = z.strictObject(lookFields);
const CATEGORIES = [
  'grocery',
  'restaurant',
  'cafe',
  'pharmacy',
  'shop',
  'mall',
  'department_store',
  'outlet_mall',
  'strip_mall',
] as const satisfies readonly BusinessCategory[];

const signLooksSchema: z.ZodType<SignLooksDoc> = z.strictObject({
  format: z.literal('molen/sign-looks@1'),
  version: z.int().positive(),
  families: z.partialRecord(z.enum(CATEGORIES), z.array(lookSchema).min(1).max(64)),
  chains: z
    .record(
      z.string().min(1),
      z.strictObject({
        display: z.string().min(1).max(48).optional(),
        look: z.strictObject(lookFields).partial().optional(),
      }),
    )
    .optional(),
}) as z.ZodType<SignLooksDoc>;

/** Validate a sign looks document; `chains` must name identities `profiles` knows. */
export function validateSignLooks(data: unknown, profiles: ReadonlySet<string>): SignLooksDoc {
  const doc = signLooksSchema.parse(data);
  for (const id of Object.keys(doc.chains ?? {}))
    if (!profiles.has(id)) throw new Error(`Sign looks name unknown business identity: ${id}`);
  return doc;
}

// Documentation example only; the looks are content (the molen.earth pack).
const EXAMPLE: SignLooksDoc = {
  format: 'molen/sign-looks@1',
  version: 1,
  families: {
    cafe: [
      { plate: '#4c4036', ink: '#f3e4c7', font: 'serif' },
      { plate: '#efe9df', ink: '#1f5a46', font: 'bold' },
    ],
  },
  chains: { neighborhood_grocery: { look: { plate: '#bc2530', ink: '#ffffff' } } },
};

export function registerSignLooksSchema(): void {
  if (getSchema('sign-looks')) return;
  registerSchema('sign-looks', signLooksSchema, {
    id: 'molen/sign-looks@1',
    title: 'Storefront sign looks',
    description:
      'Plate and letter colors, accent band, font role and case for signs that show mapped place names.',
    examples: [EXAMPLE as unknown as JsonValue],
    docsRef: 'guide/recognizable-places.md',
  });
}
